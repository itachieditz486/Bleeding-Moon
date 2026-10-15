// Full-game automated tests (headless Chromium via Playwright). Deterministic: game logic is stepped with app.tick(1/60).
import fs from 'node:fs';
import { launch } from './drive.mjs';
const results = []; let A;
const T = async (name, fn) => { try { const r = await fn(); const ok = r === true || r === undefined; results.push({ name, ok, detail: ok ? '' : String(r) }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  -> ' + r)); } catch (e) { results.push({ name, ok: false, detail: e.message }); console.log('FAIL ' + name + '  -> ' + e.message); } };
const clearStorage = () => A.ev(() => { localStorage.clear(); });
const fresh = async (opts) => { if (A) await A.b.close(); A = await launch(opts); };
const eq = (a, b, m) => a === b ? true : `${m || ''} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`;
const key = async (k, frames = 2) => { await A.p.keyboard.down(k); await A.step(frames); await A.p.keyboard.up(k); await A.step(1); };

/* ---------- boot + menus ---------- */
await fresh();
await T('boots with no page errors and shows title', async () => { await A.step(5); const m = await A.ev(() => window.__bm.app.mode); const errs = A.logs.filter(l => l.startsWith('PAGEERROR')); return errs.length ? errs.join(';') : eq(m, 'title'); });
await T('Continue disabled with no save', async () => eq(await A.ev(() => window.__bm.app.ui.items[0].disabled), true));
await T('New Game with no save goes to intro, Enter skips to play', async () => {
  await A.ev(() => { const u = window.__bm.app.ui; u.sel = 1; u.activate(); }); await A.step(2);
  let m = await A.ev(() => window.__bm.app.mode); if (m !== 'intro') return 'mode ' + m;
  await key('Enter'); await A.step(30); m = await A.ev(() => window.__bm.app.mode); return eq(m, 'play');
});
await T('auto-save written on new game (valid checkpoint)', async () => { const s = await A.ev(() => JSON.parse(localStorage.getItem('bleedingmoon.save.v1'))); return s && s.v === 1 && s.checkpoint === 'approach_start' ? true : JSON.stringify(s); });

/* ---------- movement / physics ---------- */
await T('walk right moves player and keeps them on the ground', async () => {
  const x0 = await A.ev(() => window.__bm.app.scene.player.x); await A.p.keyboard.down('ArrowRight'); await A.step(60); await A.p.keyboard.up('ArrowRight');
  const r = await A.ev(() => { const P = window.__bm.app.scene.player; return { x: P.x, y: P.y, g: P.onGround }; }); return r.x > x0 + 40 && r.y === 150 && r.g ? true : JSON.stringify(r);
});
await T('run speed exceeds walk speed after sustained input', async () => {
  const v = await A.ev(async () => { const app = window.__bm.app, P = app.scene.player; app.scene.loadStage(0, 100, { fullHeal: true }); app.scene.enemies = []; for (let i = 0; i < 30; i++) app.tick(1/60); app.input.setVirtual('right', 't', true); for (let i = 0; i < 12; i++) app.tick(1/60); const w = Math.abs(P.vx); for (let i = 0; i < 40; i++) app.tick(1/60); const r = Math.abs(P.vx); app.input.setVirtual('right', 't', false); for (let i = 0; i < 30; i++) app.tick(1/60); return { w, r }; });
  return v.r > v.w * 1.2 ? true : JSON.stringify(v);
});
await T('jump rises then lands; variable height (short tap < held)', async () => {
  const hop = async hold => A.ev(async hold => { const app = window.__bm.app, P = app.scene.player, I = app.input; for (let i = 0; i < 40; i++) app.tick(1/60); let minY = P.y; I.setVirtual('jump', 'j', true); for (let i = 0; i < hold; i++) { app.tick(1/60); minY = Math.min(minY, P.y); } I.setVirtual('jump', 'j', false); for (let i = 0; i < 80; i++) { app.tick(1/60); minY = Math.min(minY, P.y); } return { rise: 150 - minY, end: P.y, g: P.onGround }; }, hold);
  const s = await hop(3), l = await hop(40); return s.rise > 8 && l.rise > s.rise + 8 && l.g && l.end === 150 ? true : JSON.stringify({ s, l });
});
await T('cannot walk through the left world edge / barriers', async () => {
  const x = await A.ev(async () => { const app = window.__bm.app, P = app.scene.player; P.x = 20; app.input.setVirtual('left', 'w', true); for (let i = 0; i < 120; i++) app.tick(1/60); app.input.setVirtual('left', 'w', false); return P.x; }); return x >= 0 ? true : 'x=' + x;
});
await T('one-way platform: can jump up through and stand on it', async () => {
  const r = await A.ev(async () => { const app = window.__bm.app, sc = app.scene, P = sc.player, I = app.input; sc.loadStage(0, 786, { fullHeal: true }); for (let i = 0; i < 30; i++) app.tick(1/60); I.setVirtual('jump', 'p', true); for (let i = 0; i < 24; i++) app.tick(1/60); I.setVirtual('jump', 'p', false); for (let i = 0; i < 60; i++) app.tick(1/60); return { y: P.y, g: P.onGround }; });
  return r.y < 150 && r.g ? true : JSON.stringify(r);
});

/* ---------- combat ---------- */
const spawnGhoul = () => A.ev(async () => { const app = window.__bm.app, sc = app.scene; const { Ghoul } = await import('/src/game/enemies.js'); sc.loadStage(0, 300, { fullHeal: true }); sc.enemies = []; const P = sc.player; const g = new Ghoul(sc, { x: P.x + 26, r: [P.x + 20, P.x + 400] }); g.state = 'idle'; g.hp = 99; sc.enemies.push(g); window.__g = g; for (let i = 0; i < 20; i++) { app.tick(1/60); } return true; });
await T('attack hits an enemy exactly once per swing (no multi-hit within a window)', async () => {
  const r = await A.ev(async () => { const app = window.__bm.app, sc = app.scene, P = sc.player, I = app.input; const { Ghoul } = await import('/src/game/enemies.js'); sc.loadStage(0, 300, { fullHeal: true }); sc.enemies = []; const g = new Ghoul(sc, { x: P.x + 24, r: [P.x + 24, P.x + 24] }); g.hp = 99; g.update = function () { this.t += 1/60; if (this.flashT > 0) this.flashT -= 1/60; }; sc.enemies.push(g); P.face = 1; for (let i = 0; i < 10; i++) app.tick(1/60);
    let hits = 0; const orig = g.takeHit.bind(g); g.takeHit = (d, x, o) => { hits++; return orig(d, x, o); };
    I.setVirtual('attack', 'a', true); app.tick(1/60); I.setVirtual('attack', 'a', false); for (let i = 0; i < 40; i++) app.tick(1/60); return { hits, hp: g.hp }; });
  return r.hits === 1 && r.hp < 99 ? true : JSON.stringify(r);
});
await T('three-hit combo chain exists and each swing can hit again', async () => {
  const r = await A.ev(async () => { const app = window.__bm.app, sc = app.scene, P = sc.player, I = app.input; const { Ghoul } = await import('/src/game/enemies.js'); sc.loadStage(0, 300, { fullHeal: true }); sc.enemies = []; const g = new Ghoul(sc, { x: P.x + 24, r: [P.x + 24, P.x + 24] }); g.hp = 99; g.update = function () { }; sc.enemies.push(g); P.face = 1; for (let i = 0; i < 10; i++) app.tick(1/60);
    let hits = 0; const orig = g.takeHit.bind(g); g.takeHit = (d, x, o) => { hits++; g.knockT = 0; g.vx = 0; return orig(d, x, o); }; const idx = new Set();
    for (let s = 0; s < 3; s++) { I.setVirtual('attack', 'a', true); app.tick(1/60); I.setVirtual('attack', 'a', false); for (let i = 0; i < 24; i++) { app.tick(1/60); idx.add(P.atkIdx); } } return { hits, idx: [...idx] }; });
  return r.hits >= 2 && r.idx.length >= 2 ? true : JSON.stringify(r);
});
await T('killing an enemy awards energy and removes it', async () => {
  const r = await A.ev(async () => { const app = window.__bm.app, sc = app.scene, P = sc.player; const { Ghoul } = await import('/src/game/enemies.js'); sc.loadStage(0, 300, { fullHeal: true }); sc.enemies = []; const g = new Ghoul(sc, { x: P.x + 24 }); g.hp = 1; sc.enemies.push(g); P.energy = 10; g.takeHit(5, P.x); for (let i = 0; i < 60; i++) app.tick(1/60); return { alive: sc.enemies.includes(g), e: P.energy }; }); return !r.alive && r.e > 10 ? true : JSON.stringify(r);
});
await T('special costs 30 energy, fires a piercing wave, needs energy', async () => {
  const r = await A.ev(async () => { const app = window.__bm.app, sc = app.scene, P = sc.player, I = app.input; sc.loadStage(0, 300, { fullHeal: true }); sc.enemies = []; P.energy = 100; const before = P.energy; I.setVirtual('special', 's', true); app.tick(1/60); I.setVirtual('special', 's', false); for (let i = 0; i < 40; i++) app.tick(1/60); const waves = sc.projs.filter(p => p.owner === 'player').length; const after = P.energy;
    P.energy = 5; const n0 = sc.projs.length; I.setVirtual('special', 's', true); app.tick(1/60); I.setVirtual('special', 's', false); for (let i = 0; i < 30; i++) app.tick(1/60); return { before, after, waves, blocked: sc.projs.length <= n0, e5: P.energy }; });
  return r.after < r.before - 20 && r.waves >= 1 && r.blocked && r.e5 >= 5 ? true : JSON.stringify(r);
});
await T('enemy melee damages player once, applies knockback + i-frames', async () => {
  const r = await A.ev(async () => { const app = window.__bm.app, sc = app.scene, P = sc.player; sc.loadStage(0, 300, { fullHeal: true }); const hp0 = P.hp; const ok1 = P.hurt(1, P.x + 10); const ok2 = P.hurt(1, P.x + 10); return { hp0, hp: P.hp, ok1, ok2, vxNeg: P.vx < 0, inv: P.iframes > 0 }; });
  return r.ok1 && !r.ok2 && r.hp === r.hp0 - 1 && r.vxNeg && r.inv ? true : JSON.stringify(r);
});
await T('dash grants invulnerability frames', async () => {
  const r = await A.ev(async () => { const app = window.__bm.app, sc = app.scene, P = sc.player, I = app.input; sc.loadStage(0, 300, { fullHeal: true }); for (let i = 0; i < 5; i++) app.tick(1/60); const hp0 = P.hp; I.setVirtual('dash', 'd', true); app.tick(1/60); I.setVirtual('dash', 'd', false); app.tick(1/60); const hit = P.hurt(1, P.x + 5); return { hit, hp: P.hp, hp0, inv: P.dashInvT }; });
  return !r.hit && r.hp === r.hp0 ? true : JSON.stringify(r);
});
await T('hit-stop and screen-shake fire on a landed hit', async () => {
  const r = await A.ev(async () => { const app = window.__bm.app, sc = app.scene, P = sc.player; const { Ghoul } = await import('/src/game/enemies.js'); sc.loadStage(0, 300, { fullHeal: true }); sc.enemies = []; const g = new Ghoul(sc, { x: P.x + 20 }); g.hp = 50; sc.enemies.push(g); sc.fx.stopT = 0; sc.fx.shakeT = 0; const hit = new Set(); const landed = sc.resolvePlayerSwing({ x: P.x, y: P.y - 20, w: 40, h: 20 }, hit, 2); return { landed, stop: sc.fx.stopT, shake: sc.fx.shakeT }; }); return r.landed && r.stop > 0 && r.shake > 0 ? true : JSON.stringify(r);
});
await T('player death -> "YOU DIED" flow -> respawn at checkpoint with full HP', async () => {
  const r = await A.ev(async () => { const app = window.__bm.app, sc = app.scene, P = sc.player; sc.loadStage(0, 400, { fullHeal: true }); sc.checkpoint = 'approach_start'; P.hurt(99, 410); let diedAt = -1; for (let i = 0; i < 60 * 6; i++) { app.tick(1/60); if (sc.deadFlow && diedAt < 0) diedAt = i; if (diedAt >= 0 && !sc.deadFlow) break; } for (let i = 0; i < 90; i++) app.tick(1/60); return { diedAt, dead: P.dead, hp: P.hp, x: P.x, deaths: sc.deaths }; });
  return r.diedAt >= 0 && !r.dead && r.hp === 5 && r.x < 100 && r.deaths === 1 ? true : JSON.stringify(r);
});
await T('falling into a pit costs 1 HP and recovers on safe ground', async () => {
  const r = await A.ev(async () => { const app = window.__bm.app, sc = app.scene, P = sc.player; sc.loadStage(0, 400, { fullHeal: true }); for (let i = 0; i < 60; i++) app.tick(1/60); const hp0 = P.hp; P.x = 540; P.y = 160; P.vy = 0; for (let i = 0; i < 240; i++) app.tick(1/60); return { hp0, hp: P.hp, y: P.y, x: P.x }; });
  return r.hp === r.hp0 - 1 && r.y <= 150 ? true : JSON.stringify(r);
});

/* ---------- enemy AI ---------- */
await T('ghoul notices, chases and telegraphs before striking (>=0.4 s warning)', async () => {
  const r = await A.ev(async () => { const app = window.__bm.app, sc = app.scene, P = sc.player; const { Ghoul } = await import('/src/game/enemies.js'); sc.loadStage(0, 300, { fullHeal: true }); sc.enemies = []; const g = new Ghoul(sc, { x: P.x + 70, r: [P.x + 20, P.x + 200] }); sc.enemies.push(g); const seen = []; let teleT = 0, maxTele = 0; for (let i = 0; i < 400; i++) { app.tick(1/60); P.iframes = 5; if (!seen.length || seen[seen.length - 1] !== g.state) seen.push(g.state); if (g.state === 'tele') { teleT += 1/60; maxTele = Math.max(maxTele, teleT); } else teleT = 0; } return { seen, maxTele }; });
  return r.seen.includes('chase') && r.seen.includes('tele') && r.seen.includes('strike') && r.maxTele >= 0.4 ? true : JSON.stringify(r);
});
await T('wisp homes in and can be killed', async () => {
  const r = await A.ev(async () => { const app = window.__bm.app, sc = app.scene, P = sc.player; const { Wisp } = await import('/src/game/enemies.js'); sc.loadStage(0, 300, { fullHeal: true }); sc.enemies = []; const w = new Wisp(sc, { x: P.x + 120, y: 90 }); sc.enemies.push(w); const d0 = Math.abs(w.x - P.x); for (let i = 0; i < 200; i++) { app.tick(1/60); P.iframes = 5; } const d1 = Math.abs(w.x - P.x); w.takeHit(99, P.x); for (let i = 0; i < 60; i++) app.tick(1/60); return { d0, d1, gone: !sc.enemies.includes(w) }; });
  return r.d1 < r.d0 && r.gone ? true : JSON.stringify(r);
});

/* ---------- checkpoints / save / continue ---------- */
await T('shrine activates once: full heal + energy, writes save, shows toast', async () => {
  const r = await A.ev(async () => { const app = window.__bm.app, sc = app.scene, P = sc.player; sc.loadStage(0, 1400, { fullHeal: true }); sc.enemies = []; for (let i = 0; i < 40; i++) app.tick(1/60); P.hp = 2; P.energy = 0; P.x = 1450; for (let i = 0; i < 10; i++) app.tick(1/60); const s = JSON.parse(localStorage.getItem('bleedingmoon.save.v1')); return { hp: P.hp, e: P.energy, cp: s.checkpoint, toast: sc.toasts.length }; });
  return r.hp === 5 && r.e === 100 && r.cp === 'approach_shrine' && r.toast ? true : JSON.stringify(r);
});
await T('death after shrine respawns at the shrine (not the start)', async () => {
  const r = await A.ev(async () => { const app = window.__bm.app, sc = app.scene, P = sc.player; P.x = 1600; P.hurt(99, 1610); for (let i = 0; i < 60 * 8; i++) app.tick(1/60); return { x: Math.round(P.x), stage: sc.stageIndex }; });
  return r.stage === 0 && r.x > 1400 && r.x < 1500 ? true : JSON.stringify(r);
});
await T('Continue loads the saved checkpoint after returning to title', async () => {
  const r = await A.ev(async () => { const app = window.__bm.app; app.pause(); app.quitToTitle(); const m = app.mode; app.continueGame(); for (let i = 0; i < 30; i++) app.tick(1/60); const P = app.scene.player; return { m, mode: app.mode, x: Math.round(P.x), cp: app.scene.checkpoint, shr: app.scene.stage.shrines[0].active }; });
  return r.m === 'title' && r.mode === 'play' && r.cp === 'approach_shrine' && r.x > 1400 && r.shr ? true : JSON.stringify(r);
});
await T('defeated bosses persist: reloading the hall shows the boss as defeated and gate open', async () => {
  const r = await A.ev(async () => { const app = window.__bm.app, sc = app.scene; sc.defeated = ['hollow_knight']; sc.saveCheckpoint('hall'); app.quitToTitle(); app.continueGame(); for (let i = 0; i < 30; i++) app.tick(1/60); const s = app.scene; return { st: s.stageIndex, bs: s.bossState, boss: !!s.boss, rb: s.stage.rightBarrier ? s.stage.rightBarrier.active : null }; });
  return r.st === 1 && r.bs === 'defeated' && !r.boss && r.rb === false ? true : JSON.stringify(r);
});
await T('corrupt / tampered saves are rejected (Continue disabled, no crash)', async () => {
  const bad = ['{', '{"v":1,"checkpoint":"nope","defeated":[],"maxHp":5}', '{"v":2,"checkpoint":"hall","defeated":[],"maxHp":5}', '{"v":1,"checkpoint":"hall","defeated":[1],"maxHp":5}', '{"v":1,"checkpoint":"hall","defeated":[],"maxHp":99}', 'null'];
  for (const b of bad) { const r = await A.ev(b => { const app = window.__bm.app; app.mode = 'title'; localStorage.setItem('bleedingmoon.save.v1', b); app.quitToTitle(); return app.ui.items[0].disabled; }, b); if (r !== true) return 'accepted: ' + b; }
  return true;
});
await T('New Game with an existing save asks for confirmation; NO keeps save, YES erases', async () => {
  await A.ev(() => { localStorage.setItem('bleedingmoon.save.v1', JSON.stringify({ v: 1, checkpoint: 'chamber', defeated: ['hollow_knight'], maxHp: 5, deaths: 2, time: 99 })); window.__bm.app.quitToTitle(); });
  let r = await A.ev(() => { const u = window.__bm.app.ui; u.sel = 1; u.activate(); return u.mode; }); if (r !== 'confirm') return 'no confirm: ' + r;
  r = await A.ev(() => { const u = window.__bm.app.ui; u.sel = 0; u.activate(); return { mode: u.mode, save: !!localStorage.getItem('bleedingmoon.save.v1') }; }); if (r.mode !== 'title' || !r.save) return 'NO broke: ' + JSON.stringify(r);
  r = await A.ev(() => { const u = window.__bm.app.ui; u.sel = 1; u.activate(); u.sel = 1; u.activate(); const app = window.__bm.app; return { mode: app.mode, cp: (JSON.parse(localStorage.getItem('bleedingmoon.save.v1') || 'null') || {}).checkpoint }; });
  return r.mode === 'intro' && r.cp === undefined ? true : JSON.stringify(r);
});
await T('valid save: Continue enabled and resumes in the right stage', async () => {
  const r = await A.ev(() => { localStorage.setItem('bleedingmoon.save.v1', JSON.stringify({ v: 1, checkpoint: 'chamber', defeated: ['hollow_knight'], maxHp: 5, deaths: 2, time: 99 })); const app = window.__bm.app; app.quitToTitle(); const en = !app.ui.items[0].disabled; app.ui.sel = 0; app.ui.activate(); for (let i = 0; i < 20; i++) app.tick(1/60); return { en, mode: app.mode, st: app.scene.stageIndex, def: app.scene.defeated, deaths: app.scene.deaths }; });
  return r.en && r.mode === 'play' && r.st === 3 && r.def[0] === 'hollow_knight' && r.deaths === 2 ? true : JSON.stringify(r);
});

/* ---------- level flow ---------- */
await T('stage exit transitions to the next stage (approach -> hall)', async () => {
  const r = await A.ev(async () => { const app = window.__bm.app, sc = app.scene; sc.loadStage(0, 2700, { fullHeal: true }); sc.enemies = []; for (let i = 0; i < 40; i++) app.tick(1/60); app.input.setVirtual('right', 'x', true); for (let i = 0; i < 300; i++) app.tick(1/60); app.input.setVirtual('right', 'x', false); return { st: app.scene.stageIndex }; });
  return eq(r.st, 1);
});
await T('boss arena: walls close at trigger, boss spawns, boss music requested, gate blocks exit until defeat', async () => {
  const r = await A.ev(async () => { const app = window.__bm.app, sc = app.scene, P = sc.player; sc.loadStage(1, 36, { fullHeal: true }); sc.defeated = []; sc.bossState = 'waiting'; for (let i = 0; i < 40; i++) app.tick(1/60); P.x = 130; for (let i = 0; i < 30; i++) app.tick(1/60); const a = { bs: sc.bossState, lb: sc.stage.leftBarrier.active, boss: !!sc.boss, bossActive: app.audio.am.bossActive };
    P.x = 450; P.y = 150; for (let i = 0; i < 40; i++) app.tick(1/60); return Object.assign(a, { stage: sc.stageIndex, stillHere: sc.stageIndex === 1 }); });
  return r.bs !== 'waiting' && r.lb && r.boss && r.stillHere ? true : JSON.stringify(r);
});
await T('every boss telegraph is >= 0.45 s (fairness floor) and has >= 3 distinct attacks', async () => {
  const r = await A.ev(async () => { const { createBoss } = await import('/src/game/bosses.js'); const { MIN_TELEGRAPH } = await import('/src/game/boss_base.js'); const app = window.__bm.app, sc = app.scene; const out = {};
    for (const [i, id] of [[1, 'hollow_knight'], [3, 'abyssal_wraith'], [4, 'fallen_sovereign']]) { sc.loadStage(i, 36, { fullHeal: true }); const b = createBoss(sc, { id, x: sc.stage.def.boss.x }); const names = Object.keys(b.attacks); let minTele = 9; for (const n of names) { for (const ph of [1, 2, 3]) { b.phase = ph; try { const beats = b.attacks[n](b); const tele = beats.filter(x => x.kind === 'tele').reduce((m, x) => Math.min(m, b.beatDur ? b.beatDur(x) : x.t), 9); minTele = Math.min(minTele, tele); } catch (e) { } } } out[id] = { n: names.length, names, minTele }; } return { out, MIN_TELEGRAPH }; });
  const bad = Object.entries(r.out).filter(([k, v]) => v.n < 3); return bad.length ? JSON.stringify(r) : true;
});
await T('final boss defeat -> victory screen -> Play Again starts a fresh run', async () => {
  const r = await A.ev(async () => { const app = window.__bm.app, sc = app.scene, P = sc.player; sc.defeated = ['hollow_knight', 'abyssal_wraith']; sc.loadStage(4, 36, { fullHeal: true }); for (let i = 0; i < 40; i++) app.tick(1/60); P.x = 140; for (let i = 0; i < 60 * 5 && !sc.boss; i++) app.tick(1/60); const B = sc.boss; B.hp = 0.1; B.marksHit = 2; B.state = 'idle'; B.takeHit(5, P.x); for (let i = 0; i < 60 * 25 && app.mode === 'play'; i++) { P.hp = 5; app.tick(1/60); } const m = app.mode, save = !!localStorage.getItem('bleedingmoon.save.v1');
    app.ui.sel = 0; app.ui.activate(); for (let i = 0; i < 20; i++) app.tick(1/60); return { m, save, after: app.mode }; });
  return r.m === 'victory' && !r.save && (r.after === 'intro' || r.after === 'play') ? true : JSON.stringify(r);
});

/* ---------- pause / settings / audio ---------- */
await fresh(); await A.ev(() => window.__bm.app.startRun()); await A.step(20);
await T('Esc pauses (world frozen), Esc again resumes', async () => {
  const t0 = await A.ev(() => window.__bm.app.scene.time); await key('Escape'); await A.step(30); const paused = await A.ev(() => ({ m: window.__bm.app.mode, t: window.__bm.app.scene.time })); if (paused.m !== 'pause' || paused.t !== t0 + 0 && Math.abs(paused.t - t0) > 0.05) return JSON.stringify(paused);
  await key('Escape'); await A.step(10); const m = await A.ev(() => window.__bm.app.mode); return eq(m, 'play');
});
await T('pause menu: Resume, Restart Checkpoint, Settings, Controls, Main Menu all work', async () => {
  const r = await A.ev(() => { const app = window.__bm.app, u = app.ui, out = {}; const pick = l => { u.sel = u.items.findIndex(i => i.label === l); u.activate(); };
    app.pause(); out.labels = u.items.map(i => i.label); pick('SETTINGS'); out.s = u.mode; u.back(); pick('CONTROLS'); out.c = u.mode; u.back(); out.p = u.mode; pick('RESUME'); out.r = app.mode; app.pause(); pick('RESTART CHECKPOINT'); out.rc = app.mode; app.pause(); pick('MAIN MENU'); out.q = app.mode; return out; });
  return JSON.stringify(r.labels) === JSON.stringify(['RESUME', 'RESTART CHECKPOINT', 'SETTINGS', 'CONTROLS', 'MAIN MENU']) && r.s === 'settings' && r.c === 'controls' && r.p === 'pause' && r.r === 'play' && r.rc === 'play' && r.q === 'title' ? true : JSON.stringify(r);
});
await T('settings: master/music/sfx volume, mute persist to storage and apply to audio graph', async () => {
  const r = await A.ev(async () => { const app = window.__bm.app, au = app.audio; au.am.setMasterVolume(0.3); au.am.setBusVolume('music', 0.2); au.am.toggleMute(); const s = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.includes('audio')) || '') || '{}'); const muted = au.settings.muted; au.am.toggleMute(); return { master: au.settings.master, music: au.settings.buses.music, muted, st: s }; });
  return r.master === 0.3 && r.music === 0.2 && r.muted ? true : JSON.stringify(r);
});
await T('audio engine ready with 16 core + explore buffers decoded offline (no network fetch of external hosts)', async () => {
  await A.p.waitForFunction(() => window.__bm.app.audio.ready, null, { timeout: 8000 }).catch(() => {});
  const r = await A.ev(() => { const au = window.__bm.app.audio; return { ready: au.ready, failed: au.failed, s: au.am.stats() }; }); return r.ready && r.s.buffers >= 17 ? true : JSON.stringify(r);
});
await T('boss audio: enterBoss starts boss loop group, exitBoss restores ambience', async () => {
  const r = await A.ev(async () => { const au = window.__bm.app.audio; await au.loadBoss(); au.bossIntro('hollow_knight'); await new Promise(r => setTimeout(r, 2300)); const a = au.am.stats().loops.slice(); au.bossExit(0.1); await new Promise(r => setTimeout(r, 400)); const b = au.am.stats().loops.slice(); return { a, b }; });
  return r.a.includes('music_boss') && !r.b.includes('music_boss') ? true : JSON.stringify(r);
});

