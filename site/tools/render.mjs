// 用网页引擎在无头 Chromium 里出图（工坊投稿用，和编辑器里的预览是同一个引擎、同一个沙盒页面）：
//   node site/tools/render.mjs <网站目录 dist> <工程.json> <输出.gif>
//   node site/tools/render.mjs <网站目录 dist> --studio      自检：真浏览器里 sandbox="allow-scripts" 的预览能不能起来
// 工程里可以带别人写的组件代码，所以 CI 里这一步在没有权限、没有网络的容器里跑（见 .github/workflows/workshop.yml）。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [dir, arg2, out] = process.argv.slice(2);
if (!dir || !arg2) { console.error('用法见文件开头'); process.exit(2); }
const ROOT = path.resolve(dir);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.glb': 'model/gltf-binary', '.mp4': 'video/mp4' };

// 静态服务器：和 GitHub Pages 一样发 Access-Control-Allow-Origin: *（沙盒 iframe 是不透明来源，要靠它取脚本和字体）
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.resolve(ROOT, '.' + (url.endsWith('/') ? url + 'index.html' : url));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404, { 'Access-Control-Allow-Origin': '*' }); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
// 失败也写一份报告（out.json），工作流拿它回复投稿人
const fail = async (message, errors = []) => {
  console.error(message, errors.length ? JSON.stringify(errors) : '');
  if (out && arg2 !== '--studio') fs.writeFileSync(out.replace(/\.gif$/i, '') + '.json', JSON.stringify({ ok: false, message, errors }, null, 1));
  await browser.close(); server.close(); process.exit(1);
};
const timer = setTimeout(() => fail('超时（90 秒）'), 90000);

if (arg2 === '--studio') {
  await page.goto(base + 'index.html#/editor');
  const frame = await page.waitForSelector('.st-stage-box iframe', { timeout: 30000 });
  const sandboxAttr = await frame.getAttribute('sandbox');
  await page.waitForFunction(() => document.querySelector('.st-boot')?.hidden === true, null, { timeout: 30000 }).catch(() => {});
  const booted = await page.evaluate(() => document.querySelector('.st-boot')?.hidden === true);
  const tiles = await page.evaluate(async () => {
    document.querySelector('.st-railbtn[data-k="face"]').click();
    await new Promise((r) => setTimeout(r, 2500));
    return [...document.querySelectorAll('.st-drawer-body canvas')].filter((c) => c.getContext('2d').getImageData(0, 0, 96, 96).data.some((v, i) => i % 4 === 3 && v)).length;
  });
  console.log(JSON.stringify({ sandboxAttr, booted, faceThumbsDrawn: tiles }));
  if (out) await page.screenshot({ path: out });
  clearTimeout(timer); await browser.close(); server.close();
  process.exit(booted && sandboxAttr === 'allow-scripts' && tiles > 0 ? 0 : 1);
}

const project = JSON.parse(fs.readFileSync(arg2, 'utf8'));
await page.addInitScript(() => {
  window.__msgs = [];
  window.addEventListener('message', (e) => { if (e.data && ['ready', 'scene', 'catalog', 'errors', 'model-done', 'exported', 'export-error', 'fatal'].includes(e.data.type)) window.__msgs.push(e.data); });
});
await page.goto(base + 'sandbox.html');
const waitFor = (type) => page.waitForFunction((t) => window.__msgs.some((m) => m.type === t || m.type === 'fatal' || m.type === 'export-error'), type, { timeout: 60000 })
  .then(() => page.evaluate((t) => window.__msgs.find((m) => m.type === t || m.type === 'fatal' || m.type === 'export-error'), type));
// 组件编译 / 运行时报的错：有就不出图（不然发出去的是缺了一块的图）
const reported = () => page.evaluate(() => window.__msgs.flatMap((m) => (m.type === 'catalog' || m.type === 'errors' || m.type === 'scene' ? m.errors || [] : []))
  .map((e) => ({ key: e.key || e.origin || '', message: String(e.message || ''), line: e.line ?? null })));
const ready = await waitFor('ready');
if (ready.type !== 'ready') await fail('沙盒没起来：' + (ready.message || ready.type));
const gl = await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl'); const d = c && c.getExtension('WEBGL_debug_renderer_info'); return c ? (d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'webgl') : null; });
if (project.model?.component === 'logo') {                   // 网站自带的另一个模型（dist/models/，沙盒页面自己不能联网，从这边递进去）
  const glb = fs.readFileSync(path.join(ROOT, 'models', 'axolotl_logo.glb')).toString('base64');
  const m = await page.evaluate((b64) => {
    const s = atob(b64), u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    window.postMessage({ type: 'model', req: 'm', id: 'logo', bytes: u.buffer }, '*', [u.buffer]);
  }, glb).then(() => waitFor('model-done'));
  if (!m.ok) await fail('模型没载进来：' + (m.message || m.type));
}
await page.evaluate((p) => window.postMessage({ type: 'project', project: p }, '*'), project);
const scene = await waitFor('scene');
if (scene.type !== 'scene') await fail('工程没建起来：' + (scene.message || scene.type));
if ((await reported()).length) await fail('组件报错了', await reported());
await page.evaluate(() => window.postMessage({ type: 'export', req: 1, format: 'gif' }, '*'));
const done = await waitFor('exported');
if (done.type !== 'exported') await fail('导出失败：' + (done.message || done.type));
if ((await reported()).length) await fail('组件报错了', await reported());
const b64 = await page.evaluate(() => {
  const m = window.__msgs.find((x) => x.type === 'exported'), u = new Uint8Array(m.bytes);
  let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
});
const bytes = Buffer.from(b64, 'base64');
fs.writeFileSync(out, bytes);
const cover = Math.min(scene.N - 1, Math.max(0, Math.round((scene.cover || 0) * scene.fps)));   // 封面：文字刚好出全的那一帧
const report = { ok: true, kb: Math.round(bytes.length / 1024), frames: scene.N, fps: scene.fps, cover, errors: [], renderer: gl };
fs.writeFileSync(out.replace(/\.gif$/i, '') + '.json', JSON.stringify(report, null, 1));
console.log(JSON.stringify(report));
clearTimeout(timer); await browser.close(); server.close();
