// 内置特效「对勾」：右下角弹出一个大对勾。
component({
  id: 'check', type: 'fx', name: '对勾',
  params: {
    icon: { label: '图标', type: 'icon', default: 'check' },
    k: { label: '大小', type: 'int', min: 3, max: 14, default: 9 },
    x: { label: '横向位置', type: 'number', min: 0, max: 512, default: 330 },
    y: { label: '纵向位置', type: 'number', min: 0, max: 512, default: 270 },
  },
  draw(ctx, t, layer) {
    if (layer !== 'top') return;
    const u = mod(t / this.T, 1), sc = u < 0.25 ? elastic(u / 0.25) : 1 + 0.03 * sin(u * 20);
    put(ctx, icon(this.p.icon, this.p.k), this.p.x, this.p.y, sc, -8);
  },
});
