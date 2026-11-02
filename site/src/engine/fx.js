// 2D 特效（engine/fx.py）。每个工厂返回 f(s, ctx, t, layer)，只在自己的图层（back / front / top）上画。
import { W, H, mod, rng, strHash, clamp, bump, easeOut, easeOutBack, elastic } from './core.js';
import { icon, put, star, sq, line, ellipse, polygon, rect } from './draw.js';

const R = Math.PI / 180;

function twinkle(amt = 1) { return (s, ctx, t, lay) => { if (lay === 'top') s.twinkles(ctx, t, amt); }; }

function floaters(name, n = 4, k = 4, { src = 'head', rise = 150, spread = 60, period = null, layer = 'top', sway = 12, life = 0.75, dx = 0, dy = -30 } = {}) {
  const r = rng(strHash(name) & 0xfff);
  const off = Array.from({ length: n }, () => [r.uniform(-spread, spread), r.random(), r.uniform(0.75, 1.15)]);
  return (s, ctx, t, lay) => {
    if (lay !== layer || !s.LAST) return;
    const [hx, hy] = src === 'head' ? s.headPt() : src;
    const per = period || s.T / 2;
    off.forEach(([ox, ph, sc], i) => {
      const k_ = mod(t / per + i / n, 1);
      if (k_ > life) return;
      const u = k_ / life;
      const x = hx + dx + ox * (0.4 + 0.6 * u) + sway * Math.sin(u * 6 + i), y = hy + dy - rise * u;
      const a = clamp(u / 0.15) * clamp((1 - u) / 0.3);
      put(ctx, icon(name, k), x, y, sc * (0.6 + 0.4 * easeOutBack(u / 0.3)), 0, a);
    });
  };
}

function fall(name, n = 10, k = 4, { layer = 'top', spin = true, speed = 1, area = [0, W], stop = null } = {}) {
  const r = rng(strHash(name) & 0xff);
  const P = Array.from({ length: n }, () => ({ x: r.uniform(...area), ph: r.random(), sp: r.uniform(0.8, 1.2), r: r.uniform(-1, 1), sc: r.uniform(0.7, 1.1) }));
  const cols = [[255, 62, 140], [255, 200, 60], [90, 190, 255], [60, 200, 120], [180, 120, 255]];
  return (s, ctx, t, lay) => {
    if (lay !== layer) return;
    P.forEach((p, i) => {
      const u = mod(t / s.T * Math.round(Math.max(1, speed)) * p.sp + p.ph, 1);
      const y = -30 + u * ((stop || H) + 60), x = p.x + 18 * Math.sin(u * 8 + i);
      if (name === 'confetti') {
        const w = 10 * Math.abs(Math.cos(u * 9 + i)) + 3;
        rect(ctx, x - w / 2, y - 5, x + w / 2, y + 5, cols[i % cols.length]);
      } else put(ctx, icon(name, k), x, y, p.sc, spin ? p.r * 360 * u : 0);
    });
  };
}

function popIcon(name, k = 6, at = [60, -95], { rot = 0, sway = true, layer = 'top', head = true, beats = 2 } = {}) {
  return (s, ctx, t, lay) => {
    if (lay !== layer || (head && !s.LAST)) return;
    const [hx, hy] = head ? s.headPt() : [0, 0];
    const per = s.T / beats, u = mod(t, per) / per;
    let sc = u < 0.35 ? elastic(u / 0.35) : 1 + 0.05 * Math.sin(u * 12);
    if (u > 0.9) sc *= 1 - (u - 0.9) / 0.1 * 0.25;
    put(ctx, icon(name, k), hx + at[0], hy + at[1], sc, rot + (sway ? 8 * Math.sin(2 * Math.PI * t / s.T * 2) : 0));
  };
}

function stayIcon(name, k = 6, at = [60, -95], { bob = 6, rot = 0, layer = 'top', head = true, beat = 4 } = {}) {
  return (s, ctx, t, lay) => {
    if (lay !== layer || (head && !s.LAST)) return;
    const [hx, hy] = head ? s.headPt() : [0, 0];
    put(ctx, icon(name, k), hx + at[0], hy + at[1] + bob * s.ls(t, beat), 1 + 0.04 * s.ls(t, beat * 2), rot + 4 * s.ls(t, 2));
  };
}

