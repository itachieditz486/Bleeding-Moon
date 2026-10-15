// Parallax backgrounds, drawn once into tiling 512px layers. Ordered-dither gradients keep every edge crisp.
import { C } from './palette.js';
import { makeCanvas, mulberry32, thickLine, rows } from '../core/util.js';

export const LW = 512, VH = 180;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function gradient(g, y0, y1, stops, w = LW) {
  const img = g.createImageData(w, y1 - y0);
  for (let y = 0; y < y1 - y0; y++) {
    const t = y / Math.max(1, y1 - y0 - 1);
    let i = 0; while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const [t0, c0] = stops[i], [t1, c1] = stops[i + 1], u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    const A = rgb(c0), B = rgb(c1);
    for (let x = 0; x < w; x++) { const k = bayer(x, y + y0) < u ? B : A, o = (y * w + x) * 4; img.data[o] = k[0]; img.data[o + 1] = k[1]; img.data[o + 2] = k[2]; img.data[o + 3] = 255; }
  }
  g.putImageData(img, 0, y0);
}

function periodicNoise(seed, cell) {                    // value noise that wraps horizontally over LW
  const r = mulberry32(seed), nx = LW / cell, ny = 24, grid = [];
  for (let y = 0; y < ny; y++) { grid.push([]); for (let x = 0; x < nx; x++) grid[y].push(r()); }
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = x / cell, gy = Math.max(0, y / cell), x0 = Math.floor(gx), y0 = Math.floor(gy), fx = sm(gx - x0), fy = sm(gy - y0);
    const G = (a, b) => grid[Math.min(ny - 1, b)][((a % nx) + nx) % nx];
    return (G(x0, y0) * (1 - fx) + G(x0 + 1, y0) * fx) * (1 - fy) + (G(x0, y0 + 1) * (1 - fx) + G(x0 + 1, y0 + 1) * fx) * fy;
  };
}
const fbm = (n, x, y) => n(x, y) * 0.55 + n(x * 2, y * 2) * 0.3 + n(x * 4, y * 4) * 0.15;

function layer(drawFn, h = VH) { const [c, g] = makeCanvas(LW, h); drawFn(g, c); return c; }

