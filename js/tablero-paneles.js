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
    { id: "delantero", nombre: "Delantero", icono: "capaDelantero" }
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
      gm ? btn("luz", "luz", "Iluminación dinámica", "deshabilitado") : "",
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
    op.append(s, el(`<span class="tb-nota" style="max-width:180px">Relleno: clic derecho para dejarlo vacío</span>`));
    op.hidden = false;
  }
  function pintarOpcionesTexto() {
    const op = document.getElementById("tbOpciones"), t = TB.prefs.texto;
    op.innerHTML = "";
    const guardar = () => { TB.guardarPrefs(); TB.aplicarOpcionesLienzo(); };
    op.append(selectorColor(t.color, false, v => { t.color = v; guardar(); }), selectorColor(t.fondo, true, v => { t.fondo = v; guardar(); }), el(`<span class="tb-sep-v"></span>`));
    const fuente = el(`<select>${FUENTES.map(x => `<option>${x}</option>`).join("")}</select>`);
    fuente.value = t.fuente; fuente.addEventListener("change", () => { t.fuente = fuente.value; guardar(); });
    const tam = el(`<select style="min-width:70px">${[10, 14, 18, 22, 26, 32, 40, 56, 72, 100].map(x => `<option>${x}</option>`).join("")}</select>`);
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
      <div class="tb-fila" style="gap:12px">
        <label class="tb-campo" style="flex:1"><span style="font-weight:600">Forma</span><select data-forma>
          <option value="linea">Línea</option><option value="cuadrado">Cuadrado</option><option value="circulo">Círculo</option><option value="cono">Cono</option><option value="haz">Haz</option></select></label>
        <label class="tb-campo" style="flex:1.4"><span style="font-weight:600">Ajuste de cuadrícula</span><select data-ajuste>
          <option value="centro">Ajustar al centro</option><option value="esquina">Ajustar a las esquinas</option><option value="ninguno">Sin ajuste</option></select></label>
      </div>
      <p class="tb-flot-titulo-sec">Retardo de desvanecimiento</p>
      <div class="tb-segmento" data-persistente><button type="button" data-v="0">Instantáneo</button><button type="button" data-v="1">Persistente</button></div>
      <div class="tb-fila-toggle" style="margin-top:12px"><span>Mide siempre el movimiento de las fichas.</span><span data-t1></span></div>
      <div class="tb-fila-toggle"><span>Transmitir a otros</span><span data-t2></span></div>
    </div>`);
    const forma = c.querySelector("[data-forma]"), ajuste = c.querySelector("[data-ajuste]");
    forma.value = m.forma; ajuste.value = m.ajuste;
    forma.addEventListener("change", () => { m.forma = forma.value; guardar(); });
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

  /* --- Lanzador de dados --- */
  const historialDados = [];
  function flotDados(f) {
    const d = TB.prefs.dados;
    const cab = el(`<div class="tb-flot-cab"><h3>Lanzador de Dados</h3><button type="button" class="tb-flot-cerrar">✕</button></div>`);
    cab.querySelector("button").addEventListener("click", cerrarFlotante);
    f.appendChild(cab);
    const modos = el(`<div style="padding:10px 12px 0"><div class="tb-segmento" style="width:100%;display:grid;grid-template-columns:1fr 1fr 1fr">
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
            <select data-dado style="width:110px">${DADOS.map(([n, c]) => `<option value="${c}"${c === 20 ? " selected" : ""}>${n.toUpperCase()}</option>`).join("")}</select>
            <span>+</span>
            <span class="tb-giro"><input type="number" data-mod value="0"><span><button type="button" data-g="mod" data-d="1">▲</button><button type="button" data-g="mod" data-d="-1">▼</button></span></span>
          </div>
          <div class="tb-fila" style="margin:12px 0"><span data-obj></span><span>¿Número objetivo?</span><input type="number" data-objetivo value="10" style="width:80px" hidden></div>
          <button type="button" class="tb-btn tb-btn-acento" data-tirar style="width:100%;max-width:270px">Tirada</button>
          <hr class="tb-sep">
          <p class="tb-flot-titulo-sec">Últimas 10 tiradas</p>
          <table class="tb-historial"><thead><tr><th>Fórmula</th><th>Repetición de tirada</th></tr></thead><tbody>${historialDados.length ? historialDados.map((h, i) => `<tr><td>${esc(h)}</td><td><button type="button" class="tb-btn tb-btn-mini" data-rep="${i}">Repetir</button></td></tr>`).join("") : `<tr><td colspan="2" class="tb-nota" style="text-align:center">Sin datos</td></tr>`}</tbody></table>
          <p class="tb-nota" style="margin-top:12px">En el chat también puedes escribir <b>/r 2d20kh1+5</b> (ventaja), <b>/gr 1d20</b> (solo al DJ) o tiradas en línea como <b>[[1d8+3]]</b>.</p>
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
    const pie = el(`<div class="tb-flot-pie"><button type="button" class="tb-enlace" data-cambiar style="font-size:17px"></button>
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
      cuerpo.innerHTML = `<p style="text-align:center;font-weight:600;font-size:16px;margin:0 0 6px">¡Esconde algunas cosas!</p>
        <p style="text-align:center;margin:0 0 14px;line-height:1.45">Puedes usar esta herramienta para ocultar a los jugadores el mapa entero o partes de él. Las zonas reveladas se dibujan sobre la marcha.</p>
        <button type="button" class="tb-btn tb-btn-borde" data-todo style="width:100%;min-height:44px;font-size:16px">Ocultar página completa</button>
        <p style="text-align:center;margin:14px 0 0"><button type="button" class="tb-enlace" data-manual style="font-size:16px;font-weight:600">Dibujar manualmente la máscara</button></p>`;
      cuerpo.querySelector("[data-todo]").addEventListener("click", () => { nb.modo = "revelar"; TB.guardarPrefs(); TB.aplicarOpcionesLienzo(); guardarNiebla({ activa: true, base: "oculta", zonas: [] }); });
      cuerpo.querySelector("[data-manual]").addEventListener("click", () => { nb.modo = "ocultar"; TB.guardarPrefs(); TB.aplicarOpcionesLienzo(); guardarNiebla({ activa: true, base: "visible", zonas: [] }); });
      return;
    }
    cuerpo.innerHTML = `<p class="tb-flot-titulo-sec">Al dibujar sobre el tablero</p>
      <div class="tb-segmento" data-modo><button type="button" data-v="revelar">Revelar</button><button type="button" data-v="ocultar">Ocultar</button></div>
      <p class="tb-flot-titulo-sec" style="margin-top:12px">Forma</p>
      <div class="tb-segmento" data-forma><button type="button" data-v="rect">Rectángulo</button><button type="button" data-v="poligono">Polígono</button></div>
      <p class="tb-nota">En polígono, cada clic añade un punto. Doble clic o Intro para cerrarlo.</p>
      <div class="tb-fila" style="flex-wrap:wrap;margin-top:12px">
        <button type="button" class="tb-btn" data-deshacer>Deshacer la última zona</button>
        <button type="button" class="tb-btn" data-ocultar>Ocultar todo</button>
        <button type="button" class="tb-btn tb-btn-borde" data-quitar>Quitar la máscara</button>
      </div>
      <p class="tb-nota" style="margin-top:10px">Tú la ves semitransparente. Los jugadores la ven negra.</p>`;
    const pinta = (sel, val) => cuerpo.querySelectorAll(sel + " button").forEach(b => b.classList.toggle("activo", b.dataset.v === val));
    pinta("[data-modo]", nb.modo); pinta("[data-forma]", nb.forma);
    cuerpo.querySelector("[data-modo]").addEventListener("click", ev => { const b = ev.target.closest("button"); if (!b) return; nb.modo = b.dataset.v; TB.guardarPrefs(); TB.aplicarOpcionesLienzo(); pinta("[data-modo]", nb.modo); setHerramienta("niebla"); });
    cuerpo.querySelector("[data-forma]").addEventListener("click", ev => { const b = ev.target.closest("button"); if (!b) return; nb.forma = b.dataset.v; TB.guardarPrefs(); TB.aplicarOpcionesLienzo(); pinta("[data-forma]", nb.forma); setHerramienta("niebla"); });
    cuerpo.querySelector("[data-deshacer]").addEventListener("click", () => guardarNiebla(Object.assign({}, n, { zonas: (n.zonas || []).slice(0, -1) })));
    cuerpo.querySelector("[data-ocultar]").addEventListener("click", () => guardarNiebla({ activa: true, base: "oculta", zonas: [] }));
    cuerpo.querySelector("[data-quitar]").addEventListener("click", () => guardarNiebla({ activa: false, zonas: [] }));
  }

  function flotLuz(f) {
    f.appendChild(cabFlot("✦ Iluminación Dinámica"));
    f.appendChild(el(`<div class="tb-flot-cuerpo"><p style="line-height:1.5;margin-top:0">La iluminación dinámica (muros, luces y lo que ve cada personaje) todavía no está en este tablero.</p>
      <p style="line-height:1.5">Mientras tanto, usa <b>Ocultar/Revelar máscara</b> para tapar lo que los jugadores no deben ver.</p></div>`));
  }

  function flotFx(f) {
    f.appendChild(cabFlot("Efectos", true));
    const fx = TB.prefs.fx;
    const c = el(`<div class="tb-flot-cuerpo">
      <label class="tb-campo"><span style="font-weight:600">Tipo de efecto:</span><select data-tipo>${TBFx.TIPOS.map(t => `<option value="${t.id}">${t.nombre} · ${t.modo === "apuntar" ? "Apuntar" : t.modo === "clic" ? "Haz clic" : "Espera"}</option>`).join("")}</select></label>
      <p class="tb-nota" data-ayuda></p>
      <div class="tb-colores-fx">${TBFx.COLORES.map(x => `<button type="button" data-c="${x.id}"><i style="background:${x.muestra}"></i>${x.nombre}</button>`).join("")}</div>
    </div>`);
    const tipo = c.querySelector("[data-tipo]"), ayuda = c.querySelector("[data-ayuda]");
    const pintar = () => {
      tipo.value = fx.tipo;
      const t = TBFx.TIPOS.find(x => x.id === fx.tipo) || TBFx.TIPOS[0];
      ayuda.textContent = t.modo === "apuntar" ? "Arrastra desde el origen hasta el objetivo." : "Haz clic en el tablero donde quieras el efecto.";
      c.querySelectorAll("[data-c]").forEach(b => b.classList.toggle("activo", b.dataset.c === fx.color));
    };
    tipo.addEventListener("change", () => { fx.tipo = tipo.value; TB.guardarPrefs(); pintar(); setHerramienta("fx"); });
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
    f.appendChild(el(`<div class="tb-menu-sep"></div>`));
    f.appendChild(el(`<div class="tb-menu-item" style="opacity:.45;cursor:default">${I.luz}Luz (próximamente)</div>`));
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
  function alternarTurno() {
    if (ventanas.has("turno")) {
      if (TB.esGM()) TB.guardarIniciativa(Object.assign({}, TB.estado.iniciativa, { visible: false }));
      ventanas.get("turno").cerrar();
      return;
    }
    if (TB.esGM()) TB.guardarIniciativa(Object.assign({ lista: [], turno: 0, ronda: 1 }, TB.estado.iniciativa, { visible: true }));
    else if (!(TB.estado.iniciativa || {}).visible) { aviso("El DJ no ha abierto el orden de turno."); return; }
    abrirTurno();
  }
  let ordenDesc = true;
  function abrirTurno() {
    const v = ventana("turno", {
      titulo: "Orden de turno", x: window.innerWidth - (parseInt(getComputedStyle(document.documentElement).getPropertyValue("--tb-lado"), 10) || 410) - 300, y: 150, ancho: 250, alto: 470,
      alCerrar: () => { marcarBarra(); if (TB.esGM() && (TB.estado.iniciativa || {}).visible) TB.guardarIniciativa(Object.assign({}, TB.estado.iniciativa, { visible: false })); }
    });
    v.cuerpo.style.display = "flex"; v.cuerpo.style.flexDirection = "column"; v.cuerpo.style.overflow = "hidden";
    pintarTurno();
    marcarBarra();
  }
  function pintarTurno() {
    const v = ventanas.get("turno");
    if (!v) return;
    const ini = Object.assign({ lista: [], turno: 0, ronda: 1 }, TB.estado.iniciativa);
    const gm = TB.esGM();
    const lista = ini.lista || [];
    const actual = lista[Math.min(ini.turno | 0, Math.max(lista.length - 1, 0))];
    v.cuerpo.innerHTML = "";
    const cab = el(`<div class="tb-turno-cab"><span>Contar: <span data-ronda style="${gm ? "cursor:pointer;text-decoration:underline dotted" : ""}">${ini.ronda || 1}</span></span>${gm ? `<button type="button" data-ordenar title="Ordenar">${I.ordenar}</button>` : ""}</div>`);
    const filas = el(`<div class="tb-turno-lista" style="flex:1"></div>`);
    lista.forEach((e, i) => {
      if (e.oculto && !gm) return;
      const o = TB.L.objeto(e.id);
      const src = (o && o.datos && o.datos.src) || e.src || "";
      const nombre = (o && o.datos && o.datos.nombre) || e.nombre || "";
      const verNombre = gm || (o && o.datos && o.datos.verNombre) || (o && TB.controla(o)) || !o;
      const f = el(`<div class="tb-turno-fila${e === actual ? " actual" : ""}${e.oculto ? " oculta" : ""}" draggable="${gm}" data-i="${i}">
        <span class="tb-turno-av" style="${src ? `background-image:url('${esc(src)}')` : ""}"></span>
        <span class="tb-turno-nombre">${verNombre ? esc(nombre) : ""}</span>
        <span class="tb-turno-valor" data-valor>${esc(e.valor)}</span></div>`);
      f.addEventListener("click", ev => {
        if (ev.target.closest("[data-valor]") && gm) { editarValor(f, i); return; }
        if (o) { TB.L.centrarEn(o.x, o.y); if (gm || TB.controla(o)) TB.L.seleccionar([o.id]); }
      });
      if (gm) {
        f.addEventListener("contextmenu", ev => { ev.preventDefault(); menu(ev.clientX, ev.clientY, [
          { texto: "Quitar del orden", accion: () => { const l = lista.slice(); l.splice(i, 1); TB.guardarIniciativa(Object.assign({}, ini, { lista: l, turno: Math.min(ini.turno, Math.max(l.length - 1, 0)) })); } },
          { texto: "Hacer que sea su turno", accion: () => TB.guardarIniciativa(Object.assign({}, ini, { turno: i })) }
        ]); });
        f.addEventListener("dragstart", ev => { ev.dataTransfer.setData("text/turno", String(i)); f.classList.add("arrastrando"); });
        f.addEventListener("dragend", () => f.classList.remove("arrastrando"));
        f.addEventListener("dragover", ev => ev.preventDefault());
        f.addEventListener("drop", ev => {
          ev.preventDefault();
          const de = parseInt(ev.dataTransfer.getData("text/turno"), 10);
          if (isNaN(de) || de === i) return;
          const l = lista.slice(); const [x] = l.splice(de, 1); l.splice(i, 0, x);
          TB.guardarIniciativa(Object.assign({}, ini, { lista: l, turno: l.indexOf(actual) }));
        });
      }
      filas.appendChild(f);
    });
    if (!filas.children.length) filas.appendChild(el(`<p class="tb-nota" style="padding:14px">${gm ? "Clic derecho en una ficha → Añadir al orden de turno, o que los jugadores tiren su iniciativa." : "Selecciona tu ficha y tira tu iniciativa desde su menú (clic derecho)."}</p>`));
    const esMio = actual && TB.controla(TB.L.objeto(actual.id));
    const pie = el(`<div class="tb-turno-pie">
      <button type="button" class="tb-btn tb-btn-borde" data-atras ${gm ? "" : "disabled"}>${I.izquierda}</button>
      ${gm ? `<button type="button" class="tb-btn" data-cfg style="min-width:40px;border:0;background:none">${I.engranaje}</button>` : ""}
      <button type="button" class="tb-btn tb-btn-acento" data-adelante ${gm || esMio ? "" : "disabled"}>${I.derecha}</button></div>`);
    pie.querySelectorAll("svg").forEach(s => { s.style.width = "20px"; s.style.height = "20px"; });
    pie.querySelector("[data-atras]").addEventListener("click", () => TB.pasarTurno(-1));
    pie.querySelector("[data-adelante]").addEventListener("click", () => TB.pasarTurno(1));
    if (gm) {
      cab.querySelector("[data-ordenar]").addEventListener("click", () => {
        const l = lista.slice().sort((a, b) => ordenDesc ? b.valor - a.valor : a.valor - b.valor);
        ordenDesc = !ordenDesc;
        TB.guardarIniciativa(Object.assign({}, ini, { lista: l, turno: actual ? Math.max(0, l.indexOf(actual)) : 0 }));
      });
      cab.querySelector("[data-ronda]").addEventListener("click", async () => {
        const v2 = await pedir("Contador de rondas", String(ini.ronda || 1), { etiqueta: "Ronda" });
        if (v2 !== null && !isNaN(parseInt(v2, 10))) TB.guardarIniciativa(Object.assign({}, ini, { ronda: Math.max(1, parseInt(v2, 10)) }));
      });
      pie.querySelector("[data-cfg]").addEventListener("click", ev => menu(ev.clientX, ev.clientY - 160, [
        { texto: "Añadir elemento personalizado", accion: async () => {
          const n = await pedir("Elemento personalizado", "", { etiqueta: "Nombre (por ejemplo, Trampa o Fin del hechizo)" });
          if (!n) return;
          TB.guardarIniciativa(Object.assign({}, ini, { lista: lista.concat([{ id: "x" + Date.now(), nombre: n, valor: 0 }]) }));
        } },
        { texto: "Añadir las fichas seleccionadas", accion: () => TB.anadirAlTurno(TB.L.seleccion()) },
        { texto: "Volver a la ronda 1", accion: () => TB.guardarIniciativa(Object.assign({}, ini, { ronda: 1, turno: 0 })) },
        "-",
        { texto: "Vaciar la lista", peligro: true, accion: () => TB.guardarIniciativa(Object.assign({}, ini, { lista: [], turno: 0, ronda: 1 })) }
      ]));
    }
    v.cuerpo.append(cab, filas, pie);
  }
  function editarValor(fila, i) {
    const ini = TB.estado.iniciativa;
    const celda = fila.querySelector("[data-valor]");
    const inp = el(`<input type="number" value="${esc(ini.lista[i].valor)}">`);
    celda.innerHTML = ""; celda.appendChild(inp); inp.focus(); inp.select();
    const guardar = () => {
      const l = ini.lista.slice(); l[i] = Object.assign({}, l[i], { valor: parseFloat(inp.value) || 0 });
      TB.guardarIniciativa(Object.assign({}, ini, { lista: l }));
    };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") inp.blur(); if (e.key === "Escape") { inp.value = ini.lista[i].valor; inp.blur(); } });
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
      <div class="tb-fila" style="justify-content:space-between"><h3 style="margin:4px 0 14px;font-size:19px">General</h3></div>
      ${gm ? `<label class="tb-campo"><span>Representa a un personaje</span><select data-rep><option value="">Ninguno / Ficha genérica</option>${personajes.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join("")}</select></label>` : ""}
      <label class="tb-campo"><span>Nombre</span><span class="tb-fila"><input type="text" data-nombre ${gm ? "" : "disabled"}><label class="tb-casilla tb-btn" style="white-space:nowrap"><input type="checkbox" data-vernombre ${gm ? "" : "disabled"}> Nombre</label></span></label>
      ${gm ? `<div class="tb-campo"><span>Controlado por</span><div data-control></div><span class="tb-nota" data-control-nota hidden>(Determinado por los ajustes de personaje)</span></div>
        <div class="tb-fila" style="flex-wrap:wrap;margin-bottom:12px">${plantilla ? "" : `<button type="button" class="tb-btn tb-btn-azul" data-predet>Actualizar ficha predeterminada</button>`}<button type="button" class="tb-btn tb-btn-azul" data-hoja>Abrir hoja de personaje</button></div>
        <div class="tb-campo"><span>Color de tinte</span><span class="tb-fila"><input type="color" data-tinte><label class="tb-casilla"><input type="checkbox" data-sintinte> Sin tinte</label></span></div>` : ""}
    </div>`);
    const derecha = el(`<div><h3 style="margin:4px 0 14px;font-size:19px">Barras De Ficha</h3></div>`);
    barras.forEach((b, i) => {
      const puede = gm || b.editar;
      const fila = el(`<div class="tb-barra-cfg">
        <span class="tb-bola" style="background:${["#5cb85c", "#4f8fd6", "#d9534f"][i]}"></span><input type="number" data-v ${puede ? "" : "disabled"}>
        <span>/</span><input type="number" data-m ${puede ? "" : "disabled"}>
        <select disabled title="Pronto podrá enlazarse a un atributo de la ficha"><option>Ninguno</option></select>
        ${gm ? `<span style="position:relative"><button type="button" class="tb-kebab" data-k>⋮</button>
          <div class="tb-kebab-menu" hidden><b style="display:block;margin-bottom:6px">Permisos de jugadores</b>
            <label><input type="checkbox" data-ver> Ver</label><label><input type="checkbox" data-editar> Editar</label>
            <span style="display:block;margin:8px 0 4px">Texto superpuesto:</span>
            <select data-texto><option value="oculto">Oculto</option><option value="editores">Visible para los editores</option><option value="todos">Visible para todos</option></select></div></span>` : "<span></span>"}
      </div>`);
      fila.querySelector("[data-v]").value = b.valor; fila.querySelector("[data-m]").value = b.max;
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
      derecha.appendChild(el(`<div class="tb-campo" style="margin-top:14px"><span>Opacidad Base</span><input type="range" min="0" max="100" data-opac><span class="tb-nota" data-opac-txt></span></div>`));
    }
    det.appendChild(el(`<div class="tb-dos-col"></div>`));
    det.firstChild.append(general, derecha);
    if (gm) {
      det.appendChild(el(`<hr class="tb-sep">`));
      det.appendChild(el(`<div class="tb-dos-col"><div><h3 style="font-size:19px;margin:6px 0 12px">Opciones De Barra De Ficha</h3>
        <label class="tb-campo"><span>Posición</span><select data-bpos><option value="encima">Encima</option><option value="debajo">Debajo</option></select></label></div>
        <div><h3 style="font-size:19px;margin:6px 0 12px">&nbsp;</h3><div class="tb-campo"><span>Estilo</span><span class="tb-fila"><label class="tb-casilla"><input type="radio" name="bestilo" value="estandar"> Estándar</label><label class="tb-casilla"><input type="radio" name="bestilo" value="compacto"> Compacto</label></span></div></div></div>`));
      det.appendChild(el(`<hr class="tb-sep">`));
      const aurasEl = el(`<div><h3 style="font-size:19px;margin:6px 0 12px">Aura De Ficha</h3><div class="tb-aura-cfg"></div></div>`);
      auras.forEach((a, i) => {
        const caja = el(`<div data-aura="${i}"><b style="display:block;margin-bottom:8px">Aura ${i + 1}</b>
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
        if (gm) { b.ver = f.querySelector("[data-ver]").checked; b.editar = f.querySelector("[data-editar]").checked; b.texto = f.querySelector("[data-texto]").value; }
        return b;
      });
      if (gm) {
        nd.representa = q("[data-rep]").value || null;
        nd.tinte = q("[data-sintinte]").checked ? null : q("[data-tinte]").value;
        nd.barraPos = q("[data-bpos]").value;
        nd.barraEstilo = cuerpo.querySelector("input[name=bestilo]:checked").value;
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
        if (plantilla) { await TB.red.actualizarDiario(plantilla.diario, { token: { ancho: o.ancho, alto: o.alto, datos: nd } }); return; }
        if (!gm) {
          // El jugador solo cambia las barras que el DJ le deja editar
          for (let i = 0; i < 3; i++) {
            const b = nd.barras[i], antes = barras[i];
            if (b.editar && (b.valor !== antes.valor || b.max !== antes.max)) await TB.red.barra(o.id, i + 1, Number(b.valor) || 0, Number(b.max) || 0);
          }
          return;
        }
        const cambios = { datos: nd, opacidad: Number(q("[data-opac]").value) / 100 };
        const p = nd.representa && TB.diario.get(nd.representa);
        if (p) { cambios.controladores = (p.controladores || []).slice(); cambios.controlan_todos = false; }
        else { const v = controlSel.valor(); cambios.controlan_todos = v.includes("*"); cambios.controladores = v.filter(x => x !== "*"); }
        await TB.cambiarObjeto(o.id, cambios);
        const tn = q("[data-notas]");
        if (tn && notaGM !== null && tn.value !== notaGM) await TB.red.guardarNotaGM(o.id, tn.value);
      }
    });
  }

  /* ============================================================ menú de una ficha */
  function menuFicha(id, x, y) {
    const o = TB.L.objeto(id);
    if (!o) return;
    const gm = TB.esGM();
    const sel = TB.L.seleccion().length ? TB.L.seleccion() : [id];
    const varias = sel.length > 1;
    const todos = sel.map(s => TB.L.objeto(s)).filter(Boolean);
    const items = [];
    const iniciativa = { texto: "Tirar iniciativa…", accion: async () => {
      const m = await pedir("Tirar iniciativa", localStorage.getItem("tbModIni:" + id) || "0", { etiqueta: "Modificador de iniciativa (se tira 1d20 + esto)" });
      if (m === null) return;
      try { localStorage.setItem("tbModIni:" + id, m); } catch (e) { /* nada */ }
      for (const s of sel) await TB.tirarIniciativa(s, parseInt(m, 10) || 0);
    } };
    if (!gm) {
      if (o.tipo === "imagen") items.push({ texto: "Ajustes de ficha…", accion: () => ajustesFicha(id) }, iniciativa);
      if ((o.tipo === "dibujo" || o.tipo === "texto") && o.autor === TB.yo.uid) items.push({ texto: "Eliminar", peligro: true, accion: () => TB.borrarObjetos(sel) });
      if (!items.length) return;
      menu(x, y, items);
      return;
    }
    const z = TB.L.objetos().map(q => q.z || 0);
    if (!varias) items.push({ texto: "Ajustes de ficha…", accion: () => ajustesFicha(id) });
    items.push({ texto: "Añadir al orden de turno", accion: () => TB.anadirAlTurno(sel) }, iniciativa, "-");
    items.push({ texto: "Al frente", accion: () => TB.cambiarVarios(todos.map((q, i) => ({ id: q.id, cambios: { z: Math.max(...z) + 1 + i } }))) });
    items.push({ texto: "Al fondo", accion: () => TB.cambiarVarios(todos.map((q, i) => ({ id: q.id, cambios: { z: Math.min(...z) - todos.length + i } }))) });
    items.push("-", { cab: "Capa" });
    CAPAS.forEach(c => items.push({ texto: (o.capa === c.id ? "✓ " : "　") + c.nombre, accion: () => TB.cambiarVarios(todos.map(q => ({ id: q.id, cambios: { capa: c.id } }))) }));
    items.push("-");
    items.push({ texto: o.bloqueado ? "Desbloquear posición" : "Bloquear posición", accion: () => TB.cambiarVarios(todos.map(q => ({ id: q.id, cambios: { bloqueado: !o.bloqueado } }))) });
    if (o.tipo === "imagen") {
      items.push({ texto: (o.datos && o.datos.verNombre) ? "Ocultar el nombre" : "Mostrar el nombre", accion: () => TB.cambiarVarios(todos.map(q => ({ id: q.id, cambios: { datos: Object.assign({}, q.datos, { verNombre: !(o.datos && o.datos.verNombre) }) } }))) });
      items.push({ texto: "Voltear horizontal", accion: () => TB.cambiarVarios(todos.map(q => ({ id: q.id, cambios: { datos: Object.assign({}, q.datos, { voltearH: !(q.datos && q.datos.voltearH) }) } }))) });
      items.push({ texto: "Voltear vertical", accion: () => TB.cambiarVarios(todos.map(q => ({ id: q.id, cambios: { datos: Object.assign({}, q.datos, { voltearV: !(q.datos && q.datos.voltearV) }) } }))) });
      const t = TB.L.tamCelda();
      items.push({ texto: "Tamaño: 1×1 casilla", accion: () => TB.cambiarVarios(todos.map(q => ({ id: q.id, cambios: { ancho: t, alto: t } }))) });
      items.push({ texto: "Tamaño: 2×2 casillas", accion: () => TB.cambiarVarios(todos.map(q => ({ id: q.id, cambios: { ancho: t * 2, alto: t * 2 } }))) });
      items.push({ texto: "Tamaño real de la imagen", accion: async () => {
        for (const q of todos) { const m = await medirImagen(q.datos && q.datos.src); if (m) TB.cambiarObjeto(q.id, { ancho: m.w, alto: m.h }); }
      } });
    }
    items.push("-", { texto: "Duplicar", accion: async () => {
      const t = TB.L.tamCelda();
      const nuevas = await TB.crearObjetos(todos.map(q => { const c = Object.assign({}, q); delete c.id; delete c.actualizado; c.x += t; c.y += t; return c; }));
      TB.L.seleccionar(nuevas.map(n => n.id));
    } });
    items.push({ texto: "Eliminar", peligro: true, accion: () => TB.borrarObjetos(sel) });
    menu(x, y, items);
  }

  /* ============================================================ páginas (GM) */
  let filtroPaginas = "";
  function alternarPaginas() {
    const p = document.getElementById("tbPaginas");
    p.hidden = !p.hidden;
    if (!p.hidden) pintarPaginas();
    marcarBarra();
  }
  function miniaturaDe(e) {
    if (e.miniatura) return e.miniatura;
    if (e.id === TB.escenaId) {
      const mapa = TB.L.objetos().filter(o => o.capa === "mapa" && o.tipo === "imagen" && o.datos && o.datos.src).sort((a, b) => b.ancho * b.alto - a.ancho * a.alto)[0];
      if (mapa) return mapa.datos.src;
    }
    return "";
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
      <button type="button" class="tb-enlace" data-config style="font-size:17px;font-weight:600">⚙ Configuración de página</button>
      <div class="tb-paginas-miembros" title="La página que ven los jugadores">
        <span class="marca"></span>
        <span class="avs">${conectados.slice(0, 4).map(c => `<span style="background-color:${TB.colorJugador(c.uid)}">${esc((c.nombre || "?")[0].toUpperCase())}</span>`).join("")}${conectados.length > 4 ? `<span>+${conectados.length - 4}</span>` : ""}</span>
        <span><b>${esc(deJug ? deJug.nombre : "Ninguna")}</b><small>${conectados.length} ${conectados.length === 1 ? "jugador conectado" : "jugadores conectados"}</small></span>
      </div>
      <button type="button" class="tb-flot-cerrar" data-cerrar style="font-size:26px">✕</button></div>`);
    cab.querySelector("[data-cerrar]").addEventListener("click", alternarPaginas);
    cab.querySelector("[data-config]").addEventListener("click", () => configPagina(TB.escenaId));
    const barra = el(`<div class="tb-paginas-barra">
      <button type="button" class="tb-btn tb-btn-borde" data-carpeta title="Nueva carpeta" style="width:46px;height:42px;padding:0">${I.carpeta}</button>
      <input type="search" placeholder="Buscar…" data-buscar style="min-height:42px">
      <button type="button" class="tb-btn tb-btn-acento" data-crear style="min-height:42px;font-size:16px;font-weight:600">＋ Crear página</button>
      <button type="button" class="tb-btn tb-btn-acento" data-crear-mas style="min-height:42px;width:40px;padding:0" title="Más opciones">▾</button></div>`);
    barra.querySelector("svg").style.cssText = "width:22px;height:22px";
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
      const lista = [...TB.escenas.values()].filter(e => !f || e.nombre.toLowerCase().includes(f)).sort((a, b) => (a.orden || 0) - (b.orden || 0) || String(a.creada).localeCompare(String(b.creada)));
      const carpetas = [...new Set(lista.map(e => e.carpeta || ""))].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
      carpetas.forEach(c => {
        rejilla.appendChild(el(`<div class="tb-paginas-carpeta">${c ? "📁 " + esc(c) : "Todas las páginas"}</div>`));
        const tarjetas = el(`<div class="tb-paginas-tarjetas"></div>`);
        lista.filter(e => (e.carpeta || "") === c).forEach(e => {
          const m = miniaturaDe(e);
          const t = el(`<div class="tb-pag${e.id === TB.escenaId ? " viendo" : ""}" title="Ver esta página">
            ${e.id === TB.estado.escena_jugadores ? `<span class="tb-pag-marca" title="Aquí están los jugadores"></span>` : ""}
            <div class="tb-pag-mini" style="${m ? `background-image:url('${esc(m)}')` : ""}">${m ? "" : "Sin miniatura"}</div>
            <div class="tb-pag-nombre">${esc(e.nombre)}</div>
            <div class="tb-pag-acciones"><button type="button" data-a="jug" title="Llevar a los jugadores a esta página">★ Jugadores aquí</button><button type="button" data-a="cfg" title="Configuración">⚙</button><button type="button" data-a="dup" title="Duplicar">⧉</button><button type="button" data-a="borrar" title="Borrar">🗑</button></div></div>`);
          t.addEventListener("click", async ev => {
            const a = ev.target.closest("[data-a]");
            if (a) {
              ev.stopPropagation();
              if (a.dataset.a === "jug") await TB.llevarJugadores(e.id);
              if (a.dataset.a === "cfg") configPagina(e.id);
              if (a.dataset.a === "dup") await TB.duplicarEscena(e.id);
              if (a.dataset.a === "borrar") await TB.borrarEscena(e.id);
              pintarPaginas();
              return;
            }
            await TB.verEscena(e.id);
            alternarPaginas();
          });
          tarjetas.appendChild(t);
        });
        rejilla.appendChild(tarjetas);
      });
    }
    pintarRejilla();
  }

  function configPagina(id) {
    const e = TB.escenas.get(id);
    if (!e) return;
    const c = Object.assign({ tam: 70, visible: true, ajustar: true, color: "#c0c0c0", opacidad: 0.5, pies: 5 }, e.cuadricula);
    const mini = campoImagen(e.miniatura, f => TB.red.subirImagen(f), { texto: "Miniatura (opcional): suelta una imagen o haz clic" });
    const cuerpo = el(`<div><div class="tb-dos-col">
      <div>
        <label class="tb-campo"><span>Nombre de la página</span><input type="text" data-nombre></label>
        <label class="tb-campo"><span>Carpeta</span><input type="text" data-carpeta placeholder="Sin carpeta"></label>
        <label class="tb-campo"><span>Color de fondo</span><input type="color" data-fondo></label>
        <div class="tb-campo"><span>Miniatura</span><div data-mini style="max-width:260px"></div></div>
      </div>
      <div>
        <h3 style="margin:2px 0 12px;font-size:18px">Cuadrícula</h3>
        <label class="tb-casilla" style="margin-bottom:10px"><input type="checkbox" data-visible> Mostrar la cuadrícula</label><br>
        <label class="tb-casilla" style="margin-bottom:14px"><input type="checkbox" data-ajustar> Ajustar las fichas a la cuadrícula (Alt al soltar para no ajustar)</label>
        <div class="tb-fila"><label class="tb-campo" style="flex:1"><span>Tamaño de casilla (px)</span><input type="number" min="10" max="400" data-tam></label>
          <label class="tb-campo" style="flex:1"><span>Pies por casilla</span><input type="number" min="1" max="100" data-pies></label></div>
        <div class="tb-fila"><label class="tb-campo"><span>Color</span><input type="color" data-color></label>
          <label class="tb-campo" style="flex:1"><span>Opacidad</span><input type="range" min="0" max="100" data-op></label></div>
      </div></div></div>`);
    const q = s => cuerpo.querySelector(s);
    q("[data-nombre]").value = e.nombre; q("[data-carpeta]").value = e.carpeta || ""; q("[data-fondo]").value = e.fondo || "#ffffff";
    q("[data-mini]").appendChild(mini.el);
    q("[data-visible]").checked = c.visible !== false; q("[data-ajustar]").checked = c.ajustar !== false;
    q("[data-tam]").value = c.tam; q("[data-pies]").value = c.pies; q("[data-color]").value = c.color; q("[data-op]").value = Math.round(c.opacidad * 100);
    modal({ titulo: "Configuración de página", cuerpo, ancho: 820, alAceptar: async () => {
      await TB.guardarEscena(id, {
        nombre: q("[data-nombre]").value.trim().slice(0, 80) || "Página", carpeta: q("[data-carpeta]").value.trim().slice(0, 60), fondo: q("[data-fondo]").value, miniatura: mini.valor(),
        cuadricula: { tam: Math.max(10, Math.min(400, parseInt(q("[data-tam]").value, 10) || 70)), pies: Math.max(1, parseInt(q("[data-pies]").value, 10) || 5),
          visible: q("[data-visible]").checked, ajustar: q("[data-ajustar]").checked, color: q("[data-color]").value, opacidad: Number(q("[data-op]").value) / 100 }
      });
      pintarPaginas();
    } });
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
    let ancho, alto;
    if (alt || TB.capa === "mapa") { ancho = m.w; alto = m.h; }
    else { const k = t / Math.max(m.w, m.h); ancho = Math.max(10, Math.round(m.w * k)); alto = Math.max(10, Math.round(m.h * k)); }
    const fila = { tipo: "imagen", capa: TB.capa, ancho, alto, datos: { src, nombre: nombre || "" } };
    Object.assign(fila, TB.L.ajustarPos(fila, p.x, p.y, alt));
    return TB.crearObjetos([fila]);
  }
  async function soltarEnTablero(dt, p, alt) {
    if (!TB.esGM()) { aviso("Solo el DJ coloca cosas en el tablero."); return; }
    const archivos = [...(dt.files || [])].filter(f => /^image\//.test(f.type));
    if (archivos.length) {
      for (const f of archivos) {
        try {
          aviso("Subiendo " + f.name + "…");
          const src = await TB.red.subirImagen(f);
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
    TB.on("escena", () => { pintarPaginas(); if (flotanteAbierto === "niebla") { flotanteAbierto = null; abrirFlotante("niebla", document.querySelector('[data-b="niebla"]')); } });
    TB.on("presencia", pintarPaginas);
    setHerramienta("seleccionar");
    setCapa("fichas");
  }

  window.TBPaneles = { iniciar, ajustesFicha, menuFicha, soltarEnTablero, elegirDibujo, setHerramienta, medirImagen };
})();
