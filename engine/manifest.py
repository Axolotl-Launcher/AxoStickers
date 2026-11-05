"""生成 out/stickers.json：每张表情的文字、分类、动作、表情、特效、道具、配色、文件路径（给展示网页 / 工坊用）。"""
import os, sys, re, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import specs, build

ROOT = os.path.dirname(HERE)
CAT = {'群里答疑': 'support', '打招呼 / 日常回复': 'daily', '情绪': 'mood', '我的世界': 'minecraft', '生活': 'life'}

def categories():
    cur, out = None, {}
    for line in open(os.path.join(HERE, 'specs.py'), encoding='utf-8'):
        m = re.match(r"\s*# ---------- (.+?) ----------", line)
        if m: cur = m.group(1)
        m = re.match(r"\s*S\('([^']+)'", line)
        if m: out[m.group(1)] = cur
    return out

def main():
    cats = categories()
    items = []
    for s in specs.all_specs():
        name = build.fname(s)
        face = s.get('face', 'normal')
        items.append(dict(
            id=s['id'], text=s['text'], category=CAT.get(cats.get(s['text']), 'other'), category_zh=cats.get(s['text']),
            motion=s.get('motion', 'idle'), face=face if isinstance(face, str) else 'custom',
            fx=[f if isinstance(f, str) else f[0] + ':' + str(f[1]) for f in s.get('fx', [])],
            hold=s.get('hold') if isinstance(s.get('hold'), (str, type(None))) else s['hold'].get('kind'),
            wear=s.get('wear', []), style=s.get('style', 'pink'), tmode=s.get('tmode', 'stay'),
            gif=f'out/{name}.gif', cover=f'out/_封面/{name}.png'))
    # 不是 specs.py 出的图（没有配方）：初代表情包工具包 examples/ 里的原图，水龙卷特别篇（tornado.py）。
    # slug 是网站上的英文文件名（gif/<slug>.gif），series 是下载 / 拖出去时文件名的前缀
    extra = [dict(id=f'初代-{t}', slug=f'og-{s}', series='初代', text=t, category='support', category_zh='群里答疑', motion='original', gif=f'out/初代_{t}.gif')
             for t, s in (('发日志', 'send-log'), ('请截图', 'screenshot'), ('看文档', 'read-docs'), ('看群公告', 'group-notice'))]
    extra += [dict(id=f'tornado-{k}', slug=f'tornado-{i}', series='水龙卷', text=t, category='special', category_zh='特别篇', motion='tornado', gif=f'out/水龙卷_{k}.gif')
              for i, (k, t) in enumerate((('无字', ''), ('我没事', '我没事'), ('转晕了', '转晕了')), 1)]
    data = dict(version=1, size=[400, 400], fps=15, count=len(items), categories=CAT, stickers=items, specials=extra)
    with open(os.path.join(ROOT, 'out', 'stickers.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(len(items), 'stickers ->', 'out/stickers.json')

if __name__ == '__main__':
    main()
