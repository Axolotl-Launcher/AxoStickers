// 内置动作「看书」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'read', type: 'motion', name: '看书',
  holdsItself: true,
  params: {
    s: { label: '道具大小', type: 'number', min: 0.3, max: 2, default: 1 },
  },
  move(a, t) {
    this.hold(a, this.spec.hold || 'book', { x: 4.6, y: 8.6, z: -13.2, ry: -35, rz: -8, s: this.p.s });
    addrot(a, 'head', -6 + 2 * this.ls(t, 2), -16 + 6 * this.ls(t, 4));
  },
});
