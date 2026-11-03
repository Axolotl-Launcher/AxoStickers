// 内置特效「彩纸」：彩色小纸片翻着掉。
component({
  id: 'confetti', type: 'fx', name: '彩纸',
  params: { n: { label: '数量', type: 'int', min: 4, max: 40, default: 18 } },
  setup() {
    const r = rng(strHash('confetti') & 0xff);
    this.P = Array.from({ length: this.p.n }, () => ({ x: r.uniform(0, W), ph: r.random(), sp: r.uniform(0.8, 1.2) }));
  },
  draw(ctx, t, layer) {
    if (layer !== 'top') return;
    const cols = [[255, 62, 140], [255, 200, 60], [90, 190, 255], [60, 200, 120], [180, 120, 255]];
    this.P.forEach((p, i) => {
      const u = mod(t / this.T * p.sp + p.ph, 1), y = -30 + u * (H + 60), x = p.x + 18 * sin(u * 8 + i);
      const w = 10 * abs(cos(u * 9 + i)) + 3;
      rect(ctx, x - w / 2, y - 5, x + w / 2, y + 5, cols[i % cols.length]);
    });
  },
});
