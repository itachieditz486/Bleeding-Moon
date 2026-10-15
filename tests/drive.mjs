// Shared helper: launch game, expose page + helpers. Usage in other test scripts.
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ogg': 'audio/ogg', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
// self-contained static server (unref'd), so tests never depend on a separately started http.server
export async function serve() {
  const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); const f = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
    if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(r); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); srv.unref(); return 'http://127.0.0.1:' + srv.address().port + '/';
}
export let A_BASE = null;
export async function launch(opts = {}) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: opts.viewport || { width: 960, height: 540 }, hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const p = await ctx.newPage(); const logs = [];
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text()); }); p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  const base = opts.url ? null : await serve(); A_BASE = base; await p.goto(opts.url || base + 'index.html'); await p.waitForFunction(() => window.__bm && window.__bm.app, null, { timeout: 8000 });
  const A = {
    b, p, logs, ctx,
    ev: (f, a) => p.evaluate(f, a),
    // advance n fixed steps deterministically (bypasses rAF pacing)
    step: n => p.evaluate(n => { const a = window.__bm.app; for (let i = 0; i < n; i++) a.tick(1 / 60); }, n),
    shot: f => p.screenshot({ path: f }),
    hold: (code) => p.keyboard.down(code), release: code => p.keyboard.up(code),
  };
  return A;
}
