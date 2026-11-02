"""v2: logo-style axolotl. Planes (gills/legs/tail) extruded to 1px voxels, flat logo palette, face-direction shading."""
import numpy as np, math
from PIL import Image
import rig
from rig import g, acc, NODES, BONES, world, M4, rot_euler, camera

TEXA = np.asarray(rig.TEX0).astype(int)
TW = TEXA.shape[1]; TH = TEXA.shape[0]
PX = 1 / 16

def hx(s): return tuple(int(s[i:i+2], 16) for i in (0, 2, 4))
SKIN = hx('fdb8db'); EYE = hx('42147a'); MOUTH = hx('fe61a3')
GILL = hx('fe3e8c'); GILL_L = hx('ff73b2')
TOE = hx('fe4493'); PAD = hx('fdc1e0'); LEG = hx('d673a2'); LEG_D = hx('b8467f')
TAIL_E = hx('e8357d'); TAIL_I = hx('f4a3c9')
BODY_D = hx('ee8fbe')

def lum(c): return 0.3*c[0] + 0.59*c[1] + 0.11*c[2]

SKINMAP = {'fbc1e3': 'fdb8db', 'f3add6': 'fbadd4', 'e384bc': 'f68cc0', 'c8629e': 'e8699f',
           'b14283': 'd4508f', 'a62d74': 'c23d7f', '3a006c': '42147a', 'fcc8e7': 'fec6e2', 'd13674': 'ea3f85'}
def remap(part, c, face_front=False):
    k = '%02x%02x%02x' % c
    L = lum(c)
    if k == '3a006c': return EYE
    if part == 'head':
        if face_front and k == 'c8629e': return MOUTH
        if face_front and k == 'e384bc': return hx('f98ec2')   # cheeks
        return hx(SKINMAP.get(k, 'fdb8db'))
    if part == 'body':
        return hx(SKINMAP.get(k, 'fdb8db'))
    if 'gills' in part:
        if L > 200: return hx('ff86bd')
        if L > 146: return hx('ff6eae')
        if L > 135: return hx('fe3e8c')
        return hx('f0367f')
    if part.startswith('leg'):
        if k == 'fcc8e7': return PAD
        if k == 'd13674': return TOE
        return {'a62d74': hx('9b2c6f'), 'b14283': hx('b0417f'), 'c8629e': hx('d06a9f')}.get(k, LEG)
    if part == 'tail':
        if L > 175: return hx('e9a3c8')
        if L > 150: return hx('ef8ab9')
        if L > 125: return hx('e2427f')
        return hx('d62f72')
    return c

def shade(color, n, part=''):
    n = n / (np.linalg.norm(n) + 1e-9)
    c = np.array(color, float)
    if n[1] > 0.7:            # top: lighter
        return c + (255 - c) * (0.10 if part.startswith('leg') else 0.32)
    if n[1] < -0.7:           # bottom
        return c * 0.72
    if abs(n[0]) > abs(n[2]):  # sides (left/right of the animal)
        return c * 0.9
    return c                   # front/back

def box_or_plane(i):
    p = g['meshes'][NODES[i]['mesh']]['primitives'][0]
    P = acc(p['attributes']['POSITION']); UV = acc(p['attributes']['TEXCOORD_0']); N = acc(p['attributes']['NORMAL'])
    idx = acc(p['indices'])
    ext = P.max(0) - P.min(0)
    return P, UV, N, idx, ext

