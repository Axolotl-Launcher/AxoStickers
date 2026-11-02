// 内置特效「宽面条泪」。
component({
  id: 'stream', type: 'fx', name: '宽面条泪',
  draw(ctx, t, layer) {
    if (layer !== 'front' || !this.LAST) return;
    this.eyePts().forEach(([ex, ey], k) => {
      const side = k ? -1 : 1;
      for (let j = 0; j < 7; j++) {
        const u = mod(t / this.T * 4 + j / 7, 1);
        sq(ctx, ex + side * (70 * u), ey + 8 - 40 * u + 120 * u * u, 10 - 4 * u, [124, 200, 255], [60, 140, 220]);
      }
    });
  },
});
