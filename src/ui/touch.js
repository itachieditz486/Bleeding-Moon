// Android/touch overlay (Pointer Events). Floating move-stick on the left, five action buttons on the right.
// Rules enforced here: every finger (pointerId) owns at most one control; a finger keeps its control until it is lifted/cancelled
// (so sliding off a button never presses its neighbour); every release path (up, cancel, lost capture, window-level up, blur, hide) clears the input.
const CSS = `
#touch{--u:calc(min(11vh,6.4vw) * var(--sz,1));position:fixed;inset:0;pointer-events:none;z-index:5;display:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:none;opacity:var(--op,.65)}
#touch.on{display:block}
#touch .zone{position:absolute;left:0;bottom:0;width:46vw;height:78vh;pointer-events:auto;touch-action:none}
#touch .ring{position:absolute;width:calc(var(--u)*3.4);height:calc(var(--u)*3.4);margin:calc(var(--u)*-1.7);border-radius:50%;background:rgba(58,45,120,.22);border:2px solid rgba(166,138,232,.5);pointer-events:none;transition:opacity .12s}
#touch .ring.idle{opacity:.55}
#touch .knob{position:absolute;left:50%;top:50%;width:42%;height:42%;margin:-21%;border-radius:50%;background:rgba(214,196,255,.38);border:2px solid rgba(214,196,255,.75)}
#touch .btn{position:absolute;pointer-events:auto;border-radius:50%;background:rgba(58,45,120,.4);border:2px solid rgba(166,138,232,.65);color:#d6c4ff;font:bold calc(var(--u)*.3) monospace;letter-spacing:.5px;display:flex;align-items:center;justify-content:center;touch-action:none;text-shadow:0 1px 0 #07050d;transition:transform .05s,background .05s}
#touch .btn.down{background:rgba(214,196,255,.5);color:#fff;transform:scale(.92);border-color:#fff}
#touch .atk{right:max(14px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));width:calc(var(--u)*2.1);height:calc(var(--u)*2.1);font-size:calc(var(--u)*.4)}
#touch .jmp{right:calc(max(14px,env(safe-area-inset-right)) + var(--u)*2.35);bottom:max(16px,env(safe-area-inset-bottom));width:calc(var(--u)*1.75);height:calc(var(--u)*1.75)}
#touch .spc{right:calc(max(14px,env(safe-area-inset-right)) + var(--u)*.275);bottom:calc(max(16px,env(safe-area-inset-bottom)) + var(--u)*2.35);width:calc(var(--u)*1.55);height:calc(var(--u)*1.55);font-size:calc(var(--u)*.22)}
#touch .dsh{right:calc(max(14px,env(safe-area-inset-right)) + var(--u)*2.45);bottom:calc(max(16px,env(safe-area-inset-bottom)) + var(--u)*2.0);width:calc(var(--u)*1.55);height:calc(var(--u)*1.55)}
#touch .pse{right:max(10px,env(safe-area-inset-right));top:max(8px,env(safe-area-inset-top));width:max(44px,calc(var(--u)*.95));height:max(44px,calc(var(--u)*.95));border-radius:12px;font-size:calc(var(--u)*.4)}
#rotate{position:fixed;inset:0;background:#07050d;color:#d6c4ff;font:bold 16px monospace;display:none;align-items:center;justify-content:center;text-align:center;z-index:9;padding:24px}
@media (orientation:portrait){#rotate.need{display:flex}}`;

