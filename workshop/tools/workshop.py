"""创意工坊的后台：GitHub issue 就是投稿。这个脚本负责校验工程、收下网页引擎出的图、更新 workshop/index.json、统计点赞。

  python workshop/tools/workshop.py prepare                    # 工作流 render 阶段（没有任何权限）：校验 issue 里的工程，写出 $RUNNER_TEMP/job/project.json
  python workshop/tools/workshop.py publish --from DIR [--push]# 工作流 publish 阶段：再校验一遍，收下 DIR/out.gif（Pillow 检查 + 重新编码），提交
  python workshop/tools/workshop.py reject [--push]            # 工作流用：维护者打了 rejected 标签
  python workshop/tools/workshop.py likes [--push]             # 工作流用：按 issue 上的 👍 刷新点赞数
  python workshop/tools/workshop.py check                      # 核对 catalog.json 和 Python 引擎是否一致
  python workshop/tools/workshop.py render recipe.json out.gif # 本地用 Python 引擎试渲一个第一版配方
--push 表示在最新的 main 上提交并推送（工作流里用）；不加就只改本地文件。

issue 正文是不可信输入：只当 JSON 解析（不 eval），结构、大小、文字都有限制，文件名只用 issue 编号。
工程里可以带别人写的组件代码：只在 render 阶段、没有权限也没有网络的容器里、浏览器沙盒中运行（site/tools/render.mjs）。
publish 阶段不信 render 交回来的任何东西：工程从事件里重新读、重新校验，只拿那张 GIF，当图片解码、检查、重新编码。
回复正文写到 $RUNNER_TEMP/workshop/comment.md，状态写到 $GITHUB_OUTPUT。
"""
import os, sys, re, json, math, time, hashlib, subprocess, unicodedata, urllib.request
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
WS = os.path.join(ROOT, 'workshop')
CATALOG = json.load(open(os.path.join(WS, 'catalog.json'), encoding='utf-8'))
INDEX = os.path.join(WS, 'index.json')
KEYS = ('text', 'motion', 'face', 'fx', 'hold', 'wear', 'style', 'tmode')
PER_DAY = 5                      # 每人 24 小时内最多发几张
SITE = 'https://axolotl-launcher.github.io/AxoStickers/'
TMP = os.environ.get('RUNNER_TEMP', os.path.join(ROOT, '_tmp'))

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8'); sys.stderr.reconfigure(encoding='utf-8')

# ---------------- issue 正文 ----------------
def section(body, title):
    m = re.search(r'###\s*%s\s*\n(.*?)(?=\n###\s|\Z)' % title, body, re.S)
    return m.group(1) if m else None

def parse(part, cap, what):
    a, b = part.find('{'), part.rfind('}')       # 表单会包一层 ```json，JSON 本身不会有裸换行，取最外层花括号就行
    if a < 0 or b <= a: raise ValueError(f'没找到{what} JSON（「### {what}」下面那一段）')
    raw = part[a:b + 1]
    if len(raw.encode('utf-8')) > cap: raise ValueError(f'{what}太大了（最多 {cap // 1000} KB）')
    def nonfinite(c): raise ValueError(f'{what}里不能有 {c}（不是标准 JSON）')
    try: r = json.loads(raw, parse_constant=nonfinite)
    except json.JSONDecodeError as e: raise ValueError(f'{what}不是合法的 JSON：{e.msg}（第 {e.lineno} 行第 {e.colno} 列）')
    if not isinstance(r, dict): raise ValueError(f'{what}应该是一个 JSON 对象')
    return r

def extract(body):
    """issue 表单正文 -> ('project', 工程) 或 ('recipe', 第一版的配方)。"""
    if not isinstance(body, str) or len(body) > 65536: raise ValueError('issue 正文太长了')
    for title, kind, cap in (('工程', 'project', PROJECT_MAX), ('配方', 'recipe', 2000)):
        part = section(body, title)
        if part is not None: return kind, parse(part, cap, title)
    r = parse(body, PROJECT_MAX, '工程')         # 没有小标题：整段就是 JSON
    return ('project' if 'layers' in r else 'recipe'), r

def consented(body):
    """「### 授权」那一段里的复选框勾上了没有（表单里是必填，但 API 建的 / 改过正文的 issue 绕得过去）。"""
    m = re.search(r'###\s*授权\s*\n(.*?)(?=\n###\s|\Z)', body or '', re.S)
    return bool(m and re.search(r'^\s*[-*]\s*\[[xX]\]', m.group(1), re.M))

def show(v):
    """把用户输入放进行内代码再回显：不会被当成 @提及 或 markdown。"""
    return '`' + re.sub(r'\s+', ' ', str(v)[:40]).replace('`', "'") + '`'

# ---------------- 第一版配方（网站第一版、老链接） ----------------
TEXT_RE = re.compile('[%s]+' % CATALOG['text']['chars'])

