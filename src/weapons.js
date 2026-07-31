import * as THREE from 'three';
import { disposeObject } from './enemies.js';

// 直線ショット + ロックオン/ホーミング + 照準管理
export class Weapons {
  constructor(game) {
    this.game = game;
    this.shots = [];      // 直線弾
    this.missiles = [];   // ホーミング弾
    this.locks = [];      // ロック中の敵
    this.maxLocks = 8;
    this.shotCool = 0;
    this.wasLocking = false;
    this._v = new THREE.Vector3();
    this._raycaster = new THREE.Raycaster();
    this._aimPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 45); // z=-45
    game.input.onLockRelease = () => this.releaseLocks();

    // ロックオンライン(自機→ロック中の敵)
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.maxLocks * 6), 3));
    this.lockLines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({ color: 0xffe93d, transparent: true, opacity: 0.65 })
    );
    this.lockLines.frustumCulled = false;
    game.scene.add(this.lockLines);
  }

  // 照準(スクリーン座標)→ 奥の平面上のワールド座標
  aimWorldPoint() {
    const { input, camera } = this.game;
    const ndc = new THREE.Vector2(
      (input.aim.x / innerWidth) * 2 - 1,
      -(input.aim.y / innerHeight) * 2 + 1
    );
    this._raycaster.setFromCamera(ndc, camera);
    const pt = new THREE.Vector3();
    this._raycaster.ray.intersectPlane(this._aimPlane, pt);
    return pt || new THREE.Vector3(0, 5, -45);
  }

  fireShot() {
    const { game } = this;
    const from = game.player.pos.clone();
    from.z -= 0.5;
    const aim = this.aimWorldPoint();
    const dir = aim.sub(from).normalize();
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff04a })
    );
    m.scale.z = 3.2;
    m.position.copy(from);
    m.lookAt(from.clone().add(dir));
    game.scene.add(m);
    this.shots.push({ mesh: m, vel: dir.multiplyScalar(95), life: 1.6 });
    game.audio.shoot();
  }

  // ロックオンスイープ: 照準近くの敵をロック
  sweepLocks() {
    const { game } = this;
    if (this.locks.length >= this.maxLocks) return;
    const aim = game.input.aim;
    const v = this._v;
    for (const e of game.enemies) {
      if (!e.alive || !e.lockable || e.locked) continue;
      if (e.pos.z > -4) continue;
      v.copy(e.pos).project(game.camera);
      const sx = (v.x + 1) * 0.5 * innerWidth;
      const sy = (-v.y + 1) * 0.5 * innerHeight;
      const dist = Math.hypot(sx - aim.x, sy - aim.y);
      let range = Math.min(innerWidth, innerHeight) * 0.09 + 30;
      if (game.input.isTouch) range *= 1.7; // 指操作は判定を甘く
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
      game.homingSalvo = { total: targets.length, kills: 0, timer: 0 }; // コンボ計測
      targets.forEach((e, i) => {
        setTimeout(() => { if (e.alive) this.launchMissile(e); }, i * 90);
      });
    }
    this.locks.forEach(e => e.setLocked(false));
    this.locks = [];
    game.ui.setLock(0);
  }

  launchMissile(target) {
    const { game } = this;
    const from = game.player.pos.clone();
    const g = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff7bac }));
    g.add(head);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
    tail.position.z = 0.4; tail.rotation.x = Math.PI / 2;
    g.add(tail);
    g.position.copy(from);
    game.scene.add(g);
    // 初速は横に散らして曲がる演出
    const side = (Math.random() - 0.5) * 2;
    const vel = new THREE.Vector3(side * 18, 6 + Math.random() * 8, 8);
    this.missiles.push({ mesh: g, vel, target, life: 4, speed: 55 });
  }

  update(dt) {
    const { game } = this;
    const input = game.input;

    // 直線連射
    this.shotCool -= dt;
    if (input.firing && !game.player.dead && this.shotCool <= 0) {
      this.fireShot();
      this.shotCool = 0.13;
    }

    // ロックスイープ(ロック中は気合顔)
    if (input.locking && !game.player.dead) {
      this.sweepLocks();
      if (this.locks.length > 0 && game.player.exprTimer <= 0.1) game.player.setExpression('angry', 0.2);
    }

    // 死んだ敵のロック解除
    this.locks = this.locks.filter(e => { if (!e.alive) { game.ui.setLock(this.locks.length - 1); return false; } return true; });

    // ロックオンラインの更新
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
        if (s.mesh.position.distanceTo(e.pos) < e.radius + 0.4) {
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

    // ===== ホーミング弾 =====
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const ms = this.missiles[i];
      ms.life -= dt;
      if (ms.target && ms.target.alive) {
        const to = this._v.copy(ms.target.pos).sub(ms.mesh.position).normalize().multiplyScalar(ms.speed);
        ms.vel.lerp(to, Math.min(1, dt * 6));
      }
      ms.mesh.position.addScaledVector(ms.vel, dt);
      ms.mesh.lookAt(ms.mesh.position.clone().add(ms.vel));
      let done = false;
      if (ms.target && ms.target.alive && ms.mesh.position.distanceTo(ms.target.pos) < ms.target.radius + 0.6) {
        ms.target.damage(1, true);
        done = true;
      }
      if (done || ms.life <= 0) {
        game.scene.remove(ms.mesh);
        disposeObject(ms.mesh);
        this.missiles.splice(i, 1);
      }
    }
  }

  clear() {
    this.shots.forEach(s => this.game.scene.remove(s.mesh));
    this.missiles.forEach(m => this.game.scene.remove(m.mesh));
    this.shots = []; this.missiles = []; this.locks = [];
  }
}
