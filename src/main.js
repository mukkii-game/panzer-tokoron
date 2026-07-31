import * as THREE from 'three';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { UI } from './ui.js';
import { Player } from './player.js';
import { Weapons } from './weapons.js';
import { World } from './world.js';
import { disposeObject } from './enemies.js';

// ================== カメラ設定(調整用) ==================
// パンツァードラグーンで視点を「斜め後ろ」に回した状態を基本とする。
// 自機の顔が見える前方斜め上から、奥(後方)から来る敵を見渡す。
// ゲーム中デバッグキー: 4/6=ヨー, 8/2=ピッチ, 3/9=距離, 5=数値をconsoleに出力
const CAM = {
  // 自機は地面スクロール方向(+F)を向く。カメラは顔側(+F寄り)の斜め上から奥を見る。
  yaw: 0.48,      // 少し斜め(真正面すぎず、背中にもしない)
  pitch: 0.30,
  dist: 13,
  lookBack: 12,   // 注視点は自機より奥(敵・スクロール先)
  lookUp: 0.5,
  follow: 0.55,
  swayYaw: 0.16,
  swayPitch: 0.09,
  fov: 58,
  lagPos: 2.2,
  lagAim: 3.5,
  lagLook: 2.8,
};

// カメラの遅れ状態
const camLag = {
  cx: 0, cy: 4.5, cz: 0,
  ax: 0, ay: 0,
  lookX: 0, lookY: 4.5, lookZ: -14,
};

// ================== 初期化 ==================
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CAM.fov, innerWidth / innerHeight, 0.1, 300);

const game = {
  scene, camera, renderer,
  input: new Input(),
  audio: new AudioSys(),
  ui: new UI(),
  enemies: [],
  enemyBullets: [],
  effects: [],
  pickups: [],
  score: 0,
  state: 'title',
  time: 0,
  boss: null,
  homingSalvo: null,
  player: null, weapons: null, world: null,
  waveDir: 0,   // 敵ウェーブ/レールの目標ヨー
  viewYaw: 0,   // 地面スクロール・カメラの現在ヨー(滑らかに追従)

  // 敵の来る方向をセット(360度)。方向が変わったら告知
  setWaveDir(theta) {
    let d = theta - this.waveDir;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) < 0.2) { this.waveDir = theta; return; }
    this.waveDir = theta;
    const label = Math.abs(d) > 2.6 ? '⟲ 進行方向チェンジ！ うしろへ'
      : d > 0 ? '⟲ 進行方向チェンジ！ ひだりへ' : '⟲ 進行方向チェンジ！ みぎへ';
    this.ui.showStageMsg(label, 2000);
    this.audio.msg();
  },
  // レール座標系: F=地面が進む方向(奥→手前)。初期theta=0で +Z=画面手前向き。
  // R=右。カメラはF側(顔側)から奥(-F)を見るので、最初から顔が見える。
  frameF(theta = this.waveDir) { return new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta)); },
  frameR(theta = this.waveDir) { return new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta)); },
  // 地面スクロール方向(自機の頭が向く方向)。カメラ方位ではなくワールドの進行。
  scrollDir() { return this.frameF(this.viewYaw); },

  addScore(v) { this.score += v; this.ui.setScore(this.score); },

  // ピンチ時は敵の攻撃間隔を伸ばす(見えない救済)
  relief() { return this.player && this.player.hp <= 2 ? 1.45 : 1; },

  spawnHeart(pos) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    c.font = '52px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('❤️', 32, 36);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    spr.scale.setScalar(1.5);
    spr.position.copy(pos);
    this.scene.add(spr);
    this.pickups.push({
      mesh: spr, t: 0, magnet: false,
      vel: new THREE.Vector3(),
    });
  },

  onEnemyKilled(e, viaHoming) {
    this.addScore(e.score);
    if (viaHoming && this.homingSalvo) {
      const s = this.homingSalvo;
      s.kills++;
      if (s.kills >= 2) {
        const bonus = 150 * (s.kills - 1);
        this.addScore(bonus);
        this.ui.showCombo(`ロックオンコンボ ×${s.kills}！ +${bonus}`);
        if (s.kills >= 3) this.player.setExpression('joy', 1.3);
      }
    }
  },

  onBossDefeated() {
    this.addScore(5000);
    this.ui.showBoss(false);
    this.boss = null;
    if (this.state !== 'play') return;
    this.state = 'clear';
    this.audio.stopBGM();
    this.audio.jingleClear();
    this.player.setExpression('joy', 999);
    this.ui.showStageMsg('所沢の平和は守られた！', 4000);
    setTimeout(() => this.ui.showResult(true, this.score), 3800);
  },

  gameOver() {
    if (this.state !== 'play') return;
    this.state = 'over';
    this.audio.stopBGM();
    this.audio.jingleOver();
    this.player.setExpression('dizzy', 999);
    setTimeout(() => this.ui.showResult(false, this.score), 2600);
  },
};

window.game = game; // デバッグ・チューニング用

game.player = new Player(game);
game.weapons = new Weapons(game);
game.world = new World(game);
game.ui.setHearts(10);
game.ui.setScore(0);

