  /* =========================================================================
     PORTADA: el menú principal del juego
  ========================================================================= */
  let portadaAnim = 0;
  async function pintarPortada() {
    ej = null; est = null;
    mostrar("frPortada");
    try { history.replaceState(null, "", PAG_CUARTEL); } catch (e) { /* sin historial */ }
    const menu = $("frPortadaMenu");
    menu.innerHTML = `<button type="button" class="fr-menu-btn principal" data-pm="jugar"><span>Jugar</span><small>Elige un ejército y ve a la guerra</small></button>
      <button type="button" class="fr-menu-btn" data-pm="codex"><span>Códice</span><small>Tropas y Héroes</small></button>
      <button type="button" class="fr-menu-btn" data-pm="ayuda"><span>Cómo se juega</span></button>
      <button type="button" class="fr-menu-btn" data-pm="ajustes"><span>Ajustes</span></button>
      ${document.documentElement.requestFullscreen ? `<button type="button" class="fr-menu-btn" data-pm="pantalla"><span>Pantalla completa</span><small>También con la tecla F</small></button>` : ""}`;
    animarPortada();
    if (FMH) FMH.esAdmin().then(ok => {
      if (!ok || menu.querySelector('[data-pm="musicaHeroes"]')) return;
      const b = document.createElement("button");
      b.type = "button"; b.className = "fr-menu-btn fr-menu-admin"; b.dataset.pm = "musicaHeroes";
      b.innerHTML = `<span>Música de los héroes</span><small>Solo Admin</small>`;
      menu.appendChild(b);
    });
    await cargarEjercitos();
    if (!$("frPortada").classList.contains("hidden")) pintarActivas();
  }

  /* --- Tus guerras: la guardada en este navegador y tus mesas en curso, para entrar directo con su ejército --- */
  async function pintarActivas() {
    const caja = $("frActivas");
    if (!caja) return;
    const tarjetas = [];
    const enCurso = Red.cargarGuerra();
    if (enCurso && enCurso.est.reglas !== D.REGLAS) Red.borrarGuerra();
    else if (enCurso && ejercitos[enCurso.cfg.faccion]) {
      const e = enCurso.est, f = enCurso.cfg.faccion, yo = e.jugadores[0];
      const rivales = e.jugadores.filter(j => j.id !== 0).map(j => j.faccion);
      const fr = enCurso.cfg.frente;
      tarjetas.push({ f, titulo: fr ? fr.titulo : TIPOS_FRACTURA[e.tipo] ? TIPOS_FRACTURA[e.tipo].nombre : "Guerra", sub: `Turno ${e.turno} de ${e.maxTurnos}`, rivales, estado: "Guardada en este navegador", toca: true, attr: `data-activa="local" data-f="${esc(f)}"`, nombre: ejercitos[f].nombre });
      void yo;
    }
    caja.innerHTML = tarjetas.length ? htmlActivas(tarjetas, true) : "";
    caja.classList.toggle("hidden", !tarjetas.length);
    // Las mesas necesitan sesión: se piden aparte para no frenar la portada
    let s = null;
    try { s = await Red.sesion(); } catch (e) { s = null; }
    if (!s) return;
    let mesas = [];
    try { mesas = await Red.mesasLista(); } catch (e) { return; }
    if ($("frPortada").classList.contains("hidden")) return;
    const uid = s.user.id;
    mesas.filter(m => m.mia && ["activa", "disputa", "abierta"].includes(m.estado) && (m.config || {}).reglas === D.REGLAS).forEach(m => {
      const asiento = (m.asientos || []).find(a => String(a.user) === String(uid)) || {};
      const f = asiento.faccion;
      if (!f || !FACCIONES[f]) return;
      const humanos = (m.config || {}).humanos || [];
      const toca = m.estado === "activa" && humanos[m.activo] === uid;
      const rivales = (m.bandos || (m.asientos || []).map(a => ({ faccion: a.faccion }))).map(b => b.faccion).filter((x, i, l) => x && (x !== f || l.indexOf(x) !== i));
      const estado = m.estado === "abierta" ? "Esperando jugadores" : m.estado === "disputa" ? "El final está en disputa" : toca ? "Te toca" : `Juega ${esc((m.asientos || []).find(a => String(a.user) === String(humanos[m.activo])) ? (m.asientos.find(a => String(a.user) === String(humanos[m.activo])).nombre || "otro jugador") : "la máquina")}`;
      tarjetas.push({ f, titulo: m.nombre || "Mesa", sub: m.estado === "abierta" ? `${(m.asientos || []).length} de ${(m.config || {}).plazas || "?"} sillas` : `Turno ${Math.max(1, Math.floor((m.turnos || 0) / Math.max(1, ((m.bandos || []).length) || 2)) + 1)}`, rivales, estado, toca,
        attr: m.estado === "abierta" ? `data-activa="sala" data-f="${esc(f)}"` : `data-activa="mesa" data-mesa="${esc(m.id)}" data-f="${esc(f)}"`, nombre: ejercitos[f] ? ejercitos[f].nombre : FACCIONES[f].nombre });
    });
    tarjetas.sort((a, b) => (b.toca ? 1 : 0) - (a.toca ? 1 : 0));
    caja.innerHTML = tarjetas.length ? htmlActivas(tarjetas) : "";
    caja.classList.toggle("hidden", !tarjetas.length);
  }
  function htmlActivas(tarjetas) {
    return `<h2 class="fr-activas-titulo">Tus guerras</h2><div class="fr-activas-lista">${tarjetas.slice(0, 6).map(t => {
      const F = FACCIONES[t.f];
      return `<button type="button" class="fr-activa${t.toca ? " toca" : ""}" ${t.attr} style="--c:${F.color};--b:${F.bandera}">
        <span class="fr-activa-ret">${retLider(t.f, 64, "fr-activa-img")}</span>
        <span class="fr-activa-txt"><b>${esc(t.titulo)}</b><small>${esc(t.nombre)} · ${esc(t.sub)}</small>
          <span class="fr-activa-rivales">contra ${t.rivales.slice(0, 5).map(r => `<i style="--c:${FACCIONES[r] ? FACCIONES[r].color : "#888"}" title="${esc(FACCIONES[r] ? FACCIONES[r].nombre : r)}">${esc(FACCIONES[r] ? FACCIONES[r].corto : r)}</i>`).join("") || "<i>la máquina</i>"}</span></span>
        <span class="fr-activa-estado">${esc(t.estado)}</span>
      </button>`;
    }).join("")}</div>`;
  }
  $("frPortadaMenu").addEventListener("click", ev => {
    const b = ev.target.closest("[data-pm]");
    if (!b) return;
    son("clic");
    const m = b.dataset.pm;
    if (m === "jugar") pantallaInicio();
    else if (m === "codex") abrircodex();
    else if (m === "ayuda") abrirAyuda();
    else if (m === "ajustes") abrirAjustes();
    else if (m === "pantalla") pantallaCompleta();
    else if (m === "musicaHeroes" && FMH) FMH.abrir();
  });
  $("frAPortada").addEventListener("click", pintarPortada);
  $("frActivas").addEventListener("click", async ev => {
    const b = ev.target.closest("[data-activa]");
    if (!b) return;
    son("clic");
    const f = b.dataset.f;
    if (b.dataset.activa === "local") irAGuerra({ f });
    else if (b.dataset.activa === "mesa") irAGuerra({ f, mesa: b.dataset.mesa });
    else if (ejercitos[f]) { ej = ejercitos[f]; entrarCuartel("duelos"); }
  });

  /* El fondo de la portada: los líderes de los trece ejércitos en fila, sobre el horizonte */
  function animarPortada() {
    const cv = $("frPortadaFondo");
    cancelAnimationFrame(portadaAnim);
    if (!FF) return;
    const ids = Object.keys(FACCIONES);
    let ultimo = 0;
    const paso = ahora => {
      if ($("frPortada").classList.contains("hidden")) return;
      portadaAnim = requestAnimationFrame(paso);
      if (ahora - ultimo < 66) return;
      ultimo = ahora;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5), w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const g = cv.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cielo = g.createLinearGradient(0, 0, 0, h);
      cielo.addColorStop(0, "#0a0812"); cielo.addColorStop(0.55, "#1c1424"); cielo.addColorStop(0.8, "#3a2230"); cielo.addColorStop(1, "#120d16");
      g.fillStyle = cielo; g.fillRect(0, 0, w, h);
      // la grieta de luz en el cielo
      const t = ahora / 1000, gx = w * 0.5;
      const luz = g.createRadialGradient(gx, h * 0.3, 4, gx, h * 0.3, h * 0.7);
      luz.addColorStop(0, "rgba(240,210,120,.30)"); luz.addColorStop(0.4, "rgba(185,140,255,.10)"); luz.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = luz; g.fillRect(0, 0, w, h);
      g.strokeStyle = `rgba(255,236,170,${0.5 + 0.2 * Math.sin(t * 1.3)})`; g.lineWidth = 2; g.lineJoin = "round";
      g.beginPath(); g.moveTo(gx - 6, 0); [[8, 0.08], [-14, 0.16], [10, 0.24], [-6, 0.33], [4, 0.42]].forEach(([dx, fy]) => g.lineTo(gx + dx, h * fy)); g.stroke();
      // sierra al fondo y suelo
      g.fillStyle = "#17111c"; g.beginPath(); g.moveTo(0, h * 0.78);
      for (let i = 0; i <= 24; i++) g.lineTo((i / 24) * w, h * (0.78 - 0.1 * Math.abs(Math.sin(i * 1.7)) - 0.04 * Math.sin(i * 0.6)));
      g.lineTo(w, h); g.lineTo(0, h); g.fill();
      g.fillStyle = "#0c0910"; g.fillRect(0, h * 0.86, w, h * 0.14);
      const n = ids.length, s = Math.min(w / (n * 0.62), h * 0.2), ancho = Math.min(w * 0.96, n * s * 0.7);
      ids.forEach((f, i) => {
        const x = (w - ancho) / 2 + (i + 0.5) * (ancho / n), y = h * 0.93 + Math.sin(i * 2.1) * 4;
        FF.figura(g, { faccion: f, clase: "lider" }, Object.assign(FF.colorFaccion(f), { faccion: f }), { x, y, s, dir: i < n / 2 ? 1 : -1, t, bob: Math.sin(t * 1.4 + i) * 0.6, sinAro: true });
      });
      const velo = g.createLinearGradient(0, h * 0.5, 0, h); velo.addColorStop(0, "rgba(10,8,14,0)"); velo.addColorStop(1, "rgba(10,8,14,.55)");
      g.fillStyle = velo; g.fillRect(0, h * 0.5, w, h * 0.5);
      // ceniza que sube
      g.fillStyle = "rgba(255,190,110,.5)";
      for (let i = 0; i < 26; i++) { const px = ((i * 137.5) % 100) / 100 * w + Math.sin(t * 0.6 + i) * 12, py = h - ((t * (10 + (i % 5) * 6) + i * 53) % h); g.fillRect(px, py, 1.6, 1.6); }
    };
    portadaAnim = requestAnimationFrame(paso);
  }


  /* =========================================================================
     ELEGIR O FUNDAR UN EJÉRCITO
  ========================================================================= */
  async function pantallaInicio() {
    ej = null; est = null;
    mostrar("frInicio");
    await cargarEjercitos();
    $("frEjercitos").innerHTML = Object.keys(FACCIONES).map((f, i) => {
      const fac = FACCIONES[f], e = ejercitos[f];
      const filas = e ? C.enFila(e).length : 0;
      const estrella = e ? C.enFila(e).slice().sort((a, b) => b.victorias - a.victorias || a.nacimiento - b.nacimiento)[0] : null;
      return `<article class="fr-ejercito${e ? " fr-fundado" : ""}" style="--c:${fac.color};--b:${fac.bandera};--i:${i}">
        <span class="fr-pendon"></span>
        <div class="fr-ejercito-ret">${retrFaccion(f, 132, true)}</div>
        <div class="fr-ejercito-cuerpo">
          <h3>${esc(fac.nombre)}</h3>
          <p class="fr-ejercito-titulo">${esc(fac.lider.titulo)} <span class="fr-curva" title="${esc(CURVA_TEXTO[fac.curva] || "")}">${esc(fac.curva)}</span></p>
          <p class="fr-ejercito-resumen">${esc(fac.resumen)}</p>
          <div class="fr-ejercito-tropas">${tropasDeFac(f).map(cl => `<span title="${esc(D.tropa(f, cl).nombre)}">${figHtml({ faccion: f, clase: cl, sinAro: true }, 34, 42)}</span>`).join("")}${fac.heroe.slice(0, 1).map(h => `<span class="heroe" title="Héroe: ${esc(HEROES[h].nombre)}">${figHtml({ faccion: f, clase: "heroe", heroe: h, sinAro: true }, 40, 48)}</span>`).join("")}</div>
          <p class="fr-ejercito-ventaja"><strong>Ventaja.</strong> ${esc(fac.ventaja)}</p>
          ${e ? `<p class="fr-ejercito-datos">${esc(e.nombre)} · ${e.guerras} guerra${e.guerras === 1 ? "" : "s"} (${e.ganadas} ganadas) · ${filas} en filas · año ${e.anio}</p>` : ""}
          <div class="fr-fila">${e ? `<button type="button" class="fr-btn fr-btn-principal" data-entrar="${f}">Entrar al cuartel</button>` : `<button type="button" class="fr-btn" data-fundar="${f}">Fundar este ejército</button>`}
            <button type="button" class="fr-btn fr-btn-chico" data-codex="${f}">Ver tropas</button></div>
        </div>
      </article>`;
    }).join("");
    $("frEjercitos").classList.add("fr-entra");
    pintarRetratos($("frEjercitos"));
    pintarFiguras($("frEjercitos"));
  }

  $("frEjercitos").addEventListener("click", async ev => {
    const f = ev.target.closest("[data-fundar]"), e = ev.target.closest("[data-entrar]"), cod = ev.target.closest("[data-codex]");
    if (cod) { abrircodex(cod.dataset.codex); return; }
    if (f) {
      const id = f.dataset.fundar;
      const nombreEj = await dialogo.pedir(`Nombre del ejército de ${FACCIONES[id].corto}`, `Ejército de ${FACCIONES[id].corto}`);
      if (nombreEj === null) return;
      ej = C.crearEjercito(id, nombreEj);
      ejercitos[id] = ej;
      await guardar();
      entrarCuartel();
    } else if (e) { ej = ejercitos[e.dataset.entrar]; entrarCuartel(); }
  });

  /* =========================================================================
     CUARTEL
  ========================================================================= */
  function entrarCuartel(p) {
    if (!ej) return pintarPortada();
    pestana = p || pestana || "guerra";
    est = null;
    mostrar("frCuartel");
    try { history.replaceState(null, "", `${PAG_CUARTEL}?f=${encodeURIComponent(ej.faccion)}&p=${pestana}`); } catch (e) { /* sin historial */ }
pintarHero();
        document.querySelectorAll("#frPestanas button").forEach(b => b.classList.toggle("activa", b.dataset.p === pestana));
    pintarVista();
  }
  $("frHero").addEventListener("click", async ev => {
    if (ev.target.closest("[data-atras]")) { pantallaInicio(); return; }
    if (ev.target.closest("[data-renombrar]")) {
      const n = await dialogo.pedir("Nuevo nombre del ejército", ej.nombre);
      if (n === null) return;
      C.renombrarEjercito(ej, n); await guardar(); entrarCuartel();
    }
  });
  $("frPestanas").addEventListener("click", ev => { const b = ev.target.closest("button[data-p]"); if (b) entrarCuartel(b.dataset.p); });

  /* La cabecera del ejército: su soldado más condecorado, las cifras y la ceniza que sube */
  function pintarHero() {
    const fac = FACCIONES[ej.faccion];
    const filas = C.enFila(ej);
    const estrella = filas.slice().sort((a, b) => b.victorias - a.victorias || a.nacimiento - b.nacimiento)[0];
    const pl = (n, uno, varios) => (n === 1 ? uno : varios);
    const nCaidos = C.caidos(ej).length, nRel = C.reliquiasDe(ej).length, nCasas = C.casas(ej).length;
    const cifras = [[ej.guerras, pl(ej.guerras, "guerra", "guerras")], [ej.ganadas, pl(ej.ganadas, "victoria", "victorias")], [filas.length, "en filas"], [nCaidos, pl(nCaidos, "caído", "caídos")], [nRel, pl(nRel, "reliquia", "reliquias")], [nCasas, pl(nCasas, "casa", "casas")]];
    const cenizas = Array.from({ length: 16 }, (_, i) => `<i style="left:${(i * 37 + 11) % 96}%;animation-delay:-${((i * 1.3) % 9).toFixed(1)}s;animation-duration:${8 + (i % 4)}s;--dx:${((i * 53) % 60) - 30}px;width:${2 + (i % 3)}px;height:${2 + (i % 3)}px"></i>`).join("");
    $("frHero").innerHTML = `<div class="fr-hero" style="--c:${fac.color};--b:${fac.bandera}">
      <i class="fr-esq"></i><i class="fr-esq"></i><i class="fr-esq"></i><i class="fr-esq"></i>
      <span class="fr-hero-banda"></span>
      <div class="fr-hero-ceniza" aria-hidden="true">${cenizas}</div>
      <div class="fr-hero-ret">${retrFaccion(ej.faccion, 170, true)}
        <span>${estrella ? `Su mejor soldado: ${esc(nombre(estrella))}, ${estrella.victorias} victoria${estrella.victorias === 1 ? "" : "s"}` : "Sin soldados"}</span></div>
      <div class="fr-hero-texto">
        <p class="fr-hero-sobre">Año ${ej.anio} de la Fractura</p>
        <h2 class="fr-hero-nombre">${esc(ej.nombre)}</h2>
        <p class="fr-hero-faccion">${esc(fac.nombre)} · ${esc(fac.lider.titulo)}</p>
        <div class="fr-hero-cifras">${cifras.map(([n, t]) => `<div><b>${n}</b>${t}</div>`).join("")}</div>
      </div>
      <div class="fr-hero-botones"><button type="button" class="fr-btn" data-atras>← Ejércitos</button><button type="button" class="fr-btn fr-btn-chico" data-renombrar>Renombrar</button></div>
    </div>`;
    pintarRetratos($("frHero"));
  }

  function pintarVista() {
    const v = $("frVista");
    const fn = { guerra: vistaGuerra, duelos: vistaDuelos, soldados: vistaSoldados, casas: vistaCasas, reliquias: vistaReliquias, salon: vistaSalon, cronicas: vistaCronicas, mundo: vistaMundo }[pestana];
    fn(v, true);
  }

  /* --- Pestaña: Guerra (preparar) --- */
  const DESC_DIF = { facil: "El rival duda y se equivoca a menudo.", normal: "El rival juega con cabeza.", dificil: "El rival no se equivoca y recibe un 25 % más de recursos." };
  function barraTerreno(t) {
    if (t === "azar") return `<span class="fr-barra-terreno">${["#8a9a4b", "#a39c8a", "#3f6b3a", "#8f5bc4", "#c9a96a", "#3b6a9c"].map(c => `<i style="flex:1;background:${c}"></i>`).join("")}</span>`;
    const T = TIPOS_FRACTURA[t].terrenos;
    return `<span class="fr-barra-terreno">${Object.keys(T).filter(k => T[k] > 0).map(k => `<i style="flex:${T[k]};background:${D.TERRENOS[k] ? D.TERRENOS[k].color : "#222"}"></i>`).join("")}</span>`;
  }

  function vistaGuerra(v, primera) {
    v.classList.toggle("fr-entra", !!primera);
    const lim = C.limiteContingente(ej);
    const disp = C.disponibles(ej);
    if (!ajustesGuerra.ids) ajustesGuerra.ids = C.elegirContingenteAuto(ej);
    ajustesGuerra.ids = ajustesGuerra.ids.filter(id => ej.soldados[id] && disp.includes(ej.soldados[id])).slice(0, lim);
    const pend = C.pendientesDeAscenso(ej);
    const heridos = C.enFila(ej).filter(s => C.convaleciente(ej, s));
    const elegidos = ajustesGuerra.ids.map(id => ej.soldados[id]);
    const reserva = disp.filter(s => !ajustesGuerra.ids.includes(s.id)).sort((a, b) => b.victorias - a.victorias);
    // lo que lleva el contingente, de un vistazo
    const porClase = {};
    elegidos.forEach(s => { porClase[s.clase] = (porClase[s.clase] || 0) + 1; });
    const caps = elegidos.filter(s => s.capitan).map(s => ROM[s.compania]);
    const chips = Object.keys(porClase).map(k => `<span>${porClase[k]} × ${esc(D.tropa(ej.faccion, k).nombre)}</span>`)
      .concat([`<span>${elegidos.reduce((a, s) => a + s.victorias, 0)} victorias entre todos</span>`], caps.length ? [`<span>Capitanes: ${caps.join(", ")}</span>`] : []).join("");
    let n = 0;
    const slots = Array.from({ length: lim }, (_, i) => elegidos[i]
      ? carta(elegidos[i], { pon: "quita", i: n++ })
      : `<div class="fr-slot-vacio" style="--i:${Math.min(n++, 14)}"><span>+</span><small>Libre</small></div>`).join("");
    const tipos = ["azar"].concat(Object.keys(TIPOS_FRACTURA));
    const rivales = ["azar"].concat(Object.keys(FACCIONES).filter(f => f !== ej.faccion));
    const tipoTexto = ajustesGuerra.tipo === "azar" ? "Cada guerra cae en un tipo distinto." : TIPOS_FRACTURA[ajustesGuerra.tipo].texto;
    const rivalFac = ajustesGuerra.rival !== "azar" ? FACCIONES[ajustesGuerra.rival] : null;
    if (ajustesGuerra.rival !== "azar" && (!FACCIONES[ajustesGuerra.rival] || ajustesGuerra.rival === ej.faccion)) ajustesGuerra.rival = "azar";
    const nb = ajustesGuerra.bandos || 2;
    if (!(ajustesGuerra.mapaPara >= nb)) ajustesGuerra.mapaPara = nb;
    const MPara = Math.min(8, ajustesGuerra.mapaPara);
    if (!(nb >= 4 && nb % 2 === 0)) ajustesGuerra.equipos = false;
    const formas = ["azar"].concat(Object.keys(D.FORMAS_MAPA));
    if (!formas.includes(ajustesGuerra.forma)) ajustesGuerra.forma = "azar";
    // Los frentes: guerras ya montadas, las que dan cartas
    const frentes = window.FracturaFrentes ? window.FracturaFrentes.abiertos() : [];
    if (ajustesGuerra.frente === undefined) ajustesGuerra.frente = frentes.length ? frentes[0].clave : null;
    if (ajustesGuerra.frente && !frentes.some(f => f.clave === ajustesGuerra.frente)) ajustesGuerra.frente = frentes.length ? frentes[0].clave : null;
    const frenteSel = frentes.find(f => f.clave === ajustesGuerra.frente) || null;
    if (cobrados === null) {
      cobrados = new Set();
      Red.frentesEstado().then(r => {
        cobrados = new Set(r.cobrados); frentesInfo = { intentos: r.intentos || {}, hoy: r.hoy || 0 };
        if (pestana === "guerra" && !$("frCuartel").classList.contains("hidden")) vistaGuerra($("frVista"));
      });
    }
    const NIV = window.FracturaFrentes ? window.FracturaFrentes.NIVELES : {};
    const tarjetaFrente = (f, i) => {
      const riv = window.FracturaFrentes.rivalesPara(f, ej.faccion), cobrado = cobrados.has(f.clave);
      const gastados = frentesInfo.intentos[f.clave] || 0, sinIntentos = gastados >= INTENTOS_FRENTE, tope = frentesInfo.hoy >= CARTAS_FRENTES_DIA;
      const estadoPremio = cobrado ? "Ya lo cobraste. Puedes jugarlo otra vez, pero no da más cartas." : sinIntentos ? "Gastaste los 2 intentos. Puedes jugarlo, pero ya no da carta."
        : tope ? "Hoy ya te llevaste 2 cartas de los frentes. Puedes jugarlo sin premio." : `${esc(NIV[f.nivel].texto)} Intentos: ${INTENTOS_FRENTE - gastados} de ${INTENTOS_FRENTE}.`;
      return `<button type="button" class="fr-opcion fr-frente${ajustesGuerra.frente === f.clave ? " sel" : ""}${cobrado || sinIntentos || tope ? " cobrado" : ""}" data-aj="frente" data-v="${f.clave}" style="--i:${i}">
        <span class="fr-frente-mapa"><canvas class="fr-frente-mini" data-frente="${f.clave}" width="320" height="150"></canvas><em class="fr-frente-premio n-${f.nivel}">${esc(NIV[f.nivel].premio)}</em></span>
        <span class="fr-frente-rivales">${riv.map(x => `<span style="--c:${FACCIONES[x].color}" title="${esc(FACCIONES[x].nombre)}">${retLider(x, 30)}</span>`).join("")}</span>
        <span class="fr-frente-texto"><strong>${esc(f.titulo)}</strong>
          <small>${esc(TIPOS_FRACTURA[f.tipo].nombre)} · ${esc(D.FORMAS_MAPA[f.forma].nombre)} · mapa ${esc(window.FracturaMapa.TAMANO_MAPA[f.tamano || "normal"].nombre.toLowerCase())} para ${f.mapaPara || f.bandos}</small>
          <small>${f.bandos} bandos${f.equipos ? " en dos equipos" : ""} · ${esc(DIFICULTADES[f.dificultad].nombre)} · contra ${esc(riv.slice(0, 3).map(x => FACCIONES[x].corto).join(", "))}${riv.length > 3 ? ` y ${riv.length - 3} más` : ""}</small>
          <small>${estadoPremio}</small>
          <small class="fr-frente-queda">${f.semanal ? "Toda la semana" : "Solo hoy"} · cambia en ${esc(window.FracturaFrentes.quedan(f))}</small></span></button>`;
    };
    const sinMar = ajustesGuerra.tipo === "horizonte";
    const fm = ajustesGuerra.forma !== "azar" ? D.FORMAS_MAPA[ajustesGuerra.forma] : null;
    const mar = !!(fm && fm.maritimo && !sinMar);
    const med = window.FracturaMapa.medidas(MPara, ajustesGuerra.tamano, mar);
    const formaTexto = sinMar ? "El Horizonte Roto no tiene mar: sus fragmentos flotan en el vacío, elijas la forma que elijas."
      : fm ? `${fm.texto}${fm.maritimo ? " Todos empiezan con un muelle." : ""}` : "Cada guerra, un mapa distinto: a veces tierra firme, a veces islas.";
    v.innerHTML = `
      ${pend.length ? `<div class="fr-banner"><p><strong>${pend.length} veterano${pend.length === 1 ? "" : "s"} esperan una especialización.</strong> Elígela en su ficha antes de partir.</p>
        <div class="fr-fila">${pend.map(s => `<button type="button" class="fr-btn fr-btn-chico" data-ficha="${s.id}">${esc(nombre(s))}</button>`).join("")}</div></div>` : ""}
      <div class="fr-preparar">
        <div class="fr-prep-col">
          <section class="fr-formacion">
            <div class="fr-seccion-cab">
              <h3 class="fr-h3">Contingente <b class="fr-cuenta">${elegidos.length} / ${lim}</b></h3>
              <div class="fr-fila"><button type="button" class="fr-btn fr-btn-chico" data-auto>Elegir los mejores</button><button type="button" class="fr-btn fr-btn-chico" data-ninguno>Vaciar</button></div>
            </div>
            <p class="fr-sub">Solo los que van a la guerra pueden ganar experiencia, o morir. Toca una carta para sacarla o meterla. Sube el máximo ganando guerras.</p>
            <div class="fr-slots">${slots}</div>
            <div class="fr-chips">${chips}</div>
            ${elegidos.length ? "" : `<p class="fr-sub">Si no llevas a nadie, la compañía recibe reclutas para llegar a seis.</p>`}
          </section>
          <section class="fr-reserva">
            <h3 class="fr-h3">En reserva (${reserva.length})</h3>
            <div class="fr-cartas fr-cartas-chicas">${reserva.map((s, i) => carta(s, { pon: "lleva", i: i + lim })).join("") || `<p class="fr-vacio">${disp.length ? "Todos van a la guerra." : "No hay nadie disponible."}</p>`}</div>
            ${heridos.length ? `<h3 class="fr-h3">Convalecientes (${heridos.length})</h3><p class="fr-sub">No pueden ir hasta que se recuperen.</p>
              <div class="fr-cartas fr-cartas-chicas">${heridos.map((s, i) => carta(s, { ver: true, bloq: true, i })).join("")}</div>` : ""}
          </section>
        </div>
        <aside class="fr-mision">
          <h3 class="fr-h3">Frentes abiertos</h3>
          <p class="fr-sub">Guerras ya montadas contra la máquina. Todos los jugadores ven las mismas. Cada frente da 2 intentos y, como mucho, te llevas ${CARTAS_FRENTES_DIA} cartas al día: elige cuáles. <b class="fr-cuenta">Hoy: ${frentesInfo.hoy} de ${CARTAS_FRENTES_DIA}</b></p>
          <div class="fr-frentes">${frentes.map(tarjetaFrente).join("")}</div>
          <button type="button" class="fr-opcion fr-libre${frenteSel ? "" : " sel"}" data-aj="frente" data-v=""><strong>Guerra libre</strong><small>El lugar, el mapa, los bandos y el rival, a tu gusto. No da cartas.</small></button>
          ${frenteSel ? "" : `<h3 class="fr-h3">La guerra libre</h3>
          <div class="fr-mision-bloque">
            <h4 class="fr-h4">Lugar de la Fractura</h4>
            <div class="fr-opciones">${tipos.map((t, i) => `<button type="button" class="fr-opcion${ajustesGuerra.tipo === t ? " sel" : ""}" data-aj="tipo" data-v="${t}" style="--i:${i}"><strong>${t === "azar" ? "Al azar" : esc(TIPOS_FRACTURA[t].nombre)}</strong>${barraTerreno(t)}</button>`).join("")}</div>
            <p class="fr-sub" id="frTextoTipo">${esc(tipoTexto)}</p>
          </div>
          <div class="fr-mision-bloque">
            <h4 class="fr-h4">Forma del mapa</h4>
            <div class="fr-opciones fr-formas">${formas.map((f, i) => `<button type="button" class="fr-opcion fr-forma${ajustesGuerra.forma === f ? " sel" : ""}" data-aj="forma" data-v="${f}" style="--i:${i}">${f === "azar" ? `<span class="fr-forma-azar">?</span>` : `<canvas class="fr-forma-mini" data-forma="${f}" width="132" height="108"></canvas>`}<strong>${f === "azar" ? "Al azar" : esc(D.FORMAS_MAPA[f].nombre)}</strong>${f !== "azar" && D.FORMAS_MAPA[f].maritimo ? "<small>de mar</small>" : ""}</button>`).join("")}</div>
            <p class="fr-sub">${esc(formaTexto)}</p>
          </div>
          <div class="fr-mision-bloque">
            <h4 class="fr-h4">Bandos</h4>
            <div class="fr-segmentos">${[2, 3, 4, 5, 6, 7, 8].map(n => `<button type="button" class="fr-opcion${nb === n ? " sel" : ""}" data-aj="bandos" data-v="${n}">${n}</button>`).join("")}</div>
            ${nb >= 4 && nb % 2 === 0 ? `<div class="fr-segmentos"><button type="button" class="fr-opcion${!ajustesGuerra.equipos ? " sel" : ""}" data-aj="equipos" data-v="0">Todos contra todos</button><button type="button" class="fr-opcion${ajustesGuerra.equipos ? " sel" : ""}" data-aj="equipos" data-v="1">Dos equipos</button></div>` : ""}
          </div>
          <div class="fr-mision-bloque">
            <h4 class="fr-h4">Mapa</h4>
            <div class="fr-segmentos">${Object.keys(window.FracturaMapa.TAMANO_MAPA).map(t => `<button type="button" class="fr-opcion${ajustesGuerra.tamano === t ? " sel" : ""}" data-aj="tamano" data-v="${t}">${esc(window.FracturaMapa.TAMANO_MAPA[t].nombre)}</button>`).join("")}</div>
            <div class="fr-segmentos fr-mapa-para"><span>Para</span>${[2, 3, 4, 5, 6, 7, 8].filter(n => n >= nb).map(n => `<button type="button" class="fr-opcion${MPara === n ? " sel" : ""}" data-aj="mapaPara" data-v="${n}">${n}</button>`).join("")}<span>bandos</span></div>
            <p class="fr-sub">Mapa de ${med.w} por ${med.h} casillas${MPara > nb ? `, hecho para ${MPara} bandos: las capitales que sobran quedan como ciudades libres` : ""} · hasta ${window.FracturaMapa.turnosDe(MPara, mar, ajustesGuerra.tamano)} turnos${nb > 2 ? ` · tregua los 3 primeros turnos. ${ajustesGuerra.equipos ? "Los aliados comparten lo que ven y no se atacan." : "Quien pierde su capital queda fuera."}` : "."}</p>
          </div>
          <div class="fr-mision-bloque">
            <h4 class="fr-h4">${nb > 2 ? "Rival principal" : "Rival"}</h4>
            <div class="fr-opciones">${rivales.map((f, i) => f === "azar"
              ? `<button type="button" class="fr-opcion fr-rival${ajustesGuerra.rival === f ? " sel" : ""}" data-aj="rival" data-v="azar" style="--i:${i}"><span class="fr-rival-azar">?</span><strong>Al azar</strong></button>`
              : `<button type="button" class="fr-opcion fr-rival${ajustesGuerra.rival === f ? " sel" : ""}" data-aj="rival" data-v="${f}" style="--c:${FACCIONES[f].color};--b:${FACCIONES[f].bandera};--i:${i}"><span class="fr-rival-ret">${figHtml({ faccion: f, clase: "lider", sinAro: true }, 40, 46)}</span><strong>${esc(FACCIONES[f].corto)}</strong></button>`).join("")}</div>
            ${rivalFac ? `<p class="fr-sub">${esc(rivalFac.resumen)}</p>` : `<p class="fr-sub">Cada guerra te toca contra un bando distinto.</p>`}${nb > 2 ? `<p class="fr-sub">Los otros ${nb - 2} bando${nb === 3 ? "" : "s"} salen al azar.</p>` : ""}
          </div>
          <div class="fr-mision-bloque">
            <h4 class="fr-h4">Dificultad</h4>
            <div class="fr-segmentos">${Object.keys(DIFICULTADES).map(d => `<button type="button" class="fr-opcion${ajustesGuerra.dificultad === d ? " sel" : ""}" data-aj="dificultad" data-v="${d}">${DIFICULTADES[d].nombre}</button>`).join("")}</div>
            <p class="fr-sub">${esc(DESC_DIF[ajustesGuerra.dificultad] || "")}</p>
          </div>
          `}
          ${ej.nemesis.length ? `<p class="fr-nemesis"><strong>Némesis.</strong> ${ej.nemesis.map(x => esc(`${x.nombre} ${x.casa}`)).join(", ")} te espera${ej.nemesis.length === 1 ? "" : "n"} en alguna parte.</p>` : ""}
          <button type="button" class="fr-empezar" data-empezar><span>${frenteSel ? "Ir al frente" : "Empezar la guerra libre"}</span><small>${frenteSel ? `${esc(frenteSel.titulo)} · ${elegidos.length} de ${lim} soldados · ${frenteSel.bandos} bandos · ${DIFICULTADES[frenteSel.dificultad].nombre}` : `${elegidos.length} de ${lim} soldados · ${nb} bandos · ${DIFICULTADES[ajustesGuerra.dificultad].nombre} · sin premio`}</small></button>
        </aside>
      </div>`;
    pintarRetratos(v);
    pintarFiguras(v);
    pintarFormas(v, nb, frentes);
  }

  /* Miniaturas de las formas de mapa: un mapa de verdad de esa forma, pintado en pequeño */
  const miniFormas = new Map();
  function pintarFormas(raiz, nb, frentes) {
    const COL = { llanura: "#6f8a44", bosque: "#3f6b3a", montana: "#8a8276", desierto: "#c8a567", agua: "#3f8fa0", magica: "#8a6ac0", huesos: "#a39c8a", vacio: "#0d2a3d" };
    raiz.querySelectorAll("canvas[data-forma], canvas[data-frente]").forEach(cv => {
      // Una forma se enseña con un mapa de ejemplo; un frente, con su mapa de verdad; una mesa nueva, con el mapa que tendrá
      const fr = cv.dataset.frente ? (frentes || []).find(f => f.clave === cv.dataset.frente) : null;
      if (cv.dataset.frente && !fr) return;
      const mm = cv.dataset.mesaMapa ? cv.dataset : null;
      const clave = fr ? `f:${fr.clave}` : mm ? `m:${mm.tipo}:${mm.forma}:${mm.para}:${mm.tamano}` : `${cv.dataset.forma}:${nb}`;
      let m = miniFormas.get(clave);
      if (!m && mm) { m = window.FracturaMapa.generarMapa(77, mm.tipo, { bandos: +mm.para, forma: mm.forma, tamano: mm.tamano }); miniFormas.set(clave, m); }
      if (!m) { m = fr ? window.FracturaMapa.generarMapa(fr.semilla, fr.tipo, { bandos: fr.mapaPara || fr.bandos, forma: fr.forma, tamano: fr.tamano }) : window.FracturaMapa.generarMapa(77, "reinos", { bandos: nb, forma: cv.dataset.forma }); miniFormas.set(clave, m); }
      const g = cv.getContext("2d"), k = Math.min(cv.width / m.ancho, cv.height / m.alto), ox = (cv.width - m.ancho * k) / 2, oy = (cv.height - m.alto * k) / 2;
      g.fillStyle = COL.vacio; g.fillRect(0, 0, cv.width, cv.height);
      for (let y = 0; y < m.alto; y++) for (let x = 0; x < m.ancho; x++) { const t = m.casillas[y][x].t; if (t === "vacio") continue; g.fillStyle = COL[t] || COL.llanura; g.fillRect(ox + x * k, oy + y * k, k + 0.6, k + 0.6); }
      m.sitios.forEach(q => { g.fillStyle = "#e9e2cf"; g.fillRect(ox + q.x * k + k * 0.15, oy + q.y * k + k * 0.15, k * 0.7, k * 0.7); });
      m.capitales.forEach((q, i) => { g.fillStyle = "#0a0810"; g.beginPath(); g.arc(ox + (q.x + 0.5) * k, oy + (q.y + 0.5) * k, k * 1.1, 0, 7); g.fill(); g.fillStyle = FF.PALETA_BANDOS[i % 8]; g.beginPath(); g.arc(ox + (q.x + 0.5) * k, oy + (q.y + 0.5) * k, k * 0.8, 0, 7); g.fill(); });
      g.fillStyle = "#fff0b0"; g.fillRect(ox + m.nucleo.x * k, oy + m.nucleo.y * k, k, k);
    });
  }

  function alternarContingente(id) {
    const lim = C.limiteContingente(ej);
    const lista = ajustesGuerra.ids.filter(x => x !== id);
    if (lista.length === ajustesGuerra.ids.length) {
      if (lista.length >= lim) { aviso(`El contingente es de ${lim} como máximo. Saca a alguien antes.`, true); return; }
      lista.push(id);
    }
    ajustesGuerra.ids = lista;
    vistaGuerra($("frVista"));
  }

  $("frVista").addEventListener("keydown", ev => {
    if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches && ev.target.matches(".fr-carta[tabindex]")) { ev.preventDefault(); ev.target.click(); }
  });

  $("frVista").addEventListener("click", async ev => {
    const t = ev.target;
    if (t.closest("[data-auto]")) { ajustesGuerra.ids = C.elegirContingenteAuto(ej); vistaGuerra($("frVista")); return; }
    if (t.closest("[data-ninguno]")) { ajustesGuerra.ids = []; vistaGuerra($("frVista")); return; }
    if (t.closest("[data-empezar]")) { empezarGuerra(); return; }
    const f = t.closest("[data-ficha]");
    if (f) { abrirFicha(f.dataset.ficha); return; }
    const pon = t.closest("[data-pon]");
    if (pon) { alternarContingente(pon.dataset.pon); return; }
    const aj = t.closest("[data-aj]");
    if (aj) { const k = aj.dataset.aj; ajustesGuerra[k] = k === "bandos" || k === "mapaPara" ? +aj.dataset.v : k === "equipos" ? aj.dataset.v === "1" : k === "frente" ? (aj.dataset.v || null) : aj.dataset.v; son("clic"); vistaGuerra($("frVista")); return; }
    const casa = t.closest("[data-casa]");
    if (casa) { const el = casa.nextElementSibling; if (el && el.classList.contains("fr-arbol")) el.classList.toggle("hidden"); return; }
    const cr = t.closest("[data-cronica]");
    if (cr) { const el = cr.nextElementSibling; if (el) el.classList.toggle("hidden"); return; }
    const eq = t.closest("[data-equipar]");
    if (eq) {
      const sid = $("frVista").querySelector(`[data-sel-reliquia="${eq.dataset.equipar}"]`).value;
      if (!sid) return;
      const err = C.equipar(ej, sid, eq.dataset.equipar);
      if (err) aviso(err, true); else { await guardar(); vistaReliquias($("frVista")); }
    }
  });

  /* --- Pestaña: Soldados --- */
  function vistaSoldados(v, primera) {
    v.classList.toggle("fr-entra", !!primera);
    let i = 0;
    const grupos = [["En filas", C.enFila(ej)], ["Niños de las casas", C.ninos(ej)], ["Retirados", C.retirados(ej)]];
    v.innerHTML = grupos.map(([t, l]) => l.length ? `<h3 class="fr-h3">${t} (${l.length})</h3><div class="fr-cartas">${l.slice().sort((a, b) => b.victorias - a.victorias).map(s => carta(s, { ver: true, i: i++ })).join("")}</div>` : "").join("") || `<p class="fr-vacio">Sin soldados.</p>`;
    pintarRetratos(v);
  }

  /* --- Pestaña: Casas --- */
  function vistaCasas(v, primera) {
    v.classList.toggle("fr-entra", !!primera);
    const casas = C.casas(ej);
    v.innerHTML = `<p class="fr-sub">Las casas se forman solas cuando los soldados tienen hijos. Cada hijo lleva el apellido de su padre.</p>` + casas.map((c, i) => {
      const vivos = c.miembros.filter(s => s.estado !== "caido").length;
      return `<article class="fr-casa" style="--i:${Math.min(i, 12)}">
        <button type="button" class="fr-casa-cab" data-casa="${esc(c.casa)}"><strong>Casa ${esc(c.casa)}</strong>
          <span>${c.miembros.length} miembro${c.miembros.length === 1 ? "" : "s"} (${vivos} vivos) · ${c.generaciones} generación${c.generaciones === 1 ? "" : "es"} · ${c.victorias} victorias</span></button>
        <div class="fr-arbol hidden">${arbolHtml(C.arbolDeCasa(ej, c.casa), 0)}
          <p class="fr-sub">Los ${esc(c.casa)} han servido durante ${Math.max(1, c.anios)} año${c.anios === 1 ? "" : "s"}.</p></div>
      </article>`;
    }).join("");
    pintarRetratos(v);
  }
  function arbolHtml(nodos, nivel) {
    return `<ul class="fr-arbol-lista">${nodos.map(n => `<li><span class="fr-av">${retr(n.s, 40)}</span><button type="button" class="fr-enlace ${n.s.estado === "caido" ? "fr-caido" : ""}" data-ficha="${n.s.id}">${esc(nombreApodo(n.s))}</button>
      <small>${n.s.nacimiento}${n.s.estado === "caido" && n.s.muerte ? ` – ${n.s.muerte.anio}` : ""} · ${esc(D.tropa(ej.faccion, n.s.clase).nombre)} · ${n.s.victorias}v</small>${n.hijos.length ? arbolHtml(n.hijos, nivel + 1) : ""}</li>`).join("")}</ul>`;
  }

  /* --- Pestaña: Reliquias --- */
  const ICONO_RELIQUIA = {
    arma: '<svg viewBox="0 0 40 40"><path d="M30 5 L35 5 L35 10 L17 28 L12 23 Z" fill="#cfd6de"/><path d="M12 23 L17 28 L11 34 L6 29 Z" fill="#8a6a1a"/><path d="M9 26 L14 31" stroke="#2a1c08" stroke-width="2"/></svg>',
    armadura: '<svg viewBox="0 0 40 40"><path d="M8 8 L20 4 L32 8 L31 24 C30 30 25 34 20 36 C15 34 10 30 9 24 Z" fill="#aab1ba" stroke="#2a2c30" stroke-width="1.5"/><path d="M20 6 L20 35" stroke="#2a2c30" stroke-width="1.5"/><path d="M12 16 L28 16" stroke="#d4af37" stroke-width="2"/></svg>',
    accesorio: '<svg viewBox="0 0 40 40"><circle cx="20" cy="23" r="9" fill="none" stroke="#d4af37" stroke-width="4"/><path d="M20 8 L24 13 L20 18 L16 13 Z" fill="#b98cff" stroke="#2a1840" stroke-width="1"/></svg>',
    estandarte: '<svg viewBox="0 0 40 40"><path d="M10 4 L10 37" stroke="#b9a56e" stroke-width="2.5"/><path d="M10 6 L32 9 L26 16 L32 23 L10 20 Z" fill="#9a2e26" stroke="#1a0505" stroke-width="1"/></svg>'
  };
  function vistaReliquias(v) {
    const rels = C.reliquiasDe(ej);
    if (!rels.length) { v.innerHTML = `<div class="fr-vacio fr-vacio-grande"><b>Reliquiario vacío</b><p>Todavía no hay reliquias. Se encuentran en ruinas, en fortalezas custodiadas y en las manos de los enemigos caídos.</p></div>`; return; }
    const libres = new Set(C.reliquiasLibres(ej).map(r => r.id));
    v.innerHTML = `<p class="fr-sub">Pocas y con nombre. Cuando alguien cae, lo suyo no desaparece: tú decides quién la recibe.</p>` + rels.map(r => {
      const dueno = C.todos(ej).find(s => s.estado !== "caido" && Object.values(s.equipo || {}).includes(r.id));
      const hist = r.propietarios.map((p, i) => `${i + 1}. ${esc(p.nombre)}${p.heredada ? " (heredada)" : ""}${p.cae ? " (cayó con ella)" : ""}`).join(" · ");
      const elegibles = C.enFila(ej).filter(s => r.slot !== "estandarte" || s.capitan);
      return `<article class="fr-reliquia ${r.estado === "perdida" ? "fr-caido" : ""}">
        <span class="fr-rel-icono">${ICONO_RELIQUIA[r.slot] || ""}</span><div class="fr-rel-cuerpo"><h4>${esc(r.nombre)} <small>${SLOT_NOMBRE[r.slot]}</small></h4>
        <p>${esc(r.texto)}</p>
        <p class="fr-sub">${r.estado === "perdida" ? "Perdida en la Fractura." : dueno ? `La lleva ${esc(nombreApodo(dueno))}.` : "Sin dueño, en el reliquiario."} ${r.origen ? esc(r.origen) + "." : ""}</p>
        ${hist ? `<p class="fr-sub"><strong>Propietarios conocidos.</strong> ${hist}</p>` : ""}
        ${r.estado !== "perdida" ? `<div class="fr-fila"><select data-sel-reliquia="${r.id}"><option value="">Dársela a...</option>${elegibles.map(s => `<option value="${s.id}">${esc(nombre(s))}</option>`).join("")}</select><button type="button" class="fr-btn fr-btn-chico" data-equipar="${r.id}">Entregar</button></div>` : ""}
      </div></article>`;
    }).join("");
    void libres;
  }

  /* --- Pestaña: Salón de los Caídos --- */
  function vistaSalon(v, primera) {
    v.classList.toggle("fr-entra", !!primera);
    const caidos = C.caidos(ej);
    if (!caidos.length) { v.innerHTML = `<div class="fr-vacio fr-vacio-grande"><b>El Salón de los Caídos</b><p>Está vacío. Por ahora.</p></div>`; return; }
    v.innerHTML = `<p class="fr-sub">${caidos.length} nombre${caidos.length === 1 ? "" : "s"} grabado${caidos.length === 1 ? "" : "s"} en la piedra.</p><div class="fr-cartas">${caidos.map((s, i) => {
      const m = s.muerte || {};
      const serv = Math.max(1, (m.anio || ej.anio) - s.ingreso);
      const epitafio = `${m.natural ? "Murió en paz." : `Cayó en ${esc(m.lugar || "la Fractura")}${m.causa && m.causa !== "la Fractura" ? ` a manos de ${esc(m.causa)}` : ""}.`} ${serv} año${serv === 1 ? "" : "s"} de servicio.`;
      return carta(s, { ver: true, i, caido: true, extra: `<span class="fr-carta-epitafio">${epitafio}</span>` });
    }).join("")}</div>`;
    pintarRetratos(v);
  }

  /* --- Pestaña: Crónicas propias --- */
  function vistaCronicas(v) {
    const h = ej.historia.slice().reverse();
    if (!h.length) { v.innerHTML = `<div class="fr-vacio fr-vacio-grande"><b>Sin crónicas</b><p>Aún no hay guerras que contar.</p></div>`; return; }
    v.innerHTML = h.map((g, i) => `<article class="fr-cronica ${/vic|gan/i.test(String(g.resultado)) ? "gano" : /derr|perd/i.test(String(g.resultado)) ? "perdio" : "tablas"}" style="--i:${Math.min(i, 12)}">
      <button type="button" class="fr-casa-cab" data-cronica="1"><strong>${esc(g.titulo || `Guerra ${g.n}`)}</strong>
        <span>Año ${g.anio} · ${g.resultado} contra ${esc(FACCIONES[g.rival] ? FACCIONES[g.rival].corto : g.rival)} · ${g.turnos} turnos</span></button>
      <div class="fr-arbol hidden">${(g.parrafos || [g.razon || ""]).map(p => `<p>${esc(p)}</p>`).join("")}</div>
    </article>`).join("");
  }

  /* --- Pestaña: Historia del mundo --- */
  async function vistaMundo(v) {
    v.innerHTML = `<p class="fr-sub">Cargando...</p>`;
    const guerras = await Red.historiaDelMundo(300);
    if (!guerras.length) { v.innerHTML = `<div class="fr-vacio fr-vacio-grande"><b>Historia del mundo</b><p>La historia del mundo se guarda en el servidor. Inicia sesión y juega una guerra para empezar a escribirla.</p></div>`; return; }
    const h = CR.historiaDelMundo(guerras);
    const facs = Object.keys(h.porFaccion).sort((a, b) => h.porFaccion[b].guerras - h.porFaccion[a].guerras);
    v.innerHTML = `<div class="fr-historia">
      <p><strong>${h.guerras}</strong> guerras disputadas por <strong>${h.jugadores}</strong> jugador${h.jugadores === 1 ? "" : "es"}.</p>
      <p><strong>${h.facciones}</strong> bandos distintos han salido a la Fractura. Se tomaron <strong>${h.capitalesTomadas}</strong> capitales y <strong>${h.nucleos}</strong> veces alguien impuso su influencia sobre el Núcleo del Sueño.</p>
      <p>Cayeron <strong>${h.bajas}</strong> soldados entre los dos bandos.${h.mayor ? ` La guerra más larga duró ${h.mayor.turnos} turnos.` : ""}</p>
    </div>
    <h3 class="fr-h3">Por bando</h3>
    <div class="fr-lista">${facs.map(f => `<div class="fr-soldado"><span class="fr-soldado-nombre">${esc(FACCIONES[f] ? FACCIONES[f].nombre : f)}</span><span class="fr-soldado-meta">${h.porFaccion[f].guerras} guerras · ${h.porFaccion[f].victorias} victorias</span></div>`).join("")}</div>
    <h3 class="fr-h3">Últimas guerras</h3>
    ${guerras.slice(0, 20).map(g => `<article class="fr-cronica"><button type="button" class="fr-casa-cab" data-cronica="1"><strong>${esc(g.titulo || "Una guerra")}</strong><span>${esc(g.jugador)} (${esc(FACCIONES[g.faccion] ? FACCIONES[g.faccion].corto : g.faccion)}) · ${g.resultado} contra ${esc(FACCIONES[g.rival] ? FACCIONES[g.rival].corto : g.rival)} · ${g.turnos} turnos</span></button>
      <div class="fr-arbol hidden">${(g.cronica || []).map(p => `<p>${esc(p)}</p>`).join("") || `<p>${esc(g.razon)}</p>`}</div></article>`).join("")}`;
  }


  async function empezarGuerra() {
    if (empezando) return;
    const fr = window.FracturaFrentes && ajustesGuerra.frente ? window.FracturaFrentes.abiertos().find(f => f.clave === ajustesGuerra.frente) : null;
    // Un frente gasta un intento al empezar, si aún puede dar carta. Si no, se juega igual sin premio.
    let premioFrente = false;
    if (fr) {
      empezando = true;
      // La espera se ve en el propio botón: círculo, texto y apagado
      const boton = document.querySelector("[data-empezar]"), txt = boton ? boton.innerHTML : "";
      if (boton) { boton.disabled = true; boton.classList.add("fr-esperando"); boton.innerHTML = "<span>Preparando el frente</span>"; }
      const espera = { parar() { if (boton && boton.isConnected) { boton.disabled = false; boton.classList.remove("fr-esperando"); boton.innerHTML = txt; } } };
      try {
        const r = await Red.frenteEmpezar(fr.clave);
        premioFrente = !!(r && r.premio);
        const POR_QUE = { cobrado: "Ya cobraste este frente.", intentos: "Ya gastaste los 2 intentos de este frente.", tope: "Hoy ya te llevaste 2 cartas de los frentes.", sesion: "Sin sesión iniciada los frentes no dan cartas.", cerrado: "Este frente ya cerró." };
        if (!premioFrente) aviso(`${POR_QUE[r && r.motivo] || "Esta vez el frente no da carta."} Se juega sin premio.`);
        else aviso(`Intento ${r.intento} de ${INTENTOS_FRENTE}.`);
        if (r && r.premio) { frentesInfo.intentos[fr.clave] = r.intento; }
      } finally { empezando = false; if (espera) espera.parar(); }
    }
    // La guerra se arma en fractura-guerra.html: aquí solo se decide quién va y con qué opciones
    const opciones = fr ? { tipo: fr.tipo, forma: fr.forma, tamano: fr.tamano, mapaPara: fr.mapaPara, dificultad: fr.dificultad, bandos: fr.bandos, equipos: fr.equipos, rivales: window.FracturaFrentes.rivalesPara(fr, ej.faccion), semilla: fr.semilla } : {
      tipo: ajustesGuerra.tipo === "azar" ? "azar" : ajustesGuerra.tipo, dificultad: ajustesGuerra.dificultad, rival: ajustesGuerra.rival === "azar" ? null : ajustesGuerra.rival,
      bandos: ajustesGuerra.bandos || 2, equipos: !!ajustesGuerra.equipos, forma: ajustesGuerra.forma, tamano: ajustesGuerra.tamano, mapaPara: ajustesGuerra.mapaPara
    };
    if (!C.disponibles(ej).length) { aviso("No hay soldados disponibles.", true); return; }
    irAGuerra({ f: ej.faccion, nueva: { ids: ajustesGuerra.ids, opciones, frente: fr ? { clave: fr.clave, bandos: fr.bandos, dificultad: fr.dificultad, nivel: fr.nivel, titulo: fr.titulo, premio: premioFrente } : null } });
  }

  /* =========================================================================
     MESAS: GUERRAS ENTRE JUGADORES, DE 2 A 8, CON APUESTAS
     La guerra se guarda en el servidor como su configuración y las acciones de cada turno
     (docs/fractura-3_frentes_y_mesas.sql). La máquina juega igual en todos los navegadores,
     así que sus turnos no se guardan: cada navegador los repite.
  ========================================================================= */
  const RAREZA_NOMBRE = { comun: "común", infrecuente: "poco común", rara: "rara", legendaria: "legendaria", limitada: "limitada" };
  let mesaNueva = { nombre: "", plazas: 2, tamano: "normal", mapaPara: 2, tipo: "reinos", forma: "continente", equipos: false, ia: false, dificultad: "normal", horas: 48, privada: false, invitados: [] };
  let mesasTimer = null, miUid = null, mesasVistas = [];
  const chipsApuesta = lista => (lista && lista.length
    ? lista.map(c => `<i class="fr-ap fr-ap-${esc(c.rareza)}" title="${esc(RAREZA_NOMBRE[c.rareza] || c.rareza)} · copia ${esc(c.numero)}">${esc(c.nombre)}</i>`).join("")
    : `<em class="fr-ap-nada">no apuesta nada</em>`);

  /* Una mesa dibujada: el tapete ovalado, las sillas alrededor con el estandarte de cada ejército y lo que hay en juego en el centro.
     sillas: [{ faccion, nombre, sub, clase (listo, espera, vacio, ia, turno, gano, perdio, yo), apuestas }] */
  function ovaloMesa(sillas, centro, extra) {
    const n = Math.max(2, sillas.length), giro = n % 2 ? 0 : Math.PI / n;
    const html = sillas.map((a, i) => {
      const ang = Math.PI / 2 + giro + (2 * Math.PI * i) / n;
      const x = 50 + Math.cos(ang) * 42, y = 50 + Math.sin(ang) * 40;
      const fac = a.faccion && FACCIONES[a.faccion];
      return `<div class="fr-asiento ${a.clase || ""}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;--c:${fac ? fac.color : "#5a4e44"};--b:${fac ? fac.bandera : "#2a2420"}" title="${esc(a.titulo || [a.nombre, a.sub].filter(Boolean).join(" · "))}">
        ${fac ? `<span class="fr-asiento-ban"></span>${retLider(a.faccion, 44, "fr-asiento-ret")}` : `<span class="fr-asiento-hueco">${a.clase && a.clase.includes("ia") ? "⚙" : "+"}</span>`}
        <b>${esc(a.nombre || "")}</b>${a.sub ? `<small>${esc(a.sub)}</small>` : ""}${a.apuestas ? `<em class="fr-asiento-ap" title="Cartas que apuesta">${a.apuestas}</em>` : ""}</div>`;
    }).join("");
    return `<div class="fr-ovalo${extra ? ` ${extra}` : ""}"><div class="fr-pano">${centro || ""}</div>${html}</div>`;
  }
  /* Las cartas apostadas, en abanico sobre el tapete */
  const naipes = cartas => {
    if (!cartas.length) return `<em class="fr-pano-nada">Sin apuestas</em>`;
    const vis = cartas.slice(0, 9), m = (vis.length - 1) / 2;
    return `<span class="fr-naipes">${vis.map((c, i) => `<i class="fr-naipe r-${esc(c.rareza)}" style="transform:rotate(${((i - m) * 9).toFixed(0)}deg) translateY(${(Math.abs(i - m) * 2).toFixed(0)}px)" title="${esc(c.nombre)} · ${esc(RAREZA_NOMBRE[c.rareza] || c.rareza)}"></i>`).join("")}</span>
      <small>${cartas.length} carta${cartas.length === 1 ? "" : "s"} en juego${cartas.length > vis.length ? ` (se ven ${vis.length})` : ""}</small>`;
  };
  const ESTADO_MESA = { abierta: "Abierta", activa: "En guerra", terminada: "Terminada", cancelada: "Cerrada", disputa: "En disputa" };

  function tarjetaMesa(m) {
    const cfg = m.config || {}, yo = miUid;
    const TM = window.FracturaMapa.TAMANO_MAPA, para = Math.max(cfg.plazas || 2, cfg.mapaPara || 0);
    const med = window.FracturaMapa.medidas(para, cfg.tamano || "normal", D.FORMAS_MAPA[cfg.forma] && D.FORMAS_MAPA[cfg.forma].maritimo);
    const lugar = `${TIPOS_FRACTURA[cfg.tipo] ? TIPOS_FRACTURA[cfg.tipo].nombre : "Lugar al azar"} · ${D.FORMAS_MAPA[cfg.forma] ? D.FORMAS_MAPA[cfg.forma].nombre : "Continente"}`;
    const mapaTxt = `${cfg.plazas} jugadores · mapa ${(TM[cfg.tamano] || TM.normal).nombre.toLowerCase()} para ${para} (${med.w}×${med.h})`;
    const todas = m.asientos.reduce((l, a) => l.concat(a.apuesta || []), []);
    const cab = `<header><h4>${esc(m.nombre)}</h4><span class="fr-mesa-estado e-${m.estado}">${ESTADO_MESA[m.estado] || m.estado}</span></header>`;
    const pie = extra => `<p class="fr-mesa-datos">${esc(lugar)}<br>${esc(mapaTxt)}${cfg.equipos ? " · dos equipos" : ""}${extra || ""}</p>`;
    if (m.estado === "abierta") {
      const soyAnfitrion = m.anfitrion === yo, miAsiento = m.asientos.find(a => a.user === yo);
      const libres = cfg.plazas - m.asientos.length;
      const faltan = m.asientos.filter(a => a.user !== m.anfitrion && !a.listo).length;
      const puedeEmpezar = soyAnfitrion && m.asientos.length >= 2 && !faltan;
      const sillas = m.asientos.map(a => ({ faccion: a.faccion, nombre: a.nombre, apuestas: (a.apuesta || []).length,
        sub: a.user === m.anfitrion ? "abrió la mesa" : a.listo ? "listo" : "pensándolo",
        clase: `${a.user === m.anfitrion || a.listo ? "listo" : "espera"}${a.user === yo ? " yo" : ""}` }))
        .concat(Array.from({ length: Math.max(0, libres) }, () => ({ nombre: cfg.ia ? "La máquina" : "Libre", sub: cfg.ia ? "si nadie se sienta" : "", clase: cfg.ia ? "vacio ia" : "vacio" })));
      let acciones = "";
      if (!miAsiento) acciones = libres > 0 ? `<button type="button" class="fr-btn fr-btn-chico fr-btn-principal" data-mesa-acc="sentar" data-id="${m.id}">Sentarme con ${esc(ej.nombre)}</button>` : `<span class="fr-pill">Llena</span>`;
      else {
        acciones = `<button type="button" class="fr-btn fr-btn-chico" data-mesa-acc="apostar" data-id="${m.id}">${miAsiento.apuesta && miAsiento.apuesta.length ? "Cambiar mi apuesta" : "Apostar cartas"}</button>`
          + (miAsiento.apuesta && miAsiento.apuesta.length ? `<button type="button" class="fr-btn fr-btn-chico" data-mesa-acc="quitar" data-id="${m.id}">Quitar mi apuesta</button>` : "")
          + (soyAnfitrion ? `<button type="button" class="fr-btn fr-btn-chico fr-btn-principal${puedeEmpezar ? "" : " no"}" data-mesa-acc="empezar" data-id="${m.id}" data-razon="${puedeEmpezar ? "" : m.asientos.length < 2 ? "Hacen falta al menos dos jugadores." : "Falta que algún jugador esté listo."}">Empezar la guerra</button>`
            : `<button type="button" class="fr-btn fr-btn-chico fr-btn-listo${miAsiento.listo ? " si" : ""}" aria-pressed="${miAsiento.listo ? "true" : "false"}" data-mesa-acc="${miAsiento.listo ? "nolisto" : "listo"}" data-id="${m.id}">${miAsiento.listo ? "✔ Listo" : "Listo"}</button>`)
          + `<button type="button" class="fr-btn fr-btn-chico fr-btn-peligro" data-mesa-acc="salir" data-id="${m.id}">${soyAnfitrion ? "Cerrar la mesa" : "Levantarme"}</button>`;
      }
      const aviso2 = miAsiento && !soyAnfitrion && !miAsiento.listo ? "<br>Mira lo que apuesta cada uno antes de marcar Listo." : miAsiento && miAsiento.faccion !== ej.faccion ? `<br>Te sentaste con ${esc(nombreFaccion(miAsiento.faccion))}.` : "";
      return `<article class="fr-mesa abierta${miAsiento ? " mia" : ""}">${cab}
        ${ovaloMesa(sillas, `${naipes(todas)}<small>${libres > 0 ? `${libres} silla${libres === 1 ? "" : "s"} libre${libres === 1 ? "" : "s"}` : "Mesa completa"}</small>`)}
        ${pie(` · ${cfg.horas || 48} h por turno${m.privada ? " · por invitación" : ""}${aviso2}`)}
        <div class="fr-fila fr-mesa-acciones">${acciones}</div></article>`;
    }
    const humanos = cfg.humanos || [], miIdx = humanos.indexOf(yo);
    const asientoDe = i => m.asientos.find(x => x.user === humanos[i]);
    const nombreDe = i => { const a = asientoDe(i); return a ? a.nombre : m.bandos && m.bandos[i] ? `la máquina (${nombreFaccion(m.bandos[i].faccion)})` : "?"; };
    const gan = m.ganadores === "empate" || !m.ganadores ? [] : String(m.ganadores).split(",").map(Number);
    const sillasDe = fin => (m.bandos || []).map((b, i) => {
      const a = asientoDe(i);
      let clase = a ? "" : "ia";
      if (!fin && m.activo === i) clase += " turno";
      if (fin && m.estado === "terminada") clase += gan.includes(i) ? " gano" : gan.length ? " perdio" : "";
      if (i === miIdx) clase += " yo";
      return { faccion: b.faccion, nombre: a ? a.nombre : "Máquina", sub: nombreFaccion(b.faccion), clase, apuestas: a ? (a.apuesta || []).length : 0 };
    });
    if (m.estado === "activa") {
      const mio = miIdx >= 0 && m.activo === miIdx, cerrada = (ej.mesasCerradas || []).includes(m.id), reportada = m.reportes && Object.keys(m.reportes).length;
      const centro = `<strong>Turno ${m.turnos + 1}</strong><small>${reportada ? "Falta confirmar el final" : mio ? "Te toca a ti" : `Juega ${esc(nombreDe(m.activo))}`}</small>${todas.length ? naipes(todas) : ""}${!mio && !reportada ? `<small>${esc(plazoTexto(m.limite))}</small>` : ""}`;
      return `<article class="fr-mesa activa${mio ? " turno" : ""}">${cab}${ovaloMesa(sillasDe(false), centro)}${pie()}
        <div class="fr-fila fr-mesa-acciones"><button type="button" class="fr-btn fr-btn-chico ${mio ? "fr-btn-principal" : ""}" data-mesa-acc="abrir" data-id="${m.id}">${cerrada ? "Ver cómo va" : mio ? "Jugar mi turno" : "Abrir"}</button></div></article>`;
    }
    const texto = m.estado === "disputa" ? "Los avisos del final no coinciden. Lo resuelve el admin y las cartas siguen guardadas."
      : m.estado === "cancelada" ? "Se cerró antes de empezar."
        : !gan.length ? "Tablas. Cada uno recupera sus cartas." : `Gan${gan.length > 1 ? "an" : "a"} ${gan.map(nombreDe).join(" y ")}`;
    const sillas = (m.bandos || []).length ? sillasDe(true) : m.asientos.map(a => ({ faccion: a.faccion, nombre: a.nombre, sub: nombreFaccion(a.faccion) }));
    return `<article class="fr-mesa fin ${m.estado === "disputa" ? "disputa" : gan.includes(miIdx) ? "gano" : gan.length && miIdx >= 0 ? "perdio" : ""}">${cab}
      ${ovaloMesa(sillas, `${gan.length ? `<span class="fr-pano-corona">♛</span>` : ""}<strong>${esc(texto)}</strong>${todas.length ? naipes(todas) : ""}`, "chico")}
      ${pie(m.razon && m.estado === "terminada" ? `<br>${esc(m.razon)}` : "")}</article>`;
  }

  async function vistaDuelos(v, primera) {
    clearInterval(mesasTimer); mesasTimer = null;
    if (primera) v.innerHTML = `<p class="fr-sub">Cargando...</p>`;
    const s = await Red.sesion();
    if (!s) { v.innerHTML = `<div class="fr-vacio fr-vacio-grande"><b>Mesas</b><p>Las guerras entre jugadores necesitan iniciar sesión. Se juegan por turnos, cada quien cuando puede.</p></div>`; return; }
    miUid = s.user.id;
    let mesas = [], jugadores = [];
    try { [mesas, jugadores] = await Promise.all([Red.mesasLista(), Red.pvpJugadores().catch(() => [])]); }
    catch (e) { v.innerHTML = `<p class="fr-vacio">No se pudieron leer las mesas. Falta correr docs/fractura-3_frentes_y_mesas.sql en Supabase. (${esc(e.message || e)})</p>`; return; }
    if (pestana !== "duelos" || $("frCuartel").classList.contains("hidden")) return;   // cambió de pestaña mientras cargaba
    mesasVistas = mesas;
    pintarSalon(v, mesas, jugadores);
    // Mientras haya una mesa abierta en la que estoy sentado, la lista se refresca sola
    if (mesas.some(m => m.estado === "abierta" && m.mia)) mesasTimer = setInterval(() => {
      if (pestana !== "duelos" || $("frCuartel").classList.contains("hidden") || document.querySelector("dialog[open]") || document.activeElement && document.activeElement.matches("input, select")) return;
      vistaDuelos($("frVista"));
    }, 12000);
  }
  let ultimosJugadores = [];
  function pintarSalon(v, mesas, jugadores) {
    if (jugadores) ultimosJugadores = jugadores;
    const fac = FACCIONES[ej.faccion], n = mesaNueva;
    if (!(n.plazas >= 4 && n.plazas % 2 === 0)) n.equipos = false;
    if (!(n.mapaPara >= n.plazas)) n.mapaPara = n.plazas;
    const seg = (k, valores, etiqueta) => `<div class="fr-segmentos fr-seg-fila">${valores.map(x => `<button type="button" class="fr-opcion${n[k] === x ? " sel" : ""}" data-mn="${k}" data-v="${x}">${etiqueta ? etiqueta(x) : x}</button>`).join("")}</div>`;
    const sino = (k, si, no) => `<div class="fr-segmentos fr-seg-fila"><button type="button" class="fr-opcion${!n[k] ? " sel" : ""}" data-mn="${k}" data-v="0">${no}</button><button type="button" class="fr-opcion${n[k] ? " sel" : ""}" data-mn="${k}" data-v="1">${si}</button></div>`;
    const maritimo = D.FORMAS_MAPA[n.forma] && D.FORMAS_MAPA[n.forma].maritimo;
    const med = window.FracturaMapa.medidas(n.mapaPara, n.tamano, maritimo);
    // La mesa nueva tal como quedará: tu silla y las demás vacías (o de la máquina)
    const sillas = [{ faccion: ej.faccion, nombre: ej.nombre, sub: "tú", clase: "listo yo" }]
      .concat(Array.from({ length: n.plazas - 1 }, (x, i) => ({ nombre: n.ia ? "La máquina" : "Libre", sub: n.ia ? DIFICULTADES[n.dificultad].nombre.toLowerCase() : "", clase: n.ia ? "vacio ia" : "vacio", titulo: n.equipos ? `Equipo ${(i + 1) % 2 ? "rival" : "tuyo"}` : "" })));
    const centro = `<canvas class="fr-pano-mapa" data-mesa-mapa="1" data-tipo="${esc(n.tipo)}" data-forma="${esc(n.tipo === "horizonte" ? "continente" : n.forma)}" data-para="${n.mapaPara}" data-tamano="${esc(n.tamano)}" width="180" height="104"></canvas>
      <small>${esc(TIPOS_FRACTURA[n.tipo].nombre)} · ${esc(D.FORMAS_MAPA[n.forma].nombre)}<br>${med.w}×${med.h} casillas${n.mapaPara > n.plazas ? `, para ${n.mapaPara}` : ""}</small>`;
    const grupos = [["Te toca", mesas.filter(m => m.estado === "activa" && m.mia && (m.config.humanos || []).indexOf(miUid) === m.activo)],
      ["Mesas abiertas", mesas.filter(m => m.estado === "abierta")],
      ["En curso", mesas.filter(m => m.estado === "activa" && !((m.config.humanos || []).indexOf(miUid) === m.activo))],
      ["En disputa", mesas.filter(m => m.estado === "disputa")],
      ["Terminadas", mesas.filter(m => m.estado === "terminada" || m.estado === "cancelada").slice(0, 6)]];
    v.innerHTML = `
      <p class="fr-sub">De 2 a 8 jugadores, cada uno con su ejército y su contingente. Si alguien cae, cae de verdad. Cada jugador apuesta las cartas que quiera, o ninguna. Quien gana se lleva las de los que pierden.</p>
      <section class="fr-mesa-nueva" style="--c:${fac.color};--b:${fac.bandera}">
        <div class="fr-mn-vista">
          <h3 class="fr-h3">Abrir una mesa</h3>
          ${ovaloMesa(sillas, centro, "grande")}
          <input type="text" class="fr-entrada" data-mesa="nombre" maxlength="60" placeholder="Mesa de ${esc(fac.corto)}" value="${esc(n.nombre)}" aria-label="Nombre de la mesa">
          <button type="button" class="fr-empezar" data-mesa-crear><span>Abrir la mesa</span><small>Con ${esc(ej.nombre)} y ${(ajustesGuerra.ids || []).length} soldados · las apuestas se ponen después</small></button>
        </div>
        <div class="fr-mn-controles">
          <span>Sillas</span>${seg("plazas", [2, 3, 4, 5, 6, 7, 8])}
          ${n.plazas >= 4 && n.plazas % 2 === 0 ? `<span>Bandos</span>${sino("equipos", "Dos equipos", "Todos contra todos")}` : ""}
          <span>Mapa</span>${seg("tamano", Object.keys(window.FracturaMapa.TAMANO_MAPA), x => window.FracturaMapa.TAMANO_MAPA[x].nombre)}
          <span>Hecho para</span>${seg("mapaPara", [2, 3, 4, 5, 6, 7, 8].filter(x => x >= n.plazas))}
          <span>Lugar</span><div class="fr-mn-dos"><select data-mesa="tipo" aria-label="Lugar de la Fractura">${Object.keys(TIPOS_FRACTURA).map(t => `<option value="${t}"${n.tipo === t ? " selected" : ""}>${esc(TIPOS_FRACTURA[t].nombre)}</option>`).join("")}</select>
            <select data-mesa="forma" aria-label="Forma del mapa">${Object.keys(D.FORMAS_MAPA).map(f => `<option value="${f}"${n.forma === f ? " selected" : ""}>${esc(D.FORMAS_MAPA[f].nombre)}${D.FORMAS_MAPA[f].maritimo ? " (de mar)" : ""}</option>`).join("")}</select></div>
          <span>Sillas vacías</span>${sino("ia", "Las juega la máquina", "Se quedan vacías")}
          ${n.ia ? `<span>Máquina</span>${seg("dificultad", Object.keys(DIFICULTADES), x => DIFICULTADES[x].nombre)}` : ""}
          <span>Cada turno</span>${seg("horas", [24, 48, 72], x => `${x} h`)}
          <span>Quién entra</span>${sino("privada", "Solo invitados", "Cualquiera")}
          ${n.privada ? `<span>Invitados</span><div class="fr-invitados">${ultimosJugadores.map(j => `<button type="button" class="fr-opcion${n.invitados.includes(j.user_id) ? " sel" : ""}" data-mn-invita="${j.user_id}">${esc(j.username)}</button>`).join("") || `<p class="fr-sub">No hay más jugadores con cuenta.</p>`}</div>` : ""}
          <p class="fr-sub fr-mn-nota">Si a alguien se le pasa el plazo, cualquier otro jugador puede pedir que ese turno lo juegue la máquina.</p>
        </div>
      </section>
      <div class="fr-seccion-cab"><h3 class="fr-h3">Mesas</h3><button type="button" class="fr-btn fr-btn-chico" data-mesa-acc="refrescar">Actualizar</button></div>
      ${grupos.filter(g => g[1].length).map(g => `<h4 class="fr-h4">${g[0]} <small>${g[1].length}</small></h4><div class="fr-mesas-grid${g[0] === "Terminadas" ? " chicas" : ""}">${g[1].map(tarjetaMesa).join("")}</div>`).join("") || `<p class="fr-vacio">No hay ninguna mesa. Abre una.</p>`}`;
    pintarRetratos(v);
    pintarFormas(v);
  }

  /* Elegir qué cartas apostar: las libres del jugador más las que ya tiene puestas en esta mesa */
  async function elegirApuesta(m) {
    let libres;
    try { libres = await Red.misCartas(); } catch (e) { aviso(`No se pudieron leer tus cartas (${e.message || e}).`, true); return null; }
    const puestas = ((m.asientos.find(a => a.user === miUid) || {}).apuesta || []);
    const todas = puestas.concat(libres);
    if (!todas.length) { aviso("No tienes cartas libres para apostar."); return null; }
    return new Promise(resolver => {
      const elegidas = new Set(puestas.map(c => c.ejemplar));
      const dlg = document.createElement("dialog");
      dlg.className = "fr-dialogo fr-apuesta";
      const pintar = () => {
        dlg.querySelectorAll("[data-ej]").forEach(b => { const si = elegidas.has(b.dataset.ej); b.classList.toggle("sel", si); b.setAttribute("aria-pressed", si ? "true" : "false"); });
        dlg.querySelector("[data-cuenta]").textContent = elegidas.size ? `${elegidas.size} carta${elegidas.size === 1 ? "" : "s"} en la apuesta` : "Sin apuesta";
      };
      dlg.innerHTML = `<h2 class="fr-h2">Tu apuesta</h2>
        <p class="fr-sub">Las que quieras, o ninguna. No tiene que parecerse a la de los demás. Quedan guardadas hasta que la guerra termine: si ganas, las recuperas y te llevas las de los que pierdan; si pierdes, se las lleva quien gane.</p>
        <div class="fr-apuesta-lista">${todas.map(c => `<button type="button" class="fr-opcion fr-ap-fila" data-ej="${esc(c.ejemplar)}" aria-pressed="false"><i class="fr-ap fr-ap-${esc(c.rareza)}">${esc(RAREZA_NOMBRE[c.rareza] || c.rareza)}</i><strong>${esc(c.nombre)}</strong><small>copia ${esc(c.numero)}</small></button>`).join("")}</div>
        <p class="fr-sub" data-cuenta></p>
        <div class="fr-fila"><button type="button" class="fr-btn fr-btn-principal" data-ok>Dejar así mi apuesta</button><button type="button" class="fr-btn" data-no>Cancelar</button></div>`;
      document.body.appendChild(dlg);
      const cerrar = valor => { dlg.close(); dlg.remove(); resolver(valor); };
      dlg.addEventListener("click", ev => {
        const b = ev.target.closest("[data-ej]");
        if (b) { if (elegidas.has(b.dataset.ej)) elegidas.delete(b.dataset.ej); else elegidas.add(b.dataset.ej); son("clic"); pintar(); return; }
        if (ev.target.closest("[data-ok]")) cerrar([...elegidas]);
        else if (ev.target.closest("[data-no]")) cerrar(null);
      });
      dlg.addEventListener("cancel", ev => { ev.preventDefault(); cerrar(null); });
      pintar();
      dlg.showModal();
    });
  }

  $("frVista").addEventListener("input", ev => { const i = ev.target.closest('[data-mesa="nombre"]'); if (i) mesaNueva.nombre = i.value; });
  $("frVista").addEventListener("change", ev => { const s = ev.target.closest("select[data-mesa]"); if (s) { mesaNueva[s.dataset.mesa] = s.value; pintarSalon($("frVista"), mesasVistas); } });
  $("frVista").addEventListener("click", async ev => {
    const t = ev.target;
    const mn = t.closest("[data-mn]"), inv = t.closest("[data-mn-invita]"), crear = t.closest("[data-mesa-crear]"), acc = t.closest("[data-mesa-acc]");
    if (!(mn || inv || crear || acc)) return;
    if (mn) {
      const k = mn.dataset.mn, x = mn.dataset.v;
      mesaNueva[k] = k === "plazas" || k === "horas" || k === "mapaPara" ? +x : k === "dificultad" || k === "tamano" ? x : x === "1";
      if (mesaNueva.mapaPara < mesaNueva.plazas) mesaNueva.mapaPara = mesaNueva.plazas;
      son("clic"); pintarSalon($("frVista"), mesasVistas); return;
    }
    if (inv) {
      const id = inv.dataset.mnInvita, i = mesaNueva.invitados.indexOf(id);
      if (i >= 0) mesaNueva.invitados.splice(i, 1); else mesaNueva.invitados.push(id);
      son("clic"); pintarSalon($("frVista"), mesasVistas); return;
    }
    const boton = crear || acc;
    if (boton.dataset.razon) { aviso(boton.dataset.razon, true); son("error"); return; }
    if (boton.disabled) return;
    const id = acc && acc.dataset.id, m = id ? mesasVistas.find(x => x.id === id) : null, que = acc ? acc.dataset.mesaAcc : "crear";
    try {
      if (que === "refrescar") { await vistaDuelos($("frVista")); return; }
      if (que === "abrir") { irAGuerra({ f: ej.faccion, mesa: id }); return; }
      if (que === "apostar") {
        const ids = await elegirApuesta(m);
        if (ids === null) return;
        await Red.mesaApostar(id, ids);
        aviso(ids.length ? "Apuesta puesta. Los demás tienen que volver a marcar Listo." : "Apuesta retirada.");
      } else if (que === "quitar") { await Red.mesaApostar(id, []); aviso("Apuesta retirada: tus cartas vuelven a estar libres."); }
      else if (que === "salir") {
        const anfitrion = m && m.anfitrion === miUid;
        if (!(await dialogo.confirmar(anfitrion ? "Se cierra la mesa y cada uno recupera sus cartas." : "Dejas tu asiento y recuperas tus cartas.", { titulo: anfitrion ? "Cerrar la mesa" : "Levantarse", aceptar: anfitrion ? "Cerrar la mesa" : "Levantarme" }))) return;
        await Red.mesaSalir(id);
      } else {
        boton.disabled = true; boton.classList.add("fr-esperando");
        if (que === "crear") {
          const n = mesaNueva;
          // La máquina rellena con ejércitos al azar que no sean el mío; el servidor salta los que ya estén en la mesa
          const relleno = Object.keys(FACCIONES).filter(f => f !== ej.faccion).sort(() => Math.random() - 0.5);
          await Red.mesaCrear(n.nombre, { plazas: n.plazas, tamano: n.tamano, mapaPara: Math.max(n.plazas, n.mapaPara), tipo: n.tipo, forma: n.tipo === "horizonte" ? "continente" : n.forma, equipos: !!n.equipos, ia: !!n.ia, relleno, dificultad: n.dificultad, horas: n.horas, privada: !!n.privada, hold: 6, anio: ej.anio, reglas: D.REGLAS },
            C.prepararBando(ej, ajustesGuerra.ids), n.privada ? n.invitados : []);
          await guardar();
          aviso("Mesa abierta.");
        } else if (que === "sentar") {
          if ((m.config || {}).reglas !== D.REGLAS) { aviso("Esa mesa se abrió con otra versión del juego. Recarga la página (Ctrl+F5).", true); await vistaDuelos($("frVista")); return; }
          await Red.mesaUnirse(id, C.prepararBando(ej, ajustesGuerra.ids));
          await guardar();
        } else if (que === "listo" || que === "nolisto") await Red.mesaListo(id, que === "listo");
        else if (que === "empezar") { await Red.mesaEmpezar(id); irAGuerra({ f: ej.faccion, mesa: id }); return; }
      }
      await vistaDuelos($("frVista"));
    } catch (e) { aviso(`No se pudo: ${e.message || e}`, true); son("error"); await vistaDuelos($("frVista")); }
  });

  /* =========================================================================
     ARRANQUE DE LA PORTADA Y EL CUARTEL
     ?f=<ejército>&p=<pestaña>: se entra directo a ese cuartel (así se vuelve de la guerra). Si la guerra dejó un aviso, se enseña.
  ========================================================================= */
  G.pintarVista = pintarVista;
  (async function arrancar() {
    const av = leerSesion("fracturaAviso");
    const q = new URLSearchParams(location.search), f = q.get("f");
    if (f) {
      await cargarEjercitos();
      if (ejercitos[f]) { ej = ejercitos[f]; entrarCuartel(q.get("p") || "guerra"); if (av && av.t) aviso(av.t, av.error); return; }
    }
    await pintarPortada();
    if (av && av.t) aviso(av.t, av.error);
  })();
