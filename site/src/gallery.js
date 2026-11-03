// 图鉴：300 张 + 水龙卷。分类、搜索、按动作 / 字色筛选；卡片先放缩略图，悬停或滑到才加载 GIF。
import { CAT, STYLE_COLORS, $, el, pad3, encodePath, fxLabel, animated } from './util.js';

export const G = { items: [], byKey: new Map(), visible: [], ready: null };
const state = { cat: '', q: '', motion: '', style: '' };

function normalize(s, special) {
  const key = special ? s.id : pad3(s.id);
  return {
    ...s, key, special, fx: s.fx || [], wear: s.wear || [],
    num: special ? 1000 : s.id,
    gif: encodePath(s.gif), cover: s.cover ? encodePath(s.cover) : encodePath(s.gif),
    still: `thumbs/${encodeURIComponent(key)}.webp`, preview: `previews/${encodeURIComponent(key)}.mp4`,
    search: [s.text, CAT.motions[s.motion]?.zh, CAT.faces[s.face], ...(s.fx || []).map(fxLabel), CAT.holds[s.hold],
      ...(s.wear || []).map((w) => CAT.wears[w]), special ? '水龙卷 特别篇' : ''].filter(Boolean).join(' ').toLowerCase(),
  };
}

export function loadGallery() {
  G.ready ||= fetch('out/stickers.json').then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }).then((d) => {
    G.items = [...d.stickers.map((s) => normalize(s, false)), ...d.specials.map((s) => normalize(s, true))];
    for (const it of G.items) G.byKey.set(it.key, it);
    return G;
  }).catch((e) => { G.ready = null; throw e; });    // 失败了不缓存，下次还能重试
  return G.ready;
}

// 加载失败的提示单独放一块，不覆盖原来的空状态
export function loadFailed(box, what) {
  loadOk(box); box.hidden = true;
  box.before(el('div', { class: 'empty load-error' }, el('b', { text: `${what}没加载出来` }), '网络抖了一下，过会儿再试。', el('br'), el('br'),
    el('button', { class: 'btn primary', type: 'button', text: '重试', onclick: () => location.reload() })));
}
export function loadOk(box) { box.parentElement.querySelector('.load-error')?.remove(); }

function card(it) {
  const img = el('img', {
    class: 'pic', loading: 'lazy', decoding: 'async', width: 400, height: 400, alt: '',   // 文字就在下面的说明里（按钮的名字），图片再念一遍是重复
    src: it.still, 'data-still': it.still, 'data-gif': it.gif, 'data-preview': it.preview,
  });
  img.addEventListener('error', () => { if (img.src.includes('/thumbs/')) { img.dataset.still = it.cover; img.src = it.cover; } }, { once: true });
  const c = el('button', { class: 'card', type: 'button', 'data-key': it.key, onclick: () => { location.hash = `#/s/${encodeURIComponent(it.key)}`; } },
    img,
    it.special ? el('span', { class: 'badge', text: '特别篇' }) : null,
    el('span', { class: 'cap' }, el('b', { text: it.text || '（无字）' }), el('span', { text: it.special ? '水龙卷' : '#' + it.key })));
  return animated(c);
}

function apply() {
  const q = state.q.trim().toLowerCase();
  G.visible = [];
  for (const it of G.items) {
    const ok = (!state.cat || it.category === state.cat) && (!q || it.search.includes(q)) &&
      (!state.motion || it.motion === state.motion) && (!state.style || (it.style || 'pink') === state.style);
    it.card.hidden = !ok;
    if (ok) G.visible.push(it);
  }
  $('#count').textContent = `${G.visible.length} 张`;
  $('#g-empty').hidden = G.visible.length > 0;
}

export async function initGallery() {
  try { await loadGallery(); } catch (e) { loadFailed($('#g-empty'), '图鉴'); throw e; }
  loadOk($('#g-empty'));
  const grid = $('#grid');
  grid.append(...G.items.map((it) => (it.card = card(it))));

  const counts = {};
  for (const it of G.items) counts[it.category] = (counts[it.category] || 0) + 1;
  const chips = $('#cat-chips');
  const chip = (val, label, n) => el('button', { class: 'chip', type: 'button', 'aria-pressed': String(state.cat === val), 'data-v': val },
    label, el('span', { class: 'n', text: n }));
  chips.append(chip('', '全部', G.items.length), ...Object.keys(CAT.categories).filter((k) => counts[k]).map((k) => chip(k, CAT.categories[k], counts[k])));
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    state.cat = b.dataset.v;
    for (const c of chips.children) c.setAttribute('aria-pressed', String(c === b));
    apply();
  });

  const mc = {};
  for (const it of G.items) if (!it.special) mc[it.motion] = (mc[it.motion] || 0) + 1;
  const sel = $('#f-motion');
  Object.keys(mc).sort((a, b) => (CAT.motions[a]?.zh || a).localeCompare(CAT.motions[b]?.zh || b, 'zh-CN'))
    .forEach((m) => sel.append(el('option', { value: m, text: `${CAT.motions[m]?.zh || m}（${mc[m]}）` })));
  sel.addEventListener('change', () => { state.motion = sel.value; apply(); });

  const sw = $('#f-style');
  for (const [k, zh] of Object.entries(CAT.styles)) {
    const [c, d] = STYLE_COLORS[k];
    sw.append(el('button', { class: 'swatch', type: 'button', title: zh + '字', 'aria-label': zh + '字', 'aria-pressed': 'false', 'data-v': k, style: `--c:${c};--d:${d}` }));
  }
  sw.addEventListener('click', (e) => {
    const b = e.target.closest('.swatch'); if (!b) return;
    state.style = state.style === b.dataset.v ? '' : b.dataset.v;
    for (const s of sw.children) s.setAttribute('aria-pressed', String(s.dataset.v === state.style));
    apply();
  });

  let t;
  $('#q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; apply(); }, 120); });
  apply();
}
