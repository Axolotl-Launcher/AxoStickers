// 内置动作「探头」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'peek', type: 'motion', name: '探头',
  move(a, t) {
    const k = this.ph(t), rise = k > 0.3 && k < 0.7 ? bump((k - 0.3) / 0.4) : 0;
    a.dy += 52 - 26 * easeIO(rise * 1.6);
    addrot(a, 'head', -10, 28 * clamp(1.8 * this.ls(t, 1)));
  },
});
