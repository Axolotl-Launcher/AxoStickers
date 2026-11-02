import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TYPES = { '.gif': 'image/gif', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' };

// 开发时把仓库里的 out/、workshop/、缩略图缓存和对照参考帧当成网站的一部分来提供（正式构建由 tools/assemble.py 拷进 _site/）
function repoFiles() {
  const dirs = {
    out: path.join(ROOT, 'out'), workshop: path.join(ROOT, 'workshop'),
    thumbs: path.join(ROOT, 'site', '.thumbs'), _ref: path.join(ROOT, 'site', '.ref'),
  };
  return {
    name: 'repo-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url || '').split('?')[0]);
        const m = url.match(/^\/(out|workshop|thumbs|_ref)\/(.+)$/);
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
  server: { port: 5173, strictPort: true, fs: { allow: [ROOT] } },
  build: { outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 0, chunkSizeWarningLimit: 1500 },
});
