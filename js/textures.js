'use strict';
// Ruido procedural y utilidades de color para generar texturas sin imágenes.

const Noise = (() => {
  const rng = mulberry32(4242);
  const perm = new Uint16Array(512), val = new Float32Array(256);
  const p = []; for (let i = 0; i < 256; i++) p.push(i);
  for (let i = 255; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 256; i++) val[i] = rng();
  const h = (x, y) => val[perm[perm[x & 255] + (y & 255)]];
  function value(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, o) {
    o = o || 3; let s = 0, a = 1, f = 1, n = 0;
    for (let i = 0; i < o; i++) { s += a * value(x * f, y * f); n += a; a *= 0.5; f *= 2.03; }
    return s / n;
  }
  function hash(x, y) {
    let q = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    q = Math.imul(q ^ (q >>> 13), 1274126177);
    return ((q ^ (q >>> 16)) >>> 0) / 4294967296;
  }
  return { value, fbm, hash };
})();

function hex2rgb(h) {
  h = h.replace('#', '');
  return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
}
// Aclara (a>0) u oscurece (a<0) un color hex. Devuelve rgb().
function shade(h, a) {
  const c = hex2rgb(h), f = v => Math.round(clamp(v + a * 255, 0, 255));
  return `rgb(${f(c[0])},${f(c[1])},${f(c[2])})`;
}
function mixRgb(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
