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

// ---------------- 卡片：先放静态缩略图；悬停（手机上停在屏幕里）就播 240px 的小视频预览（几十 KB，比 1 MB 的 GIF 快得多） ----------------
const touch = matchMedia('(hover: none)').matches;
const playing = new Set();
const MAX_PLAYING = touch ? 6 : 9;
function play(card) {
  const img = card.querySelector('.pic');
  if (!img || card.dataset.playing) return;
  card.dataset.playing = '1';
  playing.add(card);
  if (playing.size > MAX_PLAYING) stop(playing.values().next().value);
  const src = img.dataset.preview;
  if (!src || card.dataset.noVideo) { img.src = img.dataset.gif; return; }       // 没有预览就退回 GIF
  let v = card.querySelector('.pic-video');
  if (!v) {
    v = el('video', { class: 'pic-video', muted: true, loop: true, playsinline: true, preload: 'auto', 'aria-hidden': 'true', disablepictureinpicture: true });
    v.muted = true;
    v.addEventListener('playing', () => { card.classList.remove('loading'); v.classList.add('on'); });
    v.addEventListener('error', () => { card.dataset.noVideo = '1'; card.classList.remove('loading'); if (card.dataset.playing) img.src = img.dataset.gif; }, { once: true });
    img.after(v);
  }
  if (!v.src) v.src = src;
  clearTimeout(card._spin); card._spin = setTimeout(() => { if (card.dataset.playing && !v.classList.contains('on')) card.classList.add('loading'); }, 120);
  v.currentTime = 0;
  v.play().catch(() => {});
}
function stop(card) {
  if (!card.dataset.playing) return;
  delete card.dataset.playing; playing.delete(card);
  clearTimeout(card._spin); card.classList.remove('loading');
  const v = card.querySelector('.pic-video');
  if (v) { v.pause(); v.classList.remove('on'); }
  const img = card.querySelector('.pic');
  if (img && img.src !== img.dataset.still && img.dataset.still) img.src = img.dataset.still;
}
const timers = new WeakMap();
const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  for (const e of entries) {
    clearTimeout(timers.get(e.target));
    if (e.isIntersecting && e.intersectionRatio >= 0.6) timers.set(e.target, setTimeout(() => play(e.target), 250));
    else stop(e.target);
  }
}, { threshold: [0, 0.6] }) : null;

export function animated(card) {
  if (touch && io) io.observe(card);
  else {
    card.addEventListener('pointerenter', () => play(card));
    card.addEventListener('pointerleave', () => stop(card));
    card.addEventListener('focus', () => play(card));
    card.addEventListener('blur', () => stop(card));
  }
  return card;
}
export function unobserve(cards) { if (io) for (const c of cards) io.unobserve(c); for (const c of cards) stop(c); }
