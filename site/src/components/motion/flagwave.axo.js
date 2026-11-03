// 内置动作「挥来挥去」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'flagwave', type: 'motion', name: '挥来挥去',
  holdsItself: true,
  params: {
    n: { label: '挥几下', type: 'int', min: 1, max: 8, default: 4 },
    s: { label: '道具大小', type: 'number', min: 0.3, max: 1.5, default: 0.7 },
  },
  move(a, t) {
    const n = this.p.n;
    this.hold(a, this.spec.hold || 'flag', { x: 5.2, y: 8.0, z: -12.6, rz: -5 + 28 * this.ls(t, n), s: this.p.s });
    addrot(a, 'head', 0, -6 * this.ls(t, n)); a.dy -= 4 * abs(this.ls(t, n));
  },
});
