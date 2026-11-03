// 内置动作「转圈」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'spin', type: 'motion', name: '转圈',
  params: {
    n: { label: '转几圈', type: 'int', min: 1, max: 4, default: 1 },
    dir: { label: '方向', type: 'select', options: [[1, "顺时针"], [-1, "逆时针"]], default: 1 },
  },
  move(a, t) { const k = this.ph(t, this.p.n); a.yaw = YAW + 360 * easeIO(k) * (this.p.dir); a.dy -= 26 * bump(k); },
});
