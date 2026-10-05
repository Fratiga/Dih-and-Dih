/* Parranda: mapas de cuatro carriles. El tempo, el pulso y el momento de cada nota salen del mismo
   análisis que usa Zarabanda (ritmo-analisis.js), así que los dos juegos siguen la canción igual.
   Aquí solo se reparten las notas en cuatro carriles según el tono (la melodía sube y baja) y se
   pasa a y desde el formato guardado. Los carriles no son de ningún instrumento: cada mapa decide
   qué sigue (guitarra, bajo, batería, voz...). Lo usan parranda.html y parranda-editor.html.
   Una nota es { t, carril: 0..3, dur }. Un acorde son notas con el mismo t y carriles distintos. */
(function () {
  "use strict";

  const base = window.RitmoAnalisis;
  const { HOP, DIFICULTADES, pulsoDe, bandas, ataques, maximoMovil } = base;
  const CARRILES = 4;

  /* Reparte los carriles. Cada nota se coloca según dónde cae su tono entre los de las notas que la
     rodean (cuartil más grave = carril 0, más agudo = carril 3), así la melodía sube y baja. Un
     tono repetido se queda en su carril, ninguna racha pasa del máximo, los saltos se limitan en
     las dificultades bajas y no cae una nota en un carril donde hay una larga sonando. */
  function repartir(notas2, dificultad) {
    const n = notas2.length;
    const tono = notas2.map(x => (typeof x.tono === "number" && isFinite(x.tono) ? x.tono : null));
    const maxRacha = dificultad === "facil" ? 3 : 2;
    const maxSalto = dificultad === "facil" || dificultad === "normal" ? 2 : 3;
    const libreHasta = [-1, -1, -1, -1];
    const salida = [];
    let previo = -1;
    let racha = 0;
    let tonoPrevio = null;

    const cuartil = i => {
      if (tono[i] === null) return previo >= 0 ? previo : 1;
      const v = [];
      for (let k = Math.max(0, i - 12); k <= Math.min(n - 1, i + 12); k++) if (tono[k] !== null) v.push(tono[k]);
      v.sort((x, y) => x - y);
      // Rango de los tonos cercanos sin los extremos (10 % y 90 %), con un mínimo para que una
      // melodía casi plana no reparta ruido entre carriles
      const lo = v[Math.floor(0.1 * (v.length - 1))];
      const hi = v[Math.ceil(0.9 * (v.length - 1))];
      const centro = (lo + hi) / 2;
      const medio = Math.max(hi - lo, 0.3) / 2;
      const f = Math.max(0, Math.min(0.999, (tono[i] - (centro - medio)) / (2 * medio)));
      return Math.floor(f * CARRILES);
    };

    const libres = t => [0, 1, 2, 3].filter(c => t > libreHasta[c] + 0.06);
    const masCercano = (c, lista) => lista.slice().sort((a, b) => Math.abs(a - c) - Math.abs(b - c) || a - b)[0];

    for (let i = 0; i < n; i++) {
      const nt = notas2[i];
      const acorde = nt.carril === "ambos";
      const disponibles = libres(nt.t);
      if (!disponibles.length) continue;
      let c = cuartil(i);
      // Mismo tono que la nota anterior: mismo carril (una repetición)
      if (previo >= 0 && tono[i] !== null && tonoPrevio !== null && Math.abs(tono[i] - tonoPrevio) < 0.04) c = previo;
      // Saltos grandes, solo en dificultades altas
      if (previo >= 0 && Math.abs(c - previo) > maxSalto) c = previo + Math.sign(c - previo) * maxSalto;
      // Rachas
      if (c === previo && racha >= maxRacha) c = masCercano(c <= 1 ? c + 1 : c - 1, [0, 1, 2, 3].filter(x => x !== c));
      if (!disponibles.includes(c)) c = masCercano(c, disponibles);
      if (c === previo) racha++; else { racha = 1; previo = c; }
      tonoPrevio = tono[i];
      if (acorde) {
        const pareja = masCercano(c < 3 ? c + 1 : c - 1, disponibles.filter(x => x !== c));
        if (pareja !== undefined) {
          salida.push({ t: nt.t, carril: Math.min(c, pareja), dur: 0 });
          salida.push({ t: nt.t, carril: Math.max(c, pareja), dur: 0 });
          racha = 0; previo = -1;
          continue;
        }
      }
      const dur = nt.dur > 0 ? nt.dur : 0;
      salida.push({ t: nt.t, carril: c, dur });
      if (dur > 0) libreHasta[c] = nt.t + dur;
    }
    return salida;
  }

  /* Igual que RitmoAnalisis.crearMapa (mismas opciones y misma forma de resultado) pero con
     las notas en cuatro carriles. */
  function crearMapa(buffer, dificultad, opciones = {}) {
    const m = base.crearMapa(buffer, dificultad, opciones);
    m.notas = repartir(m.notas, dificultad);
    return m;
  }

  /* Formato guardado (tabla parranda_mapas): notas como [t, carril 0..3, duración] */
  function guardable(notas, pulsos) {
    return {
      v: 2,
      notas: notas.map(n => [Math.round(n.t * 1000) / 1000, n.carril, Math.floor((n.dur || 0) * 100 + 1e-6) / 100]),
      pulsos: pulsos.map(t => Math.round(t * 1000) / 1000)
    };
  }

  function desdeGuardado(guardado, buffer) {
    const sr = buffer.sampleRate;
    const n = Math.floor(buffer.length / HOP);
    // El mapa puede traer un desfase propio (ms) para canciones cuyo audio está corrido
    const desfase = (Number(guardado.offset) || 0) / 1000;
    const pulsosMapa = (guardado.pulsos || []).map(p => p + desfase);
    const notas = guardado.notas
      .map(g => ({ t: g[0] + desfase, carril: Math.max(0, Math.min(CARRILES - 1, g[1] | 0)), dur: g[2] || 0 }))
      .sort((a, b) => a.t - b.t || a.carril - b.carril);
    return { notas, pulso: pulsoDe(pulsosMapa, n, sr / HOP), dur: buffer.duration, sr, pulsos: pulsosMapa, tramos: [], bpm: [], n, fps: sr / HOP };
  }

  /* Agrupa las notas en golpes: las que caen a la vez (un acorde) son uno solo. */
  function golpes(notas) {
    const lista = [];
    notas.slice().sort((a, b) => a.t - b.t || a.carril - b.carril).forEach(n => {
      const ult = lista[lista.length - 1];
      if (ult && Math.abs(ult.t - n.t) < 0.02) ult.notas.push(n); else lista.push({ t: n.t, notas: [n] });
    });
    return lista;
  }

  /* Estilo de un mapa hecho a mano entre t0 y t1, para completar el resto "con la misma mano":
     golpes por segundo, fracción de largas y cada cuánto hay un acorde. */
  function estiloDe(notas, t0, t1) {
    const dentro = notas.filter(n => n.t >= t0 && n.t < t1);
    const dur = Math.max(1, t1 - t0);
    if (dentro.length < 20) return null;
    const g = golpes(dentro);
    const acordes = g.filter(x => x.notas.length > 1).length;
    const largas = dentro.filter(n => n.dur > 0).length;
    return {
      nps: Math.round((g.length / dur) * 100) / 100,
      corte: 0.02,
      maxRacha: 3,
      fraccionLargas: Math.round((largas / dentro.length) * 1000) / 1000,
      huecoDobleS: acordes ? Math.max(0.8, (dur / acordes) * 0.7) : 6
    };
  }

  window.ParrandaAnalisis = { HOP, CARRILES, DIFICULTADES, crearMapa, repartir, pulsoDe, guardable, desdeGuardado, estiloDe, golpes, bandas, ataques, maximoMovil };
})();
