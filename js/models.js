'use strict';
// Modelos 3D: materiales con texturas reales (CC0), edificios, objetos, vegetación y soldados.
// Coordenadas: el mapa (x, y) del juego corresponde a (x, z) en Three.js; y es la altura.

THREE.ColorManagement.legacyMode = false; // los colores hex se interpretan como sRGB

// ---------------- TEXTURAS Y MATERIALES ----------------
const Tex = {
  cache: {},
  get(name, normal) {
    const key = normal ? name + '_n' : name;
    if (key in this.cache) return this.cache[key];
    const img = Assets.img[key];
    if (!img) return (this.cache[key] = null);
    const t = new THREE.Texture(img); t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (!normal) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 8;
    return (this.cache[key] = t);
  },
  // Copia sin conversión sRGB (para el shader del suelo, que la decodifica a mano)
  raw(name) {
    const key = name + '_raw';
    if (!this.cache[key]) {
      const t = new THREE.Texture(Assets.img[name]); t.needsUpdate = true;
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
      this.cache[key] = t;
    }
    return this.cache[key];
  },
  canvas(w, h, draw, srgb) {
    const c = makeCanvas(w, h); draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb !== false) t.encoding = THREE.sRGBEncoding;
    return t;
  }
};

// [textura, color de tinte, textura de normales, rugosidad, escala UV (m por repetición), metalicidad]
const MAT_DEFS = {
  plaster: ['plaster', '#e2d6bc', 'plaster', 0.92, 2.2],
  timberFill: ['plaster', '#e6d6b2', 'plaster', 0.92, 2.2],
  bricks: ['bricks', '#c66d55', 'bricks', 0.9, 1.6],
  concrete: ['concrete', '#bcb8ad', 'concrete', 0.95, 3],
  wood: ['siding', '#b48d64', 'siding', 0.85, 2],
  trim: ['siding', '#5c3e24', 'siding', 0.8, 1.5],
  stone: ['concrete', '#8f887a', 'concrete', 0.95, 1.5],
  rockM: ['concrete', '#9a7f62', 'concrete', 0.95, 1.2],
  tiles: ['tiles', '#ffffff', 'tiles', 0.75, 1.8],
  slate: ['slate', '#9aa5b4', 'slate', 0.6, 1.6],
  metalRoof: ['metal', '#959a92', 'metal', 0.55, 2.2, 0.35],
  floor: ['floor', '#c9a27c', 'floor', 0.8, 2],
  door: ['siding', '#8a5a34', 'siding', 0.8, 1.2],
  crate: ['crate', '#cfa874', 'crate', 0.85, 0.9],
  canvas: ['plaster', '#a59b72', null, 0.95, 1.2],
  tarp: ['plaster', '#8a8558', null, 0.95, 1.0],
  sand: ['plaster', '#cdbb8c', null, 1.0, 0.6],
  olive: ['paint', '#5f6a3a', null, 0.6, 2, 0.25],
  oliveDark: ['paint', '#3c4426', null, 0.6, 2, 0.25],
  tank: ['paint', '#a5ab94', null, 0.5, 2, 0.35],
  barrelG: ['paint', '#56623a', null, 0.55, 1, 0.3],
  barrelR: ['paint', '#8a4a28', null, 0.6, 1, 0.3],
  bark: ['bark', '#8a7058', 'bark', 0.95, 1],
  post: ['siding', '#6a4a2c', null, 0.9, 1],
  leaf: ['leafA', '#8fae6c', null, 0.8, 1],
  leaf2: ['leafB', '#7d9a5c', null, 0.8, 1],
  pine: ['pine', '#7f9a78', null, 0.85, 1],
  burnt: [null, '#1c1915', null, 1.0, 1],
  glass: [null, '#1c2a33', null, 0.06, 1, 0.1],
  frame: [null, '#d6cfbc', null, 0.6, 1],
  shutter: [null, '#4b6a4a', null, 0.7, 1],
  rubber: [null, '#171717', null, 0.9, 1],
  wire: [null, '#2a2620', null, 0.6, 1, 0.5],
  gutter: [null, '#6d6f6a', null, 0.45, 1, 0.6],
  red: [null, '#a8321e', null, 0.6, 1],
  white: [null, '#cfcabd', null, 0.7, 1],
  lamp: [null, '#fff4c0', null, 0.3, 1]
};
const NO_AO = new Set(['tiles', 'slate', 'metalRoof', 'leaf', 'leaf2', 'pine', 'glass', 'lamp']);
const FOLIAGE = new Set(['leaf', 'leaf2', 'pine']);

const Mats = {
  cache: {},
  get(key) {
    if (this.cache[key]) return this.cache[key];
    const d = MAT_DEFS[key];
    const m = new THREE.MeshStandardMaterial({ color: d[1], roughness: d[3], metalness: d[5] || 0, vertexColors: true, envMapIntensity: 0.9 });
    if (d[0]) m.map = Tex.get(d[0]);
    if (d[2]) { m.normalMap = Tex.get(d[2], true); m.normalScale = new THREE.Vector2(1, 1); }
    if (key === 'glass') m.envMapIntensity = 2.2;
    if (FOLIAGE.has(key)) { m.alphaTest = 0.45; m.side = THREE.DoubleSide; m.shadowSide = THREE.DoubleSide; Render.addSway(m); }
    if (key === 'lamp') { m.emissive = new THREE.Color(0xffe0a0); m.emissiveIntensity = 1.5; }
    return (this.cache[key] = m);
  },
  scale(key) { return MAT_DEFS[key] ? MAT_DEFS[key][4] : 1; }
};

