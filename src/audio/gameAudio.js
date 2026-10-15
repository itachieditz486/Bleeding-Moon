// Game-facing audio: maps gameplay events to the imported OGG files (via AudioManager) and the synthesised extras.
import AudioManager from './AudioManager.js';
import { SynthSfx } from './SynthSfx.js';

const GROWL = { hollow_knight: [62, 1.0], abyssal_wraith: [140, 1.1], fallen_sovereign: [48, 1.4] };

export class GameAudio {
  constructor(manifestUrl) { this.am = new AudioManager({ manifestUrl }); this.syn = null; this.ready = false; this.paused = false; this.lastStep = 0; this.failed = false; }
  async init(onProgress) {
    try {
      await this.am.init(); this.syn = new SynthSfx(this.am); this.am.unlockOnGesture();
      const groups = ['core', 'explore'];
      let done = 0; for (const g of groups) { await this.am.loadGroup(g); onProgress && onProgress(++done / (groups.length + 1)); }
      this.ready = true; onProgress && onProgress(1);
    } catch (e) { this.failed = true; console.warn('[audio] disabled:', e && e.message); }
  }
  get ctx() { return this.am.ctx; }
  get settings() { return this.am.settings; }
  async loadBoss() { clearTimeout(this._ut); if (this.ready) await this.am.loadGroup('boss'); }
  /** free the boss buffers after a delay; a later loadBoss() cancels a pending unload */
  unloadBoss(delayMs = 0) { clearTimeout(this._ut); this._ut = setTimeout(() => { if (this.ready && !this.am.bossActive) this.am.unloadGroup('boss'); }, delayMs); }
  play(k, o) { return this.ready ? this.am.play(k, o) : null; }

  area(name) { if (!this.ready) return; this.am.enterArea(name === 'throne_room' ? 'throne_room' : name, 2.0); }
  menuMusic() { if (this.ready) { this.am.areaKey = 'main_menu'; this.am.enterArea('main_menu', 2.5); } }
  startWind() { this.syn && this.syn.windStart(); }
  stopWind() { this.syn && this.syn.windStop(); }
  pause(on) { this.paused = on; if (!this.ready) return; for (const b of ['music', 'ambience']) { const d = this.am.bus[b].duck.gain, t = this.am.ctx.currentTime; d.cancelScheduledValues(t); d.setTargetAtTime(on ? 0.25 : 1, t, 0.08); } }

  uiMove() { this.play('ui_move'); }
  uiConfirm() { this.play('ui_confirm'); }
  uiBack() { this.play('ui_move', { rate: 0.8 }); }
  swing(combo) { this.syn && this.syn.whoosh(combo ? 1.15 : 0.9); }
  hitEnemy() { this.play('sfx_hit_sword'); }
  hitBoss(heavy) { this.play('sfx_hit_sword', { rate: heavy ? 0.7 : 0.85, volume: 1 }); if (heavy) this.play('sfx_explosion', { volume: 0.25, rate: 1.4 }); }
  special() { this.play('sfx_shadow_cast'); }
  specialHit() { this.play('sfx_explosion', { volume: 0.4, rate: 1.3 }); }
  dash() { this.syn && this.syn.dash(); }
  jump() { this.syn && this.syn.jump(); }
  land(p) { this.syn && this.syn.land(p); }
  step(run) { const n = performance.now(); if (n - this.lastStep > (run ? 150 : 230)) { this.lastStep = n; this.syn && this.syn.step(run ? 1 : 0); } }
  hurt() { this.syn && this.syn.hurt(); this.play('sfx_explosion', { volume: 0.22, rate: 1.7 }); }
  death() { this.play('sfx_player_death'); }
  shrine() { this.play('ui_checkpoint'); this.play('sfx_heal', { volume: 0.8 }); }
  heal() { this.play('sfx_heal', { volume: 0.6, rate: 1.2 }); }
  gate() { this.play('sfx_gate_open'); this.syn && this.syn.growl(40, 1.0, 0.5); }
  explosion(v = 0.7, r = 1) { this.play('sfx_explosion', { volume: v, rate: r }); }
  impact() { this.play('sfx_impact_major'); }
  thunder(d) { this.syn && this.syn.thunder(d); }
  victory() { this.play('sfx_victory'); }

  async bossPrepare() { await this.loadBoss(); }
  bossIntro(id) { if (!this.ready) return; this.am.enterBoss(id, { musicDelayMs: 1800 }); const g = GROWL[id]; setTimeout(() => this.syn && this.syn.growl(g[0], g[1], 0.9), 400); }
  bossTelegraph(id) { if (this.ready) this.am.cue(id, 'telegraph'); }
  bossPhase(id) { if (!this.ready) return; this.am.cue(id, 'phase'); const g = GROWL[id]; this.syn && this.syn.growl(g[0] * 0.8, g[1] * 1.3, 1.1); }
  bossGrowl(id, p = 1) { const g = GROWL[id]; this.syn && this.syn.growl(g[0] * p, g[1] * 0.6, 0.7); }
  bossDefeat(id) { if (!this.ready) return; this.am.cue(id, 'defeat'); const g = GROWL[id]; this.syn && this.syn.growl(g[0] * 0.6, 2.0, 1.0); }
  bossExit(fade) { if (this.ready) this.am.exitBoss(fade); }
}
