"""Extra faces + voxel items/hats for the kit renderer.

pose['_face']  = {'L': eye, 'R': eye, 'mouth': m, 'blush': bool}       (face_cam, extended here)
pose['_items'] = [{'kind': 'pickaxe', 'x':.., 'y':.., 'z':.., 'rx','ry','rz','s', 'at': 'head'|'root'}]
Item coordinates are head-local model pixels (head front face is z=-10, top y=9, sides x=+-4;
+x is the axolotl's left = viewer's left at the default yaw).
"""
import numpy as np
import rig2, face_cam
from rig import M4, rot_euler

hx = rig2.hx
U = 1 / 16
SKIN, EYE, WHITE = face_cam.SKIN, face_cam.EYE, face_cam.WHITE
MOUTH, MOUTH_D, TONGUE = face_cam.MOUTH, face_cam.MOUTH_D, face_cam.TONGUE
TEAR = hx('7cc8ff'); HEART = hx('ff2f6d'); GOLD = hx('ffc83a')
CLR = [(c, r, SKIN) for c in (14, 15) for r in (4, 5)]          # erase the original eye

# ---- eyes (template = viewer-left eye, cols 12..15; the other one is mirrored) ----
E = face_cam.EYES
E['closed'] = E['wink']
E['x'] = CLR + [(c, r, EYE) for c, r in ((12, 6), (15, 6), (13, 5), (14, 5), (13, 4), (14, 4), (12, 3), (15, 3))]
E['dizzy'] = CLR + [(c, r, EYE) for c, r in ((12, 3), (12, 4), (12, 5), (12, 6), (13, 6), (14, 6), (15, 6), (15, 5),
                                             (15, 4), (15, 3), (14, 3), (14, 4))]
E['big'] = [(c, r, WHITE) for c in (12, 13, 14, 15) for r in (3, 4, 5, 6)] + [(c, r, EYE) for c in (13, 14) for r in (4, 5)]
E['tiny'] = CLR + [(14, 5, EYE)]
E['angry'] = [(12, 6, EYE), (13, 6, EYE), (14, 7, EYE), (15, 7, EYE)]
E['sad'] = [(12, 7, EYE), (13, 7, EYE), (14, 6, EYE), (15, 6, EYE)]
E['heart'] = CLR + [(c, r, HEART) for c, r in ((11, 6), (12, 6), (14, 6), (15, 6), (11, 5), (12, 5), (13, 5), (14, 5),
                                               (15, 5), (12, 4), (13, 4), (14, 4), (13, 3))] + [(11, 6, hx('ff9cbc'))]
E['cry'] = CLR + [(c, 6, EYE) for c in (12, 13, 14, 15)] + [(13, 5, EYE), (14, 5, EYE)] + \
           [(c, r, TEAR) for c in (13, 14) for r in (0, 1, 2, 3, 4)]
E['meh'] = [(c, 5, EYE) for c in (12, 13, 14, 15)] + [(14, 4, EYE), (15, 4, EYE)]
E['teary'] = CLR + [(c, r, EYE) for c in (13, 14, 15) for r in (3, 4, 5, 6)] + \
             [(14, 6, WHITE), (13, 4, WHITE), (13, 3, TEAR), (14, 3, TEAR), (15, 3, TEAR)]
E['sleep'] = CLR + [(12, 5, EYE), (13, 4, EYE), (14, 4, EYE), (15, 5, EYE)]
E['up'] = CLR + [(c, r, EYE) for c in (14, 15) for r in (6, 7)]
E['side'] = CLR + [(c, r, EYE) for c in (12, 13) for r in (4, 5)]
E['money'] = CLR + [(c, r, GOLD) for c in (12, 13, 14, 15) for r in (3, 4, 5, 6)] + \
             [(13, 6, EYE), (14, 6, EYE), (13, 5, EYE), (13, 4, EYE), (14, 4, EYE), (14, 3, EYE), (13, 3, EYE)]
E['sparkle'] = E['star']
E['flat'] = CLR + [(c, 5, EYE) for c in (12, 13, 14, 15)]

