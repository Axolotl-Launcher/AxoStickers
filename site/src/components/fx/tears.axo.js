// 内置特效「掉眼泪」。
component({
  id: 'tears', type: 'fx', name: '掉眼泪',
  draw(ctx, t, layer) {
    if (layer !== 'front' || !this.LAST) return;
    this.eyePts().forEach(([ex, ey], k) => {
      const side = k ? -1 : 1;
      for (let j = 0; j < 2; j++) {
        const u = mod(t / this.T * 2 + j * 0.5, 1);
        put(ctx, icon('drop', 4), ex + side * 6, ey + 12 + 70 * u * u, 1, 0, clamp((1 - u) / 0.3));
      }
    });
  },
});
