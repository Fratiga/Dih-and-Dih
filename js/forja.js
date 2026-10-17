/* La forja (Mi habitación): entregas cartas y a cambio sale una mejor. Antes era una pestaña de Intercambios.
   Toda la lógica y los límites viven en el servidor (docs/economia-6_forja.sql y docs/economia-14_forja_reserva.sql: cartas_forja_ver y
   cartas_forjar); aquí solo se escogen las cartas y se enseña lo que el servidor decide. Necesita js/batalla-apuestas.js, js/cartas-vista.js
   y js/dialogos.js. Se abre con Forja.abrir(). */
window.Forja = (function () {
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const TIPOS_FORJA = new Set(["Objeto", "Reacción", "Terreno", "Acción"]);   // la forja solo acepta cartas que no están vivas (el servidor lo vuelve a comprobar)
  const PLURAL = { comun: ["común", "comunes"], infrecuente: ["poco común", "poco comunes"], rara: ["rara", "raras"] };
  const rarezaN = (r, n) => (PLURAL[r] || [r, r])[n === 1 ? 0 : 1];

  let dlg = null, forja = null;
  const $ = id => document.getElementById(id);

  function estado(t, error) {
    const e = $("forjaEstado");
    if (!e) return;
    e.textContent = t || "";
    e.classList.toggle("ic-error", !!error);
  }
  async function rpc(nombre, args) {
    const { data, error } = await (await fichasCliente()).rpc(nombre, args || {});
    if (error) throw error;
    return data;
  }

  function mostrarCarta(titulo, cartaId, texto) {
    const c = window.cartaPorId(cartaId);
    const d = document.createElement("dialog");
    d.className = "ic-resultado";
    d.innerHTML = `<h2>${esc(titulo)}</h2>
      <div class="ic-carta">${c ? window.CartasVista.htmlCarta(c, true, 1, null) : ""}</div>
      <p><b>${esc(c ? c.nombre : cartaId)}</b>${texto ? `<br><small>${esc(texto)}</small>` : ""}</p>
      <button type="button" class="cartas-boton cartas-boton-principal">Genial</button>`;
    document.body.appendChild(d);
    d.querySelector(".cartas-boton-principal").addEventListener("click", () => d.close());
    d.addEventListener("close", () => d.remove());
    d.showModal();
  }

  function pintar() {
    if (!forja) return;
    $("forjaHoy").textContent = `Forjas de hoy: ${forja.hoy} de ${forja.tope}.`;
    $("forjaLista").innerHTML = forja.recetas.map(r => `
      <li><div><b>${esc(r.nombre)}</b>
        <span class="ba-linea">${esc(r.descripcion)}</span>
        <span class="ba-linea">Entregas: ${r.entrada.map(g => `${g.n} ${rarezaN(g.rareza, g.n)}`).join(" + ")} · Recibes: 1 carta ${rarezaN(r.salida.rareza, 1)} · Éxito: ${Math.round(r.exito * 100)} %${r.exito < 1 ? ` · Si falla: ${r.al_fallar === "devolver_una" ? "te devuelven una carta" : "lo pierdes todo"}` : ""}</span></div>
        <button type="button" class="cartas-boton cartas-boton-principal" data-forjar="${esc(r.id)}">Forjar</button></li>`).join("")
      || `<li class="ic-vacio">No hay recetas.</li>`;
  }

  async function cargar() {
    try { forja = await rpc("cartas_forja_ver"); pintar(); }
    catch (e) { $("forjaLista").innerHTML = `<li class="ic-vacio">${esc(e.message || e)}</li>`; }
  }

  async function forjar(id) {
    const BA = window.BatallaApuestas;
    const r = forja.recetas.find(x => x.id === id);
    if (!r) return;
    const necesarias = {};
    r.entrada.forEach(g => { necesarias[g.rareza] = (necesarias[g.rareza] || 0) + g.n; });
    const total = Object.values(necesarias).reduce((s, n) => s + n, 0);
    const res = await BA.elegir({
      titulo: `Forja: ${r.nombre}`, max: total,
      ayuda: `Entregas ${r.entrada.map(g => `${g.n} ${rarezaN(g.rareza, g.n)}`).join(" + ")}. Las cartas que entregas vuelven a la reserva; recibes una carta ${rarezaN(r.salida.rareza, 1)} (${Math.round(r.exito * 100)} % de éxito).`,
      filtro: c => necesarias[c.rareza] > 0 && TIPOS_FORJA.has(c.tipo),
      validar: sel => {
        const mal = Object.entries(necesarias).filter(([ra, n]) => sel.filter(c => c.rareza === ra).length !== n);
        return { ok: !mal.length && sel.length === total, texto: `Elegidas ${sel.length} de ${total}` };
      }
    });
    if (!res) return;
    if (res.error) { estado(res.error, true); return; }
    if (!(await dialogo.confirmar(`Vas a entregar ${total} cartas, que vuelven a la reserva. ¿Forjar?`, { titulo: "Forja", aceptar: "Forjar" }))) return;
    try {
      const out = await rpc("cartas_forjar", { p_receta: id, p_ejemplares: res.ids });
      if (out.resultado === "carta") mostrarCarta("¡La forja funcionó!", out.carta, `Copia ${out.numero}`);
      else if (out.resultado === "fallo") estado(out.devuelta ? "La forja falló. Te devolvieron una de las cartas." : "La forja falló y las cartas volvieron a la reserva.", true);
      else estado(out.mensaje || "No hay carta disponible ahora mismo. No se consumió nada.", true);
      await cargar();
    } catch (e) { estado(e.message || String(e), true); }
  }

  function crear() {
    dlg = document.createElement("dialog");
    dlg.id = "forjaDialogo";
    dlg.className = "hb-dialogo forja-dialogo";
    dlg.innerHTML = `<header><div><h2>La forja</h2><p class="hb-desc">Entregas cartas y a cambio sale una mejor, pero siempre se pierde valor por el camino y algunas recetas fallan.</p></div><button type="button" class="hb-cerrar" data-cerrar aria-label="Cerrar">×</button></header>
      <div class="hb-cuerpo">
        <p class="ic-ayuda">Las cartas que entregas no se pierden: vuelven a la reserva, de donde salen para otros jugadores. Solo acepta cartas que no estén vivas (objetos, reacciones, terrenos y acciones), nunca legendarias ni limitadas. Hasta tres forjas al día.</p>
        <p id="forjaHoy" class="ic-ayuda"></p>
        <p id="forjaEstado" class="ic-estado" role="status"></p>
        <ul id="forjaLista" class="ic-lista"></ul>
      </div>`;
    dlg.addEventListener("click", ev => {
      if (ev.target.closest("[data-cerrar]") || ev.target === dlg) { dlg.close(); return; }
      const b = ev.target.closest("[data-forjar]");
      if (b) forjar(b.dataset.forjar);
    });
    document.body.appendChild(dlg);
  }

  function abrir() {
    if (!dlg) crear();
    estado("");
    $("forjaLista").innerHTML = `<li class="ic-vacio">Calentando la forja...</li>`;
    if (!dlg.open) dlg.showModal();
    cargar();
  }

  return { abrir };
})();
