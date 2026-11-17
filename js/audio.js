'use strict';
// Efectos de sonido sintetizados (sin archivos de audio).

const Sfx = {
  ac: null, master: null, muted: false, noiseBuf: null, lastAlarm: -9, ambient: false,

  ensure() {
    if (!this.ac) {
      try {
        this.ac = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ac.createGain(); this.master.gain.value = 0.6; this.master.connect(this.ac.destination);
        const n = this.ac.sampleRate * 2, buf = this.ac.createBuffer(1, n, this.ac.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
      } catch (e) { this.ac = null; return; }
    }
    if (this.ac.state === 'suspended') this.ac.resume();
    if (!this.ambient) this.startAmbient();
  },

  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.6; return this.muted; },

  noise(dur, freq, q, gain, type, delay) {
    const ac = this.ac, t = ac.currentTime + (delay || 0);
    const src = ac.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  },

  tone(freq, dur, type, gain, slideTo, delay) {
    const ac = this.ac, t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  },

  play(name, x, y) {
    if (!this.ac || this.muted) return;
    let v = 1;
    if (x !== undefined && typeof G !== 'undefined') { const c = G.camCenter(); v = clamp(1.15 - dist(x, y, c.x, c.y) / 28, 0.1, 1); }
    switch (name) {
      case 'shot': this.noise(0.22, 2200, 0.8, 0.55 * v); this.tone(160, 0.12, 'sine', 0.35 * v, 50); break;
      case 'rifle': this.noise(0.45, 1500, 0.7, 0.8 * v); this.tone(110, 0.2, 'sine', 0.5 * v, 40); this.noise(0.8, 600, 0.5, 0.15 * v, 'lowpass', 0.08); break;
      case 'boom': this.noise(1.6, 380, 0.6, 1.0 * v); this.tone(70, 0.9, 'sine', 0.8 * v, 25); this.noise(2.2, 160, 0.4, 0.4 * v, 'lowpass', 0.15); break;
      case 'knife': this.noise(0.12, 4500, 3, 0.28 * v, 'bandpass'); break;
      case 'thud': this.noise(0.18, 260, 1, 0.4 * v); break;
      case 'whistle': this.tone(1700, 0.18, 'sine', 0.18 * v, 2100); this.tone(2100, 0.25, 'sine', 0.18 * v, 1600, 0.2); break;
      case 'plant': for (let i = 0; i < 3; i++) this.tone(1200, 0.05, 'square', 0.05, 0, i * 0.12); break;
      case 'tick': this.tone(1400, 0.04, 'square', 0.04); break;
      case 'select': this.tone(520, 0.06, 'triangle', 0.08, 700); break;
      case 'order': this.tone(380, 0.05, 'triangle', 0.06, 300); break;
      case 'alarm':
        if (this.ac.currentTime - this.lastAlarm < 4) return;
        this.lastAlarm = this.ac.currentTime;
        for (let i = 0; i < 3; i++) { this.tone(520, 0.45, 'sawtooth', 0.07, 880, i * 0.5); }
        break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.15, 0, i * 0.18)); break;
      case 'lose': [392, 330, 262].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.15, 0, i * 0.3)); break;
    }
  },

  startAmbient() {
    this.ambient = true;
    const ac = this.ac;
    const src = ac.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g = ac.createGain(); g.gain.value = 0.035;
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.08; lg.gain.value = 0.02;
    lfo.connect(lg); lg.connect(g.gain); lfo.start();
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
    const bird = () => {
      if (!this.muted) {
        const base = 2400 + Math.random() * 1600, n = 2 + ((Math.random() * 4) | 0);
        for (let i = 0; i < n; i++) this.tone(base, 0.08, 'sine', 0.025, base * 1.3, i * 0.11);
      }
      setTimeout(bird, 3000 + Math.random() * 7000);
    };
    setTimeout(bird, 2000);
  }
};