export class Touch {
  constructor(input) {
    this.input = input; this.mode = 'auto'; this.visible = false; this.owned = new Map();   // pointerId -> release()
    this.stick = { id: null, ox: 0, oy: 0, dir: 0 };
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.root = document.createElement('div'); this.root.id = 'touch';
    this.root.innerHTML = '<div class="zone" data-zone></div><div class="ring idle" data-ring><div class="knob"></div></div>' +
      '<div class="btn atk" data-act="attack">ATK</div><div class="btn jmp" data-act="jump">JUMP</div><div class="btn dsh" data-act="dash">DASH</div><div class="btn spc" data-act="special">SHADOW</div><div class="btn pse" data-act="pause">II</div>';
    document.body.appendChild(this.root);
    this.rot = document.createElement('div'); this.rot.id = 'rotate'; this.rot.textContent = 'PLEASE ROTATE YOUR DEVICE TO LANDSCAPE'; document.body.appendChild(this.rot);
    this.zone = this.root.querySelector('[data-zone]'); this.ring = this.root.querySelector('[data-ring]'); this.knob = this.ring.querySelector('.knob');
    for (const b of this.root.querySelectorAll('[data-act]')) this.bindButton(b);
    this.bindStick();
    // no duplicate actions from synthesised mouse/click events, no browser scroll/zoom/long-press menu
    for (const t of ['click', 'dblclick', 'contextmenu', 'dragstart']) this.root.addEventListener(t, e => { e.preventDefault(); e.stopPropagation(); });
    for (const t of ['touchstart', 'touchmove', 'touchend']) this.root.addEventListener(t, e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    for (const t of ['gesturestart', 'gesturechange']) document.addEventListener(t, e => e.preventDefault());
    // safety net: any pointer that ends anywhere releases whatever it owned (finger lifted outside the element, capture refused, etc.)
    for (const t of ['pointerup', 'pointercancel']) window.addEventListener(t, e => this.release(e.pointerId), true);
    window.addEventListener('blur', () => this.releaseAll());
    window.addEventListener('touchstart', () => { if (!this.seen) { this.seen = true; this.refresh(); } }, { passive: true });
    this.restPos(); window.addEventListener('resize', () => this.restPos());
  }
  configure(mode, opacity, size) { this.mode = mode; if (opacity !== undefined) this.root.style.setProperty('--op', opacity); if (size !== undefined) this.root.style.setProperty('--sz', size); this.refresh(); this.restPos(); }
  setVisible(v) { this.visible = v; this.refresh(); }
  get active() { const coarse = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches; return this.mode === 'on' || (this.mode !== 'off' && !!(coarse || this.seen)); }
  refresh() {
    const show = !!(this.active && this.visible); this.root.classList.toggle('on', show); this.rot.classList.toggle('need', show);
    if (!show) this.releaseAll(); else this.restPos();
  }
  own(id, fn) { const prev = this.owned.get(id); if (prev) prev(); this.owned.set(id, fn); }
  release(id) { const fn = this.owned.get(id); if (fn) { this.owned.delete(id); fn(); } }
  releaseAll() { for (const id of [...this.owned.keys()]) this.release(id); this.input.releaseAll(); this.stickReset(); this.root.querySelectorAll('.down').forEach(e => e.classList.remove('down')); }
  restPos() {
    if (this.stick.id !== null) return; const r = this.ring.getBoundingClientRect().width || 100; const pad = Math.max(16, 0);
    const x = Math.max(r / 2 + 14, innerWidth * 0.14), y = innerHeight - Math.max(r / 2 + 18, innerHeight * 0.3);
    this.ring.style.left = x + 'px'; this.ring.style.top = y + 'px'; this.ring.classList.add('idle'); this.knob.style.transform = '';
  }
  bindButton(el) {
    const act = el.dataset.act;
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) { /* synthetic pointer */ }
      this.input.setVirtual(act, e.pointerId, true); el.classList.add('down');
      this.own(e.pointerId, () => { this.input.setVirtual(act, e.pointerId, false); el.classList.remove('down'); });
      if (act !== 'pause' && navigator.vibrate) try { navigator.vibrate(7); } catch (x) { /* ignore */ }
    });
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, e => this.release(e.pointerId));
  }
  bindStick() {
    const z = this.zone, S = this.stick;
    z.addEventListener('pointerdown', e => {
      e.preventDefault(); if (S.id !== null) return;                       // one finger drives the stick
      try { z.setPointerCapture(e.pointerId); } catch (x) { /* synthetic pointer */ }
      S.id = e.pointerId; S.ox = e.clientX; S.oy = e.clientY; S.dir = 0; this.ring.classList.remove('idle'); this.ring.style.left = S.ox + 'px'; this.ring.style.top = S.oy + 'px';
      this.own(e.pointerId, () => this.stickReset());
      this.stickMove(e);
    });
    z.addEventListener('pointermove', e => { if (e.pointerId === S.id) this.stickMove(e); });
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) z.addEventListener(t, e => { if (e.pointerId === S.id) this.release(e.pointerId); });
  }
  stickMove(e) {
    const S = this.stick, R = this.ring.getBoundingClientRect().width / 2 || 60; let dx = e.clientX - S.ox, dy = e.clientY - S.oy;
    // floating origin: it trails the thumb, so reversing direction needs only a small movement
    if (Math.abs(dx) > R) { S.ox += dx - Math.sign(dx) * R; dx = Math.sign(dx) * R; this.ring.style.left = S.ox + 'px'; }
    const on = S.dir === 0 ? 0.28 : 0.16, d = Math.abs(dx) / R;       // hysteresis: engage at 28 % of the radius, release below 16 %
    const dir = d > on ? Math.sign(dx) : 0;
    if (dir !== S.dir) { S.dir = dir; this.input.setVirtual('left', S.id, dir < 0); this.input.setVirtual('right', S.id, dir > 0); }
    this.knob.style.transform = `translate(${Math.max(-R * 0.6, Math.min(R * 0.6, dx * 0.6))}px,${Math.max(-R * 0.4, Math.min(R * 0.4, dy * 0.4))}px)`;
  }
  stickReset() {
    const S = this.stick; if (S.id !== null) { this.input.setVirtual('left', S.id, false); this.input.setVirtual('right', S.id, false); }
    S.id = null; S.dir = 0; this.restPos();
  }
}
