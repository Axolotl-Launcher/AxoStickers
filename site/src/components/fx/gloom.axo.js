// 内置特效「阴郁」。
component({
  id: 'gloom', type: 'fx', name: '阴郁',
  draw(ctx, t, layer) {
    if (layer !== 'back') return;
    for (let j = 0; j < 7; j++) {
      const x = 120 + j * 46 + 6 * sin(j), y0 = 190 + 10 * sin(j * 1.3) + 8 * this.ls(t, 2, j);
      line(ctx, [[x, y0], [x, y0 + 70 + 20 * sin(j * 2.1)]], [150, 130, 210], 5);
    }
  },
});
