const modal = document.getElementById("entryModal");
const modalContent = document.getElementById("modalContent");

const ALL_ENTRIES = [
  ...(window.ENTRIES || []),
  ...(window.PERSONAJES || []),
  ...(window.LUGARES || []),
  ...(window.FACCIONES || []),
  ...(window.PERGAMINOS || []),
  ...(window.ARMAS || []),
  ...(window.BESTIARIO || []),
  ...(window.RAZAS || []),
  ...(window.RELIGIONES || []),
  ...(window.OBJETOS || [])
];

function entryTitleById(id) {
  return ALL_ENTRIES.find(e => e.id === id)?.title || id;
}

function relationLink(id) {
  const found = ALL_ENTRIES.find(e => e.id === id);
  if (!found) return id;
  return `<button type="button" class="relation-link" data-id="${id}">${found.title}</button>`;
}

const PLACE_NAME_INDEX = (window.LUGARES || []).map(l => ({ id: l.id, title: l.title.toLowerCase() }));

function relationLinkFuzzy(text) {
  const match = text.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  const baseName = (match ? match[1] : text).trim().toLowerCase();
  const found = PLACE_NAME_INDEX.find(l => l.title === baseName);
  if (!found) return text;
  return `<button type="button" class="relation-link" data-id="${found.id}">${text}</button>`;
}

function cardMeta(entry) {
  if (entry.category === "Personajes") {
    return [entry.raza, entry.faccion && entryTitleById(entry.faccion)].filter(Boolean).join(" · ");
  }
  if (entry.category === "Lugares" || entry.category === "Razas" || entry.category === "Religión") {
    return entry.region || "";
  }
  if (entry.category === "Facciones") {
    return [entry.tipo, entry.region].filter(Boolean).join(" · ");
  }
  if (entry.category === "Armas") {
    return entry.daño && entry.daño !== "—"
      ? [`${entry.daño} · ${entry.tipoDano}`, entry.escala].filter(Boolean).join(" · ")
      : "Especial";
  }
  if (entry.category === "Bestiario") {
    return [entry.raza, entry.clasificacion].filter(Boolean).join(" · ");
  }
  if (entry.category === "Objetos") {
    return [entry.tipo, entry.precio].filter(Boolean).join(" · ");
  }
  return "";
}

