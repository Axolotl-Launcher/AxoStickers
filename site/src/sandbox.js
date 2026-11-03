// 沙盒页面（<iframe sandbox="allow-scripts">）：查来源、只听本站页面的话，把活交给引擎（sandbox-core.js）。
// 引擎一般放进这个页面开的 Worker 里跑：沙盒 iframe 在很多浏览器（尤其手机上）和编辑器界面是同一个线程，
// 三维渲染、拼场景、GIF 编码放在这里跑会让界面一卡一卡的。Worker 跑不起来（没有 OffscreenCanvas、Worker 里没有 WebGL、启动失败）就在这个页面里直接跑同一份引擎。
// 录视频要 MediaRecorder（只有页面上有），总在这边录。协议见 studio/runner.js。
// Worker 的代码整个打包进这个文件、用 blob: 开（?worker&inline）：不透明来源开的 blob: Worker 里，CSP 的 'self' 对不上本站，按网址 import 会被拦。
// 开发服务器上不打包，Worker 起不来，自动改成在页面里跑
import SandboxWorker from './sandbox-worker.js?worker&inline';
import fontsCss from './gen/fonts.css?inline';
import { detectPerf } from './perf.js';

// 只在不透明来源里干活：别的网站要是不加 sandbox 直接嵌这个页面，组件代码就会以本站的身份运行，能读本站的存储。
// 本机开发 / CI 出图（localhost、127.0.0.1）例外，但只认同源发来的消息。
const OPAQUE = self.origin === 'null';
const HOME = new URL(location.href).origin;                    // 本站（沙盒页面地址的来源）：只听本站页面发来的消息
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
if (!OPAQUE && !LOCAL) {
  document.body.textContent = '这个页面只能在创意工坊编辑器的沙盒里打开。';
  throw new Error('sandbox.html must run in an opaque-origin sandboxed iframe');
}

const params = new URLSearchParams(location.search), choice = params.get('q') || 'auto', perf = detectPerf();
const REQUESTS = new Set(['components', 'source', 'remove', 'project', 'transport', 'export', 'quality', 'filmstrip', 'thumbs', 'model', 'font', 'font-bytes', 'ping']);
const toParent = (msg, transfer) => parent.postMessage(msg, '*', transfer || []);
const movable = (m) => [...(m?.bytes instanceof ArrayBuffer ? [m.bytes] : []), ...(Array.isArray(m?.bitmaps) ? m.bitmaps : [])];   // 消息里能转手的大块数据（不复制）

