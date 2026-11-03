// 内置动作「扭头不理」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'turnaway', type: 'motion', name: '扭头不理',
  move(a, t) {
    const k = this.ph(t);
    const tw = k < 0.12 ? 0 : k < 0.72 ? easeOutBack((k - 0.12) / 0.16, 1.4) : 1 - easeIO((k - 0.72) / 0.16);
    a.yaw = YAW + 130 * tw;
    if (k > 0.42 && k < 0.58) addrot(a, 'head', 0, -55 * bump((k - 0.42) / 0.16));
    addrot(a, 'head', 12 * tw);
  },
});
