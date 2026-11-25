/* =============================================================================
   LAS SALAS DE LA TABERNA
   El lobby (index.html) es la sala principal. Desde ella se entra a otras salas que viven en la misma página, cada una con los enlaces de
   su grupo, para que desde la taberna se llegue a TODAS las páginas del sitio sin que el salón principal se llene:
     Biblioteca       el compendio por estantes (Mundo, Archivo, Reglas y cifras) y el Compendio completo
     Sala recreativa  las máquinas y los juegos de habilidad (el Hipódromo no está aquí: tiene su propio sitio)
     Salón de naipes  Triunfos, Las Veintiuna Velas y El Pozo del Dragón
     Sala de campaña  el Tablero, el Mapa, Mis personajes, el Registro y el tablón de Discord
     Establos         el Hipódromo, el Hipódromo en vivo y los corrales
     Despacho         solo admin: el panel, los editores de mapas de ritmo y el Concurso
   Cada página está en una sola sala. En pantallas anchas las salas se ven en 2.5D (js/salas3d/: la maqueta de cada una); el dibujo plano de
   index.html y de js/lobby-salas-arte.js queda para cuando no hay WebGL (y el móvil enseña puertas grandes).
   Mi habitación y el Intercambios son puertas de la taberna que llevan a su propia página.

   MAPA es la lista de enlaces del lobby y la única fuente: de ella salen las salas dibujadas y la lista «Todas las puertas».
   docs/pruebas-web/enlaces_lobby.js comprueba que no falte ninguna página del sitio. Quedan fuera, a propósito, las páginas secretas
   (secreto, muerte-subita, encuentro-verdam) y el propio index.
   El dibujo de cada sala está en js/lobby-salas-arte.js. Se llega a ellas desde las pestañas de arriba de la escena (la taberna solo
   tiene puertas a los Establos y al Despacho). Navegación: la sala va en el hash de la URL (#biblioteca, #juegos, #establos, #despacho).
============================================================================= */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const esAdmin = () => typeof window.esAdmin === "function" ? !!window.esAdmin() : false;

  /* ---------------------------------------------------------------- el mapa: todos los enlaces */
  // [href, nombre, arte, solo admin]
  const MAPA = {
    taberna: {
      nombre: "Taberna", grupos: [{ titulo: "Taberna", enlaces: [
        ["fanarts.html", "Fanarts"], ["peticiones.html", "Tablón (peticiones)"], ["rocola.html", "Rocola"], ["intercambios.html", "Intercambios"],
        ["habitacion.html", "Mi habitación"], ["forja.html", "La forja (en Mi habitación)"]] }]
    },
    biblioteca: {
      nombre: "Biblioteca", lema: "Todo lo que se sabe del mundo, estante por estante.", grupos: [
        { titulo: "Mundo", enlaces: [["cronologia.html", "Cronología", "libros"], ["lugares.html", "Lugares", "libros"], ["facciones.html", "Facciones", "libros"], ["personajes.html", "Personajes", "libros"], ["razas.html", "Razas", "libros"], ["religion.html", "Religión", "libros"]] },
        { titulo: "Archivo", enlaces: [["textos.html", "Textos", "libros"], ["pergaminos.html", "Pergaminos", "libros"], ["armas.html", "Armas", "libros"], ["objetos.html", "Objetos", "libros"], ["bestiario.html", "Bestiario", "libros"]] },
        { titulo: "Reglas y cifras", enlaces: [["reglas.html", "Reglas", "libros"], ["economia.html", "Economía", "libros"], ["estadisticas.html", "Estadísticas", "libros"], ["biblioteca.html", "Biblioteca de los jugadores", "libros"], ["compendio.html", "El Compendio completo", "libros"]] }]
    },
    juegos: {
      nombre: "Sala recreativa", lema: "Máquinas y juegos de habilidad. Minijuegos los junta todos.", grupos: [
        { titulo: "Juegos", enlaces: [["minijuegos.html", "Minijuegos", "arcade-ritmo"], ["ajedrez.html", "Ajedrez", "ajedrez"], ["arqueria.html", "Arquería", "diana"], ["ritmo.html", "Zarabanda", "arcade-ritmo"], ["parranda.html", "Parranda", "arcade-parranda"], ["sacrificio.html", "Hooey", "arcade-hooey"],
          ["fractura.html", "La Fractura", "arcade-fractura"], ["duelo.html", "Duelo", "espadas", true], ["ostelar.html", "Ostelar", "trampilla", true], ["estocatta.html", "Estocatta", "arcade-estocatta", true]] }]
    },
    naipes: {
      nombre: "Salón de naipes", lema: "Cartas, dados y apuestas.", grupos: [
        { titulo: "Triunfos", enlaces: [["cartas.html", "Álbum", "cartas"], ["mazos.html", "Mazos", "cartas"], ["batalla.html", "Batalla", "cartas"]] },
        { titulo: "Apuestas", enlaces: [["veintiuna.html", "Las Veintiuna Velas", "cartas"], ["pozo-dragon.html", "El Pozo del Dragón", "pozo"]] }]
    },
    campana: {
      nombre: "Sala de campaña", lema: "Todo lo de las partidas de rol.", grupos: [
        { titulo: "Campaña", enlaces: [["tablero.html", "El Tablero (partidas)", "mesa"], ["mapa.html", "Mapa", "mapa"], ["fichas.html", "Mis personajes", "fichas"], ["cronica.html", "El Registro (crónica)", "libro"], ["discord.html", "Tablón de Discord", "tablon"]] }]
    },
    establos: {
      nombre: "Establos", lema: "Carreras de criaturas y los corrales donde se crían.", grupos: [
        { titulo: "Establos", enlaces: [["hipodromo.html", "Hipódromo", "gradas"], ["hipodromo-vivo.html", "Hipódromo en vivo", "pantalla"], ["corrales.html", "Corrales", "cerca"]] }]
    },
    despacho: {
      nombre: "Despacho", lema: "Solo para el admin.", admin: true, grupos: [
        { titulo: "Despacho", enlaces: [["admin.html", "Panel de Admin", "escritorio", true], ["ritmo-editor.html", "Editor de Zarabanda", "arcade-ritmo", true], ["parranda-editor.html", "Editor de Parranda", "arcade-parranda", true], ["concurso.html", "Concurso: la cabina", "escritorio", true], ["concurso-programa.html", "Concurso: el programa", "escritorio", true]] }]
    }
  };
  const ORDEN = ["taberna", "biblioteca", "juegos", "naipes", "campana", "establos", "despacho"];
  const visible = e => !e[3] || esAdmin();

  /* ---------------------------------------------------------------- navegación */
  let actual = "taberna";
  function salaDeHash() {
    const h = decodeURIComponent((location.hash || "").slice(1));
    return MAPA[h] && !(MAPA[h].admin && !esAdmin()) ? h : "taberna";
  }
  function pintarChips() {
    const nav = $("lbSalasNav");
    if (!nav) return;
    nav.innerHTML = ORDEN.filter(c => !MAPA[c].admin || esAdmin()).map(c =>
      `<a class="lb-chip${c === actual ? " lb-chip-actual" : ""}" href="#${c}"${c === actual ? ' aria-current="page"' : ""}>${esc(MAPA[c].nombre)}</a>`).join("");
  }
  function mostrar() {
    const sala = salaDeHash();
    const hall = $("lbEscena"), caja = $("lbSalas");
    if (!hall || !caja) return;
    actual = sala;
    if (sala === "taberna" || document.body.classList.contains("lb-3d")) { caja.hidden = true; caja.innerHTML = ""; hall.classList.remove("lb-oculta"); }
    else {
      const arte = window.LobbySalasArte && window.LobbySalasArte[sala];
      caja.innerHTML = arte ? arte(MAPA[sala], esAdmin())
        : `<div class="lb-caja lb-sala-lista"><h2>${esc(MAPA[sala].nombre)}</h2><div class="lb-caja-cuerpo lb-lista-links">${MAPA[sala].grupos.flatMap(g => g.enlaces.filter(visible)).map(e => `<a href="${esc(e[0])}">${esc(e[1])}</a>`).join("")}<a href="#taberna">Volver a la taberna</a></div></div>`;
      caja.hidden = false; hall.classList.add("lb-oculta");
      capaEtiquetas(caja.querySelector("svg"));
      if (window.Cielo) window.Cielo.aplicar();   // el cielo y la luz de las salas que tienen ventana
    }
    pintarChips();
    const lema = $("lbSalaLema");
    if (lema) lema.textContent = sala === "taberna" ? "" : `${MAPA[sala].nombre}: ${MAPA[sala].lema || ""}`;
  }

  /* ---------------------------------------------------------------- todas las puertas */
  function pintarZonas() {
    const cont = $("lbZonas");
    if (!cont) return;
    const cajas = [];
    ORDEN.forEach(c => {
      const s = MAPA[c];
      if (s.admin && !esAdmin()) return;
      s.grupos.forEach(g => {
        const enlaces = g.enlaces.filter(visible);
        if (!enlaces.length) return;
        const titulo = c === "taberna" || c === g.titulo.toLowerCase() ? s.nombre : `${s.nombre} · ${g.titulo}`;
        cajas.push(`<div class="lb-caja"><h2>${esc(titulo)}</h2><div class="lb-caja-cuerpo lb-lista-links">${enlaces.map(e => `<a href="${esc(e[0])}">${esc(e[1])}</a>`).join("")}</div></div>`);
      });
    });
    cont.innerHTML = cajas.join("");
  }

  /* Los carteles (el nombre de cada objeto al pasar el ratón o enfocarlo) se pasan a una capa que se pinta la última:
     así ningún mueble que esté dibujado después los tapa. Vale para la taberna y para cada sala. */
  function capaEtiquetas(svg) {
    if (!svg) return;
    const capa = svg.querySelector("#lbEtiquetas, .lb-capa-etq");
    if (!capa) return;
    svg.querySelectorAll("a.lb-spot").forEach(a => {
      const t = a.querySelector("text.lb-etq");
      if (!t) return;
      capa.appendChild(t);
      const ver = () => t.classList.add("lb-etq-ver"), ocultar = () => t.classList.remove("lb-etq-ver");
      a.addEventListener("pointerenter", ver); a.addEventListener("pointerleave", ocultar);
      a.addEventListener("focus", ver); a.addEventListener("blur", ocultar);
    });
  }

  window.LobbyMapa = { MAPA, ORDEN };
  function iniciar() {
    capaEtiquetas($("lbEscena"));
    pintarZonas();
    // En el móvil la escena no se ve (hay puertas grandes): la lista con todos los enlaces va abierta
    const todo = document.querySelector(".lb-todo");
    if (todo && window.matchMedia && matchMedia("(max-width: 700px)").matches) todo.open = true;
    mostrar();
    window.addEventListener("hashchange", mostrar);
    // El rol de admin se sabe un poco después de cargar: se rehacen las listas y la sala cuando cambia
    new MutationObserver(() => { pintarZonas(); mostrar(); }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
