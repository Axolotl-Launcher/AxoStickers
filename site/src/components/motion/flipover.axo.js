// 内置动作「翻个身」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'flipover', type: 'motion', name: '翻个身',
  setup() { this.splash(0.42 * this.T, 0, 12, 0.7); this.splash(0.9 * this.T, 0, 12, 0.7); },
  move(a, t) {
    const k = this.ph(t);
    const r = k < 0.3 ? 0 : k < 0.45 ? 180 * easeOutBack((k - 0.3) / 0.15, 1.2) : k < 0.75 ? 180 : k < 0.92 ? 180 + 180 * easeIO((k - 0.75) / 0.17) : 360;
    const h = sin(r / 2 * PI / 180) ** 2;
    a.pose.root = { rot: [8 * cos(r * PI / 180), 0, r], move: [0, 15 * h, 0] };
    a.dy += 22 * h;
    if (k >= 0.45 && k < 0.75) for (const l of LEGS) addrot(a, l, 20 * this.ls(t, 8, l === 'leg2' ? 1 : 0));
  },
});
