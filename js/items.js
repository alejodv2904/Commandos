'use strict';
// Inventario en cuadrícula (estilo Commandos 2) y definición de objetos y habilidades.
// Tamaños según la guía: 1x1 pequeños, 2x1 pistola/cuchillo/cuerda, 2x2 botiquín/uniforme/bomba, 3x2 rifle.

const ITEMS = {
  knife:   { name: 'Cuchillo', w: 2, h: 1, key: 'A', target: 'enemy', desc: 'Elimina en silencio a un enemigo junto a ti.' },
  rope:    { name: 'Cuerda', w: 2, h: 1, stack: true, target: 'down', desc: 'Ata a un enemigo inconsciente para que no despierte.' },
  decoy:   { name: 'Señuelo', w: 1, h: 1, stack: true, target: 'point', desc: 'Colócalo en el suelo: suena durante 10 s y atrae a los guardias (≈12 m).' },
  medkit:  { name: 'Botiquín', w: 2, h: 2, key: 'F', target: 'ally', desc: 'Cura por completo a un comando, incluso moribundo. Tiene 3 usos.' },
  ration:  { name: 'Ración', w: 2, h: 1, target: 'self', desc: 'Recupera un 25 % de la salud.' },
  cigs:    { name: 'Cigarrillos', w: 1, h: 1, stack: true, key: 'C', target: 'point', desc: 'Cebo: un soldado raso que los vea se agacha 2 s a recogerlos.' },
  wine:    { name: 'Botella de vino', w: 1, h: 1, stack: true, key: 'V', target: 'point', desc: 'Cebo embriagante: el soldado que la beba ve la mitad durante 25 s.' },
  sniper:  { name: 'Rifle de francotirador', w: 3, h: 2, key: 'D', target: 'enemy', weapon: true, desc: 'Disparo a muy larga distancia. Se oye a unos 36 m.' },
  pistol:  { name: 'Pistola', w: 2, h: 1, key: 'S', target: 'enemy', weapon: true, desc: 'Disparo a media distancia. Se oye a unos 26 m. Anula el disfraz.' },
  syringe: { name: 'Jeringuilla', w: 1, h: 1, target: 'enemy', desc: 'Elimina en silencio a un enemigo junto a ti.' },
  uniform: { name: 'Uniforme enemigo', w: 2, h: 2, key: 'U', target: 'wear', desc: 'U: ponérselo · J: quitárselo. Con él no se puede correr.' },
  bomb:    { name: 'Bomba de relojería', w: 2, h: 2, target: 'point', desc: 'Se coloca en el suelo y explota a los 20 segundos.' },
  grenade: { name: 'Granada', w: 1, h: 1, stack: true, key: 'G', target: 'point', desc: 'Explosión de radio corto. Se oye en casi todo el complejo.' },
  cutters: { name: 'Alicates', w: 2, h: 1, key: 'E', target: 'fence', desc: 'Corta un tramo de alambrada para abrir paso.' },
  ammo:    { name: 'Munición de rifle', w: 1, h: 1, stack: true, target: null, desc: 'Balas para el rifle de francotirador.' },
  docs:    { name: 'Documentos secretos', w: 2, h: 1, target: null, desc: 'Objetivo secundario: sácalos de la base.' },
  spike:   { name: 'Pincho', w: 1, h: 1, key: 'A', target: 'enemy', desc: 'Elimina en silencio a un enemigo junto a ti.' },
  lockpick:{ name: 'Ganzúas', w: 2, h: 1, key: 'K', target: 'door', desc: 'Abre puertas cerradas con llave (unos 2 s).' },
  lipstick:{ name: 'Lápiz labial', w: 1, h: 1, key: 'L', target: 'enemy', desc: 'Atrae a un soldado o técnico: se acerca y se queda embobado mirándola mientras ella no se mueva. No funciona con oficiales.' },
  pistolS: { name: 'Pistola silenciada', w: 2, h: 1, key: 'S', target: 'enemy', weapon: true, desc: 'Disparo silencioso a media distancia (apenas se oye).' },
  smoke:   { name: 'Granada de humo', w: 1, h: 1, stack: true, key: 'Z', target: 'point', desc: 'Nube de humo de 15 s que corta la visión de los guardias.' },
  detector:{ name: 'Detector de minas', w: 2, h: 1, key: 'M', target: 'self', desc: 'Actívalo para revelar las minas cercanas. Shift + clic en una mina revelada para desactivarla.' },
  keys:    { name: 'Llaves del camión', w: 1, h: 1, target: null, desc: 'Permiten conducir el camión militar.' },
  masterkey:{ name: 'Llave maestra', w: 1, h: 1, target: null, desc: 'Abre cualquier puerta metálica cerrada (Shift + clic en la puerta). El perro puede llevarla en su collar.' },
  codes:   { name: 'Códigos de frecuencia', w: 1, h: 1, target: null, desc: 'Objetivo secundario robado del bolsillo del Jefe de Comunicaciones.' }
};

