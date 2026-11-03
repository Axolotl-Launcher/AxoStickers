// 沙盒里的那一半：编译组件、拼场景、播放、导出。和外面只通过 postMessage 说话（协议见 studio/runner.js）。
import { W, Scene, builtinRegistry, renderer, loadFont, exportGif } from './engine/index.js';
import { registerFont, hasFont } from './engine/draw.js';
import { eachFrame } from './engine/gif.js';
import { compile, sourceFor } from './engine/components.js';
import { makeCanvas, canvasBytes } from './engine/core.js';
import { zipStore } from './engine/zip.js';
import { BUILTIN_MODEL } from './engine/core.js';
import { loadModel } from './engine/model.js';
import { lockEval } from './engine/loopguard.js';
import { detectPerf, quality } from './perf.js';

// 只在不透明来源里干活（<iframe sandbox="allow-scripts">）：别的网站要是不加 sandbox 直接嵌这个页面，
// 组件代码就会以本站的身份运行，能读本站的存储。本机开发 / CI 出图（localhost、127.0.0.1）例外，但只认同源发来的消息。
const OPAQUE = self.origin === 'null';
const HOME = new URL(location.href).origin;                  // 本站（沙盒页面地址的来源）：只听本站页面发来的消息
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
if (!OPAQUE && !LOCAL) {
  document.body.textContent = '这个页面只能在创意工坊编辑器的沙盒里打开。';
  throw new Error('sandbox.html must run in an opaque-origin sandboxed iframe');
}
lockEval();                                                  // eval / Function 造出来的代码也要插循环保险
// CSP 的 connect-src 管不到 WebRTC：组件代码能借 STUN 把数据带出去。用户代码跑之前把这些构造函数拿掉（WebSocket 之类 CSP 已经拦了，一起拿掉更干脆）
for (const k of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel', 'RTCSessionDescription', 'RTCIceCandidate', 'WebTransport', 'WebSocket', 'EventSource']) {
  try { Object.defineProperty(self, k, { value: undefined, writable: false, configurable: false }); } catch { /* 拿不掉的就算了：CSP 还挡着大部分 */ }
}

const reg = builtinRegistry();
const builtins = new Map(reg.items);                         // 改过的内置组件可以恢复原样
// 画质按设备档位（sandbox.html?q=auto|smooth|sharp，编辑器舞台上能切）：没有显卡加速时三维部分少画 3/4 的像素，缓存的帧也小一些
let Q = quality(new URLSearchParams(location.search).get('q') || 'auto');
const R = renderer({ ss: Q.ss, power: Q.power });
const canvas = document.getElementById('c'), ctx = canvas.getContext('2d');
let scene = null, project = null, playing = true, speed = 1, t0 = performance.now(), tHold = 0, lastFrame = -1, onion = false;
let visible = true, exporting = false;                       // 舞台看不见 / 正在导出：预览不画

