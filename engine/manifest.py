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
    extra = [dict(id=f'tornado-{k}', text=t, category='special', category_zh='特别篇', motion='tornado', gif=f'out/水龙卷_{k}.gif')
             for k, t in (('无字', ''), ('我没事', '我没事'), ('转晕了', '转晕了'))]
    data = dict(version=1, size=[400, 400], fps=15, count=len(items), categories=CAT, stickers=items, specials=extra)
    with open(os.path.join(ROOT, 'out', 'stickers.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(len(items), 'stickers ->', 'out/stickers.json')

if __name__ == '__main__':
    main()
