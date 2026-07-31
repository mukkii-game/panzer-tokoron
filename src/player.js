import * as THREE from 'three';

// トコろん配色(添付イラスト準拠)
const C = {
  body: 0xf6a01a, face: 0xfff6e8, hat: 0xffcc22, hatDark: 0xf0aa00,
  prop: 0x7cc142, wingTop: 0xf8a020, wingBot: 0xfff8ec,
  foot: 0xffcb2e, footDark: 0xf0b000, leaf: 0x6fb944, outline: 0x5a3818,
};

function mat(color) { return new THREE.MeshToonMaterial({ color }); }

// ===== 表情canvas =====
// 目・頬・口だけを透明背景に描く(顔ベースは3DのfacePatchに任せる)
export function drawFace(ctx, kind) {
  const S = 256;
  ctx.clearRect(0, 0, S, S);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const BROWN = '#4a2c12';

  const cheek = (a = 1) => {
    ctx.fillStyle = `rgba(255,160,185,${a})`;
    ctx.beginPath(); ctx.ellipse(48, 158, 32, 22, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(208, 158, 32, 22, 0, 0, 7); ctx.fill();
  };
  // イラスト準拠の大きめ黒丸目 + 白いハイライト
  const eye = (x, y, r = 22) => {
    ctx.fillStyle = BROWN;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.08, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x + r * 0.28, y - r * 0.32, r * 0.38, 0, 7); ctx.fill();
  };
  const stroke = (w = 8) => { ctx.strokeStyle = BROWN; ctx.lineWidth = w; ctx.stroke(); };

  // ω口 + ピンクの舌(イラストの特徴)
  const omega = (openTongue = true) => {
    ctx.beginPath();
    ctx.arc(112, 172, 18, 0.15 * Math.PI, 0.85 * Math.PI);
    stroke(8);
    ctx.beginPath();
    ctx.arc(144, 172, 18, 0.15 * Math.PI, 0.85 * Math.PI);
    stroke(8);
    if (openTongue) {
      ctx.fillStyle = '#f07090';
      ctx.beginPath();
      ctx.ellipse(128, 192, 15, 11, 0, 0, Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(128, 192, 15, 11, 0, 0, Math.PI);
      stroke(4);
    }
  };

  if (kind === 'normal') {
    eye(78, 108, 22);
    eye(178, 108, 22);
    cheek();
    omega(true);
  } else if (kind === 'joy') {
    // にっこり目
    ctx.beginPath(); ctx.arc(78, 114, 26, 1.15 * Math.PI, 1.85 * Math.PI); stroke(12);
    ctx.beginPath(); ctx.arc(178, 114, 26, 1.15 * Math.PI, 1.85 * Math.PI); stroke(12);
    cheek();
    ctx.fillStyle = '#8a3015';
    ctx.beginPath(); ctx.ellipse(128, 178, 34, 26, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#f47b92';
    ctx.beginPath(); ctx.ellipse(128, 194, 18, 11, 0, Math.PI, 0, true); ctx.fill();
  } else if (kind === 'angry') {
    ctx.beginPath(); ctx.moveTo(48, 82); ctx.lineTo(105, 100); stroke(11);
    ctx.beginPath(); ctx.moveTo(208, 82); ctx.lineTo(151, 100); stroke(11);
    eye(78, 116, 20); eye(178, 116, 20);
    cheek(0.85);
    ctx.fillStyle = '#8a3015';
    ctx.beginPath(); ctx.ellipse(128, 178, 22, 16, 0, 0, Math.PI); ctx.fill();
  } else if (kind === 'panic') {
    for (const [x, d] of [[78, 1], [178, -1]]) {
      ctx.beginPath();
      ctx.moveTo(x - 22 * d, 92); ctx.lineTo(x + 14 * d, 110); ctx.lineTo(x - 22 * d, 128);
      stroke(11);
    }
    cheek();
    ctx.beginPath(); ctx.moveTo(92, 178);
    for (let i = 1; i <= 5; i++) ctx.lineTo(92 + i * 14, 178 + (i % 2 ? 12 : 0));
    stroke(8);
    ctx.fillStyle = '#6ec6f5';
    ctx.beginPath(); ctx.ellipse(222, 88, 12, 17, -0.4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(34, 92, 10, 14, 0.4, 0, 7); ctx.fill();
  } else if (kind === 'pinch') {
    for (const x of [78, 178]) {
      ctx.fillStyle = BROWN;
      ctx.beginPath(); ctx.ellipse(x, 108, 22, 26, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x + 7, 98, 8, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(160,220,255,.95)';
      ctx.beginPath(); ctx.ellipse(x - 5, 124, 13, 9, 0, 0, Math.PI); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x, 148, 10, 13, 0, 0, 7); ctx.fill();
    }
    cheek();
    ctx.beginPath(); ctx.arc(128, 188, 14, 1.15 * Math.PI, 1.85 * Math.PI); stroke(9);
  } else if (kind === 'dizzy') {
    for (const x of [78, 178]) {
      ctx.beginPath();
      for (let a = 0; a < 4.2 * Math.PI; a += 0.2) {
        const r = 4 + a * 1.9, px = x + Math.cos(a) * r, py = 110 + Math.sin(a) * r;
        a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      stroke(7);
    }
    cheek(0.7);
    ctx.fillStyle = '#8a3015';
    ctx.beginPath(); ctx.ellipse(128, 180, 18, 14, 0, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// ===== トコろん3Dモデル(まんまる体・短くかわいい手足) =====
export function buildTokoron() {
  const g = new THREE.Group();

  // --- まんまるオレンジ本体(頭=ほぼ全身) ---
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.15, 28, 24), mat(C.body));
  head.scale.set(1.05, 1.02, 1.0);
  g.add(head);

  // --- クリーム顔面 ---
  const facePatch = new THREE.Mesh(new THREE.SphereGeometry(1.08, 28, 24), mat(C.face));
  facePatch.position.set(0, -0.02, 0.32);
  facePatch.scale.set(1.0, 0.98, 0.82);
  g.add(facePatch);

  // --- 表情テクスチャ(目・頬・口のみ) ---
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const fctx = cv.getContext('2d');
  drawFace(fctx, 'normal');
  const faceTex = new THREE.CanvasTexture(cv);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = 4;
  const faceMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 32),
    new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false })
  );
  faceMesh.position.set(0, -0.06, 1.18);
  g.add(faceMesh);

  // ===== 飛行機帽子(黄色・コンパクト) =====
  const hat = new THREE.Group();
  hat.position.set(0, 0.62, -0.02);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52),
    mat(C.hat)
  );
  dome.scale.set(1.05, 0.78, 1.05);
  hat.add(dome);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.7), mat(C.hat));
  nose.position.set(0, 0.06, 0.78);
  nose.rotation.x = 0.22;
  hat.add(nose);

  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.48), mat(C.hat));
    wing.position.set(s * 1.0, 0.08, 0.3);
    wing.rotation.z = -s * 0.2;
    wing.rotation.y = s * 0.35;
    hat.add(wing);
  }

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 0.4), mat(C.hatDark));
  tail.position.set(0, 0.38, -0.78);
  tail.rotation.x = -0.35;
  hat.add(tail);

  const propGroup = new THREE.Group();
  propGroup.position.set(0, 0.62, 0.02);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.22, 8), mat(C.hatDark));
  shaft.position.y = 0.08;
  propGroup.add(shaft);
  const blades = new THREE.Group();
  blades.position.y = 0.22;
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 6), mat(C.prop));
    b.scale.set(1.0, 0.06, 0.22);
    b.rotation.y = i * Math.PI / 2;
    blades.add(b);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mat(C.hat));
  hub.position.y = 0.22;
  propGroup.add(hub);
  propGroup.add(blades);
  hat.add(propGroup);
  g.add(hat);

  // ===== 茶葉の襟(短め) =====
  for (let i = -2; i <= 2; i++) {
    const a = i * 0.4;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat(C.leaf));
    leaf.scale.set(0.45, 1.0, 0.28);
    leaf.position.set(Math.sin(a) * 0.72, -0.95, Math.cos(a) * 0.68);
    leaf.rotation.z = -a * 0.65;
    leaf.rotation.x = 0.5;
    g.add(leaf);
  }

  // ===== 短くかわいいパドル翼(イラスト準拠) =====
  const wings = [];
  for (const s of [-1, 1]) {
    const root = new THREE.Group();
    root.position.set(s * 0.85, 0.05, -0.15);

    // ダミー構造(アニメ互換: upper/mid/tip)
    const upper = new THREE.Group();
    root.add(upper);
    const paddle = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat(C.wingBot));
    paddle.scale.set(0.85, 0.12, 0.38); // 短くふっくら
    paddle.position.set(s * 0.55, 0, 0);
    const paddleTop = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), mat(C.wingTop));
    paddleTop.scale.set(0.75, 0.05, 0.32);
    paddleTop.position.set(s * 0.55, 0.07, 0);
    upper.add(paddle, paddleTop);

    const mid = new THREE.Group();
    mid.position.set(s * 0.95, 0, 0);
    upper.add(mid);
    const tip = new THREE.Group();
    tip.position.set(0, 0, 0);
    mid.add(tip);
    // 小さな羽先だけ
    const tipMesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), mat(C.wingBot));
    tipMesh.scale.set(0.7, 0.12, 0.35);
    tipMesh.position.set(s * 0.2, 0, -0.05);
    tip.add(tipMesh);

    g.add(root);
    wings.push({ root, upper, mid, tip, side: s });
  }

  // ===== 短いつまみ足(イラストの黄色いスタブ) =====
  const feet = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.28, -0.95, -0.55);
    const stub = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), mat(C.foot));
    stub.scale.set(0.85, 0.7, 1.15);
    leg.add(stub);
    g.add(leg);
    feet.push(leg);
  }

  return { group: g, faceTex, fctx, blades, wings, feet, hat };
}

