/* =============================================================================
   LA FRACTURA: motor de reglas. Es puro y determinista: el estado entero (est) es un objeto simple
   que se puede guardar en JSON y volver a cargar, y todo azar sale de est.rs, así que la misma
   semilla y las mismas acciones dan siempre la misma guerra (hace falta para jugar contra otros).

   Casillas 13x13, movimiento en 8 direcciones. Dos jugadores por turnos. Se gana capturando la
   capital rival, reteniendo el Núcleo del Sueño durante unos turnos o por puntos al acabar.
   Lo que se guarda de cada soldado entre guerras lo decide fractura-campana.js.
   Se usa igual en el navegador y en Node.
============================================================================= */
(function (raiz) {
  const D = raiz.FRACTURA_DATOS || (typeof require !== "undefined" ? require("./fractura-datos.js") : null);
  const S = raiz.FracturaSoldados || (typeof require !== "undefined" ? require("./fractura-soldados.js") : null);
  const M = raiz.FracturaMapa || (typeof require !== "undefined" ? require("./fractura-mapa.js") : null);
  const { TERRENOS, ESTRUCTURAS, CLASES, ESPECIALIZACIONES, EDIFICIOS, ESCUELAS, RELIQUIAS, FACCIONES, TIPOS_FRACTURA, DIFICULTADES, RECURSOS } = D;
  const dist = M.dist;
  const MAX_UNIDADES = 18;
  const NOMBRES_CIUDAD = ["Alba Quebrada", "Paso del Cuervo", "Vado Gris", "Cerro Hueco", "Torre Lenta", "Puerto Seco", "Villa Olvidada", "Los Tres Pozos", "Campo Largo", "San Nadie",
    "El Altillo", "Peña Roja", "Brasa Fría", "La Última Posada", "Rincón del Eco", "Mesa Rota", "Llano Hondo", "Muelle Vacío", "El Telar", "Hoya Oscura"];
  const CAPITALES = { "caballeros-del-reino": "La Plaza del Reino", "academia-arcana-de-dolbred": "El Claustro Arcano", "trono-de-ceniza": "El Osario Mayor",
    "compania-dorada": "El Campamento Dorado", "hijos-del-acero": "El Fuerte del Acero", "peregrinos-del-alba": "La Hospedería del Alba" };

  /* --- Azar con la semilla de la guerra --- */
  function rn(est) { const o = { s: est.rs }; const v = S.rnd(o); est.rs = o.s; return v; }
  function ri(est, n) { return Math.floor(rn(est) * n); }
  const elegirDe = (est, lista) => lista[ri(est, lista.length)];

  /* --- Consultas --- */
  const clave = (x, y) => `${x},${y}`;
  const dentro = (est, x, y) => x >= 0 && y >= 0 && x < est.ancho && y < est.alto;
  const casilla = (est, x, y) => (dentro(est, x, y) ? est.casillas[y][x] : null);
  function unidadEn(est, x, y) {
    for (const uid in est.unidades) { const u = est.unidades[uid]; if (u.x === x && u.y === y) return u; }
    return null;
  }
  const unidadesDe = (est, j) => Object.values(est.unidades).filter(u => u.dueno === j);
  const ciudadEn = (est, x, y) => { for (const id in est.ciudades) { const c = est.ciudades[id]; if (c.x === x && c.y === y) return c; } return null; };
  const ciudadesDe = (est, j) => Object.values(est.ciudades).filter(c => c.dueno === j);
  const enemigoDe = j => 1 - j;
  const esMonstruo = (est, u) => !!(CLASES[u.clase].monstruo || CLASES[u.clase].muertoViviente || (u.dueno >= 0 && est.jugadores[u.dueno].faccion === "trono-de-ceniza"));
  const nombreUnidad = u => (u.s ? S.nombreConApodo(u.s) : u.nombre || CLASES[u.clase].nombre);
  const regionDeCasilla = (est, x, y) => est.regiones[est.casillas[y][x].region];

  function reg(est, texto, tipo) {
    est.log.push({ t: est.turno, texto, tipo: tipo || "" });
    if (est.log.length > 400) est.log.splice(0, est.log.length - 400);
  }
  function crono(est, tipo, datos) {
    est.cronica.push(Object.assign({ t: est.turno, tipo }, datos));
  }

  /* --- Estadísticas efectivas de una unidad --- */
  function bonoReliquias(est, u) {
    const tot = {};
    if (!u.s) return tot;
    Object.keys(u.s.equipo || {}).forEach(slot => {
      const inst = est.reliquias[u.s.equipo[slot]];
      if (!inst) return;
      Object.keys(inst.bono).forEach(k => { tot[k] = (tot[k] || 0) + inst.bono[k]; });
    });
    return tot;
  }

  function auras(est, u) {
    const a = { atq: 0, def: 0, mov: 0 };
    if (u.dueno < 0) return a;
    const jug = est.jugadores[u.dueno];
    const fac = FACCIONES[jug.faccion];
    unidadesDe(est, u.dueno).forEach(w => {
      const d = dist(u, w);
      if (d > 2) return;
      if (w.lider && !jug.liderMuerto) {
        const al = fac.lider.aura;
        a.def += al.auraDef || 0; a.atq += al.auraAtq || 0;
      }
      if (w.s && w.s.equipo && w.s.equipo.estandarte) {
        const inst = est.reliquias[w.s.equipo.estandarte];
        if (inst) { a.def += inst.bono.auraDef || 0; a.atq += inst.bono.auraAtq || 0; a.mov += inst.bono.auraMov || 0; }
      }
      if (d <= 1 && w !== u && w.clase === "paladin") a.def += 1;
      if (w !== u && w.s && u.s && w.s.capitan && w.s.compania && w.s.compania === u.s.compania) a.def += 1;
    });
    return a;
  }

  function ef(est, u) {
    const cl = CLASES[u.clase];
    const s = u.s;
    const jug = u.dueno >= 0 ? est.jugadores[u.dueno] : null;
    const fac = jug ? FACCIONES[jug.faccion] : null;
    let hpMax = cl.hp, atq = cl.atq, def = cl.def, mov = cl.mov, alc = cl.alc, vision = 2, cura = 0;
    if (s) {
      const rg = S.rangoDe(s.victorias + (u.vicG || 0));
      hpMax += S.modHp(s) + rg.hp;
      atq += S.modAtq(s, u.clase) + rg.atq;
      mov += S.modMov(s);
      if (s.spec) {
        const sp = ESPECIALIZACIONES[s.spec];
        def += sp.def || 0; mov += sp.mov || 0; alc += sp.alc || 0; vision += sp.vision || 0;
      }
      if (s.capitan) hpMax += 2;
      if (s.luto && s.luto.restantes > 0) atq += 1;
      const eq = bonoReliquias(est, u);
      atq += eq.atq || 0; def += eq.def || 0; mov += eq.mov || 0; alc += eq.alc || 0; hpMax += eq.hp || 0; vision += eq.vision || 0; cura += eq.cura || 0;
    }
    if (jug && fac) {
      const t = jug.tech;
      const m = fac.mods || {};
      if (m.hpClase && m.hpClase[u.clase]) hpMax += m.hpClase[u.clase];
      if (m.atqClase && m.atqClase[u.clase]) atq += m.atqClase[u.clase];
      if (t.militar >= 1 && (u.clase === "guerrero" || u.clase === "paladin")) hpMax += 1;
      if (t.militar >= 3) atq += 1;
      if (t.militar >= 4 && s && S.rangoIndice(s.victorias + (u.vicG || 0)) >= 2) { atq += 1; def += 1; }
      if (t.militar >= 2 && vecinosAliados(est, u).some(w => w.clase === u.clase)) def += 1;
      if (t.arcano >= 4 && (u.clase === "arcanista" || u.clase === "archimago")) alc += 1;
      if (t.tanato >= 2) cura += 1;
      if (m.curaExtra) cura += m.curaExtra;
      if (jug.liderMuerto && fac.lider.estado) {
        const e = fac.lider.estado;
        atq += e.atq || 0; def += e.def || 0; hpMax += e.hp || 0;
        if (e.atqClases && e.atqClases[u.clase]) atq += e.atqClases[u.clase];
      }
      const au = auras(est, u);
      atq += au.atq; def += au.def; mov += au.mov;
    }
    if (u.efectos && u.efectos.sinMando && u.efectos.sinMando >= est.turno) atq -= 1;
    if (u.efectos && u.efectos.frenado && u.efectos.frenado >= est.turno) mov -= 1;
    return { atq: Math.max(0, atq), def: Math.max(0, def), mov: Math.max(1, mov), alc: Math.max(1, alc), hpMax: Math.max(1, hpMax), vision, cura };
  }

  function vecinosAliados(est, u) {
    const out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const w = unidadEn(est, u.x + dx, u.y + dy);
      if (w && w.dueno === u.dueno) out.push(w);
    }
    return out;
  }
  const vecinosEnemigos = (est, u) => {
    const out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const w = unidadEn(est, u.x + dx, u.y + dy);
      if (w && w.dueno !== u.dueno) out.push(w);
    }
    return out;
  };

  /* --- Recursos --- */
  const puedePagar = (jug, coste) => Object.keys(coste).every(k => (jug.recursos[k] || 0) >= coste[k]);
  function pagar(jug, coste) { Object.keys(coste).forEach(k => { jug.recursos[k] -= coste[k]; }); }
  const sumar = (jug, k, n) => { jug.recursos[k] = (jug.recursos[k] || 0) + n; };

  function tieneEdificio(est, j, id) { return ciudadesDe(est, j).some(c => c.edificios.includes(id) && !(c.desh[id] >= est.turno)); }

  function costeReclutar(est, j, clase, ciudad) {
    const jug = est.jugadores[j], fac = FACCIONES[jug.faccion];
    const c = Object.assign({}, CLASES[clase].coste);
    const mc = fac.mods.costeClase && fac.mods.costeClase[clase];
    if (mc) Object.keys(mc).forEach(k => { c[k] = Math.max(0, (c[k] || 0) + mc[k]); });
    if (ciudad && ciudad.edificios.includes("cuartel") && c.oro && clase !== "mercenario") c.oro = Math.max(0, c.oro - 1);
    if (fac.mods.sinComida) delete c.comida;
    Object.keys(c).forEach(k => { if (!c[k]) delete c[k]; });
    return c;
  }

  function clasesDisponibles(est, j) {
    const fac = FACCIONES[est.jugadores[j].faccion];
    const lista = D.CLASES_BASE.slice();
    (fac.clasesExtra || []).forEach(c => lista.push(c));
    lista.push("eco");
    return lista.filter(c => CLASES[c]);
  }

  function razonNoReclutar(est, j, ciudadId, clase) {
    const jug = est.jugadores[j];
    const ciudad = est.ciudades[ciudadId];
    if (!ciudad || ciudad.dueno !== j) return "Esa ciudad no es tuya.";
    if (est.activo !== j) return "No es tu turno.";
    if (ciudad.reclutado) return "Esa ciudad ya entrenó una unidad este turno.";
    const cl = CLASES[clase];
    if (!cl || cl.noReclutable) return "No se puede entrenar.";
    if (!clasesDisponibles(est, j).includes(clase)) return "Tu facción no entrena esa clase.";
    if (unidadesDe(est, j).length >= MAX_UNIDADES) return "Ya tienes el máximo de unidades.";
    const rq = cl.requiere || {};
    if (rq.edificio && !(ciudad.edificios.includes(rq.edificio) && !(ciudad.desh[rq.edificio] >= est.turno))) return `Hace falta ${EDIFICIOS[rq.edificio].nombre} en la ciudad.`;
    if (rq.escuela && jug.tech[rq.escuela[0]] < rq.escuela[1]) return `Hace falta ${ESCUELAS[rq.escuela[0]].escalones[rq.escuela[1] - 1].nombre}.`;
    if (!puedePagar(jug, costeReclutar(est, j, clase, ciudad))) return "No te alcanzan los recursos.";
    const libre = casillaLibreCerca(est, ciudad, j);
    if (!libre) return "No hay sitio libre junto a la ciudad.";
    return null;
  }

  function casillaLibreCerca(est, ciudad, j) {
    const cand = [{ x: ciudad.x, y: ciudad.y }];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) cand.push({ x: ciudad.x + dx, y: ciudad.y + dy });
    return cand.find(p => dentro(est, p.x, p.y) && TERRENOS[est.casillas[p.y][p.x].t].mov > 0 && !unidadEn(est, p.x, p.y)) || null;
  }

  /* --- Unidades --- */
  function nuevaUnidad(est, dueno, clase, x, y, soldado, extra) {
    const u = Object.assign({
      uid: `u${est.siguienteUid++}`, dueno, clase, x, y, hp: 1, s: soldado || null, pm: 0, atacado: false, recorrido: 0,
      vicG: 0, bajasG: 0, voluntadUsada: false, efectos: {}, quieto: true, enfriar: 0, bonoEq: {}
    }, extra || {});
    est.unidades[u.uid] = u;
    u.hp = ef(est, u).hpMax;
    return u;
  }

  /* --- Vista (niebla de guerra) --- */
  function actualizarVision(est, j) {
    const v = est.vision[j];
    for (let i = 0; i < v.length; i++) if (v[i] === 2) v[i] = 1;
    const marca = (cx, cy, r) => {
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (dentro(est, x, y)) v[y * est.ancho + x] = 2;
    };
    unidadesDe(est, j).forEach(u => marca(u.x, u.y, ef(est, u).vision));
    ciudadesDe(est, j).forEach(c => marca(c.x, c.y, 3));
    est.fortalezasDueno.forEach((d, i) => { if (d === j) { const p = est.fortalezas[i]; marca(p.x, p.y, 2); } });
  }
  const veCasilla = (est, j, x, y) => est.vision[j][y * est.ancho + x] === 2;

  /* --- Crear la guerra --- */
  function generarContingenteIA(est, j, n, anio, escala) {
    const fac = FACCIONES[est.jugadores[j].faccion];
    const mezcla = ["guerrero", "guerrero", "cazador", "cazador", "paladin", "picaro", "arcanista", "guerrero"];
    (fac.clasesExtra || []).forEach(c => { if (c !== "eco" && !CLASES[c].noReclutable) { mezcla.unshift(c); } });
    const out = [];
    for (let i = 0; i < n; i++) {
      const clase = mezcla[i % mezcla.length];
      const r = { s: est.rs };
      const s = S.crearSoldado(r, { clase, cultura: fac.cultura, origen: elegirDe(est, fac.origenes), anio });
      est.rs = r.s;
      s.victorias = ri(est, 6) + Math.floor((escala || 0) * (0.5 + rn(est) * 0.7));
      out.push(s);
    }
    return out;
  }

  function nuevoLider(est, j, x, y) {
    const fac = FACCIONES[est.jugadores[j].faccion];
    const r = { s: est.rs };
    const sexo = rn(est) < 0.5 ? "m" : "f";
    const nombre = `${S.nombreNuevo(r, fac.cultura, sexo)} ${S.casaNueva(r, fac.cultura)}`;
    est.rs = r.s;
    return nuevaUnidad(est, j, "lider", x, y, null, { lider: true, nombre: `${fac.lider.titulo} ${nombre}` });
  }

  function crearGuerra(cfg) {
    const tipoId = TIPOS_FRACTURA[cfg.tipo] ? cfg.tipo : "reinos";
    const mapa = M.generarMapa(cfg.semilla, tipoId);
    const est = {
      v: 1, semilla: cfg.semilla, tipo: tipoId, dificultad: cfg.dificultad || "normal", anio: cfg.anio || 1,
      ancho: mapa.ancho, alto: mapa.alto, casillas: mapa.casillas, regiones: mapa.regiones, costuras: mapa.costuras, capitales: mapa.capitales, nucleo: mapa.nucleo,
      turno: 1, activo: 0, maxTurnos: cfg.maxTurnos || 35, hold: cfg.hold || 6, rs: mapa.rng || 1,
      jugadores: [], ciudades: {}, unidades: {}, siguienteUid: 1, siguienteCiudad: 1, reliquias: {}, tumbas: [], log: [], cronica: [],
      ganador: null, razon: null, nucleoHold: [0, 0], vision: [new Array(mapa.ancho * mapa.alto).fill(0), new Array(mapa.ancho * mapa.alto).fill(0)],
      fortalezas: [], fortalezasDueno: [], stats: { bajas: [0, 0], ciudades: [0, 0], oficiales: [0, 0] }, pendientes: [], humano: cfg.jugadores[0].humano ? 0 : cfg.jugadores[1].humano ? 1 : -1,
      primerTurno: true, ev: [], caidos: [], pvp: !!cfg.pvp
    };
    if (cfg.pvp) est.humano = cfg.humanoIdx === undefined ? 0 : cfg.humanoIdx;
    // Jugadores
    cfg.jugadores.forEach((jc, j) => {
      const fac = FACCIONES[jc.faccion];
      const rec = { comida: 6, materiales: 6, mineral: 2, oro: 8, mana: 3, anima: 0 };
      if (fac.mods.sinComida) { rec.comida = 0; rec.anima = 5; }
      if (fac.mods.manaInicial) rec.mana += fac.mods.manaInicial;
      if (j === 1) { rec.oro += 4; rec.comida += 2; }
      if (fac.mods.oroInicial) rec.oro += fac.mods.oroInicial;
      est.jugadores.push({ id: j, nombre: jc.nombre, faccion: jc.faccion, humano: !!jc.humano, recursos: rec, tech: { militar: 0, arcano: 0, tanato: 0 },
        liderMuerto: false, ia: jc.humano ? null : { nivel: jc.nivelIA || est.dificultad }, mochila: [] });
      if (fac.escuelaInicial) est.jugadores[j].tech[fac.escuelaInicial[0]] = fac.escuelaInicial[1];
      (jc.reliquias || []).forEach(inst => { est.reliquias[inst.id] = inst; });
    });
    // Ciudades: capitales y sitios neutrales
    const crearCiudad = (x, y, dueno, nombre, capital, nivel) => {
      const id = `c${est.siguienteCiudad++}`;
      est.ciudades[id] = { id, nombre, x, y, dueno, nivel, edificios: [], desh: {}, capital, region: est.casillas[y][x].region, reclutado: false };
      est.casillas[y][x].est = "ciudad";
      return est.ciudades[id];
    };
    crearCiudad(est.capitales[0].x, est.capitales[0].y, 0, CAPITALES[est.jugadores[0].faccion] || "La capital", true, 2);
    crearCiudad(est.capitales[1].x, est.capitales[1].y, 1, CAPITALES[est.jugadores[1].faccion] || "La capital", true, 2);
    const nombres = [];
    for (let i = 0; i < NOMBRES_CIUDAD.length; i++) nombres.push(NOMBRES_CIUDAD[(i * 7 + (cfg.semilla % 13)) % NOMBRES_CIUDAD.length]);
    const unicos = Array.from(new Set(nombres));
    mapa.sitios.forEach((p, i) => { crearCiudad(p.x, p.y, null, unicos[i % unicos.length], false, 1); });
    mapa.fortalezas.forEach(p => { est.fortalezas.push({ x: p.x, y: p.y }); est.fortalezasDueno.push(null); });
    // Guardianes salvajes de ruinas y fortalezas
    const guardar = (p, fuerza) => nuevaUnidad(est, -1, "salvaje", p.x, p.y, null, { nombre: "Guardián", fuerza, guardia: true });
    mapa.fortalezas.forEach(p => guardar(p, 1));
    mapa.ruinas.forEach((p, i) => { if (i % 2 === 0 || tipoId === "archivo") guardar(p, 0); });
    // Tropas
    cfg.jugadores.forEach((jc, j) => {
      let soldados = jc.soldados || [];
      if (!jc.humano) soldados = soldados.concat(generarContingenteIA(est, j, DIFICULTADES[est.dificultad].tropas + (jc.extraTropas || 0) - soldados.length, est.anio, jc.escala || 0));
      else if (!soldados.length) soldados = generarContingenteIA(est, j, 6, est.anio, 0);
      const cap = est.capitales[j];
      const sitios = [];
      for (let r = 0; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cap.x + dx, y = cap.y + dy;
        if (dentro(est, x, y) && TERRENOS[est.casillas[y][x].t].mov > 0 && !(x === cap.x && y === cap.y) && !casilla(est, x, y).est) sitios.push({ x, y });
      }
      nuevoLider(est, j, cap.x, cap.y);
      soldados.slice(0, MAX_UNIDADES - 1).forEach((s, i) => {
        const p = sitios[i];
        if (!p) return;
        nuevaUnidad(est, j, s.clase, p.x, p.y, s);
      });
    });
    actualizarRegiones(est);
    actualizarVision(est, 0); actualizarVision(est, 1);
    iniciarTurno(est, 0, true);
    reg(est, `Empieza la guerra en ${TIPOS_FRACTURA[tipoId].nombre}.`, "turno");
    return est;
  }

  /* --- Economía --- */
  function ingresoDe(est, j) {
    const jug = est.jugadores[j];
    const fac = FACCIONES[jug.faccion];
    const tot = { comida: 0, materiales: 0, mineral: 0, oro: 0, mana: 0, anima: 0 };
    const tipo = TIPOS_FRACTURA[est.tipo];
    const escaso = tipo.escaso ? 0.5 : 1;
    ciudadesDe(est, j).forEach(c => {
      tot.comida += 1; tot.materiales += 1;
      tot.oro += Math.max(0, 1 + c.nivel + (fac.mods.oroCiudad || 0));
      if (fac.mods.animaCiudad) tot.anima += fac.mods.animaCiudad;
      const r = c.nivel >= 3 ? 2 : 1;
      for (let y = c.y - r; y <= c.y + r; y++) for (let x = c.x - r; x <= c.x + r; x++) {
        if (!dentro(est, x, y)) continue;
        const rin = TERRENOS[est.casillas[y][x].t].rinde;
        Object.keys(rin).forEach(k => { tot[k] += Math.floor(rin[k] * escaso + 0.0001) || (rin[k] && escaso < 1 ? (ri(est, 2) ? 1 : 0) : 0); });
      }
      c.edificios.forEach(id => {
        if (c.desh[id] >= est.turno) return;
        const ed = EDIFICIOS[id];
        Object.keys(ed.rinde).forEach(k => { tot[k] += ed.rinde[k]; });
        if (ed.rama === "eco" && jug.tech.arcano >= 3) tot[Object.keys(ed.rinde)[0] || "oro"] += 1;
      });
    });
    unidadesDe(est, j).forEach(u => {
      const e = bonoReliquias(est, u);
      if (u.s) { tot.mana += e.mana || 0; tot.oro += e.oro || 0; }
      if (u.lider && !jug.liderMuerto) { const al = fac.lider.aura; tot.mana += al.mana || 0; tot.oro += al.oro || 0; }
      if (e.oro && u.s) { /* ya sumado */ }
    });
    if (jug.liderMuerto && fac.lider.estado && fac.lider.estado.oroMitad) tot.oro = Math.floor(tot.oro / 2);
    if (jug.humano === false && DIFICULTADES[est.dificultad].bonoRecursos) {
      Object.keys(tot).forEach(k => { tot[k] = Math.ceil(tot[k] * (1 + DIFICULTADES[est.dificultad].bonoRecursos)); });
    }
    return tot;
  }

  function mantenimiento(est, j) {
    const jug = est.jugadores[j];
    if (FACCIONES[jug.faccion].mods.sinComida) return 0;
    const n = unidadesDe(est, j).filter(u => !u.lider).length;
    return Math.max(0, n - 3 * ciudadesDe(est, j).length);
  }

  function iniciarTurno(est, j, primero) {
    const jug = est.jugadores[j];
    if (!primero) {
      const ing = ingresoDe(est, j);
      Object.keys(ing).forEach(k => sumar(jug, k, ing[k]));
      const gasto = mantenimiento(est, j);
      jug.recursos.comida -= gasto;
      if (jug.recursos.comida < 0) {
        let falta = -jug.recursos.comida;
        jug.recursos.comida = 0;
        const unidades = unidadesDe(est, j).filter(u => !u.lider && u.hp > 1);
        while (falta > 0 && unidades.length) {
          const u = unidades.splice(ri(est, unidades.length), 1)[0];
          u.hp = Math.max(1, u.hp - 2);
          falta -= 1;
          reg(est, `${nombreUnidad(u)} pasa hambre y pierde vida.`, "hambre");
        }
      }
    }
    ciudadesDe(est, j).forEach(c => { c.reclutado = false; });
    unidadesDe(est, j).forEach(u => {
      const e = ef(est, u);
      u.pm = e.mov; u.atacado = false; u.recorrido = 0; u.quieto = true; u.accion = false;
      if (u.enfriar > 0) u.enfriar -= 1;
    });
    // Los sanadores y las reliquias que curan, y el descanso
    unidadesDe(est, j).forEach(u => {
      const e = ef(est, u);
      let cura = 0;
      if (u.descanso) cura += 2;
      const c = ciudadEn(est, u.x, u.y);
      if (c && c.dueno === j) { cura += 3; if (c.edificios.includes("fortaleza")) cura += 2; }
      else if (casilla(est, u.x, u.y).est === "fortaleza" && est.fortalezasDueno[est.fortalezas.findIndex(p => p.x === u.x && p.y === u.y)] === j) cura += 2;
      cura += e.cura || 0;
      vecinosAliados(est, u).forEach(w => {
        if (w.clase === "sanador") cura += 4;
        const ew = bonoReliquias(est, w);
        cura += ew.cura || 0;
      });
      if (cura > 0 && u.hp < e.hpMax) u.hp = Math.min(e.hpMax, u.hp + cura);
      u.descanso = true;
    });
    actualizarVision(est, j);
  }

  /* --- Regiones y sucesos de la Fractura --- */
  function actualizarRegiones(est) {
    est.regiones.forEach(rg => {
      const cuenta = [0, 0];
      Object.values(est.ciudades).forEach(c => { if (c.dueno !== null && c.region === rg.id) cuenta[c.dueno]++; });
      est.fortalezas.forEach((p, i) => { const d = est.fortalezasDueno[i]; if (d !== null && est.casillas[p.y][p.x].region === rg.id) cuenta[d]++; });
      rg.dueno = cuenta[0] > cuenta[1] ? 0 : cuenta[1] > cuenta[0] ? 1 : null;
    });
  }

  function nuevaRonda(est) {
    const tipo = TIPOS_FRACTURA[est.tipo];
    // Estabilidad: sube donde alguien manda, baja en los fragmentos sin dueño que no son estables
    est.regiones.forEach(rg => {
      if (rg.dueno !== null) rg.estab = Math.min(100, rg.estab + 2);
      else if (rg.tipo !== "estable") rg.estab = Math.max(0, rg.estab - 1);
    });
    // Sucesos en los fragmentos inestables
    est.regiones.forEach(rg => {
      if (rg.estab >= 30 || rn(est) > 0.28) return;
      const tipoS = elegirDe(est, D.SUCESOS);
      if (tipoS === "criatura") {
        const lib = [];
        for (let y = 0; y < est.alto; y++) for (let x = 0; x < est.ancho; x++) {
          const c = est.casillas[y][x];
          if (c.region === rg.id && !c.est && TERRENOS[c.t].mov > 0 && !unidadEn(est, x, y) && !ciudadesDe(est, 0).concat(ciudadesDe(est, 1)).some(ci => dist(ci, { x, y }) <= 2)) lib.push({ x, y });
        }
        if (lib.length) {
          const p = elegirDe(est, lib);
          nuevaUnidad(est, -1, "salvaje", p.x, p.y, null, { nombre: "Criatura errante", fuerza: 0, errante: true });
          reg(est, `Algo se desprende en ${rg.nombre}: aparece una criatura.`, "suceso");
          crono(est, "suceso", { region: rg.nombre, que: "criatura" });
        }
      } else if (tipoS === "costura" && est.costuras.length) {
        if (tipo.costurasMueven) {
          const i = ri(est, est.costuras.length);
          const r = { s: est.rs };
          const movida = M.moverCostura(est, r, i, (x, y) => !!unidadEn(est, x, y));
          est.rs = r.s;
          if (movida) {
            reg(est, "Una costura entre fragmentos cambia de sitio.", "suceso");
            crono(est, "suceso", { region: rg.nombre, que: "costura" });
          }
        }
      } else if (tipoS === "terreno") {
        const cand = [];
        for (let y = 0; y < est.alto; y++) for (let x = 0; x < est.ancho; x++) {
          const c = est.casillas[y][x];
          if (c.region === rg.id && !c.est && TERRENOS[c.t].mov > 0 && !unidadEn(est, x, y)) cand.push({ x, y });
        }
        if (cand.length) {
          const p = elegirDe(est, cand);
          const nuevo = elegirDe(est, ["llanura", "bosque", "magica", "huesos", "desierto"]);
          est.casillas[p.y][p.x].t = nuevo;
          reg(est, `En ${rg.nombre} el terreno cambia: ahora hay ${TERRENOS[nuevo].nombre.toLowerCase()}.`, "suceso");
        }
      } else if (tipoS === "recurso") {
        const j = ri(est, 2);
        if (rg.dueno === null) { /* sin dueño nadie se lleva nada */ } else {
          sumar(est.jugadores[rg.dueno], rn(est) < 0.5 ? "mana" : "anima", 2);
          reg(est, `Un resto del fragmento ${rg.nombre} cae en manos de ${est.jugadores[rg.dueno].nombre}.`, "suceso");
        }
        void j;
      }
    });
    if (tipo.crece && rn(est) < 0.5) {
      const cand = [];
      for (let y = 0; y < est.alto; y++) for (let x = 0; x < est.ancho; x++) {
        const c = est.casillas[y][x];
        if (c.t === "llanura" && !c.est && !unidadEn(est, x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => dentro(est, x + dx, y + dy) && est.casillas[y + dy][x + dx].t === "bosque")) cand.push({ x, y });
      }
      if (cand.length) { const p = elegirDe(est, cand); est.casillas[p.y][p.x].t = "bosque"; }
    }
    if (tipo.reviven) {
      est.pendientes = est.pendientes.filter(p => {
        if (!unidadEn(est, p.x, p.y) && TERRENOS[est.casillas[p.y][p.x].t].mov > 0) {
          nuevaUnidad(est, -1, "salvaje", p.x, p.y, null, { nombre: "Caído que no descansa", fuerza: 0, errante: true });
          reg(est, "Un caído se levanta en el Sueño de los Muertos.", "suceso");
        }
        return false;
      });
    }
    // Las costuras de los mapas inestables cambian de sitio cada pocas rondas
    if (tipo.costurasMueven && est.turno % 6 === 0 && est.costuras.length) {
      const i = ri(est, est.costuras.length);
      const r = { s: est.rs };
      if (M.moverCostura(est, r, i, (x, y) => !!unidadEn(est, x, y))) reg(est, "Las costuras entre fragmentos se desplazan.", "suceso");
      est.rs = r.s;
    }
    actualizarRegiones(est);
  }

  function turnoSalvajes(est) {
    Object.values(est.unidades).filter(u => u.dueno === -1).forEach(u => {
      const e = ef(est, u);
      const objetivos = Object.values(est.unidades).filter(w => w.dueno >= 0 && dist(u, w) <= e.alc);
      if (objetivos.length) {
        objetivos.sort((a, b) => a.hp - b.hp);
        atacarUnidad(est, u, objetivos[0], true);
        return;
      }
      if (u.errante) {
        const cerca = Object.values(est.unidades).filter(w => w.dueno >= 0 && dist(u, w) <= 4).sort((a, b) => dist(u, a) - dist(u, b))[0];
        if (cerca) {
          let mejor = null;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const x = u.x + dx, y = u.y + dy;
            if ((!dx && !dy) || !dentro(est, x, y) || TERRENOS[est.casillas[y][x].t].mov === 0 || unidadEn(est, x, y) || est.casillas[y][x].est === "ciudad") continue;
            const d = dist({ x, y }, cerca);
            if (!mejor || d < mejor.d) mejor = { x, y, d };
          }
          if (mejor && mejor.d < dist(u, cerca)) { u.x = mejor.x; u.y = mejor.y; }
        }
      }
    });
  }

  /* --- Combate --- */
  function defensaDelTerreno(est, u) {
    const c = est.casillas[u.y][u.x];
    let d = TERRENOS[c.t].def;
    if (c.est) d += ESTRUCTURAS[c.est].def;
    const ciudad = ciudadEn(est, u.x, u.y);
    if (ciudad && ciudad.dueno === u.dueno) {
      if (ciudad.capital) d += 1;
      if (ciudad.edificios.includes("herreria") && !(ciudad.desh.herreria >= est.turno)) d += 1;
      if (ciudad.edificios.includes("fortaleza") && !(ciudad.desh.fortaleza >= est.turno)) d += 2 + ((u.dueno >= 0 && FACCIONES[est.jugadores[u.dueno].faccion].mods.fortalezaDef) || 0);
    }
    return d;
  }

  function enCiudadOFortaleza(est, u) { const c = est.casillas[u.y][u.x]; return c.est === "ciudad" || c.est === "fortaleza"; }

  function calcularDano(est, a, d) {
    const EA = ef(est, a), ED = ef(est, d);
    const jugA = a.dueno >= 0 ? est.jugadores[a.dueno] : null;
    const facA = jugA ? FACCIONES[jugA.faccion] : null;
    let A = EA.atq;
    const sa = a.s;
    const solo = vecinosAliados(est, d).length === 0;
    if (a.clase === "cazador" && est.casillas[a.y][a.x].t === "bosque") A += 1;
    if (a.clase === "picaro" && solo) A += Math.ceil(A / 2);
    if (a.clase === "caballero" && (a.recorrido || 0) >= 2) A += 2;
    if (sa && sa.spec === "duelista" && solo) A += 2;
    if (sa && sa.spec === "rompelineas" && (enCiudadOFortaleza(est, d) || ED.def >= 3)) A += 2;
    if (a.clase === "ballestero" && (esMonstruo(est, d) || ED.def >= 3)) A += 2;
    if (facA && esMonstruo(est, d) && facA.mods.atqMonstruo) A += facA.mods.atqMonstruo;
    if (facA && a.lider && !jugA.liderMuerto && esMonstruo(est, d) && facA.lider.aura.atqMonstruo) A += facA.lider.aura.atqMonstruo;
    if (sa) { const eq = bonoReliquias(est, a); if (esMonstruo(est, d)) A += eq.atqMonstruo || 0; }
    if (jugA && jugA.tech.tanato >= 1 && d.hp < ED.hpMax) A += 1;
    if (a.dueno === -1) A += (a.fuerza || 0);
    let Df = ED.def + defensaDelTerreno(est, d);
    let dmg = Math.max(1, A + 1 - Math.floor(Df / 2));
    if (vecinosAliados(est, d).some(w => w.clase === "guerrero")) dmg = Math.max(1, dmg - 1);
    return dmg;
  }

  function aplicarDano(est, objetivo, dmg, por) {
    if (objetivo.hp - dmg <= 0 && objetivo.s && !objetivo.voluntadUsada && rn(est) < S.probVoluntad(objetivo.s)) {
      objetivo.hp = 1;
      objetivo.voluntadUsada = true;
      objetivo.s.cicatrices = (objetivo.s.cicatrices || 0) + 1;
      reg(est, `${nombreUnidad(objetivo)} debería haber caído y sigue en pie con lo último que le queda.`, "heroico");
      crono(est, "heroico", { soldado: objetivo.s.id, nombre: nombreUnidad(objetivo), region: regionDeCasilla(est, objetivo.x, objetivo.y).nombre, por: por ? nombreUnidad(por) : null });
      return false;
    }
    objetivo.hp -= dmg;
    if (objetivo.hp <= 0) { matar(est, objetivo, por); return true; }
    return false;
  }

  function atacarUnidad(est, a, d, sinRetorno) {
    const dmg = calcularDano(est, a, d);
    const distancia = dist(a, d);
    reg(est, `${nombreUnidad(a)} golpea a ${nombreUnidad(d)} por ${dmg}.`, "combate");
    est.ev.push({ k: "golpe", de: a.uid, a: d.uid, x: d.x, y: d.y, dmg, dist: distancia });
    d.descanso = false;
    const murio = aplicarDano(est, d, dmg, a);
    // Daño en área de los arcanistas
    if (a.clase === "arcanista" || a.clase === "archimago") {
      const jug = a.dueno >= 0 ? est.jugadores[a.dueno] : null;
      const frac = jug && jug.tech.arcano >= 2 ? 0.75 : 0.5;
      const vec = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const w = unidadEn(est, d.x + dx, d.y + dy);
        if (w && w !== d && w.dueno !== a.dueno && w.dueno !== undefined && (dx || dy)) vec.push(w);
      }
      if (!murio || true) vec.forEach(w => { const sp = Math.max(1, Math.floor(dmg * frac)); if (est.unidades[w.uid]) { aplicarDano(est, w, sp, a); } });
      if (jug && jug.tech.arcano >= 2 && est.unidades[d.uid]) d.efectos.frenado = est.turno + 1;
    }
    if (!sinRetorno && !murio && est.unidades[d.uid] && distancia <= ef(est, d).alc && est.unidades[a.uid] && CLASES[d.clase].atq > 1) {
      const r = Math.max(1, Math.ceil(calcularDano(est, d, a) * 0.6));
      reg(est, `${nombreUnidad(d)} responde por ${r}.`, "combate");
      est.ev.push({ k: "golpe", de: d.uid, a: a.uid, x: a.x, y: a.y, dmg: r, dist: distancia });
      a.descanso = false;
      aplicarDano(est, a, r, d);
    }
    return murio;
  }

  function soltarReliquia(est, u) {
    if (!u.s) return;
    Object.keys(u.s.equipo || {}).forEach(slot => {
      const id = u.s.equipo[slot];
      const inst = est.reliquias[id];
      if (!inst) return;
      est.casillas[u.y][u.x].objetos.push(id);
      inst.propietarios.push({ nombre: nombreUnidad(u), hasta: est.anio, cae: true });
      reg(est, `${inst.nombre} queda en el suelo.`, "reliquia");
    });
    u.s.equipo = {};
  }

  function matar(est, u, por) {
    if (!est.unidades[u.uid]) return;
    const dueno = u.dueno;
    const reg0 = regionDeCasilla(est, u.x, u.y);
    delete est.unidades[u.uid];
    est.ev.push({ k: "muerte", uid: u.uid, x: u.x, y: u.y });
    if (u.s) {
      soltarReliquia(est, u);
      const causa = por ? nombreUnidad(por) : "la Fractura";
      u.s.muerte = { anio: est.anio, lugar: reg0.nombre, causa, por: por && por.s ? por.s.id : null, turno: est.turno };
      est.tumbas.push({ x: u.x, y: u.y, s: JSON.parse(JSON.stringify(u.s)), dueno, clase: u.clase, turno: est.turno });
      est.caidos = est.caidos || [];
      est.caidos.push({ dueno, s: JSON.parse(JSON.stringify(u.s)), por: por ? { uid: por.uid, nombre: nombreUnidad(por), dueno: por.dueno, sId: por.s ? por.s.id : null, rango: por.s ? S.rangoDe(por.s.victorias + (por.vicG || 0)).nombre : null, clase: por.clase, faccion: por.dueno >= 0 ? est.jugadores[por.dueno].faccion : null } : null,
        turno: est.turno, region: reg0.nombre, x: u.x, y: u.y, capitan: !!u.s.capitan, rangoIdx: S.rangoIndice(u.s.victorias + (u.vicG || 0)), vicG: u.vicG || 0 });
    }
    if (dueno >= 0) est.stats.bajas[dueno]++;
    reg(est, `${nombreUnidad(u)} cae${por ? ` ante ${nombreUnidad(por)}` : ""}.`, "muerte");
    // Quien mata gana experiencia y el bando enemigo se lleva el Ánima
    if (por && por.dueno >= 0) {
      por.vicG = (por.vicG || 0) + 1;
      por.bajasG = (por.bajasG || 0) + 1;
      const jp = est.jugadores[por.dueno];
      const facP = FACCIONES[jp.faccion];
      let anima = (facP.mods.anima_baja || 0) + (jp.tech.tanato >= 2 ? 2 : 0);
      const oficial = u.lider || (u.s && (u.s.capitan || S.rangoIndice(u.s.victorias + (u.vicG || 0)) >= 2));
      if (oficial) { por.vicG += 1; est.stats.oficiales[por.dueno]++; if (por.s) por.s.oficiales = (por.s.oficiales || 0) + 1; }
      if (anima) sumar(jp, "anima", anima);
      if (u.dueno === -1 && u.guardia) { /* el botín de la guardia está en la casilla */ }
    }
    if (u.dueno >= 0 && u.s) {
      const importante = u.s.capitan || u.vicG > 0 || S.rangoIndice(u.s.victorias + (u.vicG || 0)) >= 1;
      if (importante) crono(est, "caida", { soldado: u.s.id, nombre: nombreUnidad(u), dueno, region: reg0.nombre, por: por ? nombreUnidad(por) : null, porId: por && por.s ? por.s.id : null, capitan: !!u.s.capitan, victorias: u.s.victorias + (u.vicG || 0), compania: u.s.compania, x: u.x, y: u.y });
    }
    if (u.lider) {
      const jug = est.jugadores[dueno];
      jug.liderMuerto = true;
      const fac = FACCIONES[jug.faccion];
      reg(est, `${u.nombre} ha caído. ${fac.lider.estado.nombre}.`, "lider");
      crono(est, "lider", { nombre: u.nombre, dueno, region: reg0.nombre, estado: fac.lider.estado.nombre, por: por ? nombreUnidad(por) : null });
    }
    if (u.s && u.s.capitan && u.s.compania) {
      unidadesDe(est, dueno).forEach(w => { if (w.s && w.s.compania === u.s.compania) w.efectos.sinMando = est.turno + 3; });
      reg(est, `La compañía ${["", "I", "II", "III"][u.s.compania] || u.s.compania} se queda sin capitán.`, "compania");
    }
    if (TIPOS_FRACTURA[est.tipo].reviven && u.s && rn(est) < 0.2) est.pendientes.push({ x: u.x, y: u.y });
    if (u.dueno === -1 && u.fuerza !== undefined) {
      // El guardián deja sus cosas atrás: se recogen al pisar la casilla
      const c = est.casillas[u.y][u.x];
      if (c.est === "ruinas" || c.est === "fortaleza") c.guardia = false;
    }
    comprobarVictoria(est);
  }

  /* --- Movimiento --- */
  function alcanzables(est, u) {
    const jug = u.dueno >= 0 ? est.jugadores[u.dueno] : null;
    const exento = u.clase === "picaro" || u.clase === "cazador";
    const mapa = new Map();
    const inicio = clave(u.x, u.y);
    mapa.set(inicio, { c: 0, p: null, x: u.x, y: u.y });
    const abiertos = [inicio];
    const pegado = !exento && vecinosEnemigos(est, u).length > 0;
    const eq = bonoReliquias(est, u);
    while (abiertos.length) {
      abiertos.sort((a, b) => mapa.get(a).c - mapa.get(b).c);
      const k = abiertos.shift();
      const nodo = mapa.get(k);
      if (nodo.hecho) continue;
      nodo.hecho = true;
      if (pegado && k !== inicio) continue;
      const vecinos = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) vecinos.push({ x: nodo.x + dx, y: nodo.y + dy, tipo: "paso" });
      const cs = casilla(est, nodo.x, nodo.y);
      if (cs && cs.est === "costura" && cs.costura !== undefined) {
        const par = est.costuras[cs.costura];
        const otro = par.a.x === nodo.x && par.a.y === nodo.y ? par.b : par.a;
        vecinos.push({ x: otro.x, y: otro.y, tipo: "costura" });
      }
      vecinos.forEach(v => {
        if (!dentro(est, v.x, v.y)) return;
        const ct = casilla(est, v.x, v.y);
        let costo = TERRENOS[ct.t].mov;
        if (costo === 0) return;
        if (v.tipo === "costura") costo = 1;
        else if (ct.t === "bosque" && eq.movBosque) costo = Math.max(1, costo - eq.movBosque);
        const ocupante = unidadEn(est, v.x, v.y);
        if (ocupante && ocupante.dueno !== u.dueno) return;
        const nc = nodo.c + costo;
        if (nc > u.pm) return;
        const kv = clave(v.x, v.y);
        const previo = mapa.get(kv);
        if (!previo || nc < previo.c) { mapa.set(kv, { c: nc, p: k, x: v.x, y: v.y, hecho: false }); abiertos.push(kv); }
      });
    }
    // Solo se puede terminar en casillas libres
    const destinos = new Map();
    mapa.forEach((nodo, k) => { if (k !== inicio && !unidadEn(est, nodo.x, nodo.y)) destinos.set(k, nodo); });
    void jug;
    return { mapa, destinos };
  }

  function camino(info, x, y) {
    const out = [];
    let k = clave(x, y);
    while (k) { const n = info.mapa.get(k); if (!n) break; out.unshift({ x: n.x, y: n.y }); k = n.p; }
    return out;
  }

  function entrarCasilla(est, u, x, y) {
    const c = est.casillas[y][x];
    // Reliquias en el suelo
    if (c.objetos.length && u.s) {
      c.objetos.splice(0).forEach(id => {
        const inst = est.reliquias[id];
        if (!inst) return;
        const slot = inst.slot;
        if (!u.s.equipo[slot]) {
          u.s.equipo[slot] = id;
          inst.propietarios.push({ nombre: nombreUnidad(u), desde: est.anio });
          reg(est, `${nombreUnidad(u)} recoge ${inst.nombre}.`, "reliquia");
        } else {
          est.jugadores[u.dueno].mochila.push(id);
          reg(est, `${nombreUnidad(u)} recoge ${inst.nombre} y la lleva al reliquiario.`, "reliquia");
        }
        crono(est, "reliquia", { nombre: nombreUnidad(u), reliquia: inst.nombre, dueno: u.dueno });
      });
    } else if (c.objetos.length && u.dueno >= 0) {
      c.objetos.splice(0).forEach(id => { est.jugadores[u.dueno].mochila.push(id); const inst = est.reliquias[id]; if (inst) reg(est, `Se recoge ${inst.nombre}.`, "reliquia"); });
    }
    if (u.dueno < 0) return;
    const jug = est.jugadores[u.dueno];
    // Ciudades y fortalezas: se capturan al entrar si nadie las guarda
    const ciudad = ciudadEn(est, x, y);
    if (ciudad && ciudad.dueno !== u.dueno) {
      const antes = ciudad.dueno;
      ciudad.dueno = u.dueno;
      Object.keys(ciudad.desh).forEach(k => delete ciudad.desh[k]);
      ciudad.edificios.forEach(id => { ciudad.desh[id] = est.turno + 2; });
      ciudad.reclutado = true;
      u.pm = 0;
      est.stats.ciudades[u.dueno]++;
      est.ev.push({ k: "captura", x, y, dueno: u.dueno });
      const rg = regionDeCasilla(est, x, y);
      reg(est, `${jug.nombre} conquista ${ciudad.nombre}${antes !== null ? " a " + est.jugadores[antes].nombre : ""}.`, "conquista");
      crono(est, "conquista", { ciudad: ciudad.nombre, region: rg.nombre, por: nombreUnidad(u), porId: u.s ? u.s.id : null, dueno: u.dueno, antes, capital: ciudad.capital });
      actualizarRegiones(est);
      if (ciudad.capital && antes !== null) { terminarGuerra(est, u.dueno, `${jug.nombre} toma la capital de ${est.jugadores[antes].nombre}.`); }
    }
    const fi = est.fortalezas.findIndex(p => p.x === x && p.y === y);
    if (fi >= 0 && est.fortalezasDueno[fi] !== u.dueno) {
      est.fortalezasDueno[fi] = u.dueno;
      est.ev.push({ k: "captura", x, y, dueno: u.dueno });
      u.pm = 0;
      reg(est, `${jug.nombre} toma la fortaleza de ${regionDeCasilla(est, x, y).nombre}.`, "conquista");
      crono(est, "fortaleza", { region: regionDeCasilla(est, x, y).nombre, por: nombreUnidad(u), dueno: u.dueno });
      actualizarRegiones(est);
    }
    if (c.est === "ruinas" && !c.saqueada) saquear(est, u, x, y);
  }

  function reliquiaNueva(est, origen) {
    const usadas = new Set(Object.values(est.reliquias).map(r => r.def));
    const libres = Object.keys(RELIQUIAS).filter(k => !usadas.has(k));
    if (!libres.length) return null;
    const def = elegirDe(est, libres);
    const d = RELIQUIAS[def];
    const id = `r${Math.floor(rn(est) * 1e9).toString(36)}`;
    est.reliquias[id] = { id, def, nombre: d.nombre, slot: d.slot, bono: d.bono, texto: d.texto, origen, propietarios: [] };
    return est.reliquias[id];
  }

  function saquear(est, u, x, y) {
    const c = est.casillas[y][x];
    c.saqueada = true;
    const jug = est.jugadores[u.dueno];
    const t = rn(est);
    const tipo = TIPOS_FRACTURA[est.tipo];
    const pRel = tipo.reliquias ? 0.5 : 0.28;
    if (t < pRel) {
      const inst = reliquiaNueva(est, `Hallada en las ruinas de ${regionDeCasilla(est, x, y).nombre}`);
      if (inst) {
        if (u.s && !u.s.equipo[inst.slot]) { u.s.equipo[inst.slot] = inst.id; inst.propietarios.push({ nombre: nombreUnidad(u), desde: est.anio }); }
        else jug.mochila.push(inst.id);
        reg(est, `${nombreUnidad(u)} encuentra ${inst.nombre} entre las ruinas.`, "reliquia");
        crono(est, "reliquia", { nombre: nombreUnidad(u), reliquia: inst.nombre, dueno: u.dueno, region: regionDeCasilla(est, x, y).nombre });
        return;
      }
    }
    if (t < 0.7) {
      const k1 = elegirDe(est, ["comida", "materiales", "mineral", "oro"]);
      const n = 3 + ri(est, 3);
      sumar(jug, k1, n);
      reg(est, `Las ruinas guardaban ${n} de ${D.RECURSO_NOMBRE[k1].toLowerCase()}.`, "botin");
    } else if (t < 0.85) {
      sumar(jug, "mana", 5); sumar(jug, "anima", 2);
      reg(est, "Las ruinas desprenden un resto de magia: +5 de maná y +2 de Ánima.", "botin");
    } else if (jug.humano !== undefined && unidadesDe(est, u.dueno).length < MAX_UNIDADES) {
      const lib = casillaLibreCerca(est, { x, y }, u.dueno);
      if (lib) {
        const fac = FACCIONES[jug.faccion];
        const r = { s: est.rs };
        const s = S.crearSoldado(r, { clase: elegirDe(est, ["guerrero", "cazador", "picaro"]), cultura: fac.cultura, origen: "eco", anio: est.anio });
        est.rs = r.s;
        nuevaUnidad(est, u.dueno, s.clase, lib.x, lib.y, s).pm = 0;
        reg(est, `De las ruinas sale ${S.nombreCompleto(s)}, un eco que se une a ${jug.nombre}.`, "botin");
      } else sumar(jug, "oro", 5);
    } else sumar(jug, "oro", 5);
  }

  /* --- Victoria --- */
  function puntuacion(est, j) {
    const ciudades = ciudadesDe(est, j).length;
    const fort = est.fortalezasDueno.filter(d => d === j).length;
    const regiones = est.regiones.filter(r => r.dueno === j).length;
    return ciudades * 3 + fort * 2 + regiones * 2 + est.stats.bajas[1 - j] + est.stats.oficiales[j] * 2 + est.nucleoHold[j];
  }

  function terminarGuerra(est, ganador, razon) {
    if (est.ganador !== null) return;
    est.ganador = ganador;
    est.razon = razon;
    reg(est, razon, "fin");
    crono(est, "fin", { ganador, razon });
  }

  function comprobarVictoria(est) {
    if (est.ganador !== null) return;
    for (let j = 0; j < 2; j++) {
      if (!unidadesDe(est, j).length && !ciudadesDe(est, j).length) terminarGuerra(est, 1 - j, `${est.jugadores[j].nombre} se queda sin tropas ni ciudades.`);
    }
    if (est.ganador === null) {
      for (let j = 0; j < 2; j++) {
        if (est.nucleoHold[j] >= est.hold) terminarGuerra(est, j, `${est.jugadores[j].nombre} impone su influencia sobre el Núcleo del Sueño.`);
      }
    }
  }

  /* --- Acciones --- */
  function error(texto) { return { ok: false, error: texto }; }

  function aplicar(est, acc) {
    est.ev = [];
    if (est.ganador !== null) return error("La guerra ya terminó.");
    const j = est.activo;
    const jug = est.jugadores[j];
    switch (acc.t) {
      case "mover": {
        const u = est.unidades[acc.uid];
        if (!u || u.dueno !== j) return error("Esa unidad no es tuya.");
        const info = alcanzables(est, u);
        const k = clave(acc.x, acc.y);
        const destino = info.destinos.get(k);
        if (!destino) return error("No puede llegar ahí.");
        const ruta = camino(info, acc.x, acc.y);
        const de = { x: u.x, y: u.y };
        u.pm -= destino.c;
        u.recorrido = (u.recorrido || 0) + ruta.length - 1;
        u.x = acc.x; u.y = acc.y; u.quieto = false; u.descanso = false;
        est.ev.push({ k: "mov", uid: u.uid, de, a: { x: u.x, y: u.y }, ruta });
        entrarCasilla(est, u, u.x, u.y);
        actualizarVision(est, j);
        comprobarVictoria(est);
        return { ok: true, ev: est.ev };
      }
      case "atacar": {
        const u = est.unidades[acc.uid];
        if (!u || u.dueno !== j) return error("Esa unidad no es tuya.");
        if (u.atacado) return error("Ya atacó este turno.");
        if (u.clase === "sanador") return error("Los sanadores no atacan.");
        const t = unidadEn(est, acc.x, acc.y);
        if (!t || t.dueno === j) return error("No hay un enemigo ahí.");
        const e = ef(est, u);
        const d = dist(u, t);
        if (d < 1 || d > e.alc) return error("Está fuera de alcance.");
        const pmAntes = u.pm;
        u.atacado = true; u.quieto = false; u.descanso = false;
        atacarUnidad(est, u, t, false);
        if (est.unidades[u.uid]) {
          u.pm = u.clase === "cazador" ? Math.min(pmAntes, 2) : 0;
          actualizarVision(est, j);
        }
        comprobarVictoria(est);
        return { ok: true, ev: est.ev };
      }
      case "reclutar": {
        const razon = razonNoReclutar(est, j, acc.ciudad, acc.clase);
        if (razon) return error(razon);
        const ciudad = est.ciudades[acc.ciudad];
        const coste = costeReclutar(est, j, acc.clase, ciudad);
        pagar(jug, coste);
        const p = casillaLibreCerca(est, ciudad, j);
        const fac = FACCIONES[jug.faccion];
        const r = { s: est.rs };
        const s = S.crearSoldado(r, { clase: acc.clase, cultura: fac.cultura, origen: elegirDe(est, fac.origenes), anio: est.anio });
        est.rs = r.s;
        if (ciudad.edificios.includes("academia_militar")) s.victorias += 3;
        const u = nuevaUnidad(est, j, s.clase, p.x, p.y, s, { nuevo: true });
        if (ciudad.edificios.includes("arsenal")) u.bonoEq = { atq: 1 };
        u.pm = 0; u.atacado = true;
        est.ev.push({ k: "nuevo", uid: u.uid, x: u.x, y: u.y });
        ciudad.reclutado = true;
        reg(est, `${jug.nombre} recluta a ${S.nombreCompleto(s)}, ${CLASES[s.clase].nombre.toLowerCase()}.`, "recluta");
        actualizarVision(est, j);
        return { ok: true, ev: est.ev, uid: u.uid };
      }
      case "construir": {
        const razon = razonNoConstruir(est, j, acc.ciudad, acc.edificio);
        if (razon) return error(razon);
        const ciudad = est.ciudades[acc.ciudad];
        pagar(jug, EDIFICIOS[acc.edificio].coste);
        ciudad.edificios.push(acc.edificio);
        reg(est, `${jug.nombre} construye ${EDIFICIOS[acc.edificio].nombre} en ${ciudad.nombre}.`, "obra");
        return { ok: true, ev: est.ev };
      }
      case "mejorar": {
        const ciudad = est.ciudades[acc.ciudad];
        if (!ciudad || ciudad.dueno !== j) return error("Esa ciudad no es tuya.");
        if (ciudad.nivel >= 5) return error("Ya está al máximo.");
        const coste = { materiales: 4 * ciudad.nivel, oro: 3 * ciudad.nivel };
        if (!puedePagar(jug, coste)) return error("No te alcanzan los recursos.");
        pagar(jug, coste);
        ciudad.nivel += 1;
        reg(est, `${ciudad.nombre} crece hasta el nivel ${ciudad.nivel}.`, "obra");
        return { ok: true, ev: est.ev };
      }
      case "investigar": {
        const razon = razonNoInvestigar(est, j, acc.escuela);
        if (razon) return error(razon);
        const coste = costeInvestigar(est, j, acc.escuela);
        pagar(jug, coste);
        jug.tech[acc.escuela] += 1;
        const esc = ESCUELAS[acc.escuela].escalones[jug.tech[acc.escuela] - 1];
        reg(est, `${jug.nombre} domina ${esc.nombre} (${ESCUELAS[acc.escuela].nombre}).`, "tecnologia");
        crono(est, "tecnologia", { dueno: j, escuela: ESCUELAS[acc.escuela].nombre, nombre: esc.nombre });
        return { ok: true, ev: est.ev };
      }
      case "habilidad": return habilidad(est, j, acc);
      case "terminar": terminarTurno(est); return { ok: true, ev: est.ev };
      default: return error("Acción desconocida.");
    }
  }

  /* --- Habilidades especiales --- */
  function habilidad(est, j, acc) {
    const jug = est.jugadores[j];
    const u = est.unidades[acc.uid];
    if (!u || u.dueno !== j) return error("Esa unidad no es tuya.");
    if (acc.id === "alterar") {
      if (!(u.clase === "arcanista" || u.clase === "archimago") || jug.tech.arcano < 3) return error("Hace falta Transmutación.");
      if (u.atacado || u.enfriar > 0) return error("Todavía no puede.");
      if (!puedePagar(jug, { mana: 3 })) return error("Hacen falta 3 de maná.");
      const c = casilla(est, acc.x, acc.y);
      const e = ef(est, u);
      if (!c || c.est || unidadEn(est, acc.x, acc.y) || dist(u, acc) > e.alc || !["llanura", "bosque", "desierto"].includes(acc.a) || TERRENOS[c.t].mov === 0) return error("No se puede cambiar esa casilla.");
      pagar(jug, { mana: 3 });
      c.t = acc.a;
      u.atacado = true; u.pm = 0; u.enfriar = 2;
      reg(est, `${nombreUnidad(u)} cambia el terreno a ${TERRENOS[acc.a].nombre.toLowerCase()}.`, "magia");
      return { ok: true, ev: est.ev };
    }
    if (acc.id === "sabotear") {
      if (u.clase !== "picaro") return error("Solo los pícaros sabotean.");
      if (u.atacado) return error("Ya actuó este turno.");
      const ciudad = ciudadEn(est, acc.x, acc.y);
      if (!ciudad || ciudad.dueno !== 1 - j || dist(u, ciudad) > 1) return error("Tiene que estar junto a una ciudad enemiga.");
      if (!ciudad.edificios.includes(acc.edificio)) return error("Esa ciudad no tiene eso.");
      ciudad.desh[acc.edificio] = est.turno + 3;
      u.atacado = true; u.pm = 0;
      reg(est, `${nombreUnidad(u)} sabotea ${EDIFICIOS[acc.edificio].nombre} en ${ciudad.nombre}.`, "sabotaje");
      crono(est, "sabotaje", { por: nombreUnidad(u), ciudad: ciudad.nombre, edificio: EDIFICIOS[acc.edificio].nombre, dueno: j });
      return { ok: true, ev: est.ev };
    }
    if (acc.id === "reanimar") {
      if (jug.tech.tanato < 3) return error("Hace falta Reanimación.");
      if (u.atacado) return error("Ya actuó este turno.");
      if (!puedePagar(jug, { anima: 3 })) return error("Hacen falta 3 de Ánima.");
      const i = est.tumbas.findIndex(t => t.x === acc.x && t.y === acc.y);
      if (i < 0 || dist(u, acc) > 1) return error("No hay nadie que levantar ahí.");
      if (unidadEn(est, acc.x, acc.y)) return error("La casilla está ocupada.");
      if (unidadesDe(est, j).length >= MAX_UNIDADES) return error("Ya tienes el máximo de unidades.");
      const t = est.tumbas.splice(i, 1)[0];
      pagar(jug, { anima: 3 });
      const s = t.s;
      s.reanimado = true; s.muerte = null; s.equipo = {};
      const n = nuevaUnidad(est, j, t.clase, acc.x, acc.y, s);
      n.hp = Math.max(1, Math.floor(ef(est, n).hpMax / 2)); n.pm = 0; n.atacado = true;
      est.ev.push({ k: "nuevo", uid: n.uid, x: n.x, y: n.y });
      u.atacado = true; u.pm = 0;
      reg(est, `${nombreCompleto0(s)} se levanta de nuevo al servicio de ${jug.nombre}.`, "magia");
      crono(est, "reanimacion", { nombre: S.nombreConApodo(s), dueno: j });
      actualizarVision(est, j);
      return { ok: true, ev: est.ev };
    }
    return error("Habilidad desconocida.");
  }
  const nombreCompleto0 = S.nombreConApodo;

  /* --- Edificios e investigación --- */
  function terrenoCerca(est, ciudad, tipos) {
    const r = ciudad.nivel >= 3 ? 2 : 1;
    for (let y = ciudad.y - r; y <= ciudad.y + r; y++) for (let x = ciudad.x - r; x <= ciudad.x + r; x++) {
      if (dentro(est, x, y) && tipos.includes(est.casillas[y][x].t)) return true;
    }
    return false;
  }

  function razonNoConstruir(est, j, ciudadId, id) {
    const jug = est.jugadores[j];
    const ciudad = est.ciudades[ciudadId];
    const ed = EDIFICIOS[id];
    if (!ciudad || ciudad.dueno !== j) return "Esa ciudad no es tuya.";
    if (est.activo !== j) return "No es tu turno.";
    if (!ed) return "Ese edificio no existe.";
    if (ciudad.edificios.includes(id)) return "Ya está construido.";
    if (ciudad.edificios.length >= ciudad.nivel + 2) return "La ciudad no tiene más huecos. Hazla crecer.";
    if (ed.previo && !ed.previo.some(p => ciudad.edificios.includes(p))) return `Hace falta antes: ${ed.previo.map(p => EDIFICIOS[p].nombre).join(" o ")}.`;
    if (ed.terreno && !terrenoCerca(est, ciudad, ed.terreno)) return "No hay terreno adecuado cerca.";
    if (ed.nivel >= 3 && ciudad.edificios.some(o => EDIFICIOS[o].nivel >= 3 && EDIFICIOS[o].rama !== ed.rama)) return "La ciudad ya se especializó en otra rama.";
    if (!puedePagar(jug, ed.coste)) return "No te alcanzan los recursos.";
    return null;
  }

  function costeInvestigar(est, j, escuela) {
    const jug = est.jugadores[j];
    const fac = FACCIONES[jug.faccion];
    const esc = ESCUELAS[escuela];
    const n = jug.tech[escuela];
    const base = esc.escalones[n].coste;
    const c = Object.assign({}, base);
    let m = (fac.mods.investigarMana || 1);
    if (jug.liderMuerto && fac.lider.estado && fac.lider.estado.investigarMana) m *= fac.lider.estado.investigarMana;
    c.mana = Math.max(1, Math.round(c.mana * m));
    if (tieneEdificio(est, j, "biblioteca")) c.mana = Math.max(1, c.mana - (n + 1));
    return c;
  }

  function razonNoInvestigar(est, j, escuela) {
    const jug = est.jugadores[j];
    if (est.activo !== j) return "No es tu turno.";
    if (!ESCUELAS[escuela]) return "Esa escuela no existe.";
    if (jug.tech[escuela] >= 4) return "Ya dominas toda la escuela.";
    if (!puedePagar(jug, costeInvestigar(est, j, escuela))) return "No te alcanzan los recursos.";
    return null;
  }

  /* --- Fin de turno --- */
  function terminarTurno(est) {
    const j = est.activo;
    const jug = est.jugadores[j];
    // Núcleo del Sueño
    const n = est.nucleo;
    const ocupante = unidadEn(est, n.x, n.y);
    if (ocupante && ocupante.dueno === j) {
      est.nucleoHold[j] += 1;
      est.nucleoHold[1 - j] = 0;
      if (est.nucleoHold[j] === 1) { reg(est, `${jug.nombre} toma posición sobre el Núcleo del Sueño.`, "nucleo"); crono(est, "nucleo", { dueno: j, region: regionDeCasilla(est, n.x, n.y).nombre }); }
    } else if (!ocupante || ocupante.dueno !== j) est.nucleoHold[j] = 0;
    // Luto: va bajando con cada guerra, no con cada turno
    est.primerTurno = false;
    comprobarVictoria(est);
    if (est.ganador !== null) return;
    est.activo = 1 - j;
    if (est.activo === 0) {
      est.turno += 1;
      if (est.turno > est.maxTurnos) {
        const p0 = puntuacion(est, 0), p1 = puntuacion(est, 1);
        terminarGuerra(est, p0 === p1 ? "empate" : p0 > p1 ? 0 : 1, p0 === p1 ? "Se acaba el tiempo y las dos fuerzas quedan igualadas." : `Se acaba el tiempo y ${est.jugadores[p0 > p1 ? 0 : 1].nombre} gana por puntos.`);
        return;
      }
      nuevaRonda(est);
    }
    // Las criaturas sin dueño actúan antes de que juegue el primero de cada ronda
    if (est.activo === 0) turnoSalvajes(est);
    comprobarVictoria(est);
    if (est.ganador !== null) return;
    iniciarTurno(est, est.activo, false);
  }

  raiz.FracturaMotor = {
    MAX_UNIDADES, rn, ri, clave, dentro, casilla, unidadEn, unidadesDe, ciudadEn, ciudadesDe, esMonstruo, nombreUnidad, regionDeCasilla, reg, crono,
    ef, auras, calcularDano, defensaDelTerreno, alcanzables, camino, aplicar, crearGuerra, puntuacion, ingresoDe, mantenimiento,
    costeReclutar, clasesDisponibles, razonNoReclutar, razonNoConstruir, razonNoInvestigar, costeInvestigar, puedePagar, tieneEdificio, vecinosEnemigos, vecinosAliados,
    veCasilla, actualizarVision, reliquiaNueva, nuevaUnidad, casillaLibreCerca, terminarTurno, bonoReliquias, generarContingenteIA, terminarGuerra, matar, terrenoCerca
  };
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.FracturaMotor;
})(typeof window !== "undefined" ? window : globalThis);
