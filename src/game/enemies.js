// Lesser enemies: ghoul (ground patrol, telegraphed swipe) and wisp (floating homing flame).
import { C } from '../art/palette.js';
import { drawFrame } from '../art/sprites.js';
import { approach, rand } from '../core/util.js';

class Enemy {
  constructor(S) { this.S = S; this.alive = true; this.dying = false; this.deadT = 0; this.flashT = 0; this.knockT = 0; this.t = 0; this.vx = 0; this.vy = 0; this.face = -1; this.contact = 1; this.id = Enemy.n = (Enemy.n || 0) + 1; }
  box() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  takeHit(dmg, srcX, opts = {}) {
    if (this.dying) return false;
    this.hp -= dmg; this.flashT = 0.1; this.knockT = 0.18; const dir = this.x >= srcX ? 1 : -1; this.vx = dir * (opts.knock || 120); if (this.fly) this.vy = -30; else this.vy = -80;
    this.S.fx.burst(this.x, this.y - this.h / 2, 7, { colors: [C.lav2, C.white, C.violet2], speed: 90, grav: 180, life: 0.35 });
    if (this.hp <= 0) this.die();
    return true;
  }
  die() { this.dying = true; this.deadT = 0; this.S.onEnemyKilled(this); }
}

export class Ghoul extends Enemy {
  constructor(S, def) {
    super(S); Object.assign(this, { kind: 'ghoul', x: def.x, y: S.stage.ground, w: 14, h: 24, hp: 6, range: def.r || [def.x - 80, def.x + 80], state: 'patrol', face: Math.random() < 0.5 ? -1 : 1, stT: 0, hitDone: false, atk: null, idleT: 0 });
  }
  update(dt) {
    const S = this.S, P = S.player, st = S.stage; this.t += dt; if (this.flashT > 0) this.flashT -= dt;
    if (this.dying) { this.deadT += dt; this.vx = approach(this.vx, 0, 400 * dt); this.vy += 900 * dt; st.move(this, dt); if (this.deadT > 0.55) this.alive = false; return; }
    this.vy = Math.min(this.vy + 900 * dt, 400);
    if (this.knockT > 0) { this.knockT -= dt; st.move(this, dt); this.vx = approach(this.vx, 0, 500 * dt); return; }
    const dx = P.x - this.x, ady = Math.abs(P.y - this.y), near = Math.abs(dx) < 105 && ady < 34 && !P.dead;
    this.stT += dt;
    if (this.state === 'patrol') {
      this.vx = this.face * 24;
      if (this.x < this.range[0]) this.face = 1; else if (this.x > this.range[1]) this.face = -1;
      else if (!st.floorAt(this.x + this.face * 12, this.y, 10) && this.onGround) this.face *= -1;
      if (this.hitWall) this.face = -this.face;
      if (near) { this.state = 'chase'; this.stT = 0; S.fx.burst(this.x, this.y - 26, 3, { colors: [C.crimHi], speed: 20, grav: -30, life: 0.4 }); }
    } else if (this.state === 'chase') {
      this.face = dx > 0 ? 1 : -1; this.vx = this.face * 52;
      if (!st.floorAt(this.x + this.face * 12, this.y, 10) && this.onGround) this.vx = 0;
      if (Math.abs(dx) < 26 && ady < 24) { this.state = 'tele'; this.stT = 0; this.vx = 0; this.hitDone = false; }
      else if (!near && this.stT > 2) { this.state = 'patrol'; this.stT = 0; }
    } else if (this.state === 'tele') {                                     // visible wind-up: arm drawn back, flicker
      this.vx = 0; if (this.stT >= 0.42) { this.state = 'strike'; this.stT = 0; }
    } else if (this.state === 'strike') {
      this.vx = this.face * 26;
      if (!this.hitDone && this.stT > 0.02 && this.stT < 0.14) { const b = this.strikeBox(); if (S.overlapPlayer(b)) { if (P.hurt(1, this.x)) this.hitDone = true; } }
      if (this.stT >= 0.16) { this.state = 'recover'; this.stT = 0; this.vx = 0; }
    } else if (this.state === 'recover') { this.vx = 0; if (this.stT >= 0.55) { this.state = 'chase'; this.stT = 0; } }
    st.move(this, dt);
    if (this.state !== 'tele' && this.state !== 'strike' && S.overlapPlayer(this.box())) P.hurt(this.contact, this.x);
  }
  strikeBox() { return { x: this.face > 0 ? this.x + 2 : this.x - 28, y: this.y - 24, w: 26, h: 20 }; }
  draw(g, camX) {
    const E = this.S.spr.enemy.ghoul; let f;
    if (this.state === 'tele') f = E.attack[0]; else if (this.state === 'strike') f = E.attack[this.stT > 0.06 ? 2 : 1];
    else if (this.state === 'recover') f = E.attack[2]; else if (this.state === 'patrol' || this.state === 'chase') f = E.walk[Math.floor(this.t * (this.state === 'chase' ? 9 : 5)) % 4]; else f = E.idle[0];
    const alpha = this.dying ? Math.max(0, 1 - this.deadT / 0.55) : 1, shake = this.state === 'tele' ? (Math.floor(this.t * 40) % 2 ? 1 : -1) : 0;
    drawFrame(g, f, this.x - camX + shake, this.y, this.face < 0, this.flashT > 0, alpha);
    if (this.state === 'tele') { g.fillStyle = C.crimHi; g.fillRect(Math.round(this.x - camX) - 1, Math.round(this.y - 34), 2, 5); g.fillRect(Math.round(this.x - camX) - 1, Math.round(this.y - 27), 2, 2); }   // "!" over its head
  }
}

