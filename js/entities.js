'use strict';
// Comandos y enemigos (IA).

const UNIT_DEFS = {
  beret: {
    name: 'Boina Verde', short: 'B', hp: 3, speed: 2.3, color: '#3f7d3a',
    actions: [
      { id: 'knife', name: 'Cuchillo', desc: 'Clic derecho sobre un enemigo: lo elimina en silencio.' },
      { id: 'carry', name: 'Cuerpo', desc: 'Clic derecho sobre un cuerpo para cargarlo; clic derecho en un arbusto para esconderlo.' }
    ]
  },
  sniper: {
    name: 'Francotirador', short: 'F', hp: 2, speed: 2.1, color: '#7b7a38', ammo: 6,
    actions: [
      { id: 'shoot', name: 'Rifle', desc: 'Clic derecho sobre un enemigo: disparo a larga distancia. El ruido atrae a los guardias.' }
    ]
  },
  spy: {
    name: 'Espía', short: 'E', hp: 2, speed: 2.4, color: '#7a3f6e',
    actions: [
      { id: 'disguise', name: 'Disfraz', instant: true, desc: 'Se disfraza de soldado: solo los oficiales y los guardias muy cercanos lo detectan.' },
      { id: 'syringe', name: 'Anestesia', desc: 'Clic derecho sobre un enemigo: lo duerme en silencio (despierta tras un rato).' },
      { id: 'lure', name: 'Señuelo', desc: 'Clic derecho en un punto: hace ruido y atrae a los guardias cercanos.' }
    ]
  },
  sapper: {
    name: 'Zapador', short: 'Z', hp: 3, speed: 2.0, color: '#a56a2c', grenades: 3,
    actions: [
      { id: 'bomb', name: 'Bomba', desc: 'Clic derecho sobre el depósito de combustible para colocar la carga de tiempo.' },
      { id: 'grenade', name: 'Granada', desc: 'Clic derecho en un punto: explosión de radio corto. Cuidado con el fuego amigo.' }
    ]
  }
};

class Commando {
  constructor(type, x, y, idx) {
    const d = UNIT_DEFS[type];
    this.type = type; this.def = d; this.idx = idx;
    this.x = x; this.y = y; this.face = Math.PI / 2; this.moveAng = this.face;
    this.hp = d.hp; this.alive = true; this.selected = false;
    this.path = []; this.run = false; this.task = null; this.action = null;
    this.ammo = d.ammo || 0; this.grenades = d.grenades || 0;
    this.disguised = false; this.carry = null;
    this.cool = 0; this.busyT = 0; this.busyCb = null; this.busyKind = null;
    this.repathT = 0; this.noiseT = 0; this.hurt = 0; this.moving = false; this.inBush = false;
    this.anim = 0;
  }

  damage(n, G, msg) {
    if (!this.alive) return;
    this.hp -= n; this.hurt = 0.35;
    if (this.hp <= 0) {
      this.alive = false; this.selected = false; this.path = []; this.task = null;
      if (this.carry) { this.carry.carried = false; this.carry = null; }
      G.defeat(msg || (this.def.name + ' ha caído.'));
    }
  }

  order(path, run) { this.task = null; this.busyT = 0; this.busyCb = null; this.path = path || []; this.run = !!run; }

  chase(tx, ty, dt) {
    this.repathT -= dt;
    if (this.repathT <= 0 || !this.path.length) {
      this.path = findPath(this.x, this.y, tx, ty) || [];
      this.repathT = 0.4;
    }
  }