/* ------------------------------ shared pieces ------------------------------ */
function skyLayer(top, mid, low, stars) {
  return layer(g => {
    gradient(g, 0, 150, [[0, top], [0.55, mid], [1, low]]);
    gradient(g, 150, VH, [[0, low], [1, low]]);
    const r = mulberry32(99);
    if (stars) for (let i = 0; i < stars; i++) { const x = Math.floor(r() * LW), y = Math.floor(r() * 100); g.fillStyle = r() > 0.8 ? C.lav2 : C.violet2; g.globalAlpha = 0.4 + r() * 0.6; g.fillRect(x, y, 1, 1); }
    g.globalAlpha = 1;
  });
}
function moonLayer(cx, cy, R, tint) {
  return layer(g => {
    for (let ring = 3; ring >= 1; ring--) {                           // dithered halo
      for (let y = -R - 26; y <= R + 26; y++) for (let x = -R - 26; x <= R + 26; x++) {
        const d = Math.sqrt(x * x + y * y), lim = R + ring * 8; if (d > lim || d < R) continue;
        if (bayer(x + 100, y + 100) < 0.42 / ring) { g.fillStyle = tint[1]; g.globalAlpha = 0.5; g.fillRect(cx + x, cy + y, 1, 1); }
      }
    }
    g.globalAlpha = 1;
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
      const d = Math.sqrt(x * x + y * y); if (d > R) continue;
      const shade = (x + y) / (R * 2.4);                              // lit from upper left
      g.fillStyle = d > R - 1.4 ? C.white : shade < -0.25 ? tint[0] : shade < 0.35 ? tint[1] : tint[2]; g.fillRect(cx + x, cy + y, 1, 1);
    }
    const r = mulberry32(7);
    for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = r() * R * 0.75, rr = 2 + Math.floor(r() * 5), px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d; g.fillStyle = tint[2]; g.globalAlpha = 0.7; for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++) if (x * x + y * y <= rr * rr) g.fillRect(Math.round(px + x), Math.round(py + y), 1, 1); }
    g.globalAlpha = 1;
  });
}
function cloudLayer(seed, y0, y1, dark, mid, light, thr) {
  const n = periodicNoise(seed, 64);
  return layer(g => {
    for (let y = y0; y < y1; y++) for (let x = 0; x < LW; x++) {
      const fade = Math.min(1, Math.min(y - y0, y1 - y) / 14), v = fbm(n, x * 0.9, (y - y0) * 1.5) * (0.55 + 0.45 * fade) - thr;
      if (v <= 0) continue;
      const above = fbm(n, x * 0.9, (y - 2 - y0) * 1.5) * (0.55 + 0.45 * fade) - thr;
      const k = above <= 0 ? light : v < 0.07 ? mid : dark;
      if (v < 0.03 && bayer(x, y) > v / 0.03) continue;
      g.fillStyle = k; g.fillRect(x, y, 1, 1);
    }
  });
}
function mountainLayer(seed, base, amp, color, rim) {
  const r = mulberry32(seed), phases = [r() * 6.28, r() * 6.28, r() * 6.28], jag = []; for (let i = 0; i < 128; i++) jag.push(r());
  return layer(g => {
    for (let x = 0; x < LW; x++) {
      const t = (x / LW) * Math.PI * 2;
      let h = base - amp * (0.5 + 0.28 * Math.sin(t * 2 + phases[0]) + 0.2 * Math.sin(t * 5 + phases[1]) + 0.12 * Math.sin(t * 11 + phases[2]));
      h -= Math.floor(jag[(x >> 2) % 128] * 7) * (x % 4 < 2 ? 1 : 0.5);
      h = Math.round(h);
      g.fillStyle = color; g.fillRect(x, h, 1, VH - h);
      if (rim) { g.fillStyle = rim; g.fillRect(x, h, 1, 1); }
    }
  });
}
function spire(g, x, baseY, w, h, color) { for (let i = 0; i < h; i++) { const hw = Math.max(0, Math.round((w / 2) * (1 - i / h))); g.fillStyle = color; g.fillRect(x - hw, baseY - i, hw * 2 || 1, 1); } }
function castleLayer(color, windowCol, seed) {
  const r = mulberry32(seed);
  return layer(g => {
    const bY = 150;
    const towers = [[96, 22, 66], [132, 30, 96], [176, 18, 52], [214, 34, 120], [258, 24, 74], [296, 38, 150], [346, 26, 90], [384, 20, 60], [420, 30, 84]];
    g.fillStyle = color; g.fillRect(80, bY - 38, 360, 40);
    for (const [x, w, h] of towers) {
      g.fillStyle = color; g.fillRect(x - (w >> 1), bY - h, w, h);
      for (let k = 0; k < w; k += 4) g.fillRect(x - (w >> 1) + k, bY - h - 3, 2, 3);                 // crenellations
      spire(g, x, bY - h - 3, w + 6, 22 + Math.floor(r() * 14), color);
      const wins = Math.floor(h / 22);
      for (let k = 0; k < wins; k++) if (r() > 0.35) { g.fillStyle = windowCol; g.fillRect(x - 1, bY - h + 8 + k * 20, 2, 5); g.fillStyle = color; g.fillRect(x - 1, bY - h + 8 + k * 20, 2, 1); }
    }
    for (let i = 0; i < 16; i++) { const x = 90 + i * 22 + Math.floor(r() * 6); g.fillStyle = color; g.fillRect(x, bY - 52 - Math.floor(r() * 10), 3, 20); }    // outer spikes
    g.fillStyle = color; g.fillRect(0, bY, LW, VH - bY);
  });
}
function ruinsLayer(color, rim, seed) {
  const r = mulberry32(seed);
  return layer(g => {
    const bY = 168;
    g.fillStyle = color; g.fillRect(0, bY - 22, LW, 40);
    // ruined bridge with arches
    for (let a = 0; a < 6; a++) { const cx = 40 + a * 80, rad = 26; for (let y = 0; y < rad; y++) { const hw = Math.round(Math.sqrt(rad * rad - (rad - y) * (rad - y)) * 0.9); g.clearRect(cx - hw, bY - 22 + y + 2 - 0, hw * 2, 1); } }
    g.fillStyle = color; g.fillRect(0, bY - 40, LW, 8);
    g.fillStyle = rim; g.fillRect(0, bY - 40, LW, 1);
    for (let a = 0; a < 6; a++) { const cx = 40 + a * 80, rad = 26; for (let y = 0; y < rad; y++) { const hw = Math.round(Math.sqrt(rad * rad - (rad - y) * (rad - y)) * 0.9); g.fillStyle = rim; g.fillRect(cx - hw, bY - 32 + y - 3, 1, 1); g.fillRect(cx + hw - 1, bY - 32 + y - 3, 1, 1); } }
    // broken towers + fallen rubble
    for (const [x, w, h] of [[10, 28, 74], [200, 24, 58], [340, 30, 86], [470, 22, 50]]) {
      g.fillStyle = color; g.fillRect(x, bY - h, w, h);
      for (let k = 0; k < w; k += 3) { const cut = Math.floor(r() * 7); g.clearRect(x + k, bY - h, 3, cut); }
      g.fillStyle = rim; g.fillRect(x, bY - h, 1, h); g.fillStyle = C.black; g.fillRect(x + (w >> 1) - 1, bY - h + 12, 3, 8);
    }
    for (let i = 0; i < 24; i++) { g.fillStyle = color; g.fillRect(Math.floor(r() * LW), bY - 26 - Math.floor(r() * 10), 4 + Math.floor(r() * 8), 4); }
  });
}
function fogStrip(seed, h, color, density) {
  const n = periodicNoise(seed, 32);
  return layer(g => {
    for (let y = 0; y < h; y++) for (let x = 0; x < LW; x++) {
      const v = fbm(n, x, y * 1.4) - (1 - density) - (y < 10 ? (10 - y) * 0.04 : 0) - (y > h - 12 ? (y - (h - 12)) * 0.03 : 0);
      if (v > 0 && bayer(x, y) < Math.min(1, v * 6)) { g.fillStyle = color; g.fillRect(x, y, 1, 1); }
    }
  }, h);
}

