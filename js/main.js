'use strict';
// Núcleo: estado de la partida, reglas, bucle principal y guardado.

const HUD_H = 150;

const G = {
  canvas: null, ui: null, mini: null,
  units: [], enemies: [], fx: [], baits: [], decoys: [], bombs: [],
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
    this.reset();
    HUD.showIntro();
    let last = performance.now();
    const loop = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },

  resize() { Render.resize(window.innerWidth, Math.max(200, window.innerHeight - (this.hudHidden ? 0 : HUD_H))); },

  reset() {
    Level.build();
    FX.reset();
    Render.bakeLevel();
    const types = ['beret', 'sniper', 'spy', 'sapper'];
    this.units = types.map((t, i) => new Commando(t, Level.startPositions[i][0], Level.startPositions[i][1], i));
    this.units[0].selected = true;
    this.enemies = ENEMY_DEFS.map((d, i) => new Enemy(i, d));
    this.fx = []; this.baits = []; this.decoys = []; this.bombs = []; this.cutFences = [];
    this.time = 0; this.over = null; this.paused = false; this.shake = 0;
    this.runId++;
    this.stats = { alarms: 0, kills: 0, ko: 0, downs: 0 };
    FX.emitters.push({ rate: 5, fn: () => FX.smoke(6.6 + Math.random() * 0.1, 3.2, 0.1, false, '120,200,110') });
    Render.zoom = 1.35; Render.setRotation(0);
    this.centerOn(9, 35);
    HUD.build();
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
    if (!Level.depot.destroyed && dist(x, y, Level.depot.x, Level.depot.y) <= r + 1.8) this.destroyDepot();
    this.noise(x, y, noiseR || NOISE.explosion);
  },

  destroyDepot() {
    const b = Level.depot;
    Level.destroyDepot(); Render.refreshDepot();
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
    const b = Level.buildingAt(u.x, u.y);
    if (Level.isBush(u.x, u.y) || (b && Level.at(Math.floor(u.x), Math.floor(u.y)) === '=')) { e.hidden = true; this.toast('Cuerpo escondido'); }
    else this.toast('Cuerpo soltado a la vista');
  },

  // Registrar un cuerpo o un mueble
  loot(u, src) {
    const list = src instanceof Enemy ? src.loot : src.items;
    const got = [], left = [];
    for (const [id, n] of list) {
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

  checkWin() {
    if (this.over || !Level.depot.destroyed) return;
    if (this.units.every(u => u.alive && !u.dying && Level.inExit(u.x, u.y))) {
      this.over = 'win'; Sfx.play('win');
      const run = this.runId; setTimeout(() => { if (this.runId === run) HUD.showEnd(true); }, 600);
    }
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
      time: this.time, stats: this.stats, destroyed: Level.depot.destroyed, cut: this.cutFences,
      baits: this.baits.map(b => ({ x: b.x, y: b.y, type: b.type })), decoys: this.decoys, bombs: this.bombs,
      loot: Level.loot.map(l => l.items), rot: Render.rot,
      units: this.units.map(u => ({ x: u.x, y: u.y, hp: u.hp, alive: u.alive, dying: u.dying, dyingT: u.dyingT, dis: u.disguised, pr: u.prone, face: u.face, inv: u.inv.items, carry: u.carry ? u.carry.id : null })),
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
    this.reset();
    this.time = snap.time; this.stats = snap.stats;
    for (const [tx, ty] of snap.cut || []) Level.grid[ty][tx] = '.';
    this.cutFences = snap.cut || []; if (this.cutFences.length) Render.rebuildFences();
    if (snap.destroyed) { Level.destroyDepot(); Render.refreshDepot(); this.depotFire(); }
    this.baits = snap.baits.map(b => Object.assign(b, { claimed: null }));
    this.decoys = snap.decoys; this.bombs = snap.bombs;
    snap.loot.forEach((items, i) => { if (Level.loot[i]) Level.loot[i].items = items; });
    snap.units.forEach((s, i) => {
      const u = this.units[i];
      Object.assign(u, { x: s.x, y: s.y, hp: s.hp, alive: s.alive, dying: s.dying, dyingT: s.dyingT, disguised: s.dis, prone: s.pr, face: s.face });
      u.inv.items = s.inv;
      u.selected = !!sel[i] && s.alive;
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
