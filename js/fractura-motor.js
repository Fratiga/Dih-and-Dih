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
  const SB = raiz.FracturaSaber || (typeof require !== "undefined" ? require("./fractura-saber.js") : null);
  const S = raiz.FracturaSoldados || (typeof require !== "undefined" ? require("./fractura-soldados.js") : null);
  const M = raiz.FracturaMapa || (typeof require !== "undefined" ? require("./fractura-mapa.js") : null);
  const { TERRENOS, ESTRUCTURAS, CLASES, ESPECIALIZACIONES, EDIFICIOS, ESCUELAS, RELIQUIAS, FACCIONES, TIPOS_FRACTURA, DIFICULTADES, RECURSOS, HEROES } = D;
  /* Distancia entre dos cosas del mapa, contando el tamaño de los gigantes (tam 2 ocupa 2×2 desde x, y) */
  const dist = (a, b) => {
    const ta = (a.tam || 1) - 1, tb = (b.tam || 1) - 1;
    return Math.max(Math.max(0, a.x - (b.x + tb), b.x - (a.x + ta)), Math.max(0, a.y - (b.y + tb), b.y - (a.y + ta)));
  };
  const ocupa = (u, x, y) => (u.tam === 2 ? x >= u.x && x <= u.x + 1 && y >= u.y && y <= u.y + 1 : u.x === x && u.y === y);
  const celdasDe = u => (u.tam === 2 ? [{ x: u.x, y: u.y }, { x: u.x + 1, y: u.y }, { x: u.x, y: u.y + 1 }, { x: u.x + 1, y: u.y + 1 }] : [{ x: u.x, y: u.y }]);
  const MAX_UNIDADES = 40;     // tope absoluto (el de cada bando lo da limiteTropas)
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
    for (const uid in est.unidades) { const u = est.unidades[uid]; if (u.tam === 2 && ocupa(u, x, y)) return u; }
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
  /* El héroe propio que tiene una pasiva y alcanza a u (el valor true cuenta como 1 casilla) */
  const heroeCerca = (est, u, k) => {
    if (u.dueno < 0) return null;
    const h = heroeVivo(est, u.dueno);
    if (!h || h === u) return null;
    const v = HEROES[h.heroe].ef[k];
    if (!v) return null;
    const r = typeof v === "number" ? v : v.r || 1;
    return Math.max(Math.abs(h.x - u.x), Math.abs(h.y - u.y)) <= r ? h : null;
  };
  /* Desafío de Genichiro: dos unidades que solo pueden pelear entre ellas */
  const desafioDe = (est, u) => (est.desafios || []).find(d => (d.a === u.uid || d.b === u.uid) && d.hasta >= est.turno && est.unidades[d.a] && est.unidades[d.b]) || null;
  const polvoraFac = (est, u) => !!(u.dueno >= 0 && !u.heroe && facDe(est, u.dueno).mods.polvora && facDe(est, u.dueno).mods.polvora[u.clase]);
  const usaPolvora = (est, u) => polvoraFac(est, u) || !!CLASES[u.clase].canon;
  /* --- El mar --- */
  const SIN_NAVAL = {};
  const navalDe = (est, j) => (j >= 0 && facDe(est, j).naval) || SIN_NAVAL;
  const esBarco = u => !!CLASES[u.clase].naval;
  const enAgua = (est, u) => est.casillas[u.y][u.x].t === "agua";
  const embarcada = (est, u) => !esBarco(u) && !CLASES[u.clase].vuela && enAgua(est, u);
  // Para embarcar hace falta que tu bando (o un aliado) tenga un muelle. Algunos ejércitos no lo necesitan.
  const puedeEmbarcar = (est, j) => j >= 0 && (!!navalDe(est, j).embarcaSinMuelle || equipoDe(est, j).some(q => tieneEdificio(est, q, "muelle")));
  const NIVEL_MUELLE = { muelle: 1, astillero: 2, atarazana: 3 };
  const enTregua = est => est.tregua > 0 && est.turno <= est.tregua;
  /* Los efectos de todo lo que un bando ha aprendido (se guardan en jug.sabEf y se rehacen al investigar) */
  const VACIO = {};
  const sab = (est, j) => (j >= 0 && est.jugadores[j] && est.jugadores[j].sabEf) || VACIO;
  const rehacerSaber = (est, j) => { const jug = est.jugadores[j]; jug.sabEf = SB.efectos(jug.faccion, jug.tech); };
  const tiposDe = u => CLASES[u.clase].tipo || [];
  /* Lo que hace cada soldado en la guerra: de aquí salen sus manías y algunos apodos (se suma a su ficha al acabar) */
  const usar = (u, k, n) => { if (!u || !u.s) return; const g = u.s.usoG || (u.s.usoG = {}); g[k] = (g[k] || 0) + (n === undefined ? 1 : n); };
  /* Cuántas tropas puede tener un bando: lo que da su ejército más lo que da cada ciudad por su nivel, más el saber */
  function limiteTropas(est, j) {
    const fac = facDe(est, j), pb = fac.poblacion || { base: 4, porNivel: [3, 3, 3, 3, 3], tope: 30 };
    let n = pb.base + (sab(est, j).poblacion || 0) + (fac.mods.levaFeudal ? fortalezasDe(est, j).length * fac.mods.levaFeudal : 0), fiesta = 0;
    ciudadesDe(est, j).forEach(c => { for (let k = 0; k < c.nivel && k < pb.porNivel.length; k++) n += pb.porNivel[k]; if (c.obras && c.obras.fiesta >= est.turno) fiesta += 2; });
    // La Fiesta suma por encima del tope del ejército (si no, con el ejército al máximo no serviría de nada); el tope absoluto sigue
    return Math.min(MAX_UNIDADES, Math.min(pb.tope || 30, n) + fiesta);
  }
  /* Las fortalezas de un bando: las del mapa que tiene tomadas y sus ciudades con Fortaleza en uso */
  function fortalezasDe(est, j) {
    const out = [];
    est.fortalezas.forEach((p, i) => { if (est.fortalezasDueno[i] === j) out.push({ x: p.x, y: p.y }); });
    ciudadesDe(est, j).forEach(c => { if (c.edificios.includes("fortaleza") && !(c.desh.fortaleza >= est.turno)) out.push({ x: c.x, y: c.y }); });
    return out;
  }
  // Los reanimados no cuentan para el límite
  const cuentaTropas = (est, j) => unidadesDe(est, j).filter(u => !u.reanimado && !u.invocado).length;
  const hayHueco = (est, j) => cuentaTropas(est, j) < limiteTropas(est, j);
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
    if (u.dueno < 0 || desafioDe(est, u)) return a;   // en un desafío no hay ayudas
    const jug = est.jugadores[u.dueno];
    const fac = FACCIONES[jug.faccion];
    for (const uid in est.unidades) {
      const w = est.unidades[uid];
      if (w.dueno !== u.dueno) continue;
      const d = dist(u, w);
      if (d > 3) continue;
      if (d <= 2 && w.lider && !jug.liderMuerto) {
        const al = fac.lider.aura;
        a.def += al.auraDef || 0; a.atq += al.auraAtq || 0;
      }
      if (d <= 2 && w.s && w.s.equipo && w.s.equipo.estandarte) {
        const inst = est.reliquias[w.s.equipo.estandarte];
        if (inst) { a.def += inst.bono.auraDef || 0; a.atq += inst.bono.auraAtq || 0; a.mov += inst.bono.auraMov || 0; }
      }
      if (d <= 1 && w !== u && w.clase === "paladin") a.def += 1;
      if (d <= 1 && w !== u && w.clase === "capo") a.atq += 1;
      if (d <= 1 && w !== u && CLASES[w.clase].auraAtq1) a.atq += CLASES[w.clase].auraAtq1;
      if (w !== u && w.heroe) {
        const he = HEROES[w.heroe].ef;
        if (he.auraAtq && d <= he.auraAtq.r) a.atq += he.auraAtq.n;
        if (he.auraDef && d <= he.auraDef.r) a.def += he.auraDef.n;
        if (d <= 2) a.atq += he.auraAtq2 || 0;
        if (d <= 1) a.def += he.auraDef1 || 0;
      }
      if (d <= 2 && w !== u && w.s && u.s && w.s.capitan && w.s.compania && w.s.compania === u.s.compania) a.def += 1;
    }
    return a;
  }

  /* Berserker: +1 de ataque y +1 de defensa por cada enemigo pegado a él de más que aliados pegados, hasta +3 (un gigante cuenta una vez) */
  function minoriaBerserker(est, u) {
    let enemigos = 0, aliados = 0;
    for (const id in est.unidades) {
      const w = est.unidades[id];
      if (w === u || dist(w, u) > 1) continue;
      if (hostil(est, w.dueno, u.dueno)) { if (w.dueno >= 0 || w.errante || w.guardia) enemigos++; }
      else if (w.dueno >= 0) aliados++;
    }
    return Math.min(3, Math.max(0, enemigos - aliados));
  }
  function ef(est, u, sinAyuda) {
    const cl = CLASES[u.clase];
    const s = u.s;
    const jug = u.dueno >= 0 ? est.jugadores[u.dueno] : null;
    const fac = jug ? FACCIONES[jug.faccion] : null;
    const H = heroeDe(u);
    let hpMax = cl.hp, atq = cl.atq, def = cl.def, mov = cl.mov, alc = cl.alc, vision = 2 + (cl.vision || 0), cura = 0;
    if (H) { hpMax = H.hp; atq = H.atq; def = H.def; mov = H.mov; alc = H.alc; vision = 3; }
    hpMax += Math.min(5, u.trofeos || 0);   // trofeos de caza (Okran)
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
      const se = jug.sabEf || VACIO;
      const m = fac.mods || {};
      if (m.hpClase && m.hpClase[u.clase]) hpMax += m.hpClase[u.clase];
      if (m.atqClase && m.atqClase[u.clase]) atq += m.atqClase[u.clase];
      if (polvoraFac(est, u)) atq += 2;
      if (cl.naval) { const nv = fac.naval || SIN_NAVAL; mov += nv.barcoMov || 0; atq += nv.barcoAtq || 0; def += nv.barcoDef || 0; }
      const eh = efHeroe(est, u.dueno);
      if (eh.atqClaseAliada && eh.atqClaseAliada[u.clase]) atq += eh.atqClaseAliada[u.clase];
      if (eh.defClaseAliada && eh.defClaseAliada[u.clase]) def += eh.defClaseAliada[u.clase];
      if (H && H.ef.rencor) atq += Math.min(12, u.rencor || 0);
      if (cl.naval) { const hb = heroeCerca(est, u, "barcosAtq"); if (hb) atq += HEROES[hb.heroe].ef.barcosAtq.n; }
      // Lo aprendido: para todas las tropas, por tropa y por tipo de tropa
      if (!H && !u.lider) {
        const tps = cl.tipo || [];
        const suma = (k, base) => { let v = (se[k] || 0) + ((se[`${k}Clase`] && se[`${k}Clase`][u.clase]) || 0); if (se[`${k}Tipo`]) tps.forEach(tp => { v += se[`${k}Tipo`][tp] || 0; }); return base + v; };
        hpMax = suma("hp", hpMax); atq = suma("atq", atq); def = suma("def", def); mov = suma("mov", mov); alc = suma("alc", alc);
        vision += se.vision || 0;
        if (se.veteranos && s && S.rangoIndice(s.victorias + (u.vicG || 0)) >= 2) { atq += +se.veteranos; def += +se.veteranos; }
        if (cl.naval) { mov += se.barcoMov || 0; atq += se.barcoAtq || 0; def += se.barcoDef || 0; }
      }
      if (!sinAyuda && se.formacion && vecinosAliados(est, u).some(w => w.clase === u.clase)) def += +se.formacion;
      // Enjambre (Mravec): con dos o más aliados al lado
      if (!sinAyuda && m.enjambre && vecinosAliados(est, u).length >= 2) def += m.enjambre;
      cura += se.cura || 0;
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
    if (u.efectos && u.efectos.formado && u.efectos.formado >= est.turno) def += u.efectos.formadoN || 1;
    if (u.efectos && u.efectos.postura) def += 2;   // Postura (Seosan)
    if (u.efectos && u.efectos.miasma && u.efectos.miasma.hasta >= est.turno) atq -= u.efectos.miasma.n;
    if (u.efectos && u.efectos.marea >= est.turno) atq += 2;
    if (u.bonoDesafio) atq += u.bonoDesafio;
    if (u.clase === "mercenario" && u.dueno >= 0 && est.jugadores[u.dueno].pagaDobleT === est.turno) atq += 2;
    hpMax = Math.max(1, hpMax);
    // Furia (Okran): cada cuarto de vida perdido da ataque
    if (jug && fac) {
      const tope = (H && H.ef.furia) || (fac.mods.furia ? fac.mods.furia + ((jug.sabEf && jug.sabEf.furia) || 0) : 0);
      if (tope && u.hp < hpMax) atq += Math.min(tope, Math.floor((1 - u.hp / hpMax) * Math.max(4, tope + 1)));
      // Berserker (Okran): en minoría pega y aguanta más (embarcado sigue sin defensa)
      if (u.clase === "berserker") { const m = minoriaBerserker(est, u); atq += m; if (!enAgua(est, u)) def += m; }
      // Noche eterna (Nikaalia): quien tiene a Nikaalia de rival ve una casilla menos
      if (est.hayNoche && !fac.mods.noche && est.jugadores.some(o => !o.eliminado && FACCIONES[o.faccion].mods.noche && hostil(est, o.id, u.dueno))) vision = Math.max(1, vision - 1);
    }
    // Temible (Rykerd): los enemigos que tiene al lado pegan menos
    if (est.hayTemible) est.jugadores.forEach((o, k) => {
      if (k === u.dueno || u.heroe || !hostil(est, k, u.dueno)) return;
      const hv = heroeVivo(est, k), tm = hv && HEROES[hv.heroe].ef.temible;
      if (tm && Math.max(Math.abs(hv.x - u.x), Math.abs(hv.y - u.y)) <= (tm.r || 1)) atq -= tm.n || 1;
    });
    if (u.tam === 2 && H && H.modoAgua === "puente" && celdasDe(u).some(q => est.casillas[q.y][q.x].t === "agua")) def = 0;
    return { atq: Math.max(0, atq), def: Math.max(0, def), mov: Math.max(1, mov), alc: Math.max(1, alc), hpMax, vision, cura };
  }

  /* Unidades pegadas a una: una sola pasada por todas las unidades (se llama muchísimo) */
  function vecinosAliados(est, u) {
    const out = [];
    for (const uid in est.unidades) {
      const w = est.unidades[uid];
      if (w !== u && w.dueno === u.dueno && dist(w, u) <= 1) out.push(w);
    }
    return out;
  }
  const vecinosEnemigos = (est, u) => {
    const out = [];
    for (const uid in est.unidades) {
      const w = est.unidades[uid];
      if (w !== u && dist(w, u) <= 1 && hostil(est, w.dueno, u.dueno)) out.push(w);
    }
    return out;
  };

  /* --- Recursos --- */
  const puedePagar = (jug, coste) => Object.keys(coste).every(k => (jug.recursos[k] || 0) >= coste[k]);
  function pagar(jug, coste) { Object.keys(coste).forEach(k => { jug.recursos[k] -= coste[k]; }); }
  const sumar = (jug, k, n) => { jug.recursos[k] = (jug.recursos[k] || 0) + n; };

  function tieneEdificio(est, j, id) { return ciudadesDe(est, j).some(c => c.edificios.includes(id) && !(c.desh[id] >= est.turno)); }

  /* --- Campamentos nómadas (Okran) --- */
  const COSTE_CAMPAMENTO = { materiales: 6, comida: 4 }, MAX_CAMPAMENTOS = 2, DURA_CAMPAMENTO = 6;
  const CLASES_CAMPAMENTO = ["guerrero", "cazador"];
  const campamentoEn = (est, x, y) => (est.campamentos || []).find(cp => cp.x === x && cp.y === y) || null;
  function razonCampamento(est, j, u, x, y) {
    const jug = est.jugadores[j], fac = FACCIONES[jug.faccion];
    if (!u || u.dueno !== j || fac.mods.campamento !== u.clase) return "Esa tropa no levanta campamentos.";
    if (!sab(est, j).campamento) return "Hace falta aprender Fuegos de campamento (Clanes).";
    if (u.atacado) return "Ya actuó este turno.";
    if ((est.campamentos || []).filter(cp => cp.dueno === j).length >= MAX_CAMPAMENTOS) return `Ya tienes ${MAX_CAMPAMENTOS} campamentos.`;
    if (!puedePagar(jug, COSTE_CAMPAMENTO)) return "No te alcanzan los recursos.";
    if (x === undefined) return null;
    const c = casilla(est, x, y);
    if (!c || dist(u, { x, y }) > 1 || TERRENOS[c.t].mov === 0 || c.est || unidadEn(est, x, y) || campamentoEn(est, x, y)) return "Elige una casilla libre de tierra a su lado.";
    if (Object.values(est.unidades).some(w => hostil(est, w.dueno, j) && w.dueno >= 0 && dist(w, { x, y }) <= 2)) return "Hay enemigos demasiado cerca.";
    if (Object.values(est.ciudades).some(ci => ci.dueno !== null && hostil(est, ci.dueno, j) && dist(ci, { x, y }) <= 2)) return "Está demasiado cerca de una ciudad enemiga.";
    return null;
  }
  function razonReclutarCampamento(est, j, id, clase) {
    const cp = (est.campamentos || []).find(c => c.id === id && c.dueno === j);
    if (!cp) return "Ese campamento ya no existe.";
    if (est.activo !== j) return "No es tu turno.";
    if (cp.reclutado) return "Ese campamento ya entrenó una tropa este turno.";
    if (!CLASES_CAMPAMENTO.includes(clase) || !clasesDisponibles(est, j).includes(clase)) return "En un campamento solo se entrenan las tropas básicas.";
    if (!hayHueco(est, j)) return "Has llegado al límite de tropas.";
    if (!puedePagar(est.jugadores[j], costeReclutar(est, j, clase, null))) return "No te alcanzan los recursos.";
    if (!unidadEn(est, cp.x, cp.y) && TERRENOS[est.casillas[cp.y][cp.x].t].mov > 0) return null;
    return casillaLibreCerca(est, cp, j) ? null : "No hay sitio libre junto al campamento.";
  }
  function costeReclutar(est, j, clase, ciudad) {
    const jug = est.jugadores[j], fac = FACCIONES[jug.faccion];
    const c = Object.assign({}, CLASES[clase].coste);
    const mc = fac.mods.costeClase && fac.mods.costeClase[clase];
    if (mc) Object.keys(mc).forEach(k => { c[k] = Math.max(0, (c[k] || 0) + mc[k]); });
    if (ciudad && ciudad.edificios.includes("cuartel") && c.oro && clase !== "mercenario" && !CLASES[clase].naval) c.oro = Math.max(0, c.oro - 1);
    if (c.oro && sab(est, j).reclutaOro && !CLASES[clase].naval) c.oro = Math.max(1, c.oro - sab(est, j).reclutaOro);
    if (fac.mods.sinComida) delete c.comida;
    Object.keys(c).forEach(k => { if (!c[k]) delete c[k]; });
    return c;
  }

  function clasesDisponibles(est, j) {
    const fac = FACCIONES[est.jugadores[j].faccion];
    const lista = D.CLASES_BASE.slice();
    (fac.clasesExtra || []).forEach(c => lista.push(c));
    // Las que se desbloquean con el saber de este ejército (salen en la ciudad aunque aún no se puedan entrenar)
    SB.posibles(fac.id || est.jugadores[j].faccion).forEach(c => { if (!lista.includes(c)) lista.push(c); });
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
    if (!hayHueco(est, j)) return `Ya tienes el máximo de tropas (${limiteTropas(est, j)}). Haz crecer tus ciudades para tener más.`;
    if (cl.unico && unidadesDe(est, j).filter(u => u.clase === clase).length >= cl.unico) return "Solo puede haber uno.";
    const rq = cl.requiere || {};
    if (rq.saber && !(sab(est, j).desbloquea || []).includes(clase)) return `Hace falta ${quienDesbloquea(est, j, clase)}.`;
    if (rq.edificio && !(ciudad.edificios.includes(rq.edificio) && !(ciudad.desh[rq.edificio] >= est.turno))) return `Hace falta ${EDIFICIOS[rq.edificio].nombre} en la ciudad.`;

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
  /* Casillas de agua libres a dos casillas de la ciudad, con lo grande que es el agua a la que dan (un lago o el mar) */
  function aguasLibres(est, ciudad) {
    const tam = new Map(), out = [];
    const medir = (x0, y0) => {
      const k0 = y0 * 64 + x0;
      if (tam.has(k0)) return tam.get(k0);
      const vis = new Set([k0]), cola = [{ x: x0, y: y0 }];
      while (cola.length && vis.size < 400) {
        const p = cola.pop();
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = p.x + dx, y = p.y + dy, k = y * 64 + x;
          if ((!dx && !dy) || vis.has(k) || !dentro(est, x, y) || est.casillas[y][x].t !== "agua") continue;
          vis.add(k); cola.push({ x, y });
        }
      }
      vis.forEach(k => tam.set(k, vis.size));
      return vis.size;
    };
    for (let y = ciudad.y - 2; y <= ciudad.y + 2; y++) for (let x = ciudad.x - 2; x <= ciudad.x + 2; x++) {
      if (!dentro(est, x, y) || est.casillas[y][x].t !== "agua" || unidadEn(est, x, y)) continue;
      out.push({ x, y, d: Math.abs(x - ciudad.x) + Math.abs(y - ciudad.y), tam: medir(x, y) });
    }
    return out;
  }
  function aguaLibreCerca(est, ciudad) {
    // La máquina (y quien no elige) bota el barco en el agua más grande, no en un lago cerrado
    return aguasLibres(est, ciudad).sort((a, b) => (b.tam - a.tam) || (a.d - b.d) || (a.y - b.y) || (a.x - b.x))[0] || null;
  }

  /* El escalón del saber que desbloquea una tropa (para decir qué falta) */
  function quienDesbloquea(est, j, clase) {
    const f = est.jugadores[j].faccion;
    for (const r of SB.ramas(f)) for (let i = 0; i < r.escalones.length; i++) if ((r.escalones[i].ef.desbloquea || []).includes(clase)) return `${r.escalones[i].nombre} (${r.nombre} ${["I", "II", "III", "IV", "V", "VI"][i]})`;
    for (const c of SB.cruces(f)) if ((c.ef.desbloquea || []).includes(clase)) return c.nombre;
    return "un saber que tu ejército no tiene";
  }

  /* El Portal: mueve una tropa al instante entre dos ciudades propias con portal */
  const pesada = u => u.heroe || u.lider || (CLASES[u.clase].tipo || []).some(t => t === "jinete_pesado" || t === "monstruo" || t === "asedio");
  const costePortal = u => (pesada(u) ? { oro: 8, mana: 4 } : { oro: 4, mana: 2 });
  const conPortal = (est, c) => c.edificios.includes("portal") && !(c.desh.portal >= est.turno);
  const cercada = (est, c) => !!c.asedio || Object.values(est.unidades).some(w => w.dueno !== c.dueno && hostil(est, w.dueno, c.dueno) && (w.dueno >= 0 || w.errante) && dist(w, c) <= 1);
  /* La ciudad con portal desde la que sale una tropa: está en ella o a su lado */
  const ciudadPortalDe = (est, u) => ciudadesDe(est, u.dueno).find(c => conPortal(est, c) && dist(c, u) <= 1) || null;
  function razonNoPortal(est, j, uid, destino) {
    const u = est.unidades[uid];
    if (!u || u.dueno !== j) return "Esa tropa no es tuya.";
    if (est.activo !== j) return "No es tu turno.";
    if (u.atacado) return "Ya actuó este turno.";
    if (esBarco(u)) return "Los barcos no caben por un portal.";
    const de = ciudadPortalDe(est, u);
    if (!de) return "Tiene que estar en una ciudad tuya con portal, o a su lado.";
    const a = est.ciudades[destino];
    if (!a || a.dueno !== j || !conPortal(est, a)) return "La ciudad de llegada necesita un portal.";
    if (a === de) return "Elige otra ciudad.";
    if (de.portalT === est.turno || a.portalT === est.turno) return "Uno de los dos portales ya se usó este turno.";
    if (cercada(est, de) || cercada(est, a)) return "No funciona con la ciudad sitiada o con enemigos al lado.";
    if (!puedePagar(est.jugadores[j], costePortal(u))) return "No te alcanzan los recursos.";
    if (unidadEn(est, a.x, a.y) && !casillaLibreCerca(est, a, j)) return "No hay sitio libre en la ciudad de llegada.";
    return null;
  }
  /* Transmutación: 3 por 2 (Dolbred, 1 por 1) */
  const transmutado = (est, j, n) => (FACCIONES[est.jugadores[j].faccion].mods.transmutaBien ? n : Math.floor((n * 2) / 3));

  /* Lo que cura un sanador a una tropa (cada ejército tiene el suyo) */
  function curaDeSanador(est, w, u) {
    const cw = CLASES[w.clase];
    let n = cw.sanador === true ? 4 : cw.sanador;
    const maquina = esBarco(u) || CLASES[u.clase].sinComida;
    if (esBarco(u) && !cw.curaBarcos && !cw.curaMaquinas) return 0;
    if (cw.curaSoloPropios && u.dueno !== w.dueno) return 0;
    if (cw.curaMaquinas && maquina) n = cw.curaMaquinas;
    if (cw.curaMonstruo && u.heridaMonstruo) n += cw.curaMonstruo;
    if (cw.cobra) { const jw = est.jugadores[w.dueno]; if (!jw || (jw.recursos.oro || 0) < cw.cobra) return 0; jw.recursos.oro -= cw.cobra; }
    return n;
  }

  /* Fuego en el suelo (Ilvaren): dura hasta un turno y quema a quien esté encima */
  function prenderFuego(est, x, y, turnos, dueno) {
    if (!dentro(est, x, y)) return;
    est.fuego = est.fuego || [];
    const f = est.fuego.find(q => q.x === x && q.y === y);
    if (f) f.hasta = Math.max(f.hasta, est.turno + turnos); else est.fuego.push({ x, y, hasta: est.turno + turnos, dano: 2, dueno });
    est.ev.push({ k: "fuego", x, y });
  }
  function quemarAlLlegar(est, u, x, y) {
    const f = (est.fuego || []).find(q => q.x === x && q.y === y && q.hasta >= est.turno);
    if (f && f.dueno !== u.dueno) { est.ev.push({ k: "golpe", de: null, a: u.uid, x, y, dmg: f.dano, dist: 0, arma: "salpica" }); aplicarDano(est, u, f.dano, null); }
  }
  /* Casillas de una línea perpendicular a la dirección del héroe hacia (x, y), centrada en (x, y) */
  function lineaCruzada(u, x, y, largo) {
    const dx = Math.sign(x - u.x), dy = Math.sign(y - u.y);
    const px = dx && dy ? -dx : -dy, py = dx && dy ? dy : dx;
    const out = [], m = Math.floor(largo / 2);
    for (let k = -m; k <= largo - 1 - m; k++) out.push({ x: x + px * k, y: y + py * k });
    return out;
  }

  function casillaLibreCerca(est, ciudad, j) {
    const cand = [{ x: ciudad.x, y: ciudad.y }];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) cand.push({ x: ciudad.x + dx, y: ciudad.y + dy });
    return cand.find(p => dentro(est, p.x, p.y) && TERRENOS[est.casillas[p.y][p.x].t].mov > 0 && !unidadEn(est, p.x, p.y) && !(est.muros || []).some(m => m.x === p.x && m.y === p.y)) || null;
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
        ciudadesDe(est, q).forEach(c => marca(c.x, c.y, 3 + (c.obras && c.obras.vigias >= est.turno ? 2 : 0)));
        est.fortalezasDueno.forEach((d, i) => { if (d === q) { const p = est.fortalezas[i]; marca(p.x, p.y, 2); } });
      });
    });
  }
  const veCasilla = (est, j, x, y) => est.vision[j][y * est.ancho + x] === 2;
  /* Noche eterna: a una unidad de Nikaalia no se la ve hasta tener a alguien a su lado. Sí se la ve en ciudades,
     fortalezas y sobre el Núcleo, y cuando ataca queda a la vista hasta su siguiente turno. */
  function oculta(est, u, j) {
    const velada = u.efectos && u.efectos.oculto >= est.turno;
    if (u.dueno < 0 || j < 0 || u.descubierta || mismoEquipo(est, u.dueno, j)) return false;
    if (!velada && (!est.hayNoche || !facDe(est, u.dueno).mods.noche)) return false;
    const c = est.casillas[u.y][u.x];
    if (c.est === "ciudad" || c.est === "fortaleza" || c.est === "nucleo") return false;
    for (const uid in est.unidades) {
      const w = est.unidades[uid];
      if (w.dueno >= 0 && dist(w, u) <= 1 && mismoEquipo(est, w.dueno, j)) return false;
    }
    return true;
  }
  // Un gigante (2×2) se ve si se ve cualquiera de sus casillas
  const veUnidad = (est, j, u) => marcadaPara(est, j, u) || (u.tam === 2 ? celdasDe(u).some(q => veCasilla(est, j, q.x, q.y)) : veCasilla(est, j, u.x, u.y)) && !oculta(est, u, j);

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
    // El mapa puede ser para más bandos de los que juegan (un mapa de 8 con 2 jugadores): las capitales que sobran quedan como ciudades libres
    const MP = Math.max(N, Math.min(8, cfg.mapaPara || N));
    const mapa = M.generarMapa(cfg.semilla, tipoId, { bandos: MP, forma: cfg.forma, tamano: cfg.tamano });
    if (MP > N) {
      const elegidas = []; for (let k = 0; k < N; k++) elegidas.push(Math.floor((k * MP) / N));
      const sobran = mapa.capitales.filter((_, i) => !elegidas.includes(i));
      mapa.capitales = elegidas.map(i => mapa.capitales[i]);
      mapa.sitios = sobran.concat(mapa.sitios);
    }
    const ceros = () => new Array(N).fill(0);
    const primerHumano = cfg.jugadores.findIndex(jc => jc.humano);
    const est = {
      v: 2, reglas: D.REGLAS, semilla: cfg.semilla, tipo: tipoId, dificultad: cfg.dificultad || "normal", anio: cfg.anio || 1,
      ancho: mapa.ancho, alto: mapa.alto, casillas: mapa.casillas, regiones: mapa.regiones, costuras: mapa.costuras, capitales: mapa.capitales, nucleo: mapa.nucleo,
      turno: 1, activo: 0, maxTurnos: cfg.maxTurnos || M.turnosDe(MP, mapa.maritimo, cfg.tamano), mapaPara: MP, tamano: mapa.tamano, hold: cfg.hold || 6, rs: mapa.rng || 1, tregua: cfg.tregua !== undefined ? cfg.tregua : N > 2 ? 3 : 0,
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
      est.jugadores.push({ id: j, nombre: jc.nombre, faccion, humano: !!jc.humano, equipo: jc.equipo === undefined ? null : jc.equipo, recursos: rec, tech: SB.techInicial(faccion), sabEf: null,
        liderMuerto: false, eliminado: false, ia: jc.humano ? null : { nivel: jc.nivelIA || est.dificultad }, mochila: [],
        cuenta: { salvajes: 0, saqueos: 0, duelos: 0, devorados: 0, racha: 0, perdidas: 0, tributos: 0 }, heroes: [], heroeInvocado: null, heroeUid: null });
      (jc.reliquias || []).forEach(inst => { est.reliquias[inst.id] = inst; });
      rehacerSaber(est, j);
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
    // El terreno se suma entero y se redondea al final: cada casilla rinde fracciones (reglas 5)
    const terreno = {};
    ciudadesDe(est, j).forEach(c => {
      mas("Ciudades", "comida", 1); mas("Ciudades", "materiales", 1);
      mas("Ciudades", "oro", Math.max(0, 1 + c.nivel + (fac.mods.oroCiudad || 0)));
      if (fac.mods.animaCiudad) mas("Ciudades", "anima", fac.mods.animaCiudad);
      if (c.mercado) mas("Mercado de las Sombras", "oro", 2);
      const se0 = jug.sabEf || VACIO;
      ["oro", "comida", "mana", "materiales", "mineral"].forEach(k => { if (se0[`${k}Ciudad`]) mas("Saber", k, se0[`${k}Ciudad`]); });
      const r = c.nivel >= 3 ? 2 : 1;
      for (let y = c.y - r; y <= c.y + r; y++) for (let x = c.x - r; x <= c.x + r; x++) {
        if (!dentro(est, x, y)) continue;
        const rin = TERRENOS[est.casillas[y][x].t].rinde;
        // El anillo de fuera de las ciudades grandes rinde la mitad
        const anillo = Math.max(Math.abs(x - c.x), Math.abs(y - c.y)) === 2 ? 0.5 : 1;
        // En los mapas escasos el terreno rinde la mitad: una casilla sí y otra no, alternando cada turno
        Object.keys(rin).forEach(k => { terreno[k] = (terreno[k] || 0) + anillo * (escaso ? ((x * 7 + y * 13 + est.turno) % 2 ? rin[k] : 0) : rin[k]); });
      }
      c.edificios.forEach(id => {
        if (c.desh[id] >= est.turno) return;
        const ed = EDIFICIOS[id];
        Object.keys(ed.rinde).forEach(k => { mas("Edificios", k, ed.rinde[k]); });
        if (ed.rama === "eco" && (jug.sabEf || VACIO).ecoExtra) mas("Saber", Object.keys(ed.rinde)[0] || "oro", jug.sabEf.ecoExtra);
        if (id === "muelle" && fac.naval && fac.naval.muelleOro) mas("Edificios", "oro", fac.naval.muelleOro);
      });
    });
    Object.keys(terreno).forEach(k => mas("Terreno", k, Math.round(terreno[k])));
    unidadesDe(est, j).forEach(u => {
      const e = bonoReliquias(est, u);
      if (u.s) { mas("Reliquias", "mana", e.mana || 0); mas("Reliquias", "oro", e.oro || 0); }
      if (u.lider && !jug.liderMuerto) { const al = fac.lider.aura; mas("Líder", "mana", al.mana || 0); mas("Líder", "oro", al.oro || 0); }
      if (u.heroe) { const he = HEROES[u.heroe].ef; mas("Héroe", "oro", he.oroTurno || 0); mas("Héroe", "mana", he.manaTurno || 0); }
      if (CLASES[u.clase].oroTurno) mas("Flota", "oro", CLASES[u.clase].oroTurno);
      if (CLASES[u.clase].manaTurno) mas("Alquimistas", "mana", CLASES[u.clase].manaTurno);
    });
    ["oro", "mana", "anima"].forEach(k => { const v = (jug.sabEf || VACIO)[`${k}Turno`]; if (v) mas("Saber", k, v); });
    // Administración: desde la cuarta ciudad, cada una cuesta 1 de oro más que la anterior
    const nCiu = ciudadesDe(est, j).length;
    if (nCiu > 3) mas("Administración", "oro", -((nCiu - 3) * (nCiu - 2)) / 2);
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
    return Math.max(0, n - 2 * ciudadesDe(est, j).length);
  }

  function iniciarTurno(est, j, primero) {
    const jug = est.jugadores[j];
    if (!primero) {
      const ing = ingresoDe(est, j);
      Object.keys(ing).forEach(k => { sumar(jug, k, ing[k]); if (jug.recursos[k] < 0) jug.recursos[k] = 0; });
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
    ciudadesDe(est, j).forEach(c => { c.reclutado = false; c.leva2 = false; });
    const fac = FACCIONES[jug.faccion];
    // Asedios: la ciudad cae si la tropa que la asedia sigue en ella al empezar el turno de su bando
    if (!primero) Object.values(est.ciudades).forEach(c => {
      if (!c.asedio || c.asedio.por !== j) return;
      const u = est.unidades[c.asedio.uid];
      if (u && u.dueno === j && ocupa(u, c.x, c.y) && c.dueno !== null && hostil(est, c.dueno, j) && !(c.sello >= est.turno)) { delete c.asedio; capturarCiudad(est, u, c); }
      else delete c.asedio;
    });
    if (est.ganador !== null) return;
    // Las criaturas sobornadas vuelven a ser de nadie cuando se acaba el pago
    unidadesDe(est, j).forEach(u => {
      if (u.sobornada !== undefined && est.turno > u.sobornada) {
        const vuelve = u.duenoOriginal !== undefined && est.jugadores[u.duenoOriginal] && !est.jugadores[u.duenoOriginal].eliminado;
        u.dueno = vuelve ? u.duenoOriginal : -1; delete u.sobornada; delete u.duenoOriginal; u.errante = !vuelve;
        reg(est, `${nombreUnidad(u)} deja de servir a ${jug.nombre}.`, "suceso");
      }
    });
    // Taller de Nernib: un autómata gratis cada 4 turnos, hasta 3 vivos
    if (!primero && fac.mods.taller && est.turno % 4 === 0 && hayHueco(est, j) && unidadesDe(est, j).filter(u => u.clase === "automata").length < 3) {
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
    // Levas del Reino (Brurland): cada fortaleza entrega un miliciano cada 5 turnos
    if (!primero && sab(est, j).levaFortaleza) {
      const viejo = (est.levaFeudal || {})[j] || {}, nuevo = {};
      fortalezasDe(est, j).forEach(p => {
        const k = `${p.x},${p.y}`;
        nuevo[k] = viejo[k] === undefined ? est.turno : viejo[k];
        if (est.turno - nuevo[k] < 5 || !hayHueco(est, j)) return;
        const lib = casillaLibreCerca(est, p, j);
        if (!lib) return;
        nuevo[k] = est.turno;
        const r = { s: est.rs };
        const sol = S.crearSoldado(r, { clase: "guerrero", cultura: fac.cultura, origen: "habitante", anio: est.anio });
        est.rs = r.s;
        const m = nuevaUnidad(est, j, "guerrero", lib.x, lib.y, sol);
        est.ev.push({ k: "nuevo", uid: m.uid, x: m.x, y: m.y });
        reg(est, `La leva de ${regionDeCasilla(est, p.x, p.y).nombre} trae a ${S.nombreCompleto(sol)}.`, "recluta");
      });
      est.levaFeudal = est.levaFeudal || {}; est.levaFeudal[j] = nuevo;
    }
    unidadesDe(est, j).forEach(u => {
      const e = ef(est, u);
      u.pm = e.mov; u.atacado = false; u.recorrido = 0; u.quieto = true; u.accion = false;
      if (u.descubierta) delete u.descubierta;
      if (u.enfriar > 0) u.enfriar -= 1;
      if (u.cd > 0) u.cd -= 1;
      if (u.cd2 > 0) u.cd2 -= 1;
      if (u.cdMarca > 0) u.cdMarca -= 1;
      if (u.efectos.postura) delete u.efectos.postura;
      if (u.efectos.clavado) { u.pm = 0; delete u.efectos.clavado; }
      if (u.efectos.traba >= est.turno) u.pm = 0;
    });
    if (FACCIONES[jug.faccion].mods.horda) {
      const propias = unidadesDe(est, j).filter(u => !esBarco(u));
      propias.forEach(u => { if (u.pm > 0 && propias.some(w => w !== u && dist(w, u) <= 1)) u.pm += 1; });
    }
    // Campamentos (Okran): los que caducan se desmontan; los que quedan vuelven a poder entrenar
    est.campamentos = (est.campamentos || []).filter(cp => cp.hasta >= est.turno);
    est.campamentos.filter(cp => cp.dueno === j).forEach(cp => { cp.reclutado = false; });
    // El fuego quema a quien empieza su turno encima
    est.fuego = (est.fuego || []).filter(f => f.hasta >= est.turno);
    est.desafios = (est.desafios || []).filter(d => d.hasta >= est.turno && est.unidades[d.a] && est.unidades[d.b]);
    unidadesDe(est, j).forEach(u => { const f = est.fuego.find(q => ocupa(u, q.x, q.y)); if (f && est.unidades[u.uid]) { est.ev.push({ k: "golpe", de: null, a: u.uid, x: u.x, y: u.y, dmg: f.dano, dist: 0, arma: "salpica" }); aplicarDano(est, u, f.dano, null); } });
    // Los sanadores y las reliquias que curan, y el descanso
    unidadesDe(est, j).forEach(u => {
      const e = ef(est, u);
      let cura = 0;
      if (u.descanso) cura += 2;
      if ((est.campamentos || []).some(cp => cp.dueno === j && dist(u, cp) <= 1)) cura += 3;   // campamento (Okran)
      const c = celdasDe(u).map(q => ciudadEn(est, q.x, q.y)).find(ci => ci && ci.dueno === j) || null;
      const fortP = celdasDe(u).find(q => casilla(est, q.x, q.y).est === "fortaleza" && est.fortalezasDueno[est.fortalezas.findIndex(p => p.x === q.x && p.y === q.y)] === j);
      if (c && c.dueno === j) { cura += 3 + ((jug.sabEf || VACIO).curaCiudad || 0); if (c.edificios.includes("fortaleza")) cura += 2; if (c.obras && c.obras.fiesta >= est.turno) cura += 2; }
      else if (fortP) cura += 2;
      cura += (e.cura || 0) + (CLASES[u.clase].regenera || 0);
      if (u.heroe) cura += 3;
      if (u.efectos && u.efectos.marea >= est.turno) cura += 2;
      // Los barcos se reparan junto a un muelle propio
      if (esBarco(u) && ciudadesDe(est, j).some(q => q.edificios.includes("muelle") && dist(q, u) <= 2)) cura += 3;
      if (consagradaPara(est, j, u.x, u.y)) cura += 1;
      vecinosAliados(est, u).forEach(w => {
        if (CLASES[w.clase].sanador && u.hp + cura < e.hpMax) cura += curaDeSanador(est, w, u);
        const ew = bonoReliquias(est, w);
        cura += ew.cura || 0;
      });
      // Sanadores que llegan más lejos (el chamán de Okran)
      unidadesDe(est, j).forEach(w => { if (CLASES[w.clase].sanadorRadio && dist(w, u) > 1 && dist(w, u) <= CLASES[w.clase].sanadorRadio && u.hp + cura < e.hpMax) cura += curaDeSanador(est, w, u); });
      if (u.hp + cura >= e.hpMax) delete u.heridaMonstruo;
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
          if (!dx && !dy) continue;
          const libreQ = q => { if (!dentro(est, q.x, q.y) || TERRENOS[est.casillas[q.y][q.x].t].mov === 0) return false; const o = unidadEn(est, q.x, q.y); return !o || o === u; };
          if (!celdasDe({ x, y, tam: u.tam || 1 }).every(libreQ)) continue;
          const d = dist({ x, y, tam: u.tam || 1 }, t);
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
          nuevaUnidad(est, -1, "salvaje", p.x, p.y, null, { nombre: "Aparecido", fuerza: 0, errante: true });
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
    Object.values(est.unidades).filter(u => u.dueno === -1 && !u.sinBandera).forEach(u => {
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
      if (ciudad.obras && ciudad.obras.fortificar >= est.turno) d += 2;
      if (ciudad.edificios.includes("herreria") && !(ciudad.desh.herreria >= est.turno)) d += 1;
      if (ciudad.edificios.includes("fortaleza") && !(ciudad.desh.fortaleza >= est.turno)) d += 2 + ((u.dueno >= 0 && FACCIONES[est.jugadores[u.dueno].faccion].mods.fortalezaDef) || 0) + (sab(est, u.dueno).fortalezaDef || 0);
      d += sab(est, u.dueno).ciudadDef || 0;
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
    // Carga: la caballería que avanza al menos dos casillas antes de atacar
    if (clA.carga && ((a.recorrido || 0) >= 2 || heroeCerca(est, a, "cargaLibre"))) A += clA.carga + (sab(est, a.dueno).cargaExtra || 0);
    // Ventajas por tipo de tropa (piqueros contra jinetes, tiradores contra voladores...) y lo aprendido
    const tiposD = tiposDe(d), seA = sab(est, a.dueno), Hh = a.heroe ? HEROES[a.heroe].ef : null;
    tiposD.forEach(tp => { A += ((clA.contra || {})[tp] || 0) + ((seA.contra || {})[tp] || 0) + ((Hh && Hh.contraHeroe && Hh.contraHeroe[tp]) || 0); });
    if ((seA.atqCiudad || clA.atqCiudad) && enCiudadOFortaleza(est, d)) A += (seA.atqCiudad || 0) + (clA.atqCiudad || 0);
    // Viejas deudas (Okran): más ataque contra los ejércitos que odia
    if (marcadaPara(est, a.dueno, d)) A += 1;   // Marcar la presa (Hijos del Acero)
    if (facA && facA.mods.deudas && d.dueno >= 0 && Array.isArray(facA.odia) && facA.odia.includes(est.jugadores[d.dueno].faccion)) A += facA.mods.deudas;
    // La magia quema a los no muertos: los magos pegan 2 más a los muertos vivientes y a los levantados
    if ((clA.tipo || []).includes("magia") && (CLASES[d.clase].muertoViviente || d.reanimado || (d.dueno >= 0 && facDe(est, d.dueno).mods.sinComida) || (d.heroe && HEROES[d.heroe].muertoViviente))) A += 2;
    if (Hh && Hh.atqSolo && solo) A += Hh.atqSolo;
    if (sa && sa.spec === "duelista" && solo) A += 2;
    if (sa && sa.spec === "rompelineas" && (enCiudadOFortaleza(est, d) || ED.def >= 3)) A += 2;

    if (facA && esMonstruo(est, d) && facA.mods.atqMonstruo) A += facA.mods.atqMonstruo;
    if (facA && a.lider && !jugA.liderMuerto && esMonstruo(est, d) && facA.lider.aura.atqMonstruo) A += facA.lider.aura.atqMonstruo;
    if (sa) { const eq = bonoReliquias(est, a); if (esMonstruo(est, d)) A += eq.atqMonstruo || 0; }
    if (seA.heridos && d.hp < ED.hpMax) A += seA.heridos;
    if (a.dueno === -1) A += (a.fuerza || 0);
    if (facA && facA.mods.duelo && solo && !a.heroe) A += facA.mods.duelo + (seA.duelo || 0);
    if (a.clase === "maestro" && solo) A += 2;
    let Df = ED.def + defensaDelTerreno(est, d);
    // Testudo (Balutia): contra lo que llega de lejos, cada legionario al lado cubre con su escudo
    if (d.dueno >= 0 && dist(a, d) > 1) { const tt = facDe(est, d.dueno).mods.testudo; if (tt && d.clase === tt.clase) Df += Math.min(tt.max, vecinosAliados(est, d).filter(w => w.clase === tt.clase).length); }
    if (usaPolvora(est, a)) Df = Math.max(0, Df - 1);
    let dmg = Math.max(1, A + 1 - Math.floor(Df / 2));
    if (!duelo && vecinosAliados(est, d).some(w => w.clase === "guerrero")) dmg = Math.max(1, dmg - 1);
    return dmg;
  }

  function aplicarDano(est, objetivo, dmg, por) {
    if (objetivo.heroe && !objetivo.aguanteUsado && objetivo.hp - dmg <= 0) {
      objetivo.hp = 1; objetivo.aguanteUsado = true;
      reg(est, `${nombreUnidad(objetivo)} recibe un golpe que habría matado a cualquiera y sigue en pie.`, "heroico");
      return false;
    }
    if (objetivo.hp - dmg <= 0 && objetivo.s && !objetivo.voluntadUsada && rn(est) < S.probVoluntad(objetivo.s)) {
      objetivo.hp = 1;
      objetivo.voluntadUsada = true;
      usar(objetivo, "borde");
      objetivo.s.cicatrices = (objetivo.s.cicatrices || 0) + 1;
      reg(est, `${nombreUnidad(objetivo)} debería haber caído y sigue en pie con lo último que le queda.`, "heroico");
      crono(est, "heroico", { soldado: objetivo.s.id, nombre: nombreUnidad(objetivo), region: regionDeCasilla(est, objetivo.x, objetivo.y).nombre, por: por ? nombreUnidad(por) : null });
      return false;
    }
    const hpAntes = objetivo.hp;
    if (por && esMonstruo(est, por)) objetivo.heridaMonstruo = true;
    objetivo.hp -= dmg;
    if (objetivo.hp <= 0) { matar(est, objetivo, por); return true; }
    // Se cuenta cuando un golpe lo deja al borde (no cada golpe que recibe estando ya así)
    if (objetivo.s) { const mx = ef(est, objetivo).hpMax; if (objetivo.hp * 4 <= mx && hpAntes * 4 > mx) usar(objetivo, "borde"); }
    return false;
  }

  function atacarUnidad(est, a, d, sinRetorno, opc) {
    const duelo = esDuelo(est, a, d);
    let dmg = calcularDano(est, a, d, duelo);
    if (opc && opc.multJinete && tiposDe(d).some(t => t === "jinete" || t === "jinete_pesado")) dmg *= opc.multJinete;
    if (d.efectos && d.efectos.muralla && d.efectos.muralla.hasta >= est.turno) dmg = Math.min(dmg, d.efectos.muralla.tope);
    if (a.efectos && a.efectos.oculto) delete a.efectos.oculto;
    // Duelo de leyendas: dos héroes frente a frente
    if (a.heroe && d.heroe) {
      est.ev.push({ k: "leyendas", x: d.x, y: d.y, a: a.uid, b: d.uid });
      if (!(est.leyendas || {})[`${a.uid}:${d.uid}`]) {
        est.leyendas = est.leyendas || {}; est.leyendas[`${a.uid}:${d.uid}`] = est.turno;
        crono(est, "leyendas", { a: nombreUnidad(a), b: nombreUnidad(d), dueno: a.dueno, antes: d.dueno });
      }
    }
    if (est.hayNoche && a.dueno >= 0 && facDe(est, a.dueno).mods.noche) a.descubierta = true;
    const distancia = dist(a, d);
    // Postura (Seosan): quien esperó quieto golpea primero al que llega cuerpo a cuerpo
    let primero = false;
    if (!sinRetorno && distancia <= 1 && d.efectos && d.efectos.postura && CLASES[d.clase].atq > 1 && !CLASES[d.clase].sanador && !razonAgua(est, d, a)) {
      primero = true;
      const r = Math.max(1, Math.ceil(calcularDano(est, d, a, duelo || undefined) * 0.6));
      reg(est, `${nombreUnidad(d)} esperaba en guardia y golpea primero por ${r}.`, "combate");
      est.ev.push({ k: "golpe", de: d.uid, a: a.uid, x: a.x, y: a.y, dmg: r, dist: distancia, arma: "filo", respuesta: true });
      a.descanso = false;
      aplicarDano(est, a, r, d);
      if (!est.unidades[a.uid]) return false;
    }
    // El Vigilante: los aliados a su lado ignoran el primer golpe de cada turno
    const sello = est.turno * 16 + est.activo;
    if (d.dueno >= 0 && !d.heroe && d.escudoT !== sello && heroeCerca(est, d, "escudoAliados")) {
      d.escudoT = sello; dmg = 0;
      reg(est, `${nombreUnidad(a)} golpea a ${nombreUnidad(d)}, pero la luz del Vigilante detiene el golpe.`, "combate");
    } else reg(est, `${nombreUnidad(a)} golpea a ${nombreUnidad(d)} por ${dmg}.`, "combate");
    est.ev.push({ k: "golpe", de: a.uid, a: d.uid, x: d.x, y: d.y, dmg, dist: distancia, arma: usaPolvora(est, a) ? "polvora" : (CLASES[a.clase].atqEstat === "MAG" || (a.heroe && HEROES[a.heroe].magia)) ? "magia" : distancia > 1.5 ? "flecha" : "filo" });
    d.descanso = false;
    usar(a, "golpes"); usar(a, distancia > 1 ? "lejos" : "cerca"); usar(a, `t:${est.casillas[a.y][a.x].t}`);
    const murio = dmg > 0 ? aplicarDano(est, d, dmg, a) : false;
    const jug = a.dueno >= 0 ? est.jugadores[a.dueno] : null;
    // Daño en área de los arcanistas
    // El Cobrador se lleva oro del dueño del herido
    if (CLASES[a.clase].roba && dmg > 0 && jug && d.dueno >= 0 && d.dueno !== a.dueno) {
      const rob = Math.min(CLASES[a.clase].roba, est.jugadores[d.dueno].recursos.oro);
      if (rob > 0) { est.jugadores[d.dueno].recursos.oro -= rob; jug.recursos.oro += rob; reg(est, `${nombreUnidad(a)} cobra ${rob} de oro a ${est.jugadores[d.dueno].nombre}.`, "combate"); }
    }
    if (a.clase === "arcanista" || a.clase === "archimago" || a.clase === "eco" || CLASES[a.clase].area) {
      const frac = (jug && (jug.sabEf || VACIO).area) || 0.5;
      const vec = Object.values(est.unidades).filter(w => w !== d && hostil(est, w.dueno, a.dueno) && dist(w, d) <= 1);
      vec.forEach(w => { const sp = Math.max(1, Math.floor(dmg * frac)); if (est.unidades[w.uid]) { est.ev.push({ k: "golpe", de: a.uid, a: w.uid, x: w.x, y: w.y, dmg: sp, dist: 0, arma: "salpica" }); aplicarDano(est, w, sp, a); } });
      if (jug && (jug.sabEf || VACIO).frena && est.unidades[d.uid]) d.efectos.frenado = est.turno + 1;
    }
    // El Kirin: el rayo sigue hasta quien esté detrás y deja clavado a quien toca
    if ((a.heroe && HEROES[a.heroe].ef.linea) || CLASES[a.clase].linea) {
      const tD = (d.tam || 1) - 1, sx = Math.sign(d.x - a.x), sy = Math.sign(d.y - a.y);
      const w = unidadEn(est, (sx > 0 ? d.x + tD : d.x) + sx, (sy > 0 ? d.y + tD : d.y) + sy);
      if (w && w !== d && hostil(est, w.dueno, a.dueno) && est.unidades[w.uid]) { const sp = Math.max(1, Math.floor(dmg * 0.75)); est.ev.push({ k: "golpe", de: a.uid, a: w.uid, x: w.x, y: w.y, dmg: sp, dist: 0, arma: "salpica" }); if (!aplicarDano(est, w, sp, a)) w.efectos.clavado = true; }
      if (est.unidades[d.uid] && a.heroe) d.efectos.clavado = true;
    }
    const sinResp = (a.heroe && HEROES[a.heroe].ef.sinRespuesta) || CLASES[a.clase].sinRespuesta;
    // Ilvaren: lo que golpea se queda ardiendo
    if (a.heroe && HEROES[a.heroe].ef.ardiente && dmg > 0) prenderFuego(est, d.x, d.y, HEROES[a.heroe].ef.ardiente, a.dueno);
    if (!sinRetorno && !sinResp && !primero && !murio && est.unidades[d.uid] && distancia <= ef(est, d).alc && est.unidades[a.uid] && CLASES[d.clase].atq > 1 && !razonAgua(est, d, a)) {
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
    if (por && por.dueno >= 0) {
      const jp = est.jugadores[por.dueno];
      const oficial = u.lider || u.heroe || (u.s && (u.s.capitan || S.rangoIndice(u.s.victorias + (u.vicG || 0)) >= 2));
      jp.renombre = (jp.renombre || 0) + 1 + (oficial ? 3 : 0) + (u.heroe ? 5 : 0) + (estabaSolo ? 1 : 0);
      // Genichiro: quien gana su desafío se queda con la fuerza
      const df = desafioDe(est, u);
      if (df && (df.a === por.uid || df.b === por.uid)) { por.bonoDesafio = (por.bonoDesafio || 0) + 2; est.desafios.splice(est.desafios.indexOf(df), 1); reg(est, `${nombreUnidad(por)} gana el desafío.`, "heroico"); }
    }
    if (por) {
      if (dueno >= 0) usar(por, `f:${est.jugadores[dueno].faccion}`);
      if (esMonstruo(est, u)) usar(por, "monstruos");
      if (u.lider || u.heroe) usar(por, "jefes");
      if (estabaSolo) usar(por, "solos");
    }
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
      // Botín (Okran): cada enemigo que cae da comida y oro; más si era un líder o un héroe
      if (facP0.mods.botin && dueno >= 0 && hostil(est, dueno, por.dueno)) {
        const gordo = u.lider || u.heroe, c = gordo ? 5 : 2, o = gordo ? 5 : 1;
        sumar(jp0, "comida", c); sumar(jp0, "oro", o);
        est.ev.push({ k: "mejora", uid: por.uid, x: por.x, y: por.y, texto: `Botín: +${c} comida, +${o} oro` });
      }
      // Trofeos de caza (Okran): cada criatura salvaje cura y deja +1 de vida para toda la guerra (hasta 5)
      if (sab(est, por.dueno).trofeos && dueno === -1 && (u.errante || u.guardia || u.clase === "salvaje") && (por.trofeos || 0) < 5) {
        por.trofeos = (por.trofeos || 0) + 1;
        por.hp = Math.min(ef(est, por).hpMax, por.hp + 3);
        reg(est, `${nombreUnidad(por)} se cobra un trofeo de caza.`, "combate");
        est.ev.push({ k: "mejora", uid: por.uid, x: por.x, y: por.y, texto: "Trofeo de caza: +1 de vida" });
      }
      if (hp0 && hp0.ef.curaAlMatar) por.hp = Math.min(ef(est, por).hpMax, por.hp + hp0.ef.curaAlMatar);
      if (CLASES[por.clase].curaAlMatar) por.hp = Math.min(ef(est, por).hpMax, por.hp + CLASES[por.clase].curaAlMatar);
      // Devorar y adaptar (Mravec)
      const sinTope = hp0 && hp0.ef.devoraSinTope;
      if (sinTope || (!por.heroe && facP0.mods.devora && facP0.mods.devora.includes(por.clase))) {
        jp0.cuenta.devorados++;
        const rasgo = RASGO_DE[u.clase] || "hp";
        por.rasgos = por.rasgos || [];
        if (sinTope || (por.rasgos.length < 2 + (jp0.sabEf && jp0.sabEf.devora || 0) && !por.rasgos.includes(rasgo))) {
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
      const alza = hv && HEROES[hv.heroe].ef.alzaCaidos;
      if (alza && jd.alzadoT !== selloT) { jd.alzadoT = selloT; jd.alzadoN = 0; }
      const radio = alza ? (alza.r || 2) : 0, tope = alza ? (alza.n || 1) : 0;
      if (alza && u !== hv && !u.heroe && !u.lider && dist(hv, u) <= radio && (jd.alzadoN || 0) < tope && !u.alzado && !unidadEn(est, u.x, u.y)) {
        jd.alzadoN = (jd.alzadoN || 0) + 1;
        // Las tropas de Osses vuelven como eran; las demás (acogidas, sobornadas, desertoras), como Legión de huesos
        const propia = u.s && !u.acogido && u.sobornada === undefined && !(u.s && u.s.desertorDe !== undefined);
        let n;
        if (propia) {
          const it = est.tumbas.map((t, i) => [t, i]).reverse().find(([t]) => t.x === u.x && t.y === u.y && t.s && t.s.id === u.s.id);
          if (it) est.tumbas.splice(it[1], 1);
          const sol = JSON.parse(JSON.stringify(u.s)); sol.reanimado = true; sol.muerte = null; sol.equipo = {};
          n = nuevaUnidad(est, dueno, u.clase, u.x, u.y, sol, { alzado: true, reanimado: true });
          n.hp = Math.max(1, Math.floor(ef(est, n).hpMax / 2));
        } else {
          const r0 = { s: est.rs };
          const sol = S.crearSoldado(r0, { clase: "esqueleto", cultura: FACCIONES[jd.faccion].cultura, origen: "criatura", anio: est.anio });
          est.rs = r0.s;
          n = nuevaUnidad(est, dueno, "esqueleto", u.x, u.y, sol, { alzado: true, reanimado: true });
        }
        n.pm = 0; n.atacado = true;
        est.ev.push({ k: "nuevo", uid: n.uid, x: n.x, y: n.y });
        reg(est, propia ? `El Ceniciento no deja descansar a ${nombreUnidad(n)}: se levanta otra vez.` : "El Ceniciento no deja descansar a los suyos: se alza una Legión de huesos.", "magia");
      }
    }
    // El barrilero explota al morir
    if (u.clase === "barrilero") {
      est.ev.push({ k: "explosion", x: u.x, y: u.y });
      reg(est, `El barril de ${nombreUnidad(u)} estalla.`, "combate");
      Object.values(est.unidades).filter(w => w !== u && dist(w, u) <= 1).forEach(w => {
        if (est.unidades[w.uid]) { est.ev.push({ k: "golpe", de: u.uid, a: w.uid, x: w.x, y: w.y, dmg: 3, dist: 0, arma: "salpica" }); aplicarDano(est, w, 3, null); }
      });
    }
    // Quien mata gana experiencia y el bando enemigo se lleva el Ánima
    if (por && por.dueno >= 0) {
      por.vicG = (por.vicG || 0) + 1;
      por.bajasG = (por.bajasG || 0) + 1;
      const jp = est.jugadores[por.dueno];
      const facP = FACCIONES[jp.faccion];
      let anima = (facP.mods.anima_baja || 0) + ((jp.sabEf || VACIO).animaBaja || 0);
      if ((jp.sabEf || VACIO).curaMatar && est.unidades[por.uid]) por.hp = Math.min(ef(est, por).hpMax, por.hp + jp.sabEf.curaMatar);
      const oficial = u.lider || (u.s && (u.s.capitan || S.rangoIndice(u.s.victorias + (u.vicG || 0)) >= 2));
      if (oficial) { por.vicG += 1; est.stats.oficiales[por.dueno]++; if (por.s) por.s.oficiales = (por.s.oficiales || 0) + 1; }
      // Camino de la espada (Seosan): ganar un duelo vale una victoria más
      if (estabaSolo && facP.mods.duelo && !por.heroe && (jp.sabEf || VACIO).caminoEspada) {
        por.vicG += 1;
        est.ev.push({ k: "mejora", uid: por.uid, x: por.x, y: por.y, texto: "Camino de la espada: +1 victoria" });
      }
      // Rescates (Compañía Dorada): por un oficial, un héroe o el líder, su bando paga
      if ((oficial || u.heroe) && facP.mods.rescate && dueno >= 0 && hostil(est, dueno, por.dueno)) cobrarRescate(est, por.dueno, dueno, (u.lider || u.heroe) ? facP.mods.rescate * 2 : facP.mods.rescate, u);
      if (anima) sumar(jp, "anima", anima);
      if (u.dueno === -1 && u.guardia) { /* el botín de la guardia está en la casilla */ }
    }
    if (u.dueno >= 0 && u.s) {
      const importante = u.s.capitan || u.vicG > 0 || S.rangoIndice(u.s.victorias + (u.vicG || 0)) >= 1;
      if (importante) crono(est, "caida", { soldado: u.s.id, nombre: nombreUnidad(u), dueno, region: reg0.nombre, por: por ? nombreUnidad(por) : null, porId: por && por.s ? por.s.id : null, capitan: !!u.s.capitan, victorias: u.s.victorias + (u.vicG || 0), compania: u.s.compania, x: u.x, y: u.y });
    }
    if (u.heroe && dueno >= 0) crono(est, "heroe_cae", { nombre: nombreUnidad(u), dueno, region: reg0.nombre, por: por ? nombreUnidad(por) : null, heroe: u.heroe });
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

  /* Rescates (Compañía Dorada): el bando del caído paga en oro y, si no le llega, con lo que tenga */
  function cobrarRescate(est, j, k, n, u) {
    const pj = est.jugadores[j], pk = est.jugadores[k], lleva = [];
    let falta = n;
    ["oro", "comida", "materiales", "mineral", "mana"].forEach(r => {
      if (falta <= 0) return;
      const q = Math.min(falta, pk.recursos[r] || 0);
      if (q > 0) { pk.recursos[r] -= q; sumar(pj, r, q); falta -= q; lleva.push(`${q} de ${D.RECURSO_NOMBRE[r].toLowerCase()}`); }
    });
    if (!lleva.length) return;
    reg(est, `${pk.nombre} paga el rescate de ${nombreUnidad(u)} a ${pj.nombre}: ${lleva.join(", ")}.`, "combate");
    est.ev.push({ k: "mejora", uid: u.uid, x: u.x, y: u.y, texto: `Rescate: ${lleva.join(", ")}` });
  }

  /* --- Trampas (Hijos del Acero) y túneles (Mravec) --- */
  const COSTE_TRAMPA = { materiales: 3 }, MAX_TRAMPAS = 4, CLASES_TRAMPA = ["cazador", "ballestero", "halconero"];
  const COSTE_TUNEL = { materiales: 6 }, MAX_TUNELES = 2, LARGO_TUNEL = 6;
  const trampaEn = (est, x, y) => (est.trampas || []).find(t => t.x === x && t.y === y) || null;
  const tunelEn = (est, x, y) => (est.tuneles || []).find(t => (t.a.x === x && t.a.y === y) || (t.b.x === x && t.b.y === y)) || null;
  function razonTrampa(est, j, u, x, y) {
    const jug = est.jugadores[j];
    if (!sab(est, j).trampas || !u || u.dueno !== j || !CLASES_TRAMPA.includes(u.clase)) return "Esa tropa no pone trampas.";
    if (u.atacado) return "Ya actuó este turno.";
    if ((est.trampas || []).filter(t => t.dueno === j).length >= MAX_TRAMPAS) return `Ya tienes ${MAX_TRAMPAS} trampas puestas.`;
    if (!puedePagar(jug, COSTE_TRAMPA)) return "No te alcanzan los materiales.";
    if (x === undefined) return null;
    const c = casilla(est, x, y);
    if (!c || c.t !== "bosque" || c.est || dist(u, { x, y }) !== 1 || unidadEn(est, x, y) || trampaEn(est, x, y)) return "Tiene que ser un bosque libre a su lado.";
    return null;
  }
  const enTerritorio = (est, j, x, y) => { const rg = regionDeCasilla(est, x, y); return !!rg && rg.dueno === j; };
  function razonTunel(est, j, u, x, y) {
    const jug = est.jugadores[j];
    if (!sab(est, j).tuneles || !u || u.dueno !== j || u.clase !== "zapadora") return "Esa tropa no cava túneles.";
    if (u.atacado) return "Ya actuó este turno.";
    if ((est.tuneles || []).filter(t => t.dueno === j).length >= MAX_TUNELES) return `Ya tienes ${MAX_TUNELES} túneles.`;
    if (!puedePagar(jug, COSTE_TUNEL)) return "No te alcanzan los materiales.";
    const boca = (bx, by) => { const c = casilla(est, bx, by); return !!c && c.t !== "agua" && TERRENOS[c.t].mov > 0 && c.est !== "costura" && c.est !== "nucleo" && !tunelEn(est, bx, by) && enTerritorio(est, j, bx, by); };
    if (!boca(u.x, u.y)) return "Tiene que estar en tu territorio, en tierra y sin otro túnel debajo.";
    if (x === undefined) return null;
    const d = dist(u, { x, y });
    if (d < 2 || d > LARGO_TUNEL || !boca(x, y)) return `La otra boca va en tu territorio, a entre 2 y ${LARGO_TUNEL} casillas.`;
    return null;
  }
  /* Una tropa enemiga que pisa la boca de un túnel lo hunde */
  function derrumbarTuneles(est, u, x, y) {
    if (u.dueno < 0 || !(est.tuneles || []).length) return;
    const antes = est.tuneles.length;
    est.tuneles = est.tuneles.filter(t => !(hostil(est, t.dueno, u.dueno) && ((t.a.x === x && t.a.y === y) || (t.b.x === x && t.b.y === y))));
    if (est.tuneles.length < antes) { reg(est, `${nombreUnidad(u)} hunde un túnel.`, "suceso"); est.ev.push({ k: "explosion", x, y }); }
  }
  /* Marcar la presa (Hijos del Acero) */
  const marcadaPara = (est, j, u) => !!(j >= 0 && u.efectos && u.efectos.marca && u.efectos.marca.hasta >= est.turno && mismoEquipo(est, j, u.efectos.marca.por));
  const ALCANCE_MARCA = 5, CD_MARCA = 3;
  function razonMarcar(est, j, u, x, y) {
    if (!u || u.dueno !== j || !(facDe(est, j).mods.marcar || []).includes(u.clase)) return "Esa tropa no marca presas.";
    if (u.cdMarca > 0) return `Le faltan ${u.cdMarca} ${u.cdMarca === 1 ? "turno" : "turnos"}.`;
    if (x === undefined) return null;
    const t = unidadEn(est, x, y);
    if (!t || !hostil(est, t.dueno, j) || !veUnidad(est, j, t)) return "No hay un enemigo a la vista ahí.";
    if (dist(u, t) > ALCANCE_MARCA) return `Tiene que estar a ${ALCANCE_MARCA} casillas o menos.`;
    return null;
  }
  /* Contratos (Compañía Dorada): comprar una ciudad sin dueño */
  const precioContrato = c => 10 + 8 * (c.nivel || 1);
  function razonContrato(est, j, u, x, y) {
    const jug = est.jugadores[j];
    if (!sab(est, j).contratos || !u || u.dueno !== j) return "Tu ejército no compra ciudades.";
    if (jug.contratoT === est.turno) return "Ya compraste una ciudad este turno.";
    if (x === undefined) return null;
    const c = ciudadEn(est, x, y);
    if (!c || c.dueno !== null) return "Solo se compran ciudades sin dueño.";
    if (dist(u, c) > 3) return "Necesitas una tropa a 3 casillas o menos.";
    if (unidadEn(est, c.x, c.y)) return "Hay alguien dentro.";
    if ((jug.recursos.oro || 0) < precioContrato(c)) return `Cuesta ${precioContrato(c)} de oro.`;
    return null;
  }

  /* --- Movimiento --- */
  /* Los gigantes (2×2): se mueve el bloque entero; cada paso cuesta lo que la casilla más cara que pisa. El bosque lo pisotean. */
  function alcanzablesGrande(est, u) {
    const h = HEROES[u.heroe] || {}, modo = h.modoAgua;
    const otros = new Map();
    for (const uid in est.unidades) { const w = est.unidades[uid]; if (w !== u) celdasDe(w).forEach(q => otros.set(q.y * 64 + q.x, w)); }
    const muros = est.muros || [], tregua = enTregua(est);
    const costeCelda = (x, y) => {
      if (!dentro(est, x, y)) return -1;
      const c = est.casillas[y][x];
      if (c.t === "vacio" || muros.some(m => m.x === x && m.y === y)) return -1;
      const o = otros.get(y * 64 + x);
      if (o && !mismoEquipo(est, o.dueno, u.dueno)) return -1;
      const ci = c.est === "ciudad" ? ciudadEn(est, x, y) : null;
      if (ci && ci.dueno !== null && ci.dueno !== u.dueno && (tregua || !hostil(est, ci.dueno, u.dueno))) return -1;
      if (c.t === "agua") return modo === "fondo" ? 2 : modo === "puente" ? 99 : -1;
      if (c.t === "bosque") return 1;
      return TERRENOS[c.t].mov || -1;
    };
    const enemigoCerca = (x, y) => Object.values(est.unidades).some(w => w !== u && hostil(est, w.dueno, u.dueno) && (w.dueno >= 0 || w.errante || w.guardia) && dist(w, { x, y, tam: 2 }) <= 1);
    const mapa = new Map(), inicio = clave(u.x, u.y);
    mapa.set(inicio, { c: 0, p: null, x: u.x, y: u.y });
    const abiertos = [inicio];
    while (abiertos.length) {
      abiertos.sort((a, b) => mapa.get(a).c - mapa.get(b).c);
      const k = abiertos.shift(), nodo = mapa.get(k);
      if (nodo.hecho) continue;
      nodo.hecho = true;
      if (nodo.fin) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = nodo.x + dx, ny = nodo.y + dy;
        let costo = 0, ok = true;
        celdasDe({ x: nx, y: ny, tam: 2 }).forEach(q => { const cc = costeCelda(q.x, q.y); if (cc < 0) ok = false; else costo = Math.max(costo, cc); });
        if (!ok) continue;
        let fin = false;
        if (costo >= 99) { if (nodo.c > 0) continue; costo = Math.max(1, u.pm); fin = true; }
        const nc = nodo.c + costo;
        if (nc > u.pm) continue;
        if (enemigoCerca(nx, ny)) fin = true;
        const kv = clave(nx, ny), previo = mapa.get(kv);
        if (!previo || nc < previo.c) { mapa.set(kv, { c: nc, p: k, x: nx, y: ny, hecho: false, fin }); abiertos.push(kv); }
      }
    }
    const destinos = new Map();
    mapa.forEach((nodo, k) => { if (k !== inicio && celdasDe({ x: nodo.x, y: nodo.y, tam: 2 }).every(q => !otros.has(q.y * 64 + q.x))) destinos.set(k, nodo); });
    return { mapa, destinos };
  }
  /* Un hueco de 2×2 de tierra libre cerca de algo */
  function huecoGrande(est, cerca, j) {
    for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = cerca.x + dx, y = cerca.y + dy;
      if (celdasDe({ x, y, tam: 2 }).every(q => dentro(est, q.x, q.y) && TERRENOS[est.casillas[q.y][q.x].t].mov > 0 && !unidadEn(est, q.x, q.y) && !(est.muros || []).some(m => m.x === q.x && m.y === q.y))) return { x, y };
    }
    return null;
  }

  function alcanzables(est, u) {
    if (u.tam === 2) return alcanzablesGrande(est, u);
    const jug = u.dueno >= 0 ? est.jugadores[u.dueno] : null;
    const exento = u.clase === "picaro" || u.clase === "cazador";
    const mapa = new Map();
    const inicio = clave(u.x, u.y);
    mapa.set(inicio, { c: 0, p: null, x: u.x, y: u.y });
    const abiertos = [inicio];
    // Lo que hay en el agua no traba a lo que hay en tierra, ni al revés
    const miAgua = enAgua(est, u);
    const pegado = !exento && !CLASES[u.clase].vuela && vecinosEnemigos(est, u).some(w => enAgua(est, w) === miAgua);
    const eq = bonoReliquias(est, u);
    const barco = esBarco(u), vuela = !!CLASES[u.clase].vuela;
    const nv = navalDe(est, u.dueno);
    const embarca = !barco && u.dueno >= 0 && puedeEmbarcar(est, u.dueno);
    const libreAgua = !!(nv.marinos || nv.fondo);   // entrar o salir del agua no les corta el paso
    const muros = est.muros || [];
    const tun = u.dueno >= 0 && !barco && !vuela ? (est.tuneles || []).filter(t => t.dueno === u.dueno) : [];
    const pos = new Map();
    for (const uid in est.unidades) { const w = est.unidades[uid]; celdasDe(w).forEach(q => pos.set(q.y * 64 + q.x, w)); }
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
        // Un portal con una tropa enemiga en cualquiera de sus dos extremos no se puede usar
        const guarda = [par.a, par.b].some(q => { const w = pos.get(q.y * 64 + q.x); return w && w !== u && hostil(est, w.dueno, u.dueno); });
        if (!guarda) vecinos.push({ x: otro.x, y: otro.y, tipo: "costura" });
      }
      // Túneles propios (Mravec): de una boca a la otra por 1 de movimiento
      tun.forEach(t => { if (t.a.x === nodo.x && t.a.y === nodo.y) vecinos.push({ x: t.b.x, y: t.b.y, tipo: "tunel" }); else if (t.b.x === nodo.x && t.b.y === nodo.y) vecinos.push({ x: t.a.x, y: t.a.y, tipo: "tunel" }); });
      vecinos.forEach(v => {
        if (!dentro(est, v.x, v.y)) return;
        const ct = casilla(est, v.x, v.y);
        const aguaV = ct.t === "agua", aguaN = cs.t === "agua";
        let costo, fin = false;
        if (vuela) { if (ct.t === "vacio") return; costo = 1; }
        else if (barco) { if (!aguaV) return; costo = 1; }
        else if (aguaV) { if (!embarca) return; costo = 1; fin = !aguaN && !libreAgua; }
        else {
          costo = TERRENOS[ct.t].mov;
          if (costo === 0) return;
          if (aguaN && !libreAgua) { fin = true; costo = 1; }   // desembarcar gasta lo que quede
        }
        if (muros.length && muros.some(m => m.x === v.x && m.y === v.y)) return;
        // Caminos propios: por las provincias de tu bando cuesta la mitad
        if (!vuela && !barco && !aguaV && costo > 1 && u.dueno >= 0) { const rg = est.regiones[ct.region]; if (rg && rg.dueno === u.dueno) costo = Math.max(1, Math.ceil(costo / 2)); }
        if (v.tipo === "costura" || v.tipo === "tunel") costo = 1;
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
      // Un volador no puede quedarse sobre el agua
      if (vuela && est.casillas[nodo.y][nodo.x].t === "agua") return;
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
    const cpPisado = campamentoEn(est, x, y);
    if (cpPisado && u.dueno >= 0 && hostil(est, u.dueno, cpPisado.dueno)) {
      est.campamentos.splice(est.campamentos.indexOf(cpPisado), 1);
      reg(est, `${nombreUnidad(u)} arrasa un campamento de ${est.jugadores[cpPisado.dueno].nombre}.`, "conquista");
      est.ev.push({ k: "explosion", x, y });
    }
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
    derrumbarTuneles(est, u, x, y);
    const jug = est.jugadores[u.dueno];
    // Ciudades y fortalezas: se capturan al entrar si nadie las guarda
    const fac = FACCIONES[jug.faccion];
    if (u.heroe && HEROES[u.heroe].ef.consagraAlPisar) consagrar(est, u.dueno, x, y, 0);
    const ciudad = ciudadEn(est, x, y);
    if (ciudad && ciudad.sello >= est.turno && ciudad.dueno !== null && ciudad.dueno !== u.dueno) {
      reg(est, `Un sello de runas protege ${ciudad.nombre}: no se puede sitiar.`, "magia");
    } else if (ciudad && ciudad.dueno !== null && ciudad.dueno !== u.dueno && hostil(est, ciudad.dueno, u.dueno)) {
      // Una ciudad con dueño se asedia: cae al empezar el siguiente turno de este bando si la tropa sigue dentro
      if (!ciudad.asedio || ciudad.asedio.por !== u.dueno) {
        ciudad.asedio = { por: u.dueno, uid: u.uid, desde: est.turno };
        u.pm = 0;
        est.ev.push({ k: "asedio", x, y, dueno: u.dueno });
        reg(est, `${nombreUnidad(u)} pone sitio a ${ciudad.nombre}. Si sigue ahí al empezar el próximo turno de ${jug.nombre}, la ciudad cae.`, "conquista");
        crono(est, "asedio", { ciudad: ciudad.nombre, por: nombreUnidad(u), dueno: u.dueno, antes: ciudad.dueno, capital: ciudad.capital });
      }
    } else if (ciudad && ciudad.dueno === null) capturarCiudad(est, u, ciudad);
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

  /* Una ciudad cambia de manos (al entrar si no tiene dueño; tras un turno de asedio si lo tiene) */
  function capturarCiudad(est, u, ciudad) {
    const jug = est.jugadores[u.dueno], fac = FACCIONES[jug.faccion], x = ciudad.x, y = ciudad.y;
    const antes = ciudad.dueno;
    delete ciudad.asedio;
    usar(u, "ciudades");
    jug.renombre = (jug.renombre || 0) + (ciudad.capital ? 8 : 4);
    // Botín (Okran): al tomar una ciudad de otro bando se lleva parte de lo que ese bando guarda
    if (fac.mods.botin && antes !== null && antes >= 0 && est.jugadores[antes]) {
      const v = est.jugadores[antes], lleva = [];
      ["comida", "oro", "materiales"].forEach(k => { const n = Math.min(30, Math.floor((v.recursos[k] || 0) * 0.2)); if (n > 0) { v.recursos[k] -= n; sumar(jug, k, n); lleva.push(`${n} ${D.RECURSO_NOMBRE[k].toLowerCase()}`); } });
      if (lleva.length) { reg(est, `${jug.nombre} saquea ${ciudad.nombre}: se lleva ${lleva.join(", ")}.`, "conquista"); est.ev.push({ k: "mejora", uid: u.uid, x, y, texto: `Saqueo: ${lleva.join(", ")}` }); }
    }
      ciudad.dueno = u.dueno;
      Object.keys(ciudad.desh).forEach(k => delete ciudad.desh[k]);
      ciudad.edificios = ciudad.edificios.filter(id => !EDIFICIOS[id].solo || EDIFICIOS[id].solo === jug.faccion);
      ciudad.edificios.forEach(id => { ciudad.desh[id] = est.turno + 2; });
      ciudad.tomada = est.turno + 2;   // para explicar en la ciudad por qué no funcionan sus edificios
      ciudad.reclutado = true;
      u.pm = 0;
      est.stats.ciudades[u.dueno]++;
      if (antes !== null) jug.cuenta.saqueos++;
      est.ev.push({ k: "captura", x, y, dueno: u.dueno });
      const rg = regionDeCasilla(est, x, y);
      reg(est, `${jug.nombre} conquista ${ciudad.nombre}${antes !== null ? " a " + est.jugadores[antes].nombre : ""}.`, "conquista");
      crono(est, "conquista", { ciudad: ciudad.nombre, region: rg.nombre, por: nombreUnidad(u), porId: u.s ? u.s.id : null, dueno: u.dueno, antes, capital: ciudad.capital });
      if (fac.mods.consagra) consagrar(est, u.dueno, x, y, 1 + ((jug.sabEf || VACIO).consagraRadio || 0));
      // Castra (Balutia): la ciudad conquistada queda fortificada 3 turnos
      if ((jug.sabEf || VACIO).castra) { ciudad.obras = ciudad.obras || {}; ciudad.obras.fortificar = Math.max(ciudad.obras.fortificar || 0, est.turno + 2); reg(est, `${jug.nombre} levanta un campamento fortificado en ${ciudad.nombre}.`, "obra"); }
      // Tributo de Balutia: la ciudad conquistada entrega tropa, una vez por ciudad
      if (fac.mods.tributo && !ciudad.tributada && (efHeroe(est, u.dueno).tributoSinTope || jug.cuenta.tributos < fac.mods.tributo + ((jug.sabEf || VACIO).tributo || 0)) && hayHueco(est, u.dueno)) {
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
    usar(u, "ruinas");
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
    } else if (jug.humano !== undefined && hayHueco(est, u.dueno)) {
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
      else { u.dueno = -1; u.errante = false; u.sinBandera = jug.faccion; u.nombre = nombreUnidad(u); u.fuerza = 0; u.hp = Math.min(u.hp, ef(est, u).hpMax); }
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
    if (odiaA(est, k, de)) return false;
    if (dip.soloHumanos && FACCIONES[quien.faccion].monstruos) return false;
    let p = dip.pacta;
    const orden = vivos(est).map(q => ({ q, p: puntuacion(est, q) })).sort((a, b) => b.p - a.p);
    if (orden[0].q === de && orden.length > 2) p *= 0.4;        // nadie quiere ayudar al que va ganando
    if (orden[0].q !== de && orden[0].q !== k) p += 0.15;       // un enemigo común más fuerte une mucho
    return rn(est) < p;
  }
  /* ¿Odia el ejército de a al de b? (Osses odia a todos los vivos) */
  function odiaA(est, a, b) {
    const fa = facDe(est, a), fb = facDe(est, b);
    if (fa.odia === "vivos") return !fb.monstruos || est.jugadores[b].faccion !== est.jugadores[a].faccion;
    return (fa.odia || []).includes(est.jugadores[b].faccion);
  }
  /* Pactar con quien se odia: cada soldado puede negarse y volverse contra todos (uno de cada cinco, en Osses uno de cada cuatro) */
  function renegados(est, a, b) {
    if (!odiaA(est, a, b)) return;
    const p = facDe(est, a).odia === "vivos" ? 0.25 : 0.2;
    const se = unidadesDe(est, a).filter(u => u.s && !u.lider && !u.heroe && !u.reanimado && est.casillas[u.y][u.x].t !== "agua" && rn(est) < p);   // los embarcados no se van: no tienen adónde
    se.forEach(u => {
      u.dueno = -1; u.errante = true; u.nombre = nombreUnidad(u); u.fuerza = 0; u.renegado = est.jugadores[a].faccion;
      u.hp = Math.min(u.hp, ef(est, u).hpMax);
      est.ev.push({ k: "captura", x: u.x, y: u.y, dueno: -1 });
    });
    if (se.length) {
      reg(est, `${se.length === 1 ? "Un soldado" : `${se.length} soldados`} de ${est.jugadores[a].nombre} no aceptan el pacto con ${est.jugadores[b].nombre} y se vuelven contra todos.`, "pacto");
      crono(est, "reniegan", { dueno: a, antes: b, n: se.length });
    }
  }

  function sellarPacto(est, a, b) {
    est.pactos[clavePacto(a, b)] = true;
    renegados(est, a, b); renegados(est, b, a);
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
        let ruta = camino(info, acc.x, acc.y);
        // Una trampa enemiga en el camino lo para ahí (si la casilla está libre)
        let trampa = null, destinoReal = destino;
        if ((est.trampas || []).length) for (let i = 1; i < ruta.length && !trampa; i++) {
          const cel = celdasDe({ x: ruta[i].x, y: ruta[i].y, tam: u.tam || 1 });
          const t = est.trampas.find(q => hostil(est, q.dueno, j) && cel.some(c => c.x === q.x && c.y === q.y));
          if (t && !cel.some(c => { const o = unidadEn(est, c.x, c.y); return o && o !== u; })) { trampa = t; ruta = ruta.slice(0, i + 1); destinoReal = info.mapa.get(clave(ruta[i].x, ruta[i].y)) || destino; }
        }
        if (trampa) { acc = Object.assign({}, acc, { x: ruta[ruta.length - 1].x, y: ruta[ruta.length - 1].y }); }
        const de = { x: u.x, y: u.y };
        const antesAgua = enAgua(est, u);
        Object.values(est.ciudades).forEach(c => { if (c.asedio && c.asedio.uid === u.uid) delete c.asedio; });
        u.pm -= destinoReal.c;
        u.recorrido = (u.recorrido || 0) + ruta.length - 1;
        // Pasar por la boca de un túnel enemigo lo hunde
        if ((est.tuneles || []).length) ruta.slice(1, -1).forEach(p => celdasDe({ x: p.x, y: p.y, tam: u.tam || 1 }).forEach(q => derrumbarTuneles(est, u, q.x, q.y)));
        usar(u, "pasos", ruta.length - 1); if (enAgua(est, u)) usar(u, "mar");
        quemarAlLlegar(est, u, acc.x, acc.y);
        u.x = acc.x; u.y = acc.y; u.quieto = false; u.descanso = false;
        if (destino.fin || (!esBarco(u) && antesAgua !== enAgua(est, u) && !(navalDe(est, j).marinos || navalDe(est, j).fondo))) u.pm = 0;
        est.ev.push({ k: "mov", uid: u.uid, de, a: { x: u.x, y: u.y }, ruta });
        celdasDe(u).forEach(q => { if (est.unidades[u.uid]) entrarCasilla(est, u, q.x, q.y); });
        if (trampa && est.unidades[u.uid]) {
          est.trampas.splice(est.trampas.indexOf(trampa), 1);
          u.pm = 0;
          reg(est, `${nombreUnidad(u)} cae en una trampa de ${est.jugadores[trampa.dueno].nombre}.`, "combate");
          est.ev.push({ k: "golpe", de: null, a: u.uid, x: trampa.x, y: trampa.y, dmg: 2, dist: 0, arma: "salpica" });
          aplicarDano(est, u, 2, null);
        }
        actualizarVision(est, j);
        comprobarVictoria(est);
        return { ok: true, ev: est.ev };
      }
      case "atacar": {
        const u = est.unidades[acc.uid];
        if (!u || u.dueno !== j) return error("Esa unidad no es tuya.");
        if (u.atacado) return error("Ya atacó este turno.");
        if (CLASES[u.clase].sanador) return error("Los sanadores no atacan.");
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
        if (acc.campamento !== undefined) {
          const rc = razonReclutarCampamento(est, j, acc.campamento, acc.clase);
          if (rc) return error(rc);
          const cp = est.campamentos.find(c => c.id === acc.campamento);
          pagar(jug, costeReclutar(est, j, acc.clase, null));
          const p = !unidadEn(est, cp.x, cp.y) && TERRENOS[est.casillas[cp.y][cp.x].t].mov > 0 ? { x: cp.x, y: cp.y } : casillaLibreCerca(est, cp, j);
          const facC = FACCIONES[jug.faccion], rr = { s: est.rs };
          const s = S.crearSoldado(rr, { clase: acc.clase, cultura: facC.cultura, origen: elegirDe(est, facC.origenes), anio: est.anio });
          est.rs = rr.s;
          const u = nuevaUnidad(est, j, s.clase, p.x, p.y, s, { nuevo: true });
          u.pm = 0; u.atacado = true;
          cp.reclutado = true;
          est.ev.push({ k: "nuevo", uid: u.uid, x: u.x, y: u.y });
          reg(est, `${jug.nombre} recluta en un campamento a ${S.nombreCompleto(s)}, ${D.tropa(jug.faccion, s.clase).nombre.toLowerCase()}.`, "recluta");
          actualizarVision(est, j);
          return { ok: true, ev: est.ev, uid: u.uid };
        }
        const razon = razonNoReclutar(est, j, acc.ciudad, acc.clase);
        if (razon) return error(razon);
        const ciudad = est.ciudades[acc.ciudad];
        const coste = costeReclutar(est, j, acc.clase, ciudad);
        pagar(jug, coste);
        if (CLASES[acc.clase].naval) {
          // Un barco: sale al agua de al lado, con su nombre pintado en la proa
          let pa = aguaLibreCerca(est, ciudad);
          if (acc.x !== undefined) { pa = aguasLibres(est, ciudad).find(q => q.x === acc.x && q.y === acc.y); if (!pa) return error("El barco no puede salir ahí."); }
          const usados = new Set(Object.values(est.unidades).map(w => w.nombre));
          const libres = D.NOMBRES_BARCO.filter(n => !usados.has(n));
          const nombre = libres.length ? libres[ri(est, libres.length)] : CLASES[acc.clase].nombre;
          const b = nuevaUnidad(est, j, acc.clase, pa.x, pa.y, null, { nombre, nuevo: true });
          b.pm = 0; b.atacado = true;
          est.ev.push({ k: "nuevo", uid: b.uid, x: b.x, y: b.y });
          ciudad.reclutado = true;
          // Levas: la ciudad puede entrenar otra tropa este turno, también si la primera fue un barco
          if (ciudad.levasT === est.turno && !ciudad.leva2) { ciudad.leva2 = true; ciudad.reclutado = false; }
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
        if (ciudad.levasT === est.turno && !ciudad.leva2) { ciudad.leva2 = true; ciudad.reclutado = false; }
        actualizarVision(est, j);
        return { ok: true, ev: est.ev, uid: u.uid };
      }
      case "portal": {
        const r = razonNoPortal(est, j, acc.uid, acc.ciudad);
        if (r) return error(r);
        const u = est.unidades[acc.uid], de = ciudadPortalDe(est, u), a = est.ciudades[acc.ciudad];
        pagar(jug, costePortal(u));
        const lib = u.tam === 2 ? huecoGrande(est, a, j) : !unidadEn(est, a.x, a.y) ? { x: a.x, y: a.y } : casillaLibreCerca(est, a, j);
        if (!lib) return error("No hay sitio en la ciudad de llegada.");
        est.ev.push({ k: "explosion", x: u.x, y: u.y });
        u.x = lib.x; u.y = lib.y; u.pm = 0; u.atacado = true;
        de.portalT = est.turno; a.portalT = est.turno;
        est.ev.push({ k: "nuevo", uid: u.uid, x: u.x, y: u.y });
        reg(est, `${nombreUnidad(u)} cruza el portal de ${de.nombre} a ${a.nombre}.`, "magia");
        actualizarVision(est, j);
        return { ok: true, ev: est.ev };
      }
      case "transmutar": {
        const ciudad = est.ciudades[acc.ciudad];
        if (!ciudad || ciudad.dueno !== j) return error("Esa ciudad no es tuya.");
        if (!ciudad.edificios.includes("transmutacion") || ciudad.desh.transmutacion >= est.turno) return error("La ciudad no tiene Transmutación.");
        const n = Math.floor(acc.n || 0), usado = ciudad.transT === est.turno ? ciudad.transN || 0 : 0;
        if (!RECURSOS.includes(acc.de) || !RECURSOS.includes(acc.a) || acc.de === acc.a) return error("Elige dos recursos distintos.");
        if (acc.a === "anima") return error("El Ánima no se consigue así.");
        if (n < 1 || usado + n > 6) return error(`Esta ciudad puede cambiar ${6 - usado} más este turno.`);
        if ((jug.recursos[acc.de] || 0) < n) return error("No tienes tanto.");
        const sale = transmutado(est, j, n);
        if (sale < 1) return error("Hace falta cambiar más para que salga algo.");
        jug.recursos[acc.de] -= n; sumar(jug, acc.a, sale);
        ciudad.transT = est.turno; ciudad.transN = usado + n;
        reg(est, `${ciudad.nombre} cambia ${n} de ${D.RECURSO_NOMBRE[acc.de].toLowerCase()} por ${sale} de ${D.RECURSO_NOMBRE[acc.a].toLowerCase()}.`, "obra");
        return { ok: true, ev: est.ev };
      }
      case "obra": {
        const ciudad = est.ciudades[acc.ciudad], ob = D.OBRAS[acc.id];
        if (!ciudad || ciudad.dueno !== j) return error("Esa ciudad no es tuya.");
        if (!ob) return error("Esa obra no existe.");
        ciudad.obras = ciudad.obras || {};
        if (acc.id === "levas" ? ciudad.levasT === est.turno : ciudad.obras[acc.id] >= est.turno) return error("Esa obra ya está en marcha.");
        if (!puedePagar(jug, ob.coste)) return error("No te alcanzan los recursos.");
        pagar(jug, ob.coste);
        if (acc.id === "levas") {
          ciudad.levasT = est.turno;
          // Si la ciudad ya entrenó este turno, las Levas le dejan entrenar otra ahora mismo
          if (ciudad.reclutado && !ciudad.leva2) { ciudad.leva2 = true; ciudad.reclutado = false; }
        }
        else ciudad.obras[acc.id] = est.turno + ob.turnos - 1;
        if (acc.id === "vigias") actualizarVision(est, j);
        reg(est, `${ciudad.nombre}: ${ob.nombre.toLowerCase()}.`, "obra");
        return { ok: true, ev: est.ev };
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
        const cz = SB.cruce(jug.faccion, acc.escuela);
        let nombreEsc, nombreRama;
        if (cz) { jug.tech[acc.escuela] = 1; nombreEsc = cz.nombre; nombreRama = "dos ramas"; }
        else { jug.tech[acc.escuela] = (jug.tech[acc.escuela] || 0) + 1; const r = SB.rama(jug.faccion, acc.escuela); nombreEsc = r.escalones[jug.tech[acc.escuela] - 1].nombre; nombreRama = r.nombre; }
        rehacerSaber(est, j);
        reg(est, `${jug.nombre} domina ${nombreEsc} (${nombreRama}).`, "tecnologia");
        crono(est, "tecnologia", { dueno: j, escuela: nombreRama, nombre: nombreEsc });
        return { ok: true, ev: est.ev };
      }
      case "habilidad": return habilidad(est, j, acc);
      case "invocar": {
        const rq = requisitosHeroe(est, j, acc.heroe, acc.ciudad);
        if (!rq.ok) return error(rq.razon);
        const ciudad = est.ciudades[acc.ciudad];
        const h = HEROES[acc.heroe];
        pagar(jug, h.coste);
        const p = h.tam === 2 ? huecoGrande(est, ciudad, j) : casillaLibreCerca(est, ciudad, j);
        const ficha = jug.heroes.find(x => x.id === acc.heroe);
        const u = nuevaUnidad(est, j, "heroe", p.x, p.y, null, { heroe: acc.heroe, nombre: ficha.nombre, cd: 0, cd2: 0 });
        if (h.tam === 2) u.tam = 2;
        u.pm = 0; u.atacado = true;
        jug.heroeInvocado = acc.heroe; jug.heroeUid = u.uid;
        if (h.ef.temible) est.hayTemible = true;
        est.ev.push({ k: "heroe", uid: u.uid, x: u.x, y: u.y, dueno: j });
        reg(est, `${jug.nombre} invoca a ${ficha.nombre}.`, "heroe");
        crono(est, "heroe", { dueno: j, nombre: ficha.nombre, ciudad: ciudad.nombre, heroe: acc.heroe });
        (h.ef.llegaCon || []).forEach(clase => {
          if (!hayHueco(est, j)) return;
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
      if (!(u.clase === "arcanista" || u.clase === "archimago") || !(jug.sabEf || VACIO).transmutar) return error("Tu ejército no sabe cambiar el terreno.");
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
    if (acc.id === "trampa") {
      const r = razonTrampa(est, j, u, acc.x, acc.y);
      if (r) return error(r);
      pagar(jug, COSTE_TRAMPA);
      est.trampas = est.trampas || [];
      est.trampaN = (est.trampaN || 0) + 1;
      est.trampas.push({ id: est.trampaN, x: acc.x, y: acc.y, dueno: j });
      u.atacado = true; u.pm = 0;
      return { ok: true, ev: est.ev };
    }
    if (acc.id === "tunel") {
      const r = razonTunel(est, j, u, acc.x, acc.y);
      if (r) return error(r);
      pagar(jug, COSTE_TUNEL);
      est.tuneles = est.tuneles || [];
      est.tunelN = (est.tunelN || 0) + 1;
      est.tuneles.push({ id: est.tunelN, dueno: j, a: { x: u.x, y: u.y }, b: { x: acc.x, y: acc.y } });
      u.atacado = true; u.pm = 0;
      reg(est, `${nombreUnidad(u)} cava un túnel.`, "obra");
      est.ev.push({ k: "aura", x: acc.x, y: acc.y, dueno: j });
      return { ok: true, ev: est.ev };
    }
    if (acc.id === "marcar") {
      const r = razonMarcar(est, j, u, acc.x, acc.y);
      if (r) return error(r);
      const t = unidadEn(est, acc.x, acc.y);
      t.efectos = t.efectos || {};
      t.efectos.marca = { por: j, hasta: est.turno + 1 };
      u.cdMarca = CD_MARCA;
      reg(est, `${nombreUnidad(u)} marca a ${nombreUnidad(t)} como presa.`, "combate");
      est.ev.push({ k: "mejora", uid: t.uid, x: t.x, y: t.y, texto: "Presa marcada" });
      return { ok: true, ev: est.ev };
    }
    if (acc.id === "contrato") {
      const r = razonContrato(est, j, u, acc.x, acc.y);
      if (r) return error(r);
      const ciudad = ciudadEn(est, acc.x, acc.y), precio = precioContrato(ciudad);
      pagar(jug, { oro: precio });
      jug.contratoT = est.turno;
      reg(est, `${jug.nombre} compra ${ciudad.nombre} por ${precio} de oro.`, "conquista");
      const pm = u.pm, at = u.atacado;
      capturarCiudad(est, u, ciudad);
      u.pm = pm; u.atacado = at;
      actualizarVision(est, j);
      comprobarVictoria(est);
      return { ok: true, ev: est.ev };
    }
    if (acc.id === "campamento") {
      const r = razonCampamento(est, j, u, acc.x, acc.y);
      if (r) return error(r);
      pagar(jug, COSTE_CAMPAMENTO);
      est.campamentos = est.campamentos || [];
      est.campamentoN = (est.campamentoN || 0) + 1;
      est.campamentos.push({ id: est.campamentoN, x: acc.x, y: acc.y, dueno: j, hasta: est.turno + DURA_CAMPAMENTO - 1, reclutado: false });
      u.atacado = true; u.pm = 0;
      reg(est, `${nombreUnidad(u)} levanta un campamento.`, "obra");
      est.ev.push({ k: "aura", x: acc.x, y: acc.y, dueno: j });
      return { ok: true, ev: est.ev };
    }
    if (acc.id === "talar") {
      if (!CLASES[u.clase].rompe) return error("Esa tropa no puede abrirse paso.");
      if (u.atacado) return error("Ya actuó este turno.");
      const c = casilla(est, acc.x, acc.y);
      if (!c || c.t !== "bosque" || c.est || unidadEn(est, acc.x, acc.y) || dist(u, acc) > 1) return error("Tiene que ser un bosque libre a su lado.");
      c.t = "llanura";
      u.atacado = true; u.pm = 0;
      est.ev.push({ k: "explosion", x: acc.x, y: acc.y });
      reg(est, `${nombreUnidad(u)} derriba el bosque y abre camino.`, "suceso");
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
      ciudad.saboteo = est.turno + 3;
      u.atacado = true; u.pm = 0;
      reg(est, `${nombreUnidad(u)} sabotea ${EDIFICIOS[acc.edificio].nombre} en ${ciudad.nombre}.`, "sabotaje");
      crono(est, "sabotaje", { por: nombreUnidad(u), ciudad: ciudad.nombre, edificio: EDIFICIOS[acc.edificio].nombre, dueno: j });
      return { ok: true, ev: est.ev };
    }
    if (acc.id === "reanimar") {
      if (!(jug.sabEf || VACIO).reanimar) return error("Tu ejército no levanta a los muertos.");
      if (u.atacado) return error("Ya actuó este turno.");
      if (!puedePagar(jug, { anima: 3 })) return error("Hacen falta 3 de Ánima.");
      const i = est.tumbas.findIndex(t => t.x === acc.x && t.y === acc.y);
      if (i < 0 || dist(u, acc) > 1) return error("No hay nadie que levantar ahí.");
      if (unidadEn(est, acc.x, acc.y)) return error("La casilla está ocupada.");
      // Los reanimados no cuentan para el límite: se pueden levantar aunque esté lleno
      const t = est.tumbas.splice(i, 1)[0];
      pagar(jug, { anima: 3 });
      const s = t.s;
      s.reanimado = true; s.muerte = null; s.equipo = {};
      const n = nuevaUnidad(est, j, t.clase, acc.x, acc.y, s, { reanimado: true });
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
      const n = consagrar(est, j, u.x, u.y, (tieneEdificio(est, j, "catedral") ? 2 : 1) + ((jug.sabEf || VACIO).consagraRadio || 0));
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
      const base = Math.max(1, fac.mods.soborno - ((jug.sabEf || VACIO).soborno || 0));
      const gratis = efHeroe(est, j).sobornoGratis && jug.sobornoGratisT !== est.turno;
      const coste = gratis ? {} : { oro: efHeroe(est, j).sobornoMitad ? Math.ceil(base / 2) : base };
      if (gratis) jug.sobornoGratisT = est.turno;
      const r = contratar(est, j, u, acc, coste, 2);
      if (r) return error(r);
      return { ok: true, ev: est.ev };
    }
    if (acc.id === "acoger") {
      // Tropas que se quedaron sin bandera cuando cayó su ejército: se las puede acoger pagando
      const t = unidadEn(est, acc.x, acc.y);
      if (!t || t.dueno !== -1 || !t.sinBandera || dist(u, t) > 1) return error("Tiene que haber una tropa sin bandera a su lado.");
      if (u.atacado) return error("Ya actuó este turno.");
      if (!hayHueco(est, j)) return error(`Ya tienes el máximo de tropas (${limiteTropas(est, j)}).`);
      const coste = { oro: costeAcoger(t) };
      if (!puedePagar(jug, coste)) return error(`Hacen falta ${coste.oro} de oro.`);
      pagar(jug, coste);
      t.dueno = j; delete t.sinBandera; t.errante = false; t.pm = 0; t.atacado = true; t.acogido = true;
      if (t.s) { t.s.acogidoDe = t.s.acogidoDe || true; }
      u.atacado = true; u.pm = 0;
      est.ev.push({ k: "captura", x: t.x, y: t.y, dueno: j });
      reg(est, `${nombreUnidad(t)}, que se había quedado sin bandera, se une a ${jug.nombre}.`, "recluta");
      actualizarVision(est, j);
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
      const enemigoEn = (x, y) => { const w = unidadEn(est, x, y); return w && hostil(est, w.dueno, j) ? w : null; };
      const radioDe = r => unidadesDe(est, j).filter(w => dist(u, w) <= r);
      const golpeDirecto = (w, n) => { if (!est.unidades[w.uid]) return; est.ev.push({ k: "golpe", de: u.uid, a: w.uid, x: w.x, y: w.y, dmg: n, dist: dist(u, w), arma: "magia" }); w.descanso = false; aplicarDano(est, w, n, u); };
      if (ab.id === "formar") {
        const vec = unidadesDe(est, j).filter(w => dist(u, w) <= (ab.radio || 1));
        if (vec.length < 2) return error("No tiene aliados cerca.");
        vec.forEach(w => { w.efectos.formado = est.turno + 1; w.efectos.formadoN = ab.def || 1; });
        est.ev.push({ k: "aura", x: u.x, y: u.y, dueno: j });
      } else if (ab.id === "reino") {
        const vec = radioDe(ab.radio).filter(w => w !== u);
        if (!vec.length) return error("No tiene aliados cerca.");
        vec.forEach(w => { w.pm = ef(est, w).mov; w.atacado = false; w.quieto = true; });
        est.ev.push({ k: "aura", x: u.x, y: u.y, dueno: j });
      } else if (ab.id === "contratar") {
        const r = contratar(est, j, u, acc, ab.coste || {}, 3);
        if (r) return error(r);
        u[campo] = ab.cd;
        return { ok: true, ev: est.ev };
      } else if (ab.id === "comprar") {
        const t = unidadEn(est, acc.x, acc.y);
        if (!t || lejos || t.dueno === j) return error("Elige una tropa a su alcance.");
        if (t.dueno === -1) { const r = contratar(est, j, u, acc, ab.coste || {}, 3); if (r) return error(r); u[campo] = ab.cd; return { ok: true, ev: est.ev }; }
        if (!hostil(est, t.dueno, j) || t.heroe || t.lider || esBarco(t)) return error("Esa tropa no se vende.");
        if (t.s && S.rangoIndice(t.s.victorias + (t.vicG || 0)) >= 1) return error("Solo se compra a los reclutas.");
        if (!hayHueco(est, j)) return error("Ya tienes el máximo de tropas.");
        t.duenoOriginal = t.dueno; t.dueno = j; t.sobornada = est.turno + 3; t.pm = 0; t.atacado = true;
        est.ev.push({ k: "captura", x: t.x, y: t.y, dueno: j });
        reg(est, `${nombreUnidad(t)} acepta el dinero y lucha por ${jug.nombre} durante 3 turnos.`, "suceso");
      } else if (ab.id === "pagaDoble") {
        jug.pagaDobleT = est.turno;
        est.ev.push({ k: "aura", x: u.x, y: u.y, dueno: j });
      } else if (ab.id === "reparar") {
        const maq = radioDe(ab.radio).filter(w => (esBarco(w) || CLASES[w.clase].sinComida) && w.hp < ef(est, w).hpMax);
        if (!maq.length) return error("No hay máquinas dañadas cerca.");
        maq.forEach(w => { const antes = w.hp; w.hp = Math.min(ef(est, w).hpMax, w.hp + ab.cura); est.ev.push({ k: "cura", uid: w.uid, x: w.x, y: w.y, n: w.hp - antes }); });
      } else if (ab.id === "montaje") {
        let hechos = 0;
        for (let i = 0; i < (ab.n || 1); i++) {
          const lib = casillaLibreCerca(est, u, j);
          if (!lib) break;
          const fac = FACCIONES[jug.faccion], r0 = { s: est.rs };
          const sol = S.crearSoldado(r0, { clase: ab.clase, cultura: fac.cultura, origen: elegirDe(est, fac.origenes), anio: est.anio });
          est.rs = r0.s;
          const n = nuevaUnidad(est, j, ab.clase, lib.x, lib.y, sol, { invocado: true });
          n.pm = 0; n.atacado = true;
          est.ev.push({ k: "nuevo", uid: n.uid, x: n.x, y: n.y });
          hechos++;
        }
        if (!hechos) return error("No hay sitio libre a su lado.");
      } else if (ab.id === "ocultar") {
        radioDe(ab.radio).forEach(w => { w.efectos.oculto = est.turno + (ab.turnos || 2); });
        est.ev.push({ k: "aura", x: u.x, y: u.y, dueno: j });
      } else if (ab.id === "area") {
        if (!dentro(est, acc.x, acc.y) || lejos) return error("Está fuera de alcance.");
        if (enTregua(est)) return error(`Hay tregua hasta el turno ${est.tregua}.`);
        const dianas = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const w = enemigoEn(acc.x + dx, acc.y + dy); if (w && !dianas.includes(w)) dianas.push(w); }
        if (!dianas.length) return error("No hay enemigos ahí.");
        est.ev.push({ k: "explosion", x: acc.x, y: acc.y, de: u.uid });
        dianas.forEach(w => { if (!est.unidades[w.uid]) return; est.ev.push({ k: "golpe", de: u.uid, a: w.uid, x: w.x, y: w.y, dmg: ab.dano, dist: 0, arma: "salpica" }); w.descanso = false; aplicarDano(est, w, ab.dano, u); });
        if (ab.fuego) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) prenderFuego(est, acc.x + dx, acc.y + dy, ab.fuego, j);
      } else if (ab.id === "curar") {
        const heridos = unidadesDe(est, j).filter(w => dist(u, w) <= ab.radio && (w.hp < ef(est, w).hpMax || (ab.limpia && w.efectos.frenado)));
        if (!heridos.length) return error("No hay aliados heridos cerca.");
        heridos.forEach(w => { const antes = w.hp; w.hp = Math.min(ef(est, w).hpMax, w.hp + ab.cura); if (ab.limpia) delete w.efectos.frenado; est.ev.push({ k: "cura", uid: w.uid, x: w.x, y: w.y, n: w.hp - antes }); });
      } else if (ab.id === "miasma") {
        const dianas = Object.values(est.unidades).filter(w => hostil(est, w.dueno, j) && dist(u, w) <= ab.radio);
        if (!dianas.length) return error("No hay enemigos cerca.");
        dianas.forEach(w => { w.efectos.miasma = { n: ab.atq, hasta: est.turno + ab.turnos - 1 }; if (ab.traba) { w.efectos.traba = est.turno + ab.turnos - 1; w.pm = 0; } });
        est.ev.push({ k: "aura", x: u.x, y: u.y, dueno: j });
      } else if (ab.id === "muro") {
        if (!dentro(est, acc.x, acc.y) || lejos || ocupa(u, acc.x, acc.y)) return error("Elige una casilla a su alcance.");
        const cas = (ab.largo || 1) > 1 ? lineaCruzada(u, acc.x, acc.y, ab.largo) : [{ x: acc.x, y: acc.y }];
        const buenas = cas.filter(p => { const c = casilla(est, p.x, p.y); return c && !c.est && !unidadEn(est, p.x, p.y) && TERRENOS[c.t].mov > 0; });
        if (!buenas.length) return error("No se puede levantar un muro ahí.");
        buenas.forEach(p => { est.muros.push({ x: p.x, y: p.y, hasta: est.turno + (ab.turnos || 2), dueno: j, fuego: !!ab.fuego }); est.ev.push({ k: "muro", x: p.x, y: p.y }); if (ab.fuego) prenderFuego(est, p.x, p.y, ab.turnos || 2, j); });
      } else if (ab.id === "sello") {
        const ci = ciudadEn(est, acc.x, acc.y);
        if (!ci || ci.dueno !== j || lejos) return error("Elige una ciudad tuya a su alcance.");
        ci.sello = est.turno + ab.turnos - 1; delete ci.asedio;
        est.ev.push({ k: "aura", x: ci.x, y: ci.y, dueno: j });
      } else if (ab.id === "alzar") {
        const cand = est.tumbas.filter(t => t.dueno === j && dist(u, t) <= (ab.radio || 99)).sort((a, b) => (b.s.victorias || 0) - (a.s.victorias || 0)).slice(0, ab.n || 1);
        if (!cand.length) return error("No hay ningún aliado caído cerca.");
        let alzados = 0;
        cand.forEach(t => {
          const lib = !unidadEn(est, t.x, t.y) && TERRENOS[est.casillas[t.y][t.x].t].mov > 0 ? { x: t.x, y: t.y } : casillaLibreCerca(est, u, j);
          if (!lib) return;
          est.tumbas.splice(est.tumbas.indexOf(t), 1);
          const sol = t.s; sol.reanimado = true; sol.muerte = null; sol.equipo = {};
          const n = nuevaUnidad(est, j, t.clase, lib.x, lib.y, sol, { reanimado: true });
          n.pm = 0; n.atacado = true;
          est.ev.push({ k: "nuevo", uid: n.uid, x: n.x, y: n.y });
          crono(est, "reanimacion", { nombre: S.nombreConApodo(sol), dueno: j });
          alzados++;
        });
        if (!alzados) return error("No hay sitio para levantarlos.");
      } else if (ab.id === "marea") {
        const vec = radioDe(ab.radio);
        vec.forEach(w => { w.efectos.marea = est.turno + ab.turnos - 1; });
        est.ev.push({ k: "aura", x: u.x, y: u.y, dueno: j });
      } else if (ab.id === "juicio") {
        const t = enemigoEn(acc.x, acc.y);
        if (!t || lejos || !veUnidad(est, j, t)) return error("Elige un enemigo a su alcance.");
        golpeDirecto(t, ab.dano * (CLASES[t.clase].muertoViviente || t.reanimado || esMonstruo(est, t) ? 2 : 1));
      } else if (ab.id === "alba") {
        let algo = false;
        Object.values(est.unidades).forEach(w => {
          if (dist(u, w) > ab.radio || !consagradaPara(est, j, w.x, w.y)) return;
          if (w.dueno === j) { const antes = w.hp; w.hp = Math.min(ef(est, w).hpMax, w.hp + ab.cura); if (w.hp > antes) { est.ev.push({ k: "cura", uid: w.uid, x: w.x, y: w.y, n: w.hp - antes }); algo = true; } }
          else if (hostil(est, w.dueno, j)) { golpeDirecto(w, ab.dano); algo = true; }
        });
        if (!algo) return error("No hay nadie en casillas consagradas cerca.");
      } else if (ab.id === "corte") {
        const dianas = vecinosEnemigos(est, u).filter(w => !razonNoAtacar(est, u, w));
        if (!dianas.length) return error("No tiene enemigos al lado.");
        dianas.forEach(w => { if (est.unidades[w.uid] && est.unidades[u.uid]) atacarUnidad(est, u, w, true, { multJinete: ab.multJinete }); });
      } else if (ab.id === "desafio") {
        const t = enemigoEn(acc.x, acc.y);
        if (!t || lejos || t.dueno < 0) return error("Elige un enemigo a su alcance.");
        if (desafioDe(est, t) || desafioDe(est, u)) return error("Ya hay un desafío en marcha.");
        est.desafios = est.desafios || [];
        est.desafios.push({ a: u.uid, b: t.uid, hasta: est.turno + ab.turnos - 1 });
        est.ev.push({ k: "leyendas", x: t.x, y: t.y, a: u.uid, b: t.uid });
        reg(est, `${nombreUnidad(u)} desafía a ${nombreUnidad(t)}. Nadie más puede meterse.`, "heroico");
      } else if (ab.id === "salto") {
        const c = casilla(est, acc.x, acc.y);
        const libreSalto = q => { const cq = casilla(est, q.x, q.y); const o = unidadEn(est, q.x, q.y); return cq && TERRENOS[cq.t].mov > 0 && (!o || o === u); };
        if (!c || lejos || (acc.x === u.x && acc.y === u.y) || !celdasDe({ x: acc.x, y: acc.y, tam: u.tam || 1 }).every(libreSalto)) return error(u.tam === 2 ? "Hace falta un hueco de 2×2 casillas de tierra libre." : "Elige una casilla de tierra libre a su alcance.");
        const de = { x: u.x, y: u.y };
        u.x = acc.x; u.y = acc.y;
        est.ev.push({ k: "mov", uid: u.uid, de, a: { x: u.x, y: u.y }, ruta: [de, { x: u.x, y: u.y }] });
        celdasDe(u).forEach(q => { if (est.unidades[u.uid]) entrarCasilla(est, u, q.x, q.y); });
        if (ab.golpe) vecinosEnemigos(est, u).forEach(w => golpeDirecto(w, Math.max(1, Math.floor(ef(est, u).atq / 2))));
      } else if (ab.id === "engullir") {
        const t = enemigoEn(acc.x, acc.y);
        if (!t || dist(u, t) > 1 || t.heroe || t.lider) return error("Elige un enemigo a su lado.");
        if (t.hp * 3 > ef(est, t).hpMax) return error("Aún tiene demasiada vida.");
        est.ev.push({ k: "golpe", de: u.uid, a: t.uid, x: t.x, y: t.y, dmg: t.hp, dist: 1, arma: "garras" });
        matar(est, t, u);
        u.hp = Math.min(ef(est, u).hpMax, u.hp + (ab.cura || 0));
      } else if (ab.id === "muralla") {
        radioDe(ab.radio).forEach(w => { w.efectos.muralla = { tope: ab.tope, hasta: est.turno + 1 }; });
        est.ev.push({ k: "aura", x: u.x, y: u.y, dueno: j });
      } else if (ab.id === "linea") {
        const tU = (u.tam || 1) - 1;
        const dx = acc.x > u.x + tU ? 1 : acc.x < u.x ? -1 : 0, dy = acc.y > u.y + tU ? 1 : acc.y < u.y ? -1 : 0;
        if (!dx && !dy) return error("Elige una dirección.");
        // Desde la casilla del cuerpo que da a ese lado (en un gigante, la de su borde)
        const ox = dx > 0 ? u.x + tU : dx < 0 ? u.x : Math.min(u.x + tU, Math.max(u.x, acc.x)), oy = dy > 0 ? u.y + tU : dy < 0 ? u.y : Math.min(u.y + tU, Math.max(u.y, acc.y));
        const dianas = [];
        for (let k = 1; k <= ab.largo; k++) { const w = enemigoEn(ox + dx * k, oy + dy * k); if (w && !dianas.includes(w)) dianas.push(w); }
        if (!dianas.length) return error("No hay enemigos en esa línea.");
        dianas.forEach(w => golpeDirecto(w, ab.dano));
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
  const costeAcoger = t => 3 + 2 * (t.s ? S.rangoIndice(t.s.victorias + (t.vicG || 0)) : 0);

  function contratar(est, j, u, acc, coste, turnos) {
    const jug = est.jugadores[j];
    const t = unidadEn(est, acc.x, acc.y);
    if (!t || t.dueno !== -1 || dist(u, t) > 1) return "Tiene que haber una criatura salvaje a su lado.";
    if (t.sinBandera) return "Esa tropa no se soborna, se acoge.";
    if (!hayHueco(est, j)) return "Ya tienes el máximo de unidades.";
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
    if (u.tam === 2 && HEROES[u.heroe].modoAgua === "fondo" && celdasDe(u).some(q => est.casillas[q.y][q.x].t === "agua")) return "Bajo el agua no puede atacar.";
    if (t.tam === 2 && HEROES[t.heroe].modoAgua === "fondo" && celdasDe(t).some(q => est.casillas[q.y][q.x].t === "agua")) return "Está bajo el agua: no se le alcanza.";
    if (u.atacado) return "Ya atacó este turno.";
    if (CLASES[u.clase].sanador) return "Los sanadores no atacan.";
    if (enTregua(est) && t.dueno >= 0 && u.dueno >= 0) return `Hay tregua hasta el turno ${est.tregua}.`;
    const d = dist(u, t);
    if (d < 1 || d > ef(est, u).alc) return "Está fuera de alcance.";
    if ((polvoraFac(est, u) || CLASES[u.clase].pesado) && !u.quieto) return "No puede moverse y disparar en el mismo turno.";
    const ra = razonAgua(est, u, t);
    if (ra) return ra;
    if (oculta(est, t, u.dueno)) return "La noche lo oculta: no se le ve hasta tener a alguien a su lado.";
    const dsf = desafioDe(est, u) || desafioDe(est, t);
    if (dsf && !((dsf.a === u.uid && dsf.b === t.uid) || (dsf.b === u.uid && dsf.a === t.uid))) return "Hay un desafío en marcha: esos dos solo pelean entre ellos.";
    if (d > 1 && t.dueno >= 0 && !t.heroe && heroeCerca(est, t, "velo")) return "Está bajo el velo de su Don: hay que atacarlo de cerca.";
    return null;
  }

  /* Qué le falta a un bando para invocar a un héroe. lista: cada requisito con su marca. */
  /* Los héroes son de guerras largas: turno mínimo según el tamaño del mapa */
  const turnoHeroe = est => (D.TURNO_HEROE[est.tamano] || D.TURNO_HEROE.normal) + ((est.mapaPara || 2) > 4 ? 2 : 0);
  function requisitosHeroe(est, j, heroeId, ciudadId) {
    const jug = est.jugadores[j];
    const h = HEROES[heroeId];
    const lista = [];
    if (!h || !jug.heroes.some(x => x.id === heroeId)) return { ok: false, razon: "Tu ejército no puede invocar a ese héroe.", lista };
    (h.req || []).forEach(r => {
      if (r.t === "fortaleza") lista.push({ texto: "Tener una fortaleza", ok: est.fortalezasDueno.some(d => d === j) });
      else if (r.t === "edificio") lista.push({ texto: `Tener ${EDIFICIOS[r.id].nombre}`, ok: tieneEdificio(est, j, r.id) });
      else if (r.t === "saber") { const n = SB.dominados(jug.tech); lista.push({ texto: `Dominar ${r.n} escalones del saber`, ok: n >= r.n, lleva: Math.min(n, r.n), de: r.n }); }
      else if (r.t === "cuenta") lista.push({ texto: r.texto, ok: (jug.cuenta[r.k] || 0) >= r.n, lleva: Math.min(r.n, jug.cuenta[r.k] || 0), de: r.n });
      else if (r.t === "ciudades") { const n = ciudadesDe(est, j).length; lista.push({ texto: `Controlar ${r.n} ciudades`, ok: n >= r.n, lleva: Math.min(n, r.n), de: r.n }); }
      else if (r.t === "regiones") { const n = est.regiones.filter(x => x.dueno === j).length; lista.push({ texto: `Controlar ${r.n} regiones`, ok: n >= r.n, lleva: Math.min(n, r.n), de: r.n }); }
      else if (r.t === "turno") lista.push({ texto: `Llegar al turno ${r.n}`, ok: est.turno >= r.n, lleva: Math.min(est.turno, r.n), de: r.n });
      else if (r.t === "muertos") { const n = est.stats.bajas.reduce((a, b) => a + b, 0); lista.push({ texto: `Que hayan caído ${r.n} soldados en esta guerra, de cualquier bando`, ok: n >= r.n, lleva: Math.min(n, r.n), de: r.n }); }
      else if (r.t === "matados") { const n = est.stats.muertes[j] || 0; lista.push({ texto: `Matar a ${r.n} enemigos`, ok: n >= r.n, lleva: Math.min(n, r.n), de: r.n }); }
      else if (r.t === "oficiales") { const n = est.stats.oficiales[j] || 0; lista.push({ texto: `Matar a ${r.n} oficiales enemigos (líderes, capitanes o veteranos)`, ok: n >= r.n, lleva: Math.min(n, r.n), de: r.n }); }
      else if (r.t === "mercado") lista.push({ texto: "Controlar el Mercado de las Sombras", ok: Object.values(est.ciudades).some(c => c.mercado && c.dueno === j) });
      else if (r.t === "consagradas") { const n = consagradasDe(est, j); lista.push({ texto: `Tener ${r.n} casillas consagradas`, ok: n >= r.n, lleva: Math.min(n, r.n), de: r.n }); }
    });
    lista.push({ texto: "Ganar renombre (bajas de oficiales, ciudades, duelos)", ok: (jug.renombre || 0) >= D.RENOMBRE_HEROE, lleva: Math.min(D.RENOMBRE_HEROE, jug.renombre || 0), de: D.RENOMBRE_HEROE });
    const tMin = turnoHeroe(est);
    lista.push({ texto: `Llegar al turno ${tMin}`, ok: est.turno >= tMin, lleva: Math.min(est.turno, tMin), de: tMin });
    lista.push({ texto: `Pagar ${Object.keys(h.coste).map(k => `${h.coste[k]} de ${D.RECURSO_NOMBRE[k].toLowerCase()}`).join(", ")}`, ok: puedePagar(jug, h.coste), coste: true });
    let razon = null;
    if (jug.heroeInvocado) razon = "Ya invocaste a tu héroe en esta guerra.";
    else if (est.activo !== j) razon = "No es tu turno.";
    else if (lista.some(r => !r.ok)) razon = `Falta: ${lista.find(r => !r.ok).texto.toLowerCase()}.`;
    else if (!hayHueco(est, j)) razon = "Ya tienes el máximo de unidades.";
    else if (ciudadId !== undefined) {
      const ciudad = est.ciudades[ciudadId];
      if (!ciudad || ciudad.dueno !== j) razon = "Esa ciudad no es tuya.";
      else if (h.tam === 2 ? !huecoGrande(est, ciudad, j) : !casillaLibreCerca(est, ciudad, j)) razon = h.tam === 2 ? "Hace falta un hueco libre de 2×2 casillas junto a la ciudad." : "No hay sitio libre junto a la ciudad.";
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
    if ((id === "establo" || id === "aviario") && !D.textoEdificio(id, jug.faccion).startsWith("Permite")) return "Tu ejército no tiene tropas que salgan de aquí.";
    if (ed.nivelCiudad && ciudad.nivel < ed.nivelCiudad) return `La ciudad tiene que estar en el nivel ${ed.nivelCiudad}.`;
    if (ed.escalon && !Object.keys(jug.tech).some(k => !SB.cruce(jug.faccion, k) && (jug.tech[k] || 0) >= ed.escalon)) return `Hace falta un escalón ${["I", "II", "III", "IV", "V", "VI"][ed.escalon - 1]} en alguna rama del saber.`;
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
    const c = SB.costeDe(jug.faccion, escuela, jug.tech[escuela] || 0);
    let m = (fac.mods.investigarMana || 1);
    if (jug.liderMuerto && fac.lider.estado && fac.lider.estado.investigarMana) m *= fac.lider.estado.investigarMana;
    if (c.mana) {
      c.mana = Math.max(1, Math.round(c.mana * m));
      if (tieneEdificio(est, j, "biblioteca")) c.mana = Math.max(1, c.mana - 2);
      c.mana = Math.max(1, c.mana - ((jug.sabEf || VACIO).investigar || 0));
    }
    return c;
  }

  function razonNoInvestigar(est, j, escuela) {
    const jug = est.jugadores[j];
    if (est.activo !== j) return "No es tu turno.";
    const cz = SB.cruce(jug.faccion, escuela);
    if (cz) { const f = SB.faltaCruce(jug.faccion, jug.tech, escuela); if (f) return f; }
    else {
      const r = SB.rama(jug.faccion, escuela);
      if (!r) return "Esa rama no es de tu ejército.";
      if ((jug.tech[escuela] || 0) >= r.escalones.length) return "Ya dominas toda la rama.";
    }
    if (!puedePagar(jug, costeInvestigar(est, j, escuela))) return "No te alcanzan los recursos.";
    return null;
  }

  /* --- Fin de turno --- */
  function terminarTurno(est) {
    const j = est.activo;
    const jug = est.jugadores[j];
    // Postura (Seosan): quien no se movió en su turno queda en guardia hasta el siguiente
    if (FACCIONES[jug.faccion].mods.postura) unidadesDe(est, j).forEach(u => { if (!(u.recorrido > 0) && !esBarco(u)) u.efectos.postura = true; else delete u.efectos.postura; });
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
    dist, minoriaBerserker, fortalezasDe, cobrarRescate, razonTrampa, razonTunel, razonMarcar, razonContrato, precioContrato, marcadaPara, trampaEn, tunelEn, enTerritorio,
    COSTE_TRAMPA, MAX_TRAMPAS, CLASES_TRAMPA, COSTE_TUNEL, MAX_TUNELES, LARGO_TUNEL, ALCANCE_MARCA, CD_MARCA, razonCampamento, razonReclutarCampamento, campamentoEn, COSTE_CAMPAMENTO, CLASES_CAMPAMENTO, MAX_CAMPAMENTOS, DURA_CAMPAMENTO,
    MAX_UNIDADES, rn, ri, clave, dentro, casilla, unidadEn, unidadesDe, ciudadEn, ciudadesDe, esMonstruo, nombreUnidad, regionDeCasilla, reg, crono,
    ef, auras, calcularDano, defensaDelTerreno, alcanzables, camino, aplicar, crearGuerra, puntuacion, ingresoDe, mantenimiento,
    costeReclutar, clasesDisponibles, razonNoReclutar, razonNoConstruir, razonNoInvestigar, costeInvestigar, puedePagar, tieneEdificio, vecinosEnemigos, vecinosAliados,
    veCasilla, actualizarVision, reliquiaNueva, nuevaUnidad, casillaLibreCerca, terminarTurno, bonoReliquias, generarContingenteIA, terminarGuerra, matar, terrenoCerca,
    mismoEquipo, hostil, vivos, rivalesDe, equipoDe, heroeDe, heroeVivo, usaPolvora, enTregua, ganoJugador, requisitosHeroe, razonNoAtacar, consagradaPara, consagradasDe, comeUnidad, eliminar, RASGO_NOMBRE,
    equipoFijo, hayPacto, pactoDe, razonNoPacto, razonNoTraicion, desertoresDe, navalDe, esBarco, enAgua, embarcada, puedeEmbarcar, oculta, veUnidad, razonAgua, esDuelo,
    costeEdificio, aguaCerca, aguaLibreCerca, polvoraFac, firma, rendir,
    ocupa, celdasDe, huecoGrande, heroeCerca, desafioDe, turnoHeroe, lineaCruzada, razonNoPortal, costePortal, ciudadPortalDe, transmutado, aguasLibres, limiteTropas, cuentaTropas, hayHueco, sab, tiposDe, quienDesbloquea, costeAcoger, odiaA, capturarCiudad, rehacerSaber, sellarPacto
  };
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.FracturaMotor;
})(typeof window !== "undefined" ? window : globalThis);
