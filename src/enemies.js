import * as THREE from 'three';

const mat = c => new THREE.MeshToonMaterial({ color: c });

// ロックオンマーカー(共有テクスチャ)
let lockTex = null;
function getLockTex() {
  if (lockTex) return lockTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  c.strokeStyle = '#ffe93d'; c.lineWidth = 6;
  c.beginPath(); c.arc(32, 32, 24, 0, 7); c.stroke();
  c.strokeStyle = '#ff4d2e'; c.lineWidth = 4;
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    c.beginPath(); c.moveTo(32 + Math.cos(a) * 18, 32 + Math.sin(a) * 18); c.lineTo(32 + Math.cos(a) * 28, 32 + Math.sin(a) * 28); c.stroke();
  }
  lockTex = new THREE.CanvasTexture(cv);
  return lockTex;
}

// GPUリソース破棄(テクスチャは共有のため破棄しない)
export function disposeObject(obj) {
  obj.traverse(o => {
    if (o.isMesh || o.isSprite) {
      o.geometry?.dispose?.();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    }
  });
}

// 敵はウェーブ方向 theta のローカル座標系で動く:
//   lat=横位置, h=高さ, depth=奥行き(マイナスが奥、0が自機面、+で通過)
export class Enemy {
  constructor(game, group, hp, radius, score = 100) {
    this.game = game;
    this.mesh = group;
    this.hp = hp; this.radius = radius; this.score = score;
    this.alive = true;
    this.t = 0;
    this.lockable = true;
    this.locked = false;

    // ウェーブ方向の座標系
    this.theta = game.waveDir;
    this.F = game.frameF(this.theta); // 奥(スポーン側)→自機方向が +
    this.R = game.frameR(this.theta);
    this.lat = 0; this.h = 4; this.depth = -80;
    group.rotation.y = this.theta;

    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: getLockTex(), transparent: true, depthTest: false }));
    spr.scale.setScalar(radius * 2.6);
    spr.visible = false;
    group.add(spr);
    this.lockSprite = spr;
    game.scene.add(group);
    game.enemies.push(this);
  }
  get pos() { return this.mesh.position; }
  place(lat = this.lat, h = this.h, depth = this.depth) {
    this.lat = lat; this.h = h; this.depth = depth;
    this.mesh.position.set(
      this.R.x * lat + this.F.x * depth,
      h,
      this.R.z * lat + this.F.z * depth
    );
  }
  setLocked(v) { this.locked = v; this.lockSprite.visible = v; }
  damage(n, viaHoming = false) {
    if (!this.alive) return;
    this.hp -= n;
    if (this.hp <= 0) this.die(viaHoming);
    else this.flash();
  }
  flash() {
    this.mesh.traverse(o => { if (o.isMesh && o.material.emissive) { o.material.emissive.setHex(0xffffff); setTimeout(() => o.material.emissive.setHex(0), 60); } });
  }
  die(viaHoming = false) {
    if (!this.alive) return;
    this.alive = false;
    spawnExplosion(this.game, this.pos, this.radius);
    this.game.audio.boom();
    this.game.onEnemyKilled(this, viaHoming);
    if (Math.random() < 0.15) this.game.spawnHeart(this.pos); // 回復ドロップ
    this.remove();
  }
  remove() {
    this.alive = false;
    this.game.scene.remove(this.mesh);
    disposeObject(this.mesh);
  }
  update(dt) { this.t += dt; }
}

// ===== 弾(全体的に大きめ) =====
export function spawnBullet(game, from, vel, color = 0x5a2c10, r = 0.55, gravity = 0) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), new THREE.MeshBasicMaterial({ color }));
  m.position.copy(from);
  game.scene.add(m);
  game.enemyBullets.push({ mesh: m, vel: vel.clone(), r, gravity, life: 7 });
}
export function shootAt(game, from, speed, color, r = 0.55, spread = 0) {
  const target = game.player.pos.clone();
  target.x += (Math.random() - 0.5) * spread;
  target.y += (Math.random() - 0.5) * spread;
  const v = target.sub(from).normalize().multiplyScalar(speed);
  spawnBullet(game, from, v, color, r);
}

