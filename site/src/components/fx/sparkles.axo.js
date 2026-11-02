// 内置特效「闪光」。
component({
  id: 'sparkles', type: 'fx', name: '闪光',
  params: { n: { label: '数量', type: 'int', min: 1, max: 20, default: 6 } },
  setup() { const r = rng(21); this.P = Array.from({ length: this.p.n }, () => [r.uniform(70, 440), r.uniform(180, 400), r.random(), r.uniform(8, 14)]); },
  draw(ctx, t, layer) {
    if (layer !== 'top') return;
    for (const [x, y, ph, rr] of this.P) {
      const a = Math.max(0, sin(2 * PI * (t / this.T * 2 + ph)));
      if (a > 0.1) star(ctx, x, y, rr * a, [255, 214, 64]);
    }
  },
});
