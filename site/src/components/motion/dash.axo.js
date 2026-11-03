// 内置动作「溜走」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'dash', type: 'motion', name: '溜走',
  setup() { this.splash(0.22 * this.T, 40, 12, 0.7); },
  move(a, t) {
    const k = this.ph(t);
    if (k < 0.2) { a.dx -= 14 * easeIO(k / 0.2); addrot(a, 'head', 0, -20 * easeIO(k / 0.2)); }
    else if (k < 0.4) { a.dx += -14 + 480 * easeIn((k - 0.2) / 0.2); a.yaw = YAW + 110 * easeIO((k - 0.2) / 0.08); }
    else if (k < 0.55) a.show = false;
    else if (k < 0.85) { a.dx += -480 * (1 - easeOut((k - 0.55) / 0.3)); a.yaw = YAW + 110 * (1 - easeIO((k - 0.7) / 0.15)); }
    for (const l of LEGS) addrot(a, l, 0, 25 * this.ls(t, 16));
  },
});