// ===== 爆発エフェクト =====
export function spawnExplosion(game, pos, size = 1, colors = [0xffdd55, 0xff8833, 0xffffff]) {
  const parts = [];
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.32 * size, 6, 5), new THREE.MeshBasicMaterial({ color: colors[i % colors.length] }));
    m.position.copy(pos);
    const v = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).normalize().multiplyScalar(6 + Math.random() * 5);
    game.scene.add(m);
    parts.push({ mesh: m, vel: v });
  }
  game.effects.push({ parts, t: 0, dur: 0.55 });
}

// ================= 敵たち =================
// 深度の意味: マイナス=奥(遠い)、0=自機面、プラス=カメラ手前
// 速度メリハリ: 遠いほど遅く → 接近で加速 → 近くで並走

function depthSpeed(depth) {
  // 遠いほど遅く → 近づくほど加速 → 至近で並走(遅い) → 通過で再び速く
  if (depth < -55) return 5;
  if (depth < -14) {
    const t = (depth + 55) / 41; // 0@-55 → 1@-14
    return 5 + t * 18; // 最大約23
  }
  if (depth < -5) return 2.5; // 並走
  return 16;
}

// ヤキダンゴ — 群れの主力。遠→加速接近→並走→通過 / out-and-back / 画面端入り
export class Dango extends Enemy {
  // mode: 'swarm' | 'outback' | 'edge'
  constructor(game, x, y, mode = 'swarm') {
    const g = new THREE.Group();
    // 大きくはっきり見える串団子
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.2, 8), mat(0xd8b57e));
    g.add(stick);
    for (let i = 0; i < 3; i++) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 14), mat(i === 1 ? 0x8a5a2a : 0xb9834f));
      ball.position.y = (i - 1) * 1.55;
      ball.scale.y = 0.92;
      g.add(ball);
      // 焼き目
      const burn = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), mat(0x5a3010));
      burn.position.set(0.55, (i - 1) * 1.55, 0.35);
      burn.scale.set(0.35, 0.7, 0.5);
      g.add(burn);
    }
    super(game, g, 1, 1.85);
    this.mode = mode;
    this.phase = Math.random() * 7;
    this.baseLat = x;
    this.escortT = 0;
    this.escortMax = 1.6 + Math.random() * 1.2;

    if (mode === 'outback') {
      // 手前から奥へ飛んで、戻ってくる
      this.place(x, y, 8 + Math.random() * 4);
      this.outDir = -1; // まず奥へ
      this.turnDepth = -55 - Math.random() * 20;
    } else if (mode === 'edge') {
      // 画面端の遠くから入ってくる
      const side = x >= 0 ? 1 : -1;
      this.place(side * (28 + Math.random() * 10), y, -70 - Math.random() * 25);
      this.baseLat = x;
      this.edgeSide = side;
    } else {
      this.place(x, y, -90 - Math.random() * 25);
    }
  }
  update(dt) {
    super.update(dt);
    this.mesh.rotation.z += dt * 4;

    if (this.mode === 'outback') {
      if (this.outDir < 0) {
        // 奥へ(depth減少)
        const sp = this.depth > -20 ? 22 : 10;
        this.place(this.baseLat + Math.sin(this.t * 2 + this.phase) * 1.5, this.h, this.depth - sp * dt);
        if (this.depth <= this.turnDepth) this.outDir = 1;
      } else {
        const sp = depthSpeed(this.depth);
        this.place(this.baseLat + Math.sin(this.t * 2 + this.phase) * 1.5, this.h, this.depth + sp * dt);
        if (this.depth > 16) this.remove();
      }
      return;
    }

    if (this.mode === 'edge') {
      const targetLat = this.baseLat;
      const lat = THREE.MathUtils.lerp(this.lat, targetLat, Math.min(1, dt * 0.7));
      let sp = depthSpeed(this.depth);
      if (this.depth > -12 && this.depth < -5) {
        this.escortT += dt;
        if (this.escortT < this.escortMax) sp = 1.0;
      }
      this.place(lat, this.h, this.depth + sp * dt);
      if (this.depth > 16) this.remove();
      return;
    }

    // swarm: 奥からメリハリ接近→並走→通過
    let sp = depthSpeed(this.depth);
    if (this.depth > -12 && this.depth < -5) {
      this.escortT += dt;
      if (this.escortT < this.escortMax) sp = 1.2; // しばらく並走
    }
    this.place(
      this.baseLat + Math.sin(this.t * 2 + this.phase) * 1.6,
      this.h,
      this.depth + sp * dt
    );
    if (this.depth > 16) this.remove();
  }
}

