// Particles, rings, screen shake, hit-stop and flashes. Everything is capped; `quality` scales it down on weak phones.
import { C } from '../art/palette.js';
import { rand, rng } from '../core/util.js';

export class FX {
  constructor() {
    this.p = []; this.rings = []; this.quality = 1;
    this.shakeA = 0; this.shakeT = 0; this.shakeOn = true;
    this.flashA = 0; this.flashT = 0; this.flashMax = 0.001; this.flashColor = '#ffffff';
    this.stopT = 0; this.slowT = 0; this.slowScale = 1;
  }
  reset() { this.p.length = 0; this.rings.length = 0; this.shakeT = this.flashT = this.stopT = this.slowT = 0; }
  get cap() { return Math.floor(260 * this.quality); }
  /** o: {colors, speed, spread (radians; default full circle), angle, grav, life, size, up} */
  burst(x, y, n, o = {}) {
    n = Math.ceil(n * this.quality);
    const cols = o.colors || [C.flame, C.flame2, C.white], sp = o.speed || 80, life = o.life || 0.5;
    for (let i = 0; i < n && this.p.length < this.cap; i++) {
      const a = (o.angle === undefined ? rand(0, Math.PI * 2) : o.angle + rand(-(o.spread || Math.PI), o.spread || Math.PI));
      const s = sp * rand(0.35, 1);
      this.p.push({ x: x + rand(-(o.jx || 0), o.jx || 0), y: y + rand(-(o.jy || 0), o.jy || 0), vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0), g: o.grav === undefined ? 160 : o.grav, life: life * rand(0.6, 1.2), max: life, c: cols[Math.floor(rng() * cols.length)], s: o.size || (rng() > 0.7 ? 2 : 1) });
    }
  }
  dust(x, y, n = 4, dir = 0) { this.burst(x, y, n, { colors: ['#3a3558', '#5a4a96', '#241f3c'], speed: 28, angle: dir ? (dir > 0 ? Math.PI : 0) : -Math.PI / 2, spread: dir ? 0.6 : 1.2, grav: -10, life: 0.35, size: 2 }); }
  sparks(x, y, n = 8) { this.burst(x, y, n, { colors: [C.white, C.lav2, C.flame2], speed: 150, grav: 260, life: 0.3, size: 1 }); }
  ring(x, y, r0, r1, life, color = C.lav2, thick = 1) { this.rings.push({ x, y, r0, r1, life, max: life, color, thick }); }
  shake(a, t) { if (!this.shakeOn) return; if (a >= this.shakeA || this.shakeT <= 0) { this.shakeA = a; this.shakeT = t; this.shakeMax = t; } }
  flash(color, a, t) { this.flashColor = color; this.flashA = a; this.flashT = t; this.flashMax = t; }
  stop(t) { this.stopT = Math.max(this.stopT, t); }
  slow(scale, t) { this.slowScale = scale; this.slowT = t; }
  update(dt) {
    for (let i = this.p.length - 1; i >= 0; i--) { const q = this.p[i]; q.life -= dt; if (q.life <= 0) { this.p[i] = this.p[this.p.length - 1]; this.p.pop(); continue; } q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    for (let i = this.rings.length - 1; i >= 0; i--) { this.rings[i].life -= dt; if (this.rings[i].life <= 0) this.rings.splice(i, 1); }
    if (this.shakeT > 0) this.shakeT -= dt; if (this.flashT > 0) this.flashT -= dt; if (this.slowT > 0) this.slowT -= dt;
  }
  /** returns integer camera offset for this frame */
  shakeOffset() {
    if (this.shakeT <= 0) return [0, 0];
    const k = this.shakeT / (this.shakeMax || 1), a = Math.max(1, Math.round(this.shakeA * k));
    return [Math.round(rand(-a, a)), Math.round(rand(-a, a) * 0.6)];
  }
  timeScale() { return this.slowT > 0 ? this.slowScale : 1; }
  draw(g, camX) {
    for (const q of this.p) {
      const a = Math.min(1, q.life / (q.max * 0.5)); if (a < 1) g.globalAlpha = a;
      g.fillStyle = q.c; g.fillRect(Math.round(q.x - camX), Math.round(q.y), q.s, q.s);
      if (a < 1) g.globalAlpha = 1;
    }
    for (const r of this.rings) {
      const t = 1 - r.life / r.max, rad = r.r0 + (r.r1 - r.r0) * t; g.fillStyle = r.color; g.globalAlpha = 1 - t;
      const steps = Math.max(12, Math.floor(rad * 2.2));
      for (let i = 0; i < steps; i++) { const a = (i / steps) * Math.PI * 2; g.fillRect(Math.round(r.x - camX + Math.cos(a) * rad), Math.round(r.y + Math.sin(a) * rad * 0.7), r.thick, r.thick); }
      g.globalAlpha = 1;
    }
  }
  drawFlash(g, w, h) { if (this.flashT > 0) { g.globalAlpha = this.flashA * (this.flashT / this.flashMax); g.fillStyle = this.flashColor; g.fillRect(0, 0, w, h); g.globalAlpha = 1; } }
}
