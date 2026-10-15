// Procedural pixel-art sprites: the hooded protagonist, lesser enemies, slash FX, HUD icons.
// Every frame is drawn once at load with fillRect on a tiny canvas, outlined, and cached - nothing is ever stretched.
import { C } from './palette.js';
import { makeCanvas, outline, silhouette, thickLine, rows } from '../core/util.js';

export const PS = 32, PAX = 16, PAY = 31;      // player frame size + feet anchor

function frame(w, h, ax, ay, drawFn, outlineColor = C.rim, postFn) {
  const [c, g] = makeCanvas(w, h);
  drawFn(g);
  outline(c, outlineColor);
  if (postFn) postFn(g);
  return { c, ax, ay, w, h, white: null };
}
export function whiteOf(f) { return f.white || (f.white = silhouette(f.c, '#ffffff')); }

/* ------------------------------ player ------------------------------ */
const K0 = C.black, K1 = C.ink, K2 = C.indigo, K3 = C.indigo2;
const POSE = { bob: 0, lean: 0, squash: 0, narrow: 0, legs: [[0, 0], [0, 0]], cape: [1, 2, 2, 3, 3, 4], capeY: 0, hand: [21, 22], ang: 1.2, blade: true, orb: 0 };

function drawPlayerBody(g, p) {
  p = Object.assign({}, POSE, p);
  const cx = 16, bob = p.bob + p.squash, tcx = cx + Math.round(p.lean / 2), hx = cx + p.lean;
  const [near, far] = p.legs;
  // far leg, then near leg (legs stay planted; squash shortens them)
  const leg = (dx, lift, x0, col) => {
    const top = 25 + p.squash, bot = 31 - lift;
    g.fillStyle = col; g.fillRect(x0 + dx, top, 3, Math.max(1, bot - top));
    g.fillStyle = K0; g.fillRect(x0 + dx, bot - 2, 4, 2);                       // boot, toe forward
  };
  leg(far[0], far[1], 12, K1);
  // cape (behind the body)
  const tw = [6, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12];
  for (let i = 0; i < 11; i++) {
    const y = 14 + bob + i - p.capeY * (i / 10), w = tw[i] - p.narrow;
    const trail = Math.max(0, p.cape[Math.min(5, i >> 1)] + (i > 6 ? 1 : 0));
    const left = tcx - (w >> 1);
    g.fillStyle = i < 3 ? K2 : K1; g.fillRect(left - trail, Math.round(y), trail + 2, 1);
  }
  // tattered hem notches on the trailing cape
  g.fillStyle = K0;
  for (let i = 0; i < 4; i++) g.fillRect(tcx - 6 - p.cape[5] + i * 3 - p.narrow, 25 + bob - p.capeY, 1, 1);
  // torso / cloak body
  for (let i = 0; i < 11; i++) {
    const w = tw[i] - p.narrow, left = tcx - (w >> 1), y = 14 + bob + i;
    g.fillStyle = K1; g.fillRect(left, y, w, 1);
    g.fillStyle = K2; g.fillRect(left + 1, y, 1, 1);                              // left fold
    if (i > 2 && w > 6) { g.fillStyle = K3; g.fillRect(left + w - 2, y, 1, 1); }  // rim light on the front edge
    if (i % 4 === 3) { g.fillStyle = K0; g.fillRect(left + (w >> 1) - 1, y, 1, 1); } // vertical seam
  }
  g.fillStyle = K0; g.fillRect(tcx - 3, 21 + bob, 7, 1);                           // belt shadow
  g.fillStyle = C.violet; g.fillRect(tcx, 21 + bob, 1, 1);                         // belt clasp
  leg(near[0], near[1], 16, K0);
  // hood
  const hw = [3, 5, 7, 8, 9, 9, 9, 8, 7, 6];
  for (let i = 0; i < 10; i++) {
    const w = hw[i] - (p.narrow >> 1), left = hx - (w >> 1), y = 4 + bob + i;
    g.fillStyle = i < 2 ? K3 : K1; g.fillRect(left, y, w, 1);
    if (i > 1) { g.fillStyle = K2; g.fillRect(left, y, 1, 1); }
  }
  g.fillStyle = K1; g.fillRect(hx - 7 + (p.narrow >> 1), 6 + bob, 3, 2); g.fillRect(hx - 9 + (p.narrow >> 1), 7 + bob, 2, 1);   // hood tail
  g.fillStyle = K0; g.fillRect(hx - 1, 8 + bob, 6 - (p.narrow >> 1), 4);          // face void
  // arm + sword
  const sh = [tcx + 3 - (p.narrow >> 1), 16 + bob], [hxp, hyp] = p.hand;
  thickLine(g, sh[0], sh[1], hxp, hyp, 2, K2);
  g.fillStyle = K0; g.fillRect(hxp - 1, hyp - 1, 2, 2);                           // glove
  if (p.blade) {
    const L = 12, ex = hxp + Math.cos(p.ang) * L, ey = hyp + Math.sin(p.ang) * L;
    thickLine(g, hxp, hyp, ex, ey, 2, C.steel);
    thickLine(g, hxp + Math.cos(p.ang) * 3, hyp + Math.sin(p.ang) * 3, ex, ey, 1, C.steelHi);
    thickLine(g, hxp - Math.sin(p.ang) * 2, hyp + Math.cos(p.ang) * 2, hxp + Math.sin(p.ang) * 2, hyp - Math.cos(p.ang) * 2, 1, C.violet2);   // crossguard
  } else {                                                                          // sheathed on the back
    thickLine(g, tcx - 4, 15 + bob, tcx - 8, 22 + bob, 1, C.steelDk);
  }
  if (p.orb) {                                                                      // shadow energy gathering in the hand
    const r = p.orb;
    g.fillStyle = C.violet2; g.fillRect(hxp + 1, hyp - r, r * 2 + 1, r * 2 + 1);
    g.fillStyle = C.flame2; g.fillRect(hxp + 2, hyp - r + 1, Math.max(1, r * 2 - 1), Math.max(1, r * 2 - 1));
    g.fillStyle = C.white; g.fillRect(hxp + 2 + (r > 1 ? 1 : 0), hyp - (r > 1 ? 1 : 0) + 0, 1, 1);
  }
  return { hx, by: bob };
}
function playerFrame(p, eyes = true) {
  return frame(PS, PS, PAX, PAY, g => { const o = drawPlayerBody(g, p); g._o = o; }, C.rim, null);
}
function playerFull(p) {                         // body + outline, then glowing eyes on top of the outline pass
  const [c, g] = makeCanvas(PS, PS);
  const o = drawPlayerBody(g, p);
  outline(c, C.rim);
  const bob = (p.bob || 0) + (p.squash || 0), hx = o.hx - (p.narrow ? 1 : 0);
  g.fillStyle = C.lav2; g.fillRect(hx + 1, 9 + bob, 1, 2); if (!p.narrow) g.fillRect(hx + 3, 9 + bob, 1, 2);
  g.fillStyle = C.flame; g.globalAlpha = 0.55; g.fillRect(hx, 9 + bob, 1, 2); g.fillRect(hx + 2, 9 + bob, 1, 2); if (!p.narrow) g.fillRect(hx + 4, 9 + bob, 1, 2); g.globalAlpha = 1;
  return { c, ax: PAX, ay: PAY, w: PS, h: PS, white: null };
}
function deadFrame(stage) {
  const [c, g] = makeCanvas(PS, PS);
  if (stage < 2) { drawPlayerBody(g, { bob: stage * 3, squash: stage ? 2 : 0, lean: stage * 2 - 3, legs: [[2, 0], [-3, 0]], blade: stage < 1, hand: [12, 18], ang: 2.6, cape: [2, 3, 3, 4, 4, 5] }); }
  else {
    const h = [0, 0, 5, 4, 3, 3][stage];                                          // cloak pile gets flatter
    for (let i = 0; i < h; i++) { const w = 20 - i * 2 - (stage > 3 ? 0 : 0); g.fillStyle = i === 0 ? K0 : K1; g.fillRect(16 - (w >> 1) - 1, 31 - h + i, w, 1); }
    g.fillStyle = K2; g.fillRect(10, 31 - h, 2, 1);
    g.fillStyle = K1; g.fillRect(21, 31 - h - 1, 5, 3);                            // hood fallen to the side
    g.fillStyle = C.steelDk; g.fillRect(6, 30, 7, 1); g.fillStyle = C.steel; g.fillRect(7, 29, 5, 1);   // sword on the ground
  }
  outline(c, C.rim);
  if (stage >= 2 && stage < 5) { g.fillStyle = C.flame; g.globalAlpha = 0.6; g.fillRect(24, 28, 1, 1); g.globalAlpha = 1; }
  return { c, ax: PAX, ay: PAY, w: PS, h: PS, white: null };
}

