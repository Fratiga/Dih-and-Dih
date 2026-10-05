/* Lógica pura del editor de mapas (sin página): revisar un mapa, derivar una dificultad desde otra,
   tempo (BPM y toques) y densidad. Trabaja con listas de notas { t, carril, dur } y de pulsos (s). */
(function () {
  "use strict";

  const AN = window.RitmoAnalisis;
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

  /* Nivel de un mapa, de 1 a 15, a partir de la densidad, los picos, las dobles y las largas.
     Sirve para comparar mapas entre sí, no es una medida exacta. */
  function nivel(st) {
    const total = Math.max(1, st.total);
    const v = 1 + st.npsMedio * 1.4 + Math.max(0, st.picoNps - st.npsMedio) * 0.5 + (st.dobles / total) * 8 + (st.largas / total) * 3;
    return Math.round(Math.max(1, Math.min(15, v)) * 10) / 10;
  }

  /* --- Revisión --------------------------------------------------------------------------------- */
  function revisar(notasEntrada, pulsos, dur, dificultad) {
    const cfg = AN.DIFICULTADES[dificultad] || AN.DIFICULTADES.normal;
    const notas = notasEntrada.slice().sort((a, b) => a.t - b.t);
    const problemas = [];
    const poner = (nivel, t, texto) => problemas.push({ nivel, t, texto });

    // Largas contra la nota siguiente de su carril y dobles dentro de una larga
    const largas = notas.filter(n => n.dur > 0 && n.carril !== "ambos");
    notas.forEach((n, i) => {
      if (n.dur > 0 && n.carril !== "ambos") {
        for (let j = i + 1; j < notas.length; j++) {
          if (notas[j].carril === n.carril || notas[j].carril === "ambos") {
            if (notas[j].t < n.t + n.dur + 0.185) poner("error", n.t, `La larga de ${fmt(n.t)} pisa la nota siguiente de su carril.`);
            break;
          }
        }
      }
      if (n.carril === "ambos") {
        const dentro = largas.find(l => l.t <= n.t + 1e-6 && n.t < l.t + l.dur);
        if (dentro) poner("error", n.t, `Hay una doble en ${fmt(n.t)} dentro de una larga: no se puede pulsar.`);
      }
    });

    // Notas encimadas en un mismo carril
    const ultimo = { arriba: -9, abajo: -9 };
    notas.forEach(n => {
      const carriles = n.carril === "ambos" ? ["arriba", "abajo"] : [n.carril];
      carriles.forEach(c => {
        if (n.t - ultimo[c] < 0.09) poner("error", n.t, `Dos notas casi encimadas en ${fmt(n.t)} (${c === "arriba" ? "arriba" : "abajo"}).`);
        ultimo[c] = n.t;
      });
    });

    // Fuera de la canción
    notas.forEach(n => {
      if (n.t < 0.3) poner("aviso", n.t, `Una nota está al principio de todo (${n.t.toFixed(2)} s): no da tiempo a verla venir.`);
      if (dur && n.t > dur - 0.2) poner("aviso", n.t, `Una nota cae casi al final de la canción (${fmt(n.t)}).`);
    });

    // Densidad: ventanas de 4 s
    let picoNps = 0;
    const avisadas = [];
    for (let i = 0; i < notas.length; i++) {
      let j = i;
      while (j < notas.length && notas[j].t - notas[i].t < 4) j++;
      const nps = (j - i) / 4;
      if (nps > picoNps) picoNps = nps;
      if (nps > cfg.nps * 1.7 && !avisadas.some(t => Math.abs(t - notas[i].t) < 6)) {
        avisadas.push(notas[i].t);
        poner("aviso", notas[i].t, `Muy cargado en ${fmt(notas[i].t)}: ${nps.toFixed(1)} notas por segundo (lo normal en ${NOMBRE[dificultad] || dificultad} son unas ${cfg.nps}).`);
      }
    }

    // Rachas en un mismo carril
    let racha = 0;
    let rachaMax = 0;
    let previo = null;
    let inicioRacha = 0;
    const rachasAvisadas = [];
    notas.forEach(n => {
      if (n.carril === "ambos") { racha = 0; previo = null; return; }
      if (n.carril === previo) racha++; else { racha = 1; previo = n.carril; inicioRacha = n.t; }
      if (racha > rachaMax) rachaMax = racha;
      if (racha === 5) rachasAvisadas.push(inicioRacha);
    });
    rachasAvisadas.slice(0, 6).forEach(t => poner("aviso", t, `Racha larga en un mismo carril desde ${fmt(t)} (5 o más notas seguidas).`));

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
      npsMedio: duracion ? Math.round((notas.length / duracion) * 100) / 100 : 0,
      picoNps: Math.round(picoNps * 10) / 10,
      dobles: notas.filter(n => n.carril === "ambos").length,
      largas: notas.filter(n => n.dur > 0).length,
      arriba: notas.filter(n => n.carril === "arriba").length,
      abajo: notas.filter(n => n.carril === "abajo").length,
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
    notas.sort((a, b) => a.t - b.t);
    for (let i = 0; i < notas.length; i++) {
      const n = notas[i];
      if (n.carril === "ambos") n.dur = 0;
      if (!(n.dur > 0)) { n.dur = 0; continue; }
      for (let j = i + 1; j < notas.length; j++) {
        if (notas[j].carril === n.carril || notas[j].carril === "ambos") {
          const tope = notas[j].t - 0.2 - n.t;
          if (n.dur > tope) n.dur = tope >= 0.3 ? Math.floor(tope * 100) / 100 : 0;
          break;
        }
      }
    }
  }

  /* Hacia una dificultad más fácil: se queda con las notas que caen en la cuadrícula permitida, las
     más "en tiempo" primero, y reparte la densidad de forma pareja para no perder el ritmo. */
  function simplificar(origen, pulsos, dur, destino) {
    const cfg = AN.DIFICULTADES[destino];
    let notas = origen.map(n => ({ t: n.t, carril: n.carril, dur: n.dur || 0 })).sort((a, b) => a.t - b.t);
    if (!notas.length) return notas;
    const nivelMax = cfg.sub === 1 ? 0 : cfg.sub === 2 ? 1 : 2;

    const nivelDe = n => {
      const b = enPulsos(pulsos, n.t);
      const f = b - Math.floor(b);
      const d = x => Math.min(Math.abs(f - x), Math.abs(f - x - 1), Math.abs(f - x + 1));
      if (d(0) < 0.07) return 0;
      if (d(0.5) < 0.07) return 1;
      if (d(0.25) < 0.07 || d(0.75) < 0.07) return 2;
      return 3;
    };
    notas.forEach(n => { n.nivel = nivelDe(n); n.beat = enPulsos(pulsos, n.t); });
    const prioridad = n => (n.nivel === 0 ? 30 : n.nivel === 1 ? 20 : n.nivel === 2 ? 10 : 0) + (n.dur > 0 ? 4 : 0) + (n.carril === "ambos" ? 3 : 0) - (n.nivel > nivelMax ? 25 : 0);

    // Cuántas notas deben quedar y cuántas por ventana de 2 pulsos
    const largo = Math.max(1, (notas[notas.length - 1].t - notas[0].t) || dur || 1);
    const objetivo = Math.min(notas.length, Math.round(largo * cfg.nps * 0.95));
    const razon = objetivo / notas.length;
    let conservadas = notas;
    if (razon < 1) {
      const ventanas = new Map();
      notas.forEach(n => { const k = Math.floor(n.beat / 2); if (!ventanas.has(k)) ventanas.set(k, []); ventanas.get(k).push(n); });
      conservadas = [];
      let deuda = 0;
      [...ventanas.keys()].sort((a, b) => a - b).forEach(k => {
        const lista = ventanas.get(k);
        const cuota = lista.length * razon + deuda;
        const cupo = Math.min(lista.length, Math.max(cuota >= 0.5 ? 1 : 0, Math.round(cuota)));
        deuda = cuota - cupo;
        lista.slice().sort((a, b) => prioridad(b) - prioridad(a) || a.t - b.t).slice(0, cupo).forEach(n => conservadas.push(n));
      });
      conservadas.sort((a, b) => a.t - b.t);
    }

    // Lo que quedó fuera de la cuadrícula permitida se pega a ella o se descarta
    const paso = 1 / cfg.sub;
    const finales = [];
    conservadas.forEach(n => {
      if (n.nivel > nivelMax) {
        const b = Math.round(n.beat / paso) * paso;
        const t = deBeat(pulsos, b);
        if (finales.some(o => Math.abs(o.t - t) < 0.06) || conservadas.some(o => o !== n && Math.abs(o.t - t) < 0.06)) return;
        n.t = t;
      }
      finales.push(n);
    });
    notas = finales.sort((a, b) => a.t - b.t);

    // Separación mínima entre notas
    const separadas = [];
    notas.forEach(n => {
      const ult = separadas[separadas.length - 1];
      if (ult && n.t - ult.t < cfg.hueco) {
        if (prioridad(n) > prioridad(ult)) separadas[separadas.length - 1] = n;
        return;
      }
      separadas.push(n);
    });
    notas = separadas;

    // Dobles y largas solo donde la dificultad las tiene
    let previoCarril = "arriba";
    notas.forEach(n => {
      if (n.carril === "ambos" && !cfg.dobles) n.carril = previoCarril === "arriba" ? "abajo" : "arriba";
      if (!(cfg.largas > 0)) n.dur = 0;
      if (n.carril !== "ambos") previoCarril = n.carril;
    });

    // Rachas de un mismo carril
    const maxRacha = destino === "facil" ? 4 : 3;
    let racha = 0;
    let prev = null;
    notas.forEach(n => {
      if (n.carril === "ambos") { racha = 0; prev = null; return; }
      if (n.carril === prev) racha++; else { racha = 1; prev = n.carril; }
      if (racha > maxRacha && !(n.dur > 0)) { n.carril = n.carril === "arriba" ? "abajo" : "arriba"; prev = n.carril; racha = 1; }
    });

    limpiarLargas(notas);
    return notas.map(n => ({ t: Math.round(n.t * 1000) / 1000, carril: n.carril, dur: n.dur }));
  }

  /* Hacia una dificultad más difícil: se conservan todas las notas hechas a mano y se añaden las que
     generaría el motor (con el estilo de ese mapa) donde queda sitio. */
  function enriquecer(origen, pulsos, buffer, destino) {
    const cfg = AN.DIFICULTADES[destino];
    const base = origen.map(n => ({ t: n.t, carril: n.carril, dur: n.dur || 0 })).sort((a, b) => a.t - b.t);
    const propio = AN.estiloDe(base, 0, buffer.duration) || {};
    const largasMin = destino === "experto" ? 0.15 : destino === "dificil" ? 0.1 : 0;
    const estilo = Object.assign({}, propio, {
      nps: Math.max(propio.nps || 0, cfg.nps * 0.85),
      maxRacha: Math.min(propio.maxRacha || 3, 3),
      fraccionLargas: Math.max(propio.fraccionLargas || 0, largasMin),
      huecoDobleS: propio.huecoDobleS || (destino === "experto" ? 1.6 : 3.2),
      corte: 0.05
    });
    const auto = AN.crearMapa(buffer, destino, { pulsos, estilo }).notas;
    const salida = base.slice();
    const presupuesto = Math.round(buffer.duration * cfg.nps * 0.95);
    auto.forEach(a => {
      if (salida.length >= presupuesto) return;
      if (salida.some(n => Math.abs(n.t - a.t) < cfg.hueco)) return;
      const bajoLarga = salida.some(n => n.dur > 0 && a.t > n.t - 0.01 && a.t < n.t + n.dur + 0.2 && (n.carril === a.carril || a.carril === "ambos"));
      if (bajoLarga) return;
      salida.push({ t: a.t, carril: a.carril, dur: a.dur || 0 });
    });
    salida.sort((a, b) => a.t - b.t);
    romperRachas(salida, 3);
    limpiarLargas(salida);
    return salida.map(n => ({ t: Math.round(n.t * 1000) / 1000, carril: n.carril, dur: n.dur }));
  }

  /* Que no queden más de "max" notas seguidas en un mismo carril: la que se pasa cambia de carril si
     cabe (sin chocar con otra nota ni con una larga). Las notas hechas a mano pueden cambiar de carril
     solo si no hay otra opción, así que se prefieren las añadidas; aquí se mira todo por igual. */
  function romperRachas(notas, max) {
    let racha = 0;
    let prev = null;
    for (let i = 0; i < notas.length; i++) {
      const n = notas[i];
      if (n.carril === "ambos") { racha = 0; prev = null; continue; }
      if (n.carril === prev) racha++; else { racha = 1; prev = n.carril; }
      if (racha > max && !(n.dur > 0)) {
        const otro = n.carril === "arriba" ? "abajo" : "arriba";
        const choca = notas.some((o, q) => q !== i && o.carril !== "ambos" && o.carril === otro && Math.abs(o.t - n.t) < 0.12)
          || notas.some(o => o.dur > 0 && o.carril === otro && n.t > o.t - 0.01 && n.t < o.t + o.dur + 0.01);
        if (!choca) { n.carril = otro; prev = otro; racha = 1; }
      }
    }
  }

  function derivar(origen, pulsos, buffer, difOrigen, difDestino) {
    const subida = ORDEN.indexOf(difDestino) > ORDEN.indexOf(difOrigen);
    if (difOrigen === difDestino) return origen.map(n => ({ t: n.t, carril: n.carril, dur: n.dur || 0 }));
    return subida ? enriquecer(origen, pulsos, buffer, difDestino) : simplificar(origen, pulsos, buffer.duration, difDestino);
  }

  /* --- Traer un mapa de Parranda (cuatro carriles) a Zarabanda (dos) ----------------------------------- */
  /* Los carriles 1 y 2 pasan a "abajo" y el 3 y el 4 a "arriba" (más grave abajo, más agudo arriba, como
     en el mapa automático). Un acorde con notas en las dos mitades se vuelve una doble; si todas caen en la
     misma mitad queda una sola nota, con la larga si la había. */
  function desdeParranda(notas4) {
    const orden = notas4.map(n => ({ t: n.t, carril: n.carril, dur: n.dur || 0 })).sort((a, b) => a.t - b.t || a.carril - b.carril);
    const grupos = [];
    orden.forEach(n => {
      const u = grupos[grupos.length - 1];
      if (u && Math.abs(u.t - n.t) < 0.02) u.notas.push(n); else grupos.push({ t: n.t, notas: [n] });
    });
    const convertidas = grupos.map(g => {
      const bajas = g.notas.some(n => n.carril <= 1);
      const altas = g.notas.some(n => n.carril >= 2);
      if (bajas && altas) return { t: g.t, carril: "ambos", dur: 0 };
      return { t: g.t, carril: bajas ? "abajo" : "arriba", dur: Math.max(...g.notas.map(n => n.dur)) };
    });
    // Dos notas casi encimadas en un mismo carril no se pueden pulsar: se queda la primera
    const ultimo = { arriba: -9, abajo: -9 };
    const limpias = [];
    convertidas.forEach(n => {
      const cs = n.carril === "ambos" ? ["arriba", "abajo"] : [n.carril];
      if (cs.some(c => n.t - ultimo[c] < 0.09)) return;
      cs.forEach(c => { ultimo[c] = n.t; });
      limpias.push(n);
    });
    romperRachas(limpias, 3);
    limpiarLargas(limpias);
    return limpias.map(n => ({ t: Math.round(n.t * 1000) / 1000, carril: n.carril, dur: n.dur }));
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

  window.RitmoLogica = { desdeParranda, nivel, revisar, derivar, simplificar, enriquecer, bpmDeToques, pulsosDesdeAncla, densidad, limpiarLargas, ORDEN, NOMBRE };
})();
