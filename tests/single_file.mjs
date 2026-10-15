import { launch } from './drive.mjs';
const A = await launch({ url: 'file:///home/claude/dark-fantasy-game/dist/Bleeding-Moon-single.html' });
await A.p.waitForFunction(() => window.__bm.app.audio.ready, null, { timeout: 15000 });
await A.ev(() => window.__bm.app.startRun()); await A.step(120);
const r = await A.ev(() => { const a = window.__bm.app; return { mode: a.mode, audio: a.audio.am.stats(), stage: a.scene.stageIndex, proto: location.protocol }; });
console.log(JSON.stringify(r)); console.log('logs:', A.logs.join(' | ') || 'none'); await A.b.close();