// ---------------- GEOMETRÍA ----------------
const Geo = {
  // UV planas en coordenadas del mundo según la orientación de cada cara
  worldUV(g, s) {
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (ny >= nx && ny >= nz) uv.setXY(i, x / s, z / s);
      else if (nx >= nz) uv.setXY(i, z / s, y / s);
      else uv.setXY(i, x / s, y / s);
    }
    uv.needsUpdate = true;
    return g;
  },
  box(x0, y0, z0, x1, y1, z1, s) {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)).toNonIndexed();
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return this.worldUV(g, s || 1);
  },
  ni(g) { return g.index ? g.toNonIndexed() : g; },
  merge(list) {
    let n = 0;
    list = list.map(g => this.ni(g));
    for (const g of list) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
    const hasCol = list.some(g => g.attributes.color);
    let o = 0;
    for (const g of list) {
      const c = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      if (hasCol) { if (g.attributes.color) col.set(g.attributes.color.array, o * 3); else col.fill(1, o * 3, (o + c) * 3); }
      o += c;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (hasCol) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.computeBoundingSphere(); out.computeBoundingBox();
    return out;
  },
  // Triángulos sueltos con normal hacia fuera (hacia arriba si es un tejado) y UV a lo largo del alero
  tris(tris, s, eave) {
    const pos = [], nor = [], uv = [];
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3(), E = new THREE.Vector3(), S = new THREE.Vector3();
    for (const t of tris) {
      A.fromArray(t[0]); B.fromArray(t[1]); C.fromArray(t[2]);
      N.subVectors(B, A).cross(C.clone().sub(A)).normalize();
      if (t[3]) { if (N.dot(new THREE.Vector3().fromArray(t[3])) < 0) { const tmp = B.clone(); B.copy(C); C.copy(tmp); N.negate(); } }
      else if (N.y < 0) { const tmp = B.clone(); B.copy(C); C.copy(tmp); N.negate(); }
      E.set(Math.abs(N.x) > Math.abs(N.z) ? 0 : 1, 0, Math.abs(N.x) > Math.abs(N.z) ? 1 : 0);
      S.crossVectors(N, E).normalize();
      for (const P of [A, B, C]) { pos.push(P.x, P.y, P.z); nor.push(N.x, N.y, N.z); uv.push(P.dot(E) / s, P.dot(S) / s); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return g;
  },
  colorize(g, fn) {
    g = this.ni(g);
    const p = g.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const v = fn(p.getX(i), p.getY(i), p.getZ(i)); c[i * 3] = v[0]; c[i * 3 + 1] = v[1]; c[i * 3 + 2] = v[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  }
};

// Agrupa geometrías por material y las fusiona en una malla por material
class Batch {
  constructor() { this.parts = {}; }
  add(key, g) { (this.parts[key] = this.parts[key] || []).push(g); return g; }
  box(key, x0, y0, z0, x1, y1, z1) { return this.add(key, Geo.box(x0, y0, z0, x1, y1, z1, Mats.scale(key))); }
  build(shadow) {
    const grp = new THREE.Group();
    for (const k in this.parts) {
      const g = Geo.merge(this.parts[k]);
      if (!g.attributes.color || !NO_AO.has(k)) {
        const p = g.attributes.position, c = g.attributes.color ? g.attributes.color.array : new Float32Array(p.count * 3).fill(1);
        if (!NO_AO.has(k)) for (let i = 0; i < p.count; i++) {
          const y = p.getY(i), ao = 0.5 + 0.5 * smooth(0, 1.5, y);
          c[i * 3] *= ao; c[i * 3 + 1] *= ao; c[i * 3 + 2] *= ao;
        }
        g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      }
      const m = new THREE.Mesh(g, Mats.get(k));
      m.castShadow = shadow !== false; m.receiveShadow = true;
      m.userData.mat = k;
      grp.add(m);
    }
    return grp;
  }
}

// ---------------- EDIFICIOS ----------------
const Buildings = {
  // Devuelve { full, cut, inner, box } — full: completo; cut: muros bajos (interior visible)
  build(b) {
    const X0 = b.x, X1 = b.x + b.w, Z0 = b.y, Z1 = b.y + b.h, th = 0.42;
    const wx0 = X0 + 0.5 - th / 2, wx1 = X1 - 0.5 + th / 2, wz0 = Z0 + 0.5 - th / 2, wz1 = Z1 - 0.5 + th / 2; // caras exteriores
    const H = b.H * 1.5, doorH = Math.min(1.25, H - 0.35);
    const fac = { plaster: 'plaster', timber: 'timberFill', wood: 'wood', brick: 'bricks', concrete: 'concrete' }[b.facade];
    const dx = b.door.x + 0.5, dw = b.facade === 'concrete' ? 0.62 : 0.45;
    const full = new Batch(), cut = new Batch(), inner = new Batch();

    const walls = (B, h, withLintel) => {
      B.box(fac, wx0, 0, wz0, wx1, h, wz0 + th);                 // norte
      B.box(fac, wx0, 0, wz0 + th, wx0 + th, h, wz1 - th);       // oeste
      B.box(fac, wx1 - th, 0, wz0 + th, wx1, h, wz1 - th);       // este
      B.box(fac, wx0, 0, wz1 - th, dx - dw, h, wz1);             // sur (a la izquierda de la puerta)
      B.box(fac, dx + dw, 0, wz1 - th, wx1, h, wz1);             // sur (a la derecha)
      if (withLintel && h > doorH) B.box(fac, dx - dw, doorH, wz1 - th, dx + dw, h, wz1);
      // zócalo
      const pl = 0.28, o = 0.03;
      B.box('stone', wx0 - o, 0, wz1 - o, dx - dw, pl, wz1 + o);
      B.box('stone', dx + dw, 0, wz1 - o, wx1 + o, pl, wz1 + o);
      B.box('stone', wx0 - o, 0, wz0 - o, wx0 + o, pl, wz1);
      B.box('stone', wx1 - o, 0, wz0 - o, wx1 + o, pl, wz1);
      B.box('stone', wx0, 0, wz0 - o, wx1, pl, wz0 + o);
    };
    if (b.ruin) { // ruina: muros a distintas alturas, sin tejado, con escombros
      const rr = mulberry32(b.x * 13 + b.y * 7);
      for (let ty = b.y; ty < b.y + b.h; ty++) for (let tx = b.x; tx < b.x + b.w; tx++) {
        if (Level.at(tx, ty) !== '#') continue;
        const hh = H * (0.35 + rr() * 0.65), x0 = tx === b.x ? wx0 : tx + 0.5 - th / 2 - (tx === b.x + b.w - 1 ? 0 : 0.5), x1 = tx === b.x + b.w - 1 ? wx1 : tx + 0.5 + th / 2 + (tx === b.x ? 0 : 0.5);
        const z0 = ty === b.y ? wz0 : ty + 0.5 - th / 2 - (ty === b.y + b.h - 1 ? 0 : 0.5), z1 = ty === b.y + b.h - 1 ? wz1 : ty + 0.5 + th / 2 + (ty === b.y ? 0 : 0.5);
        const vert = tx === b.x || tx === b.x + b.w - 1;
        full.box(fac, vert ? (tx === b.x ? wx0 : wx1 - th) : x0, 0, vert ? z0 : (ty === b.y ? wz0 : wz1 - th), vert ? (tx === b.x ? wx0 + th : wx1) : x1, hh, vert ? z1 : (ty === b.y ? wz0 + th : wz1));
      }
      for (let k = 0; k < 10; k++) { const cx = b.x + 1 + rr() * (b.w - 2), cz = b.y + 1 + rr() * (b.h - 2), sz = 0.2 + rr() * 0.35; full.box(fac, cx - sz, 0, cz - sz * 0.7, cx + sz, sz * 0.6, cz + sz * 0.7); }
    } else walls(full, H, true);
    walls(cut, 0.6, false);
    cut.box('stone', wx0, 0.6, wz0, wx1, 0.66, wz0 + th);
    cut.box('stone', wx0, 0.6, wz0, wx0 + th, 0.66, wz1);
    cut.box('stone', wx1 - th, 0.6, wz0, wx1, 0.66, wz1);
    cut.box('stone', wx0, 0.6, wz1 - th, dx - dw, 0.66, wz1);
    cut.box('stone', dx + dw, 0.6, wz1 - th, wx1, 0.66, wz1);

    // caras visibles desde la cámara (sur y oeste) y sus detalles
    const faces = [
      { o: [wx0, wz1], u: [1, 0], n: [0, 1], len: wx1 - wx0, south: true },
      { o: [wx0, wz0], u: [0, 1], n: [-1, 0], len: wz1 - wz0 },
      { o: [wx0, wz0], u: [1, 0], n: [0, -1], len: wx1 - wx0 },
      { o: [wx1, wz0], u: [0, 1], n: [1, 0], len: wz1 - wz0 }
    ];
    const fb = (f, key, u0, v0, u1, v1, d0, d1) => { // caja sobre una fachada (u: a lo largo, v: altura, d: hacia fuera)
      const ax = f.o[0] + f.u[0] * u0 + f.n[0] * d0, az = f.o[1] + f.u[1] * u0 + f.n[1] * d0;
      const bx = f.o[0] + f.u[0] * u1 + f.n[0] * d1, bz = f.o[1] + f.u[1] * u1 + f.n[1] * d1;
      full.box(key, Math.min(ax, bx), v0, Math.min(az, bz), Math.max(ax, bx) + 1e-3, v1, Math.max(az, bz) + 1e-3);
    };
    const beam = (f, u0, v0, u1, v1) => { // viga diagonal de entramado
      const len = Math.hypot(u1 - u0, v1 - v0), ang = Math.atan2(v1 - v0, u1 - u0);
      const g = new THREE.BoxGeometry(len, 0.1, 0.05).toNonIndexed();
      g.rotateZ(ang);
      if (f.u[1]) g.rotateY(-Math.PI / 2);
      const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
      g.translate(f.o[0] + f.u[0] * uc + f.n[0] * 0.025, vc, f.o[1] + f.u[1] * uc + f.n[1] * 0.025);
      full.add('trim', Geo.worldUV(g, 1.5));
    };
    const shutters = b.facade === 'plaster' || b.facade === 'timber';
    const winW = 0.5, winH = Math.min(0.62, H * 0.32), winV = Math.max(doorH * 0.45, H * 0.42);
    for (const f of faces) {
      const n = Math.max(1, Math.floor(f.len / 1.5));
      for (let i = 0; i < n; i++) {
        const uc = (i + 0.5) * f.len / n;
        if (f.south && Math.abs(f.o[0] + uc - dx) < 0.95) continue;
        fb(f, 'frame', uc - winW / 2 - 0.06, winV - 0.06, uc + winW / 2 + 0.06, winV + winH + 0.06, 0, 0.04);
        fb(f, 'glass', uc - winW / 2, winV, uc + winW / 2, winV + winH, 0, 0.05);
        fb(f, 'frame', uc - 0.025, winV, uc + 0.025, winV + winH, 0, 0.07);
        fb(f, 'frame', uc - winW / 2, winV + winH / 2 - 0.025, uc + winW / 2, winV + winH / 2 + 0.025, 0, 0.07);
        fb(f, 'stone', uc - winW / 2 - 0.1, winV - 0.12, uc + winW / 2 + 0.1, winV - 0.05, 0, 0.1);
        if (shutters) {
          fb(f, 'shutter', uc - winW / 2 - 0.3, winV - 0.04, uc - winW / 2 - 0.07, winV + winH + 0.04, 0, 0.05);
          fb(f, 'shutter', uc + winW / 2 + 0.07, winV - 0.04, uc + winW / 2 + 0.3, winV + winH + 0.04, 0, 0.05);
        }
      }
      if (b.facade === 'timber') {
        fb(f, 'trim', 0, 0.28, f.len, 0.38, 0, 0.05);
        fb(f, 'trim', 0, H - 0.12, f.len, H, 0, 0.05);
        fb(f, 'trim', 0, winV + winH + 0.1, f.len, winV + winH + 0.2, 0, 0.05);
        for (let u = 0; u <= f.len + 0.01; u += f.len / Math.max(2, Math.round(f.len / 1.3))) {
          fb(f, 'trim', Math.max(0, u - 0.05), 0.28, Math.min(f.len, u + 0.05), H, 0, 0.05);
        }
        const bays = Math.max(2, Math.round(f.len / 1.3)), bw = f.len / bays;
        for (let k = 0; k < bays; k += 2) {
          if (f.south && Math.abs(f.o[0] + (k + 0.5) * bw - dx) < 0.9) continue;
          beam(f, k * bw + 0.08, 0.4, (k + 1) * bw - 0.08, winV - 0.1);
        }
      } else if (b.facade !== 'wood') {
        fb(f, 'stone', -0.03, H - 0.14, f.len + 0.03, H, 0, 0.06); // cornisa
      }
    }
    // marco y hoja de puerta
    const sf = faces[0], du = dx - wx0;
    fb(sf, 'trim', du - dw - 0.08, 0, du - dw, doorH + 0.08, 0, 0.06);
    fb(sf, 'trim', du + dw, 0, du + dw + 0.08, doorH + 0.08, 0, 0.06);
    fb(sf, 'trim', du - dw - 0.08, doorH, du + dw + 0.08, doorH + 0.1, 0, 0.06);
    full.box('door', dx - dw, 0, wz1 - th - 0.75, dx - dw + 0.06, doorH, wz1 - th);

    // tejado
    const o = 0.32, R = b.R * 1.55;
    const ex0 = wx0 - o, ex1 = wx1 + o, ez0 = wz0 - o, ez1 = wz1 + o, zm = (ez0 + ez1) / 2;
    const roofKey = { terracotta: 'tiles', slate: 'slate', metal: 'metalRoof', flat: 'concrete', dome: 'white' }[b.roof];
    const A = [ex0, H, ez0], B = [ex1, H, ez0], C = [ex1, H, ez1], D = [ex0, H, ez1];
    let tris = null;
    if (b.roof === 'none') { /* sin tejado */ }
    else if (b.roof === 'flat') { // azotea con pretil
      full.box('concrete', wx0 - 0.05, H, wz0 - 0.05, wx1 + 0.05, H + 0.12, wz1 + 0.05);
      full.box(fac, wx0 - 0.05, H + 0.12, wz0 - 0.05, wx1 + 0.05, H + 0.42, wz0 + 0.12);
      full.box(fac, wx0 - 0.05, H + 0.12, wz1 - 0.12, wx1 + 0.05, H + 0.42, wz1 + 0.05);
      full.box(fac, wx0 - 0.05, H + 0.12, wz0, wx0 + 0.12, H + 0.42, wz1);
      full.box(fac, wx1 - 0.12, H + 0.12, wz0, wx1 + 0.05, H + 0.42, wz1);
      full.box('rubber', wx0 + 0.6, H + 0.12, wz0 + 0.5, wx0 + 1.2, H + 0.5, wz0 + 1.0);
    } else if (b.roof === 'dome') { // cúpula del radiotelescopio con su ranura
      const cx = (wx0 + wx1) / 2, cz = (wz0 + wz1) / 2, rad = Math.min(wx1 - wx0, wz1 - wz0) / 2 + 0.2;
      const dg = new THREE.SphereGeometry(rad, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed(); dg.translate(cx, H, cz);
      full.add('white', Geo.worldUV(dg, 2));
      const slot = new THREE.BoxGeometry(0.9, rad * 0.3, rad * 1.02).toNonIndexed(); slot.translate(0, rad * 0.86, rad * 0.25); slot.rotateX(-0.45); slot.translate(cx, H, cz);
      full.add('rubber', Geo.worldUV(slot, 1));
      full.box('concrete', wx0 - 0.05, H - 0.1, wz0 - 0.05, wx1 + 0.05, H + 0.08, wz1 + 0.05);
    } else if (b.roof === 'metal') {
      const P = [ex0, H + R, zm], Q = [ex1, H + R, zm];
      tris = [[A, B, Q], [A, Q, P], [D, P, Q], [D, Q, C]];
      // hastiales
      const g1 = [[wx0, H, wz0], [wx0, H, wz1], [wx0, H + R * 0.9, (wz0 + wz1) / 2], [-1, 0, 0]];
      const g2 = [[wx1, H, wz0], [wx1, H, wz1], [wx1, H + R * 0.9, (wz0 + wz1) / 2], [1, 0, 0]];
      full.add(fac, Geo.tris([g1, g2], Mats.scale(fac)));
    } else {
      const d = (ez1 - ez0) / 2;
      const P = [Math.min(ex0 + d, (ex0 + ex1) / 2), H + R, zm], Q = [Math.max(ex1 - d, (ex0 + ex1) / 2), H + R, zm];
      tris = [[A, B, Q], [A, Q, P], [D, P, Q], [D, Q, C], [A, P, D], [B, C, Q]];
    }
    if (tris) full.add(roofKey, Geo.tris(tris, Mats.scale(roofKey)));
    if (tris) {
    // canto del alero, canalones y bajantes
    full.box('trim', ex0, H - 0.1, ez1 - 0.06, ex1, H, ez1);
    full.box('trim', ex0, H - 0.1, ez0, ex0 + 0.06, H, ez1);
    full.box('gutter', ex0, H - 0.2, ez1, ex1, H - 0.08, ez1 + 0.1);
    for (const gx of [wx0 + 0.15, wx1 - 0.15]) full.box('gutter', gx - 0.04, 0.05, wz1 + 0.02, gx + 0.04, H - 0.12, wz1 + 0.1);
    }
    full.box('stone', dx - dw - 0.1, 0, wz1, dx + dw + 0.1, 0.12, wz1 + 0.35);
    if (b.chimney) {
      const cx = ex0 + (ex1 - ex0) * 0.7, cz = ez0 + (ez1 - ez0) * 0.4;
      full.box('bricks', cx - 0.2, H, cz - 0.2, cx + 0.2, H + R + 0.55, cz + 0.2);
      full.box('stone', cx - 0.25, H + R + 0.55, cz - 0.25, cx + 0.25, H + R + 0.65, cz + 0.25);
    }

    // interior: suelo de tablones y mobiliario
    inner.box('floor', wx0 + th, 0, wz0 + th, wx1 - th, 0.03, wz1 - th);
    this.furniture(inner, b, wx0 + th, wz0 + th, wx1 - th, wz1 - th);

    const g = { full: full.build(), cut: cut.build(), inner: inner.build(), H: H + R };
    g.cut.visible = false;
    return g;
  },

  furniture(B, b, x0, z0, x1, z1) {
    const r = mulberry32(b.x * 3 + b.y);
    const w = x1 - x0, d = z1 - z0;
    if (b.furn === 'servers') { // racks de servidores con luces
      for (let x = x0 + 0.4; x + 0.6 < x1; x += 1.3) for (const zz of [z0 + 0.4, z0 + 2.4]) {
        B.box('rubber', x, 0, zz, x + 0.6, 1.5, zz + 0.8);
        for (let k = 0; k < 5; k++) B.box(k % 2 ? 'lamp' : 'shutter', x + 0.08, 0.25 + k * 0.25, zz + 0.81, x + 0.14, 0.29 + k * 0.25, zz + 0.83);
      }
      B.box('door', x0 + 0.5, 0, z1 - 1.4, x0 + 2.5, 0.8, z1 - 0.8);
      return;
    }
    if (b.furn === 'ruin') return;
    if (b.furn === 'bunks') {
      for (let x = x0 + 0.2; x + 0.8 < x1; x += 1.15) {
        B.box('trim', x, 0, z0 + 0.1, x + 0.8, 0.35, z0 + 1.7);
        B.box('canvas', x + 0.05, 0.35, z0 + 0.15, x + 0.75, 0.45, z0 + 1.65);
        B.box('white', x + 0.12, 0.45, z0 + 0.2, x + 0.68, 0.52, z0 + 0.5);
        B.box('trim', x, 0, z0 + 0.1, x + 0.06, 1.2, z0 + 0.16);
        B.box('trim', x + 0.74, 0, z0 + 0.1, x + 0.8, 1.2, z0 + 0.16);
        B.box('trim', x, 0.9, z0 + 0.1, x + 0.8, 1.0, z0 + 1.7);
      }
      B.box('door', x0 + w * 0.4, 0, z1 - 1.1, x0 + w * 0.4 + 1.6, 0.75, z1 - 0.4);
    } else if (b.furn === 'office') {
      B.box('door', x0 + w * 0.25, 0, z0 + d * 0.3, x0 + w * 0.75, 0.78, z0 + d * 0.62);
      B.box('frame', x0 + w * 0.3, 0.78, z0 + d * 0.35, x0 + w * 0.7, 0.8, z0 + d * 0.57);
      B.box('red', x0 + 0.2, 0.01, z1 - 1.2, x1 - 0.2, 0.04, z1 - 0.4);
      B.box('oliveDark', x0 + 0.1, 0, z0 + 0.1, x0 + 0.6, 1.5, z0 + 0.5);
    } else if (b.furn === 'storage') {
      for (let k = 0; k < 9; k++) {
        const x = x0 + r() * (w - 0.8), z = z0 + r() * (d - 0.8), h = 0.6 + (r() < 0.4 ? 0.6 : 0);
        B.box(r() < 0.6 ? 'crate' : 'oliveDark', x, 0, z, x + 0.7, h, z + 0.7);
      }
    } else if (b.furn === 'guard') {
      B.box('door', x0 + 0.2, 0, z0 + 0.2, x0 + 1.4, 0.75, z0 + 0.8);
      B.box('rubber', x0 + 0.4, 0.75, z0 + 0.3, x0 + 0.7, 0.95, z0 + 0.55);
      for (let k = 0; k < 3; k++) B.box('olive', x1 - 0.3, 0, z0 + 0.3 + k * 0.4, x1 - 0.1, 1.0, z0 + 0.42 + k * 0.4);
    } else {
      B.box('door', x0 + 0.15, 0, z0 + 0.15, x0 + 1.0, 0.45, z0 + 1.8);
      B.box('red', x0 + 0.2, 0.45, z0 + 0.5, x0 + 0.95, 0.52, z0 + 1.75);
      B.box('white', x0 + 0.25, 0.45, z0 + 0.2, x0 + 0.9, 0.55, z0 + 0.48);
      B.box('door', x1 - 1.3, 0, z1 - 1.2, x1 - 0.4, 0.75, z1 - 0.5);
      B.box('red', x0 + w / 2 - 0.8, 0.01, z0 + d / 2 - 0.5, x0 + w / 2 + 0.8, 0.025, z0 + d / 2 + 0.5);
    }
  }
};

// ---------------- OBJETOS ----------------
const Props = {
  cyl(B, key, cx, cy, cz, r, len, axis, seg) {
    const g = new THREE.CylinderGeometry(r, r, len, seg || 14).toNonIndexed();
    if (axis === 'x') g.rotateZ(Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2);
    g.translate(cx, cy, cz);
    return B.add(key, g);
  },

  build(B, p) {
    const x0 = p.x, z0 = p.y, x1 = p.x + p.w, z1 = p.y + p.h, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const r = mulberry32((p.seed || 1) * 7 + p.x);
    switch (p.type) {
      case 'blockwall': { // muro de hormigón que cierra el cañón
        if (p.destroyed) { for (let k = 0; k < 12; k++) { const g = new THREE.BoxGeometry(0.3 + r() * 0.6, 0.15 + r() * 0.35, 0.3 + r() * 0.5).toNonIndexed(); g.rotateY(r() * 6); g.translate(x0 - 0.5 + r() * 2, 0.1, z0 + r() * p.h); B.add('concrete', Geo.worldUV(g, 1.5)); } break; }
        B.box('concrete', x0 + 0.1, 0, z0, x1 - 0.1, 2.4, z1);
        for (let z = z0; z < z1; z += 1) B.box('stone', x0 + 0.05, 2.4, z + 0.05, x1 - 0.05, 2.55, z + 0.95);
        B.box('red', x1 - 0.08, 1.2, z0 + p.h / 2 - 0.6, x1 - 0.04, 1.6, z0 + p.h / 2 + 0.6);
        break;
      }
      case 'minesign': {
        B.box('post', cx - 0.04, 0, cz - 0.04, cx + 0.04, 1.0, cz + 0.04);
        const g = new THREE.BoxGeometry(0.45, 0.45, 0.03).toNonIndexed(); g.rotateZ(Math.PI / 4); g.translate(cx, 1.05, cz); B.add('red', Geo.worldUV(g, 1));
        break;
      }
      case 'barrier': {
        B.box('olive', cx - 0.12, 0, z0 - 0.2, cx + 0.12, 1.0, z0 + 0.1);
        for (let k = 0; k < 5; k++) B.box(k % 2 ? 'white' : 'red', cx - 0.05, 0.85, z0 + 0.1 + k * 0.4, cx + 0.05, 0.95, z0 + 0.5 + k * 0.4);
        break;
      }
      case 'watertower': {
        const Hp = 3.6;
        for (const [a, c] of [[x0 + 0.15, z0 + 0.15], [x1 - 0.15, z0 + 0.15], [x0 + 0.15, z1 - 0.15], [x1 - 0.15, z1 - 0.15]]) B.box('post', a - 0.08, 0, c - 0.08, a + 0.08, Hp, c + 0.08);
        for (const h of [1.2, 2.4]) { B.box('post', x0 + 0.1, h, z0 + 0.1, x1 - 0.1, h + 0.08, z0 + 0.2); B.box('post', x0 + 0.1, h, z1 - 0.2, x1 - 0.1, h + 0.08, z1 - 0.1); }
        this.cyl(B, 'tank', cx, Hp + 0.8, cz, 1.25, 1.6, 'y', 24);
        const cap = new THREE.ConeGeometry(1.32, 0.6, 24).toNonIndexed(); cap.translate(cx, Hp + 1.9, cz); B.add('metalRoof', Geo.worldUV(cap, 1.5));
        B.box('floor', x0 - 0.3, Hp - 0.05, z0 - 0.3, x1 + 0.3, Hp + 0.05, z1 + 0.3);
        for (let h = 0.2; h < Hp; h += 0.35) B.box('wire', cx - 0.25, h, z1 + 0.25, cx + 0.25, h + 0.04, z1 + 0.29);
        break;
      }
      case 'tank': { // carro de combate ligero
        B.box('oliveDark', x0 + 0.1, 0.05, z0 + 0.05, x1 - 0.1, 0.55, z0 + 0.5); B.box('oliveDark', x0 + 0.1, 0.05, z1 - 0.5, x1 - 0.1, 0.55, z1 - 0.05);
        for (let x = x0 + 0.4; x < x1 - 0.3; x += 0.6) { this.cyl(B, 'rubber', x, 0.28, z0 + 0.27, 0.22, 0.46, 'z', 12); this.cyl(B, 'rubber', x, 0.28, z1 - 0.27, 0.22, 0.46, 'z', 12); }
        B.box('olive', x0 + 0.2, 0.5, z0 + 0.2, x1 - 0.2, 1.05, z1 - 0.2);
        this.cyl(B, 'olive', cx - 0.2, 1.3, cz, 0.62, 0.5, 'y', 18);
        this.cyl(B, 'oliveDark', cx + 1.0, 1.3, cz, 0.08, 2.0, 'x', 10);
        B.box('rubber', cx - 0.5, 1.55, cz - 0.15, cx - 0.2, 1.65, cz + 0.15);
        break;
      }
      case 'car': {
        const col = ['olive', 'barrelR', 'tank', 'shutter'][(p.seed || 0) % 4];
        for (const wx of [x0 + 0.35, x1 - 0.35]) for (const zz of [z0 + 0.12, z1 - 0.12]) this.cyl(B, 'rubber', wx, 0.2, zz, 0.2, 0.14, 'z', 12);
        B.box(col, x0 + 0.05, 0.2, z0 + 0.08, x1 - 0.05, 0.6, z1 - 0.08);
        B.box(col, x0 + 0.5, 0.6, z0 + 0.12, x1 - 0.4, 0.95, z1 - 0.12);
        B.box('glass', x0 + 0.45, 0.62, z0 + 0.1, x1 - 0.35, 0.9, z1 - 0.1);
        break;
      }
      case 'carport': {
        for (const [a, c] of [[x0 + 0.2, z0 + 0.2], [x1 - 0.2, z0 + 0.2], [x0 + 0.2, z1 - 0.2], [x1 - 0.2, z1 - 0.2]]) B.box('gutter', a - 0.06, 0, c - 0.06, a + 0.06, 2.2, c + 0.06);
        B.box('metalRoof', x0, 2.2, z0, x1, 2.3, z1);
        break;
      }
      case 'substation': { // transformadores con aisladores
        B.box('concrete', x0 - 0.2, 0, z0 - 0.2, x1 + 0.2, 0.15, z1 + 0.2);
        for (let k = 0; k < 2; k++) {
          const bx = x0 + 0.3 + k * 2;
          B.box('tank', bx, 0.15, z0 + 0.2, bx + 1.4, 1.6, z1 - 0.2);
          for (let f = 0; f < 6; f++) B.box('gutter', bx - 0.05, 0.3 + f * 0.2, z0 + 0.25, bx, 0.38 + f * 0.2, z1 - 0.25);
          for (let q = 0; q < 3; q++) { this.cyl(B, 'white', bx + 0.3 + q * 0.4, 1.9, cz, 0.06, 0.6, 'y', 8); this.cyl(B, 'white', bx + 0.3 + q * 0.4, 2.0, cz, 0.1, 0.06, 'y', 8); }
        }
        B.box('red', x1 - 0.5, 0.6, z1 - 0.18, x1 - 0.1, 0.9, z1 - 0.15);
        break;
      }
      case 'dish': { // antena parabólica del radiotelescopio
        B.box('concrete', x0 + 1.5, 0, z0 + 1.5, x1 - 1.5, 0.6, z1 - 1.5);
        this.cyl(B, 'tank', cx, 1.6, cz, 0.45, 2.0, 'y', 16);
        B.box('oliveDark', cx - 0.5, 2.4, cz - 0.5, cx + 0.5, 3.0, cz + 0.5);
        const dg = new THREE.SphereGeometry(3.2, 32, 12, 0, Math.PI * 2, 0, 0.75).toNonIndexed();
        dg.scale(1, 0.5, 1); dg.rotateX(Math.PI); dg.rotateX(-0.75); dg.translate(cx, 4.6, cz + 0.4);
        const mg = Mats.get('white'); B.add('white', Geo.worldUV(dg, 3)); mg.side = THREE.DoubleSide;
        this.cyl(B, 'gutter', cx, 4.8, cz - 0.2, 0.05, 2.6, 'y', 6);
        B.box('rubber', cx - 0.4, 0.6, z1 - 1.3, cx + 0.4, 1.2, z1 - 0.9); // motor de rotación
        break;
      }
      case 'lamp': {
        B.box('gutter', cx - 0.05, 0, cz - 0.05, cx + 0.05, 3.0, cz + 0.05);
        B.box('gutter', cx - 0.05, 2.95, cz - 0.05, cx + 0.45, 3.02, cz + 0.05);
        B.box('lamp', cx + 0.3, 2.86, cz - 0.08, cx + 0.5, 2.96, cz + 0.08);
        break;
      }
      case 'searchlight': {
        B.box('gutter', cx - 0.08, 0, cz - 0.08, cx + 0.08, 4.0, cz + 0.08);
        this.cyl(B, 'oliveDark', cx, 4.15, cz, 0.28, 0.4, 'y', 14);
        this.cyl(B, 'lamp', cx, 4.15, cz, 0.22, 0.42, 'y', 14);
        break;
      }
      case 'stairs': {
        for (let k = 0; k < 4; k++) B.box('concrete', x0, 0, z0 + k * 0.25, x1, 0.2 + k * 0.12, z0 + (k + 1) * 0.25);
        break;
      }
      case 'crate': {
        const s = 0.08, h = 0.72;
        B.box('crate', x0 + s, 0, z0 + s, x1 - s, h, z1 - s);
        for (const [a, c] of [[x0 + s, z0 + s], [x1 - s - 0.07, z0 + s], [x0 + s, z1 - s - 0.07], [x1 - s - 0.07, z1 - s - 0.07]]) B.box('trim', a, 0, c, a + 0.07, h + 0.01, c + 0.07);
        B.box('trim', x0 + s, h - 0.06, z1 - s, x1 - s, h, z1 - s + 0.02);
        B.box('trim', x0 + s, 0.0, z1 - s, x1 - s, 0.06, z1 - s + 0.02);
        if (r() < 0.5) B.box('crate', x0 + 0.2, h, z0 + 0.2, x1 - 0.25, h + 0.4, z1 - 0.25);
        break;
      }
      case 'sandbag': {
        for (let layer = 0; layer < 4; layer++) {
          for (let k = 0; k < 3; k++) {
            const g = new THREE.SphereGeometry(0.5, 10, 6).toNonIndexed();
            g.scale(0.36, 0.13, 0.24);
            g.translate(x0 + 0.18 + k * 0.32 + (layer % 2) * 0.12, 0.1 + layer * 0.2, cz + (r() - 0.5) * 0.06);
            B.add('sand', Geo.worldUV(g, 0.6));
          }
        }
        break;
      }
      case 'barrels': {
        for (const [ox, oz] of [[0.3, 0.3], [0.7, 0.35], [0.5, 0.72]]) {
          const key = r() < 0.3 ? 'barrelR' : 'barrelG';
          this.cyl(B, key, x0 + ox, 0.36, z0 + oz, 0.2, 0.72, 'y', 14);
          this.cyl(B, 'rubber', x0 + ox, 0.24, z0 + oz, 0.205, 0.03, 'y', 14);
          this.cyl(B, 'rubber', x0 + ox, 0.5, z0 + oz, 0.205, 0.03, 'y', 14);
        }
        break;
      }
      case 'truck': case 'jeep': {
        const jeep = p.type === 'jeep', L = x1 - x0;
        const wy = jeep ? 0.28 : 0.38;
        const wheels = jeep ? [0.5, L - 0.55] : [0.6, 1.5, L - 0.6];
        for (const wx of wheels) for (const zz of [z0 + 0.25, z1 - 0.25]) {
          this.cyl(B, 'rubber', x0 + wx, wy, zz, wy, 0.26, 'z', 16);
          this.cyl(B, 'oliveDark', x0 + wx, wy, zz + (zz > cz ? 0.135 : -0.135), wy * 0.45, 0.02, 'z', 10);
        }
        if (jeep) {
          B.box('olive', x0 + 0.15, 0.32, z0 + 0.2, x1 - 0.1, 0.78, z1 - 0.2);
          B.box('oliveDark', x0 + 0.35, 0.78, z0 + 0.3, x0 + 1.6, 0.8, z1 - 0.3);
          B.box('canvas', x0 + 0.5, 0.78, z0 + 0.4, x0 + 0.95, 1.05, z1 - 0.4);
          B.box('canvas', x0 + 1.1, 0.78, z0 + 0.4, x0 + 1.5, 1.05, z1 - 0.4);
          B.box('glass', x0 + 1.75, 0.78, z0 + 0.3, x0 + 1.8, 1.25, z1 - 0.3);
          B.box('olive', x0 + 1.75, 0.78, z0 + 0.22, x0 + 1.81, 1.27, z0 + 0.3);
          B.box('olive', x0 + 1.75, 0.78, z1 - 0.3, x0 + 1.81, 1.27, z1 - 0.22);
          B.box('white', x1 - 0.85, 0.781, cz - 0.22, x1 - 0.4, 0.79, cz + 0.22);
          B.box('lamp', x1 - 0.12, 0.6, z0 + 0.3, x1 - 0.08, 0.7, z0 + 0.45);
          B.box('lamp', x1 - 0.12, 0.6, z1 - 0.45, x1 - 0.08, 0.7, z1 - 0.3);
        } else {
          B.box('oliveDark', x0 + 0.1, 0.45, z0 + 0.15, x1 - 0.05, 0.75, z1 - 0.15);
          const bx1 = x0 + 2.75;
          B.box('olive', x0 + 0.05, 0.75, z0 + 0.1, bx1, 1.15, z1 - 0.1);
          // lona del camión: medio cilindro
          const g = new THREE.CylinderGeometry(0.9, 0.9, bx1 - x0 - 0.1, 18, 1, true, 0, Math.PI).toNonIndexed();
          g.rotateZ(Math.PI / 2);
          g.scale(1, 0.75, 1);
          g.translate((x0 + 0.05 + bx1) / 2, 1.15, cz);
          B.add('tarp', Geo.worldUV(g, 1.2));
          for (let k = 0; k < 4; k++) {
            const gx = x0 + 0.3 + k * 0.7;
            const rib = new THREE.TorusGeometry(0.9, 0.03, 4, 16, Math.PI).toNonIndexed();
            rib.rotateY(Math.PI / 2); rib.scale(1, 0.75, 1); rib.translate(gx, 1.15, cz);
            B.add('oliveDark', Geo.worldUV(rib, 1));
          }
          B.box('olive', bx1 + 0.08, 0.75, z0 + 0.12, x1 - 0.05, 1.75, z1 - 0.12);
          B.box('glass', x1 - 0.06, 1.25, z0 + 0.25, x1 - 0.03, 1.65, z1 - 0.25);
          B.box('glass', bx1 + 0.3, 1.25, z1 - 0.13, bx1 + 0.85, 1.6, z1 - 0.1);
          B.box('olive', x1 - 0.55, 0.75, z0 + 0.05, x1 + 0.25, 1.15, z1 - 0.05);
          B.box('lamp', x1 + 0.2, 0.95, z0 + 0.2, x1 + 0.26, 1.07, z0 + 0.38);
          B.box('lamp', x1 + 0.2, 0.95, z1 - 0.38, x1 + 0.26, 1.07, z1 - 0.2);
        }
        break;
      }
      case 'tent': {
        const H = 1.55, e = 0.05;
        const P = [x0 + 0.1, H, cz], Q = [x1 - 0.1, H, cz];
        B.add('canvas', Geo.tris([
          [[x0, e, z0], [x1, e, z0], Q], [[x0, e, z0], Q, P],
          [[x0, e, z1], P, Q], [[x0, e, z1], Q, [x1, e, z1]],
          [[x0, e, z0], [x0, e, z1], P, [-1, 0, 0]], [[x1, e, z0], [x1, e, z1], Q, [1, 0, 0]]
        ], 1.2));
        B.add('rubber', Geo.tris([[[x0 - 0.01, e, cz - 0.4], [x0 - 0.01, e, cz + 0.4], [x0 - 0.01, 1.0, cz], [-1, 0, 0]]], 1));
        this.cyl(B, 'post', x0 + 0.1, H / 2, cz, 0.04, H, 'y', 6);
        this.cyl(B, 'post', x1 - 0.1, H / 2, cz, 0.04, H, 'y', 6);
        break;
      }
      case 'tower': {
        const Hp = 3.2, s = 0.12;
        for (const [a, c] of [[x0 + s, z0 + s], [x1 - s, z0 + s], [x0 + s, z1 - s], [x1 - s, z1 - s]])
          B.box('post', a - 0.07, 0, c - 0.07, a + 0.07, Hp + 1.75, c + 0.07);
        for (const zz of [z0 + s, z1 - s]) {
          const g = new THREE.BoxGeometry(Math.hypot(x1 - x0, Hp), 0.07, 0.05).toNonIndexed();
          g.rotateZ(Math.atan2(Hp, x1 - x0 - 2 * s)); g.translate(cx, Hp / 2, zz);
          B.add('post', Geo.worldUV(g, 1));
        }
        B.box('floor', x0 - 0.15, Hp, z0 - 0.15, x1 + 0.15, Hp + 0.12, z1 + 0.15);
        B.box('wood', x0 - 0.15, Hp + 0.12, z1 + 0.1, x1 + 0.15, Hp + 0.48, z1 + 0.15);
        B.box('wood', x0 - 0.15, Hp + 0.12, z0 - 0.15, x0 - 0.1, Hp + 0.48, z1 + 0.15);
        B.box('wood', x0 - 0.15, Hp + 0.12, z0 - 0.15, x1 + 0.15, Hp + 0.48, z0 - 0.1);
        B.box('wood', x1 + 0.1, Hp + 0.12, z0 - 0.15, x1 + 0.15, Hp + 0.48, z1 + 0.15);
        const yR = Hp + 1.75, a0 = x0 - 0.4, a1 = x1 + 0.4, c0 = z0 - 0.4, c1 = z1 + 0.4, ap = [cx, yR + 0.8, cz];
        B.add('metalRoof', Geo.tris([[[a0, yR, c0], [a1, yR, c0], ap], [[a1, yR, c0], [a1, yR, c1], ap], [[a1, yR, c1], [a0, yR, c1], ap], [[a0, yR, c1], [a0, yR, c0], ap]], 1.5));
        B.box('rubber', x1 - 0.1, Hp + 0.48, z1 - 0.1, x1 + 0.2, Hp + 0.72, z1 + 0.2);
        B.box('lamp', x1 + 0.2, Hp + 0.52, z1 - 0.05, x1 + 0.22, Hp + 0.67, z1 + 0.15);
        break;
      }
      case 'depot': {
        if (Level.depot.destroyed) {
          for (let k = 0; k < 14; k++) {
            const g = new THREE.BoxGeometry(0.3 + r() * 0.9, 0.08 + r() * 0.35, 0.2 + r() * 0.6).toNonIndexed();
            g.rotateY(r() * 6.28); g.rotateZ((r() - 0.5) * 0.8);
            g.translate(x0 + r() * 3, 0.1, z0 + r() * 3);
            B.add('burnt', Geo.worldUV(g, 1));
          }
          const g = new THREE.CylinderGeometry(0.42, 0.42, 1.6, 12, 1, true, 0, 3.6).toNonIndexed();
          g.rotateZ(Math.PI / 2 + 0.3); g.rotateY(0.5); g.translate(cx, 0.35, cz); B.add('burnt', Geo.worldUV(g, 1));
          break;
        }
        for (let j = 0; j < 3; j++) {
          const zz = z0 + 0.5 + j;
          this.cyl(B, 'tank', cx, 0.62, zz, 0.44, 2.7, 'x', 20);
          for (const ex of [x0 + 0.15, x1 - 0.15]) {
            const cap = new THREE.SphereGeometry(0.44, 16, 8).toNonIndexed(); cap.scale(0.25, 1, 1); cap.translate(ex, 0.62, zz);
            B.add('tank', Geo.worldUV(cap, 2));
          }
          for (const bx of [x0 + 0.7, x1 - 0.7]) { this.cyl(B, 'rubber', bx, 0.62, zz, 0.452, 0.08, 'x', 20); B.box('oliveDark', bx - 0.12, 0, zz - 0.35, bx + 0.12, 0.3, zz + 0.35); }
          if (j === 2) this.cyl(B, 'red', cx, 0.62, zz, 0.448, 0.5, 'x', 20);
        }
        this.cyl(B, 'rubber', x1 - 0.4, 1.2, z0 + 0.5, 0.05, 0.3, 'y', 6);
        break;
      }
    }
  },

  // Roca: icosaedro deformado con la textura de piedra
  rock(B, x, z, s, seed, tall) {
    const r = mulberry32((seed || 1) * 17 + 3);
    const g = new THREE.IcosahedronGeometry(0.6 * s, 1).toNonIndexed(), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i), k = 1 + (Noise.value(vx * 3 + seed, vz * 3 + vy * 2) - 0.5) * 0.6;
      p.setXYZ(i, vx * k, Math.max(-0.05, vy * k * (tall || 0.75)), vz * k);
    }
    g.computeVertexNormals(); g.rotateY(r() * 6); g.translate(x, 0.6 * s * 0.25, z);
    B.add('rockM', Geo.worldUV(g, 1.5));
  },

  fences(B) {
    for (let ty = 0; ty < Level.H; ty++) for (let tx = 0; tx < Level.W; tx++) {
      if (Level.at(tx, ty) !== 'f') continue;
      const cx = tx + 0.5, cz = ty + 0.5;
      B.box('post', cx - 0.05, 0, cz - 0.05, cx + 0.05, 1.15, cz + 0.05);
      const hz = Level.at(tx + 1, ty) === 'f', vt = Level.at(tx, ty + 1) === 'f';
      for (const h of [0.3, 0.55, 0.8, 1.05]) {
        if (hz) B.box('wire', cx, h, cz - 0.01, cx + 1, h + 0.02, cz + 0.01);
        if (vt) B.box('wire', cx - 0.01, h, cz, cx + 0.01, h + 0.02, cz + 1);
      }
      if (hz && (tx % 2 === 0)) { const g = new THREE.TorusGeometry(0.12, 0.012, 3, 10).toNonIndexed(); g.rotateY(Math.PI / 2); g.translate(cx + 0.5, 1.2, cz); B.add('wire', Geo.worldUV(g, 1)); }
    }
  },

  bridges(B) {
    for (let ty = 0; ty < Level.H; ty++) for (let tx = 0; tx < Level.W; tx++) {
      if (Level.floorAt(tx, ty) !== 'b') continue;
      B.box('floor', tx, 0, ty, tx + 1, 0.12, ty + 1);
      for (const [edge, z] of [[Level.floorAt(tx, ty - 1) !== 'b', ty + 0.05], [Level.floorAt(tx, ty + 1) !== 'b', ty + 0.95]]) {
        if (!edge) continue;
        B.box('post', tx + 0.45, 0, z - 0.05, tx + 0.55, 0.85, z + 0.05);
        B.box('post', tx, 0.75, z - 0.04, tx + 1, 0.83, z + 0.04);
        B.box('post', tx, 0.4, z - 0.03, tx + 1, 0.46, z + 0.03);
      }
    }
  }
};

// ---------------- VEGETACIÓN ----------------
// Copas hechas con tarjetas de racimos de hojas reales (alfa), normales hacia fuera
// para un sombreado volumétrico, y oclusión por vértice (más oscuras por dentro y por debajo).
const Veg = {
  card(B, key, px, py, pz, w, h, rot, nrm, ao) {
    const g = new THREE.PlaneGeometry(w, h).toNonIndexed();
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(rot));
    g.translate(px, py, pz);
    const n = g.attributes.normal, c = new Float32Array(n.count * 3);
    for (let i = 0; i < n.count; i++) { n.setXYZ(i, nrm.x, nrm.y, nrm.z); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = ao; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    B.add(key, g);
  },

  trunk(B, x, z, h, r0, lean) {
    const g = new THREE.CylinderGeometry(r0 * 0.55, r0, h, 8, 3).toNonIndexed();
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = (p.getY(i) + h / 2) / h; p.setX(i, p.getX(i) + (lean ? lean[0] : 0) * t * t); p.setZ(i, p.getZ(i) + (lean ? lean[1] : 0) * t * t); }
    g.computeVertexNormals();
    g.translate(x, h / 2, z);
    Geo.worldUV(g, 1); B.add('bark', g);
  },

  canopy(B, cx, cy, cz, rx, ry, n, size, r) {
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const a = r() * 6.283, b = Math.acos(2 * r() - 1), rad = 0.45 + 0.55 * Math.sqrt(r());
      const dx = Math.sin(b) * Math.cos(a), dy = Math.cos(b), dz = Math.sin(b) * Math.sin(a);
      const px = cx + dx * rx * rad, py = cy + dy * ry * rad * 0.9, pz = cz + dz * rx * rad;
      const nrm = new THREE.Vector3(dx, dy * 0.8 + 0.35, dz).normalize().lerp(up, 0.15).normalize();
      const t = clamp((py - (cy - ry)) / (2 * ry), 0, 1);
      const ao = clamp(0.28 + 0.72 * t * (0.45 + 0.55 * rad) + (r() - 0.5) * 0.14, 0.18, 1.05);
      const s = size * (0.8 + r() * 0.5);
      this.card(B, r() < 0.5 ? 'leaf' : 'leaf2', px, py, pz, s, s, new THREE.Euler(r() * 6.28, r() * 6.28, r() * 6.28), nrm, ao);
    }
  },

  oak(B, x, z, seed, scale) {
    const r = mulberry32(seed), s = scale || 1, lean = [(r() - 0.5) * 0.5, (r() - 0.5) * 0.5];
    this.trunk(B, x, z, 2.4 * s, 0.2 * s, lean);
    for (const a of [r() * 6, 2 + r() * 2, 4 + r() * 2]) {
      const g = new THREE.CylinderGeometry(0.035 * s, 0.09 * s, 1.1 * s, 6).toNonIndexed();
      g.rotateZ(0.85); g.rotateY(a); g.translate(x + lean[0] * 0.6 + Math.cos(a) * 0.32 * s, 2.0 * s, z + lean[1] * 0.6 - Math.sin(a) * 0.32 * s);
      Geo.worldUV(g, 1); B.add('bark', g);
    }
    const cx = x + lean[0], cz = z + lean[1];
    this.canopy(B, cx, 2.75 * s, cz, 1.55 * s, 1.15 * s, 42, 1.25 * s, r);
    // racimos secundarios para romper la silueta
    for (let k = 0; k < 3; k++) {
      const a = r() * 6.28;
      this.canopy(B, cx + Math.cos(a) * 0.9 * s, (2.4 + r() * 0.6) * s, cz + Math.sin(a) * 0.9 * s, 0.75 * s, 0.6 * s, 9, 1.0 * s, r);
    }
  },

  pine(B, x, z, seed, scale, simple) {
    const r = mulberry32(seed), s = scale || 1;
    this.trunk(B, x, z, 3.9 * s, 0.14 * s);
    const whorls = simple ? 5 : 9, per = simple ? 5 : 7;
    for (let i = 0; i < whorls; i++) {
      const t = i / (whorls - 1), y = (0.75 + t * 3.1) * s, R = (1.35 - t * 1.0) * s;
      for (let k = 0; k < per; k++) {
        const a = (k / per) * 6.283 + i * 0.7 + r() * 0.4, len = R * (0.85 + r() * 0.3);
        const ca = Math.cos(a), sa = Math.sin(a);
        const nrm = new THREE.Vector3(ca, 0.9, sa).normalize();
        const ao = clamp(0.4 + 0.55 * t + (r() - 0.5) * 0.12, 0.3, 1);
        // rama radial que cae hacia fuera; dos tarjetas cruzadas para dar volumen
        for (const roll of simple ? [0] : [0, Math.PI / 2]) {
          const g = new THREE.PlaneGeometry(len * 1.05, len * 0.45).toNonIndexed();
          g.translate(len * 0.5, 0, 0);
          g.rotateX(roll - Math.PI / 2);
          g.rotateZ(-0.28);
          g.rotateY(-a);
          g.translate(x, y, z);
          const n = g.attributes.normal, c = new Float32Array(n.count * 3);
          for (let q = 0; q < n.count; q++) { n.setXYZ(q, nrm.x, nrm.y, nrm.z); c[q * 3] = c[q * 3 + 1] = c[q * 3 + 2] = ao; }
          g.setAttribute('color', new THREE.BufferAttribute(c, 3));
          B.add('pine', g);
        }
      }
    }
    // copa superior
    this.card(B, 'pine', x, 4.05 * s, z, 0.45 * s, 0.9 * s, new THREE.Euler(0, r() * 3, Math.PI / 2), new THREE.Vector3(0, 1, 0), 1);
    this.card(B, 'pine', x, 4.05 * s, z, 0.45 * s, 0.9 * s, new THREE.Euler(Math.PI / 2, r() * 3, Math.PI / 2), new THREE.Vector3(0, 1, 0), 1);
  },

  bush(B, x, z, seed) {
    const r = mulberry32(seed);
    this.canopy(B, x, 0.42, z, 0.62, 0.42, 11, 0.85, r);
  }
};

