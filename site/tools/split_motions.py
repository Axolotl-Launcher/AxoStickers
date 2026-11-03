"""一次性迁移：把 site/src/engine/motions.js 里的 75 个动作拆成组件文件 site/src/components/motion/<id>.axo.js。
组件文件是普通脚本：调用 component({...})，辅助函数（addrot、bump、easeIO…）直接可用，this 是这一层的上下文。"""
import os, re, json

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
SRC = open(os.path.join(SITE, 'src', 'engine', 'motions.js'), encoding='utf-8').read()
CAT = json.load(open(os.path.join(SITE, '..', 'workshop', 'catalog.json'), encoding='utf-8'))
OUT = os.path.join(SITE, 'src', 'components', 'motion')

# 参数：引擎原来从 spec 里读的那几个
PARAMS = {
    'nod': {'n': ('点几下', 'int', 1, 8, 3)}, 'hop': {'n': ('蹦几下', 'int', 1, 6, 2)},
    'spin': {'n': ('转几圈', 'int', 1, 4, 1), 'dir': ('方向', 'select', [[1, '顺时针'], [-1, '逆时针']], None, 1)},
    'bow': {'n': ('鞠几次', 'int', 1, 6, 2)}, 'jump': {'flip': ('空翻', 'bool', None, None, 0)},
    'swing': {'n': ('挥几下', 'int', 1, 8, 3), 'debris': ('碎石', 'bool', None, None, 0)},
    'flagwave': {'n': ('挥几下', 'int', 1, 8, 4), 's': ('道具大小', 'number', 0.3, 1.5, 0.7)},
    'offer': {'s': ('道具大小', 'number', 0.3, 2, 1)}, 'chomp': {'s': ('道具大小', 'number', 0.3, 2, 1)},
    'read': {'s': ('道具大小', 'number', 0.3, 2, 1)}, 'glitch': {'seed': ('随机种子', 'int', 0, 999, 0)},
}
REPL = [
    (r"this\.spec\.n \|\| \d+", "this.p.n"), (r"this\.spec\.dir \|\| 1", "this.p.dir"), (r"this\.spec\.flip \|\| 0", "this.p.flip"),
    (r"this\.spec\.s \?\? [\d.]+", "this.p.s"), (r"this\.spec\.debris", "this.p.debris"), (r"\(this\.spec\.seed \|\| 0\)", "this.p.seed"),
    (r"this\.rippleDx =", "this.stage.rippleDx ="), (r"this\.rippleOn =", "this.stage.rippleOn ="),
    (r"\bsprS\(", "propScale("), (r"\bE\.spr\[", "SPRITES["), (r"\bK\.SPR_S\b", "SPR_S"),
]

def match_brace(s, i):
    depth = 0
    for j in range(i, len(s)):
        if s[j] == '{': depth += 1
        elif s[j] == '}':
            depth -= 1
            if depth == 0: return j
    raise ValueError('unbalanced')

def classes():
    out = {}
    for m in re.finditer(r'class (\w+) extends (\w+) \{', SRC):
        a = m.end() - 1; b = match_brace(SRC, a)
        out[m.group(1)] = (m.group(2), SRC[a + 1:b])
    return out

def methods(body):
    res, i = [], 0
    while i < len(body):
        m = re.compile(r'\s*((?:get )?\w+)\(([^)]*)\) \{').match(body, i)
        if not m:
            i += 1; continue
        a = m.end() - 1; b = match_brace(body, a)
        res.append((m.group(1), m.group(2), body[a + 1:b]))
        i = b + 1
    return res

def fmt_body(code):
    code = code.rstrip().lstrip('\n')
    lines = code.split('\n')
    if len(lines) == 1: return ' ' + lines[0].strip() + ' '
    ind = min((len(l) - len(l.lstrip()) for l in lines if l.strip()), default=0)
    return '\n' + '\n'.join('    ' + l[ind:] if l.strip() else '' for l in lines) + '\n  '

def param_js(p):
    rows = []
    for k, (label, typ, a, b, d) in p.items():
        if typ == 'select': rows.append(f"{k}: {{ label: '{label}', type: 'select', options: {json.dumps(a, ensure_ascii=False)}, default: {d} }}")
        elif typ == 'bool': rows.append(f"{k}: {{ label: '{label}', type: 'bool', default: {d} }}")
        else: rows.append(f"{k}: {{ label: '{label}', type: '{typ}', min: {a}, max: {b}, default: {d} }}")
    return '{\n    ' + ',\n    '.join(rows) + ',\n  }'

def main():
    reg = dict(re.findall(r"(\w+): (\w+)[,\n]", SRC[SRC.index('export const MOTIONS'):SRC.index('export function makeSticker')]))
    cls = classes()
    os.makedirs(OUT, exist_ok=True)
    n = 0
    for mid, cname in reg.items():
        base, body = cls[cname]
        zh = CAT['motions'][mid]['zh']
        head = [f"  id: '{mid}', type: 'motion', name: '{zh}',"]
        if base == 'Jump':                         # 空翻 = 跳水 + flip
            src = (f"// 内置动作「{zh}」：就是「跳水」打开了空翻。\ncomponent({{\n  id: '{mid}', type: 'motion', name: '{zh}', extends: 'jump',\n"
                   f"  params: {{ flip: {{ label: '空翻', type: 'bool', default: 1 }} }},\n}});\n")
            open(os.path.join(OUT, f'{mid}.axo.js'), 'w', encoding='utf-8', newline='\n').write(src); n += 1
            continue
        if base == 'Prop': head.append('  holdsItself: true,')
        parts = []
        for name, args, code in methods(body):
            for a, b in REPL: code = re.sub(a, b, code)
            if name.startswith('get '):
                v = re.search(r'return ([^;]+);', code).group(1).strip()
                head.append(f"  {name[4:]}: {v},"); continue
            parts.append(f"  {name}({args}) {{{fmt_body(code)}}},")
        if mid in PARAMS: head.append(f"  params: {param_js(PARAMS[mid])},")
        left = re.findall(r'this\.spec\.(\w+)', '\n'.join(parts))
        assert set(left) <= {'hold', 'face'}, (mid, left)
        doc = f"// 内置动作「{zh}」。改了马上能在预览里看到；想留着就「另存为组件」。\n"
        src = doc + 'component({\n' + '\n'.join(head + parts) + '\n});\n'
        open(os.path.join(OUT, f'{mid}.axo.js'), 'w', encoding='utf-8', newline='\n').write(src); n += 1
    print(n, 'motion components ->', OUT)

if __name__ == '__main__':
    main()
