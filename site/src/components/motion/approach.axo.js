// 内置动作「游过来」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'approach', type: 'motion', name: '游过来',
  coverK: 0.6,
  move(a, t) {
    const k = this.ph(t), z = k < 0.42 ? easeOut(k / 0.42) : k < 0.8 ? 1 : 1 - easeIn((k - 0.8) / 0.2);
    a.zoom = 0.38 + 0.62 * z; a.dy -= 52 * (1 - z); a.dx += 60 * (1 - z);
    if (k >= 0.8) a.yaw = YAW + 150 * easeIO((k - 0.8) / 0.08);
    const swim = k >= 0.42 && k < 0.8 ? 0 : 1;
    for (const l of LEGS) addrot(a, l, 0, 25 * this.ls(t, 12) * swim);
  },
});
