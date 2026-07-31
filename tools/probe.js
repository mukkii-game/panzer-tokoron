// 自機が見えなくなる問題の診断
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = fileURLToPath(new URL('./shots/', import.meta.url));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const profileDir = path.join(os.tmpdir(), 'tokoron_probe_' + Date.now());
const portFile = path.join(profileDir, 'DevToolsActivePort');
const edgeProc = spawn(EDGE, ['--remote-debugging-port=0', '--headless=new', `--user-data-dir=${profileDir}`,
  '--window-size=1280,720', '--mute-audio', '--no-first-run', '--disable-gpu',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: 'ignore' });

let browser = null;
for (let i = 0; i < 40 && !browser; i++) {
  await sleep(500);
  try {
    if (!fs.existsSync(portFile)) continue;
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
    if (port) browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null });
  } catch {}
}
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('http://localhost:8123/', { waitUntil: 'networkidle2' });
await sleep(800);
await page.click('#start-btn');
await sleep(2000);

const dump = () => page.evaluate(() => ({
  pos: game.player.pos.toArray().map(v => +v.toFixed(2)),
  groupPos: game.player.group.position.toArray().map(v => +v.toFixed(2)),
  visible: game.player.group.visible,
  inScene: game.player.group.parent === game.scene,
  scale: game.player.group.scale.toArray(),
  rot: [game.player.group.rotation.x, game.player.group.rotation.y, game.player.group.rotation.z].map(v => +v.toFixed(2)),
  cam: game.camera.position.toArray().map(v => +v.toFixed(2)),
  hp: game.player.hp, dead: game.player.dead, invuln: +game.player.invuln.toFixed(2),
}));

console.log('t=2s:', JSON.stringify(await dump()));
await page.screenshot({ path: OUT + 'probe_1.png' });

await page.evaluate(() => { game.player.invuln = 0; game.player.takeHit(game); });
await sleep(3000);
console.log('after hit +3s:', JSON.stringify(await dump()));
await page.screenshot({ path: OUT + 'probe_2.png' });

await page.evaluate(() => { game.enemies.forEach(e => e.remove()); game.world.startBoss(); });
await sleep(3500);
console.log('boss +3.5s:', JSON.stringify(await dump()));
await page.screenshot({ path: OUT + 'probe_3.png' });

await browser.close();
edgeProc.kill();