export class Player {
  constructor(game) {
    const m = buildTokoron();
    this.model = m;
    this.group = m.group;
    this.group.scale.setScalar(1.2);
    this.lx = 0;
    this.pos = new THREE.Vector3(0, 4.5, 0);
    this.vel = new THREE.Vector2(0, 0);
    this.hp = 5; this.maxHp = 5;
    this.invuln = 0;
    this.radius = 0.9;
    this.expression = 'normal';
    this.exprTimer = 0;
    this.shake = 0;
    this.dead = false;

    // 鳥の羽ばたきステートマシン: flap / glide / takeoff
    this.wingMode = 'glide';
    this.flapEnergy = 0;
    this.glideTimer = 1.5 + Math.random();
    this.prevMoveMag = 0;
    this.wingPhase = 0;

    game.scene.add(this.group);
    this.group.position.copy(this.pos);
    // 飛行機姿勢: 頭=地面スクロール方向(ローカル+Z=顔)、足=下(+Y)
    this._fwd = new THREE.Vector3(0, 0, 1); // 初期は +Z = 手前(顔がこちら)
    this._up = new THREE.Vector3(0, 1, 0);
    this._right = new THREE.Vector3(1, 0, 0);
    this._m = new THREE.Matrix4();
    this.bank = 0;
    this.pitch = 0;
    // タイトル直後から顔が見えるよう初期姿勢を確定
    this._m.makeBasis(this._right, this._up, this._fwd);
    this.group.quaternion.setFromRotationMatrix(this._m);

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 20),
      new THREE.MeshBasicMaterial({ color: 0x1a3a50, transparent: true, opacity: 0.28 })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = -0.44;
    game.scene.add(this.shadow);
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
    this.wingMode = 'flap';
    this.flapEnergy = 1;
    if (this.hp <= 0) { this.dead = true; game.gameOver(); }
  }

  update(dt, game) {
    const t = game.time;
    const vy = game.viewYaw;

    if (!this.dead) {
      const mv = game.input.getMove();
      const mag = Math.hypot(mv.x, mv.y);

      // 移動開始で離陸羽ばたき
      if (mag > 0.4 && this.prevMoveMag < 0.12) {
        this.wingMode = 'takeoff';
        this.flapEnergy = 1;
      }
      // 急上昇でも羽ばたく
      if (mv.y > 0.55) {
        this.wingMode = 'flap';
        this.flapEnergy = Math.max(this.flapEnergy, 0.7);
      }
      this.prevMoveMag = mag;

      const sp = 14;
      this.vel.x += (mv.x * sp - this.vel.x) * Math.min(1, dt * 10);
      this.vel.y += (mv.y * sp - this.vel.y) * Math.min(1, dt * 10);
      this.lx = THREE.MathUtils.clamp(this.lx + this.vel.x * dt, -9.5, 9.5);
      // 地上すれすれ(影のすぐ上)まで降りられる
      this.pos.y = THREE.MathUtils.clamp(this.pos.y + this.vel.y * dt, 0.12, 9.5);
    } else {
      this.pos.y = Math.max(0.3, this.pos.y - dt * 4);
      this.group.rotateZ(dt * 9); // きりもみ
    }

    if (game.state === 'clear') {
      this.group.rotateY(dt * 4);
      this.pos.y = Math.min(7, this.pos.y + dt * 0.8);
      this.wingMode = 'flap';
      this.flapEnergy = 1;
    }

    this.pos.x = this.lx * Math.cos(vy);
    this.pos.z = -this.lx * Math.sin(vy);

    const bobY = Math.sin(t * 3.1) * 0.14;
    this.group.position.set(
      this.pos.x + (this.shake > 0 ? Math.sin(t * 60) * this.shake * 0.25 : 0),
      this.pos.y + bobY,
      this.pos.z
    );
    if (this.shake > 0) this.shake -= dt;

    if (!this.dead && game.state !== 'clear') {
      // ===== 体の向き = 地面が進む方向(スクロール) =====
      // カメラやカーソルには向けない。頭(+Z顔)＝scrollDir、足＝下。
      // 初期scrollDir=+Z(画面手前)なので最初から顔がこちらを向く。
      // 進行方向が変わると地面・カメラも同じヨーで回り、顔側から見続ける。
      const S = game.scrollDir(); // 地面の進行方向
      this._fwd.set(S.x, 0, S.z).normalize();
      this._up.set(0, 1, 0);
      this._right.crossVectors(this._up, this._fwd).normalize();
      this._up.crossVectors(this._fwd, this._right).normalize();

      // バンク/ピッチは進行軸まわりのみ(飛行機の傾き)
      const wantBank = THREE.MathUtils.clamp(-this.vel.x * 0.055, -0.55, 0.55);
      const wantPitch = THREE.MathUtils.clamp(-this.vel.y * 0.035, -0.35, 0.35);
      this.bank += (wantBank - this.bank) * Math.min(1, dt * 6);
      this.pitch += (wantPitch - this.pitch) * Math.min(1, dt * 6);

      this._up.applyAxisAngle(this._fwd, this.bank);
      this._right.applyAxisAngle(this._fwd, this.bank);
      this._fwd.applyAxisAngle(this._right, this.pitch);
      this._up.applyAxisAngle(this._right, this.pitch);
      this._fwd.normalize(); this._up.normalize();
      this._right.crossVectors(this._up, this._fwd).normalize();

      // ローカル +X=right, +Y=up, +Z=顔＝地面進行方向
      this._m.makeBasis(this._right, this._up, this._fwd);
      this.group.quaternion.setFromRotationMatrix(this._m);
    }

    this.shadow.position.x = this.pos.x;
    this.shadow.position.z = this.pos.z;
    const shScale = Math.max(0.45, 1.5 - this.pos.y * 0.09);
    this.shadow.scale.setScalar(shScale);
    this.shadow.material.opacity = 0.35 * shScale;

    // ===== 鳥らしい翼アニメ =====
    this.glideTimer -= dt;
    if (this.glideTimer <= 0 && this.wingMode === 'glide') {
      this.wingMode = 'flap';
      this.flapEnergy = 0.85 + Math.random() * 0.15;
      this.glideTimer = 2.0 + Math.random() * 3.0;
    }
    if (this.flapEnergy > 0) {
      this.flapEnergy = Math.max(0, this.flapEnergy - dt * (this.wingMode === 'takeoff' ? 1.4 : 0.9));
      if (this.flapEnergy <= 0) this.wingMode = 'glide';
    }

    const flapSpeed = this.wingMode === 'takeoff' ? 16 : this.wingMode === 'flap' ? 12 : 1.8;
    this.wingPhase += dt * flapSpeed;
    const flapAmt = this.wingMode === 'glide'
      ? Math.sin(this.wingPhase) * 0.08   // グライド微揺れ
      : Math.sin(this.wingPhase) * (0.35 + 0.4 * this.flapEnergy);

    for (const w of this.model.wings) {
      const s = w.side;
      // 短いパドル翼: 上下に小さく羽ばたく
      w.root.rotation.z = THREE.MathUtils.lerp(w.root.rotation.z, s * (0.08 + flapAmt * 0.7), Math.min(1, dt * 12));
      w.mid.rotation.z = 0;
      w.tip.rotation.z = 0;
      w.upper.rotation.y = THREE.MathUtils.lerp(w.upper.rotation.y, -s * 0.05, Math.min(1, dt * 6));
    }

    // プロペラ
    this.model.blades.rotation.y += dt * (12 + this.flapEnergy * 22);
    // 短い足はちょっと揺れるだけ
    this.model.feet[0].rotation.x = Math.sin(t * 4) * 0.08;
    this.model.feet[1].rotation.x = Math.sin(t * 4 + 1.4) * 0.08;

    if (this.invuln > 0) {
      this.invuln -= dt;
      this.group.visible = Math.floor(t * 14) % 2 === 0;
      if (this.invuln <= 0) this.group.visible = true;
    }

    if (this.exprTimer > 0) {
      this.exprTimer -= dt;
      if (this.exprTimer <= 0 && !this.dead) this.setExpression(this.baseExpression(), 0);
    } else if (!this.dead && this.expression !== this.baseExpression()) {
      this.setExpression(this.baseExpression(), 0);
    }
  }
}
