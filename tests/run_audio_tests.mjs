// Run:  NODE_PATH=$(npm root -g) node tests/run_audio_tests.mjs
// Drives the real AudioManager in headless Chromium. See TEST_REPORT.md for what this does NOT cover.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO = path.join(ROOT, 'assets/audio');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  - ' + detail : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- static checks on disk (no browser) ---------- */
const manifest = JSON.parse(fs.readFileSync(path.join(AUDIO, 'audio-manifest.json'), 'utf8'));
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const oggOnDisk = walk(AUDIO).filter(f => f.endsWith('.ogg')).map(f => path.relative(AUDIO, f).split(path.sep).join('/')).sort();
const refd = Object.values(manifest.sounds).filter(s => s.file).map(s => s.file).sort();
check('manifest: every referenced file exists', refd.every(f => oggOnDisk.includes(f)), refd.filter(f => !oggOnDisk.includes(f)).join(','));
check('manifest: no orphan .ogg on disk', oggOnDisk.every(f => refd.includes(f)), oggOnDisk.filter(f => !refd.includes(f)).join(','));
const grouped = Object.values(manifest.groups).flat();
const realKeys = Object.entries(manifest.sounds).filter(([, s]) => s.file).map(([k]) => k);
check('manifest: every real sound is in exactly one group', realKeys.every(k => grouped.filter(g => g === k).length === 1) && grouped.every(k => manifest.sounds[k]));
check('manifest: aliases point at real sounds', Object.values(manifest.sounds).filter(s => s.alias).every(s => manifest.sounds[s.alias]?.file));
check('manifest: areas point at loops', Object.values(manifest.areas).every(k => manifest.sounds[k]?.loop));
check('manifest: boss cues reference existing sounds', Object.values(manifest.bossCues).every(b => Object.values(b).flat().every(c => manifest.sounds[c.sound])));
check('manifest: no remote URLs anywhere', !/https?:\/\//.test(JSON.stringify(manifest.sounds) + JSON.stringify(manifest.groups) + JSON.stringify(manifest.areas)));
const mgr = fs.readFileSync(path.join(ROOT, 'src/audio/AudioManager.js'), 'utf8');
check('AudioManager.js contains no http(s) URLs', !/['"`]https?:\/\//.test(mgr));
const bytes = oggOnDisk.reduce((n, f) => n + fs.statSync(path.join(AUDIO, f)).size, 0);
check('total imported audio < 30 MB', bytes < 30 * 1024 * 1024, (bytes / 1048576).toFixed(2) + ' MB');

/* expected durations from ffprobe, to compare with what the browser decodes */
const expected = {};
for (const f of oggOnDisk) expected[f] = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(AUDIO, f)]).toString());

