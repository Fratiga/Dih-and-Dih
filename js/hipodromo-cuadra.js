/* =============================================================================
   HIPÓDROMO: la pestaña «Mi cuadra». Lo que hace cada jugador con sus criaturas: adoptar la primera, comprar y vender,
   inscribir en las próximas carreras, entrenar, cuidar, marcar una táctica, bautizar, retirar a la cría y cruzar.
   No sabe de dónde salen los datos: la página le pasa un objeto `api` (modo local o con servidor) y esta pestaña
   solo pinta y manda órdenes. El motor es el que decide si una orden vale y cuánto cuesta (js/hipodromo-motor.js).
============================================================================= */
window.HipodromoCuadraUI = (function () {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const STATS = { vel: "Velocidad", res: "Resistencia", ace: "Arranque", agi: "Agilidad", tem: "Temple" };
  const TACTICAS = { "": "A su aire", frente: "Al frente", media: "A media tabla", atras: "Desde atrás" };
  const GRADO_CLASE = { gran: "oro", selecta: "plata", corriente: "", novatos: "" };

  function crear(api, cont) {
    const M = api.M, D = api.D;
    let msg = { texto: "", clase: "" }, ocupado = false, abiertas = new Set(), hash = "";
    const mon = x => api.monedas(x);
    const horaTxt = ms => new Date(ms).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

    async function mandar(o, textoOk) {
      if (ocupado) return;
      ocupado = true; msg = { texto: "Enviando...", clase: "" }; pintar(true);
      let r;
      try { r = await api.ordenar(o); } catch (e) { r = { ok: false, error: "No se pudo enviar la orden." }; }
      ocupado = false;
      msg = r.ok ? { texto: r.texto || textoOk || "Hecho.", clase: "bien" } : { texto: r.error || "No se pudo.", clase: "mal" };
      pintar(true);
    }

    /* ---------------------------------------------------------------- piezas */
    const barra = (v, max, clase) => `<span class="hip-barrita ${clase || ""}" title="${Math.round(v)}"><i style="width:${Math.max(0, Math.min(100, (v / max) * 100)).toFixed(0)}%"></i></span>`;
    function calendarioHtml(c, pub, cal) {
      const filas = cal.map(x => {
        const dentro = c.entradas.find(en => en.n === x.n);
        const pista = M.PISTAS[x.pista];
        const cierra = x.cierra ? horaTxt(x.cierra) : "";
        return `<tr><td>${x.n}</td><td>${horaTxt(x.hora)}</td><td><span class="hip-sello ${GRADO_CLASE[x.grado] || ""}">${esc(x.gradoNombre)}</span> ${esc(x.nombre)}</td><td>${x.dist} m</td><td>${esc(pista ? pista.nombre : x.pista)}${pista && pista.arcana ? ' <span class="hip-sello">arcana</span>' : ""}</td>
          <td>${mon(x.inscripcion)}</td><td>${x.plazas > 0 || dentro ? `<button type="button" class="hip-boton chico" data-o="${dentro ? "desinscribir" : "inscribir"}" data-id="${pub.id}" data-n="${x.n}">${dentro ? "Quitar" : "Inscribir"}</button>` : '<span class="hip-sin">completa</span>'}</td></tr>`;
      }).join("");
      return `<div class="hip-tabla-ancha"><table class="hip-tabla"><thead><tr><th>n.º</th><th>Hora</th><th>Carrera</th><th>Dist.</th><th>Pista</th><th>Cuesta</th><th></th></tr></thead><tbody>${filas}</tbody></table></div>
        <p class="hip-nota">Las inscripciones de cada carrera cierran cuando termina la anterior. Inscribir cuesta el 10 % de la bolsa y se devuelve si la carrera no se corre o la criatura no puede salir.</p>`;
    }
    function tarjetaMia(e, cal, semental) {
      const p = e.p, c = e.c, ficha = `<button type="button" class="hip-enlace" data-ficha="${p.id}">${esc(p.nombre)}</button>`;
      const sellos = [];
      if (p.lesion) sellos.push(`<span class="hip-sello rojo">${esc(p.lesion.tipo)}</span>`);
      if (c.entreno) sellos.push(`<span class="hip-sello">entrena ${esc(STATS[c.entreno.stat].toLowerCase())} hasta la n.º ${c.entreno.hasta}</span>`);
      if (p.estado === "criador") sellos.push('<span class="hip-sello">en la cría</span>');
      if (c.cruce && c.cruce.length) sellos.push(`<span class="hip-sello oro">espera cría de ${esc(c.cruce[0].padre)} (n.º ${c.cruce[0].n})</span>`);
      const cap = M.STATS.map(k => `<div class="hip-cap"><span>${STATS[k]}</span>${barra(c.capacidades[k], 100)}<b>${c.capacidades[k]}</b>${c.mejoras[k] ? `<small class="${c.mejoras[k] > 0 ? "sube" : "baja"}">${c.mejoras[k] > 0 ? "+" : ""}${(Math.round(c.mejoras[k] * 10) / 10)}</small>` : ""}</div>`).join("");
      const abierta = id => (abiertas.has(id) ? " open" : "");
      const corre = p.estado === "activo";
      let acciones = "";
      if (corre) {
        acciones += `<details data-d="ins${p.id}"${abierta("ins" + p.id)}><summary>Inscribir en carreras${c.entradas.length ? ` (${c.entradas.length})` : ""}</summary>${calendarioHtml(c, p, cal)}</details>`;
        acciones += `<details data-d="ent${p.id}"${abierta("ent" + p.id)}><summary>Entrenar</summary><p class="hip-nota">Una sesión dura ${M.C.ENTRENO_CARRERAS} carreras y mientras dura no corre. Mejora una capacidad un poco (más en las jóvenes, menos cuanto más entrenada) y puede lesionarla. Cuesta ${mon(M.C.ENTRENO_COSTE)}.</p>
          <select data-stat="${p.id}">${M.STATS.map(k => `<option value="${k}">${STATS[k]}</option>`).join("")}</select> <button type="button" class="hip-boton chico" data-o="entrenar" data-id="${p.id}"${c.entreno || p.lesion ? " disabled" : ""}>Entrenar</button></details>`;
      }
      let fila = `<div class="hip-fila-acc">`;
      if (corre || p.estado === "criador") fila += `<label>Táctica <select data-tactica="${p.id}">${Object.keys(TACTICAS).map(k => `<option value="${k}"${(c.tactica || "") === k ? " selected" : ""}>${TACTICAS[k]}</option>`).join("")}</select></label>`;
      fila += `<button type="button" class="hip-boton chico" data-o="cuidar" data-id="${p.id}"${c.puedeCuidar && (c.fatiga > 5 || p.lesion) ? "" : " disabled"} title="Quita 20 de cansancio y acorta una lesión">Cuidar (${M.C.CUIDADO_COSTE})</button>`;
      if (!c.renombrada) fila += `<button type="button" class="hip-boton chico" data-o="nombre" data-id="${p.id}">Bautizar (${M.C.NOMBRE_COSTE})</button>`;
      if (corre) fila += `<button type="button" class="hip-boton chico" data-o="retirar" data-id="${p.id}">Retirar a la cría</button>`;
      fila += `<button type="button" class="hip-boton chico" data-o="vender" data-id="${p.id}">Vender (${mon(c.venta)})</button></div>`;
      if (p.estado === "criador" && p.sexo === "f" && !(c.cruce && c.cruce.length)) {
        acciones += `<details data-d="cr${p.id}"${abierta("cr" + p.id)}><summary>Cruzar</summary><p class="hip-nota">Elige un semental en la cría. La cría nace en ${M.C.CRUCE_ESPERA} carreras y será tuya. Si el semental es de otra cuadra, la monta se paga a su dueño.</p>
          <select data-semental="${p.id}">${semental.map(s => `<option value="${s.id}">${esc(s.nombre)} · ${s.vic} victorias · ${mon(s.montaPrecio)}${s.dueno ? " · de " + esc(s.dueno.nombre || "otra cuadra") : ""}</option>`).join("") || '<option value="">No hay sementales</option>'}</select> <button type="button" class="hip-boton chico" data-o="cruzar" data-id="${p.id}"${semental.length ? "" : " disabled"}>Cruzar</button></details>`;
      }
      return `<article class="hip-mia"><div class="hip-mia-cab">${D.silueta(p, { clase: "hip-silueta mediana" })}<div><h4>${ficha}</h4>
        <p class="hip-nota">${p.sexo === "f" ? "Hembra" : "Macho"} · ${esc(p.etapa)} · ${api.edadTxt(p)} · ${p.salidas ? `${p.salidas} salidas · ${p.vic}-${p.seg}-${p.ter}` : "sin salidas"}</p>
        <p class="hip-sellos">${sellos.join("")}</p></div></div>
        <div class="hip-caps"><div class="hip-cap"><span>Cansancio</span>${barra(c.fatiga, 100, c.fatiga > 55 ? "mal" : "")}<b>${c.fatiga}</b></div><p class="hip-nota">Forma: ${esc(c.forma)}.</p>${cap}<p class="hip-nota">Tu entrenador estima las capacidades de cinco en cinco. La suerte del día no sale ahí.</p></div>
        ${fila}${acciones}</article>`;
    }
    function mercadoHtml() {
      const lista = api.mercado(), saldo = api.saldo();
      if (!lista.length) return '<p class="hip-vacio">No hay criaturas a la venta ahora mismo.</p>';
      const filas = lista.map(p => `<tr><td><div class="hip-celda-cria">${D.silueta(p, { clase: "hip-mini" })}<div><button type="button" class="hip-enlace" data-ficha="${p.id}">${esc(p.nombre)}</button><small>${p.sexo === "f" ? "Hembra" : "Macho"} · ${esc(p.etapa)} · ${api.edadTxt(p)}${p.arquetipo ? " · " + esc(p.arquetipo) : ""}</small></div></div></td>
        <td>${p.salidas ? `${p.salidas} · ${p.vic}-${p.seg}-${p.ter}` : "sin salidas"}</td><td>${api.estrellasTxt(p.estrellas)}</td><td class="hip-cuota"><strong>${mon(p.precio)}</strong></td>
        <td><button type="button" class="hip-boton chico" data-o="comprar" data-id="${p.id}"${p.precio > saldo ? " disabled" : ""}>Comprar</button></td></tr>`).join("");
      return `<div class="hip-tabla-ancha"><table class="hip-tabla"><thead><tr><th>Criatura</th><th>Palmarés</th><th>Valoración</th><th>Precio</th><th></th></tr></thead><tbody>${filas}</tbody></table></div>`;
    }

    /* ---------------------------------------------------------------- pintar */
    function pintar(forzar) {
      if (api.listo && !api.listo()) return;
      const mias = api.mias(), cal = api.calendario(), max = M.C.MAX_CABALLOS, adoptada = api.adoptada();
      const semental = api.sementales();
      const html = `<section class="hip-tarjeta"><div class="hip-cuadra-cab"><h3>Mi cuadra <small>${mias.length} de ${max}</small></h3><p>Monedas: <strong>${mon(api.saldo())}</strong></p></div>
        <p class="hip-nota">Aquí eres el dueño. Inscribes a tus criaturas en las carreras que quieras (los entrenadores del mundo no las mueven), las entrenas, las cuidas y, cuando se retiren, las cruzas. Cada carrera paga una bolsa a los cinco primeros y esa bolsa es tuya. Correr cuesta una inscripción y entrenar y cuidar también cuestan: no a todas les sale a cuenta.</p>
        <p class="hip-aviso ${msg.clase}" role="status" aria-live="polite">${esc(msg.texto)}</p>
        ${!adoptada && !mias.length ? `<div class="hip-adoptar"><h4>Recibe tu primera criatura</h4><p class="hip-nota">La casa te da una criatura joven, de cuerpo corriente, lista para debutar. Es gratis y solo se hace una vez.</p>
          <label>Sexo <select id="hipAdoptarSexo"><option value="f">Hembra</option><option value="m">Macho</option></select></label> <button type="button" class="hip-boton principal" data-o="adoptar">Adoptar</button></div>` : ""}
        <div class="hip-mias">${mias.map(e => tarjetaMia(e, cal, semental)).join("")}</div></section>
        <section class="hip-tarjeta"><h3>Mercado</h3><p class="hip-nota">Criaturas sin dueño que puedes comprar. El precio sale de su palmarés y su linaje, como lo ve todo el mundo. Si luego quieres venderla, la casa paga el ${Math.round(M.C.VENTA * 100)} % de lo que costaría ahora.</p>${mercadoHtml()}</section>
        <section class="hip-tarjeta"><h3>Avisos de la cuadra</h3>${api.avisos().length ? `<ul class="hip-avisos">${api.avisos().slice(0, 25).map(a => `<li><small>n.º ${a.n}</small> ${esc(a.texto)}</li>`).join("")}</ul>` : '<p class="hip-vacio">Todavía no hay avisos.</p>'}</section>`;
      if (!forzar && html === hash) return;
      hash = html; cont.innerHTML = html;
    }

    /* ---------------------------------------------------------------- eventos */
    cont.addEventListener("toggle", e => { const d = e.target.closest && e.target.closest("details[data-d]"); if (d) { if (d.open) abiertas.add(d.dataset.d); else abiertas.delete(d.dataset.d); } }, true);
    cont.addEventListener("change", e => {
      const t = e.target;
      if (t.dataset && t.dataset.tactica) mandar({ tipo: "tactica", id: Number(t.dataset.tactica), tactica: t.value || null });
    });
    cont.addEventListener("click", async e => {
      const b = e.target.closest("[data-o]"); if (!b || b.disabled) return;
      const id = Number(b.dataset.id), tipo = b.dataset.o;
      if (tipo === "adoptar") return mandar({ tipo, nombre: api.nombreJugador(), sexo: (cont.querySelector("#hipAdoptarSexo") || {}).value || "f" });
      if (tipo === "inscribir" || tipo === "desinscribir") return mandar({ tipo, id, n: Number(b.dataset.n) });
      if (tipo === "entrenar") return mandar({ tipo, id, stat: (cont.querySelector(`[data-stat="${id}"]`) || {}).value });
      if (tipo === "cuidar") return mandar({ tipo, id });
      if (tipo === "comprar") {
        const p = api.perfil(id);
        if (!(await dialogo.confirmar(`Comprar a ${p.nombre} por ${mon(p.precio)} monedas.`, { titulo: "Comprar", aceptar: "Comprar" }))) return;
        return mandar({ tipo, id });
      }
      if (tipo === "vender") {
        const e2 = api.mias().find(x => x.p.id === id);
        if (!(await dialogo.confirmar(`La casa te paga ${mon(e2.c.venta)} monedas por ${e2.p.nombre}. Se te devuelven las inscripciones que tenga puestas.`, { titulo: "Vender", aceptar: "Vender" }))) return;
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
        return mandar({ tipo, madre: id, padre });
      }
    });
    pintar(true);
    return { pintar };
  }
  return { crear };
})();
