// 内置动作「打瞌睡」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'doze', type: 'motion', name: '打瞌睡',
  move(a, t) {
    const k = this.ph(t), drop = k < 0.82 ? easeIn(k / 0.82) : 1 - easeOut((k - 0.82) / 0.1);
    addrot(a, 'head', -40 * drop); a.dy += 22 * drop;
    for (const [g] of GILLS) addrot(a, g, -25 * drop);
    a.pose._face = { ...(k > 0.82 && k < 0.95 ? FACES.surprise : FACES[this.spec.face || 'sleep'] || {}) };
  },
});
