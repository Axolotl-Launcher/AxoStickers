// 内置动作「弹弹」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'boing', type: 'motion', name: '弹弹',
  move(a, t) { const k = this.ph(t, 2), e = Math.exp(-k * 4) * sin(k * 2 * PI * 3); a.sy = 1 + 0.16 * e; a.sx = 1 - 0.1 * e; a.dy -= 30 * Math.max(0, e); },
});
