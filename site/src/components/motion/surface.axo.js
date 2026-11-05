// 内置动作「浮上来，最后潜回去」：初代「看文档」「看群公告」「请截图」的出入场（kit 工具包 anim_notice.py）。
// 开头在水下（画面是空的），到点冲出水面（压扁拉长一下、溅水花），抬头看；快到一圈末尾时再沉回水里。时刻都是一圈里的位置（0～1）
component({
  id: 'surface', type: 'motion', name: '浮上来，最后潜回去', offscreen: true,
  params: {
    in: { label: '浮上来（一圈里的位置 0～1）', type: 'number', min: 0, max: 0.9, step: 0.01, default: 0.09 },
    out: { label: '潜下去（0～1，1 = 不潜）', type: 'number', min: 0.1, max: 1, step: 0.01, default: 0.81 },
    look: { label: '抬头看（度）', type: 'number', min: -10, max: 45, default: 26 },
    splash: { label: '溅水花', type: 'bool', default: true },
  },
  setup() { if (this.p.splash) { const t = this.p.in * this.T; this.splash(t + 0.27, 0, 20); this.splash(t + 0.35, 0, 10); } },
  wave(t, f, ph = 0) { return this.ls(t, max(1, round(f * this.T / (2 * PI))), ph); },   // 约等于 sin(f·t)，但一圈正好整数个来回
  move(a, t) {
    const ti = this.p.in * this.T, to = this.p.out >= 1 ? Infinity : this.p.out * this.T, p = a.pose;
    const rise = easeOutBack((t - ti) / 0.6, 1.4), ex = clamp((t - to - 0.2) / 0.5) ** 2;
    let tilt = this.p.look * easeOutBack((t - ti - 0.5) / 0.45, 2.2) + 3 * this.wave(t, 6) * clamp((t - ti - 0.95) / 0.3);
    tilt *= 1 - easeIO((t - to) / 0.4);
    p.head = { rot: [tilt, 4 * this.wave(t, 3.1), 0] };
    const gw = 12 * this.wave(t, 9) + 8 * easeOut((t - ti - 0.25) / 0.3);
    p.left_gills = { rot: [0, gw, 0] }; p.right_gills = { rot: [0, -gw, 0] }; p.top_gills = { rot: [-0.6 * gw, 0, 0] };
    p.tail = { rot: [-10 - 8 * easeOut((t - ti - 0.05) / 0.4), 18 * this.wave(t, 5), 0] };
    p.root = { rot: [8 * easeIO((t - ti - 0.15) / 0.5), 0, 0] };
    for (const [k, s] of [['leg3', 1], ['leg4', -1], ['leg1', -1], ['leg2', 1]]) p[k].rot = [0, s * 10 * this.wave(t, 6, k === 'leg1' || k === 'leg2' ? 1 : 0), 0];
    const st = 1 + 0.1 * bump((t - ti - 0.1) / 0.5);           // 冲出水面那一下：拉长、脚底不动
    a.sy = st; a.sx = 1 / sqrt(st);
    a.dy = (1 - rise) * 300 + 4 * this.wave(t, 4.2) * clamp((t - ti - 0.65) / 0.4) + ex * 310 - 170 * (st - 1);
    // 涟漪跟着它：浮上来才有，潜下去就散了
    this.stage.rippleOn = false;
    for (let k = 0; k < 3; k++) {
      let tt = t - ti - 0.25 - k * 0.45;
      if (tt <= 0) continue;
      tt %= 1.35;
      const r = 40 + tt * 170, al = 220 * (1 - tt / 1.35) * (1 - clamp((t - to - 0.3) / 0.4)) / 255;
      if (al > 0) this.stage.rings.push([W / 2, this.stage.waterLevel + 8, r, r * 0.16, al]);
    }
  },
});
