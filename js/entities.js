'use strict';
// Comandos y enemigos, siguiendo las reglas de Commandos 2.
// Escala: 1 casilla ≈ 2 m. Radios de ruido de la guía convertidos a casillas.

const NOISE = { sniperS: 2.8, knife: 2, punch: 2, run: 3.5, decoy: 6, pistol: 13, pistolS: 2.5, rifle: 18, explosion: 30, engine: 5 };
const SHOT_DAMAGE = 34;

const UNIT_DEFS = {
  beret: {
    name: 'Asalto', hp: 120, speed: 2.3, carry: true, abilities: ['punch', 'examine'],
    inv: [4, 3, [['knife', 0, 0], ['rope', 2, 0, 3], ['decoy', 0, 1, 2], ['cigs', 1, 1, 2], ['medkit', 2, 1, 3]]]
  },
  sniper: {
    name: 'Francotirador', hp: 80, speed: 2.15, carry: true, abilities: ['punch', 'examine'],
    inv: [4, 2, [['sniper', 0, 0, 6], ['ammo', 3, 0, 3], ['cigs', 3, 1, 1]]]
  },
  spy: {
    name: 'Espía', hp: 90, speed: 2.4, carry: false, abilities: ['talk', 'examine'],
    inv: [4, 3, [['syringe', 0, 0], ['wine', 1, 0, 1], ['uniform', 2, 0], ['pistol', 0, 1, 8], ['cigs', 0, 2, 2]]]
  },
  sapper: {
    name: 'Explosivos', hp: 110, speed: 2.0, carry: true, abilities: ['punch', 'examine'],
    inv: [4, 3, [['bomb', 0, 0], ['grenade', 2, 0, 3], ['cutters', 2, 1], ['pistol', 0, 2, 8], ['ration', 2, 2]]]
  },
  driver: {
    name: 'Conductor', hp: 100, speed: 2.25, carry: true, drive: true, abilities: ['punch', 'examine'],
    inv: [4, 3, [['pistolS', 0, 0, 8], ['smoke', 2, 0, 1], ['keys', 3, 0]]]
  },
  thief: {
    name: 'Ladrón', hp: 70, speed: 2.6, carry: false, climb: true, quiet: true, abilities: ['punch', 'steal', 'examine'],
    inv: [4, 3, [['lockpick', 0, 0], ['spike', 2, 0], ['cigs', 3, 0, 2]]]
  },
  dog: {
    name: 'Perro táctico', hp: 70, speed: 3.4, carry: false, small: true, animal: true, quiet: true, abilities: ['bark'],
    inv: [2, 2, []]
  },
  seductress: {
    name: 'Seductora', hp: 75, speed: 2.3, carry: false, civilian: true, abilities: ['examine'],
    inv: [4, 2, [['lipstick', 0, 0], ['pistolS', 1, 0, 4], ['medkit', 0, 1, 3]]]
  }
};

