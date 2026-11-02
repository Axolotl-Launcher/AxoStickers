"""表情 + 相机道具：给 rig2 的场景加额外的体素面片。

用法：在 pose 里放两个私有键（骨骼解析会忽略它们）
  pose['_face'] = {'L': 'open', 'R': 'wink', 'mouth': 'smile', 'blush': True}
  pose['_cam']  = {'x': 3.5, 'y': 6.5, 'rz': 0, 'flash': 0.0}   # 头部局部坐标（模型像素）
然后照常 rig2.render(pose, ...)。

眼睛 L/R：'open' 原版小眼 | 'wink' 闭眼一条线 | 'happy' ^ 眯眼 | 'star' 大眼带高光 | 'squeeze' >< 用力闭眼
嘴 mouth：'normal' 原版 | 'smile' 张嘴笑 | 'o' 小圆嘴 | 'flat' 抿嘴
"""
import numpy as np
import rig2
from rig import NODES, world, M4, rot_euler

hx = rig2.hx
SKIN = hx('fdb8db'); EYE = hx('42147a'); WHITE = (255, 255, 255)
MOUTH = hx('fe61a3'); MOUTH_D = hx('a81e5e'); TONGUE = hx('ff7fb5'); BLUSH = hx('ff7ab4')
U = 1 / 16
FACE_Z = -10 * U - 0.004          # 脸正面 z=-10px，叠加层稍微往前一点
HEAD_MESH = [i for i in rig2.MESH_Q if NODES[i]['name'] == 'head'][0]

# ---------- 半像素网格：列 0..15 对应 x=-4..4，行 0..9 对应 y=4..9 ----------
def _cell(c, r, col):
    e = 0.03                       # 微微放大，避免相邻格子之间露缝
    x0, y0, x1, y1 = -4 + c * 0.5 - e, 4 + r * 0.5 - e, -4 + c * 0.5 + .5 + e, 4 + r * 0.5 + .5 + e
    q = np.array([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], float) * U
    q[:, 2] = FACE_Z
    return (q, col, np.array([0., 0., -1.]))

def _rect(c0, r0, c1, r1, col):  # 包含端点
    return [_cell(c, r, col) for c in range(c0, c1 + 1) for r in range(r0, r1 + 1)]

# 每只眼以 x>0 那只（列 14,15）为模板，另一只镜像
EYES = {
    'open':    [],
    'wink':    [(c, 4, EYE) for c in (12, 13, 14, 15)] + [(14, 5, SKIN), (15, 5, SKIN)],
    'happy':   [(14, 5, SKIN), (15, 5, SKIN), (14, 4, SKIN), (15, 4, SKIN),
                (12, 4, EYE), (13, 5, EYE), (14, 5, EYE), (15, 4, EYE)],
    'squeeze': [(14, 5, SKIN), (15, 5, SKIN), (14, 4, SKIN), (15, 4, SKIN),
                (12, 6, EYE), (13, 5, EYE), (14, 4, EYE), (13, 3, EYE), (12, 2, EYE)],
    'star':    [(c, r, EYE) for c in (13, 14, 15) for r in (3, 4, 5, 6)] + [(15, 6, WHITE), (14, 6, WHITE), (15, 5, WHITE), (13, 3, WHITE)],
}
MOUTHS = {
    'normal': [],
    'smile': [(c, r, SKIN) for c in (6, 7, 8, 9) for r in (4, 5)] +
             [(c, 4, MOUTH_D) for c in (5, 6, 7, 8, 9, 10)] + [(c, 3, MOUTH_D) for c in (6, 9)] + [(7, 3, TONGUE), (8, 3, TONGUE)] +
             [(c, 2, MOUTH_D) for c in (7, 8)],
    'o':     [(c, r, SKIN) for c in (6, 7, 8, 9) for r in (4, 5)] + [(7, 4, MOUTH_D), (8, 4, MOUTH_D), (7, 3, MOUTH_D), (8, 3, MOUTH_D)],
    'flat':  [(c, r, SKIN) for c in (6, 7, 8, 9) for r in (4, 5)] + [(c, 4, MOUTH) for c in (6, 7, 8, 9)],
}

def face_quads(f):
    cells = []
    R = EYES[f.get('R', 'open')]; L = EYES[f.get('L', 'open')]
    cells += R + [(15 - c, r, col) for c, r, col in L]
    cells += MOUTHS[f.get('mouth', 'normal')]
    if f.get('blush'):
        cells += [(c, r, BLUSH) for c in (12, 13, 14) for r in (1, 2)] + [(c, r, BLUSH) for c in (1, 2, 3) for r in (1, 2)]
    # 后写的覆盖先写的：去重保留最后一个
    d = {}
    for c, r, col in cells: d[(c, r)] = col
    return [_cell(c, r, col) for (c, r), col in d.items()]