function buildPlayer() {
  const A = {};
  const capeA = [[1, 2, 2, 3, 3, 4], [1, 2, 3, 3, 4, 4], [2, 2, 3, 4, 4, 5], [1, 2, 3, 3, 3, 4]];
  A.idle = [0, 0, 1, 1].map((b, i) => playerFull({ bob: b, cape: capeA[i], hand: [21, 22 + (i > 1 ? 1 : 0)], ang: 1.25 }));
  A.walk = [0, 1, 2, 3, 4, 5].map(i => {
    const ph = (i / 6) * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph);
    return playerFull({ bob: i % 3 === 1 ? 1 : 0, lean: 1, legs: [[Math.round(3 * s), Math.max(0, Math.round(2 * c))], [-Math.round(3 * s), Math.max(0, Math.round(-2 * c))]], cape: [2, 3, 3, 4, 4, 5], hand: [20, 22 + (i % 2)], ang: 1.0 });
  });
  A.run = [0, 1, 2, 3, 4, 5].map(i => {
    const ph = (i / 6) * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph);
    return playerFull({ bob: i % 3 === 0 ? 1 : 0, lean: 3, legs: [[Math.round(5 * s), Math.max(0, Math.round(3 * c))], [-Math.round(5 * s), Math.max(0, Math.round(-3 * c))]], cape: [4, 5, 6, 6, 7, 8], capeY: 1, hand: [19, 22], ang: 2.4 });
  });
  A.jump = [0, 1].map(i => playerFull({ bob: -1, lean: 1, legs: [[1, 3], [-2, 2 - i]], cape: [1, 2, 2, 3, 3, 4], capeY: 0, hand: [22, 17 - i], ang: -0.9 }));
  A.fall = [0, 1].map(i => playerFull({ bob: 0, lean: 0, legs: [[2, 1], [-2, 1]], cape: [0, 1, 1, 1, 2, 2], capeY: 3 + i, hand: [21, 14 + i], ang: -1.3 }));
  A.land = [0, 1].map(i => playerFull({ bob: 0, squash: 3 - i, lean: 1, legs: [[3, 0], [-3, 0]], cape: [3, 4, 4, 5, 5, 6], hand: [21, 24], ang: 1.0 }));
  A.turn = [playerFull({ narrow: 4, lean: 0, hand: [18, 22], ang: 1.4, cape: [0, 1, 1, 1, 1, 2] })];
  A.attack1 = [
    { lean: -1, hand: [13, 15], ang: -2.4, cape: [3, 4, 4, 5, 5, 6] }, { lean: -1, hand: [14, 12], ang: -1.85, cape: [3, 4, 4, 5, 5, 6] },
    { lean: 2, hand: [22, 15], ang: -0.65, cape: [4, 5, 5, 6, 6, 7] }, { lean: 3, hand: [24, 19], ang: 0.12, cape: [5, 6, 6, 7, 7, 8] },
    { lean: 2, hand: [23, 23], ang: 1.1, cape: [3, 4, 4, 5, 5, 6] }].map(playerFull);
  A.attack2 = [
    { lean: -1, hand: [22, 25], ang: 1.35, cape: [3, 4, 4, 5, 5, 6] }, { lean: 0, hand: [23, 23], ang: 0.95, cape: [3, 4, 4, 5, 5, 6] },
    { lean: 3, hand: [24, 18], ang: 0.1, cape: [5, 6, 6, 7, 7, 8] }, { lean: 2, hand: [22, 13], ang: -0.9, cape: [4, 5, 5, 6, 6, 7] },
    { lean: 1, hand: [17, 11], ang: -1.7, cape: [3, 4, 4, 5, 5, 6] }].map(playerFull);
  A.special = [{ lean: -1, orb: 0, blade: false, hand: [18, 18] }, { lean: 0, orb: 1, blade: false, hand: [22, 17] }, { lean: 3, orb: 3, blade: false, hand: [25, 17], cape: [5, 6, 6, 7, 7, 8] }, { lean: 2, orb: 1, blade: false, hand: [24, 17] }].map(playerFull);
  A.hurt = [playerFull({ bob: 1, lean: -3, legs: [[-1, 0], [-3, 1]], hand: [12, 15], ang: 2.7, cape: [4, 5, 5, 6, 6, 7] })];
  A.dash = [0, 1].map(i => playerFull({ bob: 2, lean: 5, legs: [[-3, 2 + i], [-5, 1]], cape: [7, 8, 9, 9, 10, 11], capeY: 1, hand: [16, 23], ang: 3.0, squash: 1 }));
  A.dead = [0, 1, 2, 3, 4, 5].map(deadFrame);
  return A;
}

