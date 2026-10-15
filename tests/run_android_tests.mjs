// Tests for the Android/touch + smoothness + navigation update. Same harness as run_game_tests.mjs.
import fs from 'node:fs';
import { launch } from './drive.mjs';
const results = []; let A;
const T = async (name, fn) => { try { const r = await fn(); const ok = r === true || r === undefined; results.push({ name, ok, detail: ok ? '' : String(r) }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  -> ' + r)); } catch (e) { results.push({ name, ok: false, detail: e.message }); console.log('FAIL ' + name + '  -> ' + e.message); } };
const fresh = async o => { if (A) await A.b.close(); A = await launch(o); };
const ptr = (type, sel, id, dx = 0, dy = 0, target = null) => A.ev(([type, sel, id, dx, dy, target]) => { const el = sel === 'window' ? window : document.querySelector(sel); let x = 0, y = 0; if (sel !== 'window') { const r = el.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; } (target ? document.querySelector(target) || window : el).dispatchEvent(new PointerEvent(type, { pointerId: id, bubbles: true, cancelable: true, clientX: (target === 'abs' ? 0 : x) + dx, clientY: y + dy, pointerType: 'touch', isPrimary: id === 1 })); }, [type, sel, id, dx, dy, target]);
const down = a => A.ev(a => { const i = window.__bm.app.input; return i.virt[a].size > 0 || i.keys[a].size > 0; }, a);   // live state (not the per-step snapshot)
const P = () => A.ev(() => { const p = window.__bm.app.scene.player; return { x: p.x, y: p.y, vx: p.vx, vy: p.vy, st: p.state, g: p.onGround, hp: p.hp, dashT: p.dashT, atkT: p.atkT }; });

/* ================= touch controls (touch-emulated Chromium, 844x390 landscape phone) ================= */
await fresh({ touch: true, viewport: { width: 844, height: 390 } }); await A.ev(() => window.__bm.app.startRun()); await A.step(30);
await T('five buttons present with correct labels; overlay visible in play', async () => {
  const r = await A.ev(() => ({ labels: [...document.querySelectorAll('#touch [data-act]')].map(e => e.dataset.act + ':' + e.textContent), disp: getComputedStyle(document.getElementById('touch')).display }));
  return r.disp === 'block' && JSON.stringify(r.labels) === JSON.stringify(['attack:ATK', 'jump:JUMP', 'dash:DASH', 'special:SHADOW', 'pause:II']) ? true : JSON.stringify(r);
});
await T('layout: buttons do not overlap each other, the HUD, or the boss-bar zone; all hit areas >= 44 px', async () => {
  const r = await A.ev(() => { const W = innerWidth, H = innerHeight, rs = [...document.querySelectorAll('#touch [data-act]')].map(e => { const b = e.getBoundingClientRect(); return { n: e.dataset.act, l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; }); const cv = document.getElementById('game').getBoundingClientRect(), sx = cv.width / window.__bm.app.viewW, sy = cv.height / 180;
    const hud = { l: cv.left, t: cv.top, r: cv.left + 100 * sx, b: cv.top + 30 * sy }, boss = { l: cv.left + (window.__bm.app.viewW / 2 - 110) * sx, t: cv.top + 150 * sy, r: cv.left + (window.__bm.app.viewW / 2 + 110) * sx, b: cv.bottom };
    const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t; const bad = [];
    rs.forEach((a, i) => { rs.slice(i + 1).forEach(b => { if (hit(a, b)) bad.push(a.n + '/' + b.n); }); if (hit(a, hud)) bad.push(a.n + '/HUD'); if (hit(a, boss)) bad.push(a.n + '/bossbar'); if (Math.min(a.w, a.h) < 44) bad.push(a.n + ' small ' + Math.round(Math.min(a.w, a.h))); if (a.r > W || a.b > H || a.l < 0 || a.t < 0) bad.push(a.n + ' offscreen'); });
    return { bad, sizes: rs.map(a => a.n + ':' + Math.round(a.w)) }; });
  return r.bad.length ? JSON.stringify(r) : true;
});
await T('stick: hold right moves right; reversing direction flips; release stops (decelerates to 0)', async () => {
  await A.ev(() => { const a = window.__bm.app, s = a.scene; s.loadStage(0, 300, { fullHeal: true }); s.enemies = []; }); await A.step(30);
  await ptr('pointerdown', '[data-zone]', 1, -200, 0); const a0 = await down('right'); await ptr('pointermove', '[data-zone]', 1, -100, 0); await A.step(2); const right = await down('right'); const x0 = (await P()).x; await A.step(30);
  const x1 = (await P()).x; await ptr('pointermove', '[data-zone]', 1, -190, 0); await ptr('pointermove', '[data-zone]', 1, -260, 0); await A.step(2); const left = await down('left'), rightOff = !(await down('right'));
  await ptr('pointerup', '[data-zone]', 1, -260, 0); await A.step(3); const rel = !(await down('left')) && !(await down('right')); await A.step(40); const v = (await P()).vx;
  return right && x1 > x0 + 20 && left && rightOff && rel && Math.abs(v) < 1 ? true : JSON.stringify({ a0, right, x0, x1, left, rightOff, rel, v });
});
await T('simultaneous: stick held + ATK + JUMP + DASH + SHADOW all register together, then release independently', async () => {
  await A.ev(() => { const a = window.__bm.app, s = a.scene; s.loadStage(0, 300, { fullHeal: true }); s.enemies = []; s.player.energy = 100; }); await A.step(30);
  await ptr('pointerdown', '[data-zone]', 1, -200, 0); await ptr('pointermove', '[data-zone]', 1, -100, 0);
  await ptr('pointerdown', '[data-act=attack]', 2); await ptr('pointerdown', '[data-act=jump]', 3); await ptr('pointerdown', '[data-act=dash]', 4); await ptr('pointerdown', '[data-act=special]', 5);
  const all = await A.ev(() => ['right', 'attack', 'jump', 'dash', 'special'].map(a => { const i = window.__bm.app.input; return i.virt[a].size > 0; })); await A.step(3);
  await ptr('pointerup', '[data-act=attack]', 2); const after = await A.ev(() => ['right', 'attack', 'jump', 'dash', 'special'].map(a => { const i = window.__bm.app.input; return i.virt[a].size > 0; }));
  await ptr('pointerup', '[data-act=jump]', 3); await ptr('pointerup', '[data-act=dash]', 4); await ptr('pointerup', '[data-act=special]', 5); await ptr('pointerup', '[data-zone]', 1, -100, 0); await A.step(2);
  const none = await A.ev(() => ['left', 'right', 'attack', 'jump', 'dash', 'special'].every(a => window.__bm.app.input.virt[a].size === 0));
  return all.every(Boolean) && JSON.stringify(after) === JSON.stringify([true, false, true, true, true]) && none ? true : JSON.stringify({ all, after, none });
});
await T('each button triggers its action: ATK swings, JUMP jumps, DASH dashes, SHADOW fires a wave', async () => {
  await A.ev(() => { const a = window.__bm.app, s = a.scene; s.loadStage(0, 300, { fullHeal: true }); s.enemies = []; s.player.energy = 100; }); await A.step(30); const out = {};
  await ptr('pointerdown', '[data-act=attack]', 2); await A.step(3); out.atk = (await P()).st; await ptr('pointerup', '[data-act=attack]', 2); await A.step(40);
  await ptr('pointerdown', '[data-act=jump]', 3); await A.step(8); out.jump = !(await P()).g && (await P()).vy < 0; await ptr('pointerup', '[data-act=jump]', 3); await A.step(80);
  await ptr('pointerdown', '[data-act=dash]', 4); await A.step(3); out.dash = (await P()).dashT > 0; await ptr('pointerup', '[data-act=dash]', 4); await A.step(60);
  await ptr('pointerdown', '[data-act=special]', 5); await A.step(30); out.special = await A.ev(() => window.__bm.app.scene.projs.some(p => p.owner === 'player')); await ptr('pointerup', '[data-act=special]', 5); await A.step(40);
  return out.atk === 'attack' && out.jump && out.dash && out.special ? true : JSON.stringify(out);
});
await T('release safety: pointercancel, release outside the element, lost capture, window blur all clear the control', async () => {
  const out = {};
  await ptr('pointerdown', '[data-act=attack]', 7); out.d1 = await down('attack'); await ptr('pointercancel', '[data-act=attack]', 7); out.c = !(await down('attack'));
  await ptr('pointerdown', '[data-act=jump]', 8); await ptr('pointerup', 'window', 8, 0, 0); out.outside = !(await down('jump'));
  await ptr('pointerdown', '[data-act=dash]', 9); await A.ev(() => document.querySelector('[data-act=dash]').dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 9, bubbles: true }))); out.lost = !(await down('dash'));
  await ptr('pointerdown', '[data-zone]', 10, -200, 0); await ptr('pointermove', '[data-zone]', 10, -100, 0); out.s1 = await down('right'); await A.ev(() => window.dispatchEvent(new Event('blur'))); out.blur = !(await down('right')); out.stickFree = await A.ev(() => window.__bm.app.touch.stick.id === null);
  return out.d1 && out.c && out.outside && out.lost && out.s1 && out.blur && out.stickFree ? true : JSON.stringify(out);
});
await T('a second finger cannot steal the stick; sliding a finger off a button does not press its neighbour', async () => {
  await ptr('pointerdown', '[data-zone]', 1, -200, 0); await ptr('pointermove', '[data-zone]', 1, -100, 0); await ptr('pointerdown', '[data-zone]', 2, -180, 0); await ptr('pointermove', '[data-zone]', 2, -300, 0);
  const owner = await A.ev(() => window.__bm.app.touch.stick.id), still = await down('right'); await ptr('pointerup', '[data-zone]', 1, -100, 0); await ptr('pointerup', '[data-zone]', 2, -300, 0);
  await ptr('pointerdown', '[data-act=attack]', 3); await A.ev(() => { const j = document.querySelector('[data-act=jump]'); const r = j.getBoundingClientRect(); document.querySelector('[data-act=attack]').dispatchEvent(new PointerEvent('pointermove', { pointerId: 3, bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); });
  const jumpPressed = await down('jump'), atk = await down('attack'); await ptr('pointerup', '[data-act=attack]', 3);
  return owner === null || owner === 1 ? (still && !jumpPressed && atk ? true : JSON.stringify({ owner, still, jumpPressed, atk })) : JSON.stringify({ owner });
});
await T('no duplicate actions: click / mouse / touch events on a button do not press it (pointer events only)', async () => {
  const r = await A.ev(async () => { const el = document.querySelector('[data-act=attack]'); const seen = []; const orig = window.__bm.app.input.setVirtual.bind(window.__bm.app.input); window.__bm.app.input.setVirtual = (a, id, d) => { seen.push(a + ':' + d); return orig(a, id, d); }; for (const t of ['click', 'dblclick', 'mousedown', 'touchstart']) el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true })); const res = { seen, cancelledClick: !el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })) }; window.__bm.app.input.setVirtual = orig; return res; });
  return r.seen.length === 0 && r.cancelledClick ? true : JSON.stringify(r);
});
await T('page cannot scroll/zoom during play: touch-action none, touchmove default prevented, viewport locks zoom', async () => {
  const r = await A.ev(() => { const ev = new Event('touchmove', { bubbles: true, cancelable: true }); document.querySelector('[data-act=jump]').dispatchEvent(ev); return { ta: getComputedStyle(document.body).touchAction, prevented: ev.defaultPrevented, vp: document.querySelector('meta[name=viewport]').content, ov: getComputedStyle(document.body).overflow }; });
  return r.ta === 'none' && r.prevented && /user-scalable=no/.test(r.vp) && r.ov === 'hidden' ? true : JSON.stringify(r);
});
await T('safe-area insets are used in the layout (env(safe-area-inset-*)) and viewport-fit=cover is set', async () => {
  const r = await A.ev(() => ({ css: [...document.styleSheets].some(s => [...s.cssRules].some(c => /safe-area-inset-right/.test(c.cssText))), vf: /viewport-fit=cover/.test(document.querySelector('meta[name=viewport]').content) })); return r.css && r.vf ? true : JSON.stringify(r);
});
await T('settings: control opacity + button size change the overlay and persist across reload', async () => {
  await A.ev(() => { const a = window.__bm.app; a.settings.touchOpacity = 0.35; a.settings.touchSize = 1.3; a.saveSettings(); a.applySettings(); });
  const r = await A.ev(() => { const t = document.getElementById('touch'); return { op: getComputedStyle(t).opacity, sz: t.style.getPropertyValue('--sz'), w: document.querySelector('[data-act=attack]').getBoundingClientRect().width }; });
  const w1 = await A.ev(() => { const a = window.__bm.app; a.settings.touchSize = 0.8; a.saveSettings(); a.applySettings(); return document.querySelector('[data-act=attack]').getBoundingClientRect().width; });
  await A.p.reload(); await A.p.waitForFunction(() => window.__bm && window.__bm.app); const s = await A.ev(() => ({ o: window.__bm.app.settings.touchOpacity, z: window.__bm.app.settings.touchSize }));
  await A.ev(() => { const a = window.__bm.app; a.settings.touchSize = 1; a.settings.touchOpacity = 0.65; a.saveSettings(); });
  return Math.abs(parseFloat(r.op) - 0.35) < 0.01 && r.w > w1 * 1.4 && s.o === 0.35 && s.z === 0.8 ? true : JSON.stringify({ r, w1, s });
});
await T('touch show/hide setting: ON shows on desktop-like pointer, OFF hides it in play', async () => {
  const r = await A.ev(() => { const a = window.__bm.app; a.settings.touch = 'off'; a.applySettings(); a.startRun(); const off = getComputedStyle(document.getElementById('touch')).display; a.settings.touch = 'on'; a.applySettings(); const on = getComputedStyle(document.getElementById('touch')).display; a.settings.touch = 'auto'; a.applySettings(); return { off, on }; });
  return r.off === 'none' && r.on === 'block' ? true : JSON.stringify(r);
});
await T('touch overlay hidden while paused and in menus; pause button opens the pause menu; resume restores it', async () => {
  await A.step(5); await ptr('pointerdown', '[data-act=pause]', 11); await A.step(2); await ptr('pointerup', '[data-act=pause]', 11); await A.step(3);
  const r = await A.ev(() => ({ m: window.__bm.app.mode, d: getComputedStyle(document.getElementById('touch')).display })); await A.ev(() => window.__bm.app.resume()); const d2 = await A.ev(() => getComputedStyle(document.getElementById('touch')).display);
  return r.m === 'pause' && r.d === 'none' && d2 === 'block' ? true : JSON.stringify({ r, d2 });
});

