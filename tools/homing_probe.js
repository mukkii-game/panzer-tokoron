// Homing missile smoke trail + low-flight ground proximity probe
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:8123/';
const OUT = fileURLToPath(new URL('./shots/', import.meta.url));
const sleep = ms => new Promise(r => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });

const profileDir = path.join(os.tmpdir(), 'tokoron_homing_' + Date.now());
const portFile = path.join(profileDir, 'DevToolsActivePort');
const edgeProc = spawn(EDGE, [
  '--remote-debugging-port=0',
  '--headless=new',
  `--user-data-dir=${profileDir}`,
  '--window-size=1280,720',
  '--autoplay-policy=no-user-gesture-required',
  '--mute-audio', '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  'about:blank',
], { stdio: 'ignore', detached: false });

let browser = null;
for (let i = 0; i < 40 && !browser; i++) {
  await sleep(500);
  try {
    if (!fs.existsSync(portFile)) continue;
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
    if (!port) continue;
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null });
  } catch { /* retry */ }
}
if (!browser) { edgeProc.kill(); throw new Error('Edgeに接続できませんでした'); }

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
page.on('pageerror', e => errors.push('[pageerror] ' + e.message));

await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 30000 });
await sleep(1000);
await page.click('#start-btn');

// Wait for enemies (AREA1 dangos ~t=3)
let enemyCount = 0;
for (let i = 0; i < 30; i++) {
  await sleep(500);
  enemyCount = await page.evaluate(() => game.enemies.filter(e => e.alive).length);
  if (enemyCount > 0) break;
}
console.log('enemies:', enemyCount);

// Lock-on aim at enemies, then release to fire homing missiles
const lockInfo = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  game.input.locking = true;
  const t0 = performance.now();
  const iv = setInterval(() => {
    const e = game.enemies.find(e => e.alive && e.pos.distanceTo(game.player.pos) > 7);
    if (e) {
      const v = e.pos.clone().project(game.camera);
      game.input.aim.x = (v.x + 1) * 0.5 * innerWidth;
      game.input.aim.y = (-v.y + 1) * 0.5 * innerHeight;
    }
    if (performance.now() - t0 > 2500) clearInterval(iv);
  }, 50);
  await sleep(2600);
  const locks = game.weapons.locks.length;
  game.input._lockEnd();
  return { locks };
});
console.log('locks:', lockInfo.locks);

// Wait ~1s while missiles fly with smoke
await sleep(1000);
const mid = await page.evaluate(() => ({
  missiles: game.weapons.missiles.length,
  playerY: +game.player.pos.y.toFixed(3),
}));
console.log('mid-flight:', mid);

const trailPath = path.join(OUT, 'homing_trail.png');
await page.screenshot({ path: trailPath });
console.log('wrote', trailPath, 'exists=', fs.existsSync(trailPath), 'bytes=', fs.existsSync(trailPath) ? fs.statSync(trailPath).size : 0);

// Force low flight and screenshot ground proximity
await page.evaluate(() => { game.player.pos.y = 0.15; });
await sleep(200);
const low = await page.evaluate(() => ({
  playerY: +game.player.pos.y.toFixed(3),
  groupY: +game.player.group.position.y.toFixed(3),
}));
console.log('low-flight:', low);

const lowPath = path.join(OUT, 'low_flight.png');
await page.screenshot({ path: lowPath });
console.log('wrote', lowPath, 'exists=', fs.existsSync(lowPath), 'bytes=', fs.existsSync(lowPath) ? fs.statSync(lowPath).size : 0);

console.log('=== errors ===');
console.log(errors.length ? errors.join('\n') : '(none)');

await browser.close();
edgeProc.kill();
