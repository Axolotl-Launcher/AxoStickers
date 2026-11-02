// 内置特效「慌」。
component({
  id: 'panic', type: 'fx', name: '慌',
  setup() { const r = rng(5); this.P = Array.from({ length: 6 }, () => [r.uniform(-1, 1), r.random()]); },
  draw(ctx, t, layer) {
    if (layer !== 'top' || !this.LAST) return;
    const [hx, hy] = this.headPt();
    for (const [dirx, ph] of this.P) {
      const u = mod(t / this.T * 3 + ph, 1);
      put(ctx, icon('drop', 5), hx + dirx * 140 * u, hy - 40 - 90 * u + 160 * u * u, 1, -dirx * 40, clamp((1 - u) / 0.3));
    }
  },
});