// Acciones ejecutables: alcance, tiempo, línea de visión y efecto
const ACTS = {
  get spike() { return this.knife; },
  knife:   { range: 1.15, time: 0.45, anim: 'knife', ok: t => t.target && !['dead'].includes(t.target.state), run(u, t, G) { t.target.kill('knife'); G.stats.kills++; G.noise(u.x, u.y, NOISE.knife); Sfx.play('knife', u.x, u.y); } },
  syringe: { range: 1.15, time: 0.6, anim: 'knife', ok: t => t.target && t.target.state !== 'dead', run(u, t, G) { t.target.kill('knife'); G.stats.kills++; Sfx.play('thud', u.x, u.y); } },
  punch:   { range: 1.15, time: 0.4, anim: 'knife', ok: t => t.target && !['dead', 'down', 'tied'].includes(t.target.state) && !t.target.fixed, run(u, t, G) { t.target.knockOut(28); G.stats.ko++; G.noise(u.x, u.y, NOISE.punch); Sfx.play('thud', u.x, u.y); } },
  rope:    { range: 1.15, time: 1.4, anim: 'plant', ok: t => t.target && t.target.state === 'down', run(u, t, G) { t.target.state = 'tied'; Inv.take(u.inv, 'rope'); G.toast('Enemigo atado: ya no despertará'); } },
  talk:    { range: 1.5, time: 0.2, ok: (t, u) => u.disguised && t.target && !['dead', 'down', 'tied', 'alert'].includes(t.target.state), run(u, t, G) { t.target.distractBy = u; G.toast('El Espía entretiene al guardia. No te alejes de él.'); } },
  sniper:  { range: 13, los: true, time: 0.8, anim: 'aim', ok: t => t.target && t.target.state !== 'dead', run(u, t, G) { u.fire('sniper', t.target, G); } },
  sniperS: { range: 13, los: true, time: 0.9, anim: 'aim', ok: t => t.target && t.target.state !== 'dead', run(u, t, G) { u.fire('sniperS', t.target, G); } },
  pistol:  { range: 7, los: true, time: 0.35, anim: 'aim', ok: t => t.target && t.target.state !== 'dead', run(u, t, G) { u.fire('pistol', t.target, G); } },
  grenade: { range: 9, los: true, time: 0.5, anim: 'throw', run(u, t, G) { Inv.take(u.inv, 'grenade'); G.explode(t.x, t.y, 2.3, NOISE.explosion); } },
  decoy:   { range: 1.5, time: 0.5, anim: 'plant', run(u, t, G) { Inv.take(u.inv, 'decoy'); G.decoys.push({ x: t.x, y: t.y, t: 10, next: 0 }); G.toast('Señuelo activado'); } },
  cigs:    { range: 4, los: true, time: 0.4, anim: 'throw', run(u, t, G) { Inv.take(u.inv, 'cigs'); G.baits.push({ x: t.x, y: t.y, type: 'cigs', claimed: null }); } },
  wine:    { range: 4, los: true, time: 0.4, anim: 'throw', run(u, t, G) { Inv.take(u.inv, 'wine'); G.baits.push({ x: t.x, y: t.y, type: 'wine', claimed: null }); } },
  bomb:    { range: 1.6, time: 3, anim: 'plant', ok: () => true, run(u, t, G) { Inv.take(u.inv, 'bomb'); G.bombs.push({ x: t.x, y: t.y, t: 20 }); Sfx.play('plant', t.x, t.y); G.toast('Bomba colocada: 20 segundos. ¡Alejaos!'); } },
  medkit:  { range: 1.3, time: 1.2, anim: 'plant', ok: t => t.target && t.target.alive, run(u, t, G) { t.target.heal(t.target.maxHp); Inv.take(u.inv, 'medkit'); G.toast(t.target.def.name + ' curado'); } },
  cutters: { range: 1.3, time: 1.5, anim: 'plant', ok: t => Level.at(t.tx, t.ty) === 'f', run(u, t, G) { Level.grid[t.ty][t.tx] = '.'; G.cutFences.push([t.tx, t.ty]); Render.rebuildFences(); G.toast('Alambrada cortada'); } },
  examine: { range: 1.3, time: 1.0, anim: 'plant', ok: t => !!t.target, run(u, t, G) { G.loot(u, t.target); } },
  pistolS: { range: 7, los: true, time: 0.35, anim: 'aim', ok: t => t.target && t.target.state !== 'dead', run(u, t, G) { u.fire('pistolS', t.target, G); } },
  lockpick:{ range: 1.5, time: 2.2, anim: 'plant', ok: (t, u) => Level.at(t.tx, t.ty) === 'L' && (!Level.doorFrom[t.tx + ',' + t.ty] || u.y < t.ty), run(u, t, G) { Level.grid[t.ty][t.tx] = 'D'; (G.unlocked = G.unlocked || []).push([t.tx, t.ty]); Render.unlockDoor(t.tx, t.ty); Sfx.play('plant', u.x, u.y); G.toast('Puerta abierta con las ganzúas'); } },
  steal:   { range: 1.15, time: 1.2, anim: 'plant', ok: t => t.target && t.target.alive && t.target.state !== 'alert',
    run(u, t, G) {
      const e = t.target, back = Math.abs(angDiff(Math.atan2(u.y - e.y, u.x - e.x), e.face)) > 1.75;
      if (!back && !e.distractBy && e.state !== 'charmed') { G.toast('Te ha visto acercarte de frente', true); G.raiseAlert(e, u); return; }
      G.pickpocket(u, e);
    } },
  lipstick:{ range: 9, los: true, time: 0.8, anim: 'aim', ok: t => t.target && t.target.alive && !t.target.officer && t.target.R.charmable !== false && t.target.state !== 'alert',
    run(u, t, G) { t.target.charm(u); G.toast('El guardia se acerca embobado. No te muevas.'); } },
  smoke:   { range: 8, los: true, time: 0.5, anim: 'throw', run(u, t, G) { Inv.take(u.inv, 'smoke'); G.smoke(t.x, t.y); } },
  disarm:  { range: 1.3, time: 2.0, anim: 'plant', ok: t => t.mine && !t.mine.dead, run(u, t, G) { t.mine.dead = true; G.toast('Mina desactivada'); Sfx.play('plant', u.x, u.y); } },
  interact:{ range: 1.4, time: 1, anim: 'plant', ok: t => t.it && (!t.it.done || t.it.repeat), run(u, t, G) { G.interact(u, t.it); } },
  board:   { range: 2.8, time: 0.4, ok: t => t.veh && t.veh.hp > 0, run(u, t, G) { G.board(u, t.veh); } },
  pickup:  { range: 1.1, time: 0.5, anim: 'plant', ok: t => t.target && ['dead', 'down', 'tied'].includes(t.target.state) && !t.target.hidden && !t.target.carried, run(u, t, G) { u.carry = t.target; t.target.carried = true; u.prone = false; G.toast('Cuerpo cargado: Shift + clic en un arbusto o un edificio para esconderlo'); } },
  drop:    { range: 0.4, time: 0.3, anim: 'plant', ok: (t, u) => !!u.carry, run(u, t, G) { G.dropBody(u); } }
};

