// WebAudio 全合成サウンド: BGM(チップチューン風シーケンサ) + SFX
export class AudioSys {
  constructor() { this.ctx = null; this.bgmTimer = null; this.mode = null; }

  ensure() {
    if (this.ctx) { this.ctx.resume(); return; }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(this.ctx.destination);
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.42;
    this.bgmGain.connect(this.master);
  }

  _osc(type, freq, t0, dur, vol = 0.2, dest = this.master, slideTo = null) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(dest);
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

  // ===== SFX =====
  shoot()  { const t = this.ctx.currentTime; this._osc('square', 880, t, 0.08, 0.06, this.master, 220); }
  lock(n)  { const t = this.ctx.currentTime; this._osc('square', 700 + n * 90, t, 0.07, 0.1); }
  homing() { const t = this.ctx.currentTime; this._noise(t, 0.25, 0.15, 900, 'bandpass'); this._osc('sawtooth', 300, t, 0.3, 0.1, this.master, 1200); }
  boom()   { const t = this.ctx.currentTime; this._noise(t, 0.3, 0.3, 700, 'lowpass'); this._osc('sine', 160, t, 0.3, 0.3, this.master, 40); }
  bigBoom(){ const t = this.ctx.currentTime; this._noise(t, 0.8, 0.4, 500, 'lowpass'); this._osc('sine', 120, t, 0.9, 0.4, this.master, 30); }
  hit()    { const t = this.ctx.currentTime; this._osc('sawtooth', 200, t, 0.25, 0.25, this.master, 60); this._noise(t, 0.15, 0.2, 3000); }
  msg()    { const t = this.ctx.currentTime; this._osc('triangle', 1047, t, 0.12, 0.15); this._osc('triangle', 1319, t + 0.12, 0.2, 0.15); }

  _jingle(notes, type = 'square') {
    const t = this.ctx.currentTime;
    notes.forEach(([f, at, dur]) => { this._osc(type, f, t + at, dur, 0.14); this._osc('triangle', f / 2, t + at, dur, 0.12); });
  }
  jingleClear() { this._jingle([[523,0,.15],[659,.15,.15],[784,.3,.15],[1047,.45,.4],[784,.85,.12],[1047,1,.6]]); }
  jingleOver()  { this._jingle([[494,0,.3],[466,.3,.3],[440,.6,.3],[415,.9,.8]], 'triangle'); }

  // ===== BGM =====
  startBGM(mode) {
    if (!this.ctx || this.mode === mode) return;
    this.stopBGM();
    this.mode = mode;
    const N = f => 440 * Math.pow(2, (f - 69) / 12); // MIDI→Hz
    let step = 0;
    let nextT = this.ctx.currentTime + 0.05;
    const stepDur = mode === 'boss' ? 0.125 : 0.15;

    // 16step パターン (MIDIノート、0=休符)
    const P = mode === 'boss' ? {
      bass:   [45,0,45,45, 48,0,48,48, 43,0,43,43, 46,46,47,47],
      melo:   [69,0,72,69, 76,0,72,0,  67,0,70,67, 74,0,75,0],
      hatEvery: 1,
    } : {
      bass:   [48,0,48,0, 43,0,43,0, 45,0,45,0, 50,0,43,0],
      melo:   [72,0,76,0, 79,76,72,0, 74,0,77,74, 79,0,76,74],
      hatEvery: 2,
    };

    const tick = () => {
      if (!this.ctx || this.mode !== mode) return;
      while (nextT < this.ctx.currentTime + 0.2) {
        const s = step % 16;
        const bar = Math.floor(step / 16) % 4;
        const b = P.bass[s];
        if (b) this._osc('triangle', N(b - 12), nextT, stepDur * 0.9, 0.5, this.bgmGain);
        let m = P.melo[s];
        if (m && bar >= 2) m += (bar === 3 ? 5 : 3); // バリエーション
        if (m) this._osc('square', N(m), nextT, stepDur * 0.85, 0.16, this.bgmGain);
        if (s % P.hatEvery === 0) this._noise(nextT, 0.03, s % 4 === 0 ? 0.1 : 0.05, 6000);
        if (s === 4 || s === 12) this._noise(nextT, 0.1, 0.12, 1200, 'bandpass');
        nextT += stepDur;
        step++;
      }
      this.bgmTimer = setTimeout(tick, 60);
    };
    tick();
  }

  stopBGM() { if (this.bgmTimer) clearTimeout(this.bgmTimer); this.bgmTimer = null; this.mode = null; }
}