# ---- mouths (cols 0..15, rows 0..9, original mouth = cols 6..9 rows 4..5) ----
M = face_cam.MOUTHS
ER = [(c, r, SKIN) for c in (6, 7, 8, 9) for r in (4, 5)]
M['frown'] = ER + [(c, 3, MOUTH_D) for c in (6, 7, 8, 9)] + [(5, 2, MOUTH_D), (10, 2, MOUTH_D)]
M['wavy'] = ER + [(c, r, MOUTH_D) for c, r in ((5, 3), (6, 4), (7, 3), (8, 4), (9, 3), (10, 4))]
M['shout'] = ER + [(c, r, MOUTH_D) for c in range(5, 11) for r in (1, 2, 3, 4)] + [(c, r, TONGUE) for c in (6, 7, 8, 9) for r in (1, 2)]
M['w'] = ER + [(c, r, MOUTH_D) for c, r in ((5, 4), (6, 3), (7, 4), (8, 4), (9, 3), (10, 4))]
M['tongue'] = [(7, 3, TONGUE), (8, 3, TONGUE), (7, 2, TONGUE), (8, 2, TONGUE)]
M['grin'] = ER + [(c, 4, MOUTH_D) for c in range(5, 11)] + [(5, 3, MOUTH_D), (10, 3, MOUTH_D)] + \
            [(c, 3, WHITE) for c in (6, 7, 8, 9)] + [(c, 2, MOUTH_D) for c in (6, 7, 8, 9)]
M['drool'] = [(9, 3, TEAR), (9, 2, TEAR), (9, 1, TEAR)]
M['eat'] = ER + [(c, r, MOUTH_D) for c in (6, 7, 8, 9) for r in (3, 4)]
M['none'] = ER

# ---------------- voxel items ----------------
box = face_cam.box

def bitmap(rows, pal, depth=1.0, px=1.0):
    """pixel-art sprite -> 1-texel-thick voxel slab (like a Minecraft held item). Centered at origin, -z faces viewer."""
    h = len(rows); w = max(len(r) for r in rows)
    q = []
    for y, row in enumerate(rows):
        x = 0
        while x < len(row):
            ch = row[x]
            if ch in '. ':
                x += 1; continue
            x1 = x
            while x1 + 1 < len(row) and row[x1 + 1] == ch: x1 += 1
            X0 = (x - w / 2) * px; X1 = (x1 + 1 - w / 2) * px
            Y1 = (h / 2 - y) * px; Y0 = Y1 - px
            q += box(-X1, Y0, -depth / 2, -X0, Y1, depth / 2, hx(pal[ch]))   # mirror x so sprite reads left->right on screen
            x = x1 + 1
    return q

def boxes(lst):
    q = []
    for b in lst: q += box(*b[:6], hx(b[6]))
    return q

P = {}   # palettes reused
WOOD = {'w': '8a5a2b', 'W': 'b07a40'}

