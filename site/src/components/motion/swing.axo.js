// 内置动作「挥工具」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'swing', type: 'motion', name: '挥工具',
  holdsItself: true,
  params: {
    n: { label: '挥几下', type: 'int', min: 1, max: 8, default: 3 },
    debris: { label: '碎石', type: 'bool', default: 0 },
  },
  setup() { this.kind = this.spec.hold || 'pickaxe'; },
  move(a, t) {
    const k = this.ph(t, this.p.n), sw = k < 0.3 ? easeIn(k / 0.3) : 1 - easeOut((k - 0.3) / 0.7);
    this.hold(a, this.kind, { x: 5.4, y: 7.0, z: -12.5, rz: -40 + 110 * sw, s: 0.7 });
    addrot(a, 'head', -10 * sw, -6 * sw);
    this._hit = k;
  },
  drawFront(ctx) {
    if (!this.p.debris || !(this._hit < 0.35) || !this.LAST) return;
    const u = clamp((this._hit - 0.25) / 0.1), [hx, hy] = this.headPt();
    for (let j = 0; j < 6; j++) {
      const ang = -PI / 2 + (j - 2.5) * 0.45, r = 20 + 60 * u;
      sq(ctx, hx + 110 + cos(ang) * r, hy + 40 + sin(ang) * r, 12 * (1 - u * 0.5), j % 2 ? [150, 150, 160] : [110, 110, 120], [60, 60, 70], 2);
    }
  },
});
