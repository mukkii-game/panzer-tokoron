// スマホエミュレーション: タッチ操作(左スティック移動/右照準ロック)の検証
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = fileURLToPath(new URL('./shots/', import.meta.url));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const profileDir = path.join(os.tmpdir(), 'tokoron_mob_' + Date.now());
const portFile = path.join(profileDir, 'DevToolsActivePort');
const edgeProc = spawn(EDGE, ['--remote-debugging-port=0', '--headless=new', `--user-data-dir=${profileDir}`,
  '--window-size=400,880', '--mute-audio', '--no-first-run', '--disable-gpu',
  '--disable-backgrounding-occluded-windows', 'about:blank'], { stdio: 'ignore' });

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
await page.emulate({
  viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('http://localhost:8123/', { waitUntil: 'networkidle2' });
await sleep(800);
await page.screenshot({ path: OUT + 'mob_title.png' });
await page.tap('#start-btn');
await sleep(1500);

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}: ${name} ${detail}`);

// --- 左スティックで移動 ---
const posBefore = await page.evaluate(() => game.player.pos.x);
await page.touchscreen.touchStart(80, 600);
await page.touchscreen.touchMove(140, 560);
await sleep(1200);
const stickVisible = await page.evaluate(() => document.getElementById('stick').style.display === 'block');
const posAfter = await page.evaluate(() => game.player.pos.x);
await page.screenshot({ path: OUT + 'mob_stick.png' });
await page.touchscreen.touchEnd();
check('スティック表示', stickVisible);
check('左ドラッグで右移動', posAfter > posBefore + 1, `x ${posBefore.toFixed(1)}→${posAfter.toFixed(1)}`);

// --- 右タッチで照準+連射+ロック ---
await sleep(2500); // 敵が来るのを待つ
const lockRes = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // 敵の画面位置を得る
  for (let i = 0; i < 20; i++) {
    const e = game.enemies.find(e => e.alive && e.pos.distanceTo(game.player.pos) > 7);
    if (e) {
      const v = e.pos.clone().project(game.camera);
      return { x: (v.x + 1) * 0.5 * innerWidth, y: (-v.y + 1) * 0.5 * innerHeight };
    }
    await sleep(300);
  }
  return null;
});
if (lockRes) {
  await page.touchscreen.touchStart(Math.min(380, Math.max(170, lockRes.x)), lockRes.y);
  // 押しっぱなしで敵を追尾しつつロック
  const t0 = Date.now();
  while (Date.now() - t0 < 2200) {
    const p = await page.evaluate(() => {
      const e = game.enemies.find(e => e.alive && e.pos.distanceTo(game.player.pos) > 7);
      if (!e) return null;
      const v = e.pos.clone().project(game.camera);
      return { x: (v.x + 1) * 0.5 * innerWidth, y: (-v.y + 1) * 0.5 * innerHeight };
    });
    if (p) await page.touchscreen.touchMove(Math.min(380, Math.max(170, p.x)), Math.min(800, Math.max(40, p.y)));
    await sleep(120);
  }
  const st = await page.evaluate(() => ({ locks: game.weapons.locks.length, firing: game.input.firing, shots: game.weapons.shots.length }));
  await page.screenshot({ path: OUT + 'mob_lock.png' });
  await page.touchscreen.touchEnd();
  await sleep(2000);
  const score = await page.evaluate(() => game.score);
  check('右タッチで連射', st.firing, JSON.stringify(st));
  check('タッチ長押しロック→離して撃破', score > 0, `score=${score}, locks was ${st.locks}`);
} else {
  check('敵出現(タッチテスト用)', false, '敵が見つからない');
}

await page.screenshot({ path: OUT + 'mob_final.png' });
console.log(results.join('\n'));
await browser.close();
edgeProc.kill();
