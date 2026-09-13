// Ear training: higher/lower, finding notes by ear, intervals, chord colours, melody echo, scale steps.
(function () {
  const L = PL.Lessons, T = PL.Theory, G = L.GAMES;
  const { nm, pick, miniKeys, playSeq, seqBtn, listen, rounds } = L.h;
  const kb = () => PL.App.kb;
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const lerp = (a, b, i, n) => Math.round(a + (b - a) * (n > 1 ? i / (n - 1) : 0));

  // Song hooks for each interval (going up), by number of half steps.
  const IV = {
    1: ['Minor 2nd', 'Jaws theme'],
    2: ['Major 2nd', 'Frère Jacques'],
    3: ['Minor 3rd', 'Greensleeves'],
    4: ['Major 3rd', 'When the Saints Go Marching In'],
    5: ['Perfect 4th', 'Here Comes the Bride'],
    6: ['Tritone', 'The Simpsons theme'],
    7: ['Perfect 5th', 'Twinkle Twinkle · Star Wars'],
    8: ['Minor 6th', 'The Entertainer'],
    9: ['Major 6th', 'My Bonnie Lies Over the Ocean'],
    10: ['Minor 7th', 'Somewhere (West Side Story)'],
    11: ['Major 7th', 'Take On Me (chorus)'],
    12: ['Octave', 'Somewhere Over the Rainbow'],
  };
  const CH = {
    maj: [[0, 4, 7], 'Major', '😊 bright'],
    min: [[0, 3, 7], 'Minor', '😢 dark'],
    dim: [[0, 3, 6], 'Diminished', '😨 tense'],
    aug: [[0, 4, 8], 'Augmented', '😵 dreamy'],
  };
  Object.assign(L.h, { IV, CH });
  const MAJ = [0, 2, 4, 5, 7, 9, 11];
  const FEEL = ['home', 'restless', 'sweet', 'leaning', 'strong', 'soft', 'pulling up'];
  const FEEL_LONG = ['calm and finished — home', 'restless, wants to step down to 1', 'sweet and stable', 'leaning down to 3', 'strong and open', 'soft, a little sad', 'unfinished — it pulls up to 1'];

  G.highlow = (body, cfg, progress, done) => rounds(body, {
    count: cfg.count,
    make(i) {
      const gap = lerp(cfg.max, cfg.min, i, cfg.count);
      const a = rnd(55, 70), up = Math.random() < 0.5, b = up ? a + gap : a - gap;
      return {
        prompt: 'Two notes. Is the <b>second</b> note higher or lower?',
        stage: listen,
        play: () => playSeq([a, b], 0.9, 0.8),
        choices: [{ label: '⬆ Higher', value: 'up' }, { label: '⬇ Lower', value: 'down' }],
        answer: up ? 'up' : 'down',
        explain: `It went <b>${up ? 'up' : 'down'}</b> ${gap} key${gap > 1 ? 's' : ''}: ${nm(a)} → ${nm(b)}.${gap <= 2 ? ' A tiny step — great ears!' : ''}`,
        after: () => kb().hint([a, b]),
      };
    },
  }, progress, done);

  G.pitch = (body, cfg, progress, done) => rounds(body, {
    count: cfg.count,
    make(i, api) {
      const target = 60 + pick(cfg.pool);
      const anchor = cfg.anchor !== false;
      const play = () => playSeq(anchor ? [60, target] : [target], 1.0, 0.9);
      return {
        prompt: anchor
          ? `First you hear <b>${nm(60)}</b> (your anchor), then a <b>mystery note</b>. Find it on your keyboard.`
          : 'Find this note on your keyboard — no anchor note this time!',
        stage: `${listen}<div class="muted small">It is one of: ${cfg.pool.map((p) => nm(60 + p)).join(' · ')}</div>`,
        play,
        onNote(ev) {
          if (ev.type !== 'on') return;
          if (T.pc(ev.note) === T.pc(target)) return api.correct(`It was <b>${nm(target)}</b>.`);
          const t = target + 12 * Math.round((ev.note - target) / 12);
          api.wrong(`You played <b>${nm(ev.note)}</b> — that is ${ev.note < t ? '<b>too low</b> ⬇, go right →' : '<b>too high</b> ⬆, go left ←'}`);
        },
        onWrong: (n) => { if (n === 2) api.later(play, 800); if (n >= 3) kb().hint(target); },
        skill: 'ear:pitch:' + T.pc(target),
        reveal: () => nm(target),
        after: () => kb().hint(target),
      };
    },
  }, progress, done);

  G.interval = (body, cfg, progress, done) => rounds(body, {
    count: cfg.count,
    make() {
      const s = pick(cfg.pool), a = rnd(55, 64), down = cfg.mixed && Math.random() < 0.35, b = down ? a - s : a + s;
      return {
        prompt: `How far apart are the ${cfg.harmonic ? 'notes played <b>together</b>' : 'two notes'}?`,
        stage: listen,
        play: () => playSeq(cfg.harmonic ? [[a, b]] : [a, b], 0.8, cfg.harmonic ? 1.5 : 0.8),
        choices: cfg.pool.map((v) => ({ label: IV[v][0], sub: IV[v][1], value: v })),
        answer: s,
        skill: 'ear:iv:' + s,
        explain: `${IV[s][0]} — ${s} half step${s > 1 ? 's' : ''} ${down ? 'down' : 'up'} (${nm(a)} → ${nm(b)}). Think: ${IV[s][1]}.`,
        after: () => kb().hint([a, b]),
        pause: 1800,
      };
    },
  }, progress, done);

  G.chordq = (body, cfg, progress, done) => rounds(body, {
    count: cfg.count,
    make() {
      const type = pick(cfg.types), root = rnd(53, 62), notes = CH[type][0].map((x) => root + x);
      return {
        prompt: 'What kind of chord is this?',
        stage: listen,
        play: () => { playSeq([notes], 1, 1.1); playSeq(notes, 0.35, 0.5, 1.4); },
        choices: cfg.types.map((t) => ({ label: CH[t][1], sub: CH[t][2], value: t })),
        answer: type,
        skill: 'ear:chord:' + type,
        explain: `${CH[type][1]} (${CH[type][2]}): ${notes.map((n) => nm(n)).join(' ')}`,
        after: () => kb().hint(notes),
        pause: 1600,
      };
    },
  }, progress, done);

  G.echo = (body, cfg, progress, done) => rounds(body, {
    count: cfg.count,
    make(i, api) {
      const len = lerp(cfg.len[0], cfg.len[1], i, cfg.count);
      let idx = 0;
      const mel = [cfg.notes[0]];
      while (mel.length < len) {
        idx = Math.max(0, Math.min(cfg.notes.length - 1, idx + pick(cfg.moves || [-1, 1, 1, -2, 2])));
        mel.push(cfg.notes[idx]);
      }
      let pos = 0;
      const dots = () => api.stage.querySelectorAll('.beat');
      const reset = () => { pos = 0; dots().forEach((d) => (d.className = 'beat')); kb().hint(mel[0]); };
      const play = () => { reset(); playSeq(mel, 0.6, 0.55); };
      return {
        prompt: `Listen, then <b>play it back</b>. It starts on <b>${nm(mel[0])}</b>.`,
        stage: `${listen}<div class="beats">${mel.map(() => '<div class="beat"></div>').join('')}</div>`,
        play,
        onNote(ev) {
          if (ev.type !== 'on') return;
          if (T.pc(ev.note) === T.pc(mel[pos])) {
            dots()[pos].className = 'beat hit-good';
            pos++;
            kb().clearHints();
            if (pos === mel.length) api.correct('You echoed the whole melody! 🎉');
          } else {
            dots()[pos].className = 'beat hit-bad';
            api.wrong(`That was <b>${nm(ev.note)}</b>. Listen again and start over.`);
            api.later(play, 1100);
          }
        },
        reveal: () => mel.map((n) => nm(n)).join(' '),
        pause: 1400,
      };
    },
  }, progress, done);

  G.degree = (body, cfg, progress, done) => rounds(body, {
    count: cfg.count,
    make() {
      const key = pick(cfg.keys), d = pick(cfg.pool), note = key + 12 + MAJ[d];
      const tri = (r) => [r, r + 4, r + 7];
      return {
        prompt: 'Chords set the <b>home key</b>, then one note plays. Which <b>step of the scale</b> is it?',
        stage: listen,
        play: () => { playSeq([tri(key), tri(key + 5), tri(key + 7), tri(key)], 0.6, 0.55); playSeq([note], 1, 1.1, 2.9); },
        choices: cfg.pool.map((x) => ({ label: `${x + 1} · ${T.SOLFEGE[x]}`, sub: FEEL[x], value: x })),
        answer: d,
        skill: 'ear:deg:' + d,
        explain: `Step ${d + 1} (${T.SOLFEGE[d]}) in ${nm(key)} major — ${FEEL_LONG[d]}.`,
        after: () => { if (d) playSeq([note, key + 12], 0.6, 0.6, 0.3); },
        pause: 2000,
      };
    },
  }, progress, done);

  // ---------- lessons ----------
  const W = [0, 2, 4, 5, 7, 9, 11];
  L.extraUnits.push(() => ({
    key: 'ear',
    title: '5 · Ear training',
    lessons: [
      {
        id: 'e1', emoji: '👂', title: 'Higher or lower?', desc: 'Hear which way the music moves.', range: [48, 84],
        intro: [() => `<h2>Train your ears</h2>
          <p>Your ears can learn music just like your eyes learn to read. <b>5 minutes every day</b> works much better than one long session.</p>
          <p>First skill: is a sound <b>higher</b> 🐦 or <b>lower</b> 🐻? On the piano, higher = further <b>right</b>.</p>
          <div class="tip">Use headphones or a quiet room. Press <kbd>Space</kbd> to hear again and <kbd>1</kbd> <kbd>2</kbd> to answer.</div>`],
        game: { type: 'highlow', count: 12, max: 12, min: 1 },
      },
      {
        id: 'e2', emoji: '🎯', title: `Find it by ear: ${nm(60)} ${nm(62)} ${nm(64)}`, desc: 'Hear a note, find it on the keys.', range: [48, 84],
        intro: [() => `<h2>The anchor note</h2>
          <p>Each question starts with <b>${nm(60)}</b> — your <b>anchor</b>. Then a mystery note. Is it the same? A bit higher? Higher still?</p>
          ${miniKeys(60, 64, (n) => (!T.isBlack(n) ? { color: T.color(n), label: nm(n) } : null))}
          <p>Try keys until one sounds <b>exactly the same</b> as the mystery note. Wrong guesses are training too — listen to how they differ.</p>
          <div class="tip">Sing the notes quietly. Singing is the fastest way to train your ear.</div>`],
        game: { type: 'pitch', count: 10, pool: [0, 2, 4] },
      },
      {
        id: 'e3', emoji: '🙂', title: 'Happy or sad? Major & minor', desc: 'The most important sound in music.', range: [48, 84],
        intro: [() => `<h2>Major 😊 and minor 😢</h2>
          <p>A <b>chord</b> is several notes together. <b>Major</b> sounds bright. <b>Minor</b> sounds dark or sad — Chopin loved minor keys.
          The only difference: <b>the middle note moves down one key</b>.</p>
          <div class="row" style="justify-content:center">
            <div style="text-align:center">${miniKeys(60, 67, (n) => ([60, 64, 67].includes(n) ? { color: '#6bd66b', label: nm(n) } : null))}<br>${seqBtn(nm(60) + ' major', [[60, 64, 67], 60, 64, 67], 0.45)}</div>
            <div style="text-align:center">${miniKeys(60, 67, (n) => ([60, 63, 67].includes(n) ? { color: '#7c7cff', label: nm(n) } : null))}<br>${seqBtn(nm(60) + ' minor', [[60, 63, 67], 60, 63, 67], 0.45)}</div>
          </div>
          <div class="tip">Play both chords on your keyboard and feel the change of mood.</div>`],
        game: { type: 'chordq', count: 12, types: ['maj', 'min'] },
      },
      { id: 'e4', emoji: '🎯', title: `Find it by ear: ${nm(60)} to ${nm(67)}`, desc: 'Five notes now.', range: [48, 84], intro: [], game: { type: 'pitch', count: 12, pool: [0, 2, 4, 5, 7] } },
      {
        id: 'e5', emoji: '📏', title: 'Intervals: steps & leaps', desc: 'Recognise distances with famous songs.', range: [48, 84],
        intro: [() => `<h2>Intervals = distances</h2>
          <p>An <b>interval</b> is the distance between two notes. Each one has its own feel. The trick: link each interval to a song you know.</p>
          <table class="ivtable">${Object.keys(IV).map((s) => `<tr><td><b>${IV[s][0]}</b></td><td class="muted">${s} half step${s > 1 ? 's' : ''}</td><td>${IV[s][1]}</td><td>${seqBtn('', [60, 60 + +s], 0.7)}</td></tr>`).join('')}</table>
          <div class="tip">Don't know a song? Press ▶ a few times and invent your own memory for that sound. We start with 4 easy ones.</div>`],
        game: { type: 'interval', count: 12, pool: [2, 4, 7, 12] },
      },
      {
        id: 'e6', emoji: '🎼', title: 'Melody echo', desc: 'Hear a short tune, play it back.', range: [48, 84],
        intro: [() => `<h2>Play what you hear</h2>
          <p>This is how people learn to <b>play by ear</b>. You hear 3 notes, then play them back. The tunes slowly get longer.</p>
          <div class="tip">Hum the tune first. Then ask: does it go up or down? Step or jump?</div>`],
        game: { type: 'echo', count: 8, len: [3, 5], notes: [60, 62, 64, 65, 67] },
      },
      {
        id: 'e7', emoji: '🏠', title: 'Scale steps: 1 · 3 · 5', desc: 'Hear the role of a note in its key.', range: [48, 84],
        intro: [() => `<h2>Every note has a job</h2>
          <p>In a key, each note has a <b>feeling</b>. Step <b>1</b> (${T.SOLFEGE[0]}) feels like home. Step <b>7</b> pulls back up to home. Musicians who play by ear hear these feelings, in <b>any</b> key.</p>
          <p>${seqBtn('Hear home, then steps 1 · 3 · 5', [[48, 52, 55], [53, 57, 60], [55, 59, 62], [48, 52, 55], 60, 64, 67, 72], 0.6)}</p>
          <div class="tip">Chords play first to set the key. Then one note — is it <b>home</b> (1), <b>sweet</b> (3) or <b>strong</b> (5)?</div>`],
        game: { type: 'degree', count: 12, pool: [0, 2, 4], keys: [48, 53, 55] },
      },
      { id: 'e8', emoji: '📏', title: 'More intervals', desc: 'Seven intervals.', range: [48, 84], intro: [], game: { type: 'interval', count: 14, pool: [1, 2, 3, 4, 5, 7, 12] } },
      { id: 'e9', emoji: '🎯', title: 'Find it by ear: all white keys', desc: 'The full scale.', range: [48, 84], intro: [], game: { type: 'pitch', count: 14, pool: W } },
      { id: 'e10', emoji: '🏠', title: 'All 7 scale steps', desc: `${T.SOLFEGE.join(' ')}`, range: [48, 84], intro: [], game: { type: 'degree', count: 14, pool: [0, 1, 2, 3, 4, 5, 6], keys: [48, 50, 53, 55] } },
      {
        id: 'e11', emoji: '🎭', title: 'Four chord colours', desc: 'Major, minor, diminished, augmented.', range: [48, 84],
        intro: [() => `<h2>Two new chord colours</h2>
          <p><b>Diminished</b> 😨 sounds tense, like a scary film. <b>Augmented</b> 😵 sounds dreamy and strange.</p>
          <p>${seqBtn('Major', [[60, 64, 67]], 1)} ${seqBtn('Minor', [[60, 63, 67]], 1)} ${seqBtn('Diminished', [[60, 63, 66]], 1)} ${seqBtn('Augmented', [[60, 64, 68]], 1)}</p>`],
        game: { type: 'chordq', count: 12, types: ['maj', 'min', 'dim', 'aug'] },
      },
      { id: 'e12', emoji: '⚫', title: 'Find it by ear: all 12 notes', desc: 'Black keys too.', range: [48, 84], intro: [], game: { type: 'pitch', count: 14, pool: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] } },
      { id: 'e13', emoji: '🎵', title: 'Longer melodies', desc: 'Up to 7 notes, with jumps.', range: [48, 84], intro: [], game: { type: 'echo', count: 8, len: [4, 7], notes: [60, 62, 64, 65, 67, 69, 71, 72], moves: [-2, -1, 1, 2, 3, -3] } },
      { id: 'e14', emoji: '🔔', title: 'Notes played together', desc: 'Intervals as harmony.', range: [48, 84], intro: [], game: { type: 'interval', count: 12, pool: [3, 4, 5, 7, 12], harmonic: true } },
      { id: 'e15', emoji: '🔀', title: 'All intervals, up and down', desc: 'The full set.', range: [48, 84], intro: [], game: { type: 'interval', count: 16, pool: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], mixed: true } },
      {
        id: 'e16', emoji: '🏆', title: 'Challenge: no anchor', desc: 'Name notes without a reference.', range: [48, 84],
        intro: [() => `<h2>A real challenge</h2><p>Now there is <b>no anchor note</b>. Very few people can do this perfectly ("perfect pitch"), so don't worry if it's hard — it still sharpens your memory for sounds.</p>`],
        game: { type: 'pitch', count: 10, pool: [0, 2, 4, 5, 7], anchor: false },
      },
    ],
  }));
})();
