// Music theory practice games: steps, intervals, scales, chords, quizzes, dynamics.
(function () {
  const L = PL.Lessons, T = PL.Theory, G = L.GAMES;
  const { N, nm, pick, staff, playSeq, shuffle, chips, rounds } = L.h;
  const kb = () => PL.App.kb;
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const ORD = { 1: 'unison', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th', 8: 'octave' };
  const ord = (k) => ORD[k] || k + 'th';
  const WH = [];
  for (let n = 36; n <= 96; n++) if (!T.isBlack(n)) WH.push(n);

  const key = (s) => ({ note: N(s), letter: 'CDEFGAB'.indexOf(s[0]) }); // 'Bb3'
  const kname = (s) => T.nameLA('CDEFGAB'.indexOf(s[0]), s[1] === '#' ? 1 : s[1] === 'b' ? -1 : 0);
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11, 12],
    'natural minor': [0, 2, 3, 5, 7, 8, 10, 12],
    'harmonic minor': [0, 2, 3, 5, 7, 8, 11, 12],
  };
  const CHORDS = {
    major: [[0, 0], [4, 2], [7, 4]],
    minor: [[0, 0], [3, 2], [7, 4]],
    diminished: [[0, 0], [3, 2], [6, 4]],
    'dominant 7th': [[0, 0], [4, 2], [7, 4], [10, 6]],
  };
  Object.assign(L.h, { key, kname, SCALES, CHORDS, ord });

  G.step = (body, cfg, progress, done) => rounds(body, {
    count: cfg.count,
    make(i, api) {
      const semis = pick(cfg.kinds), up = pick(cfg.dirs) === 'up', start = rnd(57, 72), target = start + (up ? semis : -semis);
      const kind = semis === 1 ? 'half step' : 'whole step';
      const bothWhite = !T.isBlack(start) && !T.isBlack(target);
      return {
        prompt: `Play a <b>${kind} ${up ? 'up →' : '← down'}</b> from the glowing key <b>${nm(start)}</b>`,
        stage: `<div class="muted">${semis === 1 ? 'Half step = the very next key, black or white.' : 'Whole step = two half steps (skip one key).'}</div>`,
        start: () => kb().hint(start),
        onNote(ev) {
          if (ev.type !== 'on' || ev.note === start) return;
          if (ev.note === target) return api.correct(`${nm(start)} → ${nm(target, { preferFlat: !up })}${semis === 1 && bothWhite ? ' — no black key between these two!' : ''}`);
          const d = ev.note - start;
          api.wrong(`That is ${Math.abs(d)} half step${Math.abs(d) === 1 ? '' : 's'} ${d > 0 ? 'up' : 'down'}. A ${kind} is ${semis}.`);
        },
        onWrong: (n) => { if (n >= 2) kb().hint([start, target]); },
        reveal: () => nm(target, { preferFlat: !up }),
      };
    },
  }, progress, done);

  G.intervalPlay = (body, cfg, progress, done) => rounds(body, {
    count: cfg.count,
    make(i, api) {
      const size = pick(cfg.sizes), start = pick(WH.filter((n) => n >= 60 && n <= 67)), si = WH.indexOf(start), target = WH[si + size - 1];
      const count = WH.slice(si, si + size).map((n, k) => `${k + 1} ${nm(n)}`).join(' · ');
      return {
        prompt: `Play a <b>${ord(size)}</b> up from the glowing <b>${nm(start)}</b> (white keys)`,
        stage: `<div class="muted">Count the letter names — ${nm(start)} is number 1.</div>`,
        start: () => kb().hint(start),
        onNote(ev) {
          if (ev.type !== 'on' || ev.note === start) return;
          if (ev.note === target) return api.correct(count);
          const j = WH.indexOf(ev.note);
          const what = j < 0 ? 'a black key — use white keys here' : j > si ? `a ${ord(j - si + 1)}` : 'below the start note';
          api.wrong(`That is ${what}.${api.tries >= 1 ? ` Count: ${count}` : ''}`);
        },
        onWrong: (n) => { if (n >= 3) kb().hint([start, target]); },
        after: () => { api.stage.innerHTML = staff({ clef: 'treble', stems: false, gapX: 54, notes: [start, target].map((n) => ({ note: n, label: nm(n), color: T.noteColor(n) })) }); },
        reveal: () => nm(target),
        pause: 1800,
      };
    },
  }, progress, done);

  G.scale = (body, cfg, progress, done) => rounds(body, {
    count: cfg.scales.length,
    make(i, api) {
      const [ts, type] = cfg.scales[i];
      const semis = SCALES[type];
      const notes = T.spellFrom(key(ts).note, key(ts).letter, semis.map((s, k) => [s, k]));
      const steps = semis.slice(1).map((s, k) => ({ 1: 'H', 2: 'W', 3: 'W+H' })[s - semis[k]]);
      let pos = 0;
      const draw = () => {
        api.stage.querySelector('.chipwrap').innerHTML = chips(
          notes.map((n, k) => (k <= pos || !cfg.hide ? n.name : '?')),
          notes.map((n, k) => (k < pos ? 'done' : k === pos ? 'now' : '')));
      };
      return {
        prompt: `Play the <b>${kname(ts)} ${type}</b> scale going up — 8 notes`,
        stage: `<div class="chipwrap"></div><div class="muted small">Pattern: ${steps.join(' – ')} &nbsp; (W = whole step, H = half step)</div>`,
        start: () => { draw(); kb().hint(notes[0].note); },
        onNote(ev) {
          if (ev.type !== 'on') return;
          const want = notes[pos];
          if (T.pc(ev.note) === T.pc(want.note)) {
            pos++;
            kb().clearHints();
            if (pos === notes.length) return api.correct(`${kname(ts)} ${type}: ${notes.map((n) => n.name).join(' ')}`);
            draw();
          } else {
            const step = steps[pos - 1];
            api.wrong(`That was ${nm(ev.note)}. Next is a <b>${step === 'H' ? 'half step' : step === 'W' ? 'whole step' : 'step and a half'}</b> up${api.tries >= 1 ? `: <b>${want.name}</b>` : ''}.`);
            if (api.tries >= 2) kb().hint(want.note);
          }
        },
        after: () => playSeq(notes.map((n) => n.note), 0.22, 0.3, 0.2),
        reveal: () => notes.map((n) => n.name).join(' '),
        pause: 2400,
      };
    },
  }, progress, done);

  G.chord = (body, cfg, progress, done) => {
    const items = cfg.shuffle ? shuffle(cfg.items) : cfg.items;
    const INV = ['', '1st inversion', '2nd inversion'];
    return rounds(body, {
      count: Math.min(cfg.count || items.length, items.length),
      make(i, api) {
        const [rs, type, inv = 0, label] = items[i];
        const notes = T.spellFrom(key(rs).note, key(rs).letter, CHORDS[type]);
        const voiced = notes.map((n, k) => n.note + (k < inv ? 12 : 0));
        const need = new Set(notes.map((n) => T.pc(n.note)));
        const title = `${label ? label + ' = ' : ''}${kname(rs)} ${type}`;
        const recipe = { major: '4 then 3', minor: '3 then 4', diminished: '3 then 3', 'dominant 7th': '4, 3, then 3' }[type];
        let lastWrong = '';
        return {
          prompt: `Play <b>${title}</b>${inv ? ` in <b>${INV[inv]}</b> — <b>${notes[inv].name}</b> at the bottom` : ''}. Hold the notes together.`,
          stage: cfg.showNotes ? chips(notes.map((n) => n.name)) : `<div class="muted">Build it: start on ${kname(rs)}, count up ${recipe} half steps.</div>`,
          onNote(ev) {
            if (ev.type !== 'on') return;
            const down = [...PL.Input.down].sort((a, b) => a - b);
            const pcs = new Set(down.map(T.pc));
            if (pcs.size === need.size && [...need].every((p) => pcs.has(p))) {
              if (inv && T.pc(down[0]) !== T.pc(notes[inv].note)) {
                api.fb.innerHTML = `Right notes! Now put <b>${notes[inv].name}</b> at the bottom.`;
                api.fb.className = 'feedback';
                return;
              }
              return api.correct(`${title}: ${notes.map((n) => n.name).join(' – ')}`);
            }
            if (down.length >= need.size && down.join() !== lastWrong) {
              lastWrong = down.join();
              api.wrong(`You are holding ${down.map((n) => nm(n)).join(' ')}. Let go and try again.`);
            }
          },
          onWrong: (n) => { if (n >= 2) kb().hint(voiced); },
          reveal: () => notes.map((n) => n.name).join(' – '),
          after: () => playSeq([voiced], 1, 0.9, 0.3),
          pause: 1500,
        };
      },
    }, progress, done);
  };

  // cfg.items: [{ q, s (stage html), a (answer), wrong: [...], e (explanation) }]
  G.quiz = (body, cfg, progress, done) => {
    const items = shuffle(cfg.items).slice(0, cfg.count || cfg.items.length);
    return rounds(body, {
      count: items.length,
      make(i) {
        const it = items[i];
        const opts = shuffle([it.a, ...shuffle([...new Set(it.wrong)].filter((w) => w !== it.a)).slice(0, 3)]);
        return { prompt: it.q, stage: it.s || '', choices: opts.map((o) => ({ label: o, value: o })), answer: it.a, explain: it.e || it.a, pause: 1700 };
      },
    }, progress, done);
  };

  G.dynamics = (body, cfg, progress, done) => rounds(body, {
    count: cfg.count,
    make(i, api) {
      const LV = { pp: ['very soft', 0, 0.3], p: ['soft', 0, 0.45], mf: ['medium', 0.4, 0.72], f: ['loud', 0.68, 1.01], ff: ['very loud', 0.85, 1.01] };
      const sym = pick(cfg.levels), [word, lo, hi] = LV[sym];
      return {
        prompt: `Play any key <span class="sym dark">${sym}</span> — <b>${word}</b>`,
        stage: `<div class="meter"><div class="zone" style="left:${lo * 100}%;width:${(Math.min(1, hi) - lo) * 100}%"></div><div class="bar"></div></div>
          <div class="muted small">${PL.Input.devices.length ? 'The bar shows how hard you pressed. Aim for the green zone.' : '⚠️ Needs a touch-sensitive MIDI keyboard — computer keys are always the same loudness.'}</div>`,
        onNote(ev) {
          if (ev.type !== 'on') return;
          api.stage.querySelector('.bar').style.width = ev.vel * 100 + '%';
          if (ev.vel >= lo && ev.vel < hi) api.correct(`${sym} = ${word}. You played at ${Math.round(ev.vel * 127)} of 127.`);
          else api.wrong(ev.vel < lo ? 'A bit too soft — press faster and stronger.' : 'Too loud — press more gently.');
        },
        reveal: () => `${sym} means ${word}`,
      };
    },
  }, progress, done);
})();
