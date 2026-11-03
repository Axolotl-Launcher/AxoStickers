// 内置动作「拿放大镜找」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'scan', type: 'motion', name: '拿放大镜找',
  holdsItself: true,
  move(a, t) {
    const u = this.ls(t, 2);
    this.hold(a, this.spec.hold || 'magnifier', { x: 1.5 + 4 * u, y: 6.0 + 1.0 * abs(u), z: -14.0, rz: -20 + 10 * u, s: 0.75 });
    addrot(a, 'head', -6, -18 * u);
  },
});
