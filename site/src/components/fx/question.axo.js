// 内置特效「问号」：几个问号轮流弹出来。
component({
  id: 'question', type: 'fx', name: '问号',
  params: { n: { label: '几个', type: 'int', min: 1, max: 3, default: 2 } },
  draw(ctx, t, layer) {
    if (layer !== 'top' || !this.LAST) return;
    const [hx, hy] = this.headPt();
    [[70, -100, 0], [110, -60, 18], [30, -140, -12]].slice(0, this.p.n).forEach(([ox, oy, r], i) => {
      const u = mod(t / this.T * 2 + i * 0.3, 1);
      let sc = u < 0.3 ? elastic(u / 0.3) : 1;
      if (u > 0.85) sc *= 1 - (u - 0.85) / 0.15;
      put(ctx, icon('question', i === 0 ? 6 : 5), hx + ox, hy + oy + 4 * sin(u * 9), sc, r + 6 * sin(u * 7));
    });
  },
});
