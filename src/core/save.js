// Versioned save in localStorage. Every access is wrapped: private windows / blocked storage must not crash the game.
const KEY = 'bleedingmoon.save.v1', SKEY = 'bleedingmoon.settings.v1';
export const DEFAULT_SETTINGS = { touch: 'auto', touchOpacity: 0.65, touchSize: 1, shake: true, particles: 'auto', showFps: false };

export const Save = {
  load(validCheckpoints) {
    try {
      const raw = localStorage.getItem(KEY); if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || s.v !== 1 || !validCheckpoints.includes(s.checkpoint)) return null;
      if (!Array.isArray(s.defeated) || s.defeated.some(b => typeof b !== 'string')) return null;
      if (!(s.maxHp >= 3 && s.maxHp <= 9)) return null;
      return s;
    } catch (e) { return null; }
  },
  exists(validCheckpoints) { return !!Save.load(validCheckpoints); },
  write(data) { try { localStorage.setItem(KEY, JSON.stringify(Object.assign({ v: 1, at: Date.now() }, data))); return true; } catch (e) { return false; } },
  clear() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } },
  loadSettings() { try { return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { return Object.assign({}, DEFAULT_SETTINGS); } },
  saveSettings(s) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) { /* ignore */ } },
};
