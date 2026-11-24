/* =============================================================================
   LA FRACTURA: la guerra sobre el tablero, el final con su crónica y la guerra de una mesa.
   Se llega desde fractura.html. Al acabar o al salir se vuelve al cuartel.
   ARCHIVO GENERADO por tools/construir-fractura-ui.js a partir de js/fractura-ui/comun.js y js/fractura-ui/guerra.js.
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


  // Se guarda al momento tras cada acción: si se cierra la página a mitad del turno, al volver sigue igual (no se puede rehacer el turno)
  let avisoSinGuardar = false;
  function guardarYa() {
    if (pvp || !est) return;
    const ok = Red.guardarGuerra(est, cfgGuerraActual);
    if (ok === false && !avisoSinGuardar) { avisoSinGuardar = true; aviso("Este navegador no deja guardar la guerra (puede que no le quede espacio). Si cierras la página, perderás lo de este turno.", true); }
  }
  function guardarEnCurso() {
    if (pvp || !est) return;
    clearTimeout(guardarEstadoTimer);
    if (!ocupadoIA) guardarYa();
    else guardarEstadoTimer = setTimeout(() => { if (est && !ocupadoIA) guardarYa(); }, 400);
  }
  /* Mesas: lo hecho en este turno se apunta en el navegador al momento. Si se recarga antes de mandar el turno, se vuelve a aplicar tal cual */
  const claveTurnoMesa = () => `fracturaMesaTurno:${pvp.id}`;
  function anotarMesa(acc) {
    if (!pvp) return;
    pvp.acciones.push(acc);
    try { localStorage.setItem(claveTurnoMesa(), JSON.stringify({ n: pvp.n, acciones: pvp.acciones })); } catch (e) { /* sin almacenamiento */ }
  }
  function olvidarTurnoMesa() { try { if (pvp) localStorage.removeItem(claveTurnoMesa()); } catch (e) { /* nada */ } }
  function recuperarTurnoMesa() {
    let g = null;
    try { g = JSON.parse(localStorage.getItem(claveTurnoMesa()) || "null"); } catch (e) { g = null; }
    if (!g || g.n !== pvp.n || !Array.isArray(g.acciones) || est.activo !== yoIdx) { olvidarTurnoMesa(); return; }
    g.acciones.forEach(acc => { const r = FM.aplicar(est, acc); if (r.ok) pvp.acciones.push(acc); });
  }

  function retomarGuerra() {
    const g = Red.cargarGuerra();
    if (!g || !ejercitos[g.cfg.faccion]) return;
    if (g.est.reglas !== D.REGLAS) { Red.borrarGuerra(); irAlCuartel(g.cfg.faccion, "guerra", "Esa guerra empezó con las reglas anteriores y ya no se puede continuar."); return; }
    ej = ejercitos[g.cfg.faccion];
    pararSondeo(); pvp = null; yoIdx = 0;
    est = g.est; cfgGuerraActual = g.cfg;
    sel = { uid: null, ciudad: null }; modo = null;
    entrarGuerra(false);
  }

  function crearTablero() {
    if (!window.FracturaTableroPhaser) return null;
    return window.FracturaTableroPhaser.crear($("frTablero"), { alTocar: tocar, alTocarCiudad: tocarCiudad, alPasar: pasarPor, alSonar: son, alMoverVista: pintarMiniPronto, alCaja: elegirGrupo });
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
    } else if (est.activo === humano()) { if (!avisoNucleo()) cartel(`Turno ${est.turno}`, 1200); atenderOfertas(); }
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
    if (!cumpliendo && (acc.t === "mover" || acc.t === "atacar" || acc.t === "habilidad" || acc.t === "portal") && acc.uid && est.unidades[acc.uid] && est.unidades[acc.uid].orden) delete est.unidades[acc.uid].orden;
    const r = FM.aplicar(est, acc);
    if (r.ok && pvp) anotarMesa(acc);
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
    }).join("") + (() => {
      // Tropas: cuántas hay y cuántas caben
      const n = FM.cuentaTropas(est, H), L = FM.limiteTropas(est, H);
      return `<button type="button" class="fr-rec fr-rec-tropas${n >= L ? " fr-rec-lleno" : ""}" data-rec="tropas" title="Tropas: toca para ver de dónde sale el límite"><span class="fr-ico-tropas">⚔</span><b>${n}/${L}</b><small>tropas</small></button>`;
    })();
  }
  $("frRecursos").addEventListener("click", ev => {
    const b = ev.target.closest("[data-rec]");
    if (!b || !est) return;
    const k = b.dataset.rec, H = humano(), des = $("frDesglose");
    if (!des.classList.contains("hidden") && des.dataset.rec === k) { des.classList.add("hidden"); return; }
    if (k === "tropas") {
      const fac = FACCIONES[est.jugadores[H].faccion], pb = fac.poblacion, filas = [`<li><span>${esc(fac.corto)}</span><b>+${pb.base}</b></li>`];
      FM.ciudadesDe(est, H).forEach(c => { let m = 0; for (let i = 0; i < c.nivel && i < pb.porNivel.length; i++) m += pb.porNivel[i]; filas.push(`<li><span>${esc(c.nombre)} (${esc(D.nivelCiudad(fac.id || est.jugadores[H].faccion, c.nivel))})</span><b>+${m}</b></li>`); });
      const se = FM.sab(est, H).poblacion; if (se) filas.push(`<li><span>Saber</span><b>+${se}</b></li>`);
      const rean = FM.unidadesDe(est, H).filter(u => u.reanimado).length;
      des.dataset.rec = k;
      des.innerHTML = `<h4>⚔ Tropas <b>${FM.cuentaTropas(est, H)} de ${FM.limiteTropas(est, H)}</b></h4><ul>${filas.join("")}</ul><p>Hacer crecer una ciudad sube el límite. Como mucho, ${pb.tope}.${rean ? ` Tus ${rean} reanimado${rean === 1 ? "" : "s"} no cuentan.` : ""}</p>`;
      des.classList.remove("hidden");
      const r = b.getBoundingClientRect();
      des.style.left = `${Math.max(8, Math.min(window.innerWidth - 268, r.left))}px`;
      son("clic");
      return;
    }
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
    // Con muchos bandos los nombres no caben: se quedan el retrato, la forma y las ciudades (el nombre, al pasar el ratón)
    $("frBandos").classList.toggle("compacta", est.jugadores.length > 4);
    $("frBandos").innerHTML = est.jugadores.map((j, i) => {
      const b = bandos[i], ciudades = FM.ciudadesDe(est, i).length;
      const aliado = i !== H && FM.mismoEquipo(est, i, H), pacto = aliado && FM.hayPacto(est, i, H);
      return `<button type="button" class="fr-bando${aliado ? (pacto ? " pacto" : " aliado") : ""}${j.traidor ? " traidor" : ""}${est.activo === i && est.ganador === null ? " activo" : ""}${j.eliminado ? " fuera" : ""}${i === H ? " yo" : ""}" data-bando="${i}" style="--c:${b.col}"
        title="${esc(j.nombre)} (${esc(FACCIONES[j.faccion].corto)})${i === H ? " · eres tú" : pacto ? " · tienes un pacto con él" : aliado ? " · aliado" : ""}${j.traidor ? " · traidor" : ""}${j.eliminado ? " · eliminado" : ` · ${ciudades} ciudad${ciudades === 1 ? "" : "es"} · ${FM.puntuacion(est, i)} puntos`}">
        ${retLider(j.faccion, 30, "fr-bando-ret")}<i>${b.forma}</i><span>${esc(FACCIONES[j.faccion].corto)}</span><b>${j.eliminado ? "✕" : `⌂${ciudades}`}</b>${est.activo === i && est.ganador === null ? `<em class="fr-bando-juega">juega</em>` : aliado ? `<em>${pacto ? "pacto" : "aliado"}</em>` : ""}</button>`;
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

  /* Al empezar mi turno: si alguien retiene el Núcleo del Sueño, se avisa en grande y se marca en el mapa */
  function avisoNucleo() {
    const H = humano(), n = est.nucleo;
    const k = est.nucleoHold.findIndex(x => x > 0);
    if (k < 0 || !n) return false;
    const lleva = est.nucleoHold[k], faltan = est.hold - lleva;
    if (k === H) cartel(`Retienes el Núcleo · ${lleva}/${est.hold}`, 2400, faltan === 1 ? "Si aguantas un turno más, ganas la guerra." : `Te faltan ${faltan} turnos para ganar. Todos irán a por ti.`, bandos[k].col);
    else cartel(`${FACCIONES[est.jugadores[k].faccion].corto} retiene el Núcleo · ${lleva}/${est.hold}`, 3200, faltan === 1 ? "Si sigue ahí al acabar su próximo turno, gana la guerra." : `Si llega a ${est.hold} turnos seguidos, gana la guerra. Échalo de ahí.`, k !== H && !FM.mismoEquipo(est, k, H) ? "#ff7a6a" : bandos[k].col);
    if (tablero) tablero.onda(n.x, n.y, k === H ? bandos[k].col : "#ff7a6a");
    return true;
  }
  function pintarTurno() {
    const H = humano(), activo = est.jugadores[est.activo];
    const tregua = FM.enTregua(est) ? `<span class="fr-tregua" title="Durante la tregua no se puede atacar a otros bandos ni entrar en sus ciudades">Tregua · ${est.tregua - est.turno + 1}</span>` : "";
    const hold = est.nucleoHold.map((n, k) => ({ n, k })).filter(o => o.n > 0)[0];
    const nucleo = hold ? `<button type="button" class="fr-nucleo${hold.k !== H && !FM.mismoEquipo(est, hold.k, H) ? " peligro" : ""}" data-ir-nucleo style="--c:${bandos[hold.k].col}" title="${esc(est.jugadores[hold.k].nombre)} lleva ${hold.n} de ${est.hold} turnos sobre el Núcleo del Sueño. Si llega a ${est.hold}, gana. Toca para verlo.">◎ ${esc(FACCIONES[est.jugadores[hold.k].faccion].corto)} ${hold.n}/${est.hold}</button>` : "";
    $("frTurno").innerHTML = `${tregua}${nucleo}<span class="fr-turno-n" title="Al acabar el último turno gana quien tenga más puntos">Turno <b>${est.turno}</b> / ${est.maxTurnos}</span>`;
    void H; void activo;
  }

  /* --- Lo que se marca sobre el mapa --- */
  let rutaPrevia = null, ataquePrevio = null, previaFija = null;
  function pintarResaltes() {
    const H = humano();
    const e = { sel: sel.uid, ciudad: sel.ciudad, mover: new Map(), atacar: new Set(), objetivosHab: new Set(), ruta: rutaPrevia, previaAtq: ataquePrevio, casilla: sel.casilla || null, amenaza: null, enlace: null, marca: marcaHover };
    // Un portal elegido: se marca el otro extremo y se unen con una línea
    if (sel.casilla) { const ca = FM.casilla(est, sel.casilla.x, sel.casilla.y); if (ca && ca.est === "costura" && est.costuras[ca.costura]) { const par = est.costuras[ca.costura]; e.enlace = par.a.x === sel.casilla.x && par.a.y === sel.casilla.y ? par.b : par.a; } }
    const u = sel.uid && est.unidades[sel.uid];
    if (u && u.dueno === H && soyYo()) {
      if (!modo) {
        if (u.pm > 0) FM.alcanzables(est, u).destinos.forEach((n, k) => { if (u.tam === 2) FM.celdasDe({ x: n.x, y: n.y, tam: 2 }).forEach(q => { const kq = `${q.x},${q.y}`; if (!e.mover.has(kq) && !FM.ocupa(u, q.x, q.y)) e.mover.set(kq, n); }); else e.mover.set(k, n); });
        Object.values(est.unidades).forEach(w => { if (FM.hostil(est, w.dueno, H) && FM.veUnidad(est, H, w) && !FM.razonNoAtacar(est, u, w)) FM.celdasDe(w).forEach(q => e.atacar.add(`${q.x},${q.y}`)); });
        const o = u.orden;
        if (o && o.uid && est.unidades[o.uid]) FM.celdasDe(est.unidades[o.uid]).forEach(q => e.objetivosHab.add(`${q.x},${q.y}`));
        else if (o && o.x !== undefined && o.tipo !== "defender") e.objetivosHab.add(`${o.x},${o.y}`);
      } else modo.casillas.forEach(k => e.objetivosHab.add(k));
    }
    if (botar && soyYo()) botar.casillas.forEach(k => e.objetivosHab.add(k));
    if (grupo) grupo.forEach(uid => { const w = est.unidades[uid]; if (w) FM.celdasDe(w).forEach(q => e.objetivosHab.add(`${q.x},${q.y}`)); });
    if (sel.ciudad && est.ciudades[sel.ciudad] && est.ciudades[sel.ciudad].reunion) { const q = est.ciudades[sel.ciudad].reunion; e.objetivosHab.add(`${q.x},${q.y}`); }
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
    // Distancia contando el tamaño (los gigantes ocupan 2×2): desde una casilla ancla p, con la huella de u
    const dd0 = p => FM.dist({ x: p.x, y: p.y, tam: u.tam }, t);
    let desde = { x: u.x, y: u.y, rec: u.recorrido || 0 };
    const sx0 = u.x, sy0 = u.y;
    const aguaDesde = n => { u.x = n.x; u.y = n.y; const r = FM.razonAgua(est, u, t); u.x = sx0; u.y = sy0; return r; };
    if (dd0(u) > e.alc || aguaDesde(u)) {
      if (FM.polvoraFac(est, u) || CLASES[u.clase].pesado) return null;
      const info = FM.alcanzables(est, u);
      let mejor = null;
      info.destinos.forEach(n => { const dd = dd0(n); if (dd <= e.alc && dd >= 1 && !aguaDesde(n) && (!mejor || n.c < mejor.c || (n.c === mejor.c && dd > mejor.dd))) mejor = { x: n.x, y: n.y, c: n.c, dd }; });
      if (!mejor) return null;
      desde = { x: mejor.x, y: mejor.y, rec: (u.recorrido || 0) + cheb(u, mejor), mueve: true };
    }
    const sx = u.x, sy = u.y, sr = u.recorrido;
    u.x = desde.x; u.y = desde.y; u.recorrido = desde.rec;
    const dmg = FM.calcularDano(est, u, t);
    let ret = 0;
    if (dmg < t.hp && dd0(desde) <= FM.ef(est, t).alc && CLASES[t.clase].atq > 1 && !FM.razonAgua(est, t, u)) ret = Math.max(1, Math.ceil(FM.calcularDano(est, t, u) * 0.6));
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
    if (t) { const e = FM.ef(est, t), tr = tropaDe(t); mostrarPrevia(x, y, `<b style="color:${colorDe(t.dueno)}">${esc(FM.nombreUnidad(t))}</b><span>${esc(tr.nombre)} · ${t.dueno >= 0 ? esc(FACCIONES[est.jugadores[t.dueno].faccion].corto) : "sin dueño"}</span><span class="fr-previa-cifras">${ico("vida")}${t.hp}/${e.hpMax} ${ico("ataque")}${e.atq} ${ico("defensa")}${e.def}</span>`); }
  }
  /* El destino al que va una tropa si se toca (x, y). Un gigante (2×2) va a donde su huella cubra esa casilla: de los sitios posibles, el más barato */
  function destinoTocado(u, info, x, y) {
    if (u.tam !== 2) return info.destinos.get(`${x},${y}`) || null;
    let mejor = null;
    [[0, 0], [-1, 0], [0, -1], [-1, -1]].forEach(([dx, dy]) => { const n = info.destinos.get(`${x + dx},${y + dy}`); if (n && (!mejor || n.c < mejor.c)) mejor = n; });
    return mejor;
  }
  function calcularPrevia(u, x, y) {
    const H = humano();
    const t = FM.unidadEn(est, x, y);
    if (t && FM.hostil(est, t.dueno, H) && FM.veUnidad(est, H, t)) {
      if (u.atacado) { mostrarPrevia(x, y, `<b style="color:${colorDe(t.dueno)}">${esc(FM.nombreUnidad(t))}</b><span>Esta tropa ya atacó este turno</span>`); return; }
      const p = previaAtaque(u, t);
      // el motivo real por el que no se puede (tregua, noche, pólvora, alcance)
      const sx = u.x, sy = u.y, q = u.quieto;
      if (p && p.mueve) { u.x = p.desde.x; u.y = p.desde.y; u.quieto = false; }
      const razon = p ? FM.razonNoAtacar(est, u, t) : (FM.razonAgua(est, u, t) || ((FM.polvoraFac(est, u) || CLASES[u.clase].pesado) && FM.dist(u, t) > FM.ef(est, u).alc ? "No puede moverse y disparar: acércalo antes y dispara el turno siguiente" : "No llega este turno"));
      u.x = sx; u.y = sy; u.quieto = q;
      if (!p || razon) { mostrarPrevia(x, y, `<b style="color:${colorDe(t.dueno)}">${esc(FM.nombreUnidad(t))}</b><span class="fr-previa-no">${esc(razon || "No llega este turno")}</span>`); return; }
      ataquePrevio = { x, y };
      const queda = Math.max(0, p.hpT - p.dmg);
      mostrarPrevia(x, y, `<b style="color:${colorDe(t.dueno)}">${esc(FM.nombreUnidad(t))}</b>
        <span class="fr-previa-barra"><i style="width:${(queda / FM.ef(est, t).hpMax) * 100}%"></i><i class="pierde" style="width:${(Math.min(p.dmg, p.hpT) / FM.ef(est, t).hpMax) * 100}%"></i></span>
        <span>${p.mata ? "<strong>Lo derribas</strong>" : `Le quitas <strong>${p.dmg}</strong> de ${p.hpT}`}${p.ret ? ` · te responde <strong class="fr-neg">${p.ret}</strong>` : " · sin respuesta"}${p.mueve ? " · avanzas primero" : ""}</span>`);
    } else if (!t && u.pm > 0) {
      const info = FM.alcanzables(est, u);
      const n = destinoTocado(u, info, x, y);
      if (n) {
        rutaPrevia = FM.camino(info, n.x, n.y);
        const c = FM.casilla(est, x, y), ci = FM.ciudadEn(est, x, y);
        const cambiaAgua = !FM.esBarco(u) && (c.t === "agua") !== FM.enAgua(est, u);
        const nvU = FM.navalDe(est, u.dueno);
        const extra = cambiaAgua ? (c.t === "agua" ? ` · embarca${nvU.marinos || nvU.fondo ? "" : " y se queda sin movimiento"}` : " · desembarca") : ci && ci.dueno !== humano() ? " · tomas la ciudad" : c.est === "ruinas" && !c.saqueada ? " · registras las ruinas" : c.est === "fortaleza" ? " · tomas la fortaleza" : c.est === "nucleo" ? " · ocupas el Núcleo" : c.est === "costura" ? " · costura a otro fragmento" : "";
        mostrarPrevia(x, y, `<span>${ico("mov")} ${n.c} de ${u.pm}${D.TERRENOS[c.t].def ? ` · ${ico("defensa")}+${D.TERRENOS[c.t].def}` : ""}${extra}</span>`);
      }
    }
  }

  /* Tocar el rótulo de una ciudad: si algo espera una casilla (conquistar, reunión, una orden...), cuenta como tocar la ciudad; si no, se elige la ciudad */
  function tocarCiudad(x, y) {
    if (!est) return;
    if (modo || grupoPendiente || marcarReunion || botar || !soyYo()) { tocar(x, y); return; }
    const ci = FM.ciudadEn(est, x, y);
    if (!ci || !(FM.veCasilla(est, humano(), x, y))) { tocar(x, y); return; }
    limpiarPrevia(); grupo = null;
    sel = { uid: null, ciudad: ci.id }; modo = null; son("clic"); refrescar();
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
    // Conquistar con un grupo: la ciudad que se toque
    if (grupoPendiente && grupo && grupoPendiente !== "conquistar") {
      const tipo = grupoPendiente; grupoPendiente = null;
      const us = grupo.map(id => est.unidades[id]).filter(Boolean);
      us.forEach(w => { w.orden = ordenConObjetivo(tipo, w, x, y, grupo); });
      aviso(`${us.length} tropas: ${ORD[tipo].nombre.toLowerCase()}.`); son("clic");
      refrescar(); return;
    }
    if (grupoPendiente && grupo) {
      grupoPendiente = null;
      const ci = FM.ciudadEn(est, x, y);
      if (ci && ci.dueno !== humano() && (ci.dueno === null || FM.hostil(est, ci.dueno, humano()))) { grupo.forEach(id => { const w = est.unidades[id]; if (w) w.orden = { tipo: "conquistar", x, y, ciudad: ci.id }; }); aviso(`A por ${ci.nombre}.`); son("clic"); }
      else aviso("Eso no es una ciudad que se pueda tomar.", true);
      refrescar(); return;
    }
    // El punto de reunión de una ciudad: cualquier casilla de tierra
    if (marcarReunion) {
      const ci = est.ciudades[marcarReunion]; marcarReunion = null;
      const c = FM.casilla(est, x, y);
      if (ci && c && D.TERRENOS[c.t].mov > 0) { ci.reunion = { x, y }; aviso(`Lo que entrene ${ci.nombre} irá a reforzar esa casilla.`); son("clic"); }
      refrescar(); return;
    }
    // Un barco esperando sitio en el agua
    if (botar) {
      const b = botar; botar = null;
      if (b.casillas.has(`${x},${y}`)) {
        const r = aplicarYo({ t: "reclutar", ciudad: b.ciudad, clase: b.clase, x, y });
        if (!r.ok) { aviso(r.error, true); son("error"); } else son("recluta");
        return despuesDeAccion();
      }
      refrescar(); return;
    }
    // Habilidades que piden una casilla
    if (modo && u) {
      if (modo.orden && (modo.libre || modo.casillas.has(`${x},${y}`))) {
        ponerOrden(u, ordenConObjetivo(modo.orden.tipo, u, x, y));
        modo = null; refrescar(); return;
      }
      if (modo.casillas.has(`${x},${y}`) && modo.especial === "portal") {
        const r = aplicarYo({ t: "portal", uid: u.uid, ciudad: FM.ciudadEn(est, x, y).id });
        modo = null;
        if (!r.ok) { aviso(r.error, true); son("error"); } else son("magia");
        return despuesDeAccion();
      }
      if (modo.casillas.has(`${x},${y}`)) {
        const r = aplicarYo(Object.assign({ t: "habilidad", uid: u.uid, x, y }, modo.acc));
        modo = null;
        if (!r.ok) { aviso(r.error, true); son("error"); }
        return despuesDeAccion();
      }
      modo = null; refrescar(); return;
    }
    // Tocar el mapa sin nada pendiente suelta el grupo elegido con Mayús + arrastrar
    if (grupo) { grupo = null; grupoPendiente = null; }
    if (alternarEnCasilla(x, y, enCasilla, visible)) return;
    if (enCasilla && enCasilla.dueno === H) { limpiarPrevia(); sel = { uid: enCasilla.uid, ciudad: null }; modo = null; son("elegir"); refrescar(); return; }
    // Tocar a un aliado (de pacto o de equipo) con una tropa elegida: se pregunta si se quiere traicionar
    if (u && u.dueno === H && enCasilla && enCasilla.dueno >= 0 && enCasilla.dueno !== H && !FM.hostil(est, enCasilla.dueno, H) && visible && !u.atacado) {
      const r = FM.razonNoTraicion(est, H);
      if (r) { aviso(`${est.jugadores[enCasilla.dueno].nombre} es tu aliado. ${r}`, true); son("error"); return; }
      const seVan = FM.desertoresDe(est, H).map(w => FM.nombreUnidad(w));
      const si = await dialogo.confirmar(`${est.jugadores[enCasilla.dueno].nombre} es tu aliado. Para atacarle tienes que romper el pacto: quedas en guerra con todos y ningún otro bando volverá a pactar contigo.${seVan.length ? ` Desertan ${seVan.length}: ${seVan.join(", ")}.` : ""}`, { titulo: "¿Traicionar?", aceptar: "Traicionar y atacar", peligro: true });
      if (!si) return;
      const rt = aplicarYo({ t: "traicionar" });
      if (!rt.ok) { aviso(rt.error, true); son("error"); return; }
      son("derrota");
      despuesDeAccion();
      if (!est.unidades[u.uid] || est.ganador !== null) return;
      sel = { uid: u.uid, ciudad: null };
    }
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
      const dn = u.pm > 0 ? destinoTocado(u, info, x, y) : null;
      if (dn) {
        if (tactil && !(previaFija && previaFija.x === x && previaFija.y === y)) { previaFija = { x, y }; limpiarPreviaVisual(); calcularPrevia(u, x, y); pintarResaltes(); return; }
        limpiarPrevia();
        const m = aplicarYo({ t: "mover", uid: u.uid, x: dn.x, y: dn.y });
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

  /* Si se toca otra vez lo que ya está elegido, se pasa a lo siguiente de esa casilla: la tropa, la ciudad y el terreno */
  function alternarEnCasilla(x, y, enCasilla, visible) {
    const H = humano(), vista = est.vision[H][y * est.ancho + x] > 0;
    const ciudad = FM.ciudadEn(est, x, y);
    const ops = [];
    if (enCasilla && (visible || enCasilla.dueno === H)) ops.push({ uid: enCasilla.uid, ciudad: null });
    if (ciudad && vista) ops.push({ uid: null, ciudad: ciudad.id });
    if (vista && FM.casilla(est, x, y).t !== "vacio") ops.push({ uid: null, ciudad: null, casilla: { x, y } });
    const i = ops.findIndex(o => (o.uid && o.uid === sel.uid) || (o.ciudad && o.ciudad === sel.ciudad) || (o.casilla && sel.casilla && !sel.uid && !sel.ciudad && sel.casilla.x === x && sel.casilla.y === y));
    if (i < 0 || ops.length < 2) return false;
    limpiarPrevia(); modo = null;
    sel = ops[(i + 1) % ops.length];
    son("clic"); refrescar();
    return true;
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
    reanimacion: ["Vuelve de entre los muertos", "✦", "cian"], leyendas: ["Duelo de leyendas", "⚔", "oro"], tecnologia: ["Conocimiento", "✎", ""], heroe: ["Llega un héroe", "✪", "oro"], heroe_cae: ["Cae un héroe", "☠", "baja"], eliminado: ["Un bando cae", "✕", "baja"], refugio: ["Refugio", "⌂", "conq"], pacto: ["Pacto", "⚭", "cian"], traicion: ["Traición", "⚡", "baja"] };
  function procesarCronica() {
    const nuevos = est.cronica.slice(cronicaVista);
    const base = cronicaVista;
    cronicaVista = est.cronica.length;
    nuevos.forEach((e, i) => {
      if (FMH && e.heroe && e.tipo === "heroe") FMH.alInvocar(e.heroe);
      if (FMH && e.heroe && e.tipo === "heroe_cae") FMH.alCaer(e.heroe);
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
  function pendientes() { const H = humano(); return FM.unidadesDe(est, H).filter(u => !u.orden && !(u.desatado > 0) && (u.pm > 0 || !u.atacado) && u.quieto && !u.atacado); }
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
    const puedeSaber = mio && window.FracturaSaber.ramas(est.jugadores[H].faccion).map(r => r.id).concat(window.FracturaSaber.cruces(est.jugadores[H].faccion).map(x => x.id)).some(k => !FM.razonNoInvestigar(est, H, k));
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
  $("frTurno").addEventListener("click", ev => { if (ev.target.closest("[data-ir-nucleo]") && est && tablero) { tablero.irA(est.nucleo.x, est.nucleo.y); tablero.onda(est.nucleo.x, est.nucleo.y, "#ff7a6a"); } });

  /* --- Tarjeta de selección: tropa, ciudad o terreno --- */
  const NOMBRE_RASGO = FM.RASGO_NOMBRE;
  function accionesDeUnidad(u) {
    const H = humano(), jh = est.jugadores[H], fac = FACCIONES[jh.faccion], out = [];
    const ya = u.atacado ? "Ya actuó este turno." : null;
    const junto = (x, y) => Object.values(est.unidades).filter(w => FM.dist(w, { x, y }) <= 1);
    if (u.clase === "picaro") {
      Object.values(est.ciudades).filter(ci => esRival(ci.dueno) && cheb(ci, u) <= 1).forEach(ci => ci.edificios.filter(e => !(ci.desh[e] >= est.turno)).slice(0, 3).forEach(e =>
        out.push({ ic: "✂", nombre: `Sabotear ${EDIFICIOS[e].nombre}`, texto: `Deja sin uso ${EDIFICIOS[e].nombre} de ${ci.nombre} durante 3 turnos.`, razon: ya || (FM.enTregua(est) ? "Hay tregua." : null), acc: { id: "sabotear", x: ci.x, y: ci.y, edificio: e } })));
    }
    if ((u.clase === "arcanista" || u.clase === "archimago") && FM.sab(est, H).transmutar) {
      ["llanura", "bosque", "desierto"].forEach(t => {
        const alc = FM.ef(est, u).alc, cas = new Set();
        for (let y = u.y - alc; y <= u.y + alc; y++) for (let x = u.x - alc; x <= u.x + alc; x++) { const c = FM.casilla(est, x, y); if (c && !c.est && !FM.unidadEn(est, x, y) && (D.TERRENOS[c.t].mov > 0 || c.t === "agua") && c.t !== t) cas.add(`${x},${y}`); }
        out.push({ ic: "✦", nombre: `Volver ${D.TERRENOS[t].nombre.toLowerCase()}`, texto: "Cambia el terreno de una casilla cercana. También seca una casilla de agua.", coste: { mana: 3 }, razon: ya || (u.enfriar > 0 ? `Le faltan ${u.enfriar} turnos.` : jh.recursos.mana < 3 ? "Hacen falta 3 de maná." : null), casillas: cas, acc: { id: "alterar", a: t } });
      });
    }
    if (FM.sab(est, H).reanimar) est.tumbas.filter(t => cheb(t, u) <= 1 && !FM.unidadEn(est, t.x, t.y)).slice(0, 2).forEach(t =>
      out.push({ ic: "☥", nombre: `Reanimar a ${t.s ? t.s.nombre : "un caído"}`, texto: `Lo levanta a tu servicio con la mitad de la vida. Saldrá en la casilla marcada.`, coste: { anima: 3 }, razon: ya || (jh.recursos.anima < 3 ? "Hacen falta 3 de Ánima." : null), acc: { id: "reanimar", x: t.x, y: t.y }, marca: { x: t.x, y: t.y }, caido: t.s ? { s: t.s, faccion: t.dueno >= 0 ? est.jugadores[t.dueno].faccion : null, clase: t.clase } : null }));
    if (CLASES[u.clase].rompe) {
      const cas = new Set();
      for (let y = u.y - 1; y <= u.y + 1; y++) for (let x = u.x - 1; x <= u.x + 1; x++) { const c = FM.casilla(est, x, y); if (c && c.t === "bosque" && !c.est && !FM.unidadEn(est, x, y)) cas.add(`${x},${y}`); }
      if (cas.size) out.push({ ic: "⚒", nombre: "Derribar el bosque", texto: "Tira los árboles de una casilla de al lado y la deja en llanura. Gasta su turno.", razon: ya, casillas: cas, acc: { id: "talar" } });
    }
    if (fac.mods.campamento && fac.mods.campamento === u.clase) {
      const cas = new Set();
      for (let y = u.y - 1; y <= u.y + 1; y++) for (let x = u.x - 1; x <= u.x + 1; x++) if (!FM.razonCampamento(est, H, u, x, y)) cas.add(`${x},${y}`);
      const r0 = FM.razonCampamento(est, H, u);
      out.push({ ic: "⛺", nombre: "Levantar campamento", texto: `Monta un campamento en una casilla de al lado, lejos de enemigos y de ciudades enemigas. Dura ${FM.DURA_CAMPAMENTO} turnos: cura 3 a tus tropas que estén en él o a su lado y entrena una tropa básica por turno. Si un enemigo lo pisa, lo arrasa. Puedes tener ${FM.MAX_CAMPAMENTOS} a la vez.`,
        coste: FM.COSTE_CAMPAMENTO, razon: ya || r0 || (cas.size ? null : "No hay una casilla buena a su lado: libre, de tierra y lejos de enemigos."), casillas: cas, acc: { id: "campamento" } });
    }
    if (u.clase === "sanador" && fac.mods.consagra) out.push({ ic: "☀", nombre: "Consagrar", texto: "Consagra esta casilla y las de alrededor: tus tropas ganan +1 de defensa y se curan 1 más en ellas.", razon: ya || (FM.consagradaPara(est, H, u.x, u.y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => !FM.casilla(est, u.x + dx, u.y + dy) || FM.consagradaPara(est, H, u.x + dx, u.y + dy)) ? "Este terreno ya está consagrado." : null), acc: { id: "consagrar" } });
    // Tropas que se quedaron sin bandera al caer su ejército: se pueden acoger
    junto(u.x, u.y).filter(w => w.dueno === -1 && w.sinBandera && w !== u).slice(0, 2).forEach(w => {
      const precio = FM.costeAcoger(w), lleno = !FM.hayHueco(est, H);
      out.push({ ic: "⚑", nombre: `Acoger a ${FM.nombreUnidad(w)}`, texto: `Se quedó sin bandera cuando cayó ${FACCIONES[w.sinBandera] ? FACCIONES[w.sinBandera].corto : "su ejército"}. Si le pagas, lucha por ti desde ya.`, coste: { oro: precio },
        razon: ya || (lleno ? `Ya tienes el máximo de tropas (${FM.limiteTropas(est, H)}).` : jh.recursos.oro < precio ? "No te alcanza el oro." : null), acc: { id: "acoger", x: w.x, y: w.y } });
    });
    if (fac.mods.soborno && !u.heroe) junto(u.x, u.y).filter(w => w.dueno === -1 && !w.sinBandera).slice(0, 2).forEach(w => {
      const precio = FM.heroeVivo(est, H) && HEROES[FM.heroeVivo(est, H).heroe].ef.sobornoMitad ? Math.ceil(fac.mods.soborno / 2) : fac.mods.soborno;
      out.push({ ic: "¤", nombre: `Sobornar a ${FM.nombreUnidad(w)}`, texto: "La criatura lucha por ti 2 turnos.", coste: { oro: precio }, razon: ya || (jh.recursos.oro < precio ? "No te alcanza el oro." : null), acc: { id: "sobornar", x: w.x, y: w.y } });
    });
    // El portal de la ciudad: a otra ciudad propia con portal
    if (FM.ciudadPortalDe(est, u)) {
      const de = FM.ciudadPortalDe(est, u), cas = new Set();
      FM.ciudadesDe(est, H).forEach(c => { if (c !== de && !FM.razonNoPortal(est, H, u.uid, c.id)) cas.add(`${c.x},${c.y}`); });
      const co = FM.costePortal(u);
      out.push({ ic: "◎", nombre: `Cruzar ${D.nombreEdificio("portal", jh.faccion)}`, texto: "Lleva a esta tropa al instante a otra ciudad tuya con portal. Llega sin movimiento.", coste: co,
        razon: ya || (cas.size ? null : "No hay otra ciudad con portal libre."), casillas: cas, especial: "portal" });
    }
    if (u.heroe) {
      const h = HEROES[u.heroe];
      const tregua = FM.enTregua(est);
      [[h.ef.activa, 1, u.cd], [h.ef.activa2, 2, u.cd2]].forEach(([ab, n, cd]) => {
        if (!ab) return;
        const falta = cd > 50 ? "Solo se puede usar una vez por guerra." : cd > 0 ? `Le faltan ${cd} ${cd === 1 ? "turno" : "turnos"}.` : null;
        let razon = ya ? (falta ? `${ya} ${falta}` : ya) : falta || (ab.coste && !FM.puedePagar(jh, ab.coste) ? "No te alcanzan los recursos." : null);
        // La espera siempre a la vista: cuánto le falta, o cada cuánto se puede usar si ya está lista
        const espera = cd > 50 ? { t: "una vez", lista: false, titulo: "Ya la usó: solo se puede una vez por guerra." }
          : cd > 0 ? { t: `⟳ faltan ${cd}`, lista: false, titulo: `Se recarga: le faltan ${cd} ${cd === 1 ? "turno" : "turnos"}.` }
            : ab.cd ? { t: `⟳ cada ${ab.cd}`, lista: true, titulo: `Lista. Después de usarla tarda ${ab.cd} turnos en volver.` } : null;
        const base = { ic: "✪", nombre: ab.nombre, texto: ab.texto, coste: ab.coste, heroe: true, espera };
        const alc = ab.alc || 1, cas = new Set();
        // Los gigantes ocupan 2×2: se cuenta desde toda su huella, no solo desde su esquina
        const gt = u.tam === 2 ? 1 : 0;
        const recorre = (r, f) => { for (let y = u.y - r; y <= u.y + gt + r; y++) for (let x = u.x - r; x <= u.x + gt + r; x++) if (FM.dentro(est, x, y) && !FM.ocupa(u, x, y) && f(x, y)) cas.add(`${x},${y}`); };
        const enemigoVisto = (x, y) => { const w = FM.unidadEn(est, x, y); return w && FM.hostil(est, w.dueno, H) && FM.veUnidad(est, H, w) ? w : null; };
        const libre = (x, y) => { const c = FM.casilla(est, x, y); return c && !FM.unidadEn(est, x, y) && D.TERRENOS[c.t].mov > 0; };
        let pide = true;
        if (ab.id === "area") recorre(alc, (x, y) => junto(x, y).some(w => FM.hostil(est, w.dueno, H) && FM.veUnidad(est, H, w)));
        else if (ab.id === "muro") recorre(alc, (x, y) => (x !== u.x || y !== u.y) && libre(x, y) && !FM.casilla(est, x, y).est);
        else if (ab.id === "comprar" || ab.id === "contratar") recorre(alc, (x, y) => { const w = FM.unidadEn(est, x, y); return !!w && (w.dueno === -1 || (ab.id === "comprar" && FM.hostil(est, w.dueno, H) && !w.heroe && !w.lider && !FM.esBarco(w) && (!w.s || S.rangoIndice(w.s.victorias + (w.vicG || 0)) === 0))); });
        else if (ab.id === "sello") recorre(alc, (x, y) => { const c = FM.ciudadEn(est, x, y); return !!c && c.dueno === H; });
        else if (ab.id === "juicio" || ab.id === "desafio") recorre(alc, (x, y) => !!enemigoVisto(x, y));
        else if (ab.id === "engullir") recorre(1, (x, y) => { const w = enemigoVisto(x, y); return !!w && !w.heroe && !w.lider && w.hp * 3 <= FM.ef(est, w).hpMax; });
        else if (ab.id === "salto") recorre(alc, (x, y) => libre(x, y));
        else if (ab.id === "linea") recorre(1, (x, y) => x !== u.x || y !== u.y);
        else pide = false;
        if (!pide) { out.push(Object.assign(base, { razon, acc: { id: "heroe", n } })); return; }
        if (!razon && !cas.size && ab.id === "engullir" && FM.vecinosEnemigos(est, u).some(w => FM.veUnidad(est, H, w) && !w.heroe && !w.lider)) razon = "Los enemigos a su lado aún tienen más de un tercio de su vida.";
        if (!razon && !cas.size) razon = ab.id === "muro" || ab.id === "salto" ? "No hay sitio." : "No hay a quién a su alcance.";
        if (!razon && (ab.id === "area" || ab.id === "juicio" || ab.id === "linea") && tregua) razon = "Hay tregua.";
        out.push(Object.assign(base, { razon, casillas: cas, acc: { id: "heroe", n } }));
      });
    }
    // Órdenes que la tropa cumple sola cada turno
    if (!u.lider) {
      const ordenBtn = (tipo, extra) => Object.assign({ ic: ORD[tipo].ic, nombre: ORD[tipo].nombre, texto: ORD[tipo].texto, orden: { tipo }, ordenBtn: true, activa: u.orden && u.orden.tipo === tipo }, extra || {});
      const libre = (pista) => ({ casillas: new Set(), libre: true, pista });
      out.push(ordenBtn("explorar", libre("Toca en el mapa adónde ir a explorar. Si tocas la propia tropa, explora por su cuenta.")));
      out.push(ordenBtn("defender", libre("Toca una tropa tuya para escoltarla o una casilla para guardarla. Si tocas la propia tropa, defiende donde está.")));
      const metas = new Set();
      Object.values(est.ciudades).forEach(c => { if (c.dueno !== H && (c.dueno === null || FM.hostil(est, c.dueno, H)) && est.vision[H][c.y * est.ancho + c.x] > 0) metas.add(`${c.x},${c.y}`); });
      out.push(ordenBtn("conquistar", { casillas: metas, razon: metas.size ? null : "No conoces ninguna ciudad que tomar." }));
      out.push(ordenBtn("matanza", libre("Toca en el mapa adónde ir: atacará todo lo que encuentre por el camino. Si tocas la propia tropa, busca enemigos por su cuenta.")));
      out.push(ordenBtn("curarse", { razon: FM.ciudadesDe(est, H).length ? null : "No tienes ciudades." }));
      if (u.orden) out.push({ ic: "○", nombre: "Quitar la orden", texto: "La tropa vuelve a esperar tus órdenes.", orden: null, ordenBtn: true });
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
    if (u.trofeos) out.push([`Trofeos de caza: +${Math.min(5, u.trofeos)} de vida`, "oro"]);
    if (u.clase === "berserker") { const m = FM.minoriaBerserker(est, u); if (m) out.push([`En minoría: +${m} ataque, +${m} defensa`, "rojo"]); }
    if (u.orden && ORD[u.orden.tipo]) {
      const o = u.orden, w = o.uid && est.unidades[o.uid], ci = o.ciudad && est.ciudades[o.ciudad];
      const destino = w ? ` · escolta a ${FM.nombreUnidad(w)}` : ci ? ` · ${ci.nombre}` : o.x !== undefined && o.tipo !== "defender" && o.tipo !== "reforzar" ? " · hacia el punto marcado" : "";
      out.push([`Orden: ${ORD[o.tipo].nombre}${destino}`, "oro"]);
    }
    if (u.efectos && u.efectos.oculto >= est.turno) out.push(["Oculta", ""]);
    if (u.efectos && u.efectos.miasma && u.efectos.miasma.hasta >= est.turno) out.push([`−${u.efectos.miasma.n} de ataque`, "rojo"]);
    if (u.efectos && u.efectos.traba >= est.turno) out.push(["Trabada", "rojo"]);
    if (FM.desafioDe(est, u)) out.push(["En un desafío", "oro"]);
    if (u.reanimado || u.invocado) out.push(["No ocupa límite", ""]);
    if (u.s && u.s.luto) out.push([`De luto por ${u.s.luto.nombre}`, ""]);
    return out;
  }

  let accionesActuales = [];
  let marcaHover = null;   // casilla que se resalta al pasar el ratón por una acción (por ejemplo, dónde saldrá un reanimado)
  function pintarSeleccion() {
    const c = $("frSeleccion"), H = humano();
    const u = sel.uid && est.unidades[sel.uid];
    accionesActuales = [];
    if (grupo && !u) { tarjetaGrupo(c); return; }
    if (u) {
      const e = FM.ef(est, u), tr = tropaDe(u), jug = u.dueno >= 0 ? est.jugadores[u.dueno] : null, mia = u.dueno === H;
      const b = u.dueno >= 0 ? bandos[u.dueno] : { col: "#8c8c8c", forma: "·" };
      const q = { faccion: jug ? jug.faccion : null, clase: u.clase, heroe: u.heroe || null, dueno: u.dueno };
      const conRetrato = FR && (u.s || u.heroe || u.lider);
      const retrato = conRetrato ? `<canvas class="fr-sel-ret" data-ret="1"></canvas>` : figHtml(q, 84, 104, "fr-sel-fig");
      const rangoTxt = u.s ? `${S.rangoDe(u.s.victorias + (u.vicG || 0)).nombre}${u.s.spec ? ` · ${ESPECIALIZACIONES[u.s.spec].nombre}` : ""}${u.s.capitan ? " · Capitán" : ""}` : u.lider ? "Líder" : u.heroe ? `Héroe · nivel ${HEROES[u.heroe].nivel}` : "";
      const estados = estadosDeUnidad(u);
      if (mia && soyYo()) accionesActuales = accionesDeUnidad(u);
      const verFicha = u.s && ej && ej.soldados[u.s.id] ? `<button type="button" class="fr-enlace" data-ver-ficha="${u.s.id}">Ver su ficha</button>` : "";
      c.innerHTML = `<div class="fr-sel fr-sel-unidad" style="--c:${b.col}">
        <div class="fr-sel-lado">${retrato}<span class="fr-sel-bando"><i>${b.forma || ""}</i>${jug ? esc(FACCIONES[jug.faccion].corto) : "Sin dueño"}</span></div>
        <div class="fr-sel-cuerpo">
          <div class="fr-sel-cab"><h3 style="color:${colorDe(u.dueno)}">${esc(FM.nombreUnidad(u))}</h3><p>${esc(tr.nombre)}${rangoTxt ? ` · ${esc(rangoTxt)}` : ""}${u.s ? ` · ${u.s.victorias + (u.vicG || 0)} victorias` : ""} ${verFicha}</p></div>
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
        ${accionesActuales.length ? `<div class="fr-sel-acciones">${accionesActuales.map((a, i) => `<button type="button" class="fr-accion${a.razon ? " no" : ""}${(modo && modo.i === i) || a.activa ? " activa" : ""}${a.ordenBtn ? " fr-accion-orden" : ""}" data-accion="${i}" title="${esc(a.texto)}${a.razon ? ` — ${esc(a.razon)}` : ""}"><i>${a.ic}</i><span>${esc(a.nombre)}${a.espera ? ` <em class="fr-cd${a.espera.lista ? " lista" : ""}" title="${esc(a.espera.titulo)}">${esc(a.espera.t)}</em>` : ""}</span>${a.coste ? costeHtml(a.coste, est.jugadores[H]) : ""}${a.razon ? `<small>${esc(a.razon)}</small>` : ""}</button>${a.caido ? `<button type="button" class="fr-enlace fr-ver-caido" data-ver-caido="${i}">Ver a ${esc(a.caido.s.nombre)}</button>` : ""}`).join("")}</div>` : ""}
        <button type="button" class="fr-sel-x" data-soltar aria-label="Soltar la selección">×</button>
      </div>`;
      const ret = c.querySelector("[data-ret]");
      if (ret && u.s) FR.animar(ret, u.s, { faccion: jug ? jug.faccion : ej.faccion, anio: ej ? ej.anio : 1, herido: u.hp <= e.hpMax * 0.45, w: 84 });
      else if (ret) FR.retrato(ret, { faccion: jug ? jug.faccion : ej.faccion, heroe: u.heroe || null }, { anim: true, w: 84, herido: u.hp <= e.hpMax * 0.45 });
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

  /* Un campamento (Okran): de quién es, cuánto le queda y, si es tuyo y es tu turno, qué puede entrenar */
  function tarjetaCampamento(x, y) {
    const cp = FM.campamentoEn(est, x, y);
    if (!cp) return "";
    const H = humano(), mio = cp.dueno === H, jug = est.jugadores[H], quedan = cp.hasta - est.turno + 1;
    const botones = mio && soyYo() ? FM.CLASES_CAMPAMENTO.filter(cl => FM.clasesDisponibles(est, H).includes(cl)).map(cl => {
      const razon = FM.razonReclutarCampamento(est, H, cp.id, cl), tr = D.tropa(jug.faccion, cl);
      return `<button type="button" class="fr-accion${razon ? " no" : ""}" data-recluta-camp="${cl}" data-camp="${cp.id}" title="${esc(tr.texto)}${razon ? ` — ${esc(razon)}` : ""}"><i>⚔</i><span>Entrenar ${esc(tr.nombre)}</span>${costeHtml(FM.costeReclutar(est, H, cl, null), jug)}${razon ? `<small>${esc(razon)}</small>` : ""}</button>`;
    }).join("") : "";
    return `<p class="fr-sel-texto"><strong>⛺ Campamento${mio ? " tuyo" : ` de ${esc(FACCIONES[est.jugadores[cp.dueno].faccion].corto)}`}.</strong> ${quedan <= 1 ? "Se desmonta al acabar este turno" : `Quedan ${quedan} turnos`}. Cura 3 a sus tropas en él o a su lado.${mio ? " Entrena una tropa básica por turno." : " Si una tropa tuya lo pisa, lo arrasa."}</p>${botones ? `<div class="fr-sel-acciones">${botones}</div>` : ""}`;
  }
  function pintarCasilla(c, x, y) {
    const ca = FM.casilla(est, x, y), t = D.TERRENOS[ca.t], rg = est.regiones[ca.region], H = humano();
    const dueno = rg && rg.dueno !== null ? est.jugadores[rg.dueno] : null;
    const rinde = Object.keys(t.rinde).map(k => `<b>${ico(k)}${String(t.rinde[k]).replace(".", ",")}</b>`).join("") || "<em>nada</em>";
    const que = ca.est ? { costura: "Une este fragmento con otro (el otro extremo va marcado en el mapa). Pisarla cuesta 1 de movimiento y te lleva allí. Si hay una tropa en un extremo, el enemigo no puede usarla.", nucleo: `Quien tenga aquí una tropa ${est.hold} turnos seguidos gana la guerra.`, ruinas: ca.saqueada ? "Ya se registraron." : "Quien las pise se lleva lo que guardan. Puede haber una reliquia.", fortaleza: "Se toma entrando en ella. Da defensa, vista y cuenta para dominar la provincia.", ciudad: "" }[ca.est] : "";
    c.innerHTML = `<div class="fr-sel fr-sel-casilla" style="--c:${dueno ? bandos[rg.dueno].col : "#8f8498"}">
      <div class="fr-sel-cuerpo">
        <div class="fr-sel-cab"><h3>${esc(t.nombre)}${ca.est ? ` · ${esc(D.ESTRUCTURAS[ca.est].nombre)}` : ""}</h3><p>${rg ? `${esc(rg.nombre)} · ${dueno ? (rg.dueno === H ? "provincia tuya" : `provincia de ${esc(FACCIONES[dueno.faccion].corto)}`) : "provincia sin dueño"} · estabilidad ${rg.estab}` : ""}</p></div>
        <div class="fr-stats"><span title="Lo que cuesta entrar">${ico("mov")}<b>${t.mov || "—"}</b></span><span title="Defensa que da a quien la ocupa">${ico("defensa")}<b>+${t.def + (ca.est ? D.ESTRUCTURAS[ca.est].def : 0)}</b></span><span title="Lo que rinde a una ciudad cercana" class="fr-coste">${rinde}</span>${FM.consagradaPara(est, H, x, y) ? `<span class="fr-stat-estado listo">Consagrada</span>` : ""}</div>
        ${que ? `<p class="fr-sel-texto">${esc(que)}</p>` : ""}${ca.est === "costura" && est.costuras[ca.costura] ? `<button type="button" class="fr-btn fr-btn-chico" data-ir-portal>Ir al otro extremo</button>` : ""}${ca.t === "agua" ? `<p class="fr-sel-texto">Agua navegable. Los barcos se mueven por ella. ${FM.puedeEmbarcar(est, H) ? "Tus tropas pueden embarcar: entrar les gasta el movimiento, y embarcadas no atacan ni tienen defensa." : "Tus tropas no pueden embarcar todavía: hace falta un Muelle en alguna de tus ciudades."}</p>` : !t.mov ? `<p class="fr-sel-texto">No se puede pisar.</p>` : ""}${ca.vado ? `<p class="fr-sel-texto">Un vado: por aquí se cruza el río a pie.</p>` : ""}
        ${tarjetaCampamento(x, y)}
        ${ca.objetos && ca.objetos.length ? `<p class="fr-sel-texto"><strong>En el suelo:</strong> ${ca.objetos.map(id => esc((est.reliquias[id] || {}).nombre || "algo")).join(", ")}</p>` : ""}
      </div><button type="button" class="fr-sel-x" data-soltar aria-label="Soltar la selección">×</button></div>`;
  }

  /* Una ciudad: lo que rinde, sus edificios en huecos, las tropas que entrena y el héroe del ejército */
  const RAMA = { eco: "Economía", mil: "Guerra", mag: "Magia" };
  function pintarCiudad(c, ci) {
    const H = humano(), mia = ci.dueno === H, jug = est.jugadores[H];
    const dueno = ci.dueno !== null ? est.jugadores[ci.dueno] : null, rg = est.regiones[ci.region];
    const cab = `<div class="fr-sel-cab"><h3>${ci.capital ? "★ " : ""}${esc(ci.nombre)}</h3><p>${esc(D.nivelCiudad(dueno ? dueno.faccion : null, ci.nivel))} (nivel ${ci.nivel}) · ${dueno ? (mia ? "tuya" : `de ${esc(FACCIONES[dueno.faccion].corto)}`) : "sin dueño"}${rg ? ` · ${esc(rg.nombre)}` : ""}</p>${ci.asedio ? `<p class="fr-sel-texto fr-asedio">Sitiada por ${esc(est.jugadores[ci.asedio.por].nombre)}. Si la tropa sigue dentro al empezar su turno, la ciudad cae.</p>` : ""}${ci.mercado ? `<p class="fr-sel-texto fr-sel-nota">Da 2 de oro por turno a quien lo tenga. Nikaalia lo necesita para llamar a su Don.</p>` : ""}</div>`;
    const edificios = ci.edificios.map(e => `<span class="fr-hueco lleno${ci.desh[e] >= est.turno ? " roto" : ""}" title="${esc(D.textoEdificio(e, dueno ? dueno.faccion : jug.faccion))}${ci.desh[e] >= est.turno ? " (inutilizado por ahora)" : ""}"><i class="r-${EDIFICIOS[e].rama}"></i>${esc(EDIFICIOS[e].nombre)}</span>`).join("");
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
    }).sort((a, b) => a.orden - b.orden).map(({ e, ed, razon }) => { const tx = D.textoEdificio(e, jug.faccion); return `<button type="button" class="fr-obra${razon ? " no" : ""}" data-construye="${e}" data-razon="${esc(razon || "")}" title="${esc(tx)}${razon ? ` — ${esc(razon)}` : ""}"><i class="r-${ed.rama}" title="${RAMA[ed.rama]}"></i><strong>${esc(ed.nombre)}</strong>${costeHtml(FM.costeEdificio(est, H, e), jug)}<small>${esc(razon || tx)}</small></button>`; }).join("");
    // el héroe del ejército
    let heroe = "";
    if (jug.heroeInvocado) { const hv = FM.heroeVivo(est, H); heroe = `<p class="fr-sel-texto">${hv ? `${esc(hv.nombre)} está en el campo.` : "Tu héroe ya cayó en esta guerra."}</p>`; }
    else heroe = jug.heroes.map(hf => {
      const h = HEROES[hf.id], rq = FM.requisitosHeroe(est, H, hf.id, ci.id);
      return `<div class="fr-heroe${rq.ok ? " listo" : ""}">${retLider(jug.faccion, 64, "fr-heroe-ret", hf.id)}
        <div><strong>${esc(hf.nombre)}</strong><small>${esc(h.titulo)}</small>
          <span class="fr-recluta-cifras">${ico("vida")}${h.hp} ${ico("ataque")}${h.atq} ${ico("defensa")}${h.def} ${ico("mov")}${h.mov}${h.alc > 1 ? ` ${ico("alcance")}${h.alc}` : ""}</span>
          <p>${esc(h.texto)}</p>${habilidadesHtml(h)}
          <ul class="fr-requisitos">${rq.lista.map(r => `<li class="${r.ok ? "ok" : "no"}">${r.ok ? "✔" : "✖"} ${esc(r.texto)}${r.de && !r.ok ? ` <b>${r.lleva}/${r.de}</b>` : ""}</li>`).join("")}</ul>
          <button type="button" class="fr-btn fr-btn-chico${rq.ok ? " fr-btn-principal" : ""}" data-invoca="${hf.id}" data-razon="${esc(rq.ok ? "" : rq.razon)}">Invocar${rq.ok ? "" : " (falta algo)"}</button></div></div>`;
    }).join("");
    const costeCrecer = { materiales: 4 * ci.nivel, oro: 3 * ci.nivel };
    // Una sección a la vez, con pestañas: nada de columnas con su propio scroll
    const listoHeroe = !jug.heroeInvocado && jug.heroes.some(hf => FM.requisitosHeroe(est, H, hf.id, ci.id).ok);
    const TABS = [["entrenar", "Entrenar", ci.reclutado ? "hecho" : ""], ["edificios", "Edificios", `${enHuecos}/${ci.nivel + 2}`], ["obras", "Obras y mando", ""], ["heroe", "Héroe", listoHeroe ? "¡listo!" : ""], ["flota", "Flota", ""]];
    if (!TABS.some(t => t[0] === pestanaCiudad)) pestanaCiudad = "entrenar";
    const cuerpo = {
      entrenar: `${ci.reclutado ? `<p class="fr-sel-texto fr-sel-nota">Esta ciudad ya entrenó este turno.</p>` : ""}<div class="fr-reclutas">${reclutas}</div>`,
      edificios: `${notaDesh(ci)}<div class="fr-huecos">${edificios}${vacios}</div><div class="fr-obras fr-obras-lista">${obras}</div>`,
      obras: panelObras(ci, jug),
      heroe: heroe,
      flota: `<p class="fr-sel-texto fr-sel-nota">${esc(nvC.nivel ? `Marina: ${nvC.nivel.toLowerCase()}. ` : "")}${esc(notaMar)}</p>${barcos ? `<div class="fr-reclutas">${barcos}</div>` : ""}`
    }[pestanaCiudad];
    c.innerHTML = `<div class="fr-sel fr-sel-ciudad mia" style="--c:${bandos[H].col}">
      <div class="fr-sel-cuerpo">
        <div class="fr-ciudad-cab">${cab}${ci.nivel < 5 ? `<button type="button" class="fr-btn fr-btn-chico fr-crecer" data-mejora="${ci.id}"${FM.puedePagar(jug, costeCrecer) ? "" : " disabled"} title="${esc(`Pasa a ${D.nivelCiudad(jug.faccion, ci.nivel + 1)}: un hueco más, más oro y ${(FACCIONES[jug.faccion].poblacion.porNivel[ci.nivel] || 0)} tropas más de límite`)}">Crecer ${costeHtml(costeCrecer, jug)}</button>` : ""}</div>
        <nav class="fr-ciudad-tabs" role="tablist">${TABS.map(([id, t, extra]) => `<button type="button" role="tab" class="${id === pestanaCiudad ? "activa" : ""}" data-ctab="${id}" aria-selected="${id === pestanaCiudad}">${esc(t)}${extra ? ` <small>${esc(extra)}</small>` : ""}</button>`).join("")}</nav>
        <div class="fr-ciudad-sec" data-sec="${pestanaCiudad}">${cuerpo}</div>
      </div><button type="button" class="fr-sel-x" data-soltar aria-label="Soltar la selección">×</button></div>`;
    pintarFiguras(c);
  }

  let pestanaCiudad = "entrenar";
  $("frSeleccion").addEventListener("click", ev => {
    const b = ev.target.closest("[data-ctab]");
    if (!b) return;
    pestanaCiudad = b.dataset.ctab; son("clic"); pintarSeleccion();
  });
  // Pasar el ratón por una acción con casilla (reanimar) la marca en el mapa
  $("frSeleccion").addEventListener("mouseover", ev => {
    const b = ev.target.closest("[data-accion]"), a = b ? accionesActuales[+b.dataset.accion] : null;
    const m = a && a.marca ? a.marca : null;
    if ((m && marcaHover && m.x === marcaHover.x && m.y === marcaHover.y) || (!m && !marcaHover)) return;
    marcaHover = m;
    if (est) pintarResaltes();
  });
  $("frSeleccion").addEventListener("mouseleave", () => { if (marcaHover) { marcaHover = null; if (est) pintarResaltes(); } });

  /* Ficha de un caído que no es de tu ejército (o que ya no está en él): retrato, rango y características */
  /* Obras de ciudad, Transmutación y punto de reunión */
  function panelObras(ci, jug) {
    const ob = Object.keys(D.OBRAS).map(id => {
      const o = D.OBRAS[id], activa = id === "levas" ? ci.levasT === est.turno : ci.obras && ci.obras[id] >= est.turno;
      const razon = activa ? "Ya está en marcha." : !FM.puedePagar(jug, o.coste) ? "No te alcanzan los recursos." : "";
      return `<button type="button" class="fr-obra${razon ? " no" : ""}${activa ? " activa" : ""}" data-obra="${id}" data-razon="${esc(razon)}" title="${esc(o.texto)}"><strong>${esc(o.nombre)}</strong>${activa ? `<small>${id === "levas" ? "este turno" : `hasta el turno ${ci.obras[id]}`}</small>` : costeHtml(o.coste, jug)}<small>${esc(o.texto)}</small></button>`;
    }).join("");
    let tr = "";
    if (ci.edificios.includes("transmutacion")) {
      const usado = ci.transT === est.turno ? ci.transN || 0 : 0, queda = 6 - usado;
      const opc = (sel, sinAnima) => D.RECURSOS.filter(k => !(sinAnima && k === "anima")).map(k => `<option value="${k}"${k === sel ? " selected" : ""}>${esc(D.RECURSO_NOMBRE[k])}</option>`).join("");
      tr = `<div class="fr-transmuta"><b>${esc(D.nombreEdificio("transmutacion", jug.faccion))}</b> <small>${queda} más este turno · ${FACCIONES[jug.faccion].mods.transmutaBien ? "1 por 1" : "3 por 2"}</small>
        <div class="fr-fila"><select data-tr-de aria-label="Lo que das">${opc("materiales")}</select><select data-tr-n aria-label="Cuánto">${[3, 6].filter(n => n <= queda).map(n => `<option value="${n}">${n}</option>`).join("") || `<option value="0">0</option>`}</select>
        <span>→</span><select data-tr-a aria-label="Lo que recibes">${opc("oro", true)}</select><button type="button" class="fr-btn fr-btn-chico" data-transmutar${queda < 3 ? " disabled" : ""}>Cambiar</button></div></div>`;
    }
    const q = ci.reunion;
    const reu = `<div class="fr-reunion"><b>Punto de reunión</b> <small>${q ? "Lo que entrene aquí irá solo a la casilla marcada." : "Sin marcar: lo que entrene se queda en la ciudad."}</small>
      <div class="fr-fila"><button type="button" class="fr-btn fr-btn-chico" data-reunion>${q ? "Cambiarlo" : "Marcarlo en el mapa"}</button>${q ? `<button type="button" class="fr-btn fr-btn-chico" data-reunion-quitar>Quitarlo</button>` : ""}</div></div>`;
    return `<div class="fr-obras">${ob}</div>${tr}${reu}`;
  }
  /* Por qué hay edificios tachados en una ciudad y hasta cuándo */
  function notaDesh(ci) {
    const rotos = ci.edificios.filter(e => ci.desh[e] >= est.turno);
    if (!rotos.length) return "";
    const hasta = Math.max(...rotos.map(e => ci.desh[e])) + 1, quedan = hasta - est.turno;
    const por = ci.tomada >= est.turno ? "La ciudad se acaba de tomar y sus edificios están destrozados" : ci.saboteo >= est.turno ? "Un pícaro enemigo saboteó la ciudad" : "Hay edificios inutilizados";
    return `<p class="fr-sel-texto fr-sel-nota fr-desh-nota">${por}. Los tachados no funcionan hasta el turno ${hasta} (${quedan === 1 ? "el siguiente" : `dentro de ${quedan}`}).</p>`;
  }
  function abrirFichaCaido(c) {
    const s = c.s, fac = c.faccion ? FACCIONES[c.faccion] : null, tr = c.faccion ? D.tropa(c.faccion, c.clase || s.clase) : { nombre: CLASES[s.clase] ? CLASES[s.clase].nombre : s.clase };
    $("frFichaCuerpo").innerHTML = `<div class="fr-ficha-cab"><div class="fr-ficha-ret"><canvas class="fr-ret" data-caido="1" data-w="170"></canvas></div>
      <div><h2 class="fr-h2">${esc(S.nombreConApodo ? S.nombreConApodo(s) : s.nombre)}</h2>
        <p class="fr-sub">${esc(tr.nombre)}${fac ? ` · ${esc(fac.corto)}` : ""} · ${esc(S.rangoDe(s.victorias || 0).nombre)} · ${s.victorias || 0} victorias</p>
        ${s.muerte ? `<p class="fr-epitafio">Cayó en ${esc(s.muerte.lugar || "la Fractura")}${s.muerte.causa ? ` ante ${esc(s.muerte.causa)}` : ""}.</p>` : ""}
        ${maniasHtml(s)}</div></div>
      ${s.stats ? `<h3 class="fr-h3">Características</h3><div class="fr-stats-ficha">${["FUE", "CON", "VEL", "INT", "VOL", "MAG"].map(barraStat(s)).join("")}</div>` : ""}`;
    const cv = $("frFichaCuerpo").querySelector("[data-caido]");
    if (cv && FR) FR.dibujar(cv, s, { faccion: c.faccion || (ej && ej.faccion), w: 170 });
    if (!$("frFicha").open) $("frFicha").showModal();
  }

  $("frSeleccion").addEventListener("click", async ev => {
    const t = ev.target, H = humano();
    if (t.closest("[data-soltar]")) { sel = { uid: null, ciudad: null }; modo = null; grupo = null; grupoPendiente = null; son("soltar"); refrescar(); return; }
    if (t.closest("[data-ir-portal]") && sel.casilla) {
      const ca = FM.casilla(est, sel.casilla.x, sel.casilla.y), par = ca && est.costuras[ca.costura];
      if (par) { const o = par.a.x === sel.casilla.x && par.a.y === sel.casilla.y ? par.b : par.a; sel = { uid: null, ciudad: null, casilla: { x: o.x, y: o.y } }; tablero.irA(o.x, o.y); son("clic"); refrescar(); }
      return;
    }
    const go = t.closest("[data-grupo-orden]");
    if (go && grupo) {
      const tipo = go.dataset.grupoOrden, us = grupo.map(id => est.unidades[id]).filter(Boolean);
      const PISTA_GRUPO = { conquistar: "Toca en el mapa la ciudad que deben tomar.", explorar: "Toca en el mapa adónde ir a explorar. Si tocas una tropa del grupo, cada una explora por su cuenta.",
        defender: "Toca una tropa tuya para escoltarla o una casilla para guardarla. Si tocas una tropa del grupo, cada una defiende donde está.", matanza: "Toca en el mapa adónde ir atacando todo lo del camino. Si tocas una tropa del grupo, cada una busca enemigos por su cuenta." };
      if (PISTA_GRUPO[tipo]) { grupoPendiente = grupoPendiente === tipo ? null : tipo; aviso(grupoPendiente ? PISTA_GRUPO[tipo] : "Orden cancelada."); son("clic"); refrescar(); return; }
      us.forEach(u => { if (tipo === "quitar") delete u.orden; else u.orden = { tipo }; });
      aviso(tipo === "quitar" ? "Sin órdenes." : `${us.length} tropas: ${ORD[tipo].nombre.toLowerCase()}.`); son("clic"); refrescar(); return;
    }
    const rcm = t.closest("[data-recluta-camp]");
    if (rcm) {
      const r = aplicarYo({ t: "reclutar", campamento: Number(rcm.dataset.camp), clase: rcm.dataset.reclutaCamp });
      if (!r.ok) { aviso(r.error, true); son("error"); } else son("recluta");
      despuesDeAccion(); return;
    }
    const vc = t.closest("[data-ver-caido]");
    if (vc) { const a = accionesActuales[+vc.dataset.verCaido]; if (a && a.caido) abrirFichaCaido(a.caido); return; }
    const un = t.closest("[data-uid]");
    if (un) { const u = est.unidades[un.dataset.uid]; if (u) { sel = { uid: u.uid, ciudad: null }; modo = null; tablero.irA(u.x, u.y); son("elegir"); refrescar(); } return; }
    const vf = t.closest("[data-ver-ficha]");
    if (vf) { abrirFicha(vf.dataset.verFicha, true); return; }
    const ac = t.closest("[data-accion]");
    if (ac) {
      const i = +ac.dataset.accion, a = accionesActuales[i], u = sel.uid && est.unidades[sel.uid];
      if (!a || !u) return;
      if (a.razon) { aviso(a.razon, true); son("error"); return; }
      if (a.ordenBtn && !a.casillas) { ponerOrden(u, a.orden ? Object.assign({}, a.orden) : null); refrescar(); return; }
      if (a.casillas) {
        modo = modo && modo.i === i ? null : { i, acc: a.acc, casillas: a.casillas, orden: a.ordenBtn ? a.orden : undefined, especial: a.especial, libre: !!a.libre };
        if (modo && a.pista) aviso(a.pista);
        son("clic"); refrescar(); return;
      }
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
    if (rec && sel.ciudad && CLASES[rec.dataset.recluta].naval) {
      // Un barco: si hay más de un sitio en el agua, el jugador elige dónde sale
      const opciones = FM.aguasLibres(est, est.ciudades[sel.ciudad]);
      if (opciones.length > 1 && !FM.razonNoReclutar(est, H, sel.ciudad, rec.dataset.recluta)) {
        botar = { ciudad: sel.ciudad, clase: rec.dataset.recluta, casillas: new Set(opciones.map(q => `${q.x},${q.y}`)) };
        aviso("Elige en el mapa dónde sale el barco."); son("clic"); refrescar(); return;
      }
      r = aplicarYo({ t: "reclutar", ciudad: sel.ciudad, clase: rec.dataset.recluta }); if (r.ok) son("recluta");
    }
    else if (rec && sel.ciudad) {
      r = aplicarYo({ t: "reclutar", ciudad: sel.ciudad, clase: rec.dataset.recluta });
      if (r.ok) { son("recluta"); const q = est.ciudades[sel.ciudad].reunion, nu = r.uid && est.unidades[r.uid]; if (q && nu) nu.orden = { tipo: "reforzar", x: q.x, y: q.y }; }
    }
    else if (con && sel.ciudad) { r = aplicarYo({ t: "construir", ciudad: sel.ciudad, edificio: con.dataset.construye }); if (r.ok) son("obra"); }
    else if (mej) { r = aplicarYo({ t: "mejorar", ciudad: mej.dataset.mejora }); if (r.ok) son("obra"); }
    else if (inv && sel.ciudad) r = aplicarYo({ t: "invocar", ciudad: sel.ciudad, heroe: inv.dataset.invoca });
    else if (t.closest("[data-obra]") && sel.ciudad) { r = aplicarYo({ t: "obra", ciudad: sel.ciudad, id: t.closest("[data-obra]").dataset.obra }); if (r.ok) son("obra"); }
    else if (t.closest("[data-transmutar]") && sel.ciudad) {
      const caja = t.closest(".fr-transmuta");
      r = aplicarYo({ t: "transmutar", ciudad: sel.ciudad, de: caja.querySelector("[data-tr-de]").value, a: caja.querySelector("[data-tr-a]").value, n: +caja.querySelector("[data-tr-n]").value });
      if (r.ok) son("obra");
    }
    else if (t.closest("[data-reunion]") && sel.ciudad) { marcarReunion = sel.ciudad; aviso("Toca en el mapa la casilla adonde irá lo que entrene esta ciudad."); son("clic"); return; }
    else if (t.closest("[data-reunion-quitar]") && sel.ciudad) { delete est.ciudades[sel.ciudad].reunion; son("clic"); refrescar(); return; }
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
  /* El saber del ejército: cuatro ramas de seis escalones (una pestaña cada una) y los saberes que piden dos ramas */
  let ramaSaber = null;
  const ROMANO = ["I", "II", "III", "IV", "V", "VI"];
  function panelSaber(c) {
    const H = humano(), jug = est.jugadores[H], f = jug.faccion, SB = window.FracturaSaber;
    const ramas = SB.ramas(f);
    if (!ramas.some(r => r.id === ramaSaber)) ramaSaber = ramas[0].id;
    const nivelDe = id => jug.tech[id] || 0;
    const puede = id => soyYo() && !FM.razonNoInvestigar(est, H, id);
    const r = SB.rama(f, ramaSaber), lleva = nivelDe(r.id);
    const tabs = ramas.map(q => `<button type="button" class="fr-saber-tab${q.id === ramaSaber ? " sel" : ""}${puede(q.id) ? " aviso" : ""}" data-rama-saber="${q.id}" style="--k:${q.color}">
        <strong>${esc(q.nombre)}</strong><span class="fr-saber-barra"><i style="width:${(nivelDe(q.id) / 6) * 100}%"></i></span><small>${nivelDe(q.id)} de 6</small></button>`).join("");
    const nodos = r.escalones.map((e, i) => {
      const hecho = lleva > i, sig = lleva === i;
      const razon = sig ? FM.razonNoInvestigar(est, H, r.id) || (!soyYo() ? "No es tu turno." : "") : "";
      const coste = SB.costeDe(f, r.id, i);
      const ya = {}; for (let k = 0; k < i; k++) SB.juntar(ya, r.escalones[k].ef);
      const txt = SB.describir(f, e.ef, ya);
      return `<button type="button" class="fr-nodo${hecho ? " hecho" : sig ? (razon ? " sig no" : " sig") : " lejos"}" ${sig ? `data-investiga="${r.id}" data-razon="${esc(razon)}"` : "disabled"}>
        <b>${ROMANO[i]}</b><strong>${esc(e.nombre)}</strong><small>${esc(txt)}</small>${hecho ? "<em>Dominado</em>" : costeHtml(sig ? FM.costeInvestigar(est, H, r.id) : coste, sig ? jug : null)}</button>`;
    }).join('<i class="fr-nodo-une"></i>');
    const cruces = SB.cruces(f).map(x => {
      const hecho = nivelDe(x.id) > 0, falta = SB.faltaCruce(f, jug.tech, x.id);
      const razon = hecho ? "" : FM.razonNoInvestigar(est, H, x.id) || (!soyYo() ? "No es tu turno." : "");
      const pide = Object.keys(x.pide).map(k => { const q = SB.rama(f, k); return `<i class="${nivelDe(k) >= x.pide[k] ? "ok" : ""}" style="--k:${q.color}">${esc(q.nombre)} ${ROMANO[x.pide[k] - 1]}</i>`; }).join("");
      return `<button type="button" class="fr-nodo fr-cruce${hecho ? " hecho" : falta ? " lejos" : razon ? " sig no" : " sig"}" ${!hecho && !falta ? `data-investiga="${x.id}" data-razon="${esc(razon)}"` : "disabled"}>
        <span class="fr-cruce-pide">${pide}</span><strong>${esc(x.nombre)}</strong><small>${esc(SB.describir(f, x.ef, SB.efectos(f, Object.assign({}, jug.tech, { [x.id]: 0 }))))}</small>${hecho ? "<em>Dominado</em>" : costeHtml(FM.costeInvestigar(est, H, x.id), falta ? null : jug)}</button>`;
    }).join("");
    c.innerHTML = `<div class="fr-saber-tabs">${tabs}</div>
      <div class="fr-rama" style="--k:${r.color}">${nodos}</div>
      <h4 class="fr-h4">Especiales</h4><div class="fr-cruces">${cruces}</div>`;
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
  // Lo que en la crónica va resaltado, con el mismo color que el aviso que salió al empezar el turno
  const DESTACA_LOG = { conquista: "conq", nucleo: "cian", lider: "baja", heroico: "oro", reliquia: "oro", heroe: "oro", pacto: "cian", fin: "oro" };
  function panelRegistro(c) {
    const FILTRO = { todo: null, combate: ["combate", "muerte", "lider", "heroico"], conquistas: ["conquista", "nucleo", "heroe", "fin", "pacto"], gestion: ["recluta", "obra", "tecnologia", "botin", "reliquia", "magia"] };
    const tipos = FILTRO[filtroLog];
    const lineas = est.log.filter(l => !tipos || tipos.includes(l.tipo)).slice(-80).reverse();
    let turno = null;
    c.innerHTML = `<div class="fr-filtros">${Object.keys(FILTRO).map(f => `<button type="button" class="${filtroLog === f ? "activa" : ""}" data-filtro="${f}">${{ todo: "Todo", combate: "Combate", conquistas: "Conquistas", gestion: "Gestión" }[f]}</button>`).join("")}</div>
      <ol class="fr-registro">${lineas.map(l => { const cab = l.t !== turno ? `<li class="fr-log-turno">Turno ${l.t}</li>` : ""; turno = l.t; return `${cab}<li class="fr-log-${esc(l.tipo)}${DESTACA_LOG[l.tipo] ? ` fr-log-dest c-${DESTACA_LOG[l.tipo]}` : ""}"><i aria-hidden="true">${ICONO_LOG[l.tipo] || "·"}</i><span>${esc(l.texto)}</span></li>`; }).join("")}</ol>`;
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
    const rs = t.closest("[data-rama-saber]");
    if (rs) { ramaSaber = rs.dataset.ramaSaber; son("clic"); pintarPanel(); return; }
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
      if (!(u.dueno === H || (FM.celdasDe(u).some(q => vis[q.y * w + q.x] === 2) && !FM.oculta(est, u, H)))) return;
      const gs = u.tam === 2 ? 2 : 1, cx = (u.x + 0.5 * gs) * k, cy = (u.y + 0.5 * gs) * k;
      g.fillStyle = "#0a0810"; g.beginPath(); g.arc(cx, cy, k * 0.46 * gs, 0, 7); g.fill();
      g.fillStyle = u.dueno >= 0 ? bandos[u.dueno].col : "#b0a8a0"; g.beginPath(); g.arc(cx, cy, k * 0.32 * gs, 0, 7); g.fill();
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
      if (modo || grupoPendiente) { modo = null; grupoPendiente = null; refrescar(); }
      else if (grupo) { grupo = null; refrescar(); }
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
    sel = { uid: null, ciudad: null }; modo = null; grupo = null; limpiarPrevia();
    // Antes de pasar, las tropas con orden la cumplen
    if (FM.unidadesDe(est, humano()).some(u => u.orden)) {
      await cumplirOrdenesUI();
      if (!est || est.ganador !== null || !soyYo()) return;
    }
    $("frResumen").classList.add("hidden");
    resumenDesde = est.cronica.length;
    aplicarYo({ t: "terminar" });
    son("clic");
    if (pvp) { refrescar(); await enviarTurnoMesa("turno"); return; }
    await turnosDeLosDemas();
  });

  /* Mayús + arrastrar: elige varias tropas propias para darles la misma orden */
  function elegirGrupo(x0, y0, x1, y1) {
    if (!est || !soyYo()) return;
    const H = humano(), lo = { x: Math.min(x0, x1), y: Math.min(y0, y1) }, hi = { x: Math.max(x0, x1), y: Math.max(y0, y1) };
    const us = FM.unidadesDe(est, H).filter(u => !u.lider && u.x >= lo.x && u.x <= hi.x && u.y >= lo.y && u.y <= hi.y);
    modo = null;
    if (!us.length) { grupo = null; refrescar(); return; }
    if (us.length === 1) { grupo = null; sel = { uid: us[0].uid, ciudad: null }; refrescar(); return; }
    grupo = us.map(u => u.uid); sel = { uid: null, ciudad: null };
    son("elegir"); refrescar();
  }
  function tarjetaGrupo(c) {
    const us = grupo.map(id => est.unidades[id]).filter(Boolean);
    if (!us.length) { grupo = null; c.innerHTML = ""; return; }
    const btn = (tipo, txt) => `<button type="button" class="fr-accion${grupoPendiente === tipo ? " activa" : ""}" data-grupo-orden="${tipo}" title="${esc(txt || ORD[tipo].texto)}"><i>${ORD[tipo].ic}</i><span>${ORD[tipo].nombre}</span></button>`;
    c.innerHTML = `<div class="fr-sel"><div class="fr-sel-cuerpo"><div class="fr-sel-cab"><h3>${us.length} tropas</h3><p>Mayús + arrastrar para elegir otras. La orden se da a todas a la vez.</p></div>
      <div class="fr-grupo-lista">${us.map(u => `<button type="button" class="fr-grupo-u" data-uid="${u.uid}">${esc(FM.nombreUnidad(u))}${u.orden ? ` <small>${esc(ORD[u.orden.tipo].nombre)}</small>` : ""}</button>`).join("")}</div></div>
      <div class="fr-sel-acciones">${btn("explorar")}${btn("defender")}${btn("conquistar", "Elige en el mapa la ciudad que tomar.")}${btn("matanza")}${btn("curarse")}
        <button type="button" class="fr-accion" data-grupo-orden="quitar"><i>○</i><span>Quitar órdenes</span></button></div>
      <button type="button" class="fr-sel-x" data-soltar aria-label="Soltar la selección">×</button></div>`;
  }

  /* Las tropas con orden la cumplen solas (con la lógica de la máquina) y se anima lo que hacen */
  async function cumplirOrdenesUI() {
    const H = humano(), antes = tablero.instantanea(), evs = [];
    let avisos = [];
    cumpliendo = true;
    try {
      avisos = IA.cumplirOrdenes(est, H, acc => {
        const r = FM.aplicar(est, acc);
        if (r.ok) { if (pvp) anotarMesa(acc); if (r.ev) evs.push(...r.ev); }
        return r;
      });
    } finally { cumpliendo = false; }
    if (evs.length) await new Promise(res => tablero.reproducir(evs, antes, { tope: 4200, rapidez: 0.9, seguir: true, alTerminar: res }));
    else tablero.redibujar();
    procesarCronica();
    refrescar();
    avisos.slice(0, 6).forEach(a => toast("Órdenes", a.texto, "⚑", ""));
    if (est.ganador !== null) setTimeout(terminarGuerraUI, 600);
  }
  /* La orden según lo que se tocó: la propia tropa (o una del grupo) = sin objetivo; una tropa propia = escoltarla (defender);
     una ciudad = conquistarla; cualquier otra casilla = ir hacia ella */
  function ordenConObjetivo(tipo, u, x, y, delGrupo) {
    const H = humano(), w = FM.unidadEn(est, x, y), propia = w && (w === u || (delGrupo && delGrupo.includes(w.uid)));
    if (tipo === "conquistar") { const ci = FM.ciudadEn(est, x, y); return { tipo, x, y, ciudad: ci ? ci.id : undefined }; }
    if (tipo === "defender") {
      if (propia) return { tipo, x: u.x, y: u.y };
      if (w && w.dueno === H) return { tipo, uid: w.uid, x: w.x, y: w.y };
      return { tipo, x, y };
    }
    if (propia) return { tipo };
    return { tipo, x, y };
  }
  function ponerOrden(u, o) {
    if (o) u.orden = o; else delete u.orden;
    aviso(o ? `${FM.nombreUnidad(u)}: ${ORD[o.tipo].nombre.toLowerCase()}.` : `${FM.nombreUnidad(u)} ya no tiene orden.`);
    son("clic");
  }

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
    if (!avisoNucleo()) cartel(`Turno ${est.turno}`, 1100, `de ${est.maxTurnos}`);
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

  /* Cartel en medio de la pantalla. Con ms se va solo; sin ms se queda, pero pasado un segundo se encoge a una esquina */
  function cartel(t, ms, sub, color) {
    const el = $("frCartel");
    // Si ya había un aviso fijo a la vista (el turno de otro bando), el nuevo sigue donde estaba: no vuelve al centro
    const seguia = !!t && !ms && cartel.fijo && !el.classList.contains("hidden");
    el.innerHTML = t ? `<strong>${esc(t)}</strong>${sub ? `<span>${esc(sub)}</span>` : ""}` : "";
    el.style.setProperty("--c", color || "#f0cf6a");
    el.classList.toggle("hidden", !t);
    cartel.fijo = !!t && !ms;
    if (seguia) return;
    el.classList.remove("esquina");
    clearTimeout(cartel.t);
    if (t && ms) cartel.t = setTimeout(() => el.classList.add("hidden"), ms);
    else if (t) cartel.t = setTimeout(() => el.classList.add("esquina"), 1100);
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
      irAlCuartel(ej.faccion, aMesas ? "duelos" : "guerra");
    }
  });

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
    const id = await Red.registrarGuerra({ frente: frente && frente.premio !== false ? { clave: frente.clave, bandos: frente.bandos, dificultad: frente.dificultad } : null, ejercito: ej.nombre, faccion: ej.faccion, rival: reg.rival, tipo: reg.tipo, resultado: reg.resultado, turnos: reg.turnos, razon: reg.razon || "", bajas: reg.bajas, logros: reg.logros, titulo: narr.titulo, cronica: narr.parrafos.slice(0, 12), anio: reg.anio, pvp: !!pvp });
    ultimoResumen.guerraId = id;
    pantallaFin();
  }

  function pantallaFin() {
    const { resumen, narr, reg } = ultimoResumen;
    mostrar("frFin");
    const fr = ultimoResumen.frente, nivelFr = fr && FRT ? FRT.NIVELES[fr.nivel] : null, mesaFin = ultimoResumen.mesa;
    const premio = resumen.gano && ultimoResumen.guerraId && !ultimoResumen.premiado && !ultimoResumen.pvp && fr && fr.premio !== false;
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
      ${resumen.gano && fr && fr.premio === false ? `<p class="fr-sub">Este frente ya no daba carta esta vez.</p>` : ""}
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
    if (t.closest("[data-volver]")) { pvp = null; yoIdx = 0; irAlCuartel(ej.faccion, ultimoResumen && ultimoResumen.pvp ? "duelos" : "guerra"); return; }
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


  /* --- La guerra de una mesa --- */
  /* La repetición de la guerra (turnos guardados y turnos de la máquina) vive en js/fractura-mesa.js */
  const MESA = window.FracturaMesa;
  const avanzarMaquina = MESA.avanzarMaquina, aplicarEntrada = MESA.aplicarEntrada, ganadoresTexto = MESA.ganadoresTexto;
  const nombreAsiento = i => (pvp && pvp.nombres[i]) || (est && est.jugadores[i] ? FACCIONES[est.jugadores[i].faccion].corto : "otro jugador");

  async function abrirMesa(id, faccionUrl) {
    const volver = t => irAlCuartel(faccionUrl, "duelos", t);
    let fila;
    try { fila = await Red.mesaGet(id); } catch (e) { volver(`No se pudo abrir la mesa (${e.message || e}).`); return; }
    const s = await Red.sesion();
    if (!s) { volver("No se pudo abrir la mesa: hace falta iniciar sesión."); return; }
    miUid = s.user.id;
    const cfg = fila.config || {}, humanos = cfg.humanos || [], miIdx = humanos.indexOf(miUid);
    if (!cfg.jugadores || fila.estado === "abierta") { volver("Esa mesa todavía no empezó."); return; }
    if (miIdx < 0) { volver("No estás en esa guerra."); return; }
    if (cfg.reglas !== D.REGLAS) { volver("Esa guerra se jugaba con otra versión del juego y ya no se puede continuar."); return; }
    // El ejército es el que tiene el jugador sentado en esa mesa
    const fMesa = cfg.jugadores[miIdx].faccion;
    if (!ejercitos[fMesa]) { volver(`Esa guerra la juegas con ${nombreFaccion(fMesa)}, y ese ejército no está en este navegador ni en tu cuenta.`); return; }
    ej = ejercitos[fMesa];
    pararSondeo();
    yoIdx = miIdx;
    est = MESA.crear(cfg, miIdx);
    cfgGuerraActual = { faccion: ej.faccion };
    const nombres = humanos.map(u => { const a = (fila.asientos || []).find(x => x.user === u); return a ? a.nombre : null; });
    pvp = { id, mesa: true, n: 0, acciones: [], timer: null, humanos, nombres, limite: fila.limite, actualizada: fila.actualizada, estado: fila.estado, roto: false, horas: cfg.horas || 48,
      conApuestas: Object.values(fila.apuestas || {}).some(a => a && a.length) };
    aplicarTurnosMesa(fila);
    if (est.ganador === null && fila.estado === "activa") recuperarTurnoMesa();
    // Si este ejército ya cerró su parte (cayó o la guerra terminó), no se vuelve a entrar: solo se mira cómo va
    if ((ej.mesasCerradas || []).includes(id)) {
      const fin = est.ganador !== null;
      if (fin && !pvp.roto) { try { await Red.mesaTerminar(id, ganadoresTexto(est), est.razon); } catch (e) { /* ya estaba anotado */ } }
      const t = fin ? `La guerra terminó. ${est.razon || ""}` : `Tu ejército ya está fuera de esa guerra. Va por el turno ${est.turno}.`;
      pvp = null; yoIdx = 0; est = null;
      irAlCuartel(ej.faccion, "duelos", t);
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
    if (est.activo === yoIdx) { pararSondeo(); if (!avisoNucleo()) cartel("Tu turno", 1400, `Turno ${est.turno} de ${est.maxTurnos}`); son("turno"); resumenDeRonda(); atenderOfertas(); refrescar(); }
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
    try { await Red.mesaTurno(pvp.id, pvp.n, tipo, tipo === "ausente" ? [] : acc, d.siguiente, d.firma); olvidarTurnoMesa(); pvp.n += 1; }
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
    if (!pasado) { el.classList.add("hidden"); return; }
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

  /* =========================================================================
     ARRANQUE DE LA PÁGINA DE LA GUERRA
     ?mesa=<id>: la guerra de una mesa. ?nueva=1: una guerra nueva preparada en el cuartel (va por sessionStorage).
     Sin nada: la guerra guardada en este navegador. Si no hay qué jugar, se vuelve al cuartel.
  ========================================================================= */
  G.alCerrarAjustes = pintarPista;
  (async function arrancar() {
    const q = new URLSearchParams(location.search), f = q.get("f"), mesa = q.get("mesa");
    mostrar("frGuerra");
    // El tablero (Phaser) se carga como módulo, después de este script: se espera a que esté
    const esperarTablero = () => new Promise(ok => { const t0 = Date.now(); (function mira() { if (window.FracturaTableroPhaser || Date.now() - t0 > 20000) ok(); else setTimeout(mira, 50); })(); });
    await Promise.all([cargarEjercitos(), esperarTablero()]);
    if (mesa) { await abrirMesa(mesa, f); return; }
    if (q.get("nueva")) {
      const n = leerSesion("fracturaNueva");
      ej = n && ejercitos[f];
      if (!ej) { irAlCuartel(f, "guerra"); return; }
      const cfg = C.prepararGuerra(ej, n.ids, n.opciones);
      if (!cfg) { irAlCuartel(f, "guerra", "No hay soldados disponibles."); return; }
      pvp = null; yoIdx = 0;
      est = FM.crearGuerra(cfg);
      cfgGuerraActual = { faccion: ej.faccion, frente: n.frente || null };
      ejercitosAntes = null;
      sel = { uid: null, ciudad: null }; modo = null;
      // Si se recarga la página, sigue esta misma guerra (la guardada) y no se arma otra
      history.replaceState(null, "", `${PAG_GUERRA}?f=${encodeURIComponent(f)}`);
      entrarGuerra(true);
      guardarEnCurso();
      return;
    }
    const g = Red.cargarGuerra();
    if (g && ejercitos[g.cfg.faccion] && (!f || g.cfg.faccion === f)) { retomarGuerra(); return; }
    irAlCuartel(f, "guerra", g ? "" : "No hay ninguna guerra guardada en este navegador.");
  })();
})();
