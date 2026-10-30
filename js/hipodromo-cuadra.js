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
  const GRADO_CLASE = { gran: "oro", selecta: "plata", corriente: "", novatos: "", copa_bronce: "copa", copa_plata: "copa", copa_oro: "copa", copa_leyendas: "copa" };

  function crear(api, cont, opcPleno) {
    const M = api.M, D = api.D;
    let msg = { texto: "", clase: "" }, ocupado = false, abiertas = new Set(), hash = "";
    // el criadero: la escena donde viven mis criaturas (js/hipodromo-criadero.js). Es una sola pieza viva que se recoloca tras cada dibujo; elegir una criatura enseña su ficha debajo
    // pleno: el criadero a pantalla completa (hipodromo.html?cuadra): la escena lo llena todo y lo demás flota encima (barra de arriba, panel lateral con la ficha, el mercado o los avisos)
    const pleno = !!(opcPleno && opcPleno.pleno);
    // lo que está haciendo la criatura elegida se escribe en su ficha (sin repintarla) y no sobre la escena
    setInterval(() => { const s = cont.querySelector("[data-ahora]"); if (s && escena) { const t = escena.actividad(Number(s.dataset.ahora)); if (s.textContent !== t) s.textContent = t; } }, 1000);
    let arbolId = null;   // el árbol genealógico abierto (pantalla completa): de qué criatura
    let selId = null, panel = !pleno || window.innerWidth >= 700;
    const escena = window.HipodromoCriadero && window.HipodromoVida ? window.HipodromoCriadero.crear(api, { alSeleccionar: id => { selId = id; vista = "mias"; if (pleno) panel = true; pintar(true); } }) : null;
    const mon = x => api.monedas(x);
    const horaTxt = ms => new Date(ms).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

    let vista = "mias", mercOrden = "precio", mercMax = 12, enCurso = null;
    const semSel = {}, montaTxt = {};   // el semental elegido en cada cruce y lo escrito en el precio de monta: sobreviven a repintar
    const TEXTO_ESPERA = { objeto: "Un momento...", entrenar: "Entrenando...", cuidar: "Cuidando...", inscribir: "Inscribiendo...", desinscribir: "Quitando...", comprar: "Comprando...", vender: "Vendiendo...", retirar: "Retirando...", nombre: "Bautizando...", cruzar: "Cruzando...", adoptar: "Adoptando...", monta: "Guardando..." };
    /* La orden que se está esperando pone su botón en «cargando» y los demás se apagan. Se llama después de cada dibujo, porque pintar() reescribe todo el HTML. */
    function marcarEspera() {
      if (!enCurso) return;
      const clave = `${enCurso.tipo}|${enCurso.id != null ? enCurso.id : enCurso.madre != null ? enCurso.madre : enCurso.objeto || ""}|${enCurso.n != null ? enCurso.n : ""}`;
      cont.querySelectorAll("[data-o]").forEach(b => {
        if (`${b.dataset.o}|${b.dataset.id || b.dataset.objeto || ""}|${b.dataset.n || ""}` === clave) window.HipEspera.poner(b, TEXTO_ESPERA[enCurso.tipo]);
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
      if (r.ok && o.tipo === "cuidar" && escena) escena.efecto(o.id, "cuidar");
      pintar(true);
    }

    /* ---------------------------------------------------------------- piezas */
    /* Mutaciones (✦ las grandes), manías y la marca de consanguínea, en fichas pequeñas con lo que hacen al pasar el cursor */
    const chips = p => {
      const mu = D.mutacionesDetalle(p).map(x => `<span class="hip-mut ${x.tipo}${x.grande ? " grande" : ""}" title="${esc(x.hace)}">${x.grande ? "✦ " : ""}${esc(x.texto)}</span>`);
      const ma = D.maniasDetalle(p).map(x => `<span class="hip-mania ${x.tipo}" title="${esc(x.hace)}">${esc(x.texto)}</span>`);
      return mu.concat(ma).join(" ") + (p.consanguinea ? ' <span class="hip-mut tara" title="Sus padres eran parientes cercanos">consanguínea</span>' : "");
    };
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
      if (c.entradas && c.entradas.length) sellos.push(`<a class="hip-sello" href="hipodromo.html#carrera" title="Ir a la carrera">inscrita en la n.º ${c.entradas.map(en => en.n).join(", ")}</a>`);
      const cap = M.STATS.map(k => `<div class="hip-cap"><span>${T("cap_" + k, STATS[k])}</span>${barra(c.capacidades[k], 100)}<b>${c.capacidades[k]}</b>${c.mejoras[k] ? `<small class="${c.mejoras[k] > 0 ? "sube" : "baja"}">${c.mejoras[k] > 0 ? "+" : ""}${(Math.round(c.mejoras[k] * 10) / 10)}</small>` : ""}</div>`).join("");
      const abierta = id => (abiertas.has(id) ? " open" : "");
      const corre = p.estado === "activo";
      let acciones = "";
      if (corre) {
        acciones += `<details data-d="ins${p.id}"${abierta("ins" + p.id)}><summary>${T("inscribir", "Inscribir en carreras")}${c.entradas.length ? ` (${c.entradas.length})` : ""}</summary>${calendarioHtml(c, p, cal)}</details>`;
        acciones += `<details data-d="ent${p.id}"${abierta("ent" + p.id)}><summary>${T("entrenar", "Entrenar")}</summary><p class="hip-nota">Una sesión dura ${M.C.ENTRENO_CARRERAS} carreras y mientras dura no corre. Mejora una capacidad un poco (más en las jóvenes, menos cuanto más entrenada) y puede lesionarla. Cuesta ${mon(c.costeEntrenar != null ? c.costeEntrenar : M.C.ENTRENO_COSTE)}.</p>
          <select data-stat="${p.id}">${M.STATS.map(k => `<option value="${k}">${STATS[k]}</option>`).join("")}</select> <button type="button" class="hip-boton chico" data-o="entrenar" data-id="${p.id}"${c.entreno || p.lesion ? " disabled" : ""}>Entrenar</button></details>`;
      }
      let fila = `<div class="hip-fila-acc">`;
      if (corre || p.estado === "criador") fila += `<label>${T("tactica", "Táctica")} <select data-tactica="${p.id}">${Object.keys(TACTICAS).map(k => `<option value="${k}"${(c.tactica || "") === k ? " selected" : ""}>${TACTICAS[k]}</option>`).join("")}</select></label>`;
      fila += `<button type="button" class="hip-boton chico" data-o="cuidar" data-id="${p.id}"${c.puedeCuidar && (c.fatiga > 5 || p.lesion) ? "" : " disabled"} title="Quita ${c.quitaFatiga || 20} de cansancio y acorta una lesión">Cuidar (${c.costeCuidar != null ? c.costeCuidar : M.C.CUIDADO_COSTE})</button>`;
      if (!c.renombrada) fila += `<button type="button" class="hip-boton chico" data-o="nombre" data-id="${p.id}">Bautizar (${M.C.NOMBRE_COSTE})</button>`;
      if (corre) fila += `<button type="button" class="hip-boton chico" data-o="retirar" data-id="${p.id}">Retirar a la cría</button>`;
      fila += `<button type="button" class="hip-boton chico" data-o="vender" data-id="${p.id}">Vender (${mon(c.venta)})</button></div>`;
      if (p.estado === "criador" && p.sexo === "f" && !(c.cruce && c.cruce.length)) {
        const sel = semSel[p.id] != null && semental.some(s => s.id === semSel[p.id]) ? semSel[p.id] : (semental[0] ? semental[0].id : null);
        const sp = sel != null ? api.perfil(sel) : null;
        const propio = sp && sp.dueno && api.mias().some(x => x.p.id === sp.id), coste = sp ? (propio && sp.montaBase != null ? sp.montaBase : sp.montaPrecio) : 0;
        acciones += `<details data-d="cr${p.id}"${abierta("cr" + p.id)}><summary>${T("cruzar", "Cruzar")}</summary><p class="hip-nota">Elige un semental en la cría. La cría nace en ${M.C.CRUCE_ESPERA} carreras (puede ser una camada) y será tuya. Si el semental es de otra cuadra, la monta se paga a su dueño; con uno tuyo se paga el precio de siempre a la casa. Necesitas sitio en la cuadra.</p>
          <select data-semental="${p.id}">${semental.map(s => `<option value="${s.id}"${s.id === sel ? " selected" : ""}>${esc(s.nombre)} · ${s.vic} victorias · ${mon(s.montaPrecio)}${s.dueno ? " · de " + esc(s.dueno.nombre || "otra cuadra") : ""}</option>`).join("") || '<option value="">No hay sementales</option>'}</select>
          <button type="button" class="hip-boton chico" data-o="cruzar" data-id="${p.id}"${sp ? "" : " disabled"}>Cruzar${sp ? ` (${mon(coste)})` : ""}</button></details>`;
      }
      if (p.estado === "criador" && p.sexo === "m") {
        const actual = montaTxt[p.id] != null ? montaTxt[p.id] : p.montaPrecio;
        acciones += `<details data-d="mo${p.id}"${abierta("mo" + p.id)}><summary>${T("monta", "Precio de monta")}</summary><p class="hip-nota">Lo que cobras a otros jugadores por montar a ${esc(p.nombre)}: de ${M.C.MONTA_MIN} a ${M.C.MONTA_MAX} tokens. Si no pones ninguno, sale de su palmarés (${mon(p.montaBase != null ? p.montaBase : p.montaPrecio)}). Con tus propias hembras se paga siempre ese precio de siempre, a la casa.</p>
          <input type="number" min="${M.C.MONTA_MIN}" max="${M.C.MONTA_MAX}" step="10" data-montaprecio="${p.id}" value="${esc(actual)}"> <button type="button" class="hip-boton chico" data-o="monta" data-id="${p.id}">Fijar precio</button>
          <button type="button" class="hip-boton chico" data-o="monta" data-id="${p.id}" data-reset="1"${p.montaCfg ? "" : " disabled"}>Volver al de siempre</button></details>`;
      }
      return `<article class="hip-mia"><div class="hip-mia-cab">${D.silueta(p, { clase: "hip-silueta mediana" })}<div><h4>${ficha}</h4>
        <p class="hip-nota">${p.sexo === "f" ? "Hembra" : "Macho"} · ${esc(p.etapa)} · ${api.edadTxt(p)} · ${p.salidas ? `${p.salidas} salidas · ${p.vic}-${p.seg}-${p.ter}` : "sin salidas"}</p>
        <p class="hip-sellos">${sellos.join("")}</p>${chips(p) ? `<p class="hip-chips">${chips(p)}</p>` : ""}${temperamentoHtml(p)}<p class="hip-nota">Ahora mismo: <span data-ahora="${p.id}"></span></p></div></div>
        <div class="hip-caps"><div class="hip-cap"><span>${T("cansancio", "Cansancio")}</span>${barra(c.fatiga, 100, c.fatiga > 55 ? "mal" : "")}<b>${c.fatiga}</b></div><p class="hip-nota">${T("forma", "Forma")}: ${esc(c.forma)}.</p>${cap}<p class="hip-nota">Tu entrenador estima las ${T("capacidades", "capacidades")} de cinco en cinco. La suerte del día no sale ahí.</p></div>
        ${fila}<p class="hip-cuidar-nota">Cuidar (${c.costeCuidar != null ? c.costeCuidar : M.C.CUIDADO_COSTE}): quita ${c.quitaFatiga || 20} de cansancio${p.lesion && p.lesion.gravedad !== "grave" ? ` y acorta la lesión un ${c.quitaLesion || 40} %` : ""}. Se puede cada ${M.C.CUIDADO_ESPERA} carreras.</p>${acciones}${familiaHtml(p)}${arbolHtml(p)}${carrerasHtml(p)}${historiaHtml(p)}</article>`;
    }
    /* El temperamento que se le nota en el criadero (js/hipodromo-criadero.js): solo presentación */
    function temperamentoHtml(p) {
      if (!window.HipodromoCriadero) return "";
      const t = window.HipodromoCriadero.temperamento(p).texto;
      return t.length ? `<p class="hip-nota">En el criadero se la ve ${t.join(", ")}.</p>` : "";
    }
    /* La familia de una criatura: padres, hermanos y crías. Si viven en mi criadero, el nombre la elige y la señala en la escena; si no, abre su ficha. */
    function familiaHtml(p) {
      const mias = api.mias().map(x => x.p), estan = id => mias.some(x => x.id === id);
      const enlace = (id, nombre) => estan(id) ? `<button type="button" class="hip-enlace" data-sel="${id}" title="Señalar en el criadero">${esc(nombre)}</button>` : `<button type="button" class="hip-enlace" data-ficha="${id}">${esc(nombre)}</button>`;
      const lineas = [];
      const padres = [p.padre, p.madre].filter(Boolean).map(x => enlace(x.id, x.nombre));
      if (padres.length) lineas.push(`<strong>Padres</strong> ${padres.join(" y ")}`);
      const hermanos = mias.filter(x => x.id !== p.id && ((x.padre && p.padre && x.padre.id === p.padre.id) || (x.madre && p.madre && x.madre.id === p.madre.id)));
      if (hermanos.length) lineas.push(`<strong>Hermanos</strong> ${hermanos.map(x => enlace(x.id, x.nombre)).join(", ")}`);
      const crias = mias.filter(x => (x.padre && x.padre.id === p.id) || (x.madre && x.madre.id === p.id));
      if (crias.length) lineas.push(`<strong>Crías</strong> ${crias.map(x => enlace(x.id, x.nombre)).join(", ")}`);
      return lineas.length ? `<p class="hip-familia">${lineas.join("<br>")}</p>` : "";
    }
    /* Lo que le ha pasado a esta criatura, de los avisos reales de la cuadra */
    function historiaHtml(p) {
      // la biografía (lo que de verdad le ha pasado, desde que existe) y, si la criatura es de antes de que se escribiera, los últimos avisos de la cuadra
      const bio = (p.bio || []).slice().reverse().slice(0, 8);
      if (bio.length) return `<h4 class="hip-sub">Su historia</h4><ul class="hip-historia">${bio.map(b => `<li><small>n.º ${b.n}</small>${esc(b.t)}</li>`).join("")}</ul>`;
      const l = api.avisos().filter(a => a.id === p.id).slice(0, 4);
      return l.length ? `<ul class="hip-historia">${l.map(a => `<li><small>n.º ${a.n}</small>${esc(a.texto)}</li>`).join("")}</ul>` : "";
    }
    /* Sus últimas carreras (de lo público: puesto, distancia y pista) */
    function carrerasHtml(p) {
      const l = (p.ultimas || []).slice(0, 8);
      if (!l.length) return "";
      const pistaDe = id => (M.PISTAS && M.PISTAS[id] ? M.PISTAS[id].nombre : id);
      return `<details data-d="car${p.id}"${abiertas.has("car" + p.id) ? " open" : ""}><summary>Últimas carreras (${l.length})</summary><table class="hip-carreras"><tbody>${l.map(h => `<tr><td>n.º ${h.n}</td><td><b>${h.pos}º</b> de ${h.campo}</td><td>${h.dist} m</td><td>${esc(pistaDe(h.pista))}</td></tr>`).join("")}</tbody></table></details>`;
    }
    /* El árbol genealógico, a la manera de un árbol de familia: el elegido abajo, sus padres, abuelos y bisabuelos arriba (los que se conocen), con una línea que baja de cada
       pareja a su cría (con un corazón donde se unen), y debajo sus descendientes. Cada uno lleva su retrato. Un antepasado que sale más de una vez (los padres eran parientes) se marca
       en rojo y se une con una línea discontinua. Pulsar a alguien centra el árbol en él. */
    function arbolVista(foco) {
      const NW = 98, NH = 128, G = 3, ANCHO = 108 * 8, FILA = 168, mias = new Set(api.mias().map(x => x.p.id));
      const nodos = [], lineas = [], vistos = new Map();
      const xDe = (g, i) => (g ? (i + 0.5) * (ANCHO / Math.pow(2, g)) : ANCHO / 2), yDe = g => (G - g) * FILA;
      const subir = (ref, g, i) => {
        const q = ref.id === foco.id ? foco : api.perfil(ref.id), n = { ref, q, g, x: xDe(g, i), y: yDe(g) }, idx = nodos.push(n) - 1;
        (vistos.get(ref.id) || vistos.set(ref.id, []).get(ref.id)).push(idx);
        if (g < G && q && (q.padre || q.madre)) {
          const pa = q.padre ? subir(q.padre, g + 1, 2 * i) : null, ma = q.madre ? subir(q.madre, g + 1, 2 * i + 1) : null;
          lineas.push({ hijo: idx, pa, ma });
        }
        return idx;
      };
      subir({ id: foco.id, nombre: foco.nombre }, 0, 0);
      const todas = api.todas ? api.todas() : [];
      const hijos = todas.filter(c => (c.padre && c.padre.id === foco.id) || (c.madre && c.madre.id === foco.id)).slice(0, 8);
      const filaH = yDe(0) + FILA, alto = (hijos.length ? filaH : yDe(0)) + NH + 12;
      const sexoSim = q => (q ? (q.sexo === "f" ? "♀" : "♂") : "");
      const rol = (g, q) => (g === 0 ? "" : ["", q && q.sexo === "f" ? "Madre" : q && q.sexo === "m" ? "Padre" : "Padre o madre", q && q.sexo === "f" ? "Abuela" : q && q.sexo === "m" ? "Abuelo" : "Abuelo/a", q && q.sexo === "f" ? "Bisabuela" : q && q.sexo === "m" ? "Bisabuelo" : "Bisabuelo/a"][g]);
      const fantasma = '<svg viewBox="0 0 100 70" class="hip-ar-sil" aria-hidden="true"><path d="M22 52 C20 34 34 24 50 26 C66 24 80 34 78 52 L72 52 L70 40 L62 40 L60 52 L40 52 L38 40 L30 40 L28 52 Z" fill="#1c3226" stroke="#46705a" stroke-width="2" stroke-dasharray="4 3"/></svg>';
      const tarjeta = (n, extra) => {
        const { ref, q } = n, rep = vistos.get(ref.id) && vistos.get(ref.id).length > 1, grande = q && (q.mut || []).some(id => window.HipodromoRasgos.MUT[id] && window.HipodromoRasgos.MUT[id].g);
        const clases = ["hip-ar-n", q ? (q.sexo === "f" ? "hembra" : "macho") : "", mias.has(ref.id) ? "mia" : "", rep ? "rep" : "", n.g === 0 ? "foco" : ""].filter(Boolean).join(" ");
        const fig = q ? D.silueta(q, { clase: "hip-ar-sil", titulo: ref.nombre }) : fantasma;
        const cuerpo = `<span class="hip-ar-fig">${fig}</span><b>${esc(ref.nombre || (q && q.nombre) || "?")}</b><small>${[rol(n.g, q) || (n.g === 0 ? "Elegida" : ""), sexoSim(q), q ? (q.gen ? "gen. " + q.gen : "") : "no se conoce", grande ? "✦" : ""].filter(Boolean).join(" · ")}</small>${extra || ""}`;
        const boton = q && n.g !== 0 ? `<button type="button" class="hip-ar-b" data-arbol-ir="${ref.id}" title="Centrar el árbol aquí">${cuerpo}</button>` : `<div class="hip-ar-b">${cuerpo}</div>`;
        return `<div class="${clases}" style="left:${(n.x - NW / 2).toFixed(0)}px;top:${n.y}px;width:${NW}px">${boton}${q ? `<button type="button" class="hip-ar-ficha" data-ficha="${ref.id}" title="Abrir su ficha">ficha</button>` : ""}${rep ? `<i class="hip-ar-rep">×${vistos.get(ref.id).length}</i>` : ""}</div>`;
      };
      let svg = "";
      const corazon = (x, y) => `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)})"><circle r="9" fill="#2a1a22" stroke="#c9566e" stroke-width="1.6"/><path d="M0 4 C-7 -1 -5 -6 0 -3 C5 -6 7 -1 0 4 Z" fill="#e8708a"/></g>`;
      lineas.forEach(l => {
        const h = nodos[l.hijo], A = l.pa != null ? nodos[l.pa] : null, B = l.ma != null ? nodos[l.ma] : null, yBar = h.y - 30, base = (A || B).y + NH;
        if (A && B) { svg += `<path d="M${A.x} ${base} V${yBar} H${B.x} V${base} M${h.x} ${yBar} V${h.y}" fill="none" stroke="#6f9b82" stroke-width="2"/>` + corazon(h.x, yBar); }
        else { const P = A || B; svg += `<path d="M${P.x} ${base} V${yBar} H${h.x} V${h.y}" fill="none" stroke="#6f9b82" stroke-width="2"/>`; }
      });
      vistos.forEach(l => { for (let k = 1; k < l.length; k++) { const a = nodos[l[0]], b = nodos[l[k]], ya = a.y + NH / 2, yb = b.y + NH / 2, dx = a.x < b.x ? 70 : -70; svg += `<path d="M${a.x + (a.x < b.x ? NW / 2 : -NW / 2)} ${ya} C${a.x + dx} ${ya}, ${b.x - dx} ${yb}, ${b.x + (a.x < b.x ? -NW / 2 : NW / 2)} ${yb}" fill="none" stroke="#d0634a" stroke-width="2" stroke-dasharray="6 5"/>`; } });
      let hijosHtml = "";
      hijos.forEach((c, k) => {
        const x = (k + 0.5) * (ANCHO / hijos.length), yBar = filaH - 30, otro = c.padre && c.padre.id === foco.id ? c.madre : c.padre;
        svg += `<path d="M${ANCHO / 2} ${yDe(0) + NH} V${yBar} H${x.toFixed(0)} V${filaH}" fill="none" stroke="#6f9b82" stroke-width="2"/>` + corazon(x, yBar);
        hijosHtml += tarjeta({ ref: { id: c.id, nombre: c.nombre }, q: c, g: -1, x, y: filaH }, otro ? `<small class="hip-ar-con">con ${esc(otro.nombre)}</small>` : "");
      });
      return `<div class="hip-ar" style="width:${ANCHO}px;height:${alto}px"><svg class="hip-ar-lineas" width="${ANCHO}" height="${alto}" viewBox="0 0 ${ANCHO} ${alto}" aria-hidden="true">${svg}</svg>${nodos.map(n => tarjeta(n)).join("")}${hijosHtml}</div>`;
    }
    function arbolHtml(p) {
      if (!p.padre && !p.madre && !(api.todas && api.todas().some(c => (c.padre && c.padre.id === p.id) || (c.madre && c.madre.id === p.id)))) return `<p class="hip-nota">Árbol genealógico: aún sin familia conocida. Saldrá cuando tenga padres o crías.</p>`;
      if (pleno) return `<p><button type="button" class="hip-boton chico" data-arbol="${p.id}">Árbol genealógico</button></p>`;
      return `<details data-d="arb${p.id}"${abiertas.has("arb" + p.id) ? " open" : ""}><summary>Árbol genealógico</summary><div class="hip-ar-caja">${arbolVista(p)}</div></details>`;
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
    /* La tienda del criadero: zonas, juguetes y elementos naturales que se compran con tokens y aparecen en la escena (el motor decide lo que son y cuestan). Quitarlos devuelve la mitad. */
    function tiendaHtml() {
      const cat = M.OBJETOS_CRIADERO || {}, tengo = new Set(api.objetos ? api.objetos() : []), saldo = api.saldo();
      const grupos = [["zona", "Zonas"], ["juguete", "Juguetes"], ["natural", "Elementos naturales"]];
      const fila = id => {
        const o = cat[id], tiene = tengo.has(id), icono = window.HipodromoCriadero ? window.HipodromoCriadero.icono(id) : "";
        return `<li class="${tiene ? "tengo" : ""}"><div class="hip-tienda-dib" aria-hidden="true">${icono}</div><div><strong>${esc(o.nombre)}</strong><small>${esc(o.texto)}</small>${o.ben ? `<span class="hip-tienda-ben">${esc(o.ben)}</span>` : `<span class="hip-tienda-ben deco">solo decoración</span>`}</div>
          <div class="hip-tienda-der"><b>${mon(o.precio)}</b>${tiene ? `<button type="button" class="hip-boton chico" data-o="objeto" data-objeto="${id}" data-quitar="1">Quitar (+${mon(Math.round(o.precio * 0.5))})</button>`
            : `<button type="button" class="hip-boton chico" data-o="objeto" data-objeto="${id}"${o.precio > saldo ? " disabled" : ""}>Comprar</button>`}</div></li>`;
      };
      return `<h3>Objetos del criadero</h3><p class="hip-nota">Aparecen en la escena y las criaturas los usan. No cambian las carreras. Algunos abaratan un poco el cuidado o el entrenamiento. Los de siempre (comedero, bebedero, refugio, cama de heno, poste y pelota) ya los tienes.</p>
        ${grupos.map(([g, t]) => `<p class="hip-tienda-grupo">${t}</p><ul class="hip-tienda">${Object.keys(cat).filter(id => cat[id].grupo === g).map(fila).join("")}</ul>`).join("")}`;
    }
    function arbolPanelHtml() {
      const fp = api.perfil(arbolId);
      if (!fp) return "";
      return `<section class="hcp-arbol${panel ? " con-panel" : ""}" aria-label="Árbol genealógico"><header><h3>Árbol de ${esc(fp.nombre)}</h3><p class="hip-nota">Pulsa a alguien para centrar el árbol en él. ♥ une a la pareja; en rojo, un antepasado que se repite (los padres eran parientes).</p><button type="button" class="hcp-arbol-cierra" data-arbol-cierra aria-label="Cerrar el árbol">×</button></header><div class="hcp-arbol-cuerpo">${arbolVista(fp)}</div></section>`;
    }
    /* ---- la pantalla completa: la escena detrás de todo y, encima, la barra con los enlaces de la cuadra y un panel lateral */
    function pintarPleno(forzar) {
      if (api.listo && !api.listo()) return;
      const mias = api.mias(), cal = api.calendario(), max = M.C.MAX_CABALLOS, adoptada = api.adoptada(), semental = api.sementales();
      if (selId == null && escena && escena.seleccionGuardada() != null) selId = escena.seleccionGuardada();
      if (!mias.some(e => e.p.id === selId)) selId = mias[0] ? mias[0].p.id : null;
      const elegida = mias.find(e => e.p.id === selId), nAvisos = api.avisos().length, merc = api.mercado().length;
      let lateral;
      if (vista === "mercado") lateral = `<h3>Mercado</h3><p class="hip-nota">Criaturas sin dueño que puedes comprar (las mejores del mundo no se venden: a esas hay que criarlas y entrenarlas). El precio sale de su palmarés y su linaje. Si luego quieres venderla, la casa paga el ${Math.round(M.C.VENTA * 100)} % de lo que costaría ahora.</p>${mercadoHtml()}`;
      else if (vista === "objetos") lateral = tiendaHtml();
      else if (vista === "avisos") lateral = `<h3>Avisos de la cuadra</h3>${nAvisos ? `<ul class="hip-avisos">${api.avisos().slice(0, 40).map(a => `<li><small>n.º ${a.n}</small> ${esc(a.texto)}</li>`).join("")}</ul>` : '<p class="hip-vacio">Todavía no hay avisos.</p>'}`;
      else lateral = `${!adoptada && !mias.length ? `<div class="hip-adoptar"><h4>Recibe tu primera criatura</h4><p class="hip-nota">La casa te da una criatura joven, de cuerpo corriente, lista para debutar. Es gratis y solo se hace una vez.</p>
          <label>Sexo <select id="hipAdoptarSexo"><option value="f">Hembra</option><option value="m">Macho</option></select></label> <button type="button" class="hip-boton principal" data-o="adoptar">Adoptar</button></div>` : ""}
        ${mias.length > 1 ? `<div class="hip-criadero-tira">${mias.map(e => `<button type="button" data-sel="${e.p.id}" aria-pressed="${e.p.id === selId}">${esc(e.p.nombre)}<small>${esc(e.p.etapa)}</small></button>`).join("")}</div>` : ""}
        <div class="hip-mias">${elegida ? tarjetaMia(elegida, cal, semental) : ""}</div>`;
      const boton = (v, t, n) => `<button type="button" data-vista="${v}" aria-pressed="${vista === v}">${t}${n != null ? ` <small>${n}</small>` : ""}</button>`;
      const modo = (document.querySelector(".hip-modo") || {}).textContent || "", pl = /[?&]local\b/.test(location.search) ? "?local" : "";
      const html = `<div class="hcp-escena-hueco"></div>
        <header class="hcp-barra"><a class="hcp-volver" href="hipodromo.html${pl}">← Hipódromo</a><h2>${T("cuadra", "Mi cuadra")}</h2><span class="hcp-tokens">Tokens <strong>${mon(api.saldo())}</strong></span>
          <nav class="hcp-enlaces" aria-label="Tu cuadra">${boton("mias", "Criaturas", mias.length + "/" + max)}${boton("mercado", "Mercado", merc)}${boton("objetos", "Objetos")}${boton("avisos", "Avisos", nAvisos)}
            <a href="hipodromo.html${pl}#carrera">Próxima carrera</a><a href="hipodromo.html${pl}#cartas" title="Vende cartas para tener tokens">Cartas por tokens</a><a href="hipodromo.html${pl}#criaturas">Criaturas del mundo</a><a href="hipodromo-vivo.html">▶ Ver en vivo</a></nav></header>
        ${arbolId != null ? arbolPanelHtml() : ""}
        <aside class="hcp-lateral${panel ? "" : " cerrado"}" aria-label="Panel de la cuadra"><div class="hcp-lateral-cuerpo">${lateral}</div></aside>
        <button type="button" class="hcp-pestana${panel ? " abierto" : ""}" data-panel aria-expanded="${panel}" aria-label="${panel ? "Esconder el panel" : "Enseñar el panel"}">${panel ? "▸" : "◂ Ficha"}</button>
        <p class="hip-aviso hcp-aviso ${msg.clase}" role="status" aria-live="polite">${esc(msg.texto)}</p>${/local/i.test(modo) ? '<span class="hcp-modo">Prueba local</span>' : ""}`;
      if (!forzar && html === hash) return;
      hash = html;
      const arAntes = cont.querySelector(".hcp-arbol-cuerpo"), arTop = arAntes ? arAntes.scrollTop : 0, arIzq = arAntes ? arAntes.scrollLeft : 0, arId = arAntes ? arAntes.dataset.id : null;
      const antes = cont.querySelector(".hcp-lateral-cuerpo"), top = antes ? antes.scrollTop : 0, mismaVista = antes && antes.dataset.v === vista + ":" + selId;
      cont.innerHTML = html;
      const arNuevo = cont.querySelector(".hcp-arbol-cuerpo"); if (arNuevo) { arNuevo.dataset.id = String(arbolId); if (arId === String(arbolId)) { arNuevo.scrollTop = arTop; arNuevo.scrollLeft = arIzq; } else arNuevo.scrollLeft = Math.max(0, (arNuevo.scrollWidth - arNuevo.clientWidth) / 2); }
      const cuerpo = cont.querySelector(".hcp-lateral-cuerpo"); if (cuerpo) { cuerpo.dataset.v = vista + ":" + selId; if (mismaVista) cuerpo.scrollTop = top; }
      if (escena) { cont.querySelector(".hcp-escena-hueco").appendChild(escena.nodo); escena.setObjetos(api.objetos ? api.objetos() : []); escena.sincronizar(mias); escena.seleccionar(selId, false); escena.activar(true); }
      marcarEspera();
    }
    function pintar(forzar) {
      if (pleno) { pintarPleno(forzar); return; }
      if (api.listo && !api.listo()) return;
      const mias = api.mias(), cal = api.calendario(), max = M.C.MAX_CABALLOS, adoptada = api.adoptada();
      const semental = api.sementales();
      if (!mias.some(e => e.p.id === selId)) selId = mias[0] ? mias[0].p.id : null;
      const elegida = mias.find(e => e.p.id === selId);
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
        ${mias.length > 1 ? `<div class="hip-criadero-tira">${mias.map(e => `<button type="button" data-sel="${e.p.id}" aria-pressed="${e.p.id === selId}">${esc(e.p.nombre)}<small>${esc(e.p.etapa)}</small></button>`).join("")}</div>` : ""}
        <div class="hip-mias">${elegida ? tarjetaMia(elegida, cal, semental) : ""}</div></section>`;
      const html = `${cabecera}${subpestanas}${vista === "mias" && escena ? '<div class="hip-esc-hueco"></div>' : ""}${cuerpo}`;
      if (!forzar && html === hash) return;
      hash = html; cont.innerHTML = html;
      if (escena) {
        const hueco = cont.querySelector(".hip-esc-hueco");
        if (hueco) { hueco.appendChild(escena.nodo); escena.sincronizar(mias); escena.seleccionar(selId, false); escena.activar(true); } else escena.activar(false);
      }
      marcarEspera();
    }

    /* ---------------------------------------------------------------- eventos */
    document.addEventListener("keydown", e => { if (e.key === "Escape" && arbolId != null && !document.querySelector("dialog[open], .hip-ficha:not(.hidden)")) { arbolId = null; pintar(true); } });
    cont.addEventListener("toggle", e => { const d = e.target.closest && e.target.closest("details[data-d]"); if (d) { if (d.open) abiertas.add(d.dataset.d); else abiertas.delete(d.dataset.d); } }, true);
    cont.addEventListener("change", e => {
      const t = e.target;
      if (t.dataset && t.dataset.mercorden) { mercOrden = t.value; mercMax = 12; pintar(true); return; }
      if (t.dataset && t.dataset.tactica) mandar({ tipo: "tactica", id: Number(t.dataset.tactica), tactica: t.value || null });
      if (t.dataset && t.dataset.semental) { semSel[t.dataset.semental] = Number(t.value); pintar(true); return; }
    });
    cont.addEventListener("input", e => {
      const t = e.target;
      if (t.dataset && t.dataset.montaprecio) montaTxt[t.dataset.montaprecio] = t.value;
    });
    cont.addEventListener("click", async e => {
      if (e.target.closest("[data-panel]")) { panel = !panel; pintar(true); return; }
      const ab = e.target.closest("[data-arbol]"); if (ab) { arbolId = Number(ab.dataset.arbol); pintar(true); return; }
      const ir = e.target.closest("[data-arbol-ir]"); if (ir) { arbolId = Number(ir.dataset.arbolIr); pintar(true); return; }
      if (e.target.closest("[data-arbol-cierra]")) { arbolId = null; pintar(true); return; }
      const v = e.target.closest("[data-vista]");
      if (v) { vista = v.dataset.vista; pintar(true); return; }
      if (e.target.closest("[data-mercmas]")) { mercMax += 12; pintar(true); return; }
      const sl = e.target.closest("[data-sel]");
      if (sl) { const id = Number(sl.dataset.sel); selId = id; vista = "mias"; if (pleno) panel = true; if (escena) { escena.seleccionar(id, false); escena.destacar(id); } pintar(true); return; }
      const b = e.target.closest("[data-o]"); if (!b || b.disabled) return;
      const id = Number(b.dataset.id), tipo = b.dataset.o;
      if (tipo === "adoptar") return mandar({ tipo, nombre: api.nombreJugador(), sexo: (cont.querySelector("#hipAdoptarSexo") || {}).value || "f" });
      if (tipo === "inscribir" || tipo === "desinscribir") return mandar({ tipo, id, n: Number(b.dataset.n) });
      if (tipo === "entrenar") return mandar({ tipo, id, stat: (cont.querySelector(`[data-stat="${id}"]`) || {}).value });
      if (tipo === "cuidar") {
        const e2 = api.mias().find(x => x.p.id === id);
        const efecto = e2 ? `Quita ${e2.c.quitaFatiga || 20} de cansancio (ahora ${e2.c.fatiga})${e2.p.lesion && e2.p.lesion.gravedad !== "grave" ? ` y acorta su lesión un ${e2.c.quitaLesion || 40} %` : ""}.` : "";
        if (!(await dialogo.confirmar(`Cuidados veterinarios${e2 ? " para " + e2.p.nombre : ""}. ${efecto} Cuestan ${mon(e2 && e2.c.costeCuidar != null ? e2.c.costeCuidar : M.C.CUIDADO_COSTE)} tokens.`, { titulo: "Cuidar", aceptar: "Cuidar" }))) return;
        return mandar({ tipo, id });
      }
      if (tipo === "comprar") {
        const p = api.perfil(id);
        if (!(await dialogo.confirmar(`Comprar a ${p.nombre} por ${mon(p.precio)} tokens.`, { titulo: "Comprar", aceptar: "Comprar" }))) return;
        return mandar({ tipo, id });
      }
      if (tipo === "objeto") {
        const id = b.dataset.objeto, o = (M.OBJETOS_CRIADERO || {})[id]; if (!o) return;
        const quitar = !!b.dataset.quitar;
        if (!(await dialogo.confirmar(quitar ? `Quitas ${o.nombre.toLowerCase()} del criadero y la casa te devuelve ${mon(Math.round(o.precio * 0.5))} tokens.` : `${o.nombre} cuesta ${mon(o.precio)} tokens. ${o.texto}${o.ben ? " Beneficio: " + o.ben + "." : ""}`, { titulo: quitar ? "Quitar del criadero" : "Comprar para el criadero", aceptar: quitar ? "Quitar" : "Comprar" }))) return;
        return mandar(quitar ? { tipo, objeto: id, quitar: true } : { tipo, objeto: id });
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
        return mandar({ tipo, madre: id, padre }, "Cruce hecho.");
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
