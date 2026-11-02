// 内置动作「撑伞」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'umbrella', type: 'motion', name: '撑伞',
  holdsItself: true,
  move(a, t) { this.hold(a, 'umbrella', { x: 2.5, y: 12.0, z: -9.0, rz: 8 + 4 * this.ls(t, 2), s: 0.95 }); },
});
