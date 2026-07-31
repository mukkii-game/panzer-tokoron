// Edgeヘッドレスでゲームを起動し、各シーンのスクリーンショットを撮る検証スクリプト
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:8123/';
const OUT = fileURLToPath(new URL('./shots/', import.meta.url));

fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// puppeteer.launch がこの環境で失敗するため、Edgeを自前起動し、
// プロファイルの DevToolsActivePort から実際のCDPポートを読んで接続する
import { spawn } from 'child_process';
const profileDir = path.join(os.tmpdir(), 'tokoron_pptr_' + Date.now());
const portFile = path.join(profileDir, 'DevToolsActivePort');
const edgeProc = spawn(EDGE, [
  '--remote-debugging-port=0',
  '--headless=new',
  `--user-data-dir=${profileDir}`,
  '--window-size=1280,720',
  '--autoplay-policy=no-user-gesture-required',
  '--mute-audio', '--no-first-run', '--no-default-browser-check', '--disable-gpu',
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
await sleep(1500);
await page.screenshot({ path: OUT + '01_title.png' });

// ゲーム開始
await page.click('#start-btn');
await sleep(5000); // AREA1 焼だんご出現あたり
await page.evaluate(() => { game.input.aim = { x: 640, y: 300 }; game.weapons.fireShot(); });
await sleep(500);
await page.screenshot({ path: OUT + '02_area1.png' });

// AREA2 商店街へジャンプ
await page.evaluate(() => { game.world.time = 36.5; });
await sleep(4500);
await page.screenshot({ path: OUT + '03_area2_street.png' });

// AREA3 公園へ
await page.evaluate(() => { game.world.time = 72.5; game.enemies.forEach(e => e.remove()); });
await sleep(4500);
await page.screenshot({ path: OUT + '04_area3_park.png' });

// AREA4 基地へ
await page.evaluate(() => { game.world.time = 105.5; game.enemies.forEach(e => e.remove()); });
await sleep(4500);
await page.screenshot({ path: OUT + '05_area4_base.png' });

// ボス
await page.evaluate(() => { game.enemies.forEach(e => e.remove()); game.world.startBoss(); });
await sleep(4000);
await page.screenshot({ path: OUT + '06_boss.png' });

// 表情テスト: 焦り顔
await page.evaluate(() => game.player.setExpression('panic', 5));
await sleep(300);
await page.screenshot({ path: OUT + '07_panic_face.png' });

console.log('=== errors ===');
console.log(errors.length ? errors.join('\n') : '(none)');
await browser.close();
edgeProc.kill();
