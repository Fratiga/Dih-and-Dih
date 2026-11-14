/* =============================================================================
   TABLERO — red. Dos formas de guardar y sincronizar con la misma interfaz:
   - Supabase (docs/admin/tablero.sql): lo normal. Las filas viajan por Realtime y lo que está en marcha
     (arrastrar una ficha, medir, pings, efectos) por un canal de broadcast, nunca lo de la capa del DJ.
   - Local (?local=1): todo en este navegador, sincronizado entre pestañas. Sirve para preparar sin conexión
     y para probar. ?local=1&jugador=1 abre la vista de un jugador.
   Eventos: objeto, objetoBorrado, escena, escenaBorrada, estado, mensaje, mensajeBorrado, diario,
   diarioBorrado, conexion, presencia, y los de broadcast mov, quitar, ping, regla, fx y camara.
============================================================================= */
(function () {
  function emisor() {
    const oyentes = {};
    return {
      on(ev, f) { (oyentes[ev] = oyentes[ev] || []).push(f); },
      lanzar(ev, d) { (oyentes[ev] || []).forEach(f => { try { f(d); } catch (e) { console.error("[tablero]", ev, e); } }); }
    };
  }
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "x" + Date.now().toString(36) + Math.random().toString(36).slice(2));
  const ahora = () => new Date().toISOString();
  const ESTADO_VACIO = () => ({ id: 1, escena_jugadores: null, iniciativa: { lista: [], turno: 0, ronda: 1, visible: false }, musica: {}, gramola: {} });
  const BROADCAST = ["mov", "quitar", "ping", "regla", "fx", "camara", "cursor", "sonido", "explorado"];

  /* ============================================================ Supabase */
  function redSupabase() {
    const ev = emisor();
    let sb = null, canal = null, yo = null;
    let conectado = false, intentos = 0, temporizador = null, huboCaida = false, extraPresencia = {};

    /* Un solo canal con los cambios de las tablas, el broadcast y quién está conectado. Si se cae (pestaña dormida,
       red, servidor), se vuelve a abrir solo con esperas crecientes y, al volver, la app recarga lo que se perdió. */
    function conectar() {
      const uid = yo.uid;
      canal = sb.channel("tablero", { config: { broadcast: { self: false }, presence: { key: uid } } })
        .on("postgres_changes", { event: "*", schema: "public", table: "tablero_objetos" }, fila("objeto", "objetoBorrado"))
        .on("postgres_changes", { event: "*", schema: "public", table: "tablero_escenas" }, fila("escena", "escenaBorrada"))
        .on("postgres_changes", { event: "*", schema: "public", table: "tablero_diario" }, fila("diario", "diarioBorrado"))
        .on("postgres_changes", { event: "*", schema: "public", table: "tablero_estado" }, p => { if (p.new && p.new.id) ev.lanzar("estado", p.new); })
        .on("postgres_changes", { event: "*", schema: "public", table: "tablero_mensajes" }, fila("mensaje", "mensajeBorrado"))
        .on("presence", { event: "sync" }, () => {
          const st = canal.presenceState();
          ev.lanzar("presencia", Object.keys(st).map(k => st[k][0]).filter(Boolean));
        });
      BROADCAST.forEach(nombre => canal.on("broadcast", { event: nombre }, m => ev.lanzar(nombre, m.payload)));
      const este = canal;
      canal.subscribe((estado, err) => {
        if (este !== canal) return;
        if (estado === "SUBSCRIBED") {
          conectado = true; intentos = 0;
          canal.track(Object.assign({ uid, nombre: yo.nombre, gm: yo.esGM }, extraPresencia)).catch(() => {});
          ev.lanzar("conexion", { estado: "conectado", recuperado: huboCaida });
          huboCaida = false;
        } else if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT" || estado === "CLOSED") {
          if (estado === "CLOSED" && !conectado) return;
          conectado = false; huboCaida = true;
          if (err) console.warn("[tablero] canal:", estado, err.message || err);
          ev.lanzar("conexion", { estado: "reconectando", intentos });
          reconectar(Math.min(30000, 1500 * Math.pow(2, intentos++)));
        }
      });
    }
    function reconectar(espera) {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        const viejo = canal;
        canal = null;
        if (viejo) sb.removeChannel(viejo).catch(() => {});
        conectar();
      }, espera);
    }
    const ok = ({ data, error }) => { if (error) throw error; return data; };
    const fila = (nombre, borrado) => p => {
      if (p.eventType === "DELETE") ev.lanzar(borrado, p.old && p.old.id);
      else ev.lanzar(nombre, p.new);
    };

    return {
      modo: "supabase",
      on: ev.on,
      async iniciar() {
        if (typeof fichasCliente !== "function") throw Object.assign(new Error("Sin conexión"), { codigo: "sin-red" });
        sb = await fichasCliente();
        const { data } = await sb.auth.getSession();
        if (!data || !data.session) throw Object.assign(new Error("Sin sesión"), { codigo: "sin-sesion" });
        const uid = data.session.user.id;
        const est = await sb.from("tablero_estado").select("id").eq("id", 1).maybeSingle();
        if (est.error) {
          const falta = /tablero_|does not exist|schema cache/i.test(est.error.message || "");
          throw Object.assign(new Error(est.error.message), { codigo: falta ? "sin-sql" : "error" });
        }
        const { data: esGM } = await sb.rpc("fichas_es_admin");
        const perfil = await sb.from("perfiles").select("username").eq("user_id", uid).maybeSingle();
        yo = { uid, esGM: !!esGM, nombre: (perfil.data && perfil.data.username) || "Jugador" };

        conectar();
        // Al volver a la pestaña o recuperar la red, se comprueba el canal
        window.addEventListener("online", () => { if (!conectado) reconectar(0); });
        document.addEventListener("visibilitychange", () => { if (!document.hidden && !conectado) reconectar(0); });
        return yo;
      },
      async escenas() { return ok(await sb.from("tablero_escenas").select("*").order("orden").order("creada")); },
      async estado() { return ok(await sb.from("tablero_estado").select("*").eq("id", 1).maybeSingle()) || ESTADO_VACIO(); },
      async objetos(escena) { return escena ? ok(await sb.from("tablero_objetos").select("*").eq("escena", escena).order("z")) : []; },
      async mensajes() { return (ok(await sb.from("tablero_mensajes").select("*").order("id", { ascending: false }).limit(150)) || []).reverse(); },
      async diario() { return ok(await sb.from("tablero_diario").select("*").order("orden").order("nombre")); },
      async crearEscena(f) { return ok(await sb.from("tablero_escenas").insert(f).select().single()); },
      async actualizarEscena(id, c) { ok(await sb.from("tablero_escenas").update(Object.assign({ actualizada: ahora() }, c)).eq("id", id)); },
      async borrarEscena(id) { ok(await sb.from("tablero_escenas").delete().eq("id", id)); },
      async actualizarEstado(c) { ok(await sb.from("tablero_estado").update(Object.assign({ actualizado: ahora() }, c)).eq("id", 1)); },
      async crearObjetos(filas) { return filas.length ? ok(await sb.from("tablero_objetos").insert(filas).select()) : []; },
      async actualizarObjeto(id, c) { ok(await sb.from("tablero_objetos").update(Object.assign({ actualizado: ahora() }, c)).eq("id", id)); },
      async borrarObjetos(ids) { if (ids.length) ok(await sb.from("tablero_objetos").delete().in("id", ids)); },
      async notaGM(objeto) { const d = ok(await sb.from("tablero_notas_gm").select("texto").eq("objeto", objeto).maybeSingle()); return d ? d.texto : ""; },
      async guardarNotaGM(objeto, texto) { ok(await sb.from("tablero_notas_gm").upsert({ objeto, texto })); },
      async diarioGM(id) { const d = ok(await sb.from("tablero_diario_gm").select("texto").eq("diario", id).maybeSingle()); return d ? d.texto : ""; },
      async guardarDiarioGM(id, texto) { ok(await sb.from("tablero_diario_gm").upsert({ diario: id, texto })); },
      async moverPropio(id, x, y) { ok(await sb.rpc("tablero_mover", { p_id: id, p_x: x, p_y: y })); },
      async puerta(id) { return ok(await sb.rpc("tablero_puerta", { p_objeto: id })); },
      async estados(id, lista) { ok(await sb.rpc("tablero_estados", { p_objeto: id, p_estados: lista })); },
      async apariencia(id, ap) { ok(await sb.rpc("tablero_apariencia", { p_objeto: id, p_ap: ap || null })); },
      async apariencias() { return ok(await sb.from("tablero_apariencias").select("id, nombre, datos").order("creado", { ascending: false })) || []; },
      async guardarApariencia(a) { return ok(await sb.from("tablero_apariencias").insert({ nombre: (a.nombre || "").slice(0, 80), datos: a.datos }).select("id, nombre, datos").single()); },
      async borrarApariencia(id) { ok(await sb.from("tablero_apariencias").delete().eq("id", id)); },
      async barra(id, n, valor, max) { ok(await sb.rpc("tablero_barra", { p_id: id, p_n: n, p_valor: valor, p_max: max })); },
      async crearPropio(escena, tipo, x, y, ancho, alto, datos) {
        return ok(await sb.rpc("tablero_crear_propio", { p_escena: escena, p_tipo: tipo, p_x: x, p_y: y, p_ancho: ancho, p_alto: alto, p_datos: datos }));
      },
      async borrarPropio(ids) { return ok(await sb.rpc("tablero_borrar_propio", { p_ids: ids })); },
      async decir(texto, modo, para, como) { ok(await sb.rpc("tablero_decir", { p_texto: texto, p_modo: modo || "todos", p_para: para || null, p_como: como || null })); },
      async tirar(expr, etiqueta, modo, como) { return ok(await sb.rpc("tablero_tirar", { p_expr: expr, p_etiqueta: etiqueta || "", p_modo: modo || "todos", p_como: como || null })); },
      async tirarIniciativa(objeto, mod) { return ok(await sb.rpc("tablero_tirar_iniciativa", { p_objeto: objeto, p_mod: mod | 0 })); },
      async turno(paso) { ok(await sb.rpc("tablero_turno", { p_paso: paso })); },
      async iniciativaValor(objeto, valor) { ok(await sb.rpc("tablero_iniciativa_valor", { p_objeto: objeto, p_valor: valor })); },
      async vaciarChat() { ok(await sb.from("tablero_mensajes").delete().gt("id", 0)); },
      async crearDiario(f) { return ok(await sb.from("tablero_diario").insert(f).select().single()); },
      async actualizarDiario(id, c) { ok(await sb.from("tablero_diario").update(Object.assign({ actualizado: ahora() }, c)).eq("id", id)); },
      async borrarDiario(id) { ok(await sb.from("tablero_diario").delete().eq("id", id)); },
      async arte() { return ok(await sb.from("tablero_arte").select("*").order("creado", { ascending: false })) || []; },
      async crearArte(f) { return ok(await sb.from("tablero_arte").insert(f).select().single()); },
      async borrarArte(id) { ok(await sb.from("tablero_arte").delete().eq("id", id)); },
      async macros() { return ok(await sb.from("tablero_macros").select("*").order("orden").order("nombre")) || []; },
      async guardarMacro(f) {
        if (f.id) { const { id, ...c } = f; ok(await sb.from("tablero_macros").update(c).eq("id", id)); return f; }
        return ok(await sb.from("tablero_macros").insert(f).select().single());
      },
      async borrarMacro(id) { ok(await sb.from("tablero_macros").delete().eq("id", id)); },
      async subirImagen(archivo) {
        const limpio = archivo.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "imagen.png";
        const ruta = `${uuid()}/${limpio}`;
        const { error } = await sb.storage.from("tablero").upload(ruta, archivo, { contentType: archivo.type, upsert: false, cacheControl: "31536000" });
        if (error) throw error;
        return `${window.FICHAS_SUPABASE_URL}/storage/v1/object/public/tablero/${ruta}`;
      },
      async perfil() { const d = ok(await sb.from("tablero_perfil").select("avatar").eq("uid", yo.uid).maybeSingle()); return { avatar: (d && d.avatar) || "" }; },
      async guardarPerfil(c) { ok(await sb.from("tablero_perfil").upsert(Object.assign({ uid: yo.uid, actualizado: ahora() }, c))); },
      async gifs() { return ok(await sb.from("tablero_gifs").select("id, url, nombre").order("creado", { ascending: false })) || []; },
      async agregarGif(g) { return ok(await sb.from("tablero_gifs").insert({ url: g.url, nombre: (g.nombre || "").slice(0, 60) }).select("id, url, nombre").single()); },
      async borrarGif(id) { ok(await sb.from("tablero_gifs").delete().eq("id", id)); },
      // Cualquiera sube lo suyo (avatar, GIFs) a su carpeta u/<su id>/ del bucket del tablero
      async subirPropio(archivo) {
        const limpio = archivo.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "archivo";
        const ruta = `u/${yo.uid}/${uuid()}-${limpio}`;
        const { error } = await sb.storage.from("tablero").upload(ruta, archivo, { contentType: archivo.type, upsert: false, cacheControl: "31536000" });
        if (error) throw error;
        return `${window.FICHAS_SUPABASE_URL}/storage/v1/object/public/tablero/${ruta}`;
      },
      async jugadores() {
        const { data } = await sb.from("perfiles").select("user_id, username");
        return (data || []).filter(p => p.username).map(p => ({ uid: p.user_id, nombre: p.username }));
      },
      async fichas() {
        const { data, error } = await sb.from("fichas_personajes").select("id, owner_id, data").eq("archivado", false);
        if (error) return [];
        return (data || []).map(f => ({ id: f.id, owner: f.owner_id, nombre: (f.data && f.data.identidad && f.data.identidad.nombre) || "Sin nombre", combate: f.data && f.data.combate }));
      },
      emitir(evento, datos) { if (canal && conectado) canal.send({ type: "broadcast", event: evento, payload: datos }).catch(() => {}); },
      presencia(extra) { extraPresencia = Object.assign({}, extraPresencia, extra); if (canal && conectado) canal.track(Object.assign({ uid: yo.uid, nombre: yo.nombre, gm: yo.esGM }, extraPresencia)).catch(() => {}); },
      async fichaCompleta(id) { const d = ok(await sb.from("fichas_personajes").select("id, owner_id, data, roll20").eq("id", id).maybeSingle()); return d; },
      async fichasRoll20() {
        const { data, error } = await sb.from("fichas_personajes").select("id, owner_id, roll20, data").eq("archivado", false).not("roll20", "is", null);
        if (error) return [];
        return (data || []).map(f => ({ id: f.id, owner: f.owner_id, nombre: (f.data && f.data.identidad && f.data.identidad.nombre) || (f.roll20 && f.roll20.nombre) || "Sin nombre",
          velocidad: f.roll20 && f.roll20.velocidad, items: (f.roll20 && f.roll20.items) || [], combate: f.data && f.data.combate }));
      },
      async gastarMunicion(ficha, ataque) { return ok(await sb.rpc("fichas_gastar_municion", { p_ficha: ficha, p_ataque: ataque })); },
      async fichaPV(ficha, cambios) { ok(await sb.rpc("tablero_ficha_pv", { p_ficha: ficha, p_actual: cambios.actual, p_max: cambios.max, p_temp: cambios.temp })); },
      async canciones() {
        // Las canciones que se subieron a la rocola (tabla rocola_canciones); las del sitio vienen en data/musica.js
        const { data, error } = await sb.from("rocola_canciones").select("ruta, titulo, artista").order("creada", { ascending: false });
        if (error) return [];
        return (data || []).map(c => ({ src: c.ruta, nombre: c.titulo + (c.artista ? " - " + c.artista : "") }));
      }
    };
  }

  /* ============================================================ Local */
  function redLocal(comoJugador) {
    const ev = emisor();
    const CLAVE = "tableroLocal";
    const bc = "BroadcastChannel" in window ? new BroadcastChannel("tablero-local") : null;
    const GM = "local-gm", JUG = "local-jugador";
    let d;
    const leer = () => {
      try { d = JSON.parse(localStorage.getItem(CLAVE) || "null"); } catch (e) { d = null; }
      d = Object.assign({ escenas: [], estado: ESTADO_VACIO(), objetos: [], mensajes: [], diario: [], diarioGM: {}, notasGM: {}, arte: [], macros: [] }, d || {});
    };
    const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(d)); } catch (e) { console.warn("[tablero] sin espacio local"); } };
    leer();
    const yo = comoJugador ? { uid: JUG, esGM: false, nombre: "Jugador de prueba" } : { uid: GM, esGM: true, nombre: "DJ" };
    const controla = o => o.controlan_todos || (o.controladores || []).includes(yo.uid);
    const verObjeto = o => yo.esGM || (o.capa !== "gm" && o.escena === d.estado.escena_jugadores);
    const verMensaje = m => yo.esGM || m.modo === "todos" || ((m.modo === "dj" || m.modo === "susurro") && m.autor === yo.uid) || (m.modo === "susurro" && (m.para || []).includes(yo.uid));
    const verDiario = e => yo.esGM || e.ver_todos || (e.ver || []).includes(yo.uid) || (e.controladores || []).includes(yo.uid);
    const avisar = (evento, x) => {
      if (evento === "objeto" && !verObjeto(x)) { ev.lanzar("objetoBorrado", x.id); return; }
      if (evento === "mensaje" && !verMensaje(x)) return;
      if (evento === "diario" && !verDiario(x)) { ev.lanzar("diarioBorrado", x.id); return; }
      ev.lanzar(evento, x);
    };
    const publicar = (evento, x) => { guardar(); avisar(evento, x); if (bc) bc.postMessage({ evento, x }); };
    if (bc) bc.onmessage = m => { leer(); const { evento, x } = m.data || {}; if (!evento) return; if (BROADCAST.includes(evento)) ev.lanzar(evento, x); else avisar(evento, x); };
    const msg = (campos) => {
      const m = Object.assign({ id: Date.now() + Math.random(), autor: yo.uid, nombre: yo.nombre, avatar: "", texto: "", tirada: null, modo: "todos", para: null, creado: ahora() }, campos);
      d.mensajes.push(m); if (d.mensajes.length > 300) d.mensajes.shift(); publicar("mensaje", m);
    };
    const perfilLocal = () => { try { return JSON.parse(localStorage.getItem("tbPerfilLocal:" + yo.uid) || "{}"); } catch (e) { return {}; } };
    const como = id => {
      if (!id) return { nombre: yo.nombre, avatar: perfilLocal().avatar || "" };
      const e = d.diario.find(x => x.id === id && x.tipo === "personaje" && (yo.esGM || (x.controladores || []).includes(yo.uid)));
      if (!e) throw new Error("No puedes hablar como ese personaje.");
      return { nombre: e.nombre, avatar: e.imagen || "" };
    };
    const jugadores = [{ uid: GM, nombre: "DJ" }, { uid: JUG, nombre: "Jugador de prueba" }];

    return {
      modo: "local",
      on: ev.on,
      async iniciar() {
        setTimeout(() => { ev.lanzar("conexion", "SUBSCRIBED"); ev.lanzar("presencia", [{ uid: yo.uid, nombre: yo.nombre, gm: yo.esGM }]); }, 0);
        return yo;
      },
      async escenas() { leer(); return yo.esGM ? d.escenas.slice() : d.escenas.filter(e => e.id === d.estado.escena_jugadores); },
      async estado() { leer(); return d.estado; },
      async objetos(escena) { leer(); return d.objetos.filter(o => o.escena === escena && verObjeto(o)).sort((a, b) => a.z - b.z); },
      async mensajes() { leer(); return d.mensajes.filter(verMensaje).slice(-150); },
      async diario() { leer(); return d.diario.filter(verDiario); },
      async crearEscena(f) {
        const e = Object.assign({ id: uuid(), nombre: "Escena", cuadricula: { tam: 70, visible: true, ajustar: true, color: "#c0c0c0", opacidad: 0.5, pies: 5 },
          fondo: "#ffffff", niebla: { activa: false, zonas: [] }, miniatura: "", carpeta: "", orden: d.escenas.length, creada: ahora() }, f);
        d.escenas.push(e); publicar("escena", e); return e;
      },
      async actualizarEscena(id, c) { const e = d.escenas.find(x => x.id === id); if (e) { Object.assign(e, c); publicar("escena", e); } },
      async borrarEscena(id) {
        d.escenas = d.escenas.filter(x => x.id !== id);
        d.objetos = d.objetos.filter(o => o.escena !== id);
        if (d.estado.escena_jugadores === id) { d.estado.escena_jugadores = null; publicar("estado", d.estado); }
        publicar("escenaBorrada", id);
      },
      async actualizarEstado(c) { Object.assign(d.estado, c); publicar("estado", d.estado); },
      async crearObjetos(filas) {
        const nuevas = filas.map(f => Object.assign({ id: uuid(), capa: "fichas", tipo: "imagen", x: 0, y: 0, ancho: 70, alto: 70, rot: 0, z: 0, opacidad: 1,
          bloqueado: false, controladores: [], controlan_todos: false, autor: yo.uid, datos: {} }, f));
        nuevas.forEach(o => { d.objetos.push(o); publicar("objeto", o); });
        return nuevas;
      },
      async actualizarObjeto(id, c) { const o = d.objetos.find(x => x.id === id); if (o) { Object.assign(o, c); publicar("objeto", o); } },
      async borrarObjetos(ids) { d.objetos = d.objetos.filter(o => !ids.includes(o.id)); ids.forEach(id => publicar("objetoBorrado", id)); },
      async notaGM(objeto) { leer(); return d.notasGM[objeto] || ""; },
      async guardarNotaGM(objeto, texto) { d.notasGM[objeto] = texto; guardar(); },
      async diarioGM(id) { leer(); return d.diarioGM[id] || ""; },
      async guardarDiarioGM(id, texto) { d.diarioGM[id] = texto; guardar(); },
      async apariencia(id, ap) {
        const o = d.objetos.find(q => q.id === id);
        if (!o || !(yo.esGM || (controla(o) && o.capa === "fichas" && (o.datos || {}).cambiaformas))) throw new Error("Tu ficha no puede cambiar de aspecto.");
        let dd = Object.assign({}, o.datos);
        if (!ap) { if (dd.original) { const orig = dd.original; delete dd.original; delete dd.disfraz; dd = Object.assign(dd, orig); } }
        else {
          if (!dd.original) dd.original = { src: dd.src, nombre: dd.nombre, verNombre: dd.verNombre, tinte: dd.tinte, voltearH: dd.voltearH };
          Object.assign(dd, { src: ap.src, nombre: ap.nombre || "", verNombre: !!ap.verNombre, tinte: ap.tinte || null, voltearH: !!ap.voltearH, disfraz: true });
        }
        o.datos = dd; publicar("objeto", o);
      },
      async apariencias() { try { return JSON.parse(localStorage.getItem("tbAparLocal:" + yo.uid) || "[]"); } catch (e) { return []; } },
      async guardarApariencia(a) { const l = await this.apariencias(); const n = { id: uuid(), nombre: a.nombre || "", datos: a.datos }; l.unshift(n); localStorage.setItem("tbAparLocal:" + yo.uid, JSON.stringify(l.slice(0, 200))); return n; },
      async borrarApariencia(id) { localStorage.setItem("tbAparLocal:" + yo.uid, JSON.stringify((await this.apariencias()).filter(x => x.id !== id))); },
      async estados(id, lista) {
        const o = d.objetos.find(q => q.id === id);
        if (!o || !(yo.esGM || (controla(o) && o.capa === "fichas"))) throw new Error("Esa ficha no es tuya.");
        o.datos = Object.assign({}, o.datos, { estados: lista });
        publicar("objeto", o);
      },
      async puerta(id) {
        const o = d.objetos.find(q => q.id === id);
        if (!o || o.capa !== "luz" || (o.datos || {}).muro !== "puerta") throw new Error("Eso no es una puerta.");
        if (!yo.esGM && (o.datos || {}).llave) throw new Error("La puerta está cerrada con llave.");
        o.datos = Object.assign({}, o.datos, { abierta: !(o.datos || {}).abierta });
        publicar("objeto", o);
        return o.datos.abierta;
      },
      async moverPropio(id, x, y) {
        const o = d.objetos.find(q => q.id === id);
        if (!o || !(yo.esGM || (controla(o) && o.capa === "fichas" && !o.bloqueado && o.escena === d.estado.escena_jugadores))) throw new Error("No puedes mover esa ficha.");
        o.x = x; o.y = y; publicar("objeto", o);
      },
      async barra(id, n, valor, max) {
        const o = d.objetos.find(q => q.id === id);
        const b = o && ((o.datos.barras || [])[n - 1] || {});
        if (!o || !(yo.esGM || (controla(o) && b.editar))) throw new Error("No puedes cambiar esa barra.");
        o.datos.barras = o.datos.barras || [{}, {}, {}];
        o.datos.barras[n - 1] = Object.assign({}, b, { valor, max });
        publicar("objeto", o);
      },
      async crearPropio(escena, tipo, x, y, ancho, alto, datos) {
        if (!yo.esGM && escena !== d.estado.escena_jugadores) throw new Error("No puedes dibujar en esa escena.");
        const z = Math.max(0, ...d.objetos.filter(o => o.escena === escena).map(o => o.z)) + 1;
        const [o] = await this.crearObjetos([{ escena, capa: "fichas", tipo, x, y, ancho, alto, z, controladores: [yo.uid], datos }]);
        return o.id;
      },
      async borrarPropio(ids) {
        const mios = d.objetos.filter(o => ids.includes(o.id) && o.autor === yo.uid && (o.tipo === "dibujo" || o.tipo === "texto")).map(o => o.id);
        await this.borrarObjetos(mios); return mios.length;
      },
      async decir(texto, modo, para, comoId) {
        let v = String(texto || "").trim().slice(0, 1000);
        if (!v) return;
        let destinos = null;
        if (modo === "susurro") {
          const p = String(para || "").trim().toLowerCase();
          destinos = jugadores.filter(j => j.nombre.toLowerCase() === p).map(j => j.uid)
            .concat(...d.diario.filter(e => e.tipo === "personaje" && e.nombre.toLowerCase() === p).map(e => e.controladores || []));
          if (!destinos.length) throw new Error(`No encuentro a "${para}".`);
        }
        const c = como(comoId);
        const enlinea = [];
        v = v.replace(/\[\[([^\]]{1,80})\]\]/g, (todo, expr) => { if (enlinea.length >= 10) return todo; enlinea.push(TBDados.tirar(expr)); return "⟦" + (enlinea.length - 1) + "⟧"; });
        msg({ nombre: c.nombre, avatar: c.avatar, texto: v, tirada: enlinea.length ? { enlinea } : null, modo: modo || "todos", para: destinos });
      },
      async tirar(expr, etiqueta, modo, comoId) {
        const c = como(comoId);
        const t = Object.assign(TBDados.tirar(expr), { etiqueta: String(etiqueta || "").trim().slice(0, 60) });
        msg({ nombre: c.nombre, avatar: c.avatar, tirada: t, modo: modo || "todos" });
        return modo === "secreta" && !yo.esGM ? { secreta: true } : t;
      },
      async tirarIniciativa(objeto, mod) {
        const o = d.objetos.find(q => q.id === objeto);
        if (!o || !(yo.esGM || controla(o))) throw new Error("Esa ficha no es tuya.");
        const nombre = (o.datos && o.datos.nombre) || "Ficha";
        const t = Object.assign(TBDados.tirar("1d20" + (mod >= 0 ? "+" : "") + (mod | 0)), { etiqueta: "Iniciativa de " + nombre });
        msg({ tirada: t, modo: o.capa === "gm" ? "secreta" : "todos" });
        const ini = d.estado.iniciativa || { lista: [] };
        ini.lista = (ini.lista || []).filter(e => e.id !== objeto).concat([{ id: objeto, nombre, valor: t.total, oculto: o.capa === "gm", src: (o.datos && o.datos.src) || "" }]).sort((a, b) => b.valor - a.valor);
        d.estado.iniciativa = ini; publicar("estado", d.estado);
        return t;
      },
      async iniciativaValor(objeto, valor) {
        const o = d.objetos.find(q => q.id === objeto);
        if (!yo.esGM && !(o && controla(o))) throw new Error("Esa ficha no es tuya.");
        const ini = d.estado.iniciativa || { lista: [] };
        if (!(ini.lista || []).some(e => e.id === objeto)) throw new Error("Esa ficha no está en el orden de turno.");
        ini.lista = ini.lista.map(e => e.id === objeto ? Object.assign({}, e, { valor: Number(valor) || 0 }) : e);
        d.estado.iniciativa = ini; publicar("estado", d.estado);
      },
      async turno(paso) {
        const ini = d.estado.iniciativa || {}, n = (ini.lista || []).length;
        if (!n) return;
        let t = Math.min(Math.max(ini.turno | 0, 0), n - 1), r = Math.max(ini.ronda | 0, 1);
        if (!yo.esGM) {
          const o = d.objetos.find(q => q.id === ini.lista[t].id);
          if (paso !== 1 || !o || !controla(o)) throw new Error("No es tu turno.");
        }
        if (paso >= 0) { t++; if (t >= n) { t = 0; r++; } } else { t--; if (t < 0) { t = n - 1; r = Math.max(r - 1, 1); } }
        d.estado.iniciativa = Object.assign({}, ini, { turno: t, ronda: r }); publicar("estado", d.estado);
      },
      async vaciarChat() { const ids = d.mensajes.map(m => m.id); d.mensajes = []; ids.forEach(id => publicar("mensajeBorrado", id)); },
      async crearDiario(f) {
        const e = Object.assign({ id: uuid(), tipo: "personaje", nombre: "Nuevo", imagen: "", texto: "", carpeta: "", orden: 0, ver_todos: false, ver: [], controladores: [],
          ficha: null, etiquetas: [], archivado: false, grupo: false, token: null, creado: ahora() }, f);
        d.diario.push(e); publicar("diario", e); return e;
      },
      async actualizarDiario(id, c) { const e = d.diario.find(x => x.id === id); if (e) { Object.assign(e, c); publicar("diario", e); } },
      async borrarDiario(id) { d.diario = d.diario.filter(x => x.id !== id); publicar("diarioBorrado", id); },
      async arte() { leer(); return d.arte.slice(); },
      async crearArte(f) { const a = Object.assign({ id: uuid(), creado: ahora() }, f); d.arte.unshift(a); guardar(); return a; },
      async borrarArte(id) { d.arte = d.arte.filter(a => a.id !== id); guardar(); },
      async macros() { leer(); return d.macros.filter(m => m.autor === yo.uid); },
      async guardarMacro(f) {
        if (f.id) { const m = d.macros.find(x => x.id === f.id); if (m) Object.assign(m, f); guardar(); return m; }
        const m = Object.assign({ id: uuid(), autor: yo.uid, en_barra: true, orden: 0 }, f); d.macros.push(m); guardar(); return m;
      },
      async borrarMacro(id) { d.macros = d.macros.filter(m => m.id !== id); guardar(); },
      async perfil() { return { avatar: perfilLocal().avatar || "" }; },
      async guardarPerfil(c) { localStorage.setItem("tbPerfilLocal:" + yo.uid, JSON.stringify(Object.assign(perfilLocal(), c))); },
      async gifs() { try { return JSON.parse(localStorage.getItem("tbGifsLocal:" + yo.uid) || "[]"); } catch (e) { return []; } },
      async agregarGif(g) { const l = await this.gifs(); const n = { id: uuid(), url: g.url, nombre: g.nombre || "" }; l.unshift(n); localStorage.setItem("tbGifsLocal:" + yo.uid, JSON.stringify(l.slice(0, 300))); return n; },
      async borrarGif(id) { const l = (await this.gifs()).filter(x => x.id !== id); localStorage.setItem("tbGifsLocal:" + yo.uid, JSON.stringify(l)); },
      async subirPropio(archivo) { return this.subirImagen(archivo); },
      async subirImagen(archivo) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(archivo); }); },
      async jugadores() { return jugadores.slice(); },
      async fichas() { return [{ id: "local-ficha", owner: JUG, nombre: "Jugador de prueba", combate: { pvActual: 18, pvMax: 24, pvTemp: 0 } }]; },
      emitir(evento, x) { if (bc) bc.postMessage({ evento, x }); },
      presencia(extra) { setTimeout(() => ev.lanzar("presencia", [Object.assign({ uid: yo.uid, nombre: yo.nombre, gm: yo.esGM }, extra)]), 0); },
      async fichaCompleta() { return null; },
      async fichasRoll20() {
        return [{ id: "local-ficha", owner: JUG, nombre: "Jugador de prueba", velocidad: 30, combate: { pvActual: 18, pvMax: 24, pvTemp: 0 },
          items: [{ id: "a1", categoria: "Ataques", texto: "Espada larga: +5", cmd: { normal: "/em ataca con la espada larga\nAtaque: [[1d20+5]]\nDaño: [[1d8+3]] cortante", ventaja: "Ataque: [[2d20kh1+5]]\nDaño: [[1d8+3]]", desventaja: "Ataque: [[2d20kl1+5]]\nDaño: [[1d8+3]]" }, favorita: true },
            { id: "s1", categoria: "Habilidades", texto: "Sigilo: +4", cmd: { normal: "Sigilo: [[1d20+4]]", ventaja: "Sigilo: [[2d20kh1+4]]", desventaja: "Sigilo: [[2d20kl1+4]]" } },
            { id: "s2", categoria: "Salvaciones", texto: "Destreza: +4", cmd: { normal: "Salvación de Destreza: [[?{Tipo de tirada|Normal,1d20|Ventaja,2d20kh1|Desventaja,2d20kl1}+4+?{Bonificación adicional|0}]]" } }] }];
      },
      async gastarMunicion() { return 0; },
      async fichaPV() {},
      async canciones() { return []; }
    };
  }

  window.TableroRed = { supabase: redSupabase, local: redLocal };
})();
