// 内置文字动画「蹦回来」：初代「看群公告」「请截图」的字（kit 工具包 anim_notice.py）。到点后一个字一个字从上面掉下来、带回弹，
// 每个字炸开一圈小星星；快到一圈末尾时倒着一个个收掉。时刻是一圈里的位置（0～1），配动作「浮上来，最后潜回去」正好接上
component({
  id: 'popin', type: 'textanim', name: '蹦回来（炸小星星）', entrance: true,
  params: {
    at: { label: '第一个字出来（一圈里的位置 0～1）', type: 'number', min: 0, max: 0.9, step: 0.01, default: 0.24 },
    gap: { label: '一个字隔几秒', type: 'number', min: 0, max: 0.6, step: 0.02, default: 0.16 },
    out: { label: '收掉（0～1，1 = 不收）', type: 'number', min: 0.1, max: 1, step: 0.01, default: 0.81 },
    sparks: { label: '炸小星星', type: 'bool', default: true },
  },
  setup() {
    const r = rng(3);
    this.sp = this.lay.map(() => Array.from({ length: 6 }, () => [r.uniform(0, 2 * PI), r.uniform(70, 130), r.uniform(7, 13),
      r.choice([[255, 214, 64], [255, 120, 180], [255, 255, 255], [130, 210, 255]])]));
  },
  t0(i) { return this.p.at * this.T + i * this.p.gap; },
  cover(n) { return Math.min(this.p.out * this.T - 0.05, this.t0(n - 1) + 0.75, this.T - 0.05); },
  xf(i, n, t) {
    const tt = t - this.t0(i);
    if (tt <= 0) return [0, 0, 0, 0, false];
    let sc = tt < 0.55 ? elastic(tt / 0.55) : 1 + 0.045 * sin(tt * 7);
    if (this.p.out < 1) {
      const te = (t - this.p.out * this.T - (n - 1 - i) * 0.06) / 0.28;
      if (te >= 1) return [0, 0, 0, 0, false];
      if (te > 0) sc *= 1 + 0.25 * sin(te * PI) - te ** 2;
    }
    const rot = (1 - easeOut(tt / 0.4)) * (i % 2 ? -28 : 28) + 3 * sin(t * 5 + i);
    const dy = -(1 - easeOutBack(tt / 0.45)) * 120 + 7 * sin(t * 5.5 - i * 0.9) * clamp((tt - 0.5) / 0.3);
    return [0, dy, max(0.01, sc), rot, true];
  },
  draw(ctx, t, lay) {
    if (!this.p.sparks) return;
    lay.forEach(([, x, y], i) => {
      const k = (t - this.t0(i)) / 0.6;
      if (k <= 0 || k >= 1) return;
      for (const [ang, v, rr, c] of this.sp[i] || []) { const r = v * easeOut(k); star(ctx, x + cos(ang) * r, y + sin(ang) * r, rr * (1 - k), c); }
    });
  },
});
