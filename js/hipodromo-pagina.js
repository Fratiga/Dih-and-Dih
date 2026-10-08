/* =============================================================================
   HIPÓDROMO (página de prueba, modo local). El mundo de js/hipodromo-motor.js corre entero en este
   navegador y se guarda en localStorage: no usa Supabase. El reloj del mundo es virtual para poder
   adelantar el tiempo y ver días de carreras en minutos; solo avanza mientras la página está abierta.
   Las monedas también son de este navegador. Mira docs/hipodromo.md.
============================================================================= */
(function () {
  "use strict";
  const M = window.HipodromoMotor, D = window.HipodromoDibujo;
  if (!M || !D) return;
  const C = M.C;
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
  const poner = (el, html) => { if (el && el._h !== html) { el.innerHTML = html; el._h = html; } };
  const textoDe = (el, t) => { if (el && el._t !== t) { el.textContent = t; el._t = t; } };

  let est = null, m = null, pestana = "carrera", oculto = false, escena = null, fichaId = null, ultimoMarco = 0, ultimoPintado = 0, mostrarMas = 48, nUI = -1, velEfectiva = 1;
  const filtros = { estado: "pista", orden: "vic", q: "" };
  try { oculto = localStorage.getItem(CLAVE_OCULTO) === "1"; pestana = localStorage.getItem(CLAVE_PESTANA) || "carrera"; } catch (e) { /* sin almacenamiento */ }

  /* ---------------------------------------------------------------- guardar y crear */
  function cargar() {
    try { const g = JSON.parse(localStorage.getItem(CLAVE)); if (g && g.v === 1 && g.mundo && g.mundo.proxima) return g; } catch (e) { /* vacío o dañado */ }
    return null;
  }
  function guardar() {
    if (!est) return;
    try { localStorage.setItem(CLAVE, JSON.stringify(est)); }
    catch (e) {
      try { const ids = Object.keys(est.archivo).slice(-60); const nuevo = {}; ids.forEach(i => { nuevo[i] = est.archivo[i]; }); est.archivo = nuevo; localStorage.setItem(CLAVE, JSON.stringify(est)); }
      catch (e2) { /* sin espacio: se sigue sin guardar */ }
    }
  }
  function crear(semilla) {
    $("hipCargando").classList.remove("hidden");
    setTimeout(() => {
      const r = M.paso(null, Date.now(), { calentar: 300, semilla, simsCalentar: 12 });
      const mundo = r.lote.mundo;
      est = { v: 1, semilla, mundo, virtual: mundo.proxima.hora - 4 * 60000, vel: 10, saldo: SALDO_INICIAL, pendientes: [], historial: [], noticias: [], archivo: {}, resultados: [], favoritos: [], desde: Date.now() };
      m = est.mundo;
      nUI = -1; escena = null;
      guardar();
      $("hipCargando").classList.add("hidden");
      pintarTodo();
    }, 40);
  }
  const semillaAzar = () => "mundo-" + Math.random().toString(36).slice(2, 8);

  /* ---------------------------------------------------------------- datos de ayuda */
  const perfilDe = id => { const c = M.buscar(m, id); return c ? M.perfil(m, c) : est.archivo[id] || null; };
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
    if (p.estado === "fallecido") e.push('<span class="hip-sello gris">Fallecida</span>');
    else if (p.estado === "retirado") e.push('<span class="hip-sello gris">Retirada</span>');
    else if (p.estado === "criador") e.push('<span class="hip-sello">Cría</span>');
    if (p.lesion) e.push(`<span class="hip-sello rojo">${esc(p.lesion.tipo)}</span>`);
    if (p.leyenda) e.push('<span class="hip-sello oro">Leyenda</span>');
    return e.join("");
  }

  /* ---------------------------------------------------------------- el reloj y el paso del tiempo */
  function bucle(ts) {
    requestAnimationFrame(bucle);
    if (!est || !m) { ultimoMarco = ts; return; }
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
    est.pendientes = est.pendientes.filter(ap => {
      if (ap.n !== n) return true;
      if (!res) { est.saldo += ap.monto; est.historial.unshift(Object.assign({}, ap, { gana: false, pago: ap.monto, devuelta: true })); return false; }
      const r = M.liquidar(ap, res);
      est.saldo += r.pago;
      est.historial.unshift(Object.assign({}, ap, { gana: r.gana, pago: r.pago, ganador: res.llegada[0].nombre }));
      msgs.push(r.gana ? `Ganaste ${monedas(r.pago)} monedas (${TIPOS_TXT(ap)})` : `Perdiste ${monedas(ap.monto)} monedas (${TIPOS_TXT(ap)})`);
      return false;
    });
    est.historial.length = Math.min(est.historial.length, MAX_HISTORIAL);
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
        <div><p class="hip-grado">${esc(G.nombre)}</p><h2>${esc(p.nombre)}</h2></div>
        <div class="hip-prog-hora"><span>n.º ${p.n}</span><strong>${horaTxt(p.hora)}</strong></div>
      </div>
      <div class="hip-datos">
        <div><span>Pista</span><strong>${esc(pista.nombre)}</strong><small>${esc(pista.suelo)} · ${esc(M.etiquetaPista(humPrev))}</small></div>
        <div><span>Distancia</span><strong>${p.dist} m</strong><small>${p.dist / 100} tramos</small></div>
        <div><span>Bolsa</span><strong>${monedas(p.bolsa)}</strong><small>reparto entre los 5 primeros</small></div>
        <div><span>Pista en detalle</span><small class="hip-barras">Curvas ${barra(pista.curvas, "Curvas")} Cuestas ${barra(pista.cuestas, "Cuestas")} Drenaje ${barra(pista.drenaje, "Drenaje")}</small></div>
      </div>
      <div class="hip-pron"><span>Pronóstico</span>${pronosticoTxt(p)}</div>
      ${p.rumores.length ? `<ul class="hip-rumores">${p.rumores.map(r => `<li>${esc(r.texto)}</li>`).join("")}</ul>` : ""}
      ${p.suspendida ? '<p class="hip-vacio">No hay criaturas en condiciones de correr. La carrera se aplaza.</p>' : ""}`);
  }

  function pintarInscritos() {
    const p = m.proxima, sec = p.secreto;
    const filas = p.entrantes.map((e, k) => {
      const per = perfilDe(e.id); if (!per) return "";
      const fav = est.favoritos.includes(e.id);
      const real = sec && sec.pReal ? sec.pReal.gan[k] : null;
      return `<tr>
        <td class="hip-puerta">${e.puerta}</td>
        <td><div class="hip-celda-cria">${D.silueta(per, { clase: "hip-mini" })}<div><button type="button" class="hip-enlace" data-ficha="${e.id}">${fav ? "♥ " : ""}${esc(per.nombre)}</button>
          <small>${sexoTxt(per)} · ${esc(per.etapa)} · ${edadTxt(per)}${per.arquetipo ? " · " + esc(per.arquetipo) : ""}</small>
          <small>${per.salidas ? `${per.salidas} salidas · ${per.vic}-${per.seg}-${per.ter}` : "debuta"}</small></div></div></td>
        <td class="hip-col-extra">${estrellasTxt(per.estrellas)}</td>
        <td class="hip-col-extra">${per.ultimas.slice(0, 4).map(chipPuesto).join("") || '<span class="hip-sin">-</span>'}</td>
        <td class="hip-cuota"><button type="button" class="hip-cuota-btn" data-apostar="${e.id}" aria-label="Apostar a ${esc(per.nombre)}, cuota ${M.fmtCuota(e.gan)}"><strong>${M.fmtCuota(e.gan)}</strong><small>podio ${M.fmtCuota(e.pod)}</small></button></td>
        ${oculto ? `<td class="hip-oculto-col">${real == null ? "" : coma(real * 100, 1) + " %"}<small>${real == null ? "" : "vale " + coma(real * e.gan, 2)}</small></td>` : ""}
      </tr>`;
    }).join("");
    poner($("hipInscritos"), `<table class="hip-tabla"><thead><tr><th>Pta.</th><th>Criatura</th><th class="hip-col-extra">Valoración</th><th class="hip-col-extra">Últimas</th><th>Cuota</th>${oculto ? '<th class="hip-oculto-col">Real</th>' : ""}</tr></thead><tbody>${filas}</tbody></table>`);
  }

  /* panel de apuestas */
  function opcionesApuesta(tipo, quitar) {
    const p = m.proxima;
    return p.entrantes.filter(e => e.id !== quitar).map(e => `<option value="${e.id}">${e.puerta}. ${esc(e.nombre)}${tipo === "exacta" ? "" : " (" + M.fmtCuota(tipo === "podio" ? e.pod : e.gan) + ")"}</option>`).join("");
  }
  function pintarPanelApuesta(reset) {
    const tipo = $("hipTipo").value, a = $("hipSel1"), b = $("hipSel2");
    const v1 = a.value, v2 = b.value;
    if (reset || a._tipo !== tipo || a._n !== m.proxima.n) {
      a.innerHTML = opcionesApuesta(tipo); a._tipo = tipo; a._n = m.proxima.n;
      if (v1 && [...a.options].some(o => o.value === v1) && !reset) a.value = v1;
    }
    $("hipSel2Caja").classList.toggle("hidden", tipo !== "exacta");
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
  function pintarCuotaApuesta() {
    const { tipo, sel } = seleccion(), cuota = M.cuotaApuesta(m.proxima, tipo, sel);
    const monto = Math.floor(Number($("hipMonto").value) || 0);
    textoDe($("hipCuotaApuesta"), cuota ? M.fmtCuota(cuota) : "-");
    textoDe($("hipPosible"), cuota && monto > 0 ? monedas(monto * cuota) : "-");
    textoDe($("hipTipoAyuda"), M.TIPOS_APUESTA[tipo].texto);
  }
  function apostar() {
    const p = m.proxima, f = M.ventana(p, est.virtual), msg = $("hipApuestaMsg");
    const falla = t => { msg.textContent = t; msg.className = "hip-aviso mal"; };
    if (f !== "abierta") return falla("Las apuestas de esta carrera están cerradas.");
    const { tipo, sel } = seleccion(), monto = Math.floor(Number($("hipMonto").value) || 0);
    if (!(monto >= 1)) return falla("Pon un importe de al menos 1 moneda.");
    if (monto > est.saldo) return falla("No tienes tantas monedas.");
    const cuota = M.cuotaApuesta(p, tipo, sel);
    if (!cuota) return falla(tipo === "exacta" ? "Elige dos criaturas distintas." : "Esa criatura no corre.");
    const ids = tipo === "exacta" ? sel : [sel];
    est.saldo -= monto;
    est.pendientes.push({ n: p.n, tipo, sel, monto, cuota, nombres: ids.map(nombreDe), carrera: p.nombre });
    guardar();
    msg.textContent = `Apuesta hecha: ${M.TIPOS_APUESTA[tipo].nombre.toLowerCase()} a ${ids.map(nombreDe).join(" y ")}, ${monedas(monto)} monedas a ${M.fmtCuota(cuota)}.`;
    msg.className = "hip-aviso bien";
    pintarPendientesCarrera(); pintarApuestas(); pintarReloj(); pintarCuotaApuesta();
  }
  function pintarPendientesCarrera() {
    const mias = est.pendientes.filter(a => a.n === m.proxima.n);
    poner($("hipMias"), mias.length ? `<h3>Tus apuestas en esta carrera</h3><ul class="hip-lista-apuestas">${mias.map(a => `<li><strong>${esc(M.TIPOS_APUESTA[a.tipo].nombre)}</strong> ${esc(a.nombres.join(" y "))} · ${monedas(a.monto)} a ${M.fmtCuota(a.cuota)} <small>(si acierta, ${monedas(a.monto * a.cuota)})</small></li>`).join("")}</ul>` : "");
  }

  function tablaResultado(res) {
    return `<table class="hip-tabla"><thead><tr><th>Pos.</th><th>Criatura</th><th>Tiempo</th><th class="hip-col-extra">Distancia</th><th>Cuota</th><th class="hip-col-extra">Premio</th></tr></thead><tbody>${res.llegada.map(l => `<tr>
      <td class="hip-puerta">${l.pos}</td><td>${nombreBtn(l.id, l.nombre)}${l.lesion ? ' <span class="hip-sello rojo">lesión</span>' : ""}${l.id === res.favorito ? ' <span class="hip-sello">favorito</span>' : ""}</td>
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
    poner($("hipPista"), carriles.map(c => `<div class="hip-carril" data-id="${c.id}"><span class="hip-carril-p">${c.puerta}</span>
      <div class="hip-carril-pista"><div class="hip-corredor">${D.silueta(c.per, { clase: "hip-mini corre" })}<span class="hip-corredor-nombre">${esc(c.nombre)}</span><span class="hip-aviso-inc"></span></div></div><span class="hip-carril-lugar">-</span></div>`).join(""));
    $("hipPista")._h = null;
    escena = { n: p.n, factor: ultimo / (C.DURACION_SEG - 8), carriles, dist: res.dist, disparados: new Set(), resFinal: false, res,
      nodos: [...$("hipPista").querySelectorAll(".hip-carril")] };
    $("hipEscenaTitulo").textContent = `${res.nombre} · ${res.dist} m · terreno ${res.estadoPista} · ${M.CLIMAS[res.clima].texto}`;
    $("hipEscenaRes").innerHTML = "";
  }
  function pintarEscena() {
    const p = m.proxima, caja = $("hipEscena");
    const visible = est.virtual >= p.hora && p.secreto && p.secreto.res;
    caja.classList.toggle("hidden", !visible);
    if (!visible) return;
    if (!escena || escena.n !== p.n) construirEscena(p.secreto.res);
    const el = Math.max(0, (est.virtual - p.hora) / 1000), T = Math.min(el, C.DURACION_SEG) * escena.factor;
    const ancho = escena.nodos[0].querySelector(".hip-carril-pista").clientWidth - 70;
    const estados = escena.carriles.map(c => {
      const terminada = T >= c.tramos[c.tramos.length - 1];
      return { c, metros: metrosEn(c.tramos, T), terminada };
    });
    const orden = estados.slice().sort((a, b) => (a.terminada !== b.terminada ? (a.terminada ? -1 : 1) : a.terminada ? a.c.pos - b.c.pos : b.metros - a.metros));
    const lugar = new Map(orden.map((s, i) => [s.c.id, i + 1]));
    estados.forEach((s, i) => {
      const nodo = escena.nodos[i], corre = nodo.querySelector(".hip-corredor");
      corre.style.transform = `translateX(${(Math.min(1, s.metros / escena.dist) * Math.max(0, ancho)).toFixed(1)}px)`;
      textoDe(nodo.querySelector(".hip-carril-lugar"), (s.terminada ? s.c.pos : lugar.get(s.c.id)) + "º");
      nodo.classList.toggle("fin", s.terminada);
    });
    // tropiezos y lesiones
    escena.res.incidentes.forEach(inc => {
      const k = `${inc.id}-${inc.tramo}-${inc.tipo}`; if (escena.disparados.has(k)) return;
      const s = estados.find(x => x.c.id === inc.id);
      if (s && s.metros >= inc.tramo * 100 + 50) {
        escena.disparados.add(k);
        const nodo = escena.nodos[estados.indexOf(s)], marca = nodo.querySelector(".hip-aviso-inc");
        marca.textContent = inc.tipo === "lesion" ? "✚" : "!";
        marca.className = "hip-aviso-inc on " + inc.tipo;
        setTimeout(() => { if (inc.tipo !== "lesion") marca.className = "hip-aviso-inc"; }, 1600);
      }
    });
    textoDe($("hipEscenaProgreso"), el >= C.DURACION_SEG ? "Meta" : `${Math.min(escena.dist, Math.round(Math.max.apply(null, estados.map(s => s.metros)) / 10) * 10)} m de ${escena.dist} m`);
    if (el >= C.DURACION_SEG && !escena.resFinal) { escena.resFinal = true; $("hipEscenaRes").innerHTML = tablaResultado(escena.res); }
  }

  /* ---------------------------------------------------------------- pestaña Criaturas y ficha */
  function listaCriaturas() {
    const todas = m.vivos.concat(m.criadores).map(c => M.perfil(m, c)).concat(Object.values(est.archivo));
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
      <small>${sexoTxt(p)} · ${esc(p.etapa)} · gen. ${p.gen}</small>
      <span class="hip-cria-record">${p.salidas ? `${p.salidas} salidas · ${p.vic}-${p.seg}-${p.ter}` : "sin salidas"}</span>
      ${estrellasTxt(p.estrellas)}<span class="hip-sellos">${etiquetasEstado(p)}</span></button>`;
  }
  function pintarCriaturas() {
    const l = listaCriaturas();
    poner($("hipCriaCuenta"), `${l.length} ${l.length === 1 ? "criatura" : "criaturas"}`);
    poner($("hipCriaLista"), l.slice(0, mostrarMas).map(tarjetaCria).join("") || '<p class="hip-vacio">No hay criaturas que coincidan.</p>');
    $("hipCriaMas").classList.toggle("hidden", l.length <= mostrarMas);
  }

  function fichaHtml(p) {
    const c = M.buscar(m, p.id), apt = p.aptitudes;
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
          <p>${sexoTxt(p)} · ${esc(p.etapa)} · ${edadTxt(p)} · generación ${p.gen}${p.arquetipo ? " · " + esc(p.arquetipo) : ""}</p>
          <p class="hip-sellos">${etiquetasEstado(p)}${p.etiquetas.filter(t => t !== "Leyenda").map(t => `<span class="hip-sello">${esc(t)}</span>`).join("")}</p>
          <button type="button" class="hip-boton" data-favorito="${p.id}" aria-pressed="${fav}">${fav ? "♥ En favoritas" : "♡ Seguir"}</button></div></div>
      ${lesion}
      <div class="hip-datos"><div><span>Salidas</span><strong>${p.salidas}</strong><small>${p.vic} victorias · ${p.seg} segundos · ${p.ter} terceros</small></div>
        <div><span>Premios</span><strong>${monedas(p.premios)}</strong><small>${p.gp ? p.gp + (p.gp > 1 ? " Grandes Premios" : " Gran Premio") : "sin Grandes Premios"}</small></div>
        <div><span>Valoración</span><strong>${estrellasTxt(p.estrellas)}</strong><small>${p.estilo ? esc(p.estilo) : "estilo por conocer"}</small></div>
        <div><span>Tipo</span><strong>${esc(p.perfilDist)}</strong><small>${p.crias ? p.crias + " crías" : "sin crías"}</small></div></div>
      <section class="hip-ficha-sec"><h3>Cuerpo</h3><ul class="hip-cuerpo">${p.cuerpo.map(x => `<li><span>${esc(x.parte)}</span> ${esc(x.texto)} <i class="hip-nivel" title="nivel ${x.nivel} de 5">${"●".repeat(x.nivel)}${"○".repeat(5 - x.nivel)}</i></li>`).join("")}</ul>
        <p class="hip-nota">Capa ${esc(p.capa)}.${p.secuelas.length ? " Secuelas: " + esc(p.secuelas.join("; ")) + "." : ""}</p></section>
      <section class="hip-ficha-sec"><h3>En cada tipo de terreno</h3><div class="hip-aptitudes">${Object.keys(nombres).map(k => `<div><span>${nombres[k]}</span>${apt[k] ? estrellasTxt(apt[k].estrellas) + `<small>${apt[k].salidas} salidas</small>` : '<span class="hip-sin">sin datos</span>'}</div>`).join("")}</div></section>
      <section class="hip-ficha-sec"><h3>Linaje</h3><p>${linaje}</p></section>
      <section class="hip-ficha-sec"><h3>Últimas carreras</h3>${p.ultimas.length ? `<table class="hip-tabla"><thead><tr><th>n.º</th><th>Pista</th><th>Metros</th><th>Puesto</th><th>Cuota</th></tr></thead><tbody>${p.ultimas.map(h => `<tr><td>${h.n}</td><td>${esc(M.PISTAS[h.pista].nombre)}<small> ${esc(h.estadoPista)}</small></td><td>${h.dist}</td><td>${chipPuesto(h)} <small>de ${h.campo}</small></td><td>${M.fmtCuota(h.cuota)}</td></tr>`).join("")}</tbody></table>` : '<p class="hip-sin">Todavía no ha corrido.</p>'}</section>
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
    poner($("hipApuestasResumen"), `<div class="hip-datos"><div><span>Monedas</span><strong>${monedas(est.saldo)}</strong></div><div><span>Apostado</span><strong>${monedas(tot.ap)}</strong></div><div><span>Cobrado</span><strong>${monedas(tot.co)}</strong></div><div><span>Rendimiento</span><strong>${tot.ap ? coma((tot.co / tot.ap - 1) * 100, 1) + " %" : "-"}</strong></div></div>`);
    poner($("hipApuestasPend"), est.pendientes.length ? `<h3>Pendientes</h3><ul class="hip-lista-apuestas">${est.pendientes.map(a => `<li>n.º ${a.n} · <strong>${esc(M.TIPOS_APUESTA[a.tipo].nombre)}</strong> ${esc(a.nombres.join(" y "))} · ${monedas(a.monto)} a ${M.fmtCuota(a.cuota)}</li>`).join("")}</ul>` : "");
    poner($("hipApuestasHist"), est.historial.length ? `<h3>Historial</h3><table class="hip-tabla"><thead><tr><th>n.º</th><th>Apuesta</th><th>Importe</th><th>Cuota</th><th>Resultado</th></tr></thead><tbody>${est.historial.map(h => `<tr class="${h.devuelta ? "" : h.gana ? "gana" : "pierde"}"><td>${h.n}</td><td>${esc(M.TIPOS_APUESTA[h.tipo].nombre)} a ${esc(h.nombres.join(" y "))}</td><td>${monedas(h.monto)}</td><td>${M.fmtCuota(h.cuota)}</td><td>${h.devuelta ? "devuelta" : h.gana ? "+" + monedas(h.pago - h.monto) : "-" + monedas(h.monto)}</td></tr>`).join("")}</tbody></table>` : '<p class="hip-vacio">Todavía no has apostado.</p>');
  }
  function pintarMundo() {
    const s = m.stats, vivas = m.vivos.length;
    const dias = (m.n - 300) / 48;
    poner($("hipMundoDatos"), `<div class="hip-datos">
      <div><span>Carreras corridas</span><strong>${s.carreras}</strong><small>${coma(Math.max(0, dias), 1)} días desde que empezó aquí</small></div>
      <div><span>Criaturas vivas</span><strong>${vivas}</strong><small>${m.criadores.length} en la cría</small></div>
      <div><span>Nacimientos</span><strong>${s.nacidos}</strong><small>${s.retirados} retiros</small></div>
      <div><span>Lesiones</span><strong>${s.lesiones}</strong><small>${s.incidentes} incidentes de establo, ${s.muertes} ${s.muertes === 1 ? "muerte" : "muertes"}</small></div></div>
      <p class="hip-nota">Semilla: <code>${esc(est.semilla)}</code>. Un año de las criaturas son ${C.ANIO} carreras (${coma(C.ANIO / 48, 1)} días). Con la misma semilla el mundo sale igual.</p>`);
    $("hipOculto").checked = oculto;
  }

  /* ---------------------------------------------------------------- pintar */
  function pintarTodo() {
    pintarReloj();
    pintarApuestas(); pintarNoticias(); pintarMundo();
    if (nUI !== m.proxima.n) {
      nUI = m.proxima.n;
      pintarPrograma(); pintarPanelApuesta(true); pintarPendientesCarrera(); pintarUltimo();
    }
    pintarInscritos();
    pintarCriaturas();
    mostrarPestana(pestana, true);
  }
  function mostrarPestana(id, sinGuardar) {
    pestana = id;
    document.querySelectorAll("[data-pestana]").forEach(b => { const on = b.dataset.pestana === id; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
    document.querySelectorAll(".hip-panel").forEach(p => p.classList.toggle("hidden", p.id !== "hipPanel-" + id));
    if (!sinGuardar) try { localStorage.setItem(CLAVE_PESTANA, id); } catch (e) { /* sin almacenamiento */ }
    if (id === "criaturas") pintarCriaturas();
  }

  /* ---------------------------------------------------------------- eventos */
  function iniciarEventos() {
    $("hipVelocidad").innerHTML = VELOCIDADES.map(([v, t]) => `<button type="button" class="hip-boton chico" data-vel="${v}" aria-pressed="false">${t}</button>`).join("");
    $("hipVelocidad").addEventListener("click", e => { const b = e.target.closest("[data-vel]"); if (!b) return; est.vel = Number(b.dataset.vel); guardar(); pintarReloj(); });
    $("hipSaltar").addEventListener("click", saltar);
    document.querySelector(".hip-pestanas").addEventListener("click", e => { const b = e.target.closest("[data-pestana]"); if (b) mostrarPestana(b.dataset.pestana); });
    document.querySelector(".hip-pestanas").addEventListener("keydown", e => {
      if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
      const bs = [...document.querySelectorAll("[data-pestana]")], i = bs.findIndex(b => b.getAttribute("aria-selected") === "true");
      const sig = bs[(i + (e.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length]; mostrarPestana(sig.dataset.pestana); sig.focus();
    });
    document.addEventListener("click", e => {
      const f = e.target.closest("[data-ficha]"); if (f) { abrirFicha(Number(f.dataset.ficha)); return; }
      const a = e.target.closest("[data-apostar]");
      if (a) { $("hipSel1").value = a.dataset.apostar; pintarPanelApuesta(false); $("hipPanelApuesta").scrollIntoView({ behavior: "smooth", block: "center" }); $("hipMonto").focus(); return; }
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
    $("hipCriaEstado").addEventListener("change", e => { filtros.estado = e.target.value; mostrarMas = 48; pintarCriaturas(); });
    $("hipCriaOrden").addEventListener("change", e => { filtros.orden = e.target.value; pintarCriaturas(); });
    $("hipCriaBuscar").addEventListener("input", e => { filtros.q = e.target.value; mostrarMas = 48; pintarCriaturas(); });
    $("hipCriaMas").addEventListener("click", () => { mostrarMas += 48; pintarCriaturas(); });
    $("hipOculto").addEventListener("change", e => { oculto = e.target.checked; try { localStorage.setItem(CLAVE_OCULTO, oculto ? "1" : "0"); } catch (x) { /* sin almacenamiento */ } nUI = -1; pintarTodo(); if (fichaId != null) abrirFicha(fichaId); });
    $("hipReiniciar").addEventListener("click", async () => {
      const semilla = await dialogo.pedir("Se borra este mundo, tus monedas y tus apuestas, y empieza otro. Escribe una semilla, o déjala vacía para una al azar.", "", { titulo: "Empezar un mundo nuevo", marcador: "mundo-1", aceptar: "Empezar" });
      if (semilla === null) return;
      crear(semilla.trim() || semillaAzar());
    });
    $("hipMonedas").addEventListener("click", async () => {
      if (!(await dialogo.confirmar(`Vuelves a tener ${SALDO_INICIAL} monedas y se borran tus apuestas pendientes. El mundo sigue igual.`, { titulo: "Reiniciar las monedas", aceptar: "Reiniciar" }))) return;
      est.pendientes = []; est.historial = []; est.saldo = SALDO_INICIAL; guardar(); pintarTodo(); pintarPendientesCarrera();
    });
    window.addEventListener("beforeunload", guardar);
    document.addEventListener("visibilitychange", () => { if (document.hidden) guardar(); });
  }

  /* ---------------------------------------------------------------- arranque */
  function iniciar() {
    iniciarEventos();
    est = cargar();
    if (est) {
      m = est.mundo; est.vel = est.vel == null ? 10 : est.vel;
      pintarTodo();
    } else crear(semillaAzar());
    requestAnimationFrame(ts => { ultimoMarco = ts; bucle(ts); });
  }
  iniciar();
})();
