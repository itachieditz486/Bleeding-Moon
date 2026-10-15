// Boss rigs: each frame is drawn from a parametric pose, outlined once, then cached by pose key.
import { C } from './palette.js';
import { makeCanvas, outline, silhouette, thickLine, rows } from '../core/util.js';

const cache = new Map();
const BONE = '#cbbfdc', BONE2 = '#8c80a8', GOLD = '#b89ad8';

/** centred, symmetric rows: half-width list -> filled rows */
function sym(g, color, cx, y, halves) {
  g.fillStyle = color;
  for (let i = 0; i < halves.length; i++) if (halves[i] > 0) g.fillRect(cx - halves[i], y + i, halves[i] * 2, 1);
}

/* ============================== THE HOLLOW KNIGHT ============================== */
export const KNIGHT = { w: 84, h: 80, ax: 38, ay: 78 };
function drawKnight(g, p) {
  const cx = 38, bob = p.bob || 0, lean = p.lean || 0, cr = p.crouch || 0;
  const top = 26 + bob + cr;                                          // shoulder line
  // cape behind
  for (let i = 0; i < 34; i++) {
    const y = top + 2 + i, trail = 4 + Math.round(i * 0.35) + (p.cape || 0) + Math.round(Math.sin(i * 0.5 + (p.sway || 0)) * 2);
    g.fillStyle = i < 6 ? C.crim2 : '#4a0f26'; g.fillRect(cx - 12 - trail + lean, y, trail + 6, 1);
    if (i > 26 && i % 2) { g.fillStyle = C.black; g.fillRect(cx - 12 - trail + lean + (i % 4) * 2, y, 2, 1); }
  }
  // legs
  const leg = (x0, dx, lift) => {
    const t = 54 + cr, b = 78 - lift;
    g.fillStyle = C.char; g.fillRect(x0 + dx, t, 8, b - t);
    g.fillStyle = C.char2; g.fillRect(x0 + dx, t, 2, b - t - 2);
    g.fillStyle = C.stone2; g.fillRect(x0 + dx, t + 6, 8, 2);                     // knee plate
    g.fillStyle = C.black; g.fillRect(x0 + dx - 1, b - 4, 11, 4);                  // sabaton
  };
  leg(cx - 12, (p.legs || [0, 0])[1], 0); leg(cx + 3, (p.legs || [0, 0])[0], 0);
  // torso (hollow chest)
  sym(g, C.char2, cx + lean, top, [9, 12, 13, 13, 12, 12, 11, 11, 10, 10, 10, 10, 11, 11, 12, 12, 11, 10, 9, 9, 8, 8, 8, 9, 9, 9, 9]);
  sym(g, C.char, cx + lean, top + 2, [5, 8, 8, 8, 7, 7, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 6, 5, 5, 5, 5]);
  g.fillStyle = C.black; g.fillRect(cx - 5 + lean, top + 6, 10, 15);               // the hollow
  const glow = p.glow || 1;
  g.fillStyle = C.violet; g.fillRect(cx - 3 + lean, top + 8, 6, 11);
  g.fillStyle = glow > 1 ? C.lav2 : C.flame; g.fillRect(cx - 2 + lean, top + 10, 4, 7);
  g.fillStyle = C.white; g.fillRect(cx - 1 + lean, top + 12, 2, 3);
  g.fillStyle = C.stone3; for (let k = 0; k < 3; k++) g.fillRect(cx - 7 + lean, top + 6 + k * 5, 2, 2), g.fillRect(cx + 5 + lean, top + 6 + k * 5, 2, 2);   // rivets
  g.fillStyle = C.black; g.fillRect(cx - 9 + lean, top + 26, 18, 2);              // belt
  g.fillStyle = C.crim; g.fillRect(cx - 1 + lean, top + 26, 2, 2);
  // pauldrons (spiked)
  for (const s of [-1, 1]) {
    const px = cx + s * 14 + lean;
    sym(g, C.char2, px, top - 3, [4, 6, 7, 7, 6, 5, 3]);
    sym(g, C.stone2, px, top - 2, [2, 4, 4, 3]);
    thickLine(g, px, top - 3, px + s * 4, top - 10, 2, C.stone3);
  }
  // helmet + horns
  const hx = cx + 2 + lean, hy = top - 22 + (p.head || 0);
  sym(g, C.char2, hx, hy, [3, 5, 6, 7, 7, 7, 7, 7, 7, 6, 6, 5, 5, 4, 4, 3]);
  sym(g, C.char, hx - 1, hy + 4, [3, 4, 4, 4, 4, 4, 3, 3]);
  g.fillStyle = C.black; g.fillRect(hx + 1, hy + 8, 8, 3);                         // visor
  for (const s of [-1, 1]) { thickLine(g, hx + s * 5, hy + 3, hx + s * 8, hy - 3, 2, C.stone3); thickLine(g, hx + s * 8, hy - 3, hx + s * 6, hy - 9, 2, C.stone2); }
  // arm + greatsword
  const shx = cx + 11 + lean, shy = top + 3, [hxp, hyp] = p.hand || [52, 54], ang = p.ang === undefined ? 1.2 : p.ang;
  thickLine(g, shx, shy, hxp, hyp, 6, C.char2); thickLine(g, shx, shy, hxp, hyp, 2, C.stone2);
  g.fillStyle = C.black; g.fillRect(hxp - 3, hyp - 3, 6, 6);
  const L = 46, ex = hxp + Math.cos(ang) * L, ey = hyp + Math.sin(ang) * L;
  thickLine(g, hxp, hyp, ex, ey, 5, C.steelDk);
  thickLine(g, hxp + Math.cos(ang) * 4, hyp + Math.sin(ang) * 4, ex, ey, 3, C.steel);
  thickLine(g, hxp + Math.cos(ang) * 6, hyp + Math.sin(ang) * 6, ex, ey, 1, C.steelHi);
  thickLine(g, hxp - Math.sin(ang) * 7, hyp + Math.cos(ang) * 7, hxp + Math.sin(ang) * 7, hyp - Math.cos(ang) * 7, 3, C.violet2);   // crossguard
  return { hx, hy };
}
function knightEyes(g, o, p) {
  g.fillStyle = C.crimHi; g.fillRect(o.hx + 2, o.hy + 9, 3, 1); g.fillRect(o.hx + 6, o.hy + 9, 3, 1);
  g.fillStyle = C.crim; g.globalAlpha = 0.6; g.fillRect(o.hx + 1, o.hy + 8, 9, 3); g.globalAlpha = 1;
  g.fillStyle = C.crimHi; g.fillRect(o.hx + 2, o.hy + 9, 3, 1); g.fillRect(o.hx + 6, o.hy + 9, 3, 1);
}
const KNIGHT_POSES = {
  idle: t => ({ bob: Math.round(Math.sin(t * 2.2) * 1.2), hand: [52, 60 + Math.round(Math.sin(t * 2.2))], ang: 1.35, sway: t * 2, glow: 1 }),
  walk: t => { const s = Math.sin(t * 7); return { bob: Math.abs(Math.round(s * 1.5)), lean: 2, legs: [Math.round(s * 4), -Math.round(s * 4)], hand: [52, 58], ang: 1.25, sway: t * 5, cape: 2 }; },
  windup_sweep: () => ({ lean: -3, hand: [30, 36], ang: -2.75, glow: 2, cape: 3 }),
  sweep: () => ({ lean: 4, hand: [58, 40], ang: -0.05, glow: 2, cape: 5, legs: [3, -2] }),
  windup_slam: () => ({ lean: -2, hand: [46, 8], ang: -1.7, glow: 2, head: -1 }),
  slam: () => ({ lean: 4, crouch: 3, hand: [56, 52], ang: 1.42, glow: 2, cape: 5, head: 2 }),
  windup_charge: () => ({ lean: -4, crouch: 7, hand: [34, 60], ang: 2.9, glow: 2, legs: [-3, 3] }),
  charge: t => ({ lean: 8, crouch: 5, hand: [62, 56], ang: 0.1, glow: 2, cape: 8, legs: [Math.round(Math.sin(t * 20) * 5), -Math.round(Math.sin(t * 20) * 5)] }),
  stagger: t => ({ lean: -7, head: -3, hand: [40, 66], ang: 2.3, glow: 0, bob: 2 }),
  roar: t => ({ lean: -2, head: -4, hand: [60, 26], ang: -0.8, glow: 2, cape: 4, bob: Math.round(Math.sin(t * 25)) }),
  dead: () => ({ crouch: 14, lean: -8, head: 4, hand: [36, 66], ang: 3.0, glow: 0, legs: [-3, 3] }),
};