def validate(r):
    """返回 (规范化后的配方, [问题])。"""
    C, errs = CATALOG, []
    extra = sorted(set(r) - set(KEYS) - {'v'})
    if extra: errs.append('不认识的字段：' + '、'.join(show(k) for k in extra[:8]))
    text = r.get('text')
    if not isinstance(text, str): errs.append('缺少文字 text'); text = ''
    text = unicodedata.normalize('NFC', text).strip()
    n = len(text)
    if not C['text']['min'] <= n <= C['text']['max']: errs.append(f"文字要 {C['text']['min']}～{C['text']['max']} 个字，现在是 {n} 个")
    elif not TEXT_RE.fullmatch(text):
        bad = ''.join(sorted({c for c in text if not TEXT_RE.fullmatch(c)}))
        errs.append(f'文字里有不支持的字符：{show(bad)}（{C["text"]["hint"]}）')
    def one(key, table, default=None):
        v = r.get(key, default)
        if v is None and default is None: return None
        if not isinstance(v, str) or v not in C[table]: errs.append(f'{key} 不在可选范围里：{show(v)}'); return None
        return v
    motion = one('motion', 'motions', 'idle')
    face = one('face', 'faces', 'normal')
    style = one('style', 'styles', 'pink')
    tmode = one('tmode', 'tmodes', 'stay')
    fx = r.get('fx', [])
    if not isinstance(fx, list) or len(fx) > C['limits']['fx'] or len(set(map(str, fx))) != len(fx):
        errs.append(f"特效 fx 最多 {C['limits']['fx']} 个、不能重复"); fx = []
    fx = [f for f in fx if isinstance(f, str) and f in C['fx'] or errs.append(f'特效不在可选范围里：{show(f)}')]
    wear = r.get('wear', [])
    if isinstance(wear, str): wear = [wear]
    if not isinstance(wear, list) or len(wear) > C['limits']['wear']: errs.append('帽子 wear 最多 1 个'); wear = []
    wear = [w for w in wear if isinstance(w, str) and w in C['wears'] or errs.append(f'帽子不在可选范围里：{show(w)}')]
    hold = r.get('hold')
    if hold is not None and (not isinstance(hold, str) or hold not in C['holds']):
        errs.append(f'道具不在可选范围里：{show(hold)}'); hold = None
    m = C['motions'].get(motion or '', {})
    if m.get('noHold'): hold = None
    elif m.get('prop') and not hold: hold = m['prop']
    if m.get('offscreen') and tmode in C['entrance']:
        errs.append(f'「{m["zh"]}」中途会离开画面，文字动画不能用「{C["tmodes"][tmode]}」（封面会拍不到美西螈）')
    rec = dict(text=text, motion=motion, face=face, fx=fx, hold=hold, wear=wear, style=style, tmode=tmode)
    return rec, errs

def from_recipe(rec):
    """第一版配方 -> 工程（和 site/src/engine/project.js 的 fromRecipe 一样）。"""
    layers = [{'type': 'motion', 'component': rec['motion']}, {'type': 'face', 'component': rec['face']}]
    if rec['hold']: layers.append({'type': 'prop', 'component': rec['hold']})
    layers += [{'type': 'wear', 'component': w} for w in rec['wear']]
    layers += [{'type': 'fx', 'component': f} for f in rec['fx']]
    layers.append({'type': 'text', 'component': rec['tmode'], 'text': rec['text'], 'style': rec['style']})
    return {'v': 2, 'name': rec['text'], 'layers': [{'id': f'l{i}', **l} for i, l in enumerate(layers)]}

# ---------------- 工程（网站编辑器 v2） ----------------
PROJECT_MAX = 60000              # 整个工程 JSON 的字节数
LIM = dict(components=8, component=40000, layers=40, texts=4, text=16, frames=96)
TOP = {'v', 'name', 'size', 'fps', 'frames', 'seed', 'background', 'camera', 'water', 'idle', 'skin', 'model', 'components', 'layers'}
LAYER_TYPES = {'motion', 'face', 'prop', 'wear', 'fx', 'text', 'scene'}
LAYER_KEYS = {'id', 'type', 'component', 'params', 'start', 'end', 'strength', 'hidden', 'text', 'style', 'x', 'y', 'scale', 'face', 'blink'}
MODELS = {'axolotl': '美西螈', 'logo': 'Logo 版'}
ID_RE = re.compile(r'[A-Za-z0-9_.:\-]{1,80}')
LAYER_TEXT_RE = re.compile('[%s/ ]*' % CATALOG['text']['chars'])
SIZE = 400                       # 工坊统一按 400px 出图

def plain(v, depth=0):
    """参数这类值只能是 JSON 的基本类型、不深不大的数组和对象。"""
    if depth > 4: return False
    if v is None or isinstance(v, (bool, int)): return True
    if isinstance(v, float): return math.isfinite(v)               # 1e999 这种会变成 inf，写出去就不是合法 JSON 了
    if isinstance(v, str): return len(v) <= 400
    if isinstance(v, list): return len(v) <= 64 and all(plain(x, depth + 1) for x in v)
    if isinstance(v, dict): return len(v) <= 64 and all(isinstance(k, str) and len(k) <= 40 and plain(x, depth + 1) for k, x in v.items())
    return False

