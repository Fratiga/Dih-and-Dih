/* Estilos de mapa automático (data/estilos-mapas.js). Lee el mapa hecho a mano que sirve de referencia,
   mide su estilo con RitmoAnalisis.estiloDe y lo adapta a cada dificultad. Lo usan los juegos y los
   editores. Requiere ritmo-analisis.js y fichas-supabase.js. */
(function () {
  "use strict";

  const AN = window.RitmoAnalisis;
  const lista = window.ESTILOS_MAPAS || [];
  const cache = new Map(); // id -> { t, info }
  const VIGENCIA_MS = 5 * 60 * 1000;

  /* { estilo, version, nombre } del estilo, o { error } si el mapa de referencia no existe o tiene muy pocas
     notas. version identifica el mapa automático resultante para separar los puntajes: cambia como mucho
     una vez al día mientras el mapa de referencia se siga editando. */
  async function cargar(id) {
    const e = lista.find(x => x.id === id);
    if (!e) return { error: "No existe ese estilo." };
    const guardado = cache.get(id);
    if (guardado && Date.now() - guardado.t < VIGENCIA_MS) return guardado.info;
    let info;
    try {
      const sb = await fichasCliente();
      const consulta = sb.from("ritmo_mapas").select("mapa, actualizado").eq("cancion", e.cancion).eq("dificultad", e.dificultad).maybeSingle();
      const { data, error } = await Promise.race([consulta, new Promise(r => setTimeout(() => r({ error: true }), 4000))]);
      if (error) throw new Error("sin conexión");
      if (!data) info = { error: "Ese mapa de referencia ya no está guardado.", nombre: e.nombre };
      else {
        const notas = data.mapa.notas.map(g => ({ t: g[0], carril: ["abajo", "arriba", "ambos"][g[1]] || "abajo", dur: g[2] || 0 })).sort((a, b) => a.t - b.t);
        // Se mide sobre la parte ya mapeada (si el mapa está a medias, no se cuenta lo que falta)
        const t0 = notas.length ? notas[0].t : 0;
        const t1 = notas.length ? notas[notas.length - 1].t + (notas[notas.length - 1].dur || 0) : 0;
        const estilo = AN.estiloDe(notas, t0 - 0.5, t1 + 0.5, data.mapa.pulsos);
        info = estilo
          ? { estilo, version: `auto-${id}-${String(data.actualizado || "").slice(0, 10)}`, nombre: e.nombre }
          : { error: "Todavía tiene muy pocas notas para sacar un estilo.", nombre: e.nombre };
      }
    } catch (err) {
      return { error: "No se pudo cargar el estilo. Se usa el estándar.", nombre: e.nombre };
    }
    cache.set(id, { t: Date.now(), info });
    return info;
  }

  /* El estilo medido es el de un mapa Experto. En las dificultades más bajas se escala la densidad con la
     misma proporción que las dificultades normales, y las largas y dobles solo salen donde la dificultad las
     tiene. */
  function paraDificultad(est, dificultad) {
    const cfg = AN.DIFICULTADES[dificultad];
    const factor = cfg.nps / AN.DIFICULTADES.experto.nps;
    return {
      nps: Math.max(0.8, Math.round(est.nps * factor * 100) / 100),
      corte: dificultad === "experto" ? est.corte : cfg.corte,
      maxRacha: est.maxRacha,
      fraccionLargas: cfg.largas > 0 ? est.fraccionLargas : 0,
      huecoDobleS: est.huecoDobleS * (dificultad === "experto" ? 1 : 2),
      fraccionContra: est.fraccionContra
    };
  }

  /* Versión provisional (mientras el estilo no ha cargado) para separar los puntajes */
  function versionProvisional(id) { return "auto-" + id; }

  window.EstilosMapas = { lista, cargar, paraDificultad, versionProvisional };
})();
