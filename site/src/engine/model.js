// 换模型：读 .glb / .gltf（Blockbench 导出的那种方块模型），按 kit/src/rig2.py 的办法拆成逐像素的体素面片：
// 方块的每个面按贴图像素切成小格，薄片（鳃、尾巴）挤成 1 像素厚。骨骼按节点名对上（head、tail、leg1…），
// 动作就都能用；整体缩放到和原版差不多大。不联网：外部 uri 一律不认，只吃内嵌的 buffer 和贴图。
import { makeCanvas } from './core.js';

const U = 1 / 16;
const LIMIT = { bytes: 4 << 20, nodes: 80, quads: 60000, tex: 256, rows: 200000 };

function parseContainer(bytes) {
  const b = new Uint8Array(bytes), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length > LIMIT.bytes) throw new Error('模型文件太大（上限 4 MB）');
  if (dv.getUint32(0, true) === 0x46546c67) {                         // 'glTF'：GLB
    const jsonLen = dv.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(b.subarray(20, 20 + jsonLen)));
    let bin = null, o = 20 + jsonLen;
    if (o + 8 <= b.length && dv.getUint32(o + 4, true) === 0x004e4942) bin = b.subarray(o + 8, o + 8 + dv.getUint32(o, true));
    return { json, bin };
  }
  return { json: JSON.parse(new TextDecoder().decode(b)), bin: null };
}
function dataUri(uri) {
  const m = /^data:[^;,]*(;base64)?,(.*)$/s.exec(uri || '');
  if (!m) throw new Error('模型里引用了外部文件，只支持把贴图和数据都内嵌的 .glb / .gltf');
  const s = m[1] ? atob(m[2]) : decodeURIComponent(m[2]);
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

// bytes -> { nodes, parent, bones, headChild, headMesh, mesh: { i: quads }, meshName }（和 engine.json 一个结构）
export async function loadModel(bytes) {
  const { json: g, bin } = parseContainer(bytes);
  for (const ext of g.extensionsRequired || []) throw new Error(`不支持模型扩展 ${ext}`);
  if ((g.nodes || []).length > LIMIT.nodes) throw new Error('节点太多了');
  const bufs = (g.buffers || []).map((bf) => (bf.uri ? dataUri(bf.uri) : bin));
  const bad = (what) => { throw new Error(`模型文件坏了：${what}`); };
  const int = (v) => Number.isInteger(v) && v >= 0;
  const view = (i) => {                                               // 每个长度、偏移都按文件里真有的字节核对，不信文件自己报的数
    const v = g.bufferViews?.[i], buf = v && bufs[v.buffer];
    if (!v || !buf || !int(v.byteLength) || !int(v.byteOffset ?? 0) || (v.byteOffset || 0) + v.byteLength > buf.length) bad(`bufferView ${i}`);
    return buf.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
  };
  let rowsLeft = LIMIT.rows;
  const acc = (i) => {
    const a = g.accessors?.[i], n = a && { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const T = a && { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array, 5121: Uint8Array }[a.componentType];
    if (!n || !T || !int(a.count) || !int(a.byteOffset ?? 0)) bad(`accessor ${i}`);
    const v = view(a.bufferView), off = a.byteOffset || 0, len = a.count * n * T.BYTES_PER_ELEMENT;
    if (off + len > v.byteLength) bad(`accessor ${i} 比数据长`);
    if ((rowsLeft -= a.count) < 0) throw new Error('模型太细了（顶点太多）');
    const arr = new T(v.buffer.slice(v.byteOffset + off, v.byteOffset + off + len));
    const rows = []; for (let k = 0; k < a.count; k++) rows.push(n === 1 ? arr[k] : Array.from(arr.subarray(k * n, k * n + n)));
    return rows;
  };
  // 贴图（第一张）
  const img = g.images?.[0];
  if (!img) throw new Error('模型没有贴图');
  const blob = new Blob([img.uri ? dataUri(img.uri) : view(img.bufferView)], { type: img.mimeType || 'image/png' });
  const bmp = await createImageBitmap(blob);
  if (bmp.width > LIMIT.tex || bmp.height > LIMIT.tex) throw new Error(`贴图太大了（上限 ${LIMIT.tex}×${LIMIT.tex}）`);
  const cv = makeCanvas(bmp.width, bmp.height), cg = cv.getContext('2d');
  cg.drawImage(bmp, 0, 0);
  const tex = cg.getImageData(0, 0, bmp.width, bmp.height), TW = tex.width, TH = tex.height;
  const texel = (x, y) => { const o = (y * TW + x) * 4; return [tex.data[o], tex.data[o + 1], tex.data[o + 2], tex.data[o + 3]]; };

  const parent = {};
  g.nodes.forEach((n, i) => (n.children || []).forEach((c) => { parent[c] = i; }));
  // 节点的缩放（scale）直接烤进面片和子节点的位移里：引擎的骨骼只认位移和旋转。等比缩放是精确的，不等比的只在没转过的轴上精确。
  const cum = (i, seen = 0) => { const s = g.nodes[i].scale || [1, 1, 1], up = i in parent && seen < 80 ? cum(parent[i], seen + 1) : [1, 1, 1]; return s.map((v, a) => v * up[a]); };
  const nodes = g.nodes.map((n, i) => {
    const up = i in parent ? cum(parent[i]) : [1, 1, 1];
    return { name: String(n.name || '').toLowerCase().replace(/[^a-z0-9_]/g, ''), t: (n.translation || [0, 0, 0]).map((v, a) => v * up[a]), q: n.rotation || null, children: n.children || [], mesh: n.mesh !== undefined };
  });
  const bones = {};
  nodes.forEach((n, i) => { if (n.children.length && !(n.name in bones)) bones[n.name] = i; });
  const mesh = {}, meshName = {};
  let total = 0;
  g.nodes.forEach((n, i) => {
    if (n.mesh === undefined) return;
    const prim = g.meshes?.[n.mesh]?.primitives?.[0];
    if (!prim?.attributes || prim.indices === undefined) bad(`mesh ${n.mesh}`);
    const sc = cum(i);
    const P = acc(prim.attributes.POSITION).map((p) => p.map((v, a) => v * sc[a])), UV = acc(prim.attributes.TEXCOORD_0), N = acc(prim.attributes.NORMAL), idx = acc(prim.indices);
    if (idx.some((k) => k >= P.length || k >= UV.length || k >= N.length)) bad(`mesh ${n.mesh} 的下标越界`);
    const name = nodes[parent[i] ?? i].name || nodes[i].name;
    const quads = quadsFor(P, UV, N, idx, TW, TH, texel);
    total += quads.length;
    if (total > LIMIT.quads) throw new Error('模型太细了（面片太多）');
    mesh[i] = quads; meshName[i] = name;
  });
  const headMesh = +Object.keys(meshName).find((i) => meshName[i] === 'head') || +Object.keys(meshName)[0];
  return normalize({ nodes, parent, bones, headChild: ['top_gills', 'left_gills', 'right_gills'], headMesh, mesh, meshName });
}

const sub = (a, b) => a.map((v, i) => v - b[i]);
function quadsFor(P, UV, N, idx, TW, TH, texel) {
  const lo = [0, 1, 2].map((a) => Math.min(...P.map((p) => p[a]))), hi = [0, 1, 2].map((a) => Math.max(...P.map((p) => p[a])));
  const ext = hi.map((v, a) => v - lo[a]);
  const out = [];
  const mapper = (vs) => {                                            // (u, v) -> 位置
    const [p0, p1, p2] = vs.map((k) => P[k]), [u0, u1, u2] = vs.map((k) => UV[k]);
    const a = u1[0] - u0[0], b = u2[0] - u0[0], c = u1[1] - u0[1], d = u2[1] - u0[1], det = a * d - b * c;
    if (Math.abs(det) < 1e-12) return null;
    const e1 = sub(p1, p0), e2 = sub(p2, p0);
    const inv = [d / det, -b / det, -c / det, a / det];
    return (u, v) => { const du = u - u0[0], dw = v - u0[1], s = inv[0] * du + inv[1] * dw, t = inv[2] * du + inv[3] * dw; return p0.map((x, i) => x + e1[i] * s + e2[i] * t); };
  };
  const rect = (vs) => {
    const us = vs.map((k) => UV[k][0] * TW), ws = vs.map((k) => UV[k][1] * TH);
    return [Math.round(Math.min(...us)), Math.round(Math.max(...us)), Math.round(Math.min(...ws)), Math.round(Math.max(...ws))];
  };
  const ax = ext.indexOf(Math.min(...ext));
  if (ext[ax] * 16 < 0.01) {                                          // 薄片：挤成 1 像素厚
    let best = null;
    for (const sgn of [1, -1]) {
      const tris = []; for (let k = 0; k < idx.length; k += 3) if (N[idx[k]][ax] * sgn > 0.5) tris.push(k);
      const vs = [...new Set(tris.flatMap((k) => [idx[k], idx[k + 1], idx[k + 2]]))];
      if (vs.length < 3) continue;
      const [x0, x1, y0, y1] = rect(vs); let cnt = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (texel(x, y)[3] > 12) cnt++;
      if (!best || cnt > best[0]) best = [cnt, vs];
    }
    if (!best) return out;
    const vs = best[1], pos = mapper(vs.slice(0, 3));
    if (!pos) return out;
    const nrm = [0, 0, 0]; nrm[ax] = 1;
    const mid = P.reduce((s, p) => s + p[ax], 0) / P.length, h = U / 2;
    const [x0, x1, y0, y1] = rect(vs), solid = new Map();
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const c = texel(x, y); if (c[3] > 12) solid.set(`${x},${y}`, c.slice(0, 3)); }
    for (const [key, col] of solid) {
      const [x, y] = key.split(',').map(Number);
      const cs = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]].map(([u, v]) => { const q = pos(u / TW, v / TH); q[ax] = mid; return q; });
      const F = cs.map((q) => q.map((v, i) => v + nrm[i] * h)), B = cs.map((q) => q.map((v, i) => v - nrm[i] * h));
      out.push([F.flat(), col, nrm]); out.push([B.slice().reverse().flat(), col, nrm.map((v) => -v)]);
      const ctr = cs.reduce((s, q) => s.map((v, i) => v + q[i] / 4), [0, 0, 0]);
      for (const [nx, ny, e0, e1] of [[x, y - 1, 0, 1], [x + 1, y, 1, 2], [x, y + 1, 2, 3], [x - 1, y, 3, 0]]) {
        if (solid.has(`${nx},${ny}`)) continue;
        const en = F[e0].map((v, i) => (v + F[e1][i]) / 2 - ctr[i]); en[ax] = 0;
        out.push([[F[e0], F[e1], B[e1], B[e0]].flat(), col, en]);
      }
    }
    return out;
  }
  for (let k = 0; k + 5 < idx.length; k += 6) {                      // 方块：每个面按像素切
    const vs = [...new Set(idx.slice(k, k + 6))];
    if (vs.length < 3) continue;
    const n = N[vs[0]], [x0, x1, y0, y1] = rect(vs);
    const pos = mapper(vs.slice(0, 3));
    if (!pos || x1 <= x0 || y1 <= y0) {                                // 贴图坐标缩成一个点：整面一个颜色（调色板式的模型）
      const u = UV[vs[0]], c = texel(Math.min(TW - 1, Math.floor(u[0] * TW)), Math.min(TH - 1, Math.floor(u[1] * TH)));
      if (c[3] <= 12 || vs.length !== 4) continue;
      const ctr = [0, 1, 2].map((a) => vs.reduce((s, v) => s + P[v][a], 0) / 4);
      const ax2 = [0, 1, 2].filter((a) => Math.abs(n[a]) < 0.5);       // 绕法线排成一圈
      const order = vs.slice().sort((a, b) => Math.atan2(P[a][ax2[1]] - ctr[ax2[1]], P[a][ax2[0]] - ctr[ax2[0]]) - Math.atan2(P[b][ax2[1]] - ctr[ax2[1]], P[b][ax2[0]] - ctr[ax2[0]]));
      out.push([order.flatMap((v) => P[v]), c.slice(0, 3), n]);
      continue;
    }
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const c = texel(x, y);
        if (c[3] <= 12) continue;
        out.push([[pos(x / TW, y / TH), pos((x + 1) / TW, y / TH), pos((x + 1) / TW, (y + 1) / TH), pos(x / TW, (y + 1) / TH)].flat(), c.slice(0, 3), n]);
      }
    }
  }
  return out;
}

// 缩放 / 平移到和原版差不多：高 1 个单位上下，底部和原版对齐（直接改面片和节点位移）
function normalize(M) {
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const worldT = (i) => { let t = [0, 0, 0], j = i; while (j !== undefined) { t = t.map((v, a) => v + M.nodes[j].t[a]); j = M.parent[j]; } return t; };
  for (const [i, quads] of Object.entries(M.mesh)) {
    const t = worldT(+i);
    for (const [p] of quads) for (let k = 0; k < 12; k += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p[k + a] + t[a]); hi[a] = Math.max(hi[a], p[k + a] + t[a]); }
  }
  const size = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 1;
  const s = 1.69 / size;                                              // 原版美西螈最长边 1.69 单位（头到尾）
  const sc = (v) => v.map((x) => x * s);
  for (const n of M.nodes) n.t = sc(n.t);
  for (const quads of Object.values(M.mesh)) for (const q of quads) q[0] = q[0].map((v) => v * s);
  M.scale = s;
  return M;
}
