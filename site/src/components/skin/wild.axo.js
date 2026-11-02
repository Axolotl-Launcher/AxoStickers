// 内置皮肤「野生棕」：按部位把原来的粉色换成别的颜色，深浅关系保留。颜色是自己调的，不是照搬游戏材质。
component({
  id: 'wild', type: 'skin', name: '野生棕',
  params: {
    body: { label: '身体', type: 'color', default: '#8a6548' },
    gill: { label: '鳃和尾巴', type: 'color', default: '#6b4a36' },
    dark: { label: '脚', type: 'color', default: '#4a3326' },
  },
  tint(rgb, part) { return recolor(rgb, part, this.p); },
});