class Commando {
  constructor(type, x, y, idx, inv) {
    const d = UNIT_DEFS[type];
    this.type = type; this.def = d; this.idx = idx;
    this.x = x; this.y = y; this.face = -Math.PI / 4; this.moveAng = this.face;
    this.maxHp = d.hp; this.hp = d.hp; this.alive = true; this.dying = false; this.dyingT = 0;
    this.selected = false; this.path = []; this.run = false; this.task = null; this.action = null;
    this.inv = Inv.make(d.inv[0], d.inv[1], inv || d.inv[2]);
    this.elev = 0; this.inVehicle = null; this.onTower = null; this.detector = false;
    this.disguised = false; this.carry = null; this.prone = false; this.cover = false;
    this.cool = 0; this.busyT = 0; this.busyTotal = 0; this.busyCb = null; this.busyKind = null;
    this.repathT = 0; this.noiseT = 0; this.hurt = 0; this.moving = false; this.inBush = false; this.anim = 0;
    this.scrutiny = 0; // barra azul del disfraz
  }

  get crouch() { return this.prone; } // compatibilidad con el render

  damage(n, G, msg) {
    if (!this.alive || this.dying) return;
    this.hp -= n; this.hurt = 0.35;
    if (this.hp <= 0) {
      this.hp = 0; this.dying = true; this.dyingT = 15; this.deathMsg = msg;
      this.path = []; this.task = null; this.busyT = 0; this.cover = false;
      if (this.carry) { G.dropBody(this); }
      G.toast(`${this.def.name} está moribundo: cúralo con un botiquín en 15 s`, true);
    }
  }

