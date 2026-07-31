// 全編高速シミュレーション: rAFに頼らず game.tick() を直接駆動して
// タイトル→全エリア→ボス撃破/ゲームオーバーまでを数十秒で検証する
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = fileURLToPath(new URL('./shots/', import.meta.url));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HEAL = process.env.HEAL === '1';

const profileDir = path.join(os.tmpdir(), 'tokoron_fast_' + Date.now());
const portFile = path.join(profileDir, 'DevToolsActivePort');
const edgeProc = spawn(EDGE, ['--remote-debugging-port=0', '--headless=new', `--user-data-dir=${profileDir}`,
  '--window-size=1280,720', '--mute-audio', '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });

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
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
await page.goto('http://localhost:8123/', { waitUntil: 'networkidle2' });
await sleep(800);
await page.click('#start-btn');
await sleep(300);

const result = await page.evaluate(async (heal) => {
  const yieldNow = () => new Promise(r => setTimeout(r));
  game.manual = true;
  game.audio.stopBGM(); // 高速駆動中はBGMスケジューラを止める
  const dt = 1 / 60;
  const log = [];
  const errors = [];
  let lockCycle = 0;

  const bot = () => {
    const p = game.player;
    // ビュー座標系(lat=カメラ右方向, dep=カメラ手前方向)で判断する
    const vy = game.viewYaw;
    const Fx = Math.sin(vy), Fz = Math.cos(vy);
    const Rx = Math.cos(vy), Rz = -Math.sin(vy);
    const latOf = v => v.x * Rx + v.z * Rz;
    const depOf = v => v.x * Fx + v.z * Fz;
    const plat = latOf(p.pos), pdep = depOf(p.pos);
    let mx = (0 - plat) * 0.1, my = (5 - p.pos.y) * 0.1;
    // 弾の着弾点(自機の奥行き面到達時のlat,y)を予測して危険なら逃げる
    let danger = null, dscore = 1e9;
    for (const b of game.enemyBullets) {
      const bp = b.mesh.position, bv = b.vel;
      const app = bv.x * Fx + bv.z * Fz; // 接近速度
      if (app <= 0.5) continue;
      const t = (pdep - depOf(bp)) / app;
      if (t < 0 || t > 2.0) continue;
      const ilat = latOf(bp) + (bv.x * Rx + bv.z * Rz) * t;
      const iy = bp.y + bv.y * t - (b.gravity ? 0.5 * b.gravity * t * t : 0);
      const d = Math.hypot(ilat - plat, iy - p.pos.y) + t; // 近い&早い着弾を優先
      if (d < dscore) { dscore = d; danger = { ilat, iy, d: Math.hypot(ilat - plat, iy - p.pos.y) }; }
    }
    if (danger && danger.d < 3.5) {
      mx = plat >= danger.ilat ? 1 : -1;
      my = p.pos.y >= danger.iy ? 1 : -1;
      if (p.pos.y > 8.5) my = -1;
      if (p.pos.y < 2) my = 1;
      if (plat > 8.5) mx = -1;
      if (plat < -8.5) mx = 1;
    }
    // 突進系のレーンに立たない + 近い敵から離れる
    for (const e of game.enemies) {
      if (!e.alive) continue;
      const elat = latOf(e.pos);
      if (depOf(e.pos) - pdep > -35 && Math.abs(elat - plat) < 2.8 && Math.abs(e.pos.y - p.pos.y) < 2.8) {
        mx = plat >= elat ? 1 : -1;
        if (plat > 8.5) mx = -1; if (plat < -8.5) mx = 1;
        break;
      }
    }
    // HPが減ったらハートを拾いに行く
    if (p.hp <= 3 && game.pickups.length > 0 && (!danger || danger.d >= 3.5)) {
      const pk = game.pickups[0].mesh.position;
      if (pk.distanceTo(p.pos) < 15) { mx = latOf(pk) > plat ? 1 : -1; my = pk.y > p.pos.y ? 1 : -1; }
    }
    game.input.getMove = () => ({ x: Math.max(-1, Math.min(1, mx)), y: Math.max(-1, Math.min(1, my)) });
    const target = game.boss && game.boss.alive ? game.boss : game.enemies.find(e => e.alive && depOf(e.pos) - pdep < -6);
    if (target) {
      const v = target.pos.clone().project(game.camera);
      game.input.aim.x = (v.x + 1) * 0.5 * innerWidth;
      game.input.aim.y = (-v.y + 1) * 0.5 * innerHeight;
    }
    lockCycle = (lockCycle + 1) % 36;
    if (lockCycle === 0) { game.input.locking = false; game.input._lockEnd(); game.input.firing = false; }
    else if (lockCycle < 24) { game.input.locking = true; game.input.firing = false; }
    else { game.input.locking = false; game.input._lockEnd(); game.input.firing = true; }
  };

  // 被弾原因の記録
  const hits = [];
  const origTakeHit = game.player.takeHit.bind(game.player);
  game.player.takeHit = (g) => {
    if (game.player.invuln <= 0 && !game.player.dead) {
      let culprit = 'bullet?', best = 1e9;
      for (const e of game.enemies) {
        if (!e.alive) continue;
        const d = e.pos.distanceTo(game.player.pos) - e.radius;
        if (d < best) { best = d; culprit = e.constructor.name + ' d=' + d.toFixed(1); }
      }
      for (const b of game.enemyBullets) {
        const d = b.mesh.position.distanceTo(game.player.pos);
        if (d < 1.5 && d < best) { best = d; culprit = 'bullet d=' + d.toFixed(1); }
      }
      hits.push(`t=${game.world.time.toFixed(1)} hp${game.player.hp}→ ${culprit}`);
    }
    origTakeHit(g);
  };

  const maxFrames = 60 * 420;
  for (let f = 0; f < maxFrames; f++) {
    if (f % 6 === 0) bot();
    try {
      game.tick(dt, f % 30 === 0);
    } catch (err) {
      errors.push(`frame ${f} (t=${game.world.time.toFixed(1)}): ${err.message}`);
      if (errors.length > 5) break;
    }
    if (heal && game.player.hp < 5 && game.player.hp > 0) { game.player.hp = 5; }
    if (f % 300 === 0) {
      log.push({ t: +game.world.time.toFixed(1), st: game.state, hp: game.player.hp, sc: game.score,
        en: game.enemies.length, bl: game.enemyBullets.length, boss: game.boss ? game.boss.hp : null,
        geoms: game.renderer.info.memory.geometries });
      await yieldNow(); // ホーミング発射のsetTimeout等を処理させる
    }
    if (game.state !== 'play') break;
  }
  return { log, errors, hits, final: { state: game.state, score: game.score, hp: game.player.hp, time: +game.world.time.toFixed(1) } };
}, HEAL);

for (const l of result.log) console.log(JSON.stringify(l));
console.log('HITS:\n' + (result.hits || []).join('\n'));
console.log('FINAL:', JSON.stringify(result.final));
if (result.errors.length) console.log('IN-GAME ERRORS:\n' + result.errors.join('\n'));
console.log('PAGE ERRORS:', pageErrors.length ? pageErrors.join(' | ') : '(none)');
await page.screenshot({ path: OUT + 'fast_final.png' });
await browser.close();
edgeProc.kill();