// ---------------- SOLDADOS ----------------
// Uniformes (según la enciclopedia de personajes de Commandos 2). Zonas: tunic (pecho), arms, hands,
// pants, boots (+ bootTop: altura de la caña), belt, collar, coat/coatCol (gabardina larga), gaiters, camo, scale [ancho, alto, fondo]
const SOLDIER_KIT = {
  // Fuerzas alemanas
  soldier:  { tunic: '#5f604c', arms: '#5f604c', pants: '#585a47', boots: '#141311', bootTop: 0.27, belt: '#1a1916', skin: '#cf9f7c', hat: 'helmet', hatCol: '#4c4f42', weapon: 'rifle', height: 1.78, build: {} },
  sergeant: { tunic: '#5c5e4a', arms: '#5c5e4a', pants: '#555744', boots: '#141311', bootTop: 0.27, belt: '#1a1916', collar: '#b6b6aa', skin: '#cf9f7c', hat: 'sidecap', hatCol: '#566050', weapon: 'smg', height: 1.78, width: 1.03, build: { chest: 1.06, belly: 1.06 } },
  officer:  { tunic: '#6a6b55', arms: '#6a6b55', pants: '#8a8268', boots: '#0d0c0b', bootTop: 0.31, belt: '#2a1d12', collar: '#c9c2a2', skin: '#d6a882', hat: 'cap', hatCol: '#5d6551', weapon: 'pistol', height: 1.81, width: 0.97, build: { chest: 1.0, belly: 0.96, shoulders: 1.0 } },
  gestapo:  { tunic: '#19191b', arms: '#19191b', coat: true, coatCol: '#1b1b1e', pants: '#141416', boots: '#0b0b0b', bootTop: 0.12, belt: '#0e0e10', collar: '#1b1b1e', skin: '#d6a882', hat: 'fedora', hatCol: '#121214', weapon: 'pistol', height: 1.82, width: 1.0, build: { chest: 1.04, belly: 1.05, hips: 1.08, legs: 1.04 } },
  esniper:  { tunic: '#45573a', arms: '#45573a', pants: '#3e4f36', boots: '#171511', bootTop: 0.2, belt: '#22201a', camo: ['#2e3b25', '#6a7346', '#3e5332'], skin: '#cf9f7c', hat: 'hood', hatCol: '#40523a', weapon: 'sniper', height: 1.78, build: {} },
  // Comandos
  beret:    { tunic: '#6a6f45', arms: 'skin', pants: '#4c5832', boots: '#231c14', bootTop: 0.16, belt: '#4a3016', beltW: 0.026, skin: '#c48c6a', hat: 'beret', hatCol: '#2b6a2a', weapon: null, height: 1.98, width: 1.1, build: { chest: 1.38, belly: 1.15, hips: 1.08, arms: 1.55, hands: 1.25, legs: 1.22, shoulders: 1.25, hipW: 1.1, head: 0.92 } },
  sniper:   { tunic: '#5d4a33', arms: '#5d4a33', hands: '#3a2616', coat: true, coatCol: '#5d4a33', pants: '#6a5a3d', boots: '#22170e', bootTop: 0.3, belt: '#2c1f13', skin: '#e0b48e', hat: 'flatcap', hatCol: '#4a3a26', weapon: 'sniper', height: 1.85, width: 0.86, build: { chest: 0.82, belly: 0.78, hips: 0.85, arms: 0.8, legs: 0.84, shoulders: 0.92, head: 0.96 } },
  spy:      { tunic: '#86745a', arms: '#86745a', coat: true, coatCol: '#86745a', pants: '#272a33', boots: '#0f0f10', bootTop: 0.1, belt: '#6a6252', collar: '#e6e2d6', skin: '#dcb08a', hat: 'fedora', hatCol: '#38383d', weapon: null, shirt: '#e6e2d6', height: 1.82, width: 0.92, build: { chest: 0.9, belly: 0.88, hips: 0.9, arms: 0.88, legs: 0.88, shoulders: 0.97 } },
  spyDis:   { tunic: '#6a6b55', arms: '#6a6b55', pants: '#8a8268', boots: '#0d0c0b', bootTop: 0.31, belt: '#2a1d12', collar: '#c9c2a2', skin: '#dcb08a', hat: 'cap', hatCol: '#5d6551', weapon: 'pistol', height: 1.82, width: 0.92, build: { chest: 0.9, belly: 0.88, hips: 0.9, arms: 0.88, legs: 0.88, shoulders: 0.97 } },
  sapper:   { tunic: '#5d583a', arms: '#5d583a', pants: '#5a5638', boots: '#221b13', bootTop: 0.11, gaiters: '#8a7f5c', belt: '#3c3624', beltW: 0.03, skin: '#d8a982', hat: 'brodie', hatCol: '#59593a', weapon: null, pack: '#4c472e', height: 1.78, width: 1.12, build: { chest: 1.18, belly: 1.32, hips: 1.2, arms: 1.15, legs: 1.15, hipW: 1.08, shoulders: 1.05 } },
  driver:   { tunic: '#5a3a22', arms: '#5a3a22', hands: '#2a1d14', pants: '#55603a', boots: '#2a1d14', bootTop: 0.14, belt: '#2a1d14', collar: '#2e2a26', skin: '#d4a07c', hat: 'flatcap', hatCol: '#3a3328', goggles: true, weapon: null, height: 1.75, width: 0.98, build: { chest: 1.0, belly: 0.98, arms: 0.98, legs: 0.97 } },
  thief:    { tunic: '#141a24', arms: '#141a24', pants: '#1c1f26', boots: '#0d0d0f', bootTop: 0.08, belt: '#0d0d0f', collar: '#141a24', skin: '#dcb08a', hat: 'beanie', hatCol: '#1c1f28', weapon: null, height: 1.63, width: 0.84, build: { chest: 0.82, belly: 0.8, hips: 0.85, arms: 0.8, legs: 0.82, shoulders: 0.9, head: 1.02 } },
  seductress: { tunic: '#7a1426', arms: '#7a1426', coat: true, coatCol: '#7a1426', pants: '#7a1426', boots: '#1a0c0e', bootTop: 0.05, belt: '#3a0a12', collar: '#e0b494', skin: '#e0b494', hat: 'hair', hatCol: '#3a2216', weapon: null, height: 1.74, width: 0.82, build: { chest: 0.86, belly: 0.74, hips: 1.04, arms: 0.74, hands: 0.85, legs: 0.8, shoulders: 0.84, hipW: 0.95, head: 0.94 } },
  // enemigos modernos (biblia de misiones)
  dsoldier:  { tunic: '#b49a6c', arms: '#b49a6c', pants: '#a68c60', boots: '#5a4630', bootTop: 0.17, belt: '#4a3c28', camo: ['#9c8258', '#c8b088', '#7e6a48'], skin: '#c89a74', hat: 'mhelmet', hatCol: '#a08860', weapon: 'smg', height: 1.78, build: {} },
  dsergeant: { tunic: '#a8905f', arms: '#a8905f', pants: '#9a8456', boots: '#5a4630', bootTop: 0.17, belt: '#4a3c28', camo: ['#94784e', '#c0a87c', '#76623e'], skin: '#c89a74', hat: 'boonie', hatCol: '#9a8456', weapon: 'smg', height: 1.78, width: 1.03, build: { chest: 1.06, belly: 1.06 } },
  dofficer:  { tunic: '#7a6a4a', arms: '#7a6a4a', pants: '#6a5c40', boots: '#2a1d12', bootTop: 0.28, belt: '#2a1d12', collar: '#5a4a30', skin: '#c89a74', hat: 'beret', hatCol: '#7a1a1a', weapon: 'pistol', height: 1.81, width: 0.97, build: {} },
  nsoldier:  { tunic: '#2c3036', arms: '#2c3036', pants: '#262a30', boots: '#0e0f11', bootTop: 0.17, belt: '#141518', camo: ['#22262c', '#3a4048', '#2c3036'], skin: '#c89a74', hat: 'beanie', hatCol: '#1a1c20', weapon: 'smg', height: 1.78, build: {} },
  nsergeant: { tunic: '#30353c', arms: '#30353c', pants: '#2a2e34', boots: '#0e0f11', bootTop: 0.17, belt: '#141518', skin: '#c89a74', hat: 'mhelmet', hatCol: '#2a2e34', weapon: 'smg', height: 1.78, width: 1.03, build: { chest: 1.06, belly: 1.06 } },
  nofficer:  { tunic: '#3a4048', arms: '#3a4048', pants: '#30353c', boots: '#0b0b0d', bootTop: 0.28, belt: '#141518', collar: '#e0dcd0', skin: '#d6a882', hat: 'cap', hatCol: '#2a2e34', weapon: 'pistol', height: 1.81, width: 0.97, build: {} },
  tech:      { tunic: '#2c4a78', arms: '#2c4a78', pants: '#2a4470', boots: '#2a2420', bootTop: 0.1, belt: '#c8c4b8', beltW: 0.008, collar: '#2c4a78', skin: '#d8ac86', hat: 'flatcap', hatCol: '#d8d4c8', weapon: null, height: 1.75, width: 1.02, build: { belly: 1.1 } },
};

