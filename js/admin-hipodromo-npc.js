/* =============================================================================
   PESTAÑA «PERSONAJES» (panel de Admin): maneja a los personajes del Hipódromo (js/hipodromo-npc.js), SQL en docs/admin/hipodromo_personajes.sql
   Qué se puede hacer desde aquí:
   - Ajustes generales: apagar o encender a todos, la escala de las apuestas de la tribuna y cuántas noticias de personajes salen por carrera.
   - Por personaje: pausarlo o reanudarlo, y cambiar quién es (nombre, apodo, cuadra, lema, historia), su dinero (reserva, tope, gasto, préstamo), a qué
     categorías y distancias apunta a sus criaturas, cómo las gestiona (compra, venta, entrenamiento, cuidado, táctica), cómo apuesta y qué dice.
   - Órdenes puntuales: sumar, restar o fijar su caja, darle una criatura del mundo, quitarle una, venderla a la casa, soltarlas todas, forzar un préstamo o
     reiniciarlo (caja y criaturas de salida).
   - Crear personajes nuevos (a partir de uno existente) y borrar los que se han creado aquí.
   Los ajustes se guardan solo con lo que se ha cambiado respecto a los valores de fábrica del código («Volver a los de fábrica» los borra). La Edge Function
   hipodromo-avanzar los lee en cada paso, así que se notan en menos de un minuto (al instante si el aviso de la base de datos llega).
============================================================================= */
(function () {
  const panel = document.getElementById("adminPanelPersonajes");
  if (!panel) return;
  const N = window.HipodromoNPC;
  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const estado = (t, error) => { const e = $("adminNpcEstado"); e.textContent = t || ""; e.classList.toggle("admin-error", !!error); };
  if (!N) { estado("No se cargó js/hipodromo-npc.js.", true); return; }

  let sb = null, ajustes = {}, ordenes = [], vivo = null, criaturas = {}, libres = null, abierto = null, cargado = 0, ocupado = false;
  const tablaFalta = e => e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|Could not find the table/i.test(e.message || ""));
  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const confirmar = (msg, aceptar) => (window.dialogo ? window.dialogo.confirmar(msg, { titulo: "Personajes", aceptar }) : Promise.resolve(window.confirm(msg)));

  const personajes = () => N.REPARTO.map(p => p.id).concat(Object.keys(ajustes).filter(k => k !== "global" && !N.PERSONAJE[k] && N.ID_NPC.test(k) && ajustes[k] && ajustes[k].nuevo)).map(id => N.efectiva(id, ajustes[id]));
  const general = () => { const g = ajustes.global || {}; return { activo: g.activo !== false, apuestas: g.apuestas == null ? 1 : Number(g.apuestas), noticias: g.noticias == null ? N.AJUSTE.MAX_NOTICIAS : Number(g.noticias) }; };
  const enVivo = id => ((vivo && vivo.cuadrasNpc) || []).find(x => x.id === id) || null;
  const nombreCri = id => (criaturas[id] ? criaturas[id].nombre : "n.º " + id);

  /* ---------------------------------------------------------------- datos */
  async function cargar(forzar, mantener) {   // mantener: deja el mensaje que ya hay (lo que acaba de pasar) en vez de borrarlo
    if (!forzar && Date.now() - cargado < 15000) return;
    if (!mantener) estado("Cargando...");
    try {
      sb = sb || await fichasCliente();
      const [aj, od, pr] = await Promise.all([
        sb.from("hipodromo_npc_ajustes").select("clave, datos"),
        sb.from("hipodromo_npc_ordenes").select("id, datos, estado, texto, creada").order("id", { ascending: false }).limit(15),
        sb.from("hipodromo_programa").select("n, publico").order("n", { ascending: false }).limit(1)
      ]);
      if (aj.error) { if (tablaFalta(aj.error)) { estado("Falta ejecutar docs/admin/hipodromo_personajes.sql en el SQL Editor de Supabase.", true); return; } throw aj.error; }
      if (od.error) throw od.error;
      ajustes = {}; (aj.data || []).forEach(a => { ajustes[a.clave] = a.datos; });
      ordenes = od.data || [];
      vivo = pr.data && pr.data[0] ? Object.assign({ n: pr.data[0].n }, pr.data[0].publico) : null;
      const ids = []; ((vivo && vivo.cuadrasNpc) || []).forEach(x => x.criaturas.forEach(i => ids.push(i)));
      if (ids.length) { const cr = await sb.from("hipodromo_criaturas").select("id, nombre, estado, salidas, victorias").in("id", ids); (cr.data || []).forEach(x => { criaturas[x.id] = x; }); }
      cargado = Date.now(); if (!mantener) estado("");
      pintar();
    } catch (e) { estado(`No se pudo cargar: ${e.message || e}`, true); }
  }
  async function guardar(clave, datos) {
    const sinNada = !datos || !Object.keys(datos).length;
    const { error } = sinNada ? await sb.rpc("hipodromo_npc_quitar", { p_clave: clave }) : await sb.rpc("hipodromo_npc_guardar", { p_clave: clave, p_datos: datos });
    if (error) throw error;
  }
  /* Manda una orden puntual y espera a que el servidor la aplique (suele tardar 1 a 4 segundos) */
  async function mandar(datos) {
    if (ocupado) return; ocupado = true; estado("Enviando la orden...");
    try {
      const { data: id, error } = await sb.rpc("hipodromo_npc_orden", { p_datos: datos });
      if (error) throw error;
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, i < 10 ? 1000 : 3000));
        const { data } = await sb.from("hipodromo_npc_ordenes").select("estado, texto").eq("id", id).maybeSingle();
        if (data && data.estado !== "pendiente") { estado((data.estado === "hecha" ? "Hecho. " : "No se pudo. ") + (data.texto || ""), data.estado !== "hecha"); libres = null; await cargar(true, true); ocupado = false; return; }
      }
      estado("La orden sigue en cola: se aplicará en cuanto la procese el servidor (el primer paso después de la hora en punto).");
    } catch (e) { estado(`No se pudo mandar: ${e.message || e}`, true); }
    ocupado = false;
  }

  /* ---------------------------------------------------------------- general y tarjetas */
  function pintarGeneral() {
    const g = general();
    $("adminNpcGeneral").innerHTML = `<label class="admin-npc-check"><input type="checkbox" id="npcGenActivo"${g.activo ? " checked" : ""}> Los personajes juegan (si lo apagas, todos se quedan quietos: no compran, venden, entrenan ni apuestan; sus criaturas siguen corriendo)</label>
      <div class="admin-npc-fila"><label>Escala de las apuestas de la tribuna <input type="number" id="npcGenApuestas" min="0" max="3" step="0.25" value="${esc(g.apuestas)}"></label><small>0 = no apuestan. 1 = lo normal (unos 40 tokens por carrera entre todos). Máximo 3.</small></div>
      <div class="admin-npc-fila"><label>Noticias de personajes por carrera <input type="number" id="npcGenNoticias" min="0" max="3" step="1" value="${esc(g.noticias)}"></label><small>Como mucho. 0 = no salen en las noticias.</small></div>
      <button type="button" class="admin-cuenta-accion" data-npc="guardar-general">Guardar ajustes generales</button>`;
  }
  const chip = (t, c) => `<span class="admin-npc-chip ${c || ""}">${esc(t)}</span>`;
  function pintarTarjetas() {
    const g = general(), tri = (vivo && vivo.tribuna) || [];
    $("adminNpcLista").innerHTML = personajes().map(P => {
      const v = enVivo(P.id), apuesta = tri.filter(b => b.npc === P.id).reduce((t, b) => t + b.monto, 0);
      const est = !v ? chip("Sin llegar", "gris") : !g.activo ? chip("Todos pausados", "gris") : !P.activo ? chip("Pausado", "gris") : chip("Activo", "bien");
      const cri = v ? v.criaturas.map(id => esc(nombreCri(id))).join(", ") : "";
      return `<article class="admin-npc${abierto === P.id ? " admin-npc-abierto" : ""}" data-id="${esc(P.id)}">
        <header><h3>${esc(P.nombre)}</h3><small>${esc(P.apodo)}${P.cuadra ? " · " + esc(P.cuadra) : " · de la grada"}${P.nuevo ? " · creado por ti" : ""}</small>${est}</header>
        <p class="admin-npc-datos">${v ? `Caja: <b>${esc(v.saldo)}</b> tokens` : "Todavía no ha llegado al hipódromo"}${P.cuadra && v ? `<br>Criaturas: ${cri || "ninguna"}` : ""}${apuesta ? `<br>Apuesta ahora: <b>${esc(apuesta)}</b> tokens al pozo` : ""}</p>
        <div class="admin-npc-botones"><button type="button" class="admin-cuenta-accion" data-npc="editar">${abierto === P.id ? "Cerrar" : "Editar y acciones"}</button>
          <button type="button" class="admin-cuenta-accion" data-npc="pausar">${P.activo ? "Pausar" : "Reanudar"}</button></div></article>`;
    }).join("");
  }

  /* ---------------------------------------------------------------- editor */
  const num = (id, etq, v, extra) => `<label>${etq} <input type="number" id="npc-${id}" value="${v == null ? "" : esc(v)}" ${extra || ""}></label>`;
  const sel = (id, etq, v, ops) => `<label>${etq} <select id="npc-${id}">${ops.map(([k, t]) => `<option value="${esc(k ?? "")}"${(k ?? "") === (v ?? "") ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;
  const txt = (id, etq, v, max) => `<label>${etq} <input type="text" id="npc-${id}" maxlength="${max}" value="${esc(v ?? "")}"></label>`;
  const check = (id, etq, v) => `<label class="admin-npc-check"><input type="checkbox" id="npc-${id}"${v ? " checked" : ""}> ${etq}</label>`;
  const STATS = [["debil", "La más floja de cada una"], ["vel", "Velocidad"], ["res", "Resistencia"], ["ace", "Arranque"], ["agi", "Agilidad"], ["tem", "Temple"]];
  const FRASES_ETQ = { compra: "Cuando ficha a una criatura", vende: "Cuando vende una", gana: "Cuando gana una de sus criaturas", ganaApuesta: "Cuando acierta una apuesta", pierdeApuesta: "Cuando pierde una apuesta", prestamo: "Cuando pide un préstamo" };
  function formulario(P) {
    const a = P.apuesta || { estilo: "favorita", prob: 0.5, monto: 10, maxCuota: 3.4, minCuota: 9, puertas: [7, 3] }, c = P.compra || { prob: 0.02, criterio: "baratas", tamano: 3 }, p = P.prestamo;
    return `<fieldset><legend>Quién es</legend><div class="admin-npc-rejilla">${txt("nombre", "Nombre", P.nombre, 40)}${txt("apodo", "Apodo", P.apodo, 30)}${txt("cuadra", "Cuadra (vacío = solo apuesta desde la grada)", P.cuadra, 40)}${txt("lema", "Lema", P.lema, 120)}</div>
        <label>Su historia <textarea id="npc-bio" rows="3" maxlength="400">${esc(P.bio)}</textarea></label></fieldset>
      <fieldset><legend>Dinero</legend><div class="admin-npc-rejilla">${num("reserva", "Reserva (no gasta por debajo de esto)", P.reserva, 'min="0"')}${num("tope", "Tope de caja (lo que pasa se le va)", P.tope, 'min="0"')}${num("gasto", "Gasto por criatura y carrera", P.gasto, 'min="0" step="0.5"')}
        ${num("prestamo-piso", "Pide préstamo si baja de (vacío = nunca)", p ? p.piso : "", 'min="0"')}${num("prestamo-monto", "Importe del préstamo", p ? p.monto : "", 'min="0"')}${num("hora", "Hora del día en que lo pide (0 a 23)", P.hora, 'min="0" max="23"')}</div></fieldset>
      <fieldset><legend>Dónde corren sus criaturas</legend><p class="admin-npc-ayuda">Cuánto le gusta cada categoría: 1 = siempre la acepta, 0 = nunca, 0,5 = la mitad de las veces. Corren con las reglas del mundo (el mismo cansancio y el mismo emparejamiento): esto solo decide a qué campos las apunta.</p>
        <div class="admin-npc-rejilla">${num("g-gran", "Gran Premio", P.grados.gran, 'min="0" max="1" step="0.05"')}${num("g-selecta", "Selecta", P.grados.selecta, 'min="0" max="1" step="0.05"')}${num("g-corriente", "Corriente", P.grados.corriente, 'min="0" max="1" step="0.05"')}${num("g-novatos", "Novatos", P.grados.novatos, 'min="0" max="1" step="0.05"')}${num("copas", "Copas", P.copas, 'min="0" max="1" step="0.05"')}
        ${sel("dist", "Distancia preferida", P.dist, [["", "Cualquiera"], ["larga", "Larga (2000 m o más)"], ["corta", "Corta (1600 m o menos)"]])}${sel("tactica", "Táctica de sus criaturas", P.tactica, [["", "A su aire"], ["frente", "Al frente"], ["media", "A media tabla"], ["atras", "Desde atrás"]])}</div></fieldset>
      <fieldset><legend>Cómo las gestiona</legend><div class="admin-npc-rejilla">${check("compra-on", "Compra criaturas del mercado", !!P.compra)}${num("compra-prob", "Probabilidad de comprar cada hora", c.prob, 'min="0" max="0.3" step="0.01"')}
        ${sel("compra-criterio", "Qué busca", c.criterio, [["baratas", "Buena relación calidad y precio"], ["baratisimas", "Lo más barato"], ["flechas", "Flechas (cuerpos veloces)"], ["jovenes", "Crías y potros"], ["largas", "Maratonistas y Tanques"], ["valor", "Estrellas por precio (valor)"]])}${num("compra-tamano", "Cuadra de hasta (1 a 4)", c.tamano, 'min="1" max="4"')}
        ${check("vende", "Vende las que no rinden cuando le falta dinero", P.vende)}${num("entrena", "Probabilidad de entrenar cada hora (0 a 0,2)", P.entrena, 'min="0" max="0.2" step="0.005"')}${sel("stat", "Qué entrena", P.stat, STATS)}${num("cuida", "Cuida a las que pasan de este cansancio (vacío = nunca)", P.cuida, 'min="0" max="100"')}</div></fieldset>
      <fieldset><legend>Apuestas al pozo</legend><div class="admin-npc-rejilla">${check("ap-on", "Apuesta", !!P.apuesta)}
        ${sel("ap-estilo", "Cómo elige", a.estilo, [["favorita", "A la favorita (si su cuota no pasa del máximo)"], ["vanidad", "A su mejor criatura inscrita"], ["longshots", "A las de cuota alta"], ["valor", "Donde ve la cuota mal puesta"], ["racha", "A la que lleva racha"], ["puerta", "A una puerta de la suerte"], ["terreno", "A la que rinde en el terreno de hoy"]])}
        ${num("ap-prob", "Probabilidad de apostar cada carrera", a.prob, 'min="0" max="1" step="0.05"')}${num("ap-monto", "Cuánto, en tokens (se varía algo)", a.monto, 'min="1" max="200"')}
        ${num("ap-max", "Cuota máxima (a la favorita)", a.maxCuota, 'min="1" step="0.1"')}${num("ap-min", "Cuota mínima (a las de cuota alta)", a.minCuota, 'min="1" step="0.5"')}${txt("ap-puertas", "Puertas de la suerte, separadas por comas", (a.puertas || []).join(", "), 20)}</div></fieldset>
      <fieldset><legend>Qué dice (una frase por línea; se elige al azar)</legend><div class="admin-npc-rejilla">${N.FRASES_TIPOS.map(t => `<label>${FRASES_ETQ[t]} <textarea id="npc-f-${t}" rows="3">${esc((P.frases[t] || []).join("\n"))}</textarea></label>`).join("")}</div></fieldset>
      <fieldset><legend>Con qué empieza (solo cuenta al llegar o al reiniciarlo)</legend><div class="admin-npc-rejilla">${num("i-saldo", "Caja inicial", P.inicio.saldo, 'min="0"')}
        ${sel("i-tipo", "Criaturas con las que empieza", P.inicio.tipo, [["", "Ninguna"], ["elite", "De las mejores del mundo"], ["media", "De nivel medio-alto"], ["baja", "De nivel bajo"], ["joven", "Jóvenes"], ["uno", "Una buena"], ["largas", "Las de mejor pecho (distancias largas)"]])}${num("i-n", "Cuántas (0 a 4)", P.inicio.n, 'min="0" max="4"')}</div></fieldset>`;
  }
  const V = id => $("npc-" + id);
  const n = (id, def) => { const x = V(id).value.trim(); return x === "" ? def : Number(x); };
  /* Lo que hay en el formulario, como un personaje */
  function leer(id) {
    const piso = n("prestamo-piso", null), monto = n("prestamo-monto", null), pu = V("ap-puertas").value.split(",").map(x => Number(x.trim())).filter(x => x > 0);
    return N.sanear({ id, nuevo: !N.PERSONAJE[id], activo: (ajustes[id] || {}).activo !== false,
      nombre: V("nombre").value, apodo: V("apodo").value, cuadra: V("cuadra").value, lema: V("lema").value, bio: V("bio").value,
      reserva: n("reserva", 0), tope: n("tope", 0), gasto: n("gasto", 0), hora: n("hora", 0), prestamo: piso == null || monto == null ? null : { piso, monto },
      grados: { gran: n("g-gran", 1), selecta: n("g-selecta", 1), corriente: n("g-corriente", 1), novatos: n("g-novatos", 1) }, copas: n("copas", 0), dist: V("dist").value || null, tactica: V("tactica").value || null,
      compra: V("compra-on").checked ? { prob: n("compra-prob", 0.02), criterio: V("compra-criterio").value, tamano: n("compra-tamano", 3) } : null, vende: V("vende").checked, entrena: n("entrena", 0), stat: V("stat").value, cuida: n("cuida", null),
      apuesta: V("ap-on").checked ? { estilo: V("ap-estilo").value, prob: n("ap-prob", 0.5), monto: n("ap-monto", 10), maxCuota: n("ap-max", 3.4), minCuota: n("ap-min", 9), puertas: pu.length ? pu : [7, 3] } : null,
      frases: Object.fromEntries(N.FRASES_TIPOS.map(t => [t, V("f-" + t).value.split("\n").map(x => x.trim()).filter(Boolean)])),
      inicio: { saldo: n("i-saldo", 0), tipo: V("i-tipo").value || null, n: n("i-n", 0) } });
  }
  /* De lo que hay en el formulario a lo que se guarda: solo lo que cambia respecto a los valores de fábrica (o todo, en un personaje nuevo) */
  function diferencias(id, P) {
    const nuevo = !N.PERSONAJE[id], base = nuevo ? {} : N.efectiva(id, {}), over = {};
    ["nombre", "apodo", "cuadra", "lema", "bio", "reserva", "tope", "gasto", "hora", "copas", "dist", "tactica", "cuida", "entrena", "stat", "vende", "prestamo", "grados", "compra", "apuesta", "inicio"].forEach(k => { if (nuevo || !igual(P[k], base[k])) over[k] = P[k]; });
    const fr = {}; N.FRASES_TIPOS.forEach(t => { if (nuevo || !igual(P.frases[t], (base.frases || {})[t])) fr[t] = P.frases[t]; }); if (Object.keys(fr).length) over.frases = fr;
    if (P.activo === false) over.activo = false;
    if (nuevo) over.nuevo = true;
    return over;
  }

  async function acciones(P) {
    const v = enVivo(P.id);
    if (!libres) {
      try { const r = await sb.from("hipodromo_criaturas").select("id, nombre, salidas, victorias").is("dueno", null).eq("estado", "activo").order("victorias", { ascending: false }).limit(150); libres = r.data || []; } catch (e) { libres = []; }
    }
    const suyas = v ? v.criaturas : [];
    return `<fieldset><legend>Órdenes (se aplican al momento, con las reglas del motor)</legend>
      ${v ? "" : '<p class="admin-npc-ayuda">Todavía no ha llegado al hipódromo: las órdenes se rechazarán hasta que llegue.</p>'}
      <div class="admin-npc-fila"><label>Caja <input type="number" id="npc-orden-caja" value="500" step="50"></label>
        <button type="button" class="admin-cuenta-accion" data-npc="caja-sumar">Sumar</button><button type="button" class="admin-cuenta-accion" data-npc="caja-restar">Restar</button><button type="button" class="admin-cuenta-accion" data-npc="caja-fijar">Dejar en</button></div>
      ${P.cuadra ? `<div class="admin-npc-fila"><label>Darle una criatura del mundo <select id="npc-orden-dar"><option value="">Elegir...</option>${libres.map(c => `<option value="${c.id}">${esc(c.nombre)} (${c.salidas} salidas, ${c.victorias} victorias)</option>`).join("")}</select></label><button type="button" class="admin-cuenta-accion" data-npc="dar">Darla</button></div>
      <div class="admin-npc-fila"><label>Una de las suyas <select id="npc-orden-suya"><option value="">Elegir...</option>${suyas.map(id => `<option value="${id}">${esc(nombreCri(id))}</option>`).join("")}</select></label>
        <button type="button" class="admin-cuenta-accion" data-npc="quitar">Devolverla al mundo</button><button type="button" class="admin-cuenta-accion" data-npc="vender">Venderla a la casa</button></div>
      <div class="admin-npc-fila"><button type="button" class="admin-cuenta-accion" data-npc="soltar">Soltar a todas</button><button type="button" class="admin-cuenta-accion" data-npc="reiniciar">Reiniciar (caja y criaturas de salida)</button></div>` : ""}
      <div class="admin-npc-fila"><button type="button" class="admin-cuenta-accion" data-npc="prestamo">Forzar su préstamo ahora</button></div></fieldset>`;
  }
  async function pintarEditor() {
    const caja = $("adminNpcEditor");
    if (!abierto) { caja.innerHTML = ""; return; }
    const P = personajes().find(x => x.id === abierto); if (!P) { abierto = null; caja.innerHTML = ""; return; }
    caja.innerHTML = `<h3>${esc(P.nombre)} <small>${esc(P.id)}</small></h3>${formulario(P)}
      <div class="admin-npc-guardar"><button type="button" class="admin-cuenta-accion admin-dlg-guardar" data-npc="guardar">Guardar cambios</button>
        ${P.nuevo ? '<button type="button" class="admin-cuenta-accion admin-cuenta-peligro" data-npc="borrar">Borrar este personaje</button>' : '<button type="button" class="admin-cuenta-accion admin-cuenta-peligro" data-npc="fabrica">Volver a los de fábrica</button>'}</div>
      <div id="adminNpcAcciones"></div>`;
    $("adminNpcAcciones").innerHTML = await acciones(P);
    caja.scrollIntoView({ block: "nearest" });
  }
  function pintarOrdenes() {
    $("adminNpcOrdenes").innerHTML = ordenes.length ? `<table class="admin-cal-tabla"><thead><tr><th>N.º</th><th>Cuándo</th><th>Personaje</th><th>Orden</th><th>Resultado</th></tr></thead><tbody>${ordenes.map(o => {
      const d = o.datos || {}, nom = (personajes().find(p => p.id === d.npc) || {}).nombre || d.npc;
      const que = { caja: `caja: ${d.modo === "fijar" ? "dejar en" : "sumar"} ${d.monto}`, dar: `dar ${nombreCri(d.criatura)}`, quitar: `devolver ${nombreCri(d.criatura)}`, vender: `vender ${nombreCri(d.criatura)}`, soltar: "soltar a todas", prestamo: "préstamo", reiniciar: "reiniciar" }[d.tipo] || d.tipo;
      return `<tr><td>${o.id}</td><td>${esc(new Date(o.creada).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</td><td>${esc(nom)}</td><td>${esc(que)}</td><td>${o.estado === "pendiente" ? "esperando..." : esc((o.estado === "hecha" ? "" : "no: ") + (o.texto || ""))}</td></tr>`;
    }).join("")}</tbody></table>` : '<p class="admin-vacio">Todavía no has mandado ninguna orden.</p>';
  }
  function pintarNuevo() {
    const ops = personajes().map(P => `<option value="${esc(P.id)}">${esc(P.nombre)}</option>`).join("");
    $("adminNpcNuevo").innerHTML = `<div class="admin-npc-fila"><label>Nombre <input type="text" id="npcNuevoNombre" maxlength="40" placeholder="Doña Tomasa Brea"></label>
      <label>Partir de <select id="npcNuevoBase">${ops}</select></label><button type="button" class="admin-cuenta-accion" data-npc="crear">Crear personaje</button></div>
      <small>Se crea como una copia del que elijas (con otro nombre) y luego lo editas. Llega al hipódromo en el siguiente paso, con su caja y sus criaturas.</small>`;
  }
  function pintar() { pintarGeneral(); pintarTarjetas(); pintarOrdenes(); pintarNuevo(); pintarEditor(); }

  /* ---------------------------------------------------------------- acciones de los botones */
  const slug = t => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20);
  panel.addEventListener("click", async e => {
    const b = e.target.closest("[data-npc]"); if (!b || b.disabled) return;
    const que = b.dataset.npc, tarjeta = b.closest(".admin-npc"), id = tarjeta ? tarjeta.dataset.id : abierto;
    try {
      if (que === "editar") { abierto = abierto === id ? null : id; libres = null; pintarTarjetas(); await pintarEditor(); return; }
      if (que === "pausar") {
        const P = personajes().find(x => x.id === id), over = Object.assign({}, ajustes[id] || {});
        if (P.activo) over.activo = false; else delete over.activo;
        await guardar(id, over); estado(P.activo ? `${P.nombre} queda pausado.` : `${P.nombre} vuelve a jugar.`); await cargar(true, true); return;
      }
      if (que === "guardar-general") {
        const g = { activo: $("npcGenActivo").checked, apuestas: Math.min(3, Math.max(0, Number($("npcGenApuestas").value) || 0)), noticias: Math.min(3, Math.max(0, Math.round(Number($("npcGenNoticias").value) || 0))) };
        const sobra = {}; if (!g.activo) sobra.activo = false; if (g.apuestas !== 1) sobra.apuestas = g.apuestas; if (g.noticias !== N.AJUSTE.MAX_NOTICIAS) sobra.noticias = g.noticias;
        await guardar("global", sobra); estado("Ajustes generales guardados."); await cargar(true, true); return;
      }
      if (que === "guardar") {
        const P = leer(abierto), over = diferencias(abierto, P);
        await guardar(abierto, over); estado(Object.keys(over).length ? "Cambios guardados. Se notan en menos de un minuto." : "No hay cambios respecto a los de fábrica."); await cargar(true, true); return;
      }
      if (que === "fabrica") { if (!(await confirmar("Se borran todos los cambios de este personaje y vuelve a los valores de fábrica.", "Volver"))) return; await guardar(abierto, null); estado("Vuelve a los de fábrica."); await cargar(true, true); return; }
      if (que === "borrar") { if (!(await confirmar("Se borra el personaje: sus criaturas vuelven al mundo y desaparece su caja.", "Borrar"))) return; const o = abierto; abierto = null; await guardar(o, null); estado("Personaje borrado: sus criaturas vuelven al mundo en el siguiente paso."); await cargar(true, true); return; }
      if (que === "crear") {
        const nombre = $("npcNuevoNombre").value.trim(); if (!nombre) { estado("Ponle un nombre.", true); return; }
        let nid = "npc:" + slug(nombre); if (!N.ID_NPC.test(nid)) { estado("Ese nombre no sirve para el identificador: usa letras y números.", true); return; }
        if (personajes().some(p => p.id === nid)) { estado("Ya hay un personaje con ese identificador.", true); return; }
        const base = Object.assign({}, personajes().find(p => p.id === $("npcNuevoBase").value)); delete base.id; delete base.activo;
        base.nombre = nombre; base.nuevo = true; base.apodo = ""; base.lema = ""; base.bio = "";
        await guardar(nid, base); abierto = nid; estado(`${nombre} creado. Edítalo y, en el siguiente paso, llegará al hipódromo.`); await cargar(true, true); return;
      }
      // órdenes puntuales
      const base = { npc: abierto };
      const caja = Number($("npc-orden-caja") && $("npc-orden-caja").value);
      if (que === "caja-sumar" || que === "caja-restar" || que === "caja-fijar") {
        if (!Number.isFinite(caja)) { estado("Escribe un importe.", true); return; }
        await mandar(Object.assign(base, { tipo: "caja", modo: que === "caja-fijar" ? "fijar" : "sumar", monto: que === "caja-restar" ? -Math.abs(caja) : que === "caja-sumar" ? Math.abs(caja) : caja })); return;
      }
      if (que === "dar") { const c = Number($("npc-orden-dar").value); if (!c) { estado("Elige una criatura.", true); return; } await mandar(Object.assign(base, { tipo: "dar", criatura: c })); return; }
      if (que === "quitar" || que === "vender") { const c = Number($("npc-orden-suya").value); if (!c) { estado("Elige una de sus criaturas.", true); return; } await mandar(Object.assign(base, { tipo: que, criatura: c })); return; }
      if (que === "soltar") { if (!(await confirmar("Todas sus criaturas vuelven al mundo.", "Soltar"))) return; await mandar(Object.assign(base, { tipo: "soltar" })); return; }
      if (que === "reiniciar") { if (!(await confirmar("Suelta a todas sus criaturas, deja su caja en la inicial y le busca criaturas nuevas.", "Reiniciar"))) return; await mandar(Object.assign(base, { tipo: "reiniciar" })); return; }
      if (que === "prestamo") { await mandar(Object.assign(base, { tipo: "prestamo" })); return; }
    } catch (err) { estado(`No se pudo: ${err.message || err}`, true); }
  });
  document.querySelector('[data-tab="personajes"]').addEventListener("click", () => cargar(false));
})();
