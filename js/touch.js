'use strict';
// Controles táctiles para celular: un dedo toca = clic izquierdo (doble toque = correr), arrastrar = mover la cámara,
// pellizco = zoom, pulsación larga = Shift+clic (interactuar). Botones en pantalla para el resto de acciones.
const Touch = {
  on: false, interact: false, pts: new Map(), tap: null, long: null, pinch: null,

  init() {
    this.on = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (!this.on) return;
    document.body.classList.add('touch');
    const cv = G.canvas;
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', e => this.down(e));
    cv.addEventListener('pointermove', e => this.move(e));
    cv.addEventListener('pointerup', e => this.up(e));
    cv.addEventListener('pointercancel', e => this.up(e, true));
    const mini = G.mini;
    mini.style.touchAction = 'none';
    const jump = e => { const r = mini.getBoundingClientRect(); G.centerOn((e.clientX - r.left) / r.width * Level.W, (e.clientY - r.top) / r.height * Level.H); };
    mini.addEventListener('pointerdown', e => { Sfx.ensure(); jump(e); mini.setPointerCapture(e.pointerId); mini._d = true; });
    mini.addEventListener('pointermove', e => { if (mini._d) jump(e); });
    mini.addEventListener('pointerup', () => { mini._d = false; });
    this.buildButtons();
    this.dragItems();
    ['gesturestart', 'gesturechange'].forEach(t => document.addEventListener(t, e => e.preventDefault()));
    document.addEventListener('touchmove', e => { if (e.target === cv) e.preventDefault(); }, { passive: false });
    window.addEventListener('orientationchange', () => setTimeout(() => G.resize(), 250));
  },

  down(e) {
    if (e.pointerType === 'mouse') return;
    Sfx.ensure();
    if (G.overlayOpen) return;
    G.canvas.setPointerCapture(e.pointerId);
    this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false });
    clearTimeout(this.long);
    if (this.pts.size === 1) {
      const id = e.pointerId;
      this.long = setTimeout(() => { // pulsación larga: interactuar
        const p = this.pts.get(id); if (!p || p.moved) return;
        p.moved = true; navigator.vibrate && navigator.vibrate(30);
        Input.leftClick({ clientX: p.x, clientY: p.y, shiftKey: true, ctrlKey: false, altKey: false });
      }, 520);
    } else { this.pinch = this.span(); }
  },

  span() { const a = [...this.pts.values()]; return a.length < 2 ? 0 : Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); },

  move(e) {
    const p = this.pts.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (!p.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 12) { p.moved = true; clearTimeout(this.long); }
    p.x = e.clientX; p.y = e.clientY;
    if (!p.moved) return;
    if (this.pts.size >= 2) { // pellizco: zoom
      const s = this.span();
      if (this.pinch && s > 0) { const [a, b] = [...this.pts.values()]; Render.zoomAt(s / this.pinch, (a.x + b.x) / 2, (a.y + b.y) / 2); }
      this.pinch = s; Render.panPixels(-dx / 2, -dy / 2);
    } else Render.panPixels(-dx, -dy);
  },

  up(e, cancel) {
    const p = this.pts.get(e.pointerId); if (!p) return;
    this.pts.delete(e.pointerId); clearTimeout(this.long); this.pinch = null;
    if (cancel || p.moved || G.overlayOpen) return;
    const ev = { clientX: p.sx, clientY: p.sy, shiftKey: this.interact, ctrlKey: false, altKey: false };
    this.interact = false; this.syncBtns();
    G.mouse.x = p.sx; G.mouse.y = p.sy; const w = G.screenToWorld(p.sx, p.sy); G.mouse.wx = w.x; G.mouse.wy = w.y;
    Input.hover();
    Input.leftClick(ev);
  },

  buildButtons() {
    const bar = document.createElement('div'); bar.id = 'tbar';
    const defs = [
      ['int', 'Interactuar', () => { this.interact = !this.interact; G.toast(this.interact ? 'Toca un objeto, cuerpo o puerta para interactuar' : 'Interacción cancelada'); this.syncBtns(); }],
      ['prone', 'Tumbarse', () => Input.toggleProne()],
      ['cover', 'Cubrirse', () => Input.toggleCover()],
      ['cancel', 'Cancelar', () => { this.interact = false; this.syncBtns(); Input.keydown({ key: 'Escape', preventDefault() {}, ctrlKey: false, repeat: false }); Input.rightClick(); }],
      ['all', 'Todos', () => { G.units.forEach(u => { u.selected = u.alive; }); HUD.dirty = true; }],
      ['cone', 'Conos', () => Input.keydown({ key: 'Tab', preventDefault() {}, ctrlKey: false, repeat: false })],
      ['rl', '⟲', () => Render.setRotation(Render.rot - 1)],
      ['rr', '⟳', () => Render.setRotation(Render.rot + 1)],
      ['map', 'Mapa', () => HUD.toggleTactical()],
      ['pause', 'Pausa', () => { G.paused = !G.paused; G.toast(G.paused ? 'En pausa' : 'Reanudado'); }],
      ['full', 'Pantalla', () => { const d = document.documentElement; (document.fullscreenElement ? document.exitFullscreen() : d.requestFullscreen && d.requestFullscreen()); }]
    ];
    for (const [id, label, fn] of defs) {
      const b = document.createElement('button'); b.id = 't-' + id; b.textContent = label;
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Sfx.ensure(); fn(); });
      bar.appendChild(b);
    }
    document.body.appendChild(bar);
    const hint = document.createElement('div'); hint.id = 'rotate-hint'; hint.textContent = 'Gira el celular en horizontal para jugar';
    document.body.appendChild(hint);
  },
  syncBtns() { const b = document.getElementById('t-int'); if (b) b.classList.toggle('on', this.interact); },

  // Pasar objetos entre comandos: mantén pulsado un objeto de la mochila y suéltalo sobre el retrato de otro comando
  dragItems() {
    const inv = document.getElementById('inv');
    let st = null, ghost = null;
    inv.addEventListener('pointerdown', e => {
      const el = e.target.closest('.item'); if (!el || e.pointerType === 'mouse') return;
      const idx = [...inv.querySelectorAll('.item')].indexOf(el);
      st = { el, idx, x: e.clientX, y: e.clientY, t: setTimeout(() => {
        if (!st) return; st.drag = true; navigator.vibrate && navigator.vibrate(20);
        ghost = el.cloneNode(true); ghost.style.cssText = 'position:fixed;z-index:30;pointer-events:none;opacity:.85;transform:scale(1.3)'; document.body.appendChild(ghost);
        G.toast('Suelta el objeto sobre el retrato de otro comando');
      }, 380) };
    });
    window.addEventListener('pointermove', e => { if (st && st.drag && ghost) { ghost.style.left = e.clientX - 20 + 'px'; ghost.style.top = e.clientY - 20 + 'px'; e.preventDefault(); } });
    const end = e => {
      if (!st) return; clearTimeout(st.t);
      if (st.drag) {
        const t = document.elementFromPoint(e.clientX, e.clientY), sq = t && t.closest('.sq');
        const to = sq && G.units[+sq.id.replace('sq', '')], pr = G.primary(), from = pr ? pr.idx : -1;
        if (to && from >= 0) HUD.transfer(from, st.idx, to);
      }
      if (ghost) ghost.remove(); ghost = null; st = null;
    };
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  }
};
