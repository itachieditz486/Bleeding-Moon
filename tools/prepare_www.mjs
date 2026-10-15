// Copies exactly the runtime files into ./www (Capacitor's webDir). Everything stays local: no CDN, no remote fonts, no network needed.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), W = path.join(R, 'www');
fs.rmSync(W, { recursive: true, force: true }); fs.mkdirSync(W, { recursive: true });
for (const f of ['index.html', 'manifest.webmanifest', 'icons', 'src', 'assets', 'CREDITS.md', 'AUDIO_CREDITS.md']) {
  if (!fs.existsSync(path.join(R, f))) throw new Error('missing required file: ' + f);
  fs.cpSync(path.join(R, f), path.join(W, f), { recursive: true });
}
let n = 0, bytes = 0; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else { n++; bytes += fs.statSync(p).size; } } })(W);
console.log(`www ready: ${n} files, ${(bytes / 1048576).toFixed(2)} MB`);
