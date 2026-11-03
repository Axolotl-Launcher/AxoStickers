// 内置动作「打滚」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'roll', type: 'motion', name: '打滚',
  move(a, t) { const k = this.ph(t); a.pose.root = { rot: [8, 0, 360 * easeIO(k)], move: [0, 7 * bump(k), 0] }; a.dy += 10 * bump(k); },
});