  update(dt, G) {
    if (!this.alive) return;
    this.cool = Math.max(0, this.cool - dt);
    this.hurt = Math.max(0, this.hurt - dt);
    this.inBush = Level.isBush(this.x, this.y);
    this.moving = false;

    if (this.busyT > 0) {
      this.busyT -= dt;
      if (this.busyT <= 0) { const cb = this.busyCb; this.busyCb = null; this.busyKind = null; if (cb) cb(); }
    } else {
      if (this.task) this.runTask(dt, G);
      if (this.busyT <= 0 && this.path.length) {
        const run = this.run && !this.carry;
        const sp = this.def.speed * (run ? 1.7 : 1) * (this.carry ? 0.55 : 1);
        this.moving = stepAlong(this, sp, dt);
        if (this.moving) {
          this.face = turnToward(this.face, this.moveAng, 14 * dt);
          this.anim += dt * sp * 2.2;
          if (run && !this.disguised) {
            this.noiseT -= dt;
            if (this.noiseT <= 0) { G.noise(this.x, this.y, 3.2); this.noiseT = 0.6; }
          }
        }
      }
    }
    if (this.carry) { this.carry.x = this.x; this.carry.y = this.y; }
  }

  startBusy(t, kind, cb) { this.path = []; this.busyT = t; this.busyKind = kind; this.busyCb = cb; }
  faceTo(x, y) { this.face = Math.atan2(y - this.y, x - this.x); }

  runTask(dt, G) {
    const t = this.task;
    switch (t.kind) {
      case 'knife':
      case 'syringe': {
        const e = t.target;
        const bad = !e || e.state === 'dead' || e.hidden || (t.kind === 'syringe' && e.state === 'down');
        if (bad) { this.task = null; this.path = []; break; }
        if (dist(this.x, this.y, e.x, e.y) <= 1.15) {
          this.task = null; this.faceTo(e.x, e.y);
          this.startBusy(0.5, t.kind, () => {
            if (e.state === 'dead') return;
            if (t.kind === 'knife') { e.kill(); G.stats.kills++; } else { e.knockOut(); G.stats.ko++; }
          });
        } else this.chase(e.x, e.y, dt);
        break;
      }
      case 'shoot': {
        const e = t.target;
        if (!e || e.state === 'dead' || e.hidden) { this.task = null; this.path = []; break; }
        if (this.ammo <= 0) { G.toast('Sin munición', true); this.task = null; this.path = []; break; }
        const d = dist(this.x, this.y, e.x, e.y);
        if (d <= 13 && Level.los(this.x, this.y, e.x, e.y)) {
          this.task = null; this.faceTo(e.x, e.y);
          this.startBusy(0.8, 'shoot', () => {
            if (e.state === 'dead' || this.ammo <= 0) return;
            this.ammo--; e.kill(); G.stats.kills++;
            G.fx.push({ k: 'tracer', x0: this.x, y0: this.y, x1: e.x, y1: e.y, t: 0.15, dur: 0.15 });
            G.noise(this.x, this.y, 10);
          });
        } else this.chase(e.x, e.y, dt);
        break;
      }
      case 'carry': {
        if (!this.carry) {
          const e = t.target;
          if (!e || (e.state !== 'dead' && e.state !== 'down') || e.hidden || e.carried) { this.task = null; this.path = []; break; }
          if (dist(this.x, this.y, e.x, e.y) <= 1.1) {
            this.carry = e; e.carried = true; this.path = []; this.task = null;
            G.toast('Cuerpo cargado: clic derecho en un arbusto para esconderlo');
          } else this.chase(e.x, e.y, dt);
        } else {
          if (!t.placing) { this.path = findPath(this.x, this.y, t.x, t.y) || []; t.placing = true; }
          if (!this.path.length) {
            const e = this.carry;
            if (Level.isBush(this.x, this.y)) { e.hidden = true; e.carried = false; this.carry = null; G.toast('Cuerpo escondido'); }
            else { e.carried = false; e.x = this.x; e.y = this.y; this.carry = null; G.toast('Cuerpo soltado'); }
            this.task = null;
          }
        }
        break;
      }
      case 'lure': {
        if (dist(this.x, this.y, t.x, t.y) <= 9) {
          this.task = null; this.path = [];
          if (this.cool > 0) break;
          this.cool = 3;
          this.startBusy(0.4, 'lure', () => {
            G.fx.push({ k: 'ring', x: t.x, y: t.y, r: 3, t: 0.8, dur: 0.8 });
            G.noise(t.x, t.y, 6);
          });
        } else this.chase(t.x, t.y, dt);
        break;
      }
      case 'grenade': {
        if (this.grenades <= 0) { G.toast('Sin granadas', true); this.task = null; this.path = []; break; }
        if (dist(this.x, this.y, t.x, t.y) <= 9 && Level.los(this.x, this.y, t.x, t.y)) {
          this.task = null; this.faceTo(t.x, t.y);
          this.startBusy(0.5, 'throw', () => {
            this.grenades--;
            G.explode(t.x, t.y, 2.3, { noise: 16 });
          });
        } else this.chase(t.x, t.y, dt);
        break;
      }
      case 'bomb': {
        if (G.bomb || Level.depot.destroyed) { G.toast('La carga ya está colocada', true); this.task = null; this.path = []; break; }
        const dp = Level.depot;
        if (dist(this.x, this.y, dp.x, dp.y) <= 2.4) {
          this.task = null; this.faceTo(dp.x, dp.y);
          this.startBusy(3, 'plant', () => {
            G.bomb = { x: dp.x, y: dp.y, t: 20 };
            G.toast('Bomba colocada: 20 segundos. ¡Corred a la zona de extracción!');
          });
        } else this.chase(dp.x, dp.y, dt);
        break;
      }
    }
  }
}

