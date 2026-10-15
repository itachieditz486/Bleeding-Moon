import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const logs = []; p.on('console', m => logs.push(m.type() + ': ' + m.text())); p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack||'')));
await p.goto('http://localhost:8123/index.html'); await p.waitForTimeout(1500);
await p.screenshot({ path: process.argv[2] || '/tmp/boot.png' });
console.log(logs.join('\n') || 'no logs'); await b.close();
