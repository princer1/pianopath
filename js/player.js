// Song practice: scrolling sheet music + falling notes, Wait-for-me / Play-along / Listen modes.
(function () {
  const T = PL.Theory;
  const P = (PL.Player = {});
  const STORE = 'pl.player';

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

    // chord labels for the sheet (grouped by hand + start)
    const chordLabels = new Map();
    notes.forEach((n) => {
      const k = n.hand + '@' + n.start.toFixed(3);
      if (!chordLabels.has(k)) chordLabels.set(k, { start: n.start, hand: n.hand, notes: [] });
      chordLabels.get(k).notes.push(n);
    });

    // spacing on the sheet adapts to the shortest gap between notes
    const starts = [...new Set(notes.map((n) => +n.start.toFixed(3)))].sort((a, b) => a - b);
    let minGap = 1;
    for (let i = 1; i < starts.length; i++) minGap = Math.min(minGap, Math.max(0.125, starts[i] - starts[i - 1]));
    const xpb = Math.min(140, Math.max(50, 28 / minGap));

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) {}
    const S = {
      mode: saved.mode || 'wait',
      hands: 'both',
      tempo: saved.tempo || 0.6,
      metro: saved.metro !== undefined ? saved.metro : true,
      names: saved.names !== undefined ? saved.names : true,
      hints: saved.hints !== undefined ? saved.hints : true,
      playing: false,
      finished: false,
      pos: -barLen - 0.001,
      loop: false, loopA: 1, loopB: Math.min(4, totalBars),
      wrong: 0,
    };
    const persist = () => {
      try { localStorage.setItem(STORE, JSON.stringify({ mode: S.mode, tempo: S.tempo, metro: S.metro, names: S.names, hints: S.hints })); } catch (e) {}
    };

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
          <button data-v="both">Both hands</button>
          <button data-v="right" ${hasR ? '' : 'disabled'}>Right ✋</button>
          <button data-v="left" ${hasL ? '' : 'disabled'}>🤚 Left</button>
        </div>
        <label class="row small muted">Speed
          <input type="range" min="0.2" max="1.5" step="0.05" data-a="tempo">
          <b data-o="tempo" style="color:var(--text);min-width:92px"></b>
        </label>
        <span class="spacer"></span>
        <button class="btn" data-t="metro" title="Metronome click">🥁 Click</button>
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

    function syncUI() {
      main.querySelectorAll('.seg').forEach((seg) => {
        const val = S[seg.dataset.g];
        seg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === val));
      });
      ['metro', 'names', 'hints', 'loop'].forEach((k) => $(`[data-t=${k}]`).classList.toggle('on', S[k]));
      $('[data-a=tempo]').value = S.tempo;
      $('[data-o=tempo]').textContent = `${Math.round(S.tempo * 100)}% · ${Math.round(song.bpm * S.tempo)} bpm`;
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

    const isActive = (n) =>
      S.mode !== 'listen' && n.note >= RL && n.note <= RH && (S.hands === 'both' || (S.hands === 'right' && n.hand === 'R') || (S.hands === 'left' && n.hand === 'L'));
    const bps = () => (song.bpm * S.tempo) / 60;

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
      S.playing = false; S.wrong = 0;
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
        if (!recent) { S.wrong++; kb.flash(ev.note, 'bad'); }
      } else {
        const win = Math.min(0.5, 0.22 * bps());
        let best = null;
        for (const n of notes) {
          if (n.start > S.pos + win) break;
          if (n.skip || n.hit || n.miss || n.note !== ev.note || !isActive(n)) continue;
          if (Math.abs(n.start - S.pos) <= win && (!best || Math.abs(n.start - S.pos) < Math.abs(best.start - S.pos))) best = n;
        }
        if (best) { best.hit = true; best.delta = (S.pos - best.start) / bps(); kb.flash(ev.note, 'good'); }
        else { S.wrong++; kb.flash(ev.note, 'bad'); }
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
    const shortName = (n) => T.name(n, { naming: T.settings.naming === 'both' ? 'solfege' : T.settings.naming });

    function drawFall() {
      const { ctx, w, h, rect } = sizeCanvas(fallC);
      ctx.clearRect(0, 0, w, h);
      const kr = kb.el.getBoundingClientRect();
      const offX = kr.left - rect.left, kw = kr.width;
      const look = Math.max(2, 2.6 * bps());
      const ppb = h / look;
      const pos = S.pos;

      // key lanes
      ctx.strokeStyle = 'rgba(255,255,255,.05)';
      for (let n = kb.low; n <= kb.high; n++) {
        if (T.pc(n) === 0 || T.pc(n) === 5) {
          const x = offX + kb.geom(n).x * kw;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
      }
      // bar & beat lines
      for (let b = Math.floor(pos / beatUnit); b * beatUnit < pos + look; b++) {
        const beat = b * beatUnit;
        if (beat < 0) continue;
        const y = h - (beat - pos) * ppb;
        const isBar = Math.abs(beat % barLen) < 1e-6;
        ctx.strokeStyle = isBar ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.06)';
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        if (isBar) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = '11px sans-serif'; ctx.fillText('bar ' + (beat / barLen + 1), 6, y - 4); }
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
        ctx.globalAlpha = isActive(n) || S.mode === 'listen' ? 1 : 0.35;
        rr(ctx, x, yt, wd, hgt, 5);
        ctx.fillStyle = col; ctx.fill();
        if (kg.black) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill(); }
        ctx.lineWidth = 2;
        ctx.strokeStyle = g && g.notes.includes(n) ? '#fff' : n.hand === 'L' ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.45)';
        ctx.stroke();
        if (S.names && wd > 13 && hgt > 16) {
          ctx.fillStyle = kg.black ? '#fff' : '#111';
          ctx.font = `bold ${wd > 24 ? 12 : 9}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(shortName(n.note), x + wd / 2, yb - 7);
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
      const top = { treble: 40, bass: 40 + 4 * s + 50 };
      const { TOP, MID, BOT } = T.STAFF;
      const Y = (p, c) => top[c] + (TOP[c] - p) * (s / 2);
      const playX = Math.max(130, w * 0.28);
      const pos = Math.max(0, S.pos);
      ctx.fillStyle = '#f7f4ea'; ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
      ['treble', 'bass'].forEach((c) => {
        for (let i = 0; i < 5; i++) { const y = top[c] + i * s; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      });

      const beatL = pos - playX / xpb, beatR = pos + (w - playX) / xpb;
      // bar lines
      ctx.font = '10px sans-serif'; ctx.fillStyle = '#777';
      for (let b = Math.max(0, Math.floor(beatL / barLen)); b * barLen <= beatR; b++) {
        const x = playX + (b * barLen - pos) * xpb;
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x, top.treble); ctx.lineTo(x, top.bass + 4 * s); ctx.stroke();
        ctx.fillText(b + 1, x + 3, top.treble - 16);
      }
      // playhead band
      ctx.fillStyle = 'rgba(124,156,255,.16)'; ctx.fillRect(playX - 14, 10, 28, h - 20);

      const g = S.mode === 'wait' ? currentGroup() : null;
      for (const n of notes) {
        if (n.start > beatR) break;
        if (n.start < beatL - 1) continue;
        const c = n.hand === 'L' ? 'bass' : 'treble';
        const p = T.staffPos(n.note, n.flat);
        const x = playX + (n.start - pos) * xpb;
        const y = Y(p, c);
        const rx = s * 0.62, ry = s * 0.46;
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
        for (let q = BOT[c] - 2; q >= p; q -= 2) { ctx.beginPath(); ctx.moveTo(x - 11, Y(q, c)); ctx.lineTo(x + 11, Y(q, c)); ctx.stroke(); }
        for (let q = TOP[c] + 2; q <= p; q += 2) { ctx.beginPath(); ctx.moveTo(x - 11, Y(q, c)); ctx.lineTo(x + 11, Y(q, c)); ctx.stroke(); }

        const d = n.dur;
        const hollow = d >= 1.9;
        let col = T.settings.colors ? T.color(n.note) : '#111';
        if (n.hit) col = '#1f9e62';
        if (n.miss) col = '#e0364a';
        if (g && g.notes.includes(n)) { ctx.fillStyle = 'rgba(124,156,255,.35)'; ctx.beginPath(); ctx.arc(x, y, s * 1.3, 0, 7); ctx.fill(); }
        ctx.save(); ctx.translate(x, y); ctx.rotate(-0.35);
        ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 7);
        if (hollow) { ctx.fillStyle = '#f7f4ea'; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = col === '#111' ? '#111' : col; ctx.stroke(); }
        else { ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#111'; ctx.stroke(); }
        ctx.restore();
        // stem + flags
        if (d < 3.9) {
          const up = p < MID[c];
          const sx = up ? x + rx - 1 : x - rx + 1, sy2 = up ? y - s * 3.3 : y + s * 3.3;
          ctx.strokeStyle = '#111'; ctx.lineWidth = 1.3;
          ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx, sy2); ctx.stroke();
          const flags = d < 0.4 ? 2 : d < 0.9 ? 1 : 0;
          for (let f = 0; f < flags; f++) {
            const fy = sy2 + (up ? 1 : -1) * f * 6;
            ctx.beginPath(); ctx.moveTo(sx, fy); ctx.quadraticCurveTo(sx + 9, fy + (up ? 6 : -6), sx + 6, fy + (up ? 13 : -13)); ctx.stroke();
          }
        }
        if ([0.75, 1.5, 3].some((v) => Math.abs(d - v) < 0.02)) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + rx + 4, y - (p % 2 === 0 ? 0 : 0), 1.8, 0, 7); ctx.fill(); }
        const sp = T.spell(n.note, n.flat);
        if (sp.acc) { ctx.fillStyle = '#111'; ctx.font = '15px serif'; ctx.fillText(sp.acc > 0 ? '♯' : '♭', x - rx - 11, y + 5); }
      }
      // note names under each staff
      if (S.names) {
        ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
        chordLabels.forEach((cl) => {
          if (cl.start < beatL - 1 || cl.start > beatR) return;
          const x = playX + (cl.start - pos) * xpb;
          const txt = cl.notes.map((n) => shortName(n.note)).join('/');
          ctx.fillStyle = '#555';
          ctx.fillText(txt, x, cl.hand === 'L' ? h - 4 : top.treble + 4 * s + 26);
        });
        ctx.textAlign = 'left';
      }
      // clef panel
      ctx.fillStyle = '#f7f4ea'; ctx.fillRect(0, 0, 64, h);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
      ['treble', 'bass'].forEach((c) => { for (let i = 0; i < 5; i++) { const y = top[c] + i * s; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(64, y); ctx.stroke(); } });
      T.drawClef(ctx, 'treble', 6, top.treble, s);
      T.drawClef(ctx, 'bass', 4, top.bass, s);
      ctx.fillStyle = '#111';
      ctx.font = `bold ${s * 2}px serif`;
      ['treble', 'bass'].forEach((c) => {
        ctx.fillText(song.timeSig[0], 44, top[c] + s * 1.8);
        ctx.fillText(song.timeSig[1], 44, top[c] + s * 3.8);
      });
      ctx.fillStyle = '#7c9cff'; ctx.fillRect(playX - 1, 12, 2, h - 24);
    }

    function drawHud() {
      const st = stats();
      const bar = Math.max(1, Math.floor(Math.max(0, S.pos) / barLen) + 1);
      $('[data-o=bar]').textContent = `bar ${Math.min(bar, totalBars)} / ${totalBars}`;
      if (S.mode === 'listen') { hud.innerHTML = '👂 Listening — watch which keys light up'; return; }
      const waitingMsg = S.mode === 'wait' && !S.playing && !S.finished ? '<div>Press the glowing key to start</div>' : '';
      hud.innerHTML = `<b>${st.hits}</b> / ${st.total} notes · <span style="color:var(--bad)">${S.wrong} wrong</span>${waitingMsg}`;
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
