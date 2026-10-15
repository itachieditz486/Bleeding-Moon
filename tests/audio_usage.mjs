// Which imported sound files does real gameplay actually trigger? Spies on AudioManager.play / playLoop.
import { launch } from './drive.mjs';
const A = await launch(); await A.p.waitForFunction(() => window.__bm.app.audio.ready, null, { timeout: 15000 });
const r = await A.ev(async () => {
  const app = window.__bm.app, am = app.audio.am, used = {}; const op = am.play.bind(am), ol = am.playLoop.bind(am);
  am.play = (k, o) => { used[k] = (used[k] || 0) + 1; return op(k, o); }; am.playLoop = (k, o) => { used[k] = (used[k] || 0) + 1; return ol(k, o); };
  await app.audio.loadBoss(); app.startRun(); const sc = () => app.scene, I = app.input, V = (a, d) => I.setVirtual(a, 'b', d);
  for (const [idx, bossId] of [[0, null], [1, 'hollow_knight'], [3, 'abyssal_wraith'], [4, 'fallen_sovereign']]) {
    sc().loadStage(idx, 36, { fullHeal: true }); for (let i = 0; i < 90; i++) app.tick(1/60);
    if (idx === 0) { sc().player.x = 1450; for (let i = 0; i < 20; i++) app.tick(1/60); sc().player.x = 640; }
    for (let f = 0; f < 60 * 200; f++) { const B = sc().boss, P = sc().player; P.hp = 5; if (idx === 0 && f > 900) break;
      if (B && B.alive) { const dx = B.x - P.x, ad = Math.abs(dx); V('left', dx < -22 && ad > 24); V('right', dx > 22 && ad > 24); V('attack', ad < 46 && f % 7 < 3); V('special', P.energy >= 30 && f % 20 === 0); V('jump', f % 90 === 0); V('dash', f % 130 === 0); }
      else { V('right', true); V('attack', f % 40 < 3); V('jump', f % 70 === 0); }
      app.tick(1/60); if (sc().bossState === 'defeated') { for (let k = 0; k < 120; k++) app.tick(1/60); break; } }
    await new Promise(r => setTimeout(r, 1900)); }
  for (const a of ['left', 'right', 'attack', 'special', 'jump', 'dash']) V(a, false);
  app.ui.go('title'); app.ui.items[0]; app.ui.uiConfirm; app.audio.uiConfirm(); app.audio.uiMove(); app.audio.victory(); app.audio.death();
  const keys = Object.keys(am.m.sounds).filter(k => !am.m.sounds[k].alias); return { used, unused: keys.filter(k => !used[k]) };
});
console.log(JSON.stringify(r, null, 1)); console.log('logs:', A.logs.filter(l => !/404/.test(l)).join(' | ') || 'none'); await A.b.close();
