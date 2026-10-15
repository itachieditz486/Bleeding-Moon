import { launch } from './drive.mjs';
const A = await launch(); const S = '/tmp/claude-0/shots/';
await A.ev(() => { window.__bm.app.startRun(); }); await A.step(30);
for (const [idx, name] of [[1, 'knight'], [3, 'wraith'], [4, 'sovereign']]) {
  await A.ev(async idx => { const app = window.__bm.app, sc = app.scene; sc.loadStage(idx, 36, { fullHeal: true }); for (let i = 0; i < 60; i++) app.tick(1/60); sc.player.x = sc.stage.def.boss.trigger + 5; for (let i = 0; i < 260; i++) app.tick(1/60); app.input.setVirtual('right', 'b', true); for (let i = 0; i < 70; i++) app.tick(1/60); app.input.setVirtual('right', 'b', false); }, idx);
  await A.p.waitForTimeout(150); await A.shot(S + name + '_fight.png');
  // advance until the boss is telegraphing an attack
  const info = await A.ev(() => { const app = window.__bm.app, sc = app.scene; let n = 0; while (n++ < 900 && !(sc.boss && sc.boss.state === 'attack' && sc.boss.atk && sc.boss.curBeat().kind === 'tele')) app.tick(1/60); return { st: sc.boss.state, n }; });
  await A.p.waitForTimeout(100); await A.shot(S + name + '_tele.png'); console.log(name, JSON.stringify(info));
}
console.log(A.logs.filter(l => !l.includes('404')).join('\n') || 'no logs'); await A.b.close();
