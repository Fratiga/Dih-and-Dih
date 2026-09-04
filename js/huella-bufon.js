/* =============================================================================
   HUELLA DEL BUFÓN, easter egg secreto. Un gorro de bufón aparece pegado a
   una entrada al azar del compendio. Al hacer click desaparece (con una
   risita) y reaparece en otra entrada RELACIONADA con la anterior, tirando
   del mismo grafo de relaciones que ya usa el auto-link de la cronología
   (relacionesConocidas, facción, lugar de origen, etc.). Después de varios
   saltos, el último click manda directo a secreto.html.

   Todo el estado vive en localStorage, así que persiste entre páginas y
   recargas. No requiere ningún cambio en los datos existentes: solo LEE
   los mismos campos relacionales que ya tienen las entradas.
============================================================================= */
(function () {
  const HUELLA_KEY_TARGET = "huellaBufonTarget";
  const HUELLA_KEY_HIST = "huellaBufonHistorial";
  const HUELLA_KEY_HOPS = "huellaBufonHops";
  const HUELLA_FINAL_HOPS = 7;

  // Solo categorías con página propia y sin gate de Side (Personajes queda
  // afuera a propósito, para no meterse con ese flujo de login).
  const HUELLA_PAGINAS = {
    "Lugares": "lugares.html",
    "Facciones": "facciones.html",
    "Razas": "razas.html",
    "Religión": "religion.html",
    "Armas": "armas.html",
    "Objetos": "objetos.html",
    "Bestiario": "bestiario.html",
    "Pergaminos": "pergaminos.html",
    "Textos": "textos.html"
  };

  const paginaActual = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  function leerJSON(key, fallback) {
    try {
      const val = JSON.parse(localStorage.getItem(key));
      return val === null || val === undefined ? fallback : val;
    } catch (e) { return fallback; }
  }

  function esElegible(entry) {
    if (!entry || !HUELLA_PAGINAS[entry.category]) return false;
    if (typeof entryEsVisible === "function" && !entryEsVisible(entry)) return false;
    return true;
  }

  function poolElegible() {
    return ALL_ENTRIES.filter(esElegible);
  }

  function construirGrafo() {
    const grafo = new Map();
    function link(a, b) {
      if (!a || !b || a === b) return;
      if (!grafo.has(a)) grafo.set(a, new Set());
      if (!grafo.has(b)) grafo.set(b, new Set());
      grafo.get(a).add(b);
      grafo.get(b).add(a);
    }
    ALL_ENTRIES.forEach(entry => {
      (entry.relacionesConocidas || []).forEach(r => link(entry.id, r.id));
      if (entry.faccion) link(entry.id, entry.faccion);
      if (entry.lugarOrigen) link(entry.id, entry.lugarOrigen);
      (entry.miembrosConocidos || []).forEach(id => link(entry.id, id));
      (entry.relaciones || []).forEach(r => link(entry.id, r.id));
      if (entry.category === "Bestiario" && entry.region) link(entry.id, entry.region);
    });
    return grafo;
  }

  function porId(id) {
    return ALL_ENTRIES.find(e => e.id === id);
  }

  function elegirSiguiente(actualId, historial) {
    const grafo = construirGrafo();
    const evitar = new Set(historial.slice(-4).concat([actualId]));

    const vecinos1 = [...(grafo.get(actualId) || [])]
      .map(porId)
      .filter(e => esElegible(e) && !evitar.has(e.id));
    if (vecinos1.length) return vecinos1[Math.floor(Math.random() * vecinos1.length)];

    const vistos2 = new Set();
    const vecinos2 = [];
    (grafo.get(actualId) || []).forEach(medioId => {
      (grafo.get(medioId) || []).forEach(id => {
        if (vistos2.has(id)) return;
        vistos2.add(id);
        const e = porId(id);
        if (esElegible(e) && !evitar.has(id)) vecinos2.push(e);
      });
    });
    if (vecinos2.length) return vecinos2[Math.floor(Math.random() * vecinos2.length)];

    const pool = poolElegible().filter(e => !evitar.has(e.id));
    const candidatos = pool.length ? pool : poolElegible();
    return candidatos.length ? candidatos[Math.floor(Math.random() * candidatos.length)] : null;
  }

  function nuevoTargetDesde(entry) {
    return { id: entry.id, category: entry.category, page: HUELLA_PAGINAS[entry.category] };
  }

  let target = leerJSON(HUELLA_KEY_TARGET, null);
  let historial = leerJSON(HUELLA_KEY_HIST, []);
  let hops = Number(localStorage.getItem(HUELLA_KEY_HOPS)) || 0;

  if (!target || !porId(target.id)) {
    const pool = poolElegible();
    if (pool.length) {
      target = nuevoTargetDesde(pool[Math.floor(Math.random() * pool.length)]);
      localStorage.setItem(HUELLA_KEY_TARGET, JSON.stringify(target));
    }
  }

  if (!target || target.page !== paginaActual) return;

  function posicionar(el) {
    const card = document.querySelector(`[data-id="${target.id}"]`);
    if (card) {
      const rect = card.getBoundingClientRect();
      el.style.position = "absolute";
      el.style.left = `${Math.max(4, rect.right + window.scrollX - 16)}px`;
      el.style.top = `${Math.max(4, rect.top + window.scrollY - 16)}px`;
      return;
    }
    const posKey = "huellaBufonPos_" + target.id;
    let pos = leerJSON(posKey, null);
    if (!pos) {
      pos = { x: 8 + Math.random() * 82, y: 18 + Math.random() * 64 };
      localStorage.setItem(posKey, JSON.stringify(pos));
    }
    el.style.position = "fixed";
    el.style.left = `${pos.x}vw`;
    el.style.top = `${pos.y}vh`;
  }

  function reproducirRisita() {
    try {
      const audio = new Audio("assets/audio/risita-bufon.mp3");
      audio.volume = 0.6;
      audio.play().catch(() => {});
    } catch (e) { /* silencioso si el archivo no existe todavía */ }
  }

  function onClick(el) {
    reproducirRisita();
    el.classList.add("huella-bufon-encontrada");

    const nuevoHistorial = historial.concat([target.id]).slice(-12);
    const nuevosHops = hops + 1;
    localStorage.setItem(HUELLA_KEY_HIST, JSON.stringify(nuevoHistorial));
    localStorage.setItem(HUELLA_KEY_HOPS, String(nuevosHops));

    setTimeout(() => {
      el.remove();

      if (nuevosHops >= HUELLA_FINAL_HOPS) {
        localStorage.removeItem(HUELLA_KEY_TARGET);
        localStorage.setItem(HUELLA_KEY_HOPS, "0");
        localStorage.setItem(HUELLA_KEY_HIST, "[]");
        window.location.href = "secreto.html";
        return;
      }

      const siguiente = elegirSiguiente(target.id, nuevoHistorial);
      if (siguiente) {
        localStorage.setItem(HUELLA_KEY_TARGET, JSON.stringify(nuevoTargetDesde(siguiente)));
      }
    }, 550);
  }

  function crearIcono() {
    const el = document.createElement("button");
    el.type = "button";
    el.id = "huellaBufonIcono";
    el.className = "huella-bufon-icono";
    el.setAttribute("aria-hidden", "false");
    posicionar(el);
    document.body.appendChild(el);
    el.addEventListener("click", () => onClick(el));
  }

  crearIcono();
})();
