// 内置动作「变大」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'grow', type: 'motion', name: '变大',
  move(a, t) { const k = this.ph(t, 2), g = k < 0.7 ? elastic(k / 0.4) : 1 - easeIO((k - 0.7) / 0.3); a.zoom = 1 + 0.35 * g; a.dy -= 40 * g; },
});