function question(n = 2) {
  const spots = [[70, -100, 0], [110, -60, 18], [30, -140, -12]].slice(0, n);
  return (s, ctx, t, lay) => {
    if (lay !== 'top' || !s.LAST) return;
    const [hx, hy] = s.headPt();
    spots.forEach(([ox, oy, r], i) => {
      const u = mod(t / s.T * 2 + i * 0.3, 1);
      let sc = u < 0.3 ? elastic(u / 0.3) : 1;
      if (u > 0.85) sc *= 1 - (u - 0.85) / 0.15;
      put(ctx, icon('question', i === 0 ? 6 : 5), hx + ox, hy + oy + 4 * Math.sin(u * 9), sc, r + 6 * Math.sin(u * 7));
    });
  };
}

function exclaim(n = 1) {
  return (s, ctx, t, lay) => {
    if (lay !== 'top' || !s.LAST) return;
    const [hx, hy] = s.headPt();
    const u = mod(t / s.T * 2, 1), sc = u < 0.25 ? elastic(u / 0.25) : 1, x = hx + 70, y = hy - 105;
    for (let k = 0; k < n; k++) put(ctx, icon('exclaim', 7), x + k * 26, y - 6 * bump(u / 0.2), sc, -10 + k * 14);
    if (u < 0.4) {
      for (let j = 0; j < 5; j++) {
        const ang = (-150 + j * 30) * R, r0 = 45 + 30 * u / 0.4, r1 = r0 + 22;
        line(ctx, [[x + Math.cos(ang) * r0, y + Math.sin(ang) * r0], [x + Math.cos(ang) * r1, y + Math.sin(ang) * r1]], [255, 59, 78], 5);
      }
    }
  };
}

function shockLines() {
  return (s, ctx, t, lay) => {
    if (lay !== 'top' || !s.LAST) return;
    const [hx, hy] = s.headPt(), u = mod(t / s.T * 4, 1);
    for (let j = 0; j < 8; j++) {
      const ang = (j * 45 + 22) * R, r0 = 85 + 15 * u, r1 = r0 + 26;
      if (Math.sin(ang) > 0.5) continue;
      line(ctx, [[hx + Math.cos(ang) * r0, hy - 10 + Math.sin(ang) * r0 * 0.9], [hx + Math.cos(ang) * r1, hy - 10 + Math.sin(ang) * r1 * 0.9]], [60, 60, 70], 5);
    }
  };
}

function anger(at = [-62, -62]) {
  return (s, ctx, t, lay) => {
    if (lay !== 'top' || !s.LAST) return;
    const [hx, hy] = s.headPt(), u = mod(t / s.T * 4, 1);
    put(ctx, icon('anger', 6), hx + at[0], hy + at[1], 1 + 0.25 * Math.exp(-u * 6), 0);
  };
}

function sweat(side = 1, big = false) {
  return (s, ctx, t, lay) => {
    if (lay !== 'front' || !s.LAST) return;
    const [hx, hy] = s.headPt(), u = mod(t / s.T * 2, 1);
    put(ctx, icon('sweat', big ? 7 : 5), hx - side * 62, hy - 48 + 30 * easeOut(u), 1, 0, clamp((1 - u) / 0.3));
  };
}

function panic() {
  const r = rng(5), P = Array.from({ length: 6 }, () => [r.uniform(-1, 1), r.random()]);
  return (s, ctx, t, lay) => {
    if (lay !== 'top' || !s.LAST) return;
    const [hx, hy] = s.headPt();
    for (const [dirx, ph] of P) {
      const u = mod(t / s.T * 3 + ph, 1);
      put(ctx, icon('drop', 5), hx + dirx * 140 * u, hy - 40 - 90 * u + 160 * u * u, 1, -dirx * 40, clamp((1 - u) / 0.3));
    }
  };
}

function tears(stream = false) {
  return (s, ctx, t, lay) => {
    if (lay !== 'front' || !s.LAST) return;
    const eyes = s.eyePts();
    [1, -1].forEach((side, k) => {
      const [ex, ey] = eyes[k];
      if (stream) {
        for (let j = 0; j < 7; j++) {
          const u = mod(t / s.T * 4 + j / 7, 1);
          sq(ctx, ex + side * (70 * u), ey + 8 - 40 * u + 120 * u * u, 10 - 4 * u, [124, 200, 255], [60, 140, 220]);
        }
      } else {
        for (let j = 0; j < 2; j++) {
          const u = mod(t / s.T * 2 + j * 0.5, 1);
          put(ctx, icon('drop', 4), ex + side * 6, ey + 12 + 70 * u * u, 1, 0, clamp((1 - u) / 0.3));
        }
      }
    });
  };
}

