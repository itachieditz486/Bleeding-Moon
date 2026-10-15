// HUD: player masks, energy, dash pip, boss bar with phase ticks, banners, toasts.
import { C } from '../art/palette.js';
import { drawText, textWidth } from '../core/font.js';
import { BOSS_NAMES } from '../game/levels.js';

export function drawHud(g, S) {
  const W = S.viewW, P = S.player, I = S.spr.icons;
  // hearts (masks)
  for (let i = 0; i < P.maxHp; i++) {
    const img = i < P.hp ? (P.iframes > 0 && i === P.hp - 1 && ((S.time * 14) | 0) % 2 ? I.heartHurt : I.heartFull) : I.heartEmpty;
    g.drawImage(img, 8 + i * 11, 8);
  }
  // energy bar
  const ex = 8, ey = 20, ew = 56, ready = P.energy >= 30;
  g.fillStyle = C.black; g.fillRect(ex - 1, ey - 1, ew + 2, 7);
  g.fillStyle = C.indigo2; g.fillRect(ex, ey, ew, 5);
  g.fillStyle = ready ? C.lav2 : C.violet2; g.fillRect(ex, ey, Math.round(ew * P.energy / 100), 5);
  g.fillStyle = C.black; g.fillRect(ex + Math.round(ew * 0.3), ey, 1, 5);
  if (ready && ((S.time * 3) | 0) % 2 === 0) g.drawImage(I.spark, ex + ew + 4, ey);
  // dash pip
  g.fillStyle = P.dashCd <= 0 ? C.lav : C.indigo2; g.fillRect(ex, ey + 8, 6, 3);
  // boss bar
  const B = S.boss;
  if (B && B.alive && (S.bossState === 'fight' || S.bossState === 'dying' || S.bossState === 'intro')) {
    const bw = Math.min(190, W - 60), bx = Math.round((W - bw) / 2), by = 162;
    B.dispHp += (B.hp - B.dispHp) * 0.06;
    g.fillStyle = C.black; g.fillRect(bx - 2, by - 2, bw + 4, 9);
    g.fillStyle = C.crim2; g.fillRect(bx, by, bw, 5);
    g.fillStyle = C.lav2; g.fillRect(bx, by, Math.round(bw * B.dispHp / B.maxHp), 5);
    g.fillStyle = B.state === 'stagger' ? C.white : C.crimHi; g.fillRect(bx, by, Math.round(bw * B.hp / B.maxHp), 5);
    for (const m of B.marks) { g.fillStyle = C.black; g.fillRect(bx + Math.round(bw * m) - 1, by - 2, 2, 9); g.fillStyle = C.lav2; g.fillRect(bx + Math.round(bw * m), by - 3, 1, 2); }
    drawText(g, BOSS_NAMES[B.id], W / 2, by - 11, C.lav2, { align: 'center' });
    drawText(g, ['', 'I', 'II', 'III'][B.phase] || '', bx + bw + 6, by - 1, C.lav);
  }
  // banner
  if (S.banner) {
    const b = S.banner, a = Math.min(1, b.t / 0.5, (b.dur - b.t) / 0.7);
    drawText(g, b.text, W / 2, b.boss ? 52 : 40, b.boss ? C.crimHi : C.lav2, { align: 'center', scale: b.boss ? 2 : 1, alpha: Math.max(0, a) });
  }
  // toasts
  S.toasts.forEach((t, i) => { const a = Math.min(1, t.t / 0.3, (t.dur - t.t) / 0.5); drawText(g, t.text, W / 2, 112 - i * 10, C.lav2, { align: 'center', alpha: Math.max(0, a) }); });
  if (S.app.settings.showFps) drawText(g, S.app.fps + ' FPS', W - 6, 4, C.lav, { align: 'right' });
}
