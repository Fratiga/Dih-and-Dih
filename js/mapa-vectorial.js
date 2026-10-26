/* Mapa vectorial del mundo: capas SVG a partir de datos/mundo.json.
   Los lugares salen de data/mapa.js (MAPA_PUNTOS) y de las fichas de la web (ALL_ENTRIES);
   el mapa no guarda copia de las fichas. Si algo falla, se muestra el mapa de siempre (PNG con puntos). */
(function () {
  // Dónde está cada archivo. mapa.html define window.MAPA_VECTORIAL_RUTAS; la prueba local usa la carpeta de trabajo.
  const BASE = "scratchpad/mapa-vectorial/";
  const RUTAS = Object.assign({ datos: BASE + "datos/mundo.json", iconos: BASE + "datos/iconos.svg", mar: BASE + "datos/mar.png", editorJs: BASE + "editor.js", editorCss: BASE + "editor.css" }, window.MAPA_VECTORIAL_RUTAS || {});
  const PNG_ORIGINAL = "assets/mapa/Boes_2026-03-26-23-45.png";
  const KM_POR_PX = 4; // la barra del original: 800 km = 200 px
  const NS = "http://www.w3.org/2000/svg";

  const marco = document.getElementById("mvMarco");
  const lienzo = document.getElementById("mvLienzo");
  const svg = document.getElementById("mvSvg");
  // lo que se desplaza al arrastrar: un div con capa propia en la GPU (el SVG ya pintado se mueve sin repintarse)
  const movil = document.getElementById("mvMovil") || svg;
  const tooltip = document.getElementById("mvTooltip");
  const avisoCarga = document.getElementById("mvCarga");
  const mapaBusqueda = document.getElementById("mapaBusqueda");
  const mapaSugerencias = document.getElementById("mapaSugerencias");
  const mapaFiltros = document.getElementById("mapaFiltros");

  const el = (tag, attrs, padre) => { const e = document.createElementNS(NS, tag); if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); if (padre) padre.appendChild(e); return e; };
  const normalizar = t => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const r2 = v => Math.round(v * 100) / 100;

  // ---------- Curvas: Catmull-Rom a Bézier ----------
  function segmentos(p, cerrado) {
    const n = p.length / 2; const pt = i => [p[i * 2], p[i * 2 + 1]];
    const segs = [];
    if (n < 2) return segs;
    const m = cerrado ? n - 1 : n; // en un bucle el último punto repite el primero
    for (let i = 0; i < (cerrado ? m : n - 1); i++) {
      const i0 = cerrado ? (i - 1 + m) % m : Math.max(0, i - 1);
      const i1 = i, i2 = cerrado ? (i + 1) % m : i + 1;
      const i3 = cerrado ? (i + 2) % m : Math.min(n - 1, i + 2);
      const [x0, y0] = pt(i0), [x1, y1] = pt(i1), [x2, y2] = pt(i2), [x3, y3] = pt(i3);
      segs.push([x1, y1, x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6, x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6, x2, y2]);
    }
    return segs;
  }
  const dSegs = (segs, mover) => (mover && segs.length ? `M${r2(segs[0][0])} ${r2(segs[0][1])}` : "") + segs.map(s => `C${r2(s[2])} ${r2(s[3])} ${r2(s[4])} ${r2(s[5])} ${r2(s[6])} ${r2(s[7])}`).join("");
  const invertir = segs => segs.slice().reverse().map(s => [s[6], s[7], s[4], s[5], s[2], s[3], s[0], s[1]]);
  const recta = p => { let d = ""; for (let i = 2; i < p.length; i += 2) d += `L${r2(p[i])} ${r2(p[i + 1])}`; return d; };

  // ---------- Estado de la vista ----------
  let W = 1494, H = 748;
  const vista = { x: 0, y: 0, w: W };
  let minW = W / 14;

  // El lienzo ocupa la ventana: su proporción no tiene por qué ser la del mapa, y la vista se adapta a él.
  let tamLienzo = { w: 1, h: 1 };
  const medirLienzo = () => { const r = lienzo.getBoundingClientRect(); tamLienzo = { w: r.width || W, h: r.height || H }; };
  const aspecto = () => tamLienzo.w / tamLienzo.h;
  const altoDe = w => w / aspecto();
  const maxW = () => Math.max(W, H * aspecto()) * 1.02;
  function aplicarVista() {
    const h = altoDe(vista.w);
    svg.setAttribute("viewBox", `${r2(vista.x)} ${r2(vista.y)} ${r2(vista.w)} ${r2(h)}`);
    const zoom = maxW() / vista.w, pxPorUnidad = tamLienzo.w / vista.w;
    // los iconos se miden en píxeles de pantalla y crecen un poco al acercarse
    svg.style.setProperty("--mk", (Math.pow(zoom, 0.48) / pxPorUnidad).toFixed(4));
    svg.classList.toggle("mv-z2", zoom >= 1.7);
    svg.classList.toggle("mv-z3", zoom >= 3);
    svg.classList.toggle("mv-z4", zoom >= 5);
    actualizarEscala();
    if (tooltipActual) colocarTooltip(tooltipActual);
    if (typeof alCambiarVista === "function") alCambiarVista();
  }
  function limitar() {
    vista.w = Math.min(maxW(), Math.max(minW, vista.w));
    const h = altoDe(vista.w);
    vista.x = vista.w >= W ? (W - vista.w) / 2 : Math.min(W - vista.w, Math.max(0, vista.x));
    vista.y = h >= H ? (H - h) / 2 : Math.min(H - h, Math.max(0, vista.y));
  }
  // Durante el arrastre y el zoom el SVG se mueve con una transformación CSS (barata, en la GPU);
  // al parar se fija el viewBox y se redibuja nítido.
  let comprometida = { ...vista }, interactuando = false, temporizador = null, pendiente = false;
  function vistaRapida() {
    if (!interactuando) { interactuando = true; comprometida = { ...vista0() }; movil.classList.add("mv-moviendo"); svg.classList.add("mv-moviendo"); }
    const S = tamLienzo.w;
    const sc = comprometida.w / vista.w;
    const tx = (comprometida.x - vista.x) / vista.w * S, ty = (comprometida.y - vista.y) / vista.w * S;
    movil.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${sc.toFixed(5)})`;
    actualizarEscala();
    if (tooltipActual) ocultarTooltip();
    clearTimeout(temporizador); temporizador = setTimeout(fijar, 230);
  }
  function vista0() { const vb = (svg.getAttribute("viewBox") || "").split(" ").map(Number); return vb.length === 4 ? { x: vb[0], y: vb[1], w: vb[2] } : { ...vista }; }
  function fijar() {
    interactuando = false; const t0 = performance.now();
    movil.style.transform = ""; movil.classList.remove("mv-moviendo"); svg.classList.remove("mv-moviendo"); aplicarVista();
    if (medidor) requestAnimationFrame(() => requestAnimationFrame(() => medidor.fijado(performance.now() - t0)));
  }
  // ---------- Medidor de FPS: ?fps en la dirección o localStorage mapaFps = "1" ----------
  let medidor = null;
  function crearMedidor() {
    const caja = document.createElement("div"); caja.className = "mv-fps"; marco.appendChild(caja);
    const marcas = []; let ultimo = performance.now(), peor = 0, lentos = 0, ultimoFijado = 0, peorFijado = 0;
    const bucle = t => {
      const dt = t - ultimo; ultimo = t; marcas.push(t); peor = Math.max(peor, dt); if (dt > 34) lentos++;
      while (marcas.length && marcas[0] < t - 1000) marcas.shift();
      requestAnimationFrame(bucle);
    };
    requestAnimationFrame(bucle);
    setInterval(() => {
      const fps = marcas.length;
      caja.innerHTML = `FPS <b class="${fps < 45 ? "mal" : ""}">${fps}</b>  peor cuadro ${peor.toFixed(0)} ms
cuadros lentos (>34 ms): ${lentos}
redibujo al soltar: ${ultimoFijado.toFixed(0)} ms (peor ${peorFijado.toFixed(0)})
${interactuando ? "moviendo" : "quieto"} · ${Math.round(tamLienzo.w)}×${Math.round(tamLienzo.h)} · ppp ${devicePixelRatio}`;
      peor = 0; lentos = 0;
    }, 1000);
    return { fijado: ms => { ultimoFijado = ms; peorFijado = Math.max(peorFijado, ms); } };
  }
  function pedirVista() { if (pendiente) return; pendiente = true; requestAnimationFrame(() => { pendiente = false; vistaRapida(); }); }
  // Pasa de coordenadas de pantalla a coordenadas del mapa
  function aMapa(cx, cy) { const r = lienzo.getBoundingClientRect(); return [vista.x + (cx - r.left) / r.width * vista.w, vista.y + (cy - r.top) / r.height * altoDe(vista.w)]; }
  function zoomEn(mx, my, factor) {
    const nw = Math.min(maxW(), Math.max(minW, vista.w / factor)); const f = nw / vista.w;
    vista.x = mx - (mx - vista.x) * f; vista.y = my - (my - vista.y) * f; vista.w = nw; limitar(); pedirVista();
  }
  let animacion = null;
  function animarA(objetivo, ms = 420) {
    cancelAnimationFrame(animacion);
    const ini = { ...vista }, t0 = performance.now();
    const paso = t => {
      const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      vista.x = ini.x + (objetivo.x - ini.x) * e; vista.y = ini.y + (objetivo.y - ini.y) * e; vista.w = ini.w + (objetivo.w - ini.w) * e;
      limitar(); if (k < 1) { vistaRapida(); animacion = requestAnimationFrame(paso); } else { clearTimeout(temporizador); fijar(); }
    };
    animacion = requestAnimationFrame(paso);
  }
  function centrarEn(x, y, w) { const h = altoDe(w); animarA({ x: x - w / 2, y: y - h / 2, w }); }

  // ---------- Escala ----------
  const escala = document.getElementById("mvEscala");
  function actualizarEscala() {
    if (!escala) return;
    const anchoPant = tamLienzo.w || 1;
    const pxPantPorKm = anchoPant / vista.w / KM_POR_PX;
    const opciones = [10, 20, 25, 50, 100, 150, 200, 250, 400, 500, 800, 1000];
    let km = opciones[0]; for (const o of opciones) if (o * pxPantPorKm <= 150) km = o;
    const ancho = km * pxPantPorKm;
    escala.querySelector(".mv-escala-barra").style.width = ancho.toFixed(0) + "px";
    escala.querySelector(".mv-escala-texto").textContent = km + " km";
  }

  // ---------- Tipos de lugar ----------
  const TIPOS = {
    capital: { label: "Capital", icono: "b-castle", tam: 19 },
    ciudad: { label: "Ciudad", icono: "b-burgh", tam: 13.5 },
    fortaleza: { label: "Fortaleza / Torre", icono: "b-fort", tam: 14.5 },
    catedral: { label: "Catedral", icono: "b-abbey", tam: 14.5 },
    aldea: { label: "Pueblo", icono: "b-casa", tam: 12 },
    naturaleza: { label: "Naturaleza", icono: null, tam: 13.5 },
    reino: { label: "Reino", icono: null, tam: 0 },
    region: { label: "Región", icono: null, tam: 0 }
  };
  function tipoDeLugar(lugar) { // misma clasificación que el mapa de siempre (js/mapa.js)
    const tags = lugar.tags || [];
    if (tags.includes("capital")) return "capital";
    if (tags.includes("catedral")) return "catedral";
    if (tags.includes("fortaleza") || tags.includes("torre") || tags.includes("prisión")) return "fortaleza";
    if (tags.includes("aldea") || tags.includes("campamento")) return "aldea";
    if (tags.includes("reino") || tags.includes("imperio") || tags.includes("provincia") || tags.includes("ciudad-estado")) return "reino";
    if (tags.includes("región") || tags.includes("continente")) return "region";
    if (["isla", "bosque", "montaña", "volcán", "río", "lago", "desierto", "naturaleza"].some(t => tags.includes(t))) return "naturaleza";
    if (tags.includes("ciudad")) return "ciudad";
    return "region";
  }
  // Icono concreto: el dibujo dice qué es el lugar
  function iconoDe(lugar, tipo) {
    const tags = lugar.tags || [];
    if (tipo === "capital") return { id: "b-castle" };
    if (tags.includes("ruinas") && tipo !== "naturaleza") return { id: "b-templo", sub: "Ruinas" };
    if (tags.includes("torre") || tags.includes("prisión")) return { id: "b-torre" };
    if (tags.includes("campamento")) return { id: "b-camp" };
    if (tipo !== "naturaleza") return { id: TIPOS[tipo].icono, puerto: tags.includes("costero") || tags.includes("piratas") };
    if (tags.includes("volcán") || tags.includes("volcánico")) return { relieve: "r-vulcan-1", sub: "Volcán" };
    if (tags.includes("montaña")) return { relieve: /glaciar/i.test(lugar.title) ? "r-mount-1" : "r-mount-1", sub: /colinas/i.test(lugar.title) ? "Colinas" : "Montaña" };
    if (tags.includes("bosque")) return { relieve: "r-deciduous-1", sub: "Bosque" };
    if (tags.includes("desierto")) return { relieve: "r-dune-1", sub: "Desierto" };
    if (tags.includes("lago")) return { glifo: "lago", sub: "Lago" };
    if (tags.includes("río")) return { glifo: "rio", sub: "Río" };
    if (tags.includes("isla") || tags.includes("archipiélago")) return { relieve: "r-palm-1", sub: "Isla" };
    return { relieve: "r-hill-1" };
  }

  // ---------- Construcción ----------
  let mundo = null, resalte = null, regionResaltada = null;
  const capas = {};
  const LUGARES_IDX = []; // para el buscador
  const MARCAS = new Map(); // lugarId -> elemento
  const ETIQUETAS = new Map(); // lugarId -> elemento de etiqueta (reinos)

  function capa(id, nombre) { const g = el("g", { id: "mv-" + id, class: "mv-capa mv-capa-" + id }, svg); capas[id] = g; g.dataset.nombre = nombre || id; return g; }

  let construido = false;
  // ---------- Visibilidad por lado (campo «ver»: todos, A, B o dm) ----------
  const soyAdmin = () => typeof esAdmin === "function" && esAdmin();
  function visible(o) {
    const v = o && o.ver; if (!v || v === "todos") return true;
    if (soyAdmin()) return true;
    if (v === "dm") return false;
    if (typeof veAmbosLados === "function" && veAmbosLados()) return true;
    return typeof ladoActual === "function" && ladoActual() === v;
  }
  const restringido = o => !!(o && o.ver && o.ver !== "todos");
  // ---------- Épocas: el Admin puede ver cómo era el mapa en otro momento ----------
  let epocaVista = null;
  function documentoAVer() {
    if (!epocaVista || mundo.__epoca) return mundo;
    const e = (mundo.epocas || []).find(x => x.id === epocaVista);
    return e ? Object.assign({}, mundo, { geografia: e.geografia, etiquetas: e.etiquetas }) : mundo;
  }
  function construir() {
    // se puede llamar otra vez (el editor reconstruye tras cada cambio): se vacía todo menos la vista
    svg.innerHTML = ""; for (const k in capas) delete capas[k];
    LUGARES_IDX.length = 0; MARCAS.clear(); ETIQUETAS.clear(); resalte = null; regionResaltada = null; tooltipActual = null;
    const md = documentoAVer();
    W = md.ancho; H = md.alto; minW = W / 16;
    if (!construido) { vista.x = 0; vista.y = 0; vista.w = W; svg.setAttribute("viewBox", `0 0 ${W} ${H}`); }
    construido = true;
    const geo = md.geografia;

    // Arcos ya suavizados (se reutilizan en los anillos y en los trazos)
    const arcos = geo.arcos.map(a => {
      if (a.tipo === "borde") return { ...a, recto: true };
      const cerrado = a.p.length > 4 && a.p[0] === a.p[a.p.length - 2] && a.p[1] === a.p[a.p.length - 1];
      return { ...a, segs: segmentos(a.p, cerrado) };
    });
    const dArco = (a, mover) => a.recto ? (mover ? `M${a.p[0]} ${a.p[1]}` : "") + recta(a.p) : dSegs(a.segs, mover);
    const dArcoInv = a => { if (a.recto) { const r = []; for (let i = a.p.length - 2; i >= 0; i -= 2) r.push(a.p[i], a.p[i + 1]); return recta(r); } return dSegs(invertir(a.segs), false); };
    const inicioArco = (k) => { const rev = k < 0, a = arcos[rev ? -k - 1 : k]; const p = a.p; return rev ? [p[p.length - 2], p[p.length - 1]] : [p[0], p[1]]; };
    const dAnillos = anillos => anillos.map(an => {
      const [x0, y0] = inicioArco(an[0]); let d = `M${r2(x0)} ${r2(y0)}`;
      for (const k of an) { const a = arcos[k < 0 ? -k - 1 : k]; d += k < 0 ? dArcoInv(a) : dArco(a, false); }
      return d + "Z";
    }).join("");

    // ----- defs
    const defs = el("defs", null, svg);
    defs.innerHTML = `
      <linearGradient id="mvHieloGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f9fc"/><stop offset="1" stop-color="#d7e6ef"/></linearGradient>
      <filter id="mvSombraTexto" x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation=".6"/></filter>`;

    // ----- océano
    const oceano = capa("oceano", "Mar");
    // fuera del mapa sigue el mar hondo; dentro, el mar horneado (profundidad, aguas someras y oleaje)
    el("rect", { x: -W, y: -H, width: 3 * W, height: 3 * H, fill: "#55699a" }, oceano);
    el("image", { href: RUTAS.mar, x: 0, y: 0, width: W, height: H, preserveAspectRatio: "none" }, oceano);

    // ----- aguas someras: la costa con trazos anchos y claros por debajo de la tierra
    const costas = arcos.filter(a => a.tipo === "costa");
    const dCostas = costas.map(a => dArco(a, true)).join("");


    // ----- rutas marítimas (debajo de la tierra para que no la crucen)
    const rutas = capa("rutas", "Rutas marítimas");
    for (const r of md.lineas.rutas.filter(visible)) el("path", { d: dSegs(segmentos(r.p, false), true), "data-id": r.id }, rutas);

    // ----- tierra: estados y tierras sin estado
    const tierra = capa("tierra", "Territorios");
    for (const e of geo.neutrales) {
      const p = el("path", { d: dAnillos(e.anillos), class: "mv-neutral", "fill-rule": "evenodd", "data-id": e.id }, tierra);
      if (e.lugarId) { p.dataset.lugarId = e.lugarId; p.classList.add("mv-region-clic"); }
    }
    for (const e of geo.estados) {
      if (!visible(e)) { el("path", { d: dAnillos(e.anillos), class: "mv-estado mv-estado-oculto", "fill-rule": "evenodd", "data-id": e.id }, tierra); continue; }
      const p = el("path", { d: dAnillos(e.anillos), class: "mv-estado mv-region-clic" + (restringido(e) ? " mv-restringido" : ""), fill: colorDeEstado(e), "fill-rule": "evenodd", "data-id": e.id, "data-lugar-id": e.lugarId }, tierra);
      p.style.setProperty("--c", e.color);
    }
    // regiones dibujadas a mano en el editor (polígonos propios, por encima)
    for (const r of (geo.regionesExtra || []).filter(visible)) {
      if (!r.p || r.p.length < 6) continue;
      const p = el("path", { d: dSegs(segmentos(r.p.concat([r.p[0], r.p[1]]), true), true) + "Z", class: "mv-estado mv-region-clic mv-region-extra", fill: r.color || "#d9c9a3", "data-id": r.id }, tierra);
      if (r.lugarId) p.dataset.lugarId = r.lugarId;
    }

    // ----- lagos (los del original y los de lugares que no dibujaba)
    const lagos = capa("lagos", "Lagos");
    for (const l of geo.lagos) el("path", { d: dAnillos(l.anillos), class: "mv-lago", "fill-rule": "evenodd", "data-id": l.id }, lagos);
    for (const l of (geo.lagosExtra || []).filter(visible)) el("path", { d: dSegs(segmentos(l.p.concat([l.p[0], l.p[1]]), true), true) + "Z", class: "mv-lago", "data-id": l.id }, lagos);

    // ----- hielo
    const hielo = capa("hielo", "Hielo");
    const arcosH = geo.hielo.arcos.map(p => ({ p, segs: segmentos(p, p.length > 4 && p[0] === p[p.length - 2] && p[1] === p[p.length - 1]) }));
    const dH = geo.hielo.anillos.map(an => { let d = ""; an.forEach((k, j) => { const a = arcosH[k < 0 ? -k - 1 : k]; const s = k < 0 ? invertir(a.segs) : a.segs; d += dSegs(s, j === 0); }); return d + "Z"; }).join("");
    el("path", { d: dH, class: "mv-hielo", "fill-rule": "evenodd" }, hielo);

    // ----- ríos: más anchos hacia la desembocadura (el extremo más cercano al agua)
    const rios = capa("rios", "Ríos");
    const finesAgua = costas.concat(arcos.filter(a => a.tipo === "orilla")).flatMap(a => { const r = []; for (let i = 0; i < a.p.length; i += 8) r.push([a.p[i], a.p[i + 1]]); return r; });
    const distAgua = (x, y) => { let m = 1e9; for (const [a, b] of finesAgua) { const d = (a - x) ** 2 + (b - y) ** 2; if (d < m) m = d; } return Math.sqrt(m); };
    for (const r of md.lineas.rios.filter(visible)) {
      let p = r.p; const n = p.length / 2;
      if (distAgua(p[0], p[1]) < distAgua(p[p.length - 2], p[p.length - 1])) { const q = []; for (let i = p.length - 2; i >= 0; i -= 2) q.push(p[i], p[i + 1]); p = q; }
      const segs = segmentos(p, false); const largo = segs.reduce((s, g) => s + Math.hypot(g[6] - g[0], g[7] - g[1]), 0);
      const maxW = Math.min(1.9, 0.6 + largo / 110);
      const tramos = Math.max(1, Math.min(5, Math.round(segs.length / 2)));
      const g = el("g", { "data-id": r.id }, rios);
      for (let t = 0; t < tramos; t++) {
        const a = Math.floor(segs.length * t / tramos), b = Math.floor(segs.length * (t + 1) / tramos); if (b <= a) continue;
        el("path", { d: dSegs(segs.slice(a, b), true), "stroke-width": r2(0.35 + (maxW - 0.35) * (t + 1) / tramos) }, g);
      }
    }

    // ----- caminos
    const caminos = capa("caminos", "Caminos");
    for (const c of md.lineas.caminos.filter(visible)) el("path", { d: dSegs(segmentos(c.p, false), true), "data-id": c.id }, caminos);

    // ----- fronteras y costa
    const fronteras = capa("fronteras", "Fronteras");
    const dFront = arcos.filter(a => a.tipo === "frontera").map(a => dArco(a, true)).join("");
    el("path", { d: dFront, class: "mv-frontera-fondo" }, fronteras);
    el("path", { d: dFront, class: "mv-frontera" }, fronteras);
    const costa = capa("costa", "Costa");
    el("path", { d: dCostas, class: "mv-costa-sombra" }, costa);
    el("path", { d: dCostas, class: "mv-costa" }, costa);
    el("path", { d: arcos.filter(a => a.tipo === "orilla").map(a => dArco(a, true)).join(""), class: "mv-orilla" }, costa);
    resalte = el("path", { class: "mv-resalte", d: "" }, costa);

    // ----- relieve
    const relieve = capa("relieve", "Relieve");
    const ALTO_ICONO = { mount: .78, mountSnow: .78, hill: .8, vulcan: .78, dune: .8 };
    for (const r of md.relieve.filter(visible)) {
      const fam = r.t.replace(/-\d+$/, ""), w = r.s, base = ALTO_ICONO[fam] || .86;
      el("use", { href: "#r-" + r.t, x: r2(r.x - w / 2), y: r2(r.y - w * base), width: r2(w), height: r2(w), "data-id": r.id, "data-lugar-id": r.lugarId }, relieve);
    }

    // ----- referencia (el original, para comparar)
    const ref = capa("referencia", "Mapa original");
    el("image", { href: PNG_ORIGINAL, x: 0, y: 0, width: W, height: H, preserveAspectRatio: "none" }, ref);
    ref.style.display = "none";

    // ----- etiquetas
    const etiquetas = capa("etiquetas", "Nombres");
    for (const e of md.etiquetas.filter(visible)) {
      const g = el("g", { class: "mv-etiqueta mv-etiqueta-" + e.tipo, transform: `translate(${e.x} ${e.y}) rotate(${e.a})`, "data-id": e.id }, etiquetas);
      g.__e = e; dibujarEtiqueta(g, e.t);
      if (e.lugarId) {
        g.dataset.lugarId = e.lugarId; g.setAttribute("tabindex", "0"); g.setAttribute("role", "button");
        g.setAttribute("aria-label", e.l.join(" ") + " — abrir ficha");
        ETIQUETAS.set(e.lugarId, g);
      }
    }
    // Los nombres que no cambian respecto al original miden lo mismo que allí (cuando la letra ya cargó)
    const ajustar = () => { for (const g of etiquetas.children) { const e = g.__e; if (!e || !e.ancho) continue; const t = g.querySelector("text"); const largo = t && t.getComputedTextLength(); if (largo > 0) dibujarEtiqueta(g, Math.max(8, Math.min(60, (+t.getAttribute("font-size") || e.t) * e.ancho / largo))); } };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { document.fonts.load("20px \"Almendra SC\"").then(ajustar, ajustar); });

    // ----- lugares
    const lugaresG = capa("lugares", "Lugares");
    const entradas = typeof ALL_ENTRIES !== "undefined" ? ALL_ENTRIES : [];
    for (const punto of window.MAPA_PUNTOS || []) {
      const lugar = entradas.find(e => e.id === punto.lugarId);
      if (!lugar) continue;
      if (typeof entryEsVisible === "function" && !entryEsVisible(lugar)) continue;
      const tipo = tipoDeLugar(lugar), info = TIPOS[tipo];
      // el editor puede mover un lugar: guarda solo la posición nueva, la ficha sigue en su sitio
      const mov = md.posiciones && md.posiciones[lugar.id];
      const x = mov ? mov[0] : punto.x / 100 * W, y = mov ? mov[1] : punto.y / 100 * H;
      LUGARES_IDX.push({ id: lugar.id, title: lugar.title, nombre: normalizar(lugar.title), tipoLabel: info.label, tipo, x, y });
      if (tipo === "reino" && ETIQUETAS.has(lugar.id)) { MARCAS.set(lugar.id, ETIQUETAS.get(lugar.id)); ETIQUETAS.get(lugar.id).dataset.x = x; ETIQUETAS.get(lugar.id).dataset.y = y; continue; }
      const g = el("g", { class: "mv-lugar mv-lugar-" + tipo, transform: `translate(${r2(x)} ${r2(y)})`, tabindex: "0", role: "button", "aria-label": `${lugar.title} (${info.label})`, "data-lugar-id": lugar.id, "data-tipo": tipo, "data-x": x, "data-y": y }, lugaresG);
      g.dataset.nombre = normalizar(lugar.title);
      const k = el("g", { class: "mv-lugar-escala" }, g);
      if (tipo === "reino" || tipo === "region") {
        // regiones grandes sin etiqueta en el original: su nombre en cursiva, discreto
        k.classList.add("mv-lugar-texto");
        const t = el("text", { y: 3, "text-anchor": "middle" }, k); t.textContent = lugar.title;
      } else {
        const ic = iconoDe(lugar, tipo); const s = info.tam;
        el("ellipse", { cx: 0, cy: 0.4, rx: s * 0.42, ry: s * 0.13, class: "mv-lugar-suelo" }, k);
        if (tipo === "aldea") el("circle", { cx: 0, cy: -2.4, r: 2.4, class: "mv-punto" }, k);
        if (ic.id) el("use", { href: "#" + ic.id, x: -s / 2, y: -s * 0.96, width: s, height: s, class: "mv-lugar-icono" }, k);
        else {
          const disco = el("g", { class: "mv-lugar-disco" }, k);
          el("circle", { cx: 0, cy: -s * 0.48, r: s * 0.44 }, disco);
          if (ic.relieve) el("use", { href: "#" + ic.relieve, x: -s * 0.36, y: -s * 0.86, width: s * 0.72, height: s * 0.72 }, disco);
          else if (ic.glifo === "lago") el("path", { d: `M${-s * .27} ${-s * .42}q${s * .1} ${-s * .2} ${s * .3} ${-s * .14}q${s * .24} ${s * .04} ${s * .22} ${s * .2}q${-s * .06} ${s * .14} ${-s * .3} ${s * .1}q${-s * .26} ${-s * .03} ${-s * .22} ${-s * .16}z`, class: "mv-glifo-lago" }, disco);
          else if (ic.glifo === "rio") el("path", { d: `M${-s * .3} ${-s * .38}c${s * .1} ${-s * .12} ${s * .2} ${s * .12} ${s * .3} 0s${s * .2} ${s * .12} ${s * .3} 0M${-s * .3} ${-s * .58}c${s * .1} ${-s * .12} ${s * .2} ${s * .12} ${s * .3} 0s${s * .2} ${s * .12} ${s * .3} 0`, class: "mv-glifo-rio" }, disco);
        }
        if (ic.puerto) el("use", { href: "#p-ancla", x: s * 0.18, y: -s * 0.36, width: s * 0.42, height: s * 0.42, class: "mv-lugar-ancla" }, k);
        const nombre = el("text", { class: "mv-lugar-nombre", y: 13, "text-anchor": "middle" }, k); nombre.textContent = lugar.title;
      }
      g.__lugar = lugar; g.__tipo = tipo; g.__sub = iconoDe(lugar, tipo).sub;
      MARCAS.set(lugar.id, g);
    }
    // orden de dibujo: lo que está más abajo tapa a lo de arriba, como en un mapa ilustrado
    [...lugaresG.children].sort((a, b) => (+a.dataset.y) - (+b.dataset.y)).forEach(n => lugaresG.appendChild(n));
    capas.lugares = lugaresG;
    if (medida) pintarMedida();
  }

  function dibujarEtiqueta(g, t) {
    const e = g.__e; g.querySelectorAll("path, text").forEach(n => n.remove());
    const n = e.l.length, sep = (e.s || 1.05) * t;
    e.l.forEach((linea, k) => {
      const off = (k - (n - 1) / 2) * sep + t * 0.34;
      const w = Math.max(40, linea.length * t * 1.2), pid = "mvEt-" + e.id + "-" + k;
      el("path", { id: pid, d: `M${r2(-w / 2)} ${r2(off)} Q0 ${r2(off - 2 * (e.c || 0))} ${r2(w / 2)} ${r2(off)}`, fill: "none", stroke: "none" }, g);
      const tx = el("text", { "font-size": r2(t) }, g);
      const tp = el("textPath", { href: "#" + pid, startOffset: "50%", "text-anchor": "middle" }, tx);
      tp.textContent = linea;
    });
  }

  // ---------- Modos de color: político, religión, región, continente ----------
  let modoColor = "politico";
  const PALETA = ["#e8b4a0", "#a9c8e8", "#c3dba5", "#e6d39a", "#c9b3e0", "#9fd3c7", "#f0c2d8", "#d6c3a3", "#b7c4d8", "#e3a98f", "#aed6a8", "#d9b6e8", "#f2d7a6", "#a8b8e0", "#cfe0a0", "#e0b0b8"];
  const MODOS = { politico: "Político", religion: "Religión predominante", region: "Región", continente: "Continente" };
  function categoriaDe(e) {
    const l = entradaDe(e.lugarId); if (!l) return null;
    if (modoColor === "religion") return (l.religionPredominante || "").trim() || null;
    const partes = (l.region || "").split(",").map(x => x.trim()).filter(Boolean);
    if (modoColor === "region") return partes[0] || null;
    if (modoColor === "continente") return partes[partes.length - 1] || null;
    return null;
  }
  function categorias() {
    const c = new Set(); for (const e of documentoAVer().geografia.estados) { const k = categoriaDe(e); if (k) c.add(k); }
    return [...c].sort((a, b) => a.localeCompare(b, "es"));
  }
  function colorDeEstado(e) {
    if (modoColor === "politico") return e.color;
    const k = categoriaDe(e); if (!k) return "#dcd5c3";
    return PALETA[categorias().indexOf(k) % PALETA.length];
  }
  function pintarLeyendaColor() {
    let caja = marco.querySelector(".mv-leyenda-color");
    if (modoColor === "politico") { if (caja) caja.remove(); return; }
    if (!caja) { caja = document.createElement("div"); caja.className = "mv-leyenda-color"; marco.appendChild(caja); }
    const cats = categorias(); const sinDato = documentoAVer().geografia.estados.some(e => !categoriaDe(e));
    caja.innerHTML = `<strong>${MODOS[modoColor]}</strong>` + cats.map((k, i) => `<span><i style="background:${PALETA[i % PALETA.length]}"></i>${escapar(k)}</span>`).join("") + (sinDato ? `<span><i style="background:#dcd5c3"></i><em>Sin dato en la ficha</em></span>` : "");
  }
  function ponerModoColor(m) { modoColor = MODOS[m] ? m : "politico"; construir(); aplicarVista(); pintarLeyendaColor(); pintarMedida(); }

  // ---------- Regla de viaje: distancia y días según los ritmos de D&D 5e ----------
  const RITMOS = [["A pie, lento", 29], ["A pie, normal", 38.6], ["A pie, rápido", 48], ["Barco de vela (día y noche)", 77]];
  let medida = null; // { puntos: [[x,y]...], cerrada: bool }
  function pintarMedida() {
    let g = svg.querySelector(".mv-medida"); if (g) g.remove();
    const caja = marco.querySelector(".mv-medida-caja");
    if (!medida) { if (caja) caja.remove(); return; }
    g = el("g", { class: "mv-medida" }, svg);
    const p = medida.puntos;
    if (p.length) {
      el("path", { d: "M" + p.map(q => q.map(r2).join(" ")).join("L") + (medida.cursor && !medida.cerrada ? "L" + medida.cursor.map(r2).join(" ") : ""), class: "mv-medida-linea" }, g);
      p.forEach((q, i) => el("circle", { cx: q[0], cy: q[1], r: 3.2 / (tamLienzo.w / vista.w), class: "mv-medida-punto" + (i === 0 ? " inicio" : "") }, g));
    }
    let px = 0; for (let i = 1; i < p.length; i++) px += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    const km = px * KM_POR_PX;
    const c = caja || (() => { const d = document.createElement("div"); d.className = "mv-medida-caja"; marco.appendChild(d); return d; })();
    const dias = v => { const d = km / v; return d < 1 ? `${Math.max(1, Math.round(d * 8))} h de marcha` : `${d.toFixed(d < 10 ? 1 : 0)} días`; };
    c.innerHTML = `<div class="mv-medida-cab"><strong>Regla de viaje</strong><button type="button" data-medida="cerrar" aria-label="Cerrar la regla">×</button></div>` +
      (p.length < 2 ? `<p>Pulsa en el mapa para marcar el camino. Doble clic termina.</p>` :
        `<p class="mv-medida-km">${Math.round(km).toLocaleString("es")} km <small>(${p.length - 1} tramo${p.length > 2 ? "s" : ""})</small></p><table>${RITMOS.map(([n, v]) => `<tr><td>${n}</td><td>${dias(v)}</td></tr>`).join("")}</table><p class="mv-medida-nota">Ritmos de viaje de D&D 5e: lento 29, normal 39 y rápido 48 km al día. Un caballo viaja al ritmo de la marcha en trayectos largos.</p>`) +
      `<div class="mv-medida-botones"><button type="button" data-medida="deshacer"${p.length ? "" : " disabled"}>Quitar el último</button><button type="button" data-medida="borrar"${p.length ? "" : " disabled"}>Empezar de nuevo</button></div>`;
  }
  function alternarMedida(on) {
    medida = on ? { puntos: [], cerrada: false } : null;
    marco.classList.toggle("mv-midiendo", !!medida);
    const b = document.getElementById("mvRegla"); if (b) b.setAttribute("aria-pressed", String(!!medida));
    pintarMedida();
  }

  // ---------- Qué ven los jugadores: el Admin lo ve todo; ellos solo lo que se publique ----------
  function funcionPublica(k) { return !!(mundo && mundo.ajustes && mundo.ajustes.publico && mundo.ajustes.publico[k]); }
  function actualizarFunciones() {
    const admin = soyAdmin();
    const regla = document.getElementById("mvRegla"); if (regla) regla.classList.toggle("hidden", !(admin || funcionPublica("regla")));
    const exp = document.getElementById("mvExportar"); if (exp) exp.classList.toggle("hidden", !(admin || funcionPublica("exportar")));
    const col = document.getElementById("mvModoColor"); if (col) col.closest(".mv-opcion").classList.toggle("hidden", !(admin || funcionPublica("colores")));
    const ep = document.getElementById("mvEpoca");
    if (ep) {
      const lista = (mundo.epocas || []).filter(e => admin || e.publica);
      ep.innerHTML = `<option value="">El presente</option>` + lista.map(e => `<option value="${escapar(e.id)}"${e.id === epocaVista ? " selected" : ""}>${escapar(e.nombre)}${e.publica ? "" : " (oculta)"}</option>`).join("");
      ep.closest(".mv-opcion").classList.toggle("hidden", !(admin || (funcionPublica("epocas") && lista.length)));
      const nota = document.getElementById("mvEpocaNota"); if (nota) nota.textContent = lista.length ? "" : "Todavía no hay épocas guardadas.";
    }
    const sep = document.getElementById("mvCapasExtra"); if (sep) sep.classList.toggle("hidden", !(admin || funcionPublica("colores") || funcionPublica("epocas")));
  }
  function verEpoca(id) { epocaVista = id || null; construir(); aplicarVista(); pintarLeyendaColor(); pintarMedida(); }

  // ---------- Exportar el mapa (PNG para imprimir o Roll20, SVG para editar fuera) ----------
  // Se arma un SVG autónomo: estilos, iconos, la letra y el mar van dentro, porque un SVG dibujado como imagen no carga nada de fuera.
  const aDataURL = blob => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(blob); });
  let recursosExport = null;
  async function recursosParaExportar() {
    if (recursosExport) return recursosExport;
    const [css, mar, fuentes] = await Promise.all([
      fetch(document.querySelector('link[href*="mapa-vectorial.css"], link[href*="visor.css"]').href).then(r => r.text()),
      fetch(RUTAS.mar).then(r => r.blob()).then(aDataURL),
      (async () => {
        try {
          const cssF = await fetch("https://fonts.googleapis.com/css2?family=Almendra+SC&family=Almendra:ital,wght@0,400;0,700;1,400&display=swap").then(r => r.text());
          const bloques = cssF.split("/* ").filter(b => b.startsWith("latin */"));
          const caras = await Promise.all(bloques.map(async b => { const url = (b.match(/url\((https:[^)]+)\)/) || [])[1]; if (!url) return ""; const data = await fetch(url).then(r => r.blob()).then(aDataURL); return b.slice(b.indexOf("@font-face")).replace(url, data); }));
          return caras.join("\n");
        } catch (_) { return ""; }
      })()
    ]);
    recursosExport = { css, mar, fuentes };
    return recursosExport;
  }
  async function construirSVGExport(opciones) {
    const { css, mar, fuentes } = await recursosParaExportar();
    const copia = svg.cloneNode(true);
    copia.setAttribute("xmlns", NS); copia.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    copia.removeAttribute("style"); copia.removeAttribute("role");
    let vb, mk;
    if (opciones.zona === "vista") { vb = [vista.x, vista.y, vista.w, altoDe(vista.w)]; mk = parseFloat(svg.style.getPropertyValue("--mk")) || 1; }
    else { vb = [0, 0, W, H]; mk = 1.15; copia.classList.remove("mv-z2", "mv-z3", "mv-z4"); }
    copia.setAttribute("viewBox", vb.map(r2).join(" "));
    copia.setAttribute("width", Math.round(vb[2] * opciones.escala)); copia.setAttribute("height", Math.round(vb[3] * opciones.escala));
    copia.setAttribute("style", `--mk:${mk}`);
    // fuera lo que no es del mapa: la referencia, la regla, el resalte
    copia.querySelectorAll(".mv-capa-referencia, .mv-medida, .mv-resalte, .ed-capa").forEach(n => n.remove());
    if (!opciones.lugares) copia.querySelectorAll(".mv-capa-lugares").forEach(n => n.remove());
    copia.querySelectorAll('[style*="display: none"]').forEach(n => n.remove());
    copia.querySelectorAll("image").forEach(img => { if ((img.getAttribute("href") || "").includes(RUTAS.mar.split("/").pop())) img.setAttribute("href", mar); });
    // iconos usados (relieve, castillos, puertos) dentro del propio SVG
    const usados = new Set([...copia.querySelectorAll("use")].map(u => (u.getAttribute("href") || "").slice(1)));
    const defs = copia.querySelector("defs") || copia.insertBefore(document.createElementNS(NS, "defs"), copia.firstChild);
    for (const id of usados) { const sym = document.getElementById(id); if (sym && sym.tagName.toLowerCase() === "symbol") defs.appendChild(sym.cloneNode(true)); }
    const estilo = document.createElementNS(NS, "style");
    estilo.textContent = fuentes + "\n" + css + "\n#mvSvg, svg { opacity: 1 !important; }";
    defs.appendChild(estilo);
    copia.removeAttribute("id"); copia.classList.add("mv-listo");
    return new XMLSerializer().serializeToString(copia);
  }
  function descargar(blob, nombre) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  async function exportar(opciones, boton) {
    const textoAntes = boton.innerHTML; boton.disabled = true; boton.innerHTML = `<span class="mv-giro-mini" aria-hidden="true"></span>Preparando…`;
    try {
      const texto = await construirSVGExport(opciones);
      const fecha = new Date().toISOString().slice(0, 10);
      if (opciones.formato === "svg") { descargar(new Blob([texto], { type: "image/svg+xml" }), `mapa-del-mundo-${fecha}.svg`); return; }
      const url = URL.createObjectURL(new Blob([texto], { type: "image/svg+xml;charset=utf-8" }));
      const img = new Image(); img.decoding = "async";
      await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error("el navegador no pudo dibujar el mapa")); img.src = url; });
      const lienzoPNG = document.createElement("canvas"); lienzoPNG.width = img.width; lienzoPNG.height = img.height;
      const ctx = lienzoPNG.getContext("2d"); ctx.fillStyle = "#55699a"; ctx.fillRect(0, 0, img.width, img.height); ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const png = await new Promise(ok => lienzoPNG.toBlob(ok, "image/png"));
      if (!png) throw new Error("la imagen es demasiado grande para este navegador; prueba una calidad menor");
      descargar(png, `mapa-del-mundo-${fecha}.png`);
      mostrarAviso(`Mapa exportado (${img.width} × ${img.height} px).`, "ok");
    } catch (e) { mostrarAviso("No se pudo exportar: " + (e.message || e), "error"); }
    finally { boton.disabled = false; boton.innerHTML = textoAntes; }
  }
  function abrirExportar() {
    let caja = marco.querySelector(".mv-exportar");
    if (caja) { caja.remove(); document.getElementById("mvExportar")?.setAttribute("aria-expanded", "false"); return; }
    caja = document.createElement("div"); caja.className = "mv-exportar mv-capas"; caja.setAttribute("role", "dialog"); caja.setAttribute("aria-label", "Exportar el mapa");
    caja.innerHTML = `<h3>Exportar el mapa</h3>
      <label class="mv-opcion">Qué parte<select data-ex="zona"><option value="mundo">El mundo entero</option><option value="vista">Lo que se ve ahora</option></select></label>
      <label class="mv-opcion">Formato<select data-ex="formato"><option value="png">Imagen PNG (imprimir, Roll20)</option><option value="svg">Vector SVG (editar fuera)</option></select></label>
      <label class="mv-opcion" data-solo-png>Tamaño<select data-ex="escala"><option value="2">Normal (×2)</option><option value="3" selected>Grande (×3)</option><option value="4">Muy grande (×4)</option></select></label>
      <label><input type="checkbox" data-ex="lugares" checked> Incluir los lugares</label>
      <p class="mv-exportar-nota">Se exporta con las capas que tengas encendidas.</p>
      <button type="button" class="mv-exportar-boton">Descargar</button>`;
    marco.appendChild(caja);
    document.getElementById("mvExportar")?.setAttribute("aria-expanded", "true");
    const leer = () => ({ zona: caja.querySelector('[data-ex="zona"]').value, formato: caja.querySelector('[data-ex="formato"]').value, escala: +caja.querySelector('[data-ex="escala"]').value, lugares: caja.querySelector('[data-ex="lugares"]').checked });
    caja.addEventListener("change", () => { caja.querySelector("[data-solo-png]").classList.toggle("hidden", leer().formato !== "png"); });
    const b = caja.querySelector(".mv-exportar-boton");
    b.addEventListener("click", () => { const o = leer(); exportar(o.formato === "svg" ? Object.assign(o, { escala: 1 }) : o, b); });
  }

  // ---------- Interacción ----------
  let tooltipActual = null;
  function colocarTooltip(nodo) {
    const ms = marco.getBoundingClientRect(); const r = nodo.getBoundingClientRect();
    tooltip.style.left = (r.left + r.width / 2 - ms.left) + "px";
    tooltip.style.top = (r.top - ms.top) + "px";
  }
  function mostrarTooltip(nodo) {
    const lugar = nodo.__lugar || entradaDe(nodo.dataset.lugarId); if (!lugar) return;
    const tipo = nodo.__tipo ? TIPOS[nodo.__tipo].label : "Reino";
    const sub = nodo.__sub && nodo.__sub !== tipo ? " · " + nodo.__sub : "";
    tooltip.innerHTML = `<strong>${escapar(lugar.title)}</strong><span>${tipo}${sub}</span>${lugar.summary ? `<em>${escapar(lugar.summary.length > 110 ? lugar.summary.slice(0, 108) + "…" : lugar.summary)}</em>` : ""}`;
    tooltip.classList.add("visible"); tooltipActual = nodo; colocarTooltip(nodo);
  }
  function ocultarTooltip() { tooltip.classList.remove("visible"); tooltipActual = null; }
  const escapar = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const entradaDe = id => (typeof ALL_ENTRIES !== "undefined" ? ALL_ENTRIES : []).find(e => e.id === id);
  let seleccionado = null;
  function abrir(nodo) {
    const lugar = nodo.__lugar || entradaDe(nodo.dataset.lugarId); if (!lugar) return;
    if (seleccionado) seleccionado.classList.remove("mv-sel");
    seleccionado = nodo; nodo.classList.add("mv-sel");
    ocultarTooltip();
    if (typeof openEntryModal === "function") openEntryModal(lugar);
  }

  function enlazar() {
    // arrastrar y zoom
    const punteros = new Map(); let arrastre = null, movido = false, pellizco = null;
    marco.addEventListener("pointerdown", e => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (punteros.size === 1) { arrastre = { x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y }; movido = false; }
      else if (punteros.size === 2) { const [a, b] = [...punteros.values()]; pellizco = { d: Math.hypot(a.x - b.x, a.y - b.y), w: vista.w, centro: aMapa((a.x + b.x) / 2, (a.y + b.y) / 2) }; arrastre = null; }
    });
    marco.addEventListener("pointermove", e => {
      if (!punteros.has(e.pointerId)) {
        if (medida && !medida.cerrada && medida.puntos.length) { medida.cursor = aMapa(e.clientX, e.clientY); const ln = svg.querySelector(".mv-medida-linea"); if (ln) ln.setAttribute("d", "M" + medida.puntos.map(q => q.map(r2).join(" ")).join("L") + "L" + medida.cursor.map(r2).join(" ")); }
        const nodo = e.target.closest && e.target.closest(".mv-lugar, .mv-etiqueta[data-lugar-id]"); if (nodo !== tooltipActual) { if (nodo) mostrarTooltip(nodo); else ocultarTooltip(); }
        const reg = !nodo && e.target.closest ? e.target.closest(".mv-region-clic") : null;
        if (reg !== regionResaltada && resalte) { regionResaltada = reg; resalte.setAttribute("d", reg ? reg.getAttribute("d") : ""); }
        return;
      }
      punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pellizco && punteros.size === 2) {
        const [a, b] = [...punteros.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        const nw = Math.min(maxW(), Math.max(minW, pellizco.w * pellizco.d / d)); const f = nw / vista.w;
        vista.x = pellizco.centro[0] - (pellizco.centro[0] - vista.x) * f; vista.y = pellizco.centro[1] - (pellizco.centro[1] - vista.y) * f; vista.w = nw; limitar(); pedirVista(); movido = true; return;
      }
      if (!arrastre) return;
      const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
      if (!movido && Math.hypot(dx, dy) < 4) return;
      if (!movido) { if (resalte) { resalte.setAttribute("d", ""); regionResaltada = null; } movido = true; try { marco.setPointerCapture(e.pointerId); } catch (_) {} marco.classList.add("mv-arrastrando"); ocultarTooltip(); }
      const r = lienzo.getBoundingClientRect();
      vista.x = arrastre.vx - dx / r.width * vista.w; vista.y = arrastre.vy - dy / r.height * altoDe(vista.w); limitar(); pedirVista();
    });
    const soltar = e => {
      punteros.delete(e.pointerId); if (punteros.size < 2) pellizco = null;
      if (!punteros.size) { arrastre = null; marco.classList.remove("mv-arrastrando"); }
    };
    marco.addEventListener("pointerup", soltar); marco.addEventListener("pointercancel", soltar);
    marco.addEventListener("click", e => {
      if (movido) { movido = false; return; }
      const bm = e.target.closest("[data-medida]");
      if (bm) { const a = bm.dataset.medida; if (a === "cerrar") alternarMedida(false); else if (a === "borrar") { medida = { puntos: [], cerrada: false }; pintarMedida(); } else if (a === "deshacer") { medida.puntos.pop(); medida.cerrada = false; pintarMedida(); } return; }
      if (medida) {
        if (e.target.closest(".mv-medida-caja, .mv-controles, .mv-capas")) return;
        if (medida.cerrada) medida = { puntos: [], cerrada: false };
        medida.puntos.push(aMapa(e.clientX, e.clientY)); pintarMedida(); return;
      }
      if (marco.classList.contains("mv-editando")) return; // el editor decide qué hace un clic
      const nodo = e.target.closest(".mv-lugar, .mv-etiqueta[data-lugar-id], .mv-region-clic");
      if (nodo) abrir(nodo);
    });
    marco.addEventListener("dblclick", e => {
      if (medida) { e.preventDefault(); const p = medida.puntos; if (p.length > 1) { const a = p[p.length - 1], b = p[p.length - 2]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) * (tamLienzo.w / vista.w) < 6) p.pop(); } medida.cerrada = true; medida.cursor = null; pintarMedida(); return; } const [mx, my] = aMapa(e.clientX, e.clientY); const objetivo = Math.max(minW, vista.w / 2); const h = altoDe(objetivo); animarA({ x: mx - objetivo / 2, y: my - h / 2, w: objetivo }); });
    marco.addEventListener("wheel", e => { e.preventDefault(); const [mx, my] = aMapa(e.clientX, e.clientY); zoomEn(mx, my, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018))); }, { passive: false });
    marco.addEventListener("pointerleave", () => { if (!punteros.size) ocultarTooltip(); });
    // teclado: flechas para moverse, + y - para el zoom, Enter abre la ficha del lugar enfocado
    marco.addEventListener("keydown", e => {
      const paso = vista.w * 0.12;
      if (e.target.closest && e.target.closest(".mv-lugar, .mv-etiqueta[data-lugar-id]") && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); abrir(e.target.closest(".mv-lugar, .mv-etiqueta[data-lugar-id]")); return; }
      const mov = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
      if (mov) { e.preventDefault(); animarA({ x: vista.x + mov[0], y: vista.y + mov[1], w: vista.w }, 180); return; }
      if (e.key === "+" || e.key === "=") { e.preventDefault(); botonZoom(1.6); }
      if (e.key === "-") { e.preventDefault(); botonZoom(1 / 1.6); }
      if (e.key === "0") { e.preventDefault(); restablecer(); }
      if (medida && e.key === "Escape") { e.preventDefault(); alternarMedida(false); }
      if (medida && e.key === "Backspace" && medida.puntos.length) { e.preventDefault(); medida.puntos.pop(); medida.cerrada = false; pintarMedida(); }
    });
    marco.addEventListener("focusin", e => { const n = e.target.closest && e.target.closest(".mv-lugar, .mv-etiqueta[data-lugar-id]"); if (n) mostrarTooltip(n); });
    marco.addEventListener("focusout", () => ocultarTooltip());
    const alRedimensionar = () => { medirLienzo(); limitar(); aplicarVista(); };
    window.addEventListener("resize", alRedimensionar);
    if (window.ResizeObserver) new ResizeObserver(alRedimensionar).observe(lienzo);
    document.addEventListener("fullscreenchange", () => { marco.classList.toggle("mv-pantalla", document.fullscreenElement === marco); setTimeout(alRedimensionar, 50); });
    const bp = document.getElementById("mvPantalla");
    if (bp) bp.addEventListener("click", () => { if (document.fullscreenElement) document.exitFullscreen(); else if (marco.requestFullscreen) marco.requestFullscreen().catch(() => {}); });

    // controles
    document.getElementById("mvMas").addEventListener("click", () => botonZoom(1.6));
    document.getElementById("mvMenos").addEventListener("click", () => botonZoom(1 / 1.6));
    document.getElementById("mvInicio").addEventListener("click", restablecer);
    const botonCapas = document.getElementById("mvCapasBoton"), panel = document.getElementById("mvCapas");
    botonCapas.addEventListener("click", () => { const abierto = panel.hidden; panel.hidden = !abierto; botonCapas.setAttribute("aria-expanded", String(abierto)); });
    panel.addEventListener("change", e => {
      const c = e.target.closest("[data-capa]"); if (!c) return;
      for (const id of c.dataset.capa.split(",")) if (capas[id]) capas[id].style.display = c.checked ? "" : "none";
      if (c.dataset.capa === "referencia") document.getElementById("mvRefOpacidad").disabled = !c.checked;
    });
    const bExp = document.getElementById("mvExportar"); if (bExp) bExp.addEventListener("click", abrirExportar);
    const regla = document.getElementById("mvRegla");
    if (regla) regla.addEventListener("click", () => { if (marco.classList.contains("mv-editando")) { mostrarAviso("Sal del editor para usar la regla."); return; } alternarMedida(!medida); });
    const modo = document.getElementById("mvModoColor"); if (modo) modo.addEventListener("change", () => ponerModoColor(modo.value));
    const epoca = document.getElementById("mvEpoca"); if (epoca) epoca.addEventListener("change", () => verEpoca(epoca.value));
    const op = document.getElementById("mvRefOpacidad");
    op.addEventListener("input", () => { capas.referencia.style.opacity = op.value / 100; });
    capas.referencia.style.opacity = op.value / 100;
  }
  function botonZoom(f) { const cx = vista.x + vista.w / 2, cy = vista.y + altoDe(vista.w) / 2; const nw = Math.min(maxW(), Math.max(minW, vista.w / f)); const h = altoDe(nw); animarA({ x: cx - nw / 2, y: cy - h / 2, w: nw }, 280); }
  function restablecer() { const w = maxW(), h = altoDe(w); animarA({ x: (W - w) / 2, y: (H - h) / 2, w }); }

  // ---------- Filtros de la leyenda y buscador (igual que el mapa de siempre) ----------
  function enlazarBusqueda() {
    if (mapaFiltros) mapaFiltros.addEventListener("change", e => {
      const cb = e.target.closest("[data-filtro-tipo]"); if (!cb) return;
      svg.querySelectorAll(`.mv-lugar[data-tipo="${cb.dataset.filtroTipo}"]`).forEach(n => n.classList.toggle("mv-oculto-tipo", !cb.checked));
      if (cb.dataset.filtroTipo === "reino") capas.etiquetas.classList.toggle("mv-oculto-tipo", !cb.checked);
    });
    if (!mapaBusqueda) return;
    const ocultarSug = () => { mapaSugerencias.classList.add("hidden"); mapaSugerencias.innerHTML = ""; };
    function sugerir(q) {
      if (!q) { ocultarSug(); return; }
      const res = LUGARES_IDX.filter(l => l.nombre.includes(q)).sort((a, b) => (a.nombre.startsWith(q) ? 0 : 1) - (b.nombre.startsWith(q) ? 0 : 1) || a.title.localeCompare(b.title)).slice(0, 8);
      if (!res.length) { ocultarSug(); return; }
      mapaSugerencias.innerHTML = res.map(l => {
        const i = l.nombre.indexOf(q); const t = escapar(l.title);
        const marcado = i >= 0 ? escapar(l.title.slice(0, i)) + "<mark>" + escapar(l.title.slice(i, i + q.length)) + "</mark>" + escapar(l.title.slice(i + q.length)) : t;
        return `<button type="button" class="mapa-suggestion" data-lugar-id="${l.id}">${marcado}<small>${l.tipoLabel}</small></button>`;
      }).join("");
      mapaSugerencias.classList.remove("hidden");
    }
    mapaBusqueda.addEventListener("input", () => {
      const q = normalizar(mapaBusqueda.value.trim());
      svg.classList.toggle("mv-buscando", !!q);
      svg.querySelectorAll(".mv-lugar").forEach(n => n.classList.toggle("mv-coincide", !!q && n.dataset.nombre.includes(q)));
      sugerir(q);
    });
    mapaBusqueda.addEventListener("keydown", e => { if (e.key === "Escape") ocultarSug(); });
    mapaBusqueda.addEventListener("focus", () => sugerir(normalizar(mapaBusqueda.value.trim())));
    mapaSugerencias.addEventListener("click", e => {
      const b = e.target.closest("[data-lugar-id]"); if (!b) return;
      const l = LUGARES_IDX.find(x => x.id === b.dataset.lugarId); if (l) mapaBusqueda.value = l.title;
      ocultarSug(); svg.classList.remove("mv-buscando");
      enfocar(b.dataset.lugarId, false);
      const entry = entradaDe(b.dataset.lugarId); if (entry && typeof openEntryModal === "function") openEntryModal(entry);
    });
    document.addEventListener("click", e => { if (e.target === mapaBusqueda || mapaSugerencias.contains(e.target)) return; ocultarSug(); });
  }

  // Lleva la vista a un lugar y lo resalta
  function enfocar(lugarId, cerrarModal = true) {
    const n = MARCAS.get(lugarId); if (!n) return false;
    if (cerrarModal && typeof modal !== "undefined" && modal.open) modal.close();
    n.classList.remove("mv-oculto-tipo");
    const x = +n.dataset.x, y = +n.dataset.y;
    centrarEn(x, y, Math.min(vista.w, W / 3.2));
    n.classList.remove("mv-destello"); void n.getBoundingClientRect(); n.classList.add("mv-destello");
    setTimeout(() => n.classList.remove("mv-destello"), 2400);
    marco.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  }
  window.mapaTienePin = id => MARCAS.has(id);
  // API pequeña para pruebas y para el editor futuro
  window.mapaVectorial = {
    // para el editor (js aparte, solo admin)
    interno: {
      mundo: () => mundo, version: () => versionGuardada,
      setVersion: v => { versionGuardada = v; try { localStorage.setItem(CLAVE_CACHE, JSON.stringify({ version: v, datos: mundo })); } catch (_) {} },
      cargarGuardado,
      reemplazar: m => { mundo = m; construir(); aplicarVista(); actualizarFunciones(); pintarLeyendaColor(); if (mapaBusqueda && mapaBusqueda.value) mapaBusqueda.dispatchEvent(new Event("input")); },
      reconstruir: () => { construir(); aplicarVista(); }, actualizarFunciones: () => actualizarFunciones(), verEpoca: id => verEpoca(id),
      aMapa: (cx, cy) => aMapa(cx, cy), pxPorUnidad: () => tamLienzo.w / vista.w, svg, marco, lienzo, capas, el, segmentos, dSegs, r2,
      alCambiar: fn => { oyentesVista.push(fn); }, botonZoom, restablecer, mostrarAviso
    },
    irA: (x, y, w) => { const h = altoDe(w); vista.x = x - w / 2; vista.y = y - h / 2; vista.w = w; limitar(); aplicarVista(); }, vista: () => ({ ...vista }), capas: () => capas, referencia: (op) => { capas.referencia.style.display = op ? "" : "none"; capas.referencia.style.opacity = op || 0; } };
  window.focusMapaPin = id => enfocar(id, true);

  // ---------- Plan B: el mapa de siempre ----------
  function planB(motivo) {
    console.warn("Mapa vectorial no disponible:", motivo);
    marco.classList.add("mv-plan-b");
    svg.remove();
    const img = document.createElement("img"); img.src = PNG_ORIGINAL; img.alt = "Mapa del mundo"; img.className = "mapa-image";
    lienzo.appendChild(img);
    (window.MAPA_PUNTOS || []).forEach(p => {
      const lugar = entradaDe(p.lugarId); if (!lugar) return;
      const b = document.createElement("button"); b.type = "button"; b.className = "mapa-pin"; b.style.left = p.x + "%"; b.style.top = p.y + "%"; b.title = lugar.title; b.setAttribute("aria-label", lugar.title);
      b.addEventListener("click", () => openEntryModal(lugar)); lienzo.appendChild(b);
    });
    avisoCarga.classList.add("mv-error"); avisoCarga.textContent = "No se pudo cargar el mapa nuevo. Se muestra el de siempre.";
    setTimeout(() => avisoCarga.classList.add("mv-oculto"), 4000);
  }

  // ---------- Mapa guardado en Supabase (si existe la tabla y hay una versión guardada) ----------
  let versionGuardada = 0;
  const CLAVE_CACHE = "mapaMundoGuardado";
  async function cargarGuardado() {
    if (typeof fichasCliente !== "function") return null;
    const consulta = (async () => {
      const sb = await fichasCliente();
      const { data, error } = await sb.from("mapa_mundo").select("version, datos").eq("id", "principal").maybeSingle();
      if (error || !data) return null;
      return data;
    })();
    return Promise.race([consulta, new Promise(ok => setTimeout(() => ok(null), 15000))]).catch(() => null);
  }
  const oyentesVista = [];
  function alCambiarVista() { if (medida) pintarMedida(); for (const f of oyentesVista) try { f(); } catch (_) {} }
  let avisoTimer = null;
  function mostrarAviso(texto, tipo) {
    let a = marco.querySelector(".mv-aviso"); if (!a) { a = document.createElement("div"); a.className = "mv-aviso"; a.setAttribute("role", "status"); marco.appendChild(a); }
    a.textContent = texto; a.dataset.tipo = tipo || "info"; a.classList.add("visible");
    clearTimeout(avisoTimer); avisoTimer = setTimeout(() => a.classList.remove("visible"), tipo === "error" ? 6000 : 3200);
  }

  // ---------- Editor (solo admin, se carga al pedirlo) ----------
  function prepararEditor() {
    const b = document.getElementById("mvEditar"); if (!b) return;
    // el botón lleva data-admin-only: la web lo muestra u oculta según la sesión (js/lado.js)
    b.addEventListener("click", async () => {
      if (!(typeof esAdmin === "function" && esAdmin())) { mostrarAviso("Solo un Admin puede editar el mapa.", "error"); return; }
      if (medida) alternarMedida(false);
      if (epocaVista) { epocaVista = null; const ep = document.getElementById("mvEpoca"); if (ep) ep.value = ""; construir(); aplicarVista(); }
      if (window.MapaEditor) { window.MapaEditor.alternar(); return; }
      b.disabled = true; b.classList.add("mv-esperando");
      try {
        await new Promise((ok, no) => { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = RUTAS.editorCss + "?v=" + (window.MAPA_VECTORIAL_V || ""); l.onload = ok; l.onerror = ok; document.head.appendChild(l); });
        await new Promise((ok, no) => { const sc = document.createElement("script"); sc.src = RUTAS.editorJs + "?v=" + (window.MAPA_VECTORIAL_V || ""); sc.onload = ok; sc.onerror = () => no(new Error("no se pudo cargar el editor")); document.body.appendChild(sc); });
        window.MapaEditor.alternar();
      } catch (e) { mostrarAviso(e.message, "error"); }
      finally { b.disabled = false; b.classList.remove("mv-esperando"); }
    });
  }

  // ---------- Arranque ----------
  async function iniciar() {
    try {
      const valido = d => d && d.esquema === 1 && d.geografia && Array.isArray(d.geografia.arcos) && Array.isArray(d.geografia.estados);
      const [archivo, iconos] = await Promise.all([
        fetch(RUTAS.datos + "?v=" + (window.MAPA_VECTORIAL_V || "")).then(r => { if (!r.ok) throw new Error("mundo.json " + r.status); return r.json(); }).catch(e => ({ error: e })),
        fetch(RUTAS.iconos + "?v=" + (window.MAPA_VECTORIAL_V || "")).then(r => r.ok ? r.text() : "").catch(() => "")
      ]);
      // la última versión guardada que vio este navegador se pinta enseguida; si no hay, el archivo
      let cache = null; try { cache = JSON.parse(localStorage.getItem(CLAVE_CACHE) || "null"); } catch (_) {}
      if (cache && valido(cache.datos)) { mundo = cache.datos; versionGuardada = cache.version; }
      else if (valido(archivo)) mundo = archivo;
      else throw new Error(archivo && archivo.error ? archivo.error.message : "formato desconocido");
      if (iconos) { const d = document.createElement("div"); d.className = "mv-sprite"; d.setAttribute("aria-hidden", "true"); d.innerHTML = iconos; document.body.appendChild(d); }
      else marco.classList.add("mv-sin-iconos");
      const t0 = performance.now();
      medirLienzo(); construir(); enlazar(); enlazarBusqueda(); vista.w = maxW(); limitar(); aplicarVista();
      marco.dataset.tiempoConstruccion = Math.round(performance.now() - t0);
      avisoCarga.classList.add("mv-oculto");
      marco.classList.add("mv-listo");
      prepararEditor(); actualizarFunciones();
      document.addEventListener("click", e => { if (e.target.closest && e.target.closest("#globalLadoWidget")) setTimeout(actualizarFunciones, 1500); });
      try { if (/[?&]fps/.test(location.search) || localStorage.getItem("mapaFps") === "1") medidor = crearMedidor(); } catch (_) {}
      // después, sin hacer esperar a nadie: ¿hay una versión guardada más nueva en Supabase?
      cargarGuardado().then(g => {
        if (!g) { if (cache && valido(archivo)) { /* la tabla ya no tiene nada: se vuelve al archivo */ } return; }
        if (!valido(g.datos) || g.version === versionGuardada) return;
        try { localStorage.setItem(CLAVE_CACHE, JSON.stringify(g)); } catch (_) {}
        if (marco.classList.contains("mv-editando")) return; // no se cambia el mapa bajo los pies del editor
        mundo = g.datos; versionGuardada = g.version; construir(); aplicarVista();
      });
    } catch (err) { planB(err && err.message); }
  }
  iniciar();
})();