export class Wisp extends Enemy {
  constructor(S, def) {
    super(S); Object.assign(this, { kind: 'wisp', fly: true, x: def.x, cy: def.y, ox: def.x, oy: def.y, w: 12, h: 12, hp: 4, speed: def.fast ? 46 : 32, summoned: !!def.fast, y: def.y + 6, spawnT: def.fast ? 0.6 : 0 });
  }
  box() { return { x: this.x - 6, y: this.cy - 6, w: 12, h: 12 }; }
  update(dt) {
    const S = this.S, P = S.player; this.t += dt; if (this.flashT > 0) this.flashT -= dt;
    if (this.dying) { this.deadT += dt; this.cy -= 20 * dt; if (this.deadT > 0.4) this.alive = false; return; }
    if (this.spawnT > 0) { this.spawnT -= dt; return; }
    if (this.knockT > 0) { this.knockT -= dt; this.x += this.vx * dt; this.cy += this.vy * dt; this.vx = approach(this.vx, 0, 400 * dt); this.vy = approach(this.vy, 0, 400 * dt); return; }
    const dx = P.x - this.x, dy = (P.y - 12) - this.cy, d = Math.hypot(dx, dy);
    if (d < (this.summoned ? 400 : 130) && !P.dead) { this.x += (dx / d) * this.speed * dt; this.cy += (dy / d) * this.speed * 0.8 * dt; this.face = dx > 0 ? 1 : -1; }
    else { this.x = this.ox + Math.sin(this.t * 1.1) * 26; this.cy = this.oy + Math.sin(this.t * 1.7) * 10; }
    this.y = this.cy + 6;
    if (S.overlapPlayer(this.box())) P.hurt(1, this.x);
  }
  takeHit(dmg, srcX, o) { const r = super.takeHit(dmg, srcX, o); return r; }
  draw(g, camX) {
    const f = this.S.spr.enemy.wisp.fly[Math.floor(this.t * 9) % 4], a = this.spawnT > 0 ? 0.35 + Math.floor(this.t * 20) % 2 * 0.3 : this.dying ? Math.max(0, 1 - this.deadT / 0.4) : 1;
    drawFrame(g, f, this.x - camX, this.cy + 1, false, this.flashT > 0, a);
  }
}

export class Pickup {                           // dropped "vessel": restores one mask
  constructor(S, x, y) { this.S = S; this.x = x; this.y = y; this.vy = -120; this.t = 0; this.alive = true; this.w = 10; this.h = 10; }
  update(dt) {
    const st = this.S.stage; this.t += dt; this.vy += 700 * dt; this.y += this.vy * dt;
    for (const s of st.solids) if (s.kind !== 'platform' || this.vy > 0) if (s.active !== false && this.x > s.x && this.x < s.x + s.w && this.y >= s.y && this.y - this.vy * dt <= s.y + 2) { this.y = s.y; this.vy = 0; }
    const P = this.S.player; if (!P.dead && Math.abs(P.x - this.x) < 10 && Math.abs((P.y - 10) - (this.y - 5)) < 14 && P.hp < P.maxHp) { P.heal(1); this.alive = false; this.S.audio.heal(); this.S.fx.burst(this.x, this.y - 6, 10, { colors: [C.lav2, C.white, C.violet2], speed: 60, grav: -40, life: 0.5 }); }
    if (this.t > 20) this.alive = false;
  }
  draw(g, camX) { const x = Math.round(this.x - camX), y = Math.round(this.y - 5 - Math.sin(this.t * 4) * 1.5); g.drawImage(this.S.spr.icons.heartFull, x - 4, y - 4); g.fillStyle = C.lav2; g.globalAlpha = 0.5 + 0.4 * Math.sin(this.t * 6); g.fillRect(x - 6 + Math.floor(this.t * 5) % 3 * 5, y - 7, 1, 1); g.globalAlpha = 1; }
}
