import * as THREE from 'three';

// トコろん配色
const C = {
  body: 0xf6a21e, face: 0xfdf3dc, hat: 0xffcc00, hatDark: 0xf0a800,
  prop: 0x7dc242, wing: 0xfffdf5, foot: 0xffd04d,
};

function mat(color) { return new THREE.MeshToonMaterial({ color }); }

// ===== 表情canvas =====
export function drawFace(ctx, kind) {
  const S = 256;
  ctx.clearRect(0, 0, S, S);
  ctx.save();
  ctx.translate(0, 16); // 帽子のつばに隠れないよう顔パーツをやや下へ
  ctx.lineCap = 'round';
  const eye = (x, y, rx, ry) => { ctx.fillStyle = '#3a2410'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill(); };
  const cheek = (a = 1) => {
    ctx.fillStyle = `rgba(248,166,185,${a})`;
    ctx.beginPath(); ctx.ellipse(52, 158, 22, 16, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(204, 158, 22, 16, 0, 0, 7); ctx.fill();
  };
  const stroke = (w = 9, c = '#3a2410') => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.stroke(); };

  if (kind === 'normal') {
    eye(88, 112, 13, 16); eye(168, 112, 13, 16);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(92, 106, 4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(172, 106, 4, 0, 7); ctx.fill();
    cheek();
    ctx.beginPath(); ctx.arc(116, 148, 14, 0.15 * Math.PI, 0.85 * Math.PI); stroke();
    ctx.beginPath(); ctx.arc(144, 148, 14, 0.15 * Math.PI, 0.85 * Math.PI); stroke();
    ctx.fillStyle = '#e8608a'; ctx.beginPath(); ctx.ellipse(130, 158, 10, 7, 0, 0, Math.PI); ctx.fill();
  } else if (kind === 'joy') {
    ctx.beginPath(); ctx.arc(88, 118, 16, 1.15 * Math.PI, 1.85 * Math.PI); stroke(10);
    ctx.beginPath(); ctx.arc(168, 118, 16, 1.15 * Math.PI, 1.85 * Math.PI); stroke(10);
    cheek();
    ctx.fillStyle = '#7c2d12'; ctx.beginPath(); ctx.ellipse(128, 158, 26, 20, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#f87171'; ctx.beginPath(); ctx.ellipse(128, 168, 14, 8, 0, Math.PI, 0, true); ctx.fill();
  } else if (kind === 'angry') { // 気合
    ctx.beginPath(); ctx.moveTo(66, 90); ctx.lineTo(104, 104); stroke(9);
    ctx.beginPath(); ctx.moveTo(190, 90); ctx.lineTo(152, 104); stroke(9);
    eye(88, 120, 12, 14); eye(168, 120, 12, 14);
    cheek(0.8);
    ctx.fillStyle = '#7c2d12'; ctx.beginPath(); ctx.ellipse(128, 156, 16, 11, 0, 0, Math.PI); ctx.fill();
  } else if (kind === 'panic') { // 焦り >_<
    const x1 = 88, x2 = 168, y = 114;
    for (const x of [x1, x2]) {
      const d = x === x1 ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(x - 14 * d, y - 14); ctx.lineTo(x + 10 * d, y); ctx.lineTo(x - 14 * d, y + 14); stroke(9);
    }
    cheek();
    ctx.beginPath(); ctx.moveTo(104, 156);
    for (let i = 0; i <= 4; i++) ctx.lineTo(104 + i * 12, 156 + (i % 2 ? 8 : 0));
    stroke(8);
    ctx.fillStyle = '#6ec6f5'; // 汗
    ctx.beginPath(); ctx.ellipse(212, 92, 9, 13, -0.4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(40, 100, 7, 10, 0.4, 0, 7); ctx.fill();
  } else if (kind === 'pinch') { // うるうる
    for (const x of [88, 168]) {
      ctx.fillStyle = '#3a2410'; ctx.beginPath(); ctx.ellipse(x, 112, 16, 19, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + 5, 104, 6, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(160,220,255,.95)'; ctx.beginPath(); ctx.ellipse(x - 4, 122, 10, 7, 0, 0, Math.PI); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x, 138, 8, 10, 0, 0, 7); ctx.fill();
    }
    cheek();
    ctx.beginPath(); ctx.arc(128, 162, 10, 1.15 * Math.PI, 1.85 * Math.PI); stroke(8);
  } else if (kind === 'dizzy') { // 目回し
    for (const x of [88, 168]) {
      ctx.beginPath();
      for (let a = 0; a < 4.2 * Math.PI; a += 0.2) {
        const r = 3 + a * 1.35, px = x + Math.cos(a) * r, py = 112 + Math.sin(a) * r;
        a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      stroke(6);
    }
    cheek(0.7);
    ctx.fillStyle = '#7c2d12'; ctx.beginPath(); ctx.ellipse(128, 160, 14, 10, 0, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// ===== トコろんモデル =====
export function buildTokoron() {
  const g = new THREE.Group();

  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 20), mat(C.body));
  body.scale.set(1, 1.04, 0.96);
  g.add(body);

  // クリーム色の顔面
  const facePatch = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 20), mat(C.face));
  facePatch.position.set(0, -0.02, 0.22);
  g.add(facePatch);

  // 表情テクスチャ
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const fctx = cv.getContext('2d');
  drawFace(fctx, 'normal');
  const faceTex = new THREE.CanvasTexture(cv);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  const faceMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.72, 24),
    new THREE.MeshBasicMaterial({ map: faceTex, transparent: true })
  );
  faceMesh.position.set(0, -0.05, 1.06);
  g.add(faceMesh);

  // ===== 飛行機型帽子 =====
  const hat = new THREE.Group();
  hat.position.set(0, 0.72, 0);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.82, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(C.hat));
  dome.scale.set(1, 0.75, 1);
  hat.add(dome);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.1, 18, 1, false, 0, Math.PI), mat(C.hat));
  brim.rotation.y = -Math.PI / 2;
  brim.position.set(0, 0.05, 0.55); brim.scale.set(1.15, 1, 1.4);
  hat.add(brim);
  for (const s of [-1, 1]) { // 帽子の横羽
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.08, 0.42), mat(C.hatDark));
    fin.position.set(s * 0.95, 0.12, -0.05);
    fin.rotation.z = s * 0.25; fin.rotation.y = -s * 0.3;
    hat.add(fin);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.5), mat(C.hatDark)); // 尾翼
  tail.position.set(0, 0.35, -0.72); tail.rotation.x = -0.4;
  hat.add(tail);
  // プロペラ
  const propGroup = new THREE.Group();
  propGroup.position.set(0, 0.62, 0.1);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), mat(C.hatDark));
  shaft.position.y = 0.1; propGroup.add(shaft);
  const blades = new THREE.Group(); blades.position.y = 0.28;
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 6), mat(C.prop));
    b.scale.set(1, 0.06, 0.18);
    b.rotation.y = i * Math.PI / 2;
    blades.add(b);
  }
  propGroup.add(blades);
  hat.add(propGroup);
  g.add(hat);

  // ===== 羽(背中から) =====
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(s * 0.6, 0.05, -0.45);
    const feather = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat(C.wing));
    feather.scale.set(1.25, 0.12, 0.5);
    feather.position.x = s * 0.95;
    feather.rotation.z = s * 0.18;
    w.add(feather);
    const feather2 = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 6), mat(C.wing));
    feather2.scale.set(1.1, 0.1, 0.45);
    feather2.position.set(s * 0.55, -0.08, -0.28);
    w.add(feather2);
    g.add(w); wings.push(w);
  }

  // ===== 足 =====
  const feet = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.42, 4, 8), mat(C.foot));
    f.position.set(s * 0.38, -0.85, -0.35);
    f.rotation.x = Math.PI / 2 - 0.35;
    g.add(f); feet.push(f);
  }

  return { group: g, faceTex, fctx, blades, wings, feet, hat };
}

