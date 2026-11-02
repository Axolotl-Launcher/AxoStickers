import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TYPES = { '.gif': 'image/gif', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.mp4': 'video/mp4', '.js': 'text/javascript', '.glb': 'model/gltf-binary' };

// 开发时把仓库里的 out/、workshop/、缩略图缓存和对照参考帧当成网站的一部分来提供（正式构建由 tools/assemble.py 拷进 _site/）
function repoFiles() {
  const dirs = {
    out: path.join(ROOT, 'out'), workshop: path.join(ROOT, 'workshop'), components: path.join(ROOT, 'workshop', 'components'),
    models: path.join(ROOT, 'kit', 'model'), thumbs: path.join(ROOT, 'site', '.thumbs'), previews: path.join(ROOT, 'site', '.previews'), _ref: path.join(ROOT, 'site', '.ref'),
  };
  return {
    name: 'repo-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url || '').split('?')[0]);
        if (url === '/components/index.json') {                  // 组件库清单：和 tools/assemble.py 一样，只读文件头
          const dir = path.join(ROOT, 'workshop', 'components'), list = [];
          for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
            if (!f.endsWith('.axo.js')) continue;
            const m = /^\s*\/\*\s*@axo\s*(\{[\s\S]*?\})\s*\*\//.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
            if (m) list.push({ ...JSON.parse(m[1]), file: f });
          }
          res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(list)); return;
        }
        const m = url.match(/^\/(out|workshop|thumbs|previews|components|models|_ref)\/(.+)$/);
        if (!m) return next();
        const file = path.resolve(dirs[m[1]], m[2]);
        if (!file.startsWith(dirs[m[1]] + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
        res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [repoFiles()],
  // 沙盒 iframe 是不透明来源（Origin: null），开发服务器要允许它跨源取脚本和字体；GitHub Pages 本来就发 ACAO: *
  server: { port: 5173, strictPort: true, fs: { allow: [ROOT] }, cors: { origin: [/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, 'null'] } },
  build: {
    outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 0, chunkSizeWarningLimit: 1500,
    rollupOptions: { input: { index: path.join(import.meta.dirname, 'index.html'), sandbox: path.join(import.meta.dirname, 'sandbox.html') } },
  },
});
