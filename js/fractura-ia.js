/* =============================================================================
   LA FRACTURA: el rival controlado por la máquina. Juega su turno con las mismas acciones que un
   jugador (FracturaMotor.aplicar), sin trampas salvo el bono de recursos de la dificultad Difícil.
   Ve todo el mapa (no usa la niebla de guerra). Con varios rivales ataca al enemigo cercano que más le
   conviene y cada ejército tiene sus manías, sacadas de su historia (a quién odia y a quién prefiere atacar).
   Cada turno: investiga, construye, recluta y mueve unidad por unidad: ataca donde más rinde,
   captura lo que queda libre, retira a los heridos y empuja contra la ciudad enemiga.
============================================================================= */
(function (raiz) {
  const D = raiz.FRACTURA_DATOS || (typeof require !== "undefined" ? require("./fractura-datos.js") : null);
  const FM = raiz.FracturaMotor || (typeof require !== "undefined" ? require("./fractura-motor.js") : null);
  const S = raiz.FracturaSoldados || (typeof require !== "undefined" ? require("./fractura-soldados.js") : null);
  const { TERRENOS, CLASES, EDIFICIOS, FACCIONES, DIFICULTADES, HEROES } = D;
  const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

  const PREF_ESCUELA = {
    "caballeros-del-reino": ["militar", "tanato", "arcano"], "academia-arcana-de-dolbred": ["arcano", "militar", "tanato"], "trono-de-ceniza": ["tanato", "militar", "arcano"],
    "compania-dorada": ["militar", "arcano", "tanato"], "hijos-del-acero": ["militar", "arcano", "tanato"], "santos-de-asmodeo": ["militar", "arcano", "tanato"],
    nikaalia: ["tanato", "militar", "arcano"], mravec: ["tanato", "militar", "arcano"], nernib: ["arcano", "militar", "tanato"]
  };
  /* Manías de cada ejército con varios rivales. odia: a quién va primero. gusto: "debil" (al que va peor), "fuerte" (al que va mejor),
     "rico" (al que tiene más oro) o "monstruos" (a los ejércitos de monstruos). */
  const PERFIL = {
    "caballeros-del-reino": { odia: ["trono-de-ceniza"], gusto: "invasor" }, "academia-arcana-de-dolbred": { odia: ["nernib"], gusto: "invasor" },
    "trono-de-ceniza": { odia: ["caballeros-del-reino"], gusto: "debil" }, "compania-dorada": { odia: [], gusto: "rico" },
    "hijos-del-acero": { odia: ["trono-de-ceniza", "okran", "mravec"], gusto: "monstruos" }, "santos-de-asmodeo": { odia: ["mravec", "okran", "trono-de-ceniza", "nernib", "pelgiria"], gusto: "monstruos" },
    nikaalia: { odia: [], gusto: "debil" }, seosan: { odia: [], gusto: "fuerte" }, okran: { odia: [], gusto: "fuerte" }, pelgiria: { odia: [], gusto: "debil" },
    mravec: { odia: [], gusto: "rico" }, nernib: { odia: ["mravec"], gusto: "invasor" }, balutia: { odia: [], gusto: "debil" }
  };
  const PREF_EDIFICIO = {
    militar: ["granja", "aserradero", "cuartel", "mina", "mercado", "herreria", "santuario", "arsenal", "academia_militar", "banco", "biblioteca", "fortaleza"],
    magico: ["granja", "santuario", "aserradero", "mina", "biblioteca", "mercado", "cuartel", "torre_magia", "banco", "herreria"]
  };
  const PESOS_CLASE = { guerrero: 3, cazador: 2.2, picaro: 1, paladin: 1.4, arcanista: 1.6, caballero: 2.4, archimago: 2.2, esqueleto: 3, ballestero: 2.4, mercenario: 2.6, sanador: 1.4, eco: 1,
    capo: 1.2, maestro: 2.2, berserker: 2.6, barrilero: 1.2, quimera: 2.2, automata: 2.4, condenado: 2.6 };

  /* Distancia (con coste de terreno) desde unas casillas objetivo a todo el mapa, ignorando unidades */
  function campo(est, metas) {
    const w = est.ancho, h = est.alto;
    const d = new Array(w * h).fill(1e9);
    const cola = [];
    metas.forEach(m => { d[m.y * w + m.x] = 0; cola.push(m.y * w + m.x); });
    while (cola.length) {
      cola.sort((a, b) => d[a] - d[b]);
      const i = cola.shift();
      const x = i % w, y = Math.floor(i / w);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const c = TERRENOS[est.casillas[ny][nx].t].mov;
        if (!c) continue;
        const nd = d[i] + c;
        if (nd < d[ny * w + nx]) { d[ny * w + nx] = nd; cola.push(ny * w + nx); }
      }
    }
    return d;
  }

  function valorObjetivo(est, t) {
    let v = 1;
    if (t.lider) v += 3;
    if (t.s && (t.s.capitan || S.rangoIndice(t.s.victorias + (t.vicG || 0)) >= 2)) v += 1.5;
    if (["arcanista", "archimago", "eco", "cazador", "ballestero", "sanador"].includes(t.clase)) v += 0.6;
    if (t.dueno === -1) v = t.guardia ? 1.1 : 0.6;
    return v;
  }

  // El alcance de cada unidad no cambia dentro de un turno de la máquina: se calcula una vez
  let cacheAlc = new Map();
  const alcanceDe = (est, w) => { let a = cacheAlc.get(w.uid); if (a === undefined) { a = FM.ef(est, w).alc; cacheAlc.set(w.uid, a); } return a; };

  function evaluarAtaque(est, u, desde, t) {
    const sx = u.x, sy = u.y, sr = u.recorrido;
    u.x = desde.x; u.y = desde.y;
    if (desde.recorrido !== undefined) u.recorrido = desde.recorrido;
    const dmg = FM.calcularDano(est, u, t);
    let ret = 0;
    if (dmg < t.hp && cheb(desde, t) <= FM.ef(est, t).alc && CLASES[t.clase].atq > 1) ret = Math.max(1, Math.ceil(FM.calcularDano(est, t, u) * 0.6));
    // Riesgo: otros enemigos que lo alcanzarían donde se queda
    let riesgo = 0;
    Object.values(est.unidades).forEach(w => {
      if (!FM.hostil(est, w.dueno, u.dueno) || w === t || w.dueno < 0 && !w.errante) return;
      if (cheb(w, desde) > 5) return;
      if (cheb(w, desde) <= alcanceDe(est, w) + 1) riesgo += 0.6;
    });
    u.x = sx; u.y = sy; u.recorrido = sr;
    const mata = dmg >= t.hp;
    const val = valorObjetivo(est, t);
    let puntos = dmg * val + (mata ? 6 + 2 * val : 0) - ret * 0.8 - (mata ? 0 : riesgo);
    if (!mata && t.hp - dmg <= 3) puntos += 1;
    if (est.casillas[t.y][t.x].est === "ciudad" && t.dueno >= 0) puntos += 1.5;
    return { puntos, dmg, mata, ret };
  }

  function mejorAccionDeAtaque(est, u, azar, nivel) {
    if (u.atacado || u.clase === "sanador") return null;
    const e = FM.ef(est, u);
    const info = FM.alcanzables(est, u);
    const posiciones = [{ x: u.x, y: u.y, recorrido: u.recorrido, c: 0 }];
    const polvora = FM.usaPolvora(est, u);
    // Con pólvora no se puede mover y disparar: o dispara desde donde está, o se mueve
    if (!polvora) info.destinos.forEach(n => posiciones.push({ x: n.x, y: n.y, recorrido: (u.recorrido || 0) + cheb(u, n), c: n.c }));
    else if (!u.quieto) return null;
    let mejor = null;
    if (FM.enTregua(est) && u.dueno >= 0) { /* durante la tregua solo se ataca a las criaturas */ }
    const enemigos = Object.values(est.unidades).filter(w => FM.hostil(est, w.dueno, u.dueno) && !(FM.enTregua(est) && w.dueno >= 0));
    posiciones.forEach(p => {
      enemigos.forEach(t => {
        if (cheb(p, t) > e.alc || cheb(p, t) < 1) return;
        if (t.dueno === -1 && !t.guardia && !t.errante) return;
        if (cheb(p, t) > 2 && t.dueno >= 0 && FACCIONES[est.jugadores[t.dueno].faccion].mods.noche) return;
        if (cheb(p, t) > 1 && t.dueno >= 0 && !t.heroe && FM.vecinosAliados(est, t).some(w => w.heroe && HEROES[w.heroe].ef.velo)) return;
        const ev = evaluarAtaque(est, u, p, t);
        let puntos = ev.puntos - p.c * 0.15;
        // Preferir quedarse en buen terreno
        puntos += TERRENOS[est.casillas[p.y][p.x].t].def * 0.4;
        if (nivel === "dificil" && t.hp < FM.ef(est, t).hpMax) puntos += 0.8;
        if (!mejor || puntos > mejor.puntos) mejor = { puntos, p, t, ev };
      });
    });
    if (!mejor || mejor.puntos < 0.5) return null;
    if (azar() < DIFICULTADES[nivel].erra) return null;
    return mejor;
  }

  function escogerEdificio(est, j, ciudad) {
    const fac = FACCIONES[est.jugadores[j].faccion];
    const faccion = est.jugadores[j].faccion;
    const magico = ["academia-arcana-de-dolbred", "santos-de-asmodeo", "nernib"].includes(faccion);
    const lista = PREF_EDIFICIO[magico ? "magico" : "militar"].slice();
    const propios = Object.keys(EDIFICIOS).filter(id => EDIFICIOS[id].solo === faccion);
    lista.splice(3, 0, ...propios);
    void fac;
    return lista.find(id => !FM.razonNoConstruir(est, j, ciudad.id, id)) || null;
  }

  function escogerClase(est, j, ciudad, azar) {
    const jug = est.jugadores[j];
    const mios = FM.unidadesDe(est, j);
    const cuenta = {};
    mios.forEach(u => { cuenta[u.clase] = (cuenta[u.clase] || 0) + 1; });
    const total = Math.max(1, mios.length);
    let mejor = null;
    FM.clasesDisponibles(est, j).forEach(cl => {
      if (FM.razonNoReclutar(est, j, ciudad.id, cl)) return;
      const peso = (PESOS_CLASE[cl] || 1);
      const deseado = peso / 12;
      let puntos = (deseado - (cuenta[cl] || 0) / total) * 10 + azar() * 1.5;
      if (cl === "arcanista" && (cuenta[cl] || 0) >= 3) puntos -= 4;
      if (["sanador", "eco", "archimago"].includes(cl) && (cuenta[cl] || 0) >= 2) puntos -= 4;
      const coste = FM.costeReclutar(est, j, cl, ciudad);
      puntos -= Object.values(coste).reduce((a, b) => a + b, 0) * 0.08;
      if (!mejor || puntos > mejor.puntos) mejor = { cl, puntos };
    });
    void jug;
    return mejor ? mejor.cl : null;
  }

  function economia(est, j, azar, nivel) {
    const jug = est.jugadores[j];
    const cfg = DIFICULTADES[nivel];
    // Investigación
    if (cfg.investiga) {
      const pref = PREF_ESCUELA[jug.faccion] || ["militar", "arcano", "tanato"];
      for (const esc of pref) {
        if (FM.razonNoInvestigar(est, j, esc)) continue;
        if (jug.tech[esc] >= 2 && esc !== pref[0]) continue;
        if (FM.aplicar(est, { t: "investigar", escuela: esc }).ok) break;
      }
    }
    // Héroe: en cuanto cumple los requisitos
    if (!jug.heroeInvocado) {
      const cap = FM.ciudadesDe(est, j).find(c => c.capital) || FM.ciudadesDe(est, j)[0];
      if (cap) for (const h of jug.heroes) { if (FM.requisitosHeroe(est, j, h.id, cap.id).ok && FM.aplicar(est, { t: "invocar", ciudad: cap.id, heroe: h.id }).ok) break; }
    }
    // Construcción y crecimiento
    FM.ciudadesDe(est, j).forEach(c => {
      if (est.turno >= 2 || c.capital) {
        const ed = escogerEdificio(est, j, c);
        if (ed && (jug.recursos.oro >= 4 || est.turno <= 4)) FM.aplicar(est, { t: "construir", ciudad: c.id, edificio: ed });
        else if (!ed && c.edificios.length >= c.nivel + 2 && c.nivel < 4 && jug.recursos.oro >= 14 && jug.recursos.materiales >= 14) FM.aplicar(est, { t: "mejorar", ciudad: c.id });
      }
    });
    // Reclutamiento
    const tope = Math.min(FM.MAX_UNIDADES - 1, 5 + Math.floor(est.turno * 0.7) + (nivel === "dificil" ? 2 : 0));
    FM.ciudadesDe(est, j).forEach(c => {
      if (FM.unidadesDe(est, j).length >= tope) return;
      const cl = escogerClase(est, j, c, azar);
      if (cl) FM.aplicar(est, { t: "reclutar", ciudad: c.id, clase: cl });
    });
  }

  function jugarTurno(est, j, opciones) {
    opciones = opciones || {};
    const jug = est.jugadores[j];
    const nivel = (jug.ia && jug.ia.nivel) || est.dificultad || "normal";
    let sem = (est.rs ^ (est.turno * 2654435761)) >>> 0;
    const azar = () => { sem = (Math.imul(sem, 1664525) + 1013904223) >>> 0; return sem / 4294967296; };
    const pasos = [];
    const aplicar = acc => { const r = FM.aplicar(est, acc); if (r.ok) pasos.push(acc); return r; };
    const fmAplicar = FM.aplicar;
    void fmAplicar;

    cacheAlc = new Map();
    economia(est, j, azar, nivel);
    if (est.ganador !== null) return pasos;

    const esRival = d => d >= 0 && d !== null && FM.hostil(est, d, j);
    const tregua = FM.enTregua(est);
    const perfil = PERFIL[jug.faccion] || { odia: [], gusto: "debil" };
    // Cuánto le apetece ir contra cada rival
    const ganas = {};
    const rivales = FM.rivalesDe(est, j);
    const puntos = rivales.map(q => FM.puntuacion(est, q));
    const maxP = Math.max.apply(null, puntos.concat([1])), minP = Math.min.apply(null, puntos.concat([maxP]));
    const yoP = FM.puntuacion(est, j);
    rivales.forEach((q, i) => {
      const o = est.jugadores[q];
      let g = 0;
      if (perfil.odia.includes(o.faccion)) g += 1.6;
      if (perfil.gusto === "debil" && puntos[i] === minP) g += 0.8;
      if (perfil.gusto === "fuerte" && puntos[i] === maxP) g += 0.8;
      if (perfil.gusto === "rico") g += Math.min(1.2, (o.recursos.oro || 0) / 25);
      if (perfil.gusto === "monstruos" && FACCIONES[o.faccion].monstruos) g += 0.8;
      if (perfil.gusto === "invasor" && Object.values(est.unidades).some(w => w.dueno === q && cheb(w, est.capitales[j]) <= 5)) g += 1.4;
      // Que el que va muy por delante no se escape
      if (puntos[i] === maxP && puntos[i] > yoP + 6) g += 0.9;
      ganas[q] = g;
    });
    const campoCache = new Map();
    const campoDe = (clave, metas) => { if (!campoCache.has(clave)) campoCache.set(clave, campo(est, metas)); return campoCache.get(clave); };
    const w = est.ancho;
    const capPropia = est.capitales[j];

    // Orden: primero los que pegan a distancia, luego los de choque, al final los frágiles de apoyo
    const orden = FM.unidadesDe(est, j).slice().sort((a, b) => (CLASES[b.clase].alc - CLASES[a.clase].alc) || (CLASES[b.clase].hp - CLASES[a.clase].hp));
    orden.forEach(u => {
      if (est.ganador !== null || !est.unidades[u.uid]) return;
      // Habilidades
      if (u.clase === "picaro" && !u.atacado) {
        const ciu = tregua ? null : Object.values(est.ciudades).find(c => esRival(c.dueno) && cheb(u, c) <= 1 && c.edificios.some(e => !(c.desh[e] >= est.turno)));
        if (ciu) { const ed = ciu.edificios.find(e => !(ciu.desh[e] >= est.turno)); if (aplicar({ t: "habilidad", id: "sabotear", uid: u.uid, x: ciu.x, y: ciu.y, edificio: ed }).ok) return; }
      }
      if (jug.tech.tanato >= 3 && jug.recursos.anima >= 3 && !u.atacado) {
        const tumba = est.tumbas.find(t => cheb(u, t) <= 1 && !FM.unidadEn(est, t.x, t.y));
        if (tumba && aplicar({ t: "habilidad", id: "reanimar", uid: u.uid, x: tumba.x, y: tumba.y }).ok) return;
      }
      if (habilidadesNuevas(u)) return;
      const e = FM.ef(est, u);
      const ataque = mejorAccionDeAtaque(est, u, azar, nivel);
      const herido = u.hp <= e.hpMax * 0.4;
      if (ataque && !(herido && !ataque.ev.mata && ataque.ev.ret >= u.hp)) {
        if (ataque.p.x !== u.x || ataque.p.y !== u.y) aplicar({ t: "mover", uid: u.uid, x: ataque.p.x, y: ataque.p.y });
        if (est.unidades[u.uid] && !u.atacado) aplicar({ t: "atacar", uid: u.uid, x: ataque.t.x, y: ataque.t.y });
        return;
      }
      if (u.lider && est.unidades[u.uid]) {
        // El líder se queda cerca de la capital propia, salvo que haya algo que pegar
        if (cheb(u, capPropia) > 2) mover(u, [capPropia]);
        return;
      }
      if (!est.unidades[u.uid]) return;
      // Objetivos de movimiento
      let metas = null, clave = "";
      if (herido && FM.ciudadesDe(est, j).length) {
        const propias = FM.ciudadesDe(est, j);
        const cerca = propias.reduce((m, c) => (!m || cheb(u, c) < cheb(u, m) ? c : m), null);
        if (cheb(u, cerca) > 0) { metas = [cerca]; clave = `casa${cerca.id}`; }
        else return;
      }
      if (!metas && ["arcanista", "archimago", "eco", "sanador", "cazador", "ballestero"].includes(u.clase)) {
        // Los de apoyo avanzan solo con escolta
        const escolta = FM.unidadesDe(est, j).some(o => o !== u && !o.lider && CLASES[o.clase].alc === 1 && cheb(o, u) <= 2);
        if (!escolta && est.turno > 1) {
          const amigo = FM.unidadesDe(est, j).filter(o => o !== u && CLASES[o.clase].alc === 1 && !o.lider).sort((a, b) => cheb(a, u) - cheb(b, u))[0];
          if (amigo) { metas = [amigo]; clave = `amigo${amigo.uid}`; }
        }
      }
      if (!metas) {
        const libres = [];
        Object.values(est.ciudades).forEach(c => {
          if (c.dueno === null) libres.push({ x: c.x, y: c.y, v: 4 });
          else if (esRival(c.dueno) && !tregua) libres.push({ x: c.x, y: c.y, v: (c.capital ? 5 : 3) + (ganas[c.dueno] || 0) });
        });
        est.fortalezas.forEach((p, i) => { const d = est.fortalezasDueno[i]; if (d === null || (esRival(d) && !tregua)) libres.push({ x: p.x, y: p.y, v: 2.5 }); });
        est.casillas.forEach((fila, y) => fila.forEach((c, x) => { if (c.est === "ruinas" && !c.saqueada) libres.push({ x, y, v: 2 }); }));
        const nuc = est.nucleo;
        if (est.turno >= 5) libres.push({ x: nuc.x, y: nuc.y, v: 3 });
        // El más valioso por distancia; el rival tiene prioridad si la capital propia está en peligro
        const amenaza = Object.values(est.unidades).filter(o => esRival(o.dueno) && cheb(o, capPropia) <= 4);
        if (amenaza.length >= 2 && cheb(u, capPropia) <= 6) { metas = [capPropia]; clave = "defensa"; }
        else {
          libres.forEach(l => { l.s = l.v * 3 - cheb(u, l) * 0.9 + azar() * 1.2; });
          // Repartir: no mandar a todos al mismo sitio
          libres.forEach(l => { l.s -= (est.__ia && est.__ia[`${l.x},${l.y}`] || 0) * 2.5; });
          libres.sort((a, b) => b.s - a.s);
          const l = libres[0];
          if (l) { metas = [l]; clave = `m${l.x},${l.y}`; est.__ia = est.__ia || {}; est.__ia[`${l.x},${l.y}`] = (est.__ia[`${l.x},${l.y}`] || 0) + 1; }
        }
      }
      if (metas) mover(u, metas, clave);
    });
    delete est.__ia;

    /* Lo propio de cada ejército: habilidades de héroe, consagrar y sobornar. Devuelve true si la unidad ya gastó su acción. */
    function habilidadesNuevas(u) {
      if (u.atacado || !est.unidades[u.uid]) return false;
      const fac = FACCIONES[jug.faccion];
      const h = u.heroe ? HEROES[u.heroe] : null;
      const junto = (x, y) => Object.values(est.unidades).filter(w => cheb(w, { x, y }) <= 1);
      if (h) {
        for (const n of [1, 2]) {
          const ab = n === 2 ? h.ef.activa2 : h.ef.activa;
          if (!ab || (n === 2 ? u.cd2 : u.cd) > 0 || (ab.coste && !FM.puedePagar(jug, ab.coste))) continue;
          if (ab.id === "area" && !tregua) {
            let mejor = null;
            for (let y = u.y - ab.alc; y <= u.y + ab.alc; y++) for (let x = u.x - ab.alc; x <= u.x + ab.alc; x++) {
              if (!FM.dentro(est, x, y)) continue;
              const dianas = junto(x, y).filter(w => FM.hostil(est, w.dueno, j));
              const v = dianas.length + dianas.filter(w => w.hp <= ab.dano).length;
              if (v >= 2 && (!mejor || v > mejor.v)) mejor = { x, y, v };
            }
            if (mejor && aplicar({ t: "habilidad", id: "heroe", uid: u.uid, n, x: mejor.x, y: mejor.y }).ok) return true;
          } else if (ab.id === "curar") {
            const heridos = FM.unidadesDe(est, j).filter(w => cheb(w, u) <= ab.radio && w.hp <= FM.ef(est, w).hpMax - 3);
            if (heridos.length >= 2 && aplicar({ t: "habilidad", id: "heroe", uid: u.uid, n }).ok) return true;
          } else if (ab.id === "formar") {
            const cercaEnemigo = Object.values(est.unidades).some(w => esRival(w.dueno) && cheb(w, u) <= 3);
            if (cercaEnemigo && FM.vecinosAliados(est, u).length >= 2 && aplicar({ t: "habilidad", id: "heroe", uid: u.uid, n }).ok) return true;
          } else if (ab.id === "contratar") {
            const t = junto(u.x, u.y).find(w => w.dueno === -1);
            if (t && aplicar({ t: "habilidad", id: "heroe", uid: u.uid, n, x: t.x, y: t.y }).ok) return true;
          } else if (ab.id === "alzar") {
            if (est.tumbas.some(t => t.dueno === j) && aplicar({ t: "habilidad", id: "heroe", uid: u.uid, n }).ok) return true;
          }
        }
        return false;
      }
      if (fac.mods.soborno && jug.recursos.oro >= fac.mods.soborno + 4) {
        const t = junto(u.x, u.y).find(w => w.dueno === -1);
        if (t && aplicar({ t: "habilidad", id: "sobornar", uid: u.uid, x: t.x, y: t.y }).ok) return true;
      }
      if (u.clase === "sanador" && fac.mods.consagra && !FM.consagradaPara(est, j, u.x, u.y) && est.turno > 1 && azar() < 0.6) {
        if (aplicar({ t: "habilidad", id: "consagrar", uid: u.uid }).ok) return true;
      }
      return false;
    }

    function mover(u, metas, clave) {
      const campoMeta = campoDe(clave || `k${metas[0].x},${metas[0].y}`, metas);
      const info = FM.alcanzables(est, u);
      let mejor = null;
      const actual = campoMeta[u.y * w + u.x];
      info.destinos.forEach(n => {
        let v = campoMeta[n.y * w + n.x];
        if (v >= 1e9) return;
        v -= TERRENOS[est.casillas[n.y][n.x].t].def * 0.3;
        // No acabar junto a muchos enemigos sin motivo
        const cerca = Object.values(est.unidades).filter(o => esRival(o.dueno) && cheb(o, n) <= 1).length;
        v += cerca * 1.2;
        if (!mejor || v < mejor.v) mejor = { v, n };
      });
      if (mejor && mejor.v < actual - 0.2) {
        aplicar({ t: "mover", uid: u.uid, x: mejor.n.x, y: mejor.n.y });
        if (est.unidades[u.uid] && !u.atacado) {
          const a2 = mejorAccionDeAtaque(est, u, azar, nivel);
          if (a2 && a2.p.x === u.x && a2.p.y === u.y) aplicar({ t: "atacar", uid: u.uid, x: a2.t.x, y: a2.t.y });
        }
      }
    }
    return pasos;
  }

  /* Juega el turno completo del jugador j y lo termina */
  function turnoCompleto(est, j) {
    if (est.activo !== j || est.ganador !== null) return [];
    const pasos = jugarTurno(est, j);
    if (est.ganador === null && est.activo === j) FM.aplicar(est, { t: "terminar" });
    return pasos;
  }

  raiz.FracturaIA = { jugarTurno, turnoCompleto, campo };
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.FracturaIA;
})(typeof window !== "undefined" ? window : globalThis);