/* ============================== THE ABYSSAL WRAITH ============================== */
export const WRAITH = { w: 96, h: 90, ax: 44, ay: 30 };
function drawWraith(g, p) {
  const cx = 44, bob = p.bob || 0, wave = p.wave || 0, y0 = 14 + bob;
  // robe: tapering body with wavy tattered hem
  const halves = [3, 5, 7, 8, 9, 9, 9, 8, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 13, 14, 14, 14];
  sym(g, C.ink, cx, y0, halves); sym(g, C.night, cx + 2, y0 + 6, halves.slice(6).map(h => h - 3));
  for (let c = -15; c <= 15; c += 2) {
    const len = 8 + Math.round(Math.sin(c * 0.6 + wave * 0.8) * 4) + Math.abs(c) * -0.2 + 8;
    g.fillStyle = (c / 2) % 2 ? C.ink : C.night; g.fillRect(cx + c, y0 + 24, 2, Math.max(2, Math.round(len)));
    g.fillStyle = C.indigo2; g.fillRect(cx + c, y0 + 24 + Math.max(2, Math.round(len)) - 1, 1, 1);
  }
  // hood and face void
  const hx = cx + 1, hy = y0 - 8;
  sym(g, C.indigo, hx, hy, [3, 5, 7, 8, 9, 9, 9, 8, 7]);
  sym(g, C.ink, hx, hy + 2, [2, 4, 6, 7, 8, 8, 8, 7]);
  thickLine(g, hx - 8, hy + 3, hx - 14, hy + 9 + Math.round(Math.sin(wave) * 1), 3, C.ink);        // hood tail
  g.fillStyle = C.black; g.fillRect(hx - 4, hy + 4, 11, 6);                                          // face void
  // chest heart
  g.fillStyle = C.violet; g.fillRect(cx - 2, y0 + 12, 5, 4); g.fillRect(cx - 1, y0 + 16, 3, 1);
  g.fillStyle = p.glow ? C.lav2 : C.flame; g.fillRect(cx - 1, y0 + 12, 3, 3);
  // arms of chain to the floating claws
  const hands = p.hands || [[18, 32], [70, 32]];
  for (const [hxp, hyp] of hands) {
    const sx = hxp < cx ? cx - 7 : cx + 7, sy = y0 + 8, n = 6;
    for (let i = 1; i < n; i++) { g.fillStyle = i % 2 ? C.steelDk : C.char2; g.fillRect(Math.round(sx + (hxp - sx) * i / n) - 1, Math.round(sy + (hyp - sy) * i / n + Math.sin(i + wave) * 1.5) - 1, 3, 3); }
    // claw: palm + fingers (open = fingers splay)
    const open = p.open === undefined ? 1 : p.open, dir = hxp < cx ? -1 : 1;
    g.fillStyle = C.ink; g.fillRect(hxp - 4, hyp - 3, 8, 7);
    g.fillStyle = C.indigo; g.fillRect(hxp - 3, hyp - 3, 6, 2);
    for (let f = 0; f < 3; f++) thickLine(g, hxp + dir * 3, hyp - 2 + f * 2, hxp + dir * (8 + open * 2 + f), hyp - 4 + f * 4 + open * (f - 1) * 2, 2, f === 1 ? C.indigo2 : C.ink);
    if (p.charge) { g.fillStyle = C.violet2; g.fillRect(hxp - 3, hyp - 3 - p.charge, 7, 7); g.fillStyle = C.flame2; g.fillRect(hxp - 2, hyp - 2 - p.charge, 5, 5); g.fillStyle = C.white; g.fillRect(hxp - 1, hyp - 1 - p.charge, 2, 2); }
  }
  return { hx, hy };
}
function wraithEyes(g, o, p) {
  g.fillStyle = C.teal; g.fillRect(o.hx - 3, o.hy + 6, 2, 2);
  g.fillStyle = C.flame2; g.fillRect(o.hx + 3, o.hy + 6, 2, 2);
  g.fillStyle = C.teal; g.globalAlpha = 0.4; g.fillRect(o.hx - 4, o.hy + 5, 4, 4); g.globalAlpha = 1;
}
const WRAITH_POSES = {
  float: t => ({ bob: Math.round(Math.sin(t * 2.4) * 2), wave: Math.floor(t * 6) % 8, hands: [[20 + Math.round(Math.sin(t * 2.4 + 1) * 2), 36 + Math.round(Math.sin(t * 2.4 + 2) * 3)], [68 - Math.round(Math.sin(t * 2.4 + 1) * 2), 36 + Math.round(Math.sin(t * 2.4) * 3)]], open: 1 }),
  charge_bolt: t => ({ bob: -2, wave: Math.floor(t * 10) % 8, hands: [[32, 24], [56, 24]], open: 2, charge: Math.floor(t * 10) % 3, glow: 1 }),
  cast_summon: t => ({ bob: -3, wave: Math.floor(t * 10) % 8, hands: [[12, 16], [76, 16]], open: 2, glow: 1 }),
  dash: t => ({ bob: 0, wave: Math.floor(t * 14) % 8, hands: [[10, 38], [24, 50]], open: 0 }),
  stagger: t => ({ bob: 3, wave: Math.floor(t * 12) % 8, hands: [[24, 56], [64, 56]], open: 0 }),
  roar: t => ({ bob: -4, wave: Math.floor(t * 16) % 8, hands: [[8, 14], [80, 14]], open: 2, glow: 1 }),
  dead: t => ({ bob: 4, wave: 3, hands: [[26, 62], [62, 62]], open: 0 }),
};

