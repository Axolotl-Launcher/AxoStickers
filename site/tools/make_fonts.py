"""把 kit/fonts/NotoSansSC.ttf（可变字体，引擎用的就是它的 Black）切成网页字体：python site/tools/make_fonts.py
只取 Black(900) 一个字重，按 Unicode 区段切片成 woff2，浏览器只下载用到的那几片。
输出 site/src/gen/fonts/*.woff2 和 site/src/gen/fonts.css（都不进 git，构建时生成，CI 里有缓存）。"""
import os, io, time, shutil
from concurrent.futures import ProcessPoolExecutor
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(ROOT, 'kit', 'fonts', 'NotoSansSC.ttf')
OUT = os.path.join(ROOT, 'site', 'src', 'gen', 'fonts')
CSS = os.path.join(ROOT, 'site', 'src', 'gen', 'fonts.css')
FAMILY = 'AxoSans'

def ranges(cmap):
    """[(name, [(lo, hi), ...])]: Latin + punctuation first, then CJK in 256-codepoint blocks."""
    head = [(0x20, 0x7e), (0xa0, 0xff), (0x2010, 0x206f), (0x3000, 0x303f), (0xff00, 0xffef)]
    out = [('base', head), ('misc', [(0x100, 0x200f), (0x2070, 0x2fff), (0x3040, 0x33ff), (0xfe10, 0xfe6f)])]
    for lo in range(0x3400, 0xa000, 0x100):
        out.append(('u%04x' % lo, [(lo, lo + 0xff)]))
    out.append(('rest', [(0xa000, 0xfe0f), (0x10000, 0x10ffff)]))
    has = set(cmap)
    return [(n, r) for n, r in out if any(lo <= c <= hi for c in has for lo, hi in r)]

def cut(job):
    name, rs, blob = job
    f = TTFont(io.BytesIO(blob))
    cps = [c for c in f.getBestCmap() if any(lo <= c <= hi for lo, hi in rs)]
    opt = subset.Options(); opt.flavor = 'woff2'; opt.layout_features = ['*']; opt.name_IDs = ['*']; opt.notdef_outline = True
    s = subset.Subsetter(opt); s.populate(unicodes=cps); s.subset(f)
    path = os.path.join(OUT, f'{name}.woff2')
    f.flavor = 'woff2'; f.save(path)
    return name, cps, len(cps), os.path.getsize(path)

def runs(cps):
    """[0x41, 0x42, 0x43, 0x50] -> 'U+0041-0043, U+0050'：unicode-range 写这一片里真有的字（不是整个区段），
    编辑器据此知道哪些字 Axo 黑体里根本没有（比如 emoji），画出来会是系统字体，导出时拦下。"""
    out, cps = [], sorted(cps)
    for c in cps:
        if out and c == out[-1][1] + 1: out[-1][1] = c
        else: out.append([c, c])
    return ', '.join('U+%04X' % lo if lo == hi else 'U+%04X-%04X' % (lo, hi) for lo, hi in out)

def main():
    t0 = time.time()
    f = TTFont(SRC)
    if 'fvar' in f:
        f = instancer.instantiateVariableFont(f, {'wght': 900})
    buf = io.BytesIO(); f.save(buf); blob = buf.getvalue()
    print('instanced Black in', round(time.time() - t0), 's')
    shutil.rmtree(OUT, ignore_errors=True)
    os.makedirs(OUT, exist_ok=True); os.makedirs(os.path.dirname(CSS), exist_ok=True)
    jobs = [(n, r, blob) for n, r in ranges(f.getBestCmap())]
    with ProcessPoolExecutor(min(6, os.cpu_count() or 2)) as ex:
        res = list(ex.map(cut, jobs))
    css = []
    for name, cps, n, size in res:
        ur = runs(cps)
        css.append(f"@font-face {{ font-family: '{FAMILY}'; font-weight: 900; font-display: swap; "
                   f"src: url('./fonts/{name}.woff2') format('woff2'); unicode-range: {ur}; }}")
    open(CSS, 'w', encoding='utf-8').write('\n'.join(css) + '\n')
    total = sum(r[3] for r in res)
    print(len(res), 'slices,', round(total / 1024 / 1024, 1), 'MB total, in', round(time.time() - t0), 's')

if __name__ == '__main__':
    main()