const ABILITIES = {
  punch:   { name: 'Puñetazo', key: 'Q', target: 'enemy', desc: 'Deja inconsciente a un enemigo unos 28 s. Átalo con una cuerda antes de que despierte.' },
  talk:    { name: 'Hablar', key: 'T', target: 'enemy', desc: 'Disfrazado, el Espía entretiene a un soldado: se queda mirándole mientras los demás pasan.' },
  examine: { name: 'Examinar', key: 'W', target: 'loot', desc: 'Registra cuerpos, cajas y muebles para recoger objetos.' },
  bark:    { name: 'Ladrar', key: 'B', target: null, desc: 'Ladra para atraer la atención de los guardias cercanos (≈12 m).' },
  steal:   { name: 'Robar', key: 'R', target: 'enemy', desc: 'Roba del bolsillo de un guardia vivo acercándote por la espalda (o mientras está distraído).' }
};

function actionDef(id) { return ITEMS[id] || ABILITIES[id] || null; }

const Inv = {
  make(cols, rows, list) {
    const inv = { cols, rows, items: [] };
    for (const [id, x, y, n] of list) inv.items.push({ id, x, y, n: n === undefined ? 1 : n });
    return inv;
  },
  fits(inv, w, h, x, y, ignore) {
    if (x < 0 || y < 0 || x + w > inv.cols || y + h > inv.rows) return false;
    for (const it of inv.items) {
      if (it === ignore) continue;
      const d = ITEMS[it.id];
      if (x < it.x + d.w && x + w > it.x && y < it.y + d.h && y + h > it.y) return false;
    }
    return true;
  },
  freeSpot(inv, w, h) {
    for (let y = 0; y < inv.rows; y++) for (let x = 0; x < inv.cols; x++) if (this.fits(inv, w, h, x, y)) return { x, y };
    return null;
  },
  find(inv, id) { return inv.items.find(i => i.id === id) || null; },
  count(inv, id) { const i = this.find(inv, id); return i ? i.n : 0; },
  canAdd(inv, id) { const d = ITEMS[id]; return (d.stack && this.find(inv, id)) || !!this.freeSpot(inv, d.w, d.h); },
  add(inv, id, n) {
    n = n === undefined ? 1 : n;
    const d = ITEMS[id];
    if (id === 'ammo') { const r = this.find(inv, 'sniper'); if (r) { r.n += n; return true; } }
    if (d.stack) { const it = this.find(inv, id); if (it) { it.n += n; return true; } }
    const s = this.freeSpot(inv, d.w, d.h);
    if (!s) return false;
    inv.items.push({ id, x: s.x, y: s.y, n });
    return true;
  },
  take(inv, id, n) {
    const it = this.find(inv, id); if (!it) return false;
    it.n -= n === undefined ? 1 : n;
    if (it.n <= 0) inv.items.splice(inv.items.indexOf(it), 1);
    return true;
  },
  remove(inv, it) { const i = inv.items.indexOf(it); if (i >= 0) inv.items.splice(i, 1); }
};
