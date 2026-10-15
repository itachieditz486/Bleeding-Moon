// Procedurally synthesised effects for sounds the supplied packs do not contain:
// footsteps, landing, sword whoosh, jump, hurt grunt, boss growls, thunder, wind. Original code, no samples, no licence needed.
export class SynthSfx {
  constructor(audio) { this.a = audio; this.noise = null; this.brown = null; this.windNode = null; }
  get ctx() { return this.a.ctx; }
  get ok() { return !!this.ctx && this.ctx.state === 'running'; }
  _buffers() {
    if (this.noise) return;
    const c = this.ctx, n = c.sampleRate * 2, w = c.createBuffer(1, n, c.sampleRate), b = c.createBuffer(1, n * 2, c.sampleRate);
    const wd = w.getChannelData(0); for (let i = 0; i < n; i++) wd[i] = Math.random() * 2 - 1;
    const bd = b.getChannelData(0); let last = 0; for (let i = 0; i < bd.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    this.noise = w; this.brown = b;
  }
  _out(bus = 'sfx') { return this.a.bus[bus].user; }
  _noise(buf, dest, t, dur, filterType, f0, f1, q, g0, g1 = 0.0001, offset = 0) {
    const c = this.ctx, src = c.createBufferSource(), flt = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; flt.type = filterType; flt.Q.value = q;
    flt.frequency.setValueAtTime(f0, t); flt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(g0, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, g1), t + dur);
    src.connect(flt); flt.connect(g); g.connect(dest); src.start(t, offset, dur + 0.05); return g;
  }
  _tone(dest, t, dur, type, f0, f1, g0, lp) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(g0, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o; if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); node = f; }
    node.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  step(heavy = 0) {
    if (!this.ok) return; this._buffers(); const t = this.ctx.currentTime, f = 420 + Math.random() * 320;
    this._noise(this.noise, this._out(), t, 0.07, 'bandpass', f, f * 0.6, 0.9, 0.05 + heavy * 0.03, 0.0005, Math.random());
  }
  land(power = 1) {
    if (!this.ok) return; this._buffers(); const t = this.ctx.currentTime, o = this._out();
    this._noise(this.noise, o, t, 0.12, 'lowpass', 600, 200, 0.7, 0.1 * power, 0.0005, Math.random());
    this._tone(o, t, 0.12, 'sine', 110, 55, 0.12 * power);
  }
  whoosh(pitch = 1) {
    if (!this.ok) return; this._buffers(); const t = this.ctx.currentTime;
    this._noise(this.noise, this._out(), t, 0.16, 'bandpass', 900 * pitch, 2400 * pitch, 1.2, 0.0001, 0.0001);   // placeholder to keep node order
    const g = this._noise(this.noise, this._out(), t, 0.16, 'bandpass', 1800 * pitch, 500 * pitch, 1.4, 0.16, 0.001, Math.random());
  }
  jump() { if (!this.ok) return; this._buffers(); const t = this.ctx.currentTime; this._noise(this.noise, this._out(), t, 0.1, 'highpass', 900, 1800, 0.7, 0.05, 0.001, 0.3); this._tone(this._out(), t, 0.08, 'triangle', 180, 320, 0.03); }
  dash() { if (!this.ok) return; this._buffers(); const t = this.ctx.currentTime; this._noise(this.noise, this._out(), t, 0.2, 'highpass', 600, 3000, 0.6, 0.14, 0.001, 0.5); this._tone(this._out(), t, 0.18, 'sawtooth', 140, 60, 0.04, 600); }
  hurt() { if (!this.ok) return; const t = this.ctx.currentTime, o = this._out(); this._tone(o, t, 0.22, 'sawtooth', 240, 90, 0.18, 1100); this._tone(o, t, 0.2, 'square', 120, 60, 0.05, 500); }
  /** boss growl: detuned saws, 28 Hz amplitude wobble, falling formant */
  growl(base = 80, dur = 0.9, power = 1) {
    if (!this.ok) return; this._buffers(); const c = this.ctx, t = c.currentTime, o = this._out();
    const g = c.createGain(), lp = c.createBiquadFilter(), lfo = c.createOscillator(), lg = c.createGain();
    lp.type = 'lowpass'; lp.Q.value = 6; lp.frequency.setValueAtTime(base * 7, t); lp.frequency.exponentialRampToValueAtTime(base * 2.2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28 * power, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lfo.frequency.value = 26 + Math.random() * 6; lg.gain.value = 0.35 * 0.28 * power; lfo.connect(lg); lg.connect(g.gain);
    for (const d of [1, 1.51, 0.5]) { const os = c.createOscillator(); os.type = 'sawtooth'; os.frequency.setValueAtTime(base * d * 1.3, t); os.frequency.exponentialRampToValueAtTime(base * d * 0.7, t + dur); os.connect(lp); os.start(t); os.stop(t + dur + 0.05); }
    lp.connect(g); g.connect(o); lfo.start(t); lfo.stop(t + dur + 0.05);
    this._noise(this.noise, o, t, dur, 'bandpass', 500, 200, 1.2, 0.07 * power, 0.0005, Math.random());
  }
  thunder(distance = 1) {
    if (!this.ok) return; this._buffers(); const c = this.ctx, t = c.currentTime + 0.02, o = this._out('ambience');
    this._noise(this.noise, o, t, 0.08, 'bandpass', 2400, 900, 0.8, 0.22 / distance, 0.001, Math.random());   // crack
    const src = c.createBufferSource(), lp = c.createBiquadFilter(), g = c.createGain(); src.buffer = this.brown; lp.type = 'lowpass'; lp.frequency.value = 260 / Math.sqrt(distance);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9 / distance, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    src.connect(lp); lp.connect(g); g.connect(o); src.start(t, Math.random() * 2, 3.4);
  }
  windStart(vol = 0.32) {
    if (!this.ok || this.windNode) return; this._buffers(); const c = this.ctx, src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(), lf2 = c.createOscillator(), lg2 = c.createGain();
    src.buffer = this.noise; src.loop = true; bp.type = 'bandpass'; bp.Q.value = 0.5; bp.frequency.value = 380;
    g.gain.value = 0.0001; g.gain.setTargetAtTime(vol * 0.5, c.currentTime, 1.2);
    lfo.frequency.value = 0.11; lg.gain.value = vol * 0.35; lfo.connect(lg); lg.connect(g.gain);
    lf2.frequency.value = 0.07; lg2.gain.value = 140; lf2.connect(lg2); lg2.connect(bp.frequency);
    src.connect(bp); bp.connect(g); g.connect(this._out('ambience')); src.start(); lfo.start(); lf2.start();
    this.windNode = { src, g, lfo, lf2 };
  }
  windStop() {
    const w = this.windNode; if (!w) return; this.windNode = null; const t = this.ctx.currentTime;
    w.g.gain.cancelScheduledValues(t); w.g.gain.setTargetAtTime(0.0001, t, 0.5);
    setTimeout(() => { try { w.src.stop(); w.lfo.stop(); w.lf2.stop(); } catch (e) { /* ignore */ } }, 2500);
  }
}
