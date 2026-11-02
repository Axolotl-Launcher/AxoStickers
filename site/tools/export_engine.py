"""把引擎里的模型、表情、道具、图标、配色导出成 JSON，给网页里的 three.js 预览用：python site/tools/export_engine.py
网页和引擎用的是同一份体素面片和数据，所以预览和真出图长得一样。输出 site/src/gen/engine.json（不进 git，构建时生成）。"""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'engine'))
import axl, motions, items, face_cam, rig, rig2  # noqa: E402

def hexc(c): return '%02x%02x%02x' % tuple(int(v) for v in c[:3])
def r6(v): return round(float(v), 6)
def cells(lst): return [[c, r, hexc(col)] for c, r, col in lst]

def mesh(i):
    P, C, N = [], [], []
    for q, col, n in rig2.MESH_Q[i]:
        P += [r6(v) for v in q.reshape(-1)]
        C.append(hexc(col))
        N += [r6(v) for v in n]
    return dict(p=P, c=C, n=N)

def main():
    const = dict(W=axl.W, H=axl.H, FPS=axl.FPS, T=axl.Sticker.T, YAW=axl.YAW, PITCH=axl.PITCH, PERSP=rig2.PERSP,
                 REF=axl.REF, BOX=axl.BOX, BOX_CX=axl.BOX_CX, BOX_CY=axl.BOX_CY, WATER_Y=axl.WATER_Y,
                 CEN=[r6(v) for v in axl.CEN], SCL=r6(axl.SCL), SCL_BOX=r6(axl.SCL_BOX),
                 ANCHOR=[r6(v) for v in axl.ANCHOR], ANCHOR_OFF=[r6(v) for v in axl.ANCHOR_OFF],
                 FACE_Z=r6(face_cam.FACE_Z), SPR_S=motions.SPR_S)
    nodes = [dict(name=n['name'], t=n.get('translation', [0, 0, 0]), q=n.get('rotation'), children=n.get('children', []),
                  mesh='mesh' in n) for n in rig.NODES]
    blush = [[c, r, hexc(face_cam.BLUSH)] for c in (12, 13, 14) for r in (1, 2)] + \
            [[c, r, hexc(face_cam.BLUSH)] for c in (1, 2, 3) for r in (1, 2)]
    data = dict(
        const=const, nodes=nodes, parent={str(k): v for k, v in rig.PARENT.items()}, roots=rig.ROOTS, bones=rig.BONES,
        headChild=sorted(rig.HEAD_CHILD), headMesh=face_cam.HEAD_MESH, rest=axl.REST,
        mesh={str(i): mesh(i) for i in rig2.MESH_Q}, meshName={str(i): rig.NODES[i]['name'] for i in rig2.MESH_Q},
        eyes={k: cells(v) for k, v in face_cam.EYES.items()}, mouths={k: cells(v) for k, v in face_cam.MOUTHS.items()},
        faces=motions.FACES, blush=blush,
        spr={k: [rows, pal] for k, (rows, pal) in items.SPR.items()},
        blk={k: [list(b) for b in v] for k, v in items.BLK.items()},
        gear={k: [list(b) for b in v] for k, v in items.GEAR.items()},
        icon={k: [rows, pal] for k, (rows, pal) in axl.ICON.items()},
        styles={k: [hexc(c) for c in v] for k, v in axl.STYLES.items()},
    )
    out = os.path.join(ROOT, 'site', 'src', 'gen', 'engine.json')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print('engine.json', round(os.path.getsize(out) / 1024), 'KB,', sum(len(q) for q in rig2.MESH_Q.values()), 'quads')

if __name__ == '__main__':
    main()
