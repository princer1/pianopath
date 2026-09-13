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

  // ---------- timing ----------
  // offset: the player's measured delay correction in ms (from the timing check). level: how strict "on time" is.
  A.timing = { offset: 0, level: 'relaxed' };
  const WINDOWS = { relaxed: { good: 90, ok: 180 }, normal: { good: 60, ok: 120 }, strict: { good: 35, ok: 70 } };
  A.windows = () => WINDOWS[A.timing.level] || WINDOWS.relaxed;
  // performance.now() time at which a sound scheduled for AudioContext time t reaches the speakers.
  A.heardAt = function (t) {
    if (!ctx) return performance.now();
    const ts = ctx.getOutputTimestamp && ctx.getOutputTimestamp();
    if (ts && ts.performanceTime > 0 && ts.contextTime > 0) return ts.performanceTime + (t - ts.contextTime) * 1000;
    return performance.now() + (t - ctx.currentTime + (ctx.baseLatency || 0) + (ctx.outputLatency || 0)) * 1000;
  };
  // How long a sound started now takes to be heard, in ms.
  A.outputDelay = () => (ctx ? Math.max(0, A.heardAt(ctx.currentTime) - performance.now()) : 0);
  // Timing error in ms (+ = late) of a key press at performance time `pressTime` against a sound scheduled at context time t.
  A.offsetMs = (pressTime, t) => pressTime - A.heardAt(t) - A.timing.offset;
  A.getVolume = () => volume;

  const freq = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const PARTIALS = [[1, 1], [2, 0.42], [3, 0.18], [4, 0.09], [5, 0.04]];

  A.useSamples = false; // true = play the player's recorded piano (samples.js) instead of the synth

  // A voice from a recorded sample, retuned to the requested note.
  function sampleVoice(s, n, vel, t) {
    const src = ctx.createBufferSource();
    src.buffer = s.buffer;
    src.playbackRate.value = Math.pow(2, (n - s.note) / 12);
    const out = ctx.createGain();
    const level = 0.55 * PL.Samples.scale * Math.max(0.25, Math.min(1.6, vel / Math.max(0.05, s.vel)));
    out.gain.setValueAtTime(level, t);
    src.connect(out);
    out.connect(master);
    src.start(t);
    return {
      release(at) {
        const r = Math.max(at, ctx.currentTime);
        if (out.gain.cancelAndHoldAtTime) out.gain.cancelAndHoldAtTime(r);
        else out.gain.cancelScheduledValues(r);
        out.gain.setTargetAtTime(0.0001, r, 0.09);
        try { src.stop(r + 1); } catch (e) {}
      },
    };
  }

  // Build one voice. Returns { release(at) }.
  function makeVoice(n, vel, t) {
    if (A.useSamples && PL.Samples) {
      const s = PL.Samples.pick(n, vel);
      if (s) return sampleVoice(s, n, vel, t);
    }
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
