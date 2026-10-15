// Shared boss logic: states, beat-based attacks with enforced telegraph times, poise/stagger, phase changes, defeat sequence.
import { C } from '../art/palette.js';
import { bossFrame } from '../art/bosses_art.js';
import { drawFrame, whiteOf } from '../art/sprites.js';
import { clamp, rand, rng } from '../core/util.js';

export const MIN_TELEGRAPH = 0.45;               // fairness floor: no attack ever warns for less than this

export class Boss {
  constructor(S, cfg) {
    Object.assign(this, { S, face: -1, t: 0, state: 'spawn', stT: 0, tf: 1, phase: 1, flashT: 0, poise: 0, vuln: 0, alive: true, atk: null, idleT: 1.2, lastAtk: '', vx: 0, alpha: 1, tint: 0, marksHit: 0, dispHp: cfg.hp, animT: 0, engaged: false, extra: null, contactOk: true }, cfg);
    this.hp = this.maxHp = cfg.hp;
  }
  box() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  get vulnerable() { return this.state === 'idle' || this.state === 'attack' || this.state === 'stagger'; }
  faceTo(px) { this.face = px >= this.x ? 1 : -1; }
  cyPos() { return this.y - this.h * 0.55; }              // visual centre (subclasses with flight / leaps override)

  takeHit(dmg, srcX, opts = {}) {
    if (!this.vulnerable || this.hidden || this.alpha < 0.5) return false;
    const bonus = (this.state === 'stagger' || this.vuln > 0) ? 1.25 : 1;
    this.hp = Math.max(0, this.hp - dmg * bonus); this.flashT = 0.07;
    this.poise += dmg;
    const S = this.S; S.fx.burst(this.x, this.cyPos(), 8, { colors: [C.white, C.lav2, C.crimHi], speed: 110, grav: 220, life: 0.35 });
    // phase thresholds
    const m = this.marks[this.marksHit];
    if (m !== undefined && this.hp <= this.maxHp * m && this.hp > 0) { this.marksHit++; this.beginTransition(); return true; }
    if (this.hp <= 0) { this.beginDying(); return true; }
    if (this.poise >= this.poiseMax && (this.state === 'idle' || (this.atk && this.curBeat().kind === 'rec'))) { this.poise = 0; this.atk = null; this.state = 'stagger'; this.stT = 0; this.vx = -this.face * 40; S.fx.burst(this.x, this.cyPos(), 12, { colors: [C.white, C.lav2], speed: 140, grav: 180, life: 0.5 }); S.fx.ring(this.x, this.cyPos(), 4, 26, 0.3, C.white); S.fx.shake(3, 0.2); S.audio.bossGrowl(this.id, 1.2); }
    return true;
  }

  /* ---------- attacks as beat lists ---------- */
  startAttack(name) {
    const beats = this.attacks[name](this);
    this.atk = { name, beats, i: 0, t: 0, hitP: false, started: false }; this.state = 'attack'; this.lastAtk = name;
  }
  curBeat() { return this.atk.beats[this.atk.i]; }
  beatDur(b) {
    if (b.kind === 'tele') return Math.max(b.min || MIN_TELEGRAPH, b.d / this.tf);
    if (b.kind === 'rec') return Math.max(0.25, b.d / this.tf);
    return b.d;
  }
  updateAttack(dt) {
    const a = this.atk; if (!a) return;
    const b = a.beats[a.i];
    if (!a.started || a.beatStart !== a.i) { a.started = true; a.beatStart = a.i; a.t = 0; a.dur = this.beatDur(b); a.hitP = false; if (b.kind === 'tele' && !b.quiet) this.S.audio.bossTelegraph(this.id); b.start && b.start(this, a); }
    a.t += dt;
    b.tick && b.tick(this, a, dt);
    if (b.kind === 'act' && b.boxes && !a.hitP) {
      for (const r of b.boxes(this, a)) if (this.S.overlapPlayer(r)) { if (this.S.player.hurt(b.dmg || 1, this.x, { knock: b.knock })) a.hitP = true; break; }
    }
    if (a.t >= a.dur) { b.end && b.end(this, a); a.i++; if (a.i >= a.beats.length) this.endAttack(); }
  }
  endAttack() { this.atk = null; this.state = 'idle'; this.idleT = rand(0.45, 0.85) / this.tf; this.afterAttack && this.afterAttack(); }

  /* ---------- phase transition ---------- */
  beginTransition() {
    const S = this.S; this.atk = null; this.state = 'transition'; this.stT = 0; this.phase++; this.vx = 0; this.vuln = 0;
    S.clearThreats(); S.fx.shake(7, this.transitionTime(this.phase) * 0.8); S.fx.flash(C.white, 0.55, 0.4); S.fx.ring(this.x, this.cyPos(), 6, 90, 0.7, C.lav2, 2);
    S.audio.bossPhase(this.id); S.onBossPhase(this);
    this.onTransition && this.onTransition(this.phase);
  }
  transitionTime(p) { return 2.2; }
  /* ---------- defeat ---------- */
  beginDying() {
    this.state = 'dying'; this.stT = 0; this.atk = null; this.vx = 0; this.hp = 0;
    this.S.clearThreats(); this.S.fx.slow(0.3, 1.6); this.S.fx.flash(C.white, 0.7, 0.5); this.S.fx.shake(8, 1.2); this.S.audio.bossDefeat(this.id); this.S.onBossDying(this);
  }

