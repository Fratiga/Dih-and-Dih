/* =============================================================================
   CONCURSO — tipos de elemento. Cada uno trae sus valores por defecto, los
   campos que muestra el panel de propiedades de la cabina, cómo se dibuja
   (crear) y, si hace falta conservar animaciones, cómo se actualiza en sitio
   (actualizar). Ninguno aplica reglas: solo representan lo que decide el
   anfitrión.
   ctx = { partida, escena, estado (pasos aplicados), juego, modo }
============================================================================= */
(function (CZ) {
  const esc = CZ.esc;
  const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  function div(clase, html) {
    const d = document.createElement("div");
    d.className = clase;
    if (html != null) d.innerHTML = html;
    return d;
  }
  const color = (v, porDefecto) => v || porDefecto;

  /* Avatar con contorno de pegatina. Sin imagen, la inicial sobre el color del jugador. */
  function avatar(j, clase) {
    const a = div("cz-avatar " + (clase || ""));
    a.style.setProperty("--cz-jc", j ? j.color : "#888");
    if (j && j.avatar) {
      const img = document.createElement("img");
      img.alt = "";
      CZ.ponerImagen(img, j.avatar);
      a.appendChild(img);
    } else {
      a.innerHTML = `<span>${esc(j ? (j.nombre || "?").trim().charAt(0).toUpperCase() : "?")}</span>`;
    }
    return a;
  }
  CZ.avatar = avatar;

  /* Número que cuenta hasta su valor nuevo y tiembla si baja. */
  function contar(nodo, valor) {
    if (nodo.isContentEditable) return;   // el anfitrión lo está escribiendo
    const antes = nodo.dataset.v === undefined ? valor : Number(nodo.dataset.v);
    nodo.dataset.v = valor;
    if (antes === valor) { nodo.textContent = valor; return; }
    cancelAnimationFrame(nodo._raf);
    const t0 = performance.now(), dur = Math.min(900, 250 + Math.abs(valor - antes) * 60);
    const paso = t => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      nodo.textContent = Math.round(antes + (valor - antes) * e);
      if (k < 1) nodo._raf = requestAnimationFrame(paso);
    };
    nodo._raf = requestAnimationFrame(paso);
    const caja = nodo.closest(".cz-marcador, .cz-podio-carta") || nodo;
    caja.classList.remove("cz-sube", "cz-baja");
    void caja.offsetWidth;
    caja.classList.add(valor > antes ? "cz-sube" : "cz-baja");
  }
  CZ.contar = contar;

  function estadosHtml(j) {
    return (j.estados || []).map(s => `<span class="cz-estado" style="--cz-ec:${esc(s.color || "#e8453c")}">${esc(s.texto)}${s.turnos ? ` <b>${esc(s.turnos)}</b>` : ""}</span>`).join("");
  }

  const fmtReloj = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  function restanteReloj(el, juego) {
    const r = juego.relojes[el.id];
    if (!r) return Number(el.props.segundos) || 30;
    if (r.inicio) return Math.max(0, r.restante - (Date.now() - r.inicio) / 1000);
    return r.restante;
  }
  CZ.restanteReloj = restanteReloj;

  CZ.COMPONENTES = {
    texto: {
      nombre: "Texto", w: 900, h: 140, entrada: "subir",
      props: { texto: "Texto", tam: 80, color: "", fuente: "titulo", alinear: "center", contorno: true, caja: false },
      campos: [
        { k: "texto", t: "area", l: "Texto" },
        { k: "tam", t: "rango", l: "Tamaño", min: 16, max: 320 },
        { k: "fuente", t: "elegir", l: "Letra", ops: { titulo: "Cartel", cuerpo: "Lectura" } },
        { k: "alinear", t: "elegir", l: "Alinear", ops: { left: "Izquierda", center: "Centro", right: "Derecha" } },
        { k: "color", t: "color", l: "Color" },
        { k: "contorno", t: "casilla", l: "Contorno grueso" },
        { k: "caja", t: "casilla", l: "Sobre una pestaña" }
      ],
      crear(el) {
        const p = el.props;
        const d = div(`cz-texto cz-f-${p.fuente || "titulo"}${p.contorno ? " cz-contorno" : ""}${p.caja ? " cz-pestana" : ""}`);
        d.style.fontSize = (p.tam || 80) + "px";
        d.style.textAlign = p.alinear || "center";
        d.style.justifyContent = { left: "flex-start", center: "center", right: "flex-end" }[p.alinear || "center"];
        if (p.color) d.style.color = p.color;
        const t = div("cz-texto-t");
        t.textContent = p.texto;
        d.appendChild(t);
        return d;
      }
    },

    imagen: {
      nombre: "Imagen", w: 600, h: 400, entrada: "zoom",
      props: { src: "", ajuste: "contain", pegatina: false, radio: 0 },
      campos: [
        { k: "src", t: "imagen", l: "Imagen" },
        { k: "ajuste", t: "elegir", l: "Ajuste", ops: { contain: "Entera", cover: "Llenar el recuadro" } },
        { k: "pegatina", t: "casilla", l: "Contorno de pegatina" },
        { k: "radio", t: "rango", l: "Esquinas", min: 0, max: 300 }
      ],
      crear(el) {
        const p = el.props;
        if (!p.src) return div("cz-imagen cz-vacia", "<span>Imagen</span>");
        const d = div("cz-imagen" + (p.pegatina ? " cz-pegatina" : ""));
        const img = document.createElement("img");
        img.alt = "";
        img.draggable = false;
        img.style.objectFit = p.ajuste || "contain";
        img.style.borderRadius = (p.radio || 0) + "px";
        CZ.ponerImagen(img, p.src);
        d.appendChild(img);
        return d;
      }
    },

    forma: {
      nombre: "Forma", w: 400, h: 300, entrada: "zoom",
      props: { forma: "rect", relleno: "", borde: "", grosor: 8, radio: 28, sombra: true },
      campos: [
        { k: "forma", t: "elegir", l: "Forma", ops: { rect: "Rectángulo", circulo: "Círculo", anillo: "Círculo de revelación", linea: "Línea" } },
        { k: "relleno", t: "color", l: "Relleno" },
        { k: "borde", t: "color", l: "Borde" },
        { k: "grosor", t: "rango", l: "Grosor", min: 0, max: 40 },
        { k: "radio", t: "rango", l: "Esquinas", min: 0, max: 200 },
        { k: "sombra", t: "casilla", l: "Sombra dura" }
      ],
      crear(el) {
        const p = el.props;
        const d = div(`cz-forma cz-forma-${p.forma}${p.sombra && p.forma !== "anillo" ? " cz-sombra" : ""}`);
        d.style.setProperty("--cz-relleno", color(p.relleno, p.forma === "anillo" ? "transparent" : "var(--cz-papel)"));
        d.style.setProperty("--cz-borde", color(p.borde, p.forma === "anillo" ? "#e03131" : "var(--cz-contorno)"));
        d.style.setProperty("--cz-grosor", (p.grosor == null ? 8 : p.grosor) + "px");
        d.style.setProperty("--cz-radio", (p.radio || 0) + "px");
        return d;
      }
    },

    boton: {
      nombre: "Botón", w: 380, h: 110, entrada: "subir",
      props: { texto: "menu", color: "" },
      campos: [{ k: "texto", t: "linea", l: "Texto" }, { k: "color", t: "color", l: "Color del texto" }],
      crear(el) {
        const d = div("cz-boton");
        d.innerHTML = `<span class="cz-boton-t">${esc(el.props.texto)}</span><svg class="cz-chev" viewBox="0 0 64 32" aria-hidden="true"><path d="M4 5 32 15 60 5M4 17 32 27 60 17"/></svg>`;
        if (el.props.color) d.style.setProperty("--cz-bt", el.props.color);
        return d;
      }
    },

    marcador: {
      nombre: "Marcador", w: 380, h: 140, entrada: "subir",
      props: { jugadorId: "", mostrarNombre: true },
      campos: [{ k: "jugadorId", t: "jugador", l: "Jugador" }, { k: "mostrarNombre", t: "casilla", l: "Mostrar el nombre" }],
      crear(el, ctx) {
        const j = CZ.jugador(ctx.partida, el.props.jugadorId);
        const d = div("cz-marcador");
        d.style.setProperty("--cz-jc", j ? j.color : "#888");
        const num = div("cz-marcador-n");
        num.textContent = j ? j.puntos : "–";
        num.dataset.v = j ? j.puntos : 0;
        const pastilla = div("cz-marcador-p");
        pastilla.appendChild(num);
        d.appendChild(pastilla);
        d.appendChild(avatar(j, "cz-marcador-a"));
        const pie = div("cz-marcador-pie");
        pie.innerHTML = (el.props.mostrarNombre !== false ? `<span class="cz-marcador-nom">${esc(j ? j.nombre : "Elige jugador")}</span>` : "") + (j ? estadosHtml(j) : "");
        d.appendChild(pie);
        return d;
      },
      // Solo llega aquí si la firma (todo menos los puntos) no cambió: cuenta hasta el valor nuevo
      actualizar(nodo, el, ctx) {
        const j = CZ.jugador(ctx.partida, el.props.jugadorId);
        contar(nodo.querySelector(".cz-marcador-n"), j ? j.puntos : 0);
        return nodo;
      },
      firma(el, ctx) {
        const j = CZ.jugador(ctx.partida, el.props.jugadorId);
        return j ? [j.id, j.nombre, j.avatar, j.color, JSON.stringify(j.estados), el.props.mostrarNombre].join("|") : "";
      }
    },

    podio: {
      nombre: "Podio", w: 1600, h: 800, entrada: "aparecer",
      props: { titulo: "" },
      campos: [{ k: "titulo", t: "linea", l: "Título (opcional)" }],
      crear(el, ctx) {
        const d = div("cz-podio");
        if (el.props.titulo) d.appendChild(div("cz-podio-titulo", esc(el.props.titulo)));
        const fila = div("cz-podio-fila");
        CZ.ranking(ctx.partida).forEach((j, i) => fila.appendChild(cartaPodio(j, i)));
        d.appendChild(fila);
        return d;
      },
      actualizar(nodo, el, ctx) {
        const fila = nodo.querySelector(".cz-podio-fila");
        if (!fila) return null;
        const orden = CZ.ranking(ctx.partida);
        const actuales = new Map(Array.from(fila.children).map(c => [c.dataset.j, c]));
        if (orden.length !== actuales.size || orden.some(j => !actuales.has(j.id))) return null;
        // FLIP: se mide dónde está cada tarjeta, se reordena y se anima desde la posición vieja
        const antes = new Map(Array.from(fila.children).map(c => [c.dataset.j, c.getBoundingClientRect()]));
        orden.forEach((j, i) => {
          const c = actuales.get(j.id);
          if (c.dataset.firma !== firmaJugador(j)) { const n = cartaPodio(j, i); c.replaceWith(n); actuales.set(j.id, n); return; }
          c.querySelector(".cz-podio-pos").textContent = (i + 1) + ".º";
          c.classList.toggle("cz-primero", i === 0 && j.puntos > 0);
          contar(c.querySelector(".cz-podio-n"), j.puntos);
        });
        orden.forEach(j => fila.appendChild(actuales.get(j.id)));
        orden.forEach(j => {
          const c = actuales.get(j.id), a = antes.get(j.id);
          if (!a) return;
          const b = c.getBoundingClientRect();
          const dx = a.left - b.left;
          if (Math.abs(dx) > 1) {
            c.animate([{ transform: `translateX(${dx / (CZ.escalaDe(c) || 1)}px)` }, { transform: "none" }], { duration: 650, easing: "cubic-bezier(.2,.8,.2,1)" });
          }
        });
        return nodo;
      },
      firma(el, ctx) { return el.props.titulo + "|" + ctx.partida.jugadores.length; }
    },

    carta: {
      nombre: "Carta", w: 360, h: 500, entrada: "rebote",
      props: { titulo: "Nombre", etiqueta: "OBJETIVO", colorEtiqueta: "#e8453c", imagen: "", habilidad: "Habilidad", texto: "Lo que hace la carta.", nota: "", bocaAbajo: false },
      campos: [
        { k: "titulo", t: "linea", l: "Nombre" },
        { k: "etiqueta", t: "linea", l: "Etiqueta" },
        { k: "colorEtiqueta", t: "color", l: "Color" },
        { k: "imagen", t: "imagen", l: "Ilustración" },
        { k: "habilidad", t: "linea", l: "Habilidad" },
        { k: "texto", t: "area", l: "Efecto" },
        { k: "nota", t: "linea", l: "Letra pequeña" },
        { k: "bocaAbajo", t: "casilla", l: "Empieza boca abajo" }
      ],
      crear(el, ctx) {
        const p = el.props;
        const d = div("cz-carta");
        d.style.setProperty("--cz-cc", p.colorEtiqueta || "#e8453c");
        d.innerHTML = `
          <div class="cz-carta-giro">
            <div class="cz-carta-cara">
              <div class="cz-carta-cab"><b>${esc(p.titulo)}</b><i>${esc(p.etiqueta)}</i></div>
              <div class="cz-carta-ilus"></div>
              <div class="cz-carta-hab"><span>Habilidad</span><b>${esc(p.habilidad)}</b></div>
              <div class="cz-carta-txt">${esc(p.texto)}</div>
              ${p.nota ? `<div class="cz-carta-nota">${esc(p.nota)}</div>` : ""}
            </div>
            <div class="cz-carta-dorso"><span>?</span></div>
          </div>`;
        CZ.ponerImagen(d.querySelector(".cz-carta-ilus"), p.imagen, true);
        d.classList.toggle("cz-volteada", cartaBocaAbajo(el, ctx));
        return d;
      },
      actualizar(nodo, el, ctx) {
        nodo.classList.toggle("cz-volteada", cartaBocaAbajo(el, ctx));
        return nodo;
      },
      firma(el) { const p = el.props; return [p.titulo, p.etiqueta, p.colorEtiqueta, p.imagen, p.habilidad, p.texto, p.nota].join("|"); }
    },

    rejilla: {
      nombre: "Rejilla de cartas", w: 1500, h: 700, entrada: "aparecer",
      props: { cols: 6, filas: 3, estilo: "suerte", letras: true, valores: ["+1 punto"] },
      campos: [
        { k: "cols", t: "rango", l: "Columnas", min: 1, max: 10 },
        { k: "filas", t: "rango", l: "Filas", min: 1, max: 8 },
        { k: "estilo", t: "elegir", l: "Estilo", ops: { suerte: "Cartas de riesgo", feud: "Respuestas ocultas", madera: "Fichas" } },
        { k: "letras", t: "casilla", l: "Letras en el dorso" },
        { k: "valores", t: "lista", l: "Lo que hay debajo (una línea por carta)" }
      ],
      crear(el, ctx) {
        const p = el.props, n = Math.max(1, p.cols * p.filas);
        const d = div(`cz-rejilla cz-rejilla-${p.estilo}`);
        d.style.gridTemplateColumns = `repeat(${p.cols}, 1fr)`;
        d.style.gridTemplateRows = `repeat(${p.filas}, 1fr)`;
        const vueltas = volteadasRejilla(el, ctx);
        for (let i = 0; i < n; i++) {
          const v = (p.valores || [])[i] || "";
          const c = div("cz-celda" + (vueltas.has(i) ? " cz-volteada" : ""));
          c.dataset.celda = i;
          const tono = /^\s*[+]/.test(v) ? "bien" : /^\s*[-−]/.test(v) ? "mal" : "otro";
          const frente = p.estilo === "feud" ? "???????" : p.letras ? LETRAS[i % 26] + (i >= 26 ? Math.floor(i / 26) : "") : "";
          c.innerHTML = `<div class="cz-celda-giro"><div class="cz-celda-dorso cz-t${i % 5}">${esc(frente)}</div><div class="cz-celda-cara cz-v-${tono}">${esc(v)}</div></div>`;
          d.appendChild(c);
        }
        return d;
      },
      actualizar(nodo, el, ctx) {
        const vueltas = volteadasRejilla(el, ctx);
        nodo.querySelectorAll(".cz-celda").forEach(c => c.classList.toggle("cz-volteada", vueltas.has(Number(c.dataset.celda))));
        return nodo;
      },
      firma(el) { const p = el.props; return [p.cols, p.filas, p.estilo, p.letras, (p.valores || []).join("\n")].join("|"); }
    },

    matriz: {
      nombre: "Matriz de categorías", w: 1500, h: 800, entrada: "aparecer",
      props: { categorias: ["Categoría 1", "Categoría 2", "Categoría 3"], valores: [1, 2, 3], iconos: [], enlaces: {}, mostrarValores: true },
      campos: [
        { k: "categorias", t: "lista", l: "Categorías (una por línea)" },
        { k: "valores", t: "lista", l: "Puntos de cada columna (una por línea)" },
        { k: "iconos", t: "listaImagenes", l: "Icono de cada columna (URL, una por línea)" },
        { k: "mostrarValores", t: "casilla", l: "Puntos encima de las columnas" },
        { k: "enlaces", t: "enlacesMatriz", l: "Enlaces de las celdas" }
      ],
      crear(el, ctx) {
        const p = el.props, cats = p.categorias || [], vals = p.valores || [];
        const d = div("cz-matriz");
        d.style.gridTemplateColumns = `minmax(0, 1.5fr) repeat(${vals.length}, minmax(0, 1fr))`;
        d.style.gridTemplateRows = (p.mostrarValores ? "auto " : "") + `repeat(${cats.length}, 1fr)`;
        if (p.mostrarValores) {
          d.appendChild(div("cz-matriz-esq"));
          vals.forEach(v => d.appendChild(div("cz-matriz-val", esc(v))));
        }
        cats.forEach((cat, r) => {
          const c = div(`cz-matriz-cat cz-t${r % 6}`);
          c.innerHTML = `<span>${esc(cat)}</span>`;
          d.appendChild(c);
          vals.forEach((v, col) => {
            const clave = r + "," + col;
            const usado = ctx.juego.usadas[el.id + ":" + clave];
            const celda = div(`cz-matriz-celda cz-t${r % 6}${usado ? " cz-usada" : ""}${p.enlaces && p.enlaces[clave] ? " cz-con-enlace" : ""}`);
            celda.dataset.celda = clave;
            const icono = (p.iconos || [])[col];
            if (icono) { const img = document.createElement("img"); img.alt = ""; img.draggable = false; CZ.ponerImagen(img, icono); celda.appendChild(img); }
            else celda.appendChild(div("cz-matriz-num", esc(v)));
            if (usado) {
              const j = usado !== "x" && CZ.jugador(ctx.partida, usado);
              celda.appendChild(j ? avatar(j, "cz-matriz-ganador") : div("cz-matriz-x", "×"));
            }
            d.appendChild(celda);
          });
        });
        return d;
      },
      // Se rehace cuando cambian sus datos, las celdas usadas o los avatares de los jugadores
      firma(el, ctx) {
        const usadas = Object.keys(ctx.juego.usadas).filter(k => k.startsWith(el.id + ":")).map(k => k + "=" + ctx.juego.usadas[k]).join(",");
        return JSON.stringify(el.props) + "|" + usadas + "|" + ctx.partida.jugadores.map(j => j.avatar + j.color + j.nombre).join(",");
      }
    },

    prueba: {
      nombre: "Imagen de prueba", w: 1000, h: 640, entrada: "zoom",
      props: { src: "", modo: "recorte", zoom: 3, cx: 0.5, cy: 0.5, marco: true },
      campos: [
        { k: "src", t: "imagen", l: "Imagen" },
        { k: "modo", t: "elegir", l: "Modo", ops: { recorte: "Recorte", silueta: "Silueta", desenfoque: "Desenfoque", espejo: "Espejo" } },
        { k: "zoom", t: "rango", l: "Acercamiento del recorte", min: 1, max: 10, paso: 0.1 },
        { k: "cx", t: "rango", l: "Centro horizontal", min: 0, max: 1, paso: 0.01 },
        { k: "cy", t: "rango", l: "Centro vertical", min: 0, max: 1, paso: 0.01 },
        { k: "marco", t: "casilla", l: "Con marco" }
      ],
      crear(el, ctx) {
        const p = el.props;
        const d = div(`cz-prueba cz-prueba-${p.modo}${p.marco ? " cz-con-marco" : ""}`);
        if (!p.src) { d.classList.add("cz-vacia"); d.innerHTML = "<span>Imagen de prueba</span>"; return d; }
        const img = document.createElement("img");
        img.alt = "";
        img.draggable = false;
        CZ.ponerImagen(img, p.src);
        d.appendChild(img);
        aplicarPrueba(d, el, ctx);
        return d;
      },
      actualizar(nodo, el, ctx) { if (!el.props.src) return null; aplicarPrueba(nodo, el, ctx); return nodo; },
      firma(el) { const p = el.props; return [p.src, p.modo, p.marco].join("|"); }
    },

    temporizador: {
      nombre: "Temporizador", w: 360, h: 160, entrada: "rebote",
      props: { segundos: 30 },
      campos: [{ k: "segundos", t: "rango", l: "Segundos", min: 3, max: 300 }],
      crear(el, ctx) {
        const d = div("cz-reloj");
        d.innerHTML = `<span class="cz-reloj-n"></span>`;
        d._el = el;
        d._ctx = ctx;
        const tic = () => {
          if (!d.isConnected) { clearInterval(d._t); return; }
          const s = restanteReloj(d._el, d._ctx.juego);
          d.querySelector(".cz-reloj-n").textContent = fmtReloj(s);
          d.classList.toggle("cz-urgente", s > 0 && s <= 5);
          const corre = !!(d._ctx.juego.relojes[d._el.id] || {}).inicio;
          d.classList.toggle("cz-corre", corre);
          const fin = corre && s <= 0;
          if (fin && !d._sonado) { d._sonado = true; if (d._ctx.modo === "programa") CZ.sonar("buzz"); }
          if (!fin) d._sonado = false;
          d.classList.toggle("cz-fin", corre && s <= 0);
        };
        tic();
        d._t = setInterval(tic, 200);
        return d;
      },
      actualizar(nodo, el, ctx) { nodo._el = el; nodo._ctx = ctx; return nodo; },
      firma() { return "r"; }
    }
  };

  function firmaJugador(j) { return [j.nombre, j.avatar, j.color].join("|"); }

  function cartaPodio(j, i) {
    const c = div("cz-podio-carta" + (i === 0 && j.puntos > 0 ? " cz-primero" : ""));
    c.dataset.j = j.id;
    c.dataset.celda = j.id;
    c.dataset.firma = firmaJugador(j);
    c.style.setProperty("--cz-jc", j.color);
    c.appendChild(avatar(j, "cz-podio-a"));
    const papel = div("cz-podio-papel");
    papel.innerHTML = `<div class="cz-podio-pos">${i + 1}.º</div><div class="cz-podio-nom">${esc(j.nombre)}</div><div class="cz-podio-n">${j.puntos}</div>`;
    papel.querySelector(".cz-podio-n").dataset.v = j.puntos;
    c.appendChild(papel);
    return c;
  }

  function cartaBocaAbajo(el, ctx) {
    let abajo = !!el.props.bocaAbajo;
    if (ctx.estado.volteos[el.id]) abajo = !abajo;            // pasos de la escena
    if (ctx.juego.volteadas[el.id]) abajo = !abajo;           // clic del anfitrión al aire
    return abajo;
  }

  function volteadasRejilla(el, ctx) {
    const s = new Set(ctx.juego.volteadas[el.id] || []);
    (ctx.estado.celdas[el.id] || []).forEach(i => (s.has(i) ? s.delete(i) : s.add(i)));
    return s;
  }

  function aplicarPrueba(d, el, ctx) {
    const p = el.props, revelada = ctx.estado.reveladas.has(el.id);
    d.classList.toggle("cz-revelada", revelada);
    const img = d.querySelector("img");
    if (!img) return;
    if (p.modo === "recorte") {
      img.style.transformOrigin = `${(p.cx * 100).toFixed(1)}% ${(p.cy * 100).toFixed(1)}%`;
      img.style.transform = revelada ? "scale(1)" : `scale(${p.zoom || 3})`;
    } else {
      img.style.transform = p.modo === "espejo" && !revelada ? "scaleX(-1)" : "";
      img.style.transformOrigin = "";
    }
  }
})(window.CZ);
