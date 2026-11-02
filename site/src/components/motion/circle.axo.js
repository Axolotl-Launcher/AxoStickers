// 内置动作「绕圈游」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'circle', type: 'motion', name: '绕圈游',
  move(a, t) {
    const ang = 2 * PI * this.ph(t) + PI / 2;
    a.dx += 75 * cos(ang); a.dy += 14 * sin(ang); a.zoom = 1 + 0.1 * sin(ang);
    a.yaw = 270 - (ang + PI / 2) * 180 / PI;
    for (const l of LEGS) addrot(a, l, 0, 25 * this.ls(t, 12, l === 'leg1' || l === 'leg4' ? 1 : 0));
    addrot(a, 'tail', 0, 25 * this.ls(t, 6)); this.stage.rippleDx = a.dx;
  },
});
