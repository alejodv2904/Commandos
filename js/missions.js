'use strict';
// Campaña (según la biblia de diseño de niveles): 2 entrenamientos, 10 misiones y 9 bonus.
// Las misiones jugables definen mapa, clima, escuadrón, equipo, enemigos y objetivos.

// ---------- Objetivos genéricos ----------
const Obj = {
  alive: e => !['dead', 'down', 'tied'].includes(e.state),
  neutralize(ids, text) { return { text, check: G => ids.every(i => !Obj.alive(G.enemies[i])) }; },
  destroy(tid, text) { return { text, check: () => Level.targets.some(t => t.id === tid && t.destroyed) }; },
  interact(iid, text) { return { text, check: () => Level.interacts.some(i => i.id === iid && i.done) }; },
  escapeVehicle(vid, text) {
    return { text, final: true, check: G => {
      const v = G.vehicles.find(v => v.id === vid); if (!v) return false;
      return Level.inExit(v.x, v.y) && G.units.every(u => !u.alive || u.inVehicle === v);
    } };
  },
  reachExit(text) { return { text, final: true, check: G => G.units.every(u => u.alive && !u.dying && Level.inExit(u.x, u.y)) }; },
  noAlarm(text) { return { text, check: G => G.stats.alarms === 0 && G.stats.bodies === 0, live: true }; },
  hasItem(id, text) { return { text, check: G => G.units.some(u => u.alive && Inv.find(u.inv, id)) }; }
};

const KITS = {
  ww2: { soldier: 'soldier', sergeant: 'sergeant', officer: 'officer', gestapo: 'gestapo', sniper: 'esniper', tech: 'tech' },
  desert: { soldier: 'dsoldier', sergeant: 'dsergeant', officer: 'dofficer', gestapo: 'dofficer', sniper: 'esniper', tech: 'tech' },
  night: { soldier: 'nsoldier', sergeant: 'nsergeant', officer: 'nofficer', gestapo: 'nofficer', sniper: 'esniper', tech: 'tech' }
};

const WEATHER = {
  day: { name: 'Día', sun: 0xffd8a8, sunInt: 2.3, sunOff: [-13, 21, -17], hemi: [0xc8dcff, 0x5a4a30, 0.35], sky: true, exposure: 0.72, bg: '#2a3320', tint: [1, 1, 1] },
  desert: { name: 'Día despejado', sun: 0xfff0d8, sunInt: 2.7, sunOff: [-10, 26, -12], hemi: [0xd8e8ff, 0x8a6a40, 0.45], sky: true, exposure: 0.7, bg: '#6a5838', tint: [1.18, 1.04, 0.84] },
  night: { name: 'Noche despejada', night: true, sun: 0x9ab4ff, sunInt: 0.85, sunOff: [12, 22, -10], hemi: [0x5a6ea8, 0x232a3c, 0.8], sky: false, exposure: 1.3, bg: '#05070c', tint: [0.9, 0.92, 1.05] }
};

// ---------- Misión clásica: Operación Depósito ----------
const CLASSIC_ENEMIES = [
  { x: 34.5, y: 21.5, patrol: [{ x: 34.5, y: 21.5, face: 3.14 }] },
  { x: 34.5, y: 24.5, patrol: [{ x: 34.5, y: 24.5, face: 3.14 }] },
  { x: 18.5, y: 22.5, rank: 'sergeant', patrol: [{ x: 18.5, y: 22.5, wait: 2 }, { x: 28.5, y: 22.5, wait: 2 }] },
  { x: 8.5, y: 18.5, patrol: [{ x: 8.5, y: 18.5, wait: 1.5 }, { x: 17.5, y: 18.5, wait: 1.5 }] },
  { x: 17.5, y: 38.5, patrol: [{ x: 17.5, y: 38.5, wait: 2 }, { x: 21.5, y: 38.5, wait: 2.5 }] },
  { x: 26.5, y: 5.5, patrol: [{ x: 26.5, y: 5.5, face: 3.14 }] },
  { x: 44.5, y: 11.5, patrol: [{ x: 44.5, y: 11.5, face: 1.57 }] },
  { x: 47.5, y: 12.5, patrol: [{ x: 47.5, y: 12.5, face: 3.14 }] },
  { x: 56.5, y: 13.5, rank: 'officer', patrol: [{ x: 56.5, y: 13.5, face: 3.14 }] },
  { x: 54.5, y: 29.5, patrol: [{ x: 54.5, y: 29.5, wait: 1.5 }, { x: 60.5, y: 29.5, wait: 1.5 }] },
  { x: 60.5, y: 34.5, rank: 'sergeant', patrol: [{ x: 60.5, y: 34.5, wait: 1.5 }, { x: 54.5, y: 34.5, wait: 1.5 }] },
  { x: 49.5, y: 32.5, patrol: [{ x: 49.5, y: 32.5, face: 3.14 }] },
  { x: 44.5, y: 18.5, patrol: [{ x: 44.5, y: 18.5, wait: 2 }, { x: 44.5, y: 25.5, wait: 2 }] },
  { x: 40.5, y: 28.5, patrol: [{ x: 40.5, y: 28.5, face: 1.57 }] },
  { x: 40.5, y: 37.5, rank: 'sergeant', patrol: [{ x: 40.5, y: 37.5, wait: 2 }, { x: 58.5, y: 37.5, wait: 2 }] },
  { x: 51.5, y: 19.5, rank: 'gestapo', patrol: [{ x: 51.5, y: 19.5, wait: 3 }, { x: 59.5, y: 19.5, wait: 3 }] },
  { x: 38, y: 38, rank: 'sniper', sweep: 0.6, patrol: [{ x: 38, y: 38, face: 3.14 }] }
];

