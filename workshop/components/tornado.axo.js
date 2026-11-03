/* @axo {"id":"tornado","type":"scene","name":"水龙卷","author":"Axolotl-Launcher","version":"1.0.0","description":"水面整个卷起来，美西螈一脸平静地被卷着翻滚，顺便卷着几样道具一起转。图鉴里水龙卷特别篇的组件版（道具换成了自己的体素道具，不用 Minecraft 材质）。"} */
// 场景组件：有 render(ctx, t) 就接管整帧（水、美西螈、道具、字都自己画）。
// 移植自 engine/tornado.py：龙卷和底下的水是同一块水，同一条白色水线一路爬上龙卷边缘。
component({
  id: 'tornado', type: 'scene', name: '水龙卷',
  params: {
    items: { label: '卷着的东西（逗号分开）', type: 'text', default: 'bucket,fish,tnt,diamond' },
    laps: { label: '美西螈一圈转几圈', type: 'int', min: 1, max: 6, default: 3 },
    tumble: { label: '翻滚', type: 'number', min: 0, max: 2, step: 0.05, default: 1 },
    width: { label: '龙卷粗细', type: 'number', min: 0.6, max: 1.5, step: 0.05, default: 1 },
  },
  setup() {
    const st = this.stage, r = rng(11);
    this.lo = st.texts.some((x) => x.lay.length);                   // 有字：龙卷矮一点，给字让位置
    this.wl = st.waterLevel;
    this.top = this.lo ? 60 : -40;
    this.az = this.lo ? 0.58 : 0.68;
    this.orb = this.lo ? [300, 22, 10, 10] : [212, 42, 16, 10];        // 中心高度、摆幅、前后起伏、离龙卷壁的距离
    const kinds = String(this.p.items).split(/[,，\s]+/).filter(Boolean).slice(0, 6);
    const slots = this.lo
      ? [[236, 10, 64, 2, 0.15, [2, 1, 1]], [352, 8, 58, 2, 0.62, [1, 2, 1]], [330, 12, 84, 1, 0.4, [1, 1, 2]], [280, 9, 70, 1, 0.85, [1, 1, 1]]]
      : [[92, 20, 84, 2, 0.15, [2, 1, 1]], [130, 16, 124, 1, 0.62, [1, 1, 2]], [352, 10, 74, 2, 0.7, [1, 2, 1]], [300, 14, 132, 1, 0.1, [1, 2, 1]]];
    this.debris = kinds.map((kind, i) => [kind, ...slots[i % slots.length]]);
    this.bub = Array.from({ length: 14 }, () => ({ th: r.uniform(0, 2 * PI), ph: r.random(), s: r.choice([6, 8, 10]) }));
    this.fling = Array.from({ length: 16 }, () => ({ ph: r.random(), u: r.uniform(0.15, 0.85), side: r.choice([-1, 1]), v: r.uniform(150, 260), s: r.choice([7, 9, 11]) }));
    this.spray = Array.from({ length: 30 }, () => ({ th: r.uniform(0, 2 * PI), ph: r.random(), v: r.uniform(70, 160), up: r.uniform(180, 300), s: r.choice([7, 9, 11, 13]) }));
    this.wind = Array.from({ length: 6 }, () => ({ u: r.uniform(0.1, 0.8), ph: r.random(), L: r.uniform(0.7, 1.2), gap: r.uniform(16, 40) }));
    this.back = makeCanvas(W, H); this.tmp = makeCanvas(W, H);
  },

  // ---------------- 形状 ----------------
  u(y) { return clamp((y - this.top) / (this.wl - this.top)); },
  r(y, t = 0) {
    const u = this.u(y), core = (24 + 166 * (1 - u) ** 1.7) * this.p.width, flare = 66 * exp(-Math.max(0, this.wl - y) / 20);
    return (core + flare) * (1 + 0.035 * sin(2 * PI * 3 * t / this.T + 6 * u));
  },
  cx(y, t) { const u = this.u(y); return W / 2 + 40 * (1 - u) ** 1.2 * sin(2 * PI * 0.85 * u - 2 * PI * 2 * t / this.T) + 10 * this.ls(t, 1); },
  spin(t) { return 2 * PI * 4 * t / this.T; },
  wy(x, t) {
    const cb = this.cx(this.wl, t);
    const base = this.wl + 5 * sin(x / 38 + 2 * PI * 3 * t / this.T) + 3 * sin(x / 17 - 2 * PI * 4 * t / this.T);
    return base + 7 * exp(-(((x - cb) / 110) ** 2)) * sin(x / 13 - 2 * PI * 6 * t / this.T);
  },
  edges(t) {
    const L = [], R = [];
    for (let y = this.top; y < this.wl - 2; y += 5) { L.push([this.cx(y, t) - this.r(y, t), y]); R.push([this.cx(y, t) + this.r(y, t), y]); }
    const l = L[L.length - 1][0] - 6, rr = R[R.length - 1][0] + 6;
    L.push([l, this.wy(l, t)]); R.push([rr, this.wy(rr, t)]);
    return [L, R];
  },
  fadeTop(c, top) {                                                 // 龙卷顶在字后面淡出去
    if (top <= 0) return;
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, top, 0, top + 60);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-in'; g.fillStyle = gr; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
  },

  // ---------------- 龙卷表面 ----------------
  bands(g, t, L) {
    const sp = this.spin(t), ys = L.slice(0, -1).map((p) => p[1]);
    for (let k = 0; k < 3; k++) {
      const a0 = 2 * PI * k / 3, rows = ys.map((y) => {
        const u = this.u(y), c = this.cx(y, t), r = this.r(y, t) - 3, a = a0 + 2 * PI * 1.5 * u + sp;
        const lo = mod(a, 2 * PI), hi = lo + 0.6, loc = Math.max(lo, 0.04), hic = Math.min(hi, PI - 0.04);
        return hic > loc ? [y, c + r * cos(hic), c + r * cos(loc)] : null;
      });
      for (let i = 0; i + 1 < rows.length; i++) {
        const [r0, r1] = [rows[i], rows[i + 1]];
        if (r0 && r1) polygon(g, [[r0[1], r0[0]], [r0[2], r0[0]], [r1[2], r1[0]], [r1[1], r1[0]]], [150, 210, 255], 205 / 255);
      }
      let seg = [];
      for (const row of [...rows, null]) {
        if (row) seg.push([row[2], row[0]]);
        else { if (seg.length > 1) line(g, seg, [255, 255, 255], 4, 220 / 255); seg = []; }
      }
    }
  },
  bubbles(g, t) {
    const sp = this.spin(t);
    g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineWidth = 2;
    for (const b of this.bub) {
      const k = mod(t / this.T * 2 + b.ph, 1), y = this.wl - 16 - k * (this.wl - Math.max(this.top, 0) - 40);
      const c = this.cx(y, t), r = this.r(y, t) * 0.7, a = b.th + sp * 0.8 + k * 5;
      if (sin(a) < 0.1) continue;
      g.strokeRect(c + r * cos(a) + 1, y + 1, b.s - 1, b.s - 1);
    }
  },
  windLines(g, t, front) {
    const sp = this.spin(t) * 0.75;
    for (const w of this.wind) {
      const y = this.top + w.u * (this.wl - this.top);
      if (y < (this.lo ? 205 : 0)) continue;
      const c = this.cx(y, t), r = this.r(y, t) + w.gap, a0 = mod(2 * PI * w.ph + sp, 2 * PI), pts = [];
      for (let i = 0; i < 10; i++) { const a = a0 + w.L * i / 9; if ((sin(a) > 0) !== front) continue; pts.push([c + r * cos(a), y + r * 0.2 * sin(a)]); }
      if (pts.length > 1) line(g, pts, [255, 255, 255], 4, front ? 1 : 140 / 255);
    }
  },
  flingDrops(g, t) {
    for (const f of this.fling) {
      const k = mod(t / this.T * 3 + f.ph, 1), y0 = this.top + f.u * (this.wl - this.top);
      if (y0 < (this.lo ? 205 : 0)) continue;
      const tt = k * 0.7, x = this.cx(y0, t) + f.side * this.r(y0, t) + f.side * f.v * tt, y = y0 - 40 * tt + 420 * tt * tt;
      if (y < this.wy(x, t)) sq(g, x, y, f.s * (1 - k * 0.6), f.s > 8 ? [255, 255, 255] : [200, 236, 255], [90, 170, 235]);
    }
  },
  sprayDrops(g, t, front) {
    const cb = this.cx(this.wl, t);
    for (const s of this.spray) {
      const k = mod(t / this.T * 2 + s.ph, 1), tt = k * 0.9, a = s.th + this.spin(t) * 0.3, vis = sin(a);
      if ((vis > 0) !== front) continue;
      const rr = 40 + s.v * tt, x = cb + rr * cos(a), y = this.wl - 6 + rr * 0.18 * vis - s.up * tt + 380 * tt * tt;
      if (y > this.wy(x, t) + 2) continue;
      sq(g, x, y, s.s * (1 - 0.5 * k), vis > 0 ? [255, 255, 255] : [220, 240, 255], [90, 170, 235]);
    }
  },
  orbitPt(t, ang, oy, ay, dz, gap) {
    const y = oy - ay * cos(ang) + dz * sin(ang);
    return [this.cx(y, t) + (this.r(y, t) + gap) * cos(ang), y];
  },
  trail(g, t, ang, oy, ay, dz, gap, width, front) {
    const pts = [];
    for (let i = 0; i < 8; i++) { const a = ang - 0.12 - 0.07 * i; if ((sin(a) > 0) !== front) break; pts.push(this.orbitPt(t, a, oy, ay, dz, gap)); }
    for (let i = 0; i + 1 < pts.length; i++) line(g, [pts[i], pts[i + 1]], [255, 255, 255], Math.max(2, Math.floor(width * (1 - i / 8))), 220 * (1 - i / 7) / 255);
  },

  // ---------------- 乘客 ----------------
  axo(t) {
    const ph = this.spin(t) * (this.p.laps / 4) + 100 * PI / 180, vis = sin(ph);
    const a = new Ax(), p = a.pose;
    p.head = { rot: [0, 0, 0] }; p.left_gills = { rot: [0, 30, 0] }; p.right_gills = { rot: [0, -30, 0] }; p.top_gills = { rot: [-25, 0, 0] };
    p.tail = { rot: [0, 0, 0] };
    p.leg3 = { set: [80, -95, 0], move: [0, -1.5, 0] }; p.leg4 = { set: [80, 95, 0], move: [0, -1.5, 0] };
    p.leg1 = { set: [-80, 95, 0], move: [0, -1.5, 0] }; p.leg2 = { set: [-80, -95, 0], move: [0, -1.5, 0] };
    const u = t / this.T, k = this.p.tumble, rx = (360 * 2 * u + 30) * k, ry = 360 * u * k, rz = 360 * 3 * u * k;
    const piv = [0, 6, 2], rp = rotVec(piv, rx, ry, rz);                // 绕身体中间翻滚
    p.root = { rot: [rx, ry, rz], move: [piv[0] - rp[0], piv[1] - rp[1], piv[2] - rp[2]] };
    p._face = {};                                                     // 原版小眼睛：完全不慌
    a.yaw = 270 - ph * 180 / PI;
    a.zoom = this.az * (0.9 + 0.12 * vis);
    const [oy, ay, dz, gap] = this.orb, [x, y] = this.orbitPt(t, ph, oy, ay, dz, gap);
    this.placeAt(a, x, y);
    return [a, vis, ph];
  },

  render(ctx, t) {
    const [a, vis, ph] = this.axo(t);
    const axl = this.axLayer(a);
    const u = t / this.T, deb = this.debris.map(([kind, oy, ay, gap, laps, ph0, [tx, ty, tz]]) => {
      const ang = 2 * PI * (laps * u + ph0), dv = sin(ang), [x, y] = this.orbitPt(t, ang, oy, ay, ay * 0.4, gap);
      const im = this.itemImage([{ kind, s: SPRITES[kind] ? 0.9 : 1.1, rx: 360 * tx * u + 20, ry: 360 * ty * u + 40 * ph0, rz: 360 * tz * u }], { zoom: this.az * (0.9 + 0.12 * dv) });
      return { im, x, y, vis: dv, ang, oy, ay, gap };
    });
    const [L, R] = this.edges(t), xl = L[L.length - 1][0], xr = R[R.length - 1][0];
    const left = [], right = [];
    for (let x = -8; x < xl; x += 8) left.push([x, this.wy(x, t)]);
    for (let x = Math.floor(xr) + 8; x < W + 16; x += 8) right.push([x, this.wy(x, t)]);
    const [oy, ay, dz, gap] = this.orb;

    // 龙卷后面
    const back = this.back, bg = back.getContext('2d');
    bg.clearRect(0, 0, W, H);
    this.windLines(bg, t, false); this.sprayDrops(bg, t, false);
    for (const o of deb) if (o.vis <= 0) bg.drawImage(o.im, o.x - o.im.width / 2, o.y - o.im.height / 2);
    if (vis <= 0) bg.drawImage(axl, 0, 0);
    ctx.drawImage(back, 0, 0);

    // 水和龙卷是同一块水
    const body = this.tmp, b = body.getContext('2d');
    b.clearRect(0, 0, W, H);
    polygon(b, [[-8, H + 8], ...left, ...L.slice().reverse(), ...R, ...right, [W + 16, H + 8]], [170, 222, 255]);
    this.fadeTop(body, this.top);
    ctx.drawImage(body, 0, 0);
    // 后面的东西透过水隐约看得见
    const ghost = makeCanvas(W, H), gg = ghost.getContext('2d');
    gg.drawImage(back, 0, 0);
    gg.globalCompositeOperation = 'source-atop'; gg.fillStyle = 'rgba(120,190,255,0.6)'; gg.fillRect(0, 0, W, H);
    gg.globalCompositeOperation = 'destination-in'; gg.drawImage(body, 0, 0);
    ctx.save(); ctx.globalAlpha = 0.55; ctx.drawImage(ghost, 0, 0); ctx.restore();

    // 底下的波纹（后半圈）
    const cb = this.cx(this.wl, t), per = this.T / 4, rings = [];
    for (let k = 0; k < 4; k++) { const tt = mod(t + k * per / 4, per); rings.push([90 + tt / per * 200, 230 * (1 - tt / per) / 255]); }
    const arcs = (g, a0, a1) => { for (const [r, al] of rings) { g.beginPath(); g.ellipse(cb, this.wl + 4, r - 2, r * 0.17 - 2, 0, a0, a1); g.strokeStyle = `rgba(255,255,255,${al})`; g.lineWidth = 4; g.stroke(); } };
    arcs(ctx, PI, 2 * PI);

    // 转着的水带和气泡
    const sl = makeCanvas(W, H), sg = sl.getContext('2d');
    this.bands(sg, t, L); this.bubbles(sg, t);
    this.fadeTop(sl, this.top + 20);
    ctx.drawImage(sl, 0, 0);

    // 前面
    this.trail(ctx, t, ph, oy, ay, dz, gap, 8, true);
    for (const o of deb) if (o.vis > 0) this.trail(ctx, t, o.ang, o.oy, o.ay, o.ay * 0.4, o.gap, 5, true);
    const front = deb.filter((o) => o.vis > 0).sort((p, q) => p.vis - q.vis);
    for (const o of front) if (o.vis < vis || vis <= 0) ctx.drawImage(o.im, o.x - o.im.width / 2, o.y - o.im.height / 2);
    if (vis > 0) ctx.drawImage(axl, 0, 0);
    for (const o of front) if (vis > 0 && o.vis >= vis) ctx.drawImage(o.im, o.x - o.im.width / 2, o.y - o.im.height / 2);

    // 水的前沿 + 一路爬上龙卷的白色水线
    const lip = makeCanvas(W, H), lg = lip.getContext('2d'), surf = [];
    for (let x = -8; x < W + 16; x += 8) surf.push([x, this.wy(x, t) + 14]);
    polygon(lg, [...surf, [W + 8, H + 8], [-8, H + 8]], [150, 210, 255], 150 / 255);
    line(lg, [...left, ...L.slice().reverse()], [255, 255, 255], 5, 230 / 255);
    line(lg, [...R, ...right], [255, 255, 255], 5, 230 / 255);
    arcs(lg, 0, PI);
    this.fadeTop(lip, this.top);
    ctx.drawImage(lip, 0, 0);
    this.windLines(ctx, t, true); this.flingDrops(ctx, t); this.sprayDrops(ctx, t, true);
    this.drawText(ctx, t);
  },
});
