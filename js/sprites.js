'use strict';
// Sprites procedurales: personajes, edificios, vehículos, vegetación, iconos y retratos.

const PAL = {
  soldier: { tunic: '#5f6650', pants: '#4b5040', boots: '#1d1b18', belt: '#2a2620', skin: '#d9ab84', hat: 'helmet', hatCol: '#4d5345', weapon: 'rifle', pouches: true },
  officer: { tunic: '#6c7259', pants: '#3b3d36', boots: '#141312', belt: '#2a2018', skin: '#d9ab84', hat: 'cap', hatCol: '#5e6551', weapon: 'pistol' },
  beret: { tunic: '#4f6a32', pants: '#43552b', boots: '#2a2118', belt: '#3b3220', skin: '#d2a17a', hat: 'beret', hatCol: '#2e6a2a', weapon: null, pouches: true },
  sniper: { tunic: '#7d7148', pants: '#6a603e', boots: '#2e2418', belt: '#4a3c24', skin: '#e0b38c', hat: 'fieldcap', hatCol: '#5e5535', weapon: 'sniper' },
  spy: { tunic: '#2e3340', pants: '#292d37', boots: '#121212', belt: '#1a1a1a', skin: '#dcb08a', hat: 'fedora', hatCol: '#38383d', weapon: null, shirt: '#e8e4d8' },
  spyDis: { tunic: '#6c7259', pants: '#3b3d36', boots: '#141312', belt: '#2a2018', skin: '#dcb08a', hat: 'cap', hatCol: '#5e6551', weapon: 'pistol', armband: true },
  sapper: { tunic: '#6b6a44', pants: '#5a583a', boots: '#2a2118', belt: '#3e3824', skin: '#d8a982', hat: 'brodie', hatCol: '#5d5c3a', weapon: null, pack: '#4f4a30' }
};

