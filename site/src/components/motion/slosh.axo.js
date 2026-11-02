// 内置动作「拍水」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'slosh', type: 'motion', name: '拍水',
  setup() { for (let i = 0; i < 2; i++) this.splash((0.3 + i * 0.5) * this.T, 70, 16, 0.9, 40); },
  move(a, t) {
    const k = this.ph(t, 2), up = k < 0.24 ? easeOut(k / 0.24) : k < 0.3 ? 1 - easeIn((k - 0.24) / 0.06) : 0;
    addrot(a, 'tail', -55 * up + 18 * bump((k - 0.3) / 0.12), -15 * up);
    addrot(a, 'root', -8 * bump((k - 0.28) / 0.14)); a.dy += 6 * bump((k - 0.28) / 0.14);
  },
});
