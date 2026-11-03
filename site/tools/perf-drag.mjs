// 拖动基准：在编辑器预览上拖模型、拖文字、滚轮缩放，量「跟手」的程度。
//   node tools/perf-drag.mjs <拼好的网站目录> [--base /AxoStickers/] [--phone --rate 6] [--page] [--json out.json]
// 量的是：拖动期间预览上的位置每秒更新几次、从输入到画出来多久（沙盒报 drawn 时带回输入的时间戳，到编辑器页面收到为止；旧版本没有这条消息，就按 scene 消息算）、
// 开始拖以后多久第一次看到变化、松手以后多久画到最后的位置、画出来的位置落后指针多少（画布像素）、
// 编辑器线程上的长任务、任务时间（CDP TaskDuration，每秒手势占多少毫秒）和动画帧间隔、松手后存进工程的位置和最后画出来的位置是不是一样。
// --phone 多量一个双指捏合（CDP 发触摸事件）；--page 让引擎在沙盒页面里跑（#/editor?worker=0），降速对引擎也有效；
// --snap 再查一遍「拽不回去」：暂停在第 0 帧，拖到一半时把拖动前的工程发给沙盒（就像一条过期的同步晚到了），
// 比较松手前、松手后的预览截图（应该一样：只有水花这种按画过的帧累积的粒子会差一点点），和拖动前的截图（应该差很多）
// （Chrome 不给 Worker 降速：--rate 只降编辑器页面和沙盒页面。Git Bash 里跑记得 MSYS_NO_PATHCONV=1，不然 --base 会被改写）
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';

