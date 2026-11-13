/* =============================================================================
   LA FRACTURA: motor de reglas. Es puro y determinista: el estado entero (est) es un objeto simple
   que se puede guardar en JSON y volver a cargar, y todo azar sale de est.rs, así que la misma
   semilla y las mismas acciones dan siempre la misma guerra (hace falta para jugar contra otros).

   Movimiento en 8 direcciones. De 2 a 8 bandos por turnos, todos contra todos o por equipos. Quien
   pierde su capital queda eliminado (salvo que tenga un Refugio). Gana el último equipo en pie, quien
   retenga el Núcleo del Sueño unos turnos seguidos o quien tenga más puntos al acabar el tiempo.
   Lo que se guarda de cada soldado entre guerras lo decide fractura-campana.js.
   Se usa igual en el navegador y en Node.
============================================================================= */
(function (raiz) {
  const D = raiz.FRACTURA_DATOS || (typeof require !== "undefined" ? require("./fractura-datos.js") : null);
  const S = raiz.FracturaSoldados || (typeof require !== "undefined" ? require("./fractura-soldados.js") : null);
  const M = raiz.FracturaMapa || (typeof require !== "undefined" ? require("./fractura-mapa.js") : null);
  const { TERRENOS, ESTRUCTURAS, CLASES, ESPECIALIZACIONES, EDIFICIOS, ESCUELAS, RELIQUIAS, FACCIONES, TIPOS_FRACTURA, DIFICULTADES, RECURSOS, HEROES } = D;
  const dist = M.dist;
  const MAX_UNIDADES = 18;
  const NOMBRES_CIUDAD = ["La Quebrada", "Paso del Cuervo", "Vado Gris", "Cerro Hueco", "Torrequemada", "Puerto Seco", "Villar de Abajo", "Los Tres Pozos", "Campo Largo", "Los Tejares",
    "El Altillo", "Peña Roja", "Los Hornos", "La Última Posada", "Rincón de la Hoz", "Mesa Rota", "Llano Hondo", "Embarcadero Viejo", "El Telar", "Hoya Oscura"];
  const CAPITALES = { "caballeros-del-reino": "La Plaza del Reino", "academia-arcana-de-dolbred": "El Claustro Arcano", "trono-de-ceniza": "El Osario Mayor",
    "compania-dorada": "El Campamento Dorado", "hijos-del-acero": "El Fuerte del Acero", "santos-de-asmodeo": "La Catedral de la Vigilia", nikaalia: "Umbrathil",
    seosan: "Kaishoto", okran: "Vornhaal", pelgiria: "Cala Ronca", mravec: "Zaphara", nernib: "La Ciudadela de Nernib", balutia: "El Foro de Balutia" };
  // Qué rasgo deja cada clase a quien la devora (Mravec)
  const RASGO_DE = { guerrero: "hp", esqueleto: "hp", mercenario: "hp", berserker: "hp", condenado: "hp", automata: "hp", caballero: "hp", lider: "hp", salvaje: "hp", heroe: "hp",
    cazador: "alc", ballestero: "alc", arcanista: "atq", archimago: "atq", eco: "atq", sanador: "atq", paladin: "def", quimera: "def", picaro: "mov", capo: "mov", maestro: "mov", barrilero: "mov" };
  const RASGO_NOMBRE = { hp: "+2 de vida", alc: "+1 de alcance", atq: "+1 de ataque", def: "+1 de defensa", mov: "+1 de movimiento" };

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
  /* Bandos: dos jugadores son del mismo equipo si comparten número de equipo. Las criaturas sin dueño (-1) no son de nadie. */
  const equipoFijo = (est, a, b) => a === b || (a >= 0 && b >= 0 && est.jugadores[a].equipo !== null && est.jugadores[a].equipo !== undefined && est.jugadores[a].equipo === est.jugadores[b].equipo);
  /* Los pactos valen como alianza mientras duran (no se atacan y comparten vista), pero no comparten la victoria */
  const clavePacto = (a, b) => (a < b ? a * 8 + b : b * 8 + a);
  const hayPacto = (est, a, b) => a >= 0 && b >= 0 && a !== b && est.pactos !== undefined && est.pactos[clavePacto(a, b)] === true;
  const mismoEquipo = (est, a, b) => equipoFijo(est, a, b) || hayPacto(est, a, b);
  const hostil = (est, a, b) => !mismoEquipo(est, a, b);
  const vivos = est => est.jugadores.filter(o => !o.eliminado).map(o => o.id);
  const rivalesDe = (est, j) => est.jugadores.filter(o => !o.eliminado && hostil(est, j, o.id)).map(o => o.id);
  const equipoDe = (est, j) => est.jugadores.filter(o => mismoEquipo(est, j, o.id)).map(o => o.id);
  const facDe = (est, j) => FACCIONES[est.jugadores[j].faccion];
  const heroeDe = u => (u.heroe ? HEROES[u.heroe] : null);
  const heroeVivo = (est, j) => { const jug = est.jugadores[j]; return jug.heroeUid && est.unidades[jug.heroeUid] ? est.unidades[jug.heroeUid] : null; };
  const efHeroe = (est, j) => { const h = j >= 0 ? heroeVivo(est, j) : null; return h ? HEROES[h.heroe].ef : {}; };
  const polvoraFac = (est, u) => !!(u.dueno >= 0 && !u.heroe && facDe(est, u.dueno).mods.polvora && facDe(est, u.dueno).mods.polvora[u.clase]);
  const usaPolvora = (est, u) => polvoraFac(est, u) || !!CLASES[u.clase].canon;
  /* --- El mar --- */
  const SIN_NAVAL = {};
  const navalDe = (est, j) => (j >= 0 && facDe(est, j).naval) || SIN_NAVAL;
  const esBarco = u => !!CLASES[u.clase].naval;
  const enAgua = (est, u) => est.casillas[u.y][u.x].t === "agua";
  const embarcada = (est, u) => !esBarco(u) && enAgua(est, u);
  // Para embarcar hace falta que tu bando (o un aliado) tenga un muelle. Algunos ejércitos no lo necesitan.
  const puedeEmbarcar = (est, j) => j >= 0 && (!!navalDe(est, j).embarcaSinMuelle || equipoDe(est, j).some(q => tieneEdificio(est, q, "muelle")));
  const NIVEL_MUELLE = { muelle: 1, astillero: 2, atarazana: 3 };
  const enTregua = est => est.tregua > 0 && est.turno <= est.tregua;
  function esMonstruo(est, u) {
    const cl = CLASES[u.clase], h = heroeDe(u);
    if (cl.monstruo || cl.muertoViviente || (h && (h.muertoViviente || h.bestia))) return true;
    if (u.dueno < 0) return false;
    const fac = facDe(est, u.dueno);
    return !!(fac.monstruos || (fac.mods.monstruoClases && fac.mods.monstruoClases.includes(u.clase)));
  }
  const nombreUnidad = u => (u.s ? S.nombreConApodo(u.s) : u.nombre || CLASES[u.clase].nombre);
  const claveC = (x, y) => `${x},${y}`;
  const consagradaPara = (est, j, x, y) => { const d = est.consagradas && est.consagradas[claveC(x, y)]; return d !== undefined && j >= 0 && mismoEquipo(est, d, j); };
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
    for (const uid in est.unidades) {
      const w = est.unidades[uid];
      if (w.dueno !== u.dueno) continue;
      const d = dist(u, w);
      if (d > 2) continue;
      if (w.lider && !jug.liderMuerto) {
        const al = fac.lider.aura;
        a.def += al.auraDef || 0; a.atq += al.auraAtq || 0;
      }
      if (w.s && w.s.equipo && w.s.equipo.estandarte) {
        const inst = est.reliquias[w.s.equipo.estandarte];
        if (inst) { a.def += inst.bono.auraDef || 0; a.atq += inst.bono.auraAtq || 0; a.mov += inst.bono.auraMov || 0; }
      }
      if (d <= 1 && w !== u && w.clase === "paladin") a.def += 1;
      if (d <= 1 && w !== u && w.clase === "capo") a.atq += 1;
      if (w !== u && w.heroe) { const he = HEROES[w.heroe].ef; a.atq += he.auraAtq2 || 0; if (d <= 1) a.def += he.auraDef1 || 0; }
      if (w !== u && w.s && u.s && w.s.capitan && w.s.compania && w.s.compania === u.s.compania) a.def += 1;
    }
    return a;
  }

  function ef(est, u, sinAyuda) {
    const cl = CLASES[u.clase];
    const s = u.s;
    const jug = u.dueno >= 0 ? est.jugadores[u.dueno] : null;
    const fac = jug ? FACCIONES[jug.faccion] : null;
    const H = heroeDe(u);
    let hpMax = cl.hp, atq = cl.atq, def = cl.def, mov = cl.mov, alc = cl.alc, vision = 2, cura = 0;
    if (H) { hpMax = H.hp; atq = H.atq; def = H.def; mov = H.mov; alc = H.alc; vision = 3; }
    (u.rasgos || []).forEach(k => { if (k === "hp") hpMax += 2; else if (k === "alc") alc += 1; else if (k === "atq") atq += 1; else if (k === "def") def += 1; else if (k === "mov") mov += 1; });
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
      if (polvoraFac(est, u)) atq += 2;
      if (cl.naval) { const nv = fac.naval || SIN_NAVAL; mov += nv.barcoMov || 0; atq += nv.barcoAtq || 0; def += nv.barcoDef || 0; }
      const eh = efHeroe(est, u.dueno);
      if (eh.atqClaseAliada && eh.atqClaseAliada[u.clase]) atq += eh.atqClaseAliada[u.clase];
      if (eh.defClaseAliada && eh.defClaseAliada[u.clase]) def += eh.defClaseAliada[u.clase];
      if (H && H.ef.rencor) atq += Math.min(6, u.rencor || 0);
      if (t.militar >= 1 && (u.clase === "guerrero" || u.clase === "paladin")) hpMax += 1;
      if (t.militar >= 3) atq += 1;
      if (t.militar >= 4 && s && S.rangoIndice(s.victorias + (u.vicG || 0)) >= 2) { atq += 1; def += 1; }
      if (!sinAyuda && t.militar >= 2 && vecinosAliados(est, u).some(w => w.clase === u.clase)) def += 1;
      if (t.arcano >= 4 && (u.clase === "arcanista" || u.clase === "archimago")) alc += 1;
      if (t.tanato >= 2) cura += 1;
      if (m.curaExtra) cura += m.curaExtra;
      if (jug.liderMuerto && fac.lider.estado) {
        const e = fac.lider.estado;
        atq += e.atq || 0; def += e.def || 0; hpMax += e.hp || 0;
        if (e.atqClases && e.atqClases[u.clase]) atq += e.atqClases[u.clase];
      }
      if (!sinAyuda) { const au = auras(est, u); atq += au.atq; def += au.def; mov += au.mov; }
    }
    // Embarcada: una tropa de tierra sobre el agua va despacio y sin defensa (cada ejército, a su manera)
    if (!cl.naval && est.casillas[u.y][u.x].t === "agua") {
      const nv = (fac && fac.naval) || SIN_NAVAL;
      mov = nv.movEmbarcada || 3;
      if (!nv.marinos && !nv.fondo) def = 0;
    }
    if (u.efectos && u.efectos.sinMando && u.efectos.sinMando >= est.turno) atq -= 1;
    if (u.efectos && u.efectos.frenado && u.efectos.frenado >= est.turno) mov -= 1;
    if (u.efectos && u.efectos.formado && u.efectos.formado >= est.turno) def += 1;
    hpMax = Math.max(1, hpMax);
    // Furia (Okran): cada cuarto de vida perdido da ataque
    if (jug && fac) {
      const tope = (H && H.ef.furia) || fac.mods.furia || 0;
      if (tope && u.hp < hpMax) atq += Math.min(tope, Math.floor((1 - u.hp / hpMax) * 4));
      if (u.clase === "berserker" && u.hp * 2 <= hpMax) atq += 1;
      // Noche eterna (Nikaalia): quien tiene a Nikaalia de rival ve una casilla menos
      if (est.hayNoche && !fac.mods.noche && est.jugadores.some(o => !o.eliminado && FACCIONES[o.faccion].mods.noche && hostil(est, o.id, u.dueno))) vision = Math.max(1, vision - 1);
    }
    // Temible (Rykerd): los enemigos que tiene al lado pegan menos
    if (est.hayTemible && vecinosEnemigos(est, u).some(w => w.heroe && HEROES[w.heroe].ef.temible)) atq -= 1;
    return { atq: Math.max(0, atq), def: Math.max(0, def), mov: Math.max(1, mov), alc: Math.max(1, alc), hpMax, vision, cura };
  }

  /* Unidades pegadas a una: una sola pasada por todas las unidades (se llama muchísimo) */
  function vecinosAliados(est, u) {
    const out = [];
    for (const uid in est.unidades) {
      const w = est.unidades[uid];
      if (w !== u && w.dueno === u.dueno && Math.abs(w.x - u.x) <= 1 && Math.abs(w.y - u.y) <= 1) out.push(w);
    }
    return out;
  }
  const vecinosEnemigos = (est, u) => {
    const out = [];
    for (const uid in est.unidades) {
      const w = est.unidades[uid];
      if (w !== u && Math.abs(w.x - u.x) <= 1 && Math.abs(w.y - u.y) <= 1 && hostil(est, w.dueno, u.dueno)) out.push(w);
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
    if (ciudad && ciudad.edificios.includes("cuartel") && c.oro && clase !== "mercenario" && !CLASES[clase].naval) c.oro = Math.max(0, c.oro - 1);
    if (fac.mods.sinComida) delete c.comida;
    Object.keys(c).forEach(k => { if (!c[k]) delete c[k]; });
    return c;
  }

  function clasesDisponibles(est, j) {
    const fac = FACCIONES[est.jugadores[j].faccion];
    const lista = D.CLASES_BASE.slice();
    (fac.clasesExtra || []).forEach(c => lista.push(c));
    lista.push("eco");
    // Barcos: los comunes hasta donde llegue su marina y los propios del ejército
    const nv = fac.naval || SIN_NAVAL, tope = nv.barcoMax === undefined ? 3 : nv.barcoMax;
    D.BARCOS_BASE.concat(nv.barcos || []).forEach(c => { if (CLASES[c] && CLASES[c].naval <= tope) lista.push(c); });
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
    if (!clasesDisponibles(est, j).includes(clase)) return "Tu ejército no entrena esa tropa.";
    if (unidadesDe(est, j).length >= MAX_UNIDADES) return "Ya tienes el máximo de unidades.";
    const rq = cl.requiere || {};
    if (rq.edificio && !(ciudad.edificios.includes(rq.edificio) && !(ciudad.desh[rq.edificio] >= est.turno))) return `Hace falta ${EDIFICIOS[rq.edificio].nombre} en la ciudad.`;
    if (rq.escuela && jug.tech[rq.escuela[0]] < rq.escuela[1]) return `Hace falta ${ESCUELAS[rq.escuela[0]].escalones[rq.escuela[1] - 1].nombre}.`;
    if (!puedePagar(jug, costeReclutar(est, j, clase, ciudad))) return "No te alcanzan los recursos.";
    if (cl.naval) return aguaLibreCerca(est, ciudad) ? null : "No hay agua libre junto a la ciudad.";
    const libre = casillaLibreCerca(est, ciudad, j);
    if (!libre) return "No hay sitio libre junto a la ciudad.";
    return null;
  }

  /* Agua a dos casillas de una ciudad: la que hace falta para un muelle y donde aparecen los barcos */
  function aguaCerca(est, ciudad) {
    for (let y = ciudad.y - 2; y <= ciudad.y + 2; y++) for (let x = ciudad.x - 2; x <= ciudad.x + 2; x++) if (dentro(est, x, y) && est.casillas[y][x].t === "agua") return true;
    return false;
  }
  function aguaLibreCerca(est, ciudad) {
    let m = null;
    for (let y = ciudad.y - 2; y <= ciudad.y + 2; y++) for (let x = ciudad.x - 2; x <= ciudad.x + 2; x++) {
      if (!dentro(est, x, y) || est.casillas[y][x].t !== "agua" || unidadEn(est, x, y)) continue;
      const d = Math.abs(x - ciudad.x) + Math.abs(y - ciudad.y);
      if (!m || d < m.d) m = { x, y, d };
    }
    return m;
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
    // Los aliados comparten lo que ven: se recalcula la vista de todo el equipo
    const equipo = equipoDe(est, j);
    equipo.forEach(k => {
      const v = est.vision[k];
      for (let i = 0; i < v.length; i++) if (v[i] === 2) v[i] = 1;
      const marca = (cx, cy, r) => {
        for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (dentro(est, x, y)) v[y * est.ancho + x] = 2;
      };
      equipo.forEach(q => {
        if (est.jugadores[q].eliminado) return;
        unidadesDe(est, q).forEach(u => marca(u.x, u.y, ef(est, u).vision));
        ciudadesDe(est, q).forEach(c => marca(c.x, c.y, 3));
        est.fortalezasDueno.forEach((d, i) => { if (d === q) { const p = est.fortalezas[i]; marca(p.x, p.y, 2); } });
      });
    });
  }
  const veCasilla = (est, j, x, y) => est.vision[j][y * est.ancho + x] === 2;
  /* Noche eterna: a una unidad de Nikaalia no se la ve hasta tener a alguien a su lado. Sí se la ve en ciudades,
     fortalezas y sobre el Núcleo, y cuando ataca queda a la vista hasta su siguiente turno. */
  function oculta(est, u, j) {
    if (!est.hayNoche || u.dueno < 0 || j < 0 || u.descubierta || !facDe(est, u.dueno).mods.noche || mismoEquipo(est, u.dueno, j)) return false;
    const c = est.casillas[u.y][u.x];
    if (c.est === "ciudad" || c.est === "fortaleza" || c.est === "nucleo") return false;
    for (const uid in est.unidades) {
      const w = est.unidades[uid];
      if (w.dueno >= 0 && Math.abs(w.x - u.x) <= 1 && Math.abs(w.y - u.y) <= 1 && mismoEquipo(est, w.dueno, j)) return false;
    }
    return true;
  }
  const veUnidad = (est, j, u) => veCasilla(est, j, u.x, u.y) && !oculta(est, u, j);

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
    const N = cfg.jugadores.length;
    const mapa = M.generarMapa(cfg.semilla, tipoId, { bandos: N, forma: cfg.forma });
    const ceros = () => new Array(N).fill(0);
    const primerHumano = cfg.jugadores.findIndex(jc => jc.humano);
    const est = {
      v: 2, reglas: D.REGLAS, semilla: cfg.semilla, tipo: tipoId, dificultad: cfg.dificultad || "normal", anio: cfg.anio || 1,
      ancho: mapa.ancho, alto: mapa.alto, casillas: mapa.casillas, regiones: mapa.regiones, costuras: mapa.costuras, capitales: mapa.capitales, nucleo: mapa.nucleo,
      turno: 1, activo: 0, maxTurnos: cfg.maxTurnos || 35 + 5 * (N - 2) + (mapa.maritimo ? 10 : 0), hold: cfg.hold || 6, rs: mapa.rng || 1, tregua: cfg.tregua !== undefined ? cfg.tregua : N > 2 ? 3 : 0,
      jugadores: [], ciudades: {}, unidades: {}, siguienteUid: 1, siguienteCiudad: 1, reliquias: {}, tumbas: [], log: [], cronica: [],
      ganador: null, ganadores: [], razon: null, nucleoHold: ceros(), vision: cfg.jugadores.map(() => new Array(mapa.ancho * mapa.alto).fill(0)),
      fortalezas: [], fortalezasDueno: [], stats: { bajas: ceros(), ciudades: ceros(), oficiales: ceros(), muertes: ceros() }, pendientes: [], humano: primerHumano,
      primerTurno: true, ev: [], caidos: [], pvp: !!cfg.pvp, consagradas: {}, muros: [], hayTemible: false, forma: mapa.forma, maritimo: !!mapa.maritimo,
      pactos: {}, ofertas: [], desertores: [], desertaron: [],
      hayNoche: cfg.jugadores.some(jc => FACCIONES[D.faccionReal(jc.faccion)].mods.noche)
    };
    if (cfg.pvp) est.humano = cfg.humanoIdx === undefined ? 0 : cfg.humanoIdx;
    // Jugadores
    cfg.jugadores.forEach((jc, j) => {
      const faccion = D.faccionReal(jc.faccion);
      const fac = FACCIONES[faccion];
      const rec = { comida: 6, materiales: 6, mineral: 2, oro: 8, mana: 3, anima: 0 };
      if (fac.mods.sinComida) { rec.comida = 0; rec.anima = 5; }
      if (fac.mods.manaInicial) rec.mana += fac.mods.manaInicial;
      if (N === 2 && j === 1) { rec.oro += 4; rec.comida += 2; }
      if (fac.mods.oroInicial) rec.oro += fac.mods.oroInicial;
      est.jugadores.push({ id: j, nombre: jc.nombre, faccion, humano: !!jc.humano, equipo: jc.equipo === undefined ? null : jc.equipo, recursos: rec, tech: { militar: 0, arcano: 0, tanato: 0 },
        liderMuerto: false, eliminado: false, ia: jc.humano ? null : { nivel: jc.nivelIA || est.dificultad }, mochila: [],
        cuenta: { salvajes: 0, saqueos: 0, duelos: 0, devorados: 0, racha: 0, perdidas: 0, tributos: 0 }, heroes: [], heroeInvocado: null, heroeUid: null });
      if (fac.escuelaInicial) est.jugadores[j].tech[fac.escuelaInicial[0]] = fac.escuelaInicial[1];
      (jc.reliquias || []).forEach(inst => { est.reliquias[inst.id] = inst; });
    });
    // Héroes que cada bando puede invocar. Si un héroe tiene varias identidades, se sortea una con la semilla de la guerra
    est.jugadores.forEach(jug => {
      (FACCIONES[jug.faccion].heroe || []).forEach(id => {
        const h = HEROES[id];
        jug.heroes.push({ id, nombre: h.variantes ? h.variantes[ri(est, h.variantes.length)] : h.nombre });
      });
    });
    // Ciudades: capitales y sitios neutrales
    const crearCiudad = (x, y, dueno, nombre, capital, nivel) => {
      const id = `c${est.siguienteCiudad++}`;
      est.ciudades[id] = { id, nombre, x, y, dueno, nivel, edificios: [], desh: {}, capital, region: est.casillas[y][x].region, reclutado: false };
      est.casillas[y][x].est = "ciudad";
      return est.ciudades[id];
    };
    est.jugadores.forEach((jug, j) => {
      const cap = est.capitales[j];
      crearCiudad(cap.x, cap.y, j, CAPITALES[jug.faccion] || "La capital", true, 2);
      const rg = est.regiones[est.casillas[cap.y][cap.x].region];
      if (rg) rg.nombre = `Fragmento de ${FACCIONES[jug.faccion].origen}`;
      if (FACCIONES[jug.faccion].mods.consagra) consagrar(est, j, cap.x, cap.y, 1);
      // En los mapas de mar todos empiezan con su muelle (quien sepa hacerlos)
      if (est.maritimo && !navalDe(est, j).sinMuelle && aguaCerca(est, est.ciudades[`c${est.siguienteCiudad - 1}`])) est.ciudades[`c${est.siguienteCiudad - 1}`].edificios.push("muelle");
    });
    const nombres = [];
    for (let i = 0; i < NOMBRES_CIUDAD.length; i++) nombres.push(NOMBRES_CIUDAD[(i * 7 + (cfg.semilla % 13)) % NOMBRES_CIUDAD.length]);
    const unicos = Array.from(new Set(nombres));
    mapa.sitios.forEach((p, i) => { crearCiudad(p.x, p.y, null, unicos[i % unicos.length] + (i >= unicos.length ? ` ${["II", "III", "IV"][Math.floor(i / unicos.length) - 1] || ""}` : ""), false, 1); });
    mapa.fortalezas.forEach(p => { est.fortalezas.push({ x: p.x, y: p.y }); est.fortalezasDueno.push(null); });
    // El Mercado de las Sombras: si Nikaalia está en la guerra, una ciudad sin dueño cercana a su capital (no la más cercana) es el mercado.
    // A quien la tenga le da oro, y a Nikaalia le abre la puerta de su Don.
    const jn = est.jugadores.findIndex(o => FACCIONES[o.faccion].mods.noche);
    if (jn >= 0) {
      const libres = Object.values(est.ciudades).filter(c => c.dueno === null).sort((a, b) => dist(a, est.capitales[jn]) - dist(b, est.capitales[jn]) || (a.id < b.id ? -1 : 1));
      const m = libres[1] || libres[0];
      if (m) { m.mercado = true; m.nombre = "Mercado de las Sombras"; m.nivel = 2; }
    }
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
        if (dentro(est, x, y) && TERRENOS[est.casillas[y][x].t].mov > 0 && !(x === cap.x && y === cap.y) && !casilla(est, x, y).est && !unidadEn(est, x, y)) sitios.push({ x, y });
      }
      nuevoLider(est, j, cap.x, cap.y);
      soldados.slice(0, MAX_UNIDADES - 1).forEach((s, i) => {
        const p = sitios[i];
        if (!p) return;
        nuevaUnidad(est, j, s.clase, p.x, p.y, s);
      });
    });
    actualizarRegiones(est);
    est.jugadores.forEach((_, j) => actualizarVision(est, j));
    iniciarTurno(est, 0, true);
    reg(est, `Empieza la guerra en ${TIPOS_FRACTURA[tipoId].nombre}.`, "turno");
    if (est.tregua) reg(est, `Hay tregua entre los bandos hasta el turno ${est.tregua}.`, "turno");
    return est;
  }

  /* Consagra una casilla y las de alrededor para un bando (Santos de Asmodeo) */
  function consagrar(est, j, cx, cy, radio) {
    let n = 0;
    for (let y = cy - radio; y <= cy + radio; y++) for (let x = cx - radio; x <= cx + radio; x++) {
      if (!dentro(est, x, y) || est.casillas[y][x].t === "vacio") continue;
      if (est.consagradas[claveC(x, y)] !== j) { est.consagradas[claveC(x, y)] = j; n++; }
    }
    return n;
  }
  const consagradasDe = (est, j) => Object.values(est.consagradas).filter(d => d === j).length;

  /* --- Economía --- */
  /* Lo que entra cada turno. Con desglose = true devuelve además de dónde sale cada cosa. */
  function ingresoDe(est, j, desglose) {
    const jug = est.jugadores[j];
    const fac = FACCIONES[jug.faccion];
    const tot = { comida: 0, materiales: 0, mineral: 0, oro: 0, mana: 0, anima: 0 };
    const fuentes = {};
    const mas = (fuente, k, n) => { if (!n) return; tot[k] += n; if (desglose) { fuentes[fuente] = fuentes[fuente] || {}; fuentes[fuente][k] = (fuentes[fuente][k] || 0) + n; } };
    const tipo = TIPOS_FRACTURA[est.tipo];
    const escaso = !!tipo.escaso;
    ciudadesDe(est, j).forEach(c => {
      mas("Ciudades", "comida", 1); mas("Ciudades", "materiales", 1);
      mas("Ciudades", "oro", Math.max(0, 1 + c.nivel + (fac.mods.oroCiudad || 0)));
      if (fac.mods.animaCiudad) mas("Ciudades", "anima", fac.mods.animaCiudad);
      if (c.mercado) mas("Mercado de las Sombras", "oro", 2);
      const r = c.nivel >= 3 ? 2 : 1;
      for (let y = c.y - r; y <= c.y + r; y++) for (let x = c.x - r; x <= c.x + r; x++) {
        if (!dentro(est, x, y)) continue;
        const rin = TERRENOS[est.casillas[y][x].t].rinde;
        // En los mapas escasos el terreno rinde la mitad: una casilla sí y otra no, alternando cada turno
        Object.keys(rin).forEach(k => { mas("Terreno", k, escaso ? ((x * 7 + y * 13 + est.turno) % 2 ? rin[k] : 0) : rin[k]); });
      }
      c.edificios.forEach(id => {
        if (c.desh[id] >= est.turno) return;
        const ed = EDIFICIOS[id];
        Object.keys(ed.rinde).forEach(k => { mas("Edificios", k, ed.rinde[k]); });
        if (ed.rama === "eco" && jug.tech.arcano >= 3) mas("Edificios", Object.keys(ed.rinde)[0] || "oro", 1);
        if (id === "muelle" && fac.naval && fac.naval.muelleOro) mas("Edificios", "oro", fac.naval.muelleOro);
      });
    });
    unidadesDe(est, j).forEach(u => {
      const e = bonoReliquias(est, u);
      if (u.s) { mas("Reliquias", "mana", e.mana || 0); mas("Reliquias", "oro", e.oro || 0); }
      if (u.lider && !jug.liderMuerto) { const al = fac.lider.aura; mas("Líder", "mana", al.mana || 0); mas("Líder", "oro", al.oro || 0); }
      if (u.heroe) { const he = HEROES[u.heroe].ef; mas("Héroe", "oro", he.oroTurno || 0); mas("Héroe", "mana", he.manaTurno || 0); }
      if (CLASES[u.clase].oroTurno) mas("Flota", "oro", CLASES[u.clase].oroTurno);
    });
    if (jug.liderMuerto && fac.lider.estado && fac.lider.estado.oroMitad) { const quita = tot.oro - Math.floor(tot.oro / 2); mas("Sin líder", "oro", -quita); }
    if (jug.humano === false && DIFICULTADES[est.dificultad].bonoRecursos) {
      Object.keys(tot).forEach(k => { mas("Dificultad", k, Math.ceil(tot[k] * (1 + DIFICULTADES[est.dificultad].bonoRecursos)) - tot[k]); });
    }
    if (desglose) return { total: tot, fuentes };
    return tot;
  }

  const comeUnidad = u => !(u.lider || u.heroe || CLASES[u.clase].sinComida || CLASES[u.clase].muertoViviente || u.clase === "salvaje");
  function mantenimiento(est, j) {
    const jug = est.jugadores[j];
    if (FACCIONES[jug.faccion].mods.sinComida) return 0;
    const n = unidadesDe(est, j).filter(comeUnidad).length;
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
    const fac = FACCIONES[jug.faccion];
    // Las criaturas sobornadas vuelven a ser de nadie cuando se acaba el pago
    unidadesDe(est, j).forEach(u => {
      if (u.sobornada !== undefined && est.turno > u.sobornada) { u.dueno = -1; delete u.sobornada; u.errante = true; reg(est, `${nombreUnidad(u)} deja de servir a ${jug.nombre}.`, "suceso"); }
    });
    // Taller de Nernib: un autómata gratis cada 4 turnos, hasta 3 vivos
    if (!primero && fac.mods.taller && est.turno % 4 === 0 && unidadesDe(est, j).length < MAX_UNIDADES && unidadesDe(est, j).filter(u => u.clase === "automata").length < 3) {
      const ciudad = ciudadesDe(est, j).find(c => c.edificios.includes("taller") && !(c.desh.taller >= est.turno));
      const lib = ciudad ? casillaLibreCerca(est, ciudad, j) : null;
      if (lib) {
        const r = { s: est.rs };
        const sol = S.crearSoldado(r, { clase: "automata", cultura: fac.cultura, origen: "eco", anio: est.anio });
        est.rs = r.s;
        const a = nuevaUnidad(est, j, "automata", lib.x, lib.y, sol);
        est.ev.push({ k: "nuevo", uid: a.uid, x: a.x, y: a.y });
        reg(est, `El taller de ${ciudad.nombre} entrega un autómata.`, "recluta");
      }
    }
    unidadesDe(est, j).forEach(u => {
      const e = ef(est, u);
      u.pm = e.mov; u.atacado = false; u.recorrido = 0; u.quieto = true; u.accion = false;
      if (u.descubierta) delete u.descubierta;
      if (u.enfriar > 0) u.enfriar -= 1;
      if (u.cd > 0) u.cd -= 1;
      if (u.cd2 > 0) u.cd2 -= 1;
      if (u.efectos.clavado) { u.pm = 0; delete u.efectos.clavado; }
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
      // Los barcos se reparan junto a un muelle propio
      if (esBarco(u) && ciudadesDe(est, j).some(q => q.edificios.includes("muelle") && dist(q, u) <= 2)) cura += 3;
      if (consagradaPara(est, j, u.x, u.y)) cura += 1;
      vecinosAliados(est, u).forEach(w => {
        if (w.clase === "sanador") cura += 4;
        const ew = bonoReliquias(est, w);
        cura += ew.cura || 0;
      });
      if (cura > 0 && u.hp < e.hpMax) u.hp = Math.min(e.hpMax, u.hp + cura);
      u.descanso = true;
    });
    // Contención rota: sin el Maestro Cazador, Rykerd ataca a lo que tenga más cerca, sea de quien sea
    unidadesDe(est, j).forEach(u => {
      if (!(u.desatado > 0) || !est.unidades[u.uid]) return;
      u.desatado -= 1;
      const otros = Object.values(est.unidades).filter(w => w !== u).sort((a, b) => dist(u, a) - dist(u, b));
      const t = otros[0];
      if (t && dist(u, t) > ef(est, u).alc) {
        let mejor = null;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = u.x + dx, y = u.y + dy;
          if ((!dx && !dy) || !dentro(est, x, y) || TERRENOS[est.casillas[y][x].t].mov === 0 || unidadEn(est, x, y)) continue;
          const d = dist({ x, y }, t);
          if (!mejor || d < mejor.d) mejor = { x, y, d };
        }
        if (mejor) { const de = { x: u.x, y: u.y }; u.x = mejor.x; u.y = mejor.y; est.ev.push({ k: "mov", uid: u.uid, de, a: { x: u.x, y: u.y }, ruta: [de, { x: u.x, y: u.y }] }); }
      }
      if (t && est.unidades[t.uid] && dist(u, t) <= ef(est, u).alc) { reg(est, `${nombreUnidad(u)}, sin nadie que lo contenga, se lanza contra ${nombreUnidad(t)}.`, "combate"); atacarUnidad(est, u, t, true); }
      if (est.unidades[u.uid]) { u.pm = 0; u.atacado = true; if (u.desatado === 0) reg(est, `${nombreUnidad(u)} vuelve a obedecer.`, "suceso"); }
    });
    actualizarVision(est, j);
  }

  /* --- Regiones y sucesos de la Fractura --- */
  function actualizarRegiones(est) {
    est.regiones.forEach(rg => {
      const cuenta = est.jugadores.map(() => 0);
      Object.values(est.ciudades).forEach(c => { if (c.dueno !== null && c.region === rg.id) cuenta[c.dueno]++; });
      est.fortalezas.forEach((p, i) => { const d = est.fortalezasDueno[i]; if (d !== null && est.casillas[p.y][p.x].region === rg.id) cuenta[d]++; });
      const max = Math.max.apply(null, cuenta);
      const lideres = cuenta.map((n, i) => (n === max ? i : -1)).filter(i => i >= 0);
      rg.dueno = max > 0 && lideres.length === 1 ? lideres[0] : null;
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
          if (c.region === rg.id && !c.est && TERRENOS[c.t].mov > 0 && !unidadEn(est, x, y) && !Object.values(est.ciudades).some(ci => ci.dueno !== null && dist(ci, { x, y }) <= 2)) lib.push({ x, y });
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
        if (rg.dueno === null) { /* sin dueño nadie se lleva nada */ } else {
          sumar(est.jugadores[rg.dueno], rn(est) < 0.5 ? "mana" : "anima", 2);
          reg(est, `Un resto del fragmento ${rg.nombre} cae en manos de ${est.jugadores[rg.dueno].nombre}.`, "suceso");
        }
      }
    });
    est.muros = (est.muros || []).filter(m => m.hasta >= est.turno);
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
      const objetivos = Object.values(est.unidades).filter(w => w.dueno >= 0 && dist(u, w) <= e.alc && !razonAgua(est, u, w));
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
    if (consagradaPara(est, u.dueno, u.x, u.y)) d += 1;
    if (ciudad && ciudad.dueno === u.dueno) {
      if (ciudad.capital) d += 1;
      if (ciudad.edificios.includes("herreria") && !(ciudad.desh.herreria >= est.turno)) d += 1;
      if (ciudad.edificios.includes("fortaleza") && !(ciudad.desh.fortaleza >= est.turno)) d += 2 + ((u.dueno >= 0 && FACCIONES[est.jugadores[u.dueno].faccion].mods.fortalezaDef) || 0);
    }
    return d;
  }

  function enCiudadOFortaleza(est, u) { const c = est.casillas[u.y][u.x]; return c.est === "ciudad" || c.est === "fortaleza"; }

  /* Duelo (Seosan): contra una unidad sola, el combate es de uno contra uno y nadie recibe ayuda de los de al lado */
  function esDuelo(est, a, d) {
    return !!(a.dueno >= 0 && !a.heroe && facDe(est, a.dueno).mods.duelo && vecinosAliados(est, d).length === 0);
  }
  /* Lo que el agua impide: quien va embarcado no pelea (salvo los marinos) y a quien está en el agua solo le llegan tiradores y barcos */
  function razonAgua(est, a, d) {
    const aAgua = enAgua(est, a), dAgua = enAgua(est, d);
    if (!aAgua && !dAgua) return null;
    if (aAgua && !esBarco(a) && !navalDe(est, a.dueno).marinos) return "Embarcada no puede atacar.";
    if (dAgua && !aAgua && ef(est, a).alc < 2) return "Está en el agua: solo le llegan los tiradores y los barcos.";
    return null;
  }

  function calcularDano(est, a, d, duelo) {
    if (duelo === undefined) duelo = esDuelo(est, a, d);
    const EA = ef(est, a, duelo), ED = ef(est, d, duelo);
    const jugA = a.dueno >= 0 ? est.jugadores[a.dueno] : null;
    const facA = jugA ? FACCIONES[jugA.faccion] : null;
    const clA = CLASES[a.clase];
    let A = EA.atq;
    const sa = a.s;
    const solo = vecinosAliados(est, d).length === 0;
    if (clA.atqBarco && enAgua(est, d)) A += clA.atqBarco;
    if (clA.atqPlaza && enCiudadOFortaleza(est, d)) A += clA.atqPlaza;
    if (clA.espolon && (a.recorrido || 0) >= 2) A += clA.espolon;
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
    if (facA && facA.mods.duelo && solo && !a.heroe) A += facA.mods.duelo;
    if (a.clase === "maestro" && solo) A += 2;
    let Df = ED.def + defensaDelTerreno(est, d);
    if (usaPolvora(est, a)) Df = Math.max(0, Df - 1);
    let dmg = Math.max(1, A + 1 - Math.floor(Df / 2));
    if (!duelo && vecinosAliados(est, d).some(w => w.clase === "guerrero")) dmg = Math.max(1, dmg - 1);
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
    const duelo = esDuelo(est, a, d);
    let dmg = calcularDano(est, a, d, duelo);
    if (est.hayNoche && a.dueno >= 0 && facDe(est, a.dueno).mods.noche) a.descubierta = true;
    const distancia = dist(a, d);
    // El Vigilante: los aliados a su lado ignoran el primer golpe de cada turno
    const sello = est.turno * 16 + est.activo;
    if (d.dueno >= 0 && !d.heroe && d.escudoT !== sello && vecinosAliados(est, d).some(w => w.heroe && HEROES[w.heroe].ef.escudoAliados)) {
      d.escudoT = sello; dmg = 0;
      reg(est, `${nombreUnidad(a)} golpea a ${nombreUnidad(d)}, pero la luz del Vigilante detiene el golpe.`, "combate");
    } else reg(est, `${nombreUnidad(a)} golpea a ${nombreUnidad(d)} por ${dmg}.`, "combate");
    est.ev.push({ k: "golpe", de: a.uid, a: d.uid, x: d.x, y: d.y, dmg, dist: distancia, arma: usaPolvora(est, a) ? "polvora" : (CLASES[a.clase].atqEstat === "MAG" || (a.heroe && HEROES[a.heroe].magia)) ? "magia" : distancia > 1.5 ? "flecha" : "filo" });
    d.descanso = false;
    const murio = dmg > 0 ? aplicarDano(est, d, dmg, a) : false;
    const jug = a.dueno >= 0 ? est.jugadores[a.dueno] : null;
    // Daño en área de los arcanistas
    if (a.clase === "arcanista" || a.clase === "archimago") {
      const frac = jug && jug.tech.arcano >= 2 ? 0.75 : 0.5;
      const vec = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const w = unidadEn(est, d.x + dx, d.y + dy);
        if (w && w !== d && hostil(est, w.dueno, a.dueno) && (dx || dy)) vec.push(w);
      }
      vec.forEach(w => { const sp = Math.max(1, Math.floor(dmg * frac)); if (est.unidades[w.uid]) { est.ev.push({ k: "golpe", de: a.uid, a: w.uid, x: w.x, y: w.y, dmg: sp, dist: 0, arma: "salpica" }); aplicarDano(est, w, sp, a); } });
      if (jug && jug.tech.arcano >= 2 && est.unidades[d.uid]) d.efectos.frenado = est.turno + 1;
    }
    // El Kirin: el rayo sigue hasta quien esté detrás y deja clavado a quien toca
    if (a.heroe && HEROES[a.heroe].ef.linea) {
      const w = unidadEn(est, d.x + Math.sign(d.x - a.x), d.y + Math.sign(d.y - a.y));
      if (w && hostil(est, w.dueno, a.dueno) && est.unidades[w.uid]) { const sp = Math.max(1, Math.floor(dmg * 0.75)); est.ev.push({ k: "golpe", de: a.uid, a: w.uid, x: w.x, y: w.y, dmg: sp, dist: 0, arma: "salpica" }); if (!aplicarDano(est, w, sp, a)) w.efectos.clavado = true; }
      if (est.unidades[d.uid]) d.efectos.clavado = true;
    }
    if (!sinRetorno && !murio && est.unidades[d.uid] && distancia <= ef(est, d).alc && est.unidades[a.uid] && CLASES[d.clase].atq > 1 && !razonAgua(est, d, a)) {
      const r = Math.max(1, Math.ceil(calcularDano(est, d, a, duelo || undefined) * 0.6));
      reg(est, `${nombreUnidad(d)} responde por ${r}.`, "combate");
      est.ev.push({ k: "golpe", de: d.uid, a: a.uid, x: a.x, y: a.y, dmg: r, dist: distancia, arma: "filo", respuesta: true });
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
    const reg0 = regionDeCasilla(est, u.x, u.y) || { nombre: "la Fractura" };
    const estabaSolo = vecinosAliados(est, u).length === 0;
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
    if (dueno >= 0) { est.stats.bajas[dueno]++; const jd = est.jugadores[dueno]; jd.cuenta.perdidas++; jd.cuenta.racha = 0; if (jd.heroeUid === u.uid) jd.heroeUid = null; }
    reg(est, `${nombreUnidad(u)} cae${por ? ` ante ${nombreUnidad(por)}` : ""}.`, "muerte");
    if (por && por.dueno >= 0 && est.unidades[por.uid]) {
      const jp0 = est.jugadores[por.dueno], facP0 = FACCIONES[jp0.faccion], hp0 = heroeDe(por);
      if (dueno >= 0 && hostil(est, dueno, por.dueno)) { est.stats.muertes[por.dueno]++; jp0.cuenta.racha++; if (estabaSolo) jp0.cuenta.duelos++; }
      if (dueno === -1) jp0.cuenta.salvajes++;
      if (hp0 && hp0.ef.curaAlMatar) por.hp = Math.min(ef(est, por).hpMax, por.hp + hp0.ef.curaAlMatar);
      if (CLASES[por.clase].curaAlMatar) por.hp = Math.min(ef(est, por).hpMax, por.hp + CLASES[por.clase].curaAlMatar);
      // Devorar y adaptar (Mravec)
      const sinTope = hp0 && hp0.ef.devoraSinTope;
      if (sinTope || (!por.heroe && facP0.mods.devora && facP0.mods.devora.includes(por.clase))) {
        jp0.cuenta.devorados++;
        const rasgo = RASGO_DE[u.clase] || "hp";
        por.rasgos = por.rasgos || [];
        if (sinTope ? por.rasgos.length < 8 : (por.rasgos.length < 2 && !por.rasgos.includes(rasgo))) {
          por.rasgos.push(rasgo);
          if (rasgo === "hp") por.hp += 2;
          reg(est, `${nombreUnidad(por)} devora a su presa y se adapta: ${RASGO_NOMBRE[rasgo]}.`, "magia");
          est.ev.push({ k: "mejora", uid: por.uid, x: por.x, y: por.y, texto: RASGO_NOMBRE[rasgo] });
        }
      }
    }
    if (dueno >= 0) {
      const jd = est.jugadores[dueno];
      // Rencor: Rykerd se ceba con cada aliado que cae
      unidadesDe(est, dueno).forEach(w => { if (w.heroe && HEROES[w.heroe].ef.rencor) w.rencor = Math.min(6, (w.rencor || 0) + HEROES[w.heroe].ef.rencor); });
      // El Ceniciento: de un aliado que cae cerca sale una Legión de huesos (una por turno)
      const hv = heroeVivo(est, dueno), selloT = est.turno * 16 + est.activo;
      if (hv && HEROES[hv.heroe].ef.alzaCaidos && dist(hv, u) <= 2 && jd.alzadoT !== selloT && !u.alzado && unidadesDe(est, dueno).length < MAX_UNIDADES && !unidadEn(est, u.x, u.y)) {
        jd.alzadoT = selloT;
        const r0 = { s: est.rs };
        const sol = S.crearSoldado(r0, { clase: "esqueleto", cultura: FACCIONES[jd.faccion].cultura, origen: "criatura", anio: est.anio });
        est.rs = r0.s;
        const n = nuevaUnidad(est, dueno, "esqueleto", u.x, u.y, sol, { alzado: true });
        n.pm = 0; n.atacado = true;
        est.ev.push({ k: "nuevo", uid: n.uid, x: n.x, y: n.y });
        reg(est, "El Ceniciento no deja descansar a los suyos: se alza una Legión de huesos.", "magia");
      }
    }
    // El barrilero explota al morir
    if (u.clase === "barrilero") {
      est.ev.push({ k: "explosion", x: u.x, y: u.y });
      reg(est, `El barril de ${nombreUnidad(u)} estalla.`, "combate");
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const w = unidadEn(est, u.x + dx, u.y + dy);
        if (w && est.unidades[w.uid]) { est.ev.push({ k: "golpe", de: u.uid, a: w.uid, x: w.x, y: w.y, dmg: 3, dist: 0, arma: "salpica" }); aplicarDano(est, w, 3, null); }
      }
    }
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
    if (u.heroe && dueno >= 0) crono(est, "heroe_cae", { nombre: nombreUnidad(u), dueno, region: reg0.nombre, por: por ? nombreUnidad(por) : null });
    if (u.lider && dueno >= 0) {
      const jug = est.jugadores[dueno];
      jug.liderMuerto = true;
      const fac = FACCIONES[jug.faccion];
      reg(est, `${u.nombre} ha caído. ${fac.lider.estado.nombre}.`, "lider");
      crono(est, "lider", { nombre: u.nombre, dueno, region: reg0.nombre, estado: fac.lider.estado.nombre, por: por ? nombreUnidad(por) : null });
      unidadesDe(est, dueno).forEach(w => { if (w.heroe && HEROES[w.heroe].ef.contencion) { w.desatado = 3; reg(est, `Sin el Maestro Cazador, nadie contiene a ${nombreUnidad(w)}.`, "lider"); } });
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
    // Lo que hay en el agua no traba a lo que hay en tierra, ni al revés
    const miAgua = enAgua(est, u);
    const pegado = !exento && vecinosEnemigos(est, u).some(w => enAgua(est, w) === miAgua);
    const eq = bonoReliquias(est, u);
    const barco = esBarco(u);
    const nv = navalDe(est, u.dueno);
    const embarca = !barco && u.dueno >= 0 && puedeEmbarcar(est, u.dueno);
    const libreAgua = !!(nv.marinos || nv.fondo);   // entrar o salir del agua no les corta el paso
    const muros = est.muros || [];
    const pos = new Map();
    for (const uid in est.unidades) { const w = est.unidades[uid]; pos.set(w.y * 64 + w.x, w); }
    while (abiertos.length) {
      abiertos.sort((a, b) => mapa.get(a).c - mapa.get(b).c);
      const k = abiertos.shift();
      const nodo = mapa.get(k);
      if (nodo.hecho) continue;
      nodo.hecho = true;
      if ((pegado || nodo.fin) && k !== inicio) continue;
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
        const aguaV = ct.t === "agua", aguaN = cs.t === "agua";
        let costo, fin = false;
        if (barco) { if (!aguaV) return; costo = 1; }
        else if (aguaV) { if (!embarca) return; costo = 1; fin = !aguaN && !libreAgua; }
        else {
          costo = TERRENOS[ct.t].mov;
          if (costo === 0) return;
          if (aguaN && !libreAgua) { fin = true; costo = 1; }   // desembarcar gasta lo que quede
        }
        if (muros.length && muros.some(m => m.x === v.x && m.y === v.y)) return;
        if (v.tipo === "costura") costo = 1;
        else if (ct.t === "bosque" && eq.movBosque) costo = Math.max(1, costo - eq.movBosque);
        const ocupante = pos.get(v.y * 64 + v.x);
        if (ocupante && !mismoEquipo(est, ocupante.dueno, u.dueno)) return;
        const nc = nodo.c + costo;
        if (nc > u.pm) return;
        const kv = clave(v.x, v.y);
        const previo = mapa.get(kv);
        if (!previo || nc < previo.c) { mapa.set(kv, { c: nc, p: k, x: v.x, y: v.y, hecho: false, fin }); abiertos.push(kv); }
      });
    }
    // Solo se puede terminar en casillas libres
    const destinos = new Map();
    const tregua = enTregua(est);
    mapa.forEach((nodo, k) => {
      if (k === inicio || pos.has(nodo.y * 64 + nodo.x)) return;
      // Durante la tregua no se entra en ciudades ni fortalezas de otro bando. Nunca en las de un aliado.
      const ci = ciudadEn(est, nodo.x, nodo.y);
      if (ci && ci.dueno !== null && ci.dueno !== u.dueno && (tregua || !hostil(est, ci.dueno, u.dueno))) return;
      destinos.set(k, nodo);
    });
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
    const fac = FACCIONES[jug.faccion];
    if (u.heroe && HEROES[u.heroe].ef.consagraAlPisar) consagrar(est, u.dueno, x, y, 0);
    const ciudad = ciudadEn(est, x, y);
    if (ciudad && ciudad.dueno !== u.dueno && (ciudad.dueno === null || hostil(est, ciudad.dueno, u.dueno))) {
      const antes = ciudad.dueno;
      ciudad.dueno = u.dueno;
      Object.keys(ciudad.desh).forEach(k => delete ciudad.desh[k]);
      ciudad.edificios = ciudad.edificios.filter(id => !EDIFICIOS[id].solo || EDIFICIOS[id].solo === jug.faccion);
      ciudad.edificios.forEach(id => { ciudad.desh[id] = est.turno + 2; });
      ciudad.reclutado = true;
      u.pm = 0;
      est.stats.ciudades[u.dueno]++;
      if (antes !== null) jug.cuenta.saqueos++;
      est.ev.push({ k: "captura", x, y, dueno: u.dueno });
      const rg = regionDeCasilla(est, x, y);
      reg(est, `${jug.nombre} conquista ${ciudad.nombre}${antes !== null ? " a " + est.jugadores[antes].nombre : ""}.`, "conquista");
      crono(est, "conquista", { ciudad: ciudad.nombre, region: rg.nombre, por: nombreUnidad(u), porId: u.s ? u.s.id : null, dueno: u.dueno, antes, capital: ciudad.capital });
      if (fac.mods.consagra) consagrar(est, u.dueno, x, y, 1);
      // Tributo de Balutia: la ciudad conquistada entrega tropa, una vez por ciudad
      if (fac.mods.tributo && !ciudad.tributada && jug.cuenta.tributos < fac.mods.tributo && unidadesDe(est, u.dueno).length < MAX_UNIDADES) {
        const lib = casillaLibreCerca(est, ciudad, u.dueno);
        if (lib) {
          ciudad.tributada = true; jug.cuenta.tributos++;
          const clase = efHeroe(est, u.dueno).tributoMejor ? "paladin" : "cazador";
          const r = { s: est.rs };
          const sol = S.crearSoldado(r, { clase, cultura: fac.cultura, origen: "habitante", anio: est.anio });
          est.rs = r.s;
          const n = nuevaUnidad(est, u.dueno, clase, lib.x, lib.y, sol);
          n.pm = 0; n.atacado = true;
          est.ev.push({ k: "nuevo", uid: n.uid, x: n.x, y: n.y });
          reg(est, `${ciudad.nombre} paga tributo: ${S.nombreCompleto(sol)} se une a las filas de ${jug.nombre}.`, "recluta");
        }
      }
      actualizarRegiones(est);
      if (ciudad.capital && antes !== null) caeCapital(est, antes, u.dueno, ciudad);
    }
    const fi = est.fortalezas.findIndex(p => p.x === x && p.y === y);
    if (fi >= 0 && est.fortalezasDueno[fi] !== u.dueno && (est.fortalezasDueno[fi] === null || hostil(est, est.fortalezasDueno[fi], u.dueno))) {
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
    return ciudades * 3 + fort * 2 + regiones * 2 + est.stats.muertes[j] + est.stats.oficiales[j] * 2 + est.nucleoHold[j];
  }

  function terminarGuerra(est, ganador, razon) {
    if (est.ganador !== null) return;
    est.ganador = ganador;
    est.ganadores = ganador === "empate" || ganador === null || ganador < 0 ? [] : est.jugadores.filter(o => equipoFijo(est, ganador, o.id)).map(o => o.id);
    est.razon = razon;
    reg(est, razon, "fin");
    crono(est, "fin", { ganador, razon });
  }
  const ganoJugador = (est, j) => est.ganador !== null && est.ganador !== "empate" && (est.ganadores || [est.ganador]).includes(j);

  /* Cae una capital: si su dueño tiene un Refugio sigue en la guerra desde allí; si no, queda eliminado */
  function caeCapital(est, perdedor, ganador, ciudad) {
    const jp = est.jugadores[perdedor];
    ciudad.capital = false;
    const refugio = ciudadesDe(est, perdedor).find(c => c.edificios.includes("refugio"));
    if (refugio) {
      refugio.capital = true;
      refugio.edificios = refugio.edificios.filter(e => e !== "refugio");
      est.capitales[perdedor] = { x: refugio.x, y: refugio.y };
      reg(est, `${jp.nombre} pierde su capital y se repliega a su refugio en ${refugio.nombre}.`, "conquista");
      crono(est, "refugio", { dueno: perdedor, ciudad: refugio.nombre });
      return;
    }
    eliminar(est, perdedor, ganador, `${est.jugadores[ganador].nombre} toma la capital de ${jp.nombre}.`);
  }

  function eliminar(est, j, por, razon) {
    const jug = est.jugadores[j];
    if (jug.eliminado || est.ganador !== null) return;
    jug.eliminado = true;
    est.nucleoHold[j] = 0;
    reg(est, razon || `${jug.nombre} queda fuera de la guerra.`, "conquista");
    crono(est, "eliminado", { dueno: j, por: por === undefined ? null : por, razon: razon || "" });
    revisarPactos(est);
    const quedan = vivos(est);
    const unEquipo = quedan.length && quedan.every(k => equipoFijo(est, quedan[0], k));
    // Si solo queda un equipo, o cae el único humano de una guerra contra la máquina, la guerra termina aquí
    if (unEquipo) { terminarGuerra(est, quedan[0], razon || `${est.jugadores[quedan[0]].nombre} es el último bando en pie.`); return; }
    if (!est.pvp && jug.humano && !quedan.some(k => est.jugadores[k].humano)) {
      const mejor = quedan.slice().sort((a, b) => puntuacion(est, b) - puntuacion(est, a))[0];
      terminarGuerra(est, por !== null && por !== undefined && por >= 0 ? por : mejor, razon || `${jug.nombre} queda fuera de la guerra.`);
      return;
    }
    // Sus tropas: se disuelven (ejércitos sin refugio posible) o quedan sin dueño. Sus ciudades y fortalezas quedan libres.
    const disuelve = !!FACCIONES[jug.faccion].irrefugiable;
    unidadesDe(est, j).forEach(u => {
      if (disuelve || u.lider || u.heroe || est.casillas[u.y][u.x].t === "agua") { delete est.unidades[u.uid]; est.ev.push({ k: "muerte", uid: u.uid, x: u.x, y: u.y }); }
      else { u.dueno = -1; u.errante = true; u.nombre = nombreUnidad(u); u.fuerza = 0; u.hp = Math.min(u.hp, ef(est, u).hpMax); }
    });
    ciudadesDe(est, j).forEach(c => { c.dueno = null; c.capital = false; });
    est.fortalezasDueno.forEach((d, i) => { if (d === j) est.fortalezasDueno[i] = null; });
    Object.keys(est.consagradas).forEach(k => { if (est.consagradas[k] === j) delete est.consagradas[k]; });
    reg(est, disuelve ? `Sin su capital, el ejército de ${jug.nombre} se deshace.` : `Las tropas de ${jug.nombre} quedan sin bandera.`, "suceso");
    actualizarRegiones(est);
    est.jugadores.forEach((o, k) => { if (!o.eliminado) actualizarVision(est, k); });
  }

  function comprobarVictoria(est) {
    if (est.ganador !== null) return;
    vivos(est).forEach(j => {
      if (est.ganador === null && !unidadesDe(est, j).length && !ciudadesDe(est, j).length) eliminar(est, j, null, `${est.jugadores[j].nombre} se queda sin tropas ni ciudades.`);
    });
    if (est.ganador !== null) return;
    vivos(est).forEach(j => {
      if (est.ganador === null && est.nucleoHold[j] >= est.hold) terminarGuerra(est, j, `${est.jugadores[j].nombre} impone su influencia sobre el Núcleo del Sueño.`);
    });
  }

  /* --- Pactos y traición ---
     En una guerra de todos contra todos, dos bandos pueden pactar: no se atacan y comparten la vista. Cada bando, un pacto a la vez.
     Traicionar se puede una vez por guerra y cuesta una cuarta parte de tus soldados, que se niegan y desertan. */
  const pactoDe = (est, j) => est.jugadores.find(o => o.id !== j && !o.eliminado && hayPacto(est, j, o.id)) || null;
  function razonNoPacto(est, j, k, respuesta) {
    const jug = est.jugadores[j], otro = est.jugadores[k];
    if (!otro || k === j || otro.eliminado) return "Ese bando no está en la guerra.";
    if (equipoFijo(est, j, k)) return "Ya es tu aliado.";
    if (hayPacto(est, j, k)) return "Ya tienes un pacto con ese bando.";
    if (pactoDe(est, j)) return "Ya tienes un pacto. Solo se puede uno a la vez.";
    if (pactoDe(est, k)) return `${otro.nombre} ya tiene un pacto con otro bando.`;
    // Tiene que quedar alguien contra quien pactar
    if (!vivos(est).some(q => q !== j && q !== k && !equipoFijo(est, q, j) && !equipoFijo(est, q, k))) return "No queda nadie más contra quien unirse.";
    if (!respuesta) {
      if (est.activo !== j) return "No es tu turno.";
      if (jug.propuso && jug.propuso[k] !== undefined && est.turno - jug.propuso[k] < 3) return "Ya se lo propusiste hace poco. Espera unos turnos.";
      if (est.ofertas.some(o => o.de === j && o.a === k)) return "Tu propuesta sigue sobre la mesa.";
    }
    return null;
  }
  /* Lo que decide una IA cuando le proponen un pacto */
  function aceptaPacto(est, k, de) {
    const dip = FACCIONES[est.jugadores[k].faccion].diplomacia || { pacta: 0.5 };
    const quien = est.jugadores[de];
    if (quien.traidor || !dip.pacta) return false;
    if (dip.soloHumanos && FACCIONES[quien.faccion].monstruos) return false;
    let p = dip.pacta;
    const orden = vivos(est).map(q => ({ q, p: puntuacion(est, q) })).sort((a, b) => b.p - a.p);
    if (orden[0].q === de && orden.length > 2) p *= 0.4;        // nadie quiere ayudar al que va ganando
    if (orden[0].q !== de && orden[0].q !== k) p += 0.15;       // un enemigo común más fuerte une mucho
    return rn(est) < p;
  }
  function sellarPacto(est, a, b) {
    est.pactos[clavePacto(a, b)] = true;
    est.ofertas = est.ofertas.filter(o => !((o.de === a && o.a === b) || (o.de === b && o.a === a)));
    reg(est, `${est.jugadores[a].nombre} y ${est.jugadores[b].nombre} sellan un pacto.`, "pacto");
    crono(est, "pacto", { dueno: a, antes: b });
    est.ev.push({ k: "pacto", a, b });
    actualizarVision(est, a); actualizarVision(est, b);
  }
  /* Si solo quedan bandos que no se pueden atacar entre sí y no son un equipo de verdad, los pactos se acaban sin castigo */
  function revisarPactos(est) {
    if (!est.pactos || !Object.keys(est.pactos).length) return;
    const quedan = vivos(est);
    // Los pactos con un bando eliminado se borran
    Object.keys(est.pactos).forEach(k => { const a = Math.floor(k / 8), b = k % 8; if (est.jugadores[a].eliminado || est.jugadores[b].eliminado) delete est.pactos[k]; });
    if (quedan.length > 1 && quedan.every(a => quedan.every(b => mismoEquipo(est, a, b))) && !quedan.every(k => equipoFijo(est, quedan[0], k))) {
      est.pactos = {};
      reg(est, "Ya no queda nadie más contra quien unirse. Los pactos se rompen.", "pacto");
      quedan.forEach(q => actualizarVision(est, q));
    }
  }
  function razonNoTraicion(est, j) {
    const jug = est.jugadores[j];
    if (est.activo !== j) return "No es tu turno.";
    if (jug.traiciono) return "Ya traicionaste una vez en esta guerra.";
    if (enTregua(est)) return `Hay tregua hasta el turno ${est.tregua}.`;
    const equipo = est.jugadores.some(o => o.id !== j && !o.eliminado && equipoFijo(est, j, o.id));
    if (!pactoDe(est, j) && !equipo) return "No tienes a quién traicionar.";
    return null;
  }
  /* Cuántos y quiénes se irían: la cuarta parte de los soldados, los que están más cerca de los aliados */
  function desertoresDe(est, j) {
    const aliados = est.jugadores.filter(o => o.id !== j && !o.eliminado && mismoEquipo(est, j, o.id)).map(o => o.id);
    const suyas = [];
    for (const uid in est.unidades) { const w = est.unidades[uid]; if (aliados.includes(w.dueno)) suyas.push(w); }
    Object.values(est.ciudades).forEach(c => { if (aliados.includes(c.dueno)) suyas.push(c); });
    const tropa = unidadesDe(est, j).filter(u => u.s && !u.lider && !u.heroe);
    const n = tropa.length ? Math.max(1, Math.ceil(tropa.length * 0.25)) : 0;
    const cerca = u => suyas.reduce((m, w) => Math.min(m, dist(u, w)), 99);
    return tropa.map(u => ({ u, d: cerca(u) })).sort((a, b) => a.d - b.d || (a.u.uid < b.u.uid ? -1 : 1)).slice(0, n).map(o => o.u);
  }
  function traicionar(est, j) {
    const jug = est.jugadores[j];
    const antes = est.jugadores.filter(o => o.id !== j && !o.eliminado && mismoEquipo(est, j, o.id));
    const seVan = desertoresDe(est, j);
    seVan.forEach(u => {
      soltarReliquia(est, u);
      delete est.unidades[u.uid];
      est.ev.push({ k: "deserta", uid: u.uid, x: u.x, y: u.y });
      est.desertores.push({ clase: u.clase, s: JSON.parse(JSON.stringify(u.s)), de: j });
      est.desertaron.push({ id: u.s.id, de: j, nombre: nombreUnidad(u) });
    });
    Object.keys(est.pactos).forEach(k => { const a = Math.floor(k / 8), b = k % 8; if (a === j || b === j) delete est.pactos[k]; });
    // En una guerra por equipos, el traidor se queda solo
    if (jug.equipo !== null && jug.equipo !== undefined) jug.equipo = 100 + j;
    jug.traiciono = true; jug.traidor = true;
    const nombres = antes.map(o => o.nombre).join(" y ");
    reg(est, `${jug.nombre} traiciona a ${nombres}. ${seVan.length === 1 ? "Un soldado se niega y deserta" : `${seVan.length} soldados se niegan y desertan`}.`, "pacto");
    crono(est, "traicion", { dueno: j, antes: antes.length ? antes[0].id : null, desertores: seVan.length });
    est.ev.push({ k: "traicion", dueno: j });
    est.jugadores.forEach((o, k) => { if (!o.eliminado) actualizarVision(est, k); });
  }

  /* Huella corta del estado: sirve para comprobar que dos navegadores ven la misma guerra */
  function firma(est) {
    let h = 2166136261;
    const mete = n => { h ^= (n | 0); h = Math.imul(h, 16777619); };
    mete(est.turno); mete(est.activo); mete(est.rs); mete(est.ganador === null ? -9 : est.ganador === "empate" ? -8 : est.ganador);
    Object.keys(est.unidades).sort().forEach(k => { const u = est.unidades[k]; mete(parseInt(k.slice(1), 10)); mete(u.x * 64 + u.y); mete(u.hp); mete(u.dueno + 2); });
    est.jugadores.forEach(j => { Object.keys(j.recursos).sort().forEach(k => mete(j.recursos[k])); mete(j.eliminado ? 1 : 0); });
    Object.keys(est.ciudades).sort().forEach(k => { const c = est.ciudades[k]; mete(c.dueno === null ? -1 : c.dueno); mete(c.nivel); mete(c.edificios.length); });
    return (h >>> 0).toString(16);
  }

  /* Un jugador se rinde en su turno (guerras de varios jugadores): queda fuera y el turno pasa al siguiente */
  function rendir(est, j) {
    if (est.ganador !== null || !est.jugadores[j] || est.jugadores[j].eliminado) return;
    eliminar(est, j, null, `${est.jugadores[j].nombre} se rinde.`);
    if (est.ganador === null && est.activo === j) terminarTurno(est);
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
        const antesAgua = enAgua(est, u);
        u.pm -= destino.c;
        u.recorrido = (u.recorrido || 0) + ruta.length - 1;
        u.x = acc.x; u.y = acc.y; u.quieto = false; u.descanso = false;
        if (destino.fin || (!esBarco(u) && antesAgua !== enAgua(est, u) && !(navalDe(est, j).marinos || navalDe(est, j).fondo))) u.pm = 0;
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
        if (!t || !hostil(est, t.dueno, j)) return error("No hay un enemigo ahí.");
        const razonA = razonNoAtacar(est, u, t);
        if (razonA) return error(razonA);
        const pmAntes = u.pm;
        u.atacado = true; u.quieto = false; u.descanso = false;
        atacarUnidad(est, u, t, false);
        if (est.unidades[u.uid]) {
          u.pm = CLASES[u.clase].golpeaYSigue ? pmAntes : u.clase === "cazador" && !usaPolvora(est, u) ? Math.min(pmAntes, 2) : 0;
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
        if (CLASES[acc.clase].naval) {
          // Un barco: sale al agua de al lado, con su nombre pintado en la proa
          const pa = aguaLibreCerca(est, ciudad);
          const usados = new Set(Object.values(est.unidades).map(w => w.nombre));
          const libres = D.NOMBRES_BARCO.filter(n => !usados.has(n));
          const nombre = libres.length ? libres[ri(est, libres.length)] : CLASES[acc.clase].nombre;
          const b = nuevaUnidad(est, j, acc.clase, pa.x, pa.y, null, { nombre, nuevo: true });
          b.pm = 0; b.atacado = true;
          est.ev.push({ k: "nuevo", uid: b.uid, x: b.x, y: b.y });
          ciudad.reclutado = true;
          reg(est, `${jug.nombre} bota ${nombre}, ${D.CLASES[acc.clase].nombre.toLowerCase()}, en ${ciudad.nombre}.`, "recluta");
          actualizarVision(est, j);
          return { ok: true, ev: est.ev, uid: b.uid };
        }
        const p = casillaLibreCerca(est, ciudad, j);
        const fac = FACCIONES[jug.faccion];
        const r = { s: est.rs };
        let s = S.crearSoldado(r, { clase: acc.clase, cultura: fac.cultura, origen: elegirDe(est, fac.origenes), anio: est.anio });
        est.rs = r.s;
        // Desertores de una traición: quien entrena esa misma tropa puede encontrarse con uno de ellos
        const iDes = (est.desertores || []).findIndex(d => d.clase === acc.clase && d.de !== j);
        if (iDes >= 0 && rn(est) < 0.5) {
          const d = est.desertores.splice(iDes, 1)[0];
          s = d.s; s.desertorDe = d.de;
          reg(est, `${S.nombreCompleto(s)}, que desertó de ${est.jugadores[d.de].nombre}, se presenta ante ${jug.nombre}.`, "suceso");
        }
        if (ciudad.edificios.includes("academia_militar")) s.victorias += 3;
        if (ciudad.edificios.includes("dojo")) s.victorias += 2;
        const u = nuevaUnidad(est, j, s.clase, p.x, p.y, s, { nuevo: true });
        if (ciudad.edificios.includes("arsenal")) u.bonoEq = { atq: 1 };
        u.pm = 0; u.atacado = true;
        est.ev.push({ k: "nuevo", uid: u.uid, x: u.x, y: u.y });
        ciudad.reclutado = true;
        reg(est, `${jug.nombre} recluta a ${S.nombreCompleto(s)}, ${D.tropa(jug.faccion, s.clase).nombre.toLowerCase()}.`, "recluta");
        actualizarVision(est, j);
        return { ok: true, ev: est.ev, uid: u.uid };
      }
      case "construir": {
        const razon = razonNoConstruir(est, j, acc.ciudad, acc.edificio);
        if (razon) return error(razon);
        const ciudad = est.ciudades[acc.ciudad];
        pagar(jug, costeEdificio(est, j, acc.edificio));
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
      case "invocar": {
        const rq = requisitosHeroe(est, j, acc.heroe, acc.ciudad);
        if (!rq.ok) return error(rq.razon);
        const ciudad = est.ciudades[acc.ciudad];
        const h = HEROES[acc.heroe];
        pagar(jug, h.coste);
        const p = casillaLibreCerca(est, ciudad, j);
        const ficha = jug.heroes.find(x => x.id === acc.heroe);
        const u = nuevaUnidad(est, j, "heroe", p.x, p.y, null, { heroe: acc.heroe, nombre: ficha.nombre, cd: 0, cd2: 0 });
        u.pm = 0; u.atacado = true;
        jug.heroeInvocado = acc.heroe; jug.heroeUid = u.uid;
        if (h.ef.temible) est.hayTemible = true;
        est.ev.push({ k: "heroe", uid: u.uid, x: u.x, y: u.y, dueno: j });
        reg(est, `${jug.nombre} invoca a ${ficha.nombre}.`, "heroe");
        crono(est, "heroe", { dueno: j, nombre: ficha.nombre, ciudad: ciudad.nombre });
        (h.ef.llegaCon || []).forEach(clase => {
          if (unidadesDe(est, j).length >= MAX_UNIDADES) return;
          const lib = casillaLibreCerca(est, ciudad, j);
          if (!lib) return;
          const fac = FACCIONES[jug.faccion];
          const r = { s: est.rs };
          const sol = S.crearSoldado(r, { clase, cultura: fac.cultura, origen: elegirDe(est, fac.origenes), anio: est.anio });
          est.rs = r.s;
          const n = nuevaUnidad(est, j, clase, lib.x, lib.y, sol);
          n.pm = 0; n.atacado = true;
          est.ev.push({ k: "nuevo", uid: n.uid, x: n.x, y: n.y });
        });
        actualizarVision(est, j);
        return { ok: true, ev: est.ev, uid: u.uid };
      }
      case "pacto": {
        const razon = razonNoPacto(est, j, acc.con);
        if (razon) return error(razon);
        const otro = est.jugadores[acc.con];
        jug.propuso = jug.propuso || {};
        jug.propuso[acc.con] = est.turno;
        if (otro.humano) {
          est.ofertas.push({ de: j, a: acc.con, turno: est.turno });
          reg(est, `${jug.nombre} propone un pacto a ${otro.nombre}.`, "pacto");
          return { ok: true, ev: est.ev, pendiente: true };
        }
        if (!aceptaPacto(est, acc.con, j)) { reg(est, `${otro.nombre} rechaza el pacto de ${jug.nombre}.`, "pacto"); return { ok: true, ev: est.ev, aceptado: false }; }
        sellarPacto(est, j, acc.con);
        return { ok: true, ev: est.ev, aceptado: true };
      }
      case "responder": {
        const i = est.ofertas.findIndex(o => o.a === j && o.de === acc.de);
        if (i < 0) return error("No hay ninguna propuesta de ese bando.");
        est.ofertas.splice(i, 1);
        if (!acc.si) { reg(est, `${jug.nombre} rechaza el pacto de ${est.jugadores[acc.de].nombre}.`, "pacto"); return { ok: true, ev: est.ev, aceptado: false }; }
        if (razonNoPacto(est, j, acc.de, true)) return error("Ese pacto ya no es posible.");
        sellarPacto(est, acc.de, j);
        return { ok: true, ev: est.ev, aceptado: true };
      }
      case "traicionar": {
        const razon = razonNoTraicion(est, j);
        if (razon) return error(razon);
        traicionar(est, j);
        return { ok: true, ev: est.ev };
      }
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
      if (!c || c.est || unidadEn(est, acc.x, acc.y) || dist(u, acc) > e.alc || !["llanura", "bosque", "desierto"].includes(acc.a) || (TERRENOS[c.t].mov === 0 && c.t !== "agua")) return error("No se puede cambiar esa casilla.");
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
      if (!ciudad || ciudad.dueno === null || !hostil(est, ciudad.dueno, j) || dist(u, ciudad) > 1) return error("Tiene que estar junto a una ciudad enemiga.");
      if (enTregua(est)) return error(`Hay tregua hasta el turno ${est.tregua}.`);
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
    if (acc.id === "consagrar") {
      const fac = FACCIONES[jug.faccion];
      if (u.clase !== "sanador" || !fac.mods.consagra) return error("Solo los consagradores consagran.");
      if (u.atacado) return error("Ya actuó este turno.");
      const n = consagrar(est, j, u.x, u.y, tieneEdificio(est, j, "catedral") ? 2 : 1);
      if (!n) return error("Este terreno ya está consagrado.");
      u.atacado = true; u.pm = 0;
      est.ev.push({ k: "consagra", x: u.x, y: u.y, dueno: j });
      reg(est, `${nombreUnidad(u)} consagra el terreno.`, "magia");
      return { ok: true, ev: est.ev };
    }
    if (acc.id === "sobornar") {
      const fac = FACCIONES[jug.faccion];
      if (!fac.mods.soborno || u.heroe) return error("Tu ejército no soborna.");
      if (u.atacado) return error("Ya actuó este turno.");
      const coste = { oro: efHeroe(est, j).sobornoMitad ? Math.ceil(fac.mods.soborno / 2) : fac.mods.soborno };
      const r = contratar(est, j, u, acc, coste, 2);
      if (r) return error(r);
      return { ok: true, ev: est.ev };
    }
    if (acc.id === "heroe") {
      const h = heroeDe(u);
      const ab = h && (acc.n === 2 ? h.ef.activa2 : h.ef.activa);
      if (!ab) return error("No tiene esa habilidad.");
      const campo = acc.n === 2 ? "cd2" : "cd";
      if (u[campo] > 0) return error(`Le faltan ${u[campo]} turnos para repetirla.`);
      if (u.atacado) return error("Ya actuó este turno.");
      if (ab.coste && !puedePagar(jug, ab.coste)) return error("No te alcanzan los recursos.");
      const lejos = ab.alc && dist(u, acc) > ab.alc;
      if (ab.id === "formar") {
        const vec = vecinosAliados(est, u);
        if (!vec.length) return error("No tiene aliados al lado.");
        vec.concat([u]).forEach(w => { w.efectos.formado = est.turno + 1; });
        est.ev.push({ k: "aura", x: u.x, y: u.y, dueno: j });
      } else if (ab.id === "contratar") {
        const r = contratar(est, j, u, acc, ab.coste || {}, 3);
        if (r) return error(r);
        u[campo] = ab.cd;
        return { ok: true, ev: est.ev };
      } else if (ab.id === "area") {
        if (!dentro(est, acc.x, acc.y) || lejos) return error("Está fuera de alcance.");
        if (enTregua(est)) return error(`Hay tregua hasta el turno ${est.tregua}.`);
        const dianas = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const w = unidadEn(est, acc.x + dx, acc.y + dy); if (w && hostil(est, w.dueno, j)) dianas.push(w); }
        if (!dianas.length) return error("No hay enemigos ahí.");
        est.ev.push({ k: "explosion", x: acc.x, y: acc.y, de: u.uid });
        dianas.forEach(w => { if (!est.unidades[w.uid]) return; est.ev.push({ k: "golpe", de: u.uid, a: w.uid, x: w.x, y: w.y, dmg: ab.dano, dist: 0, arma: "salpica" }); w.descanso = false; aplicarDano(est, w, ab.dano, u); });
      } else if (ab.id === "curar") {
        const heridos = unidadesDe(est, j).filter(w => dist(u, w) <= ab.radio && w.hp < ef(est, w).hpMax);
        if (!heridos.length) return error("No hay aliados heridos cerca.");
        heridos.forEach(w => { const antes = w.hp; w.hp = Math.min(ef(est, w).hpMax, w.hp + ab.cura); est.ev.push({ k: "cura", uid: w.uid, x: w.x, y: w.y, n: w.hp - antes }); });
      } else if (ab.id === "muro") {
        const c = casilla(est, acc.x, acc.y);
        if (!c || lejos || c.est || unidadEn(est, acc.x, acc.y) || TERRENOS[c.t].mov === 0) return error("No se puede levantar un muro ahí.");
        est.muros.push({ x: acc.x, y: acc.y, hasta: est.turno + 2, dueno: j });
        est.ev.push({ k: "muro", x: acc.x, y: acc.y });
      } else if (ab.id === "alzar") {
        const cand = est.tumbas.filter(t => t.dueno === j).sort((a, b) => (b.s.victorias || 0) - (a.s.victorias || 0))[0];
        if (!cand) return error("No hay ningún aliado caído.");
        if (unidadesDe(est, j).length >= MAX_UNIDADES) return error("Ya tienes el máximo de unidades.");
        const lib = casillaLibreCerca(est, u, j);
        if (!lib) return error("No hay sitio libre a su lado.");
        est.tumbas.splice(est.tumbas.indexOf(cand), 1);
        const sol = cand.s;
        sol.reanimado = true; sol.muerte = null; sol.equipo = {};
        const n = nuevaUnidad(est, j, cand.clase, lib.x, lib.y, sol);
        n.hp = Math.min(2, ef(est, n).hpMax); n.pm = 0; n.atacado = true;
        est.ev.push({ k: "nuevo", uid: n.uid, x: n.x, y: n.y });
        crono(est, "reanimacion", { nombre: S.nombreConApodo(sol), dueno: j });
      } else return error("Habilidad desconocida.");
      if (ab.coste) pagar(jug, ab.coste);
      u[campo] = ab.cd; u.atacado = true; u.pm = 0;
      reg(est, `${nombreUnidad(u)} usa ${ab.nombre}.`, "magia");
      comprobarVictoria(est);
      actualizarVision(est, j);
      return { ok: true, ev: est.ev };
    }
    return error("Habilidad desconocida.");
  }
  const nombreCompleto0 = S.nombreConApodo;

  /* Una criatura salvaje pasa a luchar por un bando durante unos turnos, a cambio de oro. Devuelve el motivo si no se puede. */
  function contratar(est, j, u, acc, coste, turnos) {
    const jug = est.jugadores[j];
    const t = unidadEn(est, acc.x, acc.y);
    if (!t || t.dueno !== -1 || dist(u, t) > 1) return "Tiene que haber una criatura salvaje a su lado.";
    if (unidadesDe(est, j).length >= MAX_UNIDADES) return "Ya tienes el máximo de unidades.";
    if (!puedePagar(jug, coste)) return "No te alcanza el oro.";
    pagar(jug, coste);
    t.dueno = j; t.sobornada = est.turno + turnos; t.pm = 0; t.atacado = true; t.guardia = false; t.errante = true;
    u.atacado = true; u.pm = 0;
    est.ev.push({ k: "captura", x: t.x, y: t.y, dueno: j });
    reg(est, `${nombreUnidad(u)} compra a ${nombreUnidad(t)}: luchará por ${jug.nombre} ${turnos} turnos.`, "magia");
    actualizarVision(est, j);
    return null;
  }

  /* Por qué una unidad no puede atacar a otra ahora mismo (null si puede) */
  function razonNoAtacar(est, u, t) {
    if (u.atacado) return "Ya atacó este turno.";
    if (u.clase === "sanador") return "Los sanadores no atacan.";
    if (enTregua(est) && t.dueno >= 0 && u.dueno >= 0) return `Hay tregua hasta el turno ${est.tregua}.`;
    const d = dist(u, t);
    if (d < 1 || d > ef(est, u).alc) return "Está fuera de alcance.";
    if ((polvoraFac(est, u) || CLASES[u.clase].pesado) && !u.quieto) return "No puede moverse y disparar en el mismo turno.";
    const ra = razonAgua(est, u, t);
    if (ra) return ra;
    if (oculta(est, t, u.dueno)) return "La noche lo oculta: no se le ve hasta tener a alguien a su lado.";
    if (d > 1 && t.dueno >= 0 && !t.heroe && vecinosAliados(est, t).some(w => w.heroe && HEROES[w.heroe].ef.velo)) return "Está bajo el velo de su Don: hay que atacarlo de cerca.";
    return null;
  }

  /* Qué le falta a un bando para invocar a un héroe. lista: cada requisito con su marca. */
  function requisitosHeroe(est, j, heroeId, ciudadId) {
    const jug = est.jugadores[j];
    const h = HEROES[heroeId];
    const lista = [];
    if (!h || !jug.heroes.some(x => x.id === heroeId)) return { ok: false, razon: "Tu ejército no puede invocar a ese héroe.", lista };
    (h.req || []).forEach(r => {
      if (r.t === "fortaleza") lista.push({ texto: "Tener una fortaleza", ok: est.fortalezasDueno.some(d => d === j) });
      else if (r.t === "edificio") lista.push({ texto: `Tener ${EDIFICIOS[r.id].nombre}`, ok: tieneEdificio(est, j, r.id) });
      else if (r.t === "escuela") lista.push({ texto: `Dominar ${ESCUELAS[r.e].escalones[r.n - 1].nombre} (${ESCUELAS[r.e].nombre} ${r.n})`, ok: jug.tech[r.e] >= r.n });
      else if (r.t === "cuenta") lista.push({ texto: r.texto, ok: (jug.cuenta[r.k] || 0) >= r.n, lleva: Math.min(r.n, jug.cuenta[r.k] || 0), de: r.n });
      else if (r.t === "ciudades") { const n = ciudadesDe(est, j).length; lista.push({ texto: `Controlar ${r.n} ciudades`, ok: n >= r.n, lleva: Math.min(n, r.n), de: r.n }); }
      else if (r.t === "regiones") { const n = est.regiones.filter(x => x.dueno === j).length; lista.push({ texto: `Controlar ${r.n} regiones`, ok: n >= r.n, lleva: Math.min(n, r.n), de: r.n }); }
      else if (r.t === "turno") lista.push({ texto: `Llegar al turno ${r.n}`, ok: est.turno >= r.n, lleva: Math.min(est.turno, r.n), de: r.n });
      else if (r.t === "mercado") lista.push({ texto: "Controlar el Mercado de las Sombras", ok: Object.values(est.ciudades).some(c => c.mercado && c.dueno === j) });
      else if (r.t === "consagradas") { const n = consagradasDe(est, j); lista.push({ texto: `Tener ${r.n} casillas consagradas`, ok: n >= r.n, lleva: Math.min(n, r.n), de: r.n }); }
    });
    lista.push({ texto: `Pagar ${Object.keys(h.coste).map(k => `${h.coste[k]} de ${D.RECURSO_NOMBRE[k].toLowerCase()}`).join(", ")}`, ok: puedePagar(jug, h.coste), coste: true });
    let razon = null;
    if (jug.heroeInvocado) razon = "Ya invocaste a tu héroe en esta guerra.";
    else if (est.activo !== j) razon = "No es tu turno.";
    else if (lista.some(r => !r.ok)) razon = `Falta: ${lista.find(r => !r.ok).texto.toLowerCase()}.`;
    else if (unidadesDe(est, j).length >= MAX_UNIDADES) razon = "Ya tienes el máximo de unidades.";
    else if (ciudadId !== undefined) {
      const ciudad = est.ciudades[ciudadId];
      if (!ciudad || ciudad.dueno !== j) razon = "Esa ciudad no es tuya.";
      else if (!casillaLibreCerca(est, ciudad, j)) razon = "No hay sitio libre junto a la ciudad.";
    }
    return { ok: !razon, razon, lista };
  }

  /* --- Edificios e investigación --- */
  function terrenoCerca(est, ciudad, tipos) {
    const r = ciudad.nivel >= 3 ? 2 : 1;
    for (let y = ciudad.y - r; y <= ciudad.y + r; y++) for (let x = ciudad.x - r; x <= ciudad.x + r; x++) {
      if (dentro(est, x, y) && tipos.includes(est.casillas[y][x].t)) return true;
    }
    return false;
  }

  /* Lo que cuesta un edificio a un bando (los muelles cambian de precio según el ejército) */
  function costeEdificio(est, j, id) {
    const ed = EDIFICIOS[id], c = Object.assign({}, ed.coste);
    const m = ed.agua ? navalDe(est, j).muelleCoste : 0;
    if (m) Object.keys(c).forEach(k => { c[k] = Math.max(1, Math.round(c[k] * m)); });
    return c;
  }

  function razonNoConstruir(est, j, ciudadId, id) {
    const jug = est.jugadores[j];
    const ciudad = est.ciudades[ciudadId];
    const ed = EDIFICIOS[id];
    if (!ciudad || ciudad.dueno !== j) return "Esa ciudad no es tuya.";
    if (est.activo !== j) return "No es tu turno.";
    if (!ed) return "Ese edificio no existe.";
    if (ciudad.edificios.includes(id)) return "Ya está construido.";
    if (ed.solo && ed.solo !== jug.faccion) return `Solo lo construye ${FACCIONES[ed.solo].corto}.`;
    if (ed.noCapital && ciudad.capital) return "No se construye en la capital.";
    if (id === "refugio" && FACCIONES[jug.faccion].irrefugiable) return "Tu ejército no construye refugios: sin su capital, se deshace.";
    if (id === "refugio" && ciudadesDe(est, j).some(c => c.edificios.includes("refugio"))) return "Ya tienes un refugio.";
    if (ed.agua) {
      const nv = navalDe(est, j);
      if (nv.sinMuelle) return "Tu ejército no construye muelles.";
      if (nv.barcoMax !== undefined && NIVEL_MUELLE[id] > Math.max(1, nv.barcoMax)) return "Tu ejército no sabe hacer flotas mayores.";
      if (!aguaCerca(est, ciudad)) return "No hay agua a dos casillas de la ciudad.";
    }
    // Los muelles están en el agua: no ocupan hueco en la ciudad
    if (!ed.agua && ciudad.edificios.filter(o => !EDIFICIOS[o].agua).length >= ciudad.nivel + 2) return "La ciudad no tiene más huecos. Hazla crecer.";
    if (ed.previo && !ed.previo.some(p => ciudad.edificios.includes(p))) return `Hace falta antes: ${ed.previo.map(p => EDIFICIOS[p].nombre).join(" o ")}.`;
    if (ed.terreno && !terrenoCerca(est, ciudad, ed.terreno)) return "No hay terreno adecuado cerca.";
    if (!ed.agua && ed.nivel >= 3 && ciudad.edificios.some(o => !EDIFICIOS[o].agua && EDIFICIOS[o].nivel >= 3 && EDIFICIOS[o].rama !== ed.rama)) return "La ciudad ya se especializó en otra rama.";
    if (!puedePagar(jug, costeEdificio(est, j, id))) return "No te alcanzan los recursos.";
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
    if (escuela === "arcano" && FACCIONES[jug.faccion].mods.arcanoMax && jug.tech.arcano >= FACCIONES[jug.faccion].mods.arcanoMax) return "La magia de tu ejército no llega más lejos.";
    if (!puedePagar(jug, costeInvestigar(est, j, escuela))) return "No te alcanzan los recursos.";
    return null;
  }

  /* --- Fin de turno --- */
  function terminarTurno(est) {
    const j = est.activo;
    const jug = est.jugadores[j];
    const N = est.jugadores.length;
    // Núcleo del Sueño: quien lo ocupa suma un turno y corta la cuenta de los demás bandos
    const n = est.nucleo;
    const ocupante = unidadEn(est, n.x, n.y);
    if (ocupante && ocupante.dueno === j) {
      est.nucleoHold[j] += 1;
      for (let k = 0; k < N; k++) if (k !== j) est.nucleoHold[k] = 0;
      if (est.nucleoHold[j] === 1) { reg(est, `${jug.nombre} toma posición sobre el Núcleo del Sueño.`, "nucleo"); crono(est, "nucleo", { dueno: j, region: regionDeCasilla(est, n.x, n.y).nombre }); }
    } else est.nucleoHold[j] = 0;
    est.primerTurno = false;
    comprobarVictoria(est);
    if (est.ganador !== null) return;
    // Las propuestas de pacto que nadie contestó caducan a los dos turnos
    if (est.ofertas && est.ofertas.length) est.ofertas = est.ofertas.filter(o => est.turno - o.turno < 2);
    // Pasa al siguiente bando que siga en la guerra. Si se da la vuelta a la mesa, empieza una ronda nueva.
    let k = j, vuelta = false;
    do { k = (k + 1) % N; if (k === 0) vuelta = true; } while (est.jugadores[k].eliminado && k !== j);
    est.activo = k;
    if (vuelta) {
      est.turno += 1;
      if (est.turno > est.maxTurnos) {
        const orden = vivos(est).map(q => ({ q, p: puntuacion(est, q) })).sort((a, b) => b.p - a.p);
        const empate = orden.length > 1 && orden[0].p === orden[1].p && !equipoFijo(est, orden[0].q, orden[1].q);
        terminarGuerra(est, empate ? "empate" : orden[0].q, empate ? "Se acaba el tiempo y las fuerzas quedan igualadas." : `Se acaba el tiempo y ${est.jugadores[orden[0].q].nombre} gana por puntos.`);
        return;
      }
      if (est.tregua && est.turno === est.tregua + 1) reg(est, "Se acaba la tregua.", "turno");
      nuevaRonda(est);
      // Las criaturas sin dueño actúan antes de que juegue el primero de cada ronda
      turnoSalvajes(est);
    }
    comprobarVictoria(est);
    if (est.ganador !== null) return;
    if (est.jugadores[est.activo].eliminado) { const q = vivos(est)[0]; if (q === undefined) return; est.activo = q; }
    iniciarTurno(est, est.activo, false);
  }

  raiz.FracturaMotor = {
    MAX_UNIDADES, rn, ri, clave, dentro, casilla, unidadEn, unidadesDe, ciudadEn, ciudadesDe, esMonstruo, nombreUnidad, regionDeCasilla, reg, crono,
    ef, auras, calcularDano, defensaDelTerreno, alcanzables, camino, aplicar, crearGuerra, puntuacion, ingresoDe, mantenimiento,
    costeReclutar, clasesDisponibles, razonNoReclutar, razonNoConstruir, razonNoInvestigar, costeInvestigar, puedePagar, tieneEdificio, vecinosEnemigos, vecinosAliados,
    veCasilla, actualizarVision, reliquiaNueva, nuevaUnidad, casillaLibreCerca, terminarTurno, bonoReliquias, generarContingenteIA, terminarGuerra, matar, terrenoCerca,
    mismoEquipo, hostil, vivos, rivalesDe, equipoDe, heroeDe, heroeVivo, usaPolvora, enTregua, ganoJugador, requisitosHeroe, razonNoAtacar, consagradaPara, consagradasDe, comeUnidad, eliminar, RASGO_NOMBRE,
    equipoFijo, hayPacto, pactoDe, razonNoPacto, razonNoTraicion, desertoresDe, navalDe, esBarco, enAgua, embarcada, puedeEmbarcar, oculta, veUnidad, razonAgua, esDuelo,
    costeEdificio, aguaCerca, aguaLibreCerca, polvoraFac, firma, rendir
  };
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.FracturaMotor;
})(typeof window !== "undefined" ? window : globalThis);
