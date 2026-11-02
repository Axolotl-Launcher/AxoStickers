// 内置皮肤「青白」：按部位把原来的粉色换成别的颜色，深浅关系保留。颜色是自己调的，不是照搬游戏材质。
component({
  id: 'cyan', type: 'skin', name: '青白',
  params: {
    body: { label: '身体', type: 'color', default: '#dcf0f7' },
    gill: { label: '鳃和尾巴', type: 'color', default: '#8fd3e8' },
    dark: { label: '脚', type: 'color', default: '#5aa9c6' },
  },
  tint(rgb, part) { return recolor(rgb, part, this.p); },
});