/* ============================== THE FALLEN SOVEREIGN ============================== */
export const SOVEREIGN = { w: 150, h: 130, ax: 66, ay: 126 };
function drawSovereign(g, p) {
  const cx = 66, bob = p.bob || 0, lean = p.lean || 0, f2 = (p.form || 1) === 2, fl = p.flame || 0, cr = p.crouch || 0;
  const top = 44 + bob + cr;
  // wings of bone and violet fire (form 2)
  if (f2) for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) { thickLine(g, cx + s * 14 + lean, top + 6, cx + s * (36 + k * 8), top - 22 + k * 11 + Math.round(Math.sin(fl + k) * 2), 3, BONE2); }
    for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? C.violet2 : C.flame; const fx = cx + s * (24 + k * 6) + lean, fy = top - 14 + k * 5 + Math.round(Math.sin(fl * 1.3 + k) * 3); g.fillRect(fx, fy, 3, 6 + (k % 3) * 2); }
  }
  // cape
  for (let i = 0; i < 60; i++) {
    const y = top + 4 + i, trail = 10 + Math.round(i * 0.3) + (p.cape || 0) + Math.round(Math.sin(i * 0.35 + fl) * 3);
    g.fillStyle = i < 10 ? C.crim : i < 40 ? C.crim2 : '#3d0a1e'; g.fillRect(cx - 20 - trail + lean, y, trail + 10, 1);
    if (i > 50 && i % 3 === 0) { g.fillStyle = C.black; g.fillRect(cx - 20 - trail + lean + (i % 5) * 3, y, 2, 1); }
  }
  // skirt / robe
  const skirt = []; for (let i = 0; i < 58 - cr; i++) skirt.push(Math.round(14 + i * 0.22 + Math.sin(i * 0.4 + fl) * 0.8));
  sym(g, C.ink, cx + lean, top + 30 + cr, skirt); sym(g, C.night, cx + 2 + lean, top + 32 + cr, skirt.slice(0, 50).map(h => h - 5));
  for (let c = -26; c <= 26; c += 3) { g.fillStyle = C.crim2; g.fillRect(cx + c + lean, top + 84 - cr - Math.abs(c) * 0.08 + Math.round(Math.sin(c + fl) * 1.5), 2, 2); }
  g.fillStyle = C.black; g.fillRect(cx - 12 + lean, 120, 9, 6); g.fillRect(cx + 4 + lean, 120, 9, 6);   // feet
  // ribcage cage
  sym(g, C.black, cx + lean, top, [12, 13, 14, 14, 14, 14, 13, 13, 12, 12, 11, 10, 10, 9, 9, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 10]);
  g.fillStyle = f2 ? C.crim : C.violet; g.fillRect(cx - 4 + lean, top + 8, 9, 14);
  g.fillStyle = f2 ? C.crimHi : C.flame; g.fillRect(cx - 3 + lean, top + 10, 7, 10);
  g.fillStyle = C.white; g.fillRect(cx - 1 + lean, top + 13, 3, 4);
  g.fillStyle = BONE; g.fillRect(cx - 1 + lean, top, 3, 28);                                       // spine
  for (let r = 0; r < 6; r++) { const w = 12 - Math.abs(r - 1) * 1; g.fillStyle = r % 2 ? BONE2 : BONE; g.fillRect(cx - w + lean, top + 3 + r * 4, w * 2, 2); g.fillStyle = C.black; g.fillRect(cx - 2 + lean, top + 3 + r * 4, 5, 2); g.fillStyle = BONE; g.fillRect(cx - 1 + lean, top + 3 + r * 4, 3, 2); }
  // pauldrons with spikes
  for (const s of [-1, 1]) {
    const px = cx + s * 20 + lean;
    sym(g, C.char2, px, top - 6, [5, 8, 10, 10, 9, 8, 6, 4]); sym(g, C.stone2, px, top - 5, [3, 5, 6, 5, 3]);
    for (let k = 0; k < 3; k++) thickLine(g, px + s * (k * 3 - 2), top - 6, px + s * (k * 5 - 2) + s * 3, top - 17 - k * 2, 2, GOLD);
  }
  // skull head + crown + horns
  const hx = cx + 3 + lean, hy = top - 34 + (p.head || 0);
  sym(g, BONE, hx, hy, [4, 7, 9, 10, 10, 10, 10, 9, 8, 7, 7, 6, 5, 5, 4]);
  sym(g, BONE2, hx + 1, hy + 4, [3, 4, 4, 4, 4, 4, 3]);
  g.fillStyle = C.black; g.fillRect(hx - 7, hy + 5, 5, 6); g.fillRect(hx + 2, hy + 5, 6, 6); g.fillRect(hx - 1, hy + 11, 3, 3);   // sockets + nose
  const jaw = p.jaw || 0; g.fillStyle = BONE; g.fillRect(hx - 5, hy + 14 + jaw, 11, 3); g.fillStyle = C.black; for (let k = 0; k < 4; k++) g.fillRect(hx - 4 + k * 3, hy + 14 + jaw, 1, 2);
  for (const s of [-1, 1]) {
    thickLine(g, hx + s * 9, hy + 3, hx + s * 17, hy - 3, 3, BONE2); thickLine(g, hx + s * 17, hy - 3, hx + s * 18, hy - 15, 3, BONE2);
    if (f2) { thickLine(g, hx + s * 8, hy + 8, hx + s * 20, hy + 10, 2, BONE2); thickLine(g, hx + s * 20, hy + 10, hx + s * 24, hy + 2, 2, BONE2); }
  }
  g.fillStyle = GOLD; g.fillRect(hx - 9, hy - 1, 19, 3);
  for (let k = 0; k < 5; k++) { g.fillRect(hx - 9 + k * 4 + 0, hy - 5 - (k % 2 ? 0 : 3), 3, 4 + (k % 2 ? 0 : 3)); }
  g.fillStyle = C.crim; g.fillRect(hx - 1, hy, 3, 2);
  // purple fire around the head
  for (let k = 0; k < 5; k++) { const a = fl * 1.2 + k * 1.25, fx = hx + Math.round(Math.cos(a) * 22), fy = hy + 6 + Math.round(Math.sin(a) * 6 - Math.abs(Math.sin(a * 2)) * 5); g.fillStyle = k % 2 ? C.flame : C.flame2; g.fillRect(fx, fy - 3 - (k % 3), 3, 6 + (k % 3)); }
  // arm + sceptre
  const shx = cx + 17 + lean, shy = top - 2, [hxp, hyp] = p.hand || [90, top + 20], ang = p.ang === undefined ? 1.45 : p.ang;
  thickLine(g, shx, shy, hxp, hyp, 7, C.char2); thickLine(g, shx, shy, hxp, hyp, 3, C.stone2);
  g.fillStyle = BONE; g.fillRect(hxp - 3, hyp - 3, 7, 7);
  const L = 66, ex = hxp + Math.cos(ang) * L, ey = hyp + Math.sin(ang) * L;
  thickLine(g, hxp - Math.cos(ang) * 22, hyp - Math.sin(ang) * 22, ex, ey, 4, C.char);
  thickLine(g, hxp - Math.cos(ang) * 22, hyp - Math.sin(ang) * 22, ex, ey, 2, GOLD);
  g.fillStyle = f2 ? C.crimHi : C.flame2; g.fillRect(Math.round(ex) - 5, Math.round(ey) - 5, 11, 11); g.fillStyle = f2 ? C.crim : C.violet2; g.fillRect(Math.round(ex) - 4, Math.round(ey) - 4, 9, 9); g.fillStyle = C.white; g.fillRect(Math.round(ex) - 1, Math.round(ey) - 1, 3, 3);
  return { hx, hy };
}
function sovereignEyes(g, o, p) {
  const col = (p.form || 1) === 2 ? C.crimHi : C.crimHi;
  g.fillStyle = C.crim; g.globalAlpha = 0.55; g.fillRect(o.hx - 8, o.hy + 4, 7, 8); g.fillRect(o.hx + 1, o.hy + 4, 8, 8); g.globalAlpha = 1;
  g.fillStyle = col; g.fillRect(o.hx - 5, o.hy + 7, 2, 3); g.fillRect(o.hx + 4, o.hy + 7, 2, 3);
}
const SOV_POSES = {
  idle: t => ({ bob: Math.round(Math.sin(t * 1.8) * 1.5), flame: t * 3, hand: [96, 68 + Math.round(Math.sin(t * 1.8))], ang: 1.5 }),
  walk: t => ({ bob: Math.abs(Math.round(Math.sin(t * 5) * 2)), lean: 2, flame: t * 4, hand: [96, 66], ang: 1.4, cape: 3 }),
  windup_decree: t => ({ bob: -2, flame: t * 8, hand: [92, 30], ang: -1.55, head: -3, jaw: 2, cape: 3 }),
  decree: t => ({ bob: 0, flame: t * 8, hand: [96, 54], ang: -0.5, jaw: 3, cape: 5 }),
  windup_sweep: t => ({ lean: -4, flame: t * 5, hand: [52, 62], ang: 2.95, cape: 4 }),
  sweep: t => ({ lean: 6, flame: t * 5, hand: [104, 66], ang: 0.05, cape: 8 }),
  leap: t => ({ crouch: 12, lean: -3, flame: t * 4, hand: [80, 74], ang: 2.2 }),
  leap_air: t => ({ bob: -4, flame: t * 9, hand: [88, 24], ang: -1.7, jaw: 3, cape: 6 }),
  slam: t => ({ crouch: 8, lean: 4, flame: t * 9, hand: [106, 84], ang: 1.25, jaw: 3, cape: 8 }),
  cast: t => ({ bob: -3, flame: t * 10, hand: [92, 26], ang: -1.35, jaw: 3, cape: 4 }),
  stagger: t => ({ lean: -8, head: -4, flame: t * 3, hand: [76, 84], ang: 2.2, bob: 3, jaw: 4 }),
  transform: t => ({ bob: -6, flame: t * 14, hand: [100, 22], ang: -0.9, head: -5, jaw: 5, cape: 6 }),
  dead: t => ({ crouch: 26, lean: -10, head: 4, flame: t * 2, hand: [70, 100], ang: 2.9, jaw: 5 }),
};