  heal(n) {
    if (this.dying) { this.dying = false; this.hp = Math.round(this.maxHp * 0.4); return; }
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  order(path, run) {
    this.task = null; this.busyT = 0; this.busyCb = null; this.path = path || []; this.cover = false;
    this.run = !!run && !this.prone && !this.disguised && !this.carry;
  }

  chase(tx, ty, dt) {
    this.repathT -= dt;
    if (this.repathT <= 0 || !this.path.length) { this.path = findPath(this.x, this.y, tx, ty, this.pathFlags()) || []; this.repathT = 0.4; }
  }

  pathFlags() { return { climb: !!this.def.climb, small: !!this.def.small, avoidMines: true }; }

  startBusy(t, kind, cb) { this.path = []; this.busyT = t; this.busyTotal = t; this.busyKind = kind; this.busyCb = cb; }
  faceTo(x, y) { this.face = Math.atan2(y - this.y, x - this.x); }

  weapon() { for (const id of ['sniper', 'sniperS', 'pistol']) { const it = Inv.find(this.inv, id); if (it && it.n > 0) return id; } return null; }

  fire(kind, e, G) {
    const it = Inv.find(this.inv, kind);
    if (!it || it.n <= 0) { G.toast('Sin munición', true); return; }
    if (e.state === 'dead') return;
    it.n--;
    if (this.disguised && kind !== 'pistolS') { this.disguised = false; G.toast('Disparar ha delatado el disfraz', true); }
    const d = dist(this.x, this.y, e.x, e.y);
    const hit = kind === 'sniper' || kind === 'sniperS' || Math.random() < clamp(0.95 - d * 0.06, 0.4, 0.92);
    G.fx.push({ k: 'tracer', x0: this.x, y0: this.y, x1: e.x, y1: e.y, h0: this.elev, h1: e.elev || 0, t: 0.15, dur: 0.15 });
    FX.muzzle(this.x, this.y, this.face);
    Sfx.play(kind === 'sniper' ? 'rifle' : kind === 'pistolS' || kind === 'sniperS' ? 'knife' : 'shot', this.x, this.y);
    if (hit) { e.kill('shot'); G.stats.kills++; } else FX.dust(e.x + (Math.random() - 0.5), e.y + (Math.random() - 0.5));
    G.noise(this.x, this.y, NOISE[kind] || NOISE.pistol);
    this.cool = kind === 'sniper' || kind === 'sniperS' ? 1.4 : 0.5;
  }

  update(dt, G) {
    if (!this.alive) return;
    this.hurt = Math.max(0, this.hurt - dt);
    this.cool = Math.max(0, this.cool - dt);
    if (this.dying) {
      this.dyingT -= dt;
      if (this.dyingT <= 0) { this.alive = false; this.dying = false; this.selected = false; G.defeat(this.deathMsg || this.def.name + ' ha muerto.'); }
      return;
    }
    if (this.inVehicle) { this.x = this.inVehicle.x; this.y = this.inVehicle.y; this.moving = false; return; }
    this.inBush = Level.isBush(this.x, this.y);
    this.moving = false;
    if (!this.onTower) this.elev = Level.at(Math.floor(this.x), Math.floor(this.y)) === 'C' ? 1.3 : 0; // sobre un muro escalable
    this.barkT = Math.max(0, (this.barkT || 0) - dt);
    if (this.onTower && this.path.length) { // bajar de la torre solo para desplazarse; disparar desde arriba no la abandona
      const t = this.onTower; this.onTower = null; this.elev = 0; this.x = t.base.x; this.y = t.base.y;
      if (this.path.length) this.path = findPath(this.x, this.y, this.path[this.path.length - 1].x, this.path[this.path.length - 1].y, this.pathFlags()) || [];
    }
    if (this.detector) for (const m of Level.mines) if (!m.dead && !m.revealed && dist(m.x, m.y, this.x, this.y) < 4) { m.revealed = true; }
    if (this.busyT > 0) {
      this.busyT -= dt;
      if (this.busyT <= 0) { const cb = this.busyCb; this.busyCb = null; this.busyKind = null; if (cb) cb(); }
    } else {
      if (this.task) this.runTask(dt, G);
      if (this.cover && !this.task && !this.path.length) this.coverFire(G);
      if (this.busyT <= 0 && this.path.length) {
        const run = this.run && !this.carry && !this.prone && !this.disguised;
        const sp = this.def.speed * (run ? 1.75 : 1) * (this.carry ? 0.55 : 1) * (this.prone ? 0.42 : 1);
        this.moving = stepAlong(this, sp, dt);
        if (this.moving) {
          this.face = turnToward(this.face, this.moveAng, 14 * dt);
          this.anim += dt * sp * 2.2;
          if (Level.snow && !this.onTower && Level.floorAt(Math.floor(this.x), Math.floor(this.y)) === 'n') {
            const lp = this._lp;
            if (!lp || dist(lp.x, lp.y, this.x, this.y) > 0.5) { Level.prints.push({ x: this.x, y: this.y, a: this.moveAng, t: 20, side: (this._ps = -(this._ps || 1)), by: this.type }); this._lp = { x: this.x, y: this.y }; }
          }
          if (run) { this.noiseT -= dt; if (this.noiseT <= 0) { G.noise(this.x, this.y, this.def.quiet ? 1.2 : NOISE.run); this.noiseT = 0.5; } }
          const mn = Level.mines.length && Level.mineAt(Math.floor(this.x), Math.floor(this.y));
          if (mn) { mn.dead = true; G.explode(mn.x, mn.y, 1.8, NOISE.explosion); }
        }
      }
    }
    if (this.carry) { this.carry.x = this.x; this.carry.y = this.y; }
  }

  coverFire(G) {
    const w = this.weapon(); if (!w || this.cool > 0) return;
    const range = w === 'sniper' || w === 'sniperS' ? 13 : 7;
    let best = null, bd = range;
    for (const e of G.enemies) {
      if (['dead', 'down', 'tied'].includes(e.state) || e.hidden) continue;
      const d = dist(this.x, this.y, e.x, e.y);
      if (d < bd && Level.los(this.x, this.y, e.x, e.y)) { bd = d; best = e; }
    }
    if (best) { this.faceTo(best.x, best.y); this.startBusy(0.25, 'aim', () => this.fire(w, best, G)); }
  }

  runTask(dt, G) {
    const t = this.task, A = ACTS[t.kind];
    if (!A || (A.ok && !A.ok(t, this))) { this.task = null; this.path = []; return; }
    const tx = t.target ? t.target.x : t.x, ty = t.target ? t.target.y : t.y;
    const high = this.elev > 0 || (t.target && t.target.elev > 0);
    const range = A.range * (this.elev > 0 && A.los ? 1.6 : 1) + (t.target && t.target.elev > 0 && A.range < 2 ? -9 : 0);
    if (this.onTower && (dist(this.x, this.y, tx, ty) > range || (A.los && !Level.los(this.x, this.y, tx, ty, high)))) { G.toast('Fuera de alcance desde la torre', true); this.task = null; return; }
    if (dist(this.x, this.y, tx, ty) <= range && (!A.los || Level.los(this.x, this.y, tx, ty, high))) {
      this.task = null; this.path = [];
      if (A.range > 0.5) this.faceTo(tx, ty);
      this.startBusy(t.time || A.time, A.anim || t.kind, () => { if (!A.ok || A.ok(t, this)) A.run(this, t, G); });
    } else this.chase(tx, ty, dt);
  }
}

// ---------------- ENEMIGOS ----------------
const RANKS = {
  soldier:  { name: 'Soldado', range: 10, near: 4.5, half: Math.PI / 4, fireCd: 1.0, bait: ['patrol', 'investigate'], kind: 'soldier' },
  sergeant: { name: 'Sargento', range: 10, near: 4.5, half: Math.PI / 4, fireCd: 0.4, bait: ['patrol'], kind: 'sergeant', damage: 22 },
  officer:  { name: 'Oficial', range: 10, near: 4.5, half: Math.PI / 4, fireCd: 0.9, bait: [], kind: 'officer', spots: true },
  gestapo:  { name: 'Gestapo', range: 10, near: 4.5, half: Math.PI / 4, fireCd: 0.8, bait: [], kind: 'gestapo', spots: true, gestapo: true },
  sniper:   { name: 'Francotirador', range: 16, near: 6, half: 0.24, fireCd: 1.6, bait: [], kind: 'esniper', instant: true, static: true, elev: 3.32 },
  dog:      { name: 'Perro guardián', range: 5.2, near: 5.2, half: Math.PI, fireCd: 0.9, bait: [], kind: 'dogE', smell: true, melee: true, damage: 30 },
  tech:     { name: 'Técnico', range: 8, near: 4, half: Math.PI / 4, fireCd: 9, bait: ['patrol', 'investigate'], kind: 'tech', unarmed: true }
};
RANKS.sergeant.light = true; // los suboficiales llevan linterna: de noche ven igual

class Enemy {
  constructor(id, def) {
    this.id = id; this.rank = def.rank || 'soldier'; this.R = RANKS[this.rank];
    this.elev = def.elev || this.R.elev || 0; this.fixed = !!this.R.static || this.elev > 0; this.tag = def.tag || null;
    this.pocket = def.pocket ? def.pocket.map(x => x.slice()) : [];
    this.officer = this.rank === 'officer' || this.rank === 'gestapo';
    this.x = def.x; this.y = def.y;
    this.patrol = def.patrol; this.sweep = def.sweep || 0.7;
    this.face = def.patrol[0].face || 0; this.moveAng = this.face; this.lookBase = this.face;
    this.state = 'patrol'; this.wp = 0; this.path = null; this.waitT = 0;
    this.susp = 0; this.seenNow = null; this.seenPos = null; this.holding = false; this.watch = 0;
    this.target = null; this.lookT = 0; this.arrived = false; this.lastSeen = null; this.lostT = 0; this.invKind = 'noise';
    this.shootCd = 0.5; this.repathT = 0; this.t = Math.random() * 10; this.downT = 0; this.drunkT = 0; this.baitT = 0; this.bait = null;
    this.hidden = false; this.carried = false; this.discovered = false; this.anim = 0; this.distractBy = null; this.body = null;
    const r = mulberry32(id * 31 + 7), loot = [];
    if (r() < 0.45) loot.push(['cigs', 1]); if (r() < 0.25) loot.push(['wine', 1]); if (r() < 0.3) loot.push(['ration', 1]); if (r() < 0.3) loot.push(['ammo', 2]);
    if (this.rank === 'officer') loot.push(['medkit', 3], ['wine', 1]);
    if (this.rank === 'gestapo') loot.push(['uniform', 1], ['ammo', 2]);
    if (this.rank === 'sergeant') loot.push(['ammo', 2], ['grenade', 1]);
    this.loot = def.loot ? def.loot.map(x => x.slice()).concat(loot.slice(0, 1)) : loot;
  }

