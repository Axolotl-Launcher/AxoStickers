// 内置特效「流汗」。
component({
  id: 'sweat', type: 'fx', name: '流汗',
  params: { big: { label: '大颗', type: 'bool', default: 0 } },
  draw(ctx, t, layer) {
    if (layer !== 'front' || !this.LAST) return;
    const [hx, hy] = this.headPt(), u = mod(t / this.T * 2, 1);
    put(ctx, icon('sweat', this.p.big ? 7 : 5), hx - 62, hy - 48 + 30 * easeOut(u), 1, 0, clamp((1 - u) / 0.3));
  },
});
