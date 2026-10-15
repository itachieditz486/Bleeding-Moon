// The three bosses. Each attack is a list of beats: tele (warning) -> act (damage window) -> rec (punish window).
import { C } from '../art/palette.js';
import { Boss, warnRect } from './boss_base.js';
import { Projectile, Hazard } from './projectiles.js';
import { Wisp } from './enemies.js';
import { BOSS_NAMES } from './levels.js';
import { clamp, rand, rng, pick, sign } from '../core/util.js';

const weighted = (list) => { const total = list.reduce((a, [, w]) => a + w, 0); let r = rng() * total; for (const [k, w] of list) { r -= w; if (r <= 0) return k; } return list[0][0]; };
const dedupe = (xs, gap) => xs.filter((x, i) => xs.findIndex(y => Math.abs(y - x) < gap) === i);

/* ================================================================ 1. THE HOLLOW KNIGHT */
export class HollowKnight extends Boss {
  constructor(S, def) {
    super(S, { id: 'hollow_knight', name: BOSS_NAMES.hollow_knight, hp: 60, marks: [0.5], poiseMax: 14, w: 26, h: 56, x: def.x, y: S.stage.ground, spawnTime: 2.6 });
    const sweepBox = b => ({ x: b.face > 0 ? b.x + 4 : b.x - 76, y: b.y - 46, w: 72, h: 44 });
    const slamBox = b => ({ x: b.face > 0 ? b.x + 4 : b.x - 64, y: b.y - 20, w: 60, h: 20 });
    this.attacks = {
      sweep: b => [
        { kind: 'tele', d: 0.75, pose: 'windup_sweep', warn: (g, cx, bb, a, k) => warnRect(g, cx, sweepBox(bb), k) },
        { kind: 'act', d: 0.16, pose: 'sweep', dmg: 1, boxes: bb => [sweepBox(bb)], start: bb => { bb.x = clamp(bb.x + bb.face * 12, 24, S.stage.width - 24); S.fx.burst(bb.x + bb.face * 40, bb.y - 24, 8, { colors: [C.white, C.crimHi], speed: 90, angle: bb.face > 0 ? 0 : Math.PI, spread: 0.6, grav: 0, life: 0.25 }); S.fx.shake(2, 0.12); } },
        { kind: 'rec', d: 0.55, pose: 'sweep' }],
      slam: b => [
        { kind: 'tele', d: 0.85, pose: 'windup_slam', warn: (g, cx, bb, a, k) => warnRect(g, cx, slamBox(bb), k) },
        { kind: 'act', d: 0.14, pose: 'slam', dmg: 1, boxes: bb => [slamBox(bb)], start: bb => {
          S.fx.shake(5, 0.3); S.fx.dust(bb.x + bb.face * 30, bb.y, 8); S.fx.ring(bb.x + bb.face * 30, bb.y - 2, 4, 34, 0.3, C.crimHi); S.audio.explosion(0.8, 0.7);
          const dirs = bb.phase >= 2 ? [bb.face, -bb.face] : [bb.face];
          for (const d of dirs) S.projs.push(new Projectile({ owner: 'enemy', kind: 'shock', x: bb.x + d * 34, y: bb.y - 8, vx: d * (bb.phase >= 2 ? 135 : 115), w: 14, h: 16, dmg: 1, life: 2.6, color: C.crim }));
        } },
        { kind: 'rec', d: 0.7, pose: 'slam' }],
      charge: b => [
        { kind: 'tele', d: 0.65, pose: 'windup_charge', warn: (g, cx, bb, a, k) => { const f = Math.floor(performance.now() / 90) % 3; g.fillStyle = C.crimHi; g.globalAlpha = 0.3 + 0.5 * k; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const px = Math.round(bb.x - cx + bb.face * (34 + i * 16 + (j === f ? 0 : 0))), py = Math.round(bb.y - 3 - j); g.fillRect(px - bb.face * j, py, 2, 1); } g.globalAlpha = 1; },
          start: bb => S.fx.dust(bb.x, bb.y, 6, -bb.face) },
        { kind: 'act', d: 0.7, pose: 'charge', dmg: 1, knock: 170, boxes: bb => [{ x: bb.x - 15, y: bb.y - 52, w: 30, h: 52 }, { x: bb.face > 0 ? bb.x + 8 : bb.x - 44, y: bb.y - 44, w: 36, h: 40 }],
          start: (bb, a) => { bb.vx = bb.face * 215; a.crashed = false; S.fx.shake(2, 0.2); },
          tick: (bb, a, dt) => { bb.x += bb.vx * dt; if (rng() < 0.6) S.fx.dust(bb.x - bb.face * 12, bb.y, 1, -bb.face);
            if (bb.x <= 24 || bb.x >= S.stage.width - 24) { bb.x = clamp(bb.x, 24, S.stage.width - 24); a.crashed = true; a.t = a.dur; } },
          end: (bb, a) => { bb.vx = 0; if (a.crashed) { S.fx.shake(7, 0.4); S.fx.burst(bb.x + bb.face * 14, bb.y - 30, 18, { colors: [C.white, C.lav2, C.crimHi], speed: 150, grav: 200, life: 0.5 }); S.audio.explosion(0.9, 0.6); bb.vuln = 1.1; a.beats[a.i + 1].d = 1.1; a.beats[a.i + 1].pose = 'stagger'; } } },
        { kind: 'rec', d: 0.6, pose: 'sweep' }],
      crack: b => [
        { kind: 'tele', d: 0.55, pose: 'windup_slam' },
        { kind: 'act', d: 1.35, pose: 'slam', start: bb => {
          S.fx.shake(4, 0.3); S.audio.explosion(0.7, 0.6);
          [46, 94, 142].forEach((off, i) => { const x = bb.x + bb.face * off; if (x > 14 && x < S.stage.width - 14) S.hazards.push(new Hazard({ x, y: S.stage.ground, w: 18, h: 90, warn: 0.5 + i * 0.28, active: 0.35, kind: 'crack', dmg: 1 })); });
        } },
        { kind: 'rec', d: 0.6, pose: 'idle' }],
    };
  }
  spawnTick() { this.alpha = clamp(this.stT / 1.4, 0, 1); if (this.stT < 2 && Math.floor((this.stT - 0.016) * 30) !== Math.floor(this.stT * 30)) this.S.fx.burst(this.x, this.y - 4, 2, { colors: [C.crim, C.violet], speed: 40, up: 40, grav: -40, life: 0.6, jx: 20 }); this.faceTo(this.S.player.x); }
  idleTick(dt) {
    const P = this.S.player; this.faceTo(P.x); const d = Math.abs(P.x - this.x); this.moving = false;
    if (d > 64) { this.x = clamp(this.x + this.face * (this.phase >= 2 ? 56 : 42) * dt, 24, this.S.stage.width - 24); this.moving = true; }
    this.idleT -= dt;
    if (this.idleT <= 0) {
      const opts = d < 72 ? [['sweep', 4], ['slam', 3], ['charge', 0.6]] : d < 150 ? [['slam', 3], ['charge', 3], ['sweep', 1]] : [['charge', 4], ['slam', 2]];
      if (this.phase >= 2) opts.push(['crack', 3]);
      let k = weighted(opts); if (k === this.lastAtk && rng() < 0.7) k = weighted(opts);
      this.startAttack(k);
    }
  }
  pose() {
    if (this.state === 'spawn') return [this.stT < 1.6 ? 'idle' : 'roar'];
    if (this.state === 'attack') return [this.curBeat().pose || 'idle'];
    if (this.state === 'stagger') return ['stagger'];
    if (this.state === 'transition') return ['roar'];
    if (this.state === 'dying') return [this.stT < 0.5 ? 'stagger' : 'dead'];
    return [this.moving ? 'walk' : 'idle'];
  }
  onTransition() { this.tf = 1.25; }
  transTick() { this.faceTo(this.S.player.x); if (Math.floor((this.stT - 0.016) * 20) !== Math.floor(this.stT * 20)) this.S.fx.burst(this.x, this.y - 30, 3, { colors: [C.crimHi, C.crim, C.white], speed: 100, up: 30, grav: -30, life: 0.5, jx: 14, jy: 18 }); }
}