function modalExtraMeta(entry) {
  const rows = [];
  if (entry.category === "Personajes") {
    if (entry.titulo) rows.push(["Título", entry.titulo]);
    if (entry.raza) rows.push(["Raza", entry.raza]);
    if (entry.tipo) rows.push(["Tipo", entry.tipo]);
    if (entry.lugarOrigen) rows.push(["Lugar de origen", relationLink(entry.lugarOrigen)]);
    if (entry.ocupacion) rows.push(["Ocupación", entry.ocupacion]);
    if (entry.faccion) rows.push(["Facción", relationLink(entry.faccion)]);
    if (entry.primeraAparicion) rows.push(["Primera aparición", entry.primeraAparicion]);
    if (entry.relacionesConocidas?.length) {
      rows.push(["Relaciones conocidas", entry.relacionesConocidas
        .map(r => r.nota ? `${relationLink(r.id)} (${r.nota})` : relationLink(r.id))
        .join(", ")]);
    }
  } else if (entry.category === "Lugares" || entry.category === "Razas") {
    if (entry.region) rows.push(["Región", entry.region]);
    if (entry.gobierno) rows.push(["Gobierno", entry.gobierno]);
    if (entry.religionPredominante) rows.push(["Religión predominante", entry.religionPredominante]);
    if (entry.lugaresDestacados?.length) rows.push(["Lugares destacados", entry.lugaresDestacados.map(relationLinkFuzzy).join(", ")]);
  } else if (entry.category === "Facciones") {
    if (entry.tipo) rows.push(["Tipo", entry.tipo]);
    if (entry.region) rows.push(["Región", entry.region]);
    if (entry.ideologia) rows.push(["Ideología", entry.ideologia]);
    if (entry.miembrosConocidos?.length) rows.push(["Miembros conocidos", entry.miembrosConocidos.map(relationLink).join(", ")]);
    if (entry.relaciones?.length) {
      rows.push(["Relaciones", entry.relaciones
        .map(r => `${relationLink(r.id)} (${r.signo})`)
        .join(", ")]);
    }
  } else if (entry.category === "Armas") {
    if (entry.daño && entry.daño !== "—") rows.push(["Daño", entry.daño]);
    if (entry.tipoDano && entry.tipoDano !== "—") rows.push(["Tipo de daño", entry.tipoDano]);
    if (entry.escala) rows.push(["Escala con", entry.escala]);
    if (entry.alcance) rows.push(["Alcance", entry.alcance]);
    if (entry.peso) rows.push(["Peso", entry.peso]);
    if (entry.coste) rows.push(["Coste", entry.coste]);
    if (entry.propiedades?.length) rows.push(["Propiedades", entry.propiedades.join(", ")]);
  } else if (entry.category === "Bestiario") {
    if (entry.raza) rows.push(["Raza", entry.raza]);
    if (entry.clasificacion) rows.push(["Clasificación", entry.clasificacion]);
    if (entry.amenaza) rows.push(["Nivel de amenaza", entry.amenaza]);
    if (entry.region) rows.push(["Región habitual", relationLink(entry.region)]);
  } else if (entry.category === "Objetos") {
    if (entry.tipo) rows.push(["Tipo", entry.tipo]);
    if (entry.precio) rows.push(["Precio", entry.precio + (entry.nota ? ` (${entry.nota})` : "")]);
  } else if (entry.category === "Religión") {
    if (entry.simbolo) rows.push(["Símbolo", entry.simbolo]);
    if (entry.principio) rows.push(["Principio", entry.principio]);
    if (entry.region) rows.push(["Cultura de origen", entry.region]);
    if (entry.muerte) rows.push(["Visión de la muerte", entry.muerte]);
    if (entry.eternos) rows.push(["Visión de los Eternos", entry.eternos]);
  }
  if (!rows.length) return "";
  return `<p class="modal-meta">${rows.map(([k, v]) => `<strong>${k}:</strong> ${v}`).join("<br>")}</p>`;
}

function datosGMBlock(entry) {
  if (!entry.datosGM || typeof esAdmin !== "function" || !esAdmin()) return "";
  return `<div class="modal-gm"><p class="modal-gm-label">🔒 Solo GM</p>${entry.datosGM}</div>`;
}

function habilidadesBlock(entry) {
  if (!entry.habilidades || !entry.habilidades.length) return "";
  const items = entry.habilidades
    .map(h => `<p><strong>${h.nombre}:</strong> ${h.descripcion}</p>`)
    .join("");
  return `<div class="modal-habilidades"><h4>Habilidades</h4>${items}</div>`;
}

/* Convierte cada mención de un personaje/lugar/facción/etc. dentro de un
   bloque de HTML (por ejemplo un capítulo de cronología) en un botón
   .relation-link que abre esa entrada — igual que los links manuales que
   ya usa modalExtraMeta(), pero encontrados automáticamente en el texto
   en vez de tener que marcarlos a mano uno por uno.

   Respeta la visibilidad de lado/admin (entryEsVisible), así que nunca
   ofrece abrir algo que el visitante actual no debería poder ver. Cuando
   dos entradas comparten el mismo título (ej. "Eledar" o "Coach" existen
   una vez por Side), prioriza la que corresponda al lado que se está
   viendo ahora mismo. */
