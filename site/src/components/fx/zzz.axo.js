// 内置特效「呼噜」。
component({
  id: 'zzz', type: 'fx', name: '呼噜',
  draw(ctx, t, layer) {
    if (layer !== 'top' || !this.LAST) return;
    const [hx, hy] = this.headPt([0, 9, -7.5]);
    for (let j = 0; j < 3; j++) {
      const u = mod(t / this.T + j / 3, 1);
      put(ctx, icon('z', 4 + (j % 2) + (u > 0.5 ? 1 : 0)), hx + 40 + 50 * u + 10 * sin(u * 8), hy - 30 - 120 * u, 0.7 + 0.5 * u, -10, clamp(u / 0.1) * clamp((1 - u) / 0.25));
    }
  },
});
