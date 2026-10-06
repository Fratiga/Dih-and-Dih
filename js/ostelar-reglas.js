/* =============================================================================
   VALHALLA — reglas base. Dados, tablas de nivel, catálogo de conjuros y de
   objetos. Todo es dato: el motor de combate (valhalla-combate.js) no sabe qué
   es "Bola de fuego", solo interpreta los campos de cada entrada.

   Medidas: 1 casilla = 5 pies = 1,5 m. La distancia es la de D&D 5e por defecto
   (la diagonal cuenta como una casilla).
============================================================================= */
window.VH = window.VH || {};

(function (VH) {
  /* --- Dados ------------------------------------------------------------- */
  VH.d = n => 1 + Math.floor(Math.random() * n);

  /* "2d8+5", "1d10", "3", "2d6+1d4+3". Con critico se duplican los dados. */
  VH.tirar = function (formula, critico) {
    const f = String(formula || "0").replace(/\s+/g, "").replace(/-/g, "+-");
    let total = 0;
    const partes = [];
    f.split("+").filter(Boolean).forEach(p => {
      const neg = p.startsWith("-");
      const t = neg ? p.slice(1) : p;
      const m = t.match(/^(\d+)d(\d+)$/i);
      if (m) {
        const n = parseInt(m[1], 10) * (critico ? 2 : 1);
        const caras = parseInt(m[2], 10);
        let suma = 0;
        for (let i = 0; i < n; i++) suma += VH.d(caras);
        total += neg ? -suma : suma;
        partes.push(`${neg ? "-" : ""}${n}d${caras}`);
      } else {
        const v = parseInt(t, 10) || 0;
        total += neg ? -v : v;
      }
    });
    return { total: Math.max(0, total), formula: f };
  };

  /* Promedio de una fórmula, para que la IA compare opciones. */
  VH.promedio = function (formula) {
    const f = String(formula || "0").replace(/\s+/g, "").replace(/-/g, "+-");
    let total = 0;
    f.split("+").filter(Boolean).forEach(p => {
      const neg = p.startsWith("-");
      const t = neg ? p.slice(1) : p;
      const m = t.match(/^(\d+)d(\d+)$/i);
      const v = m ? parseInt(m[1], 10) * (parseInt(m[2], 10) + 1) / 2 : (parseInt(t, 10) || 0);
      total += neg ? -v : v;
    });
    return total;
  };

  VH.mod = valor => Math.floor((valor - 10) / 2);
  VH.competencia = nivel => 2 + Math.floor((Math.max(1, nivel) - 1) / 4);
  VH.signo = n => (n >= 0 ? `+${n}` : `${n}`);

  /* --- Niveles ------------------------------------------------------------ */
  VH.NIVEL_MAX = 20;
  // XP necesaria para llegar al nivel (índice = nivel).
  VH.XP_PARA_NIVEL = [0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
  VH.nivelPorXp = xp => {
    let n = 1;
    for (let i = 2; i <= VH.NIVEL_MAX; i++) if (xp >= VH.XP_PARA_NIVEL[i]) n = i;
    return n;
  };
  // XP que da un enemigo según su nivel (la tabla de valor de desafío de 5e).
  VH.XP_ENEMIGO = [10, 200, 450, 700, 1100, 1800, 2300, 2900, 3900, 5000, 5900, 7200, 8400, 10000, 11500, 13000, 15000, 18000, 20000, 22000, 25000];
  VH.xpEnemigo = nivel => VH.XP_ENEMIGO[Math.max(0, Math.min(20, Math.round(nivel) || 0))];
  VH.NIVELES_MEJORA = [4, 8, 12, 16, 19];

  /* --- Distancias y casillas --------------------------------------------- */
  VH.dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

  /* --- Condiciones ------------------------------------------------------- */
  VH.CONDICIONES = {
    derribado: "Derribado: ataca con desventaja; los ataques cuerpo a cuerpo contra él tienen ventaja.",
    aturdido: "Aturdido: no actúa. Los ataques contra él tienen ventaja.",
    paralizado: "Paralizado: no actúa. Los ataques contra él tienen ventaja y los cuerpo a cuerpo son críticos.",
    apresado: "Apresado: velocidad 0. Ataca con desventaja.",
    envenenado: "Envenenado: ataca con desventaja.",
    asustado: "Asustado: ataca con desventaja.",
    cegado: "Cegado: ataca con desventaja; los ataques contra él tienen ventaja.",
    esquivando: "Esquivando: los ataques contra él tienen desventaja hasta su próximo turno.",
    ralentizado: "Ralentizado: velocidad reducida a la mitad.",
    bendecido: "Bendecido: suma 1d4 a ataques y salvaciones.",
    furia: "Furia: resistencia al daño físico y daño extra.",
    marcado: "Marcado: recibe daño extra del que lo marcó.",
    acelerado: "Acelerado: velocidad doble y una acción extra de ataque."
  };

  /* --- Tipos de daño ------------------------------------------------------ */
  VH.sinAcentos = t => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  VH.tipoDanoCanon = t => {
    const s = VH.sinAcentos(t);
    const mapa = [["perfor", "perforante"], ["cortan", "cortante"], ["contund", "contundente"], ["fuego", "fuego"], ["frio", "frío"],
      ["veneno", "veneno"], ["acido", "ácido"], ["necrot", "necrótico"], ["radiante", "radiante"], ["psiqu", "psíquico"],
      ["fuerza", "fuerza"], ["relamp", "relámpago"], ["electr", "relámpago"], ["trueno", "trueno"], ["elemental", "elemental"]];
    const hallado = mapa.find(([k]) => s.includes(k));
    return hallado ? hallado[1] : (s || "");
  };
  VH.FISICOS = ["perforante", "cortante", "contundente"];

  /* --- Conjuros ------------------------------------------------------------
     tipo: "ataque" (tirada de ataque), "salvacion", "auto" (sin tirada),
           "cura", "efecto" (solo condición/movimiento).
     alcance en casillas (0 = el propio lanzador, 1 = toque).
     area: { forma: "esfera"|"explosion"|"cono"|"linea", radio|largo }.
     clases: quién lo tiene en su lista (para los einherjar predeterminados).
     escala: dados extra por nivel de espacio sobre el del conjuro, o por nivel
     del personaje para los trucos. */
  const C = [];
  const conj = o => C.push(Object.assign({ costo: "accion", tipo: "ataque", alcance: 12, danos: [], clases: [] }, o));

  // Trucos
  conj({ id: "rayo-de-fuego", nombre: "Rayo de fuego", nivel: 0, escuela: "evocación", alcance: 24, danos: [{ f: "1d10", t: "fuego" }], truco: true, clases: ["mago"] });
  conj({ id: "descarga-sobrenatural", nombre: "Descarga sobrenatural", nivel: 0, escuela: "evocación", alcance: 24, danos: [{ f: "1d10", t: "fuerza" }], truco: true, rayos: "truco", empuje: 2, clases: ["mago"] });
  conj({ id: "rayo-de-escarcha", nombre: "Rayo de escarcha", nivel: 0, escuela: "evocación", alcance: 12, danos: [{ f: "1d8", t: "frío" }], truco: true, estado: { nombre: "ralentizado", turnos: 1 }, clases: ["mago"] });
  conj({ id: "llama-sagrada", nombre: "Llama sagrada", nivel: 0, escuela: "evocación", alcance: 12, tipo: "salvacion", salv: "des", danos: [{ f: "1d8", t: "radiante" }], mitad: false, truco: true, clases: ["clerigo"] });
  conj({ id: "toque-helado", nombre: "Toque helado", nivel: 0, escuela: "nigromancia", alcance: 24, danos: [{ f: "1d8", t: "necrótico" }], truco: true, clases: ["mago"] });
  conj({ id: "chorro-de-acido", nombre: "Chorro de ácido", nivel: 0, escuela: "conjuración", alcance: 12, tipo: "salvacion", salv: "des", danos: [{ f: "1d6", t: "ácido" }], mitad: false, truco: true, clases: ["mago"] });

  // Nivel 1
  conj({ id: "proyectil-magico", nombre: "Proyectil mágico", nivel: 1, escuela: "evocación", alcance: 24, tipo: "auto", danos: [{ f: "1d4+1", t: "fuerza" }], dardos: 3, escalaDardos: 1, clases: ["mago"] });
  conj({ id: "curar-heridas", nombre: "Curar heridas", nivel: 1, escuela: "evocación", alcance: 1, tipo: "cura", cura: "1d8", escalaCura: "1d8", sumaMod: true, clases: ["clerigo", "paladin", "explorador"] });
  conj({ id: "palabra-de-curacion", nombre: "Palabra de curación", nivel: 1, escuela: "evocación", costo: "bonus", alcance: 12, tipo: "cura", cura: "1d4", escalaCura: "1d4", sumaMod: true, clases: ["clerigo"] });
  conj({ id: "manos-ardientes", nombre: "Manos ardientes", nivel: 1, escuela: "evocación", alcance: 0, tipo: "salvacion", salv: "des", mitad: true, area: { forma: "cono", largo: 3 }, danos: [{ f: "3d6", t: "fuego" }], escala: "1d6", clases: ["mago"] });
  conj({ id: "ola-atronadora", nombre: "Ola atronadora", nivel: 1, escuela: "evocación", alcance: 0, tipo: "salvacion", salv: "con", mitad: true, area: { forma: "explosion", radio: 3 }, danos: [{ f: "2d8", t: "trueno" }], escala: "1d8", empuje: 2, clases: ["mago", "clerigo"] });
  conj({ id: "bendecir", nombre: "Bendecir", nivel: 1, escuela: "encantamiento", alcance: 6, tipo: "efecto", objetivosMax: 3, aliados: true, estado: { nombre: "bendecido", turnos: 6 }, concentracion: true, clases: ["clerigo", "paladin"] });
  conj({ id: "orden-imperiosa", nombre: "Orden imperiosa", nivel: 1, escuela: "encantamiento", alcance: 12, tipo: "salvacion", salv: "sab", danos: [], estado: { nombre: "asustado", turnos: 1 }, clases: ["clerigo", "paladin"] });
  conj({ id: "rayo-guiador", nombre: "Rayo guiador", nivel: 1, escuela: "evocación", alcance: 24, danos: [{ f: "4d6", t: "radiante" }], escala: "1d6", clases: ["clerigo"] });
  conj({ id: "marca-del-cazador", nombre: "Marca del cazador", nivel: 1, escuela: "adivinación", costo: "bonus", alcance: 18, tipo: "efecto", estado: { nombre: "marcado", turnos: 10 }, concentracion: true, clases: ["explorador"] });

  // Nivel 2
  conj({ id: "rayo-abrasador", nombre: "Rayo abrasador", nivel: 2, escuela: "evocación", alcance: 24, danos: [{ f: "2d6", t: "fuego" }], rayos: 3, escalaRayos: 1, clases: ["mago"] });
  conj({ id: "inmovilizar-persona", nombre: "Inmovilizar persona", nivel: 2, escuela: "encantamiento", alcance: 12, tipo: "salvacion", salv: "sab", danos: [], estado: { nombre: "paralizado", turnos: 3 }, concentracion: true, clases: ["mago", "clerigo"] });
  conj({ id: "paso-brumoso", nombre: "Paso brumoso", nivel: 2, escuela: "conjuración", costo: "bonus", alcance: 6, tipo: "teleport", clases: ["mago"] });
  conj({ id: "arma-espiritual", nombre: "Arma espiritual", nivel: 2, escuela: "evocación", costo: "bonus", alcance: 12, danos: [{ f: "1d8", t: "fuerza" }], escala: "1d8", sumaMod: true, clases: ["clerigo"] });

  // Nivel 3
  conj({ id: "bola-de-fuego", nombre: "Bola de fuego", nivel: 3, escuela: "evocación", alcance: 30, tipo: "salvacion", salv: "des", mitad: true, area: { forma: "esfera", radio: 4 }, danos: [{ f: "8d6", t: "fuego" }], escala: "1d6", clases: ["mago"] });
  conj({ id: "relampago", nombre: "Relámpago", nivel: 3, escuela: "evocación", alcance: 0, tipo: "salvacion", salv: "des", mitad: true, area: { forma: "linea", largo: 20 }, danos: [{ f: "8d6", t: "relámpago" }], escala: "1d6", clases: ["mago"] });
  conj({ id: "acelerar", nombre: "Acelerar", nivel: 3, escuela: "transmutación", alcance: 6, tipo: "efecto", aliados: true, estado: { nombre: "acelerado", turnos: 6 }, concentracion: true, clases: ["mago"] });
  conj({ id: "espiritus-guardianes", nombre: "Espíritus guardianes", nivel: 3, escuela: "conjuración", alcance: 0, tipo: "salvacion", salv: "sab", mitad: true, area: { forma: "explosion", radio: 3 }, danos: [{ f: "3d8", t: "radiante" }], escala: "1d8", clases: ["clerigo"] });

  // Nivel 4 en adelante
  conj({ id: "tormenta-de-hielo", nombre: "Tormenta de hielo", nivel: 4, escuela: "evocación", alcance: 18, tipo: "salvacion", salv: "des", mitad: true, area: { forma: "esfera", radio: 4 }, danos: [{ f: "2d8", t: "contundente" }, { f: "4d6", t: "frío" }], escala: "1d8", clases: ["mago"] });
  conj({ id: "curar-heridas-masivo", nombre: "Curar heridas en masa", nivel: 5, escuela: "evocación", alcance: 12, tipo: "cura", area: { forma: "esfera", radio: 3 }, aliados: true, cura: "3d8", sumaMod: true, clases: ["clerigo"] });
  conj({ id: "cono-de-frio", nombre: "Cono de frío", nivel: 5, escuela: "evocación", alcance: 0, tipo: "salvacion", salv: "con", mitad: true, area: { forma: "cono", largo: 12 }, danos: [{ f: "8d8", t: "frío" }], escala: "1d8", clases: ["mago"] });
  conj({ id: "desintegrar", nombre: "Desintegrar", nivel: 6, escuela: "transmutación", alcance: 12, tipo: "salvacion", salv: "des", mitad: false, danos: [{ f: "10d6+40", t: "fuerza" }], escala: "3d6", clases: ["mago"] });
  conj({ id: "dedo-de-la-muerte", nombre: "Dedo de la muerte", nivel: 7, escuela: "nigromancia", alcance: 12, tipo: "salvacion", salv: "con", mitad: true, danos: [{ f: "7d8+30", t: "necrótico" }], clases: ["mago"] });
  conj({ id: "nube-incendiaria", nombre: "Nube incendiaria", nivel: 8, escuela: "conjuración", alcance: 24, tipo: "salvacion", salv: "des", mitad: true, area: { forma: "esfera", radio: 4 }, danos: [{ f: "10d8", t: "fuego" }], clases: ["mago"] });
  conj({ id: "lluvia-de-meteoros", nombre: "Enjambre de meteoros", nivel: 9, escuela: "evocación", alcance: 60, tipo: "salvacion", salv: "des", mitad: true, area: { forma: "esfera", radio: 8 }, danos: [{ f: "20d6", t: "fuego" }, { f: "20d6", t: "contundente" }], clases: ["mago"] });
  conj({ id: "sanar", nombre: "Sanar", nivel: 6, escuela: "evocación", alcance: 12, tipo: "cura", cura: "70", clases: ["clerigo"] });

  VH.CONJUROS = C;
  VH.conjuro = id => C.find(c => c.id === id) || null;
  VH.conjuroPorNombre = nombre => {
    const n = VH.sinAcentos(nombre).trim();
    return C.find(c => VH.sinAcentos(c.nombre) === n) || null;
  };

  /* Espacios de conjuro por nivel de lanzador (tabla de lanzador completo). */
  VH.ESPACIOS_COMPLETO = [
    null,
    [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
    [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
    [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]
  ];
  /* tipo: "completo" | "mitad" | "ninguno" */
  VH.espaciosPara = (tipoLanzador, nivel) => {
    let n = nivel;
    if (tipoLanzador === "mitad") n = Math.ceil(nivel / 2) - (nivel < 2 ? 1 : 0);
    if (tipoLanzador === "ninguno" || n < 1) return [];
    return VH.ESPACIOS_COMPLETO[Math.min(20, n)].slice();
  };

  /* Dados de daño de un truco según el nivel del personaje. */
  VH.multiplicadorTruco = nivel => (nivel >= 17 ? 4 : nivel >= 11 ? 3 : nivel >= 5 ? 2 : 1);

  /* --- Equipo ------------------------------------------------------------ */
  VH.ARMADURAS = [
    { id: "acolchada", nombre: "Armadura acolchada", base: 11, des: 99, peso: "ligera", tier: 0 },
    { id: "cuero", nombre: "Armadura de cuero", base: 11, des: 99, peso: "ligera", tier: 0 },
    { id: "cuero-tachonado", nombre: "Cuero tachonado", base: 12, des: 99, peso: "ligera", tier: 1 },
    { id: "pieles", nombre: "Armadura de pieles", base: 12, des: 2, peso: "media", tier: 0 },
    { id: "malla-ligera", nombre: "Camisa de mallas", base: 13, des: 2, peso: "media", tier: 1 },
    { id: "escamas", nombre: "Cota de escamas", base: 14, des: 2, peso: "media", tier: 2 },
    { id: "coraza", nombre: "Coraza", base: 14, des: 2, peso: "media", tier: 2 },
    { id: "semiplacas", nombre: "Semiplacas", base: 15, des: 2, peso: "media", tier: 3 },
    { id: "anillas", nombre: "Cota de anillas", base: 14, des: 0, peso: "pesada", tier: 2 },
    { id: "malla", nombre: "Cota de mallas", base: 16, des: 0, peso: "pesada", tier: 3 },
    { id: "bandas", nombre: "Armadura de bandas", base: 17, des: 0, peso: "pesada", tier: 4 },
    { id: "placas", nombre: "Armadura de placas", base: 18, des: 0, peso: "pesada", tier: 5 }
  ];

  /* Afijos: dan carácter al botín (y un toque caótico) sin salirse de lo tirable. */
  VH.AFIJOS_ARMA = [
    { id: "llamas", nombre: "de llamas", extra: { f: "1d6", t: "fuego" }, minNivel: 3 },
    { id: "escarcha", nombre: "de escarcha", extra: { f: "1d6", t: "frío" }, minNivel: 3, estado: { nombre: "ralentizado", turnos: 1 } },
    { id: "tormenta", nombre: "de la tormenta", extra: { f: "1d6", t: "relámpago" }, empuje: 1, minNivel: 5 },
    { id: "vampirica", nombre: "vampírica", extra: { f: "1d4", t: "necrótico" }, robo: 0.5, minNivel: 6 },
    { id: "pesada", nombre: "del titán", empuje: 2, minNivel: 4 },
    { id: "radiante", nombre: "del alba", extra: { f: "2d6", t: "radiante" }, minNivel: 10 }
  ];
  VH.AFIJOS_ARMADURA = [
    { id: "espinas", nombre: "de espinas", espinas: { f: "1d4", t: "perforante" }, minNivel: 3 },
    { id: "vida", nombre: "de vitalidad", pv: 10, minNivel: 4 },
    { id: "veloz", nombre: "del viento", vel: 1, minNivel: 5 },
    { id: "ira", nombre: "del bastión", resistencia: "contundente", minNivel: 8 }
  ];
})(window.VH);
