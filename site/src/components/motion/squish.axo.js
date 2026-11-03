// 内置动作「被砸扁」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'squish', type: 'motion', name: '被砸扁',
  move(a, t) {
    const k = this.ph(t); this._k = k;
    if (k >= 0.3 && k < 0.55) { a.sy = 0.62; a.sx = 1.3; a.dy += 36; }
    else if (k >= 0.55 && k < 0.8) { const e = elastic((k - 0.55) / 0.25); a.sy = lerp(0.62, 1, e); a.sx = lerp(1.3, 1, e); a.dy += lerp(36, 0, e); }
    if (k >= 0.3 && k < 0.55) a.pose._face = { L: 'squeeze', R: 'squeeze', mouth: 'flat' };
  },
  drawTop(ctx) {
    const k = this._k;
    if (!this.LAST || !(k > 0.08 && k < 0.75)) return;
    const [hx, hy] = this.headPt([0, 9.5, -7.5]);
    let x = hx, y = hy - 26, r = 0;
    if (k < 0.3) y = lerp(-80, hy - 26, easeIn((k - 0.08) / 0.22));
    else if (k >= 0.55) { const u = (k - 0.55) / 0.2; x = hx + 260 * u; y = hy - 26 - 160 * u + 300 * u * u; r = -200 * u; }
    put(ctx, icon('stone', 8), x, y, 1, r);
    if (k >= 0.3 && k < 0.38) {
      for (let j = 0; j < 6; j++) {
        const ang = (200 + j * 28) * PI / 180, r0 = 50 + 120 * (k - 0.3);
        line(ctx, [[hx + cos(ang) * r0, hy - 20 + sin(ang) * r0 * 0.6], [hx + cos(ang) * (r0 + 18), hy - 20 + sin(ang) * (r0 + 18) * 0.6]], [90, 90, 100], 4);
      }
    }
  },
});
