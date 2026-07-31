import * as THREE from 'three';
import { disposeObject } from './enemies.js';

const puffGeo = new THREE.SphereGeometry(1, 10, 8);

// ロック数(1〜8)ごとのもくもく雲カラー(薄め)
const LOCK_SMOKE = [
  0xfffaf0, // 1 薄いクリーム白
  0xfff3a0, // 2 薄い黄
  0xa8dcff, // 3 薄い青
  0xffb0b8, // 4 薄い赤
  0xc8f5b0, // 5 薄い緑
  0xffd0a8, // 6 薄い橙
  0xd8c8ff, // 7 薄い紫
  0xff98c0, // 8 薄いピンク
];

// 直線ショット + ロックオン/ホーミング + 照準管理
export class Weapons {
  constructor(game) {
    this.game = game;
    this.shots = [];
    this.missiles = [];
    this.smokes = [];
    this.locks = [];
    this.maxLocks = 8;
    this.shotCool = 0;
    this._v = new THREE.Vector3();
    this._raycaster = new THREE.Raycaster();
    this._aimPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 45);
    game.input.onLockRelease = () => this.releaseLocks();

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.maxLocks * 6), 3));
    this.lockLines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({ color: 0xffe93d, transparent: true, opacity: 0.7 })
    );
    this.lockLines.frustumCulled = false;
    game.scene.add(this.lockLines);
  }

  aimWorldPoint() {
    const { input, camera, player } = this.game;
    const F = this.game.frameF(this.game.viewYaw);
    this._aimPlane.setFromNormalAndCoplanarPoint(F, player.pos.clone().addScaledVector(F, -45));
    const ndc = new THREE.Vector2(
      (input.aim.x / innerWidth) * 2 - 1,
      -(input.aim.y / innerHeight) * 2 + 1
    );
    this._raycaster.setFromCamera(ndc, camera);
    const pt = new THREE.Vector3();
    const hit = this._raycaster.ray.intersectPlane(this._aimPlane, pt);
    return hit || player.pos.clone().addScaledVector(F, -45).add(new THREE.Vector3(0, 2, 0));
  }

  fireShot() {
    const { game } = this;
    const F = game.frameF(game.viewYaw);
    const from = game.player.pos.clone().addScaledVector(F, -0.6);
    const aim = this.aimWorldPoint();
    const dir = aim.sub(from).normalize();
    // 通常弾: 5倍サイズ・2倍速
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(2.4, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff04a })
    );
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(3.5, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe080, transparent: true, opacity: 0.35 })
    );
    const g = new THREE.Group();
    g.add(m, glow);
    g.position.copy(from);
    g.lookAt(from.clone().add(dir));
    game.scene.add(g);
    this.shots.push({ mesh: g, vel: dir.multiplyScalar(184), life: 1.4, hitR: 2.6 });
    game.audio.shoot();
  }

  sweepLocks() {
    const { game } = this;
    if (this.locks.length >= this.maxLocks) return;
    const aim = game.input.aim;
    const F = game.frameF(game.viewYaw);
    const v = this._v;
    for (const e of game.enemies) {
      if (!e.alive || !e.lockable || e.locked) continue;
      if (v.copy(e.pos).sub(game.player.pos).dot(F) > -4) continue;
      v.copy(e.pos).project(game.camera);
      if (v.z > 1) continue;
      const sx = (v.x + 1) * 0.5 * innerWidth;
      const sy = (-v.y + 1) * 0.5 * innerHeight;
      const dist = Math.hypot(sx - aim.x, sy - aim.y);
      let range = Math.min(innerWidth, innerHeight) * 0.12 + 40;
      if (game.input.isTouch) range *= 1.7;
      if (dist < range) {
        e.setLocked(true);
        this.locks.push(e);
        game.audio.lock(this.locks.length);
        game.ui.setLock(this.locks.length);
        if (this.locks.length >= this.maxLocks) break;
      }
    }
  }

  releaseLocks() {
    const { game } = this;
    const targets = this.locks.filter(e => e.alive);
    if (targets.length > 0) {
      game.player.setExpression('angry', 0.9);
      game.audio.homing();
      game.homingSalvo = { total: targets.length, kills: 0, timer: 0 };
      const lockTotal = targets.length;
      targets.forEach((e, i) => {
        setTimeout(() => { if (e.alive) this.launchMissile(e, i, lockTotal); }, i * 90);
      });
    }
    this.locks.forEach(e => e.setLocked(false));
    this.locks = [];
    game.ui.setLock(0);
  }

  launchMissile(target, lockIndex = 0, lockTotal = 1) {
    const { game } = this;
    const from = game.player.pos.clone();
    const g = new THREE.Group();
    // 大きめピンク玉 + グロー
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xff6aa0 })
    );
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd0e0, transparent: true, opacity: 0.5 })
    );
    g.add(head, glow);
    g.position.copy(from);
    game.scene.add(g);

    // 大きく横に散らしてから曲線で巻き込む
    const R = game.frameR(game.viewYaw);
    const F = game.frameF(game.viewYaw);
    const side = (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 18);
    const up = 4 + Math.random() * 16;
    const vel = new THREE.Vector3()
      .addScaledVector(R, side)
      .add(new THREE.Vector3(0, up, 0))
      .addScaledVector(F, -4);
    // ロック数・何発目かで色分け(途中から色づく)
    const hue = LOCK_SMOKE[Math.min(lockTotal - 1, LOCK_SMOKE.length - 1)];
    const accent = LOCK_SMOKE[Math.min(lockIndex, LOCK_SMOKE.length - 1)];
    this.missiles.push({
      mesh: g, vel, target, life: 4.5, age: 0, speed: 52, emit: 0,
      puffBase: 0xffffff,
      puffHue: hue,
      puffAccent: accent,
    });
  }

  spawnPuff(pos, color, scale = 0.85, opacity = 0.38) {
    const puff = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false,
    }));
    puff.position.copy(pos);
    puff.position.x += (Math.random() - 0.5) * 0.5;
    puff.position.y += (Math.random() - 0.5) * 0.5;
    puff.position.z += (Math.random() - 0.5) * 0.5;
    puff.scale.setScalar(scale);
    this.game.scene.add(puff);
    this.smokes.push({
      mesh: puff, t: 0, max: 0.85 + Math.random() * 0.4,
      baseOpacity: opacity,
      startScale: scale,
    });
  }

  update(dt) {
    const { game } = this;
    const input = game.input;

    this.shotCool -= dt;
    if (input.firing && !game.player.dead && this.shotCool <= 0) {
      this.fireShot();
      this.shotCool = 0.13;
    }

    if (input.locking && !game.player.dead) {
      this.sweepLocks();
      if (this.locks.length > 0 && game.player.exprTimer <= 0.1) game.player.setExpression('angry', 0.2);
    }

    this.locks = this.locks.filter(e => {
      if (!e.alive) { game.ui.setLock(this.locks.length - 1); return false; }
      return true;
    });

    const lp = this.lockLines.geometry.attributes.position;
    const pp = game.player.pos;
    for (let i = 0; i < this.maxLocks; i++) {
      const e = this.locks[i];
      if (e && e.alive) {
        const wob = Math.sin(game.time * 20 + i) * 0.1;
        lp.setXYZ(i * 2, pp.x, pp.y + 0.3, pp.z);
        lp.setXYZ(i * 2 + 1, e.pos.x + wob, e.pos.y + wob, e.pos.z);
      } else {
        lp.setXYZ(i * 2, 0, -100, 0);
        lp.setXYZ(i * 2 + 1, 0, -100, 0);
      }
    }
    lp.needsUpdate = true;
    this.lockLines.visible = this.locks.length > 0;

    // ===== 直線弾 =====
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.mesh.position.addScaledVector(s.vel, dt);
      s.life -= dt;
      let hit = false;
      for (const e of game.enemies) {
        if (!e.alive) continue;
        if (s.mesh.position.distanceTo(e.pos) < e.radius + (s.hitR || 0.65)) {
          e.damage(1);
          hit = true;
          break;
        }
      }
      if (hit || s.life <= 0) {
        game.scene.remove(s.mesh);
        disposeObject(s.mesh);
        this.shots.splice(i, 1);
      }
    }

    // ===== ホーミング弾(大きな弧 + もくもく雲) =====
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const ms = this.missiles[i];
      ms.life -= dt;
      ms.age += dt;
      if (ms.target && ms.target.alive) {
        const to = this._v.copy(ms.target.pos).sub(ms.mesh.position).normalize().multiplyScalar(ms.speed);
        // 最初ゆるく→後半キュッと巻き込む = 大きな曲線
        const gain = Math.min(11, 1.2 + ms.age * 8);
        ms.vel.lerp(to, Math.min(1, dt * gain));
        // 軌道に少し横揺れを足して生き物っぽく
        ms.vel.x += Math.sin(ms.age * 9 + i) * dt * 8;
        ms.vel.y += Math.cos(ms.age * 7 + i) * dt * 5;
      }
      ms.mesh.position.addScaledVector(ms.vel, dt);
      if (ms.vel.lengthSq() > 0.01) ms.mesh.lookAt(ms.mesh.position.clone().add(ms.vel));

      // もくもく雲(大きめ): 透明度はそのまま
      ms.emit -= dt;
      if (ms.emit <= 0) {
        ms.emit = 0.022;
        const tint = ms.age < 0.45 ? ms.puffBase
          : (Math.random() < 0.55 ? ms.puffHue : ms.puffAccent);
        this.spawnPuff(ms.mesh.position, tint, 1.0 + Math.random() * 0.55, 0.36);
        if (Math.random() < 0.3) this.spawnPuff(ms.mesh.position, tint, 1.5 + Math.random() * 0.4, 0.28);
      }

      let done = false;
      if (ms.target && ms.target.alive && ms.mesh.position.distanceTo(ms.target.pos) < ms.target.radius + 0.9) {
        ms.target.damage(1, true);
        for (let k = 0; k < 8; k++) {
          this.spawnPuff(ms.mesh.position, ms.puffHue, 1.2 + Math.random() * 0.9, 0.32);
        }
        done = true;
      }
      if (done || ms.life <= 0) {
        game.scene.remove(ms.mesh);
        disposeObject(ms.mesh);
        this.missiles.splice(i, 1);
      }
    }

    // 雲パフ成長・フェード
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const p = this.smokes[i];
      p.t += dt;
      const k = p.t / p.max;
      const s0 = p.startScale ?? 0.85;
      p.mesh.scale.setScalar(s0 + k * 2.4);
      p.mesh.material.opacity = (p.baseOpacity ?? 0.38) * Math.max(0, 1 - k);
      p.mesh.position.y += dt * 0.55;
      if (k >= 1) {
        game.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.smokes.splice(i, 1);
      }
    }
  }

  clear() {
    this.shots.forEach(s => { this.game.scene.remove(s.mesh); disposeObject(s.mesh); });
    this.missiles.forEach(m => { this.game.scene.remove(m.mesh); disposeObject(m.mesh); });
    this.smokes.forEach(p => { this.game.scene.remove(p.mesh); p.mesh.material.dispose(); });
    this.shots = []; this.missiles = []; this.smokes = []; this.locks = [];
  }
}
