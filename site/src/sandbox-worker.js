// 沙盒页面开的 Worker：引擎（sandbox-core.js）在这里跑，组件代码、三维渲染、GIF 编码都不占编辑器界面所在的线程。
// 这个 Worker 由沙盒页面用 blob: 网址开出来，和沙盒页面一样是不透明来源、继承它的 CSP（不能联网）；它只和沙盒页面说话。
import { startCore } from './sandbox-core.js';

let core = null, seq = 0;
const calls = new Map();                                        // 录视频：帧交给沙盒页面录（MediaRecorder 要 DOM）；字体切片：请编辑器页面下好递进来。等回音
const ask = (msg, transfer = []) => new Promise((res, rej) => { const id = ++seq; calls.set(id, { res, rej }); self.postMessage({ ...msg, id }, transfer); });

self.onmessage = (e) => {
  const m = e.data;
  if (m?.type === 'init') {
    try {
      core = startCore({
        post: (msg, transfer) => self.postMessage(msg, transfer || []),
        canvas: m.canvas, choice: m.choice, perf: m.perf, fontFaces: m.fontFaces, thread: 'worker',
        recordVideo: (job) => ask({ type: 'record', ...job }, job.frames).then((m) => ({ bytes: new Uint8Array(m.bytes), mime: m.mime })),
        // 不透明来源的 blob: Worker 按网址下不了字体（CSP 的 'self' 对不上本站）：切片的字节由编辑器页面下好递进来（FontFace 吃字节不走 CSP）
        fetchFont: self.origin === 'null' ? (url) => ask({ type: 'font-fetch', url }).then((m) => m.bytes) : null,
      });
    } catch (err) { self.postMessage({ type: 'core-failed', message: String(err?.message || err) }); }   // 比如 Worker 里拿不到 WebGL：沙盒页面会改成自己跑
    return;
  }
  if (m?.type === 'recorded' || m?.type === 'font-bytes') {
    const c = calls.get(m.id); calls.delete(m.id);
    if (m.error) c?.rej(new Error(m.error)); else c?.res(m);
    return;
  }
  core?.handle(m);
};
