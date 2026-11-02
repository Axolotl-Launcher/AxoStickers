// 一张表情的舞台：水面、气泡、波纹、水花、美西螈图层、立体字和特效图层（engine/axl.py 的 Sticker / Ax）。
import {
  E, K, W, H, FPS, YAW, PITCH, BOX, mod, rng, strHash, clamp, bump, easeOut, easeIn, easeIO, easeOutBack, elastic,
  headWorld, itemXf, xfPoint, projectBox,
} from './core.js';
import { layout, charSprite, star, sq, polygon, line } from './draw.js';

export class Ax {
  constructor() {
    this.pose = structuredClone(E.rest);
    this.yaw = YAW; this.pitch = PITCH;
    this.dx = 0; this.dy = 0; this.sx = 1; this.sy = 1; this.roll = 0; this.zoom = 1;
    this.show = true; this.alpha = 1; this.gray = 0; this.rgb = 0;
  }
}

function affine(a) {                                       // 盒子像素 -> 画布像素：[m00, m10, m01, m11, ox, oy]
  const r = -a.roll * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  const m00 = c * a.sx, m01 = -s * a.sy, m10 = s * a.sx, m11 = c * a.sy;
  const ox = K.BOX_CX + a.dx - (m00 * BOX / 2 + m01 * BOX / 2), oy = K.BOX_CY + a.dy - (m10 * BOX / 2 + m11 * BOX / 2);
  return [m00, m10, m01, m11, ox, oy];
}

const layerCanvas = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const TEXT_LOOP = new Set(['stay', 'wave', 'bounce', 'shake', 'shiver', 'pulse', 'droop', 'swing', 'zoom', 'spin']);

export class Sticker {
  static T = 3.2;
  constructor(spec, renderer) {
    this.spec = spec;
    this.R = renderer;
    this.text = spec.text || '';
    this.style = spec.style || 'pink';
    this.tmode = spec.tmode || 'stay';
    this.T = spec.T || Sticker.T;
    this.textY = spec.text_y || 118;
    this.water = true; this.calm = 1; this.coverT = null;
    this.rnd = rng(spec.seed ?? (strHash(this.text) & 0xffff));
    this.N = Math.round(this.T * FPS);
    this.droplets = []; this.fx = [];
    const r = this.rnd;
    this.bubbles = Array.from({ length: 8 }, () => ({ x: r.uniform(150, 360), ph: r.random(), sp: r.uniform(90, 150), s: r.choice([6, 8, 10]) }));
    this.twk = Array.from({ length: 6 }, () => ({
      x: r.uniform(30, 482), y: r.uniform(200, 330), ph: r.uniform(0, 6.28), r: r.uniform(6, 10),
      c: r.choice([[255, 205, 60], [255, 140, 190], [130, 210, 255]]),
    }));
    this.lay = this.text ? layout(this.text, this.textY) : [];
    this.LAST = null; this.A = null;
    this.rippleOn = true; this.rippleDx = 0;
    this.layer = layerCanvas(); this.lip = layerCanvas();
  }

  get coverK() { return null; }                           // 子类覆盖：封面取在循环的哪个位置

  // ---- loop helpers ----
  ls(t, n, ph = 0) { return Math.sin(2 * Math.PI * n * t / this.T + ph); }
  lc(t, n, ph = 0) { return Math.cos(2 * Math.PI * n * t / this.T + ph); }
  ph(t, n = 1, off = 0) { return mod(t * n / this.T + off, 1); }

  splash(t0, x = 0, n = 18, power = 1, spread = 90) {
    const r = rng(Math.floor(t0 * 1000) + Math.trunc(x) * 7 + n);
    for (let i = 0; i < n; i++) {
      const ang = r.uniform(200 * Math.PI / 180, 340 * Math.PI / 180), sp = r.uniform(140, 330) * power;
      this.droplets.push({
        t0, x: W / 2 + x + r.uniform(-spread, spread), vx: Math.cos(ang) * sp * 0.7, vy: Math.sin(ang) * sp,
        s: r.choice([7, 9, 11, 13]), c: r.choice([[150, 215, 255], [200, 236, 255], [255, 255, 255]]),
      });
    }
  }

  motion(t) { const a = new Ax(); this.idle(a, t); return a; }

