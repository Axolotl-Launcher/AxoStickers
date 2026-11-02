// 内置特效「转圈圈」。
component({
  id: 'loading', type: 'fx', name: '转圈圈',
  draw(ctx, t, layer) {
    if (layer !== 'top' || !this.LAST) return;
    const [hx, hy] = this.headPt(), x = hx + 95, y = hy - 95;
    for (let j = 0; j < 8; j++) {
      const ang = 2 * PI * j / 8;
      sq(ctx, x + 30 * cos(ang), y + 30 * sin(ang), 12, [254, 62, 140]);
    }
  },
});
