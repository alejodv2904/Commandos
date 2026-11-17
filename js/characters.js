'use strict';
// Soldados con malla deformable, esqueleto y animaciones reales (Soldier.glb de Mixamo).
// Cada personaje se «viste» pintando por zonas del cuerpo: cada vértice se clasifica por el hueso
// que lo mueve (cabeza, pecho, brazos, manos, muslos, espinillas, pies) y su altura en reposo.

const Chars = {
  ready: false, geo: {}, mats: {},

  init(gltf) {
    if (!gltf) return;
    this.gltf = gltf;
    this.clips = {};
    for (const a of gltf.animations) this.clips[a.name.toLowerCase()] = a;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o => {
      if (!o.isSkinnedMesh) return;
      if (/visor/i.test(o.name)) this.visorName = o.name;
      else { this.bodyName = o.name; this.body = o; }
    });
    if (!this.body) return;
    let foot = null, toe = null;
    gltf.scene.traverse(o => { if (/LeftFoot$/.test(o.name)) foot = o; if (/LeftToeBase$/.test(o.name)) toe = o; });
    if (foot && toe) { const a = new THREE.Vector3(), b = new THREE.Vector3(); foot.getWorldPosition(a); toe.getWorldPosition(b); this.flip = b.z - a.z < 0; }
    const box = new THREE.Box3().setFromObject(gltf.scene);
    this.scale = 1.12 / (box.max.y - box.min.y);
    this.classify();
    this.detailTex();
    this.ready = !!(this.clips.idle && this.clips.walk);
  },

  // Zona y altura relativa (0 = pies, 1 = coronilla) de cada vértice del cuerpo
  classify() {
    const b = this.body, g = b.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = b.skeleton.bones;
    const zoneOf = n => {
      n = n.replace(/^mixamorig:?/, '');
      if (/Hand/.test(n)) return 'hand';
      if (/ForeArm/.test(n)) return 'foreArm';
      if (/Arm$/.test(n) || /Shoulder/.test(n)) return 'upperArm';
      if (/UpLeg/.test(n)) return 'thigh';
      if (/Leg$/.test(n)) return 'shin';
      if (/Foot|Toe/.test(n)) return 'foot';
      if (/Head|Neck/.test(n)) return 'head';
      if (/Spine2|Spine1/.test(n)) return 'chest';
      if (/Spine/.test(n)) return 'belly';
      return 'hips';
    };
    const v = new THREE.Vector3(), N = pos.count, ys = new Float32Array(N), P = new Float32Array(N * 3);
    let minY = 1e9, maxY = -1e9;
    for (let i = 0; i < N; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(b.matrixWorld); ys[i] = v.y; P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y); }
    this.zone = []; this.h = new Float32Array(N); this.bindPos = P; this.span = maxY - minY;
    for (let i = 0; i < N; i++) {
      const w = [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)], s = [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)];
      let k = 0; for (let j = 1; j < 4; j++) if (w[j] > w[k]) k = j;
      this.zone.push(zoneOf(bones[s[k]].name));
      this.h[i] = (ys[i] - minY) / (maxY - minY);
    }
  },

  // Textura de detalle: la original en escala de grises y aclarada (pliegues y costuras como tela)
  detailTex() {
    const img = this.body.material.map.image, S = 512, c = makeCanvas(S, S), x = c.getContext('2d');
    x.drawImage(img, 0, 0, S, S);
    const d = x.getImageData(0, 0, S, S), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const L = (0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2]) / 255, v = Math.min(255, (0.66 + 0.42 * L) * 255);
      p[i] = p[i + 1] = p[i + 2] = v;
    }
    x.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(c); t.flipY = false; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    this.detail = t; this.normal = this.body.material.normalMap;
  },

  // Geometría del cuerpo con los colores del uniforme de cada personaje
  kindGeo(kind) {
    if (this.geo[kind]) return this.geo[kind];
    const K = SOLDIER_KIT[kind], g = this.body.geometry.clone(), N = g.attributes.position.count;
    const C = hex => new THREE.Color(hex === 'skin' ? K.skin : hex);
    const col = {
      head: C(K.skin), hand: C(K.hands || K.skin), upperArm: C(K.arms || K.tunic), foreArm: C(K.arms || K.tunic),
      chest: C(K.tunic), belly: C(K.tunic), hips: C(K.coat ? K.coatCol : K.pants), thigh: C(K.coat ? K.coatCol : K.pants),
      shin: C(K.pants), foot: C(K.boots), boot: C(K.boots), belt: C(K.belt || '#22201a'), collar: C(K.collar || K.tunic),
      gaiter: C(K.gaiters || K.pants), pants: C(K.pants)
    };
    const camo = K.camo ? K.camo.map(h => new THREE.Color(h)) : null;
    const a = new Float32Array(N * 3), P = this.bindPos, sp = this.span;
    for (let i = 0; i < N; i++) {
      const z = this.zone[i], h = this.h[i];
      let c = col[z], boot = false;
      if (z === 'shin' && h < (K.bootTop || 0.14)) { c = col.boot; boot = true; }
      else if (z === 'shin' && K.gaiters && h < 0.21) c = col.gaiter;
      if (K.coat && z === 'thigh' && h < 0.36) c = col.pants;
      const belt = (z === 'hips' || z === 'belly') && Math.abs(h - 0.6) < (K.beltW || 0.018);
      if (belt) c = col.belt;
      if (z === 'head' && h < 0.875) c = col.collar;
      if (camo && !['head', 'hand', 'foot'].includes(z) && !belt && !boot) {
        const n = Noise.value(P[i * 3] / sp * 9 + 3, P[i * 3 + 1] / sp * 9 + P[i * 3 + 2] / sp * 5);
        c = n < 0.38 ? camo[0] : n < 0.62 ? camo[2] : camo[1];
      }
      a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return (this.geo[kind] = g);
  },

  bodyMat() {
    if (!this._bm) {
      this._bm = new THREE.MeshStandardMaterial({ map: this.detail, normalMap: this.normal, vertexColors: true, roughness: 0.9, metalness: 0.0, envMapIntensity: 0.35 });
      this._bm.normalScale = new THREE.Vector2(0.55, 0.55);
    }
    return this._bm;
  },

  mat(kind, part) {
    const key = kind + part;
    if (this.mats[key]) return this.mats[key];
    const K = SOLDIER_KIT[kind];
    let m;
    if (part === 'skin') m = new THREE.MeshStandardMaterial({ color: K.skin, roughness: 0.7, envMapIntensity: 0.35 });
    else if (part === 'hat') { const metal = K.hat === 'helmet' || K.hat === 'brodie'; m = new THREE.MeshStandardMaterial({ color: K.hatCol, roughness: metal ? 0.5 : 0.9, metalness: metal ? 0.3 : 0 }); }
    else if (part === 'dark') m = new THREE.MeshStandardMaterial({ color: '#1a1a18', roughness: 0.45, metalness: 0.5 });
    else if (part === 'wood') m = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.7 });
    else if (part === 'pack') m = new THREE.MeshStandardMaterial({ color: K.pack || '#4f4a30', roughness: 0.95 });
    else m = new THREE.MeshStandardMaterial({ color: part, roughness: 0.8 });
    m.envMapIntensity = 0.35;
    return (this.mats[key] = m);
  },

  localDir(bone, v) { const q = new THREE.Quaternion(); bone.getWorldQuaternion(q); return v.clone().applyQuaternion(q.invert()).normalize(); },

  // Soporte unido a un hueso cuyo contenido se mide en unidades del mundo, con 'y' arriba y 'z' delante
  holder(bone, fwdW) {
    const ws = new THREE.Vector3(); bone.getWorldScale(ws);
    const k = 1 / ws.y, y = this.localDir(bone, new THREE.Vector3(0, 1, 0));
    const z = this.localDir(bone, fwdW); z.sub(y.clone().multiplyScalar(z.dot(y))).normalize();
    const x = new THREE.Vector3().crossVectors(y, z).normalize();
    const h = new THREE.Group();
    h.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z).scale(new THREE.Vector3(k, k, k)));
    bone.add(h); return { h, k };
  },

  headgear(kind) {
    const K = SOLDIER_KIT[kind], g = new THREE.Group(), hc = this.mat(kind, 'hat');
    const add = (geo, m, x, y, z, sx, sy, sz, rx, rz) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); if (sx) o.scale.set(sx, sy, sz); if (rx) o.rotation.x = rx; if (rz) o.rotation.z = rz; o.castShadow = true; g.add(o); return o; };
    switch (K.hat) {
      case 'helmet': // Stahlhelm: cúpula y faldón
        add(new THREE.SphereGeometry(0.128, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), hc, 0, 0, -0.005, 1, 0.92, 1.06);
        add(new THREE.CylinderGeometry(0.129, 0.158, 0.075, 20, 1, true), hc, 0, -0.035, -0.015);
        break;
      case 'sidecap': // gorra de campaña (Feldmütze)
        add(new THREE.CylinderGeometry(0.11, 0.13, 0.05, 4, 1), hc, 0, -0.035, 0, 0.62, 1, 1.25, 0, 0).rotation.y = Math.PI / 4;
        add(new THREE.BoxGeometry(0.02, 0.012, 0.03), this.mat(kind, '#b8b8ac'), 0, -0.02, 0.15);
        break;
      case 'cap': // gorra de plato
        add(new THREE.CylinderGeometry(0.155, 0.118, 0.075, 18), hc, 0, 0.03, -0.01, 1, 1, 1.08);
        add(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 18), this.mat(kind, '#1e1f1a'), 0, -0.01, 0);
        add(new THREE.BoxGeometry(0.15, 0.012, 0.085), this.mat(kind, 'dark'), 0, -0.022, 0.12, 1, 1, 1, 0.2);
        add(new THREE.BoxGeometry(0.04, 0.025, 0.01), this.mat(kind, '#c8c8bc'), 0, 0.045, 0.142);
        break;
      case 'beret':
        add(new THREE.SphereGeometry(0.135, 16, 8), hc, -0.035, 0.0, 0, 1.08, 0.3, 1.02, 0, 0.3);
        add(new THREE.SphereGeometry(0.014, 6, 4), this.mat(kind, '#d8b440'), 0.06, 0.0, 0.115);
        break;
      case 'flatcap': // gorra de tela
        add(new THREE.SphereGeometry(0.128, 16, 8), hc, 0, 0.0, 0.01, 1.02, 0.36, 1.12);
        add(new THREE.BoxGeometry(0.15, 0.012, 0.08), hc, 0, -0.02, 0.13, 1, 1, 1, 0.25);
        break;
      case 'fedora':
        add(new THREE.CylinderGeometry(0.2, 0.2, 0.014, 22), hc, 0, -0.015, 0);
        add(new THREE.CylinderGeometry(0.095, 0.115, 0.12, 18), hc, 0, 0.045, 0);
        add(new THREE.CylinderGeometry(0.116, 0.116, 0.03, 18), this.mat(kind, '#0c0c0c'), 0, 0.0, 0);
        break;
      case 'brodie': // casco británico de ala ancha
        add(new THREE.CylinderGeometry(0.2, 0.2, 0.016, 24), hc, 0, -0.025, 0);
        add(new THREE.SphereGeometry(0.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hc, 0, -0.025, 0);
        break;
      case 'hood': // capucha de francotirador con red
        add(new THREE.SphereGeometry(0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), hc, 0, -0.04, -0.015, 1, 1.05, 1.1);
        add(new THREE.SphereGeometry(0.155, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), this.mat(kind, '#2c3a22'), 0, -0.04, -0.015, 1, 1.05, 1.1).material.wireframe = true;
        break;
    }
    return g;
  },

  weapon(kind) {
    const K = SOLDIER_KIT[kind]; if (!['rifle', 'sniper', 'smg'].includes(K.weapon)) return null;
    const g = new THREE.Group(), L = K.weapon === 'sniper' ? 0.8 : K.weapon === 'smg' ? 0.42 : 0.72;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.055, L * (K.weapon === 'smg' ? 0.35 : 0.6)), K.weapon === 'smg' ? this.mat(kind, 'dark') : this.mat(kind, 'wood')); stock.position.z = -L * 0.15;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, L * 0.6, 6), this.mat(kind, 'dark')); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.012, L * 0.3);
    g.add(stock, barrel);
    if (K.weapon === 'sniper') { const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.18, 8), this.mat(kind, 'dark')); sc.rotation.x = Math.PI / 2; sc.position.set(0, 0.055, 0.05); g.add(sc); }
    if (K.weapon === 'smg') { const mg = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.14, 0.03), this.mat(kind, 'dark')); mg.position.set(0, -0.07, 0.05); g.add(mg); }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  },

  build(kind, ghostMat) {
    const K = SOLDIER_KIT[kind];
    const obj = THREE.SkeletonUtils.clone(this.gltf.scene);
    const root = new THREE.Group(), tilt = new THREE.Group(), turn = new THREE.Group();
    root.add(tilt); tilt.add(turn); turn.add(obj);
    const sc = K.scale || [1, 1, 1]; obj.scale.set(this.scale * sc[0], this.scale * sc[1], this.scale * sc[2]);
    turn.rotation.y = this.flip ? Math.PI : 0;
    const B = {}, skinned = [];
    obj.traverse(o => {
      if (o.isBone) B[o.name.replace(/^mixamorig:?/, '')] = o;
      if (o.isSkinnedMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        if (o.name === this.visorName) o.material = this.mat(kind, 'skin');
        else { o.geometry = this.kindGeo(kind); o.material = this.bodyMat(); }
        skinned.push(o);
      }
    });
    root.updateMatrixWorld(true);
    const m = { root, tilt, obj, bones: B, kind, cur: null, ghosts: [] };
    m.rest = {}; for (const k in B) m.rest[k] = B[k].position.clone();
    const fwdW = new THREE.Vector3(0, 0, this.flip ? -1 : 1);
    if (B.Head) { // tocado sobre la cabeza
      const { h } = this.holder(B.Head, fwdW);
      const hat = this.headgear(kind); hat.position.y = 0.155; h.add(hat);
      if (ghostMat) { const gh = hat.clone(); gh.traverse(o => { if (o.isMesh) { o.material = ghostMat; o.renderOrder = 999; } }); gh.visible = false; h.add(gh); m.ghosts.push(gh); }
    }
    if (B.Spine2) { // arma a la espalda, mochila y cuerpo cargado
      const w = this.weapon(kind);
      if (w) { const { h } = this.holder(B.Spine2, fwdW); w.rotation.set(0.12, 0, 0.72); w.position.set(0, 0.06, -0.16); h.add(w); }
      if (K.pack) {
        const { h } = this.holder(B.Spine2, fwdW);
        const pk = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.15), this.mat(kind, 'pack')); pk.position.set(0, 0.02, -0.19); pk.castShadow = true; h.add(pk);
        const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), this.mat(kind, '#5d5640')); roll.rotation.z = Math.PI / 2; roll.position.set(0, 0.2, -0.19); h.add(roll);
      }
      const { h } = this.holder(B.Spine2, fwdW), c = new THREE.Group();
      const b1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.45, 4, 8), this.mat(kind, '#5c6452')); b1.rotation.z = Math.PI / 2; c.add(b1);
      const hd = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), this.mat(kind, '#cf9f7c')); hd.position.x = 0.36; c.add(hd);
      c.position.set(0, 0.24, -0.02); c.visible = false; h.add(c); m.carry = c;
    }
    if (ghostMat) for (const s of skinned) { // silueta: mallas deformables que comparten el esqueleto
      const g = new THREE.SkinnedMesh(s.geometry, ghostMat);
      g.bind(s.skeleton, s.bindMatrix); g.frustumCulled = false; g.renderOrder = 999; g.visible = false;
      s.parent.add(g); m.ghosts.push(g);
    }
    m.mixer = new THREE.AnimationMixer(obj);
    m.actions = {};
    for (const n of ['idle', 'walk', 'run']) if (this.clips[n]) { const a = m.mixer.clipAction(this.clips[n]); a.play(); a.weight = 0; m.actions[n] = a; }
    m.actions.idle.weight = 1; m.cur = 'idle';
    m.mixer.update(Math.random() * 2);
    return m;
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

  // s: { x, y, face, moving, running, speed, crouch, prone, lying, aim, busy, carry, elev, side, drunk }
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
    const bend = (name, x, y, z) => { const b = B[name]; if (b) { if (x) b.rotateX(x); if (y) b.rotateY(y); if (z) b.rotateZ(z); } };
    const crouch = s.crouch || ['plant', 'knife', 'syringe'].includes(s.busy);
    if (crouch && !s.lying && !s.prone && B.Hips) {
      B.Hips.position.y = m.rest.Hips.y * 0.68;
      bend('LeftUpLeg', -1.25, 0, 0); bend('RightUpLeg', -0.55, 0, 0);
      bend('LeftLeg', 1.75, 0, 0); bend('RightLeg', 1.45, 0, 0);
      bend('Spine', 0.35, 0, 0);
    }
    if ((s.aim || ['plant', 'knife', 'syringe', 'throw'].includes(s.busy)) && !s.lying && !s.prone) {
      bend('RightArm', -1.25, 0, 0); bend('LeftArm', -1.15, 0, 0);
    }
    if (s.busy === 'throw') bend('RightArm', -1.2, 0, 0);
    if (m.carry) m.carry.visible = !!s.carry;
  }
};
