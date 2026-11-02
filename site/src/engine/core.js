// 引擎核心的 JS 版：数学、骨骼姿势、体素面片和 three.js 渲染。对应 engine/axl.py、kit/src/rig.py / rig2.py / face_cam.py、engine/items.py。
// 模型面片、表情格子、道具数据都来自 tools/export_engine.py 导出的 gen/engine.json，和 Python 引擎是同一份。
import {
  WebGLRenderer, Scene, Mesh, BufferGeometry, BufferAttribute, ShaderMaterial, Matrix4, Quaternion, Camera, DoubleSide,
} from 'three';
import E from '../gen/engine.json';

export { E };
export const K = E.const;
export const { W, H, FPS, YAW, PITCH, BOX } = K;
export const U = 1 / 16;

// ---------------- math (axl.py) ----------------
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const easeOut = (t) => { t = clamp(t); return 1 - (1 - t) ** 3; };
export const easeIn = (t) => { t = clamp(t); return t ** 3; };
export const easeIO = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const easeOutBack = (t, s = 1.9) => { t = clamp(t) - 1; return 1 + (s + 1) * t ** 3 + s * t ** 2; };
export const elastic = (t) => {
  t = clamp(t);
  if (t === 0 || t === 1) return t;
  return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * 2 * Math.PI / 3) + 1;
};
export const bump = (t) => Math.sin(Math.PI * clamp(t));
export const win = (t, a, b, fade = 0.15) => clamp((t - a) / fade) * clamp((b - t) / fade);
export const mod = (a, b) => ((a % b) + b) % b;          // Python 的 %：结果和除数同号
export const rad = (d) => d * Math.PI / 180;
export function pyRound(x) {                              // Python 的 round()：.5 取偶
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

export function rng(seed) {                               // 可复现的随机数（mulberry32），接口学 random.Random
  let a = (seed >>> 0) || 1;
  const random = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { random, uniform: (lo, hi) => lo + (hi - lo) * random(), choice: (arr) => arr[Math.floor(random() * arr.length)] };
}
export function strHash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; }

export const hx = (s) => [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];

// ---------------- matrices (rig.py) ----------------
export function rotEuler(rx = 0, ry = 0, rz = 0) {        // 度数，先 X 再 Y 再 Z
  const X = new Matrix4().makeRotationX(rad(rx)), Y = new Matrix4().makeRotationY(rad(ry)), Z = new Matrix4().makeRotationZ(rad(rz));
  return Z.multiply(Y).multiply(X);
}
const M4 = (R, t = [0, 0, 0]) => { const m = R ? R.clone() : new Matrix4(); m.setPosition(t[0], t[1], t[2]); return m; };
export const camera = (yaw, pitch) => rotEuler(pitch, 0, 0).multiply(rotEuler(0, yaw, 0));

const NODES = E.nodes;
const PARENT = Object.fromEntries(Object.entries(E.parent).map(([k, v]) => [+k, v]));
const BONE_IDX = new Set(Object.values(E.bones));
const HEAD_CHILD = new Set(E.headChild);

function nodeLocal(i, pose) {
  const n = NODES[i];
  const m = new Matrix4();
  if (n.q) m.makeRotationFromQuaternion(new Quaternion(n.q[0], n.q[1], n.q[2], n.q[3]));
  let t = n.t;
  const p = BONE_IDX.has(i) && pose[n.name];
  if (p) {
    if (p.set) m.copy(rotEuler(...p.set));
    if (p.rot) m.multiply(rotEuler(...p.rot));
    if (p.move) t = t.map((v, k) => v + p.move[k] / 16);
  }
  m.setPosition(t[0], t[1], t[2]);
  return m;
}

function world(i, pose) {
  const m = nodeLocal(i, pose);
  let j = i;
  while (j in PARENT) { j = PARENT[j]; m.premultiply(nodeLocal(j, pose)); }
  if (HEAD_CHILD.has(NODES[j].name)) {                     // 鳃挂到头骨上（和 Minecraft 一样）
    const hb = E.bones.head, T = NODES[hb].t;
    m.premultiply(new Matrix4().makeTranslation(-T[0], -T[1], -T[2])).premultiply(nodeLocal(hb, pose));
  }
  return m;
}

export function rootM(pose) {
  const r = pose.root;
  if (!r) return new Matrix4();
  const mv = r.move || [0, 0, 0];
  return M4(rotEuler(...(r.rot || [0, 0, 0])), [mv[0] / 16, mv[1] / 16, mv[2] / 16]);
}
export const headWorld = (pose) => rootM(pose).multiply(world(E.headMesh, pose));

export function itemXf(pose, it) {
  const at = it.at || 'head';
  const Wm = at === 'head' ? headWorld(pose) : at === 'root' ? rootM(pose) : new Matrix4();
  const R = rotEuler(it.rx || 0, it.ry || 0, it.rz || 0);
  if (E.gear[it.kind] && it.x === undefined) return Wm.multiply(R);
  R.multiplyScalar(it.s ?? 1); R.elements[15] = 1;
  return Wm.multiply(M4(R, [(it.x || 0) * U, (it.y || 0) * U, (it.z ?? -13) * U]));
}
export function xfPoint(M, p) {                            // 模型像素 -> 世界坐标
  const e = M.elements, x = p[0] * U, y = p[1] * U, z = p[2] * U;
  return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
}

