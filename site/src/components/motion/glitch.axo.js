// 内置动作「卡了」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'glitch', type: 'motion', name: '卡了',
  params: {
    seed: { label: '随机种子', type: 'int', min: 0, max: 999, default: 0 },
  },
  move(a, t) {
    const step = Math.floor(Math.round(t * FPS) / 3), r = rng(step * 7919 + this.p.seed);
    const f = new Ax(); this.idle(f, step * 3 / FPS); a.pose = f.pose; a.dy = f.dy;
    if (step % Math.max(1, Math.floor(this.N / 3)) && r.random() < 0.55) {
      a.dx += r.choice([-26, -14, 14, 26]); a.dy += r.choice([-10, 0, 10]); a.rgb = r.choice([0, 5, 8]);
    }
    this.stage.rippleOn = false;
  },
});
