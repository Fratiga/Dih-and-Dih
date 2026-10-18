/* =============================================================================
   HIPÓDROMO: la pestaña «Cartas». Los tokens de juego se cambian por cartas en los dos sentidos, y quien atiende es el Buhonero
   (su escena y su voz son las de Intercambios: js/puesto-buhonero.js):
   - Dárselas: le vendes una carta tuya, te la paga según su rareza y la copia vuelve a la reserva.
   - Lo que ofrece: cartas de la reserva (las copias que otros jugadores vendieron aquí): cuestan más de lo que él paga al comprar.
   Todo lo decide el servidor (docs/hipodromo-2_cartas.sql); esto solo enseña y manda la orden.
   Los nombres de las cartas salen del catálogo (js/cartas-datos.js y los datos del compendio, unos 1,3 MB), así que
   solo se cargan cuando se abre esta pestaña (y el Buhonero, que es pequeño, con ellos).
============================================================================= */
window.HipodromoCartas = (function () {
  "use strict";
  const SCRIPTS = ["data/personajes.js", "data/objetos.js", "data/lugares.js", "data/bestiario.js", "js/lado.js", "js/cartas-datos.js", "js/cartas-cliente.js"];
  const SCRIPTS_BUHONERO = ["js/dialogos-personajes.js", "js/puesto-buhonero.js"];
  const T = (clave, texto) => (window.HipodromoGlosario ? window.HipodromoGlosario.tip(clave, texto) : texto);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ORDEN = { comun: 1, infrecuente: 2, rara: 3, limitada: 4, legendaria: 5 };
  const nombreRareza = r => (window.CARTAS_RAREZAS && window.CARTAS_RAREZAS[r] ? window.CARTAS_RAREZAS[r].nombre : r);
  const nombreCarta = id => { const c = window.cartaPorId && window.cartaPorId(id); return c ? c.nombre : id; };
  const PB = () => window.PuestoBuhonero || null;

  function cargarScript(src, v) {
    return new Promise((ok, mal) => {
      const s = document.createElement("script");
      s.src = src + (v ? "?v=" + v : ""); s.onload = ok; s.onerror = () => mal(new Error("No se pudo cargar " + src));
      document.head.appendChild(s);
    });
  }

  function crear(api, cont) {
    let listo = false, cargando = false, mias = [], reserva = [], precios = {}, msg = { texto: "", clase: "" }, ocupado = false, ultimaFila = null, ultimoDicho = 0;
    const mon = x => api.monedas(x);
    const dice = clave => { const b = PB(); if (b) b.decir(clave); };

    async function prepararCatalogo() {
      const m = (document.querySelector('script[src*="hipodromo-cartas.js"]') || {}).src || "";
      const v = (/[?&]v=(d+)/.exec(m) || [])[1];
      // el Buhonero es solo escena y voz: si no carga, las tablas funcionan igual
      if (!window.PuestoBuhonero) { try { for (const s of SCRIPTS_BUHONERO) await cargarScript(s, v); } catch (e) { /* sin Buhonero */ } }
      if (window.CARTAS && window.cartaPorId) return;
      for (const s of SCRIPTS) await cargarScript(s, v);
      if (window.CartasCliente) await window.CartasCliente.cargarDefiniciones(false);
    }
    async function leer() {
      const [ej, re, pr] = await Promise.all([
        api.supa.from("cartas_ejemplares").select("id, carta_id, numero, estado").eq("propietario", api.yo),
        api.supa.rpc("hipodromo_cartas_reserva"),
        api.supa.from("hipodromo_precios_cartas").select("rareza, venta, compra")
      ]);
      if (ej.error) throw ej.error;
      if (re.error) throw re.error;
      mias = ej.data || []; reserva = re.data || [];
      precios = {}; (pr.data || []).forEach(p => { precios[p.rareza] = p; });
    }
    async function abrir() {
      if (cargando) return;
      if (!listo) {
        cargando = true; cont.innerHTML = '<p class="hip-vacio">El Buhonero está preparando su carreta...</p>';
        try { await prepararCatalogo(); await leer(); listo = true; }
        catch (e) { cont.innerHTML = `<p class="hip-vacio">No se pudieron cargar las cartas: ${esc(e.message || e)}. ¿Está aplicado docs/hipodromo-2_cartas.sql?</p>`; cargando = false; return; }
        cargando = false;
      }
      pintar();
      dice(mias.length === 0 ? "hipSinCartas" : reserva.length ? "hipSaludo" : "hipReservaVacia");
    }

    /* El marco (el Buhonero a un lado y las tablas al otro) se arma una sola vez: así la escena sigue viva mientras se repintan las tablas */
    function marco() {
      let cuerpo = cont.querySelector(".hip-cartas-cuerpo");
      if (cuerpo) return cuerpo;
      const b = PB();
      cont.innerHTML = `<div class="hip-cartas-marco${b ? "" : " sin-buhonero"}">${b ? '<aside class="hip-buho-lado" aria-label="El Buhonero"><div class="pb-escena"></div></aside>' : ""}<div class="hip-cartas-cuerpo"></div></div>`;
      if (b) b.montar(cont.querySelector(".pb-escena"), { velas: false });
      return cont.querySelector(".hip-cartas-cuerpo");
    }

    function pintar() {
      const catalogo = id => (window.cartaPorId && window.cartaPorId(id)) || { id, nombre: id, rareza: "comun" };
      const rarezaDe = id => catalogo(id).rareza;
      // mis copias agrupadas por carta
      const grupos = new Map();
      mias.forEach(e => { const g = grupos.get(e.carta_id) || { carta: e.carta_id, libres: [], bloqueadas: 0 }; if (e.estado === "poseida") g.libres.push(e); else g.bloqueadas++; grupos.set(e.carta_id, g); });
      const orden = (a, b) => (ORDEN[rarezaDe(b.carta)] || 0) - (ORDEN[rarezaDe(a.carta)] || 0) || nombreCarta(a.carta).localeCompare(nombreCarta(b.carta), "es");
      const filasVender = [...grupos.values()].sort(orden).map(g => {
        const r = rarezaDe(g.carta), p = precios[r], libres = g.libres.slice().sort((a, b) => b.numero - a.numero);
        return `<tr data-rareza="${esc(r)}"><td><b>${esc(nombreCarta(g.carta))}</b></td><td>${esc(nombreRareza(r))}</td><td>${libres.length}${g.bloqueadas ? ` <small>(+${g.bloqueadas} en uso)</small>` : ""}</td>
          <td class="hip-cuota"><strong>${p ? mon(p.venta) : "-"}</strong></td>
          <td>${p && libres.length ? `<button type="button" class="hip-boton chico" data-vender="${libres[0].id}" data-carta="${esc(g.carta)}">Vender una</button>` : '<span class="hip-sin">no se puede</span>'}</td></tr>`;
      }).join("");
      const saldo = api.saldo();
      const filasComprar = reserva.slice().sort((a, b) => (ORDEN[b.rareza] || 0) - (ORDEN[a.rareza] || 0) || nombreCarta(a.carta).localeCompare(nombreCarta(b.carta), "es")).map(c => {
        const lleno = c.tengo >= c.limite, falta = c.precio > saldo;
        return `<tr data-rareza="${esc(c.rareza)}"><td><b>${esc(nombreCarta(c.carta))}</b> <small>${esc(c.tipo || "")}</small></td><td>${esc(nombreRareza(c.rareza))}</td><td>${c.copias}</td><td>${c.tengo} de ${c.limite}</td>
          <td class="hip-cuota"><strong>${mon(c.precio)}</strong></td>
          <td${lleno ? ' data-dice="hipLleno"' : falta ? ' data-dice="hipSinTokens"' : ""}><button type="button" class="hip-boton chico" data-comprar="${esc(c.carta)}"${lleno || falta ? " disabled" : ""} title="${lleno ? "Ya tienes todas las que puedes tener" : falta ? "No te alcanzan los tokens" : ""}">Comprar</button></td></tr>`;
      }).join("");
      const tabla = Object.keys(precios).sort((a, b) => (ORDEN[a] || 0) - (ORDEN[b] || 0)).map(r => `<li><b>${esc(nombreRareza(r))}</b>: te paga ${mon(precios[r].venta)}, te cobra ${mon(precios[r].compra)}</li>`).join("");
      const html = `<section class="hip-tarjeta"><div class="hip-cuadra-cab"><h3>Cartas por tokens</h3><p>Tokens: <strong>${mon(saldo)}</strong></p></div>
        <p class="hip-nota">Aquí el Buhonero no cambia cartas por cartas como en el Mercado de los Faroles: paga y cobra en tokens. En el hipódromo empiezas sin tokens: se consiguen vendiéndole cartas, con los premios de tus criaturas y apostando. Lo que le vendes vuelve a la reserva de cartas, y lo único que te puede ofrecer es lo que hay en la reserva: comprar no crea cartas nuevas. Te cobra más de lo que paga.</p>
        <ul class="hip-avisos">${tabla}</ul>
        <p class="hip-aviso ${msg.clase}" role="status" aria-live="polite">${esc(msg.texto)}</p></section>
        <section class="hip-tarjeta"><h3>Dárselas al Buhonero</h3>${filasVender ? `<div class="hip-tabla-ancha"><table class="hip-tabla"><thead><tr><th>Carta</th><th>Rareza</th><th>Libres</th><th>Te paga</th><th></th></tr></thead><tbody>${filasVender}</tbody></table></div>` : '<p class="hip-vacio">No tienes cartas que enseñarle.</p>'}</section>
        <section class="hip-tarjeta"><h3>Lo que ofrece el Buhonero</h3>${filasComprar ? `<div class="hip-tabla-ancha"><table class="hip-tabla"><thead><tr><th>Carta</th><th>Rareza</th><th>${T("reserva", "En la reserva")}</th><th>Tienes</th><th>Cuesta</th><th></th></tr></thead><tbody>${filasComprar}</tbody></table></div>` : '<p class="hip-vacio">Su carreta está vacía ahora mismo. Se llena con las cartas que los jugadores le venden aquí.</p>'}</section>`;
      const cuerpo = marco();
      if (cuerpo._h !== html) { cuerpo.innerHTML = html; cuerpo._h = html; }
    }

    async function operar(rpc, args, textoOk, frase) {
      if (ocupado) return;
      ocupado = true; msg = { texto: "Enviando...", clase: "" }; pintar();
      let bien = false;
      try {
        const { data, error } = await api.supa.rpc(rpc, args);
        if (error) throw error;
        msg = { texto: textoOk(data), clase: "bien" }; bien = true;
        await Promise.all([leer(), api.refrescarCuenta()]);
      } catch (e) { if (!bien) { msg = { texto: e.message || String(e), clase: "mal" }; try { await leer(); } catch (x) { /* se queda lo que había */ } } }
      ocupado = false; pintar();
      dice(bien ? frase : "error");
    }

    // el Buhonero comenta lo que miras: la rareza de la carta de la fila o, sobre un «Comprar» apagado, por qué no puedes
    cont.addEventListener("mouseover", e => {
      const motivo = e.target.closest("[data-dice]"), fila = e.target.closest("tr[data-rareza]");
      const b = PB(), ahora = Date.now();
      if (!b) return;
      if (motivo) { if (ultimaFila !== motivo) { ultimaFila = motivo; ultimoDicho = ahora; b.decir(motivo.dataset.dice); } return; }
      if (!fila || fila === ultimaFila || ahora - ultimoDicho < 1500) return;
      ultimaFila = fila; ultimoDicho = ahora;
      b.decir(fila.dataset.rareza in b.FRASES ? fila.dataset.rareza : "comun");
    });
    cont.addEventListener("mouseleave", () => { ultimaFila = null; });

    cont.addEventListener("click", async e => {
      const v = e.target.closest("[data-vender]"), c = e.target.closest("[data-comprar]");
      if (v) {
        const carta = v.dataset.carta, r = (window.cartaPorId && window.cartaPorId(carta) || {}).rareza, p = precios[r];
        if (!(await dialogo.confirmar(`Le das una copia de ${nombreCarta(carta)} al Buhonero y te paga ${mon(p ? p.venta : 0)} tokens. Vuelve a la reserva y otro jugador podrá comprársela.`, { titulo: "Vender carta", aceptar: "Vender" }))) return;
        operar("hipodromo_vender_carta", { p_ejemplar: v.dataset.vender }, d => `Le vendiste ${nombreCarta(d.carta)} al Buhonero por ${mon(d.precio)} tokens.`, "hipRecibe");
      } else if (c) {
        const f = reserva.find(x => x.carta === c.dataset.comprar);
        if (!(await dialogo.confirmar(`El Buhonero te vende ${nombreCarta(c.dataset.comprar)} por ${mon(f ? f.precio : 0)} tokens.`, { titulo: "Comprar carta", aceptar: "Comprar" }))) return;
        operar("hipodromo_comprar_carta", { p_carta: c.dataset.comprar }, d => `Le compraste ${nombreCarta(d.carta)} (copia ${d.numero}) al Buhonero por ${mon(d.precio)} tokens.`, "hipOfrece");
      }
    });
    return { abrir, pintar: () => { if (listo) pintar(); } };
  }
  return { crear };
})();
