// Practice coach: daily plan, spaced review, weak-spot tracking, road to Chopin, progress page.
(function () {
  const T = PL.Theory;
  const C = (PL.Coach = {});
  const KEY = 'pl.coach';
  const GAPS = [1, 2, 4, 8, 16, 32, 60]; // days until a finished lesson comes back for review, by box
  const MINS = { drill: 3, review: 4, lesson: 5, song: 8 };

  const fresh = () => ({ skills: {}, lessons: {}, songs: {}, done: { date: '', items: [] }, plan: null, goal: 20 });
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  d = Object.assign(fresh(), d || {});

  let timer = 0;
  const save = () => { clearTimeout(timer); try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} };
  const dirty = () => { clearTimeout(timer); timer = setTimeout(save, 600); };
  window.addEventListener('pagehide', save);

  const day = (offset = 0) => { const x = new Date(); x.setDate(x.getDate() + offset); return x.toLocaleDateString('en-CA'); };
  const daysSince = (k) => Math.round((new Date(day()) - new Date(k)) / 864e5);
  const ago = (k) => { const n = daysSince(k); return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`; };
  const Ls = () => PL.Lessons;
  const lessonStars = (id) => PL.App.getStars('lesson:' + id);
  const songStars = (id) => PL.App.getStars('song:' + id);
  const noteName = (n) => T.name(n) + T.octave(n);

  C.getGoal = () => d.goal;
  C.setGoal = (m) => { d.goal = m; d.plan = null; save(); };
  C.reset = () => { d = fresh(); save(); };

  function markDone(key) {
    if (d.done.date !== day()) d.done = { date: day(), items: [] };
    if (!d.done.items.includes(key)) d.done.items.push(key);
    save();
  }

  // ---------- recording results ----------
  // One answer to a skill, e.g. 'read:treble:67' or 'ear:iv:7'. extra: { ms, confused (note pressed instead) }
  C.record = function (key, ok, extra = {}) {
    const s = d.skills[key] || (d.skills[key] = { n: 0, acc: 0.6, ms: null, c: {} });
    s.n++;
    s.acc = s.acc * 0.7 + (ok ? 0.3 : 0); // recent answers count most
    if (ok && extra.ms) s.ms = s.ms == null ? extra.ms : s.ms * 0.7 + extra.ms * 0.3;
    if (extra.confused != null) s.c[extra.confused] = (s.c[extra.confused] || 0) + 1;
    s.last = day();
    dirty();
  };

  C.lessonDone = function (les, score) {
    if (les.review) return markDone('drill:' + les.review);
    const l = d.lessons[les.id] || (d.lessons[les.id] = { box: 0, best: 0, runs: 0 });
    const onTime = !l.due || l.due <= day();
    l.runs++; l.last = day(); l.best = Math.max(l.best, score);
    if (score < 0.5) {
      if (l.due) { l.box = 0; l.due = day(1); }
    } else {
      if (score < 0.75) l.box = 0;
      else if (l.due && onTime) l.box = Math.min(GAPS.length - 1, l.box + 1);
      l.due = day(GAPS[l.box]);
    }
    markDone('lesson:' + les.id);
  };

  // r: { mode, pct, tempo, hands, single (song has one hand), bars: [accuracy | null per bar] }
  C.songDone = function (id, r) {
    const s = d.songs[id] || (d.songs[id] = { runs: 0, bars: {} });
    s.runs++; s.last = day();
    const full = r.hands === 'both' || r.single;
    if (r.mode === 'wait') {
      if (full) s.wait = Math.max(s.wait || 0, r.pct);
      else if (r.hands === 'right') s.waitR = Math.max(s.waitR || 0, r.pct);
    }
    if (r.mode === 'play' && full) {
      s.play = Math.max(s.play || 0, r.pct);
      if (r.pct >= 85) s.tempo = Math.max(s.tempo || 0, r.tempo);
    }
    r.bars.forEach((a, i) => { if (a != null) s.bars[i + 1] = s.bars[i + 1] == null ? a : (s.bars[i + 1] + a) / 2; });
    markDone('song:' + id);
  };

  function weakest(prefix, k) {
    return Object.entries(d.skills)
      .filter(([key, s]) => key.startsWith(prefix) && s.n >= 3)
      .map(([key, s]) => ({ key, s, w: 1 - s.acc + (s.ms ? Math.min(0.3, Math.max(0, (s.ms - 3000) / 10000)) : 0) }))
      .filter((x) => x.w > 0.2)
      .sort((a, b) => b.w - a.w)
      .slice(0, k);
  }
  function earLabel(key) {
    const [, kind, v] = key.split(':');
    const H = Ls().h;
    if (kind === 'pitch') return T.name(60 + +v);
    if (kind === 'iv') return H.IV[v][0];
    if (kind === 'chord') return H.CH[v][1] + ' chord';
    return `step ${+v + 1} (${T.SOLFEGE[v]})`;
  }

  // ---------- road to Chopin ----------
  const ROAD = [
    { emoji: '🗺️', title: 'Find every key', lessons: ['k1', 'k2', 'k3', 'k4', 'k5'] },
    { emoji: '🎼', title: 'Read the treble staff', lessons: ['s1', 's2g', 's2', 's3', 's3b'] },
    { emoji: '🥁', title: 'Keep a steady beat', lessons: ['r1', 'r2', 'r3'] },
    { emoji: '🎵', title: 'First songs & first ear skills', lessons: ['e1', 't1'], songs: ['hot-cross-buns', 'mary'] },
    { emoji: '🎶', title: 'Read the bass staff & both hands', lessons: ['s4', 's4b', 's5', 's6', 'r4'] },
    { emoji: '📈', title: 'Scales, keys & chords', lessons: ['t2', 't3', 't4', 't6', 'e2', 'e3'] },
    { emoji: '🎹', title: 'Both hands together', lessons: ['s7', 't7', 'e5'], songs: ['scale-c', 'twinkle', 'ode-to-joy'] },
    { emoji: '🏛️', title: 'Classical pieces', lessons: ['t5', 't8', 't10', 'r5', 'e6'], songs: ['minuet-g', 'fur-elise'] },
    { emoji: '🌙', title: 'Chopin: Prelude in E minor', lessons: ['t9', 't11', 'e7'], songs: ['chopin-prelude-4-easy'] },
  ];
  function milestones() {
    return ROAD.map((m) => {
      const items = [
        ...(m.lessons || []).filter((id) => Ls().byId[id]).map((id) => {
          const l = Ls().byId[id];
          return { label: `${l.emoji} ${l.title}`, go: 'learn/' + id, done: lessonStars(id) > 0, lesson: id };
        }),
        ...(m.songs || []).filter((id) => PL.App.findSong(id)).map((id) => ({
          label: `🎵 ${PL.App.findSong(id).title} · ★★`, go: 'songs/' + id, done: songStars(id) >= 2, song: id,
        })),
      ];
      const n = items.filter((i) => i.done).length;
      return { ...m, items, n, pct: items.length ? n / items.length : 1 };
    });
  }

  // ---------- today's plan ----------
  function build(taken) {
    const ms = milestones();
    const cur = ms.findIndex((m) => m.pct < 1);
    const out = [];
    const has = (k) => taken.has(k) || out.some((i) => i.key === k);
    const add = (it) => { if (!has(it.key)) out.push(it); };

    if (weakest('read:', 8).length >= 2) add({ key: 'drill:read', type: 'drill', kind: 'read' });
    Object.entries(d.lessons)
      .filter(([id, l]) => l.due && l.due <= day() && Ls().byId[id])
      .sort((a, b) => a[1].due.localeCompare(b[1].due))
      .slice(0, 2)
      .forEach(([id]) => add({ key: 'lesson:' + id, type: 'review', id }));

    const road = cur < 0 ? [] : ms.slice(cur).flatMap((m) => m.items);
    const next = road.find((i) => i.lesson && !i.done && !has('lesson:' + i.lesson));
    if (next) add({ key: 'lesson:' + next.lesson, type: 'lesson', id: next.lesson });

    const ear = Ls().units.find((u) => u.key === 'ear');
    const earNext = ear && ear.lessons.find((l) => !lessonStars(l.id) && !has('lesson:' + l.id));
    if (weakest('ear:', 6).length >= 2 && (!earNext || new Date().getDate() % 2 === 0)) add({ key: 'drill:ear', type: 'drill', kind: 'ear' });
    else if (earNext) add({ key: 'lesson:' + earNext.id, type: 'lesson', id: earNext.id });

    const song = [
      ...ms.flatMap((m) => m.items).filter((i) => i.song && !i.done),
      ...PL.Songs.list.filter((s) => songStars(s.id) < 3).map((s) => ({ song: s.id })),
    ].find((i) => !has('song:' + i.song));
    if (song) add({ key: 'song:' + song.song, type: 'song', id: song.song });
    return out;
  }

  // Keep the plan close to the daily goal; drop the least important steps first.
  function trim(items) {
    const total = () => items.reduce((s, i) => s + MINS[i.type], 0);
    const drop = [(i) => i.key === 'drill:ear', (i) => i.type === 'review', (i) => i.key === 'drill:read', (i) => i.type === 'lesson' && i.id[0] === 'e'];
    while (total() > d.goal + 4 && items.length > 2) {
      const f = drop.find((p) => items.some(p));
      if (!f) break;
      const idx = items.map(f).lastIndexOf(true);
      items.splice(idx, 1);
    }
    return items;
  }

  function songAdvice(song) {
    const s = d.songs[song.id] || { bars: {} };
    const both = song.notes.some((n) => n.hand === 'L') && song.notes.some((n) => n.hand === 'R');
    let preset, detail;
    if (both && (s.waitR || 0) < 85 && (s.wait || 0) < 85) {
      preset = { mode: 'wait', tempo: 0.6, hands: 'right' };
      detail = '⏳ Wait mode, right hand alone first';
    } else if ((s.wait || 0) < 85) {
      preset = { mode: 'wait', tempo: 0.6, hands: 'both' };
      detail = both ? '⏳ Wait mode, now with both hands' : '⏳ Wait mode — get the notes right, no rush';
    } else if ((s.play || 0) < 85) {
      const t = s.tempo || 0.5;
      preset = { mode: 'play', tempo: t, hands: 'both' };
      detail = `🎯 Play in tempo at ${Math.round(t * 100)}% speed — keep going after a mistake`;
    } else if ((s.tempo || 0) < 1) {
      const t = Math.min(1, +((s.tempo || 0.5) + 0.1).toFixed(2));
      preset = { mode: 'play', tempo: t, hands: 'both' };
      detail = `🐇 Speed up to ${Math.round(t * 100)}%`;
    } else {
      preset = { mode: 'play', tempo: 1, hands: 'both' };
      detail = '🏆 Full speed — now make it musical';
    }
    const weak = Object.entries(s.bars || {}).filter(([, a]) => a < 0.8).sort((x, y) => x[1] - y[1])[0];
    if (weak && s.runs >= 2) detail += ` · weakest: bar ${weak[0]} (try 🔁 Loop bars)`;
    return { preset, detail };
  }

  function describe(it) {
    if (it.type === 'drill' && it.kind === 'read') {
      const w = weakest('read:', 5);
      return { emoji: '🎯', title: 'Warm-up: your tricky notes', detail: w.length ? `Extra practice on ${w.map((x) => noteName(+x.key.split(':')[2])).join(', ')}` : 'Quick note-reading warm-up', go: 'review/read', mins: MINS.drill };
    }
    if (it.type === 'drill') {
      const w = weakest('ear:', 4);
      return { emoji: '👂', title: 'Ear warm-up: sounds you mix up', detail: w.length ? w.map((x) => earLabel(x.key)).join(', ') : 'Quick ear warm-up', go: 'review/ear', mins: MINS.drill };
    }
    if (it.type === 'review' || it.type === 'lesson') {
      const l = Ls().byId[it.id];
      if (!l) return { emoji: '❔', title: 'Lesson no longer available', detail: '', go: 'learn', mins: 0 };
      const rec = d.lessons[it.id];
      if (it.type === 'review') return { emoji: '🔁', title: `Review: ${l.title}`, detail: `So you don't forget it — last practised ${rec && rec.last ? ago(rec.last) : 'a while ago'}`, go: 'learn/' + it.id, mins: MINS.review };
      return { emoji: l.emoji, title: `${l.id[0] === 'e' ? 'Ear training' : 'New lesson'}: ${l.title}`, detail: l.desc, go: 'learn/' + it.id, mins: MINS.lesson };
    }
    const song = PL.App.findSong(it.id);
    if (!song) return { emoji: '❔', title: 'Song no longer available', detail: '', go: 'songs', mins: 0 };
    const a = songAdvice(song);
    return { emoji: '🎼', title: `Song: ${song.title}`, detail: a.detail, go: 'songs/' + it.id, preset: a.preset, mins: MINS.song };
  }

  // The plan is fixed for the day so finished steps stay ticked; details are worked out fresh each time.
  C.plan = function () {
    if (!d.plan || d.plan.date !== day()) { d.plan = { date: day(), items: trim(build(new Set())) }; save(); }
    const doneKeys = d.done.date === day() ? d.done.items : [];
    return d.plan.items.map((it) => ({ ...it, ...describe(it), done: doneKeys.includes(it.key) }));
  };
  C.more = function () {
    C.plan();
    const extra = build(new Set(d.plan.items.map((i) => i.key))).slice(0, 2);
    d.plan.items.push(...extra);
    save();
    return extra.length;
  };

  // Practice session built from the player's weak spots (route #review/read or #review/ear).
  C.reviewLesson = function (kind) {
    const H = Ls().h;
    const uniq = (a) => [...new Set(a)];
    if (kind === 'read') {
      const w = weakest('read:', 6);
      const step = (n, dir) => { let m = n + dir; while (T.isBlack(m)) m += dir; return m; };
      let pool = [], clefs = new Set();
      w.forEach((x) => {
        const [, clef, v] = x.key.split(':');
        const n = +v;
        clefs.add(clef);
        pool.push(n, n, n, step(n, -1), step(n, 1));
      });
      if (!pool.length) { pool = H.whites('C4', 'G4'); clefs = new Set(['treble']); }
      const clef = clefs.size > 1 ? 'grand' : [...clefs][0];
      return { id: 'review-read', review: 'read', emoji: '🎯', title: 'Your tricky notes', range: [36, 84], intro: [], game: { type: 'staff', clef, notes: pool, count: 12, positions: Object.values(Ls().P) } };
    }
    if (kind === 'ear') {
      const groups = {};
      weakest('ear:', 8).forEach((x) => { const [, k, v] = x.key.split(':'); (groups[k] = groups[k] || []).push(v); });
      const k = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length)[0] || 'pitch';
      const vals = groups[k] || [];
      const nums = vals.map(Number);
      let game;
      if (k === 'pitch') game = { type: 'pitch', count: 10, pool: uniq([0, ...nums, ...(nums.length < 2 ? [4, 7] : [])]) };
      if (k === 'iv') game = { type: 'interval', count: 10, pool: uniq([...nums, 7, 12]).sort((a, b) => a - b) };
      if (k === 'chord') game = { type: 'chordq', count: 10, types: uniq(['maj', 'min', ...vals]) };
      if (k === 'deg') game = { type: 'degree', count: 10, pool: uniq([0, 4, ...nums]).sort((a, b) => a - b), keys: [48, 53, 55] };
      return { id: 'review-ear', review: 'ear', emoji: '👂', title: 'Ear warm-up', range: [48, 84], intro: [], game };
    }
    return null;
  };

  // ---------- home dashboard ----------
  const greeting = () => { const h = new Date().getHours(); return (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening') + ' 🎹'; };

  C.renderHome = function (main) {
    const days = PL.App.getDays();
    const mins = (k) => Math.floor((days[k] || 0) / 60);
    const plan = C.plan();
    const first = plan.findIndex((p) => !p.done);
    const planMins = plan.reduce((s, p) => s + p.mins, 0);
    const ms = milestones();
    const cur = ms.findIndex((m) => m.pct < 1);
    const dow = (new Date().getDay() + 6) % 7; // Monday = 0
    const week = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => ({ label, k: day(i - dow), today: i === dow }));
    const top = Math.max(d.goal * 1.4, ...week.map((w) => mins(w.k)));
    const met = week.filter((w) => mins(w.k) >= d.goal).length;

    main.innerHTML = `<div class="wrap stack">
      <div class="card hero">
        <div style="flex:1;min-width:260px">
          <h1>${greeting()}</h1>
          <p class="muted">${first < 0
            ? "🎉 Today's plan is done. Anything more is a bonus."
            : `Today's plan: ${plan.length} steps, about ${planMins} minutes. It changes as the app learns what you find hard.`}</p>
          ${first >= 0
            ? `<button class="btn primary big" data-plan="${first}">▶ ${first === 0 && !plan.some((p) => p.done) ? 'Start' : 'Continue'}: ${plan[first].title}</button>`
            : '<button class="btn big" data-more>➕ Add more practice</button>'}
        </div>
        <div class="row">
          <div class="stat"><b>🔥 ${PL.App.streak()}</b><span class="small muted">day streak</span></div>
          <div class="stat"><b data-live="today">${mins(day())} min</b><span class="small muted">today · goal ${d.goal}</span></div>
          <div class="stat"><b>${met}/5</b><span class="small muted">goal days this week</span></div>
        </div>
      </div>

      <div class="dash">
        <div class="card">
          <div class="row"><h2 style="margin:0">📋 Today's plan</h2><span class="spacer"></span>
            <span class="muted small">${plan.filter((p) => p.done).length} of ${plan.length} done</span></div>
          <ol class="plan">${plan.map((p, i) => `<li class="plan-item ${p.done ? 'done' : ''}">
            <span class="pi-check">${p.done ? '✓' : i + 1}</span><span class="pi-emoji">${p.emoji}</span>
            <div class="pi-text"><b>${p.title}</b><div class="muted small">${p.detail}</div></div>
            <span class="muted small nowrap">${p.mins} min</span>
            <button class="btn ${i === first ? 'primary' : ''}" data-plan="${i}">${p.done ? 'Again' : 'Start'}</button></li>`).join('')}</ol>
          ${first >= 0 ? '<button class="btn small" data-more style="margin-top:10px">➕ Add more</button>' : ''}
        </div>
        <div class="card">
          <h2 style="margin:0 0 4px">🗓️ This week</h2>
          <p class="muted small">Goal: ${d.goal} min on 5 days. A little every day beats one long session.</p>
          <div class="week"><div class="goal-line" style="bottom:${(d.goal / top) * 100}%"></div>
            ${week.map((w) => { const m = mins(w.k); return `<div class="b ${m >= d.goal ? 'met' : m > 0 ? 'part' : ''}" style="height:${Math.max(2, (m / top) * 100)}%" title="${w.label}: ${m} min"></div>`; }).join('')}
          </div>
          <div class="week-labels">${week.map((w) => `<span class="${w.today ? 'today' : ''}">${w.label}</span>`).join('')}</div>
          <button class="btn" data-go="progress" style="margin-top:14px">📈 Progress & weak spots</button>
        </div>
      </div>

      <div class="card">
        <div class="row"><h2 style="margin:0">🌙 Road to Chopin</h2><span class="spacer"></span>
          <span class="muted small">Stage ${cur < 0 ? ms.length : cur + 1} of ${ms.length}</span></div>
        <ol class="road">${ms.map((m, i) => {
          const st = m.pct >= 1 ? 'done' : i === cur ? 'current' : 'future';
          return `<li class="${st}">
            <span class="road-dot">${st === 'done' ? '✓' : m.emoji}</span>
            <div class="road-body">
              <div class="row road-head" data-road><b>${m.title}</b><span class="spacer"></span><span class="muted small">${m.n}/${m.items.length} ▾</span></div>
              <div class="progressbar thin"><div style="width:${m.pct * 100}%"></div></div>
              <div class="chip-row">${m.items.map((it) => `<button class="chip-btn ${it.done ? 'done' : ''}" data-go="${it.go}">${it.done ? '✓ ' : ''}${it.label}</button>`).join('')}</div>
            </div></li>`;
        }).join('')}</ol>
        <p class="muted small">A song counts when you get ★★ (85% or more) with both hands.</p>
      </div>
    </div>`;

    main.addEventListener('click', (e) => {
      const p = e.target.closest('[data-plan]');
      if (p) {
        const it = plan[+p.dataset.plan];
        PL.Audio.init();
        PL.Player.preset = it.preset || null;
        const [view, ...rest] = it.go.split('/');
        PL.App.go(view, rest.join('/'));
        return;
      }
      const more = e.target.closest('[data-more]');
      if (more) {
        if (C.more()) PL.App.go('home');
        else { more.textContent = 'Nothing new to add today — enjoy 🎹 Free play!'; more.disabled = true; }
        return;
      }
      const r = e.target.closest('[data-road]');
      if (r) r.closest('li').classList.toggle('open');
    });
  };

  // ---------- progress page ----------
  C.renderProgress = function (main) {
    const H = Ls().h, S = d.skills, days = PL.App.getDays();
    const accOf = (k) => (S[k] && S[k].n >= 2 ? S[k].acc : null);
    const col = (a) => (a == null ? '#cfcfcf' : a >= 0.85 ? '#3ecf8e' : a >= 0.65 ? '#ffc857' : '#ff5d6c');
    const pct = (a) => (a == null ? '—' : Math.round(a * 100) + '%');
    const readStaff = (clef, from, to) => H.staff({
      clef, stems: false, space: 12, gapX: 30,
      notes: H.whites(from, to).map((n) => { const a = accOf(`read:${clef}:${n}`); return { note: n, color: col(a), label: a == null ? '·' : String(Math.round(a * 100)) }; }),
    });
    const bars = (rows) => {
      const seen = rows.filter(([, k]) => accOf(k) != null);
      if (!seen.length) return '<p class="muted small">No results yet.</p>';
      return seen.map(([label, k]) => { const a = accOf(k); return `<div class="statrow"><span>${label}</span><div class="progressbar thin"><div style="width:${a * 100}%;background:${col(a)}"></div></div><span class="muted small">${pct(a)}</span></div>`; }).join('');
    };
    const conf = [];
    Object.entries(S).forEach(([k, s]) => {
      if (!k.startsWith('read:') || !s.c) return;
      Object.entries(s.c).forEach(([p, c]) => conf.push({ n: +k.split(':')[2], p: +p, c }));
    });
    conf.sort((a, b) => b.c - a.c);
    const totalMin = Math.round(Object.values(days).reduce((a, b) => a + b, 0) / 60);
    const notesRead = Object.entries(S).filter(([k]) => k.startsWith('read:')).reduce((a, [, s]) => a + s.n, 0);
    const lessonsDone = Ls().all.filter((l) => lessonStars(l.id) > 0).length;
    const cal = Array.from({ length: 28 }, (_, i) => {
      const k = day(i - 27), m = (days[k] || 0) / 60;
      const bg = m <= 0 ? 'var(--panel2)' : m >= d.goal ? '#3ecf8e' : m >= d.goal / 2 ? '#2f8f66' : '#1f5c45';
      return `<div title="${k}: ${Math.floor(m)} min" style="background:${bg}"></div>`;
    }).join('');
    const upcoming = Object.entries(d.lessons).filter(([id, l]) => l.due && Ls().byId[id]).sort((a, b) => a[1].due.localeCompare(b[1].due)).slice(0, 8);
    const songs = PL.Songs.list.filter((s) => d.songs[s.id]);

    main.innerHTML = `<div class="wrap stack">
      <h1>📈 Your progress</h1>
      <div class="row">
        <div class="stat"><b>${totalMin}</b><span class="small muted">minutes practised</span></div>
        <div class="stat"><b>${lessonsDone}/${Ls().all.length}</b><span class="small muted">lessons done</span></div>
        <div class="stat"><b>${notesRead}</b><span class="small muted">notes read</span></div>
        <div class="stat"><b>🔥 ${PL.App.streak()}</b><span class="small muted">day streak</span></div>
      </div>

      <div class="dash">
        <div class="card">
          <h2>🎼 Note reading</h2>
          <p class="muted small">How often you find each note first time (%).
            <span style="color:#3ecf8e">● good</span> <span style="color:#ffc857">● getting there</span> <span style="color:#ff5d6c">● needs practice</span> · = not seen yet</p>
          <h3>Treble staff — right hand</h3>${readStaff('treble', 'C4', 'A5')}
          <h3>Bass staff — left hand</h3>${readStaff('bass', 'E2', 'C4')}
          ${conf.length ? `<h3>Notes you mix up</h3><ul>${conf.slice(0, 5).map((x) => `<li>You see <b>${noteName(x.n)}</b> but press <b>${noteName(x.p)}</b> — ${x.c}×</li>`).join('')}</ul>` : ''}
          ${weakest('read:', 2).length >= 2 ? '<button class="btn primary" data-go="review/read">🎯 Practise my tricky notes</button>' : ''}
        </div>
        <div class="card">
          <h2>🗓️ Last 4 weeks</h2>
          <div class="cal">${cal}</div>
          <p class="muted small">Bright green = daily goal reached (${d.goal} min).</p>
          <h3>Coming back for review</h3>
          ${upcoming.length
            ? `<ul class="plain">${upcoming.map(([id, l]) => { const les = Ls().byId[id]; const n = -daysSince(l.due); return `<li>${les.emoji} ${les.title} <span class="muted small">— ${n <= 0 ? 'due now' : n === 1 ? 'tomorrow' : `in ${n} days`}</span></li>`; }).join('')}</ul>`
            : '<p class="muted small">Finished lessons come back here at the right moment, so you don\'t forget them.</p>'}
        </div>
      </div>

      <div class="card">
        <h2>👂 Ear training</h2>
        <div class="grid">
          <div><h3>Notes by ear</h3>${bars(Array.from({ length: 12 }, (_, pc) => [T.name(60 + pc), 'ear:pitch:' + pc]))}</div>
          <div><h3>Intervals</h3>${bars(Object.keys(H.IV).map((s) => [H.IV[s][0], 'ear:iv:' + s]))}</div>
          <div><h3>Chords</h3>${bars(Object.keys(H.CH).map((t) => [H.CH[t][1], 'ear:chord:' + t]))}
            <h3>Scale steps</h3>${bars(Array.from({ length: 7 }, (_, x) => [`${x + 1} · ${T.SOLFEGE[x]}`, 'ear:deg:' + x]))}</div>
        </div>
        ${weakest('ear:', 2).length >= 2 ? '<button class="btn primary" data-go="review/ear">👂 Practise what I mix up</button>' : ''}
      </div>

      <div class="card">
        <h2>🎵 Songs</h2>
        ${songs.length ? `<div style="overflow-x:auto"><table class="songs-t">
          <tr><th>Song</th><th>⏳ Wait mode</th><th>🎯 In tempo</th><th>Top speed at 85%+</th><th>Weakest bars</th></tr>
          ${songs.map((s) => {
            const r = d.songs[s.id];
            const weak = Object.entries(r.bars || {}).filter(([, a]) => a < 0.8).sort((x, y) => x[1] - y[1]).slice(0, 3);
            return `<tr><td data-go="songs/${s.id}" class="link">${s.title}</td><td>${r.wait != null ? r.wait + '%' : '—'}</td><td>${r.play != null ? r.play + '%' : '—'}</td>
              <td>${r.tempo ? Math.round(r.tempo * 100) + '%' : '—'}</td><td>${weak.length ? weak.map(([b, a]) => `bar ${b} (${Math.round(a * 100)}%)`).join(', ') : '—'}</td></tr>`;
          }).join('')}
        </table></div>` : '<p class="muted">Play a song and your results show up here.</p>'}
      </div>
    </div>`;
  };
})();
