"""300 张的工程（网站编辑器的工程 JSON，网页引擎出图）：python engine/projects.py [1-50,77]
从 specs.py 的配方出发「翻新」，照初代那 4 张的路子：
- 一圈 4 秒 60 帧；原来「轻轻晃」的字改成一个个蹦出来、炸小星星，快到一圈末尾时收掉（文字动画 popin）；
- 群里答疑里原地动的那些：开头在水下，浮上来、抬头，最后潜回去（动作 surface 叠在原来的动作底下）；
- 一下子的特效（对勾、问号、感叹号、叉……）等字落定了再出来，开心的加一点小星星；
- 本来就会离开画面的动作（潜水、冒出来、溜走……）保持它自己的段落，字常驻、到点跳一下；
- 一批照着字的意思加了初代那几样：提示条（「你撤回了一条消息」「连接已丢失」这种）、禁止标志、纸飞机、扔掉道具、截图框。
结果在 out/projects/NNN.json；出图：node site/tools/render_stickers.mjs（见 README）。"""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
ROOT = os.path.dirname(HERE); OUT = os.path.join(ROOT, 'out', 'projects')
import specs

FPS, FRAMES = 15, 60
OFFSCREEN = {'sink', 'popup', 'dash', 'slidein', 'launch', 'glitch'}
DIVE = {'nod', 'shake', 'tilt', 'wave', 'look', 'lookup', 'think', 'stare', 'shy', 'sway', 'wag', 'bow', 'clap', 'cheer', 'read', 'scan',
        'offer', 'headbob', 'wobble', 'puff', 'tremble', 'rage', 'tantrum', 'kowtow', 'petrify', 'swing', 'drink', 'idle', 'slosh',
        'shakeoff', 'typing', 'buoy', 'hop'}                       # 群里答疑里这些原地动的：浮上来再潜回去
BURST = {'check', 'cross', 'thumb', 'plus1', 'bulb', 'exclaim', 'question', 'shock', 'boom', 'bolt', 'flash', 'skull', 'ghost',
         'brokenheart', 'anger', 'swirl'}                           # 一下子的特效：等字落定了再出来
BURST_KINDS = {'pop', 'stay', 'say'}
SPARKLY = {'sparkles', 'twinkle', 'confetti', 'fireworks', 'flowers', 'hearts', 'coins', 'stars', 'notes', 'fall'}
HAPPY = {'happy', 'joy', 'smile', 'star', 'sparkle', 'love', 'grin', 'wink', 'cool', 'xd'}
GLUM = {'sad', 'sob', 'cry', 'teary', 'tired', 'dead', 'meh', 'blank', 'worried', 'awkward', 'struggle', 'sleepy', 'dizzy'}   # 这些不炸小星星
THEN = {'shake', 'droop', 'shiver', 'bounce', 'zoom', 'swing', 'pulse', 'wave', 'spin'}   # 原来一直在动的字：先蹦出来，落定了再接着这样动
GREEN, RED, GRAY, GOLD = '#07c160', '#e5484d', '#8a8f99', '#f0a020'

def fx_layer(f):
    """specs.py 的特效写法 → 图层（和网页 project.js 的 fxLayer 一样）"""
    if isinstance(f, str) and ':' not in f: return {'type': 'fx', 'component': f, 'params': {}}
    kind, *a = f if not isinstance(f, str) else f.split(':')
    at = lambda v: {'x': v[0], 'y': v[1]} if isinstance(v, (list, tuple)) else {}
    g = lambda i, d=None: a[i] if len(a) > i else d
    params = {
        'float': lambda: {'icon': g(0), 'n': g(1, 4), 'k': g(2, 4)}, 'fall': lambda: {'icon': g(0), 'n': g(1, 10), 'k': g(2, 4)},
        'pop': lambda: {'icon': g(0), 'k': g(1, 6), **at(g(2))}, 'stay': lambda: {'icon': g(0), 'k': g(1, 6) if len(a) < 3 else g(1), **at(g(2))},
        'say': lambda: {'icon': g(0)},
        'orbit': lambda: {'icon': g(0), 'n': g(1, 3), **({'rx': g(2)[0], 'ry': g(2)[1]} if isinstance(g(2), (list, tuple)) else {}), 'k': g(3, 4)},
    }.get(kind)
    return {'type': 'fx', 'component': kind, 'params': params() if params else {}}

def toast(text, color=GREEN, check=True, at=0.5, end=0.86, stars=None, **kw):
    return {'type': 'fx', 'component': 'toast', 'params': {'text': text, 'color': color, 'check': check, 'at': at, 'end': end,
                                                           'stars': color in (GREEN, GOLD) if stars is None else stars, **kw}}

def ban(at, end, on='side', **kw): return {'type': 'fx', 'component': 'ban', 'params': {'at': at, 'end': end, 'on': on, **kw}}

