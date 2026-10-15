// PlayScene: owns one run - stage, player, enemies, boss encounter flow, checkpoints, combat resolution, rendering.
import { C } from '../art/palette.js';
import { drawTheme, drawFog } from '../art/backgrounds.js';
import { drawFlame, drawShrine } from '../art/tiles.js';
import { drawFrame } from '../art/sprites.js';
import { overlap, rand, rng, clamp } from '../core/util.js';
const compact = (a, keep) => { let j = 0; for (let i = 0; i < a.length; i++) if (keep(a[i])) a[j++] = a[i]; a.length = j; return a; };   // in place: no per-frame array garbage
import { Save } from '../core/save.js';
import { drawText } from '../core/font.js';
import { Stage } from './world.js';
import { Player } from './player.js';
import { Ghoul, Wisp, Pickup } from './enemies.js';
import { createBoss } from './bosses.js';
import { STAGES, CHECKPOINTS, CHECKPOINT_IDS, BOSS_NAMES } from './levels.js';
import { drawHud } from '../ui/hud.js';

const AUTO_CHECKPOINT = { 0: 'approach_start', 1: 'hall', 3: 'chamber', 4: 'throne' };

export class PlayScene {
  constructor(app) {
    this.app = app; this.input = app.input; this.audio = app.audio; this.spr = app.spr; this.fx = app.fx;
    this.player = new Player(this); this.stage = null; this.enemies = []; this.projs = []; this.hazards = []; this.pickups = []; this.boss = null;
    this.defeated = []; this.activeShrines = new Set(); this.checkpoint = 'approach_start'; this.deaths = 0; this.playTime = 0; this.time = 0;
    this.camX = null; this.toasts = []; this.banner = null; this.fade = { a: 0, to: 0, speed: 2 }; this.bossState = 'none'; this.deadFlow = null; this.victoryT = -1;
    this.lightningT = rand(6, 12); this.moteT = 0; this.transition = null;
  }
  get viewW() { return this.app.viewW; }
  get ended() { return this.victoryT >= 0; }

  /* ------------------------------ run control ------------------------------ */
  newGame() {
    this.defeated = []; this.activeShrines = new Set(); this.deaths = 0; this.playTime = 0; this.player.maxHp = 5;
    this.loadCheckpoint('approach_start', true); this.saveCheckpoint('approach_start');
  }
  continueFrom(save) {
    this.defeated = save.defeated.slice(); this.deaths = save.deaths || 0; this.playTime = save.time || 0; this.player.maxHp = save.maxHp;
    this.activeShrines = new Set(CHECKPOINT_IDS.filter(id => id.includes('shrine') && CHECKPOINT_IDS.indexOf(id) <= CHECKPOINT_IDS.indexOf(save.checkpoint)));
    this.loadCheckpoint(save.checkpoint, true);
  }
  loadCheckpoint(id, instant) {
    const cp = CHECKPOINTS[id]; this.checkpoint = id; this.loadStage(cp.stage, cp.x, { fullHeal: true, instant });
    if (id.includes('shrine')) this.activeShrines.add(id), this.stage.shrines.forEach(s => { s.active = this.activeShrines.has(s.id); });
  }
  loadStage(i, x, o = {}) {
    const def = STAGES[i]; this.stageIndex = i; this.stage = new Stage(def);
    this.enemies = []; this.projs = []; this.hazards = []; this.pickups = []; this.boss = null; this.bossState = 'none'; this.fx.p.length = 0; this.fx.rings.length = 0; Object.assign(this.fx, { stopT: 0, slowT: 0, shakeT: 0, flashT: 0 });
    for (const e of def.enemies) this.enemies.push(e.t === 'ghoul' ? new Ghoul(this, e) : new Wisp(this, e));
    this.stage.shrines.forEach(s => { s.active = this.activeShrines.has(s.id); });
    if (def.boss) {
      if (this.defeated.includes(def.boss.id)) { this.bossState = 'defeated'; this.stage.rightBarrier.active = false; } else { this.bossState = 'waiting'; this.audio.loadBoss(); }
    }
    this.player.reset(x, def.ground, o.fullHeal ? this.player.maxHp : this.player.hp); this.player.energy = Math.max(this.player.energy, 60);
    this.camX = null; this.cam = null; this.banner = { text: def.name, t: 0, dur: 2.8 };
    this.audio.area(def.area); if (def.theme === 'approach' || def.theme === 'throne') this.audio.startWind(); else this.audio.stopWind();
    this.fade = { a: o.instant ? 1 : 1, to: 0, speed: 1.6 };
    if (AUTO_CHECKPOINT[i] !== undefined && !(i === 0 && this.checkpoint === 'approach_shrine')) {
      if (!(i === 0 && x > 100)) { this.checkpoint = AUTO_CHECKPOINT[i]; this.saveCheckpoint(this.checkpoint); }
    }
    this.deadFlow = null; this.transition = null; this.player.deadNotified = false;
  }
  saveCheckpoint(id) { this.checkpoint = id; Save.write({ checkpoint: id, defeated: this.defeated, maxHp: this.player.maxHp, deaths: this.deaths, time: Math.round(this.playTime) }); }
  toast(text, dur = 2.2) { this.toasts.push({ text, t: 0, dur }); if (this.toasts.length > 3) this.toasts.shift(); }

