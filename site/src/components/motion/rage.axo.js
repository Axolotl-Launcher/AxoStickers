// 内置动作「暴怒」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'rage', type: 'motion', name: '暴怒',
  move(a, t) {
    a.dx += 4.5 * this.ls(t, 30); const p = Math.exp(-this.ph(t, 4) * 5); a.sx = a.sy = 1 + 0.07 * p; addrot(a, 'head', -14);
    for (const [g, s] of GILLS) addrot(a, g, 0, s * 25);
    addrot(a, 'top_gills', -20);
  },
});
