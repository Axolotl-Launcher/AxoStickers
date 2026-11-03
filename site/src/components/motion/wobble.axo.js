// 内置动作「果冻抖」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'wobble', type: 'motion', name: '果冻抖',
  move(a, t) {
    const k = this.ph(t, 2), e = Math.exp(-k * 4.5) * sin(k * 2 * PI * 3.5);
    a.sx = 1 + 0.2 * e; a.sy = 1 - 0.18 * e; a.roll = 9 * e; a.dy += 10 * e;
  },
});
