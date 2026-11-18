  function guardarEnCurso() { if (pvp || !est) return; clearTimeout(guardarEstadoTimer); guardarEstadoTimer = setTimeout(() => { if (est && !ocupadoIA) Red.guardarGuerra(est, cfgGuerraActual); }, 400); }

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
    return window.FracturaTableroPhaser.crear($("frTablero"), { alTocar: tocar, alPasar: pasarPor, alSonar: son, alMoverVista: pintarMiniPronto, alCaja: elegirGrupo });
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
        if (u.pm > 0) FM.alcanzables(est, u).destinos.forEach((n, k) => e.mover.set(k, n));
        Object.values(est.unidades).forEach(w => { if (FM.hostil(est, w.dueno, H) && FM.veUnidad(est, H, w) && !FM.razonNoAtacar(est, u, w)) e.atacar.add(`${w.x},${w.y}`); });
        const o = u.orden;
        if (o && o.uid && est.unidades[o.uid]) { const w = est.unidades[o.uid]; e.objetivosHab.add(`${w.x},${w.y}`); }
        else if (o && o.x !== undefined && o.tipo !== "defender") e.objetivosHab.add(`${o.x},${o.y}`);
      } else modo.casillas.forEach(k => e.objetivosHab.add(k));
    }
    if (botar && soyYo()) botar.casillas.forEach(k => e.objetivosHab.add(k));
    if (grupo) grupo.forEach(uid => { const w = est.unidades[uid]; if (w) e.objetivosHab.add(`${w.x},${w.y}`); });
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
    if (t) { const e = FM.ef(est, t), tr = tropaDe(t); mostrarPrevia(x, y, `<b style="color:${colorDe(t.dueno)}">${esc(FM.nombreUnidad(t))}</b><span>${esc(tr.nombre)} · ${t.dueno >= 0 ? esc(FACCIONES[est.jugadores[t.dueno].faccion].corto) : "sin dueño"}</span><span class="fr-previa-cifras">${ico("vida")}${t.hp}/${e.hpMax} ${ico("ataque")}${e.atq} ${ico("defensa")}${e.def}</span>`); }
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
      const razon = p ? FM.razonNoAtacar(est, u, t) : (FM.razonAgua(est, u, t) || ((FM.polvoraFac(est, u) || CLASES[u.clase].pesado) && cheb(u, t) > FM.ef(est, u).alc ? "No puede moverse y disparar: acércalo antes y dispara el turno siguiente" : "No llega este turno"));
      u.x = sx; u.y = sy; u.quieto = q;
      if (!p || razon) { mostrarPrevia(x, y, `<b style="color:${colorDe(t.dueno)}">${esc(FM.nombreUnidad(t))}</b><span class="fr-previa-no">${esc(razon || "No llega este turno")}</span>`); return; }
      ataquePrevio = { x, y };
      const queda = Math.max(0, p.hpT - p.dmg);
      mostrarPrevia(x, y, `<b style="color:${colorDe(t.dueno)}">${esc(FM.nombreUnidad(t))}</b>
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
    const junto = (x, y) => Object.values(est.unidades).filter(w => cheb(w, { x, y }) <= 1);
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
        let razon = ya || (cd > 0 ? (cd > 50 ? "Solo se puede usar una vez por guerra." : `Le faltan ${cd} turnos.`) : ab.coste && !FM.puedePagar(jh, ab.coste) ? "No te alcanzan los recursos." : null);
        const base = { ic: "✪", nombre: ab.nombre, texto: ab.texto, coste: ab.coste, heroe: true };
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
        ${accionesActuales.length ? `<div class="fr-sel-acciones">${accionesActuales.map((a, i) => `<button type="button" class="fr-accion${a.razon ? " no" : ""}${(modo && modo.i === i) || a.activa ? " activa" : ""}${a.ordenBtn ? " fr-accion-orden" : ""}" data-accion="${i}" title="${esc(a.texto)}${a.razon ? ` — ${esc(a.razon)}` : ""}"><i>${a.ic}</i><span>${esc(a.nombre)}</span>${a.coste ? costeHtml(a.coste, est.jugadores[H]) : ""}${a.razon ? `<small>${esc(a.razon)}</small>` : ""}</button>${a.caido ? `<button type="button" class="fr-enlace fr-ver-caido" data-ver-caido="${i}">Ver a ${esc(a.caido.s.nombre)}</button>` : ""}`).join("")}</div>` : ""}
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
        if (r.ok) { if (pvp) pvp.acciones.push(acc); if (r.ev) evs.push(...r.ev); }
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