// 预览帧缓存：一圈的帧第一次画完就存成位图，之后循环播放只贴图（三维渲染 + 合成都省了）。工程一变就清空。
// 总是存原尺寸（缩小了再放大会糊）；内存预算不够存一整圈时只存前面那些帧，剩下的照常画
const cache = { gen: 0, map: new Map(), max: 0, pending: 0 };
function resetCache() {
  for (const b of cache.map.values()) b.close?.();
  cache.map.clear(); cache.gen++; cache.pending = 0;
  cache.max = scene && typeof createImageBitmap === 'function' ? Math.min(scene.N, Math.floor(Q.cacheMB * 1048576 / (W * W * 4))) : 0;
}
function remember(f) {
  if (cache.map.has(f) || cache.map.size + cache.pending >= cache.max) return;
  const gen = cache.gen; cache.pending++;
  createImageBitmap(canvas).then((b) => {
    if (gen !== cache.gen) { b.close(); return; }
    cache.pending--;
    if (!cache.map.has(f)) cache.map.set(f, b); else b.close();
  }).catch(() => { if (gen === cache.gen) cache.pending--; });
}
function drawCached(f) {
  const b = cache.map.get(f);
  if (!b) return false;
  ctx.clearRect(0, 0, W, W); ctx.drawImage(b, 0, 0);
  return true;
}
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
  const texts = project.layers.filter((l) => l.type === 'text');
  for (const f of new Set(texts.map((l) => l.font || 'axo'))) await loadFont(texts.filter((l) => (l.font || 'axo') === f).map((l) => l.text).join('') || '美西螈', hasFont(f) ? f : 'axo');
  useModel();
  scene = new Scene(project, reg, R);
  lastFrame = -1; resetCache();
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
  if (!scene || !visible || exporting) return;
  const t = currentT(now), f = Math.min(scene.N - 1, Math.floor(t * scene.FPS + 1e-6));
  if (f === lastFrame && !scene.dirty) return;               // 和 GIF 一样一帧一帧地换：帧没变就不重画（60 Hz 的屏幕上省掉 3/4）
  scene.dirty = false;
  const tf = playing ? f / scene.FPS : t, aligned = Math.abs(tf * scene.FPS - f) < 1e-6;
  if (onion && !playing) {                                   // 洋葱皮：前一帧半透明垫在下面
    scene.frame(ctx, ((f - 1 + scene.N) % scene.N) / scene.FPS);
    const prev = makeCanvas(W, W); prev.getContext('2d').drawImage(canvas, 0, 0);
    scene.frame(ctx, tf);
    ctx.save(); ctx.globalAlpha = 0.35; ctx.drawImage(prev, 0, 0); ctx.restore();
  } else if (!(aligned && drawCached(f))) { scene.frame(ctx, tf); if (aligned) remember(f); }
  if (f !== lastFrame) { lastFrame = f; post({ type: 'time', t, frame: f, playing }); }
  if (scene.errors.size !== reported) { reported = scene.errors.size; post({ type: 'errors', errors: errorsOf(scene) }); }
}

let loaded = 0;                                               // 这次新编进来几段（用来决定要不要更新素材库）
const compileErrors = new Map();                              // origin -> 编译错误：组件库和工程两边的报错都留着，发给编辑器的总是全部
const allErrors = () => [...compileErrors].map(([origin, e]) => ({ origin, ...e }));
function loadUser(items) {                                   // 用户 / 文件 / 工程自带的组件；没变的不重编
  for (const { source, origin } of items) {
    if (userSources.get(origin) === source) continue;
    try {
      const defs = compile(source, origin, { guard: true });
      for (const [key, e] of [...reg.items]) if (e.origin === origin && !defs.some((d) => reg.key(d.type, d.id) === key)) {   // 新版本里不再有的组件撤掉（顶掉的内置组件恢复）
        reg.remove(e.def.type, e.def.id); const b = builtins.get(key); if (b) reg.put(b.def, b.source, b.origin);
      }
      for (const d of defs) reg.put(d, source, origin);
      userSources.set(origin, source); compileErrors.delete(origin); loaded++;
    } catch (e) {
      compileErrors.set(origin, { message: e.message, line: e.line ?? null });     // 编译失败：保留上一个能用的版本
    }
  }
}