/* ------------------------------ slash FX ------------------------------ */
function buildSlash() {
  const out = { a: [], b: [] };
  for (let k = 0; k < 3; k++) {
    for (const dir of ['a', 'b']) {
      const [c, g] = makeCanvas(44, 44);
      const px = 6, py = 22;                                   // pivot (the player's hand)
      const from = dir === 'a' ? -1.25 : 1.25, to = dir === 'a' ? 1.0 : -1.0;
      const sweep = (k + 1) / 3;
      for (let r = 13; r <= 21; r++) {
        const t = (r - 13) / 8, thick = 1 - Math.abs(t - 0.45) * 1.7;          // crescent: thin at the ends
        for (let s = 0; s < 120; s++) {
          const u = s / 119; if (u > sweep) break;
          const a = from + (to - from) * u;
          const tail = u > sweep - 0.45;                                      // only the leading part is bright
          const w = thick * (0.35 + 0.65 * (tail ? 1 : 0.4));
          if (w < 0.3) continue;
          const x = Math.round(px + Math.cos(a) * r), y = Math.round(py + Math.sin(a) * r);
          g.fillStyle = r >= 19 ? C.white : r >= 16 ? C.lav2 : C.violet2;
          g.globalAlpha = tail ? 1 : 0.55; g.fillRect(x, y, 1, 1);
        }
      }
      out[dir].push({ c, ax: px, ay: py, w: 44, h: 44 });
    }
  }
  return out;
}