def quads_for_mesh(i):
    """returns list of (4 local corners, rgb, local normal)"""
    name = NODES[i]['name']
    P, UV, N, idx, ext = box_or_plane(i)
    out = []
    if ext.min() * 16 < 0.01:   # plane -> extrude
        # pick face whose normal is along thin axis and +
        ax = int(np.argmin(ext))
        best = None
        for sgn in (1, -1):
            tri_ids = [k for k in range(0, len(idx), 3) if N[idx[k]][ax] * sgn > 0.5]
            vs_ = np.unique(np.array([idx[k + j] for k in tri_ids for j in range(3)]))
            uu = UV[vs_] * [TW, TH]
            cnt = (TEXA[int(round(uu[:,1].min())):int(round(uu[:,1].max())), int(round(uu[:,0].min())):int(round(uu[:,0].max())), 3] > 12).sum()
            if best is None or cnt > best[0]: best = (cnt, vs_)
        vs = best[1]
        p0, p1, p2 = P[vs[0]], P[vs[1]], P[vs[2]]
        u0, u1, u2 = UV[vs[0]], UV[vs[1]], UV[vs[2]]
        A = np.array([[u1[0]-u0[0], u2[0]-u0[0]], [u1[1]-u0[1], u2[1]-u0[1]]])
        Bm = np.stack([p1 - p0, p2 - p0], 1)      # 3x2
        Mx = Bm @ np.linalg.inv(A)                # 3x2 : d pos / d (u,v)
        def pos(u, v): return p0 + Mx @ np.array([u - u0[0], v - u0[1]])
        nrm = np.zeros(3); nrm[ax] = 1
        mid = P[:, ax].mean()
        us = UV[vs][:, 0] * TW; vv = UV[vs][:, 1] * TH
        tx0, tx1 = int(round(us.min())), int(round(us.max()))
        ty0, ty1 = int(round(vv.min())), int(round(vv.max()))
        solid = {}
        for ty in range(ty0, ty1):
            for tx in range(tx0, tx1):
                c = TEXA[ty, tx]
                if c[3] > 12: solid[(tx, ty)] = remap(name, tuple(int(x) for x in c[:3]))
        h = PX / 2
        for (tx, ty), col in solid.items():
            a = pos(tx / TW, ty / TH); b = pos((tx + 1) / TW, ty / TH)
            c_ = pos((tx + 1) / TW, (ty + 1) / TH); d = pos(tx / TW, (ty + 1) / TH)
            for q in (a, b, c_, d): q[ax] = mid
            off = nrm * h
            F = [a + off, b + off, c_ + off, d + off]; Bk = [a - off, b - off, c_ - off, d - off]
            out.append((np.array(F), col, nrm)); out.append((np.array(Bk[::-1]), col, -nrm))
            # side walls only where neighbour is empty
            edges = [((tx, ty - 1), 0, 1), ((tx + 1, ty), 1, 2), ((tx, ty + 1), 2, 3), ((tx - 1, ty), 3, 0)]
            for nb, e0, e1 in edges:
                if nb in solid: continue
                q = np.array([F[e0], F[e1], Bk[e1], Bk[e0]])
                en = (F[e0] + F[e1]) / 2 - (a + b + c_ + d) / 4; en[ax] = 0
                out.append((q, col, en))
        return out
    # box: split each face into texels
    for k in range(0, len(idx), 6):
        vs = np.unique(idx[k:k + 6])
        if len(vs) != 4: vs = np.unique(idx[k:k+6])
        n = N[vs[0]]
        p0, p1, p2 = P[vs[0]], P[vs[1]], P[vs[2]]
        u0, u1, u2 = UV[vs[0]], UV[vs[1]], UV[vs[2]]
        A = np.array([[u1[0]-u0[0], u2[0]-u0[0]], [u1[1]-u0[1], u2[1]-u0[1]]])
        if abs(np.linalg.det(A)) < 1e-12: continue
        Mx = np.stack([p1 - p0, p2 - p0], 1) @ np.linalg.inv(A)
        def pos(u, v): return p0 + Mx @ np.array([u - u0[0], v - u0[1]])
        us = UV[vs][:, 0] * TW; vv = UV[vs][:, 1] * TH
        front = (name == 'head' and n[2] < -0.5)
        for ty in range(int(round(vv.min())), int(round(vv.max()))):
            for tx in range(int(round(us.min())), int(round(us.max()))):
                c = TEXA[ty, tx]
                if c[3] <= 12: continue
                col = remap(name, tuple(int(x) for x in c[:3]), front)
                q = np.array([pos(tx/TW, ty/TH), pos((tx+1)/TW, ty/TH), pos((tx+1)/TW, (ty+1)/TH), pos(tx/TW, (ty+1)/TH)])
                out.append((q, col, n))
    return out

