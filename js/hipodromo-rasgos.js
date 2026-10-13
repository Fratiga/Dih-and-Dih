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
  function efectos(r) {
    const clave = CLAVES.map(k => (r && r[k]) || "").join("|");
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
    Object.freeze(fx);
    memo.set(clave, fx);
    return fx;
  }

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

  return { TABLAS, CLAVES, EFECTOS, NOMBRES, QUE_HACE, ADORNO, sortear, heredar, completo, efectos, lista };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.HipodromoRasgos;
