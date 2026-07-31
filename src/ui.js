// DOM HUD 操作
const $ = id => document.getElementById(id);

export class UI {
  constructor() {
    this.els = {
      score: $('score'), hearts: $('hearts'), lockinfo: $('lockinfo'),
      stageMsg: $('stage-msg'), comboMsg: $('combo-msg'),
      bossWrap: $('bossbar-wrap'), bossBar: $('bossbar'),
      reticle: $('reticle'), stick: $('stick'), knob: $('stick-knob'),
      title: $('title-screen'), result: $('result-screen'),
      resultTitle: $('result-title'), resultScore: $('result-score'),
      touchHint: $('touch-hint'), howtoPc: $('howto-pc'),
    };
    this._msgTimer = null; this._comboTimer = null;
  }

  setScore(v) { this.els.score.textContent = 'SCORE ' + v; }
  setHearts(n, max = 5) {
    let s = '';
    for (let i = 0; i < max; i++) s += i < n ? '❤️' : '🤍';
    this.els.hearts.textContent = s;
  }
  setLock(n) { this.els.lockinfo.textContent = n > 0 ? `LOCK ×${n} 🔒` : ''; }

  showStageMsg(text, dur = 2600) {
    const el = this.els.stageMsg;
    el.textContent = text; el.style.opacity = 1;
    clearTimeout(this._msgTimer);
    this._msgTimer = setTimeout(() => el.style.opacity = 0, dur);
  }
  showCombo(text) {
    const el = this.els.comboMsg;
    el.textContent = text; el.style.opacity = 1;
    el.style.transition = 'none'; el.style.transform = 'translateX(-50%) rotate(-4deg) scale(1.3)';
    requestAnimationFrame(() => { el.style.transition = 'all .25s'; el.style.transform = 'translateX(-50%) rotate(-4deg) scale(1)'; });
    clearTimeout(this._comboTimer);
    this._comboTimer = setTimeout(() => el.style.opacity = 0, 1300);
  }

  showBoss(show) { this.els.bossWrap.style.display = show ? 'block' : 'none'; }
  setBossHp(ratio) { this.els.bossBar.style.width = Math.max(0, ratio * 100) + '%'; }

  setReticle(x, y, locking, visible) {
    const r = this.els.reticle;
    r.style.display = visible ? 'block' : 'none';
    r.style.left = x + 'px'; r.style.top = y + 'px';
    r.classList.toggle('locking', locking);
  }
  setStick(stick) {
    const el = this.els.stick;
    if (!stick.active) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.style.left = (stick.ox - 55) + 'px'; el.style.top = (stick.oy - 55) + 'px';
    this.els.knob.style.transform = `translate(${stick.x * 32}px,${stick.y * 32}px)`;
  }

  showTitle() { this.els.title.classList.remove('hidden'); }
  hideTitle() { this.els.title.classList.add('hidden'); }
  showResult(clear, score) {
    this.els.resultTitle.textContent = clear ? 'ミッションクリア！' : 'やられた〜…';
    this.els.resultScore.textContent = 'SCORE ' + score;
    this.els.result.classList.remove('hidden');
  }
  setTouchMode(on) {
    this.els.touchHint.style.display = on ? 'block' : 'none';
    if (on) this.els.howtoPc.innerHTML = '左半分：移動 ｜ 右半分：照準+連射<br>押しっぱなしでロックオン → 離してホーミング一斉発射';
  }
}
