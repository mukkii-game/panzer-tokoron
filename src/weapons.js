import * as THREE from 'three';

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
      const range = Math.min(innerWidth, innerHeight) * 0.09 + 30;
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

    // ロックスイープ
    if (input.locking && !game.player.dead) this.sweepLocks();

    // 死んだ敵のロック解除
    this.locks = this.locks.filter(e => { if (!e.alive) { game.ui.setLock(this.locks.length - 1); return false; } return true; });

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