// フカイシェイカー — 遠くからゆっくり→並走して弾→通過
export class Shoyu extends Enemy {
  constructor(game, x, y) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12), mat(0x6b1f10));
    body.scale.set(0.85, 1.1, 0.85);
    g.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.5, 10), mat(0x6b1f10));
    neck.position.y = 1.05; g.add(neck);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.45, 10), mat(0xe33122));
    cap.position.y = 1.45; g.add(cap);
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.78, 0.6, 14), mat(0xf5e8c8));
    label.position.y = -0.1; label.scale.z = 0.85;
    g.add(label);
    super(game, g, 3, 1.2, 200);
    this.place(x, y, -95);
    this.holdDepth = -18 - Math.random() * 6;
    this.cool = 0.8 + Math.random();
    this.holdT = 0;
  }
  update(dt) {
    super.update(dt);
    if (this.depth < this.holdDepth) {
      this.place(this.lat, this.h, this.depth + depthSpeed(this.depth) * dt);
    } else if (this.holdT < 3.5) {
      this.holdT += dt;
      this.place(this.lat, this.h + Math.sin(this.t * 2.2) * dt * 1.2, this.depth + 0.4 * dt);
      this.mesh.rotation.z = Math.sin(this.t * 8) * 0.12;
      this.cool -= dt;
      if (this.cool <= 0) {
        this.cool = 2.2 * this.game.relief();
        const v = this.game.player.pos.clone().sub(this.pos);
        const time = 1.75, g0 = 9;
        v.multiplyScalar(1 / time);
        v.y += g0 * time * 0.5;
        spawnBullet(this.game, this.pos, v, 0x3b1206, 0.65, g0);
        this.game.audio.shoot();
      }
    } else {
      this.place(this.lat, this.h, this.depth + 16 * dt);
    }
    if (this.depth > 16) this.remove();
  }
}

// サヤマチャドローン — 大きめ湯呑み＋茶葉プロペラ、画面端から入って並走射撃
export class TeaDrone extends Enemy {
  constructor(game, x, y) {
    const g = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.82, 1.55, 16), mat(0x4e7a32));
    g.add(cup);
    // 湯のみの模様帯
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.07, 1.07, 0.35, 16), mat(0xf2ead6));
    band.position.y = 0.05; g.add(band);
    const tea = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.12, 16), mat(0xa8d63a));
    tea.position.y = 0.78; g.add(tea);
    const saucer = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.15, 0.18, 16), mat(0xdccbb0));
    saucer.position.y = -0.9; g.add(saucer);
    // 茶葉ローター(複数)
    const rotorRoot = new THREE.Group();
    rotorRoot.position.y = 1.25;
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), mat(0x3d6b28));
      leaf.scale.set(1.4, 0.12, 0.45);
      leaf.rotation.y = (i * Math.PI * 2) / 3;
      rotorRoot.add(leaf);
    }
    g.add(rotorRoot);
    // 湯気
    const steams = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }));
      s.position.set((i - 1) * 0.25, 1.1 + i * 0.15, 0);
      g.add(s);
      steams.push(s);
    }
    super(game, g, 2, 1.55, 150);
    this.rotor = rotorRoot;
    this.steams = steams;
    const side = x >= 0 ? 1 : -1;
    this.place(side * 32, y, -80);
    this.targetLat = x;
    this.dir = side > 0 ? -1 : 1;
    this.cool = 1.2 + Math.random();
    this.holdT = 0;
  }
  update(dt) {
    super.update(dt);
    this.rotor.rotation.y += dt * 18;
    for (let i = 0; i < this.steams.length; i++) {
      const s = this.steams[i];
      s.position.y = 1.15 + ((this.t * 1.4 + i * 0.4) % 1.2);
      s.material.opacity = 0.5 * (1 - ((this.t * 1.4 + i * 0.4) % 1.2) / 1.2);
    }
    const lat = THREE.MathUtils.lerp(this.lat, this.targetLat, Math.min(1, dt * 0.85));
    if (this.depth < -16) {
      this.place(lat, this.h, this.depth + depthSpeed(this.depth) * dt);
    } else if (this.holdT < 4) {
      this.holdT += dt;
      let nlat = this.lat + this.dir * 4.2 * dt;
      if (Math.abs(nlat) > 12) this.dir *= -1;
      this.place(nlat, this.h, this.depth + 0.8 * dt);
      this.cool -= dt;
      if (this.cool <= 0) {
        this.cool = 2.4 * this.game.relief();
        const base = this.game.player.pos.clone().sub(this.pos).normalize();
        for (let i = -1; i <= 1; i++) {
          const v = base.clone();
          v.addScaledVector(this.R, i * 0.22);
          v.normalize().multiplyScalar(10);
          spawnBullet(this.game, this.pos, v, 0x86b829, 0.58);
        }
        this.game.audio.shoot();
      }
    } else {
      this.place(this.lat, this.h, this.depth + 15 * dt);
    }
    if (this.depth > 16) this.remove();
  }
}

