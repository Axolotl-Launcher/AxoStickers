// 公用的小工具：配置、分类名、配方转换、提示条、懒加载 GIF。
import { detectPerf } from './perf.js';
import CAT from '../../workshop/catalog.json';

export { CAT };
export { CONTRIBUTE } from './flags.js';
export const REPO = 'Axolotl-Launcher/AxoStickers';
export const RELEASE = { url: `https://github.com/${REPO}/releases/download/v1.1.0/AxoStickers-v1.1.0.zip`, size: '260 MB' };
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
// 表情同款字体（111 个按字切开的 woff2 的 @font-face）：不挡首屏，异步载入；要在画布上用它的（首页标题）先等它
export const fontsCss = import('./gen/fonts.css').catch(() => {});

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

// ---------------- 拖出浏览器：拖进 QQ、拖到桌面 ----------------
// 下载和拖出去时的文件名：001_先看日志.gif、初代_请截图.gif、水龙卷_我没事.gif、工坊12_下班了.gif
export const gifName = (it, kind) => (kind === 'workshop' ? `工坊${it.issue}_${it.text}` : `${it.special ? it.series : it.key}_${it.text || '无字'}`);
// QQ 收拖进去的图片时会自己去下拖的那个地址：英文地址、data: 地址能收，中文地址、blob: 地址收不了（在 clawd-400 上实测过）。
// 所以表情 GIF 都是英文地址（gif/001.gif），中文名只放进 DownloadURL：Chrome / Edge 拖到桌面存成「001_先看日志.gif」。
// 卡片上拖的是静态缩略图，就把拖出去的地址换成 GIF 的，QQ 下到的才是动图；拖的本来就是这张 GIF 时只加 DownloadURL。
export function dragOut(e, url, name) {
  const abs = new URL(url, location.href).href, dt = e.dataTransfer;
  dt.setData('DownloadURL', `image/gif:${name.replace(/[\\/:*?"<>|]/g, '_')}.gif:${abs}`);
  if (e.target.currentSrc === abs) return;
  dt.setData('text/uri-list', abs);
  dt.setData('text/html', `<img src="${abs.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" alt="">`);
}

// ---------------- 卡片：先放静态缩略图；悬停（手机上停在屏幕里）就播 240px 的小视频预览（几十 KB，比 1 MB 的 GIF 快得多） ----------------
// 同时播几个按设备档位来：没有显卡加速的手机不自动播（点开大图照样能看），省流量模式也不自动播
const touch = matchMedia('(hover: none)').matches;
const playing = new Set();
const perf = detectPerf();
const MAX_PLAYING = touch ? { high: 6, mid: 4, low: 0 }[perf.tier] : { high: 9, mid: 6, low: 3 }[perf.tier];
const AUTOPLAY = touch && MAX_PLAYING > 0 && !perf.save && !perf.reduced;
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
  if (touch) { if (AUTOPLAY && io) io.observe(card); }
  else if (MAX_PLAYING) {
    card.addEventListener('pointerenter', () => play(card));
    card.addEventListener('pointerleave', () => stop(card));
    card.addEventListener('focus', () => play(card));
    card.addEventListener('blur', () => stop(card));
  }
  return card;
}
export function unobserve(cards) { if (io) for (const c of cards) io.unobserve(c); for (const c of cards) stop(c); }