def number(v, lo, hi):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and lo <= v <= hi

def validate_project(p):
    """返回 (规范化后的工程, [问题])。数值的细节交给网页引擎的 normalizeProject 去夹，这里管结构、大小和会显示出来的文字。"""
    errs = []
    extra = sorted(set(p) - TOP)
    if extra: errs.append('不认识的字段：' + '、'.join(show(k) for k in extra[:8]))
    out = {'v': 2, 'name': unicodedata.normalize('NFC', str(p.get('name') or '')).strip()[:40], 'size': SIZE}
    for k, lo, hi, d in (('fps', 5, 30, 15), ('frames', 4, LIM['frames'], 48), ('seed', 0, 1e6, 0)):
        v = p.get(k, d)
        if not number(v, lo, hi): errs.append(f'{k} 要在 {lo}～{int(hi)} 之间：{show(v)}'); v = d
        out[k] = int(v) if k != 'fps' else v
    for k in ('background', 'camera', 'water', 'idle'):
        v = p.get(k, {})
        if not isinstance(v, dict) or len(v) > 16 or not plain(v): errs.append(f'{k} 应该是一个小的 JSON 对象'); v = {}
        out[k] = v
    skin = p.get('skin', {'component': 'lucy'})
    if not isinstance(skin, dict) or not isinstance(skin.get('component'), str) or not ID_RE.fullmatch(skin['component']) or not plain(skin.get('params', {})):
        errs.append('皮肤 skin 的格式不对'); skin = {'component': 'lucy'}
    out['skin'] = {'component': skin['component'], 'params': skin.get('params') or {}}
    model = p.get('model', {}) if isinstance(p.get('model', {}), dict) else {}
    mid = model.get('component', 'axolotl')
    if not isinstance(mid, str) or mid not in MODELS:
        errs.append(f'模型只能用网站自带的（{"、".join(MODELS.values())}）：自己载入的模型文件只在你的浏览器里，发不上来')
        mid = 'axolotl'
    out['model'] = {'component': mid, 'face': model.get('face') if isinstance(model.get('face'), bool) else None}

    comps = p.get('components', [])
    if not isinstance(comps, list) or len(comps) > LIM['components']:
        errs.append(f"工程最多带 {LIM['components']} 段组件代码"); comps = []
    out['components'] = []
    for c in comps:
        if not isinstance(c, dict) or not isinstance(c.get('source'), str):
            errs.append('components 里每一项要有 source（组件代码）'); continue
        if len(c['source'].encode('utf-8')) > LIM['component']:
            errs.append(f"有一段组件代码超过 {LIM['component'] // 1000} KB"); continue
        out['components'].append({'origin': str(c.get('origin') or 'project')[:80], 'source': c['source']})

    layers = p.get('layers')
    if not isinstance(layers, list) or not layers: errs.append('工程里没有图层'); layers = []
    if len(layers) > LIM['layers']: errs.append(f"图层最多 {LIM['layers']} 个"); layers = layers[:LIM['layers']]
    out['layers'], ids = [], set()
    for i, l in enumerate(layers):
        where = f'第 {i + 1} 个图层'
        if not isinstance(l, dict): errs.append(f'{where}应该是一个对象'); continue
        bad = sorted(set(l) - LAYER_KEYS)
        if bad: errs.append(f'{where}有不认识的字段：' + '、'.join(show(k) for k in bad[:6]))
        t, comp = l.get('type'), l.get('component')
        if not isinstance(t, str) or t not in LAYER_TYPES: errs.append(f'{where}的类型不对：{show(t)}'); continue
        if not isinstance(comp, str) or not ID_RE.fullmatch(comp): errs.append(f'{where}的组件名不对：{show(comp)}'); continue
        q = {'id': str(l.get('id') or f'l{i}')[:40], 'type': t, 'component': comp}
        if q['id'] in ids: errs.append(f'{where}的 id 和前面的图层重复了：{show(q["id"])}')
        ids.add(q['id'])
        if 'params' in l:
            if not isinstance(l['params'], dict) or not plain(l['params']): errs.append(f'{where}的参数 params 格式不对')
            else: q['params'] = l['params']
        for k, lo, hi in (('start', 0, 1), ('end', 0, 1), ('strength', 0, 2), ('x', -256, 256), ('y', 0, 512), ('scale', 0.3, 2)):
            if k in l:
                if number(l[k], lo, hi): q[k] = l[k]
                else: errs.append(f'{where}的 {k} 要在 {lo}～{hi} 之间')
        for k in ('hidden', 'blink'):
            if k in l: q[k] = bool(l[k])
        if t == 'text':
            text = unicodedata.normalize('NFC', str(l.get('text', ''))).strip()
            n = len(text.replace('/', '').replace(' ', ''))
            if n > LIM['text']: errs.append(f"{where}的文字太长了（最多 {LIM['text']} 个字）")
            elif not LAYER_TEXT_RE.fullmatch(text):
                bad = ''.join(sorted({c for c in text if not LAYER_TEXT_RE.fullmatch(c)}))
                errs.append(f'{where}的文字里有不支持的字符：{show(bad)}（只能用{CATALOG["text"]["hint"].split("：", 1)[-1]}，用 / 换行）')
            q['text'] = text
            style = l.get('style', 'pink')
            if not isinstance(style, str) or style not in CATALOG['styles']:
                errs.append(f'{where}的字色不对：{show(style)}（只能用内置的：{"、".join(CATALOG["styles"])}）'); style = 'pink'
            q['style'] = style
        if t == 'face' and l.get('face') is not None:
            if not isinstance(l['face'], dict) or not plain(l['face']): errs.append(f'{where}的表情部件 face 格式不对')
            else: q['face'] = l['face']
        out['layers'].append(q)
    texts = [l for l in out['layers'] if l['type'] == 'text']
    if len(texts) > LIM['texts']: errs.append(f"文字图层最多 {LIM['texts']} 个")
    if not any(l['text'] and not l.get('hidden') for l in texts): errs.append('至少要有一行文字（表情包嘛）')
    return out, errs

