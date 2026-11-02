// 内置动作「思考」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'think', type: 'motion', name: '思考',
  move(a, t) { addrot(a, 'head', 12, -10, 14 + 3 * this.ls(t, 1)); legmix(a, 'leg3', 0.9, [25, 0, 25]); },
});
