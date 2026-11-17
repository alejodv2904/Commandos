'use strict';
// Arte 2D de la interfaz: iconos de la mochila y retratos (dibujados por código).

const PAL = {
  soldier: { tunic: '#5f6650', pants: '#4b5040', boots: '#1d1b18', belt: '#2a2620', skin: '#d9ab84', hat: 'helmet', hatCol: '#4d5345', weapon: 'rifle', pouches: true },
  officer: { tunic: '#6c7259', pants: '#3b3d36', boots: '#141312', belt: '#2a2018', skin: '#d9ab84', hat: 'cap', hatCol: '#5e6551', weapon: 'pistol' },
  beret: { tunic: '#6a6f45', pants: '#43552b', boots: '#2a2118', belt: '#3b3220', skin: '#c48c6a', hat: 'beret', hatCol: '#2b6a2a', weapon: null, pouches: true },
  sniper: { tunic: '#5d4a33', pants: '#6a603e', boots: '#2e2418', belt: '#4a3c24', skin: '#e0b38c', hat: 'fieldcap', hatCol: '#4a3a26', weapon: 'sniper' },
  spy: { tunic: '#8c8471', pants: '#292d37', boots: '#121212', belt: '#1a1a1a', skin: '#dcb08a', hat: 'fedora', hatCol: '#38383d', weapon: null, shirt: '#e8e4d8' },
  spyDis: { tunic: '#6c7259', pants: '#3b3d36', boots: '#141312', belt: '#2a2018', skin: '#dcb08a', hat: 'cap', hatCol: '#5e6551', weapon: 'pistol', armband: true },
  sapper: { tunic: '#6b6a44', pants: '#5a583a', boots: '#2a2118', belt: '#3e3824', skin: '#d8a982', hat: 'brodie', hatCol: '#5d5c3a', weapon: null, pack: '#4f4a30' }
};

