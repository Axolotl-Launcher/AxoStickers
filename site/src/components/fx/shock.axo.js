// 内置特效「震惊」。
component({
  id: 'shock', type: 'fx', name: '震惊',
  draw(ctx, t, layer) {
    if (layer !== 'top' || !this.LAST) return;
    const [hx, hy] = this.headPt(), u = mod(t / this.T * 4, 1);
    for (let j = 0; j < 8; j++) {
      const ang = (j * 45 + 22) * PI / 180, r0 = 85 + 15 * u, r1 = r0 + 26;
      if (sin(ang) > 0.5) continue;
      line(ctx, [[hx + cos(ang) * r0, hy - 10 + sin(ang) * r0 * 0.9], [hx + cos(ang) * r1, hy - 10 + sin(ang) * r1 * 0.9]], [60, 60, 70], 5);
    }
  },
});
