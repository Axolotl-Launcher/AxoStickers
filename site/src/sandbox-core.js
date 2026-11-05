import { W, Scene, builtinRegistry, renderer, loadFont, exportGif } from './engine/index.js';
import { registerFont, hasFont } from './engine/draw.js';
import { eachFrame } from './engine/gif.js';
import { compile, sourceFor, resolveParams } from './engine/components.js';
import { makeCanvas, canvasBytes } from './engine/core.js';
import { zipStore } from './engine/zip.js';
import { BUILTIN_MODEL } from './engine/core.js';
import { loadModel } from './engine/model.js';
import { lockEval } from './engine/loopguard.js';
import { quality } from './perf.js';


// 沙盒里干活的那一半：编译组件、拼场景、播放、导出。不管自己在哪个线程：
// 一般跑在沙盒页面开的 Worker 里（不占编辑器界面所在的线程），Worker 跑不起来时直接在沙盒页面里跑（sandbox.js 决定）。
// env：post(消息, 可转移对象) 发回沙盒页面；canvas 预览画布（OffscreenCanvas 或页面上的 canvas）；choice 画质；perf 设备档位（页面那边测好的）；
//      fontFaces 表情字体的切片清单（按 unicode-range 切的 woff2）；recordVideo(帧) 录视频（要 DOM，总在沙盒页面那边）
const FONTS = globalThis.document?.fonts || globalThis.fonts;
const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame.bind(globalThis) : (f) => setTimeout(() => f(performance.now()), 16);

// "U+0020-007E, U+3000" -> [[0x20, 0x7e], [0x3000, 0x3000]]
function parseRanges(r = '') {
  return String(r).split(',').map((x) => /U\+([0-9a-f?]+)(?:-([0-9a-f]+))?/i.exec(x.trim())).filter(Boolean)
    .map(([, a, b]) => (a.includes('?') ? [parseInt(a.replace(/\?/g, '0'), 16), parseInt(a.replace(/\?/g, 'f'), 16)] : [parseInt(a, 16), parseInt(b || a, 16)]));
}

