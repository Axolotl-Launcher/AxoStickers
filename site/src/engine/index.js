// 网页版引擎的入口（按需加载：three.js + 模型数据只在用到预览时才下载）。
import { AxoRenderer, W, FPS } from './core.js';

export { W, FPS };
export { makeSticker, MOTIONS } from './motions.js';
export { loadFont, charSprite } from './draw.js';
export { exportGif } from './gif.js';

let R = null;
export function renderer() { return (R ||= new AxoRenderer(2)); }
