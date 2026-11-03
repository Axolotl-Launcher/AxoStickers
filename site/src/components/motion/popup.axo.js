// 内置动作「冒出来」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'popup', type: 'motion', name: '冒出来',
  setup() { this.splash(0.58 * this.T, 0, 8, 0.5, 50); this.splash(0.82 * this.T, 0, 24, 1.25); },
  move(a, t) {
    const k = this.ph(t);
    if (k < 0.5) return;
    if (k < 0.6) { a.dy += 270 * easeIn((k - 0.5) / 0.1); addrot(a, 'root', -25 * ((k - 0.5) / 0.1)); }
    else if (k < 0.8) { a.dy += 300; a.show = false; }
    else {
      const u = (k - 0.8) / 0.2;
      if (u < 0.4) { a.dy += lerp(300, -60, easeOut(u / 0.4)); a.sy = 1.14; a.sx = 0.92; addrot(a, 'root', 20); }
      else {
        a.dy += -60 * (1 - easeOutBack((u - 0.4) / 0.6, 2.4));
        const b = bump((u - 0.4) / 0.25); a.sy = 1 - 0.08 * b; a.sx = 1 + 0.06 * b;
      }
    }
  },
});
