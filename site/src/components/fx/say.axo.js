// 内置特效「气泡」：头边上的对话气泡，里面放一个任选图标。
component({
  id: 'say', type: 'fx', name: '气泡（任选图标）',
  params: { icon: { label: '图标', type: 'icon', default: 'mail' }, side: { label: '在哪边', type: 'select', options: [[1, '左边'], [-1, '右边']], default: 1 } },
  draw(ctx, t, layer) {
    if (layer !== 'top' || !this.LAST) return;
    const side = this.p.side, [hx, hy] = this.headPt(), x = hx + side * 100, y = hy - 105 + 4 * this.ls(t, 2), sc = 1 + 0.04 * this.ls(t, 4), r = 46 * sc;
    ctx.beginPath(); ctx.roundRect(x - r, y - r * 0.85, 2 * r, 1.7 * r, 22);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = 'rgb(60,62,76)'; ctx.lineWidth = 4; ctx.stroke();
    const tx = x - side * 30;
    polygon(ctx, [[tx - 10, y + r * 0.8], [tx - side * 22, y + r * 0.8 + 26], [tx + 10, y + r * 0.8]], [255, 255, 255]);
    line(ctx, [[tx - 10 * side, y + r * 0.85 - 1], [tx - side * 22, y + r * 0.8 + 26], [tx + 10 * side, y + r * 0.85 - 1]], [60, 62, 76], 4);
    put(ctx, icon(this.p.icon, 6), x, y, sc);
  },
});