  /* ------------------------------ combat resolution ------------------------------ */
  overlapPlayer(r) { return !this.player.dead && overlap(r, this.player.box()); }
  /** Sword swing: called every frame of the hit window; each target can be hit once per swing (hitSet). */
  resolvePlayerSwing(box, hitSet, dmg) {
    const P = this.player; let landed = false;
    for (const e of this.enemies) {
      if (!e.alive || e.dying || hitSet.has(e) || !overlap(box, e.box())) continue;
      hitSet.add(e); e.takeHit(dmg, P.x); this.audio.hitEnemy(); this.fx.stop(0.05); this.fx.shake(1.5, 0.1); P.energy = Math.min(100, P.energy + 7); landed = true;
    }
    const B = this.boss;
    if (B && B.alive && !hitSet.has(B) && overlap(box, B.box())) {
      if (B.takeHit(dmg, P.x)) { hitSet.add(B); this.audio.hitBoss(B.state === 'stagger'); this.fx.stop(0.07); this.fx.shake(2.5, 0.14); P.energy = Math.min(100, P.energy + 4); this.fx.sparks(box.x + (P.face > 0 ? box.w : 0), box.y + 12, 8); landed = true; }
    }
    return landed;
  }
  onEnemyKilled(e) {
    this.player.energy = Math.min(100, this.player.energy + 12);
    this.fx.burst(e.x, e.y - 10, 16, { colors: [C.lav2, C.flame, C.white, C.crimHi], speed: 110, grav: 120, life: 0.5 }); this.audio.explosion(0.35, 1.3);
    if (e.kind === 'ghoul' && rng() < 0.3 && !e.summoned) this.pickups.push(new Pickup(this, e.x, e.y - 12));
  }
  clearThreats() { this.projs = this.projs.filter(p => p.owner === 'player'); this.hazards = []; }

  /* ------------------------------ boss encounter flow ------------------------------ */
  startBoss() {
    const def = this.stage.def.boss; this.bossState = 'intro'; this.boss = createBoss(this, { id: def.id, x: def.x });
    this.stage.leftBarrier.active = true; this.audio.bossIntro(def.id);
    this.fx.shake(5, 0.6); this.fx.flash(C.black, 0.4, 0.5); this.audio.gate(); this.banner = { text: BOSS_NAMES[def.id], t: 0, dur: 3.2, boss: true };
  }
  onBossEngaged() { this.bossState = 'fight'; }
  onBossPhase(b) { this.toast(b.id === 'fallen_sovereign' && b.phase === 2 ? 'THE SOVEREIGN TRANSFORMS' : b.id === 'fallen_sovereign' ? 'THE SOVEREIGN ENRAGES' : b.name + ' - PHASE ' + ['', 'I', 'II', 'III'][b.phase], 2.6); for (const e of this.enemies) if (e.kind === 'wisp' && e.summoned && !e.dying) e.die(); }
  onBossDying(b) { this.bossState = 'dying'; this.audio.bossExit(1.5); for (const e of this.enemies) if (!e.dying) e.die(); }
  onBossDefeated(b) {
    this.defeated.push(b.id); this.bossState = 'defeated'; this.stage.leftBarrier.active = false; this.player.hp = this.player.maxHp;
    if (this.stage.rightBarrier) { this.stage.rightBarrier.active = false; this.audio.gate(); }
    this.toast(b.name + ' FALLS', 3);
    if (this.stage.def.next >= 0) { this.saveCheckpoint(this.checkpoint); this.toast('THE WAY FORWARD OPENS', 3); } else { this.victoryT = 0; }
    this.audio.unloadBoss(6000);
  }
  onPlayerDead() { this.deaths++; this.deadFlow = { t: 0 }; this.audio.bossExit(1.0); }

