// 2D 部分：像素图标、立体字、Pillow 画图原语的 canvas 版（engine/axl.py）。
// 注意 Pillow 在 RGBA 画布上用 ImageDraw 画半透明色时是直接写像素、最后转 RGB 时 alpha 被丢掉，
// 所以引擎里直接画在主画布上的东西（星星、方块、线）实际都是不透明的；这里照着画不透明色。
import { E, W, hx, pyRound, makeCanvas } from './core.js';
import { FONT_LIST } from './fonts.js';

export const FONT = 'AxoSans';
const FAMILIES = new Map(FONT_LIST.map((f) => [f.id, f.css]));   // 字体 id -> CSS 字体名（导入的字体另外注册）
export const fontFamily = (id) => FAMILIES.get(id) || FONT;
export const hasFont = (id) => !id || FAMILIES.has(id);
export function registerFont(id, family) { FAMILIES.set(id, family); SPR.clear(); }
const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
export const rgb = (c) => css(c);
const canvas = makeCanvas;

// ---------------- icons ----------------
const ICONS = new Map();
export function icon(name, k = 5, outline = true, tint = null) {
  const key = `${name}|${k}|${outline}|${tint}`;
  if (ICONS.has(key)) return ICONS.get(key);
  const [rows, pal] = E.icon[name] || E.spr[name];
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const grid = Array.from({ length: h + 2 }, () => new Array(w + 2).fill(null));
  rows.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.' && c !== ' ') grid[y + 1][x + 1] = hx(tint || pal[c]); }));
  if (outline) {
    const base = hx(tint || Object.values(pal)[0]), dk = base.map((v) => Math.floor(v * 0.5));
    const filled = grid.map((r) => r.map((v) => !!v));
    for (let y = 0; y < h + 2; y++) {
      for (let x = 0; x < w + 2; x++) {
        if (filled[y][x]) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => filled[y + dy]?.[x + dx])) grid[y][x] = dk;
      }
    }
  }
  const c = canvas((w + 2) * k, (h + 2) * k), g = c.getContext('2d');
  grid.forEach((r, y) => r.forEach((v, x) => { if (v) { g.fillStyle = css(v); g.fillRect(x * k, y * k, k, k); } }));
  ICONS.set(key, c);
  return c;
}

// alpha_composite 一张小图，中心在 (x, y)；rot 是逆时针角度（Pillow rotate）
export function put(ctx, im, x, y, sc = 1, rot = 0, alpha = 1) {
  if (sc <= 0.02 || alpha <= 0.02) return;
  const w = Math.max(1, Math.floor(im.width * sc)), h = Math.max(1, Math.floor(im.height * sc));
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y);
  if (rot) ctx.rotate(-rot * Math.PI / 180);
  ctx.drawImage(im, -w / 2, -h / 2, w, h);
  ctx.restore();
}

export function star(ctx, x, y, r, col) {
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const ang = k * Math.PI / 4 - Math.PI / 2, rr = k % 2 === 0 ? r : r * 0.28;
    const px = x + rr * Math.cos(ang), py = y + rr * Math.sin(ang);
    k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath(); ctx.fillStyle = css(col); ctx.fill();
}

// Pillow rectangle：包含两端，描边往里画
export function rect(ctx, x0, y0, x1, y1, fill, outline = null, w = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const ww = x1 - x0 + 1, hh = y1 - y0 + 1;
  if (ww <= 0 || hh <= 0) return;
  if (fill) { ctx.fillStyle = css(fill); ctx.fillRect(x0, y0, ww, hh); }
  if (outline) {
    ctx.fillStyle = css(outline);
    ctx.fillRect(x0, y0, ww, Math.min(w, hh)); ctx.fillRect(x0, y1 - w + 1, ww, Math.min(w, hh));
    ctx.fillRect(x0, y0, Math.min(w, ww), hh); ctx.fillRect(x1 - w + 1, y0, Math.min(w, ww), hh);
  }
}
export function sq(ctx, x, y, s, fill, outline = null, w = 2) { rect(ctx, x - s / 2, y - s / 2, x + s / 2, y + s / 2, fill, outline, w); }

export function line(ctx, pts, col, width, alpha = 1) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = css(col, alpha); ctx.lineWidth = width; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; ctx.stroke();
}
export function ellipse(ctx, x0, y0, x1, y1, fill, outline = null, w = 1, a0 = 0, a1 = 360, alpha = 1) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
  if (rx <= 0 || ry <= 0) return;
  if (fill) { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = css(fill, alpha); ctx.fill(); }
  if (outline && rx > w / 2 && ry > w / 2) {
    ctx.beginPath(); ctx.ellipse(cx, cy, rx - w / 2, ry - w / 2, 0, a0 * Math.PI / 180, a1 * Math.PI / 180);
    ctx.strokeStyle = css(outline, alpha); ctx.lineWidth = w; ctx.stroke();
  }
}
export function polygon(ctx, pts, fill, alpha = 1) {
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.fillStyle = css(fill, alpha); ctx.fill();
}

