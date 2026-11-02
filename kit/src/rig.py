"""Load the official Axolotl Launcher axolotl.gltf, expose its bones, pose & render (ortho, z-buffer, flat face shading)."""
import json, base64, io, math, numpy as np
from PIL import Image

import os
HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'model') + os.sep
g = json.load(open(HERE + 'axolotl.gltf'))
BUF = base64.b64decode(g['buffers'][0]['uri'].split(',')[1])
TEX0 = Image.open(io.BytesIO(base64.b64decode(g['images'][0]['uri'].split(',')[1]))).convert('RGBA')

def acc(i):
    a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    dt = {5126: 'f4', 5123: 'u2', 5125: 'u4', 5121: 'u1'}[a['componentType']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    arr = np.frombuffer(BUF, dtype=dt, count=a['count'] * n, offset=off).astype(np.float64 if dt == 'f4' else np.int64)
    return arr.reshape(a['count'], n) if n > 1 else arr

def qmat(q):
    x, y, z, w = q
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                     [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                     [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])

def rot_euler(rx=0, ry=0, rz=0):  # degrees, applied X then Y then Z
    rx, ry, rz = map(math.radians, (rx, ry, rz))
    X = np.array([[1,0,0],[0,math.cos(rx),-math.sin(rx)],[0,math.sin(rx),math.cos(rx)]])
    Y = np.array([[math.cos(ry),0,math.sin(ry)],[0,1,0],[-math.sin(ry),0,math.cos(ry)]])
    Z = np.array([[math.cos(rz),-math.sin(rz),0],[math.sin(rz),math.cos(rz),0],[0,0,1]])
    return Z @ Y @ X

def M4(R=np.eye(3), t=(0,0,0)):
    m = np.eye(4); m[:3,:3] = R; m[:3,3] = t; return m

# bone = the parent pivot node (index 1,3,5,...) of each part
NODES = g['nodes']
PARENT = {}
for i, n in enumerate(NODES):
    for c in n.get('children', []): PARENT[c] = i
ROOTS = g['scenes'][0]['nodes']
BONES = {}
for i, n in enumerate(NODES):
    if 'children' in n: BONES[n['name']] = i
# head-attached parts: in the file gills are roots; in MC they're children of head
HEAD_CHILD = {'top_gills', 'left_gills', 'right_gills'}

def node_local(i, pose):
    n = NODES[i]
    R = qmat(n['rotation']) if 'rotation' in n else np.eye(3)
    t = np.array(n.get('translation', [0,0,0]), float)
    if i in BONES.values() and n['name'] in pose:
        p = pose[n['name']]
        if 'set' in p: R = rot_euler(*p['set'])
        R = R @ rot_euler(*p.get('rot', (0,0,0)))
        t = t + np.array(p.get('move', (0,0,0))) / 16
    return M4(R, t)

def world(i, pose):
    m = node_local(i, pose)
    j = i
    while j in PARENT:
        j = PARENT[j]; m = node_local(j, pose) @ m
    if NODES[j]['name'] in HEAD_CHILD:  # attach gill bones to head bone (as in Minecraft)
        hb = BONES['head']
        T = np.array(NODES[hb]['translation'])
        m = node_local(hb, pose) @ M4(np.eye(3), -T) @ m
    return m

def tris(pose):
    out = []
    for i, n in enumerate(NODES):
        if 'mesh' not in n: continue
        W = world(i, pose)
        if 'root' in pose:
            W = M4(rot_euler(*pose['root'].get('rot', (0,0,0))), np.array(pose['root'].get('move', (0,0,0)))/16) @ W
        p = g['meshes'][n['mesh']]['primitives'][0]
        P = acc(p['attributes']['POSITION']); N = acc(p['attributes']['NORMAL']); UV = acc(p['attributes']['TEXCOORD_0'])
        idx = acc(p['indices'])
        Pw = (W[:3,:3] @ P.T).T + W[:3,3]; Nw = (W[:3,:3] @ N.T).T
        for k in range(0, len(idx), 3):
            a, b, c = idx[k:k+3]
            tri = Pw[[a,b,c]]
            if np.linalg.norm(np.cross(tri[1]-tri[0], tri[2]-tri[0]))/2 < 2e-4: continue
            out.append((tri, UV[[a,b,c]], Nw[a], n['name']))
    return out

def camera(yaw, pitch):
    return rot_euler(pitch, 0, 0) @ rot_euler(0, yaw, 0)

def shade_of(nv, C):
    # flat cube shading like the logo: top lightest, front mid, side darker, bottom darkest
    nc = C @ nv; nc /= (np.linalg.norm(nc) + 1e-9)
    if nc[2] < 0: nc = -nc  # double-sided planes face camera
    L = np.array([-0.35, 0.85, 0.45]); L /= np.linalg.norm(L)
    return 0.66 + 0.40 * max(0.0, float(nc @ L))

def render(pose=None, only=None, fit_only=False, yaw=-140, pitch=28, size=1024, scale=None, tex=None, center=None, ss=2, tint=None):
    pose = pose or {}
    tex = np.asarray((tex or TEX0)).astype(np.float64)
    th, tw = tex.shape[:2]
    C = camera(yaw, pitch)
    T = tris(pose)
    ALL = T
    if only: T = [t for t in T if t[3] in only]
    if fit_only: ALL = T
    pts = np.concatenate([t[0] for t in ALL]) @ C.T
    if center is None:
        center = (pts[:, :2].max(0) + pts[:, :2].min(0)) / 2
    if scale is None:
        ext = (pts[:, :2].max(0) - pts[:, :2].min(0)).max()
        scale = 0.80 / ext
    S = size * ss
    global LAST
    LAST = (C, center, scale, size)
    img = np.zeros((S, S, 4)); zb = np.full((S, S), -1e9)
    for P, UV, Nv, name in T:
        q = P @ C.T
        xy = np.stack([(q[:,0]-center[0])*scale*S + S/2, S/2 - (q[:,1]-center[1])*scale*S], 1)
        z = q[:, 2]
        x0, y0 = np.floor(xy.min(0)).astype(int); x1, y1 = np.ceil(xy.max(0)).astype(int)
        x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, S-1), min(y1, S-1)
        if x1 < x0 or y1 < y0: continue
        (ax, ay), (bx, by), (cx, cy) = xy
        den = (by-cy)*(ax-cx) + (cx-bx)*(ay-cy)
        if abs(den) < 1e-9: continue
        X, Y = np.meshgrid(np.arange(x0, x1+1)+0.5, np.arange(y0, y1+1)+0.5)
        w0 = ((by-cy)*(X-cx) + (cx-bx)*(Y-cy)) / den
        w1 = ((cy-ay)*(X-cx) + (ax-cx)*(Y-cy)) / den
        w2 = 1 - w0 - w1
        m = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
        if not m.any(): continue
        zz = w0*z[0] + w1*z[1] + w2*z[2]
        u = w0*UV[0,0] + w1*UV[1,0] + w2*UV[2,0]
        v = w0*UV[0,1] + w1*UV[1,1] + w2*UV[2,1]
        tx = np.clip((u*tw).astype(int), 0, tw-1); ty = np.clip((v*th).astype(int), 0, th-1)
        col = tex[ty, tx]
        m &= col[..., 3] > 12
        sub = zb[y0:y1+1, x0:x1+1]
        m &= zz > sub
        sh = shade_of(Nv, C)
        c = col[..., :3] * sh
        im = img[y0:y1+1, x0:x1+1]
        im[m, :3] = np.clip(c[m], 0, 255); im[m, 3] = 255
        sub[m] = zz[m]
    out = Image.fromarray(img.astype(np.uint8), 'RGBA')
    if ss > 1: out = out.resize((size, size), Image.LANCZOS)
    return out

if __name__ == '__main__':
    print(BONES)
    render().save(HERE + 'test.png')

LAST=None
def project(p):
    C, center, scale, size = LAST
    q = C @ np.asarray(p)
    return ((q[0]-center[0])*scale*size + size/2, size/2 - (q[1]-center[1])*scale*size)

def pivot_world(bone, pose):
    i = BONES[bone]; W = world(i, pose)
    if 'root' in pose:
        W = M4(rot_euler(*pose['root'].get('rot',(0,0,0))), np.array(pose['root'].get('move',(0,0,0)))/16) @ W
    return W[:3,3]