def title_of(p):
    t = next((l['text'] for l in p['layers'] if l['type'] == 'text' and l['text'] and not l.get('hidden')), '')
    return t.replace('/', ' ').strip() or p.get('name') or '美西螈'

# 和 site/src/engine/project.js 的 DEFAULTS 一致：查重时没写的设置按默认值算
DEFAULTS = {'fps': 15, 'frames': 48, 'background': {'mode': 'white', 'color': '#ffffff'},
            'camera': {'yaw': 160, 'pitch': 28, 'zoom': 1, 'persp': 0.15},
            'water': {'on': True, 'level': 405, 'calm': 1, 'bubbles': True, 'ripples': True, 'color': '#aadeff'},
            'idle': {'look': 20, 'gill': 1, 'tail': 1, 'paddle': 1, 'bob': 4}}
LAYER_DEFAULTS = {'start': 0, 'end': 1, 'strength': 1, 'hidden': False, 'params': {}}
TEXT_DEFAULTS = {'style': 'pink', 'x': 0, 'y': 118, 'scale': 1}

def digest(p):
    """查重用：名字、随机种子、图层 id 不算，没写的设置按默认值算（换个写法的同一个工程不算新作品）。"""
    core = {k: v for k, v in p.items() if k not in ('name', 'seed', 'layers', 'size')}
    for k, d in DEFAULTS.items(): core[k] = {**d, **core[k]} if isinstance(d, dict) else core.get(k, d)
    core['skin'] = {'params': {}, **core.get('skin', {})}
    core['layers'] = [{**LAYER_DEFAULTS, **(TEXT_DEFAULTS if l['type'] == 'text' else {}), **(({'blink': True}) if l['type'] == 'face' else {}),
                       **{k: v for k, v in l.items() if k != 'id'}} for l in p['layers']]
    return hashlib.sha256(json.dumps(core, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')).hexdigest()[:20]

def describe(p):
    """评论里的一行摘要。认识的内置组件写中文名，别的写组件 id。"""
    C = CATALOG
    names = {'motion': lambda k: C['motions'].get(k, {}).get('zh'), 'face': C['faces'].get, 'fx': C['fx'].get, 'prop': C['holds'].get, 'wear': C['wears'].get}
    label = {'motion': '动作', 'face': '表情', 'prop': '道具', 'wear': '帽子', 'fx': '特效', 'scene': '场景'}
    groups = {}
    for l in p['layers']:
        if l.get('hidden') or l['type'] == 'text': continue
        zh = names.get(l['type'], lambda k: None)(l['component'])
        if l['type'] == 'face' and l.get('face'): zh = '自己拼的'
        groups.setdefault(l['type'], []).append(zh or show(l['component']))
    parts = [f'{label[t]} ' + '、'.join(groups[t]) for t in label if t in groups]
    parts.append(f"{p['frames']} 帧 · {p['fps']} fps")
    if p['model']['component'] != 'axolotl': parts.append(f"模型 {MODELS[p['model']['component']]}")
    if p['components']: parts.append(f"自带 {len(p['components'])} 段组件代码")
    return ' · '.join(parts)

def submission(body):
    """issue 正文 -> (工程, [问题])。prepare 和 publish 各算一遍。"""
    try:
        kind, obj = extract(body)
        if kind == 'recipe':
            rec, errs = validate(obj)
            proj, more = validate_project(from_recipe(rec)) if not errs else (None, [])
            errs += more
        else:
            proj, errs = validate_project(obj)
    except ValueError as e:
        proj, errs = None, [str(e)]
    except (TypeError, KeyError, AttributeError) as e:            # 结构怪到上面的检查没想到：当成格式不对，别让工作流崩掉
        proj, errs = None, [f'工程的格式不对（{type(e).__name__}）']
    if not consented(body): errs.append('没勾选「授权」：要同意按 GPL-3.0-only 发布才能进工坊')
    return proj, errs

# ---------------- 收图 ----------------
class RenderFailed(Exception):
    def __init__(self, lines): super().__init__('render failed'); self.lines = list(lines)

def report_of(src):
    """render 交回来的 out.json：只当数据读，限大小，字段都再夹一遍。"""
    try:
        path = os.path.join(src, 'out.json')
        if os.path.getsize(path) > 65536: return {}
        r = json.load(open(path, encoding='utf-8'))
        return r if isinstance(r, dict) else {}
    except (OSError, ValueError): return {}

def problems(rep):
    out = []
    for e in (rep.get('errors') or [])[:8] if isinstance(rep.get('errors'), list) else []:
        if isinstance(e, dict):
            where = str(e.get('key') or e.get('origin') or '')[:60]
            line = f"（第 {int(e['line'])} 行）" if isinstance(e.get('line'), int) else ''
            out.append(f"{where}{line}：{str(e.get('message', ''))[:200]}")
    if not out and rep.get('message'): out.append(str(rep['message'])[:300])
    return out or ['没出图（出图那一步没有交回 GIF）']

def gif_frames(path, size=SIZE, max_frames=LIM['frames']):
    """GIF -> ([RGBA 帧（透明只分有 / 没有）], [每帧毫秒])。尺寸必须正好是工程的出图尺寸，帧数不能比工程多。"""
    import numpy as np
    from PIL import Image, ImageSequence
    frames, durs = [], []
    with Image.open(path) as im:
        if im.format != 'GIF' or im.size != (size, size) or getattr(im, 'n_frames', 1) > max_frames:
            raise RenderFailed([f'出的图不对：{im.format} {im.size} {getattr(im, "n_frames", 1)} 帧（应该是 {size}×{size}、最多 {max_frames} 帧）'])
        for fr in ImageSequence.Iterator(im):
            a = np.array(fr.convert('RGBA')); solid = a[..., 3] >= 128
            a[~solid] = 0; a[solid, 3] = 255
            frames.append(a); durs.append(int(fr.info.get('duration') or 0))
    return frames, durs

def adopt(src, gif, cover, max_frames=LIM['frames']):
    """render 那边（跑过别人代码的容器）交回来的 GIF：当图片解码，查尺寸 / 帧数 / 大小，
    用 Pillow 重新编码（调色板按每帧实际用到的颜色原样保留），第一帧存成封面 PNG。
    重新编码的图会再解一遍，必须和交回来的逐帧一模一样。"""
    import numpy as np
    from PIL import Image
    rep = report_of(src) if src else {}
    path = os.path.join(src or '', 'out.gif')
    if not src or not os.path.isfile(path) or rep.get('errors'): raise RenderFailed(problems(rep))
    if os.path.getsize(path) > 3 << 20: raise RenderFailed(['出的图超过 3 MB'])
    try: frames, durs = gif_frames(path, SIZE, max_frames)
    except RenderFailed: raise
    except Exception as e: raise RenderFailed([f'出的图解不开：{type(e).__name__}'])
    durs = [min(1000, max(20, round(d / 10) * 10 or 70)) for d in durs]
    seq, sd = [], []                                # 连续一样的帧并成一帧（Pillow 也会这么做，先并好才好逐帧核对）
    for f, d in zip(frames, durs):
        if seq and (seq[-1] == f).all(): sd[-1] += d
        else: seq.append(f); sd.append(d)
    clear = any((f[..., 3] == 0).any() for f in seq)
    out = []
    for f in seq:
        solid = f[..., 3] == 255
        key = (f[..., 0].astype(np.uint32) << 16) | (f[..., 1].astype(np.uint32) << 8) | f[..., 2]
        uniq, inv = np.unique(key[solid], return_inverse=True)
        if len(uniq) > 255: raise RenderFailed([f'有一帧超过 255 种颜色（{len(uniq)}）'])   # GIF 每帧本来就 ≤256 色
        idx = np.full(key.shape, len(uniq), np.uint8); idx[solid] = inv.astype(np.uint8)
        pal = np.stack([(uniq >> 16) & 255, (uniq >> 8) & 255, uniq & 255], 1).astype(np.uint8).reshape(-1).tolist()
        p = Image.fromarray(idx, 'P'); p.putpalette(pal + [0, 0, 0] * (256 - len(uniq)))
        if clear: p.info['transparency'] = len(uniq)
        out.append(p)
    os.makedirs(os.path.dirname(gif), exist_ok=True); os.makedirs(os.path.dirname(cover), exist_ok=True)
    out[0].save(gif, save_all=True, append_images=out[1:], duration=sd, loop=0, disposal=2 if clear else 1, optimize=False)
    Image.fromarray(frames[0], 'RGBA').save(cover, optimize=True)      # 导出时已经把封面（字刚好出全）转到第一帧了
    got, gd = gif_frames(gif, SIZE, max_frames)
    if len(got) != len(seq) or gd != sd or any((g != w).any() for g, w in zip(got, seq)):
        raise RenderFailed(['重新编码后的图和出的图对不上（维护者看一下 workshop.py 的 adopt）'])
    return dict(frames=len(seq), kb=round(os.path.getsize(gif) / 1024))

# ---------------- index ----------------
def load_index():
    if not os.path.exists(INDEX): return {'version': 1, 'entries': []}
    return json.load(open(INDEX, encoding='utf-8'))

def save_index(d):
    """一条投稿一行，diff 好看。"""
    d['entries'].sort(key=lambda e: -e['issue'])
    rows = ',\n'.join('  ' + json.dumps(e, ensure_ascii=False, separators=(',', ':')) for e in d['entries'])
    with open(INDEX, 'w', encoding='utf-8', newline='\n') as f:
        f.write('{\n "version": %d,\n "entries": [%s]\n}\n' % (d.get('version', 1), '\n' + rows + '\n ' if rows else ''))

# ---------------- GitHub plumbing ----------------
def event():
    return json.load(open(os.environ['GITHUB_EVENT_PATH'], encoding='utf-8'))

def outputs(**kw):
    path = os.environ.get('GITHUB_OUTPUT')
    lines = ''.join(f'{k}={v}\n' for k, v in kw.items())
    if path:
        with open(path, 'a', encoding='utf-8') as f: f.write(lines)
    print(lines, end='')

def write_comment(text):
    d = os.path.join(TMP, 'workshop')
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, 'comment.md'), 'w', encoding='utf-8') as f: f.write(text)

