// Stage geometry + decor rendering. The static part of each stage is painted once into one canvas.
import { C } from './palette.js';
import { makeCanvas, mulberry32, thickLine, outline } from '../core/util.js';

export const PAL = {
  approach: { base: '#241f3c', dark: '#17132a', light: '#34305a', top: '#6b50a8', top2: '#3a2d78', edge: '#0b0818' },
  hall: { base: '#26223a', dark: '#161226', light: '#3a3558', top: '#6b6a9a', top2: '#4c4672', edge: '#0b0818' },
  corridor: { base: '#221e38', dark: '#141022', light: '#363058', top: '#5a4a96', top2: '#3a3558', edge: '#0b0818' },
  chamber: { base: '#241a4a', dark: '#150f30', light: '#382a70', top: '#8e5bff', top2: '#5a44b0', edge: '#0b0818' },
  throne: { base: '#1f1b32', dark: '#100d1e', light: '#34304e', top: '#a58ae8', top2: '#7a1230', edge: '#07050d' },
};

function stoneRect(g, x, y, w, h, P, seed, grass) {
  const r = mulberry32(seed);
  g.fillStyle = P.base; g.fillRect(x, y, w, h);
  for (let row = 0; row * 8 < h; row++) {
    const off = (row % 2) * 8;
    for (let bx = -8; bx < w; bx += 16) {
      const sh = r();
      const x0 = Math.max(0, bx + off), x1 = Math.min(w, bx + off + 15), yy = row * 8;
      if (x1 <= x0) continue;
      g.fillStyle = sh > 0.72 ? P.light : sh < 0.22 ? P.dark : P.base;
      g.fillRect(x + x0, y + yy + 1, x1 - x0, Math.min(7, h - yy - 1));
      g.fillStyle = P.dark; g.fillRect(x + Math.min(w - 1, bx + off + 15), y + yy, 1, Math.min(8, h - yy));
    }
    g.fillStyle = P.dark; g.fillRect(x, y + row * 8, w, 1);
  }
  g.fillStyle = P.top; g.fillRect(x, y, w, 2);                       // lit top lip
  g.fillStyle = P.top2; for (let i = 0; i < w; i += 3) if (r() > 0.4) g.fillRect(x + i, y + 2, 2, 1);
  g.fillStyle = P.edge; g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
  if (grass) { for (let i = 0; i < w; i += 2) { if (r() > 0.45) { const hh = 2 + Math.floor(r() * 4); g.fillStyle = r() > 0.5 ? P.top2 : P.top; g.fillRect(x + i, y - hh, 1, hh); } } }
}
function slab(g, x, y, w, P, seed) {
  const r = mulberry32(seed);
  g.fillStyle = P.dark; g.fillRect(x, y + 2, w, 5);
  g.fillStyle = P.base; g.fillRect(x, y + 1, w, 4);
  for (let i = 0; i < w; i += 8) { g.fillStyle = P.dark; g.fillRect(x + i + 7, y + 1, 1, 5); if (r() > 0.6) { g.fillStyle = P.light; g.fillRect(x + i + 1, y + 2, 5, 2); } }
  g.fillStyle = P.top; g.fillRect(x, y, w, 2);
  g.fillStyle = P.edge; g.fillRect(x, y + 6, w, 1);
  for (let i = 3; i < w - 3; i += 11) { g.fillStyle = P.dark; g.fillRect(x + i, y + 7, 1, 2 + (i % 3)); }       // dripping rubble beneath
}

