// 内置动作「发抖」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'tremble', type: 'motion', name: '发抖',
  move(a, t) {
    a.dx += 3.5 * this.ls(t, 36); addrot(a, 'head', 0, 3 * this.ls(t, 30));
    for (const [g, s] of GILLS) addrot(a, g, 0, s * 10 * this.ls(t, 24));
  },
});