const Sprites = {
  rr(x, X, Y, W, H, r) { x.beginPath(); if (x.roundRect) x.roundRect(X, Y, W, H, r); else x.rect(X, Y, W, H); },


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
      case 'rope':
        x.strokeStyle = '#c8a86a'; x.lineWidth = 4;
        for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(24, 24, 15 - i * 4, 11 - i * 3, 0.3, 0, 7); x.stroke(); }
        x.beginPath(); x.moveTo(36, 30); x.quadraticCurveTo(44, 40, 38, 44); x.stroke();
        break;
      case 'medkit':
        x.fillStyle = '#e8e2d0'; this.rr(x, 6, 12, 36, 28, 4); x.fill(); x.strokeStyle = dk; x.lineWidth = 2; x.stroke();
        x.fillStyle = '#c0281c'; x.fillRect(20, 16, 8, 20); x.fillRect(14, 22, 20, 8);
        x.fillStyle = '#7a6a50'; x.fillRect(18, 8, 12, 5);
        break;
      case 'ration':
        x.fillStyle = '#7a6a3a'; this.rr(x, 6, 16, 36, 20, 3); x.fill();
        x.fillStyle = '#d8c890'; x.fillRect(10, 20, 28, 12); x.fillStyle = '#5a4a2a'; x.font = 'bold 8px monospace'; x.fillText('K-RAT', 12, 29);
        break;
      case 'cigs':
        x.fillStyle = '#e8e2d0'; x.fillRect(12, 12, 24, 28); x.fillStyle = '#b8352a'; x.fillRect(12, 12, 24, 10);
        x.fillStyle = '#f0e8d8'; for (let i = 0; i < 3; i++) x.fillRect(15 + i * 6, 6, 4, 8); x.fillStyle = '#d88a40'; for (let i = 0; i < 3; i++) x.fillRect(15 + i * 6, 6, 4, 3);
        break;
      case 'wine':
        x.fillStyle = '#2f5a2a'; this.rr(x, 16, 18, 16, 26, 4); x.fill(); x.fillRect(21, 6, 6, 14);
        x.fillStyle = '#e8dcb0'; x.fillRect(18, 26, 12, 10); x.fillStyle = '#7a1a2a'; x.fillRect(21, 4, 6, 4);
        break;
      case 'pistol':
        x.fillStyle = '#2a2a2a'; x.fillRect(8, 16, 30, 9); x.fillRect(38, 17, 4, 4);
        x.fillStyle = '#5a3a22'; x.save(); x.translate(14, 24); x.rotate(0.3); x.fillRect(0, 0, 9, 18); x.restore();
        x.strokeStyle = '#2a2a2a'; x.lineWidth = 2; x.beginPath(); x.arc(24, 28, 4, 0, Math.PI); x.stroke();
        break;
      case 'cutters':
        x.strokeStyle = '#9aa0a4'; x.lineWidth = 4; x.beginPath(); x.moveTo(10, 10); x.lineTo(28, 28); x.moveTo(26, 10); x.lineTo(14, 26); x.stroke();
        x.strokeStyle = '#b8352a'; x.lineWidth = 6; x.beginPath(); x.moveTo(28, 28); x.lineTo(40, 42); x.moveTo(20, 28); x.lineTo(24, 44); x.stroke();
        break;
      case 'ammo':
        for (let i = 0; i < 3; i++) { x.fillStyle = '#c8a040'; x.fillRect(12 + i * 9, 18, 6, 22); x.fillStyle = '#a07030'; x.beginPath(); x.moveTo(12 + i * 9, 18); x.lineTo(15 + i * 9, 8); x.lineTo(18 + i * 9, 18); x.fill(); }
        break;
      case 'docs':
        x.fillStyle = '#d8cca0'; x.fillRect(10, 8, 28, 34); x.fillStyle = '#e8dcb0'; x.fillRect(14, 12, 28, 34);
        x.fillStyle = '#8a2a1a'; x.font = 'bold 7px monospace'; x.fillText('GEHEIM', 17, 22);
        x.fillStyle = '#5a4a3a'; for (let i = 0; i < 4; i++) x.fillRect(17, 27 + i * 4, 20, 1.5);
        break;
      case 'punch':
        x.fillStyle = '#d9ab84'; this.rr(x, 12, 14, 24, 20, 6); x.fill(); x.strokeStyle = dk; x.lineWidth = 2; x.stroke();
        x.beginPath(); for (let i = 1; i < 4; i++) { x.moveTo(12 + i * 6, 14); x.lineTo(12 + i * 6, 22); } x.stroke();
        x.fillStyle = '#4f6a32'; x.fillRect(16, 34, 16, 8);
        x.strokeStyle = ink; x.lineWidth = 2; x.beginPath(); x.moveTo(40, 10); x.lineTo(44, 6); x.moveTo(41, 18); x.lineTo(46, 18); x.stroke();
        break;
      case 'talk':
        x.fillStyle = ink; this.rr(x, 6, 8, 30, 20, 8); x.fill(); x.beginPath(); x.moveTo(14, 27); x.lineTo(10, 36); x.lineTo(22, 27); x.fill();
        x.fillStyle = '#e8dcb0'; this.rr(x, 20, 22, 22, 16, 7); x.fill();
        x.fillStyle = dk; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(14 + i * 7, 18, 2, 0, 7); x.fill(); }
        break;
      case 'prone':
        x.fillStyle = ink; x.beginPath(); x.arc(38, 30, 5, 0, 7); x.fill();
        x.strokeStyle = ink; x.lineWidth = 5; x.beginPath(); x.moveTo(33, 32); x.lineTo(12, 34); x.moveTo(26, 33); x.lineTo(40, 40); x.moveTo(12, 34); x.lineTo(5, 38); x.stroke();
        x.fillStyle = '#6a5a3a'; x.fillRect(4, 40, 42, 3);
        break;
      case 'cover':
        x.strokeStyle = '#ffb340'; x.lineWidth = 3; x.beginPath(); x.arc(24, 24, 13, 0, 7); x.moveTo(24, 5); x.lineTo(24, 15); x.moveTo(24, 33); x.lineTo(24, 43); x.moveTo(5, 24); x.lineTo(15, 24); x.moveTo(33, 24); x.lineTo(43, 24); x.stroke();
        x.fillStyle = '#ffb340'; x.beginPath(); x.arc(24, 24, 3, 0, 7); x.fill();
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