function buildClassic(A) {
  const W = A.W, H = A.H, rng = A.rng;
  A.noiseF('d', 0.13, 0.6);
  for (let x = 0; x < W; x++) { A.setF(x, 22, 'r'); A.setF(x, 23, 'r'); }
  for (let y = 0; y < H; y++) { A.setF(30, y, 'r'); A.setF(31, y, 'r'); }
  for (let y = 15; y <= 21; y++) { A.setF(12, y, 'd'); A.setF(13, y, 'd'); }
  for (let y = 7; y <= 39; y++) for (let x = 37; x <= 60; x++) if (A.getF(x, y) !== 'r') A.setF(x, y, 'y');
  for (let y = 1; y < H - 1; y++) {
    const cx = 22.5 + Math.sin(y * 0.25) * 1.5;
    for (let x = 0; x < W; x++) if (Math.abs(x + 0.5 - cx) < 1.3) { A.setF(x, y, 'w'); A.setG(x, y, 'W'); }
  }
  for (const [a, b] of [[5, 6], [22, 23], [37, 38]])
    for (let y = a; y <= b; y++) for (let x = 17; x <= 28; x++) if (A.getF(x, y) === 'w') { A.setF(x, y, 'b'); A.setG(x, y, '.'); }
  for (let x = 36; x <= 61; x++) { A.setG(x, 6, 'f'); A.setG(x, 40, 'f'); }
  for (let y = 6; y <= 40; y++) { A.setG(36, y, 'f'); A.setG(61, y, 'f'); }
  for (const y of [22, 23]) { A.setG(36, y, '.'); A.setG(61, y, '.'); }
  A.building(40, 8, 10, 7, { name: 'Cuartel', facade: 'wood', roof: 'metal', H: 1.25, R: 0.35, furn: 'bunks' });
  A.building(52, 10, 8, 8, { name: 'Puesto de mando', facade: 'plaster', roof: 'terracotta', H: 1.7, R: 0.95, furn: 'office', chimney: true });
  A.building(38, 26, 6, 5, { name: 'Caseta', facade: 'brick', roof: 'slate', H: 1.15, R: 0.6, furn: 'guard' });
  A.building(46, 30, 7, 6, { name: 'Almacén', facade: 'concrete', roof: 'metal', H: 1.5, R: 0.3, furn: 'storage' });
  A.building(10, 10, 6, 5, { name: 'Granja', facade: 'timber', roof: 'terracotta', H: 1.3, R: 0.8, furn: 'house', chimney: true });
  A.building(14, 30, 7, 5, { name: 'Cabaña', facade: 'timber', roof: 'slate', H: 1.2, R: 0.7, furn: 'house' });
  A.target('depot', A.prop('depot', 56, 30, 3, 3, 'B'), { radius: 1.8, fire: true });
  A.prop('truck', 38, 19, 4, 2, 'v'); A.prop('truck', 49, 24, 4, 2, 'v');
  A.prop('tent', 56, 24, 3, 3, 'n');
  A.prop('tower', 58, 7, 2, 2, 'k'); A.prop('tower', 37, 37, 2, 2, 'k');
  A.prop('jeep', 3, 2, 3, 2, 'v');
  for (const [x, y] of [[33, 20], [33, 21], [33, 24], [33, 25], [59, 26], [60, 26]]) A.prop('sandbag', x, y, 1, 1, 'g');
  for (const [x, y] of [[54, 31], [54, 32], [47, 27], [48, 27], [47, 28], [15, 15], [16, 15], [42, 16]]) A.prop('crate', x, y, 1, 1, 'c');
  for (const [x, y] of [[59, 31], [59, 32], [60, 32], [43, 21], [12, 34]]) A.prop('barrels', x, y, 1, 1, 'o');
  A.loot('Escritorio del oficial', 55.5, 13.6, [['docs', 1]], { secondary: true });
  A.loot('Caja de suministros', 48.5, 32.0, [['grenade', 2], ['medkit', 3]]);
  A.loot('Arcón de la granja', 11.6, 11.6, [['rope', 2], ['wine', 1]]);
  A.bushes([[8, 6, 5, 14], [26, 12, 4, 12], [26, 32, 5, 14], [12, 24, 3, 8], [46, 3, 4, 8], [10, 38, 3, 6],
    [34, 16, 2.5, 10], [34, 29, 2.5, 10], [18, 28, 3, 8], [4, 22, 3, 7], [27, 7, 3, 8], [16, 6, 3, 6]]);
}

