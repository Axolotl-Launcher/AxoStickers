// 300 张表情用网页引擎出图：out/projects/NNN.json → out/NNN_文字.gif + out/_封面/NNN_文字.png（文件名照 out/stickers.json）
//   cd site && npm run build && node tools/render_stickers.mjs [1-50,77] [--channel msedge] [--soft] [--batch 20] [--pause 20] [--out 目录]
// --soft：用软件渲染（CI 这种没显卡的机器）
// 和编辑器是同一个引擎、同一个沙盒页面（dist/sandbox.html），一个浏览器一张一张出；每出一批歇一会儿，别让电脑一直满负荷。
// 封面是「字刚好出全」那一帧（工程里写了 cover 就用它），没压色的 PNG。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..', '..'), DIST = path.resolve(import.meta.dirname, '..', 'dist');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const sel = args.find((a) => /^\d/.test(a));
const ids = new Set();
for (const part of (sel || '1-300').split(',')) { const [a, b] = part.split('-').map(Number); for (let i = a; i <= (b || a); i++) ids.add(i); }
const BATCH = +opt('--batch', 20), PAUSE = +opt('--pause', 20), OUT = path.resolve(opt('--out', path.join(ROOT, 'out')));
if (!fs.existsSync(path.join(DIST, 'sandbox.html'))) { console.error('先在 site/ 里 npm run build'); process.exit(2); }
const list = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'stickers.json'), 'utf8')).stickers.filter((s) => ids.has(s.id));

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]), file = path.resolve(DIST, '.' + url);
  if (!file.startsWith(DIST + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404, { 'Access-Control-Allow-Origin': '*' }); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ ...(opt('--channel') ? { channel: opt('--channel') } : {}), args: args.includes('--soft') ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
await ctx.route((u) => u.href.startsWith(BASE), async (r) => {     // 有的机器上无头浏览器连本机偶尔会失败：自己转发，失败了重试
  for (let i = 0; i < 8; i++) { try { return await r.fulfill({ response: await r.fetch() }); } catch { await new Promise((ok) => setTimeout(ok, 150 * (i + 1))); } }
  return r.abort();
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('[page]', e.message));
await page.addInitScript(() => {
  window.__msgs = [];
  window.addEventListener('message', (e) => { if (e.data && ['ready', 'scene', 'errors', 'exported', 'export-error', 'fatal'].includes(e.data.type)) window.__msgs.push(e.data); });
});
await page.goto(BASE + 'sandbox.html');
const count = () => page.evaluate(() => window.__msgs.length);
const waitFor = (type, from) => page.waitForFunction(([t, n]) => window.__msgs.slice(n).some((m) => m.type === t || m.type === 'fatal' || m.type === 'export-error'), [type, from], { timeout: 180000, polling: 100 })
  .then(() => page.evaluate(([t, n]) => window.__msgs.slice(n).find((m) => m.type === t || m.type === 'fatal' || m.type === 'export-error'), [type, from]));
const bytesOf = (n) => page.evaluate((k) => {
  const m = window.__msgs.slice(k).find((x) => x.type === 'exported'), u = new Uint8Array(m.bytes);
  let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}, n).then((b) => Buffer.from(b, 'base64'));
if ((await waitFor('ready', 0)).type !== 'ready') { console.error('沙盒没起来'); process.exit(1); }

let bad = 0;
for (const [i, s] of list.entries()) {
  if (i && i % BATCH === 0) { console.log(`… 歇 ${PAUSE} 秒`); await new Promise((r) => setTimeout(r, PAUSE * 1000)); }
  const t0 = Date.now(), name = path.basename(s.gif), project = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'projects', `${String(s.id).padStart(3, '0')}.json`), 'utf8'));
  let n = await count();
  await page.evaluate((p) => window.postMessage({ type: 'project', project: p }, '*'), project);
  const sc = await waitFor('scene', n);
  const errs = await page.evaluate((k) => window.__msgs.slice(k).flatMap((m) => m.errors || []), n);
  if (sc.type !== 'scene' || errs.length) { console.error(s.id, s.text, '工程有问题', sc.message || '', JSON.stringify(errs)); bad++; continue; }
  n = await count();
  await page.evaluate(() => window.postMessage({ type: 'export', req: 'gif', format: 'gif' }, '*'));
  const done = await waitFor('exported', n);
  if (done.type !== 'exported' || done.errors?.length) { console.error(s.id, s.text, '导出失败', done.message || JSON.stringify(done.errors)); bad++; continue; }
  const gif = await bytesOf(n);
  n = await count();
  await page.evaluate((t) => { window.postMessage({ type: 'transport', playing: false, t }, '*'); window.postMessage({ type: 'export', req: 'png', format: 'png' }, '*'); }, sc.cover);
  const still = await waitFor('exported', n);
  if (still.type !== 'exported') { console.error(s.id, s.text, '封面失败', still.message); bad++; continue; }
  const png = await bytesOf(n);
  fs.mkdirSync(path.join(OUT, '_封面'), { recursive: true });
  fs.writeFileSync(path.join(OUT, name), gif);
  fs.writeFileSync(path.join(OUT, '_封面', name.replace(/\.gif$/, '.png')), png);
  console.log(JSON.stringify({ id: s.id, text: s.text, kb: Math.round(gif.length / 1024), frames: sc.N, cover: sc.cover, s: Math.round((Date.now() - t0) / 100) / 10 }));
}
await browser.close(); server.close();
process.exit(bad ? 1 : 0);