// ---------------- voxel quads ----------------
// 一个 quad = [4 个角 (12 个数), rgb, 法线]，坐标是模型单位（1/16 = 一个像素）
function box(x0, y0, z0, x1, y1, z1, col, out) {
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]
    .map((p) => p.map((c) => c * U));
  const F = [[[0, 3, 2, 1], [0, 0, -1]], [[4, 5, 6, 7], [0, 0, 1]], [[0, 1, 5, 4], [0, -1, 0]],
    [[3, 7, 6, 2], [0, 1, 0]], [[0, 4, 7, 3], [-1, 0, 0]], [[1, 2, 6, 5], [1, 0, 0]]];
  for (const [ix, n] of F) out.push([ix.flatMap((k) => v[k]), col, n]);
  return out;
}
function bitmap(rows, pal, depth = 1, px = 1) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length)), q = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') { x++; continue; }
      let x1 = x;
      while (x1 + 1 < row.length && row[x1 + 1] === ch) x1++;
      const X0 = (x - w / 2) * px, X1 = (x1 + 1 - w / 2) * px, Y1 = (h / 2 - y) * px, Y0 = Y1 - px;
      box(-X1, Y0, -depth / 2, -X0, Y1, depth / 2, hx(pal[ch]), q);   // x 镜像，屏幕上从左往右读
      x = x1 + 1;
    }
  });
  return q;
}
const boxes = (lst) => { const q = []; for (const b of lst) box(b[0], b[1], b[2], b[3], b[4], b[5], hx(b[6]), q); return q; };

export function itemQuads(kind) {
  if (E.spr[kind]) return bitmap(...E.spr[kind]);
  if (E.blk[kind]) return boxes(E.blk[kind]);
  if (E.gear[kind]) return boxes(E.gear[kind]);
  throw new Error('unknown item ' + kind);
}

function faceQuads(f) {
  const cells = [];
  for (const [c, r, col] of E.eyes[f.R || 'open']) cells.push([c, r, col]);
  for (const [c, r, col] of E.eyes[f.L || 'open']) cells.push([15 - c, r, col]);
  for (const cell of E.mouths[f.mouth || 'normal']) cells.push(cell);
  if (f.blush) for (const cell of E.blush) cells.push(cell);
  const d = new Map();
  for (const [c, r, col] of cells) d.set(c + ',' + r, [c, r, col]);   // 后写的盖住先写的
  const e = 0.03, z = K.FACE_Z, q = [];
  for (const [c, r, col] of d.values()) {
    const x0 = (-4 + c * 0.5 - e) * U, y0 = (4 + r * 0.5 - e) * U, x1 = (-4 + c * 0.5 + 0.5 + e) * U, y1 = (4 + r * 0.5 + 0.5 + e) * U;
    q.push([[x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z], hx(col), [0, 0, -1]]);
  }
  return q;
}

function geometry(quads) {
  const n = quads.length, P = new Float32Array(n * 12), N = new Float32Array(n * 12), C = new Float32Array(n * 12);
  const I = new Uint32Array(n * 6);
  quads.forEach(([p, col, nr], k) => {
    for (let v = 0; v < 4; v++) {
      for (let a = 0; a < 3; a++) {
        P[k * 12 + v * 3 + a] = p[v * 3 + a]; N[k * 12 + v * 3 + a] = nr[a]; C[k * 12 + v * 3 + a] = col[a] / 255;
      }
    }
    I.set([k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3], k * 6);
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(P, 3));
  g.setAttribute('normal', new BufferAttribute(N, 3));
  g.setAttribute('aColor', new BufferAttribute(C, 3));
  g.setIndex(new BufferAttribute(I, 1));
  return g;
}

// 平涂：顶面往白 +32%（腿只 +10%），底面 ×0.72，左右侧面 ×0.9，前后原色（rig2.shade）。背面剔除按相机空间法线 z。
const VERT = `
attribute vec3 aColor;
uniform float uTop;
varying vec3 vCol;
varying float vFacing;
void main() {
  vec3 n = normalize(mat3(modelMatrix) * normal);
  vec3 c = aColor;
  if (n.y > 0.7) c = c + (1.0 - c) * uTop;
  else if (n.y < -0.7) c = c * 0.72;
  else if (abs(n.x) > abs(n.z)) c = c * 0.9;
  vCol = c;
  vFacing = (mat3(viewMatrix) * n).z;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}`;
const FRAG = `
varying vec3 vCol;
varying float vFacing;
void main() {
  if (vFacing < -1e-6) discard;
  gl_FragColor = vec4(vCol, 1.0);
}`;
const material = (top) => new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uTop: { value: top } }, side: DoubleSide });

