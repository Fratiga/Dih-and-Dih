/* =============================================================================
   OSTELAR — personajes, enemigos y botín. Convierte todo lo que ya existe en
   el Compendio a "unidades" que el motor de combate entiende:
     · alzados predeterminados (7 clases, nivel 1 a 20, calculados por fórmula)
     · fichas de jugadores (se COPIAN; la ficha original no se toca)
     · enemigos desde data/stats.js (las habilidades se leen con statsR20Leer)
   Un "registro" es lo que se guarda (nivel, xp, mejoras, equipo). La "unidad"
   se reconstruye desde el registro antes de cada combate.
============================================================================= */
(function (OS) {
  const ATR = ["fue", "des", "con", "int", "sab", "car"];
  const mod = OS.mod;

  /* --- Armas (de data/armas.js) ------------------------------------------- */
  const metros = txt => {
    const m = String(txt || "").replace(",", ".").match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : 0;
  };

  OS.arma = function (id) {
    const a = (window.ARMAS || []).find(x => x.id === id);
    if (!a) return null;
    const props = (a.propiedades || []).join(" ").toLowerCase();
    const tags = (a.tags || []).join(" ");
    const distancia = tags.includes("a-distancia");
    const dano = /^\d+d\d+$/.test(a["daño"] || "") ? a["daño"] : (/^\d+$/.test(a["daño"] || "") ? a["daño"] : "1d4");
    let alcance = 1;
    if (distancia) alcance = Math.max(2, Math.floor(metros(a.alcance) / 1.5));
    else if (props.includes("alcance")) alcance = 2;
    return {
      id: a.id, nombre: a.title, dano, tipoDano: OS.tipoDanoCanon(a.tipoDano), alcance, distancia,
      sutil: props.includes("sutil"), dosManos: props.includes("dos manos"), marcial: tags.includes("marcial")
    };
  };

  /* --- Clases predeterminadas ---------------------------------------------
     atr: puntuaciones iniciales (ya con los bonos de raza). principal: la que
     sube con las mejoras de característica (nv. 4, 8, 12, 16 y 19). */
  OS.CLASES = {
    guerrero: {
      nombre: "Guerrero", dado: 10, principal: "fue", secundaria: "con", lanza: "ninguno",
      atr: { fue: 17, des: 12, con: 15, int: 8, sab: 12, car: 10 },
      arma: "espada-larga", armadura: "malla", escudo: true,
      ataques: n => (n >= 20 ? 4 : n >= 11 ? 3 : n >= 5 ? 2 : 1),
      desc: "Maestro de armas. Más ataques con el nivel, recupera aliento y puede actuar dos veces en un turno."
    },
    barbaro: {
      nombre: "Bárbaro", dado: 12, principal: "fue", secundaria: "con", lanza: "ninguno",
      atr: { fue: 17, des: 13, con: 16, int: 8, sab: 10, car: 8 },
      arma: "hacha-a-dos-manos", armadura: null, escudo: false, defensaSinArmadura: "con",
      ataques: n => (n >= 5 ? 2 : 1),
      desc: "Entra en Furia: resiste el daño físico y golpea más fuerte."
    },
    picaro: {
      nombre: "Pícaro", dado: 8, principal: "des", secundaria: "con", lanza: "ninguno",
      atr: { fue: 8, des: 17, con: 14, int: 12, sab: 12, car: 10 },
      arma: "estoque", armaDistancia: "arco-corto", armadura: "cuero", escudo: false,
      ataques: () => 1,
      desc: "Ataque furtivo con ventaja o un aliado junto al blanco. Se mueve y esquiva con una acción adicional."
    },
    mago: {
      nombre: "Mago", dado: 6, principal: "int", secundaria: "con", lanza: "completo", lanzAtr: "int",
      atr: { fue: 8, des: 14, con: 14, int: 17, sab: 12, car: 10 },
      arma: "baston", armadura: null, escudo: false,
      ataques: () => 1, lista: "mago",
      desc: "Lanzador completo. Daño de área, control y teletransporte."
    },
    clerigo: {
      nombre: "Clérigo", dado: 8, principal: "sab", secundaria: "con", lanza: "completo", lanzAtr: "sab",
      atr: { fue: 14, des: 10, con: 14, int: 10, sab: 17, car: 12 },
      arma: "maza", armadura: "escamas", escudo: true,
      ataques: () => 1, lista: "clerigo",
      desc: "Cura, protege y castiga con luz."
    },
    paladin: {
      nombre: "Paladín", dado: 10, principal: "fue", secundaria: "car", lanza: "mitad", lanzAtr: "car",
      atr: { fue: 17, des: 10, con: 14, int: 8, sab: 10, car: 15 },
      arma: "espada-larga", armadura: "malla", escudo: true,
      ataques: n => (n >= 5 ? 2 : 1), lista: "paladin",
      desc: "Golpes consagrados (Castigo divino), imposición de manos y magia de apoyo."
    },
    explorador: {
      nombre: "Explorador", dado: 10, principal: "des", secundaria: "sab", lanza: "mitad", lanzAtr: "sab",
      atr: { fue: 11, des: 17, con: 14, int: 10, sab: 14, car: 8 },
      arma: "arco-largo", armadura: "escamas", escudo: false,
      ataques: n => (n >= 5 ? 2 : 1), lista: "explorador",
      desc: "Arquero preciso. Marca a su presa y le ataca a distancia."
    }
  };

  const COLORES = { guerrero: "#ff9a2e", barbaro: "#ff4a3a", picaro: "#4d9dff", mago: "#b565ff", clerigo: "#ffe23d", paladin: "#f2f6ff", explorador: "#3fe673", ficha: "#38d6ff" };
  // las copias de fichas y los enemigos reciben un color vivo según su identidad, para distinguirlos en el tablero
  const COLORES_FICHA = ["#38d6ff", "#ff7ad9", "#a6ff3d", "#ffb02e", "#7a8bff", "#2ee6c5"];
  const COLORES_ENEMIGO = ["#ff3d6e", "#ff7a2e", "#d94dff", "#ff5252", "#ffc02e", "#c2ff2e"];
  const colorPorId = (lista, id) => { let h = 0; String(id).split("").forEach(ch => { h = (h * 31 + ch.charCodeAt(0)) | 0; }); return lista[Math.abs(h) % lista.length]; };

  /* --- Registros (lo que se guarda) -------------------------------------- */
  OS.nuevoId = () => (crypto.randomUUID ? crypto.randomUUID() : `v-${Date.now()}-${Math.random().toString(16).slice(2)}`);

  OS.registroPredeterminado = function (claseId, nombre) {
    const c = OS.CLASES[claseId];
    return {
      id: OS.nuevoId(), origen: "predeterminado", claseId, nombre: nombre || `${c.nombre} de Ostelar`,
      nivel: 1, xp: 0, mejoras: 0, bonosAtr: {}, equipo: {}, inventario: [],
      victorias: 0, derrotas: 0, color: COLORES[claseId]
    };
  };

  /* Reparte los puntos de mejora pendientes (2 por cada nivel 4, 8, 12, 16 y 19). */
  OS.mejorasPorNivel = nivel => OS.NIVELES_MEJORA.filter(n => nivel >= n).length * 2;
  OS.repartirMejorasAuto = function (reg) {
    const c = OS.CLASES[reg.claseId];
    if (!c) return;
    reg.bonosAtr = reg.bonosAtr || {};
    while (reg.mejoras > 0) {
      const objetivo = [c.principal, c.secundaria, "con", "des"].find(id => (c.atr[id] || 10) + (reg.bonosAtr[id] || 0) < 20);
      if (!objetivo) break;
      reg.bonosAtr[objetivo] = (reg.bonosAtr[objetivo] || 0) + 1;
      reg.mejoras--;
    }
  };

  /* Copia una ficha de jugador. snapshot: la ficha entera en ese momento. */
  OS.registroDesdeFicha = function (ficha) {
    const nivel = Math.max(1, Math.min(OS.NIVEL_MAX, parseInt(ficha.identidad.nivelTotal, 10) || 1));
    // La copia no necesita las imágenes grandes: pesarían mucho en el guardado del navegador.
    const copia = JSON.parse(JSON.stringify(ficha));
    copia.decoraciones = [];
    copia.identidad.fichaFoto = "";
    if (String(copia.identidad.retrato || "").length > 20000) copia.identidad.retrato = "";
    delete copia.importado;
    return {
      id: OS.nuevoId(), origen: "ficha", fichaId: ficha.id, nombre: ficha.identidad.nombre || "Sin nombre",
      nivel, nivelBase: nivel, xp: OS.XP_PARA_NIVEL[nivel] || 0, mejoras: 0, bonosAtr: {}, equipo: {}, inventario: [],
      ficha: copia, victorias: 0, derrotas: 0, color: COLORES.ficha
    };
  };

  /* --- Objetos --------------------------------------------------------------- */
  OS.nombreObjeto = it => {
    if (!it) return "";
    const b = it.bonus ? ` ${OS.signo(it.bonus)}` : "";
    return `${it.nombre}${b}${it.afijo ? " " + it.afijo.nombre : ""}`;
  };

  /* Botín: ítems nuevos según el nivel del enemigo derrotado. */
  OS.generarObjeto = function (nivelEnemigo) {
    const nivel = Math.max(1, nivelEnemigo);
    const bonus = Math.max(0, Math.min(3, Math.round((nivel - 2) / 5 + (Math.random() * 1.3 - 0.5))));
    const r = Math.random();
    if (r < 0.5) {
      const lista = (window.ARMAS || []).filter(a => /^\d/.test(a["daño"] || "") && (nivel >= 3 || !(a.tags || []).includes("marcial") || Math.random() < 0.4));
      const a = lista[Math.floor(Math.random() * lista.length)];
      const afijos = OS.AFIJOS_ARMA.filter(x => x.minNivel <= nivel);
      const afijo = afijos.length && Math.random() < 0.35 ? afijos[Math.floor(Math.random() * afijos.length)] : null;
      return { id: OS.nuevoId(), tipo: "arma", base: a.id, nombre: a.title, bonus, afijo };
    }
    if (r < 0.8) {
      const max = Math.min(5, Math.ceil(nivel / 3));
      const lista = OS.ARMADURAS.filter(x => x.tier <= max);
      const a = lista[Math.floor(Math.random() * lista.length)];
      const afijos = OS.AFIJOS_ARMADURA.filter(x => x.minNivel <= nivel);
      const afijo = afijos.length && Math.random() < 0.3 ? afijos[Math.floor(Math.random() * afijos.length)] : null;
      return { id: OS.nuevoId(), tipo: "armadura", base: a.id, nombre: a.nombre, bonus, afijo };
    }
    if (r < 0.9) return { id: OS.nuevoId(), tipo: "escudo", nombre: "Escudo", bonus, afijo: null };
    const accesorios = [
      { nombre: "Anillo de protección", ca: Math.max(1, bonus) },
      { nombre: "Amuleto de vigor", pv: 8 + 6 * Math.max(1, bonus) },
      { nombre: "Botas de viento", vel: 1 }
    ];
    const ac = accesorios[Math.floor(Math.random() * accesorios.length)];
    return Object.assign({ id: OS.nuevoId(), tipo: "accesorio", bonus: 0, afijo: null }, ac);
  };

  /* --- Unidades --------------------------------------------------------------- */
  function unidadVacia(o) {
    return Object.assign({
      id: o.nombre + Math.random().toString(16).slice(2, 6), equipo: "jugadores", nombre: "?", nivel: 1, pvMax: 10, pv: 10, ca: 10,
      vel: 6, mod: { fue: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 }, comp: 2, iniciativa: 0,
      x: 0, y: 0, color: "#ccc", acciones: [], conjuros: [], lanz: { ataque: 0, cd: 10, mod: 0 }, espacios: [], usados: [],
      ataquesPorAccion: 1, res: [], inm: [], vul: [], cond: {}, usos: {}, notas: [], ia: "cuerpo", retrato: "", rasgos: []
    }, o);
  }

  function bonosDe(reg) { return reg.bonosAtr || {}; }

  function armaduraCa(reg, modDes, modCon, claseDef) {
    const eq = reg.equipo || {};
    let base;
    let extra = 0;
    let pvExtra = 0, velExtra = 0, espinas = null, resistencias = [];
    const arm = eq.armadura ? OS.ARMADURAS.find(a => a.id === eq.armadura.base) : (claseDef && claseDef.armadura ? OS.ARMADURAS.find(a => a.id === claseDef.armadura) : null);
    if (arm) {
      base = arm.base + Math.min(modDes, arm.des);
      if (eq.armadura) extra += eq.armadura.bonus || 0;
    } else {
      base = 10 + modDes + (claseDef && claseDef.defensaSinArmadura ? modCon : 0);
    }
    if (eq.escudo) extra += 2 + (eq.escudo.bonus || 0);
    else if (claseDef && claseDef.escudo) extra += 2;
    if (eq.accesorio) { extra += eq.accesorio.ca || 0; pvExtra += eq.accesorio.pv || 0; velExtra += eq.accesorio.vel || 0; }
    const af = eq.armadura && eq.armadura.afijo;
    if (af) { pvExtra += af.pv || 0; velExtra += af.vel || 0; if (af.espinas) espinas = af.espinas; if (af.resistencia) resistencias.push(af.resistencia); }
    return { ca: base + extra, pvExtra, velExtra, espinas, resistencias };
  }

  function accionArma(nombre, arma, bonoAtaque, danoMod, extra) {
    const danos = [{ f: danoMod ? `${arma.dano}${OS.signo(danoMod)}` : arma.dano, t: arma.tipoDano }];
    return Object.assign({
      id: `arma-${arma.id}`, nombre, costo: "accion", tipo: "arma", arma: true, alcance: arma.alcance, ataque: bonoAtaque,
      danos, sutil: arma.sutil, distancia: arma.distancia
    }, extra || {});
  }

  function aplicarEquipoArma(u, reg, modFue, modDes, comp, extraDano) {
    const it = reg.equipo && reg.equipo.arma;
    if (!it) return null;
    const a = OS.arma(it.base);
    if (!a) return null;
    const m = a.distancia ? modDes : (a.sutil ? Math.max(modFue, modDes) : modFue);
    const accion = accionArma(OS.nombreObjeto(it), a, m + comp + (it.bonus || 0), m + (it.bonus || 0) + (extraDano || 0), { equipada: true });
    if (it.afijo) {
      if (it.afijo.extra) accion.danos.push({ f: it.afijo.extra.f, t: it.afijo.extra.t, extra: true });
      if (it.afijo.estado) accion.estado = it.afijo.estado;
      if (it.afijo.empuje) accion.empuje = it.afijo.empuje;
      if (it.afijo.robo) accion.robo = it.afijo.robo;
    }
    return accion;
  }

  /* Conjuros de una lista de clase hasta el nivel de espacio máximo. */
  function conjurosDeClase(lista, espacios) {
    const maxNivel = espacios.length;
    return OS.CONJUROS.filter(c => c.clases.includes(lista) && (c.nivel === 0 || c.nivel <= maxNivel));
  }

  OS.unidadDesdeRegistro = function (reg) {
    if (reg.origen === "ficha") return unidadDesdeFicha(reg);
    return unidadPredeterminada(reg);
  };

  function unidadPredeterminada(reg) {
    const c = OS.CLASES[reg.claseId];
    const nivel = reg.nivel;
    const bonos = bonosDe(reg);
    const score = id => Math.min(20, (c.atr[id] || 10) + (bonos[id] || 0));
    const m = {};
    ATR.forEach(id => { m[id] = mod(score(id)); });
    const comp = OS.competencia(nivel);
    const a = armaduraCa(reg, m.des, m.con, c);
    const pvBase = c.dado + m.con + (nivel - 1) * (Math.floor(c.dado / 2) + 1 + m.con);
    const u = unidadVacia({
      id: reg.id, nombre: reg.nombre, nivel, color: COLORES[reg.claseId] || reg.color, claseId: reg.claseId, clase: c.nombre,
      pvMax: Math.max(1, pvBase + a.pvExtra), ca: a.ca, vel: 6 + a.velExtra, mod: m, comp, iniciativa: m.des,
      ataquesPorAccion: c.ataques(nivel), res: a.resistencias.slice(), espinas: a.espinas, registro: reg
    });
    u.pv = u.pvMax;

    // Arma principal (la del equipo, o la de la clase)
    const equipada = aplicarEquipoArma(u, reg, m.fue, m.des, comp, 0);
    const baseArma = OS.arma(c.arma);
    const modArma = baseArma.distancia ? m.des : (baseArma.sutil ? Math.max(m.fue, m.des) : m.fue);
    const duelo = reg.claseId === "guerrero" ? 2 : 0;
    const principal = accionArma(baseArma.nombre, baseArma, modArma + comp, modArma + duelo);
    if (reg.claseId === "picaro") principal.furtivo = true;
    if (reg.claseId === "paladin") principal.castigo = true;
    if (reg.claseId === "explorador") principal.cazador = true;
    u.acciones.push(equipada || principal);
    if (equipada) {
      if (reg.claseId === "picaro" && (equipada.sutil || equipada.distancia)) equipada.furtivo = true;
      if (reg.claseId === "paladin") equipada.castigo = true;
      if (reg.claseId === "explorador") equipada.cazador = true;
    }
    if (c.armaDistancia) {
      const ad = OS.arma(c.armaDistancia);
      const ar = accionArma(ad.nombre, ad, m.des + comp, m.des);
      if (reg.claseId === "picaro") ar.furtivo = true;
      u.acciones.push(ar);
    }

    // Rasgos propios
    const rasgos = [];
    if (reg.claseId === "guerrero") {
      u.acciones.push({ id: "segundo-aliento", nombre: "Segundo aliento", costo: "bonus", tipo: "cura", alcance: 0, cura: `1d10+${nivel}`, usos: 1, desc: "Recuperas 1d10 + tu nivel." });
      if (nivel >= 2) u.acciones.push({ id: "oleada", nombre: "Oleada de acción", costo: "libre", tipo: "especial", especial: "oleada", usos: nivel >= 17 ? 2 : 1, desc: "Ganas una acción adicional este turno." });
      rasgos.push("Estilo de duelo: +2 al daño con un arma.");
    }
    if (reg.claseId === "barbaro") {
      const usos = nivel >= 20 ? 99 : nivel >= 17 ? 6 : nivel >= 12 ? 5 : nivel >= 6 ? 4 : nivel >= 3 ? 3 : 2;
      u.furia = nivel >= 16 ? 4 : nivel >= 9 ? 3 : 2;
      u.acciones.push({ id: "furia", nombre: "Furia", costo: "bonus", tipo: "efecto", alcance: 0, estado: { nombre: "furia", turnos: 99 }, usos, desc: `Resistes el daño físico y sumas +${u.furia} al daño cuerpo a cuerpo.` });
      rasgos.push("Defensa sin armadura: 10 + DES + CON.");
    }
    if (reg.claseId === "picaro") {
      u.furtivoDados = Math.ceil(nivel / 2);
      u.acciones.push({ id: "correr", nombre: "Acción astuta: correr", costo: "bonus", tipo: "especial", especial: "correr", desc: "Doblas tu movimiento este turno." });
      rasgos.push(`Ataque furtivo: +${u.furtivoDados}d6 una vez por turno con ventaja o con un aliado junto al blanco.`);
    }
    if (reg.claseId === "paladin") {
      const reserva = nivel * 5;
      u.acciones.push({ id: "imposicion", nombre: "Imposición de manos", costo: "accion", tipo: "cura", alcance: 1, cura: "reserva", reserva, usos: 1, desc: `Curas hasta ${reserva} PV de una reserva.` });
      rasgos.push("Castigo divino: al impactar puedes gastar un espacio para +2d8 radiante.");
    }
    if (reg.claseId === "explorador") {
      u.cazadorDados = nivel >= 11 ? "1d8" : "1d6";
      rasgos.push("Cazador: +1d6 al daño contra un blanco marcado (+1d8 desde nv. 11).");
    }
    u.rasgos = rasgos;

    // Magia
    if (c.lanza !== "ninguno") {
      u.espacios = OS.espaciosPara(c.lanza, nivel);
      u.usados = u.espacios.map(() => 0);
      const modLanz = m[c.lanzAtr];
      u.lanz = { ataque: modLanz + comp, cd: 8 + modLanz + comp, mod: modLanz, atributo: c.lanzAtr };
      u.conjuros = conjurosDeClase(c.lista, u.espacios);
    }
    u.acciones.push({ id: "esquivar", nombre: "Esquivar", costo: "accion", tipo: "especial", especial: "esquivar", desc: "Los ataques contra ti tienen desventaja hasta tu próximo turno." });
    u.acciones.push({ id: "correr-accion", nombre: "Correr", costo: "accion", tipo: "especial", especial: "correr", desc: "Doblas tu movimiento este turno." });
    return u;
  }

  /* --- Fichas de jugadores ------------------------------------------------ */
  const CLASES_LANZADORAS = [
    ["mago", "completo"], ["hechicer", "completo"], ["clerig", "completo"], ["druida", "completo"], ["bardo", "completo"], ["brujo", "completo"],
    ["paladin", "mitad"], ["explorador", "mitad"], ["guardabosque", "mitad"]
  ];
  const CLASES_MARCIALES = [["guerrero", [5, 11, 20]], ["barbaro", [5]], ["paladin", [5]], ["explorador", [5]], ["guardabosque", [5]], ["monje", [5]]];

  function alcanceDeTexto(txt, distanciaPorDefecto) {
    const t = String(txt || "").trim();
    if (!t) return distanciaPorDefecto ? 12 : 1;
    const m = metros(t);
    if (!m) return 1;
    return Math.max(1, Math.floor(m / 1.5));
  }

  function unidadDesdeFicha(reg) {
    const p = reg.ficha;
    const nivel = reg.nivel;
    const base = reg.nivelBase || 1;
    const dComp = OS.competencia(nivel) - OS.competencia(base);
    const bonos = bonosDe(reg);
    const m = {};
    ATR.forEach(id => {
      const puntos = (p.atributos[id] || 8) + (p.atributosRaciales ? (p.atributosRaciales[id] || 0) : 0);
      m[id] = fichasModificadorFinal(p, id) + (mod(puntos + (bonos[id] || 0)) - mod(puntos));
    });
    const comp = fichasCompetenciaTotal(p) + dComp;
    const claseTxt = OS.sinAcentos(`${p.identidad.clase} ${(p.identidad.clasesExtra || []).map(c => c.nombre).join(" ")}`);

    // PV: los de la ficha más lo que da cada nivel nuevo
    const dado = parseInt(String((p.combate.dadosGolpe || {}).dado || "d8").replace(/\D/g, ""), 10) || 8;
    const pvFicha = p.combate.pvMax > 0 ? p.combate.pvMax : dado + m.con + (base - 1) * (Math.floor(dado / 2) + 1 + m.con);
    const ganado = Math.max(0, nivel - base) * Math.max(1, Math.floor(dado / 2) + 1 + m.con);
    const bonoCon = (mod((p.atributos.con || 8) + ((p.atributosRaciales || {}).con || 0) + (bonos.con || 0)) - mod((p.atributos.con || 8) + ((p.atributosRaciales || {}).con || 0))) * nivel;
    const a = armaduraCa({ equipo: reg.equipo }, m.des, m.con, null);
    // CA de la ficha, más lo que aporte el equipo nuevo que se ganó en Ostelar
    const eq = reg.equipo || {};
    const escudoFicha = Number(p.combate.ca.escudo) || 0;
    let ca = fichasCATotal(p);
    if (eq.armadura) ca = Math.max(ca, a.ca + (eq.escudo ? 0 : escudoFicha));
    else ca += (eq.escudo ? 2 + (eq.escudo.bonus || 0) : 0) + (eq.accesorio ? eq.accesorio.ca || 0 : 0);
    const u = unidadVacia({
      id: reg.id, nombre: reg.nombre, nivel, color: colorPorId(COLORES_FICHA, reg.id), clase: p.identidad.clase || "", claseId: "ficha",
      pvMax: Math.max(1, pvFicha + ganado + bonoCon + a.pvExtra), ca, vel: Math.max(1, Math.round((Number(p.combate.velocidad) || 30) / 5)) + a.velExtra,
      mod: m, comp, iniciativa: fichasIniciativaTotal(p) + (m.des - fichasModificadorFinal(p, "des")), res: a.resistencias.slice(), espinas: a.espinas,
      retrato: p.identidad.retrato || "", registro: reg
    });
    u.pv = u.pvMax;
    CLASES_MARCIALES.forEach(([k, niveles]) => {
      if (claseTxt.includes(k)) u.ataquesPorAccion = Math.max(u.ataquesPorAccion, 1 + niveles.filter(n => nivel >= n).length);
    });

    // Ataques de la ficha
    (p.ataques || []).forEach(at => {
      const dano = String(fichasDanoAtaque(p, at) || "").replace(/\s+/g, "");
      if (!dano) return;
      const distancia = /\d/.test(String(at.alcance || "")) && metros(at.alcance) >= 6;
      const ataque = fichasAtaqueTotal(p, at) + (at.competente ? dComp : 0) + (m[at.atributo] - fichasModificadorFinal(p, at.atributo));
      u.acciones.push({
        id: `fa-${at.id}`, nombre: at.nombre || "Ataque", costo: "accion", tipo: "arma", arma: true,
        alcance: alcanceDeTexto(at.alcance, false), ataque, danos: [{ f: dano.replace(/^\+/, ""), t: OS.tipoDanoCanon(at.tipoDano) }],
        sutil: /sutil/i.test(at.propiedades || ""), distancia
      });
    });
    const equipada = aplicarEquipoArma(u, reg, m.fue, m.des, comp, 0);
    if (equipada) u.acciones.unshift(equipada);
    if (!u.acciones.some(x => x.tipo === "arma")) {
      u.acciones.push(accionArma("Ataque desarmado", { id: "punos", dano: "1", tipoDano: "contundente", alcance: 1 }, m.fue + comp, m.fue));
    }

    // Magia: espacios (escalan con el nivel si la clase es lanzadora) y lista de conjuros de la ficha
    const lanzador = CLASES_LANZADORAS.find(([k]) => claseTxt.includes(k));
    const espaciosFicha = ((p.lanzamiento || {}).espacios || []).filter(e => Number(e.max) > 0);
    if (lanzador && nivel > base) {
      u.espacios = OS.espaciosPara(lanzador[1], nivel);
    } else if (espaciosFicha.length) {
      const mx = Math.max(...espaciosFicha.map(e => Number(e.nivel) || 1));
      u.espacios = Array.from({ length: mx }, (_, i) => espaciosFicha.filter(e => Number(e.nivel) === i + 1).reduce((s, e) => s + Number(e.max), 0));
    } else if (lanzador) {
      u.espacios = OS.espaciosPara(lanzador[1], nivel);
    }
    u.usados = u.espacios.map(() => 0);
    const atrLanz = (p.lanzamiento || {}).atributo || "int";
    const modLanz = m[atrLanz];
    u.lanz = {
      ataque: fichasLanzamientoAtaque(p) + dComp + (modLanz - fichasModificadorFinal(p, atrLanz)),
      cd: fichasLanzamientoCD(p) + dComp + (modLanz - fichasModificadorFinal(p, atrLanz)), mod: modLanz, atributo: atrLanz
    };
    (p.hechizos || []).forEach(h => {
      if (h.disponible === false) return;
      const cat = OS.conjuroPorNombre(h.nombre);
      if (cat) { u.conjuros.push(cat); return; }
      const generico = conjuroGenerico(p, h);
      if (generico) u.conjuros.push(generico); else u.notas.push(`${h.nombre}: sin automatizar`);
    });
    (p.rasgos || []).forEach(r => { if (r.nombre) u.rasgos.push(`${r.nombre}${r.descripcion ? ": " + r.descripcion : ""}`); });
    u.acciones.push({ id: "esquivar", nombre: "Esquivar", costo: "accion", tipo: "especial", especial: "esquivar", desc: "Los ataques contra ti tienen desventaja hasta tu próximo turno." });
    u.acciones.push({ id: "correr-accion", nombre: "Correr", costo: "accion", tipo: "especial", especial: "correr", desc: "Doblas tu movimiento este turno." });
    return u;
  }

  function conjuroGenerico(p, h) {
    const danoTxt = String(fichasResolverFormula(p, h.dano || "") || "").replace(/\s+/g, "");
    if (!danoTxt || !/\d/.test(danoTxt)) return null;
    const desc = OS.sinAcentos(h.descripcion || "");
    const salv = desc.match(/salvacion de (fuerza|destreza|constitucion|inteligencia|sabiduria|carisma)/);
    const idAtr = { fuerza: "fue", destreza: "des", constitucion: "con", inteligencia: "int", sabiduria: "sab", carisma: "car" };
    const tipo = h.tipo === "salvacion" ? "salvacion" : h.tipo === "ataque" ? "ataque" : (salv ? "salvacion" : "auto");
    const t = OS.sinAcentos(h.tiempo || "");
    return {
      id: `fh-${h.id}`, nombre: h.nombre, nivel: Number(h.nivel) || 0, escuela: h.escuela || "", truco: Number(h.nivel) === 0,
      costo: /adicional|bonus/.test(t) ? "bonus" : "accion", tipo, salv: salv ? idAtr[salv[1]] : "des", mitad: desc.includes("mitad"),
      alcance: Math.max(1, alcanceDeTexto(h.alcance, true)), danos: [{ f: danoTxt, t: OS.tipoDanoCanon(h.tipoDano) }], generico: true, clases: []
    };
  }

  /* --- Enemigos --------------------------------------------------------------- */
  const ATRIBUTO_ID = { fuerza: "fue", destreza: "des", constitucion: "con", inteligencia: "int", sabiduria: "sab", carisma: "car" };

  function pies(texto) {
    const t = OS.sinAcentos(texto);
    let m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:pies|pie|ft)/);
    if (m) return parseFloat(m[1].replace(",", ".")) / 5;
    m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:metros|m)\b/);
    if (m) return parseFloat(m[1].replace(",", ".")) / 1.5;
    return 0;
  }

  function leerAccionEnemigo(s, hab, indice) {
    const nombreLimpio = statsR20Limpiar(hab.nombre);
    const tag = OS.sinAcentos(hab.nombre);
    if (/pasiva|rasgo|una vez por combate/.test(tag) && !/accion|bonus/.test(tag.replace(/pasiva|rasgo/g, ""))) return { pasiva: nombreLimpio + ": " + hab.descripcion };
    if (/reaccion/.test(tag)) return { pasiva: nombreLimpio + " (reacción, sin automatizar): " + hab.descripcion };
    const costo = /bonus|adicional/.test(tag) ? "bonus" : "accion";
    const r = statsR20Leer(hab.descripcion, s, hab.nombre);
    const d = OS.sinAcentos(hab.descripcion);
    const recarga = tag.match(/recarga\s*(\d)/);
    const a = {
      id: `e${indice}`, nombre: nombreLimpio, costo, tipo: "efecto", alcance: 1, danos: [], desc: hab.descripcion,
      recarga: recarga ? parseInt(recarga[1], 10) : null
    };

    // alcance y área
    const alc = pies(d.match(/alcance[^.]*?\d+(?:[.,]\d+)?\s*(?:pies|pie|metros|m)\b/) ? d.match(/alcance[^.]*?\d+(?:[.,]\d+)?\s*(?:pies|pie|metros|m)\b/)[0] : "");
    const cono = d.match(/cono de (\d+) pies/);
    const linea = d.match(/linea de (\d+) pies/);
    const radio = d.match(/(?:radio de|esfera de|nube de|a\s+)(\d+(?:[.,]\d+)?)\s*(pies|metros|m)\b[^.]*?(?:criaturas|enemigos)/);
    const todas = /todas las criaturas (?:cercanas |a )?/.test(d);
    if (cono) { a.area = { forma: "cono", largo: parseInt(cono[1], 10) / 5 }; a.alcance = 0; }
    else if (linea) { a.area = { forma: "linea", largo: parseInt(linea[1], 10) / 5 }; a.alcance = 0; }
    else if (todas && radio) { a.area = { forma: "explosion", radio: Math.max(1, Math.round(pies(radio[1] + " " + radio[2]))) }; a.alcance = 0; }
    else if (alc) a.alcance = Math.max(1, Math.round(alc));
    else if (/distancia|disparo|arco|honda|ballesta|arpon|lanza/.test(d + tag) && !/cuerpo a cuerpo/.test(d)) {
      if (/arpon|disparo|arco|honda|ballesta/.test(tag + d)) a.alcance = 8;
    }

    if (r.curacion) { a.tipo = "cura"; a.cura = r.curacion; a.alcance = 0; return { accion: a }; }
    a.danos = r.danos.filter(x => !x.adicional || r.danos.length === 1).map(x => ({ f: x.formula, t: OS.tipoDanoCanon(x.tipo) }));
    r.danos.filter(x => x.adicional).forEach(x => { if (a.danos.length) a.danos.push({ f: x.formula, t: OS.tipoDanoCanon(x.tipo), extra: true }); });
    if (r.ataque !== null) { a.tipo = "arma"; a.ataque = r.ataque; }
    else if (r.salvaciones.length) { a.tipo = "salvacion"; a.salv = r.salvaciones[0].atributo; a.cd = r.salvaciones[0].cd; a.mitad = /mitad/.test(d); }
    else if (a.danos.length) { a.tipo = "auto"; }

    // efectos al impactar o al fallar la salvación
    const est = d.match(/(?:cae|queda|quedan|cae al suelo|queda con)\s+(derribad|restringid|enganchad|aturdid|paralizad|asustad|envenenad|cegad)/);
    const nombres = { derribad: "derribado", restringid: "apresado", enganchad: "apresado", aturdid: "aturdido", paralizad: "paralizado", asustad: "asustado", envenenad: "envenenado", cegad: "cegado" };
    if (est) a.estado = { nombre: nombres[est[1]], turnos: 1 };
    const emp = d.match(/empujad[oa]s?\s+(\d+)\s+pies/);
    if (emp) a.empuje = Math.max(1, Math.round(parseInt(emp[1], 10) / 5));
    if (a.tipo === "efecto" && !a.estado && !a.danos.length) return { pasiva: nombreLimpio + ": " + hab.descripcion };
    if (a.tipo === "arma" && a.danos.length === 0) return { pasiva: nombreLimpio + ": " + hab.descripcion };
    a.arma = a.tipo === "arma" && costo === "accion" && !a.recarga && !a.area;
    return { accion: a };
  }

  OS.unidadDesdeStats = function (s, subida) {
    const k = subida || 0;
    const m = {};
    ATR.forEach(id => { m[id] = mod((s.stats && s.stats[id]) || 10); });
    const nivel = Number.isFinite(Number(s.nivel)) ? Number(s.nivel) : 1;
    const vel = Math.max(1, Math.round((parseInt(s.velocidad, 10) || 30) / 5));
    const pvBase = Number.isFinite(Number(s.pv)) ? Number(s.pv) : 10;
    const u = unidadVacia({
      id: `${s.id}-${Math.random().toString(16).slice(2, 6)}`, equipo: "enemigos", nombre: s.nombre, nivel: nivel + k, clase: s.rol || "", baseId: s.id,
      pvMax: Math.round(pvBase * (1 + 0.3 * k)), ca: (Number(s.ca) || 10) + Math.floor(k / 2), vel, mod: m,
      comp: OS.competencia(nivel), iniciativa: m.des, color: colorPorId(COLORES_ENEMIGO, s.id), tipoCriatura: s.tipo || ""
    });
    u.pv = u.pvMax;
    (s.habilidades || []).forEach((h, i) => {
      const r = leerAccionEnemigo(s, h, i);
      if (r.pasiva) { u.rasgos.push(r.pasiva); return; }
      const a = r.accion;
      if (k) {
        if (a.ataque !== undefined && a.ataque !== null) a.ataque += k;
        if (a.cd) a.cd += k;
        if (a.danos[0]) a.danos[0].f = `${a.danos[0].f}+${2 * k}`;
      }
      u.acciones.push(a);
    });
    if (!u.acciones.some(a => a.tipo === "arma")) {
      u.acciones.push(accionArma("Golpe", { id: "golpe", dano: "1d6", tipoDano: "contundente", alcance: 1 }, Math.max(m.fue, m.des) + u.comp + k, Math.max(m.fue, m.des)));
    }
    const mejorAlcance = Math.max(...u.acciones.filter(a => a.tipo === "arma").map(a => a.alcance));
    u.ia = mejorAlcance >= 6 ? "distancia" : "cuerpo";
    u.ataquesPorAccion = 1;
    if (nivel >= 5) u.ataquesPorAccion = 2;
    if (nivel >= 14) u.ataquesPorAccion = 3;
    u.estrategia = s.estrategia || "";
    return u;
  };

  /* Enemigos aptos para pelear (alguna acción que haga daño). */
  OS.enemigosDisponibles = function () {
    return (window.STATS || []).filter(s => Number.isFinite(Number(s.nivel)) && Number(s.nivel) >= 1 && Number.isFinite(Number(s.pv)))
      .filter(s => {
        const u = OS.unidadDesdeStats(s);
        return u.acciones.some(a => a.danos && a.danos.length);
      });
  };

  /* Un encuentro: lista de enemigos que suma aproximadamente el presupuesto de XP. */
  OS.dificultades = {
    facil: { nombre: "Fácil", f: 0.2 },
    normal: { nombre: "Normal", f: 0.3 },
    dificil: { nombre: "Difícil", f: 0.45 },
    mortal: { nombre: "Mortal", f: 0.65 }
  };

  OS.generarEncuentro = function (unidadesJugador, dificultadId) {
    const f = (OS.dificultades[dificultadId] || OS.dificultades.normal).f;
    const nivelMedio = Math.max(1, Math.round(unidadesJugador.reduce((t, u) => t + u.nivel, 0) / unidadesJugador.length));
    const presupuesto = unidadesJugador.length * OS.xpEnemigo(nivelMedio) * f;
    const pool = OS.enemigosDisponibles();
    const enemigos = [];
    let gastado = 0;
    let intentos = 0;
    // Un enemigo de nivel bajo puede subir de rango (más PV, golpe y CD) para que un grupo de alto nivel
    // no se encuentre siempre con los mismos dragones.
    const subida = s => Math.max(0, Math.min(6, Math.round((nivelMedio - 3 - s.nivel) / 2)));
    while (gastado < presupuesto * 0.8 && intentos++ < 40) {
      const restante = presupuesto - gastado;
      let cand = pool.filter(s => s.nivel >= nivelMedio - 8 && s.nivel <= nivelMedio + 2 && OS.xpEnemigo(s.nivel + subida(s)) <= restante * 1.15);
      // los personajes con nombre propio salen una sola vez por combate; el resto puede repetirse
      cand = cand.filter(s => !(s.personajeId && enemigos.some(e => e.baseId === s.id)));
      if (!cand.length) break;
      const s = cand[Math.floor(Math.random() * cand.length)];
      const e = OS.unidadDesdeStats(s, subida(s));
      enemigos.push(e);
      gastado += OS.xpEnemigo(e.nivel);
      if (enemigos.length >= Math.max(3, unidadesJugador.length + 3)) break;
    }
    if (!enemigos.length) enemigos.push(OS.unidadDesdeStats(pool.reduce((a, b) => (b.nivel < a.nivel ? b : a))));
    return enemigos;
  };
})(window.OS);
