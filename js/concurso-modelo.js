/* =============================================================================
   CONCURSO — modelo de datos, temas y guardado local. Lo usan la cabina, el
   programa y la vista de jugador (ver docs/concurso.md).
============================================================================= */
window.CZ = window.CZ || {};

(function (CZ) {
  CZ.ANCHO = 1920;
  CZ.ALTO = 1080;

  CZ.uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  CZ.uuid = () => (crypto.randomUUID ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
  CZ.copia = o => JSON.parse(JSON.stringify(o));
  CZ.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* Temas: la apariencia vive en css/concurso-escena.css ([data-tema=...]). Aquí solo el nombre y la paleta que
     ofrece el editor para elegir colores rápido. */
  CZ.TEMAS = {
    madera: { nombre: "Mesa de madera", paleta: ["#3a2a1c", "#fff8ec", "#e8453c", "#f5b82e", "#6cc04a", "#3d8de0", "#a35ee8", "#ff8fb6"] },
    camara: { nombre: "Cámara nocturna", paleta: ["#f2f2f2", "#0e1013", "#e9e33b", "#7ddc3a", "#e03131", "#3fa9f5", "#b06ce0", "#5b6170"] },
    vineta: { nombre: "Viñeta", paleta: ["#2d2d2d", "#ffffff", "#ff6a1a", "#8b5cf6", "#22c55e", "#0ea5e9", "#ef4444", "#facc15"] }
  };
  CZ.PATRONES = { madera: "Madera", velocidad: "Líneas de velocidad", escaneo: "Pantalla nocturna", puntos: "Puntos", papel: "Papel arrugado" };
  CZ.TRANSICIONES = { corte: "Corte", barrido: "Barrido", cortina: "Cortina", zoom: "Zoom", fundido: "Fundido" };
  CZ.ENTRADAS = { ninguna: "Sin animación", aparecer: "Aparecer", subir: "Subir", rebote: "Rebote", zoom: "Zoom", girar: "Girar", sello: "Sello" };
  CZ.ACCIONES = { mostrar: "Mostrar", ocultar: "Ocultar", revelar: "Revelar", voltear: "Voltear", reproducir: "Reproducir", sonido: "Sonido" };
  CZ.SONIDOS = { ding: "Acierto", buzz: "Fallo", tambor: "Redoble", whoosh: "Barrido", jumpscare: "Susto", moneda: "Moneda", timbre: "Timbre" };
  CZ.COLORES_JUGADOR = ["#e8453c", "#3d8de0", "#6cc04a", "#f5b82e", "#a35ee8", "#ff8fb6", "#1fb5a6", "#ff8a3d"];

  /* ---------------------------------------------------------------- constructores */

  CZ.nuevoJugador = function (i) {
    return {
      id: CZ.uid(), nombre: "Jugador " + (i + 1), avatar: "", color: CZ.COLORES_JUGADOR[i % CZ.COLORES_JUGADOR.length],
      puntos: 0, inventario: [], estados: [], privado: "", notas: "", token: CZ.uuid()
    };
  };

  CZ.nuevaEscena = function (nombre) {
    return { id: CZ.uid(), nombre: nombre || "Escena", carpeta: "", tema: "", fondo: { tipo: "tema", valor: "" }, transicion: "barrido", elementos: [], pasos: [] };
  };

  /* Un elemento. Los valores propios de cada tipo salen de CZ.COMPONENTES (js/concurso-componentes.js). */
  CZ.nuevoElemento = function (tipo, extra) {
    const def = (CZ.COMPONENTES && CZ.COMPONENTES[tipo]) || { w: 400, h: 200, props: {} };
    const w = (extra && extra.w) || def.w, h = (extra && extra.h) || def.h;
    const el = {
      id: CZ.uid(), tipo, nombre: def.nombre || tipo,
      x: Math.round((CZ.ANCHO - w) / 2), y: Math.round((CZ.ALTO - h) / 2), w, h, rot: 0, opacidad: 1,
      entrada: def.entrada || "aparecer", oculto: false, bloqueado: false, enlace: "",
      props: CZ.copia(def.props || {})
    };
    if (extra) {
      Object.keys(extra).forEach(k => { if (k === "props") Object.assign(el.props, extra.props); else el[k] = extra[k]; });
    }
    return el;
  };

  /* Partida de ejemplo: lo justo para ver cómo se monta (título, matriz, una pregunta de recorte con sus pasos,
     cartas de riesgo y el podio). */
  CZ.nuevaPartida = function (nombre, conEjemplo) {
    const p = {
      id: CZ.uuid(), nombre: nombre || "Partida nueva", tema: "madera", creada: Date.now(), actualizada: Date.now(),
      jugadores: [0, 1, 2, 3].map(i => CZ.nuevoJugador(i)), escenas: [],
      vivo: { escena: "", paso: 0 }, juego: { usadas: {}, volteadas: {}, relojes: {}, audios: {}, trazos: {}, pulsador: { orden: [] } }, registro: []
    };
    if (!conEjemplo) {
      const e = CZ.nuevaEscena("Título");
      e.elementos.push(CZ.nuevoElemento("texto", { y: 400, w: 1400, h: 220, x: 260, props: { texto: p.nombre, tam: 150 } }));
      p.escenas.push(e);
      p.vivo.escena = e.id;
      return p;
    }
    return CZ.partidaEjemplo(p);
  };

  CZ.partidaEjemplo = function (p) {
    const [j1, j2, j3, j4] = p.jugadores;
    const titulo = CZ.nuevaEscena("Título");
    titulo.carpeta = "Inicio";
    titulo.transicion = "zoom";
    const menu = CZ.nuevaEscena("Menú");
    menu.carpeta = "Inicio";
    const pregunta = CZ.nuevaEscena("Recorte · 2 puntos");
    pregunta.carpeta = "Preguntas";
    pregunta.tema = "vineta";
    const suerte = CZ.nuevaEscena("¿Te sientes con suerte?");
    suerte.carpeta = "Eventos";
    suerte.tema = "camara";
    const puntos = CZ.nuevaEscena("Puntos");
    puntos.carpeta = "Inicio";
    puntos.fondo = { tipo: "patron", valor: "papel" };

    // Título
    titulo.elementos.push(
      CZ.nuevoElemento("texto", { nombre: "Título", x: 210, y: 300, w: 1500, h: 230, entrada: "rebote", props: { texto: "El Gran Concurso", tam: 190 } }),
      CZ.nuevoElemento("texto", { nombre: "Subtítulo", x: 460, y: 560, w: 1000, h: 90, entrada: "subir", props: { texto: "Una partida de ejemplo. Edítala o crea otra.", tam: 46, fuente: "cuerpo", contorno: false } }),
      CZ.nuevoElemento("boton", { nombre: "Empezar", x: 760, y: 760, w: 400, h: 110, entrada: "subir", enlace: menu.id, props: { texto: "empezar" } })
    );
    // Menú: matriz de categorías + marcadores
    const mat = CZ.nuevoElemento("matriz", { nombre: "Matriz", x: 60, y: 50, w: 1520, h: 840 });
    mat.props.categorias = ["Recortes", "Siluetas", "Dibujos rápidos", "¿Cuál es el falso?", "¿Existe?", "Opinión"];
    mat.props.valores = [1, 1, 2, 2, 3];
    mat.props.enlaces = { "0,0": pregunta.id };
    menu.elementos.push(
      mat,
      CZ.nuevoElemento("boton", { nombre: "Suerte", x: 1600, y: 60, w: 300, h: 110, enlace: suerte.id, props: { texto: "¿suerte?" } }),
      CZ.nuevoElemento("boton", { nombre: "Puntos", x: 1600, y: 200, w: 300, h: 110, enlace: puntos.id, props: { texto: "puntos" } })
    );
    [j1, j2, j3, j4].forEach((j, i) => {
      menu.elementos.push(CZ.nuevoElemento("marcador", { nombre: "Marcador " + (i + 1), x: 60 + i * 390, y: 905, w: 370, h: 130, entrada: "subir", props: { jugadorId: j.id } }));
    });
    // Pregunta de recorte: imagen recortada, paso que la revela, paso con el círculo rojo
    const prueba = CZ.nuevoElemento("prueba", { nombre: "Imagen", x: 460, y: 200, w: 1000, h: 640, props: { modo: "recorte", src: "", zoom: 3.2, cx: 0.32, cy: 0.38 } });
    const aro = CZ.nuevoElemento("forma", { nombre: "Círculo rojo", x: 690, y: 330, w: 240, h: 240, oculto: true, entrada: "sello", props: { forma: "anillo", borde: "#e03131", grosor: 14 } });
    pregunta.elementos.push(
      CZ.nuevoElemento("texto", { nombre: "Categoría", x: 660, y: 30, w: 600, h: 90, props: { texto: "Recortes", tam: 64, caja: true } }),
      CZ.nuevoElemento("texto", { nombre: "Pregunta", x: 360, y: 120, w: 1200, h: 70, props: { texto: "¿De qué personaje es esta parte?", tam: 44, fuente: "cuerpo", contorno: false } }),
      prueba, aro,
      CZ.nuevoElemento("boton", { nombre: "menu", x: 140, y: 900, w: 380, h: 110, enlace: menu.id, props: { texto: "menu" } }),
      CZ.nuevoElemento("boton", { nombre: "points", x: 1400, y: 900, w: 380, h: 110, enlace: puntos.id, props: { texto: "points" } })
    );
    pregunta.pasos.push({ id: CZ.uid(), accion: "revelar", objetivo: prueba.id }, { id: CZ.uid(), accion: "mostrar", objetivo: aro.id });
    // Cartas de riesgo
    const valores = Array.from({ length: 18 }, (_, i) => (i === 7 ? "-5 puntos" : i === 3 || i === 12 ? "Pierdes el turno" : "+1 punto"));
    suerte.elementos.push(
      CZ.nuevoElemento("texto", { nombre: "Pregunta", x: 460, y: 30, w: 1000, h: 80, props: { texto: "¿Cuántas veces vas a tentar a la suerte?", tam: 50, fuente: "cuerpo", contorno: false, color: "#e9e33b" } }),
      CZ.nuevoElemento("rejilla", { nombre: "Cartas", x: 160, y: 150, w: 1600, h: 760, props: { cols: 6, filas: 3, estilo: "suerte", letras: true, valores } }),
      CZ.nuevoElemento("boton", { nombre: "menu", x: 360, y: 940, w: 380, h: 100, enlace: menu.id, props: { texto: "menu" } }),
      CZ.nuevoElemento("boton", { nombre: "points", x: 1180, y: 940, w: 380, h: 100, enlace: puntos.id, props: { texto: "points" } })
    );
    // Puntos
    puntos.elementos.push(
      CZ.nuevoElemento("podio", { nombre: "Podio", x: 160, y: 120, w: 1600, h: 800 }),
      CZ.nuevoElemento("boton", { nombre: "menu", x: 760, y: 940, w: 400, h: 100, enlace: menu.id, props: { texto: "menu" } })
    );
    p.escenas.push(titulo, menu, pregunta, suerte, puntos);
    p.vivo = { escena: titulo.id, paso: 0 };
    return p;
  };

  /* Completa lo que le falte a una partida (importada o de una versión anterior). */
  CZ.normalizar = function (p) {
    p.jugadores = p.jugadores || [];
    p.jugadores.forEach(j => { j.inventario = j.inventario || []; j.estados = j.estados || []; if (!j.token) j.token = CZ.uuid(); });
    p.escenas = p.escenas || [];
    p.escenas.forEach(e => { e.elementos = e.elementos || []; e.pasos = e.pasos || []; e.fondo = e.fondo || { tipo: "tema", valor: "" }; });
    p.vivo = p.vivo || { escena: "", paso: 0 };
    if (!p.escenas.some(e => e.id === p.vivo.escena) && p.escenas[0]) p.vivo = { escena: p.escenas[0].id, paso: 0 };
    p.juego = p.juego || {};
    ["usadas", "volteadas", "relojes", "audios", "trazos"].forEach(k => { p.juego[k] = p.juego[k] || {}; });
    p.juego.pulsador = p.juego.pulsador || { orden: [] };
    p.registro = p.registro || [];
    p.tema = CZ.TEMAS[p.tema] ? p.tema : "madera";
    return p;
  };

  CZ.escena = (p, id) => p && p.escenas.find(e => e.id === id);
  CZ.jugador = (p, id) => p && p.jugadores.find(j => j.id === id);
  CZ.ranking = p => p.jugadores.slice().sort((a, b) => b.puntos - a.puntos);

  /* ---------------------------------------------------------------- guardado local */

  const LISTA = "concurso:lista", ACTUAL = "concurso:actual", PRE = "concurso:p:";
  const leer = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } };
  const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

  CZ.local = {
    lista: () => leer(LISTA, []),
    actual: () => { try { return localStorage.getItem(ACTUAL) || ""; } catch (e) { return ""; } },
    cargar: id => { const p = leer(PRE + id, null); return p ? CZ.normalizar(p) : null; },
    guardar(p) {
      p.actualizada = Date.now();
      const ok = escribir(PRE + p.id, p);
      const lista = CZ.local.lista().filter(x => x.id !== p.id);
      lista.unshift({ id: p.id, nombre: p.nombre, actualizada: p.actualizada });
      escribir(LISTA, lista);
      try { localStorage.setItem(ACTUAL, p.id); } catch (e) { /* sin almacenamiento */ }
      return ok;
    },
    borrar(id) {
      try { localStorage.removeItem(PRE + id); } catch (e) { /* nada */ }
      escribir(LISTA, CZ.local.lista().filter(x => x.id !== id));
    }
  };

  /* ---------------------------------------------------------------- imágenes locales (IndexedDB)
     Las imágenes pegadas o arrastradas no caben en localStorage. Se guardan como blobs y el elemento lleva
     "idb:CLAVE". El programa está en el mismo navegador, así que las ve igual. */
  let bdPromesa = null;
  function bd() {
    if (!bdPromesa) {
      bdPromesa = new Promise((res, rej) => {
        const r = indexedDB.open("concurso", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("imagenes");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    }
    return bdPromesa;
  }
  const urls = new Map();
  CZ.imagenes = {
    async guardar(blob) {
      const clave = CZ.uid();
      const db = await bd();
      await new Promise((res, rej) => { const t = db.transaction("imagenes", "readwrite"); t.objectStore("imagenes").put(blob, clave); t.oncomplete = res; t.onerror = () => rej(t.error); });
      return "idb:" + clave;
    },
    /* Devuelve una URL usable en <img> (las "idb:" se resuelven a una URL de objeto). */
    async url(src) {
      if (!src || !src.startsWith("idb:")) return src || "";
      if (urls.has(src)) return urls.get(src);
      try {
        const db = await bd();
        const blob = await new Promise((res, rej) => { const r = db.transaction("imagenes").objectStore("imagenes").get(src.slice(4)); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
        const u = blob ? URL.createObjectURL(blob) : "";
        urls.set(src, u);
        return u;
      } catch (e) { return ""; }
    }
  };
  /* Pone la imagen en un <img> o como fondo, resolviendo "idb:" si hace falta. */
  CZ.ponerImagen = function (nodo, src, comoFondo) {
    if (!src) { if (comoFondo) nodo.style.backgroundImage = ""; else nodo.removeAttribute("src"); return; }
    const aplicar = u => { if (comoFondo) nodo.style.backgroundImage = u ? `url("${u}")` : ""; else if (u) nodo.src = u; };
    if (src.startsWith("idb:")) CZ.imagenes.url(src).then(aplicar); else aplicar(src);
  };
})(window.CZ);
