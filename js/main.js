'use strict';
// Núcleo: estado de la partida, reglas, bucle principal y guardado.

const HUD_H = 150;

const G = {
  canvas: null, ui: null, mini: null,
  units: [], enemies: [], fx: [], baits: [], decoys: [], bombs: [], vehicles: [], spots: [],
  mission: null, night: false, power: true, chips: 0, flags: {}, objState: [],
  time: 0, paused: false, over: null, overlayOpen: true, shake: 0,
  coneMode: 'hover', hover: {}, hl: { items: false, enemies: false }, hudHidden: false, tactical: false,
  stats: { alarms: 0, kills: 0, ko: 0, downs: 0 },
  keys: {}, mouse: { x: 0, y: 0, wx: 0, wy: 0, inside: false },
  drag: null, lastClick: 0, hudT: 0, toastT: 0, panDrag: null, runId: 0,

  async init() {
    this.canvas = document.getElementById('game');
    this.ui = document.getElementById('ui');
    this.mini = document.getElementById('mini');
    const ov = document.getElementById('overlay');
    ov.className = 'show';
    ov.innerHTML = '<div class="loading"><div class="lt">COMMANDOS 3</div><div class="lbar"><div id="lfill"></div></div><div class="ls">Preparando el teatro de operaciones…</div></div>';
    await Assets.load(p => { const f = document.getElementById('lfill'); if (f) f.style.width = Math.round(p * 100) + '%'; });
    Chars.init(Assets.soldier);
    Render.init(this.canvas, this.ui);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    Input.bind(this);
    Touch.init();
    Progress.load();
    this.reset('classic');
    HUD.showMenu();
    let last = performance.now();
    const loop = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },

  resize() {
    const s = document.body.classList.contains('touch') ? clamp(window.innerWidth / 1150, 0.55, 1) : 1, h = Math.round(HUD_H * s);
    document.documentElement.style.setProperty('--hs', s); document.documentElement.style.setProperty('--hud-h', h + 'px');
    Render.resize(window.innerWidth, Math.max(200, window.innerHeight - (this.hudHidden ? 0 : h)));
  },

  // Prepara una misión de la campaña
  reset(id) {
    const M = this.mission = MISSIONS_BY_ID[id || (this.mission && this.mission.id) || 'classic'];
    Level.build(M);
    FX.reset();
    this.night = !!WEATHER[M.weather].night; this.power = true;
    Render.bakeLevel(M);
    this.units = M.squad.map((q, i) => new Commando(q.type, q.x, q.y, i, q.inv));
    this.units[0].selected = true;
    const kit = KITS[M.kits || 'ww2'];
    this.enemies = M.enemies.map((d, i) => { const e = new Enemy(i, d); e.kit = kit[e.rank] || e.R.kind; return e; });
    this.vehicles = Level.vehicles.map(v => new Vehicle(v));
    this.spots = Level.spots.map(sp => Object.assign({ ang: (sp.a0 + sp.a1) / 2, dir: 1, cd: 0 }, sp));
    for (const t of Level.towers) t.base = (Level.interacts.find(i => i.climb) || { x: t.x, y: t.y + 2 });
    this.fx = []; this.baits = []; this.decoys = []; this.bombs = []; this.cutFences = [];
    this.time = 0; this.over = null; this.paused = false; this.shake = 0; this.chips = 0; this.flags = {};
    this.objState = M.objectives.map(() => false); this.secState = (M.secondary || []).map(() => false);
    this.runId++;
    this.fog = M.fog || 1;
    this.stats = { alarms: 0, kills: 0, ko: 0, downs: 0, bodies: 0, eshots: 0 };
    const e = Level.exit;
    FX.emitters.push({ rate: 5, fn: () => FX.smoke((e.x0 + e.x1 + 1) / 2 + (Math.random() - 0.5) * 0.2, (e.y0 + e.y1 + 1) / 2, 0.1, false, '120,200,110') });
    Render.zoom = 1.35; Render.setRotation(0);
    this.centerOn(this.units[0].x + 4, this.units[0].y - 3);
    HUD.build();
  },

  // ¿Está iluminado este punto? (farolas y focos encendidos)
  isLit(x, y) {
    if (!this.power) return false;
    for (const l of Level.lights) if (dist(l.x, l.y, x, y) < l.r) return true;
    for (const sp of this.spots) if (dist(sp.cx, sp.cy, x, y) < sp.r) return true;
    return false;
  },

  // Focos giratorios: barren un arco; quien entra en el haz con línea de visión da la alarma
  updateSpots(dt) {
    for (const sp of this.spots) {
      if (!this.power) { sp.cx = -99; sp.cy = -99; continue; }
      sp.ang += sp.dir * sp.speed * dt;
      if (sp.ang > sp.a1) { sp.ang = sp.a1; sp.dir = -1; } if (sp.ang < sp.a0) { sp.ang = sp.a0; sp.dir = 1; }
      sp.cx = sp.x + Math.cos(sp.ang) * sp.dist; sp.cy = sp.y + Math.sin(sp.ang) * sp.dist;
      sp.cd = Math.max(0, sp.cd - dt);
      if (sp.cd > 0) continue;
      for (const u of this.units) {
        if (!u.alive || u.dying || u.inVehicle || dist(u.x, u.y, sp.cx, sp.cy) > sp.r || u.def.civilian) continue;
        if (!Level.los(sp.x, sp.y, u.x, u.y, true)) continue;
        sp.cd = 6; this.stats.alarms++;
        this.toast('¡Un foco te ha iluminado! Alarma', true); Sfx.play('alarm');
        let near = null, nd = 1e9;
        for (const o of this.enemies) if (o.alive && !o.R.unarmed) { const d = dist(o.x, o.y, u.x, u.y); if (d < nd) { nd = d; near = o; } }
        if (near) this.raiseAlert(near, u);
        for (const o of this.enemies) if (o.alive && o.state !== 'alert' && dist(o.x, o.y, u.x, u.y) < 16) o.startInvestigate(u.x, u.y, 6, 'alarm');
        break;
      }
    }
  },

  smoke(x, y) {
    const c = { x, y, r: 2.6, t: 15 }; Level.smokes.push(c);
    const em = { rate: 16, fn: () => { if (c.t > 0) FX.smoke(x + (Math.random() - 0.5) * 3.4, y + (Math.random() - 0.5) * 3.4, 0.2, true, 165 + Math.random() * 30); } };
    FX.emitters.push(em);
    Sfx.play('thud', x, y);
  },

  // Interacciones con el escenario (Shift + clic)
  interact(u, it) {
    if (it.climb) {
      const t = Level.towers[0]; u.onTower = t; u.elev = t.elev; u.x = t.top.x; u.y = t.top.y; u.path = [];
      this.toast('En lo alto de la torre: el rifle alcanza mucho más lejos'); return;
    }
    if (it.who && !it.who.includes(u.type)) { this.toast(`Esto debe hacerlo: ${it.who.map(w => UNIT_DEFS[w].name).join(' o ')}`, true); return; }
    it.done = true; Sfx.play('plant', it.x, it.y);
    if (it.cut) { this.cutBridge(it.cut); return; }
    if (it.id === 'power') {
      this.power = false; Render.setPower(false);
      this.toast('Suministro cortado: focos y farolas apagados. La oscuridad es total.');
      for (const o of this.enemies) if (o.alive && o.state === 'patrol' && dist(o.x, o.y, it.x, it.y) < 12) o.startInvestigate(it.x, it.y, 5, 'noise');
    } else if (it.id === 'motor') { FX.explosion(it.x, it.y - 1, 0.8); this.noise(it.x, it.y, 6); this.toast('Motor de rotación saboteado'); }
    else this.toast(it.name + ': hecho');
  },

  // Corta un puente colgante: cae quien esté encima
  cutBridge(id) {
    const cells = Level.cutBridge(id); if (!cells.length) return;
    const on = (x, y) => cells.some(([cx, cy]) => Math.floor(x) === cx && Math.floor(y) === cy);
    for (const u of this.units) if (u.alive && on(u.x, u.y)) { u.alive = false; u.dying = false; this.defeat(u.def.name + ' ha caído al abismo.'); }
    for (const e of this.enemies) if (e.alive && on(e.x, e.y)) { e.state = 'dead'; e.hidden = true; e.cause = 'fall'; }
    Render.rebuildBridges(); Sfx.play('boom'); this.shake = 0.5;
    this.toast('Los cables se rompen: el puente cae al abismo. No llegarán refuerzos por aquí.');
    this.noise(cells[0][0], cells[0][1], 14);
  },

  // Subir a un vehículo
  board(u, v) {
    if (u.carry) { this.toast('Suelta antes el cuerpo', true); return; }
    if (!v.driver && v.canDrive(u)) { v.driver = u; }
    else if (v.occupants().length < v.seats) v.passengers.push(u);
    else { this.toast('No queda sitio', true); return; }
    u.inVehicle = v; u.path = []; u.task = null; u.prone = false;
    this.toast(v.driver === u ? `${u.def.name} al volante del ${v.T.name.toLowerCase()}` : `${u.def.name} sube al ${v.T.name.toLowerCase()}`);
    if (v.driver !== u && !v.driver && !this.units.some(x => x.alive && v.canDrive(x))) this.toast('Nadie puede conducir este vehículo', true);
    HUD.dirty = true;
  },

  leaveVehicle(u) {
    const v = u.inVehicle; if (!v) return;
    if (v.driver === u) { v.driver = null; v.path = []; if (v.moving) { v.moving = false; v.mark(true); } }
    v.passengers = v.passengers.filter(x => x !== u);
    u.inVehicle = null;
    const f = Level.nearestFree(Math.floor(v.x), Math.floor(v.y), 4, { x: v.x, y: v.y + 3 });
    if (f) { u.x = f.x + 0.5; u.y = f.y + 0.5; }
    HUD.dirty = true;
  },

  // Robo de bolsillos (Ladrón)
  pickpocket(u, e) {
    const got = [];
    for (const [id, n] of e.pocket) { if (Inv.add(u.inv, id, n)) got.push(ITEMS[id].name); if (id === 'codes') this.flags.codes = true; }
    e.pocket = [];
    const chips = e.loot.filter(l => l[0] === 'chip').reduce((a, l) => a + l[1], 0);
    if (chips) { this.chips += chips; got.push(chips + ' chip' + (chips > 1 ? 's' : '')); e.loot = e.loot.filter(l => l[0] !== 'chip'); }
    this.toast(got.length ? 'Robado sin que se dé cuenta: ' + got.join(', ') : 'Bolsillos vacíos');
    Sfx.play('select'); HUD.dirty = true;
  },

  camCenter() { return { x: Render.target.x, y: Render.target.z }; },
  centerOn(x, y) { Render.centerOn(x, y); },
  primary() { return this.units.find(u => u.selected && u.alive) || null; },
  selected() { return this.units.filter(u => u.selected && u.alive && !u.dying); },

  // ---------- reglas ----------
  noise(x, y, r) {
    for (const e of this.enemies) {
      if (!['patrol', 'investigate', 'bait'].includes(e.state) || e.hidden || e.carried || e.baitT > 0) continue;
      if (dist(e.x, e.y, x, y) <= r) e.startInvestigate(x, y, 3.5, 'noise');
    }
  },

  raiseAlert(e, u) {
    e.releaseBait();
    e.state = 'alert'; e.lastSeen = { x: u.x, y: u.y }; e.lostT = 0; e.path = null; e.repathT = 0; e.distractBy = null;
    this.stats.alarms++;
    this.toast('¡Alarma! Un guardia te ha descubierto', true);
    Sfx.play('alarm');
    for (const o of this.enemies) if (o !== e && o.alive && o.state !== 'alert' && dist(o.x, o.y, e.x, e.y) <= 12) o.startInvestigate(u.x, u.y, 5, 'alarm');
  },

  sectorAlarm(x, y) {
    this.stats.alarms++;
    this.toast('¡Alarma general en el sector!', true);
    Sfx.play('alarm');
    for (const o of this.enemies) if (o.alive && o.state !== 'alert' && dist(o.x, o.y, x, y) <= 16) o.startInvestigate(x, y, 6, 'alarm');
  },

  explode(x, y, r, noiseR) {
    FX.explosion(x, y, r); Sfx.play('boom', x, y);
    Render.decal('scorch', x, y, Math.min(2.5, r * 0.7));
    this.shake = Math.max(this.shake, Math.min(1.2, r / 4));
    for (const e of this.enemies) if (e.state !== 'dead' && !e.hidden && !e.carried && dist(e.x, e.y, x, y) <= r) { e.kill('boom'); this.stats.kills++; }
    for (const u of this.units) if (u.alive && dist(u.x, u.y, x, y) <= r) u.damage(500, this, u.def.name + ' ha muerto en una explosión.');
    for (const t of Level.targets) {
      if (t.destroyed) continue;
      const p = t.prop, cx = p.x + p.w / 2, cy = p.y + p.h / 2, dd = Math.max(Math.abs(x - cx) - p.w / 2, Math.abs(y - cy) - p.h / 2, 0);
      if (dd <= r * 0.6 + (t.radius || 1)) this.destroyTarget(t);
    }
    for (const v of this.vehicles) if (v.alive && dist(v.x, v.y, x, y) <= r + 1) v.damage(r * 120, this);
    for (const m of Level.mines) if (!m.dead && dist(m.x, m.y, x, y) <= r) m.dead = true;
    this.noise(x, y, noiseR || NOISE.explosion);
  },

  destroyTarget(t) {
    if (t.id === 'depot') return this.destroyDepot();
    Level.destroyTarget(t); Render.refreshTarget(t);
    const p = t.prop; FX.explosion(p.x + p.w / 2, p.y + p.h / 2, 3);
    this.toast('¡Objetivo destruido!');
  },

  destroyDepot() {
    const b = Level.depot;
    Level.destroyDepot(); Render.refreshTarget(Level.targets.find(t => t.id === 'depot'));
    FX.explosion(b.x - 1, b.y + 0.5, 4); FX.explosion(b.x + 1, b.y - 0.5, 4);
    this.shake = 1.3;
    for (const e of this.enemies) if (e.state !== 'dead' && dist(e.x, e.y, b.x, b.y) <= 5) { e.kill('boom'); this.stats.kills++; }
    for (const u of this.units) if (u.alive && dist(u.x, u.y, b.x, b.y) <= 4) u.damage(500, this, u.def.name + ' estaba demasiado cerca del depósito.');
    this.depotFire();
    this.noise(b.x, b.y, 40);
    this.toast('¡El depósito ha volado por los aires! Reuníos en la extracción');
  },

  depotFire() {
    const b = Level.depot;
    FX.emitters.push({ rate: 14, fn: () => FX.smoke(b.x + (Math.random() - 0.5) * 2.5, b.y + (Math.random() - 0.5) * 2, 0.3, true, 25 + Math.random() * 25) });
    FX.emitters.push({ rate: 22, fn: () => FX.fire(b.x + (Math.random() - 0.5) * 2.4, b.y + (Math.random() - 0.5) * 1.8, 0.1) });
  },

  // Soltar el cuerpo cargado: queda escondido en arbustos o dentro de un edificio
  dropBody(u) {
    const e = u.carry; if (!e) return;
    u.carry = null; e.carried = false; e.x = u.x; e.y = u.y;
    const locker = Level.props.find(l => l.type === 'locker' && dist(u.x, u.y, l.x + 0.5, l.y + 0.5) < 1.9);
    if (locker) { e.hidden = true; this.toast('Cuerpo escondido en el armario'); return; }
    const b = Level.buildingAt(u.x, u.y);
    if (Level.isBush(u.x, u.y) || (b && Level.at(Math.floor(u.x), Math.floor(u.y)) === '=')) { e.hidden = true; this.toast('Cuerpo escondido'); }
    else this.toast('Cuerpo soltado a la vista');
  },

  // Registrar un cuerpo o un mueble
  loot(u, src) {
    if (src.needs && !this.units.some(x => x.alive && Inv.find(x.inv, src.needs))) { this.toast('Está cerrado: hace falta ' + ITEMS[src.needs].name, true); return; }
    const list = src instanceof Enemy ? src.loot : src.items;
    const got = [], left = [];
    for (const [id, n] of list) {
      if (id === 'chip') { this.chips += n; got.push(n + ' chip' + (n > 1 ? 's' : '') + ` (${this.chips}/${this.mission.chips || 0})`); continue; }
      if (Inv.add(u.inv, id, n)) got.push(ITEMS[id].name + (n > 1 ? ' ×' + n : ''));
      else left.push([id, n]);
    }
    if (src instanceof Enemy) src.loot = left; else src.items = left;
    if (got.length) { this.toast('Encontrado: ' + got.join(', ')); Sfx.play('select'); }
    else this.toast(list.length ? 'No queda espacio en la mochila' : 'No hay nada útil', !!list.length);
    HUD.dirty = true;
  },

  hasDocs() { return this.units.some(u => u.alive && Inv.find(u.inv, 'docs')); },

  defeat(msg) {
    if (this.over) return;
    this.over = 'lose'; Sfx.play('lose');
    const run = this.runId; setTimeout(() => { if (this.runId === run) HUD.showEnd(false, msg); }, 1200);
  },

  // Objetivos: los primarios se marcan al cumplirse; la misión acaba al cumplir el último (escapar)
  checkWin() {
    if (this.over) return;
    const M = this.mission;
    M.objectives.forEach((o, i) => { if (!this.objState[i] && !o.final && o.check(this)) { this.objState[i] = true; this.toast('Objetivo cumplido: ' + o.text.split(':').pop().trim()); Sfx.play('select'); } });
    (M.secondary || []).forEach((o, i) => { this.secState[i] = o.live ? o.check(this) : (this.secState[i] || o.check(this)); });
    const rest = M.objectives.every((o, i) => o.final || this.objState[i]);
    const fin = M.objectives.findIndex(o => o.final);
    if (rest && fin >= 0 && M.objectives[fin].check(this)) {
      this.objState[fin] = true;
      this.over = 'win'; Sfx.play('win');
      const stars = this.rating(); Progress.record(M.id, stars.n, this.chips);
      const run = this.runId; setTimeout(() => { if (this.runId === run) HUD.showEnd(true); }, 600);
    }
  },

  // Evaluación de 5 estrellas (según la biblia): objetivos secundarios, sin alarmas, tiempo y bajas no letales
  rating() {
    const M = this.mission, crit = [['Objetivos principales cumplidos', true]];
    (M.secondary || []).forEach((o, i) => crit.push(['Opcional: ' + o.text, !!this.secState[i]]));
    crit.push(['Sin alarmas', this.stats.alarms === 0]);
    crit.push(['En menos de ' + Math.round((M.par || 900) / 60) + ' minutos', this.time < (M.par || 900)]);
    crit.push(['Más bajas no letales que letales', this.stats.ko > this.stats.kills]);
    if (M.chips) crit.push([`Chips secretos: ${this.chips}/${M.chips}`, this.chips >= M.chips]);
    return { n: Math.min(5, crit.filter(c => c[1]).length), crit };
  },

  // ---------- bucle ----------
  frame(dt) {
    Input.camera(dt);
    const running = !this.paused && !this.overlayOpen && this.over !== 'win';
    if (running && !this.over) this.update(dt);
    if (running) FX.update(dt);
    for (const f of this.fx) f.t -= dt;
    this.fx = this.fx.filter(f => f.t > 0);
    this.shake = Math.max(0, this.shake - dt * 1.5);
    Render.draw(this, running ? dt : 0);
    Render.drawMinimap(this);
    if (this.tactical) HUD.drawTactical();
    this.hudT -= dt;
    if (this.hudT <= 0) { HUD.update(); this.hudT = 0.12; }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) document.getElementById('toast').classList.remove('show'); }
  },

  update(dt) {
    this.time += dt;
    for (const u of this.units) {
      u.update(dt, this);
      if ((u.scrutinyT = (u.scrutinyT || 0) - dt) <= 0) u.scrutiny = Math.max(0, u.scrutiny - dt * 0.5);
      if (u.dying && !u._countedDown) { u._countedDown = true; this.stats.downs++; }
      if (!u.dying) u._countedDown = false;
    }
    for (const e of this.enemies) e.update(dt, this);
    for (const v of this.vehicles) v.update(dt, this);
    if (Level.snow) { for (const p of Level.prints) p.t -= dt; if (Level.prints.length && Level.prints[0].t <= 0) Level.prints = Level.prints.filter(p => p.t > 0); }
    for (const c of Level.smokes) c.t -= dt;
    Level.smokes = Level.smokes.filter(c => c.t > 0);
    this.updateSpots(dt);
    for (const d of this.decoys) {
      d.t -= dt; d.next -= dt;
      if (d.next <= 0) { d.next = 2.5; this.noise(d.x, d.y, NOISE.decoy); this.fx.push({ k: 'ring', x: d.x, y: d.y, r: 2, t: 0.8, dur: 0.8 }); Sfx.play('whistle', d.x, d.y); }
    }
    this.decoys = this.decoys.filter(d => d.t > 0);
    for (const b of this.bombs) {
      const before = Math.ceil(b.t); b.t -= dt;
      if (Math.ceil(b.t) !== before) Sfx.play('tick', b.x, b.y);
      if (b.t <= 0) this.explode(b.x, b.y, 3.5, 40);
    }
    this.bombs = this.bombs.filter(b => b.t > 0);
    this.checkWin();
  },

  toast(msg, bad) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
    this.toastT = 3;
  },

  // ---------- guardado (Ctrl+S / Ctrl+L) ----------
  save() {
    if (this.over) return;
    const snap = {
      mission: this.mission.id, power: this.power, chips: this.chips, flags: this.flags, objState: this.objState,
      targets: Level.targets.map(t => t.destroyed), interacts: Level.interacts.map(i => i.done), mines: Level.mines.map(m => [m.dead, m.revealed]),
      doors: this.unlocked || [], vehicles: this.vehicles.map(v => ({ x: v.x, y: v.y, face: v.face, alive: v.alive, driver: v.driver ? v.driver.idx : -1, pass: v.passengers.map(p => p.idx) })),
      time: this.time, stats: this.stats, destroyed: Level.depot.destroyed, cut: this.cutFences, bridges: Object.values(Level.bridges).filter(b => b.cut).map(b => b.id),
      baits: this.baits.map(b => ({ x: b.x, y: b.y, type: b.type })), decoys: this.decoys, bombs: this.bombs,
      loot: Level.loot.map(l => l.items), rot: Render.rot,
      units: this.units.map(u => ({ x: u.x, y: u.y, hp: u.hp, alive: u.alive, dying: u.dying, dyingT: u.dyingT, dis: u.disguised, pr: u.prone, face: u.face, inv: u.inv.items, carry: u.carry ? u.carry.id : null, tower: !!u.onTower, det: u.detector })),
      enemies: this.enemies.map(e => ({ x: e.x, y: e.y, face: e.face, state: e.state, cause: e.cause, wp: e.wp, downT: e.downT, drunkT: e.drunkT, hidden: e.hidden, carried: e.carried, disc: e.discovered, ls: e.lastSeen, loot: e.loot }))
    };
    try { localStorage.setItem('commandos3-save', JSON.stringify(snap)); this.toast('Partida guardada (Ctrl+L para cargar)'); }
    catch (err) { this.toast('No se pudo guardar', true); }
  },

  load() {
    let snap;
    try { snap = JSON.parse(localStorage.getItem('commandos3-save')); } catch (err) { snap = null; }
    if (!snap || !snap.units || !snap.units[0].inv) { this.toast('No hay partida guardada', true); return; }
    const sel = this.units.map(u => u.selected);
    this.reset(snap.mission || 'classic');
    this.time = snap.time; this.stats = Object.assign({ bodies: 0 }, snap.stats);
    this.chips = snap.chips || 0; this.flags = snap.flags || {}; if (snap.objState) this.objState = snap.objState;
    (snap.targets || []).forEach((d, i) => { if (d && Level.targets[i] && !Level.targets[i].destroyed && Level.targets[i].id !== 'depot') { Level.destroyTarget(Level.targets[i]); Render.refreshTarget(Level.targets[i]); } });
    (snap.interacts || []).forEach((d, i) => { if (Level.interacts[i]) Level.interacts[i].done = d; });
    (snap.mines || []).forEach((m, i) => { if (Level.mines[i]) { Level.mines[i].dead = m[0]; Level.mines[i].revealed = m[1]; } });
    for (const [tx, ty] of snap.doors || []) { Level.grid[ty][tx] = 'D'; Render.unlockDoor(tx, ty); }
    if (snap.power === false) { this.power = false; Render.setPower(false); }
    for (const [tx, ty] of snap.cut || []) Level.grid[ty][tx] = '.';
    for (const id of (snap.bridges || [])) Level.cutBridge(id); if ((snap.bridges || []).length) Render.rebuildBridges();
    this.cutFences = snap.cut || []; if (this.cutFences.length) Render.rebuildFences();
    if (snap.destroyed) { Level.destroyDepot(); Render.refreshDepot(); this.depotFire(); }
    this.baits = snap.baits.map(b => Object.assign(b, { claimed: null }));
    this.decoys = snap.decoys; this.bombs = snap.bombs;
    snap.loot.forEach((items, i) => { if (Level.loot[i]) Level.loot[i].items = items; });
    snap.units.forEach((s, i) => {
      const u = this.units[i];
      Object.assign(u, { x: s.x, y: s.y, hp: s.hp, alive: s.alive, dying: s.dying, dyingT: s.dyingT, disguised: s.dis, prone: s.pr, face: s.face });
      u.inv.items = s.inv; u.detector = !!s.det;
      if (s.tower && Level.towers[0]) { const t = Level.towers[0]; u.onTower = t; u.elev = t.elev; }
      u.selected = !!sel[i] && s.alive;
    });
    (snap.vehicles || []).forEach((sv, i) => {
      const v = this.vehicles[i]; if (!v) return;
      v.mark(false); Object.assign(v, { x: sv.x, y: sv.y, face: sv.face }); v.mark(true);
      if (!sv.alive) { v.alive = false; v.mark(false); }
      if (sv.driver >= 0) { v.driver = this.units[sv.driver]; v.driver.inVehicle = v; }
      v.passengers = sv.pass.map(k => this.units[k]); v.passengers.forEach(p => { p.inVehicle = v; });
    });
    snap.enemies.forEach((s, i) => {
      const e = this.enemies[i];
      Object.assign(e, { x: s.x, y: s.y, face: s.face, state: s.state, cause: s.cause, wp: s.wp, downT: s.downT, drunkT: s.drunkT, hidden: s.hidden, carried: s.carried, discovered: s.disc, loot: s.loot });
      e.path = null; e.waitT = 0;
      if (s.state === 'alert' || s.state === 'investigate' || s.state === 'bait') e.startInvestigate(s.ls ? s.ls.x : s.x, s.ls ? s.ls.y : s.y, 3, 'alarm');
    });
    snap.units.forEach((s, i) => { if (s.carry !== null && s.carry !== undefined) { this.units[i].carry = this.enemies[s.carry]; this.enemies[s.carry].carried = true; } });
    if (!this.units.some(u => u.selected)) { const f = this.units.find(u => u.alive); if (f) f.selected = true; }
    Render.setRotation(snap.rot || 0);
    const p = this.primary(); if (p) this.centerOn(p.x, p.y);
    HUD.dirty = true; HUD.update(); this.toast('Partida cargada');
  }
};

window.G = G;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => G.init());
else G.init();
