// 工坊作品：workshop/index.json 里的投稿（GitHub Actions 用真引擎出的图），按最新 / 最多赞排。
import { $, el, encodePath, animated, unobserve, CONTRIBUTE } from './util.js';
import { loadFailed, loadOk } from './gallery.js';

export const WS = { entries: [], ready: null, sort: 'new' };

export function loadWorkshop() {
  WS.ready ||= fetch('workshop/index.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .catch((e) => { WS.ready = null; throw e; })    // 失败了不缓存，下次还能重试
    .then((d) => {
      WS.entries = (d.entries || []).map((e) => ({
        ...e, key: String(e.issue), gifUrl: encodePath(e.gif), still: `thumbs/w${e.issue}.webp`, preview: `previews/w${e.issue}.mp4`, coverUrl: encodePath(e.cover),
      }));
      return WS;
    });
  return WS.ready;
}

export function sorted() {
  const a = [...WS.entries];
  return WS.sort === 'likes' ? a.sort((x, y) => (y.likes || 0) - (x.likes || 0) || y.issue - x.issue) : a.sort((x, y) => y.issue - x.issue);
}

function card(e) {
  const img = el('img', { class: 'pic', loading: 'lazy', decoding: 'async', width: 400, height: 400, alt: '', src: e.still, 'data-still': e.still, 'data-gif': e.gifUrl, 'data-preview': e.preview });
  img.addEventListener('error', () => { if (img.src.includes('/thumbs/')) { img.dataset.still = e.coverUrl; img.src = e.coverUrl; } }, { once: true });
  return animated(el('button', { class: 'card ws-card', type: 'button', onclick: () => { location.hash = `#/w/${e.issue}`; } }, img,
    el('span', { class: 'cap' }, el('b', { text: e.text }), el('span', { class: 'likes', text: `👍 ${e.likes || 0}` }),
      el('span', { class: 'who', text: `@${e.author} · ${e.date.slice(0, 10)}` }))));
}

function render() {
  const grid = $('#ws-grid');
  unobserve([...grid.children]);
  grid.replaceChildren(...sorted().map(card));
  $('#ws-empty').hidden = WS.entries.length > 0;
}

export async function initWorkshop() {
  if (!CONTRIBUTE) $('#ws-empty').replaceChildren(el('b', { text: '这里还空着' }), '先去创意工坊自己做一张吧。', el('br'), el('br'), el('a', { class: 'btn primary', href: '#/editor', text: '去做一张' }));   // 投稿入口关着：不招呼人来发布
  try { await loadWorkshop(); } catch (e) { loadFailed($('#ws-empty'), '工坊作品'); throw e; }
  loadOk($('#ws-empty'));
  const chips = $('#ws-sort');
  chips.addEventListener('click', (ev) => {
    const b = ev.target.closest('.chip'); if (!b) return;
    WS.sort = b.dataset.sort;
    for (const c of chips.children) c.setAttribute('aria-pressed', String(c === b));
    render();
  });
  render();
}
