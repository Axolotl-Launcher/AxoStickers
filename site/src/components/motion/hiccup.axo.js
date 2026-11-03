// 内置动作「打嗝」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'hiccup', type: 'motion', name: '打嗝',
  move(a, t) {
    const k = this.ph(t, 2);
    if (k < 0.16) {
      const b = bump(k / 0.16); a.dy -= 26 * b; a.sy = 1 + 0.1 * b; a.sx = 1 - 0.05 * b;
      a.pose._face = { L: 'big', R: 'big', mouth: 'o' };
    }
    this._k = k;
  },
  drawTop(ctx) {
    if (!this.LAST || !(this._k > 0.02 && this._k < 0.5)) return;
    const [hx, hy] = this.headPt([0, 9, -7.5]), u = (this._k - 0.02) / 0.48;
    put(ctx, icon('hic', 5), hx + 60 + 20 * u, hy - 40 - 70 * u, 0.6 + 0.6 * u, 0, clamp((1 - u) / 0.3));
  },
});
