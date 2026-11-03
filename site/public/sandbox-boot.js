// 沙盒先报个到（普通脚本，比模块先跑）：主页面据此知道沙盒页面本身打开了、只是脚本还在加载（开发时第一次编译可能要好一会儿），
// 脚本被拦 / 加载失败时马上说是哪个文件，不用干等到超时。
(function () {
  if (window.parent === window) return;
  var up = function (m) { try { window.parent.postMessage(m, '*'); } catch (e) { /* 发不出去就算了 */ } };
  up({ type: 'booting' });
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'SCRIPT') up({ type: 'boot-error', message: '脚本没加载出来：' + String(t.src || '').replace(/^.*\//, '').split('?')[0] });
    else if (e instanceof ErrorEvent && !window.__axoReady) up({ type: 'boot-error', message: String((e.error && e.error.message) || e.message || '启动时出错') });
    // 别的资源（字体样式、图片）没加载上不算启动失败：预览照样能跑，只是字体退回系统字体
  }, true);
})();
