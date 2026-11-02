// 沙盒里的那一半：编译组件、拼场景、播放、导出。和外面只通过 postMessage 说话（协议见 studio/runner.js）。
import './gen/fonts.css';
import { W, Scene, builtinRegistry, renderer, loadFont, exportGif, renderFrames } from './engine/index.js';
import { compile, sourceFor } from './engine/components.js';
import { makeCanvas, canvasBytes } from './engine/core.js';
import { zipStore } from './engine/zip.js';
import { BUILTIN_MODEL } from './engine/core.js';
import { loadModel } from './engine/model.js';
import { lockEval } from './engine/loopguard.js';

// 只在不透明来源里干活（<iframe sandbox="allow-scripts">）：别的网站要是不加 sandbox 直接嵌这个页面，
// 组件代码就会以本站的身份运行，能读本站的存储。本机开发 / CI 出图（localhost、127.0.0.1）例外，但只认同源发来的消息。
const OPAQUE = self.origin === 'null';
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
if (!OPAQUE && !LOCAL) {
  document.body.textContent = '这个页面只能在创意工坊编辑器的沙盒里打开。';
  throw new Error('sandbox.html must run in an opaque-origin sandboxed iframe');
}
lockEval();                                                  // eval / Function 造出来的代码也要插循环保险

const reg = builtinRegistry();
const builtins = new Map(reg.items);                         // 改过的内置组件可以恢复原样
const R = renderer();
const canvas = document.getElementById('c'), ctx = canvas.getContext('2d');
let scene = null, project = null, playing = true, speed = 1, t0 = performance.now(), tHold = 0, lastFrame = -1, onion = false;
let reported = 0;
const userSources = new Map();
const models = new Map([['axolotl', BUILTIN_MODEL]]);        // 模型 id -> 体素模型

function useModel() {
  const m = models.get(project?.model?.component) || BUILTIN_MODEL;
  m.face = project?.model?.face ?? (m === BUILTIN_MODEL || m.id === 'logo');
  R.setModel(m);
}                               // origin -> 最后一次编译成功的源码

const post = (msg, transfer) => parent.postMessage(msg, '*', transfer || []);

function catalog() {
  const out = [];
  for (const e of reg.items.values()) {
    const d = reg.get(e.def.type, e.def.id);
    const meta = { type: d.type, id: d.id, name: String(d.name || d.id), origin: e.origin, base: d.base || null, entrance: !!d.entrance, holdsItself: !!d.holdsItself, hasCode: !!e.source };
    try { meta.params = JSON.parse(JSON.stringify(d.params || {})); } catch { meta.params = {}; }
    if (d.face) meta.face = d.face;
    if (d.sprite) meta.sprite = d.sprite;
    if (d.boxes) meta.boxes = d.boxes;
    if (d.description) meta.description = String(d.description);
    out.push(meta);
  }
  return out;
}

function errorsOf(s) { return s ? [...s.errors].map(([key, e]) => ({ key, message: e.message, line: e.line ?? null })) : []; }

async function build() {
  if (!project) return;
  await loadFont(project.layers.filter((l) => l.type === 'text').map((l) => l.text).join('') || '美西螈');
  useModel();
  scene = new Scene(project, reg, R);
  lastFrame = -1;
  scene.frame(ctx, playing ? 0 : tHold);                     // 先同步画一帧：组件一出错马上能报出来
  reported = scene.errors.size;
  post({ type: 'scene', N: scene.N, T: scene.T, fps: scene.FPS, cover: scene.coverTime(), errors: errorsOf(scene) });
}

function currentT(now) {
  if (!scene) return 0;
  return playing ? (((now - t0) / 1000) * speed) % scene.T : tHold;
}

function loop(now) {
  requestAnimationFrame(loop);
  if (!scene) return;
  const t = currentT(now), f = Math.floor(t * scene.FPS + 1e-6);
  if (!playing && f === lastFrame && !scene.dirty) return;
  scene.dirty = false;
  if (onion && !playing) {                                   // 洋葱皮：前一帧半透明垫在下面
    scene.frame(ctx, ((f - 1 + scene.N) % scene.N) / scene.FPS);
    const prev = makeCanvas(W, W); prev.getContext('2d').drawImage(canvas, 0, 0);
    scene.frame(ctx, t);
    ctx.save(); ctx.globalAlpha = 0.35; ctx.drawImage(prev, 0, 0); ctx.restore();
  } else scene.frame(ctx, t);
  if (f !== lastFrame) { lastFrame = f; post({ type: 'time', t, frame: f, playing }); }
  if (scene.errors.size !== reported) { reported = scene.errors.size; post({ type: 'errors', errors: errorsOf(scene) }); }
}

