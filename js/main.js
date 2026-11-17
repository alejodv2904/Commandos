'use strict';
// Bucle principal, entrada, interfaz, guardado y reglas de misión.

const HUD_H = 150;

const G = {
  canvas: null, ui: null, mini: null,
  units: [], enemies: [], fx: [], bomb: null,
  time: 0, paused: false, over: null, overlayOpen: true, shake: 0,
  coneMode: 'all', hover: {},
  stats: { alarms: 0, kills: 0, ko: 0 },
  keys: {}, mouse: { x: 0, y: 0, wx: 0, wy: 0, inside: false },
  drag: null, lastClick: 0, hudT: 0, toastT: 0, panDrag: null, hudKey: null,

  init() {
    this.canvas = document.getElementById('game');
    this.ui = document.getElementById('ui');
    this.mini = document.getElementById('mini');
    Render.init(this.canvas, this.ui);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
    this.reset();
    this.showIntro();
    let last = performance.now();
    const loop = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },

  resize() { Render.resize(window.innerWidth, Math.max(200, window.innerHeight - HUD_H)); },

  reset() {
    Level.build();
    FX.reset();
    Render.bakeLevel();
    const types = ['beret', 'sniper', 'spy', 'sapper'];
    this.units = types.map((t, i) => new Commando(t, Level.startPositions[i][0], Level.startPositions[i][1], i));
    this.units.forEach(u => { u.face = -Math.PI / 4; });
    this.units[0].selected = true;
    this.enemies = ENEMY_DEFS.map((d, i) => new Enemy(i, d));
    this.fx = []; this.bomb = null; this.time = 0; this.over = null; this.paused = false; this.shake = 0;
    this.runId = (this.runId || 0) + 1;
    this.stats = { alarms: 0, kills: 0, ko: 0 };
    // bengala verde en la extracción
    FX.emitters.push({ rate: 5, fn: () => FX.smoke(6.6 + Math.random() * 0.1, 3.2, 0.1, false, '120,200,110') });
    Render.zoom = 1.35;
    this.centerOn(9, 35);
    this.hudKey = null;
    this.buildHud();
  },

  camCenter() { return { x: Render.target.x, y: Render.target.z }; },

  // ---------- reglas ----------
  primary() { return this.units.find(u => u.selected && u.alive) || null; },
  selected() { return this.units.filter(u => u.selected && u.alive); },

  noise(x, y, r) {
    for (const e of this.enemies) {
      if (e.state !== 'patrol' && e.state !== 'investigate') continue;
      if (e.hidden || e.carried) continue;
      if (dist(e.x, e.y, x, y) <= r) e.startInvestigate(x, y, 3.5);
    }
  },

  raiseAlert(e, u) {
    e.state = 'alert'; e.lastSeen = { x: u.x, y: u.y }; e.lostT = 0; e.path = null; e.repathT = 0;
    this.stats.alarms++;
    this.toast('¡Alarma! Un guardia te ha descubierto', true);
    Sfx.play('alarm');
    for (const o of this.enemies) {
      if (o === e || o.state === 'dead' || o.state === 'down' || o.state === 'alert') continue;
      if (dist(o.x, o.y, e.x, e.y) <= 12) o.startInvestigate(u.x, u.y, 4);
    }
  },

  discoverBody(finder, b) {
    b.discovered = true;
    this.toast('Un guardia ha encontrado un cuerpo', true);
    finder.startInvestigate(b.x, b.y, 5);
    for (const o of this.enemies) if (o !== finder && dist(o.x, o.y, b.x, b.y) <= 14) o.startInvestigate(b.x, b.y, 3.5);
  },

  explode(x, y, r, opt) {
    FX.explosion(x, y, r); Sfx.play('boom', x, y);
    Render.decal('scorch', x, y, Math.min(2.5, r * 0.7));
    this.shake = Math.max(this.shake, Math.min(1.2, r / 4));
    for (const e of this.enemies) if (e.state !== 'dead' && !e.hidden && !e.carried && dist(e.x, e.y, x, y) <= r) { e.kill('boom'); this.stats.kills++; }
    for (const u of this.units) if (u.alive && dist(u.x, u.y, x, y) <= r) u.damage(3, this, u.def.name + ' ha muerto en una explosión.');
    this.noise(x, y, opt && opt.noise ? opt.noise : 12);
  },

  defeat(msg) {
    if (this.over) return;
    this.over = 'lose'; Sfx.play('lose');
    const run = this.runId; setTimeout(() => { if (this.runId === run) this.showEnd(false, msg); }, 1200);
  },

  checkWin() {
    if (this.over || !Level.depot.destroyed) return;
    if (this.units.every(u => u.alive && Level.inExit(u.x, u.y))) {
      this.over = 'win'; Sfx.play('win');
      const run = this.runId; setTimeout(() => { if (this.runId === run) this.showEnd(true); }, 600);
    }
  },

  // ---------- bucle ----------
  frame(dt) {
    this.cameraControl(dt);
    const running = !this.paused && !this.overlayOpen && this.over !== 'win';
    if (running && !this.over) this.update(dt);
    if (running) FX.update(dt);
    for (const f of this.fx) f.t -= dt;
    this.fx = this.fx.filter(f => f.t > 0);
    this.shake = Math.max(0, this.shake - dt * 1.5);
    Render.draw(this, running ? dt : 0);
    Render.drawMinimap(this);
    this.hudT -= dt;
    if (this.hudT <= 0) { this.updateHud(); this.hudT = 0.12; }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) document.getElementById('toast').classList.remove('show'); }
  },

  update(dt) {
    this.time += dt;
    for (const u of this.units) u.update(dt, this);
    for (const e of this.enemies) e.update(dt, this);
    if (this.bomb) {
      const before = Math.ceil(this.bomb.t);
      this.bomb.t -= dt;
      if (Math.ceil(this.bomb.t) !== before) Sfx.play('tick');
      if (this.bomb.t <= 0) {
        const b = this.bomb; this.bomb = null;
        Level.destroyDepot(); Render.refreshDepot();
        this.explode(b.x, b.y, 6, { noise: 40 });
        FX.explosion(b.x - 1, b.y + 0.5, 4); FX.explosion(b.x + 1, b.y - 0.5, 4);
        FX.emitters.push({ rate: 14, fn: () => FX.smoke(b.x + (Math.random() - 0.5) * 2.5, b.y + (Math.random() - 0.5) * 2, 0.3, true, 25 + Math.random() * 25) });
        FX.emitters.push({ rate: 22, fn: () => FX.fire(b.x + (Math.random() - 0.5) * 2.4, b.y + (Math.random() - 0.5) * 1.8, 0.1) });
        this.toast('¡El depósito ha volado por los aires! Reuníos en la extracción');
      }
    }
    this.checkWin();
  },

  cameraControl(dt) {
    const sp = 900;
    let dx = 0, dy = 0;
    const k = this.keys;
    if (k['a'] || k['arrowleft']) dx -= 1; if (k['d'] || k['arrowright']) dx += 1;
    if (k['w'] || k['arrowup']) dy -= 1; if (k['s'] || k['arrowdown']) dy += 1;
    const m = this.mouse;
    if (m.inside && !this.drag && !this.overlayOpen) {
      const e = 6, w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      if (m.x < e) dx -= 1; if (m.x > w - e) dx += 1;
      if (m.y < e) dy -= 1; if (m.y > h - e) dy += 1;
    }
    if (dx || dy) Render.panPixels(dx * sp * dt, dy * sp * dt);
  },

  centerOn(x, y) { Render.centerOn(x, y); },

  // ---------- entrada ----------
  screenToWorld(sx, sy) { return Render.pickGround(sx, sy) || { x: -50, y: -50 }; },

  // Selección en pantalla: se proyecta cada soldado y se compara con el puntero
  unitAt(sx, sy) {
    let best = null, bd = 26 * Render.zoom;
    for (const u of this.units) {
      if (!u.alive) continue;
      for (const hgt of [0.2, 0.5, 0.8]) { const p = Render.toScreen(u.x, hgt * (u.crouch ? 0.75 : 1), u.y), d = Math.hypot(p.x - sx, p.y - sy); if (d < bd) { bd = d; best = u; } }
    }
    return best;
  },
  enemyAt(sx, sy) {
    let best = null, bd = 26 * Render.zoom;
    for (const e of this.enemies) {
      if (e.hidden || e.carried || Render.closedAt(e.x, e.y)) continue;
      const lying = e.state === 'dead' || e.state === 'down';
      for (const hgt of lying ? [0.1] : [0.2, 0.5, 0.8]) { const p = Render.toScreen(e.x, hgt, e.y), d = Math.hypot(p.x - sx, p.y - sy); if (d < bd) { bd = d; best = e; } }
    }
    return best;
  },
  enemyNear(wx, wy) {
    let best = null, bd = 0.9;
    for (const e of this.enemies) { if (e.hidden || e.carried) continue; const d = dist(wx, wy, e.x, e.y); if (d < bd) { bd = d; best = e; } }
    return best;
  },

  updateHover() {
    const m = this.mouse, h = { unit: this.unitAt(m.x, m.y), enemy: this.enemyAt(m.x, m.y), valid: false };
    const p = this.primary();
    if (p && p.action) {
      const e = h.enemy;
      switch (p.action) {
        case 'knife': case 'shoot': h.valid = !!e && e.state !== 'dead'; break;
        case 'syringe': h.valid = !!e && e.state !== 'dead' && e.state !== 'down'; break;
        case 'carry': h.valid = p.carry ? Level.isBush(m.wx, m.wy) : !!e && (e.state === 'dead' || e.state === 'down'); break;
        case 'bomb': h.valid = dist(m.wx, m.wy, Level.depot.x, Level.depot.y) < 2.6 && !Level.depot.destroyed; break;
        default: h.valid = true;
      }
    }
    this.hover = h;
  },

  bindInput() {
    const cv = this.canvas;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    cv.addEventListener('mouseenter', () => { this.mouse.inside = true; });
    cv.addEventListener('mousemove', e => {
      const m = this.mouse; m.x = e.clientX; m.y = e.clientY; m.inside = true;
      const w = this.screenToWorld(m.x, m.y); m.wx = w.x; m.wy = w.y;
      if (this.drag) { this.drag.cx = m.x; this.drag.cy = m.y; if (Math.hypot(m.x - this.drag.sx, m.y - this.drag.sy) > 6) this.drag.active = true; }
      if (this.panDrag) Render.panPixels(-e.movementX, -e.movementY);
      this.updateHover();
    });
    cv.addEventListener('mousedown', e => {
      Sfx.ensure();
      if (this.overlayOpen) return;
      if (e.button === 0) this.drag = { sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY, active: false };
      else if (e.button === 1) { this.panDrag = true; e.preventDefault(); }
      else if (e.button === 2) this.rightClick(e);
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 1) this.panDrag = null;
      if (e.button !== 0 || !this.drag) return;
      const d = this.drag; this.drag = null;
      if (this.overlayOpen) return;
      if (d.active) this.boxSelect(d, e.shiftKey); else this.leftClick(e);
    });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      Render.zoomAt(e.deltaY < 0 ? 1.1 : 0.9, e.clientX, e.clientY);
    }, { passive: false });
    const miniJump = e => {
      const r = this.mini.getBoundingClientRect();
      this.centerOn((e.clientX - r.left) / r.width * Level.W, (e.clientY - r.top) / r.height * Level.H);
    };
    this.mini.addEventListener('mousedown', e => { miniJump(e); this.miniDrag = true; });
    this.mini.addEventListener('mousemove', e => { if (this.miniDrag) miniJump(e); });
    window.addEventListener('mouseup', () => { this.miniDrag = false; });
    window.addEventListener('keydown', e => {
      Sfx.ensure();
      const k = e.key.toLowerCase();
      if (['f1', 'f2', 'f3', 'f4', 'f5', 'f9', 'tab', ' '].includes(k)) e.preventDefault();
      this.keys[k] = true;
      if (e.repeat) return;
      if (this.overlayOpen) { if (k === 'enter') { const b = document.querySelector('#overlay button'); if (b) b.click(); } return; }
      if (k === ' ') this.paused = !this.paused;
      else if (k === 'escape') { for (const u of this.units) u.action = null; this.updateHover(); }
      else if (k === 'tab') this.cycleUnit();
      else if (['f1', 'f2', 'f3', 'f4'].includes(k)) { this.selectOnly(this.units[+k[1] - 1]); }
      else if (k === 'f5') this.save();
      else if (k === 'f9') this.load();
      else if (k === 'h') this.showIntro();
      else if (k === 'c') this.toggleCrouch();
      else if (k === 'v') { this.coneMode = this.coneMode === 'all' ? 'inspect' : 'all'; this.toast(this.coneMode === 'all' ? 'Conos de visión: todos' : 'Conos de visión: solo enemigos señalados (clic izquierdo sobre un enemigo)'); }
      else if (k === 'm') this.toast(Sfx.toggleMute() ? 'Sonido desactivado' : 'Sonido activado');
      else if (k === 'x') { for (const u of this.selected()) u.order([]); }
      else if (k >= '1' && k <= '5') this.pickAction(+k - 1);
    });
    window.addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
  },

  selectOnly(u) {
    if (!u || !u.alive) return;
    for (const x of this.units) x.selected = false;
    u.selected = true; Sfx.play('select'); this.updateHud(); this.updateHover();
  },
  cycleUnit() {
    const alive = this.units.filter(u => u.alive); if (!alive.length) return;
    const cur = alive.findIndex(u => u.selected);
    this.selectOnly(alive[(cur + 1) % alive.length]);
    const p = this.primary(); if (p) this.centerOn(p.x, p.y);
  },
  toggleCrouch() {
    const sel = this.selected(); if (!sel.length) return;
    const v = !sel[0].crouch;
    for (const u of sel) { if (u.carry) continue; u.crouch = v; if (v) u.run = false; }
    this.updateHud();
  },

  boxSelect(d, add) {
    const x0 = Math.min(d.sx, d.cx), x1 = Math.max(d.sx, d.cx), y0 = Math.min(d.sy, d.cy), y1 = Math.max(d.sy, d.cy);
    const hit = [];
    for (const u of this.units) {
      if (!u.alive) continue;
      const p = Render.toScreen(u.x, 0.5, u.y);
      if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) hit.push(u);
    }
    if (!hit.length && !add) return;
    if (!add) for (const u of this.units) u.selected = false;
    for (const u of hit) u.selected = true;
    Sfx.play('select'); this.updateHud();
  },

  leftClick(e) {
    const w = this.screenToWorld(e.clientX, e.clientY);
    const u = this.unitAt(e.clientX, e.clientY);
    if (u) { if (e.shiftKey) { u.selected = !u.selected; this.updateHud(); } else this.selectOnly(u); return; }
    const sel = this.selected();
    const en = this.enemyAt(e.clientX, e.clientY);
    if (en && en.state !== 'dead' && en.state !== 'down' && (!sel.length || this.coneMode === 'inspect')) { en.inspect = !en.inspect; return; }
    if (!sel.length) return;
    const now = performance.now();
    const run = e.shiftKey || now - this.lastClick < 350;
    this.lastClick = now;
    let ok = false;
    sel.forEach((s, i) => {
      let tx = w.x, ty = w.y;
      if (i > 0) { const a = i * 2.4, r = 0.55 + 0.25 * i; tx += Math.cos(a) * r; ty += Math.sin(a) * r * 0.8; }
      if (Level.solid(Math.floor(tx), Math.floor(ty)) && i > 0) { tx = w.x; ty = w.y; }
      const p = findPath(s.x, s.y, tx, ty);
      if (!p) return;
      s.order(p, run); ok = true;
    });
    if (!ok) { this.toast('No se puede llegar a ese punto', true); return; }
    Sfx.play('order');
    this.fx.push({ k: 'ring', x: w.x, y: w.y, r: 0.7, t: 0.4, dur: 0.4 });
  },

  rightClick(e) {
    const w = this.screenToWorld(e.clientX, e.clientY);
    const sel = this.selected();
    if (!sel.length) return;
    if (!sel.some(u => u.action)) { this.toast('Elige primero una acción de la mochila (teclas 1-3)'); return; }
    let did = false;
    const en = this.enemyAt(e.clientX, e.clientY);
    for (const u of sel) if (u.action && this.giveTask(u, w, en)) did = true;
    if (!did) this.toast('Objetivo no válido para esa acción', true); else Sfx.play('order');
  },

  giveTask(u, w, en) {
    const a = u.action;
    if (en === undefined) en = this.enemyNear(w.x, w.y);
    switch (a) {
      case 'knife': if (!en || en.state === 'dead') return false; u.task = { kind: a, target: en }; break;
      case 'syringe': if (!en || en.state === 'dead' || en.state === 'down') return false; u.task = { kind: a, target: en }; break;
      case 'shoot': if (!en || en.state === 'dead') return false; u.task = { kind: a, target: en }; break;
      case 'carry':
        if (u.carry) { u.task = { kind: 'carry', x: w.x, y: w.y }; break; }
        if (!en || (en.state !== 'dead' && en.state !== 'down')) return false;
        u.task = { kind: 'carry', target: en }; break;
      case 'lure': case 'grenade': u.task = { kind: a, x: w.x, y: w.y }; break;
      case 'bomb': {
        const d = Level.depot;
        if (dist(w.x, w.y, d.x, d.y) > 2.6) return false;
        u.task = { kind: 'bomb' }; break;
      }
      default: return false;
    }
    u.path = []; u.run = false; u.repathT = 0; u.busyT = 0;
    return true;
  },

  pickAction(i) {
    const p = this.primary(); if (!p) return;
    const act = p.def.actions[i]; if (!act) return;
    if (act.instant) {
      for (const u of this.selected()) if (u.type === 'spy') { u.disguised = !u.disguised; u.task = null; }
      this.toast(p.disguised ? 'Espía disfrazado de oficial' : 'Espía sin disfraz');
      Sfx.play('select'); this.updateHud(); return;
    }
    const same = p.action === act.id;
    for (const u of this.selected()) if (u.def.actions.some(x => x.id === act.id)) u.action = same ? null : act.id;
    Sfx.play('select'); this.updateHud(); this.updateHover();
  },

  // ---------- interfaz ----------
  buildHud() {
    const box = document.getElementById('squad');
    box.innerHTML = '';
    this.units.forEach((u, i) => {
      const c = document.createElement('div');
      c.className = 'sq'; c.id = 'sq' + i;
      c.innerHTML = `<canvas width="64" height="70"></canvas><div class="sq-hp"><div class="fill"></div></div><span class="fk">F${i + 1}</span>`;
      Sprites.portrait(c.querySelector('canvas').getContext('2d'), u.type, 64, 70);
      c.addEventListener('click', e => { if (e.shiftKey) { u.selected = !u.selected; this.updateHud(); } else this.selectOnly(u); });
      c.addEventListener('dblclick', () => this.centerOn(u.x, u.y));
      c.title = u.def.name;
      box.appendChild(c);
    });
    this.hudKey = null;
  },

  buildMainPanel(p) {
    const pc = document.getElementById('portrait'), x = pc.getContext('2d');
    x.clearRect(0, 0, pc.width, pc.height);
    const slots = document.getElementById('slots');
    slots.innerHTML = '';
    if (!p) { document.getElementById('unit-name').textContent = '—'; return; }
    Sprites.portrait(x, p.disguised ? 'spyDis' : p.type, pc.width, pc.height);
    document.getElementById('unit-name').textContent = p.def.name.toUpperCase();
    const list = p.def.actions.map((a, i) => ({ id: a.id, name: a.name, key: String(i + 1), desc: a.desc, i }));
    list.push({ id: 'crouch', name: 'Agacharse', key: 'C', desc: 'Agachado: más lento, pero solo te ven en la zona oscura (cercana) del cono.' });
    for (const a of list) {
      const s = document.createElement('div');
      s.className = 'slot'; s.dataset.id = a.id; s.title = `${a.name} — ${a.desc}`;
      const c = makeCanvas(46, 46); Sprites.icon(c.getContext('2d'), a.id, 46);
      s.appendChild(c);
      s.insertAdjacentHTML('beforeend', `<span class="key">${a.key}</span><span class="badge"></span>`);
      s.addEventListener('click', () => { if (a.id === 'crouch') this.toggleCrouch(); else this.pickAction(a.i); });
      s.addEventListener('mouseenter', () => { this.hintHover = true; document.getElementById('hint').innerHTML = `<b>${a.name}</b> · ${a.desc}`; });
      s.addEventListener('mouseleave', () => { this.hintHover = false; });
      slots.appendChild(s);
    }
  },

  updateHud() {
    const p = this.primary();
    const key = p ? p.idx + (p.disguised ? 'd' : '') : 'none';
    if (key !== this.hudKey) { this.hudKey = key; this.buildMainPanel(p); }
    if (p) {
      document.querySelectorAll('#slots .slot').forEach(s => {
        const id = s.dataset.id;
        const on = id === 'crouch' ? p.crouch : id === 'disguise' ? p.disguised : p.action === id;
        s.classList.toggle('on', on);
        const badge = s.querySelector('.badge');
        badge.textContent = id === 'shoot' ? p.ammo : id === 'grenade' ? p.grenades : '';
        s.classList.toggle('empty', (id === 'shoot' && p.ammo <= 0) || (id === 'grenade' && p.grenades <= 0));
      });
      document.getElementById('unit-hp').innerHTML = Array.from({ length: p.def.hp }, (_, i) => `<i class="${i < p.hp ? 'on' : ''}"></i>`).join('');
      let st = p.crouch ? 'Agachado' : p.run && p.moving ? 'Corriendo' : 'De pie';
      if (p.carry) st = 'Cargando un cuerpo';
      if (p.disguised) st += ' · Disfrazado';
      if (p.inBush) st += ' · Oculto';
      document.getElementById('unit-state').textContent = st;
      const cur = p.def.actions.find(a => a.id === p.action);
      if (!this.hintHover) document.getElementById('hint').innerHTML = cur ? `<b>${cur.name}</b> · ${cur.desc}` : 'Clic izq.: mover (doble clic = correr) · Clic der.: usar la acción elegida';
    } else {
      document.getElementById('unit-hp').innerHTML = ''; document.getElementById('unit-state').textContent = '';
    }
    this.units.forEach((u, i) => {
      const c = document.getElementById('sq' + i); if (!c) return;
      c.className = 'sq' + (u.selected ? ' sel' : '') + (u.alive ? '' : ' dead');
      c.querySelector('.fill').style.width = (u.hp / u.def.hp * 100) + '%';
    });

    const o = document.getElementById('objectives');
    const done1 = Level.depot.destroyed;
    const allIn = this.units.every(u => u.alive && Level.inExit(u.x, u.y));
    const t = Math.floor(this.time), mm = String(Math.floor(t / 60)).padStart(2, '0'), ss = String(t % 60).padStart(2, '0');
    o.innerHTML = `<h3>OBJETIVOS</h3>
      <div class="${done1 ? 'done' : ''}">${done1 ? '☑' : '☐'} Volar el depósito de combustible</div>
      <div class="${done1 && allIn ? 'done' : ''}">${done1 && allIn ? '☑' : '☐'} Reunir a los 4 comandos en la extracción</div>
      ${this.bomb ? `<div class="bomb">⏱ Detonación en ${Math.ceil(this.bomb.t)} s</div>` : ''}
      <div class="meta">${mm}:${ss} · Alarmas: ${this.stats.alarms}${this.paused ? ' · EN PAUSA' : ''}</div>`;
  },

  toast(msg, bad) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
    this.toastT = 3;
  },

  showIntro() {
    this.overlayOpen = true;
    const ov = document.getElementById('overlay');
    ov.className = 'show';
    ov.innerHTML = `<div class="dossier">
      <div class="stamp">ALTO SECRETO</div>
      <div class="hdr">MANDO DE OPERACIONES COMBINADAS · EXPEDIENTE Nº 1943-07</div>
      <h1>COMMANDOS 3</h1><h2>Hombres de Valor — Operación Depósito</h2>
      <p>El enemigo abastece a sus divisiones blindadas desde un depósito de combustible oculto tras el río. Su escuadra deberá infiltrarse en la base, colocar la carga del Zapador en los tanques y reunirse junto al jeep, en el punto de extracción marcado con la bengala verde.</p>
      <p><b>Si cae un solo comando, la operación habrá fracasado.</b></p>
      <div class="cols">
      <div><h4>CONTROLES</h4><table>
        <tr><td>Clic izquierdo</td><td>Seleccionar / mover (doble clic: correr)</td></tr>
        <tr><td>Arrastrar</td><td>Seleccionar varios (Shift: añadir)</td></tr>
        <tr><td>Clic derecho</td><td>Usar la acción elegida</td></tr>
        <tr><td>1 · 2 · 3</td><td>Elegir acción de la mochila</td></tr>
        <tr><td>C</td><td>Agacharse / levantarse</td></tr>
        <tr><td>Espacio</td><td>Pausa táctica</td></tr>
        <tr><td>F1–F4 · Tab</td><td>Elegir comando</td></tr>
        <tr><td>WASD · bordes · rueda</td><td>Cámara y zoom</td></tr>
        <tr><td>V</td><td>Conos: todos / solo señalados</td></tr>
        <tr><td>F5 · F9 · M</td><td>Guardar · cargar · sonido</td></tr>
      </table></div>
      <div><h4>LA ESCUADRA</h4><table>
        <tr><td>Boina Verde</td><td>Cuchillo silencioso. Carga cuerpos y los esconde en los arbustos.</td></tr>
        <tr><td>Francotirador</td><td>Rifle de precisión de largo alcance. Ruidoso; 6 balas.</td></tr>
        <tr><td>Espía</td><td>Disfraz de oficial, anestesia y señuelo. Los oficiales enemigos lo reconocen.</td></tr>
        <tr><td>Zapador</td><td>Carga de tiempo y granadas.</td></tr>
      </table>
      <h4>INFORME DE INTELIGENCIA</h4>
      <p class="small">Los conos verdes muestran la vista de cada centinela. En la zona clara solo ven a quien va de pie; en la oscura, también a los agachados. Paredes, árboles y vehículos bloquean la vista; los arbustos ocultan. Un cuerpo a la vista da la alarma.</p></div>
      </div>
      <button>${this.time > 0 ? 'Continuar' : 'Comenzar operación'}</button></div>`;
    ov.querySelector('button').onclick = () => { Sfx.ensure(); this.closeOverlay(); };
  },

  closeOverlay() { this.overlayOpen = false; document.getElementById('overlay').className = ''; },

  showEnd(win, msg) {
    this.overlayOpen = true;
    const t = Math.floor(this.time), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
    const ov = document.getElementById('overlay'); ov.className = 'show';
    ov.innerHTML = `<div class="dossier ${win ? 'win' : 'lose'}">
      <div class="stamp">${win ? 'CUMPLIDA' : 'FRACASO'}</div>
      <div class="hdr">INFORME FINAL DE LA OPERACIÓN</div>
      <h1>${win ? 'MISIÓN CUMPLIDA' : 'MISIÓN FRACASADA'}</h1>
      <h2>${win ? 'El depósito de combustible ha sido destruido' : (msg || '')}</h2>
      <table class="stats"><tr><td>Tiempo</td><td>${mm}:${ss}</td></tr><tr><td>Alarmas</td><td>${this.stats.alarms}</td></tr>
      <tr><td>Enemigos eliminados</td><td>${this.stats.kills}</td></tr><tr><td>Enemigos dormidos</td><td>${this.stats.ko}</td></tr></table>
      <button id="againBtn">Reintentar</button>${win ? '' : ' <button id="loadBtn">Cargar partida (F9)</button>'}</div>`;
    document.getElementById('againBtn').onclick = () => { this.reset(); this.closeOverlay(); };
    const lb = document.getElementById('loadBtn'); if (lb) lb.onclick = () => { this.over = null; this.closeOverlay(); this.load(); };
  },

  // ---------- guardado ----------
  save() {
    if (this.over) return;
    const snap = {
      time: this.time, stats: this.stats, bomb: this.bomb, destroyed: Level.depot.destroyed,
      units: this.units.map(u => ({ x: u.x, y: u.y, hp: u.hp, alive: u.alive, ammo: u.ammo, gr: u.grenades, dis: u.disguised, cr: u.crouch, face: u.face, carry: u.carry ? u.carry.id : null })),
      enemies: this.enemies.map(e => ({ x: e.x, y: e.y, face: e.face, state: e.state, cause: e.cause, wp: e.wp, downT: e.downT, hidden: e.hidden, carried: e.carried, disc: e.discovered, ls: e.lastSeen }))
    };
    try { localStorage.setItem('commandos3-save', JSON.stringify(snap)); this.toast('Partida guardada'); }
    catch (err) { this.toast('No se pudo guardar', true); }
  },

  load() {
    let snap;
    try { snap = JSON.parse(localStorage.getItem('commandos3-save')); } catch (err) { snap = null; }
    if (!snap) { this.toast('No hay partida guardada', true); return; }
    const sel = this.units.map(u => u.selected);
    this.reset();
    this.time = snap.time; this.stats = snap.stats; this.bomb = snap.bomb;
    if (snap.destroyed) {
      Level.destroyDepot(); Render.refreshDepot();
      const b = Level.depot;
      FX.emitters.push({ rate: 14, fn: () => FX.smoke(b.x + (Math.random() - 0.5) * 2.5, b.y + (Math.random() - 0.5) * 2, 0.3, true, 25 + Math.random() * 25) });
    }
    snap.units.forEach((s, i) => {
      const u = this.units[i];
      Object.assign(u, { x: s.x, y: s.y, hp: s.hp, alive: s.alive, ammo: s.ammo, grenades: s.gr, disguised: s.dis, crouch: !!s.cr, face: s.face });
      u.selected = !!sel[i] && s.alive;
    });
    snap.enemies.forEach((s, i) => {
      const e = this.enemies[i];
      Object.assign(e, { x: s.x, y: s.y, face: s.face, state: s.state, cause: s.cause, wp: s.wp, downT: s.downT, hidden: s.hidden, carried: s.carried, discovered: s.disc });
      e.path = null; e.waitT = 0;
      if (s.state === 'alert' || s.state === 'investigate') { e.state = 'investigate'; e.target = s.ls || { x: s.x, y: s.y }; e.lookT = 3; e.arrived = false; }
    });
    snap.units.forEach((s, i) => { if (s.carry !== null && s.carry !== undefined) { this.units[i].carry = this.enemies[s.carry]; this.enemies[s.carry].carried = true; } });
    if (!this.units.some(u => u.selected)) { const f = this.units.find(u => u.alive); if (f) f.selected = true; }
    const p = this.primary(); if (p) this.centerOn(p.x, p.y);
    this.hudKey = null; this.updateHud(); this.toast('Partida cargada');
  }
};

window.G = G;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => G.init());
else G.init();
