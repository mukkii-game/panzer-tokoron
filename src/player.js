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

// ===== トコろん3Dモデル(イラストのシルエットに寄せる) =====
export function buildTokoron() {
  const g = new THREE.Group();

  // --- オレンジの頭 ---
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.05, 28, 24), mat(C.body));
  head.scale.set(1.02, 1.0, 0.98);
  g.add(head);

  // --- クリーム顔面(前面を広く覆う) ---
  const facePatch = new THREE.Mesh(new THREE.SphereGeometry(1.0, 28, 24), mat(C.face));
  facePatch.position.set(0, -0.02, 0.28);
  facePatch.scale.set(1.0, 0.98, 0.85);
  g.add(facePatch);

  // --- 表情テクスチャ(目・頬・口のみ / 背景は透明) ---
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
  faceMesh.position.set(0, -0.08, 1.12);
  g.add(faceMesh);

  // ===== 飛行機帽子(黄色) =====
  const hat = new THREE.Group();
  hat.position.set(0, 0.72, -0.05);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52),
    mat(C.hat)
  );
  dome.scale.set(1.08, 0.85, 1.08);
  hat.add(dome);

  // 前ツバ(飛行機の鼻先)
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.85), mat(C.hat));
  nose.position.set(0, 0.08, 0.85);
  nose.rotation.x = 0.25;
  hat.add(nose);

  // 左右の大きな翼端(イラストの横に張り出したツバ)
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 0.65), mat(C.hat));
    wing.position.set(s * 1.15, 0.1, 0.35);
    wing.rotation.z = -s * 0.18;
    wing.rotation.y = s * 0.4;
    hat.add(wing);
    // 翼端の少し濃い部分
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.09, 0.42), mat(C.hatDark));
    tip.position.set(s * 1.75, 0.12, 0.15);
    tip.rotation.z = -s * 0.35;
    tip.rotation.y = s * 0.55;
    hat.add(tip);
  }

  // 尾翼
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.48, 0.5), mat(C.hatDark));
  tail.position.set(0, 0.45, -0.85);
  tail.rotation.x = -0.4;
  hat.add(tail);

  // プロペラ(緑・2枚羽=イラスト準拠)
  const propGroup = new THREE.Group();
  propGroup.position.set(0, 0.72, 0.05);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.28, 8), mat(C.hatDark));
  shaft.position.y = 0.1;
  propGroup.add(shaft);
  const blades = new THREE.Group();
  blades.position.y = 0.28;
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 6), mat(C.prop));
    b.scale.set(1.15, 0.07, 0.28);
    b.rotation.y = i * Math.PI / 2;
    blades.add(b);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat(C.hat));
  hub.position.y = 0.28;
  propGroup.add(hub);
  propGroup.add(blades);
  hat.add(propGroup);
  g.add(hat);

  // ===== 茶葉の襟 =====
  for (let i = -2; i <= 2; i++) {
    const a = i * 0.38;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), mat(C.leaf));
    leaf.scale.set(0.5, 1.2, 0.32);
    leaf.position.set(Math.sin(a) * 0.7, -0.88, Math.cos(a) * 0.7);
    leaf.rotation.z = -a * 0.7;
    leaf.rotation.x = 0.55;
    g.add(leaf);
  }

  // ===== 小さな胴体 =====
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.58, 16, 12), mat(C.body));
  body.scale.set(0.88, 1.05, 0.82);
  body.position.set(0, -1.18, -0.18);
  g.add(body);

  // ===== 鳥の翼(関節つき: 上腕+前腕+羽先) =====
  const wings = [];
  for (const s of [-1, 1]) {
    const root = new THREE.Group(); // 肩
    root.position.set(s * 0.55, -0.05, -0.35);

    const upper = new THREE.Group(); // 上腕
    root.add(upper);
    const upperMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat(C.wingBot));
    upperMesh.scale.set(1.2, 0.28, 0.48);
    upperMesh.position.set(s * 0.7, 0, 0);
    // 上面はオレンジ寄り
    const upperTop = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), mat(C.wingTop));
    upperTop.scale.set(0.85, 0.06, 0.4);
    upperTop.position.set(s * 0.7, 0.08, 0);
    upper.add(upperMesh, upperTop);

    const mid = new THREE.Group(); // 肘
    mid.position.set(s * 1.35, 0, -0.05);
    upper.add(mid);
    const midMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat(C.wingBot));
    midMesh.scale.set(0.75, 0.24, 0.4);
    midMesh.position.set(s * 0.5, 0, -0.08);
    mid.add(midMesh);

    const tip = new THREE.Group(); // 羽先
    tip.position.set(s * 0.95, 0, -0.15);
    mid.add(tip);
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), mat(C.wingBot));
      f.scale.set(0.9, 0.2, 0.28);
      f.position.set(s * (0.15 + i * 0.12), -0.02 * i, -0.2 - i * 0.18);
      f.rotation.y = -s * (0.15 + i * 0.2);
      tip.add(f);
    }

    g.add(root);
    wings.push({ root, upper, mid, tip, side: s });
  }

  // ===== 黄色い足(後ろへ流れる) =====
  const feet = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.32, -1.0, -0.35);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.55, 4, 10), mat(C.foot));
    thigh.rotation.x = Math.PI / 2 - 0.55;
    leg.add(thigh);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(C.footDark));
    foot.position.set(0, -0.3, -0.38);
    leg.add(foot);
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
    this.baseTilt = -0.22;
    this.group.rotation.x = this.baseTilt;
    this.group.rotation.y = 0.65;

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
      this.group.rotation.z += dt * 9;
    }

    if (game.state === 'clear') {
      this.group.rotation.y += dt * 4;
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
      this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, vy + 0.65, Math.min(1, dt * 5));
      this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, -this.vel.x * 0.045, dt * 8);
      this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, this.baseTilt + this.vel.y * 0.025, dt * 8);
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
      // 肩: 上下に振る
      w.root.rotation.z = THREE.MathUtils.lerp(w.root.rotation.z, s * (0.15 + flapAmt), Math.min(1, dt * 12));
      // 肘: 羽ばたきで折りたたむ
      const fold = this.wingMode === 'glide' ? 0.1 : 0.35 * Math.max(0, -Math.sin(this.wingPhase));
      w.mid.rotation.z = THREE.MathUtils.lerp(w.mid.rotation.z, s * fold, Math.min(1, dt * 10));
      // 羽先: 少し遅れて追従
      w.tip.rotation.z = THREE.MathUtils.lerp(w.tip.rotation.z, s * flapAmt * 0.4, Math.min(1, dt * 8));
      // 前後のねじり
      w.upper.rotation.y = THREE.MathUtils.lerp(w.upper.rotation.y, -s * 0.15 + s * flapAmt * 0.1, Math.min(1, dt * 6));
    }

    // プロペラ
    this.model.blades.rotation.y += dt * (12 + this.flapEnergy * 22);
    this.model.feet[0].rotation.x = Math.sin(t * 5) * 0.12;
    this.model.feet[1].rotation.x = Math.sin(t * 5 + 1.4) * 0.12;

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
