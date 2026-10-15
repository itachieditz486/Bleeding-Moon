import { launch } from './drive.mjs';
const A = await launch(); const S = '/tmp/claude-0/shots/';
await A.ev(() => window.__bm.app.startRun()); await A.step(30);
const res = [];
for (const [idx, name] of [[1, 'hollow_knight'], [3, 'abyssal_wraith'], [4, 'fallen_sovereign']]) {
  const r = await A.ev(async ([idx, shotWait]) => {
    const app = window.__bm.app, sc = app.scene, I = app.input;
    sc.loadStage(idx, 36, { fullHeal: true }); for (let i = 0; i < 90; i++) app.tick(1 / 60);
    sc.player.hp = sc.player.maxHp = 5;
    const out = { phases: new Set(), states: new Set(), frames: 0, deaths: 0, god: 0, minTele: 99, hits: 0 };
    const V = (a, d) => I.setVirtual(a, 'bot', d);
    let lastState = '', teleStart = 0, shotTaken = false;
    for (let f = 0; f < 60 * 240 && sc.boss !== undefined; f++) {
      const B = sc.boss, P = sc.player;
      if (P.dead) { out.deaths++; P.hp = P.maxHp; P.dead = false; sc.deadFlow = null; sc.fade.a = 0; sc.fade.to = 0; }
      if (P.hp < 2) { P.hp = P.maxHp; out.god++; }          // keep the bot alive: this test targets boss completion, not player skill
      if (B && B.alive) {
        out.phases.add(B.phase); out.states.add(B.state);
        const dx = B.x - P.x, ad = Math.abs(dx);
        V('left', dx < -22 && ad > 24); V('right', dx > 22 && ad > 24);
        V('attack', ad < 46 && f % 7 < 3); V('special', P.energy >= 30 && ad < 120 && f % 20 === 0);
        if (B.state === 'attack' && B.atk) { /* measure telegraph beats */ }
      } else { V('left', false); V('right', sc.bossState === 'waiting'); V('attack', false); V('special', false); }
      app.tick(1 / 60); out.frames++;
      if (sc.bossState === 'defeated') { for (let k = 0; k < 30; k++) app.tick(1 / 60); break; }
    }
    for (const a of ['left', 'right', 'attack', 'special']) I.setVirtual(a, 'bot', false);
    return { phases: [...out.phases], states: [...out.states], frames: out.frames, deaths: out.deaths, god: out.god, bossState: sc.bossState, defeated: sc.defeated.slice(), hp: sc.boss && sc.boss.hp };
  }, [idx, 0]);
  console.log(name, JSON.stringify(r)); res.push(r);
}
console.log(A.logs.join('\n') || 'no logs'); await A.b.close();
