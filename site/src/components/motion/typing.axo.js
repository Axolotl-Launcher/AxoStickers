// 内置动作「敲键盘」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'typing', type: 'motion', name: '敲键盘',
  holdsItself: true,
  move(a, t) {
    this.wear(a, 'laptop', { at: 'root', x: 0, y: 6.0, z: -15.5, rx: -8, ry: 180, s: 0.9 }); a.dy -= 22;
    addrot(a, 'head', -14 + 4 * abs(this.ls(t, 12)));
    addrot(a, 'leg3', -60 - 15 * abs(this.ls(t, 12))); addrot(a, 'leg4', -60 - 15 * abs(this.ls(t, 12, 1.2)));
  },
});
