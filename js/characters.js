'use strict';
// Soldados con esqueleto y animaciones reales (modelo Soldier.glb de Mixamo), retexturizados por uniforme.

const Chars = {
  ready: false, tex: {}, mats: {},

  init(gltf) {
    if (!gltf) return;
    this.gltf = gltf;
    this.clips = {};
    for (const a of gltf.animations) this.clips[a.name.toLowerCase()] = a;
    gltf.scene.traverse(o => {
      if (o.isSkinnedMesh) {
        if (/visor/i.test(o.name)) this.visorName = o.name;
        else { this.bodyName = o.name; this.bodyMap = o.material.map; this.bodyNormal = o.material.normalMap; }
      }
    });
    gltf.scene.updateMatrixWorld(true);
    let foot = null, toe = null;
    gltf.scene.traverse(o => { if (/LeftFoot$/.test(o.name)) foot = o; if (/LeftToeBase$/.test(o.name)) toe = o; });
    if (foot && toe) { const a = new THREE.Vector3(), b = new THREE.Vector3(); foot.getWorldPosition(a); toe.getWorldPosition(b); this.flip = b.z - a.z < 0; }
    const box = new THREE.Box3().setFromObject(gltf.scene);
    this.scale = 1.12 / (box.max.y - box.min.y);
    this.ready = !!(this.clips.idle && this.clips.walk && this.bodyMap);
  },

  // Textura del cuerpo pasada a escala de grises y teñida con los colores del uniforme
  bodyTex(kind) {
    if (this.tex[kind]) return this.tex[kind];
    const K = SOLDIER_KIT[kind], S = 512, c = makeCanvas(S, S), x = c.getContext('2d');
    x.drawImage(this.bodyMap.image, 0, 0, S, S);
    const d = x.getImageData(0, 0, S, S), px = d.data, t = hex2rgb(K.tunic), p = hex2rgb(K.pants);
    for (let i = 0; i < px.length; i += 4) {
      const L = (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) / 255;
      const k = L > 0.42 ? t : p, v = L > 0.42 ? 0.55 + 0.6 * L : 0.45 + 1.2 * L;
      const wear = L > 0.85 ? (L - 0.85) * 2 : 0;
      px[i] = Math.min(255, k[0] * v + wear * 60); px[i + 1] = Math.min(255, k[1] * v + wear * 55); px[i + 2] = Math.min(255, k[2] * v + wear * 45);
    }
    x.putImageData(d, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = false; tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
    return (this.tex[kind] = tex);
  },

  mat(kind, part) {
    const key = kind + part;
    if (this.mats[key]) return this.mats[key];
    const K = SOLDIER_KIT[kind];
    let m;
    if (part === 'body') m = new THREE.MeshStandardMaterial({ map: this.bodyTex(kind), normalMap: this.bodyNormal, roughness: 0.85, metalness: 0.05 });
    else if (part === 'skin') m = new THREE.MeshStandardMaterial({ color: K.skin, roughness: 0.6 });
    else if (part === 'hat') m = new THREE.MeshStandardMaterial({ color: K.hatCol, roughness: K.hat === 'helmet' || K.hat === 'brodie' ? 0.55 : 0.9, metalness: K.hat === 'helmet' || K.hat === 'brodie' ? 0.25 : 0 });
    else if (part === 'dark') m = new THREE.MeshStandardMaterial({ color: '#1a1a18', roughness: 0.5, metalness: 0.4 });
    else if (part === 'wood') m = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.7 });
    else if (part === 'pack') m = new THREE.MeshStandardMaterial({ color: K.pack || '#4f4a30', roughness: 0.95 });
    else m = new THREE.MeshStandardMaterial({ color: part, roughness: 0.8 });
    return (this.mats[key] = m);
  },

  // Une un grupo (medido en unidades del mundo) a un hueso, compensando la escala del esqueleto
  attach(bone, content) {
    const ws = new THREE.Vector3(); bone.getWorldScale(ws);
    const holder = new THREE.Group(); holder.scale.setScalar(1 / ws.x);
    holder.add(content); bone.add(holder);
    return holder;
  },

  headgear(kind) {
    const K = SOLDIER_KIT[kind], g = new THREE.Group(), hc = this.mat(kind, 'hat');
    const add = (geo, m, x, y, z, sx, sy, sz, rz) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); if (sx) o.scale.set(sx, sy, sz); if (rz) o.rotation.z = rz; o.castShadow = true; g.add(o); return o; };
    switch (K.hat) {
      case 'helmet': { // casco alemán: cúpula, faldón y visera corta
        add(new THREE.SphereGeometry(0.1, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), hc, 0, -0.01, -0.005, 1, 0.95, 1.05);
        add(new THREE.CylinderGeometry(0.101, 0.128, 0.065, 20, 1, true), hc, 0, -0.04, -0.015);
        break;
      }
      case 'cap':
        add(new THREE.CylinderGeometry(0.12, 0.094, 0.065, 16), hc, 0, 0.0, 0);
        add(new THREE.CylinderGeometry(0.095, 0.095, 0.035, 16), this.mat(kind, '#26261f'), 0, -0.035, 0);
        add(new THREE.BoxGeometry(0.13, 0.01, 0.07), this.mat(kind, 'dark'), 0, -0.05, 0.095);
        break;
      case 'beret':
        add(new THREE.SphereGeometry(0.11, 14, 8), hc, -0.025, -0.01, 0, 1.05, 0.32, 1.0, 0.28);
        break;
      case 'fieldcap':
        add(new THREE.SphereGeometry(0.093, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), hc, 0, -0.03, 0);
        add(new THREE.BoxGeometry(0.12, 0.01, 0.08), hc, 0, -0.03, 0.1);
        break;
      case 'fedora':
        add(new THREE.CylinderGeometry(0.16, 0.16, 0.012, 20), hc, 0, -0.03, 0);
        add(new THREE.CylinderGeometry(0.075, 0.09, 0.1, 16), hc, 0, 0.02, 0);
        add(new THREE.CylinderGeometry(0.091, 0.091, 0.025, 16), this.mat(kind, '#151515'), 0, -0.015, 0);
        break;
      case 'brodie': // casco británico de ala ancha
        add(new THREE.CylinderGeometry(0.17, 0.17, 0.014, 22), hc, 0, -0.035, 0);
        add(new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), hc, 0, -0.035, 0);
        break;
    }
    return g;
  },

  weapon(kind) {
    const K = SOLDIER_KIT[kind]; if (!['rifle', 'sniper', 'smg'].includes(K.weapon)) return null;
    const g = new THREE.Group(), L = K.weapon === 'sniper' ? 0.8 : K.weapon === 'smg' ? 0.45 : 0.7;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.055, L * 0.6), this.mat(kind, 'wood')); stock.position.z = -L * 0.15;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, L * 0.55, 6), this.mat(kind, 'dark')); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.012, L * 0.3);
    g.add(stock, barrel);
    if (K.weapon === 'sniper') { const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.18, 8), this.mat(kind, 'dark')); sc.rotation.x = Math.PI / 2; sc.position.set(0, 0.055, 0.05); g.add(sc); }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  },

  // Material único por color de vértice para todas las piezas del uniforme
  partMat() {
    if (!this._pm) {
      const c = makeCanvas(64, 64), x = c.getContext('2d'), r = mulberry32(5);
      x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 900; i++) { const v = 190 + r() * 65 | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(r() * 64, r() * 64, 1, 2); }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
      this._pm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02, map: t });
    }
    return this._pm;
  },

  // Dirección de un vector del mundo (en la pose de reposo) expresada en el espacio local del hueso
  localDir(bone, v) {
    const q = new THREE.Quaternion(); bone.getWorldQuaternion(q);
    return v.clone().applyQuaternion(q.invert()).normalize();
  },

  // Construye un soldado de la Segunda Guerra Mundial con piezas rígidas que siguen al esqueleto animado
  build(kind, ghostMat) {
    const obj = THREE.SkeletonUtils.clone(this.gltf.scene);
    const root = new THREE.Group(), tilt = new THREE.Group(), turn = new THREE.Group();
    root.add(tilt); tilt.add(turn); turn.add(obj); obj.scale.setScalar(this.scale);
    turn.rotation.y = this.flip ? Math.PI : 0;
    const B = {};
    obj.traverse(o => { if (o.isBone) B[o.name.replace(/^mixamorig:?/, '')] = o; if (o.isSkinnedMesh) { o.visible = false; o.frustumCulled = false; } });
    root.updateMatrixWorld(true);
    const K = SOLDIER_KIT[kind], m = { root, tilt, obj, bones: B, kind, cur: null, ghosts: [] };
    m.rest = {}; for (const k in B) m.rest[k] = B[k].position.clone();
    const fwdW = new THREE.Vector3(0, 0, this.flip ? -1 : 1), latW = new THREE.Vector3(1, 0, 0);
    const parts = {}; // hueso -> lista de geometrías con color
    const col = (g, hex) => { const c = new THREE.Color(hex); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
    const put = (bone, g) => { (parts[bone] = parts[bone] || []).push(g); };
    const ws = name => { const v = new THREE.Vector3(); B[name].getWorldScale(v); return v.x; };
    // geometría orientada en el hueso: 'y' hacia el hijo, 'x' lateral del cuerpo, 'z' hacia delante
    const upW = new THREE.Vector3(0, 1, 0);
    const childVec = (bone, child) => child === 'UP' ? this.localDir(B[bone], upW) : B[child].position.clone();
    const frame = (bone, child) => {
      const y = (child ? childVec(bone, child) : new THREE.Vector3(0, 1, 0)).normalize();
      let x = this.localDir(B[bone], latW); x.sub(y.clone().multiplyScalar(x.dot(y))).normalize();
      const z = new THREE.Vector3().crossVectors(x, y).normalize();
      if (z.dot(this.localDir(B[bone], fwdW)) < 0) { z.negate(); x.negate(); }
      return new THREE.Matrix4().makeBasis(x, y, z);
    };
    const seg = (bone, child, shape, w, d, hex, opts) => {
      if (!B[bone] || (child && child !== 'UP' && !B[child])) return;
      opts = opts || {};
      const k = 1 / ws(bone), len = child && child !== 'UP' ? B[child].position.length() : (opts.len || 0.1) * k;
      const L = len * (opts.ext || 1), from = (opts.from || 0) * len;
      let g;
      if (shape === 'box') g = new THREE.BoxGeometry(w * k, L, d * k, 1, 2, 1);
      else if (shape === 'sphere') g = new THREE.SphereGeometry(w * k, 14, 10);
      else if (shape === 'ell') { g = new THREE.CapsuleGeometry(w * k / 2, Math.max(0.001, L - w * k * 0.6), 5, 14); g.scale(1, 1, d / w); }
      else g = new THREE.CapsuleGeometry(w * k, Math.max(0.001, L - 2 * w * k), 4, 10);
      g = g.toNonIndexed();
      if (opts.scale) g.scale(...opts.scale);
      g.translate((opts.off ? opts.off[0] * k : 0), shape === 'sphere' ? (opts.at || 0.5) * len : from + L / 2, (opts.off ? opts.off[2] * k : 0));
      g.applyMatrix4(frame(bone, child));
      put(bone, col(g, hex));
    };
    const tunic = K.tunic, pants = K.pants, boots = K.boots, skin = K.skin;
    // tronco
    seg('Hips', 'Spine', 'ell', 0.25, 0.17, pants, { ext: 2.2, from: -1.1 });
    if (!K.shirt) seg('Hips', 'Spine', 'ell', 0.27, 0.185, tunic, { ext: 1.6, from: -0.5 });              // faldón de la guerrera
    seg('Spine', 'Spine1', 'ell', 0.26, 0.175, tunic, { ext: 1.6, from: -0.2 });
    seg('Spine1', 'Spine2', 'ell', 0.29, 0.185, tunic, { ext: 1.5, from: -0.2 });
    seg('Spine2', 'Neck', 'ell', 0.31, 0.19, tunic, { ext: 1.25, from: -0.1 });
    seg('Spine', 'Spine1', 'ell', 0.275, 0.19, '#2a2418', { ext: 0.45, from: -0.15 });                    // cinturón
    if (!K.shirt) { seg('Spine', 'Spine1', 'box', 0.08, 0.06, '#3a3020', { ext: 0.4, off: [-0.1, 0, 0.1] }); seg('Spine', 'Spine1', 'box', 0.08, 0.06, '#3a3020', { ext: 0.4, off: [0.1, 0, 0.1] }); }
    else { seg('Spine2', 'Neck', 'box', 0.1, 0.02, K.shirt, { off: [0, 0, 0.1], ext: 0.9 }); seg('Spine2', 'Neck', 'box', 0.03, 0.02, '#8a2020', { off: [0, 0, 0.112], ext: 0.8 }); }
    if (K.armband) seg('LeftArm', 'LeftForeArm', 'capsule', 0.06, 0, '#3a8a3a', { ext: 0.25, from: 0.35 });
    if (K.pack) seg('Spine2', 'Neck', 'box', 0.23, 0.12, K.pack, { off: [0, 0, -0.15], ext: 1.2, from: -0.35 });
    // cabeza
    seg('Neck', 'Head', 'capsule', 0.042, 0, skin, { ext: 1.3 });
    seg('Head', 'UP', 'sphere', 0.084, 0, skin, { len: 0.2, at: 0.42, scale: [0.95, 1.12, 1.02] });
    seg('Head', 'UP', 'box', 0.03, 0.02, '#1c140e', { len: 0.2, from: 0.38, ext: 0.08, off: [-0.03, 0, 0.078] });   // ojos
    seg('Head', 'UP', 'box', 0.03, 0.02, '#1c140e', { len: 0.2, from: 0.38, ext: 0.08, off: [0.03, 0, 0.078] });
    // brazos y piernas
    for (const S of ['Left', 'Right']) {
      seg(S + 'Shoulder', S + 'Arm', 'capsule', 0.055, 0, tunic, { ext: 0.8, from: 0.3 });
      seg(S + 'Arm', S + 'ForeArm', 'capsule', 0.047, 0, tunic);
      seg(S + 'ForeArm', S + 'Hand', 'capsule', 0.041, 0, tunic, { ext: 0.95 });
      seg(S + 'Hand', S + 'HandMiddle1', 'sphere', 0.036, 0, skin, { at: 0.6, scale: [1, 1.2, 0.8] });
      seg(S + 'UpLeg', S + 'Leg', 'capsule', 0.07, 0, pants, { ext: 1.05 });
      seg(S + 'Leg', S + 'Foot', 'capsule', 0.056, 0, pants, { ext: 0.6 });
      seg(S + 'Leg', S + 'Foot', 'capsule', 0.058, 0, boots, { ext: 0.5, from: 0.52 });
      seg(S + 'Foot', S + 'ToeBase', 'box', 0.085, 0.065, boots, { ext: 1.7, from: -0.25 });
    }
    // piezas por hueso: una malla por hueso (y otra de silueta)
    const mat = this.partMat();
    for (const bone in parts) {
      const g = Geo.merge(parts[bone]);
      const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; B[bone].add(mesh);
      if (ghostMat) { const gh = new THREE.Mesh(g, ghostMat); gh.renderOrder = 999; gh.visible = false; B[bone].add(gh); m.ghosts.push(gh); }
    }
    // tocado y arma
    if (B.Head) {
      const hat = this.headgear(kind), k = 1 / ws('Head');
      const holder = new THREE.Group();
      holder.applyMatrix4(frame('Head', 'UP').scale(new THREE.Vector3(k, k, k)));
      holder.position.copy(this.localDir(B.Head, upW).multiplyScalar(0.125 * k));
      holder.add(hat); B.Head.add(holder);
      if (ghostMat) { const gh = hat.clone(); gh.traverse(o => { if (o.isMesh) { o.material = ghostMat; o.renderOrder = 999; } }); gh.visible = false; holder.add(gh); m.ghosts.push(gh); }
    }
    const w = this.weapon(kind);
    if (w && B.Spine2) {
      const k = 1 / ws('Spine2'), holder = new THREE.Group();
      holder.applyMatrix4(frame('Spine2', 'Neck').scale(new THREE.Vector3(k, k, k)));
      w.rotation.set(0.15, 0, 0.7); w.position.set(0, 0.1, -0.13); holder.add(w); B.Spine2.add(holder);
    }
    if (B.Spine2) { // cuerpo cargado al hombro
      const k = 1 / ws('Spine2'), holder = new THREE.Group();
      holder.applyMatrix4(frame('Spine2', 'Neck').scale(new THREE.Vector3(k, k, k)));
      const c = new THREE.Group();
      const b1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.45, 4, 8), this.partMatColor('#5f6650')); b1.rotation.z = Math.PI / 2; c.add(b1);
      const hd = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), this.partMatColor('#d9ab84')); hd.position.x = 0.36; c.add(hd);
      c.position.set(0, 0.3, -0.02); c.visible = false; holder.add(c); B.Spine2.add(holder); m.carry = c; holder.userData.keep = true;
    }

    m.mixer = new THREE.AnimationMixer(obj);
    m.actions = {};
    for (const n of ['idle', 'walk', 'run']) if (this.clips[n]) { const a = m.mixer.clipAction(this.clips[n]); a.play(); a.weight = 0; m.actions[n] = a; }
    m.actions.idle.weight = 1; m.cur = 'idle';
    m.mixer.update(Math.random() * 2);
    return m;
  },

  // Funde todas las piezas rígidas en una única malla con esqueleto (peso 1 sobre su hueso)
  bake(m, B, obj, ghostMat) {
    let body = null; obj.traverse(o => { if (o.isSkinnedMesh && !body) body = o; });
    m.root.updateMatrixWorld(true);
    const skel = body.skeleton, list = [], remove = [];
    const meshW = body.parent.matrixWorld, bindInv = body.bindMatrixInverse;
    for (const name in B) {
      const bone = B[name], bi = skel.bones.indexOf(bone); if (bi < 0) continue;
      // transformación que aplicará el skinning a un vértice de este hueso en la pose actual; se invierte
      // (modo 'attached': Three.js usa bindMatrixInverse = inversa del mundo de la malla, que se cancela)
      const S = new THREE.Matrix4().copy(bone.matrixWorld).multiply(skel.boneInverses[bi]).multiply(body.bindMatrix);
      const inv = S.invert();
      for (const ch of bone.children) {
        if (ch.isBone || ch.userData.keep) continue;
        ch.traverse(o => {
          if (!o.isMesh) return;
          let g = o.geometry.clone(); if (g.index) g = g.toNonIndexed();
          g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
          const n = g.attributes.position.count;
          if (!g.attributes.color) { const c = o.material.color, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
          if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
          list.push([g, bi]);
        });
        remove.push(ch);
      }
    }
    remove.forEach(ch => ch.parent.remove(ch));
    let N = 0; for (const [g] of list) N += g.attributes.position.count;
    const pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), col = new Float32Array(N * 3), uv = new Float32Array(N * 2), si = new Uint16Array(N * 4), sw = new Float32Array(N * 4);
    let o = 0;
    for (const [g, bi] of list) {
      const c = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
      col.set(g.attributes.color.array, o * 3); uv.set(g.attributes.uv.array, o * 2);
      for (let i = 0; i < c; i++) { si[(o + i) * 4] = bi; sw[(o + i) * 4] = 1; }
      o += c;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    const mesh = new THREE.SkinnedMesh(geo, this.partMat());
    mesh.bind(skel, body.bindMatrix); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    body.parent.add(mesh); m.mesh = mesh;
    if (ghostMat) {
      const gh = new THREE.SkinnedMesh(geo, ghostMat); gh.bind(skel, body.bindMatrix);
      gh.renderOrder = 999; gh.visible = false; gh.frustumCulled = false; body.parent.add(gh); m.ghosts.push(gh);
    }
  },

  partMatColor(hex) {
    this._pc = this._pc || {};
    return this._pc[hex] || (this._pc[hex] = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85 }));
  },

  play(m, name, ts) {
    if (m.cur !== name) {
      const from = m.actions[m.cur], to = m.actions[name];
      to.reset(); to.play(); to.setEffectiveWeight(1);
      if (from) from.crossFadeTo(to, 0.25, false);
      m.cur = name;
    }
    m.actions[name].setEffectiveTimeScale(ts);
  },

  // s: { x, y, face, moving, running, speed, crouch, prone, lying, aim, busy, carry, elev, side }
  animate(m, s, dt) {
    const B = m.bones;
    m.root.position.set(s.x, s.elev || 0, s.y);
    m.root.rotation.set(0, Math.PI / 2 - s.face, s.drunk || 0);
    m.tilt.rotation.set(0, 0, 0); m.tilt.position.set(0, 0, 0);
    if (s.lying) {
      this.play(m, 'idle', 0);
      m.tilt.rotation.x = -Math.PI / 2; m.tilt.position.y = 0.12; m.tilt.rotation.y = s.side * 0.4;
    } else if (s.prone) {
      this.play(m, s.moving ? 'walk' : 'idle', s.moving ? 0.9 : 0.5);
      m.tilt.rotation.x = Math.PI / 2 - 0.08; m.tilt.position.set(0, 0.16, -0.35);
    } else if (s.moving) {
      if (s.running && m.actions.run) this.play(m, 'run', clamp(s.speed / 3.2, 0.6, 1.6));
      else this.play(m, 'walk', clamp(s.speed / 1.35, 0.6, 2.0));
    } else this.play(m, 'idle', 1);
    m.mixer.update(dt);
    // ajustes de huesos sobre la animación
    const bend = (name, x, y, z) => { const b = B[name]; if (b) { if (x) b.rotateX(x); if (y) b.rotateY(y); if (z) b.rotateZ(z); } };
    const crouch = s.crouch || ['plant', 'knife', 'syringe'].includes(s.busy);
    if (crouch && !s.lying && !s.prone && B.Hips) {
      B.Hips.position.y = m.rest.Hips.y * 0.68;
      bend('LeftUpLeg', -1.25, 0, 0); bend('RightUpLeg', -0.55, 0, 0);
      bend('LeftLeg', 1.75, 0, 0); bend('RightLeg', 1.45, 0, 0);
      bend('Spine', 0.35, 0, 0);
    }
    if ((s.aim || ['plant', 'knife', 'syringe', 'throw'].includes(s.busy)) && !s.lying && !s.prone) {
      bend('RightArm', 0, 0, 0); bend('RightArm', -1.25, 0, 0.0);
      bend('LeftArm', -1.15, 0, 0);
      bend('RightForeArm', 0, 0, 0); bend('LeftForeArm', 0, 0, 0);
    }
    if (s.busy === 'throw') bend('RightArm', -1.2, 0, 0);
    if (m.carry) m.carry.visible = !!s.carry;
  }
};
