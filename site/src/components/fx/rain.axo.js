// 内置特效「头顶下雨」。
component({
  id: 'rain', type: 'fx', name: '头顶下雨',
  params: { cloud: { label: '云', type: 'select', options: [['dark', '乌云'], ['cloud', '白云']], default: 'dark' } },
  setup() { const r = rng(9); this.D = Array.from({ length: 9 }, () => [r.uniform(-60, 60), r.random()]); },
  draw(ctx, t, layer) {
    if (!this.LAST) return;
    const [hx, hy] = this.headPt(), cx = hx, cy = hy - 150 + 4 * this.ls(t, 2);
    if (layer === 'back') {
      for (const [ox, ph] of this.D) {
        const u = mod(t / this.T * 4 + ph, 1), x = cx + ox, y = cy + 20 + u * 160;
        line(ctx, [[x, y], [x - 4, y + 16]], [108, 170, 235], 4);
      }
    }
    if (layer === 'top') put(ctx, icon(this.p.cloud, 9), cx, cy, 1, 0);
  },
});
