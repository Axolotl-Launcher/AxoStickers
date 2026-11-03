// 性能基准：打开编辑器下了多少字体 / 脚本，慢 CPU 上预览几帧、主线程长任务、导出多久、导出时界面卡多久。
//   node tools/perf.mjs <网站目录> [--base /AxoStickers/] [--rate 6] [--sw] [--json out.json]
// 网站目录要是拼好的网站（tools/assemble.py 的 _site，或者 dist + 图鉴数据）。--sw：用 SwiftShader 软件渲染（没有显卡加速的低档设备）。
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';

const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.resolve(argv[0]), BASE = opt('--base', '/'), RATE = +opt('--rate', 6), SW = argv.includes('--sw');
// --page：引擎不进 Worker（#/editor?worker=0）。Chrome 不给 Worker 降速（CDP：Operation is only supported for pages），
// 要和改之前一样在慢 CPU 上量引擎本身（导出用时、预览帧率），就让它在沙盒页面里跑
const EDITOR = argv.includes('--page') ? '#/editor?worker=0' : '#/editor';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.glb': 'model/gltf-binary', '.mp4': 'video/mp4', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {                // 和 GitHub Pages 一样发 ACAO: *（沙盒是不透明来源，取模块要 CORS）；只听 127.0.0.1
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (!url.startsWith(BASE)) { res.writeHead(404); res.end(); return; }
  url = '/' + url.slice(BASE.length);
  const file = path.resolve(ROOT, '.' + (url.endsWith('/') ? url + 'index.html' : url)), rel = path.relative(ROOT, file);
  const inside = rel && !rel.startsWith('..') && !path.isAbsolute(rel);   // 只给 ROOT 里面的文件（startsWith 会放过同名前缀的兄弟目录，比如 site 和 site-old）
  if (!inside || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404, { 'Access-Control-Allow-Origin': '*' }); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(+process.env.PERF_PORT || 0, '127.0.0.1', r));
const site = `http://127.0.0.1:${server.address().port}${BASE}`;
const browser = await chromium.launch({ channel: process.env.PERF_CHANNEL || undefined, args: SW ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'] : ['--ignore-gpu-blocklist'] });
const out = {};

// 本机浏览器连 localhost 偶尔被拒：请求交给 Playwright 去拿，失败重试（字节数照样按响应体算）
async function context(o) {
  const ctx = await browser.newContext(o);
  await ctx.route(/^http:\/\/127\.0\.0\.1:\d+\//, async (route) => { for (let i = 0; i < 6; i++) { try { return await route.fulfill({ response: await route.fetch() }); } catch { await new Promise((r) => setTimeout(r, 150)); } } return route.abort(); });
  return ctx;
}
const kind = (u, ct = '') => (/\.woff2?(\?|$)/.test(u) || ct.includes('font') ? 'font' : /\.js(\?|$)/.test(u) ? 'js' : /\.css(\?|$)/.test(u) ? 'css' : /\.(png|webp|gif|jpe?g|svg)(\?|$)/.test(u) ? 'img' : /\.mp4/.test(u) ? 'video' : 'other');
async function bytesOf(hash, ready) {                          // 冷启动打开一页：按类型加起来的响应体字节数（主页面 + 沙盒）
  const ctx = await context({ viewport: { width: 1440, height: 900 } }), pg = await ctx.newPage(), sum = {}, fonts = new Map();
  pg.on('response', async (r) => {
    try {
      const b = (await r.body()).length, k = kind(r.url(), r.headers()['content-type']), name = r.url().split('/').pop();
      if (k === 'font' && fonts.has(name)) return;               // 同一个切片（编辑器页面替沙盒下的那一份和浏览器缓存里的）只算一次
      sum[k] = (sum[k] || 0) + b; if (k === 'font') fonts.set(name, b);
    } catch { /* 重定向之类没有响应体 */ }
  });
  await pg.goto(site + hash);
  await pg.waitForFunction(ready, null, { timeout: 60000 });
  await pg.waitForTimeout(3000);
  await ctx.close();
  return { kb: Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, Math.round(v / 1024)])), fontFiles: fonts.size, fontNames: [...fonts].map(([n, v]) => `${n.replace(/-[\w-]+\.woff2$/, '')}:${Math.round(v / 1024)}`).sort() };
}
out.editorOpen = await bytesOf('#/editor', () => window.axo?.state?.().ready && document.querySelector('.studio')?.dataset.state === 'ready');
out.galleryOpen = await bytesOf('', () => document.querySelectorAll('#grid .card').length > 20);
console.log('bytes', JSON.stringify(out));