def api(path, token, repo):
    url = f'https://api.github.com/repos/{repo}/{path}'
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json',
                                               'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'axostickers-workshop'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def git(*args, check=True):
    r = subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    if check and r.returncode: raise SystemExit(f'git {args[0]} failed: {r.stderr.strip()}')
    return r

BOT = ('-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com')

class Abort(Exception):
    """change() 在最新的 index 上发现这次改动不该做了：status 写进 $GITHUB_OUTPUT，errs 回复给 issue。"""
    def __init__(self, status, errs=()):
        super().__init__(status); self.status, self.errs = status, list(errs)

def fetch_main():
    for k in range(5):                              # GitHub 偶尔抖一下，有限次退避重试
        if git('fetch', '-q', 'origin', 'main', check=False).returncode == 0: return
        time.sleep(2 ** k * 3)
    raise SystemExit('git fetch failed 5 times')

def apply(change, paths, message, push):
    """改 index.json（和几个文件）。push=True 时在最新的 main 上重放这次改动再推送：
    几张投稿同时在跑也不会互相覆盖（不用 concurrency 组，那个会把排队的直接丢掉）。
    change(idx) 每次都在最新的 index 上跑，可以抛 Abort 放弃。"""
    if not push:
        idx = load_index(); change(idx); save_index(idx); return True
    keep = {p: open(os.path.join(ROOT, p), 'rb').read() for p in paths if os.path.exists(os.path.join(ROOT, p))}
    for attempt in range(6):
        fetch_main()
        git('checkout', '-q', '-f', '-B', 'workshop-bot', 'origin/main')
        idx = load_index(); change(idx)
        for p in paths:
            full = os.path.join(ROOT, p)
            if p in keep:
                os.makedirs(os.path.dirname(full), exist_ok=True)
                with open(full, 'wb') as f: f.write(keep[p])
            elif os.path.exists(full): os.remove(full)
        save_index(idx)
        git('add', '-A', '--', 'workshop')
        if git('diff', '--cached', '--quiet', check=False).returncode == 0:
            print('nothing to commit'); return False
        git(*BOT, 'commit', '-q', '-m', message)
        if git('push', '-q', 'origin', 'HEAD:main', check=False).returncode == 0: return True
        print('push rejected, retrying'); time.sleep(3 + attempt * 4)
    raise SystemExit('push failed 6 times')

