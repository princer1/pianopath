// On-screen piano keyboard. Mirrors whatever is pressed (MIDI, computer keys, mouse).
(function () {
  const T = PL.Theory;
  // Black key center offsets, in white-key widths, relative to the boundary after its lower white key.
  const BLACK_SHIFT = { 1: -0.12, 3: 0.12, 6: -0.15, 8: 0, 10: 0.15 };

  class Keyboard {
    constructor(el) {
      this.el = el;
      this.low = 48; this.high = 84;
      this.labels = 'all';        // 'all' | 'c' | 'none'
      this.keys = new Map();
      this.hints = new Set();
      this.fingers = null;        // Map note -> finger number (1 = thumb … 5 = pinky)
      this.fingerHand = 'R';
      el.addEventListener('pointerdown', (e) => this._pointer(e, 'down'));
      window.addEventListener('pointerup', () => this._releasePointer());
      el.addEventListener('pointerover', (e) => { if (this.pointerNote != null && e.buttons) this._pointer(e, 'drag'); });
      PL.Input.on((ev) => this.setDown(ev.note, ev.type === 'on'));
      window.addEventListener('resize', () => this._fit());
      this.render();
    }

    // Hide labels that can't fit when many keys are shown (e.g. all 84 keys).
    _fit() {
      const px = this.el.clientWidth / this.whiteCount();
      this.el.classList.toggle('narrow', px < 24);
      this.el.classList.toggle('tiny', px < 15);
    }

    setRange(low, high) {
      while (T.isBlack(low)) low--;
      while (T.isBlack(high)) high++;
      if (low === this.low && high === this.high) return;
      this.low = low; this.high = high;
      this.render();
    }
    setLabels(mode) { this.labels = mode; this.render(); }

    whiteCount() {
      let c = 0;
      for (let n = this.low; n <= this.high; n++) if (!T.isBlack(n)) c++;
      return c;
    }

    // Geometry as fractions of the keyboard width: { x, w, black }
    geom(n) {
      const W = this.whiteCount();
      const ww = 1 / W;
      let idx = 0;
      for (let m = this.low; m < n; m++) if (!T.isBlack(m)) idx++;
      if (!T.isBlack(n)) return { x: idx * ww, w: ww, black: false };
      const bw = ww * 0.6;
      const center = idx * ww + BLACK_SHIFT[T.pc(n)] * ww;
      return { x: center - bw / 2, w: bw, black: true };
    }

    render() {
      this.el.innerHTML = '';
      this.keys.clear();
      for (let n = this.low; n <= this.high; n++) {
        const g = this.geom(n);
        const k = document.createElement('div');
        k.className = 'key ' + (g.black ? 'black' : 'white');
        if (n === 60) k.classList.add('middle-c');
        if (T.pc(n) === 0) k.classList.add('c-key');
        k.style.left = g.x * 100 + '%';
        k.style.width = g.w * 100 + '%';
        k.dataset.note = n;
        this._label(k, n);
        this._finger(k, n);
        if (PL.Input.down.has(n)) k.classList.add('down');
        if (this.hints.has(n)) k.classList.add('hint');
        this.el.appendChild(k);
        this.keys.set(n, k);
      }
      this._fit();
    }

    _label(k, n) {
      const show = this.labels === 'all' || (this.labels === 'c' && T.pc(n) === 0);
      if (!show) return;
      const lbl = document.createElement('div');
      lbl.className = 'lbl';
      if (T.settings.colors && !T.isBlack(n)) {
        const dot = document.createElement('span');
        dot.className = 'dotc';
        dot.style.background = T.color(n);
        lbl.appendChild(dot);
      }
      let text = T.name(n, { naming: T.settings.naming === 'both' ? 'solfege' : T.settings.naming });
      if (T.pc(n) === 0) text += T.octave(n);
      lbl.appendChild(document.createTextNode(text));
      if (T.settings.naming === 'both' && !T.isBlack(n)) {
        lbl.appendChild(document.createElement('br'));
        lbl.appendChild(document.createTextNode(T.name(n, { naming: 'letters' })));
      }
      k.appendChild(lbl);
    }

    setDown(n, on) {
      const k = this.keys.get(n);
      if (k) k.classList.toggle('down', on);
    }
    hint(notes) {
      this.clearHints();
      (Array.isArray(notes) ? notes : [notes]).forEach((n) => {
        this.hints.add(n);
        const k = this.keys.get(n);
        if (k) k.classList.add('hint');
      });
    }
    clearHints() {
      this.hints.forEach((n) => { const k = this.keys.get(n); if (k) k.classList.remove('hint'); });
      this.hints.clear();
    }
    // Show finger numbers for a hand position. hand: 'R' | 'L'
    setFingers(map, hand = 'R') {
      this.fingers = map;
      this.fingerHand = hand;
      this.keys.forEach((k, n) => this._finger(k, n));
    }
    clearFingers() { if (this.fingers) this.setFingers(null); }
    _finger(k, n) {
      let b = k.querySelector('.finger');
      const f = this.fingers && this.fingers.get(n);
      if (!f) { if (b) b.remove(); return; }
      if (!b) { b = document.createElement('div'); b.className = 'finger'; k.appendChild(b); }
      b.textContent = f;
      b.classList.toggle('left', this.fingerHand === 'L');
    }
    flash(n, cls, ms = 350) {
      const k = this.keys.get(n);
      if (!k) return;
      k.classList.add(cls);
      setTimeout(() => k.classList.remove(cls), ms);
    }

    _pointer(e, kind) {
      const k = e.target.closest('.key');
      if (!k) return;
      const n = +k.dataset.note;
      if (kind === 'down') e.preventDefault();
      if (this.pointerNote === n) return;
      this._releasePointer();
      this.pointerNote = n;
      PL.Audio.init();
      PL.Input.emit('on', n, 0.7, e.timeStamp);
    }
    _releasePointer() {
      if (this.pointerNote != null) { PL.Input.emit('off', this.pointerNote); this.pointerNote = null; }
    }
  }

  PL.Keyboard = Keyboard;
})();