const DECOR = {
  column(g, d, P, gy) {
    const h = d.h || 60, x = d.x - 7, y = gy - h, r = mulberry32(d.x);
    g.fillStyle = P.base; g.fillRect(x, y, 14, h); g.fillStyle = P.light; g.fillRect(x, y, 3, h); g.fillStyle = P.dark; g.fillRect(x + 11, y, 3, h);
    for (let k = 10; k < h; k += 14) { g.fillStyle = P.dark; g.fillRect(x + 1, gy - k, 12, 1); }
    g.fillStyle = P.top2; g.fillRect(x - 2, gy - 4, 18, 4); g.fillStyle = P.light; g.fillRect(x - 2, y, 18, 3);
    if (d.broken) { for (let i = 0; i < 14; i += 2) g.clearRect(x + i, y, 2, 1 + Math.floor(r() * 7)); }
    g.fillStyle = P.edge; g.fillRect(x - 1, y, 1, h); g.fillRect(x + 14, y, 1, h);
  },
  tree(g, d, P, gy) {
    const r = mulberry32(d.x * 3 + 1), x = d.x, h = d.h || 70, col = '#05030a', rim = '#2a2050';
    const [c, cg] = makeCanvas(90, h + 6);
    const bx = 45; thickLine(cg, bx, h + 5, bx + Math.round(r() * 4 - 2), h * 0.45, 5, col);
    for (let b = 0; b < 6; b++) { const s = b % 2 ? 1 : -1, sy = h * (0.2 + b * 0.12), len = 18 + r() * 18; thickLine(cg, bx, h * 0.85 - b * 6, bx + s * len, sy, 2, col); thickLine(cg, bx + s * len, sy, bx + s * (len + 8), sy - 8 - r() * 6, 1, col); }
    outline(c, rim);
    g.drawImage(c, x - 45, gy - h - 5);
  },
  gate(g, d, P, gy) {
    const x = d.x - 20, y = gy - 62;
    g.fillStyle = P.dark; g.fillRect(x - 4, y - 4, 48, 66);
    g.fillStyle = P.light; g.fillRect(x - 4, y - 4, 3, 66); g.fillRect(x + 41, y - 4, 3, 66);
    g.fillStyle = C.black; g.fillRect(x, y + 16, 40, 46);
    for (let i = 0; i < 16; i++) { const hw = Math.round(Math.sqrt(20 * 20 - (20 - i) * (20 - i))); g.fillStyle = C.black; g.fillRect(x + 20 - hw, y + i, hw * 2, 1); g.fillStyle = P.light; g.fillRect(x + 20 - hw - 1, y + i, 1, 1); g.fillRect(x + 20 + hw, y + i, 1, 1); }
    g.fillStyle = C.steelDk; for (let k = 4; k < 40; k += 6) g.fillRect(x + k, y + 10, 2, 52);
    g.fillRect(x, y + 28, 40, 2); g.fillRect(x, y + 46, 40, 2);
    g.fillStyle = C.violet2; g.globalAlpha = 0.5; g.fillRect(x + 8, y + 4, 24, 3); g.globalAlpha = 1;
    g.fillStyle = P.top2; g.fillRect(x - 8, gy - 6, 56, 6);
  },
  throne(g, d, P, gy) {
    const x = d.x, y = gy;
    g.fillStyle = P.dark; g.fillRect(x - 40, y - 8, 80, 8); g.fillRect(x - 32, y - 16, 64, 8); g.fillRect(x - 24, y - 24, 48, 8);
    g.fillStyle = P.light; g.fillRect(x - 40, y - 8, 80, 1); g.fillRect(x - 32, y - 16, 64, 1); g.fillRect(x - 24, y - 24, 48, 1);
    g.fillStyle = '#0d0a1b'; g.fillRect(x - 18, y - 92, 36, 68);
    for (let k = 0; k < 7; k++) { g.fillStyle = '#0d0a1b'; g.fillRect(x - 18 + k * 6, y - 100 - (k % 2) * 8, 4, 10); }
    g.fillStyle = P.light; g.fillRect(x - 18, y - 92, 2, 68); g.fillRect(x + 16, y - 92, 2, 68);
    g.fillStyle = C.crim2; g.fillRect(x - 12, y - 52, 24, 28); g.fillStyle = C.crim; g.fillRect(x - 12, y - 52, 24, 3);
    g.fillStyle = '#b89ad8'; g.fillRect(x - 3, y - 84, 6, 6); g.fillStyle = C.crim; g.fillRect(x - 1, y - 82, 2, 2);
  },
  statue(g, d, P, gy) {
    const x = d.x, y = gy;
    g.fillStyle = P.light; g.fillRect(x - 10, y - 8, 20, 8); g.fillStyle = P.base; g.fillRect(x - 8, y - 10, 16, 3);
    g.fillStyle = P.dark; g.fillRect(x - 5, y - 36, 10, 26); g.fillRect(x - 7, y - 38, 14, 5); g.fillRect(x - 4, y - 46, 8, 9);
    g.fillRect(x - 6, y - 50, 2, 6); g.fillRect(x + 4, y - 50, 2, 6);
    g.fillStyle = P.light; g.fillRect(x - 5, y - 36, 2, 26); g.fillStyle = C.steelDk; g.fillRect(x + 7, y - 46, 2, 36); g.fillRect(x + 5, y - 40, 6, 2);
  },
  banner(g, d, P, gy) {
    const x = d.x, y = d.y || 20;
    g.fillStyle = '#0b0818'; g.fillRect(x - 8, y - 3, 16, 3);
    g.fillStyle = C.crim2; g.fillRect(x - 6, y, 12, d.h || 44); g.fillStyle = C.crim; g.fillRect(x - 6, y, 2, d.h || 44);
    for (let k = -6; k < 6; k += 3) { g.fillStyle = C.crim2; g.fillRect(x + k, y + (d.h || 44), 2, 4 - (k % 2 ? 1 : 0)); }
    g.fillStyle = '#b89ad8'; g.fillRect(x - 2, y + 14, 4, 8);
  },
  torch(g, d, P, gy) {                                               // sconce only; the flame is animated every frame
    g.fillStyle = '#0b0818'; g.fillRect(d.x - 3, d.y, 6, 3); g.fillStyle = C.steelDk; g.fillRect(d.x - 1, d.y - 4, 2, 6); g.fillRect(d.x - 3, d.y - 6, 6, 2);
  },
  chain(g, d, P, gy) { for (let y = 0; y < (d.h || 40); y += 3) { g.fillStyle = y % 6 ? C.steelDk : C.char2; g.fillRect(d.x + (y % 6 ? 0 : 1), y + (d.y || 0), 2, 2); } },
};

