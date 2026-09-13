// Lessons: keyboard geography, note names, reading the staff, beat & rhythm.
(function () {
  const T = PL.Theory;
  const L = (PL.Lessons = {});
  const WHITE_PC = [0, 2, 4, 5, 7, 9, 11];
  const BLACK_PC = [1, 3, 6, 8, 10];
  const BLACK_SHIFT = { 1: -0.12, 3: 0.12, 6: -0.15, 8: 0, 10: 0.15 };

  function N(s) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
    return (+m[3] + 1) * 12 + base + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  const whites = (a, b) => { const o = []; for (let n = N(a); n <= N(b); n++) if (!T.isBlack(n)) o.push(n); return o; };
  const pick = (arr, not) => { let x; do { x = arr[Math.floor(Math.random() * arr.length)]; } while (arr.length > 1 && x === not); return x; };
  const nm = (n, o) => T.name(n, o);

  // ---------- pictures for explanations ----------
  function miniKeys(from, to, mark) {
    const ww = 30, wh = 110, bw = 18, bh = 68;
    const ws = [];
    for (let n = from; n <= to; n++) if (!T.isBlack(n)) ws.push(n);
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ws.length * ww + 2}" height="${wh + 2}" style="max-width:100%;height:auto">`;
    ws.forEach((n, i) => {
      const m = mark(n);
      svg += `<rect x="${i * ww + 1}" y="1" width="${ww}" height="${wh}" rx="3" fill="${m ? m.color : '#fff'}" stroke="#555"/>`;
      if (m && m.label) svg += `<text x="${i * ww + 1 + ww / 2}" y="${wh - 8}" font-size="11" font-weight="700" text-anchor="middle" fill="#111" font-family="sans-serif">${m.label}</text>`;
    });
    for (let n = from; n <= to; n++) {
      if (!T.isBlack(n)) continue;
      const idx = ws.filter((w) => w < n).length;
      const cx = idx * ww + BLACK_SHIFT[T.pc(n)] * ww + 1;
      const m = mark(n);
      svg += `<rect x="${cx - bw / 2}" y="1" width="${bw}" height="${bh}" rx="2" fill="${m ? m.color : '#222'}" stroke="#000"/>`;
      if (m && m.label) svg += `<text x="${cx}" y="${bh - 6}" font-size="9" font-weight="700" text-anchor="middle" fill="#fff" font-family="sans-serif">${m.label}</text>`;
    }
    return `<div class="staff-box" style="background:#2a2d3d">${svg}</div>`;
  }
  const staff = (opts) => `<div class="staff-box" style="max-width:100%;overflow-x:auto">${T.staffSVG(opts)}</div>`;
  const labeled = (ns, clef) => staff({ clef, stems: false, gapX: 40, notes: ns.map((n) => ({ note: n, label: nm(n), color: T.noteColor(n) })) });
  L.extraUnits = []; // builders added by theory-lessons.js / ear.js
  L.h = { N, whites, pick, nm, miniKeys, staff, labeled, WHITE_PC, BLACK_PC };

  // ---------- lesson catalogue ----------
  // Rebuilt whenever the note-name setting changes, so titles use the right names.
  L.refresh = function () {
  L.units = [
    {
      title: '1 · Find your way on the keyboard',
      lessons: [
        {
          id: 'k1', emoji: '🗺️', title: 'Meet the keyboard', desc: 'Black keys are your map. Find every C / Do.',
          range: [48, 84],
          intro: [
            () => `<h2>The keyboard has a pattern</h2><p>Look at the <b>black keys</b>. They come in groups of <b style="color:#4dc3ff">2</b> and <b style="color:#ff9f43">3</b>, again and again.</p>
              ${miniKeys(48, 71, (n) => (T.isBlack(n) ? { color: [1, 3].includes(T.pc(n)) ? '#4dc3ff' : '#ff9f43' } : null))}
              <div class="tip">The same 12 keys repeat all along the piano. Learn one group and you know the whole piano.</div>`,
            () => `<h2>${nm(60)} is left of the 2 black keys</h2><p>Every white key just <b>left of a group of 2 black keys</b> is <b>${T.name(60, { naming: 'both' })}</b>.</p>
              ${miniKeys(48, 71, (n) => (T.pc(n) === 0 ? { color: T.color(n), label: nm(n) } : null))}
              <div class="tip">The ${nm(60)} in the middle of your keyboard is called <b>middle ${nm(60)}</b>. It has a small blue dot ● on the keyboard below.</div>`,
          ],
          game: { type: 'findAll', pc: 0 },
        },
        {
          id: 'k2', emoji: '🔴', title: `${nm(60)} ${nm(62)} ${nm(64)}`, desc: 'The three white keys around the 2 black keys.',
          range: [48, 84],
          intro: [() => `<h2>Around the 2 black keys</h2>
            ${miniKeys(48, 64, (n) => ([0, 2, 4].includes(T.pc(n)) ? { color: T.color(n), label: nm(n) } : null))}
            <p><b>${nm(60)}</b> left of the 2 black keys · <b>${nm(62)}</b> between them · <b>${nm(64)}</b> right of them.</p>
            <div class="tip">Each note has its own colour. The same colour appears on the keyboard, the falling notes and the sheet music.</div>`],
          game: { type: 'find', pool: [0, 2, 4], count: 12 },
        },
        {
          id: 'k3', emoji: '🌈', title: `${nm(65)} ${nm(67)} ${nm(69)} ${nm(71)}`, desc: 'The four white keys around the 3 black keys.',
          range: [48, 84],
          intro: [() => `<h2>Around the 3 black keys</h2>
            ${miniKeys(48, 72, (n) => (!T.isBlack(n) ? { color: [5, 7, 9, 11].includes(T.pc(n)) ? T.color(n) : '#fff', label: nm(n) } : null))}
            <p><b>${nm(65)}</b> is left of the 3 black keys, then <b>${nm(67)} ${nm(69)} ${nm(71)}</b>. After ${nm(71)} comes ${nm(60)} again.</p>
            <div class="tip">The order is always: ${WHITE_PC.map((p) => nm(60 + p)).join(' → ')} → ${nm(60)}…</div>`],
          game: { type: 'find', pool: [5, 7, 9, 11], count: 12 },
        },
        {
          id: 'k4', emoji: '⚪', title: 'All white keys', desc: 'Mixed practice — get fast!',
          range: [48, 84], intro: [], game: { type: 'find', pool: WHITE_PC, count: 20 },
        },
        {
          id: 'k5', emoji: '⚫', title: 'Black keys: ♯ and ♭', desc: 'Sharp = one key up, flat = one key down.',
          range: [48, 84],
          intro: [() => `<h2>Sharp ♯ and flat ♭</h2>
            <p><b>♯ sharp</b> = the key just to the <b>right</b> (higher). <b>♭ flat</b> = the key just to the <b>left</b> (lower).</p>
            ${miniKeys(60, 71, (n) => (T.isBlack(n) ? { color: '#5b6fc0', label: nm(n) } : { color: '#fff', label: nm(n) }))}
            <div class="tip">${nm(61)} and ${nm(61, { preferFlat: true })} are the <b>same key</b> — two names for one black key.</div>`],
          game: { type: 'find', pool: BLACK_PC, count: 12, spellBoth: true },
        },
      ],
    },
    {
      title: '2 · Read sheet music',
      lessons: [
        {
          id: 's1', emoji: '🎼', title: 'The staff & treble clef', desc: 'Five lines. Higher on paper = further right on the keys.',
          range: [48, 84],
          intro: [
            () => `<h2>The staff: 5 lines</h2><p>Music is written on <b>5 lines</b>. Notes sit <b>on a line</b> or <b>in a space</b> between lines.
              Each step up (line → space → line) is the <b>next white key to the right</b>.</p>${labeled(whites('C4', 'C5'), 'treble')}
              <div class="tip">Higher on the page = higher sound = further right on the keyboard.</div>`,
            () => `<h2>The treble clef 𝄞 — right hand</h2><p>The curly sign at the start is the <b>treble clef</b>. It is usually for your <b>right hand</b>.
              Its curl wraps around the line of <b>${nm(67)}</b>. <b>Middle ${nm(60)}</b> sits on a small extra line below the staff.</p>
              ${staff({ clef: 'treble', stems: false, gapX: 70, notes: [{ note: 60, label: 'middle ' + nm(60), color: T.noteColor(60) }, { note: 67, label: nm(67) + ' line', color: T.noteColor(67) }] })}
              <div class="tip">Now we will show one note. Press that key. Take your time — speed comes later.</div>`,
          ],
          game: { type: 'staff', clef: 'treble', notes: whites('C4', 'G4'), count: 10 },
        },
        { id: 's2', emoji: '🎵', title: `Treble: ${nm(60)} to ${nm(72)}`, desc: 'One full octave on the staff.', range: [48, 84], intro: [], game: { type: 'staff', clef: 'treble', notes: whites('C4', 'C5'), count: 14 } },
        { id: 's3', emoji: '⬆️', title: 'Treble: high notes', desc: 'Up to the top of the staff.', range: [48, 84],
          intro: [() => `<h2>Higher notes</h2><p>The staff keeps going up. The top line is <b>${nm(77)}</b>.</p>${labeled(whites('C5', 'G5'), 'treble')}`],
          game: { type: 'staff', clef: 'treble', notes: whites('C4', 'G5'), count: 16 } },
        {
          id: 's4', emoji: '🎶', title: 'The bass clef 𝄢 — left hand', desc: 'The lower staff, for your left hand.',
          range: [36, 72],
          intro: [() => `<h2>The bass clef 𝄢</h2><p>The bass clef is for <b>low notes</b>, usually your <b>left hand</b>. Its two dots sit around the line of <b>${nm(53)}</b>.
            Middle ${nm(60)} is now on a small extra line <b>above</b> the staff.</p>${labeled(whites('C3', 'C4'), 'bass')}
            <div class="tip">Same idea as before: step up the staff = next white key to the right.</div>`],
          game: { type: 'staff', clef: 'bass', notes: whites('C3', 'C4'), count: 12 },
        },
        { id: 's5', emoji: '⬇️', title: 'Bass: low notes', desc: 'Down to the bottom of the bass staff.', range: [36, 72], intro: [], game: { type: 'staff', clef: 'bass', notes: whites('F2', 'C4'), count: 16 } },
        {
          id: 's6', emoji: '🎹', title: 'Grand staff: both hands', desc: 'Real piano music uses both staves together.',
          range: [36, 84],
          intro: [() => `<h2>The grand staff</h2><p>Piano music joins the two staves: <b>treble on top (right hand)</b>, <b>bass below (left hand)</b>. Middle ${nm(60)} sits between them.</p>
            ${staff({ clef: 'grand', stems: false, gapX: 46, notes: [48, 52, 55, 60, 64, 67, 72].map((n) => ({ note: n, label: nm(n), color: T.noteColor(n) })) })}`],
          game: { type: 'staff', clef: 'grand', notes: whites('C3', 'C5'), count: 20 },
        },
        {
          id: 's7', emoji: '♯', title: 'Sharps & flats on the staff', desc: '♯ and ♭ signs next to notes.',
          range: [48, 84],
          intro: [() => `<h2>♯ and ♭ on the staff</h2><p>A <b>♯</b> or <b>♭</b> before a note moves it one key right or left — usually onto a black key.</p>
            ${staff({ clef: 'treble', stems: false, gapX: 56, notes: [[60, 0], [61, 0], [62, 0], [63, 1], [64, 0]].map(([n, f]) => ({ note: n, preferFlat: !!f, label: nm(n, { preferFlat: !!f }) })) })}`],
          game: { type: 'staff', clef: 'treble', notes: Array.from({ length: 13 }, (_, i) => 60 + i), count: 14, spellBoth: true },
        },
      ],
    },
    {
      title: '3 · Rhythm & tempo',
      lessons: [
        {
          id: 'r1', emoji: '🥁', title: 'Feel the beat', desc: 'Play exactly with the click.',
          range: [48, 72],
          intro: [() => `<h2>Beat and tempo</h2><p>The <b>beat</b> is the steady pulse of music — like walking: left, right, left, right.</p>
            <p><b>Tempo</b> is how fast the beat goes, measured in <b>BPM</b> (beats per minute). 60 BPM = one beat per second.</p>
            <div class="tip">You will hear 4 clicks to count you in (4-3-2-1). Then press <b>any key</b> exactly on every click.</div>`],
          game: { type: 'beat', bpm: 70, bars: 4 },
        },
        {
          id: 'r2', emoji: '🧠', title: 'Keep the beat alone', desc: 'The click stops — can you stay in tempo?',
          range: [48, 72],
          intro: [() => `<h2>Your own inner clock</h2><p>Great pianists feel the tempo inside. The click will <b>disappear after 2 bars</b>. Keep pressing at the same speed!</p>
            <div class="tip">Count out loud: “1, 2, 3, 4”. It really helps.</div>`],
          game: { type: 'beat', bpm: 80, bars: 4, fadeAfter: 2 },
        },
        {
          id: 'r3', emoji: '📏', title: 'How long is a note?', desc: 'Whole, half and quarter notes.',
          range: [48, 72],
          intro: [() => `<h2>Note lengths</h2><p>The <b>shape</b> of a note tells you how many beats it lasts. Say the word while you play:</p>
            <div class="row" style="justify-content:space-around;margin:16px 0">
              ${[['whole', '4 beats', 'ta-a-a-a'], ['half', '2 beats', 'ta-a'], ['quarter', '1 beat', 'ta'], ['eighth-pair', '½ + ½', 'ti-ti'], ['quarter-rest', '1 beat silent', 'shh']]
                .map(([g, b, w]) => `<div style="text-align:center">${T.rhythmSVG(g, 44)}<div><b>${w}</b></div><div class="muted small">${b}</div></div>`).join('')}
            </div>
            <p>The <b>4/4</b> at the start of music means <b>4 beats in every bar</b>. Bars are separated by vertical lines.</p>
            <div class="tip">First you <b>listen</b> to the rhythm, then it is <b>your turn</b>. Press on each note, hold it for its length.</div>`],
          game: { type: 'rhythm', bpm: 70, patterns: [['q', 'q', 'q', 'q'], ['h', 'h'], ['q', 'q', 'h'], ['w'], ['h', 'q', 'q'], ['q', 'r', 'q', 'r'], ['q', 'h', 'q']] },
        },
        {
          id: 'r4', emoji: '🐇', title: 'Eighth notes', desc: 'Two quick notes in one beat: ti-ti.',
          range: [48, 72], intro: [],
          game: { type: 'rhythm', bpm: 70, patterns: [['e', 'e', 'q', 'q'], ['q', 'e', 'q', 'e'], ['e', 'q', 'e', 'q'], ['h', 'e', 'e'], ['e', 'e', 'e', 'e'], ['q', 'r', 'e', 'q']] },
        },
        {
          id: 'r5', emoji: '⚡', title: 'Faster tempo', desc: 'Same rhythms at 100 BPM.',
          range: [48, 72], intro: [],
          game: { type: 'rhythm', bpm: 100, patterns: [['q', 'e', 'e', 'h'], ['e', 'e', 'h', 'q'], ['q', 'q', 'e', 'e', 'q'], ['h', 'r', 'q'], ['e', 'e', 'e', 'e', 'h']] },
        },
      ],
    },
  ];
  L.extraUnits.forEach((build) => L.units.push(build()));
  L.all = L.units.flatMap((u) => u.lessons);
  L.byId = Object.fromEntries(L.all.map((l) => [l.id, l]));
  };
  L.refresh();

  // ---------- games ----------
  // Each game: (body, cfg, progress(0..1), done(score 0..1, html)) -> cleanup
  const GAMES = (L.GAMES = {});

  GAMES.find = function (body, cfg, progress, done) {
    const kb = PL.App.kb;
    let i = 0, errors = 0, wrongThis = 0, target = null, lock = false;
    const t0 = performance.now();
    body.innerHTML = `<div class="prompt">Find this key (any one works):</div><div class="bn"></div><div class="feedback"></div>`;
    const bn = body.querySelector('.bn'), fb = body.querySelector('.feedback');
    function next() {
      const pc = pick(cfg.pool, target && target.pc);
      target = { pc, flat: cfg.spellBoth && Math.random() < 0.5 };
      wrongThis = 0; kb.clearHints(); lock = false;
      const n = 60 + pc;
      const both = T.settings.naming === 'both';
      bn.innerHTML = `<span class="bignote" style="background:${T.settings.colors ? T.color(n) : '#dfe4ff'};font-size:${both ? 40 : 56}px">${nm(n, { preferFlat: target.flat })}</span>`;
      fb.textContent = ''; fb.className = 'feedback';
    }
    const off = PL.Input.on((ev) => {
      if (ev.type !== 'on' || lock) return;
      if (T.pc(ev.note) === target.pc) {
        kb.flash(ev.note, 'good'); i++; progress(i / cfg.count);
        fb.textContent = '✓ ' + ['Yes!', 'Great!', 'Correct!', 'Nice!'][i % 4]; fb.className = 'feedback good';
        lock = true;
        if (i >= cfg.count) {
          const secs = (performance.now() - t0) / 1000 / cfg.count;
          setTimeout(() => done(cfg.count / (cfg.count + errors), `${errors} mistake${errors === 1 ? '' : 's'} · ${secs.toFixed(1)} s per note`), 300);
        } else setTimeout(next, 350);
      } else {
        errors++; wrongThis++; kb.flash(ev.note, 'bad');
        fb.innerHTML = `That was <b>${nm(ev.note)}</b>. Try again.`; fb.className = 'feedback bad';
        if (wrongThis >= 2) { kb.hint(Array.from({ length: 128 }, (_, n) => n).filter((n) => T.pc(n) === target.pc)); fb.innerHTML += ' The glowing keys are the answer.'; }
      }
    });
    next();
    return off;
  };

  GAMES.findAll = function (body, cfg, progress, done) {
    const kb = PL.App.kb;
    const targets = [];
    for (let n = kb.low; n <= kb.high; n++) if (T.pc(n) === cfg.pc) targets.push(n);
    const found = new Set();
    let errors = 0;
    body.innerHTML = `<div class="prompt">Press <b>every</b> <span class="bignote" style="height:64px;min-width:70px;font-size:32px;background:${T.color(60 + cfg.pc)}">${nm(60 + cfg.pc)}</span> on the keyboard below</div>
      <div class="prompt muted">Look for the groups of <b>2 black keys</b>.</div><div class="count prompt"></div><div class="feedback"></div>`;
    const cnt = body.querySelector('.count'), fb = body.querySelector('.feedback');
    const upd = () => (cnt.textContent = `${found.size} of ${targets.length} found`);
    upd();
    const off = PL.Input.on((ev) => {
      if (ev.type !== 'on') return;
      if (targets.includes(ev.note)) {
        if (!found.has(ev.note)) { found.add(ev.note); kb.flash(ev.note, 'good', 600); }
        fb.textContent = found.size === targets.length ? '🎉 All found!' : '✓ Yes! Find the next one.'; fb.className = 'feedback good';
        upd(); progress(found.size / targets.length);
        if (found.size === targets.length) setTimeout(() => done(targets.length / (targets.length + errors), `${errors} wrong key${errors === 1 ? '' : 's'}`), 500);
      } else if (T.pc(ev.note) === cfg.pc) {
        fb.textContent = 'That one is outside the keyboard picture — use the keys shown below.';
      } else {
        errors++; kb.flash(ev.note, 'bad');
        fb.innerHTML = `That was <b>${nm(ev.note)}</b>.`; fb.className = 'feedback bad';
        if (errors >= 3) kb.hint(targets.filter((n) => !found.has(n)));
      }
    });
    return off;
  };

  GAMES.staff = function (body, cfg, progress, done) {
    const kb = PL.App.kb;
    let i = 0, errors = 0, wrongThis = 0, target = null, lock = false;
    const t0 = performance.now();
    body.innerHTML = `<div class="prompt">Which key is this note? Press it.</div><div class="st"></div><div class="feedback"></div>`;
    const st = body.querySelector('.st'), fb = body.querySelector('.feedback');
    const clefOf = (n) => (cfg.clef === 'grand' ? (n >= 60 ? 'treble' : 'bass') : cfg.clef);
    function draw(reveal) {
      const note = { note: target.note, preferFlat: target.flat };
      if (reveal) { note.label = nm(target.note, { preferFlat: target.flat }); note.color = T.noteColor(target.note); }
      st.innerHTML = staff({ clef: cfg.clef, space: 16, width: 300, gapX: 60, notes: [note] });
    }
    function next() {
      let n = pick(cfg.notes, target && target.note);
      target = { note: n, flat: cfg.spellBoth && T.isBlack(n) && Math.random() < 0.5 };
      wrongThis = 0; lock = false; kb.clearHints(); draw(false);
      fb.textContent = ''; fb.className = 'feedback';
    }
    const off = PL.Input.on((ev) => {
      if (ev.type !== 'on' || lock) return;
      if (ev.note === target.note) {
        kb.flash(ev.note, 'good'); i++; progress(i / cfg.count); draw(true); lock = true;
        fb.innerHTML = `✓ Yes — that is <b>${nm(ev.note, { preferFlat: target.flat })}</b>`; fb.className = 'feedback good';
        if (i >= cfg.count) {
          const secs = (performance.now() - t0) / 1000 / cfg.count;
          setTimeout(() => done(cfg.count / (cfg.count + errors), `${Math.round(errors)} mistake${errors === 1 ? '' : 's'} · ${secs.toFixed(1)} s per note`), 700);
        } else setTimeout(next, 800);
        return;
      }
      wrongThis++; kb.flash(ev.note, 'bad');
      if (T.pc(ev.note) === T.pc(target.note)) {
        errors += 0.5;
        fb.innerHTML = `Right name (<b>${nm(ev.note)}</b>) but wrong place — go ${ev.note < target.note ? 'higher → right' : 'lower ← left'}. Use middle ${nm(60)} ● as your landmark.`;
      } else {
        errors++;
        fb.innerHTML = `You pressed <b>${nm(ev.note)}</b>. The note is ${ev.note < target.note ? 'higher → to the right' : 'lower ← to the left'}.`;
      }
      fb.className = 'feedback bad';
      if (wrongThis >= 2) { kb.hint(target.note); draw(true); }
    });
    next();
    return off;
  };

  GAMES.beat = function (body, cfg, progress, done) {
    const kb = PL.App.kb;
    const total = cfg.bars * 4, spb = 60 / cfg.bpm;
    let raf = 0, presses = [], running = false, t0 = 0, timer = 0;
    body.innerHTML = `<div class="prompt">Press <b>any key</b> on every beat · ${cfg.bpm} BPM</div>
      <div class="prompt count" style="font-size:40px;font-weight:800;min-height:60px"></div>
      <div class="beats">${Array.from({ length: total }, (_, k) => `<div class="beat" data-k="${k}">${(k % 4) + 1}${cfg.fadeAfter && k >= cfg.fadeAfter * 4 ? '<small>no click</small>' : ''}</div>`).join('')}</div>
      <div class="timing-line"><div class="center"></div></div>
      <div class="timing-labels"><span>← too early</span><span>on time</span><span>too late →</span></div>
      <div class="feedback"></div>
      <button class="btn primary big" data-start>▶ Start</button>`;
    const countEl = body.querySelector('.count'), fb = body.querySelector('.feedback'), line = body.querySelector('.timing-line');
    const beatEls = [...body.querySelectorAll('.beat')];
    const off = PL.Input.on((ev) => {
      if (ev.type === 'on' && running) { const ctx = PL.Audio.init(); presses.push(ctx.currentTime - (ctx.outputLatency || 0)); }
    });
    body.querySelector('[data-start]').onclick = (e) => {
      e.target.hidden = true;
      const ctx = PL.Audio.init();
      presses = []; running = true;
      line.querySelectorAll('.mark').forEach((m) => m.remove());
      beatEls.forEach((b) => (b.className = 'beat'));
      t0 = ctx.currentTime + 0.4;
      for (let k = 0; k < 4 + total; k++) {
        const silent = cfg.fadeAfter && k - 4 >= cfg.fadeAfter * 4;
        if (!silent) PL.Audio.click(k % 4 === 0, t0 + k * spb);
      }
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const beatF = (ctx.currentTime - t0) / spb;
        countEl.textContent = beatF >= 0 && beatF < 4 ? 4 - Math.floor(beatF) : beatF >= 4 ? '' : 'Ready…';
        const k = Math.floor(beatF - 4 + 0.5);
        beatEls.forEach((b, j) => b.classList.toggle('now', j === k));
        progress(Math.max(0, Math.min(1, (beatF - 4) / total)));
      };
      tick();
      timer = setTimeout(evaluate, (0.4 + (4 + total + 0.6) * spb) * 1000);
    };
    function evaluate() {
      running = false; cancelAnimationFrame(raf);
      let pts = 0; const offs = [];
      const used = new Set();
      for (let k = 0; k < total; k++) {
        const tb = t0 + (4 + k) * spb;
        let best = -1;
        presses.forEach((p, j) => { if (!used.has(j) && Math.abs(p - tb) < spb / 2 && (best < 0 || Math.abs(p - tb) < Math.abs(presses[best] - tb))) best = j; });
        const el = beatEls[k];
        el.classList.remove('now');
        if (best < 0) { el.classList.add('hit-bad'); continue; }
        used.add(best);
        const d = presses[best] - tb; offs.push(d);
        const a = Math.abs(d);
        if (a < 0.07) { pts += 1; el.classList.add('hit-good'); } else if (a < 0.14) { pts += 0.6; el.classList.add('hit-ok'); } else { pts += 0.2; el.classList.add('hit-bad'); }
        const m = document.createElement('div');
        m.className = 'mark'; m.style.left = Math.max(1, Math.min(99, 50 + (d / 0.25) * 50)) + '%';
        line.appendChild(m);
      }
      const extra = Math.max(0, presses.length - used.size);
      const score = Math.max(0, (pts - extra * 0.25) / total);
      const avg = offs.length ? offs.reduce((s, x) => s + x, 0) / offs.length : 0;
      const tendency = !offs.length ? 'No presses heard — is your keyboard connected?' : avg > 0.04 ? 'You are a little <b>late</b> on average — press together with the click.' : avg < -0.04 ? 'You are <b>rushing</b> a little — wait for the click.' : 'Your timing is right in the middle. 👏';
      fb.innerHTML = tendency; fb.className = 'feedback';
      setTimeout(() => done(score, `${Math.round(avg * 1000)} ms average ${avg >= 0 ? 'late' : 'early'} · ${extra} extra press${extra === 1 ? '' : 'es'}<br>${tendency}`), 1800);
    }
    return () => { off(); cancelAnimationFrame(raf); clearTimeout(timer); running = false; kb.clearHints(); };
  };

  GAMES.rhythm = function (body, cfg, progress, done) {
    const LEN = { w: 4, h: 2, q: 1, e: 0.5, r: 1 };
    const GLYPH = { w: ['whole', 'ta-a-a-a'], h: ['half', 'ta-a'], q: ['quarter', 'ta'], e: ['eighth', 'ti'], r: ['quarter-rest', 'shh'] };
    const spb = 60 / cfg.bpm;
    let round = 0, scoreSum = 0, raf = 0, timers = [], presses = [], listening = false, retried = false;
    body.innerHTML = `<div class="prompt phase"></div><div class="row glyphs" style="justify-content:center;gap:18px;min-height:110px;margin:16px 0"></div>
      <div class="prompt count" style="font-size:36px;font-weight:800;min-height:50px"></div><div class="feedback"></div>
      <div class="row" style="justify-content:center"><button class="btn" data-again hidden>👂 Listen again</button><button class="btn primary big" data-go>▶ Start</button></div>`;
    const phase = body.querySelector('.phase'), glyphs = body.querySelector('.glyphs'), countEl = body.querySelector('.count'), fb = body.querySelector('.feedback');
    const goBtn = body.querySelector('[data-go]'), againBtn = body.querySelector('[data-again]');
    const off = PL.Input.on((ev) => { if (ev.type === 'on' && listening) { const c = PL.Audio.init(); presses.push(c.currentTime - (c.outputLatency || 0)); } });

    function layout(pat) {
      let b = 0;
      return pat.map((tok) => { const o = { tok, beat: b, len: LEN[tok] }; b += LEN[tok]; return o; });
    }
    function showPattern() {
      const items = layout(cfg.patterns[round]);
      glyphs.innerHTML = items.map((it, j) => `<div data-j="${j}" style="text-align:center;padding:6px 8px;border-radius:12px">${T.rhythmSVG(GLYPH[it.tok][0], 46)}<div><b>${GLYPH[it.tok][1]}</b></div></div>`).join('') +
        `<div class="muted small" style="align-self:center">4 beats</div>`;
      return items;
    }
    function play(demo) {
      const ctx = PL.Audio.init();
      const items = layout(cfg.patterns[round]);
      const t0 = ctx.currentTime + 0.3;
      for (let k = 0; k < 8; k++) PL.Audio.click(k % 4 === 0, t0 + k * spb);
      if (demo) items.forEach((it) => { if (it.tok !== 'r') PL.Audio.play(67, it.len * spb * 0.9, 0.8, t0 + (4 + it.beat) * spb); });
      presses = []; listening = !demo;
      phase.innerHTML = demo ? '👂 <b>Listen</b> to the rhythm' : '🎹 <b>Your turn!</b> Play it on any key';
      const els = [...glyphs.children];
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const bf = (ctx.currentTime - t0) / spb;
        countEl.textContent = bf >= 0 && bf < 4 ? 4 - Math.floor(bf) : '';
        items.forEach((it, j) => { els[j].style.background = bf - 4 >= it.beat && bf - 4 < it.beat + it.len ? 'rgba(124,156,255,.3)' : ''; });
      };
      tick();
      return new Promise((res) => timers.push(setTimeout(() => { cancelAnimationFrame(raf); res({ t0, items }); }, (0.3 + 8.4 * spb) * 1000)));
    }
    function judge({ t0, items }) {
      listening = false;
      const expect = items.filter((it) => it.tok !== 'r');
      const used = new Set();
      let pts = 0;
      const els = [...glyphs.children];
      expect.forEach((it) => {
        const tb = t0 + (4 + it.beat) * spb;
        let best = -1;
        presses.forEach((p, j) => { if (!used.has(j) && Math.abs(p - tb) < Math.min(0.25, spb * 0.3) && (best < 0 || Math.abs(p - tb) < Math.abs(presses[best] - tb))) best = j; });
        const el = els[items.indexOf(it)];
        if (best < 0) { el.style.background = 'rgba(255,93,108,.35)'; return; }
        used.add(best);
        const a = Math.abs(presses[best] - tb);
        pts += a < 0.08 ? 1 : a < 0.16 ? 0.7 : 0.4;
        el.style.background = a < 0.08 ? 'rgba(62,207,142,.35)' : 'rgba(255,200,87,.35)';
      });
      const extra = presses.length - used.size;
      return Math.max(0, (pts - extra * 0.3) / expect.length);
    }
    async function runRound() {
      goBtn.hidden = true; againBtn.hidden = true; fb.textContent = '';
      showPattern();
      progress(round / cfg.patterns.length);
      await play(true);
      const res = await play(false);
      const sc = judge(res);
      fb.className = 'feedback ' + (sc >= 0.7 ? 'good' : 'bad');
      if (sc < 0.7 && !retried) {
        retried = true;
        fb.textContent = 'Not quite — watch the colours, then try once more.';
        goBtn.textContent = '⟲ Try again'; goBtn.hidden = false; againBtn.hidden = false;
        return;
      }
      fb.textContent = sc >= 0.9 ? '✓ Perfect rhythm!' : sc >= 0.7 ? '✓ Good!' : 'Moving on — you will get it next time.';
      scoreSum += sc; round++; retried = false;
      progress(round / cfg.patterns.length);
      if (round >= cfg.patterns.length) { timers.push(setTimeout(() => done(scoreSum / cfg.patterns.length, `${cfg.patterns.length} rhythms at ${cfg.bpm} BPM`), 1200)); return; }
      goBtn.textContent = 'Next rhythm →'; goBtn.hidden = false;
    }
    goBtn.onclick = runRound;
    againBtn.onclick = async () => { againBtn.hidden = true; goBtn.hidden = true; await play(true); goBtn.hidden = false; againBtn.hidden = false; };
    phase.innerHTML = `Rhythm 1 of ${cfg.patterns.length}`;
    showPattern();
    return () => { off(); cancelAnimationFrame(raf); timers.forEach(clearTimeout); listening = false; };
  };

  // ---------- runner ----------
  L.mount = function (main, id) {
    const les = L.byId[id];
    if (!les) { PL.App.go('learn'); return null; }
    const kb = PL.App.kb;
    kb.setRange(les.range[0], les.range[1]);
    main.innerHTML = `<div class="lesson">
      <div class="top"><button class="btn" data-back>← Back</button><b>${les.emoji} ${les.title}</b><div class="progressbar"><div></div></div></div>
      <div class="lbody"></div></div>`;
    const body = main.querySelector('.lbody'), bar = main.querySelector('.progressbar > div');
    const pages = les.intro || [];
    let p = 0, cleanupGame = null;
    const progress = (f) => (bar.style.width = f * 100 + '%');

    function intro() {
      if (p >= pages.length) return start();
      progress(0);
      body.innerHTML = `<div class="explain">${pages[p]()}</div>
        <div class="row" style="justify-content:center;margin-top:18px">
          ${p > 0 ? '<button class="btn" data-prev>← Previous</button>' : ''}
          <button class="btn primary big" data-next>${p === pages.length - 1 ? "Let's practise →" : 'Next →'}</button></div>`;
    }
    function start() {
      if (cleanupGame) cleanupGame();
      kb.clearHints();
      cleanupGame = GAMES[les.game.type](body, les.game, progress, finish);
    }
    function finish(score, detail) {
      if (cleanupGame) { cleanupGame(); cleanupGame = null; }
      kb.clearHints();
      const stars = score >= 0.9 ? 3 : score >= 0.75 ? 2 : score >= 0.5 ? 1 : 0;
      PL.App.setStars('lesson:' + id, stars);
      PL.Audio.chime(stars > 0);
      const idx = L.all.indexOf(les);
      const next = L.all[idx + 1];
      const msg = ['Keep trying — every mistake teaches your fingers something.', 'You passed! Practise again for more stars.', 'Very good!', 'Perfect! 🏆'][stars];
      body.innerHTML = `<div class="card" style="max-width:460px;margin:20px auto">
        <div class="stars" style="font-size:44px">${'★'.repeat(stars)}<span class="off">${'★'.repeat(3 - stars)}</span></div>
        <div class="result-big">${Math.round(score * 100)}%</div>
        <p>${msg}</p><p class="muted small">${detail || ''}</p>
        <div class="row" style="justify-content:center">
          <button class="btn" data-retry>⟲ Again</button>
          ${next ? `<button class="btn primary" data-nextlesson="${next.id}">Next: ${next.title} →</button>` : `<button class="btn primary" data-songs>🎼 Play songs →</button>`}
        </div></div>`;
      progress(1);
    }
    main.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      PL.Audio.init();
      if (t.hasAttribute('data-back')) PL.App.go('learn');
      else if (t.hasAttribute('data-next')) { p++; intro(); }
      else if (t.hasAttribute('data-prev')) { p--; intro(); }
      else if (t.hasAttribute('data-retry')) start();
      else if (t.dataset.nextlesson) PL.App.go('learn', t.dataset.nextlesson);
      else if (t.hasAttribute('data-songs')) PL.App.go('songs');
    });
    intro();
    return () => { if (cleanupGame) cleanupGame(); kb.clearHints(); };
  };
})();