// ---------- Entrenamiento 2: Fuego Cruzado ----------
function buildFuegoCruzado(A) {
  const W = A.W, H = A.H, rng = A.rng;
  A.noiseF('d', 0.11, 0.62, 3, 4); A.noiseF('y', 0.2, 0.7, 11, 2);
  // carretera oeste-este
  for (let x = 0; x < W; x++) { A.setF(x, 19, 'r'); A.setF(x, 20, 'r'); }
  for (let y = 4; y <= 19; y++) { A.setF(28, y, 'r'); A.setF(29, y, 'r'); }
  // cañón al este: paredes de roca con un paso
  for (let x = 47; x < W; x++) for (let y = 1; y < H - 1; y++) if (y < 16 || y > 23) { A.setG(x, y, 'R'); A.setF(x, y, 'm'); }
  for (let x = 47; x < W; x++) { for (const y of [16, 23]) A.rock(x + 0.5, y + 0.5, 1.2 + rng() * 0.5); }
  // muro que bloquea el cañón
  A.target('wall', A.prop('blockwall', 50, 17, 1, 6, 'X'), { radius: 2.6 });
  // campo minado con alambrada
  A.fenceLine(41, 14, 41, 25); A.fenceLine(41, 14, 46, 14); A.fenceLine(41, 25, 46, 25);
  for (let k = 0; k < 18; k++) { const x = 42 + ((rng() * 8) | 0), y = 15 + ((rng() * 10) | 0); if (!Level.mineAt(x, y)) A.mine(x, y); }
  for (const [x, y] of [[44, 19], [47, 20], [45, 20], [48, 19]]) if (!Level.mineAt(x, y)) A.mine(x, y);
  for (let y = 15; y <= 24; y += 3) A.prop('minesign', 40, y, 1, 1, null);
  // puesto de control
  A.building(5, 14, 4, 4, { name: 'Caseta', facade: 'concrete', roof: 'flat', H: 1.2, R: 0.1, furn: 'guard' });
  A.prop('barrier', 9, 19, 1, 2, null);
  for (const [x, y] of [[10, 17], [11, 17], [10, 22], [11, 22]]) A.prop('sandbag', x, y, 1, 1, 'g');
  // pueblo fantasma: ruinas y dos casas con azotea
  A.building(14, 7, 6, 5, { name: 'Ruina', facade: 'plaster', ruin: true, roof: 'none', H: 1.4, R: 0, furn: 'ruin' });
  A.building(24, 25, 7, 5, { name: 'Ruina', facade: 'brick', ruin: true, roof: 'none', H: 1.5, R: 0, furn: 'ruin' });
  A.building(34, 7, 5, 5, { name: 'Ruina', facade: 'plaster', ruin: true, roof: 'none', H: 1.3, R: 0, furn: 'ruin' });
  A.building(20, 10, 6, 5, { name: 'Casa de adobe', facade: 'plaster', roof: 'flat', H: 2.0, R: 0.1, furn: 'house', noDoor: false });
  A.building(31, 26, 6, 5, { name: 'Casa de adobe', facade: 'plaster', roof: 'flat', H: 2.0, R: 0.1, furn: 'house' });
  // torre de agua
  A.prop('watertower', 23, 30, 2, 2, 'Q');
  Level.towers.push({ x: 24, y: 31, top: { x: 25.0, y: 32.1 }, elev: 3.7 });
  A.interact('tower', 'Subir a la torre de agua', 24, 33, { time: 1.5, repeat: true, who: null, climb: true });
  // patio con camión y tanque
  A.rectF(25, 2, 39, 7, 'y');
  A.prop('tank', 34, 3, 4, 2, 'v');
  A.vehicle('truck', 28.5, 4.5, 0, { id: 'truck', driver: ['driver'], seats: 4 });
  for (const [x, y] of [[26, 2], [26, 3], [39, 6]]) A.prop('crate', x, y, 1, 1, 'c');
  for (const [x, y] of [[38, 2], [16, 22], [36, 22]]) A.prop('barrels', x, y, 1, 1, 'o');
  // rocas y matojos secos
  for (let k = 0; k < 26; k++) {
    const x = 2 + rng() * 44, y = 2 + rng() * 36;
    if (A.getG(Math.floor(x), Math.floor(y)) !== '.' || A.getF(Math.floor(x), Math.floor(y)) === 'r' || A.reserved(x, y)) continue;
    if (x > 12 && x < 40 && y > 5 && y < 32) continue;
    A.rock(x, y, 0.6 + rng() * 0.8);
  }
  A.bushes([[4, 9, 3, 6], [12, 30, 3, 6], [20, 36, 4, 7], [38, 33, 3, 6], [6, 26, 2, 4], [44, 8, 3, 5]]);
}