// 肉汁うどん — 器から麺がはみ出してなびきながら飛来
export class Udon extends Enemy {
  constructor(game, x, y) {
    const g = new THREE.Group();
    // どんぶり
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 0.95, 1.1, 18), mat(0xf2f0ea));
    g.add(bowl);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.12, 8, 24), mat(0xe8e4dc));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.52;
    g.add(rim);
    // スープ
    const broth = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.2, 16), mat(0xc48a3a));
    broth.position.y = 0.35;
    g.add(broth);
    // 具(肉)
    for (let i = 0; i < 4; i++) {
      const meat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.4), mat(0x8a3a18));
      const a = i * 1.5;
      meat.position.set(Math.cos(a) * 0.45, 0.48, Math.sin(a) * 0.45);
      meat.rotation.y = a;
      g.add(meat);
    }
    // はみ出し麺(複数ストランド)
    const noodles = [];
    for (let i = 0; i < 7; i++) {
      const strand = new THREE.Group();
      const segs = [];
      let py = 0.5;
      for (let s = 0; s < 6; s++) {
        const seg = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.09, 0.38, 3, 6),
          mat(s % 2 ? 0xf0e0a8 : 0xe8d090)
        );
        seg.position.y = py;
        strand.add(seg);
        segs.push(seg);
        py -= 0.42;
      }
      const ang = (i / 7) * Math.PI * 2;
      strand.position.set(Math.cos(ang) * 0.7, 0.2, Math.sin(ang) * 0.55);
      strand.rotation.z = 0.55 + (i % 3) * 0.15;
      strand.rotation.y = ang;
      g.add(strand);
      noodles.push({ root: strand, segs, phase: i * 0.7 });
    }
    // ねぎトッピング
    for (let i = 0; i < 5; i++) {
      const n = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.25, 6), mat(0x6fb84a));
      n.position.set((Math.random() - 0.5) * 1.2, 0.55, (Math.random() - 0.5) * 1.0);
      n.rotation.z = (Math.random() - 0.5) * 0.8;
      g.add(n);
    }
    super(game, g, 3, 1.7, 220);
    this.noodles = noodles;
    this.place(x, y, -100 - Math.random() * 20);
    this.baseLat = x;
    this.cool = 1.5 + Math.random();
    this.holdT = 0;
  }
  update(dt) {
    super.update(dt);
    // 麺がなびく
    for (const n of this.noodles) {
      const wave = Math.sin(this.t * 7 + n.phase) * 0.35;
      n.root.rotation.z = 0.5 + wave;
      n.root.rotation.x = Math.sin(this.t * 5 + n.phase * 1.3) * 0.25;
      n.segs.forEach((seg, i) => {
        seg.rotation.z = Math.sin(this.t * 9 + n.phase + i * 0.6) * 0.4;
        seg.rotation.x = Math.cos(this.t * 7 + n.phase + i) * 0.25;
      });
    }
    this.mesh.rotation.y += dt * 0.8;

    if (this.depth < -14) {
      this.place(
        this.baseLat + Math.sin(this.t * 1.4) * 2.2,
        this.h + Math.sin(this.t * 2) * 0.3,
        this.depth + depthSpeed(this.depth) * dt
      );
    } else if (this.holdT < 3.2) {
      this.holdT += dt;
      this.place(this.baseLat + Math.sin(this.t * 1.6) * 2.5, this.h, this.depth + 0.6 * dt);
      this.cool -= dt;
      if (this.cool <= 0) {
        this.cool = 2.0 * this.game.relief();
        // 飛び散る肉汁弾
        for (let i = -1; i <= 1; i++) {
          const v = this.game.player.pos.clone().sub(this.pos).normalize();
          v.addScaledVector(this.R, i * 0.28);
          v.y += 0.15;
          v.normalize().multiplyScalar(9);
          spawnBullet(this.game, this.pos.clone().add(new THREE.Vector3(0, 0.4, 0)), v, 0xc48a3a, 0.5);
        }
        this.game.audio.shoot();
      }
    } else {
      this.place(this.lat, this.h, this.depth + 15 * dt);
    }
    if (this.depth > 16) this.remove();
  }
}