def project(s):
    motion, face, fx, tmode = s['motion'], s['face'], list(s['fx']), s.get('tmode', 'stay')
    dive = s['id'] <= 55 and motion in DIVE and (tmode in ('stay', 'pop') or tmode in THEN)   # 字也有出场才配得上浮上来、潜回去
    off = motion in OFFSCREEN
    mparams = {k: s[k] for k in ('n', 's', 'debris', 'dir', 'flip') if s.get(k) is not None}
    layers = []
    if dive: layers.append({'type': 'motion', 'component': 'surface', 'params': {'in': 0.07, 'out': 0.82, 'look': 22}})
    layers.append({'type': 'motion', 'component': motion, 'params': mparams})
    layers.append({'type': 'face', 'component': 'normal', 'face': face} if isinstance(face, dict) else {'type': 'face', 'component': face})
    if s.get('hold'): layers.append({'type': 'prop', 'component': s['hold'] if isinstance(s['hold'], str) else s['hold']['kind']})
    for w in s.get('wear') or []: layers.append({'type': 'wear', 'component': w})
    win = (0.42, 0.8) if dive else (0.3, 0.92)                     # 字落定了以后
    for f in fx:
        l = fx_layer(f)
        if l['component'] in BURST or l['component'] in BURST_KINDS: l['start'], l['end'] = win
        layers.append(l)
    if isinstance(face, str) and face in HAPPY and len(fx) < 2 and not any(fx_layer(f)['component'] in SPARKLY for f in fx):
        layers.append({'type': 'fx', 'component': 'twinkle', 'start': win[0], 'end': win[1]})
    text = {'type': 'text', 'text': s['text'], 'style': s.get('style', 'pink')}
    timing = {'at': 0.22, 'out': 0.82} if dive else {'at': 0.06, 'gap': 0.14, 'out': 0.9}
    sparks = not (isinstance(face, str) and face in GLUM) and tmode not in ('droop', 'shiver')
    if tmode in ('stay', 'pop'):
        if off: text.update(component='hopat', params={'at': 0.5})
        else: text.update(component='popin', params={**timing, 'sparks': sparks})
    elif tmode in THEN and not off: text.update(component='popthen', params={**timing, 'sparks': sparks, 'then': tmode})
    else: text.update(component=tmode)
    layers.append(text)
    p = {'v': 2, 'name': s['text'], 'size': 400, 'fps': FPS, 'frames': FRAMES, 'seed': s['seed'], 'layers': layers}
    if isinstance(s.get('idle'), dict): p['idle'] = s['idle']
    return p

# ---------------- 照着意思加初代那几样 ----------------
def L(p, comp=None, typ=None):
    return next(l for l in p['layers'] if (comp is None or l['component'] == comp) and (typ is None or l['type'] == typ))
def text_of(p): return L(p, typ='text')
def drop(p, *comps): p['layers'] = [l for l in p['layers'] if l['component'] not in comps]
def add(p, *ls, before_text=True):
    i = p['layers'].index(text_of(p)) if before_text else len(p['layers'])
    p['layers'][i:i] = list(ls)
def popin(p, at, out, gap=0.16): text_of(p).update(component='popin', params={'at': at, 'gap': gap, 'out': out})
def hopat(p, at): text_of(p).update(component='hopat', params={'at': at})

def ov_send(p, pill, kind='mail', typing=False, face=None, send=0.4):
    """举着东西 → 折纸飞机发走 → 提示条（发日志那张的路子）"""
    keep = [l for l in p['layers'] if l['type'] in ('face', 'wear', 'text')]
    p['layers'] = [{'type': 'motion', 'component': 'paperplane', 'params': {'send': send, 'back': 0.86, 'typing': typing, 's': 1.15 if typing else 1.0}},
                   {'type': 'prop', 'component': kind}] + keep
    if face: L(p, typ='face')['component'] = face
    hopat(p, send + 0.1); p['cover'] = round(send - 0.07, 3)
    add(p, toast(pill, at=send + 0.14, end=0.8), before_text=False)

def ov_toss(p, kind, look=18, at=0.5):
    """浮上来拿着东西 → 禁止标志 → 摇头扔进水里（请截图那张的路子）"""
    p['layers'] = [l for l in p['layers'] if l['type'] not in ('motion', 'prop') and l['component'] not in ('cross',) and not str(l.get('params', {}).get('icon', '')).startswith('bug')]
    p['layers'][0:0] = [{'type': 'motion', 'component': 'surface', 'params': {'in': 0.05, 'out': 0.86, 'look': look}},
                        {'type': 'motion', 'component': 'toss', 'params': {'at': at, 'shake': 18, 'x': 60}}, {'type': 'prop', 'component': kind}]
    add(p, ban(at - 0.2, at, on='item'))
    popin(p, 0.2, 0.86)

OVERRIDES = {}
def ov(*ids):
    def deco(fn):
        for i in ids: OVERRIDES[i] = fn
        return fn
    return deco

@ov(1)
def _(p):   # 先看日志：浮上来举着日志纸（红色那行是报错）、张望着看，看到了冒个感叹号
    p['layers'] = [{'type': 'motion', 'component': 'surface', 'params': {'in': 0.06, 'out': 0.85, 'look': 8}},
                   {'type': 'motion', 'component': 'look', 'strength': 0.45}, {'type': 'prop', 'component': 'logpage', 'params': {'s': 1.1}},
                   L(p, typ='face'), {'type': 'fx', 'component': 'pop', 'start': 0.5, 'end': 0.78, 'params': {'icon': 'exclaim', 'k': 8, 'x': 70, 'y': -110, 'beats': 4}},
                   text_of(p)]
    popin(p, 0.22, 0.85)
