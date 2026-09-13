// Unified note input: MIDI keyboard, computer keyboard, on-screen keys.
(function () {
  const I = (PL.Input = {});
  const subs = new Set();
  I.down = new Set();
  I.sound = true;   // play our synth when a key is pressed (turn off if keyboard has speakers)
  I.octave = 60;    // computer-key base note (C4)

  I.on = (fn) => { subs.add(fn); return () => subs.delete(fn); };

  I.emit = function (type, note, vel = 0.8) {
    if (type === 'on') {
      if (I.sound) PL.Audio.noteOn(note, vel);
      I.down.add(note);
    } else {
      if (!I.down.has(note)) return;
      PL.Audio.noteOff(note);
      I.down.delete(note);
    }
    const ev = { type, note, vel, time: performance.now() };
    subs.forEach((fn) => fn(ev));
  };

  // ---------- Web MIDI ----------
  I.devices = [];
  I.initMIDI = async function (onStatus) {
    if (!navigator.requestMIDIAccess) {
      onStatus('err', 'Web MIDI not supported — open in Chrome or Edge');
      return;
    }
    try {
      const access = await navigator.requestMIDIAccess();
      const bind = () => {
        I.devices = [];
        access.inputs.forEach((inp) => {
          inp.onmidimessage = handleMIDI;
          I.devices.push(inp.name);
        });
        if (I.devices.length) onStatus('ok', I.devices.join(', '));
        else onStatus('none', 'No MIDI keyboard — plug it in (computer keys work)');
      };
      bind();
      access.onstatechange = bind;
    } catch (e) {
      onStatus('err', 'MIDI permission denied');
    }
  };

  function handleMIDI(e) {
    const [status, d1, d2] = e.data;
    const cmd = status & 0xf0;
    if (cmd === 0x90 && d2 > 0) I.emit('on', d1, d2 / 127);
    else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) I.emit('off', d1);
    else if (cmd === 0xb0 && d1 === 64) PL.Audio.sustain(d2 >= 64);
  }

  // ---------- computer keyboard ----------
  const KEYMAP = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16, "'": 17 };
  const held = new Map(); // key -> note

  function typing(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || typing(e)) return;
    const k = e.key.toLowerCase();
    if (k === 'z') { I.octave = Math.max(24, I.octave - 12); I.onOctave && I.onOctave(I.octave); return; }
    if (k === 'x') { I.octave = Math.min(96, I.octave + 12); I.onOctave && I.onOctave(I.octave); return; }
    if (k in KEYMAP && !held.has(k)) {
      const note = I.octave + KEYMAP[k];
      held.set(k, note);
      I.emit('on', note, 0.75);
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (held.has(k)) { I.emit('off', held.get(k)); held.delete(k); }
  });
  window.addEventListener('blur', () => {
    held.forEach((n) => I.emit('off', n));
    held.clear();
  });
})();
