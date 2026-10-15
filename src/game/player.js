// The hooded wanderer: movement, combat with explicit hit windows, dash, special, damage and death.
import { C } from '../art/palette.js';
import { drawFrame } from '../art/sprites.js';
import { clamp, approach, overlap } from '../core/util.js';
import { Projectile } from './projectiles.js';

export const PCFG = {
  w: 10, h: 22, walk: 62, run: 112, accel: 820, airAccel: 560, friction: 1000, gravity: 960, jumpV: -322, cutV: -120, maxFall: 430,
  coyote: 0.1, buffer: 0.12, actBuffer: 0.14, turnBoost: 1.7, runAfter: 0.3, dashSpeed: 235, dashTime: 0.17, dashCd: 0.55, dashInv: 0.24,
  hurtStun: 0.28, invuln: 1.3, maxEnergy: 100, specialCost: 30, energyRegen: 3.5,
};
// attack timing: frame durations; frames 2 and 3 are the ONLY ones that can hurt anything (explicit hit window)
const ATK_DUR = [0.07, 0.05, 0.04, 0.05, 0.13];
const ATK_TOTAL = ATK_DUR.reduce((a, b) => a + b, 0);
const ATK_HIT_FROM = ATK_DUR[0] + ATK_DUR[1], ATK_HIT_TO = ATK_HIT_FROM + ATK_DUR[2] + ATK_DUR[3];
const SP_DUR = [0.12, 0.1, 0.1, 0.12];

export class Player {
  constructor(S) { this.S = S; this.w = PCFG.w; this.h = PCFG.h; this.maxHp = 5; this.trail = []; this.reset(40, 150); }
  reset(x, y, hp) {
    Object.assign(this, { x, y, vx: 0, vy: 0, face: 1, onGround: false, state: 'idle', hp: hp ?? this.maxHp, energy: 60, iframes: 0, stun: 0, coyote: 0, runT: 0, dashT: 0, dashCd: 0, dashDir: 1, airDashUsed: false,
      atkT: 0, atkIdx: 0, atkQueued: false, atkHit: new Set(), atkFrame: -1, spT: 0, spFrame: -1, landT: 0, turnT: 0, deadT: 0, animT: 0, flashT: 0, jumpCut: false, stepDist: 0, safe: [], safeT: 0, fallDamageT: 0, wasGround: false, lastVy: 0, dead: false, hitPauseT: 0, trail: [], dashInvT: 0, sinceAtk: 9, deadNotified: false });
  }
  box() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  attackBox() { return { x: this.face > 0 ? this.x + 1 : this.x - 31, y: this.y - 28, w: 30, h: 24 }; }
  get attacking() { return this.state === 'attack'; }
  get invulnerable() { return this.iframes > 0 || this.dashT > 0 && this.dashInvT > 0; }

