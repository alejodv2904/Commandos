'use strict';
// Mapa, colisiones, línea de visión y búsqueda de caminos.
//
// Leyenda de casillas:
//  .  hierba     ,  tierra     r  carretera   =  suelo de edificio
//  #  pared      D  puerta     f  valla       T  arbusto (esconde)
//  B  depósito   R  roca (borde)  s  suelo quemado

const Level = {
  W: 64, H: 44,
  grid: [], floor: [],
  buildings: [], props: [], trees: [], border: [], rocks: [],
  depot: { x: 57.5, y: 31.5, destroyed: false },
  exit: { x0: 2, y0: 2, x1: 7, y1: 7 },
  startPositions: [],
  loot: [], mines: [], interacts: [], lights: [], spots: [], vehicles: [], targets: [], smokes: [], towers: [], doorFrom: {}, indoor: false,
  snow: false, prints: [], bridges: {},
  borderStyle: 'forest',

  // Rejilla lógica:
  //  .  transitable   T  arbusto (esconde)   P  árbol      #  pared        =  suelo interior
  //  D  puerta        L  puerta cerrada con llave         f  alambrada     W  agua
  //  C  acantilado o muro escalable (solo el Ladrón)      X  muro que se puede volar
  //  B  depósito      R  borde       c  cajas  g  sacos  o  bidones  v  vehículo  n  tienda  k  torre
  //  V  vehículo aparcado (conducible)  Q  torre de agua  l  farola  q  roca  Z  maquinaria  s  ruinas
  //  H  rejilla estrecha (solo el perro)   K  armario metálico (esconde cuerpos)
  // Suelo: g hierba, d tierra, a arena, y grava, r camino, p tablones, w agua, b puente, m bosque, k hormigón interior

  // Construye el mapa de una misión: reinicia todo y llama al constructor de la misión
  build(M) {
    M = M || MISSIONS_BY_ID.classic;
    const W = this.W = M.W || 64, H = this.H = M.H || 44;
    this.grid = []; this.floor = [];
    for (let y = 0; y < H; y++) { this.grid.push(new Array(W).fill('.')); this.floor.push(new Array(W).fill(M.baseFloor || 'g')); }
    this.depot.destroyed = false;
    this.buildings = []; this.props = []; this.trees = []; this.border = []; this.rocks = [];
    this.loot = []; this.mines = []; this.interacts = []; this.lights = []; this.spots = []; this.vehicles = []; this.targets = []; this.smokes = []; this.towers = []; this.doorFrom = {};
    this.snow = !!M.snow; this.prints = []; this.bridges = {};
    this.indoor = !!(WEATHER[M.weather] && WEATHER[M.weather].indoor);
    this.borderStyle = M.border || 'forest';
    this.exit = Object.assign({}, M.exit);
    this.startPositions = M.squad.map(s => [s.x, s.y]);
    const api = this.api(M);
    M.build(api);
    api.finish();
  },

  // Herramientas para los constructores de misiones
  api(M) {
    const L = this, rng = mulberry32(M.seed || 1944);
    const W = L.W, H = L.H, g = L.grid, f = L.floor;
    const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const A = {
      rng, W, H,
      setG(x, y, c) { if (inb(x, y)) g[y][x] = c; },
      setF(x, y, c) { if (inb(x, y)) f[y][x] = c; },
      getG(x, y) { return inb(x, y) ? g[y][x] : 'R'; },
      getF(x, y) { return inb(x, y) ? f[y][x] : 'm'; },
      rectF(x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) A.setF(x, y, c); },
      rectG(x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) A.setG(x, y, c); },
      noiseF(c, freq, thr, ox, oy) { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Noise.fbm(x * freq + (ox || 5), y * freq + (oy || 9), 3) > thr) f[y][x] = c; },
      // edificio: puerta en la fachada sur (o la indicada con door: {x, y})
      building(x, y, w, h, opt) {
        opt = opt || {};
        const door = opt.door || { x: x + Math.floor(w / 2), y: y + h - 1 };
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1;
          A.setG(x + i, y + j, edge ? '#' : '='); A.setF(x + i, y + j, 'p');
        }
        if (!opt.noDoor) A.setG(door.x, door.y, opt.locked ? 'L' : 'D');
        const b = Object.assign({ x, y, w, h, door, facade: 'plaster', roof: 'slate', H: 1.3, R: 0.7, furn: 'house' }, opt);
        L.buildings.push(b); return b;
      },
      prop(type, x, y, w, h, ch, extra) {
        if (ch) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) A.setG(x + i, y + j, ch);
        const p = Object.assign({ type, x, y, w, h, seed: (x * 7 + y * 13) % 97 }, extra || {});
        L.props.push(p); return p;
      },
      fenceLine(x0, y0, x1, y1) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) A.setG(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 'f'); },
      bushes(list) {
        for (const [cx, cy, r, n] of list) for (let i = 0; i < n; i++) {
          const a = rng() * 6.283, d = rng() * r;
          const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d * 0.8);
          if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || A.reserved(x, y)) continue;
          if (g[y][x] === '.' && 'gdma'.includes(f[y][x])) g[y][x] = 'T';
        }
      },
      wall(x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) A.setG(x, y, '#'); },
      // abre un vano en un muro: 'D' puerta, 'L' cerrada con llave, 'H' rejilla (perro), 'C' muro escalable
      gap(x, y, kind, opt) { A.setG(x, y, kind); if (opt && opt.from) L.doorFrom[x + ',' + y] = opt.from; },
      // puente colgante: tablones sobre el abismo (se puede cortar)
      bridge(id, x0, y0, x1, y1) {
        const cells = [];
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { A.setG(x, y, '.'); A.setF(x, y, 'b'); cells.push([x, y]); }
        L.bridges[id] = { id, cells, cut: false };
      },
      locker(x, y) { A.setG(x, y, 'K'); L.props.push({ type: 'locker', x, y, w: 1, h: 1, seed: (x * 7 + y * 13) % 97 }); },
      rock(x, y, s) { A.setG(Math.floor(x), Math.floor(y), 'q'); L.rocks.push({ x, y, s: s || 1, v: (rng() * 6) | 0 }); },
      loot(name, x, y, items, extra) { const l = Object.assign({ name, x, y, items }, extra || {}); L.loot.push(l); return l; },
      interact(id, name, x, y, opt) { const it = Object.assign({ id, name, x, y, time: 3, done: false }, opt || {}); L.interacts.push(it); return it; },
      light(x, y, opt) { const l = Object.assign({ x, y, r: 3.5, h: 3, color: 0xffd9a0 }, opt || {}); L.lights.push(l); return l; },
      spot(x, y, opt) { const s = Object.assign({ x, y, a0: 0, a1: 3.14, dist: 6, r: 2.0, speed: 0.35 }, opt || {}); L.spots.push(s); return s; },
      vehicle(type, x, y, face, opt) { const v = Object.assign({ type, x, y, face }, opt || {}); L.vehicles.push(v); return v; },
      mine(x, y) { L.mines.push({ x: x + 0.5, y: y + 0.5, revealed: false, dead: false }); },
      target(id, prop, opt) { const t = Object.assign({ id, prop, destroyed: false }, opt || {}); L.targets.push(t); return t; },
      reserved(x, y) {
        const e = L.exit;
        if (x >= e.x0 - 1 && x <= e.x1 + 1 && y >= e.y0 - 1 && y <= e.y1 + 1) return true;
        return L.startPositions.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 3.5);
      },
      // al final: borde del mapa y árboles o rocas
      finish() {
        if (M.borderDone) return;
        for (let x = 0; x < W; x++) { A.setG(x, 0, 'R'); A.setG(x, H - 1, 'R'); A.setF(x, 0, 'm'); A.setF(x, H - 1, 'm'); }
        for (let y = 0; y < H; y++) { A.setG(0, y, 'R'); A.setG(W - 1, y, 'R'); A.setF(0, y, 'm'); A.setF(W - 1, y, 'm'); }
        for (const e of [L.exit]) for (let y = e.y0; y <= e.y1; y++) for (let x = e.x0; x <= e.x1; x++) if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { A.setG(x, y, '.'); }
        const pt = () => rng() < 0.5;
        for (let x = -0.5; x < W + 1; x += 1.25 + rng() * 0.5) {
          L.border.push({ x: x + rng() * 0.4, y: 0.2 + rng() * 0.5, pine: pt(), v: (rng() * 6) | 0 });
          L.border.push({ x: x + rng() * 0.4, y: H + 1.3 + rng() * 0.3, pine: pt(), v: (rng() * 6) | 0 });
        }
        for (let y = 1; y < H; y += 1.25 + rng() * 0.5) {
          L.border.push({ x: 0.1 + rng() * 0.4, y: y + rng() * 0.4, pine: pt(), v: (rng() * 6) | 0 });
          L.border.push({ x: W - 0.3 + rng() * 0.4, y: y + rng() * 0.4, pine: pt(), v: (rng() * 6) | 0 });
        }
        // no tapar la salida
        const e = L.exit; L.border = L.border.filter(t => !(t.x > e.x0 - 1.5 && t.x < e.x1 + 2.5 && t.y > e.y0 - 1.5 && t.y < e.y1 + 2.5));
        if (!M.trees) return;
        const segs = [];
        for (const d of M.enemies) { const pts = d.patrol; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; segs.push([a.x, a.y, b.x, b.y]); } }
        const segDist = (px, py, s) => { const [ax, ay, bx, by] = s, dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy; const t = l ? clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0; return Math.hypot(px - ax - dx * t, py - ay - dy * t); };
        const okTree = (x, y) => {
          if (x < 2 || y < 3 || x > W - 3 || y > H - 3) return false;
          if (M.noTrees && M.noTrees.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d)) return false;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!'.T'.includes(g[y + dy][x + dx])) return false; if (!'gdma'.includes(f[y + dy][x + dx])) return false; }
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const ff = f[clamp(y + dy, 0, H - 1)][clamp(x + dx, 0, W - 1)]; if ('rwbpy'.includes(ff)) return false; }
          if (A.reserved(x, y) || segs.some(s => segDist(x + 0.5, y + 0.5, s) < 2.2)) return false;
          return !L.trees.some(t => Math.hypot(t.x - x - 0.5, t.y - y - 0.5) < 2.6);
        };
        for (let i = 0; i < 900 && L.trees.length < M.trees; i++) {
          const x = 1 + ((rng() * (W - 2)) | 0), y = 1 + ((rng() * (H - 2)) | 0);
          if (!okTree(x, y)) continue;
          g[y][x] = 'P'; L.trees.push({ x: x + 0.5, y: y + 0.5, pine: rng() < (M.pines || 0.4), v: (rng() * 6) | 0 });
        }
      }
    };
    return A;
  },

  // Corta un puente: las casillas pasan a ser abismo y quien esté encima cae
  cutBridge(id) {
    const b = this.bridges[id]; if (!b || b.cut) return [];
    b.cut = true;
    for (const [x, y] of b.cells) { this.grid[y][x] = 'Y'; this.floor[y][x] = 'h'; }
    return b.cells;
  },
  at(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return 'R';
    return this.grid[ty][tx];
  },
  floorAt(tx, ty) {
    tx = clamp(tx, 0, this.W - 1); ty = clamp(ty, 0, this.H - 1);
    return this.floor[ty][tx];
  },
  // _fl: banderas de la búsqueda de caminos en curso { climb, wide, avoidMines }
  _fl: null,
  solid(tx, ty) {
    const c = this.at(tx, ty);
    if (c === 'C') return !(this._fl && this._fl.climb);
    if (c === 'H') return !(this._fl && this._fl.small);
    if ('#fBRWcgovnkPLXVQlqZKY'.includes(c)) return true;
    const fl = this._fl;
    if (fl && fl.avoidMines && this.mines.length && this.mineAt(tx, ty, true)) return true;
    if (fl && fl.wide) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const n = this.at(tx + dx, ty + dy); if ('#BRWcgovnkPLXQqZTCVKH'.includes(n)) return true; } } // las alambradas no impiden el paso de un vehículo
    return false;
  },
  opaque(tx, ty) { return '#BRvnPLXVqZKC'.includes(this.at(tx, ty)); },
  mineAt(tx, ty, onlyRevealed) { return this.mines.find(m => !m.dead && Math.floor(m.x) === tx && Math.floor(m.y) === ty && (!onlyRevealed || m.revealed)) || null; },
  inSmoke(x, y) { return this.smokes.some(s => s.t > 0 && Math.hypot(s.x - x, s.y - y) < s.r); },
  isWall(tx, ty) { return this.at(tx, ty) === '#'; },
  isBush(x, y) { return this.at(Math.floor(x), Math.floor(y)) === 'T'; },
  inExit(x, y) { const e = this.exit; return x >= e.x0 && x <= e.x1 + 1 && y >= e.y0 && y <= e.y1 + 1; },
  buildingAt(x, y) { return this.buildings.find(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) || null; },

  // Línea de visión: la cortan muros, vehículos, árboles y arbustos densos
  // (el arbusto en el que está el observador o el observado no cuenta).
  // high: alguno de los dos está en alto (torre, azotea): solo bloquea el humo
  los(x0, y0, x1, y1, high) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 0.2);
    const sx = Math.floor(x0), sy = Math.floor(y0), ex = Math.floor(x1), ey = Math.floor(y1);
    const smoke = this.smokes.length > 0;
    for (let i = 1; i < n; i++) {
      const t = i / n, px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t, tx = Math.floor(px), ty = Math.floor(py);
      if (smoke && this.inSmoke(px, py)) return false;
      if (high) continue;
      if (this.opaque(tx, ty)) return false;
      if (this.at(tx, ty) === 'T' && !(tx === sx && ty === sy) && !(tx === ex && ty === ey)) return false;
    }
    return true;
  },

  rayLength(x, y, ang, max, high) {
    const dx = Math.cos(ang), dy = Math.sin(ang), sx = Math.floor(x), sy = Math.floor(y), smoke = this.smokes.length > 0;
    for (let d = 0.15; d < max; d += 0.15) {
      const px = x + dx * d, py = y + dy * d, tx = Math.floor(px), ty = Math.floor(py);
      if (smoke && this.inSmoke(px, py)) return d;
      if (high) continue;
      if (this.opaque(tx, ty)) return d;
      if (this.at(tx, ty) === 'T' && !(tx === sx && ty === sy)) return d + 0.5;
    }
    return max;
  },

  // Destruye un objetivo: sus casillas pasan a ser escombros transitables
  destroyTarget(t) {
    t.destroyed = true;
    const p = t.prop; p.destroyed = true;
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) this.grid[p.y + j][p.x + i] = 's';
    if (t.id === 'depot') this.depot.destroyed = true;
  },
  destroyDepot() { const t = this.targets.find(t => t.id === 'depot'); if (t) this.destroyTarget(t); },

  nearestFree(tx, ty, maxR, pref) {
    pref = pref || { x: tx, y: ty };
    for (let r = 1; r <= maxR; r++) {
      let best = null, bd = 1e9;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = tx + dx, y = ty + dy;
        if (this.solid(x, y)) continue;
        const d = Math.hypot(x - pref.x, y - pref.y);
        if (d < bd) { bd = d; best = { x, y }; }
      }
      if (best) return best;
    }
    return null;
  }
};

