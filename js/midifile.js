// Standard MIDI File import.
// parse()   reads every instrument part, the tempo map and the time/key signature.
// guess()   suggests which parts each hand should play.
// arrange() builds a playable song from the chosen parts, with timing snapped to the beat (times in quarter-note beats).
(function () {
  const M = (PL.MidiFile = {});
  const FAMILIES = ['Piano', 'Chromatic percussion', 'Organ', 'Guitar', 'Bass', 'Strings', 'Ensemble', 'Brass',
    'Reed', 'Pipe', 'Synth lead', 'Synth pad', 'Synth effects', 'Ethnic', 'Percussive', 'Sound effects'];
  M.family = (program) => FAMILIES[Math.floor(program / 8)] || 'Instrument';

  M.parse = function (buffer, fileTitle) {
    const d = new DataView(buffer);
    let p = 0;
    const text = (n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(d.getUint8(p + i)); return s; };
    const u32 = () => { const v = d.getUint32(p); p += 4; return v; };
    const u16 = () => { const v = d.getUint16(p); p += 2; return v; };
    const vlq = () => { let v = 0, b; do { b = d.getUint8(p++); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };

    if (text(4) !== 'MThd') throw new Error('Not a MIDI file');
    p = 4;
    const hlen = u32();
    u16(); // format
    const ntracks = u16(), division = u16();
    p = 8 + hlen;
    if (division & 0x8000) throw new Error('SMPTE-timed MIDI files are not supported');
    const ppq = division;

    const tempos = [];
    let timeSig = null, keySig = null, songName = null;
    const parts = new Map(); // `${track chunk}:${channel}` -> { channel, program, name, notes }

    for (let t = 0; t < ntracks && p + 8 <= d.byteLength; t++) {
      if (text(4) !== 'MTrk') break;
      p += 4;
      const len = u32();
      const end = Math.min(d.byteLength, p + len);
      let tick = 0, running = 0, trackName = null;
      const programs = new Array(16).fill(-1);
      const open = new Map(); // channel*128+note -> { part, note, tick, vel }
      const mine = [];
      const partFor = (ch) => {
        const k = t + ':' + ch;
        if (!parts.has(k)) {
          const part = { channel: ch, program: programs[ch], name: null, notes: [] };
          parts.set(k, part);
          mine.push(part);
        }
        return parts.get(k);
      };
      const close = (k, endTick) => {
        const o = open.get(k);
        open.delete(k);
        o.part.notes.push({ note: o.note, start: o.tick / ppq, dur: Math.max(endTick - o.tick, ppq / 16) / ppq, vel: o.vel });
      };

      while (p < end) {
        tick += vlq();
        let status = d.getUint8(p);
        if (status & 0x80) p++; else status = running;

        if (status === 0xff) {
          const type = d.getUint8(p++), mlen = vlq();
          if (type === 0x51 && mlen >= 3) {
            tempos.push({ tick, bpm: 60000000 / ((d.getUint8(p) << 16) | (d.getUint8(p + 1) << 8) | d.getUint8(p + 2)) });
          } else if (type === 0x58 && mlen >= 2 && (!timeSig || tick < timeSig.tick)) {
            timeSig = { tick, v: [d.getUint8(p), Math.pow(2, d.getUint8(p + 1))] };
          } else if (type === 0x59 && mlen >= 2 && (!keySig || tick < keySig.tick)) {
            keySig = { tick, sf: d.getInt8(p) };
          } else if (type === 0x03 && mlen > 0 && !trackName) {
            trackName = text(mlen).replace(/\0/g, '').trim();
          }
          p += mlen;
          continue;
        }
        if (status === 0xf0 || status === 0xf7) { p += vlq(); continue; }

        running = status;
        const cmd = status & 0xf0, ch = status & 0x0f;
        if (cmd === 0xc0) {
          programs[ch] = d.getUint8(p++);
          const part = parts.get(t + ':' + ch);
          if (part && part.program < 0) part.program = programs[ch];
          continue;
        }
        if (cmd === 0xd0) { p++; continue; }
        const a = d.getUint8(p++), b = d.getUint8(p++);
        if (cmd !== 0x80 && cmd !== 0x90) continue;
        const k = ch * 128 + a;
        if (cmd === 0x90 && b > 0) {
          if (open.has(k)) close(k, tick);
          open.set(k, { part: partFor(ch), note: a, tick, vel: b / 127 });
        } else if (open.has(k)) {
          close(k, tick);
        }
      }
      open.forEach((o, k) => close(k, o.tick + ppq));
      mine.forEach((part) => { part.name = trackName; });
      if (t === 0 && trackName && !songName) songName = trackName;
      p = end;
    }

    const all = [...parts.values()].filter((pt) => pt.notes.length && pt.channel !== 9); // channel 10 = drums
    if (!all.length) throw new Error('No notes found in this MIDI file (drums are left out).');

    const baseName = (pt) => pt.name || M.family(Math.max(0, pt.program));
    const tracks = all.map((pt, id) => {
      let low = 127, high = 0, sum = 0;
      pt.notes.forEach((n) => { low = Math.min(low, n.note); high = Math.max(high, n.note); sum += n.note; });
      let name = baseName(pt);
      if (all.filter((q) => baseName(q) === name).length > 1) name += ` (channel ${pt.channel + 1})`;
      return { id, name: name.slice(0, 48), program: Math.max(0, pt.program), channel: pt.channel, count: pt.notes.length, low, high, avg: sum / pt.notes.length };
    });

    // Compact storage: [part id, note, start, duration, velocity]
    const notes = [];
    all.forEach((pt, id) => pt.notes.forEach((n) => notes.push([id, n.note, +n.start.toFixed(4), +n.dur.toFixed(4), +n.vel.toFixed(2)])));
    notes.sort((x, y) => x[2] - y[2] || x[1] - y[1]);

    tempos.sort((x, y) => x.tick - y.tick);
    const tmap = [];
    tempos.forEach((x) => {
      const beat = +(x.tick / ppq).toFixed(4), bpm = +x.bpm.toFixed(2);
      const last = tmap[tmap.length - 1];
      if (last && Math.abs(last.beat - beat) < 1e-6) last.bpm = bpm;
      else if (!last || last.bpm !== bpm) tmap.push({ beat, bpm });
    });
    if (!tmap.length || tmap[0].beat > 0) tmap.unshift({ beat: 0, bpm: 120 }); // MIDI default tempo

    const clean = (s) => String(s || '').replace(/[<>&"]/g, '').trim();
    return {
      title: clean(fileTitle) || clean(songName) || 'Imported MIDI',
      tempos: tmap,
      timeSig: timeSig ? timeSig.v : [4, 4],
      keySig: keySig ? keySig.sf : null,
      tracks,
      notes,
    };
  };

  // Suggest parts: a piano part if there is one; otherwise the melody for the right hand and the bass for the left.
  M.guess = function (raw) {
    const a = {};
    raw.tracks.forEach((t) => (a[t.id] = 'skip'));
    const big = raw.tracks.filter((t) => t.count >= 16);
    const pool = big.length ? big : raw.tracks;
    if (pool.length === 1) { a[pool[0].id] = 'split'; return a; }

    const piano = pool.filter((t) => t.program <= 7 || /piano|klavier|keys/i.test(t.name));
    if (piano.length === 1) { a[piano[0].id] = 'split'; return a; }
    if (piano.length >= 2) {
      const s = piano.slice().sort((x, y) => y.avg - x.avg);
      a[s[0].id] = 'R';
      a[s[s.length - 1].id] = 'L';
      return a;
    }

    const isBass = (t) => (t.program >= 32 && t.program <= 39) || /bass/i.test(t.name);
    const bass = pool.filter(isBass).sort((x, y) => y.count - x.count)[0] || pool.slice().sort((x, y) => x.avg - y.avg)[0];
    const melodic = (t) => /vocal|voice|melod|lead|sing|vox/i.test(t.name) || (t.program >= 52 && t.program <= 54) || (t.program >= 64 && t.program <= 87) || t.program === 40;
    const rest = pool.filter((t) => t !== bass && !isBass(t));
    const mel = rest.filter(melodic).sort((x, y) => y.count - x.count)[0] || rest.slice().sort((x, y) => y.avg - x.avg)[0];
    if (mel) a[mel.id] = 'R';
    if (bass && bass !== mel) a[bass.id] = 'L';
    return a;
  };

  // Check the file's time signature against the music: the lowest part (usually the bass) lands on beat 1 of each bar
  // far more often than chance. Some files declare the wrong meter, e.g. 3/4 for a song that is really in 4/4.
  M.meter = function (raw) {
    const [num, den] = raw.timeSig;
    if (den !== 4 || (num !== 3 && num !== 4)) return { timeSig: raw.timeSig, phase: 0, changed: false };
    const big = raw.tracks.filter((t) => t.count >= 16);
    const lowest = (big.length ? big : raw.tracks).slice().sort((a, b) => a.avg - b.avg)[0];
    const ns = raw.notes.filter((n) => n[0] === lowest.id);
    const fit = (len) => {
      let best = { ratio: 0, phase: 0 };
      for (let ph = 0; ph < len; ph += 0.25) {
        let on = 0, total = 0;
        ns.forEach((n) => {
          const wgt = Math.min(2, n[3]) * n[4];
          const r = (((n[2] - ph) % len) + len) % len;
          total += wgt;
          if (r < 0.06 || r > len - 0.06) on += wgt;
        });
        const ratio = total ? (on / total) * len * 4 : 0; // 1 = no better than chance
        if (ratio > best.ratio + 1e-9) best = { ratio, phase: ph };
      }
      return best;
    };
    const f3 = fit(3), f4 = fit(4);
    const other = num === 3 ? { n: 4, f: f4, mine: f3 } : { n: 3, f: f3, mine: f4 };
    if (other.f.ratio > other.mine.ratio * 1.4) return { timeSig: [other.n, 4], phase: other.f.phase, changed: true };
    return { timeSig: raw.timeSig, phase: 0, changed: false };
  };

  // Snap to the nearest 16th note, or to an eighth-note triplet when that fits clearly better.
  const snap = (x) => {
    const q4 = Math.round(x * 4) / 4, q3 = Math.round(x * 3) / 3;
    return Math.abs(q3 - x) < Math.abs(q4 - x) - 0.015 ? q3 : q4;
  };

  // assign: { [part id]: 'R' | 'L' | 'split' | 'skip' }
  // meta: { id, title, timeSig (overrides the file's), phase (beat where bar 1 starts) }
  M.arrange = function (raw, assign, meta = {}) {
    const timeSig = meta.timeSig || raw.timeSig;
    const phase = meta.phase || 0;
    const barLen = (timeSig[0] * 4) / timeSig[1];
    const byKey = new Map();
    raw.notes.forEach(([t, note, start, dur, vel]) => {
      const how = assign[t];
      if (!how || how === 'skip') return;
      const hand = how === 'split' ? (note >= 60 ? 'R' : 'L') : how;
      const s = snap(start);
      const grid = Math.abs(s * 4 - Math.round(s * 4)) < 1e-6 ? 0.25 : 1 / 3;
      const e = Math.max(snap(start + dur), s + grid);
      const k = hand + ':' + note + ':' + s.toFixed(3);
      const prev = byKey.get(k);
      if (!prev || e - s > prev.dur) byKey.set(k, { note, start: s, dur: e - s, vel, hand });
    });
    const notes = [...byKey.values()].sort((x, y) => x.start - y.start || x.note - y.note);
    if (!notes.length) throw new Error('Choose at least one part for your right or left hand.');

    // Skip empty bars at the start, keeping bar lines where they belong (phase = where bar 1 begins).
    const shift = phase + Math.floor((notes[0].start - phase) / barLen + 1e-6) * barLen;
    notes.forEach((n) => { n.start = +(n.start - shift).toFixed(4); n.dur = +n.dur.toFixed(4); });
    const from = Math.max(0, shift);
    const before = raw.tempos.filter((x) => x.beat <= from + 1e-6).pop() || raw.tempos[0];
    const tempos = [{ beat: 0, bpm: before.bpm }]
      .concat(raw.tempos.filter((x) => x.beat > from + 1e-6).map((x) => ({ beat: +(x.beat - shift).toFixed(4), bpm: x.bpm })));

    return {
      id: meta.id || 'midi-' + Date.now(),
      title: meta.title || raw.title,
      composer: 'Imported file',
      level: 'Custom',
      bpm: Math.round(tempos[0].bpm),
      tempos,
      timeSig,
      phase,
      keySig: raw.keySig,
      imported: true,
      notes,
    };
  };
})();