class Enemy {
  constructor(id, def) {
    this.id = id;
    this.x = def.x; this.y = def.y;
    this.patrol = def.patrol; this.sweep = def.sweep || 0.7; this.officer = !!def.officer;
    this.face = def.patrol[0].face || 0; this.moveAng = this.face; this.lookBase = this.face;
    this.state = 'patrol'; this.wp = 0; this.path = null; this.waitT = 0;
    this.susp = 0; this.seenNow = null; this.seenPos = null; this.holding = false;
    this.target = null; this.lookT = 0; this.arrived = false; this.lastSeen = null; this.lostT = 0;
    this.shootCd = 0.5; this.repathT = 0; this.t = Math.random() * 10; this.downT = 0;
    this.hidden = false; this.carried = false; this.discovered = false; this.anim = 0;
  }

  kill() { this.state = 'dead'; this.path = []; this.susp = 0; }
  knockOut() { this.state = 'down'; this.downT = 35; this.path = []; this.susp = 0; }
  startInvestigate(x, y, look) {
    if (this.state === 'alert' || this.state === 'dead' || this.state === 'down') return;
    this.state = 'investigate'; this.target = { x, y }; this.lookT = look || 3.5;
    this.path = null; this.arrived = false;
  }

  // Devuelve la velocidad de sospecha con que ve a un comando (0 si no lo ve).
  canSee(u) {
    if (!u.alive) return 0;
    const alert = this.state === 'alert';
    const range = alert ? 9 : 7.5, half = alert ? 1.1 : 0.62;
    const d = dist(this.x, this.y, u.x, u.y);
    let rate;
    if (u.disguised) {
      if (alert && !this.officer) return 0;
      const lim = this.officer ? 6 : 1.8;
      if (d > lim) return 0;
      rate = this.officer ? 1.4 : 0.35;
    } else {
      if (d > range) return 0;
      if (u.inBush && d > 2.4) return 0;
      rate = 0.9 + (1 - d / range) * 3.6;
    }
    if (d > 1.2 && Math.abs(angDiff(Math.atan2(u.y - this.y, u.x - this.x), this.face)) > half) return 0;
    if (!Level.los(this.x, this.y, u.x, u.y)) return 0;
    return rate;
  }