// 组件有两个来源：「我的组件」（components 消息）和工程自带的（project 消息）。
// 某个来源不再带某段代码了，就把它注册的组件撤掉（顶掉的内置组件恢复原样），免得新工程用到上一个工程的旧代码。
const owned = { mine: new Set(), project: new Set() };
let hadErrors = false;
function dropOrigin(origin) {
  let n = 0;
  for (const [key, e] of [...reg.items]) {
    if (e.origin !== origin) continue;
    reg.remove(e.def.type, e.def.id); n++;
    const b = builtins.get(key); if (b) reg.put(b.def, b.source, b.origin);
  }
  userSources.delete(origin); compileErrors.delete(origin);
  return n;
}
const latest = { mine: [], project: [] };                     // 两边最近一次送来的组件
function syncUser(kind, items) {
  latest[kind] = items;
  const now = new Set(items.map((i) => i.origin)), other = owned[kind === 'mine' ? 'project' : 'mine'];
  let dropped = 0;
  for (const o of owned[kind]) if (!now.has(o) && !other.has(o)) dropped += dropOrigin(o);
  owned[kind] = now;
  // 撤掉的组件可能顶掉过别处的同名组件（比如工程里改过的工坊组件「还原」了）：两边都重编一遍，组件库在前、工程在后（工程里的改动优先）
  if (dropped) { userSources.clear(); loadUser([...latest.mine, ...latest.project]); } else loadUser(items);
  return { errors: allErrors(), dropped };
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
    loadUser([...latest.mine, ...latest.project]);            // 别的来源里也有这个组件的话让它回来
    post({ type: 'catalog', errors: allErrors(), catalog: catalog() }); if (project) await build(); },
  async project({ project: p }) {
    project = p;
    loaded = 0;
    const { errors, dropped } = syncUser('project', p.components || []);
    // 素材库只在组件有变化、或者报错有变化（包括刚修好）的时候更新
    if (loaded || dropped || errors.length || hadErrors) post({ type: 'catalog', errors, catalog: catalog() });
    hadErrors = errors.length > 0;
    await build();
  },
  transport({ playing: pl, speed: sp, t, onion: on, visible: vis }) {
    if (vis !== undefined) { visible = !!vis; if (scene) scene.dirty = true; }
    if (sp) speed = sp;
    if (on !== undefined) { onion = !!on; if (scene) scene.dirty = true; }
    const now = performance.now();
    if (t !== undefined) tHold = t;
    else if (pl === false && playing) tHold = currentT(now);
    if (pl !== undefined) playing = !!pl;
    if (playing) t0 = now - (tHold / speed) * 1000;
    if (scene) scene.dirty = true;
  },
  async export({ req, format = 'gif', size, colors, maxKb, loops = 3 }) {
    if (!scene) { post({ type: 'export-error', req, message: '预览还没准备好，等一下再导出' }); return; }
    if (!['gif', 'png-zip', 'png', 'video'].includes(format)) { post({ type: 'export-error', req, message: `不支持的格式 ${format}（能用 gif / png-zip / png / video）` }); return; }
    exporting = true; R.setQuality(2);                        // 导出总是全画质；导出期间预览先不画，省出来给导出
    try {
      const progress = (p) => post({ type: 'progress', req, p });
      const s = new Scene(project, reg, R);                   // 独立一份，不打断预览
      let bytes, mime = 'image/gif';
      if (format === 'gif') bytes = await exportGif(s, { size, colors, maxKb }, progress);
      else if (format === 'png-zip') {                         // 按时间顺序从第一帧开始，每帧马上压成 PNG（不把整帧像素都留在内存里）
        const files = [];
        await eachFrame(s, size || s.P.size, async (_, i, c) => { files.push({ name: `frame_${String(i + 1).padStart(3, '0')}.png`, data: await canvasBytes(c) }); }, { fromCover: false, onProgress: progress });
        bytes = zipStore(files); mime = 'application/zip';
      } else if (format === 'video') {                         // 视频（发朋友圈、短视频平台用）：浏览器能录 MP4 就录 MP4，不然 WebM
        ({ bytes, mime } = await recordVideo(s, size || s.P.size, loops, progress));
      } else if (format === 'png') {
        const c = makeCanvas(size || s.P.size, size || s.P.size), b = makeCanvas(W, W);
        s.frame(b.getContext('2d'), currentT(performance.now())); c.getContext('2d').drawImage(b, 0, 0, c.width, c.height);   // 正在播就存当下这一帧
        bytes = await canvasBytes(c); mime = 'image/png';
      }
      // 导出时出的错（比如只在后半段才抛的）也记到预览上：预览这时候是停着的，不然发现不了
      const errs = errorsOf(s);
      if (errs.length && scene) { for (const [k, v] of s.errors) if (!scene.errors.has(k)) scene.errors.set(k, v); reported = scene.errors.size; post({ type: 'errors', errors: errorsOf(scene) }); }
      post({ type: 'exported', req, mime, bytes: bytes.buffer, errors: errs }, [bytes.buffer]);
    } catch (e) {
      post({ type: 'export-error', req, message: e.message });
    } finally {
      exporting = false; R.setQuality(Q.ss); if (scene) scene.dirty = true;
    }
  },
  quality({ choice }) {                                       // 舞台上切画质：自动 / 流畅 / 清晰
    Q = quality(choice || 'auto'); R.setQuality(Q.ss); resetCache();
    if (scene) scene.dirty = true;
    post({ type: 'perf', perf: { ...detectPerf(), quality: Q } });
  },
  async filmstrip({ req, n, size = 64 }) {
    if (!scene) { post({ type: 'filmstrip-done', req, bitmaps: [] }); return; }
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
  // 导入的字体文件：FontFace 直接吃字节（不走网络，沙盒的 CSP 拦不着），注册成这个 id 的字体
  async font({ req, id, bytes }) {
    try {
      const family = `AxoUser${++fontSeq}`;
      const face = new FontFace(family, bytes, { weight: '100 900' });   // 当成可变粗细：用 900 画的时候不额外加粗
      await face.load(); document.fonts.add(face);
      registerFont(id, `"${family}"`);
      post({ type: 'font-done', req, ok: true, id });
      if (project?.layers?.some((l) => l.font === id)) await build();
    } catch (e) { post({ type: 'font-done', req, ok: false, id, message: e?.message || '字体文件读不出来' }); }
  },
  ping({ n }) { post({ type: 'pong', n }); },
};

