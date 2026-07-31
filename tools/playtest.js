// ロックオン/ホーミング/被弾/長時間安定性の自動プレイテスト
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const GAME_URL = 'http://localhost:8123/';
const OUT = fileURLToPath(new URL('./shots/', import.meta.url));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const profileDir = path.join(os.tmpdir(), 'tokoron_play_' + Date.now());
const portFile = path.join(profileDir, 'DevToolsActivePort');
const edgeProc = spawn(EDGE, ['--remote-debugging-port=0', '--headless=new', `--user-data-dir=${profileDir}`,
  '--window-size=1280,720', '--mute-audio', '--no-first-run', '--disable-gpu',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--disable-hang-monitor', '--disable-features=MemorySaverModeRenderTabDiscard,HighEfficiencyModeAvailable,TabDiscarding,IntensiveWakeUpThrottling',
  'about:blank'], { stdio: 'ignore' });

let browser = null;
for (let i = 0; i < 40 && !browser; i++) {
  await sleep(500);
  try {
    if (!fs.existsSync(portFile)) continue;
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
    if (port) browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null });
  } catch {}
}
if (!browser) { edgeProc.kill(); throw new Error('Edge接続失敗'); }

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const errors = [];
page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
page.on('framenavigated', f => {
  if (f === page.mainFrame()) {
    const m = `[NAVIGATED @${(performance.now() / 1000).toFixed(1)}s] ` + f.url();
    errors.push(m); console.log(m);
  }
});

await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
await sleep(1000);
await page.evaluate(() => { window.__marker = 'alive'; });
await page.click('#start-btn');

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}: ${name} ${detail}`);

// --- 1. 敵出現待ち(t=3のダンゴ波) ---
await sleep(4000);
const enemyCount = await page.evaluate(() => game.enemies.length);
check('敵が出現する', enemyCount > 0, `count=${enemyCount}`);

// --- 2. ロックオン→ホーミング ---
const lockResult = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const scoreBefore = game.score;
  // 3秒間、生きている敵に照準を当て続けてロック
  game.input.locking = true;
  const t0 = performance.now();
  const iv = setInterval(() => {
    const e = game.enemies.find(e => e.alive && e.pos.z < -5);
    if (e) {
      const v = e.pos.clone().project(game.camera);
      game.input.aim.x = (v.x + 1) * 0.5 * innerWidth;
      game.input.aim.y = (-v.y + 1) * 0.5 * innerHeight;
    }
    if (performance.now() - t0 > 2500) clearInterval(iv);
  }, 50);
  await sleep(2600);
  const locks = game.weapons.locks.length;
  game.input._lockEnd(); // 発射
  await sleep(2500);
  return { locks, scoreBefore, scoreAfter: game.score, missiles: game.weapons.missiles.length };
});
check('ロックオンが成立する', lockResult.locks > 0, `locks=${lockResult.locks}`);
check('ホーミングで撃破しスコア加算', lockResult.scoreAfter > lockResult.scoreBefore, `score ${lockResult.scoreBefore}→${lockResult.scoreAfter}`);

// --- 3. 直線ショットで撃破できる ---
const shotResult = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const before = game.score;
  game.input.locking = false;
  const t0 = performance.now();
  const iv = setInterval(() => {
    const e = game.enemies.find(e => e.alive && e.pos.z < -5);
    if (e) {
      const v = e.pos.clone().project(game.camera);
      game.input.aim.x = (v.x + 1) * 0.5 * innerWidth;
      game.input.aim.y = (-v.y + 1) * 0.5 * innerHeight;
    }
    game.input.firing = true;
    if (performance.now() - t0 > 4000) { game.input.firing = false; clearInterval(iv); }
  }, 50);
  await sleep(4500);
  return { before, after: game.score };
});
check('直線ショットでスコア加算', shotResult.after > shotResult.before, `score ${shotResult.before}→${shotResult.after}`);

// --- 4. 被弾処理 ---
const hitResult = await page.evaluate(() => {
  const hpBefore = game.player.hp;
  game.player.invuln = 0;
  game.player.takeHit(game);
  return { hpBefore, hpAfter: game.player.hp, expr: game.player.expression, hearts: document.getElementById('hearts').textContent };
});
check('被弾でHP減少+焦り顔', hitResult.hpAfter === hitResult.hpBefore - 1 && hitResult.expr === 'panic', JSON.stringify(hitResult));

// --- 5. ボス戦→撃破→クリア ---
await page.evaluate(() => { game.enemies.forEach(e => e.remove()); game.world.startBoss(); });
await sleep(3500);
await page.screenshot({ path: OUT + 'pt_boss.png' });
const bossResult = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  if (!game.boss) return { state: 'BOSS_IS_NULL(' + game.state + ')', resultShown: false };
  game.boss.damage(60);
  await sleep(4200);
  return { state: game.state, resultShown: !document.getElementById('result-screen').classList.contains('hidden') };
});
check('ボス撃破でクリア画面', bossResult.state === 'clear' && bossResult.resultShown, JSON.stringify(bossResult));

// --- 6. リロードされていないか ---
const marker = await page.evaluate(() => window.__marker);
check('ページがリロードされていない', marker === 'alive', `marker=${marker}`);

await page.screenshot({ path: OUT + 'pt_clear.png' });
console.log(results.join('\n'));
console.log('=== errors ===');
console.log(errors.length ? errors.join('\n') : '(none)');
await browser.close();
edgeProc.kill();
