// 内置特效「月亮」。
component({
  id: 'moon', type: 'fx', name: '月亮',
  draw(ctx, t, layer) {
    if (layer !== 'back') return;
    put(ctx, icon('moon', 9), 445, 235, 1, 0);
    for (const [x, y, ph] of [[60, 230, 0], [100, 300, 2], [400, 320, 4], [30, 330, 1]]) {
      const a = 0.5 + 0.5 * sin(2 * PI * t / this.T * 2 + ph);
      star(ctx, x, y, 9 * a + 3, [255, 214, 64]);
    }
  },
});
