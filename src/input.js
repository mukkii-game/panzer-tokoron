// 入力統合: キーボード + マウス + タッチ(左=バーチャルスティック / 右=照準)
export class Input {
  constructor() {
    this.keys = {};
    this.aim = { x: innerWidth * 0.5, y: innerHeight * 0.45 };
    this.firing = false;      // 直線ショット
    this.locking = false;     // ロックオンスイープ中
    this.onLockRelease = null;
    this.isTouch = false;

    this.stick = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 };
    this.aimTouchId = -1;

    addEventListener('keydown', e => { this.keys[e.code] = true; if (e.code === 'KeyZ') this.firing = true; if (e.code === 'KeyX') this._lockStart(); });
    addEventListener('keyup',   e => { this.keys[e.code] = false; if (e.code === 'KeyZ') this.firing = false; if (e.code === 'KeyX') this._lockEnd(); });

    addEventListener('mousemove', e => { this.aim.x = e.clientX; this.aim.y = e.clientY; });
    addEventListener('mousedown', e => {
      if (e.target.closest('.btn')) return;
      if (e.button === 0) this.firing = true;
      if (e.button === 2) this._lockStart();
    });
    addEventListener('mouseup', e => {
      if (e.button === 0) this.firing = false;
      if (e.button === 2) this._lockEnd();
    });
    addEventListener('contextmenu', e => e.preventDefault());

    addEventListener('touchstart', e => {
      this.isTouch = true;
      for (const t of e.changedTouches) {
        if (t.target.closest('.btn')) continue;
        if (t.clientX < innerWidth * 0.42 && !this.stick.active) {
          this.stick = { active: true, id: t.identifier, ox: t.clientX, oy: t.clientY, x: 0, y: 0 };
        } else if (this.aimTouchId === -1) {
          this.aimTouchId = t.identifier;
          this.aim.x = t.clientX; this.aim.y = t.clientY;
          this.firing = true; this._lockStart();
        }
      }
    }, { passive: false });
    addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.stick.active && t.identifier === this.stick.id) {
          const dx = t.clientX - this.stick.ox, dy = t.clientY - this.stick.oy, m = 46;
          this.stick.x = Math.max(-1, Math.min(1, dx / m));
          this.stick.y = Math.max(-1, Math.min(1, dy / m));
        } else if (t.identifier === this.aimTouchId) {
          this.aim.x = t.clientX; this.aim.y = t.clientY;
        }
      }
    }, { passive: false });
    const touchEnd = e => {
      for (const t of e.changedTouches) {
        if (this.stick.active && t.identifier === this.stick.id) this.stick = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 };
        if (t.identifier === this.aimTouchId) { this.aimTouchId = -1; this.firing = false; this._lockEnd(); }
      }
    };
    addEventListener('touchend', touchEnd);
    addEventListener('touchcancel', touchEnd);
  }

  _lockStart() { if (!this.locking) this.locking = true; }
  _lockEnd() { if (this.locking) { this.locking = false; this.onLockRelease && this.onLockRelease(); } }

  // 移動ベクトル -1..1 (画面基準: x右+ y上+)
  getMove() {
    let x = 0, y = 0;
    const k = this.keys;
    if (k['KeyA'] || k['ArrowLeft']) x -= 1;
    if (k['KeyD'] || k['ArrowRight']) x += 1;
    if (k['KeyW'] || k['ArrowUp']) y += 1;
    if (k['KeyS'] || k['ArrowDown']) y -= 1;
    if (this.stick.active) { x += this.stick.x; y -= this.stick.y; }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y };
  }
}
