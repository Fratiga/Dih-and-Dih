/* =============================================================================
   HIPÓDROMO: los sonidos de la interfaz. Todos se sintetizan en el momento (Web Audio), sin archivos: golpes de madera
   para los carteles, papel para pasar de sección, el sello del boleto, las monedas del premio, la campana de salida y
   el tic del cierre de apuestas. Son cortos y bajos. Se apagan con el botón del marcador (se recuerda en el navegador)
   y no suenan con la pestaña en segundo plano ni antes de que el jugador haya tocado algo.
============================================================================= */
window.HipodromoSonido = (function () {
  "use strict";
  const CLAVE = "hipodromoSonido";
  let ctx = null, salida = null, activo = true, tocado = false;
  try { activo = localStorage.getItem(CLAVE) !== "0"; } catch (e) { /* sin almacenamiento */ }
  const despertar = () => { tocado = true; if (ctx && ctx.state === "suspended") ctx.resume(); };
  ["pointerdown", "keydown"].forEach(t => window.addEventListener(t, despertar, { passive: true }));

  function listo() {
    if (!activo || !tocado || document.hidden) return false;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      try { ctx = new AC(); salida = ctx.createGain(); salida.gain.value = 0.5; salida.connect(ctx.destination); } catch (e) { ctx = null; return false; }
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }
  /* una nota: tipo de onda, de qué frecuencia a cuál, cuánto dura y con qué volumen */
  function nota(tipo, f0, f1, dur, vol, cuando) {
    const t = ctx.currentTime + (cuando || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(salida); o.start(t); o.stop(t + dur + 0.02);
  }
  /* un soplo de ruido filtrado (papel, golpe sordo) */
  function ruido(dur, vol, frec, q, cuando, tipo) {
    const t = ctx.currentTime + (cuando || 0), n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; f.type = tipo || "bandpass"; f.frequency.value = frec; f.Q.value = q || 1;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(salida); s.start(t);
  }
  const SONIDOS = {
    madera: () => { nota("triangle", 420, 180, 0.07, 0.16); ruido(0.04, 0.12, 1400, 2); },                       // un cartel o un botón
    roce: () => { nota("triangle", 700, 520, 0.035, 0.035); },                                                     // pasar por encima de un cartel
    papel: () => { ruido(0.16, 0.14, 3200, 0.7); ruido(0.1, 0.07, 5200, 0.9, 0.05); },                             // cambiar de sección
    carta: () => { ruido(0.09, 0.16, 2200, 0.8); nota("triangle", 240, 150, 0.08, 0.08, 0.02); },                  // abrir una ficha
    sello: () => { nota("sine", 150, 48, 0.2, 0.5); ruido(0.07, 0.3, 500, 0.8, 0, "lowpass"); },                   // el boleto, apostado
    monedas: () => { [0, 0.07, 0.13, 0.2, 0.29, 0.36].forEach((c, i) => nota("triangle", 2100 + (i % 3) * 420, 1900 + (i % 3) * 400, 0.12, 0.09, c)); },
    pierde: () => { nota("triangle", 300, 140, 0.32, 0.12); ruido(0.2, 0.08, 900, 0.7, 0.02); },
    campana: () => { [1, 2.76, 5.4, 8.9].forEach((p, i) => nota("sine", 620 * p, 620 * p, 1.5 / (1 + i * 0.7), 0.2 / (1 + i * 1.4))); [0.34].forEach(c => [1, 2.76, 5.4].forEach((p, i) => nota("sine", 620 * p, 620 * p, 1.3 / (1 + i * 0.7), 0.16 / (1 + i * 1.4), c))); },
    cierre: () => { nota("square", 520, 390, 0.16, 0.05); nota("square", 390, 300, 0.2, 0.05, 0.16); },            // se cierran las apuestas
    tic: () => { nota("square", 1500, 1500, 0.025, 0.035); },
    llegada: () => { [0, 0.11, 0.22].forEach((c, i) => nota("triangle", [523, 659, 784][i], [523, 659, 784][i], 0.22, 0.11, c)); },
    ovacion: () => { ruido(0.9, 0.12, 1200, 0.5); ruido(0.7, 0.07, 2600, 0.6, 0.1); },
    hora: () => { nota("sine", 880, 880, 0.9, 0.14); nota("sine", 660, 660, 1.1, 0.12, 0.3); }
  };
  function tocar(nombre) { if (!SONIDOS[nombre] || !listo()) return; try { SONIDOS[nombre](); } catch (e) { /* sin sonido */ } }
  function poner(si) { activo = !!si; try { localStorage.setItem(CLAVE, activo ? "1" : "0"); } catch (e) { /* sin almacenamiento */ } if (activo) { tocado = true; tocar("madera"); } }
  return { tocar, poner, activo: () => activo };
})();
