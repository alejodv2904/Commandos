'use strict';
// Dibujado en canvas con vista oblicua (3/4) al estilo Commandos.

const WALL_H = TILE * 0.55;

const Render = {
  ground: null,

  bakeGround() {
    const W = Level.W, H = Level.H;
    const c = this.ground || (this.ground = document.createElement('canvas'));
    c.width = W * TILE; c.height = H * TILE;
    const x = c.getContext('2d'), rng = mulberry32(77);
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const ch = Level.at(tx, ty), px = tx * TILE, py = ty * TILE, v = rng();
      let col;
      switch (ch) {
        case ',': col = `hsl(36,22%,${39 + v * 3}%)`; break;
        case 'r': col = `hsl(40,6%,${38 + v * 4}%)`; break;
        case '=': col = `hsl(34,28%,${44 + v * 4}%)`; break;
        case 'D': col = '#5b3b22'; break;
        case 's': col = `hsl(20,10%,${14 + v * 6}%)`; break;
        case 'T': case 'f': col = `hsl(${92 + v * 12},30%,${27 + v * 6}%)`; break;
        default: col = `hsl(${90 + v * 8},30%,${28 + v * 3.5}%)`;
      }
      x.fillStyle = col; x.fillRect(px, py, TILE, TILE);
      if (ch === '.' || ch === 'T' || ch === 'f') {
        x.fillStyle = 'rgba(20,40,10,.35)';
        for (let i = 0; i < 4; i++) x.fillRect(px + rng() * TILE, py + rng() * TILE, 2, 4);
      }
      if (ch === '=') { x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(px, py + TILE - 1, TILE, 1); }
      if (ch === 'r' && ty % 2 === 0 && tx % 2 === 0) { x.fillStyle = 'rgba(220,210,150,.25)'; x.fillRect(px + 8, py + TILE - 2, 22, 3); }
      if (ch === 's') { x.fillStyle = 'rgba(0,0,0,.4)'; x.beginPath(); x.arc(px + TILE / 2, py + TILE / 2, 12 + v * 6, 0, 7); x.fill(); }
    }
    // zona de extracción
    const e = Level.exit;
    x.fillStyle = 'rgba(90,160,255,.18)';
    x.fillRect(e.x0 * TILE, e.y0 * TILE, (e.x1 - e.x0 + 1) * TILE, (e.y1 - e.y0 + 1) * TILE);
    x.strokeStyle = 'rgba(120,190,255,.7)'; x.setLineDash([10, 8]); x.lineWidth = 3;
    x.strokeRect(e.x0 * TILE + 2, e.y0 * TILE + 2, (e.x1 - e.x0 + 1) * TILE - 4, (e.y1 - e.y0 + 1) * TILE - 4);
    x.setLineDash([]);
    x.fillStyle = 'rgba(160,210,255,.8)'; x.font = 'bold 16px sans-serif'; x.textAlign = 'center';
    x.fillText('EXTRACCIÓN', (e.x0 + (e.x1 - e.x0 + 1) / 2) * TILE, (e.y0 + (e.y1 - e.y0 + 1) / 2) * TILE + 5);
  },

  // ---- bloques altos ----
  drawBlock(ctx, tx, ty) {
    const ch = Level.at(tx, ty), px = tx * TILE, py = ty * TILE;
    if (ch === '#' || ch === 'R' || ch === 'B') {
      const topC = ch === '#' ? '#9a8f78' : ch === 'R' ? '#5d5d5d' : '#b8452f';
      const frC = ch === '#' ? '#6a6150' : ch === 'R' ? '#3c3c3c' : '#7e2c1d';
      if (!Level.tall(tx, ty + 1)) {
        ctx.fillStyle = frC; ctx.fillRect(px, py + TILE - WALL_H, TILE, WALL_H);
        ctx.fillStyle = 'rgba(0,0,0,.18)';
        if (ch === '#') { for (let i = 1; i < 3; i++) ctx.fillRect(px, py + TILE - WALL_H + i * WALL_H / 3, TILE, 1); }
        if (ch === 'B') { ctx.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 4; i++) ctx.fillRect(px + 4 + i * 9, py + TILE - WALL_H + 2, 2, WALL_H - 4); }
        // sombra de la pared
        ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(px, py + TILE, TILE, 6);
      }
      ctx.fillStyle = topC; ctx.fillRect(px, py - WALL_H, TILE, TILE);
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(px, py - WALL_H, TILE, 3);
      if (ch === 'B') { ctx.fillStyle = '#e6c445'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('⛽', px + TILE / 2, py - WALL_H + TILE / 2 + 4); }
    } else if (ch === 'f') {
      ctx.strokeStyle = '#2d2a22'; ctx.lineWidth = 2;
      const hz = Level.at(tx - 1, ty) === 'f' || Level.at(tx + 1, ty) === 'f';
      const vt = Level.at(tx, ty - 1) === 'f' || Level.at(tx, ty + 1) === 'f';
      ctx.beginPath();
      if (hz) { ctx.moveTo(px, py + TILE / 2); ctx.lineTo(px + TILE, py + TILE / 2); ctx.moveTo(px, py + TILE / 2 - 10); ctx.lineTo(px + TILE, py + TILE / 2 - 10); }
      if (vt) { ctx.moveTo(px + TILE / 2, py); ctx.lineTo(px + TILE / 2, py + TILE); }
      ctx.stroke();
      ctx.fillStyle = '#3a362b'; ctx.fillRect(px + TILE / 2 - 2, py + TILE / 2 - 14, 4, 16);
    } else if (ch === 'T') {
      const r = mulberry32(tx * 131 + ty * 17);
      for (let i = 0; i < 3; i++) {
        const ox = px + 8 + r() * (TILE - 16), oy = py + 12 + r() * (TILE - 18);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(ox, oy + 6, 11, 4, 0, 0, 7); ctx.fill();
        ctx.fillStyle = `hsl(${100 + r() * 20},45%,${22 + r() * 10}%)`;
        ctx.beginPath(); ctx.arc(ox, oy - 4, 11 + r() * 3, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.arc(ox - 3, oy - 8, 5, 0, 7); ctx.fill();
      }
    }
  },

  // ---- personajes ----
  person(ctx, x, y, o) {
    const px = x * TILE, py = y * TILE, s = TILE / 40;
    ctx.save();
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(px, py + 2, 10 * s, 4.5 * s, 0, 0, 7); ctx.fill();
    const bob = o.moving ? Math.sin(o.anim * 3) * 1.5 * s : 0;
    // piernas
    ctx.strokeStyle = o.pants || '#2b2b25'; ctx.lineWidth = 4 * s;
    const sw = o.moving ? Math.sin(o.anim * 3) * 4 * s : 0;
    ctx.beginPath(); ctx.moveTo(px - 3 * s, py - 8 * s); ctx.lineTo(px - 3 * s + sw, py); ctx.moveTo(px + 3 * s, py - 8 * s); ctx.lineTo(px + 3 * s - sw, py); ctx.stroke();
    // torso
    ctx.fillStyle = o.hurt ? '#ff7766' : o.color;
    ctx.beginPath(); ctx.roundRect(px - 7 * s, py - 24 * s + bob, 14 * s, 17 * s, 4 * s); ctx.fill();
    // brazo / arma en la dirección de la mirada
    const dx = Math.cos(o.face), dy = Math.sin(o.face);
    ctx.strokeStyle = '#1a1a16'; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(px, py - 17 * s + bob); ctx.lineTo(px + dx * 13 * s, py - 17 * s + dy * 8 * s + bob); ctx.stroke();
    // cabeza
    ctx.fillStyle = '#e0b48c'; ctx.beginPath(); ctx.arc(px, py - 29 * s + bob, 5.5 * s, 0, 7); ctx.fill();
    ctx.fillStyle = o.hat || '#444';
    ctx.beginPath(); ctx.arc(px, py - 31 * s + bob, 6 * s, Math.PI, 0); ctx.fill();
    if (o.officer) { ctx.fillStyle = '#c33'; ctx.fillRect(px - 6 * s, py - 31 * s + bob, 12 * s, 2 * s); }
    // cara orientada
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(px + dx * 3 * s, py - 29 * s + dy * 1.5 * s + bob, 1.2 * s, 0, 7); ctx.fill();
    ctx.restore();
  },

  bodyOnGround(ctx, e) {
    const px = e.x * TILE, py = e.y * TILE;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(px, py + 3, 15, 6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = e.officer ? '#7d7d88' : '#555e6e';
    ctx.beginPath(); ctx.ellipse(px, py, 13, 6, 0.15, 0, 7); ctx.fill();
    ctx.fillStyle = '#e0b48c'; ctx.beginPath(); ctx.arc(px - 11, py - 1, 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#2f343c'; ctx.beginPath(); ctx.arc(px - 12, py - 3, 5, Math.PI, 0); ctx.fill();
    if (e.state === 'down') { ctx.fillStyle = '#cfe'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('z z', px, py - 12 + Math.sin(performance.now() / 400) * 2); }
    else { ctx.strokeStyle = '#8a1b1b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + 2, py - 3); ctx.lineTo(px + 8, py + 3); ctx.stroke(); }
  },

  drawCommando(ctx, u, alpha) {
    const o = {
      face: u.face, color: u.disguised ? '#555e6e' : u.def.color, hat: u.disguised ? '#2f343c' : u.type === 'beret' ? '#1f5a20' : '#3a3a2a',
      moving: u.moving, anim: u.anim, hurt: u.hurt > 0, alpha: u.inBush ? 0.6 : alpha
    };
    if (u.busyKind === 'plant') o.moving = false;
    this.person(ctx, u.x, u.y, o);
    const px = u.x * TILE, py = u.y * TILE;
    if (u.carry) {
      ctx.fillStyle = '#555e6e'; ctx.beginPath(); ctx.ellipse(px, py - 24, 14, 5, -0.4, 0, 7); ctx.fill();
    }
    if (u.selected) {
      ctx.strokeStyle = '#e6e66a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(px, py + 2, 16, 7, 0, 0, 7); ctx.stroke();
      // vida
      for (let i = 0; i < u.def.hp; i++) { ctx.fillStyle = i < u.hp ? '#d1473a' : '#3a2020'; ctx.fillRect(px - u.def.hp * 4.5 + i * 9, py - 46, 8, 4); }
    }
    if (u.busyT > 0 && u.busyKind === 'plant') {
      const p = 1 - u.busyT / 3;
      ctx.fillStyle = '#000a'; ctx.fillRect(px - 16, py - 44, 32, 6);
      ctx.fillStyle = '#ff9a4d'; ctx.fillRect(px - 15, py - 43, 30 * p, 4);
    }
  },

  drawEnemy(ctx, e) {
    this.person(ctx, e.x, e.y, {
      face: e.face, color: e.officer ? '#7d7d88' : '#555e6e', hat: e.officer ? '#8b8b96' : '#2f343c', officer: e.officer,
      moving: stepMoving(e), anim: e.anim, pants: '#33383f'
    });
    const px = e.x * TILE, py = e.y * TILE;
    if (e.state === 'alert') {
      ctx.fillStyle = '#ff3b2f'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText('!', px, py - 44); ctx.fillText('!', px, py - 44);
    } else if (e.susp > 0.25 || e.state === 'investigate') {
      ctx.fillStyle = '#ffd34a'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText('?', px, py - 44); ctx.fillText('?', px, py - 44);
      if (e.susp > 0.25) { ctx.fillStyle = '#000a'; ctx.fillRect(px - 12, py - 40, 24, 4); ctx.fillStyle = '#ffd34a'; ctx.fillRect(px - 11, py - 39, 22 * Math.min(1, e.susp), 2); }
    }
  },

  cone(ctx, e) {
    const alert = e.state === 'alert';
    const range = alert ? 9 : 7.5, half = alert ? 1.1 : 0.62, N = 30;
    ctx.beginPath(); ctx.moveTo(e.x * TILE, e.y * TILE);
    for (let i = 0; i <= N; i++) {
      const a = e.face - half + (2 * half * i) / N;
      const d = Level.rayLength(e.x, e.y, a, range);
      ctx.lineTo((e.x + Math.cos(a) * d) * TILE, (e.y + Math.sin(a) * d) * TILE);
    }
    ctx.closePath();
    ctx.fillStyle = alert ? 'rgba(255,60,50,.22)' : e.state === 'investigate' || e.susp > 0.25 ? 'rgba(255,170,40,.2)' : 'rgba(255,235,90,.16)';
    ctx.fill();
    ctx.strokeStyle = alert ? 'rgba(255,60,50,.5)' : 'rgba(255,235,90,.35)'; ctx.lineWidth = 1; ctx.stroke();
  },

  draw(G) {
    const ctx = G.ctx, cv = G.canvas, cam = G.cam;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0c0f0a'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(cam.z, 0, 0, cam.z, -cam.x * cam.z, -cam.y * cam.z);
    ctx.drawImage(this.ground, 0, 0);

    // cuerpos y conos
    for (const e of G.enemies) if ((e.state === 'dead' || e.state === 'down') && !e.hidden && !e.carried) this.bodyOnGround(ctx, e);
    for (const e of G.enemies) if (e.state !== 'dead' && e.state !== 'down' && !e.hidden && !e.carried) this.cone(ctx, e);

    // marcadores de destino
    for (const u of G.units) {
      if (!u.alive || !u.selected || !u.path.length) continue;
      const p = u.path[u.path.length - 1];
      ctx.strokeStyle = 'rgba(230,230,100,.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x * TILE, p.y * TILE, 9, 4.5, 0, 0, 7); ctx.stroke();
    }
    // rango de acciones
    const pu = G.primary();
    if (pu && pu.action === 'shoot') this.rangeCircle(ctx, pu, 13);
    if (pu && (pu.action === 'grenade' || pu.action === 'lure')) this.rangeCircle(ctx, pu, 9);

    // fila a fila (orden de profundidad)
    const vw = cv.width / cam.z, vh = cv.height / cam.z;
    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(Level.W - 1, Math.ceil((cam.x + vw) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(Level.H - 1, Math.ceil((cam.y + vh) / TILE) + 2);
    const ents = [];
    for (const e of G.enemies) if (e.state !== 'dead' && e.state !== 'down' && !e.hidden && !e.carried) ents.push({ y: e.y, f: () => this.drawEnemy(ctx, e) });
    for (const u of G.units) if (u.alive) ents.push({ y: u.y, f: () => this.drawCommando(ctx, u, 1) });
    ents.sort((a, b) => a.y - b.y);
    let k = 0;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) this.drawBlock(ctx, tx, ty);
      while (k < ents.length && Math.floor(ents[k].y) <= ty) ents[k++].f();
    }
    while (k < ents.length) ents[k++].f();

    // silueta de comandos tapados por paredes
    for (const u of G.units) {
      if (!u.alive) continue;
      if (Level.tall(Math.floor(u.x), Math.floor(u.y) + 1)) this.drawCommando(ctx, u, 0.35);
    }

    // bomba
    if (G.bomb) {
      const px = G.bomb.x * TILE, py = G.bomb.y * TILE - WALL_H;
      ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(px - 26, py - 30, 52, 22);
      ctx.fillStyle = '#ff9a4d'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
      ctx.fillText('00:' + String(Math.ceil(G.bomb.t)).padStart(2, '0'), px, py - 14);
    }
    // efectos
    for (const f of G.fx) {
      const p = f.t / f.dur;
      if (f.k === 'tracer') { ctx.strokeStyle = f.enemy ? `rgba(255,120,80,${p})` : `rgba(255,255,200,${p})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(f.x0 * TILE, f.y0 * TILE - 17); ctx.lineTo(f.x1 * TILE, f.y1 * TILE - 17); ctx.stroke(); }
      else if (f.k === 'ring') { ctx.strokeStyle = `rgba(255,255,255,${p})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(f.x * TILE, f.y * TILE, f.r * TILE * (1 - p), f.r * TILE * (1 - p) * 0.5, 0, 0, 7); ctx.stroke(); }
      else if (f.k === 'boom') {
        const r = f.r * TILE * (1 - p * p * 0.3);
        const gr = ctx.createRadialGradient(f.x * TILE, f.y * TILE - 10, 4, f.x * TILE, f.y * TILE - 10, r);
        gr.addColorStop(0, `rgba(255,240,160,${p})`); gr.addColorStop(0.5, `rgba(255,120,30,${p * 0.8})`); gr.addColorStop(1, 'rgba(80,20,0,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(f.x * TILE, f.y * TILE - 10, r, 0, 7); ctx.fill();
      }
    }
    // cursor de acción
    if (pu && pu.action && G.mouse.inside) {
      ctx.strokeStyle = '#ff9a4d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(G.mouse.wx * TILE, G.mouse.wy * TILE, 12, 0, 7); ctx.moveTo(G.mouse.wx * TILE - 18, G.mouse.wy * TILE); ctx.lineTo(G.mouse.wx * TILE + 18, G.mouse.wy * TILE); ctx.moveTo(G.mouse.wx * TILE, G.mouse.wy * TILE - 18); ctx.lineTo(G.mouse.wx * TILE, G.mouse.wy * TILE + 18); ctx.stroke();
    }
    // selección por arrastre
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (G.drag && G.drag.active) {
      const d = G.drag;
      ctx.strokeStyle = '#e6e66a'; ctx.lineWidth = 1; ctx.fillStyle = 'rgba(230,230,100,.1)';
      ctx.fillRect(d.sx, d.sy, d.cx - d.sx, d.cy - d.sy); ctx.strokeRect(d.sx, d.sy, d.cx - d.sx, d.cy - d.sy);
    }
    if (G.paused && !G.overlayOpen) {
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PAUSA', cv.width / 2, cv.height / 2 - 40);
      ctx.font = '15px sans-serif'; ctx.fillText('Puedes dar órdenes con el juego en pausa. Espacio para continuar.', cv.width / 2, cv.height / 2 - 10);
    }
  },

  rangeCircle(ctx, u, r) {
    ctx.strokeStyle = 'rgba(255,154,77,.5)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(u.x * TILE, u.y * TILE, r * TILE, r * TILE, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  },

  drawMinimap(G) {
    const m = G.mini, x = m.getContext('2d'), sx = m.width / Level.W, sy = m.height / Level.H;
    x.drawImage(this.ground, 0, 0, m.width, m.height);
    x.fillStyle = 'rgba(0,0,0,.4)';
    for (let ty = 0; ty < Level.H; ty++) for (let tx = 0; tx < Level.W; tx++) if (Level.tall(tx, ty)) { x.fillStyle = Level.at(tx, ty) === 'B' ? '#c44' : '#222'; x.fillRect(tx * sx, ty * sy, sx + 0.5, sy + 0.5); }
    for (const u of G.units) if (u.alive) { x.fillStyle = u.selected ? '#ffe45a' : '#7dff6a'; x.fillRect(u.x * sx - 2, u.y * sy - 2, 4, 4); }
    const cam = G.cam;
    x.strokeStyle = '#fff'; x.lineWidth = 1;
    x.strokeRect(cam.x / TILE * sx, cam.y / TILE * sy, G.canvas.width / cam.z / TILE * sx, G.canvas.height / cam.z / TILE * sy);
  }
};

function stepMoving(e) { return e.state !== 'dead' && e.path && e.path.length > 0 && !e.holding; }