SPR = {
 'pickaxe': (['..cccccc..',
              '.cCCCCCCc.',
              'cCc.ww.cCc',
              'cc..ww..cc',
              '....ww....',
              '....ww....',
              '....wW....',
              '....wW....',
              '....wW....',
              '....wW....'], {'c': '1aa89a', 'C': '5ff2e0', 'w': '7a4f25', 'W': 'a8733c'}),
 'sword': (['........cc',
            '.......cCc',
            '......cCc.',
            '.....cCc..',
            '....cCc...',
            'g..cCc....',
            '.gcCc.....',
            '..gw......',
            '.wgg......',
            'w..g......'], {'c': '1aa89a', 'C': '6ff7e6', 'g': 'c8a24a', 'w': '6b4423'}),
 'heart': (['.RR.RR.', 'RWRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'], {'R': 'ff2f6d', 'W': 'ffc2d6'}),
 'diamond': (['..CCCC..', '.CWCCcC.', 'CWCCCCcC', '.CCCCcC.', '..CCcC..', '...Cc...'], {'C': '4ef0e0', 'c': '1aa89a', 'W': 'e8fffd'}),
 'fish': (['....oooo...', 'o.ooOOOoo..', 'oooOOOOOkOo', 'o.ooOOOoo..', '....oooo...'], {'o': 'e86a2b', 'O': 'ffa860', 'k': '222222'}),
 'cookie': (['.bbbb.', 'bBkBBb', 'bBBBkb', 'bkBBBb', 'bBBkBb', '.bbbb.'], {'b': 'b56a2a', 'B': 'e09a52', 'k': '4a2a12'}),
 'apple': (['...g..', '..gs..', '.rrrr.', 'rWrrrr', 'rrrrrr', 'rrrrrr', '.rrrr.'], {'r': 'e8303a', 'W': 'ff9a9a', 'g': '3cb043', 's': '6b4423'}),
 'carrot': (['....gg', '...gg.', '..oo..', '.ooo..', 'oOo...', 'oo....'], {'o': 'f08a1c', 'O': 'ffbe5c', 'g': '3cb043'}),
 'potion': (['..cc..', '..gg..', '.gWPg.', 'gPPPPg', 'gPPPPg', '.gggg.'], {'c': '8a5a2b', 'g': 'cfe8ff', 'P': 'ff5fb0', 'W': 'ffffff'}),
 'star': (['...Y...', '...Y...', 'YYYYYYY', '.YYWYY.', '..YYY..', '.YY.YY.', 'Y.....Y'], {'Y': 'ffcc2e', 'W': 'fff6c0'}),
 'bulb': (['.yyyy.', 'yWyyyy', 'yyyyyy', 'yyyyyy', '.yyyy.', '..gg..', '..GG..'], {'y': 'ffe14a', 'W': 'fffbe0', 'g': 'a0a4ae', 'G': '6c707a'}),
 'question': (['.qqqq.', 'qq..qq', '....qq', '...qq.', '..qq..', '......', '..qq..'], {'q': 'ff3e8c'}),
 'exclaim': (['qq', 'qq', 'qq', 'qq', '..', 'qq'], {'q': 'ff3b4e'}),
 'flag': (['pRRRR', 'pRRRRR', 'pRRRR', 'p....', 'p....', 'p....', 'p....'], {'p': '8a5a2b', 'R': 'ff3e8c'}),
 'magnifier': (['.ggg...', 'gcccg..', 'gcWcg..', 'gcccg..', '.ggg...', '....hh.', '.....hh'], {'g': '5a5f6e', 'c': 'bfe6ff', 'W': 'ffffff', 'h': '8a5a2b'}),
 'wrench': (['g...g', 'gg.gg', '.ggg.', '..g..', '..g..', '..g..', '..g..', '..G..'], {'g': 'b9bec9', 'G': '7d828c'}),
 'bug': (['k.....k', '.k...k.', '..ggg..', 'kgGgGgk', '.ggggg.', 'kgGgGgk', '.ggggg.', 'k.ggg.k'], {'k': '2a2a2a', 'g': '33b04a', 'G': '1f7a30'}),
 'trophy': (['YYYYYYY', 'Y.YYY.Y', 'Y.YWY.Y', '.YYYYY.', '..YYY..', '...Y...', '..yyy..', '.yyyyy.'], {'Y': 'ffc83a', 'W': 'fff4c0', 'y': 'c8902a'}),
 'torch': (['.yy.', 'yOOy', '.yy.', '.ww.', '.ww.', '.ww.', '.ww.'], {'y': 'ffd23a', 'O': 'ff7a1a', 'w': '8a5a2b'}),
 'flower': (['.p.p.', 'ppypp', '.ppp.', '..g..', '.gg..', '..g..'], {'p': 'ff86c0', 'y': 'ffd23a', 'g': '3cb043'}),
 'note': (['..kkk', '..k.k', '..k.k', '..k..', 'kkk..', 'kkk..'], {'k': 'ff3e8c'}),
 'key': (['.yyy....', 'y...y...', 'y...yyyy', '.yyy..y.', '......y.'], {'y': 'ffc83a'}),
 'gift': (['..r.r..', '...r...', 'ggrrrgg', 'ggrrrgg', 'ggrrrgg', 'ggrrrgg'], {'g': '3cb7ff', 'r': 'ff3e8c'}),
 'bone': (['ww....ww', '.wwwwww.', 'ww....ww'], {'w': 'f2efe6'}),
 'mail': (['wwwwwww', 'wpwwwpw', 'wwpwpww', 'wwwpwww', 'wwwwwww'], {'w': 'f7f8fc', 'p': 'ff3e8c'}),
 'clock': (['.wwww.', 'wkwwkw', 'ww.kww', 'wwwkww', 'wwwwww', '.wwww.'], {'w': 'f7f8fc', 'k': '3a3e4c'}),
 'umbrella': (['..pppp..', '.pPPPPp.', 'pPPPPPPp', '...k....', '...k....', '...k....', '.k.k....', '..k.....'], {'p': 'ff3e8c', 'P': 'ff86c0', 'k': '5a3a1a'}),
 'snowflake': (['..w..', 'w.w.w', '.www.', 'wwwww', '.www.', 'w.w.w', '..w..'], {'w': 'dff4ff'}),
 'money': (['gggggg', 'gGG$Gg', 'gG$$Gg', 'gGG$Gg', 'gggggg'], {'g': '3cb043', 'G': '8ce08a', '$': '1f6b2a'}),
 'controller': (['.kkkkkk.', 'kkwkkrkk', 'kwwwkkgk', 'kkwkkkkk', 'kk.kk.kk'], {'k': '3a3e4c', 'w': 'cfd4de', 'r': 'ff3e8c', 'g': '3cb7ff'}),
 'melon': (['.rrrrrrr.', 'rrkrrrkrr', '.rrrkrrr.', '..wwwww..', '...ggg...'], {'r': 'ff4a5a', 'k': '2a1a1a', 'w': 'f2f8e8', 'g': '3cb043'}),
 'rod': (['.......ww', '......ww.', '.....ww.l', '....ww..l', '...ww...l', '..ww....l', '.ww....rr', 'ww.....rr'], {'w': '8a5a2b', 'l': 'dfe4ee', 'r': 'ff3e8c'}),
 'rtorch': (['.rr.', 'rRRr', '.rr.', '.ww.', '.ww.', '.ww.', '.ww.'], {'r': 'ff2e2e', 'R': 'ff9a8a', 'w': '8a5a2b'}),
 'emerald': (['..gg..', '.gWgg.', 'gWgggg', 'gggggG', '.ggGG.', '..GG..'], {'g': '2fd36a', 'G': '14904a', 'W': 'c8ffd8'}),
}

