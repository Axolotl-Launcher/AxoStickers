// 沙盒的遥控器：主页面从不执行组件代码，全部交给 sandbox.html（<iframe sandbox="allow-scripts">，不透明来源）。
// 消息：主页面 → 沙盒 components / project / transport / export / filmstrip / source / remove / ping；
//       沙盒 → 主页面 ready / catalog / scene / errors / time / progress / exported / export-error / *-done（带 req 的回复）/ pong / fatal。
// 回复的类型名故意和请求不一样：沙盒单独当顶层页面打开时（CI 出图），消息会发给自己。
export class Runner {
  constructor(mount, { sandboxed = true, src = 'sandbox.html' } = {}) {
    this.mount = mount; this.sandboxed = sandboxed; this.src = src;
    this.handlers = new Map(); this.pending = new Map(); this.req = 0;
    this.queue = []; this.ready = false;
    window.addEventListener('message', (e) => this.onMessage(e));
    this.start();
  }

  start() {
    this.frame?.remove();
    this.ready = false;
    // 旧沙盒没回完的请求（导出、缩略图…）不会再有回音了：直接算失败，别让调用的地方一直等；排队的消息也作废（ready 后会重发工程）
    for (const p of this.pending.values()) p.reject(new Error('预览重开了，再试一次'));
    this.pending.clear(); this.queue = [];
    const f = this.frame = document.createElement('iframe');
    if (this.sandboxed) f.setAttribute('sandbox', 'allow-scripts');     // 不给 allow-same-origin：碰不到本站的存储和页面
    f.src = this.src;
    f.title = '预览';
    f.tabIndex = -1;                                                     // 预览里没有能操作的东西：别让焦点跑进去（不然空格、方向键这些快捷键就失灵了）
    f.className = 'stage-iframe';
    f.setAttribute('allow', '');
    let loads = 0;                                                       // 组件代码让预览框跳走了（本站 CSP 的 frame-src 会拦住别的网站）：重开
    f.addEventListener('load', () => { if (this.frame === f) this.frameLoaded = true; if (++loads > 1 && this.frame === f) { this.emit('fatal', { message: '组件想让预览跳到别的网页，已经拦下并重开' }); this.start(); } });
    this.mount.append(f);
    this.booting = false; this.frameLoaded = false;
    this.armBoot(12000);
  }
  // 启动看门狗：页面 12 秒内没报到 = 页面本身没打开；报到了（sandbox-boot.js）就多等一会儿脚本，开发时第一次编译可能很慢
  armBoot(ms, reason = null) {
    clearTimeout(this.bootTimer);
    this.bootTimer = setTimeout(() => {
      if (this.ready) return;
      this.emit('boot-failed', { reason: reason || (this.frameLoaded ? '沙盒页面打开了，但里面的脚本没能运行（多半是被拦下了）' : '沙盒页面没打开（可能被浏览器扩展或安全设置拦下了）') });
    }, ms);
  }

  onMessage(e) {
    if (!this.frame || e.source !== this.frame.contentWindow) return;   // 只认自己的沙盒
    const m = e.data;
    if (!m || typeof m.type !== 'string') return;
    this.lastPong = performance.now(); this.unanswered = 0;            // 沙盒发来的任何消息（导出进度、播放时间…）都说明它还活着
    if (m.type === 'booting') { this.booting = true; this.armBoot(60000, '沙盒的脚本一直没加载完'); return; }
    if (m.type === 'boot-error') { if (!this.ready) { clearTimeout(this.bootTimer); this.emit('boot-failed', { reason: m.message }); } return; }
    if (m.type === 'ready') {
      this.ready = true; clearTimeout(this.bootTimer);
      for (const q of this.queue.splice(0)) this.post(q.msg, q.transfer);
    }
    if (m.req !== undefined && this.pending.has(m.req)) {
      const p = this.pending.get(m.req);
      if (m.type === 'progress') { p.progress?.(m.p); return; }
      this.pending.delete(m.req);
      if (m.type === 'export-error') p.reject(new Error(m.message)); else p.resolve(m);
      return;
    }
    if (m.type === 'pong') this.lastPong = performance.now();
    this.emit(m.type, m);
  }

  post(msg, transfer) {
    if (!this.ready && msg.type !== 'ping') { this.queue.push({ msg, transfer }); return; }
    this.frame?.contentWindow?.postMessage(msg, '*', transfer || []);
  }
  request(msg, progress) {
    const req = ++this.req;
    return new Promise((resolve, reject) => { this.pending.set(req, { resolve, reject, progress }); this.post({ ...msg, req }); });
  }

  on(type, f) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(f); return () => this.handlers.get(type).delete(f); }
  emit(type, m) { for (const f of this.handlers.get(type) || []) f(m); }

  // 看门狗：沙盒卡死（组件里有什么奇怪的东西绕过了循环保险）就整个重开。
  // 只算页面看得见的时候发出去、连着 3 次都没回音的 ping：标签页切到后台时定时器会被浏览器压住，回来时不能当成卡死
  watch(onHang) {
    clearInterval(this.dog);
    this.lastPong = performance.now(); this.unanswered = 0;
    if (!this.visHook) { this.visHook = true; document.addEventListener('visibilitychange', () => { this.lastPong = performance.now(); this.unanswered = 0; }); }
    this.dog = setInterval(() => {
      if (document.hidden || !this.ready) { this.lastPong = performance.now(); this.unanswered = 0; return; }
      if (this.unanswered >= 3 && performance.now() - this.lastPong > 6000) { this.lastPong = performance.now(); this.unanswered = 0; onHang(); return; }
      this.unanswered++;
      this.post({ type: 'ping', n: Date.now() });
    }, 2000);
  }
}
