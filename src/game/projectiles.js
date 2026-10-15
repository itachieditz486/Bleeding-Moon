// Player + enemy projectiles and telegraphed hazards (flame pillars, spears, lightning, markers).
import { C } from '../art/palette.js';
import { overlap, rand } from '../core/util.js';

export class Projectile {
  /** kind: wave | bolt | shock | orb. owner: 'player' | 'enemy' */
  constructor(o) { Object.assign(this, { x: 0, y: 0, vx: 0, vy: 0, w: 8, h: 8, dmg: 1, owner: 'enemy', kind: 'bolt', life: 3, grav: 0, pierce: false, hit: new Set(), dead: false, t: 0, face: 1, color: C.flame }, o); }
  box() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }
  update(dt, stage, fx) {
    this.t += dt; this.life -= dt; this.vy += this.grav * dt; this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.life <= 0 || this.x < -30 || this.x > stage.width + 30 || this.y > 220 || this.y < -60) this.dead = true;
    if (this.kind === 'shock') { this.y = stage.ground - this.h / 2; if (stage.width && (this.x < 6 || this.x > stage.width - 6)) this.dead = true; if (Math.random() < 0.5) fx.burst(this.x, stage.ground - 2, 1, { colors: [this.color, C.white], speed: 40, up: 30, grav: 120, life: 0.25 }); }
    if (this.kind === 'orb' && this.y >= stage.ground - 3) { this.dead = true; fx.burst(this.x, stage.ground - 2, 8, { colors: [C.flame, C.flame2, C.white], speed: 70, up: 40, life: 0.4 }); this.landed = true; }
    if (this.kind === 'wave' && Math.random() < 0.8) fx.burst(this.x - this.face * 6, this.y + rand(-5, 5), 1, { colors: [C.violet2, C.lav, C.flame2], speed: 14, grav: 0, life: 0.3 });
    if (this.kind === 'bolt' && Math.random() < 0.6) fx.burst(this.x, this.y, 1, { colors: [C.violet, C.violet2], speed: 10, grav: 0, life: 0.3 });
  }
  draw(g, camX) {
    const x = Math.round(this.x - camX), y = Math.round(this.y);
    if (this.kind === 'wave') {
      const f = Math.floor(this.t * 20) % 2, d = this.face;
      g.fillStyle = C.violet; g.fillRect(x - 8 * d - (d < 0 ? 0 : 0), y - 7, 8, 14);
      for (let i = 0; i < 9; i++) { const hh = 14 - Math.abs(i - 4) * 2 + f; g.fillStyle = i > 5 ? C.white : i > 2 ? C.lav2 : C.violet2; g.fillRect(x + d * (i - 3) - (d < 0 ? 1 : 0), y - (hh >> 1), 1, hh); }
      g.fillStyle = C.flame; g.globalAlpha = 0.6; g.fillRect(x - d * 12, y - 3, 8, 6); g.globalAlpha = 1;
    } else if (this.kind === 'bolt') {
      g.fillStyle = C.violet; g.fillRect(x - 5, y - 5, 10, 10); g.fillStyle = C.black; g.fillRect(x - 4, y - 4, 8, 8);
      g.fillStyle = C.violet2; g.fillRect(x - 3, y - 3, 6, 6); g.fillStyle = C.flame2; g.fillRect(x - 2, y - 2, 4, 4); g.fillStyle = C.white; g.fillRect(x - 1, y - 1, 2, 2);
    } else if (this.kind === 'orb') {
      g.fillStyle = C.violet2; g.fillRect(x - 6, y - 6, 12, 12); g.fillStyle = C.flame; g.fillRect(x - 5, y - 5, 10, 10); g.fillStyle = C.flame2; g.fillRect(x - 3, y - 4, 6, 6); g.fillStyle = C.white; g.fillRect(x - 1, y - 2, 2, 3);
      g.fillStyle = C.flame; g.fillRect(x - 2 + (Math.floor(this.t * 12) % 3 - 1) * 2, y - 9, 2, 3);
    } else if (this.kind === 'shock') {
      const hh = this.h, d = this.vx > 0 ? 1 : -1;
      g.fillStyle = this.color; g.fillRect(x - 5, y - hh / 2, 10, hh);
      g.fillStyle = C.crimHi; g.fillRect(x - 3 + d * 2, y - hh / 2 - 2, 4, hh + 2);
      g.fillStyle = C.white; g.fillRect(x - 1 + d * 3, y - hh / 2 + 2, 2, hh - 4);
      g.fillStyle = C.black; g.fillRect(x - d * 6, y - 2, 4, 2);
    }
  }
}