# 3D block props (model px, origin = grip point)
BLK = {
 'tnt': [(-2.5, -2.5, -2.5, 2.5, 2.5, 2.5, 'e8402a'), (-2.6, -0.8, -2.6, 2.6, 0.8, 2.6, 'f2f2f2'),
         (-1.4, -0.5, -2.7, 1.4, 0.5, -2.6, '222222'), (-0.3, 2.5, -0.3, 0.3, 3.6, 0.3, '6b6b6b')],
 'cake': [(-3, -1.6, -3, 3, 0.8, 3, 'f4e2c8'), (-3.05, 0.2, -3.05, 3.05, 1.4, 3.05, 'fbfbfb'),
          (-0.3, 1.4, -0.3, 0.3, 3.0, 0.3, 'ff86c0'), (-0.25, 3.0, -0.25, 0.25, 3.6, 0.25, 'ffd23a'),
          (-2.4, 1.4, -2.4, -1.6, 2.0, -1.6, 'ff2f6d'), (1.6, 1.4, -2.4, 2.4, 2.0, -1.6, 'ff2f6d')],
 'cup': [(-1.8, -2.4, -1.8, 1.8, 2.0, 1.8, 'f7f8fc'), (-1.9, -0.6, -1.9, 1.9, 0.8, 1.9, 'ff86c0'),
         (-1.5, 1.6, -1.5, 1.5, 2.05, 1.5, '6b3a1a'), (1.8, -1.2, -0.4, 2.8, 1.2, 0.4, 'f7f8fc'),
         (-0.3, 2.3, -0.3, 0.3, 3.4, 0.3, 'ffffff')],
 'boba': [(-1.8, -2.6, -1.8, 1.8, 2.2, 1.8, 'f5d7b0'), (-1.9, 2.2, -1.9, 1.9, 2.6, 1.9, 'ff86c0'),
          (-0.35, 2.6, -0.35, 0.35, 5.2, 0.35, 'ff3e8c'),
          (-1.2, -2.4, -1.85, -0.6, -1.8, -1.8, '3a2010'), (0.2, -2.0, -1.85, 0.8, -1.4, -1.8, '3a2010'),
          (-0.6, -1.4, -1.85, 0.0, -0.8, -1.8, '3a2010')],
 'phone': [(-1.8, -3.4, -0.4, 1.8, 3.4, 0.4, '2a2d38'), (-1.5, -2.8, -0.45, 1.5, 2.9, -0.4, '8cc8ff'),
           (-0.5, -3.2, -0.45, 0.5, -3.0, -0.4, '5a5f6e')],
 'laptop': [(-4, -0.3, -2.8, 4, 0.3, 2.8, 'cfd4de'), (-4, 0.3, 2.4, 4, 5.4, 2.8, 'cfd4de'),
            (-3.6, 0.7, 2.35, 3.6, 5.0, 2.4, '2a3a5a'), (-3.4, 3.6, 2.3, 0.6, 4.1, 2.35, 'ff3e8c'),
            (-3.4, 2.6, 2.3, 2.2, 3.0, 2.35, '8cc8ff'), (-3.4, 1.6, 2.3, 1.0, 2.0, 2.35, '8cc8ff'),
            (-1.0, 2.2, 2.8, 1.0, 4.0, 2.9, 'ff3e8c'), (-0.6, 3.6, 2.8, 0.6, 4.4, 2.9, 'ff3e8c')],
 'book': [(-3.0, -2.3, -1.0, 3.0, 2.3, -0.6, 'ff3e8c'), (-3.0, -2.3, 0.6, 3.0, 2.3, 1.0, 'ff3e8c'),
          (-3.0, -2.3, -1.0, -2.6, 2.3, 1.0, 'c8125e'), (-2.6, -2.05, -0.6, 2.85, 2.05, 0.6, 'fbf6ea'),
          (-1.6, 0.5, -1.06, 1.6, 1.3, -1.0, 'ffffff'), (-1.0, -0.4, -1.06, 1.0, 0.0, -1.0, 'ffd0e4')],
 'sign': [(-0.35, -6, -0.35, 0.35, 0.5, 0.35, '8a5a2b'), (-4.5, 0, -0.5, 4.5, 4.6, 0.3, 'f7f8fc'),
          (-4.6, 4.4, -0.55, 4.6, 4.8, 0.35, 'ff3e8c'), (-4.6, -0.2, -0.55, 4.6, 0.2, 0.35, 'ff3e8c')],
 'bucket': [(-2.4, -2.4, -2.4, 2.4, 2.0, 2.4, 'b9bec9'), (-2.0, 1.6, -2.0, 2.0, 2.05, 2.0, '3c8cff'),
            (-2.5, 1.8, -0.2, -2.3, 3.8, 0.2, '8a8f99'), (2.3, 1.8, -0.2, 2.5, 3.8, 0.2, '8a8f99'),
            (-2.5, 3.6, -0.2, 2.5, 3.8, 0.2, '8a8f99')],
 'bed': [(-4, -1.2, -6, 4, 0.6, 6, 'ff3e8c'), (-4, 0.6, 2.5, 4, 1.4, 6, 'f7f8fc'), (-4, -2.6, -6, 4, -1.2, 6, '8a5a2b')],
 'popcorn': [(-2.2, -2.8, -2.2, 2.2, 1.6, 2.2, 'ffffff'), (-2.25, -2.8, -2.25, -1.3, 1.6, 2.25, 'ff3b4e'),
             (-0.5, -2.8, -2.25, 0.5, 1.6, 2.25, 'ff3b4e'), (1.3, -2.8, -2.25, 2.25, 1.6, 2.25, 'ff3b4e'),
             (-2.0, 1.6, -2.0, 2.0, 2.8, 2.0, 'fff2c0'), (-1.2, 2.6, -1.6, 0.4, 3.4, 0.0, 'ffe48a'), (0.2, 2.6, -0.4, 1.6, 3.3, 1.2, 'fff6d8')],
 'grass': [(-2.6, -2.6, -2.6, 2.6, 2.6, 2.6, '8a5a2b'), (-2.65, 1.4, -2.65, 2.65, 2.65, 2.65, '5fbf3a'),
           (-1.8, 0.6, -2.7, -1.0, 1.4, -2.65, '5fbf3a'), (0.8, 0.8, -2.7, 1.6, 1.4, -2.65, '5fbf3a')],
 'brick': [(-2.8, -1.4, -1.4, 2.8, 1.4, 1.4, 'c8553a'), (-2.85, -0.15, -1.45, 2.85, 0.15, 1.45, 'e8d8c8'),
           (-0.15, 0.15, -1.45, 0.15, 1.4, -1.4, 'e8d8c8')],
 'bowl': [(-2.6, -1.6, -2.6, 2.6, 0.8, 2.6, 'f7f8fc'), (-2.65, -0.6, -2.65, 2.65, 0.0, 2.65, '3cb7ff'),
          (-2.2, 0.8, -2.2, 2.2, 1.8, 2.2, 'fffdf4'), (-0.6, 1.8, -0.6, 0.6, 2.2, 0.6, 'fffdf4'),
          (1.0, 1.6, -0.4, 1.3, 4.6, -0.1, '8a5a2b'), (1.6, 1.6, -0.2, 1.9, 4.6, 0.1, '8a5a2b')],
}