@ov(7)
def _(p): ov_send(p, '已发送', face='smile')
@ov(9)
def _(p): ov_send(p, '已提交', kind='logpage', typing=True, send=0.45)
@ov(273)
def _(p): ov_send(p, '已提交', face='sad')
@ov(12)
def _(p): ov_toss(p, 'phone')
@ov(15)
def _(p): ov_toss(p, 'bug')                 # 不是 bug：把虫子扔了
@ov(14)
def _(p):   # 看置顶：浮上来、凑近盯着，图钉弹两下
    drop(p, 'stare')
    add(p, {'type': 'motion', 'component': 'stare', 'start': 0.36, 'end': 0.78, 'strength': 0.7}, before_text=False)
    p['layers'].insert(1, p['layers'].pop())
    pin = L(p, 'pop'); pin.update(start=0.45, end=0.8); pin['params'].update(beats=4)
    L(p, 'surface')['params'].update(**{'in': 0.0875, 'out': 0.8125, 'look': 20})
    if not any(l['component'] == 'twinkle' for l in p['layers']): add(p, {'type': 'fx', 'component': 'twinkle', 'start': 0.425, 'end': 0.8125})
    popin(p, 0.2375, 0.8125)
@ov(45)
def _(p):   # 图呢：张望一圈 → 截图框框住自己 → 「截好发我」
    L(p, 'question').update(start=0.2, end=0.46)
    add(p, {'type': 'fx', 'component': 'snip', 'params': {'at': 0.46, 'text': '截好发我'}})
    popin(p, 0.06, 0.92, gap=0.14)
@ov(156)
def _(p):   # 冒泡：从水里浮上来
    L(p, 'peek').update(component='surface', params={'in': 0.06, 'out': 0.88, 'look': 20})
    popin(p, 0.2, 0.88)
@ov(39, 70, 32)
def _(p):   # 别刷屏 / 不行 / 别催了：头旁边弹出禁止标志
    drop(p, 'cross')
    add(p, ban(0.32, 0.88, size=38))

SYS = {     # 提示条：(字, 颜色, 打勾)，像群消息 / 游戏里的系统提示
    6: ('测试通过', GREEN, True), 17: ('构建成功', GREEN, True), 21: ('游戏已崩溃', RED, False), 23: ('下载中 3%', GRAY, False),
    24: ('连接超时', RED, False), 25: ('已连接', GREEN, True), 26: ('已停止运行', RED, False), 27: ('服务器已启动', GREEN, True),
    30: ('你撤回了一条消息', GRAY, False), 31: ('更新完成', GREEN, True), 35: ('存档已损坏', RED, False), 37: ('你已被禁言', GRAY, False),
    42: ('完成', GREEN, True), 4: ('发现新版本', GREEN, False), 78: ('加入了群聊', GRAY, False), 118: ('已收藏', GOLD, True),
    220: ('获得钻石！', GOLD, False), 225: ('被苦力怕炸死了', RED, False), 236: ('试图在熔岩里游泳', RED, False),
    241: ('已重生', GREEN, True), 243: ('交易成功', GREEN, True), 244: ('连接已丢失', RED, False), 250: ('你死了！', RED, False),
    274: ('工资已到账', GOLD, True), 275: ('余额不足', GRAY, False), 277: ('已签收', GREEN, True), 261: ('骑手已接单', GREEN, True),
    295: ('胜利', GOLD, True),
}

def build(s):
    p = project(s)
    if s['id'] in OVERRIDES: OVERRIDES[s['id']](p)
    if s['id'] in SYS:
        txt, col, chk = SYS[s['id']]
        dive = any(l['component'] == 'surface' for l in p['layers'])
        at = 0.46 if dive else 0.4
        add(p, toast(txt, col, chk, at=at, end=0.8 if dive else 0.88), before_text=False)
        p['cover'] = at + 0.12                                      # 封面拍到提示条（字那时候早就落定了）
    p['layers'] = [{'id': f'l{i}', **l} for i, l in enumerate(p['layers'])]
    return p

def parse(sel):
    ids = set()
    for part in sel.split(','):
        a, _, b = part.partition('-'); ids.update(range(int(a), int(b or a) + 1))
    return ids

if __name__ == '__main__':
    pick = parse(sys.argv[1]) if len(sys.argv) > 1 else None
    os.makedirs(OUT, exist_ok=True)
    n = 0
    for s in specs.all_specs():
        if pick and s['id'] not in pick: continue
        with open(os.path.join(OUT, '%03d.json' % s['id']), 'w', encoding='utf-8', newline='\n') as f:
            json.dump(build(s), f, ensure_ascii=False, indent=1); f.write('\n')
        n += 1
    print(n, 'projects ->', os.path.relpath(OUT, ROOT))
