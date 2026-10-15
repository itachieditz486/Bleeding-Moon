/**
 * AudioManager - offline-first Web Audio mixer (ES module, no dependencies).
 *
 *   import AudioManager from './audio/AudioManager.js';
 *   const audio = new AudioManager();          // paths are relative to the page
 *   await audio.init();                        // loads the manifest, builds the mixer
 *   audio.unlockOnGesture();                   // mobile browsers need a tap before sound
 *   await audio.loadGroup('core');             // small one-shots (~15 MB decoded)
 *   await audio.loadGroup('explore');
 *   audio.enterArea('castle_exploration');     // ambience loop
 *   audio.play('sfx_hit_sword');
 *   await audio.loadGroup('boss');             // load on boss approach, unload after
 *   audio.enterBoss('hollow_knight');          // spawn cue, ambience out, boss music in
 *   audio.cue('hollow_knight', 'telegraph');
 *   audio.exitBoss();  audio.unloadGroup('boss');
 *
 * Design rules: nothing here throws at the game. An unknown key, a file that failed to
 * load or a blocked context just makes the call a silent no-op (one console warning).
 * Files are fetched with XMLHttpRequest, which also works from file:// inside an Android
 * WebView (fetch() does not), and nothing is ever requested from another origin.
 */
const STORE_KEY = 'dfg.audio.v1';

function embedded(url) {
  // single-file build: assets are base64 strings in window.__EMBED__, keyed by path relative to assets/audio/
  const E = typeof window !== 'undefined' && window.__EMBED__;
  if (!E) return null;
  const key = url.replace(/^.*assets\/audio\//, '');
  return E[key] || null;
}
function b64ToBuf(b64) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }

function xhr(url, type) {
  const emb = embedded(url);
  if (emb) return Promise.resolve(type === 'json' ? JSON.parse(atob(emb)) : b64ToBuf(emb));
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.responseType = type;
    x.onload = () => {
      // file:// reports status 0 on success
      const okStatus = (x.status >= 200 && x.status < 300) || (x.status === 0 && x.response);
      okStatus ? resolve(x.response) : reject(new Error('HTTP ' + x.status + ' ' + url));
    };
    x.onerror = () => reject(new Error('network error ' + url));
    x.send();
  });
}

function decode(ctx, data) {
  // promise form where supported, callback form for older WebViews
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(data, resolve, reject);
    if (p && typeof p.then === 'function') p.then(resolve, reject);
  });
}

export default class AudioManager {
  constructor({ manifestUrl = 'assets/audio/audio-manifest.json' } = {}) {
    this.manifestUrl = manifestUrl;
    this.base = manifestUrl.replace(/[^/]*$/, '');
    this.m = null; this.ctx = null;
    this.buffers = new Map();          // file -> AudioBuffer
    this.voices = new Map();           // sound key -> [{src, gain}]
    this.loops = new Map();            // sound key -> {src, gain}
    this.lastPlayed = new Map();       // sound key -> ctx time
    this.warned = new Set();
    this.groupFiles = new Map();       // group -> [files]
    this.ambienceKey = null; this.bossActive = false; this.areaKey = null;
    this.settings = { master: 0.8, muted: false, buses: {} };
  }

