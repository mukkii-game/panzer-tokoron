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

export class Enemy {
  constructor(game, group, hp, radius, score = 100) {
    this.game = game;
    this.mesh = group;
    this.hp = hp; this.radius = radius; this.score = score;
    this.alive = true;
    this.t = 0;
    this.lockable = true;
    this.locked = false;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: getLockTex(), transparent: true, depthTest: false }));
    spr.scale.setScalar(radius * 2.6);
    spr.visible = false;
    group.add(spr);
    this.lockSprite = spr;
    game.scene.add(group);
    game.enemies.push(this);
  }
  get pos() { return this.mesh.position; }
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

// ===== 弾 =====
export function spawnBullet(game, from, vel, color = 0x5a2c10, r = 0.3, gravity = 0) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ color }));
  m.position.copy(from);
  game.scene.add(m);
  game.enemyBullets.push({ mesh: m, vel: vel.clone(), r, gravity, life: 7 });
}
export function shootAt(game, from, speed, color, r = 0.3, spread = 0) {
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
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.28 * size, 6, 5), new THREE.MeshBasicMaterial({ color: colors[i % colors.length] }));
    m.position.copy(pos);
    const v = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).normalize().multiplyScalar(6 + Math.random() * 5);
    game.scene.add(m);
    parts.push({ mesh: m, vel: v });
  }
  game.effects.push({ parts, t: 0, dur: 0.55 });
}

// ================= 敵たち =================

// ヤキダンゴ(3玉串) — 回転しながら蛇行して体当たり
export class Dango extends Enemy {
  constructor(game, x, y) {
    const g = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8), mat(0xd8b57e));
    g.add(stick);
    for (let i = 0; i < 3; i++) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.52, 14, 12), mat(i === 1 ? 0x8a5a2a : 0xb9834f));
      ball.position.y = (i - 1) * 0.95;
      ball.scale.y = 0.9;
      g.add(ball);
    }
    g.position.set(x, y, -85);
    super(game, g, 1, 1.05);
    this.baseX = x;
    this.speed = 19 + Math.random() * 5;
    this.phase = Math.random() * 7;
  }
  update(dt) {
    super.update(dt);
    this.pos.z += this.speed * dt;
    this.pos.x = this.baseX + Math.sin(this.t * 2 + this.phase) * 1.6;
    this.mesh.rotation.z += dt * 4;
    if (this.pos.z > 14) this.remove();
  }
}

// フカイシェイカー(醤油瓶) — 停止して醤油弾を山なりに投げる
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
    g.position.set(x, y, -80);
    super(game, g, 3, 1.2, 200);
    this.holdZ = -26 - Math.random() * 8;
    this.cool = 1.2 + Math.random();
  }
  update(dt) {
    super.update(dt);
    if (this.pos.z < this.holdZ) this.pos.z += 20 * dt;
    else {
      this.pos.z += 1.5 * dt;
      this.pos.y += Math.sin(this.t * 2.2) * dt * 1.2;
      this.mesh.rotation.z = Math.sin(this.t * 8) * 0.12; // シェイク
      this.cool -= dt;
      if (this.cool <= 0) {
        this.cool = 2.6 * this.game.relief();
        // 山なり醤油弾(大きめ・ゆっくりで軌道を読みやすく)
        const v = this.game.player.pos.clone().sub(this.pos);
        const time = 1.75;
        const g0 = 9;
        v.multiplyScalar(1 / time);
        v.y += g0 * time * 0.5;
        spawnBullet(this.game, this.pos, v, 0x3b1206, 0.5, g0);
        this.game.audio.shoot();
      }
    }
    if (this.pos.z > 14) this.remove();
  }
}

// サヤマチャドローン(湯呑み) — 横移動しつつ3way茶弾
export class TeaDrone extends Enemy {
  constructor(game, x, y) {
    const g = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.55, 1.0, 14), mat(0x5f8f3e));
    g.add(cup);
    const tea = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 14), mat(0x9fce30));
    tea.position.y = 0.5; g.add(tea);
    const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.8, 0.14, 14), mat(0xdccbb0));
    saucer.position.y = -0.62; g.add(saucer);
    const rotor = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 6), mat(0x3d6b28));
    rotor.scale.set(1, 0.05, 0.16);
    rotor.position.y = 0.95;
    g.add(rotor);
    g.position.set(x, y, -75);
    super(game, g, 2, 1.15, 150);
    this.rotor = rotor;
    this.dir = x > 0 ? -1 : 1;
    this.cool = 1.5 + Math.random();
  }
  update(dt) {
    super.update(dt);
    this.rotor.rotation.y += dt * 20;
    if (this.pos.z < -20) this.pos.z += 16 * dt;
    else {
      this.pos.z += 2 * dt;
      this.pos.x += this.dir * 4.5 * dt;
      if (Math.abs(this.pos.x) > 13) this.dir *= -1;
      this.cool -= dt;
      if (this.cool <= 0) {
        this.cool = 2.8 * this.game.relief();
        const base = this.game.player.pos.clone().sub(this.pos).normalize();
        for (let i = -1; i <= 1; i++) {
          const v = base.clone();
          v.x += i * 0.22; v.normalize().multiplyScalar(10);
          spawnBullet(this.game, this.pos, v, 0x86b829, 0.3);
        }
        this.game.audio.shoot();
      }
    }
    if (this.pos.z > 14) this.remove();
  }
}