/* ------------------------------ interiors ------------------------------ */
function wallLayer(base, brickDark, brickLight, seed) {
  const r = mulberry32(seed);
  return layer(g => {
    g.fillStyle = base; g.fillRect(0, 0, LW, VH);
    for (let row = 0; row < VH / 10; row++) {
      const off = (row % 2) * 12;
      for (let x = -12; x < LW; x += 24) {
        const w = 24 - 1, shade = r();
        g.fillStyle = shade > 0.7 ? brickLight : shade < 0.25 ? brickDark : base; g.fillRect(x + off, row * 10 + 1, w, 9);
        g.fillStyle = brickDark; g.fillRect(x + off + w, row * 10, 1, 10);
      }
      g.fillStyle = brickDark; g.fillRect(0, row * 10, LW, 1);
    }
  });
}
function archedWindow(g, x, y, w, h, glass1, glass2, frame) {
  const arch = w >> 1;
  g.fillStyle = frame; g.fillRect(x - 2, y + arch - 2, w + 4, h - arch + 2);
  for (let i = 0; i < arch + 2; i++) { const hw = Math.round(Math.sqrt((arch + 2) * (arch + 2) - (arch + 2 - i) * (arch + 2 - i))); g.fillRect(x + arch - hw, y + i - 2, hw * 2, 1); }
  for (let i = 0; i < arch; i++) { const hw = Math.round(Math.sqrt(arch * arch - (arch - i) * (arch - i))); g.fillStyle = i % 3 ? glass1 : glass2; g.fillRect(x + arch - hw, y + i, hw * 2, 1); }
  for (let k = 0; k < h - arch; k++) { g.fillStyle = (k >> 2) % 2 ? glass1 : glass2; g.fillRect(x, y + arch + k, w, 1); }
  g.fillStyle = frame; g.fillRect(x + arch - 1, y, 2, h); for (let k = 8; k < h; k += 12) g.fillRect(x, y + k, w, 1);
}
function pillarLayer(color, light, spacing, wd) {
  return layer(g => {
    for (let x = 0; x < LW; x += spacing) {
      g.fillStyle = color; g.fillRect(x, 0, wd, VH); g.fillStyle = light; g.fillRect(x, 0, 2, VH); g.fillStyle = C.black; g.fillRect(x + wd - 3, 0, 3, VH);
      g.fillStyle = light; g.fillRect(x - 3, 150, wd + 6, 4); g.fillRect(x - 3, 20, wd + 6, 4);
      for (let y = 30; y < 150; y += 22) { g.fillStyle = C.black; g.fillRect(x + 3, y, wd - 8, 1); }
    }
  });
}
function raysLayer(color, spacing) {
  return layer(g => {
    for (let x = 0; x < LW; x += spacing) for (let y = 0; y < VH; y++) for (let k = 0; k < 14; k++) { const px = x + 10 + y * 0.45 + k; if (bayer(Math.floor(px), y) < 0.22 * (1 - y / VH)) { g.fillStyle = color; g.fillRect(Math.floor(px) % LW, y, 1, 1); } }
  });
}

