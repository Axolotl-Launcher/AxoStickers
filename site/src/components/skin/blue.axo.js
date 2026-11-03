// 内置皮肤「稀有蓝」：按部位把原来的粉色换成别的颜色，深浅关系保留。颜色是自己调的，不是照搬游戏材质。
component({
  id: 'blue', type: 'skin', name: '稀有蓝',
  params: {
    body: { label: '身体', type: 'color', default: '#5a72d6' },
    gill: { label: '鳃和尾巴', type: 'color', default: '#3b4dbb' },
    dark: { label: '脚', type: 'color', default: '#2c3784' },
  },
  tint(rgb, part) { return recolor(rgb, part, this.p); },
});
