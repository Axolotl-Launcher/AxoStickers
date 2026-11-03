// 网页版引擎的入口（按需加载：three.js + 模型数据只在用到预览时才下载）。
import { AxoRenderer, W, FPS } from './core.js';

export { W, FPS };
export { Scene, normalizeProject, fromRecipe, DEFAULTS } from './scene.js';
export { builtinRegistry, ICONS, EYES, MOUTHS } from './builtin.js';
export { Registry, compile, TYPES, resolveParams, sourceFor, ComponentError } from './components.js';
export { loadFont, charSprite } from './draw.js';
export { exportGif, renderFrames } from './gif.js';

let R = null;
export function renderer(opts) { return (R ||= new AxoRenderer(opts?.ss ?? 2, opts)); }   // opts 只在第一次创建时有用（沙盒按设备档位传）