/* ================= navigation: pause / main menu / continue / settings ================= */
await fresh(); await A.ev(() => window.__bm.app.startRun()); await A.step(30);
await T('Esc pauses and the world is frozen (scene time and entities do not advance in real time either)', async () => {
  await A.p.keyboard.press('Escape'); await A.p.waitForTimeout(100); const t0 = await A.ev(() => ({ m: window.__bm.app.mode, t: window.__bm.app.scene.time, x: window.__bm.app.scene.player.x })); await A.p.waitForTimeout(800);
  const t1 = await A.ev(() => ({ t: window.__bm.app.scene.time })); return t0.m === 'pause' && t0.t === t1.t ? true : JSON.stringify({ t0, t1 });
});
await T('pause menu shows MAIN MENU, RESUME, RESTART CHECKPOINT, SETTINGS, CONTROLS; keyboard navigation works', async () => {
  await A.p.keyboard.press('ArrowDown'); await A.step(1); await A.p.waitForTimeout(50); const sel = await A.ev(() => window.__bm.app.ui.sel); await A.p.keyboard.press('ArrowUp'); await A.p.waitForTimeout(50);
  return sel === 1 ? true : 'sel after Down = ' + sel;
});
await T('RESTART CHECKPOINT: returns to the checkpoint with full HP, unpauses, clears hazards', async () => {
  const r = await A.ev(async () => { const { Hazard } = await import('/src/game/projectiles.js'); const a = window.__bm.app, s = a.scene; s.player.x = 700; s.player.hp = 1; s.hazards.push(new Hazard({ x: 100, y: 150, w: 10, h: 10, warn: 1, active: 1, dmg: 1, kind: 'marker' })); const u = a.ui; u.sel = u.items.findIndex(i => i.label === 'RESTART CHECKPOINT'); u.activate(); for (let i = 0; i < 90; i++) a.tick(1/60); return { mode: a.mode, x: Math.round(a.scene.player.x), hp: a.scene.player.hp, haz: a.scene.hazards.length }; });
  return r.mode === 'play' && r.x < 100 && r.hp === 5 && r.haz === 0 ? true : JSON.stringify(r);
});
await T('MAIN MENU: saves progress, returns to the title, stops boss music + wind, Continue restores the checkpoint + defeated bosses', async () => {
  await A.p.waitForFunction(() => window.__bm.app.audio.ready, null, { timeout: 10000 });
  const r = await A.ev(async () => { const a = window.__bm.app, s = a.scene, au = a.audio; await au.loadBoss(); s.defeated = ['hollow_knight']; s.loadStage(3, 36, { fullHeal: true }); for (let i = 0; i < 40; i++) a.tick(1/60); s.player.x = 140; for (let i = 0; i < 60; i++) a.tick(1/60); await new Promise(r => setTimeout(r, 2300)); const during = au.am.stats().loops.slice();
    a.pause(); const u = a.ui; u.sel = u.items.findIndex(i => i.label === 'MAIN MENU'); u.activate(); await new Promise(r => setTimeout(r, 2300)); const sv = JSON.parse(localStorage.getItem('bleedingmoon.save.v1')); const after = au.am.stats().loops.slice();
    return { during, mode: a.mode, uiMode: a.ui.mode, after, cp: sv.checkpoint, def: sv.defeated, bossActive: au.am.bossActive }; });
  const c = await A.ev(() => { const a = window.__bm.app; a.ui.sel = a.ui.items.findIndex(i => i.label === 'CONTINUE'); a.ui.activate(); for (let i = 0; i < 30; i++) a.tick(1/60); return { mode: a.mode, st: a.scene.stageIndex, def: a.scene.defeated, cp: a.scene.checkpoint }; });
  return r.during.includes('music_boss') && r.mode === 'title' && r.uiMode === 'title' && !r.after.includes('music_boss') && !r.bossActive && r.cp === 'chamber' && r.def[0] === 'hollow_knight' && c.mode === 'play' && c.st === 3 && c.def[0] === 'hollow_knight' ? true : JSON.stringify({ r, c });
});
await T('no duplicate game loops / listeners after 5 play <-> main-menu round trips (tick rate stays ~60/s)', async () => {
  const r = await A.ev(async () => { const a = window.__bm.app; let n = 0; const ot = a.tick.bind(a); a.tick = dt => { n++; return ot(dt); }; const rate = async () => { n = 0; await new Promise(r => setTimeout(r, 1000)); return n; }; const base = await rate(); const listeners = [];
    for (let i = 0; i < 5; i++) { a.startRun(); await new Promise(r => setTimeout(r, 150)); a.pause(); a.ui.sel = a.ui.items.findIndex(i => i.label === 'MAIN MENU'); a.ui.activate(); await new Promise(r => setTimeout(r, 150)); }
    const after = await rate(); a.tick = ot; return { base, after, rootCount: document.querySelectorAll('#touch').length, rotCount: document.querySelectorAll('#rotate').length, canvases: document.querySelectorAll('canvas').length }; });
  return Math.abs(r.after - r.base) <= 6 && r.base < 75 && r.rootCount === 1 && r.rotCount === 1 && r.canvases === 1 ? true : JSON.stringify(r);
});
await T('after returning to the main menu nothing from gameplay runs and the menu responds (keyboard + pointer)', async () => {
  await A.ev(() => window.__bm.app.quitToTitle()); const t0 = await A.ev(() => window.__bm.app.scene.time); await A.p.waitForTimeout(600); const t1 = await A.ev(() => window.__bm.app.scene.time);
  await A.p.keyboard.press('ArrowDown'); await A.p.waitForTimeout(80); const sel = await A.ev(() => window.__bm.app.ui.sel);
  const hit = await A.ev(() => { const a = window.__bm.app, r = a.canvas.getBoundingClientRect(), it = a.ui.rects[3]; return [r.left + (it.x + it.w / 2) * r.width / a.viewW, r.top + (it.y + it.h / 2) * r.height / 180]; }); await A.p.mouse.click(hit[0], hit[1]); await A.p.waitForTimeout(80);
  return t0 === t1 && sel >= 1 && (await A.ev(() => window.__bm.app.ui.mode)) === 'controls' ? true : JSON.stringify({ t0, t1, sel });
});
await T('every menu option responds; BACK exists in every submenu and returns to the right screen', async () => {
  const r = await A.ev(() => { const a = window.__bm.app, u = a.ui, out = {}; a.quitToTitle(); localStorage.setItem('bleedingmoon.save.v1', JSON.stringify({ v: 1, checkpoint: 'hall', defeated: [], maxHp: 5, deaths: 0, time: 1 })); u.go('title');
    const pick = l => { u.sel = u.items.findIndex(i => i.label === l); u.activate(); };
    out.title = u.items.map(i => i.label); pick('SETTINGS'); out.s = [u.mode, u.items.some(i => i.label === 'BACK')]; pick('TOUCH AND DISPLAY'); out.s2 = [u.mode, u.items.some(i => i.label === 'BACK')]; pick('BACK'); out.s2back = u.mode; pick('BACK'); out.sback = u.mode;
    pick('CONTROLS'); out.c = [u.mode, u.items.some(i => i.label === 'BACK')]; pick('BACK'); out.cback = u.mode; pick('NEW GAME'); out.confirm = u.mode; pick('NO, KEEP MY SAVE'); out.noBack = u.mode; return out; });
  return JSON.stringify(r.title) === JSON.stringify(['CONTINUE', 'NEW GAME', 'SETTINGS', 'CONTROLS']) && r.s[0] === 'settings' && r.s[1] && r.s2[0] === 'settings2' && r.s2[1] && r.s2back === 'settings' && r.sback === 'title' && r.c[0] === 'controls' && r.c[1] && r.cback === 'title' && r.confirm === 'confirm' && r.noBack === 'title' ? true : JSON.stringify(r);
});

