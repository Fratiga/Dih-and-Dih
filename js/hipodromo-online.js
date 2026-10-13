/* =============================================================================
   HIPÓDROMO con servidor: lee el mundo compartido de Supabase (lo que escribe la Edge Function hipodromo-avanzar), apuesta
   con la función hipodromo_apostar y manda las órdenes de la cuadra con hipodromo_ordenar. No calcula nada del mundo:
   solo lo trae, lo deja con la misma forma que usa la página local (est, m) y se pone al día cada pocos segundos.
   Requiere sesión (js/fichas-supabase.js). docs/hipodromo.md explica todo el conjunto.
============================================================================= */
window.HipodromoOnline = (function () {
  "use strict";
  const MAX_NOTICIAS = 80, MAX_RESULTADOS = 12, MAX_HISTORIAL = 100;

  /* Intenta conectar. Devuelve { ok: true, en } o { ok: false, motivo: "sesion" | "servidor" | "vacio", detalle } */
  async function conectar(M, alCambiar) {
    const C = M.C;
    if (typeof fichasCliente !== "function" || typeof fichasSesionActual !== "function") return { ok: false, motivo: "servidor", detalle: "Esta página no carga el cliente del servidor." };
    let ses = null;
    try { ses = await fichasSesionActual(); } catch (e) { /* sin sesión */ }
    if (!ses || !ses.user) return { ok: false, motivo: "sesion" };
    let supa;
    try { supa = await fichasCliente(); } catch (e) { return { ok: false, motivo: "servidor", detalle: "No se pudo cargar el cliente del servidor." }; }
    const yo = ses.user.id;

    const est = { v: 1, semilla: "servidor", saldo: 0, pendientes: [], historial: [], noticias: [], archivo: {}, resultados: [], favoritos: [], avisos: [], virtual: Date.now(), vel: 1, desde: Date.now() };
    const m = { n: 0, proxima: null, vivos: [], criadores: [], stats: { carreras: 0, nacidos: 0, retirados: 0, lesiones: 0, incidentes: 0, muertes: 0 }, nombres: {} };
    try { est.favoritos = JSON.parse(localStorage.getItem("hipodromoFavoritosServidor") || "[]"); } catch (e) { /* sin almacenamiento */ }
    const cache = new Map();            // id -> perfil público
    let desfase = 0, ultimoN = -1, ultimaCriatura = -1, cuadraFilas = [], calendarioFilas = [], adoptada = false, reciente = false, cargado = false, parado = false;
    let resultadoDe = null, enCurso = false;

    const avisoError = (donde, error) => { if (error) console.warn("Hipódromo (" + donde + "):", error.message || error); return !!error; };
    const ahora = () => Date.now() + desfase;

    async function sincronizarReloj() {
      const t0 = Date.now();
      const { data, error } = await supa.rpc("hipodromo_ahora");
      if (error || !data) return;
      const t1 = Date.now();
      desfase = new Date(data).getTime() - (t0 + t1) / 2;
    }

    /* ---------------------------------------------------------------- lecturas */
    async function leerPrograma() {
      const { data, error } = await supa.from("hipodromo_programa").select("n, hora, cierre, publico").order("n", { ascending: false }).limit(1);
      if (avisoError("programa", error) || !data || !data.length) return null;
      const f = data[0], prog = Object.assign({}, f.publico);
      prog.n = f.n; prog.hora = new Date(f.hora).getTime(); prog.cierre = new Date(f.cierre).getTime();
      return prog;
    }
    async function leerResultado(n) {
      const { data, error } = await supa.from("hipodromo_carreras").select("resultado").eq("n", n).maybeSingle();
      if (avisoError("carrera", error)) return null;
      return data ? data.resultado : null;
    }
    async function leerCriaturas() {
      // la primera vez, todas las que están en el mundo; después solo las que han cambiado desde la última lectura
      let consulta = supa.from("hipodromo_criaturas").select("id, n, publico");
      consulta = ultimaCriatura < 0 ? consulta.in("estado", ["activo", "criador"]) : consulta.gte("n", ultimaCriatura);
      const { data, error } = await consulta.limit(2000);
      if (avisoError("criaturas", error) || !data) return;
      data.forEach(f => { cache.set(f.id, f.publico); if (f.n > ultimaCriatura) ultimaCriatura = f.n; });
    }
    async function pedirCriaturas(ids) {
      const faltan = ids.filter(i => !cache.has(i));
      if (!faltan.length) return;
      const { data } = await supa.from("hipodromo_criaturas").select("id, publico").in("id", faltan);
      (data || []).forEach(f => cache.set(f.id, f.publico));
    }
    async function leerRetiradas() {
      const { data } = await supa.from("hipodromo_criaturas").select("id, publico").in("estado", ["retirado", "fallecido"]).order("victorias", { ascending: false }).limit(300);
      (data || []).forEach(f => { cache.set(f.id, f.publico); est.archivo[f.id] = f.publico; });
    }
    async function leerNoticias() {
      const { data, error } = await supa.from("hipodromo_noticias").select("n, hora, tipo, titulo, texto, ids").order("id", { ascending: false }).limit(MAX_NOTICIAS);
      if (avisoError("noticias", error) || !data) return;
      est.noticias = data.map(x => ({ n: x.n, hora: new Date(x.hora).getTime(), tipo: x.tipo, titulo: x.titulo, texto: x.texto, ids: x.ids || [] }));
    }
    async function leerResultados() {
      const { data, error } = await supa.from("hipodromo_carreras").select("resultado").order("n", { ascending: false }).limit(MAX_RESULTADOS);
      if (avisoError("resultados", error) || !data) return;
      est.resultados = data.map(x => Object.assign({}, x.resultado, { tramos: undefined }));
    }
    async function leerPozos(n) {
      const { data, error } = await supa.from("hipodromo_pozos").select("criatura_id, total").eq("n", n);
      if (avisoError("pozos", error)) return;
      est.pozos = {}; (data || []).forEach(x => { est.pozos[x.criatura_id] = Number(x.total); });
    }
    async function leerMiCuenta() {
      const [b, a, av, cu, ca, ad] = await Promise.all([
        supa.from("hipodromo_billeteras").select("saldo").eq("usuario", yo).maybeSingle(),
        supa.from("hipodromo_apuestas").select("id, n, tipo, sel, nombres, carrera, monto, cuota, estado, pago").eq("usuario", yo).order("id", { ascending: false }).limit(MAX_HISTORIAL),
        supa.from("hipodromo_avisos").select("n, criatura_id, texto").eq("usuario", yo).order("id", { ascending: false }).limit(40),
        supa.from("hipodromo_cuadras").select("criatura_id, datos").eq("dueno", yo),
        supa.from("hipodromo_calendario").select("datos").order("n"),
        supa.from("hipodromo_ordenes").select("id").eq("usuario", yo).eq("estado", "hecha").eq("datos->>tipo", "adoptar").limit(1)
      ]);
      if (b.data) est.saldo = Number(b.data.saldo);
      if (a.data) {
        const previas = new Map(est.pendientes.map(p => [p.id, p]));
        est.pendientes = a.data.filter(x => x.estado === "pendiente").map(x => ({ id: x.id, n: x.n, tipo: x.tipo, sel: x.sel, monto: Number(x.monto), cuota: Number(x.cuota), nombres: x.nombres, carrera: x.carrera }));
        est.historial = a.data.filter(x => x.estado !== "pendiente").map(x => ({ id: x.id, n: x.n, tipo: x.tipo, sel: x.sel, monto: Number(x.monto), cuota: Number(x.cuota), nombres: x.nombres, carrera: x.carrera, gana: x.estado === "ganada", pago: Number(x.pago), devuelta: x.estado === "devuelta" }));
        if (cargado) est.liquidadas = est.historial.filter(h => previas.has(h.id));
      }
      if (av.data) est.avisos = av.data.map(x => ({ n: x.n, id: x.criatura_id, texto: x.texto, dueno: yo }));
      if (cu.data) cuadraFilas = cu.data;
      if (ca.data) calendarioFilas = ca.data.map(x => x.datos);
      if (ad.data) adoptada = ad.data.length > 0;
    }

    /* ---------------------------------------------------------------- ciclo de actualización */
    async function refrescar() {
      if (enCurso || parado) return; enCurso = true;
      try {
        const prog = await leerPrograma();
        if (!prog) { enCurso = false; return; }
        const cambio = prog.n !== ultimoN;
        await leerPozos(prog.n);
        if (cambio) {
          await leerCriaturas();
          await Promise.all([leerNoticias(), leerResultados(), leerMiCuenta()]);
          resultadoDe = null;
        } else if (ahora() >= prog.hora) {
          await Promise.all([leerCriaturas(), leerMiCuenta()]);
        }
        if (cambio || !m.proxima) {
          await pedirCriaturas(prog.entrantes.map(e => e.id));
          est.liquidadas = est.liquidadas || [];
        }
        // el resultado de la carrera que se corre ahora, en cuanto la base lo deja ver
        let res = (m.proxima && m.proxima.n === prog.n && m.proxima.secreto && m.proxima.secreto.res) || null;
        if (!res && ahora() >= prog.hora - 500 && !prog.suspendida) res = await leerResultado(prog.n);
        m.n = prog.n;
        m.proxima = Object.assign(prog, { secreto: res ? { res } : null });
        m.stats.carreras = prog.n;
        ultimoN = prog.n; est.virtual = ahora();
        cargado = true;
        alCambiar(cambio ? "carrera" : "datos");
      } catch (e) { console.warn("Hipódromo: no se pudo actualizar", e); }
      enCurso = false;
    }
    /* Cuándo toca volver a preguntar: cerca de la salida y de la aplicación del resultado, más seguido; el resto del tiempo, poco */
    function proximoRefresco() {
      const p = m.proxima; if (!p) return 3000;
      const t = ahora();
      if (t >= p.hora + C.DURACION_SEG * 1000 && t < p.hora + (C.APLICAR_SEG + 90) * 1000) return 4000;   // esperando que el servidor aplique el resultado
      if (t >= p.hora - 20000 && t < p.hora + C.DURACION_SEG * 1000 && !(p.secreto && p.secreto.res)) return 1500;   // a punto de salir o ya en pista: que no falte el resultado
      return document.hidden ? 60000 : 15000;
    }
    let temporizador = null;
    function ciclo() { if (parado) return; temporizador = setTimeout(async () => { await refrescar(); ciclo(); }, proximoRefresco()); }

    /* ---------------------------------------------------------------- acciones */
    async function apostar(n, tipo, sel, monto, doble) {
      const { data, error } = await supa.rpc("hipodromo_apostar", { p_n: n, p_tipo: tipo, p_sel: sel, p_monto: monto, p_doble: !!doble });
      if (error) return { ok: false, error: error.message };
      if (data && data.ok) { await Promise.all([leerMiCuenta(), leerPozos(n)]); alCambiar("cuenta"); }
      return data || { ok: false, error: "Sin respuesta." };
    }
    async function ordenar(o) {
      const { data: id, error } = await supa.rpc("hipodromo_ordenar", { p_datos: o });
      if (error) return { ok: false, error: error.message };
      // la Edge Function procesa las órdenes cada minuto: se espera su resultado
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, i < 5 ? 2500 : 4000));
        const { data } = await supa.from("hipodromo_ordenes").select("estado, texto").eq("id", id).maybeSingle();
        if (data && data.estado !== "pendiente") {
          await refrescarTodo();
          return data.estado === "hecha" ? { ok: true, texto: data.texto } : { ok: false, error: data.texto || "No se pudo." };
        }
      }
      return { ok: true, texto: "La orden sigue en cola; se aplicará en cuanto el servidor la procese." };
    }
    async function refrescarTodo() { ultimaCriatura = Math.max(-1, ultimaCriatura - 1); ultimoN = -1; await refrescar(); }
    function guardarFavoritos() { try { localStorage.setItem("hipodromoFavoritosServidor", JSON.stringify(est.favoritos)); } catch (e) { /* sin almacenamiento */ } }

    // ---- arranque
    await sincronizarReloj();
    const hay = await leerPrograma();
    if (!hay) return { ok: false, motivo: "vacio" };
    const { error: errSaldo } = await supa.rpc("hipodromo_saldo");
    avisoError("saldo", errSaldo);
    await refrescar();
    if (!m.proxima) return { ok: false, motivo: "vacio" };
    ciclo();
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refrescar(); });
    setInterval(sincronizarReloj, 5 * 60000);

    const en = {
      est, m, yo, supa, ahora, cache, apostar, ordenar, refrescar, refrescarTodo, guardarFavoritos, leerRetiradas,
      perfil: id => cache.get(id) || est.archivo[id] || null,
      pedir: pedirCriaturas,
      perfiles: () => [...cache.values()],
      mias: () => cuadraFilas.map(f => ({ p: cache.get(f.criatura_id), c: f.datos })).filter(x => x.p),
      calendario: () => calendarioFilas.map(x => Object.assign({}, x, { cierra: x.hora - C.MINUTOS * 60000 + C.APLICAR_SEG * 1000 })),
      adoptada: () => adoptada || cuadraFilas.length > 0,
      refrescarCuenta: async () => { await leerMiCuenta(); alCambiar("cuenta"); },
      parar: () => { parado = true; clearTimeout(temporizador); }
    };
    return { ok: true, en };
  }
  return { conectar };
})();