// カイシキ一号(複葉機) — 横から高速で横切り、直線弾
export class Biplane extends Enemy {
  constructor(game, side, y) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.5, 4, 10), mat(0xc8b485));
    body.rotation.z = Math.PI / 2;
    g.add(body);
    for (const h of [0.45, -0.15]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.07, 2.9), mat(0xe8dcc0));
      wing.position.set(0.15, h, 0);
      g.add(wing);
    }
    const tailW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 1.1), mat(0xe8dcc0));
    tailW.position.set(-1.0, 0.15, 0); g.add(tailW);
    const prop = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), mat(0x6b4a20));
    prop.scale.set(0.06, 1, 0.16);
    prop.position.x = 1.05;
    g.add(prop);
    g.position.set(side * 26, y, -38 - Math.random() * 15);
    g.rotation.y = side > 0 ? Math.PI : 0;
    super(game, g, 2, 1.3, 150);
    this.prop = prop;
    this.vx = -side * (13 + Math.random() * 5);
    this.cool = 0.7;
  }
  update(dt) {
    super.update(dt);
    this.prop.rotation.x += dt * 30;
    this.pos.x += this.vx * dt;
    this.pos.z += 3.5 * dt;
    this.mesh.rotation.z = Math.sin(this.t * 3) * 0.15;
    this.cool -= dt;
    if (this.cool <= 0 && Math.abs(this.pos.x) < 15) {
      this.cool = 1.5 * this.game.relief();
      shootAt(this.game, this.pos, 12.5, 0xffa03c, 0.28, 2.5);
      this.game.audio.shoot();
    }
    if (Math.abs(this.pos.x) > 30 || this.pos.z > 14) this.remove();
  }
}

// ネギミサイル — 下から発射、ゆる追尾
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
    g.position.set(x, -2, z);
    super(game, g, 1, 1.0);
    this.vel = new THREE.Vector3(0, 9, 0);
  }
  update(dt) {
    super.update(dt);
    const to = this.game.player.pos.clone().sub(this.pos).normalize().multiplyScalar(9);
    this.vel.lerp(to, dt * 0.7);
    this.pos.addScaledVector(this.vel, dt);
    this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.vel.clone().normalize());
    if (this.t > 6 || this.pos.z > 14) this.remove();
  }
}

// ===== ボス: ヤキダンゴドラゴン =====
export class Boss extends Enemy {
  constructor(game) {
    const head = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 16), mat(0xa06a35));
    skull.scale.set(1, 0.95, 1.05);
    head.add(skull);
    // 焼き目
    for (let i = 0; i < 5; i++) {
      const burn = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), mat(0x6b3d14));
      const a = i * 1.7, b = i * 0.9;
      burn.position.set(Math.sin(a) * 1.9, Math.cos(b) * 1.5, Math.cos(a) * 1.4);
      burn.scale.z = 0.4;
      burn.lookAt(0, 0, 0);
      head.add(burn);
    }
    // 目(怒り)
    for (const s of [-1, 1]) {
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
    // 角=串
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 2.2, 8), mat(0xd8b57e));
      horn.position.set(s * 1.1, 2.2, -0.3);
      horn.rotation.z = -s * 0.35;
      head.add(horn);
    }
    // 口
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 10), mat(0x571c08));
    mouth.position.set(0, -0.7, 1.7); mouth.scale.set(1.15, 0.6, 0.5);
    head.add(mouth);

    head.scale.setScalar(1.3);
    head.position.set(0, 6, -55);
    super(game, head, 60, 3.2, 5000);
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
      this.pos.z += 12 * dt;
      if (this.pos.z >= -32) this.entered = true;
    } else {
      const speed = this.rage ? 1.5 : 1.0;
      this.pos.x = Math.sin(t * 0.7 * speed) * 8;
      this.pos.y = 5.2 + Math.sin(t * 1.13 * speed) * 3.2;
      this.pos.z = -32 + Math.sin(t * 0.43) * 6;
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
          v.x += (i - (n - 1) / 2) * 0.16;
          v.y += (Math.random() - 0.5) * 0.1;
          v.normalize().multiplyScalar(this.rage ? 13 : 11);
          spawnBullet(this.game, this.pos.clone().add(new THREE.Vector3(0, -0.7, 1.5)), v, 0xff7030, 0.42);
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