/* ================================================================ 2. THE ABYSSAL WRAITH */
export class AbyssalWraith extends Boss {
  constructor(S, def) {
    super(S, { id: 'abyssal_wraith', name: BOSS_NAMES.abyssal_wraith, hp: 70, marks: [0.4], poiseMax: 16, w: 26, h: 36, x: def.x, y: S.stage.ground - 20, spawnTime: 2.6 });
    this.cy = 96; this.goalX = def.x; this.goalY = 98; this.goalT = 0; this.pts = []; this.hidden = false;
    const fire = (b, n, spread, sp) => {
      const P = S.player, ang = Math.atan2(P.y - 12 - b.cy, P.x - b.x);
      for (let i = 0; i < n; i++) { const a = ang + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread * 2); S.projs.push(new Projectile({ owner: 'enemy', kind: 'bolt', x: b.x, y: b.cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, w: 8, h: 8, dmg: 1, life: 4 })); }
      S.audio.play('sfx_explosion', { volume: 0.25, rate: 1.9 });
    };
    this.attacks = {
      bolts: b => [
        { kind: 'tele', d: 0.7, pose: 'charge_bolt', warn: (g, cx, bb, a, k) => { const P = S.player; g.fillStyle = C.lav2; g.globalAlpha = 0.2 + 0.5 * k; const n = 14; for (let i = 1; i < n; i += 2) g.fillRect(Math.round(bb.x - cx + (P.x - bb.x) * i / n), Math.round(bb.cy + (P.y - 12 - bb.cy) * i / n), 2, 2); g.globalAlpha = 1; } },
        { kind: 'act', d: 0.25, pose: 'charge_bolt', start: bb => { const p2 = bb.phase >= 2; fire(bb, p2 ? 5 : 3, p2 ? 0.45 : 0.3, p2 ? 125 : 100); } },
        { kind: 'rec', d: 0.7, pose: 'float' }],
      summon: b => [
        { kind: 'tele', d: 0.9, pose: 'cast_summon', start: (bb, a) => {
          const P = S.player, n = bb.phase >= 2 ? 3 : 2; bb.pts = dedupe([clamp(P.x + rand(60, 110) * pick([-1, 1]), 40, S.stage.width - 40), clamp(P.x - rand(60, 120) * pick([-1, 1]), 40, S.stage.width - 40), rand(60, S.stage.width - 60)].slice(0, n + 1), 50).slice(0, n);
          for (const x of bb.pts) S.hazards.push(new Hazard({ x, y: S.stage.ground, w: 30, h: 1, warn: a.dur, active: 0.15, kind: 'marker', dmg: 0 }));
        } },
        { kind: 'act', d: 0.15, pose: 'cast_summon', start: bb => { const alive = S.enemies.filter(e => e.kind === 'wisp' && e.alive && !e.dying).length; for (const x of bb.pts) if (alive < 3) { S.enemies.push(new Wisp(S, { x, y: S.stage.ground - 36, fast: true })); S.fx.burst(x, S.stage.ground - 30, 14, { colors: [C.flame, C.flame2, C.white], speed: 80, grav: -40, life: 0.5 }); } S.audio.play('sfx_shadow_cast', { volume: 0.7, rate: 0.9 }); } },
        { kind: 'rec', d: 0.95, pose: 'cast_summon' }],
      dash: b => [
        { kind: 'tele', d: 0.7, pose: 'dash', start: bb => { bb.dashDir = bb.x < S.stage.width / 2 ? 1 : -1; bb.face = bb.dashDir; },
          tick: (bb, a, dt) => { bb.cy += (124 - bb.cy) * Math.min(1, dt * 8); },
          warn: (g, cx, bb, a, k) => warnRect(g, cx, { x: bb.dashDir > 0 ? bb.x : bb.x - 215, y: bb.cy - 17, w: 215, h: 34 }, k, C.lav2) },
        { kind: 'act', d: 0.75, pose: 'dash', dmg: 1, knock: 160, boxes: bb => [{ x: bb.x - 18, y: bb.cy - 17, w: 36, h: 34 }],
          start: bb => { S.fx.shake(2, 0.2); S.audio.bossGrowl(bb.id, 1.3); },
          tick: (bb, a, dt) => { bb.x += bb.dashDir * 280 * dt; if (bb.x < 30 || bb.x > S.stage.width - 30) { bb.x = clamp(bb.x, 30, S.stage.width - 30); a.t = a.dur; } if (rng() < 0.8) S.fx.burst(bb.x - bb.dashDir * 14, bb.cy + rand(-12, 12), 1, { colors: [C.violet, C.violet2, C.flame], speed: 15, grav: 0, life: 0.4 }); } },
        { kind: 'rec', d: 0.8, pose: 'float', tick: (bb, a, dt) => { bb.cy += (100 - bb.cy) * Math.min(1, dt * 3); } }],
      teleport: b => [
        { kind: 'act', d: 0.25, pose: 'float', quiet: true, start: bb => { S.audio.play('sfx_shadow_cast', { volume: 0.5, rate: 1.4 }); }, tick: (bb, a) => { bb.alpha = 1 - a.t / a.dur; }, end: bb => { bb.alpha = 0; bb.hidden = true; } },
        { kind: 'act', d: 0.42, pose: 'float', start: (bb, a) => {
          let x = rand(60, S.stage.width - 60), n = 0; while (Math.abs(x - S.player.x) < 70 && n++ < 8) x = rand(60, S.stage.width - 60);
          bb.destX = x; bb.destY = pick([90, 104, 120]); S.hazards.push(new Hazard({ x, y: S.stage.ground, w: 34, h: 1, warn: 0.42, active: 0.1, kind: 'marker', dmg: 0 }));
        }, tick: (bb, a) => { if (Math.floor((a.t - 0.016) / 0.1) !== Math.floor(a.t / 0.1)) S.fx.ring(bb.destX, bb.destY, 2, 18, 0.28, C.teal); } },
        { kind: 'act', d: 0.3, pose: 'float', start: bb => { bb.x = bb.destX; bb.cy = bb.destY; bb.hidden = false; bb.face = S.player.x > bb.x ? 1 : -1; S.fx.ring(bb.x, bb.cy, 4, 40, 0.3, C.lav2, 2); S.fx.burst(bb.x, bb.cy, 14, { colors: [C.teal, C.flame2, C.white], speed: 90, grav: 0, life: 0.4 });
            if (bb.phase >= 2) for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; S.projs.push(new Projectile({ owner: 'enemy', kind: 'bolt', x: bb.x, y: bb.cy, vx: Math.cos(a) * 62, vy: Math.sin(a) * 62, w: 8, h: 8, dmg: 1, life: 3.5 })); } },
          tick: (bb, a) => { bb.alpha = a.t / a.dur; }, end: bb => { bb.alpha = 1; } },
        { kind: 'rec', d: 0.3, pose: 'float' }],
    };
    this.afterAttack = () => { if (this.lastAtk === 'teleport' && this.phase >= 2 && rng() < 0.7) { this.startAttack('bolts'); } };
  }
  box() { return { x: this.x - 13, y: this.cy - 18, w: 26, h: 36 }; }
  cyPos() { return this.cy; }
  get vulnerable() { return !this.hidden && super.vulnerable; }
  drawY() { return this.cy; }
  spawnTick() { this.alpha = clamp(this.stT / 1.5, 0, 1); this.cy = 60 + 36 * clamp(this.stT / 2.2, 0, 1); this.faceTo(this.S.player.x); if (Math.floor((this.stT - 0.016) * 25) !== Math.floor(this.stT * 25)) this.S.fx.burst(this.x, this.cy, 2, { colors: [C.violet, C.teal, C.flame], speed: 40, grav: 0, life: 0.6, jx: 18, jy: 18 }); }
  idleTick(dt) {
    const S = this.S, P = S.player; this.faceTo(P.x);
    this.goalT -= dt; if (this.goalT <= 0) { this.goalT = rand(1.2, 2.2); this.goalX = clamp(P.x + rand(70, 140) * pick([-1, 1]), 40, S.stage.width - 40); this.goalY = rand(86, 108); }
    const sp = 42 * this.tf; this.x += clamp(this.goalX - this.x, -sp * dt, sp * dt); this.cy += clamp(this.goalY - this.cy + Math.sin(this.t * 2) * 3, -30 * dt, 30 * dt);
    this.idleT -= dt;
    if (this.idleT <= 0) {
      const wisps = S.enemies.filter(e => e.kind === 'wisp' && e.alive && !e.dying).length;
      const opts = [['bolts', 4], ['dash', 2], ['teleport', this.lastAtk === 'teleport' ? 0.5 : 3]]; if (wisps < 2) opts.push(['summon', 3]);
      let k = weighted(opts); if (k === this.lastAtk && k !== 'teleport' && rng() < 0.75) k = weighted(opts);
      this.startAttack(k);
    }
  }
  contactActive() { return super.contactActive() && !this.hidden; }
  pose() {
    if (this.state === 'attack') return [this.curBeat().pose || 'float'];
    if (this.state === 'stagger') return ['stagger'];
    if (this.state === 'transition') return ['roar'];
    if (this.state === 'dying') return ['dead'];
    return ['float'];
  }
  onTransition() { this.tf = 1.25; this.alpha = 1; this.hidden = false; }
  transTick() { this.faceTo(this.S.player.x); this.cy += (96 - this.cy) * 0.05; if (Math.floor((this.stT - 0.016) * 18) !== Math.floor(this.stT * 18)) this.S.fx.burst(this.x, this.cy, 3, { colors: [C.teal, C.flame2, C.white], speed: 110, grav: 0, life: 0.5, jx: 10, jy: 10 }); }
  draw(g, camX) { super.draw(g, camX); }
}

