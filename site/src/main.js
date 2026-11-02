// 入口：路由（#/ 图鉴、#/s/编号 大图、#/editor 创意工坊、#/workshop 工坊作品、#/w/issue 号）。
import './gen/fonts.css';
import './style.css';
import { RELEASE, $ } from './util.js';
import { G, initGallery } from './gallery.js';
import { WS, initWorkshop, sorted } from './workshop.js';
import { openDetail, closeDetail } from './detail.js';
import { initEditor, loadRecipe, setEditorActive } from './editor.js';
import { initHero } from './hero.js';

$('#zip-link').href = RELEASE.url;
$('#zip-size').textContent = RELEASE.size;

const bubbles = document.querySelector('.bubbles');
for (let i = 0; i < 14; i++) {
  const b = document.createElement('i');
  b.style.left = `${(i * 37 + 11) % 100}%`;
  b.style.animationDelay = `${-(i * 0.53) % 7}s`;
  b.style.animationDuration = `${6 + (i % 4)}s`;
  bubbles.append(b);
}

let view = null;
const ready = { gallery: null, workshop: null };
const retryable = (key, init) => (ready[key] ||= init().catch((e) => { ready[key] = null; console.error(e); }));
const gallery = () => retryable('gallery', () => initGallery().then(() => { initHero(G.items, () => view === 'gallery').catch(console.error); }));
const workshop = () => retryable('workshop', initWorkshop);

function show(v) {
  if (v !== view) {
    for (const s of document.querySelectorAll('.view')) s.hidden = s.dataset.view !== v;
    for (const a of document.querySelectorAll('.nav a')) {
      if (a.dataset.view === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    }
    if (view !== null) window.scrollTo(0, 0);
    view = v;
  }
  setEditorActive(v === 'editor');
  document.title = { gallery: '美西螈表情包 · AxoStickers', editor: '创意工坊 · 美西螈表情包', workshop: '工坊作品 · 美西螈表情包' }[v];
}

async function route() {
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');   // 先拆再解码：配方里的 + 不能被当成空格
  const [head, arg] = path.split('/').map((x) => { try { return decodeURIComponent(x); } catch { return x; } });
  if (head === 'editor') {
    closeDetail(true);
    show('editor');
    const r = new URLSearchParams(query || '').get('r');
    if (r) loadRecipe(r);
    await initEditor();
    return;
  }
  if (head === 'workshop' || head === 'w') {
    show('workshop');
    await workshop();
    if (head === 'w') {
      const e = WS.entries.find((x) => String(x.issue) === arg);
      if (e) {
        const nav = (n) => { history.replaceState(null, '', `#/w/${n.issue}`); openDetail(n, sorted(), 'workshop', nav); };
        openDetail(e, sorted(), 'workshop', nav);
      }
    } else closeDetail(true);
    return;
  }
  show('gallery');
  await gallery();
  if (head === 's') {
    const it = G.byKey.get(arg);
    if (it) {
      const nav = (n) => { history.replaceState(null, '', `#/s/${encodeURIComponent(n.key)}`); openDetail(n, G.visible, 'gallery', nav); };
      openDetail(it, G.visible.includes(it) ? G.visible : G.items, 'gallery', nav);
    }
  } else closeDetail(true);
}

window.addEventListener('hashchange', route);
route();
// 先把图鉴准备好，切过来不用等
if (!location.hash.startsWith('#/editor')) gallery(); else setTimeout(gallery, 1500);