export function buildTheme(name) {
  const T = { name, layers: [], fog: [], lightning: false, tint: null };
  const add = (c, factor, y = 0, alpha = 1, drift = 0) => T.layers.push({ c, factor, y, alpha, drift });
  if (name === 'approach') {
    add(skyLayer('#06040e', '#1a1136', '#4a2a7a', 90), 0);
    add(moonLayer(236, 60, 38, ['#bda0ee', '#d9c0ff', '#f1e6ff']), 0.03);
    add(cloudLayer(11, 24, 110, '#251a47', '#3a2a66', '#6b50a8', 0.43), 0.08, 0, 0.9, 3);
    add(castleLayer('#150f2c', '#c9a7ff', 5), 0.16, 8);
    add(cloudLayer(23, 60, 130, '#1c1438', '#2a2050', '#4a3a86', 0.42), 0.22, 0, 0.7, 5);
    add(mountainLayer(3, 150, 70, '#0c0919', '#2a2050'), 0.32, 0);
    add(ruinsLayer('#130e26', '#3a2d78', 8), 0.55, 0);
    T.fog = [{ c: fogStrip(31, 56, '#6b50a8', 0.52), y: 118, factor: 0.5, alpha: 0.32, drift: 6 }, { c: fogStrip(32, 56, '#a58ae8', 0.5), y: 140, factor: 0.85, alpha: 0.22, drift: 11 }];
    T.lightning = true; T.tint = '#8e5bff';
  } else if (name === 'hall') {
    add(wallLayer('#1a1630', '#0e0b1c', '#262050', 4), 0.12);
    add(layer(g => { for (let x = 16; x < LW; x += 128) archedWindow(g, x + 20, 22, 28, 86, '#7a1230', '#c2203c', '#0e0b1c'); }), 0.2);
    add(raysLayer('#d6c4ff', 128), 0.2, 0, 0.18);
    add(pillarLayer('#1b1736', '#3a3558', 256, 26), 0.5);
    T.fog = [{ c: fogStrip(41, 56, '#6b50a8', 0.46), y: 128, factor: 0.7, alpha: 0.26, drift: 8 }];
    T.tint = '#c2203c';
  } else if (name === 'corridor') {
    add(wallLayer('#15122a', '#0a0814', '#211c40', 6), 0.1);
    add(layer(g => { for (let x = 0; x < LW; x += 128) { g.fillStyle = '#07050d'; g.fillRect(x + 8, 40, 48, 110); for (let i = 0; i < 24; i++) { const hw = Math.round(Math.sqrt(24 * 24 - (24 - i) * (24 - i))); g.fillRect(x + 32 - hw, 40 + i - 24, hw * 2, 1); } g.fillStyle = '#2c2842'; for (let k = 0; k < 8; k++) g.fillRect(x + 36 + k * 4, 12 + k * 3, 1, 22); g.fillStyle = C.steelDk; for (let k = 0; k < 8; k++) g.fillRect(x + 36 + (k % 2), 12 + k * 4 + 1, 2, 2); } }), 0.25);
    add(pillarLayer('#1b1736', '#3a3558', 128, 14), 0.5);
    T.fog = [{ c: fogStrip(51, 56, '#4a3a86', 0.46), y: 128, factor: 0.7, alpha: 0.24, drift: 9 }];
    T.tint = '#8e5bff';
  } else if (name === 'chamber') {
    add(skyLayer('#10082a', '#2a1060', '#4a1f96', 0), 0);
    add(wallLayer('#1b1238', '#0f0a24', '#2e2060', 9), 0.1, 0, 0.82);
    add(layer(g => { for (let x = 8; x < LW; x += 128) archedWindow(g, x + 30, 14, 34, 110, '#6b3fe0', '#a98aff', '#0f0a24'); }), 0.2);
    add(raysLayer('#a98aff', 128), 0.2, 0, 0.22);
    add(layer(g => {                                                               // tendrils + glowing orbs
      const r = mulberry32(12);
      for (let i = 0; i < 14; i++) { const x = Math.floor(r() * LW), len = 20 + Math.floor(r() * 60); let px = x; for (let y = 0; y < len; y++) { px += Math.round(Math.sin(y * 0.25 + i) * 0.7); g.fillStyle = y < len - 3 ? '#1f1450' : '#6b3fe0'; g.fillRect(px, y, 2, 1); } g.fillStyle = '#c9a7ff'; g.fillRect(px - 1, len, 4, 4); g.fillStyle = '#ffffff'; g.fillRect(px, len + 1, 2, 2); }
    }), 0.4);
    add(pillarLayer('#1b1736', '#4a3a86', 256, 22), 0.55);
    T.fog = [{ c: fogStrip(61, 56, '#8e5bff', 0.5), y: 126, factor: 0.6, alpha: 0.3, drift: 10 }, { c: fogStrip(62, 56, '#c9a7ff', 0.46), y: 142, factor: 0.9, alpha: 0.2, drift: 14 }];
    T.tint = '#8e5bff';
  } else if (name === 'throne') {
    add(skyLayer('#07040f', '#1d1038', '#52226a', 60), 0);
    add(cloudLayer(71, 10, 130, '#1b1238', '#2e1f5a', '#5a44b0', 0.3), 0.06, 0, 1, 14);
    add(layer(g => {                                                               // vast window wall (cut-outs onto sky via dark masonry)
      g.fillStyle = '#0d0a1b'; g.fillRect(0, 0, LW, VH);
      for (let x = 0; x < LW; x += 128) {
        const w = 70, cx = x + 64;
        for (let y = 0; y < 150; y++) { const arch = y < 40 ? Math.round(Math.sqrt(35 * 35 - (40 - y) * (40 - y))) : 35; g.clearRect(cx - arch, y + 8, arch * 2, 1); }
        g.fillStyle = '#1b1736'; g.fillRect(cx - 1, 8, 2, 150); for (let k = 40; k < 150; k += 24) g.fillRect(cx - 35, k, 70, 2);
      }
      g.fillStyle = '#0d0a1b'; g.fillRect(0, 150, LW, 30);
    }), 0.14);
    add(pillarLayer('#16122a', '#3a3558', 256, 30), 0.5);
    add(layer(g => { for (let x = 100; x < LW; x += 256) { g.fillStyle = '#7a1230'; g.fillRect(x, 0, 18, 86); for (let k = 0; k < 18; k += 3) { g.fillStyle = '#c2203c'; g.fillRect(x + k, 86, 2, 6 - (k % 6) / 3); } g.fillStyle = GOLDISH; g.fillRect(x, 0, 18, 3); g.fillStyle = '#c2203c'; g.fillRect(x + 7, 34, 4, 14); } }), 0.5);
    T.fog = [{ c: fogStrip(81, 56, '#6b50a8', 0.5), y: 132, factor: 0.7, alpha: 0.28, drift: 10 }];
    T.lightning = true; T.tint = '#c2203c';
  }
  return T;
}
const GOLDISH = '#b89ad8';

/** draw all parallax layers; camX in world px */
export function drawTheme(g, T, camX, time, viewW, below = true) {
  for (const L of T.layers) {
    const off = Math.floor(camX * L.factor + time * L.drift);
    const start = -(((off % LW) + LW) % LW);
    if (L.alpha !== 1) g.globalAlpha = L.alpha;
    for (let x = start; x < viewW; x += LW) g.drawImage(L.c, x, L.y);
    if (L.alpha !== 1) g.globalAlpha = 1;
  }
}
export function drawFog(g, T, camX, time, viewW) {
  for (const F of T.fog) {
    const off = Math.floor(camX * F.factor + time * F.drift), start = -(((off % LW) + LW) % LW);
    g.globalAlpha = F.alpha;
    for (let x = start; x < viewW; x += LW) g.drawImage(F.c, x, F.y + Math.round(Math.sin(time * 0.4 + F.factor * 5) * 2));
    g.globalAlpha = 1;
  }
}
