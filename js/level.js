'use strict';
// Mapa, colisiones, línea de visión y búsqueda de caminos.
//
// Leyenda de casillas:
//  .  hierba     ,  tierra     r  carretera   =  suelo de edificio
//  #  pared      D  puerta     f  valla       T  arbusto (esconde)
//  B  depósito   R  roca (borde)  s  suelo quemado

const Level = {
  W: 64, H: 44,
  grid: [],
  depot: { x: 57.5, y: 31.5, destroyed: false },
  exit: { x0: 2, y0: 2, x1: 7, y1: 7 },
  startPositions: [[3.5, 39.5], [5.5, 39.5], [3.5, 41.5], [5.5, 41.5]],

  build() {
    const W = this.W, H = this.H, rng = mulberry32(1944);
    const g = [];
    for (let y = 0; y < H; y++) g.push(new Array(W).fill('.'));
    this.grid = g;
    this.depot.destroyed = false;

    const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c; };
    const get = (x, y) => g[y][x];

    // manchas de tierra
    for (let i = 0; i < 40; i++) {
      const cx = (rng() * W) | 0, cy = (rng() * H) | 0, r = 1 + ((rng() * 3) | 0);
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
        if (dx * dx + dy * dy <= r * r) set(cx + dx, cy + dy, ',');
    }
    // carreteras
    for (let x = 0; x < W; x++) { set(x, 22, 'r'); set(x, 23, 'r'); }
    for (let y = 0; y < H; y++) { set(30, y, 'r'); set(31, y, 'r'); }

    // valla del complejo enemigo (puerta en la carretera)
    for (let x = 36; x <= 61; x++) { set(x, 6, 'f'); set(x, 40, 'f'); }
    for (let y = 6; y <= 40; y++) { set(36, y, 'f'); set(61, y, 'f'); }
    set(36, 22, 'r'); set(36, 23, 'r');
    for (let x = 36; x <= 61; x++) if (get(x, 22) === 'f') set(x, 22, 'r');
    for (let x = 37; x <= 60; x++) { set(x, 22, 'r'); set(x, 23, 'r'); }

    const building = (x, y, w, h, dx, dy) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1;
        set(x + i, y + j, edge ? '#' : '=');
      }
      set(dx, dy, 'D');
    };
    building(40, 8, 10, 7, 44, 14);   // cuartel
    building(52, 10, 8, 8, 52, 14);   // mando
    building(38, 26, 6, 5, 40, 26);   // caseta
    building(46, 30, 7, 6, 46, 32);   // almacén
    building(10, 10, 6, 5, 12, 14);   // cabaña norte
    building(14, 30, 7, 5, 16, 30);   // cabaña sur

    // depósito de combustible 3x3
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) set(56 + i, 30 + j, 'B');

    // borde de roca
    for (let x = 0; x < W; x++) { set(x, 0, 'R'); set(x, H - 1, 'R'); }
    for (let y = 0; y < H; y++) { set(0, y, 'R'); set(W - 1, y, 'R'); }

    // arbustos
    const bushAt = (cx, cy, r, n) => {
      for (let i = 0; i < n; i++) {
        const a = rng() * 6.283, d = rng() * r;
        const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d * 0.8);
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
        if (x >= this.exit.x0 - 1 && x <= this.exit.x1 + 1 && y >= this.exit.y0 - 1 && y <= this.exit.y1 + 1) continue;
        if (y > 36 && x < 9) continue; // zona de inicio libre
        if (get(x, y) === '.' || get(x, y) === ',') set(x, y, 'T');
      }
    };
    [[8, 6, 5, 14], [22, 12, 5, 16], [26, 32, 5, 14], [12, 24, 3, 8], [46, 3, 4, 8], [10, 38, 3, 6],
     [34, 16, 2.5, 10], [34, 29, 2.5, 10], [20, 30, 3, 8], [4, 22, 3, 7], [26, 8, 3, 8], [62, 22, 1, 2]]
      .forEach(a => bushAt(...a));
  },

  at(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return 'R';
    return this.grid[ty][tx];
  },
  solid(tx, ty) { const c = this.at(tx, ty); return c === '#' || c === 'f' || c === 'B' || c === 'R'; },
  opaque(tx, ty) { const c = this.at(tx, ty); return c === '#' || c === 'B' || c === 'R'; },
  tall(tx, ty) { const c = this.at(tx, ty); return c === '#' || c === 'B' || c === 'R'; },
  isBush(x, y) { return this.at(Math.floor(x), Math.floor(y)) === 'T'; },
  inExit(x, y) { const e = this.exit; return x >= e.x0 && x <= e.x1 && y >= e.y0 && y <= e.y1; },

  los(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / 0.2);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.opaque(Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t))) return false;
    }
    return true;
  },

  // Distancia hasta la primera pared siguiendo un ángulo (para dibujar conos)
  rayLength(x, y, ang, max) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    for (let d = 0.15; d < max; d += 0.15) {
      if (this.opaque(Math.floor(x + dx * d), Math.floor(y + dy * d))) return d;
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
