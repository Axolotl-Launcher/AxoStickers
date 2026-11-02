// 内置特效「省略号」。
component({
  id: 'dots', type: 'fx', name: '省略号',
  draw(ctx, t, layer) {
    if (layer !== 'top' || !this.LAST) return;
    const [hx, hy] = this.headPt(), x = hx + 95, y = hy - 100;
    ctx.beginPath(); ctx.roundRect(x - 58, y - 32, 116, 64, 22);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = 'rgb(60,62,76)'; ctx.lineWidth = 4; ctx.stroke();
    polygon(ctx, [[x - 40, y + 28], [x - 58, y + 52], [x - 18, y + 30]], [255, 255, 255]);
    line(ctx, [[x - 40, y + 30], [x - 58, y + 52], [x - 20, y + 31]], [60, 62, 76], 4);
    const n = Math.floor(mod(t / this.T * 4, 4));
    for (let j = 0; j < 3; j++) sq(ctx, x - 28 + j * 28, y, 14, j < n ? [60, 62, 76] : [200, 202, 212]);
  },
});