function loadUser(items) {                                   // 用户 / 文件 / 工程自带的组件；没变的不重编
  const errors = [];
  for (const { source, origin } of items) {
    if (userSources.get(origin) === source) continue;
    try {
      const defs = compile(source, origin, { guard: true });
      for (const d of defs) reg.put(d, source, origin);
      userSources.set(origin, source);
    } catch (e) {
      errors.push({ origin, message: e.message, line: e.line ?? null });     // 编译失败：保留上一个能用的版本
    }
  }
  return errors;
}

// 组件有两个来源：「我的组件」（components 消息）和工程自带的（project 消息）。
// 某个来源不再带某段代码了，就把它注册的组件撤掉（顶掉的内置组件恢复原样），免得新工程用到上一个工程的旧代码。
const owned = { mine: new Set(), project: new Set() };
function dropOrigin(origin) {
  let n = 0;
  for (const [key, e] of [...reg.items]) {
    if (e.origin !== origin) continue;
    reg.remove(e.def.type, e.def.id); n++;
    const b = builtins.get(key); if (b) reg.put(b.def, b.source, b.origin);
  }
  userSources.delete(origin);
  return n;
}
function syncUser(kind, items) {
  const errors = loadUser(items), now = new Set(items.map((i) => i.origin)), other = owned[kind === 'mine' ? 'project' : 'mine'];
  let dropped = 0;
  for (const o of owned[kind]) if (!now.has(o) && !other.has(o)) dropped += dropOrigin(o);
  owned[kind] = now;
  return { errors, dropped };
}

