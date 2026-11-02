// 内置特效「脸红」。
component({
  id: 'blush', type: 'fx', name: '脸红',
  draw(ctx, t, layer) {
    if (layer !== 'front' || !this.LAST) return;
    this.eyePts().forEach(([ex, ey], k) => {
      const side = k ? -1 : 1, x = ex - side * 2, y = ey + 22;
      for (let j = 0; j < 3; j++) line(ctx, [[x - 12 + j * 9, y + 6], [x - 6 + j * 9, y - 6]], [255, 80, 140], 3);
    });
  },
});
