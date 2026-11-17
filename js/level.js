'use strict';
// Mapa, colisiones, línea de visión y búsqueda de caminos.
//
// Leyenda de casillas:
//  .  hierba     ,  tierra     r  carretera   =  suelo de edificio
//  #  pared      D  puerta     f  valla       T  arbusto (esconde)
//  B  depósito   R  roca (borde)  s  suelo quemado

const Level = {
  W: 64, H: 44,
  grid: [],      // lógica: colisión y visión
  floor: [],     // tipo de suelo para el dibujado
  buildings: [], props: [], trees: [], border: [],
  depot: { x: 57.5, y: 31.5, destroyed: false },
  exit: { x0: 2, y0: 2, x1: 7, y1: 7 },
  startPositions: [[2.5, 39.5], [4.5, 39.5], [2.5, 41.5], [4.5, 41.5]],
  loot: [],

  // Rejilla lógica:
  //  .  transitable   T  arbusto (esconde)   P  árbol (bloquea)    #  pared
  //  =  suelo interior D  puerta  f  alambrada  W  agua  B  depósito  R  borde
  //  c  cajas  g  sacos terreros  o  bidones  v  vehículo  n  tienda  k  torre  s  ruinas
  // Suelo: g hierba, d tierra, y grava, r camino, p tablones, w agua, b puente, m bosque

  build() {
    const W = this.W, H = this.H, rng = mulberry32(1944);
    this.grid = []; this.floor = [];
    for (let y = 0; y < H; y++) { this.grid.push(new Array(W).fill('.')); this.floor.push(new Array(W).fill('g')); }
    const g = this.grid, f = this.floor;
    const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const setG = (x, y, c) => { if (inb(x, y)) g[y][x] = c; };
    const setF = (x, y, c) => { if (inb(x, y)) f[y][x] = c; };
    this.depot.destroyed = false;
    this.buildings = []; this.props = []; this.trees = []; this.border = [];
    // objetos registrables con la acción Examinar (W)
    this.loot = [
      { name: 'Escritorio del oficial', x: 55.5, y: 13.6, items: [['docs', 1]], secondary: true },
      { name: 'Caja de suministros', x: 48.5, y: 32.0, items: [['grenade', 2], ['medkit', 3]] },
      { name: 'Arcón de la granja', x: 11.6, y: 11.6, items: [['rope', 2], ['wine', 1]] }
    ];

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (Noise.fbm(x * 0.13 + 5, y * 0.13 + 9, 3) > 0.6) f[y][x] = 'd';

    // caminos
    for (let x = 0; x < W; x++) { setF(x, 22, 'r'); setF(x, 23, 'r'); }
    for (let y = 0; y < H; y++) { setF(30, y, 'r'); setF(31, y, 'r'); }
    for (let y = 15; y <= 21; y++) { setF(12, y, 'd'); setF(13, y, 'd'); }
    for (let x = 6; x <= 17; x++) { setF(x, 36 + (x > 11 ? 1 : 0), 'd'); }

    // patio del complejo
    for (let y = 7; y <= 39; y++) for (let x = 37; x <= 60; x++) if (f[y][x] !== 'r') setF(x, y, 'y');

    // río serpenteante con tres puentes
    for (let y = 1; y < H - 1; y++) {
      const cx = 22.5 + Math.sin(y * 0.25) * 1.5;
      for (let x = 0; x < W; x++) if (Math.abs(x + 0.5 - cx) < 1.3) { setF(x, y, 'w'); setG(x, y, 'W'); }
    }
    for (const [a, b] of [[5, 6], [22, 23], [37, 38]])
      for (let y = a; y <= b; y++) for (let x = 17; x <= 28; x++) if (f[y][x] === 'w') { setF(x, y, 'b'); setG(x, y, '.'); }

    // alambrada con puertas en el camino
    for (let x = 36; x <= 61; x++) { setG(x, 6, 'f'); setG(x, 40, 'f'); }
    for (let y = 6; y <= 40; y++) { setG(36, y, 'f'); setG(61, y, 'f'); }
    for (const y of [22, 23]) { setG(36, y, '.'); setG(61, y, '.'); }

    // edificios (puerta siempre en la fachada sur)
    const B = (x, y, w, h, opt) => {
      const door = { x: x + Math.floor(w / 2), y: y + h - 1 };
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1;
        setG(x + i, y + j, edge ? '#' : '='); setF(x + i, y + j, 'p');
      }
      setG(door.x, door.y, 'D');
      this.buildings.push(Object.assign({ x, y, w, h, door }, opt));
    };
    B(40, 8, 10, 7, { name: 'Cuartel', facade: 'wood', roof: 'metal', H: 1.25, R: 0.35, furn: 'bunks' });
    B(52, 10, 8, 8, { name: 'Puesto de mando', facade: 'plaster', roof: 'terracotta', H: 1.7, R: 0.95, furn: 'office', chimney: true });
    B(38, 26, 6, 5, { name: 'Caseta', facade: 'brick', roof: 'slate', H: 1.15, R: 0.6, furn: 'guard' });
    B(46, 30, 7, 6, { name: 'Almacén', facade: 'concrete', roof: 'metal', H: 1.5, R: 0.3, furn: 'storage' });
    B(10, 10, 6, 5, { name: 'Granja', facade: 'timber', roof: 'terracotta', H: 1.3, R: 0.8, furn: 'house', chimney: true });
    B(14, 30, 7, 5, { name: 'Cabaña', facade: 'timber', roof: 'slate', H: 1.2, R: 0.7, furn: 'house' });

    // depósito de combustible
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) setG(56 + i, 30 + j, 'B');
    this.props.push({ type: 'depot', x: 56, y: 30, w: 3, h: 3 });

    // objetos
    const P = (type, x, y, w, h, ch) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) setG(x + i, y + j, ch);
      this.props.push({ type, x, y, w, h, seed: (x * 7 + y * 13) % 97 });
    };
    P('truck', 38, 19, 4, 2, 'v');
    P('truck', 49, 24, 4, 2, 'v');
    P('tent', 56, 24, 3, 3, 'n');
    P('tower', 58, 7, 2, 2, 'k');
    P('tower', 37, 37, 2, 2, 'k');
    P('jeep', 3, 2, 3, 2, 'v');
    for (const [x, y] of [[33, 20], [33, 21], [33, 24], [33, 25], [59, 26], [60, 26]]) P('sandbag', x, y, 1, 1, 'g');
    for (const [x, y] of [[54, 31], [54, 32], [47, 27], [48, 27], [47, 28], [15, 15], [16, 15], [42, 16]]) P('crate', x, y, 1, 1, 'c');
    for (const [x, y] of [[59, 31], [59, 32], [60, 32], [43, 21], [12, 34]]) P('barrels', x, y, 1, 1, 'o');

    // borde: bosque denso
    for (let x = 0; x < W; x++) { setG(x, 0, 'R'); setG(x, H - 1, 'R'); setF(x, 0, 'm'); setF(x, H - 1, 'm'); }
    for (let y = 0; y < H; y++) { setG(0, y, 'R'); setG(W - 1, y, 'R'); setF(0, y, 'm'); setF(W - 1, y, 'm'); }
    for (let x = -0.5; x < W + 1; x += 1.25 + rng() * 0.5) {
      this.border.push({ x: x + rng() * 0.4, y: 0.2 + rng() * 0.5, pine: rng() < 0.5, v: (rng() * 6) | 0 });
      this.border.push({ x: x + rng() * 0.4, y: H + 1.3 + rng() * 0.3, pine: rng() < 0.5, v: (rng() * 6) | 0 });
    }
    for (let y = 1; y < H; y += 1.25 + rng() * 0.5) {
      this.border.push({ x: 0.1 + rng() * 0.4, y: y + rng() * 0.4, pine: rng() < 0.5, v: (rng() * 6) | 0 });
      this.border.push({ x: W - 0.3 + rng() * 0.4, y: y + rng() * 0.4, pine: rng() < 0.5, v: (rng() * 6) | 0 });
    }

    // zonas que deben quedar despejadas
    const segs = [];
    for (const d of ENEMY_DEFS) {
      const pts = d.patrol;
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; segs.push([a.x, a.y, b.x, b.y]); }
    }
    const segDist = (px, py, s) => {
      const [ax, ay, bx, by] = s, dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
      const t = l ? clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0;
      return Math.hypot(px - ax - dx * t, py - ay - dy * t);
    };
    const nearPatrol = (x, y, r) => segs.some(s => segDist(x, y, s) < r);
    const reserved = (x, y) =>
      (x >= this.exit.x0 - 1 && x <= this.exit.x1 + 1 && y >= this.exit.y0 - 1 && y <= this.exit.y1 + 1) ||
      (y > 36 && x < 9);

    // arbustos
    const bushAt = (cx, cy, r, n) => {
      for (let i = 0; i < n; i++) {
        const a = rng() * 6.283, d = rng() * r;
        const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d * 0.8);
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || reserved(x, y)) continue;
        if (g[y][x] === '.' && (f[y][x] === 'g' || f[y][x] === 'd')) g[y][x] = 'T';
      }
    };
    [[8, 6, 5, 14], [26, 12, 4, 12], [26, 32, 5, 14], [12, 24, 3, 8], [46, 3, 4, 8], [10, 38, 3, 6],
     [34, 16, 2.5, 10], [34, 29, 2.5, 10], [18, 28, 3, 8], [4, 22, 3, 7], [27, 7, 3, 8], [16, 6, 3, 6]]
      .forEach(a => bushAt(...a));

    // árboles grandes
    const okTree = (x, y) => {
      if (x < 2 || y < 3 || x > W - 3 || y > H - 3) return false;
      if (x >= 35 && x <= 62 && y >= 5 && y <= 41) return false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (g[y + dy][x + dx] !== '.' && g[y + dy][x + dx] !== 'T') return false;
        if (f[y + dy][x + dx] !== 'g' && f[y + dy][x + dx] !== 'd') return false;
      }
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const ff = f[clamp(y + dy, 0, H - 1)][clamp(x + dx, 0, W - 1)];
        if (ff === 'r' || ff === 'w' || ff === 'b' || ff === 'p') return false;
      }
      if (reserved(x, y) || nearPatrol(x + 0.5, y + 0.5, 2.2)) return false;
      return !this.trees.some(t => Math.hypot(t.x - x - 0.5, t.y - y - 0.5) < 2.6);
    };
    for (let i = 0; i < 900 && this.trees.length < 46; i++) {
      const x = 1 + ((rng() * (W - 2)) | 0), y = 1 + ((rng() * (H - 2)) | 0);
      if (!okTree(x, y)) continue;
      g[y][x] = 'P';
      this.trees.push({ x: x + 0.5, y: y + 0.5, pine: rng() < 0.4, v: (rng() * 6) | 0 });
    }
  },

  at(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return 'R';
    return this.grid[ty][tx];
  },
  floorAt(tx, ty) {
    tx = clamp(tx, 0, this.W - 1); ty = clamp(ty, 0, this.H - 1);
    return this.floor[ty][tx];
  },
  solid(tx, ty) { return '#fBRWcgovnkP'.includes(this.at(tx, ty)); },
  opaque(tx, ty) { return '#BRvnP'.includes(this.at(tx, ty)); },
  isWall(tx, ty) { return this.at(tx, ty) === '#'; },
  isBush(x, y) { return this.at(Math.floor(x), Math.floor(y)) === 'T'; },
  inExit(x, y) { const e = this.exit; return x >= e.x0 && x <= e.x1 + 1 && y >= e.y0 && y <= e.y1 + 1; },
  buildingAt(x, y) { return this.buildings.find(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) || null; },

  // Línea de visión: la cortan muros, vehículos, árboles y arbustos densos
  // (el arbusto en el que está el observador o el observado no cuenta).
  los(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 0.2);
    const sx = Math.floor(x0), sy = Math.floor(y0), ex = Math.floor(x1), ey = Math.floor(y1);
    for (let i = 1; i < n; i++) {
      const t = i / n, tx = Math.floor(x0 + (x1 - x0) * t), ty = Math.floor(y0 + (y1 - y0) * t);
      if (this.opaque(tx, ty)) return false;
      if (this.at(tx, ty) === 'T' && !(tx === sx && ty === sy) && !(tx === ex && ty === ey)) return false;
    }
    return true;
  },

  rayLength(x, y, ang, max) {
    const dx = Math.cos(ang), dy = Math.sin(ang), sx = Math.floor(x), sy = Math.floor(y);
    for (let d = 0.15; d < max; d += 0.15) {
      const tx = Math.floor(x + dx * d), ty = Math.floor(y + dy * d);
      if (this.opaque(tx, ty)) return d;
      if (this.at(tx, ty) === 'T' && !(tx === sx && ty === sy)) return d + 0.5;
    }
    return max;
  },

  destroyDepot() {
    this.depot.destroyed = true;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) this.grid[30 + j][56 + i] = 's';
  },

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
function findPath(sx, sy, gx, gy) {
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