# hats / face gear (head-local, absolute coords)
GEAR = {
 'party': [(-2.2, 9.0, -9.2, 2.2, 10.2, -5.6, 'ff3e8c'), (-1.6, 10.2, -8.6, 1.6, 11.4, -6.2, '3cb7ff'),
           (-1.0, 11.4, -8.0, 1.0, 12.6, -6.8, 'ffd23a'), (-0.5, 12.6, -7.6, 0.5, 13.6, -7.1, 'ff3e8c'),
           (-0.7, 13.6, -7.8, 0.7, 14.6, -6.9, 'ffffff')],
 'crown': [(-3.0, 9.0, -9.6, 3.0, 10.4, -5.4, 'ffc83a'), (-3.0, 10.4, -9.6, -2.0, 11.6, -8.6, 'ffc83a'),
           (-0.5, 10.4, -9.6, 0.5, 12.0, -8.6, 'ffc83a'), (2.0, 10.4, -9.6, 3.0, 11.6, -8.6, 'ffc83a'),
           (-0.4, 9.5, -9.7, 0.4, 10.1, -9.6, 'ff2f6d'), (-2.4, 9.5, -9.7, -1.6, 10.1, -9.6, '3cb7ff'),
           (1.6, 9.5, -9.7, 2.4, 10.1, -9.6, '3cb7ff')],
 'nightcap': [(-3.6, 9.0, -9.8, 3.6, 10.0, -5.2, 'f7f8fc'), (-3.2, 10.0, -9.4, 3.2, 11.2, -5.6, '6d63ff'),
              (-2.6, 11.2, -8.8, 1.6, 12.2, -6.2, '6d63ff'), (-2.2, 12.2, -8.2, -0.2, 12.9, -6.8, '6d63ff'),
              (-4.4, 11.4, -8.0, -2.4, 12.6, -6.8, '6d63ff'), (-5.4, 10.4, -7.9, -4.2, 11.6, -6.9, 'f7f8fc')],
 'shades': [(1.8, 5.5, -10.6, 4.4, 7.7, -10.1, '1d1f26'), (-4.4, 5.5, -10.6, -1.8, 7.7, -10.1, '1d1f26'),
            (-1.8, 6.9, -10.6, 1.8, 7.5, -10.1, '1d1f26'), (3.0, 6.9, -10.65, 3.6, 7.4, -10.6, 'ffffff'),
            (-2.6, 6.9, -10.65, -2.0, 7.4, -10.6, 'ffffff'),
            (4.1, 6.9, -10.2, 4.5, 7.5, -6.0, '1d1f26'), (-4.5, 6.9, -10.2, -4.1, 7.5, -6.0, '1d1f26')],
 'glasses': [(1.6, 5.4, -10.5, 4.4, 5.8, -10.1, '3a3e4c'), (1.6, 7.6, -10.5, 4.4, 8.0, -10.1, '3a3e4c'),
             (1.6, 5.4, -10.5, 2.0, 8.0, -10.1, '3a3e4c'), (4.0, 5.4, -10.5, 4.4, 8.0, -10.1, '3a3e4c'),
             (-4.4, 5.4, -10.5, -1.6, 5.8, -10.1, '3a3e4c'), (-4.4, 7.6, -10.5, -1.6, 8.0, -10.1, '3a3e4c'),
             (-4.4, 5.4, -10.5, -4.0, 8.0, -10.1, '3a3e4c'), (-2.0, 5.4, -10.5, -1.6, 8.0, -10.1, '3a3e4c'),
             (-1.6, 7.0, -10.5, 1.6, 7.4, -10.1, '3a3e4c')],
 'band': [(-4.25, 8.0, -10.25, 4.25, 9.0, -4.75, 'ff3b4e'), (-0.6, 8.1, -10.35, 0.6, 8.9, -10.25, 'ffffff'),
          (4.2, 7.0, -6.0, 5.6, 8.4, -5.4, 'ff3b4e')],
 'helmet': [(-4.4, 8.8, -10.4, 4.4, 10.4, -4.6, 'ffc83a'), (-3.6, 10.4, -9.6, 3.6, 11.2, -5.4, 'ffc83a'),
            (-1.0, 9.0, -10.9, 1.0, 10.4, -10.4, 'fff6c0')],
 'halo': [(-2.6, 13.4, -9.0, 2.6, 13.9, -8.4, 'ffe14a'), (-2.6, 13.4, -5.6, 2.6, 13.9, -5.0, 'ffe14a'),
          (-3.2, 13.4, -8.4, -2.6, 13.9, -5.6, 'ffe14a'), (2.6, 13.4, -8.4, 3.2, 13.9, -5.6, 'ffe14a')],
 'horns': [(2.0, 9.0, -9.0, 3.2, 10.4, -7.8, 'c8123e'), (2.6, 10.4, -8.8, 3.4, 11.4, -8.0, 'c8123e'),
           (-3.2, 9.0, -9.0, -2.0, 10.4, -7.8, 'c8123e'), (-3.4, 10.4, -8.8, -2.6, 11.4, -8.0, 'c8123e')],
 'phones': [(-4.6, 9.0, -8.0, 4.6, 9.8, -7.0, '3a3e4c'), (4.0, 5.0, -8.6, 5.2, 8.6, -6.4, '3a3e4c'),
            (-5.2, 5.0, -8.6, -4.0, 8.6, -6.4, '3a3e4c'), (5.2, 5.6, -8.2, 5.4, 8.0, -6.8, 'ff3e8c'),
            (-5.4, 5.6, -8.2, -5.2, 8.0, -6.8, 'ff3e8c')],
 'bow': [(-0.6, 9.0, -9.2, 0.6, 10.0, -8.4, 'ff2f6d'), (0.6, 8.9, -9.2, 2.4, 10.6, -8.6, 'ff2f6d'),
         (-2.4, 8.9, -9.2, -0.6, 10.6, -8.6, 'ff2f6d')],
 'chef': [(-3.2, 9.0, -9.4, 3.2, 10.2, -5.6, 'ffffff'), (-3.8, 10.2, -9.9, 3.8, 12.4, -5.1, 'ffffff'),
          (-2.6, 12.4, -9.2, 2.6, 13.0, -5.8, 'f2f2f2')],
 'grad': [(-2.6, 9.0, -9.2, 2.6, 10.0, -5.8, '2a2d38'), (-4.6, 10.0, -10.0, 4.6, 10.5, -5.0, '2a2d38'),
          (2.4, 9.0, -10.0, 2.8, 10.0, -9.6, 'ffc83a'), (2.3, 8.2, -10.1, 2.9, 9.0, -9.5, 'ffc83a')],
 'flowers': [(-3.6, 9.0, -9.6, -2.4, 10.0, -8.4, 'ff86c0'), (-1.0, 9.0, -9.9, 0.2, 10.0, -8.7, 'ffd23a'),
             (1.4, 9.0, -9.6, 2.6, 10.0, -8.4, '9fd6ff'), (3.0, 9.0, -8.6, 4.2, 10.0, -7.4, 'ff86c0'),
             (-4.2, 9.0, -8.2, -3.4, 9.6, -7.4, '3cb043'), (0.4, 9.0, -9.4, 1.2, 9.6, -8.8, '3cb043')],
 'mask': [(-4.3, 4.0, -10.4, 4.3, 6.2, -10.05, 'cfeaff'), (4.0, 5.4, -10.1, 4.6, 5.9, -6.0, 'f7f8fc'),
          (-4.6, 5.4, -10.1, -4.0, 5.9, -6.0, 'f7f8fc')],
 'towel': [(-3.6, 9.0, -9.2, 3.6, 9.8, -5.8, 'f7f8fc'), (-3.4, 9.8, -8.8, 3.4, 10.4, -6.2, 'ff86c0')],
 'ice': [(-1.6, 9.0, -8.6, 1.6, 9.8, -6.4, 'a8dcff'), (-1.2, 9.8, -8.2, 1.2, 10.4, -6.8, 'dff4ff')],
}