MESH_Q = {i: quads_for_mesh(i) for i, n in enumerate(NODES) if 'mesh' in n}

def scene(pose):
    out = []
    root = None
    if 'root' in pose:
        root = M4(rot_euler(*pose['root'].get('rot', (0, 0, 0))), np.array(pose['root'].get('move', (0, 0, 0))) / 16)
    for i, Q in MESH_Q.items():
        W = world(i, pose)
        if root is not None: W = root @ W
        R, t = W[:3, :3], W[:3, 3]
        for q, col, n in Q:
            out.append(((R @ q.T).T + t, col, R @ n, NODES[i]['name']))
    return out

LAST = None
PERSP = 0.0   # 0 = orthographic; else 1/camera distance (model units)
def _proj(P):
    q = P.copy()
    if PERSP:
        f = 1.0 / (1.0 - q[:, 2] * PERSP)
        q[:, 0] *= f; q[:, 1] *= f
    return q
def render(pose=None, yaw=160, pitch=22, size=1024, scale=None, center=None, ss=3, only=None, fit_only=False, fit=0.80):
    global LAST
    pose = pose or {}
    C = camera(yaw, pitch)
    Q = scene(pose)
    sel = [q for q in Q if (not only or q[3] in only)]
    pts = _proj(np.concatenate([q[0] for q in (sel if fit_only else Q)]) @ C.T)
    if center is None: center = (pts[:, :2].max(0) + pts[:, :2].min(0)) / 2
    if scale is None: scale = fit / (pts[:, :2].max(0) - pts[:, :2].min(0)).max()
    LAST = (C, center, scale, size)
    S = size * ss
    img = np.zeros((S, S, 4)); zb = np.full((S, S), -1e9)
    for q3, col, n, name in sel:
        nc = C @ n
        if nc[2] < -1e-6: continue        # backface cull (all geometry is closed / doubled)
        cshade = np.clip(shade(col, n, name), 0, 255)
        q = _proj(q3 @ C.T)
        xy = np.stack([(q[:, 0] - center[0]) * scale * S + S / 2, S / 2 - (q[:, 1] - center[1]) * scale * S], 1)
        for tri in ((0, 1, 2), (0, 2, 3)):
            T = xy[list(tri)]; z = q[list(tri), 2]
            x0, y0 = np.floor(T.min(0)).astype(int); x1, y1 = np.ceil(T.max(0)).astype(int)
            x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, S - 1), min(y1, S - 1)
            if x1 < x0 or y1 < y0: continue
            (ax, ay), (bx, by), (cx, cy) = T
            den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(den) < 1e-9: continue
            X, Y = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            w0 = ((by - cy) * (X - cx) + (cx - bx) * (Y - cy)) / den
            w1 = ((cy - ay) * (X - cx) + (ax - cx) * (Y - cy)) / den
            w2 = 1 - w0 - w1
            e = -1e-3
            m = (w0 >= e) & (w1 >= e) & (w2 >= e)
            if not m.any(): continue
            zz = w0 * z[0] + w1 * z[1] + w2 * z[2]
            sub = zb[y0:y1 + 1, x0:x1 + 1]
            m &= zz > sub - 1e-7
            im = img[y0:y1 + 1, x0:x1 + 1]
            im[m, :3] = cshade; im[m, 3] = 255
            sub[m] = np.maximum(sub[m], zz[m])
    out = Image.fromarray(img.astype(np.uint8), 'RGBA')
    if ss > 1: out = out.resize((size, size), Image.LANCZOS)
    return out

def project(p):
    C, center, scale, size = LAST
    q = _proj((C @ np.asarray(p))[None])[0]
    return ((q[0] - center[0]) * scale * size + size / 2, size / 2 - (q[1] - center[1]) * scale * size)

SPLAY = {k: {'rot': (0, 0, s * 50)} for k, s in (('leg1', 1), ('leg2', -1), ('leg3', 1), ('leg4', -1))}

if __name__ == '__main__':
    import sys
    render(SPLAY, size=900).save('preview.png')
