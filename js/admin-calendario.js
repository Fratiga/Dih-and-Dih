/* =============================================================================
   PESTAÑA «CALENDARIO» (panel de Admin): las próximas carreras del Hipódromo, solo para mirar.
   Lee hipodromo_programa (el programa público que ya ven los jugadores). No cambia nada: el motor del Hipódromo genera y corre las carreras por su cuenta
   y editar el programa a mano podría dejar apuestas y premios inconsistentes.
============================================================================= */
(function () {
  const panel = document.getElementById("adminPanelCalendario");
  if (!panel) return;
  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let cargado = 0;

  const dia = d => d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
  const hora = d => d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  const clima = pron => { const m = (Array.isArray(pron) ? pron : []).slice().sort((a, b) => b.prob - a.prob)[0]; return m ? `${m.clima} (${Math.round(m.prob * 100)}%)` : ""; };

  async function cargar() {
    if (Date.now() - cargado < 30000) return;
    const estado = $("adminCalendarioEstado"), caja = $("adminCalendarioLista");
    estado.textContent = "Cargando...";
    try {
      const sb = await fichasCliente();
      const { data, error } = await sb.from("hipodromo_programa").select("n, hora, publico").gte("hora", new Date(Date.now() - 3600000).toISOString()).order("hora").limit(48);
      if (error) throw error;
      cargado = Date.now();
      const ahora = Date.now();
      let ultimoDia = "";
      caja.innerHTML = (data || []).length ? `<table class="admin-cal-tabla"><thead><tr><th>Hora</th><th>N.º</th><th>Carrera</th><th>Grado</th><th>Distancia</th><th>Pista</th><th>Bolsa</th><th>Clima más probable</th></tr></thead><tbody>`
        + data.map(c => {
          const f = new Date(c.hora), p = c.publico || {}, d = dia(f);
          const cab = d !== ultimoDia ? `<tr><th colspan="8" class="admin-cal-dia">${esc(d)}</th></tr>` : "";
          ultimoDia = d;
          return `${cab}<tr${f.getTime() <= ahora ? ' class="admin-cal-pasada"' : ""}><td>${esc(hora(f))}</td><td>${esc(c.n)}</td><td>${esc(p.nombre || "")}</td><td>${esc(p.grado || "")}</td><td>${p.dist ? esc(p.dist) + " m" : ""}</td><td>${esc(p.pista || "")}</td><td>${p.bolsa != null ? esc(p.bolsa) : ""}</td><td>${esc(clima(p.pron))}</td></tr>`;
        }).join("") + `</tbody></table>`
        : `<p class="admin-vacio">No hay carreras programadas.</p>`;
      estado.textContent = "";
    } catch (e) { estado.textContent = `No se pudo cargar: ${e.message || e}`; }
  }
  document.querySelector('[data-tab="calendario"]').addEventListener("click", cargar);
})();