function clearLine(ax, ay, bx, by) {
  const d = Math.hypot(bx - ax, by - ay);
  if (d < 0.001) return true;
  const px = -(by - ay) / d * 0.3, py = (bx - ax) / d * 0.3;
  const n = Math.ceil(d / 0.25);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
    if (Level.solid(Math.floor(x), Math.floor(y))) return false;
    if (Level.solid(Math.floor(x + px), Math.floor(y + py))) return false;
    if (Level.solid(Math.floor(x - px), Math.floor(y - py))) return false;
  }
  return true;
}

// A* en rejilla de 8 direcciones con suavizado. Coordenadas en casillas (float).
function findPath(sx, sy, gx, gy, fl) {
  Level._fl = fl || null;
  try { return findPath_(sx, sy, gx, gy); } finally { Level._fl = null; }
}
function findPath_(sx, sy, gx, gy) {
  const W = Level.W, H = Level.H;
  let s = { x: Math.floor(sx), y: Math.floor(sy) };
  let g = { x: Math.floor(gx), y: Math.floor(gy) };
  if (Level.solid(s.x, s.y)) { s = Level.nearestFree(s.x, s.y, 4); if (!s) return null; }
  const exact = !Level.solid(g.x, g.y);
  if (!exact) { g = Level.nearestFree(g.x, g.y, 8, s); if (!g) return null; }
  const goal = exact ? { x: gx, y: gy } : { x: g.x + 0.5, y: g.y + 0.5 };
  if (s.x === g.x && s.y === g.y) return [goal];

  const N = W * H;
  const gs = new Float32Array(N).fill(1e9), par = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = new MinHeap();
  const si = s.y * W + s.x, gi = g.y * W + g.x;
  gs[si] = 0; heap.push(0, si);
  const h = (x, y) => { const dx = Math.abs(x - g.x), dy = Math.abs(y - g.y); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  let found = false;
  while (heap.size) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === gi) { found = true; break; }
    const cx = cur % W, cy = (cur / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || Level.solid(nx, ny)) continue;
      if (dx && dy && (Level.solid(cx + dx, cy) || Level.solid(cx, cy + dy))) continue;
      const ni = ny * W + nx;
      if (closed[ni]) continue;
      const cost = (dx && dy ? 1.414 : 1) * (Level.at(nx, ny) === 'T' ? 1.6 : 1);
      const ng = gs[cur] + cost;
      if (ng < gs[ni]) { gs[ni] = ng; par[ni] = cur; heap.push(ng + h(nx, ny), ni); }
    }
  }
  if (!found) return null;
  const pts = [];
  for (let c = gi; c !== -1; c = par[c]) pts.push({ x: (c % W) + 0.5, y: ((c / W) | 0) + 0.5 });
  pts.reverse();
  pts[0] = { x: sx, y: sy };
  pts[pts.length - 1] = goal;
  // suavizado voraz
  const out = [];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !clearLine(pts[i].x, pts[i].y, pts[j].x, pts[j].y)) j--;
    out.push(pts[j]); i = j;
  }
  return out;
}

// Avanza una entidad por su ruta. Devuelve true si se movió.
function stepAlong(ent, speed, dt) {
  let rem = speed * dt, moved = false;
  while (rem > 1e-6 && ent.path && ent.path.length) {
    const p = ent.path[0], dx = p.x - ent.x, dy = p.y - ent.y, d = Math.hypot(dx, dy);
    if (d <= rem) { ent.x = p.x; ent.y = p.y; ent.path.shift(); rem -= d; moved = true; if (d > 1e-6) ent.moveAng = Math.atan2(dy, dx); }
    else { ent.x += dx / d * rem; ent.y += dy / d * rem; ent.moveAng = Math.atan2(dy, dx); rem = 0; moved = true; }
  }
  return moved;
}
