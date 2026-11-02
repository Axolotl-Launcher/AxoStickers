// 内置动作「递给你」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'offer', type: 'motion', name: '递给你',
  holdsItself: true,
  params: {
    s: { label: '道具大小', type: 'number', min: 0.3, max: 2, default: 1 },
  },
  move(a, t) {
    const kind = this.spec.hold || 'heart', p = Math.exp(-this.ph(t, 2) * 5);
    this.hold(a, kind, { x: 2.0, y: 10.5, z: -14.5, rz: -6, s: propScale(kind) * (1 + 0.18 * p) * (this.p.s), legs: 1.0 });
    legmix(a, 'leg3', 1.0); addrot(a, 'head', 8);
  },
});