def limits(idx, h, author, num):
    """查重 + 每人每天的配额，按给定的 index 算（发布前查一次，重放到最新 index 上时再查一次）。"""
    errs, others = [], [e for e in idx['entries'] if e['issue'] != num]
    same = next((e for e in others if e.get('hash') == h), None)
    if same: errs.append(f"工坊里已经有一模一样的了：#{same['issue']}（@{same['author']}）。换个表情或者特效再来")
    now = datetime.now(timezone.utc)
    recent = [e for e in others if e['author'] == author and now - datetime.fromisoformat(e['date']) < timedelta(days=1)]
    if len(recent) >= PER_DAY: errs.append(f'24 小时内每人最多发 {PER_DAY} 张，明天再来')
    return errs

def still_current(num, body):
    """出图要一两分钟：提交前再看一眼 issue，被改过正文（新的那次运行会处理）、关了或被撤下就不发了。"""
    token, repo = os.environ.get('GITHUB_TOKEN'), os.environ.get('GITHUB_REPOSITORY')
    if not token or not repo: return
    try: cur = api(f'issues/{num}', token, repo)
    except Exception as e: print('issue check skipped:', e); return   # 查不到就按事件里的来，别让抖动卡住发布
    if any(l.get('name') == 'rejected' for l in cur.get('labels', [])): raise Abort('stale')
    if cur.get('state') != 'open' or (cur.get('body') or '') != body: raise Abort('stale')