const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.resolve(argv[0]), BASE = opt('--base', '/'), RATE = +opt('--rate', 1), PHONE = argv.includes('--phone'), PAGE = argv.includes('--page');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml' };
const REAL_ROOT = fs.realpathSync(ROOT);
const server = http.createServer((req, res) => {                // 和 GitHub Pages 一样发 ACAO: *（沙盒是不透明来源）；只给目录里面的文件
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (!url.startsWith(BASE)) { res.writeHead(404); res.end(); return; }
  const file = path.resolve(ROOT, '.' + ('/' + url.slice(BASE.length)).replace(/\/$/, '/index.html'));
  const ok = fs.existsSync(file) && (() => { const rel = path.relative(REAL_ROOT, fs.realpathSync(file)); return rel && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel); })();
  if (!ok || !fs.statSync(file).isFile()) { res.writeHead(404, { 'Access-Control-Allow-Origin': '*' }); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(+process.env.PERF_PORT || 0, '127.0.0.1', r));
const site = `http://127.0.0.1:${server.address().port}${BASE}`;
const browser = await chromium.launch({ channel: process.env.PERF_CHANNEL || 'msedge' });
const ctx = await browser.newContext(PHONE ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
await ctx.route(/^http:\/\/127\.0\.0\.1:\d+\//, async (route) => { for (let i = 0; i < 6; i++) { try { return await route.fulfill({ response: await route.fetch() }); } catch { await new Promise((r) => setTimeout(r, 150)); } } return route.abort(); });
const pg = await ctx.newPage();
await pg.addInitScript(() => {
  const T = () => performance.timeOrigin + performance.now();
  window.__d = { msgs: [], moves: [], long: [], raf: [] };
  const tick = (now) => { window.__d.raf.push(performance.timeOrigin + now); requestAnimationFrame(tick); }; requestAnimationFrame(tick);   // 编辑器页面的动画帧：界面卡不卡
  addEventListener('message', (e) => { const m = e.data; if (m && ['scene', 'drawn'].includes(m.type)) window.__d.msgs.push({ type: m.type, at: T(), t: m.t, seq: m.seq, x: m.x, y: m.y, scale: m.scale }); });
  addEventListener('pointerdown', (e) => { window.__d.down = [e.clientX, e.clientY]; }, true);
  addEventListener('pointermove', (e) => { if (e.buttons) window.__d.moves.push([performance.timeOrigin + e.timeStamp, e.clientX, e.clientY, e.getPredictedEvents?.().length || 0]); }, true);
  addEventListener('wheel', (e) => window.__d.moves.push([performance.timeOrigin + e.timeStamp]), true);
  try { new PerformanceObserver((l) => { for (const x of l.getEntries()) window.__d.long.push([performance.timeOrigin + x.startTime, x.duration]); }).observe({ type: 'longtask', buffered: true }); } catch { /* 没有 longtask */ }
});
const cdp = await ctx.newCDPSession(pg);
await cdp.send('Performance.enable');
const taskSecs = async () => (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'TaskDuration')?.value || 0;
if (RATE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
await pg.goto(site + (PAGE ? '#/editor?worker=0' : '#/editor'));
await pg.waitForFunction(() => window.axo?.ready, null, { timeout: 120000 });
await pg.evaluate(() => window.axo.ready());
if (RATE > 1) for (const f of pg.frames()) if (f !== pg.mainFrame()) { try { const s = await ctx.newCDPSession(f); await s.send('Emulation.setCPUThrottlingRate', { rate: RATE }); } catch { /* 和编辑器页面同一个进程 */ } }
await pg.evaluate(() => window.axo.project.set({ v: 2, name: '拖动', layers: [{ id: 'm', type: 'motion', component: 'hop' }, { id: 'f', type: 'face', component: 'happy' }, { id: 't', type: 'text', component: 'stay', text: '摸鱼' }] }));
await pg.waitForTimeout(2500);
await pg.evaluate(() => document.querySelector('.st-stage-box iframe')?.contentWindow.postMessage({ type: 'transport', trace: true }, '*'));   // 新版本：每画一帧报一次 drawn（旧版本不认这个字段）
await pg.evaluate(() => scrollTo(0, 0));

const box = await (await pg.$('.st-stage-box')).boundingBox(), k = 512 / box.width;
async function gesture(name, select, run, drags = true) {
  const pick = (p) => (select === 't' ? (({ x, y, scale }) => ({ x, y, scale }))(p.layers.find((l) => l.id === 't')) : (({ x, y, scale }) => ({ x, y, scale }))(p.model));
  await pg.evaluate((id) => window.axo.layers.select(id), select);
  await pg.waitForTimeout(800);
  const t0 = await pg.evaluate(() => { const d = window.__d; d.msgs = []; d.moves = []; d.raf = []; return performance.timeOrigin + performance.now(); });
  const before = await pg.evaluate(() => window.axo.project.get());
  const task0 = await taskSecs();
  const expect = await run();
  const taskMs = (await taskSecs() - task0) * 1000;
  const t1 = await pg.evaluate(() => performance.timeOrigin + performance.now());
  await pg.waitForTimeout(1500);
  const after = await pg.evaluate(() => window.axo.project.get());
  const d = await pg.evaluate(() => window.__d);
  const inWin = (x) => x.at >= t0 && x.at <= t1, secs = (t1 - t0) / 1000;
  const drawn = d.msgs.filter((m) => m.type === 'drawn' && inWin(m)), scenes = d.msgs.filter((m) => m.type === 'scene');
  const seen = new Map(); for (const m of drawn) if (m.seq != null && !seen.has(m.seq)) seen.set(m.seq, m);
  // 新版本：drawn 带回的输入时间戳 → 编辑器页面收到；旧版本没有 drawn：每一下输入 → 之后第一次画面有变化（scene）
  const lat = (seen.size ? [...seen.values()].filter((m) => m.t).map((m) => m.at - m.t)
    : d.moves.map(([mv]) => (d.msgs.find((m) => m.at >= mv)?.at ?? NaN) - mv).filter(Number.isFinite)).sort((a, b) => a - b);
  const lastMove = d.moves.at(-1)?.[0] ?? t1;
  const finalShown = d.msgs.find((m) => m.at >= lastMove && (m.type === 'scene' || (m.type === 'drawn' && m.seq === Math.max(...seen.keys())))) || null;
  const L = d.long.filter(([s]) => s >= t0 && s <= t1 + 1500);
  const firstMove = d.moves[0]?.[0] ?? t0, first = d.msgs.find((m) => m.at >= firstMove);
  // 画出来的位置落后指针多少：编辑器收到 drawn 的那一刻，指针（最近一下移动）对应的位置 和 画出来的位置 差几个画布像素
  const b0 = pick(before), lagPx = [];
  if (d.down && drags) for (const m of seen.values()) {
    const mv = d.moves.filter((x) => x[0] <= m.at && x[1] !== undefined).at(-1);
    if (!mv || m.x === undefined) continue;
    lagPx.push(Math.hypot(b0.x + (mv[1] - d.down[0]) * k - m.x, b0.y + (mv[2] - d.down[1]) * k - m.y));
  }
  lagPx.sort((a, b) => a - b);
  const fr = d.raf.filter((x) => x >= t0 && x <= t1), gaps = fr.slice(1).map((x, i) => x - fr[i]);
  const lastLive = drawn.filter((m) => m.x !== undefined).at(-1);
  return {
    name, seconds: +secs.toFixed(2), moves: d.moves.length,
    updatesPerSec: +((seen.size || scenes.filter(inWin).length) / secs).toFixed(1),
    sceneRebuildsDuring: scenes.filter(inWin).length,
    latencyMs: lat.length ? { mean: Math.round(lat.reduce((a, b) => a + b, 0) / lat.length), p95: Math.round(lat[Math.floor(lat.length * 0.95)]), max: Math.round(lat.at(-1)) } : null,
    firstUpdateAfterMs: first ? Math.round(first.at - firstMove) : null,
    finalShownAfterMs: finalShown ? Math.round(finalShown.at - lastMove) : null,
    lagPx: lagPx.length ? { mean: +(lagPx.reduce((a, b) => a + b, 0) / lagPx.length).toFixed(1), p95: +lagPx[Math.floor(lagPx.length * 0.95)].toFixed(1) } : null,
    predictedPerMove: d.moves.length ? +(d.moves.reduce((a, x) => a + (x[3] || 0), 0) / d.moves.length).toFixed(2) : 0,
    editorTaskMsPerSec: Math.round(taskMs / secs), editorFps: +(fr.length / secs).toFixed(1), editorMaxGapMs: gaps.length ? Math.round(Math.max(...gaps)) : null,
    longTasks: L.length, longMs: Math.round(L.reduce((a, [, x]) => a + x, 0)),
    before: pick(before), committed: pick(after), expected: expect && expect(pick(before)),
    lastLive: lastLive ? { x: lastLive.x, y: lastLive.y, scale: lastLive.scale } : null,
  };
}
const drag = async (fromX, fromY, dx, dy, n = 60) => {
  await pg.mouse.move(fromX, fromY); await pg.mouse.down();
  for (let i = 1; i <= n; i++) { await pg.mouse.move(fromX + dx * i / n, fromY + dy * i / n); await new Promise((r) => setTimeout(r, 16)); }   // 大约 60 Hz
  await pg.mouse.up();
};
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
const out = { setup: PHONE ? `phone 390x844, CPU ${RATE}x` : `desktop 1440x900, CPU ${RATE}x`, results: [] };
out.results.push(await gesture('drag model', null, async () => { await drag(cx, cy + 40, 120, -60); return (b) => ({ x: Math.round(b.x + 120 * k), y: Math.round(b.y - 60 * k) }); }));
out.results.push(await gesture('drag text', 't', async () => { await drag(cx, box.y + box.height * 0.22, -90, 70); return (b) => ({ x: Math.round(b.x - 90 * k), y: Math.round(b.y + 70 * k) }); }));
out.results.push(await gesture('wheel zoom model', null, async () => { await pg.mouse.move(cx, cy); for (let i = 0; i < 20; i++) { await pg.mouse.wheel(0, -60); await new Promise((r) => setTimeout(r, 16)); } await new Promise((r) => setTimeout(r, 700)); return null; }, false));
if (PHONE) out.results.push(await gesture('pinch model', null, async () => {   // 两根手指从相距 60 拉开到 160（CSS 像素）
  const touch = (type, d) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: d === null ? [] : [{ x: cx - d / 2, y: cy, id: 0 }, { x: cx + d / 2, y: cy, id: 1 }] });
  await touch('touchStart', 60);
  for (let i = 1; i <= 40; i++) { await touch('touchMove', 60 + 100 * i / 40); await new Promise((r) => setTimeout(r, 16)); }
  await touch('touchEnd', null);
  return null;
}, false));
if (argv.includes('--snap')) {
  await pg.evaluate(() => { window.axo.pause(); window.axo.seek(0); window.axo.layers.select(null); document.querySelector('.st-stagehint')?.style.setProperty('visibility', 'hidden'); });   // 提示条松手后会冒出来：截图时藏起来
  await pg.waitForTimeout(800);
  const frame = await pg.$('.st-stage-box iframe'), shot = async () => (await frame.screenshot()).toString('base64');
  const C = await shot(), before = await pg.evaluate(() => window.axo.project.get());
  await pg.mouse.move(cx, cy); await pg.mouse.down();
  for (let i = 1; i <= 60; i++) {
    await pg.mouse.move(cx - 100 * i / 60, cy + 30 * i / 60); await new Promise((r) => setTimeout(r, 16));
    if (i === 30) await pg.evaluate((p) => document.querySelector('.st-stage-box iframe').contentWindow.postMessage({ type: 'project', project: p }, '*'), before);
  }
  await pg.waitForTimeout(600);
  const A = await shot();
  await pg.mouse.up(); await pg.waitForTimeout(1500);
  const B = await shot(), after = await pg.evaluate(() => window.axo.project.get());
  if (process.env.SNAP_DIR) for (const [n, b64] of Object.entries({ before: C, holding: A, released: B })) fs.writeFileSync(path.join(process.env.SNAP_DIR, `snap_${n}.png`), Buffer.from(b64, 'base64'));   // 想看图：SNAP_DIR=目录
  const blank = await ctx.newPage();                            // 在没有 CSP 的空白页里解 PNG、逐像素比
  const diff = (a, b) => blank.evaluate(async ([a, b]) => {
    const px = async (s) => { const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob()); const g = new OffscreenCanvas(bm.width, bm.height).getContext('2d'); g.drawImage(bm, 0, 0); return g.getImageData(0, 0, bm.width, bm.height).data; };
    const [x, y] = await Promise.all([px(a), px(b)]); let n = 0;
    for (let i = 0; i < x.length; i += 4) if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) > 24) n++;
    return +(100 * n / (x.length / 4)).toFixed(2);
  }, [a, b]);
  out.snap = { staleProjectMidDrag: true, holdingVsReleasedPct: await diff(A, B), beforeDragVsHoldingPct: await diff(C, A), before: before.model, committed: after.model };
  await blank.close();
}
console.log(JSON.stringify(out, null, 1));
if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(out, null, 1));
await browser.close(); server.close();
