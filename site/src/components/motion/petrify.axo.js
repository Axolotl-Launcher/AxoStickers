// 内置动作「石化」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'petrify', type: 'motion', name: '石化',
  move(a, t) {
    const k = this.ph(t), g = k < 0.8 ? clamp((k - 0.12) / 0.1) : 1 - clamp((k - 0.88) / 0.06);
    if (g > 0) {
      const f = new Ax(); this.idle(f, 0.12 * this.T); a.pose = f.pose; a.dy = f.dy;
      if (k >= 0.8 && k < 0.9) a.dx += 4 * this.ls(t, 30);
    }
    a.gray = g;
  },
});