// ================== カメラ更新(遅れ追従 + 360度ビュー) ==================
function updateCamera(dt) {
  // ビュー回転を目標方向へ滑らかに追従(進行方向転換をゆっくり味わう)
  let dd = game.waveDir - game.viewYaw;
  while (dd > Math.PI) dd -= Math.PI * 2;
  while (dd < -Math.PI) dd += Math.PI * 2;
  game.viewYaw += dd * Math.min(1, dt * 1.55); // 方向転換はゆっくり味わう

  const vyaw = game.viewYaw;
  const p = game.player.pos;

  // 自機位置への遅れ追従
  const targetCx = p.x * CAM.follow;
  const targetCz = p.z * CAM.follow;
  const targetCy = 4.2 + (p.y - 4.2) * CAM.follow;
  const kp = Math.min(1, dt * CAM.lagPos);
  camLag.cx += (targetCx - camLag.cx) * kp;
  camLag.cy += (targetCy - camLag.cy) * kp;
  camLag.cz += (targetCz - camLag.cz) * kp;

  // カーソルへの遅れ追従
  const axRaw = (game.input.aim.x / innerWidth) * 2 - 1;
  const ayRaw = (game.input.aim.y / innerHeight) * 2 - 1;
  const ka = Math.min(1, dt * CAM.lagAim);
  camLag.ax += (axRaw - camLag.ax) * ka;
  camLag.ay += (ayRaw - camLag.ay) * ka;

  const yawOff = THREE.MathUtils.clamp(CAM.yaw + camLag.ax * CAM.swayYaw, -1.3, 1.3);
  const pitch = THREE.MathUtils.clamp(CAM.pitch - camLag.ay * CAM.swayPitch, 0.08, 1.05);
  const totalYaw = vyaw + yawOff;

  const aspect = innerWidth / innerHeight;
  const dist = CAM.dist * (aspect >= 1 ? 1 : 1 + (1 - aspect) * 0.9);

  const tx = camLag.cx + Math.sin(totalYaw) * Math.cos(pitch) * dist;
  const ty = camLag.cy + Math.sin(pitch) * dist;
  const tz = camLag.cz + Math.cos(totalYaw) * Math.cos(pitch) * dist;
  // カメラ本体も少し遅れて移動
  const kc = Math.min(1, dt * 4.2);
  camera.position.x += (tx - camera.position.x) * kc;
  camera.position.y += (ty - camera.position.y) * kc;
  camera.position.z += (tz - camera.position.z) * kc;

  // 注視点も遅れ追従(奥+自機少し)
  const lookYaw = vyaw + yawOff * 0.45;
  const wantLookX = camLag.cx - Math.sin(lookYaw) * CAM.lookBack + p.x * 0.15;
  const wantLookY = camLag.cy + CAM.lookUp + (p.y - 4.2) * 0.2;
  const wantLookZ = camLag.cz - Math.cos(lookYaw) * CAM.lookBack + p.z * 0.15;
  const kl = Math.min(1, dt * CAM.lagLook);
  camLag.lookX += (wantLookX - camLag.lookX) * kl;
  camLag.lookY += (wantLookY - camLag.lookY) * kl;
  camLag.lookZ += (wantLookZ - camLag.lookZ) * kl;
  camera.lookAt(camLag.lookX, camLag.lookY, camLag.lookZ);
}
camera.position.set(Math.sin(CAM.yaw) * CAM.dist, 10, CAM.dist);

// カメラ調整デバッグキー
addEventListener('keydown', e => {
  const step = 0.04;
  if (e.code === 'Digit4') CAM.yaw -= step;
  else if (e.code === 'Digit6') CAM.yaw += step;
  else if (e.code === 'Digit8') CAM.pitch += step;
  else if (e.code === 'Digit2') CAM.pitch -= step;
  else if (e.code === 'Digit9') CAM.dist += 0.6;
  else if (e.code === 'Digit3') CAM.dist -= 0.6;
  else if (e.code === 'Digit5') console.log('CAM =', JSON.stringify(CAM));
  else return;
  console.log(`yaw=${CAM.yaw.toFixed(2)} pitch=${CAM.pitch.toFixed(2)} dist=${CAM.dist.toFixed(1)}`);
});

// ================== 衝突判定 ==================
function updateCollisions(dt) {
  const p = game.player;

  // 敵弾 vs 自機
  for (let i = game.enemyBullets.length - 1; i >= 0; i--) {
    const b = game.enemyBullets[i];
    if (b.gravity) b.vel.y -= b.gravity * dt;
    b.mesh.position.addScaledVector(b.vel, dt);
    b.life -= dt;
    let dead = b.life <= 0 || b.mesh.position.y < -3 || b.mesh.position.distanceTo(p.pos) > 110;
    if (!dead && !p.dead) {
      const d = b.mesh.position.distanceTo(p.pos);
      if (d < b.r + p.radius) {
        p.takeHit(game);
        dead = true;
      } else if (d < 2.6 && p.invuln <= 0 && p.exprTimer <= 0) {
        p.setExpression('panic', 0.45); // ニアミスでヒヤッ
      }
    }
    if (dead) { scene.remove(b.mesh); disposeObject(b.mesh); game.enemyBullets.splice(i, 1); }
  }

  // 敵本体 vs 自機
  if (!p.dead && p.invuln <= 0) {
    for (const e of game.enemies) {
      if (!e.alive) continue;
      if (e.pos.distanceTo(p.pos) < e.radius + p.radius) {
        p.takeHit(game);
        if (e !== game.boss) e.damage(3);
        break;
      }
    }
  }
}