  /* ------------------------------ update ------------------------------ */
  update(dt) {
    const P = this.player, st = this.stage; this.time += dt; if (!P.dead) this.playTime += dt;
    if (this.fade.a !== this.fade.to) this.fade.a = this.fade.a < this.fade.to ? Math.min(this.fade.to, this.fade.a + dt * this.fade.speed) : Math.max(this.fade.to, this.fade.a - dt * this.fade.speed);
    if (this.transition) { this.transition.t += dt; if (this.fade.a >= 1) { const n = this.transition.next; this.transition = null; this.loadStage(n, STAGES[n].entry, { fullHeal: false }); } return; }
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.dur) this.banner = null; }
    for (const t of this.toasts) t.t += dt; compact(this.toasts, t => t.t < t.dur);
    P.update(dt);
    for (const e of this.enemies) e.update(dt); compact(this.enemies, e => e.alive);
    if (this.boss && this.boss.alive) this.boss.update(dt);
    this.updateProjectiles(dt); this.updateHazards(dt);
    for (const p of this.pickups) p.update(dt); compact(this.pickups, p => p.alive);
    this.fx.update(dt);
    this.shrineCheck(); this.triggerCheck();
    this.ambient(dt);
    let fx = P.x; const B = this.boss; if (B && B.alive && !B.hidden && (this.bossState === 'fight' || this.bossState === 'intro')) { const m = this.viewW * 0.32; fx = clamp((P.x + B.x) / 2, P.x - m, P.x + m); }
    const target = this.stage.camera(fx, this.viewW, this.camX, P.face, dt); this.camX = this.camX === null ? target : target;
    if (this.victoryT >= 0) { this.victoryT += dt; if (this.victoryT > 3.2 && !this.victoryCalled) { this.victoryCalled = true; this.app.victory(); } }
    if (this.deadFlow) { this.deadFlow.t += dt; if (this.deadFlow.t > 1.4 && this.fade.to === 0) this.fade = { a: this.fade.a, to: 1, speed: 1.8 }; if (this.deadFlow.t > 2.4) { this.victoryCalled = false; this.respawn(); } }
  }
  /** pause-menu "restart checkpoint": reload the last checkpoint with full health; defeated bosses stay defeated */
  restartCheckpoint() { this.audio.bossExit(0.3); this.victoryCalled = false; this.respawn(); }
  respawn() { const keep = this.player.maxHp; this.loadCheckpoint(this.checkpoint, true); this.player.maxHp = keep; this.player.hp = keep; this.deadFlow = null; }

  updateProjectiles(dt) {
    const P = this.player;
    for (const p of this.projs) {
      p.update(dt, this.stage, this.fx);
      if (p.dead) continue;
      if (p.owner === 'player') {
        for (const e of this.enemies) if (e.alive && !e.dying && !p.hit.has(e) && overlap(p.box(), e.box())) { p.hit.add(e); e.takeHit(p.dmg - 1, p.x, { knock: 150 }); this.audio.specialHit(); this.fx.stop(0.05); this.fx.sparks(e.x, e.y - 10, 6); }
        const B = this.boss; if (B && B.alive && !p.hit.has(B) && overlap(p.box(), B.box())) { if (B.takeHit(p.dmg, p.x)) { p.hit.add(B); this.audio.specialHit(); this.fx.stop(0.07); this.fx.shake(3, 0.18); this.fx.burst(p.x, p.y, 14, { colors: [C.violet2, C.lav2, C.white], speed: 120, life: 0.4 }); } }
      } else if (!P.dead && overlap(p.box(), P.box())) {
        if (P.hurt(p.dmg, p.x)) { if (p.kind !== 'shock' || true) { p.dead = true; this.fx.burst(p.x, p.y, 8, { colors: [C.flame, C.lav2, C.white], speed: 80, life: 0.3 }); } }
      }
    }
    compact(this.projs, p => !p.dead);
  }
  updateHazards(dt) {
    const P = this.player;
    for (const h of this.hazards) {
      h.update(dt);
      if (h.phase === 'active') {
        if (!h.sfxFired) { h.sfxFired = true; if (h.kind !== 'marker') { this.fx.shake(2.5, 0.15); this.fx.burst(h.x, this.stage.ground - 4, 10, { colors: h.kind === 'lightning' ? [C.white, C.lav2] : h.kind === 'spear' ? [C.steelHi, C.crimHi] : [C.crimHi, C.crim, C.white], speed: 90, up: 60, grav: 200, life: 0.4 }); if (h.kind === 'lightning') this.audio.explosion(0.3, 1.6); } }
        if (!h.hit && h.dmg > 0 && this.overlapPlayer(h.box()) && P.hurt(h.dmg, h.x)) h.hit = true;
      }
    }
    compact(this.hazards, h => !h.dead);
  }
  shrineCheck() {
    const P = this.player; if (P.dead) return;
    for (const s of this.stage.shrines) if (!s.active && Math.abs(P.x - s.x) < 22 && P.onGround) {
      s.active = true; this.activeShrines.add(s.id); P.hp = P.maxHp; P.energy = 100; this.audio.shrine(); this.saveCheckpoint(s.id);
      this.fx.burst(s.x, this.stage.ground - 20, 30, { colors: [C.flame, C.flame2, C.white], speed: 90, up: 70, grav: -20, life: 0.9 }); this.fx.ring(s.x, this.stage.ground - 20, 4, 50, 0.6, C.lav2, 2); this.fx.flash(C.lav2, 0.2, 0.3);
      this.toast('CHECKPOINT - ' + CHECKPOINTS[s.id].label, 3);
    }
  }
  triggerCheck() {
    const P = this.player, def = this.stage.def; if (P.dead) return;
    if (this.bossState === 'waiting' && P.x > def.boss.trigger) this.startBoss();
    if (def.exit && P.x > def.exit.x && (!def.boss || this.bossState === 'defeated') && !this.transition && P.onGround) {
      this.transition = { next: def.next, t: 0 }; this.fade = { a: this.fade.a, to: 1, speed: 2.2 }; this.audio.gate();
    }
  }
  ambient(dt) {
    const th = this.stage.theme, quality = this.fx.quality;
    this.moteT -= dt; if (this.moteT <= 0) { this.moteT = 0.16 / Math.max(0.3, quality); this.fx.burst(this.camX + rand(0, this.viewW), rand(40, 150), 1, { colors: [C.violet2, C.lav, C.flame], speed: 6, up: 8, grav: -3, life: 3, size: 1 }); }
    if (this.stage.bg.lightning) {
      const enraged = this.boss && this.boss.tint > 0; this.lightningT -= dt * (enraged ? 3 : 1);
      if (this.lightningT <= 0) { this.lightningT = rand(8, 18); this.fx.flash(C.lav2, 0.32, 0.28); this.thunderIn = rand(0.4, 1.8); }
    }
    if (this.thunderIn > 0) { this.thunderIn -= dt; if (this.thunderIn <= 0) this.audio.thunder(rand(1, 2.2)); }
  }

  /* ------------------------------ drawing ------------------------------ */
  draw(g) {
    const W = this.viewW, st = this.stage, [ox, oy] = this.fx.shakeOffset(), cam = Math.round(this.camX || 0);
    g.save(); g.translate(ox, oy);
    g.fillStyle = '#07050d'; g.fillRect(-8, -8, W + 16, 196);
    drawTheme(g, st.bg, cam, this.time, W);
    // static stage (only the visible slice)
    const sx = clamp(cam, 0, st.width - 1), sw = Math.min(W, st.width - sx); g.drawImage(st.canvas, sx, 0, sw, 180, sx - cam, 0, sw, 180);
    // animated decor: torch flames, shrines, boss barriers
    for (const d of st.decor) if (d.type === 'torch') { const x = d.x - cam; if (x > -10 && x < W + 10) { g.fillStyle = C.flame; g.globalAlpha = 0.1; g.fillRect(x - 16, d.y - 28, 32, 30); g.globalAlpha = 1; drawFlame(g, x, d.y - 6, this.time + d.x * 0.013, 1, st.theme === 'throne'); } }
    for (const s of st.shrines) drawShrine(g, Math.round(s.x - cam), st.ground, this.time, s.active);
    this.drawBarriers(g, cam);
    drawFog(g, st.bg, cam, this.time, W);
    for (const p of this.pickups) p.draw(g, cam);
    const shadow = (x, w) => { g.fillStyle = '#000'; g.globalAlpha = 0.35; g.fillRect(Math.round(x - cam - w / 2), st.ground - 1, w, 2); g.globalAlpha = 1; };
    for (const e of this.enemies) { if (e.kind === 'ghoul') shadow(e.x, 14); e.draw(g, cam); }
    if (this.boss && this.boss.alive) { if (!this.boss.hidden) shadow(this.boss.x, this.boss.id === 'fallen_sovereign' ? 50 : this.boss.id === 'hollow_knight' ? 34 : 22); this.boss.draw(g, cam); this.boss.drawTele(g, cam); }
    for (const h of this.hazards) h.draw(g, cam, st.ground);
    shadow(this.player.x, 12); this.player.draw(g, cam);
    for (const p of this.projs) p.draw(g, cam);
    this.fx.draw(g, cam);
    g.restore();
    this.drawLighting(g, W);
    this.fx.drawFlash(g, W, 180);
    drawHud(g, this);
    if (this.fade.a > 0.001) { g.globalAlpha = Math.min(1, this.fade.a); g.fillStyle = '#000'; g.fillRect(0, 0, W, 180); g.globalAlpha = 1; }
    if (this.deadFlow && this.deadFlow.t > 0.7) { const a = clamp((this.deadFlow.t - 0.7) / 0.8, 0, 1); drawText(g, 'YOU DIED', W / 2, 70, C.crimHi, { align: 'center', scale: 3, alpha: a }); }
  }
  drawBarriers(g, cam) {
    const st = this.stage, t = this.time;
    const wall = (x, col) => { if (x - cam < -10 || x - cam > this.viewW + 10) return; for (let y = 0; y < 150; y += 2) { const w = 2 + ((y * 7 + Math.floor(t * 14)) % 3); g.fillStyle = col; g.globalAlpha = 0.35 + 0.3 * ((y + Math.floor(t * 20)) % 3 === 0); g.fillRect(Math.round(x - cam), y, w, 2); } g.globalAlpha = 1; g.fillStyle = C.white; g.globalAlpha = 0.5; g.fillRect(Math.round(x - cam), 0, 1, 150); g.globalAlpha = 1; };
    if (st.leftBarrier && st.leftBarrier.active) wall(8, C.violet2);
    if (st.rightBarrier && st.rightBarrier.active) wall(st.width - 12, C.crim);
  }
  drawLighting(g, W) {
    // banded vignette (crisp steps, no smooth gradient)
    const bands = [0.34, 0.22, 0.13, 0.06];
    for (let i = 0; i < bands.length; i++) { g.globalAlpha = bands[i]; g.fillStyle = '#05030a'; const s = i * 5; g.fillRect(0, s, W, 5); g.fillRect(0, 180 - s - 5, W, 5); g.fillRect(s, 0, 5, 180); g.fillRect(W - s - 5, 0, 5, 180); }
    g.globalAlpha = 1;
  }
}
