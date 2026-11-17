'use strict';
// Controles clásicos de Commandos 2 (según la guía técnica).

const KEY_ACTIONS = { q: 'punch', a: 'knife', s: 'pistol', d: 'sniper', g: 'grenade', f: 'medkit', c: 'cigs', v: 'wine', e: 'cutters', w: 'examine', t: 'talk' };

const Input = {
  G: null,

  bind(G) {
    this.G = G;
    const cv = G.canvas;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('mouseleave', () => { G.mouse.inside = false; });
    cv.addEventListener('mouseenter', () => { G.mouse.inside = true; });
    cv.addEventListener('mousemove', e => {
      const m = G.mouse; m.x = e.clientX; m.y = e.clientY; m.inside = true;
      const w = G.screenToWorld(m.x, m.y); m.wx = w.x; m.wy = w.y;
      if (G.drag) { G.drag.cx = m.x; G.drag.cy = m.y; if (Math.hypot(m.x - G.drag.sx, m.y - G.drag.sy) > 6) G.drag.active = true; }
      if (G.panDrag) Render.panPixels(-e.movementX, -e.movementY);
      this.hover();
    });
    cv.addEventListener('mousedown', e => {
      Sfx.ensure();
      if (G.overlayOpen) return;
      if (e.button === 0 && e.altKey) { Render.setRotation(Render.rot + 1); e.preventDefault(); return; }
      if (e.button === 2) G.drag = { sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY, active: false };
      else if (e.button === 1) { G.panDrag = true; e.preventDefault(); }
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 1) G.panDrag = null;
      if (G.overlayOpen || e.target !== cv && !G.drag) return;
      if (e.button === 0 && e.target === cv && !e.altKey) this.leftClick(e);
      if (e.button === 2 && G.drag) {
        const d = G.drag; G.drag = null;
        if (d.active) this.boxSelect(d, e.ctrlKey || e.shiftKey); else this.rightClick();
      }
    });
    cv.addEventListener('wheel', e => { e.preventDefault(); Render.zoomAt(e.deltaY < 0 ? 1.1 : 0.9, e.clientX, e.clientY); }, { passive: false });
    const miniJump = e => { const r = G.mini.getBoundingClientRect(); G.centerOn((e.clientX - r.left) / r.width * Level.W, (e.clientY - r.top) / r.height * Level.H); };
    G.mini.addEventListener('mousedown', e => { miniJump(e); this.miniDrag = true; });
    G.mini.addEventListener('mousemove', e => { if (this.miniDrag) miniJump(e); });
    window.addEventListener('mouseup', () => { this.miniDrag = false; });
    window.addEventListener('keydown', e => this.keydown(e));
    window.addEventListener('keyup', e => { G.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { G.keys = {}; });
  },

  camera(dt) {
    const G = this.G, sp = 900;
    let dx = 0, dy = 0;
    if (G.keys['arrowup']) dy -= 1; if (G.keys['arrowdown']) dy += 1;
    const m = G.mouse;
    if (m.inside && !G.drag && !G.overlayOpen && !G.tactical) {
      const e = 6, w = G.canvas.clientWidth, h = G.canvas.clientHeight;
      if (m.x < e) dx -= 1; if (m.x > w - e) dx += 1;
      if (m.y < e) dy -= 1; if (m.y > h - e) dy += 1;
    }
    if (dx || dy) Render.panPixels(dx * sp * dt, dy * sp * dt);
  },

  keydown(e) {
    const G = this.G, k = e.key.toLowerCase();
    Sfx.ensure();
    const block = ['f1', 'f5', 'f8', 'f9', 'f10', 'f11', 'f12', 'tab', ' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'];
    if (block.includes(k) || (e.ctrlKey && (k === 's' || k === 'l'))) e.preventDefault();
    G.keys[k] = true;
    if (e.repeat) return;
    if (G.overlayOpen) { if (k === 'enter' || k === 'escape') { const b = document.querySelector('#overlay button'); if (b) b.click(); } return; }
    if (e.ctrlKey && k === 's') return G.save();
    if (e.ctrlKey && k === 'l') return G.load();
    if (G.tactical && (k === 'escape' || k === 'f9')) return HUD.toggleTactical();
    const p = G.primary();
    if (k >= '0' && k <= '9' && !e.altKey) {
      if (k === '0') { G.units.forEach(u => { u.selected = false; }); HUD.dirty = true; return; }
      const u = G.units[+k - 1]; if (!u || !u.alive) return;
      if (e.ctrlKey) { u.selected = !u.selected; HUD.dirty = true; } else this.selectOnly(u, true);
      return;
    }
    switch (k) {
      case ' ': this.toggleProne(); break;
      case 'x': this.toggleCover(); break;
      case 'u': this.wearUniform(true); break;
      case 'j': this.wearUniform(false); break;
      case 'h': G.toast('Este comando no tiene gancho de escalada', true); break;
      case 'tab': case 'enter': {
        const en = G.hover.enemy;
        if (en) en.inspect = !en.inspect;
        else { G.coneMode = G.coneMode === 'all' ? 'hover' : 'all'; G.toast(G.coneMode === 'all' ? 'Mostrando todos los conos de visión' : 'Conos: solo el enemigo bajo el cursor (Tab lo fija)'); }
        break;
      }
      case 'escape': G.units.forEach(u => { u.action = null; }); this.hover(); HUD.dirty = true; break;
      case 'pause': case 'p': G.paused = !G.paused; break;
      case 'f1': HUD.showIntro(); break;
      case 'f8': G.hudHidden = !G.hudHidden; document.body.classList.toggle('nohud', G.hudHidden); G.resize(); break;
      case 'f9': HUD.toggleTactical(); break;
      case 'f10': G.hl.items = !G.hl.items; break;
      case 'f11': G.hl.enemies = !G.hl.enemies; break;
      case 'f12': this.screenshot(); break;
      case 'arrowleft': Render.setRotation(Render.rot - 1); break;
      case 'arrowright': Render.setRotation(Render.rot + 1); break;
      case '+': Render.zoomAt(1.15, G.canvas.clientWidth / 2, G.canvas.clientHeight / 2); break;
      case '-': Render.zoomAt(0.87, G.canvas.clientWidth / 2, G.canvas.clientHeight / 2); break;
      case 'm': G.toast(Sfx.toggleMute() ? 'Sonido desactivado' : 'Sonido activado'); break;
      default:
        if (KEY_ACTIONS[k] && p) this.equip(KEY_ACTIONS[k]);
    }
  },

  screenshot() {
    const a = document.createElement('a');
    a.href = this.G.canvas.toDataURL('image/png'); a.download = 'commandos3-' + Date.now() + '.png'; a.click();
  },

  // ---------- selección ----------
  selectOnly(u, center) {
    const G = this.G;
    if (!u || !u.alive) return;
    G.units.forEach(x => { x.selected = false; }); u.selected = true;
    if (center) G.centerOn(u.x, u.y);
    Sfx.play('select'); HUD.dirty = true; this.hover();
  },

  boxSelect(d, add) {
    const G = this.G;
    const x0 = Math.min(d.sx, d.cx), x1 = Math.max(d.sx, d.cx), y0 = Math.min(d.sy, d.cy), y1 = Math.max(d.sy, d.cy);
    const hit = G.units.filter(u => { if (!u.alive) return false; const p = Render.toScreen(u.x, 0.5, u.y); return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1; });
    if (!hit.length && !add) return;
    if (!add) G.units.forEach(u => { u.selected = false; });
    hit.forEach(u => { u.selected = true; });
    Sfx.play('select'); HUD.dirty = true;
  },

  // ---------- equipar objetos y habilidades ----------
  has(u, id) { return ABILITIES[id] ? u.def.abilities.includes(id) : Inv.count(u.inv, id) > 0; },

  equip(id) {
    const G = this.G, p = G.primary(); if (!p || p.dying) return;
    if (!this.has(p, id)) { G.toast(`${p.def.name} no tiene ${(actionDef(id) || {}).name || id}`, true); return; }
    const d = actionDef(id);
    if (d.target === 'self') { Inv.take(p.inv, id); p.heal(p.maxHp * 0.25); G.toast('Salud recuperada'); HUD.dirty = true; return; }
    if (d.target === 'wear') { this.wearUniform(!p.disguised); return; }
    if (!d.target) { G.toast(d.desc); return; }
    if (id === 'talk' && !p.disguised) { G.toast('El Espía necesita llevar puesto el uniforme (U)', true); return; }
    p.action = p.action === id ? null : id;
    Sfx.play('select'); HUD.dirty = true; this.hover();
  },

  wearUniform(on) {
    const G = this.G, p = G.primary(); if (!p) return;
    if (on && !Inv.find(p.inv, 'uniform')) { G.toast(`${p.def.name} no tiene uniforme`, true); return; }
    p.disguised = on; p.run = false; p.scrutiny = 0;
    G.toast(on ? (p.type === 'spy' ? 'Espía de uniforme: solo los oficiales pueden descubrirle' : 'Uniforme puesto: no te quedes en la zona cercana de ningún guardia') : 'Uniforme quitado');
    HUD.dirty = true;
  },

  toggleProne() {
    const sel = this.G.selected(); if (!sel.length) return;
    const v = !sel[0].prone;
    for (const u of sel) { if (u.carry) continue; u.prone = v; if (v) u.run = false; }
    HUD.dirty = true;
  },

  toggleCover() {
    const G = this.G, p = G.primary(); if (!p) return;
    if (!p.weapon()) { G.toast('Necesitas un arma de fuego con munición', true); return; }
    p.cover = !p.cover; p.path = []; p.task = null;
    G.toast(p.cover ? 'Cubriéndose: disparará al primer enemigo que aparezca' : 'Deja de cubrirse');
    HUD.dirty = true;
  },

  // ---------- ratón ----------
  hover() {
    const G = this.G, m = G.mouse;
    const h = { unit: G.unitAt(m.x, m.y), enemy: G.enemyAt(m.x, m.y), valid: false };
    const p = G.primary();
    if (p && p.action) h.valid = !!this.resolveTarget(p, p.action, m.x, m.y, { x: m.wx, y: m.wy });
    G.hover = h;
  },

  bodyAt(sx, sy, states) {
    let best = null, bd = 30 * Render.zoom;
    for (const e of this.G.enemies) {
      if (!states.includes(e.state) || e.hidden || e.carried || Render.closedAt(e.x, e.y)) continue;
      const s = Render.toScreen(e.x, 0.1 + (e.R.elev || 0), e.y), d = Math.hypot(s.x - sx, s.y - sy);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },

  lootAt(sx, sy, w) {
    const G = this.G;
    const body = this.bodyAt(sx, sy, ['dead', 'down', 'tied']); if (body) return body;
    let best = null, bd = 1.2;
    for (const l of Level.loot) { const d = dist(w.x, w.y, l.x, l.y); if (d < bd) { bd = d; best = l; } }
    return best;
  },

  // Devuelve la tarea para la acción equipada sobre lo que hay bajo el cursor (o null)
  resolveTarget(u, id, sx, sy, w) {
    const G = this.G, d = actionDef(id); if (!d) return null;
    switch (d.target) {
      case 'enemy': { const e = G.enemyAt(sx, sy); return e && e.alive ? { kind: id, target: e } : null; }
      case 'down': { const e = this.bodyAt(sx, sy, ['down']); return e ? { kind: id, target: e } : null; }
      case 'ally': { const a = G.unitAt(sx, sy); return a && a.alive ? { kind: id, target: a } : null; }
      case 'loot': { const l = this.lootAt(sx, sy, w); return l ? { kind: 'examine', target: l } : null; }
      case 'fence': {
        for (const [ox, oy] of [[0, 0], [0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]]) {
          const tx = Math.floor(w.x + ox), ty = Math.floor(w.y + oy);
          if (Level.at(tx, ty) === 'f') { const f = Level.nearestFree(tx, ty, 2, { x: u.x, y: u.y }); return { kind: id, tx, ty, x: f ? f.x + 0.5 : tx + 0.5, y: f ? f.y + 0.5 : ty + 0.5 }; }
        }
        return null;
      }
      case 'point': {
        let x = w.x, y = w.y;
        if (Level.solid(Math.floor(x), Math.floor(y))) { const f = Level.nearestFree(Math.floor(x), Math.floor(y), 3, { x: u.x, y: u.y }); if (!f) return null; x = f.x + 0.5; y = f.y + 0.5; }
        return { kind: id, x, y };
      }
    }
    return null;
  },

  leftClick(e) {
    const G = this.G, sx = e.clientX, sy = e.clientY, w = G.screenToWorld(sx, sy);
    const p = G.primary();
    const clickedUnit = G.unitAt(sx, sy);
    // seleccionar comando (salvo que la acción equipada sea sobre un aliado)
    if (clickedUnit && !(p && p.action && actionDef(p.action).target === 'ally')) {
      if (e.ctrlKey) { clickedUnit.selected = !clickedUnit.selected; HUD.dirty = true; } else this.selectOnly(clickedUnit);
      return;
    }
    if (!p || p.dying) return;
    // Shift + clic: interactuar (cargar/soltar cuerpos, registrar)
    if (e.shiftKey) {
      if (p.carry) { p.task = { kind: 'drop', x: w.x, y: w.y }; p.path = findPath(p.x, p.y, w.x, w.y) || []; p.task.x = p.path.length ? p.path[p.path.length - 1].x : p.x; p.task.y = p.path.length ? p.path[p.path.length - 1].y : p.y; return; }
      const body = this.bodyAt(sx, sy, ['dead', 'down', 'tied']);
      if (body) {
        if (!p.def.carry) { G.toast(`${p.def.name} no puede cargar cuerpos`, true); return; }
        p.task = { kind: 'pickup', target: body }; p.path = []; return;
      }
      const l = this.lootAt(sx, sy, w);
      if (l) { p.task = { kind: 'examine', target: l }; p.path = []; return; }
      G.toast('No hay nada con lo que interactuar ahí', true); return;
    }
    // acción equipada
    if (p.action) {
      const t = this.resolveTarget(p, p.action, sx, sy, w);
      if (t) {
        const d = actionDef(p.action);
        p.task = t; p.path = []; p.cover = false; p.repathT = 0; p.busyT = 0;
        Sfx.play('order');
        if (d.target === 'point' && !ITEMS[p.action].stack) p.action = null; // la bomba se usa una vez
        if (ITEMS[p.action] && ITEMS[p.action].stack && Inv.count(p.inv, p.action) <= 1) p.action = null;
        HUD.dirty = true;
        return;
      }
      if (['point'].includes(actionDef(p.action).target)) { G.toast('No se puede usar ahí', true); return; }
    }
    this.move(e, w);
  },

  move(e, w) {
    const G = this.G, sel = G.selected();
    if (!sel.length) return;
    const now = performance.now(), run = now - G.lastClick < 350;
    G.lastClick = now;
    let ok = false;
    sel.forEach((s, i) => {
      let tx = w.x, ty = w.y;
      if (i > 0) { const a = i * 2.4, r = 0.55 + 0.25 * i; tx += Math.cos(a) * r; ty += Math.sin(a) * r * 0.8; }
      if (Level.solid(Math.floor(tx), Math.floor(ty)) && i > 0) { tx = w.x; ty = w.y; }
      const path = findPath(s.x, s.y, tx, ty);
      if (!path) return;
      s.order(path, run); ok = true;
    });
    if (!ok) { G.toast('No se puede llegar a ese punto', true); return; }
    if (run && sel.some(u => u.prone || u.disguised)) G.toast('Tumbado o de uniforme no se puede correr');
    Sfx.play('order');
    G.fx.push({ k: 'ring', x: w.x, y: w.y, r: 0.7, t: 0.4, dur: 0.4 });
  },

  rightClick() {
    const G = this.G, sel = G.selected();
    if (sel.some(u => u.action)) { sel.forEach(u => { u.action = null; }); this.hover(); HUD.dirty = true; return; }
    sel.forEach(u => { if (u.cover) u.cover = false; else if (u.task || u.path.length) { u.task = null; u.path = []; } });
    HUD.dirty = true;
  }
};

// Selección en pantalla (cada soldado se proyecta y se compara con el puntero)
G.screenToWorld = (sx, sy) => Render.pickGround(sx, sy) || { x: -50, y: -50 };
G.unitAt = function (sx, sy) {
  let best = null, bd = 26 * Render.zoom;
  for (const u of this.units) {
    if (!u.alive) continue;
    for (const hgt of u.prone || u.dying ? [0.1] : [0.2, 0.5, 0.8]) { const p = Render.toScreen(u.x, hgt, u.y), d = Math.hypot(p.x - sx, p.y - sy); if (d < bd) { bd = d; best = u; } }
  }
  return best;
};
G.enemyAt = function (sx, sy) {
  let best = null, bd = 26 * Render.zoom;
  for (const e of this.enemies) {
    if (e.hidden || e.carried || Render.closedAt(e.x, e.y)) continue;
    const lying = !e.alive, el = e.R.elev || 0;
    for (const hgt of lying ? [0.1] : [0.2, 0.5, 0.8]) { const p = Render.toScreen(e.x, hgt + el, e.y), d = Math.hypot(p.x - sx, p.y - sy); if (d < bd) { bd = d; best = e; } }
  }
  return best;
};
