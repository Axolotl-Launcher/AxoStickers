// 内置特效「灵光一闪」。
component({
  id: 'bulb', type: 'fx', name: '灵光一闪',
  draw(ctx, t, layer) {
    if (layer !== 'top' || !this.LAST) return;
    const [hx, hy] = this.headPt(), u = mod(t / this.T * 2, 1), x = hx + 10, y = hy - 125;
    if (u > 0.2) {
      for (let j = 0; j < 8; j++) {
        const ang = j * PI / 4, r0 = 52, r1 = 52 + 18 * (1 + 0.3 * sin(u * 20));
        line(ctx, [[x + cos(ang) * r0, y + sin(ang) * r0], [x + cos(ang) * r1, y + sin(ang) * r1]], [255, 200, 40], 5);
      }
    }
    put(ctx, icon('bulb', 7), x, y, u < 0.3 ? elastic(u / 0.3) : 1);
  },
});
