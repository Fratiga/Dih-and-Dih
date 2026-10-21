/* Selector visual de cartas (Intercambios): un cuadro con las cartas de verdad, buscador y filtros, donde se pulsa una carta para ponerla o quitarla.
   Sirve para lo que ofreces (tus copias libres, una a una) y para lo que pides (todo el catálogo, con cantidad por carta).
   SelectorCartas.abrir({ titulo, ayuda, items, max, maxPorCarta, seleccion, filtroTengo }) devuelve una promesa con
   [{ clave, n, item }] o null si se cancela.
     item = { clave, carta, nombre, rareza, tipo, afinidad: [..], numero?, tengo?: cuántas copias tiene ya quien elige }
   Los estilos de .sc-* están en css/puesto.css. Necesita js/cartas-mini.js. */
window.SelectorCartas = (function () {
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sinTildes = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const TANDA = 48;

  function abrir(op) {
    return new Promise(resolver => {
      const items = op.items || [];
      const max = op.max || 5, porCarta = op.maxPorCarta || 1;
      const sel = new Map((op.seleccion || []).map(s => [s.clave, s.n]));
      const R = window.CARTAS_RAREZAS || {}, A = window.CARTAS_AFINIDADES || {}, T = window.CARTAS_TIPOS || [];
      const tipos = [...new Set(items.map(i => i.tipo).filter(Boolean))].sort((a, b) => (T.indexOf(a) - T.indexOf(b)));
      const opcion = (v, n) => `<option value="${esc(v)}">${esc(n)}</option>`;
      let limite = TANDA, filtrada = [];

      const dlg = document.createElement("dialog");
      dlg.className = "sc-dialogo";
      dlg.innerHTML = `
        <header><div><h2>${esc(op.titulo || "Elige cartas")}</h2>${op.ayuda ? `<p class="sc-ayuda">${esc(op.ayuda)}</p>` : ""}</div><span class="sc-cuenta" role="status"></span></header>
        <div class="sc-barra">
          <input type="search" class="sc-buscar" placeholder="Buscar por nombre..." aria-label="Buscar una carta" autocomplete="off">
          <select data-f="rareza" aria-label="Rareza"><option value="">Toda rareza</option>${Object.keys(R).map(k => opcion(k, R[k].nombre)).join("")}</select>
          <select data-f="tipo" aria-label="Tipo"><option value="">Todo tipo</option>${tipos.map(t => opcion(t, t)).join("")}</select>
          <select data-f="af" aria-label="Afinidad"><option value="">Toda afinidad</option>${Object.keys(A).map(k => opcion(k, A[k].nombre)).join("")}</select>
          ${op.filtroTengo ? `<label class="sc-check"><input type="checkbox" class="sc-notengo"> Solo las que no tengo</label>` : ""}
        </div>
        <div class="sc-grid" role="list"></div>
        <div class="sc-mas"></div>
        <footer><span class="sc-aviso" role="status"></span><button type="button" class="cartas-boton" data-no>Cancelar</button><button type="button" class="cartas-boton cartas-boton-principal" data-ok>Listo</button></footer>`;
      document.body.appendChild(dlg);
      const $ = s => dlg.querySelector(s);
      const grid = $(".sc-grid"), cuenta = $(".sc-cuenta"), aviso = $(".sc-aviso"), mas = $(".sc-mas");
      const porClave = new Map(items.map(i => [i.clave, i]));
      const total = () => [...sel.values()].reduce((s, n) => s + n, 0);

      function avisar(t) { aviso.textContent = t || ""; clearTimeout(avisar.t); if (t) avisar.t = setTimeout(() => { aviso.textContent = ""; }, 2600); }
      function pintarCuenta() {
        const t = total();
        cuenta.textContent = `${t} de ${max}`;
        cuenta.classList.toggle("sc-lleno", t >= max);
        $("[data-ok]").textContent = t ? `Listo (${t})` : "Listo";
      }
      function filtrar() {
        const q = sinTildes($(".sc-buscar").value.trim());
        const f = { rareza: $('[data-f="rareza"]').value, tipo: $('[data-f="tipo"]').value, af: $('[data-f="af"]').value };
        const soloNo = !!($(".sc-notengo") && $(".sc-notengo").checked);
        filtrada = items.filter(i => (!q || sinTildes(i.nombre).includes(q)) && (!f.rareza || i.rareza === f.rareza) && (!f.tipo || i.tipo === f.tipo)
          && (!f.af || (i.afinidad || []).includes(f.af)) && (!soloNo || !i.tengo));
        limite = TANDA;
        pintar();
      }
      function tarjeta(i) {
        const n = sel.get(i.clave) || 0, uno = porCarta === 1;
        const pie = i.numero ? `copia ${i.numero}` : i.tengo ? `ya tienes ${i.tengo}` : "";
        return `<div class="sc-item${n ? " sc-on" : ""}" data-clave="${esc(i.clave)}" role="listitem">
          <div class="sc-cuerpo" role="button" tabindex="0" aria-pressed="${n ? "true" : "false"}" aria-label="${esc(i.nombre)}">${window.CartasMini.cuerpo({ carta: i.carta, nombre: i.nombre, rareza: i.rareza, numero: i.numero })}</div>
          ${n ? `<i class="sc-marca">${uno ? "✓" : "×" + n}</i>` : ""}
          <button type="button" class="sc-lupa" data-ver="${esc(i.carta)}" data-numero="${esc(i.numero || "")}" aria-label="Ver ${esc(i.nombre)} grande">🔍</button>
          ${!uno && n ? `<div class="sc-ctrl"><button type="button" data-menos aria-label="Una menos">−</button><b>${n}</b><button type="button" data-mas aria-label="Una más">+</button></div>` : ""}
          <small class="sc-pie">${esc(i.nombre)}${pie ? `<br><i>${esc(pie)}</i>` : ""}</small></div>`;
      }
      function pintar() {
        const vista = filtrada.slice(0, limite);
        grid.innerHTML = vista.length ? vista.map(tarjeta).join("") : `<p class="sc-vacio">No hay cartas con esos filtros.</p>`;
        mas.innerHTML = filtrada.length > limite ? `<button type="button" class="cartas-boton" data-mas-cartas>Mostrar más (${filtrada.length - limite} restantes)</button>` : "";
        pintarCuenta();
      }
      function repintarItem(clave) {
        const i = porClave.get(clave), viejo = grid.querySelector(`[data-clave="${CSS.escape(clave)}"]`);
        if (viejo && i) viejo.outerHTML = tarjeta(i);
        pintarCuenta();
      }
      function alternar(clave) {
        const n = sel.get(clave) || 0;
        if (n) sel.delete(clave);
        else { if (total() >= max) { avisar(`Como mucho ${max} cartas.`); return; } sel.set(clave, 1); }
        repintarItem(clave);
      }
      function cambiar(clave, d) {
        const n = (sel.get(clave) || 0) + d;
        if (n <= 0) sel.delete(clave);
        else if (n > porCarta) { avisar(`Como mucho ${porCarta} de la misma carta.`); return; }
        else if (d > 0 && total() >= max) { avisar(`Como mucho ${max} cartas.`); return; }
        else sel.set(clave, n);
        repintarItem(clave);
      }

      dlg.addEventListener("input", ev => { if (ev.target.matches(".sc-buscar")) filtrar(); });
      dlg.addEventListener("change", ev => { if (ev.target.matches("select, .sc-notengo")) filtrar(); });
      dlg.addEventListener("click", ev => {
        const b = ev.target.closest("button"), item = ev.target.closest(".sc-item");
        if (b && "no" in b.dataset) { dlg.close(); return; }
        if (b && "ok" in b.dataset) { enviar(); return; }
        if (b && "masCartas" in b.dataset) { limite += TANDA; pintar(); return; }
        if (b && b.classList.contains("sc-lupa")) { window.CartasMini.abrir(b.dataset.ver, b.dataset.numero); return; }
        if (!item) return;
        if (b && "mas" in b.dataset) { cambiar(item.dataset.clave, 1); return; }
        if (b && "menos" in b.dataset) { cambiar(item.dataset.clave, -1); return; }
        if (ev.target.closest(".sc-cuerpo")) alternar(item.dataset.clave);
      });
      dlg.addEventListener("keydown", ev => {
        if ((ev.key === "Enter" || ev.key === " ") && ev.target.classList && ev.target.classList.contains("sc-cuerpo")) { ev.preventDefault(); alternar(ev.target.closest(".sc-item").dataset.clave); }
      });
      let resultado = null;
      function enviar() {
        resultado = [...sel.entries()].map(([clave, n]) => ({ clave, n, item: porClave.get(clave) })).filter(x => x.item);
        dlg.close();
      }
      dlg.addEventListener("click", ev => { if (ev.target === dlg) dlg.close(); });
      dlg.addEventListener("close", () => { dlg.remove(); resolver(resultado); });
      dlg.showModal();
      filtrar();
      $(".sc-buscar").focus();
    });
  }

  return { abrir };
})();
