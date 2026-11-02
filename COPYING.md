# Copying

The code in this repository (`engine/`, `kit/src/`) is licensed under the GNU General Public License, Version 3 only, provided in [LICENSE](./LICENSE). The sticker GIFs and cover images in `out/` are released under the same license.

The axolotl model in `kit/model/` comes from the [Axolotl Launcher](https://github.com/Axolotl-Launcher/Axolotl) repository and is licensed under GPL-3.0-only. Axolotl Launcher brand assets are Copyright © 2026 Garbage Human Studio.

`kit/fonts/NotoSansSC.ttf` is Noto Sans SC (Source Han Sans), Copyright Google LLC / Adobe, licensed under the [SIL Open Font License 1.1](https://openfontlicense.org).

The website in `site/` and the workshop tooling in `workshop/` are GPL-3.0-only as well. The built site bundles [three.js](https://threejs.org) and [gifenc](https://github.com/mattdesl/gifenc) (both MIT) and web-font slices cut from Noto Sans SC (OFL 1.1). Workshop submissions in `workshop/` are rendered from recipes their authors published under GPL-3.0-only through the issue form; the author of each one is recorded in `workshop/index.json`.

## Minecraft

No Minecraft game files are included. The water-tornado stickers render a few vanilla item and armour textures in 3D; `engine/fetch_mc.py` copies those textures from a Minecraft client that you already own into the git-ignored `kit/mc/` folder. The rendered tornado GIFs depict Mojang's Minecraft content.

Minecraft is a trademark of Mojang Synergies AB. This project is not affiliated with or endorsed by Mojang or Microsoft.
