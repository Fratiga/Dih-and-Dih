/* =============================================================================
   LA FRACTURA: pantallas. Elegir ejército, cuartel (soldados, casas, reliquias, salón de los caídos,
   crónicas e historia del mundo), la guerra sobre el tablero y el final con su crónica.
   Las reglas están en fractura-motor.js y lo que dura entre guerras en fractura-campana.js.
============================================================================= */
(function () {
  const D = window.FRACTURA_DATOS, S = window.FracturaSoldados, FM = window.FracturaMotor, IA = window.FracturaIA, C = window.FracturaCampana, CR = window.FracturaCronica, Red = window.FracturaRed;
  const { CLASES, FACCIONES, TIPOS_FRACTURA, ESPECIALIZACIONES, EDIFICIOS, ESCUELAS, RECURSOS, RECURSO_NOMBRE, RANGOS, SLOTS, DIFICULTADES } = D;
  const $ = id => document.getElementById(id);
  const esc = t => String(t === undefined || t === null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ROM = ["", "I", "II", "III"];
  const FR = window.FracturaRetratos;
  const SLOT_NOMBRE = { arma: "Arma", armadura: "Armadura", accesorio: "Accesorio", estandarte: "Estandarte" };
  const STAT_NOMBRE = { FUE: "Fuerza", CON: "Constitución", VEL: "Velocidad", INT: "Inteligencia", VOL: "Voluntad", MAG: "Aptitud mágica" };

  let ejercitos = {};      // faccion -> ejército
  let ej = null;           // el ejército con el que se juega
  let pestana = "guerra";
  let est = null;          // guerra en curso
  let sel = { uid: null, ciudad: null };
  let modo = null;         // habilidad que espera una casilla: { id, ... }
  let guardarEstadoTimer = null;
  let ajustesGuerra = { tipo: "azar", forma: "azar", dificultad: "normal", rival: "azar", ids: null, bandos: 2, equipos: false, frente: undefined };
  let cobrados = null;     // frentes que el jugador ya cobró (se piden al servidor al abrir la pestaña)
  let tablero = null;
  let ultimoResumen = null;

  /* --- Retratos: un canvas por soldado, que se pinta después de poner el HTML --- */
  const retr = (s, w, anim, ejf) => `<canvas class="fr-ret" data-retr="${s.id}" data-w="${w}"${ejf ? ` data-ejf="${ejf}"` : ""}${anim ? " data-anim" : ""}></canvas>`;
  const retrGen = (clase, id, faccion, w, anim, sexo) => `<canvas class="fr-ret" data-gen="${clase}|${id}|${faccion}|${sexo || "m"}" data-w="${w}"${anim ? " data-anim" : ""}></canvas>`;
  // Quién representa a cada facción cuando aún no hay nadie que mostrar
  const REP = { "academia-arcana-de-dolbred": ["archimago", "m"], "trono-de-ceniza": ["esqueleto", "m"], "compania-dorada": ["mercenario", "f"], "hijos-del-acero": ["cazador", "m"], "santos-de-asmodeo": ["paladin", "m"], nikaalia: ["picaro", "m"], seosan: ["guerrero", "f"], okran: ["guerrero", "m"], pelgiria: ["cazador", "f"], mravec: ["guerrero", "f"], nernib: ["paladin", "m"], balutia: ["guerrero", "m"] };
  const retrFaccion = (f, w, anim) => { const r = REP[f] || ["lider", "m"]; return retrGen(r[0], f, f, w, anim, r[1]); };
  function pintarRetratos(raiz) {
    if (!FR) return;
    raiz.querySelectorAll("canvas[data-retr]").forEach(cv => {
      const E = cv.dataset.ejf ? ejercitos[cv.dataset.ejf] : ej;
      const s = E && E.soldados[cv.dataset.retr];
      if (!s) return;
      const o = { faccion: E.faccion, anio: E.anio, herido: C.convaleciente(E, s), w: +cv.dataset.w };
      if (cv.hasAttribute("data-anim")) FR.animar(cv, s, o); else FR.dibujar(cv, s, o);
    });
    raiz.querySelectorAll("canvas[data-gen]").forEach(cv => {
      const [cl, id, fac, sexo] = cv.dataset.gen.split("|");
      const o = { faccion: fac, anio: 1, w: +cv.dataset.w };
      const g = FR.generico(cl, id, sexo);
      if (cv.hasAttribute("data-anim")) FR.animar(cv, g, o); else FR.dibujar(cv, g, o);
    });
  }

  /* --- Utilidades --- */
  function aviso(t, error) {
    const a = $("frAviso");
    a.textContent = t || "";
    a.classList.toggle("hidden", !t);
    a.classList.toggle("fr-aviso-error", !!error);
    if (t) { clearTimeout(aviso.t); aviso.t = setTimeout(() => a.classList.add("hidden"), 5000); }
  }
  function mostrar(pantalla) {
    ["frPortada", "frInicio", "frCuartel", "frGuerra", "frFin"].forEach(id => $(id).classList.toggle("hidden", id !== pantalla));
    document.body.classList.toggle("fr-en-guerra", pantalla === "frGuerra");
    document.body.classList.toggle("fr-en-portada", pantalla === "frPortada");
    // Con la guerra fuera de la vista, el mapa deja de dibujarse
    if (tablero && tablero.dormir) tablero.dormir(pantalla !== "frGuerra");
    document.body.classList.toggle("fr-en-cuartel", pantalla === "frCuartel");
    window.scrollTo(0, 0);
  }
  const edad = s => S.edadDe(s, ej.anio);
  const nombre = s => `${s.nombre} ${s.casa}`;
  const nombreApodo = s => `${s.nombre} ${s.casa}${s.apodo ? ` «${s.apodo}»` : ""}`;
  const rango = s => S.rangoDe(s.victorias);
  const costeTexto = c => Object.keys(c).map(k => `${c[k]} ${RECURSO_NOMBRE[k].toLowerCase()}`).join(", ") || "gratis";

  async function guardar() {
    const r = await Red.guardarEjercito(ej);
    if (r && r.error) aviso("No se pudo guardar en el servidor. Se guardó en este navegador.", true);
  }

  /* =========================================================================
     PORTADA: el menú principal del juego
  ========================================================================= */
  const CURVA_TEXTO = { "Empieza fuerte": "Pega pronto. Si la guerra se alarga, pierde ventaja.", "Tardío": "Necesita tiempo. Cuando llega arriba cuesta pararlo.", "Desgaste": "Cada baja lo alimenta.", "Pico": "Tiene un momento de fuerza muy alto si llega a él.", "Depende del mapa": "Su fuerza depende del terreno y de cómo se plantee la guerra." };
  let portadaAnim = 0;
  async function pintarPortada() {
    ej = null; est = null;
    mostrar("frPortada");
    const menu = $("frPortadaMenu");
    menu.innerHTML = `<button type="button" class="fr-menu-btn principal" data-pm="jugar"><span>Jugar</span><small>Elige un ejército y ve a la guerra</small></button>
      <button type="button" class="fr-menu-btn" data-pm="codice"><span>Códice</span><small>Los trece ejércitos, sus tropas y sus héroes</small></button>
      <button type="button" class="fr-menu-btn" data-pm="ayuda"><span>Cómo se juega</span></button>
      <button type="button" class="fr-menu-btn" data-pm="ajustes"><span>Ajustes</span></button>
      ${document.documentElement.requestFullscreen ? `<button type="button" class="fr-menu-btn" data-pm="pantalla"><span>Pantalla completa</span><small>También con la tecla F</small></button>` : ""}`;
    animarPortada();
    await cargarEjercitos();
    if (!$("frPortada").classList.contains("hidden")) {
      const enCurso = Red.cargarGuerra();
      if (enCurso && ejercitos[enCurso.cfg.faccion] && enCurso.est.reglas === D.REGLAS) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "fr-menu-btn principal"; b.dataset.pm = "retomar";
        b.innerHTML = `<span>Continuar la guerra</span><small>${esc(ejercitos[enCurso.cfg.faccion].nombre)} · turno ${enCurso.est.turno} de ${enCurso.est.maxTurnos}</small>`;
        menu.insertBefore(b, menu.firstChild);
        menu.querySelector('[data-pm="jugar"]').classList.remove("principal");
      } else if (enCurso && enCurso.est.reglas !== D.REGLAS) Red.borrarGuerra();
    }
  }
  $("frPortadaMenu").addEventListener("click", ev => {
    const b = ev.target.closest("[data-pm]");
    if (!b) return;
    son("clic");
    const m = b.dataset.pm;
    if (m === "jugar") pantallaInicio();
    else if (m === "retomar") retomarGuerra();
    else if (m === "codice") abrirCodice();
    else if (m === "ayuda") abrirAyuda();
    else if (m === "ajustes") abrirAjustes();
    else if (m === "pantalla") pantallaCompleta();
  });
  $("frAPortada").addEventListener("click", pintarPortada);

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

  /* Códice: los trece ejércitos con sus tropas y su héroe, tal como se ven en el mapa */
  function abrirCodice(faccionInicial) {
    const c = $("frCodiceCuerpo");
    const pinta = f => {
      const fac = FACCIONES[f];
      const clases = D.CLASES_BASE.concat(fac.clasesExtra);
      const topeB = fac.naval.barcoMax === undefined ? 3 : fac.naval.barcoMax;
      const barcosCod = D.BARCOS_BASE.concat(fac.naval.barcos || []).filter(cl => CLASES[cl].naval <= topeB);
      c.innerHTML = `<nav class="fr-codice-lista">${Object.keys(FACCIONES).map(k => `<button type="button" class="${k === f ? "sel" : ""}" data-cod="${k}" style="--c:${FACCIONES[k].color}">${figHtml({ faccion: k, clase: "lider", sinAro: true }, 34, 42)}<span>${esc(FACCIONES[k].corto)}</span></button>`).join("")}</nav>
        <article class="fr-codice-ficha" style="--c:${fac.color};--b:${fac.bandera}">
          <header><h3>${esc(fac.nombre)}</h3><span class="fr-curva" title="${esc(CURVA_TEXTO[fac.curva] || "")}">${esc(fac.curva)}</span></header>
          <p>${esc(fac.resumen)}</p><p><strong>Ventaja.</strong> ${esc(fac.ventaja)}</p>
          <p><strong>En el mar: ${esc((fac.naval.nivel || "").toLowerCase())}.</strong> ${esc(fac.naval.texto)}</p>
          <p><strong>Su palabra.</strong> ${esc(!fac.diplomacia.pacta ? "No pacta con nadie." : `${fac.diplomacia.pacta >= 0.7 ? "Pacta con facilidad" : fac.diplomacia.pacta >= 0.5 ? "Pacta si le conviene" : "Le cuesta pactar"}${fac.diplomacia.soloHumanos ? ", nunca con ejércitos de monstruos" : ""}. ${!fac.diplomacia.traiciona ? "Cumple lo que firma." : fac.diplomacia.traiciona >= 0.4 ? "Traiciona cuando le conviene." : "Rara vez rompe un pacto."}`)}</p>
          <p class="fr-sub">${esc(CURVA_TEXTO[fac.curva] || "")}</p>
          <h4>Tropas</h4>
          <div class="fr-codice-tropas">${clases.concat(["lider"]).map(cl => { const tr = D.tropa(f, cl), k = CLASES[cl]; return `<div class="fr-codice-tropa${fac.clasesExtra.includes(cl) ? " propia" : ""}">${figHtml({ faccion: f, clase: cl }, 64, 78)}<div><strong>${esc(tr.nombre)}</strong><small>${esc(k.rol)}${fac.clasesExtra.includes(cl) ? " · solo este ejército" : ""}</small>
            <span class="fr-recluta-cifras">${ico("vida")}${k.hp} ${ico("ataque")}${k.atq} ${ico("defensa")}${k.def} ${ico("mov")}${k.mov}${k.alc > 1 ? ` ${ico("alcance")}${k.alc}` : ""}</span><p>${esc(tr.aspecto)}</p><p class="fr-sub">${esc(tr.texto)}</p></div></div>`; }).join("")}</div>
          ${barcosCod.length ? `<h4>Barcos</h4><div class="fr-codice-tropas">${barcosCod.map(cl => { const k = CLASES[cl]; return `<div class="fr-codice-tropa${k.exclusiva ? " propia" : ""}">${figHtml({ faccion: f, clase: cl }, 64, 78)}<div><strong>${esc(k.nombre)}</strong><small>${esc(k.rol)} · pide ${esc(EDIFICIOS[k.requiere.edificio].nombre)}${k.exclusiva ? " · solo este ejército" : ""}</small>
            <span class="fr-recluta-cifras">${ico("vida")}${k.hp} ${ico("ataque")}${k.atq + (fac.naval.barcoAtq || 0)} ${ico("defensa")}${k.def + (fac.naval.barcoDef || 0)} ${ico("mov")}${k.mov + (fac.naval.barcoMov || 0)}${k.alc > 1 ? ` ${ico("alcance")}${k.alc}` : ""}</span><p class="fr-sub">${esc(k.texto)}</p></div></div>`; }).join("")}</div>` : ""}
          <h4>${fac.heroe.length > 1 ? "Héroes (se invoca uno)" : "Héroe"}</h4>
          <div class="fr-codice-tropas">${fac.heroe.map(hid => { const h = HEROES[hid]; return `<div class="fr-codice-tropa heroe">${figHtml({ faccion: f, clase: "heroe", heroe: hid }, 76, 92)}<div><strong>${esc(h.variantes ? h.variantes.join(" o ") : h.nombre)}</strong><small>${esc(h.titulo)}</small>
            <span class="fr-recluta-cifras">${ico("vida")}${h.hp} ${ico("ataque")}${h.atq} ${ico("defensa")}${h.def} ${ico("mov")}${h.mov}${h.alc > 1 ? ` ${ico("alcance")}${h.alc}` : ""}</span><p>${esc(h.aspecto)}</p><p class="fr-sub">${esc(h.texto)}${h.ef.activa ? ` ${esc(h.ef.activa.nombre)}: ${esc(h.ef.activa.texto)}` : ""}</p>
            <p class="fr-sub"><strong>Para invocarlo:</strong> ${h.req.map(r => r.texto || (r.t === "edificio" ? `tener ${EDIFICIOS[r.id].nombre}` : r.t === "fortaleza" ? "tener una fortaleza" : r.t === "escuela" ? `${ESCUELAS[r.e].nombre} ${r.n}` : r.t === "ciudades" ? `${r.n} ciudades` : r.t === "regiones" ? `${r.n} provincias` : r.t === "turno" ? `turno ${r.n}` : r.t === "consagradas" ? `${r.n} casillas consagradas` : r.t === "mercado" ? "controlar el Mercado de las Sombras" : "")).filter(Boolean).concat([`pagar ${costeTexto(h.coste)}`]).join("; ").toLowerCase()}.</p></div></div>`; }).join("")}</div>
        </article>`;
      pintarFiguras(c);
    };
    pinta(faccionInicial || Object.keys(FACCIONES)[0]);
    c.onclick = ev => { const b = ev.target.closest("[data-cod]"); if (b) { son("clic"); pinta(b.dataset.cod); c.querySelector(".fr-codice-ficha").scrollTop = 0; } };
    if (!$("frCodice").open) $("frCodice").showModal();
  }

  /* =========================================================================
     ELEGIR O FUNDAR UN EJÉRCITO
  ========================================================================= */
  async function cargarEjercitos() {
    const alias = Object.keys(D.ALIAS_FACCION);
    const guardados = await Red.listarEjercitos(Object.keys(FACCIONES).concat(alias));
    // Los ejércitos guardados con un nombre antiguo pasan al nuevo, una sola vez
    for (const viejo of alias) {
      const nuevo = D.ALIAS_FACCION[viejo];
      if (!guardados[viejo]) continue;
      if (!guardados[nuevo]) { const e = guardados[viejo].ej; e.faccion = nuevo; guardados[nuevo] = { origen: "local", ej: e }; await Red.guardarEjercito(e); }
      await Red.borrarEjercito(viejo);
      delete guardados[viejo];
    }
    ejercitos = {};
    Object.keys(guardados).forEach(f => { ejercitos[f] = guardados[f].ej; });
  }

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
        <div class="fr-ejercito-ret">${estrella ? retr(estrella, 132, true, f) : retrFaccion(f, 132, true)}</div>
        <div class="fr-ejercito-cuerpo">
          <h3>${esc(fac.nombre)}</h3>
          <p class="fr-ejercito-titulo">${esc(fac.lider.titulo)} <span class="fr-curva" title="${esc(CURVA_TEXTO[fac.curva] || "")}">${esc(fac.curva)}</span></p>
          <p class="fr-ejercito-resumen">${esc(fac.resumen)}</p>
          <div class="fr-ejercito-tropas">${D.CLASES_BASE.concat(fac.clasesExtra).map(cl => `<span title="${esc(D.tropa(f, cl).nombre)}">${figHtml({ faccion: f, clase: cl, sinAro: true }, 34, 42)}</span>`).join("")}${fac.heroe.slice(0, 1).map(h => `<span class="heroe" title="Héroe: ${esc(HEROES[h].nombre)}">${figHtml({ faccion: f, clase: "heroe", heroe: h, sinAro: true }, 40, 48)}</span>`).join("")}</div>
          <p class="fr-ejercito-ventaja"><strong>Ventaja.</strong> ${esc(fac.ventaja)}</p>
          ${e ? `<p class="fr-ejercito-datos">${esc(e.nombre)} · ${e.guerras} guerra${e.guerras === 1 ? "" : "s"} (${e.ganadas} ganadas) · ${filas} en filas · año ${e.anio}</p>` : ""}
          <div class="fr-fila">${e ? `<button type="button" class="fr-btn fr-btn-principal" data-entrar="${f}">Entrar al cuartel</button>` : `<button type="button" class="fr-btn" data-fundar="${f}">Fundar este ejército</button>`}
            <button type="button" class="fr-btn fr-btn-chico" data-codice="${f}">Ver tropas</button></div>
        </div>
      </article>`;
    }).join("");
    $("frEjercitos").classList.add("fr-entra");
    pintarRetratos($("frEjercitos"));
    pintarFiguras($("frEjercitos"));
  }

  $("frEjercitos").addEventListener("click", async ev => {
    const f = ev.target.closest("[data-fundar]"), e = ev.target.closest("[data-entrar]"), cod = ev.target.closest("[data-codice]");
    if (cod) { abrirCodice(cod.dataset.codice); return; }
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
      <div class="fr-hero-ret">${estrella ? retr(estrella, 170, true) : retrFaccion(ej.faccion, 170, true)}
        <span>${estrella ? `${esc(nombre(estrella))}, ${estrella.victorias} victoria${estrella.victorias === 1 ? "" : "s"}` : "Sin soldados"}</span></div>
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

  /* --- Carta de soldado: su retrato, su nombre, lo que ha vivido y sus seis características --- */
  const STATS_ORDEN = ["FUE", "CON", "VEL", "INT", "VOL", "MAG"];
  /* o: { pon: "quita" | "lleva" (se puede cambiar de sitio al tocarla), ver (abre la ficha), caido, bloq, extra, i, attr } */
  function carta(s, o) {
    o = o || {};
    const rg = rango(s), claseN = CLASES[s.clase] ? D.tropa(ej.faccion, s.clase).nombre : s.clase;
    const herido = C.convaleciente(ej, s);
    const marcas = [];
    if (s.estado === "nino") marcas.push(`Niño de ${edad(s)}`);
    if (herido) marcas.push("Herido");
    if (s.ascensoPendiente) marcas.push("Ascenso");
    if (s.luto) marcas.push("De luto");
    if (s.estado === "establecido") marcas.push("Con familia");
    const barras = STATS_ORDEN.map(k => `<i title="${STAT_NOMBRE[k]} ${s.stats[k]}"><b style="height:${s.stats[k] * 10}%"></b><small>${k}</small></i>`).join("");
    const clases = ["fr-carta", o.pon === "quita" ? "sel" : "", o.caido || s.estado === "caido" ? "fr-caido" : "", o.bloq ? "bloq" : ""].filter(Boolean).join(" ");
    const attr = o.pon ? `data-pon="${s.id}" tabindex="0" role="button"` : o.ver ? `${o.attr || "data-ficha"}="${s.id}" tabindex="0" role="button"` : "";
    const accion = o.pon === "quita" ? `<span class="fr-carta-accion fr-quita">Quitar</span>` : o.pon === "lleva" ? `<span class="fr-carta-accion">Llevar a la guerra</span>` : "";
    return `<div class="${clases}" ${attr} style="--i:${Math.min(o.i || 0, 14)}">
      <div class="fr-carta-marco">${retr(s, 170, true)}
        ${marcas.length ? `<span class="fr-carta-marcas">${marcas.slice(0, 2).map(t => `<i>${esc(t)}</i>`).join("")}</span>` : ""}
        ${accion}
        ${o.pon ? `<button type="button" class="fr-carta-ficha" data-ficha="${s.id}" aria-label="Ver la ficha de ${esc(nombre(s))}" title="Ver ficha">i</button>` : ""}
      </div>
      <div class="fr-carta-info">
        <strong>${esc(s.nombre)} ${esc(s.casa)}</strong>
        ${s.apodo ? `<em>«${esc(s.apodo)}»</em>` : ""}
        <span class="fr-carta-clase">${esc(claseN)} · ${rg.nombre}${s.capitan ? ` · Capitán ${ROM[s.compania]}` : s.compania ? ` · ${ROM[s.compania]} compañía` : ""}</span>
        <span class="fr-carta-meta">${s.victorias} victoria${s.victorias === 1 ? "" : "s"} · ${edad(s)} años</span>
        <span class="fr-carta-stats">${barras}</span>
        ${o.extra || ""}
      </div>
    </div>`;
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
    const nb = ajustesGuerra.bandos || 2, tam = window.FracturaMapa.TAMANOS[nb];
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
      Red.frentesCobrados().then(l => { if (!l.length) return; cobrados = new Set(l); if (pestana === "guerra" && !$("frCuartel").classList.contains("hidden")) vistaGuerra($("frVista")); });
    }
    const NIV = window.FracturaFrentes ? window.FracturaFrentes.NIVELES : {};
    const tarjetaFrente = (f, i) => {
      const riv = window.FracturaFrentes.rivalesPara(f, ej.faccion), cobrado = cobrados.has(f.clave);
      return `<button type="button" class="fr-opcion fr-frente${ajustesGuerra.frente === f.clave ? " sel" : ""}${cobrado ? " cobrado" : ""}" data-aj="frente" data-v="${f.clave}" style="--i:${i}">
        <canvas class="fr-forma-mini fr-frente-mini" data-frente="${f.clave}" width="132" height="108"></canvas>
        <span class="fr-frente-texto"><strong>${esc(f.titulo)}</strong>
          <small>${esc(TIPOS_FRACTURA[f.tipo].nombre)} · ${esc(D.FORMAS_MAPA[f.forma].nombre)}</small>
          <small>${f.bandos} bandos${f.equipos ? " en dos equipos" : ""} · ${esc(DIFICULTADES[f.dificultad].nombre)} · contra ${esc(riv.slice(0, 3).map(x => FACCIONES[x].corto).join(", "))}${riv.length > 3 ? ` y ${riv.length - 3} más` : ""}</small>
          <em class="fr-frente-premio n-${f.nivel}">${esc(NIV[f.nivel].premio)}</em>
          <small>${cobrado ? "Ya lo cobraste. Puedes jugarlo otra vez, pero no da más cartas." : esc(NIV[f.nivel].texto)}</small>
          <small class="fr-frente-queda">${f.semanal ? "Toda la semana" : "Solo hoy"} · cambia en ${esc(window.FracturaFrentes.quedan(f))}</small></span></button>`;
    };
    const sinMar = ajustesGuerra.tipo === "horizonte";
    const fm = ajustesGuerra.forma !== "azar" ? D.FORMAS_MAPA[ajustesGuerra.forma] : null;
    const mar = !!(fm && fm.maritimo && !sinMar);
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
          <p class="fr-sub">Guerras ya montadas contra la máquina. Ganarlas da cartas, una vez cada frente. Todos los jugadores ven los mismos y juegan el mismo mapa.</p>
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
            <p class="fr-sub">Mapa de ${tam[0] + (mar ? 4 : 0)} por ${tam[1] + (mar ? 4 : 0)} casillas · hasta ${35 + 5 * (nb - 2) + (mar ? 10 : 0)} turnos${nb > 2 ? ` · tregua los 3 primeros turnos. ${ajustesGuerra.equipos ? "Los aliados comparten lo que ven y no se atacan." : "Quien pierde su capital queda fuera."}` : "."}</p>
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
      // Una forma se enseña con un mapa de ejemplo; un frente, con su mapa de verdad
      const fr = cv.dataset.frente ? (frentes || []).find(f => f.clave === cv.dataset.frente) : null;
      if (cv.dataset.frente && !fr) return;
      const clave = fr ? `f:${fr.clave}` : `${cv.dataset.forma}:${nb}`;
      let m = miniFormas.get(clave);
      if (!m) { m = fr ? window.FracturaMapa.generarMapa(fr.semilla, fr.tipo, { bandos: fr.bandos, forma: fr.forma }) : window.FracturaMapa.generarMapa(77, "reinos", { bandos: nb, forma: cv.dataset.forma }); miniFormas.set(clave, m); }
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
    if (aj) { const k = aj.dataset.aj; ajustesGuerra[k] = k === "bandos" ? +aj.dataset.v : k === "equipos" ? aj.dataset.v === "1" : k === "frente" ? (aj.dataset.v || null) : aj.dataset.v; son("clic"); vistaGuerra($("frVista")); return; }
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

  /* =========================================================================
     FICHA DE UN SOLDADO
  ========================================================================= */
  function abrirFicha(id, lectura) {
    const s = ej.soldados[id];
    if (!s) return;
    const rg = rango(s);
    const claseN = D.tropa(ej.faccion, s.clase).nombre;
    const barra = k => `<div class="fr-stat"><span>${STAT_NOMBRE[k]}</span><i><b style="width:${s.stats[k] * 10}%"></b></i><em>${s.stats[k]}</em></div>`;
    const vivo = s.estado !== "caido";
    const equipo = SLOTS.map(slot => {
      const rid = s.equipo && s.equipo[slot];
      const r = rid && ej.reliquias[rid];
      const libres = C.reliquiasLibres(ej).filter(x => x.slot === slot);
      return `<div class="fr-slot"><b>${SLOT_NOMBRE[slot]}</b> ${r ? `${esc(r.nombre)} <button type="button" class="fr-enlace" data-quita="${slot}">quitar</button>` : (slot === "estandarte" && !s.capitan) ? "<small>solo capitanes</small>" : vivo && libres.length ? `<select data-pon-equipo="${slot}"><option value="">Equipar...</option>${libres.map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join("")}</select>` : "<small>nada</small>"}</div>`;
    }).join("");
    const rel = C.relaciones(ej, s).map(r => `<li>${esc(r.tipo)} <button type="button" class="fr-enlace" data-ficha-otro="${r.s.id}">${esc(nombreApodo(r.s))}</button></li>`).join("");
    const caps = C.capitanes(ej);
    const puedeCap = vivo && s.estado !== "nino" && s.estado !== "retirado" && S.rangoIndice(s.victorias) >= 1;
    const ascenso = s.ascensoPendiente ? `<div class="fr-banner"><p><strong>${esc(s.nombre)} ha sobrevivido a ${s.victorias} victorias.</strong> Elige una especialización.</p>
      <div class="fr-fila">${Object.keys(ESPECIALIZACIONES).map(k => `<button type="button" class="fr-btn fr-btn-chico" data-spec="${k}" title="${esc(ESPECIALIZACIONES[k].texto)}">${ESPECIALIZACIONES[k].nombre}</button>`).join("")}</div>
      <p class="fr-sub">${Object.keys(ESPECIALIZACIONES).map(k => `${ESPECIALIZACIONES[k].nombre}: ${ESPECIALIZACIONES[k].texto}`).join(" ")}</p></div>` : "";
    const m = s.muerte;
    $("frFichaCuerpo").innerHTML = `
      <div class="fr-ficha-cab"><div class="fr-ficha-ret">${retr(s, 170, true)}</div><div><h2 class="fr-h2">${esc(nombreApodo(s))}</h2>
      <p class="fr-sub">${s.sexo === "f" ? "Mujer" : "Hombre"} de ${edad(s)} años · ${esc(claseN)} · ${rg.nombre} · ${esc(D.ORIGENES[s.origen] ? D.ORIGENES[s.origen].nombre : s.origen)}${s.reanimado ? " · Reanimado" : ""}${s.renacido ? ` · Renaciente (${s.renacido})` : ""}</p></div></div>
      ${m ? `<p class="fr-epitafio">${m.natural ? "Murió en paz." : `Cayó en ${esc(m.lugar)}${m.causa && m.causa !== "la Fractura" ? ` a manos de ${esc(m.causa)}` : ""}.`} Año ${m.anio}.</p>` : ""}
      ${s.estado === "establecido" ? `<p class="fr-sub">Establecido: tiene familia.</p>` : ""}
      ${C.convaleciente(ej, s) ? `<p class="fr-sub">Convaleciente de unas heridas graves. No puede ir a la guerra hasta pasadas ${s.herida.hasta - ej.guerras + 1} guerra(s).</p>` : ""}
      ${s.luto ? `<p class="fr-sub">De luto por ${esc(s.luto.nombre)}: +1 de ataque durante ${s.luto.restantes} guerra(s).</p>` : ""}
      ${ascenso}
      <div class="fr-cifras"><div><b>${s.victorias}</b>victorias</div><div><b>${s.bajas}</b>bajas</div><div><b>${s.oficiales}</b>oficiales abatidos</div><div><b>${s.guerras}</b>guerras (${s.ganadas} ganadas)</div><div><b>${s.cicatrices || 0}</b>cicatrices</div><div><b>${S.aniosDeServicio(s, ej.anio)}</b>años de servicio</div></div>
      ${s.spec ? `<p><strong>${ESPECIALIZACIONES[s.spec].nombre}.</strong> ${esc(ESPECIALIZACIONES[s.spec].texto)}</p>` : ""}
      <div class="fr-dos fr-dos-chico"><div><h3 class="fr-h3">Características</h3>${["FUE", "CON", "VEL", "INT", "VOL", "MAG"].map(barra).join("")}</div>
        <div><h3 class="fr-h3">Equipo</h3>${equipo}</div></div>
      ${vivo && s.estado !== "nino" ? `<h3 class="fr-h3">Mando</h3><div class="fr-fila">
        ${s.capitan ? `<span>Capitán de la ${ROM[s.compania]} compañía.</span> <button type="button" class="fr-btn fr-btn-chico" data-quitar-capitan>Quitarle el mando</button>`
          : `${puedeCap ? [1, 2, 3].map(n => `<button type="button" class="fr-btn fr-btn-chico" data-capitan="${n}"${caps.some(c => c.compania === n) ? " disabled" : ""}>Capitán de la ${ROM[n]}</button>`).join("") : "<small>Hay que ser al menos soldado para mandar.</small>"}
          <select data-compania><option value="0">Sin compañía</option>${caps.map(c => `<option value="${c.compania}"${s.compania === c.compania ? " selected" : ""}>${ROM[c.compania]} compañía (${esc(c.nombre)})</option>`).join("")}</select>`}</div>` : ""}
      ${rel ? `<h3 class="fr-h3">Familia y compañeros</h3><ul class="fr-rel">${rel}</ul>` : ""}
      <h3 class="fr-h3">Su historia</h3>
      <ol class="fr-hitos">${s.hitos.slice().reverse().map(h => `<li><b>Año ${h.anio}.</b> ${esc(h.texto)}</li>`).join("") || "<li>Aún sin historia.</li>"}</ol>`;
    $("frFichaCuerpo").dataset.id = id;
    pintarRetratos($("frFichaCuerpo"));
    if (lectura) {
      const cuerpo = $("frFichaCuerpo");
      cuerpo.querySelectorAll("[data-quita],[data-pon-equipo],[data-capitan],[data-quitar-capitan],[data-compania],[data-spec]").forEach(e => e.remove());
      cuerpo.querySelectorAll(".fr-banner").forEach(e => e.remove());
      cuerpo.querySelectorAll("h3").forEach(h => { if (h.textContent === "Mando" && h.nextElementSibling) { h.nextElementSibling.remove(); h.remove(); } });
    }
    if (!$("frFicha").open) $("frFicha").showModal();
  }
  $("frFichaCerrar").addEventListener("click", () => $("frFicha").close());
  $("frFicha").addEventListener("click", ev => { if (ev.target === $("frFicha")) $("frFicha").close(); });
  $("frFicha").addEventListener("click", async ev => {
    const id = $("frFichaCuerpo").dataset.id;
    const t = ev.target;
    const otro = t.closest("[data-ficha-otro]");
    if (otro) { abrirFicha(otro.dataset.fichaOtro); return; }
    let err = null, cambio = false;
    const spec = t.closest("[data-spec]"), cap = t.closest("[data-capitan]"), quitaCap = t.closest("[data-quitar-capitan]"), quita = t.closest("[data-quita]");
    if (spec) { err = C.elegirEspecializacion(ej, id, spec.dataset.spec); cambio = true; }
    else if (cap) { err = C.nombrarCapitan(ej, id, Number(cap.dataset.capitan)); cambio = true; }
    else if (quitaCap) { C.quitarCapitan(ej, id); cambio = true; }
    else if (quita) { C.desequipar(ej, id, quita.dataset.quita); cambio = true; }
    if (err) aviso(err, true);
    if (cambio) { await guardar(); abrirFicha(id); if (!est) entrarCuartelSinSalto(); }
  });
  $("frFicha").addEventListener("change", async ev => {
    const id = $("frFichaCuerpo").dataset.id;
    const eq = ev.target.closest("[data-pon-equipo]"), co = ev.target.closest("[data-compania]");
    let err = null;
    if (eq && eq.value) err = C.equipar(ej, id, eq.value);
    if (co) err = C.asignarCompania(ej, id, Number(co.value));
    if (err) aviso(err, true);
    await guardar(); abrirFicha(id); if (!est) entrarCuartelSinSalto();
  });
  function entrarCuartelSinSalto() { if (!$("frCuartel").classList.contains("hidden")) pintarVista(); }

  /* =========================================================================
     LA GUERRA
     El mapa (Phaser) ocupa toda la pantalla y la interfaz flota encima: recursos y bandos arriba,
     vista y minimapa a la izquierda, la selección abajo y el mando (saber, ciudades, fin de turno) a la derecha.
     Nada da por hecho dos bandos: todo sale de est.jugadores.
  ========================================================================= */
  const FF = window.FracturaFiguras, SON = window.FracturaSonido, HEROES = D.HEROES, FRT = window.FracturaFrentes;
  const son = n => { if (SON) SON.tocar(n); };
  const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  let yoIdx = 0;           // qué bando soy (siempre 0 contra la máquina)
  let pvp = null;          // guerra entre jugadores en curso: { id, n, acciones, timer }
  let cfgGuerraActual = null, ejercitosAntes = null;
  let bandos = [];         // color, forma y número de cada bando
  let panel = null;        // panel abierto a la derecha: saber, ciudades, bandos, registro
  let verAmenaza = false;
  let ocupadoIA = false;   // los demás bandos están jugando
  const humano = () => yoIdx;
  const soyYo = () => est && est.activo === humano() && est.ganador === null && !ocupadoIA;
  const esRival = d => d !== null && d >= 0 && FM.hostil(est, d, humano());
  const musicaPartida = si => { if (window.MusicaPaginas) window.MusicaPaginas.partida(si); };
  const tropaDe = u => (u.heroe ? { nombre: HEROES[u.heroe].titulo, texto: HEROES[u.heroe].texto, rol: "Héroe", aspecto: HEROES[u.heroe].aspecto } : u.dueno >= 0 ? D.tropa(est.jugadores[u.dueno].faccion, u.clase) : { nombre: CLASES[u.clase].nombre, texto: CLASES[u.clase].texto, rol: CLASES[u.clase].rol, aspecto: "" });

  /* --- Ajustes del juego (se guardan en este navegador) --- */
  let ajustes = { rapidez: 1, seguir: true, pistas: true };
  try { ajustes = Object.assign(ajustes, JSON.parse(localStorage.getItem("fracturaAjustes") || "{}")); } catch (e) { /* sin almacenamiento */ }
  const guardarAjustes = () => { try { localStorage.setItem("fracturaAjustes", JSON.stringify(ajustes)); } catch (e) { /* nada */ } if (tablero) tablero.ajustes(ajustes); };

  /* --- Iconos: dibujos pequeños en vez de palabras --- */
  const ICONOS = {
    comida: '<path d="M2.5 10c0-3.4 2.4-5.6 5.5-5.6s5.500 2.200 5.500 5.600v1.600h-11z" fill="#d9a05a"/><path d="M5.400 6.800l.9 2M8 6.200v2.400M10.600 6.800l-.9 2" stroke="#7a4a1c" stroke-width="1" fill="none" stroke-linecap="round"/>',
    materiales: '<rect x="1.500" y="5.500" width="11" height="5.500" rx="2.700" fill="#8a5a32"/><circle cx="12" cy="8.200" r="2.700" fill="#c79a6a"/><circle cx="12" cy="8.200" r="1.100" fill="#8a5a32"/>',
    mineral: '<path d="M2.500 12l2.300-5.500h6.400l2.300 5.500z" fill="#9aa6b2"/><path d="M4.800 6.500h6.400l-1.400-2.500h-3.600z" fill="#d2dae2"/>',
    oro: '<circle cx="8" cy="8" r="5.500" fill="#e3bb4e"/><circle cx="8" cy="8" r="3.200" fill="none" stroke="#9a7a1e" stroke-width="1.100"/>',
    mana: '<path d="M8 1.500l4.500 5.500-4.500 7.500-4.500-7.500z" fill="#b98cff"/><path d="M8 1.500l-4.500 5.500h4.500z" fill="#e6d6ff"/>',
    anima: '<path d="M8 1.500c3.200 2.200 4.300 4.300 4.300 7.300a4.300 4.300 0 01-8.600 0c0-2 1-3.200 2.100-4.200 0 2 1.100 2.200 2.200 2.200-1.100-2.100-1.100-3.200 0-5.300z" fill="#9fe6d2"/>',
    vida: '<path d="M8 13.800S2.300 10.200 2.300 6.300A2.900 2.900 0 018 5a2.900 2.900 0 015.700 1.300c0 3.900-5.700 7.500-5.700 7.500z" fill="#e0605a"/>',
    ataque: '<path d="M12.600 1.800l1.600 1.600-7.200 7.200-1.600-1.600z" fill="#dfe4ea"/><path d="M3.800 8.800l3.400 3.400M5 12.200l-2.600 2.600" stroke="#c79a44" stroke-width="1.700" fill="none" stroke-linecap="round"/>',
    defensa: '<path d="M8 1.800l5.200 2v4.200c0 3-2.300 5.200-5.200 6.200-2.900-1-5.200-3.200-5.200-6.200V3.800z" fill="#8aa0b8"/><path d="M8 1.800v12.400c2.900-1 5.200-3.200 5.200-6.200V3.800z" fill="#62768c"/>',
    mov: '<path d="M5 1.800h4.200v7l4.300 2.100v3.300H3.800z" fill="#b08a5a"/><path d="M3.800 12.400h9.700" stroke="#5a3d24" stroke-width="1.200"/>',
    alcance: '<circle cx="8" cy="8" r="5.700" fill="none" stroke="#e9e2cf" stroke-width="1.400"/><circle cx="8" cy="8" r="2.100" fill="#e0605a"/>'
  };
  const ico = n => `<svg class="fr-ic" viewBox="0 0 16 16" aria-hidden="true">${ICONOS[n] || ""}</svg>`;
  /* Un coste con iconos; en rojo lo que no alcanza */
  function costeHtml(c, jug) {
    const ks = Object.keys(c || {}).filter(k => c[k]);
    if (!ks.length) return `<span class="fr-coste"><em>gratis</em></span>`;
    return `<span class="fr-coste">${ks.map(k => `<b class="${jug && (jug.recursos[k] || 0) < c[k] ? "falta" : ""}" title="${c[k]} de ${RECURSO_NOMBRE[k].toLowerCase()}">${ico(k)}${c[k]}</b>`).join("")}</span>`;
  }
  /* Figura de una tropa en un lienzo pequeño: se pinta después de poner el HTML */
  const figHtml = (q, w, h, cls) => `<canvas class="fr-fig ${cls || ""}" data-fig='${JSON.stringify(q)}' data-fw="${w}" data-fh="${h}"></canvas>`;
  function pintarFiguras(raiz) {
    if (!FF) return;
    raiz.querySelectorAll("canvas[data-fig]").forEach(cv => {
      const q = JSON.parse(cv.dataset.fig);
      const b = q.dueno !== undefined && q.dueno >= 0 && bandos[q.dueno] ? bandos[q.dueno] : q.dueno === -1 ? { col: "#8c8c8c", ban: "#3a3a3a" } : Object.assign(FF.colorFaccion(q.faccion || "caballeros-del-reino"), { faccion: q.faccion });
      FF.icono(cv, q, b, { w: +cv.dataset.fw, h: +cv.dataset.fh, sinAro: !!q.sinAro });
    });
  }

  function empezarGuerra() {
    const fr = window.FracturaFrentes && ajustesGuerra.frente ? window.FracturaFrentes.abiertos().find(f => f.clave === ajustesGuerra.frente) : null;
    const cfg = fr ? C.prepararGuerra(ej, ajustesGuerra.ids, { tipo: fr.tipo, forma: fr.forma, dificultad: fr.dificultad, bandos: fr.bandos, equipos: fr.equipos, rivales: window.FracturaFrentes.rivalesPara(fr, ej.faccion), semilla: fr.semilla })
      : C.prepararGuerra(ej, ajustesGuerra.ids, {
      tipo: ajustesGuerra.tipo === "azar" ? "azar" : ajustesGuerra.tipo, dificultad: ajustesGuerra.dificultad, rival: ajustesGuerra.rival === "azar" ? null : ajustesGuerra.rival,
      bandos: ajustesGuerra.bandos || 2, equipos: !!ajustesGuerra.equipos, forma: ajustesGuerra.forma
    });
    if (!cfg) { aviso("No hay soldados disponibles.", true); return; }
    pararSondeo(); pvp = null; yoIdx = 0;
    est = FM.crearGuerra(cfg);
    cfgGuerraActual = { faccion: ej.faccion, frente: fr ? { clave: fr.clave, bandos: fr.bandos, dificultad: fr.dificultad, nivel: fr.nivel, titulo: fr.titulo } : null };
    ejercitosAntes = null;
    sel = { uid: null, ciudad: null }; modo = null;
    entrarGuerra(true);
    guardarEnCurso();
  }
  function guardarEnCurso() { if (pvp || !est) return; clearTimeout(guardarEstadoTimer); guardarEstadoTimer = setTimeout(() => { if (est && !ocupadoIA) Red.guardarGuerra(est, cfgGuerraActual); }, 400); }

  function retomarGuerra() {
    const g = Red.cargarGuerra();
    if (!g || !ejercitos[g.cfg.faccion]) return;
    if (g.est.reglas !== D.REGLAS) { Red.borrarGuerra(); aviso("Esa guerra empezó con las reglas anteriores y ya no se puede continuar.", true); pintarPortada(); return; }
    ej = ejercitos[g.cfg.faccion];
    pararSondeo(); pvp = null; yoIdx = 0;
    est = g.est; cfgGuerraActual = g.cfg;
    sel = { uid: null, ciudad: null }; modo = null;
    entrarGuerra(false);
  }

  function crearTablero() {
    if (!window.FracturaTableroPhaser) return null;
    return window.FracturaTableroPhaser.crear($("frTablero"), { alTocar: tocar, alPasar: pasarPor, alSonar: son, alMoverVista: pintarMiniPronto });
  }

  function entrarGuerra(nueva) {
    if (!tablero) tablero = crearTablero();
    if (!tablero) { aviso("No se pudo cargar el mapa de la guerra. Recarga la página.", true); return; }
    mostrar("frGuerra");
    musicaPartida(est.ganador === null);
    bandos = FF.coloresBando(est);
    cronicaVista = est.cronica.length; resumenDesde = est.cronica.length;
    panel = null; verAmenaza = false; ocupadoIA = false; finHecho = false;
    $("frPantallaCompleta").classList.toggle("hidden", !document.documentElement.requestFullscreen);
    tablero.ajustes(ajustes);
    tablero.poner(est);
    reservarVista();
    refrescar();
    if (est.ganador !== null) { terminarGuerraUI(); return; }
    if (nueva) {
      const rivales = est.jugadores.filter(j => j.id !== humano()).map(j => FACCIONES[j.faccion].corto);
      cartel(`${TIPOS_FRACTURA[est.tipo].nombre}`, 2200, `${FACCIONES[est.jugadores[humano()].faccion].corto} contra ${rivales.join(", ")}${est.tregua ? ` · tregua hasta el turno ${est.tregua}` : ""}`);
      son("turno");
    } else if (est.activo === humano()) { cartel(`Turno ${est.turno}`, 1200); atenderOfertas(); }
  }
  function reservarVista() {
    if (!tablero) return;
    const estrecho = window.innerWidth < 760;
    tablero.reservar({ arriba: 54, abajo: estrecho ? 150 : 132, izq: 8, der: panel && !estrecho ? 372 : 8 });
  }
  window.addEventListener("resize", () => { if (est && !$("frGuerra").classList.contains("hidden")) { reservarVista(); pintarMini(); } });

  /* Toda acción mía pasa por aquí: en una guerra entre jugadores se anota para enviarla al terminar el turno */
  function aplicarYo(acc) {
    const antes = tablero ? tablero.instantanea() : null;
    const r = FM.aplicar(est, acc);
    if (r.ok && pvp) pvp.acciones.push(acc);
    if (r.ok && tablero && r.ev && r.ev.length) tablero.reproducir(r.ev, antes);
    return r;
  }

  function refrescar() {
    if (!est) return;
    pintarRecursos(); pintarBandos(); pintarTurno(); pintarResaltes(); pintarSeleccion(); pintarMando(); pintarPista(); pintarMini();
    if (panel) pintarPanel();
  }

  /* --- Barra de arriba: recursos con lo que cambian por turno --- */
  function pintarRecursos() {
    const H = humano(), jug = est.jugadores[H];
    const ing = FM.ingresoDe(est, H), gasto = FM.mantenimiento(est, H);
    const sinComida = FACCIONES[jug.faccion].mods.sinComida;
    $("frRecursos").innerHTML = RECURSOS.filter(k => !(k === "comida" && sinComida)).map(k => {
      const neto = (ing[k] || 0) - (k === "comida" ? gasto : 0);
      const apuro = k === "comida" && jug.recursos[k] + neto < 0;
      return `<button type="button" class="fr-rec${apuro ? " fr-rec-apuro" : ""}" data-rec="${k}" title="${RECURSO_NOMBRE[k]}: toca para ver de dónde sale">${ico(k)}<b>${jug.recursos[k]}</b><small class="${neto < 0 ? "fr-neg" : ""}">${neto >= 0 ? "+" : ""}${neto}</small></button>`;
    }).join("");
  }
  $("frRecursos").addEventListener("click", ev => {
    const b = ev.target.closest("[data-rec]");
    if (!b || !est) return;
    const k = b.dataset.rec, H = humano(), des = $("frDesglose");
    if (!des.classList.contains("hidden") && des.dataset.rec === k) { des.classList.add("hidden"); return; }
    const d = FM.ingresoDe(est, H, true), gasto = k === "comida" ? FM.mantenimiento(est, H) : 0;
    const filas = Object.keys(d.fuentes).filter(f => d.fuentes[f][k]).map(f => `<li><span>${esc(f)}</span><b class="${d.fuentes[f][k] < 0 ? "fr-neg" : ""}">${d.fuentes[f][k] > 0 ? "+" : ""}${d.fuentes[f][k]}</b></li>`);
    if (gasto) filas.push(`<li><span>Mantener a las tropas</span><b class="fr-neg">−${gasto}</b></li>`);
    const NOTA = { comida: "Cada ciudad alimenta a 3 tropas. Las demás gastan 1 de alimento por turno; si falta, pasan hambre y pierden vida.", materiales: "Para construir edificios y hacer crecer las ciudades.", mineral: "Para tropas pesadas y edificios militares.", oro: "Para reclutar y construir.", mana: "Para investigar y para la magia.", anima: "La dejan las bajas. Paga a los muertos y la reanimación." };
    des.dataset.rec = k;
    des.innerHTML = `<h4>${ico(k)} ${RECURSO_NOMBRE[k]} <b>${est.jugadores[H].recursos[k]}</b></h4><ul>${filas.join("") || "<li><span>Nada por ahora</span><b>0</b></li>"}</ul><p>${NOTA[k]}</p>`;
    des.classList.remove("hidden");
    const r = b.getBoundingClientRect();
    des.style.left = `${Math.max(8, Math.min(window.innerWidth - 268, r.left))}px`;
    son("clic");
  });
  document.addEventListener("pointerdown", ev => { const d = $("frDesglose"); if (d && !d.classList.contains("hidden") && !ev.target.closest("#frDesglose, [data-rec]")) d.classList.add("hidden"); });

  /* --- Bandos: orden de turnos, quién juega, cuántas ciudades y puntos lleva cada uno (solo datos públicos) --- */
  function pintarBandos() {
    const H = humano();
    $("frBandos").innerHTML = est.jugadores.map((j, i) => {
      const b = bandos[i], ciudades = FM.ciudadesDe(est, i).length;
      const aliado = i !== H && FM.mismoEquipo(est, i, H), pacto = aliado && FM.hayPacto(est, i, H);
      return `<button type="button" class="fr-bando${est.activo === i && est.ganador === null ? " activo" : ""}${j.eliminado ? " fuera" : ""}${i === H ? " yo" : ""}" data-bando="${i}" style="--c:${b.col}"
        title="${esc(j.nombre)} (${esc(FACCIONES[j.faccion].corto)})${i === H ? " · eres tú" : pacto ? " · tienes un pacto con él" : aliado ? " · aliado" : ""}${j.traidor ? " · traidor" : ""}${j.eliminado ? " · eliminado" : ` · ${ciudades} ciudad${ciudades === 1 ? "" : "es"} · ${FM.puntuacion(est, i)} puntos`}">
        <i>${b.forma}</i><span>${esc(FACCIONES[j.faccion].corto)}</span><b>${j.eliminado ? "✕" : `⌂${ciudades}`}</b>${aliado ? `<em>${pacto ? "pacto" : "aliado"}</em>` : ""}</button>`;
    }).join("");
  }
  $("frBandos").addEventListener("click", ev => {
    const b = ev.target.closest("[data-bando]");
    if (!b || !est) return;
    const i = +b.dataset.bando, H = humano(), cap = est.capitales[i];
    const visto = i === H || (cap && est.vision[H][cap.y * est.ancho + cap.x] > 0);
    if (visto && cap) tablero.irA(cap.x, cap.y); else aviso(`Todavía no has encontrado a ${est.jugadores[i].nombre}.`);
    abrirPanel("bandos");
  });

  function pintarTurno() {
    const H = humano(), activo = est.jugadores[est.activo];
    const tregua = FM.enTregua(est) ? `<span class="fr-tregua" title="Durante la tregua no se puede atacar a otros bandos ni entrar en sus ciudades">Tregua · ${est.tregua - est.turno + 1}</span>` : "";
    const hold = est.nucleoHold.map((n, k) => ({ n, k })).filter(o => o.n > 0)[0];
    const nucleo = hold ? `<span class="fr-nucleo" style="--c:${bandos[hold.k].col}" title="${esc(est.jugadores[hold.k].nombre)} lleva ${hold.n} de ${est.hold} turnos sobre el Núcleo del Sueño">◎ ${hold.n}/${est.hold}</span>` : "";
    $("frTurno").innerHTML = `${tregua}${nucleo}<span class="fr-turno-n" title="Al acabar el último turno gana quien tenga más puntos">Turno <b>${est.turno}</b> / ${est.maxTurnos}</span>`;
    void H; void activo;
  }

  /* --- Lo que se marca sobre el mapa --- */
  let rutaPrevia = null, ataquePrevio = null, previaFija = null;
  function pintarResaltes() {
    const H = humano();
    const e = { sel: sel.uid, ciudad: sel.ciudad, mover: new Map(), atacar: new Set(), objetivosHab: new Set(), ruta: rutaPrevia, previaAtq: ataquePrevio, casilla: sel.casilla || null, amenaza: null };
    const u = sel.uid && est.unidades[sel.uid];
    if (u && u.dueno === H && soyYo()) {
      if (!modo) {
        if (u.pm > 0) FM.alcanzables(est, u).destinos.forEach((n, k) => e.mover.set(k, n));
        Object.values(est.unidades).forEach(w => { if (FM.hostil(est, w.dueno, H) && FM.veUnidad(est, H, w) && !FM.razonNoAtacar(est, u, w)) e.atacar.add(`${w.x},${w.y}`); });
      } else modo.casillas.forEach(k => e.objetivosHab.add(k));
    }
    if (verAmenaza) e.amenaza = zonaAmenaza();
    tablero.estado(e);
  }
  /* Casillas a las que llega el golpe de algún enemigo a la vista (lo que anda más su alcance) */
  function zonaAmenaza() {
    const H = humano(), out = new Set();
    Object.values(est.unidades).forEach(w => {
      if (!FM.hostil(est, w.dueno, H) || !FM.veUnidad(est, H, w) || (w.dueno < 0 && !w.errante)) return;
      const e = FM.ef(est, w), r = (w.dueno < 0 ? 1 : e.mov) + e.alc;
      for (let y = w.y - r; y <= w.y + r; y++) for (let x = w.x - r; x <= w.x + r; x++) { const c = FM.casilla(est, x, y); if (c && c.t !== "vacio") out.add(`${x},${y}`); }
    });
    return out;
  }

  /* Cuánto pegaría y cuánto respondería, con los números reales del motor, y desde dónde atacaría */
  function previaAtaque(u, t) {
    const e = FM.ef(est, u);
    let desde = { x: u.x, y: u.y, rec: u.recorrido || 0 };
    const sx0 = u.x, sy0 = u.y;
    const aguaDesde = n => { u.x = n.x; u.y = n.y; const r = FM.razonAgua(est, u, t); u.x = sx0; u.y = sy0; return r; };
    if (cheb(u, t) > e.alc || aguaDesde(u)) {
      if (FM.polvoraFac(est, u) || CLASES[u.clase].pesado) return null;
      const info = FM.alcanzables(est, u);
      let mejor = null;
      info.destinos.forEach(n => { const dd = cheb(n, t); if (dd <= e.alc && dd >= 1 && !aguaDesde(n) && (!mejor || n.c < mejor.c || (n.c === mejor.c && dd > mejor.dd))) mejor = { x: n.x, y: n.y, c: n.c, dd }; });
      if (!mejor) return null;
      desde = { x: mejor.x, y: mejor.y, rec: (u.recorrido || 0) + cheb(u, mejor), mueve: true };
    }
    const sx = u.x, sy = u.y, sr = u.recorrido;
    u.x = desde.x; u.y = desde.y; u.recorrido = desde.rec;
    const dmg = FM.calcularDano(est, u, t);
    let ret = 0;
    if (dmg < t.hp && cheb(desde, t) <= FM.ef(est, t).alc && CLASES[t.clase].atq > 1 && !FM.razonAgua(est, t, u)) ret = Math.max(1, Math.ceil(FM.calcularDano(est, t, u) * 0.6));
    u.x = sx; u.y = sy; u.recorrido = sr;
    return { dmg, ret, mata: dmg >= t.hp, mueve: !!desde.mueve, hpT: t.hp, desde };
  }

  function mostrarPrevia(x, y, html) {
    const el = $("frPrevia");
    if (!html) { el.classList.add("hidden"); return; }
    const p = tablero.pantallaDe(x, y);
    el.innerHTML = html;
    el.classList.remove("hidden");
    el.style.left = `${Math.max(8, Math.min(window.innerWidth - 240, p.x - 110))}px`;
    el.style.top = `${Math.max(60, p.y - 14 - el.offsetHeight - p.ts * 0.5)}px`;
  }
  function limpiarPrevia() { rutaPrevia = null; ataquePrevio = null; previaFija = null; mostrarPrevia(0, 0, null); }
  function limpiarPreviaVisual() { rutaPrevia = null; ataquePrevio = null; mostrarPrevia(0, 0, null); }

  /* Ratón encima de una casilla: ruta si es un destino, vista previa del combate si es un enemigo */
  function pasarPor(x, y) {
    rutaPrevia = null; ataquePrevio = null;
    mostrarPrevia(0, 0, null);
    if (!est) return;
    const u = sel.uid && est.unidades[sel.uid];
    if (x >= 0 && u && u.dueno === humano() && soyYo() && !modo && !tablero.ocupado()) calcularPrevia(u, x, y);
    else if (x >= 0 && !modo) previaInfo(x, y);
    pintarResaltes();
  }
  /* Sin nada elegido: el ratón sobre una tropa o una ciudad dice qué es */
  function previaInfo(x, y) {
    const H = humano();
    if (!FM.veCasilla(est, H, x, y)) return;
    let t = FM.unidadEn(est, x, y);
    if (t && FM.oculta(est, t, H)) t = null;
    if (t) { const e = FM.ef(est, t), tr = tropaDe(t); mostrarPrevia(x, y, `<b>${esc(FM.nombreUnidad(t))}</b><span>${esc(tr.nombre)} · ${t.dueno >= 0 ? esc(FACCIONES[est.jugadores[t.dueno].faccion].corto) : "sin dueño"}</span><span class="fr-previa-cifras">${ico("vida")}${t.hp}/${e.hpMax} ${ico("ataque")}${e.atq} ${ico("defensa")}${e.def}</span>`); }
  }
  function calcularPrevia(u, x, y) {
    const H = humano();
    const t = FM.unidadEn(est, x, y);
    if (t && FM.hostil(est, t.dueno, H) && FM.veUnidad(est, H, t)) {
      if (u.atacado) { mostrarPrevia(x, y, `<b>${esc(FM.nombreUnidad(t))}</b><span>Esta tropa ya atacó este turno</span>`); return; }
      const p = previaAtaque(u, t);
      // el motivo real por el que no se puede (tregua, noche, pólvora, alcance)
      const sx = u.x, sy = u.y, q = u.quieto;
      if (p && p.mueve) { u.x = p.desde.x; u.y = p.desde.y; u.quieto = false; }
      const razon = p ? FM.razonNoAtacar(est, u, t) : (FM.razonAgua(est, u, t) || ((FM.polvoraFac(est, u) || CLASES[u.clase].pesado) && cheb(u, t) > FM.ef(est, u).alc ? "No puede moverse y disparar: acércalo antes y dispara el turno siguiente" : "No llega este turno"));
      u.x = sx; u.y = sy; u.quieto = q;
      if (!p || razon) { mostrarPrevia(x, y, `<b>${esc(FM.nombreUnidad(t))}</b><span class="fr-previa-no">${esc(razon || "No llega este turno")}</span>`); return; }
      ataquePrevio = { x, y };
      const queda = Math.max(0, p.hpT - p.dmg);
      mostrarPrevia(x, y, `<b>${esc(FM.nombreUnidad(t))}</b>
        <span class="fr-previa-barra"><i style="width:${(queda / FM.ef(est, t).hpMax) * 100}%"></i><i class="pierde" style="width:${(Math.min(p.dmg, p.hpT) / FM.ef(est, t).hpMax) * 100}%"></i></span>
        <span>${p.mata ? "<strong>Lo derribas</strong>" : `Le quitas <strong>${p.dmg}</strong> de ${p.hpT}`}${p.ret ? ` · te responde <strong class="fr-neg">${p.ret}</strong>` : " · sin respuesta"}${p.mueve ? " · avanzas primero" : ""}</span>`);
    } else if (!t && u.pm > 0) {
      const info = FM.alcanzables(est, u);
      const n = info.destinos.get(`${x},${y}`);
      if (n) {
        rutaPrevia = FM.camino(info, x, y);
        const c = FM.casilla(est, x, y), ci = FM.ciudadEn(est, x, y);
        const cambiaAgua = !FM.esBarco(u) && (c.t === "agua") !== FM.enAgua(est, u);
        const nvU = FM.navalDe(est, u.dueno);
        const extra = cambiaAgua ? (c.t === "agua" ? ` · embarca${nvU.marinos || nvU.fondo ? "" : " y se queda sin movimiento"}` : " · desembarca") : ci && ci.dueno !== humano() ? " · tomas la ciudad" : c.est === "ruinas" && !c.saqueada ? " · registras las ruinas" : c.est === "fortaleza" ? " · tomas la fortaleza" : c.est === "nucleo" ? " · ocupas el Núcleo" : c.est === "costura" ? " · costura a otro fragmento" : "";
        mostrarPrevia(x, y, `<span>${ico("mov")} ${n.c} de ${u.pm}${D.TERRENOS[c.t].def ? ` · ${ico("defensa")}+${D.TERRENOS[c.t].def}` : ""}${extra}</span>`);
      }
    }
  }

  /* --- Tocar el mapa --- */
  async function tocar(x, y, tactil) {
    if (!est || est.ganador !== null) return;
    const H = humano();
    const u = sel.uid ? est.unidades[sel.uid] : null;
    const enCasilla = FM.unidadEn(est, x, y);
    const visible = FM.veCasilla(est, H, x, y) && !(enCasilla && FM.oculta(est, enCasilla, H));
    if (!soyYo()) {
      // fuera de mi turno solo se puede mirar
      if (enCasilla && visible) { sel = { uid: enCasilla.uid, ciudad: null }; refrescar(); }
      return;
    }
    // Habilidades que piden una casilla
    if (modo && u) {
      if (modo.casillas.has(`${x},${y}`)) {
        const r = aplicarYo(Object.assign({ t: "habilidad", uid: u.uid, x, y }, modo.acc));
        modo = null;
        if (!r.ok) { aviso(r.error, true); son("error"); }
        return despuesDeAccion();
      }
      modo = null; refrescar(); return;
    }
    if (enCasilla && enCasilla.dueno === H) { limpiarPrevia(); sel = { uid: enCasilla.uid, ciudad: null }; modo = null; son("elegir"); refrescar(); return; }
    if (u && u.dueno === H && enCasilla && FM.hostil(est, enCasilla.dueno, H) && visible) {
      // Atacar: si no llega desde donde está, se acerca primero
      const p = previaAtaque(u, enCasilla);
      if (u.atacado) { aviso("Esa tropa ya atacó este turno.", true); son("error"); return; }
      if (!p) { aviso(FM.razonAgua(est, u, enCasilla) || (FM.polvoraFac(est, u) || CLASES[u.clase].pesado ? "No puede moverse y disparar en el mismo turno." : "No llega hasta ahí este turno."), true); son("error"); return; }
      if (tactil && !(previaFija && previaFija.x === x && previaFija.y === y)) { previaFija = { x, y }; limpiarPreviaVisual(); calcularPrevia(u, x, y); pintarResaltes(); return; }
      limpiarPrevia();
      if (p.mueve) {
        const m = aplicarYo({ t: "mover", uid: u.uid, x: p.desde.x, y: p.desde.y });
        if (!m.ok) { aviso(m.error, true); son("error"); return; }
        if (est.ganador !== null || !est.unidades[u.uid]) return despuesDeAccion();
      }
      const a = aplicarYo({ t: "atacar", uid: u.uid, x: enCasilla.x, y: enCasilla.y });
      if (!a.ok) { aviso(a.error, true); son("error"); }
      return despuesDeAccion();
    }
    if (u && u.dueno === H && !enCasilla) {
      const info = FM.alcanzables(est, u);
      if (info.destinos.has(`${x},${y}`) && u.pm > 0) {
        if (tactil && !(previaFija && previaFija.x === x && previaFija.y === y)) { previaFija = { x, y }; limpiarPreviaVisual(); calcularPrevia(u, x, y); pintarResaltes(); return; }
        limpiarPrevia();
        const m = aplicarYo({ t: "mover", uid: u.uid, x, y });
        if (!m.ok) { aviso(m.error, true); son("error"); }
        return despuesDeAccion();
      }
    }
    limpiarPrevia();
    if (enCasilla && visible) { sel = { uid: enCasilla.uid, ciudad: null }; modo = null; son("clic"); refrescar(); return; }
    const ciudad = FM.ciudadEn(est, x, y);
    if (ciudad && est.vision[H][y * est.ancho + x] > 0) { sel = { uid: null, ciudad: ciudad.id }; modo = null; son("clic"); refrescar(); return; }
    // Una casilla vacía se inspecciona: terreno, provincia y lo que hay en ella
    if (est.vision[H][y * est.ancho + x] > 0 && FM.casilla(est, x, y).t !== "vacio" && !(sel.casilla && sel.casilla.x === x && sel.casilla.y === y)) { sel = { uid: null, ciudad: null, casilla: { x, y } }; modo = null; refrescar(); return; }
    sel = { uid: null, ciudad: null }; modo = null; son("soltar"); refrescar();
  }

  function despuesDeAccion() {
    limpiarPrevia();
    if (sel.uid && !est.unidades[sel.uid]) sel.uid = null;
    refrescar();
    guardarEnCurso();
    tablero.alTerminar(() => {
      procesarCronica();
      refrescar();
      if (est.ganador !== null) setTimeout(terminarGuerraUI, 600);
    });
  }

  /* --- Avisos de acontecimientos importantes (conquistas, bajas de mando, reliquias...) --- */
  let cronicaVista = 0, resumenDesde = 0;
  const TOAST = { conquista: ["Conquista", "⚑", "conq"], fortaleza: ["Fortaleza tomada", "⚑", "conq"], lider: ["Cae un líder", "☠", "baja"], heroico: ["Hazaña", "★", "oro"], reliquia: ["Reliquia", "◆", "oro"], nucleo: ["Núcleo del Sueño", "◎", "cian"],
    reanimacion: ["Vuelve de entre los muertos", "✦", "cian"], tecnologia: ["Conocimiento", "✎", ""], heroe: ["Llega un héroe", "✪", "oro"], heroe_cae: ["Cae un héroe", "☠", "baja"], eliminado: ["Un bando cae", "✕", "baja"], refugio: ["Refugio", "⌂", "conq"], pacto: ["Pacto", "⚭", "cian"], traicion: ["Traición", "⚡", "baja"] };
  function procesarCronica() {
    const nuevos = est.cronica.slice(cronicaVista);
    const base = cronicaVista;
    cronicaVista = est.cronica.length;
    nuevos.forEach((e, i) => {
      let t = TOAST[e.tipo];
      if (e.tipo === "caida") { if (!(e.capitan || (e.victorias || 0) >= 10)) return; t = [e.capitan ? "Cae un capitán" : "Cae un veterano", "☠", "baja"]; }
      if (e.tipo === "tecnologia" && e.dueno !== humano()) return;
      if (e.tipo === "suceso" || e.tipo === "sabotaje" || e.tipo === "fin") return;
      if (!t) return;
      toast(t[0], CR.frase(est, e, null, base + i) || "", t[1], t[2]);
    });
  }
  function toast(titulo, texto, icono, clase) {
    const cont = $("frToasts");
    const el = document.createElement("div");
    el.className = `fr-toast ${clase || ""}`;
    el.innerHTML = `<i aria-hidden="true">${esc(icono || "")}</i><div><b>${esc(titulo)}</b><span>${esc(texto)}</span></div>`;
    el.addEventListener("click", () => el.remove());
    cont.appendChild(el);
    while (cont.children.length > 4) cont.firstChild.remove();
    setTimeout(() => el.classList.add("sale"), 4600);
    setTimeout(() => el.remove(), 5100);
  }

  /* Al volver a mi turno: lo que pasó mientras jugaban los demás, en una tarjeta que no estorba */
  function resumenDeRonda() {
    const H = humano();
    const evs = est.cronica.slice(resumenDesde);
    resumenDesde = est.cronica.length;
    const filas = [];
    evs.forEach((e, i) => {
      const mio = e.dueno === H, j = e.dueno !== undefined && e.dueno !== null && est.jugadores[e.dueno] ? est.jugadores[e.dueno] : null;
      const col = j ? bandos[e.dueno].col : "#8f8498";
      if (e.tipo === "conquista" && !mio) filas.push([e.antes === H ? "baja" : "", "⚑", `${j ? esc(FACCIONES[j.faccion].corto) : "Alguien"} toma ${esc(e.ciudad)}${e.antes === H ? ", que era tuya" : ""}`, col]);
      else if (e.tipo === "caida" && mio) filas.push(["baja", "☠", `Cae ${esc(e.nombre)}${e.por ? `, a manos de ${esc(e.por)}` : ""}`, col]);
      else if (e.tipo === "lider") filas.push([mio ? "baja" : "", "☠", `Cae ${esc(e.nombre)}`, col]);
      else if (e.tipo === "heroe" && !mio) filas.push(["oro", "✪", `${j ? esc(FACCIONES[j.faccion].corto) : "Alguien"} invoca a ${esc(e.nombre)}`, col]);
      else if (e.tipo === "eliminado") filas.push(["baja", "✕", `${j ? esc(j.nombre) : "Un bando"} queda fuera de la guerra`, col]);
      else if (e.tipo === "nucleo" && !mio) filas.push(["cian", "◎", `${j ? esc(FACCIONES[j.faccion].corto) : "Alguien"} ocupa el Núcleo del Sueño`, col]);
      else if (e.tipo === "fortaleza" && !mio) filas.push(["", "⚑", `${j ? esc(FACCIONES[j.faccion].corto) : "Alguien"} toma una fortaleza`, col]);
      void i;
    });
    const el = $("frResumen");
    if (!filas.length) { el.classList.add("hidden"); return; }
    el.innerHTML = `<h4>Mientras tanto</h4><ul>${filas.slice(-6).map(f => `<li class="${f[0]}"><i style="color:${f[3]}">${f[1]}</i><span>${f[2]}</span></li>`).join("")}</ul>`;
    el.classList.remove("hidden", "sale");
    clearTimeout(resumenDeRonda.t);
    resumenDeRonda.t = setTimeout(() => { el.classList.add("sale"); setTimeout(() => el.classList.add("hidden"), 500); }, 7000);
  }
  $("frResumen").addEventListener("click", () => $("frResumen").classList.add("hidden"));

  /* --- Pista: una línea que dice qué se puede hacer ahora --- */
  function pendientes() { const H = humano(); return FM.unidadesDe(est, H).filter(u => !(u.desatado > 0) && (u.pm > 0 || !u.atacado) && u.quieto && !u.atacado); }
  function pintarPista() {
    const el = $("frPista");
    if (!ajustes.pistas || est.ganador !== null) { el.textContent = ""; return; }
    const H = humano(), u = sel.uid && est.unidades[sel.uid];
    let t = "";
    if (ocupadoIA || est.activo !== H) t = `Juega ${est.jugadores[est.activo].nombre}. Toca el mapa para saltar la animación.`;
    else if (modo) t = "Toca una casilla marcada en violeta, o cualquier otra para cancelar.";
    else if (u && u.dueno === H) t = u.pm > 0 || !u.atacado ? "Azul: adonde puede ir. Espadas: a quién puede atacar. Toca otra tropa para cambiar." : "Esta tropa ya ha hecho todo lo que podía este turno.";
    else if (sel.ciudad && est.ciudades[sel.ciudad] && est.ciudades[sel.ciudad].dueno === H) t = "En tus ciudades entrenas tropas, levantas edificios e invocas a tu héroe.";
    else { const n = pendientes().length; t = n ? `Tienes ${n} tropa${n === 1 ? "" : "s"} sin órdenes. Tócalas, o pulsa Siguiente.` : "No queda nada por mover. Mira tus ciudades o termina el turno."; }
    if (FM.enTregua(est) && est.activo === H && !modo && !u) t += ` Hay tregua ${est.tregua - est.turno + 1} turno${est.tregua - est.turno + 1 === 1 ? "" : "s"} más.`;
    el.textContent = t;
  }

  /* --- Mando: siguiente tropa y fin de turno --- */
  function pintarMando() {
    const mio = soyYo(), n = mio ? pendientes().length : 0;
    const sig = $("frSiguiente"), fin = $("frTerminar");
    sig.disabled = !mio || !n;
    sig.innerHTML = n ? `<b>${n}</b> sin órdenes <span>Siguiente ›</span>` : "Todas con órdenes";
    fin.disabled = !mio && !(tablero && tablero.ocupado());
    fin.classList.toggle("listo", mio && n === 0);
    $("frTerminarSub").textContent = est.ganador !== null ? "La guerra terminó" : mio ? (n ? `quedan ${n} por mover` : "todo hecho") : `juega ${FACCIONES[est.jugadores[est.activo].faccion].corto}`;
    document.querySelectorAll(".fr-mando [data-panel]").forEach(b => b.classList.toggle("activa", b.dataset.panel === panel));
    // lo que se puede hacer ahora en el saber y en las ciudades, con un punto de aviso
    const H = humano();
    const puedeSaber = mio && Object.keys(ESCUELAS).some(k => !FM.razonNoInvestigar(est, H, k));
    const puedeCiudad = mio && FM.ciudadesDe(est, H).some(c => !c.reclutado && FM.clasesDisponibles(est, H).some(cl => !FM.razonNoReclutar(est, H, c.id, cl)));
    document.querySelector('.fr-mando [data-panel="saber"]').classList.toggle("aviso", puedeSaber);
    document.querySelector('.fr-mando [data-panel="ciudades"]').classList.toggle("aviso", puedeCiudad);
    $("frAmenaza").classList.toggle("activa", verAmenaza);
  }
  function siguienteTropa() {
    const lista = pendientes();
    if (!lista.length) return;
    const i = lista.findIndex(u => u.uid === sel.uid);
    const u = lista[(i + 1) % lista.length];
    sel = { uid: u.uid, ciudad: null }; modo = null;
    tablero.irA(u.x, u.y);
    son("elegir");
    refrescar();
  }
  $("frSiguiente").addEventListener("click", siguienteTropa);

  /* --- Tarjeta de selección: tropa, ciudad o terreno --- */
  const NOMBRE_RASGO = FM.RASGO_NOMBRE;
  function accionesDeUnidad(u) {
    const H = humano(), jh = est.jugadores[H], fac = FACCIONES[jh.faccion], out = [];
    const ya = u.atacado ? "Ya actuó este turno." : null;
    const junto = (x, y) => Object.values(est.unidades).filter(w => cheb(w, { x, y }) <= 1);
    if (u.clase === "picaro") {
      Object.values(est.ciudades).filter(ci => esRival(ci.dueno) && cheb(ci, u) <= 1).forEach(ci => ci.edificios.filter(e => !(ci.desh[e] >= est.turno)).slice(0, 3).forEach(e =>
        out.push({ ic: "✂", nombre: `Sabotear ${EDIFICIOS[e].nombre}`, texto: `Deja sin uso ${EDIFICIOS[e].nombre} de ${ci.nombre} durante 3 turnos.`, razon: ya || (FM.enTregua(est) ? "Hay tregua." : null), acc: { id: "sabotear", x: ci.x, y: ci.y, edificio: e } })));
    }
    if ((u.clase === "arcanista" || u.clase === "archimago") && jh.tech.arcano >= 3) {
      ["llanura", "bosque", "desierto"].forEach(t => {
        const alc = FM.ef(est, u).alc, cas = new Set();
        for (let y = u.y - alc; y <= u.y + alc; y++) for (let x = u.x - alc; x <= u.x + alc; x++) { const c = FM.casilla(est, x, y); if (c && !c.est && !FM.unidadEn(est, x, y) && (D.TERRENOS[c.t].mov > 0 || c.t === "agua") && c.t !== t) cas.add(`${x},${y}`); }
        out.push({ ic: "✦", nombre: `Volver ${D.TERRENOS[t].nombre.toLowerCase()}`, texto: "Cambia el terreno de una casilla cercana. También seca una casilla de agua.", coste: { mana: 3 }, razon: ya || (u.enfriar > 0 ? `Le faltan ${u.enfriar} turnos.` : jh.recursos.mana < 3 ? "Hacen falta 3 de maná." : null), casillas: cas, acc: { id: "alterar", a: t } });
      });
    }
    if (jh.tech.tanato >= 3) est.tumbas.filter(t => cheb(t, u) <= 1 && !FM.unidadEn(est, t.x, t.y)).slice(0, 2).forEach(t =>
      out.push({ ic: "☥", nombre: `Reanimar a ${t.s ? t.s.nombre : "un caído"}`, texto: "Lo levanta a tu servicio con la mitad de la vida.", coste: { anima: 3 }, razon: ya || (jh.recursos.anima < 3 ? "Hacen falta 3 de Ánima." : null), acc: { id: "reanimar", x: t.x, y: t.y } }));
    if (u.clase === "sanador" && fac.mods.consagra) out.push({ ic: "☀", nombre: "Consagrar", texto: "Consagra esta casilla y las de alrededor: tus tropas ganan +1 de defensa y se curan 1 más en ellas.", razon: ya || (FM.consagradaPara(est, H, u.x, u.y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => !FM.casilla(est, u.x + dx, u.y + dy) || FM.consagradaPara(est, H, u.x + dx, u.y + dy)) ? "Este terreno ya está consagrado." : null), acc: { id: "consagrar" } });
    if (fac.mods.soborno && !u.heroe) junto(u.x, u.y).filter(w => w.dueno === -1).slice(0, 2).forEach(w => {
      const precio = FM.heroeVivo(est, H) && HEROES[FM.heroeVivo(est, H).heroe].ef.sobornoMitad ? Math.ceil(fac.mods.soborno / 2) : fac.mods.soborno;
      out.push({ ic: "¤", nombre: `Sobornar a ${FM.nombreUnidad(w)}`, texto: "La criatura lucha por ti 2 turnos.", coste: { oro: precio }, razon: ya || (jh.recursos.oro < precio ? "No te alcanza el oro." : null), acc: { id: "sobornar", x: w.x, y: w.y } });
    });
    if (u.heroe) {
      const h = HEROES[u.heroe];
      [[h.ef.activa, 1, u.cd], [h.ef.activa2, 2, u.cd2]].forEach(([ab, n, cd]) => {
        if (!ab) return;
        let razon = ya || (cd > 0 ? (cd > 50 ? "Solo se puede usar una vez." : `Le faltan ${cd} turnos.`) : ab.coste && !FM.puedePagar(jh, ab.coste) ? "No te alcanzan los recursos." : null);
        const base = { ic: "✪", nombre: ab.nombre, texto: ab.texto, coste: ab.coste, heroe: true };
        if (ab.id === "area" || ab.id === "muro") {
          const cas = new Set();
          for (let y = u.y - ab.alc; y <= u.y + ab.alc; y++) for (let x = u.x - ab.alc; x <= u.x + ab.alc; x++) {
            const c = FM.casilla(est, x, y);
            if (!c || c.t === "vacio") continue;
            if (ab.id === "muro" ? (!c.est && !FM.unidadEn(est, x, y) && D.TERRENOS[c.t].mov > 0) : junto(x, y).some(w => FM.hostil(est, w.dueno, H) && FM.veUnidad(est, H, w))) cas.add(`${x},${y}`);
          }
          if (!razon && !cas.size) razon = ab.id === "muro" ? "No hay sitio." : "No hay enemigos al alcance.";
          if (!razon && ab.id === "area" && FM.enTregua(est)) razon = "Hay tregua.";
          out.push(Object.assign(base, { razon, casillas: cas, acc: { id: "heroe", n } }));
        } else if (ab.id === "contratar") {
          const ws = junto(u.x, u.y).filter(w => w.dueno === -1);
          if (!ws.length) out.push(Object.assign(base, { razon: razon || "No hay ninguna criatura salvaje a su lado." }));
          ws.slice(0, 2).forEach(w => out.push(Object.assign({}, base, { nombre: `${ab.nombre}: ${FM.nombreUnidad(w)}`, razon, acc: { id: "heroe", n, x: w.x, y: w.y } })));
        } else out.push(Object.assign(base, { razon, acc: { id: "heroe", n } }));
      });
    }
    return out;
  }

  function estadosDeUnidad(u) {
    const e = FM.ef(est, u), out = [];
    if (u.hp <= e.hpMax * 0.45) out.push(["Herido", "baja"]);
    if (u.efectos && u.efectos.frenado >= est.turno) out.push(["Frenado", ""]);
    if (u.efectos && u.efectos.clavado) out.push(["Clavado", ""]);
    if (u.efectos && u.efectos.formado >= est.turno) out.push(["En formación", "oro"]);
    if (u.efectos && u.efectos.sinMando >= est.turno) out.push(["Sin capitán", "baja"]);
    if (u.desatado > 0) out.push([`Desatado ${u.desatado}`, "baja"]);
    if (u.sobornada !== undefined) out.push([`A sueldo hasta el turno ${u.sobornada}`, "oro"]);
    if (FM.polvoraFac(est, u) || CLASES[u.clase].pesado) out.push([u.quieto ? (CLASES[u.clase].pesado ? "Bombardas listas" : "Pólvora lista") : "Se movió: no dispara", u.quieto ? "oro" : ""]);
    if (FM.embarcada(est, u)) { const nv = FM.navalDe(est, u.dueno); out.push([nv.fondo ? "Por el fondo" : "Embarcada", nv.marinos ? "cian" : "baja"]); }
    if (est.hayNoche && u.dueno >= 0 && FACCIONES[est.jugadores[u.dueno].faccion].mods.noche && u.dueno === humano()) { const rivs = FM.rivalesDe(est, u.dueno); out.push(rivs.length && rivs.every(q => FM.oculta(est, u, q)) ? ["Oculta en la noche", "cian"] : ["A la vista", ""]); }
    (u.rasgos || []).forEach(k => out.push([NOMBRE_RASGO[k], "cian"]));
    if (u.dueno >= 0 && FM.consagradaPara(est, u.dueno, u.x, u.y)) out.push(["En suelo consagrado", "oro"]);
    if (u.s && u.s.luto) out.push([`De luto por ${u.s.luto.nombre}`, ""]);
    return out;
  }

  let accionesActuales = [];
  function pintarSeleccion() {
    const c = $("frSeleccion"), H = humano();
    const u = sel.uid && est.unidades[sel.uid];
    accionesActuales = [];
    if (u) {
      const e = FM.ef(est, u), tr = tropaDe(u), jug = u.dueno >= 0 ? est.jugadores[u.dueno] : null, mia = u.dueno === H;
      const b = u.dueno >= 0 ? bandos[u.dueno] : { col: "#8c8c8c", forma: "·" };
      const q = { faccion: jug ? jug.faccion : null, clase: u.clase, heroe: u.heroe || null, dueno: u.dueno };
      const retrato = u.s && FR ? `<canvas class="fr-sel-ret" data-ret="1"></canvas>` : figHtml(q, 84, 104, "fr-sel-fig");
      const rangoTxt = u.s ? `${S.rangoDe(u.s.victorias + (u.vicG || 0)).nombre}${u.s.spec ? ` · ${ESPECIALIZACIONES[u.s.spec].nombre}` : ""}${u.s.capitan ? " · Capitán" : ""}` : u.lider ? "Líder" : u.heroe ? `Héroe · nivel ${HEROES[u.heroe].nivel}` : "";
      const estados = estadosDeUnidad(u);
      if (mia && soyYo()) accionesActuales = accionesDeUnidad(u);
      const verFicha = u.s && ej && ej.soldados[u.s.id] ? `<button type="button" class="fr-enlace" data-ver-ficha="${u.s.id}">Ver su ficha</button>` : "";
      c.innerHTML = `<div class="fr-sel fr-sel-unidad" style="--c:${b.col}">
        <div class="fr-sel-lado">${retrato}<span class="fr-sel-bando"><i>${b.forma || ""}</i>${jug ? esc(FACCIONES[jug.faccion].corto) : "Sin dueño"}</span></div>
        <div class="fr-sel-cuerpo">
          <div class="fr-sel-cab"><h3>${esc(FM.nombreUnidad(u))}</h3><p>${esc(tr.nombre)}${rangoTxt ? ` · ${esc(rangoTxt)}` : ""}${u.s ? ` · ${u.s.victorias + (u.vicG || 0)} victorias` : ""} ${verFicha}</p></div>
          <div class="fr-vida"><i style="width:${Math.max(0, Math.min(100, (u.hp / e.hpMax) * 100))}%" class="${u.hp <= e.hpMax * 0.25 ? "roja" : u.hp <= e.hpMax * 0.5 ? "ambar" : ""}"></i><b>${u.hp} / ${e.hpMax}</b></div>
          <div class="fr-stats">
            <span title="Ataque">${ico("ataque")}<b>${e.atq}</b></span><span title="Defensa (más la del terreno: +${FM.defensaDelTerreno(est, u)})">${ico("defensa")}<b>${e.def}</b><small>+${FM.defensaDelTerreno(est, u)}</small></span>
            <span title="Movimiento que le queda este turno">${ico("mov")}<b>${mia ? `${u.pm}/${e.mov}` : e.mov}</b></span><span title="Alcance">${ico("alcance")}<b>${e.alc}</b></span>
            ${mia ? `<span class="fr-stat-estado ${u.atacado ? "gastado" : "listo"}">${u.atacado ? "Ya actuó" : "Puede atacar"}</span>` : ""}
          </div>
          ${estados.length ? `<div class="fr-estados">${estados.map(s => `<i class="${s[1]}">${esc(s[0])}</i>`).join("")}</div>` : ""}
          <p class="fr-sel-texto">${esc(tr.texto)}</p>
          ${FM.embarcada(est, u) ? `<p class="fr-sel-texto fr-sel-nota">${esc((() => { const nv = FM.navalDe(est, u.dueno); return nv.marinos ? "Va embarcada. Los suyos pelean igual sobre el agua." : nv.fondo ? "Cruza andando por el fondo. No puede atacar hasta salir del agua, pero conserva su defensa." : "Va embarcada: no puede atacar y no tiene defensa. Al desembarcar gasta el movimiento que le quede."; })())}</p>` : ""}
        </div>
        ${accionesActuales.length ? `<div class="fr-sel-acciones">${accionesActuales.map((a, i) => `<button type="button" class="fr-accion${a.razon ? " no" : ""}${modo && modo.i === i ? " activa" : ""}" data-accion="${i}" title="${esc(a.texto)}${a.razon ? ` — ${esc(a.razon)}` : ""}"><i>${a.ic}</i><span>${esc(a.nombre)}</span>${a.coste ? costeHtml(a.coste, est.jugadores[H]) : ""}${a.razon ? `<small>${esc(a.razon)}</small>` : ""}</button>`).join("")}</div>` : ""}
        <button type="button" class="fr-sel-x" data-soltar aria-label="Soltar la selección">×</button>
      </div>`;
      const ret = c.querySelector("[data-ret]");
      if (ret) FR.animar(ret, u.s, { faccion: jug ? jug.faccion : ej.faccion, anio: ej ? ej.anio : 1, herido: u.hp <= e.hpMax * 0.45, w: 84 });
      pintarFiguras(c);
      return;
    }
    const ci = sel.ciudad && est.ciudades[sel.ciudad];
    if (ci) { pintarCiudad(c, ci); return; }
    if (sel.casilla) { pintarCasilla(c, sel.casilla.x, sel.casilla.y); return; }
    // Nada elegido: tus tropas, de un vistazo
    const mias = FM.unidadesDe(est, H);
    c.innerHTML = `<div class="fr-sel fr-sel-lista"><div class="fr-tropas">${mias.map(u => {
      const e = FM.ef(est, u), hecho = !(u.pm > 0 || !u.atacado) || est.activo !== H;
      return `<button type="button" class="fr-tropa${hecho ? " hecha" : ""}" data-uid="${u.uid}" title="${esc(FM.nombreUnidad(u))} · ${esc(tropaDe(u).nombre)} · ${u.hp}/${e.hpMax}">${figHtml({ faccion: est.jugadores[H].faccion, clase: u.clase, heroe: u.heroe || null, dueno: H, sinAro: true }, 40, 48)}<i class="fr-tropa-vida"><b style="width:${(u.hp / e.hpMax) * 100}%" class="${u.hp <= e.hpMax * 0.25 ? "roja" : u.hp <= e.hpMax * 0.5 ? "ambar" : ""}"></b></i></button>`;
    }).join("")}</div></div>`;
    pintarFiguras(c);
  }

  function pintarCasilla(c, x, y) {
    const ca = FM.casilla(est, x, y), t = D.TERRENOS[ca.t], rg = est.regiones[ca.region], H = humano();
    const dueno = rg && rg.dueno !== null ? est.jugadores[rg.dueno] : null;
    const rinde = Object.keys(t.rinde).map(k => `<b>${ico(k)}${t.rinde[k]}</b>`).join("") || "<em>nada</em>";
    const que = ca.est ? { costura: "Une este fragmento con otro. Pisarla cuesta 1 de movimiento y te lleva al otro extremo.", nucleo: `Quien tenga aquí una tropa ${est.hold} turnos seguidos gana la guerra.`, ruinas: ca.saqueada ? "Ya se registraron." : "Quien las pise se lleva lo que guardan. Puede haber una reliquia.", fortaleza: "Se toma entrando en ella. Da defensa, vista y cuenta para dominar la provincia.", ciudad: "" }[ca.est] : "";
    c.innerHTML = `<div class="fr-sel fr-sel-casilla" style="--c:${dueno ? bandos[rg.dueno].col : "#8f8498"}">
      <div class="fr-sel-cuerpo">
        <div class="fr-sel-cab"><h3>${esc(t.nombre)}${ca.est ? ` · ${esc(D.ESTRUCTURAS[ca.est].nombre)}` : ""}</h3><p>${rg ? `${esc(rg.nombre)} · ${dueno ? (rg.dueno === H ? "provincia tuya" : `provincia de ${esc(FACCIONES[dueno.faccion].corto)}`) : "provincia sin dueño"} · estabilidad ${rg.estab}` : ""}</p></div>
        <div class="fr-stats"><span title="Lo que cuesta entrar">${ico("mov")}<b>${t.mov || "—"}</b></span><span title="Defensa que da a quien la ocupa">${ico("defensa")}<b>+${t.def + (ca.est ? D.ESTRUCTURAS[ca.est].def : 0)}</b></span><span title="Lo que rinde a una ciudad cercana" class="fr-coste">${rinde}</span>${FM.consagradaPara(est, H, x, y) ? `<span class="fr-stat-estado listo">Consagrada</span>` : ""}</div>
        ${que ? `<p class="fr-sel-texto">${esc(que)}</p>` : ""}${ca.t === "agua" ? `<p class="fr-sel-texto">Agua navegable. Los barcos se mueven por ella. ${FM.puedeEmbarcar(est, H) ? "Tus tropas pueden embarcar: entrar les gasta el movimiento, y embarcadas no atacan ni tienen defensa." : "Tus tropas no pueden embarcar todavía: hace falta un Muelle en alguna de tus ciudades."}</p>` : !t.mov ? `<p class="fr-sel-texto">No se puede pisar.</p>` : ""}${ca.vado ? `<p class="fr-sel-texto">Un vado: por aquí se cruza el río a pie.</p>` : ""}
        ${ca.objetos && ca.objetos.length ? `<p class="fr-sel-texto"><strong>En el suelo:</strong> ${ca.objetos.map(id => esc((est.reliquias[id] || {}).nombre || "algo")).join(", ")}</p>` : ""}
      </div><button type="button" class="fr-sel-x" data-soltar aria-label="Soltar la selección">×</button></div>`;
  }

  /* Una ciudad: lo que rinde, sus edificios en huecos, las tropas que entrena y el héroe del ejército */
  const RAMA = { eco: "Economía", mil: "Guerra", mag: "Magia" };
  function pintarCiudad(c, ci) {
    const H = humano(), mia = ci.dueno === H, jug = est.jugadores[H];
    const dueno = ci.dueno !== null ? est.jugadores[ci.dueno] : null, rg = est.regiones[ci.region];
    const cab = `<div class="fr-sel-cab"><h3>${ci.capital ? "★ " : ""}${esc(ci.nombre)}</h3><p>Nivel ${ci.nivel} · ${dueno ? (mia ? "tuya" : `de ${esc(FACCIONES[dueno.faccion].corto)}`) : "sin dueño"}${rg ? ` · ${esc(rg.nombre)}` : ""}</p>${ci.mercado ? `<p class="fr-sel-texto fr-sel-nota">Da 2 de oro por turno a quien lo tenga. Nikaalia lo necesita para llamar a su Don.</p>` : ""}</div>`;
    const edificios = ci.edificios.map(e => `<span class="fr-hueco lleno${ci.desh[e] >= est.turno ? " roto" : ""}" title="${esc(EDIFICIOS[e].texto)}${ci.desh[e] >= est.turno ? " (inutilizado por ahora)" : ""}"><i class="r-${EDIFICIOS[e].rama}"></i>${esc(EDIFICIOS[e].nombre)}</span>`).join("");
    if (!mia || !soyYo()) {
      c.innerHTML = `<div class="fr-sel fr-sel-ciudad" style="--c:${dueno ? bandos[ci.dueno].col : "#8f8498"}"><div class="fr-sel-cuerpo">${cab}
        ${ci.edificios.length ? `<div class="fr-huecos">${edificios}</div>` : `<p class="fr-sel-texto">${dueno ? "Sin edificios a la vista." : "Una ciudad sin dueño: se toma entrando en ella."}</p>`}
        ${mia ? "" : dueno ? `<p class="fr-sel-texto">${ci.capital ? "Es su capital: si cae, ese bando queda fuera de la guerra (salvo que tenga un refugio)." : "Se toma entrando en ella con una tropa."}</p>` : ""}</div>
        <button type="button" class="fr-sel-x" data-soltar aria-label="Soltar la selección">×</button></div>`;
      return;
    }
    const enHuecos = ci.edificios.filter(e => !EDIFICIOS[e].agua).length;
    const libres = ci.nivel + 2 - enHuecos;
    const nvC = FACCIONES[jug.faccion].naval || {}, conAgua = FM.aguaCerca(est, ci);
    const vacios = Array.from({ length: Math.max(0, libres) }, () => `<span class="fr-hueco vacio">libre</span>`).join("");
    const botonRecluta = cl => {
      const razon = FM.razonNoReclutar(est, H, ci.id, cl), tr = D.tropa(jug.faccion, cl), k = CLASES[cl];
      return `<button type="button" class="fr-recluta${razon ? " no" : ""}" data-recluta="${cl}" data-razon="${esc(razon || "")}" title="${esc(tr.aspecto ? `${tr.aspecto} ` : "")}${esc(tr.texto)}${razon ? ` — ${esc(razon)}` : ""}">
        ${figHtml({ faccion: jug.faccion, clase: cl, dueno: H, sinAro: true }, 46, 54)}
        <strong>${esc(tr.nombre)}</strong><span class="fr-recluta-cifras">${ico("vida")}${k.hp} ${ico("ataque")}${k.atq} ${ico("defensa")}${k.def}${k.alc > 1 ? ` ${ico("alcance")}${k.alc}` : ""}</span>
        ${costeHtml(FM.costeReclutar(est, H, cl, ci), jug)}${razon ? `<small>${esc(razon)}</small>` : ""}</button>`;
    };
    const clasesMias = FM.clasesDisponibles(est, H);
    const reclutas = clasesMias.filter(cl => !CLASES[cl].naval).map(botonRecluta).join("");
    const barcos = conAgua && !nvC.sinMuelle ? clasesMias.filter(cl => CLASES[cl].naval).map(botonRecluta).join("") : "";
    const notaMar = nvC.sinMuelle ? "Tu ejército no construye muelles ni barcos. Tus tropas cruzan el agua por su cuenta, despacio y sin defensa."
      : !conAgua ? "Esta ciudad no tiene agua a dos casillas: aquí no se puede hacer un muelle."
        : !ci.edificios.includes("muelle") ? "Construye un Muelle para botar barcos y para que tus tropas puedan embarcar." : "Los barcos salen al agua de al lado de la ciudad.";
    const obras = Object.keys(EDIFICIOS).filter(e => !ci.edificios.includes(e) && (!EDIFICIOS[e].solo || EDIFICIOS[e].solo === jug.faccion) && (!EDIFICIOS[e].agua || (conAgua && !nvC.sinMuelle))).map(e => {
      const razon = FM.razonNoConstruir(est, H, ci.id, e), ed = EDIFICIOS[e];
      return { e, ed, razon, orden: (razon ? 10 : 0) + ed.nivel };
    }).sort((a, b) => a.orden - b.orden).map(({ e, ed, razon }) => `<button type="button" class="fr-obra${razon ? " no" : ""}" data-construye="${e}" data-razon="${esc(razon || "")}" title="${esc(ed.texto)}${razon ? ` — ${esc(razon)}` : ""}"><i class="r-${ed.rama}" title="${RAMA[ed.rama]}"></i><strong>${esc(ed.nombre)}</strong>${costeHtml(FM.costeEdificio(est, H, e), jug)}<small>${esc(razon || ed.texto)}</small></button>`).join("");
    // el héroe del ejército
    let heroe = "";
    if (jug.heroeInvocado) { const hv = FM.heroeVivo(est, H); heroe = `<p class="fr-sel-texto">${hv ? `${esc(hv.nombre)} está en el campo.` : "Tu héroe ya cayó en esta guerra."}</p>`; }
    else heroe = jug.heroes.map(hf => {
      const h = HEROES[hf.id], rq = FM.requisitosHeroe(est, H, hf.id, ci.id);
      return `<div class="fr-heroe${rq.ok ? " listo" : ""}">${figHtml({ faccion: jug.faccion, clase: "heroe", heroe: hf.id, dueno: H, sinAro: true }, 60, 72)}
        <div><strong>${esc(hf.nombre)}</strong><small>${esc(h.titulo)}</small>
          <span class="fr-recluta-cifras">${ico("vida")}${h.hp} ${ico("ataque")}${h.atq} ${ico("defensa")}${h.def} ${ico("mov")}${h.mov}${h.alc > 1 ? ` ${ico("alcance")}${h.alc}` : ""}</span>
          <p>${esc(h.texto)}${h.ef.activa ? ` <em>${esc(h.ef.activa.nombre)}:</em> ${esc(h.ef.activa.texto)}` : ""}</p>
          <ul class="fr-requisitos">${rq.lista.map(r => `<li class="${r.ok ? "ok" : "no"}">${r.ok ? "✔" : "✖"} ${esc(r.texto)}${r.de && !r.ok ? ` <b>${r.lleva}/${r.de}</b>` : ""}</li>`).join("")}</ul>
          <button type="button" class="fr-btn fr-btn-chico${rq.ok ? " fr-btn-principal" : ""}" data-invoca="${hf.id}" data-razon="${esc(rq.ok ? "" : rq.razon)}">Invocar${rq.ok ? "" : " (falta algo)"}</button></div></div>`;
    }).join("");
    const costeCrecer = { materiales: 4 * ci.nivel, oro: 3 * ci.nivel };
    c.innerHTML = `<div class="fr-sel fr-sel-ciudad mia" style="--c:${bandos[H].col}">
      <div class="fr-sel-cuerpo">${cab}
        <div class="fr-ciudad-cols">
          <section><h4>Entrenar ${ci.reclutado ? "<small>ya entrenó este turno</small>" : ""}</h4><div class="fr-reclutas">${reclutas}</div>
            <h4 class="fr-h4-flota">Flota <small>${esc(nvC.nivel ? `marina: ${nvC.nivel.toLowerCase()}` : "")}</small></h4><p class="fr-sel-texto fr-sel-nota">${esc(notaMar)}</p>${barcos ? `<div class="fr-reclutas">${barcos}</div>` : ""}</section>
          <section><h4>Edificios <small>${enHuecos} de ${ci.nivel + 2}</small>${ci.nivel < 5 ? `<button type="button" class="fr-btn fr-btn-chico fr-crecer" data-mejora="${ci.id}"${FM.puedePagar(jug, costeCrecer) ? "" : " disabled"} title="Sube la ciudad de nivel: un hueco más y más oro">Crecer ${costeHtml(costeCrecer, jug)}</button>` : ""}</h4>
            <div class="fr-huecos">${edificios}${vacios}</div><div class="fr-obras">${obras}</div></section>
          <section><h4>Héroe</h4>${heroe}</section>
        </div>
      </div><button type="button" class="fr-sel-x" data-soltar aria-label="Soltar la selección">×</button></div>`;
    pintarFiguras(c);
  }

  $("frSeleccion").addEventListener("click", async ev => {
    const t = ev.target, H = humano();
    if (t.closest("[data-soltar]")) { sel = { uid: null, ciudad: null }; modo = null; son("soltar"); refrescar(); return; }
    const un = t.closest("[data-uid]");
    if (un) { const u = est.unidades[un.dataset.uid]; if (u) { sel = { uid: u.uid, ciudad: null }; modo = null; tablero.irA(u.x, u.y); son("elegir"); refrescar(); } return; }
    const vf = t.closest("[data-ver-ficha]");
    if (vf) { abrirFicha(vf.dataset.verFicha, true); return; }
    const ac = t.closest("[data-accion]");
    if (ac) {
      const i = +ac.dataset.accion, a = accionesActuales[i], u = sel.uid && est.unidades[sel.uid];
      if (!a || !u) return;
      if (a.razon) { aviso(a.razon, true); son("error"); return; }
      if (a.casillas) { modo = modo && modo.i === i ? null : { i, acc: a.acc, casillas: a.casillas }; son("clic"); refrescar(); return; }
      const r = aplicarYo(Object.assign({ t: "habilidad", uid: u.uid }, a.acc));
      if (!r.ok) { aviso(r.error, true); son("error"); } else son(a.acc.id === "consagrar" ? "consagra" : "magia");
      despuesDeAccion();
      return;
    }
    const bloqueado = t.closest("[data-razon]");
    if (bloqueado && bloqueado.dataset.razon) { aviso(bloqueado.dataset.razon, true); son("error"); return; }
    if (!soyYo()) return;
    let r = null;
    const rec = t.closest("[data-recluta]"), con = t.closest("[data-construye]"), mej = t.closest("[data-mejora]"), inv = t.closest("[data-invoca]");
    if (rec && sel.ciudad) { r = aplicarYo({ t: "reclutar", ciudad: sel.ciudad, clase: rec.dataset.recluta }); if (r.ok) son("recluta"); }
    else if (con && sel.ciudad) { r = aplicarYo({ t: "construir", ciudad: sel.ciudad, edificio: con.dataset.construye }); if (r.ok) son("obra"); }
    else if (mej) { r = aplicarYo({ t: "mejorar", ciudad: mej.dataset.mejora }); if (r.ok) son("obra"); }
    else if (inv && sel.ciudad) r = aplicarYo({ t: "invocar", ciudad: sel.ciudad, heroe: inv.dataset.invoca });
    if (r) { if (!r.ok) { aviso(r.error, true); son("error"); } despuesDeAccion(); }
    void H;
  });

  /* --- Paneles de la derecha: saber, ciudades, bandos y crónica --- */
  const TITULO_PANEL = { saber: "Saber", ciudades: "Ciudades y provincias", bandos: "Bandos", registro: "Crónica de la guerra" };
  function abrirPanel(p) {
    panel = panel === p ? null : p;
    $("frPanel").classList.toggle("hidden", !panel);
    reservarVista();
    if (panel) pintarPanel();
    pintarMando();
  }
  document.querySelector(".fr-mando-fila").addEventListener("click", ev => { const b = ev.target.closest("[data-panel]"); if (b) { son("clic"); abrirPanel(b.dataset.panel); } });
  $("frPanelCerrar").addEventListener("click", () => { panel = null; $("frPanel").classList.add("hidden"); reservarVista(); pintarMando(); });

  function pintarPanel() {
    $("frPanelTitulo").textContent = TITULO_PANEL[panel] || "";
    const c = $("frPanelCuerpo");
    ({ saber: panelSaber, ciudades: panelCiudades, bandos: panelBandos, registro: panelRegistro }[panel])(c);
  }
  /* El saber como árbol: tres ramas, cuatro escalones cada una, de abajo arriba */
  function panelSaber(c) {
    const H = humano(), jug = est.jugadores[H], fac = FACCIONES[jug.faccion];
    c.innerHTML = `<p class="fr-sub">Cada escalón pide el anterior. Lo que cuesta se paga en maná y oro.</p><div class="fr-arbol-saber">${Object.keys(ESCUELAS).map(k => {
      const e0 = ESCUELAS[k], tope = k === "arcano" && fac.mods.arcanoMax ? fac.mods.arcanoMax : 4;
      return `<div class="fr-rama fr-rama-${k}"><h4>${esc(e0.nombre)}</h4>${e0.escalones.map((e, i) => {
        const hecho = jug.tech[k] > i, sig = jug.tech[k] === i, vedado = i >= tope;
        const razon = sig && !vedado ? FM.razonNoInvestigar(est, H, k) || (!soyYo() ? "No es tu turno." : "") : "";
        const coste = sig ? FM.costeInvestigar(est, H, k) : e.coste;
        return `<button type="button" class="fr-nodo${hecho ? " hecho" : sig && !vedado ? (razon ? " sig no" : " sig") : " lejos"}${vedado ? " vedado" : ""}" ${sig && !vedado ? `data-investiga="${k}" data-razon="${esc(razon)}"` : "disabled"} title="${esc(e.texto)}${razon ? ` — ${esc(razon)}` : ""}">
          <b>${["I", "II", "III", "IV"][i]}</b><strong>${esc(e.nombre)}</strong><small>${esc(e.texto)}</small>${hecho ? "<em>Dominado</em>" : vedado ? "<em>Fuera del alcance de tu ejército</em>" : costeHtml(coste, sig ? jug : null)}</button>`;
      }).join('<i class="fr-nodo-une"></i>')}</div>`;
    }).join("")}</div>`;
  }
  function panelCiudades(c) {
    const H = humano();
    const vis = Object.values(est.ciudades).filter(ci => ci.dueno === H || est.vision[H][ci.y * est.ancho + ci.x] > 0).sort((a, b) => (a.dueno === H ? 0 : 1) - (b.dueno === H ? 0 : 1));
    c.innerHTML = `<div class="fr-lista-panel">${vis.map(ci => {
      const col = ci.dueno !== null ? bandos[ci.dueno].col : "#8f8498", mia = ci.dueno === H;
      const puede = mia && soyYo() && !ci.reclutado && FM.clasesDisponibles(est, H).some(cl => !FM.razonNoReclutar(est, H, ci.id, cl));
      return `<button type="button" class="fr-fila-ciudad" data-ciu="${ci.id}" style="--c:${col}"><i></i><span><strong>${ci.capital ? "★ " : ""}${esc(ci.nombre)}</strong><small>${ci.dueno === null ? "Sin dueño" : mia ? "Tuya" : esc(FACCIONES[est.jugadores[ci.dueno].faccion].corto)} · nivel ${ci.nivel} · ${ci.edificios.length} edificio${ci.edificios.length === 1 ? "" : "s"}</small></span>${puede ? "<em>puede entrenar</em>" : ""}</button>`;
    }).join("")}</div>
    <h4 class="fr-h4">Provincias</h4><div class="fr-lista-panel">${est.regiones.filter(r => { for (let y = 0; y < est.alto; y++) for (let x = 0; x < est.ancho; x++) if (est.casillas[y][x].region === r.id && est.vision[H][y * est.ancho + x] > 0) return true; return false; }).map(r =>
      `<button type="button" class="fr-fila-ciudad" data-region="${r.id}" style="--c:${r.dueno !== null ? bandos[r.dueno].col : "#8f8498"}"><i></i><span><strong>${esc(r.nombre)}</strong><small>${r.dueno === null ? "Sin dueño" : r.dueno === H ? "Tuya" : esc(FACCIONES[est.jugadores[r.dueno].faccion].corto)} · ${r.tipo} · estabilidad ${r.estab}</small></span></button>`).join("")}</div>
    <p class="fr-sub">Una provincia es de quien tiene su ciudad o su fortaleza. Las inestables (estabilidad baja) dan sorpresas: criaturas, cambios de terreno.</p>`;
  }
  function panelBandos(c) {
    const H = humano();
    const orden = est.jugadores.map((j, i) => ({ j, i, p: FM.puntuacion(est, i) })).sort((a, b) => (a.j.eliminado ? 1 : 0) - (b.j.eliminado ? 1 : 0) || b.p - a.p);
    const maxP = Math.max(1, ...orden.map(o => o.p));
    const yoFuera = est.jugadores[H].eliminado, varios = est.jugadores.length > 2;
    const rTraicion = FM.razonNoTraicion(est, H);
    const hayAQuien = rTraicion !== "No tienes a quién traicionar.";
    c.innerHTML = `<div class="fr-marcador">${orden.map(({ j, i, p }) => {
      const b = bandos[i], fac = FACCIONES[j.faccion];
      let dipl = "";
      if (varios && i !== H && !j.eliminado && !yoFuera && est.ganador === null) {
        if (FM.hayPacto(est, i, H)) dipl = `<span class="fr-marca-dipl"><em class="fr-pacto-si">⚭ Pacto en vigor</em></span>`;
        else if (!FM.equipoFijo(est, i, H)) {
          const rp = FM.razonNoPacto(est, H, i), pend = est.ofertas.some(o => o.de === H && o.a === i);
          dipl = `<span class="fr-marca-dipl"><button type="button" class="fr-btn fr-btn-chico${rp ? " no" : ""}" data-pacto="${i}" data-razon="${esc(pend ? "Tu propuesta sigue sobre la mesa." : rp || "")}">${pend ? "Propuesta enviada" : "Proponer pacto"}</button>${j.traidor ? `<em class="fr-traidor">traidor</em>` : ""}</span>`;
        }
      }
      return `<div class="fr-marca${j.eliminado ? " fuera" : ""}${i === H ? " yo" : ""}" style="--c:${b.col}">
        ${figHtml({ faccion: j.faccion, clase: "lider", dueno: i, sinAro: true }, 44, 52)}
        <div><strong><i>${b.forma}</i> ${esc(j.nombre)}</strong><small>${esc(fac.nombre)}${i === H ? " · eres tú" : FM.hayPacto(est, i, H) ? " · pacto" : FM.mismoEquipo(est, i, H) ? " · aliado" : ""}${j.eliminado ? " · eliminado" : ""}</small>
          <span class="fr-marca-barra"><b style="width:${(p / maxP) * 100}%"></b></span>
          <span class="fr-marca-datos">${p} puntos · ⌂ ${FM.ciudadesDe(est, i).length} · ▣ ${est.regiones.filter(r => r.dueno === i).length} provincias · ☠ ${est.stats.bajas[i]} bajas${j.heroeInvocado ? ` · ✪ ${esc((j.heroes.find(h => h.id === j.heroeInvocado) || {}).nombre || "héroe")}` : ""}${j.liderMuerto ? " · sin líder" : ""}</span>
          <small>${esc(fac.ventaja)}</small>${dipl}</div></div>`;
    }).join("")}</div>
    ${varios ? `<div class="fr-diplomacia"><h4 class="fr-h4">Pactos y traición</h4>
      <p class="fr-sub">Con un pacto no os atacáis y veis lo que ve el otro. Solo puedes tener uno y no comparte la victoria: si al final solo quedáis vosotros, se rompe. Traicionar se puede una vez por guerra y, pasada la tregua, cuesta la cuarta parte de tus soldados, que se niegan y desertan. Los demás bandos pueden acabar reclutándolos.</p>
      ${hayAQuien && !yoFuera && est.ganador === null ? `<button type="button" class="fr-btn fr-btn-chico fr-btn-peligro${rTraicion ? " no" : ""}" data-traiciona="1" data-razon="${esc(rTraicion || "")}">Traicionar${est.jugadores[H].equipo !== null && est.jugadores[H].equipo !== undefined ? " a tu equipo" : ""}</button>` : ""}</div>` : ""}
    <p class="fr-sub">Se gana tomando capitales hasta quedar solo${est.jugadores.some(j => j.equipo !== null && j.equipo !== undefined) ? " (con tu equipo)" : ""}, teniendo una tropa ${est.hold} turnos seguidos sobre el Núcleo del Sueño o con más puntos al acabar el turno ${est.maxTurnos}. Puntos: 3 por ciudad, 2 por fortaleza y por provincia, 1 por baja enemiga.</p>`;
    pintarFiguras(c);
  }
  const ICONO_LOG = { combate: "⚔", muerte: "☠", conquista: "⚑", lider: "☠", heroico: "★", reliquia: "◆", recluta: "＋", obra: "▣", tecnologia: "✎", magia: "✦", nucleo: "◎", hambre: "⚠", suceso: "~", turno: "⏱", fin: "■", botin: "◇", sabotaje: "✂", compania: "⚑", heroe: "✪", pacto: "⚭" };
  let filtroLog = "todo";
  function panelRegistro(c) {
    const FILTRO = { todo: null, combate: ["combate", "muerte", "lider", "heroico"], conquistas: ["conquista", "nucleo", "heroe", "fin", "pacto"], gestion: ["recluta", "obra", "tecnologia", "botin", "reliquia", "magia"] };
    const tipos = FILTRO[filtroLog];
    const lineas = est.log.filter(l => !tipos || tipos.includes(l.tipo)).slice(-80).reverse();
    let turno = null;
    c.innerHTML = `<div class="fr-filtros">${Object.keys(FILTRO).map(f => `<button type="button" class="${filtroLog === f ? "activa" : ""}" data-filtro="${f}">${{ todo: "Todo", combate: "Combate", conquistas: "Conquistas", gestion: "Gestión" }[f]}</button>`).join("")}</div>
      <ol class="fr-registro">${lineas.map(l => { const cab = l.t !== turno ? `<li class="fr-log-turno">Turno ${l.t}</li>` : ""; turno = l.t; return `${cab}<li class="fr-log-${esc(l.tipo)}"><i aria-hidden="true">${ICONO_LOG[l.tipo] || "·"}</i><span>${esc(l.texto)}</span></li>`; }).join("")}</ol>`;
  }
  $("frPanelCuerpo").addEventListener("click", ev => {
    const t = ev.target, H = humano();
    const f = t.closest("[data-filtro]");
    if (f) { filtroLog = f.dataset.filtro; pintarPanel(); return; }
    const ciu = t.closest("[data-ciu]");
    if (ciu) { const ci = est.ciudades[ciu.dataset.ciu]; sel = { uid: null, ciudad: ci.id }; tablero.irA(ci.x, ci.y); son("clic"); refrescar(); return; }
    const rg = t.closest("[data-region]");
    if (rg) { const r = est.regiones[+rg.dataset.region]; if (r && r.sitio) tablero.irA(r.sitio.x, r.sitio.y); return; }
    const pac = t.closest("[data-pacto]");
    if (pac) {
      if (pac.dataset.razon) { aviso(pac.dataset.razon, true); son("error"); return; }
      const k = +pac.dataset.pacto, r = aplicarYo({ t: "pacto", con: k });
      if (!r.ok) { aviso(r.error, true); son("error"); }
      else if (r.pendiente) aviso(`Propuesta enviada a ${est.jugadores[k].nombre}.`);
      else if (r.aceptado) { son("aviso"); } else { aviso(`${est.jugadores[k].nombre} rechaza el pacto.`, true); son("error"); }
      despuesDeAccion();
      return;
    }
    const tra = t.closest("[data-traiciona]");
    if (tra) {
      if (tra.dataset.razon) { aviso(tra.dataset.razon, true); son("error"); return; }
      const seVan = FM.desertoresDe(est, H).map(u => FM.nombreUnidad(u));
      dialogo.confirmar(`Dejas de ser aliado y quedas en guerra con todos. Solo se puede una vez.${seVan.length ? ` Desertan ${seVan.length}: ${seVan.join(", ")}.` : ""} Ningún otro bando volverá a pactar contigo.`, { titulo: "Traicionar", aceptar: "Traicionar", peligro: true }).then(si => {
        if (!si) return;
        const r = aplicarYo({ t: "traicionar" });
        if (!r.ok) { aviso(r.error, true); son("error"); } else son("derrota");
        despuesDeAccion();
      });
      return;
    }
    const inv = t.closest("[data-investiga]");
    if (inv) {
      if (inv.dataset.razon) { aviso(inv.dataset.razon, true); son("error"); return; }
      const r = aplicarYo({ t: "investigar", escuela: inv.dataset.investiga });
      if (!r.ok) { aviso(r.error, true); son("error"); } else son("saber");
      despuesDeAccion();
    }
    void H;
  });

  /* --- Minimapa --- */
  const COLOR_MINI = { llanura: "#6f8a44", bosque: "#3f6b3a", montana: "#8a8276", desierto: "#c8a567", agua: "#2f6f8f", magica: "#8a6ac0", huesos: "#a39c8a" };
  let miniPendiente = false;
  function pintarMiniPronto() { if (miniPendiente) return; miniPendiente = true; requestAnimationFrame(() => { miniPendiente = false; pintarMini(); }); }
  function pintarMini() {
    const cv = $("frMini");
    if (!est || !cv || !tablero) return;
    const H = humano(), vis = est.vision[H], w = est.ancho, h = est.alto;
    const ancho = window.innerWidth < 760 ? 112 : 172, k = ancho / w, alto = Math.round(h * k), dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(ancho * dpr) || cv.height !== Math.round(alto * dpr)) { cv.width = Math.round(ancho * dpr); cv.height = Math.round(alto * dpr); cv.style.width = `${ancho}px`; cv.style.height = `${alto}px`; }
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#0b1622"; g.fillRect(0, 0, ancho, alto);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = est.casillas[y][x], v = vis[y * w + x];
      if (c.t === "vacio") continue;
      if (v === 0) { g.fillStyle = "#1b1a26"; g.fillRect(x * k, y * k, k + 0.5, k + 0.5); continue; }
      g.fillStyle = COLOR_MINI[c.t] || "#6f8a44"; g.globalAlpha = v === 2 ? 1 : 0.5; g.fillRect(x * k, y * k, k + 0.5, k + 0.5); g.globalAlpha = 1;
      const d = c.region >= 0 ? est.regiones[c.region].dueno : null;
      if (d !== null) { g.fillStyle = bandos[d].col; g.globalAlpha = 0.34; g.fillRect(x * k, y * k, k + 0.5, k + 0.5); g.globalAlpha = 1; }
    }
    Object.values(est.ciudades).forEach(c => { if (vis[c.y * w + c.x] === 0) return; g.fillStyle = "#0a0810"; g.fillRect(c.x * k - 1, c.y * k - 1, k + 2, k + 2); g.fillStyle = c.dueno !== null ? bandos[c.dueno].col : "#d8d2c4"; g.fillRect(c.x * k, c.y * k, k, k); });
    g.fillStyle = "#fff0b0"; g.fillRect(est.nucleo.x * k + k * 0.2, est.nucleo.y * k + k * 0.2, k * 0.6, k * 0.6);
    Object.values(est.unidades).forEach(u => {
      if (!(u.dueno === H || (vis[u.y * w + u.x] === 2 && !FM.oculta(est, u, H)))) return;
      g.fillStyle = "#0a0810"; g.beginPath(); g.arc((u.x + 0.5) * k, (u.y + 0.5) * k, k * 0.46, 0, 7); g.fill();
      g.fillStyle = u.dueno >= 0 ? bandos[u.dueno].col : "#b0a8a0"; g.beginPath(); g.arc((u.x + 0.5) * k, (u.y + 0.5) * k, k * 0.32, 0, 7); g.fill();
    });
    const v = tablero.vista();
    g.strokeStyle = "#fff4d6"; g.lineWidth = 1.5;
    g.strokeRect(Math.max(0.75, v.x0 * k), Math.max(0.75, v.y0 * k), Math.min(ancho - 1.5, (v.x1 - v.x0) * k), Math.min(alto - 1.5, (v.y1 - v.y0) * k));
  }
  (function () {
    const cv = $("frMini");
    let abajo = false;
    const ir = ev => { if (!est || !tablero) return; const r = cv.getBoundingClientRect(); tablero.irA(((ev.clientX - r.left) / r.width) * est.ancho - 0.5, ((ev.clientY - r.top) / r.height) * est.alto - 0.5, false); };
    cv.addEventListener("pointerdown", ev => { abajo = true; cv.setPointerCapture(ev.pointerId); ir(ev); });
    cv.addEventListener("pointermove", ev => { if (abajo) ir(ev); });
    ["pointerup", "pointercancel"].forEach(n => cv.addEventListener(n, () => { abajo = false; }));
  })();

  /* --- Botones de la vista --- */
  $("frVistaMapa").addEventListener("click", ev => {
    const b = ev.target.closest("[data-vista]");
    if (!b || !tablero) return;
    const v = b.dataset.vista;
    son("clic");
    if (v === "mas") tablero.zoom(1.35);
    else if (v === "menos") tablero.zoom(1 / 1.35);
    else if (v === "tropas") tablero.centrar();
    else if (v === "todo") tablero.verTodo();
    else if (v === "amenaza") { verAmenaza = !verAmenaza; refrescar(); }
    else if (v === "pantalla") pantallaCompleta();
  });
  function pantallaCompleta() { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); }
  /* Pantalla completa: vale en todo el juego (portada, cuartel y guerra) y no se sale sola al cambiar de pantalla */
  document.addEventListener("fullscreenchange", () => {
    const si = !!document.fullscreenElement;
    const b = $("frPantallaCompleta"); if (b) b.textContent = si ? "✕" : "⛶";
    document.body.classList.toggle("fr-pantalla-completa", si);
    const f = $("frSalirCompleta"); if (f) f.classList.toggle("hidden", !si);
  });
  document.addEventListener("keydown", ev => {
    if (ev.key.toLowerCase() !== "f" || ev.ctrlKey || ev.metaKey || ev.altKey || ev.target.closest("input, textarea, select") || !document.documentElement.requestFullscreen) return;
    pantallaCompleta();
  });
  $("frSalirCompleta").addEventListener("click", pantallaCompleta);

  /* --- Teclado --- */
  document.addEventListener("keydown", ev => {
    if (!est || $("frGuerra").classList.contains("hidden") || ev.target.closest("input, textarea, select, dialog[open]")) return;
    if (document.querySelector("dialog[open]")) return;
    const k = ev.key.toLowerCase();
    if (k === "n" || k === "tab") { ev.preventDefault(); siguienteTropa(); }
    else if (k === "e") $("frTerminar").click();
    else if (k === "c") tablero.centrar();
    else if (k === "a") { verAmenaza = !verAmenaza; refrescar(); }
    else if (k === "i") abrirPanel("saber");
    else if (k === "+" || k === "=") tablero.zoom(1.25);
    else if (k === "-") tablero.zoom(0.8);
    else if (k === "escape") {
      if (tablero.ocupado()) return;
      if (modo) { modo = null; refrescar(); }
      else if (sel.uid || sel.ciudad || sel.casilla) { sel = { uid: null, ciudad: null }; refrescar(); }
      else if (panel) abrirPanel(panel);
      else abrirMenu();
    }
  });

  /* --- Fin del turno y turnos de los demás --- */
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  $("frTerminar").addEventListener("click", async () => {
    if (!est) return;
    if (tablero.ocupado()) { tablero.saltar(); return; }
    if (!soyYo()) return;
    const n = pendientes().filter(u => !u.lider).length;
    if (n >= 3 && !(await dialogo.confirmar(`Tienes ${n} tropas sin órdenes. ¿Terminar el turno?`, { aceptar: "Terminar" }))) return;
    sel = { uid: null, ciudad: null }; modo = null; limpiarPrevia();
    $("frResumen").classList.add("hidden");
    resumenDesde = est.cronica.length;
    aplicarYo({ t: "terminar" });
    son("clic");
    if (pvp) { refrescar(); await enviarTurnoMesa("turno"); return; }
    await turnosDeLosDemas();
  });

  /* Los demás bandos juegan de uno en uno: cartel con su nombre, y lo que se ve de su turno se anima */
  async function turnosDeLosDemas() {
    const H = humano();
    ocupadoIA = true;
    refrescar();
    let guarda = 0;
    // En una mesa solo se juegan aquí los turnos de la máquina: al llegar a otro jugador se espera a que mande el suyo
    while (est.ganador === null && est.activo !== H && guarda++ < 12 && !(pvp && pvp.mesa && pvp.humanos[est.activo])) {
      const j = est.activo, jug = est.jugadores[j];
      cartel(`Turno de ${FACCIONES[jug.faccion].corto}`, 0, null, bandos[j].col);
      son("turnoRival");
      pintarBandos(); pintarMando(); pintarPista();
      await esperar(380);
      const antes = tablero.instantanea();
      const evs = [];
      const original = FM.aplicar;
      FM.aplicar = (e, a) => { const r = original(e, a); if (r && r.ok && r.ev) evs.push(...r.ev); return r; };
      try { IA.turnoCompleto(est, j); } finally { FM.aplicar = original; }
      // Solo se anima lo que el jugador llega a ver
      const ve = (x, y) => x !== undefined && FM.dentro(est, Math.round(x), Math.round(y)) && FM.veCasilla(est, H, Math.round(x), Math.round(y));
      const escondida = e => { const w = e.uid && est.unidades[e.uid]; return !!(w && FM.oculta(est, w, H)); };
      const vistos = evs.filter(e => e.k === "mov" ? (!escondida(e) && (ve(e.de.x, e.de.y) || ve(e.a.x, e.a.y))) : ve(e.x, e.y));
      cartel(null);
      if (vistos.length) await new Promise(res => tablero.reproducir(vistos, antes, { tope: 4200, rapidez: 0.8, seguir: true, alTerminar: res }));
      else { tablero.redibujar(); await esperar(120); }
      procesarCronica();
      refrescar();
    }
    if (pvp && pvp.mesa) avanzarMaquina(est, pvp.humanos);
    ocupadoIA = false;
    guardarEnCurso();
    refrescar();
    if (est.ganador !== null) { setTimeout(terminarGuerraUI, 600); return; }
    if (pvp && pvp.mesa) { estadoMesa(); return; }
    cartel(`Turno ${est.turno}`, 1100, `de ${est.maxTurnos}`);
    son("turno");
    resumenDeRonda();
    const cap = est.capitales[H];
    if (cap) tablero.onda(cap.x, cap.y, "#f0d278");
    atenderOfertas();
  }

  /* Propuestas de pacto que otros bandos le han hecho al jugador: se contestan al empezar su turno */
  async function atenderOfertas() {
    const H = humano();
    if (!est || est.ganador !== null || !soyYo()) return;
    for (const o of est.ofertas.filter(q => q.a === H)) {
      const quien = est.jugadores[o.de];
      const si = await dialogo.confirmar(`${quien.nombre} (${FACCIONES[quien.faccion].corto}) te propone un pacto. No os atacaréis y veréis lo que ve el otro. Solo puedes tener un pacto, y no comparte la victoria.`, { titulo: "Propuesta de pacto", aceptar: "Aceptar", cancelar: "Rechazar" });
      if (!est || est.ganador !== null) return;
      const r = aplicarYo({ t: "responder", de: o.de, si: !!si });
      if (!r.ok && si) aviso(r.error, true);
      despuesDeAccion();
    }
  }

  async function rendirse() {
    if (!est || est.ganador !== null || est.activo !== humano()) { aviso("Solo puedes rendirte en tu turno.", true); return; }
    if (pvp && pvp.mesa) {
      if (!(await dialogo.confirmar(`Tu ejército queda fuera de la guerra${pvp.conApuestas ? " y pierdes lo que hayas apostado" : ""}. La guerra sigue para los demás.`, { titulo: "Rendirse", aceptar: "Rendirme", peligro: true }))) return;
      FM.rendir(est, yoIdx);
      tablero.redibujar(); refrescar();
      await enviarTurnoMesa("rendicion");
      return;
    }
    if (!(await dialogo.confirmar("Rendirte cuenta como derrota. Los soldados que lleves conservan lo que hayan ganado.", { titulo: "Rendirse", aceptar: "Rendirme", peligro: true }))) return;
    const rivales = FM.rivalesDe(est, yoIdx).sort((a, b) => FM.puntuacion(est, b) - FM.puntuacion(est, a));
    FM.terminarGuerra(est, rivales.length ? rivales[0] : "empate", `${est.jugadores[yoIdx].nombre} se rinde.`);
    refrescar();
    terminarGuerraUI();
  }

  function cartel(t, ms, sub, color) {
    const el = $("frCartel");
    el.innerHTML = t ? `<strong>${esc(t)}</strong>${sub ? `<span>${esc(sub)}</span>` : ""}` : "";
    el.style.setProperty("--c", color || "#f0cf6a");
    el.classList.toggle("hidden", !t);
    clearTimeout(cartel.t);
    if (t && ms) cartel.t = setTimeout(() => el.classList.add("hidden"), ms);
  }

  /* --- Menú de la guerra, ajustes y ayuda --- */
  function abrirMenu() { son("clic"); $("frMenuJuego").showModal(); }
  $("frMenu").addEventListener("click", abrirMenu);
  $("frMenuJuego").addEventListener("click", async ev => {
    const b = ev.target.closest("[data-mj]");
    if (!b) return;
    const m = b.dataset.mj;
    $("frMenuJuego").close();
    if (m === "ayuda") abrirAyuda();
    else if (m === "ajustes") abrirAjustes();
    else if (m === "rendirse") rendirse();
    else if (m === "salir") {
      if (est && est.ganador === null && !pvp) Red.guardarGuerra(est, cfgGuerraActual);
      musicaPartida(false); pararSondeo();
      const aMesas = !!pvp;
      pvp = null; yoIdx = 0;
      entrarCuartel(aMesas ? "duelos" : "guerra");
    }
  });
  function abrirAjustes() {
    const c = $("frAjustesCuerpo");
    const vol = SON ? SON.volumen() : 0.6, mudo = SON ? SON.silencio() : false;
    c.innerHTML = `
      <label class="fr-ajuste"><span>Sonido</span><input type="range" min="0" max="100" value="${Math.round(vol * 100)}" data-aj="vol"><button type="button" class="fr-btn fr-btn-chico" data-aj="mudo">${mudo ? "Activar" : "Silenciar"}</button></label>
      <div class="fr-ajuste"><span>Animaciones</span><div class="fr-segmentos">${[[0.6, "Lentas"], [1, "Normales"], [1.8, "Rápidas"]].map(([v, t]) => `<button type="button" class="fr-opcion${ajustes.rapidez === v ? " sel" : ""}" data-aj="rapidez" data-v="${v}">${t}</button>`).join("")}</div></div>
      <div class="fr-ajuste"><span>Seguir con la vista el turno de los demás</span><div class="fr-segmentos"><button type="button" class="fr-opcion${ajustes.seguir ? " sel" : ""}" data-aj="seguir" data-v="1">Sí</button><button type="button" class="fr-opcion${!ajustes.seguir ? " sel" : ""}" data-aj="seguir" data-v="0">No</button></div></div>
      <div class="fr-ajuste"><span>Pistas de qué hacer</span><div class="fr-segmentos"><button type="button" class="fr-opcion${ajustes.pistas ? " sel" : ""}" data-aj="pistas" data-v="1">Sí</button><button type="button" class="fr-opcion${!ajustes.pistas ? " sel" : ""}" data-aj="pistas" data-v="0">No</button></div></div>
      ${document.documentElement.requestFullscreen ? `<div class="fr-ajuste"><span>Pantalla completa</span><button type="button" class="fr-btn fr-btn-chico" data-aj="pantalla">${document.fullscreenElement ? "Salir" : "Activar"}</button></div>` : ""}`;
    if (!$("frAjustes").open) $("frAjustes").showModal();
  }
  $("frAjustes").addEventListener("input", ev => { if (ev.target.dataset.aj === "vol" && SON) { SON.volumen(+ev.target.value / 100); SON.silencio(false); } });
  $("frAjustes").addEventListener("change", ev => { if (ev.target.dataset.aj === "vol") son("aviso"); });
  $("frAjustes").addEventListener("click", ev => {
    if (ev.target.closest("[data-cerrar]")) { $("frAjustes").close(); if (est) pintarPista(); return; }
    const b = ev.target.closest("button[data-aj]");
    if (!b) return;
    const k = b.dataset.aj;
    if (k === "mudo") { if (SON) SON.silencio(!SON.silencio()); }
    else if (k === "pantalla") pantallaCompleta();
    else if (k === "rapidez") ajustes.rapidez = +b.dataset.v;
    else ajustes[k] = b.dataset.v === "1";
    guardarAjustes();
    son("clic");
    setTimeout(abrirAjustes, k === "pantalla" ? 200 : 0);
  });
  function abrirAyuda() {
    $("frAyudaCuerpo").innerHTML = `
      <section><h3>La guerra</h3><p>Cada bando empieza con su capital, su líder y un puñado de tropas. Se juega por turnos: en el tuyo mueves y atacas con cada tropa, y en tus ciudades entrenas, construyes e investigas.</p>
        <ul><li><strong>Ganas</strong> si te quedas solo tomando capitales, si mantienes una tropa sobre el Núcleo del Sueño (el centro del mapa) varios turnos seguidos, o si tienes más puntos cuando se acaba el tiempo.</li>
        <li><strong>Pierdes</strong> si toman tu capital y no tienes un Refugio.</li></ul></section>
      <section><h3>Mover y atacar</h3><ul><li>Toca una tropa tuya. En <b style="color:#7fd8ff">azul</b> sale adónde puede ir y con <b style="color:#ff8a7a">espadas</b> a quién puede atacar.</li>
        <li>Pasa el ratón por un enemigo para ver cuánto le quitas y cuánto te responde antes de atacar.</li>
        <li>Entrar en una ciudad o una fortaleza la toma. Pisar unas ruinas las registra.</li>
        <li>Bosques y montañas cuestan más de cruzar y dan defensa.</li></ul></section>
      <section><h3>El mar</h3><ul><li>El agua clara se navega. El mar oscuro de fuera, no.</li>
        <li>Con un <strong>Muelle</strong> en una ciudad que tenga agua a dos casillas, esa ciudad bota barcos y todas tus tropas pueden <strong>embarcar</strong> desde cualquier orilla.</li>
        <li>Embarcar gasta el movimiento. Una tropa embarcada va despacio, no ataca y no tiene defensa. Desembarcar también gasta el movimiento.</li>
        <li>A lo que está en el agua solo le llegan los tiradores (alcance 2 o más) y los barcos.</li>
        <li>El Muelle se mejora a <strong>Astillero</strong> y a <strong>Atarazana</strong> para barcos mejores. Los muelles no ocupan hueco en la ciudad.</li>
        <li>Cada ejército lleva el mar a su manera: mira su ficha en el Códice.</li></ul></section>
      <section><h3>Recursos</h3><p>Arriba ves lo que tienes y lo que entra cada turno. Toca cualquiera para ver de dónde sale. Las ciudades rinden según el terreno que tienen alrededor y sus edificios. Cada ciudad alimenta a 3 tropas: las demás gastan alimento.</p></section>
      <section><h3>Ciudades, saber y héroe</h3><ul><li>Cada ciudad entrena una tropa por turno. Algunas tropas piden un edificio.</li>
        <li>En <strong>Saber</strong> investigas tres ramas: militar, arcana y tanatología.</li>
        <li>Cada ejército puede invocar a <strong>un héroe</strong> una vez por guerra, desde una ciudad, cuando cumple sus requisitos.</li></ul></section>
      <section><h3>Varios bandos</h3><p>Con más de dos bandos hay una tregua los primeros turnos. Quien pierde su capital queda fuera y sus tropas se quedan sin bandera. Arriba ves el orden de turnos y cuántas ciudades tiene cada uno.</p>
        <p>En <strong>Bandos</strong> puedes proponer un <strong>pacto</strong>: no os atacáis y veis lo que ve el otro. No comparte la victoria. Traicionarlo se puede una vez y cuesta la cuarta parte de tus soldados.</p></section>
      <section><h3>Frentes y mesas</h3><ul><li>Los <strong>frentes</strong> son guerras ya montadas contra la máquina. Hay tres al día y una gran guerra a la semana. Ganarlos da cartas, una vez cada uno. Una guerra libre no da nada.</li>
        <li>En <strong>Mesas</strong> se juega contra otros jugadores, de 2 a 8, por turnos y cada quien cuando puede. Cada jugador puede apostar las cartas que quiera, o ninguna. Quien gana se lleva las de los que pierden.</li></ul></section>
      <section><h3>Teclas</h3><p><kbd>N</kbd> siguiente tropa · <kbd>E</kbd> terminar turno · <kbd>C</kbd> ir a tus tropas · <kbd>A</kbd> alcance de los enemigos · <kbd>I</kbd> saber · <kbd>+</kbd> <kbd>−</kbd> zoom · <kbd>Esc</kbd> soltar o abrir el menú. Arrastra el mapa para moverlo.</p></section>`;
    $("frAyuda").showModal();
  }
  ["frAyuda", "frCodice"].forEach(id => $(id).addEventListener("click", ev => { if (ev.target.closest("[data-cerrar]")) $(id).close(); }));

  /* =========================================================================
     FINAL
  ========================================================================= */
  let finHecho = false;
  async function terminarGuerraUI() {
    if (finHecho) return;
    finHecho = true;
    musicaPartida(false);
    const resumen = C.cerrarGuerra(ej, est, null, humano());
    const narr = CR.narrar(est, ej, resumen, humano());
    const reg = resumen.registro;
    const yoFin = humano();
    reg.titulo = narr.titulo; reg.parrafos = narr.parrafos.slice(0, 12);
    const frente = !pvp && cfgGuerraActual && cfgGuerraActual.frente ? cfgGuerraActual.frente : null;
    ultimoResumen = { resumen, narr, reg, estFin: est, pvp: !!pvp, yo: yoFin, frente, mesa: pvp && pvp.mesa ? { conApuestas: pvp.conApuestas, fuera: !!pvp.soloYo } : null };
    son(resumen.gano ? "victoria" : resumen.perdio ? "derrota" : "aviso");
    if (!pvp) Red.borrarGuerra();
    if (pvp && pvp.mesa) {
      // Este ejército ya cerró su parte de la mesa: no se le vuelven a aplicar las bajas si se abre otra vez
      ej.mesasCerradas = (ej.mesasCerradas || []).concat([pvp.id]).slice(-40);
    }
    await guardar();
    if (pvp && pvp.mesa) {
      pararSondeo();
      // Cada navegador avisa del final que ve. Quien solo quedó fuera no avisa: la guerra sigue para los demás.
      if (!pvp.soloYo && !pvp.roto) { try { ultimoResumen.mesa.estado = await Red.mesaTerminar(pvp.id, ganadoresTexto(est), est.razon); } catch (e) { /* ya estaba anotado */ } }
    }
    const id = await Red.registrarGuerra({ frente: frente ? { clave: frente.clave, bandos: frente.bandos, dificultad: frente.dificultad } : null, ejercito: ej.nombre, faccion: ej.faccion, rival: reg.rival, tipo: reg.tipo, resultado: reg.resultado, turnos: reg.turnos, razon: reg.razon || "", bajas: reg.bajas, logros: reg.logros, titulo: narr.titulo, cronica: narr.parrafos.slice(0, 12), anio: reg.anio, pvp: !!pvp });
    ultimoResumen.guerraId = id;
    pantallaFin();
  }

  function pantallaFin() {
    const { resumen, narr, reg } = ultimoResumen;
    mostrar("frFin");
    const fr = ultimoResumen.frente, nivelFr = fr && FRT ? FRT.NIVELES[fr.nivel] : null, mesaFin = ultimoResumen.mesa;
    const premio = resumen.gano && ultimoResumen.guerraId && !ultimoResumen.premiado && !ultimoResumen.pvp && fr;
    const pend = C.pendientesDeAscenso(ej);
    $("frFin").classList.add("fr-entra");
    $("frFin").innerHTML = `
      <div class="fr-fin-cab ${resumen.gano ? "gano" : resumen.perdio ? "perdio" : "tablas"}">
        <span class="fr-fin-sello">${resumen.gano ? "Victoria" : resumen.perdio ? "Derrota" : "Tablas"}</span>
        <h2 class="fr-fin-titulo">${esc(narr.titulo)}</h2>
        <p>${esc(FACCIONES[ej.faccion].corto)} contra ${esc(ultimoResumen.estFin.jugadores.filter((j, i) => i !== (ultimoResumen.yo || 0)).map(j => FACCIONES[j.faccion].corto).join(", "))} · ${reg.turnos} turno${reg.turnos === 1 ? "" : "s"}</p>
        ${ultimoResumen.estFin.jugadores.length > 2 ? `<div class="fr-fin-bandos">${ultimoResumen.estFin.jugadores.map((j, i) => ({ j, i, p: FM.puntuacion(ultimoResumen.estFin, i) })).sort((a, b) => b.p - a.p).map(o => `<span class="${FM.ganoJugador(ultimoResumen.estFin, o.i) ? "gana" : ""}${o.j.eliminado ? " fuera" : ""}">${esc(FACCIONES[o.j.faccion].corto)} <b>${o.p}</b></span>`).join("")}</div>` : ""}
      </div>
      <div class="fr-cronica-texto">${narr.parrafos.map(p => `<p>${esc(p)}</p>`).join("")}</div>
      ${paseDeLista(resumen)}
      ${pend.length ? `<div class="fr-banner"><p><strong>Veterano${pend.length === 1 ? "" : "s"} listo${pend.length === 1 ? "" : "s"} para especializarse.</strong></p><div class="fr-fila">${pend.map(s => `<button type="button" class="fr-btn fr-btn-chico" data-ficha-fin="${s.id}">${esc(nombre(s))}</button>`).join("")}</div></div>` : ""}
      ${premio ? `<div class="fr-banner"><p><strong>Has ganado el frente «${esc(fr.titulo)}».</strong> ${nivelFr ? `${esc(nivelFr.premio)}: ${esc(nivelFr.texto.charAt(0).toLowerCase() + nivelFr.texto.slice(1))}` : ""}</p><button type="button" class="fr-btn fr-btn-principal" data-premio>Reclamar el premio</button></div>` : ""}
      ${resumen.gano && !ultimoResumen.pvp && !fr ? `<p class="fr-sub">Las guerras libres no dan cartas. Los frentes del cuartel, sí.</p>` : ""}
      ${resumen.gano && fr && !ultimoResumen.guerraId ? `<p class="fr-sub">Inicia sesión antes de la próxima guerra para guardar la historia y ganar cartas.</p>` : ""}
      ${mesaFin && mesaFin.conApuestas ? `<div class="fr-banner"><p>${mesaFin.fuera ? "Tu ejército queda fuera. Lo que apostaste se lo llevará quien gane la guerra." : mesaFin.estado === "terminada" ? (resumen.gano ? "Las cartas apostadas por los que pierden ya son tuyas." : resumen.perdio ? "Las cartas que apostaste pasan a quien ganó." : "Tablas: cada uno recupera sus cartas.") : mesaFin.estado === "disputa" ? "Los avisos del final no coinciden. El admin lo resuelve y las cartas siguen guardadas hasta entonces." : "Las cartas se reparten cuando los demás jugadores confirmen el final, o en 24 horas si nadie lo discute."}</p></div>` : ""}
      <div class="fr-fila"><button type="button" class="fr-btn fr-btn-principal" data-volver>Volver al cuartel</button></div>`;
    finHecho = false;
    pintarRetratos($("frFin"));
  }

  /* Los que han marcado esta guerra: ascensos, caídos, heridos y reclutas nuevos, con su retrato */
  function paseDeLista(resumen) {
    const vistos = new Set(), filas = [];
    const poner = (s, texto) => { if (!s || vistos.has(s.id) || !ej.soldados[s.id]) return; vistos.add(s.id); filas.push({ s, texto }); };
    resumen.ascensos.forEach(a => poner(a.s, `Asciende a ${a.rango}`));
    resumen.muertos.forEach(s => poner(s, "Cae en la Fractura"));
    resumen.heridos.forEach(s => poner(s, "Herido de gravedad"));
    resumen.alistados.forEach(s => poner(s, "Se une a las filas"));
    if (!filas.length) return "";
    return `<h3 class="fr-h3">Pase de lista</h3><div class="fr-cartas fr-cartas-chicas fr-pase">${filas.slice(0, 12).map(({ s, texto }, i) => carta(s, { ver: true, attr: "data-ficha-fin", i, extra: `<span class="fr-carta-epitafio">${esc(texto)}</span>` })).join("")}</div>`;
  }
  $("frFin").addEventListener("click", async ev => {
    const t = ev.target;
    if (t.closest("[data-volver]")) { pvp = null; yoIdx = 0; entrarCuartel(ultimoResumen && ultimoResumen.pvp ? "duelos" : "guerra"); return; }
    const f = t.closest("[data-ficha-fin]");
    if (f) { abrirFicha(f.dataset.fichaFin); $("frFicha").addEventListener("close", () => { if (!$("frFin").classList.contains("hidden")) pantallaFin(); }, { once: true }); return; }
    if (t.closest("[data-premio]")) {
      try {
        // La recompensa pasa por el sistema oficial de cartas: puede ser una carta, un sello (si no había carta que dar o se llegó al
        // tope del día) o nada (recompensas apagadas: la guerra no se gasta y se podrá reclamar más adelante)
        const r = await Red.pedirPremio(ultimoResumen.guerraId);
        cobrados = null;
        if (r.resultado === "nada") {
          await dialogo.avisar("Las recompensas de cartas están desactivadas por ahora. Tu victoria queda anotada y podrás reclamar esta carta cuando se activen.", { titulo: "Premio de la Fractura" });
        } else if (r.resultado === "carta" || (!r.resultado && r.carta)) {   // (sin «resultado» = la versión anterior del servidor)
          ultimoResumen.premiado = true;
          const carta = window.cartaPorId ? window.cartaPorId(r.carta) : null;
          await dialogo.avisar(`Has ganado la carta ${carta ? carta.nombre : r.carta} (${r.rareza}).${r.de_reserva ? " Es una copia que volvió al mercado." : ""}`, { titulo: "Premio de la Fractura" });
        } else {
          ultimoResumen.premiado = true;
          const motivo = r.motivo === "tope-diario" ? "Hoy ya has ganado todas las cartas que se pueden ganar." : "Ahora mismo no hay ninguna carta que puedas recibir.";
          await dialogo.avisar(`${motivo} Ganas un sello (${r.sellos} de ${r.sellos_meta}): al juntar ${r.sellos_meta} sellos de este juego te llevas una carta.`, { titulo: "Premio de la Fractura" });
        }
      } catch (e) {
        const txt = String(e.message || e);
        if (/Ya cobraste/.test(txt)) { ultimoResumen.premiado = true; await dialogo.avisar("Ese frente ya lo cobraste. Puedes volver a ganarlo, pero solo da premio una vez.", { titulo: "Premio de la Fractura" }); }
        else await dialogo.avisar(`No se pudo dar el premio: ${txt}. Puede que falte correr docs/fractura-3_frentes_y_mesas.sql en Supabase.`);
      }
      pantallaFin();
    }
  });

  window.addEventListener("pagehide", () => { if (est && est.ganador === null && !pvp) Red.guardarGuerra(est, cfgGuerraActual); });

  /* =========================================================================
     MESAS: GUERRAS ENTRE JUGADORES, DE 2 A 8, CON APUESTAS
     La guerra se guarda en el servidor como su configuración y las acciones de cada turno
     (docs/fractura-3_frentes_y_mesas.sql). La máquina juega igual en todos los navegadores,
     así que sus turnos no se guardan: cada navegador los repite.
  ========================================================================= */
  const nombreFaccion = f => (FACCIONES[f] ? FACCIONES[f].corto : f);
  const RAREZA_NOMBRE = { comun: "común", infrecuente: "poco común", rara: "rara", legendaria: "legendaria", limitada: "limitada" };
  let mesaNueva = { nombre: "", plazas: 2, tipo: "reinos", forma: "continente", equipos: false, ia: false, dificultad: "normal", horas: 48, privada: false, invitados: [] };
  let mesasTimer = null, miUid = null, mesasVistas = [];
  const chipsApuesta = lista => (lista && lista.length
    ? lista.map(c => `<i class="fr-ap fr-ap-${esc(c.rareza)}" title="${esc(RAREZA_NOMBRE[c.rareza] || c.rareza)} · copia ${esc(c.numero)}">${esc(c.nombre)}</i>`).join("")
    : `<em class="fr-ap-nada">no apuesta nada</em>`);
  const plazoTexto = limite => {
    if (!limite) return "";
    const ms = Date.parse(limite) - Date.now();
    if (ms <= 0) return "se le pasó el plazo";
    const h = Math.floor(ms / 3600000);
    return h >= 1 ? `le quedan ${h} h` : `le quedan ${Math.max(1, Math.floor(ms / 60000))} min`;
  };

  function tarjetaMesa(m) {
    const cfg = m.config || {}, yo = miUid;
    const lugar = `${TIPOS_FRACTURA[cfg.tipo] ? TIPOS_FRACTURA[cfg.tipo].nombre : "Lugar al azar"} · ${D.FORMAS_MAPA[cfg.forma] ? D.FORMAS_MAPA[cfg.forma].nombre : "Continente"}`;
    const conApuesta = m.asientos.some(a => a.apuesta && a.apuesta.length);
    if (m.estado === "abierta") {
      const soyAnfitrion = m.anfitrion === yo, miAsiento = m.asientos.find(a => a.user === yo);
      const libres = cfg.plazas - m.asientos.length;
      const faltan = m.asientos.filter(a => a.user !== m.anfitrion && !a.listo).length;
      const puedeEmpezar = soyAnfitrion && m.asientos.length >= 2 && !faltan;
      const asientos = m.asientos.map(a => `<li class="${a.listo || a.user === m.anfitrion ? "listo" : ""}" style="--c:${FACCIONES[a.faccion] ? FACCIONES[a.faccion].color : "#8f8498"}">
          <span class="fr-mesa-quien"><b>${esc(a.nombre)}</b><small>${esc(nombreFaccion(a.faccion))}${a.user === m.anfitrion ? " · abrió la mesa" : a.listo ? " · visto bueno" : " · falta su visto bueno"}</small></span>
          <span class="fr-mesa-apuesta">${chipsApuesta(a.apuesta)}</span></li>`).join("")
        + Array.from({ length: Math.max(0, libres) }, () => `<li class="vacio"><span class="fr-mesa-quien"><b>Plaza libre</b><small>${cfg.ia ? "si nadie la ocupa, la juega la máquina" : "esperando a alguien"}</small></span></li>`).join("");
      let acciones = "";
      if (!miAsiento) acciones = libres > 0 ? `<button type="button" class="fr-btn fr-btn-chico fr-btn-principal" data-mesa-acc="sentar" data-id="${m.id}">Sentarme con ${esc(ej.nombre)}</button>` : `<span class="fr-pill">Llena</span>`;
      else {
        acciones = `<button type="button" class="fr-btn fr-btn-chico" data-mesa-acc="apostar" data-id="${m.id}">${miAsiento.apuesta && miAsiento.apuesta.length ? "Cambiar mi apuesta" : "Apostar cartas"}</button>`
          + (miAsiento.apuesta && miAsiento.apuesta.length ? `<button type="button" class="fr-btn fr-btn-chico" data-mesa-acc="quitar" data-id="${m.id}">Quitar mi apuesta</button>` : "")
          + (soyAnfitrion ? `<button type="button" class="fr-btn fr-btn-chico fr-btn-principal${puedeEmpezar ? "" : " no"}" data-mesa-acc="empezar" data-id="${m.id}" data-razon="${puedeEmpezar ? "" : m.asientos.length < 2 ? "Hacen falta al menos dos jugadores." : "Falta el visto bueno de algún jugador."}">Empezar la guerra</button>`
            : `<button type="button" class="fr-btn fr-btn-chico${miAsiento.listo ? "" : " fr-btn-principal"}" data-mesa-acc="${miAsiento.listo ? "nolisto" : "listo"}" data-id="${m.id}">${miAsiento.listo ? "Retirar mi visto bueno" : "Dar mi visto bueno"}</button>`)
          + `<button type="button" class="fr-btn fr-btn-chico fr-btn-peligro" data-mesa-acc="salir" data-id="${m.id}">${soyAnfitrion ? "Cerrar la mesa" : "Levantarme"}</button>`;
      }
      return `<article class="fr-mesa abierta${miAsiento ? " mia" : ""}">
        <header><h4>${esc(m.nombre)}</h4><p>${esc(lugar)} · ${cfg.plazas} plazas${cfg.equipos ? " · dos equipos" : ""}${cfg.ia ? " · la máquina ocupa las libres" : ""} · ${cfg.horas || 48} h por turno${m.privada ? " · por invitación" : ""}</p></header>
        <ul class="fr-mesa-asientos">${asientos}</ul>
        ${miAsiento && !soyAnfitrion && !miAsiento.listo ? `<p class="fr-sub">Mira lo que apuesta cada uno antes de dar tu visto bueno. Si alguien cambia su apuesta, habrá que darlo otra vez.</p>` : ""}
        ${miAsiento && miAsiento.faccion !== ej.faccion ? `<p class="fr-sub">Estás sentado con ${esc(nombreFaccion(miAsiento.faccion))}. La guerra la jugarás desde ese ejército.</p>` : ""}
        <div class="fr-fila">${acciones}</div></article>`;
    }
    const humanos = cfg.humanos || [], miIdx = humanos.indexOf(yo);
    const nombreDe = i => { const a = m.asientos.find(x => x.user === humanos[i]); return a ? a.nombre : m.bandos && m.bandos[i] ? `la máquina (${nombreFaccion(m.bandos[i].faccion)})` : "?"; };
    const bandos = (m.bandos || []).map((b, i) => `<i style="--c:${FACCIONES[b.faccion] ? FACCIONES[b.faccion].color : "#8f8498"}" class="${humanos[i] ? "" : "ia"}${m.estado === "activa" && m.activo === i ? " activo" : ""}" title="${esc(humanos[i] ? nombreDe(i) : "La máquina")}">${esc(nombreFaccion(b.faccion))}</i>`).join("");
    const pozo = conApuesta ? `<div class="fr-mesa-pozo">${m.asientos.filter(a => a.apuesta && a.apuesta.length).map(a => `<span><b>${esc(a.nombre)}</b> ${chipsApuesta(a.apuesta)}</span>`).join("")}</div>` : "";
    if (m.estado === "activa") {
      const mio = miIdx >= 0 && m.activo === miIdx, cerrada = (ej.mesasCerradas || []).includes(m.id), reportada = m.reportes && Object.keys(m.reportes).length;
      return `<article class="fr-mesa activa${mio ? " turno" : ""}">
        <header><h4>${esc(m.nombre)}</h4><p>${esc(lugar)} · ${m.turnos} turno${m.turnos === 1 ? "" : "s"} jugado${m.turnos === 1 ? "" : "s"}</p></header>
        <div class="fr-mesa-bandos">${bandos}</div>${pozo}
        <p class="fr-sub">${reportada ? "La guerra terminó para alguno de los jugadores. Falta que los demás lo confirmen." : mio ? "Es tu turno." : `Turno de ${esc(nombreDe(m.activo))}: ${esc(plazoTexto(m.limite))}.`}</p>
        <div class="fr-fila"><button type="button" class="fr-btn fr-btn-chico ${mio ? "fr-btn-principal" : ""}" data-mesa-acc="abrir" data-id="${m.id}">${cerrada ? "Ver cómo va" : mio ? "Jugar mi turno" : "Abrir"}</button></div></article>`;
    }
    const gan = m.ganadores === "empate" || !m.ganadores ? [] : m.ganadores.split(",").map(Number);
    const texto = m.estado === "disputa" ? "Los avisos del final no coinciden. Lo resuelve el admin y las cartas siguen guardadas hasta entonces."
      : m.estado === "cancelada" ? "La mesa se cerró antes de empezar."
        : !gan.length ? "Tablas. Cada uno recupera sus cartas." : `Gan${gan.length > 1 ? "an" : "a"} ${gan.map(nombreDe).join(" y ")}.`;
    return `<article class="fr-mesa fin ${m.estado === "disputa" ? "disputa" : gan.includes(miIdx) ? "gano" : gan.length ? "perdio" : ""}">
      <header><h4>${esc(m.nombre)}</h4><p>${esc(lugar)}</p></header>
      ${bandos ? `<div class="fr-mesa-bandos">${bandos}</div>` : ""}${pozo}<p class="fr-sub">${esc(texto)}${m.razon && m.estado === "terminada" ? ` ${esc(m.razon)}` : ""}</p></article>`;
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
    const fac = FACCIONES[ej.faccion], n = mesaNueva;
    if (!(n.plazas >= 4 && n.plazas % 2 === 0)) n.equipos = false;
    const seg = (k, valores, etiqueta) => `<div class="fr-segmentos">${valores.map(x => `<button type="button" class="fr-opcion${n[k] === x ? " sel" : ""}" data-mn="${k}" data-v="${x}">${etiqueta ? etiqueta(x) : x}</button>`).join("")}</div>`;
    const sino = (k, si, no) => `<div class="fr-segmentos"><button type="button" class="fr-opcion${!n[k] ? " sel" : ""}" data-mn="${k}" data-v="0">${no}</button><button type="button" class="fr-opcion${n[k] ? " sel" : ""}" data-mn="${k}" data-v="1">${si}</button></div>`;
    const grupos = [["Te toca", mesas.filter(m => m.estado === "activa" && m.mia && (m.config.humanos || []).indexOf(miUid) === m.activo)],
      ["Mesas abiertas", mesas.filter(m => m.estado === "abierta")],
      ["En curso", mesas.filter(m => m.estado === "activa" && !((m.config.humanos || []).indexOf(miUid) === m.activo))],
      ["En disputa", mesas.filter(m => m.estado === "disputa")],
      ["Terminadas", mesas.filter(m => m.estado === "terminada" || m.estado === "cancelada").slice(0, 6)]];
    v.innerHTML = `
      <p class="fr-sub">De 2 a 8 jugadores, cada uno con su ejército y su contingente. Si alguien cae, cae de verdad. Cada jugador puede apostar las cartas que quiera, o ninguna: las apuestas no tienen que ser iguales. Quien gana se lleva las de los que pierden.</p>
      <div class="fr-preparar">
        <div class="fr-prep-col">
          <section class="fr-reto" style="--c:${fac.color};--b:${fac.bandera}">
            <span class="fr-pendon"></span>
            <h3 class="fr-h3">Abrir una mesa</h3>
            <p class="fr-sub">Te sientas con ${esc(ej.nombre)} y tu contingente actual (${(ajustesGuerra.ids || []).length} soldados; se cambia en la pestaña Guerra).</p>
            <label class="fr-campo">Nombre de la mesa<input type="text" class="fr-entrada" data-mesa="nombre" maxlength="60" placeholder="Mesa de ${esc(fac.corto)}" value="${esc(n.nombre)}"></label>
            <div class="fr-mision-bloque"><h4 class="fr-h4">Plazas</h4>${seg("plazas", [2, 3, 4, 5, 6, 7, 8])}
              ${n.plazas >= 4 && n.plazas % 2 === 0 ? sino("equipos", "Dos equipos", "Todos contra todos") : ""}</div>
            <div class="fr-mision-bloque"><h4 class="fr-h4">Plazas que no ocupe nadie</h4>${sino("ia", "Las juega la máquina", "Se quedan vacías")}
              ${n.ia ? seg("dificultad", Object.keys(DIFICULTADES), x => DIFICULTADES[x].nombre) : ""}</div>
            <label class="fr-campo">Lugar de la Fractura<select data-mesa="tipo">${Object.keys(TIPOS_FRACTURA).map(t => `<option value="${t}"${n.tipo === t ? " selected" : ""}>${esc(TIPOS_FRACTURA[t].nombre)}</option>`).join("")}</select></label>
            <label class="fr-campo">Forma del mapa<select data-mesa="forma">${Object.keys(D.FORMAS_MAPA).map(f => `<option value="${f}"${n.forma === f ? " selected" : ""}>${esc(D.FORMAS_MAPA[f].nombre)}${D.FORMAS_MAPA[f].maritimo ? " (de mar)" : ""}</option>`).join("")}</select></label>
            <div class="fr-mision-bloque"><h4 class="fr-h4">Plazo para jugar cada turno</h4>${seg("horas", [24, 48, 72], x => `${x} h`)}
              <p class="fr-sub">Si a alguien se le pasa el plazo, cualquier otro jugador puede pedir que ese turno lo juegue la máquina.</p></div>
            <div class="fr-mision-bloque"><h4 class="fr-h4">Quién puede sentarse</h4>${sino("privada", "Solo quien yo invite", "Cualquiera")}
              ${n.privada ? `<div class="fr-invitados">${jugadores.map(j => `<button type="button" class="fr-opcion${n.invitados.includes(j.user_id) ? " sel" : ""}" data-mn-invita="${j.user_id}">${esc(j.username)}</button>`).join("") || `<p class="fr-sub">No hay más jugadores con cuenta.</p>`}</div>` : ""}</div>
            <button type="button" class="fr-empezar" data-mesa-crear><span>Abrir la mesa</span><small>${esc(fac.corto)} · ${n.plazas} plazas · las apuestas se ponen después</small></button>
          </section>
        </div>
        <aside class="fr-duelos-lista">
          <div class="fr-seccion-cab"><h3 class="fr-h3">Mesas</h3><button type="button" class="fr-btn fr-btn-chico" data-mesa-acc="refrescar">Actualizar</button></div>
          ${grupos.filter(g => g[1].length).map(g => `<h4 class="fr-h4">${g[0]}</h4>${g[1].map(tarjetaMesa).join("")}`).join("") || `<p class="fr-vacio">No hay ninguna mesa. Abre una.</p>`}
        </aside>
      </div>`;
    pintarRetratos(v);
    // Mientras haya una mesa abierta en la que estoy sentado, la lista se refresca sola
    if (mesas.some(m => m.estado === "abierta" && m.mia)) mesasTimer = setInterval(() => {
      if (pestana !== "duelos" || $("frCuartel").classList.contains("hidden") || document.querySelector("dialog[open]") || document.activeElement && document.activeElement.matches("input, select")) return;
      vistaDuelos($("frVista"));
    }, 12000);
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
  $("frVista").addEventListener("change", ev => { const s = ev.target.closest("select[data-mesa]"); if (s) mesaNueva[s.dataset.mesa] = s.value; });
  $("frVista").addEventListener("click", async ev => {
    const t = ev.target;
    const mn = t.closest("[data-mn]"), inv = t.closest("[data-mn-invita]"), crear = t.closest("[data-mesa-crear]"), acc = t.closest("[data-mesa-acc]");
    if (!(mn || inv || crear || acc)) return;
    if (mn) {
      const k = mn.dataset.mn, x = mn.dataset.v;
      mesaNueva[k] = k === "plazas" || k === "horas" ? +x : k === "dificultad" ? x : x === "1";
      son("clic"); vistaDuelos($("frVista")); return;
    }
    if (inv) {
      const id = inv.dataset.mnInvita, i = mesaNueva.invitados.indexOf(id);
      if (i >= 0) mesaNueva.invitados.splice(i, 1); else mesaNueva.invitados.push(id);
      son("clic"); vistaDuelos($("frVista")); return;
    }
    const boton = crear || acc;
    if (boton.dataset.razon) { aviso(boton.dataset.razon, true); son("error"); return; }
    if (boton.disabled) return;
    const id = acc && acc.dataset.id, m = id ? mesasVistas.find(x => x.id === id) : null, que = acc ? acc.dataset.mesaAcc : "crear";
    try {
      if (que === "refrescar") { await vistaDuelos($("frVista")); return; }
      if (que === "abrir") { await abrirMesa(id); return; }
      if (que === "apostar") {
        const ids = await elegirApuesta(m);
        if (ids === null) return;
        await Red.mesaApostar(id, ids);
        aviso(ids.length ? "Apuesta puesta. Los demás tienen que volver a dar su visto bueno." : "Apuesta retirada.");
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
          await Red.mesaCrear(n.nombre, { plazas: n.plazas, tipo: n.tipo, forma: n.tipo === "horizonte" ? "continente" : n.forma, equipos: !!n.equipos, ia: !!n.ia, relleno, dificultad: n.dificultad, horas: n.horas, privada: !!n.privada, hold: 6, anio: ej.anio, reglas: D.REGLAS },
            C.prepararBando(ej, ajustesGuerra.ids), n.privada ? n.invitados : []);
          await guardar();
          aviso("Mesa abierta.");
        } else if (que === "sentar") {
          if ((m.config || {}).reglas !== D.REGLAS) { aviso("Esa mesa se abrió con otra versión del juego. Recarga la página (Ctrl+F5).", true); await vistaDuelos($("frVista")); return; }
          await Red.mesaUnirse(id, C.prepararBando(ej, ajustesGuerra.ids));
          await guardar();
        } else if (que === "listo" || que === "nolisto") await Red.mesaListo(id, que === "listo");
        else if (que === "empezar") { await Red.mesaEmpezar(id); await abrirMesa(id); return; }
      }
      await vistaDuelos($("frVista"));
    } catch (e) { aviso(`No se pudo: ${e.message || e}`, true); son("error"); await vistaDuelos($("frVista")); }
  });

  /* --- La guerra de una mesa --- */
  /* La repetición de la guerra (turnos guardados y turnos de la máquina) vive en js/fractura-mesa.js */
  const MESA = window.FracturaMesa;
  const avanzarMaquina = MESA.avanzarMaquina, aplicarEntrada = MESA.aplicarEntrada, ganadoresTexto = MESA.ganadoresTexto;
  const nombreAsiento = i => (pvp && pvp.nombres[i]) || (est && est.jugadores[i] ? FACCIONES[est.jugadores[i].faccion].corto : "otro jugador");

  async function abrirMesa(id) {
    let fila;
    try { fila = await Red.mesaGet(id); } catch (e) { aviso(`No se pudo abrir la mesa (${e.message || e}).`, true); return; }
    const s = await Red.sesion();
    miUid = s.user.id;
    const cfg = fila.config || {}, humanos = cfg.humanos || [], miIdx = humanos.indexOf(miUid);
    if (!cfg.jugadores || fila.estado === "abierta") { aviso("Esa mesa todavía no empezó.", true); return; }
    if (miIdx < 0) { aviso("No estás en esa guerra.", true); return; }
    if (cfg.reglas !== D.REGLAS) { aviso("Esa guerra empezó con otra versión del juego y ya no se puede continuar aquí. Recarga la página (Ctrl+F5).", true); return; }
    if (cfg.jugadores[miIdx].faccion !== ej.faccion) { aviso(`Esa guerra la juegas con ${nombreFaccion(cfg.jugadores[miIdx].faccion)}. Entra a ese ejército.`, true); return; }
    pararSondeo(); clearInterval(mesasTimer); mesasTimer = null;
    yoIdx = miIdx;
    est = MESA.crear(cfg, miIdx);
    cfgGuerraActual = { faccion: ej.faccion };
    const nombres = humanos.map(u => { const a = (fila.asientos || []).find(x => x.user === u); return a ? a.nombre : null; });
    pvp = { id, mesa: true, n: 0, acciones: [], timer: null, humanos, nombres, limite: fila.limite, actualizada: fila.actualizada, estado: fila.estado, roto: false, horas: cfg.horas || 48,
      conApuestas: Object.values(fila.apuestas || {}).some(a => a && a.length) };
    aplicarTurnosMesa(fila);
    // Si este ejército ya cerró su parte (cayó o la guerra terminó), no se vuelve a entrar: solo se mira cómo va
    if ((ej.mesasCerradas || []).includes(id)) {
      const fin = est.ganador !== null;
      if (fin && !pvp.roto) { try { await Red.mesaTerminar(id, ganadoresTexto(est), est.razon); } catch (e) { /* ya estaba anotado */ } }
      aviso(fin ? `La guerra terminó. ${est.razon || ""}` : `Tu ejército ya está fuera de esa guerra. Va por el turno ${est.turno}.`);
      pvp = null; yoIdx = 0; est = null;
      await vistaDuelos($("frVista"));
      return;
    }
    sel = { uid: null, ciudad: null }; modo = null;
    entrarGuerra(false);
    if (est && est.ganador === null) estadoMesa();
  }

  function aplicarTurnosMesa(fila) {
    const turnos = fila.turnos || [];
    for (let i = pvp.n; i < turnos.length; i++) {
      if (!aplicarEntrada(est, pvp.humanos, turnos[i])) { pvp.roto = true; break; }
    }
    pvp.n = turnos.length; pvp.limite = fila.limite; pvp.estado = fila.estado; pvp.actualizada = fila.actualizada;
    // El servidor ya la cerró (los demás avisaron del final o lo decidió el admin)
    if (est.ganador === null && fila.estado === "terminada") {
      const g = fila.ganadores;
      FM.terminarGuerra(est, !g || g === "empate" ? "empate" : Number(g.split(",")[0]), fila.razon || "La guerra terminó.");
    }
  }

  /* Qué toca ahora en la mesa: jugar, esperar, o cerrar la parte de este jugador */
  function estadoMesa() {
    pintarEspera();
    if (pvp.roto) {
      pararSondeo();
      cartel("La guerra no coincide", 0, "Este navegador ve algo distinto a los demás. Recarga con Ctrl+F5.", "#dc5a4c");
      aviso("Tu navegador no ve la misma guerra que los demás jugadores. Recarga la página con Ctrl+F5. Si sigue pasando, avisa al admin.", true);
      return;
    }
    if (est.ganador !== null) { pararSondeo(); terminarGuerraUI(); return; }
    if (est.jugadores[yoIdx].eliminado) { fueraDeLaMesa(); return; }
    if (est.activo === yoIdx) { pararSondeo(); cartel("Tu turno", 1400, `Turno ${est.turno} de ${est.maxTurnos}`); son("turno"); resumenDeRonda(); atenderOfertas(); refrescar(); }
    else { cartel(`Turno de ${nombreAsiento(est.activo)}`, 0, plazoTexto(pvp.limite), bandos[est.activo] ? bandos[est.activo].col : null); iniciarSondeo(); refrescar(); }
  }

  /* Mi ejército cayó (o me rendí) y la guerra sigue para los demás: se cierra mi parte, sin avisar de ningún final */
  function fueraDeLaMesa() {
    pararSondeo();
    pvp.soloYo = true;
    const copia = JSON.parse(JSON.stringify(est));
    const quedan = FM.vivos(copia).sort((a, b) => FM.puntuacion(copia, b) - FM.puntuacion(copia, a));
    FM.terminarGuerra(copia, quedan.length ? quedan[0] : "empate", `${copia.jugadores[yoIdx].nombre} queda fuera de la guerra.`);
    est = copia;
    terminarGuerraUI();
  }

  /* Manda mi turno ("turno"), mi rendición ("rendicion") o el turno de un ausente que jugó la máquina ("ausente") */
  async function enviarTurnoMesa(tipo) {
    const acc = pvp.acciones; pvp.acciones = [];
    // Lo que hará la máquina después se calcula en una copia: así el turno se manda ya y luego se ve en el mapa
    const d = MESA.despues(est, pvp.humanos, yoIdx);
    try { await Red.mesaTurno(pvp.id, pvp.n, tipo, tipo === "ausente" ? [] : acc, d.siguiente, d.firma); pvp.n += 1; }
    catch (e) { aviso(`No se pudo enviar el turno (${e.message || e}). Se recarga la guerra.`, true); await abrirMesa(pvp.id); return; }
    pvp.limite = new Date(Date.now() + (pvp.horas || 48) * 3600000).toISOString();
    await turnosDeLosDemas();
  }

  /* Aviso de espera: de quién es el turno, cuánto le queda y, si se le pasó el plazo, el botón para que juegue la máquina */
  function pintarEspera() {
    const el = $("frEspera");
    if (!el) return;
    if (!pvp || !pvp.mesa || !est || est.ganador !== null || est.activo === yoIdx || pvp.roto || est.jugadores[yoIdx].eliminado) { el.classList.add("hidden"); return; }
    const pasado = pvp.limite && Date.parse(pvp.limite) < Date.now();
    el.classList.remove("hidden");
    el.innerHTML = `<span>Turno de <b>${esc(nombreAsiento(est.activo))}</b> · ${esc(plazoTexto(pvp.limite))}</span>${pasado ? `<button type="button" class="fr-btn fr-btn-chico" data-ausente>Que este turno lo juegue la máquina</button>` : ""}`;
  }
  if ($("frEspera")) $("frEspera").addEventListener("click", async ev => {
    if (!ev.target.closest("[data-ausente]") || !pvp || !pvp.mesa || est.ganador !== null || est.activo === yoIdx) return;
    pararSondeo();
    const ausente = nombreAsiento(est.activo);
    IA.turnoCompleto(est, est.activo);
    aviso(`La máquina juega el turno de ${ausente}.`);
    tablero.redibujar();
    await enviarTurnoMesa("ausente");
  });

  function iniciarSondeo() {
    pararSondeo();
    if (!pvp || !pvp.mesa) return;
    pvp.timer = setInterval(async () => {
      if (!pvp || !est || est.ganador !== null || est.activo === yoIdx) { pararSondeo(); return; }
      try {
        const p = await Red.mesaPulso(pvp.id);
        pvp.limite = p.limite;
        if (p.actualizada === pvp.actualizada) { pintarEspera(); return; }
        const fila = await Red.mesaGet(pvp.id);
        if (!pvp) return;
        const antes = pvp.n;
        aplicarTurnosMesa(fila);
        if (pvp.n !== antes || est.ganador !== null) { tablero.redibujar(); procesarCronica(); }
        estadoMesa();
      } catch (e) { /* sin conexión: se reintenta */ }
    }, 6000);
  }
  function pararSondeo() { if (pvp && pvp.timer) { clearInterval(pvp.timer); pvp.timer = null; } }

  pintarPortada();
})();
