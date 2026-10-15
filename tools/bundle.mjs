// Dependency-free bundler: ES modules under src/ -> one classic <script> inside a single self-contained HTML file.
// Audio (OGG) and the audio manifest are embedded as base64 in window.__EMBED__, so the file works from file:// and offline.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const out = process.argv[2] || path.join(ROOT, 'dist', 'bleeding-moon-single.html');
const mods = new Map();
function load(rel) {
  if (mods.has(rel)) return; const file = path.join(ROOT, rel); let src = fs.readFileSync(file, 'utf8'); mods.set(rel, null);
  const deps = []; const exportsList = []; let defName = null; const pre = [];
  src = src.replace(/^import\s+(.+?)\s+from\s+'([^']+)';?[ \t]*$/gm, (m, what, from) => {
    const dep = path.posix.normalize(path.posix.join(path.posix.dirname(rel), from)); load(dep); deps.push(dep);
    what = what.trim();
    if (what.startsWith('{')) pre.push(`const ${what.replace(/(\w+)\s+as\s+(\w+)/g, '$1: $2')} = __req(${JSON.stringify(dep)});`);
    else pre.push(`const ${what} = __req(${JSON.stringify(dep)}).default;`);
    return '';
  });
  src = src.replace(/^export default (class|function)\s+(\w+)/gm, (m, k, n) => { defName = n; return `${k} ${n}`; });
  src = src.replace(/^export (const|let|var|function|class|async function)\s+(\w+)/gm, (m, k, n) => { exportsList.push(n); return `${k} ${n}`; });
  src = src.replace(/^export \{([^}]*)\};?/gm, (m, l) => { l.split(',').map(s => s.trim()).filter(Boolean).forEach(n => exportsList.push(n)); return ''; });
  if (/^\s*(import|export)\s/m.test(src.replace(/\/\/.*$/gm, ''))) throw new Error('unhandled import/export syntax in ' + rel);
  const ret = `return { ${exportsList.join(', ')}${defName ? (exportsList.length ? ', ' : '') + 'default: ' + defName : ''} };`;
  mods.set(rel, `__def(${JSON.stringify(rel)}, function () {\n${pre.join('\n')}\n${src}\n${ret}\n});`);
}
load('src/main.js');
const prelude = `var __defs = {}, __cache = {};\nfunction __def(n, f) { __defs[n] = f; }\nfunction __req(n) { if (!__cache[n]) { if (!__defs[n]) throw new Error('module ' + n); __cache[n] = __defs[n](); } return __cache[n]; }\n`;
const body = [...mods.values()].join('\n');
const embed = {}; const A = path.join(ROOT, 'assets', 'audio');
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== 'licenses') walk(p); } else if (/\.(ogg|json)$/.test(f)) embed[path.relative(A, p).split(path.sep).join('/')] = fs.readFileSync(p).toString('base64'); } })(A);
const icon = fs.readFileSync(path.join(ROOT, 'icons', 'icon-192.png')).toString('base64');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#07050d"><title>Bleeding Moon</title><link rel="icon" href="data:image/png;base64,${icon}">
<style>html,body{margin:0;height:100%;background:#07050d;overflow:hidden;overscroll-behavior:none;touch-action:none}
body{display:flex;align-items:center;justify-content:center}
#game{image-rendering:pixelated;image-rendering:crisp-edges;display:block;touch-action:none;-webkit-tap-highlight-color:transparent}</style></head>
<body><canvas id="game" width="320" height="180"></canvas>
<script>window.__EMBED__ = ${JSON.stringify(embed)};</script>
<script>
(function () {
${prelude}
${body}
__req('src/main.js');
})();
</script></body></html>`;
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html);
console.log('wrote', path.relative(ROOT, out), (html.length / 1048576).toFixed(2), 'MB,', mods.size, 'modules,', Object.keys(embed).length, 'embedded files');
