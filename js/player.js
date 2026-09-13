// Song practice: scrolling sheet music + falling notes, Wait-for-me / Play-along / Listen modes.
(function () {
  const T = PL.Theory;
  const P = (PL.Player = {});
  const STORE = 'pl.player';

  // Written note values, longest first: [beats, type, dotted, tuplet]
  const VALUES = [[4, 'w', 0], [3, 'h', 1], [2, 'h', 0], [1.5, 'q', 1], [1, 'q', 0], [0.75, 'e', 1], [0.5, 'e', 0], [0.375, 's', 1], [1 / 3, 'e', 0, 3], [0.25, 's', 0]];
  const VALUE_NAME = { w: 'whole note', h: 'half note', q: 'quarter note', e: 'eighth note', s: 'sixteenth note' };
  const valueOf = (d) => VALUES.find(([v]) => d >= v - 0.02) || VALUES[VALUES.length - 1];

  P.mount = function (main, song) {
    main.classList.add('flush');
    const kb = PL.App.kb;
    const beatUnit = 4 / song.timeSig[1];
    const barLen = song.timeSig[0] * beatUnit;
    const notes = song.notes
      .map((n) => ({ ...n, hit: false, miss: false, played: false, skip: false }))
      .sort((a, b) => a.start - b.start || a.note - b.note);
    const lastBeat = Math.max(...notes.map((n) => n.start + n.dur));
    const totalBars = Math.max(1, Math.ceil(lastBeat / barLen - 1e-6));
    const hasL = notes.some((n) => n.hand === 'L');
    const hasR = notes.some((n) => n.hand === 'R');
    const tempos = song.tempos && song.tempos.length ? song.tempos : [{ beat: 0, bpm: song.bpm }];
    const bpmAt = (beat) => {
      let b = tempos[0].bpm;
      for (const t of tempos) { if (t.beat <= beat + 1e-6) b = t.bpm; else break; }
      return b;
    };

    // ---------- notation: key signature, spelling, accidentals, note values, chords ----------
    const keySig = song.imported ? song.keySig || T.detectKey(notes) : song.keySig != null ? song.keySig : T.detectKey(notes);
    const keyAcc = T.keyAccidentals(keySig);
    const groups = []; // notes of one hand starting together, drawn on one stem
    ['R', 'L'].forEach((hand) => {
      const ns = notes.filter((n) => (n.hand === 'L' ? 'L' : 'R') === hand);
      const onsets = [...new Set(ns.map((n) => +n.start.toFixed(3)))].sort((a, b) => a - b);
      const index = new Map(onsets.map((o, i) => [o, i]));
      const byStart = new Map();
      ns.forEach((n) => {
        const k = +n.start.toFixed(3);
        const next = onsets[index.get(k) + 1];
        // written length: until the next note in this hand, so overlapping (legato) notes stay readable
        n.sdur = next != null ? Math.max(Math.min(n.dur, next - n.start), Math.min(n.dur, 0.25)) : n.dur;
        if (!byStart.has(k)) { const g = { hand, start: n.start, notes: [] }; byStart.set(k, g); groups.push(g); }
        byStart.get(k).notes.push(n);
      });
    });
    groups.sort((a, b) => a.start - b.start);
    const accMem = new Map(); // an accidental lasts until the end of its bar
    groups.forEach((g) => {
      const bar = Math.floor(g.start / barLen + 1e-6);
      g.notes.sort((a, b) => a.note - b.note);
      g.notes.forEach((n) => {
        n.sp = T.spellInKey(n.note, keySig, n.flat);
        const k = `${bar}:${g.hand}:${n.sp.pos}`;
        const current = accMem.has(k) ? accMem.get(k) : keyAcc[n.sp.letter];
        n.showAcc = n.sp.acc !== current;
        accMem.set(k, n.sp.acc);
      });
      g.sdur = Math.min(...g.notes.map((n) => n.sdur));
      g.value = valueOf(g.sdur);
    });
    const nameOf = (n) => T.nameLA(n.sp.letter, n.sp.acc, T.settings.naming === 'both' ? 'solfege' : T.settings.naming);
    // index of the last group starting at or before a beat
    const groupAt = (beat) => {
      let lo = 0, hi = groups.length - 1, ans = -1;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (groups[mid].start <= beat + 1e-6) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
      return ans;
    };

    // horizontal spacing on the sheet adapts to the shortest gap between notes
    let minGap = 1;
    for (let i = 1; i < groups.length; i++) {
      const gap = groups[i].start - groups[i - 1].start;
      if (gap > 1e-3) minGap = Math.min(minGap, Math.max(0.25, gap));
    }
    const xpb = Math.min(150, Math.max(56, 32 / minGap));

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) {}
    const S = {
      mode: saved.mode || 'wait',
      hands: 'both',
      tempo: saved.tempo || 0.6,
      metro: saved.metro !== undefined ? saved.metro : true,
      names: saved.names !== undefined ? saved.names : true,
      hints: saved.hints !== undefined ? saved.hints : true,
      count: saved.count !== undefined ? saved.count : true,
      playing: false,
      finished: false,
      pos: -barLen - 0.001,
      loop: false, loopA: 1, loopB: Math.min(4, totalBars),
      wrong: 0,
      barWrong: {},
    };
    const persist = () => {
      try { localStorage.setItem(STORE, JSON.stringify({ mode: S.mode, tempo: S.tempo, metro: S.metro, names: S.names, hints: S.hints, count: S.count })); } catch (e) {}
    };
    // Settings suggested by today's practice plan (one-shot).
    const preset = P.preset;
    P.preset = null;
    if (preset) {
      S.mode = preset.mode || S.mode;
      S.tempo = preset.tempo || S.tempo;
      if ((preset.hands === 'right' && hasR && hasL) || (preset.hands === 'left' && hasL && hasR)) S.hands = preset.hands;
    }

    // keyboard range fitted to the song (at least 3 octaves)
    let lo = Math.min(...notes.map((n) => n.note)) - 2, hi = Math.max(...notes.map((n) => n.note)) + 2;
    while (hi - lo < 36) { lo--; if (hi - lo < 36) hi++; }
    lo -= T.pc(lo); hi += (12 - T.pc(hi)) % 12;
    const [RL, RH] = PL.App.range();
    kb.setRange(Math.max(RL, lo), Math.min(RH, hi));
    const outside = notes.filter((n) => n.note < RL || n.note > RH).length;

    main.innerHTML = `
      <div class="player-bar">
        <button class="btn" data-a="back">← Songs</button>
        <span class="title">${song.title} <span class="muted small">${song.composer || ''}</span></span>
        <div class="seg" data-g="mode">
          <button data-v="wait" title="The music waits until you press the right keys">⏳ Wait for me</button>
          <button data-v="play" title="Music keeps going — play in time">🎯 Play in tempo</button>
          <button data-v="listen" title="Just listen and watch">👂 Listen</button>
        </div>
        <div class="seg" data-g="hands">
          <button data-v="left" ${hasL ? '' : 'disabled'} title="Left hand only"><span class="hb l">L</span> Left hand</button>
          <button data-v="both">Both hands</button>
          <button data-v="right" ${hasR ? '' : 'disabled'} title="Right hand only">Right hand <span class="hb r">R</span></button>
        </div>
        <label class="row small muted">Speed
          <input type="range" min="0.2" max="1.5" step="0.05" data-a="tempo">
          <b data-o="tempo" style="color:var(--text);min-width:92px"></b>
        </label>
        <span class="spacer"></span>
        <button class="btn" data-t="metro" title="Metronome click">🥁 Click</button>
        <button class="btn" data-t="count" title="Beat counting under the music">🔢 Count</button>
        <button class="btn" data-t="names" title="Note names on the music">🔤 Names</button>
        <button class="btn" data-t="hints" title="Light up the next keys">💡 Hints</button>
      </div>
      <div class="player-bar">
        <button class="btn primary" data-a="play">▶ Play</button>
        <button class="btn" data-a="restart">⟲ Restart</button>
        <input type="range" min="0" max="${totalBars}" step="1" value="0" data-a="seek" style="flex:1;min-width:120px">
        <span class="small muted" data-o="bar"></span>
        <button class="btn" data-t="loop" title="Repeat a few bars until you know them">🔁 Loop bars</button>
        <label class="small muted">from <select data-a="loopA"></select></label>
        <label class="small muted">to <select data-a="loopB"></select></label>
        ${song.raw ? '<button class="btn" data-a="parts" title="Choose which instrument parts each hand plays">🎚️ Parts</button>' : ''}
        ${song.level === 'Custom' && !song.raw ? '<span class="small muted">Import this file again to choose its parts</span>' : ''}
      </div>
      <div class="sheet-strip"><canvas data-c="sheet"></canvas></div>
      <div class="fall-area">
        <canvas data-c="fall"></canvas>
        <div class="hud"></div>
        <div class="countin"></div>
        <div class="result" hidden style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(10,11,16,.7)"></div>
      </div>`;

    const $ = (sel) => main.querySelector(sel);
    const sheetC = $('[data-c=sheet]'), fallC = $('[data-c=fall]');
    const hud = $('.hud'), countEl = $('.countin'), resultEl = $('.result');

    // ---------- controls ----------
    const barOpts = Array.from({ length: totalBars }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
    $('[data-a=loopA]').innerHTML = barOpts;
    $('[data-a=loopB]').innerHTML = barOpts;
    $('[data-a=loopA]').value = S.loopA;
    $('[data-a=loopB]').value = S.loopB;

    const tempoText = () => `${Math.round(S.tempo * 100)}% · ${Math.round(bpmAt(Math.max(0, S.pos)) * S.tempo)} bpm`;
    function syncUI() {
      main.querySelectorAll('.seg').forEach((seg) => {
        const val = S[seg.dataset.g];
        seg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === val));
      });
      ['metro', 'count', 'names', 'hints', 'loop'].forEach((k) => $(`[data-t=${k}]`).classList.toggle('on', S[k]));
      $('[data-a=tempo]').value = S.tempo;
      $('[data-o=tempo]').textContent = tempoText();
      $('[data-a=play]').textContent = S.playing ? '⏸ Pause' : '▶ Play';
    }

    main.addEventListener('click', (e) => {
      const segBtn = e.target.closest('.seg button');
      if (segBtn && !segBtn.disabled) {
        S[segBtn.closest('.seg').dataset.g] = segBtn.dataset.v;
        persist(); restart(); syncUI();
        return;
      }
      const t = e.target.closest('[data-t]');
      if (t) { S[t.dataset.t] = !S[t.dataset.t]; persist(); if (t.dataset.t === 'hints') kb.clearHints(), (lastHintKey = ''); syncUI(); return; }
      const a = e.target.closest('button[data-a]');
      if (!a) return;
      PL.Audio.init();
      if (a.dataset.a === 'back') PL.App.go('songs');
      if (a.dataset.a === 'play') togglePlay();
      if (a.dataset.a === 'restart') { restart(); S.playing = true; syncUI(); }
      if (a.dataset.a === 'parts') {
        S.playing = false; syncUI();
        PL.App.pickTracks(song, (updated) => { PL.App.replaceImported(updated); PL.App.go('songs', updated.id); });
      }
    });
    main.addEventListener('input', (e) => {
      const a = e.target.dataset.a;
      if (a === 'tempo') { S.tempo = +e.target.value; persist(); syncUI(); }
      if (a === 'seek') { seekBeat(+e.target.value * barLen); }
    });
    main.addEventListener('change', (e) => {
      const a = e.target.dataset.a;
      if (a === 'loopA' || a === 'loopB') {
        S.loopA = +$('[data-a=loopA]').value;
        S.loopB = Math.max(S.loopA, +$('[data-a=loopB]').value);
        $('[data-a=loopB]').value = S.loopB;
        if (S.loop) seekBeat((S.loopA - 1) * barLen);
      }
    });

    const handChosen = (n) => S.hands === 'both' || (S.hands === 'right' ? n.hand === 'R' : n.hand === 'L');
    const isActive = (n) => S.mode !== 'listen' && n.note >= RL && n.note <= RH && handChosen(n);
    const bps = () => (bpmAt(Math.max(0, S.pos)) * S.tempo) / 60;
    const addWrong = () => {
      S.wrong++;
      const b = Math.max(0, Math.floor(S.pos / barLen));
      S.barWrong[b] = (S.barWrong[b] || 0) + 1;
    };

    function seekBeat(beat) {
      notes.forEach((n) => {
        const before = n.start < beat - 1e-6;
        n.skip = before; n.hit = false; n.miss = false; n.played = before;
      });
      S.pos = beat - (beat === 0 ? barLen + 0.001 : 0.001);
      S.finished = false;
      resultEl.hidden = true;
    }
    function restart() {
      S.playing = false; S.wrong = 0; S.barWrong = {};
      seekBeat(S.loop ? (S.loopA - 1) * barLen : 0);
      kb.clearHints(); lastHintKey = '';
    }
    function togglePlay() {
      if (S.finished) restart();
      S.playing = !S.playing;
      syncUI();
    }

    // The next chord the player must press (wait mode)
    function currentGroup() {
      let first = null;
      for (const n of notes) {
        if (n.skip || n.hit || !isActive(n)) continue;
        first = n; break;
      }
      if (!first) return null;
      return { start: first.start, notes: notes.filter((n) => !n.skip && !n.hit && isActive(n) && Math.abs(n.start - first.start) < 0.04) };
    }

    // ---------- input ----------
    const offInput = PL.Input.on((ev) => {
      if (ev.type !== 'on' || S.mode === 'listen' || S.finished) return;
      if (S.mode === 'wait') {
        const g = currentGroup();
        if (g && g.start - S.pos <= 2 * barLen) {
          const m = g.notes.find((n) => n.note === ev.note);
          if (m) {
            m.hit = true;
            kb.flash(ev.note, 'good');
            if (!S.playing) { S.playing = true; if (S.pos < g.start - 0.001 && S.pos < 0) S.pos = g.start - 0.001; syncUI(); }
            return;
          }
        }
        // pressing a note that was already correct in this chord is fine
        const recent = notes.some((n) => n.hit && n.note === ev.note && Math.abs(n.start - S.pos) < 0.3);
        if (!recent) { addWrong(); kb.flash(ev.note, 'bad'); }
      } else {
        const win = Math.min(0.5, 0.22 * bps());
        let best = null;
        for (const n of notes) {
          if (n.start > S.pos + win) break;
          if (n.skip || n.hit || n.miss || n.note !== ev.note || !isActive(n)) continue;
          if (Math.abs(n.start - S.pos) <= win && (!best || Math.abs(n.start - S.pos) < Math.abs(best.start - S.pos))) best = n;
        }
        if (best) { best.hit = true; best.delta = (S.pos - best.start) / bps(); kb.flash(ev.note, 'good'); }
        else { addWrong(); kb.flash(ev.note, 'bad'); }
      }
    });

    // ---------- time ----------
    let raf = 0, lastT = null, lastHintKey = '';
    function frame(t) {
      raf = requestAnimationFrame(frame);
      const dt = lastT == null ? 0 : Math.min(0.1, (t - lastT) / 1000);
      lastT = t;
      if (S.playing) advance(dt);
      updateHints();
      drawFall();
      drawSheet();
      drawHud();
    }

    function advance(dt) {
      const prev = S.pos;
      let next = prev + dt * bps();
      let waiting = false;
      if (S.mode === 'wait') {
        const g = currentGroup();
        if (g && next >= g.start) { next = Math.max(prev, g.start); waiting = true; }
      }
      // metronome + count-in
      if (!waiting || next > prev) {
        const k0 = Math.floor(prev / beatUnit + 1e-6), k1 = Math.floor(next / beatUnit + 1e-6);
        for (let k = k0 + 1; k <= k1; k++) {
          const b = k * beatUnit;
          if (S.metro || b < 0) PL.Audio.click(Math.abs((((b % barLen) + barLen) % barLen)) < 1e-6);
        }
      }
      // autoplay (listen mode / the other hand) and misses (play mode)
      const win = Math.min(0.5, 0.22 * bps());
      for (const n of notes) {
        if (n.start > next) break;
        if (n.skip) continue;
        if (!isActive(n)) {
          if (!n.played && n.start >= prev - 1e-6 && n.start <= next) {
            n.played = true;
            PL.Audio.play(n.note, n.dur / bps(), (n.vel || 0.7) * 0.85);
            kb.flash(n.note, 'down', Math.max(120, (n.dur / bps()) * 900));
          }
        } else if (S.mode === 'play' && !n.hit && !n.miss && n.start + win < next) {
          n.miss = true;
        }
      }
      S.pos = next;
      if (S.loop && S.pos >= S.loopB * barLen) { seekBeat((S.loopA - 1) * barLen); S.pos = (S.loopA - 1) * barLen - barLen; return; }
      if (S.pos > lastBeat + beatUnit) finish();
      $('[data-a=seek]').value = Math.max(0, Math.floor(S.pos / barLen));
    }

    function updateHints() {
      if (!S.hints || S.mode === 'listen') { if (lastHintKey) { kb.clearHints(); lastHintKey = ''; } return; }
      let target = [];
      if (S.mode === 'wait') { const g = currentGroup(); if (g && g.start - S.pos < barLen) target = g.notes.map((n) => n.note); }
      else target = notes.filter((n) => isActive(n) && !n.skip && !n.hit && !n.miss && n.start - S.pos < 0.35 && n.start - S.pos > -0.1).map((n) => n.note);
      const key = target.join(',');
      if (key !== lastHintKey) { lastHintKey = key; key ? kb.hint(target) : kb.clearHints(); }
    }

    function stats() {
      const act = notes.filter((n) => isActive(n) && !n.skip);
      const hits = act.filter((n) => n.hit).length;
      const acc = S.mode === 'wait' ? hits / Math.max(1, hits + S.wrong) : hits / Math.max(1, act.length + S.wrong * 0.5);
      return { total: act.length, hits, acc: Math.max(0, Math.min(1, acc)) };
    }

    function finish() {
      S.playing = false; S.finished = true; syncUI();
      kb.clearHints(); lastHintKey = '';
      if (S.mode === 'listen') { resultEl.hidden = true; return; }
      const st = stats();
      const pct = Math.round(st.acc * 100);
      const stars = pct >= 95 && S.tempo >= 0.9 ? 3 : pct >= 85 ? 2 : pct >= 60 ? 1 : 0;
      if (S.hands === 'both' || !(hasL && hasR)) PL.App.setStars('song:' + song.id, stars);
      const barAcc = Array.from({ length: totalBars }, (_, b) => {
        const ns = notes.filter((n) => isActive(n) && !n.skip && Math.floor(n.start / barLen + 1e-6) === b);
        if (!ns.length) return null;
        return Math.min(1, ns.filter((n) => n.hit).length / (ns.length + (S.barWrong[b] || 0) * 0.5));
      });
      PL.Coach.songDone(song.id, { mode: S.mode, pct, tempo: S.tempo, hands: S.hands, single: !(hasL && hasR), bars: barAcc });
      const timed = notes.filter((n) => n.delta != null && !n.skip);
      const avg = timed.length ? timed.reduce((s, n) => s + n.delta, 0) / timed.length : 0;
      let tip = '';
      if (S.mode === 'play' && timed.length > 3) {
        if (avg > 0.06) tip = 'You tend to play a little <b>late</b>. Listen to the click and press <i>with</i> it.';
        else if (avg < -0.06) tip = 'You tend to rush — a little <b>early</b>. Relax and wait for the click.';
        else tip = 'Your timing is steady. 👏';
      }
      if (S.mode === 'wait' && pct >= 85) tip = 'Great! Now try <b>🎯 Play in tempo</b> at this speed.';
      if (S.mode === 'play' && pct >= 90 && S.tempo < 1) tip += ' Ready to go a bit faster (+10%)?';
      if (pct < 60) tip = 'Tip: loop 2–4 bars, use one hand at a time, and slow the speed down.';
      resultEl.innerHTML = `<div class="card" style="text-align:center;min-width:320px">
          <div class="stars" style="font-size:36px">${'★'.repeat(stars)}<span class="off">${'★'.repeat(3 - stars)}</span></div>
          <div class="result-big">${pct}%</div>
          <p class="muted">${st.hits} of ${st.total} notes correct · ${S.wrong} wrong key${S.wrong === 1 ? '' : 's'} · speed ${Math.round(S.tempo * 100)}%</p>
          ${tip ? `<div class="tip">${tip}</div>` : ''}
          <div class="row" style="justify-content:center">
            <button class="btn" data-r="slower">🐢 Slower</button>
            <button class="btn primary" data-r="again">⟲ Again</button>
            <button class="btn" data-r="faster">🐇 Faster</button>
          </div></div>`;
      resultEl.hidden = false;
      resultEl.style.display = 'flex';
    }
    resultEl.addEventListener('click', (e) => {
      const r = e.target.closest('[data-r]');
      if (!r) return;
      if (r.dataset.r === 'slower') S.tempo = Math.max(0.2, +(S.tempo - 0.1).toFixed(2));
      if (r.dataset.r === 'faster') S.tempo = Math.min(1.5, +(S.tempo + 0.1).toFixed(2));
      persist(); restart(); resultEl.style.display = 'none'; S.playing = true; syncUI();
    });

    // ---------- drawing ----------
    function sizeCanvas(c) {
      const r = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      const ctx = c.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { ctx, w: r.width, h: r.height, rect: r };
    }
    function rr(ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    const beatInBar = (beat) => (((beat % barLen) + barLen) % barLen) / beatUnit; // 0-based, can be fractional

    function drawFall() {
      const { ctx, w, h, rect } = sizeCanvas(fallC);
      ctx.clearRect(0, 0, w, h);
      const kr = kb.el.getBoundingClientRect();
      const offX = kr.left - rect.left, kw = kr.width;
      const ppb = Math.max(70, Math.min(150, h / 3.2)); // pixels per beat: same look at every speed
      const look = h / ppb;
      const pos = S.pos;

      // key lanes
      ctx.strokeStyle = 'rgba(255,255,255,.05)';
      for (let n = kb.low; n <= kb.high; n++) {
        if (T.pc(n) === 0 || T.pc(n) === 5) {
          const x = offX + kb.geom(n).x * kw;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
      }
      // bar & beat lines with counts
      ctx.font = '11px sans-serif';
      for (let b = Math.floor(pos / beatUnit); b * beatUnit < pos + look; b++) {
        const beat = b * beatUnit;
        if (beat < 0) continue;
        const y = h - (beat - pos) * ppb;
        const isBar = Math.abs(beatInBar(beat)) < 1e-6;
        ctx.strokeStyle = isBar ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.08)';
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        ctx.fillStyle = isBar ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.3)';
        ctx.fillText(isBar ? `bar ${Math.round(beat / barLen) + 1} · 1` : String(Math.round(beatInBar(beat)) + 1), 6, y - 4);
      }
      // loop region
      if (S.loop) {
        const yB = h - (S.loopB * barLen - pos) * ppb;
        ctx.fillStyle = 'rgba(255,200,87,.5)'; ctx.fillRect(0, yB - 1, w, 2);
      }
      // notes
      const g = S.mode === 'wait' ? currentGroup() : null;
      for (const n of notes) {
        if (n.start > pos + look) break;
        if (n.start + n.dur < pos - 1 || n.note < kb.low || n.note > kb.high) continue;
        const kg = kb.geom(n.note);
        const x = offX + kg.x * kw + 1, wd = kg.w * kw - 2;
        const yb = h - (n.start - pos) * ppb, yt = h - (n.start + n.dur - pos) * ppb;
        const hgt = Math.max(6, yb - yt - 2);
        let col = T.settings.colors ? T.color(n.note) : n.hand === 'R' ? '#7c9cff' : '#3ecf8e';
        if (n.hit) col = '#3ecf8e';
        if (n.miss) col = '#ff5d6c';
        ctx.globalAlpha = (S.mode === 'listen' ? handChosen(n) : isActive(n)) ? 1 : 0.3;
        rr(ctx, x, yt, wd, hgt, 5);
        ctx.fillStyle = col; ctx.fill();
        if (kg.black) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill(); }
        if (n.hand === 'L') { // left hand: diagonal stripes
          ctx.save(); ctx.clip();
          ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 3;
          for (let sx = x - hgt; sx < x + wd; sx += 9) { ctx.beginPath(); ctx.moveTo(sx, yt + hgt); ctx.lineTo(sx + hgt, yt); ctx.stroke(); }
          ctx.restore();
          rr(ctx, x, yt, wd, hgt, 5);
        }
        ctx.lineWidth = 2;
        ctx.strokeStyle = g && g.notes.includes(n) ? '#fff' : n.hand === 'L' ? '#3ecf8e' : '#9db4ff';
        ctx.stroke();
        if (S.names && wd > 13 && hgt > 16) {
          ctx.fillStyle = kg.black ? '#fff' : '#111';
          ctx.font = `bold ${wd > 24 ? 12 : 9}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(nameOf(n), x + wd / 2, yb - 7);
          ctx.textAlign = 'left';
        }
        ctx.globalAlpha = 1;
      }
      // now line
      const grad = ctx.createLinearGradient(0, h - 14, 0, h);
      grad.addColorStop(0, 'rgba(124,156,255,0)'); grad.addColorStop(1, 'rgba(124,156,255,.45)');
      ctx.fillStyle = grad; ctx.fillRect(0, h - 14, w, 14);

      countEl.textContent = pos < 0 && S.playing ? Math.ceil(-pos / beatUnit) : '';
    }

    function drawSheet() {
      const { ctx, w, h } = sizeCanvas(sheetC);
      const s = 9;
      const top = { treble: 34, bass: 130 };
      const { TOP, MID, BOT } = T.STAFF;
      const Y = (p, c) => top[c] + (TOP[c] - p) * (s / 2);
      const panel = 66 + Math.abs(keySig) * 8;
      const playX = Math.max(panel + 70, w * 0.28);
      const pos = Math.max(0, S.pos);
      const rx = s * 0.62, ry = s * 0.46;
      ctx.fillStyle = '#f7f4ea'; ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
      ['treble', 'bass'].forEach((c) => {
        for (let i = 0; i < 5; i++) { const y = top[c] + i * s; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      });

      const beatL = pos - (playX - panel) / xpb, beatR = pos + (w - playX) / xpb;
      // bar lines and numbers
      ctx.font = '10px sans-serif'; ctx.fillStyle = '#777';
      for (let b = Math.max(0, Math.floor(beatL / barLen)); b * barLen <= beatR; b++) {
        const x = playX + (b * barLen - pos) * xpb;
        if (x < panel) continue;
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x, top.treble); ctx.lineTo(x, top.bass + 4 * s); ctx.stroke();
        ctx.fillText(b + 1, x + 3, top.treble - 14);
      }
      // playhead band
      ctx.fillStyle = 'rgba(124,156,255,.16)'; ctx.fillRect(playX - 14, 8, 28, h - 16);

      // beat counting between the staves: 1 & 2 & 3 &
      if (S.count) {
        const step = xpb * beatUnit >= 44 ? beatUnit / 2 : beatUnit;
        const cy = top.treble + 4 * s + 38;
        const curBeat = Math.floor(pos / beatUnit + 1e-6);
        ctx.textAlign = 'center';
        for (let k = Math.max(0, Math.floor(beatL / step)); k * step <= beatR; k++) {
          const b = k * step, x = playX + (b - pos) * xpb;
          if (x < panel + 8) continue;
          const inBar = beatInBar(b);
          const half = Math.abs(inBar - Math.round(inBar)) > 1e-6;
          const now = !half && S.pos >= 0 && Math.round(b / beatUnit) === curBeat;
          ctx.font = now ? 'bold 15px sans-serif' : half ? '10px sans-serif' : 'bold 11px sans-serif';
          ctx.fillStyle = now ? '#3b5bdb' : half ? '#aaa' : '#666';
          ctx.fillText(half ? '&' : String(Math.round(inBar) + 1), x, cy);
        }
        ctx.textAlign = 'left';
      }

      const wg = S.mode === 'wait' ? currentGroup() : null;
      const labelEnd = { R: -1e9, L: -1e9 };
      ctx.save(); // keep notes out of the clef panel
      ctx.beginPath(); ctx.rect(panel, 0, w - panel, h); ctx.clip();
      for (let gi = Math.max(0, groupAt(beatL - 2)); gi < groups.length; gi++) {
        const grp = groups[gi];
        if (grp.start > beatR) break;
        const x = playX + (grp.start - pos) * xpb;
        if (x < panel - 6) continue;
        const c = grp.hand === 'L' ? 'bass' : 'treble';
        const [, type, dotted, tuplet] = grp.value;
        const ps = grp.notes.map((n) => n.sp.pos);
        const up = ps.reduce((a, b) => a + b, 0) / ps.length < MID[c];
        const lowP = Math.min(...ps), highP = Math.max(...ps);

        // ledger lines
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
        for (let q = BOT[c] - 2; q >= lowP; q -= 2) { ctx.beginPath(); ctx.moveTo(x - 11, Y(q, c)); ctx.lineTo(x + 11, Y(q, c)); ctx.stroke(); }
        for (let q = TOP[c] + 2; q <= highP; q += 2) { ctx.beginPath(); ctx.moveTo(x - 11, Y(q, c)); ctx.lineTo(x + 11, Y(q, c)); ctx.stroke(); }
        if (wg && grp.notes.some((n) => wg.notes.includes(n))) {
          ctx.fillStyle = 'rgba(124,156,255,.3)';
          ctx.beginPath(); ctx.ellipse(x, (Y(lowP, c) + Y(highP, c)) / 2, s * 1.4, (Y(lowP, c) - Y(highP, c)) / 2 + s * 1.2, 0, 0, 7); ctx.fill();
        }

        // note heads (neighbouring notes in a chord sit on opposite sides of the stem)
        let shifted = false, accCount = 0;
        grp.notes.forEach((n, i) => {
          const dx = i > 0 && ps[i] - ps[i - 1] === 1 && !shifted ? (up ? 2 * rx - 1 : -(2 * rx - 1)) : 0;
          shifted = dx !== 0;
          const hx = x + dx, y = Y(n.sp.pos, c);
          let col = T.settings.colors ? T.color(n.note) : '#111';
          if (n.hit) col = '#1f9e62';
          if (n.miss) col = '#e0364a';
          ctx.save(); ctx.translate(hx, y); ctx.rotate(-0.35);
          ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 7);
          if (type === 'w' || type === 'h') { ctx.fillStyle = '#f7f4ea'; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = col; ctx.stroke(); }
          else { ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#111'; ctx.stroke(); }
          ctx.restore();
          if (dotted) {
            const onLine = (n.sp.pos - TOP[c]) % 2 === 0;
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(hx + rx + 4, y - (onLine ? s / 2 : 0), 1.8, 0, 7); ctx.fill();
          }
          if (n.showAcc) {
            ctx.fillStyle = '#111'; ctx.font = '15px serif';
            ctx.fillText(n.sp.acc > 0 ? '♯' : n.sp.acc < 0 ? '♭' : '♮', x - rx - 11 - accCount * 8, y + 5);
            accCount++;
          }
        });

        // one stem for the whole chord, with flags
        if (type !== 'w') {
          const sx = up ? x + rx - 1 : x - rx + 1;
          const y1 = up ? Y(lowP, c) : Y(highP, c);
          const y2 = up ? Y(highP, c) - s * 3.3 : Y(lowP, c) + s * 3.3;
          ctx.strokeStyle = '#111'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(sx, y1); ctx.lineTo(sx, y2); ctx.stroke();
          const flags = type === 'e' ? 1 : type === 's' ? 2 : 0;
          for (let f = 0; f < flags; f++) {
            const fy = y2 + (up ? 1 : -1) * f * 6;
            ctx.beginPath(); ctx.moveTo(sx, fy); ctx.quadraticCurveTo(sx + 9, fy + (up ? 6 : -6), sx + 6, fy + (up ? 13 : -13)); ctx.stroke();
          }
          if (tuplet) { ctx.fillStyle = '#555'; ctx.font = 'italic bold 10px serif'; ctx.fillText('3', sx - 3, up ? y2 - 3 : y2 + 11); }
        }

        // note names, skipped when they would overlap
        if (S.names) {
          ctx.font = 'bold 10px sans-serif';
          const txt = [...new Set(grp.notes.map(nameOf))].join('/');
          const tw = ctx.measureText(txt).width;
          if (x - tw / 2 > labelEnd[grp.hand] + 4) {
            ctx.fillStyle = '#555'; ctx.textAlign = 'center';
            ctx.fillText(txt, x, grp.hand === 'L' ? top.bass + 4 * s + 24 : top.treble + 4 * s + 20);
            ctx.textAlign = 'left';
            labelEnd[grp.hand] = x + tw / 2;
          }
        }
      }

      ctx.restore();

      // clef, key signature and time signature panel
      ctx.fillStyle = '#f7f4ea'; ctx.fillRect(0, 0, panel, h);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
      ['treble', 'bass'].forEach((c) => { for (let i = 0; i < 5; i++) { const y = top[c] + i * s; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(panel, y); ctx.stroke(); } });
      T.drawClef(ctx, 'treble', 6, top.treble, s);
      T.drawClef(ctx, 'bass', 4, top.bass, s);
      const SH = [38, 35, 39, 36, 33, 37, 34], FL = [34, 37, 33, 36, 32, 35, 31]; // treble staff positions
      ctx.fillStyle = '#111';
      ['treble', 'bass'].forEach((c) => {
        ctx.font = '16px serif';
        for (let k = 0; k < Math.abs(keySig); k++) {
          const p = (keySig > 0 ? SH : FL)[k] - (c === 'bass' ? 14 : 0);
          ctx.fillText(keySig > 0 ? '♯' : '♭', 38 + k * 8, Y(p, c) + 5);
        }
        ctx.font = `bold ${s * 2}px serif`;
        ctx.fillText(song.timeSig[0], 42 + Math.abs(keySig) * 8, top[c] + s * 1.8);
        ctx.fillText(song.timeSig[1], 42 + Math.abs(keySig) * 8, top[c] + s * 3.8);
      });
      ctx.fillStyle = '#7c9cff'; ctx.fillRect(playX - 1, 10, 2, h - 20);
    }

    // What is sounding now in each hand, with its written length.
    function nowPlaying() {
      const last = groupAt(S.pos);
      const found = {};
      for (let i = last; i >= 0 && i > last - 40; i--) {
        const grp = groups[i];
        if (!found[grp.hand] && S.pos < grp.start + grp.sdur) found[grp.hand] = grp;
      }
      return ['R', 'L'].filter((hd) => found[hd]).map((hd) => {
        const grp = found[hd];
        const [, type, dotted, tuplet] = grp.value;
        const beats = +(grp.sdur / beatUnit).toFixed(2);
        return `<div><span class="hb ${hd.toLowerCase()}">${hd}</span> <b>${[...new Set(grp.notes.map(nameOf))].join(' ')}</b> · ${tuplet ? 'triplet ' : ''}${dotted ? 'dotted ' : ''}${VALUE_NAME[type]} · ${beats} beat${beats === 1 ? '' : 's'}</div>`;
      }).join('');
    }

    let hudHtml = '';
    function drawHud() {
      const st = stats();
      const bar = Math.max(1, Math.floor(Math.max(0, S.pos) / barLen) + 1);
      $('[data-o=bar]').textContent = `bar ${Math.min(bar, totalBars)} / ${totalBars}`;
      const tt = tempoText();
      if ($('[data-o=tempo]').textContent !== tt) $('[data-o=tempo]').textContent = tt;
      const beatTxt = S.pos < 0 ? 'Count-in…' : `Beat <b>${Math.floor(beatInBar(S.pos) + 1e-6) + 1}</b> of ${song.timeSig[0]}`;
      let html = `<div class="beatnow">${beatTxt}</div>${nowPlaying()}`;
      if (S.mode === 'listen') html += '<div class="muted small">👂 Listening — watch the keys and count along</div>';
      else html += `<div><b>${st.hits}</b> / ${st.total} notes · <span style="color:var(--bad)">${S.wrong} wrong</span></div>${S.mode === 'wait' && !S.playing && !S.finished ? '<div>Press the glowing key to start</div>' : ''}`;
      if (hasL && hasR) html += '<div class="small muted hud-legend">Blue outline = right hand · green stripes = left hand</div>';
      if (html !== hudHtml) { hud.innerHTML = html; hudHtml = html; }
    }

    syncUI();
    restart();
    PL.App.setKbdHint((outside ? `${outside} notes are outside your keyboard — the app plays them for you. ` : '') +
      (S.mode === 'wait' ? 'Tip: in ⏳ Wait mode the music stops until you press the right key.' : ''));
    raf = requestAnimationFrame(frame);

    const onKey = (e) => { if (e.code === 'Space' && e.target.tagName !== 'INPUT') { e.preventDefault(); PL.Audio.init(); togglePlay(); } };
    window.addEventListener('keydown', onKey);

    return function cleanup() {
      cancelAnimationFrame(raf);
      offInput();
      window.removeEventListener('keydown', onKey);
      kb.clearHints();
      main.classList.remove('flush');
    };
  };
})();