function autoLinkEntidades(html) {
  if (!html) return html;
  const laActual = typeof ladoActual === "function" ? ladoActual() : null;

  const vistos = new Map();
  ALL_ENTRIES.forEach(entry => {
    if (!entry.title || entry.title.length < 3) return;
    if (typeof entryEsVisible === "function" && !entryEsVisible(entry)) return;
    const key = entry.title.toLowerCase();
    const existente = vistos.get(key);
    if (!existente) { vistos.set(key, entry); return; }
    const prefiereNuevo = laActual && entry.lado?.includes(laActual) && !existente.lado?.includes(laActual);
    if (prefiereNuevo) vistos.set(key, entry);
  });
  if (!vistos.size) return html;

  const candidatos = [...vistos.values()].sort((a, b) => b.title.length - a.title.length);
  const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Coincidencia sensible a mayúsculas a propósito (si no, "dragón" o
  // "custodia" en minúscula terminan enlazando a entradas como "Dragón" o
  // "Custodia" que no tienen nada que ver con esa mención puntual). La
  // única excepción es el artículo inicial de un título como "La Espesura":
  // en prosa corrida es normal escribirlo en minúscula ("se adentraron en
  // la Espesura") sin que eso deje de ser el mismo lugar.
  function patronDeTitulo(title) {
    const m = title.match(/^(El|La|Los|Las)(\s.+)$/);
    if (!m) return escapeRegExp(title);
    const inicial = m[1][0];
    return `[${inicial}${inicial.toLowerCase()}]${escapeRegExp(m[1].slice(1))}${escapeRegExp(m[2])}`;
  }
  const patron = candidatos.map(c => patronDeTitulo(c.title)).join("|");
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${patron})(?![\\p{L}\\p{N}])`, "gu");

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;

  const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT, null);
  const nodos = [];
  let nodo;
  while ((nodo = walker.nextNode())) {
    if (nodo.parentElement.closest("a, button, script, style")) continue;
    nodos.push(nodo);
  }

  nodos.forEach(textNode => {
    const texto = textNode.nodeValue;
    re.lastIndex = 0;
    if (!re.test(texto)) return;
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let ultimo = 0;
    let m;
    while ((m = re.exec(texto))) {
      if (m.index > ultimo) frag.appendChild(document.createTextNode(texto.slice(ultimo, m.index)));
      const entry = vistos.get(m[0].toLowerCase());
      if (entry) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "relation-link";
        btn.dataset.id = entry.id;
        btn.textContent = m[0];
        frag.appendChild(btn);
      } else {
        frag.appendChild(document.createTextNode(m[0]));
      }
      ultimo = m.index + m[0].length;
    }
    if (ultimo < texto.length) frag.appendChild(document.createTextNode(texto.slice(ultimo)));
    textNode.parentNode.replaceChild(frag, textNode);
  });

  return wrapper.innerHTML;
}

function mapaLinkFor(entry) {
  if (entry.category !== "Lugares" || typeof window.mapaTienePin !== "function") return "";
  if (!window.mapaTienePin(entry.id)) return "";
  return `<button type="button" class="mapa-link" data-mapa-id="${entry.id}">📍 Ver en el mapa</button>`;
}

function openEntryModal(entry) {
  if (!entry) return;
  modalContent.innerHTML = `
    <div class="entry-type">${entry.category}</div>
    <h2>${entry.title}</h2>
    <p class="modal-meta">${entry.tags.join(" · ")}</p>
    ${modalExtraMeta(entry)}
    ${mapaLinkFor(entry)}
    <div class="modal-body">${entry.content}</div>
    ${habilidadesBlock(entry)}
    ${datosGMBlock(entry)}
  `;
  modal.showModal();
}

document.getElementById("closeModal").addEventListener("click", () => modal.close());
modal.addEventListener("click", e => { if (e.target === modal) modal.close(); });

modalContent.addEventListener("click", e => {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;
  e.preventDefault();
  const target = document.getElementById(link.getAttribute("href").slice(1));
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
});

modalContent.addEventListener("click", e => {
  const relLink = e.target.closest(".relation-link");
  if (!relLink) return;
  e.preventDefault();
  const relatedEntry = ALL_ENTRIES.find(item => item.id === relLink.dataset.id);
  if (relatedEntry) openEntryModal(relatedEntry);
});

modalContent.addEventListener("click", e => {
  const mapaLink = e.target.closest(".mapa-link");
  if (!mapaLink) return;
  e.preventDefault();
  if (typeof window.focusMapaPin === "function") window.focusMapaPin(mapaLink.dataset.mapaId);
});
