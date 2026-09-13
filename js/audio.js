// Simple piano-like synthesizer + metronome clicks (Web Audio, no samples needed).
(function () {
  const A = (PL.Audio = {});
  let ctx = null, master = null;
  const voices = new Map();      // held notes from the player's own keyboard
  const sustained = new Set();   // notes released while sustain pedal is down
  let sustainDown = false;
  let volume = 0.8;

  A.init = function () {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  A.now = () => (ctx ? ctx.currentTime : 0);
  A.setVolume = (v) => { volume = v; if (master) master.gain.value = v; };
  A.getVolume = () => volume;

  const freq = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const PARTIALS = [[1, 1], [2, 0.42], [3, 0.18], [4, 0.09], [5, 0.04]];

  // Build one voice. Returns { gain, oscs, stopAt(t) }.
  function makeVoice(n, vel, t) {
    const f0 = freq(n);
    const out = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(14000, f0 * (4 + 8 * vel) + 600), t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(300, f0 * 2), t + 2.5);
    filter.connect(out);
    out.connect(master);

    const peak = 0.18 * (0.35 + 0.65 * vel);
    const decay = Math.max(0.8, 5 - (n - 40) * 0.07); // low notes ring longer
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(peak, t + 0.006);
    out.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.35);
    out.gain.exponentialRampToValueAtTime(0.0001, t + decay);

    const oscs = PARTIALS.map(([mult, amp], i) => {
      if (f0 * mult > 16000) return null;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = i === 0 ? 'triangle' : 'sine';
      o.frequency.value = f0 * mult * (1 + i * 0.0007); // slight inharmonicity
      g.gain.value = amp;
      o.connect(g); g.connect(filter);
      o.start(t); o.stop(t + decay + 0.05);
      return o;
    }).filter(Boolean);

    return {
      out, oscs,
      release(at) {
        const r = Math.max(at, ctx.currentTime);
        if (out.gain.cancelAndHoldAtTime) out.gain.cancelAndHoldAtTime(r);
        else out.gain.cancelScheduledValues(r);
        out.gain.setTargetAtTime(0.0001, r, 0.07);
        oscs.forEach((o) => { try { o.stop(r + 0.6); } catch (e) {} });
      },
    };
  }

  // Live notes (from MIDI keyboard / mouse / computer keys)
  A.noteOn = function (n, vel = 0.8) {
    A.init();
    if (voices.has(n)) voices.get(n).release(ctx.currentTime);
    sustained.delete(n);
    voices.set(n, makeVoice(n, vel, ctx.currentTime));
  };
  A.noteOff = function (n) {
    if (!ctx || !voices.has(n)) return;
    if (sustainDown) { sustained.add(n); return; }
    voices.get(n).release(ctx.currentTime);
    voices.delete(n);
  };
  A.sustain = function (down) {
    sustainDown = down;
    if (!down) {
      sustained.forEach((n) => {
        if (voices.has(n)) { voices.get(n).release(ctx.currentTime); voices.delete(n); }
      });
      sustained.clear();
    }
  };

  // Scheduled notes (autoplay / demo). when = AudioContext time.
  A.play = function (n, dur, vel = 0.7, when) {
    A.init();
    const t = when == null ? ctx.currentTime : when;
    const v = makeVoice(n, vel, t);
    v.release(t + Math.max(0.08, dur));
    return v;
  };

  A.click = function (accent, when) {
    A.init();
    const t = when == null ? ctx.currentTime : when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = accent ? 1760 : 1175;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(accent ? 0.35 : 0.2, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.07);
  };

  A.chime = function (good) {
    A.init();
    const t = ctx.currentTime;
    const notes = good ? [84, 88] : [52];
    notes.forEach((n, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = good ? 'sine' : 'sawtooth';
      o.frequency.value = freq(n);
      g.gain.setValueAtTime(0.0001, t + i * 0.08);
      g.gain.exponentialRampToValueAtTime(good ? 0.12 : 0.05, t + i * 0.08 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.08 + (good ? 0.3 : 0.25));
      o.connect(g); g.connect(master);
      o.start(t + i * 0.08); o.stop(t + i * 0.08 + 0.35);
    });
  };
})();
