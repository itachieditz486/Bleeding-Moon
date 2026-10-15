// All non-gameplay screens: title, intro, settings, controls, pause, overwrite confirmation, victory. Keyboard + pointer.
import { C } from '../art/palette.js';
import { drawText, textWidth } from '../core/font.js';
import { drawTheme, drawFog } from '../art/backgrounds.js';
import { Save } from '../core/save.js';
import { CHECKPOINT_IDS, CHECKPOINTS } from '../game/levels.js';

const INTRO = [
  ['THE MOON HAS BEGUN TO BLEED.', 'AND THE OLD CASTLE WAKES BENEATH IT.'],
  ['THREE GUARDIANS HOLD ITS GATES:', 'A KNIGHT HOLLOWED BY OATHS,', 'A WRAITH BORN OF THE ABYSS,', 'A SOVEREIGN WHO WOULD NOT FALL.'],
  ['YOU ARE THE LAST HOODED WANDERER.', 'NO ONE ELSE IS COMING.'],
  ['CROSS THE MOONLIT APPROACH.', 'END THE BLEEDING.'],
];
const fmtTime = s => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(r).padStart(2, '0'); };
const pct = v => Math.round(v * 100) + '%';

export class UI {
  constructor(app) {
    this.app = app; this.mode = 'title'; this.stack = []; this.sel = 0; this.t = 0; this.items = []; this.rects = []; this.introI = 0; this.introT = 0; this.confirmFor = null;
    this.fade = 0; this.msg = null;
  }
  get audio() { return this.app.audio; }
  get hasSave() { return !!Save.load(CHECKPOINT_IDS); }
  go(mode, push) { if (push) this.stack.push({ mode: this.mode, sel: this.sel }); this.mode = mode; this.sel = 0; this.t = 0; this.rects = []; if (mode === 'intro') { this.introI = 0; this.introT = 0; } this.items = this.build(); this.sel = this.firstSelectable(); }
  back() {
    const p = this.stack.pop(); this.audio.uiBack();
    if (!p) { if (this.mode === 'pause') this.app.resume(); else if (this.mode !== 'title') this.go('title'); return; }
    this.mode = p.mode; this.items = this.build(); this.sel = Math.min(p.sel, this.items.length - 1);
  }
  firstSelectable() { return Math.max(0, this.items.findIndex(i => !i.disabled)); }
  build() {
    const A = this.app, au = A.audio, set = A.settings;
    const slider = (label, get, set_) => ({ label, kind: 'slider', value: get, adjust: d => { set_(Math.min(1, Math.max(0, Math.round((get() + d * 0.1) * 10) / 10))); au.uiMove(); } });
    const cycle = (label, key, opts) => ({ label, kind: 'cycle', value: () => String(set[key]).toUpperCase(), adjust: d => { const i = opts.indexOf(set[key]); set[key] = opts[(i + d + opts.length) % opts.length]; A.saveSettings(); A.applySettings(); au.uiMove(); } });
    const steps = (label, key, opts) => ({ label, kind: 'cycle', value: () => Math.round(set[key] * 100) + '%', adjust: d => { let i = opts.findIndex(o => Math.abs(o - set[key]) < 0.01); if (i < 0) i = 2; set[key] = opts[(i + d + opts.length) % opts.length]; A.saveSettings(); A.applySettings(); au.uiMove(); } });
    switch (this.mode) {
      case 'title': return [
        { label: 'CONTINUE', disabled: !this.hasSave, act: () => A.continueGame() },
        { label: 'NEW GAME', act: () => { if (this.hasSave) this.go('confirm', true); else A.newGame(); } },
        { label: 'SETTINGS', act: () => this.go('settings', true) },
        { label: 'CONTROLS', act: () => this.go('controls', true) },
      ];
      case 'confirm': return [
        { label: 'NO, KEEP MY SAVE', act: () => this.back() },
        { label: 'YES, OVERWRITE', act: () => { Save.clear(); A.newGame(); } },
      ];
      case 'settings': return [
        slider('MASTER VOLUME', () => au.settings.master, v => au.am.setMasterVolume(v)),
        slider('MUSIC', () => au.settings.buses.music ?? 0.6, v => au.am.setBusVolume('music', v)),
        slider('AMBIENCE', () => au.settings.buses.ambience ?? 0.55, v => au.am.setBusVolume('ambience', v)),
        slider('SOUND EFFECTS', () => au.settings.buses.sfx ?? 0.9, v => au.am.setBusVolume('sfx', v)),
        { label: 'MUTE ALL', kind: 'cycle', value: () => au.settings.muted ? 'ON' : 'OFF', adjust: () => { au.am.toggleMute(); au.uiMove(); }, act: () => { au.am.toggleMute(); } },
        { label: 'TOUCH AND DISPLAY', act: () => this.go('settings2', true) },
        { label: 'BACK', act: () => this.back() },
      ];
      case 'settings2': return [
        cycle('TOUCH CONTROLS', 'touch', ['auto', 'on', 'off']),
        steps('CONTROL OPACITY', 'touchOpacity', [0.35, 0.5, 0.65, 0.8, 1]),
        steps('BUTTON SIZE', 'touchSize', [0.8, 0.9, 1, 1.15, 1.3]),
        cycle('PARTICLES', 'particles', ['auto', 'low', 'high']),
        { label: 'SCREEN SHAKE', kind: 'cycle', value: () => set.shake ? 'ON' : 'OFF', adjust: () => { set.shake = !set.shake; A.saveSettings(); A.applySettings(); au.uiMove(); }, act: () => { set.shake = !set.shake; A.saveSettings(); A.applySettings(); } },
        { label: 'SHOW FPS', kind: 'cycle', value: () => set.showFps ? 'ON' : 'OFF', adjust: () => { set.showFps = !set.showFps; A.saveSettings(); }, act: () => { set.showFps = !set.showFps; A.saveSettings(); } },
        { label: 'BACK', act: () => this.back() },
      ];
      case 'controls': return [{ label: 'BACK', act: () => this.back() }];
      case 'pause': return [
        { label: 'RESUME', act: () => A.resume() },
        { label: 'RESTART CHECKPOINT', act: () => A.restartCheckpoint() },
        { label: 'SETTINGS', act: () => this.go('settings', true) },
        { label: 'CONTROLS', act: () => this.go('controls', true) },
        { label: 'MAIN MENU', act: () => A.quitToTitle() },
      ];
      case 'victory': return [
        { label: 'PLAY AGAIN', act: () => { Save.clear(); A.newGame(); } },
        { label: 'TITLE SCREEN', act: () => A.quitToTitle() },
      ];
      default: return [];
    }
  }
  /* ---------- input ---------- */
  activate() { const it = this.items[this.sel]; if (!it || it.disabled) return; this.audio.uiConfirm(); if (it.act) it.act(); else if (it.adjust) it.adjust(1); }
  move(d) { if (!this.items.length) return; let n = this.sel; for (let k = 0; k < this.items.length; k++) { n = (n + d + this.items.length) % this.items.length; if (!this.items[n].disabled) break; } if (n !== this.sel) { this.sel = n; this.audio.uiMove(); } }
  pointer(x, y) {
    if (this.mode === 'intro') { this.skipIntro(); return true; }
    for (let i = 0; i < this.rects.length; i++) {
      const r = this.rects[i]; if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
        const it = this.items[i]; if (it.disabled) return true; this.sel = i;
        if (it.kind === 'slider' || (it.kind === 'cycle' && !it.act)) { it.adjust(x < r.x + r.w / 2 ? -1 : 1); this.audio.uiMove(); } else this.activate();
        return true;
      }
    }
    return false;
  }
  skipIntro() { this.audio.uiConfirm(); this.app.startRun(); }
  update(dt) {
    this.t += dt; const I = this.app.input;
    if (this.mode === 'intro') {
      this.introT += dt;
      if (I.pressed('confirm') || I.pressed('attack') || I.pressed('pause')) { this.skipIntro(); return; }
      if (this.introT > 5.2) { this.introT = 0; this.introI++; if (this.introI >= INTRO.length) this.app.startRun(); }
      return;
    }
    if (I.pressed('down')) this.move(1);
    if (I.pressed('up')) this.move(-1);
    const it = this.items[this.sel];
    if (it && (it.kind === 'slider' || it.kind === 'cycle')) { if (I.pressed('left')) it.adjust(-1); if (I.pressed('right')) it.adjust(1); }
    if (I.pressed('confirm') || I.pressed('attack')) this.activate();
    if (I.pressed('pause') || I.pressed('special')) { if (this.mode !== 'title' && this.mode !== 'victory') this.back(); }
  }
  /* ---------- drawing ---------- */
  backdrop(g, W, dim) {
    const T = this.app.titleBg; drawTheme(g, T, 120 + this.t * 6, this.t, W); drawFog(g, T, 120 + this.t * 6, this.t, W);
    if (dim) { g.globalAlpha = dim; g.fillStyle = '#05030a'; g.fillRect(0, 0, W, 180); g.globalAlpha = 1; }
  }
  drawList(g, W, y0, gap = 14) {
    this.rects = [];
    this.items.forEach((it, i) => {
      const y = y0 + i * gap, sel = i === this.sel, col = it.disabled ? C.stone3 : sel ? C.white : C.lav;
      let label = it.label; if (it.kind) label += '  ' + (it.kind === 'slider' ? '' : '< ' + it.value() + ' >');
      const w = it.kind === 'slider' ? 190 : Math.max(textWidth(label), 70) + 24, x = Math.round((W - w) / 2);
      this.rects.push({ x, y: y - 3, w, h: gap - 1 });
      if (sel && !it.disabled) { g.fillStyle = C.indigo2; g.globalAlpha = 0.75; g.fillRect(x, y - 3, w, gap - 2); g.globalAlpha = 1; g.fillStyle = C.lav; g.fillRect(x, y - 3, 2, gap - 2); }
      if (it.kind === 'slider') {
        drawText(g, label, x + 6, y, col);
        const bx = x + 100, bw = 80, v = it.value(); g.fillStyle = C.black; g.fillRect(bx - 1, y, bw + 2, 7); g.fillStyle = C.indigo2; g.fillRect(bx, y + 1, bw, 5); g.fillStyle = sel ? C.lav2 : C.violet2; g.fillRect(bx, y + 1, Math.round(bw * v), 5);
        drawText(g, pct(v), x + w - 4, y, col, { align: 'right' });
      } else drawText(g, label, W / 2, y, col, { align: 'center' });
    });
  }
  draw(g) {
    const W = this.app.viewW, c = W / 2;
    if (this.mode === 'intro') { this.drawIntro(g, W); return; }
    if (this.mode === 'pause') { g.globalAlpha = 0.62; g.fillStyle = '#05030a'; g.fillRect(0, 0, W, 180); g.globalAlpha = 1; drawText(g, 'PAUSED', c, 26, C.lav2, { align: 'center', scale: 2 }); this.drawList(g, W, 58, 16); this.drawHint(g, W, this.app.touchActive ? 'PROGRESS SAVES AT CHECKPOINTS' : 'ESC - RESUME    PROGRESS SAVES AT CHECKPOINTS', 146); return; }
    this.backdrop(g, W, this.mode === 'title' ? 0 : 0.55);
    if (this.mode === 'title') {
      // moon-lit title lockup
      drawText(g, 'BLEEDING MOON', c, 26, C.crimHi, { align: 'center', scale: 3, shadow: C.black });
      drawText(g, 'A TALE OF THREE FALLEN', c, 54, C.lav2, { align: 'center' });
      this.drawList(g, W, 80, 16);
      drawText(g, this.hasSave ? 'SAVE FOUND: ' + (CHECKPOINTS[Save.load(CHECKPOINT_IDS).checkpoint].label) : 'NO SAVE YET', c, 154, C.stone3, { align: 'center' });
      this.drawHint(g, W, this.app.touchActive ? 'TAP TO CHOOSE' : 'ARROWS + ENTER');
    } else if (this.mode === 'confirm') {
      drawText(g, 'START A NEW GAME?', c, 40, C.crimHi, { align: 'center', scale: 2 });
      drawText(g, 'YOUR CURRENT SAVE WILL BE ERASED.', c, 66, C.lav2, { align: 'center' });
      this.drawList(g, W, 92);
    } else if (this.mode === 'settings' || this.mode === 'settings2') {
      drawText(g, this.mode === 'settings' ? 'SETTINGS' : 'TOUCH AND DISPLAY', c, 10, C.lav2, { align: 'center', scale: 2 }); this.drawList(g, W, 40, 16);
    } else if (this.mode === 'controls') this.drawControls(g, W);
    else if (this.mode === 'victory') this.drawVictory(g, W);
  }
  drawHint(g, W, s, y = 168) { drawText(g, s, W / 2, y, C.stone3, { align: 'center' }); }
  drawIntro(g, W) {
    g.fillStyle = '#05030a'; g.fillRect(0, 0, W, 180);
    const lines = INTRO[Math.min(this.introI, INTRO.length - 1)], a = Math.max(0, Math.min(1, this.introT / 1.0, (5.2 - this.introT) / 0.9));
    const y0 = 90 - lines.length * 8;
    lines.forEach((l, i) => drawText(g, l, W / 2, y0 + i * 16, i === 0 ? C.lav2 : C.lav, { align: 'center', alpha: a }));
    drawText(g, 'ENTER - SKIP', W - 8, 168, C.stone3, { align: 'right' });
  }
  drawControls(g, W) {
    const c = W / 2, rows = [['MOVE', 'ARROWS / A D'], ['JUMP', 'SPACE / Z / W'], ['ATTACK', 'J / X'], ['SHADOW', 'K / C  (30 ENERGY)'], ['DASH', 'L / SHIFT'], ['PAUSE', 'ESC / P']];
    drawText(g, 'CONTROLS', c, 8, C.lav2, { align: 'center', scale: 2 });
    rows.forEach((r, i) => { drawText(g, r[0], c - 90, 32 + i * 12, C.lav); drawText(g, r[1], c - 20, 32 + i * 12, C.white); });
    drawText(g, 'TOUCH: LEFT STICK MOVES. JUMP ATK DASH SHADOW', c, 112, C.lav, { align: 'center' });
    drawText(g, 'DASH GIVES BRIEF INVULNERABILITY', c, 124, C.stone3, { align: 'center' });
    this.drawList(g, W, 144);
  }
  drawVictory(g, W) {
    const c = W / 2, S = this.app.scene;
    drawText(g, 'THE MOON HEALS', c, 20, C.lav2, { align: 'center', scale: 3 });
    drawText(g, 'ALL THREE GUARDIANS HAVE FALLEN.', c, 52, C.lav, { align: 'center' });
    drawText(g, 'THE CASTLE FALLS SILENT.', c, 64, C.lav, { align: 'center' });
    drawText(g, 'TIME ' + fmtTime(S ? S.playTime : 0) + '    DEATHS ' + (S ? S.deaths : 0), c, 84, C.white, { align: 'center' });
    this.drawList(g, W, 108);
  }
}