function rain(cloud = 'dark') {
  const r = rng(9), D = Array.from({ length: 9 }, () => [r.uniform(-60, 60), r.random()]);
  return (s, ctx, t, lay) => {
    if (!s.LAST) return;
    const [hx, hy] = s.headPt(), cx = hx, cy = hy - 150 + 4 * s.ls(t, 2);
    if (lay === 'back') {
      for (const [ox, ph] of D) {
        const u = mod(t / s.T * 4 + ph, 1), x = cx + ox, y = cy + 20 + u * 160;
        line(ctx, [[x, y], [x - 4, y + 16]], [108, 170, 235], 4);
      }
    }
    if (lay === 'top') put(ctx, icon(cloud, 9), cx, cy, 1, 0);
  };
}

function bulb() {
  return (s, ctx, t, lay) => {
    if (lay !== 'top' || !s.LAST) return;
    const [hx, hy] = s.headPt(), u = mod(t / s.T * 2, 1), x = hx + 10, y = hy - 125;
    const sc = u < 0.3 ? elastic(u / 0.3) : 1;
    if (u > 0.2) {
      for (let j = 0; j < 8; j++) {
        const ang = j * 45 * R, r0 = 52, r1 = 52 + 18 * (1 + 0.3 * Math.sin(u * 20));
        line(ctx, [[x + Math.cos(ang) * r0, y + Math.sin(ang) * r0], [x + Math.cos(ang) * r1, y + Math.sin(ang) * r1]], [255, 200, 40], 5);
      }
    }
    put(ctx, icon('bulb', 7), x, y, sc);
  };
}

function fireworks(n = 3) {
  const r = rng(11);
  const B = Array.from({ length: n }, (_, i) => ({
    x: r.uniform(70, 440), y: r.uniform(220, 320), ph: i / n, c: r.choice([[255, 62, 140], [255, 200, 60], [90, 190, 255], [60, 200, 120]]),
  }));
  return (s, ctx, t, lay) => {
    if (lay !== 'back') return;
    for (const b of B) {
      const u = mod(t / s.T + b.ph, 1);
      if (u >= 0.55) continue;
      const k = u / 0.55;
      for (let j = 0; j < 12; j++) {
        const ang = j * Math.PI / 6, rr = 55 * easeOut(k);
        sq(ctx, b.x + Math.cos(ang) * rr, b.y + Math.sin(ang) * rr + 20 * k * k, 9 * (1 - k) + 2, b.c);
      }
    }
  };
}

function dizzy(n = 3, name = 'star') {
  return (s, ctx, t, lay) => {
    if ((lay !== 'back' && lay !== 'top') || !s.LAST) return;
    const [hx, hy] = s.headPt([0, 10, -7.5]);
    for (let i = 0; i < n; i++) {
      const a = 2 * Math.PI * (t / s.T * 2 + i / n);
      if ((lay === 'top') !== (Math.sin(a) > 0)) continue;
      put(ctx, icon(name, 4), hx + 70 * Math.cos(a), hy - 18 + 16 * Math.sin(a), 0.8 + 0.25 * Math.sin(a), 0);
    }
  };
}

function orbit(name, n = 3, r = [150, 40], k = 4, cy = 0, speed = 1) {
  return (s, ctx, t, lay) => {
    if ((lay !== 'back' && lay !== 'top') || !s.LAST) return;
    const [hx, hy] = s.headPt();
    for (let i = 0; i < n; i++) {
      const a = 2 * Math.PI * (t / s.T * speed + i / n);
      if ((lay === 'top') !== (Math.sin(a) > 0)) continue;
      put(ctx, icon(name, k), hx + r[0] * Math.cos(a), hy + cy + r[1] * Math.sin(a), 0.75 + 0.3 * Math.sin(a), 0);
    }
  };
}

