// Audio engine: music, rain, clock, footsteps, doors and UI sounds, synthesized with the Web Audio API.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.8, music: 0.5, sfx: 0.8, ambient: 0.7, voice: 0.95 };
    this.voiceCache = new Map();
    this.spatial = [];
  }

  init() {
    if (this.ctx) return;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain(); this.sfxBus = ctx.createGain(); this.ambBus = ctx.createGain(); this.voiceBus = ctx.createGain();
    // shared reverb
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(3.2, 2.5);
    const revGain = ctx.createGain(); revGain.gain.value = 0.35;
    this.reverb.connect(revGain).connect(this.master);
    for (const b of [this.musicBus, this.sfxBus, this.ambBus, this.voiceBus]) b.connect(this.master);
    this.musicBus.connect(this.reverb);
    this.noiseBuf = this._noise(4);
    this.applyVolumes();
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setVolumes(v) { Object.assign(this.vol, v); this.applyVolumes(); }
  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.vol.ambient, t, 0.05);
    this.voiceBus.gain.setTargetAtTime(this.vol.voice ?? 0.95, t, 0.05);
  }

  _noise(sec) {
    const b = this.ctx.createBuffer(2, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    return b;
  }
  _impulse(sec, decay) {
    const rate = this.ctx.sampleRate, len = rate * sec;
    const b = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  _noiseSrc(loop = true) { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = loop; return s; }

  // ---------- Ambience ----------
  startRain(intensity = 1) {
    if (!this.ctx || this.rain) return;
    const ctx = this.ctx;
    const src = this._noiseSrc();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180;
    const g = ctx.createGain(); g.gain.value = 0.22 * intensity;
    src.connect(hp).connect(lp).connect(g).connect(this.ambBus);
    src.start();
    // droplets on glass
    const drops = setInterval(() => {
      if (!this.ctx) return;
      for (let i = 0; i < 3; i++) setTimeout(() => this._drop(), Math.random() * 300);
    }, 280);
    this.rain = { src, g, drops };
    this._scheduleThunder();
  }
  setRainMuffle(indoor) { if (this.rain) this.rain.g.gain.setTargetAtTime(indoor ? 0.16 : 0.3, this.ctx.currentTime, 0.4); }
  _drop() {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(2200 + Math.random() * 2500, t);
    o.frequency.exponentialRampToValueAtTime(600 + Math.random() * 300, t + 0.04);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.012 * Math.random(), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    const p = ctx.createStereoPanner(); p.pan.value = Math.random() * 2 - 1;
    o.connect(g).connect(p).connect(this.ambBus); o.start(t); o.stop(t + 0.06);
  }
  _scheduleThunder() {
    this.thunderTimer = setTimeout(() => { this.thunder(); this._scheduleThunder(); }, 25000 + Math.random() * 35000);
  }
  thunder(delay = 0.6) {
    if (!this.ctx) return;
    this.onLightning && this.onLightning();
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const src = this._noiseSrc(false);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(80, t + 4);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.25, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
    src.connect(lp).connect(g).connect(this.ambBus); g.connect(this.reverb);
    src.start(t); src.stop(t + 5);
  }

  // positional ticking clock
  addClock(getPos) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const pan = ctx.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 1; pan.rolloffFactor = 1.4;
    pan.connect(this.ambBus);
    let tick = 0;
    const iv = setInterval(() => {
      if (!this.ctx) return;
      const p = getPos(); pan.positionX.value = p.x; pan.positionY.value = p.y; pan.positionZ.value = p.z;
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = tick++ % 2 ? 2400 : 1900;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = 8;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      o.connect(bp).connect(g).connect(pan); o.start(t); o.stop(t + 0.04);
    }, 1000);
    this.spatial.push({ iv });
  }
  // flickering fluorescent / electrical buzz
  addHum(getPos, freq = 100, level = 0.05) {
    if (!this.ctx) return null;
    const ctx = this.ctx;
    const pan = ctx.createPanner(); pan.distanceModel = 'inverse'; pan.refDistance = 0.8; pan.rolloffFactor = 2;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    const g = ctx.createGain(); g.gain.value = level;
    o.connect(lp).connect(g).connect(pan).connect(this.ambBus); o.start();
    const p = getPos(); pan.positionX.value = p.x; pan.positionY.value = p.y; pan.positionZ.value = p.z;
    const h = { o, g, iv: null }; this.spatial.push(h); return h;
  }
  updateListener(pos, fwd) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = pos.x; l.positionY.value = pos.y; l.positionZ.value = pos.z;
      l.forwardX.value = fwd.x; l.forwardY.value = fwd.y; l.forwardZ.value = fwd.z;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    }
  }
  stopAmbience() {
    if (this.rain) { try { this.rain.src.stop(); } catch {} clearInterval(this.rain.drops); this.rain = null; }
    clearTimeout(this.thunderTimer);
    for (const s of this.spatial) { if (s.iv) clearInterval(s.iv); if (s.o) try { s.o.stop(); } catch {} }
    this.spatial = [];
  }

  // ---------- Music ----------
  // A slow, dark noir progression with a soft pad, sparse piano and a low pulse.
  startMusic(mood = 'investigation') {
    if (!this.ctx) return;
    this.stopMusic();
    const ctx = this.ctx;
    const out = ctx.createGain(); out.gain.value = 0; out.connect(this.musicBus);
    out.gain.setTargetAtTime(1, ctx.currentTime, 2);
    const chords = mood === 'menu'
      ? [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 58], [40, 47, 52, 56]]
      : [[38, 45, 50, 53], [34, 41, 46, 50], [36, 43, 48, 51], [33, 40, 45, 49]];
    const scale = mood === 'menu' ? [57, 60, 62, 64, 65, 67, 69, 72] : [50, 53, 55, 57, 58, 60, 62, 65];
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    let step = 0;
    const barLen = 8;
    const playBar = () => {
      const t = ctx.currentTime + 0.05;
      const chord = chords[step % chords.length];
      // pad
      for (const n of chord) {
        for (const det of [-6, 6]) {
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = det;
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(380, t); lp.frequency.linearRampToValueAtTime(700, t + barLen / 2); lp.frequency.linearRampToValueAtTime(350, t + barLen);
          const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.018, t + 2.5); g.gain.linearRampToValueAtTime(0.0001, t + barLen + 1.5);
          o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + barLen + 1.6);
        }
      }
      // sub pulse
      const bass = ctx.createOscillator(); bass.type = 'sine'; bass.frequency.value = mtof(chord[0] - 12);
      const bg = ctx.createGain(); bg.gain.setValueAtTime(0.0001, t);
      for (let k = 0; k < 4; k++) { bg.gain.setTargetAtTime(0.09, t + k * 2, 0.05); bg.gain.setTargetAtTime(0.0001, t + k * 2 + 0.3, 0.4); }
      bass.connect(bg).connect(out); bass.start(t); bass.stop(t + barLen);
      // sparse piano-like notes
      const notes = 2 + Math.floor(Math.random() * 3);
      for (let k = 0; k < notes; k++) {
        const nt = t + 1 + Math.random() * (barLen - 2);
        const m = scale[Math.floor(Math.random() * scale.length)];
        this._pianoNote(mtof(m), nt, out, 0.05);
      }
      step++;
    };
    playBar();
    this.musicTimer = setInterval(playBar, barLen * 1000);
    this.musicOut = out;
  }
  _pianoNote(f, t, out, vol = 0.05) {
    const ctx = this.ctx;
    for (const [mul, v] of [[1, 1], [2, 0.35], [3, 0.12]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * mul;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
      o.connect(g).connect(out); g.connect(this.reverb); o.start(t); o.stop(t + 3.6);
    }
  }
  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    if (this.musicOut) { const o = this.musicOut; o.gain.setTargetAtTime(0, this.ctx.currentTime, 0.8); setTimeout(() => o.disconnect(), 4000); }
    this.musicTimer = null; this.musicOut = null;
  }

  // ---------- Character voices ----------
  async loadVoice(url) {
    if (!this.ctx) return null;
    if (!this.voiceCache.has(url)) {
      this.voiceCache.set(url, fetch(url).then(r => (r.ok ? r.arrayBuffer() : null)).then(b => (b ? this.ctx.decodeAudioData(b) : null)).catch(() => null));
    }
    return this.voiceCache.get(url);
  }
  // Plays a decoded line. Returns { duration, ended, stop(), level() } where level() is the
  // current loudness (0..1) used to open and close the character's mouth.
  playVoice(buffer) {
    const ctx = this.ctx;
    this.stopVoice();
    const src = ctx.createBufferSource(); src.buffer = buffer;
    const an = ctx.createAnalyser(); an.fftSize = 512;
    src.connect(an); an.connect(this.voiceBus);
    const data = new Float32Array(an.fftSize);
    let done; const ended = new Promise(r => (done = r));
    src.onended = () => { done(); if (this.voice && this.voice.src === src) this.voice = null; };
    src.start();
    const v = this.voice = {
      src, duration: buffer.duration, ended,
      stop: () => { try { src.stop(); } catch {} },
      level: () => { an.getFloatTimeDomainData(data); let s = 0; for (let i = 0; i < data.length; i++) s += data[i] * data[i]; return Math.min(1, Math.sqrt(s / data.length) * 7); },
    };
    return v;
  }
  stopVoice() { if (this.voice) { this.voice.stop(); this.voice = null; } }

  // ---------- SFX ----------
  _env(node, t, a, peak, d) { node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }

  step(surface = 'wood', run = false) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = this._noiseSrc(false);
    src.playbackRate.value = 0.5 + Math.random() * 0.2;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.value = surface === 'tile' ? 2200 : surface === 'carpet' ? 400 : 900; f.Q.value = surface === 'tile' ? 2 : 1.2;
    const g = ctx.createGain(); this._env(g, t, 0.005, (surface === 'carpet' ? 0.08 : 0.16) * (run ? 1.4 : 1), surface === 'tile' ? 0.06 : 0.11);
    src.connect(f).connect(g).connect(this.sfxBus); src.start(t, Math.random() * 3); src.stop(t + 0.2);
    // low thump
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.08);
    const og = ctx.createGain(); this._env(og, t, 0.004, 0.12, 0.08);
    o.connect(og).connect(this.sfxBus); o.start(t); o.stop(t + 0.12);
  }

  door(open = true) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    // creak
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const base = open ? 140 : 180;
    o.frequency.setValueAtTime(base, t);
    for (let i = 0; i < 8; i++) o.frequency.linearRampToValueAtTime(base + Math.random() * 120, t + 0.08 * i + 0.05);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 6;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.1); g.gain.linearRampToValueAtTime(0.0001, t + 0.7);
    o.connect(bp).connect(g).connect(this.sfxBus); g.connect(this.reverb); o.start(t); o.stop(t + 0.75);
    if (!open) { // latch click
      const s = this._noiseSrc(false); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2000;
      const gg = ctx.createGain(); this._env(gg, t + 0.65, 0.002, 0.3, 0.05);
      s.connect(f).connect(gg).connect(this.sfxBus); s.start(t + 0.65); s.stop(t + 0.75);
    }
  }
  locked() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const s = this._noiseSrc(false); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 3;
      const g = ctx.createGain(); this._env(g, t + i * 0.12, 0.002, 0.35, 0.06);
      s.connect(f).connect(g).connect(this.sfxBus); s.start(t + i * 0.12); s.stop(t + i * 0.12 + 0.1);
    }
  }
  click() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(1800, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.03);
    const g = ctx.createGain(); this._env(g, t, 0.002, 0.05, 0.04);
    o.connect(g).connect(this.sfxBus); o.start(t); o.stop(t + 0.06);
  }
  hover() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 2600;
    const g = ctx.createGain(); this._env(g, t, 0.002, 0.012, 0.03);
    o.connect(g).connect(this.sfxBus); o.start(t); o.stop(t + 0.05);
  }
  paper() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = this._noiseSrc(false); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < 5; i++) { g.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.06, t + i * 0.05 + 0.02); g.gain.linearRampToValueAtTime(0.01, t + i * 0.05 + 0.045); }
    g.gain.linearRampToValueAtTime(0.0001, t + 0.35);
    s.connect(f).connect(g).connect(this.sfxBus); s.start(t, Math.random()); s.stop(t + 0.4);
  }
  evidence() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const notes = [62, 69, 74, 77];
    notes.forEach((m, i) => this._pianoNote(440 * Math.pow(2, (m - 69) / 12), t + i * 0.09, this.sfxBus, 0.09));
    const s = this._noiseSrc(false); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = ctx.createGain(); this._env(g, t, 0.01, 0.03, 0.8);
    s.connect(f).connect(g).connect(this.sfxBus); s.start(t); s.stop(t + 1);
  }
  deduction() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    // low hit + rising shimmer
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.8);
    const g = ctx.createGain(); this._env(g, t, 0.01, 0.4, 1.2);
    o.connect(g).connect(this.sfxBus); g.connect(this.reverb); o.start(t); o.stop(t + 1.4);
    [50, 57, 62, 65, 69].forEach((m, i) => this._pianoNote(440 * Math.pow(2, (m - 69) / 12), t + 0.15 + i * 0.07, this.sfxBus, 0.07));
  }
  string() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(330, t); o.frequency.exponentialRampToValueAtTime(320, t + 0.4);
    const g = ctx.createGain(); this._env(g, t, 0.003, 0.08, 0.4);
    o.connect(g).connect(this.sfxBus); o.start(t); o.stop(t + 0.5);
  }
  contradiction() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const f of [146.8, 155.6]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const g = ctx.createGain(); this._env(g, t, 0.01, 0.08, 0.9);
      o.connect(lp).connect(g).connect(this.sfxBus); g.connect(this.reverb); o.start(t); o.stop(t + 1);
    }
  }
  stinger(success = true) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const seq = success ? [50, 57, 62, 66, 69, 74] : [50, 53, 49, 46];
    seq.forEach((m, i) => this._pianoNote(440 * Math.pow(2, (m - 69) / 12), t + i * (success ? 0.16 : 0.35), this.sfxBus, 0.1));
  }
  typeTick() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 500 + Math.random() * 120;
    const g = ctx.createGain(); this._env(g, t, 0.002, 0.006, 0.02);
    o.connect(g).connect(this.sfxBus); o.start(t); o.stop(t + 0.03);
  }
}

export const audio = new AudioEngine();
