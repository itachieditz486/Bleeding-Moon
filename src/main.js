// Bootstrap + fixed-timestep loop + app state machine (title / intro / play / pause / victory).
import { Input } from './core/input.js';
import { Save, DEFAULT_SETTINGS } from './core/save.js';
import { buildSprites } from './art/sprites.js';
import { buildTheme } from './art/backgrounds.js';
import { GameAudio } from './audio/gameAudio.js';
import { FX } from './game/fx.js';
import { PlayScene } from './game/game.js';
import { CHECKPOINT_IDS } from './game/levels.js';
import { UI } from './ui/menu.js';
import { Touch } from './ui/touch.js';
import { drawText } from './core/font.js';

const VH = 180, STEP = 1 / 60;

class App {
  constructor() {
    this.canvas = document.getElementById('game'); this.g = this.canvas.getContext('2d', { alpha: false }); this.g.imageSmoothingEnabled = false;
    this.settings = Save.loadSettings(); this.input = new Input(window); this.fx = new FX(); this.spr = buildSprites(); this.titleBg = buildTheme('approach');
    this.audio = new GameAudio('assets/audio/audio-manifest.json'); this.touch = new Touch(this.input); this.ui = new UI(this); this.scene = new PlayScene(this);
    this.mode = 'title'; this.viewW = 320; this.fps = 60; this.acc = 0; this.last = 0; this.now = 0; this.perf = { t: 0, n: 0, bad: 0 }; this.pendingNew = false;
    this.applySettings(); this.resize(); this.ui.go('title');  this.touch.setVisible(false);
    addEventListener('resize', () => this.resize()); addEventListener('orientationchange', () => setTimeout(() => this.resize(), 150));
    document.addEventListener('visibilitychange', () => this.onVisibility());
    const toGame = e => { const r = this.canvas.getBoundingClientRect(); return [(e.clientX - r.left) * this.viewW / r.width, (e.clientY - r.top) * VH / r.height]; };
    this.canvas.addEventListener('pointerdown', e => { e.preventDefault(); this.gesture(); const [x, y] = toGame(e); if (this.mode !== 'play') this.ui.pointer(x, y); });
    addEventListener('keydown', () => this.gesture());
    this.audio.init().then(() => { if (this.mode === 'title') this.audio.menuMusic(); });
    this.registerSW();
    requestAnimationFrame(t => this.frame(t));
  }
  get touchActive() { return this.touch.active; }
  gesture() { if (!this.gestured) { this.gestured = true; if (this.audio.ready) this.audio.menuMusic(); } }
  registerSW() { try { if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.Capacitor) navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* ignore */ } }

  /* ---- settings ---- */
  saveSettings() { Save.saveSettings(this.settings); }
  applySettings() {
    const s = this.settings; this.fx.shakeOn = !!s.shake;
    this.baseQuality = s.particles === 'low' ? 0.5 : s.particles === 'high' ? 1 : (this.autoQuality || 1); this.fx.quality = this.baseQuality;
    if (this.touch) this.touch.configure(s.touch, s.touchOpacity, s.touchSize);
  }
  resize() {
    const dpr = window.devicePixelRatio || 1, w = innerWidth, h = innerHeight;
    this.viewW = Math.max(320, Math.min(400, Math.round(w / h * VH)));
    const scale = Math.max(1, Math.floor(Math.min(w * dpr / this.viewW, h * dpr / VH)));
    this.canvas.width = this.viewW; this.canvas.height = VH; this.g.imageSmoothingEnabled = false;
    this.canvas.style.width = (this.viewW * scale / dpr) + 'px'; this.canvas.style.height = (VH * scale / dpr) + 'px';
    this.scale = scale;
  }
  onVisibility() {
    if (document.hidden) { if (this.mode === 'play') this.pause(); this.input.releaseAll(); try { this.audio.ctx && this.audio.ctx.suspend(); } catch (e) { /* ignore */ } }
    else { try { this.audio.ctx && this.audio.ctx.resume(); } catch (e) { /* ignore */ } this.last = 0; }
  }

  /* ---- state transitions ---- */
  newGame() { this.pendingNew = true; this.mode = 'intro'; this.ui.go('intro'); this.touch.setVisible(false); }
  startRun() { this.mode = 'play'; this.scene = new PlayScene(this); this.scene.newGame(); this.touch.setVisible(true); this.pendingNew = false; this.input.releaseAll(); }
  continueGame() {
    const s = Save.load(CHECKPOINT_IDS); if (!s) { this.ui.go('title'); return; }
    this.scene = new PlayScene(this); this.scene.continueFrom(s); this.mode = 'play'; this.touch.setVisible(true); this.input.releaseAll();
  }
  pause() { if (this.mode !== 'play') return; this.mode = 'pause'; this.saveProgress(); this.audio.pause(true); this.ui.stack = []; this.ui.go('pause'); this.touch.setVisible(false); this.input.releaseAll(); }
  resume() { if (this.mode !== 'pause') return; this.mode = 'play'; this.audio.pause(false); this.ui.stack = []; this.touch.setVisible(true); this.input.releaseAll(); this.last = 0; }
  restartCheckpoint() { if (this.mode !== 'pause') return; this.scene.restartCheckpoint(); this.resume(); }
  /** write the current run to the save slot (checkpoint position + defeated bosses + stats) */
  saveProgress() { const s = this.scene; if (s && s.stage && !s.ended && s.checkpoint) s.saveCheckpoint(s.checkpoint); }
  quitToTitle() { if (this.mode === 'play' || this.mode === 'pause') this.saveProgress(); this.audio.pause(false); this.audio.bossExit(0.5); this.audio.stopWind(); this.audio.unloadBoss(1500); this.fx.reset(); this.input.releaseAll(); this.mode = 'title'; this.ui.stack = []; this.ui.go('title'); this.touch.setVisible(false); this.audio.menuMusic(); }
  victory() { Save.clear(); this.mode = 'victory'; this.ui.stack = []; this.ui.go('victory'); this.touch.setVisible(false); this.audio.stopWind(); this.audio.victory(); }

  /* ---- loop ---- */
  tick(dt) {
    this.now += dt; this.input.update(this.now);
    if (this.mode === 'play') {
      if (this.input.pressed('pause')) { this.pause(); return; }
      const fx = this.fx;
      if (fx.stopT > 0) { fx.stopT -= dt; return; }
      this.scene.update(dt * fx.timeScale());
    } else this.ui.update(dt);
  }
  draw() {
    const g = this.g, W = this.viewW;
    g.fillStyle = '#07050d'; g.fillRect(0, 0, W, VH);
    if (this.mode === 'play' || this.mode === 'pause') this.scene.draw(g);
    if (this.mode !== 'play') this.ui.draw(g);
    if (!this.audio.ready && !this.audio.failed && this.mode === 'title') drawText(g, 'LOADING SOUND...', 6, 4, '#3a3558');
  }
  frame(t) {
    requestAnimationFrame(tt => this.frame(tt));
    if (!this.last) this.last = t; let d = (t - this.last) / 1000; this.last = t; if (d > 0.25) d = 0.25;
    this.acc += d; let n = 0; while (this.acc >= STEP && n < 5) { this.tick(STEP); this.acc -= STEP; n++; } if (n === 5) this.acc = 0;
    this.draw(); this.measure(d);
  }
  measure(d) {
    const p = this.perf; p.t += d; p.n++;
    if (p.t >= 2) {
      const fps = p.n / p.t; this.fps = Math.round(fps); p.t = 0; p.n = 0;
      if (this.mode === 'play' && this.settings.particles === 'auto') {
        if (fps < 40) p.bad++; else p.bad = Math.max(0, p.bad - 1);
        if (p.bad >= 2 && (this.autoQuality || 1) > 0.3) { this.autoQuality = Math.max(0.3, (this.autoQuality || 1) * 0.6); p.bad = 0; this.applySettings(); }
      }
    }
  }
}
window.__bm = { app: new App() };
