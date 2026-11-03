// 内置特效「感叹号」。
component({
  id: 'exclaim', type: 'fx', name: '感叹号',
  params: { n: { label: '几个', type: 'int', min: 1, max: 3, default: 1 } },
  draw(ctx, t, layer) {
    if (layer !== 'top' || !this.LAST) return;
    const [hx, hy] = this.headPt(), u = mod(t / this.T * 2, 1), sc = u < 0.25 ? elastic(u / 0.25) : 1, x = hx + 70, y = hy - 105;
    for (let k = 0; k < this.p.n; k++) put(ctx, icon('exclaim', 7), x + k * 26, y - 6 * bump(u / 0.2), sc, -10 + k * 14);
    if (u < 0.4) {
      for (let j = 0; j < 5; j++) {
        const ang = (-150 + j * 30) * PI / 180, r0 = 45 + 30 * u / 0.4, r1 = r0 + 22;
        line(ctx, [[x + cos(ang) * r0, y + sin(ang) * r0], [x + cos(ang) * r1, y + sin(ang) * r1]], [255, 59, 78], 5);
      }
    }
  },
});
