// 内置动作「扑过来」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'pounce', type: 'motion', name: '扑过来',
  move(a, t) {
    const k = this.ph(t);
    if (k < 0.22) { const c = bump(k / 0.22); a.dy += 14 * c; a.sy = 1 - 0.07 * c; }
    else if (k < 0.36) { const u = easeOut((k - 0.22) / 0.14); a.zoom = 1 + 0.45 * u; a.dy -= 46 * u; addrot(a, 'root', 15); }
    else if (k < 0.62) { a.zoom = 1.45 + 0.02 * this.ls(t, 8); a.dy -= 46; }
    else { const u = easeIO((k - 0.62) / 0.25); a.zoom = 1.45 - 0.45 * u; a.dy -= 46 * (1 - u); }
  },
});