export class Player {
  constructor(game) {
    const m = buildTokoron();
    this.model = m;
    this.group = m.group;
    this.group.scale.setScalar(1.15);
    this.pos = new THREE.Vector3(0, 4.5, 0);
    this.vel = new THREE.Vector2(0, 0);
    this.hp = 5; this.maxHp = 5;
    this.invuln = 0;
    this.radius = 0.9; // 当たり判定は見た目より甘め(カジュアル調整)
    this.expression = 'normal';
    this.exprTimer = 0;
    this.shake = 0;
    this.dead = false;
    game.scene.add(this.group);
    this.group.position.copy(this.pos);
    // 地面の丸影(高度の距離感用)
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.0, 20),
      new THREE.MeshBasicMaterial({ color: 0x1a3a50, transparent: true, opacity: 0.28 })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = -0.44;
    game.scene.add(this.shadow);
    // カメラの方をやや向く+後傾して顔を見せる(イラストの飛行ポーズ)
    this.group.rotation.y = 0.28;
    this.baseTilt = -0.38;
    this.group.rotation.x = this.baseTilt;
  }

  setExpression(kind, dur = 1.0) {
    if (this.expression !== kind) {
      this.expression = kind;
      drawFace(this.model.fctx, kind);
      this.model.faceTex.needsUpdate = true;
    }
    this.exprTimer = dur;
  }

  baseExpression() { return this.hp <= 2 ? 'pinch' : 'normal'; }

  takeHit(game) {
    if (this.invuln > 0 || this.dead) return;
    this.hp--;
    this.invuln = 2.5;
    this.shake = 0.7;
    game.audio.hit();
    game.ui.setHearts(this.hp);
    game.ui.flashDamage();
    this.setExpression('panic', 1.4);
    if (this.hp <= 0) { this.dead = true; game.gameOver(); }
  }

  update(dt, game) {
    const t = game.time;

    if (!this.dead) {
      const mv = game.input.getMove();
      const sp = 14;
      this.vel.x += (mv.x * sp - this.vel.x) * Math.min(1, dt * 10);
      this.vel.y += (mv.y * sp - this.vel.y) * Math.min(1, dt * 10);
      this.pos.x = THREE.MathUtils.clamp(this.pos.x + this.vel.x * dt, -9.5, 9.5);
      this.pos.y = THREE.MathUtils.clamp(this.pos.y + this.vel.y * dt, 1.4, 9.5);
    } else {
      // きりもみ落下
      this.pos.y = Math.max(0.6, this.pos.y - dt * 4);
      this.group.rotation.z += dt * 9;
    }

    // 浮遊ボビング
    const bobY = Math.sin(t * 3.1) * 0.14;
    this.group.position.set(
      this.pos.x + (this.shake > 0 ? Math.sin(t * 60) * this.shake * 0.25 : 0),
      this.pos.y + bobY,
      this.pos.z ?? 0
    );
    if (this.shake > 0) this.shake -= dt;

    if (!this.dead) {
      // バンク(傾き)
      this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, -this.vel.x * 0.045, dt * 8);
      this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, this.baseTilt + this.vel.y * 0.025, dt * 8);
    }

    // 丸影
    this.shadow.position.x = this.pos.x;
    this.shadow.position.z = 0;
    const shScale = Math.max(0.4, 1.35 - this.pos.y * 0.07);
    this.shadow.scale.setScalar(shScale);
    this.shadow.material.opacity = 0.3 * shScale;

    // プロペラ・羽ばたき・足
    this.model.blades.rotation.y += dt * 26;
    const flap = Math.sin(t * 10);
    this.model.wings[0].rotation.z = 0.25 + flap * 0.3;
    this.model.wings[1].rotation.z = -0.25 - flap * 0.3;
    this.model.feet[0].rotation.x = Math.PI / 2 - 0.35 + Math.sin(t * 6) * 0.15;
    this.model.feet[1].rotation.x = Math.PI / 2 - 0.35 + Math.sin(t * 6 + 1.5) * 0.15;

    // 無敵点滅
    if (this.invuln > 0) {
      this.invuln -= dt;
      this.group.visible = Math.floor(t * 14) % 2 === 0;
      if (this.invuln <= 0) this.group.visible = true;
    }

    // 表情タイマー
    if (this.exprTimer > 0) {
      this.exprTimer -= dt;
      if (this.exprTimer <= 0 && !this.dead) this.setExpression(this.baseExpression(), 0);
    } else if (!this.dead && this.expression !== this.baseExpression()) {
      this.setExpression(this.baseExpression(), 0);
    }
  }
}
