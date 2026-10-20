/* =============================================================================
   HIPÓDROMO. Dos modos con la misma pantalla:
   - Servidor (el normal, con sesión): el mundo es uno solo para todos y lo escribe la Edge Function. La página lo lee
     (js/hipodromo-online.js), apuesta y manda órdenes a la cuadra con funciones que comprueban saldo y plazo.
   - Prueba local (sin sesión, sin servidor o con ?local en la dirección): el mundo de js/hipodromo-motor.js corre entero
     en este navegador y se guarda en localStorage. El reloj es virtual para adelantar el tiempo; los tokens son de aquí.
   Mira docs/hipodromo.md.
============================================================================= */
(function () {
  "use strict";
  const M = window.HipodromoMotor, D = window.HipodromoDibujo;
  if (!M || !D) return;
  const C = M.C, POR_DIA = 1440 / C.MINUTOS;   // carreras al día
  const YO = "yo";   // en modo local el único dueño eres tú
  const CLAVE = "hipodromoLocal", CLAVE_OCULTO = "hipodromoOculto", CLAVE_PESTANA = "hipodromoPestana";
  const SALDO_INICIAL = 1000, MAX_NOTICIAS = 200, MAX_ARCHIVO = 250, MAX_RESULTADOS = 12, MAX_HISTORIAL = 80;
  const VELOCIDADES = [[0, "Pausa"], [1, "1×"], [10, "10×"], [60, "60×"], [600, "600×"]];
  const FASES = { abierta: "Apuestas abiertas", cerrada: "Apuestas cerradas", corriendo: "En pista", terminada: "Resultado" };
  const TIPOS_NOTICIA = { resultado: "Carrera", lesion: "Lesión", accidente: "Establo", enfermedad: "Salud", fuga: "Fuga", regreso: "Regreso", muerte: "Adiós", retiro: "Retiro", nacimiento: "Nacimiento", racha: "Racha", debut: "Debut", record: "Récord", rumor: "Rumor", suspendida: "Aviso" };

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const coma = (x, d) => Number(x).toFixed(d == null ? 1 : d).replace(".", ",");
  const pad = n => String(n).padStart(2, "0");
  const horaTxt = ms => new Date(ms).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), mi = Math.floor(s / 60) % 60; return h ? `${h}:${pad(mi)}:${pad(s % 60)}` : `${pad(mi)}:${pad(s % 60)}`; };
  const monedas = x => (Math.round(x * 100) / 100).toLocaleString("es", { maximumFractionDigits: 2 });
  const T = (clave, texto) => (window.HipodromoGlosario ? window.HipodromoGlosario.tip(clave, texto) : texto);   // palabra técnica con su explicación al señalarla
  const poner = (el, html) => { if (el && el._h !== html) { el.innerHTML = html; el._h = html; } };
  const textoDe = (el, t) => { if (el && el._t !== t) { el.textContent = t; el._t = t; } };

  let cuadraUI = null, cartasUI = null, online = null;
  let est = null, m = null, pestana = "carrera", oculto = false, escena = null, fichaId = null, ultimoMarco = 0, ultimoPintado = 0, mostrarMas = 48, nUI = -1, velEfectiva = 1;
  const filtros = { estado: "pista", orden: "vic", q: "" };
  try { oculto = localStorage.getItem(CLAVE_OCULTO) === "1"; pestana = localStorage.getItem(CLAVE_PESTANA) || "carrera"; } catch (e) { /* sin almacenamiento */ }
  // la página en vivo manda aquí con #carrera, #noticias... (apostar, resultados completos)
  { const h = location.hash.slice(1); if (["carrera", "cuadra", "cartas", "criaturas", "noticias", "apuestas", "mundo"].includes(h)) pestana = h; }

  /* ---------------------------------------------------------------- guardar y crear */
  function cargar() {
    try { const g = JSON.parse(localStorage.getItem(CLAVE)); if (g && g.v === 1 && g.mundo && g.mundo.proxima) { g.avisos = g.avisos || []; return g; } } catch (e) { /* vacío o dañado */ }
    return null;
  }
  function guardar() {
    if (!est) return;
    if (online) { online.guardarFavoritos(); return; }
    try { localStorage.setItem(CLAVE, JSON.stringify(est)); }
    catch (e) {
      try { const ids = Object.keys(est.archivo).slice(-60); const nuevo = {}; ids.forEach(i => { nuevo[i] = est.archivo[i]; }); est.archivo = nuevo; localStorage.setItem(CLAVE, JSON.stringify(est)); }
      catch (e2) { /* sin espacio: se sigue sin guardar */ }
    }
  }
  function crear(semilla) {
    $("hipCargando").textContent = "Creando el mundo, con 300 carreras de historia...";
    $("hipCargando").classList.remove("hidden");
    document.querySelector(".hip-pagina").classList.add("cargando");
    setTimeout(() => {
      const r = M.paso(null, Date.now(), { calentar: 300, semilla, simsCalentar: 12 });
      const mundo = r.lote.mundo;
      est = { v: 1, semilla, mundo, virtual: mundo.proxima.hora - 4 * 60000, vel: 10, saldo: SALDO_INICIAL, pendientes: [], historial: [], noticias: [], archivo: {}, resultados: [], favoritos: [], avisos: [], desde: Date.now() };
      m = est.mundo;
      nUI = -1; escena = null;
      guardar();
      $("hipCargando").classList.add("hidden");
      pintarTodo();
    }, 40);
  }
  const semillaAzar = () => "mundo-" + Math.random().toString(36).slice(2, 8);

  /* ---------------------------------------------------------------- datos de ayuda */
  const perfilDe = id => { if (online) return online.perfil(id); const c = M.buscar(m, id); return c ? M.perfil(m, c) : est.archivo[id] || null; };
  const nombreDe = id => { const p = perfilDe(id); return p ? p.nombre : "#" + id; };
  const edadDe = p => (m.n - p.nac) / C.ANIO;
  const edadTxt = p => { const e = edadDe(p); return e < 0 ? "por nacer" : `${coma(e, 1)} años`; };
  const sexoTxt = p => (p.sexo === "f" ? "Hembra" : "Macho");
  function estrellasTxt(x) {
    if (x == null) return '<span class="hip-sin">sin salidas</span>';
    const llenas = Math.floor(x), media = x - llenas >= 0.5;
    return `<span class="hip-estrellas" title="${coma(x, 1)} de 5">${"★".repeat(llenas)}${media ? "½" : ""}<i>${"★".repeat(5 - llenas - (media ? 1 : 0))}</i></span>`;
  }
  const chipPuesto = h => `<span class="hip-puesto ${h.pos === 1 ? "oro" : h.pos <= 3 ? "plata" : ""}" title="Carrera ${h.n}: ${h.pos}º de ${h.campo} sobre ${h.dist} m">${h.pos}º</span>`;
  const nombreBtn = (id, texto) => `<button type="button" class="hip-enlace" data-ficha="${id}">${esc(texto || nombreDe(id))}</button>`;
  function etiquetasEstado(p) {
    const e = [];
    if (p.estado === "fallecido") e.push(`<span class="hip-sello gris">${T("retirada", "Fallecida")}</span>`);
    else if (p.estado === "retirado") e.push(`<span class="hip-sello gris">${T("retirada", "Retirada")}</span>`);
    else if (p.estado === "criador") e.push(`<span class="hip-sello">${T("criador", "Cría")}</span>`);
    if (p.lesion) e.push(`<span class="hip-sello rojo">${T("lesion", esc(p.lesion.tipo))}</span>`);
    if (p.leyenda) e.push(`<span class="hip-sello oro">${T("leyenda", "Leyenda")}</span>`);
    return e.join("");
  }

  /* ---------------------------------------------------------------- el reloj y el paso del tiempo */
  function bucle(ts) {
    requestAnimationFrame(bucle);
    if (!est || !m) { ultimoMarco = ts; return; }
    if (online) {          // el reloj es el del servidor: la página no adelanta nada
      est.virtual = online.ahora(); velEfectiva = 1;
      pintarEscena();
      if (ts - ultimoPintado > 200) { ultimoPintado = ts; pintarReloj(); }
      return;
    }
    const dt = Math.min(1000, ts - ultimoMarco); ultimoMarco = ts;
    if (dt <= 0) return;
    let v = est.vel;
    const p = m.proxima, f = M.ventana(p, est.virtual);
    if (f === "corriendo" || f === "terminada") v = Math.min(v, 10);         // la carrera no se acelera más de 10×
    let nuevo = est.virtual + dt * v;
    if (v > 1 && est.virtual < p.hora && nuevo > p.hora) nuevo = p.hora;       // frena en la salida
    velEfectiva = v;
    est.virtual = nuevo;
    let tope = 0;
    while (est.virtual >= m.proxima.hora + C.APLICAR_SEG * 1000 && tope++ < 6) aplicar();
    pintarEscena();
    if (ts - ultimoPintado > 200) { ultimoPintado = ts; pintarReloj(); }
  }

  function aplicar() {
    const prog = m.proxima, n = prog.n;
    const ev = M.avanzar(m, { sims: C.SIMS });
    const res = ev.resultado;
    const msgs = [];
    if (res) {
      est.resultados.unshift(Object.assign({}, res, { tramos: undefined }));
      est.resultados.length = Math.min(est.resultados.length, MAX_RESULTADOS);
    }
    // el pozo se reparte entre todas las apuestas al pozo de esa carrera (aquí, solo las tuyas más el bote)
    const pozoPagos = new Map(), enPozo = est.pendientes.filter(ap => ap.n === n && ap.tipo === "pozo");
    const tribuna = (prog.tribuna || []).map(b => ({ id: "npc", sel: b.sel, monto: b.monto }));
    if (res && enPozo.length) M.pagarPozo(enPozo.map((ap, i) => ({ id: i, sel: ap.sel, monto: ap.monto })).concat(tribuna), res.llegada[0].id).slice(0, enPozo.length).forEach((x, i) => pozoPagos.set(enPozo[i], x.pago));
    const nuevas = [];
    est.pendientes = est.pendientes.filter(ap => {
      if (ap.n !== n) return true;
      if (!res) { est.saldo += ap.monto; est.historial.unshift(Object.assign({}, ap, { gana: false, pago: ap.monto, devuelta: true })); return false; }
      const r = ap.tipo === "pozo" ? { gana: res.llegada[0].id === ap.sel, pago: pozoPagos.get(ap) || 0 } : M.liquidar(ap, res);
      est.historial.unshift(Object.assign({}, ap, { gana: r.gana, pago: r.pago, ganador: res.llegada[0].nombre }));
      // doble: lo ganado no se cobra, pasa a ganador al favorito de la siguiente carrera si todavía se puede apostar
      const fav = r.gana && ap.doble ? M.favoritoDe(m.proxima) : null;
      if (fav && est.virtual < m.proxima.cierre) {
        nuevas.push({ n: m.proxima.n, tipo: "ganador", sel: fav.id, monto: r.pago, cuota: fav.cuota, nombres: [fav.nombre], carrera: m.proxima.nombre });
        msgs.push(`Ganaste ${monedas(r.pago)} tokens (${TIPOS_TXT(ap)}): pasan a ${fav.nombre} en la siguiente (doble)`);
        return false;
      }
      est.saldo += r.pago;
      msgs.push(r.gana ? `Ganaste ${monedas(r.pago)} tokens (${TIPOS_TXT(ap)})` : `Perdiste ${monedas(ap.monto)} tokens (${TIPOS_TXT(ap)})`);
      return false;
    });
    est.pendientes = est.pendientes.concat(nuevas);
    est.historial.length = Math.min(est.historial.length, MAX_HISTORIAL);
    ev.pagos.filter(q => q.dueno === YO).forEach(q => { est.saldo += q.monto; });
    est.avisos = ev.avisos.filter(a => a.dueno === YO).reverse().concat(est.avisos).slice(0, 60);
    const premio = ev.pagos.filter(q => q.dueno === YO && q.monto > 0 && /^Premio/.test(q.concepto)).reduce((t, q) => t + q.monto, 0);
    if (premio) msgs.push(`Tu cuadra cobra ${monedas(premio)} tokens de premios`);
    est.noticias = ev.noticias.slice().reverse().concat(est.noticias).slice(0, MAX_NOTICIAS);
    ev.perfiles.filter(p => p.estado === "retirado" || p.estado === "fallecido").forEach(p => { est.archivo[p.id] = p; });
    const ids = Object.keys(est.archivo);
    if (ids.length > MAX_ARCHIVO) ids.slice(0, ids.length - MAX_ARCHIVO).forEach(i => delete est.archivo[i]);
    nUI = -1; escena = null;
    if (msgs.length) avisar(msgs.join(" · "), msgs.some(x => x.startsWith("Ganaste")) ? "bien" : "mal");
    guardar();
    pintarTodo();
  }
  const TIPOS_TXT = ap => `${M.TIPOS_APUESTA[ap.tipo].nombre.toLowerCase()} a ${ap.nombres.join(" y ")}`;

  function avisar(texto, clase) {
    const el = $("hipAviso");
    el.textContent = texto; el.className = "hip-aviso " + (clase || "");
    clearTimeout(avisar._t); avisar._t = setTimeout(() => { el.textContent = ""; el.className = "hip-aviso"; }, 9000);
  }

  /* ---------------------------------------------------------------- reloj en pantalla */
  function pintarReloj() {
    const p = m.proxima, f = M.ventana(p, est.virtual);
    document.body.dataset.fase = f;
    let cuenta;
    if (f === "abierta") cuenta = `cierran en ${mmss(p.cierre - est.virtual)}`;
    else if (f === "cerrada") cuenta = `sale en ${mmss(p.hora - est.virtual)}`;
    else if (f === "corriendo") cuenta = mmss(p.hora + C.DURACION_SEG * 1000 - est.virtual);
    else cuenta = `siguiente en ${mmss(p.hora + C.APLICAR_SEG * 1000 - est.virtual)}`;
    textoDe($("hipFase"), FASES[f]);
    textoDe($("hipCuenta"), cuenta);
    textoDe($("hipRelojInfo"), `Carrera n.º ${p.n} · sale a las ${horaTxt(p.hora)} · hora del mundo ${horaTxt(est.virtual)}`);
    textoDe($("hipSaldo"), monedas(est.saldo));
    const saltar = $("hipSaltar");
    textoDe(saltar, f === "abierta" || f === "cerrada" ? "Ir a la salida" : f === "corriendo" ? "Saltar la carrera" : "Siguiente carrera");
    $("hipApostar").disabled = f !== "abierta" || !!p.suspendida;
    textoDe($("hipApuestaFlotaDato"), f === "abierta" ? "· cierra en " + mmss(p.cierre - est.virtual) : "· cerradas");
    $("hipVelocidad").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.vel) === est.vel)));
    const aviso = (f === "corriendo" || f === "terminada") && est.vel > 10 ? "Durante la carrera el reloj no pasa de 10×." : "";
    textoDe($("hipRelojNota"), aviso);
  }
  function saltar() {
    const p = m.proxima, f = M.ventana(p, est.virtual);
    if (f === "abierta" || f === "cerrada") est.virtual = p.hora;
    else if (f === "corriendo") est.virtual = p.hora + C.DURACION_SEG * 1000;
    else est.virtual = p.hora + C.APLICAR_SEG * 1000;
    pintarReloj();
  }

  /* ---------------------------------------------------------------- pestaña Carrera */
  function pronosticoTxt(p) {
    return p.pron.filter(x => x.prob > 0).sort((a, b) => b.prob - a.prob).map(x => `<span class="hip-chip">${esc(M.CLIMAS[x.clima].texto)} ${Math.round(x.prob * 100)} %</span>`).join("");
  }
  function pintarPrograma() {
    const p = m.proxima, pista = M.PISTAS[p.pista], G = M.GRADOS[p.grado];
    const humPrev = Math.max(0, Math.min(1, p.mojadoPrevio * 0.7 * (1 - 0.5 * pista.drenaje)));
    const barra = (v, t) => `<span class="hip-barrita" title="${t}: ${Math.round(v * 100)} %"><i style="width:${Math.round(v * 100)}%"></i></span>`;
    poner($("hipPrograma"), `
      <div class="hip-prog-cab">
        <div><p class="hip-grado${G.copa ? " copa" : ""}">${G.copa ? "★ " : ""}${T("grado_" + p.grado, esc(G.nombre))}</p><h2>${esc(p.nombre)}</h2></div>
        <div class="hip-prog-hora"><span>n.º ${p.n}</span><strong>${horaTxt(p.hora)}</strong></div>
      </div>
      <div class="hip-datos">
        <div><span>${T("pista", "Pista")}</span><strong>${esc(pista.nombre)}</strong><small>${T("suelo", esc(pista.suelo))} · ${T("terreno_" + M.etiquetaPista(humPrev), esc(M.etiquetaPista(humPrev)))}</small></div>
        <div><span>${T("distancia", "Distancia")}</span><strong>${p.dist} m</strong><small>${p.dist / 100} ${T("tramo", "tramos")}</small></div>
        <div><span>${T("bolsa", "Bolsa")}</span><strong>${monedas(p.bolsa)}</strong><small>reparto entre los 5 primeros</small></div>
        <div><span>Pista en detalle</span><small class="hip-barras">${T("curvas", "Curvas")} ${barra(pista.curvas, "Curvas")} ${T("cuestas", "Cuestas")} ${barra(pista.cuestas, "Cuestas")} ${T("drenaje", "Drenaje")} ${barra(pista.drenaje, "Drenaje")}</small></div>
      </div>
      ${G.copa ? `<p class="hip-copa-nota"><strong>${esc(G.nombre)}.</strong> Corren las mejores del mundo (el ${Math.round(G.copa.top * 100)} % mejor valorado) y la bolsa es de ${monedas(p.bolsa)}: ${monedas(Math.round(p.bolsa * 0.5))} para quien gane. Inscribir cuesta ${monedas(M.inscripcionDe(G))}.</p>` : ""}
      ${pista.arcana ? `<p class="hip-arcana"><strong>${T("arcana", "Pista arcana")} · ${esc(M.REGLAS_ARCANAS[pista.arcana].nombre)}.</strong> ${esc(M.REGLAS_ARCANAS[pista.arcana].texto)} Las criaturas con núcleo responden mejor aquí.</p>` : ""}
      <div class="hip-pron"><span>${T("pronostico", "Pronóstico")}</span>${pronosticoTxt(p)}</div>
      ${p.rumores.length ? `<ul class="hip-rumores">${p.rumores.map(r => `<li>${esc(r.texto)}</li>`).join("")}</ul>` : ""}
      ${p.suspendida ? '<p class="hip-vacio">No hay criaturas en condiciones de correr. La carrera se aplaza.</p>' : ""}`);
  }

  /* Las copas de la semana: las que caen en los próximos dos días, con lo que pide cada una y cuáles de tus criaturas llegan */
  function pintarCopas() {
    const el = $("hipCopas"); if (!el) return;
    let cal = [], mias = [];
    try { cal = (online ? online.calendario() : apiLocal.calendario()).filter(x => x.copa); mias = online ? online.mias() : apiLocal.mias(); } catch (e) { /* aún sin datos */ }
    const hora = new Date(Date.UTC(2026, 0, 5, C.HORA_COPAS)).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
    const dia = ms => new Date(ms).toLocaleDateString("es", { weekday: "long", day: "numeric" }) + ", " + horaTxt(ms);
    const items = cal.map(x => {
      const G = M.GRADOS[x.grado], llegan = mias.filter(e => ((e.c && e.c.copas) || []).includes(x.grado));
      return `<li class="hip-copa-item ${x.grado}"><div class="hip-copa-cab"><span class="hip-sello copa">★ ${esc(x.gradoNombre)}</span><strong>${esc(x.nombre)}</strong></div>
        <div class="hip-copa-datos"><span>${esc(dia(x.hora))}</span><span>${x.dist} m</span><span>${T("bolsa", "Bolsa")} <b>${monedas(x.bolsa)}</b></span><span>Inscribir <b>${monedas(x.inscripcion)}</b></span></div>
        <small>Solo el ${Math.round(G.copa.top * 100)} % mejor valorado del mundo, con al menos ${G.copa.salidas} salidas. ${mias.length ? (llegan.length ? `Llegan: ${llegan.map(e => esc(e.p.nombre)).join(", ")}.` : "Ninguna de las tuyas llega ahora mismo.") : ""}</small></li>`;
    }).join("");
    poner(el, `<h3>Copas de la semana</h3>
      <p class="hip-nota">Cada semana: el miércoles la Copa de Bronce, el viernes la de Plata y el domingo la de Oro (una de cada cuatro semanas, la de las Leyendas), a las ${hora} de tu hora. Solo corren las criaturas mejor valoradas del mundo. Pagan mucho más que un Gran Premio y su inscripción es más cara cuanto mayor es la copa. Se pueden inscribir con dos días de antelación desde Mi cuadra.</p>
      ${items ? `<ul class="hip-copa-lista">${items}</ul>` : '<p class="hip-vacio">No hay ninguna copa en los próximos dos días.</p>'}`);
  }

  function pintarTribuna() {
    const el = $("hipTribuna"); if (!el) return;
    const NPC = window.HipodromoNPC, ap = tribunaVisible(), tot = ap.reduce((t, b) => t + b.monto, 0);
    if (!NPC || !m.proxima || !m.proxima.tribuna) { poner(el, ""); el.classList.add("hidden"); return; }
    el.classList.remove("hidden");
    const items = ap.slice().reverse().slice(0, 8).map(b => `<li><strong>${esc(b.quien)}</strong> ${monedas(b.monto)} al pozo por <button type="button" class="hip-enlace" data-ficha="${b.sel}">${esc(b.criatura)}</button></li>`).join("");
    poner(el, `<h3>En la tribuna</h3>
      <p class="hip-nota">En la tribuna también se juega al pozo. Lo que ponen cuenta en el reparto igual que lo tuyo, y las apuestas van llegando durante la hora.</p>
      ${items ? `<ul class="hip-lista-apuestas hip-tribuna">${items}</ul><p class="hip-nota">${ap.length} ${ap.length === 1 ? "apuesta" : "apuestas"} de la tribuna, ${monedas(tot)} tokens en total.</p>` : '<p class="hip-vacio">Todavía no ha apostado nadie de la tribuna.</p>'}`);
  }
  /* Las cuadras del mundo: quién es cada personaje, qué criaturas tiene y cuánto hay en su caja */
  function pintarCuadrasNpc() {
    const el = $("hipCuadrasNpc"); if (!el) return;
    const NPC = window.HipodromoNPC, vivo = (m.proxima && m.proxima.cuadrasNpc) || [];
    if (!NPC || !vivo.length) { poner(el, ""); el.classList.add("hidden"); return; }
    el.classList.remove("hidden");
    const tarjetas = vivo.map(P => {
      const cri = P.criaturas.map(id => perfilDe(id)).filter(Boolean);
      return `<li class="hip-npc"><div class="hip-npc-cab"><strong>${esc(P.nombre)}</strong><small>${esc(P.apodo)}${P.cuadra ? " · " + esc(P.cuadra) : " · de la grada"}${P.activo === false ? " · descansando" : ""}</small></div>
        <p class="hip-npc-lema">«${esc(P.lema)}»</p><p class="hip-nota">${esc(P.bio)}</p>
        <p class="hip-npc-pie"><span>Caja: <b>${monedas(P.saldo)}</b></span>${P.cuadra ? `<span>${cri.length ? cri.map(p => `<button type="button" class="hip-enlace" data-ficha="${p.id}">${esc(p.nombre)}</button>`).join(", ") : "sin criaturas ahora"}</span>` : "<span>apuesta al pozo</span>"}</p></li>`;
    }).join("");
    poner(el, `<h3>Las cuadras del mundo</h3><p class="hip-nota">Dueños y aficionados del hipódromo. Cada uno tiene su caja y juega con las mismas reglas que tú. Sus criaturas corren en los mismos campos que las demás.</p><ul class="hip-npc-lista">${tarjetas}</ul>`);
  }

  function pintarInscritos() {
    const p = m.proxima, sec = p.secreto;
    const menor = p.entrantes.reduce((a, e) => (e.gan < a ? e.gan : a), Infinity);
    const items = p.entrantes.map((e, k) => {
      const per = perfilDe(e.id); if (!per) return "";
      const fav = est.favoritos.includes(e.id), real = sec && sec.pReal ? sec.pReal.gan[k] : null, mia = e.dueno && e.dueno.id === YO;
      const sellos = (e.gan === menor ? '<span class="hip-sello oro">Favorita</span>' : "") + (mia ? '<span class="hip-sello">★ Tuya</span>' : e.dueno ? `<span class="hip-sello gris">cuadra de ${esc(e.dueno.nombre || "otro jugador")}</span>` : "");
      return `<li class="hip-insc${mia ? " mia" : ""}${e.gan === menor ? " favorita" : ""}">
        <span class="hip-insc-pta" title="Puerta de salida">${e.puerta}</span>
        <div class="hip-insc-fig">${D.silueta(per, { clase: "hip-mini" })}</div>
        <div class="hip-insc-info">
          <div class="hip-insc-nombre"><button type="button" class="hip-enlace" data-ficha="${e.id}">${fav ? "♥ " : ""}${esc(per.nombre)}</button>${sellos}</div>
          <small>${sexoTxt(per)} · ${T("etapa", esc(per.etapa))} · ${edadTxt(per)}${per.arquetipo ? " · " + T("arq_" + norm(per.arquetipo), esc(per.arquetipo)) : ""}</small>
          <div class="hip-insc-meta">${estrellasTxt(per.estrellas)}<span class="hip-insc-rec">${per.salidas ? `${per.salidas} salidas · ${per.vic}-${per.seg}-${per.ter}` : "debuta"}</span><span class="hip-insc-ult">${per.ultimas.slice(0, 4).map(chipPuesto).join("") || ""}</span></div>
          ${oculto && real != null ? `<small class="hip-oculto-col">Real ${coma(real * 100, 1)} % · vale ${coma(real * e.gan, 2)}</small>` : ""}
        </div>
        <button type="button" class="hip-cuota-btn hip-insc-cuota" data-apostar="${e.id}" aria-label="Apostar a ${esc(per.nombre)}, cuota ${M.fmtCuota(e.gan)}"><span>Ganador</span><strong>${M.fmtCuota(e.gan)}</strong><small>${T("podio", "podio")} ${M.fmtCuota(e.pod)}</small></button>
      </li>`;
    }).join("");
    poner($("hipInscritos"), `<ol class="hip-insc-lista">${items}</ol>`);
  }

  /* boleto de apuesta: junto a las inscritas en pantalla ancha; en pantalla estrecha, una hoja que sube desde abajo */
  const esMovil = () => window.matchMedia("(max-width: 959px)").matches;
  function abrirBoleto(si) {
    $("hipPanelApuesta").classList.toggle("abierta", si);
    $("hipApuestaFlota").setAttribute("aria-expanded", String(si));
    document.body.classList.toggle("hip-con-boleto", si && esMovil());
  }

  // en pantalla estrecha el boleto se cierra solo y la confirmación queda arriba
  function cerrarBoletoTrasApostar(texto) { if (!esMovil()) return; avisar(texto, "bien"); setTimeout(() => abrirBoleto(false), 1200); }

  /* panel de apuestas */
  /* Lo que hay apostado ahora al pozo de la carrera que viene, por criatura: del servidor, o de tus apuestas en modo local */
  /* Las apuestas que ya ha hecho la tribuna (los personajes del hipódromo, js/hipodromo-npc.js): van llegando a lo largo de la hora, cada una a su hora */
  function tribunaVisible() {
    const t = (m.proxima && m.proxima.tribuna) || [], ahora = online ? online.ahora() : est.virtual;
    return t.filter(b => b.hora <= ahora);
  }
  function pozosAhora() {
    const t = {};
    if (online && est.pozos) Object.keys(est.pozos).forEach(k => { t[k] = est.pozos[k]; });
    else est.pendientes.filter(a => a.n === m.proxima.n && a.tipo === "pozo").forEach(a => { t[a.sel] = (t[a.sel] || 0) + a.monto; });
    tribunaVisible().forEach(b => { t[b.sel] = (t[b.sel] || 0) + b.monto; });
    return t;
  }
  function opcionesApuesta(tipo, quitar) {
    const p = m.proxima, pz = tipo === "pozo" ? pozosAhora() : null;
    return p.entrantes.filter(e => e.id !== quitar).map(e => `<option value="${e.id}">${e.puerta}. ${esc(e.nombre)}${tipo === "exacta" ? "" : tipo === "pozo" ? " (pozo " + monedas(pz[e.id] || 0) + ")" : " (" + M.fmtCuota(tipo === "podio" ? e.pod : e.gan) + ")"}</option>`).join("");
  }
  function pintarPanelApuesta(reset) {
    const tipo = $("hipTipo").value, a = $("hipSel1"), b = $("hipSel2");
    const v1 = a.value, v2 = b.value;
    if (reset || a._tipo !== tipo || a._n !== m.proxima.n) {
      a.innerHTML = opcionesApuesta(tipo); a._tipo = tipo; a._n = m.proxima.n;
      if (v1 && [...a.options].some(o => o.value === v1) && !reset) a.value = v1;
    }
    $("hipSel2Caja").classList.toggle("hidden", tipo !== "exacta");
    $("hipDobleCaja").classList.toggle("hidden", tipo !== "ganador");
    if (tipo !== "ganador") $("hipDoble").checked = false;
    if (tipo === "pozo" && a._pozo !== JSON.stringify(pozosAhora())) { a._pozo = JSON.stringify(pozosAhora()); const v = a.value; a.innerHTML = opcionesApuesta(tipo); if (v) a.value = v; }
    $("hipSel1Etiqueta").textContent = tipo === "exacta" ? "Primero" : "Criatura";
    if (tipo === "exacta") {
      b.innerHTML = opcionesApuesta(tipo, Number(a.value));
      if (v2 && [...b.options].some(o => o.value === v2) && v2 !== a.value) b.value = v2;
    }
    pintarCuotaApuesta();
  }
  function seleccion() {
    const tipo = $("hipTipo").value, a = Number($("hipSel1").value), b = Number($("hipSel2").value);
    return { tipo, sel: tipo === "exacta" ? [a, b] : a };
  }
  /* El retrato de la criatura (o las dos, en la exacta) a la que se apuesta: dibujo quieto, de qué viene y qué piensa el mercado. Para pensárselo antes de apostar. */
  function retratoApuesta(id, tipo, orden) {
    const p = m.proxima, e = p.entrantes.find(x => x.id === id), per = e && perfilDe(id);
    if (!e || !per) return "";
    const menor = p.entrantes.reduce((a, x) => (x.gan < a ? x.gan : a), Infinity);
    const cuota = tipo === "podio" ? e.pod : e.gan, prob = cuota ? Math.min(99, Math.round(100 / cuota)) : null;
    const mias = est.pendientes.filter(a => a.n === p.n && (a.tipo === "exacta" ? a.sel.includes(id) : a.sel === id)).reduce((t, a) => t + a.monto, 0);
    const sellos = (e.gan === menor ? '<span class="hip-sello oro">Favorita</span>' : "") + (e.dueno && e.dueno.id === YO ? '<span class="hip-sello">★ Tuya</span>' : "");
    return `<figure class="hip-retrato">
      <div class="hip-retrato-fig">${D.silueta(per, { clase: "hip-silueta mediana" })}<span class="hip-retrato-pta" title="Puerta de salida">${e.puerta}</span></div>
      <figcaption>
        ${orden ? `<small class="hip-retrato-orden">${orden}</small>` : ""}
        <strong><button type="button" class="hip-enlace" data-ficha="${id}">${esc(per.nombre)}</button></strong>${sellos}
        <small>${sexoTxt(per)} · ${T("etapa", esc(per.etapa))} · ${edadTxt(per)}</small>
        <span class="hip-retrato-datos">${estrellasTxt(per.estrellas)} <span>${per.salidas ? `${per.salidas} salidas · ${per.vic}-${per.seg}-${per.ter}` : "debuta"}</span></span>
        <span class="hip-retrato-ult">${per.ultimas.slice(0, 5).map(chipPuesto).join("")}</span>
        ${prob != null && tipo !== "exacta" && tipo !== "pozo" ? `<small>El mercado le da ${prob} % de ${tipo === "podio" ? "llegar entre las tres primeras" : "ganar"}.</small>` : ""}
        ${mias ? `<small class="hip-retrato-ya">Ya llevas ${monedas(mias)} tokens apostados con ella.</small>` : ""}
      </figcaption></figure>`;
  }
  function pintarFoto() {
    const { tipo, sel } = seleccion();
    poner($("hipFoto"), tipo === "exacta" ? retratoApuesta(sel[0], tipo, "Primero") + retratoApuesta(sel[1], tipo, "Segundo") : retratoApuesta(sel, tipo, ""));
  }
  /* Toda apuesta pide confirmación: «Apostar» se cambia por «¿Seguro? Sí / No» en el mismo sitio. Si cambias algo del boleto mientras tanto, se vuelve a pedir. */
  let confirmando = null;   // la firma de la apuesta que se está confirmando (tipo, criaturas, importe y doble)
  let temporizadorConfirma = null;
  const firmaDe = (tipo, sel, monto, doble) => tipo + "/" + (tipo === "exacta" ? sel : [sel]).join() + "/" + monto + "/" + !!doble;
  function pedirConfirmacion(firma) {
    confirmando = firma;
    $("hipApostar").classList.add("hidden"); $("hipConfirma").classList.remove("hidden");
    $("hipConfirmaSi").focus();
    clearTimeout(temporizadorConfirma); temporizadorConfirma = setTimeout(cancelarConfirmacion, 10000);
  }
  function cancelarConfirmacion() {
    confirmando = null; clearTimeout(temporizadorConfirma);
    $("hipConfirma").classList.add("hidden"); $("hipApostar").classList.remove("hidden");
  }
  function pintarCuotaApuesta() {
    const { tipo, sel } = seleccion(), monto = Math.floor(Number($("hipMonto").value) || 0);
    pintarFoto();
    if (confirmando && confirmando !== firmaDe(tipo, sel, monto, tipo === "ganador" && $("hipDoble").checked)) cancelarConfirmacion();
    const cuota = tipo === "pozo" ? (M.cuotaApuesta(m.proxima, tipo, sel) === null ? null : M.cuotaPozo(pozosAhora(), sel, Math.max(1, monto))) : M.cuotaApuesta(m.proxima, tipo, sel);
    textoDe($("hipCuotaApuesta"), cuota ? (tipo === "pozo" ? "≈ " : "") + M.fmtCuota(cuota) : "-");
    textoDe($("hipPosible"), cuota && monto > 0 ? monedas(monto * cuota) : "-");
    textoDe($("hipTipoAyuda"), M.TIPOS_APUESTA[tipo].texto);
    // lo que se juega, dicho claro: lo que pierdes, lo que ganas y cuánto es de tus tokens
    const riesgo = $("hipRiesgo");
    if (cuota && monto > 0) {
      const parte = est.saldo > 0 ? Math.round(100 * monto / est.saldo) : 100;
      riesgo.innerHTML = `Si pierdes, te quedas con <strong>${monedas(Math.max(0, est.saldo - monto))}</strong>. Si aciertas, ganas <strong>+${monedas(monto * cuota - monto)}</strong>.` + (parte >= 30 ? ` <span class="hip-riesgo-aviso">Es el ${Math.min(100, parte)} % de tus tokens.</span>` : "");
      riesgo.classList.toggle("alto", parte >= 30);
    } else { riesgo.textContent = ""; riesgo.classList.remove("alto"); }
  }
  async function apostar() {
    const p = m.proxima, f = M.ventana(p, est.virtual), msg = $("hipApuestaMsg");
    const falla = t => { msg.textContent = t; msg.className = "hip-aviso mal"; };
    if (f !== "abierta") return falla("Las apuestas de esta carrera están cerradas.");
    const { tipo, sel } = seleccion(), monto = Math.floor(Number($("hipMonto").value) || 0);
    if (!(monto >= 1)) return falla("Pon un importe de al menos 1 token.");
    if (monto > est.saldo) return falla("No tienes tantos tokens.");
    const cuotaFija = M.cuotaApuesta(p, tipo, sel), doble = tipo === "ganador" && $("hipDoble").checked;
    if (cuotaFija === null) return falla(tipo === "exacta" ? "Elige dos criaturas distintas." : "Esa criatura no corre.");
    const cuota = tipo === "pozo" ? M.cuotaPozo(pozosAhora(), sel, monto) : cuotaFija;
    const ids = tipo === "exacta" ? sel : [sel];
    const firma = firmaDe(tipo, sel, monto, doble);
    if (confirmando !== firma) { pedirConfirmacion(firma); return; }   // primero «¿Seguro?»; con el Sí vuelve aquí y apuesta
    cancelarConfirmacion();
    if (online) {
      window.HipEspera.poner($("hipApostar"), "Apostando...");
      let r; try { r = await online.apostar(p.n, tipo, sel, monto, doble); } finally { window.HipEspera.quitar($("hipApostar")); }
      if (!r.ok) return falla(r.error || "No se pudo apostar.");
      msg.textContent = `Apuesta hecha: ${M.TIPOS_APUESTA[tipo].nombre.toLowerCase()} a ${ids.map(nombreDe).join(" y ")}, ${monedas(monto)} tokens a ${tipo === "pozo" ? "≈ " : ""}${M.fmtCuota(Number(r.cuota))}${doble ? " (doble)" : ""}.`;
      msg.className = "hip-aviso bien";
      pintarPendientesCarrera(); pintarApuestas(); pintarReloj(); pintarCuotaApuesta();
      cerrarBoletoTrasApostar(msg.textContent);
      return;
    }
    est.saldo -= monto;
    est.pendientes.push({ n: p.n, tipo, sel, monto, cuota, nombres: ids.map(nombreDe), carrera: p.nombre, doble });
    guardar();
    msg.textContent = `Apuesta hecha: ${M.TIPOS_APUESTA[tipo].nombre.toLowerCase()} a ${ids.map(nombreDe).join(" y ")}, ${monedas(monto)} tokens a ${tipo === "pozo" ? "≈ " : ""}${M.fmtCuota(cuota)}${doble ? " (doble)" : ""}.`;
    msg.className = "hip-aviso bien";
    pintarPendientesCarrera(); pintarApuestas(); pintarReloj(); pintarCuotaApuesta();
    cerrarBoletoTrasApostar(msg.textContent);
  }
  function pintarPendientesCarrera() {
    const mias = est.pendientes.filter(a => a.n === m.proxima.n);
    poner($("hipMias"), mias.length ? `<h3>Tus apuestas en esta carrera</h3><ul class="hip-lista-apuestas">${mias.map(a => `<li><strong>${esc(M.TIPOS_APUESTA[a.tipo].nombre)}${a.doble ? " doble" : ""}</strong> ${esc(a.nombres.join(" y "))} · ${monedas(a.monto)} a ${a.tipo === "pozo" ? "≈ " : ""}${M.fmtCuota(a.cuota)} <small>(si acierta, ${a.tipo === "pozo" ? "unas " : ""}${monedas(a.monto * a.cuota)})</small></li>`).join("")}</ul>` : "");
  }

  function tablaResultado(res) {
    return `<table class="hip-tabla"><thead><tr><th>Pos.</th><th>Criatura</th><th>Tiempo</th><th class="hip-col-extra">${T("margen", "Distancia")}</th><th>${T("cuota", "Cuota")}</th><th class="hip-col-extra">${T("bolsa", "Premio")}</th></tr></thead><tbody>${res.llegada.map(l => `<tr>
      <td class="hip-puerta">${l.pos}</td><td>${nombreBtn(l.id, l.nombre)}${l.lesion ? ` <span class="hip-sello rojo">${T("lesion", "lesión")}</span>` : ""}${l.id === res.favorito ? ` <span class="hip-sello">${T("favorito", "favorito")}</span>` : ""}</td>
      <td>${M.fmtTiempo(l.t)}</td><td class="hip-col-extra">${l.pos === 1 ? "-" : "+" + coma(l.margen, 1) + " cuerpos"}</td><td class="hip-cuota">${M.fmtCuota(l.cuota)}</td><td class="hip-cuota hip-col-extra">${l.premio ? monedas(l.premio) : ""}</td></tr>`).join("")}</tbody></table>${res.fotoMeta ? '<p class="hip-nota">Foto de meta: ganó por un hocico.</p>' : ""}`;
  }
  function pintarUltimo() {
    const res = est.resultados[0];
    if (!res) { poner($("hipUltimo"), '<p class="hip-vacio">Todavía no se ha corrido ninguna carrera en este mundo.</p>'); return; }
    const mias = est.historial.filter(h => h.n === res.n);
    poner($("hipUltimo"), `<div class="hip-ultimo-cab"><h3>${esc(res.nombre)}</h3><span>n.º ${res.n} · ${res.dist} m · ${esc(M.PISTAS[res.pista].nombre)} · terreno ${esc(res.estadoPista)} · ${esc(M.CLIMAS[res.clima].texto)}</span></div>${tablaResultado(res)}
      ${mias.length ? `<ul class="hip-lista-apuestas">${mias.map(h => `<li class="${h.devuelta ? "" : h.gana ? "gana" : "pierde"}">${esc(M.TIPOS_APUESTA[h.tipo].nombre)} a ${esc(h.nombres.join(" y "))}: ${h.devuelta ? "devuelta" : h.gana ? "ganaste " + monedas(h.pago) : "perdiste " + monedas(h.monto)}</li>`).join("")}</ul>` : ""}`);
  }

  /* ---------------------------------------------------------------- la carrera en pista */
  function metrosEn(tramos, T) {
    const n = tramos.length;
    if (T <= 0) return 0;
    if (T >= tramos[n - 1]) return n * 100;
    let s = 0; while (s < n && tramos[s] <= T) s++;
    const t0 = s === 0 ? 0 : tramos[s - 1], t1 = tramos[s];
    return (s + (T - t0) / (t1 - t0)) * 100;
  }
  function construirEscena(res) {
    const p = m.proxima;
    const ultimo = Math.max.apply(null, res.llegada.map(l => l.t));
    const carriles = p.entrantes.map(e => {
      const per = perfilDe(e.id), l = res.llegada.find(x => x.id === e.id);
      return { id: e.id, nombre: e.nombre, puerta: e.puerta, per, tramos: res.tramos[e.id], pos: l.pos, t: l.t };
    });
    if (escena && escena.pista) escena.pista.destruir();
    const marcadas = new Set();   // las criaturas por las que apostaste llevan su nombre a la vista
    est.pendientes.filter(a => a.n === p.n).forEach(a => carriles.forEach(c => { if (a.nombres.includes(c.nombre)) marcadas.add(c.id); }));
    $("hipPista")._h = null;
    const suelo = (M.PISTAS && M.PISTAS[res.pista]) ? M.PISTAS[res.pista] : null;
    const pista = HipodromoPista.crear($("hipPista"), { res, carriles, ultimo, D, marcadas, suelo: suelo ? suelo.suelo : "hierba", cuestas: suelo ? suelo.cuestas : 0, arcana: suelo ? suelo.arcana : null, zonas: suelo && suelo.arcana ? M.zonasArcanas(suelo.arcana, res.n, res.dist / 100) : [] });
    escena = { n: p.n, carriles, dist: res.dist, res, pista, resFinal: false };
    $("hipEscenaTitulo").textContent = `${res.nombre} · ${res.dist} m · terreno ${res.estadoPista} · ${M.CLIMAS[res.clima].texto}`;
    $("hipEscenaRes").innerHTML = "";
  }
  function pintarEscena() {
    const p = m.proxima, caja = $("hipEscena");
    const visible = est.virtual >= p.hora && p.secreto && p.secreto.res;
    caja.classList.toggle("hidden", !visible);
    if (!visible) return;
    if (!escena || escena.n !== p.n) construirEscena(p.secreto.res);
    const el = Math.max(0, (est.virtual - p.hora) / 1000);
    const r = escena.pista.dibujar(el);
    textoDe($("hipEscenaProgreso"), r.fin ? "Meta" : `${Math.min(escena.dist, Math.round(r.metrosLider / 10) * 10)} m de ${escena.dist} m`);
    if (r.hecho && !escena.resFinal) { escena.resFinal = true; $("hipEscenaRes").innerHTML = tablaResultado(escena.res); }
  }

  /* ---------------------------------------------------------------- pestaña Criaturas y ficha */
  function listaCriaturas() {
    const todas = online ? online.perfiles() : m.vivos.concat(m.criadores).map(c => M.perfil(m, c)).concat(Object.values(est.archivo));
    todas.forEach(p => D.registrar(p));   // el dibujo hereda los rasgos por linaje: que conozca a toda la familia
    const q = norm(filtros.q.trim());
    const pasa = p => {
      const e = edadDe(p);
      switch (filtros.estado) {
        case "pista": if (!(p.estado === "activo" && e >= C.DEBUT && !p.lesion)) return false; break;
        case "lesionadas": if (!(p.estado === "activo" && p.lesion)) return false; break;
        case "jovenes": if (!(p.estado === "activo" && e < C.DEBUT)) return false; break;
        case "criadoras": if (p.estado !== "criador") return false; break;
        case "retiradas": if (!(p.estado === "retirado" || p.estado === "fallecido")) return false; break;
        case "leyendas": if (!p.leyenda) return false; break;
        case "favoritas": if (!est.favoritos.includes(p.id)) return false; break;
        default: break;
      }
      return !q || norm(p.nombre).includes(q);
    };
    const orden = { vic: (a, b) => b.vic - a.vic || b.premios - a.premios, prem: (a, b) => b.premios - a.premios, sal: (a, b) => b.salidas - a.salidas, edad: (a, b) => b.nac - a.nac, nombre: (a, b) => a.nombre.localeCompare(b.nombre, "es") }[filtros.orden];
    return todas.filter(pasa).sort(orden);
  }
  function tarjetaCria(p) {
    const fav = est.favoritos.includes(p.id);
    return `<button type="button" class="hip-cria" data-ficha="${p.id}">${D.silueta(p, { clase: "hip-silueta mediana" })}
      <strong>${fav ? "♥ " : ""}${esc(p.nombre)}</strong>
      <small>${sexoTxt(p)} · ${T("etapa", esc(p.etapa))} · ${T("generacion", "gen.")} ${p.gen}</small>
      <span class="hip-cria-record">${p.salidas ? `${p.salidas} salidas · ${p.vic}-${p.seg}-${p.ter}` : "sin salidas"}</span>
      ${estrellasTxt(p.estrellas)}<span class="hip-sellos">${etiquetasEstado(p)}</span></button>`;
  }
  function pintarCriaturas() {
    const l = listaCriaturas();
    poner($("hipCriaCuenta"), `${l.length} ${l.length === 1 ? "criatura" : "criaturas"}`);
    poner($("hipCriaLista"), l.slice(0, mostrarMas).map(tarjetaCria).join("") || '<p class="hip-vacio">No hay criaturas que coincidan.</p>');
    $("hipCriaMas").classList.toggle("hidden", l.length <= mostrarMas);
  }

  /* Rasgos de la criatura: los que hacen algo en la carrera llevan su efecto escrito; los demás son adorno */
  function rasgosHtml(p) {
    const lista = D.rasgosDetalle(p);
    if (!lista.length) return "";
    const con = lista.filter(x => x.hace);
    return `<p class="hip-rasgos">${lista.map(x => `<span class="hip-rasgo${x.hace ? " activo" : ""}" ${x.hace ? `title="${esc(x.hace)}"` : ""}>${esc(x.texto)}</span>`).join(" ")}</p>` +
      (con.length ? `<ul class="hip-rasgos-hace">${con.map(x => `<li><strong>${esc(x.texto)}.</strong> ${esc(x.hace)}</li>`).join("")}</ul>` : "");
  }
  function duenoHtml(p) {
    if (p.dueno) return `<section class="hip-ficha-sec"><h3>Cuadra</h3><p>De ${esc(p.dueno.nombre || "otro jugador")}${p.dueno.id === YO ? " (es tuya)" : ""}.${p.montaPrecio && p.estado === "criador" ? ` Monta: ${monedas(p.montaPrecio)} tokens.` : ""}</p></section>`;
    if (p.precio) return `<section class="hip-ficha-sec"><h3>Cuadra</h3><p>Sin dueño. A la venta por ${monedas(p.precio)} tokens. <button type="button" class="hip-boton chico" data-ir-cuadra>Ir al mercado</button></p></section>`;
    if (p.montaPrecio) return `<section class="hip-ficha-sec"><h3>Cuadra</h3><p>En la cría. Monta: ${monedas(p.montaPrecio)} tokens.</p></section>`;
    return "";
  }
  function fichaHtml(p) {
    const c = online ? null : M.buscar(m, p.id), apt = p.aptitudes;
    const nombres = { firme: "Firme", bueno: "Bueno", blando: "Blando", pesado: "Pesado" };
    const fav = est.favoritos.includes(p.id);
    const lesion = p.lesion ? `<p class="hip-nota rojo">${esc(p.lesion.tipo)} (${esc(p.lesion.gravedad)})${p.lesion.gravedad === "grave" ? "" : `, vuelve en unas ${Math.max(1, p.lesion.hasta - m.n)} carreras`}.</p>` : "";
    const apuestas = est.historial.filter(h => h.nombres.includes(p.nombre)), apostado = apuestas.reduce((a, h) => a + h.monto, 0), cobrado = apuestas.reduce((a, h) => a + h.pago, 0);
    const linaje = !p.padre && !p.madre ? `<span class="hip-sin">${p.gen === 1 ? "Fundadora: no se conocen sus padres." : "Llegó de otra región: no se conocen sus padres."}</span>` : `Padre: ${p.padre ? nombreBtn(p.padre.id, p.padre.nombre) : '<span class="hip-sin">desconocido</span>'} · Madre: ${p.madre ? nombreBtn(p.madre.id, p.madre.nombre) : '<span class="hip-sin">desconocida</span>'}`;
    let ocultoHtml = "";
    if (oculto) {
      if (c) {
        const base = M._interno.statsBase(c);
        ocultoHtml = `<section class="hip-ficha-sec hip-oculto-col"><h3>Lo oculto</h3>
          <p>Rating real ${Math.round(c.rating)} · forma ${coma(c.forma, 2)} · fatiga ${Math.round(c.fatiga)} · fragilidad ${coma(M._interno.fragilidad(c), 2)} · ritmo ${coma(c.ritmo, 2)}</p>
          <p>Capacidades: ${M.STATS.map(s => `${s} ${Math.round(base[s])} (talento ${coma(c.talento[s], 1)})`).join(" · ")}</p>
          <p>Genes: ${M.GENES.map(g => `${g} ${coma(c.genes[g], 2)}`).join(" · ")}</p></section>`;
      } else ocultoHtml = '<section class="hip-ficha-sec hip-oculto-col"><h3>Lo oculto</h3><p>Ya no está en el mundo, no se guardan sus datos secretos.</p></section>';
    }
    return `<div class="hip-ficha-cab">
        <div class="hip-ficha-dibujo">${D.silueta(p, { clase: "hip-silueta grande" })}</div>
        <div class="hip-ficha-titulo"><h2>${esc(p.nombre)}</h2>
          <p>${sexoTxt(p)} · ${T("etapa", esc(p.etapa))} · ${edadTxt(p)} · ${T("generacion", "generación")} ${p.gen}${p.arquetipo ? " · " + T("arq_" + norm(p.arquetipo), esc(p.arquetipo)) : ""}</p>
          ${rasgosHtml(p)}
          <p class="hip-sellos">${etiquetasEstado(p)}${p.etiquetas.filter(t => t !== "Leyenda").map(t => `<span class="hip-sello">${T(window.HipodromoGlosario ? window.HipodromoGlosario.claveEtiqueta(t) : null, esc(t.replace(/^Se crece en/, "Rinde mejor en")))}</span>`).join("")}</p>
          <button type="button" class="hip-boton" data-favorito="${p.id}" aria-pressed="${fav}">${fav ? "♥ En favoritas" : "♡ Seguir"}</button></div></div>
      ${lesion}
      <div class="hip-datos"><div><span>Salidas</span><strong>${p.salidas}</strong><small>${p.vic} victorias · ${p.seg} segundos · ${p.ter} terceros</small></div>
        <div><span>Premios</span><strong>${monedas(p.premios)}</strong><small>${p.gp ? p.gp + (p.gp > 1 ? " Grandes Premios" : " Gran Premio") : "sin Grandes Premios"}${p.copas ? " · " + p.copas + (p.copas > 1 ? " copas" : " copa") : ""}</small></div>
        <div><span>${T("valoracion", "Valoración")}</span><strong>${estrellasTxt(p.estrellas)}</strong><small>${p.estilo ? T("estilo", esc(p.estilo)) : "estilo por conocer"}</small></div>
        <div><span>${T("tipo_dist", "Tipo")}</span><strong>${esc(p.perfilDist)}</strong><small>${p.crias ? p.crias + " crías" : "sin crías"}</small></div></div>
      <section class="hip-ficha-sec"><h3>Cuerpo</h3><ul class="hip-cuerpo">${p.cuerpo.map(x => `<li><span>${T("cuerpo_" + x.clave, esc(x.parte))}</span> ${esc(x.texto)} <i class="hip-nivel" title="nivel ${x.nivel} de 5">${"●".repeat(x.nivel)}${"○".repeat(5 - x.nivel)}</i></li>`).join("")}</ul>
        <p class="hip-nota">Capa ${esc(p.capa)}.${p.secuelas.length ? " Secuelas: " + esc(p.secuelas.join("; ")) + "." : ""}</p></section>
      <section class="hip-ficha-sec"><h3>${T("aptitudes", "En cada tipo de terreno")}</h3><div class="hip-aptitudes">${Object.keys(nombres).map(k => `<div><span>${T("terreno_" + k, nombres[k])}</span>${apt[k] ? estrellasTxt(apt[k].estrellas) + `<small>${apt[k].salidas} salidas</small>` : '<span class="hip-sin">sin datos</span>'}</div>`).join("")}</div></section>
      <section class="hip-ficha-sec"><h3>Linaje</h3><p>${linaje}</p></section>
      <section class="hip-ficha-sec"><h3>Últimas carreras</h3>${p.ultimas.length ? `<table class="hip-tabla"><thead><tr><th>n.º</th><th>Pista</th><th>Metros</th><th>Puesto</th><th>Cuota</th></tr></thead><tbody>${p.ultimas.map(h => `<tr><td>${h.n}</td><td>${esc(M.PISTAS[h.pista].nombre)}<small> ${esc(h.estadoPista)}</small></td><td>${h.dist}</td><td>${chipPuesto(h)} <small>de ${h.campo}</small></td><td>${M.fmtCuota(h.cuota)}</td></tr>`).join("")}</tbody></table>` : '<p class="hip-sin">Todavía no ha corrido.</p>'}</section>
      ${duenoHtml(p)}
      ${apuestas.length ? `<section class="hip-ficha-sec"><h3>Tus apuestas por ${esc(p.nombre)}</h3><p>${apuestas.length} ${apuestas.length === 1 ? "apuesta" : "apuestas"}: apostaste ${monedas(apostado)} y cobraste ${monedas(cobrado)}.</p></section>` : ""}
      ${ocultoHtml}`;
  }
  function abrirFicha(id) {
    const p = perfilDe(id); if (!p) return;
    fichaId = id;
    $("hipFichaCuerpo").innerHTML = fichaHtml(p);
    $("hipFicha").classList.remove("hidden");
    document.body.classList.add("hip-con-ficha");
    $("hipFichaCerrar").focus();
  }
  function cerrarFicha() { fichaId = null; $("hipFicha").classList.add("hidden"); document.body.classList.remove("hip-con-ficha"); }

  /* ---------------------------------------------------------------- Noticias, apuestas, mundo */
  function pintarNoticias() {
    poner($("hipNoticiasLista"), est.noticias.length ? est.noticias.map(n => `<article class="hip-noticia ${esc(n.tipo)}"><div class="hip-noticia-cab"><span class="hip-sello">${esc(TIPOS_NOTICIA[n.tipo] || n.tipo)}</span><small>n.º ${n.n} · ${horaTxt(n.hora)}</small></div>
      <h3>${esc(n.titulo)}</h3><p>${esc(n.texto)}</p>${n.ids.length ? `<p class="hip-noticia-ids">${n.ids.slice(0, 3).filter(perfilDe).map(id => nombreBtn(id)).join(" ")}</p>` : ""}</article>`).join("") : '<p class="hip-vacio">Todavía no hay noticias. Deja correr unas carreras.</p>');
  }
  function pintarApuestas() {
    const tot = est.historial.reduce((a, h) => ({ ap: a.ap + (h.devuelta ? 0 : h.monto), co: a.co + (h.devuelta ? 0 : h.pago) }), { ap: 0, co: 0 });
    poner($("hipApuestasResumen"), `<div class="hip-datos"><div><span>Tokens</span><strong>${monedas(est.saldo)}</strong></div><div><span>Apostado</span><strong>${monedas(tot.ap)}</strong></div><div><span>Cobrado</span><strong>${monedas(tot.co)}</strong></div><div><span>${T("rendimiento", "Rendimiento")}</span><strong>${tot.ap ? coma((tot.co / tot.ap - 1) * 100, 1) + " %" : "-"}</strong></div></div>`);
    poner($("hipApuestasPend"), est.pendientes.length ? `<h3>Pendientes</h3><ul class="hip-lista-apuestas">${est.pendientes.map(a => `<li>n.º ${a.n} · <strong>${esc(M.TIPOS_APUESTA[a.tipo].nombre)}</strong> ${esc(a.nombres.join(" y "))} · ${monedas(a.monto)} a ${M.fmtCuota(a.cuota)}</li>`).join("")}</ul>` : "");
    poner($("hipApuestasHist"), est.historial.length ? `<h3>Historial</h3><table class="hip-tabla"><thead><tr><th>n.º</th><th>Apuesta</th><th>Importe</th><th>Cuota</th><th>Resultado</th></tr></thead><tbody>${est.historial.map(h => `<tr class="${h.devuelta ? "" : h.gana ? "gana" : "pierde"}"><td>${h.n}</td><td>${esc(M.TIPOS_APUESTA[h.tipo].nombre)} a ${esc(h.nombres.join(" y "))}</td><td>${monedas(h.monto)}</td><td>${M.fmtCuota(h.cuota)}</td><td>${h.devuelta ? "devuelta" : h.gana ? "+" + monedas(h.pago - h.monto) : "-" + monedas(h.monto)}</td></tr>`).join("")}</tbody></table>` : '<p class="hip-vacio">Todavía no has apostado.</p>');
  }
  function pintarMundo() {
    if (online) {
      const ps = online.perfiles(), vivas = ps.filter(x => x.estado === "activo").length, cria = ps.filter(x => x.estado === "criador").length, ley = ps.filter(x => x.leyenda).length;
      poner($("hipMundoDatos"), `<div class="hip-datos">
        <div><span>Carrera actual</span><strong>n.º ${m.n}</strong><small>${coma(Math.max(0, (m.n - 300) / POR_DIA), 1)} días de mundo en vivo</small></div>
        <div><span>Criaturas en pista</span><strong>${vivas}</strong><small>${cria} en la cría</small></div>
        <div><span>Leyendas</span><strong>${ley}</strong><small>ganadoras de 14 carreras o 3 Grandes Premios</small></div>
        <div><span>Tu cuadra</span><strong>${online.mias().length}</strong><small>de ${C.MAX_CABALLOS} posibles</small></div></div>
        <p class="hip-nota">Un año de las criaturas son ${C.ANIO} carreras (${coma(C.ANIO / POR_DIA, 1)} días). Hay una carrera cada ${C.MINUTOS} minutos para todo el mundo.</p>`);
      return;
    }
    const s = m.stats, vivas = m.vivos.length;
    const dias = (m.n - 300) / POR_DIA;
    poner($("hipMundoDatos"), `<div class="hip-datos">
      <div><span>Carreras corridas</span><strong>${s.carreras}</strong><small>${coma(Math.max(0, dias), 1)} días desde que empezó aquí</small></div>
      <div><span>Criaturas vivas</span><strong>${vivas}</strong><small>${m.criadores.length} en la cría</small></div>
      <div><span>Nacimientos</span><strong>${s.nacidos}</strong><small>${s.retirados} retiros</small></div>
      <div><span>Lesiones</span><strong>${s.lesiones}</strong><small>${s.incidentes} incidentes de establo, ${s.muertes} ${s.muertes === 1 ? "muerte" : "muertes"}</small></div></div>
      <p class="hip-nota">Semilla: <code>${esc(est.semilla)}</code>. Un año de las criaturas son ${C.ANIO} carreras (${coma(C.ANIO / POR_DIA, 1)} días). Con la misma semilla el mundo sale igual.</p>`);
    $("hipOculto").checked = oculto;
  }

  /* ---------------------------------------------------------------- pintar */
  function pintarTodo() {
    document.querySelector(".hip-pagina").classList.remove("cargando");
    $("hipCargando").classList.add("hidden");
    pintarReloj();
    pintarApuestas(); pintarNoticias(); pintarMundo();
    if (nUI !== m.proxima.n) {
      nUI = m.proxima.n;
      pintarPrograma(); pintarPanelApuesta(true); pintarPendientesCarrera(); pintarUltimo();
    }
    pintarCopas();
    pintarInscritos();
    pintarTribuna();
    pintarCuadrasNpc();
    pintarCriaturas();
    if (cuadraUI) cuadraUI.pintar();
    if (cartasUI) cartasUI.pintar();
    mostrarPestana(pestana, true);
  }
  function mostrarPestana(id, sinGuardar) {
    pestana = id;
    document.body.dataset.pestana = id;
    if (id !== "carrera") abrirBoleto(false);
    document.querySelectorAll("[data-pestana]").forEach(b => { const on = b.dataset.pestana === id; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
    document.querySelectorAll(".hip-panel").forEach(p => p.classList.toggle("hidden", p.id !== "hipPanel-" + id));
    if (!sinGuardar) try { localStorage.setItem(CLAVE_PESTANA, id); } catch (e) { /* sin almacenamiento */ }
    if (id === "criaturas") pintarCriaturas();
    if (id === "cuadra" && cuadraUI) cuadraUI.pintar();
    if (id === "cartas" && cartasUI) cartasUI.abrir();
  }

  /* ---------------------------------------------------------------- eventos */
  function iniciarEventos() {
    $("hipVelocidad").innerHTML = VELOCIDADES.map(([v, t]) => `<button type="button" class="hip-boton chico" data-vel="${v}" aria-pressed="false">${t}</button>`).join("");
    $("hipVelocidad").addEventListener("click", e => { const b = e.target.closest("[data-vel]"); if (!b) return; est.vel = Number(b.dataset.vel); guardar(); pintarReloj(); });
    $("hipSaltar").addEventListener("click", saltar);
    $("hipApuestaFlota").addEventListener("click", () => abrirBoleto(!$("hipPanelApuesta").classList.contains("abierta")));
    $("hipApuestaCierra").addEventListener("click", () => abrirBoleto(false));
    document.querySelector(".hip-pestanas").addEventListener("click", e => { const b = e.target.closest("[data-pestana]"); if (b) mostrarPestana(b.dataset.pestana); });
    document.querySelector(".hip-pestanas").addEventListener("keydown", e => {
      if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
      const bs = [...document.querySelectorAll("[data-pestana]")], i = bs.findIndex(b => b.getAttribute("aria-selected") === "true");
      const sig = bs[(i + (e.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length]; mostrarPestana(sig.dataset.pestana); sig.focus();
    });
    document.addEventListener("click", e => {
      const f = e.target.closest("[data-ficha]"); if (f) { abrirFicha(Number(f.dataset.ficha)); return; }
      const a = e.target.closest("[data-apostar]");
      if (a) { $("hipSel1").value = a.dataset.apostar; pintarPanelApuesta(false); if (esMovil()) abrirBoleto(true); else { $("hipPanelApuesta").scrollIntoView({ behavior: "smooth", block: "center" }); $("hipMonto").focus(); } return; }
      if (e.target.closest("[data-ir-cuadra]")) { cerrarFicha(); mostrarPestana("cuadra"); return; }
      const fav = e.target.closest("[data-favorito]");
      if (fav) {
        const id = Number(fav.dataset.favorito), i = est.favoritos.indexOf(id);
        if (i >= 0) est.favoritos.splice(i, 1); else est.favoritos.push(id);
        guardar(); abrirFicha(id); nUI = -1; pintarInscritos(); pintarCriaturas(); return;
      }
      if (e.target.closest("#hipFichaCerrar") || e.target === $("hipFicha")) cerrarFicha();
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && fichaId != null) cerrarFicha(); });
    $("hipTipo").addEventListener("change", () => pintarPanelApuesta(true));
    $("hipSel1").addEventListener("change", () => pintarPanelApuesta(false));
    $("hipSel2").addEventListener("change", pintarCuotaApuesta);
    $("hipMonto").addEventListener("input", pintarCuotaApuesta);
    document.querySelectorAll("[data-monto]").forEach(b => b.addEventListener("click", () => { $("hipMonto").value = b.dataset.monto === "todo" ? Math.floor(est.saldo) : b.dataset.monto; pintarCuotaApuesta(); }));
    $("hipApostar").addEventListener("click", apostar);
    $("hipConfirmaSi").addEventListener("click", apostar);
    $("hipConfirmaNo").addEventListener("click", cancelarConfirmacion);
    $("hipConfirma").addEventListener("keydown", e => { if (e.key === "Escape") cancelarConfirmacion(); });
    $("hipCriaEstado").addEventListener("change", e => {
      filtros.estado = e.target.value; mostrarMas = 48; pintarCriaturas();
      if (online && (filtros.estado === "retiradas" || filtros.estado === "todas" || filtros.estado === "leyendas") && !online.retiradasCargadas) { online.retiradasCargadas = true; online.leerRetiradas().then(pintarCriaturas); }
    });
    $("hipCriaOrden").addEventListener("change", e => { filtros.orden = e.target.value; pintarCriaturas(); });
    $("hipCriaBuscar").addEventListener("input", e => { filtros.q = e.target.value; mostrarMas = 48; pintarCriaturas(); });
    $("hipCriaMas").addEventListener("click", () => { mostrarMas += 48; pintarCriaturas(); });
    $("hipOculto").addEventListener("change", e => { oculto = e.target.checked; try { localStorage.setItem(CLAVE_OCULTO, oculto ? "1" : "0"); } catch (x) { /* sin almacenamiento */ } nUI = -1; pintarTodo(); if (fichaId != null) abrirFicha(fichaId); });
    $("hipReiniciar").addEventListener("click", async () => {
      const semilla = await dialogo.pedir("Se borra este mundo, tus tokens y tus apuestas, y empieza otro. Escribe una semilla, o déjala vacía para una al azar.", "", { titulo: "Empezar un mundo nuevo", marcador: "mundo-1", aceptar: "Empezar" });
      if (semilla === null) return;
      crear(semilla.trim() || semillaAzar());
    });
    $("hipMonedas").addEventListener("click", async () => {
      if (!(await dialogo.confirmar(`Vuelves a tener ${SALDO_INICIAL} tokens y se borran tus apuestas pendientes. El mundo sigue igual.`, { titulo: "Reiniciar los tokens", aceptar: "Reiniciar" }))) return;
      est.pendientes = []; est.historial = []; est.saldo = SALDO_INICIAL; guardar(); pintarTodo(); pintarPendientesCarrera();
    });
    window.addEventListener("beforeunload", guardar);
    document.addEventListener("visibilitychange", () => { if (document.hidden) guardar(); });
  }

  /* ---------------------------------------------------------------- modo servidor */
  function alCambiarOnline(tipo) {
    if (!online) return;   // la primera lectura llega antes de que la página tenga el objeto
    if (tipo === "carrera") {
      const liq = est.liquidadas || []; est.liquidadas = [];
      const ganadas = liq.filter(h => h.gana), perdidas = liq.filter(h => !h.gana && !h.devuelta);
      if (liq.length) avisar([ganadas.length ? `Ganaste ${monedas(ganadas.reduce((t, h) => t + h.pago, 0))} tokens (${ganadas.length} ${ganadas.length === 1 ? "apuesta" : "apuestas"})` : "", perdidas.length ? `Perdiste ${perdidas.length} ${perdidas.length === 1 ? "apuesta" : "apuestas"}` : ""].filter(Boolean).join(" · "), ganadas.length ? "bien" : "mal");
      nUI = -1; escena = null;
    }
    pintarTodo();
  }
  function apiOnlineCuadra() {
    const lineaje = p => { if (p) D.registrar(p); return p; };
    return {
      M, D, monedas, edadTxt, estrellasTxt, listo: () => !!(online && est && m.proxima),
      saldo: () => est.saldo, perfil: id => perfilDe(id),
      nombreJugador: () => { try { return localStorage.getItem("compendioUsername") || "Jugador"; } catch (e) { return "Jugador"; } },
      adoptada: () => online.adoptada(),
      mias: () => online.mias().map(x => ({ p: lineaje(x.p), c: x.c })),
      calendario: () => online.calendario(),
      mercado: () => online.perfiles().filter(x => !x.dueno && x.precio && x.estado === "activo" && !m.proxima.entrantes.some(e => e.id === x.id)).map(lineaje)
        .sort((a, b) => (a.etapa === "cría" || a.etapa === "potro" ? 0 : 1) - (b.etapa === "cría" || b.etapa === "potro" ? 0 : 1) || a.precio - b.precio).slice(0, 40),
      sementales: () => online.perfiles().filter(x => x.estado === "criador" && x.sexo === "m" && x.montaPrecio).map(lineaje),
      avisos: () => est.avisos,
      ordenar: o => online.ordenar(o)
    };
  }
  function ponerModoServidor() {
    oculto = false;
    document.querySelector(".hip-modo").textContent = "Servidor: un mundo para todos, a la hora real";
    ["hipVelocidad", "hipSaltar", "hipRelojPrueba"].forEach(id => $(id).classList.add("hidden"));
    document.querySelectorAll(".hip-solo-local").forEach(el => el.classList.add("hidden"));
    $("hipRelojNota").textContent = "";
  }
  async function iniciarServidor() {
    if (/[?&]local\b/.test(location.search) || !window.HipodromoOnline) return false;
    let r;
    // si el servidor tarda demasiado se sigue con la prueba local; si responde más tarde, se deja de preguntarle
    let tarde = false;
    const intento = window.HipodromoOnline.conectar(M, alCambiarOnline);
    intento.then(x => { if (tarde && x.ok) x.en.parar(); }, () => {});
    try { r = await Promise.race([intento, new Promise(ok => setTimeout(() => { tarde = true; ok({ ok: false, motivo: "servidor", detalle: "tardó demasiado" }); }, 15000))]); }
    catch (e) { r = { ok: false, motivo: "servidor", detalle: String(e && e.message || e) }; }
    if (!r.ok) {
      const nota = $("hipModoNota"), motivos = { sesion: 'Estás en la prueba local: el mundo corre en este navegador. Para entrar al mundo de verdad, <a href="fichas.html">inicia sesión</a> y vuelve.', vacio: "Estás en la prueba local: el servidor todavía no tiene el hipódromo en marcha.", servidor: "Estás en la prueba local: no se pudo hablar con el servidor." };
      if (nota) { nota.innerHTML = motivos[r.motivo] || motivos.servidor; nota.classList.remove("hidden"); }
      return false;
    }
    online = r.en; est = online.est; m = online.m;
    ponerModoServidor();
    if (window.HipodromoCuadraUI) cuadraUI = window.HipodromoCuadraUI.crear(apiOnlineCuadra(), $("hipCuadra"));
    if (window.HipodromoCartas) cartasUI = window.HipodromoCartas.crear({ supa: online.supa, yo: online.yo, saldo: () => est.saldo, monedas, refrescarCuenta: online.refrescarCuenta }, $("hipCartas"));
    $("hipCargando").classList.add("hidden");
    pintarTodo();
    requestAnimationFrame(ts => { ultimoMarco = ts; bucle(ts); });
    return true;
  }

  /* ---------------------------------------------------------------- la cuadra (modo local) */
  const conLinaje = p => { D.registrar(p); return p; };
  const apiLocal = {
    M, D, monedas, edadTxt, estrellasTxt, listo: () => !!(est && m),
    saldo: () => est.saldo,
    perfil: id => perfilDe(id),
    nombreJugador: () => { try { return localStorage.getItem("compendioUsername") || "Tú"; } catch (e) { return "Tú"; } },
    adoptada: () => !!(m.duenos && m.duenos[YO] && m.duenos[YO].adoptada),
    mias: () => M.cuadraDe(m, YO).map(c => ({ p: conLinaje(M.perfil(m, c)), c: M.perfilCuadra(m, c) })),
    calendario: () => M.calendarioVisible(m).map(x => Object.assign(x, { cierra: M.horaDe(m, x.n - 1) + C.APLICAR_SEG * 1000 })),
    mercado: () => M.enVenta(m).map(c => conLinaje(M.perfil(m, c))).sort((a, b) => (a.etapa === "cría" || a.etapa === "potro" ? 0 : 1) - (b.etapa === "cría" || b.etapa === "potro" ? 0 : 1) || a.precio - b.precio).slice(0, 40),
    sementales: () => m.criadores.filter(c => c.sexo === "m" && M.edadAnios(m.n, c) < 12).map(c => conLinaje(M.perfil(m, c))),
    avisos: () => est.avisos,
    async ordenar(o) {
      const saldos = { [YO]: est.saldo };
      const r = M.procesarOrdenes(m, [Object.assign({ oid: 1, dueno: YO }, o)], saldos);
      const res = r.resultados[0];
      if (!res.ok) return res;
      est.saldo = saldos[YO];
      est.noticias = r.noticias.slice().reverse().concat(est.noticias).slice(0, MAX_NOTICIAS);
      nUI = -1; guardar(); pintarTodo();
      return res;
    }
  };

  /* ---------------------------------------------------------------- arranque */
  async function iniciar() {
    iniciarEventos();
    if (await iniciarServidor()) return;
    if (window.HipodromoCuadraUI) cuadraUI = window.HipodromoCuadraUI.crear(apiLocal, $("hipCuadra"));
    est = cargar();
    if (est) {
      m = est.mundo; est.vel = est.vel == null ? 10 : est.vel;
      pintarTodo();
    } else crear(semillaAzar());
    requestAnimationFrame(ts => { ultimoMarco = ts; bucle(ts); });
  }
  iniciar();
})();