  get alive() { return !['dead', 'down', 'tied'].includes(this.state); }

  kill(cause) { this.state = 'dead'; this.cause = cause || 'shot'; this.path = []; this.susp = 0; this.distractBy = null; this.releaseBait(); }
  knockOut(t) { this.state = 'down'; this.downT = t; this.path = []; this.susp = 0; this.distractBy = null; this.releaseBait(); }
  releaseBait() { if (this.bait) { this.bait.claimed = null; this.bait = null; } }

  startInvestigate(x, y, look, kind) {
    if (!this.alive || this.state === 'alert') return;
    if (this.fixed) { this.state = 'investigate'; this.invKind = kind || 'noise'; this.target = { x, y }; this.arrived = true; this.lookT = look || 4; this.lookBase = Math.atan2(y - this.y, x - this.x); return; }
    this.releaseBait();
    this.state = 'investigate'; this.invKind = kind || 'noise'; this.target = { x, y }; this.lookT = look || 3.5;
    this.path = null; this.arrived = false;
  }

  vision() {
    let { range, near, half } = this.R;
    if (this.state === 'alert') { range *= 1.15; half *= 1.2; }
    if (this.drunkT > 0) { range *= 0.5; near *= 0.6; }
    if (this.elev > 0) range *= 1.25;
    if (!this.R.smell && G.fog && G.fog < 1) { range *= G.fog; near *= Math.min(1, G.fog + 0.1); }
    return { range, near, half };
  }

  // Encanto de la Seductora: se acerca a ella y se queda mirándola
  charm(u) {
    this.releaseBait(); this.state = 'charmed'; this.charmBy = u; this.charmPos = { x: u.x, y: u.y }; this.charmT = 25; this.path = null; this.susp = 0;
  }