function steam() {
  return (s, ctx, t, lay) => {
    if (lay !== 'top' || !s.LAST) return;
    const [hx, hy] = s.headPt([0, 9, -7.5]);
    for (const side of [-1, 1]) {
      for (let j = 0; j < 3; j++) {
        const u = mod(t / s.T * 4 + j / 3 + (side > 0 ? 0.5 : 0), 1);
        sq(ctx, hx + side * (40 + 40 * u), hy - 20 - 70 * u, 10 + 16 * u, [255, 255, 255], [190, 196, 210], 3);
      }
    }
  };
}

function gloom() {
  return (s, ctx, t, lay) => {
    if (lay !== 'back') return;
    for (let j = 0; j < 7; j++) {
      const x = 120 + j * 46 + 6 * Math.sin(j), y0 = 190 + 10 * Math.sin(j * 1.3) + 8 * s.ls(t, 2, j);
      line(ctx, [[x, y0], [x, y0 + 70 + 20 * Math.sin(j * 2.1)]], [150, 130, 210], 5);
    }
  };
}

function sparkles(n = 6, area = [70, 180, 440, 400]) {
  const r = rng(21), P = Array.from({ length: n }, () => [r.uniform(area[0], area[2]), r.uniform(area[1], area[3]), r.random(), r.uniform(8, 14)]);
  return (s, ctx, t, lay) => {
    if (lay !== 'top') return;
    for (const [x, y, ph, rr] of P) {
      const a = Math.max(0, Math.sin(2 * Math.PI * (t / s.T * 2 + ph)));
      if (a > 0.1) star(ctx, x, y, rr * a, [255, 214, 64]);
    }
  };
}

function speed(dirx = 1, n = 7) {
  const r = rng(4), L = Array.from({ length: n }, () => [r.uniform(220, 400), r.random(), r.uniform(60, 140)]);
  return (s, ctx, t, lay) => {
    if (lay !== 'back') return;
    for (const [y, ph, ln] of L) {
      const u = mod(t / s.T * 4 + ph, 1), x = dirx > 0 ? W + 40 - u * (W + 200) : -40 + u * (W + 200);
      line(ctx, [[x, y], [x + ln * dirx, y]], [190, 200, 215], 5);
    }
  };
}

function fire() {
  const r = rng(8), P = Array.from({ length: 9 }, () => [r.uniform(80, 430), r.random(), r.uniform(0.7, 1.2)]);
  return (s, ctx, t, lay) => {
    if (lay !== 'back') return;
    for (const [x, ph, sc] of P) {
      const u = mod(t / s.T * 3 + ph, 1);
      put(ctx, icon('flame', 7), x + 8 * Math.sin(u * 7), 380 - 140 * u, sc * (1 - 0.6 * u), 0, clamp((1 - u) / 0.4));
    }
  };
}

function sun() {
  return (s, ctx, t, lay) => {
    if (lay !== 'back') return;
    const x = 440, y = 230;
    for (let j = 0; j < 12; j++) {
      const ang = (j * 30 + 15 * t / s.T * 4) * R;
      line(ctx, [[x + Math.cos(ang) * 44, y + Math.sin(ang) * 44], [x + Math.cos(ang) * 62, y + Math.sin(ang) * 62]], [255, 200, 60], 6);
    }
    ellipse(ctx, x - 36, y - 36, x + 36, y + 36, [255, 210, 70], [240, 160, 30], 4);
  };
}

function moon() {
  return (s, ctx, t, lay) => {
    if (lay !== 'back') return;
    put(ctx, icon('moon', 9), 445, 235, 1, 0);
    for (const [x, y, ph] of [[60, 230, 0], [100, 300, 2], [400, 320, 4], [30, 330, 1]]) {
      const a = 0.5 + 0.5 * Math.sin(2 * Math.PI * t / s.T * 2 + ph);
      star(ctx, x, y, 9 * a + 3, [255, 214, 64]);
    }
  };
}

function blushLines() {
  return (s, ctx, t, lay) => {
    if (lay !== 'front' || !s.LAST) return;
    const eyes = s.eyePts();
    [1, -1].forEach((side, k) => {
      const x = eyes[k][0] - side * 2, y = eyes[k][1] + 22;
      for (let j = 0; j < 3; j++) line(ctx, [[x - 12 + j * 9, y + 6], [x - 6 + j * 9, y - 6]], [255, 80, 140], 3);
    });
  };
}

