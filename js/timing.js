// Timing check: measures the delay between the app's click and the player's key presses,
// tells apart a steady setup delay (latency) from normal human variation, and saves a correction.
(function () {
  const Tm = (PL.Timing = {});
  const COUNT_IN = 4, TAPS = 16, BPM = 90;

  Tm.mount = function (main) {
    const A = PL.Audio;
    const spb = 60 / BPM;
    let t0 = 0, presses = [], running = false, raf = 0, timer = 0;

    main.innerHTML = `<div class="wrap stack" style="max-width:820px">
      <div class="row"><button class="btn" data-back>← Settings</button><h1 style="margin:0">🎯 Timing check</h1></div>
      <p class="muted">Does the app judge you late because of a delay in your setup? This test finds out.
        You hear <b>4 count-in clicks</b>, then <b>16 clicks</b>. Press any key on your piano <b>exactly with each click</b>.
        Listen to the clicks and don't watch the screen.</p>
      <div class="card stack" style="text-align:center">
        <div class="beats timing-beats">${Array.from({ length: TAPS }, (_, k) => `<div class="beat" data-k="${k}">${(k % 4) + 1}<span class="ms"></span></div>`).join('')}</div>
        <div data-count style="font-size:40px;font-weight:800;min-height:56px"></div>
        <div><button class="btn primary big" data-start>▶ Start</button></div>
      </div>
      <div class="card stack" data-result hidden></div>
      <div class="card stack">
        <h3 style="margin:0">Your setup</h3>
        <div class="small" data-diag></div>
      </div>
    </div>`;
    const $ = (s) => main.querySelector(s);
    const beatEls = [...main.querySelectorAll('.timing-beats .beat')];
    const fmt = (ms) => `${ms >= 0 ? '+' : '−'}${Math.abs(Math.round(ms))} ms`;

    function diag() {
      const delay = A.outputDelay();
      $('[data-diag]').innerHTML = `
        <div>🔊 Sound output delay reported by the browser: <b>${Math.round(delay)} ms</b> (already taken into account)</div>
        <div>🎹 MIDI: <b>${PL.Input.devices.length ? PL.Input.devices.join(', ') : 'no keyboard found'}</b></div>
        <div>⚙️ Correction in use: <b>${fmt(A.timing.offset)}</b> · strictness: <b>${A.timing.level}</b> (on time within ${A.windows().good} ms)</div>
        <p class="muted">Tips: <b>Bluetooth</b> headphones or speakers add 150–300 ms of delay — use wired headphones or the computer's speakers for timing practice.
          Your piano's own sound has no delay; only the app's clicks can be late.</p>`;
    }

    const off = PL.Input.on((ev) => { if (ev.type === 'on' && running) presses.push(ev.time); });

    function start() {
      const ctx = A.init();
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      presses = [];
      running = true;
      $('[data-result]').hidden = true;
      $('[data-start]').hidden = true;
      beatEls.forEach((b) => { b.className = 'beat'; b.querySelector('.ms').textContent = ''; });
      t0 = ctx.currentTime + 0.5;
      for (let k = 0; k < COUNT_IN + TAPS; k++) A.click(k % 4 === 0, t0 + k * spb);
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const bf = (performance.now() - A.heardAt(t0)) / (spb * 1000); // beats since the first click was heard
        $('[data-count]').textContent = bf < 0 ? 'Get ready…' : bf < COUNT_IN ? String(COUNT_IN - Math.floor(bf)) : '';
        const k = Math.floor(bf - COUNT_IN + 0.5);
        beatEls.forEach((b, j) => b.classList.toggle('now', j === k));
      };
      tick();
      timer = setTimeout(evaluate, (0.5 + (COUNT_IN + TAPS + 0.8) * spb) * 1000 + A.outputDelay());
    }

    function evaluate() {
      running = false;
      cancelAnimationFrame(raf);
      $('[data-count]').textContent = '';
      $('[data-start]').hidden = false;
      $('[data-start]').textContent = '⟲ Try again';
      const offs = [];
      const used = new Set();
      for (let k = 0; k < TAPS; k++) {
        const heard = A.heardAt(t0 + (COUNT_IN + k) * spb);
        let best = -1;
        presses.forEach((p, j) => {
          if (!used.has(j) && Math.abs(p - heard) < spb * 500 && (best < 0 || Math.abs(p - heard) < Math.abs(presses[best] - heard))) best = j;
        });
        const el = beatEls[k];
        el.classList.remove('now');
        if (best < 0) { el.classList.add('hit-bad'); el.querySelector('.ms').textContent = '—'; continue; }
        used.add(best);
        const raw = presses[best] - heard; // measured without any correction
        offs.push(raw);
        const judged = Math.abs(raw - A.timing.offset);
        el.classList.add(judged <= A.windows().good ? 'hit-good' : judged <= A.windows().ok ? 'hit-ok' : 'hit-bad');
        el.querySelector('.ms').textContent = `${raw >= 0 ? '+' : '−'}${Math.abs(Math.round(raw))}`;
      }
      showResult(offs);
      diag();
    }

    function showResult(offs) {
      const box = $('[data-result]');
      box.hidden = false;
      if (offs.length < 8) {
        box.innerHTML = `<h3 style="margin:0">Not enough presses</h3>
          <p>I only heard ${offs.length} of ${TAPS} presses. Is the piano connected by USB/MIDI? Press a key with <b>every</b> click and try again.</p>`;
        return;
      }
      const sorted = offs.slice().sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const inliers = offs.filter((o) => Math.abs(o - median) < 150);
      const mean = inliers.reduce((s, o) => s + o, 0) / inliers.length;
      const spread = Math.sqrt(inliers.reduce((s, o) => s + (o - mean) ** 2, 0) / inliers.length);
      const r = Math.round(mean);
      let verdict, canApply = false;
      if (Math.abs(mean) <= 25) {
        verdict = `✅ <b>No real delay.</b> Your presses land right on the clicks. If a lesson says you're early or late, that's your playing — keep listening to the click and press <i>with</i> it.`;
      } else if (spread <= 45) {
        verdict = `⏱️ <b>A steady ${Math.abs(r)} ms ${r > 0 ? 'late' : 'early'} on every click.</b> Because it hardly changes (±${Math.round(spread)} ms), this is almost certainly your <b>setup</b> (sound output or MIDI), not your playing. Use it as a correction so the app judges you fairly.`;
        canApply = true;
      } else {
        verdict = `🎲 <b>Your presses vary quite a lot</b> (±${Math.round(spread)} ms), so a setup delay can't be measured exactly — that's completely normal while you're learning the beat. Relax, just listen, and try again. You can still use the average as a correction.`;
        canApply = true;
      }
      if (r < -25 && canApply) verdict += ' <br><span class="muted">Pressing a little <b>early</b> is also a common human habit (we anticipate the click). Only use a correction if it stays the same every time you test.</span>';
      box.innerHTML = `<h3 style="margin:0">Result</h3>
        <div class="row">
          <div class="stat"><b>${fmt(mean)}</b><span class="small muted">average (+ = after the click)</span></div>
          <div class="stat"><b>±${Math.round(spread)} ms</b><span class="small muted">spread (how much it varies)</span></div>
        </div>
        <p>${verdict}</p>
        <div class="row">
          ${canApply ? `<button class="btn primary" data-apply="${r}">✓ Use ${fmt(r)} as my correction</button>` : ''}
          ${A.timing.offset ? '<button class="btn" data-apply="0">Remove correction</button>' : ''}
        </div>`;
    }

    main.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-back')) return PL.App.go('settings');
      if (b.hasAttribute('data-start')) return start();
      if (b.dataset.apply != null) {
        PL.App.setTiming({ offset: +b.dataset.apply });
        b.textContent = +b.dataset.apply ? '✓ Correction saved' : '✓ Correction removed';
        b.disabled = true;
        diag();
      }
    });

    A.init();
    diag();
    return () => { off(); clearTimeout(timer); cancelAnimationFrame(raf); running = false; };
  };
})();