# ---------- 体素相机 ----------
def box(x0, y0, z0, x1, y1, z1, col):
    v = np.array([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
                  [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], float) * U
    F = [((0, 3, 2, 1), (0, 0, -1)), ((4, 5, 6, 7), (0, 0, 1)), ((0, 1, 5, 4), (0, -1, 0)),
         ((3, 7, 6, 2), (0, 1, 0)), ((0, 4, 7, 3), (-1, 0, 0)), ((1, 2, 6, 5), (1, 0, 0))]
    return [(v[list(ix)], col, np.array(n, float)) for ix, n in F]

CAM_BODY = hx('3a3e4c'); CAM_TOP = hx('cfd4de'); CAM_LENS = hx('262833'); GLASS = hx('203a6b')
GLASS_HI = hx('8cc8ff'); FLASH = hx('ffe9a8'); BTN = hx('fe3e8c')

def camera_quads(c):
    """相机局部坐标原点 = 镜头中心，-z 朝前（朝观众）。"""
    fl = c.get('flash', 0.0)
    flash_col = tuple(int(a + (255 - a) * fl) for a in FLASH)
    q = []
    q += box(-3.2, -2.2, -2.6, 3.2, 1.1, 0.4, CAM_BODY)        # 机身
    q += box(-3.2, 1.1, -2.6, 3.2, 2.1, 0.4, CAM_TOP)           # 银色顶盖
    q += box(-0.9, 2.1, -1.8, 0.9, 2.9, -0.2, CAM_TOP)          # 取景器凸起
    q += box(-2.6, 2.1, -1.2, -1.6, 2.6, -0.2, BTN)             # 快门键（粉）
    q += box(-1.7, -1.9, -4.2, 1.7, 1.5, -2.6, CAM_LENS)        # 镜头筒
    q += box(-1.15, -1.35, -4.3, 1.15, 0.95, -4.2, GLASS)       # 镜片
    q += box(-0.85, 0.15, -4.36, -0.35, 0.65, -4.3, GLASS_HI)   # 镜片高光
    q += box(0.35, -0.95, -4.36, 0.6, -0.7, -4.3, WHITE)
    q += box(1.9, 0.0, -2.7, 2.9, 0.8, -2.6, flash_col)         # 闪光灯
    return q

# ---------- 体素日志纸 ----------
PAPER = hx('f7f8fc'); PAPER_S = hx('d9dee8'); TITLE = hx('fe3e8c'); LINE = hx('aab3c4'); ERR = hx('ff3b4e')
DOC_LINES = [(4.6, 1.0), (3.4, -0.4), (4.2, -1.8), (4.6, -3.2)]   # (宽, y)，最后一行是红色报错

def doc_quads(c):
    """日志纸：c['lines'] 0~4 控制打出来几行（小数 = 正在打），-z 朝观众。"""
    n = c.get('lines', 4)
    q = box(-3, -4.2, -0.4, 3, 4.2, 0.4, PAPER)
    q += box(1.6, 2.8, -0.5, 3, 4.2, -0.4, PAPER_S)            # 折角
    q += box(-2.3, 2.6, -0.5, 0.8, 3.5, -0.4, TITLE)           # 粉色标题栏
    for i, (w, y) in enumerate(DOC_LINES):
        k = max(0.0, min(1.0, n - i))
        if k <= 0: continue
        q += box(-2.3, y, -0.5, -2.3 + max(0.3, w * k), y + 0.7, -0.4, ERR if i == len(DOC_LINES) - 1 else LINE)
        if 0 < k < 1 and c.get('cursor', True):                # 打字光标
            x = -2.3 + w * k + 0.2
            q += box(x, y - 0.1, -0.55, x + 0.35, y + 0.8, -0.4, TITLE)
    return q

PROPS = {'_cam': (lambda c: camera_quads(c), 'cam', -14.2), '_doc': (doc_quads, 'doc', -13.0)}

def _prop_transform(c, zdef=-14.2):
    R = rot_euler(c.get('rx', 0), c.get('ry', 0), c.get('rz', 0)) * c.get('s', 1.0)
    t = np.array([c['x'], c['y'], c.get('z', zdef)]) * U       # 道具背面贴近脸（脸在 z=-10）
    return R, t

def _cam_transform(c): return _prop_transform(c)

def _head_world(pose):
    W = world(HEAD_MESH, pose)
    if 'root' in pose:
        W = M4(rot_euler(*pose['root'].get('rot', (0, 0, 0))), np.array(pose['root'].get('move', (0, 0, 0))) / 16) @ W
    return W

def prop_point(pose, key='_cam', p=(0, 0, 0)):
    """道具局部坐标（模型像素）→ 世界坐标，可以再用 rig2.project 转成屏幕坐标。"""
    W = _head_world(pose); Rc, tc = _prop_transform(pose[key], PROPS[key][2])
    return W[:3, :3] @ (Rc @ (np.array(p) * U) + tc) + W[:3, 3]

def cam_point(pose, p=(2.4, 0.4, -2.7)): return prop_point(pose, '_cam', p)

_orig_scene = rig2.scene
def scene(pose):
    out = _orig_scene(pose)
    f = pose.get('_face')
    if not f and not any(k in pose for k in PROPS): return out
    W = _head_world(pose)
    R, t = W[:3, :3], W[:3, 3]
    extra = []
    if f: extra += [(q, col, n, 'head') for q, col, n in face_quads(f)]
    for key, (fn, part, zdef) in PROPS.items():
        if key not in pose: continue
        Rc, tc = _prop_transform(pose[key], zdef)
        extra += [(((Rc @ q.T).T + tc), col, Rc @ n, part) for q, col, n in fn(pose[key])]
    for q, col, n, name in extra:
        out.append(((R @ q.T).T + t, col, R @ n, name))
    return out
rig2.scene = scene
