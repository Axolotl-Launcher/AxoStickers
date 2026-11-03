// 内置动作「撞墙」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'bonk', type: 'motion', name: '撞墙',
  move(a, t) {
    const k = this.ph(t, 2); this._k = k;
    if (k < 0.3) { a.zoom = 1 + 0.3 * easeIn(k / 0.3); a.dy -= 25 * easeIn(k / 0.3); }
    else if (k < 0.42) { a.zoom = 1.3; a.dy -= 25; const b = bump((k - 0.3) / 0.12); a.sx = 1 + 0.14 * b; a.sy = 1 - 0.1 * b; }
    else { const u = easeOut((k - 0.42) / 0.4); a.zoom = 1.3 - 0.3 * u; a.dy -= 25 * (1 - u); }
    if (k >= 0.3 && k < 0.6) a.pose._face = { L: 'squeeze', R: 'squeeze', mouth: 'wavy' };
  },
  drawTop(ctx) {
    if (!this.LAST || !(this._k >= 0.3 && this._k < 0.62)) return;
    const [hx, hy] = this.headPt(), u = (this._k - 0.3) / 0.32;
    for (let j = 0; j < 3; j++) {
      const a_ = 2 * PI * (u + j / 3);
      star(ctx, hx + 70 * cos(a_), hy - 60 + 14 * sin(a_), 12 * (1 - u * 0.5), [255, 214, 64]);
    }
  },
});
