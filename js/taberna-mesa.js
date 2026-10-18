/* =============================================================================
   LA MESA DE LA TABERNA
   Los protagonistas aparecen sentados a la mesa común (index.html: #lbMesaAtras, #lbMesaJarras y #lbMesaLados dentro del SVG), que es el foco
   de la sala. Salen de los datos reales de presencia (js/presencia.js): quien está conectado se sienta; quien se va, se levanta. Cada uno
   ocupa un puesto fijo mientras siga conectado, así nadie se mueve cuando llega otro. Con tu Side y tú caben seis: cuatro en el banco de
   atrás y dos en las cabeceras.

   Sprites: PNG de 32x48 px con fondo transparente, figura sentada de frente, ancla en el centro de la base. Se dibujan al triple
   (96x144 unidades del escenario) con píxeles nítidos. Si un jugador no tiene sprite en data/protagonistas.js se dibuja la silueta
   provisional. Para sumar más puestos basta con añadir entradas a PUESTOS.
   Cada plaza tiene su jarra delante, que de vez en cuando se levanta; el nombre solo se ve al pasar el cursor, enfocar o tocar al personaje.

   Solo para comprobar la composición: index.html?mesa=prueba sienta tres siluetas «Prueba 1..3» (con &n=6, seis). No son jugadores.
============================================================================= */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const SPRITE = { w: 32, h: 48, escala: 3 };
  const SILUETA = "assets/protagonistas/silueta.png";
  // Puestos de la mesa, en el orden en que se ocupan. capa "atras": en el banco detrás de la mesa (la mesa les tapa las piernas);
  // "lados": en las cabeceras, delante de la mesa. jarra: dónde queda la jarra sobre la mesa.
  const PUESTOS = [
    { x: 590, y: 598, capa: "atras", jarra: [572, 564] }, { x: 690, y: 598, capa: "atras", jarra: [722, 564] },
    { x: 490, y: 598, capa: "atras", jarra: [472, 564] }, { x: 790, y: 598, capa: "atras", jarra: [822, 564] },
    { x: 380, y: 650, capa: "lados", jarra: [424, 564] }, { x: 900, y: 650, capa: "lados", jarra: [846, 564] }
  ];
  const clave = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const modoPrueba = () => /[?&]mesa=prueba\b/.test(location.search);

  let atras = null, lados = null, jarras = null, aviso = null;
  const sentados = new Map();      // id -> { puesto, nodo, jarra }

  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function crearJarra(puesto, i) {
    const [x, y] = puesto.jarra;
    const g = el("g", { class: "lb-jarra", "aria-hidden": "true" });
    g.style.setProperty("--retraso", `${(i * 1.7).toFixed(1)}s`);
    g.innerHTML = `<rect x="${x}" y="${y}" width="16" height="20" fill="#c9a14a"/><rect x="${x + 16}" y="${y + 4}" width="5" height="11" fill="#c9a14a"/><rect x="${x + 2}" y="${y + 3}" width="12" height="3" fill="#8d6a45" opacity=".6"/><rect x="${x + 1}" y="${y - 4}" width="14" height="5" fill="#fff1b0"/>`;
    return g;
  }

  function crearNodo(p, puesto, i) {
    const info = (window.PROTAGONISTAS || {})[clave(p.nombre)] || null;
    const src = (info && info.sprite) || SILUETA;
    // Un sprite propio puede traer otro tamaño (tam: [ancho, alto] en píxeles del PNG) y se dibuja con el alto que se pida (alto, en unidades del escenario)
    const tam = (info && info.sprite && info.tam) || [SPRITE.w, SPRITE.h];
    const h = (info && info.sprite && info.alto) || SPRITE.h * SPRITE.escala, w = Math.round(tam[0] * h / tam[1]);
    const g = el("g", { class: "lb-pj-mesa" + (info && info.sprite ? "" : " lb-pj-prov") + (p.prueba ? " lb-pj-prueba" : ""), "data-id": p.id, tabindex: "0", role: "img", "aria-label": `${p.nombre}${p.prueba ? " (prueba)" : ""}` });
    g.style.setProperty("--retraso", `${(i * 0.37).toFixed(2)}s`);
    const img = el("image", { x: puesto.x - w / 2, y: puesto.y - h, width: w, height: h, href: src, preserveAspectRatio: "xMidYMax meet" });
    // Cuadros extra encima del base (mismo tamaño): brillo de los ojos y parpadeo, que se encienden por ratos (css/lobby.css)
    const extras = [];
    if (info && info.sprite) [["brillo", "lb-pj-f-brillo"], ["parpadeo", "lb-pj-f-parpadeo"]].forEach(([k, clase]) => {
      if (!info[k]) return;
      const f = el("image", { x: puesto.x - w / 2, y: puesto.y - h, width: w, height: h, href: info[k], preserveAspectRatio: "xMidYMax meet", class: clase, "aria-hidden": "true" });
      f.style.setProperty("--ciclo", `${(5.2 + (i % 3) * 0.7).toFixed(1)}s`);
      f.addEventListener("error", () => f.remove());
      extras.push(f);
    });
    img.addEventListener("error", () => {
      if (img.getAttribute("href") !== SILUETA) { img.setAttribute("href", SILUETA); g.classList.add("lb-pj-prov"); return; }
      // Ni siquiera carga la silueta (sin conexión, archivo movido): se dibuja con rectángulos para no enseñar nunca una imagen rota
      const v = el("g", { transform: `translate(${puesto.x - w / 2} ${puesto.y - h}) scale(${SPRITE.escala})`, class: "lb-pj-vector" });
      v.innerHTML = `<rect x="8" y="2" width="16" height="14" fill="#4a3868"/><rect x="11" y="7" width="10" height="7" fill="#0d0816"/><rect x="13" y="9" width="2" height="2" fill="#e8b84a"/><rect x="18" y="9" width="2" height="2" fill="#e8b84a"/>
        <rect x="5" y="15" width="22" height="16" fill="#4a3868"/><rect x="8" y="27" width="16" height="3" fill="#604c84"/><rect x="6" y="31" width="20" height="8" fill="#4a3868"/><rect x="6" y="39" width="7" height="9" fill="#3a2c52"/><rect x="19" y="39" width="7" height="9" fill="#3a2c52"/>`;
      img.replaceWith(v);
      g.classList.add("lb-pj-prov");
    });
    g.append(img, ...extras);
    // El nombre solo aparece con el cursor, el foco o un toque (css/lobby.css)
    const nombre = String(p.nombre || "").slice(0, 14);
    const ancho = nombre.length * 9 + 16;
    const etiqueta = el("g", { class: "lb-pj-etiqueta", "pointer-events": "none" });
    etiqueta.append(el("rect", { x: puesto.x - ancho / 2, y: puesto.y - h - 20, width: ancho, height: 18, fill: "#120d19", opacity: ".88" }));
    const t = el("text", { x: puesto.x, y: puesto.y - h - 7, "text-anchor": "middle", class: "lb-mesa-nombre" });
    t.textContent = nombre;
    etiqueta.append(t);
    g.append(etiqueta);
    const titulo = el("title", {});
    titulo.textContent = `${p.nombre}${info && info.personaje ? ` · ${info.personaje}` : ""}${p.prueba ? " (recurso de prueba, no es un jugador)" : ""}`;
    g.append(titulo);
    // Tocar o pulsar lo deja marcado (en el móvil no hay cursor)
    g.addEventListener("click", () => {
      const ya = g.classList.contains("lb-pj-activo");
      document.querySelectorAll(".lb-pj-activo").forEach(x => x.classList.remove("lb-pj-activo"));
      if (!ya) g.classList.add("lb-pj-activo");
    });
    g.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); g.dispatchEvent(new Event("click")); } });
    return g;
  }

  function fijar(lista) {
    if (!atras || !lados || !jarras || !aviso) return;
    const presentes = new Map((lista || []).map(p => [p.id, p]));
    // Se levantan los que ya no están
    for (const [id, s] of sentados) {
      if (!presentes.has(id)) { s.nodo.remove(); s.jarra.remove(); sentados.delete(id); }
    }
    // Se sientan los nuevos en el primer puesto libre
    const ocupados = new Set([...sentados.values()].map(s => s.puesto));
    let i = sentados.size;
    for (const p of presentes.values()) {
      const ya = sentados.get(p.id);
      if (ya) { ya.nodo.classList.toggle("lb-pj-lejos", !!p.oculto); continue; }
      const libre = PUESTOS.findIndex((_, k) => !ocupados.has(k));
      if (libre < 0) continue;
      ocupados.add(libre);
      const nodo = crearNodo(p, PUESTOS[libre], i), jarra = crearJarra(PUESTOS[libre], i);
      i++;
      nodo.classList.toggle("lb-pj-lejos", !!p.oculto);
      (PUESTOS[libre].capa === "atras" ? atras : lados).append(nodo);
      jarras.append(jarra);
      sentados.set(p.id, { puesto: libre, nodo, jarra });
    }
    // Quienes llevan más tiempo sentados no se mueven; los que no caben se cuentan aparte
    const total = presentes.size;
    aviso.textContent = total > PUESTOS.length ? `+${total - PUESTOS.length} más en la taberna` : "";
    lados.parentNode.setAttribute("data-sentados", String(sentados.size));
  }

  function iniciar() {
    atras = document.getElementById("lbMesaAtras");
    lados = document.getElementById("lbMesaLados");
    jarras = document.getElementById("lbMesaJarras");
    aviso = document.getElementById("lbMesaAviso");
    if (!atras || !lados || !jarras || !aviso) return;
    if (modoPrueba()) {
      const n = Math.max(1, Math.min(7, parseInt((location.search.match(/[?&]n=(\d+)/) || [])[1], 10) || 3));
      fijar(Array.from({ length: n }, (_, k) => ({ id: "prueba-" + k, nombre: `Prueba ${k + 1}`, oculto: false, prueba: true })));
    }
  }

  window.TabernaMesa = { fijar: lista => { if (!modoPrueba()) fijar(lista); }, PUESTOS, SPRITE };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
