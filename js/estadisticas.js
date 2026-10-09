let editorAbierto = null; // { id, sucio } mientras hay una ficha en edición dentro del diálogo
const state = { search: "", tipos: new Set(), nivelMin: null, nivelMax: null, orden: "default", seleccion: new Set() };

/* Las fichas ahora se pueden editar: todo texto que viene de ellas se escapa al pintarlo. */
function htmlSeguro(t) {
  return String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function modAbility(score) {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function statVitalsHTML(s) {
  const vitals = [];
  if (s.nivel !== undefined) vitals.push(["Nivel", s.nivel]);
  if (s.iniciativa) vitals.push(["Iniciativa", s.iniciativa]);
  if (s.pv !== undefined) vitals.push(["PV", s.pv]);
  if (s.ca !== undefined) vitals.push(["CA", s.ca]);
  if (s.velocidad) vitals.push(["Velocidad", s.velocidad]);

  return vitals.length
    ? `<div class="stat-vitals">${vitals.map(([k, v]) => `<div class="stat-vital"><strong>${k}</strong>${htmlSeguro(v)}</div>`).join("")}</div>`
    : "";
}

function statCardHTML(s) {
  const elegida = state.seleccion.has(s.id);
  return `
    <article class="stat-card ${elegida ? "is-selected" : ""}" data-tipo="${htmlSeguro(s.tipo)}" data-stat-id="${htmlSeguro(s.id)}">
      <button type="button" class="stat-card-select" data-select-stat title="Ver junto con otras fichas">${elegida ? "✓ Seleccionada" : "+ Comparar"}</button>
      <div class="stat-card-heading">
        <h3>${htmlSeguro(s.nombre)}</h3>
        <p class="stat-card-role">${htmlSeguro(s.rol)}</p>
        ${s.raza ? `<p class="stat-card-race">${htmlSeguro(s.raza)}</p>` : ""}
        ${STATS_EDITADAS.has(s.id) ? `<p class="stat-card-editada" title="Esta ficha se editó: ya no es la del repositorio">✎ Editada</p>` : ""}
      </div>
      ${statVitalsHTML(s)}
      <p class="stat-card-hint">Ver ficha completa →</p>
    </article>
  `;
}

/* Sección "Para Roll20": cada habilidad convertida en comandos de chat, con
   botones para copiarlos (js/stats-roll20.js). */
function statRoll20HTML(s) {
  if (typeof statsR20Enemigo !== "function") return "";
  const e = statsR20Enemigo(s);
  const grupos = ["Acciones", "Rasgos", "Tiradas"].map(cat => {
    const items = e.items.filter(i => i.categoria === cat);
    if (!items.length) return "";
    const filas = items.map(i => {
      const botones = i.tieneModo
        ? `<button type="button" class="stat-r20-btn" data-cmd="${escaparAtributo(i.cmd.normal)}">Copiar</button>
           <button type="button" class="stat-r20-btn" data-cmd="${escaparAtributo(i.cmd.ventaja)}" title="Ventaja">Vent.</button>
           <button type="button" class="stat-r20-btn" data-cmd="${escaparAtributo(i.cmd.desventaja)}" title="Desventaja">Desv.</button>`
        : `<button type="button" class="stat-r20-btn" data-cmd="${escaparAtributo(i.cmd.normal)}">Copiar</button>`;
      return `<div class="stat-r20-fila"><span>${htmlSeguro(i.texto)}</span><span class="stat-r20-botones">${botones}</span></div>`;
    }).join("");
    return `<p class="stat-r20-grupo">${cat}${cat === "Rasgos" ? " (se anuncian en el chat)" : ""}</p>${filas}`;
  }).join("");
  return `<p class="stat-section-label">Para Roll20</p><div class="stat-r20">${grupos}</div>`;
}

function escaparAtributo(texto) {
  return String(texto).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* Copia el comando al portapapeles desde cualquiera de los dos diálogos. */
document.addEventListener("click", async e => {
  const boton = e.target.closest(".stat-r20-btn");
  if (!boton) return;
  const texto = boton.dataset.cmd;
  let ok = false;
  try { await navigator.clipboard.writeText(texto); ok = true; } catch (err) { /* sin permiso */ }
  if (!ok) { dialogo.copiar("Copia este comando a mano:", texto, { titulo: "Copiar comando" }); return; }
  const original = boton.textContent;
  boton.textContent = "✓";
  setTimeout(() => { boton.textContent = original; }, 1200);
});

/* Deja los enemigos (ya convertidos a comandos) y los que tengas marcados
   "+ Comparar" a la vista del script de Roll20 (roll20/compendio-roll20.user.js). */
function publicarEnemigosRoll20() {
  if (typeof statsR20Enemigo !== "function") return;
  try {
    const payload = {
      version: 1,
      actualizado: Date.now(),
      enemigos: (window.STATS || []).map(statsR20Enemigo),
      seleccion: [...state.seleccion]
    };
    localStorage.setItem("compendioRoll20Enemigos", JSON.stringify(payload));
    window.postMessage({ tipo: "compendio-roll20-enemigos", payload }, window.location.origin);
  } catch (e) { /* publicar es un extra, nunca debe romper la página */ }
}

function statModalHTML(s, { editable = false } = {}) {
  const abilitiesHTML = s.stats
    ? `<div class="stat-abilities">${["fue", "des", "con", "int", "sab", "car"].map(k => `
        <div class="stat-ability">
          <div class="stat-ability-label">${k.toUpperCase()}</div>
          <div class="stat-ability-score">${htmlSeguro(s.stats[k])}</div>
          <div class="stat-ability-mod">${modAbility(s.stats[k])}</div>
        </div>`).join("")}</div>`
    : "";

  const equipoHTML = s.equipo && s.equipo.length
    ? `<p class="stat-section-label">Equipo</p><p class="stat-equipo">${s.equipo.map(htmlSeguro).join(", ")}</p>`
    : "";

  const notasHTML = s.notas && s.notas.length
    ? `<p class="stat-section-label">Rasgos de Combate</p><ul class="stat-notas">${s.notas.map(n => `<li>${htmlSeguro(n)}</li>`).join("")}</ul>`
    : "";

  const habilidadesHTML = s.habilidades && s.habilidades.length
    ? `<p class="stat-section-label">Habilidades</p>${s.habilidades.map(h => `
        <div class="stat-ability-item"><strong>${htmlSeguro(h.nombre)}</strong><p>${htmlSeguro(h.descripcion)}</p></div>`).join("")}`
    : "";

  const estrategiaHTML = s.estrategia
    ? `<p class="stat-estrategia">${htmlSeguro(s.estrategia)}</p>`
    : "";

  const roll20HTML = statRoll20HTML(s);

  const linkHTML = s.personajeId
    ? `<button type="button" class="stat-card-link" data-personaje-id="${htmlSeguro(s.personajeId)}">Ver personaje →</button>`
    : "";
  const editarHTML = editable
    ? `<div class="stat-edit-barra"><button type="button" class="stat-edit-btn" data-editar-stat="${htmlSeguro(s.id)}">✎ Editar ficha</button>${STATS_EDITADAS.has(s.id) ? `<span class="stat-card-editada">Editada</span>` : ""}</div>`
    : "";

  return `
    ${editarHTML}
    <div class="entry-type">Ficha de Combate</div>
    <h2>${htmlSeguro(s.nombre)}</h2>
    <p class="modal-meta">${htmlSeguro([s.rol, s.raza].filter(Boolean).join(" · "))}</p>
    ${statVitalsHTML(s)}
    ${abilitiesHTML}
    ${notasHTML}
    ${equipoHTML}
    ${habilidadesHTML}
    ${estrategiaHTML}
    ${roll20HTML}
    ${linkHTML}
  `;
}

function openStatModal(s) {
  editorAbierto = null;
  modalContent.innerHTML = statModalHTML(s, { editable: true });
  if (!modal.open) modal.showModal();
}


/* =============================================================================
   EDITAR UNA FICHA (solo Admin: la página ya está cerrada para los demás y la
   base de datos solo deja escribir al Admin). Se edita dentro del mismo diálogo
   de la ficha; al guardar, la ficha entera queda en Supabase (js/stats-ediciones.js)
   y pisa a la del repositorio. "Restaurar original" borra la edición.
============================================================================= */
const STAT_CARACTERISTICAS = [["fue", "FUE"], ["des", "DES"], ["con", "CON"], ["int", "INT"], ["sab", "SAB"], ["car", "CAR"]];

function filaHabilidadEditorHTML(h) {
  return `
    <div class="stat-edit-hab" data-hab>
      <div class="stat-edit-hab-top">
        <input type="text" data-hab-nombre value="${htmlSeguro(h.nombre)}" placeholder="Nombre (Acción, Pasiva, Reacción...)">
        <span class="fr-mover">
          <button type="button" data-hab-mover="-1" title="Subir" aria-label="Subir">▲</button><button type="button" data-hab-mover="1" title="Bajar" aria-label="Bajar">▼</button>
        </span>
        <button type="button" class="fichas-repetible-remove" data-hab-quitar title="Quitar esta habilidad" aria-label="Quitar">×</button>
      </div>
      <textarea data-hab-desc rows="3" placeholder="Qué hace">${htmlSeguro(h.descripcion)}</textarea>
    </div>`;
}

function statEditorHTML(s) {
  const texto = (id, etiqueta, valor, extra = "") =>
    `<div class="fichas-field"><label for="se-${id}">${etiqueta}</label><input type="text" id="se-${id}" data-se="${id}" value="${htmlSeguro(valor)}" ${extra}></div>`;
  const numero = (id, etiqueta, valor) =>
    `<div class="fichas-field"><label for="se-${id}">${etiqueta}</label><input type="number" step="any" id="se-${id}" data-se="${id}" value="${htmlSeguro(valor)}"></div>`;
  const editada = STATS_EDITADAS.has(s.id);
  return `
    <form class="stat-edit" data-stat-editor="${htmlSeguro(s.id)}" novalidate>
      <div class="entry-type">Editando ficha de combate</div>
      <h2>${htmlSeguro(s.nombre)}</h2>
      <p class="stat-edit-ayuda">Lo que cambies se guarda para todos y también lo ven Roll20 y Ostelar. Un campo vacío se quita de la ficha.</p>

      <p class="stat-section-label">Datos</p>
      <div class="fichas-field-grid fichas-grid-chico">
        ${texto("nombre", "Nombre", s.nombre)}
        ${texto("rol", "Rol", s.rol)}
        ${texto("tipo", "Tipo", s.tipo)}
        ${texto("raza", "Raza", s.raza)}
      </div>

      <p class="stat-section-label">Números</p>
      <div class="fichas-field-grid fichas-grid-chico">
        ${texto("nivel", "Nivel", s.nivel)}
        ${texto("iniciativa", "Iniciativa", s.iniciativa, 'placeholder="+2"')}
        ${numero("pv", "PV", s.pv)}
        ${numero("ca", "CA", s.ca)}
        ${texto("velocidad", "Velocidad", s.velocidad, 'placeholder="30 pies"')}
      </div>

      <p class="stat-section-label">Características</p>
      <div class="fichas-field-grid stat-edit-caract">
        ${STAT_CARACTERISTICAS.map(([k, n]) => numero(`car-${k}`, n, s.stats ? s.stats[k] : "")).join("")}
      </div>

      <p class="stat-section-label">Rasgos de combate <span class="stat-edit-nota">uno por línea</span></p>
      <textarea data-se="notas" rows="4">${htmlSeguro((s.notas || []).join("\n"))}</textarea>

      <p class="stat-section-label">Equipo <span class="stat-edit-nota">uno por línea</span></p>
      <textarea data-se="equipo" rows="3">${htmlSeguro((s.equipo || []).join("\n"))}</textarea>

      <p class="stat-section-label">Habilidades</p>
      <div data-habs>${(s.habilidades || []).map(filaHabilidadEditorHTML).join("")}</div>
      <button type="button" class="secondary-button fichas-add-btn" data-hab-agregar>+ Agregar habilidad</button>

      <p class="stat-section-label">Estrategia</p>
      <textarea data-se="estrategia" rows="3">${htmlSeguro(s.estrategia)}</textarea>

      <p class="stat-edit-error hidden" role="alert"></p>
      <div class="stat-edit-botones">
        <button type="submit" class="secondary-button" data-se-guardar>Guardar</button>
        <button type="button" class="stat-edit-sec" data-se-cancelar>Cancelar</button>
        ${editada ? `<button type="button" class="stat-edit-sec stat-edit-restaurar" data-se-restaurar>Restaurar original</button>` : ""}
      </div>
    </form>`;
}

/* Lee el formulario y arma la ficha nueva a partir de la que se editó (así se conservan
   id, personajeId y cualquier campo que el formulario no toque). */
function leerEditorStat(form, original) {
  const crudo = clave => form.querySelector(`[data-se="${clave}"]`).value;
  const v = clave => crudo(clave).trim();
  const s = JSON.parse(JSON.stringify(original));
  const poner = (campo, valor) => { if (valor === "" || valor === undefined) delete s[campo]; else s[campo] = valor; };
  const lineas = clave => crudo(clave).split("\n").map(l => l.trim()).filter(Boolean);

  if (!v("nombre")) return { error: "La ficha necesita un nombre.", donde: "nombre" };
  s.nombre = v("nombre");
  ["rol", "tipo", "raza", "iniciativa", "velocidad", "estrategia"].forEach(c => poner(c, v(c)));
  // El nivel casi siempre es un número, pero hay fichas que lo describen con texto
  const nivel = v("nivel");
  poner("nivel", /^\d+$/.test(nivel) ? Number(nivel) : nivel);
  for (const c of ["pv", "ca"]) {
    const t = v(c);
    if (t === "") { delete s[c]; continue; }
    const n = Number(t.replace(",", "."));
    if (!Number.isFinite(n)) return { error: `${c.toUpperCase()} tiene que ser un número.`, donde: c };
    s[c] = n;
  }

  const car = STAT_CARACTERISTICAS.map(([k]) => [k, v(`car-${k}`)]);
  const llenas = car.filter(([, t]) => t !== "");
  if (!llenas.length) delete s.stats;
  else if (llenas.length < car.length) return { error: "Pon las seis características o deja todas vacías.", donde: `car-${car.find(([, t]) => t === "")[0]}` };
  else {
    s.stats = {};
    for (const [k, t] of car) {
      const n = Number(t.replace(",", "."));
      if (!Number.isFinite(n)) return { error: `${k.toUpperCase()} tiene que ser un número.`, donde: `car-${k}` };
      s.stats[k] = n;
    }
  }

  const notas = lineas("notas");
  if (notas.length) s.notas = notas; else delete s.notas;
  const equipo = lineas("equipo");
  if (equipo.length) s.equipo = equipo; else delete s.equipo;

  const habilidades = [...form.querySelectorAll("[data-hab]")].map(f => ({
    nombre: f.querySelector("[data-hab-nombre]").value.trim(),
    descripcion: f.querySelector("[data-hab-desc]").value.trim()
  })).filter(h => h.nombre || h.descripcion);
  if (habilidades.some(h => !h.nombre)) return { error: "Una habilidad tiene descripción pero no nombre.", donde: null };
  s.habilidades = habilidades;
  return { stat: s };
}

function abrirEditorStat(s) {
  editorAbierto = { id: s.id, sucio: false };
  modalContent.innerHTML = statEditorHTML(s);
  activarFlechasNumericas(modalContent.querySelector(".stat-edit"));
  modal.scrollTop = 0;
  const primero = modalContent.querySelector('[data-se="nombre"]');
  if (primero) primero.focus({ preventScroll: true });
}

async function salirDelEditor(s, { confirmarSiHayCambios = true } = {}) {
  if (confirmarSiHayCambios && editorAbierto && editorAbierto.sucio) {
    const ok = await dialogo.confirmar("Tienes cambios sin guardar en esta ficha. Si sales ahora, se pierden.", { titulo: "Salir sin guardar", aceptar: "Salir", cancelar: "Seguir editando", peligro: true });
    if (!ok) return false;
  }
  editorAbierto = null;
  if (s) openStatModal(s);
  return true;
}

function mostrarErrorEditor(form, mensaje, donde) {
  const p = form.querySelector(".stat-edit-error");
  p.textContent = mensaje;
  p.classList.remove("hidden");
  const campo = donde && form.querySelector(`[data-se="${donde}"]`);
  if (campo) campo.focus();
  else p.scrollIntoView({ block: "nearest" });
}

async function guardarEditorStat(form) {
  const id = form.dataset.statEditor;
  const original = (window.STATS || []).find(x => x.id === id);
  if (!original) return;
  const r = leerEditorStat(form, original);
  if (r.error) { mostrarErrorEditor(form, r.error, r.donde); return; }
  const boton = form.querySelector("[data-se-guardar]");
  boton.disabled = true;
  boton.textContent = "Guardando...";
  try {
    await statsGuardarEdicion(r.stat);
  } catch (e) {
    boton.disabled = false;
    boton.textContent = "Guardar";
    const sinPermiso = e && (e.code === "42501" || /row-level security|permission/i.test(e.message || ""));
    mostrarErrorEditor(form, sinPermiso ? "Tu cuenta no tiene permiso para editar fichas." : "No se pudo guardar. Revisa la conexión y prueba de nuevo.", null);
    return;
  }
  editorAbierto = null;
  const actualizada = (window.STATS || []).find(x => x.id === id);
  renderTipoFilters();
  renderStats();
  publicarEnemigosRoll20();
  openStatModal(actualizada);
}

async function restaurarStat(form) {
  const id = form.dataset.statEditor;
  const actual = (window.STATS || []).find(x => x.id === id);
  const ok = await dialogo.confirmar(`Se borran todos los cambios de «${actual ? actual.nombre : id}» y la ficha vuelve a ser la original.`, { titulo: "Restaurar la ficha original", aceptar: "Restaurar", cancelar: "Cancelar", peligro: true });
  if (!ok) return;
  try {
    await statsRestaurarEdicion(id);
  } catch (e) {
    mostrarErrorEditor(form, "No se pudo restaurar. Revisa la conexión y prueba de nuevo.", null);
    return;
  }
  editorAbierto = null;
  renderTipoFilters();
  renderStats();
  publicarEnemigosRoll20();
  openStatModal((window.STATS || []).find(x => x.id === id));
}

modalContent.addEventListener("click", async e => {
  const editar = e.target.closest("[data-editar-stat]");
  if (editar) {
    const s = (window.STATS || []).find(x => x.id === editar.dataset.editarStat);
    if (s) abrirEditorStat(s);
    return;
  }
  const form = e.target.closest("[data-stat-editor]");
  if (!form) return;
  if (e.target.closest("[data-se-cancelar]")) {
    await salirDelEditor((window.STATS || []).find(x => x.id === form.dataset.statEditor));
  } else if (e.target.closest("[data-se-restaurar]")) {
    restaurarStat(form);
  } else if (e.target.closest("[data-hab-agregar]")) {
    const lista = form.querySelector("[data-habs]");
    lista.insertAdjacentHTML("beforeend", filaHabilidadEditorHTML({ nombre: "", descripcion: "" }));
    lista.lastElementChild.querySelector("[data-hab-nombre]").focus();
    if (editorAbierto) editorAbierto.sucio = true;
  } else if (e.target.closest("[data-hab-quitar]")) {
    e.target.closest("[data-hab]").remove();
    if (editorAbierto) editorAbierto.sucio = true;
  } else if (e.target.closest("[data-hab-mover]")) {
    const fila = e.target.closest("[data-hab]");
    const delta = Number(e.target.closest("[data-hab-mover]").dataset.habMover);
    const destino = delta < 0 ? fila.previousElementSibling : fila.nextElementSibling;
    if (destino) { if (delta < 0) destino.before(fila); else destino.after(fila); }
    if (editorAbierto) editorAbierto.sucio = true;
  }
});

modalContent.addEventListener("input", e => {
  if (editorAbierto && e.target.closest("[data-stat-editor]")) editorAbierto.sucio = true;
});

modalContent.addEventListener("submit", e => {
  const form = e.target.closest("[data-stat-editor]");
  if (!form) return;
  e.preventDefault();
  guardarEditorStat(form);
});

/* Esc, la X o un clic afuera no deben tirar una edición a medias sin avisar. */
function protegerCierreDelEditor(e) {
  if (!editorAbierto || !editorAbierto.sucio) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  salirDelEditor(null).then(salio => { if (salio) modal.close(); });
}
modal.addEventListener("cancel", protegerCierreDelEditor, true);
modal.addEventListener("click", e => { if (e.target === modal) protegerCierreDelEditor(e); }, true);
document.getElementById("closeModal").addEventListener("click", protegerCierreDelEditor, true);
modal.addEventListener("close", () => { editorAbierto = null; });


function renderTipoFilters() {
  const box = document.getElementById("tipoFilters");
  if (!box) return;
  const tipos = [...new Set((window.STATS || []).map(s => s.tipo).filter(Boolean))].sort();
  [...state.tipos].forEach(t => { if (!tipos.includes(t)) state.tipos.delete(t); });
  box.innerHTML = tipos.map(t => `<button class="pill ${state.tipos.has(t) ? "active" : ""}" data-tipo="${htmlSeguro(t)}">${htmlSeguro(t)}</button>`).join("");
}

function filteredStats() {
  const stats = window.STATS || [];
  return stats.filter(s => {
    const searchable = [s.nombre, s.rol, s.raza, s.tipo].filter(Boolean).join(" ").toLowerCase();
    const matchesSearch = !state.search || searchable.includes(state.search);
    const matchesTipo = state.tipos.size === 0 || state.tipos.has(s.tipo);

    let matchesNivel = true;
    if (state.nivelMin !== null || state.nivelMax !== null) {
      const n = Number(s.nivel);
      matchesNivel = Number.isFinite(n)
        && (state.nivelMin === null || n >= state.nivelMin)
        && (state.nivelMax === null || n <= state.nivelMax);
    }

    return matchesSearch && matchesTipo && matchesNivel;
  });
}

function sortedByNivel(stats, dir = "desc") {
  return [...stats].sort((a, b) => {
    const na = Number(a.nivel), nb = Number(b.nivel);
    const fa = Number.isFinite(na), fb = Number.isFinite(nb);
    if (fa && fb) return dir === "asc" ? na - nb : nb - na;
    if (fa) return -1;
    if (fb) return 1;
    return 0;
  });
}

function groupedByTipo(stats) {
  const groups = new Map();
  for (const s of stats) {
    const key = s.tipo || "Sin tipo";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function renderStats() {
  const grid = document.getElementById("statGrid");
  const stats = filteredStats();

  if (state.orden === "tipo") {
    grid.innerHTML = groupedByTipo(stats).map(([tipo, list]) => `
      <h3 class="stat-group-header">${htmlSeguro(tipo)}</h3>
      ${sortedByNivel(list).map(statCardHTML).join("")}
    `).join("");
  } else if (state.orden === "nivel-desc") {
    grid.innerHTML = sortedByNivel(stats, "desc").map(statCardHTML).join("");
  } else if (state.orden === "nivel-asc") {
    grid.innerHTML = sortedByNivel(stats, "asc").map(statCardHTML).join("");
  } else {
    grid.innerHTML = stats.map(statCardHTML).join("");
  }

  const count = document.getElementById("resultCount");
  if (count) count.textContent = `${stats.length} ${stats.length === 1 ? "ficha" : "fichas"}`;
}

const compareBar = document.getElementById("statCompareBar");
const compareModal = document.getElementById("statCompareModal");
const compareContent = document.getElementById("statCompareContent");

function updateCompareBar() {
  const n = state.seleccion.size;
  compareBar.classList.toggle("hidden", n === 0);
  document.getElementById("statCompareCount").textContent = `${n} ${n === 1 ? "ficha seleccionada" : "fichas seleccionadas"}`;
  document.getElementById("statCompareOpen").disabled = n < 2;
  publicarEnemigosRoll20();
}

function openCompareModal() {
  const elegidas = (window.STATS || []).filter(s => state.seleccion.has(s.id));
  if (!elegidas.length) return;
  compareContent.innerHTML = elegidas.map(s => `<section class="stat-compare-col">${statModalHTML(s)}</section>`).join("");
  compareModal.showModal();
}

document.getElementById("statGrid").addEventListener("click", e => {
  const card = e.target.closest(".stat-card");
  if (!card) return;
  if (e.target.closest("[data-select-stat]")) {
    const id = card.dataset.statId;
    const ahora = !state.seleccion.has(id);
    if (ahora) state.seleccion.add(id); else state.seleccion.delete(id);
    card.classList.toggle("is-selected", ahora);
    e.target.closest("[data-select-stat]").textContent = ahora ? "✓ Seleccionada" : "+ Comparar";
    updateCompareBar();
    return;
  }
  const s = (window.STATS || []).find(x => x.id === card.dataset.statId);
  if (s) openStatModal(s);
});

document.getElementById("statCompareOpen").addEventListener("click", openCompareModal);
document.getElementById("statCompareClear").addEventListener("click", () => {
  state.seleccion.clear();
  document.querySelectorAll(".stat-card.is-selected").forEach(c => {
    c.classList.remove("is-selected");
    c.querySelector("[data-select-stat]").textContent = "+ Comparar";
  });
  updateCompareBar();
});
document.getElementById("statCompareClose").addEventListener("click", () => compareModal.close());
compareContent.addEventListener("click", e => {
  const link = e.target.closest(".stat-card-link");
  if (!link) return;
  const entry = ALL_ENTRIES.find(x => x.id === link.dataset.personajeId);
  if (!entry) return;
  compareModal.close();
  openEntryModal(entry);
});

modalContent.addEventListener("click", e => {
  const link = e.target.closest(".stat-card-link");
  if (!link) return;
  const entry = ALL_ENTRIES.find(x => x.id === link.dataset.personajeId);
  if (entry) openEntryModal(entry);
});

const ordenSelect = document.getElementById("ordenSelect");
if (ordenSelect) {
  ordenSelect.addEventListener("change", e => {
    state.orden = e.target.value;
    renderStats();
  });
}

const statSearch = document.getElementById("statSearch");
if (statSearch) {
  statSearch.addEventListener("input", e => {
    state.search = e.target.value.toLowerCase().trim();
    renderStats();
  });
}

const tipoFiltersBox = document.getElementById("tipoFilters");
if (tipoFiltersBox) {
  tipoFiltersBox.addEventListener("click", e => {
    const btn = e.target.closest("[data-tipo]");
    if (!btn) return;
    const tipo = btn.dataset.tipo;
    if (state.tipos.has(tipo)) {
      state.tipos.delete(tipo);
      btn.classList.remove("active");
    } else {
      state.tipos.add(tipo);
      btn.classList.add("active");
    }
    renderStats();
  });
}

const nivelMinInput = document.getElementById("nivelMin");
const nivelMaxInput = document.getElementById("nivelMax");
if (nivelMinInput) {
  nivelMinInput.addEventListener("input", e => {
    state.nivelMin = e.target.value === "" ? null : Number(e.target.value);
    renderStats();
  });
}
if (nivelMaxInput) {
  nivelMaxInput.addEventListener("input", e => {
    state.nivelMax = e.target.value === "" ? null : Number(e.target.value);
    renderStats();
  });
}

const clearStatFilters = document.getElementById("clearStatFilters");
if (clearStatFilters) {
  clearStatFilters.addEventListener("click", () => {
    state.search = "";
    state.tipos.clear();
    state.nivelMin = null;
    state.nivelMax = null;
    state.orden = "default";
    if (statSearch) statSearch.value = "";
    if (tipoFiltersBox) tipoFiltersBox.querySelectorAll(".pill").forEach(b => b.classList.remove("active"));
    if (nivelMinInput) nivelMinInput.value = "";
    if (nivelMaxInput) nivelMaxInput.value = "";
    if (ordenSelect) ordenSelect.value = "default";
    renderStats();
  });
}

initAdminGate(async () => {
  // Primero las ediciones guardadas, para que la lista salga ya con ellas
  try { await window.statsEdicionesListas; } catch (e) { /* se ven las originales */ }
  publicarEnemigosRoll20();
  renderTipoFilters();
  renderStats();
});

activarFlechasNumericas(document.querySelector(".stat-level-range"));