// 「3割うまい！」女の子 — 常にプレイヤー側を見る2Dビルボード
let sanwariTex = null;
let shoutTex = null;
function getSanwariTex() {
  if (sanwariTex) return sanwariTex;
  sanwariTex = new THREE.TextureLoader().load('assets/sanwari.png');
  sanwariTex.colorSpace = THREE.SRGBColorSpace;
  return sanwariTex;
}
function getShoutTex() {
  if (shoutTex) return shoutTex;
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 160;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, 512, 160);
  c.fillStyle = '#fff8e8';
  c.strokeStyle = '#e83a7a';
  c.lineWidth = 10;
  c.beginPath();
  if (c.roundRect) c.roundRect(20, 10, 470, 100, 28);
  else { c.rect(20, 10, 470, 100); }
  c.fill(); c.stroke();
  c.beginPath();
  c.moveTo(220, 108); c.lineTo(250, 148); c.lineTo(280, 108);
  c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#ff5a20';
  c.font = 'bold 58px "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('3割うまい！！', 256, 62);
  shoutTex = new THREE.CanvasTexture(cv);
  shoutTex.colorSpace = THREE.SRGBColorSpace;
  return shoutTex;
}

export class SanwariGirl extends Enemy {
  constructor(game, x, y) {
    const g = new THREE.Group();
    const girl = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getSanwariTex(),
      transparent: true,
      depthWrite: false,
    }));
    girl.scale.set(5.2, 5.2, 1);
    g.add(girl);
    const shout = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getShoutTex(),
      transparent: true,
      depthWrite: false,
    }));
    shout.scale.set(4.2, 1.3, 1);
    shout.position.y = 3.2;
    g.add(shout);
    super(game, g, 4, 2.4, 350);
    this.girl = girl;
    this.shout = shout;
    this.place(x, y, -110);
    this.baseLat = x;
    this.cool = 1.8;
    this.holdT = 0;
  }
  update(dt) {
    super.update(dt);
    const pulse = 1 + Math.sin(this.t * 6) * 0.06;
    this.girl.scale.setScalar(5.2 * pulse);
    const shoutOn = Math.sin(this.t * 3.2) > -0.2;
    this.shout.visible = shoutOn;
    if (shoutOn) {
      const s = 1 + Math.abs(Math.sin(this.t * 8)) * 0.12;
      this.shout.scale.set(4.2 * s, 1.3 * s, 1);
      this.shout.position.y = 3.1 + Math.sin(this.t * 10) * 0.15;
    }

    if (this.depth < -18) {
      this.place(
        this.baseLat + Math.sin(this.t * 1.2) * 1.8,
        this.h,
        this.depth + depthSpeed(this.depth) * 0.9 * dt
      );
    } else if (this.holdT < 5) {
      this.holdT += dt;
      this.place(this.baseLat + Math.sin(this.t * 1.5) * 3, this.h + Math.sin(this.t * 2) * 0.4, this.depth + 0.5 * dt);
      this.cool -= dt;
      if (this.cool <= 0) {
        this.cool = 1.8 * this.game.relief();
        // 「うまい」気合弾(ピンク)
        for (let i = -2; i <= 2; i++) {
          const v = this.game.player.pos.clone().sub(this.pos).normalize();
          v.addScaledVector(this.R, i * 0.18);
          v.normalize().multiplyScalar(11);
          spawnBullet(this.game, this.pos, v, 0xff4d8a, 0.48);
        }
        this.game.audio.shoot();
        this.game.audio.msg();
      }
    } else {
      this.place(this.lat, this.h, this.depth + 14 * dt);
    }
    if (this.depth > 16) this.remove();
  }
}

