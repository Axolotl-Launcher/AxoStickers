// 内置特效「冒出」：任选图标在头边上一下一下弹出来。
component({
  id: 'pop', type: 'fx', name: '冒出（任选图标）',
  params: {
    icon: { label: '图标', type: 'icon', default: 'exclaim' },
    k: { label: '大小', type: 'int', min: 2, max: 10, default: 6 },
    x: { label: '横向位置', type: 'number', min: -200, max: 200, default: 60 },
    y: { label: '纵向位置', type: 'number', min: -200, max: 100, default: -95 },
    beats: { label: '一圈弹几次', type: 'int', min: 1, max: 6, default: 2 },
  },
  draw(ctx, t, layer) {
    if (layer !== 'top' || !this.LAST) return;
    const [hx, hy] = this.headPt(), per = this.T / this.p.beats, u = mod(t, per) / per;
    let sc = u < 0.35 ? elastic(u / 0.35) : 1 + 0.05 * sin(u * 12);
    if (u > 0.9) sc *= 1 - (u - 0.9) / 0.1 * 0.25;
    put(ctx, icon(this.p.icon, this.p.k), hx + this.p.x, hy + this.p.y, sc, 8 * sin(2 * PI * t / this.T * 2));
  },
});
