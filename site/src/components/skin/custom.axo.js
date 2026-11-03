// 内置皮肤「自己调色」：三个颜色随便挑。想要更花的效果，直接改下面的 tint：rgb 是原来的颜色，part 是部位
// （head body top_gills left_gills right_gills leg1..4 tail face item），返回新的 [r, g, b]。
component({
  id: 'custom', type: 'skin', name: '自己调色',
  params: {
    body: { label: '身体', type: 'color', default: '#9be7ff' },
    gill: { label: '鳃和尾巴', type: 'color', default: '#ff7ab4' },
    dark: { label: '脚', type: 'color', default: '#4a63c8' },
  },
  tint(rgb, part) { return recolor(rgb, part, this.p); },
});
