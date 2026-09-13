// Unit 4 · Music theory — explanations + practice (games live in theory-games.js).
(function () {
  const L = PL.Lessons, T = PL.Theory;
  const { nm, miniKeys, staff, seqBtn, kname } = L.h;

  const pair = (a, b, cap, col) =>
    `<div style="text-align:center">${miniKeys(60, 65, (n) => (n === a || n === b ? { color: col, label: nm(n) } : null))}<div class="small muted">${cap}</div></div>`;

  function circleSVG() {
    const maj = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
    const min = ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'Bb', 'F', 'C', 'G', 'D'];
    const sig = ['', '1♯', '2♯', '3♯', '4♯', '5♯', '6♯', '5♭', '4♭', '3♭', '2♭', '1♭'];
    const R = 150, c = 170;
    let s = `<svg width="340" height="340" viewBox="0 0 340 340" style="max-width:100%;height:auto" font-family="sans-serif" text-anchor="middle">
      <circle cx="${c}" cy="${c}" r="${R}" fill="#eef1ff" stroke="#999"/><circle cx="${c}" cy="${c}" r="${R * 0.62}" fill="#dfe4f7" stroke="#999"/>
      <circle cx="${c}" cy="${c}" r="${R * 0.3}" fill="#f7f4ea" stroke="#999"/>
      <text x="${c}" y="${c - 4}" font-size="11" fill="#444">major outside</text><text x="${c}" y="${c + 12}" font-size="11" fill="#444">minor inside</text>`;
    maj.forEach((k, i) => {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const P = (r) => [c + Math.cos(a) * r, c + Math.sin(a) * r];
      const [x1, y1] = P(R * 0.8), [x2, y2] = P(R * 0.46);
      s += `<text x="${x1}" y="${y1}" font-size="14" font-weight="700" fill="#111">${kname(k)}</text>
        <text x="${x1}" y="${y1 + 13}" font-size="10" fill="#666">${sig[i]}</text>
        <text x="${x2}" y="${y2 + 4}" font-size="11" fill="#333">${kname(min[i])}m</text>`;
    });
    return `<div class="staff-box">${s}</svg></div>`;
  }

  // ---------- symbols ----------
  const sv = (w, h, inner) => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;
  const hd = (x, y, fill = true) => `<ellipse cx="${x}" cy="${y}" rx="8" ry="6" transform="rotate(-20 ${x} ${y})" fill="${fill ? '#111' : 'none'}" stroke="#111" stroke-width="2"/>`;
  const up = (x, y) => `<line x1="${x + 7}" y1="${y}" x2="${x + 7}" y2="${y - 36}" stroke="#111" stroke-width="2"/>`;
  const dn = (x, y) => `<line x1="${x - 7}" y1="${y}" x2="${x - 7}" y2="${y + 36}" stroke="#111" stroke-width="2"/>`;
  const txt = (t, size = 54) => `<span class="sym" style="font-size:${size}px">${t}</span>`;
  const frac = (a, b) => `<span class="sym" style="font-style:normal;font-size:38px;line-height:.85;display:inline-block">${a}<br>${b}</span>`;
  const SYMBOLS = [
    { s: txt('p'), a: 'soft (piano)' },
    { s: txt('f'), a: 'loud (forte)' },
    { s: txt('mf'), a: 'medium loud (mezzo-forte)' },
    { s: txt('pp'), a: 'very soft (pianissimo)' },
    { s: txt('ff'), a: 'very loud (fortissimo)' },
    { s: sv(170, 50, '<path d="M10 25 L160 8 M10 25 L160 42" stroke="#111" stroke-width="3" fill="none"/>'), a: 'gradually louder (crescendo)' },
    { s: sv(170, 50, '<path d="M10 8 L160 25 L10 42" stroke="#111" stroke-width="3" fill="none"/>'), a: 'gradually softer (diminuendo)' },
    { s: sv(60, 80, hd(20, 60, false) + up(20, 60) + '<circle cx="38" cy="60" r="3" fill="#111"/>'), a: '3 beats (dotted half note)', e: 'A dot adds half the note’s length: 2 + 1 = 3 beats.' },
    { s: sv(120, 80, hd(25, 50) + up(25, 50) + hd(95, 50) + up(95, 50) + '<path d="M28 62 Q60 80 92 62" stroke="#111" stroke-width="2.5" fill="none"/>'), a: 'hold as one long note (tie)', e: 'A tie joins two notes of the SAME pitch: play once, hold for both.' },
    { s: sv(150, 80, hd(22, 58) + up(22, 58) + hd(65, 48) + up(65, 48) + hd(108, 38) + up(108, 38) + '<path d="M18 70 Q70 84 118 52" stroke="#111" stroke-width="2.5" fill="none"/>'), a: 'smooth and connected (legato)', e: 'A slur joins DIFFERENT notes: play them smoothly with no gaps.' },
    { s: sv(60, 80, hd(22, 45) + up(22, 45) + '<circle cx="20" cy="62" r="3.5" fill="#111"/>'), a: 'short and detached (staccato)' },
    { s: sv(70, 80, '<path d="M12 36 Q35 4 58 36" stroke="#111" stroke-width="4" fill="none"/><circle cx="35" cy="30" r="4" fill="#111"/>' + hd(35, 62, false)), a: 'hold longer than written (fermata)' },
    { s: sv(60, 80, hd(30, 22) + dn(30, 22) + '<text x="30" y="78" font-size="24" font-weight="700" text-anchor="middle" font-family="sans-serif">&gt;</text>'), a: 'play this note stronger (accent)' },
    { s: txt('Ped. ✱', 36), a: 'press, then release the sustain pedal' },
    { s: sv(60, 80, [20, 30, 40, 50, 60].map((y) => `<line x1="0" x2="60" y1="${y}" y2="${y}" stroke="#999"/>`).join('') + '<circle cx="22" cy="35" r="3.5"/><circle cx="22" cy="45" r="3.5"/><line x1="34" x2="34" y1="20" y2="60" stroke="#111" stroke-width="2"/><rect x="40" y="20" width="6" height="40"/>'), a: 'go back and play again (repeat)' },
    { s: frac(3, 4), a: '3 beats in each bar (waltz time)' },
    { s: frac(6, 8), a: '6 eighth notes per bar, felt in 2 big beats' },
    { s: txt('Allegro', 40), a: 'fast and lively' },
    { s: txt('Adagio', 40), a: 'slow and calm' },
    { s: txt('rit.', 48), a: 'gradually slow down (ritardando)' },
    { s: txt('rubato', 40), a: 'flexible tempo — stretch and push the time', e: 'Rubato is everywhere in Chopin: some notes linger, others hurry, but the music stays together.' },
    { s: txt('8va', 44), a: 'play one octave higher' },
  ];
  const symbolItems = () => SYMBOLS.map((x) => ({
    q: 'What does this mean in sheet music?', s: `<div class="staff-box">${x.s}</div>`, a: x.a,
    wrong: SYMBOLS.map((y) => y.a), e: x.e ? `${x.a}. ${x.e}` : x.a,
  }));
  const symGrid = (list) => `<div class="symgrid">${list.map((x) => `<div>${x.s}<div>${x.a}</div></div>`).join('')}</div>`;

  // ---------- keys ----------
  const KEYS = [['C', 0], ['G', 1], ['D', 2], ['A', 3], ['E', 4], ['F', -1], ['Bb', -2], ['Eb', -3]];
  const REL = { C: 'A', G: 'E', D: 'B', A: 'F#', E: 'C#', F: 'D', Bb: 'G', Eb: 'C' };
  const sigTxt = (k) => (k === 0 ? 'no ♯ or ♭' : k > 0 ? `${k} ♯` : `${-k} ♭`);
  function keyItems() {
    const items = [];
    KEYS.forEach(([k, n]) => {
      items.push({ q: 'Which <b>major key</b> has this key signature?', s: staff({ clef: 'treble', keySig: n, notes: [], width: 200, space: 14 }),
        a: `${kname(k)} major`, wrong: KEYS.map(([x]) => `${kname(x)} major`), e: `${kname(k)} major has ${sigTxt(n)}.` });
      items.push({ q: `How many sharps or flats does <b>${kname(k)} major</b> have?`, a: sigTxt(n), wrong: KEYS.map(([, m]) => sigTxt(m)), e: `${kname(k)} major: ${sigTxt(n)}.` });
      items.push({ q: `What is the <b>relative minor</b> of ${kname(k)} major?`, a: `${kname(REL[k])} minor`, wrong: Object.values(REL).map((v) => `${kname(v)} minor`),
        e: `${kname(REL[k])} minor — 3 half steps below ${kname(k)}. Same key signature!` });
    });
    return items;
  }
  const sharpOrder = ['F', 'C', 'G', 'D', 'A', 'E', 'B'].map(kname).join(' ');
  const R = [48, 84];

  L.extraUnits.push(() => ({
    key: 'theory',
    title: '4 · Music theory',
    lessons: [
      {
        id: 't1', emoji: '🪜', title: 'Half steps & whole steps', desc: 'The smallest distances in music.', range: R,
        intro: [() => `<h2>Half step & whole step</h2>
          <p>A <b>half step</b> goes to the very next key, black or white. A <b>whole step</b> is two half steps.</p>
          <div class="row" style="justify-content:center;gap:18px">${pair(60, 61, 'Half step', '#ffd93d')}${pair(64, 65, 'Half step — no black key between!', '#ff9f43')}${pair(60, 62, 'Whole step', '#4dc3ff')}</div>
          <div class="tip">Scales, chords and intervals are all built by counting half steps. The glowing key is where you start.</div>`],
        game: { type: 'step', count: 12, kinds: [1, 2], dirs: ['up', 'up', 'down'] },
      },
      {
        id: 't2', emoji: '📐', title: 'Intervals: counting up', desc: '2nds, 3rds, 5ths, octaves.', range: R,
        intro: [() => `<h2>Counting intervals</h2>
          <p>Count the letter names <b>including the first note</b>. From ${nm(60)}: ${nm(60)} = 1, ${nm(62)} = 2, ${nm(64)} = 3. So ${nm(64)} is a <b>3rd</b> above ${nm(60)}.</p>
          ${staff({ clef: 'treble', stems: false, gapX: 40, notes: [[60, ''], [62, '2nd'], [60, ''], [64, '3rd'], [60, ''], [67, '5th'], [60, ''], [72, '8ve']].map(([n, l]) => ({ note: n, label: l, color: T.noteColor(n) })) })}
          <p>On the staff: a <b>3rd</b> is line → next line (or space → next space). A <b>5th</b> skips two lines.</p>
          <p>${seqBtn('2nd', [60, 62])} ${seqBtn('3rd', [60, 64])} ${seqBtn('4th', [60, 65])} ${seqBtn('5th', [60, 67])} ${seqBtn('octave', [60, 72])}</p>`],
        game: { type: 'intervalPlay', count: 12, sizes: [2, 3, 4, 5, 8] },
      },
      {
        id: 't3', emoji: '📈', title: 'The major scale', desc: 'W W H W W W H — the recipe.', range: R,
        intro: [() => `<h2>The major scale recipe</h2>
          <p>A <b>scale</b> is 8 notes going up from a home note. Every major scale uses the same pattern of steps:</p>
          <p style="font-size:22px;text-align:center"><b>W W H W W W H</b></p>
          ${miniKeys(60, 72, (n) => (!T.isBlack(n) ? { color: T.color(n), label: nm(n) } : null))}
          <p>${nm(60)} major uses only white keys. Start on ${nm(67)} and the same recipe needs one black key: <b>${kname('F#')}</b>.</p>
          <p>${seqBtn(nm(60) + ' major', [60, 62, 64, 65, 67, 69, 71, 72], 0.3)} ${seqBtn(nm(67) + ' major', [67, 69, 71, 72, 74, 76, 78, 79], 0.3)}</p>`],
        game: { type: 'scale', scales: [['C4', 'major'], ['G4', 'major'], ['F4', 'major'], ['D4', 'major']] },
      },
      {
        id: 't4', emoji: '🧭', title: 'Keys & key signatures', desc: 'Sharps & flats at the start of the music.', range: R,
        intro: [
          () => `<h2>Key signatures</h2>
            <p>Music in ${nm(67)} major always uses ${kname('F#')}. Instead of writing ♯ every time, it is written <b>once at the start</b> of each line: the <b>key signature</b>. It applies to that note in <b>every octave</b>.</p>
            <div class="row" style="justify-content:center">${staff({ clef: 'treble', keySig: 1, notes: [], width: 170 })}${staff({ clef: 'treble', keySig: -1, notes: [], width: 170 })}</div>
            <p class="muted" style="text-align:center">1♯ = ${kname('G')} major &nbsp;·&nbsp; 1♭ = ${kname('F')} major</p>
            <div class="tip">Sharps are always added in this order: <b>${sharpOrder}</b>. Flats are the reverse.</div>`,
          () => `<h2>The circle of fifths</h2>
            <p>Go clockwise and each key is a <b>5th higher</b> with <b>one more sharp</b>. Go the other way for flats. Every major key shares its signature with a minor key (inside).</p>
            ${circleSVG()}`,
        ],
        game: { type: 'quiz', count: 12, items: keyItems() },
      },
      {
        id: 't5', emoji: '🌙', title: 'Minor scales', desc: 'The sound of Chopin’s preludes.', range: R,
        intro: [() => `<h2>Minor scales</h2>
          <p><b>Natural minor</b>: W H W W H W W. ${kname('A')} minor uses the same white keys as ${nm(60)} major, just starting on ${kname('A')} — it is the <b>relative minor</b>.</p>
          <p><b>Harmonic minor</b> raises the 7th note by a half step. It gives that dramatic, pulling sound — like the ${kname('D#')} in Chopin’s Prelude in ${kname('E')} minor.</p>
          <p>${seqBtn(kname('A') + ' natural minor', [69, 71, 72, 74, 76, 77, 79, 81], 0.3)} ${seqBtn(kname('A') + ' harmonic minor', [69, 71, 72, 74, 76, 77, 80, 81], 0.3)}</p>`],
        game: { type: 'scale', scales: [['A4', 'natural minor'], ['E4', 'natural minor'], ['A4', 'harmonic minor'], ['E4', 'harmonic minor'], ['D4', 'harmonic minor']] },
      },
      {
        id: 't6', emoji: '🎵', title: 'Chords: major & minor', desc: 'Root, 3rd and 5th together.', range: R,
        intro: [() => `<h2>Triads</h2>
          <p>A <b>triad</b> has 3 notes: the <b>root</b>, a <b>3rd</b> and a <b>5th</b> above it — play a white key, skip one, play one, skip one, play one.</p>
          <div class="row" style="justify-content:center">
            <div style="text-align:center">${miniKeys(60, 67, (n) => ([60, 64, 67].includes(n) ? { color: '#6bd66b', label: nm(n) } : null))}<div class="small">Major: <b>4 + 3</b> half steps</div>${seqBtn('hear', [[60, 64, 67]], 1)}</div>
            <div style="text-align:center">${miniKeys(69, 76, (n) => ([69, 72, 76].includes(n) ? { color: '#7c7cff', label: nm(n) } : null))}<div class="small">Minor: <b>3 + 4</b> half steps</div>${seqBtn('hear', [[69, 72, 76]], 1)}</div>
          </div>`],
        game: { type: 'chord', showNotes: true, shuffle: true, items: [['C4', 'major'], ['F4', 'major'], ['G4', 'major'], ['A4', 'minor'], ['D4', 'minor'], ['E4', 'minor']] },
      },
      {
        id: 't7', emoji: '🧩', title: 'Build chords yourself', desc: 'No note names — count half steps.', range: R,
        intro: [() => `<h2>Build any chord</h2>
          <p>Major = root + <b>4</b> + <b>3</b>. Minor = root + <b>3</b> + <b>4</b>. Two more:</p>
          <p><b>Diminished</b> = root + 3 + 3 (tense). <b>Dominant 7th</b> = a major chord + 3 more half steps (it wants to move on).</p>
          <p>${seqBtn('diminished', [[59, 62, 65]], 1)} ${seqBtn('dominant 7th → home', [[55, 59, 62, 65], [48, 52, 55, 60]], 1)}</p>`],
        game: { type: 'chord', showNotes: false, shuffle: true, items: [['C4', 'major'], ['D4', 'major'], ['E4', 'minor'], ['C4', 'minor'], ['G4', 'major'], ['E4', 'major'], ['B3', 'diminished'], ['G3', 'dominant 7th']] },
      },
      {
        id: 't8', emoji: '🔄', title: 'Inversions', desc: 'Same chord, different bottom note.', range: R,
        intro: [() => `<h2>Inversions</h2>
          <p>Move the bottom note of a chord up an octave and you get an <b>inversion</b>. Same notes, different colour — and your hand moves less between chords.</p>
          ${staff({ clef: 'treble', stems: false, gapX: 30, notes: [[60, 'root'], [64, ''], [67, ''], [64, '1st'], [67, ''], [72, ''], [67, '2nd'], [72, ''], [76, '']].map(([n, l]) => ({ note: n, label: l, color: T.noteColor(n) })) })}
          <p>${seqBtn('root → 1st → 2nd', [[60, 64, 67], [64, 67, 72], [67, 72, 76]], 1)} &nbsp; An <b>arpeggio</b> plays the chord one note at a time: ${seqBtn('arpeggio', [48, 55, 60, 64, 67, 72], 0.2)}</p>`],
        game: { type: 'chord', showNotes: true, items: [['C4', 'major', 0], ['C4', 'major', 1], ['C4', 'major', 2], ['F4', 'major', 1], ['G4', 'major', 2], ['A4', 'minor', 1]] },
      },
      {
        id: 't9', emoji: '🔁', title: 'Chord progressions', desc: 'I – IV – V – I, the backbone of music.', range: R,
        intro: [() => `<h2>I – IV – V – I</h2>
          <p>Build a chord on each step of the scale and number it with Roman numerals. The chords on steps <b>1, 4 and 5</b> are the most important. Played in order, they sound like a complete sentence.</p>
          <p>${seqBtn(`I – IV – V – I in ${nm(60)}`, [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]], 0.9)}
             ${seqBtn(`i – iv – V – i in ${kname('A')} minor`, [[57, 60, 64], [62, 65, 69], [64, 68, 71], [57, 60, 64]], 0.9)}</p>
          <div class="tip">Lowercase numerals (i, iv) mean minor chords. In minor keys the V chord is usually major.</div>`],
        game: {
          type: 'chord', showNotes: true, items: [
            ['C4', 'major', 0, 'I in C'], ['F4', 'major', 0, 'IV in C'], ['G4', 'major', 0, 'V in C'], ['C4', 'major', 0, 'I in C'],
            ['G4', 'major', 0, 'I in G'], ['C4', 'major', 0, 'IV in G'], ['D4', 'major', 0, 'V in G'], ['G4', 'major', 0, 'I in G'],
            ['A3', 'minor', 0, 'i in A minor'], ['D4', 'minor', 0, 'iv in A minor'], ['E4', 'major', 0, 'V in A minor'], ['A3', 'minor', 0, 'i in A minor'],
          ],
        },
      },
      {
        id: 't10', emoji: '📜', title: 'Symbols in sheet music', desc: 'Loud, soft, short, long, tempo words.', range: R,
        intro: [
          () => `<h2>How loud, how long</h2>${symGrid(SYMBOLS.slice(0, 13))}`,
          () => `<h2>Pedal, repeats, time & tempo</h2>${symGrid(SYMBOLS.slice(13))}`,
        ],
        game: { type: 'quiz', count: 14, items: symbolItems() },
      },
      {
        id: 't11', emoji: '💪', title: 'Soft and loud with your fingers', desc: 'Control dynamics on your MIDI keyboard.', range: R,
        intro: [() => `<h2>Dynamics come from speed</h2>
          <p>A piano plays louder when the key goes down <b>faster</b> — not by pressing harder after it is down. Your MIDI keyboard measures this speed (0–127).</p>
          <div class="tip">For <b>p</b>, let your finger fall gently from close to the key. For <b>f</b>, drop from higher with a relaxed arm.</div>`],
        game: { type: 'dynamics', count: 10, levels: ['p', 'f', 'mf', 'p', 'f'] },
      },
    ],
  }));
})();
