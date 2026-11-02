// 内置动作「啃」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'chomp', type: 'motion', name: '啃',
  holdsItself: true,
  params: {
    s: { label: '道具大小', type: 'number', min: 0.3, max: 2, default: 1 },
  },
  move(a, t) {
    const kind = this.spec.hold || 'cookie', k = this.ph(t), bites = Math.floor(k * 4);
    const s = (SPRITES[kind] ? SPR_S * 1.4 : 1.0) * Math.max(0, 1 - bites * 0.22) * (this.p.s);
    const kk = mod(k * 4, 1), b = kk < 0.3 ? bump(kk / 0.3) : 0;
    addrot(a, 'head', 12 * b - 4);
    this.hold(a, kind, { x: 0.5, y: 6.4, z: -12.8 + 0.8 * b, rz: 0, s: Math.max(s, 0.001), legs: 1.0 });
  },
});