export function renderStage(stage) {
  const P = PAL[stage.theme] || PAL.hall;
  const [c, g] = makeCanvas(stage.width, 180);
  const gy = stage.ground;
  for (const d of stage.decor) if (DECOR[d.type] && !d.front) DECOR[d.type](g, d, P, gy);
  stage.solids.forEach((s, i) => {
    if (s.kind === 'platform') slab(g, s.x, s.y, s.w, P, i * 13 + 5);
    else if (s.kind === 'stone') stoneRect(g, s.x, s.y, s.w, s.h, P, i * 31 + 7, stage.theme === 'approach' && s.y === gy);
  });
  return c;
}

/** animated flame; palette picks violet (default) or crimson fire */
export function drawFlame(g, x, y, t, scale = 1, crimson = false) {
  const f = Math.floor(t * 9) % 4, cols = crimson ? [C.crim2, C.crim, C.crimHi, C.white] : [C.violet, C.flame, C.flame2, C.white];
  const h = [7, 9, 8, 10][f] * scale, w = [5, 4, 5, 4][f] * scale;
  g.fillStyle = cols[0]; g.fillRect(x - (w >> 1) - 1, y - h + 2, w + 2, h - 1);
  g.fillStyle = cols[1]; g.fillRect(x - (w >> 1), y - h + 1, w, h - 1);
  g.fillStyle = cols[2]; g.fillRect(x - (w >> 1) + 1, y - h * 0.6, Math.max(1, w - 2), h * 0.6);
  g.fillStyle = cols[3]; g.fillRect(x, y - h * 0.35, 1, h * 0.3);
  g.fillStyle = cols[1]; g.fillRect(x + (f % 2 ? 2 : -2), y - h - 1, 1, 2);
}
export function drawShrine(g, x, gy, t, active) {
  // an obelisk of dark stone with a violet flame that wakes when the checkpoint is touched
  g.fillStyle = '#0b0818'; g.fillRect(x - 6, gy - 6, 12, 6); g.fillRect(x - 4, gy - 30, 8, 24);
  g.fillStyle = '#3a3558'; g.fillRect(x - 4, gy - 30, 2, 24); g.fillRect(x - 6, gy - 6, 12, 1);
  g.fillStyle = active ? C.lav2 : C.violet; g.fillRect(x - 1, gy - 24, 2, 8);
  g.fillStyle = '#0b0818'; g.fillRect(x - 6, gy - 34, 12, 4); g.fillStyle = '#3a3558'; g.fillRect(x - 6, gy - 34, 12, 1);
  if (active) { drawFlame(g, x, gy - 35, t, 1.2); g.globalAlpha = 0.18; g.fillStyle = C.flame; g.fillRect(x - 14, gy - 46, 28, 20); g.globalAlpha = 1; }
  else { g.fillStyle = C.violet; g.fillRect(x - 1, gy - 37, 2, 3); }
}