// 表情字体的切片清单：fonts.css 里每一条 @font-face（按 unicode-range 切好的 woff2）。引擎把它们注册成 FontFace，画字时只下用到的那几个
const fontFaces = [...fontsCss.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, b]) => ({
  family: /font-family:\s*['"]?([^;'"]+)/.exec(b)?.[1]?.trim(), weight: /font-weight:\s*([^;]+)/.exec(b)?.[1]?.trim(),
  url: (() => { const u = /url\(\s*['"]?([^'")]+)/.exec(b)?.[1]; return u ? new URL(u, location.href).href : null; })(),
  range: /unicode-range:\s*([^;]+)/.exec(b)?.[1]?.trim(),
})).filter((f) => f.family && f.url);

// 录视频：把一圈的帧按帧率一张张贴到画布上让 MediaRecorder 录下来，循环 loops 遍。视频没有透明：垫白底。
// 按真实时间走（48 帧 15 fps 一遍 3.2 秒），标签页切到后台会被浏览器放慢
async function recordVideo({ frames, fps, size, loops, req }) {
  let stream = null, rec = null;
  try {
    if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) throw new Error('这个浏览器录不了视频，导出 GIF 吧');
    const type = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
    if (!type) throw new Error('这个浏览器录不了视频，导出 GIF 吧');
    const n = Math.max(1, Math.min(10, Math.round(loops) || 3)), side = Math.max(64, Math.min(1080, Math.round(size / 2) * 2));   // 视频的边长要是偶数
    const c = document.createElement('canvas'); c.width = c.height = side;
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    const paint = (b) => { g.fillStyle = '#fff'; g.fillRect(0, 0, side, side); g.drawImage(b, 0, 0, side, side); };
    paint(frames[0]);
    stream = c.captureStream(fps); rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 5e6 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise((res) => { rec.onstop = res; });
    rec.start();
    const dt = 1000 / fps, t0 = performance.now(), total = frames.length * n;
    for (let k = 0; k < total; k++) {
      const wait = t0 + k * dt - performance.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      paint(frames[k % frames.length]);
      toParent({ type: 'progress', req, p: 0.4 + 0.6 * (k + 1) / total });
    }
    await new Promise((r) => setTimeout(r, dt));
    rec.stop(); await stopped;
    const mime = type.split(';')[0];
    return { bytes: new Uint8Array(await new Blob(chunks, { type: mime }).arrayBuffer()), mime };
  } finally {                                                   // 中途出错也要把位图、录像轨道放掉
    if (rec && rec.state !== 'inactive') try { rec.stop(); } catch { /* 已经停了 */ }
    for (const b of frames) b.close?.();
    stream?.getTracks().forEach((t) => t.stop());
  }
}

// 引擎发来的消息：转给编辑器页面；录视频的请求在这边做
let toCore = null, worker = null;
function fromCore(m, transfer) {
  if (m?.type === 'record') {
    recordVideo(m).then(({ bytes, mime }) => worker.postMessage({ type: 'recorded', id: m.id, bytes: bytes.buffer, mime }, [bytes.buffer]),
      (e) => worker.postMessage({ type: 'recorded', id: m.id, error: String(e?.message || e) }));
    return;
  }
  if (m?.type === 'ready') window.__axoReady = true;          // sandbox-boot.js 之后不再把运行时错误当成启动失败
  toParent(m, transfer || movable(m));
}

let cspBlocked = '';                                              // Worker 没起来时说清楚是不是被 CSP 拦了
document.addEventListener('securitypolicyviolation', (e) => { cspBlocked = `${e.violatedDirective} 拦下了 ${e.blockedURI}`; });
// 先试 Worker：canvas 交给 Worker 画（交出去以后这边就不能再画了，失败时换一块新的 canvas）
function startWorker(canvas) {
  return new Promise((resolve, reject) => {
    let w, started = false;
    const fail = (why) => { if (started) return; clearTimeout(timer); try { w?.terminate(); } catch { /* 已经没了 */ } reject(new Error(why)); };   // 起来以后组件代码的报错由引擎自己记，不关掉 Worker
    const timer = setTimeout(() => fail('Worker 启动超时'), 20000);
    try {
      w = new SandboxWorker();
      const off = canvas.transferControlToOffscreen();
      w.addEventListener('error', (e) => fail(`Worker 出错：${e.message || cspBlocked || '加载失败'}`));
      w.onmessage = (e) => {
        const m = e.data;
        if (m?.type === 'core-failed') { fail(m.message); return; }
        if (m?.type === 'ready' && !started) { started = true; clearTimeout(timer); resolve(w); }
        fromCore(m, movable(m));
      };
      w.postMessage({ type: 'init', canvas: off, choice, perf, fontFaces }, [off]);
    } catch (e) { fail(String(e?.message || e)); }
  });
}
async function startInline() {
  const old = document.getElementById('c'), canvas = old.cloneNode();
  old.replaceWith(canvas);                                       // 交给过 Worker 的 canvas 这边用不了了
  const { startCore } = await import('./sandbox-core.js');
  const core = startCore({ post: fromCore, canvas, choice, perf, fontFaces, recordVideo, thread: 'page' });
  return (m) => core.handle(m);
}

const pending = [];                                             // 引擎还没起来时收到的消息
window.addEventListener('message', (e) => {
  if (e.source !== parent || !e.data || typeof e.data.type !== 'string' || !REQUESTS.has(e.data.type)) return;
  if (e.origin !== HOME) return;                                // 别的网站嵌了这个页面也指挥不动它
  if (toCore) toCore(e.data); else pending.push(e.data);
});

const canvas = document.getElementById('c');
const canWorker = typeof Worker === 'function' && typeof OffscreenCanvas === 'function' && typeof canvas.transferControlToOffscreen === 'function' && params.get('worker') !== '0';
if (canWorker) {
  try {
    worker = await startWorker(canvas);
    toCore = (m) => worker.postMessage(m, movable(m));
  } catch (e) { console.warn('预览改在页面里跑：', e.message); worker = null; }
}
if (!toCore) toCore = await startInline();
// 用完就封上：之后谁也不能再开 Worker（组件代码开 Worker 就躲开了循环保险）
document.head.append(Object.assign(document.createElement('meta'), { httpEquiv: 'Content-Security-Policy', content: "worker-src 'none'" }));
for (const m of pending.splice(0)) toCore(m);
