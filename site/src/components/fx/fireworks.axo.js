// 内置特效「烟花」。
component({
  id: 'fireworks', type: 'fx', name: '烟花',
  params: { n: { label: '几朵', type: 'int', min: 1, max: 8, default: 3 } },
  setup() {
    const r = rng(11), n = this.p.n;
    this.B = Array.from({ length: n }, (_, i) => ({ x: r.uniform(70, 440), y: r.uniform(220, 320), ph: i / n, c: r.choice([[255, 62, 140], [255, 200, 60], [90, 190, 255], [60, 200, 120]]) }));
  },
  draw(ctx, t, layer) {
    if (layer !== 'back') return;
    for (const b of this.B) {
      const u = mod(t / this.T + b.ph, 1);
      if (u >= 0.55) continue;
      const k = u / 0.55;
      for (let j = 0; j < 12; j++) {
        const ang = j * PI / 6, rr = 55 * easeOut(k);
        sq(ctx, b.x + cos(ang) * rr, b.y + sin(ang) * rr + 20 * k * k, 9 * (1 - k) + 2, b.c);
      }
    }
  },
});
