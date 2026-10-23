/* =============================================================================
   HIPÓDROMO: la pestaña «Mi cuadra». Lo que hace cada jugador con sus criaturas: adoptar la primera, comprar y vender,
   inscribir en las próximas carreras, entrenar, cuidar, marcar una táctica, bautizar, retirar a la cría y cruzar.
   No sabe de dónde salen los datos: la página le pasa un objeto `api` (modo local o con servidor) y esta pestaña
   solo pinta y manda órdenes. El motor es el que decide si una orden vale y cuánto cuesta (js/hipodromo-motor.js).
============================================================================= */
window.HipodromoCuadraUI = (function () {
  "use strict";
  const T = (clave, texto) => (window.HipodromoGlosario ? window.HipodromoGlosario.tip(clave, texto) : texto);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const STATS = { vel: "Velocidad", res: "Resistencia", ace: "Arranque", agi: "Agilidad", tem: "Temple" };
  const TACTICAS = { "": "A su aire", frente: "Al frente", media: "A media tabla", atras: "Desde atrás" };
  const HR = window.HipodromoRasgos;
  const NOMBRE_RASGO = { patas: "Patas", cuello: "Cuello", hocico: "Hocico", orejas: "Orejas", cuernos: "Cuernos", espalda: "Espalda", cola: "Cola", piel: "Piel", ojos: "Ojos", alas: "Alas", dedos: "Dedos", patron: "Dibujo del pelaje", nucleo: "Núcleo" };
  const GRADO_CLASE = { gran: "oro", selecta: "plata", corriente: "", novatos: "", copa_bronce: "copa", copa_plata: "copa", copa_oro: "copa", copa_leyendas: "copa" };

  function crear(api, cont) {
    const M = api.M, D = api.D;
    let msg = { texto: "", clase: "" }, ocupado = false, abiertas = new Set(), hash = "";
    const mon = x => api.monedas(x);
    const horaTxt = ms => new Date(ms).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

    let vista = "mias", mercOrden = "precio", mercMax = 12, enCurso = null;
    const semSel = {}, riesgoOk = new Set(), montaTxt = {};   // lo que se ha elegido en cada cruce (semental, riesgo confirmado) y lo escrito en el precio de monta: sobreviven a repintar
    const pc = x => (x * 100).toLocaleString("es", { maximumFractionDigits: 1 }) + " %";
    const TEXTO_ESPERA = { entrenar: "Entrenando...", cuidar: "Cuidando...", inscribir: "Inscribiendo...", desinscribir: "Quitando...", comprar: "Comprando...", vender: "Vendiendo...", retirar: "Retirando...", nombre: "Bautizando...", cruzar: "Cruzando...", adoptar: "Adoptando...", monta: "Guardando..." };
    /* La orden que se está esperando pone su botón en «cargando» y los demás se apagan. Se llama después de cada dibujo, porque pintar() reescribe todo el HTML. */
    function marcarEspera() {
      if (!enCurso) return;
      const clave = `${enCurso.tipo}|${enCurso.id != null ? enCurso.id : enCurso.madre != null ? enCurso.madre : ""}|${enCurso.n != null ? enCurso.n : ""}`;
      cont.querySelectorAll("[data-o]").forEach(b => {
        if (`${b.dataset.o}|${b.dataset.id || ""}|${b.dataset.n || ""}` === clave) window.HipEspera.poner(b, TEXTO_ESPERA[enCurso.tipo]);
        else b.disabled = true;
      });
    }
    async function mandar(o, textoOk) {
      if (ocupado) return;
      ocupado = true; enCurso = o; msg = { texto: "Enviando...", clase: "" }; pintar(true);
      let r;
      try { r = await api.ordenar(o); } catch (e) { r = { ok: false, error: "No se pudo enviar la orden." }; }
      ocupado = false; enCurso = null;
      msg = r.ok ? { texto: r.texto || textoOk || "Hecho.", clase: "bien" } : { texto: r.error || "No se pudo.", clase: "mal" };
      pintar(true);
    }

    /* ---------------------------------------------------------------- piezas */
    /* Mutaciones (✦ las grandes), manías y la marca de consanguínea, en fichas pequeñas con lo que hacen al pasar el cursor */
    const chips = p => {
      const mu = D.mutacionesDetalle(p).map(x => `<span class="hip-mut ${x.tipo}${x.grande ? " grande" : ""}" title="${esc(x.hace)}">${x.grande ? "✦ " : ""}${esc(x.texto)}</span>`);
      const ma = D.maniasDetalle(p).map(x => `<span class="hip-mania ${x.tipo}" title="${esc(x.hace)}">${esc(x.texto)}</span>`);
      return mu.concat(ma).join(" ") + (p.consanguinea ? ' <span class="hip-mut tara" title="Sus padres eran parientes cercanos">consanguínea</span>' : "");
    };
    /* Lo que se sabe antes de pagar un cruce, con los perfiles públicos: parentesco, camada, de quién puede salir cada rasgo, mutaciones y manías */
    function previaHtml(pre, p, sp) {
      const pmut = D.mutacionesDetalle({ mut: pre.mut.map(x => x.id) }), pman = D.maniasDetalle({ manias: pre.manias.map(x => x.id) });
      const por = id => pre.mut.find(x => x.id === id).p, pman2 = id => pre.manias.find(x => x.id === id).p;
      const filas = pre.rasgos.slice(0, 8).map(r => `<li><strong>${esc(NOMBRE_RASGO[r.clave] || r.clave)}:</strong> ${r.opciones.map(o => `${esc(o.texto.toLowerCase())} (${pc(o.p)})`).join(" o ")}, o uno nuevo (${pc(r.nuevo)}).</li>`).join("");
      return `<div class="hip-previa${pre.riesgo ? " riesgo" : ""}">
        <p class="hip-previa-par"><strong>${esc(pre.parentescoTexto)}.</strong>${pre.riesgo ? " Salen muchas más mutaciones y muchas son taras." : pre.parentesco > 0 ? " Algo más de mutaciones de lo normal." : ""}</p>
        <p>${esc(p.nombre)}${p.arquetipo ? ` (${esc(p.arquetipo)})` : ""} y ${esc(sp.nombre)}${sp.arquetipo ? ` (${esc(sp.arquetipo)})` : ""}. El cuerpo sale de una mezcla de los dos con algo de azar.</p>
        <p><strong>${T("camada", "Camada")}:</strong> ${pre.camada.map(x => `${x.n} ${x.n === 1 ? "cría" : "crías"} (${pc(x.p)})`).join(", ")}. Cada cría es distinta.</p>
        ${filas ? `<ul class="hip-previa-lista">${filas}</ul>` : ""}
        <p><strong>${T("mutacion", "Mutaciones")} que pueden heredar:</strong> ${pmut.length ? pmut.map(x => `<span class="hip-mut ${x.tipo}${x.grande ? " grande" : ""}" title="${esc(x.hace)}">${x.grande ? "✦ " : ""}${esc(x.texto)} (${pc(por(x.id))})</span>`).join(" ") : "ninguna de los padres"}.
          Mutación nueva: pequeña ${pc(pre.nueva.pequena)}, grande ${pc(pre.nueva.grande)}; de las pequeñas, ${pc(pre.nueva.taraEntreLasPequenas)} son taras.</p>
        ${pman.length ? `<p><strong>${T("manias", "Carácter")} que pueden heredar:</strong> ${pman.map(x => `<span class="hip-mania ${x.tipo}" title="${esc(x.hace)}">${esc(x.texto)} (${pc(pman2(x.id))})</span>`).join(" ")}.</p>` : ""}
      </div>`;
    }
    const barra = (v, max, clase) => `<span class="hip-barrita ${clase || ""}" title="${Math.round(v)}"><i style="width:${Math.max(0, Math.min(100, (v / max) * 100)).toFixed(0)}%"></i></span>`;
    function calendarioHtml(c, pub, cal) {
      const filas = cal.map(x => {
        const dentro = c.entradas.find(en => en.n === x.n);
        const pista = M.PISTAS[x.pista];
        const cierra = x.cierra ? horaTxt(x.cierra) : "";
        const llega = !x.copa || (c.copas || []).includes(x.grado);
        return `<tr${x.copa ? ' class="hip-fila-copa"' : ""}><td>${x.n}</td><td>${x.copa ? new Date(x.hora).toLocaleDateString("es", { weekday: "short" }) + " " : ""}${horaTxt(x.hora)}</td><td><span class="hip-sello ${GRADO_CLASE[x.grado] || ""}">${x.copa ? "★ " : ""}${T("grado_" + x.grado, esc(x.gradoNombre))}</span> ${esc(x.nombre)}${x.copa ? `<small class="hip-copa-req">Bolsa ${mon(x.bolsa)}. Solo las mejores del mundo, con al menos ${x.salidasMin} salidas.</small>` : ""}</td><td>${x.dist} m</td><td>${esc(pista ? pista.nombre : x.pista)}${pista && pista.arcana ? ` <span class="hip-sello">${T("arcana", "arcana")}</span>` : ""}</td>
          <td>${mon(x.inscripcion)}</td><td>${dentro || (llega && x.plazas > 0) ? `<button type="button" class="hip-boton chico" data-o="${dentro ? "desinscribir" : "inscribir"}" data-id="${pub.id}" data-n="${x.n}">${dentro ? "Quitar" : "Inscribir"}</button>` : !llega ? '<span class="hip-sin" title="Solo corren las criaturas mejor valoradas del mundo">no llega</span>' : '<span class="hip-sin">completa</span>'}</td></tr>`;
      }).join("");
      return `<div class="hip-tabla-ancha"><table class="hip-tabla"><thead><tr><th>n.º</th><th>Hora</th><th>Carrera</th><th>${T("distancia", "Dist.")}</th><th>${T("pista", "Pista")}</th><th>${T("inscribir", "Cuesta")}</th><th></th></tr></thead><tbody>${filas}</tbody></table></div>
        <p class="hip-nota">Las inscripciones de cada carrera cierran cuando termina la anterior. Inscribir cuesta el 10 % de la bolsa (más en las copas: del 10 al 14 %) y se devuelve si la carrera no se corre o la criatura no puede salir.</p>`;
    }
    function tarjetaMia(e, cal, semental) {
      const p = e.p, c = e.c, ficha = `<button type="button" class="hip-enlace" data-ficha="${p.id}">${esc(p.nombre)}</button>`;
      const sellos = [];
      if (p.lesion) sellos.push(`<span class="hip-sello rojo">${esc(p.lesion.tipo)}</span>`);
      if (c.entreno) sellos.push(`<span class="hip-sello">entrena ${esc(STATS[c.entreno.stat].toLowerCase())} hasta la n.º ${c.entreno.hasta}</span>`);
      if (p.estado === "criador") sellos.push(`<span class="hip-sello">${T("criador", "en la cría")}</span>`);
      if (c.cruce && c.cruce.length) sellos.push(`<span class="hip-sello oro">espera cría de ${esc(c.cruce[0].padre)} (n.º ${c.cruce[0].n})</span>`);
      const cap = M.STATS.map(k => `<div class="hip-cap"><span>${T("cap_" + k, STATS[k])}</span>${barra(c.capacidades[k], 100)}<b>${c.capacidades[k]}</b>${c.mejoras[k] ? `<small class="${c.mejoras[k] > 0 ? "sube" : "baja"}">${c.mejoras[k] > 0 ? "+" : ""}${(Math.round(c.mejoras[k] * 10) / 10)}</small>` : ""}</div>`).join("");
      const abierta = id => (abiertas.has(id) ? " open" : "");
      const corre = p.estado === "activo";
      let acciones = "";
      if (corre) {
        acciones += `<details data-d="ins${p.id}"${abierta("ins" + p.id)}><summary>${T("inscribir", "Inscribir en carreras")}${c.entradas.length ? ` (${c.entradas.length})` : ""}</summary>${calendarioHtml(c, p, cal)}</details>`;
        acciones += `<details data-d="ent${p.id}"${abierta("ent" + p.id)}><summary>${T("entrenar", "Entrenar")}</summary><p class="hip-nota">Una sesión dura ${M.C.ENTRENO_CARRERAS} carreras y mientras dura no corre. Mejora una capacidad un poco (más en las jóvenes, menos cuanto más entrenada) y puede lesionarla. Cuesta ${mon(M.C.ENTRENO_COSTE)}.</p>
          <select data-stat="${p.id}">${M.STATS.map(k => `<option value="${k}">${STATS[k]}</option>`).join("")}</select> <button type="button" class="hip-boton chico" data-o="entrenar" data-id="${p.id}"${c.entreno || p.lesion ? " disabled" : ""}>Entrenar</button></details>`;
      }
      let fila = `<div class="hip-fila-acc">`;
      if (corre || p.estado === "criador") fila += `<label>${T("tactica", "Táctica")} <select data-tactica="${p.id}">${Object.keys(TACTICAS).map(k => `<option value="${k}"${(c.tactica || "") === k ? " selected" : ""}>${TACTICAS[k]}</option>`).join("")}</select></label>`;
      fila += `<button type="button" class="hip-boton chico" data-o="cuidar" data-id="${p.id}"${c.puedeCuidar && (c.fatiga > 5 || p.lesion) ? "" : " disabled"} title="Quita 20 de cansancio y acorta una lesión">Cuidar (${M.C.CUIDADO_COSTE})</button>`;
      if (!c.renombrada) fila += `<button type="button" class="hip-boton chico" data-o="nombre" data-id="${p.id}">Bautizar (${M.C.NOMBRE_COSTE})</button>`;
      if (corre) fila += `<button type="button" class="hip-boton chico" data-o="retirar" data-id="${p.id}">Retirar a la cría</button>`;
      fila += `<button type="button" class="hip-boton chico" data-o="vender" data-id="${p.id}">Vender (${mon(c.venta)})</button></div>`;
      if (p.estado === "criador" && p.sexo === "f" && !(c.cruce && c.cruce.length)) {
        const sel = semSel[p.id] != null && semental.some(s => s.id === semSel[p.id]) ? semSel[p.id] : (semental[0] ? semental[0].id : null);
        const sp = sel != null ? api.perfil(sel) : null, pre = sp ? HR.previaCruce(p, sp) : null;
        const propio = sp && sp.dueno && api.mias().some(x => x.p.id === sp.id), coste = sp ? (propio && sp.montaBase != null ? sp.montaBase : sp.montaPrecio) : 0;
        const falta = pre && pre.riesgo && !riesgoOk.has(p.id);
        acciones += `<details data-d="cr${p.id}"${abierta("cr" + p.id)}><summary>${T("cruzar", "Cruzar")}</summary><p class="hip-nota">Elige un semental en la cría. La cría nace en ${M.C.CRUCE_ESPERA} carreras, puede ser una camada de una a tres, y serán tuyas. Si el semental es de otra cuadra, la monta se paga a su dueño; con uno tuyo se paga el precio de siempre a la casa. Necesitas sitio en la cuadra.</p>
          <select data-semental="${p.id}">${semental.map(s => `<option value="${s.id}"${s.id === sel ? " selected" : ""}>${esc(s.nombre)} · ${s.vic} victorias · ${mon(s.montaPrecio)}${s.dueno ? " · de " + esc(s.dueno.nombre || "otra cuadra") : ""}</option>`).join("") || '<option value="">No hay sementales</option>'}</select>
          ${pre ? previaHtml(pre, p, sp) : ""}
          ${pre && pre.riesgo ? `<label class="hip-riesgo"><input type="checkbox" data-riesgo="${p.id}"${riesgoOk.has(p.id) ? " checked" : ""}> Asumo el riesgo de cruzar parientes cercanos</label>` : ""}
          <button type="button" class="hip-boton chico" data-o="cruzar" data-id="${p.id}"${sp && !falta ? "" : " disabled"}>Cruzar${sp ? ` (${mon(coste)})` : ""}</button></details>`;
      }
      if (p.estado === "criador" && p.sexo === "m") {
        const actual = montaTxt[p.id] != null ? montaTxt[p.id] : p.montaPrecio;
        acciones += `<details data-d="mo${p.id}"${abierta("mo" + p.id)}><summary>${T("monta", "Precio de monta")}</summary><p class="hip-nota">Lo que cobras a otros jugadores por montar a ${esc(p.nombre)}: de ${M.C.MONTA_MIN} a ${M.C.MONTA_MAX} tokens. Si no pones ninguno, sale de su palmarés (${mon(p.montaBase != null ? p.montaBase : p.montaPrecio)}). Con tus propias hembras se paga siempre ese precio de siempre, a la casa.</p>
          <input type="number" min="${M.C.MONTA_MIN}" max="${M.C.MONTA_MAX}" step="10" data-montaprecio="${p.id}" value="${esc(actual)}"> <button type="button" class="hip-boton chico" data-o="monta" data-id="${p.id}">Fijar precio</button>
          <button type="button" class="hip-boton chico" data-o="monta" data-id="${p.id}" data-reset="1"${p.montaCfg ? "" : " disabled"}>Volver al de siempre</button></details>`;
      }
      return `<article class="hip-mia"><div class="hip-mia-cab">${D.silueta(p, { clase: "hip-silueta mediana" })}<div><h4>${ficha}</h4>
        <p class="hip-nota">${p.sexo === "f" ? "Hembra" : "Macho"} · ${esc(p.etapa)} · ${api.edadTxt(p)} · ${p.salidas ? `${p.salidas} salidas · ${p.vic}-${p.seg}-${p.ter}` : "sin salidas"}</p>
        <p class="hip-sellos">${sellos.join("")}</p>${chips(p) ? `<p class="hip-chips">${chips(p)}</p>` : ""}</div></div>
        <div class="hip-caps"><div class="hip-cap"><span>${T("cansancio", "Cansancio")}</span>${barra(c.fatiga, 100, c.fatiga > 55 ? "mal" : "")}<b>${c.fatiga}</b></div><p class="hip-nota">${T("forma", "Forma")}: ${esc(c.forma)}.</p>${cap}<p class="hip-nota">Tu entrenador estima las ${T("capacidades", "capacidades")} de cinco en cinco. La suerte del día no sale ahí.</p></div>
        ${fila}${acciones}</article>`;
    }
    const ORDENES = { precio: ["Precio, de menor a mayor", (a, b) => a.precio - b.precio], caro: ["Precio, de mayor a menor", (a, b) => b.precio - a.precio],
      valor: ["Mejor valoración", (a, b) => (b.estrellas || 0) - (a.estrellas || 0) || a.precio - b.precio], vic: ["Más victorias", (a, b) => b.vic - a.vic || a.precio - b.precio], jovenes: ["Más jóvenes", (a, b) => b.nac - a.nac || a.precio - b.precio] };
    function mercadoHtml() {
      const lista = api.mercado().slice().sort(ORDENES[mercOrden][1]), saldo = api.saldo();
      if (!lista.length) return '<p class="hip-vacio">No hay criaturas a la venta ahora mismo.</p>';
      const tarjetas = lista.slice(0, mercMax).map(p => `<li class="hip-merc"><div class="hip-merc-fig">${D.silueta(p, { clase: "hip-silueta mediana" })}</div>
        <div class="hip-merc-info"><button type="button" class="hip-enlace" data-ficha="${p.id}">${esc(p.nombre)}</button>
          <small>${p.sexo === "f" ? "Hembra" : "Macho"} · ${esc(p.etapa)} · ${api.edadTxt(p)}${p.arquetipo ? " · " + esc(p.arquetipo) : ""}</small>
          <div class="hip-merc-valor">${api.estrellasTxt(p.estrellas)}</div>${chips(p) ? `<p class="hip-chips">${chips(p)}</p>` : ""}<small>${p.salidas ? `${p.salidas} salidas · ${p.vic}-${p.seg}-${p.ter}` : "sin salidas"}</small></div>
        <div class="hip-merc-compra"><strong>${mon(p.precio)}</strong><button type="button" class="hip-boton chico" data-o="comprar" data-id="${p.id}"${p.precio > saldo ? " disabled" : ""}>Comprar</button></div></li>`).join("");
      return `<div class="hip-merc-barra"><label>Ordenar por <select data-mercorden>${Object.keys(ORDENES).map(k => `<option value="${k}"${k === mercOrden ? " selected" : ""}>${ORDENES[k][0]}</option>`).join("")}</select></label><span class="hip-nota">${Math.min(mercMax, lista.length)} de ${lista.length}</span></div>
        <ul class="hip-mercado">${tarjetas}</ul>${lista.length > mercMax ? '<p class="hip-merc-mas"><button type="button" class="hip-boton" data-mercmas>Mostrar más</button></p>' : ""}`;
    }

    /* ---------------------------------------------------------------- pintar */
    function pintar(forzar) {
      if (api.listo && !api.listo()) return;
      const mias = api.mias(), cal = api.calendario(), max = M.C.MAX_CABALLOS, adoptada = api.adoptada();
      const semental = api.sementales();
      const nAvisos = api.avisos().length, merc = api.mercado().length;
      const subpestanas = `<nav class="hip-subpestanas" aria-label="Secciones de la cuadra">
        <button type="button" data-vista="mias" aria-pressed="${vista === "mias"}">Mis criaturas <small>${mias.length}/${max}</small></button>
        <button type="button" data-vista="mercado" aria-pressed="${vista === "mercado"}">Mercado <small>${merc}</small></button>
        <button type="button" data-vista="avisos" aria-pressed="${vista === "avisos"}">Avisos <small>${nAvisos}</small></button></nav>`;
      const cabecera = `<div class="hip-cuadra-cab"><h3>${T("cuadra", "Mi cuadra")}</h3><p>Tokens: <strong>${mon(api.saldo())}</strong></p></div>
        <p class="hip-aviso ${msg.clase}" role="status" aria-live="polite">${esc(msg.texto)}</p>`;
      let cuerpo;
      if (vista === "mercado") cuerpo = `<section class="hip-tarjeta"><h3>Mercado</h3><p class="hip-nota">Criaturas sin dueño que puedes comprar (las mejores del mundo no se venden: a esas hay que criarlas y entrenarlas). El precio sale de su palmarés y su linaje, como lo ve todo el mundo. Si luego quieres venderla, la casa paga el ${Math.round(M.C.VENTA * 100)} % de lo que costaría ahora.</p>${mercadoHtml()}</section>`;
      else if (vista === "avisos") cuerpo = `<section class="hip-tarjeta"><h3>Avisos de la cuadra</h3>${nAvisos ? `<ul class="hip-avisos">${api.avisos().slice(0, 25).map(a => `<li><small>n.º ${a.n}</small> ${esc(a.texto)}</li>`).join("")}</ul>` : '<p class="hip-vacio">Todavía no hay avisos.</p>'}</section>`;
      else cuerpo = `<section class="hip-tarjeta"><p class="hip-nota hip-nota-cuadra">Aquí eres el dueño. Inscribes a tus criaturas en las carreras que quieras (los entrenadores del mundo no las mueven), las entrenas, las cuidas y, cuando se retiren, las cruzas. Cada carrera paga una bolsa a los cinco primeros y esa bolsa es tuya. Correr cuesta una inscripción y entrenar y cuidar también cuestan: no a todas les sale a cuenta.</p>
        ${!adoptada && !mias.length ? `<div class="hip-adoptar"><h4>Recibe tu primera criatura</h4><p class="hip-nota">La casa te da una criatura joven, de cuerpo corriente, lista para debutar. Es gratis y solo se hace una vez.</p>
          <label>Sexo <select id="hipAdoptarSexo"><option value="f">Hembra</option><option value="m">Macho</option></select></label> <button type="button" class="hip-boton principal" data-o="adoptar">Adoptar</button></div>` : ""}
        <div class="hip-mias">${mias.map(e => tarjetaMia(e, cal, semental)).join("")}</div></section>`;
      const html = `${cabecera}${subpestanas}${cuerpo}`;
      if (!forzar && html === hash) return;
      hash = html; cont.innerHTML = html;
      marcarEspera();
    }

    /* ---------------------------------------------------------------- eventos */
    cont.addEventListener("toggle", e => { const d = e.target.closest && e.target.closest("details[data-d]"); if (d) { if (d.open) abiertas.add(d.dataset.d); else abiertas.delete(d.dataset.d); } }, true);
    cont.addEventListener("change", e => {
      const t = e.target;
      if (t.dataset && t.dataset.mercorden) { mercOrden = t.value; mercMax = 12; pintar(true); return; }
      if (t.dataset && t.dataset.tactica) mandar({ tipo: "tactica", id: Number(t.dataset.tactica), tactica: t.value || null });
      if (t.dataset && t.dataset.semental) { semSel[t.dataset.semental] = Number(t.value); riesgoOk.delete(Number(t.dataset.semental)); pintar(true); return; }
      if (t.dataset && t.dataset.riesgo) { const id = Number(t.dataset.riesgo); if (t.checked) riesgoOk.add(id); else riesgoOk.delete(id); pintar(true); return; }
    });
    cont.addEventListener("input", e => {
      const t = e.target;
      if (t.dataset && t.dataset.montaprecio) montaTxt[t.dataset.montaprecio] = t.value;
    });
    cont.addEventListener("click", async e => {
      const v = e.target.closest("[data-vista]");
      if (v) { vista = v.dataset.vista; pintar(true); return; }
      if (e.target.closest("[data-mercmas]")) { mercMax += 12; pintar(true); return; }
      const b = e.target.closest("[data-o]"); if (!b || b.disabled) return;
      const id = Number(b.dataset.id), tipo = b.dataset.o;
      if (tipo === "adoptar") return mandar({ tipo, nombre: api.nombreJugador(), sexo: (cont.querySelector("#hipAdoptarSexo") || {}).value || "f" });
      if (tipo === "inscribir" || tipo === "desinscribir") return mandar({ tipo, id, n: Number(b.dataset.n) });
      if (tipo === "entrenar") return mandar({ tipo, id, stat: (cont.querySelector(`[data-stat="${id}"]`) || {}).value });
      if (tipo === "cuidar") return mandar({ tipo, id });
      if (tipo === "comprar") {
        const p = api.perfil(id);
        if (!(await dialogo.confirmar(`Comprar a ${p.nombre} por ${mon(p.precio)} tokens.`, { titulo: "Comprar", aceptar: "Comprar" }))) return;
        return mandar({ tipo, id });
      }
      if (tipo === "vender") {
        const e2 = api.mias().find(x => x.p.id === id);
        if (!(await dialogo.confirmar(`La casa te paga ${mon(e2.c.venta)} tokens por ${e2.p.nombre}. Se te devuelven las inscripciones que tenga puestas.`, { titulo: "Vender", aceptar: "Vender" }))) return;
        return mandar({ tipo, id });
      }
      if (tipo === "retirar") {
        const p = api.perfil(id);
        if (!(await dialogo.confirmar(`${p.nombre} deja de correr y pasa a la cría. Ya no podrás inscribirla. Podrás cruzarla si es hembra, o ponerla de semental si es macho.`, { titulo: "Retirar a la cría", aceptar: "Retirar" }))) return;
        return mandar({ tipo, id });
      }
      if (tipo === "nombre") {
        const nombre = await dialogo.pedir(`Un nombre nuevo para ${api.perfil(id).nombre}. Solo se puede cambiar una vez y cuesta ${mon(M.C.NOMBRE_COSTE)}.`, "", { titulo: "Bautizar", marcador: "Nombre", aceptar: "Cambiar" });
        if (nombre === null || !nombre.trim()) return;
        return mandar({ tipo, id, nombre: nombre.trim() });
      }
      if (tipo === "cruzar") {
        const padre = Number((cont.querySelector(`[data-semental="${id}"]`) || {}).value);
        if (!padre) return;
        const o = { tipo, madre: id, padre }; if (riesgoOk.has(id)) o.riesgo = true;
        return mandar(o, "Cruce hecho.");
      }
      if (tipo === "monta") {
        const reset = !!b.dataset.reset, valor = (cont.querySelector(`[data-montaprecio="${id}"]`) || {}).value;
        if (!reset && (valor == null || valor === "")) return mandar({ tipo, id, precio: null });
        delete montaTxt[id];
        return mandar(reset ? { tipo, id } : { tipo, id, precio: Number(valor) });
      }
    });
    pintar(true);
    return { pintar };
  }
  return { crear };
})();
