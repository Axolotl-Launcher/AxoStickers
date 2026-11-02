// 内置特效「环绕」：任选图标绕着头转圈，转到后面会被挡住。
component({
  id: 'orbit', type: 'fx', name: '环绕（任选图标）',
  params: {
    icon: { label: '图标', type: 'icon', default: 'star' },
    n: { label: '数量', type: 'int', min: 1, max: 8, default: 3 },
    k: { label: '大小', type: 'int', min: 2, max: 9, default: 4 },
    rx: { label: '横半径', type: 'number', min: 20, max: 220, default: 150 },
    ry: { label: '竖半径', type: 'number', min: 0, max: 120, default: 40 },
    y: { label: '高低', type: 'number', min: -150, max: 80, default: 0 },
  },
  draw(ctx, t, layer) {
    if ((layer !== 'back' && layer !== 'top') || !this.LAST) return;
    const [hx, hy] = this.headPt();
    for (let i = 0; i < this.p.n; i++) {
      const a = 2 * PI * (t / this.T + i / this.p.n);
      if ((layer === 'top') !== (sin(a) > 0)) continue;
      put(ctx, icon(this.p.icon, this.p.k), hx + this.p.rx * cos(a), hy + this.p.y + this.p.ry * sin(a), 0.75 + 0.3 * sin(a), 0);
    }
  },
});