def rejected_now(num):
    """推送之后再看一眼有没有被打 rejected：维护者恰好在「提交前检查」和「推送」之间撤下的话，撤下的工作流可能没看到这张。"""
    token, repo = os.environ.get('GITHUB_TOKEN'), os.environ.get('GITHUB_REPOSITORY')
    if not token or not repo: return False
    for k in range(3):
        try: return any(l.get('name') == 'rejected' for l in api(f'issues/{num}', token, repo).get('labels', []))
        except Exception as e: print('label check failed:', e); time.sleep(3 + 3 * k)
    return False

def remove(num, push):
    """把第 num 张从 index 和文件里拿掉（总在最新的 main 上做），返回有没有拿掉东西。"""
    paths, found = [f'workshop/gifs/{num}.gif', f'workshop/covers/{num}.png', f'workshop/projects/{num}.json'], []
    for p in paths:
        if os.path.exists(os.path.join(ROOT, p)): os.remove(os.path.join(ROOT, p))
    def drop(idx):
        found[:] = [e for e in idx['entries'] if e['issue'] == num]
        idx['entries'] = [e for e in idx['entries'] if e['issue'] != num]
    apply(drop, paths, f"工坊：撤下 #{num}", push)
    return bool(found)

MARK = '<!-- workshop:published -->'

def published_comment(e, repo):
    return (f'出图了 ✅\n\n![{e["text"]}](https://github.com/{repo}/blob/main/{e["gif"]}?raw=true)\n\n'
            f'- {e.get("summary", "")}\n- 网站上几分钟后就能看到：{SITE}#/workshop（点「在工坊里改一改」能把整个工程载进编辑器接着改）\n'
            f'- 觉得好笑就给这个 issue 点个 👍，工坊的「最多赞」按它排（每 6 小时数一次）\n\n'
            f'机器人顺手把 issue 关了，点赞不受影响。\n{MARK}\n')

def invalid_comment(errs):
    return ('没能出图 ❌\n\n' + '\n'.join(f'- {e}' for e in errs) +
            '\n\n改一下正文里的工程（或者回网站编辑器重新点「发布到工坊」把新的贴过来），保存后机器人会再试一次。\n')

def failed_comment(lines):
    body = '\n'.join(lines).replace('```', "'''")[:2000]
    return ('出图的时候出错了 ❌\n\n```text\n' + body + '\n```\n\n'
            '在网站编辑器里打开这个工程看看报错（「代码」面板和预览左上角的红色角标），修好后改一下正文保存，机器人会再试一次。\n')

# ---------------- commands ----------------
def issue_of(ev):
    issue = ev['issue']
    return int(issue['number']), str(issue['user']['login']), issue.get('body') or ''

def cmd_prepare():
    """render 阶段：没有任何权限。只校验、写出工程，回复交给 publish 阶段（它会自己再算一遍）。"""
    num, author, body = issue_of(event())
    idx = load_index()
    if any(e['issue'] == num for e in idx['entries']): return outputs(status='skip', number=num)
    proj, errs = submission(body)
    if not errs: errs = limits(idx, digest(proj), author, num)
    if errs:
        print('\n'.join(errs)); return outputs(status='invalid', number=num)
    d = os.path.join(TMP, 'job'); os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, 'project.json'), 'w', encoding='utf-8') as f: json.dump(proj, f, ensure_ascii=False)
    print(describe(proj))
    outputs(status='ok', number=num)

