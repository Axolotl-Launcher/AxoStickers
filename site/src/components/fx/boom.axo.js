// 内置特效「爆炸」。
component({
  id: 'boom', type: 'fx', name: '爆炸',
  params: { x: { label: '横向位置', type: 'number', min: 0, max: 512, default: 256 }, y: { label: '纵向位置', type: 'number', min: 0, max: 512, default: 330 } },
  setup() { const r = rng(13); this.P = Array.from({ length: 14 }, () => [r.uniform(0, 2 * PI), r.uniform(60, 140), r.choice([10, 14, 18])]); },
  draw(ctx, t, layer) {
    if (layer !== 'top') return;
    const cx = this.p.x, cy = this.p.y, u = mod(t / this.T, 1);
    if (u >= 0.45) return;
    const k = u / 0.45, rr = 30 + 70 * easeOut(k);
    if (k < 0.35) ellipse(ctx, cx - rr, cy - rr, cx + rr, cy + rr, [255, 230, 120]);
    for (const [ang, sp, sz] of this.P) {
      sq(ctx, cx + cos(ang) * sp * easeOut(k), cy + sin(ang) * sp * easeOut(k) * 0.8, sz * (1 - 0.5 * k), k < 0.4 ? [255, 140, 40] : [170, 170, 180], [90, 90, 100], 2);
    }
  },
});
