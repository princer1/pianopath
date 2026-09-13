// Song library. Each hand is a string of tokens: NOTE/beats (C4/1, F#4/0.5, Bb3/2), chords with + (C3+E3+G3/2), rests r/1.
// "|" is only a visual bar separator.
(function () {
  const BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function parseNote(s) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(s);
    if (!m) throw new Error('Bad note ' + s);
    return { n: (+m[3] + 1) * 12 + BASE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0), flat: m[2] === 'b' };
  }
  function build(meta) {
    const notes = [];
    [['R', meta.right], ['L', meta.left]].forEach(([hand, str]) => {
      if (!str) return;
      let beat = 0;
      str.split(/\s+/).filter((t) => t && t !== '|').forEach((tok) => {
        const [p, d] = tok.split('/');
        const dur = +d;
        if (p !== 'r') p.split('+').forEach((nn) => {
          const { n, flat } = parseNote(nn);
          notes.push({ note: n, start: beat, dur, hand, vel: 0.75, flat });
        });
        beat += dur;
      });
    });
    const { right, left, ...rest } = meta;
    return { ...rest, notes };
  }

  const minuetA = 'D5/1 G4/0.5 A4/0.5 B4/0.5 C5/0.5 | D5/1 G4/1 G4/1 | E5/1 C5/0.5 D5/0.5 E5/0.5 F#5/0.5 | G5/1 G4/1 G4/1 | C5/1 D5/0.5 C5/0.5 B4/0.5 A4/0.5 | B4/1 C5/0.5 B4/0.5 A4/0.5 G4/0.5 |';
  const minuetL = 'G3/3 | B3/3 | C4/3 | B3/3 | A3/3 | G3/3 |';

  PL.Songs = {
    build,
    levels: { 1: 'First steps · right hand', 2: 'Both hands', 3: 'Classical pieces', 4: 'Chopin' },
    list: [
      build({
        id: 'scale-c', title: 'C major scale', composer: 'Warm-up · right hand, then left', level: 1, bpm: 80, timeSig: [4, 4],
        right: 'C4/1 D4/1 E4/1 F4/1 | G4/1 A4/1 B4/1 C5/1 | B4/1 A4/1 G4/1 F4/1 | E4/1 D4/1 C4/2 | r/16',
        left: 'r/16 | C3/1 D3/1 E3/1 F3/1 | G3/1 A3/1 B3/1 C4/1 | B3/1 A3/1 G3/1 F3/1 | E3/1 D3/1 C3/2',
      }),
      build({
        id: 'hot-cross-buns', title: 'Hot Cross Buns', composer: 'Traditional', level: 1, bpm: 90, timeSig: [4, 4],
        right: 'E4/1 D4/1 C4/2 | E4/1 D4/1 C4/2 | C4/0.5 C4/0.5 C4/0.5 C4/0.5 D4/0.5 D4/0.5 D4/0.5 D4/0.5 | E4/1 D4/1 C4/2',
      }),
      build({
        id: 'mary', title: 'Mary Had a Little Lamb', composer: 'Traditional', level: 1, bpm: 96, timeSig: [4, 4],
        right: 'E4/1 D4/1 C4/1 D4/1 | E4/1 E4/1 E4/2 | D4/1 D4/1 D4/2 | E4/1 G4/1 G4/2 | E4/1 D4/1 C4/1 D4/1 | E4/1 E4/1 E4/1 E4/1 | D4/1 D4/1 E4/1 D4/1 | C4/4',
      }),
      build({
        id: 'twinkle', title: 'Twinkle Twinkle Little Star', composer: 'Traditional', level: 2, bpm: 90, timeSig: [4, 4],
        right: 'C4/1 C4/1 G4/1 G4/1 | A4/1 A4/1 G4/2 | F4/1 F4/1 E4/1 E4/1 | D4/1 D4/1 C4/2 | G4/1 G4/1 F4/1 F4/1 | E4/1 E4/1 D4/2 | G4/1 G4/1 F4/1 F4/1 | E4/1 E4/1 D4/2 | C4/1 C4/1 G4/1 G4/1 | A4/1 A4/1 G4/2 | F4/1 F4/1 E4/1 E4/1 | D4/1 D4/1 C4/2',
        left: 'C3/4 | F3/2 C3/2 | G3/2 C3/2 | G3/2 C3/2 | C3/2 F3/2 | C3/2 G3/2 | C3/2 F3/2 | C3/2 G3/2 | C3/4 | F3/2 C3/2 | G3/2 C3/2 | G3/2 C3/2',
      }),
      build({
        id: 'ode-to-joy', title: 'Ode to Joy', composer: 'Beethoven · simplified', level: 2, bpm: 100, timeSig: [4, 4],
        right: 'E4/1 E4/1 F4/1 G4/1 | G4/1 F4/1 E4/1 D4/1 | C4/1 C4/1 D4/1 E4/1 | E4/1.5 D4/0.5 D4/2 | E4/1 E4/1 F4/1 G4/1 | G4/1 F4/1 E4/1 D4/1 | C4/1 C4/1 D4/1 E4/1 | D4/1.5 C4/0.5 C4/2',
        left: 'C3/4 | G2/4 | C3/4 | G2/4 | C3/4 | G2/4 | C3/4 | G2/2 C3/2',
      }),
      build({
        id: 'minuet-g', title: 'Minuet in G', composer: 'Petzold (from Bach’s notebook) · simplified left hand', level: 3, bpm: 100, timeSig: [3, 4], keySig: 1,
        right: minuetA + ' F#4/1 G4/0.5 A4/0.5 B4/0.5 G4/0.5 | A4/3 | ' + minuetA + ' A4/1 B4/0.5 A4/0.5 G4/0.5 F#4/0.5 | G4/3',
        left: minuetL + ' D3/3 | D3/3 | ' + minuetL + ' D3/3 | G2/3',
      }),
      build({
        id: 'fur-elise', title: 'Für Elise (opening)', composer: 'Beethoven', level: 3, bpm: 60, timeSig: [3, 8],
        right: 'r/1 E5/0.25 D#5/0.25 | E5/0.25 D#5/0.25 E5/0.25 B4/0.25 D5/0.25 C5/0.25 | A4/0.5 r/0.25 C4/0.25 E4/0.25 A4/0.25 | B4/0.5 r/0.25 E4/0.25 G#4/0.25 B4/0.25 | C5/0.5 r/0.25 E4/0.25 E5/0.25 D#5/0.25 | E5/0.25 D#5/0.25 E5/0.25 B4/0.25 D5/0.25 C5/0.25 | A4/0.5 r/0.25 C4/0.25 E4/0.25 A4/0.25 | B4/0.5 r/0.25 E4/0.25 C5/0.25 B4/0.25 | A4/1.5',
        left: 'r/1.5 | r/1.5 | A2/0.25 E3/0.25 A3/0.25 r/0.75 | E2/0.25 E3/0.25 G#3/0.25 r/0.75 | A2/0.25 E3/0.25 A3/0.25 r/0.75 | r/1.5 | A2/0.25 E3/0.25 A3/0.25 r/0.75 | E2/0.25 E3/0.25 G#3/0.25 r/0.75 | A2/0.25 E3/0.25 A3/0.5',
      }),
      build({
        id: 'chopin-prelude-4-easy', title: 'Prelude in E minor, Op. 28 No. 4', composer: 'Chopin · easy arrangement (melody + simple chords)', level: 4, bpm: 56, timeSig: [4, 4], keySig: 1,
        right: 'B4/4 | C5/1.5 B4/0.5 B4/2 | B4/4 | C5/1.5 B4/0.5 B4/2 | B4/2 A#4/1 B4/1 | C5/1.5 B4/0.5 A4/2 | A4/4 | B4/1.5 A4/0.5 A4/2 | B4/2 G4/1 F#4/1 | E4/4',
        left: 'E3+G3+B3/2 E3+G3+B3/2 | E3+A3+C4/2 E3+G3+B3/2 | D#3+F#3+B3/2 D#3+F#3+B3/2 | E3+A3+C4/2 E3+G3+B3/2 | E3+G3+B3/2 D#3+F#3+B3/2 | E3+A3+C4/2 D#3+F#3+A3/2 | D#3+F#3+A3/2 D#3+F#3+A3/2 | D#3+F#3+B3/2 D#3+F#3+A3/2 | E3+G3+B3/2 D#3+F#3+A3/2 | E3+G3+B3/4',
      }),
    ],
  };
})();