function check(name = 'check', k = 9, at = [330, 270]) {
  return (s, ctx, t, lay) => {
    if (lay !== 'top') return;
    const u = mod(t / s.T, 1), sc = u < 0.25 ? elastic(u / 0.25) : 1 + 0.03 * Math.sin(u * 20);
    put(ctx, icon(name, k), at[0], at[1], sc, -8);
  };
}

function boom(at = null, period = 1) {
  const r = rng(13), P = Array.from({ length: 14 }, () => [r.uniform(0, 2 * Math.PI), r.uniform(60, 140), r.choice([10, 14, 18])]);
  return (s, ctx, t, lay) => {
    if (lay !== 'top') return;
    const [cx, cy] = at || [W / 2, 330], u = mod(t / s.T * period, 1);
    if (u >= 0.45) return;
    const k = u / 0.45, rr = 30 + 70 * easeOut(k);
    if (k < 0.35) ellipse(ctx, cx - rr, cy - rr, cx + rr, cy + rr, [255, 230, 120]);
    for (const [ang, sp, sz] of P) {
      sq(ctx, cx + Math.cos(ang) * sp * easeOut(k), cy + Math.sin(ang) * sp * easeOut(k) * 0.8, sz * (1 - 0.5 * k),
        k < 0.4 ? [255, 140, 40] : [170, 170, 180], [90, 90, 100], 2);
    }
  };
}

function bubbles(n = 5) {
  return (s, ctx, t, lay) => {
    if (lay !== 'top' || !s.LAST) return;
    const [mx, my] = s.headPt([0, 5, -10.2]);
    for (let j = 0; j < n; j++) {
      const u = mod(t / s.T * 2 + j / n, 1);
      const x = mx + 20 + 18 * Math.sin(u * 7 + j) + 30 * u, y = my - 20 - 170 * u, r = 6 + 16 * u * (0.6 + 0.4 * (j % 2));
      ellipse(ctx, x - r, y - r, x + r, y + r, null, [110, 190, 255], 3);
      rect(ctx, x - r * 0.5, y - r * 0.55, x - r * 0.5 + 4, y - r * 0.55 + 4, [255, 255, 255]);
    }
  };
}

function ghost() {
  return (s, ctx, t, lay) => {
    if (lay !== 'top' || !s.LAST) return;
    const [hx, hy] = s.headPt([0, 9, -7.5]), u = mod(t / s.T, 1);
    put(ctx, icon('ghost', 6), hx + 20 * Math.sin(u * 9), hy - 30 - 140 * u, 0.7 + 0.4 * u, 6 * Math.sin(u * 12), clamp(u / 0.1) * clamp((1 - u) / 0.3));
  };
}

function speechBubble(ctx, x, y, r) {
  ctx.beginPath(); ctx.roundRect(x - r, y - r * 0.85, 2 * r, 1.7 * r, 22);
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = 'rgb(60,62,76)'; ctx.lineWidth = 4; ctx.stroke();
}

function dots() {
  return (s, ctx, t, lay) => {
    if (lay !== 'top' || !s.LAST) return;
    const [hx, hy] = s.headPt(), x = hx + 95, y = hy - 100;
    ctx.beginPath(); ctx.roundRect(x - 58, y - 32, 116, 64, 22);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = 'rgb(60,62,76)'; ctx.lineWidth = 4; ctx.stroke();
    polygon(ctx, [[x - 40, y + 28], [x - 58, y + 52], [x - 18, y + 30]], [255, 255, 255]);
    line(ctx, [[x - 40, y + 30], [x - 58, y + 52], [x - 20, y + 31]], [60, 62, 76], 4);
    const n = Math.floor(mod(t / s.T * 4, 4));
    for (let j = 0; j < 3; j++) sq(ctx, x - 28 + j * 28, y, 14, j < n ? [60, 62, 76] : [200, 202, 212]);
  };
}

function bubbleIcon(name, k = 6, side = 1) {
  return (s, ctx, t, lay) => {
    if (lay !== 'top' || !s.LAST) return;
    const [hx, hy] = s.headPt(), x = hx + side * 100, y = hy - 105 + 4 * s.ls(t, 2), sc = 1 + 0.04 * s.ls(t, 4), r = 46 * sc;
    speechBubble(ctx, x, y, r);
    const tx = x - side * 30;
    polygon(ctx, [[tx - 10, y + r * 0.8], [tx - side * 22, y + r * 0.8 + 26], [tx + 10, y + r * 0.8]], [255, 255, 255]);
    line(ctx, [[tx - 10 * side, y + r * 0.85 - 1], [tx - side * 22, y + r * 0.8 + 26], [tx + 10 * side, y + r * 0.85 - 1]], [60, 62, 76], 4);
    put(ctx, icon(name, k), x, y, sc);
  };
}

