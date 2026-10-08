/* =============================================================================
   HIPÓDROMO: motor del mundo de carreras. Reglas puras, sin pantalla y sin reloj propio.
   Una especie propia de corredores (no caballos), una carrera cada 30 minutos para todo el mundo.
   El jugador solo mira y apuesta: no entrena ni elige quién corre.

   Todo el azar sale de una semilla del mundo más el número de carrera (crearRng(semilla, "fase", n)),
   así que el mundo es un objeto JSON y cualquiera puede repetir una carrera. El servidor guarda ese
   objeto, llama a avanzar() y publica lo que devuelve (docs/hipodromo.md).

   Lo que sabe el público y lo que no:
   - Público: el cuerpo (patas, pecho, ancas, cola, mirada, pezuña, pelaje, talla), la edad, el récord,
     las últimas carreras, el linaje, las lesiones y unas estrellas con ruido que mejoran con las salidas.
   - Oculto (solo en el estado del servidor): los genes exactos, el talento escondido, la forma del día,
     la fatiga y el rating real. Las cuotas se hacen con la probabilidad real deformada por la reputación
     y por el error del público, así que leer bien el cuerpo y las pistas da una pequeña ventaja.

   Tiempo: AÑO carreras = un año de la criatura. La carrera n corre en t0 + n * 30 min.
   Fases de una carrera n:
     programar(): al terminar la anterior se fijan inscritos, puertas, pronóstico y cuotas, y ya se calcula
                  el resultado (secreto, la base de datos lo oculta hasta la hora de salida).
     avanzar():   pasados unos segundos de la salida se aplica el resultado al mundo (premios, rating,
                  lesiones, retiros, crías, noticias) y se programa la siguiente.
============================================================================= */
(function (raiz) {
  "use strict";

  /* ---------------------------------------------------------------- constantes (los mandos del juego) */
  const C = {
    MINUTOS: 30,            // una carrera cada 30 minutos
    CIERRE_SEG: 60,         // las apuestas cierran 60 s antes de la salida
    DURACION_SEG: 75,       // lo que dura la carrera en pantalla
    APLICAR_SEG: 90,        // el servidor aplica el resultado al mundo pasado este tiempo desde la salida
    ANIO: 144,              // carreras que dura un año de las criaturas (3 días del mundo)
    OBJETIVO: 96,           // criaturas vivas que se intentan mantener
    DEBUT: 1.0,             // edad (años) a la que pueden correr
    JORNADA: 12,            // carreras seguidas en la misma pista (6 horas)
    CAMPO_MIN: 5,
    DESCANSO_MIN: 3,        // carreras de descanso entre una salida y la siguiente
    FATIGA_MAX: 68,
    CRIA_CADA: 6,           // cada cuántas carreras se mira si hay nacimientos
    GESTACION: 72,          // carreras entre dos crías de la misma madre
    MARGEN: 0.15,           // la casa se queda con el 15 % en ganador y podio
    MARGEN_EXACTA: 0.25,
    CUOTA_MIN: 1.05,
    CUOTA_MAX: 500,
    SIMS: 400,              // simulaciones para calcular las cuotas
    RATING_INICIAL: 1500,
    K_RATING: 24,
    HISTORIAL: 12,          // últimas carreras que se guardan por criatura
    MAX_CRIADORES: 40,
    INCIDENTE_ESTABLO: 0.0005,   // por criatura y carrera: entrenamiento, enfermedad, establo, fuga o algo peor
    INMIGRANTES: 0.15,           // de cada 100 nacimientos, los que llegan de otra región con genes nuevos
    HOMENAJE: 0.25               // probabilidad de que la cría lleve el nombre de un padre que fue leyenda
  };
  const ESPECIE = { singular: "cérvago", plural: "cérvagos", provisional: true };   // nombre de la especie, un solo sitio para cambiarlo
  const AJUSTE = {          // puntos de afinación de la simulación (los calibra tools/probar-hipodromo.js)
    VEL_BASE: 15.5,         // m/s de una criatura con 0 puntos de velocidad
    VEL_K: 0.006,           // m/s que suma cada punto de velocidad
    K_COSTE: 10,             // cuanto mayor, menos se resiente el ritmo por la falta de resistencia
    SD_GENES: 0.14,         // dispersión de los genes de los fundadores
    SIG_DIA: 0.012,        // cómo de bien o mal amanece cada criatura (fracción de velocidad)
    SIG_TRAMO: 0.008,       // ruido de cada tramo de 100 m
    ESCALA_REP: 90,         // cuánto pesa el rating en la reputación del público
    AGUDEZA: 1.35,          // por encima de 1, el público reparte menos por igual (afila el reparto)
    EXP_VERDAD: 0.65,       // cuánto del conocimiento real entra en las cuotas (0 = solo reputación)
    SIG_MERCADO: 0.11       // error base del público
  };

  /* ---------------------------------------------------------------- azar repetible */
  function hash(texto) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function crearRng(...partes) {
    let a = hash(partes.join("|"));
    const f = () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const r = {
      f,
      i: (lo, hi) => lo + Math.floor(f() * (hi - lo + 1)),
      pick: arr => arr[Math.floor(f() * arr.length)],
      norm: (mu = 0, sd = 1) => { let u = 0; while (u === 0) u = f(); return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * f()); },
      peso: pares => { const total = pares.reduce((s, p) => s + p[1], 0); let x = f() * total; for (const p of pares) { x -= p[1]; if (x < 0) return p[0]; } return pares[pares.length - 1][0]; },
      baraja: arr => { const o = arr.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; }
    };
    return r;
  }
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const redondea = (x, d) => { const k = Math.pow(10, d); return Math.round(x * k) / k; };
  function poisson(rng, lambda) { if (lambda <= 0) return 0; const L = Math.exp(-lambda); let k = 0, p = 1; do { k++; p *= rng.f(); } while (p > L && k < 40); return k - 1; }

  /* ---------------------------------------------------------------- formato (español, coma decimal) */
  const fmtTiempo = s => { const d = Math.round(s * 10), m = Math.floor(d / 600), r = (d - m * 600) / 10; return `${m}:${(r < 10 ? "0" : "") + r.toFixed(1).replace(".", ",")}`; };
  const fmtCuota = x => (x < 10 ? x.toFixed(2) : x < 100 ? x.toFixed(1) : String(Math.round(x))).replace(".", ",");
  const redondearCuota = x => (x < 10 ? redondea(x, 2) : x < 100 ? redondea(x, 1) : Math.round(x));
  function fmtMargen(cuerpos) {
    if (cuerpos < 0.06) return "por un hocico";
    if (cuerpos < 0.25) return "por una cabeza";
    if (cuerpos < 0.6) return "por medio cuerpo";
    if (cuerpos < 1.25) return "por un cuerpo";
    return `por ${redondea(cuerpos, 1).toString().replace(".", ",")} cuerpos`;
  }

  /* ---------------------------------------------------------------- datos del mundo */
  const PISTAS = {
    pesares: { id: "pesares", nombre: "Pradera de los Tres Pesares", suelo: "hierba", curvas: 0.35, cuestas: 0.20, drenaje: 0.50 },
    charco: { id: "charco", nombre: "El Charco Dorado", suelo: "arcilla", curvas: 0.55, cuestas: 0.10, drenaje: 0.15 },
    impuesto: { id: "impuesto", nombre: "Cuesta del Impuesto", suelo: "hierba", curvas: 0.30, cuestas: 0.80, drenaje: 0.60 },
    ceniza: { id: "ceniza", nombre: "Valle de Ceniza", suelo: "arena", curvas: 0.45, cuestas: 0.30, drenaje: 0.90 },
    mapache: { id: "mapache", nombre: "Anillo del Mapache", suelo: "arcilla", curvas: 0.80, cuestas: 0.00, drenaje: 0.40 },
    silver: { id: "silver", nombre: "Silver Mile", suelo: "hierba", curvas: 0.15, cuestas: 0.10, drenaje: 0.55 },
    hollow: { id: "hollow", nombre: "Hollow Oak Park", suelo: "hierba", curvas: 0.50, cuestas: 0.40, drenaje: 0.35 }
  };
  const IDS_PISTAS = Object.keys(PISTAS);

  const CLIMAS = {
    despejado: { texto: "cielo despejado", aporte: 0.00, temp: 0.15, ruido: 1.00, incid: 1.0 },
    nublado: { texto: "cielo nublado", aporte: 0.04, temp: -0.10, ruido: 1.00, incid: 1.0 },
    calor: { texto: "calor", aporte: 0.00, temp: 0.90, ruido: 1.00, incid: 1.0 },
    lluvia: { texto: "lluvia", aporte: 0.40, temp: -0.30, ruido: 1.05, incid: 1.3 },
    tormenta: { texto: "tormenta", aporte: 0.65, temp: -0.45, ruido: 1.15, incid: 1.8 },
    niebla: { texto: "niebla", aporte: 0.12, temp: -0.25, ruido: 1.25, incid: 1.1 }
  };
  const ESTADOS_CLIMA = ["despejado", "nublado", "calor", "lluvia", "tormenta", "niebla"];
  const MARKOV = {   // de cada estado a cada estado (mismo orden que ESTADOS_CLIMA)
    despejado: [0.58, 0.20, 0.10, 0.05, 0.01, 0.06],
    nublado: [0.22, 0.38, 0.04, 0.24, 0.03, 0.09],
    calor: [0.35, 0.10, 0.45, 0.02, 0.06, 0.02],
    lluvia: [0.06, 0.24, 0.01, 0.46, 0.17, 0.06],
    tormenta: [0.05, 0.20, 0.01, 0.41, 0.28, 0.05],
    niebla: [0.25, 0.30, 0.02, 0.13, 0.01, 0.29]
  };
  const etiquetaPista = hum => (hum < 0.12 ? "firme" : hum < 0.30 ? "bueno" : hum < 0.55 ? "blando" : "pesado");

  const GRADOS = {
    gran: { nombre: "Gran Premio", bolsa: 5000, campo: [9, 10], pesoRating: 1.6 },
    selecta: { nombre: "Selecta", bolsa: 2000, campo: [8, 9], pesoRating: 0.8 },
    corriente: { nombre: "Corriente", bolsa: 800, campo: [7, 8], pesoRating: 0 },
    novatos: { nombre: "Novatos", bolsa: 500, campo: [6, 8], pesoRating: -1.0 }
  };
  const CICLO = ["gran", "novatos", "corriente", "selecta", "corriente", "novatos", "corriente", "selecta", "corriente", "novatos", "corriente", "corriente"];
  const DISTANCIAS = {
    novatos: [[800, 0.30], [1000, 0.30], [1200, 0.25], [1600, 0.15]],
    corriente: [[1000, 0.15], [1200, 0.25], [1600, 0.30], [2000, 0.20], [2400, 0.10]],
    selecta: [[1200, 0.15], [1600, 0.30], [2000, 0.30], [2400, 0.15], [3000, 0.10]],
    gran: [[1600, 0.25], [2000, 0.30], [2400, 0.25], [3000, 0.20]]
  };
  const REPARTO = [0.50, 0.25, 0.12, 0.08, 0.05];   // reparto de la bolsa por puesto

  const LESIONES = {
    leve: ["torcedura leve", "golpe en la pezuña", "fatiga muscular", "tos de pista"],
    media: ["distensión", "esguince de pezuña", "inflamación del tendón"],
    grave: ["fractura de pata", "rotura de tendón"]
  };

  /* ---------------------------------------------------------------- el cuerpo y los genes */
  const GENES = ["pat", "pul", "mus", "col", "ojo", "pez", "pel", "tam"];
  const STATS = ["vel", "res", "ace", "agi", "tem"];
  const GEN_STAT = { vel: "pat", res: "pul", ace: "mus", agi: "col", tem: "ojo" };
  const CUERPO = {
    pat: { parte: "Patas", dice: "velocidad punta", niveles: ["Patas cortas y recias", "Patas algo cortas", "Patas de largo medio", "Patas largas", "Patas larguísimas, casi de grulla"] },
    pul: { parte: "Pecho", dice: "resistencia", niveles: ["Pecho estrecho", "Pecho algo estrecho", "Pecho de ancho medio", "Pecho amplio", "Pecho de barril"] },
    mus: { parte: "Ancas", dice: "salida y aceleración", niveles: ["Ancas flacas", "Ancas delgadas", "Ancas normales", "Ancas fuertes", "Ancas de herrero"] },
    col: { parte: "Cola", dice: "agilidad en las curvas", niveles: ["Cola corta y rígida", "Cola algo rígida", "Cola de largo medio", "Cola larga y suelta", "Cola larga, de timón"] },
    ojo: { parte: "Mirada", dice: "temple", niveles: ["Mirada nerviosa, ojos que no paran", "Mirada inquieta", "Mirada atenta", "Mirada serena", "Mirada de piedra, nada la altera"] },
    pez: { parte: "Pezuña", dice: "terreno blando", niveles: ["Pezuña fina, de pista seca", "Pezuña algo fina", "Pezuña normal", "Pezuña ancha", "Pezuña muy ancha, de barro"] },
    pel: { parte: "Pelaje", dice: "frío o calor", niveles: ["Pelaje ralo, de clima cálido", "Pelaje fino", "Pelaje normal", "Pelaje espeso", "Pelaje denso, de clima frío"] },
    tam: { parte: "Talla", dice: "nada (solo adorno)", niveles: ["Talla muy pequeña", "Talla pequeña", "Talla media", "Talla grande", "Talla enorme"] }
  };
  const CAPAS = ["castaña", "ceniza", "marfil", "carbón", "canela", "rojiza", "verdosa", "azulada"];
  const nivelDe = g => 1 + (g >= 0.2) + (g >= 0.4) + (g >= 0.6) + (g >= 0.8);
  const puntos = g => 25 + 65 * g;

  function cuerpo(c) {
    return GENES.map(k => { const nivel = nivelDe(c.genes[k]); return { clave: k, parte: CUERPO[k].parte, nivel, texto: CUERPO[k].niveles[nivel - 1] }; });
  }
  function capaTexto(c) {
    const base = CAPAS[Math.min(CAPAS.length - 1, Math.floor(c.capa * CAPAS.length))];
    return c.manchas > 0.92 ? `${base} moteada` : c.manchas > 0.72 ? `${base} con manchas` : base;
  }
  function genesFundador(rng, media) {
    const g = {}; GENES.forEach(k => { g[k] = clamp(rng.norm(media, AJUSTE.SD_GENES), 0.02, 0.98); }); return g;
  }
  function mezclarGenes(rng, a, b) {
    const g = {};
    GENES.forEach(k => {
      const u = rng.f();
      let v = u < 0.3 ? a[k] : u < 0.6 ? b[k] : (w => a[k] * w + b[k] * (1 - w))(0.3 + 0.4 * rng.f());
      v += rng.norm(0, 0.05);
      if (rng.f() < 0.04) v += rng.norm(0, 0.2);          // mutación
      g[k] = clamp(v, 0.02, 0.98);
    });
    return g;
  }
  function talentoNuevo(rng, padres) {
    const t = {};
    STATS.forEach(s => { const h = padres.length ? padres.reduce((x, p) => x + p.talento[s], 0) / padres.length : 0; t[s] = clamp(rng.norm(0, 5.5) + 0.25 * h, -15, 15); });
    return t;
  }
  /* Quien suma mucho en velocidad, resistencia y ancas se rompe más: frena que todo el mundo acabe perfecto */
  const fragilidad = c => 0.6 + 2.0 * Math.max(0, c.genes.pat + c.genes.pul + c.genes.mus - 1.5);
  const edadAnios = (n, c) => (n - c.nac) / C.ANIO;
  const edadMult = a => (a < 1 ? 0.86 : a < 2.5 ? 0.93 + 0.07 * (a - 1) / 1.5 : a <= 5 ? 1 : Math.max(0.8, 1 - 0.045 * (a - 5)));
  function statsBase(c) {
    const o = {}; STATS.forEach(s => { o[s] = clamp(puntos(c.genes[GEN_STAT[s]]) + c.talento[s] + c.perm[s], 8, 100); }); return o;
  }
  function perfilDistancia(c) {
    const d = puntos(c.genes.pul) - puntos(c.genes.pat);
    return d <= -10 ? "velocista" : d >= 10 ? "fondista" : "milero";
  }
  const estiloTexto = r => (r > 0.66 ? "va al frente" : r < 0.34 ? "remonta desde atrás" : "corre a media tabla");

  function nuevaCriatura(m, rng, opc) {
    const N = raiz.HipodromoNombres;
    const sexo = opc.sexo || (rng.f() < 0.5 ? "m" : "f");
    const padres = opc.padres || [];
    const genes = padres.length === 2 ? mezclarGenes(rng, padres[0].genes, padres[1].genes) : genesFundador(rng, opc.media || 0.5);
    const nom = N.nombrar(rng, { sexo, padres, usados: m.nombres, homenaje: opc.homenaje });
    const c = {
      id: ++m.sigId, nombre: nom.nombre, sexo, nac: opc.nac, genes,
      capa: padres.length === 2 ? (rng.f() < 0.7 ? rng.pick(padres).capa : rng.f()) : rng.f(),
      manchas: padres.length === 2 ? clamp((padres[0].manchas + padres[1].manchas) / 2 + rng.norm(0, 0.2), 0, 1) : rng.f(),
      talento: talentoNuevo(rng, padres), perm: { vel: 0, res: 0, ace: 0, agi: 0, tem: 0 },
      ritmo: 0, estado: "activo", gen: padres.length === 2 ? Math.max(padres[0].gen || 1, padres[1].gen || 1) + 1 : 1, gp: 0, muerte: null,
      padre: padres[0] ? { id: padres[0].id, nombre: padres[0].nombre } : null,
      madre: padres[1] ? { id: padres[1].id, nombre: padres[1].nombre } : null,
      rating: C.RATING_INICIAL, salidas: 0, vic: 0, seg: 0, ter: 0, premios: 0, racha: 0,
      ultima: -999, fatiga: 0, forma: 0, lesion: null, hist: [], suelos: {}, crias: 0, ultimaCria: -999
    };
    const h = padres.length ? padres.reduce((x, p) => x + p.ritmo, 0) / padres.length : 0.5;
    c.ritmo = clamp(0.5 + 0.35 * (genes.mus - genes.pul) + 0.3 * (h - 0.5) + rng.norm(0, 0.22), 0, 1);
    return c;
  }

  /* ---------------------------------------------------------------- condiciones de la pista y la carrera */
  function condiciones(prog, w) {
    const pista = PISTAS[prog.pista], cl = CLIMAS[w];
    const base = prog.mojadoPrevio * 0.7 + cl.aporte;
    const hum = clamp(base * (1 - 0.5 * pista.drenaje), 0, 1);
    return { clima: w, base, hum, temp: cl.temp, ruido: cl.ruido, incid: cl.incid, dist: prog.dist, nSeg: prog.dist / 100,
      curvas: pista.curvas, costeTramo: 1 + 0.15 * pista.cuestas, estadoPista: etiquetaPista(hum) };
  }
  /* Valores de una criatura ese día (en puntos de 25 a 100) */
  function efectivo(m, c, cond, puerta) {
    const b = statsBase(c), em = edadMult(edadAnios(m.n, c));
    const exp = Math.min(1, c.salidas / 16);
    const pref = (c.genes.pez - 0.5) * 2, abrigo = (c.genes.pel - 0.5) * 2;
    const terreno = 16 * pref * (cond.hum - 0.3) / 0.6;
    const clima = -15 * abrigo * cond.temp;
    return {
      id: c.id, puerta,
      vel: b.vel * em - 0.35 * c.fatiga + 12 * c.forma + terreno + clima,
      res: b.res * em - 0.35 * c.fatiga + 6 * c.forma + 0.8 * clima,
      ace: b.ace * em - 0.20 * c.fatiga + 4 * c.forma,
      agi: b.agi * em - 0.15 * c.fatiga,
      tem: b.tem + 10 * exp,
      ritmo: c.ritmo, frag: fragilidad(c), fatiga: c.fatiga
    };
  }
  const esCurva = (s, curvas) => ((s * 0.618034) % 1) < curvas;
  const probLesion = (e, cond) => 0.010 * e.frag * (1 + e.fatiga / 60) * (1 + 0.8 * cond.hum) * Math.sqrt(cond.dist / 1600) * cond.incid;

  /* ---------------------------------------------------------------- la carrera
     Cada tramo es de 100 m. Una criatura reparte su energía con el esfuerzo que aguanta hasta la meta
     (cuanto más larga la carrera, más pesa la resistencia; en las cortas manda la velocidad), y se equivoca
     un poco según su temple. Devuelve, por corredor, el tiempo de meta, los tiempos acumulados por tramo,
     los tropiezos y si se lesionó. */
  function simular(rng, es, cond) {
    const nSeg = cond.nSeg, nE = es.length;
    const lideres = es.filter(e => e.ritmo > 0.66).length;
    const salida = [];
    for (let k = 0; k < nE; k++) {
      const e = es[k];
      const dia = rng.norm(0, AJUSTE.SIG_DIA) * (1.25 - e.tem / 200);                  // cómo amanece ese día: toda la carrera, no solo un tramo
      const vmax = (AJUSTE.VEL_BASE + AJUSTE.VEL_K * e.vel) * (1 + dia);
      let tanque = 10.5 + 0.075 * e.res;
      const sig = AJUSTE.SIG_TRAMO * (1.5 - e.tem / 100) * cond.ruido;
      const lesTramo = rng.f() < probLesion(e, cond) ? rng.i(1, Math.max(1, nSeg - 1)) : -1;
      const trafico = (1 - e.ritmo) * (nE - 1) / 10 * Math.max(0, 1 - e.agi / 130) * rng.f() * 0.008;
      const ventajaPuerta = ((nE / 2 - e.puerta + 0.5) / nE) * 0.004 * cond.curvas;
      const pTrop = 0.0035 * (1 + 1.2 * cond.hum) * Math.max(0.1, 1.15 - e.agi / 100) * cond.incid;
      const tramos = new Array(nSeg), tropiezos = [];
      let t = 0, tropiezo = 0;
      for (let s = 0; s < nSeg; s++) {
        const p = (s + 0.5) / nSeg;
        let ec = clamp(Math.pow(Math.max(0.02, tanque) / ((nSeg - s) * cond.costeTramo), 1 / AJUSTE.K_COSTE), 0.55, 1.0);
        let forma = 1 + 0.06 * (e.ritmo - 0.5) * (1 - 2 * p);
        if (lideres > 1 && e.ritmo > 0.66 && p < 0.4) forma *= 1 + 0.01 * (lideres - 1);   // duelo de líderes
        let v = vmax * clamp(ec * forma * (1 + rng.norm(0, sig)), 0.5, 1.06);
        if (s < 3) v *= 1 - 0.06 * (1 - e.ace / 100) * (1 - s / 3);
        if (esCurva(s, cond.curvas)) v *= 1 - 0.03 * (1 - e.agi / 100);
        if (p > 0.3 && p < 0.8) v *= 1 - trafico;
        v *= 1 + ventajaPuerta;
        if (tropiezo > 0) { v *= 0.95; tropiezo--; }
        else if (rng.f() < pTrop) { tropiezo = 1; v *= 0.95; tropiezos.push(s); }
        if (lesTramo >= 0 && s >= lesTramo) v *= 0.55;
        tanque -= Math.pow(v / vmax, AJUSTE.K_COSTE) * cond.costeTramo;
        if (tanque < 0) v *= Math.max(0.75, 1 + tanque * 0.12);
        t += 100 / v;
        tramos[s] = t;
      }
      salida.push({ k, id: e.id, puerta: e.puerta, t, tramos, tropiezos, lesTramo });
    }
    return salida;
  }
  const ordenLlegada = salida => salida.slice().sort((a, b) => a.t - b.t || a.puerta - b.puerta);

  /* ---------------------------------------------------------------- probabilidades, cuotas y apuestas */
  function muestraClima(rng, fila) {
    let x = rng.f(), i = 0;
    for (; i < fila.length - 1; i++) { x -= fila[i]; if (x < 0) break; }
    return ESTADOS_CLIMA[i];
  }
  function montecarlo(m, prog, cs, sims) {
    const rng = crearRng(m.semilla, "mc", prog.n);
    const nE = cs.length, gan = new Array(nE).fill(0), pod = new Array(nE).fill(0);
    const fila = MARKOV[prog.climaPrevio];
    for (let j = 0; j < sims; j++) {
      const cond = condiciones(prog, muestraClima(rng, fila));
      const es = cs.map((c, k) => efectivo(m, c, cond, prog.entrantes[k].puerta));
      const orden = ordenLlegada(simular(rng, es, cond));
      gan[orden[0].k]++;
      for (let q = 0; q < Math.min(3, nE); q++) pod[orden[q].k]++;
    }
    return { gan: gan.map(x => (x + 1) / (sims + nE)), pod: pod.map(x => x / sims) };
  }
  /* El mercado: mezcla lo que de verdad pasaría con la reputación (rating público), le suma un error que
     es mayor con las criaturas que casi no han corrido, y lo normaliza. La cuota descuenta el margen de la casa. */
  function mercado(m, prog, cs, pReal) {
    const rng = crearRng(m.semilla, "mercado", prog.n);
    const rep = cs.map(c => Math.exp((c.rating - C.RATING_INICIAL) / AJUSTE.ESCALA_REP));
    const sr = rep.reduce((a, b) => a + b, 0);
    const w = cs.map((c, i) => {
      const sig = AJUSTE.SIG_MERCADO + 0.30 / (1 + c.salidas / 2);
      const lg = AJUSTE.EXP_VERDAD * Math.log(pReal.gan[i]) + (1 - AJUSTE.EXP_VERDAD) * Math.log(rep[i] / sr) + sig * rng.norm() - sig * sig / 2;   // el último término evita que el ruido infle a las desconocidas
      return Math.exp(AJUSTE.AGUDEZA * lg);
    });
    const sw = w.reduce((a, b) => a + b, 0);
    const pub = w.map(x => x / sw);
    // podio: la probabilidad real de acabar entre los tres primeros, deformada en parte como la de ganar y repartida para que sume 3
    let p3 = pReal.pod.map((p, i) => Math.max(0.005, p) * Math.pow(pub[i] / pReal.gan[i], 0.6));
    for (let it = 0; it < 4; it++) { const sq = p3.reduce((a, b) => a + b, 0); p3 = p3.map(x => Math.min(0.97, x * 3 / sq)); }
    p3 = p3.map((x, i) => Math.max(x, pub[i]));
    const cuota = (p, margen) => redondearCuota(clamp(1 / (p * (1 + margen)), C.CUOTA_MIN, C.CUOTA_MAX));
    return { pub, gan: pub.map(p => cuota(p, C.MARGEN)), pod: p3.map(p => cuota(p, C.MARGEN)) };
  }
  /* cuota de la exacta (primero y segundo en ese orden) a partir de las probabilidades del público */
  function cuotaExacta(pub, a, b) {
    const pa = pub[a], pb = pub[b];
    return redondearCuota(clamp(1 / ((pa * pb / (1 - pa)) * (1 + C.MARGEN_EXACTA)), C.CUOTA_MIN, C.CUOTA_MAX));
  }

  const TIPOS_APUESTA = {
    ganador: { nombre: "Ganador", texto: "Acierta quién cruza primero la meta." },
    podio: { nombre: "Podio", texto: "Acierta que la criatura acaba entre las tres primeras." },
    exacta: { nombre: "Exacta", texto: "Acierta primero y segundo, en ese orden." }
  };
  /* Estado de una carrera programada para un instante (milisegundos) */
  function ventana(prog, ahora) {
    if (ahora < prog.cierre) return "abierta";
    if (ahora < prog.hora) return "cerrada";
    if (ahora < prog.hora + C.DURACION_SEG * 1000) return "corriendo";
    return "terminada";
  }
  function cuotaApuesta(prog, tipo, sel) {
    const ids = prog.entrantes.map(e => e.id);
    if (tipo === "ganador") { const i = ids.indexOf(sel); return i < 0 ? null : prog.entrantes[i].gan; }
    if (tipo === "podio") { const i = ids.indexOf(sel); return i < 0 ? null : prog.entrantes[i].pod; }
    if (tipo === "exacta") {
      const a = ids.indexOf(sel[0]), b = ids.indexOf(sel[1]);
      if (a < 0 || b < 0 || a === b) return null;
      const pub = ids.map(id => prog.mercado[id]);
      return cuotaExacta(pub, a, b);
    }
    return null;
  }
  /* Una apuesta es { n, tipo, sel, monto, cuota }. Devuelve { gana, pago } con el resultado publicado. */
  function liquidar(ap, res) {
    const orden = res.llegada.map(l => l.id);
    let gana = false;
    if (ap.tipo === "ganador") gana = orden[0] === ap.sel;
    else if (ap.tipo === "podio") gana = orden.indexOf(ap.sel) >= 0 && orden.indexOf(ap.sel) < 3;
    else if (ap.tipo === "exacta") gana = orden[0] === ap.sel[0] && orden[1] === ap.sel[1];
    return { gana, pago: gana ? redondea(ap.monto * ap.cuota, 2) : 0 };
  }

  /* ---------------------------------------------------------------- inscripciones */
  function elegibles(m, relajar) {
    return m.vivos.filter(c => edadAnios(m.n, c) >= C.DEBUT && !c.lesion && c.fatiga <= (relajar ? 90 : C.FATIGA_MAX) && m.n - c.ultima >= (relajar ? 1 : C.DESCANSO_MIN));
  }
  /* Los entrenadores meten a cada criatura en la categoría que le toca (por rating), descansada y con la distancia que le va */
  function inscribir(m, rng, grado, dist) {
    const G = GRADOS[grado];
    let pool = elegibles(m, false);
    if (pool.length < C.CAMPO_MIN + 2) pool = elegibles(m, true);
    const campo = Math.min(pool.length, rng.i(G.campo[0], G.campo[1]));
    if (campo < 3) return [];
    const media = pool.reduce((a, c) => a + c.rating, 0) / pool.length;
    const sd = Math.sqrt(pool.reduce((a, c) => a + (c.rating - media) * (c.rating - media), 0) / pool.length) || 1;
    const pesos = pool.map(c => {
      const z = (c.rating - media) / sd;
      let w = grado === "corriente" ? Math.exp(-0.5 * Math.pow((z + 0.2) / 0.8, 2)) : Math.exp(G.pesoRating * z);
      if (grado === "novatos") w *= (c.salidas <= 3 ? 5 : 1) * (c.vic === 0 ? 2 : 0.5);
      const descanso = Math.min(1, (m.n - c.ultima - C.DESCANSO_MIN + 1) / 6);
      const d = puntos(c.genes.pul) - puntos(c.genes.pat);
      const idealDist = 1700 + 1100 * clamp(d / 30, -1, 1);
      const encaje = Math.exp(-Math.pow((dist - idealDist) / 1500, 2));
      return w * descanso * (1 - c.fatiga / 100) * (0.6 + 0.4 * encaje);
    });
    const elegidos = [];
    const libres = pool.map((c, i) => i);
    while (elegidos.length < campo && libres.length) {
      const total = libres.reduce((a, i) => a + pesos[i], 0);
      let x = rng.f() * total, k = 0;
      for (; k < libres.length - 1; k++) { x -= pesos[libres[k]]; if (x < 0) break; }
      elegidos.push(pool[libres[k]]); libres.splice(k, 1);
    }
    return rng.baraja(elegidos);
  }
  const buscar = (m, id) => m.vivos.find(c => c.id === id) || m.criadores.find(c => c.id === id) || null;

  /* ---------------------------------------------------------------- rumores (65 % de las veces aciertan) */
  const RUMORES_BUENOS = ["En la cuadra aseguran que {n} está en el mejor momento de su vida.", "Un mozo jura que {n} no ha dejado ni un grano en el plato.", "Dicen que {n} ha entrenado con ganas toda la semana.", "Se comenta que {n} llega con las patas ligeras."];
  const RUMORES_MALOS = ["Se comenta que {n} amaneció con mala cara.", "Un mozo asegura que {n} cojeó un poco en el calentamiento.", "Corre el rumor de que {n} no durmió bien.", "Dicen que {n} anda con la cabeza en otra parte."];
  function rumores(rng, cs) {
    const out = [];
    const n = rng.peso([[0, 0.25], [1, 0.45], [2, 0.30]]);
    const usados = new Set();
    for (let r = 0; r < n; r++) {
      const buenos = rng.f() < 0.5, cierto = rng.f() < 0.65;
      const coincide = c => (buenos ? c.forma >= 0.35 : c.forma <= -0.35);
      let candidatos = cs.filter(c => !usados.has(c.id) && (cierto ? coincide(c) : !coincide(c)));
      if (!candidatos.length) continue;
      const c = rng.pick(candidatos); usados.add(c.id);
      out.push({ id: c.id, texto: rng.pick(buenos ? RUMORES_BUENOS : RUMORES_MALOS).replace("{n}", c.nombre), veraz: cierto, bueno: buenos });
    }
    return out;
  }

  /* ---------------------------------------------------------------- programar una carrera */
  const horaDe = (m, n) => m.t0 + n * C.MINUTOS * 60000;
  function pistaDeJornada(semilla, jornada) {
    const rng = crearRng(semilla, "pista", jornada);
    const ant = jornada > 0 ? crearRng(semilla, "pista", jornada - 1) : null;
    const previa = ant ? IDS_PISTAS[Math.floor(ant.f() * IDS_PISTAS.length)] : null;
    let id; do { id = IDS_PISTAS[Math.floor(rng.f() * IDS_PISTAS.length)]; } while (id === previa && IDS_PISTAS.length > 1 && rng.f() < 0.9);
    return id;
  }

  /* Fija inscritos, pronóstico, cuotas y resultado de la carrera m.n. No cambia el estado de las criaturas. */
  function programar(m, opc) {
    opc = opc || {};
    const n = m.n, rng = crearRng(m.semilla, "prog", n);
    const N = raiz.HipodromoNombres;
    const grado = CICLO[n % C.JORNADA];
    const dist = rng.peso(DISTANCIAS[grado]);
    const cs = inscribir(m, rng, grado, dist);
    const jornada = Math.floor(n / C.JORNADA);
    const prog = {
      n, hora: horaDe(m, n), cierre: horaDe(m, n) - C.CIERRE_SEG * 1000,
      grado, nombre: N.nombrarCarrera(crearRng(m.semilla, "nombre-carrera", n), grado),
      pista: pistaDeJornada(m.semilla, jornada), dist, bolsa: GRADOS[grado].bolsa,
      climaPrevio: m.clima.estado,
      mojadoPrevio: (n % C.JORNADA === 0 && n > 0) ? m.clima.mojado * 0.5 : m.clima.mojado,
      pron: ESTADOS_CLIMA.map((w, i) => ({ clima: w, prob: MARKOV[m.clima.estado][i] })),
      entrantes: cs.map((c, i) => ({ id: c.id, nombre: c.nombre, puerta: i + 1, gan: 0, pod: 0 })),
      mercado: {}, rumores: [], secreto: null
    };
    if (cs.length < 3) { prog.suspendida = true; prog.secreto = { clima: m.clima.estado, base: m.clima.mojado, res: null }; m.proxima = prog; return prog; }

    const pReal = montecarlo(m, prog, cs, opc.sims || C.SIMS);
    const mer = mercado(m, prog, cs, pReal);
    prog.entrantes.forEach((e, i) => { e.gan = mer.gan[i]; e.pod = mer.pod[i]; prog.mercado[e.id] = redondea(mer.pub[i], 4); });
    const rr = rumores(crearRng(m.semilla, "rumores", n), cs);
    prog.rumores = rr.map(x => ({ id: x.id, texto: x.texto }));

    // la carrera de verdad
    const clima = muestraClima(crearRng(m.semilla, "clima", n), MARKOV[m.clima.estado]);
    const cond = condiciones(prog, clima);
    const es = cs.map((c, k) => efectivo(m, c, cond, prog.entrantes[k].puerta));
    const salida = simular(crearRng(m.semilla, "carrera", n), es, cond);
    const orden = ordenLlegada(salida);
    const t0 = orden[0].t, vProm = prog.dist / t0;
    const favorito = prog.entrantes.reduce((a, e) => (e.gan < a.gan ? e : a), prog.entrantes[0]).id;
    const llegada = orden.map((o, q) => {
      const c = cs[o.k], e = prog.entrantes[o.k];
      return { id: c.id, nombre: c.nombre, puerta: o.puerta, pos: q + 1, t: redondea(o.t, 2), margen: redondea((o.t - t0) * vProm / 2.4, 2), cuota: e.gan,
        premio: q < REPARTO.length ? Math.round(prog.bolsa * REPARTO[q]) : 0, lesion: o.lesTramo >= 0 ? true : undefined };
    });
    const incidentes = [];
    salida.forEach(o => { o.tropiezos.forEach(s => incidentes.push({ id: o.id, tramo: s, tipo: "tropiezo" })); if (o.lesTramo >= 0) incidentes.push({ id: o.id, tramo: o.lesTramo, tipo: "lesion" }); });
    const tramos = {}; salida.forEach(o => { tramos[o.id] = o.tramos.map(x => redondea(x, 2)); });
    const res = {
      n, hora: prog.hora, nombre: prog.nombre, grado, pista: prog.pista, dist: prog.dist, clima, humedad: redondea(cond.hum, 2), estadoPista: cond.estadoPista,
      bolsa: prog.bolsa, favorito, llegada, tramos, incidentes: incidentes.sort((a, b) => a.tramo - b.tramo),
      fotoMeta: orden.length > 1 && (orden[1].t - orden[0].t) * vProm / 2.4 < 0.06
    };
    prog.secreto = { clima, base: cond.base, res, pReal: { gan: pReal.gan.map(x => redondea(x, 4)), pod: pReal.pod.map(x => redondea(x, 4)) }, rumores: rr };
    m.proxima = prog;
    return prog;
  }
  /* Lo que se puede publicar de la carrera programada (sin el resultado ni lo oculto) */
  function programaPublico(prog) {
    const p = Object.assign({}, prog); delete p.secreto; return p;
  }

  /* ---------------------------------------------------------------- noticias */
  const elige = (rng, lista) => rng.pick(lista);
  function noticia(m, tipo, titulo, texto, ids, n) { return { n: n == null ? m.n : n, hora: horaDe(m, n == null ? m.n : n), tipo, titulo, texto, ids: ids || [] }; }

  function noticiaResultado(m, prog, res, rng) {
    const g = res.llegada[0], s = res.llegada[1], t = res.llegada[2];
    const pista = PISTAS[prog.pista].nombre, cuota = fmtCuota(g.cuota);
    const fav = res.llegada.find(l => l.id === res.favorito);
    let titulo;
    if (res.fotoMeta) titulo = elige(rng, [`Foto de meta en ${pista}: ${g.nombre} gana por un hocico`, `${g.nombre} se lleva ${res.nombre} en la foto de meta`]);
    else if (g.cuota >= 12) titulo = elige(rng, [`Sorpresa en ${pista}: ${g.nombre} gana pagando ${cuota}`, `Batacazo: ${g.nombre} (${cuota}) se lleva ${res.nombre}`]);
    else if (fav && fav.pos >= 5 && fav.id !== g.id) titulo = `Se hunde el favorito: ${fav.nombre} llega ${fav.pos}º y gana ${g.nombre}`;
    else titulo = elige(rng, [`${g.nombre} gana ${res.nombre}`, `${res.nombre}: victoria de ${g.nombre}`, `${g.nombre} se impone en ${pista}`]);
    const texto = `${g.nombre} cruzó primero en ${fmtTiempo(g.t)} sobre ${res.dist} m, con el terreno ${res.estadoPista} y ${CLIMAS[res.clima].texto}. Ganó ${fmtMargen(s.margen)} a ${s.nombre}${t ? `, con ${t.nombre} tercero` : ""}. Pagó ${cuota} a ganador entre ${res.llegada.length} corredores.`;
    return noticia(m, "resultado", titulo, texto, [g.id, s.id], res.n);
  }

  /* ---------------------------------------------------------------- aplicar el resultado al mundo */
  const SUELOS = ["firme", "bueno", "blando", "pesado"];
  function elegirLesion(rng, c, n) {
    const gr = rng.peso([["leve", 0.68], ["media", 0.27], ["grave", 0.05]]);
    const tipo = rng.pick(LESIONES[gr]);
    const dur = gr === "leve" ? rng.i(10, 30) : gr === "media" ? rng.i(36, 96) : 0;
    let permanente = null;
    if (gr === "media" && rng.f() < 0.45) { const s = rng.pick(STATS); const p = rng.i(2, 5); c.perm[s] -= p; permanente = { stat: s, puntos: p }; }
    c.lesion = { tipo, gravedad: gr, hasta: n + dur };
    return { gr, tipo, dur, permanente };
  }

  function aplicarResultado(m, prog, res, ev) {
    const rng = crearRng(m.semilla, "efectos", res.n);
    const campo = res.llegada.length;
    const cs = res.llegada.map(l => buscar(m, l.id));
    // rating por parejas (Elo repartido entre todos los rivales)
    const delta = cs.map(() => 0);
    for (let i = 0; i < campo; i++) for (let j = i + 1; j < campo; j++) {
      const e = 1 / (1 + Math.pow(10, (cs[j].rating - cs[i].rating) / 400));
      const d = C.K_RATING * (1 - e) / (campo - 1);
      delta[i] += d; delta[j] -= d;
    }
    res.llegada.forEach((l, q) => {
      const c = cs[q]; if (!c) return;
      c.rating += delta[q];
      c.salidas++; if (q === 0) { c.vic++; if (res.grado === "gran") c.gp++; } else if (q === 1) c.seg++; else if (q === 2) c.ter++;
      c.racha = q === 0 ? c.racha + 1 : 0;
      c.premios += l.premio;
      c.ultima = res.n;
      c.fatiga = Math.min(100, c.fatiga + 12 + 18 * (res.dist / 3000) + 6 * res.humedad);
      c.hist.push({ n: res.n, pos: l.pos, campo, cuota: l.cuota, pista: res.pista, dist: res.dist, clima: res.clima, estadoPista: res.estadoPista, t: l.t });
      if (c.hist.length > C.HISTORIAL) c.hist.shift();
      const sl = c.suelos[res.estadoPista] || (c.suelos[res.estadoPista] = [0, 0, 0]);
      sl[0]++; if (q === 0) sl[1]++; if (q < 3) sl[2]++;
      ev.cambios.add(c.id);
    });
    m.stats.carreras++;
    ev.noticias.push(noticiaResultado(m, prog, res, crearRng(m.semilla, "noticia", res.n, "resultado")));

    const ganador = cs[0];
    if (ganador) {
      if (ganador.vic === 1) ev.noticias.push(noticia(m, "debut", `${ganador.nombre} rompe el hielo`, `${ganador.nombre} gana por primera vez en su carrera, en su salida número ${ganador.salidas}.`, [ganador.id], res.n));
      else if (ganador.racha === 3) ev.noticias.push(noticia(m, "racha", `Tercera seguida para ${ganador.nombre}`, `${ganador.nombre} suma su tercera victoria consecutiva y ya se habla de ella en todas las cuadras.`, [ganador.id], res.n));
      else if (ganador.racha === 5) ev.noticias.push(noticia(m, "racha", `${ganador.nombre} no encuentra rival`, `Cinco victorias seguidas para ${ganador.nombre}. Los entrenadores rivales empiezan a mirar el calendario.`, [ganador.id], res.n));
    }
    // récord de pista y distancia
    const clave = `${res.pista}|${res.dist}`, gt = res.llegada[0].t, ant = m.records[clave];
    if (!ant || gt < ant.t) {
      if (ant && ant.t - gt >= 0.05) ev.noticias.push(noticia(m, "record", `Récord en ${PISTAS[res.pista].nombre}`, `${res.llegada[0].nombre} corre los ${res.dist} m en ${fmtTiempo(gt)}, por debajo de los ${fmtTiempo(ant.t)} de ${ant.nombre}.`, [res.llegada[0].id], res.n));
      m.records[clave] = { t: gt, id: res.llegada[0].id, nombre: res.llegada[0].nombre, n: res.n };
    }
    // lesiones durante la carrera
    res.incidentes.filter(i => i.tipo === "lesion").forEach(i => {
      const c = buscar(m, i.id); if (!c || c.lesion) return;
      const L = elegirLesion(rng, c, res.n);
      m.stats.lesiones++;
      const dur = L.gr === "grave" ? "y no volverá a correr" : `y estará fuera unas ${L.dur} carreras`;
      ev.noticias.push(noticia(m, "lesion", `Se lesiona ${c.nombre}`, `${c.nombre} sufre ${L.tipo} (${L.gr}) en ${PISTAS[res.pista].nombre} ${dur}.${L.permanente ? " Los veterinarios temen que le quede secuela." : ""}`, [c.id], res.n));
      if (L.gr === "grave") ev.retirarPor.set(c.id, "lesión grave");
      ev.cambios.add(c.id);
    });
    m.clima = { estado: res.clima, mojado: clamp(prog.secreto.base, 0, 1.3) };
  }

  /* ---------------------------------------------------------------- vida del mundo entre carrera y carrera */
  const esLeyenda = c => c.vic >= 14 || c.gp >= 3;

  function retirar(m, c, motivo, ev, rng) {
    const i = m.vivos.indexOf(c); if (i < 0) return;
    m.vivos.splice(i, 1);
    const criador = c.salidas >= 4 && (c.rating >= 1520 || c.vic >= 3) && !(c.lesion && c.lesion.gravedad === "grave" && rng.f() < 0.5);
    c.estado = criador ? "criador" : "retirado";
    c.lesion = null;
    if (criador) {
      m.criadores.push(c);
      if (m.criadores.length > C.MAX_CRIADORES) { const viejo = m.criadores.shift(); viejo.estado = "retirado"; ev.bajas.push(viejo); ev.cambios.add(viejo.id); }
    } else ev.bajas.push(c);
    m.stats.retirados++;
    ev.cambios.add(c.id);
    const palmares = c.salidas ? `tras ${c.salidas} salidas y ${c.vic} victorias` : "sin llegar a debutar";
    const leyenda = esLeyenda(c);
    ev.noticias.push(noticia(m, "retiro", leyenda ? `Fin de una era: se retira ${c.nombre}` : `Se retira ${c.nombre}`, `${c.nombre} deja las pistas ${palmares}${c.gp ? `, con ${c.gp} Gran${c.gp > 1 ? "des" : ""} Premio${c.gp > 1 ? "s" : ""}` : ""}${motivo ? ` (${motivo})` : ""}.${criador ? " Pasa a la cría." : ""}`, [c.id]));
  }

  const CAUSAS_MUERTE = ["una infección que no se pudo cortar", "un golpe de calor en los establos", "una caída durante el entrenamiento", "una fiebre repentina", "un accidente en la cuadra"];
  function fallecer(m, c, ev, rng) {
    const lista = m.vivos.indexOf(c) >= 0 ? m.vivos : m.criadores;
    const i = lista.indexOf(c); if (i < 0) return;
    lista.splice(i, 1);
    c.estado = "fallecido"; c.muerte = m.n; c.lesion = null;
    ev.bajas.push(c); ev.cambios.add(c.id);
    m.stats.muertes++;
    const causa = rng.pick(CAUSAS_MUERTE);
    const palmares = c.salidas ? `Dejó ${c.salidas} salidas, ${c.vic} victorias y ${c.crias} crías.` : "Todavía no había debutado.";
    ev.noticias.push(noticia(m, "muerte", esLeyenda(c) ? `Adiós a una leyenda: ${c.nombre}` : `Fallece ${c.nombre}`, `${c.nombre} murió por ${causa}. ${palmares}`, [c.id]));
  }

  /* Lo que le pasa a una criatura lejos de la pista. Casi siempre es leve; pocas veces es definitivo. */
  function incidenteDeEstablo(m, c, ev, rng) {
    const tipo = rng.peso([["entrenamiento", 0.38], ["enfermedad", 0.30], ["establo", 0.18], ["fuga", 0.08], ["muerte", 0.06]]);
    m.stats.incidentes++;
    if (tipo === "muerte") { fallecer(m, c, ev, rng); return; }
    if (tipo === "fuga") {
      c.lesion = { tipo: "desaparecido", gravedad: "leve", hasta: m.n + rng.i(30, 160) };
      ev.cambios.add(c.id);
      ev.noticias.push(noticia(m, "fuga", `${c.nombre} se escapa de los establos`, `${c.nombre} amaneció fuera de su cuadra y nadie sabe adónde ha ido. Se le busca.`, [c.id]));
      return;
    }
    const L = elegirLesion(rng, c, m.n);
    ev.cambios.add(c.id);
    if (L.gr === "grave") { ev.retirarPor.set(c.id, "lesión grave"); }
    const donde = tipo === "entrenamiento" ? "durante el entrenamiento de esta mañana" : tipo === "enfermedad" ? "tras caer enferma esta semana" : "en un accidente en los establos";
    const verbo = tipo === "enfermedad" ? `sufre ${L.tipo}` : `se lesiona (${L.tipo})`;
    ev.noticias.push(noticia(m, tipo === "enfermedad" ? "enfermedad" : "accidente", tipo === "enfermedad" ? `${c.nombre} cae enferma` : `Accidente en los establos: ${c.nombre}`, `${c.nombre} ${verbo} ${donde}${L.gr === "grave" ? " y no volverá a correr" : `; estará fuera unas ${L.dur} carreras`}.`, [c.id]));
  }

  function elegirPadres(m, rng) {
    const edad = c => edadAnios(m.n, c);
    const machos = m.criadores.filter(c => c.sexo === "m" && edad(c) < 12);
    const hembras = m.criadores.filter(c => c.sexo === "f" && edad(c) < 12 && m.n - c.ultimaCria >= C.GESTACION && c.crias < 8);
    if (!machos.length || !hembras.length) return null;
    const prestigio = c => Math.pow(Math.max(0.2, (c.rating - 1400) / 100 + c.vic * 0.15 + 1), 1.5);
    const pick = lista => { const tot = lista.reduce((a, c) => a + prestigio(c), 0); let x = rng.f() * tot; for (const c of lista) { x -= prestigio(c); if (x < 0) return c; } return lista[lista.length - 1]; };
    for (let k = 0; k < 6; k++) {
      const p = pick(machos), q = pick(hembras);
      const parientes = (p.padre && q.padre && p.padre.id === q.padre.id) || (p.madre && q.madre && p.madre.id === q.madre.id) || (q.padre && q.padre.id === p.id) || (q.madre && q.madre.id === p.id) || (p.padre && p.padre.id === q.id) || (p.madre && p.madre.id === q.id);
      if (!parientes || k === 5) return [p, q];
    }
    return null;
  }

  function nacer(m, rng, ev) {
    const padres = rng.f() < C.INMIGRANTES ? null : elegirPadres(m, rng);
    const leyendas = padres ? padres.filter(esLeyenda) : [];
    const homenaje = leyendas.length && rng.f() < C.HOMENAJE ? rng.pick(leyendas).nombre : null;
    const c = nuevaCriatura(m, rng, { nac: m.n, padres: padres || [], media: 0.5, homenaje });
    m.vivos.push(c);
    m.stats.nacidos++;
    ev.cambios.add(c.id); ev.nacidos.push(c.id);
    if (padres) { padres[1].ultimaCria = m.n; padres[1].crias++; padres[0].crias++; ev.cambios.add(padres[0].id); ev.cambios.add(padres[1].id); }
    const hijo = c.sexo === "f" ? "hija" : "hijo";
    ev.noticias.push(noticia(m, "nacimiento", homenaje ? `Una nueva generación: nace ${c.nombre}` : `Nace ${c.nombre}`, padres ? `${c.nombre}, ${hijo} de ${padres[0].nombre} y ${padres[1].nombre}, llega al mundo con ${CUERPO.pat.niveles[nivelDe(c.genes.pat) - 1].toLowerCase()} y ${CUERPO.pul.niveles[nivelDe(c.genes.pul) - 1].toLowerCase()}.` : `${c.nombre} llega a las cuadras de otra región y se apunta al calendario.`, [c.id]));
  }

  function cicloVital(m, ev) {
    const rng = crearRng(m.semilla, "vida", m.n);
    const porAnio = 144 / C.ANIO;     // los riesgos de cada carrera están medidos para un año de 144 carreras; si el año cambia, se reescalan
    // recuperación
    m.vivos.forEach(c => {
      c.fatiga = Math.max(0, c.fatiga - 2 * (0.75 + 0.5 * c.genes.mus));       // las ancas fuertes también recuperan mejor
      c.forma = clamp(0.97 * c.forma + rng.norm(0, 0.19), -2.2, 2.2);
      if (c.lesion && m.n + 1 >= c.lesion.hasta && c.lesion.gravedad !== "grave") {
        if (c.lesion.tipo === "desaparecido") ev.noticias.push(noticia(m, "regreso", `${c.nombre} aparece sana y salva`, `${c.nombre} volvió a los establos como si nada. Nadie sabe dónde pasó estos días.`, [c.id]));
        c.lesion = null; ev.cambios.add(c.id);
      }
    });
    // incidentes fuera de la pista (no todo pasa corriendo)
    m.vivos.slice().forEach(c => {
      if (c.lesion || edadAnios(m.n, c) < 0.5 || ev.retirarPor.has(c.id)) return;
      if (rng.f() < C.INCIDENTE_ESTABLO * porAnio * fragilidad(c) / 0.75) incidenteDeEstablo(m, c, ev, rng);
    });
    // retiros
    m.vivos.slice().forEach(c => {
      if (ev.retirarPor.has(c.id)) { retirar(m, c, ev.retirarPor.get(c.id), ev, rng); return; }
      const a = edadAnios(m.n, c);
      let h = 0;
      if (a > 5) h += 0.0012 * porAnio * Math.pow(a - 5, 1.5);
      if (c.salidas >= 14 && c.rating < 1400) h += 0.01 * porAnio;
      const perm = -(c.perm.vel + c.perm.res + c.perm.ace + c.perm.agi + c.perm.tem);
      if (perm >= 9) h += 0.02 * porAnio;
      if (a >= 9) h = 1;
      if (h > 0 && rng.f() < h) retirar(m, c, a >= 9 ? "por edad" : perm >= 9 ? "por las secuelas" : a > 5 ? "por edad" : "bajo rendimiento", ev, rng);
    });
    m.criadores = m.criadores.filter(c => { if (edadAnios(m.n, c) <= 12) return true; c.estado = "retirado"; ev.bajas.push(c); ev.cambios.add(c.id); return false; });
    // crías
    if (m.n % C.CRIA_CADA === 0) {
      const falta = C.OBJETIVO - m.vivos.length;
      const k = poisson(rng, Math.max(0, falta / 6 + C.OBJETIVO / (7 * C.ANIO) * C.CRIA_CADA));
      for (let i = 0; i < Math.min(k, 5); i++) nacer(m, rng, ev);
    }
  }

  /* ---------------------------------------------------------------- perfil público de una criatura */
  function estrellas(c) {
    if (!c.salidas) return null;
    const rng = crearRng(c.id, "estrellas", c.salidas);
    const z = (c.rating - C.RATING_INICIAL) / 110;
    return clamp(Math.round((3 + 1.2 * z + rng.norm(0, 1.0 / Math.sqrt(1 + c.salidas / 2.5))) * 2) / 2, 0.5, 5);
  }
  /* Etapa de la vida según la edad en años: el dibujo puede cambiar con ella */
  const etapaDe = (edad, estado) => (estado === "fallecido" ? "fallecido" : estado === "retirado" || estado === "criador" ? "retirado" : edad < 0.5 ? "cría" : edad < 1 ? "potro" : edad < 2.5 ? "joven" : edad <= 5 ? "adulto" : "veterano");
  /* Cuerpos tipo, por su silueta */
  function arquetipo(c) {
    const g = c.genes;
    if (g.mus >= 0.7 && g.mus >= g.pat && g.mus >= g.pul) return "Saltador";
    if (g.pat >= 0.62 && g.pul <= 0.5) return "Flecha";
    if (g.pul >= 0.62 && g.pat <= 0.45) return "Tanque";
    if (g.pul >= 0.62) return "Maratonista";
    return null;
  }
  /* Proporciones de 0 a 1 para dibujar la criatura. Las cuatro más importantes vienen de los genes; cuello y cabeza son adorno (salen del id). */
  function silueta(c) {
    const g = c.genes, r = crearRng(c.id, "silueta"), f = x => redondea(clamp(x, 0, 1), 2);
    return {
      altura: f(g.tam), longitud_patas: f(g.pat), tamano_pecho: f(g.pul), tamano_cadera: f(g.mus), tamano_cola: f(g.col),
      longitud_cuerpo: f(0.6 * g.pul + 0.4 * g.tam), anchura_torso: f(0.7 * g.pul + 0.3 * (1 - g.pat)), grosor_patas: f(0.6 * g.pez + 0.4 * (1 - g.pat)),
      pelaje: f(g.pel), mirada: f(g.ojo), longitud_cuello: f(0.5 + 0.5 * (g.tam - 0.5) + r.norm(0, 0.15)), tamano_cabeza: f(0.5 + r.norm(0, 0.18))
    };
  }
  const SECUELAS = { vel: "cojea un poco de una pata trasera", res: "respira corto después de esforzarse", ace: "arranca despacio desde la puerta", agi: "tiene la columna rígida en las curvas", tem: "quedó nerviosa tras el accidente" };
  /* Estrellas por tipo de terreno, leídas de lo que ya ha corrido (hacen falta 2 salidas en ese terreno) */
  function aptitudes(c) {
    const out = {}, tasaTotal = c.salidas ? (c.vic + c.seg + c.ter) / c.salidas : 0;
    SUELOS.forEach(sl => {
      const v = c.suelos[sl];
      out[sl] = v && v[0] >= 2 ? { estrellas: clamp(Math.round(3 + 5 * (v[2] / v[0] - tasaTotal)), 1, 5), salidas: v[0] } : null;
    });
    return out;
  }
  function etiquetas(c, apt) {
    const e = [];
    const con = SUELOS.filter(sl => apt[sl] && apt[sl].salidas >= 3);
    con.filter(sl => apt[sl].estrellas >= 4).forEach(sl => e.push(`Se crece en terreno ${sl}`));
    con.filter(sl => apt[sl].estrellas <= 2).forEach(sl => e.push(`Sufre en terreno ${sl}`));
    if (c.racha >= 2) e.push(`En racha: ${c.racha} victorias seguidas`);
    const ult = c.hist.slice(-4);
    if (ult.length === 4 && ult.every(h => h.pos > h.campo * 0.6)) e.push("En mala racha");
    if (esLeyenda(c)) e.push("Leyenda");
    return e;
  }
  function perfil(m, c) {
    const apt = aptitudes(c), edad = edadAnios(m.n, c);
    return {
      id: c.id, nombre: c.nombre, sexo: c.sexo, nac: c.nac, estado: c.estado, etapa: etapaDe(edad, c.estado), gen: c.gen, capa: capaTexto(c),
      cuerpo: cuerpo(c), silueta: silueta(c), arquetipo: arquetipo(c), perfilDist: perfilDistancia(c), estilo: c.salidas >= 3 ? estiloTexto(c.ritmo) : null,
      salidas: c.salidas, vic: c.vic, seg: c.seg, ter: c.ter, gp: c.gp, premios: c.premios, racha: c.racha, ultima: c.ultima,
      estrellas: estrellas(c), aptitudes: apt, etiquetas: etiquetas(c, apt), ultimas: c.hist.slice().reverse(), suelos: c.suelos,
      secuelas: STATS.filter(k => c.perm[k] < 0).map(k => SECUELAS[k]),
      lesion: c.lesion ? { tipo: c.lesion.tipo, gravedad: c.lesion.gravedad, hasta: c.lesion.hasta } : null,
      padre: c.padre, madre: c.madre, crias: c.crias, leyenda: esLeyenda(c), muerte: c.muerte
    };
  }

  /* ---------------------------------------------------------------- el mundo */
  /* crearMundo(semilla, { t0, calentar }): población inicial y, si se pide, `calentar` carreras de historia previa. */
  function crearMundo(semilla, opc) {
    opc = opc || {};
    const calentar = opc.calentar == null ? 300 : opc.calentar;
    const m = {
      v: 1, semilla: String(semilla), t0: opc.t0 != null ? opc.t0 : Date.now() - calentar * C.MINUTOS * 60000, n: 0, sigId: 0,
      vivos: [], criadores: [], nombres: {}, clima: { estado: "despejado", mojado: 0.1 }, records: {}, proxima: null,
      stats: { carreras: 0, nacidos: 0, retirados: 0, lesiones: 0, muertes: 0, incidentes: 0 }
    };
    const rng = crearRng(m.semilla, "fundacion");
    for (let i = 0; i < C.OBJETIVO; i++) {
      const edad = rng.f() < 0.15 ? rng.f() * 1.0 : 1 + rng.f() * 6;
      m.vivos.push(nuevaCriatura(m, rng, { nac: -Math.floor(edad * C.ANIO) }));
    }
    for (let i = 0; i < 13; i++) {
      const c = nuevaCriatura(m, rng, { sexo: i < 5 ? "m" : "f", nac: -Math.floor((4 + rng.f() * 5) * C.ANIO) });
      c.estado = "criador"; c.rating = C.RATING_INICIAL + rng.norm(0, 50);
      m.criadores.push(c);
    }
    programar(m, { sims: opc.simsCalentar || 60 });
    for (let i = 0; i < calentar; i++) avanzar(m, { sims: i === calentar - 1 ? C.SIMS : (opc.simsCalentar || 60) });
    if (calentar === 0) programar(m, { sims: C.SIMS });
    return m;
  }

  /* Aplica la carrera programada (ya corrida en programar) y deja programada la siguiente. */
  function avanzar(m, opc) {
    const prog = m.proxima, res = prog && prog.secreto && prog.secreto.res;
    const ev = { n: m.n, resultado: res, noticias: [], cambios: new Set(), bajas: [], retirarPor: new Map(), nacidos: [] };
    if (res) aplicarResultado(m, prog, res, ev);
    else ev.noticias.push(noticia(m, "suspendida", "Jornada suspendida", `No hay criaturas en condiciones de correr ${prog ? prog.nombre : "esta carrera"}. Se aplaza.`, []));
    cicloVital(m, ev);
    m.n++;
    const sig = programar(m, opc);
    sig.rumores.forEach(r => { const nt = noticia(m, "rumor", "Rumores de cuadra", r.texto, [r.id], sig.n); nt.hora = horaDe(m, sig.n - 1) + C.APLICAR_SEG * 1000; ev.noticias.push(nt); });   // salen al programar, no a la hora de la carrera
    // perfiles públicos de todo lo que cambió en esta carrera (incluye retirados y recién nacidos)
    ev.perfiles = [...ev.cambios].map(id => buscar(m, id) || ev.bajas.find(b => b.id === id)).filter(Boolean).map(c => perfil(m, c));
    delete ev.cambios; delete ev.retirarPor;
    ev.programa = programaPublico(sig);
    ev.programada = sig.secreto && sig.secreto.res;
    return ev;
  }
  /* ---------------------------------------------------------------- lo que se guarda en el servidor */
  const filaCriatura = (m, p) => ({ id: p.id, nombre: p.nombre, sexo: p.sexo, estado: p.estado, nac: p.nac, gen: p.gen, padre_id: p.padre ? p.padre.id : null, madre_id: p.madre ? p.madre.id : null,
    salidas: p.salidas, victorias: p.vic, premios: p.premios, leyenda: p.leyenda, n: m.n, publico: p });
  const filaPrograma = prog => ({ n: prog.n, hora: prog.hora, cierre: prog.cierre, publico: programaPublico(prog) });
  /* Primera vez: toda la población, la carrera programada y su resultado (que la base de datos oculta hasta la hora de salida) */
  function loteInicial(m) {
    const prog = m.proxima;
    return { mundo: m, criaturas: m.vivos.concat(m.criadores).map(c => filaCriatura(m, perfil(m, c))), programas: [filaPrograma(prog)],
      carreras: prog.secreto.res ? [{ n: prog.n, hora: prog.hora, resultado: prog.secreto.res }] : [], noticias: [] };
  }
  /* Tras uno o varios avanzar(): las criaturas que cambiaron (la última versión de cada una), las carreras programadas y las noticias */
  function lote(m, eventos) {
    const cri = new Map();
    eventos.forEach(ev => ev.perfiles.forEach(p => cri.set(p.id, filaCriatura(m, p))));
    return { mundo: m, criaturas: [...cri.values()],
      programas: eventos.map(ev => ({ n: ev.programa.n, hora: ev.programa.hora, cierre: ev.programa.cierre, publico: ev.programa })),
      carreras: eventos.filter(ev => ev.programada).map(ev => ({ n: ev.programa.n, hora: ev.programa.hora, resultado: ev.programada })),
      noticias: eventos.reduce((a, ev) => a.concat(ev.noticias), []) };
  }

  /* Pone el mundo al día: aplica todas las carreras cuya hora ya pasó (más APLICAR_SEG). Devuelve los eventos de cada una. */
  function avanzarHasta(m, ahora, opc) {
    const out = [];
    while (ahora >= horaDe(m, m.n) + C.APLICAR_SEG * 1000 && out.length < ((opc && opc.max) || 200)) out.push(avanzar(m, opc));
    return out;
  }

  /* Todo lo que hace la Edge Function sin tocar la base de datos. `fila` es lo que hay guardado en hipodromo_estado
     ({ version, mundo }) o null si es la primera vez. Devuelve null si no toca nada, o { version, lote, avanzadas }
     para pasárselo a hipodromo_guardar(version, lote). La primera carrera en vivo sale en la próxima media hora
     redonda que quede a más de 5 minutos. */
  function paso(fila, ahora, cfg) {
    cfg = cfg || {};
    if (!fila) {
      const calentar = cfg.calentar == null ? 300 : cfg.calentar, tramo = C.MINUTOS * 60000;
      const inicio = Math.ceil((ahora + 5 * 60000) / tramo) * tramo;
      const m = crearMundo(cfg.semilla || "hipodromo", { calentar, t0: inicio - calentar * tramo, simsCalentar: cfg.simsCalentar });
      return { version: 0, lote: loteInicial(m), avanzadas: 0 };
    }
    const m = fila.mundo, eventos = avanzarHasta(m, ahora, { max: cfg.max || 48, sims: cfg.sims });
    return eventos.length ? { version: fila.version, lote: lote(m, eventos), avanzadas: eventos.length } : null;
  }

  raiz.HipodromoMotor = {
    C, AJUSTE, ESPECIE, PISTAS, CLIMAS, ESTADOS_CLIMA, MARKOV, GRADOS, CICLO, DISTANCIAS, LESIONES, CUERPO, TIPOS_APUESTA, STATS, GENES,
    crearRng, hash, crearMundo, programar, avanzar, avanzarHasta, loteInicial, lote, paso, programaPublico, perfil, buscar, horaDe, ventana,
    cuotaApuesta, cuotaExacta, liquidar, fmtTiempo, fmtCuota, fmtMargen, etiquetaPista, edadAnios, cuerpo, capaTexto, perfilDistancia, estrellas, etapaDe, arquetipo, silueta, esLeyenda,
    _interno: { simular, efectivo, condiciones, ordenLlegada, montecarlo, mercado, statsBase, fragilidad, edadMult, nuevaCriatura, mezclarGenes, cicloVital, inscribir, elegibles, muestraClima, puntos, nivelDe, probLesion, rumores }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.HipodromoMotor;
})(typeof window !== "undefined" ? window : globalThis);
