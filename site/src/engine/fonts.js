// 文字图层能用的字体（编辑器的字体选择和引擎共用，这个文件不依赖别的模块）。
// axo 是内置的 Axo 黑体：默认，工坊出图只认它。系统字体用这台设备上装的，每台设备长得不一样；
// 导入的字体文件（.ttf / .otf / .woff / .woff2）由 draw.js 的 registerFont 另外注册，id 是 font:文件名。
export const FONT_LIST = [
  { id: 'axo', name: 'Axo 黑体', css: 'AxoSans', desc: '内置 · 能发布到工坊' },
  { id: 'sys-sans', name: '系统黑体', css: '"Microsoft YaHei","PingFang SC","Noto Sans CJK SC","Source Han Sans SC",sans-serif', desc: '用这台设备装的字体，别的设备上可能不一样' },
  { id: 'sys-serif', name: '系统宋体', css: '"SimSun","Songti SC","Noto Serif CJK SC","Source Han Serif SC",serif', desc: '用这台设备装的字体，别的设备上可能不一样' },
  { id: 'sys-kai', name: '系统楷体', css: '"KaiTi","STKaiti","Kaiti SC","AR PL UKai CN",serif', desc: '用这台设备装的字体，别的设备上可能不一样' },
  { id: 'sys-round', name: '系统圆体', css: '"YouYuan","Yuanti SC","Arial Rounded MT Bold",sans-serif', desc: '用这台设备装的字体，别的设备上可能不一样' },
];