/* ================================================================ 3. THE FALLEN SOVEREIGN */
export class FallenSovereign extends Boss {
  constructor(S, def) {
    super(S, { id: 'fallen_sovereign', name: BOSS_NAMES.fallen_sovereign, hp: 110, marks: [0.6, 0.25], poiseMax: 24, w: 44, h: 84, x: def.x, y: S.stage.ground, spawnTime: 3.0 });
    this.lift = 0; this.mx = this.x; this.extra = null;
    const sweepBox1 = b => ({ x: b.face > 0 ? b.x + 6 : b.x - 90, y: b.y - 34, w: 84, h: 34 });
    const sweepBox2 = b => ({ x: b.face > 0 ? b.x + 6 : b.x - 126, y: b.y - 34, w: 120, h: 34 });
    this.attacks = {
      decree: b => [
        { kind: 'tele', d: 0.9, pose: 'windup_decree', start: (bb, a) => {
          const P = S.player, n = bb.phase >= 3 ? 7 : bb.phase >= 2 ? 6 : 4, sgn = pick([-1, 1]);
          let xs = [P.x, P.x - 52 * sgn, P.x + 52 * sgn, P.x + 108 * sgn, P.x - 110 * sgn, P.x + 160 * sgn, P.x - 160 * sgn].slice(0, n).map(x => clamp(x + rand(-5, 5), 16, S.stage.width - 16));
          for (const x of dedupe(xs, 30)) S.hazards.push(new Hazard({ x, y: S.stage.ground, w: 16, h: 150, warn: a.dur, active: 0.28, kind: 'spear', dmg: 1 }));
        } },
        { kind: 'act', d: 0.4, pose: 'decree', start: () => { S.fx.shake(3, 0.3); S.audio.impact(); } },
        { kind: 'rec', d: 0.7, pose: 'idle' }],
      sweep: b => [
        { kind: 'tele', d: 0.8, pose: 'windup_sweep', warn: (g, cx, bb, a, k) => warnRect(g, cx, sweepBox1(bb), k) },
        { kind: 'act', d: 0.15, pose: 'sweep', dmg: 1, boxes: bb => [sweepBox1(bb)], start: bb => { bb.x = clamp(bb.x + bb.face * 14, 30, S.stage.width - 30); S.fx.shake(3, 0.15); } },
        { kind: 'tele', d: 0.35, min: 0.3, quiet: true, pose: 'windup_sweep', warn: (g, cx, bb, a, k) => warnRect(g, cx, sweepBox2(bb), k) },
        { kind: 'act', d: 0.2, pose: 'sweep', dmg: 1, boxes: bb => [sweepBox2(bb)], start: bb => { S.fx.shake(5, 0.25); S.audio.explosion(0.6, 0.7); S.projs.push(new Projectile({ owner: 'enemy', kind: 'shock', x: bb.x + bb.face * 60, y: bb.y - 9, vx: bb.face * 150, w: 16, h: 18, dmg: 1, life: 2.4, color: C.crim })); } },
        { kind: 'rec', d: 0.85, pose: 'idle' }],
      leap: b => [
        { kind: 'tele', d: 0.6, pose: 'leap', start: bb => S.fx.dust(bb.x, bb.y, 6) },
        { kind: 'act', d: 0.4, pose: 'leap_air', tick: (bb, a) => { const k = a.t / a.dur; bb.lift = (1 - (1 - k) * (1 - k)) * 240; }, end: bb => { bb.hidden = true; S.fx.shake(2, 0.2); } },
        { kind: 'act', d: 0.95, pose: 'leap_air', start: bb => { bb.mx = S.player.x; }, tick: (bb, a, dt) => { if (a.t < a.dur - 0.32) bb.mx += clamp(S.player.x - bb.mx, -95 * dt * bb.tf, 95 * dt * bb.tf); bb.mx = clamp(bb.mx, 40, S.stage.width - 40); bb.lastLocked = a.t >= a.dur - 0.32; },
          warn: (g, cx, bb, a) => { const k = Math.min(1, a.t / a.dur), x = Math.round(bb.mx - cx), flick = Math.floor(performance.now() / 60) % 2; g.fillStyle = bb.lastLocked ? C.white : C.crimHi; g.globalAlpha = 0.25 + 0.5 * k; for (let i = 0; i < 36; i++) { const an = i / 36 * Math.PI * 2; if ((i + flick) % 2 === 0) g.fillRect(Math.round(x + Math.cos(an) * 38), Math.round(S.stage.ground - 1 + Math.sin(an) * 7), 2, 1); } g.fillRect(x - 38, S.stage.ground - 1, 76, 1); g.globalAlpha = 1; } },
        { kind: 'act', d: 0.14, pose: 'slam', dmg: 2, knock: 170, boxes: (bb, a) => (a.t > 0.06 ? [{ x: bb.mx - 38, y: S.stage.ground - 30, w: 76, h: 30 }] : []),
          start: bb => { bb.x = bb.mx; bb.hidden = false; }, tick: (bb, a) => { bb.lift = 240 * Math.max(0, 1 - a.t / 0.1); },
          end: bb => { bb.lift = 0; S.fx.shake(10, 0.55); S.fx.dust(bb.x, bb.y, 14); S.fx.ring(bb.x, bb.y - 2, 4, 60, 0.4, C.crimHi, 2); S.audio.impact(); S.audio.explosion(1, 0.5); for (const d of [-1, 1]) S.projs.push(new Projectile({ owner: 'enemy', kind: 'shock', x: bb.x + d * 40, y: bb.y - 9, vx: d * 140, w: 16, h: 18, dmg: 1, life: 2.2, color: C.crim })); } },
        { kind: 'rec', d: 1.0, pose: 'slam' }],
      lightning: b => [
        { kind: 'tele', d: 0.8, pose: 'cast', start: (bb, a) => { const P = S.player, xs = [P.x, P.x - 76, P.x + 76]; bb.wave1 = xs; for (const x of xs) S.hazards.push(new Hazard({ x: clamp(x, 16, S.stage.width - 16), y: S.stage.ground, w: 18, h: 150, warn: a.dur, active: 0.3, kind: 'lightning', dmg: 1 })); } },
        { kind: 'act', d: 0.5, pose: 'cast', start: (bb, a) => { S.fx.flash(C.white, 0.35, 0.2); S.audio.thunder(1); for (const x of bb.wave1.map(v => v + 38)) S.hazards.push(new Hazard({ x: clamp(x, 16, S.stage.width - 16), y: S.stage.ground, w: 18, h: 150, warn: 0.6, active: 0.3, kind: 'lightning', dmg: 1 })); } },
        { kind: 'rec', d: 1.0, pose: 'idle', start: () => { S.fx.flash(C.white, 0.3, 0.2); S.audio.thunder(1.3); } }],
      orbs: b => [
        { kind: 'tele', d: 0.6, pose: 'cast' },
        { kind: 'act', d: 0.2, pose: 'cast', start: bb => {
          const P = S.player, hx = bb.x + bb.face * 34, hy = bb.y - 96, base = clamp((P.x - hx) * 0.9, -170, 170);
          for (let i = 0; i < 5; i++) S.projs.push(new Projectile({ owner: 'enemy', kind: 'orb', x: hx, y: hy, vx: base + (i - 2) * 42, vy: -120 - Math.abs(i - 2) * 10, grav: 230, w: 10, h: 10, dmg: 1, life: 4 }));
          S.audio.play('sfx_shadow_cast', { volume: 0.8, rate: 0.6 }); S.fx.burst(hx, hy, 14, { colors: [C.flame, C.flame2, C.white], speed: 70, life: 0.4 });
        } },
        { kind: 'rec', d: 0.8, pose: 'idle' }],
    };
    this.afterAttack = () => { if (this.phase >= 3 && rng() < 0.5 && !this.chained) { this.chained = true; this.idleT = 0; } else this.chained = false; };
  }
  box() { return { x: this.x - 22, y: this.y - this.lift - 84, w: 44, h: 84 }; }
  cyPos() { return this.y - this.lift - 46; }
  drawY() { return this.y - this.lift; }
  spawnTick() {
    this.alpha = clamp(this.stT / 1.6, 0, 1); this.faceTo(this.S.player.x);
    if (Math.floor((this.stT - 0.016) * 14) !== Math.floor(this.stT * 14)) this.S.fx.burst(this.x, this.y - 20, 2, { colors: [C.crim, C.flame, C.flame2], speed: 50, up: 60, grav: -50, life: 0.7, jx: 24 });
    if (this.stT > 2.2 && !this._thunder) { this._thunder = true; this.S.audio.thunder(1); this.S.fx.flash(C.white, 0.5, 0.3); }
  }
  idleTick(dt) {
    const S = this.S, P = S.player; this.faceTo(P.x); const d = Math.abs(P.x - this.x); this.moving = false;
    if (d > 62) { this.x = clamp(this.x + this.face * (34 + 14 * (this.phase - 1)) * this.tf * dt, 30, S.stage.width - 30); this.moving = true; }
    this.idleT -= dt;
    if (this.idleT <= 0) {
      const near = d < 100, p = this.phase;
      const opts = near ? [['sweep', 4], ['decree', 2], ['leap', 2]] : [['decree', 3], ['leap', 3], ['sweep', 1]];
      if (p >= 2) opts.push(['lightning', 3], ['orbs', near ? 1 : 2]);
      let k = weighted(opts); if (k === this.lastAtk && rng() < 0.7) k = weighted(opts);
      this.startAttack(k);
    }
  }
  contactActive() { return super.contactActive() && this.lift < 6; }
  get vulnerable() { return !this.hidden && super.vulnerable; }
  pose() {
    if (this.state === 'spawn') return [this.stT < 2.2 ? 'idle' : 'cast'];
    if (this.state === 'attack') return [this.curBeat().pose || 'idle'];
    if (this.state === 'stagger') return ['stagger'];
    if (this.state === 'transition') return ['transform'];
    if (this.state === 'dying') return [this.stT < 0.5 ? 'stagger' : 'dead'];
    return [this.moving ? 'walk' : 'idle'];
  }
  transitionTime(p) { return p === 2 ? 3.4 : 2.2; }
  onTransition(p) { this.formSwapped = false; if (p === 2) { this.S.audio.thunder(0.8); } else { this.tint = 1; } }
  transTick(dt) {
    const S = this.S; this.faceTo(S.player.x);
    if (this.phase === 2 && !this.formSwapped && this.stT > 1.7) { this.formSwapped = true; this.extra = { form: 2 }; this.tf = 1.2; S.fx.flash(C.white, 0.9, 0.5); S.fx.shake(9, 0.6); S.audio.thunder(0.7); S.fx.burst(this.x, this.y - 50, 40, { colors: [C.crimHi, C.flame2, C.white, C.crim], speed: 200, grav: 40, life: 0.8 }); }
    if (this.phase === 3 && !this.formSwapped) { this.formSwapped = true; this.tf = 1.45; S.audio.thunder(0.7); S.fx.flash(C.crimHi, 0.6, 0.4); }
    if (Math.floor((this.stT - 0.016) * 5) !== Math.floor(this.stT * 5)) { S.fx.flash(C.white, 0.25, 0.15); if (this.stT > 0.4) S.audio.thunder(1.2); }
    if (Math.floor((this.stT - 0.016) * 16) !== Math.floor(this.stT * 16)) S.fx.burst(this.x + rand(-20, 20), this.y - rand(20, 90), 3, { colors: [C.crimHi, C.flame2, C.white], speed: 90, up: 40, grav: -30, life: 0.6 });
  }
  afterTransition() { if (this.phase === 3) this.tint = 1; }
}

export function createBoss(S, def) {
  if (def.id === 'hollow_knight') return new HollowKnight(S, def);
  if (def.id === 'abyssal_wraith') return new AbyssalWraith(S, def);
  return new FallenSovereign(S, def);
}
