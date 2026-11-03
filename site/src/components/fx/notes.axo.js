// 内置特效「音符」：两种音符一起飘。
component({
  id: 'notes', type: 'fx', name: '音符',
  setup() {
    const mk = (name, n, spread) => { const r = rng(strHash(name) & 0xfff); return Array.from({ length: n }, () => [name, r.uniform(-spread, spread), r.random(), r.uniform(0.75, 1.15)]); };
    this.a = mk('note', 3, 70); this.b = mk('note2', 2, 80);
  },
  draw(ctx, t, layer) {
    if (layer !== 'top' || !this.LAST) return;
    const [hx, hy] = this.headPt(), per = this.T / 2;
    for (const [list, rise, dx] of [[this.a, 120, 0], [this.b, 130, 40]]) {
      list.forEach(([name, ox, ph, sc], i) => {
        const k = mod(t / per + i / list.length, 1);
        if (k > 0.75) return;
        const u = k / 0.75;
        put(ctx, icon(name, 5), hx + dx + ox * (0.4 + 0.6 * u) + 12 * sin(u * 6 + i), hy - 30 - rise * u,
          sc * (0.6 + 0.4 * easeOutBack(u / 0.3)), 0, clamp(u / 0.15) * clamp((1 - u) / 0.3));
      });
    }
  },
});
