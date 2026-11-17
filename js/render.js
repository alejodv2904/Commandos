'use strict';
// Render con vista oblicua 3/4 al estilo Commandos 2.

// ---------------- PARTÍCULAS ----------------
const FX = {
  parts: [], emitters: [],
  reset() { this.parts = []; this.emitters = []; },
  add(p) { p.t = 0; p.z = p.z || 0; this.parts.push(p); if (this.parts.length > 1200) this.parts.shift(); },
  update(dt) {
    for (const e of this.emitters) { e.acc = (e.acc || 0) + dt * e.rate; while (e.acc >= 1) { e.acc--; e.fn(); } }
    for (const p of this.parts) {
      p.t += dt; p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; p.z += (p.vz || 0) * dt;
      if (p.g) { p.vz -= p.g * dt; if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.5; p.vy *= 0.5; } }
    }
    this.parts = this.parts.filter(p => p.t < p.life);
  },
  smoke(x, y, z, big, col) {
    this.add({ k: 'smoke', x, y, z, vx: 0.25 + (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.2, vz: 0.5 + Math.random() * 0.5,
      life: 2.5 + Math.random() * 2, size: (big ? 0.5 : 0.22) + Math.random() * 0.3, grow: big ? 0.8 : 0.45,
      c: typeof col === 'number' ? col : 35 + Math.random() * 45, rgb: typeof col === 'string' ? col : null });
  },
  fire(x, y, z) { this.add({ k: 'fire', x: x + (Math.random() - 0.5) * 0.5, y: y + (Math.random() - 0.5) * 0.3, z, vz: 1 + Math.random(), vx: (Math.random() - 0.5) * 0.3, life: 0.4 + Math.random() * 0.5, size: 0.25 + Math.random() * 0.25 }); },
  explosion(x, y, r) {
    this.add({ k: 'flash', x, y, z: 0.5, life: 0.18, size: r * 1.3 });
    this.add({ k: 'ring', x, y, life: 0.45, size: r * 1.4 });
    for (let i = 0; i < 26 * Math.min(2, r / 2); i++) {
      const a = Math.random() * 6.283, s = Math.random() * r * 1.4;
      this.add({ k: 'fire', x, y, z: 0.2, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: 0.5 + Math.random() * 2.5, life: 0.4 + Math.random() * 0.6, size: 0.3 + Math.random() * 0.4 });
    }
    for (let i = 0; i < 18 * Math.min(2, r / 2); i++) this.smoke(x + (Math.random() - 0.5) * r, y + (Math.random() - 0.5) * r * 0.6, Math.random() * 0.8, true);
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * 6.283, s = 1 + Math.random() * r;
      this.add({ k: 'debris', x, y, z: 0.3, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: 3 + Math.random() * 5, g: 14, life: 1.2 + Math.random() * 0.6 });
    }
  },
  muzzle(x, y, ang) { this.add({ k: 'flash', x: x + Math.cos(ang) * 0.45, y: y + Math.sin(ang) * 0.45, z: 0.42, life: 0.07, size: 0.35 }); },
  dust(x, y) { for (let i = 0; i < 4; i++) this.add({ k: 'smoke', x, y, z: 0.1, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.5, vz: 0.4, life: 0.6, size: 0.1, grow: 0.4, c: 120 }); },

  draw(ctx) {
    const T = TILE;
    for (const p of this.parts) {
      const q = p.t / p.life, sx = p.x * T, sy = (p.y - p.z) * T;
      if (p.k === 'smoke') {
        const rad = (p.size + p.t * p.grow) * T * 0.5;
        const al = (1 - q) * 0.42 * Math.min(1, p.t * 4);
        ctx.fillStyle = p.rgb ? `rgba(${p.rgb},${al})` : `rgba(${p.c | 0},${p.c | 0},${(p.c * 0.95) | 0},${al})`;
        ctx.beginPath(); ctx.arc(sx, sy, rad, 0, 7); ctx.fill();
      } else if (p.k === 'fire' || p.k === 'flash') {
        const rad = p.size * T * (p.k === 'flash' ? 1 : 1 - q * 0.5);
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
        g.addColorStop(0, `rgba(255,240,180,${1 - q})`); g.addColorStop(0.4, `rgba(255,140,30,${(1 - q) * 0.8})`); g.addColorStop(1, 'rgba(120,30,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, rad, 0, 7); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else if (p.k === 'debris') {
        ctx.fillStyle = '#231d16'; ctx.fillRect(sx - 2, sy - 2, 4, 3);
      } else if (p.k === 'ring') {
        ctx.strokeStyle = `rgba(255,230,180,${(1 - q) * 0.7})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(sx, sy, p.size * T * q, p.size * T * q * 0.55, 0, 0, 7); ctx.stroke();
      }
    }
  }
};

// ---------------- RENDER ----------------
const Render = {
  ground: null, oaks: [], pines: [], bushes: [], bldSpr: [], propSpr: [], statics: [], miniBase: null, open: [], time: 0,
  iconCache: {},

  init() {
    for (let v = 0; v < 6; v++) { this.oaks.push(Sprites.oak(v + 1)); this.pines.push(Sprites.pine(v + 1)); this.bushes.push(Sprites.bush(v + 1)); }
  },

  icon(id, s) {
    const key = id + s;
    if (!this.iconCache[key]) { const c = makeCanvas(s, s); Sprites.icon(c.getContext('2d'), id, s); this.iconCache[key] = c; }
    return this.iconCache[key];
  },

  bakeLevel() {
    this.bakeGround();
    this.bldSpr = Level.buildings.map(b => Sprites.building(b));
    this.propSpr = Level.props.map(p => Sprites.prop(p));
    this.buildStatics();
    this.bakeMini();
  },

  refreshDepot() {
    const i = Level.props.findIndex(p => p.type === 'depot');
    if (i >= 0) this.propSpr[i] = Sprites.prop(Level.props[i]);
    this.decal('scorch', Level.depot.x, Level.depot.y, 3.2);
    this.bakeMini();
  },

  // ---------- suelo ----------
  bakeGround() {
    const T = TILE, W = Level.W, H = Level.H, PW = W * T, PH = H * T;
    const c = this.ground || (this.ground = makeCanvas(PW, PH));
    c.width = PW; c.height = PH;
    const x = c.getContext('2d');
    const img = x.createImageData(PW, PH), d = img.data;
    const S = 2, NW = Math.ceil(PW / S) + 1, NH = Math.ceil(PH / S) + 1;
    const nA = new Float32Array(NW * NH), nB = new Float32Array(NW * NH), wX = new Float32Array(NW * NH), wY = new Float32Array(NW * NH);
    for (let j = 0; j < NH; j++) for (let i = 0; i < NW; i++) {
      const wx = i * S / T, wy = j * S / T, k = j * NW + i;
      nA[k] = Noise.fbm(wx * 0.22, wy * 0.22, 3); nB[k] = Noise.value(wx * 1.6 + 3, wy * 1.6 + 7);
      wX[k] = (Noise.value(wx * 0.9 + 31.7, wy * 0.9) - 0.5) * 0.9; wY[k] = (Noise.value(wx * 0.9, wy * 0.9 + 17.3) - 0.5) * 0.9;
    }
    const F = Level.floor, NAT = { g: 1, d: 1, m: 1 };
    const fl = (tx, ty) => (tx < 0 || ty < 0 || tx >= W || ty >= H) ? 'm' : F[ty][tx];
    const edge = (tx, ty, fx, fy, test) => {
      let m = 9;
      if (test(fl(tx - 1, ty))) m = Math.min(m, fx);
      if (test(fl(tx + 1, ty))) m = Math.min(m, 1 - fx);
      if (test(fl(tx, ty - 1))) m = Math.min(m, fy);
      if (test(fl(tx, ty + 1))) m = Math.min(m, 1 - fy);
      if (test(fl(tx - 1, ty - 1))) m = Math.min(m, Math.hypot(fx, fy));
      if (test(fl(tx + 1, ty - 1))) m = Math.min(m, Math.hypot(1 - fx, fy));
      if (test(fl(tx - 1, ty + 1))) m = Math.min(m, Math.hypot(fx, 1 - fy));
      if (test(fl(tx + 1, ty + 1))) m = Math.min(m, Math.hypot(1 - fx, 1 - fy));
      return m;
    };
    const isW = c => c === 'w', isR = c => c === 'r', notWater = c => c !== 'w' && c !== 'b';
    let i = 0;
    for (let py = 0; py < PH; py++) {
      const wy = py / T, ty = wy | 0, fy = wy - ty, jrow = ((py / S) | 0) * NW;
      for (let px = 0; px < PW; px++, i += 4) {
        const wx = px / T, tx = wx | 0, fx = wx - tx, k = jrow + ((px / S) | 0);
        let f = F[ty][tx];
        if (NAT[f]) {
          const ax = wx + wX[k], ay = wy + wY[k], t2x = ax | 0, t2y = ay | 0;
          if (ax >= 0 && ay >= 0 && t2x < W && t2y < H) { const f2 = F[t2y][t2x]; if (NAT[f2]) f = f2; }
        }
        const n1 = nA[k], n2 = nB[k], sp = Noise.hash(px, py);
        let r, g, b;
        switch (f) {
          case 'g': {
            const t = clamp(n1 * 1.3 - 0.18 + (n2 - 0.5) * 0.35, 0, 1);
            r = 58 + t * 52; g = 80 + t * 56; b = 30 + t * 22;
            const yl = smooth(0.6, 0.8, n1) * 0.45; r += (132 - r) * yl; g += (128 - g) * yl; b += (66 - b) * yl;
            if (sp > 0.94) { r += 16; g += 22; b += 6; } else if (sp < 0.07) { r -= 18; g -= 20; b -= 10; }
            break;
          }
          case 'm': r = 34 + n1 * 26; g = 48 + n1 * 28; b = 22 + n1 * 12; if (sp < 0.12) { r -= 10; g -= 10; } break;
          case 'd': {
            const t = clamp(n1 * 0.9 + (n2 - 0.5) * 0.5, 0, 1);
            r = 112 + t * 40; g = 90 + t * 32; b = 58 + t * 22;
            if (sp > 0.985) { r += 40; g += 36; b += 30; } else if (sp < 0.05) { r -= 16; g -= 14; b -= 10; }
            break;
          }
          case 'y': r = 118 + n2 * 22 + (sp - 0.5) * 34; g = 109 + n2 * 20 + (sp - 0.5) * 32; b = 88 + n2 * 18 + (sp - 0.5) * 28; break;
          case 'r': {
            const t = clamp(n1 * 0.8 + (n2 - 0.5) * 0.4, 0, 1);
            r = 150 + t * 24 + (sp - 0.5) * 22; g = 128 + t * 20 + (sp - 0.5) * 20; b = 90 + t * 16 + (sp - 0.5) * 16;
            let rd = 1;
            if (ty === 22 || ty === 23) rd = Math.min(Math.abs(wy - 22.55), Math.abs(wy - 23.45));
            if (tx === 30 || tx === 31) rd = Math.min(rd, Math.abs(wx - 30.55), Math.abs(wx - 31.45));
            if (rd < 0.13) { const q = (1 - rd / 0.13) * 26; r -= q; g -= q; b -= q * 0.8; }
            break;
          }
          case 'p': {
            const row = Math.floor(wy * 4), off = Noise.hash(row, 7) * 1.5, pl = Math.floor((wx + off) / 1.5);
            const tone = Noise.hash(row, pl), grain = Noise.value(wx * 0.8, wy * 28 + row * 3);
            r = 118 + tone * 26 + grain * 14; g = 86 + tone * 20 + grain * 10; b = 54 + tone * 12 + grain * 6;
            if ((wy * 4) % 1 < 0.07 || (wx + off) % 1.5 < 0.025) { r -= 34; g -= 28; b -= 20; }
            break;
          }
          case 'w': { const t = clamp(n1 * 0.7 + n2 * 0.3, 0, 1); r = 38 + t * 18; g = 76 + t * 26; b = 84 + t * 24; break; }
          case 'b': {
            const col = Math.floor(wx * 4.5), tone = Noise.hash(col, 11);
            r = 116 + tone * 30; g = 84 + tone * 22; b = 52 + tone * 14;
            if ((wx * 4.5) % 1 < 0.1) { r = 48; g = 34; b = 22; }
            break;
          }
          default: r = g = b = 128;
        }
        if (f === 'g' || f === 'd' || f === 'm') {
          const wd = edge(tx, ty, fx, fy, isW);
          if (wd < 0.38) { const q = (1 - wd / 0.38) * 0.75; r += (76 - r) * q; g += (62 - g) * q; b += (40 - b) * q; }
          const rd2 = edge(tx, ty, fx, fy, isR);
          if (rd2 < 0.2 && n2 > 0.35) { const q = (1 - rd2 / 0.2) * 0.55; r += (140 - r) * q; g += (118 - g) * q; b += (82 - b) * q; }
        } else if (f === 'w') {
          const sd = edge(tx, ty, fx, fy, notWater);
          if (sd < 0.3) { const q = (1 - sd / 0.3) * 0.6; r += (88 - r) * q; g += (92 - g) * q; b += (72 - b) * q; }
        }
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    this.bakeDetails(x);
  },

  bakeDetails(x) {
    const T = TILE, rng = mulberry32(555);
    // flores y piedras
    for (let i = 0; i < 900; i++) {
      const tx = (rng() * Level.W) | 0, ty = (rng() * Level.H) | 0, f = Level.floorAt(tx, ty);
      if (Level.at(tx, ty) !== '.' && Level.at(tx, ty) !== 'T') continue;
      const px = (tx + rng()) * T, py = (ty + rng()) * T;
      if (f === 'g' && rng() < 0.6) {
        const col = ['#e8e0c8', '#d8c040', '#c8504a', '#b8a0d8'][(rng() * 4) | 0];
        for (let k = 0; k < 6; k++) { x.fillStyle = col; x.fillRect(px + (rng() - 0.5) * 18, py + (rng() - 0.5) * 12, 2, 2); }
      } else if (f === 'd' || f === 'y' || f === 'r') {
        x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(px + 1, py + 2, 4, 2, 0, 0, 7); x.fill();
        x.fillStyle = '#9a9384'; x.beginPath(); x.ellipse(px, py, 3.5, 2.3, 0, 0, 7); x.fill();
      }
    }
    // charcos en el camino
    for (const [px, py, rx] of [[14, 22.8, 0.5], [27, 23.2, 0.4], [30.8, 12, 0.35], [31.2, 33, 0.5], [45, 22.6, 0.45]]) {
      x.fillStyle = 'rgba(60,70,60,.45)'; x.beginPath(); x.ellipse(px * T, py * T, rx * T, rx * T * 0.45, 0, 0, 7); x.fill();
      x.fillStyle = 'rgba(160,190,200,.18)'; x.beginPath(); x.ellipse(px * T - 3, py * T - 2, rx * T * 0.6, rx * T * 0.2, 0, 0, 7); x.fill();
    }
    // sombras proyectadas (luz desde el noroeste), dibujadas a baja resolución y escaladas = bordes suaves
    const SS = 6, sc = makeCanvas(Level.W * T / SS, Level.H * T / SS), sx = sc.getContext('2d');
    sx.scale(1 / SS, 1 / SS);
    sx.fillStyle = '#000';
    const hull = (x0, y0, x1, y1, h) => {
      const ox = h * 0.6, oy = h * 0.32;
      sx.beginPath();
      sx.moveTo(x0 * T, y0 * T); sx.lineTo(x1 * T, y0 * T); sx.lineTo((x1 + ox) * T, (y0 + oy) * T);
      sx.lineTo((x1 + ox) * T, (y1 + oy) * T); sx.lineTo((x0 + ox) * T, (y1 + oy) * T); sx.lineTo(x0 * T, y1 * T); sx.closePath(); sx.fill();
    };
    for (const b of Level.buildings) hull(b.x, b.y, b.x + b.w, b.y + b.h, b.H + b.R * 0.5);
    const ph = { truck: 1.4, jeep: 0.7, tent: 1.1, depot: 0.9, crate: 0.6, sandbag: 0.35, barrels: 0.5 };
    for (const p of Level.props) {
      if (p.type === 'tower') { hull(p.x + 1.4, p.y + 0.6, p.x + 3.4, p.y + 2.4, 0.3); continue; }
      if (p.type === 'depot' && Level.depot.destroyed) continue;
      hull(p.x + 0.1, p.y + 0.1, p.x + p.w - 0.1, p.y + p.h - 0.1, ph[p.type] || 0.5);
    }
    for (const t of Level.trees.concat(Level.border)) {
      sx.beginPath();
      if (t.pine) sx.ellipse((t.x + 0.9) * T, (t.y - 0.05) * T, 0.95 * T, 0.5 * T, 0, 0, 7);
      else sx.ellipse((t.x + 1.15) * T, (t.y + 0.05) * T, 1.5 * T, 0.85 * T, 0, 0, 7);
      sx.fill();
    }
    x.save(); x.globalAlpha = 0.36; x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(sc, 0, 0, Level.W * T, Level.H * T); x.restore();
    // mobiliario interior
    for (const b of Level.buildings) this.furniture(x, b);
    // alambradas
    for (let ty = 0; ty < Level.H; ty++) for (let tx = 0; tx < Level.W; tx++) {
      if (Level.at(tx, ty) !== 'f') continue;
      const px = tx * T, py = ty * T;
      const hz = Level.at(tx - 1, ty) === 'f' || Level.at(tx + 1, ty) === 'f';
      const vt = Level.at(tx, ty - 1) === 'f' || Level.at(tx, ty + 1) === 'f';
      x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(px + T / 2 - 1, py + T / 2 + 2, 10, 3);
      x.strokeStyle = 'rgba(40,36,30,.85)'; x.lineWidth = 1;
      for (const o of [-14, -9, -4]) {
        x.beginPath();
        if (hz) { x.moveTo(px, py + T / 2 + o); x.lineTo(px + T, py + T / 2 + o); }
        if (vt) { x.moveTo(px + T / 2 - o * 0.2, py); x.lineTo(px + T / 2 - o * 0.2, py + T); }
        x.stroke();
      }
      x.fillStyle = '#4a3a26'; x.fillRect(px + T / 2 - 2, py + T / 2 - 18, 4, 20);
      x.fillStyle = 'rgba(0,0,0,.4)'; for (let k = 0; k < 4; k++) x.fillRect(px + (k * 11) % T, py + T / 2 - 9 - (k % 2) * 5, 2, 2);
    }
    // barandillas de puentes
    for (let ty = 0; ty < Level.H; ty++) for (let tx = 0; tx < Level.W; tx++) {
      if (Level.floorAt(tx, ty) !== 'b') continue;
      const px = tx * T, py = ty * T;
      if (Level.floorAt(tx, ty - 1) !== 'b') { x.fillStyle = '#4a3420'; x.fillRect(px, py + 1, T, 4); x.fillRect(px + 2, py - 8, 4, 12); x.fillStyle = '#6a4a2c'; x.fillRect(px, py - 8, T, 3); }
      if (Level.floorAt(tx, ty + 1) !== 'b') { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(px, py + T, T, 6); x.fillStyle = '#4a3420'; x.fillRect(px, py + T - 5, T, 4); x.fillRect(px + 2, py + T - 14, 4, 12); x.fillStyle = '#6a4a2c'; x.fillRect(px, py + T - 14, T, 3); }
    }
    if (Level.depot.destroyed) this.decal('scorch', Level.depot.x, Level.depot.y, 3.2);
  },

  furniture(x, b) {
    const T = TILE, ix = (b.x + 1) * T, iy = (b.y + 1) * T, iw = (b.w - 2) * T, ih = (b.h - 2) * T;
    const shadowRect = (X, Y, W, H) => { x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(X + 3, Y + 3, W, H); };
    const r = mulberry32(b.x * 3 + b.y);
    if (b.furn === 'bunks') {
      for (let xx = ix + 6; xx + 0.8 * T < ix + iw; xx += 1.1 * T) {
        shadowRect(xx, iy + 4, 0.8 * T, 1.6 * T);
        x.fillStyle = '#5a4630'; x.fillRect(xx, iy + 4, 0.8 * T, 1.6 * T);
        x.fillStyle = '#c8c0a8'; x.fillRect(xx + 3, iy + 7, 0.8 * T - 6, 1.6 * T - 6);
        x.fillStyle = '#6a6e58'; x.fillRect(xx + 3, iy + 0.6 * T, 0.8 * T - 6, 1.0 * T - 3);
        x.fillStyle = '#eee8d8'; x.fillRect(xx + 6, iy + 9, 0.8 * T - 12, 0.3 * T);
      }
      shadowRect(ix + iw * 0.4, iy + ih - 0.9 * T, 1.6 * T, 0.7 * T);
      x.fillStyle = '#7a5a38'; x.fillRect(ix + iw * 0.4, iy + ih - 0.9 * T, 1.6 * T, 0.7 * T);
    } else if (b.furn === 'office') {
      shadowRect(ix + iw * 0.25, iy + ih * 0.3, iw * 0.5, ih * 0.35);
      x.fillStyle = '#6a4426'; x.fillRect(ix + iw * 0.25, iy + ih * 0.3, iw * 0.5, ih * 0.35);
      x.fillStyle = '#d8cfa8'; x.fillRect(ix + iw * 0.3, iy + ih * 0.34, iw * 0.4, ih * 0.27);
      x.strokeStyle = 'rgba(60,90,140,.6)'; x.lineWidth = 1;
      for (let k = 0; k < 5; k++) { x.beginPath(); x.moveTo(ix + iw * 0.3 + r() * iw * 0.4, iy + ih * 0.34 + r() * ih * 0.27); x.lineTo(ix + iw * 0.3 + r() * iw * 0.4, iy + ih * 0.34 + r() * ih * 0.27); x.stroke(); }
      x.fillStyle = '#7a1e1e'; x.fillRect(ix + iw * 0.1, iy + ih * 0.75, iw * 0.8, ih * 0.15);
      for (const cx of [0.35, 0.65]) { x.fillStyle = '#4a3020'; x.fillRect(ix + iw * cx - 6, iy + ih * 0.7, 12, 10); }
      x.fillStyle = '#3a3a34'; x.fillRect(ix + 4, iy + 4, 0.5 * T, 0.9 * T);
    } else if (b.furn === 'storage') {
      for (let k = 0; k < 7; k++) {
        const X = ix + r() * (iw - 0.7 * T), Y = iy + r() * (ih - 0.7 * T);
        shadowRect(X, Y, 0.6 * T, 0.6 * T);
        x.fillStyle = r() < 0.5 ? '#8a6a3e' : '#56603c'; x.fillRect(X, Y, 0.6 * T, 0.6 * T);
        x.strokeStyle = 'rgba(0,0,0,.35)'; x.strokeRect(X + 0.5, Y + 0.5, 0.6 * T - 1, 0.6 * T - 1);
      }
    } else if (b.furn === 'guard') {
      shadowRect(ix + 6, iy + 6, 1.2 * T, 0.6 * T);
      x.fillStyle = '#6a4a2c'; x.fillRect(ix + 6, iy + 6, 1.2 * T, 0.6 * T);
      x.fillStyle = '#2a2a2a'; x.fillRect(ix + 12, iy + 10, 14, 10);
      x.fillStyle = '#3b3f30'; for (let k = 0; k < 3; k++) x.fillRect(ix + iw - 10, iy + 6 + k * 14, 6, 12);
    } else {
      shadowRect(ix + 6, iy + 6, 0.9 * T, 1.4 * T);
      x.fillStyle = '#6a4426'; x.fillRect(ix + 6, iy + 6, 0.9 * T, 1.4 * T);
      x.fillStyle = '#a03a2a'; x.fillRect(ix + 9, iy + 9, 0.9 * T - 6, 1.4 * T - 6);
      shadowRect(ix + iw - 1.1 * T, iy + ih - 1 * T, 0.9 * T, 0.7 * T);
      x.fillStyle = '#7a5a38'; x.fillRect(ix + iw - 1.1 * T, iy + ih - 1 * T, 0.9 * T, 0.7 * T);
      x.fillStyle = '#7a3a2a'; x.beginPath(); x.ellipse(ix + iw / 2, iy + ih / 2, iw * 0.2, ih * 0.18, 0, 0, 7); x.fill();
    }
  },

  decal(type, x, y, r) {
    const ctx = this.ground.getContext('2d'), T = TILE, px = x * T, py = y * T;
    if (type === 'blood') {
      const rr = mulberry32((x * 100 + y * 7) | 0);
      ctx.fillStyle = 'rgba(100,10,8,.55)';
      for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.ellipse(px + (rr() - 0.5) * 20, py + (rr() - 0.5) * 8, 4 + rr() * 9, 2 + rr() * 4, 0, 0, 7); ctx.fill(); }
    } else if (type === 'scorch') {
      const g = ctx.createRadialGradient(px, py, 2, px, py, r * T);
      g.addColorStop(0, 'rgba(12,10,8,.85)'); g.addColorStop(0.6, 'rgba(30,24,16,.5)'); g.addColorStop(1, 'rgba(30,24,16,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(px, py, r * T, r * T * 0.75, 0, 0, 7); ctx.fill();
    }
  },

  // ---------- objetos estáticos ordenables ----------
  buildStatics() {
    const s = [];
    Level.buildings.forEach((b, i) => s.push({ kind: 'bld', i, sy: b.y + b.h, x0: b.x - 0.5, x1: b.x + b.w + 0.5, y0: b.y - b.H - b.R - 1, y1: b.y + b.h }));
    Level.props.forEach((p, i) => s.push({ kind: 'prop', i, sy: p.y + p.h - 0.05, x0: p.x - 0.5, x1: p.x + p.w + 0.5, y0: p.y - 4, y1: p.y + p.h }));
    const tree = (t, border) => {
      const spr = t.pine ? this.pines[t.v] : this.oaks[t.v];
      s.push({ kind: 'spr', spr, x: t.x, y: t.y, sy: t.y + 0.2, x0: t.x - 1.9, x1: t.x + 1.9, y0: t.y - 4.6, y1: t.y + 0.4, tree: t });
    };
    Level.trees.forEach(t => tree(t)); Level.border.forEach(t => tree(t, true));
    for (let ty = 0; ty < Level.H; ty++) for (let tx = 0; tx < Level.W; tx++) {
      if (Level.at(tx, ty) !== 'T') continue;
      const spr = this.bushes[(Noise.hash(tx, ty) * 6) | 0];
      s.push({ kind: 'spr', spr, x: tx + 0.5, y: ty + 0.85, sy: ty + 0.85, x0: tx - 1, x1: tx + 2, y0: ty - 1, y1: ty + 1 });
    }
    this.statics = s;
  },

  bakeMini() {
    const S = 4, m = makeCanvas(Level.W * S, Level.H * S), x = m.getContext('2d');
    const col = { g: [86, 110, 46], d: [130, 104, 68], y: [128, 118, 96], r: [160, 138, 98], p: [120, 90, 58], w: [46, 86, 94], b: [110, 80, 50], m: [40, 56, 28] };
    for (let ty = 0; ty < Level.H; ty++) for (let tx = 0; tx < Level.W; tx++) {
      const c = col[Level.floorAt(tx, ty)] || [90, 90, 90], v = (Noise.hash(tx, ty) - 0.5) * 14;
      x.fillStyle = `rgb(${c[0] + v | 0},${c[1] + v | 0},${c[2] + v | 0})`; x.fillRect(tx * S, ty * S, S, S);
      if (Level.at(tx, ty) === 'T') { x.fillStyle = '#3d5f26'; x.fillRect(tx * S + 1, ty * S + 1, S - 1, S - 1); }
      if (Level.at(tx, ty) === 'f') { x.fillStyle = 'rgba(30,25,15,.6)'; x.fillRect(tx * S + 1, ty * S + 1, 2, 2); }
    }
    for (const b of Level.buildings) { x.fillStyle = Sprites.roofBase(b); x.fillRect(b.x * S, b.y * S, b.w * S, b.h * S); x.strokeStyle = '#000'; x.strokeRect(b.x * S + 0.5, b.y * S + 0.5, b.w * S - 1, b.h * S - 1); }
    for (const p of Level.props) { x.fillStyle = p.type === 'depot' ? (Level.depot.destroyed ? '#222' : '#c0392b') : '#3a3a2a'; x.fillRect(p.x * S, p.y * S, p.w * S, p.h * S); }
    for (const t of Level.trees.concat(Level.border)) { x.fillStyle = '#1f3518'; x.beginPath(); x.arc(t.x * S, Math.min(t.y, Level.H - 0.5) * S - 3, 4, 0, 7); x.fill(); }
    this.miniBase = m;
  },

  // ---------- utilidades de estado ----------
  closedAt(x, y) {
    const i = Level.buildings.findIndex(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
    return i >= 0 && !this.open[i];
  },

  occluded(u) {
    for (let i = 0; i < Level.buildings.length; i++) {
      const b = Level.buildings[i];
      if (this.open[i]) continue;
      if (u.x > b.x - 0.2 && u.x < b.x + b.w + 0.2 && u.y < b.y + b.h && u.y > b.y - b.H - b.R) return true;
    }
    for (const t of Level.trees) {
      if (u.y >= t.y + 0.2) continue;
      const cy = t.pine ? t.y - 2.2 : t.y - 2.35, r = t.pine ? 1.0 : 1.35;
      if (Math.hypot(u.x - t.x, (u.y - 0.5) - cy) < r) return true;
    }
    for (const p of Level.props) {
      if (p.type !== 'truck' && p.type !== 'tent' && p.type !== 'tower' && p.type !== 'jeep') continue;
      const h = p.type === 'tower' ? 3.5 : 1.5;
      if (u.x > p.x && u.x < p.x + p.w && u.y < p.y + p.h && u.y > p.y - h) return true;
    }
    return false;
  },

  // ---------- dibujado principal ----------
  draw(G, dt) {
    this.time += dt;
    const ctx = G.ctx, cv = G.canvas, cam = G.cam, z = cam.z, T = TILE;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1d2a14'; ctx.fillRect(0, 0, cv.width, cv.height);
    let shx = 0, shy = 0;
    if (G.shake > 0) { shx = (Math.random() - 0.5) * G.shake * 18; shy = (Math.random() - 0.5) * G.shake * 18; }
    ctx.setTransform(z, 0, 0, z, -cam.x * z + shx, -cam.y * z + shy);
    const vw = cv.width / z, vh = cv.height / z;
    const gw = this.ground.width, gh = this.ground.height;
    const sx = clamp(Math.floor(cam.x), 0, gw - 1), sy = clamp(Math.floor(cam.y), 0, gh - 1);
    const sw = Math.min(gw - sx, Math.ceil(vw) + 2), sh = Math.min(gh - sy, Math.ceil(vh) + 2);
    if (sw > 0 && sh > 0) ctx.drawImage(this.ground, sx, sy, sw, sh, sx, sy, sw, sh);
    const view = { x0: cam.x / T - 1, y0: cam.y / T - 1, x1: (cam.x + vw) / T + 1, y1: (cam.y + vh) / T + 1 };

    this.drawWater(ctx, view);
    this.drawExit(ctx);
    this.open = Level.buildings.map(b => G.units.some(u => u.alive && u.x >= b.x && u.x < b.x + b.w && u.y >= b.y && u.y < b.y + b.h));

    // manchas de sangre (una vez por cadáver)
    for (const e of G.enemies) if (e.state === 'dead' && !e.decal && e.cause !== 'boom') { this.decal('blood', e.x, e.y); e.decal = true; }

    // cuerpos tendidos
    for (const e of G.enemies) {
      if ((e.state !== 'dead' && e.state !== 'down') || e.hidden || e.carried) continue;
      Sprites.corpse(ctx, e.x * T, e.y * T, e.officer ? 'officer' : 'soldier', e.id % 2 ? 1 : -1, e.state === 'down');
    }

    // conos de visión (verde al estilo Commandos 2)
    const hov = G.hover && G.hover.enemy;
    for (const e of G.enemies) {
      if (e.state === 'dead' || e.state === 'down' || e.hidden || e.carried) continue;
      if (G.coneMode === 'all' || e.inspect || e === hov || e.state === 'alert') this.cone(ctx, e);
    }

    // marcas de selección y destino
    for (const u of G.units) {
      if (!u.alive || !u.selected) continue;
      ctx.strokeStyle = 'rgba(120,255,90,.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(u.x * T, u.y * T + 1, 15, 7, 0, 0, 7); ctx.stroke();
      if (u.path.length) {
        const p = u.path[u.path.length - 1];
        ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(120,255,90,.45)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(u.x * T, u.y * T); for (const q of u.path) ctx.lineTo(q.x * T, q.y * T); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(120,255,90,.8)'; ctx.beginPath(); ctx.ellipse(p.x * T, p.y * T, 8, 4, 0, 0, 7); ctx.stroke();
      }
    }
    const pu = G.primary();
    if (pu && pu.action === 'shoot') this.rangeCircle(ctx, pu, 13);
    if (pu && (pu.action === 'grenade' || pu.action === 'lure')) this.rangeCircle(ctx, pu, 9);

    // lista ordenada por profundidad
    const list = [];
    for (const s of this.statics) {
      if (s.x1 < view.x0 || s.x0 > view.x1 || s.y0 > view.y1 || s.y1 < view.y0 - 1) continue;
      if (s.kind === 'bld' && this.open[s.i]) {
        const b = Level.buildings[s.i];
        for (let ty = b.y; ty < b.y + b.h; ty++) for (let tx = b.x; tx < b.x + b.w; tx++)
          if (Level.isWall(tx, ty)) list.push({ sy: ty + 0.99, f: () => Sprites.lowWall(ctx, b, tx, ty, 0.5 * T) });
        continue;
      }
      list.push({ sy: s.sy, f: () => this.drawStatic(ctx, s) });
    }
    for (const e of G.enemies) {
      if (e.state === 'dead' || e.state === 'down' || e.hidden || e.carried) continue;
      if (e.x < view.x0 || e.x > view.x1 || e.y < view.y0 || e.y > view.y1 + 1) continue;
      list.push({ sy: e.y, f: () => this.drawEnemy(ctx, e) });
    }
    for (const u of G.units) if (u.alive) list.push({ sy: u.y, f: () => this.drawCommando(ctx, u) });
    list.sort((a, b) => a.sy - b.sy);
    for (const d of list) d.f();

    // siluetas de comandos tapados
    for (const u of G.units) {
      if (!u.alive || !this.occluded(u)) continue;
      ctx.globalAlpha = 0.55;
      Sprites.person(ctx, u.x * T, u.y * T, { kind: u.disguised ? 'spyDis' : u.type, face: u.face, moving: u.moving, anim: u.anim, crouch: u.crouch, ghost: u.selected ? '#b8ff90' : '#d8e8c0' });
      ctx.globalAlpha = 1;
    }

    FX.draw(ctx);
    for (const f of G.fx) {
      const p = f.t / f.dur;
      if (f.k === 'tracer') {
        ctx.strokeStyle = f.enemy ? `rgba(255,170,90,${p})` : `rgba(255,255,210,${p})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(f.x0 * T, f.y0 * T - 22); ctx.lineTo(f.x1 * T, f.y1 * T - 22); ctx.stroke();
      } else if (f.k === 'ring') {
        ctx.strokeStyle = `rgba(255,255,255,${p})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(f.x * T, f.y * T, f.r * T * (1 - p), f.r * T * (1 - p) * 0.5, 0, 0, 7); ctx.stroke();
      }
    }

    // iconos de alerta sobre los enemigos visibles
    for (const e of G.enemies) {
      if (e.state === 'dead' || e.hidden || e.carried || this.closedAt(e.x, e.y)) continue;
      const px = e.x * T, py = e.y * T;
      if (e.state === 'down') {
        ctx.fillStyle = '#e8f0ff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('z', px + 8, py - 18 + Math.sin(this.time * 2) * 3); ctx.fillText('Z', px + 16, py - 28 + Math.sin(this.time * 2 + 1) * 3);
        continue;
      }
      if (e.state === 'alert') this.mark(ctx, px, py - 60, '!', '#ff4030');
      else if (e.susp > 0.2 || e.state === 'investigate') {
        this.mark(ctx, px, py - 60, '?', '#ffd23a');
        if (e.susp > 0.2) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(px - 13, py - 56, 26, 5); ctx.fillStyle = '#ffd23a'; ctx.fillRect(px - 12, py - 55, 24 * Math.min(1, e.susp), 3); }
      }
    }

    if (G.bomb) {
      const px = G.bomb.x * T, py = (G.bomb.y - 1.5) * T;
      ctx.fillStyle = 'rgba(0,0,0,.75)'; Sprites.rr(ctx, px - 30, py - 30, 60, 24, 4); ctx.fill();
      ctx.fillStyle = Math.ceil(G.bomb.t) % 2 ? '#ff9a4d' : '#ffd080'; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'center';
      ctx.fillText('00:' + String(Math.ceil(G.bomb.t)).padStart(2, '0'), px, py - 12);
    }

    // ---- espacio de pantalla ----
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!this.vig || this.vig.w !== cv.width || this.vig.h !== cv.height) {
      const g = ctx.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * 0.45, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(15,10,0,.45)');
      this.vig = { g, w: cv.width, h: cv.height };
    }
    ctx.fillStyle = this.vig.g; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = 'rgba(255,200,120,.035)'; ctx.fillRect(0, 0, cv.width, cv.height);

    if (G.drag && G.drag.active) {
      const d = G.drag;
      ctx.strokeStyle = '#a8ff80'; ctx.lineWidth = 1; ctx.fillStyle = 'rgba(160,255,120,.08)';
      ctx.fillRect(d.sx, d.sy, d.cx - d.sx, d.cy - d.sy); ctx.strokeRect(d.sx + 0.5, d.sy + 0.5, d.cx - d.sx, d.cy - d.sy);
    }
    if (G.paused && !G.overlayOpen) {
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = '#f0e2a0'; ctx.font = '40px "Black Ops One", Impact, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('PAUSA', cv.width / 2, cv.height / 2 - 60);
      ctx.font = '15px "Special Elite", monospace'; ctx.fillText('Puedes dar órdenes en pausa · Espacio para continuar', cv.width / 2, cv.height / 2 - 30);
    }
    this.drawCursor(ctx, G);
  },

  mark(ctx, x, y, ch, col) {
    ctx.font = 'bold 28px "Black Ops One", Impact, sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText(ch, x, y); ctx.fillStyle = col; ctx.fillText(ch, x, y);
  },

  drawStatic(ctx, s) {
    const T = TILE;
    if (s.kind === 'bld') { const sp = this.bldSpr[s.i]; ctx.drawImage(sp.c, sp.ox, sp.oy); }
    else if (s.kind === 'prop') { const sp = this.propSpr[s.i]; ctx.drawImage(sp.c, sp.ox, sp.oy); }
    else {
      let sway = 0;
      if (s.tree) sway = Math.sin(this.time * 0.8 + s.x) * 0.6;
      ctx.drawImage(s.spr.c, s.x * T - s.spr.ax + sway, s.y * T - s.spr.ay);
    }
  },

  drawCommando(ctx, u) {
    const T = TILE, px = u.x * T, py = u.y * T;
    ctx.globalAlpha = u.inBush ? 0.75 : 1;
    Sprites.person(ctx, px, py, {
      kind: u.disguised ? 'spyDis' : u.type, face: u.face, moving: u.moving, anim: u.anim,
      crouch: u.crouch, aim: u.busyKind === 'shoot' || u.busyKind === 'throw', busy: u.busyKind
    });
    if (u.hurt > 0) { ctx.globalAlpha = u.hurt; Sprites.person(ctx, px, py, { kind: u.type, face: u.face, crouch: u.crouch, ghost: '#ff3020', noShadow: true }); }
    ctx.globalAlpha = 1;
    if (u.carry) {
      ctx.save(); ctx.translate(px, py - 40); ctx.rotate(-0.1);
      ctx.fillStyle = '#5f6650'; Sprites.rr(ctx, -16, -5, 30, 10, 4); ctx.fill();
      ctx.fillStyle = '#d9ab84'; ctx.beginPath(); ctx.arc(17, 0, 4.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#4b5040'; ctx.fillRect(-22, -3, 8, 6);
      ctx.restore();
    }
    if (u.selected) {
      for (let i = 0; i < u.def.hp; i++) {
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(px - u.def.hp * 5 + i * 10 - 1, py - 66, 9, 6);
        ctx.fillStyle = i < u.hp ? '#5ad04a' : '#4a1a1a'; ctx.fillRect(px - u.def.hp * 5 + i * 10, py - 65, 7, 4);
      }
    }
    if (u.busyT > 0 && u.busyKind === 'plant') {
      const p = 1 - u.busyT / 3;
      ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(px - 18, py - 74, 36, 7);
      ctx.fillStyle = '#ff9a4d'; ctx.fillRect(px - 17, py - 73, 34 * p, 5);
    }
  },

  drawEnemy(ctx, e) {
    Sprites.person(ctx, e.x * TILE, e.y * TILE, {
      kind: e.officer ? 'officer' : 'soldier', face: e.face, moving: !!(e.path && e.path.length && !e.holding),
      anim: e.anim, aim: e.state === 'alert' && !!e.seenNow
    });
  },

  cone(ctx, e) {
    const T = TILE, alert = e.state === 'alert';
    const range = alert ? 9 : 7.5, half = alert ? 1.1 : 0.62, N = 34, near = range * 0.5;
    const col = alert ? '230,60,40' : (e.susp > 0.2 || e.state === 'investigate') ? '235,200,50' : '80,210,70';
    const pts = [];
    for (let i = 0; i <= N; i++) { const a = e.face - half + (2 * half * i) / N; pts.push([a, Level.rayLength(e.x, e.y, a, range)]); }
    const poly = lim => {
      ctx.beginPath(); ctx.moveTo(e.x * T, e.y * T);
      for (const [a, d] of pts) { const dd = Math.min(d, lim); ctx.lineTo((e.x + Math.cos(a) * dd) * T, (e.y + Math.sin(a) * dd) * T); }
      ctx.closePath();
    };
    poly(range); ctx.fillStyle = `rgba(${col},.16)`; ctx.fill();
    ctx.strokeStyle = `rgba(${col},.55)`; ctx.lineWidth = 1; ctx.stroke();
    poly(near); ctx.fillStyle = `rgba(${col},.2)`; ctx.fill();
  },

  rangeCircle(ctx, u, r) {
    ctx.strokeStyle = 'rgba(255,190,90,.55)'; ctx.setLineDash([8, 6]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(u.x * TILE, u.y * TILE, r * TILE, r * TILE, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  },

  drawWater(ctx, v) {
    const T = TILE;
    ctx.lineWidth = 1.5;
    for (let ty = Math.max(0, v.y0 | 0); ty <= Math.min(Level.H - 1, v.y1 | 0); ty++)
      for (let tx = Math.max(0, v.x0 | 0); tx <= Math.min(Level.W - 1, v.x1 | 0); tx++) {
        if (Level.floorAt(tx, ty) !== 'w') continue;
        for (let k = 0; k < 2; k++) {
          const h = Noise.hash(tx * 3 + k, ty * 5), ph = this.time * 0.5 + h * 6.28;
          const a = (Math.sin(ph) * 0.5 + 0.5) * 0.25;
          const ox = (h * T + this.time * 6) % T, oy = (Noise.hash(ty, tx + k) * 0.8 + 0.1) * T;
          ctx.strokeStyle = `rgba(200,230,230,${a})`;
          ctx.beginPath(); ctx.moveTo(tx * T + ox - 7, ty * T + oy); ctx.quadraticCurveTo(tx * T + ox, ty * T + oy - 2, tx * T + ox + 7, ty * T + oy); ctx.stroke();
        }
      }
  },

  drawExit(ctx) {
    const T = TILE, e = Level.exit, a = 0.35 + Math.sin(this.time * 3) * 0.2;
    ctx.strokeStyle = `rgba(150,210,255,${a})`; ctx.setLineDash([10, 8]); ctx.lineWidth = 2.5;
    ctx.strokeRect(e.x0 * T + 3, e.y0 * T + 3, (e.x1 - e.x0 + 1) * T - 6, (e.y1 - e.y0 + 1) * T - 6);
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(200,230,255,${a + 0.3})`; ctx.font = '15px "Black Ops One", Impact, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('EXTRACCIÓN', (e.x0 + (e.x1 - e.x0 + 1) / 2) * T, (e.y1 + 0.7) * T);
  },

  drawCursor(ctx, G) {
    const m = G.mouse;
    if (!m.inside || G.overlayOpen) return;
    const x = m.x, y = m.y, pu = G.primary(), h = G.hover || {};
    if (pu && pu.action) {
      const ok = h.valid;
      ctx.strokeStyle = ok ? '#ff4a30' : '#f0c060'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 11, 0, 7);
      ctx.moveTo(x - 18, y); ctx.lineTo(x - 6, y); ctx.moveTo(x + 6, y); ctx.lineTo(x + 18, y);
      ctx.moveTo(x, y - 18); ctx.lineTo(x, y - 6); ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 18); ctx.stroke();
      ctx.fillStyle = 'rgba(20,16,8,.8)'; ctx.fillRect(x + 14, y + 12, 32, 32);
      ctx.drawImage(this.icon(pu.action, 30), x + 15, y + 13);
      return;
    }
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = h.unit ? '#b8ff90' : '#f0e2a0'; ctx.strokeStyle = '#2a1d08'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 19); ctx.lineTo(5, 14.5); ctx.lineTo(9, 23); ctx.lineTo(12.5, 21.5); ctx.lineTo(8.5, 13.5); ctx.lineTo(14.5, 13.5); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    if (h.enemy) { ctx.fillStyle = 'rgba(20,16,8,.7)'; ctx.fillRect(x + 14, y + 18, 26, 26); ctx.drawImage(this.icon('eye', 24), x + 15, y + 19); }
  },

  drawMinimap(G) {
    const m = G.mini, x = m.getContext('2d'), sx = m.width / Level.W, sy = m.height / Level.H;
    x.drawImage(this.miniBase, 0, 0, m.width, m.height);
    for (const u of G.units) if (u.alive) {
      x.fillStyle = '#000'; x.fillRect(u.x * sx - 3, u.y * sy - 3, 6, 6);
      x.fillStyle = u.selected ? '#ffe45a' : '#7dff6a'; x.fillRect(u.x * sx - 2, u.y * sy - 2, 4, 4);
    }
    for (const e of G.enemies) if (e.state === 'alert') { x.fillStyle = '#ff3020'; x.fillRect(e.x * sx - 2, e.y * sy - 2, 4, 4); }
    const cam = G.cam;
    x.strokeStyle = '#fff'; x.lineWidth = 1;
    x.strokeRect(cam.x / TILE * sx, cam.y / TILE * sy, G.canvas.width / cam.z / TILE * sx, (G.canvas.height - 150) / cam.z / TILE * sy);
  }
};
