/* Editor del mapa vectorial (solo Admin). El visor lo carga al pulsar «Editar mapa».
   Trabaja sobre el mismo documento que dibuja el visor (window.mapaVectorial.interno.mundo()):
   cada cambio guarda una instantánea para deshacer, modifica el documento y pide al visor que se redibuje.
   Guardar sube el documento a Supabase (tabla mapa_mundo) con la versión de partida, para no pisar a otro Admin. */
(function () {
  const MV = window.mapaVectorial && window.mapaVectorial.interno;
  if (!MV) return;
  const NS = "http://www.w3.org/2000/svg";
  const { svg, marco } = MV;
  const doc = () => MV.mundo();
  const r2 = v => Math.round(v * 100) / 100;
  const r4 = v => Math.round(v * 4) / 4;
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const nuevoId = p => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const el = (tag, attrs, padre) => { const e = document.createElementNS(NS, tag); if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); if (padre) padre.appendChild(e); return e; };
  const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  // ---------- Estado ----------
  let activo = false, herramienta = "mover", seleccion = null, base = "", ocupado = false;
  const pila = [], rehacerPila = [];
  let capaEd = null, ui = null;
  let dibujo = null; // { tipo: "linea"|"area", sub, p: [] }
  let opciones = { lineaTipo: "rios", areaTipo: "lago", relieveTipo: "mount-1", relieveTam: 16, pincel: false };

  const HERRAMIENTAS = [
    { id: "mover", tecla: "V", nombre: "Seleccionar y mover", ayuda: "Pulsa algo para editarlo. Arrastra nombres, relieve y lugares para moverlos.", icono: '<path d="M4 2l9 6-4 1 3 5-2 1-3-5-3 3z"/>' },
    { id: "vertices", tecla: "A", nombre: "Costas, fronteras y líneas", ayuda: "Pulsa una costa, frontera, río, camino o ruta. Arrastra sus puntos. Doble clic en la línea añade un punto; Mayús+clic en un punto lo quita.", icono: '<path d="M2 12 6 4l4 6 4-7"/><circle cx="2" cy="12" r="1.4"/><circle cx="6" cy="4" r="1.4"/><circle cx="10" cy="10" r="1.4"/><circle cx="14" cy="3" r="1.4"/>' },
    { id: "region", tecla: "R", nombre: "Reinos y territorios", ayuda: "Pulsa un territorio para cambiar nombre, color o ficha, o para pasar una isla a otro reino.", icono: '<path d="M2 4l5-2 7 3-1 8-6 1-5-3z"/><path d="M7 2l1 6 5 5" opacity=".6"/>' },
    { id: "etiqueta", tecla: "T", nombre: "Nombres", ayuda: "Pulsa en el mapa para poner un nombre nuevo, o pulsa uno para editarlo.", icono: '<path d="M3 3h10M8 3v10M5.5 13h5"/>' },
    { id: "relieve", tecla: "M", nombre: "Relieve y vegetación", ayuda: "Elige un dibujo y pulsa en el mapa. Con el pincel, arrastra para pintar varios.", icono: '<path d="M1 13l4-7 3 4 2-3 5 6z"/>' },
    { id: "linea", tecla: "L", nombre: "Dibujar ríos, caminos y rutas", ayuda: "Pulsa para poner puntos. Doble clic o Intro termina; Retroceso quita el último; Esc cancela.", icono: '<path d="M2 13c3-1 2-5 5-6s4 2 7-4"/>' },
    { id: "area", tecla: "O", nombre: "Dibujar lagos y regiones", ayuda: "Pulsa para poner los puntos del contorno. Doble clic o Intro lo cierra.", icono: '<path d="M3 9c0-4 4-6 7-5s4 4 3 6-4 4-7 3-3-2-3-4z"/>' }
  ];
  const RELIEVE_TIPOS = [
    ["mount-1", "Montaña"], ["mount-3", "Montaña"], ["mount-5", "Pico"], ["mountSnow-1", "Montaña nevada"], ["mountSnow-3", "Nevada"], ["hill-1", "Colina"], ["hill-3", "Colinas"],
    ["vulcan-1", "Volcán"], ["vulcan-2", "Volcán dormido"], ["deciduous-1", "Bosque"], ["deciduous-2", "Árbol"], ["conifer-1", "Conífera"], ["coniferSnow-1", "Conífera nevada"],
    ["palm-1", "Palmera"], ["acacia-1", "Acacia"], ["deadTree-1", "Árbol seco"], ["dune-1", "Dunas"], ["cactus-1", "Cactus"], ["swamp-1", "Pantano"], ["grass-1", "Pradera"]
  ];
  const LINEAS = { rios: "Río", caminos: "Camino", rutas: "Ruta marítima" };
  const TIPOS_ETIQUETA = { estado: "Reino", provincia: "Provincia", region: "Región", mar: "Mar u océano", accidente: "Accidente (cordillera, lago...)" };

  // ---------- Deshacer / rehacer ----------
  const foto = () => JSON.stringify(doc());
  function antes() { pila.push(foto()); if (pila.length > 80) pila.shift(); rehacerPila.length = 0; }
  function despues() { MV.reconstruir(); redibujar(); estadoCambios(); }
  function deshacer() { if (!pila.length) return; rehacerPila.push(foto()); MV.reemplazar(JSON.parse(pila.pop())); seleccion = validarSeleccion(); redibujar(); estadoCambios(); }
  function rehacer() { if (!rehacerPila.length) return; pila.push(foto()); MV.reemplazar(JSON.parse(rehacerPila.pop())); seleccion = validarSeleccion(); redibujar(); estadoCambios(); }
  const hayCambios = () => JSON.stringify(normalizadoDe(doc())) !== base;

  // ---------- Utilidades de geometría ----------
  const geo = () => doc().geografia;
  function coleccion(c) {
    const g = geo(), l = doc().lineas;
    if (c === "arcos") return g.arcos; if (c === "lagosExtra") return (g.lagosExtra = g.lagosExtra || []);
    if (c === "regionesExtra") return (g.regionesExtra = g.regionesExtra || []);
    return l[c] = l[c] || [];
  }
  const esCerrado = (c, o) => c === "lagosExtra" || c === "regionesExtra" || (c === "arcos" && o.p.length > 4 && o.p[0] === o.p[o.p.length - 2] && o.p[1] === o.p[o.p.length - 1]);
  function dLinea(c, o) {
    if (c === "arcos" && o.tipo === "borde") { let d = `M${o.p[0]} ${o.p[1]}`; for (let i = 2; i < o.p.length; i += 2) d += `L${o.p[i]} ${o.p[i + 1]}`; return d; }
    if (c === "lagosExtra" || c === "regionesExtra") return MV.dSegs(MV.segmentos(o.p.concat([o.p[0], o.p[1]]), true), true) + "Z";
    return MV.dSegs(MV.segmentos(o.p, esCerrado(c, o)), true);
  }
  function distSeg(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy; let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - t * dx, py - ay - t * dy); }
  function dentro(x, y, p) { let c = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) { const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
  function anilloPuntos(an) { const A = geo().arcos, r = []; for (const k of an) { const p = A[k < 0 ? -k - 1 : k].p; if (k >= 0) for (let i = 0; i < p.length; i += 2) r.push(p[i], p[i + 1]); else for (let i = p.length - 2; i >= 0; i -= 2) r.push(p[i], p[i + 1]); } return r; }
  const radio = () => 5.5 / MV.pxPorUnidad();

  // ---------- Selección ----------
  // seleccion: { tipo: "etiqueta"|"relieve"|"lugar"|"region"|"linea", id, col, idx, anillo }
  function validarSeleccion() {
    if (!seleccion) return null; const d = doc();
    if (seleccion.tipo === "etiqueta") return d.etiquetas.some(e => e.id === seleccion.id) ? seleccion : null;
    if (seleccion.tipo === "relieve") return d.relieve.some(e => e.id === seleccion.id) ? seleccion : null;
    if (seleccion.tipo === "linea") return coleccion(seleccion.col)[seleccion.idx] ? seleccion : null;
    if (seleccion.tipo === "region") return buscarRegion(seleccion.id) ? seleccion : null;
    return seleccion;
  }
  function buscarRegion(id) { const g = geo(); return g.estados.find(e => e.id === id) || g.neutrales.find(e => e.id === id) || (g.regionesExtra || []).find(e => e.id === id); }
  function seleccionar(s) { seleccion = s; redibujar(); }

  // ---------- Capa del editor (encima del mapa) ----------
  function redibujar() {
    if (!activo) return;
    if (capaEd && capaEd.parentNode !== svg) capaEd = null;
    if (!capaEd) capaEd = el("g", { class: "ed-capa" }, svg);
    else svg.appendChild(capaEd);
    capaEd.innerHTML = "";
    svg.querySelectorAll(".ed-sel").forEach(n => n.classList.remove("ed-sel"));
    const R = radio();
    if (herramienta === "vertices") {
      // todas las líneas que se pueden editar, con un trazo ancho e invisible para poder pulsarlas
      const g = el("g", { class: "ed-lineas" }, capaEd);
      for (const c of ["arcos", "rios", "caminos", "rutas", "lagosExtra", "regionesExtra"]) {
        coleccion(c).forEach((o, idx) => {
          if (c === "arcos" && o.tipo === "borde") return;
          const sel = seleccion && seleccion.tipo === "linea" && seleccion.col === c && seleccion.idx === idx;
          el("path", { d: dLinea(c, o), class: "ed-linea ed-linea-" + (c === "arcos" ? o.tipo : c) + (sel ? " ed-linea-sel" : ""), "data-col": c, "data-idx": idx }, g);
        });
      }
    }
    if (seleccion) {
      const s = seleccion;
      if (s.tipo === "linea") {
        const o = coleccion(s.col)[s.idx];
        el("path", { d: dLinea(s.col, o), class: "ed-resalte-linea" }, capaEd);
        const hs = el("g", { class: "ed-puntos" }, capaEd);
        const n = o.p.length / 2, cerrado = esCerrado(s.col, o);
        for (let i = 0; i < n; i++) {
          if (cerrado && s.col === "arcos" && i === n - 1) continue;
          const extremo = s.col === "arcos" && !cerrado && (i === 0 || i === n - 1);
          el("circle", { cx: o.p[i * 2], cy: o.p[i * 2 + 1], r: extremo ? R * 1.25 : R, class: "ed-punto" + (extremo ? " ed-punto-nodo" : ""), "data-i": i }, hs);
        }
      } else if (s.tipo === "region") {
        const reg = buscarRegion(s.id); if (reg) {
          const d = reg.anillos ? reg.anillos.map(an => { const p = anilloPuntos(an); return "M" + p.join(" ") + "Z"; }).join("") : "M" + reg.p.join(" ") + "Z";
          el("path", { d, class: "ed-resalte-region", "fill-rule": "evenodd" }, capaEd);
          if (s.anillo != null && reg.anillos && reg.anillos[s.anillo]) el("path", { d: "M" + anilloPuntos(reg.anillos[s.anillo]).join(" ") + "Z", class: "ed-resalte-trozo" }, capaEd);
        }
      } else {
        const n = s.tipo === "etiqueta" ? svg.querySelector(`.mv-etiqueta[data-id="${s.id}"]`) : s.tipo === "relieve" ? svg.querySelector(`.mv-capa-relieve use[data-id="${s.id}"]`) : svg.querySelector(`.mv-lugar[data-lugar-id="${s.id}"]`);
        if (n) n.classList.add("ed-sel");
      }
    }
    if (dibujo && dibujo.p.length) {
      const p = dibujo.p; let d = "M" + p.slice(0, 2).join(" "); for (let i = 2; i < p.length; i += 2) d += "L" + p[i] + " " + p[i + 1];
      if (dibujo.cursor) d += "L" + dibujo.cursor.join(" ");
      if (dibujo.tipo === "area" && p.length >= 4) d += "Z";
      el("path", { d, class: "ed-dibujo ed-dibujo-" + dibujo.tipo }, capaEd);
      for (let i = 0; i < p.length; i += 2) el("circle", { cx: p[i], cy: p[i + 1], r: R * 0.8, class: "ed-dibujo-punto" }, capaEd);
    }
    pintarPanel();
  }
  function ajustarTamanos() {
    if (!capaEd) return; const R = radio();
    capaEd.querySelectorAll(".ed-punto").forEach(c => c.setAttribute("r", c.classList.contains("ed-punto-nodo") ? R * 1.25 : R));
    capaEd.querySelectorAll(".ed-dibujo-punto").forEach(c => c.setAttribute("r", R * 0.8));
  }

  // ---------- Interacción con el puntero ----------
  let inicioPuntero = null, arrastre = null;
  function onDown(e) {
    if (!activo || e.button !== 0) return;
    inicioPuntero = { x: e.clientX, y: e.clientY };
    const t = e.target;
    const [mx, my] = MV.aMapa(e.clientX, e.clientY);
    // punto de una línea seleccionada
    if (t.classList && t.classList.contains("ed-punto")) {
      e.stopPropagation(); e.preventDefault();
      const s = seleccion, o = coleccion(s.col)[s.idx], i = +t.dataset.i;
      if (e.shiftKey) { quitarPunto(s, i); return; }
      const compartidos = [];
      if (s.col === "arcos") { // un extremo de arco lo comparten otros arcos: se mueven juntos
        const x0 = o.p[i * 2], y0 = o.p[i * 2 + 1];
        geo().arcos.forEach((a, k) => { for (let j = 0; j < a.p.length; j += 2) if (a.p[j] === x0 && a.p[j + 1] === y0 && !(k === s.idx && j === i * 2)) compartidos.push([k, j]); });
      }
      arrastre = { tipo: "punto", s, i, compartidos, foto: foto(), movido: false };
      return;
    }
    if (herramienta === "mover") {
      const et = t.closest && t.closest(".mv-etiqueta");
      const rel = t.closest && t.closest(".mv-capa-relieve use");
      const lug = t.closest && t.closest(".mv-lugar");
      let obj = null;
      if (lug) obj = { tipo: "lugar", id: lug.dataset.lugarId, nodo: lug };
      else if (et) obj = { tipo: "etiqueta", id: et.dataset.id, nodo: et };
      else if (rel) obj = { tipo: "relieve", id: rel.dataset.id, nodo: rel };
      if (obj) { e.stopPropagation(); e.preventDefault(); arrastre = { ...obj, x0: mx, y0: my, foto: foto(), movido: false }; return; }
    }
    if (herramienta === "relieve" && opciones.pincel) {
      e.stopPropagation(); e.preventDefault(); antes(); arrastre = { tipo: "pincel", ultimo: null, puestos: 0 }; pintarRelieve(mx, my); return;
    }
  }
  function onMove(e) {
    if (!activo) return;
    const [mx, my] = MV.aMapa(e.clientX, e.clientY);
    if (dibujo && !arrastre) { dibujo.cursor = [r4(mx), r4(my)]; const path = capaEd && capaEd.querySelector(".ed-dibujo"); if (path) { const p = dibujo.p; let d = "M" + p.slice(0, 2).join(" "); for (let i = 2; i < p.length; i += 2) d += "L" + p[i] + " " + p[i + 1]; d += "L" + dibujo.cursor.join(" "); if (dibujo.tipo === "area" && p.length >= 4) d += "Z"; path.setAttribute("d", d); } }
    if (!arrastre) return;
    if (inicioPuntero && !arrastre.movido && Math.hypot(e.clientX - inicioPuntero.x, e.clientY - inicioPuntero.y) < 3) return;
    arrastre.movido = true;
    if (arrastre.tipo === "punto") {
      const o = coleccion(arrastre.s.col)[arrastre.s.idx], i = arrastre.i, x = r4(mx), y = r4(my);
      o.p[i * 2] = x; o.p[i * 2 + 1] = y;
      if (esCerrado(arrastre.s.col, o) && arrastre.s.col === "arcos" && i === 0) { o.p[o.p.length - 2] = x; o.p[o.p.length - 1] = y; }
      for (const [k, j] of arrastre.compartidos) { geo().arcos[k].p[j] = x; geo().arcos[k].p[j + 1] = y; }
      const c = capaEd.querySelector(`.ed-punto[data-i="${i}"]`); if (c) { c.setAttribute("cx", x); c.setAttribute("cy", y); }
      const r = capaEd.querySelector(".ed-resalte-linea"); if (r) r.setAttribute("d", dLinea(arrastre.s.col, o));
      return;
    }
    if (arrastre.tipo === "pincel") { pintarRelieve(mx, my); return; }
    const dx = mx - arrastre.x0, dy = my - arrastre.y0;
    if (arrastre.tipo === "relieve") arrastre.nodo.setAttribute("transform", `translate(${r2(dx)} ${r2(dy)})`);
    else if (arrastre.tipo === "etiqueta") { const e2 = doc().etiquetas.find(x => x.id === arrastre.id); arrastre.nodo.setAttribute("transform", `translate(${r2(e2.x + dx)} ${r2(e2.y + dy)}) rotate(${e2.a || 0})`); }
    else if (arrastre.tipo === "lugar") { const [x, y] = posLugar(arrastre.id); arrastre.nodo.setAttribute("transform", `translate(${r2(x + dx)} ${r2(y + dy)})`); }
  }
  function onUp(e) {
    if (!activo || !arrastre) return;
    const a = arrastre; arrastre = null;
    const [mx, my] = MV.aMapa(e.clientX, e.clientY);
    if (a.tipo === "pincel") { if (!a.puestos) pila.pop(); despues(); return; }
    if (!a.movido) { // fue un clic: seleccionar
      if (a.tipo === "punto") return;
      seleccionar({ tipo: a.tipo, id: a.id }); return;
    }
    pila.push(a.foto); if (pila.length > 80) pila.shift(); rehacerPila.length = 0;
    const dx = mx - a.x0, dy = my - a.y0;
    if (a.tipo === "etiqueta") { const e2 = doc().etiquetas.find(x => x.id === a.id); e2.x = r2(e2.x + dx); e2.y = r2(e2.y + dy); seleccion = { tipo: "etiqueta", id: a.id }; }
    else if (a.tipo === "relieve") { const r = doc().relieve.find(x => x.id === a.id); r.x = r2(r.x + dx); r.y = r2(r.y + dy); seleccion = { tipo: "relieve", id: a.id }; }
    else if (a.tipo === "lugar") { const [x, y] = posLugar(a.id); doc().posiciones = doc().posiciones || {}; doc().posiciones[a.id] = [r2(x + dx), r2(y + dy)]; seleccion = { tipo: "lugar", id: a.id }; }
    despues();
  }
  function posLugar(id) {
    const d = doc(); if (d.posiciones && d.posiciones[id]) return d.posiciones[id];
    const p = (window.MAPA_PUNTOS || []).find(q => q.lugarId === id); return p ? [p.x / 100 * d.ancho, p.y / 100 * d.alto] : [0, 0];
  }
  function pintarRelieve(x, y) {
    const sep = opciones.relieveTam * (opciones.pincel ? 0.75 : 0);
    if (arrastre && arrastre.ultimo && Math.hypot(x - arrastre.ultimo[0], y - arrastre.ultimo[1]) < sep) return;
    const jit = opciones.pincel ? opciones.relieveTam * 0.25 : 0;
    const t = opciones.relieveTipo === "mezcla-montes" ? ["mount-1", "mount-3", "mount-4", "mount-5"][Math.floor(Math.random() * 4)] : opciones.relieveTipo === "mezcla-bosque" ? ["deciduous-1", "deciduous-2", "conifer-1"][Math.floor(Math.random() * 3)] : opciones.relieveTipo;
    const r = { t, x: r2(x + (Math.random() - .5) * jit), y: r2(y + (Math.random() - .5) * jit), s: r2(opciones.relieveTam * (opciones.pincel ? 0.85 + Math.random() * 0.3 : 1)), id: nuevoId("rel") };
    doc().relieve.push(r); doc().relieve.sort((a, b) => a.y - b.y);
    if (arrastre) { arrastre.ultimo = [x, y]; arrastre.puestos++; const u = el("use", { href: "#r-" + r.t, x: r.x - r.s / 2, y: r.y - r.s * 0.8, width: r.s, height: r.s }, capaEd); u.classList.add("ed-provisional"); }
    return r;
  }
  function onClick(e) {
    if (!activo) return;
    if (inicioPuntero && Math.hypot(e.clientX - inicioPuntero.x, e.clientY - inicioPuntero.y) > 4) return; // fue un arrastre
    if (e.target.closest && e.target.closest(".ed-panel, .ed-barra, .ed-herramientas, .mv-controles, .mv-capas")) return;
    const [mx, my] = MV.aMapa(e.clientX, e.clientY);
    const t = e.target;
    if (herramienta === "vertices") {
      const ln = t.closest && t.closest(".ed-linea");
      if (ln) seleccionar({ tipo: "linea", col: ln.dataset.col, idx: +ln.dataset.idx });
      else if (!(t.classList && t.classList.contains("ed-punto"))) seleccionar(null);
      return;
    }
    if (herramienta === "region") {
      const reg = t.closest && t.closest(".mv-region-clic, .mv-neutral");
      if (!reg) { seleccionar(null); return; }
      const r = buscarRegion(reg.dataset.id); let anillo = null;
      if (r && r.anillos) r.anillos.forEach((an, k) => { if (dentro(mx, my, anilloPuntos(an))) anillo = k; });
      seleccionar({ tipo: "region", id: reg.dataset.id, anillo });
      return;
    }
    if (herramienta === "etiqueta") {
      const et = t.closest && t.closest(".mv-etiqueta");
      if (et) { seleccionar({ tipo: "etiqueta", id: et.dataset.id }); return; }
      antes();
      const nueva = { id: nuevoId("et"), tipo: "accidente", l: ["Nombre nuevo"], x: r2(mx), y: r2(my), a: 0, t: 14, s: 1.15, c: 0 };
      doc().etiquetas.push(nueva); seleccion = { tipo: "etiqueta", id: nueva.id }; despues();
      setTimeout(() => { const ta = ui.panel.querySelector("[data-campo='l']"); if (ta) { ta.focus(); ta.select(); } }, 30);
      return;
    }
    if (herramienta === "relieve") {
      if (opciones.pincel) return;
      const rel = t.closest && t.closest(".mv-capa-relieve use");
      if (rel && e.altKey) { seleccionar({ tipo: "relieve", id: rel.dataset.id }); return; }
      antes(); const r = pintarRelieve(mx, my); seleccion = { tipo: "relieve", id: r.id }; despues(); return;
    }
    if (herramienta === "linea" || herramienta === "area") {
      if (e.detail >= 2) return; // el doble clic lo termina (dblclick)
      if (!dibujo) dibujo = { tipo: herramienta, sub: herramienta === "linea" ? opciones.lineaTipo : opciones.areaTipo, p: [] };
      dibujo.p.push(r4(mx), r4(my)); redibujar(); return;
    }
    if (herramienta === "mover") {
      const reg = t.closest && t.closest(".mv-region-clic, .mv-neutral");
      if (reg && !t.closest(".mv-lugar, .mv-etiqueta")) seleccionar({ tipo: "region", id: reg.dataset.id, anillo: null });
      else if (!t.closest(".mv-lugar, .mv-etiqueta, .mv-capa-relieve use")) seleccionar(null);
    }
  }
  function onDblClick(e) {
    if (!activo) return;
    e.stopPropagation(); e.preventDefault();
    if (dibujo) { terminarDibujo(); return; }
    if (herramienta === "vertices" && seleccion && seleccion.tipo === "linea") {
      const [mx, my] = MV.aMapa(e.clientX, e.clientY);
      const o = coleccion(seleccion.col)[seleccion.idx]; const p = o.p; let mejor = null;
      const n = p.length / 2, cerrado = seleccion.col === "lagosExtra" || seleccion.col === "regionesExtra";
      for (let i = 0; i < (cerrado ? n : n - 1); i++) { const j = (i + 1) % n; const d = distSeg(mx, my, p[i * 2], p[i * 2 + 1], p[j * 2], p[j * 2 + 1]); if (!mejor || d < mejor.d) mejor = { d, i }; }
      if (mejor && mejor.d < 12 / MV.pxPorUnidad()) { antes(); p.splice(mejor.i * 2 + 2, 0, r4(mx), r4(my)); despues(); }
    }
  }
  function quitarPunto(s, i) {
    const o = coleccion(s.col)[s.idx], n = o.p.length / 2, cerrado = esCerrado(s.col, o);
    if (s.col === "arcos" && !cerrado && (i === 0 || i === n - 1)) { aviso("Ese punto une varias líneas y no se puede quitar. Muévelo."); return; }
    const minimo = s.col === "lagosExtra" || s.col === "regionesExtra" ? 3 : cerrado ? 4 : 2;
    if (n - 1 < minimo) { aviso("La línea se quedaría sin forma. Si quieres quitarla entera, usa «Borrar»."); return; }
    antes(); o.p.splice(i * 2, 2);
    if (s.col === "arcos" && cerrado && i === 0) { o.p[o.p.length - 2] = o.p[0]; o.p[o.p.length - 1] = o.p[1]; }
    despues();
  }
  function terminarDibujo() {
    const d = dibujo; dibujo = null;
    if (!d) return;
    const min = d.tipo === "area" ? 6 : 4;
    if (d.p.length < min) { aviso(d.tipo === "area" ? "Un área necesita al menos 3 puntos." : "Una línea necesita al menos 2 puntos."); redibujar(); return; }
    antes();
    if (d.tipo === "linea") { const lista = coleccion(d.sub); lista.push({ id: nuevoId(d.sub.replace(/s$/, "")), p: d.p }); seleccion = { tipo: "linea", col: d.sub, idx: lista.length - 1 }; }
    else if (d.sub === "lago") { const lista = coleccion("lagosExtra"); lista.push({ id: nuevoId("lago"), p: d.p }); seleccion = { tipo: "linea", col: "lagosExtra", idx: lista.length - 1 }; }
    else { const lista = coleccion("regionesExtra"); const r = { id: nuevoId("region"), nombre: "Región nueva", color: "#d9c9a3", p: d.p }; lista.push(r); seleccion = { tipo: "region", id: r.id }; }
    despues();
  }

  // ---------- Borrar ----------
  function borrarSeleccion() {
    const s = seleccion; if (!s) return;
    if (s.tipo === "etiqueta") { antes(); doc().etiquetas = doc().etiquetas.filter(e => e.id !== s.id); }
    else if (s.tipo === "relieve") { antes(); doc().relieve = doc().relieve.filter(e => e.id !== s.id); }
    else if (s.tipo === "linea") {
      if (s.col === "arcos") { aviso("Las costas y fronteras no se borran: mueve sus puntos. Así ningún reino se queda sin borde."); return; }
      if (!confirm("¿Borrar esta línea entera?")) return;
      antes(); coleccion(s.col).splice(s.idx, 1);
    }
    else if (s.tipo === "region") {
      const extra = (geo().regionesExtra || []).find(r => r.id === s.id);
      if (!extra) { aviso("Los reinos del mapa no se borran: cambia su nombre, su color o pasa sus islas a otro reino."); return; }
      if (!confirm(`¿Borrar la región «${extra.nombre}»?`)) return;
      antes(); geo().regionesExtra = geo().regionesExtra.filter(r => r.id !== s.id);
    }
    else if (s.tipo === "lugar") { if (!doc().posiciones || !doc().posiciones[s.id]) return; antes(); delete doc().posiciones[s.id]; }
    seleccion = null; despues();
  }

  // ---------- Panel lateral (inspector) ----------
  const VER = { todos: "Todos", A: "Solo Side A", B: "Solo Side B", dm: "Solo el DM" };
  const campoVer = (v, attr) => campo("Visible para", `<select ${attr}="ver">${Object.entries(VER).map(([k, n]) => `<option value="${k}"${(v || "todos") === k ? " selected" : ""}>${n}</option>`).join("")}</select>`);
  function campo(etiqueta, html) { return `<label class="ed-campo"><span>${etiqueta}</span>${html}</label>`; }
  function opcionesLugares(sel) {
    const lugares = (typeof ALL_ENTRIES !== "undefined" ? ALL_ENTRIES : []).filter(e => e.category === "Lugares").sort((a, b) => a.title.localeCompare(b.title));
    return `<option value="">— sin ficha —</option>` + lugares.map(l => `<option value="${esc(l.id)}"${l.id === sel ? " selected" : ""}>${esc(l.title)}</option>`).join("");
  }
  function pintarPanel() {
    if (!ui) return;
    const s = seleccion, p = ui.panel, hm = HERRAMIENTAS.find(x => x.id === herramienta);
    let html = `<h3>${esc(hm.nombre)}</h3><p class="ed-ayuda">${esc(hm.ayuda)}</p>`;
    if (herramienta === "relieve") {
      html += `<div class="ed-paleta">${[["mezcla-montes", "Cordillera (mezcla)", "mount-3"], ["mezcla-bosque", "Bosque (mezcla)", "deciduous-1"]].concat(RELIEVE_TIPOS.map(([t, n]) => [t, n, t])).map(([t, n, ic]) => `<button type="button" class="ed-icono${opciones.relieveTipo === t ? " activo" : ""}" data-relieve="${t}" title="${esc(n)}"><svg viewBox="0 0 10 10"><use href="#r-${ic}" x="0" y="0" width="10" height="10"/></svg></button>`).join("")}</div>`;
      html += campo("Tamaño", `<input type="range" min="6" max="40" step="1" value="${opciones.relieveTam}" data-op="relieveTam"><output>${opciones.relieveTam}</output>`);
      html += `<label class="ed-check"><input type="checkbox" data-op="pincel"${opciones.pincel ? " checked" : ""}> Pincel: arrastra para pintar varios</label><p class="ed-ayuda">Alt+clic en un dibujo lo selecciona.</p>`;
    }
    if (herramienta === "linea") html += campo("Qué dibujas", `<select data-op="lineaTipo">${Object.entries(LINEAS).map(([k, v]) => `<option value="${k}"${opciones.lineaTipo === k ? " selected" : ""}>${v}</option>`).join("")}</select>`);
    if (herramienta === "area") html += campo("Qué dibujas", `<select data-op="areaTipo"><option value="lago"${opciones.areaTipo === "lago" ? " selected" : ""}>Lago</option><option value="region"${opciones.areaTipo === "region" ? " selected" : ""}>Región nueva (territorio)</option></select>`);
    if (dibujo) html += `<div class="ed-acciones"><button type="button" class="ed-btn ed-btn-primario" data-accion="terminar">Terminar (${dibujo.p.length / 2} puntos)</button><button type="button" class="ed-btn" data-accion="cancelar-dibujo">Cancelar</button></div>`;

    if (s) {
      html += `<hr>`;
      if (s.tipo === "etiqueta") {
        const e = doc().etiquetas.find(x => x.id === s.id);
        if (e) html += `<h4>Nombre</h4>` + campo("Texto (una línea por renglón)", `<textarea rows="2" data-campo="l">${esc(e.l.join("\n"))}</textarea>`) +
          campo("Tipo", `<select data-campo="tipo">${Object.entries(TIPOS_ETIQUETA).map(([k, v]) => `<option value="${k}"${e.tipo === k ? " selected" : ""}>${v}</option>`).join("")}</select>`) +
          campo("Tamaño", `<input type="range" min="6" max="60" step=".5" value="${e.t}" data-campo="t"><output>${e.t}</output>`) +
          campo("Giro", `<input type="range" min="-90" max="90" step="1" value="${e.a || 0}" data-campo="a"><output>${e.a || 0}°</output>`) +
          campo("Curva", `<input type="range" min="-20" max="20" step=".5" value="${e.c || 0}" data-campo="c"><output>${e.c || 0}</output>`) +
          campo("Interlineado", `<input type="range" min=".8" max="2" step=".02" value="${e.s || 1.05}" data-campo="s"><output>${e.s || 1.05}</output>`) +
          campo("Abre la ficha", `<select data-campo="lugarId">${opcionesLugares(e.lugarId)}</select>`) + campoVer(e.ver, "data-campo") +
          `<div class="ed-acciones"><button type="button" class="ed-btn ed-btn-peligro" data-accion="borrar">Borrar nombre</button></div>`;
      } else if (s.tipo === "relieve") {
        const r = doc().relieve.find(x => x.id === s.id);
        if (r) html += `<h4>Relieve</h4>` + campo("Dibujo", `<select data-campo-rel="t">${RELIEVE_TIPOS.map(([t, n]) => `<option value="${t}"${r.t === t ? " selected" : ""}>${n} (${t})</option>`).join("")}</select>`) +
          campo("Tamaño", `<input type="range" min="4" max="50" step=".5" value="${r.s}" data-campo-rel="s"><output>${r.s}</output>`) + campoVer(r.ver, "data-campo-rel") +
          `<div class="ed-acciones"><button type="button" class="ed-btn ed-btn-peligro" data-accion="borrar">Borrar</button></div>`;
      } else if (s.tipo === "lugar") {
        const l = (typeof ALL_ENTRIES !== "undefined" ? ALL_ENTRIES : []).find(x => x.id === s.id);
        const movido = doc().posiciones && doc().posiciones[s.id];
        html += `<h4>${esc(l ? l.title : s.id)}</h4><p class="ed-ayuda">Arrástralo para cambiarlo de sitio. Solo se guarda la posición; la ficha no cambia.</p>` +
          `<div class="ed-acciones"><button type="button" class="ed-btn" data-accion="abrir-ficha">Abrir ficha</button>${movido ? `<button type="button" class="ed-btn" data-accion="borrar">Volver a su sitio de antes</button>` : ""}</div>`;
      } else if (s.tipo === "linea") {
        const o = coleccion(s.col)[s.idx];
        const nombre = s.col === "arcos" ? ({ costa: "Costa", frontera: "Frontera", orilla: "Orilla de lago" }[o.tipo] || "Línea") : s.col === "lagosExtra" ? "Lago" : s.col === "regionesExtra" ? "Región" : LINEAS[s.col];
        html += `<h4>${nombre}</h4><p class="ed-ayuda">${o.p.length / 2} puntos. Arrastra los puntos; doble clic en la línea añade uno; Mayús+clic quita uno.${s.col === "arcos" ? " Los puntos grandes unen esta línea con otras y se mueven juntos." : ""}</p>` +
          (s.col === "arcos" ? "" : campoVer(o.ver, "data-campo-lin") + `<div class="ed-acciones"><button type="button" class="ed-btn ed-btn-peligro" data-accion="borrar">Borrar ${nombre.toLowerCase()}</button></div>`);
      } else if (s.tipo === "region") {
        const r = buscarRegion(s.id);
        if (r) {
          const esExtra = !r.anillos, esNeutral = !!r.neutral;
          html += `<h4>${esc(r.nombre || "Territorio sin nombre")}</h4>` +
            campo("Nombre", `<input type="text" value="${esc(r.nombre || "")}" data-campo-reg="nombre">`) +
            (esNeutral ? "" : campo("Color", `<input type="color" value="${esc(r.color || "#cccccc")}" data-campo-reg="color">`)) +
            campo("Abre la ficha", `<select data-campo-reg="lugarId">${opcionesLugares(r.lugarId)}</select>`) + (esNeutral ? "" : campoVer(r.ver, "data-campo-reg"));
          if (!esExtra && s.anillo != null && r.anillos.length > 1) {
            const isla = r.anillos[s.anillo].every(k => { const a = geo().arcos[k < 0 ? -k - 1 : k]; return a.tipo === "costa" || a.tipo === "borde"; });
            const otros = geo().estados.filter(x => x.id !== r.id);
            html += isla ? `<p class="ed-ayuda">Has marcado un trozo suelto (isla) de ${esc(r.nombre)}.</p>` + campo("Pasar esta isla a", `<select data-accion-isla><option value="">—</option>${otros.map(o => `<option value="${o.id}">${esc(o.nombre)}</option>`).join("")}</select>`)
              : `<p class="ed-ayuda">Este trozo comparte frontera con otro reino. Para cambiarlo de dueño, mueve la frontera con la herramienta de líneas.</p>`;
          }
          if (esExtra) html += `<div class="ed-acciones"><button type="button" class="ed-btn ed-btn-peligro" data-accion="borrar">Borrar región</button></div>`;
        }
      }
    }
    p.innerHTML = html;
  }
  function cambioCampo(e) {
    const t = e.target, s = seleccion;
    if (t.dataset.op) {
      const k = t.dataset.op; opciones[k] = t.type === "checkbox" ? t.checked : t.type === "range" ? +t.value : t.value;
      if (t.nextElementSibling && t.nextElementSibling.tagName === "OUTPUT") t.nextElementSibling.textContent = t.value;
      if (k === "lineaTipo" || k === "areaTipo") { dibujo = null; redibujar(); }
      return;
    }
    if (!s) return;
    const enVivo = e.type === "input";
    if (t.dataset.campo && s.tipo === "etiqueta") {
      const et = doc().etiquetas.find(x => x.id === s.id); if (!et) return;
      if (!enVivo || !t.__antes) { if (!t.__antes) { antes(); t.__antes = true; } }
      const k = t.dataset.campo; let v = t.value;
      if (k === "l") v = v.split("\n").map(x => x.trim()).filter(Boolean).slice(0, 4); else if (["t", "a", "c", "s"].includes(k)) v = +v;
      if (k === "l" && !v.length) return;
      if ((k === "lugarId" && !v) || (k === "ver" && v === "todos")) delete et[k]; else et[k] = v;
      if (t.nextElementSibling && t.nextElementSibling.tagName === "OUTPUT") t.nextElementSibling.textContent = t.value + (k === "a" ? "°" : "");
      MV.reconstruir(); redibujarSinPanel(); estadoCambios();
      if (!enVivo) t.__antes = false;
      return;
    }
    if (t.dataset.campoRel && s.tipo === "relieve") {
      const r = doc().relieve.find(x => x.id === s.id); if (!r) return;
      if (!t.__antes) { antes(); t.__antes = true; }
      const kr = t.dataset.campoRel; if (kr === "ver" && t.value === "todos") delete r.ver; else r[kr] = kr === "s" ? +t.value : t.value;
      if (t.nextElementSibling && t.nextElementSibling.tagName === "OUTPUT") t.nextElementSibling.textContent = t.value;
      MV.reconstruir(); redibujarSinPanel(); estadoCambios();
      if (!enVivo) t.__antes = false;
      return;
    }
    if (t.dataset.campoReg && s.tipo === "region") {
      const r = buscarRegion(s.id); if (!r) return;
      if (!t.__antes) { antes(); t.__antes = true; }
      const k = t.dataset.campoReg;
      if ((k === "lugarId" || k === "ver") && (!t.value || t.value === "todos")) delete r[k]; else r[k] = t.value;
      // el nombre del reino en el mapa es su etiqueta: si tiene una sola, se cambia con él
      if (k === "nombre" && r.lugarId) { const et = doc().etiquetas.filter(x => x.lugarId === r.lugarId); if (et.length === 1 && !enVivo) { /* se respeta el texto de la etiqueta, que puede ir en dos renglones */ } }
      MV.reconstruir(); redibujarSinPanel(); estadoCambios();
      if (!enVivo) t.__antes = false;
      return;
    }
    if (t.dataset.campoLin && s.tipo === "linea") {
      const o = coleccion(s.col)[s.idx]; if (!o) return;
      antes(); if (t.value === "todos") delete o.ver; else o.ver = t.value;
      MV.reconstruir(); redibujarSinPanel(); estadoCambios(); return;
    }
    if (t.matches("[data-accion-isla]") && t.value && s.tipo === "region") {
      const r = buscarRegion(s.id), destino = geo().estados.find(x => x.id === t.value); if (!r || !destino) return;
      antes(); const [an] = r.anillos.splice(s.anillo, 1); destino.anillos.push(an);
      seleccion = { tipo: "region", id: destino.id, anillo: destino.anillos.length - 1 }; despues();
      aviso(`La isla ahora es de ${destino.nombre}.`);
    }
  }
  function redibujarSinPanel() { const p = pintarPanel; pintarPanel = () => {}; try { redibujar(); } finally { pintarPanel = p; } }

  function accionPanel(e) {
    const b = e.target.closest("[data-accion], [data-relieve]"); if (!b) return;
    if (b.dataset.relieve) { opciones.relieveTipo = b.dataset.relieve; pintarPanel(); return; }
    const a = b.dataset.accion;
    if (a === "borrar") borrarSeleccion();
    else if (a === "terminar") terminarDibujo();
    else if (a === "cancelar-dibujo") { dibujo = null; redibujar(); }
    else if (a === "abrir-ficha") { const l = (typeof ALL_ENTRIES !== "undefined" ? ALL_ENTRIES : []).find(x => x.id === seleccion.id); if (l && typeof openEntryModal === "function") openEntryModal(l); }
  }

  // ---------- Épocas ----------
  // Una época guarda su propia copia de la geografía y de los nombres. Editarla intercambia esa copia con la del presente
  // (doc.__epoca dice cuál se está editando); al guardar o exportar siempre se deja el presente en su sitio.
  function intercambiar(d, id) { const e = (d.epocas || []).find(x => x.id === id); if (!e) return; [d.geografia, e.geografia] = [e.geografia, d.geografia]; [d.etiquetas, e.etiquetas] = [e.etiquetas, d.etiquetas]; }
  function normalizadoDe(d) { if (!d.__epoca) return d; const c = JSON.parse(JSON.stringify(d)); intercambiar(c, c.__epoca); delete c.__epoca; return c; }
  function normalizado() { return JSON.parse(JSON.stringify(normalizadoDe(doc()))); }
  function editarEpoca(id) {
    antes(); const d = doc();
    if (d.__epoca) { intercambiar(d, d.__epoca); delete d.__epoca; }
    if (id) { intercambiar(d, id); d.__epoca = id; }
    seleccion = null; despues();
  }
  function estadoEpoca() {
    const d = doc(), e = d.__epoca && (d.epocas || []).find(x => x.id === d.__epoca);
    ui.barra.classList.toggle("ed-en-epoca", !!e);
    ui.epoca.innerHTML = e ? `Editando la época <b>${esc(e.nombre)}</b> <button type="button" class="ed-btn" data-b="presente">Volver al presente</button>` : "";
  }
  function dialogoEpocas() {
    const d = doc(), lista = d.epocas || [];
    ui.dialogo.innerHTML = `<div class="ed-dlg-cab"><h3>Épocas del mapa</h3><button type="button" class="ed-cerrar" data-cerrar aria-label="Cerrar">×</button></div><div class="ed-dlg-cuerpo">
      <p class="ed-ayuda">Cada época es una copia de las fronteras y los nombres para mostrar cómo era el mundo en otro momento. Las épocas ocultas solo las ve el Admin, en el panel de capas.</p>
      ${lista.length ? `<ul class="ed-versiones">${lista.map(e => `<li><div><strong>${esc(e.nombre)}</strong><small>${e.publica ? "Visible para los jugadores" : "Oculta"}${d.__epoca === e.id ? " · la estás editando" : ""}</small></div><div class="ed-acciones">
        <button type="button" class="ed-btn" data-ep-editar="${e.id}">${d.__epoca === e.id ? "Volver al presente" : "Editar"}</button>
        <button type="button" class="ed-btn" data-ep-nombre="${e.id}">Renombrar</button>
        <button type="button" class="ed-btn" data-ep-publica="${e.id}">${e.publica ? "Ocultar" : "Mostrar a jugadores"}</button>
        <button type="button" class="ed-btn ed-btn-peligro" data-ep-borrar="${e.id}">Borrar</button></div></li>`).join("")}</ul>` : `<p>Todavía no hay ninguna época.</p>`}
      <div class="ed-acciones ed-acciones-pie"><button type="button" class="ed-btn ed-btn-primario" data-ep-nueva>Nueva época (copia del mapa de ahora)</button></div></div>`;
    if (!ui.dialogo.open) ui.dialogo.showModal();
  }
  function accionEpocas(e) {
    const t = e.target.closest("[data-ep-nueva], [data-ep-editar], [data-ep-nombre], [data-ep-publica], [data-ep-borrar]"); if (!t) return false;
    const d = doc(); d.epocas = d.epocas || [];
    if (t.matches("[data-ep-nueva]")) {
      const nombre = (prompt("Nombre de la época (por ejemplo «Antes de la caída de Tarrena»):", "") || "").trim().slice(0, 80); if (!nombre) return true;
      antes(); const base0 = normalizado();
      d.epocas.push({ id: nuevoId("epoca"), nombre, publica: false, geografia: base0.geografia, etiquetas: base0.etiquetas });
      despues(); dialogoEpocas(); aviso(`Época «${nombre}» creada. Pulsa Editar para cambiar sus fronteras.`, "ok"); return true;
    }
    const id = t.dataset.epEditar || t.dataset.epNombre || t.dataset.epPublica || t.dataset.epBorrar; const ep = d.epocas.find(x => x.id === id); if (!ep) return true;
    if (t.dataset.epEditar) { const yaEra = d.__epoca === id; editarEpoca(yaEra ? null : id); ui.dialogo.close(); aviso(yaEra ? "De vuelta al presente." : `Editando «${ep.nombre}». Lo que cambies solo afecta a esa época.`); }
    else if (t.dataset.epNombre) { const n = (prompt("Nuevo nombre:", ep.nombre) || "").trim().slice(0, 80); if (n) { antes(); ep.nombre = n; despues(); dialogoEpocas(); } }
    else if (t.dataset.epPublica) { if (!ep.publica && !confirm("¿Mostrar esta época a los jugadores? La verán en el panel de capas cuando la función de épocas esté publicada.")) return true; antes(); ep.publica = !ep.publica; despues(); dialogoEpocas(); }
    else if (t.dataset.epBorrar) { if (!confirm(`¿Borrar la época «${ep.nombre}»? Podrás deshacerlo hasta que guardes.`)) return true; antes(); if (d.__epoca === id) { intercambiar(d, id); delete d.__epoca; } d.epocas = d.epocas.filter(x => x.id !== id); despues(); dialogoEpocas(); }
    return true;
  }
  // ---------- Funciones para jugadores ----------
  function dialogoFunciones() {
    const p = (doc().ajustes && doc().ajustes.publico) || {};
    const fila = (k, n, ayuda) => `<label class="ed-check"><input type="checkbox" data-pub="${k}"${p[k] ? " checked" : ""}> <span><strong>${n}</strong><br><small>${ayuda}</small></span></label>`;
    ui.dialogo.innerHTML = `<div class="ed-dlg-cab"><h3>Funciones para los jugadores</h3><button type="button" class="ed-cerrar" data-cerrar aria-label="Cerrar">×</button></div><div class="ed-dlg-cuerpo">
      <p class="ed-ayuda">Tú las ves siempre. Los jugadores solo las verán cuando las marques aquí y guardes el mapa.</p>
      ${fila("regla", "Regla de viaje", "Medir distancias y días de viaje.")}
      ${fila("colores", "Colorear por", "Ver el mapa por religión, región o continente.")}
      ${fila("exportar", "Exportar el mapa", "Descargarlo como imagen PNG o como SVG.")}
      ${fila("epocas", "Épocas", "Elegir una época del mapa. Solo aparecen las épocas marcadas como visibles.")}</div>`;
    if (!ui.dialogo.open) ui.dialogo.showModal();
  }

  // ---------- Barra superior: guardar, versiones, exportar ----------
  function estadoCambios() {
    if (!ui) return;
    estadoEpoca();
    const c = hayCambios();
    ui.estado.textContent = c ? "Cambios sin guardar" : (MV.version() ? `Guardado · versión ${MV.version()}` : "Sin cambios (mapa de archivo)");
    ui.estado.dataset.cambios = c ? "1" : "0";
    ui.deshacer.disabled = !pila.length; ui.rehacer.disabled = !rehacerPila.length;
    ui.guardar.disabled = !c || ocupado;
  }
  function aviso(t, tipo) { MV.mostrarAviso(t, tipo); }
  async function cliente() { if (typeof fichasCliente !== "function") throw new Error("Sin conexión con Supabase en esta página."); return fichasCliente(); }
  function esperandoBoton(b, texto) { const orig = b.innerHTML; b.disabled = true; b.classList.add("ed-esperando"); b.innerHTML = `<span class="ed-giro" aria-hidden="true"></span>${esc(texto)}`; return () => { b.disabled = false; b.classList.remove("ed-esperando"); b.innerHTML = orig; }; }
  function validar(d) {
    const err = [];
    if (!d || d.esquema !== 1) err.push("No es un mapa de este editor (esquema distinto).");
    const g = d && d.geografia;
    if (!g || !Array.isArray(g.arcos) || !Array.isArray(g.estados)) err.push("Falta la geografía.");
    else {
      const n = g.arcos.length;
      for (const e of g.estados.concat(g.neutrales || [])) for (const an of e.anillos || []) for (const k of an) if ((k < 0 ? -k - 1 : k) >= n) { err.push(`El territorio ${e.id} usa una línea que no existe.`); break; }
      for (const a of g.arcos) if (!Array.isArray(a.p) || a.p.length < 4 || a.p.some(v => typeof v !== "number" || !isFinite(v))) { err.push("Hay una costa o frontera con puntos rotos."); break; }
    }
    if (!Array.isArray(d && d.etiquetas)) err.push("Faltan los nombres.");
    else if (d.etiquetas.some(e => !Array.isArray(e.l) || !e.l.length || !isFinite(e.x) || !isFinite(e.y))) err.push("Hay un nombre sin texto o sin posición.");
    if (!Array.isArray(d && d.relieve)) err.push("Falta el relieve.");
    if (!d || !d.lineas || typeof d.lineas !== "object") err.push("Faltan los ríos y caminos.");
    const tam = JSON.stringify(d || {}).length; if (tam > 2800000) err.push("El mapa pesa demasiado para guardarlo.");
    return err;
  }
  async function guardar() {
    const datos = normalizado();
    const errores = validar(datos); if (errores.length) { aviso("No se guardó: " + errores[0], "error"); return; }
    const nota = (prompt("Nota para esta versión (opcional):", "") || "").slice(0, 200);
    ocupado = true; const fin = esperandoBoton(ui.guardar, "Guardando…");
    try {
      const sb = await cliente();
      const { data, error } = await sb.rpc("mapa_guardar", { p_datos: datos, p_version_base: MV.version() || 0, p_nota: nota || null });
      if (error) throw error;
      MV.setVersion(data); base = JSON.stringify(datos);
      aviso(`Mapa guardado (versión ${data}). Los jugadores ya lo ven.`, "ok");
    } catch (e) {
      const msg = String(e && (e.message || e));
      if (/conflicto/i.test(msg)) aviso("Otro Admin guardó el mapa mientras editabas. Exporta tus cambios y recarga la página para ver su versión.", "error");
      else if (/mapa_mundo|mapa_guardar|does not exist|schema cache/i.test(msg)) aviso("Falta correr el SQL del mapa en Supabase (mapa_mundo.sql). Puedes exportar los cambios mientras tanto.", "error");
      else if (/autorizado/i.test(msg)) aviso("Tu cuenta no tiene permiso de Admin en el servidor.", "error");
      else aviso("No se pudo guardar: " + msg, "error");
    } finally { ocupado = false; fin(); estadoCambios(); }
  }
  function exportar() {
    const blob = new Blob([JSON.stringify(normalizado(), null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `mapa-mundo-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function importar() {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,application/json";
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      try {
        const d = JSON.parse(await f.text()); const errores = validar(d);
        if (errores.length) { aviso("Ese archivo no sirve: " + errores[0], "error"); return; }
        if (hayCambios() && !confirm("Tienes cambios sin guardar. ¿Reemplazarlos por el archivo? Podrás deshacerlo.")) return;
        antes(); MV.reemplazar(d); seleccion = null; redibujar(); estadoCambios(); aviso("Mapa importado. Revísalo y guarda si está bien.", "ok");
      } catch (e) { aviso("No se pudo leer el archivo: " + e.message, "error"); }
    };
    inp.click();
  }
  async function versiones() {
    const dlg = ui.dialogo; dlg.innerHTML = `<div class="ed-dlg-cab"><h3>Versiones guardadas</h3><button type="button" class="ed-cerrar" data-cerrar aria-label="Cerrar">×</button></div><div class="ed-dlg-cuerpo"><p class="ed-cargando"><span class="ed-giro"></span>Cargando…</p></div>`;
    dlg.showModal();
    try {
      const sb = await cliente(); const { data, error } = await sb.rpc("mapa_versiones"); if (error) throw error;
      const cuerpo = dlg.querySelector(".ed-dlg-cuerpo");
      if (!data || !data.length) { cuerpo.innerHTML = `<p>Todavía no hay versiones guardadas. El mapa sale del archivo.</p>`; return; }
      cuerpo.innerHTML = `<ul class="ed-versiones">${data.map(v => `<li><div><strong>Versión ${v.version}</strong>${v.actual ? ' <em>(la que ven ahora)</em>' : ""}<small>${new Date(v.guardado).toLocaleString("es")}</small>${v.nota ? `<span>${esc(v.nota)}</span>` : ""}</div>${v.actual ? "" : `<div class="ed-acciones"><button type="button" class="ed-btn" data-ver="${v.version}">Cargar para revisar</button><button type="button" class="ed-btn" data-restaurar="${v.version}">Restaurar</button></div>`}</li>`).join("")}</ul>`;
    } catch (e) { dlg.querySelector(".ed-dlg-cuerpo").innerHTML = `<p class="ed-error">No se pudieron leer las versiones: ${esc(e.message || e)}</p>`; }
  }
  async function accionDialogo(e) {
    if (e.target.closest("[data-cerrar]")) { ui.dialogo.close(); return; }
    if (accionEpocas(e)) return;
    const ver = e.target.closest("[data-ver]"), res = e.target.closest("[data-restaurar]");
    if (!ver && !res) return;
    const b = ver || res, v = +(b.dataset.ver || b.dataset.restaurar);
    const fin = esperandoBoton(b, ver ? "Cargando…" : "Restaurando…");
    try {
      const sb = await cliente();
      if (ver) {
        const { data, error } = await sb.rpc("mapa_version_datos", { p_version: v }); if (error) throw error;
        if (hayCambios() && !confirm("Tienes cambios sin guardar. ¿Cargar la versión " + v + " encima? Podrás deshacerlo.")) return;
        antes(); MV.reemplazar(data); seleccion = null; redibujar(); estadoCambios(); ui.dialogo.close();
        aviso(`Versión ${v} cargada para revisar. Si la guardas, pasará a ser la actual.`, "ok");
      } else {
        if (!confirm(`¿Restaurar la versión ${v}? Se guardará como versión nueva y los jugadores la verán.`)) return;
        const { data, error } = await sb.rpc("mapa_restaurar", { p_version: v, p_version_base: MV.version() || 0 }); if (error) throw error;
        const r = await sb.rpc("mapa_version_datos", { p_version: data }); if (r.error) throw r.error;
        MV.setVersion(data); MV.reemplazar(r.data); base = JSON.stringify(r.data); pila.length = 0; rehacerPila.length = 0; seleccion = null; redibujar(); estadoCambios(); ui.dialogo.close();
        aviso(`Restaurada como versión ${data}.`, "ok");
      }
    } catch (err) { aviso(/conflicto/i.test(err.message) ? "Otro Admin guardó entretanto. Recarga la página." : "No se pudo: " + (err.message || err), "error"); }
    finally { fin(); }
  }
  function descartar() {
    if (!hayCambios()) return;
    if (!confirm("¿Descartar todos los cambios desde la última vez que guardaste?")) return;
    MV.reemplazar(JSON.parse(base)); pila.length = 0; rehacerPila.length = 0; seleccion = null; dibujo = null; redibujar(); estadoCambios();
  }

  // ---------- Montaje de la interfaz ----------
  function montar() {
    ui = {};
    const herr = h(`<div class="ed-herramientas" role="toolbar" aria-label="Herramientas del editor">${HERRAMIENTAS.map(t => `<button type="button" class="ed-herr" data-herr="${t.id}" title="${esc(t.nombre)} (${t.tecla})" aria-label="${esc(t.nombre)}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${t.icono}</svg><kbd>${t.tecla}</kbd></button>`).join("")}</div>`);
    const barra = h(`<div class="ed-barra">
      <strong class="ed-titulo">Editando el mapa</strong>
      <span class="ed-estado" aria-live="polite"></span>
      <span class="ed-epoca"></span>
      <button type="button" class="ed-btn" data-b="deshacer" title="Deshacer (Ctrl+Z)">↶ Deshacer</button>
      <button type="button" class="ed-btn" data-b="rehacer" title="Rehacer (Ctrl+Y)">↷ Rehacer</button>
      <button type="button" class="ed-btn ed-btn-primario" data-b="guardar">Guardar</button>
      <details class="ed-mas"><summary class="ed-btn">Más ▾</summary><div class="ed-menu">
        <button type="button" data-b="epocas">Épocas del mapa…</button>
        <button type="button" data-b="funciones">Funciones para jugadores…</button>
        <button type="button" data-b="versiones">Versiones guardadas…</button>
        <button type="button" data-b="exportar">Exportar a archivo (.json)</button>
        <button type="button" data-b="importar">Importar desde archivo…</button>
        <button type="button" data-b="descartar">Descartar cambios</button>
      </div></details>
      <button type="button" class="ed-btn" data-b="salir">Salir</button>
    </div>`);
    const panel = h(`<aside class="ed-panel" aria-label="Propiedades"></aside>`);
    const dialogo = h(`<dialog class="ed-dialogo"></dialog>`);
    marco.append(herr, barra, panel); document.body.appendChild(dialogo);
    Object.assign(ui, { herr, barra, panel, dialogo, estado: barra.querySelector(".ed-estado"), deshacer: barra.querySelector('[data-b="deshacer"]'), epoca: barra.querySelector(".ed-epoca"), rehacer: barra.querySelector('[data-b="rehacer"]'), guardar: barra.querySelector('[data-b="guardar"]') });
    herr.addEventListener("click", e => { const b = e.target.closest("[data-herr]"); if (b) ponerHerramienta(b.dataset.herr); });
    barra.addEventListener("click", e => {
      const b = e.target.closest("[data-b]"); if (!b) return; const k = b.dataset.b;
      const mas = barra.querySelector(".ed-mas"); if (b.closest(".ed-menu")) mas.open = false;
      ({ deshacer, rehacer, guardar, versiones, exportar, importar, descartar, epocas: dialogoEpocas, funciones: dialogoFunciones, presente: () => editarEpoca(null), salir: () => alternar() })[k]();
    });
    panel.addEventListener("input", cambioCampo); panel.addEventListener("change", cambioCampo); panel.addEventListener("click", accionPanel);
    dialogo.addEventListener("click", accionDialogo);
    dialogo.addEventListener("change", e => {
      const c = e.target.closest("[data-pub]"); if (!c) return;
      antes(); const d = doc(); d.ajustes = d.ajustes || {}; d.ajustes.publico = d.ajustes.publico || {}; d.ajustes.publico[c.dataset.pub] = c.checked;
      despues(); MV.actualizarFunciones();
    });
    // eventos del mapa: en captura, para adelantarse al arrastre del visor
    marco.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    marco.addEventListener("click", onClick);
    marco.addEventListener("dblclick", onDblClick, true);
    document.addEventListener("keydown", teclas);
    window.addEventListener("beforeunload", e => { if (activo && hayCambios()) { e.preventDefault(); e.returnValue = ""; } });
    MV.alCambiar(() => { if (activo) ajustarTamanos(); });
  }
  function teclas(e) {
    if (!activo) return;
    const enCampo = e.target.closest && e.target.closest("input, textarea, select, [contenteditable]");
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { if (enCampo) return; e.preventDefault(); e.shiftKey ? rehacer() : deshacer(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { if (enCampo) return; e.preventDefault(); rehacer(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (hayCambios()) guardar(); return; }
    if (enCampo) return;
    if (e.key === "Escape") { if (dibujo) { dibujo = null; redibujar(); } else seleccionar(null); return; }
    if (e.key === "Enter" && dibujo) { e.preventDefault(); terminarDibujo(); return; }
    if (e.key === "Backspace" && dibujo) { e.preventDefault(); dibujo.p.splice(-2, 2); redibujar(); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && seleccion) { e.preventDefault(); borrarSeleccion(); return; }
    const t = HERRAMIENTAS.find(x => x.tecla === e.key.toUpperCase()); if (t && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); ponerHerramienta(t.id); }
  }
  function ponerHerramienta(id) {
    if (dibujo && !confirm("Dejas un dibujo a medias. ¿Descartarlo?")) return;
    herramienta = id; dibujo = null;
    if (seleccion && id === "vertices" && seleccion.tipo !== "linea") seleccion = null;
    marco.dataset.herramienta = id;
    ui.herr.querySelectorAll("[data-herr]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.herr === id)));
    redibujar();
  }
  function alternar() {
    if (!ui) montar();
    if (activo) {
      if (hayCambios() && !confirm("Tienes cambios sin guardar. Seguirán aquí si vuelves a abrir el editor, pero los jugadores no los verán. ¿Salir?")) return;
      if (doc().__epoca) { const d = doc(); intercambiar(d, d.__epoca); delete d.__epoca; MV.reconstruir(); }
      activo = false; marco.classList.remove("mv-editando"); if (capaEd) capaEd.remove(); capaEd = null; dibujo = null; seleccion = null;
      document.getElementById("mvEditar")?.setAttribute("aria-pressed", "false");
      return;
    }
    activo = true; if (!base) base = JSON.stringify(normalizadoDe(doc()));
    marco.classList.add("mv-editando"); document.getElementById("mvEditar")?.setAttribute("aria-pressed", "true");
    ponerHerramienta(herramienta); estadoCambios();
    aviso("Modo edición. Los cambios no los ve nadie hasta que pulses Guardar.");
  }
  window.MapaEditor = { alternar, validar };
})();