const FUEGO_ENEMIES = [
  { x: 6.5, y: 15.6, rank: 'officer', patrol: [{ x: 6.5, y: 15.6, face: 1.57 }], tag: 'officer' },
  { x: 10.5, y: 18.5, patrol: [{ x: 10.5, y: 18.5, face: 3.14 }] },
  { x: 22.5, y: 12.5, elev: 3.0, patrol: [{ x: 22.5, y: 12.5, face: 1.9 }], sweep: 0.55 },
  { x: 33.5, y: 28.5, elev: 3.0, patrol: [{ x: 33.5, y: 28.5, face: -1.3 }], sweep: 0.55 },
  { x: 16.5, y: 17.5, patrol: [{ x: 16.5, y: 17.5, wait: 2 }, { x: 31.5, y: 17.5, wait: 2 }] },
  { x: 21.5, y: 22.5, patrol: [{ x: 21.5, y: 22.5, wait: 2 }, { x: 21.5, y: 33.5, wait: 2 }] },
  { x: 31.5, y: 9.5, rank: 'sergeant', patrol: [{ x: 31.5, y: 9.5, face: 2.2 }] },
  { x: 39.5, y: 12.5, patrol: [{ x: 39.5, y: 12.5, wait: 2.5 }, { x: 39.5, y: 27.5, wait: 2.5 }] },
  { x: 30.5, y: 7.5, patrol: [{ x: 30.5, y: 7.5, face: 1.57 }] }
];

// ---------- Misión 1: Frecuencia Muerta ----------
function buildFrecuencia(A) {
  const W = A.W, H = A.H, rng = A.rng;
  A.noiseF('y', 0.16, 0.6, 2, 7); A.noiseF('d', 0.1, 0.66, 9, 1);
  // terrazas: acantilados escalables (solo el Ladrón) con escaleras
  for (let x = 1; x < W - 1; x++) { A.setG(x, 31, 'C'); A.setG(x, 16, 'C'); }
  for (const [x0, x1, y] of [[10, 11, 31], [45, 46, 31], [30, 31, 16]]) for (let x = x0; x <= x1; x++) { A.setG(x, y, '.'); A.setF(x, y, 'y'); A.prop('stairs', x, y, 1, 1, null); }
  // carretera de acceso y aparcamiento inferior
  for (let y = 33; y < H; y++) { A.setF(32, y, 'r'); A.setF(33, y, 'r'); }
  A.rectF(20, 35, 44, 43, 'r');
  for (let x = 2; x < 32; x++) { A.setF(x, 39, 'r'); A.setF(x, 40, 'r'); }
  for (const [x, y] of [[22, 36], [26, 36], [36, 36], [40, 36], [24, 42]]) A.prop('car', x, y, 2, 1, 'v', { seed: x * 3 + y });
  A.prop('carport', 47, 38, 6, 4, null);
  A.vehicle('jeep', 50, 40, 3.14, { id: 'jeep', driver: null, seats: 2 });
  // nivel medio: barracones de técnicos y subestación
  A.rectF(3, 18, 60, 30, 'y');
  A.building(6, 20, 8, 5, { name: 'Barracón A', facade: 'concrete', roof: 'metal', H: 1.3, R: 0.3, furn: 'bunks' });
  A.building(18, 20, 8, 5, { name: 'Barracón B', facade: 'concrete', roof: 'metal', H: 1.3, R: 0.3, furn: 'bunks' });
  A.building(33, 22, 7, 5, { name: 'Barracón C', facade: 'wood', roof: 'metal', H: 1.3, R: 0.3, furn: 'bunks' });
  A.fenceLine(50, 19, 58, 19); A.fenceLine(50, 19, 50, 27); A.fenceLine(58, 19, 58, 27); A.fenceLine(50, 27, 58, 27);
  A.setG(54, 27, '.'); A.setG(55, 27, '.');
  A.prop('substation', 52, 21, 4, 2, 'Z');
  A.interact('power', 'Cortar la electricidad', 54, 24.5, { time: 3 });
  // nivel superior: cúpula del radiotelescopio, centro de control y antena
  A.rectF(3, 2, 60, 15, 'y');
  A.building(23, 3, 12, 10, { name: 'Cúpula', facade: 'concrete', roof: 'dome', H: 2.0, R: 0, furn: 'servers', locked: true, door: { x: 29, y: 12 } });
  A.interact('servers', 'Descargar los datos de rastreo', 29, 6.5, { time: 6 });
  A.building(40, 4, 7, 5, { name: 'Centro de control', facade: 'concrete', roof: 'flat', H: 1.4, R: 0.1, furn: 'office' });
  A.prop('dish', 50, 3, 6, 6, 'Z');
  A.interact('motor', 'Sabotear el motor de rotación', 53, 10.5, { time: 4 });
  // farolas y focos (funcionan con la subestación)
  for (const [x, y] of [[24, 38], [38, 38], [16, 27], [28, 27], [44, 28], [21, 14], [38, 14], [48, 12], [56, 25]]) { A.prop('lamp', x, y, 1, 1, 'l'); A.light(x + 0.5, y + 0.5, { r: 3.6 }); }
  A.prop('searchlight', 15, 17, 1, 1, 'l'); A.spot(15.5, 17.5, { a0: 0.5, a1: 2.6, dist: 6.5, speed: 0.3 });
  A.prop('searchlight', 44, 32, 1, 1, 'l'); A.spot(44.5, 32.5, { a0: 0.6, a1: 2.5, dist: 6, speed: 0.35 });
  A.prop('searchlight', 40, 17, 1, 1, 'l'); A.spot(40.5, 17.5, { a0: 0.3, a1: 2.8, dist: 6.5, speed: 0.28 });
  // contenedores: 20 chips en total (con los de los técnicos y oficiales)
  A.loot('Taquilla', 8.5, 21.5, [['chip', 2]]); A.loot('Taquilla', 12.5, 21.5, [['chip', 1], ['ration', 1]]);
  A.loot('Taquilla', 20.5, 21.5, [['chip', 2]]); A.loot('Taquilla', 24.5, 21.5, [['chip', 1], ['cigs', 1]]);
  A.loot('Taquilla', 35.5, 23.5, [['chip', 2]]);
  A.loot('Escritorio de control', 42.5, 5.8, [['chip', 2]]); A.loot('Escritorio de control', 44.5, 7.2, [['chip', 2], ['medkit', 3]]);
  A.loot('Consola de la cúpula', 25.5, 9.5, [['chip', 2]]);
  for (const [x, y] of [[4, 4], [5, 4], [58, 14], [3, 28], [59, 29], [19, 45], [46, 45]]) A.prop('crate', x, y, 1, 1, 'c');
  for (let k = 0; k < 30; k++) {
    const x = 2 + rng() * (W - 4), y = 2 + rng() * (H - 4);
    const tx = Math.floor(x), ty = Math.floor(y);
    if (A.getG(tx, ty) !== '.' || 'rpy'.includes(A.getF(tx, ty)) || A.reserved(x, y) || Math.abs(ty - 16) < 2 || Math.abs(ty - 31) < 2) continue;
    A.rock(x, y, 0.5 + rng() * 0.9);
  }
  A.bushes([[6, 36, 3, 6], [14, 44, 3, 6], [54, 44, 3, 5], [4, 12, 3, 5], [16, 7, 3, 5], [60, 34, 2, 4]]);
}

