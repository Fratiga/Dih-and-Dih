/* =============================================================================
   LA MESA DE LA TABERNA
   Los protagonistas aparecen sentados a la mesa común de la taberna (index.html, grupos #lbMesaAtras y #lbMesaLados dentro del SVG).
   Salen de los datos reales de presencia (js/presencia.js): quien está conectado se sienta; quien se va, se levanta. Cada uno ocupa
   un puesto fijo mientras siga conectado, así nadie se mueve cuando llega otro.

   Sprites: PNG de 32x48 px con fondo transparente, figura sentada de frente, ancla en el centro de la base. Se dibujan al doble
   (64x96 unidades del escenario) con píxeles nítidos. Si un jugador no tiene sprite en data/protagonistas.js se dibuja la silueta
   provisional. Para sumar más puestos basta con añadir entradas a PUESTOS.

   Solo para comprobar la composición: index.html?mesa=prueba sienta siete siluetas marcadas «prueba» (no son jugadores).
============================================================================= */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const SPRITE = { w: 32, h: 48, escala: 2 };
  const SILUETA = "assets/protagonistas/silueta.png";
  // Puestos de la mesa. capa "atras": sentados detrás (la mesa les tapa las piernas); "lados": en las cabeceras, delante de la mesa.
  const PUESTOS = [
    { x: 580, y: 592, capa: "atras" }, { x: 660, y: 592, capa: "atras" }, { x: 500, y: 592, capa: "atras" }, { x: 740, y: 592, capa: "atras" },
    { x: 438, y: 618, capa: "lados" }, { x: 802, y: 618, capa: "lados" }
  ];
  const clave = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  let atras = null, lados = null, aviso = null;
  const sentados = new Map();      // id -> { puesto, nodo }
  const reducido = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function crearNodo(p, puesto, i) {
    const info = (window.PROTAGONISTAS || {})[clave(p.nombre)] || null;
    const src = (info && info.sprite) || SILUETA;
    const w = SPRITE.w * SPRITE.escala, h = SPRITE.h * SPRITE.escala;
    const g = el("g", { class: "lb-pj-mesa" + (info && info.sprite ? "" : " lb-pj-prov") + (p.prueba ? " lb-pj-prueba" : ""), "data-id": p.id, tabindex: "-1" });
    g.style.setProperty("--retraso", `${(i * 0.37).toFixed(2)}s`);
    const img = el("image", { x: puesto.x - w / 2, y: puesto.y - h, width: w, height: h, href: src, preserveAspectRatio: "xMidYMax meet" });
    img.addEventListener("error", () => {
      if (img.getAttribute("href") !== SILUETA) { img.setAttribute("href", SILUETA); g.classList.add("lb-pj-prov"); return; }
      // Ni siquiera carga la silueta (sin conexión, archivo movido): se dibuja con rectángulos para no enseñar nunca una imagen rota
      const v = el("g", { transform: `translate(${puesto.x - w / 2} ${puesto.y - h}) scale(${SPRITE.escala})`, class: "lb-pj-vector" });
      v.innerHTML = `<rect x="8" y="2" width="16" height="14" fill="#4a3868"/><rect x="11" y="7" width="10" height="7" fill="#0d0816"/><rect x="13" y="9" width="2" height="2" fill="#e8b84a"/><rect x="18" y="9" width="2" height="2" fill="#e8b84a"/>
        <rect x="5" y="15" width="22" height="16" fill="#4a3868"/><rect x="8" y="27" width="16" height="3" fill="#604c84"/><rect x="6" y="31" width="20" height="8" fill="#4a3868"/><rect x="6" y="39" width="7" height="9" fill="#3a2c52"/><rect x="19" y="39" width="7" height="9" fill="#3a2c52"/>`;
      img.replaceWith(v);
      g.classList.add("lb-pj-prov");
    });
    g.append(img);
    const nombre = String(p.nombre || "").slice(0, 11);
    const t = el("text", { x: puesto.x, y: puesto.y - h - 5, "text-anchor": "middle", class: "lb-pj-nombre" });
    t.textContent = nombre;
    g.append(t);
    const titulo = el("title", {});
    titulo.textContent = `${p.nombre}${info && info.personaje ? ` · ${info.personaje}` : ""}${p.prueba ? " (recurso de prueba, no es un jugador)" : ""}`;
    g.append(titulo);
    return g;
  }

  function fijar(lista) {
    if (!atras || !lados) return;
    const presentes = new Map((lista || []).map(p => [p.id, p]));
    // Se levantan los que ya no están
    for (const [id, s] of sentados) {
      if (!presentes.has(id)) { s.nodo.remove(); sentados.delete(id); }
    }
    // Se sientan los nuevos en el primer puesto libre
    const ocupados = new Set([...sentados.values()].map(s => s.puesto));
    let sinSitio = 0, i = sentados.size;
    for (const p of presentes.values()) {
      const ya = sentados.get(p.id);
      if (ya) { ya.nodo.classList.toggle("lb-pj-lejos", !!p.oculto); continue; }
      const libre = PUESTOS.findIndex((_, k) => !ocupados.has(k));
      if (libre < 0) { sinSitio++; continue; }
      ocupados.add(libre);
      const nodo = crearNodo(p, PUESTOS[libre], i++);
      nodo.classList.toggle("lb-pj-lejos", !!p.oculto);
      (PUESTOS[libre].capa === "atras" ? atras : lados).append(nodo);
      sentados.set(p.id, { puesto: libre, nodo });
    }
    // Quienes llevan más tiempo sentados no se mueven; los que no caben se cuentan aparte
    const total = presentes.size;
    aviso.textContent = total > PUESTOS.length ? `+${total - PUESTOS.length} más en la taberna` : "";
    lados.parentNode.setAttribute("data-sentados", String(sentados.size));
  }

  function iniciar() {
    atras = document.getElementById("lbMesaAtras");
    lados = document.getElementById("lbMesaLados");
    aviso = document.getElementById("lbMesaAviso");
    if (!atras || !lados || !aviso) return;
    if (/[?&]mesa=prueba\b/.test(location.search)) {
      fijar(Array.from({ length: 7 }, (_, k) => ({ id: "prueba-" + k, nombre: `Prueba ${k + 1}`, oculto: k === 3, prueba: true })));
    }
  }

  window.TabernaMesa = { fijar: lista => { if (!/[?&]mesa=prueba\b/.test(location.search)) fijar(lista); }, PUESTOS, SPRITE };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
