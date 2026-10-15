import { launch } from './drive.mjs';
const A = await launch(); await A.p.waitForFunction(() => window.__bm.app.audio.ready, null, { timeout: 15000 });
await A.ev(async () => { const app = window.__bm.app; await app.audio.loadBoss(); app.startRun(); app.scene.loadStage(1, 36, { fullHeal: true }); app.scene.player.x = 130; });
await A.p.waitForTimeout(4500); // real time, game loop running on its own
const a = await A.ev(() => ({ loops: window.__bm.app.audio.am.stats().loops, bs: window.__bm.app.scene.bossState, boss: window.__bm.app.audio.am.bossActive }));
await A.ev(() => { const s = window.__bm.app.scene; s.player.hp = 99; s.boss.hp = 0.1; s.boss.marksHit = 1; s.boss.state = 'idle'; s.boss.takeHit(9, s.player.x); });
await A.p.waitForTimeout(9000);
const b = await A.ev(() => ({ loops: window.__bm.app.audio.am.stats().loops, bs: window.__bm.app.scene.bossState }));
console.log('during fight', JSON.stringify(a)); console.log('after defeat', JSON.stringify(b)); await A.b.close();