// カイシキ一号 — 画面外はるか横から突入
export class Biplane extends Enemy {
  constructor(game, side, y) {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.5, 4, 10), mat(0xc8b485));
    body.rotation.z = Math.PI / 2;
    inner.add(body);
    for (const h of [0.45, -0.15]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.07, 2.9), mat(0xe8dcc0));
      wing.position.set(0.15, h, 0);
      inner.add(wing);
    }
    const tailW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 1.1), mat(0xe8dcc0));
    tailW.position.set(-1.0, 0.15, 0); inner.add(tailW);
    const prop = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), mat(0x6b4a20));
    prop.scale.set(0.06, 1, 0.16);
    prop.position.x = 1.05;
    inner.add(prop);
    inner.rotation.y = side > 0 ? Math.PI : 0;
    g.add(inner);
    super(game, g, 2, 1.3, 150);
    this.prop = prop;
    this.inner = inner;
    // はるか画面外から
    this.place(side * 40, y, -50 - Math.random() * 20);
    this.vLat = -side * (11 + Math.random() * 4);
    this.cool = 0.5;
  }
  update(dt) {
    super.update(dt);
    this.prop.rotation.x += dt * 30;
    // 遠くは遅く、画面内に入ったら加速
    const inFrame = Math.abs(this.lat) < 16;
    const latSp = inFrame ? this.vLat * 1.35 : this.vLat * 0.55;
    const dSp = inFrame ? 5 : 2;
    this.place(this.lat + latSp * dt, this.h, this.depth + dSp * dt);
    this.inner.rotation.z = Math.sin(this.t * 3) * 0.15;
    this.cool -= dt;
    if (this.cool <= 0 && Math.abs(this.lat) < 14) {
      this.cool = 1.4 * this.game.relief();
      shootAt(this.game, this.pos, 12.5, 0xffa03c, 0.55, 2.5);
      this.game.audio.shoot();
    }
    if (Math.abs(this.lat) > 45 || this.depth > 18) this.remove();
  }
}

// ネギミサイル — 下から。近くで並走気味に追尾
export class Negi extends Enemy {
  constructor(game, x, z) {
    const g = new THREE.Group();
    const white = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 1.6, 10), mat(0xf8f8ee));
    g.add(white);
    const green = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.3, 10), mat(0x5da03c));
    green.position.y = 1.4; g.add(green);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.8, 8), mat(0x6fb84a));
    leaf.position.set(0.18, 1.3, 0); leaf.rotation.z = -0.35;
    g.add(leaf);
    super(game, g, 1, 1.0);
    this.place(x, -2, z);
    this.vel = new THREE.Vector3(0, 9, 0);
  }
  update(dt) {
    super.update(dt);
    const dist = this.pos.distanceTo(this.game.player.pos);
    const spd = dist > 25 ? 6 : dist > 10 ? 12 : 5; // 遠い遅・近づき速・近く並走
    const to = this.game.player.pos.clone().sub(this.pos).normalize().multiplyScalar(spd);
    this.vel.lerp(to, dt * (dist > 10 ? 0.9 : 0.4));
    this.pos.addScaledVector(this.vel, dt);
    this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.vel.clone().normalize());
    if (this.t > 7 || this.pos.distanceTo(this.game.player.pos) > 130) this.remove();
  }
}

/** 団子8体ウェーブを一括スポーン */
export function spawnDangoPack(game, mode = 'swarm') {
  for (let i = 0; i < 8; i++) {
    const lat = -12 + i * 3.4;
    const h = 2.8 + (i % 3) * 2.4 + Math.random();
    new Dango(game, lat, h, mode);
  }
}