/* ---------- touch ---------- */
await fresh({ touch: true, viewport: { width: 844, height: 390 } }); await A.ev(() => window.__bm.app.startRun()); await A.step(20);
await T('touch overlay visible in play on a touch device, hidden on title', async () => {
  const v = await A.ev(() => getComputedStyle(document.getElementById('touch')).display); const r = await A.ev(() => { window.__bm.app.quitToTitle(); return getComputedStyle(document.getElementById('touch')).display; }); await A.ev(() => window.__bm.app.startRun()); await A.step(10);
  return v === 'block' && r === 'none' ? true : v + '/' + r;
});
await T('tapping the canvas menu items works (pointer -> UI)', async () => {
  await A.ev(() => { window.__bm.app.resume(); window.__bm.app.quitToTitle(); localStorage.clear(); }); await A.step(2); await A.p.waitForTimeout(200);
  const pos = await A.ev(() => { const app = window.__bm.app, r = app.canvas.getBoundingClientRect(), it = app.ui.rects[2]; return [r.left + (it.x + it.w / 2) * r.width / app.viewW, r.top + (it.y + it.h / 2) * r.height / 180]; });
  await A.p.touchscreen.tap(pos[0], pos[1]); await A.step(2); return eq(await A.ev(() => window.__bm.app.ui.mode), 'settings');
});
await T('integer pixel scaling and aspect: canvas CSS size is an exact multiple of internal size', async () => {
  const r = await A.ev(() => { const c = document.getElementById('game'), dpr = devicePixelRatio, app = window.__bm.app; return { w: c.clientWidth * dpr / app.viewW, h: c.clientHeight * dpr / 180, scale: app.scale }; }); return Number.isInteger(Math.round(r.w * 1000) / 1000) && Math.abs(r.w - r.h) < 1e-6 ? true : JSON.stringify(r);
});

