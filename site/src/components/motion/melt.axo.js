// 内置动作「化了」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'melt', type: 'motion', name: '化了',
  move(a, t) {
    const k = this.ph(t), m = k < 0.72 ? easeIO(k / 0.35) : 1 - elastic((k - 0.72) / 0.28);
    a.sy = 1 - 0.4 * m; a.sx = 1 + 0.32 * m; a.dy += 38 * m; addrot(a, 'head', -15 * m);
    for (const [g] of GILLS) addrot(a, g, -35 * m);
  },
});