// 慢设备：手机视口 + CPU 降速（沙盒在单独进程里的话也一起降）
async function slow() {
  const ctx = await context({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  await pg.addInitScript(() => {
    window.__perf = { time: 0, long: [] };
    addEventListener('message', (e) => { if (e.data?.type === 'time') window.__perf.time++; });
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.long.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch { /* 没有 longtask */ }
  });
  const throttle = async (target) => { const s = await ctx.newCDPSession(target); await s.send('Emulation.setCPUThrottlingRate', { rate: RATE }); };
  await throttle(pg);
  await pg.goto(site + EDITOR);
  await pg.waitForFunction(() => window.axo?.ready, null, { timeout: 120000 });
  await pg.evaluate(() => window.axo.ready());
  let oopif = false;
  for (const f of pg.frames()) if (f !== pg.mainFrame()) { try { await throttle(f); oopif = true; } catch { /* 和主页面同一个进程：已经一起降速了 */ } }
  // 沙盒里的 Worker（引擎在那儿跑）也要降速：页面上的降速管不到 Worker。用浏览器级的 CDP 连上每个 worker 目标
  const bs = await browser.newBrowserCDPSession();
  const { targetInfos } = await bs.send('Target.getTargets');
  let workers = 0, seq = 1;
  for (const t of targetInfos.filter((x) => x.type === 'worker')) {
    const { sessionId } = await bs.send('Target.attachToTarget', { targetId: t.targetId, flatten: false });
    const id = seq++, reply = new Promise((res) => bs.on('Target.receivedMessageFromTarget', (m) => { if (m.sessionId === sessionId && JSON.parse(m.message).id === id) res(JSON.parse(m.message)); }));
    await bs.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method: 'Emulation.setCPUThrottlingRate', params: { rate: RATE } }) });
    const r = await Promise.race([reply, new Promise((res) => setTimeout(() => res({ error: 'timeout' }), 3000))]);
    if (!r.error) workers++; else console.log('worker throttle failed:', JSON.stringify(r.error));
  }
  return { ctx, pg, oopif, workers };
}
const { pg, oopif, workers } = await slow();
const r = { cpuThrottle: RATE, renderer: SW ? 'swiftshader' : 'gpu', sandboxOutOfProcess: oopif, workersThrottled: workers };
r.perf = await pg.evaluate(() => window.axo.state().perf);
const windowStats = (t0, t1) => pg.evaluate(([a, b]) => { const L = window.__perf.long.filter(([s]) => s >= a && s < b); return { longTasks: L.length, longMs: Math.round(L.reduce((s, [, d]) => s + d, 0)), worstMs: Math.round(Math.max(0, ...L.map(([, d]) => d))) }; }, [t0, t1]);
// 播放：6 秒里预览换了几帧（应该是 15 fps）、主线程长任务
await pg.waitForTimeout(2000);
let t0 = await pg.evaluate(() => performance.now()), f0 = await pg.evaluate(() => window.__perf.time);
await pg.waitForTimeout(6000);
let t1 = await pg.evaluate(() => performance.now()), f1 = await pg.evaluate(() => window.__perf.time);
r.playing = { fps: +((f1 - f0) / ((t1 - t0) / 1000)).toFixed(1), ...(await windowStats(t0, t1)) };
// 编辑：拖属性面板的滑块（选中文字，改上下位置），4 秒 40 次
// （不点手机上的「属性」页签：那会把预览滚出屏幕，预览本来就会停。滑块在 DOM 里，直接发 input 事件）
await pg.evaluate(() => { const t = window.axo.layers.list().find((l) => l.type === 'text'); window.axo.layers.select(t.id); window.axo.dock('timeline'); scrollTo(0, 0); });
await pg.waitForTimeout(800);
t0 = await pg.evaluate(() => performance.now()); f0 = await pg.evaluate(() => window.__perf.time);
await pg.evaluate(async () => {
  const r = document.querySelector('[data-ax="field:y:range"]');
  for (let i = 0; i < 40; i++) { r.value = String(80 + (i % 20) * 6); r.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((s) => setTimeout(s, 100)); }
});
t1 = await pg.evaluate(() => performance.now()); f1 = await pg.evaluate(() => window.__perf.time);
r.editing = { fps: +((f1 - f0) / ((t1 - t0) / 1000)).toFixed(1), ...(await windowStats(t0, t1)) };
// 导出 400px GIF：用时，和这期间编辑器界面最长卡了多久（主页面 setTimeout 的最大延迟）
await pg.waitForTimeout(1500);
r.export = await pg.evaluate(async () => {
  let lag = 0, last = performance.now(), on = true;
  const beat = () => { const n = performance.now(); lag = Math.max(lag, n - last - 50); last = n; if (on) setTimeout(beat, 50); };
  setTimeout(beat, 50);
  const t = performance.now(), g = await window.axo.export({ format: 'gif', size: 400 });
  on = false;
  return { gifMs: Math.round(performance.now() - t), kb: g.kb, uiWorstLagMs: Math.round(lag) };
});
out.slow = r;
console.log(JSON.stringify(out, null, 1));
if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(out, null, 1));
await browser.close(); server.close();