// 录视频：先把一圈的帧都画好（每帧时间准），再按帧率一张张贴到画布上让 MediaRecorder 录下来，循环 loops 遍。
// 视频没有透明：透明背景垫白底。录的时候按真实时间走（48 帧 15 fps 一遍 3.2 秒），标签页切到后台会被浏览器放慢
async function recordVideo(s, size, loops, progress) {
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) throw new Error('这个浏览器录不了视频，导出 GIF 吧');
  const type = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
  if (!type) throw new Error('这个浏览器录不了视频，导出 GIF 吧');
  const n = Math.max(1, Math.min(10, Math.round(loops) || 3)), side = Math.max(64, Math.min(1080, Math.round(size / 2) * 2));   // 视频的边长要是偶数
  const big = makeCanvas(W, W), bg = big.getContext('2d'), frames = [];
  for (let i = 0; i < s.N; i++) { s.frame(bg, i / s.FPS); frames.push(await createImageBitmap(big)); progress(0.4 * (i + 1) / s.N); }
  const c = document.createElement('canvas'); c.width = c.height = side;
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
  const paint = (b) => { g.fillStyle = '#fff'; g.fillRect(0, 0, side, side); g.drawImage(b, 0, 0, side, side); };
  paint(frames[0]);
  const stream = c.captureStream(s.FPS), rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 5e6 }), chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise((res) => { rec.onstop = res; });
  rec.start();
  const dt = 1000 / s.FPS, t0 = performance.now(), total = s.N * n;
  for (let k = 0; k < total; k++) {
    const wait = t0 + k * dt - performance.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    paint(frames[k % s.N]);
    progress(0.4 + 0.6 * (k + 1) / total);
  }
  await new Promise((r) => setTimeout(r, dt));
  rec.stop(); await stopped;
  for (const b of frames) b.close();
  stream.getTracks().forEach((t) => t.stop());
  const mime = type.split(';')[0], blob = new Blob(chunks, { type: mime });
  return { bytes: new Uint8Array(await blob.arrayBuffer()), mime };
}

// 组件在定时器、await 之后抛的错（包括循环保险）不经过 scene.guard：也记成组件错误，出图时就不会悄悄发布
const asyncFail = (err) => {
  if (!scene) return;
  scene.fail('async', '定时器或异步代码', err instanceof Error ? err : new Error(String(err)));
  post({ type: 'errors', errors: errorsOf(scene) }); reported = scene.errors.size;
};
window.addEventListener('error', (e) => asyncFail(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => asyncFail(e.reason));

// 导出要好几秒：期间改工程 / 换组件 / 换模型的消息先排队，等导出完再处理，免得一张 GIF 里混着两个版本
let busy = Promise.resolve();
const CHANGES = new Set(['project', 'components', 'remove', 'model', 'font', 'quality']);
let fontSeq = 0;
window.addEventListener('message', async (e) => {
  if (e.source !== parent || !e.data || typeof e.data.type !== 'string' || !handlers[e.data.type]) return;
  if (e.origin !== HOME) return;                                       // 别的网站嵌了这个页面也指挥不动它
  const type = e.data.type;
  if (type === 'export') { const run = busy.then(() => handlers.export(e.data)); busy = run.catch(() => {}); return; }
  if (CHANGES.has(type)) { const run = busy.then(() => handlers[type](e.data)); busy = run.catch(() => {}); run.catch((err) => post({ type: 'fatal', message: String(err && err.message || err) })); return; }
  try { await handlers[e.data.type](e.data); } catch (err) { post({ type: 'fatal', message: String(err && err.message || err) }); }
});

requestAnimationFrame(loop);
window.__axoReady = true;                                     // sandbox-boot.js 之后不再把运行时错误当成启动失败
post({ type: 'ready', catalog: catalog(), perf: { ...detectPerf(), quality: Q } });
