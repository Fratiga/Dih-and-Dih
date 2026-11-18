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
  let grupoPendiente = null;   // orden del grupo que espera su objetivo en el mapa (conquistar, explorar, defender, matanza)
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
        <li>Lo demás nunca pasa del tope de tu ejército. La Fiesta sí: suma por encima del tope, hasta un máximo absoluto de 40 tropas.</li></ul>
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
        <ul><li>Explorar, Defender, Conquistar y Matanza piden un objetivo: después de pulsar la orden, toca en el mapa el punto, la ciudad o la tropa propia que quieres. Si tocas la propia tropa, la orden se cumple sin objetivo. Con el objetivo marcado, al elegir la tropa se ve en el mapa.</li>
        <li>Las órdenes se dan desde la tarjeta de la tropa. En el mapa, un iconito junto a su barra de vida dice qué orden cumple.</li>
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