const FREC_ENEMIES = [
  // nivel inferior
  { x: 22.5, y: 37.5, patrol: [{ x: 22.5, y: 37.5, wait: 2 }, { x: 40.5, y: 37.5, wait: 2 }] },
  { x: 40.5, y: 41.5, patrol: [{ x: 40.5, y: 41.5, wait: 2 }, { x: 22.5, y: 41.5, wait: 2 }] },
  { x: 46.5, y: 40.5, patrol: [{ x: 46.5, y: 40.5, face: 3.14 }] },
  { x: 10.5, y: 33.5, patrol: [{ x: 10.5, y: 33.5, face: 1.4 }] },
  { x: 45.5, y: 33.5, patrol: [{ x: 45.5, y: 33.5, face: 1.8 }] },
  { x: 32.5, y: 45.5, rank: 'sergeant', patrol: [{ x: 32.5, y: 45.5, wait: 3 }, { x: 32.5, y: 34.5, wait: 3 }] },
  // nivel medio
  { x: 5.5, y: 28.5, patrol: [{ x: 5.5, y: 28.5, wait: 2 }, { x: 29.5, y: 28.5, wait: 2 }] },
  { x: 30.5, y: 29.5, rank: 'sergeant', patrol: [{ x: 30.5, y: 29.5, wait: 2 }, { x: 47.5, y: 29.5, wait: 2 }, { x: 47.5, y: 20.5, wait: 2 }] },
  { x: 10.5, y: 22.5, rank: 'tech', patrol: [{ x: 10.5, y: 22.5, wait: 4 }, { x: 8.5, y: 22.5, wait: 4 }], loot: [['chip', 2]] },
  { x: 22.5, y: 22.5, rank: 'tech', patrol: [{ x: 22.5, y: 22.5, wait: 5 }, { x: 20.5, y: 22.5, wait: 5 }], loot: [['chip', 2]] },
  { x: 36.5, y: 28.2, patrol: [{ x: 36.5, y: 28.2, face: 1.57 }] },
  { x: 54.5, y: 28.5, patrol: [{ x: 54.5, y: 28.5, face: 1.57 }] },
  { x: 40.5, y: 18.5, patrol: [{ x: 40.5, y: 18.5, wait: 2 }, { x: 58.5, y: 17.5, wait: 2 }] },
  // nivel superior
  { x: 30.5, y: 15.0, patrol: [{ x: 30.5, y: 15.0, face: 1.57 }] },
  { x: 21.5, y: 14.5, patrol: [{ x: 21.5, y: 14.5, wait: 2 }, { x: 37.5, y: 14.5, wait: 2 }] },
  { x: 32.5, y: 6.5, rank: 'tech', patrol: [{ x: 32.5, y: 6.5, wait: 4 }, { x: 26.5, y: 5.5, wait: 4 }], loot: [['chip', 1]] },
  { x: 43.5, y: 6.5, rank: 'officer', patrol: [{ x: 43.5, y: 6.5, face: 1.57 }], loot: [['chip', 1], ['medkit', 3]] },
  { x: 45.5, y: 12.5, rank: 'officer', tag: 'chief', patrol: [{ x: 45.5, y: 12.5, wait: 3 }, { x: 57.5, y: 12.5, wait: 3 }], pocket: [['codes', 1]] },
  { x: 57.5, y: 9.5, rank: 'sergeant', patrol: [{ x: 57.5, y: 9.5, face: 3.14 }] },
  { x: 19.5, y: 6.5, patrol: [{ x: 19.5, y: 6.5, wait: 3 }, { x: 19.5, y: 12.5, wait: 3 }] },
  { x: 8.5, y: 9.5, rank: 'sergeant', patrol: [{ x: 8.5, y: 9.5, wait: 2 }, { x: 18.5, y: 3.5, wait: 2 }] }
];

