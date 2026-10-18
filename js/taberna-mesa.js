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

  let atras = null, lados = null, jarras = null, aviso = null, paseo = null;
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
    // Quien pasea (info.pasea) se dibuja con el origen en los pies y se mueve con transform (ver iniciarPaseo)
    const pasea = !!(info && info.sprite && info.pasea);
    const px = pasea ? 0 : puesto.x, py = pasea ? 0 : puesto.y;
    const g = el("g", { class: "lb-pj-mesa" + (info && info.sprite ? "" : " lb-pj-prov") + (p.prueba ? " lb-pj-prueba" : ""), "data-id": p.id, tabindex: "0", role: "img", "aria-label": `${p.nombre}${p.prueba ? " (prueba)" : ""}` });
    g.style.setProperty("--retraso", `${(i * 0.37).toFixed(2)}s`);
    const img = el("image", { x: px - w / 2, y: py - h, width: w, height: h, href: src, preserveAspectRatio: "xMidYMax meet" });
    // Cuadros extra encima del base (mismo tamaño): brillo de los ojos y parpadeo, que se encienden por ratos (css/lobby.css)
    const extras = [];
    if (info && info.sprite) [["brillo", "lb-pj-f-brillo"], ["parpadeo", "lb-pj-f-parpadeo"]].forEach(([k, clase]) => {
      if (!info[k]) return;
      const f = el("image", { x: px - w / 2, y: py - h, width: w, height: h, href: info[k], preserveAspectRatio: "xMidYMax meet", class: clase, "aria-hidden": "true" });
      f.style.setProperty("--ciclo", `${(5.2 + (i % 3) * 0.7).toFixed(1)}s`);
      f.addEventListener("error", () => f.remove());
      extras.push(f);
    });
    img.addEventListener("error", () => {
      if (img.getAttribute("href") !== SILUETA) { img.setAttribute("href", SILUETA); g.classList.add("lb-pj-prov"); return; }
      // Ni siquiera carga la silueta (sin conexión, archivo movido): se dibuja con rectángulos para no enseñar nunca una imagen rota
      const v = el("g", { transform: `translate(${px - w / 2} ${py - h}) scale(${SPRITE.escala})`, class: "lb-pj-vector" });
      v.innerHTML = `<rect x="8" y="2" width="16" height="14" fill="#4a3868"/><rect x="11" y="7" width="10" height="7" fill="#0d0816"/><rect x="13" y="9" width="2" height="2" fill="#e8b84a"/><rect x="18" y="9" width="2" height="2" fill="#e8b84a"/>
        <rect x="5" y="15" width="22" height="16" fill="#4a3868"/><rect x="8" y="27" width="16" height="3" fill="#604c84"/><rect x="6" y="31" width="20" height="8" fill="#4a3868"/><rect x="6" y="39" width="7" height="9" fill="#3a2c52"/><rect x="19" y="39" width="7" height="9" fill="#3a2c52"/>`;
      img.replaceWith(v);
      g.classList.add("lb-pj-prov");
    });
    const cuerpo = pasea ? el("g", { class: "lb-pj-cuerpo" }) : null;
    if (cuerpo) cuerpo.append(img, ...extras); else g.append(img, ...extras);
    // El nombre solo aparece con el cursor, el foco o un toque (css/lobby.css)
    const nombre = String(p.nombre || "").slice(0, 14);
    const ancho = nombre.length * 9 + 16;
    const etiqueta = el("g", { class: "lb-pj-etiqueta", "pointer-events": "none" });
    etiqueta.append(el("rect", { x: px - ancho / 2, y: py - h - 20, width: ancho, height: 18, fill: "#120d19", opacity: ".88" }));
    const t = el("text", { x: px, y: py - h - 7, "text-anchor": "middle", class: "lb-mesa-nombre" });
    t.textContent = nombre;
    etiqueta.append(t);
    if (cuerpo) { const pos = el("g", { class: "lb-pj-pos", transform: `translate(${puesto.x} ${puesto.y})` }); pos.append(cuerpo, etiqueta); g.append(pos); } else g.append(etiqueta);
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

  /* ------------------------------------------------------------------ quien pasea
     Un protagonista con pasea: true (data/protagonistas.js) no se queda siempre en su sitio: de vez en cuando se levanta, da una vuelta a saltitos
     y tambaleándose por el suelo despejado de la sala (sin pisar ningún objeto con enlace), a veces hace un barrel roll y al rato vuelve a sentarse.
     Mientras camina no recibe clics (pointer-events: none) y va por detrás de la mesa, así que nunca tapa nada. Con «reducir movimiento» se queda sentado.
     index.html?paseo=rapido acorta lo que tarda en levantarse la primera vez (para probar). */
  const PASEO = { x0: 420, x1: 950, y0: 498, y1: 546 };      // el suelo libre entre la máquina de Minijuegos y el puesto de Intercambios
  const RAPIDO = /[?&]paseo=rapido\b/.test(location.search);
  const reducido = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const azar = (a, b) => a + Math.random() * (b - a);

  function iniciarPaseo(nodo, puesto, info, capaPuesto, capaPaseo) {
    const pos = nodo.querySelector(".lb-pj-pos"), cuerpo = nodo.querySelector(".lb-pj-cuerpo");
    const alto = info.alto || SPRITE.h * SPRITE.escala;
    let x = puesto.x, y = puesto.y, dir = puesto.x < 640 ? -1 : 1;     // dir 1: mira a la izquierda (como se dibujó el PNG); -1: a la derecha
    let estado = "sentado", resto = RAPIDO ? 1.5 : azar(6, 12), legs = 0, meta = null, fase = 0, t = 0, rueda = null, previo = 0, raf = 0;

    function pintar(salto, sqx, sqy, bamb, rodar) {
      const esc = Math.min(1, 0.86 + Math.max(0, y - PASEO.y0) / (PASEO.y1 - PASEO.y0) * 0.14), c = alto * esc / 2;
      pos.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      cuerpo.setAttribute("transform", `translate(0 ${(-salto).toFixed(1)}) rotate(${bamb.toFixed(1)}) translate(0 ${-c.toFixed(1)}) rotate(${rodar.toFixed(1)}) translate(0 ${c.toFixed(1)}) scale(${(dir * esc * sqx).toFixed(3)} ${(esc * sqy).toFixed(3)})`);
    }
    function camina(activo) { nodo.classList.toggle("lb-pj-camina", activo); }
    function nuevaMeta() { return { x: azar(PASEO.x0, PASEO.x1), y: azar(PASEO.y0, PASEO.y1) }; }
    function tirarse(corto) { rueda = { u: 0, dur: corto ? 0.9 : 1.15, alto: corto ? 34 : 46, avance: corto ? 0 : 70 * (Math.random() < 0.5 ? -1 : 1) }; }

    function paso(ahora) {
      raf = requestAnimationFrame(paso);
      const dt = Math.min(0.1, (ahora - (previo || ahora)) / 1000); previo = ahora; t += dt;
      let salto = 0, sqx = 1, sqy = 1, bamb = 0, rodar = 0;
      if (rueda) {                                                  // barrel roll: un salto con una vuelta entera, avanzando un poco si va de paseo
        rueda.u += dt / rueda.dur;
        const u = Math.min(1, rueda.u), suave = u * u * (3 - 2 * u);
        // bajo la radio y el tablón de Mis personajes (que llegan hasta y = 376) la vuelta salta menos para no pasar por encima de ellos
        const tope = x < 480 || (x > 540 && x < 770) || x > 890 ? Math.max(6, y - 515) : rueda.alto;
        salto = Math.min(rueda.alto, tope) * Math.sin(Math.PI * u); rodar = 360 * suave * (rueda.avance < 0 ? -1 : 1);
        if (rueda.avance && estado !== "sentado") {
          x = Math.max(PASEO.x0, Math.min(PASEO.x1, x + rueda.avance / rueda.dur * dt));
          dir = rueda.avance < 0 ? 1 : -1;
        }
        sqy = 1 + 0.08 * Math.sin(Math.PI * u); sqx = 1 - 0.05 * Math.sin(Math.PI * u);
        if (rueda.u >= 1) { rueda = null; rodar = 0; }
      } else if (estado === "sentado") {
        sqy = 1 + 0.025 * Math.sin(t * 2.4); bamb = Math.sin(t * 1.6) * 1.8;
        resto -= dt;
        if (resto <= 0) { estado = "paseo"; legs = Math.floor(azar(3, 7)); meta = nuevaMeta(); resto = 0; capaPaseo.append(nodo); camina(true); }
      } else if (estado === "paseo" || estado === "volver") {
        const dx = meta.x - x, dy = meta.y - y, dist = Math.hypot(dx, dy);
        if (resto > 0) {                                            // parada entre tramos: respira y se bambolea
          resto -= dt; sqy = 1 + 0.03 * Math.sin(t * 2.6); bamb = Math.sin(t * 1.9) * 3;
          if (resto <= 0 && estado === "paseo" && Math.random() < 0.4) tirarse(false);
        } else if (dist < 3) {
          if (estado === "volver") {                                // llega al banco: se sienta
            x = puesto.x; y = puesto.y; capaPuesto.append(nodo); camina(false); estado = "sentado"; resto = azar(25, 45); tirarse(true);
          } else if (--legs > 0) { meta = nuevaMeta(); resto = azar(0.8, 2.4); }
          else { estado = "volver"; meta = { x: puesto.x, y: puesto.y }; resto = azar(0.6, 1.4); }
        } else {
          fase += dt * 8.5;
          const s = Math.abs(Math.sin(fase)), vel = 78 * s;
          x += dx / dist * Math.min(dist, vel * dt); y += dy / dist * Math.min(dist, vel * dt);
          if (Math.abs(dx) > 4) dir = dx < 0 ? 1 : -1;
          salto = s * 12; sqy = 0.86 + 0.2 * s; sqx = 1.14 - 0.18 * s;
          bamb = Math.sin(t * 3.4) * 6 + Math.sin(fase) * 3;        // tambaleo
        }
      }
      pintar(salto, sqx, sqy, bamb, rodar);
    }

    pintar(0, 1, 1, 0, 0);
    if (!reducido()) raf = requestAnimationFrame(paso);
    return {
      parar: () => cancelAnimationFrame(raf),
      girar: () => { if (estado === "sentado" && !rueda && !reducido()) tirarse(true); }
    };
  }

  function fijar(lista) {
    if (!atras || !lados || !jarras || !aviso) return;
    const presentes = new Map((lista || []).map(p => [p.id, p]));
    // Se levantan los que ya no están
    for (const [id, s] of sentados) {
      if (!presentes.has(id)) { if (s.actor) s.actor.parar(); s.nodo.remove(); s.jarra.remove(); sentados.delete(id); }
    }
    // Se sientan los nuevos en el primer puesto libre
    const ocupados = new Set([...sentados.values()].map(s => s.puesto));
    let i = sentados.size;
    for (const p of presentes.values()) {
      const ya = sentados.get(p.id);
      if (ya) { ya.nodo.classList.toggle("lb-pj-lejos", !!p.oculto); continue; }
      const info = (window.PROTAGONISTAS || {})[clave(p.nombre)] || null;
      let libre = PUESTOS.findIndex((_, k) => !ocupados.has(k));
      if (info && info.pasea) { const k = PUESTOS.findIndex((u, n) => !ocupados.has(n) && u.capa === "atras"); if (k >= 0) libre = k; }   // el que pasea vuelve siempre al banco
      if (libre < 0) continue;
      ocupados.add(libre);
      const nodo = crearNodo(p, PUESTOS[libre], i), jarra = crearJarra(PUESTOS[libre], i);
      i++;
      nodo.classList.toggle("lb-pj-lejos", !!p.oculto);
      const capa = PUESTOS[libre].capa === "atras" ? atras : lados;
      capa.append(nodo);
      jarras.append(jarra);
      const actor = info && info.sprite && info.pasea && paseo ? iniciarPaseo(nodo, PUESTOS[libre], info, capa, paseo) : null;
      if (actor) nodo.addEventListener("click", actor.girar);
      sentados.set(p.id, { puesto: libre, nodo, jarra, actor });
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
    // Capa por la que se pasea: por encima del suelo y el banco, por debajo de quien está sentado y de la mesa
    paseo = document.createElementNS(NS, "g"); paseo.id = "lbMesaPaseo";
    atras.parentNode.insertBefore(paseo, atras);
    if (modoPrueba()) {
      const n = Math.max(1, Math.min(7, parseInt((location.search.match(/[?&]n=(\d+)/) || [])[1], 10) || 3));
      fijar(Array.from({ length: n }, (_, k) => ({ id: "prueba-" + k, nombre: `Prueba ${k + 1}`, oculto: false, prueba: true })));
    }
  }

  window.TabernaMesa = { fijar: lista => { if (!modoPrueba()) fijar(lista); }, PUESTOS, SPRITE };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