  perceive(dt, G) {
    let best = null, bestRate = 0;
    for (const u of G.units) {
      const r = this.canSee(u);
      if (r > bestRate) { best = u; bestRate = r; }
    }
    this.seenNow = best;
    if (best) { this.susp = Math.min(1.0001, this.susp + bestRate * dt); this.seenPos = { x: best.x, y: best.y }; }
    else this.susp = Math.max(0, this.susp - 0.45 * dt);
    if (best && this.susp >= 1 && this.state !== 'alert') G.raiseAlert(this, best);
    this.holding = !!best && this.state !== 'alert' && this.susp > 0.15;

    // cuerpos de compañeros
    const range = 7.5;
    for (const b of G.enemies) {
      if (b === this || b.discovered || b.hidden || b.carried) continue;
      if (b.state !== 'dead' && b.state !== 'down') continue;
      const d = dist(this.x, this.y, b.x, b.y);
      if (d > range) continue;
      if (d > 1.2 && Math.abs(angDiff(Math.atan2(b.y - this.y, b.x - this.x), this.face)) > 0.62) continue;
      if (!Level.los(this.x, this.y, b.x, b.y)) continue;
      G.discoverBody(this, b);
    }
  }

  move(dt, speed, faceMove) {
    const moved = stepAlong(this, speed, dt);
    if (moved) {
      this.anim += dt * speed * 2.2;
      if (faceMove) this.face = turnToward(this.face, this.moveAng, 9 * dt);
    }
    return moved;
  }

  update(dt, G) {
    if (this.state === 'dead' || this.hidden || this.carried) return;
    if (this.state === 'down') {
      this.downT -= dt;
      if (this.downT <= 0) { this.state = 'investigate'; this.target = { x: this.x, y: this.y }; this.lookT = 3; this.path = null; this.arrived = true; this.discovered = false; }
      return;
    }
    this.t += dt;
    this.shootCd = Math.max(0, this.shootCd - dt);
    this.perceive(dt, G);

    if (this.holding) {
      this.face = turnToward(this.face, Math.atan2(this.seenPos.y - this.y, this.seenPos.x - this.x), 5 * dt);
      return;
    }
    if (this.state === 'patrol') this.doPatrol(dt);
    else if (this.state === 'investigate') this.doInvestigate(dt);
    else if (this.state === 'alert') this.doAlert(dt, G);
  }

  doPatrol(dt) {
    const wp = this.patrol[this.wp];
    if (this.waitT > 0) {
      this.waitT -= dt;
      this.face = this.lookBase + Math.sin(this.t * 1.1) * this.sweep;
      if (this.waitT <= 0 && this.patrol.length > 1) { this.wp = (this.wp + 1) % this.patrol.length; this.path = null; }
      return;
    }
    if (this.path === null) this.path = findPath(this.x, this.y, wp.x, wp.y) || [];
    if (this.path.length) { this.move(dt, 1.5, true); return; }
    // llegada
    if (this.patrol.length === 1) { this.waitT = 1e9; this.lookBase = wp.face !== undefined ? wp.face : this.face; }
    else { this.waitT = wp.wait || 1.5; this.lookBase = this.face; }
  }

  doInvestigate(dt) {
    if (!this.arrived) {
      if (this.path === null) this.path = findPath(this.x, this.y, this.target.x, this.target.y) || [];
      if (this.path.length) { this.move(dt, 2.0, true); return; }
      this.arrived = true; this.lookBase = this.face;
    }
    this.lookT -= dt;
    this.face = this.lookBase + Math.sin(this.t * 1.6) * 1.1;
    if (this.lookT <= 0) { this.state = 'patrol'; this.path = null; this.waitT = 0; this.susp = 0; }
  }

