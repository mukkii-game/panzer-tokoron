// BGM: 爽快シューティング風チップチューン合成
// SFX: Kenney CC0 (assets/sfx/) + 合成フォールバック
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.bgmTimer = null;
    this.mode = null;
    this.buffers = {};
    this._loading = null;
    this._shotI = 0;
    this._boomI = 0;
  }

  ensure() {
    if (this.ctx) { this.ctx.resume(); this._preload(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { this.ctx = null; return; }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master.connect(comp); comp.connect(this.ctx.destination);
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.38;
    this.bgmGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.85;
    this.sfxGain.connect(this.master);
    this._preload();
  }

  _preload() {
    if (this._loading || Object.keys(this.buffers).length) return this._loading;
    const files = {
      shoot0: 'laserSmall_000.ogg', shoot1: 'laserSmall_001.ogg', shoot2: 'laserSmall_002.ogg',
      shoot3: 'laser1.ogg', shoot4: 'laser2.ogg',
      boom0: 'explosionCrunch_000.ogg', boom1: 'explosionCrunch_001.ogg',
      boom2: 'explosionCrunch_002.ogg', boom3: 'explosionCrunch_003.ogg',
      bigBoom: 'lowFrequency_explosion_000.ogg',
      hit: 'impactMetal_002.ogg',
      homing: 'thrusterFire_000.ogg',
      lock: 'laserRetro_000.ogg',
    };
    this._loading = Promise.all(Object.entries(files).map(async ([key, file]) => {
      try {
        const res = await fetch(`./assets/sfx/${file}`);
        if (!res.ok) return;
        const arr = await res.arrayBuffer();
        this.buffers[key] = await this.ctx.decodeAudioData(arr.slice(0));
      } catch { /* フォールバック合成 */ }
    }));
    return this._loading;
  }

  _playBuf(name, vol = 1, rate = 1, dest = null) {
    const buf = this.buffers[name];
    if (!buf || !this.ctx) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g); g.connect(dest || this.sfxGain);
    src.start();
    return true;
  }

  _osc(type, freq, t0, dur, vol = 0.2, dest = null, slideTo = null) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(dest || this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  _noise(t0, dur, vol = 0.2, freq = 2000, type = 'highpass') {
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  }

  // ===== SFX (Kenney優先) =====
  shoot() {
    if (!this.ctx) return;
    const keys = ['shoot0', 'shoot1', 'shoot2', 'shoot3', 'shoot4'];
    const k = keys[this._shotI++ % keys.length];
    if (this._playBuf(k, 0.45, 0.95 + Math.random() * 0.15)) return;
    const t = this.ctx.currentTime;
    this._osc('square', 1200, t, 0.07, 0.08, this.sfxGain, 280);
    this._osc('sawtooth', 900, t, 0.05, 0.05, this.sfxGain, 200);
  }

  lock(n) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const step = Math.max(1, n | 0);
    // 硬い「カカカッ」— 短いクリック + 金属/木を叩いた感
    // 1) 超短いノイズの打撃音
    this._noise(t, 0.022, 0.26, 4200, 'highpass');
    // 2) 硬い矩形のカチッ(ロック数で少し高く)
    const f0 = 880 + step * 95;
    this._osc('square', f0, t, 0.028, 0.16, this.sfxGain, f0 * 0.45);
    // 3) 短い高音ピンでキレを出す
    this._osc('triangle', 2400 + step * 160, t, 0.032, 0.09, this.sfxGain, 700);
    // 4) メタル衝撃サンプルがあれば一瞬だけ重ねる
    const buf = this.buffers.hit;
    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = 1.55 + step * 0.06;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
      src.connect(g);
      g.connect(this.sfxGain);
      src.start(t);
      try { src.stop(t + 0.06); } catch { /* ignore */ }
    }
  }

  homing() {
    if (!this.ctx) return;
    if (this._playBuf('homing', 0.5, 1.15)) {
      this._playBuf('shoot4', 0.25, 0.7);
      return;
    }
    const t = this.ctx.currentTime;
    this._noise(t, 0.3, 0.18, 900, 'bandpass');
    this._osc('sawtooth', 280, t, 0.35, 0.12, this.sfxGain, 1400);
  }

  boom() {
    if (!this.ctx) return;
    const keys = ['boom0', 'boom1', 'boom2', 'boom3'];
    const k = keys[this._boomI++ % keys.length];
    if (this._playBuf(k, 0.7, 0.9 + Math.random() * 0.2)) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.35, 0.35, 600, 'lowpass');
    this._osc('sine', 140, t, 0.35, 0.35, this.sfxGain, 35);
  }

  bigBoom() {
    if (!this.ctx) return;
    if (this._playBuf('bigBoom', 0.95, 0.85)) {
      this._playBuf('boom0', 0.5, 0.7);
      return;
    }
    const t = this.ctx.currentTime;
    this._noise(t, 0.9, 0.45, 400, 'lowpass');
    this._osc('sine', 100, t, 1.0, 0.45, this.sfxGain, 28);
  }

  hit() {
    if (!this.ctx) return;
    if (this._playBuf('hit', 0.65, 0.85)) return;
    const t = this.ctx.currentTime;
    this._osc('sawtooth', 200, t, 0.25, 0.25, this.sfxGain, 60);
    this._noise(t, 0.15, 0.2, 3000);
  }

  msg() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._osc('triangle', 1047, t, 0.1, 0.14, this.sfxGain);
    this._osc('triangle', 1319, t + 0.1, 0.12, 0.14, this.sfxGain);
    this._osc('triangle', 1568, t + 0.22, 0.18, 0.12, this.sfxGain);
  }

  heal() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => this._osc('triangle', f, t + i * 0.07, 0.15, 0.14, this.sfxGain));
  }

  _jingle(notes, type = 'square') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    notes.forEach(([f, at, dur]) => {
      this._osc(type, f, t + at, dur, 0.16, this.sfxGain);
      this._osc('triangle', f / 2, t + at, dur, 0.12, this.sfxGain);
    });
  }
  jingleClear() {
    this._jingle([[523, 0, .12], [659, .12, .12], [784, .24, .12], [988, .36, .12], [1175, .48, .45], [988, .95, .12], [1175, 1.1, .55]]);
  }
  jingleOver() {
    this._jingle([[494, 0, .28], [466, .28, .28], [440, .56, .28], [392, .84, .7]], 'triangle');
  }

  // ===== BGM: 爽快シューティング =====
  // テンポ速め・メジャー進行・駆け上がるアルペジオ・キック/スネア
  startBGM(mode) {
    if (!this.ctx || this.mode === mode) return;
    this.stopBGM();
    this.mode = mode;
    const N = f => 440 * Math.pow(2, (f - 69) / 12);
    let step = 0;
    let nextT = this.ctx.currentTime + 0.05;
    // stage ~150BPM (0.1s/step), boss ~170BPM
    const stepDur = mode === 'boss' ? 0.088 : 0.1;

    // 32ステップの爽快パターン
    const stage = {
      // Cメジャー系: C-G-Am-F
      bass: [
        36, 0, 36, 36, 36, 0, 43, 0,  // C
        43, 0, 43, 43, 43, 0, 38, 0,  // G
        33, 0, 33, 33, 33, 0, 40, 0,  // Am
        41, 0, 41, 41, 43, 43, 45, 47, // F → walk up
      ],
      // 駆け上がるリード
      melo: [
        72, 76, 79, 84, 79, 76, 72, 0,
        74, 79, 83, 86, 83, 79, 74, 0,
        76, 79, 84, 88, 84, 79, 76, 72,
        77, 81, 84, 89, 84, 81, 79, 76,
      ],
      // カウンターメロ(裏打ち)
      arp: [
        60, 0, 67, 0, 72, 0, 67, 0,
        62, 0, 67, 0, 74, 0, 67, 0,
        64, 0, 69, 0, 76, 0, 69, 0,
        65, 0, 72, 0, 77, 0, 72, 0,
      ],
    };

    const boss = {
      bass: [
        35, 35, 0, 35, 38, 38, 0, 38,
        33, 33, 0, 33, 36, 36, 38, 40,
        35, 0, 35, 35, 38, 0, 38, 38,
        31, 31, 33, 33, 35, 35, 38, 40,
      ],
      melo: [
        71, 0, 74, 71, 78, 0, 74, 0,
        69, 0, 72, 69, 76, 0, 72, 0,
        71, 74, 78, 83, 78, 74, 71, 0,
        74, 78, 81, 86, 81, 78, 76, 74,
      ],
      arp: [
        59, 0, 66, 0, 71, 0, 66, 0,
        57, 0, 64, 0, 69, 0, 64, 0,
        59, 66, 0, 71, 0, 66, 59, 0,
        62, 0, 69, 0, 74, 0, 69, 0,
      ],
    };

    const P = mode === 'boss' ? boss : stage;

    const tick = () => {
      if (!this.ctx || this.mode !== mode) return;
      while (nextT < this.ctx.currentTime + 0.22) {
        const s = step % 32;
        const bar = Math.floor(step / 32) % 4;

        // キック
        if (s % 4 === 0) {
          this._osc('sine', 140, nextT, 0.12, 0.42, this.bgmGain, 40);
          this._noise(nextT, 0.04, 0.08, 200, 'lowpass');
        }
        // スネア
        if (s % 8 === 4) this._noise(nextT, 0.08, 0.16, 1800, 'bandpass');
        // ハイハット
        this._noise(nextT, 0.02, s % 2 === 0 ? 0.07 : 0.035, 8000);

        // ベース
        const b = P.bass[s];
        if (b) {
          this._osc('triangle', N(b), nextT, stepDur * 0.92, 0.48, this.bgmGain);
          this._osc('square', N(b), nextT, stepDur * 0.5, 0.08, this.bgmGain);
        }

        // リード(2小節目から転調バリエ)
        let m = P.melo[s];
        if (m && bar === 2) m += 2;
        if (m && bar === 3) m += 5;
        if (m) {
          this._osc('square', N(m), nextT, stepDur * 0.7, 0.14, this.bgmGain);
          this._osc('triangle', N(m + 12), nextT, stepDur * 0.4, 0.05, this.bgmGain);
        }

        // アルペジオ裏
        const a = P.arp[s];
        if (a && (bar === 1 || bar === 3)) {
          this._osc('triangle', N(a), nextT, stepDur * 0.55, 0.09, this.bgmGain);
        }

        nextT += stepDur;
        step++;
      }
      this.bgmTimer = setTimeout(tick, 50);
    };
    tick();
  }

  stopBGM() {
    if (this.bgmTimer) clearTimeout(this.bgmTimer);
    this.bgmTimer = null;
    this.mode = null;
  }
}