  idle(a, t, { look = 20, gill = 1, tail = 1, paddle = 1, bob = 4 } = {}) {
    const p = a.pose;
    p.head = { rot: [look + 3 * this.ls(t, 4), 4 * this.ls(t, 2), 0] };
    const gw = 8 + 12 * gill * this.ls(t, 6);
    p.left_gills = { rot: [0, gw, 0] }; p.right_gills = { rot: [0, -gw, 0] };
    p.top_gills = { rot: [-0.6 * gw, 0, 0] };
    p.tail = { rot: [-18, 18 * tail * this.ls(t, 3), 0] };
    p.root = { rot: [8, 0, 0] };
    for (const [k, s] of [['leg3', 1], ['leg4', -1], ['leg1', -1], ['leg2', 1]]) {
      p[k].rot = [0, s * 10 * paddle * this.ls(t, 4, k === 'leg1' || k === 'leg2' ? 1 : 0), 0];
    }
    a.dy = bob * this.ls(t, 2);
    return a;
  }

  hold(a, kind, { x = 4.8, y = 7.4, z = -13.0, rz = -10, s = 1.0, legs = 1.0, ...kw } = {}) {
    const it = { kind, x, y, z, rz, s, ...kw };
    (a.pose._items ||= []).push(it);
    if (legs) {
      for (const k of ['leg3', 'leg4']) {
        const r = a.pose[k].rot || [0, 0, 0];
        a.pose[k].rot = [r[0] - 35 * legs, r[1] * (1 - legs), r[2]];
      }
    }
    return it;
  }
  wear(a, kind, kw = {}) { const it = { kind, ...kw }; (a.pose._items ||= []).push(it); return it; }

  textXf(i, n, t) {                                       // [dx, dy, scale, rot, visible]
    const m = this.tmode, ls = (tt, nn, ph) => this.ls(tt, nn, ph);
    switch (m) {
      case 'stay': return [0, 5 * ls(t, 4, -i * 0.9), 1 + 0.03 * ls(t, 4, -i * 0.9), 2.5 * ls(t, 3, i), true];
      case 'wave': return [0, 10 * ls(t, 2, -i * 1.1), 1, 6 * ls(t, 2, -i * 1.1 + 1.5), true];
      case 'bounce': {
        const k = mod(this.ph(t, 2) - i * 0.1, 1);
        const hop = k < 0.28 ? -26 * bump(k / 0.28) : 0;
        const s = k >= 0.28 && k < 0.4 ? 1 + 0.06 * bump((k - 0.28) / 0.12) : 1;
        return [0, hop, s, 0, true];
      }
      case 'shake': return [3.5 * ls(t, 24, i * 2.1), 3 * ls(t, 18, i * 1.3), 1, 2 * ls(t, 12, i), true];
      case 'shiver': return [2.5 * ls(t, 30, i * 1.7), 0, 1, 0, true];
      case 'pulse': { const b = Math.exp(-this.ph(t, 4) * 7); return [0, 0, 1 + 0.10 * b, 0, true]; }
      case 'droop': return [0, 4 * i + 4 * ls(t, 2, -i * 0.6), 1, -4 - 3 * i + 2 * ls(t, 2, -i * 0.6), true];
      case 'swing': {
        const ang = 5 * ls(t, 2, 0), x = this.lay[i][1];
        return [0, -(x - W / 2) * Math.sin(ang * Math.PI / 180), 1, ang, true];
      }
      case 'spin': {
        const k = mod(this.ph(t, 1) - i * 0.08, 1);
        return [0, k < 0.35 ? -10 * bump(k / 0.35) : 0, 1, k < 0.35 ? -360 * easeIO(k / 0.35) : 0, true];
      }
      case 'zoom': { const b = Math.exp(-this.ph(t, 2) * 6); return [3 * ls(t, 20, i) * b, 0, 1 + 0.16 * b, 0, true]; }
      case 'pop': case 'type': {
        const tt = t - (0.15 + i * (m === 'pop' ? 0.14 : 0.22));
        if (tt <= 0) return [0, 0, 0, 0, false];
        const te = (t - (this.T - 0.45) - (n - 1 - i) * 0.04) / 0.25;
        if (te >= 1) return [0, 0, 0, 0, false];
        let sc, rot = 0, dy = 0;
        if (m === 'pop') {
          sc = tt < 0.55 ? elastic(tt / 0.55) : 1 + 0.04 * Math.sin(tt * 7);
          rot = (1 - easeOut(tt / 0.4)) * (i % 2 ? -28 : 28);
          dy = -(1 - easeOutBack(tt / 0.45)) * 100;
        } else sc = easeOutBack(tt / 0.2, 3);
        if (te > 0) sc *= 1 + 0.25 * Math.sin(te * Math.PI) - te ** 2;
        return [0, dy, Math.max(0.01, sc), rot, true];
      }
      case 'slam': {
        const tt = t - (0.1 + i * 0.12);
        if (tt <= 0) return [0, 0, 0, 0, false];
        const te = (t - (this.T - 0.35)) / 0.25;
        if (te >= 1) return [0, 0, 0, 0, false];
        const dy = tt < 0.18 ? -(1 - easeIn(tt / 0.18)) * 220 : 0;
        let sc = tt >= 0.18 ? 1 + 0.18 * bump((tt - 0.18) / 0.15) : 1;
        if (te > 0) sc *= 1 - easeIn(te);
        return [0, dy, Math.max(0.01, sc), 0, true];
      }
      default: return [0, 0, 1, 0, true];
    }
  }