/* ---------- tiny static server ---------- */
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const requests = []; const warnings = []; const httpErrors = [];
  page.on('response', r => { if (r.status() >= 400) httpErrors.push(r.status() + ' ' + r.url()); });
  page.on('request', r => requests.push(r.url()));
  page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') warnings.push(m.text()); });
  page.on('pageerror', e => warnings.push('PAGEERROR ' + e.message));
  await page.goto(`${ORIGIN}/tests/audio_smoke.html`);
  check('init: manager + manifest load', await page.evaluate(() => window.ready), await page.evaluate(() => window.initError || ''));

  const initialState = await page.evaluate(() => audio.ctx.state);
  await page.mouse.click(50, 50);                       // a real user gesture
  await page.waitForFunction(() => audio.ctx.state === 'running', null, { timeout: 4000 }).catch(() => {});
  check('unlock: context is running after a user gesture', await page.evaluate(() => audio.ctx.state) === 'running', `was "${initialState}" before the click`);

  /* loading + decode */
  const loads = await page.evaluate(async () => ({ core: await audio.loadGroup('core'), explore: await audio.loadGroup('explore'), boss: await audio.loadGroup('boss') }));
  const failed = Object.values(loads).flatMap(l => l.failed);
  check('load: all groups decode with no failures', failed.length === 0, failed.join(','));
  const st = await page.evaluate(() => audio.stats());
  check('load: all 20 files decoded', st.buffers === 20, `buffers=${st.buffers}, decoded PCM ~${st.decodedMB} MB`);
  const durs = await page.evaluate(() => { const o = {}; for (const [f, b] of audio.buffers) o[f] = b.duration; return o; });
  const bad = Object.entries(expected).filter(([f, d]) => Math.abs((durs[f] ?? -1) - d) > 0.05);
  check('decode: browser durations match ffprobe (+-50 ms)', bad.length === 0, bad.map(([f, d]) => `${f} ${d.toFixed(2)} vs ${(durs[f] ?? -1).toFixed(2)}`).join('; '));

  /* behaviour */
  const r1 = await page.evaluate(() => { const a = audio.play('sfx_hit_sword'); const b = audio.play('sfx_hit_sword'); return [!!a, !!b]; });
  check('play: cooldown suppresses a same-frame repeat', r1[0] === true && r1[1] === false, JSON.stringify(r1));
  const maxV = await page.evaluate(async () => { let m = 0; for (let i = 0; i < 6; i++) { audio.play('sfx_explosion'); m = Math.max(m, (audio.voices.get('sfx_explosion') || []).length); await new Promise(r => setTimeout(r, 140)); } return m; });
  check('play: maxVoices cap holds for rapid repeats', maxV >= 1 && maxV <= 2, `peak simultaneous sfx_explosion voices ${maxV} (cap 2)`);
  const unk = await page.evaluate(() => { try { return [audio.play('does_not_exist'), audio.cue('nobody', 'telegraph'), audio.enterArea('nowhere')].map(v => v == null); } catch (e) { return 'threw: ' + e; } });
  check('robustness: unknown keys/cues/areas are silent no-ops', Array.isArray(unk) && unk.every(Boolean), JSON.stringify(unk));

  /* real signal path: tap the master gain with an analyser */
  await page.evaluate(() => { audio.setMuted(false); window.an = audio.ctx.createAnalyser(); an.fftSize = 2048; audio.master.connect(an); });
  const peak = () => page.evaluate(async () => { await new Promise(r => setTimeout(r, 120)); const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d); return Math.max(...d.map(Math.abs)); });
  await sleep(300); await page.evaluate(() => audio.play('ui_confirm'));
  const pOn = await peak();
  check('signal: a played sound reaches the output bus', pOn > 0.01, `peak ${pOn.toFixed(3)}`);
  await sleep(1200);
  await page.evaluate(() => { audio.setMuted(true); });
  await sleep(150); await page.evaluate(() => audio.play('sfx_explosion'));
  const pMute = await peak();
  check('signal: mute silences the output', pMute < 0.001, `peak ${pMute.toFixed(5)}`);
  await page.evaluate(() => audio.setMuted(false));

  /* boss flow */
  await sleep(300);
  const flow = await page.evaluate(async () => {
    const out = {}; audio.enterArea('castle_exploration'); out.explore = audio.stats().loops;
    audio.enterBoss('hollow_knight'); out.bossAtOnce = audio.stats().loops;
    await new Promise(r => setTimeout(r, 1800)); out.bossLater = audio.stats().loops;
    audio.exitBoss(); out.afterExit = audio.stats().loops; return out;
  });
  check('area: exploration ambience starts', flow.explore.includes('amb_exploration'), JSON.stringify(flow.explore));
  check('boss: ambience stops immediately on boss entry', !flow.bossAtOnce.includes('amb_exploration'), JSON.stringify(flow.bossAtOnce));
  check('boss: boss music starts after the spawn cue delay', flow.bossLater.includes('music_boss'), JSON.stringify(flow.bossLater));
  check('boss: exit restores ambience and stops boss music', flow.afterExit.includes('amb_exploration') && !flow.afterExit.includes('music_boss'), JSON.stringify(flow.afterExit));
  const warnBefore = warnings.length;
  const cueRun = await page.evaluate(async () => {
    try {
      let started = 0;
      for (const b of ['hollow_knight', 'abyssal_wraith', 'fallen_sovereign']) {
        for (const k of ['spawn', 'telegraph', 'phase', 'defeat']) { audio.cue(b, k); started += audio.stats().voices > 0 ? 1 : 0; await new Promise(r => setTimeout(r, 450)); }
      }
      return { ok: true, started };
    } catch (e) { return { ok: false, err: String(e) }; }
  });
  const cueWarns = warnings.slice(warnBefore).filter(w => w.includes('[audio]'));
  check('boss: 3 bosses x spawn/telegraph/phase/defeat cues play with no error or [audio] warning', cueRun.ok && cueWarns.length === 0 && cueRun.started >= 10, `voices were live after ${cueRun.started}/12 cues; warnings: ${cueWarns.join(' | ') || 'none'}`);
  await page.evaluate(() => { audio.stopLoop('amb_exploration', 0.1); });

  /* memory + persistence */
  const before = (await page.evaluate(() => audio.stats())).decodedMB;
  await page.evaluate(() => audio.unloadGroup('boss'));
  const after = await page.evaluate(() => audio.stats());
  check('memory: unloadGroup("boss") frees its buffers', after.decodedMB < before && after.buffers === 17, `${before} MB -> ${after.decodedMB} MB, ${after.buffers} buffers`);
  await page.evaluate(() => { audio.setMasterVolume(0.37); audio.setBusVolume('music', 0.2); audio.setMuted(true); });
  await page.reload(); await page.evaluate(() => window.ready);
  const persisted = await page.evaluate(() => audio.settings);
  check('settings: master volume, bus volume and mute persist across reload', persisted.master === 0.37 && persisted.buses.music === 0.2 && persisted.muted === true, JSON.stringify(persisted));

  /* network: nothing leaves the origin */
  const foreign = requests.filter(u => !u.startsWith(ORIGIN));
  check('offline: every request stayed on the local origin', foreign.length === 0, foreign.join(','));
  const realErrors = httpErrors.filter(e => !e.includes('favicon'));
  check('network: no failed requests (favicon ignored)', realErrors.length === 0, httpErrors.join(' | ') || 'none');
  check('console: no page errors during run', !warnings.some(w => w.startsWith('PAGEERROR')), warnings.slice(0, 3).join(' | '));
  const warnList = warnings.filter(w => !w.startsWith('PAGEERROR'));
  console.log(`info  console warnings/errors seen: ${warnList.length}${warnList.length ? ' -> ' + warnList.slice(0, 4).join(' | ') : ''}`);
  await ctx.close();

  /* file:// mode, simulating an Android WebView with file access enabled (needs the flag in desktop Chromium) */
  const b2 = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const p2 = await (await b2.newContext()).newPage();
  await p2.goto(pathToFileURL(path.join(ROOT, 'tests/audio_smoke.html')).href);
  const ok2 = await p2.evaluate(() => window.ready);
  const l2 = ok2 ? await p2.evaluate(async () => { const r = await audio.loadGroup('core'); return { loaded: r.loaded.length, failed: r.failed }; }) : { loaded: 0, failed: ['init'] };
  check('file://: manifest + core group load via XHR (WebView simulation)', ok2 && l2.failed.length === 0 && l2.loaded === 16, JSON.stringify(l2));
  await b2.close();
} finally { await browser.close(); server.close(); }

const failedN = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failedN}/${results.length} passed`);
process.exit(failedN ? 1 : 0);
