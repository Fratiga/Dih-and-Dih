/* =============================================================================
   TABLERO — paneles: barra de herramientas, paneles que salen de ella (dibujo, medida, dados, máscara,
   efectos, capas), barra de opciones, zoom, orden de turno, ajustes de ficha, menú de una ficha, selector de
   páginas (solo GM) y lo que se suelta sobre el tablero. Las pestañas de la derecha están en tablero-lado.js.
============================================================================= */
(function () {
  const { esc, el, aviso, mensajeError, ventana, ventanas, modal, pedir, confirmar, menu, chips, campoImagen, interruptor } = TBUI;
  const I = TBIcono;
  let TB = null;

  const CAPAS = [
    { id: "fichas", nombre: "Fichas", icono: "capaFichas" },
    { id: "gm", nombre: "DJ", icono: "capaDJ" },
    { id: "mapa", nombre: "Mapa", icono: "capaMapa" },
    { id: "delantero", nombre: "Delantero", icono: "capaDelantero" },
    { id: "luz", nombre: "Iluminación", icono: "luz" }
  ];
  const DADOS = [["d4", 4], ["d6", 6], ["d8", 8], ["d10", 10], ["d12", 12], ["d20", 20], ["d100", 100], ["Fudge", "f"]];
  const FUENTES = ["Arial", "Georgia", "Times New Roman", "Courier New", "Verdana", "Trebuchet MS", "Comic Sans MS"];

  /* ============================================================ barra de herramientas */
  function construirBarra() {
    const b = document.getElementById("tbBarra");
    const gm = TB.esGM();
    const btn = (id, icono, titulo, extra = "") => `<button type="button" class="tb-barra-btn ${extra}" data-b="${id}" title="${esc(titulo)}">${I[icono]}</button>`;
    b.innerHTML = [
      gm ? btn("paginas", "menu", "Páginas") : "",
      btn("seleccionar", "seleccionar", "Seleccionar y mover"),
      btn("mano", "mano", "Mover la vista (también espacio o botón central)"),
      `<span class="tb-barra-etq">HERRAMIENTAS</span>`,
      btn("dibujo", "dibujo", "Herramientas de dibujo", "sub"),
      btn("texto", "texto", "Texto"),
      btn("medida", "medida", "Medida"),
      btn("dados", "dado", "Lanzador de dados"),
      btn("turno", "turno", "Orden de turno"),
      btn("ping", "ping", "Señalar (mantén pulsado en cualquier sitio; Mayús para mover la vista de todos)"),
      gm ? btn("niebla", "niebla", "Ocultar/Revelar máscara") : "",
      `<span class="tb-barra-etq">FX</span>`,
      gm ? btn("luz", "luz", "Iluminación dinámica") : "",
      btn("fx", "fx", "Efectos"),
      gm ? `<div class="tb-barra-pie"><span class="tb-barra-etq">CAPAS</span><button type="button" class="tb-barra-btn tb-barra-capa" data-b="capas" title="Capa activa"></button></div>` : ""
    ].join("");
    const plegar = el(`<button type="button" class="tb-plegar" title="Ocultar la barra">«</button>`);
    document.body.appendChild(plegar);
    plegar.addEventListener("click", () => { TB.prefs.barraPlegada = !TB.prefs.barraPlegada; TB.guardarPrefs(); document.body.classList.toggle("barra-plegada", TB.prefs.barraPlegada); });
    document.body.classList.toggle("barra-plegada", !!TB.prefs.barraPlegada);
    b.addEventListener("click", e => {
      const x = e.target.closest("[data-b]");
      if (!x) return;
      const id = x.dataset.b;
      if (id === "seleccionar" || id === "mano" || id === "ping") { cerrarFlotante(); setHerramienta(id); }
      else if (id === "texto") { cerrarFlotante(); setHerramienta("texto"); }
      else if (id === "dibujo") abrirFlotante("dibujo", x);
      else if (id === "medida") { setHerramienta("medida"); abrirFlotante("medida", x); }
      else if (id === "dados") abrirFlotante("dados", x);
      else if (id === "turno") alternarTurno();
      else if (id === "niebla") { setHerramienta("niebla"); abrirFlotante("niebla", x); }
      else if (id === "luz") abrirFlotante("luz", x);
      else if (id === "fx") { setHerramienta("fx"); abrirFlotante("fx", x); }
      else if (id === "capas") abrirFlotante("capas", x);
      else if (id === "paginas") alternarPaginas();
    });
    pintarCapa();
    marcarBarra();
  }
  function marcarBarra() {
    document.querySelectorAll("#tbBarra [data-b]").forEach(b => {
      const id = b.dataset.b;
      b.classList.toggle("activo", id === TB.herr);
      b.classList.toggle("abierto", id === flotanteAbierto || (id === "turno" && ventanas.has("turno")) || (id === "paginas" && !document.getElementById("tbPaginas").hidden));
    });
  }
  function pintarCapa() {
    const b = document.querySelector('[data-b="capas"]');
    if (!b) return;
    const c = CAPAS.find(x => x.id === TB.capa) || CAPAS[0];
    b.innerHTML = I[c.icono] + `<span>${c.nombre.toUpperCase()}</span>`;
  }
  function setHerramienta(h) {
    TB.herr = h;
    TB.L.setHerramienta(h);
    const op = document.getElementById("tbOpciones");
    if (h === "dibujo") pintarOpcionesDibujo();
    else if (h === "texto") pintarOpcionesTexto();
    else op.hidden = true;
    marcarBarra();
  }
  function setCapa(c) {
    TB.capa = c;
    TB.L.setCapa(c);
    pintarCapa();
  }

  /* ------------------------------------------------------------ paneles que salen de la barra */
  let flotanteAbierto = null;
  function cerrarFlotante() { document.getElementById("tbFlotante").hidden = true; flotanteAbierto = null; marcarBarra(); }
  function abrirFlotante(id, boton) {
    const f = document.getElementById("tbFlotante");
    if (flotanteAbierto === id) { cerrarFlotante(); return; }
    flotanteAbierto = id;
    f.className = "tb-flotante";
    f.innerHTML = "";
    const r = boton.getBoundingClientRect();
    const constructor = { dibujo: flotDibujo, medida: flotMedida, dados: flotDados, niebla: flotNiebla, fx: flotFx, luz: flotLuz, capas: flotCapas }[id];
    constructor(f);
    f.hidden = false;
    // Los menús cortos salen a la altura del botón; los paneles grandes arriba
    if (f.classList.contains("menu")) f.style.top = Math.max(8, Math.min(r.top - 8, window.innerHeight - f.offsetHeight - 8)) + "px";
    else f.style.top = "10px";
    marcarBarra();
  }
  function cabFlot(titulo, plegar) {
    const c = el(`<div class="tb-flot-cab"><h3>${titulo}</h3><button type="button" class="tb-flot-cerrar${plegar ? " plegar" : ""}" title="Cerrar">${plegar ? "«" : "✕"}</button></div>`);
    c.querySelector("button").addEventListener("click", cerrarFlotante);
    return c;
  }

  function flotDibujo(f) {
    f.classList.add("menu");
    const actual = TB.herr === "dibujo" ? TB.prefs.dibujo.modo : null;
    const items = [["mano", "dibujo", "A mano", "Ctrl + F"], ["linea", "linea", "Pluma/Línea", ""], ["rect", "rect", "Rectángulo", "Ctrl + D"], ["elipse", "elipse", "Elipse", ""]];
    items.forEach(([modo, icono, nombre, atajo]) => {
      const b = el(`<button type="button" class="tb-menu-item${actual === modo ? " activo" : ""}">${I[icono]}${nombre}${atajo ? `<kbd>${atajo}</kbd>` : ""}</button>`);
      b.addEventListener("click", () => { elegirDibujo(modo); cerrarFlotante(); });
      f.appendChild(b);
    });
    const borrar = el(`<button type="button" class="tb-menu-item peligro">${I.papelera}Borrar dibujos y texto</button>`);
    borrar.addEventListener("click", async () => {
      cerrarFlotante();
      const mios = TB.L.objetos().filter(o => (o.tipo === "dibujo" || o.tipo === "texto") && (TB.esGM() ? o.capa === TB.capa : o.autor === TB.yo.uid));
      if (!mios.length) { aviso("No hay dibujos ni texto que borrar."); return; }
      if (await confirmar("Borrar dibujos y texto", `¿Borrar ${mios.length} dibujo(s) y texto(s) ${TB.esGM() ? "de esta capa" : "tuyos"}?`, "Borrar")) TB.borrarObjetos(mios.map(o => o.id));
    });
    f.appendChild(borrar);
  }
  function elegirDibujo(modo) { TB.prefs.dibujo.modo = modo; TB.guardarPrefs(); TB.aplicarOpcionesLienzo(); setHerramienta("dibujo"); }

  function selectorColor(valor, permitirVacio, alCambiar) {
    const b = el(`<label class="tb-color-btn${valor === "transparent" ? " vacio" : ""}" title="${permitirVacio ? "Clic derecho: sin color" : "Color"}"><input type="color"></label>`);
    const inp = b.querySelector("input");
    const pintar = v => { b.classList.toggle("vacio", v === "transparent"); b.style.background = v === "transparent" ? "" : v; if (v !== "transparent") inp.value = v; };
    pintar(valor);
    inp.addEventListener("input", () => { pintar(inp.value); alCambiar(inp.value); });
    if (permitirVacio) b.addEventListener("contextmenu", e => { e.preventDefault(); pintar("transparent"); alCambiar("transparent"); });
    return b;
  }
  function pintarOpcionesDibujo() {
    const op = document.getElementById("tbOpciones"), d = TB.prefs.dibujo;
    op.innerHTML = "";
    const guardar = () => { TB.guardarPrefs(); TB.aplicarOpcionesLienzo(); };
    op.append(selectorColor(d.trazo, false, v => { d.trazo = v; guardar(); }), selectorColor(d.relleno, true, v => { d.relleno = v; guardar(); }), el(`<span class="tb-sep-v"></span>`));
    const s = el(`<select title="Grosor"><option value="fino">Fino</option><option value="mediano">Mediano</option><option value="grueso">Grueso</option><option value="enorme">Enorme</option></select>`);
    s.value = d.grosor; s.addEventListener("change", () => { d.grosor = s.value; guardar(); });
    op.append(s, el(`<span class="tb-nota" style="max-width:calc(180px * var(--tb-k))">Relleno: clic derecho para dejarlo vacío</span>`));
    op.hidden = false;
  }
  function pintarOpcionesTexto() {
    const op = document.getElementById("tbOpciones"), t = TB.prefs.texto;
    op.innerHTML = "";
    const guardar = () => { TB.guardarPrefs(); TB.aplicarOpcionesLienzo(); };
    op.append(selectorColor(t.color, false, v => { t.color = v; guardar(); }), selectorColor(t.fondo, true, v => { t.fondo = v; guardar(); }), el(`<span class="tb-sep-v"></span>`));
    const fuente = el(`<select>${FUENTES.map(x => `<option>${x}</option>`).join("")}</select>`);
    fuente.value = t.fuente; fuente.addEventListener("change", () => { t.fuente = fuente.value; guardar(); });
    const tam = el(`<select style="min-width:calc(70px * var(--tb-k))">${[10, 14, 18, 22, 26, 32, 40, 56, 72, 100].map(x => `<option>${x}</option>`).join("")}</select>`);
    tam.value = String(t.tam); tam.addEventListener("change", () => { t.tam = parseInt(tam.value, 10); guardar(); });
    const neg = el(`<button type="button" class="tb-btn-icono${t.negrita ? " activo" : ""}" title="Negrita"><b>B</b></button>`);
    neg.addEventListener("click", () => { t.negrita = !t.negrita; neg.classList.toggle("activo", t.negrita); guardar(); });
    const cur = el(`<button type="button" class="tb-btn-icono${t.cursiva ? " activo" : ""}" title="Cursiva"><i style="font-family:Georgia">I</i></button>`);
    cur.addEventListener("click", () => { t.cursiva = !t.cursiva; cur.classList.toggle("activo", t.cursiva); guardar(); });
    op.append(fuente, el(`<span class="tb-sep-v"></span>`), tam, el(`<span class="tb-sep-v"></span>`), neg, cur);
    op.hidden = false;
  }

  function flotMedida(f) {
    const m = TB.prefs.medida;
    const guardar = () => { TB.guardarPrefs(); TB.aplicarOpcionesLienzo(); };
    f.appendChild(cabFlot("Medida", true));
    const c = el(`<div class="tb-flot-cuerpo">
      <div class="tb-fila" style="gap:calc(12px * var(--tb-k))">
        <label class="tb-campo" style="flex:1"><span style="font-weight:600">Forma</span><select data-forma>
          <option value="linea">Línea</option><option value="cuadrado">Cuadrado</option><option value="circulo">Círculo</option><option value="cono">Cono</option><option value="haz">Haz</option></select></label>
        <label class="tb-campo" style="flex:1.4"><span style="font-weight:600">Ajuste de cuadrícula</span><select data-ajuste>
          <option value="centro">Ajustar al centro</option><option value="esquina">Ajustar a las esquinas</option><option value="ninguno">Sin ajuste</option></select></label>
      </div>
      <div data-extra></div>
      <p class="tb-flot-titulo-sec">Retardo de desvanecimiento</p>
      <div class="tb-segmento" data-persistente><button type="button" data-v="0">Instantáneo</button><button type="button" data-v="1">Persistente</button></div>
      <div class="tb-fila-toggle" style="margin-top:calc(12px * var(--tb-k))"><span>Mide siempre el movimiento de las fichas.</span><span data-t1></span></div>
      <div class="tb-fila-toggle"><span>Transmitir a otros</span><span data-t2></span></div>
    </div>`);
    const forma = c.querySelector("[data-forma]"), ajuste = c.querySelector("[data-ajuste]");
    forma.value = m.forma; ajuste.value = m.ajuste;
    const extra = c.querySelector("[data-extra]");
    pintarExtraMedida(extra, () => forma.value, guardar);
    forma.addEventListener("change", () => { m.forma = forma.value; guardar(); pintarExtraMedida(extra, () => forma.value, guardar); });
    ajuste.addEventListener("change", () => { m.ajuste = ajuste.value; guardar(); });
    const seg = c.querySelector("[data-persistente]");
    const pintarSeg = () => seg.querySelectorAll("button").forEach(b => b.classList.toggle("activo", (b.dataset.v === "1") === !!m.persistente));
    seg.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; m.persistente = b.dataset.v === "1"; pintarSeg(); guardar(); if (!m.persistente) TB.L.limpiarMedida(); });
    pintarSeg();
    const t1 = interruptor(m.moverMide), t2 = interruptor(m.transmitir);
    t1.input.addEventListener("change", () => { m.moverMide = t1.valor(); guardar(); });
    t2.input.addEventListener("change", () => { m.transmitir = t2.valor(); guardar(); });
    c.querySelector("[data-t1]").append(t1.el); c.querySelector("[data-t2]").append(t2.el);
    f.appendChild(c);
    const esc = TB.escena(), cu = (esc && esc.cuadricula) || {};
    f.appendChild(el(`<div class="tb-flot-pie"><span class="tb-nota">Compatible con D&amp;D 5ª ed. (las diagonales cuentan una casilla)</span><span class="tb-nota">1 casilla = ${cu.pies || 5} pies</span></div>`));
  }

  // Opciones de cada forma de medida, como en Roll20 (también las usan los efectos)
  function pintarExtraMedida(caja, forma, guardar) {
    const m = TB.prefs.medida;
    const f = forma();
    caja.innerHTML = "";
    const botones = (titulo, clave, valores, unidad, def) => {
      const actual = m[clave] == null ? def : m[clave];
      const b = el(`<div><p class="tb-flot-titulo-sec">${titulo}</p><div class="tb-fila" style="align-items:center">
        ${valores.map(v => `<button type="button" class="tb-btn tb-btn-mini${Number(actual) === v ? " activo" : ""}" data-v="${v}" style="min-width:calc(38px * var(--tb-k))">${v}</button>`).join("")}
        <span class="tb-ud" style="flex:1"><input type="number" min="1" max="${unidad === "°" ? 179 : 500}" data-n style="width:100%"><i>${unidad}</i></span></div></div>`);
      const n = b.querySelector("[data-n]");
      n.value = actual;
      const poner = v => { m[clave] = Math.max(1, Math.min(unidad === "°" ? 179 : 500, Number(v) || def)); n.value = m[clave]; b.querySelectorAll("[data-v]").forEach(x => x.classList.toggle("activo", Number(x.dataset.v) === m[clave])); guardar(); };
      b.querySelectorAll("[data-v]").forEach(x => x.addEventListener("click", () => poner(x.dataset.v)));
      n.addEventListener("change", () => poner(n.value));
      caja.appendChild(b);
    };
    const segmento = (titulo, clave, opciones, def) => {
      const b = el(`<div><p class="tb-flot-titulo-sec">${titulo}</p><div class="tb-segmento">${opciones.map(([v, t]) => `<button type="button" data-v="${v}">${t}</button>`).join("")}</div></div>`);
      const pintar = () => b.querySelectorAll("[data-v]").forEach(x => x.classList.toggle("activo", x.dataset.v === (m[clave] || def)));
      b.addEventListener("click", e => { const x = e.target.closest("[data-v]"); if (!x) return; m[clave] = x.dataset.v; pintar(); guardar(); });
      pintar();
      caja.appendChild(b);
    };
    if (f === "haz") botones("Amplitud de haz (pies)", "hazPies", [5, 10, 15], "pies", 5);
    if (f === "cono") { botones("Grado de cono", "conoGrados", [45, 53, 60, 90], "°", 53); segmento("Forma de cono", "conoForma", [["plano", "Plano"], ["redondeado", "Redondeado"]], "plano"); }
    if (f === "circulo") segmento("Origen de la medida", "origen", [["centro", "Centro"], ["borde", "Borde"]], "centro");
    if (f === "cuadrado") segmento("Origen de la medida", "origen", [["centro", "Centro"], ["borde", "Borde"], ["esquina", "Esquina"]], "centro");
    if (f === "cono") caja.appendChild(el(`<p class="tb-nota" style="margin:calc(4px * var(--tb-k)) 0 0">53° es el cono de D&amp;D 5e: igual de ancho que de largo.</p>`));
  }

  /* --- Lanzador de dados --- */
  const historialDados = [];
  function flotDados(f) {
    const d = TB.prefs.dados;
    const cab = el(`<div class="tb-flot-cab"><h3>Lanzador de Dados</h3><button type="button" class="tb-flot-cerrar">✕</button></div>`);
    cab.querySelector("button").addEventListener("click", cerrarFlotante);
    f.appendChild(cab);
    const modos = el(`<div style="padding:calc(10px * var(--tb-k)) calc(12px * var(--tb-k)) 0"><div class="tb-segmento" style="width:100%;display:grid;grid-template-columns:1fr 1fr 1fr">
      <button type="button" data-m="todos">Todo</button><button type="button" data-m="dj">DJ</button><button type="button" data-m="secreta">Secreta</button></div></div>`);
    const pintarModos = () => modos.querySelectorAll("button").forEach(b => b.classList.toggle("activo", b.dataset.m === d.modo));
    modos.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; d.modo = b.dataset.m; TB.guardarPrefs(); pintarModos(); });
    pintarModos();
    f.appendChild(modos);
    const cuerpo = el(`<div></div>`);
    f.appendChild(cuerpo);
    const sufijo = () => d.explota || "";
    async function tirar(expr) {
      const t = await TB.tirar(expr, "", d.modo);
      if (t) { historialDados.unshift(expr); if (historialDados.length > 10) historialDados.pop(); if (d.avanzado) pintar(); }
    }
    function pintar() {
      cuerpo.innerHTML = "";
      if (!d.avanzado) {
        const tabla = el(`<table class="tb-dados-tabla"><tbody>${DADOS.map(([n, c]) => `<tr>${[1, 2, 3, 4, 5, 6].map(k => `<td data-n="${k}" data-c="${c}">${k === 1 ? `${n.toUpperCase()}` : k}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
        tabla.addEventListener("click", e => { const td = e.target.closest("td"); if (!td) return; tirar(`${td.dataset.n}d${td.dataset.c}${td.dataset.c === "f" ? "" : sufijo()}`); });
        cuerpo.appendChild(tabla);
      } else {
        const av = el(`<div class="tb-flot-cuerpo">
          <p class="tb-flot-titulo-sec">Tirada básica</p>
          <div class="tb-dados-iconos">${DADOS.map(([n, c]) => `<button type="button" data-c="${c}">${I.dado}${n.toUpperCase()}</button>`).join("")}</div>
          <hr class="tb-sep">
          <p class="tb-flot-titulo-sec">Tirada avanzada</p>
          <div class="tb-fila">
            <span class="tb-giro"><input type="number" data-cant value="1" min="1" max="100"><span><button type="button" data-g="cant" data-d="1">▲</button><button type="button" data-g="cant" data-d="-1">▼</button></span></span>
            <select data-dado style="width:calc(110px * var(--tb-k))">${DADOS.map(([n, c]) => `<option value="${c}"${c === 20 ? " selected" : ""}>${n.toUpperCase()}</option>`).join("")}</select>
            <span>+</span>
            <span class="tb-giro"><input type="number" data-mod value="0"><span><button type="button" data-g="mod" data-d="1">▲</button><button type="button" data-g="mod" data-d="-1">▼</button></span></span>
          </div>
          <div class="tb-fila" style="margin:calc(12px * var(--tb-k)) 0"><span data-obj></span><span>¿Número objetivo?</span><input type="number" data-objetivo value="10" style="width:calc(80px * var(--tb-k))" hidden></div>
          <button type="button" class="tb-btn tb-btn-acento" data-tirar style="width:100%;max-width:calc(270px * var(--tb-k))">Tirada</button>
          <hr class="tb-sep">
          <p class="tb-flot-titulo-sec">Últimas 10 tiradas</p>
          <table class="tb-historial"><thead><tr><th>Fórmula</th><th>Repetición de tirada</th></tr></thead><tbody>${historialDados.length ? historialDados.map((h, i) => `<tr><td>${esc(h)}</td><td><button type="button" class="tb-btn tb-btn-mini" data-rep="${i}">Repetir</button></td></tr>`).join("") : `<tr><td colspan="2" class="tb-nota" style="text-align:center">Sin datos</td></tr>`}</tbody></table>
          <p class="tb-nota" style="margin-top:calc(12px * var(--tb-k))">En el chat también puedes escribir <b>/r 2d20kh1+5</b> (ventaja), <b>/gr 1d20</b> (solo al DJ) o tiradas en línea como <b>[[1d8+3]]</b>.</p>
        </div>`);
        const obj = interruptor(false);
        av.querySelector("[data-obj]").append(obj.el);
        obj.input.addEventListener("change", () => { av.querySelector("[data-objetivo]").hidden = !obj.valor(); });
        av.querySelectorAll("[data-g]").forEach(b => b.addEventListener("click", () => { const inp = av.querySelector(`[data-${b.dataset.g}]`); inp.value = (parseInt(inp.value, 10) || 0) + parseInt(b.dataset.d, 10); if (b.dataset.g === "cant" && inp.value < 1) inp.value = 1; }));
        av.querySelector(".tb-dados-iconos").addEventListener("click", e => { const b = e.target.closest("button"); if (b) tirar(`1d${b.dataset.c}${b.dataset.c === "f" ? "" : sufijo()}`); });
        av.querySelector("[data-tirar]").addEventListener("click", () => {
          const n = Math.max(1, parseInt(av.querySelector("[data-cant]").value, 10) || 1), c = av.querySelector("[data-dado]").value, m = parseInt(av.querySelector("[data-mod]").value, 10) || 0;
          let expr = `${n}d${c}${c === "f" ? "" : sufijo()}`;
          if (obj.valor()) expr += ">" + (parseInt(av.querySelector("[data-objetivo]").value, 10) || 0);
          if (m) expr += (m > 0 ? "+" : "") + m;
          tirar(expr);
        });
        av.querySelectorAll("[data-rep]").forEach(b => b.addEventListener("click", () => tirar(historialDados[+b.dataset.rep])));
        cuerpo.appendChild(av);
      }
    }
    pintar();
    const moneda = el(`<div class="tb-moneda-fila"><button type="button" class="tb-btn tb-moneda-btn" title="Para decidir algo al 50 %">🪙 Moneda: cara o cruz</button></div>`);
    moneda.querySelector("button").addEventListener("click", () => TB.tirar("1d2", "Moneda", d.modo));
    f.appendChild(moneda);
    const pie = el(`<div class="tb-flot-pie"><button type="button" class="tb-enlace" data-cambiar style="font-size:calc(17px * var(--tb-k))"></button>
      <div class="tb-mods"><button type="button" data-x="!" title="Los dados que sacan el máximo vuelven a tirarse y suman">!</button><button type="button" data-x="!!" title="Igual, pero se acumulan en un solo dado">!!</button><button type="button" data-x="!p" title="Explotan restando 1 a cada repetición">!p</button></div></div>`);
    const cambiar = pie.querySelector("[data-cambiar]");
    const pintarPie = () => { cambiar.textContent = d.avanzado ? "Lanzador simple" : "Lanzador avanzado"; pie.querySelectorAll("[data-x]").forEach(b => b.classList.toggle("activo", b.dataset.x === d.explota)); };
    cambiar.addEventListener("click", () => { d.avanzado = !d.avanzado; TB.guardarPrefs(); pintar(); pintarPie(); });
    pie.querySelectorAll("[data-x]").forEach(b => b.addEventListener("click", () => { d.explota = d.explota === b.dataset.x ? "" : b.dataset.x; TB.guardarPrefs(); pintarPie(); }));
    pintarPie();
    f.appendChild(pie);
  }

  function flotNiebla(f) {
    f.appendChild(cabFlot("Ocultar/Revelar máscara", true));
    const cuerpo = el(`<div class="tb-flot-cuerpo"></div>`);
    f.appendChild(cuerpo);
    const e = TB.escena();
    const n = (e && e.niebla) || { activa: false, zonas: [] };
    const nb = TB.prefs.niebla;
    const guardarNiebla = v => TB.guardarEscena(TB.escenaId, { niebla: v }).then(() => { if (flotanteAbierto === "niebla") { cuerpo.innerHTML = ""; flotanteAbierto = null; abrirFlotante("niebla", document.querySelector('[data-b="niebla"]')); } });
    if (!n.activa) {
      cuerpo.innerHTML = `<p style="text-align:center;font-weight:600;font-size:calc(16px * var(--tb-k));margin:0 0 calc(6px * var(--tb-k))">¡Esconde algunas cosas!</p>
        <p style="text-align:center;margin:0 0 calc(14px * var(--tb-k));line-height:1.45">Puedes usar esta herramienta para ocultar a los jugadores el mapa entero o partes de él. Las zonas reveladas se dibujan sobre la marcha.</p>
        <button type="button" class="tb-btn tb-btn-borde" data-todo style="width:100%;min-height:calc(44px * var(--tb-k));font-size:calc(16px * var(--tb-k))">Ocultar página completa</button>
        <p style="text-align:center;margin:calc(14px * var(--tb-k)) 0 0"><button type="button" class="tb-enlace" data-manual style="font-size:calc(16px * var(--tb-k));font-weight:600">Dibujar manualmente la máscara</button></p>`;
      cuerpo.querySelector("[data-todo]").addEventListener("click", () => { nb.modo = "revelar"; TB.guardarPrefs(); TB.aplicarOpcionesLienzo(); guardarNiebla({ activa: true, base: "oculta", zonas: [] }); });
      cuerpo.querySelector("[data-manual]").addEventListener("click", () => { nb.modo = "ocultar"; TB.guardarPrefs(); TB.aplicarOpcionesLienzo(); guardarNiebla({ activa: true, base: "visible", zonas: [] }); });
      return;
    }
    cuerpo.innerHTML = `<p class="tb-flot-titulo-sec">Al dibujar sobre el tablero</p>
      <div class="tb-segmento" data-modo><button type="button" data-v="revelar">Revelar</button><button type="button" data-v="ocultar">Ocultar</button></div>
      <p class="tb-flot-titulo-sec" style="margin-top:calc(12px * var(--tb-k))">Forma</p>
      <div class="tb-segmento" data-forma><button type="button" data-v="rect">Rectángulo</button><button type="button" data-v="poligono">Polígono</button></div>
      <p class="tb-nota">En polígono, cada clic añade un punto. Doble clic o Intro para cerrarlo.</p>
      <div class="tb-fila" style="flex-wrap:wrap;margin-top:calc(12px * var(--tb-k))">
        <button type="button" class="tb-btn" data-deshacer>Deshacer la última zona</button>
        <button type="button" class="tb-btn" data-ocultar>Ocultar todo</button>
        <button type="button" class="tb-btn tb-btn-borde" data-quitar>Quitar la máscara</button>
      </div>
      <p class="tb-nota" style="margin-top:calc(10px * var(--tb-k))">Tú la ves semitransparente. Los jugadores la ven negra.</p>`;
    const pinta = (sel, val) => cuerpo.querySelectorAll(sel + " button").forEach(b => b.classList.toggle("activo", b.dataset.v === val));
    pinta("[data-modo]", nb.modo); pinta("[data-forma]", nb.forma);
    cuerpo.querySelector("[data-modo]").addEventListener("click", ev => { const b = ev.target.closest("button"); if (!b) return; nb.modo = b.dataset.v; TB.guardarPrefs(); TB.aplicarOpcionesLienzo(); pinta("[data-modo]", nb.modo); setHerramienta("niebla"); });
    cuerpo.querySelector("[data-forma]").addEventListener("click", ev => { const b = ev.target.closest("button"); if (!b) return; nb.forma = b.dataset.v; TB.guardarPrefs(); TB.aplicarOpcionesLienzo(); pinta("[data-forma]", nb.forma); setHerramienta("niebla"); });
    cuerpo.querySelector("[data-deshacer]").addEventListener("click", () => guardarNiebla(Object.assign({}, n, { zonas: (n.zonas || []).slice(0, -1) })));
    cuerpo.querySelector("[data-ocultar]").addEventListener("click", () => guardarNiebla({ activa: true, base: "oculta", zonas: [] }));
    cuerpo.querySelector("[data-quitar]").addEventListener("click", () => guardarNiebla({ activa: false, zonas: [] }));
  }

  function flotLuz(f) {
    f.appendChild(cabFlot("✦ Iluminación Dinámica", true));
    const e = TB.escena() || {};
    const L = Object.assign({ activa: false, global: false, explorar: true, bloquear: "luz", opacidadDJ: 0.35 }, (e.opciones || {}).luz);
    const tipo = TB.prefs.muroTipo || "muro";
    const c = el(`<div class="tb-flot-cuerpo">
      <div class="tb-fila-toggle" style="border:0"><span><b>Iluminación dinámica en esta página</b></span><span data-t="activa"></span></div>
      <div class="tb-fila-toggle" style="border:0"><span>Luz de día<small class="tb-nota" style="display:block;font-weight:400">Todo está iluminado; solo tapan los muros.</small></span><span data-t="global"></span></div>
      <div class="tb-fila-toggle" style="border:0"><span>Recordar lo explorado<small class="tb-nota" style="display:block;font-weight:400">Lo que ya vieron queda en penumbra.</small></span><span data-t="explorar"></span></div>
      <label class="tb-campo"><span style="font-weight:400">Las líneas bloquean el movimiento</span><select data-bloquear><option value="nunca">Siempre desactivado</option><option value="siempre">Siempre activado</option><option value="luz">Cuando la iluminación está activada</option></select></label>
      <label class="tb-campo"><span style="font-weight:400">Oscuridad que ves tú (los jugadores la ven entera)</span><input type="range" min="0" max="90" data-op></label>
      <hr class="tb-sep">
      <p class="tb-flot-titulo-sec">Dibujar muros</p>
      <div class="tb-segmento" style="width:100%;display:grid;grid-template-columns:1fr 1fr 1fr" data-tipos>
        <button type="button" data-m="muro">Muro</button><button type="button" data-m="puerta">Puerta</button><button type="button" data-m="ventana">Ventana</button></div>
      <div class="tb-fila" style="margin-top:calc(8px * var(--tb-k))"><button type="button" class="tb-btn" data-dib="linea" style="flex:1">${I.linea} Línea</button><button type="button" class="tb-btn" data-dib="rect" style="flex:1">${I.rect} Rectángulo</button></div>
      <p class="tb-nota">Las líneas se dibujan en la capa Iluminación, que solo ves tú. Una ventana deja ver pero no pasar. Doble clic en una puerta la abre o la cierra; los jugadores la abren con su tirador, salvo que la cierres con llave (clic derecho).</p>
      <button type="button" class="tb-btn" data-luz style="width:100%">☀ Poner una luz en el centro de la vista</button>
      <hr class="tb-sep">
      <label class="tb-btn" style="width:100%;cursor:pointer">⇪ Importar un mapa de Dungeondraft (.dd2vtt / .uvtt)<input type="file" accept=".dd2vtt,.uvtt,.df2vtt,.json" hidden data-uvtt></label>
      <button type="button" class="tb-enlace" data-olvidartodos style="margin-top:calc(10px * var(--tb-k));display:block">Olvidar lo explorado de esta página para todos</button>
      <button type="button" class="tb-enlace" data-olvidar style="margin-top:calc(10px * var(--tb-k))">Olvidar lo explorado en esta página</button>
    </div>`);
    const guardar = cambio => {
      const e2 = TB.escena();
      if (!e2) return;
      Object.assign(L, cambio);
      TB.guardarEscena(e2.id, { opciones: Object.assign({}, e2.opciones, { luz: Object.assign({}, L) }) });
    };
    ["activa", "global", "explorar"].forEach(k => {
      const t = interruptor(!!L[k]);
      t.input.addEventListener("change", () => guardar({ [k]: t.valor() }));
      c.querySelector(`[data-t="${k}"]`).appendChild(t.el);
    });
    const blo = c.querySelector("[data-bloquear]");
    blo.value = L.bloquear;
    blo.addEventListener("change", () => guardar({ bloquear: blo.value }));
    const op = c.querySelector("[data-op]");
    op.value = Math.round(L.opacidadDJ * 100);
    op.addEventListener("change", () => guardar({ opacidadDJ: op.value / 100 }));
    const pintarTipos = () => c.querySelectorAll("[data-tipos] button").forEach(b => b.classList.toggle("activo", b.dataset.m === (TB.prefs.muroTipo || "muro")));
    c.querySelector("[data-tipos]").addEventListener("click", ev => { const b = ev.target.closest("[data-m]"); if (!b) return; TB.prefs.muroTipo = b.dataset.m; TB.guardarPrefs(); pintarTipos(); });
    pintarTipos();
    c.querySelectorAll("[data-dib]").forEach(b => b.addEventListener("click", () => { setCapa("luz"); elegirDibujo(b.dataset.dib); }));
    c.querySelector("[data-luz]").addEventListener("click", () => { const p = TB.L.centroVista(); colocarLuz(p); });
    c.querySelector("[data-uvtt]").addEventListener("change", ev => { const fl = ev.target.files[0]; ev.target.value = ""; if (fl) importarUVTT(fl); });
    c.querySelector("[data-olvidar]").addEventListener("click", () => { TB.L.reiniciarExplorado(); aviso("Lo explorado se ha olvidado en tu vista."); });
    c.querySelector("[data-olvidartodos]").addEventListener("click", async () => {
      if (!(await confirmar("Olvidar lo explorado", "¿Que todos los jugadores vuelvan a ver a oscuras lo que ya exploraron en esta página?", "Olvidar"))) return;
      TB.red.emitir("explorado", { escena: TB.escenaId });
      TB.L.reiniciarExplorado();
      aviso("Lo explorado se ha olvidado para todos los que están conectados.");
    });
    c.querySelectorAll("svg").forEach(s => { s.style.width = "calc(16px * var(--tb-k))"; s.style.height = "calc(16px * var(--tb-k))"; });
    f.appendChild(c);
  }
  async function colocarLuz(p) {
    const capa = TB.capa;
    await TB.crearObjetos([{ tipo: "luz", capa: "luz", x: p.x, y: p.y, ancho: 28, alto: 28, datos: { luz: { brillante: 20, tenue: 20 } } }]);
    if (capa !== "luz") aviso("Luz puesta. Para moverla o cambiarla, pasa a la capa Iluminación (Ctrl + ,).");
  }
  function ajustesLuz(id) {
    const o = TB.L.objeto(id);
    if (!o) return;
    const l = Object.assign({ brillante: 20, tenue: 20 }, (o.datos || {}).luz);
    const c = el(`<div><div class="tb-fila"><label class="tb-campo" style="flex:1"><span>Luz brillante (pies)</span><input type="number" min="0" step="5" data-b></label>
      <label class="tb-campo" style="flex:1"><span>Luz tenue, más allá (pies)</span><input type="number" min="0" step="5" data-t></label></div>
      <p class="tb-nota">Una antorcha da 20 pies de luz brillante y 20 más de tenue; una vela, 5 y 5; un farol, 30 y 30.</p></div>`);
    c.querySelector("[data-b]").value = l.brillante; c.querySelector("[data-t]").value = l.tenue;
    modal({ titulo: "Ajustes de luz", cuerpo: c, ancho: 440, alAceptar: () => TB.cambiarObjeto(id, { datos: Object.assign({}, o.datos, { luz: { brillante: Math.max(0, Number(c.querySelector("[data-b]").value) || 0), tenue: Math.max(0, Number(c.querySelector("[data-t]").value) || 0) } }) }) });
  }
  // Mapa de Dungeondraft (Universal VTT): imagen, tamaño de la página, muros, puertas y luces de una vez
  const cuantos = (n, uno, varios) => n + " " + (n === 1 ? uno : varios);
  async function importarUVTT(archivo) {
    let j;
    try { j = JSON.parse(await archivo.text()); } catch (e) { aviso("Ese archivo no es un mapa .dd2vtt / .uvtt válido.", true); return; }
    if (!j || !j.resolution) { aviso("Ese archivo no trae los datos de un mapa Universal VTT.", true); return; }
    const e = TB.escena();
    if (!e) return;
    const t = TB.L.tamCelda(), piesCelda = (e.cuadricula && e.cuadricula.pies) || 5;
    const u = TBLuz.leerUVTT(j, t, piesCelda);
    if (!(await confirmar("Importar mapa", `Se va a poner el mapa (${u.ancho} × ${u.alto} casillas) con ${cuantos(u.filas.filter(x => x.datos.muro === "muro").length, "muro", "muros")}, ${cuantos(u.filas.filter(x => x.datos.muro === "puerta").length, "puerta", "puertas")} y ${cuantos(u.filas.filter(x => x.tipo === "luz").length, "luz", "luces")} en esta página, y se activa la iluminación dinámica.`, "Importar"))) return;
    try {
      aviso("Importando el mapa…");
      let src = "";
      if (u.imagen) {
        const bin = atob(u.imagen), bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const tipoImg = bytes[0] === 0x89 ? "image/png" : bytes[0] === 0xff ? "image/jpeg" : "image/webp";
        let f = new File([bytes], archivo.name.replace(/\.[^.]+$/, "") + (tipoImg === "image/png" ? ".png" : tipoImg === "image/jpeg" ? ".jpg" : ".webp"), { type: tipoImg });
        if (TB.prefs.webp !== false) f = await aWebp(f);
        src = await TB.red.subirImagen(f);
      }
      const luzAntes = Object.assign({ explorar: true, bloquear: "luz", opacidadDJ: 0.35 }, (e.opciones || {}).luz);
      await TB.guardarEscena(e.id, { ancho: u.ancho, alto: u.alto, opciones: Object.assign({}, e.opciones, { luz: Object.assign(luzAntes, { activa: true, global: u.diurno }) }) });
      const filas = [];
      if (src) filas.push({ tipo: "imagen", capa: "mapa", x: u.anchoPx / 2, y: u.altoPx / 2, ancho: u.anchoPx, alto: u.altoPx, datos: { src, nombre: archivo.name.replace(/\.[^.]+$/, "") } });
      await TB.crearObjetos(filas.concat(u.filas));
      TB.L.ajustarVista();
      aviso("Mapa importado con sus muros, puertas y luces.");
    } catch (err) { aviso(mensajeError(err), true); }
  }

  function flotFx(f) {
    f.appendChild(cabFlot("Efectos", true));
    const fx = TB.prefs.fx;
    const c = el(`<div class="tb-flot-cuerpo">
      <label class="tb-campo"><span style="font-weight:600">Tipo de efecto:</span><select data-tipo>${TBFx.TIPOS.map(t => `<option value="${t.id}">${t.nombre} · ${t.modo === "apuntar" ? "Apuntar" : t.modo === "clic" ? "Haz clic" : "Espera"}</option>`).join("")}</select></label>
      <p class="tb-nota" data-ayuda></p>
      <label class="tb-campo"><span style="font-weight:600">Área al lanzar (regla):</span><select data-plantilla>
        <option value="auto">Automática (según el efecto)</option><option value="linea">Regla (línea)</option><option value="cono">Cono</option><option value="haz">Haz</option><option value="circulo">Círculo</option><option value="cuadrado">Cuadrado</option><option value="ninguna">Sin regla</option></select></label>
      <div data-extra></div>
      <div class="tb-colores-fx">${TBFx.COLORES.map(x => `<button type="button" data-c="${x.id}"><i style="background:${x.muestra}"></i>${x.nombre}</button>`).join("")}</div>
    </div>`);
    const tipo = c.querySelector("[data-tipo]"), ayuda = c.querySelector("[data-ayuda]");
    const pintar = () => {
      tipo.value = fx.tipo;
      const t = TBFx.TIPOS.find(x => x.id === fx.tipo) || TBFx.TIPOS[0];
      ayuda.textContent = t.modo === "apuntar" ? "Arrastra desde el origen hasta el objetivo: verás el área y la distancia." : "Haz clic donde quieras el efecto, o arrastra para ver su área y la distancia.";
      c.querySelectorAll("[data-c]").forEach(b => b.classList.toggle("activo", b.dataset.c === fx.color));
    };
    tipo.addEventListener("change", () => { fx.tipo = tipo.value; TB.guardarPrefs(); TB.aplicarOpcionesLienzo(); pintar(); pintarExtraFx(); setHerramienta("fx"); });
    const plantilla = c.querySelector("[data-plantilla]"), extraFx = c.querySelector("[data-extra]");
    plantilla.value = fx.plantilla || "auto";
    const formaFx = () => { const v = plantilla.value; return v === "auto" ? ({ aliento: "cono", haz: "haz", salpicar: "cono", bomba: "circulo", explotar: "circulo", agrupacion: "circulo", estrella: "circulo", quemar: "circulo", rafaga: "circulo" }[fx.tipo] || "linea") : v; };
    const pintarExtraFx = () => pintarExtraMedida(extraFx, formaFx, () => { TB.guardarPrefs(); TB.aplicarOpcionesLienzo(); });
    plantilla.addEventListener("change", () => { fx.plantilla = plantilla.value; TB.guardarPrefs(); TB.aplicarOpcionesLienzo(); pintarExtraFx(); });
    pintarExtraFx();
    c.querySelector(".tb-colores-fx").addEventListener("click", e => { const b = e.target.closest("[data-c]"); if (!b) return; fx.color = b.dataset.c; TB.guardarPrefs(); pintar(); setHerramienta("fx"); });
    pintar();
    f.appendChild(c);
  }

  function flotCapas(f) {
    f.classList.add("menu");
    f.style.width = "auto";
    CAPAS.forEach(c => {
      const b = el(`<button type="button" class="tb-menu-item${c.id === TB.capa ? " activo" : ""}">${I[c.icono]}${c.nombre}</button>`);
      b.addEventListener("click", () => { setCapa(c.id); cerrarFlotante(); });
      f.appendChild(b);
    });
    f.style.top = "auto";
  }

  /* ============================================================ zoom */
  function construirZoom() {
    const z = document.getElementById("tbZoom");
    z.innerHTML = `${TB.esGM() ? `<button type="button" data-z="vista" title="Ver como jugador">${I.ojo}</button>` : ""}
      <span class="tb-zoom-num" data-num>100</span>
      <button type="button" data-z="mas" title="Acercar">${I.mas}</button>
      <div class="tb-zoom-barra" data-barra><div class="tb-zoom-relleno" data-relleno></div><div class="tb-zoom-asa" data-asa></div></div>
      <button type="button" data-z="menos" title="Alejar">${I.menos}</button>
      <button type="button" data-z="centrar" title="Centrar la vista">${I.centrar}</button>`;
    const barra = z.querySelector("[data-barra]");
    const aFrac = v => (Math.log(v) - Math.log(0.1)) / (Math.log(4) - Math.log(0.1));
    const deFrac = f => Math.exp(Math.log(0.1) + f * (Math.log(4) - Math.log(0.1)));
    const pintar = v => {
      z.querySelector("[data-num]").textContent = Math.round(v * 100);
      const f = Math.max(0, Math.min(1, aFrac(v)));
      z.querySelector("[data-relleno]").style.height = f * 100 + "%";
      z.querySelector("[data-asa]").style.bottom = f * 100 + "%";
    };
    TB.on("zoom", pintar);
    pintar(TB.L.zoom());
    const desdeRaton = ev => { const r = barra.getBoundingClientRect(); TB.L.ponerZoom(deFrac(1 - Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)))); };
    barra.addEventListener("mousedown", ev => {
      desdeRaton(ev);
      const mover = e => desdeRaton(e), soltar = () => { window.removeEventListener("mousemove", mover); window.removeEventListener("mouseup", soltar); };
      window.addEventListener("mousemove", mover); window.addEventListener("mouseup", soltar);
    });
    z.addEventListener("click", e => {
      const b = e.target.closest("[data-z]");
      if (!b) return;
      const a = b.dataset.z;
      if (a === "mas") TB.L.ponerZoom(TB.L.zoom() * 1.2);
      if (a === "menos") TB.L.ponerZoom(TB.L.zoom() / 1.2);
      if (a === "centrar") {
        const mias = TB.L.objetos().filter(o => TB.controla(o));
        if (!TB.esGM() && mias.length) TB.L.centrarEn(mias[0].x, mias[0].y); else TB.L.ajustarVista();
      }
      if (a === "vista") {
        TB.vistaJugador = !TB.vistaJugador;
        TB.L.setVistaJugador(TB.vistaJugador);
        b.classList.toggle("activo", TB.vistaJugador);
        aviso(TB.vistaJugador ? "Vista de jugador: la capa del DJ está oculta y la máscara se ve negra." : "Vista de DJ.");
      }
    });
  }

  /* ============================================================ orden de turno */
  /* Como el de Roll20: la ficha a la que le toca va arriba (en verde) y el número de la derecha es su iniciativa.
     El DJ lo abre para todos; los jugadores lo ven mientras esté abierto, pasan su turno y cambian el número de
     sus fichas. Ordenar, mover filas, quitar y retroceder es del DJ. */
  function alternarTurno() {
    if (ventanas.has("turno")) {
      if (TB.esGM()) { TB.guardarIniciativa(Object.assign({}, TB.estado.iniciativa, { visible: false })); ventanas.get("turno").cerrar(); }
      else ventanas.get("turno").el.classList.toggle("minimizada");
      return;
    }
    if (TB.esGM()) TB.guardarIniciativa(Object.assign({ lista: [], turno: 0, ronda: 1 }, TB.estado.iniciativa, { visible: true }));
    else if (!(TB.estado.iniciativa || {}).visible) { aviso("El DJ no ha abierto el orden de turno."); return; }
    abrirTurno();
  }
  function abrirTurno() {
    const v = ventana("turno", {
      titulo: "Orden de turno", x: window.innerWidth - (parseInt(getComputedStyle(document.documentElement).getPropertyValue("--tb-lado"), 10) || 410) - 300, y: 150, ancho: 250, alto: 470,
      alCerrar: () => { marcarBarra(); if (TB.esGM() && (TB.estado.iniciativa || {}).visible) TB.guardarIniciativa(Object.assign({}, TB.estado.iniciativa, { visible: false })); }
    });
    // Los jugadores no lo cierran: lo cierra el DJ para todos (sí pueden minimizarlo)
    if (!TB.esGM()) { const c = v.el.querySelector("[data-cerrar]"); if (c) c.remove(); }
    v.cuerpo.style.display = "flex"; v.cuerpo.style.flexDirection = "column"; v.cuerpo.style.overflow = "hidden";
    pintarTurno();
    marcarBarra();
  }
  function ordenarTurno(desc) {
    const ini = Object.assign({ lista: [], turno: 0, ronda: 1 }, TB.estado.iniciativa);
    const lista = (ini.lista || []).slice().sort((a, b) => desc ? (Number(b.valor) || 0) - (Number(a.valor) || 0) : (Number(a.valor) || 0) - (Number(b.valor) || 0));
    TB.guardarIniciativa(Object.assign({}, ini, { lista, turno: 0 }));
  }
  function pintarTurno() {
    const v = ventanas.get("turno");
    if (!v) return;
    const ini = Object.assign({ lista: [], turno: 0, ronda: 1 }, TB.estado.iniciativa);
    const gm = TB.esGM();
    const lista = ini.lista || [];
    const n = lista.length;
    const t = n ? Math.min(Math.max(ini.turno | 0, 0), n - 1) : 0;
    // Orden de pintado: desde la ficha actual, dando la vuelta (la actual arriba)
    const vista = lista.map((e, i) => ({ e, i })).slice(t).concat(lista.map((e, i) => ({ e, i })).slice(0, t));
    v.cuerpo.innerHTML = "";
    const cab = el(`<div class="tb-turno-cab"><span>Contar: <span data-ronda class="${gm ? "tb-turno-ronda" : ""}" title="${gm ? "Clic para cambiar el contador de rondas" : "Ronda"}">${ini.ronda || 1}</span></span>
      ${gm ? `<button type="button" data-ordenar title="Ordenar">${I.ordenar}</button>` : ""}</div>`);
    const filas = el(`<div class="tb-turno-lista" style="flex:1"></div>`);
    vista.forEach(({ e, i }, k) => {
      if (e.oculto && !gm) return;
      const o = TB.L.objeto(e.id);
      const src = (o && o.datos && o.datos.src) || e.src || "";
      const nombre = (o && o.datos && o.datos.nombre) || e.nombre || "";
      const mio = !!(o && TB.controla(o));
      const verNombre = gm || mio || (o && o.datos && o.datos.verNombre) || !o;
      const f = el(`<div class="tb-turno-fila${k === 0 ? " actual" : ""}${e.oculto ? " oculta" : ""}" draggable="${gm}" data-i="${i}">
        <span class="tb-turno-av" style="${src ? `background-image:url('${esc(src)}')` : ""}"></span>
        <span class="tb-turno-nombre">${verNombre ? esc(nombre) : ""}</span>
        <span class="tb-turno-valor${gm || mio ? " editable" : ""}" data-valor title="${gm || mio ? "Clic para cambiar la iniciativa" : "Iniciativa"}">${esc(e.valor)}</span></div>`);
      f.addEventListener("click", ev => {
        if (ev.target.closest("[data-valor]") && (gm || mio)) { editarValor(f, i, mio && !gm); return; }
        if (o) { TB.L.centrarEn(o.x, o.y); if (gm || mio) TB.L.seleccionar([o.id]); }
      });
      if (gm) {
        f.addEventListener("contextmenu", ev => { ev.preventDefault(); menu(ev.clientX, ev.clientY, [
          { texto: "Que sea su turno", accion: () => TB.guardarIniciativa(Object.assign({}, ini, { turno: i })) },
          { texto: "Subir un puesto", accion: () => moverFila(i, i - 1) },
          { texto: "Bajar un puesto", accion: () => moverFila(i, i + 1) },
          "-",
          { texto: "Quitar del orden", peligro: true, accion: () => { const l = lista.slice(); l.splice(i, 1); TB.guardarIniciativa(Object.assign({}, ini, { lista: l, turno: Math.min(t > i ? t - 1 : t, Math.max(l.length - 1, 0)) })); } }
        ]); });
        f.addEventListener("dragstart", ev => { ev.dataTransfer.setData("text/turno", String(i)); f.classList.add("arrastrando"); });
        f.addEventListener("dragend", () => f.classList.remove("arrastrando"));
        f.addEventListener("dragover", ev => { ev.preventDefault(); f.classList.add("sobre"); });
        f.addEventListener("dragleave", () => f.classList.remove("sobre"));
        f.addEventListener("drop", ev => { ev.preventDefault(); f.classList.remove("sobre"); const de = parseInt(ev.dataTransfer.getData("text/turno"), 10); if (!isNaN(de)) moverFila(de, i); });
      }
      filas.appendChild(f);
    });
    if (!filas.children.length) filas.appendChild(el(`<p class="tb-turno-vacio">No hay fichas de esta página en el orden de turno.<br><br>${gm ? "Haz clic derecho en una ficha y elige Añadir turno (o usa Ctrl+U)." : "Haz clic derecho en tu ficha y elige Añadir turno (o usa Ctrl+U)."}</p>`));
    function moverFila(de, a) {
      if (a < 0 || a >= lista.length || de === a) return;
      const actual = lista[t];
      const l = lista.slice(); const [x] = l.splice(de, 1); l.splice(a, 0, x);
      TB.guardarIniciativa(Object.assign({}, ini, { lista: l, turno: Math.max(0, l.indexOf(actual)) }));
    }
    const actual = lista[t];
    const esMio = actual && TB.controla(TB.L.objeto(actual.id));
    const pie = el(`<div class="tb-turno-pie">
      <button type="button" class="tb-btn tb-btn-borde" data-atras ${gm ? "" : "disabled"} title="Turno anterior">${I.izquierda}</button>
      ${gm ? `<button type="button" class="tb-btn" data-cfg style="min-width:calc(40px * var(--tb-k));border:0;background:none" title="Opciones">${I.engranaje}</button>` : ""}
      <button type="button" class="tb-btn tb-btn-acento" data-adelante ${gm || esMio ? "" : "disabled"} title="${gm ? "Siguiente turno" : "Terminar mi turno"}">${I.derecha}</button></div>`);
    pie.querySelectorAll("svg").forEach(s => { s.style.width = "calc(20px * var(--tb-k))"; s.style.height = "calc(20px * var(--tb-k))"; });
    pie.querySelector("[data-atras]").addEventListener("click", () => TB.pasarTurno(-1));
    pie.querySelector("[data-adelante]").addEventListener("click", () => TB.pasarTurno(1));
    if (gm) {
      cab.querySelector("[data-ordenar]").addEventListener("click", ev => menu(ev.clientX - 180, ev.clientY + 10, [
        { texto: "De mayor a menor", accion: () => ordenarTurno(true) },
        { texto: "De menor a mayor", accion: () => ordenarTurno(false) }
      ]));
      cab.querySelector("[data-ronda]").addEventListener("click", async () => {
        const v2 = await pedir("Contador de rondas", String(ini.ronda || 1), { etiqueta: "Ronda" });
        if (v2 !== null && !isNaN(parseInt(v2, 10))) TB.guardarIniciativa(Object.assign({}, ini, { ronda: Math.max(0, parseInt(v2, 10)) }));
      });
      pie.querySelector("[data-cfg]").addEventListener("click", ev => menu(ev.clientX, ev.clientY - 230, [
        { texto: "Ordenar de mayor a menor", accion: () => ordenarTurno(true) },
        { texto: "Ordenar de menor a mayor", accion: () => ordenarTurno(false) },
        "-",
        { texto: "Añadir elemento personalizado", accion: async () => {
          const nom = await pedir("Elemento personalizado", "", { etiqueta: "Nombre (por ejemplo, Trampa o Fin del hechizo)" });
          if (!nom) return;
          const val = await pedir("Elemento personalizado", "0", { etiqueta: "Número de iniciativa" });
          TB.guardarIniciativa(Object.assign({}, ini, { lista: lista.concat([{ id: "x" + Date.now(), nombre: nom, valor: parseFloat(val) || 0 }]) }));
        } },
        { texto: "Añadir las fichas seleccionadas", accion: () => TB.anadirAlTurno(TB.L.seleccion()) },
        { texto: "Volver a la ronda 1", accion: () => TB.guardarIniciativa(Object.assign({}, ini, { ronda: 1, turno: 0 })) },
        "-",
        { texto: "Vaciar la lista", peligro: true, accion: () => TB.guardarIniciativa(Object.assign({}, ini, { lista: [], turno: 0, ronda: 1 })) }
      ]));
    }
    v.cuerpo.append(cab, filas, pie);
  }
  function editarValor(fila, i, comoJugador) {
    const ini = TB.estado.iniciativa;
    const celda = fila.querySelector("[data-valor]");
    const inp = el(`<input type="number" value="${esc(ini.lista[i].valor)}">`);
    celda.innerHTML = ""; celda.appendChild(inp); inp.focus(); inp.select();
    let hecho = false;
    const guardar = () => {
      if (hecho) return; hecho = true;
      const v = parseFloat(inp.value) || 0;
      if (comoJugador) { TB.red.iniciativaValor ? TB.red.iniciativaValor(ini.lista[i].id, v).catch(e => aviso(mensajeError(e), true)) : null; return; }
      const l = ini.lista.slice(); l[i] = Object.assign({}, l[i], { valor: v });
      TB.guardarIniciativa(Object.assign({}, ini, { lista: l }));
    };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") inp.blur(); if (e.key === "Escape") { hecho = true; pintarTurno(); } });
    inp.addEventListener("blur", guardar);
  }

  /* ============================================================ ajustes de ficha */
  function ajustesFicha(id, plantilla) {
    // plantilla: { diario } para editar el token predeterminado de un personaje del diario
    const entrada = plantilla && TB.diario.get(plantilla.diario);
    const o = plantilla ? Object.assign({ ancho: 70, alto: 70, opacidad: 1, controladores: [], datos: {} }, entrada && entrada.token, { capa: "fichas" }) : TB.L.objeto(id);
    if (!o) return;
    const gm = TB.esGM();
    const d = JSON.parse(JSON.stringify(o.datos || {}));
    const barras = [0, 1, 2].map(i => Object.assign({ valor: "", max: "", ver: true, editar: false, texto: "editores" }, (d.barras || [])[i]));
    const auras = [0, 1].map(i => Object.assign({ radio: "", forma: "circulo", color: i ? "#5ce58f" : "#ffff99", opacidad: 0.35, ver: true }, (d.auras || [])[i]));
    const cuerpo = el(`<div></div>`);
    const pestanas = el(`<div class="tb-pestanas-modal"><button type="button" class="activo" data-p="det">Detalles</button>${gm && !plantilla ? `<button type="button" data-p="notas">Notas del DJ</button>` : ""}</div>`);
    const det = el(`<div></div>`), notas = el(`<div hidden></div>`);
    cuerpo.append(pestanas, det, notas);
    pestanas.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; pestanas.querySelectorAll("button").forEach(x => x.classList.toggle("activo", x === b)); det.hidden = b.dataset.p !== "det"; notas.hidden = b.dataset.p !== "notas"; });

    const personajes = [...TB.diario.values()].filter(x => x.tipo === "personaje" && !x.archivado).sort((a, b) => a.nombre.localeCompare(b.nombre));
    const jugadores = TB.jugadores.map(j => ({ id: j.uid, nombre: j.nombre }));
    const controlSel = chips(jugadores, (o.controlan_todos ? ["*"] : []).concat(o.controladores || []), { todos: "Todos los jugadores" });

    const general = el(`<div>
      <div class="tb-fila" style="justify-content:space-between"><h3 style="margin:calc(4px * var(--tb-k)) 0 calc(14px * var(--tb-k));font-size:calc(19px * var(--tb-k))">General</h3></div>
      ${gm ? `<label class="tb-campo"><span>Representa a un personaje</span><select data-rep><option value="">Ninguno / Ficha genérica</option>${personajes.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join("")}</select></label>` : ""}
      <label class="tb-campo"><span>Nombre</span><span class="tb-fila"><input type="text" data-nombre ${gm ? "" : "disabled"}><label class="tb-casilla tb-btn" style="white-space:nowrap"><input type="checkbox" data-vernombre ${gm ? "" : "disabled"}> Nombre</label></span></label>
      ${gm ? `<div class="tb-campo"><span>Tamaño</span><span class="tb-fila" style="align-items:center;flex-wrap:wrap">
          <select data-tampre style="width:auto;flex:1;min-width:calc(150px * var(--tb-k))"><option value="">Personalizado</option><option value="0.5">Diminuto (½ casilla)</option><option value="1">Pequeño o mediano (1 casilla)</option><option value="2">Grande (2 × 2)</option><option value="3">Enorme (3 × 3)</option><option value="4">Gargantuesco (4 × 4)</option></select>
          <span class="tb-ud"><input type="number" step="0.25" min="0.25" max="40" data-tw style="width:calc(64px * var(--tb-k))"><i>ancho</i></span>
          <span class="tb-ud"><input type="number" step="0.25" min="0.25" max="40" data-th style="width:calc(64px * var(--tb-k))"><i>alto</i></span><span class="tb-nota">casillas</span></span></div>` : ""}
      ${gm ? `<div class="tb-campo"><span>Controlado por</span><div data-control></div><span class="tb-nota" data-control-nota hidden>(Determinado por los ajustes de personaje)</span></div>
        <div class="tb-fila" style="flex-wrap:wrap;margin-bottom:calc(12px * var(--tb-k))">${plantilla ? "" : `<button type="button" class="tb-btn tb-btn-azul" data-predet>Actualizar ficha predeterminada</button>`}<button type="button" class="tb-btn tb-btn-azul" data-hoja>Abrir hoja de personaje</button></div>
        <div class="tb-campo"><span>Color de tinte</span><span class="tb-fila"><input type="color" data-tinte><label class="tb-casilla"><input type="checkbox" data-sintinte> Sin tinte</label></span></div>` : ""}
    </div>`);
    const derecha = el(`<div><h3 style="margin:calc(4px * var(--tb-k)) 0 calc(14px * var(--tb-k));font-size:calc(19px * var(--tb-k))">Barras De Ficha</h3></div>`);
    barras.forEach((b, i) => {
      const puede = gm || b.editar;
      const fila = el(`<div class="tb-barra-cfg">
        <span class="tb-bola" style="background:${["#5cb85c", "#4f8fd6", "#d9534f"][i]}"></span><input type="number" data-v ${puede ? "" : "disabled"}>
        <span>/</span><input type="number" data-m ${puede ? "" : "disabled"}>
        <select data-enlace ${gm ? "" : "disabled"} title="Atributo: la barra sigue los PV de esa ficha del compendio"><option value="">Ninguno</option>${(TB.fichas || []).map(fc => `<option value="${esc(fc.id)}">PV de ${esc(fc.nombre)}</option>`).join("")}${b.enlace && !(TB.fichas || []).some(fc => fc.id === b.enlace) ? `<option value="${esc(b.enlace)}">PV de una ficha</option>` : ""}</select>
        ${gm ? `<span style="position:relative"><button type="button" class="tb-kebab" data-k>⋮</button>
          <div class="tb-kebab-menu" hidden><b style="display:block;margin-bottom:calc(6px * var(--tb-k))">Permisos de jugadores</b>
            <label><input type="checkbox" data-ver> Ver</label><label><input type="checkbox" data-editar> Editar</label>
            <span style="display:block;margin:calc(8px * var(--tb-k)) 0 calc(4px * var(--tb-k))">Texto superpuesto:</span>
            <select data-texto><option value="oculto">Oculto</option><option value="editores">Visible para los editores</option><option value="todos">Visible para todos</option></select></div></span>` : "<span></span>"}
      </div>`);
      fila.querySelector("[data-v]").value = b.valor; fila.querySelector("[data-m]").value = b.max;
      const selEnl = fila.querySelector("[data-enlace]");
      selEnl.value = b.enlace || "";
      // Al enlazar, la barra toma los PV de la ficha
      selEnl.addEventListener("change", () => {
        const fc = (TB.fichas || []).find(x => x.id === selEnl.value), c = fc && fc.combate;
        if (c) { fila.querySelector("[data-v]").value = Number(c.pvActual) || 0; fila.querySelector("[data-m]").value = Number(c.pvMax) || 0; }
      });
      if (gm) {
        fila.querySelector("[data-ver]").checked = b.ver !== false; fila.querySelector("[data-editar]").checked = !!b.editar; fila.querySelector("[data-texto]").value = b.texto || "editores";
        const k = fila.querySelector("[data-k]"), km = fila.querySelector(".tb-kebab-menu");
        k.addEventListener("click", ev => { ev.stopPropagation(); km.hidden = !km.hidden; });
        km.addEventListener("click", ev => ev.stopPropagation());
      }
      fila.dataset.i = i;
      derecha.appendChild(fila);
    });
    if (gm) {
      derecha.appendChild(el(`<div class="tb-campo" style="margin-top:calc(14px * var(--tb-k))"><span>Opacidad Base</span><input type="range" min="0" max="100" data-opac><span class="tb-nota" data-opac-txt></span></div>`));
    }
    det.appendChild(el(`<div class="tb-dos-col"></div>`));
    det.firstChild.append(general, derecha);
    if (gm) {
      det.appendChild(el(`<hr class="tb-sep">`));
      det.appendChild(el(`<div class="tb-dos-col"><div><h3 style="font-size:calc(19px * var(--tb-k));margin:calc(6px * var(--tb-k)) 0 calc(12px * var(--tb-k))">Opciones De Barra De Ficha</h3>
        <label class="tb-campo"><span>Posición</span><select data-bpos><option value="encima">Encima</option><option value="debajo">Debajo</option></select></label></div>
        <div><h3 style="font-size:calc(19px * var(--tb-k));margin:calc(6px * var(--tb-k)) 0 calc(12px * var(--tb-k))">&nbsp;</h3><div class="tb-campo"><span>Estilo</span><span class="tb-fila"><label class="tb-casilla"><input type="radio" name="bestilo" value="estandar"> Estándar</label><label class="tb-casilla"><input type="radio" name="bestilo" value="compacto"> Compacto</label></span></div></div></div>`));
      det.appendChild(el(`<hr class="tb-sep">`));
      const aurasEl = el(`<div><h3 style="font-size:calc(19px * var(--tb-k));margin:calc(6px * var(--tb-k)) 0 calc(12px * var(--tb-k))">Aura De Ficha</h3><div class="tb-aura-cfg"></div></div>`);
      auras.forEach((a, i) => {
        const caja = el(`<div data-aura="${i}"><b style="display:block;margin-bottom:calc(8px * var(--tb-k))">Aura ${i + 1}</b>
          <div class="tb-fila"><label class="tb-campo" style="flex:1"><span style="font-weight:400">Radio (pies)</span><input type="number" min="0" data-radio></label>
          <label class="tb-campo" style="flex:1.2"><span style="font-weight:400">Forma</span><select data-forma><option value="circulo">Círculo</option><option value="cuadrado">Cuadrado</option></select></label>
          <label class="tb-campo"><span style="font-weight:400">Color</span><input type="color" data-color></label></div>
          <label class="tb-campo"><span style="font-weight:400">Opacidad del aura</span><input type="range" min="0" max="100" data-op></label>
          <label class="tb-casilla"><input type="checkbox" data-ver> La ven los jugadores</label></div>`);
        caja.querySelector("[data-radio]").value = a.radio; caja.querySelector("[data-forma]").value = a.forma; caja.querySelector("[data-color]").value = a.color;
        caja.querySelector("[data-op]").value = Math.round((a.opacidad == null ? 0.35 : a.opacidad) * 100); caja.querySelector("[data-ver]").checked = a.ver !== false;
        aurasEl.querySelector(".tb-aura-cfg").appendChild(caja);
      });
      det.appendChild(aurasEl);
      det.appendChild(el(`<hr class="tb-sep">`));
      const vis = Object.assign({ ve: !!(o.controlan_todos || (o.controladores || []).length), oscuridad: 0 }, d.vision);
      const luz = Object.assign({ brillante: 0, tenue: 0 }, d.luz);
      const luzEl = el(`<div><h3 style="font-size:calc(19px * var(--tb-k));margin:calc(6px * var(--tb-k)) 0 calc(12px * var(--tb-k))">Visión e iluminación</h3>
        <div class="tb-fila" style="flex-wrap:wrap;gap:calc(10px * var(--tb-k)) calc(16px * var(--tb-k))">
          <label class="tb-casilla"><input type="checkbox" data-ve> Tiene visión (los que la controlan ven por sus ojos)</label></div>
        <div class="tb-fila" style="margin-top:calc(8px * var(--tb-k))">
          <label class="tb-campo" style="flex:1"><span style="font-weight:400">Visión en la oscuridad (pies)</span><input type="number" min="0" step="5" data-osc></label>
          <label class="tb-campo" style="flex:1"><span style="font-weight:400">Luz brillante que da (pies)</span><input type="number" min="0" step="5" data-lb></label>
          <label class="tb-campo" style="flex:1"><span style="font-weight:400">Luz tenue, más allá (pies)</span><input type="number" min="0" step="5" data-lt></label></div>
        <p class="tb-nota" style="margin:0">Solo cuenta en las páginas con la iluminación dinámica activada. Antorcha: 20 y 20.</p></div>`);
      luzEl.querySelector("[data-ve]").checked = vis.ve !== false;
      luzEl.querySelector("[data-osc]").value = vis.oscuridad || 0;
      luzEl.querySelector("[data-lb]").value = luz.brillante || 0;
      luzEl.querySelector("[data-lt]").value = luz.tenue || 0;
      det.appendChild(luzEl);
    }

    // Valores iniciales
    const q = s => cuerpo.querySelector(s);
    q("[data-nombre]").value = d.nombre || "";
    q("[data-vernombre]").checked = !!d.verNombre;
    let notaGM = null;
    if (gm) {
      q("[data-control]").appendChild(controlSel.el);
      const rep = q("[data-rep]");
      rep.value = d.representa || "";
      const pintarRep = () => { const r = !!rep.value; controlSel.el.style.display = r ? "none" : ""; q("[data-control-nota]").hidden = !r; };
      rep.addEventListener("change", () => { const p = TB.diario.get(rep.value); if (p && !q("[data-nombre]").value) q("[data-nombre]").value = p.nombre; pintarRep(); });
      pintarRep();
      q("[data-tinte]").value = d.tinte || "#ff0000"; q("[data-sintinte]").checked = !d.tinte;
      // Tamaño en casillas
      const tc = TB.L.tamCelda(), tw = q("[data-tw]"), th = q("[data-th]"), tp = q("[data-tampre]");
      tw.value = Math.round(o.ancho / tc * 100) / 100; th.value = Math.round(o.alto / tc * 100) / 100;
      const marcarPre = () => { tp.value = tw.value === th.value && ["0.5", "1", "2", "3", "4"].includes(String(Number(tw.value))) ? String(Number(tw.value)) : ""; };
      marcarPre();
      tp.addEventListener("change", () => { if (tp.value) { tw.value = tp.value; th.value = tp.value; } });
      tw.addEventListener("input", marcarPre); th.addEventListener("input", marcarPre);
      const opac = q("[data-opac]"), opTxt = q("[data-opac-txt]");
      opac.value = Math.round((o.opacidad == null ? 1 : o.opacidad) * 100); opTxt.textContent = opac.value + "%";
      opac.addEventListener("input", () => { opTxt.textContent = opac.value + "%"; });
      q("[data-bpos]").value = d.barraPos || "encima";
      cuerpo.querySelector(`input[name=bestilo][value=${d.barraEstilo === "compacto" ? "compacto" : "estandar"}]`).checked = true;
      const hoja = q("[data-hoja]");
      hoja.addEventListener("click", () => { const r = rep.value; if (r) TBLado.abrirEntrada(r); else aviso("Esta ficha no representa a ningún personaje del diario."); });
      const predet = q("[data-predet]");
      if (predet) predet.addEventListener("click", async () => {
        const r = rep.value; const p = TB.diario.get(r);
        if (!p) { aviso("Primero elige a qué personaje representa."); return; }
        await TB.red.actualizarDiario(r, { token: { ancho: o.ancho, alto: o.alto, datos: leerDatos() } });
        aviso("Ficha predeterminada actualizada.");
      });
      if (!plantilla) {
        notas.appendChild(el(`<label class="tb-campo"><span>Notas del DJ (los jugadores no las ven nunca)</span><textarea rows="10" data-notas placeholder="Cargando…"></textarea></label>`));
        TB.red.notaGM(o.id).then(t => { notaGM = t || ""; q("[data-notas]").value = notaGM; q("[data-notas]").placeholder = ""; }).catch(() => {});
      }
    }

    function leerDatos() {
      const nd = Object.assign({}, d);
      nd.nombre = q("[data-nombre]").value.trim();
      nd.verNombre = q("[data-vernombre]").checked;
      nd.barras = [...cuerpo.querySelectorAll(".tb-barra-cfg")].map((f, i) => {
        const v = f.querySelector("[data-v]").value, m = f.querySelector("[data-m]").value;
        const b = Object.assign({}, barras[i], { valor: v === "" ? "" : Number(v), max: m === "" ? "" : Number(m) });
        if (gm) { b.ver = f.querySelector("[data-ver]").checked; b.editar = f.querySelector("[data-editar]").checked; b.texto = f.querySelector("[data-texto]").value; b.enlace = f.querySelector("[data-enlace]").value || null; }
        return b;
      });
      if (gm) {
        nd.representa = q("[data-rep]").value || null;
        nd.tinte = q("[data-sintinte]").checked ? null : q("[data-tinte]").value;
        nd.barraPos = q("[data-bpos]").value;
        nd.barraEstilo = cuerpo.querySelector("input[name=bestilo]:checked").value;
        nd.vision = { ve: q("[data-ve]").checked, oscuridad: Math.max(0, Number(q("[data-osc]").value) || 0) };
        const lb = Math.max(0, Number(q("[data-lb]").value) || 0), lt = Math.max(0, Number(q("[data-lt]").value) || 0);
        nd.luz = lb || lt ? { brillante: lb, tenue: lt } : null;
        nd.auras = [...cuerpo.querySelectorAll("[data-aura]")].map(c => ({
          radio: Number(c.querySelector("[data-radio]").value) || 0, forma: c.querySelector("[data-forma]").value, color: c.querySelector("[data-color]").value,
          opacidad: Number(c.querySelector("[data-op]").value) / 100, ver: c.querySelector("[data-ver]").checked
        }));
      }
      return nd;
    }

    modal({
      titulo: plantilla ? "Ficha predeterminada de " + esc((entrada && entrada.nombre) || "") : "Ajustes de fichas", cuerpo, ancho: 880,
      alAceptar: async () => {
        const nd = leerDatos();
        const tcel = TB.L.tamCelda();
        const nuevoAncho = gm && q("[data-tw]") ? Math.max(5, (Number(q("[data-tw]").value) || o.ancho / tcel) * tcel) : o.ancho;
        const nuevoAlto = gm && q("[data-th]") ? Math.max(5, (Number(q("[data-th]").value) || o.alto / tcel) * tcel) : o.alto;
        if (plantilla) { await TB.red.actualizarDiario(plantilla.diario, { token: { ancho: nuevoAncho, alto: nuevoAlto, datos: nd } }); return; }
        // Una barra enlazada que se cambia aquí también cambia los PV de la ficha (el servidor comprueba que sea tuya o que seas el DJ)
        for (let i = 0; i < 3; i++) {
          const b = nd.barras[i], antes = barras[i];
          if (b.enlace && (gm || b.editar) && (b.valor !== antes.valor || b.max !== antes.max || b.enlace !== antes.enlace)) {
            try {
              await TB.red.fichaPV(b.enlace, { actual: b.valor === "" ? null : Number(b.valor), max: b.max === "" ? null : Number(b.max), temp: null });
              const fc = (TB.fichas || []).find(x => x.id === b.enlace);
              if (fc) fc.combate = Object.assign({}, fc.combate, { pvActual: Number(b.valor) || 0, pvMax: Number(b.max) || 0 });
            } catch (e) { aviso("La barra cambió, pero la ficha no: " + mensajeError(e), true); }
          }
        }
        if (!gm) {
          // El jugador solo cambia las barras que el DJ le deja editar
          for (let i = 0; i < 3; i++) {
            const b = nd.barras[i], antes = barras[i];
            if (b.editar && (b.valor !== antes.valor || b.max !== antes.max)) await TB.red.barra(o.id, i + 1, Number(b.valor) || 0, Number(b.max) || 0);
          }
          return;
        }
        const cambios = { datos: nd, opacidad: Number(q("[data-opac]").value) / 100 };
        if (Math.abs(nuevoAncho - o.ancho) > 0.5 || Math.abs(nuevoAlto - o.alto) > 0.5) { cambios.ancho = nuevoAncho; cambios.alto = nuevoAlto; }
        const p = nd.representa && TB.diario.get(nd.representa);
        if (p) { cambios.controladores = (p.controladores || []).slice(); cambios.controlan_todos = false; }
        else { const v = controlSel.valor(); cambios.controlan_todos = v.includes("*"); cambios.controladores = v.filter(x => x !== "*"); }
        await TB.cambiarObjeto(o.id, cambios);
        const tn = q("[data-notas]");
        if (tn && notaGM !== null && tn.value !== notaGM) await TB.red.guardarNotaGM(o.id, tn.value);
      }
    });
  }

  /* ============================================================ menús de clic derecho (los de Roll20) */
  const GRUPO_KEY = "tbGrupoDefinido";
  function pingTodos(x, y, centrar) {
    TB.L.ping(x, y, TB.colorJugador(TB.yo.uid));
    TB.red.emitir("ping", { x, y, color: TB.colorJugador(TB.yo.uid), centrar: !!centrar && TB.esGM(), escena: TB.escenaId });
    if (centrar && TB.esGM()) TB.L.centrarEn(x, y);
  }
  function alternarPausa() {
    const v = !TB.estado.pausa;
    TB.red.actualizarEstado({ pausa: v }).then(() => { TB.estado.pausa = v; TB.L.setPausa(v); aviso(v ? "Movimiento de los jugadores en pausa." : "Movimiento reanudado."); }).catch(e => aviso(mensajeError(e), true));
  }
  async function colocarGrupo(p) {
    let g;
    try { g = JSON.parse(localStorage.getItem(GRUPO_KEY) || "null"); } catch (e) { g = null; }
    if (!g || !g.filas || !g.filas.length) { aviso("Primero define un grupo: selecciona fichas → clic derecho → Definir grupo."); return; }
    const cx = g.filas.reduce((s, o) => s + o.x, 0) / g.filas.length, cy = g.filas.reduce((s, o) => s + o.y, 0) / g.filas.length;
    const nuevas = await TB.crearObjetos(g.filas.map(o => { const c = Object.assign({}, o); delete c.id; delete c.actualizado; delete c.escena; return Object.assign(c, TB.L.ajustarPos(c, p.x + o.x - cx, p.y + o.y - cy)); }));
    TB.L.seleccionar(nuevas.map(o => o.id));
  }
  async function colocarPin(p) {
    const titulo = await pedir("Colocar pin", "", { etiqueta: "Título del pin (por ejemplo, Puerta secreta)" });
    if (titulo === null) return;
    const capaAntes = TB.capa;
    TB.capa = "fichas";
    await TB.crearObjetos([{ tipo: "pin", capa: "fichas", x: p.x, y: p.y, ancho: 30, alto: 40, datos: { titulo: titulo.trim().slice(0, 60), color: "#d6127e" } }]);
    TB.capa = capaAntes;
  }
  function pegarEn(p) { TB.pegar && TB.pegar(p); }
  function itemsComunes(p, gm) {
    const items = [
      { icono: "pingTodos", texto: "Ping a todo el mundo", accion: () => pingTodos(p.x, p.y, false) }
    ];
    if (gm) items.push(
      { icono: "pingEnfoque", texto: "Ping de enfoque", accion: () => pingTodos(p.x, p.y, true) },
      { icono: "candado", texto: TB.estado.pausa ? "Reanudar el movimiento" : "Pausar el movimiento", accion: alternarPausa }
    );
    return items;
  }
  function menuVacio(p, x, y) {
    const gm = TB.esGM();
    const items = itemsComunes(p, gm);
    if (gm) items.push(
      { icono: "grupoPon", texto: "Colocar grupo", accion: () => colocarGrupo(p) },
      { icono: "ping", texto: "Colocar pin", accion: () => colocarPin(p) },
      { icono: "luz", texto: "Colocar una luz", accion: () => colocarLuz(p) },
      { icono: "pegar", texto: "Pegar", apagado: !(TB.portapapeles && TB.portapapeles().length), accion: () => pegarEn(p) },
      { icono: "deshacer", texto: "Deshacer", apagado: !TB.puedeDeshacer(), accion: () => TB.deshacer() },
      { icono: "rehacer", texto: "Rehacer", apagado: !TB.puedeRehacer(), accion: () => TB.rehacer() }
    );
    menu(x, y, items);
  }
  function menuFicha(id, x, y) {
    const o = TB.L.objeto(id);
    if (!o) return;
    const gm = TB.esGM();
    const sel = TB.L.seleccion().length ? TB.L.seleccion() : [id];
    const todos = sel.map(s => TB.L.objeto(s)).filter(Boolean);
    const p = { x: o.x, y: o.y };
    const iniciativa = async () => {
      const m = await pedir("Añadir turno", localStorage.getItem("tbModIni:" + id) || "0", { etiqueta: "Modificador de iniciativa (se tira 1d20 + esto en el servidor)" });
      if (m === null) return;
      try { localStorage.setItem("tbModIni:" + id, m); } catch (e) { /* nada */ }
      for (const s of sel) await TB.tirarIniciativa(s, parseInt(m, 10) || 0);
    };
    if (!gm) {
      const items = itemsComunes(p, false);
      if (o.tipo === "imagen" && TB.controla(o)) items.push({ icono: "turno", texto: "Añadir turno", accion: iniciativa }, { icono: "ajustes", texto: "Ajustes de ficha…", accion: () => ajustesFicha(id) });
      if ((o.tipo === "dibujo" || o.tipo === "texto") && o.autor === TB.yo.uid) items.push("-", { icono: "papeleraR", texto: "Borrar", peligro: true, accion: () => TB.borrarObjetos(sel) });
      menu(x, y, items);
      return;
    }
    const z = TB.L.objetos().map(q => q.z || 0);
    const cambiarTodos = f => TB.cambiarVarios(todos.map(q => ({ id: q.id, cambios: f(q) })));
    const datosCon = (q, extra) => ({ datos: Object.assign({}, q.datos, extra) });
    const algunoSinAjuste = todos.some(q => q.datos && q.datos.sinAjuste);
    const algunoSinMenu = todos.some(q => q.datos && q.datos.sinMenu);
    const deLuz = o.capa === "luz" ? [
      o.tipo === "dibujo" ? { icono: "luz", texto: "Tipo de línea", sub: [["muro", "Muro (tapa la vista y el paso)"], ["puerta", "Puerta"], ["ventana", "Ventana (deja ver, no pasar)"]].map(([v, t]) => ({ texto: ((o.datos || {}).muro || "muro") === v ? "✓ " + t : t, accion: () => cambiarTodos(q => datosCon(q, { muro: v, trazo: TBLuz.COLOR_MURO[v] })) })) } : null,
      o.tipo === "dibujo" && (o.datos || {}).muro === "puerta" ? { icono: "candado", texto: (o.datos || {}).abierta ? "Cerrar la puerta" : "Abrir la puerta", accion: () => cambiarTodos(q => datosCon(q, { abierta: !(o.datos || {}).abierta })) } : null,
      o.tipo === "dibujo" && (o.datos || {}).muro === "puerta" ? { icono: "candado", texto: (o.datos || {}).llave ? "Quitar la llave (los jugadores podrán abrirla)" : "Cerrar con llave (los jugadores no la abren)", accion: () => cambiarTodos(q => datosCon(q, { llave: !(o.datos || {}).llave })) } : null,
      o.tipo === "luz" ? { icono: "luz", texto: "Ajustes de luz…", accion: () => ajustesLuz(o.id) } : null,
      "-"
    ].filter(Boolean) : [];
    const items = itemsComunes(p, true).concat(deLuz, [
      { icono: "grupoDef", texto: "Definir grupo", accion: () => {
        try { localStorage.setItem(GRUPO_KEY, JSON.stringify({ filas: todos.map(q => Object.assign({}, q)) })); aviso(`Grupo definido con ${todos.length} objeto(s). Colócalo con clic derecho → Colocar grupo.`); } catch (e) { aviso("No se pudo guardar el grupo.", true); }
      } },
      { icono: "grupoPon", texto: "Colocar grupo", accion: () => colocarGrupo({ x: o.x + TB.L.tamCelda(), y: o.y }) },
      { icono: "ping", texto: "Colocar pin", accion: () => colocarPin(p) },
      { icono: "copiar", texto: "Copiar", accion: () => TB.copiar && TB.copiar(sel) },
      { icono: "pegar", texto: "Pegar", apagado: !(TB.portapapeles && TB.portapapeles().length), accion: () => pegarEn({ x: o.x + TB.L.tamCelda(), y: o.y + TB.L.tamCelda() }) },
      { icono: "deshacer", texto: "Deshacer", apagado: !TB.puedeDeshacer(), accion: () => TB.deshacer() },
      { icono: "rehacer", texto: "Rehacer", apagado: !TB.puedeRehacer(), accion: () => TB.rehacer() },
      "-",
      { icono: "turno", texto: "Añadir turno", accion: () => TB.anadirAlTurno(sel) },
      { icono: "capas", texto: "Cambiar capa", sub: CAPAS.map(c => ({ icono: c.icono, texto: (o.capa === c.id ? "✓ " : "") + c.nombre, accion: () => cambiarTodos(() => ({ capa: c.id })) })) },
      { icono: "frente", texto: "Traer al frente", accion: () => TB.cambiarVarios(todos.map((q, i) => ({ id: q.id, cambios: { z: Math.max(...z) + 1 + i } }))) },
      { icono: "fondo", texto: "Enviar al reverso", accion: () => TB.cambiarVarios(todos.map((q, i) => ({ id: q.id, cambios: { z: Math.min(...z) - todos.length + i } }))) },
      { icono: "candado", texto: o.bloqueado ? "Quitar la cerradura" : "Colocación de la cerradura", accion: () => cambiarTodos(() => ({ bloqueado: !o.bloqueado })) },
      { icono: "transformar", texto: "Transformación avanzada", sub: [
        { texto: "Agrupar", apagado: todos.length < 2, accion: () => { const g = "g" + Date.now().toString(36); cambiarTodos(q => datosCon(q, { grupo: g })); } },
        { texto: "Desagrupar", apagado: !todos.some(q => q.datos && q.datos.grupo), accion: () => cambiarTodos(q => datosCon(q, { grupo: null })) },
        { texto: algunoSinAjuste ? "Activar el ajuste de cuadrícula" : "Desactivar el ajuste de cuadrícula", accion: () => cambiarTodos(q => datosCon(q, { sinAjuste: !algunoSinAjuste })) },
        { texto: algunoSinMenu ? "Activar menús de fichas" : "Desactivar menús de fichas", accion: () => cambiarTodos(q => datosCon(q, { sinMenu: !algunoSinMenu })) },
        { texto: "Enumerar fichas", apagado: todos.length < 2, accion: () => {
          const orden = todos.slice().sort((a, b) => a.y - b.y || a.x - b.x);
          TB.cambiarVarios(orden.map((q, i) => ({ id: q.id, cambios: datosCon(q, { nombre: String((q.datos && q.datos.nombre) || "Ficha").replace(/\s+\d+$/, "") + " " + (i + 1), verNombre: true }) })));
        } },
        "-",
        { texto: "Giro horizontal", accion: () => cambiarTodos(q => datosCon(q, { voltearH: !(q.datos && q.datos.voltearH) })) },
        { texto: "Giro vertical", accion: () => cambiarTodos(q => datosCon(q, { voltearV: !(q.datos && q.datos.voltearV) })) },
        { texto: "Establecer dimensiones", accion: () => establecerDimensiones(todos) }
      ] },
      "-",
      { icono: "ajustes", texto: "Ajustes de ficha…", apagado: todos.length > 1 || o.tipo !== "imagen", accion: () => ajustesFicha(id) },
      { icono: "papeleraR", texto: "Borrar", peligro: true, accion: () => TB.borrarObjetos(sel) }
    ]);
    menu(x, y, items);
  }
  function establecerDimensiones(todos) {
    const t = TB.L.tamCelda(), o = todos[0];
    const c = el(`<div><div class="tb-fila"><label class="tb-campo" style="flex:1"><span>Ancho</span><input type="number" step="0.5" min="0.1" data-w></label>
      <label class="tb-campo" style="flex:1"><span>Alto</span><input type="number" step="0.5" min="0.1" data-h></label>
      <label class="tb-campo" style="flex:1"><span>Unidad</span><select data-u><option value="c">casillas</option><option value="px">píxeles</option></select></label></div></div>`);
    const w = c.querySelector("[data-w]"), h = c.querySelector("[data-h]"), u = c.querySelector("[data-u]");
    const pintar = () => { const k = u.value === "c" ? t : 1; w.value = Math.round(o.ancho / k * 100) / 100; h.value = Math.round(o.alto / k * 100) / 100; };
    pintar(); u.addEventListener("change", pintar);
    modal({ titulo: "Establecer dimensiones", cuerpo: c, ancho: 460, aceptar: "Aplicar", alAceptar: () => {
      const k = u.value === "c" ? t : 1;
      const ancho = Math.max(1, (parseFloat(w.value) || 1) * k), alto = Math.max(1, (parseFloat(h.value) || 1) * k);
      TB.cambiarVarios(todos.map(q => ({ id: q.id, cambios: { ancho, alto } })));
    } });
  }
  /* Pines del mapa: el DJ los edita; todos los abren (si llevan nota del diario, se abre la nota) */
  function abrirPin(id) {
    const o = TB.L.objeto(id);
    if (!o) return;
    const d = o.datos || {};
    if (!TB.esGM()) {
      if (d.nota && TB.diario.has(d.nota)) TBLado.abrirEntrada(d.nota);
      else if (d.titulo || d.texto) { const v = ventana("pin-" + id, { titulo: esc(d.titulo || "Pin"), ancho: 320, recordar: false, x: 260, y: 140 }); v.cuerpo.innerHTML = `<div style="padding:calc(14px * var(--tb-k));line-height:1.5">${esc(d.texto || "")}</div>`; }
      return;
    }
    const notas = [...TB.diario.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
    const c = el(`<div><label class="tb-campo"><span>Título</span><input type="text" data-t></label>
      <label class="tb-campo"><span>Texto (lo ven los jugadores al hacer clic)</span><textarea rows="4" data-x></textarea></label>
      <label class="tb-campo"><span>Abrir una entrada del diario</span><select data-n><option value="">Ninguna</option>${notas.map(n => `<option value="${n.id}">${esc(n.nombre)}</option>`).join("")}</select></label>
      <label class="tb-campo"><span>Color</span><input type="color" data-c></label></div>`);
    c.querySelector("[data-t]").value = d.titulo || ""; c.querySelector("[data-x]").value = d.texto || ""; c.querySelector("[data-n]").value = d.nota || ""; c.querySelector("[data-c]").value = d.color || "#d6127e";
    modal({ titulo: "Pin del mapa", cuerpo: c, ancho: 480, alAceptar: () => TB.cambiarObjeto(id, { datos: Object.assign({}, d, {
      titulo: c.querySelector("[data-t]").value.trim().slice(0, 60), texto: c.querySelector("[data-x]").value.slice(0, 2000), nota: c.querySelector("[data-n]").value || null, color: c.querySelector("[data-c]").value }) }) });
  }

  /* ============================================================ páginas (GM) */
  let filtroPaginas = "";
  function alternarPaginas() {
    const p = document.getElementById("tbPaginas");
    if (p.hidden) fotografiarPagina();
    p.hidden = !p.hidden;
    if (!p.hidden) pintarPaginas();
    marcarBarra();
  }
  function miniaturaDe(e) {
    if (e.miniatura) return e.miniatura;
    try { const m = localStorage.getItem("tbMini:" + e.id); if (m) return m; } catch (err) { /* nada */ }
    if (e.id === TB.escenaId) {
      const mapa = TB.L.objetos().filter(o => o.capa === "mapa" && o.tipo === "imagen" && o.datos && o.datos.src).sort((a, b) => b.ancho * b.alto - a.ancho * a.alto)[0];
      if (mapa) return mapa.datos.src;
    }
    return "";
  }
  // Foto pequeña de la página que se está viendo (mapa y fichas, sin niebla ni interfaz)
  function fotografiarPagina() {
    const e = TB.escena();
    if (!e || e.miniatura || !TB.L.miniatura) return;
    try { const url = TB.L.miniatura(320); if (url) localStorage.setItem("tbMini:" + e.id, url); } catch (err) { /* sin sitio o imagen de otro dominio */ }
  }
  function pintarPaginas() {
    const p = document.getElementById("tbPaginas");
    if (p.hidden) return;
    const actual = TB.escena() || {};
    const deJug = TB.escenas.get(TB.estado.escena_jugadores);
    const conectados = TB.presencia.filter(x => !x.gm);
    p.innerHTML = "";
    const mini = miniaturaDe(actual);
    const cab = el(`<div class="tb-paginas-cab">
      <div class="actual">${mini ? `<img src="${esc(mini)}" alt="">` : `<span class="mini"></span>`}<span>${esc(actual.nombre || "")}</span></div>
      <button type="button" class="tb-enlace" data-config style="font-size:calc(17px * var(--tb-k));font-weight:600">⚙ Configuración de página</button>
      <div class="tb-paginas-miembros" title="Arrastra el marcalibros a otra página para llevar allí a los jugadores">
        <span class="marca" draggable="true" data-marca></span>
        <span class="avs">${conectados.slice(0, 4).map(c => c.avatar ? `<span style="background-image:url('${esc(c.avatar)}')"></span>` : `<span style="background-color:${TB.colorJugador(c.uid)}">${esc((c.nombre || "?")[0].toUpperCase())}</span>`).join("")}${conectados.length > 4 ? `<span>+${conectados.length - 4}</span>` : ""}</span>
        <span><b>${esc(deJug ? deJug.nombre : "Ninguna")}</b><small>${conectados.length} ${conectados.length === 1 ? "miembro" : "miembros"}</small></span>
      </div>
      <button type="button" class="tb-flot-cerrar" data-cerrar style="font-size:calc(26px * var(--tb-k))">✕</button></div>`);
    cab.querySelector("[data-cerrar]").addEventListener("click", alternarPaginas);
    cab.querySelector("[data-config]").addEventListener("click", () => configPagina(TB.escenaId));
    cab.querySelector("[data-marca]").addEventListener("dragstart", ev => { ev.dataTransfer.setData("text/tablero-marca", "1"); ev.dataTransfer.effectAllowed = "move"; });
    const barra = el(`<div class="tb-paginas-barra">
      <button type="button" class="tb-btn tb-btn-borde" data-carpeta title="Nueva carpeta" style="width:calc(46px * var(--tb-k));height:calc(42px * var(--tb-k));padding:0">${I.carpeta}</button>
      <input type="search" placeholder="Buscar…" data-buscar style="min-height:calc(42px * var(--tb-k))">
      <button type="button" class="tb-btn tb-btn-acento" data-crear style="min-height:calc(42px * var(--tb-k));font-size:calc(16px * var(--tb-k));font-weight:600">＋ Crear página</button>
      <button type="button" class="tb-btn tb-btn-acento" data-crear-mas style="min-height:calc(42px * var(--tb-k));width:calc(40px * var(--tb-k));padding:0" title="Más opciones">▾</button></div>`);
    barra.querySelector("svg").style.cssText = "width:calc(22px * var(--tb-k));height:calc(22px * var(--tb-k))";
    const buscar = barra.querySelector("[data-buscar]");
    buscar.value = filtroPaginas;
    buscar.addEventListener("input", () => { filtroPaginas = buscar.value; pintarRejilla(); });
    barra.querySelector("[data-crear]").addEventListener("click", async () => { const e = await TB.crearEscena(); if (e) { await TB.verEscena(e.id); pintarPaginas(); } });
    barra.querySelector("[data-crear-mas]").addEventListener("click", ev => menu(ev.clientX - 200, ev.clientY + 16, [
      { texto: "Página vacía", accion: async () => { const e = await TB.crearEscena(); if (e) { await TB.verEscena(e.id); pintarPaginas(); } } },
      { texto: "Duplicar la página actual", accion: () => TB.duplicarEscena(TB.escenaId) }
    ]));
    barra.querySelector("[data-carpeta]").addEventListener("click", async () => {
      const n = await pedir("Nueva carpeta", "", { etiqueta: "Nombre de la carpeta" });
      if (!n) return;
      const e = await TB.crearEscena({ carpeta: n.trim().slice(0, 60) });
      if (e) pintarPaginas();
    });
    const rejilla = el(`<div class="tb-paginas-rejilla"></div>`);
    p.append(cab, barra, rejilla);
    function pintarRejilla() {
      rejilla.innerHTML = "";
      const f = filtroPaginas.trim().toLowerCase();
      const lista = [...TB.escenas.values()].filter(e => !e.archivada && (!f || e.nombre.toLowerCase().includes(f))).sort((a, b) => (a.orden || 0) - (b.orden || 0) || String(a.creada).localeCompare(String(b.creada)));
      const carpetas = [...new Set(lista.map(e => e.carpeta || ""))].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
      carpetas.forEach(c => {
        rejilla.appendChild(el(`<div class="tb-paginas-carpeta">${c ? "📁 " + esc(c) : "Todas las páginas"}</div>`));
        const tarjetas = el(`<div class="tb-paginas-tarjetas"></div>`);
        lista.filter(e => (e.carpeta || "") === c).forEach(e => {
          const m = miniaturaDe(e);
          const t = el(`<div class="tb-pag${e.id === TB.escenaId ? " viendo" : ""}" title="Ver esta página (tú). Arrastra el marcalibros aquí para llevar a los jugadores.">
            ${e.id === TB.estado.escena_jugadores ? `<span class="tb-pag-marca" draggable="true" title="Aquí están los jugadores: arrástralo a otra página"></span>` : ""}
            <div class="tb-pag-mini" style="${m ? `background-image:url('${esc(m)}')` : ""}">${m ? "" : "Sin miniatura"}</div>
            <div class="tb-pag-nombre">${esc(e.nombre)}</div>
            <div class="tb-pag-acciones"><button type="button" data-a="cfg" title="Configuración">⚙</button><button type="button" data-a="dup" title="Duplicar">⧉</button><button type="button" data-a="borrar" title="Borrar">🗑</button></div></div>`);
          const marca = t.querySelector(".tb-pag-marca");
          if (marca) marca.addEventListener("dragstart", ev => { ev.stopPropagation(); ev.dataTransfer.setData("text/tablero-marca", "1"); ev.dataTransfer.effectAllowed = "move"; });
          t.addEventListener("dragover", ev => { if ([...ev.dataTransfer.types].includes("text/tablero-marca")) { ev.preventDefault(); t.classList.add("soltando"); } });
          t.addEventListener("dragleave", () => t.classList.remove("soltando"));
          t.addEventListener("drop", async ev => {
            if (!ev.dataTransfer.getData("text/tablero-marca")) return;
            ev.preventDefault(); t.classList.remove("soltando");
            await TB.llevarJugadores(e.id);
            pintarPaginas();
          });
          t.addEventListener("click", async ev => {
            const a = ev.target.closest("[data-a]");
            if (a) {
              ev.stopPropagation();
              if (a.dataset.a === "cfg") configPagina(e.id);
              if (a.dataset.a === "dup") await TB.duplicarEscena(e.id);
              if (a.dataset.a === "borrar") await TB.borrarEscena(e.id);
              pintarPaginas();
              return;
            }
            if (ev.target.closest(".tb-pag-marca")) return;
            await TB.verEscena(e.id);
            alternarPaginas();
          });
          tarjetas.appendChild(t);
        });
        rejilla.appendChild(tarjetas);
      });
      const archivadas = [...TB.escenas.values()].filter(e => e.archivada);
      if (archivadas.length) {
        rejilla.appendChild(el(`<div class="tb-paginas-carpeta">🗄 Archivadas</div>`));
        const caja = el(`<div class="tb-paginas-tarjetas"></div>`);
        archivadas.forEach(e => {
          const t = el(`<div class="tb-pag" title="Desarchivar"><div class="tb-pag-mini" style="${e.miniatura ? `background-image:url('${esc(e.miniatura)}')` : ""};opacity:.5"></div><div class="tb-pag-nombre">${esc(e.nombre)}</div></div>`);
          t.addEventListener("click", async () => { await TB.guardarEscena(e.id, { archivada: false }); pintarPaginas(); });
          caja.appendChild(t);
        });
        rejilla.appendChild(caja);
      }
    }
    pintarRejilla();
  }

  /* Configuración de página: la ventana de Roll20 */
  function configPagina(id) {
    const e = TB.escenas.get(id);
    if (!e) return;
    const c = Object.assign({ tam: 70, visible: true, ajustar: true, color: "#c0c0c0", opacidad: 0.5, pies: 5, unidad: "pies", diagonal: "5e", preciso: true, dx: 0, dy: 0 }, e.cuadricula);
    const opc = Object.assign({ colorTablero: "#3d4048", audio: null }, e.opciones);
    const carpetas = [...new Set([...TB.escenas.values()].map(x => x.carpeta).filter(Boolean))];
    const pistas = (window.MUSICA || []).map(s => ({ src: s, nombre: decodeURIComponent(s.split("/").pop()).replace(/\.[^.]+$/, "") }));
    const mini = campoImagen(e.miniatura, f => TB.red.subirImagen(f), { texto: "Miniatura: suelta una imagen o haz clic (si no, se hace sola)" });
    if (ventanas.has("pagina-" + id)) ventanas.get("pagina-" + id).cerrar();
    const v = ventana("pagina-" + id, { titulo: "Configuración de página", ancho: 560, alto: Math.min(760, window.innerHeight - 60), x: 120, y: 20, recordar: false });
    v.cuerpo.innerHTML = "";
    const c1 = el(`<div class="tb-cfgpag">
      <h4 class="tb-cfgpag-tit">Detalles de página</h4>
      <div class="tb-fila"><label class="tb-campo" style="flex:1"><span>Nombre de la página</span><input type="text" data-nombre></label>
        <label class="tb-campo" style="flex:1"><span>Carpeta</span><input type="text" data-carpeta list="tbCarpetasPag" placeholder="Todas las páginas"><datalist id="tbCarpetasPag">${carpetas.map(x => `<option value="${esc(x)}">`).join("")}</datalist></label></div>
      <h4 class="tb-cfgpag-sec">Tamaño del lienzo</h4>
      <div class="tb-cfgpag-calc"><span class="tb-etq">Ancho</span><span class="tb-ud"><input type="number" min="1" max="500" data-ancho><i>celdas</i></span><b>×</b><span class="tb-ud gris"><input type="number" disabled data-pxa><i>px/celda</i></span><b>=</b><span class="tb-ud"><input type="number" data-anchopx><i>px</i></span></div>
      <div class="tb-cfgpag-calc"><span class="tb-etq">Alto</span><span class="tb-ud"><input type="number" min="1" max="500" data-alto><i>celdas</i></span><b>×</b><span class="tb-ud gris"><input type="number" disabled data-pxb><i>px/celda</i></span><b>=</b><span class="tb-ud"><input type="number" data-altopx><i>px</i></span></div>
      <div class="tb-cfgpag-calc"><span class="tb-etq">Tamaño de celda</span><span class="tb-ud gris"><input type="number" value="1" disabled><i>celdas</i></span><b>×</b><span class="tb-ud gris"><input type="number" value="70" disabled><i>px</i></span><b>=</b><span class="tb-ud"><input type="number" min="10" max="400" data-tam><i>px/celda</i></span></div>
      <p class="tb-nota">Los mapas que sueltas en la capa del mapa se encajan dentro de este lienzo.</p>
      <hr class="tb-sep"><h4 class="tb-cfgpag-sec">Fondo</h4>
      <div class="tb-fila-toggle" style="border:0"><span>Color del tablero (fuera de la página)</span><input type="color" data-tablero></div>
      <div class="tb-fila-toggle" style="border:0"><span>Color de fondo de la página</span><input type="color" data-fondo></div>
      <div class="tb-campo"><span>Miniatura</span><div data-mini style="max-width:calc(220px * var(--tb-k))"></div></div>
      <hr class="tb-sep"><h4 class="tb-cfgpag-sec">Escala</h4>
      <div class="tb-fila"><input type="number" min="0.1" step="0.5" data-pies style="width:calc(110px * var(--tb-k))"><select data-unidad style="width:calc(170px * var(--tb-k))"><option value="pies">Pies</option><option value="m">Metros</option><option value="casillas">Casillas</option><option value="millas">Millas</option><option value="km">Kilómetros</option></select></div>
      <hr class="tb-sep"><div class="tb-fila-toggle" style="border:0"><h4 class="tb-cfgpag-sec" style="margin:0">Cuadrícula</h4><span data-t-visible></span></div>
      <div class="tb-fila"><label class="tb-campo" style="flex:1"><span>Tipo de cuadrícula</span><select data-tipo><option value="cuadrada">Cuadrada</option></select></label>
        <label class="tb-campo" style="flex:1"><span>Medición diagonal</span><select data-diag><option value="5e">D&amp;D 5e / 4e</option><option value="pathfinder">Pathfinder / 3.5e</option><option value="euclidea">Euclídea</option><option value="manhattan">Manhattan</option></select></label></div>
      <div class="tb-fila-toggle" style="border:0"><span>Ajuste a las casillas (las fichas encajan al soltarlas)</span><span data-t-ajustar></span></div>
      <div class="tb-fila-toggle" style="border:0"><span>Ajustamiento preciso a las esquinas y al centro de las celdas</span><span data-t-preciso></span></div>
      <div class="tb-fila-toggle" style="border:0"><span>Desplazamiento de la cuadrícula</span><span class="tb-fila"><span class="tb-ud"><input type="number" data-dx style="width:calc(70px * var(--tb-k))"><i>px</i></span><span class="tb-ud"><input type="number" data-dy style="width:calc(70px * var(--tb-k))"><i>px</i></span></span></div>
      <div class="tb-fila-toggle" style="border:0"><span>Color de cuadrícula</span><input type="color" data-color></div>
      <label class="tb-campo"><span>Opacidad de la línea de la cuadrícula</span><span class="tb-fila"><input type="range" min="0" max="100" data-op><span class="tb-ud"><input type="number" min="0" max="100" data-opn style="width:calc(70px * var(--tb-k))"><i>%</i></span></span></label>
      <hr class="tb-sep"><h4 class="tb-cfgpag-sec">Gestionar audio</h4>
      <label class="tb-campo"><span>Reproducir en carga (empieza cuando el marcalibros llega a esta página)</span><select data-audio><option value="">Ninguno</option>${pistas.map(p => `<option value="${esc(p.src)}">${esc(p.nombre)}</option>`).join("")}</select></label>
      <hr class="tb-sep"><h4 class="tb-cfgpag-sec">Gestionar la zona</h4>
      <div class="tb-fila"><button type="button" class="tb-btn" data-archivar>🗄 ${e.archivada ? "Desarchivar página" : "Archivar página"}</button><button type="button" class="tb-btn tb-btn-rojo" data-borrar>🗑 Borrar página</button></div>
    </div>`);
    v.cuerpo.appendChild(c1);
    v.cuerpo.style.padding = "0";
    const q = s => c1.querySelector(s);
    q("[data-nombre]").value = e.nombre; q("[data-carpeta]").value = e.carpeta || "";
    q("[data-ancho]").value = e.ancho || 40; q("[data-alto]").value = e.alto || 40; q("[data-tam]").value = c.tam;
    const recalcular = origen => {
      const t = Math.max(10, parseInt(q("[data-tam]").value, 10) || 70);
      q("[data-pxa]").value = t; q("[data-pxb]").value = t;
      if (origen === "px") {
        q("[data-ancho]").value = Math.max(1, Math.round((parseInt(q("[data-anchopx]").value, 10) || t) / t));
        q("[data-alto]").value = Math.max(1, Math.round((parseInt(q("[data-altopx]").value, 10) || t) / t));
      }
      q("[data-anchopx]").value = (parseInt(q("[data-ancho]").value, 10) || 1) * t;
      q("[data-altopx]").value = (parseInt(q("[data-alto]").value, 10) || 1) * t;
    };
    ["[data-ancho]", "[data-alto]", "[data-tam]"].forEach(s => q(s).addEventListener("input", () => recalcular()));
    ["[data-anchopx]", "[data-altopx]"].forEach(s => q(s).addEventListener("change", () => recalcular("px")));
    recalcular();
    q("[data-tablero]").value = opc.colorTablero; q("[data-fondo]").value = e.fondo || "#ffffff";
    q("[data-mini]").appendChild(mini.el);
    q("[data-pies]").value = c.pies; q("[data-unidad]").value = c.unidad || "pies";
    const tVis = interruptor(c.visible !== false), tAj = interruptor(c.ajustar !== false), tPre = interruptor(c.preciso !== false);
    q("[data-t-visible]").append(tVis.el); q("[data-t-ajustar]").append(tAj.el); q("[data-t-preciso]").append(tPre.el);
    q("[data-diag]").value = c.diagonal || "5e"; q("[data-dx]").value = c.dx || 0; q("[data-dy]").value = c.dy || 0; q("[data-color]").value = c.color;
    q("[data-op]").value = Math.round(c.opacidad * 100); q("[data-opn]").value = Math.round(c.opacidad * 100);
    q("[data-op]").addEventListener("input", () => { q("[data-opn]").value = q("[data-op]").value; });
    q("[data-opn]").addEventListener("input", () => { q("[data-op]").value = q("[data-opn]").value; });
    q("[data-audio]").value = (opc.audio && opc.audio.src) || "";
    q("[data-archivar]").addEventListener("click", async () => { await TB.guardarEscena(id, { archivada: !e.archivada }); v.cerrar(); pintarPaginas(); });
    q("[data-borrar]").addEventListener("click", async () => { v.cerrar(); await TB.borrarEscena(id); pintarPaginas(); });
    const pie = el(`<div class="tb-cfgpag-pie"><button type="button" class="tb-enlace" data-cancelar style="font-size:calc(17px * var(--tb-k));font-weight:700">Cancelar</button><button type="button" class="tb-btn tb-btn-acento" data-guardar style="font-size:calc(17px * var(--tb-k));font-weight:700;min-height:calc(44px * var(--tb-k));padding:0 calc(22px * var(--tb-k))">Guardar ajustes</button></div>`);
    v.el.appendChild(pie);
    pie.querySelector("[data-cancelar]").addEventListener("click", () => v.cerrar());
    pie.querySelector("[data-guardar]").addEventListener("click", async () => {
      const audioSrc = q("[data-audio]").value;
      const pista = pistas.find(x => x.src === audioSrc);
      const miniatura = mini.valor();
      await TB.guardarEscena(id, {
        nombre: q("[data-nombre]").value.trim().slice(0, 80) || "Página", carpeta: q("[data-carpeta]").value.trim().slice(0, 60),
        ancho: Math.max(1, Math.min(500, parseInt(q("[data-ancho]").value, 10) || 40)), alto: Math.max(1, Math.min(500, parseInt(q("[data-alto]").value, 10) || 40)),
        fondo: q("[data-fondo]").value, miniatura,
        opciones: Object.assign({}, opc, { colorTablero: q("[data-tablero]").value, audio: pista ? { src: pista.src, nombre: pista.nombre } : null, miniaturaManual: !!miniatura && miniatura !== e.miniatura ? true : !!opc.miniaturaManual && !!miniatura }),
        cuadricula: { tam: Math.max(10, Math.min(400, parseInt(q("[data-tam]").value, 10) || 70)), pies: Math.max(0.1, parseFloat(q("[data-pies]").value) || 5), unidad: q("[data-unidad]").value,
          visible: tVis.valor(), ajustar: tAj.valor(), preciso: tPre.valor(), diagonal: q("[data-diag]").value,
          dx: parseInt(q("[data-dx]").value, 10) || 0, dy: parseInt(q("[data-dy]").value, 10) || 0,
          color: q("[data-color]").value, opacidad: (parseInt(q("[data-opn]").value, 10) || 0) / 100 }
      });
      v.cerrar();
      pintarPaginas();
    });
  }

  /* ============================================================ soltar sobre el tablero */
  function medirImagen(src) {
    return new Promise(res => {
      if (!src) { res(null); return; }
      const i = new Image();
      i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight });
      i.onerror = () => res(null);
      i.src = src;
    });
  }
  async function crearImagenEn(src, nombre, p, alt) {
    const t = TB.L.tamCelda();
    const m = await medirImagen(src) || { w: t, h: t };
    let ancho, alto, pos = p;
    if (TB.capa === "mapa" && !TB.prefs.mapaSinEncajar && !alt) {
      // Un mapa se encaja dentro del lienzo de la página (sin deformarlo) y se centra
      const pag = TB.L.pagina();
      const k = Math.min(pag.w / m.w, pag.h / m.h);
      ancho = Math.round(m.w * k); alto = Math.round(m.h * k);
      pos = { x: pag.w / 2, y: pag.h / 2 };
    } else if (alt || TB.capa === "mapa") { ancho = m.w; alto = m.h; }
    else { const k = t / Math.max(m.w, m.h); ancho = Math.max(10, Math.round(m.w * k)); alto = Math.max(10, Math.round(m.h * k)); }
    const fila = { tipo: "imagen", capa: TB.capa, ancho, alto, datos: { src, nombre: nombre || "" } };
    Object.assign(fila, TB.capa === "mapa" ? pos : TB.L.ajustarPos(fila, pos.x, pos.y, alt));
    return TB.crearObjetos([fila]);
  }
  async function soltarEnTablero(dt, p, alt) {
    if (!TB.esGM()) { aviso("Solo el DJ coloca cosas en el tablero."); return; }
    const uvtt = [...(dt.files || [])].find(f => /\.(dd2vtt|uvtt|df2vtt)$/i.test(f.name));
    if (uvtt) { importarUVTT(uvtt); return; }
    const archivos = [...(dt.files || [])].filter(f => /^image\//.test(f.type));
    if (archivos.length) {
      for (const f of archivos) {
        try {
          aviso("Subiendo " + f.name + "…");
          const listo = TB.prefs.webp !== false ? await aWebp(f) : f;
          const src = await TB.red.subirImagen(listo);
          const nombre = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
          TB.red.crearArte({ src, nombre }).then(a => { if (TB.arte) { TB.arte.unshift(a); TB.lanzar("arte"); } }).catch(() => {});
          await crearImagenEn(src, nombre, p, alt);
          p = { x: p.x + TB.L.tamCelda(), y: p.y };
        } catch (e) { aviso(mensajeError(e), true); }
      }
      return;
    }
    const diario = dt.getData("text/tablero-diario");
    if (diario) {
      const e = TB.diario.get(diario);
      if (!e) return;
      const t = TB.L.tamCelda();
      const base = e.token || { ancho: t, alto: t, datos: { src: e.imagen } };
      const datos = Object.assign({ src: e.imagen, nombre: e.nombre }, base.datos, { representa: e.id });
      if (!datos.nombre) datos.nombre = e.nombre;
      const fila = { tipo: "imagen", capa: TB.capa, ancho: base.ancho || t, alto: base.alto || t, datos, controladores: (e.controladores || []).slice() };
      Object.assign(fila, TB.L.ajustarPos(fila, p.x, p.y, alt));
      TB.crearObjetos([fila]);
      return;
    }
    const src = dt.getData("text/tablero-src") || (dt.getData("text/uri-list") || "").split("\n")[0].trim();
    if (src && /^(https?:|data:image\/|assets\/)/i.test(src)) crearImagenEn(src, dt.getData("text/tablero-nombre"), p, alt);
  }
  /* Optimizar al subir: las imágenes de menos de 16 megapíxeles se pasan a WebP (pesan menos y cargan antes) */
  function aWebp(f) {
    return new Promise(res => {
      if (f.type === "image/webp" || f.type === "image/gif") { res(f); return; }
      const url = URL.createObjectURL(f), img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        if (img.naturalWidth * img.naturalHeight > 16e6) { res(f); return; }
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext("2d").drawImage(img, 0, 0);
        c.toBlob(b => res(b && b.size < f.size ? new File([b], f.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" }) : f), "image/webp", 0.9);
      };
      img.onerror = () => { URL.revokeObjectURL(url); res(f); };
      img.src = url;
    });
  }

  /* ============================================================ arranque */
  function iniciar(tb) {
    TB = tb;
    construirBarra();
    construirZoom();
    TBLado.iniciar(TB);
    TB.on("estado", s => {
      const vis = s && s.iniciativa && s.iniciativa.visible;
      if (vis && !ventanas.has("turno")) abrirTurno();
      else if (!vis && ventanas.has("turno") && !TB.esGM()) ventanas.get("turno").cerrar();
      pintarTurno();
      pintarPaginas();
    });
    TB.on("escenas", pintarPaginas);
    TB.on("antesDeEscena", fotografiarPagina);
    TB.on("escena", () => { pintarPaginas(); if (flotanteAbierto === "niebla") { flotanteAbierto = null; abrirFlotante("niebla", document.querySelector('[data-b="niebla"]')); } });
    TB.on("presencia", pintarPaginas);
    setHerramienta("seleccionar");
    setCapa("fichas");
  }

  window.TBPaneles = { iniciar, ajustesLuz, ajustesFicha, menuFicha, menuVacio, abrirPin, soltarEnTablero, elegirDibujo, setHerramienta, setCapa, alternarPaginas, alternarTurno, configPagina, medirImagen };
})();
