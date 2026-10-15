import { serve } from './drive.mjs'; import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 960, height: 540 }, serviceWorkers: 'allow' }); const p = await ctx.newPage(); const logs = [];
p.on('pageerror', e => logs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
const BASE = await serve(); await p.goto(BASE + 'index.html'); await p.waitForFunction(() => window.__bm && window.__bm.app.audio.ready, null, { timeout: 15000 });
const sw = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; await new Promise(res => { if (navigator.serviceWorker.controller) res(); else navigator.serviceWorker.addEventListener('controllerchange', res); setTimeout(res, 3000); }); const ks = await caches.keys(); const c = await caches.open(ks[0]); return { scope: r.scope, cache: ks, n: (await c.keys()).length }; });
console.log('SW:', JSON.stringify(sw));
// go offline AND kill the dev server's reachability by blocking the network at the context level
await ctx.setOffline(true); await p.reload(); 
await p.waitForFunction(() => window.__bm && window.__bm.app.audio.ready, null, { timeout: 15000 });
const r = await p.evaluate(() => { const a = window.__bm.app; a.startRun(); for (let i = 0; i < 60; i++) a.tick(1/60); return { online: navigator.onLine, mode: a.mode, buffers: a.audio.am.stats().buffers, x: a.scene.player.x }; });
console.log('OFFLINE:', JSON.stringify(r)); console.log('logs:', logs.join(' | ') || 'none');
// boss audio group also loadable offline
const bg = await p.evaluate(async () => { await window.__bm.app.audio.loadBoss(); return window.__bm.app.audio.am.stats().buffers; }); console.log('buffers after boss group offline:', bg);
await b.close();
