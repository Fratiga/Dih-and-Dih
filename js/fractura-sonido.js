/* =============================================================================
   LA FRACTURA: sonido. Todo se sintetiza en el momento con Web Audio (osciladores, ruido y envolventes),
   sin archivos que descargar. Cada efecto es corto y seco para que no canse en una guerra larga.
   El volumen y el silencio se guardan en este navegador.
   Uso: FracturaSonido.tocar("golpe") · FracturaSonido.volumen(0.6) · FracturaSonido.silencio(true)
============================================================================= */
window.FracturaSonido = (function () {
  "use strict";
  const CLAVE = "fracturaSonido";
  let cfg = { vol: 0.6, mudo: false };
  try { cfg = Object.assign(cfg, JSON.parse(localStorage.getItem(CLAVE) || "{}")); } catch (e) { /* sin almacenamiento */ }
  const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(cfg)); } catch (e) { /* nada */ } };

  let ctx = null, salida = null, ruidoBuf = null;
  const ultimo = {};
  function listo() {
    if (cfg.mudo) return false;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { ctx = new AC(); } catch (e) { return false; }
      salida = ctx.createGain(); salida.gain.value = cfg.vol;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
      salida.connect(comp); comp.connect(ctx.destination);
      ruidoBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = ruidoBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx.state !== "closed";
  }
  // El navegador solo deja sonar después de un gesto: se despierta con el primer toque
  ["pointerdown", "keydown"].forEach(ev => window.addEventListener(ev, () => { if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {}); }, { passive: true }));

  /* Un tono: forma, frecuencia inicial y final, duración, volumen, retraso */
  function tono(tipo, f0, f1, dur, vol, cuando) {
    const t = ctx.currentTime + (cuando || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(salida); o.start(t); o.stop(t + dur + 0.02);
  }
  /* Un soplo de ruido filtrado: tipo de filtro, frecuencia inicial y final, duración, volumen, retraso */
  function soplo(filtro, f0, f1, dur, vol, cuando, q) {
    const t = ctx.currentTime + (cuando || 0);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = ruidoBuf; s.loop = true;
    f.type = filtro; f.Q.value = q || 1; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(salida); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  const EFECTOS = {
    clic() { tono("triangle", 620, 480, 0.05, 0.12); },
    elegir() { tono("triangle", 440, 660, 0.07, 0.14); tono("sine", 880, 880, 0.08, 0.05, 0.03); },
    soltar() { tono("triangle", 520, 360, 0.06, 0.1); },
    error() { tono("square", 160, 120, 0.12, 0.09); tono("square", 150, 110, 0.12, 0.07, 0.07); },
    paso() { soplo("lowpass", 520, 160, 0.06, 0.16); },
    golpe() { soplo("bandpass", 2400, 500, 0.11, 0.42, 0, 1.2); tono("sawtooth", 210, 70, 0.1, 0.18); tono("triangle", 1500, 900, 0.05, 0.08); },
    parada() { tono("triangle", 1900, 1500, 0.12, 0.2); tono("sine", 2850, 2700, 0.16, 0.1); soplo("highpass", 4000, 3000, 0.05, 0.12); },
    salpica() { soplo("bandpass", 1500, 500, 0.1, 0.2, 0, 2); },
    flecha() { soplo("bandpass", 900, 3200, 0.12, 0.2, 0, 3); tono("triangle", 180, 90, 0.05, 0.14, 0.12); },
    polvora() { soplo("lowpass", 3800, 200, 0.2, 0.7); tono("square", 120, 40, 0.14, 0.3); soplo("highpass", 2500, 5000, 0.3, 0.08, 0.05); },
    magia() { tono("sine", 520, 1340, 0.22, 0.16); tono("sine", 780, 2010, 0.22, 0.09, 0.03); soplo("bandpass", 3000, 6000, 0.18, 0.06, 0.02, 4); },
    explosion() { soplo("lowpass", 2600, 60, 0.6, 0.9); tono("sine", 90, 30, 0.5, 0.5); soplo("bandpass", 900, 300, 0.25, 0.3, 0.04); },
    muerte() { tono("sawtooth", 240, 60, 0.3, 0.16); soplo("lowpass", 900, 120, 0.3, 0.2); },
    cura() { tono("sine", 660, 660, 0.14, 0.12); tono("sine", 990, 990, 0.2, 0.1, 0.09); },
    consagra() { [523, 659, 784].forEach((f, i) => tono("sine", f, f, 0.5, 0.09, i * 0.07)); },
    nuevo() { tono("triangle", 330, 495, 0.1, 0.14); tono("triangle", 495, 660, 0.14, 0.12, 0.09); },
    recluta() { soplo("bandpass", 1800, 900, 0.05, 0.18, 0, 2); tono("triangle", 392, 392, 0.09, 0.14, 0.04); tono("triangle", 523, 523, 0.14, 0.14, 0.13); },
    obra() { [0, 0.12, 0.24].forEach(d => { soplo("bandpass", 1300, 700, 0.05, 0.3, d, 3); tono("square", 190, 150, 0.04, 0.1, d); }); },
    saber() { [587, 740, 880, 1175].forEach((f, i) => tono("sine", f, f, 0.22, 0.09, i * 0.06)); },
    captura() { [392, 523, 659].forEach((f, i) => tono("sawtooth", f, f, 0.16, 0.1, i * 0.09)); tono("triangle", 784, 784, 0.34, 0.14, 0.27); },
    heroe() { tono("sine", 98, 98, 1.0, 0.3); [196, 294, 392, 587].forEach((f, i) => tono("sawtooth", f, f, 0.7 - i * 0.1, 0.07, i * 0.11)); soplo("bandpass", 600, 4000, 0.8, 0.1, 0, 2); },
    turno() { tono("triangle", 392, 392, 0.14, 0.14); tono("triangle", 587, 587, 0.24, 0.14, 0.12); },
    turnoRival() { tono("triangle", 330, 330, 0.12, 0.09); tono("triangle", 247, 247, 0.2, 0.09, 0.1); },
    aviso() { tono("sine", 880, 880, 0.1, 0.1); tono("sine", 1175, 1175, 0.16, 0.08, 0.08); },
    victoria() { [392, 523, 659, 784, 1047].forEach((f, i) => { tono("sawtooth", f, f, 0.32, 0.09, i * 0.13); tono("triangle", f * 2, f * 2, 0.32, 0.05, i * 0.13); }); tono("sine", 131, 131, 1.4, 0.24, 0.5); },
    derrota() { [392, 349, 311, 233].forEach((f, i) => tono("sawtooth", f, f * 0.97, 0.5, 0.09, i * 0.22)); tono("sine", 73, 55, 1.6, 0.3, 0.4); }
  };
  // Para que una ráfaga de pasos o golpes simultáneos no sature
  const MINIMO = { paso: 70, golpe: 60, salpica: 50, clic: 40, muerte: 90, cura: 60 };

  function tocar(nombre) {
    const f = EFECTOS[nombre];
    if (!f || !listo()) return;
    const ahora = performance.now();
    if (ahora - (ultimo[nombre] || 0) < (MINIMO[nombre] || 30)) return;
    ultimo[nombre] = ahora;
    try { f(); } catch (e) { /* un efecto que falla no rompe el juego */ }
  }
  function volumen(v) { if (v === undefined) return cfg.vol; cfg.vol = Math.max(0, Math.min(1, v)); if (salida) salida.gain.value = cfg.vol; guardar(); return cfg.vol; }
  function silencio(si) { if (si === undefined) return cfg.mudo; cfg.mudo = !!si; guardar(); return cfg.mudo; }

  return { tocar, volumen, silencio };
})();