// ---------------- the 3D axolotl renderer ----------------
export class AxoRenderer {
  constructor(ss = 2) {
    this.ss = ss;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = BOX * ss;
    this.gl = new WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: true, preserveDrawingBuffer: true });
    this.gl.setPixelRatio(1);
    this.gl.setSize(BOX * ss, BOX * ss, false);
    this.gl.setClearColor(0x000000, 0);
    this.scene = new Scene();
    this.scene.matrixWorldAutoUpdate = true;
    this.cam = new Camera();
    this.cam.matrixAutoUpdate = false; this.cam.matrixWorldAutoUpdate = false;
    this.matBody = material(0.32); this.matLeg = material(0.10);
    this.parts = [];
    for (const [i, m] of Object.entries(E.mesh)) {
      const quads = [];
      for (let k = 0; k < m.c.length; k++) quads.push([m.p.slice(k * 12, k * 12 + 12), hx(m.c[k]), m.n.slice(k * 3, k * 3 + 3)]);
      const name = E.meshName[i];
      const mesh = new Mesh(geometry(quads), name.startsWith('leg') ? this.matLeg : this.matBody);
      mesh.matrixAutoUpdate = false; mesh.frustumCulled = false;
      this.scene.add(mesh); this.parts.push([+i, mesh]);
    }
    this.faceMesh = new Mesh(new BufferGeometry(), this.matBody);
    this.faceMesh.matrixAutoUpdate = false; this.faceMesh.frustumCulled = false; this.scene.add(this.faceMesh);
    this.faceKey = null; this.faceGeo = new Map();
    this.itemGeo = new Map(); this.itemMeshes = [];
  }

  _face(f) {
    const key = f ? JSON.stringify(f) : '';
    if (key === this.faceKey) return;
    this.faceKey = key;
    if (!key) { this.faceMesh.visible = false; return; }
    if (!this.faceGeo.has(key)) this.faceGeo.set(key, geometry(faceQuads(f)));
    this.faceMesh.geometry = this.faceGeo.get(key); this.faceMesh.visible = true;
  }

  _items(pose) {
    const list = pose._items || [];
    while (this.itemMeshes.length < list.length) {
      const m = new Mesh(new BufferGeometry(), this.matBody);
      m.matrixAutoUpdate = false; m.frustumCulled = false; this.scene.add(m); this.itemMeshes.push(m);
    }
    this.itemMeshes.forEach((m, k) => {
      const it = list[k];
      m.visible = !!it;
      if (!it) return;
      if (!this.itemGeo.has(it.kind)) this.itemGeo.set(it.kind, geometry(itemQuads(it.kind)));
      m.geometry = this.itemGeo.get(it.kind);
      m.matrix.copy(itemXf(pose, it));
    });
  }

  // a: Ax 状态。返回 LAST = {C, center, scale}，和 rig2.LAST 一样用来把世界坐标投到盒子像素上
  render(a) {
    const C = camera(a.yaw, a.pitch);
    const an = proj3(C, K.ANCHOR);
    const center = [an[0] - K.ANCHOR_OFF[0] / a.zoom, an[1] - K.ANCHOR_OFF[1] / a.zoom];
    const scale = K.SCL_BOX * a.zoom;
    const pose = a.pose, R = rootM(pose);
    for (const [i, mesh] of this.parts) mesh.matrix.copy(R).multiply(world(i, pose));
    this.faceMesh.matrix.copy(headWorld(pose));
    this._face(pose._face);
    this._items(pose);
    // 投影 = rig2._proj：x' = x / (1 - z·P)，再减中心、乘比例；深度 z 越大越近
    const P = K.PERSP, s = scale, zr = 4;
    this.cam.matrixWorldInverse.copy(C);
    this.cam.matrixWorld.copy(C).invert();
    this.cam.projectionMatrix.set(
      2 * s, 0, 2 * s * center[0] * P, -2 * s * center[0],
      0, 2 * s, 2 * s * center[1] * P, -2 * s * center[1],
      0, 0, -1 / zr, P * zr,
      0, 0, -P, 1);
    this.cam.projectionMatrixInverse.copy(this.cam.projectionMatrix).invert();
    this.gl.render(this.scene, this.cam);
    return { C, center, scale };
  }
}

export function proj3(C, p) {                              // 相机空间 + 透视，返回 (x, y) 模型单位
  const e = C.elements;
  const x = e[0] * p[0] + e[4] * p[1] + e[8] * p[2], y = e[1] * p[0] + e[5] * p[1] + e[9] * p[2], z = e[2] * p[0] + e[6] * p[1] + e[10] * p[2];
  const f = 1 / (1 - z * K.PERSP);
  return [x * f, y * f];
}
export function projectBox(LAST, p) {                      // 世界坐标 -> 盒子像素（rig2.project）
  const q = proj3(LAST.C, p);
  return [(q[0] - LAST.center[0]) * LAST.scale * BOX + BOX / 2, BOX / 2 - (q[1] - LAST.center[1]) * LAST.scale * BOX];
}