const handlers = {
  async components({ items = [] }) {
    const { errors } = syncUser('mine', items);
    post({ type: 'catalog', errors, catalog: catalog() });
    if (project) await build();
  },
  source({ req, ctype, id }) {
    const e = reg.entry(ctype, id);
    post({ type: 'source-done', req, source: e ? (e.source || sourceFor(e.def)) : null, origin: e?.origin || null, builtin: builtins.has(reg.key(ctype, id)) && builtins.get(reg.key(ctype, id)) === e });
  },
  async remove({ ctype, id }) {
    reg.remove(ctype, id); userSources.clear();
    const b = builtins.get(reg.key(ctype, id)); if (b) reg.put(b.def, b.source, b.origin);
    post({ type: 'catalog', errors: [], catalog: catalog() }); if (project) await build(); },
  async project({ project: p }) {
    project = p;
    const { errors, dropped } = syncUser('project', p.components || []);
    if (errors.length || dropped) post({ type: 'catalog', errors, catalog: catalog() });
    await build();
  },
  transport({ playing: pl, speed: sp, t, onion: on }) {
    if (sp) speed = sp;
    if (on !== undefined) { onion = !!on; if (scene) scene.dirty = true; }
    const now = performance.now();
    if (t !== undefined) tHold = t;
    else if (pl === false && playing) tHold = currentT(now);
    if (pl !== undefined) playing = !!pl;
    if (playing) t0 = now - (tHold / speed) * 1000;
    if (scene) scene.dirty = true;
  },
  async export({ req, format = 'gif', size, colors, maxKb }) {
    if (!scene) return;
    try {
      const progress = (p) => post({ type: 'progress', req, p });
      const s = new Scene(project, reg, R);                   // 独立一份，不打断预览
      let bytes, mime = 'image/gif';
      if (format === 'gif') bytes = await exportGif(s, { size, colors, maxKb }, progress);
      else if (format === 'png-zip') {
        const frames = await renderFrames(s, size || s.P.size, progress), c = makeCanvas(size || s.P.size, size || s.P.size), g = c.getContext('2d');
        const files = [];
        for (let i = 0; i < frames.length; i++) {
          g.putImageData(new ImageData(frames[i], c.width, c.height), 0, 0);
          files.push({ name: `frame_${String(i + 1).padStart(3, '0')}.png`, data: await canvasBytes(c) });
        }
        bytes = zipStore(files); mime = 'application/zip';
      } else if (format === 'png') {
        const c = makeCanvas(size || s.P.size, size || s.P.size), b = makeCanvas(W, W);
        s.frame(b.getContext('2d'), currentT(performance.now())); c.getContext('2d').drawImage(b, 0, 0, c.width, c.height);   // 正在播就存当下这一帧
        bytes = await canvasBytes(c); mime = 'image/png';
      }
      post({ type: 'exported', req, mime, bytes: bytes.buffer }, [bytes.buffer]);
    } catch (e) {
      post({ type: 'export-error', req, message: e.message });
    }
  },
  async filmstrip({ req, n, size = 64 }) {
    if (!scene) return;
    const s = new Scene(project, reg, R), big = makeCanvas(W, W), bg = big.getContext('2d'), out = [];
    const count = Math.min(n || s.N, s.N);
    for (let k = 0; k < count; k++) {
      const i = Math.floor(k * s.N / count);
      s.frame(bg, i / s.FPS);
      const c = makeCanvas(size, size); c.getContext('2d').drawImage(big, 0, 0, size, size);
      out.push(c.transferToImageBitmap ? c.transferToImageBitmap() : await createImageBitmap(c));
    }
    post({ type: 'filmstrip-done', req, bitmaps: out }, out);
  },
  // 素材库的小图：表情 / 道具 / 帽子 / 皮肤直接画在模型上，裁出脑袋附近
  async thumbs({ req, kind, ids = [], size = 96 }) {
    const big = makeCanvas(W, W), bg = big.getContext('2d'), out = [];
    for (const id of ids.slice(0, 400)) {
      const layers = [{ id: 'm', type: 'motion', component: 'idle' }];
      if (kind === 'face') layers.push({ id: 'f', type: 'face', component: id, blink: false });
      if (kind === 'prop') layers.push({ id: 'p', type: 'prop', component: id });
      if (kind === 'wear') layers.push({ id: 'w', type: 'wear', component: id });
      const s = new Scene({ layers, frames: 48, water: { on: false }, background: { mode: 'transparent' }, idle: { look: 8, bob: 0 },
        skin: kind === 'skin' ? { component: id, params: {} } : project?.skin }, reg, R);
      s.frame(bg, 0);
      const [hx, hy] = s.LAST ? s.headPt() : [256, 330];
      const crop = kind === 'face' ? 150 : kind === 'skin' ? 330 : 230, cx = kind === 'skin' ? 256 : hx - (kind === 'prop' ? 30 : 0), cy = kind === 'skin' ? 320 : hy + (kind === 'wear' ? -20 : 10);
      const c = makeCanvas(size, size), g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(big, cx - crop / 2, cy - crop / 2, crop, crop, 0, 0, size, size);
      out.push(c.transferToImageBitmap ? c.transferToImageBitmap() : await createImageBitmap(c));
    }
    post({ type: 'thumbs-done', req, bitmaps: out }, out);
  },
  async model({ req, id, bytes }) {
    try {
      const m = await loadModel(bytes);
      m.id = id; models.set(id, m);
      post({ type: 'model-done', req, ok: true, id, quads: Object.values(m.mesh).reduce((s, q) => s + q.length, 0), bones: Object.keys(m.bones) });
      if (project?.model?.component === id) await build();
    } catch (e) { post({ type: 'model-done', req, ok: false, id, message: e.message }); }
  },
  ping({ n }) { post({ type: 'pong', n }); },
};

// 组件在定时器、await 之后抛的错（包括循环保险）不经过 scene.guard：也记成组件错误，出图时就不会悄悄发布
const asyncFail = (err) => {
  if (!scene) return;
  scene.fail('async', '定时器或异步代码', err instanceof Error ? err : new Error(String(err)));
  post({ type: 'errors', errors: errorsOf(scene) }); reported = scene.errors.size;
};
window.addEventListener('error', (e) => asyncFail(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => asyncFail(e.reason));

window.addEventListener('message', async (e) => {
  if (e.source !== parent || !e.data || typeof e.data.type !== 'string' || !handlers[e.data.type]) return;
  if (!OPAQUE && e.origin !== location.origin) return;                // 本机不加沙盒跑的时候只认同源
  try { await handlers[e.data.type](e.data); } catch (err) { post({ type: 'fatal', message: String(err && err.message || err) }); }
});

requestAnimationFrame(loop);
post({ type: 'ready', catalog: catalog() });
