/* Estilos de mapa automático (data/estilos-mapas.js). Lee los mapas hechos a mano de una persona, saca lo que
   repite en todos y lo adapta a cada dificultad. Lo usan los juegos y los editores. Requiere
   ritmo-analisis.js y fichas-supabase.js. */
(function () {
  "use strict";

  const AN = window.RitmoAnalisis;
  const lista = window.ESTILOS_MAPAS || [];
  const cache = new Map(); // id -> { t, info }
  const VIGENCIA_MS = 5 * 60 * 1000;
  const MOTOR = "2"; // sube al cambiar cómo se calcula el estilo: separa los puntajes de los mapas anteriores
  const MIN_NOTAS = 20;
  const VARIACION_MAX = 0.15; // un rasgo "de canción" solo se copia si varía menos de esto entre sus mapas

  const media = a => a.reduce((x, y) => x + y, 0) / a.length;
  const desviacion = a => { const m = media(a); return Math.sqrt(media(a.map(x => (x - m) * (x - m)))); };
  const consistente = a => a.length >= 2 && desviacion(a) / Math.max(1e-9, media(a)) <= VARIACION_MAX;

  function notasDe(mapa) {
    return mapa.notas.map(g => ({ t: g[0], carril: ["abajo", "arriba", "ambos"][g[1]] || "abajo", dur: g[2] || 0 })).sort((a, b) => a.t - b.t);
  }

  /* Mide un mapa: lo que sale de ahí se junta luego con el resto de mapas de la misma persona. Se mide sobre la
     parte ya mapeada (si el mapa está a medias, no cuenta lo que falta). */
  function medir(mapa) {
    const notas = notasDe(mapa);
    if (notas.length < MIN_NOTAS) return null;
    const t0 = notas[0].t;
    const t1 = notas[notas.length - 1].t + (notas[notas.length - 1].dur || 0);
    const base = AN.estiloDe(notas, t0 - 0.5, t1 + 0.5, mapa.pulsos);
    if (!base) return null;
    let repite = 0;
    let pares = 0;
    const intervalos = [];
    for (let i = 1; i < notas.length; i++) {
      intervalos.push(notas[i].t - notas[i - 1].t);
      if (notas[i].carril === "ambos" || notas[i - 1].carril === "ambos") continue;
      pares++;
      if (notas[i].carril === notas[i - 1].carril) repite++;
    }
    // Qué parte de los saltos entre notas es de un cuarto de tiempo o menos (semicorcheas)
    let rapidas = 0;
    let contadas = 0;
    const pulsos = mapa.pulsos || [];
    if (pulsos.length > 8) {
      for (let i = 1; i < notas.length; i++) {
        const dt = notas[i].t - notas[i - 1].t;
        if (dt < 0.02) continue;
        let a = 0;
        let b = pulsos.length;
        while (a < b) { const m = (a + b) >> 1; if (pulsos[m] <= notas[i].t) a = m + 1; else b = m; }
        const k = Math.max(0, Math.min(pulsos.length - 2, a - 1));
        contadas++;
        if (dt / (pulsos[k + 1] - pulsos[k]) <= 0.375) rapidas++;
      }
    }
    return {
      n: notas.length,
      pares,
      repite,
      intervalos,
      nps: base.nps,
      maxRacha: base.maxRacha,
      fraccionLargas: base.fraccionLargas,
      dobles: notas.filter(n => n.carril === "ambos").length,
      duracion: Math.max(1, t1 - t0),
      semicorcheas: contadas ? rapidas / contadas : null
    };
  }

  /* Junta las medidas de varios mapas en un solo estilo. Siempre se copia la forma de moverse entre carriles, la
     separación mínima entre notas y la frecuencia de dobles. La densidad, las largas y las semicorcheas solo si
     todos los mapas de esa persona coinciden. */
  function combinar(medidas) {
    const n = medidas.reduce((s, m) => s + m.n, 0);
    const duracion = medidas.reduce((s, m) => s + m.duracion, 0);
    const pares = medidas.reduce((s, m) => s + m.pares, 0);
    const dobles = medidas.reduce((s, m) => s + m.dobles, 0);
    const intervalos = medidas.flatMap(m => m.intervalos).sort((a, b) => a - b);
    const hueco = Math.max(0.1, Math.min(0.22, intervalos[Math.floor(intervalos.length * 0.08)] || 0.17));
    const estilo = {
      corte: 0,
      libre: true,
      mezcla: true,
      pRepite: Math.round((medidas.reduce((s, m) => s + m.repite, 0) / Math.max(1, pares)) * 100) / 100,
      maxRacha: Math.max(2, Math.min(4, Math.round(media(medidas.map(m => m.maxRacha))))),
      hueco: Math.round(hueco * 1000) / 1000,
      huecoDobleS: dobles ? Math.max(0.8, (duracion / dobles) * 0.7) : 6
    };
    const propios = [];
    if (consistente(medidas.map(m => m.nps))) { estilo.nps = Math.round((n / duracion) * 100) / 100; propios.push("densidad"); }
    if (consistente(medidas.map(m => m.fraccionLargas))) { estilo.fraccionLargas = Math.round(media(medidas.map(m => m.fraccionLargas)) * 1000) / 1000; propios.push("largas"); }
    const semis = medidas.map(m => m.semicorcheas);
    if (medidas.length >= 2 && semis.every(x => x !== null && x >= 0.2)) { estilo.sub = 4; propios.push("semicorcheas"); }
    estilo.copiado = propios;
    estilo.mapas = medidas.length;
    return estilo;
  }

  /* { estilo, version, nombre, mapas, copiado } del estilo, o { error } si no hay ningún mapa de referencia con
     notas suficientes. version identifica el mapa automático resultante para separar los puntajes: cambia como
     mucho una vez al día mientras los mapas de referencia se sigan editando. */
  async function cargar(id) {
    const e = lista.find(x => x.id === id);
    if (!e) return { error: "No existe ese estilo." };
    const guardado = cache.get(id);
    if (guardado && Date.now() - guardado.t < VIGENCIA_MS) return guardado.info;
    let info;
    try {
      const sb = await fichasCliente();
      const consultas = e.mapas.map(m => sb.from("ritmo_mapas").select("mapa, actualizado").eq("cancion", m.cancion).eq("dificultad", m.dificultad).maybeSingle());
      const respuestas = await Promise.race([Promise.all(consultas), new Promise(r => setTimeout(() => r(null), 5000))]);
      if (!respuestas || respuestas.some(r => r.error)) throw new Error("sin conexión");
      const filas = respuestas.map(r => r.data).filter(Boolean);
      const medidas = filas.map(f => medir(f.mapa)).filter(Boolean);
      if (!filas.length) info = { error: "Esos mapas de referencia ya no están guardados.", nombre: e.nombre };
      else if (!medidas.length) info = { error: "Todavía tienen muy pocas notas para sacar un estilo.", nombre: e.nombre };
      else {
        const fecha = filas.map(f => String(f.actualizado || "").slice(0, 10)).sort().pop();
        const estilo = combinar(medidas);
        info = { estilo, version: `auto-${id}-m${MOTOR}-${fecha}`, nombre: e.nombre, mapas: medidas.length, copiado: estilo.copiado };
      }
    } catch (err) {
      return { error: "No se pudo cargar el estilo. Se usa el estándar.", nombre: e.nombre };
    }
    cache.set(id, { t: Date.now(), info });
    return info;
  }

  /* El estilo se midió en mapas Experto. En las dificultades más bajas se escala la densidad con la misma
     proporción que las dificultades normales, y las largas y dobles solo salen donde la dificultad las tiene.
     Los rasgos que no se copiaron no se ponen (el motor usa entonces los de la dificultad). */
  function paraDificultad(est, dificultad) {
    const cfg = AN.DIFICULTADES[dificultad];
    const experto = dificultad === "experto";
    const salida = {
      corte: experto ? est.corte : cfg.corte,
      libre: est.libre,
      mezcla: est.mezcla,
      pRepite: est.pRepite,
      maxRacha: est.maxRacha,
      hueco: est.hueco,
      huecoDobleS: est.huecoDobleS * (experto ? 1 : 2)
    };
    if (est.nps !== undefined) salida.nps = Math.max(0.8, Math.round(est.nps * (cfg.nps / AN.DIFICULTADES.experto.nps) * 100) / 100);
    if (est.fraccionLargas !== undefined) salida.fraccionLargas = cfg.largas > 0 ? est.fraccionLargas : 0;
    if (est.sub !== undefined && experto) salida.sub = est.sub;
    return salida;
  }

  /* Texto para los ajustes de los juegos: de cuántos mapas aprende y qué copia */
  function describir(info, e) {
    const ayuda = { densidad: "la cantidad de notas", largas: "las largas", semicorcheas: "las notas rápidas" };
    const propios = (info.copiado || []).map(x => ayuda[x]);
    const copia = propios.length
      ? `Además copia ${propios.join(" y ")}, porque lo hace igual en todos sus mapas.`
      : "La cantidad de notas y el ritmo los decide cada canción.";
    return `${e.detalle}. Copia cómo reparte las notas entre los carriles y cuánto las separa. ${copia} Tiene sus propios puntajes.`;
  }

  /* Versión provisional (mientras el estilo no ha cargado) para separar los puntajes */
  function versionProvisional(id) { return "auto-" + id; }

  window.EstilosMapas = { lista, cargar, paraDificultad, describir, versionProvisional };
})();