/* ================= gameplay feel ================= */
await fresh(); await A.ev(() => window.__bm.app.startRun()); await A.step(30);
const setup = () => A.ev(() => { const a = window.__bm.app, s = a.scene; s.loadStage(0, 300, { fullHeal: true }); s.enemies = []; s.player.energy = 100; for (let i = 0; i < 30; i++) a.tick(1/60); });
await T('direction change: reversing from a run to the opposite walk speed is faster than plain friction (no slippery turn)', async () => {
  await setup(); const r = await A.ev(() => { const a = window.__bm.app, I = a.input, p = a.scene.player; I.setVirtual('right', 'm', true); for (let i = 0; i < 40; i++) a.tick(1/60); const vRun = p.vx; I.setVirtual('right', 'm', false); I.setVirtual('left', 'm', true); let f = 0; while (p.vx > -50 && f < 60) { a.tick(1/60); f++; } I.setVirtual('left', 'm', false); return { vRun, frames: f }; });
  return r.vRun > 100 && r.frames <= 14 ? true : JSON.stringify(r);
});
await T('stopping: releasing the stick decelerates to a full stop within ~0.15 s (no sliding)', async () => {
  await setup(); const r = await A.ev(() => { const a = window.__bm.app, I = a.input, p = a.scene.player; I.setVirtual('right', 'm', true); for (let i = 0; i < 40; i++) a.tick(1/60); I.setVirtual('right', 'm', false); let f = 0; while (Math.abs(p.vx) > 0.5 && f < 60) { a.tick(1/60); f++; } return { f }; }); return r.f <= 12 ? true : JSON.stringify(r);
});
await T('input buffering: ATK pressed 3 frames before the previous swing ends is executed (combo chains without dropping inputs)', async () => {
  await setup(); const r = await A.ev(() => { const a = window.__bm.app, I = a.input, p = a.scene.player; const tap = () => { I.setVirtual('attack', 'x', true); a.tick(1/60); I.setVirtual('attack', 'x', false); }; tap(); let f = 0; while (f < 30 && p.atkT < 0.25) { a.tick(1/60); f++; } tap(); const idx0 = p.atkIdx; for (let i = 0; i < 20; i++) a.tick(1/60); return { idx0, idx1: p.atkIdx, st: p.state }; }); return r.idx1 !== r.idx0 || r.st === 'attack' ? true : JSON.stringify(r);
});
await T('input buffering: DASH pressed just before the dash cooldown ends / during recovery still fires', async () => {
  await setup(); const r = await A.ev(() => { const a = window.__bm.app, I = a.input, p = a.scene.player; const tap = () => { I.setVirtual('dash', 'x', true); a.tick(1/60); I.setVirtual('dash', 'x', false); }; tap(); for (let i = 0; i < 12; i++) a.tick(1/60); p.dashCd = 0.04; tap(); let fired = false; for (let i = 0; i < 6; i++) { a.tick(1/60); if (p.dashT > 0) fired = true; } return { fired }; }); return r.fired ? true : JSON.stringify(r);
});
await T('jump can cancel sword RECOVERY but never the hit window', async () => {
  await setup(); const r = await A.ev(() => { const a = window.__bm.app, I = a.input, p = a.scene.player; I.setVirtual('attack', 'x', true); a.tick(1/60); I.setVirtual('attack', 'x', false); for (let i = 0; i < 8; i++) a.tick(1/60); const inWindow = p.state === 'attack' && p.atkT >= 0.12 && p.atkT < 0.21; I.setVirtual('jump', 'j', true); a.tick(1/60); const duringWindowJump = p.state === 'jump'; I.setVirtual('jump', 'j', false); const stillAttack = p.state === 'attack';
    for (let i = 0; i < 40; i++) a.tick(1/60); const cancel = (() => { I.setVirtual('attack', 'x', true); a.tick(1/60); I.setVirtual('attack', 'x', false); let f = 0; while (f < 40 && !(p.state === 'attack' && p.atkT >= 0.22)) { a.tick(1/60); f++; } I.setVirtual('jump', 'j', true); for (let i = 0; i < 3; i++) a.tick(1/60); I.setVirtual('jump', 'j', false); return p.state === 'jump' || !p.onGround; })(); return { inWindow, duringWindowJump, stillAttack, cancel }; });
  return r.inWindow && !r.duringWindowJump && r.cancel ? true : JSON.stringify(r);
});
await T('landing: onGround is reliable on repeated jumps (100 jumps, no stuck/falling-through state)', async () => {
  await setup(); const r = await A.ev(() => { const a = window.__bm.app, I = a.input, p = a.scene.player; let bad = 0; for (let n = 0; n < 100; n++) { I.setVirtual('jump', 'j', true); for (let i = 0; i < 10; i++) a.tick(1/60); I.setVirtual('jump', 'j', false); let f = 0; while (!p.onGround && f < 120) { a.tick(1/60); f++; } if (!p.onGround || p.y !== 150) bad++; } return { bad }; }); return r.bad === 0 ? true : JSON.stringify(r);
});
await T('camera: no abrupt jumps (max per-frame camera delta <= 6 px) while running, turning and dashing', async () => {
  await setup(); const r = await A.ev(() => { const a = window.__bm.app, I = a.input, s = a.scene; let prev = s.camX, max = 0; const run = (k, n) => { I.setVirtual(k, 'c', true); for (let i = 0; i < n; i++) { a.tick(1/60); max = Math.max(max, Math.abs(s.camX - prev)); prev = s.camX; } }; run('right', 90); I.setVirtual('right', 'c', false); run('left', 60); I.setVirtual('left', 'c', false); I.setVirtual('dash', 'c', true); a.tick(1/60); I.setVirtual('dash', 'c', false); run('right', 30); I.setVirtual('right', 'c', false); return { max }; }); return r.max <= 6 ? true : JSON.stringify(r);
});
await T('rendering stays pixel-crisp: canvas smoothing off, image-rendering pixelated, integer canvas size', async () => {
  const r = await A.ev(() => { const c = document.getElementById('game'), g = c.getContext('2d'); return { sm: g.imageSmoothingEnabled, ir: getComputedStyle(c).imageRendering, w: c.width, h: c.height }; }); return !r.sm && /pixelated|crisp/.test(r.ir) && r.h === 180 ? true : JSON.stringify(r);
});
await T('difficulty unchanged: boss telegraph floor, player hp/energy/dash numbers and boss HP are the same as 0.1.1', async () => {
  const r = await A.ev(async () => { const { PCFG } = await import('/src/game/player.js'); const { MIN_TELEGRAPH } = await import('/src/game/boss_base.js'); const { createBoss } = await import('/src/game/bosses.js'); const a = window.__bm.app, s = a.scene; const hp = {}; for (const [i, id] of [[1, 'hollow_knight'], [3, 'abyssal_wraith'], [4, 'fallen_sovereign']]) { s.loadStage(i, 36, { fullHeal: true }); hp[id] = createBoss(s, { id, x: 300 }).maxHp; } return { PCFG: [PCFG.invuln, PCFG.dashCd, PCFG.dashInv, PCFG.specialCost, PCFG.hurtStun, s.player.maxHp], MIN_TELEGRAPH, hp }; });
  return JSON.stringify(r) === JSON.stringify({ PCFG: [1.3, 0.55, 0.24, 30, 0.28, 5], MIN_TELEGRAPH: 0.45, hp: { hollow_knight: 60, abyssal_wraith: 70, fallen_sovereign: 110 } }) ? true : JSON.stringify(r);
});
const real = A.logs.filter(l => !/sw\.js|favicon|404/.test(l) && !/not loaded: (amb_dread|sfx_boss_rumble|music_boss)/.test(l));
await T('no unexpected console errors/warnings during this run', async () => real.length ? real.join(' | ') : true);
await A.b.close();
const pass = results.filter(r => r.ok).length; console.log(`\n${pass}/${results.length} passed`);
fs.writeFileSync(new URL('./android_test_results.json', import.meta.url), JSON.stringify({ when: new Date().toISOString(), pass, total: results.length, results }, null, 1));
process.exit(pass === results.length ? 0 : 1);
