// 内置动作「鼓掌」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'clap', type: 'motion', name: '鼓掌',
  move(a, t) { const c = abs(this.ls(t, 6)); legmix(a, 'leg3', 0.85, [0, 0, 30 * c]); legmix(a, 'leg4', 0.85, [0, 0, -30 * c]); a.dy -= 4 * c; },
});
