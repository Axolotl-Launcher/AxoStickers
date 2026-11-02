// 内置动作「躲起来」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'hide', type: 'motion', name: '躲起来',
  move(a, t) {
    const k = this.ph(t), h = k < 0.25 ? 0 : k < 0.78 ? easeIO((k - 0.25) / 0.15) : 1 - easeOutBack((k - 0.78) / 0.18, 1.3);
    a.dy += 60 * h; addrot(a, 'head', -6 * h, 24 * h * clamp(1.8 * this.ls(t, 2), -1, 1));
  },
});
