/* Lógica pura del editor de mapas de Parranda (sin página): revisar un mapa, derivar una dificultad
   desde otra, tempo (BPM y toques) y densidad. Trabaja con listas de notas { t, carril 0..3, dur } y
   de pulsos (s). Las notas que caen a la vez (un acorde) cuentan como un solo golpe para el ritmo. */
(function () {
  "use strict";

  const AN = window.ParrandaAnalisis;
  const CARRILES = AN.CARRILES;
  const ORDEN = ["facil", "normal", "dificil", "experto"];
  const NOMBRE = { facil: "Fácil", normal: "Normal", dificil: "Difícil", experto: "Experto" };

  /* Índice del último pulso que no pasa de t (o -1 si t va antes del primero) */
  function indicePulso(pulsos, t) {
    let a = 0;
    let b = pulsos.length;
    while (a < b) { const m = (a + b) >> 1; if (pulsos[m] <= t) a = m + 1; else b = m; }
    return a - 1;
  }

  /* Posición de t en pulsos (con decimales) */
  function enPulsos(pulsos, t) {
    if (pulsos.length < 2) return t * 2;
    const k = Math.max(0, Math.min(pulsos.length - 2, indicePulso(pulsos, t)));
    return k + (t - pulsos[k]) / (pulsos[k + 1] - pulsos[k]);
  }

  /* Instante (s) de una posición en pulsos */
  function deBeat(pulsos, b) {
    if (pulsos.length < 2) return b / 2;
    const k = Math.max(0, Math.min(pulsos.length - 2, Math.floor(b)));
    return pulsos[k] + (b - k) * (pulsos[k + 1] - pulsos[k]);
  }

  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  /* Nivel de un mapa, de 1 a 15, a partir de la densidad, los picos, los acordes y las largas.
     Sirve para comparar mapas entre sí, no es una medida exacta. */
  function nivel(st) {
    const total = Math.max(1, st.golpes);
    const v = 1 + st.npsMedio * 1.3 + Math.max(0, st.picoNps - st.npsMedio) * 0.5 + (st.acordes / total) * 8 + (st.largas / Math.max(1, st.total)) * 3;
    return Math.round(Math.max(1, Math.min(15, v)) * 10) / 10;
  }

  /* --- Revisión --------------------------------------------------------------------------------- */
  function revisar(notasEntrada, pulsos, dur, dificultad) {
    const cfg = AN.DIFICULTADES[dificultad] || AN.DIFICULTADES.normal;
    const notas = notasEntrada.slice().sort((a, b) => a.t - b.t || a.carril - b.carril);
    const golpes = AN.golpes(notas);
    const problemas = [];
    const poner = (nivel, t, texto) => problemas.push({ nivel, t, texto });

    // Largas contra la nota siguiente de su carril
    notas.forEach((n, i) => {
      if (!(n.dur > 0)) return;
      for (let j = i + 1; j < notas.length; j++) {
        if (notas[j].carril === n.carril) {
          if (notas[j].t < n.t + n.dur + 0.185) poner("error", n.t, `La larga de ${fmt(n.t)} (carril ${n.carril + 1}) pisa la nota siguiente de su carril.`);
          break;
        }
      }
    });

    // Notas encimadas en un mismo carril
    const ultimo = [-9, -9, -9, -9];
    notas.forEach(n => {
      if (n.t - ultimo[n.carril] < 0.09) poner("error", n.t, `Dos notas casi encimadas en ${fmt(n.t)} (carril ${n.carril + 1}).`);
      ultimo[n.carril] = n.t;
    });

    // Acordes de tres o cuatro notas: difíciles de pulsar con una mano
    golpes.forEach(g => {
      if (g.notas.length >= 3) poner("aviso", g.t, `Acorde de ${g.notas.length} notas en ${fmt(g.t)}: pide ${g.notas.length} dedos a la vez.`);
    });

    // Fuera de la canción
    notas.forEach(n => {
      if (n.t < 0.3) poner("aviso", n.t, `Una nota está al principio de todo (${n.t.toFixed(2)} s): no da tiempo a verla venir.`);
      if (dur && n.t > dur - 0.2) poner("aviso", n.t, `Una nota cae casi al final de la canción (${fmt(n.t)}).`);
    });

    // Densidad: ventanas de 4 s (cada acorde cuenta como un golpe)
    let picoNps = 0;
    const avisadas = [];
    for (let i = 0; i < golpes.length; i++) {
      let j = i;
      while (j < golpes.length && golpes[j].t - golpes[i].t < 4) j++;
      const nps = (j - i) / 4;
      if (nps > picoNps) picoNps = nps;
      if (nps > cfg.nps * 1.7 && !avisadas.some(t => Math.abs(t - golpes[i].t) < 6)) {
        avisadas.push(golpes[i].t);
        poner("aviso", golpes[i].t, `Muy cargado en ${fmt(golpes[i].t)}: ${nps.toFixed(1)} golpes por segundo (lo normal en ${NOMBRE[dificultad] || dificultad} son unos ${cfg.nps}).`);
      }
    }

    // Rachas en un mismo carril
    let racha = 0;
    let rachaMax = 0;
    let previo = null;
    let inicioRacha = 0;
    const rachasAvisadas = [];
    golpes.forEach(g => {
      if (g.notas.length > 1) { racha = 0; previo = null; return; }
      const c = g.notas[0].carril;
      if (c === previo) racha++; else { racha = 1; previo = c; inicioRacha = g.t; }
      if (racha > rachaMax) rachaMax = racha;
      if (racha === 6) rachasAvisadas.push(inicioRacha);
    });
    rachasAvisadas.slice(0, 6).forEach(t => poner("aviso", t, `Racha larga en un mismo carril desde ${fmt(t)} (6 o más notas seguidas).`));

    // Huecos largos sin notas
    let huecoMax = 0;
    for (let i = 1; i < notas.length; i++) {
      const hueco = notas[i].t - (notas[i - 1].t + Math.max(0, notas[i - 1].dur || 0));
      if (hueco > huecoMax) huecoMax = hueco;
      if (hueco > 12) poner("aviso", notas[i - 1].t, `Hueco de ${Math.round(hueco)} s sin notas desde ${fmt(notas[i - 1].t)}.`);
    }

    // Fuera de la cuadrícula (cuartos de pulso)
    let fuera = 0;
    if (pulsos.length > 1) {
      notas.forEach(n => {
        const b = enPulsos(pulsos, n.t) * 4;
        if (Math.abs(b - Math.round(b)) > 0.16) fuera++;
      });
      if (notas.length && fuera / notas.length > 0.15) poner("info", 0, `${fuera} notas (${Math.round((fuera / notas.length) * 100)} %) no caen en la cuadrícula del pulso. Puedes usar «Cuantizar».`);
    }

    const duracion = dur || (notas.length ? notas[notas.length - 1].t : 0);
    const stats = {
      total: notas.length,
      golpes: golpes.length,
      npsMedio: duracion ? Math.round((golpes.length / duracion) * 100) / 100 : 0,
      picoNps: Math.round(picoNps * 10) / 10,
      acordes: golpes.filter(g => g.notas.length > 1).length,
      largas: notas.filter(n => n.dur > 0).length,
      carriles: [0, 1, 2, 3].map(c => notas.filter(n => n.carril === c).length),
      rachaMax,
      huecoMax: Math.round(huecoMax),
      fueraDeRejilla: fuera
    };
    stats.nivel = nivel(stats);
    const peso = { error: 0, aviso: 1, info: 2 };
    problemas.sort((a, b) => peso[a.nivel] - peso[b.nivel] || a.t - b.t);
    return { stats, problemas };
  }

  /* --- Derivar una dificultad desde otra -------------------------------------------------------- */
  function limpiarLargas(notas) {
    notas.sort((a, b) => a.t - b.t || a.carril - b.carril);
    for (let i = 0; i < notas.length; i++) {
      const n = notas[i];
      if (!(n.dur > 0)) { n.dur = 0; continue; }
      for (let j = i + 1; j < notas.length; j++) {
        if (notas[j].carril === n.carril) {
          const tope = notas[j].t - 0.2 - n.t;
          if (n.dur > tope) n.dur = tope >= 0.3 ? Math.floor(tope * 100) / 100 : 0;
          break;
        }
      }
    }
  }

  /* Que no queden más de "max" golpes seguidos en un mismo carril: el que se pasa se mueve a un carril
     vecino si cabe (sin chocar con otra nota ni con una larga). */
  function romperRachas(notas, max) {
    notas.sort((a, b) => a.t - b.t || a.carril - b.carril);
    const g = AN.golpes(notas);
    let racha = 0;
    let prev = null;
    g.forEach(grupo => {
      if (grupo.notas.length > 1) { racha = 0; prev = null; return; }
      const n = grupo.notas[0];
      if (n.carril === prev) racha++; else { racha = 1; prev = n.carril; }
      if (racha > max && !(n.dur > 0)) {
        const opciones = [n.carril + 1, n.carril - 1].filter(c => c >= 0 && c < CARRILES);
        const libre = opciones.find(c =>
          !notas.some(o => o !== n && o.carril === c && Math.abs(o.t - n.t) < 0.12)
          && !notas.some(o => o.dur > 0 && o.carril === c && n.t > o.t - 0.01 && n.t < o.t + o.dur + 0.01));
        if (libre !== undefined) { n.carril = libre; prev = libre; racha = 1; }
      }
    });
  }

  /* Hacia una dificultad más fácil: se queda con los golpes que caen en la cuadrícula permitida, los
     más "en tiempo" primero, y reparte la densidad de forma pareja para no perder el ritmo. */
  function simplificar(origen, pulsos, dur, destino) {
    const cfg = AN.DIFICULTADES[destino];
    const copia = origen.map(n => ({ t: n.t, carril: n.carril, dur: n.dur || 0 }));
    let golpes = AN.golpes(copia).map(g => ({ t: g.t, notas: g.notas }));
    if (!golpes.length) return [];
    const nivelMax = cfg.sub === 1 ? 0 : cfg.sub === 2 ? 1 : 2;

    const nivelDe = t => {
      const b = enPulsos(pulsos, t);
      const f = b - Math.floor(b);
      const d = x => Math.min(Math.abs(f - x), Math.abs(f - x - 1), Math.abs(f - x + 1));
      if (d(0) < 0.07) return 0;
      if (d(0.5) < 0.07) return 1;
      if (d(0.25) < 0.07 || d(0.75) < 0.07) return 2;
      return 3;
    };
    golpes.forEach(g => { g.nivel = nivelDe(g.t); g.beat = enPulsos(pulsos, g.t); });
    const prioridad = g => (g.nivel === 0 ? 30 : g.nivel === 1 ? 20 : g.nivel === 2 ? 10 : 0)
      + (g.notas.some(n => n.dur > 0) ? 4 : 0) + (g.notas.length > 1 ? 3 : 0) - (g.nivel > nivelMax ? 25 : 0);

    // Cuántos golpes deben quedar y cuántos por ventana de 2 pulsos
    const largo = Math.max(1, (golpes[golpes.length - 1].t - golpes[0].t) || dur || 1);
    const objetivo = Math.min(golpes.length, Math.round(largo * cfg.nps * 0.95));
    const razon = objetivo / golpes.length;
    let conservados = golpes;
    if (razon < 1) {
      const ventanas = new Map();
      golpes.forEach(g => { const k = Math.floor(g.beat / 2); if (!ventanas.has(k)) ventanas.set(k, []); ventanas.get(k).push(g); });
      conservados = [];
      let deuda = 0;
      [...ventanas.keys()].sort((a, b) => a - b).forEach(k => {
        const lista = ventanas.get(k);
        const cuota = lista.length * razon + deuda;
        const cupo = Math.min(lista.length, Math.max(cuota >= 0.5 ? 1 : 0, Math.round(cuota)));
        deuda = cuota - cupo;
        lista.slice().sort((a, b) => prioridad(b) - prioridad(a) || a.t - b.t).slice(0, cupo).forEach(g => conservados.push(g));
      });
      conservados.sort((a, b) => a.t - b.t);
    }

    // Lo que quedó fuera de la cuadrícula permitida se pega a ella o se descarta
    const paso = 1 / cfg.sub;
    const finales = [];
    conservados.forEach(g => {
      if (g.nivel > nivelMax) {
        const b = Math.round(g.beat / paso) * paso;
        const t = deBeat(pulsos, b);
        if (finales.some(o => Math.abs(o.t - t) < 0.06) || conservados.some(o => o !== g && Math.abs(o.t - t) < 0.06)) return;
        g.t = t;
      }
      finales.push(g);
    });
    golpes = finales.sort((a, b) => a.t - b.t);

    // Separación mínima entre golpes
    const separados = [];
    golpes.forEach(g => {
      const ult = separados[separados.length - 1];
      if (ult && g.t - ult.t < cfg.hueco) {
        if (prioridad(g) > prioridad(ult)) separados[separados.length - 1] = g;
        return;
      }
      separados.push(g);
    });
    golpes = separados;

    // Acordes y largas solo donde la dificultad las tiene
    const notas = [];
    golpes.forEach(g => {
      let lista = g.notas.slice();
      if (!cfg.dobles && lista.length > 1) {
        // Se queda una sola nota: la larga si hay, y si no la del carril más cercano al centro
        lista = [lista.find(n => n.dur > 0) || lista.slice().sort((a, b) => Math.abs(a.carril - 1.5) - Math.abs(b.carril - 1.5))[0]];
      }
      lista.forEach(n => notas.push({ t: Math.round(g.t * 1000) / 1000, carril: n.carril, dur: cfg.largas > 0 ? n.dur : 0 }));
    });

    romperRachas(notas, destino === "facil" ? 4 : 3);
    limpiarLargas(notas);
    return notas.map(n => ({ t: Math.round(n.t * 1000) / 1000, carril: n.carril, dur: n.dur }));
  }

  /* Hacia una dificultad más difícil: se conservan todas las notas hechas a mano y se añaden los golpes
     que generaría el motor (con el estilo de ese mapa) donde queda sitio. */
  function enriquecer(origen, pulsos, buffer, destino) {
    const cfg = AN.DIFICULTADES[destino];
    const base = origen.map(n => ({ t: n.t, carril: n.carril, dur: n.dur || 0 })).sort((a, b) => a.t - b.t);
    const propio = AN.estiloDe(base, 0, buffer.duration) || {};
    const largasMin = destino === "experto" ? 0.15 : destino === "dificil" ? 0.1 : 0;
    const estilo = Object.assign({}, propio, {
      nps: Math.max(propio.nps || 0, cfg.nps * 0.85),
      maxRacha: 3,
      fraccionLargas: Math.max(propio.fraccionLargas || 0, largasMin),
      huecoDobleS: propio.huecoDobleS || (destino === "experto" ? 1.6 : 3.2),
      corte: 0.05
    });
    const auto = AN.golpes(AN.crearMapa(buffer, destino, { pulsos, estilo }).notas);
    const salida = base.slice();
    const presupuesto = Math.round(buffer.duration * cfg.nps * 0.95);
    let golpesActuales = AN.golpes(salida).length;
    auto.forEach(g => {
      if (golpesActuales >= presupuesto) return;
      if (salida.some(n => Math.abs(n.t - g.t) < cfg.hueco)) return;
      const bajoLarga = g.notas.some(a => salida.some(n => n.dur > 0 && a.t > n.t - 0.01 && a.t < n.t + n.dur + 0.2 && n.carril === a.carril));
      if (bajoLarga) return;
      g.notas.forEach(a => salida.push({ t: a.t, carril: a.carril, dur: a.dur || 0 }));
      golpesActuales++;
    });
    salida.sort((a, b) => a.t - b.t || a.carril - b.carril);
    romperRachas(salida, 3);
    limpiarLargas(salida);
    return salida.map(n => ({ t: Math.round(n.t * 1000) / 1000, carril: n.carril, dur: n.dur }));
  }

  function derivar(origen, pulsos, buffer, difOrigen, difDestino) {
    const subida = ORDEN.indexOf(difDestino) > ORDEN.indexOf(difOrigen);
    if (difOrigen === difDestino) return origen.map(n => ({ t: n.t, carril: n.carril, dur: n.dur || 0 }));
    return subida ? enriquecer(origen, pulsos, buffer, difDestino) : simplificar(origen, pulsos, buffer.duration, difDestino);
  }

  /* --- Traer un mapa de Zarabanda (dos carriles) a Parranda (cuatro) ----------------------------------- */
  /* Cada nota se reparte entre los cuatro carriles según el tono de la melodía en ese instante (el mismo
     reparto del mapa automático); las dobles se vuelven acordes y las largas se conservan. Hace falta el audio
     ya cargado para medir el tono. */
  function desdeZarabanda(notas2, buffer, dificultad) {
    const orden = notas2.map(n => ({ t: n.t, carril: n.carril, dur: n.dur || 0 })).sort((a, b) => a.t - b.t);
    const tonos = window.RitmoAnalisis.tonosDe(buffer, orden.map(n => n.t));
    orden.forEach((n, i) => { n.tono = tonos[i]; });
    return AN.repartir(orden, dificultad).map(n => ({ t: Math.round(n.t * 1000) / 1000, carril: n.carril, dur: n.dur }));
  }

  /* --- Tempo ---------------------------------------------------------------------------------------- */
  /* BPM a partir de los instantes de unos toques (s), con la mediana de los intervalos */
  function bpmDeToques(toques) {
    if (toques.length < 4) return null;
    const iv = [];
    for (let i = 1; i < toques.length; i++) iv.push(toques[i] - toques[i - 1]);
    iv.sort((a, b) => a - b);
    const mediana = iv[Math.floor(iv.length / 2)];
    if (!(mediana > 0.2 && mediana < 2)) return null;
    return Math.round((60 / mediana) * 10) / 10;
  }

  /* Pulsos de siempre hasta justo antes del ancla y, desde ella, un pulso cada 60/bpm hasta el final */
  function pulsosDesdeAncla(pulsos, ancla, bpm, duracion) {
    const periodo = 60 / bpm;
    const antes = pulsos.filter(p => p < ancla - periodo / 2);
    const nuevos = [];
    for (let t = ancla; t < duracion + periodo; t += periodo) nuevos.push(Math.round(t * 1000) / 1000);
    return antes.concat(nuevos);
  }

  /* Cuántas notas hay en cada tramo de binS segundos */
  function densidad(notas, duracion, binS) {
    const n = Math.max(1, Math.ceil(duracion / binS));
    const bins = new Float32Array(n);
    notas.forEach(x => { const k = Math.min(n - 1, Math.max(0, Math.floor(x.t / binS))); bins[k]++; });
    return bins;
  }

  window.ParrandaLogica = { desdeZarabanda, nivel, revisar, derivar, simplificar, enriquecer, bpmDeToques, pulsosDesdeAncla, densidad, limpiarLargas, ORDEN, NOMBRE };
})();
