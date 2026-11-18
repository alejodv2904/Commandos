'use strict';
// Interfaz: retratos, mochila en cuadrícula, habilidades, objetivos, mapa táctico, informes.

const CELL = 30;
const ITEM_ICON = { sniper: 'shoot', uniform: 'disguise', decoy: 'lure' };

const HUD = {
  dirty: true, key: null,

  build() {
    const box = document.getElementById('squad');
    box.innerHTML = '';
    G.units.forEach((u, i) => {
      const c = document.createElement('div');
      c.className = 'sq'; c.id = 'sq' + i; c.title = u.def.name;
      c.innerHTML = `<canvas width="64" height="70"></canvas><div class="sq-hp"><div class="fill"></div></div><span class="fk">${i + 1}</span><span class="dy"></span>`;
      Sprites.portrait(c.querySelector('canvas').getContext('2d'), u.type, 64, 70);
      c.addEventListener('click', e => { if (e.ctrlKey) { u.selected = !u.selected; this.dirty = true; } else Input.selectOnly(u); });
      c.addEventListener('dblclick', () => G.centerOn(u.x, u.y));
      // recibir objetos arrastrados desde la mochila
      c.addEventListener('dragover', e => e.preventDefault());
      c.addEventListener('drop', e => { e.preventDefault(); const d = JSON.parse(e.dataTransfer.getData('text/plain') || '{}'); this.transfer(d.from, d.item, u); });
      box.appendChild(c);
    });
    this.key = null; this.dirty = true;
  },

  transfer(fromIdx, itemIdx, to) {
    const from = G.units[fromIdx]; if (!from || from === to) return;
    const it = from.inv.items[itemIdx]; if (!it) return;
    if (!to.alive || to.dying) return;
    if (dist(from.x, from.y, to.x, to.y) > 1.8) { G.toast('Tienen que estar juntos para pasarse objetos', true); return; }
    if (it.id === 'uniform' && from.disguised) { G.toast('Primero quítate el uniforme (J)', true); return; }
    if (!Inv.add(to.inv, it.id, it.n)) { G.toast(`${to.def.name} no tiene sitio en la mochila`, true); return; }
    Inv.remove(from.inv, it);
    if (from.action === it.id) from.action = null;
    G.toast(`${ITEMS[it.id].name} → ${to.def.name}`); Sfx.play('select');
    this.dirty = true;
  },

  buildPanel(p) {
    const pc = document.getElementById('portrait'), x = pc.getContext('2d');
    x.clearRect(0, 0, pc.width, pc.height);
    const inv = document.getElementById('inv'), ab = document.getElementById('abil');
    inv.innerHTML = ''; ab.innerHTML = '';
    if (!p) { document.getElementById('unit-name').textContent = '—'; return; }
    Sprites.portrait(x, p.disguised ? 'spyDis' : p.type, pc.width, pc.height);
    document.getElementById('unit-name').textContent = p.def.name.toUpperCase();
    inv.style.width = p.inv.cols * CELL + 'px'; inv.style.height = p.inv.rows * CELL + 'px';
    p.inv.items.forEach((it, i) => {
      const d = ITEMS[it.id];
      const el = document.createElement('div');
      el.className = 'item'; el.dataset.id = it.id; el.draggable = true;
      Object.assign(el.style, { left: it.x * CELL + 'px', top: it.y * CELL + 'px', width: d.w * CELL + 'px', height: d.h * CELL + 'px' });
      const s = Math.min(d.w, d.h) * CELL - 4, c = makeCanvas(s, s);
      Sprites.icon(c.getContext('2d'), ITEM_ICON[it.id] || it.id, s);
      el.appendChild(c);
      const showN = d.stack || ['sniper', 'pistol', 'medkit'].includes(it.id);
      el.insertAdjacentHTML('beforeend', `${d.key ? `<span class="key">${d.key}</span>` : ''}${showN ? `<span class="badge">${it.n}</span>` : ''}`);
      el.title = `${d.name} — ${d.desc}`;
      el.addEventListener('click', () => Input.equip(it.id));
      el.addEventListener('mouseenter', () => { this.hint = `<b>${d.name}</b> · ${d.desc}`; });
      el.addEventListener('mouseleave', () => { this.hint = null; });
      el.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', JSON.stringify({ from: p.idx, item: i })));
      inv.appendChild(el);
    });
    const abil = p.def.abilities.map(id => ({ id, ...ABILITIES[id] }));
    if (!p.def.animal) {
      abil.push({ id: 'prone', name: 'Cuerpo a tierra', key: 'Espacio', desc: 'Tumbado eres invisible en la zona oscura del cono. Muy lento.' });
      abil.push({ id: 'cover', name: 'Cubrirse', key: 'X', desc: 'Prepara el arma y dispara al primer enemigo que entre en la línea de tiro.' });
    }
    for (const a of abil) {
      const b = document.createElement('div');
      b.className = 'ab'; b.dataset.id = a.id; b.title = `${a.name} [${a.key}] — ${a.desc}`;
      const c = makeCanvas(30, 30); Sprites.icon(c.getContext('2d'), a.id === 'examine' ? 'eye' : a.id, 30); b.appendChild(c);
      b.insertAdjacentHTML('beforeend', `<span class="key">${a.key === 'Espacio' ? '␣' : a.key}</span>`);
      b.addEventListener('click', () => { if (a.id === 'prone') Input.toggleProne(); else if (a.id === 'cover') Input.toggleCover(); else Input.equip(a.id); });
      b.addEventListener('mouseenter', () => { this.hint = `<b>${a.name} [${a.key}]</b> · ${a.desc}`; });
      b.addEventListener('mouseleave', () => { this.hint = null; });
      ab.appendChild(b);
    }
  },

  update() {
    const p = G.primary();
    const key = p ? p.idx + '|' + p.disguised + '|' + p.inv.items.map(i => i.id + i.x + i.y).join(',') : 'none';
    if (key !== this.key || this.dirty) { this.key = key; this.buildPanel(p); this.dirty = false; }
    if (p) {
      document.querySelectorAll('#inv .item').forEach(el => {
        const it = Inv.find(p.inv, el.dataset.id);
        el.classList.toggle('on', p.action === el.dataset.id || (el.dataset.id === 'uniform' && p.disguised));
        const b = el.querySelector('.badge'); if (b && it) b.textContent = it.n;
      });
      document.querySelectorAll('#abil .ab').forEach(el => {
        const id = el.dataset.id;
        el.classList.toggle('on', id === 'prone' ? p.prone : id === 'cover' ? p.cover : p.action === id);
      });
      const hp = document.getElementById('unit-hp');
      hp.innerHTML = `<div class="bar"><div class="fill${p.dying ? ' dying' : ''}" style="width:${p.hp / p.maxHp * 100}%"></div></div>`;
      let st = p.dying ? `MORIBUNDO · ${Math.ceil(p.dyingT)} s` : p.prone ? 'Cuerpo a tierra' : p.run && p.moving ? 'Corriendo' : 'De pie';
      if (p.carry) st = 'Cargando un cuerpo';
      if (p.disguised) st += ' · De uniforme';
      if (p.inBush) st += ' · Oculto';
      if (p.cover) st += ' · Cubriéndose';
      document.getElementById('unit-state').textContent = st;
      const cur = actionDef(p.action);
      document.getElementById('hint').innerHTML = this.hint || (cur ? `<b>${cur.name}</b> · ${cur.desc}<br><small>Clic izq.: usar · Clic der.: cancelar</small>` : 'Clic izq.: andar (doble clic: correr) · Clic der. arrastrando: selección múltiple · Shift+clic: interactuar · F1: ayuda');
    } else {
      document.getElementById('unit-hp').innerHTML = ''; document.getElementById('unit-state').textContent = '';
    }
    G.units.forEach((u, i) => {
      const c = document.getElementById('sq' + i); if (!c) return;
      c.className = 'sq' + (u.selected ? ' sel' : '') + (u.alive ? '' : ' dead') + (u.dying ? ' dying' : '');
      c.querySelector('.fill').style.width = (u.hp / u.maxHp * 100) + '%';
      c.querySelector('.dy').textContent = u.dying ? Math.ceil(u.dyingT) : '';
    });
    const o = document.getElementById('objectives'), M = G.mission;
    const t = Math.floor(G.time), mm = String(Math.floor(t / 60)).padStart(2, '0'), ss = String(t % 60).padStart(2, '0');
    const bomb = G.bombs[0];
    const prim = M.objectives.map((ob, i) => `<div class="${G.objState[i] ? 'done' : ''}">⚑ ${G.objState[i] ? '☑' : '☐'} ${ob.text}</div>`).join('');
    const sec = (M.secondary || []).map((ob, i) => `<div class="sec ${G.secState[i] ? 'done' : ''}">⚐ ${G.secState[i] ? '☑' : '☐'} Opcional: ${ob.text}</div>`).join('');
    o.innerHTML = `<h3>${M.num ? M.num + ' · ' : ''}${M.name.toUpperCase()}</h3>${prim}${sec}
      ${bomb ? `<div class="bomb">⏱ Detonación en ${Math.ceil(bomb.t)} s</div>` : ''}
      <div class="meta">${mm}:${ss} · Alarmas: ${G.stats.alarms}${M.chips ? ` · Chips: ${G.chips}/${M.chips}` : ''}${G.night ? (G.power ? ' · Focos encendidos' : ' · Sin electricidad') : ''}${G.paused ? ' · EN PAUSA' : ''}</div>`;
  },

  // ---------- mapa táctico (F9) ----------
  toggleTactical() {
    G.tactical = !G.tactical;
    document.getElementById('tactical').classList.toggle('show', G.tactical);
  },

  drawTactical() {
    const c = document.getElementById('tmap'), x = c.getContext('2d');
    const W = c.width, H = c.height, sx = W / Level.W, sy = H / Level.H;
    x.drawImage(Render.miniBase, 0, 0, W, H);
    x.fillStyle = 'rgba(20,16,8,.15)'; x.fillRect(0, 0, W, H);
    const flag = (fx, fy, col, label) => {
      const px = fx * sx, py = fy * sy;
      x.strokeStyle = '#111'; x.lineWidth = 2; x.beginPath(); x.moveTo(px, py); x.lineTo(px, py - 26); x.stroke();
      x.fillStyle = col; x.beginPath(); x.moveTo(px, py - 26); x.lineTo(px + 18, py - 21); x.lineTo(px, py - 15); x.fill();
      x.font = '12px "Special Elite", monospace'; x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 3; x.textAlign = 'left';
      x.strokeText(label, px + 6, py + 12); x.fillText(label, px + 6, py + 12);
    };
    for (const t of Level.targets) if (!t.destroyed) flag(t.prop.x + t.prop.w / 2, t.prop.y + t.prop.h / 2, '#d03020', t.id === 'depot' ? 'Depósito (principal)' : 'Objetivo (principal)');
    for (const it of Level.interacts) if (!it.done && !it.climb) flag(it.x, it.y, '#d03020', it.name);
    const sec = Level.loot.find(l => l.secondary);
    if (sec && sec.items.length) flag(sec.x, sec.y, '#e8c030', 'Documentos (opcional)');
    flag((Level.exit.x0 + Level.exit.x1 + 1) / 2, Level.exit.y1 + 1, '#3a8ae0', 'Extracción');
    for (const l of Level.loot) if (l.items.length && !l.secondary) { x.fillStyle = '#e8c030'; x.fillRect(l.x * sx - 4, l.y * sy - 4, 8, 8); }
    for (const e of G.enemies) {
      if (e.hidden || e.carried) continue;
      const px = e.x * sx, py = e.y * sy;
      if (!e.alive) { x.strokeStyle = '#7a1a10'; x.lineWidth = 2; x.beginPath(); x.moveTo(px - 4, py - 4); x.lineTo(px + 4, py + 4); x.moveTo(px + 4, py - 4); x.lineTo(px - 4, py + 4); x.stroke(); continue; }
      x.fillStyle = e.state === 'alert' ? '#ff2a10' : '#d83a2a';
      x.beginPath(); x.arc(px, py, 5, 0, 7); x.fill();
      x.strokeStyle = '#ffd0c0'; x.lineWidth = 2; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(e.face) * 14, py + Math.sin(e.face) * 14); x.stroke();
    }
    for (const u of G.units) {
      if (!u.alive) continue;
      const px = u.x * sx, py = u.y * sy;
      x.fillStyle = '#000'; x.beginPath(); x.arc(px, py, 7, 0, 7); x.fill();
      x.fillStyle = u.dying ? '#ff8040' : '#4cff3a'; x.beginPath(); x.arc(px, py, 5.5, 0, 7); x.fill();
      x.fillStyle = '#000'; x.font = 'bold 10px sans-serif'; x.textAlign = 'center'; x.fillText(u.idx + 1, px, py + 3.5);
    }
  },

  // ---------- pantallas ----------
  // ---------- menú principal ----------
  showMenu() {
    G.overlayOpen = true;
    const ov = document.getElementById('overlay'); ov.className = 'show menu';
    const has = (() => { try { return !!localStorage.getItem('commandos3-save'); } catch (e) { return false; } })();
    ov.innerHTML = `<div class="mainmenu">
      <div class="mm-title">COMMANDOS 3</div><div class="mm-sub">Hombres de Valor</div>
      <div class="mm-btns">
        <button data-a="camp">Campaña</button>
        ${has ? '<button data-a="load">Cargar partida guardada</button>' : ''}
        <button data-a="help">Controles y reglas</button>
      </div>
      <div class="mm-foot">Táctica y sigilo en tiempo real · Texturas CC0 de ambientCG · Three.js</div></div>`;
    ov.querySelectorAll('button').forEach(b => b.onclick = () => {
      Sfx.ensure();
      if (b.dataset.a === 'camp') this.showCampaign();
      else if (b.dataset.a === 'help') this.showIntro(true);
      else { this.closeOverlay(); G.load(); }
    });
  },

  closeOverlay() { G.overlayOpen = false; document.getElementById('overlay').className = ''; },

  // ---------- selector de campaña (21 misiones de la biblia) ----------
  showCampaign(sel) {
    G.overlayOpen = true;
    const ov = document.getElementById('overlay'); ov.className = 'show menu';
    Progress.load();
    const status = m => {
      if (m.chapter === 'Bonus') return Progress.bonusUnlocked(m.id) ? 'desbloqueada' : 'bloqueada';
      return m.playable ? 'jugable' : 'desarrollo';
    };
    const groups = ['Entrenamiento', 'Campaña', 'Bonus', 'Extra'];
    sel = sel || (MISSIONS.find(m => m.playable && !Progress.get(m.id).done) || MISSIONS.find(m => m.playable)).id;
    const card = m => {
      const p = Progress.get(m.id), st = status(m);
      return `<div class="mcard ${st} ${m.id === sel ? 'sel' : ''}" data-id="${m.id}"><span class="mn">${m.num}</span><span class="mt">${m.name}</span>
        <span class="ms">${p.done ? '★'.repeat(p.stars || 0) : st === 'jugable' ? '▶' : st === 'bloqueada' ? '🔒' : '…'}</span></div>`;
    };
    const m = MISSIONS_BY_ID[sel], p = Progress.get(m.id), st = status(m);
    const bonusOf = MISSIONS.find(x => x.bonus === m.id);
    ov.innerHTML = `<div class="campaign">
      <div class="c-list">${groups.map(g => `<h4>${g.toUpperCase()}</h4>${MISSIONS.filter(x => x.chapter === g).map(card).join('')}`).join('')}</div>
      <div class="c-detail dossier">
        <div class="hdr">${m.chapter.toUpperCase()} ${m.num} · ${m.place.toUpperCase()}</div>
        <h1>${m.name}</h1>
        <p>${m.desc}</p>
        <table>
          <tr><td>Escuadrón</td><td>${m.squad && m.squad.map ? m.squad.map(q => UNIT_DEFS[q.type].name).join(', ') : m.squad}</td></tr>
          ${m.weather ? `<tr><td>Clima</td><td>${WEATHER[m.weather].name}</td></tr>` : ''}
          ${p.done ? `<tr><td>Mejor resultado</td><td>${'★'.repeat(p.stars || 0)}${'☆'.repeat(5 - (p.stars || 0))}${m.chips ? ` · chips ${p.chips || 0}/${m.chips}` : ''}</td></tr>` : ''}
          ${m.bonus ? `<tr><td>Bonus</td><td>Reúne los ${m.chips || 20} chips para desbloquear «${MISSIONS_BY_ID[m.bonus].name}»</td></tr>` : ''}
          ${bonusOf ? `<tr><td>Se desbloquea</td><td>Con los chips de «${bonusOf.name}»</td></tr>` : ''}
        </table>
        ${m.objectives ? `<h4>OBJETIVOS</h4>${m.objectives.map(o => `<p class="small">⚑ ${o.text}</p>`).join('')}${(m.secondary || []).map(o => `<p class="small">⚐ Opcional: ${o.text}</p>`).join('')}` : ''}
        ${st === 'jugable' ? '<button id="playBtn">Ver informe de la misión</button>'
          : st === 'desbloqueada' ? '<p class="small"><b>Desbloqueada.</b> Esta misión de bonificación aún está en desarrollo.</p>'
          : st === 'bloqueada' ? '<p class="small">Bloqueada: reúne todos los chips de su misión principal.</p>'
          : '<p class="small"><b>En desarrollo.</b> Esta misión de la biblia todavía no es jugable.</p>'}
        <button id="backBtn" class="ghost">Volver al menú</button>
      </div></div>`;
    ov.querySelectorAll('.mcard').forEach(c => c.onclick = () => this.showCampaign(c.dataset.id));
    const pb = document.getElementById('playBtn'); if (pb) pb.onclick = () => this.showBriefing(m.id);
    document.getElementById('backBtn').onclick = () => this.showMenu();
  },

  // ---------- informe de la misión ----------
  showBriefing(id) {
    const M = MISSIONS_BY_ID[id];
    G.overlayOpen = true;
    const ov = document.getElementById('overlay'); ov.className = 'show';
    ov.innerHTML = `<div class="dossier">
      <div class="stamp">ALTO SECRETO</div>
      <div class="hdr">${M.chapter.toUpperCase()} ${M.num} · ${M.place.toUpperCase()}</div>
      <h1>${M.name}</h1><h2>${WEATHER[M.weather].name} · Escuadrón: ${M.squad.map(q => UNIT_DEFS[q.type].name).join(', ')}</h2>
      <p>${M.briefing}</p>
      <h4>OBJETIVOS PRINCIPALES</h4>${M.objectives.map(o => `<p class="small">⚑ ${o.text}</p>`).join('')}
      ${(M.secondary || []).length ? `<h4>OBJETIVOS SECUNDARIOS</h4>${M.secondary.map(o => `<p class="small">⚐ ${o.text}</p>`).join('')}` : ''}
      <h4>EQUIPO</h4><table>${M.squad.map(q => `<tr><td>${UNIT_DEFS[q.type].name}</td><td>${(q.inv || UNIT_DEFS[q.type].inv[2]).map(i => ITEMS[i[0]].name + (i[3] > 1 ? ' ×' + i[3] : '')).join(', ')}</td></tr>`).join('')}</table>
      <button id="goBtn">Comenzar misión</button> <button id="helpBtn" class="ghost">Controles</button> <button id="backBtn" class="ghost">Volver</button></div>`;
    document.getElementById('goBtn').onclick = () => { Sfx.ensure(); G.reset(M.id); this.closeOverlay(); };
    document.getElementById('helpBtn').onclick = () => this.showIntro(true, () => this.showBriefing(id));
    document.getElementById('backBtn').onclick = () => this.showCampaign(M.id);
  },

  showIntro(fromMenu, back) {
    G.overlayOpen = true;
    const ov = document.getElementById('overlay');
    ov.className = 'show';
    ov.innerHTML = `<div class="dossier">
      <div class="stamp">ALTO SECRETO</div>
      <div class="hdr">MANUAL DE CAMPO · CONTROLES Y REGLAS</div>
      <h1>COMMANDOS 3</h1><h2>Hombres de Valor</h2>
      <p>Si un comando cae moribundo, cúralo con un botiquín antes de 15 s o la misión fracasará. Los rombos dorados del mapa marcan objetivos con los que interactuar (Shift + clic).</p>
      <div class="cols">
      <div><h4>RATÓN</h4><table>
        <tr><td>Clic izquierdo</td><td>Seleccionar · andar · usar el objeto equipado</td></tr>
        <tr><td>Doble clic</td><td>Correr (hace ruido)</td></tr>
        <tr><td>Clic derecho</td><td>Cancelar la acción · arrastrar: selección múltiple</td></tr>
        <tr><td>Shift + clic</td><td>Interactuar: cargar/soltar cuerpos, registrar</td></tr>
        <tr><td>Alt + clic · ← →</td><td>Girar la cámara 90°</td></tr>
      </table><h4>TECLADO</h4><table>
        <tr><td>1–9 · Ctrl+1–9 · 0</td><td>Elegir comando · añadir · ninguno</td></tr>
        <tr><td>Espacio · X</td><td>Cuerpo a tierra · cubrirse</td></tr>
        <tr><td>Q A S D</td><td>Puñetazo · cuchillo · pistola · rifle</td></tr>
        <tr><td>G F C V E</td><td>Granada · botiquín · cigarrillos · vino · alicates</td></tr>
        <tr><td>W · T · U / J</td><td>Examinar · hablar (Espía) · poner/quitar uniforme</td></tr>
        <tr><td>K · R · L · Z · M</td><td>Ganzúas · robar · lápiz labial · humo · detector de minas</td></tr>
        <tr><td>Shift + clic</td><td>Subir/bajar de vehículos, desactivar minas, abrir puertas, objetivos</td></tr>
        <tr><td>Tab / Intro</td><td>Fijar el cono del enemigo bajo el cursor (en vacío: todos)</td></tr>
        <tr><td>F8 · F9 · F10 · F11</td><td>Ocultar HUD · mapa táctico · objetos · enemigos</td></tr>
        <tr><td>Ctrl+S · Ctrl+L · P · Ctrl+M</td><td>Guardar · cargar · pausa · sonido</td></tr>
      </table></div>
      <div><h4>EL CONO DE VISIÓN</h4>
      <p class="small"><b>Verde claro (cerca):</b> te ven en cualquier postura. <b>Verde oscuro (lejos):</b> cuerpo a tierra eres invisible. Muros, vehículos, árboles y arbustos cortan el cono.</p>
      <p class="small"><b>Naranja:</b> oyó un ruido y va a investigar. <b>Azul:</b> vio algo raro (un cuerpo). <b>Rojo:</b> te ha descubierto y da la alarma.</p>
      <h4>RUIDO</h4><p class="small">Andar y arrastrarse: silencio. Cuchillo/puñetazo ≈4 m. Correr ≈7 m. Señuelo ≈12 m. Pistola ≈26 m, rifle ≈36 m. Explosiones: todo el complejo.</p>
      <h4>ENEMIGOS</h4><p class="small"><b>Soldados</b> recogen cigarrillos y vino. <b>Sargentos</b> disparan más rápido y no se distraen si están alerta. <b>Oficiales</b> no caen en cebos y descubren al instante a cualquier comando de uniforme salvo al Espía. La <b>Gestapo</b> (gabardina negra) descubre al Espía si pasa más de 2 s en su zona cercana (barra azul). <b>Francotiradores</b> en torres: cono largo y estrecho, disparan sin aviso.</p>
      <h4>CUERPOS</h4><p class="small">Un cuerpo a la vista provoca la alarma. Escóndelos en arbustos o dentro de edificios (Shift+clic). Un puñetazo deja inconsciente ~28 s: átalo con una cuerda.</p></div>
      </div>
      <button>${fromMenu ? 'Volver' : 'Continuar'}</button></div>`;
    ov.querySelector('button').onclick = () => { Sfx.ensure(); if (back) back(); else if (fromMenu) this.showMenu(); else this.closeOverlay(); };
  },

  showEnd(win, msg) {
    G.overlayOpen = true;
    const M = G.mission, t = Math.floor(G.time), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
    const R = win ? G.rating() : { n: 0, crit: [] }, stars = R.n;
    const next = win ? MISSIONS.slice(MISSIONS.indexOf(M) + 1).find(m => m.playable && m.chapter !== 'Extra') : null;
    const unlocked = win && M.bonus && Progress.bonusUnlocked(M.bonus);
    const ov = document.getElementById('overlay'); ov.className = 'show';
    ov.innerHTML = `<div class="dossier ${win ? 'win' : 'lose'}">
      <div class="stamp">${win ? 'CUMPLIDA' : 'FRACASO'}</div>
      <div class="hdr">INFORME FINAL · ${M.chapter.toUpperCase()} ${M.num} · ${M.name.toUpperCase()}</div>
      <h1>${win ? 'MISIÓN CUMPLIDA' : 'MISIÓN FRACASADA'}</h1>
      <h2>${win ? M.place : (msg || '')}</h2>
      ${win ? `<div class="stars">${'★'.repeat(stars)}<span>${'★'.repeat(5 - stars)}</span></div><table class="stats">${R.crit.map(c => `<tr><td>${c[1] ? '☑' : '☐'} ${c[0]}</td></tr>`).join('')}</table>` : ''}
      ${unlocked ? `<p><b>¡Bonus desbloqueado!</b> «${MISSIONS_BY_ID[M.bonus].name}»</p>` : ''}
      <table class="stats"><tr><td>Tiempo</td><td>${mm}:${ss}</td></tr><tr><td>Alarmas</td><td>${G.stats.alarms}</td></tr>
      <tr><td>Enemigos eliminados</td><td>${G.stats.kills}</td></tr><tr><td>Enemigos neutralizados</td><td>${G.stats.ko}</td></tr></table>
      ${next ? '<button id="nextBtn">Siguiente misión</button> ' : ''}<button id="againBtn" class="${next ? 'ghost' : ''}">Reintentar</button>${win ? '' : ' <button id="loadBtn">Cargar partida (Ctrl+L)</button>'} <button id="campBtn" class="ghost">Campaña</button></div>`;
    document.getElementById('againBtn').onclick = () => { G.reset(M.id); this.closeOverlay(); };
    document.getElementById('campBtn').onclick = () => this.showCampaign(M.id);
    const nb = document.getElementById('nextBtn'); if (nb) nb.onclick = () => this.showBriefing(next.id);
    const lb = document.getElementById('loadBtn'); if (lb) lb.onclick = () => { G.over = null; this.closeOverlay(); G.load(); };
  }
};
