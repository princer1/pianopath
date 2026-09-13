// Record the player's own piano through an audio interface, note by note, to use as the app's instrument.
// MIDI tells us which key was pressed and how hard; the audio input captures the sound until it fades.
(function () {
  const T = PL.Theory;
  const R = (PL.Recorder = {});

  const LAYERS = {
    loud: { label: 'LOUD', hint: 'a strong, full press', ok: (v) => v >= 0.7, too: 'Too soft for the LOUD recording — press stronger' },
    soft: { label: 'soft', hint: 'a gentle press', ok: (v) => v <= 0.5, too: 'Too strong for the soft recording — press more gently' },
    medium: { label: 'medium', hint: 'a normal, medium press', ok: (v) => v >= 0.4 && v <= 0.85, too: 'Aim for a medium press — not too soft, not too strong' },
  };
  const DETAIL = {
    standard: { step: 3, layers: ['loud', 'soft'] },
    quick: { step: 6, layers: ['medium'] },
  };
  const maxDur = (n) => (n < 48 ? 7 : n < 72 ? 5 : 3.5); // low strings ring longer
  const noteLbl = (n) => T.name(n) + T.octave(n);

  // Mixes the input to mono and posts it to the page in small blocks.
  const TAP = `class PPTap extends AudioWorkletProcessor {
    process(inputs) {
      const ch = inputs[0];
      if (ch && ch.length) {
        const n = ch[0].length, m = new Float32Array(n);
        for (let c = 0; c < ch.length; c++) { const d = ch[c]; for (let i = 0; i < n; i++) m[i] += d[i] / ch.length; }
        this.port.postMessage(m, [m.buffer]);
      }
      return true;
    }
  }
  registerProcessor('pp-tap', PPTap);`;
  let tapCtx = null;

  // Cut the silence before the attack and after the sound dies away, then fade out the end.
  R.trim = function (x, rate) {
    let peak = 0;
    for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
    if (!peak) return { data: x, peak };
    let start = 0;
    while (start < x.length && Math.abs(x[start]) < peak * 0.05) start++;
    start = Math.max(0, start - Math.round(rate * 0.004));
    let end = x.length - 1;
    while (end > start && Math.abs(x[end]) < peak * 0.0015) end--;
    end = Math.min(x.length, end + Math.round(rate * 0.02));
    const data = x.slice(start, end);
    const fade = Math.min(data.length, Math.round(rate * 0.06));
    for (let i = 0; i < fade; i++) data[data.length - 1 - i] *= i / fade;
    return { data, peak };
  };

  function planFor(detail) {
    const [lo, hi] = PL.App.range();
    const { step, layers } = DETAIL[detail];
    const notes = [];
    for (let n = lo; n <= hi; n += step) notes.push(n);
    if (notes[notes.length - 1] < hi - step / 2) notes.push(hi);
    return notes.flatMap((note) => layers.map((layer) => ({ note, layer })));
  }

  R.mount = function (main) {
    const kb = PL.App.kb;
    kb.setRange(...PL.App.range());
    const prevSound = PL.Input.sound;
    PL.Input.sound = false; // keep the app's own sound out of the recording

    let detail = 'standard';
    try { detail = localStorage.getItem('pl.recdetail') || 'standard'; } catch (e) {}
    if (!DETAIL[detail]) detail = 'standard';

    const st = {
      stream: null, src: null, node: null, sink: null, rate: 48000,
      level: 0, hold: 0, pre: [], preLen: 0, cap: null,
      recording: false, plan: planFor(detail), idx: -1, lastSaved: -1,
    };

    main.innerHTML = `<div class="wrap stack" style="max-width:900px">
      <div class="row"><button class="btn" data-back>← Settings</button><h1 style="margin:0">🎙️ Record your piano's sound</h1></div>
      <p class="muted">Record your own piano once, note by note. The app then uses <b>your piano's real sound</b> for songs, lessons and ear training. You can stop any time and continue later.</p>

      <div class="card stack">
        <h2 style="margin:0">1 · Connect</h2>
        <ol class="steps">
          <li>Connect the piano's <b>headphone or line output</b> to your <b>audio card input</b>. Keep the piano's <b>USB/MIDI</b> connected too — the app uses MIDI to know which key you pressed and how hard.</li>
          <li>Set the piano volume to about ¾ and switch off reverb or other effects if your piano has them.</li>
          <li><b>Don't press the pedal</b> while recording. The app's own sound is muted on this page.</li>
        </ol>
        <div class="row">
          <button class="btn primary" data-open>🎙️ Use my audio card</button>
          <select data-device hidden></select>
          <span class="small" data-midi></span>
        </div>
        <div class="meter rec"><div class="bar"></div><div class="hold"></div></div>
        <div class="small muted" data-levelmsg>Choose your audio input, then play a loud note. The bar should reach the yellow part, never red.</div>
      </div>

      <div class="card stack">
        <h2 style="margin:0">2 · How detailed?</h2>
        ${Object.keys(DETAIL).map((k) => `<label class="row"><input type="radio" name="detail" value="${k}" ${k === detail ? 'checked' : ''}>
          <b>${k === 'standard' ? 'Standard' : 'Quick'}</b> — ${k === 'standard' ? 'every 3rd key, soft and loud' : 'every 6th key, one medium loudness'}
          <span class="muted small" data-est="${k}"></span></label>`).join('')}
        <p class="muted small">Keys in between use the nearest recording, tuned up or down a little. Standard sounds more natural; Quick is faster.</p>
      </div>

      <div class="card stack">
        <h2 style="margin:0">3 · Record</h2>
        <div class="rec-prompt" data-prompt><p class="muted">Press <b>Start</b> when your audio card is connected.</p></div>
        <div class="progressbar" style="flex:none"><div data-holdbar></div></div>
        <div class="feedback" data-msg></div>
        <div class="row">
          <button class="btn primary" data-start>⏺ Start recording</button>
          <button class="btn" data-skip hidden>Skip this one →</button>
          <span class="spacer"></span><span class="muted small" data-count></span>
        </div>
        <p class="muted small">Click any box to record or redo that note.</p>
        <div class="sample-map" data-map></div>
      </div>

      <div class="card stack">
        <h2 style="margin:0">4 · Use it</h2>
        <label class="row"><input type="checkbox" data-use> Use <b>my recorded piano</b> as the app's sound</label>
        <div class="row"><span class="muted small" data-size></span><span class="spacer"></span><button class="btn" data-clear>🗑️ Delete all recordings</button></div>
      </div>
    </div>`;

    const $ = (s) => main.querySelector(s);
    const msg = (cls, html) => { const m = $('[data-msg]'); m.className = 'feedback ' + cls; m.innerHTML = html; };

    // ---------- audio input ----------
    async function openInput(deviceId) {
      closeInput();
      const ctx = PL.Audio.init();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 },
      });
      if (tapCtx !== ctx) {
        const url = URL.createObjectURL(new Blob([TAP], { type: 'application/javascript' }));
        await ctx.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);
        tapCtx = ctx;
      }
      st.stream = stream;
      st.rate = ctx.sampleRate;
      st.src = ctx.createMediaStreamSource(stream);
      st.node = new AudioWorkletNode(ctx, 'pp-tap', { outputChannelCount: [1] });
      st.sink = ctx.createGain();
      st.sink.gain.value = 0; // keeps the worklet running without playing the input back
      st.src.connect(st.node);
      st.node.connect(st.sink);
      st.sink.connect(ctx.destination);
      st.node.port.onmessage = (e) => onChunk(e.data);
      st.hold = 0;

      const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
      const current = stream.getAudioTracks()[0].getSettings().deviceId;
      const sel = $('[data-device]');
      sel.innerHTML = devs.map((d, i) => `<option value="${d.deviceId}" ${d.deviceId === current ? 'selected' : ''}>${d.label || 'Audio input ' + (i + 1)}</option>`).join('');
      sel.hidden = false;
      $('[data-open]').textContent = '🎙️ Input on';
      try { localStorage.setItem('pl.recdevice', current); } catch (e) {}
    }
    function closeInput() {
      if (st.node) { st.node.port.onmessage = null; st.node.disconnect(); }
      if (st.src) st.src.disconnect();
      if (st.sink) st.sink.disconnect();
      if (st.stream) st.stream.getTracks().forEach((t) => t.stop());
      st.stream = st.src = st.node = st.sink = null;
      st.cap = null;
    }
    async function tryOpen(deviceId) {
      try {
        await openInput(deviceId);
        $('[data-levelmsg]').textContent = 'Play a loud note — the bar should reach the yellow part, never red.';
      } catch (e) {
        const why = e.name === 'NotAllowedError' ? 'The browser was not allowed to use the audio input — allow it in the address bar and try again.'
          : e.name === 'NotFoundError' || e.name === 'OverconstrainedError' ? 'No audio input found — is the audio card plugged in?'
          : 'Could not open the audio input: ' + e.message;
        $('[data-levelmsg]').innerHTML = `<span style="color:var(--bad)">${why}</span>`;
      }
    }

    function onChunk(m) {
      let pk = 0;
      for (let i = 0; i < m.length; i++) { const a = Math.abs(m[i]); if (a > pk) pk = a; }
      st.level = Math.max(pk, st.level * 0.93);
      st.hold = Math.max(pk, st.hold);
      const cap = st.cap;
      if (!cap) {
        st.pre.push(m);
        st.preLen += m.length;
        while (st.pre.length > 1 && st.preLen - st.pre[0].length > st.rate * 0.35) st.preLen -= st.pre.shift().length;
        return;
      }
      cap.chunks.push(m);
      cap.len += m.length;
      cap.peak = Math.max(cap.peak, pk);
      cap.recent.push(pk);
      if (cap.recent.length > 40) cap.recent.shift(); // ~0.1 s
      const secs = cap.len / st.rate;
      const faded = secs > 0.6 && Math.max(...cap.recent) < cap.peak * 0.003;
      const released = cap.offAt && performance.now() - cap.offAt > 450;
      if (secs >= maxDur(cap.note) || faded || released) finishCapture();
    }

    // ---------- recording flow ----------
    const nextIdx = (from) => {
      const open = (i) => i >= 0 && i < st.plan.length && !PL.Samples.has(st.plan[i].note, st.plan[i].layer);
      for (let i = from; i < st.plan.length; i++) if (open(i)) return i;
      for (let i = 0; i < from; i++) if (open(i)) return i;
      return -1;
    };

    function showPrompt() {
      const it = st.plan[st.idx];
      kb.clearHints();
      $('[data-skip]').hidden = !st.recording || !it;
      if (!st.recording) return;
      if (!it) {
        $('[data-prompt]').innerHTML = '<div class="rec-note">🎉</div><p><b>All notes recorded!</b> Your piano is now the app\'s sound.</p>';
        st.recording = false;
        $('[data-start]').hidden = false;
        $('[data-start]').textContent = '⏺ Record again';
        PL.App.setInstrument('recorded');
        $('[data-use]').checked = true;
        return;
      }
      const L = LAYERS[it.layer];
      const redo = PL.Samples.has(it.note, it.layer);
      $('[data-prompt]').innerHTML = `<div class="rec-note">${noteLbl(it.note)} <span class="rec-layer">${L.label}</span></div>
        <p>${redo ? 'Redo: play' : 'Play'} the glowing key with <b>${L.hint}</b> and hold it until the bar is full or the sound fades.</p>`;
      kb.hint(it.note);
      renderMap();
    }

    function startCapture(ev, it) {
      let peak = 0;
      st.pre.forEach((c) => { for (let i = 0; i < c.length; i++) peak = Math.max(peak, Math.abs(c[i])); });
      st.cap = { note: it.note, layer: it.layer, vel: ev.vel, chunks: st.pre, len: st.preLen, peak, recent: [], offAt: 0, extra: false };
      st.pre = [];
      st.preLen = 0;
      msg('', `🔴 Recording <b>${noteLbl(it.note)}</b> — keep holding…`);
    }

    async function finishCapture() {
      const cap = st.cap;
      st.cap = null;
      const all = new Float32Array(cap.len);
      let o = 0;
      cap.chunks.forEach((c) => { all.set(c, o); o += c.length; });
      const { data, peak } = R.trim(all, st.rate);
      if (cap.extra) return msg('bad', 'Another key was pressed during the recording. Play only one key — try again.');
      if (peak < 0.01) return msg('bad', '🔇 Your key press arrived by MIDI, but the audio input heard almost nothing. Check the cable from the piano to the audio card, the input chosen in step 1, and the piano volume.');
      if (peak > 0.985) return msg('bad', '📢 Too loud — the sound is distorted. Turn down the audio card gain (or the piano volume) and play it again.');
      if (data.length < st.rate * 0.25) return msg('bad', 'That was very short — hold the key down longer. Try again.');
      await PL.Samples.save(cap.note, cap.layer, cap.vel, data, st.rate);
      st.lastSaved = st.idx;
      msg('good', `✓ Saved <b>${noteLbl(cap.note)} ${LAYERS[cap.layer].label}</b> (${(data.length / st.rate).toFixed(1)} s)
        <button class="btn small" data-listen="${cap.note}:${cap.layer}">▶ Listen</button> <button class="btn small" data-redo>⟲ Redo</button>`);
      renderStatus();
      st.idx = nextIdx(st.idx + 1);
      if (st.idx < 0) st.idx = st.plan.length; // finished
      showPrompt();
    }

    const off = PL.Input.on((ev) => {
      if (ev.type === 'off') { if (st.cap && ev.note === st.cap.note) st.cap.offAt = performance.now(); return; }
      if (st.cap) { if (ev.note !== st.cap.note) st.cap.extra = true; return; }
      if (!st.recording) return;
      const it = st.plan[st.idx];
      if (!it) return;
      if (!st.node) return msg('bad', 'Choose your audio input first — press <b>🎙️ Use my audio card</b> in step 1.');
      if (ev.note !== it.note) return msg('bad', `That was <b>${noteLbl(ev.note)}</b> — please play <b>${noteLbl(it.note)}</b>, the glowing key.`);
      if (!LAYERS[it.layer].ok(ev.vel)) return msg('bad', `${LAYERS[it.layer].too} (you pressed ${Math.round(ev.vel * 127)} of 127). Try again.`);
      startCapture(ev, it);
    });

    // ---------- status ----------
    function renderMap() {
      const byNote = new Map();
      st.plan.forEach((it, i) => { if (!byNote.has(it.note)) byNote.set(it.note, []); byNote.get(it.note).push({ ...it, i }); });
      $('[data-map]').innerHTML = [...byNote].map(([note, items]) => {
        const got = items.filter((x) => PL.Samples.has(x.note, x.layer)).length;
        const now = st.recording && items.some((x) => x.i === st.idx);
        const cls = got === items.length ? 'full' : got ? 'part' : '';
        return `<button class="${cls} ${now ? 'now' : ''}" data-cell="${items[0].i}" title="${items.map((x) => `${x.layer}: ${PL.Samples.has(x.note, x.layer) ? 'recorded' : 'missing'}`).join(', ')}">
          ${noteLbl(note)}<br>${items.map((x) => (PL.Samples.has(x.note, x.layer) ? '●' : '○')).join('')}</button>`;
      }).join('');
    }
    function renderStatus() {
      const done = st.plan.filter((it) => PL.Samples.has(it.note, it.layer)).length;
      $('[data-count]').textContent = `${done} of ${st.plan.length} recorded`;
      Object.keys(DETAIL).forEach((k) => {
        const p = planFor(k);
        const mins = Math.ceil(p.reduce((s, it) => s + maxDur(it.note) + 3, 0) / 60);
        main.querySelector(`[data-est="${k}"]`).textContent = `(${p.length} recordings, about ${mins} min)`;
      });
      $('[data-use]').checked = PL.App.getInstrument() === 'recorded';
      $('[data-use]').disabled = !PL.Samples.count();
      $('[data-size]').textContent = PL.Samples.count()
        ? `${PL.Samples.count()} recordings saved in this browser (${PL.Samples.seconds().toFixed(0)} s of sound).`
        : 'No recordings yet.';
      renderMap();
    }

    // ---------- meter ----------
    let raf = 0;
    const bar = $('.meter.rec .bar'), holdEl = $('.meter.rec .hold');
    const pctOf = (a) => Math.max(0, Math.min(100, ((20 * Math.log10(Math.max(a, 1e-6)) + 60) / 60) * 100));
    function frame() {
      raf = requestAnimationFrame(frame);
      const p = pctOf(st.level);
      bar.style.width = p + '%';
      bar.style.background = p >= 98 ? 'var(--bad)' : p >= 80 ? 'var(--warn)' : 'var(--good)';
      holdEl.style.left = pctOf(st.hold) + '%';
      st.hold *= 0.995;
      const hb = $('[data-holdbar]');
      hb.style.width = st.cap ? Math.min(100, (st.cap.len / st.rate / maxDur(st.cap.note)) * 100) + '%' : '0%';
    }
    raf = requestAnimationFrame(frame);

    // ---------- events ----------
    main.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      PL.Audio.init();
      if (b.hasAttribute('data-back')) return PL.App.go('settings');
      if (b.hasAttribute('data-open')) return tryOpen((() => { try { return localStorage.getItem('pl.recdevice'); } catch (err) { return null; } })());
      if (b.hasAttribute('data-start')) {
        st.recording = true;
        st.idx = nextIdx(0);
        if (st.idx < 0) st.idx = 0; // everything recorded: start again from the lowest note
        b.hidden = true;
        msg('', st.node ? '' : 'Choose your audio input first — press <b>🎙️ Use my audio card</b> in step 1.');
        return showPrompt();
      }
      if (b.hasAttribute('data-skip')) {
        st.cap = null;
        st.idx = nextIdx(st.idx + 1);
        if (st.idx < 0) st.idx = st.plan.length;
        msg('', '');
        return showPrompt();
      }
      if (b.hasAttribute('data-redo')) { st.cap = null; st.idx = st.lastSaved; st.recording = true; $('[data-start]').hidden = true; msg('', ''); return showPrompt(); }
      if (b.dataset.cell != null) { st.cap = null; st.idx = +b.dataset.cell; st.recording = true; $('[data-start]').hidden = true; msg('', ''); return showPrompt(); }
      if (b.dataset.listen) {
        const [note, layer] = b.dataset.listen.split(':');
        const s = PL.Samples.get(+note, layer);
        if (!s) return;
        const ctx = PL.Audio.init(), src = ctx.createBufferSource(), g = ctx.createGain();
        src.buffer = s.buffer;
        g.gain.value = Math.min(1, PL.Samples.scale * 0.8);
        src.connect(g); g.connect(ctx.destination); src.start();
        return;
      }
      if (b.hasAttribute('data-clear')) {
        if (!confirm('Delete all recordings of your piano?')) return;
        PL.Samples.clear().then(() => { PL.App.setInstrument('synth'); renderStatus(); showPrompt(); });
      }
    });
    main.addEventListener('change', (e) => {
      if (e.target.matches('[data-device]')) tryOpen(e.target.value);
      if (e.target.name === 'detail') {
        detail = e.target.value;
        try { localStorage.setItem('pl.recdetail', detail); } catch (err) {}
        st.plan = planFor(detail);
        st.cap = null;
        if (st.recording) st.idx = Math.max(0, nextIdx(0));
        renderStatus();
        showPrompt();
      }
      if (e.target.matches('[data-use]')) PL.App.setInstrument(e.target.checked ? 'recorded' : 'synth');
    });

    $('[data-midi]').innerHTML = PL.Input.devices.length
      ? `🎹 MIDI: <b>${PL.Input.devices.join(', ')}</b>`
      : '<span style="color:var(--warn)">⚠️ No MIDI found — connect the piano\'s USB/MIDI cable.</span>';
    renderStatus();

    return function cleanup() {
      cancelAnimationFrame(raf);
      off();
      closeInput();
      kb.clearHints();
      PL.Input.sound = prevSound;
    };
  };
})();