/* ------------------------------ lesser enemies ------------------------------ */
function drawGhoul(g, p) {
  const cx = 14, bob = p.bob || 0, lean = p.lean || 0;
  const leg = (x0, dx, lift) => { g.fillStyle = C.char; g.fillRect(x0 + dx, 21, 3, 8 - lift); g.fillStyle = C.black; g.fillRect(x0 + dx, 28 - lift, 4, 1); };
  leg(8, p.legs ? p.legs[0] : 0, 0); leg(15, p.legs ? p.legs[1] : 0, 0);
  // hunched torso (leans forward)
  rows(g, C.char2, cx - 5 + lean, 10 + bob, [[2, 6], [1, 8], [0, 9], [0, 10], [0, 10], [1, 9], [1, 9], [2, 8], [2, 7], [3, 6], [3, 5]]);
  rows(g, C.char, cx - 5 + lean, 11 + bob, [[3, 3], [3, 4], [3, 4], [4, 4], [4, 3], [4, 3], [4, 2]]);
  for (let i = 0; i < 4; i++) { g.fillStyle = C.black; g.fillRect(cx - 3 + lean + i * 2, 13 + bob + i, 1, 2); }          // ribs
  // head, thrust forward
  rows(g, C.char2, cx + 2 + lean, 5 + bob, [[1, 5], [0, 7], [0, 7], [0, 7], [1, 6], [2, 4]]);
  g.fillStyle = C.black; g.fillRect(cx + 5 + lean, 8 + bob, 3, 2);
  g.fillStyle = C.char; g.fillRect(cx + 2 + lean, 5 + bob, 3, 2);
  // long arms dangling / reaching
  const reach = p.reach || 0;
  thickLine(g, cx + 3 + lean, 13 + bob, cx + 7 + reach, 22 - Math.round(reach * 0.4) + bob, 2, C.char2);
  g.fillStyle = C.black; g.fillRect(cx + 7 + reach, 22 - Math.round(reach * 0.4) + bob, 3, 2);
  g.fillRect(cx + 8 + reach, 24 - Math.round(reach * 0.4) + bob, 1, 1); g.fillRect(cx + 10 + reach, 23 - Math.round(reach * 0.4) + bob, 1, 1);
}
function ghoulFrame(p) {
  const [c, g] = makeCanvas(28, 30); drawGhoul(g, p); outline(c, C.crim2);
  g.fillStyle = C.crimHi; g.fillRect(14 + 6 + (p.lean || 0), 8 + (p.bob || 0), 1, 2); g.fillRect(14 + 4 + (p.lean || 0), 8 + (p.bob || 0), 1, 2);
  return { c, ax: 14, ay: 29, w: 28, h: 30, white: null };
}
function wispFrame(i, hurt) {
  const [c, g] = makeCanvas(20, 20), cx = 10, cy = 9, f = Math.sin(i * 1.57);
  rows(g, C.violet, cx - 1, cy + 4, [[-1, 4], [0, 3], [0, 2], [1, 1]]);                               // tail
  g.fillStyle = C.violet2; g.fillRect(cx - 5, cy - 4, 10, 8); g.fillRect(cx - 4, cy - 5, 8, 10);
  g.fillStyle = C.flame; g.fillRect(cx - 4, cy - 4, 8, 8);
  g.fillStyle = C.flame2; g.fillRect(cx - 3, cy - 4 + (f > 0 ? 0 : 1), 6, 3);
  for (let k = 0; k < 3; k++) { g.fillStyle = k === 1 ? C.violet2 : C.flame2; g.fillRect(cx - 4 + k * 3, cy - 7 - (((i + k) % 3 === 0) ? 2 : 0) + (k === 1 ? -1 : 0), 2, 3); }   // flame tips
  g.fillStyle = C.black; g.fillRect(cx - 3, cy - 1, 2, 3); g.fillRect(cx + 1, cy - 1, 2, 3);          // eye sockets
  g.fillStyle = C.crimHi; g.fillRect(cx - 3, cy, 1, 1); g.fillRect(cx + 1, cy, 1, 1);
  g.fillStyle = C.black; g.fillRect(cx - 1, cy + 3, 3, 1);
  outline(c, C.black);
  return { c, ax: 10, ay: 9, w: 20, h: 20, white: null };
}
function buildEnemies() {
  const E = { ghoul: {}, wisp: {} };
  E.ghoul.walk = [0, 1, 2, 3].map(i => ghoulFrame({ bob: i % 2, lean: 1, legs: [Math.round(2 * Math.sin(i * 1.57)), -Math.round(2 * Math.sin(i * 1.57))], reach: 0 }));
  E.ghoul.attack = [{ lean: -2, reach: -2, bob: 1 }, { lean: 3, reach: 6, bob: 0 }, { lean: 4, reach: 9, bob: 0 }].map(ghoulFrame);
  E.ghoul.idle = [0, 1].map(i => ghoulFrame({ bob: i, lean: 0, reach: 0 }));
  E.wisp.fly = [0, 1, 2, 3].map(i => wispFrame(i));
  return E;
}

