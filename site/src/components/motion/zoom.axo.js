// 内置动作「凑近」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'zoom', type: 'motion', name: '凑近',
  move(a, t) {
    const k = this.ph(t), z = k < 0.6 ? easeIO(k / 0.35) : 1 - easeIO((k - 0.6) / 0.3);
    a.zoom = 1 + 0.55 * z; a.dy -= 50 * z; addrot(a, 'head', -8 * z);
  },
});
