"""把水龙卷要用的几张原版 Minecraft 材质从你自己电脑上的客户端 jar 里取出来，放到 kit/mc/。
Mojang 的材质不能随仓库分发，所以仓库里不带这些图片。
用法：python engine/fetch_mc.py [客户端.jar]      不写路径就在常见启动器目录里找最新的版本
"""
import os, sys, glob, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join(ROOT, 'kit', 'mc')
WANT = ['entity/equipment/humanoid/iron.png', 'entity/equipment/humanoid/turtle_scute.png',
        'item/axolotl_bucket.png', 'item/tropical_fish.png', 'item/diamond_pickaxe.png', 'item/cod.png',
        'item/heart_of_the_sea.png', 'item/nautilus_shell.png',
        'block/tnt_side.png', 'block/tnt_top.png', 'block/tnt_bottom.png', 'block/lily_pad.png']

def candidates():
    homes = [os.path.join(os.environ.get('APPDATA', ''), '.minecraft'), os.path.expanduser('~/.minecraft'),
             os.path.expanduser('~/Library/Application Support/minecraft')]
    homes += glob.glob('E:/*/.minecraft') + glob.glob('D:/*/.minecraft')
    jars = []
    for h in homes:
        for j in glob.glob(os.path.join(h, 'versions', '*', '*.jar')):
            try:
                with zipfile.ZipFile(j) as z:
                    if 'assets/minecraft/textures/' + WANT[0] in z.namelist(): jars.append(j)
            except zipfile.BadZipFile:
                pass
    return sorted(jars, key=os.path.getmtime, reverse=True)

def main():
    jar = sys.argv[1] if len(sys.argv) > 1 else next(iter(candidates()), None)
    if not jar:
        sys.exit('没找到 1.21.2+ 的原版客户端 jar（需要 entity/equipment 目录的新版材质）。请把 jar 路径作为参数传进来。')
    os.makedirs(DEST, exist_ok=True)
    with zipfile.ZipFile(jar) as z:
        names = set(z.namelist())
        for w in WANT:
            n = 'assets/minecraft/textures/' + w
            if n not in names: sys.exit(f'{jar} 里没有 {w}')
            with open(os.path.join(DEST, w.split('/')[-1]), 'wb') as f: f.write(z.read(n))
    print(f'从 {jar} 取出 {len(WANT)} 张材质 -> {DEST}')

if __name__ == '__main__':
    main()
