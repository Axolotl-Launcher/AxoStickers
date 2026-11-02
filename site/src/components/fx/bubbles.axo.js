// 内置特效「吐泡泡」。
component({
  id: 'bubbles', type: 'fx', name: '吐泡泡',
  params: { n: { label: '几个', type: 'int', min: 1, max: 12, default: 5 } },
  draw(ctx, t, layer) {
    if (layer !== 'top' || !this.LAST) return;
    const [mx, my] = this.headPt([0, 5, -10.2]), n = this.p.n;
    for (let j = 0; j < n; j++) {
      const u = mod(t / this.T * 2 + j / n, 1);
      const x = mx + 20 + 18 * sin(u * 7 + j) + 30 * u, y = my - 20 - 170 * u, r = 6 + 16 * u * (0.6 + 0.4 * (j % 2));
      ellipse(ctx, x - r, y - r, x + r, y + r, null, [110, 190, 255], 3);
      rect(ctx, x - r * 0.5, y - r * 0.55, x - r * 0.5 + 4, y - r * 0.55 + 4, [255, 255, 255]);
    }
  },
});