  // Velocidad de detección de un comando (0 = no lo ve). Devuelve también si está en zona cercana.
  canSee(u) {
    if (!u.alive || u.dying || u.inVehicle) return null;
    if (this.R.smell) { // el perro guardián huele: radio fijo, sin importar postura, disfraz ni arbustos
      if (u.isVehicle || dist(this.x, this.y, u.x, u.y) > this.R.range) return null;
      return { rate: 2.4, near: true };
    }
    if (u.def && u.def.animal) return null; // los enemigos ignoran al perro (lo toman por un animal callejero)
    const v = this.vision(), d = dist(this.x, this.y, u.x, u.y);
    // de noche, lejos de la luz, se ve mucho menos (salvo con linterna)
    if (G.night && !this.R.light && !G.isLit(u.x, u.y)) { v.range *= 0.55; v.near *= 0.75; }
    if (d > v.range) return null;
    if (d > 0.8 && Math.abs(angDiff(Math.atan2(u.y - this.y, u.x - this.x), this.face)) > v.half) return null; // por la espalda solo se te detecta a menos de 0,8
    if (!Level.los(this.x, this.y, u.x, u.y, this.elev > 0 || u.elev > 0)) return null;
    if (u.inBush && d > 2 && this.elev <= 0) return null;
    if (Level.snow && u.type === 'sniper' && u.prone) { v.range *= 0.6; v.near *= 0.6; if (d > v.range) return null; } // camuflaje ártico
    const near = d <= v.near;
    if (u.isVehicle) return { rate: near ? 4 : 1.6, near };
    if (u.def && u.def.civilian) { // civil: solo los oficiales sospechan si se queda en su zona cercana
      if (!near || !this.R.spots) return null;
      return { disguise: true, near, time: 2.5 };
    }
    if (u.disguised) {
      if (!near) return null;
      // Espía: solo la Gestapo lo descubre si se queda más de 2 s en su zona cercana.
      if (u.type === 'spy') return this.R.gestapo ? { disguise: true, near, time: 2 } : null;
      // Otros comandos de uniforme: los oficiales los descubren al instante; los demás en 3,5 s.
      return this.R.spots ? { rate: 60, near } : { disguise: true, near, time: 3.5 };
    }
    if (!near && u.prone) return null;            // zona lejana: no ve a quien va cuerpo a tierra
    let rate = near ? 4 : 1.1 + (1 - d / v.range) * 1.6;
    if (this.R.instant) rate = 60;                 // los francotiradores disparan sin aviso
    return { rate, near };
  }

  perceive(dt, G) {
    let best = null, bestRate = 0, disg = null, dTime = 3.5;
    for (const u of G.units.concat(G.vehicles.filter(v => v.driver && v.moving))) {
      const r = this.canSee(u); if (!r) continue;
      if (r.disguise) { disg = u; dTime = r.time; continue; }
      if (r.rate > bestRate) { best = u; bestRate = r.rate; }
    }
    // barra azul: el disfrazado se queda demasiado en la zona cercana
    if (disg && this.state !== 'alert') {
      disg.scrutiny = Math.min(1, disg.scrutiny + dt / dTime); disg.scrutinyT = 0.2;
      if (disg.scrutiny >= 1) { disg.disguised = false; disg.scrutiny = 0; G.toast(disg.def.civilian ? '¡Un oficial ha sospechado de ella!' : '¡Han descubierto el disfraz!', true); G.raiseAlert(this, disg); }
    }
    this.seenNow = best;
    if (best) { this.susp = Math.min(1.0001, this.susp + bestRate * dt); this.seenPos = { x: best.x, y: best.y }; }
    else this.susp = Math.max(0, this.susp - 0.45 * dt);
    if (best && this.susp >= 1 && this.state !== 'alert') G.raiseAlert(this, best);
    this.holding = !!best && this.state !== 'alert' && this.susp > 0.15;

    // cuerpos de compañeros (muertos, inconscientes o atados)
    const v = this.vision();
    for (const b of G.enemies) {
      if (b === this || b.discovered || b.hidden || b.carried || b.alive) continue;
      const d = dist(this.x, this.y, b.x, b.y);
      if (d > v.range) continue;
      if (d > 1.2 && Math.abs(angDiff(Math.atan2(b.y - this.y, b.x - this.x), this.face)) > v.half) continue;
      if (!Level.los(this.x, this.y, b.x, b.y, this.elev > 0)) continue;
      b.discovered = true; this.body = b; G.stats.bodies++;
      this.startInvestigate(b.x, b.y, 5, 'sight');
      G.toast('Un guardia ha visto un cuerpo', true);
    }
    // huellas en la nieve: los guardias que las ven las siguen
    if (Level.snow && !this.R.smell && !this.fixed && !this.R.unarmed && (this.state === 'patrol' || (this.state === 'investigate' && this.arrived))) {
      let pick = null;
      for (const p of Level.prints) {
        if (p.t <= 0 || p.seen) continue;
        const d = dist(this.x, this.y, p.x, p.y);
        if (d > Math.min(v.range, 6.5) || (d > 1.2 && Math.abs(angDiff(Math.atan2(p.y - this.y, p.x - this.x), this.face)) > v.half * 1.4)) continue;
        if (!Level.los(this.x, this.y, p.x, p.y)) continue;
        if (!pick || p.t > pick.t) pick = p;
      }
      if (pick) {
        for (const p of Level.prints) if (dist(p.x, p.y, pick.x, pick.y) < 1.5) p.seen = true;
        if (this.state === 'patrol') G.toast('¡Un guardia ha visto tus huellas en la nieve!', true);
        this.startInvestigate(pick.x, pick.y, 3, 'sight'); this.tracking = true;
      }
    }
    // cebos (cigarrillos, vino)
    if (this.R.bait.includes(this.state) && !this.bait) {
      for (const bt of G.baits) {
        if (bt.claimed) continue;
        const d = dist(this.x, this.y, bt.x, bt.y);
        if (d > v.range || (d > 1.2 && Math.abs(angDiff(Math.atan2(bt.y - this.y, bt.x - this.x), this.face)) > v.half)) continue;
        if (!Level.los(this.x, this.y, bt.x, bt.y)) continue;
        bt.claimed = this; this.bait = bt; this.state = 'bait'; this.path = null; this.baitT = 0;
        break;
      }
    }
  }