// ---------- Catálogo de la campaña ----------
const MISSIONS = [
  { id: 't1', chapter: 'Entrenamiento', num: 'E1', name: 'Protocolo Sombra', place: 'Instalación subterránea en los Andes', squad: 'Ladrón, Asalto y Perro táctico',
    desc: 'Circuito de 5 salas con conductos de ventilación, muros escalables y puertas cerradas. Aprende sombras, ganzúas, el perro mensajero y a esconder cuerpos en armarios.' },
  { id: 't2', chapter: 'Entrenamiento', num: 'E2', name: 'Fuego Cruzado', place: 'Pueblo fantasma en un desierto árido', playable: true,
    desc: 'Puesto de control, campo minado tras una alambrada, una torre de agua con vista a las azoteas y un camión militar para escapar por el cañón.',
    W: 60, H: 40, seed: 77, baseFloor: 'a', border: 'rocks', trees: 0, weather: 'desert', kits: 'desert', grass: 0.15,
    exit: { x0: 56, y0: 17, x1: 59, y1: 22 },
    squad: [
      { type: 'spy', x: 3.5, y: 33.5, inv: [['syringe', 0, 0], ['uniform', 2, 0], ['cigs', 1, 0, 1]] },
      { type: 'sapper', x: 5.5, y: 33.5, inv: [['detector', 0, 0], ['cutters', 2, 0], ['grenade', 0, 1, 2], ['bomb', 2, 1]] },
      { type: 'sniper', x: 3.5, y: 35.5, inv: [['sniper', 0, 0, 6]] },
      { type: 'driver', x: 5.5, y: 35.5, inv: [['pistolS', 0, 0, 8], ['smoke', 2, 0, 1], ['keys', 3, 0], ['medkit', 2, 1, 3]] }
    ],
    enemies: FUEGO_ENEMIES, build: buildFuegoCruzado,
    objectives: [
      Obj.neutralize([0], 'Espía: con el uniforme, cruza el control hablando con el guardia y neutraliza al oficial de la caseta'),
      Obj.destroy('wall', 'Explosivos: corta la alambrada, limpia el campo de minas con el detector y vuela el muro del cañón'),
      Obj.neutralize([2, 3], 'Francotirador: sube a la torre de agua y elimina a los dos vigías de las azoteas'),
      Obj.escapeVehicle('truck', 'Conductor: sube al camión, recoge al escuadrón y sal por el cañón')
    ],
    secondary: [],
    briefing: 'Pueblo fantasma en mitad del desierto. Día despejado y visibilidad máxima: los vigías de las azoteas lo ven todo desde arriba. Cada especialista tiene una tarea. Coordinadlas y salid juntos en el camión por el cañón del este.' },
  { id: 'm1', chapter: 'Campaña', num: '1', name: 'Frecuencia Muerta', place: 'Observatorio en el desierto de Atacama, Chile', playable: true, bonus: 'b1',
    desc: 'Tres terrazas de noche: aparcamiento, barracones de técnicos y la cúpula del radiotelescopio. Focos giratorios, subestación eléctrica y un todoterreno en el garaje sur.',
    W: 64, H: 48, seed: 1307, baseFloor: 'a', border: 'rocks', trees: 0, weather: 'night', kits: 'night', grass: 0.1, chips: 20,
    exit: { x0: 30, y0: 45, x1: 35, y1: 47 },
    squad: [
      { type: 'thief', x: 3.5, y: 41.5, inv: [['lockpick', 0, 0], ['knife', 1, 0], ['cigs', 3, 0, 3], ['wine', 3, 1, 1]] },
      { type: 'seductress', x: 4.5, y: 43.5, inv: [['lipstick', 0, 0], ['pistolS', 1, 0, 4], ['medkit', 0, 1, 3]] }
    ],
    enemies: FREC_ENEMIES, build: buildFrecuencia,
    objectives: [
      Obj.interact('power', 'Cortar el suministro eléctrico de los focos desde la subestación'),
      Obj.interact('servers', 'Infiltrarse en la sala de servidores de la cúpula y descargar los datos'),
      Obj.interact('motor', 'Sabotear el motor de rotación de la antena principal'),
      Obj.escapeVehicle('jeep', 'Escapar en el todoterreno del garaje sur')
    ],
    secondary: [
      { text: 'Robar los códigos de frecuencia al Jefe de Comunicaciones sin matarlo', check: G => G.flags.codes && G.enemies.find(e => e.tag === 'chief').state !== 'dead' },
      Obj.noAlarm('No activar ninguna alarma ni dejar cuerpos a la vista')
    ],
    briefing: 'Noche en Atacama. Los focos halógenos y las farolas dejan islas de luz en una oscuridad total: en lo oscuro los guardias ven mucho menos. La Seductora atrae a los guardias hacia los rincones oscuros donde espera el Ladrón, que puede trepar por los muros de las terrazas. Hay 20 chips escondidos en taquillas, escritorios y bolsillos de los técnicos.' },
  { id: 'm2', chapter: 'Campaña', num: '2', name: 'Abismo de Hierro', place: 'Plataforma petrolera en el Mar del Norte', bonus: 'b2', squad: 'Buzo, Explosivos y Asalto',
    desc: 'Tormenta nocturna sobre 4 niveles de acero y la zona submarina entre los pilares. Cargas magnéticas, rescate del ingeniero y evacuación en lancha.' },
  { id: 'm3', chapter: 'Campaña', num: '3', name: 'Silencio en las Cumbres', place: 'Monasterio fortificado en el Himalaya', bonus: 'b3', squad: 'Francotirador, Ladrón y Perro táctico',
    desc: 'Ventisca: la nieve deja huellas. Un abismo con puentes colgantes, un monasterio de piedra y una bóveda subterránea.' },
  { id: 'm4', chapter: 'Campaña', num: '4', name: 'Veneno Verde', place: 'Laboratorio en ruinas de la Amazonía', bonus: 'b4', squad: 'Buzo, Asalto, Espía y Perro táctico',
    desc: 'Lluvia y barro. Un río caudaloso y una pirámide con un laboratorio biológico de dos plantas.' },
  { id: 'm5', chapter: 'Campaña', num: '5', name: 'El Expreso Transiberiano', place: 'Tren blindado en la estepa siberiana', bonus: 'b5', squad: 'Espía, Conductor, Ladrón y Asalto',
    desc: 'Un tren de 14 vagones en marcha. Por dentro o por los techos, hasta la locomotora.' },
  { id: 'm6', chapter: 'Campaña', num: '6', name: 'Espejismo de Cristal', place: 'Rascacielos en Dubái', bonus: 'b6', squad: 'Seductora, Espía, Ladrón y Francotirador',
    desc: 'Plantas 78 a 80 y la azotea: una fiesta de gala, láseres, cámaras y una bóveda.' },
  { id: 'm7', chapter: 'Campaña', num: '7', name: 'Cementerio de Titanes', place: 'Astillero de desguace en Chittagong', bonus: 'b7', squad: 'Explosivos, Asalto, Buzo y Conductor',
    desc: 'Cascos de buques varados, grúas pórtico, canales y campos de minas en el lodo.' },
  { id: 'm8', chapter: 'Campaña', num: '8', name: 'Latido Volcánico', place: 'Planta geotérmica en Islandia', bonus: 'b8', squad: 'Explosivos, Francotirador, Seductora y Perro táctico',
    desc: 'Válvulas de vapor que ciegan a las patrullas, ríos de magma y una defensa final en la plataforma.' },
  { id: 'm9', chapter: 'Campaña', num: '9', name: 'La Ciudad Sumergida', place: 'Búnker nuclear inundado en Europa del Este', bonus: 'b9', squad: 'Buzo, Espía, Explosivos, Ladrón y Asalto',
    desc: 'Tres niveles subterráneos: inunda y drena sectores para abrir camino hasta el silo.' },
  { id: 'm10', chapter: 'Campaña', num: '10', name: 'Ocaso en la Ciudadela', place: 'Fortaleza en los Balcanes', squad: 'Los 9 comandos en 3 equipos',
    desc: 'Tormenta eléctrica: los relámpagos iluminan el patio. Tres equipos entran a la vez para capturar al Líder.' },
  { id: 'b1', chapter: 'Bonus', num: 'B1', name: 'Duelo en los Tejados', place: 'Hong Kong, noche', squad: 'Francotirador', desc: 'Doce francotiradores entre neones en 4 minutos.' },
  { id: 'b2', chapter: 'Bonus', num: 'B2', name: 'Fuga en el Cañón', place: 'Desierto de Mojave', squad: 'Conductor y Asalto', desc: 'Persecución en buggy por un cañón estrecho.' },
  { id: 'b3', chapter: 'Bonus', num: 'B3', name: 'El Robo del Museo', place: 'París, noche', squad: 'Ladrón', desc: 'Cinco obras de arte sin tocar el suelo.' },
  { id: 'b4', chapter: 'Bonus', num: 'B4', name: 'Aguas Profundas', place: 'Puerto de Mónaco', squad: 'Buzo', desc: 'Quince minas magnéticas en el casco de un crucero.' },
  { id: 'b5', chapter: 'Bonus', num: 'B5', name: 'Baile de Máscaras', place: 'Palacio en Venecia', squad: 'Seductora y Espía', desc: 'Seis agentes infiltrados entre ochenta invitados.' },
  { id: 'b6', chapter: 'Bonus', num: 'B6', name: 'Demolición Exprés', place: 'Garganta montañosa', squad: 'Explosivos', desc: 'Cuatro cargas y tres minutos para derribar un puente.' },
  { id: 'b7', chapter: 'Bonus', num: 'B7', name: 'El Mensajero Veloz', place: 'Zona de combate urbano', squad: 'Perro táctico', desc: 'Morfina para cuatro heridos bajo el fuego cruzado.' },
  { id: 'b8', chapter: 'Bonus', num: 'B8', name: 'Asedio en la Estación', place: 'Tundra siberiana, noche', squad: 'Todo el escuadrón', desc: 'Cinco oleadas contra una estación de radio.' },
  { id: 'b9', chapter: 'Bonus', num: 'B9', name: 'Laberinto a Ciegas', place: 'Prisión de máxima seguridad', squad: 'Asalto y Ladrón', desc: 'Fuga sin equipo desde dos celdas separadas.' },
  { id: 'classic', chapter: 'Extra', num: 'X', name: 'Operación Depósito', place: 'Base en el bosque', playable: true,
    desc: 'La misión original de prueba: vuela el depósito de combustible y reúnete en la extracción.',
    W: 64, H: 44, seed: 1944, baseFloor: 'g', border: 'forest', trees: 46, weather: 'day', kits: 'ww2', grass: 1,
    exit: { x0: 2, y0: 2, x1: 7, y1: 7 },
    squad: [{ type: 'beret', x: 2.5, y: 39.5 }, { type: 'sniper', x: 4.5, y: 39.5 }, { type: 'spy', x: 2.5, y: 41.5 }, { type: 'sapper', x: 4.5, y: 41.5 }],
    enemies: CLASSIC_ENEMIES, build: buildClassic,
    objectives: [Obj.destroy('depot', 'Volar el depósito de combustible'), Obj.reachExit('Reunir a los 4 comandos en la extracción')],
    secondary: [Obj.hasItem('docs', 'Robar los documentos del puesto de mando')],
    briefing: 'El enemigo abastece a sus blindados desde un depósito de combustible oculto tras el río. Vuelen el depósito con la bomba de Explosivos y reúnanse junto al jeep (bengala verde). Opcional: roben los documentos del escritorio del oficial.' }
];
const MISSIONS_BY_ID = {}; MISSIONS.forEach(m => { MISSIONS_BY_ID[m.id] = m; });

// ---------- Progreso guardado ----------
const Progress = {
  data: null,
  load() { try { this.data = JSON.parse(localStorage.getItem('c3-progress')) || {}; } catch (e) { this.data = {}; } return this.data; },
  save() { try { localStorage.setItem('c3-progress', JSON.stringify(this.data)); } catch (e) { /* sin almacenamiento */ } },
  get(id) { if (!this.data) this.load(); return this.data[id] || {}; },
  record(id, stars, chips) {
    if (!this.data) this.load();
    const p = this.data[id] || {};
    p.done = true; p.stars = Math.max(p.stars || 0, stars); p.chips = Math.max(p.chips || 0, chips || 0);
    this.data[id] = p; this.save();
  },
  bonusUnlocked(bid) { const m = MISSIONS.find(m => m.bonus === bid); return !!m && (this.get(m.id).chips || 0) >= (m.chips || 20); }
};