  coverTime() {
    if (this.coverT !== null) return this.coverT;
    if (this.coverK !== null && TEXT_LOOP.has(this.tmode)) return this.coverK * this.T;
    const n = this.lay.length;
    if (this.tmode === 'pop') return Math.min(this.T - 0.6, 0.15 + (n - 1) * 0.14 + 0.7);
    if (this.tmode === 'type') return Math.min(this.T - 0.6, 0.15 + (n - 1) * 0.22 + 0.4);
    if (this.tmode === 'slam') return Math.min(this.T - 0.5, 0.1 + (n - 1) * 0.12 + 0.5);
    return 0;
  }

  waterY(x, t) {
    return this.wl + this.calm * (5 * Math.sin(x / 38 + 2 * Math.PI * 3 * t / this.T) + 3 * Math.sin(x / 17 - 2 * Math.PI * 4 * t / this.T));
  }

  drawSky() {} drawBack() {} drawFront() {} drawTop() {}

  // ---- 投影（这一帧画过美西螈之后才有效） ----
  toCanvas(bx, by) { const [a, b, c, d, e, f] = affine(this.A); return [a * bx + c * by + e, b * bx + d * by + f]; }
  proj(p) { const [bx, by] = projectBox(this.LAST, p); return this.toCanvas(bx, by); }
  headPt(p = [0, 6.5, -7.5]) { return this.proj(xfPoint(headWorld(this.A.pose), p)); }
  eyePts() { return [this.headPt([3.6, 6.5, -10.2]), this.headPt([-3.6, 6.5, -10.2])]; }
  itemPt(idx = 0, p = [0, 0, 0]) { return this.proj(xfPoint(itemXf(this.A.pose, this.A.pose._items[idx]), p)); }