  move(dt, speed, faceMove) {
    if (this.drunkT > 0) speed *= 0.7;
    const moved = stepAlong(this, speed, dt);
    if (moved) { this.anim += dt * speed * 2.2; if (faceMove) this.face = turnToward(this.face, this.moveAng + (this.drunkT > 0 ? Math.sin(this.t * 3) * 0.4 : 0), 9 * dt); }
    return moved;
  }

  update(dt, G) {
    if (this.state === 'dead' || this.hidden || this.carried || this.state === 'tied') return;
    if (this.state === 'down') {
      this.downT -= dt;
      if (this.downT <= 0) { this.state = 'investigate'; this.invKind = 'sight'; this.target = { x: this.x, y: this.y }; this.lookT = 4; this.path = null; this.arrived = true; this.discovered = false; G.toast('Un guardia ha despertado', true); }
      return;
    }
    this.t += dt;
    this.drunkT = Math.max(0, this.drunkT - dt);
    this.shootCd = Math.max(0, this.shootCd - dt);
    if (this.state === 'bait' && this.baitT > 0) { // agachado recogiendo el cebo: indefenso
      this.baitT -= dt;
      if (this.baitT <= 0) {
        const b = this.bait; G.baits = G.baits.filter(x => x !== b); this.bait = null;
        if (b.type === 'wine') { this.drunkT = 25; G.toast('El guardia se ha emborrachado'); }
        this.state = 'patrol'; this.path = null; this.waitT = 0;
      }
      return;
    }
    if (this.state === 'charmed') { this.doCharmed(dt); return; }
    this.perceive(dt, G);
    if (this.distractBy) {
      const s = this.distractBy;
      if (!s.alive || s.dying || !s.disguised || dist(s.x, s.y, this.x, this.y) > 2.2 || this.state === 'alert') this.distractBy = null;
      else { this.face = turnToward(this.face, Math.atan2(s.y - this.y, s.x - this.x), 5 * dt); return; }
    }
    if (this.holding) { this.face = turnToward(this.face, Math.atan2(this.seenPos.y - this.y, this.seenPos.x - this.x), 5 * dt); return; }
    if (this.state === 'patrol') this.doPatrol(dt);
    else if (this.state === 'investigate') this.doInvestigate(dt, G);
    else if (this.state === 'alert') this.doAlert(dt, G);
    else if (this.state === 'bait') this.doBait(dt);
  }

  doCharmed(dt) {
    const u = this.charmBy; this.charmT -= dt;
    if (!u || !u.alive || u.dying || dist(u.x, u.y, this.charmPos.x, this.charmPos.y) > 1 || this.charmT <= 0) {
      this.state = 'patrol'; this.charmBy = null; this.path = null; this.waitT = 0; return;
    }
    const d = dist(this.x, this.y, u.x, u.y);
    if (d > 1.4 && !this.fixed) {
      if (this.path === null || !this.path.length) this.path = findPath(this.x, this.y, u.x, u.y, { avoidMines: true }) || [];
      this.move(dt, 1.4, true);
    } else { this.path = []; this.face = turnToward(this.face, Math.atan2(u.y - this.y, u.x - this.x), 6 * dt); }
  }

  doBait(dt) {
    const b = this.bait; if (!b) { this.state = 'patrol'; return; }
    if (this.path === null) this.path = findPath(this.x, this.y, b.x, b.y, { avoidMines: true }) || [];
    if (this.path.length && dist(this.x, this.y, b.x, b.y) > 0.5) { this.move(dt, 1.6, true); return; }
    this.path = []; this.baitT = 2; // se agacha 2 segundos
  }

  doPatrol(dt) {
    const wp = this.patrol[this.wp];
    if (this.fixed) { this.face = (wp.face || 0) + Math.sin(this.t * 0.5) * this.sweep * 0.8; return; }
    if (this.waitT > 0) {
      this.waitT -= dt;
      this.face = this.lookBase + Math.sin(this.t * 1.1) * this.sweep;
      if (this.waitT <= 0 && this.patrol.length > 1) { this.wp = (this.wp + 1) % this.patrol.length; this.path = null; }
      return;
    }
    if (this.path === null) this.path = findPath(this.x, this.y, wp.x, wp.y, { avoidMines: true }) || [];
    if (this.path.length) { this.move(dt, 1.5, true); return; }
    if (this.patrol.length === 1) { this.waitT = 1e9; this.lookBase = wp.face !== undefined ? wp.face : this.face; }
    else { this.waitT = wp.wait || 1.5; this.lookBase = this.face; }
  }

