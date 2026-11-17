'use strict';
// Render 3D isométrico con Three.js (cámara ortográfica a ~30° como Commandos 2).

const CAM_OFF = new THREE.Vector3(-1, 0.82, 1).normalize();   // la cámara mira desde el suroeste
const SCREEN_RIGHT = new THREE.Vector3(1, 0, 1).normalize();  // dirección en el suelo hacia la derecha de la pantalla
const SCREEN_UP = new THREE.Vector3(1, 0, -1).normalize();    // dirección en el suelo hacia arriba de la pantalla
const ELEV_SIN = CAM_OFF.y;

// ---------------- PARTÍCULAS ----------------
const FX = {
  parts: [], emitters: [], group: null, tex: null,
  init(scene) {
    this.group = new THREE.Group(); scene.add(this.group);
    const radial = (stops) => Tex.canvas(64, 64, (x) => {
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      stops.forEach(([o, c]) => g.addColorStop(o, c)); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    });
    this.tex = {
      soft: radial([[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]),
      fire: radial([[0, 'rgba(255,250,210,1)'], [0.35, 'rgba(255,170,50,.9)'], [1, 'rgba(160,40,0,0)']]),
      chip: radial([[0, 'rgba(40,32,24,1)'], [0.7, 'rgba(40,32,24,1)'], [1, 'rgba(40,32,24,0)']])
    };
    this.light = new THREE.PointLight(0xffa050, 0, 16, 1.6); scene.add(this.light);
  },
  reset() { for (const p of this.parts) this.kill(p); this.parts = []; this.emitters = []; },
  kill(p) { this.group.remove(p.s); p.s.material.dispose(); },
  add(p) {
    p.t = 0; p.z = p.z || 0;
    const add = p.k === 'fire' || p.k === 'flash';
    const m = new THREE.SpriteMaterial({ map: add ? this.tex.fire : p.k === 'debris' ? this.tex.chip : this.tex.soft, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
    if (p.k === 'smoke' || p.k === 'dust') m.color.setStyle(p.rgb ? `rgb(${p.rgb})` : `rgb(${p.c | 0},${p.c | 0},${(p.c * 0.95) | 0})`);
    p.s = new THREE.Sprite(m); this.group.add(p.s);
    this.parts.push(p);
    if (this.parts.length > 700) { this.kill(this.parts[0]); this.parts.shift(); }
  },
  update(dt) {
    for (const e of this.emitters) { e.acc = (e.acc || 0) + dt * e.rate; while (e.acc >= 1) { e.acc--; e.fn(); } }
    for (const p of this.parts) {
      p.t += dt; p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; p.z += (p.vz || 0) * dt;
      if (p.g) { p.vz -= p.g * dt; if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.5; p.vy *= 0.5; } }
    }
    const dead = this.parts.filter(p => p.t >= p.life);
    dead.forEach(p => this.kill(p));
    this.parts = this.parts.filter(p => p.t < p.life);
    if (this.light.intensity > 0) this.light.intensity = Math.max(0, this.light.intensity - dt * 9);
  },
  sync() {
    for (const p of this.parts) {
      const q = p.t / p.life, s = p.s;
      s.position.set(p.x, p.z, p.y);
      let size = p.size, a = 1;
      if (p.k === 'smoke' || p.k === 'dust') { size = p.size + p.t * p.grow; a = (1 - q) * 0.55 * Math.min(1, p.t * 4); }
      else if (p.k === 'fire') { size = p.size * (1 - q * 0.5); a = 1 - q; }
      else if (p.k === 'flash') { a = 1 - q; }
      else if (p.k === 'debris') { size = 0.09; a = 1; }
      s.scale.set(size, size, 1); s.material.opacity = a;
    }
  },
  smoke(x, y, z, big, col) {
    this.add({ k: 'smoke', x, y, z, vx: 0.25 + (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.2, vz: 0.6 + Math.random() * 0.5,
      life: 2.5 + Math.random() * 2, size: (big ? 0.9 : 0.4) + Math.random() * 0.4, grow: big ? 1.1 : 0.6,
      c: typeof col === 'number' ? col : 40 + Math.random() * 50, rgb: typeof col === 'string' ? col : null });
  },
  fire(x, y, z) { this.add({ k: 'fire', x: x + (Math.random() - 0.5) * 0.5, y: y + (Math.random() - 0.5) * 0.5, z, vz: 1 + Math.random() * 1.2, vx: (Math.random() - 0.5) * 0.3, life: 0.4 + Math.random() * 0.5, size: 0.5 + Math.random() * 0.4 }); },
  explosion(x, y, r) {
    this.add({ k: 'flash', x, y, z: 0.6, life: 0.2, size: r * 2.2 });
    this.light.position.set(x, 1.5, y); this.light.intensity = Math.min(6, 2 + r);
    const n = Math.round(24 * Math.min(2, r / 2));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = Math.random() * r * 1.3;
      this.add({ k: 'fire', x, y, z: 0.3, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 0.5 + Math.random() * 3, life: 0.4 + Math.random() * 0.6, size: 0.6 + Math.random() * 0.7 });
    }
    for (let i = 0; i < n * 0.7; i++) this.smoke(x + (Math.random() - 0.5) * r, y + (Math.random() - 0.5) * r, Math.random() * 1.2, true);
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * 6.283, s = 1 + Math.random() * r;
      this.add({ k: 'debris', x, y, z: 0.4, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 3 + Math.random() * 5, g: 14, life: 1.2 + Math.random() * 0.6 });
    }
  },
  muzzle(x, y, ang) { this.add({ k: 'flash', x: x + Math.cos(ang) * 0.45, y: y + Math.sin(ang) * 0.45, z: 0.65, life: 0.07, size: 0.45 }); },
  dust(x, y) { for (let i = 0; i < 4; i++) this.add({ k: 'dust', x, y, z: 0.1, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8, vz: 0.5, life: 0.7, size: 0.2, grow: 0.6, c: 150 }); }
};

// ---------------- RENDER ----------------
const Render = {
  target: new THREE.Vector3(8, 0, 36), zoom: 1, viewH: 15, time: 0, sway: [],
  open: [], bld: [], iconCache: {}, decals: [],

  init(canvas, ui) {
    this.canvas = canvas; this.ui = ui; this.uctx = ui.getContext('2d');
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1f2a17');
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
    this.hemi = new THREE.HemisphereLight(0xfff4dc, 0x5a5236, 0.75); this.scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xffecc8, 1.25);
    sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    this.scene.add(sun); this.scene.add(sun.target);
    this.raycaster = new THREE.Raycaster();
    this.ground0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.level = new THREE.Group(); this.scene.add(this.level);
    this.dyn = new THREE.Group(); this.scene.add(this.dyn);
    FX.init(this.scene);
    this.ghostMat = new THREE.MeshBasicMaterial({ color: 0xb8ff90, transparent: true, opacity: 0.5, depthTest: false, depthWrite: false });
    this.tracers = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true }));
    this.tracers.frustumCulled = false; this.scene.add(this.tracers);
    this.rangeRing = this.circleLine(1, 0xffbe5a, 0.7); this.rangeRing.visible = false; this.scene.add(this.rangeRing);
  },

  resize(w, h) {
    this.renderer.setSize(w, h, false);
    this.ui.width = w; this.ui.height = h;
    this.updateCamera();
  },

  addSway(m) {
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = { value: 0 }; this.sway.push(sh.uniforms.uTime);
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
        float hh = max(0.0, transformed.y - 1.0);
        transformed.x += sin(uTime * 1.3 + transformed.x * 0.6 + transformed.z * 0.4) * 0.03 * hh;
        transformed.z += cos(uTime * 1.1 + transformed.x * 0.5) * 0.02 * hh;`);
    };
  },

  circleLine(r, color, opacity) {
    const pts = []; for (let i = 0; i <= 96; i++) { const a = i / 96 * 6.283; pts.push(new THREE.Vector3(Math.cos(a) * r, 0.06, Math.sin(a) * r)); }
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
    return l;
  },

  // ---------- cámara ----------
  updateCamera() {
    const w = this.canvas.clientWidth || this.canvas.width, h = this.canvas.clientHeight || this.canvas.height;
    const halfH = this.viewH / 2 / this.zoom, halfW = halfH * w / h;
    const c = this.camera;
    c.left = -halfW; c.right = halfW; c.top = halfH; c.bottom = -halfH; c.updateProjectionMatrix();
    c.position.copy(this.target).addScaledVector(CAM_OFF, 120);
    c.lookAt(this.target);
    c.updateMatrixWorld();
    const ext = Math.max(halfW, halfH / ELEV_SIN) * 1.25 + 4;
    const sc = this.sun.shadow.camera;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 120; sc.updateProjectionMatrix();
    this.sun.position.set(this.target.x - 9, 26, this.target.z - 16);
    this.sun.target.position.copy(this.target); this.sun.target.updateMatrixWorld();
  },
  pixelWorld() { return (this.viewH / this.zoom) / (this.canvas.clientHeight || this.canvas.height); },
  panPixels(dx, dy) {
    const k = this.pixelWorld();
    this.target.addScaledVector(SCREEN_RIGHT, dx * k);
    this.target.addScaledVector(SCREEN_UP, -dy * k / ELEV_SIN);
    this.clampTarget();
  },
  clampTarget() { this.target.x = clamp(this.target.x, 5, Level.W - 5); this.target.z = clamp(this.target.z, 5, Level.H - 5); this.target.y = 0; this.updateCamera(); },
  centerOn(x, y) { this.target.set(x, 0, y); this.clampTarget(); },
  zoomAt(f, sx, sy) {
    const a = this.pickGround(sx, sy);
    this.zoom = clamp(this.zoom * f, 0.55, 2.4); this.updateCamera();
    const b = this.pickGround(sx, sy);
    if (a && b) { this.target.x += a.x - b.x; this.target.z += a.y - b.y; }
    this.clampTarget();
  },
  pickGround(sx, sy) {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.raycaster.setFromCamera(new THREE.Vector2(sx / w * 2 - 1, -(sy / h) * 2 + 1), this.camera);
    const v = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.ground0, v) ? { x: v.x, y: v.z } : null;
  },
  toScreen(x, h, y) {
    const v = new THREE.Vector3(x, h, y).project(this.camera);
    return { x: (v.x + 1) / 2 * this.canvas.clientWidth, y: (1 - v.y) / 2 * this.canvas.clientHeight };
  },

  // ---------- construcción del nivel ----------
  bakeLevel() {
    for (const o of [...this.level.children]) { this.level.remove(o); o.traverse(c => { if (c.geometry) c.geometry.dispose(); }); }
    for (const o of [...this.dyn.children]) { this.dyn.remove(o); o.traverse(c => { if (c.geometry) c.geometry.dispose(); }); }
    this.decals = [];
    this.buildGround();
    this.buildWater();
    // edificios
    this.bld = Level.buildings.map(b => {
      const g = Buildings.build(b);
      this.level.add(g.full, g.cut, g.inner);
      return g;
    });
    // objetos
    const pb = new Batch();
    Level.props.forEach(p => { if (p.type !== 'depot') Props.build(pb, p); });
    Props.fences(pb); Props.bridges(pb);
    this.level.add(pb.build());
    this.buildDepot();
    // vegetación
    const vb = new Batch();
    Level.trees.forEach((t, i) => t.pine ? Veg.pine(vb, t.x, t.y, i * 13 + 5, 1.05) : Veg.oak(vb, t.x, t.y, i * 17 + 3, 1.0 + (i % 3) * 0.1));
    // La cámara mira desde el suroeste: árboles altos solo en los bordes norte y este,
    // matorral bajo en los bordes sur y oeste para no tapar la acción.
    Level.border.forEach((t, i) => {
      const nearSide = t.x < 1 || t.y > Level.H - 1;
      if (nearSide) Veg.bush(vb, clamp(t.x, 0.4, Level.W - 0.4), clamp(t.y, 0.4, Level.H - 0.4), i * 5 + 2);
      else if (t.pine) Veg.pine(vb, t.x, t.y, i * 11 + 1, 1.25); else Veg.oak(vb, t.x, t.y, i * 7 + 9, 1.2);
    });
    const fr = mulberry32(77);
    for (let z = -12; z < Level.H + 10; z += 1.6) for (let x = -10; x < Level.W + 12; x += 1.6) {
      if (x > -0.5 && x < Level.W + 0.5 && z > -0.5 && z < Level.H + 0.5) continue;
      const px = x + (fr() - 0.5) * 1.2, pz = z + (fr() - 0.5) * 1.2;
      if (px > Level.W || pz < 0) Veg.pine(vb, px, pz, (x * 7 + z * 13) | 0, 1.1 + fr() * 0.5, true);   // bosque al norte y al este
      else if (fr() < 0.35) Veg.bush(vb, px, pz, (x * 3 + z * 17) | 0);                                // matorral al sur y al oeste
    }
    for (let ty = 0; ty < Level.H; ty++) for (let tx = 0; tx < Level.W; tx++) if (Level.at(tx, ty) === 'T') Veg.bush(vb, tx + 0.5, ty + 0.5, tx * 31 + ty);
    this.level.add(vb.build());
    // marca de extracción
    const e = Level.exit;
    const pts = [[e.x0, e.y0], [e.x1 + 1, e.y0], [e.x1 + 1, e.y1 + 1], [e.x0, e.y1 + 1], [e.x0, e.y0]].map(([x, z]) => new THREE.Vector3(x + 0.1, 0.06, z + 0.1));
    this.exitLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0x9fd4ff, dashSize: 0.4, gapSize: 0.3, transparent: true }));
    this.exitLine.computeLineDistances(); this.level.add(this.exitLine);
    this.bakeMini();
  },

  buildDepot() {
    if (this.depotMesh) { this.level.remove(this.depotMesh); this.depotMesh.traverse(c => c.geometry && c.geometry.dispose()); }
    const db = new Batch(); Level.props.filter(p => p.type === 'depot').forEach(p => Props.build(db, p));
    this.depotMesh = db.build(); this.level.add(this.depotMesh);
  },

  refreshDepot() { this.buildDepot(); this.decal('scorch', Level.depot.x, Level.depot.y, 3.4); this.bakeMini(); },

  buildGround() {
    const W = Level.W, H = Level.H, S = 8, PW = W * S, PH = H * S;
    const F = Level.floor, NAT = { g: 1, d: 1, m: 1 };
    const ch = { g: 0, d: 1, y: 2, r: 3, m: 4, w: 5, b: 5, p: 1 };
    const id = new Uint8Array(PW * PH);
    for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) {
      const wx = (px + 0.5) / S, wy = (py + 0.5) / S, tx = wx | 0, ty = wy | 0;
      let f = F[ty][tx];
      if (NAT[f]) {
        const ax = wx + (Noise.value(wx * 0.9 + 31.7, wy * 0.9) - 0.5) * 0.9, ay = wy + (Noise.value(wx * 0.9, wy * 0.9 + 17.3) - 0.5) * 0.9;
        const t2x = ax | 0, t2y = ay | 0;
        if (ax >= 0 && ay >= 0 && t2x < W && t2y < H && NAT[F[t2y][t2x]]) f = F[t2y][t2x];
      }
      id[py * PW + px] = ch[f] !== undefined ? ch[f] : 0;
    }
    const d1 = new Uint8Array(PW * PH * 4), d2 = new Uint8Array(PW * PH * 4), R = 2, w = new Float32Array(6);
    for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) {
      w.fill(0); let n = 0;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const x = clamp(px + dx, 0, PW - 1), y = clamp(py + dy, 0, PH - 1);
        w[id[y * PW + x]]++; n++;
      }
      const i = (py * PW + px) * 4, wx = px / S, wy = py / S;
      d1[i] = w[0] / n * 255; d1[i + 1] = w[1] / n * 255; d1[i + 2] = w[2] / n * 255; d1[i + 3] = w[3] / n * 255;
      d2[i] = w[4] / n * 255; d2[i + 1] = w[5] / n * 255;
      d2[i + 2] = smooth(0.42, 0.68, Noise.fbm(wx * 0.15 + 3, wy * 0.15 + 8, 3)) * 255;
      d2[i + 3] = Noise.fbm(wx * 0.35 + 11, wy * 0.35, 3) * 255;
    }
    const mk = d => { const t = new THREE.DataTexture(d, PW, PH, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
    const sp1 = mk(d1), sp2 = mk(d2);
    const raw = n => Tex.raw(n);
    const mat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 0, specular: 0x000000 });
    const T = { tG: raw('grass'), tG2: raw('grass2'), tD: raw('dirt'), tR: raw('road'), tF: raw('forest'), tV: raw('gravel') };
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { sp1: { value: sp1 }, sp2: { value: sp2 }, mapSize: { value: new THREE.Vector2(W, H) } });
      for (const k in T) sh.uniforms[k] = { value: T[k] };
      sh.vertexShader = 'varying vec2 vXZ;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
      sh.fragmentShader = `uniform sampler2D sp1, sp2, tG, tG2, tD, tR, tF, tV; uniform vec2 mapSize; varying vec2 vXZ;
        vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
        ` + sh.fragmentShader.replace('#include <map_fragment>', `
        vec2 suv = clamp(vXZ / mapSize, vec2(0.0), vec2(1.0));
        vec4 a = texture2D(sp1, suv); vec4 b = texture2D(sp2, suv);
        if (vXZ.x < 0.0 || vXZ.y < 0.0 || vXZ.x > mapSize.x || vXZ.y > mapSize.y) { a = vec4(0.6, 0.0, 0.0, 0.0); b.r = 0.6; b.g = 0.0; b.a = 0.3; }
        vec2 uv = vXZ / 3.2;
        vec3 g = lin(texture2D(tG, uv).rgb) * vec3(0.78, 0.88, 0.62);
        vec3 g2 = lin(texture2D(tG2, uv * 0.6).rgb);
        vec3 dd = lin(texture2D(tD, uv * 0.7).rgb);
        vec3 rr = lin(texture2D(tR, uv * 0.6).rgb);
        vec3 yy = mix(rr, lin(texture2D(tV, uv * 1.3).rgb), 0.3) * vec3(0.9, 0.88, 0.84);
        vec3 ff = lin(texture2D(tF, uv * 0.8).rgb) * vec3(0.55, 0.62, 0.38);
        g = mix(g, g2, b.b * 0.8);
        float sum = a.r + a.g + a.b + a.a + b.r + b.g + 0.0001;
        vec3 col = (g * a.r + dd * a.g + yy * a.b + rr * a.a + ff * b.r + ff * vec3(0.5, 0.45, 0.38) * b.g) / sum;
        col *= mix(0.8, 1.18, b.a);
        diffuseColor.rgb *= col;
        `);
    };
    const geo = new THREE.PlaneGeometry(W + 60, H + 60);
    geo.rotateX(-Math.PI / 2); geo.translate(W / 2, 0, H / 2);
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true;
    this.level.add(m);
  },

  buildWater() {
    const quads = [];
    for (let ty = 0; ty < Level.H; ty++) for (let tx = 0; tx < Level.W; tx++) {
      if (Level.floorAt(tx, ty) !== 'w') continue;
      const g = new THREE.PlaneGeometry(1, 1).toNonIndexed(); g.rotateX(-Math.PI / 2); g.translate(tx + 0.5, 0.06, ty + 0.5);
      Geo.worldUV(g, 3); quads.push(g);
    }
    if (!quads.length) return;
    if (!this.waterNormal) {
      this.waterNormal = Tex.canvas(256, 256, (x, w, h) => {
        const img = x.createImageData(w, h), hgt = (u, v) => Math.sin((u * 3 + v * 2) * Math.PI * 2 / w * 2) + Math.sin((u * -2 + v * 5) * Math.PI * 2 / w) * 0.7 + Math.sin((u * 7 - v) * Math.PI * 2 / w) * 0.4;
        for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) {
          const dx = hgt(u + 1, v) - hgt(u - 1, v), dy = hgt(u, v + 1) - hgt(u, v - 1), i = (v * w + u) * 4;
          img.data[i] = 128 - dx * 40; img.data[i + 1] = 128 - dy * 40; img.data[i + 2] = 255; img.data[i + 3] = 255;
        }
        x.putImageData(img, 0, 0);
      }, false);
      this.waterNormal.wrapS = this.waterNormal.wrapT = THREE.RepeatWrapping;
    }
    const mat = new THREE.MeshPhongMaterial({ color: '#3b6870', transparent: true, opacity: 0.86, shininess: 90, specular: new THREE.Color(0x8fa6a8), normalMap: this.waterNormal });
    mat.normalScale.set(0.35, 0.35);
    const m = new THREE.Mesh(Geo.merge(quads), mat); m.receiveShadow = true;
    this.water = m; this.level.add(m);
  },

  decal(type, x, y, r) {
    if (!this.decalTex) {
      this.decalTex = {
        blood: Tex.canvas(128, 128, (c) => { const rr = mulberry32(9); c.fillStyle = 'rgba(90,8,6,.75)'; for (let k = 0; k < 9; k++) { c.beginPath(); c.ellipse(64 + (rr() - 0.5) * 50, 64 + (rr() - 0.5) * 40, 8 + rr() * 18, 5 + rr() * 12, rr() * 3, 0, 7); c.fill(); } }),
        scorch: Tex.canvas(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(10,8,6,.9)'); g.addColorStop(0.6, 'rgba(25,20,14,.55)'); g.addColorStop(1, 'rgba(25,20,14,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); })
      };
    }
    const size = type === 'blood' ? 1.1 : r * 2;
    const g = new THREE.PlaneGeometry(size, size); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: this.decalTex[type], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.position.set(x, 0.015 + this.decals.length * 0.0005, y); m.rotation.y = Math.random() * 6.28; m.renderOrder = 1;
    this.level.add(m); this.decals.push(m);
  },

  bakeMini() {
    const S = 4, m = makeCanvas(Level.W * S, Level.H * S), x = m.getContext('2d');
    const col = { g: [86, 110, 46], d: [130, 104, 68], y: [128, 118, 96], r: [160, 138, 98], p: [120, 90, 58], w: [46, 86, 94], b: [110, 80, 50], m: [40, 56, 28] };
    for (let ty = 0; ty < Level.H; ty++) for (let tx = 0; tx < Level.W; tx++) {
      const c = col[Level.floorAt(tx, ty)] || [90, 90, 90], v = (Noise.hash(tx, ty) - 0.5) * 14;
      x.fillStyle = `rgb(${c[0] + v | 0},${c[1] + v | 0},${c[2] + v | 0})`; x.fillRect(tx * S, ty * S, S, S);
      if (Level.at(tx, ty) === 'T') { x.fillStyle = '#3d5f26'; x.fillRect(tx * S + 1, ty * S + 1, S - 1, S - 1); }
    }
    const roof = { terracotta: '#a9532f', slate: '#4f5763', metal: '#6c7170' };
    for (const b of Level.buildings) { x.fillStyle = roof[b.roof]; x.fillRect(b.x * S, b.y * S, b.w * S, b.h * S); x.strokeStyle = '#000'; x.strokeRect(b.x * S + 0.5, b.y * S + 0.5, b.w * S - 1, b.h * S - 1); }
    for (const p of Level.props) { x.fillStyle = p.type === 'depot' ? (Level.depot.destroyed ? '#222' : '#c0392b') : '#3a3a2a'; x.fillRect(p.x * S, p.y * S, p.w * S, p.h * S); }
    for (const t of Level.trees.concat(Level.border)) { x.fillStyle = '#1f3518'; x.beginPath(); x.arc(t.x * S, Math.min(t.y, Level.H - 0.5) * S, 4, 0, 7); x.fill(); }
    this.miniBase = m;
  },

  // ---------- estado ----------
  closedAt(x, y) {
    const i = Level.buildings.findIndex(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
    return i >= 0 && !this.open[i];
  },

  // ¿Hay algo entre la cámara y el comando? (para dibujar su silueta)
  occluded(u) {
    const o = new THREE.Vector3(u.x, 0.5, u.y), d = CAM_OFF;
    const hitBox = (x0, y0, z0, x1, y1, z1) => {
      let tmin = 0.05, tmax = 200;
      for (const [p, dd, a, b] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
        if (Math.abs(dd) < 1e-6) { if (p < a || p > b) return false; continue; }
        let t1 = (a - p) / dd, t2 = (b - p) / dd; if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return false;
      }
      return true;
    };
    for (let i = 0; i < Level.buildings.length; i++) {
      if (this.open[i]) continue;
      const b = Level.buildings[i];
      if (hitBox(b.x + 0.2, 0, b.y + 0.2, b.x + b.w - 0.2, this.bld[i].H, b.y + b.h - 0.2)) return true;
    }
    for (const p of Level.props) {
      if (p.type === 'truck' || p.type === 'jeep' || p.type === 'tent') { if (hitBox(p.x, 0, p.y, p.x + p.w, 1.7, p.y + p.h)) return true; }
      else if (p.type === 'tower') { if (hitBox(p.x - 0.2, 3.1, p.y - 0.2, p.x + p.w + 0.2, 5.2, p.y + p.h + 0.2)) return true; }
    }
    for (const t of Level.trees) {
      const c = new THREE.Vector3(t.x, t.pine ? 2.0 : 2.4, t.y), r = t.pine ? 0.9 : 1.15;
      const oc = c.clone().sub(o), tca = oc.dot(d);
      if (tca > 0 && oc.lengthSq() - tca * tca < r * r) return true;
    }
    return false;
  },

  // ---------- personajes y elementos dinámicos ----------
  model(ent, kind, ghost) {
    if (!ent._m || ent._kind !== kind) {
      if (ent._m) { this.dyn.remove(ent._m); if (ent._g) this.dyn.remove(ent._g); }
      ent._m = Soldier.build(kind); this.dyn.add(ent._m); ent._kind = kind;
      if (ghost) {
        ent._g = Soldier.build(kind, this.ghostMat); ent._g.traverse(c => { c.renderOrder = 999; }); this.dyn.add(ent._g);
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.41, 32), new THREE.MeshBasicMaterial({ color: 0x78ff5a, transparent: true, opacity: 0.9, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; ring.renderOrder = 2; this.dyn.add(ring); ent._ring = ring;
        const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x78ff5a, transparent: true, opacity: 0.55 }));
        line.frustumCulled = false; this.dyn.add(line); ent._line = line;
      }
    }
    return ent._m;
  },

  cone(e) {
    if (!e._cone) {
      const N = 34, mk = () => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 2) * 3), 3));
        const idx = []; for (let i = 1; i <= N; i++) idx.push(0, i, i + 1);
        g.setIndex(idx);
        const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x50d246, transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, side: THREE.DoubleSide }));
        m.frustumCulled = false; m.renderOrder = 1; this.dyn.add(m); return m;
      };
      e._cone = { far: mk(), near: mk(), N };
    }
    return e._cone;
  },

  updateCone(e, show) {
    const c = this.cone(e);
    c.far.visible = c.near.visible = show;
    if (!show) return;
    const alert = e.state === 'alert', range = alert ? 9 : 7.5, half = alert ? 1.1 : 0.62, near = range * 0.5, N = c.N;
    const col = alert ? 0xe63c28 : (e.susp > 0.2 || e.state === 'investigate') ? 0xebc832 : 0x50d246;
    const pf = c.far.geometry.attributes.position, pn = c.near.geometry.attributes.position;
    pf.setXYZ(0, e.x, 0.05, e.y); pn.setXYZ(0, e.x, 0.055, e.y);
    for (let i = 0; i <= N; i++) {
      const a = e.face - half + (2 * half * i) / N, d = Level.rayLength(e.x, e.y, a, range), dn = Math.min(d, near);
      pf.setXYZ(i + 1, e.x + Math.cos(a) * d, 0.05, e.y + Math.sin(a) * d);
      pn.setXYZ(i + 1, e.x + Math.cos(a) * dn, 0.055, e.y + Math.sin(a) * dn);
    }
    pf.needsUpdate = pn.needsUpdate = true;
    c.far.material.color.setHex(col); c.near.material.color.setHex(col);
    c.far.material.opacity = 0.17; c.near.material.opacity = 0.22;
  },

  draw(G, dt) {
    this.time += dt;
    for (const u of this.sway) u.value = this.time;
    if (this.water) { this.water.material.normalMap.offset.set(this.time * 0.02, this.time * 0.013); }
    if (this.exitLine) this.exitLine.material.opacity = 0.55 + Math.sin(this.time * 3) * 0.3;
    this.updateCamera();

    // edificios abiertos (con un comando dentro)
    this.open = Level.buildings.map(b => G.units.some(u => u.alive && u.x >= b.x && u.x < b.x + b.w && u.y >= b.y && u.y < b.y + b.h));
    this.bld.forEach((g, i) => { g.full.visible = !this.open[i]; g.cut.visible = this.open[i]; });

    // enemigos
    const hov = G.hover && G.hover.enemy;
    for (const e of G.enemies) {
      const m = this.model(e, e.officer ? 'officer' : 'soldier');
      const gone = e.hidden || e.carried;
      m.visible = !gone;
      const lying = e.state === 'dead' || e.state === 'down';
      if (e.state === 'dead' && !e.decal && e.cause !== 'boom') { this.decal('blood', e.x, e.y); e.decal = true; }
      Soldier.pose(m, { x: e.x, y: e.y, face: lying ? (e.id % 2 ? 0.4 : 2.6) : e.face, moving: !!(e.path && e.path.length && !e.holding) && !lying, anim: e.anim, aim: e.state === 'alert' && !!e.seenNow, lying, side: e.id % 2 ? 1 : -1 });
      const showCone = !gone && !lying && (G.coneMode === 'all' || e.inspect || e === hov || e.state === 'alert');
      this.updateCone(e, showCone);
    }
    // comandos
    const pu = G.primary();
    for (const u of G.units) {
      const kind = u.disguised ? 'spyDis' : u.type;
      const m = this.model(u, kind, true);
      m.visible = u.alive;
      const st = { x: u.x, y: u.y, face: u.face, moving: u.moving, anim: u.anim, crouch: u.crouch, aim: u.busyKind === 'shoot', busy: u.busyKind, carry: !!u.carry, lying: !u.alive, side: 1 };
      Soldier.pose(m, st);
      if (!u.alive) { m.visible = true; }
      Soldier.pose(u._g, st);
      u._g.visible = u.alive && this.occluded(u);
      u._ring.visible = u.alive && u.selected;
      u._ring.position.x = u.x; u._ring.position.z = u.y;
      if (u.alive && u.selected && u.path.length) {
        const pts = [new THREE.Vector3(u.x, 0.06, u.y)].concat(u.path.map(p => new THREE.Vector3(p.x, 0.06, p.y)));
        u._line.geometry.setFromPoints(pts); u._line.visible = true;
      } else u._line.visible = false;
    }
    // anillo de alcance
    const rr = pu && (pu.action === 'shoot' ? 13 : (pu.action === 'grenade' || pu.action === 'lure') ? 9 : 0);
    this.rangeRing.visible = !!rr;
    if (rr) { this.rangeRing.position.set(pu.x, 0, pu.y); this.rangeRing.scale.set(rr, 1, rr); }

    // trazadoras
    const tp = [], tc = [];
    for (const f of G.fx) if (f.k === 'tracer') {
      const a = f.t / f.dur, c = f.enemy ? [1, 0.6, 0.3] : [1, 1, 0.8];
      tp.push(f.x0, 0.65, f.y0, f.x1, 0.6, f.y1); tc.push(c[0] * a, c[1] * a, c[2] * a, c[0] * a, c[1] * a, c[2] * a);
    }
    this.tracers.geometry.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
    this.tracers.geometry.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3));
    FX.sync();

    // temblor de cámara
    const cp = this.camera.position.clone();
    if (G.shake > 0) { this.camera.position.addScaledVector(SCREEN_RIGHT, (Math.random() - 0.5) * G.shake * 0.5); this.camera.position.y += (Math.random() - 0.5) * G.shake * 0.4; }
    this.renderer.render(this.scene, this.camera);
    this.camera.position.copy(cp);
    this.overlay(G);
  },

  // ---------- capa 2D: indicadores, cursor, selección ----------
  overlay(G) {
    const c = this.uctx, w = this.ui.width, h = this.ui.height;
    c.clearRect(0, 0, w, h);
    // anillos de órdenes
    for (const f of G.fx) if (f.k === 'ring') {
      const p = f.t / f.dur; c.strokeStyle = `rgba(255,255,255,${p})`; c.lineWidth = 2; c.beginPath();
      for (let i = 0; i <= 24; i++) { const a = i / 24 * 6.283, s = this.toScreen(f.x + Math.cos(a) * f.r * (1 - p), 0.05, f.y + Math.sin(a) * f.r * (1 - p)); i ? c.lineTo(s.x, s.y) : c.moveTo(s.x, s.y); }
      c.stroke();
    }
    for (const e of G.enemies) {
      if (e.state === 'dead' || e.hidden || e.carried || this.closedAt(e.x, e.y)) continue;
      const s = this.toScreen(e.x, 1.25, e.y);
      if (e.state === 'down') {
        c.fillStyle = '#e8f0ff'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center';
        c.fillText('z', s.x + 6, s.y + 20 + Math.sin(this.time * 2) * 3); c.fillText('Z', s.x + 14, s.y + 10 + Math.sin(this.time * 2 + 1) * 3);
        continue;
      }
      if (e.state === 'alert') this.mark(c, s.x, s.y, '!', '#ff4030');
      else if (e.susp > 0.2 || e.state === 'investigate') {
        this.mark(c, s.x, s.y, '?', '#ffd23a');
        if (e.susp > 0.2) { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(s.x - 13, s.y + 4, 26, 5); c.fillStyle = '#ffd23a'; c.fillRect(s.x - 12, s.y + 5, 24 * Math.min(1, e.susp), 3); }
      }
    }
    for (const u of G.units) {
      if (!u.alive) continue;
      const s = this.toScreen(u.x, 1.2, u.y);
      if (u.selected) for (let i = 0; i < u.def.hp; i++) {
        c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(s.x - u.def.hp * 5 + i * 10 - 1, s.y - 6, 9, 6);
        c.fillStyle = i < u.hp ? '#5ad04a' : '#4a1a1a'; c.fillRect(s.x - u.def.hp * 5 + i * 10, s.y - 5, 7, 4);
      }
      if (u.busyT > 0 && u.busyKind === 'plant') {
        const p = 1 - u.busyT / 3;
        c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(s.x - 18, s.y - 16, 36, 7);
        c.fillStyle = '#ff9a4d'; c.fillRect(s.x - 17, s.y - 15, 34 * p, 5);
      }
    }
    if (G.bomb) {
      const s = this.toScreen(G.bomb.x, 2.2, G.bomb.y);
      c.fillStyle = 'rgba(0,0,0,.75)'; Sprites.rr(c, s.x - 30, s.y - 24, 60, 24, 4); c.fill();
      c.fillStyle = Math.ceil(G.bomb.t) % 2 ? '#ff9a4d' : '#ffd080'; c.font = 'bold 17px monospace'; c.textAlign = 'center';
      c.fillText('00:' + String(Math.ceil(G.bomb.t)).padStart(2, '0'), s.x, s.y - 6);
    }
    const ex = Level.exit, es = this.toScreen((ex.x0 + ex.x1 + 1) / 2, 0, ex.y1 + 1.6);
    c.fillStyle = `rgba(200,230,255,${0.6 + Math.sin(this.time * 3) * 0.25})`; c.font = '15px "Black Ops One", Impact, sans-serif'; c.textAlign = 'center';
    c.fillText('EXTRACCIÓN', es.x, es.y);

    if (G.drag && G.drag.active) {
      const d = G.drag;
      c.strokeStyle = '#a8ff80'; c.lineWidth = 1; c.fillStyle = 'rgba(160,255,120,.08)';
      c.fillRect(d.sx, d.sy, d.cx - d.sx, d.cy - d.sy); c.strokeRect(d.sx + 0.5, d.sy + 0.5, d.cx - d.sx, d.cy - d.sy);
    }
    if (G.paused && !G.overlayOpen) {
      c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f0e2a0'; c.font = '40px "Black Ops One", Impact, sans-serif'; c.textAlign = 'center';
      c.fillText('PAUSA', w / 2, h / 2 - 30);
      c.font = '15px "Special Elite", monospace'; c.fillText('Puedes dar órdenes en pausa · Espacio para continuar', w / 2, h / 2);
    }
    this.drawCursor(c, G);
  },

  mark(c, x, y, ch, col) {
    c.font = 'bold 28px "Black Ops One", Impact, sans-serif'; c.textAlign = 'center';
    c.lineWidth = 4; c.strokeStyle = '#000'; c.strokeText(ch, x, y); c.fillStyle = col; c.fillText(ch, x, y);
  },

  icon(id, s) {
    const key = id + s;
    if (!this.iconCache[key]) { const c = makeCanvas(s, s); Sprites.icon(c.getContext('2d'), id, s); this.iconCache[key] = c; }
    return this.iconCache[key];
  },

  drawCursor(ctx, G) {
    const m = G.mouse;
    if (!m.inside || G.overlayOpen) return;
    const x = m.x, y = m.y, pu = G.primary(), h = G.hover || {};
    if (pu && pu.action) {
      ctx.strokeStyle = h.valid ? '#ff4a30' : '#f0c060'; ctx.lineWidth = 2;
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
    ctx.fill(); ctx.stroke(); ctx.restore();
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
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const cs = [[0, 0], [w, 0], [w, h], [0, h]].map(([a, b]) => this.pickGround(a, b));
    if (cs.every(Boolean)) {
      x.strokeStyle = '#fff'; x.lineWidth = 1; x.beginPath();
      cs.forEach((p, i) => i ? x.lineTo(p.x * sx, p.y * sy) : x.moveTo(p.x * sx, p.y * sy)); x.closePath(); x.stroke();
    }
  }
};
