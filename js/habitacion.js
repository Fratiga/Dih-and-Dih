/* Mi habitación: tu colección, tus mazos y los seis corrales donde crían tus criaturas.
   Toda la lógica (parejas, fases, límites, sobrepoblación) vive en el servidor (docs/economia-18_crianza.sql); esta página dibuja la
   escena, cuenta el tiempo con el reloj del servidor y llama a cartas_corral_iniciar / recoger / sacar. */
(function () {
  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const NS = "http://www.w3.org/2000/svg";

  // Dónde está cada corral en la escena
  const POS = { aviario: [290, 200], bosque: [430, 200], madriguera: [570, 200], pantano: [290, 350], glaciar: [430, 350], cubil: [570, 350] };
  const RAREZAS = { comun: "común", infrecuente: "poco común", rara: "rara", legendaria: "legendaria", limitada: "limitada" };

  // El dibujo de cada corral (120 x 100), con sus bichos escondidos hasta que haya una cría en marcha
  const ARTE = {
    aviario: () => `<rect width="120" height="100" fill="#3c5a82"/><rect x="10" y="12" width="28" height="8" fill="#dbe8f5"/><rect x="18" y="6" width="16" height="8" fill="#dbe8f5"/><rect x="78" y="24" width="30" height="8" fill="#dbe8f5"/><rect x="86" y="18" width="14" height="8" fill="#dbe8f5"/>
      <rect x="0" y="82" width="120" height="18" fill="#7a5a3a"/><rect x="12" y="56" width="96" height="5" fill="#8d6a45"/><rect x="22" y="44" width="5" height="12" fill="#6b4a2f"/><rect x="92" y="44" width="5" height="12" fill="#6b4a2f"/>
      <rect x="0" y="0" width="3" height="82" fill="#c9c2d6"/><rect x="117" y="0" width="3" height="82" fill="#c9c2d6"/><rect x="40" y="0" width="2" height="30" fill="#c9c2d6" opacity=".5"/><rect x="78" y="0" width="2" height="30" fill="#c9c2d6" opacity=".5"/>`,
    bosque: () => `<rect width="120" height="100" fill="#3f6b3a"/><rect y="70" width="120" height="30" fill="#34592f"/>
      <rect x="12" y="30" width="8" height="34" fill="#5a3d28"/><rect x="2" y="12" width="28" height="22" fill="#2a4f2a"/><rect x="8" y="4" width="16" height="12" fill="#2a4f2a"/>
      <rect x="96" y="36" width="8" height="30" fill="#5a3d28"/><rect x="88" y="20" width="24" height="20" fill="#2a4f2a"/>
      <rect x="44" y="68" width="34" height="14" fill="#d4b24a"/><rect x="44" y="68" width="34" height="3" fill="#ecd275"/>`,
    madriguera: () => `<rect width="120" height="100" fill="#5b4331"/><rect y="0" width="120" height="16" fill="#6b5039"/><rect x="0" y="16" width="120" height="3" fill="#3f2d20"/>
      <rect x="30" y="46" width="60" height="38" fill="#7a5a3f"/><rect x="42" y="54" width="36" height="30" fill="#1a110b"/><rect x="50" y="48" width="20" height="8" fill="#1a110b"/>
      <rect x="8" y="64" width="16" height="6" fill="#3f2d20"/><rect x="96" y="30" width="14" height="6" fill="#3f2d20"/><rect x="94" y="72" width="18" height="8" fill="#8a6a4a"/>`,
    pantano: () => `<rect width="120" height="100" fill="#3d5a3a"/><rect y="34" width="120" height="66" fill="#2f5c5a"/><rect x="10" y="48" width="30" height="3" fill="#4c8a86"/><rect x="60" y="62" width="40" height="3" fill="#4c8a86"/><rect x="24" y="76" width="34" height="3" fill="#4c8a86"/>
      <rect x="8" y="14" width="3" height="40" fill="#6aa04a"/><rect x="14" y="8" width="3" height="46" fill="#7fb85a"/><rect x="104" y="12" width="3" height="42" fill="#6aa04a"/><rect x="110" y="20" width="3" height="34" fill="#7fb85a"/>
      <rect x="70" y="44" width="16" height="6" fill="#4f9a45"/><rect x="40" y="58" width="12" height="5" fill="#4f9a45"/>`,
    glaciar: () => `<rect width="120" height="100" fill="#a6cde3"/><rect y="70" width="120" height="30" fill="#e9f4fa"/>
      <rect x="10" y="40" width="30" height="40" fill="#7fb4d4"/><rect x="16" y="30" width="18" height="12" fill="#9fc8e0"/><rect x="82" y="46" width="28" height="34" fill="#7fb4d4"/><rect x="88" y="38" width="16" height="10" fill="#9fc8e0"/>
      <polygon points="0,0 14,0 7,20" fill="#dff1fa"/><polygon points="40,0 56,0 48,24" fill="#dff1fa"/><polygon points="84,0 100,0 92,18" fill="#dff1fa"/><rect x="50" y="64" width="22" height="10" fill="#fff"/>`,
    cubil: () => `<rect width="120" height="100" fill="#4a3028"/><rect y="64" width="120" height="36" fill="#3a2420"/>
      <rect x="6" y="30" width="30" height="40" fill="#6b6370"/><rect x="12" y="22" width="18" height="12" fill="#857d8c"/><rect x="88" y="38" width="26" height="34" fill="#6b6370"/><rect x="94" y="30" width="14" height="10" fill="#857d8c"/>
      <rect x="48" y="52" width="24" height="28" fill="#d9c9a0"/><rect x="52" y="46" width="16" height="8" fill="#d9c9a0"/><rect x="54" y="60" width="4" height="4" fill="#a8956a"/><rect x="62" y="70" width="4" height="4" fill="#a8956a"/>
      <rect x="40" y="84" width="40" height="8" fill="#e0662a" opacity=".8"/>`
  };
  // Dos bichos genéricos que aparecen cuando hay una pareja en el corral
  const BICHOS = `<g class="hb-bichos"><g class="hb-bicho"><rect x="30" y="58" width="16" height="9"/><rect x="44" y="52" width="8" height="8"/><rect x="32" y="67" width="3" height="5"/><rect x="42" y="67" width="3" height="5"/></g>
    <g class="hb-bicho hb-b2"><rect x="72" y="58" width="16" height="9"/><rect x="68" y="52" width="8" height="8"/><rect x="74" y="67" width="3" height="5"/><rect x="84" y="67" width="3" height="5"/></g></g>`;

  let supa = null, miId = null;
  let ver = null, offset = 0, historial = [], perfil = null, colec = null, abierto = null, cargando = false;
  const ahora = () => Date.now() + offset;
  const cartaDe = id => (window.cartaPorId && window.cartaPorId(id)) || null;
  const nombreCarta = id => { const c = cartaDe(id); return c ? c.nombre : id; };

  function aviso(t, error) {
    const a = $("hbAviso");
    a.textContent = t || "";
    a.classList.toggle("hidden", !t);
    a.classList.toggle("hb-error", !!error);
  }
  async function rpc(nombre, args) {
    const { data, error } = await supa.rpc(nombre, args || {});
    if (error) throw error;
    return data;
  }
  function dur(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    if (d) return `${d} d ${h} h`;
    if (h) return `${h} h ${String(m).padStart(2, "0")} min`;
    if (m) return `${m} min ${String(r).padStart(2, "0")} s`;
    return `${r} s`;
  }
  const horasTxt = h => h >= 1 ? `${Math.round(h * 10) / 10} h` : `${Math.round(h * 60)} min`;

  /* ------------------------------------------------------------------ escena */
  function el(tag, attrs, html) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (html) e.innerHTML = html;
    return e;
  }
  function decorar() {
    const t = $("hbTablones"), s = $("hbSuelo");
    for (let i = 0; i <= 960; i += 48) t.appendChild(el("rect", { x: i, y: 0, width: 2, height: 296, fill: "#231a2d" }));
    for (let y = 330, k = 0; y < 540; y += 30, k++) {
      s.appendChild(el("rect", { x: 0, y, width: 960, height: 2, fill: "#46301f" }));
      for (let x = (k % 2) * 90; x < 960; x += 180) s.appendChild(el("rect", { x, y, width: 2, height: 30, fill: "#46301f" }));
    }
    // El cielo de la ventana sigue la hora del jugador
    const h = new Date().getHours(), a = $("hbAstros");
    const cielo = h >= 7 && h < 18 ? "#6fb4e8" : h >= 18 && h < 21 ? "#c9703a" : "#1b2748";
    $("hbCielo").setAttribute("fill", cielo);
    if (h >= 7 && h < 18) a.innerHTML = `<rect x="124" y="66" width="22" height="22" fill="#fff1b0"/><rect x="62" y="84" width="30" height="8" fill="#fff"/><rect x="70" y="78" width="16" height="8" fill="#fff"/>`;
    else if (h >= 18 && h < 21) a.innerHTML = `<rect x="60" y="130" width="90" height="34" fill="#a04a2a"/><rect x="118" y="112" width="24" height="24" fill="#ffd27a"/>`;
    else a.innerHTML = `<rect x="124" y="68" width="18" height="18" fill="#f2ead2"/><rect x="130" y="68" width="12" height="18" fill="#1b2748"/><rect x="64" y="80" width="4" height="4" fill="#fff"/><rect x="86" y="128" width="4" height="4" fill="#fff"/><rect x="146" y="116" width="4" height="4" fill="#fff"/><rect x="72" y="150" width="4" height="4" fill="#fff"/>`;
    // Los corrales
    const g = $("hbCorrales");
    for (const h2 of Object.keys(POS)) {
      const [x, y] = POS[h2];
      const e = el("g", { class: "lb-spot hb-corral hb-e-vacio", "data-h": h2, tabindex: "0", role: "button", transform: `translate(${x} ${y})` });
      e.innerHTML = `<g class="lb-forma">${ARTE[h2]()}${BICHOS}</g><rect class="hb-marco" x="0" y="0" width="120" height="100"/>
        <rect class="hb-barra-fondo" x="8" y="88" width="104" height="6"/><rect class="hb-barra" x="8" y="88" width="0" height="6"/>
        <rect class="hb-lampara" x="-4" y="-4" width="14" height="14" stroke="#1c1420" stroke-width="2"/>
        <text class="hb-etq" x="60" y="116" text-anchor="middle"></text><text class="hb-estado-txt" x="60" y="130" text-anchor="middle"></text>`;
      g.appendChild(e);
    }
  }
  // Los lomos de la estantería se llenan según cuánto del álbum tienes
  function lomos(pct) {
    const colores = ["#b6453f", "#3b6aa8", "#d4a43a", "#4f8f4a", "#7a4fa0", "#c9703a", "#2f8a8a", "#a8546a"];
    const g = $("hbLomos"); g.innerHTML = "";
    const filas = [[64, 48], [124, 48], [184, 48], [244, 40]], porFila = 10, total = filas.length * porFila;
    const llenos = Math.round(total * Math.max(0, Math.min(1, pct)));
    let n = 0;
    filas.forEach(([y, alto]) => {
      let x = 774;
      for (let i = 0; i < porFila; i++, n++) {
        const w = 10 + ((n * 7) % 5), h = alto - 6 - ((n * 5) % 12);
        if (x + w > 908) break;
        g.appendChild(el("rect", { class: "hb-lomo", x, y: y + alto - h, width: w, height: h, fill: n < llenos ? colores[(n * 3) % colores.length] : "#2a1b10", opacity: n < llenos ? 1 : .55 }));
        x += w + 2;
      }
    });
  }

  /* ------------------------------------------------------------------ estados */
  function estadoCorral(c) {
    const cria = c.cria;
    if (cria) {
      const ini = Date.parse(cria.inicio), fin = Date.parse(cria.fin), t = ahora();
      if (t >= fin) return { tipo: "listo", prog: 1, texto: "¡LISTA!", ini, fin };
      return { tipo: "cria", prog: (t - ini) / (fin - ini), texto: dur(fin - t), ini, fin };
    }
    if (c.descanso_hasta && Date.parse(c.descanso_hasta) > ahora()) return { tipo: "descanso", prog: 0, texto: "Descansa " + dur(Date.parse(c.descanso_hasta) - ahora()) };
    const especies = ver.especies.filter(e => e.habitat === c.habitat);
    const lista = especies.filter(e => e.libres.length >= 2 && !e.sobrepoblada && e.en_circulacion);
    if (lista.length) return { tipo: "disponible", prog: 0, texto: "PUEDES CRIAR" };
    return { tipo: "vacio", prog: 0, texto: especies.length ? "FALTA UNA PAREJA" : "SIN ESPECIES" };
  }

  function pintarEscena() {
    for (const c of ver.corrales) {
      const g = document.querySelector(`.hb-corral[data-h="${c.habitat}"]`);
      if (!g) continue;
      const est = estadoCorral(c);
      g.setAttribute("class", `lb-spot hb-corral hb-e-${est.tipo}`);
      g.setAttribute("aria-label", `${c.nombre}: ${est.texto}`);
      g.querySelector(".hb-etq").textContent = c.nombre.toUpperCase();
      g.querySelector(".hb-estado-txt").textContent = est.texto;
      g.querySelector(".hb-barra").setAttribute("width", String(Math.round(104 * est.prog)));
    }
  }

  /* ------------------------------------------------------------------ cajas laterales */
  const PILDORA = { listo: ["Lista", "hb-ok"], cria: ["En cría", "hb-azul"], descanso: ["Descansa", "hb-morado"], disponible: ["Libre", ""], vacio: ["Vacío", ""] };
  function pintarLados() {
    const crias = ver.corrales.filter(c => c.cria), listas = ver.corrales.filter(c => c.cria && estadoCorral(c).tipo === "listo");
    $("hbTu").innerHTML = `<div class="hb-fila"><span>Jugador</span><b>${esc(perfil && perfil.username || "Tú")}</b></div>
      <div class="hb-fila"><span>Crías en marcha</span><b>${crias.length}</b></div>
      <div class="hb-fila"><span>Listas para recoger</span><b>${listas.length ? `<span class="hb-pildora hb-ok">${listas.length}</span>` : "0"}</b></div>`;
    if (colec) {
      const visibles = (window.CARTAS || []).filter(c => !c.borrador);
      const unicas = [...colec.cartas.entries()].filter(([id, n]) => n > 0 && visibles.some(c => c.id === id)).length;
      const copias = [...colec.cartas.values()].reduce((s, n) => s + n, 0);
      const pct = visibles.length ? unicas / visibles.length : 0;
      const criaturas = visibles.filter(c => c.tipo === "Criatura");
      const criaturasMias = criaturas.filter(c => (colec.cartas.get(c.id) || 0) > 0).length;
      $("hbColeccion").innerHTML = `<div class="hb-fila"><span>Cartas distintas</span><b>${unicas} / ${visibles.length}</b></div>
        <div class="hb-barra-colec"><i style="width:${Math.round(pct * 100)}%"></i></div>
        <div class="hb-fila"><span>Copias en total</span><b>${copias}</b></div>
        <div class="hb-fila"><span>Criaturas distintas</span><b>${criaturasMias} / ${criaturas.length}</b></div>`;
      lomos(pct);
    }
    $("hbResumen").innerHTML = `<ul class="hb-lista">${ver.corrales.map(c => {
      const est = estadoCorral(c), p = PILDORA[est.tipo];
      return `<li><button type="button" class="hb-clic" data-abrir="${esc(c.habitat)}">${esc(c.nombre)}</button> <span class="hb-pildora ${p[1]}">${p[0]}</span>${est.tipo === "cria" || est.tipo === "descanso" ? `<br><small>${esc(est.texto)}</small>` : ""}</li>`;
    }).join("")}</ul>`;
    const listasCriar = ver.especies.filter(e => e.libres.length >= 2 && !e.sobrepoblada && e.en_circulacion);
    $("hbListas").innerHTML = listasCriar.length
      ? `<ul class="hb-lista">${listasCriar.map(e => {
          const c = ver.corrales.find(x => x.habitat === e.habitat);
          return `<li><button type="button" class="hb-clic" data-abrir="${esc(e.habitat)}">${esc(nombreCarta(e.carta))}</button> <small>${e.libres.length} copias · ${esc(c ? c.nombre : e.habitat)}</small></li>`;
        }).join("")}</ul>`
      : `<p class="lb-chico">Aún no tienes dos copias de la misma criatura. Las copias llegan jugando, intercambiando o con un poco de suerte.</p>`;
    $("hbHistorial").innerHTML = historial.length
      ? `<ul class="hb-lista">${historial.map(h => `<li>${h.estado === "nacida" ? "🐣" : "⚠"} ${esc(nombreCarta(h.carta_id))}<br><small>${h.estado === "nacida" ? "nació" : "sin cupo"} · ${esc(new Date(h.cerrada).toLocaleDateString("es", { day: "numeric", month: "short" }))}</small></li>`).join("")}</ul>`
      : `<p class="lb-chico">Todavía no ha nacido ninguna cría.</p>`;
  }

  /* ------------------------------------------------------------------ diálogo de un corral */
  function dialogo() {
    let d = $("hbDialogo");
    if (!d) {
      d = document.createElement("dialog");
      d.id = "hbDialogo"; d.className = "hb-dialogo";
      d.addEventListener("click", alPulsar);
      d.addEventListener("close", () => { abierto = null; });
      document.body.appendChild(d);
    }
    return d;
  }
  function mensaje(t, error) {
    const m = $("hbMsg");
    if (!m) return;
    m.textContent = t || "";
    m.classList.toggle("hb-error", !!error);
  }
  function abrir(habitat) {
    abierto = habitat;
    const d = dialogo();
    pintarDialogo();
    if (!d.open) d.showModal();
  }
  function pintarDialogo() {
    const c = ver.corrales.find(x => x.habitat === abierto);
    if (!c) return;
    const est = estadoCorral(c), d = dialogo();
    let cuerpo = "";
    if (c.cria) {
      const cr = c.cria, listo = est.tipo === "listo", nom = nombreCarta(cr.carta_id);
      cuerpo = `<div class="hb-pareja"><b>${esc(nom)}</b> <span>copias n.º ${esc(cr.numero_a)} y n.º ${esc(cr.numero_b)}</span></div>
        <div class="hb-total ${listo ? "hb-listo" : ""}" id="hbTotal"><i style="width:${Math.round(est.prog * 100)}%"></i></div>
        <p class="hb-msg" id="hbRestante" style="color:inherit">${listo ? "La cría ya está lista." : `Faltan ${esc(dur(est.fin - ahora()))}.`}</p>
        <ol class="hb-fases" id="hbFases">${cr.fases.map((f, i) => `<li data-fase="${i}"><span class="hb-n">${i + 1}</span><div><b>${esc(f.nombre)}</b><span class="hb-mini"><i style="width:0%"></i></span></div><small>${esc(horasTxt(f.horas))}</small></li>`).join("")}</ol>
        <div class="hb-acciones">${listo
          ? `<button type="button" class="cartas-boton cartas-boton-principal" data-recoger="${esc(cr.id)}">Recoger la cría</button>`
          : `<button type="button" class="cartas-boton" data-sacar="${esc(cr.id)}">Sacar a la pareja (no nace nada)</button>`}</div>`;
    } else {
      const especies = ver.especies.filter(e => e.habitat === c.habitat);
      const libreCorral = est.tipo !== "descanso";
      cuerpo = (est.tipo === "descanso" ? `<p class="hb-msg" style="color:#c9b3ff">El corral descansa después del último nacimiento (${esc(est.texto.replace("Descansa ", "faltan "))}).</p>` : "")
        + `<p class="lb-chico" style="margin:0">Necesitas <b>dos copias tuyas de la misma criatura</b>. Las dos quedan en el corral hasta que termine la cría y luego vuelven contigo.</p>`
        + (especies.length ? `<ul class="hb-especies">${especies.map((e, i) => filaEspecie(e, i, libreCorral)).join("")}</ul>`
                           : `<p class="lb-chico">Todavía no hay especies asignadas a este corral.</p>`);
    }
    d.innerHTML = `<header><div><h2>${esc(c.nombre)}</h2><p class="hb-desc">${esc(c.descripcion)}</p></div><button type="button" class="hb-cerrar" data-cerrar aria-label="Cerrar">×</button></header>
      <div class="hb-cuerpo"><p class="hb-msg" id="hbMsg"></p>${cuerpo}</div>`;
    refrescarTiempo();
  }
  function filaEspecie(e, i, libreCorral) {
    const carta = cartaDe(e.carta), n = e.libres.length;
    const [a, b, c2] = e.horas.map(Number), total = a + b + c2;
    const puede = n >= 2 && !e.sobrepoblada && e.en_circulacion && libreCorral;
    let nota = "";
    if (e.sobrepoblada) nota = `<small class="hb-aviso-esp">Sobrepoblación de la especie: hay que respetar el medio ambiente.</small>`;
    else if (!e.en_circulacion) nota = `<small class="hb-aviso-esp">Esta criatura todavía no está en circulación.</small>`;
    else if (n < 2) nota = `<small>Te faltan ${2 - n} ${2 - n === 1 ? "copia" : "copias"} para poder criarla.</small>`;
    const selectores = puede && n > 2
      ? `<small>Copias: <select data-a="${i}">${e.libres.map((l, k) => `<option value="${esc(l.id)}"${k === 0 ? " selected" : ""}>n.º ${esc(l.numero)}</option>`).join("")}</select>
          <select data-b="${i}">${e.libres.map((l, k) => `<option value="${esc(l.id)}"${k === 1 ? " selected" : ""}>n.º ${esc(l.numero)}</option>`).join("")}</select></small>` : "";
    return `<li class="${puede ? "" : "hb-no"}" data-carta="${esc(e.carta)}"><div class="hb-info"><b>${esc(carta ? carta.nombre : e.carta)}</b> <small style="display:inline">(${esc(RAREZAS[carta && carta.rareza] || "")})</small>
        <small>Copias libres: ${n} de 2 necesarias · Cría completa: ${esc(horasTxt(total))} (${esc(horasTxt(a))} · ${esc(horasTxt(b))} · ${esc(horasTxt(c2))}) · Descanso: ${esc(horasTxt(Number(e.descanso_horas)))}</small>
        ${nota}${selectores}</div>
      ${puede ? `<button type="button" class="cartas-boton cartas-boton-principal" data-criar="${i}">Criar</button>` : ""}</li>`;
  }
  // Solo cambia lo que depende del tiempo (barras y texto), sin tocar los botones
  function refrescarTiempo() {
    if (!abierto || !ver) return;
    const c = ver.corrales.find(x => x.habitat === abierto);
    if (!c || !c.cria || !$("hbTotal")) return;
    const est = estadoCorral(c), t = ahora();
    $("hbTotal").firstElementChild.style.width = Math.round(est.prog * 100) + "%";
    $("hbTotal").classList.toggle("hb-listo", est.tipo === "listo");
    const r = $("hbRestante");
    if (r) r.textContent = est.tipo === "listo" ? "La cría ya está lista." : `Faltan ${dur(est.fin - t)}.`;
    let desde = est.ini;
    c.cria.fases.forEach((f, i) => {
      const hasta = desde + f.horas * 3600000, li = document.querySelector(`#hbFases li[data-fase="${i}"]`);
      if (li) {
        const frac = Math.max(0, Math.min(1, (t - desde) / (hasta - desde)));
        li.classList.toggle("hb-hecha", t >= hasta);
        li.classList.toggle("hb-ahora", t >= desde && t < hasta);
        li.querySelector(".hb-mini > i").style.width = Math.round(frac * 100) + "%";
        li.querySelector(".hb-n").textContent = t >= hasta ? "✓" : String(i + 1);
      }
      desde = hasta;
    });
  }

  function mostrarCarta(titulo, cartaId, texto) {
    const c = cartaDe(cartaId);
    const dlg = document.createElement("dialog");
    dlg.className = "ic-resultado hb-nace";
    dlg.innerHTML = `<h2>${esc(titulo)}</h2>
      <div class="ic-carta">${c && window.CartasVista ? window.CartasVista.htmlCarta(c, true, 1, null) : ""}</div>
      <p><b>${esc(c ? c.nombre : cartaId)}</b>${texto ? `<br><small>${esc(texto)}</small>` : ""}</p>
      <button type="button" class="cartas-boton cartas-boton-principal">Genial</button>`;
    document.body.appendChild(dlg);
    dlg.querySelector("button").addEventListener("click", () => dlg.close());
    dlg.addEventListener("close", () => dlg.remove());
    dlg.showModal();
  }

  async function alPulsar(ev) {
    if (ev.target.closest("[data-cerrar]")) { dialogo().close(); return; }
    const criar = ev.target.closest("[data-criar]"), recoger = ev.target.closest("[data-recoger]"), sacar = ev.target.closest("[data-sacar]");
    try {
      if (criar) {
        const li = criar.closest("li"), i = criar.dataset.criar, carta = li.dataset.carta;
        const e = ver.especies.find(x => x.carta === carta);
        const a = li.querySelector(`[data-a="${i}"]`), b = li.querySelector(`[data-b="${i}"]`);
        const ida = a ? a.value : e.libres[0].id, idb = b ? b.value : e.libres[1].id;
        if (ida === idb) { mensaje("Elige dos copias distintas.", true); return; }
        criar.disabled = true;
        await rpc("cartas_corral_iniciar", { p_carta: carta, p_a: ida, p_b: idb });
        await cargar();
        mensaje("La pareja entra al corral. Vuelve cuando termine.");
      } else if (recoger) {
        recoger.disabled = true;
        const r = await rpc("cartas_corral_recoger", { p_id: recoger.dataset.recoger });
        await cargar();
        if (r.resultado === "cria") mostrarCarta("¡Ha nacido una cría!", r.carta, `Copia n.º ${r.numero}${r.de_reserva ? " (una copia que estaba en la reserva)" : ""}`);
        else mensaje(r.mensaje || "No ha nacido nada.", true);
      } else if (sacar) {
        if (!(await dialogo.confirmar("Si sacas a la pareja ahora, no nace nada y habrá que empezar de cero. ¿Sacarla?", { titulo: "Sacar a la pareja", aceptar: "Sacarla", peligro: true }))) return;
        await rpc("cartas_corral_sacar", { p_id: sacar.dataset.sacar });
        await cargar();
        mensaje("La pareja sale del corral.");
      }
    } catch (e) {
      mensaje(e.message || String(e), true);
      if (criar) criar.disabled = false;
      if (recoger) recoger.disabled = false;
    }
  }

  /* ------------------------------------------------------------------ arranque y reloj */
  function pintarTodo() {
    pintarEscena(); pintarLados();
    if (abierto) { const m = $("hbMsg") ? $("hbMsg").textContent : "", err = $("hbMsg") && $("hbMsg").classList.contains("hb-error"); pintarDialogo(); mensaje(m, err); }
  }
  async function cargar() {
    if (cargando) return;
    cargando = true;
    try {
      ver = await rpc("cartas_corral_ver");
      offset = Date.parse(ver.ahora) - Date.now();
      const r = await supa.from("cartas_crias").select("carta_id, estado, cerrada, habitat").in("estado", ["nacida", "sin_cupo"]).order("cerrada", { ascending: false }).limit(8);
      historial = r.data || [];
      try { colec = await CartasCliente.coleccion(); } catch (e) { /* sin colección */ }
      pintarTodo();
    } finally { cargando = false; }
  }
  let ultimoTipo = {};
  function reloj() {
    if (!ver) return;
    pintarEscena();
    refrescarTiempo();
    // Si una cría acaba de terminar, se repinta una vez lo que depende de ello
    let cambio = false;
    for (const c of ver.corrales) { const t = estadoCorral(c).tipo; if (ultimoTipo[c.habitat] && ultimoTipo[c.habitat] !== t) cambio = true; ultimoTipo[c.habitat] = t; }
    if (cambio) { pintarLados(); if (abierto) { const m = $("hbMsg") ? $("hbMsg").textContent : ""; pintarDialogo(); mensaje(m); } }
  }

  async function iniciar() {
    decorar();
    lomos(0);
    document.addEventListener("click", ev => {
      const c = ev.target.closest(".hb-corral");
      if (c) { abrir(c.dataset.h); return; }
      const b = ev.target.closest("[data-abrir]");
      if (b) abrir(b.dataset.abrir);
    });
    document.addEventListener("keydown", ev => {
      if ((ev.key === "Enter" || ev.key === " ") && ev.target.classList && ev.target.classList.contains("hb-corral")) { ev.preventDefault(); abrir(ev.target.dataset.h); }
    });
    let sesion = null;
    try { sesion = await fichasSesionActual(); } catch (e) { sesion = null; }
    if (!sesion) {
      aviso("Inicia sesión para entrar en tu habitación.");
      $("hbCuerpo").classList.add("hidden");
      return;
    }
    miId = sesion.user.id;
    supa = await fichasCliente();
    try {
      const rol = await CartasCliente.verificarRol();
      await CartasCliente.cargarDefiniciones(rol.puede);
    } catch (e) { /* las cartas se verán por su id */ }
    try { const r = await supa.from("perfiles").select("username, side").eq("user_id", miId).maybeSingle(); perfil = r.data; } catch (e) { perfil = null; }
    try { await cargar(); }
    catch (e) {
      aviso("Los corrales todavía no están activados en el servidor (falta aplicar economia-18_crianza.sql). " + (e.message || ""), true);
      return;
    }
    setInterval(reloj, 1000);
    setInterval(() => { if (!document.hidden) cargar().catch(() => {}); }, 30000);
  }
  iniciar();
})();