export function startCore(env) {
  lockEval();                                                // eval / Function 造出来的代码也要插循环保险
  // CSP 的 connect-src 管不到 WebRTC：组件代码能借 STUN 把数据带出去。用户代码跑之前把这些构造函数拿掉（WebSocket 之类 CSP 已经拦了，一起拿掉更干脆）；
  // Worker 也拿掉：组件代码再开 Worker 就躲开了循环保险
  for (const k of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel', 'RTCSessionDescription', 'RTCIceCandidate', 'WebTransport', 'WebSocket', 'EventSource', 'Worker', 'SharedWorker']) {
    try { Object.defineProperty(globalThis, k, { value: undefined, writable: false, configurable: false }); } catch { /* 拿不掉的就算了：CSP 还挡着大部分 */ }
  }
  // 表情字体（按 unicode-range 切好的一百多个 woff2）：画字之前只下这些字所在的切片。
  // 能按网址下（在沙盒页面里跑，或者 CI 出图时不是不透明来源）：每个切片注册成一个还没下载的 FontFace，loadFont(字) 会自己挑着下；
  // 在不透明来源的 Worker 里：按网址会被 CSP 拦，要用的切片请编辑器页面下好、把字节递进来（env.fetchFont）
  const slices = (env.fontFaces || []).map((f) => ({ ...f, ranges: parseRanges(f.range), face: null }));
  const desc = (f) => ({ weight: f.weight || 'normal', ...(f.range ? { unicodeRange: f.range } : {}), display: 'swap' });
  if (!env.fetchFont) for (const f of slices) { try { FONTS?.add(f.face = new FontFace(f.family, `url("${f.url}") format("woff2")`, desc(f))); } catch { /* 这个切片坏了就用系统字体 */ } }
  // 这些字所在的切片都下好、能用了没有：返回没下下来的那些字（FontFaceSet.check 查不出来：没注册的切片它当成「不用下」）
  async function axoGlyphs(text) {
    const cps = [...new Set([...text].map((c) => c.codePointAt(0)))], covers = (f, cp) => f.ranges.some(([a, b]) => cp >= a && cp <= b);
    const need = slices.filter((f) => cps.some((cp) => covers(f, cp)));
    await Promise.all(need.map(async (f) => {
      try {
        if (!f.face) { const face = new FontFace(f.family, await env.fetchFont(f.url), desc(f)); await face.load(); FONTS.add(face); f.face = face; }   // Worker 里：字节由编辑器页面递进来
        else if (f.face.status !== 'loaded') await f.face.load();
      } catch { if (env.fetchFont) f.face = null; }               // 没下下来：下次改字再试
    }));
    const bad = need.filter((f) => f.face?.status !== 'loaded');
    // failed：切片没下下来的字；absent：Axo 黑体里本来就没有的字（比如 emoji，没有哪个切片的 unicode-range 写了它）。两种画出来都会是系统字体
    return { failed: String.fromCodePoint(...cps.filter((cp) => bad.some((f) => covers(f, cp)))),
      absent: slices.length ? String.fromCodePoint(...cps.filter((cp) => !slices.some((f) => covers(f, cp)))) : '' };
  }

  const reg = builtinRegistry();
  const builtins = new Map(reg.items);                         // 改过的内置组件可以恢复原样
  // 画质按设备档位（sandbox.html?q=auto|smooth|sharp，编辑器舞台上能切）：没有显卡加速时三维部分少画 3/4 的像素，缓存的帧也小一些
  let Q = quality(env.choice || 'auto', env.perf);
  const R = renderer({ ss: Q.ss, power: Q.power });
  const canvas = env.canvas, ctx = canvas.getContext('2d');
  let scene = null, project = null, playing = true, speed = 1, t0 = performance.now(), tHold = 0, lastFrame = -1, onion = false;
  let visible = true, exporting = false;                       // 舞台看不见 / 正在导出：预览不画
  // 预览上正在拖 / 捏 / 滚轮的那个东西（编辑器还没写进工程）：{ g 第几次手势, kind 'model' | 'text', id 文字图层 id, x, y, scale, rot }。
  // 直接改正在播的场景（不重建：模型的几何、字的精灵都照旧用），按屏幕刷新率重画；每次重建场景也先叠上它，免得手势中途到的旧工程把它拽回去
  let live = null, trace = false, drawnSeq = -1;                 // trace：每画出一个手势位置报一次 drawn（量跟手程度用）

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

  const post = env.post;

  function catalog() {
    const out = [];
    for (const e of reg.items.values()) {
      const d = reg.get(e.def.type, e.def.id);
      const meta = { type: d.type, id: d.id, name: String(d.name || d.id), origin: e.origin, base: d.base || null, entrance: !!d.entrance, holdsItself: !!d.holdsItself, offscreen: !!d.offscreen, hasCode: !!e.source };
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

  // 工程里每种字体用到的字：只下这些字所在的切片，等它们能用了再画（第一帧、导出都不会先用系统字体顶着）。返回没加载上的字
  // 返回问题说明（空 = 都能用表情字体画）
  async function glyphs(p) {
    const texts = p.layers.filter((l) => l.type === 'text' && !l.hidden), failed = [], absent = [];
    // 组件自己用表情字体画的字（截图框的尺寸、「✓ 已发送」）：def.glyphs 写着会用到的字，再加上它的文字参数
    const own = p.layers.filter((l) => l.type !== 'text' && !l.hidden).map((l) => {
      const d = reg.get(l.type, l.component);
      if (!d || typeof d.glyphs !== 'string') return '';
      const v = resolveParams(d, l.params || {});
      return d.glyphs + Object.entries(d.params || {}).filter(([, sp]) => sp.type === 'text').map(([k]) => String(v[k] ?? '')).join('');
    }).join('');
    for (const f of new Set([...texts.map((l) => l.font || 'axo'), ...(own ? ['axo'] : [])])) {
      const t = (texts.filter((l) => (l.font || 'axo') === f).map((l) => l.text).join('') + (f === 'axo' ? own : '')).replace(/[/\s]/g, '');
      const font = hasFont(f) ? f : 'axo';
      if (t && font === 'axo') { const g = await axoGlyphs(t); if (g.failed) failed.push(g.failed); if (g.absent) absent.push(g.absent); }
      if (t && !await loadFont(t, font)) failed.push(t);
    }
    const cut = (a) => [...new Set([...a.join('')])].slice(0, 12).join('');
    return [failed.length ? `表情字体没下载下来（「${cut(failed)}」，网络好了改一下字就会重新下载）` : '',
      absent.length ? `Axo 黑体里没有「${cut(absent)}」（要用的话在「字体」里换成系统字体）` : ''].filter(Boolean).join('；');
  }
  function applyLive(p, s) {
    if (!live) return;
    const v = { x: live.x, y: live.y, scale: live.scale };
    if (live.kind === 'model') {
      const m = live.rot === undefined ? v : { ...v, rot: live.rot };
      if (p) p.model = { ...p.model, ...m };
      if (s) Object.assign(s.P.model, m);
    } else {
      const l = p?.layers?.find((x) => x.id === live.id && x.type === 'text');
      if (l) Object.assign(l, v);
      s?.moveText(live.id, v);
    }
  }
  let buildGen = 0;
  async function build() {
    if (!project) return;
    const p = project, gen = ++buildGen;                       // 这次建的是哪一份：等字体的时候又来了新工程，这次就作废（不把旧工程的缺字说明挂到新场景上）
    const missing = await glyphs(p);
    if (gen !== buildGen) return;
    useModel();
    applyLive(p, null);                                         // 手势还没完：这份工程可能是手势开始前发的，先叠上手势的位置
    scene = new Scene(p, reg, R);
    if (missing) scene.fail('font', 'AxoSans', new Error(`${missing}：这些字画出来是系统字体，导出不了`));
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
    raf(loop);
    if (!scene || !visible || exporting) return;
    const t = currentT(now), f = Math.min(scene.N - 1, Math.floor(t * scene.FPS + 1e-6));
    if (f === lastFrame && !scene.dirty) return;               // 和 GIF 一样一帧一帧地换：帧没变就不重画（60 Hz 的屏幕上省掉 3/4）
    scene.dirty = false;
    const tf = playing ? f / scene.FPS : t, aligned = !live && Math.abs(tf * scene.FPS - f) < 1e-6;   // 动画照旧按 15 fps 一格一格走；手势进行中每来一个新位置就重画，不用也不存缓存的帧
    if (onion && !playing) {                                   // 洋葱皮：前一帧半透明垫在下面
      scene.frame(ctx, ((f - 1 + scene.N) % scene.N) / scene.FPS);
      const prev = makeCanvas(W, W); prev.getContext('2d').drawImage(canvas, 0, 0);
      scene.frame(ctx, tf);
      ctx.save(); ctx.globalAlpha = 0.35; ctx.drawImage(prev, 0, 0); ctx.restore();
    } else if (!(aligned && drawCached(f))) { scene.frame(ctx, tf); if (aligned) remember(f); }
    if (f !== lastFrame) { lastFrame = f; post({ type: 'time', t, frame: f, playing }); }
    if (trace && live && live.seq !== drawnSeq) { drawnSeq = live.seq; post({ type: 'drawn', seq: live.seq, t: live.t, x: live.x, y: live.y, scale: live.scale }); }
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
    // 预览上的手势：每个指针帧一条，马上改到场景上（不排队等重建），下一个动画帧画出来
    live({ g, kind, id, x, y, scale, rot, seq, t }) {
      if (kind !== 'model' && !(kind === 'text' && typeof id === 'string')) return;
      const fin = (v, d) => (Number.isFinite(v) ? v : d);
      if (live?.g !== g) { live = { g, kind, id }; resetCache(); }  // 新的一次手势：缓存的帧是挪之前的样子
      Object.assign(live, { x: fin(x, 0), y: fin(y, 0), scale: fin(scale, 1), rot: Number.isFinite(rot) ? rot : undefined, seq, t });
      applyLive(project, scene);
      if (scene) scene.dirty = true;
    },
    // 手势完了：编辑器接着就发写好的工程（和最后一个位置一样）。排在之前的重建后面，那些建出来的场景也叠着这次手势的位置
    'live-end'({ g }) { if (live?.g === g) live = null; },
    transport({ playing: pl, speed: sp, t, onion: on, visible: vis, trace: tr }) {
      if (tr !== undefined) trace = !!tr;
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
    async export(msg) {
      const { req, format = 'gif', size, colors, maxKb, loops = 3 } = msg;
      if (!scene) { post({ type: 'export-error', req, message: '预览还没准备好，等一下再导出' }); return; }
      const missing = await glyphs(msg.project || project);     // 导出前再确认一遍字都能用表情字体画（没下下来就不导，免得导出一张系统字体的）
      if (missing) { post({ type: 'export-error', req, message: `${missing}：这时候导出会变成系统字体，先改好再导出` }); return; }
      if (!['gif', 'png-zip', 'png', 'video'].includes(format)) { post({ type: 'export-error', req, message: `不支持的格式 ${format}（能用 gif / png-zip / png / video）` }); return; }
      exporting = true; R.setQuality(2);                        // 导出总是全画质；导出期间预览先不画，省出来给导出
      try {
        const progress = (p) => post({ type: 'progress', req, p });
        const s = new Scene(msg.project || project, reg, R);    // 独立一份，不打断预览（「我的工程」存小图时给的是要存的那一份快照）
        let bytes, mime = 'image/gif';
        if (format === 'gif') bytes = await exportGif(s, { size, colors, maxKb }, progress);
        else if (format === 'png-zip') {                         // 按时间顺序从第一帧开始，每帧马上压成 PNG（不把整帧像素都留在内存里）
          const files = [];
          await eachFrame(s, size || s.P.size, async (_, i, c) => { files.push({ name: `frame_${String(i + 1).padStart(3, '0')}.png`, data: await canvasBytes(c) }); }, { fromCover: false, onProgress: progress });
          bytes = zipStore(files); mime = 'application/zip';
        } else if (format === 'video') {                         // 视频（发朋友圈、短视频平台用）：这边把一圈的帧画好，录像交给沙盒页面（要 DOM 的 MediaRecorder）
          const frames = [];
          try {
            const big = makeCanvas(W, W), bg = big.getContext('2d');
            for (let i = 0; i < s.N; i++) { s.frame(bg, i / s.FPS); frames.push(await createImageBitmap(big)); progress(0.4 * (i + 1) / s.N); }
            ({ bytes, mime } = await env.recordVideo({ frames, fps: s.FPS, size: size || s.P.size, loops, req }));
          } finally { for (const b of frames) b.close?.(); }
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
      Q = quality(choice || 'auto', env.perf); R.setQuality(Q.ss); resetCache();
      if (scene) scene.dirty = true;
      post({ type: 'perf', perf: { ...env.perf, quality: Q, thread: env.thread } });
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
      post({ type: 'filmstrip-done', req, bitmaps: out, N: s.N }, out);
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
        await face.load(); FONTS.add(face);
        registerFont(id, `"${family}"`);
        post({ type: 'font-done', req, ok: true, id });
        if (project?.layers?.some((l) => l.font === id)) await build();
      } catch (e) { post({ type: 'font-done', req, ok: false, id, message: e?.message || '字体文件读不出来' }); }
    },
    ping({ n }) { post({ type: 'pong', n }); },
  };

  // 组件在定时器、await 之后抛的错（包括循环保险）不经过 scene.guard：也记成组件错误，出图时就不会悄悄发布
  const asyncFail = (err) => {
    if (!scene) return;
    scene.fail('async', '定时器或异步代码', err instanceof Error ? err : new Error(String(err)));
    post({ type: 'errors', errors: errorsOf(scene) }); reported = scene.errors.size;
  };
  self.addEventListener('error', (e) => asyncFail(e.error || e.message));
  self.addEventListener('unhandledrejection', (e) => asyncFail(e.reason));

  // 导出要好几秒：期间改工程 / 换组件 / 换模型的消息先排队，等导出完再处理，免得一张 GIF 里混着两个版本
  let busy = Promise.resolve();
  const CHANGES = new Set(['project', 'components', 'remove', 'model', 'font', 'quality', 'live-end']);
  let fontSeq = 0;
  async function handle(data) {                                // 消息已经由沙盒页面查过来源（sandbox.js）
    if (!data || typeof data.type !== 'string' || !handlers[data.type]) return;
    const type = data.type;
    if (type === 'export') { const run = busy.then(() => handlers.export(data)); busy = run.catch(() => {}); return; }
    if (CHANGES.has(type)) { const run = busy.then(() => handlers[type](data)); busy = run.catch(() => {}); run.catch((err) => post({ type: 'fatal', message: String(err && err.message || err) })); return; }
    try { await handlers[type](data); } catch (err) { post({ type: 'fatal', message: String(err && err.message || err) }); }
  }

  raf(loop);
  post({ type: 'ready', catalog: catalog(), perf: { ...env.perf, quality: Q, thread: env.thread } });   // thread：引擎跑在 worker 还是 page（沙盒页面里）
  return { handle };
}
