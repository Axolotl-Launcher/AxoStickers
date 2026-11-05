// 内置道具「日志纸」：初代「发日志」里举着的那页（kit 工具包 face_cam.py 的体素日志纸）。最后一行红色的是报错。
// shape(k)：打到哪儿了（0 = 空白纸，1 = 四行都打完），cursor 画打字光标。动作「折纸飞机发出去」用它一行行打字
const PAGE = [[-3, -4.2, -0.4, 3, 4.2, 0.4, 'f7f8fc'], [1.6, 2.8, -0.5, 3, 4.2, -0.4, 'd9dee8'], [-2.3, 2.6, -0.5, 0.8, 3.5, -0.4, 'fe3e8c']];   // 纸、折角、粉色标题栏
const LINES = [[4.6, 1.0], [3.4, -0.4], [4.2, -1.8], [4.6, -3.2]];   // 每行 [宽, y]
function shape(k = 1, cursor = false) {
  const n = clamp(k) * LINES.length, out = PAGE.slice();
  LINES.forEach(([w, y], i) => {
    const f = clamp(n - i);
    if (f <= 0) return;
    out.push([-2.3, y, -0.5, -2.3 + max(0.3, w * f), y + 0.7, -0.4, i === LINES.length - 1 ? 'ff3b4e' : 'aab3c4']);
    if (f < 1 && cursor) { const x = -2.3 + w * f + 0.2; out.push([x, y - 0.1, -0.55, x + 0.35, y + 0.8, -0.4, 'fe3e8c']); }
  });
  return out;
}
component({ id: 'logpage', type: 'prop', name: '日志纸', boxes: shape(1), shape });
