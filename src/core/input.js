// Unified input: keyboard + virtual (touch) buttons feed the same action table.
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'jump',
  KeyJ: 'attack', KeyX: 'attack', KeyK: 'special', KeyC: 'special', KeyL: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash',
  Enter: 'confirm', Escape: 'pause', KeyP: 'pause',
};
// ArrowUp / KeyW also jump (they are 'up' for menus); handled below.
const ALSO_JUMP = new Set(['ArrowUp', 'KeyW']);
export const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'special', 'dash', 'confirm', 'pause'];

export class Input {
  constructor(target = window) {
    this.keys = {}; this.virt = {}; this.latch = {}; this.cur = {}; this.prev = {}; this.pressTime = {}; this.releaseEdge = {};
    this.now = 0; this.usedTouch = false;
    for (const a of ACTIONS) { this.latch[a] = false; this.keys[a] = new Set(); this.virt[a] = new Set(); this.cur[a] = false; this.prev[a] = false; this.pressTime[a] = -1e9; }
    target.addEventListener('keydown', e => this._key(e, true));
    target.addEventListener('keyup', e => this._key(e, false));
    target.addEventListener('blur', () => this.releaseAll());
  }
  _key(e, down) {
    const acts = [];
    if (KEYMAP[e.code]) acts.push(KEYMAP[e.code]);
    if (ALSO_JUMP.has(e.code)) acts.push('jump');
    if (e.code === 'Space') acts.push('confirm');
    if (!acts.length) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    for (const a of acts) { if (down) { this.keys[a].add(e.code); this.latch[a] = true; } else this.keys[a].delete(e.code); }
  }
  setVirtual(action, id, down) { if (down) { this.virt[action].add(id); this.latch[action] = true; this.usedTouch = true; } else this.virt[action].delete(id); }
  releaseAll() { for (const a of ACTIONS) { this.keys[a].clear(); this.virt[a].clear(); this.latch[a] = false; } }
  /** Call once per fixed step, BEFORE game logic. */
  update(now) {
    this.now = now;
    for (const a of ACTIONS) {
      this.prev[a] = this.cur[a];
      this.cur[a] = this.keys[a].size > 0 || this.virt[a].size > 0 || this.latch[a];   // latch: a press+release inside one step still counts for one step
      this.latch[a] = false;
      if (this.cur[a] && !this.prev[a]) this.pressTime[a] = now;
    }
  }
  down(a) { return this.cur[a]; }
  pressed(a) { return this.cur[a] && !this.prev[a]; }
  released(a) { return !this.cur[a] && this.prev[a]; }
  /** seconds since the last press edge (for jump buffering etc.) */
  since(a) { return this.now - this.pressTime[a]; }
  consume(a) { this.pressTime[a] = -1e9; }
  axis() { return (this.cur.right ? 1 : 0) - (this.cur.left ? 1 : 0); }
}