// ================== エフェクト ==================
function updateEffects(dt) {
  for (let i = game.effects.length - 1; i >= 0; i--) {
    const fx = game.effects[i];
    fx.t += dt;
    const k = 1 - fx.t / fx.dur;
    for (const part of fx.parts) {
      part.mesh.position.addScaledVector(part.vel, dt);
      part.mesh.scale.setScalar(Math.max(0.01, k));
    }
    if (fx.t >= fx.dur) {
      fx.parts.forEach(part => { scene.remove(part.mesh); disposeObject(part.mesh); });
      game.effects.splice(i, 1);
    }
  }
}

// ================== 回復ハート ==================
function updatePickups(dt) {
  const p = game.player;
  const MAGNET_R = 9.5;   // この距離まで近づいたら吸い寄せ開始
  const GET_R = 2.4;      // 回収判定(誘導後はほぼ確実)
  for (let i = game.pickups.length - 1; i >= 0; i--) {
    const pk = game.pickups[i];
    pk.t += dt;
    const dist = pk.mesh.position.distanceTo(p.pos);

    if (!p.dead && dist < MAGNET_R) pk.magnet = true;

    if (pk.magnet && !p.dead) {
      // プレイヤーへ加速誘導 → 絶対ゲット感
      const to = p.pos.clone().sub(pk.mesh.position);
      const d = Math.max(0.15, to.length());
      to.multiplyScalar(1 / d);
      const pull = 18 + (MAGNET_R - Math.min(d, MAGNET_R)) * 4.5; // 近いほど速い
      pk.vel.lerp(to.multiplyScalar(pull), Math.min(1, dt * 10));
      pk.mesh.position.addScaledVector(pk.vel, dt);
      pk.mesh.scale.setScalar(1.5 + Math.sin(pk.t * 14) * 0.12);
    } else {
      const f = game.frameF(game.viewYaw);
      pk.mesh.position.x += f.x * 9 * dt;
      pk.mesh.position.z += f.z * 9 * dt;
      pk.mesh.position.y += Math.sin(pk.t * 4) * dt * 1.5;
    }

    let done = !pk.magnet && (pk.t > 12 || dist > 120);
    if (!p.dead && dist < GET_R) {
      if (p.hp < p.maxHp) { p.hp++; game.ui.setHearts(p.hp); }
      game.addScore(50);
      game.audio.heal();
      p.setExpression('joy', 1.0);
      done = true;
    }
    if (done) {
      scene.remove(pk.mesh);
      pk.mesh.material.map.dispose();
      pk.mesh.material.dispose();
      game.pickups.splice(i, 1);
    }
  }
}

// ================== メインループ ==================
const clock = new THREE.Clock();
let touchModeSet = false;

function loop() {
  requestAnimationFrame(loop);
  if (game.manual) return; // テスト駆動中はrAF側を止める
  tick(Math.min(clock.getDelta(), 0.05));
}

// 1フレーム分の更新。テストからは game.tick(dt, false) で高速駆動できる
function tick(dt, render = true) {
  game.time += dt;

  if (game.input.isTouch && !touchModeSet) { touchModeSet = true; game.ui.setTouchMode(true); }

  if (game.state === 'play' || game.state === 'over' || game.state === 'clear') {
    if (game.state === 'play') {
      game.world.update(dt);
      game.weapons.update(dt);
      if (game.homingSalvo) {
        game.homingSalvo.timer += dt;
        if (game.homingSalvo.timer > 3) game.homingSalvo = null;
      }
    }
    game.player.update(dt, game);
    for (let i = game.enemies.length - 1; i >= 0; i--) {
      const e = game.enemies[i];
      if (!e.alive) { game.enemies.splice(i, 1); continue; }
      if (game.state === 'play') e.update(dt);
    }
    updateCollisions(dt);
    updateEffects(dt);
    updatePickups(dt);
  } else {
    // タイトル画面: トコろんがふわふわ
    game.player.update(dt, game);
  }

  updateCamera(dt);

  // 照準UI
  const inPlay = game.state === 'play';
  game.ui.setReticle(game.input.aim.x, game.input.aim.y, game.input.locking, inPlay);
  game.ui.setStick(game.input.stick);

  if (render) renderer.render(scene, camera);
}
game.tick = tick;
loop();

// ================== 画面遷移 ==================
document.getElementById('start-btn').addEventListener('click', () => {
  game.audio.ensure();
  game.audio.startBGM('stage');
  game.ui.hideTitle();
  game.state = 'play';
});
document.getElementById('retry-btn').addEventListener('click', () => location.reload());

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
