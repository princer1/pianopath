// Standard MIDI File parser -> PianoPath song format (times in quarter-note beats).
(function () {
  PL.MidiFile = {
    parse(buffer, title) {
      const d = new DataView(buffer);
      let p = 0;
      const str = (n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(d.getUint8(p + i)); p += n; return s; };
      const u32 = () => { const v = d.getUint32(p); p += 4; return v; };
      const u16 = () => { const v = d.getUint16(p); p += 2; return v; };
      const vlq = () => { let v = 0, b; do { b = d.getUint8(p++); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };

      if (str(4) !== 'MThd') throw new Error('Not a MIDI file');
      const hlen = u32();
      const format = u16(), ntracks = u16(), division = u16();
      p = 8 + hlen;
      if (division & 0x8000) throw new Error('SMPTE timing not supported');
      const ppq = division;

      let bpm = null, timeSig = null, name = null;
      const notes = [];
      const tracksWithNotes = new Set();

      for (let t = 0; t < ntracks && p < d.byteLength; t++) {
        if (str(4) !== 'MTrk') break;
        const len = u32();
        const end = p + len;
        let tick = 0, running = 0;
        const open = new Map(); // key channel*128+note -> {start, vel}

        while (p < end) {
          tick += vlq();
          let status = d.getUint8(p);
          if (status & 0x80) p++; else status = running;

          if (status === 0xff) {
            const type = d.getUint8(p++);
            const mlen = vlq();
            if (type === 0x51 && bpm == null) {
              const mpq = (d.getUint8(p) << 16) | (d.getUint8(p + 1) << 8) | d.getUint8(p + 2);
              bpm = Math.round(60000000 / mpq);
            } else if (type === 0x58 && !timeSig) {
              timeSig = [d.getUint8(p), Math.pow(2, d.getUint8(p + 1))];
            } else if (type === 0x03 && !name && mlen > 0) {
              const save = p; name = str(mlen).trim(); p = save;
            }
            p += mlen;
            continue;
          }
          if (status === 0xf0 || status === 0xf7) { p += vlq(); continue; }

          running = status;
          const cmd = status & 0xf0, ch = status & 0x0f;
          if (cmd === 0xc0 || cmd === 0xd0) { p += 1; continue; }
          const a = d.getUint8(p++), b = d.getUint8(p++);
          if (ch === 9) continue; // skip drums
          const key = ch * 128 + a;
          if (cmd === 0x90 && b > 0) {
            if (open.has(key)) close(key, tick);
            open.set(key, { start: tick, vel: b / 127 });
          } else if (cmd === 0x80 || (cmd === 0x90 && b === 0)) {
            if (open.has(key)) close(key, tick);
          }

          function close(k, endTick) {
            const o = open.get(k);
            open.delete(k);
            const dur = Math.max(endTick - o.start, ppq / 16);
            notes.push({ note: k % 128, start: o.start / ppq, dur: dur / ppq, vel: o.vel, track: t });
            tracksWithNotes.add(t);
          }
        }
        open.forEach((o, k) => notes.push({ note: k % 128, start: o.start / ppq, dur: 1, vel: o.vel, track: t }));
        p = end;
      }

      if (!notes.length) throw new Error('No notes found in this MIDI file');

      // Hand assignment: two+ note tracks -> highest-average track is right hand; else split at middle C.
      const tracks = [...tracksWithNotes];
      if (tracks.length >= 2) {
        const avg = {};
        tracks.forEach((t) => {
          const ns = notes.filter((n) => n.track === t);
          avg[t] = ns.reduce((s, n) => s + n.note, 0) / ns.length;
        });
        const sorted = tracks.sort((x, y) => avg[y] - avg[x]);
        notes.forEach((n) => { n.hand = n.track === sorted[0] ? 'R' : 'L'; });
      } else {
        notes.forEach((n) => { n.hand = n.note >= 60 ? 'R' : 'L'; });
      }

      notes.sort((x, y) => x.start - y.start || x.note - y.note);
      const first = notes[0].start;
      const shift = Math.floor(first); // trim leading silence to whole beats
      notes.forEach((n) => { n.start -= shift; delete n.track; });

      return {
        id: 'midi-' + Date.now(),
        title: title || name || 'Imported MIDI',
        composer: 'Imported file',
        level: 'Custom',
        bpm: bpm || 100,
        timeSig: timeSig || [4, 4],
        notes,
        format,
      };
    },
  };
})();