_CACHE = {}
def item_quads(kind):
    if kind in _CACHE: return _CACHE[kind]
    if kind in SPR:
        rows, pal = SPR[kind]; q = bitmap(rows, pal)
    elif kind in BLK:
        q = boxes(BLK[kind])
    elif kind in GEAR:
        q = boxes(GEAR[kind])
    else:
        raise KeyError(kind)
    _CACHE[kind] = q
    return q

def _root_M(pose):
    if 'root' not in pose: return np.eye(4)
    return M4(rot_euler(*pose['root'].get('rot', (0, 0, 0))), np.array(pose['root'].get('move', (0, 0, 0))) / 16)

def item_xf(pose, it):
    """item-local -> world 4x4."""
    if it.get('at', 'head') == 'head': Wm = face_cam._head_world(pose)
    elif it['at'] == 'root': Wm = _root_M(pose)
    else: Wm = np.eye(4)
    if it['kind'] in GEAR and 'x' not in it:
        Rc = rot_euler(it.get('rx', 0), it.get('ry', 0), it.get('rz', 0)); tc = np.zeros(3)
    else:
        Rc = rot_euler(it.get('rx', 0), it.get('ry', 0), it.get('rz', 0)) * it.get('s', 1.0)
        tc = np.array([it.get('x', 0), it.get('y', 0), it.get('z', -13)]) * U
    return Wm @ M4(Rc, tc)