  doInvestigate(dt, G) {
    if (!this.arrived) {
      if (this.path === null) this.path = findPath(this.x, this.y, this.target.x, this.target.y, { avoidMines: true }) || [];
      if (this.path.length) { this.move(dt, this.invKind === 'noise' ? 2.0 : 2.4, true); return; }
      this.arrived = true; this.lookBase = this.face;
      if (this.tracking) this.lookT = 1.2;
      const b = this.body; this.body = null;
      if (b && dist(this.x, this.y, b.x, b.y) < 2.5) {
        if (b.state === 'down' || b.state === 'tied') { b.state = 'investigate'; b.invKind = 'sight'; b.target = { x: b.x, y: b.y }; b.arrived = true; b.lookT = 4; b.discovered = false; G.toast('Han liberado a un guardia', true); }
        G.sectorAlarm(b.x, b.y);
      }
    }
    this.lookT -= dt;
    this.face = this.lookBase + Math.sin(this.t * 1.6) * 1.1;
    if (this.lookT <= 0) { this.state = 'patrol'; this.path = null; this.waitT = 0; this.susp = 0; this.tracking = false; }
  }

  doAlert(dt, G) {
    const t = this.seenNow;
    if (this.R.unarmed) { // los técnicos no luchan: huyen lejos del intruso
      if (t && (!this.path || !this.path.length)) {
        const a = Math.atan2(this.y - t.y, this.x - t.x);
        this.path = findPath(this.x, this.y, clamp(this.x + Math.cos(a) * 10, 2, Level.W - 3), clamp(this.y + Math.sin(a) * 10, 2, Level.H - 3), { avoidMines: true }) || [];
      }
      if (this.path && this.path.length) this.move(dt, 3.0, true);
      this.lostT += dt; if (this.lostT > 12) { this.state = 'patrol'; this.path = null; }
      return;
    }
    this.repathT -= dt;
    if (t) {
      this.lastSeen = { x: t.x, y: t.y }; this.lostT = 0;
      const d = dist(this.x, this.y, t.x, t.y), a = Math.atan2(t.y - this.y, t.x - this.x);
      this.face = turnToward(this.face, a, 9 * dt);
      const reach = this.fixed ? this.R.range : this.R.melee ? 1.15 : 7;
      if (!this.fixed && (d > reach || !Level.los(this.x, this.y, t.x, t.y))) {
        if (this.repathT <= 0 || !this.path || !this.path.length) { this.path = findPath(this.x, this.y, t.x, t.y, { avoidMines: true }) || []; this.repathT = 0.5; }
        this.move(dt, this.R.melee ? 4.6 : 2.9, false);
      } else {
        this.path = [];
        if (this.shootCd <= 0 && Math.abs(angDiff(a, this.face)) < 0.35) this.shoot(t, G);
      }
    } else {
      this.lostT += dt;
      const ls = this.lastSeen;
      if (!this.fixed && ls && dist(this.x, this.y, ls.x, ls.y) > 0.8) {
        if (this.repathT <= 0 || !this.path || !this.path.length) { this.path = findPath(this.x, this.y, ls.x, ls.y, { avoidMines: true }) || []; this.repathT = 0.6; }
        this.move(dt, 2.6, true);
      } else this.face += dt * 1.6;
      if (this.lostT > 8) {
        this.state = 'investigate'; this.invKind = 'alarm'; this.target = ls ? { x: ls.x, y: ls.y } : { x: this.x, y: this.y };
        this.lookT = 5; this.path = null; this.arrived = !!this.fixed; this.susp = 0;
      }
    }
  }

  shoot(t, G) {
    this.shootCd = this.R.fireCd;
    if (this.R.unarmed) return;
    if (this.R.melee) { // mordisco
      if (dist(this.x, this.y, t.x, t.y) > 1.5) return;
      Sfx.play('bark', this.x, this.y); G.noise(this.x, this.y, 9);
      t.damage(this.R.damage, G, t.def.name + ' ha sido destrozado por un perro guardián.'); return;
    }
    if (this.R.instant) G.stats.eshots = (G.stats.eshots || 0) + 1;
    const d = dist(this.x, this.y, t.x, t.y);
    G.fx.push({ k: 'tracer', x0: this.x, y0: this.y, x1: t.x, y1: t.y, h0: this.elev, h1: t.elev || 0, t: 0.12, dur: 0.12, enemy: true });
    FX.muzzle(this.x, this.y, this.face); Sfx.play(this.rank === 'sergeant' ? 'shot' : 'rifle', this.x, this.y);
    G.noise(this.x, this.y, NOISE.rifle);
    const p = this.R.instant ? 0.9 : clamp(0.8 - 0.05 * d - (t.prone ? 0.2 : 0), 0.2, 0.75);
    if (Math.random() < p) t.damage(this.R.damage || SHOT_DAMAGE, G, t.def.name + ' ha muerto bajo el fuego enemigo.');
    else FX.dust(t.x + (Math.random() - 0.5), t.y + (Math.random() - 0.5) * 0.6);
  }
}

