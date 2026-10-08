/* =============================================================================
   HIPÓDROMO: generador de nombres para las criaturas y las carreras.
   Usa las listas de data/hipodromo-palabras.js y sigue una gramática sencilla: en español el adjetivo
   concuerda con el sustantivo ("Gato Hambriento", "Cometa Hambrienta"), "de el" se contrae en "del"
   y los títulos concuerdan con el sexo de la criatura. Hay plantillas en español, en inglés y mezcladas.
   Un nombre puede heredar una palabra de sus padres ("Trueno Hambriento" -> "Pequeño Trueno").
   Todo el azar sale del generador que se le pasa, así que es repetible con la misma semilla.
============================================================================= */
(function (raiz) {
  "use strict";
  const P = () => raiz.HIPODROMO_PALABRAS;

  const LARGO_MAX = 28;
  const PROB_ANOMALO = 0.03;     // nombres absurdos de una sola pieza
  const PROB_MEZCLA = 0.10;      // español e inglés en el mismo nombre
  const PROB_HERENCIA = 0.38;    // con padres conocidos, cuántas veces se hereda una palabra
  const PARADAS = new Set(["de", "del", "la", "el", "los", "las", "y", "o", "e", "u", "sin", "una", "un", "por", "si", "a", "of", "the", "no", "and", "or", "in", "on", "to", "me", "mi", "te", "yo", "que"]);
  const TITULOS_SOLO_M = new Set(["Sir", "Baron", "Count", "Duke"]);
  const TITULOS_SOLO_F = new Set(["Lady", "Miss"]);

  function romano(n) {
    const t = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
    let s = "";
    for (const [v, r] of t) while (n >= v) { s += r; n -= v; }
    return s;
  }

  /* Lista de plantillas con peso: [[nombre, peso], ...] */
  function elegirPlantilla(rng, lista) {
    const total = lista.reduce((a, p) => a + p[1], 0);
    let x = rng.f() * total;
    for (const p of lista) { x -= p[1]; if (x < 0) return p[0]; }
    return lista[lista.length - 1][0];
  }

  /* ---------------------------------------------------------------- índice de palabras (para heredar) */
  let indice = null;
  function indiceDePalabras() {
    if (indice) return indice;
    indice = new Map();
    const poner = (palabra, info) => { const k = palabra.toLowerCase(); if (!indice.has(k)) indice.set(k, info); };
    const E = P().es, N = P().en;
    E.sustantivos.forEach(s => poner(s.s, { t: "s", l: "es", s }));
    E.adjetivos.forEach(a => { poner(a.m, { t: "a", l: "es", a, g: "m" }); if (a.f !== a.m) poner(a.f, { t: "a", l: "es", a, g: "f" }); });
    E.nombres.forEach(n => poner(n, { t: "n", l: "es" }));
    N.sustantivos.forEach(s => poner(s, { t: "s", l: "en", s }));
    N.adjetivos.forEach(a => poner(a.w, { t: "a", l: "en", a }));
    N.nombres.forEach(n => poner(n, { t: "n", l: "en" }));
    return indice;
  }

  /* ---------------------------------------------------------------- piezas comunes */
  const delDe = s => (s.g === "m" ? "del" : "de la") + " " + s.s;       // de + el = del
  function titulosEn(sexo) { return P().en.titulos.filter(t => (sexo === "f" ? !TITULOS_SOLO_M.has(t) : !TITULOS_SOLO_F.has(t))); }

  function esAdjSust(rng, fix) {
    const E = P().es;
    const s = fix.s || rng.pick(E.sustantivos);
    const a = fix.a || rng.pick(E.adjetivos);
    const forma = s.g === "f" ? a.f : a.m;
    const delante = a.pos === "pre" || (a.pos === "any" && rng.f() < 0.5);
    return delante ? `${forma} ${s.s}` : `${s.s} ${forma}`;
  }
  function esAdjNombre(rng, sexo, nombre) {
    const E = P().es;
    const candidatos = E.adjetivos.filter(a => a.pos !== "post" || rng.f() < 0.5);
    const a = rng.pick(candidatos);
    return `${sexo === "f" ? a.f : a.m} ${nombre || rng.pick(E.nombres)}`;
  }
  function enAdjSust(rng, fix) {
    const N = P().en;
    return `${(fix.a || rng.pick(N.adjetivos)).w} ${fix.s || rng.pick(N.sustantivos)}`;
  }
  function enAdjNombre(rng, nombre) {
    const N = P().en;
    return `${rng.pick(N.adjetivos).w} ${nombre || rng.pick(N.nombres)}`;
  }

  /* ---------------------------------------------------------------- plantillas por idioma */
  const PLANTILLAS_ES = [["adjsust", 22], ["sustdesust", 12], ["sustsust", 8], ["verbo", 10], ["concepto", 10], ["titulo", 10], ["adjnombre", 8], ["frase", 6], ["serio", 12]];
  const PLANTILLAS_EN = [["adjsust", 22], ["sustdesust", 12], ["sustsust", 8], ["verbo", 10], ["concepto", 10], ["titulo", 10], ["adjnombre", 8], ["frase", 6], ["serio", 12]];

  function generarEs(rng, sexo) {
    const E = P().es;
    const plantilla = elegirPlantilla(rng, PLANTILLAS_ES);
    let nombre;
    switch (plantilla) {
      case "adjsust": nombre = esAdjSust(rng, {}); break;
      case "sustdesust": {
        const a = rng.pick(E.sustantivos); let b = rng.pick(E.sustantivos); while (b === a) b = rng.pick(E.sustantivos);
        nombre = rng.f() < 0.5 ? `${a.s} ${delDe(b)}` : `${a.s} de ${b.s}`; break;
      }
      case "sustsust": {
        const a = rng.pick(E.sustantivos); let b = rng.pick(E.sustantivos); while (b === a) b = rng.pick(E.sustantivos);
        nombre = `${a.s} ${b.s}`; break;
      }
      case "verbo": nombre = `${rng.pick(E.verbos)} ${rng.pick(E.objetos)}`; break;
      case "concepto": nombre = rng.pick(E.conceptos); break;
      case "titulo": { const t = rng.pick(E.titulos); nombre = `${sexo === "f" ? t.f : t.m} ${rng.pick(E.nombres)}`; break; }
      case "adjnombre": nombre = esAdjNombre(rng, sexo); break;
      case "frase": nombre = rng.pick(E.frases); break;
      default: nombre = rng.pick(E.serios);
    }
    return { nombre, plantilla, idioma: "es" };
  }

  function generarEn(rng, sexo) {
    const N = P().en;
    const plantilla = elegirPlantilla(rng, PLANTILLAS_EN);
    let nombre;
    switch (plantilla) {
      case "adjsust": nombre = enAdjSust(rng, {}); break;
      case "sustdesust": {
        const a = rng.pick(N.sustantivos); let b = rng.pick(N.sustantivos); while (b === a) b = rng.pick(N.sustantivos);
        nombre = `${a} of ${rng.f() < 0.5 ? "the " : ""}${b}`; break;
      }
      case "sustsust": {
        const a = rng.pick(N.sustantivos); let b = rng.pick(N.sustantivos); while (b === a) b = rng.pick(N.sustantivos);
        nombre = `${a} ${b}`; break;
      }
      case "verbo": nombre = `${rng.pick(N.verbos)} ${rng.pick(N.objetos)}`; break;
      case "concepto": nombre = rng.pick(N.conceptos); break;
      case "titulo": nombre = `${rng.pick(titulosEn(sexo))} ${rng.pick(N.nombres)}`; break;
      case "adjnombre": nombre = enAdjNombre(rng); break;
      case "frase": nombre = rng.pick(N.frases); break;
      default: nombre = rng.pick(N.serios);
    }
    return { nombre, plantilla, idioma: "en" };
  }

  /* Mezcla de idiomas: cada pieza respeta su propio idioma, sin concordancia entre ellas */
  function generarMixto(rng, sexo) {
    const E = P().es, N = P().en, M = P().mixto;
    const v = rng.i(0, 4);
    let nombre;
    if (v === 0) nombre = `${rng.pick(E.adjetivos).m} ${rng.pick(N.sustantivos)}`;
    else if (v === 1) nombre = `${rng.pick(N.adjetivos).w} ${rng.pick(E.sustantivos).s}`;
    else if (v === 2) nombre = `${rng.pick(titulosEn(sexo))} ${rng.pick(E.nombres)}`;
    else if (v === 3) { const t = rng.pick(E.titulos); nombre = `${sexo === "f" ? t.f : t.m} ${rng.pick(N.nombres)}`; }
    else nombre = `${rng.pick(M.adverbios)} ${rng.f() < 0.5 ? rng.pick(N.sustantivos) : rng.pick(N.nombres)}`;
    return { nombre, plantilla: "mixto", idioma: "mixto" };
  }

  /* ---------------------------------------------------------------- herencia */
  function fragmento(rng, padres) {
    const idx = indiceDePalabras();
    const cand = [];
    padres.forEach(p => {
      const nombre = typeof p === "string" ? p : p && p.nombre;
      if (!nombre) return;
      nombre.split(/\s+/).forEach(w => {
        const k = w.toLowerCase();
        if (w.length < 4 || PARADAS.has(k) || !idx.has(k)) return;
        cand.push({ palabra: w, info: idx.get(k) });
      });
    });
    return cand.length ? rng.pick(cand) : null;
  }

  function desdeFragmento(rng, fr, sexo) {
    const { palabra, info } = fr;
    const E = P().es, N = P().en;
    let nombre;
    if (info.l === "es") {
      if (info.t === "s") nombre = esAdjSust(rng, { s: info.s });
      else if (info.t === "a") {
        const g = info.a.m === info.a.f ? null : info.g;           // si el adjetivo es invariable, vale cualquier género
        const sust = rng.pick(E.sustantivos.filter(s => !g || s.g === g));
        nombre = esAdjSust(rng, { s: sust, a: { m: info.a.m, f: info.a.f, pos: info.a.pos === "pre" ? "any" : info.a.pos } });
      } else nombre = rng.f() < 0.5 ? esAdjNombre(rng, sexo, palabra) : `${(t => (sexo === "f" ? t.f : t.m))(rng.pick(E.titulos))} ${palabra}`;
    } else {
      if (info.t === "s") nombre = enAdjSust(rng, { s: info.s });
      else if (info.t === "a") nombre = enAdjSust(rng, { a: info.a });
      else nombre = rng.f() < 0.5 ? enAdjNombre(rng, palabra) : `${rng.pick(titulosEn(sexo))} ${palabra}`;
    }
    return { nombre, plantilla: "herencia", idioma: info.l, frag: palabra };
  }

  /* ---------------------------------------------------------------- API */
  function generar(rng, sexo, padres) {
    if (padres.length && rng.f() < PROB_HERENCIA) {
      const fr = fragmento(rng, padres);
      if (fr) return desdeFragmento(rng, fr, sexo);
    }
    if (rng.f() < PROB_MEZCLA) return generarMixto(rng, sexo);
    const l = rng.f() < 0.5 ? "es" : "en";
    if (rng.f() < PROB_ANOMALO) return { nombre: rng.pick(P()[l].anomalos), plantilla: "anomalo", idioma: l };
    return l === "es" ? generarEs(rng, sexo) : generarEn(rng, sexo);
  }

  /* nombrar(rng, { sexo: "m"|"f", padres: [criatura|nombre], usados: { "nombre en minúsculas": 1 } })
     Devuelve { nombre, plantilla, idioma, frag? }. Si hay mapa `usados`, el nombre es único y se anota en él
     (si todo estaba tomado, se añade un número romano: "Gato Hambriento II"). */
  function nombrar(rng, opc) {
    opc = opc || {};
    const sexo = opc.sexo === "f" ? "f" : "m";
    const padres = opc.padres || [];
    const usados = opc.usados || null;
    let ultimo = null;
    if (opc.homenaje) ultimo = { nombre: opc.homenaje.replace(/ (?:[IVX]+|\d+)$/, ""), plantilla: "homenaje", idioma: "homenaje" };   // "Peregrino II" hereda de "Peregrino"
    for (let k = 0; k < 16 && !opc.homenaje; k++) {
      const r = generar(rng, sexo, padres);
      if (r.nombre.length > LARGO_MAX && k < 15) continue;
      ultimo = r;
      if (!usados || !usados[r.nombre.toLowerCase()]) break;
    }
    if (opc.homenaje && !usados) ultimo.nombre += " II";
    if (usados) {
      let nombre = ultimo.nombre, k = 1;
      while (usados[nombre.toLowerCase()]) { k++; nombre = `${ultimo.nombre} ${k <= 20 ? romano(k) : k}`; }
      ultimo = Object.assign({}, ultimo, { nombre });
      usados[nombre.toLowerCase()] = 1;
    }
    return ultimo;
  }

  /* Nombre de una carrera según su categoría: "Gran Premio del Cuervo", "Copa de la Niebla", "Novatos del Calcetín" */
  function nombrarCarrera(rng, grado) {
    const E = P().es, N = P().en;
    const s = rng.pick(E.sustantivos), s2 = rng.pick(N.sustantivos);
    const en = rng.f() < 0.25;
    switch (grado) {
      case "gran": return en ? `Grand ${rng.pick(["Cup", "Prix", "Stakes"])} of the ${s2}` : `Gran Premio ${delDe(s)}`;
      case "selecta": return en ? `${s2} Stakes` : rng.f() < 0.5 ? `Copa ${delDe(s)}` : `Trofeo ${delDe(s)}`;
      case "novatos": return en ? `Maiden ${s2} Dash` : rng.pick([`Debut ${delDe(s)}`, `Novatada ${delDe(s)}`, `Primer Trote ${delDe(s)}`]);
      default: return en ? `${s2} Handicap` : rng.pick([`Premio ${delDe(s)}`, `Carrera ${delDe(s)}`, `Handicap ${delDe(s)}`]);
    }
  }

  raiz.HipodromoNombres = { nombrar, nombrarCarrera, romano, delDe, LARGO_MAX };
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.HipodromoNombres;
})(typeof window !== "undefined" ? window : globalThis);
