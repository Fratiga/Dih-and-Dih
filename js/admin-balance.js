/* =============================================================================
   BALANCE DE TRIUNFOS (pestaña Balance del panel de Admin)
   1) Partidas reales: qué cartas se llevan los mazos de partidas terminadas y cuánto ganan.
   2) Probar una carta: el simulador (js/cartas-simulador.js) juega partidas entre mazos al azar y compara los mazos que
      llevan esa carta con mazos normales. También se puede revisar todo el catálogo.
   Los datos del simulador salen del catálogo de hoy (archivo + lo editado en el álbum), así que sirve para probar una carta
   recién editada antes de que nadie la juegue.
============================================================================= */
(function () {
  const panel = document.getElementById("adminPanelBalance");
  if (!panel) return;
  const $ = id => document.getElementById(id);
  const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const VERSION = (document.querySelector('script[src*="admin-balance.js"]').src.match(/\?v=\d+/) || [""])[0];
  const cargarScript = src => new Promise((ok, mal) => {
    if (document.querySelector(`script[data-bal="${src}"]`)) { ok(); return; }
    const s = document.createElement("script");
    s.src = src + VERSION; s.dataset.bal = src; s.onload = ok; s.onerror = () => mal(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(s);
  });

  let listo = false, cancelar = false, corriendo = false;

  async function prepararMotor() {
    if (listo) return;
    $("adminBalanceEstado").textContent = "Cargando el motor de cartas...";
    for (const f of ["js/cartas-datos.js", "js/cartas-motor.js", "js/cartas-efectos.js", "js/cartas-vinculos.js", "js/cartas-cliente.js", "js/cartas-simulador.js"]) await cargarScript(f);
    await window.CartasCliente.cargarDefiniciones(true);
    listo = true;
    $("adminBalanceEstado").textContent = "";
  }

  /* Las cartas como las ve el motor: lo que importa para jugar, más lado, copias máximas y si se pueden conseguir */
  function catalogo() {
    const out = {};
    (window.CARTAS || []).forEach(c => {
      if (c.borrador) return;
      out[c.id] = { id: c.id, nombre: c.nombre, tipo: c.tipo, rareza: c.rareza, afinidad: c.afinidad, coste: c.coste, atq: c.atq ?? null, pv: c.pv ?? null,
        habilidad: c.habilidad || "", lado: c.lado || null, obtenible: c.obtenible, copiasMax: c.copiasMax, formas: c.formas };
    });
    return out;
  }

  /* --- 1) Partidas reales --- */
  async function partidasReales() {
    const caja = $("adminBalanceReal");
    caja.innerHTML = `<p class="admin-vacio">Leyendo partidas...</p>`;
    try {
      const { data, error } = await (await fichasCliente()).from("cartas_partidas").select("mazo1, mazo2, resultado, estado").eq("estado", "terminada").limit(2000);
      if (error) throw error;
      const stats = {};
      let validas = 0;
      (data || []).forEach(p => {
        if (p.resultado !== "j1" && p.resultado !== "j2") return;
        validas++;
        [[p.mazo1, p.resultado === "j1"], [p.mazo2, p.resultado === "j2"]].forEach(([mazo, gano]) => {
          if (!Array.isArray(mazo)) return;
          const cuenta = {};
          mazo.forEach(id => { cuenta[id] = (cuenta[id] || 0) + 1; });
          Object.entries(cuenta).forEach(([id, n]) => {
            const x = stats[id] = stats[id] || { j: 0, w: 0, copias: 0 };
            x.j++; x.copias += n; if (gano) x.w++;
          });
        });
      });
      const nombre = id => { const c = window.cartaPorId && window.cartaPorId(id); return c ? c.nombre : id; };
      const filas = Object.entries(stats).map(([id, x]) => ({ id, ...x, wr: x.w / x.j })).sort((a, b) => b.wr - a.wr || b.j - a.j);
      caja.innerHTML = validas ? `<p>${validas} partida${validas === 1 ? "" : "s"} terminada${validas === 1 ? "" : "s"} con ganador. Con pocas partidas los porcentajes engañan: fíjate en la columna «Mazos».</p>
        <table class="admin-balance-tabla"><thead><tr><th>Carta</th><th>Mazos</th><th>Ganó</th><th>Copias por mazo</th></tr></thead><tbody>${filas.map(f =>
          `<tr><td>${esc(nombre(f.id))}</td><td>${f.j}</td><td>${Math.round(f.wr * 100)}%</td><td>${(f.copias / f.j).toFixed(1)}</td></tr>`).join("")}</tbody></table>`
        : `<p class="admin-vacio">Todavía no hay partidas terminadas con ganador.</p>`;
    } catch (e) {
      caja.innerHTML = `<p class="admin-vacio">No se pudieron leer las partidas: ${esc(e.message || e)}</p>`;
    }
  }

  /* --- 2) Simulador --- */
  const intervalo = (p, n) => 1.96 * Math.sqrt(Math.max(p * (1 - p), 0.0001) / Math.max(n, 1));
  const pc = x => (100 * x).toFixed(1) + "%";

  function veredicto(r) {
    const pCon = r.con.w / Math.max(1, r.con.j), pBase = r.base.w / Math.max(1, r.base.j);
    const delta = pCon - pBase;
    const margen = Math.sqrt(intervalo(pCon, r.con.j) ** 2 + intervalo(pBase, r.base.j) ** 2);
    let texto = "dentro de lo normal";
    if (delta > margen) texto = delta > 0.12 ? "claramente más fuerte que lo normal" : "algo más fuerte que lo normal";
    if (delta < -margen) texto = delta < -0.12 ? "claramente más débil que lo normal" : "algo más débil que lo normal";
    return { pCon, pBase, delta, margen, texto };
  }

  async function probarUna() {
    if (corriendo) return;
    const id = $("adminBalanceCarta").value;
    if (!id) return;
    corriendo = true; cancelar = false;
    const n = Number($("adminBalancePartidas").value);
    const salida = $("adminBalanceSim");
    $("adminBalanceProbar").disabled = true; $("adminBalanceTodas").disabled = true; $("adminBalanceParar").hidden = false;
    try {
      await prepararMotor();
      const cartas = catalogo();
      const r = await window.CartasSimulador.probarCarta({ cartas, cartaId: id, partidas: n, semilla: Date.now() % 100000,
        alProgreso: (h, t) => { salida.innerHTML = `<p>Jugando... ${h} de ${t}</p>`; }, cancelado: () => cancelar });
      const v = veredicto(r);
      salida.innerHTML = `<p><strong>${esc(cartas[id].nombre)}</strong>: ${pc(v.pCon)} de victorias con un mazo que la lleva (${r.con.j} partidas),
        frente a ${pc(v.pBase)} de un mazo normal (${r.base.j} partidas). Diferencia ${v.delta >= 0 ? "+" : ""}${(v.delta * 100).toFixed(1)} puntos, margen de error ±${(v.margen * 100).toFixed(1)}.
        Veredicto: <strong>${v.texto}</strong>.</p>
        <p class="admin-balance-nota">Mazos de ${$("adminBalanceTam").value} cartas con la carta puesta a su máximo de copias y el resto al azar, contra mazos al azar. El bot es simple: sirve para comparar cartas, no para saber cómo la jugaría una persona.</p>`;
    } catch (e) {
      salida.innerHTML = `<p class="admin-vacio">No se pudo simular: ${esc(e.message || e)}</p>`;
    } finally {
      corriendo = false;
      $("adminBalanceProbar").disabled = false; $("adminBalanceTodas").disabled = false; $("adminBalanceParar").hidden = true;
    }
  }

  async function probarTodas() {
    if (corriendo) return;
    corriendo = true; cancelar = false;
    const salida = $("adminBalanceSim");
    $("adminBalanceProbar").disabled = true; $("adminBalanceTodas").disabled = true; $("adminBalanceParar").hidden = false;
    try {
      await prepararMotor();
      const cartas = catalogo();
      const ids = Object.keys(cartas).filter(id => cartas[id].obtenible !== false && id !== "el-bufon");
      const filas = [];
      for (let i = 0; i < ids.length && !cancelar; i++) {
        salida.innerHTML = `<p>Revisando ${i + 1} de ${ids.length}: ${esc(cartas[ids[i]].nombre)}...</p>`;
        const r = await window.CartasSimulador.probarCarta({ cartas, cartaId: ids[i], partidas: 80, semilla: 1000 + i, cancelado: () => cancelar });
        filas.push({ id: ids[i], ...veredicto(r), n: r.con.j });
      }
      filas.sort((a, b) => b.delta - a.delta);
      const fila = f => `<tr class="${Math.abs(f.delta) > f.margen && Math.abs(f.delta) > 0.1 ? "admin-balance-raro" : ""}"><td>${esc(cartas[f.id].nombre)}</td><td>${esc(cartas[f.id].tipo)}</td><td>${cartas[f.id].coste}</td><td>${pc(f.pCon)}</td><td>${f.delta >= 0 ? "+" : ""}${(f.delta * 100).toFixed(1)}</td></tr>`;
      salida.innerHTML = `<p>${filas.length} cartas${cancelar ? " (se paró antes de acabar)" : ""}, 80 partidas cada una. Con tan pocas partidas hay mucho ruido: usa esto para encontrar sospechosas y luego pruébalas con 1000.</p>
        <table class="admin-balance-tabla"><thead><tr><th>Carta</th><th>Tipo</th><th>Coste</th><th>Gana</th><th>Dif. (puntos)</th></tr></thead><tbody>${filas.map(fila).join("")}</tbody></table>`;
    } catch (e) {
      salida.innerHTML = `<p class="admin-vacio">No se pudo simular: ${esc(e.message || e)}</p>`;
    } finally {
      corriendo = false;
      $("adminBalanceProbar").disabled = false; $("adminBalanceTodas").disabled = false; $("adminBalanceParar").hidden = true;
    }
  }

  async function alAbrir() {
    try {
      await prepararMotor();
      partidasReales();
      const sel = $("adminBalanceCarta");
      if (sel.options.length <= 1) {
        Object.values(catalogo()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).forEach(c => sel.insertAdjacentHTML("beforeend", `<option value="${esc(c.id)}">${esc(c.nombre)} (${esc(c.tipo)}, coste ${c.coste})</option>`));
      }
    } catch (e) { $("adminBalanceEstado").textContent = `No se pudo cargar el motor: ${e.message || e}`; }
  }

  document.querySelector('[data-tab="balance"]').addEventListener("click", alAbrir);
  $("adminBalanceProbar").addEventListener("click", probarUna);
  $("adminBalanceTodas").addEventListener("click", probarTodas);
  $("adminBalanceParar").addEventListener("click", () => { cancelar = true; });
})();
