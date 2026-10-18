/* =============================================================================
   PESTAÑA «DIÁLOGOS» (panel de Admin), SQL en docs/admin/dialogos_personajes.sql
   Edita las frases del Buhonero (Intercambios) y del herrero gigante (La forja): añadir, cambiar y quitar frases de cada momento. Las frases de fábrica salen de
   los propios personajes (ORIGINALES en js/puesto-buhonero.js y js/forja-herrero.js) y lo que se guarda las reemplaza grupo por grupo
   (js/dialogos-personajes.js lo aplica en cada página). «Volver a las de fábrica» borra la fila del grupo. Los jugadores lo notan en su siguiente visita.
============================================================================= */
(function () {
  const panel = document.getElementById("adminPanelDialogos");
  if (!panel) return;
  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const PERS = {
    buhonero: { nombre: "El Buhonero", donde: "Intercambios (pestaña Buhonero) y Hipódromo (pestaña Cartas)", mod: () => window.PuestoBuhonero },
    herrero: { nombre: "El herrero gigante", donde: "La forja", mod: () => window.ForjaHerrero }
  };
  const MAX = 30, LARGO = 240;
  let personaje = "buhonero", guardadas = {}, trabajo = {}, listo = false;

  const mod = () => PERS[personaje].mod();
  const copia = l => l.slice();
  const guardadaDe = g => (guardadas[personaje] || {})[g] || null;
  const baseDe = g => guardadaDe(g) || mod().ORIGINALES[g];
  const actual = g => { const t = (trabajo[personaje] = trabajo[personaje] || {}); return t[g] || (t[g] = copia(baseDe(g))); };
  const limpias = g => actual(g).map(t => t.trim()).filter(Boolean);
  const sucio = g => JSON.stringify(limpias(g)) !== JSON.stringify(baseDe(g));
  const estado = (t, error) => { const e = $("adminDialogosEstado"); e.textContent = t || ""; e.classList.toggle("admin-error", !!error); };

  function pintarGrupo(g) {
    const frases = actual(g), editado = !!guardadaDe(g), cambiado = sucio(g);
    return `<section class="admin-dlg${editado ? " admin-dlg-editado" : ""}" data-grupo="${esc(g)}">
      <header><h3>${esc(mod().CUANDO[g] || g)}</h3><small>${esc(g)}${editado ? " · editado" : " · de fábrica"}${cambiado ? " · sin guardar" : ""}</small></header>
      <ul class="admin-dlg-lista">${frases.map((t, i) => `<li><input type="text" maxlength="${LARGO}" value="${esc(t)}" data-i="${i}" aria-label="Frase ${i + 1}"><button type="button" class="admin-dlg-quitar" data-quitar="${i}" aria-label="Quitar la frase ${i + 1}" title="Quitar esta frase">✕</button></li>`).join("")}</ul>
      <p class="admin-dlg-prueba" aria-live="polite"></p>
      <div class="admin-dlg-acciones">
        <button type="button" class="admin-cuenta-accion" data-anadir${frases.length >= MAX ? " disabled" : ""}>Añadir frase</button>
        <button type="button" class="admin-cuenta-accion" data-probar>Probar una</button>
        <button type="button" class="admin-cuenta-accion admin-dlg-guardar" data-guardar${cambiado ? "" : " disabled"}>Guardar</button>
        <button type="button" class="admin-cuenta-accion admin-cuenta-peligro" data-fabrica${editado || cambiado ? "" : " disabled"}>Volver a las de fábrica</button>
      </div></section>`;
  }
  function pintar() {
    $("adminDialogosDonde").textContent = `Se oye en: ${PERS[personaje].donde}.`;
    document.querySelectorAll("#adminDialogosPers [data-pers]").forEach(b => b.classList.toggle("activa", b.dataset.pers === personaje));
    $("adminDialogosGrupos").innerHTML = Object.keys(mod().ORIGINALES).map(pintarGrupo).join("");
  }
  const repintarGrupo = g => {
    const viejo = $("adminDialogosGrupos").querySelector(`[data-grupo="${g}"]`);
    if (viejo) viejo.outerHTML = pintarGrupo(g);
  };

  async function guardar(g) {
    const frases = limpias(g);
    if (!frases.length) { estado("Cada grupo necesita al menos una frase. Para quitarlas todas, usa «Volver a las de fábrica».", true); return; }
    if (frases.length > MAX || frases.some(t => t.length > LARGO)) { estado(`Como mucho ${MAX} frases de ${LARGO} caracteres.`, true); return; }
    try {
      const sb = await fichasCliente();
      const igualFabrica = JSON.stringify(frases) === JSON.stringify(mod().ORIGINALES[g]);
      const { error } = igualFabrica ? await sb.rpc("dialogo_quitar", { p_personaje: personaje, p_grupo: g }) : await sb.rpc("dialogo_guardar", { p_personaje: personaje, p_grupo: g, p_frases: frases });
      if (error) throw error;
      (guardadas[personaje] = guardadas[personaje] || {});
      if (igualFabrica) delete guardadas[personaje][g]; else guardadas[personaje][g] = frases;
      trabajo[personaje][g] = copia(frases);
      repintarGrupo(g);
      estado("Guardado. Los jugadores lo oyen en su siguiente visita.");
    } catch (e) { estado(`No se pudo guardar: ${e.message || e}`, true); }
  }
  async function fabrica(g) {
    if (!confirm("¿Volver a las frases de fábrica de este momento? Se pierden las que añadiste o cambiaste.")) return;
    try {
      if (guardadaDe(g)) {
        const { error } = await (await fichasCliente()).rpc("dialogo_quitar", { p_personaje: personaje, p_grupo: g });
        if (error) throw error;
        delete guardadas[personaje][g];
      }
      trabajo[personaje][g] = copia(mod().ORIGINALES[g]);
      repintarGrupo(g);
      estado("Vuelven las frases de fábrica.");
    } catch (e) { estado(`No se pudo: ${e.message || e}`, true); }
  }

  async function abrir() {
    if (listo) return; listo = true;
    estado("Cargando...");
    try {
      const { data, error } = await (await fichasCliente()).from("dialogos_personajes").select("personaje, grupo, frases");
      if (error) throw error;
      guardadas = {};
      (data || []).forEach(f => { (guardadas[f.personaje] = guardadas[f.personaje] || {})[f.grupo] = f.frases; });
      pintar(); estado("");
    } catch (e) { listo = false; estado(/dialogos_personajes|relation|does not exist|schema cache/i.test(e.message || "") ? "Falta correr docs/admin/dialogos_personajes.sql en Supabase." : `No se pudo cargar: ${e.message || e}`, true); }
  }

  document.querySelector('[data-tab="dialogos"]').addEventListener("click", abrir);
  $("adminDialogosPers").addEventListener("click", ev => {
    const b = ev.target.closest("[data-pers]");
    if (!b || !listo) return;
    personaje = b.dataset.pers; pintar();
  });
  $("adminDialogosGrupos").addEventListener("input", ev => {
    const inp = ev.target.closest("input[data-i]"), sec = ev.target.closest("[data-grupo]");
    if (!inp || !sec) return;
    const g = sec.dataset.grupo;
    actual(g)[Number(inp.dataset.i)] = inp.value;
    const cambiado = sucio(g);
    sec.querySelector("[data-guardar]").disabled = !cambiado;
    sec.querySelector("[data-fabrica]").disabled = !(guardadaDe(g) || cambiado);
    sec.querySelector("header small").textContent = `${g}${guardadaDe(g) ? " · editado" : " · de fábrica"}${cambiado ? " · sin guardar" : ""}`;
  });
  $("adminDialogosGrupos").addEventListener("click", ev => {
    const b = ev.target.closest("button"), sec = ev.target.closest("[data-grupo]");
    if (!b || !sec) return;
    const g = sec.dataset.grupo;
    if (b.dataset.quitar !== undefined) { actual(g).splice(Number(b.dataset.quitar), 1); repintarGrupo(g); }
    else if ("anadir" in b.dataset) {
      actual(g).push(""); repintarGrupo(g);
      const filas = $("adminDialogosGrupos").querySelectorAll(`[data-grupo="${g}"] input[data-i]`); if (filas.length) filas[filas.length - 1].focus();
    } else if ("probar" in b.dataset) {
      const l = limpias(g);
      sec.querySelector(".admin-dlg-prueba").textContent = l.length ? `«${l[Math.floor(Math.random() * l.length)]}»` : "Sin frases.";
    } else if ("guardar" in b.dataset) guardar(g);
    else if ("fabrica" in b.dataset) fabrica(g);
  });
})();
