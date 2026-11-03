// 内置动作「磕头」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'kowtow', type: 'motion', name: '磕头',
  setup() { for (let i = 0; i < 4; i++) this.splash((i + 0.27) * this.T / 4, -70, 5, 0.35, 25); },
  move(a, t) {
    const k = this.ph(t, 4), b = k < 0.55 ? easeIO(bump(k / 0.55)) : 0;
    addrot(a, 'head', -55 * b); addrot(a, 'root', -24 * b); a.dy += 30 * b;
  },
});
