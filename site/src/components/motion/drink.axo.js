// 内置动作「喝」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'drink', type: 'motion', name: '喝',
  holdsItself: true,
  move(a, t) {
    const k = this.ph(t, 2), sip = k < 0.6 ? easeIO(bump(k / 0.6)) : 0;
    this.hold(a, this.spec.hold || 'boba', { x: lerp(4.8, 1.0, sip), y: lerp(5.5, 4.5, sip), z: -13.5, rz: lerp(-8, 20, sip), s: 0.9 });
    addrot(a, 'head', lerp(0, 18, sip));
  },
});
