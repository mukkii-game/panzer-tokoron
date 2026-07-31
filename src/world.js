import * as THREE from 'three';
import { Dango, Shoyu, TeaDrone, Biplane, Negi, Boss, Udon, SanwariGirl, disposeObject, spawnDangoPack, spawnBiplaneWingmen } from './enemies.js';

const mat = c => new THREE.MeshToonMaterial({ color: c });
const SCROLL = 28; // ペース 1.5倍スロー(旧42)

// ===== 地面テクスチャ(明るめに描いて material.color で色調変化) =====
function makeGroundTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const c = cv.getContext('2d');
  c.fillStyle = '#cfd8c2'; c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    const g = 175 + Math.random() * 60;
    c.fillStyle = `rgb(${g},${g + 10},${g - 15})`;
    c.fillRect(Math.random() * 512, Math.random() * 512, 20 + Math.random() * 70, 20 + Math.random() * 70);
  }
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 7;
  for (let i = 0; i < 5; i++) { // 道路
    c.beginPath(); c.moveTo(Math.random() * 512, 0); c.lineTo(Math.random() * 512, 512); c.stroke();
    c.beginPath(); c.moveTo(0, Math.random() * 512); c.lineTo(512, Math.random() * 512); c.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ===== 風景オブジェクト =====
function makeShop() {
  const g = new THREE.Group();
  const hues = [0xff9d9d, 0xffd28a, 0x9dd6ff, 0xb5f09a, 0xffb5e2, 0xfff29a];
  const w = 3 + Math.random() * 3, h = 3 + Math.random() * 4, d = 3 + Math.random() * 2;
  const bldg = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0xf0ead8));
  bldg.position.y = h / 2;
  g.add(bldg);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, 0.35, d * 0.55), mat(hues[(Math.random() * hues.length) | 0]));
  awning.position.set(0, h * 0.62, d * 0.4);
  awning.rotation.x = 0.25;
  g.add(awning);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.9, 0.2), mat(hues[(Math.random() * hues.length) | 0]));
  sign.position.set(0, h + 0.5, 0);
  g.add(sign);
  return g;
}
function makeTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.6, 8), mat(0x8a5a30));
  trunk.position.y = 0.8; g.add(trunk);
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(1.4 + Math.random(), 10, 8), mat(Math.random() < 0.5 ? 0x4e9c3c : 0x63b04a));
  leaf.position.y = 2.4; leaf.scale.y = 1.15;
  g.add(leaf);
  return g;
}
function makePlaneStatue() { // 航空公園の記念機
  const g = new THREE.Group();
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 3, 8), mat(0xb8b8b8));
  ped.position.y = 1.5; g.add(ped);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 3.4, 4, 10), mat(0xd8dde2));
  body.rotation.z = Math.PI / 2; body.position.y = 3.6;
  g.add(body);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.15, 5.5), mat(0xc8cdd4));
  wing.position.y = 3.6; g.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.3, 1.2), mat(0xc8cdd4));
  tail.position.set(-2.1, 4.1, 0); g.add(tail);
  return g;
}
function makeWaterTower() { // 給水塔
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5, 6), mat(0x9aa4ac));
    leg.position.set(s * 0.8, 2.5, 0); g.add(leg);
    const leg2 = leg.clone(); leg2.position.z = s * 0.8; leg2.position.x = 0; g.add(leg2);
  }
  const tank = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 10), mat(0xcfe3ef));
  tank.position.y = 6; g.add(tank);
  return g;
}
function makeAntenna() {
  const g = new THREE.Group();
  const h = 6 + Math.random() * 7;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.22, h, 6), mat(0xc23b3b));
  pole.position.y = h / 2; g.add(pole);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), mat(0xffffff));
  top.position.y = h; g.add(top);
  for (let i = 1; i <= 2; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6 / i, 0.08, 0.08), mat(0xd8d8d8));
    bar.position.y = h - i * 1.2;
    g.add(bar);
  }
  return g;
}
function makeRadome() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 1.2, 12), mat(0xbfc7ba));
  base.position.y = 0.6; g.add(base);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.7, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf4f6f0));
  dome.position.y = 1.2; g.add(dome);
  return g;
}
function makeCloud() {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(1.2 + Math.random() * 1.6, 10, 8), m);
    s.position.set(i * 1.6 - 2.4 + Math.random(), (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 1.5);
    s.scale.y = 0.55;
    g.add(s);
  }
  return g;
}

