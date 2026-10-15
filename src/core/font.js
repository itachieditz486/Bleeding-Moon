// 5x7 bitmap font (classic column-major table, ASCII 32..95; lowercase is drawn as uppercase).
import { makeCanvas } from './util.js';
const GLYPHS = {
  ' ': '0000000000', '!': '00005F0000', '"': '0007000700', '#': '147F147F14', '$': '242A7F2A12', '%': '2313086462', '&': '3649552250',
  "'": '0005030000', '(': '001C224100', ')': '0041221C00', '*': '14083E0814', '+': '08083E0808', ',': '0050300000', '-': '0808080808',
  '.': '0060600000', '/': '2010080402', '0': '3E5149453E', '1': '00427F4000', '2': '4261514946', '3': '2141454B31', '4': '1814127F10',
  '5': '2745454539', '6': '3C4A494930', '7': '0171090503', '8': '3649494936', '9': '064949291E', ':': '0036360000', ';': '0056360000',
  '<': '0814224100', '=': '1414141414', '>': '0041221408', '?': '0201510906', '@': '324979413E', 'A': '7E1111117E', 'B': '7F49494936',
  'C': '3E41414122', 'D': '7F4141221C', 'E': '7F49494941', 'F': '7F09090901', 'G': '3E4149497A', 'H': '7F0808087F', 'I': '00417F4100',
  'J': '2040413F01', 'K': '7F08142241', 'L': '7F40404040', 'M': '7F020C027F', 'N': '7F0408107F', 'O': '3E4141413E', 'P': '7F09090906',
  'Q': '3E4151215E', 'R': '7F09192946', 'S': '4649494931', 'T': '01017F0101', 'U': '3F4040403F', 'V': '1F2040201F', 'W': '3F4038403F',
  'X': '6314081463', 'Y': '0708700807', 'Z': '6151494543', '[': '007F414100', '\\': '0204081020', ']': '0041417F00', '^': '0402010204', '_': '4040404040',
};
const cols = {};
for (const [ch, hex] of Object.entries(GLYPHS)) cols[ch] = [0, 2, 4, 6, 8].map(i => parseInt(hex.slice(i, i + 2), 16));

const cache = new Map();
export function textWidth(str, scale = 1) { return (str.length * 6 - 1) * scale; }

/** Returns a cached canvas with the text drawn (optional 1px drop shadow). */
function render(str, color, scale, shadow) {
  const key = color + '|' + scale + '|' + (shadow || '') + '|' + str;
  let c = cache.get(key);
  if (c) return c;
  if (cache.size > 600) cache.clear();
  const w = textWidth(str, scale) + (shadow ? scale : 0), h = 7 * scale + (shadow ? scale : 0);
  const [cv, g] = makeCanvas(Math.max(1, w), h);
  const draw = (col, ox, oy) => {
    g.fillStyle = col;
    for (let i = 0; i < str.length; i++) {
      const cc = cols[str[i].toUpperCase()] || cols['?'];
      for (let x = 0; x < 5; x++) for (let y = 0; y < 7; y++) if (cc[x] & (1 << y)) g.fillRect(ox + (i * 6 + x) * scale, oy + y * scale, scale, scale);
    }
  };
  if (shadow) draw(shadow, scale, scale);
  draw(color, 0, 0);
  cache.set(key, cv);
  return cv;
}

export function drawText(g, str, x, y, color = '#e8e0ff', opts = {}) {
  const scale = opts.scale || 1;
  const c = render(String(str), color, scale, opts.shadow === undefined ? '#07050d' : opts.shadow);
  const w = textWidth(String(str), scale);
  const ax = opts.align === 'center' ? x - (w >> 1) : opts.align === 'right' ? x - w : x;
  if (opts.alpha !== undefined) { const a = g.globalAlpha; g.globalAlpha = opts.alpha; g.drawImage(c, Math.round(ax), Math.round(y)); g.globalAlpha = a; }
  else g.drawImage(c, Math.round(ax), Math.round(y));
}