/* ------------------------------ icons + particles ------------------------------ */
function iconFrom(rowsStr, palette) {
  const h = rowsStr.length, w = rowsStr[0].length, [c, g] = makeCanvas(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = rowsStr[y][x]; if (palette[k]) { g.fillStyle = palette[k]; g.fillRect(x, y, 1, 1); } }
  return c;
}
function buildIcons() {
  const mask = ['.OOOOOOO.', 'OLLLLLLLO', 'OLXXLXXLO', 'OLXXLXXLO', 'OLLLLLLLO', '.OLLLLLO.', '..OLLLO..', '...OOO...'];
  const pal = { O: C.black, L: C.lav2, X: C.black };
  const full = iconFrom(mask, { O: C.violet, L: C.lav2, X: C.black });
  const empty = iconFrom(mask, { O: C.indigo2, L: C.indigo, X: C.black });
  const hurt = iconFrom(mask, { O: C.crim2, L: C.crimHi, X: C.black });
  const spark = iconFrom(['..X..', '.XLX.', 'XLWLX', '.XLX.', '..X..'], { X: C.violet2, L: C.lav2, W: C.white });
  return { heartFull: full, heartEmpty: empty, heartHurt: hurt, spark };
}

export function buildSprites() { return { player: buildPlayer(), slash: buildSlash(), enemy: buildEnemies(), icons: buildIcons() }; }

/** draw one cached frame with its anchor at world (x, y); flip mirrors around the anchor. */
export function drawFrame(g, f, x, y, flip = false, white = false, alpha = 1) {
  const src = white ? whiteOf(f) : f.c;
  if (alpha !== 1) g.globalAlpha = alpha;
  if (flip) { g.save(); g.translate(Math.round(x), Math.round(y)); g.scale(-1, 1); g.drawImage(src, -f.ax, -f.ay); g.restore(); }
  else g.drawImage(src, Math.round(x) - f.ax, Math.round(y) - f.ay);
  if (alpha !== 1) g.globalAlpha = 1;
}