  update(dt) {
    this.t += dt; this.animT += dt; this.stT += dt; if (this.flashT > 0) this.flashT -= dt; if (this.vuln > 0) this.vuln -= dt;
    this.dispHp += (this.hp - this.dispHp) * Math.min(1, dt * 6);
    const S = this.S, P = S.player;
    switch (this.state) {
      case 'spawn':
        this.spawnTick && this.spawnTick(dt);
        if (this.stT > this.spawnTime) { this.state = 'idle'; this.stT = 0; this.engaged = true; S.onBossEngaged(this); }
        break;
      case 'idle': this.idleTick(dt); break;
      case 'attack': this.updateAttack(dt); break;
      case 'stagger': this.vx *= 0.9; this.x = clamp(this.x + this.vx * dt, 20, S.stage.width - 20); if (this.stT > 0.85) { this.state = 'idle'; this.idleT = 0.3; } break;
      case 'transition': this.transTick && this.transTick(dt); if (this.stT >= this.transitionTime(this.phase)) { this.state = 'idle'; this.idleT = 0.6; this.stT = 0; this.afterTransition && this.afterTransition(); } break;
      case 'dying': {
        this.dyingTick && this.dyingTick(dt);
        if (Math.floor((this.stT - dt) / 0.16) !== Math.floor(this.stT / 0.16) && this.stT < 2.6) {
          const bx = this.x + rand(-this.w * 0.5, this.w * 0.5), by = this.cyPos() + rand(-this.h * 0.45, this.h * 0.45);
          S.fx.burst(bx, by, 10, { colors: [C.white, C.lav2, C.crimHi, C.flame], speed: 120, grav: 120, life: 0.55 }); S.fx.ring(bx, by, 2, 18, 0.3, C.lav2);
          if (rng() > 0.5) S.audio.explosion(0.35, 0.8 + rng() * 0.5);
        }
        if (this.stT > 2.7 && !this.flashedEnd) { this.flashedEnd = true; S.fx.flash(C.white, 0.9, 0.7); S.fx.burst(this.x, this.cyPos(), 60, { colors: [C.white, C.lav2, C.flame2, C.crimHi], speed: 200, grav: 60, life: 1.0 }); S.audio.explosion(1, 0.55); S.fx.shake(10, 0.8); }
        if (this.stT > 3.6) { this.alive = false; this.state = 'dead'; S.onBossDefeated(this); }
        break;
      }
      default: break;
    }
    if (this.contactOk && this.contactActive() && S.overlapPlayer(this.contactBox())) P.hurt(1, this.x);
  }
  contactActive() { return (this.state === 'idle' || this.state === 'attack') && !this.hidden; }
  contactBox() { const b = this.box(); return { x: b.x + 4, y: b.y + 6, w: b.w - 8, h: b.h - 10 }; }

  /* ---------- drawing ---------- */
  pose() { return ['idle', null]; }
  draw(g, camX) {
    if (this.hidden) return;
    const [pose, extra] = this.pose(), f = bossFrame(this.id, pose, this.animT, Object.assign({}, this.extra, extra));
    let alpha = this.alpha;
    if (this.state === 'dying') alpha = clamp(1 - (this.stT - 2.0) / 1.5, 0, 1);
    const white = this.flashT > 0 || (this.state === 'dying' && Math.floor(this.stT * 14) % 2 === 0 && this.stT < 2.6);
    const ox = this.state === 'dying' && this.stT < 2.6 ? Math.round(Math.sin(this.stT * 60) * 1.5) : 0;
    drawFrame(g, f, this.x - camX + ox, this.drawY(), this.face < 0, white, alpha);
    if (this.tint > 0) { g.globalAlpha = this.tint * 0.28; g.fillStyle = C.crim; g.fillRect(Math.round(this.x - camX - 40), Math.round(this.drawY() - f.ay + 10), 80, f.h - 10); g.globalAlpha = 1; }
  }
  drawY() { return this.y; }
  drawTele(g, camX) {                       // per-attack warning shapes, drawn above the boss
    const a = this.atk; if (!a) return; const b = a.beats[a.i];
    if (b && b.warn) b.warn(g, camX, this, a, Math.min(1, a.t / (a.dur || 1)));
  }
}

/** red warning rectangle: gets more visible the closer the strike is */
export function warnRect(g, camX, r, k, color = C.crimHi) {
  const flick = Math.floor(performance.now() / 55) % 2;
  g.fillStyle = color; g.globalAlpha = 0.12 + 0.3 * k; g.fillRect(Math.round(r.x - camX), Math.round(r.y), r.w, r.h);
  g.globalAlpha = flick ? 0.9 : 0.5; g.fillRect(Math.round(r.x - camX), Math.round(r.y), r.w, 1); g.fillRect(Math.round(r.x - camX), Math.round(r.y + r.h - 1), r.w, 1);
  g.globalAlpha = 1;
}
