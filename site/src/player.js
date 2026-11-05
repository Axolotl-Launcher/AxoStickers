// 逐帧播放器：大图弹窗里用。拆开 GIF，能暂停、逐帧、拖进度、调速度、看每一帧缩略图、存单帧 PNG。
import { decodeGif } from './gifdecode.js';
import { el, dragOut } from './util.js';

const SPEEDS = [0.25, 0.5, 1, 2];
const makeCanvas = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));

export class FramePlayer {
  constructor(root) {
    this.root = root;
    this.canvas = el('canvas', { class: 'player-canvas', width: 400, height: 400, 'aria-label': '动图' });
    this.ctx = this.canvas.getContext('2d');
    this.still = el('img', { class: 'player-still', alt: '' });
    // 盖在画布上的透明 GIF：画布拖不出去，拖它才是原图（拖进 QQ 是动图）；手机上长按它也能存 GIF
    this.grab = el('img', { class: 'player-grab', alt: '' });
    this.grab.addEventListener('dragstart', (e) => dragOut(e, this.grab.src, this.name));
    this.playBtn = el('button', { class: 'pbtn', type: 'button', 'aria-label': '暂停', title: '播放 / 暂停（空格）', onclick: () => this.toggle() }, '❚❚');
    this.prevBtn = el('button', { class: 'pbtn', type: 'button', 'aria-label': '上一帧', title: '上一帧（←）', onclick: () => this.step(-1) }, '◀');
    this.nextBtn = el('button', { class: 'pbtn', type: 'button', 'aria-label': '下一帧', title: '下一帧（→）', onclick: () => this.step(1) }, '▶');
    this.scrub = el('input', { class: 'scrub', type: 'range', min: 0, max: 47, value: 0, 'aria-label': '帧' });
    this.scrub.addEventListener('input', () => { this.pause(); this.show(+this.scrub.value); });
    this.counter = el('span', { class: 'pcount', text: '— / —' });
    this.speedBtn = el('button', { class: 'pbtn wide', type: 'button', title: '播放速度', onclick: () => this.cycleSpeed() }, '1×');
    this.saveBtn = el('button', { class: 'pbtn wide', type: 'button', title: '把这一帧存成 PNG', onclick: () => this.saveFrame() }, '存这帧');
    this.strip = el('div', { class: 'filmstrip', role: 'listbox', 'aria-label': '所有帧' });
    root.replaceChildren(
      el('div', { class: 'player-stage' }, this.still, this.canvas, this.grab),
      el('div', { class: 'player-bar' }, this.playBtn, this.prevBtn, this.nextBtn, this.scrub, this.counter, this.speedBtn, this.saveBtn),
      this.strip);
    this.frames = []; this.i = 0; this.playing = true; this.speed = 1; this.token = 0; this.name = 'frame';
    this.tick = this.tick.bind(this);
  }

  async load(url, still, name) {
    this.stop(); const tok = ++this.token;
    this.frames = []; this.name = name || 'frame';
    this.still.src = still || ''; this.still.hidden = false; this.canvas.hidden = true;
    this.grab.removeAttribute('src');
    this.strip.replaceChildren(); this.counter.textContent = '拆帧中…';
    try {
      const buf = await (await fetch(url)).arrayBuffer();
      if (tok !== this.token) return;
      this.grab.src = url;                                    // 刚下完，从缓存里拿
      const g = decodeGif(buf);
      this.canvas.width = g.width; this.canvas.height = g.height;
      this.frames = g.frames.map((f) => ({ img: new ImageData(f.data, g.width, g.height), delay: f.delay }));
      this.scrub.max = this.frames.length - 1;
      this.truncated = g.truncated;                           // 太大的 GIF 只拆前面的帧（内存有上限）
      this.buildStrip(g.width, g.height);
      this.still.hidden = true; this.canvas.hidden = false;
      this.i = 0; this.show(0);
      if (this.playing) this.play();
    } catch (e) {
      if (tok === this.token) { this.still.src = this.grab.src = url; this.counter.textContent = '只能直接看'; }
    }
  }

  buildStrip(w, h) {
    const tw = 64, th = Math.round(64 * h / w);
    const tmp = makeCanvas(w, h), tg = tmp.getContext('2d');
    this.thumbs = this.frames.map((f, k) => {
      const c = el('canvas', { class: 'frame', width: tw, height: th, role: 'option', title: `第 ${k + 1} 帧 · ${f.delay} ms`, 'data-i': k });
      tg.putImageData(f.img, 0, 0);
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(tmp, 0, 0, tw, th);
      c.addEventListener('click', () => { this.pause(); this.show(k); });
      return c;
    });
    this.strip.replaceChildren(...this.thumbs);
  }

  show(k) {
    if (!this.frames.length) return;
    this.i = (k + this.frames.length) % this.frames.length;
    this.ctx.putImageData(this.frames[this.i].img, 0, 0);
    this.scrub.value = this.i;
    this.counter.textContent = `${this.i + 1} / ${this.frames.length}${this.truncated ? '（太大，只拆了前面这些）' : ''} · ${this.frames[this.i].delay}ms`;
    if (this.thumbs) {
      this.thumbs.forEach((t, j) => t.setAttribute('aria-selected', String(j === this.i)));
      const t = this.thumbs[this.i], s = this.strip;
      if (!this.playing || t.offsetLeft < s.scrollLeft || t.offsetLeft + t.offsetWidth > s.scrollLeft + s.clientWidth) {
        s.scrollTo({ left: t.offsetLeft - s.clientWidth / 2 + t.offsetWidth / 2, behavior: this.playing ? 'auto' : 'smooth' });
      }
    }
  }

  tick(now) {
    if (!this.playing || !this.frames.length) return;
    this.raf = requestAnimationFrame(this.tick);
    if (now - this.last >= this.frames[this.i].delay / this.speed) { this.last = now; this.show(this.i + 1); }
  }
  play() {
    this.playing = true; this.playBtn.textContent = '❚❚'; this.playBtn.setAttribute('aria-label', '暂停');
    cancelAnimationFrame(this.raf); this.last = performance.now(); this.raf = requestAnimationFrame(this.tick);
  }
  pause() { this.playing = false; this.playBtn.textContent = '▶'; this.playBtn.setAttribute('aria-label', '播放'); cancelAnimationFrame(this.raf); }
  stop() { this.token++; cancelAnimationFrame(this.raf); }    // 也作废正在下载 / 拆帧的那次 load：弹窗关了就别再开始播
  toggle() { if (this.playing) this.pause(); else this.play(); }
  step(d) { this.pause(); this.show(this.i + d); }
  cycleSpeed() {
    this.speed = SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length];
    this.speedBtn.textContent = `${this.speed}×`;
  }
  saveFrame() {
    if (!this.frames.length) return;
    this.canvas.toBlob((blob) => {
      const a = el('a', { href: URL.createObjectURL(blob), download: `${this.name}_第${this.i + 1}帧.png` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    }, 'image/png');
  }
  key(e) {                                           // 弹窗把按键转过来；处理了返回 true
    if (e.key === ' ' || e.key === 'k') { this.toggle(); return true; }
    if (!e.shiftKey && e.key === 'ArrowLeft') { this.step(-1); return true; }
    if (!e.shiftKey && e.key === 'ArrowRight') { this.step(1); return true; }
    if (e.key === 'Home') { this.pause(); this.show(0); return true; }
    if (e.key === 'End') { this.pause(); this.show(this.frames.length - 1); return true; }
    return false;
  }
}