  // ---- 一帧：画到 ctx（W×H） ----
  frame(ctx, t) {
    this.wl = this.waterLevel ?? K.WATER_Y;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    this.drawSky(ctx, t);
    const a = this.motion(t); this.A = a;
    let layer = null;
    if (a.show) {
      this.LAST = this.R.render(a);
      layer = this.layer;
      const g = layer.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
      g.globalAlpha = a.alpha; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      const [m00, m10, m01, m11, ox, oy] = affine(a);
      g.setTransform(m00, m10, m01, m11, ox, oy);
      g.drawImage(this.R.canvas, 0, 0, BOX, BOX);
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
      if (a.gray > 0 || a.rgb) this.tintLayer(g, a);
    }
    const poly = [];
    for (let x = -8; x < W + 16; x += 8) poly.push([x, this.waterY(x, t)]);
    const surface = poly.slice();
    poly.push([W + 8, H + 8], [-8, H + 8]);
    if (this.water) {
      polygon(ctx, poly, [170, 222, 255]);
      for (const b of this.bubbles) {
        const per = this.T / 2, tt = mod(t + b.ph * per, per), y = H + 10 - tt * b.sp * 1.2;
        if (y > this.waterY(b.x, t) + 6) {
          const x = b.x + 6 * Math.sin(tt * 8);
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(Math.round(x) + 1, Math.round(y) + 1, b.s - 1, b.s - 1);
        }
      }
      this.ripples = [];
      if (this.rippleOn) {
        const per = this.T / 2;
        for (let k = 0; k < 3; k++) {
          const tt = mod(t + k * per / 3, per), r = 40 + tt * 170 / (per / 1.6), al = Math.floor(220 * (1 - tt / per)) / 255;
          const cx = W / 2 + this.rippleDx;
          this.ripples.push([cx, this.wl + 8, r, r * 0.16, al]);
        }
      }
      this.arcs(ctx, Math.PI, 2 * Math.PI);
    }
    this.drawBack(ctx, t);
    for (const f of this.fx) f(this, ctx, t, 'back');
    if (layer) {
      if (this.water) {                                    // 水下的部分往水色偏 42%
        const g = layer.getContext('2d');
        g.globalCompositeOperation = 'source-atop';
        polygon(g, poly, [120, 190, 255], 0.42);
        g.globalCompositeOperation = 'source-over';
      }
      ctx.drawImage(layer, 0, 0);
    }
    if (this.water) {
      const lc = this.lip, g = lc.getContext('2d');
      g.clearRect(0, 0, W, H);
      polygon(g, surface.map(([x, y]) => [x, y + 14]).concat([[W + 8, H + 8], [-8, H + 8]]), [150, 210, 255], 150 / 255);
      line(g, surface, [255, 255, 255], 5, 230 / 255);
      this.arcs(g, 0, Math.PI);
      ctx.drawImage(lc, 0, 0);
    }
    for (const p of this.droplets) {
      const tt = mod(t - p.t0, this.T);
      if (tt < 1.2) {
        const x = p.x + p.vx * tt, y = this.wl + p.vy * tt + 520 * tt * tt;
        if (y < this.waterY(x, t) + 4) sq(ctx, x, y, p.s * (1 - tt / 1.6), p.c, [90, 170, 235]);
      }
    }
    this.drawFront(ctx, t);
    for (const f of this.fx) f(this, ctx, t, 'front');
    this.drawText(ctx, t);
    this.drawTop(ctx, t);
    for (const f of this.fx) f(this, ctx, t, 'top');
    ctx.restore();
  }

  arcs(g, a0, a1) {
    for (const [cx, cy, rx, ry, al] of this.ripples || []) {
      if (rx <= 2 || ry <= 2) continue;
      g.beginPath(); g.ellipse(cx, cy, rx - 2, ry - 2, 0, a0, a1);
      g.strokeStyle = `rgba(255,255,255,${al})`; g.lineWidth = 4; g.stroke();
    }
  }

  tintLayer(g, a) {                                        // 石化变灰 / 卡顿的 RGB 错位
    const im = g.getImageData(0, 0, W, H), d = im.data;
    if (a.gray > 0) {
      for (let i = 0; i < d.length; i += 4) {
        const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
        d[i] = d[i] * (1 - a.gray) + (l * 0.62 + 58) * a.gray;
        d[i + 1] = d[i + 1] * (1 - a.gray) + (l * 0.62 + 60) * a.gray;
        d[i + 2] = d[i + 2] * (1 - a.gray) + (l * 0.62 + 68) * a.gray;
      }
    }
    if (a.rgb) {
      const src = new Uint8ClampedArray(d), s = a.rgb;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          d[i] = src[(y * W + mod(x + s, W)) * 4];
          d[i + 2] = src[(y * W + mod(x - s, W)) * 4 + 2];
        }
      }
    }
    g.putImageData(im, 0, 0);
  }

  drawText(ctx, t) {
    const n = this.lay.length;
    ctx.save();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    this.lay.forEach(([c, x, y, ch], i) => {
      const [dx, dy, sc, rot, vis] = this.textXf(i, n, t);
      if (!vis || sc < 0.03) return;
      const spr = charSprite(c, ch, this.style);
      ctx.setTransform(1, 0, 0, 1, x + dx, y + dy + 8);
      if (Math.abs(rot) > 0.05) ctx.rotate(-rot * Math.PI / 180);
      if (Math.abs(sc - 1) > 1e-3) ctx.scale(sc, sc);
      ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
    });
    ctx.restore();
  }

  twinkles(ctx, t, amt = 1, ys = null) {
    for (const s of this.twk) {
      const a = (0.5 + 0.5 * Math.sin(2 * Math.PI * 3 * t / this.T + s.ph)) * amt;
      if (a > 0.25) star(ctx, s.x, ys === null ? s.y : ys[0] + (s.y - 200) * (ys[1] - ys[0]) / 130, s.r * a, s.c);
    }
  }
}

export { clamp, easeOut, easeIn, easeIO, easeOutBack, elastic, bump };
