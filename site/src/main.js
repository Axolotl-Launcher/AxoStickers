// 入口：路由（#/ 图鉴、#/s/编号 大图、#/editor 创意工坊、#/workshop 工坊作品、#/w/issue 号）。
import './style.css';
import { RELEASE, $, encodePath, toast } from './util.js';   // util.js 一载入就开始异步拿字体样式（fontsCss）
import { G, initGallery, loadGallery } from './gallery.js';
import { WS, initWorkshop, sorted } from './workshop.js';
import { openDetail, closeDetail } from './detail.js';
import { initHero } from './hero.js';
import { detectPerf } from './perf.js';

// 设备档位挂到 <html> 上：样式据此关掉没有显卡加速时很费的效果（毛玻璃、常驻动画）
const perf = detectPerf();
Object.assign(document.documentElement.dataset, { perf: perf.tier, gpu: perf.gpu, device: perf.device });

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

let view = null, studio = null;
const loadStudio = () => (studio ||= import('./studio/studio.js'));
const ready = { gallery: null, workshop: null };
const retryable = (key, init) => (ready[key] ||= init().catch((e) => { ready[key] = null; console.error(e); }));
// 首页头图（标题用表情字体画）只在真的看到图鉴时才开：直接打开编辑器时，后台预载图鉴数据不该顺手下标题那 6 个字体切片
let heroStarted = false;
const startHero = () => { if (heroStarted || view !== 'gallery' || !G.items?.length) return; heroStarted = true; initHero(G.items, () => view === 'gallery').catch(console.error); };
const gallery = () => retryable('gallery', () => initGallery().then(startHero));
const workshop = () => retryable('workshop', initWorkshop);

// 给浏览器里的 AI 助手 / 自动化脚本：编辑器还没打开时，axo.studio() 会打开它并等预览准备好，然后返回完整接口（说明：llms.txt）
const openStudioApi = async () => {
  if (!location.hash.startsWith('#/editor')) location.hash = '#/editor';
  await loadStudio();
  for (let i = 0; i < 400 && window.axo.studio === openStudioApi; i++) await new Promise((r) => setTimeout(r, 50));
  if (window.axo.studio === openStudioApi) throw new Error('编辑器 20 秒内没打开（看页面上的提示，刷新再试）');
  return window.axo.studio();
};
window.axo = Object.assign(window.axo || {}, {
  version: 2, perf,
  help: () => '先 await axo.studio()：打开创意工坊编辑器并等预览准备好，返回编辑器的全部接口（再调 axo.help() 看）。axo.stickers() 列出图鉴里的表情。完整说明：llms.txt',
  studio: openStudioApi,
  stickers: async () => { await gallery(); return G.items.map((it) => ({ key: it.key, text: it.text, category: it.category, gif: it.gif, motion: it.motion, face: it.face })); },
  go: (route) => { location.hash = route.startsWith('#') ? route : `#/${route.replace(/^\/+/, '')}`; return location.hash; },
});

