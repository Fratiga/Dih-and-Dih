/* =============================================================================
   HIPÓDROMO: la pestaña «Cartas». Las monedas del hipódromo se cambian por cartas en los dos sentidos:
   - Vender una carta tuya: la casa te la paga según su rareza y la copia vuelve a la reserva.
   - Comprar una carta de la reserva (las copias que otros jugadores vendieron aquí): cuesta más de lo que se paga al vender.
   Todo lo decide el servidor (docs/hipodromo-2_cartas.sql); esto solo enseña y manda la orden.
   Los nombres de las cartas salen del catálogo (js/cartas-datos.js y los datos del compendio, unos 1,3 MB), así que
   solo se cargan cuando se abre esta pestaña.
============================================================================= */
window.HipodromoCartas = (function () {
  "use strict";
  const SCRIPTS = ["data/personajes.js", "data/objetos.js", "data/lugares.js", "data/bestiario.js", "js/lado.js", "js/cartas-datos.js", "js/cartas-cliente.js"];
  const T = (clave, texto) => (window.HipodromoGlosario ? window.HipodromoGlosario.tip(clave, texto) : texto);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ORDEN = { comun: 1, infrecuente: 2, rara: 3, limitada: 4, legendaria: 5 };
  const nombreRareza = r => (window.CARTAS_RAREZAS && window.CARTAS_RAREZAS[r] ? window.CARTAS_RAREZAS[r].nombre : r);
  const nombreCarta = id => { const c = window.cartaPorId && window.cartaPorId(id); return c ? c.nombre : id; };

  function cargarScript(src, v) {
    return new Promise((ok, mal) => {
      const s = document.createElement("script");
      s.src = src + (v ? "?v=" + v : ""); s.onload = ok; s.onerror = () => mal(new Error("No se pudo cargar " + src));
      document.head.appendChild(s);
    });
  }

  function crear(api, cont) {
    let listo = false, cargando = false, mias = [], reserva = [], precios = {}, msg = { texto: "", clase: "" }, ocupado = false;
    const mon = x => api.monedas(x);

    async function prepararCatalogo() {
      if (window.CARTAS && window.cartaPorId) return;
      const m = (document.querySelector('script[src*="hipodromo-cartas.js"]') || {}).src || "";
      const v = (/[?&]v=(\d+)/.exec(m) || [])[1];
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
        cargando = true; cont.innerHTML = '<p class="hip-vacio">Cargando el catálogo de cartas...</p>';
        try { await prepararCatalogo(); await leer(); listo = true; }
        catch (e) { cont.innerHTML = `<p class="hip-vacio">No se pudieron cargar las cartas: ${esc(e.message || e)}. ¿Está aplicado docs/hipodromo-2_cartas.sql?</p>`; cargando = false; return; }
        cargando = false;
      }
      pintar();
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
        return `<tr><td><b>${esc(nombreCarta(g.carta))}</b></td><td>${esc(nombreRareza(r))}</td><td>${libres.length}${g.bloqueadas ? ` <small>(+${g.bloqueadas} en uso)</small>` : ""}</td>
          <td class="hip-cuota"><strong>${p ? mon(p.venta) : "-"}</strong></td>
          <td>${p && libres.length ? `<button type="button" class="hip-boton chico" data-vender="${libres[0].id}" data-carta="${esc(g.carta)}">Vender una</button>` : '<span class="hip-sin">no se puede</span>'}</td></tr>`;
      }).join("");
      const saldo = api.saldo();
      const filasComprar = reserva.slice().sort((a, b) => (ORDEN[b.rareza] || 0) - (ORDEN[a.rareza] || 0) || nombreCarta(a.carta).localeCompare(nombreCarta(b.carta), "es")).map(c => {
        const lleno = c.tengo >= c.limite, falta = c.precio > saldo;
        return `<tr><td><b>${esc(nombreCarta(c.carta))}</b> <small>${esc(c.tipo || "")}</small></td><td>${esc(nombreRareza(c.rareza))}</td><td>${c.copias}</td><td>${c.tengo} de ${c.limite}</td>
          <td class="hip-cuota"><strong>${mon(c.precio)}</strong></td>
          <td><button type="button" class="hip-boton chico" data-comprar="${esc(c.carta)}"${lleno || falta ? " disabled" : ""} title="${lleno ? "Ya tienes todas las que puedes tener" : falta ? "No te alcanzan las monedas" : ""}">Comprar</button></td></tr>`;
      }).join("");
      const tabla = Object.keys(precios).sort((a, b) => (ORDEN[a] || 0) - (ORDEN[b] || 0)).map(r => `<li><b>${esc(nombreRareza(r))}</b>: te pagan ${mon(precios[r].venta)}, cuesta ${mon(precios[r].compra)}</li>`).join("");
      cont.innerHTML = `<section class="hip-tarjeta"><div class="hip-cuadra-cab"><h3>Cartas por monedas</h3><p>Monedas: <strong>${mon(saldo)}</strong></p></div>
        <p class="hip-nota">En el hipódromo empiezas sin monedas: se consiguen vendiendo cartas, con los premios de tus criaturas y apostando. Lo que vendes vuelve a la reserva de cartas, y lo único que se puede comprar es lo que hay en la reserva: comprar no crea cartas nuevas. Comprar cuesta más de lo que se paga al vender.</p>
        <ul class="hip-avisos">${tabla}</ul>
        <p class="hip-aviso ${msg.clase}" role="status" aria-live="polite">${esc(msg.texto)}</p></section>
        <section class="hip-tarjeta"><h3>Vender mis cartas</h3>${filasVender ? `<div class="hip-tabla-ancha"><table class="hip-tabla"><thead><tr><th>Carta</th><th>Rareza</th><th>Libres</th><th>Te pagan</th><th></th></tr></thead><tbody>${filasVender}</tbody></table></div>` : '<p class="hip-vacio">No tienes cartas.</p>'}</section>
        <section class="hip-tarjeta"><h3>Comprar de la reserva</h3>${filasComprar ? `<div class="hip-tabla-ancha"><table class="hip-tabla"><thead><tr><th>Carta</th><th>Rareza</th><th>${T("reserva", "En la reserva")}</th><th>Tienes</th><th>Cuesta</th><th></th></tr></thead><tbody>${filasComprar}</tbody></table></div>` : '<p class="hip-vacio">La reserva está vacía ahora mismo. Se llena con las cartas que los jugadores venden aquí.</p>'}</section>`;
    }

    async function operar(rpc, args, textoOk) {
      if (ocupado) return;
      ocupado = true; msg = { texto: "Enviando...", clase: "" }; pintar();
      try {
        const { data, error } = await api.supa.rpc(rpc, args);
        if (error) throw error;
        msg = { texto: textoOk(data), clase: "bien" };
        await Promise.all([leer(), api.refrescarCuenta()]);
      } catch (e) { msg = { texto: e.message || String(e), clase: "mal" }; try { await leer(); } catch (x) { /* se queda lo que había */ } }
      ocupado = false; pintar();
    }

    cont.addEventListener("click", async e => {
      const v = e.target.closest("[data-vender]"), c = e.target.closest("[data-comprar]");
      if (v) {
        const carta = v.dataset.carta, r = (window.cartaPorId && window.cartaPorId(carta) || {}).rareza, p = precios[r];
        if (!(await dialogo.confirmar(`Vendes una copia de ${nombreCarta(carta)} por ${mon(p ? p.venta : 0)} monedas. Vuelve a la reserva y otro jugador podrá comprarla.`, { titulo: "Vender carta", aceptar: "Vender" }))) return;
        operar("hipodromo_vender_carta", { p_ejemplar: v.dataset.vender }, d => `Vendiste ${nombreCarta(d.carta)} por ${mon(d.precio)} monedas.`);
      } else if (c) {
        const f = reserva.find(x => x.carta === c.dataset.comprar);
        if (!(await dialogo.confirmar(`Compras ${nombreCarta(c.dataset.comprar)} por ${mon(f ? f.precio : 0)} monedas.`, { titulo: "Comprar carta", aceptar: "Comprar" }))) return;
        operar("hipodromo_comprar_carta", { p_carta: c.dataset.comprar }, d => `Compraste ${nombreCarta(d.carta)} (copia ${d.numero}) por ${mon(d.precio)} monedas.`);
      }
    });
    return { abrir, pintar: () => { if (listo) pintar(); } };
  }
  return { crear };
})();
