import { launch } from './drive.mjs'; const S = '/tmp/claude-0/shots/';
const A = await launch({ touch: true, viewport: { width: 844, height: 390 } });
await A.p.waitForTimeout(300); await A.shot(S + 'v2_title.png');
await A.ev(() => window.__bm.app.startRun()); await A.step(10);
await A.ev(() => { const app = window.__bm.app, sc = app.scene; sc.loadStage(1, 36, { fullHeal: true }); for (let i = 0; i < 60; i++) app.tick(1/60); sc.player.x = 130; for (let i = 0; i < 300; i++) app.tick(1/60); });
await A.p.waitForTimeout(250); await A.shot(S + 'v2_boss_touch.png');
await A.ev(() => window.__bm.app.pause()); await A.p.waitForTimeout(250); await A.shot(S + 'v2_pause.png');
await A.ev(() => { const u = window.__bm.app.ui; u.sel = 2; u.activate(); u.sel = 5; u.activate(); }); await A.p.waitForTimeout(250); await A.shot(S + 'v2_settings.png');
await A.b.close();
