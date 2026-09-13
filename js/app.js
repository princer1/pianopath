// App shell: routing, progress, home path, songs list, free play, settings.
(function () {
  const T = PL.Theory;
  const App = (PL.App = {});
  const $ = (s) => document.querySelector(s);
  let main = $('#view');
  const KEY = 'pl.progress';

  let data = null;
  try { data = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  data = Object.assign({ stars: {}, days: {} }, data || {});
  data.settings = Object.assign({ naming: null, colors: true, labels: 'all', sound: true, volume: 0.8, low: 24, high: 107, instrument: 'synth', timingOffset: 0, strictness: 'relaxed' }, data.settings || {});
  const KB_SIZES = [['49', 36, 84, '49 keys (C2–C6)'], ['61', 36, 96, '61 keys (C2–C7)'], ['76', 28, 103, '76 keys (E1–G7)'], ['84', 24, 107, '84 keys (C1–B7)'], ['88', 21, 108, '88 keys (A0–C8)']];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} };

  App.kb = new PL.Keyboard($('#keyboard'));
  function applySettings() {
    T.settings.naming = data.settings.naming || 'letters';
    T.settings.colors = data.settings.colors;
    PL.Input.sound = data.settings.sound;
    PL.Audio.setVolume(data.settings.volume);
    PL.Audio.useSamples = data.settings.instrument === 'recorded';
    PL.Audio.timing.offset = data.settings.timingOffset || 0;
    PL.Audio.timing.level = data.settings.strictness || 'relaxed';
    App.kb.setLabels(data.settings.labels);
    PL.Lessons.refresh();
  }
  applySettings();

  App.getStars = (id) => data.stars[id] || 0;
  App.setStars = (id, n) => { if (n > (data.stars[id] || 0)) { data.stars[id] = n; save(); } };
  App.setKbdHint = (t) => ($('#kbdHint').textContent = t || '');
  App.range = () => [data.settings.low, data.settings.high];
  App.getDays = () => data.days;
  App.getInstrument = () => data.settings.instrument;
  App.setInstrument = (v) => { data.settings.instrument = v; PL.Audio.useSamples = v === 'recorded'; save(); };
  // { offset: ms correction } and/or { level: 'relaxed' | 'normal' | 'strict' }
  App.setTiming = (o) => {
    if ('offset' in o) data.settings.timingOffset = PL.Audio.timing.offset = o.offset;
    if ('level' in o) data.settings.strictness = PL.Audio.timing.level = o.level;
    save();
  };

  // Imported MIDI files are stored as the parsed file plus the chosen parts, and arranged when the app starts.
  App.imported = [];
  try {
    App.imported = JSON.parse(localStorage.getItem('pl.imported') || '[]').map((it) => {
      if (!it.raw) return it; // imported before parts could be chosen
      try {
        const song = PL.MidiFile.arrange(it.raw, it.assign, { id: it.id, title: it.title, timeSig: it.timeSig, phase: it.phase });
        return Object.assign(song, { raw: it.raw, assign: it.assign });
      } catch (e) { return null; }
    }).filter(Boolean);
  } catch (e) {}
  const saveImported = () => {
    try {
      localStorage.setItem('pl.imported', JSON.stringify(App.imported.map((s) => (s.raw ? { id: s.id, title: s.title, raw: s.raw, assign: s.assign, timeSig: s.timeSig, phase: s.phase } : s))));
      return true;
    } catch (e) { return false; }
  };
  App.replaceImported = (song) => {
    const i = App.imported.findIndex((s) => s.id === song.id);
    if (i >= 0) App.imported[i] = song; else App.imported.push(song);
    saveImported();
  };

  // Dialog to choose which instrument parts of a MIDI file each hand plays.
  // entry: { raw, assign?, id?, title }. onDone(song) receives the arranged song.
  App.pickTracks = function (entry, onDone) {
    const M = PL.MidiFile, raw = entry.raw;
    const guess = M.guess(raw);
    const assign = { ...(entry.assign || guess) };
    const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const noteLbl = (n) => T.name(n) + T.octave(n);
    const OPTS = [['R', 'Right hand'], ['L', 'Left hand'], ['split', 'Both hands (split at middle C)'], ['skip', 'Leave out']];
    let voices = [];
    const stopPreview = () => { voices.forEach((v) => v.release(0)); voices = []; };
    const many = raw.tracks.length > 2;
    const meter = M.meter(raw);
    const tsKey = (t) => t.join('/');
    let ts = entry.timeSig || meter.timeSig;
    let phase = entry.timeSig ? entry.phase || 0 : meter.phase;
    const TS = [[4, 4], [3, 4], [2, 4], [6, 8]];
    if (!TS.some((t) => tsKey(t) === tsKey(raw.timeSig))) TS.push(raw.timeSig);

    const el = document.createElement('div');
    el.className = 'overlay';
    el.innerHTML = `<div class="overlay-card wide">
      <h2>🎚️ Which parts do you want to play?</h2>
      <p class="muted">This file has <b>${raw.tracks.length}</b> instrument part${raw.tracks.length === 1 ? '' : 's'}.
        ${many ? 'That is a whole band — two hands can’t play everything. Usually the <b>melody</b> (singer or lead) goes to your <b>right hand</b> and the <b>bass</b> to your <b>left hand</b>.' : ''}
        Press ▶ to hear a part. ★ marks the app's suggestion.</p>
      <div class="row" style="margin:6px 0 10px">
        <label class="row small">Time signature
          <select data-ts>${TS.map((t) => `<option value="${tsKey(t)}" ${tsKey(t) === tsKey(ts) ? 'selected' : ''}>${tsKey(t)}${tsKey(t) === tsKey(meter.timeSig) ? ' ★' : ''}</option>`).join('')}</select></label>
        <span class="muted small">${meter.changed ? `The file says <b>${tsKey(raw.timeSig)}</b>, but its beat sounds like <b>${tsKey(meter.timeSig)}</b>, so that is suggested. ` : ''}If the bar lines look wrong while playing, open 🎚️ Parts and change it.</span>
      </div>
      <div style="overflow-x:auto"><table class="tracks-t">
        <tr><th></th><th>Part</th><th>Instrument</th><th>Notes</th><th>Range</th><th>Play with</th></tr>
        ${raw.tracks.map((t) => `<tr>
          <td><button class="btn small" data-prev="${t.id}" title="Hear this part">▶</button></td>
          <td>${esc(t.name)}</td>
          <td class="muted">${M.family(t.program)}</td>
          <td>${t.count}</td>
          <td class="nowrap">${noteLbl(t.low)}–${noteLbl(t.high)}</td>
          <td><select data-tr="${t.id}">${OPTS.map(([v, l]) => `<option value="${v}" ${assign[t.id] === v ? 'selected' : ''}>${l}${guess[t.id] === v && v !== 'skip' ? ' ★' : ''}</option>`).join('')}</select></td>
        </tr>`).join('')}
      </table></div>
      <div class="row" style="margin-top:14px">
        <span class="small" data-sum></span><span class="spacer"></span>
        <button class="btn" data-cancel>Cancel</button>
        <button class="btn primary" data-ok>Open song →</button>
      </div>
    </div>`;
    const sum = el.querySelector('[data-sum]');
    const update = () => {
      const count = (hand) => raw.tracks.filter((t) => assign[t.id] === hand || assign[t.id] === 'split').length;
      sum.innerHTML = `<span class="hb r">R</span> ${count('R')} part${count('R') === 1 ? '' : 's'} &nbsp; <span class="hb l">L</span> ${count('L')} part${count('L') === 1 ? '' : 's'}`;
    };
    el.addEventListener('change', (e) => {
      const sel = e.target.closest('[data-tr]');
      if (sel) { assign[sel.dataset.tr] = sel.value; update(); }
      const tsSel = e.target.closest('[data-ts]');
      if (tsSel) {
        ts = tsSel.value.split('/').map(Number);
        phase = tsKey(ts) === tsKey(meter.timeSig) ? meter.phase : 0;
      }
    });
    el.addEventListener('click', (e) => {
      const pv = e.target.closest('[data-prev]');
      if (pv) {
        stopPreview();
        PL.Audio.init();
        const id = +pv.dataset.prev;
        const ns = raw.notes.filter((n) => n[0] === id);
        const t0 = ns[0][2], bpm = raw.tempos[0].bpm, at = PL.Audio.now() + 0.1;
        ns.filter((n) => n[2] < t0 + 12).forEach(([, note, start, dur, vel]) => {
          voices.push(PL.Audio.play(note, (dur * 60) / bpm, vel, at + ((start - t0) * 60) / bpm));
        });
        return;
      }
      if (e.target.closest('[data-cancel]')) { stopPreview(); el.remove(); return; }
      if (e.target.closest('[data-ok]')) {
        try {
          const song = Object.assign(M.arrange(raw, assign, { id: entry.id, title: entry.title, timeSig: ts, phase }), { raw, assign });
          stopPreview();
          el.remove();
          onDone(song);
        } catch (err) {
          sum.innerHTML = `<span style="color:var(--bad)">${esc(err.message)}</span>`;
        }
      }
    });
    update();
    document.body.appendChild(el);
  };
  App.findSong = (id) => PL.Songs.list.find((s) => s.id === id) || App.imported.find((s) => s.id === id);

  // ---------- practice time & streak ----------
  const dayKey = (d = new Date()) => d.toLocaleDateString('en-CA');
  let lastNote = 0;
  PL.Input.on((ev) => { if (ev.type === 'on') lastNote = Date.now(); });
  setInterval(() => {
    if (Date.now() - lastNote < 8000 && !document.hidden) {
      const k = dayKey();
      data.days[k] = (data.days[k] || 0) + 1;
      if (data.days[k] % 10 === 0) save();
      const el = document.querySelector('[data-live=today]');
      if (el) el.textContent = Math.floor(data.days[k] / 60) + ' min';
    }
  }, 1000);
  function streak() {
    const d = new Date();
    let s = 0;
    if (!((data.days[dayKey(d)] || 0) >= 60)) d.setDate(d.getDate() - 1);
    while ((data.days[dayKey(d)] || 0) >= 60) { s++; d.setDate(d.getDate() - 1); }
    return s;
  }
  App.streak = streak;

  // ---------- routing ----------
  let cleanup = null;
  App.go = (view, arg) => {
    const h = '#' + view + (arg ? '/' + encodeURIComponent(arg) : '');
    if (location.hash !== h) location.hash = h; else route();
  };
  function route() {
    const [view = 'home', rawArg] = location.hash.slice(1).split('/');
    const arg = rawArg && decodeURIComponent(rawArg);
    if (cleanup) { cleanup(); cleanup = null; }
    const fresh = main.cloneNode(false); // drops old event listeners
    fresh.className = '';
    main.replaceWith(fresh);
    main = fresh;
    App.setKbdHint('');
    App.kb.clearHints();
    App.kb.clearFingers();
    App.kb.setRange(48, 84);
    document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === (view || 'home')));
    if (view === 'learn' && arg) cleanup = PL.Lessons.mount(main, arg);
    else if (view === 'learn') renderLearn();
    else if (view === 'ear') renderLearn('ear');
    else if (view === 'songs' && arg && App.findSong(arg)) cleanup = PL.Player.mount(main, App.findSong(arg));
    else if (view === 'songs') renderSongs();
    else if (view === 'free') cleanup = renderFree();
    else if (view === 'settings') renderSettings();
    else if (view === 'progress') PL.Coach.renderProgress(main);
    else if (view === 'sound') cleanup = PL.Recorder.mount(main);
    else if (view === 'timing') cleanup = PL.Timing.mount(main);
    else if (view === 'review') cleanup = PL.Lessons.run(main, PL.Coach.reviewLesson(arg));
    else PL.Coach.renderHome(main);
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('#nav button');
    if (nav) return App.go(nav.dataset.view);
    const g = e.target.closest('[data-go]');
    if (g && !e.target.closest('[data-del]')) { PL.Audio.init(); const [v, a] = g.dataset.go.split('/'); App.go(v, a); }
  });

  // ---------- cards ----------
  const starsHtml = (n) => `<span class="stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(3 - n)}</span></span>`;
  function lessonCards(unit) {
    return unit.lessons.map((l, i) => {
      const prev = unit.lessons[i - 1];
      const locked = prev && !App.getStars('lesson:' + prev.id) && !App.getStars('lesson:' + l.id);
      return `<div class="card lesson-card ${locked ? 'locked' : ''}" data-go="learn/${l.id}">
        <div class="row"><span class="emoji">${l.emoji}</span><span class="spacer"></span>${locked ? '🔒' : starsHtml(App.getStars('lesson:' + l.id))}</div>
        <h3>${l.title}</h3><p>${l.desc}</p></div>`;
    }).join('');
  }
  function songCard(s, deletable) {
    const hands = s.notes.some((n) => n.hand === 'L') ? 'both hands' : 'right hand';
    return `<div class="card lesson-card" data-go="songs/${s.id}">
      <div class="row"><span class="emoji">${s.level === 4 ? '🌙' : s.level === 'Custom' ? '📁' : '🎵'}</span><span class="spacer"></span>
      ${starsHtml(App.getStars('song:' + s.id))}${deletable ? ` <button class="btn small" data-del="${s.id}" title="Remove">✕</button>` : ''}</div>
      <h3>${s.title}</h3><p>${s.composer || ''}</p>
      <div class="row" style="margin-top:6px"><span class="badge">${hands}</span><span class="badge">${s.timeSig[0]}/${s.timeSig[1]}</span><span class="badge">${s.bpm} bpm</span></div></div>`;
  }

  // ---------- views ----------
  // The home page (today's plan, week, road to Chopin) lives in coach.js.
  function renderLearn(filter) {
    const head = filter === 'ear'
      ? '<h1>👂 Ear training</h1><p class="muted">Learn to recognise notes, intervals, chords and melodies by sound. 5 minutes a day — ears grow slowly but surely.</p>'
      : '<h1>📖 Lessons</h1><p class="muted">Do each unit in order. Each lesson explains one idea, then you practise it on your keyboard.</p>';
    main.innerHTML = `<div class="wrap">${head}
      ${PL.Lessons.units.filter((u) => !filter || u.key === filter).map((u) => `<div class="unit-title">${u.title}</div><div class="grid">${lessonCards(u)}</div>`).join('')}</div>`;
  }

  function renderSongs() {
    const byLevel = {};
    PL.Songs.list.forEach((s) => (byLevel[s.level] = byLevel[s.level] || []).push(s));
    main.innerHTML = `<div class="wrap">
      <div class="row"><h1 style="margin:0">🎼 Songs</h1><span class="spacer"></span>
        <label class="btn primary">📁 Open MIDI file… <input type="file" accept=".mid,.midi" hidden data-import></label></div>
      <div class="tip">Want the full Chopin pieces? Download a free <b>.mid</b> file (for example a Chopin Nocturne or Waltz from the Mutopia Project or piano-midi.de) and open it here — you get the same falling notes, sheet, wait mode and slow tempo.</div>
      ${Object.keys(byLevel).map((lv) => `<div class="unit-title">${PL.Songs.levels[lv] || lv}</div><div class="grid">${byLevel[lv].map((s) => songCard(s)).join('')}</div>`).join('')}
      ${App.imported.length ? `<div class="unit-title">Your MIDI files</div><div class="grid">${App.imported.map((s) => songCard(s, true)).join('')}</div>` : ''}
    </div>`;
    main.querySelector('[data-import]').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      e.target.value = ''; // allow choosing the same file again
      try {
        const raw = PL.MidiFile.parse(await f.arrayBuffer(), f.name.replace(/\.midi?$/i, ''));
        App.pickTracks({ raw, title: raw.title }, (song) => {
          App.imported.push(song);
          if (!saveImported()) alert('The song will open, but it is too large to keep for next time.');
          App.go('songs', song.id);
        });
      } catch (err) {
        alert('Could not read this MIDI file: ' + err.message);
      }
    });
    main.addEventListener('click', (e) => {
      const d = e.target.closest('[data-del]');
      if (!d) return;
      e.stopPropagation();
      App.imported = App.imported.filter((s) => s.id !== d.dataset.del);
      saveImported();
      renderSongs();
    });
  }

  function chordName(held) {
    const pcs = [...new Set(held.map(T.pc))];
    if (pcs.length < 3) return '';
    const TYPES = [[[0, 4, 7], 'major chord'], [[0, 3, 7], 'minor chord'], [[0, 3, 6], 'diminished chord'], [[0, 4, 8], 'augmented chord'], [[0, 4, 7, 10], 'dominant 7th chord'], [[0, 4, 7, 11], 'major 7th chord'], [[0, 3, 7, 10], 'minor 7th chord']];
    for (const r of pcs) {
      const rel = pcs.map((p) => (p - r + 12) % 12).sort((a, b) => a - b).join(',');
      for (const [iv, nameT] of TYPES) if (iv.join(',') === rel) return `${T.name(r + 60)} ${nameT}`;
    }
    return '';
  }

  function renderFree() {
    App.kb.setRange(...App.range());
    main.innerHTML = `<div class="wrap stack">
      <div class="card" style="text-align:center">
        <div class="muted">You are playing</div>
        <div data-f="name" style="font-size:40px;font-weight:700;min-height:60px">—</div>
        <div data-f="chord" class="muted" style="min-height:22px"></div>
        <div data-f="staff"></div>
      </div>
      <div class="card">
        <h3>🥁 Metronome</h3>
        <div class="row">
          <button class="btn primary" data-m="toggle">▶ Start</button>
          <label class="row">Tempo <input type="range" min="30" max="200" value="80" data-m="bpm"> <b data-m="bpmv">80</b> BPM</label>
          <label class="row">Beats per bar <select data-m="beats"><option>2</option><option>3</option><option selected>4</option><option>6</option></select></label>
          <span class="badge" data-m="word"></span>
        </div>
        <div class="beats" data-m="dots"></div>
        <p class="muted small">Tempo words you will see on sheet music: <b>Largo</b> very slow (40–60) · <b>Adagio</b> slow (66–76) · <b>Andante</b> walking (76–108) · <b>Moderato</b> (108–120) · <b>Allegro</b> fast (120–156) · <b>Presto</b> very fast (168+)</p>
      </div></div>`;
    const q = (s) => main.querySelector(s);
    const draw = () => {
      const held = [...PL.Input.down].sort((a, b) => a - b);
      q('[data-f=name]').textContent = held.length ? held.map((n) => T.name(n)).join('  ') : '—';
      q('[data-f=chord]').textContent = chordName(held);
      q('[data-f=staff]').innerHTML = held.length
        ? `<div class="staff-box" style="max-width:100%;overflow-x:auto">${T.staffSVG({ clef: 'grand', space: 12, gapX: 34, notes: held.map((n) => ({ note: n, color: T.noteColor(n) })) })}</div>` : '';
    };
    const off = PL.Input.on(draw);
    draw();

    let bpm = 80, beats = 4, on = false, nextT = 0, k = 0, iv = 0;
    const words = [[60, 'Largo'], [66, 'Larghetto'], [76, 'Adagio'], [108, 'Andante'], [120, 'Moderato'], [168, 'Allegro'], [999, 'Presto']];
    const dots = () => { q('[data-m=dots]').innerHTML = Array.from({ length: beats }, (_, i) => `<div class="beat">${i + 1}</div>`).join(''); };
    const upd = () => { q('[data-m=bpmv]').textContent = bpm; q('[data-m=word]').textContent = words.find(([m]) => bpm < m)[1]; };
    dots(); upd();
    main.addEventListener('input', (e) => { if (e.target.dataset.m === 'bpm') { bpm = +e.target.value; upd(); } });
    main.addEventListener('change', (e) => { if (e.target.dataset.m === 'beats') { beats = +e.target.value; k = 0; dots(); } });
    q('[data-m=toggle]').onclick = (e) => {
      const ctx = PL.Audio.init();
      on = !on;
      e.target.textContent = on ? '⏸ Stop' : '▶ Start';
      clearInterval(iv);
      if (!on) return;
      nextT = ctx.currentTime + 0.1; k = 0;
      iv = setInterval(() => {
        while (nextT < ctx.currentTime + 0.12) {
          const beat = k % beats;
          PL.Audio.click(beat === 0, nextT);
          setTimeout(() => main.querySelectorAll('[data-m=dots] .beat').forEach((d, i) => d.classList.toggle('now', i === beat)), Math.max(0, (nextT - ctx.currentTime) * 1000));
          nextT += 60 / bpm; k++;
        }
      }, 25);
    };
    return () => { off(); clearInterval(iv); };
  }

  function renderSettings() {
    const s = data.settings;
    App.kb.setRange(s.low, s.high);
    const preset = KB_SIZES.find(([, lo, hi]) => lo === s.low && hi === s.high);
    const noteLbl = (n) => T.name(n, { naming: 'letters' }) + T.octave(n);
    const opt = (v, label, cur) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${label}</option>`;
    main.innerHTML = `<div class="wrap stack" style="max-width:720px">
      <h1>⚙️ Settings</h1>
      <div class="card stack">
        <label class="field">Note names
          <select data-s="naming">${opt('letters', 'C D E F G A B (English letters)', T.settings.naming)}${opt('solfege', 'Do Re Mi Fa Sol La Si', T.settings.naming)}${opt('both', 'Both (Do · C)', T.settings.naming)}</select></label>
        <label class="row"><input type="checkbox" data-s="colors" ${s.colors ? 'checked' : ''}> Colour for each note (helps you connect sheet ↔ keys)</label>
        <label class="field">Names on the on-screen keyboard
          <select data-s="labels">${opt('all', 'All keys', s.labels)}${opt('c', 'Only C / Do', s.labels)}${opt('none', 'None (test yourself)', s.labels)}</select></label>
      </div>
      <div class="card stack">
        <label class="row"><input type="checkbox" data-s="sound" ${s.sound ? 'checked' : ''}> App plays piano sound when you press keys <span class="muted small">(turn off if your keyboard has its own speakers)</span></label>
        <label class="field">Piano sound
          <select data-instrument>${opt('synth', 'Built-in piano (synthesized)', s.instrument)}${opt('recorded', `My recorded piano (${PL.Samples.count()} recordings)`, s.instrument)}</select></label>
        <div class="row"><button class="btn" data-go="sound">🎙️ Record my piano's sound</button>
          <span class="muted small">Uses your audio card and MIDI · about 3–10 minutes. Songs, lessons and ear training then sound like your piano.</span></div>
        <label class="row">Volume <input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-s="volume"></label>
        <div><b>MIDI keyboards:</b> <span class="muted">${PL.Input.devices.length ? PL.Input.devices.join(', ') : 'none found'}</span>
          <button class="btn" data-reconnect>Reconnect</button></div>
        <p class="muted small">Works best in Chrome or Edge. Plug the keyboard in by USB before opening the app.</p>
      </div>
      <div class="card stack">
        <h3 style="margin:0">📋 Practice plan</h3>
        <label class="field">Daily practice goal
          <select data-goal>${[10, 15, 20, 30, 45].map((m) => `<option value="${m}" ${m === PL.Coach.getGoal() ? 'selected' : ''}>${m} minutes a day</option>`).join('')}</select></label>
        <p class="muted small">Today's plan on the home page is sized to this goal. Changing it rebuilds today's plan.</p>
      </div>
      <div class="card stack">
        <h3 style="margin:0">🎯 Timing</h3>
        <label class="field">How strict is "on time"?
          <select data-strict>${opt('relaxed', 'Relaxed — within 90 ms counts as on time (best for learning)', s.strictness)}${opt('normal', 'Normal — within 60 ms', s.strictness)}${opt('strict', 'Strict — within 35 ms', s.strictness)}</select></label>
        <div class="row"><button class="btn" data-go="timing">🎯 Check my delay (latency)</button>
          <span class="muted small">Correction in use: ${s.timingOffset > 0 ? '+' : ''}${s.timingOffset} ms. Run the check if lessons always say you're late (or early) by about the same amount.</span></div>
      </div>
      <div class="card stack">
        <h3 style="margin:0">🎹 Your keyboard</h3>
        <label class="field">Size
          <select data-kbsize>${KB_SIZES.map(([k, , , label]) => `<option value="${k}" ${preset && preset[0] === k ? 'selected' : ''}>${label}</option>`).join('')}
            ${preset ? '' : `<option selected value="">Detected: ${noteLbl(s.low)}–${noteLbl(s.high)} (${s.high - s.low + 1} keys)</option>`}</select></label>
        <div class="row"><button class="btn" data-detect>🔍 Detect: press my lowest &amp; highest key</button>
          <span class="muted small" data-detectmsg>Now: ${noteLbl(s.low)} – ${noteLbl(s.high)}. The whole range is shown below.</span></div>
        <p class="muted small">Free play shows every key. Songs zoom in on the keys they need; notes outside your keyboard are played for you.</p>
      </div>
      <div class="card"><button class="btn" data-reset>Reset all progress</button></div>
    </div>`;
    main.addEventListener('change', (e) => {
      const k = e.target.dataset.s;
      if (!k) return;
      s[k] = e.target.type === 'checkbox' ? e.target.checked : k === 'volume' ? +e.target.value : e.target.value;
      save(); applySettings();
    });
    main.addEventListener('input', (e) => { if (e.target.dataset.s === 'volume') { s.volume = +e.target.value; PL.Audio.setVolume(s.volume); save(); } });
    main.querySelector('[data-reconnect]').onclick = () => PL.Input.initMIDI(midiStatus).then(route);
    main.querySelector('[data-goal]').onchange = (e) => PL.Coach.setGoal(+e.target.value);
    main.querySelector('[data-instrument]').onchange = (e) => App.setInstrument(e.target.value);
    main.querySelector('[data-strict]').onchange = (e) => App.setTiming({ level: e.target.value });
    main.querySelector('[data-kbsize]').onchange = (e) => {
      const z = KB_SIZES.find(([k]) => k === e.target.value);
      if (!z) return;
      s.low = z[1]; s.high = z[2]; save(); route();
    };
    main.querySelector('[data-detect]').onclick = () => {
      const msg = main.querySelector('[data-detectmsg]');
      let low = null;
      msg.innerHTML = '<b>Press the LOWEST key</b> (far left) on your keyboard…';
      const off = PL.Input.on((ev) => {
        if (ev.type !== 'on') return;
        if (low == null) { low = ev.note; msg.innerHTML = `Lowest: ${noteLbl(low)}. Now <b>press the HIGHEST key</b> (far right)…`; return; }
        off();
        if (Math.abs(ev.note - low) < 12) { msg.textContent = 'Those keys are too close together — try again.'; return; }
        s.low = Math.min(low, ev.note); s.high = Math.max(low, ev.note); save(); route();
      });
    };
    main.querySelector('[data-reset]').onclick = () => {
      if (confirm('Delete all stars and practice history?')) { data.stars = {}; data.days = {}; save(); PL.Coach.reset(); route(); }
    };
  }

  // ---------- startup ----------
  function midiStatus(state, text) {
    const el = $('#midiStatus');
    el.className = 'midi-status ' + state;
    el.querySelector('.txt').textContent = text;
  }
  PL.Input.initMIDI(midiStatus);
  PL.Samples.load();
  PL.Input.onOctave = (oct) => App.setKbdHint(`Computer keys now start at ${T.name(oct)}${T.octave(oct)}`);

  const overlay = $('#startOverlay');
  if (!data.settings.naming) {
    const chooser = document.createElement('div');
    chooser.innerHTML = `<p><b>Which note names do you know?</b></p>
      <div class="stack" style="margin-bottom:18px">
        <button class="btn" data-naming="letters">C D E F G A B</button>
        <button class="btn" data-naming="solfege">Do Re Mi Fa Sol La Si</button>
        <button class="btn" data-naming="both">Show both</button>
      </div>`;
    $('#startBtn').before(chooser);
    chooser.addEventListener('click', (e) => {
      const b = e.target.closest('[data-naming]');
      if (!b) return;
      chooser.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      data.settings.naming = b.dataset.naming;
      save(); applySettings();
    });
  }
  $('#startBtn').onclick = () => {
    PL.Audio.init();
    if (!data.settings.naming) { data.settings.naming = 'letters'; save(); applySettings(); }
    overlay.hidden = true;
    route();
  };
  route();
})();
