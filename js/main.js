'use strict';
// Bucle principal, entrada, HUD, guardado y reglas de misión.

const G = {
  canvas: null, ctx: null, mini: null,
  cam: { x: 0, y: 0, z: 1 },
  units: [], enemies: [], fx: [], bomb: null,
  time: 0, paused: false, over: null, overlayOpen: true,
  stats: { alarms: 0, kills: 0, ko: 0 },
  keys: {}, mouse: { x: 0, y: 0, wx: 0, wy: 0, inside: false },
  drag: null, lastClick: 0, hudT: 0, toastT: 0, panDrag: null,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.mini = document.getElementById('mini');
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

  resize() {
    const dpr = 1;
    this.canvas.width = window.innerWidth * dpr; this.canvas.height = window.innerHeight * dpr;
  },

  reset() {
    Level.build();
    Render.bakeGround();
    const types = ['beret', 'sniper', 'spy', 'sapper'];
    this.units = types.map((t, i) => new Commando(t, Level.startPositions[i][0], Level.startPositions[i][1], i));
    this.units[0].selected = true;
    this.enemies = ENEMY_DEFS.map((d, i) => new Enemy(i, d));
    this.fx = []; this.bomb = null; this.time = 0; this.over = null; this.paused = false;
    this.stats = { alarms: 0, kills: 0, ko: 0 };
    this.cam.z = 1;
    this.cam.x = 0; this.cam.y = Level.H * TILE - (this.canvas.height - 96) - 10;
    this.clampCam();
    this.buildHud();
  },

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
    this.fx.push({ k: 'boom', x, y, r: r + 1, t: 0.6, dur: 0.6 });
    for (const e of this.enemies) if (e.state !== 'dead' && !e.hidden && !e.carried && dist(e.x, e.y, x, y) <= r) { e.kill(); this.stats.kills++; }
    for (const u of this.units) if (u.alive && dist(u.x, u.y, x, y) <= r) u.damage(3, this, u.def.name + ' ha muerto en una explosión.');
    this.noise(x, y, opt && opt.noise ? opt.noise : 12);
  },

  defeat(msg) { if (!this.over) { this.over = 'lose'; this.showEnd(false, msg); } },

  checkWin() {
    if (this.over || !Level.depot.destroyed) return;
    if (this.units.every(u => u.alive && Level.inExit(u.x, u.y))) { this.over = 'win'; this.showEnd(true); }
  },

  // ---------- actualización ----------
  frame(dt) {
    this.cameraControl(dt);
    if (!this.paused && !this.over && !this.overlayOpen) this.update(dt);
    for (const f of this.fx) f.t -= dt;
    this.fx = this.fx.filter(f => f.t > 0);
    Render.draw(this);
    Render.drawMinimap(this);
    this.hudT -= dt;
    if (this.hudT <= 0) { this.updateHud(); this.hudT = 0.15; }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) document.getElementById('toast').classList.remove('show'); }
  },

  update(dt) {
    this.time += dt;
    for (const u of this.units) u.update(dt, this);
    for (const e of this.enemies) e.update(dt, this);
    if (this.bomb) {
      this.bomb.t -= dt;
      if (this.bomb.t <= 0) {
        const b = this.bomb; this.bomb = null;
        Level.destroyDepot(); Render.bakeGround();
        this.explode(b.x, b.y, 6, { noise: 40 });
        this.toast('¡El depósito ha volado por los aires! Reuníos en la extracción');
      }
    }
    this.checkWin();
  },

  cameraControl(dt) {
    const cam = this.cam, sp = 700 / cam.z;
    let dx = 0, dy = 0;
    const k = this.keys;
    if (k['a'] || k['arrowleft']) dx -= 1; if (k['d'] || k['arrowright']) dx += 1;
    if (k['w'] || k['arrowup']) dy -= 1; if (k['s'] || k['arrowdown']) dy += 1;
    const m = this.mouse;
    if (m.inside && !this.drag && !this.overlayOpen) {
      const edge = 6, bottom = this.canvas.height - 96;
      if (m.x < edge) dx -= 1; if (m.x > this.canvas.width - edge) dx += 1;
      if (m.y < edge) dy -= 1; if (m.y > this.canvas.height - edge && m.y <= this.canvas.height) dy += 1;
    }
    cam.x += dx * sp * dt; cam.y += dy * sp * dt;
    this.clampCam();
  },

  clampCam() {
    const cam = this.cam, vw = this.canvas.width / cam.z, vh = (this.canvas.height - 96) / cam.z;
    const mw = Level.W * TILE, mh = Level.H * TILE;
    cam.x = vw >= mw ? (mw - vw) / 2 : clamp(cam.x, 0, mw - vw);
    cam.y = vh >= mh ? (mh - vh) / 2 : clamp(cam.y, -10, mh - vh);
  },

  centerOn(x, y) {
    this.cam.x = x * TILE - this.canvas.width / this.cam.z / 2;
    this.cam.y = y * TILE - (this.canvas.height - 96) / this.cam.z / 2;
    this.clampCam();
  },

  // ---------- entrada ----------
  screenToWorld(sx, sy) { return { x: (sx / this.cam.z + this.cam.x) / TILE, y: (sy / this.cam.z + this.cam.y) / TILE }; },

  unitAt(wx, wy) {
    let best = null, bd = 0.75;
    for (const u of this.units) { if (!u.alive) continue; const d = dist(wx, wy - 0.45, u.x, u.y); if (d < bd) { bd = d; best = u; } }
    return best;
  },
  enemyAt(wx, wy) {
    let best = null, bd = 0.9;
    for (const e of this.enemies) {
      if (e.hidden || e.carried) continue;
      const dy = (e.state === 'dead' || e.state === 'down') ? 0 : 0.45;
      const d = dist(wx, wy - dy, e.x, e.y); if (d < bd) { bd = d; best = e; }
    }
    return best;
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
      if (this.panDrag) { this.cam.x -= (e.movementX) / this.cam.z; this.cam.y -= (e.movementY) / this.cam.z; this.clampCam(); }
    });
    cv.addEventListener('mousedown', e => {
      if (this.overlayOpen) return;
      if (e.button === 0) this.drag = { sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY, active: false, shift: e.shiftKey };
      else if (e.button === 1) { this.panDrag = true; e.preventDefault(); }
      else if (e.button === 2) this.rightClick(e);
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 1) this.panDrag = null;
      if (e.button !== 0 || !this.drag) return;
      const d = this.drag; this.drag = null;
      if (this.overlayOpen) return;
      if (d.active) this.boxSelect(d, e.shiftKey);
      else this.leftClick(e);
    });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const before = this.screenToWorld(e.clientX, e.clientY);
      this.cam.z = clamp(this.cam.z * (e.deltaY < 0 ? 1.1 : 0.9), 0.6, 1.6);
      const after = this.screenToWorld(e.clientX, e.clientY);
      this.cam.x += (before.x - after.x) * TILE; this.cam.y += (before.y - after.y) * TILE;
      this.clampCam();
    }, { passive: false });
    this.mini.addEventListener('mousedown', e => {
      const r = this.mini.getBoundingClientRect();
      this.centerOn((e.clientX - r.left) / r.width * Level.W, (e.clientY - r.top) / r.height * Level.H);
    });
    window.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (['f1', 'f2', 'f3', 'f4', 'f5', 'f9', 'tab', ' '].includes(k)) e.preventDefault();
      this.keys[k] = true;
      if (e.repeat) return;
      if (this.overlayOpen) { if (k === 'enter') this.closeOverlay(); return; }
      if (k === ' ') this.paused = !this.paused;
      else if (k === 'escape') { for (const u of this.units) u.action = null; }
      else if (k === 'tab') this.cycleUnit();
      else if (k === 'f1' || k === 'f2' || k === 'f3' || k === 'f4') this.selectOnly(this.units[+k[1] - 1]);
      else if (k === 'f5') this.save();
      else if (k === 'f9') this.load();
      else if (k === 'h') this.showIntro();
      else if (k === 'x') { for (const u of this.selected()) u.order([]); }
      else if (k >= '1' && k <= '5') this.pickAction(+k - 1);
    });
    window.addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
  },

  selectOnly(u) { if (!u || !u.alive) return; for (const x of this.units) x.selected = false; u.selected = true; this.updateHud(); },
  cycleUnit() {
    const alive = this.units.filter(u => u.alive); if (!alive.length) return;
    const cur = alive.findIndex(u => u.selected);
    this.selectOnly(alive[(cur + 1) % alive.length]);
    const p = this.primary(); if (p) this.centerOn(p.x, p.y);
  },

  boxSelect(d, add) {
    const x0 = Math.min(d.sx, d.cx), x1 = Math.max(d.sx, d.cx), y0 = Math.min(d.sy, d.cy), y1 = Math.max(d.sy, d.cy);
    let any = false; const hit = [];
    for (const u of this.units) {
      if (!u.alive) continue;
      const sx = (u.x * TILE - this.cam.x) * this.cam.z, sy = ((u.y * TILE - 16) - this.cam.y) * this.cam.z;
      if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) hit.push(u);
    }
    if (!add) for (const u of this.units) u.selected = false;
    for (const u of hit) { u.selected = true; any = true; }
    this.updateHud();
  },

  leftClick(e) {
    const w = this.screenToWorld(e.clientX, e.clientY);
    const u = this.unitAt(w.x, w.y);
    if (u) {
      if (e.shiftKey) u.selected = !u.selected;
      else this.selectOnly(u);
      this.updateHud(); return;
    }
    const sel = this.selected();
    if (!sel.length) return;
    const now = performance.now();
    const run = e.shiftKey || now - this.lastClick < 350;
    this.lastClick = now;
    // formación alrededor del destino
    sel.forEach((s, i) => {
      let tx = w.x, ty = w.y;
      if (i > 0) { const a = i * 2.4, r = 0.55 + 0.25 * i; tx += Math.cos(a) * r; ty += Math.sin(a) * r * 0.8; }
      if (Level.solid(Math.floor(tx), Math.floor(ty)) && i > 0) { tx = w.x; ty = w.y; }
      const p = findPath(s.x, s.y, tx, ty);
      if (!p) { this.toast('No se puede llegar a ese punto', true); return; }
      s.order(p, run);
    });
    this.fx.push({ k: 'ring', x: w.x, y: w.y, r: 0.7, t: 0.4, dur: 0.4 });
  },

  rightClick(e) {
    const w = this.screenToWorld(e.clientX, e.clientY);
    const sel = this.selected();
    if (!sel.length) return;
    if (!sel.some(u => u.action)) { this.toast('Elige una acción primero (teclas 1-3 o botones inferiores)'); return; }
    let did = false;
    for (const u of sel) {
      if (!u.action) continue;
      if (this.giveTask(u, w)) did = true;
    }
    if (!did) this.toast('Objetivo no válido para esa acción', true);
  },

  giveTask(u, w) {
    const a = u.action;
    const en = this.enemyAt(w.x, w.y);
    const base = { kind: a };
    switch (a) {
      case 'knife': if (!en || en.state === 'dead') return false; u.task = { ...base, target: en }; break;
      case 'syringe': if (!en || en.state === 'dead' || en.state === 'down') return false; u.task = { ...base, target: en }; break;
      case 'shoot': if (!en || en.state === 'dead') return false; u.task = { ...base, target: en }; break;
      case 'carry': {
        if (u.carry) { u.task = { kind: 'carry', x: w.x, y: w.y }; break; }
        if (!en || (en.state !== 'dead' && en.state !== 'down')) return false;
        u.task = { kind: 'carry', target: en }; break;
      }
      case 'lure': case 'grenade': u.task = { kind: a, x: w.x, y: w.y }; break;
      case 'bomb': {
        const d = Level.depot;
        if (dist(w.x, w.y + 0.55, d.x, d.y) > 2.2 && dist(w.x, w.y, d.x, d.y) > 2.2) return false;
        u.task = { kind: 'bomb' }; break;
      }
      case 'disguise': return false;
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
      this.toast(p.disguised ? 'Espía disfrazado de soldado' : 'Espía sin disfraz');
      this.updateHud(); return;
    }
    for (const u of this.selected()) u.action = u.def.actions.find(x => x.id === act.id) ? act.id : u.action;
    this.updateHud();
  },

  // ---------- HUD ----------
  buildHud() {
    const box = document.getElementById('portraits');
    box.innerHTML = '';
    this.units.forEach((u, i) => {
      const c = document.createElement('div');
      c.className = 'card'; c.id = 'card' + i;
      c.addEventListener('click', e => {
        if (e.shiftKey) u.selected = !u.selected; else this.selectOnly(u);
        this.updateHud();
      });
      c.addEventListener('dblclick', () => this.centerOn(u.x, u.y));
      box.appendChild(c);
    });
    document.getElementById('actions').innerHTML = '';
  },

  updateHud() {
    this.units.forEach((u, i) => {
      const c = document.getElementById('card' + i); if (!c) return;
      c.className = 'card' + (u.selected ? ' sel' : '') + (u.alive ? '' : ' dead');
      let st = '';
      if (u.type === 'sniper') st = `Balas: ${u.ammo}`;
      if (u.type === 'sapper') st = `Granadas: ${u.grenades}`;
      if (u.type === 'spy') st = u.disguised ? 'Disfrazado' : 'Sin disfraz';
      if (u.carry) st = 'Carga un cuerpo';
      let pips = ''; for (let k = 0; k < u.def.hp; k++) pips += `<div class="pip${k < u.hp ? ' on' : ''}"></div>`;
      c.innerHTML = `<div class="sw" style="background:${u.def.color}"></div><span class="fk">F${i + 1}</span><div class="nm">${u.def.name}</div><div class="pips">${pips}</div><div class="st">${st || '&nbsp;'}</div>`;
    });
    const p = this.primary(), ab = document.getElementById('actions'), hint = document.getElementById('hint');
    ab.innerHTML = '';
    if (p) {
      p.def.actions.forEach((a, i) => {
        const b = document.createElement('div');
        const on = a.instant ? p.disguised : p.action === a.id;
        b.className = 'act' + (on ? ' on' : '');
        b.innerHTML = `${a.name}<small>[${i + 1}]</small>`;
        b.title = a.desc;
        b.addEventListener('click', () => this.pickAction(i));
        ab.appendChild(b);
      });
      const cur = p.def.actions.find(a => a.id === p.action);
      hint.textContent = cur ? cur.desc : 'Clic izq.: mover (doble clic = correr) · Clic der.: usar la acción elegida';
    } else hint.textContent = '';

    // objetivos
    const o = document.getElementById('objectives');
    const done1 = Level.depot.destroyed;
    const allIn = this.units.every(u => u.alive && Level.inExit(u.x, u.y));
    const t = Math.floor(this.time), mm = String(Math.floor(t / 60)).padStart(2, '0'), ss = String(t % 60).padStart(2, '0');
    o.innerHTML = `<h3>MISIÓN: OPERACIÓN DEPÓSITO</h3>
      <div class="${done1 ? 'done' : ''}">${done1 ? '✔' : '◻'} Destruir el depósito de combustible</div>
      <div class="${done1 && allIn ? 'done' : ''}">${done1 && allIn ? '✔' : '◻'} Reunir a los 4 comandos en la extracción</div>
      ${this.bomb ? `<div class="bomb">⏱ Detonación en ${Math.ceil(this.bomb.t)} s</div>` : ''}
      <div class="meta">Tiempo ${mm}:${ss} · Alarmas ${this.stats.alarms} · H: ayuda · F5/F9: guardar/cargar</div>`;
  },

  toast(msg, bad) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
    this.toastT = 2.8;
  },

  showIntro() {
    this.overlayOpen = true;
    const ov = document.getElementById('overlay');
    ov.className = 'show';
    ov.innerHTML = `<div class="panel">
      <h1>COMMANDOS 3</h1><h2>HOMBRES DE VALOR · OPERACIÓN DEPÓSITO</h2>
      <p>Infiltra a tu escuadra en la base enemiga, haz volar el depósito de combustible con la carga del Zapador y reúne a los cuatro comandos en la zona de extracción (arriba a la izquierda). Si cae un comando, la misión fracasa.</p>
      <h4>CONTROLES</h4>
      <table>
        <tr><td>Clic izquierdo</td><td>Seleccionar comando / mover (doble clic o Shift: correr)</td></tr>
        <tr><td>Arrastrar</td><td>Selección múltiple (Shift: añadir)</td></tr>
        <tr><td>Clic derecho</td><td>Ejecutar la acción elegida sobre el objetivo</td></tr>
        <tr><td>1 · 2 · 3</td><td>Elegir acción del comando (o pulsa los botones)</td></tr>
        <tr><td>Esc · X</td><td>Cancelar acción · detener movimiento</td></tr>
        <tr><td>Espacio</td><td>Pausa (se pueden dar órdenes en pausa)</td></tr>
        <tr><td>F1–F4 · Tab</td><td>Seleccionar comando / siguiente</td></tr>
        <tr><td>WASD · flechas · bordes</td><td>Mover cámara (también clic central y minimapa)</td></tr>
        <tr><td>Rueda</td><td>Zoom</td></tr>
        <tr><td>F5 · F9</td><td>Guardado / carga rápida</td></tr>
      </table>
      <h4>COMANDOS</h4>
      <table>
        <tr><td>Boina Verde</td><td>Cuchillo silencioso; carga y esconde cuerpos en arbustos.</td></tr>
        <tr><td>Francotirador</td><td>Elimina a larga distancia (ruidoso, 6 balas).</td></tr>
        <tr><td>Espía</td><td>Disfraz, anestesia silenciosa y señuelo sonoro.</td></tr>
        <tr><td>Zapador</td><td>Carga de tiempo y granadas (¡fuego amigo!).</td></tr>
      </table>
      <h4>CONSEJOS</h4>
      <p>Los conos amarillos muestran lo que ve cada guardia; las paredes los bloquean. Los arbustos esconden. Un guardia que encuentra un cuerpo da la alarma, así que escóndelo.</p>
      <button id="startBtn">${this.time > 0 ? 'Continuar' : 'Comenzar misión'}</button></div>`;
    document.getElementById('startBtn').onclick = () => this.closeOverlay();
  },

  closeOverlay() { this.overlayOpen = false; document.getElementById('overlay').className = ''; },

  showEnd(win, msg) {
    this.overlayOpen = true;
    const t = Math.floor(this.time), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
    const ov = document.getElementById('overlay'); ov.className = 'show';
    ov.innerHTML = `<div class="panel ${win ? 'win' : 'lose'}">
      <h1>${win ? 'MISIÓN CUMPLIDA' : 'MISIÓN FRACASADA'}</h1>
      <h2>${win ? 'EL DEPÓSITO HA SIDO DESTRUIDO' : (msg || '').toUpperCase()}</h2>
      <p>Tiempo: ${mm}:${ss}<br>Alarmas: ${this.stats.alarms}<br>Enemigos eliminados: ${this.stats.kills}<br>Enemigos dormidos: ${this.stats.ko}</p>
      <button id="againBtn">Reintentar</button>${win ? '' : ' <button id="loadBtn">Cargar partida (F9)</button>'}</div>`;
    document.getElementById('againBtn').onclick = () => { this.reset(); this.closeOverlay(); };
    const lb = document.getElementById('loadBtn'); if (lb) lb.onclick = () => { this.over = null; this.closeOverlay(); this.load(); };
  },

  // ---------- guardado ----------
  save() {
    if (this.over) return;
    const snap = {
      time: this.time, stats: this.stats, bomb: this.bomb, destroyed: Level.depot.destroyed,
      units: this.units.map(u => ({ x: u.x, y: u.y, hp: u.hp, alive: u.alive, ammo: u.ammo, gr: u.grenades, dis: u.disguised, face: u.face, carry: u.carry ? u.carry.id : null })),
      enemies: this.enemies.map(e => ({ x: e.x, y: e.y, face: e.face, state: e.state, wp: e.wp, downT: e.downT, hidden: e.hidden, carried: e.carried, disc: e.discovered, ls: e.lastSeen }))
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
    if (snap.destroyed) { Level.destroyDepot(); Render.bakeGround(); }
    snap.units.forEach((s, i) => {
      const u = this.units[i];
      Object.assign(u, { x: s.x, y: s.y, hp: s.hp, alive: s.alive, ammo: s.ammo, grenades: s.gr, disguised: s.dis, face: s.face });
      u.selected = !!sel[i] && s.alive;
    });
    snap.enemies.forEach((s, i) => {
      const e = this.enemies[i];
      Object.assign(e, { x: s.x, y: s.y, face: s.face, state: s.state, wp: s.wp, downT: s.downT, hidden: s.hidden, carried: s.carried, discovered: s.disc });
      e.path = null; e.waitT = 0;
      if (s.state === 'alert' || s.state === 'investigate') { e.state = 'investigate'; e.target = s.ls || { x: s.x, y: s.y }; e.lookT = 3; e.arrived = false; }
    });
    snap.units.forEach((s, i) => { if (s.carry !== null && s.carry !== undefined) { this.units[i].carry = this.enemies[s.carry]; this.enemies[s.carry].carried = true; } });
    if (!this.units.some(u => u.selected)) { const f = this.units.find(u => u.alive); if (f) f.selected = true; }
    this.updateHud(); this.toast('Partida cargada');
  }
};

window.addEventListener('load', () => G.init());
