"""开发用：用 Python 引擎渲几帧参考图，给 dev.html 对照网页预览：python site/tools/ref_frames.py [id,id,...]
输出 site/.ref/（不进 git，开发服务器在 /_ref/ 下提供）。"""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'engine'))
import axl, motions, specs  # noqa: E402

def main():
    ids = [int(x) for x in sys.argv[1].split(',')] if len(sys.argv) > 1 else [1, 17, 21, 37, 92, 100, 140, 196]
    out = os.path.join(ROOT, 'site', '.ref')
    os.makedirs(out, exist_ok=True)
    S = {s['id']: s for s in specs.all_specs()}
    index = []
    for i in ids:
        spec = {k: v for k, v in S[i].items() if k != 'id'}
        stk = motions.make(spec)
        frames = [0, 12, 24, 36]
        for fi in frames:
            stk.frame(fi).save(os.path.join(out, f'{i}_{fi}.png'))
        index.append(dict(name=str(i), spec=spec, frames=frames))
        print(i, spec['text'])
    json.dump(index, open(os.path.join(out, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False)

if __name__ == '__main__':
    main()
