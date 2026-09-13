// Question-by-question game engine shared by the music theory and ear training lessons.
(function () {
  const L = PL.Lessons;

  // Schedule notes. Each item is a note number or an array of notes played together.
  L.h.playSeq = function (items, gap = 0.75, dur = 0.7, delay = 0.05) {
    const t = PL.Audio.init().currentTime + delay;
    items.forEach((it, k) => [].concat(it).forEach((n) => PL.Audio.play(n, dur, 0.75, t + k * gap)));
  };
  L.h.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  L.h.chips = (names, cls = []) => `<div class="chips">${names.map((n, i) => `<span class="chip ${cls[i] || ''}">${n}</span>`).join('')}</div>`;
  L.h.seqBtn = (label, steps, gap = 0.5) =>
    `<button class="btn small" data-seq="${steps.map((s) => [].concat(s).join('+')).join(',')}" data-gap="${gap}">▶ ${label}</button>`;
  L.h.listen = '<button class="listen-big" data-replay title="Hear it again">🔊</button>';

  // Any button with data-seq="60+64+67,65+69+72" plays that sequence (used on explanation pages).
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-seq]');
    if (!b) return;
    const gap = +(b.dataset.gap || 0.5);
    L.h.playSeq(b.dataset.seq.split(',').map((s) => s.split('+').map(Number)), gap, Math.max(0.4, gap));
  });

  /**
   * spec:  { count, make(i, api) -> round, detail(errors)?, skippable? }
   * round: { prompt, stage, choices:[{label, sub, value}], answer, explain, play(), start(),
   *          onNote(ev), onWrong(tries), after(), reveal(), pause }
   */
  L.h.rounds = function (body, spec, progress, done) {
    const kb = PL.App.kb;
    const count = spec.count;
    let i = 0, errors = 0, tries = 0, cur = null, lock = false;
    const timers = [];
    body.innerHTML = `<div class="rounds">
      <div class="muted small counter"></div>
      <div class="prompt q"></div><div class="stage"></div>
      <div class="choices"></div><div class="feedback"></div>
      <div class="row" style="justify-content:center;margin-top:10px">
        <button class="btn" data-replay hidden>🔁 Hear it again <kbd>Space</kbd></button>
        <button class="btn" data-skip hidden>Show answer →</button>
      </div></div>`;
    const root = body.querySelector('.rounds');
    const $ = (s) => root.querySelector(s);
    const q = $('.q'), stage = $('.stage'), ch = $('.choices'), fb = $('.feedback'), counter = $('.counter');
    const replay = $('[data-replay]'), skip = $('[data-skip]');

    const api = {
      stage, fb,
      later(fn, ms) { timers.push(setTimeout(fn, ms)); },
      get tries() { return tries; },
      correct(msg) {
        if (lock) return;
        if (cur.skill && tries === 0) PL.Coach.record(cur.skill, true);
        lock = true;
        fb.innerHTML = '✓ ' + (msg || 'Correct!');
        fb.className = 'feedback good';
        advance(cur.pause || 1200);
      },
      wrong(msg) {
        if (lock) return;
        if (cur.skill && tries === 0) PL.Coach.record(cur.skill, false);
        errors++; tries++;
        fb.innerHTML = msg || 'Not quite — try again.';
        fb.className = 'feedback bad';
        if (cur.onWrong) cur.onWrong(tries);
        if (tries >= 3 && spec.skippable !== false) skip.hidden = false;
      },
    };

    function advance(ms) {
      if (cur.after) cur.after();
      i++;
      progress(i / count);
      skip.hidden = true;
      if (i >= count) api.later(() => done(count / (count + errors), spec.detail ? spec.detail(errors) : `${errors} mistake${errors === 1 ? '' : 's'}`), ms);
      else api.later(next, ms);
    }

    function next() {
      tries = 0; lock = false; skip.hidden = true;
      kb.clearHints();
      cur = spec.make(i, api);
      counter.textContent = `Question ${i + 1} of ${count}`;
      q.innerHTML = cur.prompt || '';
      stage.innerHTML = cur.stage || '';
      const cs = cur.choices || [];
      ch.innerHTML = cs.map((c, j) =>
        `<button class="btn choice" data-c="${j}">${cs.length <= 9 ? `<kbd>${j + 1}</kbd>` : ''}<span>${c.label}</span>${c.sub ? `<small>${c.sub}</small>` : ''}</button>`).join('');
      fb.innerHTML = ''; fb.className = 'feedback';
      replay.hidden = !cur.play;
      if (cur.start) cur.start();
      if (cur.play) api.later(cur.play, 350);
    }

    function choose(j) {
      if (lock || !cur.choices || !cur.choices[j]) return;
      const btn = ch.querySelector(`[data-c="${j}"]`);
      if (btn.disabled) return;
      if (String(cur.choices[j].value) === String(cur.answer)) { btn.classList.add('right'); api.correct(cur.explain); }
      else { btn.classList.add('wrongc'); btn.disabled = true; api.wrong(cur.hint || 'Not that one — try another.'); }
    }

    root.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      PL.Audio.init();
      if (b.dataset.c != null) choose(+b.dataset.c);
      else if (b.hasAttribute('data-replay') && cur.play) cur.play();
      else if (b.hasAttribute('data-skip') && !lock) {
        lock = true;
        fb.innerHTML = 'The answer: ' + (cur.reveal ? cur.reveal() : cur.explain || '');
        fb.className = 'feedback';
        ch.querySelectorAll('[data-c]').forEach((x) => {
          if (String(cur.choices[+x.dataset.c].value) === String(cur.answer)) x.classList.add('right');
        });
        advance(2800);
      }
    });
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (/^[1-9]$/.test(e.key)) choose(+e.key - 1);
      else if (e.code === 'Space' && cur && cur.play) { e.preventDefault(); cur.play(); }
    };
    window.addEventListener('keydown', onKey);
    const off = PL.Input.on((ev) => { if (!lock && cur && cur.onNote) cur.onNote(ev); });

    next();
    return () => {
      off();
      window.removeEventListener('keydown', onKey);
      timers.forEach(clearTimeout);
      kb.clearHints();
    };
  };
})();
