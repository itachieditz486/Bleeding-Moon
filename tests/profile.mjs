import { launch } from './drive.mjs';
const A = await launch({ viewport: { width: 1280, height: 720 } }); await A.ev(() => window.__bm.app.startRun());
const r = await A.ev(async () => {
  const bg = await import('/src/art/backgrounds.js'); const app = window.__bm.app, sc = app.scene, g = app.g; const out = {};
  const timeIt = (name, fn, n = 400) => { for (let i = 0; i < 40; i++) fn(); const t = performance.now(); for (let i = 0; i < n; i++) fn(); out[name] = +((performance.now() - t) / n).toFixed(3); };
  for (const [idx, nm] of [[0, 'approach'], [1, 'hall'], [4, 'throne']]) {
    sc.loadStage(idx, 300, { fullHeal: true }); for (let i = 0; i < 90; i++) app.tick(1/60); const st = sc.stage, cam = 100, W = app.viewW;
    timeIt(nm + '.update', () => sc.update(1/60)); timeIt(nm + '.theme', () => bg.drawTheme(g, st.bg, cam, sc.time, W)); timeIt(nm + '.fog', () => bg.drawFog(g, st.bg, cam, sc.time, W));
    timeIt(nm + '.stageSlice', () => g.drawImage(st.canvas, Math.min(cam, st.width - W), 0, W, 180, 0, 0, W, 180)); timeIt(nm + '.lighting', () => sc.drawLighting(g, W)); timeIt(nm + '.fullDraw', () => sc.draw(g));
  } return out; });
console.log(JSON.stringify(r, null, 1)); await A.b.close();
