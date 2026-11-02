// 内置动作「滑进来」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'slidein', type: 'motion', name: '滑进来',
  setup() { this.splash(0.93 * this.T, -30, 14, 0.7, 40); },
  move(a, t) {
    const k = this.ph(t);
    if (k < 0.58) return;
    if (k < 0.7) { const u = (k - 0.58) / 0.12; a.dx += 480 * easeIn(u); a.yaw = YAW + 110 * easeIO(u / 0.5); }
    else if (k < 0.76) a.show = false;
    else {
      const u = (k - 0.76) / 0.24;
      a.dx += -480 * (1 - easeOut(u / 0.7)); a.yaw = YAW + 110 * (1 - easeIO((u - 0.7) / 0.3));
      a.roll = -14 * bump((u - 0.55) / 0.35);
      for (const l of LEGS) addrot(a, l, 0, 30 * this.ls(t, 16));
    }
  },
});
