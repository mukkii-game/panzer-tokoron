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
  yaw: 0.38,      // 水平角(rad)。0=自機の真正面、+で右斜めへ
  pitch: 0.36,    // 仰角(rad)
  dist: 16,       // 自機からの距離
  lookBack: 16,   // 注視点を自機の後方(奥)へずらす量
  lookUp: 1.2,    // 注視点の高さオフセット
  follow: 0.45,   // 自機移動へのカメラ追従率
  swayYaw: 0.12,  // 照準によるカメラの振れ幅(ヨー)
  swayPitch: 0.07,
  fov: 58,
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
    this.pickups.push({ mesh: spr, t: 0 });
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
game.ui.setHearts(5);
game.ui.setScore(0);

// ================== カメラ更新 ==================
function updateCamera(dt) {
  const p = game.player.pos;
  // 自機移動に部分追従した注視の中心
  const cx = p.x * CAM.follow;
  const cy = 4.5 + (p.y - 4.5) * CAM.follow;

  // 照準でゆるく首を振る(180度以内・仰角制限内)
  const ax = (game.input.aim.x / innerWidth) * 2 - 1;
  const ay = (game.input.aim.y / innerHeight) * 2 - 1;
  const yaw = THREE.MathUtils.clamp(CAM.yaw + ax * CAM.swayYaw, -1.2, 1.2);
  const pitch = THREE.MathUtils.clamp(CAM.pitch - ay * CAM.swayPitch, 0.08, 1.05);

  // 縦画面(スマホ)では距離を伸ばして視界を確保
  const aspect = innerWidth / innerHeight;
  const dist = CAM.dist * (aspect >= 1 ? 1 : 1 + (1 - aspect) * 0.9);

  const tx = cx + Math.sin(yaw) * Math.cos(pitch) * dist;
  const ty = cy + Math.sin(pitch) * dist;
  const tz = Math.cos(yaw) * Math.cos(pitch) * dist;
  const k = Math.min(1, dt * 5);
  camera.position.x += (tx - camera.position.x) * k;
  camera.position.y += (ty - camera.position.y) * k;
  camera.position.z += (tz - camera.position.z) * k;
  camera.lookAt(cx - Math.sin(yaw) * 4, cy + CAM.lookUp, -CAM.lookBack);
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
    let dead = b.life <= 0 || b.mesh.position.z > 20 || b.mesh.position.y < -3;
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
  for (let i = game.pickups.length - 1; i >= 0; i--) {
    const pk = game.pickups[i];
    pk.t += dt;
    pk.mesh.position.z += 9 * dt;
    pk.mesh.position.y += Math.sin(pk.t * 4) * dt * 1.5;
    let done = pk.mesh.position.z > 15 || pk.t > 12;
    if (!p.dead && pk.mesh.position.distanceTo(p.pos) < 1.8) {
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