const Soldier = {
  matCache: {},
  mat(col, ghost, shiny) {
    if (ghost) return ghost;
    const key = col + (shiny ? 's' : '');
    if (!this.matCache[key]) {
      const m = new THREE.MeshPhongMaterial({ color: col, shininess: shiny ? 30 : 4, specular: new THREE.Color(0x181818) });
      if (!shiny) m.map = Tex.get('plaster');
      this.matCache[key] = m;
    }
    return this.matCache[key];
  },

  // Construye un soldado. ghost: material único para la silueta.
  build(kind, ghost) {
    const K = SOLDIER_KIT[kind];
    const M = (c, s) => this.mat(c, ghost, s);
    const mesh = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = !ghost; return o; };
    const root = new THREE.Group(), pose = new THREE.Group(), body = new THREE.Group();
    root.add(pose); pose.add(body); pose.scale.setScalar(1.18);
    const parts = { root, pose, body };
    // piernas
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(side * 0.075, 0.43, 0);
      leg.add(mesh(new THREE.CapsuleGeometry(0.055, 0.3, 3, 8), M(K.pants), 0, -0.2, 0));
      leg.add(mesh(new THREE.BoxGeometry(0.11, 0.08, 0.18), M(K.boots, true), 0, -0.4, 0.03));
      body.add(leg); parts[side < 0 ? 'legL' : 'legR'] = leg;
    }
    // torso
    body.add(mesh(new THREE.BoxGeometry(0.29, 0.33, 0.17), M(K.tunic), 0, 0.6, 0));
    body.add(mesh(new THREE.BoxGeometry(0.3, 0.05, 0.18), M('#2a2418', true), 0, 0.45, 0));
    if (kind === 'spy') body.add(mesh(new THREE.BoxGeometry(0.08, 0.16, 0.01), M('#e8e4d8'), 0, 0.68, 0.086));
    if (K.pack) body.add(mesh(new THREE.BoxGeometry(0.24, 0.26, 0.12), M(K.pack), 0, 0.6, -0.14));
    if (K.armband) body.add(mesh(new THREE.BoxGeometry(0.07, 0.05, 0.1), M('#3a8a3a'), -0.18, 0.66, 0));
    // brazos
    for (const side of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(side * 0.19, 0.74, 0);
      arm.add(mesh(new THREE.CapsuleGeometry(0.045, 0.24, 3, 8), M(K.tunic), 0, -0.15, 0));
      arm.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), M(K.skin, true), 0, -0.32, 0));
      body.add(arm); parts[side < 0 ? 'armL' : 'armR'] = arm;
    }
    // cabeza y tocado
    const head = new THREE.Group(); head.position.set(0, 0.85, 0); body.add(head); parts.head = head;
    head.add(mesh(new THREE.SphereGeometry(0.085, 12, 10), M(K.skin, true), 0, 0, 0));
    const hc = M(K.hatCol, true);
    switch (K.hat) {
      case 'helmet':
        head.add(mesh(new THREE.SphereGeometry(0.105, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hc, 0, 0.01, -0.005));
        head.add(mesh(new THREE.CylinderGeometry(0.108, 0.13, 0.05, 14), hc, 0, -0.005, -0.01));
        break;
      case 'cap':
        head.add(mesh(new THREE.CylinderGeometry(0.115, 0.09, 0.07, 14), hc, 0, 0.08, 0));
        head.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.035, 14), M('#26261f', true), 0, 0.045, 0));
        head.add(mesh(new THREE.BoxGeometry(0.12, 0.012, 0.07), M('#121212', true), 0, 0.035, 0.09));
        break;
      case 'beret': {
        const b = mesh(new THREE.SphereGeometry(0.1, 12, 6), hc, -0.015, 0.07, 0); b.scale.set(1.1, 0.38, 1.05); b.rotation.z = 0.25; head.add(b);
        break;
      }
      case 'fieldcap':
        head.add(mesh(new THREE.SphereGeometry(0.095, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hc, 0, 0.02, 0));
        head.add(mesh(new THREE.BoxGeometry(0.12, 0.012, 0.08), hc, 0, 0.025, 0.1));
        break;
      case 'fedora':
        head.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.012, 16), hc, 0, 0.05, 0));
        head.add(mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.1, 14), hc, 0, 0.1, 0));
        head.add(mesh(new THREE.CylinderGeometry(0.091, 0.091, 0.025, 14), M('#151515', true), 0, 0.065, 0));
        break;
      case 'brodie':
        head.add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.015, 16), hc, 0, 0.05, 0));
        head.add(mesh(new THREE.SphereGeometry(0.095, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hc, 0, 0.04, 0));
        break;
    }
    // arma
    if (K.weapon === 'rifle' || K.weapon === 'sniper' || K.weapon === 'smg') {
      const rifle = new THREE.Group(), L = K.weapon === 'sniper' ? 0.75 : K.weapon === 'smg' ? 0.42 : 0.62;
      rifle.add(mesh(new THREE.BoxGeometry(0.035, 0.05, L * 0.55), M('#5a3a22', true), 0, 0, -L * 0.15));
      rifle.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, L * 0.55, 6), M('#1a1a1a', true), 0, 0.01, L * 0.3).rotateX(Math.PI / 2));
      if (K.weapon === 'sniper') rifle.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 8), M('#111111', true), 0, 0.05, 0.05).rotateX(Math.PI / 2));
      body.add(rifle); parts.rifle = rifle;
    }
    // cuerpo cargado (oculto por defecto)
    const carry = new THREE.Group();
    carry.add(mesh(new THREE.BoxGeometry(0.6, 0.15, 0.2), M('#5f6650'), 0, 0, 0));
    carry.add(mesh(new THREE.SphereGeometry(0.08, 10, 8), M('#d9ab84', true), 0.36, 0, 0));
    carry.position.set(0, 0.95, -0.02); carry.visible = false; body.add(carry); parts.carry = carry;
    root.userData.parts = parts;
    return root;
  },

  // Postura del soldado según su estado
  pose(root, s) {
    const P = root.userData.parts;
    root.position.set(s.x, 0, s.y);
    root.rotation.y = Math.PI / 2 - s.face;
    const ph = s.moving ? s.anim * 3 : 0, sw = s.moving ? Math.sin(ph) : 0;
    P.pose.rotation.set(0, 0, 0); P.pose.position.set(0, 0, 0);
    P.body.position.y = 0;
    if (s.lying) {
      P.pose.rotation.x = -Math.PI / 2; P.pose.position.y = 0.1;
      P.pose.rotation.z = s.side * 0.35;
    } else if (s.prone) { // cuerpo a tierra: boca abajo, arrastrándose
      P.pose.rotation.x = Math.PI / 2; P.pose.position.y = 0.13;
      const c = s.moving ? Math.sin(s.anim * 2.4) : 0;
      P.legL.rotation.set(c * 0.35, 0, 0.12); P.legR.rotation.set(-c * 0.35, 0, -0.12);
      P.armL.rotation.set(-2.6 + c * 0.4, 0, 0.3); P.armR.rotation.set(-2.6 - c * 0.4, 0, -0.3);
      P.body.position.y = 0;
      if (P.rifle) { P.rifle.position.set(0, 0.62, -0.11); P.rifle.rotation.set(-0.1, 0, 0.3); }
      P.carry.visible = false;
      return;
    }
    const cr = s.crouch && !s.lying;
    if (cr) P.body.position.y = -0.17;
    P.legL.rotation.set(cr ? -1.15 : sw * 0.6, 0, 0);
    P.legR.rotation.set(cr ? -0.35 : -sw * 0.6, 0, 0);
    P.body.position.y += s.moving && !cr ? Math.abs(Math.cos(ph)) * 0.02 : 0;
    P.armL.rotation.set(-sw * 0.5, 0, 0.08);
    P.armR.rotation.set(sw * 0.5, 0, -0.08);
    if (s.aim) { P.armR.rotation.set(-1.45, 0, 0); P.armL.rotation.set(-1.35, 0, 0.45); }
    if (s.busy === 'plant' || s.busy === 'knife' || s.busy === 'syringe') { P.armR.rotation.set(-1.0, 0, 0); P.armL.rotation.set(-0.9, 0, 0.3); }
    if (s.busy === 'throw') { P.armR.rotation.set(-2.6, 0, 0); }
    if (P.rifle) {
      if (s.aim) { P.rifle.position.set(0.08, 0.66, 0.22); P.rifle.rotation.set(0, 0, 0); }
      else { P.rifle.position.set(0, 0.62, -0.11); P.rifle.rotation.set(-0.35, 0, 0.6); }
    }
    P.carry.visible = !!s.carry;
  }
};