def cmd_publish(push, src):
    num, author, body = issue_of(event())
    repo = os.environ.get('GITHUB_REPOSITORY', 'Axolotl-Launcher/AxoStickers')
    idx = load_index()
    done = next((e for e in idx['entries'] if e['issue'] == num), None)
    if done:                                       # 已经发过：交给工作流补回复 / 关 issue / 部署（都是幂等的）
        print('already published'); write_comment(published_comment(done, repo)); return outputs(status='skip', number=num)
    proj, errs = submission(body)
    h = digest(proj) if proj else None
    if not errs: errs = limits(idx, h, author, num)
    if errs:
        write_comment(invalid_comment(errs))
        return outputs(status='invalid', number=num)
    gif, cover, pj = f'workshop/gifs/{num}.gif', f'workshop/covers/{num}.png', f'workshop/projects/{num}.json'
    try:
        info = adopt(src, os.path.join(ROOT, gif), os.path.join(ROOT, cover), proj['frames'])
    except RenderFailed as e:
        print('render failed:', e.lines)
        write_comment(failed_comment(e.lines))
        return outputs(status='failed', number=num)
    print(f"adopted #{num}: {info['frames']} frames, {info['kb']} KB")
    os.makedirs(os.path.join(WS, 'projects'), exist_ok=True)
    with open(os.path.join(ROOT, pj), 'w', encoding='utf-8', newline='\n') as f: json.dump(proj, f, ensure_ascii=False, indent=1)
    entry = dict(issue=num, v=2, text=title_of(proj), summary=describe(proj), project=pj, hash=h, author=author,
                 date=datetime.now(timezone.utc).replace(microsecond=0).isoformat(), likes=0, gif=gif, cover=cover, frames=info['frames'])
    def add(idx):
        errs = limits(idx, h, author, num)           # 别的投稿可能刚抢先落库
        if errs: raise Abort('invalid', errs)
        still_current(num, body)
        idx['entries'] = [e for e in idx['entries'] if e['issue'] != num] + [entry]
    try:
        apply(add, [gif, cover, pj], f'工坊：#{num}「{entry["text"]}」by @{author}', push)
    except Abort as a:
        print('aborted:', a.status)
        if a.errs: write_comment(invalid_comment(a.errs))
        return outputs(status=a.status, number=num)
    if push and rejected_now(num):                     # 推送的同时被撤下了：自己收回来
        print('rejected while publishing, removing again'); remove(num, push)
        return outputs(status='stale', number=num)
    write_comment(published_comment(entry, repo))
    outputs(status='published', number=num)

def cmd_reject(push):
    num = int(event()['issue']['number'])
    hit = remove(num, push)                            # 在最新的 main 上查：发布的那次可能刚刚推上去
    write_comment('这张被维护者撤下了，工坊里不再展示。\n')
    outputs(status='removed' if hit else 'none', number=num)

def cmd_likes(push):
    token, repo = os.environ['GITHUB_TOKEN'], os.environ['GITHUB_REPOSITORY']
    want = {e['issue'] for e in load_index()['entries']}
    likes, page = {}, 1
    while want - set(likes) and page <= 30:
        items = api(f'issues?labels=workshop&state=all&per_page=100&page={page}', token, repo)
        for it in items:
            if 'pull_request' not in it: likes[it['number']] = int(it.get('reactions', {}).get('+1', 0))
        if len(items) < 100: break
        page += 1
    for n in sorted(want - set(likes)):              # 没带标签的老投稿：单独问
        try: likes[n] = int(api(f'issues/{n}', token, repo).get('reactions', {}).get('+1', 0))
        except Exception as e: print('skip', n, e)
    changed = []
    def update(idx):
        changed.clear()
        for e in idx['entries']:
            if e['issue'] in likes and likes[e['issue']] != e.get('likes'):
                e['likes'] = likes[e['issue']]; changed.append(e['issue'])
    apply(update, [], '工坊：更新点赞数', push)
    print('likes updated:', len(changed))
    outputs(changed=len(changed))

def cmd_check():
    sys.path.insert(0, os.path.join(ROOT, 'engine'))
    import axl, motions, items, fx
    C, bad = CATALOG, []
    bad += [f'motion {m}' for m in C['motions'] if m not in motions.REG]
    bad += [f'face {m}' for m in C['faces'] if m not in motions.FACES]
    bad += [f'fx {m}' for m in C['fx'] if m not in fx.REG]
    bad += [f'hold {m}' for m in C['holds'] if m not in items.SPR and m not in items.BLK]
    bad += [f'wear {m}' for m in C['wears'] if m not in items.GEAR]
    bad += [f'style {m}' for m in C['styles'] if m not in axl.STYLES]
    print('catalog OK' if not bad else 'catalog mismatch: ' + ', '.join(bad))
    return 1 if bad else 0

def cmd_render(path, out):
    sys.path.insert(0, os.path.join(ROOT, 'engine'))
    import axl, motions
    rec, errs = validate(json.load(open(path, encoding='utf-8')))
    if errs: print('\n'.join(errs)); return 1
    spec = {k: rec[k] for k in KEYS if rec.get(k) not in (None, [])}
    kb, cols = axl.export(motions.make(spec), out, cover_png=os.path.splitext(out)[0] + '.png')
    print(out, round(kb), 'KB', cols, 'colours')

if __name__ == '__main__':
    a = sys.argv[1:] or ['check']
    push = '--push' in a
    src = a[a.index('--from') + 1] if '--from' in a and a.index('--from') + 1 < len(a) else None
    cmds = {'prepare': cmd_prepare, 'publish': lambda: cmd_publish(push, src), 'reject': lambda: cmd_reject(push),
            'likes': lambda: cmd_likes(push), 'check': cmd_check, 'render': lambda: cmd_render(a[1], a[2])}
    sys.exit(cmds[a[0]]() or 0)
