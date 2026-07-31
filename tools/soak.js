// 全編自動プレイ耐久テスト: ボット注入でタイトル→ボス撃破まで実時間プレイ
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = fileURLToPath(new URL('./shots/', import.meta.url));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const profileDir = path.join(os.tmpdir(), 'tokoron_soak_' + Date.now());
const portFile = path.join(profileDir, 'DevToolsActivePort');
const edgeProc = spawn(EDGE, ['--remote-debugging-port=0', '--headless=new', `--user-data-dir=${profileDir}`,
  '--window-size=1280,720', '--mute-audio', '--no-first-run', '--disable-gpu',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling', 'about:blank'], { stdio: 'ignore' });

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
page.on('framenavigated', f => { if (f === page.mainFrame()) console.log('[navigated]', f.url()); });
// リロード原因の診断
const cdp = await page.createCDPSession();
await cdp.send('Page.enable');
await cdp.send('Inspector.enable');
cdp.on('Page.frameRequestedNavigation', e => console.log('[nav-reason]', e.reason, e.disposition, e.url));
cdp.on('Inspector.targetCrashed', () => console.log('[TARGET CRASHED]'));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text().slice(0, 200)); });
await page.bringToFront();
await page.goto('http://localhost:8123/', { waitUntil: 'networkidle2' });
await sleep(800);
await page.click('#start-btn');

// ボット+FPS計測を注入
await page.evaluate(() => {
  window.__fps = { frames: 0, t0: performance.now(), min: 999, samples: [] };
  let lastT = performance.now(), lastN = 0;
  const fpsTick = () => {
    window.__fps.frames++;
    requestAnimationFrame(fpsTick);
  };
  requestAnimationFrame(fpsTick);
  setInterval(() => {
    const now = performance.now();
    const fps = (window.__fps.frames - lastN) / ((now - lastT) / 1000);
    window.__fps.samples.push(Math.round(fps));
    window.__fps.min = Math.min(window.__fps.min, Math.round(fps));
    lastT = now; lastN = window.__fps.frames;
  }, 2000);

  // ボット: 敵に照準→2秒ロック→発射を繰り返し、弾を避ける
  let lockPhase = 0;
  setInterval(() => {
    if (game.state !== 'play') return;
    const p = game.player;
    // 一番近い敵弾から逃げる + ゆるく中央へ
    let mx = (0 - p.pos.x) * 0.08, my = (5 - p.pos.y) * 0.08;
    let nearest = null, nd = 1e9;
    for (const b of game.enemyBullets) {
      const d = b.mesh.position.distanceTo(p.pos);
      if (d < nd) { nd = d; nearest = b; }
    }
    if (nearest && nd < 8) {
      // 弾の進行方向に対して垂直に逃げる
      const bv = nearest.vel;
      const perp = { x: -bv.y, y: bv.x };
      const toP = { x: p.pos.x - nearest.mesh.position.x, y: p.pos.y - nearest.mesh.position.y };
      const s = (perp.x * toP.x + perp.y * toP.y) >= 0 ? 1 : -1;
      const m = Math.hypot(perp.x, perp.y) || 1;
      mx = s * perp.x / m; my = s * perp.y / m;
    }
    // 敵本体が近いときも離れる
    for (const e of game.enemies) {
      if (e.alive && e.pos.distanceTo(p.pos) < 5) { mx += p.pos.x > e.pos.x ? 0.8 : -0.8; break; }
    }
    game.input.getMove = () => ({ x: Math.max(-1, Math.min(1, mx)), y: Math.max(-1, Math.min(1, my)) });
    // 照準: ボス優先、なければ近い敵
    const target = game.boss && game.boss.alive ? game.boss : game.enemies.find(e => e.alive && e.pos.z < -6);
    if (target) {
      const v = target.pos.clone().project(game.camera);
      game.input.aim.x = (v.x + 1) * 0.5 * innerWidth + (Math.random() - 0.5) * 20;
      game.input.aim.y = (-v.y + 1) * 0.5 * innerHeight + (Math.random() - 0.5) * 20;
    }
    // ロック↔連射のサイクル
    lockPhase = (lockPhase + 1) % 30; // 100ms刻み x30 = 3秒周期
    if (lockPhase === 0) { game.input._lockEnd(); game.input.firing = false; }
    else if (lockPhase < 20) { game.input.locking = true; game.input.firing = false; }
    else { game.input.locking = false; game.input._lockEnd(); game.input.firing = true; }
  }, 100);
});

// 監視: 15秒ごとに状態report、終了条件までループ
const t0 = Date.now();
let shot = 0;
while (Date.now() - t0 < 6 * 60 * 1000) {
  await sleep(15000);
  const st = await page.evaluate(() => ({
    state: game.state, time: +game.world.time.toFixed(1), score: game.score, hp: game.player.hp,
    enemies: game.enemies.length, bullets: game.enemyBullets.length,
    boss: game.boss ? game.boss.hp : null,
    fpsMin: window.__fps.min, fpsLast: window.__fps.samples.slice(-3),
    drawcalls: game.renderer.info.render.calls, tris: game.renderer.info.render.triangles,
    geoms: game.renderer.info.memory.geometries,
  }));
  console.log(JSON.stringify(st));
  if (process.env.HEAL === '1') await page.evaluate(() => { if (game.player.hp > 0) { game.player.hp = 5; game.ui.setHearts(5); } });
  // 注意: ヘッドレスEdgeでは page.screenshot() がrAFを凍結させるため、途中スクショは撮らない
  if (st.state === 'clear' || st.state === 'over') break;
}
const final = await page.evaluate(() => ({ state: game.state, score: game.score, hp: game.player.hp }));
console.log('FINAL:', JSON.stringify(final));
await page.screenshot({ path: OUT + 'soak_final.png' });
await browser.close();
edgeProc.kill();
