// Small shared helpers. No dependencies.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = v => (v < 0 ? -1 : v > 0 ? 1 : 0);
export const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rng = mulberry32(Date.now() & 0xffffffff);          // gameplay randomness
export const rand = (a = 0, b = 1) => a + (b - a) * rng();
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = arr => arr[Math.floor(rng() * arr.length)];

export function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

/** 1px outline around every opaque pixel (drawn on transparent neighbours only). */
export function outline(c, color) {
  const g = c.getContext('2d'), w = c.width, h = c.height;
  const src = g.getImageData(0, 0, w, h), out = g.createImageData(w, h);
  const r = parseInt(color.slice(1, 3), 16), gr = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
  const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src.data[(y * w + x) * 4 + 3]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (src.data[i + 3] > 0) { out.data[i] = src.data[i]; out.data[i + 1] = src.data[i + 1]; out.data[i + 2] = src.data[i + 2]; out.data[i + 3] = src.data[i + 3]; }
    else if (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1)) { out.data[i] = r; out.data[i + 1] = gr; out.data[i + 2] = b; out.data[i + 3] = 255; }
  }
  g.putImageData(out, 0, 0);
  return c;
}

/** Same alpha, one flat colour - used for hit flashes. */
export function silhouette(c, color = '#ffffff') {
  const [o, g] = makeCanvas(c.width, c.height);
  g.drawImage(c, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return o;
}

export function thickLine(g, x0, y0, x1, y1, w, color) {
  g.fillStyle = color;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const off = Math.floor(w / 2);
  for (;;) {
    g.fillRect(x0 - off, y0 - off, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export function rows(g, color, x, y, spec) {       // spec: [[dx, width], ...] one entry per row
  g.fillStyle = color;
  for (let i = 0; i < spec.length; i++) if (spec[i]) g.fillRect(Math.round(x + spec[i][0]), Math.round(y + i), spec[i][1], 1);
}