const Sprites = {
  rr(x, X, Y, W, H, r) { x.beginPath(); if (x.roundRect) x.roundRect(X, Y, W, H, r); else x.rect(X, Y, W, H); },

  // ---------------- PERSONAJES ----------------
  person(ctx, px, py, s) {
    const P = PAL[s.kind] || PAL.soldier;
    const k = TILE / 48;
    const fx = Math.cos(s.face), fy = Math.sin(s.face);
    const back = fy < -0.4, prof = Math.abs(fx) > 0.6, dir = fx >= 0 ? 1 : -1;
    const sw = s.moving ? Math.sin(s.anim * 3) : 0;
    const gh = s.ghost, C = c => gh || c;
    ctx.save();
    ctx.translate(px, py); ctx.scale(k, k);
    if (!gh && !s.noShadow) {
      const gr = ctx.createRadialGradient(2, 0, 1, 2, 0, 14);
      gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(2, 0, 15, 6, 0, 0, 7); ctx.fill();
    }
    const cr = s.crouch, hip = cr ? -13 : -20;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // piernas
    for (const side of [-1, 1]) {
      const hx = side * (prof ? 1.5 : 3.3);
      let fxp = hx, lift = 0;
      if (prof) fxp += dir * sw * side * 6; else lift = Math.max(0, sw * side) * 3;
      ctx.strokeStyle = C(prof && side === -dir ? shade(P.pants, -0.07) : P.pants); ctx.lineWidth = 5.5;
      ctx.beginPath(); ctx.moveTo(hx, hip);
      let bx, by;
      if (cr) {
        const kx = hx + (prof ? dir * 7 : side * 2.5), ky = hip + (prof ? 3 : 6);
        bx = prof ? hx + dir * (side === dir ? 3 : -2) : hx + side; by = -2;
        ctx.lineTo(kx, ky); ctx.lineTo(bx, by);
      } else { bx = fxp; by = -3 - lift; ctx.lineTo(bx, by); }
      ctx.stroke();
      ctx.fillStyle = C(P.boots); ctx.beginPath();
      ctx.ellipse(bx + (prof ? dir * 1.5 : 0), by + 0.5, prof ? 4 : 3, 2.4, 0, 0, 7); ctx.fill();
    }
    const top = hip - 16, tw = prof ? 11 : 15, shY = top + 3;
    if (P.weapon && !s.aim && !back) this.slung(ctx, P, dir, top, hip, C);
    if (P.pack && !back) { ctx.fillStyle = C(shade(P.pack, -0.05)); ctx.fillRect(prof ? -dir * 9 - 3 : -tw / 2 - 2, top + 2, prof ? 6 : tw + 4, 12); }
    // torso
    if (gh) ctx.fillStyle = gh;
    else {
      const gr = ctx.createLinearGradient(-tw / 2, top, tw / 2, hip);
      gr.addColorStop(0, shade(P.tunic, 0.08)); gr.addColorStop(1, shade(P.tunic, -0.1)); ctx.fillStyle = gr;
    }
    this.rr(ctx, -tw / 2, top, tw, hip - top + 3, 4); ctx.fill();
    if (!gh) {
      ctx.fillStyle = P.belt; ctx.fillRect(-tw / 2, hip - 3, tw, 2.6);
      ctx.fillStyle = '#9a8a5a'; ctx.fillRect(-1, hip - 3, 2, 2.6);
      if (!back) {
        if (P.shirt) {
          ctx.fillStyle = P.shirt; ctx.beginPath(); ctx.moveTo(-3.5, top); ctx.lineTo(3.5, top); ctx.lineTo(0, top + 8); ctx.fill();
          ctx.fillStyle = '#8a2020'; ctx.fillRect(-0.9, top + 1, 1.8, 7);
        } else {
          ctx.fillStyle = shade(P.tunic, -0.16); ctx.fillRect(-0.6, top + 2, 1.2, hip - top - 5);
          ctx.fillStyle = shade(P.tunic, -0.12); ctx.fillRect(-tw / 2 + 2, top + 4, 4, 3); ctx.fillRect(tw / 2 - 6, top + 4, 4, 3);
          if (P.pouches) { ctx.fillStyle = P.belt; ctx.fillRect(-tw / 2 + 1.5, hip - 6, 3.5, 3.5); ctx.fillRect(tw / 2 - 5, hip - 6, 3.5, 3.5); }
        }
      }
      if (P.armband) { ctx.fillStyle = '#3a8a3a'; ctx.fillRect(prof ? -2 : -tw / 2 - 1, top + 6, 3, 3); }
      if (P.pack && back) {
        ctx.fillStyle = P.pack; this.rr(ctx, -6.5, top + 1, 13, 13, 2); ctx.fill();
        ctx.fillStyle = shade(P.pack, -0.12); ctx.fillRect(-6.5, top + 6, 13, 1.5);
        ctx.fillStyle = '#7a1d14'; ctx.fillRect(-5, top + 9, 2, 4); ctx.fillRect(-2.5, top + 9, 2, 4);
      }
    }
    // brazos
    for (const side of [-1, 1]) {
      const sx = side * (tw / 2 - 0.5);
      let hx, hy;
      if (s.aim) { hx = prof ? dir * (side === dir ? 11 : 7) : side * 3 + dir * 2; hy = shY + 7; }
      else { hx = sx + side * 1.2 + (prof ? -dir * sw * side * 5 : 0); hy = shY + 11 - (prof ? 0 : Math.abs(sw) * 0.8); }
      if (s.busy === 'plant') { hx = prof ? dir * 8 : side * 4; hy = hip + 4; }
      ctx.strokeStyle = C(shade(P.tunic, prof && side !== dir ? -0.07 : 0)); ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(sx, shY); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = C(P.skin); ctx.beginPath(); ctx.arc(hx, hy, 2, 0, 7); ctx.fill();
    }
    if (P.weapon && s.aim) this.aimed(ctx, P, fx, fy, prof, shY, C);
    if (P.weapon && !s.aim && back) this.slung(ctx, P, dir, top, hip, C);
    // cabeza
    const hy0 = top - 6.5;
    ctx.fillStyle = C(shade(P.skin, -0.1)); ctx.fillRect(-2, top - 3, 4, 4);
    if (gh) ctx.fillStyle = gh;
    else {
      const hg = ctx.createRadialGradient(-2, hy0 - 2, 1, 0, hy0, 7);
      hg.addColorStop(0, shade(P.skin, 0.06)); hg.addColorStop(1, shade(P.skin, -0.12)); ctx.fillStyle = hg;
    }
    ctx.beginPath(); ctx.arc(prof ? dir * 0.8 : 0, hy0, 5.8, 0, 7); ctx.fill();
    if (!gh && !back) {
      ctx.fillStyle = '#1c140e';
      if (prof) { ctx.beginPath(); ctx.arc(dir * 3.6, hy0 - 0.3, 0.9, 0, 7); ctx.fill(); ctx.fillStyle = shade(P.skin, -0.15); ctx.fillRect(dir > 0 ? 5.5 : -6.5, hy0, 1.2, 1.6); }
      else { for (const e of [-2.2, 2.2]) { ctx.beginPath(); ctx.arc(e + fx * 1.4, hy0 - 0.3, 0.85, 0, 7); ctx.fill(); } }
    }
    this.hat(ctx, P, hy0, dir, prof, back, C, !!gh);
    ctx.restore();
  },

  slung(ctx, P, dir, top, hip, C) {
    const L = P.weapon === 'sniper' ? 1.25 : P.weapon === 'pistol' ? 0 : 1;
    if (!L) return;
    ctx.strokeStyle = C('#4a3220'); ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(-dir * 6, top - 7 * L); ctx.lineTo(dir * 5, hip + 1); ctx.stroke();
    ctx.strokeStyle = C('#1d1d1d'); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-dir * 6, top - 7 * L); ctx.lineTo(-dir * 2, top + 1); ctx.stroke();
  },

  aimed(ctx, P, fx, fy, prof, shY, C) {
    const L = P.weapon === 'sniper' ? 30 : P.weapon === 'pistol' ? 8 : 24;
    const sx = fx * 2, sy = shY + 6, ex = sx + fx * L * (prof ? 1 : 0.65), ey = sy + fy * L * 0.38;
    ctx.strokeStyle = C('#4a3220'); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(sx - fx * 6, sy - fy * 2); ctx.lineTo(sx + (ex - sx) * 0.55, sy + (ey - sy) * 0.55); ctx.stroke();
    ctx.strokeStyle = C('#1a1a1a'); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    if (P.weapon === 'sniper') { ctx.fillStyle = C('#111'); ctx.fillRect(sx + (ex - sx) * 0.25 - 3, sy + (ey - sy) * 0.25 - 3, 7, 2.2); }
  },

  hat(ctx, P, hy, dir, prof, back, C, gh) {
    const col = P.hatCol;
    ctx.fillStyle = C(col);
    switch (P.hat) {
      case 'helmet': // casco alemán
        ctx.beginPath();
        ctx.moveTo(-8.8, hy + 2.6); ctx.quadraticCurveTo(-8, hy - 1, -6.6, hy - 2.5);
        ctx.arc(0, hy - 2.5, 6.6, Math.PI, 0);
        ctx.quadraticCurveTo(8, hy - 1, 8.8, hy + 2.6); ctx.lineTo(6, hy + 0.8); ctx.lineTo(-6, hy + 0.8); ctx.closePath(); ctx.fill();
        if (!gh) { ctx.fillStyle = shade(col, 0.13); ctx.beginPath(); ctx.ellipse(-2.2, hy - 6.2, 3, 1.5, -0.3, 0, 7); ctx.fill(); ctx.fillStyle = shade(col, -0.12); ctx.fillRect(-7, hy + 0.2, 14, 1); }
        break;
      case 'cap': // gorra de plato
        ctx.beginPath(); ctx.ellipse(0, hy - 6.8, 8, 3.3, 0, 0, 7); ctx.fill();
        ctx.fillStyle = C('#26261f'); ctx.fillRect(-5.8, hy - 6.2, 11.6, 3);
        if (!back) { ctx.fillStyle = C('#121212'); ctx.beginPath(); ctx.ellipse(prof ? dir * 5 : 0, hy - 3, prof ? 4.5 : 6.4, 1.6, 0, 0, 7); ctx.fill(); }
        if (!gh && !back) { ctx.fillStyle = '#d6d6c8'; ctx.beginPath(); ctx.arc(prof ? dir * 3 : 0, hy - 7.6, 1, 0, 7); ctx.fill(); }
        break;
      case 'beret':
        ctx.beginPath(); ctx.ellipse(-dir * 1.3, hy - 4.6, 7.4, 3.6, -0.22 * dir, 0, 7); ctx.fill();
        if (!gh) { ctx.fillStyle = '#d8b440'; ctx.beginPath(); ctx.arc(dir * 2.8, hy - 4.6, 1.2, 0, 7); ctx.fill(); }
        break;
      case 'fieldcap':
        ctx.beginPath(); ctx.arc(0, hy - 3, 6.2, Math.PI, 0); ctx.fill();
        if (!back) { ctx.fillStyle = C(shade(col, -0.1)); ctx.beginPath(); ctx.ellipse(prof ? dir * 5 : 0, hy - 2.6, prof ? 4 : 5.5, 1.5, 0, 0, 7); ctx.fill(); }
        break;
      case 'fedora':
        ctx.beginPath(); ctx.ellipse(0, hy - 3.6, 9.6, 2.8, 0, 0, 7); ctx.fill();
        this.rr(ctx, -5.2, hy - 10.5, 10.4, 7.5, 3); ctx.fill();
        if (!gh) { ctx.fillStyle = '#151515'; ctx.fillRect(-5.2, hy - 5.6, 10.4, 1.6); }
        break;
      case 'brodie': // casco británico
        ctx.beginPath(); ctx.ellipse(0, hy - 4.2, 10.5, 3.4, 0, 0, 7); ctx.fill();
        ctx.fillStyle = C(shade(col, 0.05)); ctx.beginPath(); ctx.ellipse(0, hy - 5.5, 6.3, 4.5, 0, Math.PI, 0); ctx.fill();
        if (!gh) { ctx.fillStyle = shade(col, 0.18); ctx.beginPath(); ctx.ellipse(-2, hy - 7.5, 2.4, 1.2, 0, 0, 7); ctx.fill(); }
        break;
    }
  },

  corpse(ctx, px, py, kind, dir, sleeping) {
    const k = TILE / 48;
    ctx.save();
    const gr = ctx.createRadialGradient(px, py, 2, px, py, 26 * k);
    gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(px, py, 28 * k, 9 * k, 0, 0, 7); ctx.fill();
    ctx.translate(px - dir * 22 * k, py - 2 * k);
    ctx.scale(1, 0.8);
    ctx.rotate(dir * Math.PI / 2);
    this.person(ctx, 0, 0, { kind, face: Math.PI / 2 + (sleeping ? 0 : 0.3), noShadow: true });
    ctx.restore();
  },

  // ---------------- ÁRBOLES Y ARBUSTOS ----------------
  oak(seed) {
    const T = TILE, c = makeCanvas(3.6 * T, 4.6 * T), x = c.getContext('2d'), r = mulberry32(seed * 97 + 3);
    const ax = 1.8 * T, ay = 4.3 * T;
    x.translate(ax, ay);
    // tronco
    const tg = x.createLinearGradient(-0.15 * T, 0, 0.15 * T, 0);
    tg.addColorStop(0, '#7a5a38'); tg.addColorStop(1, '#3d2a18');
    x.fillStyle = tg; x.beginPath();
    x.moveTo(-0.2 * T, 0); x.quadraticCurveTo(-0.1 * T, -0.6 * T, -0.11 * T, -1.7 * T);
    x.lineTo(0.11 * T, -1.7 * T); x.quadraticCurveTo(0.1 * T, -0.6 * T, 0.22 * T, 0); x.closePath(); x.fill();
    const cx = 0, cy = -2.35 * T, rx = 1.4 * T * (0.9 + r() * 0.2), ry = 1.2 * T * (0.9 + r() * 0.2);
    const dark = [34, 58, 24], light = [128, 156, 62];
    x.fillStyle = 'rgb(30,50,22)'; x.beginPath(); x.ellipse(cx, cy, rx * 0.95, ry * 0.95, 0, 0, 7); x.fill();
    const blobs = [];
    for (let i = 0; i < 70; i++) {
      const a = r() * 6.283, d = Math.sqrt(r());
      const bx = Math.cos(a) * d * rx * 0.85, by = Math.sin(a) * d * ry * 0.85;
      const tone = clamp(0.55 - (bx / rx) * 0.3 - (by / ry) * 0.45 + (r() - 0.5) * 0.3, 0, 1);
      blobs.push({ bx, by, rad: (0.18 + r() * 0.24) * T, tone });
    }
    blobs.sort((a, b) => a.tone - b.tone);
    for (const b of blobs) {
      const c1 = mixRgb(dark, light, b.tone);
      x.fillStyle = `rgb(${c1[0] | 0},${c1[1] | 0},${c1[2] | 0})`;
      x.beginPath(); x.arc(cx + b.bx, cy + b.by, b.rad, 0, 7); x.fill();
    }
    for (let i = 0; i < 90; i++) {
      const a = r() * 6.283, d = Math.sqrt(r());
      const bx = Math.cos(a) * d * rx * 0.9, by = Math.sin(a) * d * ry * 0.9;
      const lit = by < 0 && bx < rx * 0.3;
      x.fillStyle = lit ? 'rgba(190,210,110,.35)' : 'rgba(10,25,8,.25)';
      x.fillRect(cx + bx, cy + by, 2, 2);
    }
    return { c, ax, ay };
  },

  pine(seed) {
    const T = TILE, c = makeCanvas(2.8 * T, 4.8 * T), x = c.getContext('2d'), r = mulberry32(seed * 31 + 7);
    const ax = 1.4 * T, ay = 4.5 * T;
    x.translate(ax, ay);
    x.fillStyle = '#4a3220'; x.fillRect(-0.09 * T, -0.9 * T, 0.18 * T, 0.9 * T);
    const tiers = 6;
    for (let i = 0; i < tiers; i++) {
      const t = i / (tiers - 1);
      const base = -0.55 * T - t * 2.9 * T, w = (1.2 - t * 0.85) * T, h = 1.05 * T;
      const col = mixRgb([28, 52, 34], [44, 76, 44], t * 0.6);
      x.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
      x.beginPath(); x.moveTo(0, base - h);
      const n = 7;
      for (let j = 0; j <= n; j++) { const px = w - (2 * w * j) / n; x.lineTo(px, base + (j % 2 ? -0.08 * T : 0.05 * T * r())); }
      x.closePath(); x.fill();
      x.fillStyle = 'rgba(120,160,90,.28)';
      x.beginPath(); x.moveTo(0, base - h); x.lineTo(-w, base); x.lineTo(-w * 0.2, base - 0.1 * T); x.closePath(); x.fill();
    }
    return { c, ax, ay };
  },

  bush(seed) {
    const T = TILE, c = makeCanvas(1.7 * T, 1.4 * T), x = c.getContext('2d'), r = mulberry32(seed * 13 + 1);
    const ax = 0.85 * T, ay = 1.2 * T;
    x.translate(ax, ay);
    const g = x.createRadialGradient(0.05 * T, 0, 2, 0.05 * T, 0, 0.75 * T);
    g.addColorStop(0, 'rgba(0,0,0,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.beginPath(); x.ellipse(0.08 * T, -0.02 * T, 0.75 * T, 0.28 * T, 0, 0, 7); x.fill();
    const blobs = [];
    for (let i = 0; i < 22; i++) {
      const a = Math.PI + r() * Math.PI, d = Math.sqrt(r());
      const bx = Math.cos(a) * d * 0.55 * T, by = Math.sin(a) * d * 0.55 * T - 0.12 * T;
      blobs.push({ bx, by, rad: (0.12 + r() * 0.13) * T, tone: clamp(0.5 - bx / T * 0.5 - by / T * 0.8 + (r() - 0.5) * 0.3, 0, 1) });
    }
    blobs.sort((a, b) => a.tone - b.tone);
    for (const b of blobs) {
      const c1 = mixRgb([36, 62, 26], [118, 148, 58], b.tone);
      x.fillStyle = `rgb(${c1[0] | 0},${c1[1] | 0},${c1[2] | 0})`;
      x.beginPath(); x.arc(b.bx, b.by, b.rad, 0, 7); x.fill();
    }
    return { c, ax, ay };
  },

  // ---------------- EDIFICIOS ----------------
  building(b) {
    const T = TILE, Hh = b.H * T, R = b.R * T, ov = 0.16 * T;
    const x0 = b.x * T, x1 = (b.x + b.w) * T, y0 = b.y * T, y1 = (b.y + b.h) * T, ym = (y0 + y1) / 2;
    const left = x0 - ov - 3, top = y0 - Hh - R - 0.9 * T;
    const c = makeCanvas(x1 - x0 + 2 * ov + 6, y1 - top + 4), x = c.getContext('2d');
    x.translate(-left, -top);
    this.facade(x, b, x0, x1, y1 - Hh, y1);
    const yr = ym - Hh - R, yn = y0 - Hh, ys = y1 - Hh + ov * 0.5;
    const xa = x0 - ov, xb = x1 + ov;
    if (b.roof === 'metal') {
      this.roofSlope(x, b, [[xa, yn], [xb, yn], [xb, yr], [xa, yr]], xa, xb, yn, yr, 0.08);
      this.roofSlope(x, b, [[xa, yr], [xb, yr], [xb, ys], [xa, ys]], xa, xb, yr, ys, -0.04);
    } else {
      // tejado a cuatro aguas: faldones norte, sur, oeste (iluminado) y este (en sombra)
      const d = Math.min((xb - xa) * 0.4, (ys - yn) * 0.45);
      this.roofSlope(x, b, [[xa, yn], [xb, yn], [xb - d, yr], [xa + d, yr]], xa, xb, yn, yr, 0.1);
      this.roofSlope(x, b, [[xa + d, yr], [xb - d, yr], [xb, ys], [xa, ys]], xa, xb, yr, ys, -0.03);
      this.roofSlope(x, b, [[xa, yn], [xa + d, yr], [xa, ys]], xa, xa + d, yn, ys, 0.13);
      this.roofSlope(x, b, [[xb, yn], [xb - d, yr], [xb, ys]], xb - d, xb, yn, ys, -0.16);
      const rb0 = this.roofBase(b);
      x.strokeStyle = shade(rb0, -0.3); x.lineWidth = 2.5;
      x.beginPath(); x.moveTo(xa, yn); x.lineTo(xa + d, yr); x.lineTo(xa, ys); x.moveTo(xb, yn); x.lineTo(xb - d, yr); x.lineTo(xb, ys); x.stroke();
      x.fillStyle = shade(rb0, -0.25); x.fillRect(xa + d, yr - 2, xb - xa - 2 * d, 4);
    }
    const eg = x.createLinearGradient(0, ys, 0, ys + 0.3 * T);
    eg.addColorStop(0, 'rgba(0,0,0,.4)'); eg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = eg; x.fillRect(x0, ys, x1 - x0, 0.3 * T);
    const rb = this.roofBase(b);
    if (b.roof === 'metal') {
      x.fillStyle = shade(rb, -0.22); x.fillRect(x0 - ov, yr - 2, x1 - x0 + 2 * ov, 4);
      x.fillStyle = shade(rb, -0.3); x.fillRect(x0 - ov, yn, 2, ys - yn); x.fillRect(x1 + ov - 2, yn, 2, ys - yn);
    }
    if (b.chimney) {
      const cx = x0 + (x1 - x0) * 0.72, cyb = yr + (ys - yr) * 0.25;
      x.fillStyle = '#8a5a44'; x.fillRect(cx, cyb - 0.7 * T, 0.38 * T, 0.7 * T);
      x.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 4; i++) x.fillRect(cx, cyb - 0.7 * T + i * 0.18 * T, 0.38 * T, 1);
      x.fillStyle = '#a07060'; x.fillRect(cx - 2, cyb - 0.85 * T, 0.38 * T + 4, 0.17 * T);
      x.fillStyle = '#2a2420'; x.fillRect(cx + 3, cyb - 0.82 * T, 0.38 * T - 6, 0.1 * T);
    }
    return { c, ox: left, oy: top };
  },

  roofBase(b) { return { terracotta: '#a9532f', slate: '#4f5763', metal: '#6c7170' }[b.roof] || '#555'; },

  roofSlope(x, b, poly, xa, xb, ya, yb, lt) {
    const base = this.roofBase(b);
    const r = mulberry32(b.x * 31 + b.y * 7 + ((lt * 100) | 0));
    const south = lt < 0.05 && lt > -0.1;
    x.save();
    x.beginPath(); poly.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.closePath();
    x.clip();
    const g = x.createLinearGradient(0, ya, 0, yb);
    g.addColorStop(0, shade(base, lt + 0.05)); g.addColorStop(1, shade(base, lt - 0.09));
    x.fillStyle = g; x.fillRect(xa - 2, ya - 2, xb - xa + 4, yb - ya + 4);
    if (b.roof === 'terracotta') {
      const rh = south ? 7 : 5;
      let row = 0;
      for (let y = ya; y < yb; y += rh, row++) {
        const off = (row % 2) * 5;
        for (let xx = xa - 10 + off; xx < xb; xx += 10) {
          x.fillStyle = shade(base, lt + (r() - 0.5) * 0.14 - 0.02);
          x.beginPath(); x.ellipse(xx + 5, y + rh * 0.4, 5, rh * 0.75, 0, 0, Math.PI); x.fill();
        }
        x.fillStyle = 'rgba(40,10,0,.22)'; x.fillRect(xa, y + rh - 1, xb - xa, 1);
      }
    } else if (b.roof === 'slate') {
      const rh = south ? 6 : 4.5;
      let row = 0;
      for (let y = ya; y < yb; y += rh, row++) {
        const off = (row % 2) * 5;
        for (let xx = xa - 10 + off; xx < xb; xx += 10) { x.fillStyle = shade(base, lt + (r() - 0.5) * 0.1); x.fillRect(xx + 0.5, y, 9, rh - 1); }
      }
    } else {
      for (let xx = xa; xx < xb; xx += 7) {
        x.fillStyle = 'rgba(255,255,255,.09)'; x.fillRect(xx, ya, 3, yb - ya);
        x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(xx + 5, ya, 1, yb - ya);
      }
      for (let i = 0; i < 6; i++) {
        const sx = xa + r() * (xb - xa), sl = (yb - ya) * (0.3 + r() * 0.6);
        const rg = x.createLinearGradient(0, ya, 0, ya + sl);
        rg.addColorStop(0, 'rgba(120,60,20,0)'); rg.addColorStop(1, 'rgba(120,60,20,.28)');
        x.fillStyle = rg; x.fillRect(sx, ya, 4 + r() * 8, sl);
      }
      x.fillStyle = 'rgba(0,0,0,.15)';
      for (let y = ya + 1.3 * TILE; y < yb; y += 1.3 * TILE) x.fillRect(xa, y, xb - xa, 1.5);
    }
    x.restore();
    x.strokeStyle = shade(base, -0.32); x.lineWidth = 1;
    x.beginPath(); poly.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.closePath(); x.stroke();
  },

  facade(x, b, x0, x1, yt, yb) {
    const T = TILE, H = yb - yt, r = mulberry32(b.x * 13 + b.y);
    const base = { plaster: '#d6c9ab', timber: '#ddd0b0', wood: '#7a5a38', brick: '#9b5036', concrete: '#9b988e' }[b.facade];
    const g = x.createLinearGradient(0, yt, 0, yb);
    g.addColorStop(0, shade(base, -0.04)); g.addColorStop(1, shade(base, -0.16));
    x.fillStyle = g; x.fillRect(x0, yt, x1 - x0, H);
    if (b.facade === 'wood') {
      for (let xx = x0; xx < x1; xx += 7) {
        x.fillStyle = shade(base, (r() - 0.5) * 0.1); x.fillRect(xx, yt, 6, H);
        x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(xx + 6, yt, 1, H);
      }
    } else if (b.facade === 'brick') {
      let row = 0;
      for (let y = yt; y < yb; y += 6, row++) {
        for (let xx = x0 - (row % 2) * 7; xx < x1; xx += 14) {
          x.fillStyle = shade(base, (r() - 0.5) * 0.12); x.fillRect(Math.max(x0, xx), y, 13, 5);
        }
      }
    } else if (b.facade === 'concrete') {
      x.fillStyle = 'rgba(0,0,0,.2)';
      for (let xx = x0 + 1.5 * T; xx < x1; xx += 1.5 * T) x.fillRect(xx, yt, 1.5, H);
      x.fillRect(x0, yt + H * 0.5, x1 - x0, 1.5);
      for (let i = 0; i < 10; i++) {
        const sx = x0 + r() * (x1 - x0), sl = H * (0.3 + r() * 0.5);
        const sg = x.createLinearGradient(0, yt, 0, yt + sl); sg.addColorStop(0, 'rgba(40,40,30,.18)'); sg.addColorStop(1, 'rgba(40,40,30,0)');
        x.fillStyle = sg; x.fillRect(sx, yt, 3 + r() * 6, sl);
      }
    } else {
      for (let i = 0; i < (x1 - x0) * H / 40; i++) { x.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.06)'; x.fillRect(x0 + r() * (x1 - x0), yt + r() * H, 2, 2); }
      if (b.facade === 'timber') {
        x.fillStyle = '#5a3d24';
        x.fillRect(x0, yt, x1 - x0, 4); x.fillRect(x0, yb - 0.24 * T - 4, x1 - x0, 4);
        for (let xx = x0; xx <= x1 - 4; xx += 1.2 * T) {
          x.fillRect(xx, yt, 4, H - 0.24 * T);
          if (((xx - x0) / (1.2 * T)) % 2 < 1 && xx + 1.2 * T <= x1) {
            x.strokeStyle = '#5a3d24'; x.lineWidth = 3.5; x.beginPath(); x.moveTo(xx + 2, yb - 0.24 * T - 2); x.lineTo(xx + 1.2 * T, yt + 4); x.stroke();
          }
        }
        x.fillRect(x1 - 4, yt, 4, H - 0.24 * T);
      }
    }
    // zócalo de piedra
    const ph = 0.24 * T;
    x.fillStyle = '#7b756a'; x.fillRect(x0, yb - ph, x1 - x0, ph);
    for (let xx = x0; xx < x1; xx += 11) { x.fillStyle = shade('#7b756a', (r() - 0.5) * 0.12); x.fillRect(xx, yb - ph + 1, 10, ph / 2 - 1); x.fillRect(xx + 5, yb - ph / 2 + 1, 10, ph / 2 - 2); }
    // ventanas
    const doorCx = (b.door.x + 0.5) * T;
    const ww = 0.46 * T, wh = Math.min(0.56 * T, H * 0.4), wy = yt + H * (H > 1.4 * T ? 0.22 : 0.28);
    const n = Math.max(1, Math.floor((x1 - x0) / (1.25 * T)));
    for (let i = 0; i < n; i++) {
      const cx = x0 + (i + 0.5) * (x1 - x0) / n;
      if (Math.abs(cx - doorCx) < 0.8 * T) continue;
      this.windowAt(x, b, cx, wy, ww, wh);
    }
    // puerta
    const wide = b.facade === 'concrete';
    const dw = (wide ? 1.1 : 0.62) * T, dh = Math.min(0.95 * T, H - 0.18 * T);
    const dx = doorCx - dw / 2, dy = yb - dh;
    x.fillStyle = '#3b2a1a'; x.fillRect(dx - 3, dy - 3, dw + 6, dh + 3);
    x.fillStyle = wide ? '#5f6560' : '#6a4426'; x.fillRect(dx, dy, dw, dh);
    x.fillStyle = 'rgba(0,0,0,.25)';
    for (let xx = dx + 5; xx < dx + dw; xx += wide ? 9 : 6) x.fillRect(xx, dy, 1, dh);
    if (wide) { x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(dx, dy); x.lineTo(dx + dw, dy + dh); x.stroke(); }
    else { x.fillStyle = '#c9a54a'; x.beginPath(); x.arc(dx + dw - 5, dy + dh * 0.55, 1.6, 0, 7); x.fill(); }
    // sombreado lateral
    const sg = x.createLinearGradient(x0, 0, x1, 0);
    sg.addColorStop(0, 'rgba(255,255,255,.06)'); sg.addColorStop(0.85, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,.2)');
    x.fillStyle = sg; x.fillRect(x0, yt, x1 - x0, H);
  },

  windowAt(x, b, cx, wy, ww, wh) {
    const fr = b.facade === 'wood' ? '#3e2a18' : '#ece5d2';
    x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(cx - ww / 2 - 2, wy - 1, ww + 5, wh + 5);
    x.fillStyle = fr; x.fillRect(cx - ww / 2 - 2, wy - 2, ww + 4, wh + 4);
    const g = x.createLinearGradient(0, wy, 0, wy + wh);
    g.addColorStop(0, '#5f7a8c'); g.addColorStop(1, '#22303a');
    x.fillStyle = g; x.fillRect(cx - ww / 2, wy, ww, wh);
    x.fillStyle = 'rgba(255,255,255,.22)';
    x.beginPath(); x.moveTo(cx - ww / 2, wy + wh * 0.6); x.lineTo(cx - ww / 2 + ww * 0.5, wy); x.lineTo(cx - ww / 2 + ww * 0.7, wy); x.lineTo(cx - ww / 2, wy + wh); x.fill();
    x.fillStyle = fr; x.fillRect(cx - 1, wy, 2, wh); x.fillRect(cx - ww / 2, wy + wh / 2 - 1, ww, 2);
    x.fillStyle = shade('#ddd2b8', -0.15); x.fillRect(cx - ww / 2 - 4, wy + wh + 2, ww + 8, 3);
    if (b.facade === 'plaster' || b.facade === 'timber') {
      for (const s of [-1, 1]) {
        const sx = s < 0 ? cx - ww / 2 - 2 - ww * 0.42 : cx + ww / 2 + 2;
        x.fillStyle = '#4b6a4a'; x.fillRect(sx, wy - 2, ww * 0.42, wh + 4);
        x.fillStyle = 'rgba(0,0,0,.25)'; for (let y = wy; y < wy + wh; y += 3) x.fillRect(sx, y, ww * 0.42, 1);
      }
    }
  },

  // Muro bajo para el interior abierto (corte)
  lowWall(ctx, b, tx, ty, h) {
    const T = TILE, px = tx * T, py = ty * T;
    const top = { plaster: '#cfc2a4', timber: '#cfc2a4', wood: '#6e5134', brick: '#8f4a33', concrete: '#a19e95' }[b.facade];
    if (!Level.isWall(tx, ty + 1) || ty === b.y + b.h - 1) {
      const g = ctx.createLinearGradient(0, py + T - h, 0, py + T);
      g.addColorStop(0, shade(top, -0.12)); g.addColorStop(1, shade(top, -0.28));
      ctx.fillStyle = g; ctx.fillRect(px, py + T - h, T, h);
    }
    ctx.fillStyle = top; ctx.fillRect(px, py - h, T, T);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(px, py - h, T, 2);
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(px + T - 1, py - h, 1, T);
  },

  // ---------------- OBJETOS ----------------
  prop(p) {
    const T = TILE, fn = this['prop_' + p.type];
    const pad = 4 * T;
    const c = makeCanvas(p.w * T + 2 * pad, p.h * T + 2 * pad), x = c.getContext('2d');
    x.translate(pad, pad);
    fn.call(this, x, p.w * T, p.h * T, mulberry32(p.seed || 5), p);
    return { c, ox: p.x * T - pad, oy: p.y * T - pad };
  },

  box(x, X, Y, W, D, H, top, front) {
    // caja con cara superior (desplazada H hacia arriba) y cara sur
    x.fillStyle = front; x.fillRect(X, Y + D - H, W, H);
    x.fillStyle = top; x.fillRect(X, Y - H, W, D);
  },

  prop_crate(x, w, h, r) {
    const T = TILE, i = 0.08 * T, H = 0.6 * T;
    this.box(x, i, i, w - 2 * i, h - 2 * i, H, '#b08a55', '#8a6a3e');
    x.strokeStyle = 'rgba(40,25,10,.6)'; x.lineWidth = 1;
    for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(i, i - H + k * (h - 2 * i) / 4); x.lineTo(w - i, i - H + k * (h - 2 * i) / 4); x.stroke(); }
    x.strokeRect(i + 0.5, i - H + 0.5, w - 2 * i - 1, h - 2 * i - 1);
    x.strokeRect(i + 0.5, h - i - H + 0.5, w - 2 * i - 1, H - 1);
    x.strokeStyle = 'rgba(40,25,10,.55)'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(i + 2, h - i - 2); x.lineTo(w - i - 2, h - i - H + 2); x.stroke();
    x.fillStyle = 'rgba(30,20,10,.55)'; x.font = `bold ${0.16 * T}px monospace`; x.textAlign = 'center';
    x.fillText('MUN.', w / 2, i - H + (h - 2 * i) / 2 + 4);
  },

  prop_sandbag(x, w, h, r) {
    const T = TILE;
    const bag = (bx, by, bw, bh, c) => {
      x.fillStyle = c; x.beginPath(); x.ellipse(bx, by, bw, bh, 0, 0, 7); x.fill();
      x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.ellipse(bx, by + bh * 0.4, bw * 0.9, bh * 0.5, 0, 0, Math.PI); x.fill();
    };
    for (let layer = 0; layer < 3; layer++) {
      const yb = h * 0.75 - layer * 0.15 * T;
      for (let k = 0; k < 3; k++) bag((k + 0.5 + (layer % 2) * 0.3) * w / 3.3, yb, 0.2 * T, 0.11 * T, shade('#a59670', (r() - 0.5) * 0.12 + layer * 0.03));
    }
    for (let k = 0; k < 3; k++) bag((k + 0.6) * w / 3.2, h * 0.75 - 0.5 * T, 0.2 * T, 0.13 * T, shade('#b4a57e', (r() - 0.5) * 0.1));
  },

  prop_barrels(x, w, h, r) {
    const T = TILE;
    const spots = [[0.3, 0.45], [0.68, 0.4], [0.5, 0.78]];
    for (const [sx, sy] of spots) {
      const bx = sx * w, by = sy * h, rad = 0.17 * T, H = 0.52 * T;
      const col = r() < 0.3 ? '#7a4a2a' : '#56603c';
      const g = x.createLinearGradient(bx - rad, 0, bx + rad, 0);
      g.addColorStop(0, shade(col, 0.1)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.15));
      x.fillStyle = g; x.fillRect(bx - rad, by - H, rad * 2, H);
      x.beginPath(); x.ellipse(bx, by, rad, rad * 0.4, 0, 0, Math.PI); x.fill();
      x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(bx - rad, by - H * 0.35, rad * 2, 2); x.fillRect(bx - rad, by - H * 0.7, rad * 2, 2);
      x.fillStyle = shade(col, 0.05); x.beginPath(); x.ellipse(bx, by - H, rad, rad * 0.4, 0, 0, 7); x.fill();
      x.strokeStyle = shade(col, -0.2); x.stroke();
      x.fillStyle = '#222'; x.beginPath(); x.arc(bx + rad * 0.4, by - H, 1.5, 0, 7); x.fill();
    }
  },

  prop_truck(x, w, h, r) {
    const T = TILE, ol = '#4e5538';
    // ruedas
    for (const wx of [0.55, 1.55, 3.3]) {
      x.fillStyle = '#151515'; x.beginPath(); x.arc(wx * T, h - 0.33 * T, 0.33 * T, 0, 7); x.fill();
      x.fillStyle = '#3d3d38'; x.beginPath(); x.arc(wx * T, h - 0.33 * T, 0.14 * T, 0, 7); x.fill();
    }
    // chasis
    x.fillStyle = shade(ol, -0.12); x.fillRect(0.05 * T, h - 0.95 * T, w - 0.1 * T, 0.45 * T);
    // caja con lona
    const hc = 1.55 * T, bx1 = 2.7 * T;
    x.fillStyle = '#7b7150'; x.fillRect(0.05 * T, h - hc, bx1, hc - 0.85 * T);
    x.fillStyle = 'rgba(0,0,0,.18)'; for (let xx = 0.5 * T; xx < bx1; xx += 0.55 * T) x.fillRect(xx, h - hc, 2, hc - 0.85 * T);
    x.fillStyle = '#958a64'; x.fillRect(0.05 * T, 0.08 * T - hc, bx1, h - 0.1 * T);
    x.fillStyle = 'rgba(0,0,0,.14)'; for (let xx = 0.5 * T; xx < bx1; xx += 0.55 * T) x.fillRect(xx, 0.08 * T - hc, 3, h - 0.1 * T);
    x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0.05 * T, 0.08 * T - hc, bx1, 6);
    // cabina
    const hk = 1.3 * T, cx0 = 2.8 * T, cx1 = w - 0.05 * T;
    x.fillStyle = ol; x.fillRect(cx0, h - hk, cx1 - cx0, hk - 0.85 * T);
    x.fillStyle = '#2a3440'; x.fillRect(cx0 + 0.12 * T, h - hk + 0.08 * T, 0.5 * T, 0.22 * T);
    x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(cx0 + 0.7 * T, h - hk + 0.05 * T, 1, hk - 0.95 * T);
    x.fillStyle = shade(ol, 0.08); x.fillRect(cx0, 0.15 * T - hk, cx1 - cx0, h - 0.3 * T);
    x.fillStyle = shade(ol, 0.0); x.fillRect(cx0 + 0.75 * T, 0.25 * T - 0.95 * T, cx1 - cx0 - 0.75 * T, h - 0.5 * T);
    x.fillStyle = '#e8e2b0'; x.beginPath(); x.arc(cx1 - 3, h - 0.95 * T, 3, 0, 7); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 1; x.strokeRect(cx0 + 0.5, 0.15 * T - hk + 0.5, cx1 - cx0 - 1, h - 0.3 * T);
  },

  prop_jeep(x, w, h, r) {
    const T = TILE, ol = '#5a6436';
    for (const wx of [0.5, 2.45]) { x.fillStyle = '#141414'; x.beginPath(); x.arc(wx * T, h - 0.3 * T, 0.3 * T, 0, 7); x.fill(); x.fillStyle = '#444'; x.beginPath(); x.arc(wx * T, h - 0.3 * T, 0.11 * T, 0, 7); x.fill(); }
    x.fillStyle = shade(ol, -0.1); x.fillRect(0.1 * T, h - 0.85 * T, w - 0.2 * T, 0.45 * T);
    x.fillStyle = ol; x.fillRect(0.1 * T, 0.15 * T - 0.6 * T, w - 0.2 * T, h - 0.3 * T);
    x.fillStyle = shade(ol, -0.2); x.fillRect(0.35 * T, 0.35 * T - 0.6 * T, 1.3 * T, h - 0.7 * T);
    x.fillStyle = '#3e3424'; x.fillRect(0.45 * T, 0.45 * T - 0.6 * T, 0.45 * T, 0.45 * T); x.fillRect(1.1 * T, 0.45 * T - 0.6 * T, 0.45 * T, 0.45 * T);
    x.fillStyle = '#e8e4d0';
    const sx = 2.4 * T, sy = h / 2 - 0.6 * T, rad = 0.28 * T;
    x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? rad * 0.4 : rad; x.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); } x.fill();
  },

  prop_tent(x, w, h, r) {
    const T = TILE, H = 1.25 * T, ry = h / 2 - H;
    x.fillStyle = '#8a8360'; x.beginPath(); x.moveTo(0.1 * T, 0.15 * T); x.lineTo(w - 0.1 * T, 0.15 * T); x.lineTo(w, ry); x.lineTo(0, ry); x.fill();
    const g = x.createLinearGradient(0, ry, 0, h);
    g.addColorStop(0, '#7a7352'); g.addColorStop(1, '#5d583e');
    x.fillStyle = g; x.beginPath(); x.moveTo(-0.05 * T, ry); x.lineTo(w + 0.05 * T, ry); x.lineTo(w - 0.05 * T, h - 0.05 * T); x.lineTo(0.05 * T, h - 0.05 * T); x.fill();
    x.fillStyle = 'rgba(0,0,0,.15)'; for (let xx = 0.6 * T; xx < w; xx += 0.75 * T) x.fillRect(xx, ry, 2, h - ry - 0.05 * T);
    x.fillStyle = '#3a3626'; x.fillRect(-0.05 * T, ry - 2, w + 0.1 * T, 3);
    x.fillStyle = '#2b2a20'; x.beginPath(); x.moveTo(w / 2 - 0.3 * T, h - 0.05 * T); x.lineTo(w / 2, ry + 0.5 * T); x.lineTo(w / 2 + 0.3 * T, h - 0.05 * T); x.fill();
    x.strokeStyle = 'rgba(220,210,170,.5)'; x.lineWidth = 1;
    for (const px of [0.2 * T, w - 0.2 * T]) { x.beginPath(); x.moveTo(px, ry + 0.4 * T); x.lineTo(px + (px < w / 2 ? -0.4 : 0.4) * T, h + 0.1 * T); x.stroke(); }
  },

  prop_tower(x, w, h, r) {
    const T = TILE, Hp = 2.5 * T, wood = '#6a4c2e';
    const post = (px, py) => { x.fillStyle = wood; x.fillRect(px - 3, py - Hp, 6, Hp); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(px + 1, py - Hp, 2, Hp); };
    post(0.15 * T, 0.2 * T); post(w - 0.15 * T, 0.2 * T);
    x.strokeStyle = shade(wood, -0.1); x.lineWidth = 3;
    x.beginPath(); x.moveTo(0.15 * T, h - 0.2 * T); x.lineTo(w - 0.15 * T, h - Hp + 0.2 * T); x.moveTo(w - 0.15 * T, h - 0.2 * T); x.lineTo(0.15 * T, h - Hp + 0.2 * T); x.stroke();
    post(0.15 * T, h - 0.15 * T); post(w - 0.15 * T, h - 0.15 * T);
    this.box(x, -0.1 * T, -0.1 * T, w + 0.2 * T, h + 0.2 * T, Hp, '#8a6a44', '#5e4428');
    x.fillStyle = '#4c3820'; x.fillRect(-0.1 * T, h + 0.1 * T - Hp - 0.45 * T, w + 0.2 * T, 0.45 * T);
    x.fillStyle = 'rgba(0,0,0,.2)'; for (let xx = 0; xx < w; xx += 8) x.fillRect(xx, h + 0.1 * T - Hp - 0.45 * T, 1, 0.45 * T);
    x.fillStyle = '#3a2c1a'; x.fillRect(0, -Hp - 0.1 * T, 4, -0.7 * T); x.fillRect(w - 4, -Hp - 0.1 * T, 4, -0.7 * T);
    const ry = -Hp - 0.75 * T;
    x.fillStyle = '#4f5a3c'; x.beginPath(); x.moveTo(-0.25 * T, ry + h * 0.5); x.lineTo(w + 0.25 * T, ry + h * 0.5); x.lineTo(w / 2, ry - 0.5 * T); x.fill();
    x.fillStyle = '#3e4830'; x.beginPath(); x.moveTo(-0.25 * T, ry + h * 0.5); x.lineTo(w + 0.25 * T, ry + h * 0.5); x.lineTo(w + 0.1 * T, ry + h * 0.5 + 0.25 * T); x.lineTo(-0.1 * T, ry + h * 0.5 + 0.25 * T); x.fill();
    x.fillStyle = '#ddd'; x.beginPath(); x.arc(w * 0.75, h - Hp - 0.25 * T, 4, 0, 7); x.fill();
  },

  prop_depot(x, w, h, r, p) {
    const T = TILE;
    if (Level.depot.destroyed) {
      for (let i = 0; i < 26; i++) {
        x.fillStyle = r() < 0.5 ? '#1c1a17' : '#3a3229';
        const px = r() * w, py = r() * h, s = 4 + r() * 12;
        x.beginPath(); x.moveTo(px, py); x.lineTo(px + s, py - s * 0.6 - r() * 10); x.lineTo(px + s * 1.3, py + 2); x.fill();
      }
      x.strokeStyle = '#2b2622'; x.lineWidth = 5;
      x.beginPath(); x.arc(w * 0.4, h * 0.4, 0.6 * T, 0.3, 2.4); x.stroke();
      x.beginPath(); x.arc(w * 0.62, h * 0.7, 0.5 * T, 3.5, 5.6); x.stroke();
      return;
    }
    for (let j = 0; j < 3; j++) {
      const yb = (j + 1) * h / 3, rad = 0.44 * T, cy = yb - rad - 0.1 * T;
      x.fillStyle = '#2d2a22'; x.fillRect(0.4 * T, yb - 0.2 * T, 0.25 * T, 0.2 * T); x.fillRect(w - 0.65 * T, yb - 0.2 * T, 0.25 * T, 0.2 * T);
      const g = x.createLinearGradient(0, cy - rad, 0, cy + rad);
      g.addColorStop(0, '#b9bda5'); g.addColorStop(0.35, '#8c917a'); g.addColorStop(1, '#4e5244');
      x.fillStyle = g; this.rr(x, 0.08 * T, cy - rad, w - 0.16 * T, rad * 2, rad); x.fill();
      x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0.8 * T, cy - rad, 4, rad * 2); x.fillRect(w - 0.8 * T, cy - rad, 4, rad * 2);
      x.fillStyle = 'rgba(120,60,20,.25)'; x.fillRect(0.3 * T + r() * w * 0.5, cy, 10, rad);
      if (j === 2) { x.fillStyle = '#c23a22'; x.fillRect(w / 2 - 0.45 * T, cy - 6, 0.9 * T, 12); x.fillStyle = '#f0e6c8'; x.font = `bold ${0.17 * T}px sans-serif`; x.textAlign = 'center'; x.fillText('KRAFTSTOFF', w / 2, cy + 3); }
    }
  },

  // ---------------- ICONOS ----------------
  icon(x, id, s) {
    x.save(); x.scale(s / 48, s / 48);
    x.lineCap = 'round'; x.lineJoin = 'round';
    const ink = '#e8dcb0', dk = '#1a1610';
    const out = (f) => { x.strokeStyle = dk; x.lineWidth = 4; f(); x.stroke(); };
    switch (id) {
      case 'knife':
        x.fillStyle = '#d8dde0'; x.beginPath(); x.moveTo(12, 36); x.lineTo(36, 8); x.lineTo(38, 12); x.lineTo(17, 38); x.closePath(); x.fill(); x.strokeStyle = dk; x.lineWidth = 1.5; x.stroke();
        x.fillStyle = '#6b4a2a'; x.save(); x.translate(12, 38); x.rotate(-0.85); x.fillRect(-3, -3, 14, 6); x.restore();
        x.fillStyle = '#b89a50'; x.save(); x.translate(17, 35); x.rotate(-0.85); x.fillRect(-1, -6, 3, 12); x.restore();
        break;
      case 'carry':
        x.fillStyle = '#6f7660'; this.rr(x, 8, 26, 30, 9, 4); x.fill(); x.fillStyle = '#d9ab84'; x.beginPath(); x.arc(40, 30, 5, 0, 7); x.fill();
        x.strokeStyle = ink; x.lineWidth = 3; x.beginPath(); x.moveTo(24, 21); x.lineTo(24, 7); x.moveTo(18, 13); x.lineTo(24, 7); x.lineTo(30, 13); x.stroke();
        break;
      case 'shoot':
        x.strokeStyle = '#6b4a2a'; x.lineWidth = 5; x.beginPath(); x.moveTo(6, 34); x.lineTo(22, 26); x.stroke();
        x.strokeStyle = '#222'; x.lineWidth = 3; x.beginPath(); x.moveTo(18, 28); x.lineTo(44, 14); x.stroke();
        x.fillStyle = '#111'; x.save(); x.translate(26, 20); x.rotate(-0.5); x.fillRect(-7, -3, 14, 5); x.restore();
        x.strokeStyle = '#c9b070'; x.lineWidth = 1.5; x.beginPath(); x.arc(36, 34, 7, 0, 7); x.moveTo(36, 25); x.lineTo(36, 43); x.moveTo(27, 34); x.lineTo(45, 34); x.stroke();
        break;
      case 'disguise':
        x.fillStyle = '#6c7259'; x.beginPath(); x.ellipse(24, 18, 17, 7, 0, 0, 7); x.fill();
        x.fillStyle = '#26261f'; x.fillRect(11, 19, 26, 6);
        x.fillStyle = '#111'; x.beginPath(); x.ellipse(24, 28, 14, 4, 0, 0, 7); x.fill();
        x.fillStyle = '#ddd'; x.beginPath(); x.arc(24, 15, 2.5, 0, 7); x.fill();
        break;
      case 'syringe':
        x.save(); x.translate(24, 24); x.rotate(-0.8);
        x.fillStyle = '#cfe6ee'; x.fillRect(-12, -5, 22, 10); x.strokeStyle = dk; x.lineWidth = 1.5; x.strokeRect(-12, -5, 22, 10);
        x.fillStyle = '#7ac0d8'; x.fillRect(-2, -4, 11, 8);
        x.fillStyle = '#888'; x.fillRect(-18, -1.5, 6, 3); x.fillRect(-20, -6, 2, 12);
        x.strokeStyle = '#ddd'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(10, 0); x.lineTo(20, 0); x.stroke();
        x.restore();
        break;
      case 'lure':
        x.fillStyle = '#b89a50'; this.rr(x, 8, 20, 18, 10, 4); x.fill(); x.fillStyle = '#7a6430'; x.beginPath(); x.arc(14, 25, 3, 0, 7); x.fill();
        x.strokeStyle = ink; x.lineWidth = 2.5;
        for (const rr of [8, 14, 20]) { x.beginPath(); x.arc(26, 25, rr, -0.7, 0.7); x.stroke(); }
        break;
      case 'bomb':
        for (let i = 0; i < 3; i++) { x.fillStyle = '#b8352a'; this.rr(x, 8 + i * 8, 14, 7, 26, 2); x.fill(); }
        x.fillStyle = '#222'; x.fillRect(7, 22, 26, 4);
        x.fillStyle = '#e8e4d0'; x.beginPath(); x.arc(36, 30, 9, 0, 7); x.fill(); x.strokeStyle = dk; x.lineWidth = 2; x.stroke();
        x.beginPath(); x.moveTo(36, 30); x.lineTo(36, 24); x.moveTo(36, 30); x.lineTo(40, 31); x.stroke();
        x.strokeStyle = '#d8b440'; x.beginPath(); x.moveTo(16, 14); x.quadraticCurveTo(18, 5, 26, 8); x.stroke();
        break;
      case 'grenade':
        x.fillStyle = '#4f5a32'; x.beginPath(); x.ellipse(22, 28, 11, 13, 0, 0, 7); x.fill();
        x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 1.5;
        for (const yy of [22, 28, 34]) { x.beginPath(); x.moveTo(12, yy); x.lineTo(32, yy); x.stroke(); }
        x.beginPath(); x.moveTo(22, 15); x.lineTo(22, 41); x.stroke();
        x.fillStyle = '#888'; x.fillRect(18, 11, 9, 5);
        x.strokeStyle = '#bbb'; x.lineWidth = 2; x.beginPath(); x.moveTo(27, 13); x.lineTo(36, 22); x.stroke();
        x.beginPath(); x.arc(32, 9, 4, 0, 7); x.stroke();
        break;
      case 'crouch':
        x.fillStyle = ink;
        x.beginPath(); x.arc(28, 13, 5, 0, 7); x.fill();
        x.strokeStyle = ink; x.lineWidth = 5;
        x.beginPath(); x.moveTo(26, 19); x.lineTo(20, 29); x.lineTo(30, 33); x.lineTo(28, 42); x.moveTo(20, 29); x.lineTo(14, 40); x.moveTo(25, 22); x.lineTo(34, 27); x.stroke();
        break;
      case 'eye':
        x.strokeStyle = ink; x.lineWidth = 3; x.beginPath(); x.moveTo(6, 24); x.quadraticCurveTo(24, 6, 42, 24); x.quadraticCurveTo(24, 42, 6, 24); x.stroke();
        x.fillStyle = ink; x.beginPath(); x.arc(24, 24, 6, 0, 7); x.fill();
        break;
    }
    x.restore();
  },

  // ---------------- RETRATOS ----------------
  portrait(x, type, w, h) {
    const P = PAL[type] || PAL.soldier;
    x.save();
    const bg = x.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#6e6248'); bg.addColorStop(1, '#2e281c');
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    const sc = w / 100; x.scale(sc, sc);
    const H = h / sc;
    // hombros
    const tg = x.createLinearGradient(0, H * 0.7, 0, H);
    tg.addColorStop(0, shade(P.tunic, 0.05)); tg.addColorStop(1, shade(P.tunic, -0.15));
    x.fillStyle = tg; x.beginPath(); x.moveTo(5, H); x.quadraticCurveTo(10, H * 0.72, 50, H * 0.7); x.quadraticCurveTo(90, H * 0.72, 95, H); x.fill();
    if (P.shirt) { x.fillStyle = P.shirt; x.beginPath(); x.moveTo(40, H * 0.7); x.lineTo(60, H * 0.7); x.lineTo(50, H * 0.92); x.fill(); x.fillStyle = '#8a2020'; x.fillRect(48, H * 0.72, 4, H * 0.2); }
    else { x.fillStyle = shade(P.tunic, -0.12); x.beginPath(); x.moveTo(38, H * 0.7); x.lineTo(50, H * 0.82); x.lineTo(62, H * 0.7); x.lineTo(58, H * 0.68); x.lineTo(50, H * 0.76); x.lineTo(42, H * 0.68); x.fill(); }
    // cuello y cara
    x.fillStyle = shade(P.skin, -0.12); x.fillRect(41, H * 0.55, 18, H * 0.17);
    const fg = x.createRadialGradient(42, H * 0.38, 4, 50, H * 0.45, 30);
    fg.addColorStop(0, shade(P.skin, 0.06)); fg.addColorStop(1, shade(P.skin, -0.16));
    x.fillStyle = fg; x.beginPath(); x.ellipse(50, H * 0.45, 22, 28, 0, 0, 7); x.fill();
    x.fillStyle = shade(P.skin, -0.1); x.beginPath(); x.ellipse(28, H * 0.47, 4, 7, 0, 0, 7); x.ellipse(72, H * 0.47, 4, 7, 0, 0, 7); x.fill();
    // rasgos
    x.fillStyle = '#f0ece0'; for (const ex of [41, 59]) { x.beginPath(); x.ellipse(ex, H * 0.43, 4.5, 2.6, 0, 0, 7); x.fill(); }
    x.fillStyle = type === 'spy' ? '#2a3a20' : '#3a4a5a'; for (const ex of [41, 59]) { x.beginPath(); x.arc(ex, H * 0.43, 2, 0, 7); x.fill(); }
    x.strokeStyle = type === 'sniper' ? '#8a7a5a' : '#3a2a1a'; x.lineWidth = 2.5;
    x.beginPath(); x.moveTo(35, H * 0.37); x.lineTo(46, H * 0.36); x.moveTo(54, H * 0.36); x.lineTo(65, H * 0.37); x.stroke();
    x.strokeStyle = shade(P.skin, -0.25); x.lineWidth = 2; x.beginPath(); x.moveTo(50, H * 0.43); x.lineTo(47, H * 0.53); x.lineTo(52, H * 0.54); x.stroke();
    x.strokeStyle = '#7a3a2a'; x.beginPath(); x.moveTo(43, H * 0.61); x.quadraticCurveTo(50, H * 0.63, 57, H * 0.61); x.stroke();
    if (type === 'sniper') { x.fillStyle = '#8a7a5a'; x.beginPath(); x.ellipse(50, H * 0.575, 10, 2.6, 0, 0, 7); x.fill(); }
    if (type === 'spy') { x.strokeStyle = '#2a1a10'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(43, H * 0.575); x.lineTo(57, H * 0.575); x.stroke(); }
    if (type === 'beret' || type === 'sapper') { x.fillStyle = 'rgba(40,30,20,.18)'; x.beginPath(); x.ellipse(50, H * 0.62, 17, 9, 0, 0, Math.PI); x.fill(); }
    // tocado
    x.fillStyle = P.hatCol;
    switch (P.hat) {
      case 'beret': x.beginPath(); x.ellipse(46, H * 0.22, 30, 12, -0.2, 0, 7); x.fill(); x.fillStyle = '#d8b440'; x.beginPath(); x.arc(62, H * 0.24, 3.5, 0, 7); x.fill(); break;
      case 'fieldcap': x.beginPath(); x.ellipse(50, H * 0.25, 24, 14, 0, Math.PI, 0); x.fill(); x.fillStyle = shade(P.hatCol, -0.12); x.beginPath(); x.ellipse(50, H * 0.26, 26, 5, 0, 0, 7); x.fill(); break;
      case 'fedora': x.beginPath(); x.ellipse(50, H * 0.25, 36, 7, 0, 0, 7); x.fill(); this.rr(x, 31, H * 0.04, 38, H * 0.2, 9); x.fill(); x.fillStyle = '#151515'; x.fillRect(31, H * 0.19, 38, 5); break;
      case 'brodie': x.beginPath(); x.ellipse(50, H * 0.23, 40, 9, 0, 0, 7); x.fill(); x.fillStyle = shade(P.hatCol, 0.06); x.beginPath(); x.ellipse(50, H * 0.21, 23, 16, 0, Math.PI, 0); x.fill(); break;
      case 'cap': x.beginPath(); x.ellipse(50, H * 0.16, 30, 10, 0, 0, 7); x.fill(); x.fillStyle = '#26261f'; x.fillRect(27, H * 0.17, 46, 7); x.fillStyle = '#111'; x.beginPath(); x.ellipse(50, H * 0.27, 24, 5, 0, 0, 7); x.fill(); break;
    }
    x.restore();
    // viñeta sepia
    const vg = x.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,12,4,.55)');
    x.fillStyle = vg; x.fillRect(0, 0, w, h);
  }
};