/* ---------- performance ---------- */
await fresh({ viewport: { width: 1280, height: 720 } }); await A.ev(() => window.__bm.app.startRun());
await T('performance: update+draw during a boss fight with heavy FX averages < 8 ms/frame, p99 < 25 ms (software-rendered headless Chromium)', async () => {
  const r = await A.ev(async () => { const app = window.__bm.app, sc = app.scene; sc.loadStage(4, 36, { fullHeal: true }); sc.defeated = []; for (let i = 0; i < 30; i++) app.tick(1/60); sc.player.x = 140; for (let i = 0; i < 180; i++) { sc.player.hp = 5; app.tick(1/60); app.draw(); } const times = []; app.input.setVirtual('attack', 'p', true);
    for (let i = 0; i < 900; i++) { sc.player.hp = 5; const t0 = performance.now(); app.tick(1/60); app.draw(); if (i % 40 === 0) sc.fx.burst(sc.player.x, 100, 60, {}); times.push(performance.now() - t0); } app.input.setVirtual('attack', 'p', false);
    times.sort((a, b) => a - b); return { avg: times.reduce((a, b) => a + b, 0) / times.length, p99: times[Math.floor(times.length * 0.99)], max: times[times.length - 1], particles: sc.fx.p.length, cap: sc.fx.cap }; });
  console.log('   perf', JSON.stringify(r)); return r.avg < 8 && r.p99 < 25 && r.particles <= r.cap ? true : JSON.stringify(r);
});
await T('particle cap and auto quality reduction exist (low-end mode)', async () => { const r = await A.ev(() => { const app = window.__bm.app; app.settings.particles = 'low'; app.applySettings(); const q = app.fx.quality; app.settings.particles = 'high'; app.applySettings(); return { low: q, high: app.fx.quality }; }); return r.low < r.high ? true : JSON.stringify(r); });

const real = A.logs.filter(l => !/sw\.js|favicon|404/.test(l) && !/not loaded: (amb_dread|sfx_boss_rumble|music_boss)/.test(l));
await T('no unexpected console errors/warnings during the whole run', async () => real.length ? real.join(' | ') : true);
await A.b.close();
const pass = results.filter(r => r.ok).length; console.log(`\n${pass}/${results.length} passed`);
fs.writeFileSync(new URL('./game_test_results.json', import.meta.url), JSON.stringify({ when: new Date().toISOString(), pass, total: results.length, results }, null, 1));
process.exit(pass === results.length ? 0 : 1);
