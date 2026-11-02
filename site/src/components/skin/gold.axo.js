// 内置皮肤「金色」：按部位把原来的粉色换成别的颜色，深浅关系保留。颜色是自己调的，不是照搬游戏材质。
component({
  id: 'gold', type: 'skin', name: '金色',
  params: {
    body: { label: '身体', type: 'color', default: '#f6cf52' },
    gill: { label: '鳃和尾巴', type: 'color', default: '#ee9a33' },
    dark: { label: '脚', type: 'color', default: '#c9732a' },
  },
  tint(rgb, part) { return recolor(rgb, part, this.p); },
});
