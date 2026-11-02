// 美西螈这一帧的状态：骨骼姿势 + 画面上的位移 / 缩放 / 旋转 / 镜头。动作组件改的就是它（engine/axl.py 的 Ax）。
import { E, K } from './core.js';

export class Ax {
  constructor(cam) {
    this.pose = structuredClone(E.rest);
    this.yaw = cam ? cam.yaw : K.YAW; this.pitch = cam ? cam.pitch : K.PITCH;
    this.dx = 0; this.dy = 0; this.sx = 1; this.sy = 1; this.roll = 0; this.zoom = 1;
    this.show = true; this.alpha = 1; this.gray = 0; this.rgb = 0;
  }
}
