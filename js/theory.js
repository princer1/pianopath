// Music theory helpers: note names (letters / Do-Re-Mi), colors, and staff drawing.
(function () {
  const T = (PL.Theory = {});
  T.settings = { naming: 'letters', colors: true };

  T.LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  T.SOLFEGE = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
  // pitch class -> [letter index, accidental] (sharp spelling / flat spelling)
  const SHARP = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]];
  const FLAT = [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [4, -1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]];
  // One color per letter (rainbow order) — black keys get the color of the note below, darker.
  T.LETTER_COLORS = ['#ff5a5f', '#ff9f43', '#ffd93d', '#6bd66b', '#4dc3ff', '#7c7cff', '#d17cff'];

  T.pc = (n) => ((n % 12) + 12) % 12;
  T.octave = (n) => Math.floor(n / 12) - 1;
  T.isBlack = (n) => [1, 3, 6, 8, 10].includes(T.pc(n));

  T.spell = function (n, preferFlat) {
    const [letter, acc] = (preferFlat ? FLAT : SHARP)[T.pc(n)];
    // B# / Cb edge cases don't occur with these tables; octave from letter
    return { letter, acc, octave: T.octave(n) };
  };
  T.staffPos = function (n, preferFlat) {
    const s = T.spell(n, preferFlat);
    return s.octave * 7 + s.letter;
  };

  const accSym = (acc) => (acc > 0 ? '♯'.repeat(acc) : acc < 0 ? '♭'.repeat(-acc) : '');

  // Name from a letter index (0 = C) and accidental (-1 flat, +1 sharp).
  T.nameLA = function (letter, acc, mode) {
    mode = mode || T.settings.naming;
    const Ln = T.LETTERS[letter] + accSym(acc), S = T.SOLFEGE[letter] + accSym(acc);
    return mode === 'letters' ? Ln : mode === 'both' ? S + ' · ' + Ln : S;
  };
  // Correctly spelled scale/chord notes. steps: [[semitones, letter steps], ...]
  T.spellFrom = function (root, rootLetter, steps) {
    const NAT = [0, 2, 4, 5, 7, 9, 11];
    return steps.map(([semi, ls]) => {
      const note = root + semi, letter = (rootLetter + ls) % 7;
      const acc = ((T.pc(note) - NAT[letter] + 18) % 12) - 6;
      return { note, letter, acc, name: T.nameLA(letter, acc) };
    });
  };

  // Name of a note in the chosen system. mode: 'letters' | 'solfege' | 'both'
  T.name = function (n, opts = {}) {
    const mode = opts.naming || T.settings.naming;
    const s = T.spell(n, opts.preferFlat);
    const L = T.LETTERS[s.letter] + accSym(s.acc);
    const S = T.SOLFEGE[s.letter] + accSym(s.acc);
    let out = mode === 'letters' ? L : mode === 'both' ? S + ' · ' + L : S;
    if (opts.octave) out += T.octave(n);
    return out;
  };
  T.letterName = (letterIdx, mode) => {
    mode = mode || T.settings.naming;
    if (mode === 'letters') return T.LETTERS[letterIdx];
    if (mode === 'both') return T.SOLFEGE[letterIdx] + ' · ' + T.LETTERS[letterIdx];
    return T.SOLFEGE[letterIdx];
  };
  T.color = function (n) {
    const s = T.spell(n);
    return T.LETTER_COLORS[s.letter];
  };
  T.noteColor = (n) => (T.settings.colors ? T.color(n) : '#7c9cff');

  // ---------- keys ----------
  const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6], FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3]; // letter indexes: F C G D A E B / B E A D G C F
  // Accidental per letter (C..B) in a key signature: sf > 0 sharps, sf < 0 flats.
  T.keyAccidentals = function (sf) {
    const a = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < Math.min(7, Math.abs(sf)); i++) a[(sf > 0 ? SHARP_ORDER : FLAT_ORDER)[i]] = sf > 0 ? 1 : -1;
    return a;
  };
  // Spell a note the way it would be written in a key. Returns { letter, acc, octave, pos (staff position) }.
  T.spellInKey = function (note, sf, preferFlat) {
    const NAT = [0, 2, 4, 5, 7, 9, 11];
    const ka = T.keyAccidentals(sf);
    const pc = T.pc(note);
    const options = [];
    for (let l = 0; l < 7; l++) {
      const acc = ((pc - NAT[l] + 18) % 12) - 6;
      if (Math.abs(acc) <= 1) options.push({ letter: l, acc });
    }
    const wantFlat = sf < 0 || (sf === 0 && preferFlat);
    const pick = options.find((o) => o.acc === ka[o.letter]) || options.find((o) => o.acc === 0) ||
      options.find((o) => o.acc === (wantFlat ? -1 : 1)) || options[0];
    const octave = Math.floor((note - pick.acc) / 12) - 1;
    return { letter: pick.letter, acc: pick.acc, octave, pos: octave * 7 + pick.letter };
  };
  // Best-matching key signature for a set of notes (Krumhansl–Schmuckler key profiles).
  T.detectKey = function (notes) {
    const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
    const MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
    const SF = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5]; // major key signature by tonic pitch class
    const h = new Array(12).fill(0);
    notes.forEach((n) => (h[T.pc(n.note)] += Math.min(4, n.dur || 1)));
    const mean = (a) => a.reduce((s, x) => s + x, 0) / 12;
    const corr = (prof, r) => {
      const hm = mean(h), pm = mean(prof);
      let num = 0, dh = 0, dp = 0;
      for (let i = 0; i < 12; i++) {
        const x = h[i] - hm, y = prof[(i - r + 12) % 12] - pm;
        num += x * y; dh += x * x; dp += y * y;
      }
      return dh && dp ? num / Math.sqrt(dh * dp) : 0;
    };
    let best = { score: -2, sf: 0 };
    for (let r = 0; r < 12; r++) {
      const ma = corr(MAJ, r), mi = corr(MIN, r);
      if (ma > best.score) best = { score: ma, sf: SF[r] };
      if (mi > best.score) best = { score: mi, sf: SF[(r + 3) % 12] };
    }
    return best.sf;
  };

  // ---------- staff SVG (for lessons) ----------
  const TOP = { treble: 38, bass: 26 };   // F5 / A3 top line
  const MID = { treble: 34, bass: 22 };   // B4 / D3 middle line
  const BOT = { treble: 30, bass: 18 };   // E4 / G2 bottom line
  T.STAFF = { TOP, MID, BOT };

  // Clefs drawn as paths (music-symbol fonts are unreliable). Units: staff space = 10, top line at y = 0.
  T.CLEF = {
    treble: { stroke: 'M17 52 L13 -8 C12 -15 21 -17 21 -8 C21 2 3 12 3 26 C3 37 14 41 21 36 C27 31 24 21 16 21 C9 21 8 30 15 33', dots: [[10, 54, 3.4]] },
    bass: { stroke: 'M5 10 C4 1 22 -3 24 11 C25 25 13 35 3 41', dots: [[6, 10, 3.6], [30, 6, 1.9], [30, 14, 1.9]] },
  };
  T.clefSVG = function (c, x, top, s) {
    const d = T.CLEF[c];
    return `<g transform="translate(${x} ${top}) scale(${s / 10})"><path d="${d.stroke}" fill="none" stroke="#222" stroke-width="2.6" stroke-linecap="round"/>` +
      d.dots.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#222"/>`).join('') + '</g>';
  };
  T.drawClef = function (ctx, c, x, top, s) {
    const d = T.CLEF[c];
    ctx.save();
    ctx.translate(x, top); ctx.scale(s / 10, s / 10);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.stroke(new Path2D(d.stroke));
    ctx.fillStyle = '#111';
    d.dots.forEach(([cx, cy, r]) => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); });
    ctx.restore();
  };

  /**
   * opts: { clef: 'treble'|'bass'|'grand', notes: [{note, color, preferFlat, label, clef}],
   *         space (px between lines), gapX, width, stems, highlightIndex }
   */
  T.staffSVG = function (opts) {
    const s = opts.space || 14;
    const clef = opts.clef || 'treble';
    const notes = opts.notes || [];
    const ks = opts.keySig || 0; // +n sharps / -n flats
    const padL = s * 4 + Math.abs(ks) * s * 0.85;
    const gapX = opts.gapX || s * 4;
    const width = opts.width || Math.max(s * 12, padL + s * 2 + notes.length * gapX);
    const staves = clef === 'grand' ? ['treble', 'bass'] : [clef];
    const top = {};
    top[staves[0]] = s * 4;
    if (staves[1]) top.bass = s * 4 + s * 4 + s * 5;
    const last = staves[staves.length - 1];
    const labelSpace = notes.some((n) => n.label) ? s * 2 : 0;
    const height = top[last] + s * 4 + s * 4 + labelSpace;
    const y = (pos, c) => top[c] + (TOP[c] - pos) * (s / 2);

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    staves.forEach((c) => {
      for (let i = 0; i < 5; i++) {
        const ly = top[c] + i * s;
        svg += `<line x1="${s * 0.5}" x2="${width - s * 0.5}" y1="${ly}" y2="${ly}" stroke="#222" stroke-width="1.3"/>`;
      }
      svg += T.clefSVG(c, s * 0.8, top[c], s);
      const SH = [38, 35, 39, 36, 33, 37, 34], FL = [34, 37, 33, 36, 32, 35, 31]; // treble staff positions
      for (let k = 0; k < Math.abs(ks); k++) {
        const p = (ks > 0 ? SH : FL)[k] - (c === 'bass' ? 14 : 0);
        svg += `<text x="${s * 3.6 + k * s * 0.85}" y="${y(p, c) + s * 0.45}" font-size="${s * 1.5}" fill="#222">${ks > 0 ? '♯' : '♭'}</text>`;
      }
    });
    if (staves.length === 2) {
      svg += `<line x1="${s * 0.5}" x2="${s * 0.5}" y1="${top.treble}" y2="${top.bass + s * 4}" stroke="#222" stroke-width="2"/>`;
    }

    // bands: [{ low, high, color, label?, from?, to? }] — shaded note range (e.g. what a hand position reaches);
    // from/to are note indexes to limit it horizontally.
    (opts.bands || []).forEach((b) => {
      const c = b.clef || (clef === 'grand' ? (b.low >= 60 ? 'treble' : 'bass') : clef);
      const yt = y(T.staffPos(b.high) + 1.2, c), yb = y(T.staffPos(b.low) - 1.2, c);
      const x0 = b.from == null ? padL : padL + s * 1.5 + b.from * gapX - gapX * 0.45;
      const x1 = b.to == null ? width - s * 0.5 : padL + s * 1.5 + b.to * gapX + gapX * 0.45;
      svg += `<rect x="${x0}" y="${yt}" width="${x1 - x0}" height="${yb - yt}" rx="${s * 0.5}" fill="${b.color}"/>`;
      if (b.label) svg += `<text x="${(x0 + x1) / 2}" y="${yt - s * 0.3}" font-size="${s * 0.9}" text-anchor="middle" fill="#333" font-weight="700" font-family="sans-serif">${b.label}</text>`;
    });

    notes.forEach((n, i) => {
      const c = n.clef || (clef === 'grand' ? (n.note >= 60 ? 'treble' : 'bass') : clef);
      const pos = T.staffPos(n.note, n.preferFlat);
      const x = padL + s * 1.5 + i * gapX;
      const ny = y(pos, c);
      const rx = s * 0.66, ry = s * 0.48;
      // ledger lines
      for (let p = BOT[c] - 2; p >= pos; p -= 2) svg += `<line x1="${x - s * 1.1}" x2="${x + s * 1.1}" y1="${y(p, c)}" y2="${y(p, c)}" stroke="#222" stroke-width="1.3"/>`;
      for (let p = TOP[c] + 2; p <= pos; p += 2) svg += `<line x1="${x - s * 1.1}" x2="${x + s * 1.1}" y1="${y(p, c)}" y2="${y(p, c)}" stroke="#222" stroke-width="1.3"/>`;
      if (opts.highlightIndex === i) svg += `<rect x="${x - s * 1.6}" y="${s * 0.5}" width="${s * 3.2}" height="${height - s - labelSpace}" rx="${s * 0.6}" fill="rgba(124,156,255,.18)"/>`;
      const sp = T.spell(n.note, n.preferFlat);
      if (sp.acc) svg += `<text x="${x - s * 1.85}" y="${ny + s * 0.45}" font-size="${s * 1.5}" fill="#222">${accSym(sp.acc)}</text>`;
      const fill = n.color || '#1a1a1a';
      svg += `<ellipse cx="${x}" cy="${ny}" rx="${rx}" ry="${ry}" transform="rotate(-20 ${x} ${ny})" fill="${fill}" stroke="#111" stroke-width="1.4"/>`;
      if (opts.stems !== false) {
        if (pos < MID[c]) svg += `<line x1="${x + rx - 1}" x2="${x + rx - 1}" y1="${ny - 2}" y2="${ny - s * 3.4}" stroke="#111" stroke-width="1.6"/>`;
        else svg += `<line x1="${x - rx + 1}" x2="${x - rx + 1}" y1="${ny + 2}" y2="${ny + s * 3.4}" stroke="#111" stroke-width="1.6"/>`;
      }
      if (n.label) svg += `<text x="${x}" y="${height - s * 0.5}" font-size="${s * 1.05}" text-anchor="middle" fill="#333" font-weight="700" font-family="sans-serif">${n.label}</text>`;
    });
    return svg + '</svg>';
  };

  // Note-value glyphs for rhythm lessons (inline SVG). type: whole|half|quarter|eighth|eighth-pair|quarter-rest
  T.rhythmSVG = function (type, size = 48) {
    const w = type === 'eighth-pair' ? size * 1.3 : size * 0.8, h = size * 1.4;
    const hx = size * 0.28, hy = h - size * 0.3, rx = size * 0.2, ry = size * 0.14;
    const head = (cx, filled) => `<ellipse cx="${cx}" cy="${hy}" rx="${rx}" ry="${ry}" transform="rotate(-20 ${cx} ${hy})" fill="${filled ? '#eef0f6' : 'none'}" stroke="#eef0f6" stroke-width="${size * 0.05}"/>`;
    const stem = (cx) => `<line x1="${cx + rx - 1}" x2="${cx + rx - 1}" y1="${hy}" y2="${size * 0.15}" stroke="#eef0f6" stroke-width="${size * 0.05}"/>`;
    let body = '';
    if (type === 'whole') body = head(w / 2, false);
    if (type === 'half') body = head(hx, false) + stem(hx);
    if (type === 'quarter') body = head(hx, true) + stem(hx);
    if (type === 'eighth') body = head(hx, true) + stem(hx) + `<path d="M${hx + rx - 1} ${size * 0.15} q ${size * 0.35} ${size * 0.25} ${size * 0.18} ${size * 0.6}" stroke="#eef0f6" stroke-width="${size * 0.06}" fill="none"/>`;
    if (type === 'eighth-pair') {
      const x2 = hx + size * 0.7;
      body = head(hx, true) + stem(hx) + head(x2, true) + stem(x2) +
        `<line x1="${hx + rx - 1}" x2="${x2 + rx - 1}" y1="${size * 0.17}" y2="${size * 0.17}" stroke="#eef0f6" stroke-width="${size * 0.12}"/>`;
    }
    if (type === 'quarter-rest') body = `<path d="M${w * 0.4} ${h * 0.2} L${w * 0.62} ${h * 0.42} L${w * 0.42} ${h * 0.58} L${w * 0.64} ${h * 0.78} C${w * 0.4} ${h * 0.7} ${w * 0.3} ${h * 0.85} ${w * 0.5} ${h * 0.95}" fill="none" stroke="#eef0f6" stroke-width="${size * 0.08}" stroke-linejoin="round" stroke-linecap="round"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
  };
})();
