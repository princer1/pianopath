// Recorded piano samples: stored in IndexedDB, turned into AudioBuffers, picked per note and velocity.
(function () {
  const S = (PL.Samples = {});
  const DB = 'pianopath', STORE = 'samples';

  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => res(req && req.result);
      t.onerror = t.onabort = () => rej(t.error);
    });
  }

  S.buffers = new Map(); // 'note:layer' -> { note, layer, vel, peak, buffer }
  S.scale = 1;           // one gain for all samples, so their loudness relative to each other is kept
  S.count = () => S.buffers.size;
  S.has = (note, layer) => S.buffers.has(note + ':' + layer);
  S.get = (note, layer) => S.buffers.get(note + ':' + layer);
  S.seconds = () => { let s = 0; S.buffers.forEach((b) => (s += b.buffer.duration)); return s; };

  function toBuffer(rec) {
    const buf = new AudioBuffer({ length: rec.data.length, sampleRate: rec.rate, numberOfChannels: 1 });
    const ch = buf.getChannelData(0);
    for (let i = 0; i < rec.data.length; i++) ch[i] = rec.data[i] / 32768;
    return buf;
  }
  function rescale() {
    let p = 0;
    S.buffers.forEach((b) => (p = Math.max(p, b.peak)));
    S.scale = p > 0 ? 0.9 / p : 1;
  }
  const entry = (rec) => ({ note: rec.note, layer: rec.layer, vel: rec.vel, peak: rec.peak, buffer: toBuffer(rec) });

  S.load = async function () {
    try {
      const all = await tx('readonly', (st) => st.getAll());
      S.buffers.clear();
      (all || []).forEach((rec) => S.buffers.set(rec.id, entry(rec)));
      rescale();
    } catch (e) {
      console.warn('Could not load recorded piano samples', e);
    }
    return S.buffers.size;
  };

  // samples: Float32Array (mono, -1..1). Stored as 16-bit to halve the size.
  S.save = async function (note, layer, vel, samples, rate) {
    const data = new Int16Array(samples.length);
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const v = Math.max(-1, Math.min(1, samples[i]));
      data[i] = Math.round(v * 32767);
      peak = Math.max(peak, Math.abs(v));
    }
    const rec = { id: note + ':' + layer, note, layer, vel, rate, peak, data, date: Date.now() };
    await tx('readwrite', (st) => st.put(rec));
    S.buffers.set(rec.id, entry(rec));
    rescale();
  };

  S.clear = async function () {
    await tx('readwrite', (st) => st.clear());
    S.buffers.clear();
  };

  // Nearest recording, preferring the soft or loud layer that matches how hard the key was pressed.
  S.pick = function (n, vel) {
    if (!S.buffers.size) return null;
    const want = vel < 0.6 ? 'soft' : 'loud';
    let best = null, bestScore = Infinity;
    S.buffers.forEach((b) => {
      const score = Math.abs(b.note - n) + (b.layer === want ? 0 : 7);
      if (score < bestScore) { best = b; bestScore = score; }
    });
    return best;
  };
})();