_prev_scene = rig2.scene
def scene(pose):
    out = _prev_scene(pose)
    for it in pose.get('_items', ()):
        X = item_xf(pose, it); R, t = X[:3, :3], X[:3, 3]
        for q, col, n in item_quads(it['kind']):
            out.append(((R @ q.T).T + t, col, R @ n, 'item'))
    return out
rig2.scene = scene

def head_point(pose, p):
    Wm = face_cam._head_world(pose)
    return Wm[:3, :3] @ (np.array(p, float) * U) + Wm[:3, 3]

def item_point(pose, it, p=(0, 0, 0)):
    X = item_xf(pose, it)
    return X[:3, :3] @ (np.array(p, float) * U) + X[:3, 3]


# ---------------- vanilla Minecraft textures -> 3D (helmets, items, blocks) ----------------
import os
from PIL import Image
MC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'kit', 'mc')
EXTRA = {}

def _tex(name, tint=None):
    im = Image.open(os.path.join(MC, name)).convert('RGBA')
    a = np.asarray(im).astype(int)
    if tint is not None:
        a[..., :3] = a[..., :3] * np.array(hx(tint)) // 255
    return a

def _quad(o, ex, ey):
    return np.array([o, o + ex, o + ex + ey, o + ey], float)

def tex_box(tex, u0, v0, w, h, d, size, double=False):
    """Minecraft box-UV cube (texture rect at u0,v0 for a w*h*d box) -> per-texel quads, centred, size=(X,Y,Z) model px."""
    X, Y, Z = size
    faces = [  # (tex rect x, y, cols, rows), origin of texel (0,0), step per col, step per row, normal
        ((u0 + d, v0 + d, w, h), (X / 2, Y / 2, -Z / 2), (-X / w, 0, 0), (0, -Y / h, 0), (0, 0, -1)),          # front -z
        ((u0 + 2 * d + w, v0 + d, w, h), (-X / 2, Y / 2, Z / 2), (X / w, 0, 0), (0, -Y / h, 0), (0, 0, 1)),     # back +z
        ((u0, v0 + d, d, h), (X / 2, Y / 2, Z / 2), (0, 0, -Z / d), (0, -Y / h, 0), (1, 0, 0)),               # +x
        ((u0 + d + w, v0 + d, d, h), (-X / 2, Y / 2, -Z / 2), (0, 0, Z / d), (0, -Y / h, 0), (-1, 0, 0)),     # -x
        ((u0 + d, v0, w, d), (X / 2, Y / 2, Z / 2), (-X / w, 0, 0), (0, 0, -Z / d), (0, 1, 0)),               # top
        ((u0 + d + w, v0, w, d), (X / 2, -Y / 2, -Z / 2), (-X / w, 0, 0), (0, 0, Z / d), (0, -1, 0)),          # bottom
    ]
    q = []
    for (tx, ty, cols, rows), o, ec, er, n in faces:
        o, ec, er, n = (np.array(v, float) for v in (o, ec, er, n))
        for j in range(rows):
            for i in range(cols):
                c = tex[ty + j, tx + i]
                if c[3] <= 12: continue
                col = (int(c[0]), int(c[1]), int(c[2]))
                Q = _quad(o + ec * i + er * j, ec, er) * U
                q.append((Q, col, n))
                if double: q.append((Q[::-1].copy(), col, -n))
    return q

