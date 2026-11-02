// 内置动作「潜水」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'sink', type: 'motion', name: '潜水',
  setup() { this.splash(0.42 * this.T, 0, 10, 0.6, 50); this.splash(0.78 * this.T, 0, 14, 0.8); },
  move(a, t) {
    const k = this.ph(t);
    let d;
    if (k < 0.15) d = 0;
    else if (k < 0.42) { d = 260 * easeIn((k - 0.15) / 0.27); addrot(a, 'root', -20 * clamp((k - 0.15) / 0.1)); }
    else if (k < 0.66) d = 300;
    else d = 300 * (1 - easeOutBack((k - 0.66) / 0.3, 1.3));
    a.dy += d; a.show = d < 290;
  },
});
