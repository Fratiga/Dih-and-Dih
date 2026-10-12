/* =============================================================================
   LA FRACTURA: campaña. Lo que dura entre guerras: el ejército de una cuenta con sus soldados,
   casas, reliquias, némesis e historia. Aquí se prepara cada guerra (contingente, rival, mapa) y
   se cierra (experiencia, rangos, muertes, herencias, hijos, relaciones, luto, apodos y crónica).
   Todo es JSON simple para guardarlo en el navegador o en el servidor.
   Se usa igual en el navegador y en Node.
============================================================================= */
(function (raiz) {
  const D = raiz.FRACTURA_DATOS || (typeof require !== "undefined" ? require("./fractura-datos.js") : null);
  const S = raiz.FracturaSoldados || (typeof require !== "undefined" ? require("./fractura-soldados.js") : null);
  const FM = raiz.FracturaMotor || (typeof require !== "undefined" ? require("./fractura-motor.js") : null);
  const { CLASES, RANGOS, FACCIONES, TIPOS_FRACTURA, RELIQUIAS, DIFICULTADES } = D;

  const MAX_SOLDADOS = 80;
  const MAX_CAPITANES = 3;
  const MAX_HISTORIA = 40;
  const EDAD_ALISTARSE = 16;

  const rn = ej => { const o = { s: ej.rs }; const v = S.rnd(o); ej.rs = o.s; return v; };
  const ri = (ej, n) => Math.floor(rn(ej) * n);
  const hito = (s, anio, texto) => { s.hitos.push({ anio, texto }); if (s.hitos.length > 60) s.hitos.splice(0, s.hitos.length - 60); };
  const clon = o => JSON.parse(JSON.stringify(o));

  /* --- Crear el ejército --- */
  function crearEjercito(faccionId, nombre, semilla) {
    const fac = FACCIONES[faccionId];
    const ej = {
      v: 1, faccion: faccionId, nombre: nombre || `Ejército de ${fac.corto}`, rs: (semilla >>> 0) || ((Date.now() & 0x7fffffff) | 1), anio: 1,
      guerras: 0, ganadas: 0, perdidas: 0, empatadas: 0, soldados: {}, reliquias: {}, nemesis: [], historia: [], victoriasContra: {},
      config: { tipo: "reinos", dificultad: "normal" }, logros: {}
    };
    const base = ["guerrero", "guerrero", "cazador", "cazador", "picaro", "paladin"];
    if (faccionId === "academia-arcana-de-dolbred") { base[4] = "arcanista"; base[5] = "arcanista"; }
    if (faccionId === "trono-de-ceniza") { base[5] = "esqueleto"; base[4] = "esqueleto"; }
    if (faccionId === "peregrinos-del-alba") { base[4] = "sanador"; }
    if (faccionId === "hijos-del-acero") { base[4] = "ballestero"; base[5] = "ballestero"; }
    if (faccionId === "caballeros-del-reino") { base[5] = "caballero"; }
    if (faccionId === "compania-dorada") { base[4] = "mercenario"; base[5] = "mercenario"; }
    const r = { s: ej.rs };
    const casas = [S.casaNueva(r, fac.cultura), S.casaNueva(r, fac.cultura), S.casaNueva(r, fac.cultura)];
    const usados = new Set();
    base.forEach((clase, i) => {
      let s;
      for (let intento = 0; intento < 20; intento++) {
        s = S.crearSoldado(r, { clase, cultura: fac.cultura, origen: fac.origenes[i % fac.origenes.length], anio: 1, edad: 19 + (i * 3) % 9, casa: i < 4 ? casas[i % 3] : undefined });
        if (!usados.has(S.nombreCompleto(s))) break;
      }
      usados.add(S.nombreCompleto(s));
      hito(s, 1, "Se une a la compañía fundadora.");
      ej.soldados[s.id] = s;
    });
    ej.rs = r.s;
    return ej;
  }

  /* --- Consultas --- */
  const todos = ej => Object.values(ej.soldados);
  const vivos = ej => todos(ej).filter(s => s.estado === "activo" || s.estado === "establecido");
  const enFila = ej => todos(ej).filter(s => s.estado === "activo" || s.estado === "establecido");
  const convaleciente = (ej, s) => !!(s.herida && s.herida.hasta >= ej.guerras);
  const disponibles = ej => enFila(ej).filter(s => !convaleciente(ej, s));
  const caidos = ej => todos(ej).filter(s => s.estado === "caido").sort((a, b) => (b.muerte ? b.muerte.anio : 0) - (a.muerte ? a.muerte.anio : 0));
  const retirados = ej => todos(ej).filter(s => s.estado === "retirado");
  const ninos = ej => todos(ej).filter(s => s.estado === "nino");
  const capitanes = ej => enFila(ej).filter(s => s.capitan);
  const limiteContingente = ej => 6 + Math.min(6, Math.floor(ej.ganadas / 3));

  /* Casas: agrupa a todos los soldados por apellido */
  function casas(ej) {
    const mapa = {};
    todos(ej).forEach(s => {
      const c = mapa[s.casa] = mapa[s.casa] || { casa: s.casa, miembros: [], desde: s.nacimiento, victorias: 0, caidos: 0 };
      c.miembros.push(s);
      c.desde = Math.min(c.desde, s.nacimiento);
      c.victorias += s.victorias;
      if (s.estado === "caido") c.caidos++;
    });
    return Object.values(mapa).sort((a, b) => b.miembros.length - a.miembros.length || b.victorias - a.victorias).map(c => {
      c.generaciones = generaciones(ej, c.miembros);
      c.anios = ej.anio - c.desde;
      return c;
    });
  }
  function generaciones(ej, miembros) {
    let max = 1;
    const prof = s => { let n = 1, p = s; const vistos = new Set(); while (p && p.padre && ej.soldados[p.padre] && !vistos.has(p.id)) { vistos.add(p.id); p = ej.soldados[p.padre]; n++; } return n; };
    miembros.forEach(s => { max = Math.max(max, prof(s)); });
    return max;
  }

  const reliquiasDe = ej => Object.values(ej.reliquias);
  function reliquiasLibres(ej) {
    const llevadas = new Set();
    todos(ej).forEach(s => { if (s.estado !== "caido") Object.values(s.equipo || {}).forEach(id => llevadas.add(id)); });
    return reliquiasDe(ej).filter(r => r.estado !== "perdida" && !llevadas.has(r.id));
  }

  /* --- Gestión: capitanes, compañías y reliquias (lo que hace el jugador entre guerras) --- */
  function nombrarCapitan(ej, id, compania) {
    const s = ej.soldados[id];
    if (!s || !enFila(ej).includes(s)) return "Ese soldado no está en filas.";
    if (S.rangoIndice(s.victorias) < 1) return "Hay que ser al menos soldado para mandar una compañía.";
    if (capitanes(ej).filter(c => c.id !== id).some(c => c.compania === compania)) return "Esa compañía ya tiene capitán.";
    if (!s.capitan && capitanes(ej).length >= MAX_CAPITANES) return `Solo puedes nombrar ${MAX_CAPITANES} capitanes.`;
    s.capitan = true; s.compania = compania;
    if (!s.apodo) s.apodo = null;
    hito(s, ej.anio, `Nombrado capitán de la ${["", "I", "II", "III"][compania]} compañía.`);
    return null;
  }
  function quitarCapitan(ej, id) {
    const s = ej.soldados[id];
    if (!s || !s.capitan) return;
    s.capitan = false;
    hito(s, ej.anio, "Deja el mando de su compañía.");
    todos(ej).forEach(o => { if (o.compania === s.compania && o.id !== id) o.compania = null; });
    s.compania = null;
  }
  function asignarCompania(ej, id, compania) {
    const s = ej.soldados[id];
    if (!s || s.capitan) return "Ese soldado es capitán.";
    if (compania && !capitanes(ej).some(c => c.compania === compania)) return "Esa compañía no tiene capitán.";
    if (compania && enFila(ej).filter(o => o.compania === compania && !o.capitan).length >= 4 && s.compania !== compania) return "La compañía está completa (capitán y cuatro soldados).";
    s.compania = compania || null;
    return null;
  }
  function equipar(ej, soldadoId, reliquiaId) {
    const s = ej.soldados[soldadoId], rel = ej.reliquias[reliquiaId];
    if (!s || !rel || rel.estado === "perdida") return "No se puede.";
    if (rel.slot === "estandarte" && !s.capitan) return "Solo un capitán lleva estandarte.";
    // Quitársela a quien la lleva
    todos(ej).forEach(o => { Object.keys(o.equipo || {}).forEach(k => { if (o.equipo[k] === reliquiaId) delete o.equipo[k]; }); });
    const previa = s.equipo[rel.slot];
    s.equipo[rel.slot] = reliquiaId;
    const ult = rel.propietarios[rel.propietarios.length - 1];
    const heredada = ult && ult.sId && s.padre === ult.sId;
    rel.propietarios.push({ nombre: S.nombreCompleto(s), sId: s.id, desde: ej.anio, heredada: !!heredada });
    hito(s, ej.anio, heredada ? `Recibe ${rel.nombre}, la que llevaba su ${s.sexo === "f" ? "padre" : "padre"}.` : `Recibe ${rel.nombre}.`);
    void previa;
    return null;
  }
  function desequipar(ej, soldadoId, slot) {
    const s = ej.soldados[soldadoId];
    if (s && s.equipo && s.equipo[slot]) delete s.equipo[slot];
  }
  function renombrarEjercito(ej, nombre) { ej.nombre = String(nombre).trim().slice(0, 40) || ej.nombre; }

  /* --- Preparar una guerra --- */
  function elegirContingenteAuto(ej) {
    const lim = limiteContingente(ej);
    const lista = disponibles(ej).slice().sort((a, b) => {
      const pa = (a.capitan ? 100 : 0) + a.victorias + S.rangoIndice(a.victorias) * 5;
      const pb = (b.capitan ? 100 : 0) + b.victorias + S.rangoIndice(b.victorias) * 5;
      return pb - pa;
    });
    // Variedad: no más de la mitad de la misma clase
    const out = [], cuenta = {};
    lista.forEach(s => { if (out.length < lim && (cuenta[s.clase] || 0) < Math.ceil(lim / 2)) { out.push(s.id); cuenta[s.clase] = (cuenta[s.clase] || 0) + 1; } });
    lista.forEach(s => { if (out.length < lim && !out.includes(s.id)) out.push(s.id); });
    return out;
  }

  function rivalElegido(ej, preferida) {
    if (preferida && FACCIONES[preferida] && preferida !== ej.faccion) return preferida;
    const otras = Object.keys(FACCIONES).filter(f => f !== ej.faccion);
    // Prefiere facciones contra las que aún no se ganó
    const nuevas = otras.filter(f => !(ej.victoriasContra[f] > 0));
    const pool = nuevas.length && rn(ej) < 0.6 ? nuevas : otras;
    return pool[ri(ej, pool.length)];
  }

  const elegirOrigen = (fac, r) => fac.origenes[S.ent(r, fac.origenes.length)];

  /* El bando de este ejército para una guerra entre jugadores: soldados clonados y las reliquias que llevan */
  function prepararBando(ej, ids) {
    const lim = limiteContingente(ej);
    const elegidos = (ids && ids.length ? ids : elegirContingenteAuto(ej)).slice(0, lim).map(id => ej.soldados[id]).filter(s => s && disponibles(ej).includes(s));
    const soldados = elegidos.map(s => { const c = clon(s); c.victoriasAntes = s.victorias; return c; });
    const fac = FACCIONES[ej.faccion];
    const r = { s: ej.rs };
    const mezcla = ["guerrero", "cazador", "guerrero", "cazador", "picaro", "paladin"];
    for (let i = soldados.length; i < 6; i++) {
      let clase = mezcla[i % mezcla.length];
      if (CLASES[clase].exclusiva && CLASES[clase].exclusiva !== ej.faccion) clase = "guerrero";
      const s = S.crearSoldado(r, { clase, cultura: fac.cultura, origen: elegirOrigen(fac, r), anio: ej.anio });
      s.victoriasAntes = 0; s.reemplazo = true;
      soldados.push(s);
    }
    ej.rs = r.s;
    const reliquias = [];
    const vistas = new Set();
    soldados.forEach(s => Object.values(s.equipo || {}).forEach(id => { if (ej.reliquias[id] && !vistas.has(id)) { vistas.add(id); reliquias.push(clon(ej.reliquias[id])); } }));
    return { nombre: ej.nombre, faccion: ej.faccion, humano: true, soldados, reliquias, ejercito: true };
  }

  function prepararGuerra(ej, ids, opciones) {
    opciones = opciones || {};
    const dif = opciones.dificultad || ej.config.dificultad || "normal";
    const tipo = TIPOS_FRACTURA[opciones.tipo] ? opciones.tipo : (opciones.tipo === "azar" || !opciones.tipo ? Object.keys(TIPOS_FRACTURA)[ri(ej, 5)] : "reinos");
    const rival = rivalElegido(ej, opciones.rival);
    const elegidos = (ids && ids.length ? ids : elegirContingenteAuto(ej)).slice(0, limiteContingente(ej)).map(id => ej.soldados[id]).filter(s => s && disponibles(ej).includes(s));
    const soldados = elegidos.map(s => { const c = clon(s); c.victoriasAntes = s.victorias; return c; });
    // Si faltan soldados, la compañía recibe reclutas para llegar a seis
    const falta = 6 - soldados.length;
    if (falta > 0) {
      const fac = FACCIONES[ej.faccion];
      const r = { s: ej.rs };
      const mezcla = ["guerrero", "cazador", "guerrero", "cazador", "picaro", "paladin"];
      if (ej.faccion === "trono-de-ceniza") mezcla.splice(4, 2, "esqueleto", "esqueleto");
      for (let i = 0; i < falta; i++) {
        let clase = mezcla[(soldados.length + i) % mezcla.length];
        if (CLASES[clase].exclusiva && CLASES[clase].exclusiva !== ej.faccion) clase = "guerrero";
        const s = S.crearSoldado(r, { clase, cultura: fac.cultura, origen: elegirOrigen(fac, r), anio: ej.anio });
        s.victoriasAntes = 0; s.reemplazo = true;
        soldados.push(s);
      }
      ej.rs = r.s;
    }
    const reliquias = [];
    const vistas = new Set();
    soldados.forEach(s => Object.values(s.equipo || {}).forEach(id => { if (ej.reliquias[id] && !vistas.has(id)) { vistas.add(id); reliquias.push(clon(ej.reliquias[id])); } }));
    const semilla = (Math.floor(rn(ej) * 2147483646) + 1);
    // Un némesis puede volver como capitán del rival
    // El rival crece con tu ejército: más tropas y más curtidas cuanto más has ganado
    const prom = soldados.reduce((a, s) => a + s.victorias, 0) / Math.max(1, soldados.length);
    const jugRival = { nombre: `Fuerzas de ${FACCIONES[rival].corto}`, faccion: rival, humano: false, nivelIA: dif, escala: prom, extraTropas: Math.min(4, Math.floor(ej.ganadas / 4)) };
    const nem = ej.nemesis.filter(n => n.faccion === rival || rn(ej) < 0.35);
    if (nem.length) {
      const n = nem[ri(ej, nem.length)];
      const r = { s: semilla };
      const s = S.crearSoldado(r, { clase: n.clase, cultura: FACCIONES[n.faccion].cultura, origen: "voluntario", anio: ej.anio, edad: 30 });
      s.nombre = n.nombre; s.casa = n.casa; s.apodo = n.apodo; s.victorias = n.victorias; s.capitan = true; s.compania = 1; s.nemesisId = n.id; s.sexo = n.sexo || s.sexo;
      s.stats.CON = Math.min(10, s.stats.CON + 1); s.stats.FUE = Math.min(10, s.stats.FUE + 1);
      jugRival.soldados = [s];
      jugRival.nemesis = n.id;
    }
    return { semilla, tipo, dificultad: dif, anio: ej.anio, maxTurnos: 35, hold: 6,
      jugadores: [{ nombre: ej.nombre, faccion: ej.faccion, humano: true, soldados, reliquias, ejercito: true }, jugRival], rivalFaccion: rival, ids: elegidos.map(s => s.id) };
  }

  /* --- Cerrar una guerra --- */
  const NOMBRE_RANGO = i => RANGOS[i].nombre;

  function apodoSiProcede(ej, s, r, ctx) {
    if (s.apodo) return;
    if ((s.cicatrices || 0) >= 1 && rn(ej) < 0.7) s.apodo = S.apodoPara(r, s, "cicatriz");
    else if (ctx && ctx.bajasG >= 4) s.apodo = S.apodoPara(r, s, "matador");
    else if (S.rangoIndice(s.victorias) >= 2 && s.stats.VEL >= 8) s.apodo = S.apodoPara(r, s, "veloz");
    else if (S.rangoIndice(s.victorias) >= 2 && s.stats.INT >= 8) s.apodo = S.apodoPara(r, s, "sabio");
    else if (S.rangoIndice(s.victorias) >= 2 && s.stats.CON >= 8) s.apodo = S.apodoPara(r, s, "firme");
    else if (S.rangoIndice(s.victorias) >= 3 && rn(ej) < 0.5) s.apodo = S.apodoPara(r, s, "longevo");
    if (s.apodo) hito(s, ej.anio, `Empiezan a llamarlo ${s.apodo}.`);
  }

  function cerrarGuerra(ej, est, cfg, jIdx) {
    jIdx = jIdx || 0;
    const rr = { s: ej.rs };
    const jug = est.jugadores[jIdx];
    const gano = est.ganador === jIdx, perdio = est.ganador === 1 - jIdx, empate = est.ganador === "empate";
    const rivalFaccion = est.jugadores[1 - jIdx].faccion;
    const resumen = { levasPerdidas: 0, heridos: [], gano, perdio, empate, ascensos: [], muertos: [], nacimientos: [], alistados: [], retirados: [], renacidos: [], reliquiasPerdidas: [], reliquiasHalladas: [], luto: [], nemesisNuevo: [], nemesisCaido: [], vejez: [], sinFamilia: [], ganancias: [] };
    const anioGuerra = ej.anio;
    ej.guerras += 1;
    if (gano) { ej.ganadas += 1; ej.victoriasContra[rivalFaccion] = (ej.victoriasContra[rivalFaccion] || 0) + 1; } else if (perdio) ej.perdidas += 1; else ej.empatadas += 1;

    // Participantes: los que quedan en pie y los que cayeron
    const unidadesVivas = Object.values(est.unidades).filter(u => u.dueno === jIdx && u.s);
    const caidosGuerra = (est.caidos || []).filter(c => c.dueno === jIdx);
    const participantes = [];
    const rangoAntes = {};
    // De los reclutas que se hicieron durante la guerra solo se quedan los cinco que más destacaron
    const admitidos = new Set(unidadesVivas.filter(u => !u.lider && !ej.soldados[u.s.id]).sort((a, b) => (b.vicG || 0) - (a.vicG || 0)).slice(0, 5).map(u => u.s.id));
    const actualizar = (sNuevo, vicG, bajasG, esCaido) => {
      let s = ej.soldados[sNuevo.id];
      const nuevoEnCampana = !s;
      if (nuevoEnCampana && (esCaido || !admitidos.has(sNuevo.id))) { resumen.levasPerdidas += 1; return null; }
      if (nuevoEnCampana) {
        s = clon(sNuevo);
        s.ingreso = anioGuerra;
        hito(s, anioGuerra, "Se alista durante la guerra.");
        ej.soldados[s.id] = s;
        resumen.alistados.push(s);
      } else {
        // Se copian los datos que cambian en la guerra
        s.equipo = clon(sNuevo.equipo || {});
        s.cicatrices = sNuevo.cicatrices || 0;
        s.oficiales = sNuevo.oficiales || 0;
        s.reanimado = sNuevo.reanimado || false;
      }
      rangoAntes[s.id] = nuevoEnCampana ? 0 : S.rangoIndice(s.victorias);
      s.victorias += vicG;
      s.bajas += bajasG;
      s.guerras += 1;
      if (gano) s.ganadas += 1;
      participantes.push({ s, vicG, bajasG, esCaido });
      return s;
    };
    unidadesVivas.forEach(u => { if (!u.lider) actualizar(u.s, u.vicG || 0, u.bajasG || 0, false); });
    caidosGuerra.forEach(c => { const s = actualizar(c.s, c.vicG || 0, 0, true); if (s) { s.muerte = c.s.muerte; c._s = s; } });

    // Caídos: a veces quedan gravemente heridos en vez de morir; después, la inmortalidad
    caidosGuerra.forEach(c => {
      const s = c._s;
      if (!s || s.estado === "caido" || s.estado === "renaciente") return;
      const pHerida = Math.min(0.65, 0.28 + 0.03 * s.stats.VOL + 0.02 * s.stats.CON);
      if (rn(ej) < pHerida) {
        s.herida = { hasta: ej.guerras + 2 };
        s.cicatrices = (s.cicatrices || 0) + 1;
        s.muerte = null;
        hito(s, anioGuerra, `Cae en ${c.region} y lo dan por muerto, pero sobrevive con heridas graves.`);
        resumen.heridos.push(s);
        c._herido = true;
        return;
      }
      s.estado = "caido";
      const killer = c.por;
      s.muerte = Object.assign({}, s.muerte, { anio: anioGuerra, guerra: ej.guerras, causa: killer ? killer.nombre : "la Fractura", rivalFaccion });
      hito(s, anioGuerra, `Muere en ${c.region}${killer ? ` a manos de ${killer.nombre}` : ""}.`);
      resumen.muertos.push(s);
      if (jug.tech.tanato >= 4 && rn(ej) < 0.5) {
        s.estado = "activo"; s.muerte = null; s.renacido = (s.renacido || 0) + 1; s.cicatrices = (s.cicatrices || 0) + 1;
        s.nacimiento += 2;   // vuelve distinto
        hito(s, anioGuerra, "Regresa como Renaciente.");
        resumen.muertos.splice(resumen.muertos.indexOf(s), 1);
        resumen.renacidos.push(s);
      }
    });

    // Reliquias: las que llevaban los vivos, las del reliquiario de la guerra y las que se quedaron en el suelo
    const idsEnGuerra = new Set(Object.keys(est.reliquias));
    idsEnGuerra.forEach(id => {
      const inst = est.reliquias[id];
      const eraMia = !!ej.reliquias[id];
      let ubicacion = null;     // "viva" (la lleva un soldado), "mochila", "suelo", "cae"
      if (unidadesVivas.some(u => u.s && Object.values(u.s.equipo || {}).includes(id))) ubicacion = "viva";
      else if (jug.mochila.includes(id)) ubicacion = "mochila";
      else if (est.casillas.some(f => f.some(c => c.objetos.includes(id)))) ubicacion = "suelo";
      else if (est.jugadores[1 - jIdx].mochila.includes(id) || Object.values(est.unidades).some(u => u.dueno === 1 - jIdx && u.s && Object.values(u.s.equipo || {}).includes(id))) ubicacion = "enemigo";
      if (!eraMia && !["viva", "mochila"].includes(ubicacion)) return;
      if (ubicacion === "enemigo" && !eraMia) return;
      const registro = ej.reliquias[id] || (ej.reliquias[id] = Object.assign({ estado: "activa" }, clon(inst)));
      registro.propietarios = clon(inst.propietarios);
      if (ubicacion === "enemigo") { registro.estado = "perdida"; resumen.reliquiasPerdidas.push(registro); return; }
      if (ubicacion === "suelo") {
        if (gano || (empate && rn(ej) < 0.5)) { registro.estado = "activa"; }
        else if (rn(ej) < 0.5) { registro.estado = "perdida"; resumen.reliquiasPerdidas.push(registro); return; }
      }
      if (!eraMia) resumen.reliquiasHalladas.push(registro);
      // Las de los soldados caídos quedan sin dueño en el reliquiario
      todos(ej).forEach(o => { if (o.estado === "caido") Object.keys(o.equipo || {}).forEach(k => { if (o.equipo[k] === id) delete o.equipo[k]; }); });
    });
    // Los caídos y los heridos graves ya no llevan nada: lo suyo queda en el reliquiario
    caidosGuerra.forEach(c => { if (c._s) c._s.equipo = {}; });

    // Compañeros de armas: cada par que luchó junto suma una guerra
    for (let i = 0; i < participantes.length; i++) for (let k = i + 1; k < participantes.length; k++) {
      const a = participantes[i].s, b = participantes[k].s;
      a.companeros[b.id] = (a.companeros[b.id] || 0) + 1;
      b.companeros[a.id] = (b.companeros[a.id] || 0) + 1;
    }
    // Luto: quienes más combatieron junto a un caído
    resumen.muertos.forEach(m => {
      const amigos = participantes.filter(p => !p.esCaido && p.s.estado !== "caido" && (p.s.companeros[m.id] || 0) >= 3).sort((a, b) => (b.s.companeros[m.id] || 0) - (a.s.companeros[m.id] || 0)).slice(0, 2);
      amigos.forEach(p => {
        p.s.luto = { por: m.id, nombre: S.nombreCompleto(m), restantes: 3 };
        hito(p.s, anioGuerra, `Llora a ${S.nombreCompleto(m)}, con quien combatió ${p.s.companeros[m.id]} veces.`);
        resumen.luto.push({ quien: p.s, por: m });
      });
    });
    todos(ej).forEach(s => {
      if (s.luto && !resumen.luto.some(l => l.quien === s)) { s.luto.restantes -= 1; if (s.luto.restantes <= 0) s.luto = null; }
    });

    // Rangos, ascensos y apodos
    participantes.forEach(p => {
      const s = p.s;
      if (p.esCaido && s.estado === "caido") return;
      const nuevo = S.rangoIndice(s.victorias);
      if (nuevo > (rangoAntes[s.id] || 0)) {
        hito(s, anioGuerra, `Asciende a ${NOMBRE_RANGO(nuevo)} con ${s.victorias} victorias.`);
        resumen.ascensos.push({ s, rango: NOMBRE_RANGO(nuevo) });
      }
      if (nuevo >= 2 && !s.spec) s.ascensoPendiente = true;
      apodoSiProcede(ej, s, rr, { bajasG: p.bajasG });
      if (gano && s.stats.INT >= 8 && !p.esCaido) s.victorias += 1;   // los estudiosos aprenden de lo que viven
    });

    // Némesis: quien mató a un veterano y sigue vivo vuelve la próxima vez; quien cae por tu mano desaparece
    caidosGuerra.forEach(c => {
      const s = c._s;
      if (est.pvp || !s || !c.por || c.por.dueno === jIdx || s.estado !== "caido") return;
      const sigue = c.por.uid && est.unidades[c.por.uid];
      if (!sigue || !c.por.sId) return;
      const asesino = est.unidades[c.por.uid].s;
      if (!asesino || S.rangoIndice(s.victorias) < 1) return;
      let n = ej.nemesis.find(x => x.nombre === asesino.nombre && x.casa === asesino.casa);
      if (!n) {
        n = { id: `n${ej.nemesis.length + 1}${asesino.id.slice(1, 4)}`, nombre: asesino.nombre, casa: asesino.casa, sexo: asesino.sexo, apodo: asesino.apodo, clase: asesino.clase, faccion: est.jugadores[1 - jIdx].faccion, victorias: asesino.victorias + (est.unidades[c.por.uid].vicG || 0), bajas: [] };
        ej.nemesis.push(n);
        resumen.nemesisNuevo.push(n);
      }
      n.bajas.push(s.id);
    });
    (est.caidos || []).filter(c => c.dueno === 1 - jIdx && c.s.nemesisId).forEach(c => {
      const i = ej.nemesis.findIndex(n => n.id === c.s.nemesisId);
      if (i >= 0) { resumen.nemesisCaido.push(ej.nemesis[i]); ej.nemesis.splice(i, 1); }
    });
    if (jug.tech.tanato >= 4) { /* los renacidos ya se contaron */ }

    // El tiempo pasa: 1 o 2 años por guerra
    const paso = 1 + (rn(ej) < 0.5 ? 1 : 0);
    ej.anio += paso;
    // Hijos, retiros y vejez
    procesarFamilia(ej, rr, resumen);
    ej.rs = rr.s;

    // Historia
    const logros = calcularLogros(ej, est, jIdx, resumen);
    const reg = { n: ej.guerras, anio: anioGuerra, resultado: gano ? "victoria" : perdio ? "derrota" : "empate", rival: rivalFaccion, tipo: est.tipo, turnos: est.turno, razon: est.razon,
      bajas: est.stats.bajas.slice(), muertos: resumen.muertos.map(s => S.nombreCompleto(s)), logros };
    ej.historia.push(reg);
    if (ej.historia.length > MAX_HISTORIA) ej.historia.splice(0, ej.historia.length - MAX_HISTORIA);
    resumen.registro = reg;
    resumen.logros = logros;
    return resumen;
  }

  function calcularLogros(ej, est, jIdx, resumen) {
    const l = [];
    const gano = est.ganador === jIdx;
    if (gano) l.push("victoria");
    if (gano && est.dificultad === "dificil") l.push("victoria_dificil");
    if (gano && est.razon && est.razon.includes("Núcleo")) l.push("nucleo");
    if (gano && est.razon && est.razon.includes("capital")) l.push("capital");
    if (gano && ej.victoriasContra[est.jugadores[1 - jIdx].faccion] === 1) l.push(`primera_victoria:${est.jugadores[1 - jIdx].faccion}`);
    if (resumen.ascensos.some(a => a.rango === "Leyenda")) l.push("leyenda");
    if (resumen.nemesisCaido.length) l.push("nemesis");
    if (casas(ej).some(c => c.generaciones >= 3)) l.push("tres_generaciones");
    if (resumen.reliquiasHalladas.length) l.push("reliquia");
    return l;
  }

  /* Hijos, establecimiento, retiro y vejez: se resuelve al cerrar cada guerra */
  function procesarFamilia(ej, rr, resumen) {
    // Los niños que ya tienen edad se alistan
    ninos(ej).forEach(n => {
      if (S.edadDe(n, ej.anio) >= EDAD_ALISTARSE) {
        n.estado = "activo"; n.ingreso = ej.anio;
        hito(n, ej.anio, `Se alista a los ${S.edadDe(n, ej.anio)} años.`);
        resumen.alistados.push(n);
      }
    });
    // Establecerse y tener descendencia
    enFila(ej).forEach(s => {
      if (s.estado === "caido" || s.hijos.length >= 3) return;
      const edad = S.edadDe(s, ej.anio);
      if (edad < 28 || s.victorias < 10 || S.aniosDeServicio(s, ej.anio) < 4) return;
      if (s.ultimoHijo && ej.anio - s.ultimoHijo < 5) return;
      if (rn(ej) > 0.3) return;
      const sinFamilia = todos(ej).filter(o => o.estado === "nino").length >= 6;
      if (sinFamilia) return;
      tenerHijo(ej, rr, s, resumen);
    });
    // Retiro y vejez
    enFila(ej).forEach(s => {
      const edad = S.edadDe(s, ej.anio);
      if (edad >= 66 && rn(ej) < 0.5) {
        s.estado = "caido"; s.muerte = { anio: ej.anio, guerra: ej.guerras, lugar: "su casa", causa: "la vejez", natural: true };
        hito(s, ej.anio, `Muere en paz a los ${edad} años.`);
        resumen.vejez.push(s);
      } else if (edad >= 52 && rn(ej) < 0.25) {
        s.estado = "retirado"; if (s.capitan) { s.capitan = false; s.compania = null; }
        hito(s, ej.anio, `Se retira del servicio a los ${edad} años.`);
        resumen.retirados.push(s);
      }
    });
    // El ejército tiene un tope: se retiran los más veteranos y viejos
    let activos = enFila(ej);
    while (activos.length > MAX_SOLDADOS) {
      const s = activos.slice().sort((a, b) => S.edadDe(b, ej.anio) - S.edadDe(a, ej.anio))[0];
      s.estado = "retirado"; hito(s, ej.anio, "Se retira para dejar sitio a los nuevos.");
      resumen.retirados.push(s);
      activos = enFila(ej);
    }
  }

  function tenerHijo(ej, rr, padre, resumen) {
    const fac = FACCIONES[ej.faccion];
    // Pareja: otro soldado que lleva tiempo a su lado, o alguien de fuera
    let pareja = null;
    const candidatos = enFila(ej).filter(o => o.id !== padre.id && !S.parentescoEntre(padre, o) && (padre.companeros[o.id] || 0) >= 4 && !o.pareja && o.estado !== "caido" && S.edadDe(o, ej.anio) >= 22);
    if (candidatos.length && rn(ej) < 0.4) pareja = candidatos[ri(ej, candidatos.length)];
    const sexo = rn(ej) < 0.5 ? "m" : "f";
    // Clase del hijo: la del padre la mitad de las veces
    const clases = Object.keys(CLASES).filter(c => !CLASES[c].noReclutable && (!CLASES[c].exclusiva || CLASES[c].exclusiva === ej.faccion) && c !== "eco");
    const clase = rn(ej) < 0.5 && !CLASES[padre.clase].noReclutable ? padre.clase : clases[ri(ej, clases.length)];
    const madreNombre = pareja ? null : S.nombreNuevo(rr, fac.cultura, padre.sexo === "f" ? "m" : "f");
    const hijo = S.crearSoldado(rr, { clase, cultura: fac.cultura, origen: padre.origen === "eco" || padre.origen === "criatura" ? padre.origen : "habitante", anio: ej.anio, edad: 0, sexo, casa: padre.casa, padre, nacimiento: ej.anio, madreId: pareja ? pareja.id : null, madreNombre });
    hijo.estado = "nino";
    hijo.ingreso = ej.anio + EDAD_ALISTARSE;
    hito(hijo, ej.anio, `Nace ${sexo === "f" ? "hija" : "hijo"} de ${S.nombreCompleto(padre)}${pareja ? ` y ${S.nombreCompleto(pareja)}` : ""}.`);
    ej.soldados[hijo.id] = hijo;
    padre.hijos.push(hijo.id);
    padre.ultimoHijo = ej.anio;
    if (padre.estado === "activo") { padre.estado = "establecido"; hito(padre, ej.anio, "Se establece y forma una familia."); }
    if (pareja) {
      padre.pareja = pareja.id; pareja.pareja = padre.id; pareja.hijos.push(hijo.id);
      if (pareja.estado === "activo") pareja.estado = "establecido";
      hito(pareja, ej.anio, `Tiene ${sexo === "f" ? "una hija" : "un hijo"} con ${S.nombreCompleto(padre)}.`);
    } else { padre.parejaNombre = madreNombre; }
    resumen.nacimientos.push({ hijo, padre, pareja });
  }

  /* Ascensos: el jugador elige la especialización de un veterano */
  function elegirEspecializacion(ej, id, spec) {
    const s = ej.soldados[id];
    if (!s || !D.ESPECIALIZACIONES[spec]) return "No se puede.";
    s.spec = spec; s.ascensoPendiente = false;
    hito(s, ej.anio, `Elige ser ${D.ESPECIALIZACIONES[spec].nombre.toLowerCase()}.`);
    return null;
  }
  const pendientesDeAscenso = ej => enFila(ej).filter(s => s.ascensoPendiente);

  /* Relaciones de un soldado: familia y compañeros de armas */
  function relaciones(ej, s) {
    const out = [];
    const cita = (o, tipo) => out.push({ tipo, s: o });
    if (s.padre && ej.soldados[s.padre]) cita(ej.soldados[s.padre], s.sexo === "f" ? "hija de" : "hijo de");
    if (s.madre && ej.soldados[s.madre]) cita(ej.soldados[s.madre], s.sexo === "f" ? "hija de" : "hijo de");
    if (s.pareja && ej.soldados[s.pareja]) cita(ej.soldados[s.pareja], "pareja");
    s.hijos.forEach(h => { if (ej.soldados[h]) cita(ej.soldados[h], ej.soldados[h].sexo === "f" ? "padre de" : "padre de"); });
    todos(ej).forEach(o => { if (o.id !== s.id && o.padre && o.padre === s.padre) cita(o, "hermano"); });
    Object.keys(s.companeros).filter(id => (s.companeros[id] || 0) >= 3 && ej.soldados[id] && !out.some(r => r.s.id === id)).sort((a, b) => s.companeros[b] - s.companeros[a]).slice(0, 4)
      .forEach(id => out.push({ tipo: `compañero de ${s.companeros[id]} guerras`, s: ej.soldados[id] }));
    return out;
  }

  /* Dibujo del árbol de una casa: del más antiguo a los hijos */
  function arbolDeCasa(ej, nombreCasa) {
    const miembros = todos(ej).filter(s => s.casa === nombreCasa);
    const raices = miembros.filter(s => !s.padre || !ej.soldados[s.padre] || ej.soldados[s.padre].casa !== nombreCasa);
    const hijosDe = s => miembros.filter(o => o.padre === s.id).sort((a, b) => a.nacimiento - b.nacimiento);
    const nodo = s => ({ s, hijos: hijosDe(s).map(nodo) });
    return raices.sort((a, b) => a.nacimiento - b.nacimiento).map(nodo);
  }

  /* Reliquia con su historial de propietarios */
  function historialReliquia(ej, id) { const r = ej.reliquias[id]; return r ? r.propietarios.slice() : []; }

  raiz.FracturaCampana = {
    MAX_SOLDADOS, MAX_CAPITANES, crearEjercito, todos, vivos, enFila, caidos, retirados, ninos, capitanes, limiteContingente, casas, reliquiasDe, reliquiasLibres,
    nombrarCapitan, quitarCapitan, asignarCompania, equipar, desequipar, renombrarEjercito, elegirContingenteAuto, prepararBando, prepararGuerra, cerrarGuerra,
    disponibles, convaleciente, elegirEspecializacion, pendientesDeAscenso, relaciones, arbolDeCasa, historialReliquia, calcularLogros, hito, clon
  };
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.FracturaCampana;
})(typeof window !== "undefined" ? window : globalThis);