const DEF = {
  hollow_knight: { size: KNIGHT, draw: drawKnight, eyes: knightEyes, poses: KNIGHT_POSES, outline: C.violet2, pad: [16, 20] },
  abyssal_wraith: { size: WRAITH, draw: drawWraith, eyes: wraithEyes, poses: WRAITH_POSES, outline: C.rim, pad: [14, 12] },
  fallen_sovereign: { size: SOVEREIGN, draw: drawSovereign, eyes: sovereignEyes, poses: SOV_POSES, outline: C.crim2, pad: [24, 34] },
};
const keyOf = p => JSON.stringify(p, (k, v) => (typeof v === 'number' ? Math.round(v * 20) / 20 : v));

/** cached outlined frame for a boss pose; t is animation time (seconds), extra overrides pose params (e.g. form: 2) */
export function bossFrame(id, pose, t = 0, extra) {
  const d = DEF[id];
  const fn = d.poses[pose] || d.poses[Object.keys(d.poses)[0]];
  const p = Object.assign(fn(t), extra || {});
  const key = id + '|' + keyOf(p);
  let f = cache.get(key);
  if (f) return f;
  const pd = d.pad, W = d.size.w + pd[0] * 2, H = d.size.h + pd[1] * 2;
  const [c, g] = makeCanvas(W, H);
  g.translate(pd[0], pd[1]);                      // padding so raised swords / crowns / claws never clip
  const o = d.draw(g, p);
  g.setTransform(1, 0, 0, 1, 0, 0);
  outline(c, d.outline);
  g.translate(pd[0], pd[1]);
  d.eyes(g, o, p);
  f = { c, ax: d.size.ax + pd[0], ay: d.size.ay + pd[1], w: W, h: H, white: null };
  if (cache.size > 900) cache.clear();
  cache.set(key, f);
  return f;
}
export const BOSS_POSES = id => Object.keys(DEF[id].poses);