// フェーズ定義: 地面の色調 / 風景 / 出現間隔
const PHASES = {
  sky:  { tint: 0xa8c8e8, scenery: null, interval: 99 },
  street: { tint: 0xd8c8a8, scenery: () => makeShop(), interval: 0.5 },
  park: { tint: 0x9ed489, scenery: () => (Math.random() < 0.08 ? makePlaneStatue() : Math.random() < 0.06 ? makeWaterTower() : makeTree()), interval: 0.4 },
  base: { tint: 0xc8c4a0, scenery: () => (Math.random() < 0.25 ? makeRadome() : makeAntenna()), interval: 0.7 },
};

export class World {
  constructor(game) {
    this.game = game;
    const { scene } = game;

    scene.background = new THREE.Color(0x7ed0f0);
    scene.fog = new THREE.Fog(0x9adcf5, 55, 150);
    scene.add(new THREE.HemisphereLight(0xcfefff, 0x8a7a55, 1.15));
    const sun = new THREE.DirectionalLight(0xfff4d8, 1.6);
    sun.position.set(12, 30, 18);
    scene.add(sun);

    this.groundTex = makeGroundTexture();
    this.groundMat = new THREE.MeshBasicMaterial({ map: this.groundTex, color: 0xa8c8e8 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    scene.add(ground);

    this.tintFrom = new THREE.Color(0xa8c8e8);
    this.tintTo = new THREE.Color(0xa8c8e8);
    this.tintT = 1;

    this.clouds = [];
    for (let i = 0; i < 14; i++) {
      const c = makeCloud();
      c.position.set((Math.random() - 0.5) * 70, 7 + Math.random() * 16, -140 + Math.random() * 145);
      scene.add(c);
      this.clouds.push(c);
    }

    this.scenery = [];
    this.phase = PHASES.sky;
    this.spawnTimer = 0;
    this.time = 0;
    this.eventIdx = 0;
    this.events = this.buildTimeline();
    this.bossStarted = false;
  }

  setPhase(name) {
    this.phase = PHASES[name];
    this.tintFrom.copy(this.groundMat.color);
    this.tintTo.setHex(this.phase.tint);
    this.tintT = 0;
  }

  buildTimeline() {
    const g = this.game;
    const ev = [];
    const at = (t, fn) => ev.push({ t, fn });
    const msg = (t, text) => at(t, () => { g.ui.showStageMsg(text); g.audio.msg(); });
    const dir = (t, theta) => at(t, () => g.setWaveDir(theta));
    const L = Math.PI / 2, R = -Math.PI / 2, B = 0, FRONT = Math.PI;
    // 序盤〜中盤: 1種類ゾーン。方向転換のたびに別種。
    // 転換は出現より遅らせ(~4割)、間隔も広め。中盤以降はミックス大乱戦。

    // ========== AREA1: 単種ゾーン ==========
    msg(0.3, 'AREA 1 ─ 所沢上空');
    // 団子だけ
    at(1.0, () => spawnDangoPack(g, 'swarm'));
    at(3.5, () => spawnDangoPack(g, 'swarm'));
    // 転換→狭山茶だけ
    dir(5.5, L);
    at(7.2, () => {
      for (const [x, y] of [[-8, 6], [8, 4], [-4, 7], [4, 3], [0, 5], [-6, 5], [6, 6]]) {
        new TeaDrone(g, x, y);
      }
    });
    // 転換→団子(端から)
    dir(11.0, R);
    at(12.8, () => spawnDangoPack(g, 'edge'));
    // 転換→団子(往復)
    dir(16.5, B);
    at(18.2, () => spawnDangoPack(g, 'outback'));
    // 転換→狭山茶だけ
    dir(22.0, FRONT);
    at(23.8, () => {
      for (const [x, y] of [[7, 7], [-7, 3], [0, 5], [4, 6], [-4, 4], [2, 8]]) {
        new TeaDrone(g, x, y);
      }
    });
    dir(27.5, B);

    // ========== AREA2: 単種ゾーン(商店街の名物を順に) ==========
    at(29.0, () => this.setPhase('street'));
    msg(29.3, 'AREA 2 ─ プロペ通り商店街');
    // 醤油だけ
    at(30.5, () => {
      new Shoyu(g, -7, 5); new Shoyu(g, -3, 6); new Shoyu(g, 1, 4);
      new Shoyu(g, 5, 7); new Shoyu(g, 8, 5); new Shoyu(g, 0, 8);
    });
    // 転換→うどんだけ
    dir(35.0, L);
    at(36.8, () => {
      new Udon(g, -6, 5); new Udon(g, -2, 4); new Udon(g, 2, 6);
      new Udon(g, 6, 5); new Udon(g, 0, 7); new Udon(g, -4, 6); new Udon(g, 4, 3);
    });
    // 転換→ねぎだけ
    dir(41.5, R);
    at(43.2, () => {
      for (const [x, z] of [[-8, -28], [-4, -32], [0, -26], [4, -35], [8, -30], [-6, -40], [6, -38], [2, -25]]) {
        new Negi(g, x, z);
      }
    });
    // 転換→三割うまいだけ(導入)
    dir(48.0, L);
    at(49.8, () => {
      new SanwariGirl(g, -6, 5); new SanwariGirl(g, -2, 6); new SanwariGirl(g, 2, 4);
      new SanwariGirl(g, 6, 5); new SanwariGirl(g, 0, 7);
    });
    // 転換→団子だけ
    dir(54.5, B);
    at(56.2, () => spawnDangoPack(g, 'swarm'));
    at(58.0, () => spawnDangoPack(g, 'edge'));

    // ========== AREA3: 航空発祥・大型複葉機並走 ==========
    at(60.5, () => this.setPhase('park'));
    msg(60.8, 'AREA 3 ─ 航空記念公園');
    msg(61.5, '会式一号風 複葉機編隊！！');
    // 近くで並走する大型複葉機を複数
    at(62.0, () => spawnBiplaneWingmen(g, 5));
    dir(66.0, L);
    at(67.0, () => spawnBiplaneWingmen(g, 4));
    at(67.5, () => {
      new TeaDrone(g, -7, 5); new TeaDrone(g, 7, 4);
      new SanwariGirl(g, -4, 5); new SanwariGirl(g, 0, 6); new SanwariGirl(g, 4, 4);
    });
    dir(72.0, R);
    at(73.0, () => spawnBiplaneWingmen(g, 6));
    at(73.5, () => {
      new Udon(g, -5, 5); new Udon(g, 5, 6);
      new SanwariGirl(g, -2, 6); new SanwariGirl(g, 3, 4); new SanwariGirl(g, 5, 6);
    });
    dir(78.0, FRONT);
    at(79.0, () => {
      spawnBiplaneWingmen(g, 4);
      spawnDangoPack(g, 'swarm');
      new SanwariGirl(g, -4, 5); new SanwariGirl(g, 0, 6); new SanwariGirl(g, 4, 4);
      new Negi(g, 0, -30); new Negi(g, -5, -28);
    });
    dir(84.0, B);
    at(85.0, () => spawnBiplaneWingmen(g, 5));
    at(85.5, () => {
      new TeaDrone(g, 0, 8); new TeaDrone(g, -5, 4); new TeaDrone(g, 5, 5);
      new Negi(g, 0, -30); new Negi(g, -6, -25); new Negi(g, 6, -25);
      new SanwariGirl(g, -3, 5); new SanwariGirl(g, 3, 5); new SanwariGirl(g, 0, 7);
    });

    // ========== AREA4: 大乱戦ミックス ==========
    at(88.0, () => this.setPhase('base'));
    msg(88.3, 'AREA 4 ─ 米軍通信基地');
    at(89.5, () => {
      new Shoyu(g, -7, 6); new Shoyu(g, 7, 6); new Shoyu(g, 0, 4);
      new Udon(g, -4, 5); new Udon(g, 4, 5); new Negi(g, 0, -30); new Negi(g, -5, -28);
      new SanwariGirl(g, -4, 5); new SanwariGirl(g, 4, 6); new SanwariGirl(g, 0, 7);
      new SanwariGirl(g, -7, 4); new SanwariGirl(g, 7, 5); new SanwariGirl(g, 2, 3);
    });
    dir(94.0, L);
    at(95.5, () => {
      spawnBiplaneWingmen(g, 5);
      new TeaDrone(g, -6, 7); new TeaDrone(g, 6, 3); new TeaDrone(g, 0, 5);
      spawnDangoPack(g, 'edge');
      new SanwariGirl(g, 0, 5); new SanwariGirl(g, -5, 6); new SanwariGirl(g, 5, 4);
      new SanwariGirl(g, -2, 7); new SanwariGirl(g, 3, 3); new SanwariGirl(g, -8, 5);
      new SanwariGirl(g, 8, 6); new Udon(g, -3, 4); new Udon(g, 3, 6);
    });
    dir(101.0, FRONT);
    at(102.5, () => {
      spawnDangoPack(g, 'swarm'); spawnDangoPack(g, 'outback');
      new SanwariGirl(g, -6, 5); new SanwariGirl(g, -2, 4); new SanwariGirl(g, 2, 6);
      new SanwariGirl(g, 6, 5); new SanwariGirl(g, 0, 7); new SanwariGirl(g, -4, 3);
      new SanwariGirl(g, 4, 8); new Negi(g, -4, -28); new Negi(g, 4, -32);
    });
    dir(108.0, R);
    at(109.5, () => {
      new Negi(g, -7, -25); new Negi(g, 7, -25); new Negi(g, 0, -35); new Negi(g, -3, -30); new Negi(g, 3, -30);
      spawnBiplaneWingmen(g, 4);
      new Shoyu(g, -5, 5); new Shoyu(g, 5, 6);
      new SanwariGirl(g, -4, 6); new SanwariGirl(g, 0, 5); new SanwariGirl(g, 4, 4);
      new SanwariGirl(g, -7, 5); new SanwariGirl(g, 7, 4); new SanwariGirl(g, 2, 7);
    });
    dir(115.0, B);
    at(116.5, () => {
      new Shoyu(g, -6, 4); new Shoyu(g, 6, 7); new Shoyu(g, 0, 6);
      new TeaDrone(g, 0, 6); new TeaDrone(g, -8, 4); new TeaDrone(g, 8, 5);
      spawnDangoPack(g, 'swarm');
      new Udon(g, -5, 6); new Udon(g, 5, 4); new Udon(g, 0, 5);
      new SanwariGirl(g, 4, 5); new SanwariGirl(g, -3, 5); new SanwariGirl(g, 0, 6);
      new SanwariGirl(g, -7, 4); new SanwariGirl(g, 7, 6); new SanwariGirl(g, 2, 3);
      new SanwariGirl(g, -5, 7); new SanwariGirl(g, 5, 3); new SanwariGirl(g, -1, 4);
    });

    // --- ボス ---
    dir(120.0, B);
    msg(121.5, '？？？ 「よくぞここまで来たな…」');
    at(124.0, () => this.startBoss());
    return ev;
  }

  startBoss() {
    const g = this.game;
    this.bossStarted = true;
    g.ui.showStageMsg('BOSS ─ ヤキダンゴドラゴン !!', 2200);
    g.audio.msg();
    g.audio.startBGM('boss');
    g.boss = new Boss(g);
    g.ui.showBoss(true);
  }

  update(dt) {
    const g = this.game;
    this.time += dt;

    // タイムラインイベント発火
    while (this.eventIdx < this.events.length && this.events[this.eventIdx].t <= this.time) {
      this.events[this.eventIdx].fn();
      this.eventIdx++;
    }

    // 地面スクロール = viewYaw の進行方向(カメラ方位ではなくレール方向)
    const F = g.scrollDir();
    const R = g.frameR(g.viewYaw);
    // PlaneGeometry: u→X, v→-Z なので進行 F に合わせて UV を流す
    this.groundTex.offset.x -= F.x * (SCROLL / 66) * dt;
    this.groundTex.offset.y -= F.z * (SCROLL / 66) * dt;
    if (this.tintT < 1) {
      this.tintT = Math.min(1, this.tintT + dt * 0.4);
      this.groundMat.color.lerpColors(this.tintFrom, this.tintTo, this.tintT);
    }

    // 雲(奥→手前へ F 方向)
    for (const c of this.clouds) {
      c.position.x += F.x * SCROLL * 0.55 * dt;
      c.position.z += F.z * SCROLL * 0.55 * dt;
      const depth = c.position.x * F.x + c.position.z * F.z;
      if (depth > 6) {
        const lat = (Math.random() - 0.5) * 70;
        const far = -140;
        c.position.x = F.x * far + R.x * lat;
        c.position.z = F.z * far + R.z * lat;
        c.position.y = 7 + Math.random() * 16;
      }
    }

    // 風景スポーン(奥の -F 側から)
    if (this.phase.scenery) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.phase.interval * (0.7 + Math.random() * 0.6);
        const obj = this.phase.scenery();
        const side = Math.random() < 0.5 ? -1 : 1;
        const lat = side * (13 + Math.random() * 14);
        const far = -130;
        obj.position.set(F.x * far + R.x * lat, -0.5, F.z * far + R.z * lat);
        obj.rotation.y = Math.random() * Math.PI * 2;
        g.scene.add(obj);
        this.scenery.push(obj);
      }
    }
    for (let i = this.scenery.length - 1; i >= 0; i--) {
      const o = this.scenery[i];
      o.position.x += F.x * SCROLL * dt;
      o.position.z += F.z * SCROLL * dt;
      const depth = o.position.x * F.x + o.position.z * F.z;
      if (depth > 35) { g.scene.remove(o); disposeObject(o); this.scenery.splice(i, 1); }
    }
  }
}