// ===== ボス: ヤキダンゴドラゴン(常に後方=theta 0 で出現) =====
export class Boss extends Enemy {
  constructor(game) {
    const head = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 16), mat(0xa06a35));
    skull.scale.set(1, 0.95, 1.05);
    head.add(skull);
    for (let i = 0; i < 5; i++) { // 焼き目
      const burn = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), mat(0x6b3d14));
      const a = i * 1.7, b = i * 0.9;
      burn.position.set(Math.sin(a) * 1.9, Math.cos(b) * 1.5, Math.cos(a) * 1.4);
      burn.scale.z = 0.4;
      burn.lookAt(0, 0, 0);
      head.add(burn);
    }
    for (const s of [-1, 1]) { // 目(怒り)
      const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), mat(0xffffff));
      eyeW.position.set(s * 0.85, 0.55, 1.75);
      head.add(eyeW);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat(0xd42010));
      pupil.position.set(s * 0.8, 0.5, 2.15);
      head.add(pupil);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.2), mat(0x4a2408));
      brow.position.set(s * 0.85, 1.1, 1.95);
      brow.rotation.z = -s * 0.5;
      head.add(brow);
    }
    for (const s of [-1, 1]) { // 角=串
      const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 2.2, 8), mat(0xd8b57e));
      horn.position.set(s * 1.1, 2.2, -0.3);
      horn.rotation.z = -s * 0.35;
      head.add(horn);
    }
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 10), mat(0x571c08));
    mouth.position.set(0, -0.7, 1.7); mouth.scale.set(1.15, 0.6, 0.5);
    head.add(mouth);

    head.scale.setScalar(1.3);
    super(game, head, 60, 3.2, 5000);
    this.place(0, 6, -55);
    this.maxHp = 60;

    // 体節(団子8個)
    this.segments = [];
    for (let i = 0; i < 8; i++) {
      const seg = new THREE.Mesh(new THREE.SphereGeometry(1.6 - i * 0.09, 16, 12), mat(i % 2 ? 0x8a5a2a : 0xb9834f));
      seg.position.copy(head.position);
      game.scene.add(seg);
      this.segments.push(seg);
    }
    this.history = [];
    this.cool = 2.5;
    this.entered = false;
    this.rage = false;
  }
  update(dt) {
    super.update(dt);
    const t = this.t;
    if (!this.entered) {
      this.place(this.lat, this.h, this.depth + 12 * dt);
      if (this.depth >= -32) this.entered = true;
    } else {
      const speed = this.rage ? 1.5 : 1.0;
      this.place(
        Math.sin(t * 0.7 * speed) * 8,
        5.2 + Math.sin(t * 1.13 * speed) * 3.2,
        -32 + Math.sin(t * 0.43) * 6
      );
    }
    this.mesh.lookAt(this.game.player.pos);

    // 体節が頭の軌跡を追う
    this.history.unshift(this.pos.clone());
    if (this.history.length > 200) this.history.pop();
    const gap = 9;
    this.segments.forEach((s, i) => {
      const h = this.history[Math.min((i + 1) * gap, this.history.length - 1)];
      if (h) s.position.lerp(h, 0.5);
      s.rotation.y += dt;
    });

    // 攻撃
    if (this.entered) {
      this.cool -= dt;
      if (this.cool <= 0) {
        this.cool = (this.rage ? 1.5 : 2.4) * this.game.relief();
        const n = this.rage ? 7 : 5;
        const base = this.game.player.pos.clone().sub(this.pos).normalize();
        for (let i = 0; i < n; i++) {
          const v = base.clone();
          v.addScaledVector(this.R, (i - (n - 1) / 2) * 0.16);
          v.y += (Math.random() - 0.5) * 0.1;
          v.normalize().multiplyScalar(this.rage ? 13 : 10);
          spawnBullet(this.game, this.pos.clone().add(new THREE.Vector3(0, -0.7, 1.5)), v, 0xff7030, 0.7);
        }
        this.game.audio.shoot();
      }
    }
    this.game.ui.setBossHp(this.hp / this.maxHp);
    if (!this.rage && this.hp <= this.maxHp / 2) {
      this.rage = true;
      this.game.ui.showStageMsg('ヤキダンゴドラゴン 発狂モード！！');
      this.game.audio.msg();
    }
  }
  die() {
    if (!this.alive) return;
    this.alive = false;
    // 体節ごと連鎖爆発
    this.segments.forEach((s, i) => {
      setTimeout(() => {
        if (!this.game.scene) return;
        spawnExplosion(this.game, s.position, 1.6);
        this.game.audio.boom();
        this.game.scene.remove(s);
        disposeObject(s);
      }, i * 180);
    });
    spawnExplosion(this.game, this.pos, 3);
    this.game.audio.bigBoom();
    this.game.scene.remove(this.mesh);
    disposeObject(this.mesh);
    this.game.onBossDefeated(this);
  }
  remove() {
    this.alive = false;
    this.game.scene.remove(this.mesh);
    disposeObject(this.mesh);
    this.segments.forEach(s => { this.game.scene.remove(s); disposeObject(s); });
  }
}
