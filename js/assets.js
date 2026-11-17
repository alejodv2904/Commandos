'use strict';
// Carga asíncrona de recursos incrustados (texturas y modelo del soldado).

const Assets = {
  img: {}, soldier: null,
  async load(progress) {
    const keys = Object.keys(window.TEX || {});
    let done = 0; const total = keys.length + 1;
    const tick = () => { done++; if (progress) progress(done / total); };
    await Promise.all(keys.map(k => new Promise(res => {
      const img = new Image();
      img.onload = () => { this.img[k] = img; tick(); res(); };
      img.onerror = () => { tick(); res(); };
      img.src = window.TEX[k];
    })));
    try {
      const bin = Uint8Array.from(atob(window.MODELS.soldier), c => c.charCodeAt(0)).buffer;
      this.soldier = await new Promise((res, rej) => new THREE.GLTFLoader().parse(bin, '', res, rej));
    } catch (e) { console.warn('No se pudo cargar el soldado 3D', e); this.soldier = null; }
    tick();
  }
};
