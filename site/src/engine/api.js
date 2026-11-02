// 组件脚本里直接能用的东西（不用 import）。改这里的名字会影响所有组件，只加不改。
import {
  E, K, W, H, FPS, YAW, PITCH, clamp, lerp, easeOut, easeIn, easeIO, easeOutBack, elastic, bump, win, mod, rng, strHash,
  rootM, headWorld, xfPoint, hx, rotVec, makeCanvas,
} from './core.js';
import { icon, put, star, sq, rect, line, ellipse, polygon } from './draw.js';
import { Ax } from './ax.js';

export { Ax };

export { W, H, FPS, YAW, PITCH, clamp, lerp, easeOut, easeIn, easeIO, easeOutBack, elastic, bump, win, mod, rng, strHash, rootM, headWorld, xfPoint, rotVec, makeCanvas };
export { icon, put, star, sq, rect, line, ellipse, polygon };

export const PI = Math.PI;
export const { sin, cos, abs, exp, sqrt, floor, round, min, max, atan2, hypot, sign } = Math;
export const LEGS = ['leg1', 'leg2', 'leg3', 'leg4'];
export const GILLS = [['left_gills', 1], ['right_gills', -1]];
export const BONES = ['head', 'top_gills', 'left_gills', 'right_gills', 'body', 'leg1', 'leg2', 'leg3', 'leg4', 'tail'];
export const FACES = E.faces;
export const SPRITES = E.spr;
export const SPR_S = K.SPR_S;
export const propScale = (kind) => (E.spr[kind] ? K.SPR_S : 0.9);
export const hex = hx;

// 给骨骼加一点旋转（度）：addrot(a, 'head', x, y, z)
export function addrot(a, bone, x = 0, y = 0, z = 0) {
  const r = a.pose[bone]?.rot || [0, 0, 0];
  (a.pose[bone] ||= {}).rot = [r[0] + x, r[1] + y, r[2] + z];
}
const LEGR = {
  leg3: [[[80, -55, 0], [0, -1.5, 0]], [[120, 40, -60], [1.5, 0, -3]]],
  leg4: [[[80, 55, 0], [0, -1.5, 0]], [[120, -40, 60], [-1.5, 0, -3]]],
};
// 前腿在「放下」和「举起」之间插值：legmix(a, 'leg3', 0..1)
export function legmix(a, name, k, extra = [0, 0, 0]) {
  const [[r, rm], [u, um]] = LEGR[name];
  a.pose[name] = { set: [0, 1, 2].map((i) => lerp(r[i], u[i], k) + extra[i]), move: [0, 1, 2].map((i) => lerp(rm[i], um[i], k)) };
}

// 颜色：皮肤组件常用
export function rgb2hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
export function hsl2rgb([h, s, l]) {
  h = ((h % 360) + 360) % 360 / 360;
  if (!s) return [l * 255, l * 255, l * 255].map(Math.round);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = ((t % 1) + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255));
}
const toHex = (c) => c.map((v) => v.toString(16).padStart(2, '0')).join('');
const parseColor = (c) => hx(String(c || '#ffffff').replace('#', '').padEnd(6, '0'));
const REF = { body: rgb2hsl(hx('fdb8db')), gill: rgb2hsl(hx('fe3e8c')), dark: rgb2hsl(hx('d673a2')), tail: rgb2hsl(hx('e2427f')) };
// 皮肤用：按部位把原版粉色换成 {body, gill, dark} 三个颜色，原来的深浅关系保留；眼睛、嘴、道具不动
export function recolor(rgb, part, { body = '#fdb8db', gill = '#fe3e8c', dark = '#d673a2' } = {}) {
  if (part === 'item') return rgb;
  const k = toHex(rgb);
  if (k === '42147a') return rgb;                                     // 眼睛
  let group;
  if (part === 'face') { if (k !== 'fdb8db' && k !== 'f98ec2') return rgb; group = 'body'; }   // 表情里「擦掉原来五官」用的肤色
  else if (part.includes('gills')) group = 'gill';
  else if (part === 'tail') group = 'tail';
  else if (part.startsWith('leg')) group = 'dark';
  else group = 'body';
  const target = rgb2hsl(parseColor(group === 'tail' ? gill : group === 'gill' ? gill : group === 'dark' ? dark : body));
  const [h, s, l] = rgb2hsl(rgb), [rh, rs, rl] = REF[group];
  return hsl2rgb([target[0] + (h - rh), clamp(target[1] * (rs ? s / rs : 1), 0, 1), clamp(target[2] * l / rl, 0.04, 0.97)]);
}
