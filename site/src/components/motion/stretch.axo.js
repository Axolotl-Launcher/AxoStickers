// 内置动作「伸懒腰」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'stretch', type: 'motion', name: '伸懒腰',
  move(a, t) {
    const k = this.ph(t), s = k < 0.6 ? easeIO(bump(k / 0.6)) : 0;
    a.sy = 1 + 0.2 * s; a.sx = 1 - 0.08 * s; a.dy -= 28 * s; addrot(a, 'head', 28 * s);
    legmix(a, 'leg3', 0.9 * s); legmix(a, 'leg4', 0.9 * s);
    if (s > 0.35) a.pose._face = { L: 'squeeze', R: 'squeeze', mouth: 'shout' };
  },
});
