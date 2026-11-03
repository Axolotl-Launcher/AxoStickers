// 内置特效「灵魂出窍」。
component({
  id: 'ghost', type: 'fx', name: '灵魂出窍',
  draw(ctx, t, layer) {
    if (layer !== 'top' || !this.LAST) return;
    const [hx, hy] = this.headPt([0, 9, -7.5]), u = mod(t / this.T, 1);
    put(ctx, icon('ghost', 6), hx + 20 * sin(u * 9), hy - 30 - 140 * u, 0.7 + 0.4 * u, 6 * sin(u * 12), clamp(u / 0.1) * clamp((1 - u) / 0.3));
  },
});
