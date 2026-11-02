// 公用的小工具：配置、分类名、配方转换、提示条、懒加载 GIF。
import CAT from '../../workshop/catalog.json';

export { CAT };
export const REPO = 'Axolotl-Launcher/AxoStickers';
export const RELEASE = { url: `https://github.com/${REPO}/releases/download/v1.0.0/AxoStickers-v1.0.0.zip`, size: '282 MB' };
export const STYLE_COLORS = {          // [浅, 深]：字色色块（engine/axl.py STYLES 的外描边 / 深描边）
  pink: ['#fe3e8c', '#c41660'], blue: ['#4098ff', '#1a62cd'], purple: ['#9e66ff', '#6838cc'], red: ['#ff5434', '#ce1e1e'],
  green: ['#24c66c', '#0c8c48'], gold: ['#ffac1c', '#d86c00'], gray: ['#9698a8', '#606272'], cyan: ['#18c4d6', '#0888a0'],
};

export const $ = (s, root = document) => root.querySelector(s);
export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

export const pad3 = (n) => String(n).padStart(3, '0');
export const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');

// ---------------- 配方 ----------------
export function fxLabel(f) {
  if (CAT.fx[f]) return CAT.fx[f];
  const [kind, icon] = String(f).split(':');
  return (CAT.fxKinds[kind] || kind) + (icon ? ' · ' + (CAT.icons[icon] || icon) : '');
}
export function recipeRows(r) {
  const m = CAT.motions[r.motion];
  const rows = [
    ['动作', m ? m.zh : r.motion, r.motion],
    ['表情', CAT.faces[r.face] || (r.face === 'custom' ? '特制' : r.face), r.face],
  ];
  if (r.fx?.length) rows.push(['特效', r.fx.map(fxLabel).join('、'), null]);
  if (r.hold) rows.push(['道具', CAT.holds[r.hold] || r.hold, r.hold]);
  if (r.wear?.length) rows.push(['帽子', r.wear.map((w) => CAT.wears[w] || w).join('、'), null]);
  rows.push(['字色', CAT.styles[r.style || 'pink'], r.style || 'pink']);
  rows.push(['文字动画', CAT.tmodes[r.tmode || 'stay'], r.tmode || 'stay']);
  return rows;
}
// 图鉴里的一张 -> 编辑器能用的配方（只保留工坊支持的部分）
export function toRecipe(s) {
  const C = CAT;
  const m = C.motions[s.motion] ? s.motion : 'idle';
  const r = {
    v: 1, text: s.text || '', motion: m, face: C.faces[s.face] ? s.face : 'normal',
    fx: (s.fx || []).filter((f) => C.fx[f]).slice(0, C.limits.fx),
    hold: C.holds[s.hold] ? s.hold : null,
    wear: (s.wear || []).filter((w) => C.wears[w]).slice(0, C.limits.wear),
    style: C.styles[s.style] ? s.style : 'pink', tmode: C.tmodes[s.tmode] ? s.tmode : 'stay',
  };
  if (C.motions[m].noHold) r.hold = null;
  if (C.motions[m].offscreen && C.entrance.includes(r.tmode)) r.tmode = 'stay';
  return r;
}
export const recipeToSpec = (r) => ({ text: r.text, motion: r.motion, face: r.face, fx: r.fx, hold: r.hold || undefined, wear: r.wear, style: r.style, tmode: r.tmode });

// ---------------- 卡片：先显示静态缩略图，悬停 / 手机上停在屏幕里才换成 GIF ----------------
const touch = matchMedia('(hover: none)').matches;
const playing = new Set();
const MAX_PLAYING = 9;
function play(card) {
  const img = card.querySelector('.pic');
  if (!img || img.dataset.playing) return;
  img.dataset.playing = '1'; img.src = img.dataset.gif;
  playing.add(card);
  if (playing.size > MAX_PLAYING) stop(playing.values().next().value);
}
function stop(card) {
  const img = card.querySelector('.pic');
  if (!img || !img.dataset.playing) return;
  delete img.dataset.playing; img.src = img.dataset.still;
  playing.delete(card);
}
const timers = new WeakMap();
const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  for (const e of entries) {
    clearTimeout(timers.get(e.target));
    if (e.isIntersecting && e.intersectionRatio >= 0.6) timers.set(e.target, setTimeout(() => play(e.target), 350));
    else stop(e.target);
  }
}, { threshold: [0, 0.6] }) : null;

export function animated(card) {
  if (touch && io) io.observe(card);
  else {
    card.addEventListener('mouseenter', () => play(card));
    card.addEventListener('mouseleave', () => stop(card));
    card.addEventListener('focus', () => play(card));
    card.addEventListener('blur', () => stop(card));
  }
  return card;
}
export function unobserve(cards) { if (io) for (const c of cards) io.unobserve(c); for (const c of cards) stop(c); }
