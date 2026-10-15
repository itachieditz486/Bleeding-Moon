// Runtime stage: collision, physics, camera bounds, dynamic barriers, shrines.
import { overlap, clamp } from '../core/util.js';
import { renderStage } from '../art/tiles.js';
import { buildTheme } from '../art/backgrounds.js';

const themeCache = new Map();
export class Stage {
  constructor(def) {
    this.def = def; this.width = def.width; this.ground = def.ground; this.theme = def.theme;
    this.solids = def.solids.map(s => Object.assign({}, s));
    this.decor = def.decor;
    this.leftBarrier = null; this.rightBarrier = null;
    if (def.boss) {
      this.leftBarrier = { kind: 'stone', x: -4, y: -200, w: 14, h: 400, active: false, barrier: true };
      this.rightBarrier = { kind: 'stone', x: def.width - 10, y: -200, w: 14, h: 400, active: true, barrier: true };
      this.solids.push(this.leftBarrier, this.rightBarrier);
    }
    this.canvas = renderStage({ width: def.width, ground: def.ground, theme: def.theme, decor: def.decor, solids: def.solids });
    if (!themeCache.has(def.theme)) themeCache.set(def.theme, buildTheme(def.theme));
    this.bg = themeCache.get(def.theme);
    this.shrines = (def.shrines || []).map(s => ({ id: s.id, x: s.x, active: false }));
  }
  /** Moves a body {x (centre), y (feet), w, h, vx, vy} with swept axis-separated collision. */
  move(b, dt, o = {}) {
    const box = () => ({ x: b.x - b.w / 2, y: b.y - b.h, w: b.w, h: b.h });
    const prevY = b.y; b.hitWall = 0;
    b.x += b.vx * dt;
    for (const s of this.solids) {
      if (s.kind === 'platform' || s.active === false) continue;
      if (overlap(box(), s)) { if (b.vx > 0) { b.x = s.x - b.w / 2; b.hitWall = 1; } else if (b.vx < 0) { b.x = s.x + s.w + b.w / 2; b.hitWall = -1; } else { b.x += (b.x < s.x + s.w / 2 ? -1 : 1); } }
    }
    const lo = b.w / 2 + 2, hi = this.width - b.w / 2 - 2;
    if (b.x < lo) { b.x = lo; b.hitWall = -1; } else if (b.x > hi) { b.x = hi; b.hitWall = 1; }
    b.y += b.vy * dt; b.onGround = false;
    for (const s of this.solids) {
      if (s.active === false || !overlap(box(), s)) continue;
      if (s.kind === 'platform') { if (b.vy >= 0 && prevY <= s.y + 0.5 && !o.drop) { b.y = s.y; b.vy = 0; b.onGround = true; } }
      else if (b.vy >= 0) { b.y = s.y; b.vy = 0; b.onGround = true; }
      else { b.y = s.y + s.h + b.h; b.vy = 0; }
    }
  }
  /** is there floor under x (within `depth` px below `y`)? used by patrolling enemies to avoid pits */
  floorAt(x, y, depth = 24) {
    for (const s of this.solids) if (s.active !== false && x >= s.x && x <= s.x + s.w && s.y >= y - 4 && s.y <= y + depth && s.kind !== 'platform') return true;
    return false;
  }
  camera(px, viewW, prevCam, facing, dt) {
    if (this.width <= viewW) return Math.round((this.width - viewW) / 2);
    const target = clamp(px + facing * 24 - viewW / 2, 0, this.width - viewW);
    return prevCam === null ? target : prevCam + (target - prevCam) * Math.min(1, dt * 6);
  }
}