function loading() {
  return (s, ctx, t, lay) => {
    if (lay !== 'top' || !s.LAST) return;
    const [hx, hy] = s.headPt(), x = hx + 95, y = hy - 95;
    for (let j = 0; j < 8; j++) {
      const ang = 2 * Math.PI * j / 8;                      // 引擎里这层的渐隐透明度最后被丢掉了，八个方块都是实心粉
      sq(ctx, x + 30 * Math.cos(ang), y + 30 * Math.sin(ang), 12, [254, 62, 140]);
    }
  };
}

function bolt() {
  return (s, ctx, t, lay) => {
    if (lay !== 'top') return;
    const u = mod(t / s.T * 4, 1);
    if (u < 0.5) for (const [x, y, r] of [[90, 250, -10], [420, 240, 12]]) put(ctx, icon('bolt', 7), x, y, 1, r, u > 0.3 ? 1 - u * 1.5 : 1);
  };
}

function flash() {
  return (s, ctx, t, lay) => {
    if (lay !== 'top') return;
    const u = mod(t / s.T, 1) - 0.55;
    if (u >= 0 && u < 0.1) { ctx.fillStyle = `rgba(255,255,255,${(160 * (1 - u / 0.1)) / 255})`; ctx.fillRect(0, 0, W, H); }
  };
}

function zzz() {
  return (s, ctx, t, lay) => {
    if (lay !== 'top' || !s.LAST) return;
    const [hx, hy] = s.headPt([0, 9, -7.5]);
    for (let j = 0; j < 3; j++) {
      const u = mod(t / s.T + j / 3, 1);
      put(ctx, icon('z', 4 + (j % 2) + (u > 0.5 ? 1 : 0)), hx + 40 + 50 * u + 10 * Math.sin(u * 8), hy - 30 - 120 * u, 0.7 + 0.5 * u, -10,
        clamp(u / 0.1) * clamp((1 - u) / 0.25));
    }
  };
}

function notes() {
  const a = floaters('note', 3, 5, { spread: 70, rise: 120 }), b = floaters('note2', 2, 5, { spread: 80, rise: 130, dx: 40 });
  return (s, ctx, t, lay) => { a(s, ctx, t, lay); b(s, ctx, t, lay); };
}

export const FX = {
  twinkle, hearts: () => floaters('heart', 4, 4), question, exclaim, shock: shockLines, anger, sweat, panic, zzz, notes,
  tears, stream: () => tears(true), rain, bulb, confetti: () => fall('confetti', 18), fireworks, dizzy, steam, gloom,
  sparkles, speed, fire, sun, moon, blush: blushLines, coins: () => fall('money', 9, 4), snow: () => fall('snow', 10, 3),
  leaves: () => fall('leaf', 8, 4), check, cross: () => check('cross'), boom, bubbles, ghost, dots, loading, bolt, flash,
  brokenheart: () => popIcon('brokenheart', 7), plus1: () => floaters('plus1', 3, 5, { rise: 120 }),
  thumb: () => popIcon('thumb', 7, [80, -90]), flowers: () => floaters('flower', 4, 4, { spread: 90 }), stars: () => dizzy(3, 'star'),
  swirl: () => stayIcon('swirl', 6, [0, -110]), skull: () => stayIcon('skull', 6, [70, -100]),
  // 通用的（图鉴里的配方会用到）：('float', 图标, 数量, 大小) 之类
  float: (name, n, k) => floaters(name, n, k), fall: (name, n, k) => fall(name, n, k),
  pop: (name, k, at) => popIcon(name, k, at), stay: (name, k, at) => stayIcon(name, k, at),
  orbit, say: (name, k) => bubbleIcon(name, k),
};

export function makeFx(list) {
  const out = [];
  for (const e of list || []) {
    if (typeof e === 'string') { if (FX[e]) out.push(FX[e]()); }
    else if (Array.isArray(e) && FX[e[0]]) out.push(FX[e[0]](...e.slice(1)));
  }
  return out;
}