  /* ---------- setup ---------- */
  async init() {
    this.m = await xhr(this.manifestUrl, 'json');
    if (typeof this.m === 'string') this.m = JSON.parse(this.m);
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this._warn('no-webaudio', 'Web Audio unavailable - game will run silent'); return this; }
    this.ctx = new AC({ latencyHint: 'interactive' });
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.bus = {};
    for (const [name, b] of Object.entries(this.m.buses)) {
      const user = this.ctx.createGain(), duck = this.ctx.createGain();
      user.connect(duck); duck.connect(this.master);
      this.bus[name] = { user, duck, volume: b.volume };
    }
    this._loadSettings();
    this._applyVolumes(true);
    document.addEventListener('visibilitychange', () => {   // Android: stop when app is backgrounded
      if (!this.ctx) return;
      if (document.hidden) { this._wasRunning = this.ctx.state === 'running'; this.ctx.suspend(); }
      else if (this._wasRunning) this.ctx.resume();
    });
    return this;
  }

  unlockOnGesture() {
    if (!this.ctx) return;
    const evts = ['pointerdown', 'touchend', 'keydown', 'click'];
    const go = () => {
      this.ctx.resume().then(() => { if (this.ctx.state === 'running') evts.forEach(e => window.removeEventListener(e, go, true)); });
    };
    evts.forEach(e => window.addEventListener(e, go, true));
  }

  /* ---------- loading (per group, so low-RAM phones need not hold everything) ---------- */
  async loadGroup(name, onProgress) {
    const keys = this.m.groups[name];
    if (!keys) throw new Error('unknown audio group ' + name);
    const files = [...new Set(keys.map(k => this.m.sounds[k].file))];
    this.groupFiles.set(name, files);
    const loaded = [], failed = [];
    let done = 0;
    await Promise.all(files.map(async f => {
      if (this.buffers.has(f)) { loaded.push(f); }
      else {
        try {
          if (!this.ctx) throw new Error('no audio context');
          this.buffers.set(f, await decode(this.ctx, await xhr(this.base + f, 'arraybuffer')));
          loaded.push(f);
        } catch (e) { failed.push(f); this._warn('load:' + f, 'audio load failed: ' + f + ' (' + e.message + ')'); }
      }
      if (onProgress) onProgress(++done / files.length);
    }));
    return { loaded, failed };
  }

  unloadGroup(name) {
    const mine = this.groupFiles.get(name) || [];
    this.groupFiles.delete(name);
    const stillNeeded = new Set([].concat(...this.groupFiles.values()));
    for (const f of mine) if (!stillNeeded.has(f)) this.buffers.delete(f);
  }

  /* ---------- one-shots ---------- */
  _resolve(key) {
    let d = this.m && this.m.sounds[key];
    if (!d) { this._warn('key:' + key, 'unknown sound ' + key); return null; }
    if (d.alias) { const base = this.m.sounds[d.alias]; d = Object.assign({}, base, d); }
    return d;
  }

  /** Returns a handle {stop(fade)} or null when skipped (cooldown, missing buffer, silent). */
  play(key, o = {}) {
    if (!this.ctx) return null;
    const d = this._resolve(key); if (!d) return null;
    const buf = this.buffers.get(d.file);
    if (!buf) { this._warn('buf:' + d.file, 'not loaded: ' + key); return null; }
    const now = this.ctx.currentTime;
    if (d.cooldownMs && now - (this.lastPlayed.get(key) ?? -1e9) < d.cooldownMs / 1000) return null;
    const list = this.voices.get(key) || []; this.voices.set(key, list);
    if (d.maxVoices && list.length >= d.maxVoices) this._stopVoice(list.shift(), 0.03);   // steal the oldest
    this.lastPlayed.set(key, now);

    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = buf;
    const jitter = d.rateJitter ? 1 + (Math.random() * 2 - 1) * d.rateJitter : 1;
    src.playbackRate.value = (o.rate ?? d.rate ?? 1) * jitter;
    g.gain.value = (o.volume ?? 1) * (d.volume ?? 1);
    src.connect(g); g.connect(this.bus[d.bus].user);
    const when = now + (o.delay || 0);
    src.start(when);
    const v = { src, gain: g };
    list.push(v);
    src.onended = () => { const i = list.indexOf(v); if (i >= 0) list.splice(i, 1); try { g.disconnect(); } catch (e) { /* already gone */ } };
    if (d.duck) this._duck(d.duck.amount, d.duck.ms, (o.delay || 0));
    return { stop: (fade = 0.05) => this._stopVoice(v, fade) };
  }

  _stopVoice(v, fade) {
    if (!v) return;
    const t = this.ctx.currentTime;
    try { v.gain.gain.cancelScheduledValues(t); v.gain.gain.setTargetAtTime(0, t, Math.max(fade, 0.01) / 3); v.src.stop(t + fade + 0.05); } catch (e) { /* already stopped */ }
  }

  /** Lower music + ambience under a big stinger, then bring them back. */
  _duck(amount, ms, delay = 0) {
    const t = this.ctx.currentTime + delay;
    for (const n of ['music', 'ambience']) {
      const p = this.bus[n].duck.gain;
      p.cancelScheduledValues(t);
      p.setTargetAtTime(amount, t, 0.04);
      p.setTargetAtTime(1, t + ms / 1000, 0.5);
    }
  }

  /* ---------- loops ---------- */
  playLoop(key, { fade = 1.0, volume = 1 } = {}) {
    if (!this.ctx || this.loops.has(key)) return;
    const d = this._resolve(key); if (!d) return;
    const buf = this.buffers.get(d.file);
    if (!buf) { this._warn('buf:' + d.file, 'not loaded: ' + key); return; }
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = buf; src.loop = true;
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime((d.volume ?? 1) * volume, t + Math.max(fade, 0.01));
    src.connect(g); g.connect(this.bus[d.bus].user);
    src.start(t);
    this.loops.set(key, { src, gain: g });
  }

  stopLoop(key, fade = 1.0) {
    const l = this.loops.get(key); if (!l) return;
    this.loops.delete(key);
    const t = this.ctx.currentTime;
    l.gain.gain.cancelScheduledValues(t);
    l.gain.gain.setValueAtTime(l.gain.gain.value, t);
    l.gain.gain.linearRampToValueAtTime(0, t + Math.max(fade, 0.01));
    l.src.stop(t + fade + 0.1);
    l.src.onended = () => { try { l.gain.disconnect(); } catch (e) { /* ok */ } };
  }

  /* ---------- scene helpers ---------- */
  enterArea(area, fade = 2.0) {
    this.areaKey = area;
    const key = this.m.areas[area];
    if (!key) return this._warn('area:' + area, 'unknown area ' + area);
    if (this.bossActive) return;                 // boss music owns the mix until exitBoss()
    this._setAmbience(key, fade);
  }

  _setAmbience(key, fade) {
    if (this.ambienceKey === key) return;
    if (this.ambienceKey) this.stopLoop(this.ambienceKey, fade);
    this.ambienceKey = key;
    this.playLoop(key, { fade });
  }

  enterBoss(bossId, { musicDelayMs = 1500 } = {}) {
    if (this.bossActive) return;
    this.bossActive = true;
    if (this.ambienceKey) { this.stopLoop(this.ambienceKey, 1.5); this.ambienceKey = null; }
    this.cue(bossId, 'spawn');
    clearTimeout(this._bossTimer);
    this._bossTimer = setTimeout(() => { if (this.bossActive) this.playLoop('music_boss', { fade: 1.2 }); }, musicDelayMs);
  }

  exitBoss(fade = 2.0) {
    if (!this.bossActive) return;
    this.bossActive = false;
    clearTimeout(this._bossTimer);
    this.stopLoop('music_boss', fade);
    if (this.areaKey) this._setAmbience(this.m.areas[this.areaKey], fade);
  }

  cue(bossId, kind) {
    const list = this.m.bossCues[bossId] && this.m.bossCues[bossId][kind];
    if (!list) return this._warn('cue:' + bossId + kind, 'no cue ' + bossId + '/' + kind);
    for (const c of list) this.play(c.sound, { rate: c.rate, volume: c.volume, delay: c.delay });
  }

  /* ---------- volume / mute ---------- */
  setMasterVolume(v) { this.settings.master = Math.min(1, Math.max(0, v)); this._applyVolumes(); this._saveSettings(); }
  setBusVolume(name, v) { this.settings.buses[name] = Math.min(1, Math.max(0, v)); this._applyVolumes(); this._saveSettings(); }
  setMuted(m) { this.settings.muted = !!m; this._applyVolumes(); this._saveSettings(); }
  toggleMute() { this.setMuted(!this.settings.muted); return this.settings.muted; }

  _applyVolumes(instant) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, tc = instant ? 0.001 : 0.03;
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.master, t, tc);
    for (const [n, b] of Object.entries(this.bus)) b.user.gain.setTargetAtTime(this.settings.buses[n] ?? b.volume, t, tc);
  }

  _loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (s) this.settings = Object.assign(this.settings, { master: s.master, muted: !!s.muted, buses: s.buses || {} });
    } catch (e) { /* storage blocked: defaults are fine */ }
  }
  _saveSettings() { try { localStorage.setItem(STORE_KEY, JSON.stringify(this.settings)); } catch (e) { /* ignore */ } }

  stats() {
    let pcm = 0; this.buffers.forEach(b => { pcm += b.length * b.numberOfChannels * 4; });
    let voices = 0; this.voices.forEach(l => { voices += l.length; });
    return { state: this.ctx && this.ctx.state, buffers: this.buffers.size, decodedMB: +(pcm / 1048576).toFixed(1), voices, loops: [...this.loops.keys()] };
  }

  _warn(id, msg) { if (!this.warned.has(id)) { this.warned.add(id); console.warn('[audio] ' + msg); } }
}
