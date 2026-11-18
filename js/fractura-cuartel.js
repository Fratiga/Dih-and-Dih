/* =============================================================================
   LA FRACTURA: la portada, elegir ejército, el cuartel (soldados, casas, reliquias, salón de los caídos, crónicas,
   historia del mundo) y el vestíbulo de las mesas. La guerra se juega en fractura-guerra.html.
   ARCHIVO GENERADO por tools/construir-fractura-ui.js a partir de js/fractura-ui/comun.js y js/fractura-ui/cuartel.js.
   No se edita aquí: se edita la parte y se vuelve a correr el script.
============================================================================= */
(function () {
  const D = window.FRACTURA_DATOS, S = window.FracturaSoldados, FM = window.FracturaMotor, IA = window.FracturaIA, C = window.FracturaCampana, CR = window.FracturaCronica, Red = window.FracturaRed;
  const { CLASES, FACCIONES, TIPOS_FRACTURA, ESPECIALIZACIONES, EDIFICIOS, ESCUELAS, RECURSOS, RECURSO_NOMBRE, RANGOS, SLOTS, DIFICULTADES } = D;
  const $ = id => document.getElementById(id);
  const esc = t => String(t === undefined || t === null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ROM = ["", "I", "II", "III"];
  const FR = window.FracturaRetratos;
  /* Retrato de un líder (o de un héroe) como imagen: se dibuja una vez y se reutiliza */
  const retLider = (faccion, w, clase, heroe) => (FR && FR.retratoURL ? `<img class="${clase || "fr-ret-mini"}" src="${FR.retratoURL({ faccion: D.faccionReal ? D.faccionReal(faccion) : faccion, heroe: heroe || null }, w)}" alt="" width="${w}" height="${Math.round(w * 380 / 300)}" loading="lazy">` : "");
  const SLOT_NOMBRE = { arma: "Arma", armadura: "Armadura", accesorio: "Accesorio", estandarte: "Estandarte" };
  const STAT_NOMBRE = { FUE: "Fuerza", CON: "Constitución", VEL: "Velocidad", INT: "Inteligencia", VOL: "Voluntad", MAG: "Aptitud mágica" };

  let ejercitos = {};      // faccion -> ejército
  let ej = null;           // el ejército con el que se juega
  let pestana = "guerra";
  let est = null;          // guerra en curso
  let sel = { uid: null, ciudad: null };
  let modo = null;         // habilidad que espera una casilla: { id, ... }
  let botar = null;        // barco que espera a que se elija su casilla de agua: { ciudad, clase, casillas }
  let marcarReunion = null; // ciudad cuyo punto de reunión se está marcando en el mapa
  let grupo = null;        // varias tropas elegidas con Mayús + arrastrar: [uid, ...]
  let cumpliendo = false;
  let grupoConquista = false;   // el grupo espera a que se toque la ciudad que conquistar  // mientras las tropas cumplen sus órdenes (sus acciones no las borran)
  const ORD = window.FracturaIA ? window.FracturaIA.ORDENES : {};
  let guardarEstadoTimer = null;
  let ajustesGuerra = { tipo: "azar", forma: "azar", dificultad: "normal", rival: "azar", ids: null, bandos: 2, equipos: false, frente: undefined, tamano: "normal", mapaPara: 2 };
  let cobrados = null;     // frentes que el jugador ya cobró (se piden al servidor al abrir la pestaña)
  let frentesInfo = { intentos: {}, hoy: 0 };   // intentos gastados en cada frente y cartas de frentes de hoy (tope 2)
  const INTENTOS_FRENTE = 2, CARTAS_FRENTES_DIA = 2;
  let tablero = null;
  let ultimoResumen = null;

  /* --- Retratos: un canvas por soldado, que se pinta después de poner el HTML --- */
  const retr = (s, w, anim, ejf) => `<canvas class="fr-ret" data-retr="${s.id}" data-w="${w}"${ejf ? ` data-ejf="${ejf}"` : ""}${anim ? " data-anim" : ""}></canvas>`;
  const retrGen = (clase, id, faccion, w, anim, sexo) => `<canvas class="fr-ret" data-gen="${clase}|${id}|${faccion}|${sexo || "m"}" data-w="${w}"${anim ? " data-anim" : ""}></canvas>`;
  // Quién representa a cada facción cuando aún no hay nadie que mostrar
  const REP = { "caballeros-del-reino": ["caballero", "m"], "academia-arcana-de-dolbred": ["archimago", "m"], "trono-de-ceniza": ["esqueleto", "m"], "compania-dorada": ["mercenario", "f"], "hijos-del-acero": ["cazador", "m"], "santos-de-asmodeo": ["paladin", "m"], nikaalia: ["picaro", "m"], seosan: ["guerrero", "f"], okran: ["guerrero", "m"], pelgiria: ["cazador", "f"], mravec: ["guerrero", "f"], nernib: ["paladin", "m"], balutia: ["guerrero", "m"] };
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
    ["frPortada", "frInicio", "frCuartel", "frGuerra", "frFin"].forEach(id => { const el = $(id); if (el) el.classList.toggle("hidden", id !== pantalla); });
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


  /* Todas las tropas de un ejército: las de siempre, las propias y las que abre su saber */
  const tropasDeFac = f => { const fac = FACCIONES[f], l = D.CLASES_BASE.concat(fac.clasesExtra); (window.FracturaSaber ? window.FracturaSaber.posibles(f) : []).forEach(c => { if (!l.includes(c)) l.push(c); }); return l; };
  const saberQueAbre = (f, cl) => {
    const SB = window.FracturaSaber; if (!SB || !CLASES[cl].requiere || !CLASES[cl].requiere.saber) return null;
    for (const r of SB.ramas(f)) for (let i = 0; i < r.escalones.length; i++) if ((r.escalones[i].ef.desbloquea || []).includes(cl)) return `${r.escalones[i].nombre} (${r.nombre} ${["I", "II", "III", "IV", "V", "VI"][i]})`;
    for (const x of SB.cruces(f)) if ((x.ef.desbloquea || []).includes(cl)) return x.nombre;
    return null;
  };
  /* Códice: los trece ejércitos con sus tropas y su héroe, tal como se ven en el mapa */
  function abrircodex(faccionInicial) {
    const c = $("frcodexCuerpo");
    const pinta = f => {
      const fac = FACCIONES[f];
      const clases = tropasDeFac(f);
      const topeB = fac.naval.barcoMax === undefined ? 3 : fac.naval.barcoMax;
      const barcosCod = D.BARCOS_BASE.concat(fac.naval.barcos || []).filter(cl => CLASES[cl].naval <= topeB);
      c.innerHTML = `<nav class="fr-codex-lista">${Object.keys(FACCIONES).map(k => `<button type="button" class="${k === f ? "sel" : ""}" data-cod="${k}" style="--c:${FACCIONES[k].color}">${figHtml({ faccion: k, clase: "lider", sinAro: true }, 34, 42)}<span>${esc(FACCIONES[k].corto)}</span></button>`).join("")}</nav>
        <article class="fr-codex-ficha" style="--c:${fac.color};--b:${fac.bandera}">
          <header>${retLider(f, 64, "fr-codex-lider")}<h3>${esc(fac.nombre)}</h3><span class="fr-curva" title="${esc(CURVA_TEXTO[fac.curva] || "")}">${esc(fac.curva)}</span></header>
          <p>${esc(fac.resumen)}</p><p><strong>Ventaja.</strong> ${esc(fac.ventaja)}</p>
          <p><strong>En el mar: ${esc((fac.naval.nivel || "").toLowerCase())}.</strong> ${esc(fac.naval.texto)}</p>
          <p><strong>Su palabra.</strong> ${esc(!fac.diplomacia.pacta ? "No pacta con nadie." : `${fac.diplomacia.pacta >= 0.7 ? "Pacta con facilidad" : fac.diplomacia.pacta >= 0.5 ? "Pacta si le conviene" : "Le cuesta pactar"}${fac.diplomacia.soloHumanos ? ", nunca con ejércitos de monstruos" : ""}. ${!fac.diplomacia.traiciona ? "Cumple lo que firma." : fac.diplomacia.traiciona >= 0.4 ? "Traiciona cuando le conviene." : "Rara vez rompe un pacto."}`)}</p>
          <p class="fr-sub">${esc(CURVA_TEXTO[fac.curva] || "")}</p>
          <h4>Tropas</h4>
          <div class="fr-codex-tropas">${clases.concat(["lider"]).map(cl => { const tr = D.tropa(f, cl), k = CLASES[cl]; return `<div class="fr-codex-tropa${fac.clasesExtra.includes(cl) ? " propia" : ""}">${figHtml({ faccion: f, clase: cl }, 64, 78)}<div><strong>${esc(tr.nombre)}</strong><small>${esc(k.rol)}${fac.clasesExtra.includes(cl) ? " · solo este ejército" : ""}</small>
            <span class="fr-recluta-cifras">${ico("vida")}${k.hp} ${ico("ataque")}${k.atq} ${ico("defensa")}${k.def} ${ico("mov")}${k.mov}${k.alc > 1 ? ` ${ico("alcance")}${k.alc}` : ""}</span><p>${esc(tr.aspecto)}</p><p class="fr-sub">${esc(tr.texto)}${saberQueAbre(f, cl) ? ` Se abre con ${esc(saberQueAbre(f, cl))}.` : ""}</p></div></div>`; }).join("")}</div>
          ${barcosCod.length ? `<h4>Barcos</h4><div class="fr-codex-tropas">${barcosCod.map(cl => { const k = CLASES[cl]; return `<div class="fr-codex-tropa${k.exclusiva ? " propia" : ""}">${figHtml({ faccion: f, clase: cl }, 64, 78)}<div><strong>${esc(k.nombre)}</strong><small>${esc(k.rol)} · pide ${esc(EDIFICIOS[k.requiere.edificio].nombre)}${k.exclusiva ? " · solo este ejército" : ""}</small>
            <span class="fr-recluta-cifras">${ico("vida")}${k.hp} ${ico("ataque")}${k.atq + (fac.naval.barcoAtq || 0)} ${ico("defensa")}${k.def + (fac.naval.barcoDef || 0)} ${ico("mov")}${k.mov + (fac.naval.barcoMov || 0)}${k.alc > 1 ? ` ${ico("alcance")}${k.alc}` : ""}</span><p class="fr-sub">${esc(k.texto)}</p></div></div>`; }).join("")}</div>` : ""}
          <h4>${fac.heroe.length > 1 ? "Héroes (se invoca uno)" : "Héroe"}</h4>
          <div class="fr-codex-tropas">${fac.heroe.map(hid => { const h = HEROES[hid]; return `<div class="fr-codex-tropa heroe">${retLider(f, 84, "fr-codex-ret", hid)}<div><strong>${esc(h.variantes ? h.variantes.join(" o ") : h.nombre)}</strong><small>${esc(h.titulo)}</small>
            <span class="fr-recluta-cifras">${ico("vida")}${h.hp} ${ico("ataque")}${h.atq} ${ico("defensa")}${h.def} ${ico("mov")}${h.mov}${h.alc > 1 ? ` ${ico("alcance")}${h.alc}` : ""}</span><p>${esc(h.aspecto)}</p><p class="fr-sub">${esc(h.texto)}</p>${habilidadesHtml(h)}
            <p class="fr-sub"><strong>Para invocarlo:</strong> ${h.req.map(r => r.texto || (r.t === "edificio" ? `tener ${EDIFICIOS[r.id].nombre}` : r.t === "fortaleza" ? "tener una fortaleza" : r.t === "saber" ? `dominar ${r.n} escalones del saber` : r.t === "ciudades" ? `${r.n} ciudades` : r.t === "regiones" ? `${r.n} provincias` : r.t === "turno" ? `turno ${r.n}` : r.t === "consagradas" ? `${r.n} casillas consagradas` : r.t === "mercado" ? "controlar el Mercado de las Sombras" : r.t === "muertos" ? `que caigan ${r.n} soldados en la guerra` : r.t === "matados" ? `matar a ${r.n} enemigos` : r.t === "oficiales" ? `matar a ${r.n} oficiales enemigos` : "")).filter(Boolean).concat([`${D.RENOMBRE_HEROE} de renombre`, `llegar al turno ${D.TURNO_HEROE.pequeno} a ${D.TURNO_HEROE.enorme}, según el tamaño del mapa`, `pagar ${costeTexto(h.coste)}`]).join("; ").toLowerCase()}.</p></div></div>`; }).join("")}</div>
        </article>`;
      pintarFiguras(c);
    };
    pinta(faccionInicial || Object.keys(FACCIONES)[0]);
    c.onclick = ev => { const b = ev.target.closest("[data-cod]"); if (b) { son("clic"); pinta(b.dataset.cod); c.querySelector(".fr-codex-ficha").scrollTop = 0; } };
    if (!$("frcodex").open) $("frcodex").showModal();
  }


  /* =========================================================================
     FICHA DE UN SOLDADO
  ========================================================================= */
  /* Lo que hace una reliquia (el texto de su ficha; si no lo trae, el de su modelo) */
  const textoReliquia = r => r.texto || (D.RELIQUIAS[r.def] ? D.RELIQUIAS[r.def].texto : "") || "";
  /* Lo que hace cada característica en este soldado, en una línea */
  const signo = n => (n > 0 ? `+${n}` : `${n}`);
  function efectoStat(s, k) {
    const cl = CLASES[s.clase] || {}, v = s.stats ? s.stats[k] : 5, pega = cl.atqEstat === k;
    const ma = Math.floor((v - 5) / 3);
    const atq = pega ? (ma ? `${signo(ma)} al ataque (su tropa pega con esto). ` : "Su tropa pega con esto, pero aún no le suma ataque (con 8, +1). ") : "";
    if (k === "FUE") return `${atq}${pega ? "" : "Su tropa no pega con fuerza."}`;
    if (k === "CON") return `${signo(S.modHp(s))} de vida. Ayuda a salir vivo de una herida grave.`;
    if (k === "VEL") return `${atq}${S.modMov(s) ? `${signo(S.modMov(s))} de movimiento.` : "Movimiento normal (con 9 o más, +1)."}`;
    if (k === "INT") return `${atq}${v >= 8 ? "Aprende de lo que vive: suma una victoria más cuando se gana la guerra." : "Con 8 o más, suma una victoria más al ganar una guerra."}`;
    if (k === "VOL") return `${Math.round(S.probVoluntad(s) * 100)} % de aguantar con 1 de vida un golpe que lo mataría (una vez por guerra).`;
    return `${atq}${pega ? "" : "Solo cuenta para los que hacen magia."}`;
  }
  const barraStat = s => k => `<div class="fr-stat" title="${esc(efectoStat(s, k))}"><span>${STAT_NOMBRE[k]}</span><i><b style="width:${(s.stats ? s.stats[k] : 0) * 10}%"></b></i><em>${s.stats ? s.stats[k] : "?"}</em><small class="fr-stat-ef">${esc(efectoStat(s, k))}</small></div>`;
  const maniasHtml = s => {
    const l = S.manias(s, f => (FACCIONES[f] ? FACCIONES[f].corto : f));
    return `<div class="fr-manias"><h4>Manías</h4>${l.length ? `<ul>${l.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : `<p>Todavía no se le conoce ninguna. Se le irán notando guerra a guerra, según cómo lo uses.</p>`}</div>`;
  };
  function abrirFicha(id, lectura) {
    const s = ej.soldados[id];
    if (!s) return;
    const rg = rango(s);
    const claseN = D.tropa(ej.faccion, s.clase).nombre;
    const barra = barraStat(s);
    const vivo = s.estado !== "caido";
    const equipo = SLOTS.map(slot => {
      const rid = s.equipo && s.equipo[slot];
      const r = rid && ej.reliquias[rid];
      const libres = C.reliquiasLibres(ej).filter(x => x.slot === slot);
      return `<div class="fr-slot"><b>${SLOT_NOMBRE[slot]}</b> ${r ? `${esc(r.nombre)} <button type="button" class="fr-enlace" data-quita="${slot}">quitar</button><small class="fr-slot-ef">${esc(textoReliquia(r))}</small>` : (slot === "estandarte" && !s.capitan) ? "<small>solo capitanes</small>" : vivo && libres.length ? `<select data-pon-equipo="${slot}"><option value="">Equipar...</option>${libres.map(x => `<option value="${x.id}">${esc(x.nombre)} · ${esc(textoReliquia(x))}</option>`).join("")}</select>` : "<small>nada</small>"}</div>`;
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
      <p class="fr-sub">${s.sexo === "f" ? "Mujer" : "Hombre"} de ${edad(s)} años · ${esc(claseN)} · ${rg.nombre} · ${esc(D.ORIGENES[s.origen] ? D.ORIGENES[s.origen].nombre : s.origen)}${s.reanimado ? " · Reanimado" : ""}${s.renacido ? ` · Renaciente (${s.renacido})` : ""}</p>${maniasHtml(s)}</div></div>
      ${m ? `<p class="fr-epitafio">${m.natural ? "Murió en paz." : `Cayó en ${esc(m.lugar)}${m.causa && m.causa !== "la Fractura" ? ` a manos de ${esc(m.causa)}` : ""}.`} Año ${m.anio}.</p>` : ""}
      ${s.estado === "establecido" ? `<p class="fr-sub">Establecido: tiene familia.</p>` : ""}
      ${C.convaleciente(ej, s) ? `<p class="fr-sub">Convaleciente de unas heridas graves. No puede ir a la guerra hasta pasadas ${s.herida.hasta - ej.guerras + 1} guerra(s).</p>` : ""}
      ${s.luto ? `<p class="fr-sub">De luto por ${esc(s.luto.nombre)}: +1 de ataque durante ${s.luto.restantes} guerra(s).</p>` : ""}
      ${ascenso}
      <div class="fr-cifras"><div><b>${s.victorias}</b>victorias</div><div><b>${s.bajas}</b>bajas</div><div><b>${s.oficiales}</b>oficiales abatidos</div><div><b>${s.guerras}</b>guerras (${s.ganadas} ganadas)</div><div><b>${s.cicatrices || 0}</b>cicatrices</div><div><b>${S.aniosDeServicio(s, ej.anio)}</b>años de servicio</div></div>
      ${s.spec ? `<p><strong>${ESPECIALIZACIONES[s.spec].nombre}.</strong> ${esc(ESPECIALIZACIONES[s.spec].texto)}</p>` : ""}
      <div class="fr-dos fr-dos-chico"><div><h3 class="fr-h3">Características</h3>${["FUE", "CON", "VEL", "INT", "VOL", "MAG"].map(barra).join("")}</div>
        <div><h3 class="fr-h3">Equipo</h3>${equipo}</div></div>
      ${vivo && s.estado !== "nino" ? `<h3 class="fr-h3">Mando</h3><p class="fr-sub fr-mando-ayuda">Un capitán tiene +2 de vida y da +1 de defensa a los de su compañía que estén a 2 casillas o menos. Solo un capitán lleva estandarte. Si cae, su compañía pierde 1 de ataque durante 3 turnos.</p><div class="fr-fila">
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
      cuerpo.querySelectorAll("h3").forEach(h => { if (h.textContent === "Mando") { while (h.nextElementSibling && h.nextElementSibling.tagName !== "H3") h.nextElementSibling.remove(); h.remove(); } });
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
  function entrarCuartelSinSalto() { if ($("frCuartel") && !$("frCuartel").classList.contains("hidden") && G.pintarVista) G.pintarVista(); }

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
  /* El color con el que se escribe el nombre de una tropa: el de su bando (más claro para que se lea sobre fondo oscuro) */
  const colorDe = d => (d !== null && d >= 0 && bandos[d] ? FF.claro(bandos[d].col, 0.25) : "#cfc6b4");
  const FMH = window.FracturaMusicaHeroes || null;
  const musicaPartida = si => { if (!si && FMH) FMH.alTerminar(); if (window.MusicaPaginas) window.MusicaPaginas.partida(si); };
  const tropaDe = u => (u.heroe ? { nombre: HEROES[u.heroe].titulo, texto: HEROES[u.heroe].texto, rol: "Héroe", aspecto: HEROES[u.heroe].aspecto } : u.dueno >= 0 ? D.tropa(est.jugadores[u.dueno].faccion, u.clase) : { nombre: CLASES[u.clase].nombre, texto: CLASES[u.clase].texto, rol: CLASES[u.clase].rol, aspecto: "" });

  /* --- Ajustes del juego (se guardan en este navegador) --- */
  let ajustes = { rapidez: 1, seguir: true, pistas: true };
  try { ajustes = Object.assign(ajustes, JSON.parse(localStorage.getItem("fracturaAjustes") || "{}")); } catch (e) { /* sin almacenamiento */ }
  const guardarAjustes = () => { try { localStorage.setItem("fracturaAjustes", JSON.stringify(ajustes)); } catch (e) { /* nada */ } if (tablero) tablero.ajustes(ajustes); if (FMH) FMH.activar(ajustes.musicaHeroes !== false); };
  if (FMH) FMH.activar(ajustes.musicaHeroes !== false);

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

  let empezando = false;

  function abrirAjustes() {
    const c = $("frAjustesCuerpo");
    const vol = SON ? SON.volumen() : 0.6, mudo = SON ? SON.silencio() : false;
    c.innerHTML = `
      <label class="fr-ajuste"><span>Sonido</span><input type="range" min="0" max="100" value="${Math.round(vol * 100)}" data-aj="vol"><button type="button" class="fr-btn fr-btn-chico" data-aj="mudo">${mudo ? "Activar" : "Silenciar"}</button></label>
      <div class="fr-ajuste"><span>Animaciones</span><div class="fr-segmentos">${[[0.6, "Lentas"], [1, "Normales"], [1.8, "Rápidas"]].map(([v, t]) => `<button type="button" class="fr-opcion${ajustes.rapidez === v ? " sel" : ""}" data-aj="rapidez" data-v="${v}">${t}</button>`).join("")}</div></div>
      <div class="fr-ajuste"><span>Seguir con la vista el turno de los demás</span><div class="fr-segmentos"><button type="button" class="fr-opcion${ajustes.seguir ? " sel" : ""}" data-aj="seguir" data-v="1">Sí</button><button type="button" class="fr-opcion${!ajustes.seguir ? " sel" : ""}" data-aj="seguir" data-v="0">No</button></div></div>
      ${FMH ? `<div class="fr-ajuste"><span>Música de los héroes al invocarlos</span><div class="fr-segmentos"><button type="button" class="fr-opcion${ajustes.musicaHeroes !== false ? " sel" : ""}" data-aj="musicaHeroes" data-v="1">Sí</button><button type="button" class="fr-opcion${ajustes.musicaHeroes === false ? " sel" : ""}" data-aj="musicaHeroes" data-v="0">No</button></div></div>` : ""}
      <div class="fr-ajuste"><span>Pistas de qué hacer</span><div class="fr-segmentos"><button type="button" class="fr-opcion${ajustes.pistas ? " sel" : ""}" data-aj="pistas" data-v="1">Sí</button><button type="button" class="fr-opcion${!ajustes.pistas ? " sel" : ""}" data-aj="pistas" data-v="0">No</button></div></div>
      ${document.documentElement.requestFullscreen ? `<div class="fr-ajuste"><span>Pantalla completa</span><button type="button" class="fr-btn fr-btn-chico" data-aj="pantalla">${document.fullscreenElement ? "Salir" : "Activar"}</button></div>` : ""}`;
    if (!$("frAjustes").open) $("frAjustes").showModal();
  }
  $("frAjustes").addEventListener("input", ev => { if (ev.target.dataset.aj === "vol" && SON) { SON.volumen(+ev.target.value / 100); SON.silencio(false); } });
  $("frAjustes").addEventListener("change", ev => { if (ev.target.dataset.aj === "vol") son("aviso"); });
  $("frAjustes").addEventListener("click", ev => {
    if (ev.target.closest("[data-cerrar]")) { $("frAjustes").close(); if (est && G.alCerrarAjustes) G.alCerrarAjustes(); return; }
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
  /* --- Cómo se juega: secciones con índice y buscador. Las tablas salen de los datos del juego, con los nombres de tu ejército --- */
  const TIPO_TROPA = { infanteria: "infantería", tirador: "tiradores", magia: "magos", jinete_pesado: "caballería pesada", jinete: "caballería ligera", piquero: "piqueros", apoyo: "apoyo", asedio: "asedio", monstruo: "monstruos", volador: "voladores", barco: "barcos", heroe: "héroes" };
  const DE_DONDE = {
    comida: ["Granjas, llanuras y agua alrededor de tus ciudades.", "Mantener a las tropas: cada ciudad alimenta a 2 y el resto come 1 por turno. Sin alimento pasan hambre y pierden vida."],
    materiales: ["Aserraderos y bosques cerca de tus ciudades.", "Construir edificios y hacer crecer las ciudades."],
    mineral: ["Minas y montañas cerca de tus ciudades.", "Tropas pesadas, barcos y edificios militares."],
    oro: ["Las ciudades, los mercados y bancos, los desiertos cercanos, el saqueo de ruinas y algunas cosas del saber.", "Casi todo: tropas, edificios, crecer, sobornos y acoger tropas sin bandera."],
    mana: ["Santuarios, bibliotecas, torres de magia y las zonas mágicas.", "Investigar el saber y entrenar magos."],
    anima: ["Los campos de huesos y las muertes (en algunos ejércitos más que en otros).", "Levantar a los caídos y las tropas de los ejércitos de no muertos."]
  };
  let ayudaSeccion = "guerra", ayudaBusca = "";
  function seccionesAyuda() {
    const H = est ? humano() : null, f = est && H !== null ? est.jugadores[H].faccion : ej ? ej.faccion : null;
    const nom = cl => (f ? D.tropa(f, cl).nombre : CLASES[cl].nombre);
    // Una fila por tropa: las de tu ejército si estás en guerra, si no las comunes a todos
    const lista = est && H !== null ? FM.clasesDisponibles(est, H).filter(cl => !CLASES[cl].naval)
      : D.CLASES_BASE.concat(["piquero", "jinete", "hostigador", "catafracto", "volador", "jinete_alado"]).filter((x, i, a) => a.indexOf(x) === i && CLASES[x]);
    const filasTipo = lista.map(cl => {
      const k = CLASES[cl], contra = Object.keys(k.contra || {});
      return `<tr><th>${esc(nom(cl))}</th><td>${(k.tipo || []).map(x => TIPO_TROPA[x] || x).join(", ")}</td><td>${contra.map(x => `${TIPO_TROPA[x] || x} (+${k.contra[x]})`).join(", ") || "—"}</td></tr>`;
    }).join("");
    const filasTerreno = Object.keys(D.TERRENOS).filter(t => t !== "vacio").map(t => { const te = D.TERRENOS[t]; return `<tr><th><i class="fr-ay-color" style="background:${te.color}"></i>${esc(te.nombre)}</th><td>${te.mov ? `${te.mov}` : "solo barcos y voladores"}</td><td>${te.def ? `+${te.def}` : "0"}</td><td>${Object.keys(te.rinde).map(k => `${String(te.rinde[k]).replace(".", ",")} ${RECURSO_NOMBRE[k].toLowerCase()}`).join(", ") || "nada"}</td></tr>`; }).join("");
    const filasRec = RECURSOS.map(k => `<tr><th>${ico(k)} ${RECURSO_NOMBRE[k]}</th><td>${DE_DONDE[k][0]}</td><td>${DE_DONDE[k][1]}</td></tr>`).join("");
    const filasEd = Object.keys(EDIFICIOS).filter(e => !EDIFICIOS[e].solo || EDIFICIOS[e].solo === f).map(e => `<tr><th>${esc(f ? D.nombreEdificio(e, f) : EDIFICIOS[e].nombre)}</th><td>${esc(D.textoEdificio(e, f))}</td></tr>`).join("");
    const fac = f ? FACCIONES[f] : null, SBf = f && window.FracturaSaber ? window.FracturaSaber : null;
    const niveles = fac && fac.poblacion ? fac.poblacion.niveles.map((n, i) => `${esc(n)} (+${fac.poblacion.porNivel[i]})`).join(" → ") : "";
    return [
      ["guerra", "La guerra", `<p>Cada bando empieza con su capital, su líder y un puñado de tropas. Se juega por turnos: en el tuyo mueves y atacas con cada tropa, y en tus ciudades entrenas, construyes e investigas.</p>
        <ul><li><strong>Ganas</strong> si eres el último en pie, si mantienes una tropa sobre el Núcleo del Sueño (el centro del mapa) varios turnos seguidos, o si tienes más puntos cuando se acaba el tiempo.</li>
        <li><strong>Pierdes</strong> si toman tu capital y no tienes un Refugio.</li>
        <li>Con más de dos bandos hay tregua los primeros turnos: nadie puede atacar ni entrar en ciudades ajenas.</li>
        <li>El mapa puede ser pequeño, normal, grande o enorme, y puede estar hecho para más bandos de los que juegan. Las capitales que sobran quedan como ciudades libres.</li></ul>`],
      ["mover", "Mover y atacar", `<ul><li>Toca una tropa tuya. En <b style="color:#7fd8ff">azul</b> sale adónde puede ir y con <b style="color:#ff8a7a">espadas</b> a quién puede atacar. Si tocas otra vez la misma casilla, cambias entre la tropa, la ciudad y el terreno.</li>
        <li>Pasa el ratón por un enemigo para ver cuánto le quitas y cuánto te responde.</li>
        <li>Una tropa pegada a un enemigo no puede seguir de largo: se queda trabada. Los voladores no se traban.</li>
        <li>Quien recibe un golpe cuerpo a cuerpo responde si puede. Los tiradores que atacan de lejos no reciben respuesta.</li>
        <li><strong>Carga</strong>: la caballería que avanza al menos dos casillas antes de atacar pega más.</li>
        <li><strong>Voladores</strong>: cruzan agua, bosques y montañas por 1 de movimiento, pero no pueden quedarse sobre el agua.</li>
        <li>Atacar a un aliado te pregunta si quieres traicionarlo.</li></ul>`],
      ["tipos", "Tipos de tropa", `<p>Cada tropa pertenece a uno o más tipos. Algunas pegan más a ciertos tipos, como los piqueros a la caballería o los tiradores a los voladores.</p>
        <table class="fr-ay-tabla"><tr><th>Tropa</th><th>Tipo</th><th>Pega más a</th></tr>${filasTipo}</table>
        <p>El número es el ataque de más. Tu saber y algunos héroes añaden ventajas propias.</p>
        <p><strong>La magia contra los no muertos.</strong> Las tropas de magia pegan 2 más a los no muertos: todo el ejército de Osses y cualquier tropa levantada de entre los muertos. Contra Osses, haz más magos.</p>`],
      ["terreno", "Casillas y terreno", `<table class="fr-ay-tabla"><tr><th>Terreno</th><th>Cuesta</th><th>Defensa</th><th>Rinde a la ciudad</th></tr>${filasTerreno}</table>
        <ul><li><strong>Ciudad</strong>: +1 de defensa a quien la ocupa. Rinde según el terreno de alrededor y sus edificios. Cuenta el terreno a 1 casilla; desde el nivel 3, también a 2 casillas, pero ese anillo de fuera rinde la mitad. Las fracciones se suman y se redondean.</li>
        <li><strong>Fortaleza</strong>: +2 de defensa. Quien la tiene domina su provincia.</li>
        <li><strong>Ruinas</strong>: al pisarlas se registran. Pueden dar una reliquia, oro o una sorpresa. Algunas tienen guardianes.</li>
        <li><strong>Portal</strong>: une dos casillas lejanas. Si hay una tropa enemiga en cualquiera de sus dos extremos, nadie más puede usarlo. Toca un portal para ver su pareja.</li>
        <li><strong>Núcleo del Sueño</strong>: el centro del mapa. Retenerlo varios turnos seguidos gana la guerra.</li>
        <li>Las provincias inestables dan sorpresas: criaturas, cambios de terreno, portales que se mueven.</li></ul>`],
      ["recursos", "Recursos", `<p>Arriba ves lo que tienes y lo que entra cada turno. Toca cualquiera para ver de dónde sale.</p>
        <table class="fr-ay-tabla"><tr><th>Recurso</th><th>De dónde sale</th><th>Para qué sirve</th></tr>${filasRec}</table>`],
      ["ciudades", "Ciudades y tropas", `<ul><li>Cada ciudad entrena una tropa por turno. Algunas tropas piden un edificio o un escalón del saber.</li>
        <li>Arriba, junto a los recursos, ves cuántas tropas tienes y cuántas puedes tener. El límite sube al hacer <strong>crecer</strong> tus ciudades, y cada ejército crece a su manera.${niveles ? ` El tuyo: ${niveles}.` : ""}</li>
        <li>Los levantados de entre los muertos no cuentan para el límite. Cómo subirlo, ejército por ejército, está en <strong>Límite de tropas</strong>.</li></ul>
        <h4 class="fr-h4">Edificios</h4><table class="fr-ay-tabla">${filasEd}</table>`],
      ["limite", "Límite de tropas", `<p>Cada ejército puede tener un número máximo de tropas a la vez. Se ve arriba, junto a los recursos. Cuando llegas al máximo, tus ciudades no pueden entrenar más.</p>
        <h4 class="fr-h4">Cómo subirlo</h4>
        <ul><li><strong>Haz crecer tus ciudades.</strong> Pulsa «Crecer» en el panel de la ciudad. Cada nivel de cada ciudad suma tropas al límite, y cuántas depende del ejército (en la tabla).</li>
        <li><strong>Toma más ciudades.</strong> Cada ciudad tuya suma lo de sus niveles. Desde la cuarta ciudad se paga administración en oro.</li>
        <li><strong>Aprende el saber que lo sube.</strong> Algunos escalones dan más tropas. Salen en la última columna.</li>
        <li><strong>Encarga una Fiesta.</strong> Es una obra de ciudad: +2 al límite durante 3 turnos por cada ciudad que la celebre.</li>
        <li>Nunca pasa del tope de tu ejército.</li></ul>
        <p>No ocupan sitio los levantados de entre los muertos ni lo que traen algunos héroes al usar sus habilidades.</p>
        <table class="fr-ay-tabla fr-ay-limite"><tr><th>Ejército</th><th>Base</th><th>Por nivel de ciudad</th><th>Tope</th><th>Saber que lo sube</th></tr>${Object.keys(FACCIONES).map(k => {
          const F = FACCIONES[k], pb = F.poblacion || { base: 4, porNivel: [3, 3, 3, 3, 3], tope: 30, niveles: [] };
          const sabe = [];
          if (window.FracturaSaber) {
            window.FracturaSaber.ramas(k).forEach(r => r.escalones.forEach((e, i) => { if (e.ef && e.ef.poblacion) sabe.push(`${esc(e.nombre)} (${esc(r.nombre)} ${i + 1}) +${e.ef.poblacion}`); }));
            window.FracturaSaber.cruces(k).forEach(x => { if (x.ef && x.ef.poblacion) sabe.push(`${esc(x.nombre)} +${x.ef.poblacion}`); });
          }
          return `<tr${k === f ? ' class="mio"' : ""}><th>${esc(F.corto)}</th><td>${pb.base}</td><td>${pb.porNivel.map((n, i) => `${pb.niveles && pb.niveles[i] ? esc(pb.niveles[i]) + " " : ""}+${n}`).join(" · ")}</td><td>${pb.tope || 30}</td><td>${sabe.join("; ") || "ninguno"}</td></tr>`;
        }).join("")}</table>
        <p>Ejemplo: con ${fac && fac.poblacion ? esc(fac.corto) : "Brurland"}, una capital de nivel 3 y una ciudad de nivel 1 dan ${(() => { const pb = (fac && fac.poblacion) || FACCIONES["caballeros-del-reino"].poblacion; return pb.base + pb.porNivel.slice(0, 3).reduce((a, b) => a + b, 0) + pb.porNivel[0]; })()} tropas de límite, antes del saber.</p>`],
      ["asedio", "Tomar ciudades", `<ul><li>Una ciudad <strong>sin dueño</strong> se toma entrando en ella.</li>
        <li>Una ciudad <strong>con dueño</strong> se asedia: entras y te quedas. Si tu tropa sigue dentro cuando empieza tu siguiente turno, la ciudad es tuya. Si la echan o la matan antes, el asedio se levanta.</li>
        <li>En el mapa, una ciudad sitiada lleva ⚔ delante del nombre.</li>
        <li>Si cae tu capital y no tienes un Refugio, quedas fuera. Tus tropas se quedan sin bandera.</li></ul>`],
      ["saber", "Saber", `<p>Cada ejército tiene su propio árbol de conocimiento: cuatro ramas de seis escalones. Cada escalón pide el anterior de su rama. Algunos saberes piden avanzar en <strong>dos ramas</strong> a la vez.</p>
        ${SBf ? `<ul>${SBf.ramas(f).map(r => `<li><strong style="color:${r.color}">${esc(r.nombre)}</strong>: ${r.escalones.map(e => esc(e.nombre)).join(" → ")}</li>`).join("")}</ul>
        <p>Especiales: ${SBf.cruces(f).map(x => `<strong>${esc(x.nombre)}</strong>`).join(", ")}.</p>` : ""}`],
      ["mar", "El mar", `<ul><li>El agua clara se navega. El mar oscuro de fuera, no.</li>
        <li>Con un <strong>Muelle</strong> en una ciudad que tenga agua a dos casillas, esa ciudad bota barcos y tus tropas pueden embarcar desde cualquier orilla.</li>
        <li>Embarcar y desembarcar gastan el movimiento. Una tropa embarcada va despacio, no ataca y no tiene defensa.</li>
        <li>A lo que está en el agua solo le llegan los tiradores, los voladores y los barcos.</li>
        <li>El Muelle se mejora a Astillero y a Atarazana para barcos mejores.</li></ul>`],
      ["pactos", "Pactos y traiciones", `<ul><li>En <strong>Bandos</strong> puedes proponer un pacto: No se pueden atacar y ven lo que ve el otro. Pero no se comparte la victoria.</li>
        <li>Pactar con un ejército que el tuyo <strong>odia</strong> tiene un precio: algunos soldados se niegan y se vuelven contra todos.${fac && fac.odia ? ` ${esc(fac.corto)} odia a ${fac.odia === "vivos" ? "todos los vivos" : fac.odia.map(x => esc(FACCIONES[x] ? FACCIONES[x].corto : x)).join(", ")}.` : ""}</li>
        <li>Traicionar un pacto se puede una vez y cuesta la cuarta parte de tus soldados.</li>
        <li>Cuando cae un ejército, sus tropas se quedan <strong>sin bandera</strong>: no atacan a nadie. Una tropa tuya a su lado puede <strong>acogerlas</strong> pagando oro.</li></ul>`],
      ["frentes", "Frentes y mesas", `<ul><li>Los <strong>frentes</strong> son guerras ya montadas contra la máquina: tres al día y una gran guerra a la semana. Ganarlos da cartas. Puedes jugarlos aunque ya hayas cobrado.</li>
        <li>En <strong>Mesas</strong> se juega contra otros jugadores, de 2 a 8, por turnos y cada quien cuando puede. Cada jugador apuesta las cartas que quiera, o ninguna. Quien gana se lleva las de los que pierden.</li></ul>`],
      ["ordenes", "Órdenes", `<p>Una tropa con orden actúa sola al terminar tu turno. Así no tienes que mover tus tropas una a una.</p>
        <ul>${Object.keys(ORD).map(k => `<li><strong>${esc(ORD[k].nombre)}.</strong> ${esc(ORD[k].texto)}</li>`).join("")}</ul>
        <ul><li>Las órdenes se dan desde la tarjeta de la tropa. En el mapa, un iconito junto a su barra de vida dice qué orden cumple.</li>
        <li>Si mueves o atacas con ella a mano, la orden se quita.</li>
        <li><strong>Grupos.</strong> Mantén <kbd>Mayús</kbd> y arrastra sobre el mapa para elegir varias tropas a la vez. Les puedes dar la misma orden a todas.</li>
        <li>Una tropa con poca vida deja lo que estaba haciendo y se va a curar. Cuando se recupera, vuelve a su orden.</li>
        <li>Las tropas con orden no cuentan como pendientes al pulsar <kbd>N</kbd>.</li></ul>`],
      ["retaguardia", "Retaguardia y portales", `<ul><li><strong>Caminos.</strong> Moverse por las provincias que son tuyas cuesta la mitad. Las tropas nuevas llegan antes al frente.</li>
        <li><strong>Punto de reunión.</strong> En el panel de la ciudad puedes marcar una casilla del mapa. Lo que entrene esa ciudad irá allí solo.</li>
        <li><strong>${esc(f ? D.nombreEdificio("portal", f) : EDIFICIOS.portal.nombre)}.</strong> La última mejora de una ciudad grande. Con dos ciudades que lo tengan, una tropa que esté dentro o al lado de una pasa a la otra al instante.</li>
        <li>Construirlo cuesta mucho, y cada viaje se paga: 4 de oro y 2 de maná. Las tropas pesadas, los héroes y los gigantes pagan el doble.</li>
        <li>Cada portal hace un viaje por turno. No funciona si alguna de las dos ciudades está sitiada o tiene enemigos al lado.</li></ul>`],
      ["administracion", "Gobernar muchas ciudades", `<ul><li><strong>Administración.</strong> Las tres primeras ciudades no cuestan nada. Desde la cuarta, cada ciudad más cuesta oro cada turno, y cada vez más: 1 con cuatro ciudades, 3 con cinco, 6 con seis, 10 con siete. Sale en el desglose del oro.</li>
        <li><strong>${esc(f ? D.nombreEdificio("transmutacion", f) : EDIFICIOS.transmutacion.nombre)}.</strong> Cambia hasta 6 de un recurso por otro cada turno en esa ciudad. Das 3 y recibes 2${fac && fac.mods.transmutaBien ? ". Tu ejército cambia 1 por 1" : ""}. El Ánima no se consigue así.</li></ul>
        <h4 class="fr-h4">Obras de ciudad</h4>
        <p>Se encargan desde el panel de la ciudad, en Obras y mando. Gastan lo que sobra.</p>
        <ul>${Object.keys(D.OBRAS).map(k => `<li><strong>${esc(D.OBRAS[k].nombre)}</strong> (${Object.keys(D.OBRAS[k].coste).map(r => `${D.OBRAS[k].coste[r]} ${RECURSO_NOMBRE[r].toLowerCase()}`).join(", ")}). ${esc(D.OBRAS[k].texto)}</li>`).join("")}</ul>`],
      ["sanadores", "Sanadores", `<p>Cada ejército tiene una tropa que cura. Al empezar tu turno cura a las tropas aliadas que tiene al lado. No hace falta gastar su acción.</p>
        <ul>${Object.keys(FACCIONES).map(k => { const c = Object.keys(CLASES).find(x => CLASES[x].sanador && CLASES[x].exclusiva === k); return c ? `<li><strong>${esc(D.tropa(k, c).nombre)}</strong> (${esc(FACCIONES[k].corto)}): ${esc(CLASES[c].texto || "")}</li>` : ""; }).join("")}</ul>`],
      ["heroes", "Héroes", `<p>Los héroes son leyendas. No salen en todas las guerras: casi solo en las largas.</p>
        <ul><li><strong>Requisitos.</strong> Además de lo que pide cada uno, hace falta <strong>${D.RENOMBRE_HEROE} de renombre</strong> y que la guerra vaya por cierto turno: ${Object.keys(D.TURNO_HEROE).map(k => `${k === "pequeno" ? "pequeño" : k} ${D.TURNO_HEROE[k]}`).join(", ")}. En un mapa hecho para más de cuatro bandos, 2 turnos más. Los requisitos se ven en la ciudad, con lo que llevas.</li>
        <li><strong>Renombre.</strong> Se gana matando (más si es un oficial o un héroe, o si tu tropa peleaba sola), tomando ciudades (más si es una capital) y en duelos.</li>
        <li>Cuestan mucho, pero son mucho más fuertes que cualquier tropa. Cada héroe tiene una pasiva y dos habilidades. Lo que hace cada uno sale en el Códice.</li>
        <li><strong>Aguante.</strong> El primer golpe que mataría a un héroe lo deja con 1 de vida. Solo pasa una vez por guerra.</li>
        <li>Se curan 3 de vida al empezar cada turno.</li>
        <li><strong>Duelo de leyendas.</strong> Cuando un héroe ataca a otro, todo el mapa lo ve y queda en la crónica.</li>
        <li>Cada ejército invoca un héroe por guerra como mucho. Si cae, no vuelve en esa guerra.</li></ul>`],
      ["gigantes", "Gigantes", `<p>Algunos héroes son tan grandes que ocupan 2×2 casillas: ${["rykerd", "zaphar", "ebonrabia", "engranaje"].filter(h => HEROES[h]).map(h => `<strong>${esc(HEROES[h].nombre)}</strong>`).join(", ")}.</p>
        <ul><li>Se mueven como cualquier otra tropa, pero el bosque no los frena.</li>
        <li>Se les ataca desde cualquier casilla que toque su cuerpo.</li>
        <li>Para cruzar el mar cada uno tiene su manera. Dos de ellos saltan por encima del agua. Uno tiende un puente y avanza una casilla por turno, sin defensa mientras está sobre el agua. El de metal camina por el fondo a media marcha, y allí abajo nadie le puede tocar ni él puede atacar.</li>
        <li>Cruzar por portal les cuesta el doble.</li></ul>`],
      ["soldados", "Tus soldados", `<p>Tus soldados viven de una guerra a otra. Lo que les pasa se queda en su ficha.</p>
        <ul><li><strong>Rangos.</strong> Suben con las victorias: ${D.RANGOS.map(r => `${esc(r.nombre)} (${r.desde})`).join(", ")}. Desde veterano eligen una especialización: ${Object.values(ESPECIALIZACIONES).map(e => esc(e.nombre)).join(", ")}.</li>
        <li><strong>Contingente.</strong> Llevas 6 soldados a cada guerra, y uno más por cada 3 guerras ganadas (hasta 12).</li>
        <li><strong>Capitanes.</strong> Puedes nombrar hasta 3, uno por compañía, desde la ficha de un soldado (hace falta ser al menos soldado). Cada compañía es su capitán y hasta 4 soldados. Lo que da:
          <ul><li>El capitán tiene +2 de vida.</li>
          <li>Los soldados de su compañía a 2 casillas o menos de él tienen +1 de defensa.</li>
          <li>Solo un capitán puede llevar estandarte, y el estandarte ayuda a los que tiene cerca.</li>
          <li>Al elegir el contingente automático, los capitanes van primero.</li>
          <li>Cuidado: si el capitán cae, su compañía pelea con −1 de ataque durante 3 turnos. Y el enemigo lo trata como oficial: va a por él.</li></ul></li>
        <li><strong>Heridas.</strong> Quien cae a veces sobrevive con una herida grave y pasa 2 guerras convaleciente. Ayudan la Voluntad y la Constitución. Cada vez que se salva por poco suma una cicatriz.</li>
        <li><strong>Apodos.</strong> Se ganan por lo que hace: matar un líder o un héroe, salvarse una y otra vez, hacer muchas bajas a un mismo ejército, cazar monstruos, las cicatrices... Nadie del mismo ejército repite apodo.</li></ul>
        <p>Cómo se llevan entre ellos y con el enemigo está en <strong>Relaciones</strong>.</p>`],
      ["equipo", "Equipo y reliquias", `<p>Cada soldado tiene cuatro huecos: <strong>arma</strong>, <strong>armadura</strong>, <strong>accesorio</strong> y <strong>estandarte</strong>. Solo un capitán puede llevar estandarte. Lo que hace cada objeto sale en la ficha del soldado y en la pestaña Reliquias.</p>
        <ul><li><strong>Qué dan.</strong> Las armas suelen dar ataque o alcance; las armaduras, defensa y vida; los accesorios, cosas como movimiento, visión o curación. Los estandartes ayudan a los aliados a 2 casillas o menos.</li>
        <li><strong>Dónde se encuentran.</strong> Al registrar unas ruinas (más a menudo en ${esc(TIPOS_FRACTURA.archivo ? TIPOS_FRACTURA.archivo.nombre : "el Archivo")}) y en lo que dejan los guardianes de ruinas y fortalezas al caer.</li>
        <li><strong>Durante la guerra.</strong> Quien recoge una reliquia se la pone si tiene el hueco libre. Si no, va al reliquiario. Cuando cae un soldado, lo que llevaba se queda en el suelo y lo puede recoger cualquiera, también el enemigo. En el mapa se ve una gema dorada flotando en esa casilla; si la tocas, dice qué hay en el suelo. Se recoge entrando en la casilla.</li>
        <li><strong>Al acabar la guerra.</strong> Lo que llevan tus soldados vivos y lo del reliquiario vuelve contigo. Lo que quedó en el suelo lo recuperas si ganas; si pierdes, puedes perderlo. Lo que se llevó el enemigo, se pierde.</li>
        <li><strong>Entre guerras.</strong> Equipa y quita reliquias desde la ficha de cada soldado. Las de los caídos vuelven al reliquiario.</li>
        <li><strong>Herencias.</strong> Si una reliquia pasa de un padre a su hijo, queda anotada como herencia en su historia.</li></ul>`],
      ["relaciones", "Relaciones", `<p>Así se relacionan tus soldados entre ellos y con el enemigo. Todo queda en la ficha de cada uno, en Familia y compañeros, Manías y Su historia.</p>
        <ul><li><strong>Compañeros de armas.</strong> Cada guerra que dos soldados pasan juntos cuenta. Con 3 o más ya son compañeros y sale en sus fichas.</li>
        <li><strong>Luto.</strong> Si cae alguien con quien combatió al menos 3 guerras, queda de luto: +1 de ataque durante 3 guerras. Por cada caído, solo los dos que más guerras compartieron con él. Lleva un brazalete negro en el retrato.</li>
        <li><strong>Parejas e hijos.</strong> Un veterano de 28 años o más, con 10 victorias y 4 años de servicio, puede formar familia. Su pareja puede ser alguien de fuera o un compañero con el que lleve 4 guerras o más. Los hijos crecen en el cuartel y se alistan a los 16 años, con el apellido de la casa. La mitad de las veces siguen el oficio de su padre o su madre.</li>
        <li><strong>Casas y herencias.</strong> Cada apellido es una casa, con su árbol en la pestaña Casas. Una reliquia que pasa de padres a hijos queda anotada como herencia.</li>
        <li><strong>Capitanes y compañías.</strong> Una compañía es su capitán y hasta 4 soldados. Pelean mejor juntos (+1 de defensa cerca de su capitán) y lo pasan mal si lo pierden (−1 de ataque durante 3 turnos).</li>
        <li><strong>Manías.</strong> Se le notan según cómo lo uses: si pelea de lejos o cuerpo a cuerpo, el terreno que prefiere, si se salva por poco a menudo, si remata rezagados, si entra el primero en las ciudades...</li>
        <li><strong>Rencores.</strong> El ejército al que más bajas hace un soldado queda entre sus manías («Le tiene ganas a...»). Con muchas bajas al mismo puede ganarse el apodo de Azote de ese ejército.</li>
        <li><strong>Ejércitos que se odian.</strong> Cada ejército odia a otros por su historia (Osses odia a todos los vivos). Si pactas con uno de ellos, algunos de tus soldados se niegan y se vuelven contra todos.</li>
        <li><strong>Némesis.</strong> Si un enemigo mata a uno de tus veteranos y sobrevive a la guerra, se convierte en tu némesis. Vuelve en otra guerra como capitán enemigo, con su nombre, su apodo y sus victorias. Si lo matas, desaparece para siempre y queda en la crónica.</li>
        <li><strong>Desertores.</strong> Quien traiciona un pacto pierde soldados. Esos desertores pueden aparecer después en las filas de otro ejército cuando entrena la misma tropa.</li></ul>`],
      ["teclas", "Teclas", `<p><kbd>N</kbd> siguiente tropa · <kbd>E</kbd> terminar turno · <kbd>C</kbd> ir a tus tropas · <kbd>A</kbd> alcance de los enemigos · <kbd>I</kbd> saber · <kbd>+</kbd> <kbd>−</kbd> zoom · <kbd>Esc</kbd> soltar o abrir el menú. Arrastra el mapa para moverlo.</p>`]
    ];
  }
  function pintarAyuda() {
    const secs = seccionesAyuda(), q = ayudaBusca.trim().toLowerCase();
    const sinTags = h => h.replace(/<[^>]+>/g, " ").toLowerCase();
    const vistas = q ? secs.filter(s => s[1].toLowerCase().includes(q) || sinTags(s[2]).includes(q)) : secs.filter(s => s[0] === ayudaSeccion);
    const marca = h => (q ? h.replace(/>([^<]+)</g, (m, t) => `>${t.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), x => `<mark>${x}</mark>`)}<`) : h);
    $("frAyudaCuerpo").innerHTML = `<nav class="fr-ay-nav"><input type="search" class="fr-entrada" id="frAyudaBusca" placeholder="Buscar..." value="${esc(ayudaBusca)}">
        ${secs.map(s => `<button type="button" class="fr-ay-sec${!q && s[0] === ayudaSeccion ? " sel" : ""}${q && vistas.includes(s) ? " hay" : ""}" data-ay="${s[0]}">${esc(s[1])}</button>`).join("")}</nav>
      <div class="fr-ay-texto">${vistas.map(s => `<section><h3>${esc(s[1])}</h3>${marca(s[2])}</section>`).join("") || `<p class="fr-vacio">Nada con «${esc(ayudaBusca)}».</p>`}</div>`;
  }
  function abrirAyuda() {
    pintarAyuda();
    $("frAyuda").showModal();
  }
  $("frAyudaCuerpo").addEventListener("click", ev => { const b = ev.target.closest("[data-ay]"); if (!b) return; ayudaSeccion = b.dataset.ay; ayudaBusca = ""; son("clic"); pintarAyuda(); });
  $("frAyudaCuerpo").addEventListener("input", ev => {
    if (ev.target.id !== "frAyudaBusca") return;
    ayudaBusca = ev.target.value; pintarAyuda();
    const i = $("frAyudaBusca"); i.focus(); i.setSelectionRange(i.value.length, i.value.length);
  });
  ["frAyuda", "frcodex"].forEach(id => $(id).addEventListener("click", ev => { if (ev.target.closest("[data-cerrar]")) $(id).close(); }));

  /* --- Lo que comparten las dos páginas --- */
  // Ganchos que rellena la página de la guerra (la parte común no conoce sus funciones)
  const G = {};
  const nombreFaccion = f => (FACCIONES[f] ? FACCIONES[f].corto : f);
  const plazoTexto = limite => {
    if (!limite) return "";
    const ms = Date.parse(limite) - Date.now();
    if (ms <= 0) return "se le pasó el plazo";
    const h = Math.floor(ms / 3600000);
    return h >= 1 ? `le quedan ${h} h` : `le quedan ${Math.max(1, Math.floor(ms / 60000))} min`;
  };
  /* Las dos habilidades de un héroe, con su espera */
  function habilidadesHtml(h) {
    const ab = [h.ef.activa, h.ef.activa2].filter(Boolean);
    return ab.length ? `<ul class="fr-habilidades">${ab.map(a => `<li><strong>${esc(a.nombre)}</strong>${a.cd ? ` <small>cada ${a.cd} turnos</small>` : ""}. ${esc(a.texto)}</li>`).join("")}</ul>` : "";
  }
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
  if ($("frSalirCompleta")) $("frSalirCompleta").addEventListener("click", pantallaCompleta);

  const CURVA_TEXTO = { "Early game": "Pega pronto. Si la guerra se alarga, pierde ventaja.", "Late game": "Necesita tiempo. Cuando llega arriba cuesta pararlo.", "Desgaste": "Cada baja lo alimenta.", "Mid game": "Tiene un momento de fuerza muy alto a mitad de la guerra.", "Depende del mapa": "Su fuerza depende del terreno y de cómo se plantee la guerra." };
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
    if (s.luto) marcas.push(["De luto", `Llora a ${s.luto.nombre}: +1 de ataque durante ${s.luto.restantes} guerra(s)`]);
    if (s.estado === "establecido") marcas.push("Con familia");
    const barras = STATS_ORDEN.map(k => `<i title="${STAT_NOMBRE[k]} ${s.stats[k]}"><b style="height:${s.stats[k] * 10}%"></b><small>${k}</small></i>`).join("");
    const clases = ["fr-carta", o.pon === "quita" ? "sel" : "", o.caido || s.estado === "caido" ? "fr-caido" : "", o.bloq ? "bloq" : ""].filter(Boolean).join(" ");
    const attr = o.pon ? `data-pon="${s.id}" tabindex="0" role="button"` : o.ver ? `${o.attr || "data-ficha"}="${s.id}" tabindex="0" role="button"` : "";
    const accion = o.pon === "quita" ? `<span class="fr-carta-accion fr-quita">Quitar</span>` : o.pon === "lleva" ? `<span class="fr-carta-accion">A la guerra</span>` : "";
    return `<div class="${clases}" ${attr} style="--i:${Math.min(o.i || 0, 14)}">
      <div class="fr-carta-marco">${retr(s, 170, true)}
        ${marcas.length ? `<span class="fr-carta-marcas">${marcas.slice(0, 2).map(t => Array.isArray(t) ? `<i title="${esc(t[1])}">${esc(t[0])}</i>` : `<i>${esc(t)}</i>`).join("")}</span>` : ""}
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


  /* --- Ir de una página a otra ---
     fractura.html es la portada y el cuartel; fractura-guerra.html, el tablero. Lo que hay que llevar de una a otra va por la dirección
     (ejército, mesa) y, la configuración de una guerra nueva, por sessionStorage. Un aviso puede cruzar con el salto. */
  const PAG_CUARTEL = "fractura.html", PAG_GUERRA = "fractura-guerra.html";
  const guardarSesion = (k, v) => { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  const leerSesion = k => { try { const v = JSON.parse(sessionStorage.getItem(k) || "null"); sessionStorage.removeItem(k); return v; } catch (e) { return null; } };
  function irAGuerra(d) {
    const q = new URLSearchParams();
    if (d.f) q.set("f", d.f);
    if (d.mesa) q.set("mesa", d.mesa);
    if (d.nueva) { guardarSesion("fracturaNueva", d.nueva); q.set("nueva", "1"); }
    location.href = `${PAG_GUERRA}?${q}`;
  }
  function irAlCuartel(f, p, avisoTexto) {
    if (avisoTexto) guardarSesion("fracturaAviso", { t: avisoTexto, error: /no se pudo|ya no|no estás|todavía no/i.test(avisoTexto) });
    const q = new URLSearchParams();
    if (f) { q.set("f", f); q.set("p", p || "guerra"); }
    location.href = `${PAG_CUARTEL}${f ? `?${q}` : ""}`;
  }

  /* Los ejércitos del jugador (servidor o este navegador) */
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
    Object.keys(guardados).forEach(f => { ejercitos[f] = guardados[f].ej; if (C.repararApodos(ejercitos[f])) Red.guardarEjercito(ejercitos[f]); });
  }


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
})();
