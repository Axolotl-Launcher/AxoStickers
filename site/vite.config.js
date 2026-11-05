import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

import { CONTRIBUTE } from './src/flags.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const TYPES = { '.gif': 'image/gif', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.mp4': 'video/mp4', '.js': 'text/javascript', '.glb': 'model/gltf-binary' };

// 表情 GIF 在网站上的英文地址：gif/001.gif；初代、水龙卷用清单里的 slug：gif/og-send-log.gif、gif/tornado-1.gif（和 tools/assemble.py 的 site_gifs 是同一套规则）。
// QQ 收拖进去的图片时会自己去下图片的地址，地址里有中文就失败；中文名只当文件名。返回改成新地址的清单和 {新文件名: 源文件}。
function siteGifs() {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'stickers.json'), 'utf8')), files = new Map();
  const named = [...data.stickers.map((s) => [`${String(s.id).padStart(3, '0')}.gif`, s]), ...data.specials.map((s) => [`${s.slug}.gif`, s])];
  for (const [name, s] of named) { files.set(name, path.join(ROOT, s.gif)); s.gif = `gif/${name}`; }
  return { data, files };
}

// 开发时把仓库里的 out/、workshop/、缩略图缓存和对照参考帧当成网站的一部分来提供（正式构建由 tools/assemble.py 拷进 _site/）
function repoFiles() {
  const dirs = {
    out: path.join(ROOT, 'out'), workshop: path.join(ROOT, 'workshop'), components: path.join(ROOT, 'workshop', 'components'),
    models: path.join(ROOT, 'kit', 'model'), thumbs: path.join(ROOT, 'site', '.thumbs'), previews: path.join(ROOT, 'site', '.previews'), _ref: path.join(ROOT, 'site', '.ref'),
  };
  return {
    name: 'repo-files',
    configureServer(server) {
      // 沙盒 iframe 是不透明来源（Origin: null，不带 Referer），开发时要靠 CORS 取模块、样式和字体。不能笼统放行 null：
      // 任何网页开个 sandbox iframe 就能读开发服务器上的文件。所以只放行沙盒自己的模块图用得到的路径（site/src、Vite 的运行时、依赖），
      // /@fs/（仓库里任意文件）和 out/、workshop/ 这些数据目录不放行，?raw 读源码只给 src/components/（内置组件本来就这么载入）。
      // 剩下的代价：开发服务器开着时，恶意网页能读到 site/src 下的源码模块。正式网站不受影响（GitHub Pages 上都是公开的静态文件）。
      server.middlewares.use((req, res, next) => {
        if (req.headers.origin === 'null') {
          const [p, q = ''] = (req.url || '').split('?');
          const fsFile = p.startsWith('/@fs/') ? path.resolve(decodeURIComponent(p.slice(5))) : null;   // 仓库外层的文件只放行可选项清单
          const ok = (/^\/(src|@vite|@id|node_modules)\//.test(p) || fsFile === path.join(ROOT, 'workshop', 'catalog.json')) && !p.includes('..') &&
            (!/(^|&)raw(&|=|$)/.test(q) || p.startsWith('/src/components/'));
          if (ok) { res.setHeader('Access-Control-Allow-Origin', 'null'); res.setHeader('Vary', 'Origin'); }
        }
        next();
      });
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url || '').split('?')[0]);
        if (url === '/components/index.json') {                  // 组件库清单：和 tools/assemble.py 一样，只读文件头
          const dir = path.join(ROOT, 'workshop', 'components'), list = [];
          for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
            if (!f.endsWith('.axo.js')) continue;
            const m = /^\s*\/\*\s*@axo\s*(\{[\s\S]*?\})\s*\*\//.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
            if (m) list.push({ ...JSON.parse(m[1]), file: f });
          }
          const md = path.join(ROOT, 'workshop', 'models');            // 工坊里的模型：说明卡 <id>.json，文件在 workshop/models/ 或 kit/model/
          for (const f of fs.existsSync(md) ? fs.readdirSync(md) : []) {
            if (!f.endsWith('.json')) continue;
            const meta = JSON.parse(fs.readFileSync(path.join(md, f), 'utf8')), file = [path.join(md, meta.file), path.join(dirs.models, meta.file)].find((p) => fs.existsSync(p));
            if (file) list.push({ ...meta, type: 'model', face: !!meta.face, kb: Math.round(fs.statSync(file).size / 1024) });
          }
          res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(list)); return;
        }
        if (url === '/out/stickers.json') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(siteGifs().data)); return; }   // 和站上一样：GIF 是英文地址
        const g = url.match(/^\/gif\/([\w-]+\.gif)$/), gif = g && siteGifs().files.get(g[1]);
        if (g) {
          if (!gif || !fs.existsSync(gif)) return next();
          res.setHeader('Content-Type', 'image/gif'); fs.createReadStream(gif).pipe(res); return;
        }
        const m = url.match(/^\/(out|workshop|thumbs|previews|components|models|_ref)\/(.+)$/);
        if (!m) return next();
        let file = path.resolve(dirs[m[1]], m[2]);
        const wsModels = path.join(ROOT, 'workshop', 'models');
        if (m[1] === 'models' && !fs.existsSync(file)) file = path.resolve(wsModels, m[2]);   // 工坊里的模型
        if (!(file.startsWith(dirs[m[1]] + path.sep) || (m[1] === 'models' && file.startsWith(wsModels + path.sep))) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
        res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

// 开发时沙盒页面不要 Vite 的热更新客户端：沙盒的 CSP 是 connect-src 'none'，客户端连 WebSocket 一定被拦、在控制台报错。
// 沙盒的模块图里没有用到 import.meta.hot 的（字体样式是 <link> 引进来的），去掉它不影响加载；改了代码刷新编辑器就会重开沙盒。
function sandboxNoHmr() {
  return {
    name: 'sandbox-no-hmr', apply: 'serve',
    transformIndexHtml: { order: 'post', handler: (html, ctx) => (/sandbox\.html$/.test(ctx.path) ? html.replace(/<script type="module" src="[^"]*\/@vite\/client"><\/script>\s*/g, '') : html) },
  };
}

// llms.txt 里只在投稿入口开着时才有的行写成「[[contribute]] …」，关着时才有的写成「[[!contribute]] …」：按 src/flags.js 的 CONTRIBUTE 留一种
// （开发服务器上现做现给；构建时 public/ 拷进 dist 以后改写那一份）
const llmsText = (s) => s.split('\n').flatMap((l) => { const m = /^\[\[(!?)contribute\]\] ?/.exec(l); return !m ? [l] : (m[1] === '!') !== CONTRIBUTE ? [l.slice(m[0].length)] : []; }).join('\n');
function llmsTxt() {
  let outDir = 'dist';
  return [{
    name: 'llms-txt-serve', apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if ((req.url || '').split('?')[0] !== '/llms.txt') return next();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end(llmsText(fs.readFileSync(path.join(import.meta.dirname, 'public', 'llms.txt'), 'utf8')));
      });
    },
  }, {
    name: 'llms-txt-build', apply: 'build',
    configResolved(c) { outDir = path.resolve(c.root, c.build.outDir); },
    closeBundle() { const f = path.join(outDir, 'llms.txt'); if (fs.existsSync(f)) fs.writeFileSync(f, llmsText(fs.readFileSync(f, 'utf8'))); },
  }];
}

export default defineConfig({
  base: './',
  plugins: [repoFiles(), sandboxNoHmr(), llmsTxt()],
  // 沙盒 iframe 取资源的 CORS 见上面 repoFiles 里的中间件；GitHub Pages 本来就发 ACAO: *
  server: { port: 5173, strictPort: true, fs: { allow: [ROOT] }, cors: { origin: [/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/] } },
  worker: { format: 'iife' },                                  // 沙盒的 Worker 打成一个普通脚本塞进 blob:（不透明来源里开不了模块 Worker，也 import 不了别的文件）
  build: {
    outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 0, chunkSizeWarningLimit: 1500,
    rollupOptions: { input: { index: path.join(import.meta.dirname, 'index.html'), sandbox: path.join(import.meta.dirname, 'sandbox.html') } },
  },
});