def tex_cube(side, top, bottom, size=8.0):
    """block with 16x16 face textures (TNT etc.)."""
    S = size / 2; q = []
    def face(t, o, ec, er, n):
        o, ec, er, n = (np.array(v, float) for v in (o, ec, er, n))
        for j in range(16):
            for i in range(16):
                c = t[j, i]
                q.append((_quad(o + ec * i + er * j, ec, er) * U, (int(c[0]), int(c[1]), int(c[2])), n))
    st = size / 16
    face(side, (S, S, -S), (-st, 0, 0), (0, -st, 0), (0, 0, -1)); face(side, (-S, S, S), (st, 0, 0), (0, -st, 0), (0, 0, 1))
    face(side, (S, S, S), (0, 0, -st), (0, -st, 0), (1, 0, 0)); face(side, (-S, S, -S), (0, 0, st), (0, -st, 0), (-1, 0, 0))
    face(top, (S, S, S), (-st, 0, 0), (0, 0, -st), (0, 1, 0)); face(bottom, (S, -S, -S), (-st, 0, 0), (0, 0, st), (0, -1, 0))
    return q

def png_sprite(name, px=0.5, tint=None):
    """16x16 item texture -> 1-texel-thick voxel item, like a dropped item in Minecraft."""
    a = _tex(name, tint)
    pal, rows = {}, []
    keys = iter('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&*+-=<>@^_~')
    for y in range(a.shape[0]):
        r = ''
        for x in range(a.shape[1]):
            c = a[y, x]
            if c[3] <= 12: r += '.'; continue
            k = '%02x%02x%02x' % tuple(int(v) for v in c[:3])
            if k not in pal: pal[k] = next(keys)
            r += pal[k]
        rows.append(r)
    return bitmap(rows, {v: k for k, v in pal.items()}, depth=px, px=px)

def load_mc():
    if EXTRA: return
    if not os.path.exists(os.path.join(MC, 'iron.png')):
        raise SystemExit('缺少原版材质：先运行 python engine/fetch_mc.py（从你本机的 Minecraft 客户端 jar 里提取）')
    EXTRA['iron_helmet3d'] = tex_box(_tex('iron.png'), 0, 0, 8, 8, 8, (10, 10, 10), double=True)
    EXTRA['turtle_helmet3d'] = tex_box(_tex('turtle_scute.png'), 0, 0, 8, 8, 8, (10, 10, 10), double=True)
    EXTRA['tnt3d'] = tex_cube(_tex('tnt_side.png'), _tex('tnt_top.png'), _tex('tnt_bottom.png'), 8)
    for n in ('axolotl_bucket', 'tropical_fish', 'heart_of_the_sea', 'nautilus_shell', 'diamond_pickaxe', 'cod'):
        EXTRA['mc_' + n] = png_sprite(n + '.png')
    EXTRA['mc_lily_pad'] = png_sprite('lily_pad.png', tint='5fae3c')

_item_quads_base = item_quads
def item_quads(kind):
    if kind in EXTRA or kind.startswith('mc_') or kind.endswith('3d'):
        load_mc(); return EXTRA[kind]
    return _item_quads_base(kind)
