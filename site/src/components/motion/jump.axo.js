// 内置动作「跳水」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'jump', type: 'motion', name: '跳水',
  params: {
    flip: { label: '空翻', type: 'bool', default: 0 },
  },
  setup() { this.t0 = 0.16 * this.T; this.t1 = 0.6 * this.T; this.splash(this.t0, 0, 16, 1.0); this.splash(this.t1 + 0.05, 0, 20, 1.1); },
  move(a, t) {
    const flip = this.p.flip;
    if (t < this.t0) { const u = t / this.t0; a.dy += 18 * bump(u); a.sy = 1 - 0.06 * bump(u); }
    else if (t < this.t1) {
      const k = (t - this.t0) / (this.t1 - this.t0);
      a.dy -= 210 * 4 * k * (1 - k);
      addrot(a, 'root', 30 - 60 * k - flip * 360 * easeIO(k));
      a.sy = k < 0.25 ? 1 + 0.08 * bump(k / 0.25) : 1;
      for (const l of LEGS) addrot(a, l, -25 * bump(k));
      addrot(a, 'tail', 20 * bump(k));
    } else {
      const u = (t - this.t1) / (this.T - this.t1);
      a.dy += u < 0.6 ? 70 * bump(u / 0.6) : 0;
    }
  },
});