/** A vertical or box hazard with a readable warning phase, a short active phase and a fade. */
export class Hazard {
  constructor(o) { Object.assign(this, { x: 0, y: 0, w: 16, h: 150, warn: 0.8, active: 0.3, dmg: 1, kind: 'pillar', t: 0, dead: false, hit: false, sfxFired: false }, o); }
  get phase() { return this.t < this.warn ? 'warn' : this.t < this.warn + this.active ? 'active' : 'done'; }
  box() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  update(dt) { this.t += dt; if (this.t >= this.warn + this.active + 0.15) this.dead = true; }
  draw(g, camX, ground) {
    const x = Math.round(this.x - camX), ph = this.phase, k = Math.min(1, this.t / this.warn), flick = Math.floor(this.t * 18) % 2;
    const col = this.kind === 'lightning' ? [C.lav2, C.white] : this.kind === 'flame' ? [C.flame, C.flame2] : this.kind === 'spear' ? [C.crimHi, C.crim] : [C.crimHi, C.crim];
    if (this.kind === 'marker') {                            // ground ring that tells where something will land / appear
      if (ph !== 'done') { g.fillStyle = col[1]; g.globalAlpha = 0.35 + 0.4 * k; const r = this.w / 2; for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; if ((i + flick) % 2 === 0) g.fillRect(Math.round(x + Math.cos(a) * r), Math.round(ground - 1 + Math.sin(a) * r * 0.25), 2, 1); } g.globalAlpha = 1; }
      return;
    }
    if (ph === 'warn') {
      if (this.kind === 'crack') {                           // jagged crack in the floor, glowing brighter as it nears
        g.fillStyle = k > 0.6 && flick ? C.white : C.crimHi; for (let i = -9; i <= 9; i += 2) g.fillRect(x + i, ground - 1 - ((i * 7) & 1), 2, 1);
        g.fillStyle = C.crim; g.globalAlpha = 0.5 * k; g.fillRect(x - 10, ground - 3, 20, 3); g.globalAlpha = 1;
      } else {                                               // thin warning column + ground flare
        g.fillStyle = col[1]; g.globalAlpha = 0.18 + 0.3 * k; g.fillRect(x - (this.w >> 1), this.y - this.h, this.w, this.h); g.globalAlpha = 1;
        g.fillStyle = flick ? col[0] : col[1]; g.fillRect(x - (this.w >> 1), ground - 2, this.w, 2); g.fillRect(x - 1, this.y - this.h, 2, this.h);
      }
    } else if (ph === 'active') {
      const w = this.w, top = this.y - this.h;
      if (this.kind === 'spear') {
        g.fillStyle = C.steelDk; g.fillRect(x - 2, top, 4, this.h - 6); g.fillStyle = C.steelHi; g.fillRect(x - 1, top, 1, this.h - 6);
        g.fillStyle = C.steel; for (let i = 0; i < 6; i++) g.fillRect(x - 3 + i, ground - 6 + Math.abs(i - 2.5) * 2 | 0, 1, 1); g.fillStyle = C.crimHi; g.fillRect(x - 3, ground - 8, 6, 3);
      } else {
        g.fillStyle = col[1]; g.fillRect(x - (w >> 1), top, w, this.h); g.fillStyle = col[0]; g.fillRect(x - (w >> 2), top, w >> 1, this.h); g.fillStyle = C.white; g.fillRect(x - 1, top, 2, this.h);
        if (this.kind === 'lightning') { g.fillStyle = C.white; for (let y = top; y < ground; y += 10) g.fillRect(x + ((y * 3) % 7) - 3, y, 3, 3); }
      }
    } else { g.globalAlpha = 0.4; g.fillStyle = col[1]; g.fillRect(x - 3, this.y - this.h * 0.4, 6, this.h * 0.4); g.globalAlpha = 1; }
  }
}