  doAlert(dt, G) {
    const t = this.seenNow;
    this.repathT -= dt;
    if (t) {
      this.lastSeen = { x: t.x, y: t.y }; this.lostT = 0;
      const d = dist(this.x, this.y, t.x, t.y), a = Math.atan2(t.y - this.y, t.x - this.x);
      this.face = turnToward(this.face, a, 9 * dt);
      if (d > 6.5 || !Level.los(this.x, this.y, t.x, t.y)) {
        if (this.repathT <= 0 || !this.path || !this.path.length) { this.path = findPath(this.x, this.y, t.x, t.y) || []; this.repathT = 0.5; }
        this.move(dt, 2.9, false);
      } else {
        this.path = [];
        if (this.shootCd <= 0 && Math.abs(angDiff(a, this.face)) < 0.35) this.shoot(t, G);
      }
    } else {
      this.lostT += dt;
      const ls = this.lastSeen;
      if (ls && dist(this.x, this.y, ls.x, ls.y) > 0.8) {
        if (this.repathT <= 0 || !this.path || !this.path.length) { this.path = findPath(this.x, this.y, ls.x, ls.y) || []; this.repathT = 0.6; }
        this.move(dt, 2.6, true);
      } else this.face += dt * 1.6;
      if (this.lostT > 7) {
        this.state = 'investigate'; this.target = ls ? { x: ls.x, y: ls.y } : { x: this.x, y: this.y };
        this.lookT = 4; this.path = null; this.arrived = false; this.susp = 0;
      }
    }
  }

  shoot(t, G) {
    this.shootCd = 1.0;
    const d = dist(this.x, this.y, t.x, t.y);
    G.fx.push({ k: 'tracer', x0: this.x, y0: this.y, x1: t.x, y1: t.y, t: 0.12, dur: 0.12, enemy: true });
    G.noise(this.x, this.y, 12);
    if (Math.random() < clamp(0.8 - 0.05 * d, 0.25, 0.75)) t.damage(1, G, t.def.name + ' ha sido abatido por una patrulla.');
  }
}

const ENEMY_DEFS = [
  { x: 34.5, y: 21.5, patrol: [{ x: 34.5, y: 21.5, face: 0 }] },
  { x: 34.5, y: 24.5, patrol: [{ x: 34.5, y: 24.5, face: 0 }] },
  { x: 18.5, y: 22.5, patrol: [{ x: 18.5, y: 22.5, wait: 2 }, { x: 28.5, y: 22.5, wait: 2 }] },
  { x: 8.5, y: 18.5, patrol: [{ x: 8.5, y: 18.5, wait: 1.5 }, { x: 20.5, y: 18.5, wait: 1.5 }] },
  { x: 14.5, y: 40.5, patrol: [{ x: 14.5, y: 40.5, wait: 2 }, { x: 26.5, y: 40.5, wait: 2 }] },
  { x: 44.5, y: 11.5, patrol: [{ x: 44.5, y: 11.5, face: 1.57 }] },
  { x: 47.5, y: 12.5, patrol: [{ x: 47.5, y: 12.5, face: 3.14 }] },
  { x: 56.5, y: 13.5, patrol: [{ x: 56.5, y: 13.5, face: 3.14 }], officer: true },
  { x: 54.5, y: 29.5, patrol: [{ x: 54.5, y: 29.5, wait: 1.5 }, { x: 60.5, y: 29.5, wait: 1.5 }] },
  { x: 60.5, y: 34.5, patrol: [{ x: 60.5, y: 34.5, wait: 1.5 }, { x: 54.5, y: 34.5, wait: 1.5 }] },
  { x: 49.5, y: 32.5, patrol: [{ x: 49.5, y: 32.5, face: 3.14 }] },
  { x: 44.5, y: 18.5, patrol: [{ x: 44.5, y: 18.5, wait: 2 }, { x: 44.5, y: 25.5, wait: 2 }] },
  { x: 40.5, y: 28.5, patrol: [{ x: 40.5, y: 28.5, face: 1.57 }] },
  { x: 40.5, y: 37.5, patrol: [{ x: 40.5, y: 37.5, wait: 2 }, { x: 58.5, y: 37.5, wait: 2 }] }
];