function show(v) {
  delete document.documentElement.dataset.route;                // 换成按 hidden 显示（index.html 里按地址先显示的那一层不要了）
  document.documentElement.classList.toggle('in-editor', v === 'editor');   // 编辑器里网站顶栏收起来（见下面的 peekTopbar）
  if (v !== view) {
    for (const s of document.querySelectorAll('.view')) {
      s.hidden = s.dataset.view !== v;
      if (!s.hidden && view !== null) { s.classList.remove('view-enter'); void s.offsetWidth; s.classList.add('view-enter'); }   // 换页淡入（CSS 里按设备档位、减少动画开关）
    }
    for (const a of document.querySelectorAll('.nav a')) {
      if (a.dataset.view === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    }
    if (view !== null) window.scrollTo(0, 0);
    view = v;
  }
  if (studio) studio.then((m) => m.studioActive(v === 'editor'));
  if (v === 'gallery') startHero();
  document.title = { gallery: '美西螈表情包 · AxoStickers', editor: '创意工坊 · 美西螈表情包', workshop: '工坊作品 · 美西螈表情包' }[v];
}

// 创意工坊里网站的顶栏自己收起来，把高度让给编辑器：鼠标移到窗口最上沿、或者键盘 Tab 到导航时再出来；
// 触屏没有悬停，顶上中间留一个小把手，点一下拉出来
const topbar = $('.topbar');
const hot = Object.assign(document.createElement('div'), { className: 'topbar-hot' });
const handle = Object.assign(document.createElement('button'), { className: 'topbar-handle', type: 'button', title: '显示网站导航', innerHTML: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' });
hot.setAttribute('aria-hidden', 'true'); handle.setAttribute('aria-label', '显示网站导航');
document.body.prepend(hot, handle);
let hideTimer;
const setPeek = (on) => { topbar.classList.toggle('peek', on); document.documentElement.classList.toggle('topbar-open', on); };
const peekTopbar = (on, delay = 400) => { clearTimeout(hideTimer); if (on) setPeek(true); else hideTimer = setTimeout(() => setPeek(false), delay); };
hot.addEventListener('mouseenter', () => peekTopbar(true));
topbar.addEventListener('mouseenter', () => peekTopbar(true));
topbar.addEventListener('mouseleave', () => peekTopbar(false));
handle.addEventListener('click', () => peekTopbar(!topbar.classList.contains('peek'), 0));
document.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' && topbar.classList.contains('peek') && !topbar.contains(e.target) && e.target !== handle) peekTopbar(false, 0); });
topbar.addEventListener('click', (e) => { if (e.target.closest('a')) peekTopbar(false, 0); });   // 点了导航就收回去

let routeSeq = 0;                                              // 每次换路由 +1：等载入的时候用户已经走开了，就别再把他拉回编辑器
async function route() {
  const seq = ++routeSeq, hash = location.hash;
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');   // 先拆再解码：配方里的 + 不能被当成空格
  const [head, arg] = path.split('/').map((x) => { try { return decodeURIComponent(x); } catch { return x; } });
  if (head === 'e' && arg) { history.replaceState(null, '', `#/editor?k=${encodeURIComponent(arg)}`); return route(); }   // 1 分钟短链接
  if (head === 'editor') {
    closeDetail(true);
    show('editor');
    const q = new URLSearchParams(query || ''), m = await loadStudio();
    let recipe = null, project = null;
    try { if (q.get('r')) recipe = JSON.parse(q.get('r')); } catch { /* 链接坏了就开草稿 */ }
    if (q.get('w')) {                                          // 工坊作品「改一改」
      await workshop();
      const e = WS.entries.find((x) => String(x.issue) === q.get('w'));
      if (e?.project) {                                        // 第二版的投稿：工程单独存一个文件
        try { const r = await fetch(encodePath(e.project)); if (!r.ok) throw new Error(`HTTP ${r.status}`); project = await r.json(); }
        catch { toast('这张的工程没载进来，先打开一个空白草稿'); }
      } else if (e) recipe = e.recipe;
    }
    if (q.get('g')) {                                          // 图鉴里初代的「改一改」：照着原图做的工程单独存一个文件
      try {
        await loadGallery();
        const it = G.items.find((x) => x.special && x.slug === q.get('g'));
        if (!it?.project) throw new Error('没有工程');
        const r = await fetch(encodePath(it.project)); if (!r.ok) throw new Error(`HTTP ${r.status}`); project = await r.json();
      } catch { toast('这张的工程没载进来，先打开一个空白草稿'); }
    }
    if (seq !== routeSeq || location.hash !== hash) return;
    await m.openStudio($('#studio-root'), { recipe, project, shared: q.get('s'), short: q.get('k') });
    if ((q.get('r') || q.get('w') || q.get('g') || q.get('s') || q.get('k')) && location.hash === hash) history.replaceState(null, '', '#/editor');
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