// ---------------- 立体字 ----------------
const MEASURE = canvas(8, 8).getContext('2d');
const fontCss = (sz, font) => `900 ${sz}px ${fontFamily(font)}`;
export function textLength(c, sz, font) { MEASURE.font = fontCss(sz, font); return MEASURE.measureText(c).width; }
const isWide = (c) => c.codePointAt(0) > 0x2e80;
const units = (line, font) => [...line].reduce((s, c) => s + (isWide(c) ? 1 : (textLength(c, 100, font) + 14) / 100), 0);
function size(u) {
  const xs = [1, 2, 3, 4, 5, 6], ys = [190, 160, 138, 112, 92, 80];
  u = Math.max(1, Math.min(6, u));
  for (let i = 0; i < 5; i++) if (u <= xs[i + 1]) return ys[i] + (ys[i + 1] - ys[i]) * (u - xs[i]);
  return ys[5];
}
// 返回 [[字, x, y, 字号], ...]，一行或两行；scale 整体放大缩小，dx 整体左右挪，font 字体 id
export function layout(text, y0 = 118, scale = 1, dx = 0, font = 'axo') {
  let lines = text.includes('/') ? text.split('/') : [text];
  if (lines.length === 1 && units(text, font) > 5.3) {
    const cs = [...text];
    let best = 1, bv = Infinity;
    for (let k = 1; k < cs.length; k++) {
      const v = Math.abs(units(cs.slice(0, k).join(''), font) - units(cs.slice(k).join(''), font)) + (cs[k - 1] < '\x80' && cs[k] < '\x80' ? 9 : 0);
      if (v < bv) { bv = v; best = k; }
    }
    lines = [cs.slice(0, best).join(''), cs.slice(best).join('')];
  }
  let ch = size(Math.max(...lines.map((ln) => units(ln, font))));
  if (lines.length === 2) ch = Math.min(ch, 104);
  ch *= scale;
  const out = [];
  lines.forEach((line, li) => {
    const cs = [...line];
    const adv = cs.map((c) => (isWide(c) ? ch + 2 : textLength(c, Math.floor(ch), font) + ch * 0.14));
    let x = W / 2 + dx - adv.reduce((a, b) => a + b, 0) / 2;
    const y = lines.length === 1 ? y0 : y0 - 52 * scale + li * (ch + 18 * scale);
    cs.forEach((c, k) => { out.push([c, x + adv[k] / 2, y, Math.floor(ch)]); x += adv[k]; });
  });
  return out;
}

// 字色：内置的名字（pink blue…），或者 #rrggbb 自己挑的颜色：深一档做描边、更深的做厚度、浅的做渐变
export function styleColors(style) {
  if (E.styles[style]) return E.styles[style].map(hx);
  const m = /^#?([0-9a-f]{6})$/i.exec(style || '');
  if (!m) return E.styles.pink.map(hx);
  const c = hx(m[1]), mix = (k, to) => c.map((v, i) => Math.round(v + (to[i] - v) * k));
  return [c, mix(0.3, [0, 0, 0]), mix(0.68, [0, 0, 0]), mix(0.82, [255, 255, 255])];
}
const SPR = new Map();
export function charSprite(c, ch, style = 'pink', font = 'axo') {
  const key = `${c}|${ch}|${style}|${font}`;
  if (SPR.has(key)) return SPR.get(key);
  const [HOT, DEEP, PLUM, TINT] = styleColors(style);
  const s1 = Math.max(6, pyRound(ch * 0.134)), s2 = Math.max(4, pyRound(ch * 0.09)), dep = Math.max(4, pyRound(ch * 0.08));
  const pad = Math.floor(ch * 0.36), sz = ch + 2 * pad;
  const cv = canvas(sz, sz + 20), g = cv.getContext('2d');
  g.font = fontCss(ch, font); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  const m = g.measureText(c);
  const base = (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;   // Pillow anchor 'mm'：上下沿的正中
  const cx = sz / 2, cy = sz / 2 + base;
  const glyph = (x, y, fill, sw, stroke) => {
    if (sw) { g.lineWidth = sw * 2; g.strokeStyle = css(stroke); g.strokeText(c, x, y); }
    g.fillStyle = css(fill); g.fillText(c, x, y);
  };
  for (let k = dep; k > 0; k--) glyph(cx + k * 0.6, cy + k, PLUM, s1, PLUM);
  glyph(cx, cy, DEEP, s1, DEEP);
  glyph(cx, cy, HOT, s2, HOT);
  glyph(cx, cy, [255, 255, 255], 0);
  const tc = canvas(sz, sz + 20), tg = tc.getContext('2d');              // 只在白色字面上叠一层往下变粉的渐变
  tg.font = g.font; tg.textAlign = 'center'; tg.textBaseline = 'alphabetic';
  tg.fillStyle = '#000'; tg.fillText(c, cx, cy);
  tg.globalCompositeOperation = 'source-in';
  const gr = tg.createLinearGradient(0, 0, 0, sz + 20);
  gr.addColorStop(0, css(TINT, 0)); gr.addColorStop(1, css(TINT, 0.75));
  tg.fillStyle = gr; tg.fillRect(0, 0, sz, sz + 20);
  g.drawImage(tc, 0, 0);
  SPR.set(key, cv);
  return cv;
}

export async function loadFont(text, font = 'axo') {
  const fonts = globalThis.document?.fonts || globalThis.fonts;
  if (!fonts) return;
  try { await fonts.load(fontCss(100, font), text || '美西螈'); } catch { /* 字体没加载上就用系统字体 */ }
}