  hurt(dmg, srcX, opts = {}) {
    if (this.dead || this.iframes > 0 || this.dashInvT > 0) return false;
    const S = this.S; this.hp = Math.max(0, this.hp - dmg);
    S.fx.stop(0.09); S.fx.shake(4, 0.25); S.fx.flash(C.crim, 0.28, 0.2); S.fx.burst(this.x, this.y - 12, 12, { colors: [C.crimHi, C.lav2, C.white], speed: 120, grav: 200, life: 0.45 });
    S.audio.hurt();
    this.state = 'hurt'; this.stun = PCFG.hurtStun; this.iframes = PCFG.invuln; this.flashT = 0.1; this.dashT = 0; this.atkT = 0; this.spT = 0; this.atkFrame = -1;
    const dir = (srcX === undefined ? -this.face : (this.x >= srcX ? 1 : -1)); this.vx = dir * (opts.knock || 130); this.vy = -110; this.onGround = false;
    if (this.hp <= 0) this.die();
    return true;
  }
  die() {
    if (this.dead) return; this.dead = true; this.deadT = 0; this.state = 'dead'; this.vx = this.vx * 0.5;
    this.S.audio.death(); this.S.fx.slow(0.35, 1.0); this.S.fx.flash(C.black, 0.5, 0.6);
  }
  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }

  update(dt) {
    const S = this.S, I = S.input, st = S.stage;
    this.animT += dt; if (this.flashT > 0) this.flashT -= dt; if (this.state !== 'attack') this.sinceAtk += dt;
    if (this.dead) {
      this.deadT += dt; this.vy = Math.min(this.vy + PCFG.gravity * dt, PCFG.maxFall); this.vx = approach(this.vx, 0, 400 * dt); st.move(this, dt);
      if (this.deadT > 1.9 && !this.deadNotified) { this.deadNotified = true; S.onPlayerDead(); }
      return;
    }
    if (this.iframes > 0) this.iframes -= dt; if (this.dashCd > 0) this.dashCd -= dt; if (this.landT > 0) this.landT -= dt; if (this.turnT > 0) this.turnT -= dt;
    if (this.dashInvT > 0) this.dashInvT -= dt;
    this.energy = Math.min(PCFG.maxEnergy, this.energy + PCFG.energyRegen * dt);

    if (this.stun > 0) {                         // hurt: no control, knocked back
      this.stun -= dt; this.vx = approach(this.vx, 0, 300 * dt); this.vy = Math.min(this.vy + PCFG.gravity * dt, PCFG.maxFall); st.move(this, dt);
      if (this.stun <= 0) this.state = 'idle';
      return;
    }
    const axis = I.axis();

    /* ---- dash (can cancel the recovery of an attack, never the hit window) ---- */
    const inHitWindow = this.state === 'attack' && this.atkT >= ATK_HIT_FROM && this.atkT < ATK_HIT_TO;
    if (I.since('dash') < PCFG.actBuffer && this.dashCd <= 0 && this.dashT <= 0 && !inHitWindow && (this.onGround || !this.airDashUsed)) {
      this.dashT = PCFG.dashTime; this.dashInvT = PCFG.dashInv; this.dashCd = PCFG.dashCd; this.dashDir = axis || this.face; this.face = this.dashDir;
      if (!this.onGround) this.airDashUsed = true;
      this.state = 'dash'; this.atkT = 0; this.atkFrame = -1; this.spT = 0; this.spFrame = -1; this.vy = 0;
      S.audio.dash(); S.fx.dust(this.x, this.y, 5, -this.dashDir); I.consume('dash');
    }
    if (this.dashT > 0) {
      this.dashT -= dt; this.vx = this.dashDir * PCFG.dashSpeed; this.vy = 0;
      this.trailT = (this.trailT || 0) - dt; if (this.trailT <= 0) { this.trailT = 0.035; this.trail.push({ x: this.x, y: this.y, face: this.face, a: 0.55 }); }
      if (this.dashT <= 0) { this.vx = this.dashDir * 80; this.state = 'idle'; }
    }
    for (let i = this.trail.length - 1; i >= 0; i--) { const t = this.trail[i]; t.a -= dt * 2.6; if (t.a <= 0) this.trail.splice(i, 1); }

    /* ---- attack ---- */
    if (this.dashT <= 0) {
      // presses are buffered for actBuffer seconds, so an input made a moment too early (during recovery, a hop, a stun) is not lost
      if (I.since('attack') < PCFG.actBuffer) {
        if (this.state !== 'attack' && this.state !== 'special') { this.startAttack(this.recentAttack() ? this.atkIdx ^ 1 : 0); I.consume('attack'); }
        else if (this.state === 'attack') { this.atkQueued = true; I.consume('attack'); }
      }
      if (I.since('special') < PCFG.actBuffer && this.state !== 'special' && !inHitWindow && this.energy >= PCFG.specialCost) { this.startSpecial(); I.consume('special'); }
    }
    if (this.state === 'attack') this.updateAttack(dt);
    if (this.state === 'special') this.updateSpecial(dt);

    /* ---- horizontal movement ---- */
    const locked = this.state === 'attack' || this.state === 'special';
    if (this.dashT <= 0) {
      if (locked) {
        if (this.state === 'attack' && this.atkFrame >= 2 && this.atkFrame <= 3 && this.onGround) this.vx = this.face * 58;     // small lunge on the swing
        else this.vx = approach(this.vx, 0, PCFG.friction * 0.7 * dt);
      } else if (axis !== 0) {
        if (axis !== this.face && this.onGround && Math.abs(this.vx) > 35) this.turnT = 0.07;
        this.face = axis;
        this.runT = (this.onGround && Math.sign(this.vx) === axis) ? this.runT + dt : (this.onGround ? 0 : this.runT);
        const target = axis * (this.runT > PCFG.runAfter ? PCFG.run : PCFG.walk);
        const rev = Math.sign(this.vx) === -axis ? PCFG.turnBoost : 1;      // snappier direction changes without a hard snap
        this.vx = approach(this.vx, target, (this.onGround ? PCFG.accel : PCFG.airAccel) * rev * dt);
      } else { this.runT = 0; this.vx = approach(this.vx, 0, (this.onGround ? PCFG.friction : PCFG.airAccel * 0.6) * dt); }
    }

    /* ---- jump: coyote time + buffered press + variable height ---- */
    if (this.onGround) this.coyote = PCFG.coyote; else this.coyote -= dt;
    if (I.since('jump') < PCFG.buffer && this.coyote > 0 && (this.state !== 'attack' || this.atkT >= ATK_HIT_TO) && this.state !== 'special' && this.dashT <= 0) {
      if (this.state === 'attack') { this.atkT = 0; this.atkFrame = -1; this.atkQueued = false; }      // jump may cancel sword RECOVERY only, never the hit window
      this.vy = PCFG.jumpV; this.coyote = 0; this.onGround = false; this.jumpCut = false; I.consume('jump'); this.state = 'jump';
      S.audio.jump(); S.fx.dust(this.x, this.y, 3);
    }
    if (!I.down('jump') && this.vy < PCFG.cutV && !this.jumpCut) { this.vy = PCFG.cutV; this.jumpCut = true; }
    if (this.dashT <= 0) this.vy = Math.min(this.vy + PCFG.gravity * dt, PCFG.maxFall);

    /* ---- physics ---- */
    this.lastVy = this.vy; this.wasGround = this.onGround;
    st.move(this, dt);
    if (this.onGround && !this.wasGround) {
      this.airDashUsed = false; this.jumpCut = false;
      if (this.lastVy > 200) { this.landT = 0.1; S.fx.dust(this.x, this.y, 5); S.audio.land(clamp(this.lastVy / 350, 0.4, 1)); }
    }
    if (this.onGround && Math.abs(this.vx) > 12 && !locked) { this.stepDist += Math.abs(this.vx) * dt; if (this.stepDist > (Math.abs(this.vx) > 85 ? 20 : 15)) { this.stepDist = 0; S.audio.step(Math.abs(this.vx) > 85); } }
    // remember safe ground for pit recovery
    if (this.onGround && this.dashT <= 0) { this.safeT -= dt; if (this.safeT <= 0 && st.floorAt(this.x - 9, this.y, 4) && st.floorAt(this.x + 9, this.y, 4)) { this.safeT = 0.2; this.safe.push({ x: this.x, y: this.y }); if (this.safe.length > 6) this.safe.shift(); } }
    if (this.y > 215) this.fellInPit();
    if (this.state !== 'attack' && this.state !== 'special' && this.dashT <= 0 && this.state !== 'hurt') this.state = !this.onGround ? (this.vy < 0 ? 'jump' : 'fall') : 'idle';
  }
  recentAttack() { return this.sinceAtk < 0.4; }
  fellInPit() {
    const sp = this.safe.length ? this.safe[0] : { x: this.S.stage.def.entry, y: this.S.stage.ground };
    this.x = sp.x; this.y = sp.y - 1; this.vx = 0; this.vy = 0; this.safe = [sp];
    this.S.audio.hurt(); this.S.fx.flash(C.black, 0.6, 0.35);
    this.hp = Math.max(0, this.hp - 1); this.iframes = 1.0; if (this.hp <= 0) this.die();
  }

  startAttack(idx) {
    this.state = 'attack'; this.atkIdx = idx; this.atkT = 0; this.atkQueued = false; this.atkHit = new Set(); this.atkFrame = -1; this.sinceAtk = 0;
  }
  updateAttack(dt) {
    this.atkT += dt; this.sinceAtk = 0;
    let f = 0, acc = 0; while (f < 4 && this.atkT >= acc + ATK_DUR[f]) { acc += ATK_DUR[f]; f++; }
    if (this.atkT >= ATK_TOTAL) {
      if (this.atkQueued) this.startAttack(this.atkIdx ^ 1); else { this.state = this.onGround ? 'idle' : 'fall'; this.atkFrame = -1; this.sinceAtk = 0; this.atkEnded = true; }
      return;
    }
    if (f !== this.atkFrame) {
      this.atkFrame = f;
      if (f === 2) this.S.audio.swing(this.atkIdx);
    }
    // ---- the only place sword damage is applied: frames 2-3, once per target per swing ----
    if (this.atkT >= ATK_HIT_FROM && this.atkT < ATK_HIT_TO) this.S.resolvePlayerSwing(this.attackBox(), this.atkHit, 2);
  }
  startSpecial() {
    this.energy -= PCFG.specialCost; this.state = 'special'; this.spT = 0; this.spFrame = -1; this.vx *= 0.3; this.dashT = 0;
    this.S.audio.special(); this.S.fx.burst(this.x + this.face * 12, this.y - 14, 10, { colors: [C.violet2, C.flame, C.lav2], speed: 50, grav: -30, life: 0.3 });
  }
  updateSpecial(dt) {
    this.spT += dt; let f = 0, acc = 0; while (f < 3 && this.spT >= acc + SP_DUR[f]) { acc += SP_DUR[f]; f++; }
    if (this.spT >= SP_DUR.reduce((a, b) => a + b, 0)) { this.state = this.onGround ? 'idle' : 'fall'; this.spFrame = -1; return; }
    if (f !== this.spFrame) {
      this.spFrame = f;
      if (f === 2) {
        this.S.projs.push(new Projectile({ owner: 'player', kind: 'wave', x: this.x + this.face * 16, y: this.y - 14, vx: this.face * 210, w: 18, h: 14, dmg: 4, life: 1.5, pierce: true, face: this.face }));
        this.S.fx.shake(1.5, 0.12); this.S.fx.ring(this.x + this.face * 14, this.y - 14, 2, 14, 0.22, C.lav2);
      }
    }
  }

  animation() {
    const A = this.S.spr.player;
    if (this.dead) return [A.dead, Math.min(5, Math.floor(this.deadT / 0.16))];
    if (this.state === 'hurt') return [A.hurt, 0];
    if (this.dashT > 0) return [A.dash, Math.floor(this.animT * 20) % 2];
    if (this.state === 'special') return [A.special, Math.max(0, this.spFrame)];
    if (this.state === 'attack') return [this.atkIdx ? A.attack2 : A.attack1, Math.max(0, this.atkFrame)];
    if (!this.onGround) return this.vy < 0 ? [A.jump, this.vy < -150 ? 0 : 1] : [A.fall, this.vy > 260 ? 1 : 0];
    if (this.landT > 0) return [A.land, this.landT > 0.05 ? 0 : 1];
    if (this.turnT > 0) return [A.turn, 0];
    const sp = Math.abs(this.vx);
    if (sp > 90) return [A.run, Math.floor(this.animT * 14) % 6];
    if (sp > 8) return [A.walk, Math.floor(this.animT * (6 + sp / 14)) % 6];
    return [A.idle, Math.floor(this.animT * 4.5) % 4];
  }
  draw(g, camX) {
    const S = this.S, A = S.spr;
    for (const t of this.trail) { const [fr, i] = [A.player.dash, 0]; drawFrame(g, fr[i], t.x - camX, t.y, t.face < 0, false, Math.max(0, t.a) * 0.6); }
    const blink = this.iframes > 0 && !this.dead && Math.floor(this.animT * 22) % 2 === 0 && this.state !== 'hurt';
    const [frames, i] = this.animation();
    drawFrame(g, frames[Math.min(i, frames.length - 1)], this.x - camX, this.y, this.face < 0, this.flashT > 0, blink ? 0.35 : 1);
    if (this.state === 'attack' && this.atkFrame >= 2) {
      const k = Math.min(2, this.atkFrame - 2 + (this.atkFrame === 4 ? 0 : 0)), set = this.atkIdx ? A.slash.b : A.slash.a;
      drawFrame(g, set[k], this.x + this.face * 7 - camX, this.y - 15, this.face < 0, false, this.atkFrame === 4 ? 0.6 : 1);
    }
    if (this.state === 'special' && this.spFrame >= 1) { g.fillStyle = C.flame2; g.globalAlpha = 0.5; const r = this.spFrame * 3; g.fillRect(Math.round(this.x + this.face * 14 - camX - r), Math.round(this.y - 15 - r), r * 2, r * 2); g.globalAlpha = 1; }
  }
}
