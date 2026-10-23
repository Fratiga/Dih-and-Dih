/* =============================================================================
   HIPÓDROMO: rasgos de las criaturas (cuernos, alas, patas extra, piel, ojos, dedos, cola, cuello, núcleo...).
   Los comparten el motor (que los sortea al nacer, los hereda y los pesa en la carrera) y el dibujo (que los
   pinta). Es un script de navegador sin dependencias: el servidor lo copia junto al motor sin tocarlo.

   Cada rasgo se hereda del padre o de la madre casi siempre y un 8 % es nuevo. Los hay con efecto en la carrera
   y los hay de adorno; todo lo que tiene efecto se ve en el cuerpo, así que el que lee bien la criatura sabe qué
   hace. Los efectos son pequeños a propósito: valen lo que un cuerpo algo mejor o peor, no deciden carreras solos.

   Un efecto (HipodromoRasgos.efectos) es un objeto con estas claves; lo que no está es neutro:
     vel, res, ace, agi, tem   puntos que se suman a la capacidad (como el cuerpo)
     frag      suma a la fragilidad (cuánto se lesiona)
     trafico   0..1, cuánto se libra del tráfico de los que corren delante
     cuesta    0..1, cuánto alivia el coste de las cuestas
     tropiezo  multiplicador de la probabilidad de tropezar
     pref      suma a la preferencia por terreno blando (pezuña)
     temp      multiplicador de cuánto le afecta el frío o el calor
     ruido     multiplicador del desorden que mete la niebla y la tormenta
     meta      segundos que gana al estirar el cuello en la meta
     corriente ventaja (fracción de velocidad) en las corrientes del Cielo Roto
     ilusion   multiplicador de cuánto la engañan los Espejos
     sumidero  multiplicador del gasto extra de la Ciénaga
     nucleo    ventaja (fracción de velocidad) en las pistas arcanas
============================================================================= */
window.HipodromoRasgos = (function () {
  const TABLAS = {
    patas: [["4", 95], ["hex", 1.6], ["del", 1.1], ["fina", 0.8], ["tras", 0.8], ["aux", 0.7]],
    cuello: [["recto", 40], ["serpentino", 14], ["grueso", 14], ["segmentado", 8], ["melena", 24]],
    hocico: [["medio", 30], ["corto", 20], ["largo", 18], ["cuadrado", 16], ["punta", 16]],
    orejas: [["pequeñas", 18], ["largas", 18], ["puntiagudas", 20], ["caidas", 14], ["redondas", 12], ["aleta", 10], ["dobles", 5], ["ninguna", 3]],
    cuernos: [["ninguno", 42], ["recto", 8], ["atras", 8], ["adelante", 5], ["curvo", 8], ["espiral", 5], ["ramas", 7], ["corona", 2], ["lateral", 4], ["colmillos", 3], ["pequeños", 8], ["unico", 4], ["multiple", 2]],
    espalda: [["lisa", 42], ["cresta", 18], ["espinas", 14], ["placas", 12], ["continua", 14]],
    cola: [["fina", 24], ["corta", 14], ["gruesa", 14], ["mechon", 16], ["plumas", 8], ["bifurcada", 3], ["espinada", 8], ["maza", 2], ["aleta", 11]],
    piel: [["pelo", 50], ["escamas", 16], ["placas", 8], ["mixta", 12], ["lisa", 14]],
    ojos: [["dos", 93], ["tres", 5], ["cuatro", 2]],
    alas: [["no", 96], ["atrofiadas", 1.5], ["pequeñas", 1], ["membranosas", 0.9], ["emplumadas", 0.6]],
    dedos: [["tres", 70], ["cuatro", 14], ["palmeadas", 8], ["garras", 8]],
    patron: [["uniforme", 30], ["patas", 16], ["cara", 14], ["manchas", 14], ["dorsal", 8], ["bandas", 8], ["degradado", 6], ["mascara", 4]],
    nucleo: [["ninguno", 80], ["latente", 13], ["vivo", 5.5], ["ardiente", 1.5]]
  };
  const CLAVES = Object.keys(TABLAS);

  /* Sorteo de una criatura sin padres conocidos. `rng` ofrece f() y peso([[valor, peso], ...]). */
  function coherencia(r) {
    if (r.cuernos === "multiple" && r.orejas === "dobles") r.orejas = "pequeñas";
    if (r.alas !== "no" && r.espalda === "continua") r.espalda = "placas";
    if (r.cola === "maza" && r.espalda === "continua") r.espalda = "espinas";
    return r;
  }
  function sortear(rng) {
    const r = {}; CLAVES.forEach(k => { r[k] = rng.peso(TABLAS[k]); });
    return coherencia(r);
  }
  /* Una cría: de cada rasgo, 46 % del padre, 46 % de la madre y 8 % uno nuevo. Siempre se gasta el mismo azar
     por rasgo (haya o no padres) para que el resto de la simulación no cambie según el linaje. */
  function heredar(rng, pa, ma) {
    const r = {};
    CLAVES.forEach(k => {
      const u = rng.f(), libre = rng.peso(TABLAS[k]);
      r[k] = pa && ma && pa[k] && ma[k] ? (u < 0.46 ? pa[k] : u < 0.92 ? ma[k] : libre) : libre;
    });
    return coherencia(r);
  }
  const completo = r => { const o = {}; CLAVES.forEach(k => { o[k] = (r && r[k]) || TABLAS[k][0][0]; }); return o; };

  /* ---------------------------------------------------------------- qué hace cada rasgo en la carrera */
  const EFECTOS = {
    patas: { hex: { ace: 5, agi: -2, frag: 0.10 }, del: { ace: 3, vel: 2 }, tras: { ace: 6, vel: 1 }, fina: { agi: 4 }, aux: { agi: 3, res: 2 } },
    alas: {
      pequeñas: { vel: -1, cuesta: 0.25, corriente: 0.012, tropiezo: 0.9 },
      membranosas: { vel: -3, cuesta: 0.45, corriente: 0.020, tropiezo: 0.8 },
      emplumadas: { vel: -2, cuesta: 0.35, corriente: 0.016, tropiezo: 0.85 }
    },
    cuernos: {
      ramas: { vel: -3, trafico: 0.4 }, corona: { vel: -3, trafico: 0.4 }, multiple: { vel: -3, trafico: 0.4 }, espiral: { vel: -3, trafico: 0.4 },
      recto: { trafico: 0.35, frag: 0.05 }, adelante: { trafico: 0.35, frag: 0.05 }, unico: { trafico: 0.35, frag: 0.05 }, colmillos: { trafico: 0.35, frag: 0.05 }, lateral: { trafico: 0.35, frag: 0.05 },
      atras: { vel: 2 }, curvo: { vel: 2 }
    },
    cola: { aleta: { agi: 3 }, plumas: { agi: 2 }, bifurcada: { agi: 2 }, maza: { ace: 2, vel: -2 } },
    piel: { escamas: { frag: -0.12, vel: -2, temp: 0.75 }, placas: { frag: -0.20, vel: -4, res: -2, temp: 0.9 }, mixta: { temp: 0.6 }, lisa: { vel: 2, frag: 0.08 } },
    ojos: { tres: { tem: 4, ruido: 0.92, ilusion: 0.6 }, cuatro: { tem: 7, ruido: 0.82, ilusion: 0.4 } },
    dedos: { palmeadas: { pref: 0.30, sumidero: 0.9 }, garras: { tropiezo: 0.75, cuesta: 0.15 }, cuatro: { tropiezo: 0.85 } },
    orejas: { dobles: { tem: 3 } },
    cuello: { serpentino: { meta: 0.03 }, segmentado: { meta: 0.02, agi: 1 }, grueso: { res: 2 } },
    espalda: { placas: { frag: -0.05 }, espinas: { trafico: 0.15 } },
    nucleo: { latente: { nucleo: 0.004 }, vivo: { nucleo: 0.010, frag: 0.04 }, ardiente: { nucleo: 0.016, frag: 0.10 } }
  };
  const SUMAN = ["vel", "res", "ace", "agi", "tem", "frag", "pref", "meta", "corriente", "nucleo"];
  const MULTIPLICAN = ["tropiezo", "temp", "ruido", "ilusion", "sumidero"];
  const memo = new Map();
  /* Suma de los efectos de todos los rasgos de una criatura. Se guarda por combinación: se pide miles de veces. */
  function efectos(r, mut) {
    const clave = CLAVES.map(k => (r && r[k]) || "").join("|") + (mut && mut.length ? "#" + mut.join(",") : "");
    let fx = memo.get(clave);
    if (fx) return fx;
    fx = { vel: 0, res: 0, ace: 0, agi: 0, tem: 0, frag: 0, trafico: 0, cuesta: 0, tropiezo: 1, pref: 0, temp: 1, ruido: 1, meta: 0, corriente: 0, ilusion: 1, sumidero: 1, nucleo: 0 };
    CLAVES.forEach(k => {
      const e = r && EFECTOS[k] && EFECTOS[k][r[k]];
      if (!e) return;
      SUMAN.forEach(c => { if (e[c]) fx[c] += e[c]; });
      MULTIPLICAN.forEach(c => { if (e[c] != null) fx[c] *= e[c]; });
      if (e.trafico) fx.trafico = 1 - (1 - fx.trafico) * (1 - e.trafico);   // se combinan sin pasar de 1
      if (e.cuesta) fx.cuesta = 1 - (1 - fx.cuesta) * (1 - e.cuesta);
    });
    (mut || []).forEach(id => {
      const e = MUT[id] && MUT[id].fx;
      if (!e) return;
      SUMAN.forEach(c => { if (e[c]) fx[c] += e[c]; });
      MULTIPLICAN.forEach(c => { if (e[c] != null) fx[c] *= e[c]; });
    });
    Object.freeze(fx);
    memo.set(clave, fx);
    return fx;
  }

  /* ---------------------------------------------------------------- mutaciones
     Lo que sale de un cruce además de los rasgos. Las pequeñas son frecuentes y casi siempre tienen precio (algo mejor y algo peor, o solo peor: taras); las grandes son raras,
     fuertes y con un coste serio, y se ven en el dibujo. g = 1 es grande. t = buena, mixta o tara. p = peso al sortear. fx = como los efectos de los rasgos.
     Cada una se hereda: un 35 % (pequeña) o un 50 % (grande) de cada padre, y se pueden sumar nuevas. Cuanto más parientes son los padres, más salen y más son taras. */
  const MUT = {
    pulmon: { n: "Pulmón ancho", g: 0, t: "buena", p: 5, fx: { res: 3 }, h: "Algo más de resistencia." },
    oido: { n: "Oído fino", g: 0, t: "buena", p: 5, fx: { tem: 3 }, h: "Más temple." },
    corazon: { n: "Corazón vivo", g: 0, t: "buena", p: 3, fx: { vel: 2 }, h: "Un poco más de velocidad punta." },
    frio: { n: "Sangre fría", g: 0, t: "buena", p: 4, fx: { temp: 0.8 }, h: "Nota menos el frío y el calor." },
    nervio: { n: "Arranque nervioso", g: 0, t: "mixta", p: 5, fx: { ace: 3, tem: -2 }, h: "Sale mejor, pero se altera más." },
    zancada: { n: "Zancada corta y viva", g: 0, t: "mixta", p: 5, fx: { agi: 3, vel: -1 }, h: "Más ágil en las curvas, algo más lenta en la recta." },
    huesos: { n: "Huesos densos", g: 0, t: "mixta", p: 5, fx: { frag: -0.10, vel: -1 }, h: "Se lesiona menos, pero pesa." },
    tendon: { n: "Tendón elástico", g: 0, t: "mixta", p: 4, fx: { ace: 2, frag: 0.05 }, h: "Más arranque y algo más frágil." },
    manto: { n: "Manto espeso", g: 0, t: "mixta", p: 4, fx: { temp: 0.85, vel: -1 }, h: "Aguanta el clima, pero pesa un poco." },
    vista: { n: "Vista corta", g: 0, t: "tara", p: 4, fx: { tem: -3, ruido: 1.1 }, h: "Menos temple y la niebla la desordena más." },
    rodilla: { n: "Rodilla floja", g: 0, t: "tara", p: 4, fx: { frag: 0.12 }, h: "Se lesiona más." },
    resuello: { n: "Resuello corto", g: 0, t: "tara", p: 4, fx: { res: -3 }, h: "Aguanta menos." },
    paso: { n: "Paso desigual", g: 0, t: "tara", p: 4, fx: { agi: -3 }, h: "Peor en las curvas." },
    corazones: { n: "Doble corazón", g: 1, t: "mixta", p: 3, fx: { res: 6, ace: -2, frag: 0.12 }, h: "Aguanta mucho más, pero arranca peor y se lesiona más." },
    cristal: { n: "Lomo de cristal", g: 1, t: "mixta", p: 3, fx: { vel: 3, frag: 0.20 }, h: "Más velocidad punta, pero se rompe con facilidad." },
    ceniza: { n: "Piel de ceniza", g: 1, t: "mixta", p: 3, fx: { temp: 0.5, vel: -2, res: 2 }, h: "Casi no nota el clima y aguanta algo más, pero es más lenta." },
    estrellas: { n: "Manto de estrellas", g: 1, t: "buena", p: 2, fx: { tem: 5, ruido: 0.85 }, h: "Mucho temple y la niebla apenas la desordena." },
    brasa: { n: "Sangre de brasa", g: 1, t: "mixta", p: 3, fx: { ace: 6, res: -3, frag: 0.10 }, h: "Sale como un rayo, pero se apaga pronto y se lesiona más." },
    sombra: { n: "Sombra propia", g: 1, t: "mixta", p: 3, fx: { tem: 3, tropiezo: 0.8, vel: -2 }, h: "Tropieza menos y mantiene la calma, pero pierde algo de velocidad." },
    resorte: { n: "Patas de resorte", g: 1, t: "mixta", p: 3, fx: { ace: 7, agi: -2, frag: 0.15 }, h: "Un arranque enorme, pero gira peor y se lesiona más." },
    hueco: { n: "Cuerpo hueco", g: 1, t: "tara", p: 2, fx: { vel: 3, res: -6, frag: 0.25 }, h: "Muy ligera y rápida un rato, pero no aguanta y se rompe." },
    aura: { n: "Aura inquieta", g: 1, t: "mixta", p: 3, fx: { nucleo: 0.010, tem: -2, frag: 0.05 }, h: "Responde bien en las pistas arcanas, pero se altera y se lesiona algo más." }
  };
  const MUT_IDS = Object.keys(MUT), MUT_MAX = 3;
  const mutPesos = (grande, r) => MUT_IDS.filter(id => !!MUT[id].g === grande).map(id => [id, MUT[id].p * (MUT[id].t === "tara" ? 1 + 6 * r : 1)]);
  /* Probabilidad de que una cría salga con una mutación nueva, pequeña o grande, según el parentesco de los padres (r, de 0 a 0,5) */
  const probMutPeq = r => Math.min(0.5, 0.14 * (1 + 4 * r));
  const probMutGrande = r => Math.min(0.12, 0.018 * (1 + 8 * r));
  const HEREDA_PEQ = 0.35, HEREDA_GRANDE = 0.5;
  /* De una cría: las de los padres (se heredan o no) y, con la suerte, una nueva */
  function heredarMut(rng, pa, ma, r) {
    const out = [];
    [pa || [], ma || []].forEach(l => l.forEach(id => { const u = rng.f(); if (MUT[id] && u < (MUT[id].g ? HEREDA_GRANDE : HEREDA_PEQ) && !out.includes(id)) out.push(id); }));
    const ug = rng.f(), up = rng.f();
    if (ug < probMutGrande(r) && !out.some(id => MUT[id].g)) out.push(rng.peso(mutPesos(true, r)));
    else if (up < probMutPeq(r)) { const id = rng.peso(mutPesos(false, r)); if (!out.includes(id)) out.push(id); }
    out.sort((a, b) => MUT[b].g - MUT[a].g);
    // solo una grande: si de los padres llegan dos, se queda la primera
    return out.filter((id, i) => !MUT[id].g || i === 0).slice(0, MUT_MAX);
  }
  /* Una criatura sin padres conocidos: casi nunca trae mutaciones */
  function sortearMut(rng) {
    const ug = rng.f(), up = rng.f();
    return ug < 0.006 ? [rng.peso(mutPesos(true, 0))] : up < 0.06 ? [rng.peso(mutPesos(false, 0))] : [];
  }

  /* ---------------------------------------------------------------- manías: el carácter. Pesan poco y solo cuando se dan sus condiciones (cond = las de la carrera) */
  const MANIAS = {
    lluvia: { n: "Odia la lluvia", t: "mala", h: "Con lluvia o tormenta rinde peor.", cuando: c => c.clima === "lluvia" || c.clima === "tormenta", fx: { vel: -3, tem: -2 } },
    barro: { n: "Le encanta el barro", t: "buena", h: "Con la pista pesada rinde más.", cuando: c => c.hum > 0.55, fx: { vel: 3 } },
    publico: { n: "Se crece con público", t: "buena", h: "En las copas y los Grandes Premios tiene más temple y arranque.", cuando: c => !!c.alto, fx: { tem: 3, ace: 1 } },
    dormilona: { n: "Se duerme en la salida", t: "mixta", h: "Arranca peor, pero se reserva y aguanta algo más.", cuando: () => true, fx: { ace: -3, res: 2 } },
    niebla: { n: "Miedo a la niebla", t: "mala", h: "Con niebla se descontrola.", cuando: c => c.clima === "niebla", fx: { tem: -4 } },
    largas: { n: "Nacida para las largas", t: "buena", h: "En las distancias largas aguanta más; en las cortas pierde algo de velocidad.", cuando: () => true, fxDist: d => (d >= 2400 ? { res: 3 } : d <= 1400 ? { vel: -1 } : {}) },
    arcana: { n: "Nerviosa en las pistas raras", t: "mala", h: "En las pistas arcanas se altera.", cuando: c => !!c.arcana, fx: { tem: -3 } },
    sol: { n: "Se cría con sol", t: "buena", h: "Con calor o cielo despejado corre más.", cuando: c => c.clima === "calor" || c.clima === "despejado", fx: { vel: 2 } },
    terca: { n: "Terca como una mula", t: "mixta", h: "Se achica menos en el tumulto, pero gira peor.", cuando: () => true, fx: { tem: 2, agi: -1 } }
  };
  const MANIAS_IDS = Object.keys(MANIAS);
  const MANIAS_MAX = 2;
  /* Lo que suman las manías de una criatura en unas condiciones: { vel, res, ace, agi, tem } */
  function maniasFx(lista, cond) {
    const o = { vel: 0, res: 0, ace: 0, agi: 0, tem: 0 };
    (lista || []).forEach(id => {
      const M = MANIAS[id]; if (!M || !M.cuando(cond || {})) return;
      const e = M.fxDist ? M.fxDist((cond || {}).dist || 0) : M.fx || {};
      Object.keys(e).forEach(k => { o[k] = (o[k] || 0) + e[k]; });
    });
    return o;
  }
  /* Sin padres: ninguna (30 %), una (50 %) o dos (20 %). Con padres: 40 % de cada manía de cada padre y un 10 % de una nueva al azar */
  function sortearManias(rng) {
    const u = rng.f(), n = u < 0.3 ? 0 : u < 0.8 ? 1 : 2, out = [];
    for (let i = 0; i < n; i++) { const id = MANIAS_IDS[Math.floor(rng.f() * MANIAS_IDS.length)]; if (!out.includes(id)) out.push(id); }
    return out;
  }
  function heredarManias(rng, pa, ma) {
    const out = [];
    [pa || [], ma || []].forEach(l => l.forEach(id => { if (rng.f() < 0.4 && MANIAS[id] && !out.includes(id)) out.push(id); }));
    const un = rng.f(), cual = rng.f();
    if (un < 0.10 && out.length < MANIAS_MAX) { const id = MANIAS_IDS[Math.floor(cual * MANIAS_IDS.length)]; if (!out.includes(id)) out.push(id); }
    return out.slice(0, MANIAS_MAX);
  }

  /* ---------------------------------------------------------------- parentesco (endogamia)
     anc = [[padre, madre], [los cuatro abuelos], [los ocho bisabuelos]] (ids; lo que no se sabe falta). El parentesco es la suma, por cada antepasado común,
     de 0,5 elevado a la suma de las generaciones que lo separan de cada uno: hermanos de padre y madre 0,5; padre e hijo 0,5; medio hermanos 0,25; primos 0,125. */
  const ancDe = p => {
    const g = p && p.anc ? p.anc.map(l => (l || []).filter(x => x != null)) : [];
    if (!g.length && p) { const l = []; if (p.padre && p.padre.id != null) l.push(p.padre.id); if (p.madre && p.madre.id != null) l.push(p.madre.id); g.push(l); }
    return g;
  };
  function parentesco(a, b) {
    if (!a || !b) return 0;
    const la = [[a.id]].concat(ancDe(a)), lb = [[b.id]].concat(ancDe(b));
    let r = 0;
    la.forEach((ga, i) => ga.forEach(x => lb.forEach((gb, j) => gb.forEach(y => { if (x === y) r += Math.pow(0.5, i + j); }))));
    return Math.min(0.5, r);
  }
  /* El árbol de una cría de dos padres */
  function linajeDe(pa, ma) {
    const A = ancDe(pa), B = ancDe(ma);
    return [[pa.id, ma.id], (A[0] || []).concat(B[0] || []), (A[1] || []).concat(B[1] || [])];
  }
  const textoParentesco = r => (r >= 0.45 ? "Son padre e hijo o hermanos" : r >= 0.2 ? "Son parientes muy cercanos (medios hermanos, tío y sobrina o abuelo)" : r >= 0.1 ? "Son primos" : r > 0 ? "Tienen algún antepasado en común" : "No son parientes");
  /* Cuántas crías: una (50 %), dos (35 %) o tres (15 %) */
  const CAMADA = [[1, 50], [2, 35], [3, 15]];
  const tamanoCamada = rng => rng.peso(CAMADA);

  /* ---------------------------------------------------------------- textos */
  const NOMBRES = {
    patas: { hex: "Seis patas", del: "Seis patas, delanteras dobles y fuertes", fina: "Seis patas, el par extra más fino", tras: "Seis patas, traseras dobles", aux: "Seis patas, un par fino en medio" },
    cuello: { serpentino: "Cuello serpentino", grueso: "Cuello grueso", segmentado: "Cuello segmentado", melena: "Melena en el cuello" },
    hocico: { corto: "Hocico corto", largo: "Hocico largo", cuadrado: "Hocico cuadrado", punta: "Hocico puntiagudo" },
    orejas: { largas: "Orejas largas", puntiagudas: "Orejas puntiagudas", caidas: "Orejas caídas", redondas: "Orejas redondas", aleta: "Orejas en aleta", dobles: "Dos pares de orejas", ninguna: "Sin orejas externas" },
    cuernos: { recto: "Cuernos rectos", atras: "Cuernos hacia atrás", adelante: "Cuernos hacia delante", curvo: "Cuernos curvados", espiral: "Cuernos en espiral", ramas: "Astas ramificadas", corona: "Corona de cuernos", lateral: "Cuernos laterales", colmillos: "Colmillos de hueso", pequeños: "Cuernos pequeños", unico: "Un solo cuerno", multiple: "Muchos cuernos" },
    espalda: { cresta: "Cresta dorsal", espinas: "Espinas dorsales", placas: "Placas dorsales", continua: "Cresta continua" },
    cola: { corta: "Cola corta", gruesa: "Cola gruesa", mechon: "Cola con mechón", plumas: "Cola de plumas", bifurcada: "Cola bifurcada", espinada: "Cola espinada", maza: "Cola con maza", aleta: "Cola con aleta" },
    piel: { escamas: "Escamas", placas: "Placas de armadura", mixta: "Escamas y pelo", lisa: "Piel lisa" },
    ojos: { tres: "Tres ojos", cuatro: "Cuatro ojos" },
    alas: { atrofiadas: "Alas atrofiadas", pequeñas: "Alas pequeñas", membranosas: "Alas de membrana", emplumadas: "Alas de plumas" },
    dedos: { cuatro: "Cuatro dedos", palmeadas: "Patas palmeadas", garras: "Garras" },
    patron: { patas: "Patas oscuras", cara: "Cara clara", manchas: "Manchas", dorsal: "Raya en el lomo", bandas: "Bandas", degradado: "Degradado", mascara: "Máscara oscura" },
    nucleo: { latente: "Núcleo latente", vivo: "Núcleo vivo", ardiente: "Núcleo ardiente" }
  };
  /* Lo que hace cada uno, en una línea (ficha y guía). Lo que no sale aquí es adorno. */
  const QUE_HACE = {
    patas: { hex: "Arranca mejor, pero es más pesada y frágil.", del: "Arranca mejor y empuja más con el tren delantero.", tras: "Arranque fuerte, empuje de atrás.", fina: "Más ágil en las curvas.", aux: "Más ágil y aguanta un poco más." },
    alas: { atrofiadas: "Solo adorno.", pequeñas: "Alivian las cuestas y casi no la dejan tropezar; en el Cielo Roto vuelan un poco. Pesan algo.", membranosas: "Las que más alivian las cuestas y el Cielo Roto, y las que más pesan.", emplumadas: "Alivian las cuestas y ayudan en el Cielo Roto. Pesan algo." },
    cuernos: { ramas: "Estorban el aire y frenan algo, pero abren paso entre el pelotón.", corona: "Estorban el aire y frenan algo, pero abren paso entre el pelotón.", multiple: "Estorban el aire y frenan algo, pero abren paso entre el pelotón.", espiral: "Estorban el aire y frenan algo, pero abren paso entre el pelotón.", recto: "Abren paso entre el pelotón; un poco más frágil.", adelante: "Abren paso entre el pelotón; un poco más frágil.", unico: "Abre paso entre el pelotón; un poco más frágil.", colmillos: "Abren paso entre el pelotón; un poco más frágil.", lateral: "Abren paso entre el pelotón; un poco más frágil.", atras: "Cortan el aire y suman algo de velocidad.", curvo: "Cortan el aire y suman algo de velocidad." },
    cola: { aleta: "Más ágil en las curvas.", plumas: "Algo más ágil en las curvas.", bifurcada: "Algo más ágil en las curvas.", maza: "Empuja mejor al arrancar, pero frena algo." },
    piel: { escamas: "Se lesiona menos y siente menos el frío y el calor; pesa algo.", placas: "La que menos se lesiona y menos nota el clima; pesa y cansa.", mixta: "Casi no nota el frío ni el calor.", lisa: "Corta mejor el aire, pero se lesiona más." },
    ojos: { tres: "Más temple y la niebla la desordena menos.", cuatro: "Mucho temple, casi no la desordena la niebla y los Espejos apenas la engañan." },
    dedos: { palmeadas: "Se sienten mejor en terreno blando y en la Ciénaga.", garras: "Agarran en las cuestas y tropiezan menos.", cuatro: "Más estables: tropiezan menos." },
    orejas: { dobles: "Más temple." },
    cuello: { serpentino: "Gana unos centímetros al estirar el cuello en la meta.", segmentado: "Estira el cuello en la meta y es algo más ágil.", grueso: "Algo más de resistencia." },
    espalda: { placas: "Algo más protegida.", espinas: "Se abre un poco de paso en el pelotón." },
    nucleo: { latente: "Responde un poco en las pistas arcanas.", vivo: "Responde bien en las pistas arcanas, a cambio de algo de fragilidad.", ardiente: "Responde mucho en las pistas arcanas, pero es bastante más frágil." }
  };
  const ADORNO = ["hocico", "patron", "orejas", "espalda", "cola", "cuello", "cuernos"];

  /* Lista legible de rasgos llamativos: [{ clave, valor, texto, hace }] (hace vacío si es adorno) */
  function lista(r) {
    const out = [];
    ["nucleo", "patas", "cuernos", "alas", "ojos", "cuello", "espalda", "cola", "piel", "dedos", "hocico", "orejas", "patron"].forEach(k => {
      const v = r && r[k], t = NOMBRES[k] && NOMBRES[k][v];
      if (t) out.push({ clave: k, valor: v, texto: t, hace: (QUE_HACE[k] && QUE_HACE[k][v]) || "" });
    });
    return out;
  }

  return { TABLAS, CLAVES, EFECTOS, NOMBRES, QUE_HACE, ADORNO, sortear, heredar, completo, efectos, lista,
    MUT, MANIAS, MUT_MAX, MANIAS_MAX, heredarMut, sortearMut, maniasFx, sortearManias, heredarManias, parentesco, linajeDe, textoParentesco, tamanoCamada, CAMADA, probMutPeq, probMutGrande };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.HipodromoRasgos;
