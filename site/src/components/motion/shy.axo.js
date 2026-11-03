// 内置动作「害羞」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'shy', type: 'motion', name: '害羞',
  move(a, t) {
    const k = 0.5 + 0.5 * this.ls(t, 1);
    addrot(a, 'head', -12, 36 * k); a.dy += 18 * k;
    for (const [g] of GILLS) addrot(a, g, -20 * k);
  },
});
