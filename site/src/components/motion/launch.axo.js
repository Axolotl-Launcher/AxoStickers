// 内置动作「起飞」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'launch', type: 'motion', name: '起飞',
  setup() { this.splash(0.2 * this.T, 0, 22, 1.2); },
  move(a, t) {
    const k = this.ph(t);
    if (k < 0.15) { a.dy += 20 * bump(k / 0.15); a.sy = 1 - 0.08 * bump(k / 0.15); }
    else if (k < 0.42) { a.dy -= 620 * easeIn((k - 0.15) / 0.27); addrot(a, 'root', 35); a.sy = 1.12; }
    else if (k < 0.6) a.show = false;
    else a.dy += 260 * (1 - easeOutBack((k - 0.6) / 0.3, 1.4));
    this._k = k;
  },
  drawBack(ctx, t) {
    const k = this._k || 0;
    if (k > 0.15 && k < 0.42 && this.LAST) {
      const e = rootM(this.A.pose).elements;
      const [x, y] = this.proj([e[12], e[13], e[14] + 0.6]);
      for (let j = 0; j < 4; j++) put(ctx, icon('flame', 7), x + 12 * sin(t * 40 + j), y + 30 + j * 26, 1 - j * 0.18, 180);
    }
  },
});
