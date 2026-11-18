'use strict';
// Vehículos conducibles: camión militar y todoterreno.

const VEH_TYPES = {
  truck: { name: 'Camión', L: 4, Wd: 2, speed: 3.4, hp: 400 },
  jeep:  { name: 'Todoterreno', L: 3, Wd: 2, speed: 4.2, hp: 250 }
};

class Vehicle {
  constructor(def) {
    const T = VEH_TYPES[def.type];
    Object.assign(this, { id: def.id, type: def.type, T, x: def.x, y: def.y, face: def.face || 0, driverTypes: def.driver, seats: def.seats || 4 });
    this.driver = null; this.passengers = []; this.path = []; this.moving = false; this.hp = T.hp; this.noiseT = 0;
    this.isVehicle = true; this.alive = true; this.elev = 0; this.inBush = false; this.prone = false;
    this.cells = []; this.mark(true);
  }

  get def() { return { name: this.T.name }; }
  occupants() { return (this.driver ? [this.driver] : []).concat(this.passengers); }

  // Casillas que ocupa aparcado (según su orientación redondeada a 90°)
  footprint() {
    const horiz = Math.abs(Math.cos(this.face)) > 0.7, L = this.T.L, Wd = this.T.Wd;
    const w = horiz ? L : Wd, h = horiz ? Wd : L, x0 = Math.round(this.x - w / 2), y0 = Math.round(this.y - h / 2), out = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.push([x0 + i, y0 + j]);
    return out;
  }

  mark(on) {
    if (on) {
      this.cells = this.footprint().filter(([x, y]) => Level.at(x, y) === '.' || Level.at(x, y) === 's');
      for (const [x, y] of this.cells) Level.grid[y][x] = 'V';
    } else {
      for (const [x, y] of this.cells) if (Level.at(x, y) === 'V') Level.grid[y][x] = '.';
      this.cells = [];
    }
  }

  canDrive(u) {
    if (this.driverTypes && !this.driverTypes.includes(u.type)) return false;
    if (this.type === 'truck' && u.type !== 'driver' && !Inv.find(u.inv, 'keys')) return false;
    return true;
  }

  drive(tx, ty) {
    this.mark(false);
    const p = findPath(this.x, this.y, tx, ty, { wide: true, avoidMines: true });
    if (!p) { this.mark(true); return false; }
    this.path = p; return true;
  }

  damage(n, G, msg) {
    this.hp -= n;
    if (this.hp <= 0 && this.alive) this.destroy(G, msg || 'El vehículo ha sido destruido con el escuadrón dentro.');
  }

  destroy(G, msg) {
    this.alive = false; this.path = []; this.mark(false);
    FX.explosion(this.x, this.y, 3); Sfx.play('boom', this.x, this.y);
    for (const u of this.occupants()) { u.inVehicle = null; u.damage(999, G, msg); }
    this.driver = null; this.passengers = [];
  }

  update(dt, G) {
    if (!this.alive) return;
    const was = this.moving;
    this.moving = false;
    if (this.driver && this.path.length) {
      const sp = this.T.speed * (this.path.length > 1 ? 1 : 0.8);
      this.moving = stepAlong(this, sp, dt);
      if (this.moving) {
        this.face = turnToward(this.face, this.moveAng, 3.2 * dt);
        this.noiseT -= dt; if (this.noiseT <= 0) { G.noise(this.x, this.y, NOISE.engine); this.noiseT = 0.6; }
        const mn = Level.mines.length && Level.mineAt(Math.floor(this.x), Math.floor(this.y));
        if (mn) { mn.dead = true; G.explode(mn.x, mn.y, 1.5, NOISE.explosion); this.destroy(G, 'El vehículo ha pisado una mina.'); return; }
      }
    }
    if (was && !this.moving) this.mark(true);
    for (const u of this.occupants()) { u.x = this.x; u.y = this.y; }
  }
}
