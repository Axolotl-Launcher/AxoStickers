// 内置特效「着火」。
component({
  id: 'fire', type: 'fx', name: '着火',
  setup() { const r = rng(8); this.P = Array.from({ length: 9 }, () => [r.uniform(80, 430), r.random(), r.uniform(0.7, 1.2)]); },
  draw(ctx, t, layer) {
    if (layer !== 'back') return;
    for (const [x, ph, sc] of this.P) {
      const u = mod(t / this.T * 3 + ph, 1);
      put(ctx, icon('flame', 7), x + 8 * sin(u * 7), 380 - 140 * u, sc * (1 - 0.6 * u), 0, clamp((1 - u) / 0.4));
    }
  },
});
