// 内置特效「冒烟」。
component({
  id: 'steam', type: 'fx', name: '冒烟',
  draw(ctx, t, layer) {
    if (layer !== 'top' || !this.LAST) return;
    const [hx, hy] = this.headPt([0, 9, -7.5]);
    for (const side of [-1, 1]) {
      for (let j = 0; j < 3; j++) {
        const u = mod(t / this.T * 4 + j / 3 + (side > 0 ? 0.5 : 0), 1);
        sq(ctx, hx + side * (40 + 40 * u), hy - 20 - 70 * u, 10 + 16 * u, [255, 255, 255], [190, 196, 210], 3);
      }
    }
  },
});
