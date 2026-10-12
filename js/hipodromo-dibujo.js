/* =============================================================================
   HIPÓDROMO: dibujo de las criaturas. Una silueta de perfil, mirando a la derecha, hecha en SVG con piezas:
   cuerpo, patas, cuello, cabeza, cuernos, espalda, cola, piel y alas. Sin imágenes.

   Dos fuentes de datos, que no se mezclan:
   - Morfología (perfil.silueta, de 0 a 1, sale de los genes del motor): largo de patas, pecho, cadera, cola,
     cuerpo, torso, grosor de patas, cuello, cabeza. Es lo que "dice" algo de las capacidades.
   - Rasgos de identidad (cuernos, orejas, forma del cuello, cola, espalda, piel, patas extra, ojos, alas,
     dedos y patrón de color): no cambian ninguna capacidad. Se heredan por linaje y a veces mutan, así que
     una familia se parece y algunas crías salen distintas. Salen del id y del id de los padres, sin tocar el motor.

   Es una sola función de dibujo (silueta); cuando haya arte de verdad se cambia solo este archivo.
============================================================================= */
window.HipodromoDibujo = (function () {
  const CAPAS = { castaña: "#8a5a3a", ceniza: "#8b8f94", marfil: "#e3dcc6", carbón: "#34343a", canela: "#c48b52", rojiza: "#a8452f", verdosa: "#6f8f5c", azulada: "#5d7ea0" };
  const HUESO = "#e8dfc6";
  const mezcla = (hex, f) => {   // f < 0 oscurece, f > 0 aclara
    const n = parseInt(hex.slice(1), 16), ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) + (f < 0 ? ((n >> s) & 255) * f : (255 - ((n >> s) & 255)) * f))));
    return "#" + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, "0")).join("");
  };
  const colorCapa = capa => CAPAS[String(capa || "").split(" ")[0]] || "#8a5a3a";
  const f1 = n => n.toFixed(1);

  /* ---------------------------------------------------------------- azar repetible, propio del dibujo */
  const hashTxt = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
  const azar = semilla => { let a = semilla >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const elegir = (az, tabla) => { let r = az() * tabla.reduce((s, x) => s + x[1], 0); for (const [v, p] of tabla) { r -= p; if (r < 0) return v; } return tabla[0][0]; };

  /* ---------------------------------------------------------------- rasgos de identidad: tablas con su frecuencia */
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
    patron: [["uniforme", 30], ["patas", 16], ["cara", 14], ["manchas", 14], ["dorsal", 8], ["bandas", 8], ["degradado", 6], ["mascara", 4]]
  };
  const CLAVES = Object.keys(TABLAS);

  /* Linaje: id -> { padre, madre }. Se rellena con cada perfil que se dibuja o se registra. */
  const LINAJE = new Map();
  let MEMO = new Map();
  function registrar(p) {
    if (!p || p.id == null) return;
    const nuevo = { padre: p.padre ? p.padre.id : null, madre: p.madre ? p.madre.id : null };
    const viejo = LINAJE.get(p.id);
    if (viejo && viejo.padre === nuevo.padre && viejo.madre === nuevo.madre) return;
    LINAJE.set(p.id, nuevo);
    MEMO = new Map();   // un dato nuevo del linaje puede cambiar a los descendientes ya calculados
  }

  function rasgosDe(id, prof) {
    if (MEMO.has(id)) return MEMO.get(id);
    const az = azar(hashTxt("rasgos:" + id));
    const l = LINAJE.get(id) || {};
    const pa = l.padre != null && prof < 60 ? rasgosDe(l.padre, prof + 1) : null;
    const ma = l.madre != null && prof < 60 ? rasgosDe(l.madre, prof + 1) : null;
    const r = {};
    CLAVES.forEach(k => {
      const u = az(), libre = elegir(az, TABLAS[k]);
      if (pa && ma) r[k] = u < 0.46 ? pa[k] : u < 0.92 ? ma[k] : libre;   // casi todo se hereda; un 8 % es nuevo
      else r[k] = libre;
    });
    // coherencia: no todo combina con todo
    if (r.cuernos === "multiple" && r.orejas === "dobles") r.orejas = "pequeñas";
    if (r.alas !== "no" && r.espalda === "continua") r.espalda = "placas";
    if (r.cola === "maza" && r.espalda === "continua") r.espalda = "espinas";
    MEMO.set(id, r);
    return r;
  }

  /* ---------------------------------------------------------------- textos de los rasgos */
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
    patron: { patas: "Patas oscuras", cara: "Cara clara", manchas: "Manchas", dorsal: "Raya en el lomo", bandas: "Bandas", degradado: "Degradado", mascara: "Máscara oscura" }
  };

  /* Lista de rasgos llamativos de una criatura (solo los que se salen de lo común), para la ficha. */
  function rasgos(perfil) {
    registrar(perfil);
    const r = rasgosDe(perfil.id, 0), s = perfil.silueta || {}, out = [];
    ["patas", "cuernos", "alas", "ojos", "cuello", "espalda", "cola", "piel", "dedos", "hocico", "orejas", "patron"].forEach(k => {
      const t = NOMBRES[k] && NOMBRES[k][r[k]];
      if (t) out.push(t);
    });
    if (typeof s.longitud_cuello === "number") {
      if (s.longitud_cuello > 0.85) out.unshift("Cuello larguísimo");
      else if (s.longitud_cuello < 0.18) out.unshift("Cuello muy corto");
    }
    return out;
  }

  /* ---------------------------------------------------------------- geometría de ayuda */
  function bez(p0, p1, p2, p3, t) {   // punto y normal de una curva de Bézier cúbica
    const u = 1 - t;
    const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
    const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
    const dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
    const dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
    const l = Math.hypot(dx, dy) || 1;
    return { x, y, nx: -dy / l, ny: dx / l };
  }
  const curva = (p0, p1, p2, p3) => `M ${f1(p0[0])} ${f1(p0[1])} C ${f1(p1[0])} ${f1(p1[1])}, ${f1(p2[0])} ${f1(p2[1])}, ${f1(p3[0])} ${f1(p3[1])}`;

  let CONTADOR = 0;

  /* ---------------------------------------------------------------- el dibujo */
  /* Devuelve el SVG como texto. opciones: { clase, titulo } */
  function silueta(perfil, opciones) {
    opciones = opciones || {};
    registrar(perfil);
    const R = rasgosDe(perfil.id, 0);
    const s = perfil.silueta || {}, g = k => (typeof s[k] === "number" ? s[k] : 0.5);
    const uid = "hd" + perfil.id + "_" + (++CONTADOR);
    const corre = /(^|\s)corre(\s|$)/.test(opciones.clase || "");   // en la pista: galopa
    const ciclo = (0.44 + (perfil.id % 5) * 0.02).toFixed(2);          // segundos por zancada, distinto en cada criatura
    const base = colorCapa(perfil.capa), oscuro = mezcla(base, -0.45), lejos = mezcla(base, -0.3), claro = mezcla(base, 0.25);
    const seis = R.patas !== "4";

    const escala = 0.82 + 0.3 * g("altura");
    const largoPata = 24 + 40 * g("longitud_patas"), grosorPata = 3 + 4.5 * g("grosor_patas");
    const largoCuerpo = (64 + 54 * g("longitud_cuerpo")) * (seis ? 1.16 : 1), alto = 24 + 24 * g("anchura_torso");
    const rPecho = 12 + 10 * g("tamano_pecho"), rCadera = 12 + 10 * g("tamano_cadera");
    const largoCuello = 9 + 32 * g("longitud_cuello"), cabezaX = 8 + 8 * g("tamano_cabeza"), cabezaY = 5.5 + 4.5 * g("tamano_cabeza");
    const largoCola = 14 + 30 * g("tamano_cola");

    const suelo = 128, cy = suelo - largoPata - alto / 2;
    const xAtras = 110 - largoCuerpo / 2 + rCadera * 0.5, xFrente = 110 + largoCuerpo / 2 - rPecho * 0.5;
    const cuelloX = xFrente + rPecho * 0.35, cuelloY = cy - alto / 2 + 3;
    const cabX = cuelloX + largoCuello * 0.72 + cabezaX * 0.55, cabY = cuelloY - largoCuello * 0.7 + 2;
    const lomo = cy - alto / 2;      // altura del lomo
    const ryC = alto / 2 + 1 + 5 * g("tamano_cadera"), ryP = alto / 2 + 1 + 6 * g("tamano_pecho");
    const centro = (xAtras + xFrente) / 2;

    /* ---- el cuerpo es una sola curva suave (grupa, lomo, cruz, pecho, vientre): sin óvalos pegados */
    const PC = [[xAtras - rCadera, cy - 1], [xAtras + 2, cy - ryC], [centro, lomo + 0.5], [xFrente - 2, cy - ryP], [xFrente + rPecho, cy + 1], [xFrente, cy + ryP], [centro, cy + alto / 2 + 0.5], [xAtras + 2, cy + ryC]];
    const SEG = PC.map((_, i) => {
      const a = PC[(i + 7) % 8], b = PC[i], c = PC[(i + 1) % 8], d = PC[(i + 2) % 8];
      return [b, [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6], [c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6], c];
    });
    const cuerpoD = `M ${f1(PC[0][0])} ${f1(PC[0][1])}` + SEG.map(q => ` C ${f1(q[1][0])} ${f1(q[1][1])}, ${f1(q[2][0])} ${f1(q[2][1])}, ${f1(q[3][0])} ${f1(q[3][1])}`).join("") + " Z";
    // contorno del lomo, de la grupa a la cruz: ahí se apoyan las espinas, las placas y la raya dorsal
    const LOMO = [];
    [0, 1, 2].forEach(i => { for (let t = 0; t <= 1.0001; t += 0.04) { const q = bez(SEG[i][0], SEG[i][1], SEG[i][2], SEG[i][3], t); LOMO.push([q.x, q.y]); } });
    const yLomo = x => {
      if (x <= LOMO[0][0]) return LOMO[0][1];
      for (let i = 1; i < LOMO.length; i++) if (x <= LOMO[i][0]) { const a = LOMO[i - 1], b = LOMO[i], u = (x - a[0]) / ((b[0] - a[0]) || 1); return a[1] + (b[1] - a[1]) * u; }
      return LOMO[LOMO.length - 1][1];
    };
    const normalLomo = x => { const m = (yLomo(x + 1.5) - yLomo(x - 1.5)) / 3, l = Math.hypot(m, 1); return [m / l, -1 / l]; };
    const relleno = R.patron === "degradado" ? `url(#${uid}g)` : base;
    const defs = `<defs>` +
      `<clipPath id="${uid}c"><path d="${cuerpoD}"/></clipPath>` +
      (R.patron === "degradado" ? `<linearGradient id="${uid}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${oscuro}"/><stop offset="0.55" stop-color="${base}"/><stop offset="1" stop-color="${claro}"/></linearGradient>` : "") +
      (R.piel === "escamas" || R.piel === "mixta" ? `<pattern id="${uid}e" width="6" height="5" patternUnits="userSpaceOnUse"><path d="M0 5 Q3 1.3 6 5 M-3 2.5 Q0 -1.2 3 2.5 M3 2.5 Q6 -1.2 9 2.5" fill="none" stroke="${claro}" stroke-width=".8" opacity=".5"/></pattern>` : "") +
      `</defs>`;

    /* ---- patas */
    const rp = Math.min(1.5, 1 + 0.9 * (g("tamano_cadera") - 0.5)), dp = Math.min(1.4, 1 + 0.8 * (g("tamano_pecho") - 0.5));
    /* Cada pata son dos tramos: el muslo gira en la cadera y la caña en la rodilla. Quieta se ve como siempre;
       en la pista (clase "corre") se anima con SMIL: las patas de atrás y de delante van desfasadas, y la rodilla
       se pliega al llevar la pata hacia delante, como en un galope. */
    function pata(x, k, w, pintar, fase) {
      const gr = grosorPata * w, yb = cy + alto / 2 + largoPata * k, y0 = cy + alto / 2 - 4, ym = y0 + (yb - y0) * 0.5;
      // la rodilla se dobla: hacia atrás en las patas de atrás y hacia delante en las de delante (no es un caballo)
      const kx = (x < (xAtras + xFrente) / 2 ? -4.2 : 3.2) * Math.min(1, 0.5 + k);
      const muslo = `<path d="M ${f1(x)} ${f1(y0)} L ${f1(x + kx)} ${f1(ym)}" fill="none" stroke="${pintar}" stroke-width="${f1(gr)}" stroke-linecap="round"/>`;
      let cana = `<path d="M ${f1(x + kx)} ${f1(ym)} L ${f1(x)} ${f1(yb - 2)}" fill="none" stroke="${pintar}" stroke-width="${f1(gr)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      if (R.patron === "patas") cana += `<path d="M ${f1(x + kx)} ${f1(ym)} L ${f1(x)} ${f1(yb - 2)}" fill="none" stroke="${oscuro}" stroke-opacity=".75" stroke-width="${f1(gr)}" stroke-linecap="round"/>`;
      const pie = R.dedos === "palmeadas" ? gr / 2 + 6 : gr / 2 + 3.5, grosor = R.dedos === "palmeadas" ? 1.8 : 2.5;
      cana += `<ellipse cx="${f1(x + 1.5)}" cy="${f1(yb - 2.3)}" rx="${f1(pie)}" ry="${f1(R.dedos === "palmeadas" ? 2.2 : 2.6)}" fill="${oscuro}"/>`;
      const marcas = R.dedos === "cuatro" ? 3 : R.dedos === "garras" ? 0 : 2;
      for (let i = 1; i <= marcas; i++) {
        const px = x + 1.5 - pie + (2 * pie * i) / (marcas + 1);
        cana += `<line x1="${f1(px)}" y1="${f1(yb - 4.6)}" x2="${f1(px)}" y2="${f1(yb - grosor * 0.2)}" stroke="${base}" stroke-width="0.9" opacity=".85"/>`;
      }
      if (R.dedos === "garras") for (let i = 0; i < 3; i++) cana += `<path d="M ${f1(x + gr / 2 + 1.2 + i * 2.2)} ${f1(yb - 3.4 + i * 0.4)} l 3 1.4 l -3 1.2 Z" fill="${HUESO}"/>`;
      if (!corre) return muslo + cana;
      const N = 12, A = 36, B = 54;
      const giro = (cx, cy2, f) => `<animateTransform attributeName="transform" type="rotate" dur="${ciclo}s" repeatCount="indefinite" values="${Array.from({ length: N + 1 }, (_, i) => f(2 * Math.PI * i / N + fase).toFixed(1) + " " + f1(cx) + " " + f1(cy2)).join(";")}"/>`;
      return `<g>${muslo}<g>${cana}${giro(x + kx, ym, w => B * (0.5 - 0.5 * Math.cos(w)))}</g>${giro(x, y0, w => A * Math.sin(w))}</g>`;
    }
    // [x de la pata cercana, x de la lejana, largo, grosor]
    const trasera = [xAtras - 2, xAtras + 10, 1, rp], delantera = [xFrente + 8, xFrente - 2, 1, dp];
    // Todas las patas extra llegan al suelo: son piernas que sirven, nunca algo colgando del torso.
    const medio = (xAtras + xFrente) / 2;
    const extra = (k, w) => [xFrente - 17, xFrente - 28, k, w];
    const POS = {
      "4": [trasera, delantera],
      hex: [trasera, extra(1, dp * 0.95), delantera],                                          // el par extra detrás de las delanteras
      del: [trasera, extra(1, dp * 1.12), [xFrente + 8, xFrente - 2, 1, dp * 1.12]],           // delanteras dobles y fuertes
      fina: [trasera, extra(1, dp * 0.7), delantera],                                          // par extra más fino
      tras: [[xAtras - 3, xAtras + 8, 1, rp], [xAtras + 17, xAtras + 28, 1, rp * 0.95], delantera],   // traseras dobles
      aux: [trasera, [medio - 3, medio + 8, 1, 0.62], delantera]                               // par fino en medio, también apoyado
    }[R.patas] || [trasera, delantera];
    const faseDe = (p, lejana) => (p[0] < (xAtras + xFrente) / 2 ? 0 : Math.PI * 0.9) + (lejana ? 1.0 : 0) + (p[0] > xAtras + 20 && p[0] < xFrente - 10 ? 0.5 : 0);
    const patasLejos = POS.map(p => pata(p[1], p[2], p[3], lejos, faseDe(p, true))).join("");
    const patasCerca = POS.map(p => pata(p[0], p[2], p[3], base, faseDe(p, false))).join("");

    /* ---- cola */
    const colaX = xAtras - rCadera * 0.86, colaY = cy - 3;
    const kCola = R.cola === "corta" ? 0.5 : R.cola === "bifurcada" ? 0.7 : 1, L = largoCola * kCola;
    const P0 = [colaX, colaY], P1 = [colaX - L * 0.5, colaY - 8], P2 = [colaX - L, colaY + 6], P3 = [colaX - L * 0.9, colaY + L * 0.8];
    const grosorCola = (R.cola === "gruesa" || R.cola === "espinada" ? 7 + 3 * g("tamano_cola") : 3 + 3 * g("tamano_cola"));
    let cola = `<path d="${curva(P0, P1, P2, P3)}" fill="none" stroke="${oscuro}" stroke-width="${f1(grosorCola)}" stroke-linecap="round"/>`;
    const fin = bez(P0, P1, P2, P3, 1);
    if (R.cola === "mechon") for (let i = 0; i < 4; i++) cola += `<path d="M ${f1(fin.x)} ${f1(fin.y)} q ${f1(-5 + i * 3.2)} 7 ${f1(-7 + i * 4.5)} ${f1(11 + (i % 2) * 3)}" fill="none" stroke="${i % 2 ? lejos : oscuro}" stroke-width="2.4" stroke-linecap="round"/>`;
    if (R.cola === "plumas") for (let i = 0; i < 5; i++) cola += `<ellipse cx="${f1(fin.x - 3 + i * 2.5)}" cy="${f1(fin.y + 5 + (i % 2) * 2)}" rx="2.2" ry="8" fill="${i % 2 ? claro : oscuro}" transform="rotate(${-40 + i * 20} ${f1(fin.x)} ${f1(fin.y)})"/>`;
    if (R.cola === "bifurcada") {
      cola += `<path d="M ${f1(fin.x)} ${f1(fin.y)} q -9 4 -12 14" fill="none" stroke="${oscuro}" stroke-width="${f1(grosorCola * 0.8)}" stroke-linecap="round"/>` +
        `<path d="M ${f1(fin.x)} ${f1(fin.y)} q 5 9 3 18" fill="none" stroke="${oscuro}" stroke-width="${f1(grosorCola * 0.8)}" stroke-linecap="round"/>`;
    }
    if (R.cola === "maza") cola += `<circle cx="${f1(fin.x)}" cy="${f1(fin.y + 1)}" r="${f1(5 + 2 * g("tamano_cola"))}" fill="${oscuro}"/><circle cx="${f1(fin.x - 1.5)}" cy="${f1(fin.y - 0.5)}" r="1.6" fill="${claro}" opacity=".5"/>`;
    if (R.cola === "espinada") for (let i = 1; i <= 5; i++) { const q = bez(P0, P1, P2, P3, i / 6); cola += `<path d="M ${f1(q.x)} ${f1(q.y)} l ${f1(q.nx * -9)} ${f1(q.ny * -9)} l ${f1(-3)} 2 Z" fill="${lejos}"/>`; }
    if (R.cola === "aleta") {
      const a = bez(P0, P1, P2, P3, 0.25), b = bez(P0, P1, P2, P3, 0.9);
      cola += `<path d="M ${f1(a.x)} ${f1(a.y)} L ${f1(a.x + a.nx * -9)} ${f1(a.y + a.ny * -9)} L ${f1(b.x + b.nx * -6)} ${f1(b.y + b.ny * -6)} L ${f1(b.x)} ${f1(b.y)} Z" fill="${lejos}" opacity=".9"/>`;
    }
    cola = `<g class="hip-cola">${cola}${corre ? `<animateTransform attributeName="transform" type="rotate" dur="${ciclo}s" repeatCount="indefinite" values="9 ${f1(colaX)} ${f1(colaY)};-7 ${f1(colaX)} ${f1(colaY)};9 ${f1(colaX)} ${f1(colaY)}"/>` : ""}</g>`;

    /* ---- alas (detrás del cuerpo) */
    const ax = xFrente - 6, ay = yLomo(xFrente - 6) + 2;
    const alas = {
      no: "",
      atrofiadas: `<path d="M ${f1(ax)} ${f1(ay)} l -4 -9 l 8 3 Z" fill="${lejos}"/>`,
      pequeñas: `<path d="M ${f1(ax)} ${f1(ay)} q -3 -16 -18 -20 q 2 12 -2 22 Z" fill="${lejos}"/>`,
      membranosas: `<path d="M ${f1(ax)} ${f1(ay)} L ${f1(ax - 8)} ${f1(ay - 34)} L ${f1(ax - 20)} ${f1(ay - 22)} L ${f1(ax - 30)} ${f1(ay - 28)} L ${f1(ax - 34)} ${f1(ay - 6)} Z" fill="${lejos}" stroke="${oscuro}" stroke-width="1"/>` +
        `<path d="M ${f1(ax)} ${f1(ay)} L ${f1(ax - 8)} ${f1(ay - 34)} M ${f1(ax)} ${f1(ay)} L ${f1(ax - 20)} ${f1(ay - 22)} M ${f1(ax)} ${f1(ay)} L ${f1(ax - 30)} ${f1(ay - 28)}" stroke="${oscuro}" stroke-width="1" fill="none"/>`,
      emplumadas: [0, 1, 2, 3, 4].map(i => `<ellipse cx="${f1(ax - 4 - i * 3)}" cy="${f1(ay - 12 - i * 2)}" rx="3" ry="${12 - i}" fill="${i % 2 ? claro : lejos}" transform="rotate(${-10 - i * 14} ${f1(ax)} ${f1(ay)})"/>`).join("")
    }[R.alas] || "";

    /* ---- cuello */
    const N0 = [cuelloX - 3, cuelloY + 7], N3 = [cabX - cabezaX * 0.55, cabY + cabezaY * 0.25];
    const dx = N3[0] - N0[0], dy = N3[1] - N0[1];
    const serp = R.cuello === "serpentino";
    const N1 = serp ? [N0[0] + dx * 1.15, N0[1] + dy * 0.2] : [N0[0] + dx * 0.12, N0[1] + dy * 0.5];
    const N2 = serp ? [N0[0] - dx * 0.2, N0[1] + dy * 0.8] : [N0[0] + dx * 0.5, N0[1] + dy * 0.92];
    const anchoCuello = (8 + 7 * g("tamano_pecho")) * (R.cuello === "grueso" ? 1.45 : serp ? 0.8 : 1);
    let cuello = `<path d="${curva(N0, N1, N2, N3)}" fill="none" stroke="${base}" stroke-width="${f1(anchoCuello)}" stroke-linecap="round"/>`;
    if (R.cuello === "segmentado") for (let i = 1; i <= 6; i++) { const q = bez(N0, N1, N2, N3, 0.1 + i * 0.13), h = anchoCuello / 2 - 0.5; cuello += `<line x1="${f1(q.x + q.nx * h)}" y1="${f1(q.y + q.ny * h)}" x2="${f1(q.x - q.nx * h)}" y2="${f1(q.y - q.ny * h)}" stroke="${oscuro}" stroke-width="1.4" opacity=".7"/>`; }
    if (R.cuello === "melena") for (let i = 0; i < 8; i++) { const q = bez(N0, N1, N2, N3, 0.05 + i * 0.12), h = anchoCuello / 2; cuello += `<path d="M ${f1(q.x - q.nx * h)} ${f1(q.y - q.ny * h)} q ${f1(-q.nx * 5 - 2)} ${f1(-q.ny * 5 - 3)} ${f1(-q.nx * 8 - 4)} ${f1(-q.ny * 8 - 1)}" fill="none" stroke="${i % 2 ? oscuro : lejos}" stroke-width="2.4" stroke-linecap="round"/>`; }

    /* ---- cabeza (coordenadas locales: el hocico apunta a +x, arriba es -y) */
    const hocico = {
      medio: `<ellipse cx="${f1(cabezaX * 0.75)}" cy="${f1(cabezaY * 0.2)}" rx="${f1(cabezaX * 0.75)}" ry="${f1(cabezaY * 0.62)}"/>`,
      corto: `<ellipse cx="${f1(cabezaX * 0.35)}" cy="${f1(cabezaY * 0.15)}" rx="${f1(cabezaX * 0.55)}" ry="${f1(cabezaY * 0.8)}"/>`,
      largo: `<ellipse cx="${f1(cabezaX * 1.0)}" cy="${f1(cabezaY * 0.25)}" rx="${f1(cabezaX * 1.05)}" ry="${f1(cabezaY * 0.45)}"/>`,
      cuadrado: `<rect x="${f1(cabezaX * 0.2)}" y="${f1(-cabezaY * 0.4)}" width="${f1(cabezaX * 1.15)}" height="${f1(cabezaY * 1.1)}" rx="2.2"/>`,
      punta: `<path d="M ${f1(cabezaX * 0.1)} ${f1(-cabezaY * 0.7)} L ${f1(cabezaX * 1.75)} ${f1(cabezaY * 0.3)} L ${f1(cabezaX * 0.1)} ${f1(cabezaY * 0.85)} Z"/>`
    }[R.hocico] || "";
    const puntaX = { medio: 1.5, corto: 0.9, largo: 2.05, cuadrado: 1.35, punta: 1.75 }[R.hocico] * cabezaX;
    const ojo = (x, y, r) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="#101010"/><circle cx="${f1(x + r * 0.3)}" cy="${f1(y - r * 0.3)}" r="${f1(r * 0.35)}" fill="#fff" opacity=".8"/>`;
    let ojos = ojo(cabezaX * 0.2, -cabezaY * 0.22, 1.9);
    if (R.ojos === "tres" || R.ojos === "cuatro") ojos += ojo(-cabezaX * 0.12, -cabezaY * 0.62, 1.4);
    if (R.ojos === "cuatro") ojos += ojo(cabezaX * 0.45, -cabezaY * 0.2, 1.2) + ojo(-cabezaX * 0.35, -cabezaY * 0.2, 1.1);
    const ex = -cabezaX * 0.42, ey = -cabezaY * 0.8;   // base de las orejas
    const oreja = {
      pequeñas: `<path d="M ${f1(ex)} ${f1(ey)} l -2 -7 l 6 5 Z" fill="${oscuro}"/>`,
      largas: `<path d="M ${f1(ex)} ${f1(ey)} l -9 -13 l 11 8 Z" fill="${oscuro}"/>`,
      puntiagudas: `<path d="M ${f1(ex)} ${f1(ey)} l -1 -14 l 6 12 Z" fill="${oscuro}"/>`,
      caidas: `<path d="M ${f1(ex)} ${f1(ey)} q -9 0 -11 9 q 8 0 12 -4 Z" fill="${oscuro}"/>`,
      redondas: `<ellipse cx="${f1(ex - 1)}" cy="${f1(ey - 3)}" rx="3.4" ry="4.2" fill="${oscuro}"/>`,
      aleta: `<path d="M ${f1(ex + 2)} ${f1(ey)} L ${f1(ex - 8)} ${f1(ey - 7)} L ${f1(ex - 4)} ${f1(ey - 2)} L ${f1(ex - 11)} ${f1(ey - 2)} L ${f1(ex - 3)} ${f1(ey + 3)} Z" fill="${oscuro}"/>`,
      dobles: `<path d="M ${f1(ex)} ${f1(ey)} l -2 -8 l 6 6 Z" fill="${oscuro}"/><path d="M ${f1(ex + 5)} ${f1(ey + 1)} l -1 -7 l 5 5 Z" fill="${lejos}"/>`,
      ninguna: ""
    }[R.orejas] || "";
    const hx = cabezaX * 0.15, hy = -cabezaY * 0.85;    // base de los cuernos
    const cuer = (d, w) => `<path d="${d}" fill="none" stroke="${HUESO}" stroke-width="${w || 2.4}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const cuernos = ({
      ninguno: () => "",
      recto: () => cuer(`M ${f1(hx)} ${f1(hy)} l -3 -15`) + cuer(`M ${f1(hx - 5)} ${f1(hy + 0.5)} l -3 -13`, 2),
      atras: () => cuer(`M ${f1(hx)} ${f1(hy)} q -2 -9 -16 -9`) + cuer(`M ${f1(hx - 5)} ${f1(hy + 1)} q -3 -7 -14 -6`, 2),
      adelante: () => cuer(`M ${f1(hx + 2)} ${f1(hy)} q 3 -10 13 -11`) + cuer(`M ${f1(hx - 3)} ${f1(hy + 1)} q 2 -8 11 -9`, 2),
      curvo: () => cuer(`M ${f1(hx)} ${f1(hy)} c -9 -14 -20 -6 -16 4`, 3) + cuer(`M ${f1(hx - 5)} ${f1(hy + 1)} c -7 -10 -15 -3 -12 5`, 2),
      espiral: () => cuer(`M ${f1(hx)} ${f1(hy)} c -2 -8 -9 -9 -7 -15 c 1 -3 5 -3 5 0`, 3) + `<path d="M ${f1(hx - 1)} ${f1(hy - 4)} l -3 -1 M ${f1(hx - 2.5)} ${f1(hy - 8)} l 3 -1 M ${f1(hx - 5)} ${f1(hy - 12)} l -3 0" stroke="${oscuro}" stroke-width="0.9" fill="none"/>`,
      ramas: () => cuer(`M ${f1(hx)} ${f1(hy)} l -4 -17`, 2.2) + cuer(`M ${f1(hx - 1.5)} ${f1(hy - 6)} l 6 -6`, 1.8) + cuer(`M ${f1(hx - 2.6)} ${f1(hy - 11)} l -6 -4`, 1.8) + cuer(`M ${f1(hx - 3.6)} ${f1(hy - 15)} l 5 -4`, 1.6),
      corona: () => [0, 1, 2, 3, 4].map(i => cuer(`M ${f1(hx - 8 + i * 4.4)} ${f1(hy + 1 + Math.abs(2 - i) * 0.8)} l ${f1((i - 2) * 1.2)} -9`, 1.8)).join(""),
      lateral: () => cuer(`M ${f1(hx + 3)} ${f1(hy + 1)} l 12 -3`, 3) + cuer(`M ${f1(hx - 4)} ${f1(hy + 2)} l 10 -2`, 2),
      colmillos: () => cuer(`M ${f1(cabezaX * 0.85)} ${f1(cabezaY * 0.35)} q 1 7 -3 11`, 2.4) + cuer(`M ${f1(cabezaX * 0.4)} ${f1(cabezaY * 0.7)} q 0 6 -4 9`, 2),
      pequeños: () => `<circle cx="${f1(hx)}" cy="${f1(hy - 1)}" r="2.6" fill="${HUESO}"/><circle cx="${f1(hx - 5.5)}" cy="${f1(hy)}" r="2.1" fill="${HUESO}"/>`,
      unico: () => cuer(`M ${f1(cabezaX * 0.5)} ${f1(-cabezaY * 0.7)} l 5 -17`, 3),
      multiple: () => [0, 1, 2, 3, 4, 5].map(i => cuer(`M ${f1(-cabezaX * 0.5 + i * 3.6)} ${f1(hy + 1.5)} l ${f1(-2 + i * 0.8)} -6.5`, 1.7)).join("")
    }[R.cuernos] || (() => ""))();
    let marcaCabeza = "";
    if (R.patron === "cara") marcaCabeza = `<ellipse cx="${f1(cabezaX * 0.8)}" cy="${f1(cabezaY * 0.2)}" rx="${f1(cabezaX * 0.85)}" ry="${f1(cabezaY * 0.5)}" fill="${claro}" opacity=".8"/>`;
    if (R.patron === "mascara") marcaCabeza = `<ellipse cx="${f1(cabezaX * 0.3)}" cy="${f1(-cabezaY * 0.15)}" rx="${f1(cabezaX * 0.75)}" ry="${f1(cabezaY * 0.5)}" fill="${oscuro}" opacity=".6"/>`;
    const fosa = `<circle cx="${f1(puntaX * 0.88)}" cy="${f1(cabezaY * 0.1)}" r="1" fill="#101010" opacity=".7"/>`;
    const cabeza = `<g transform="translate(${f1(cabX)} ${f1(cabY)}) rotate(18)">` +
      `<g fill="${base}"><ellipse cx="0" cy="0" rx="${f1(cabezaX * 0.9)}" ry="${f1(cabezaY)}"/>${hocico}</g>` +
      marcaCabeza + oreja + cuernos + ojos + fosa + `</g>`;

    /* ---- espalda: todo se apoya en el contorno real del lomo */
    const ex0 = xFrente - 3, ex1 = xAtras - rCadera * 0.15;
    const pincho = (x, w, h, relleno, trazo) => {
      const n = normalLomo(x), y = yLomo(x), x1 = x - w / 2, x2 = x + w / 2;
      return `<path d="M ${f1(x1)} ${f1(yLomo(x1) + 1.2)} L ${f1(x + n[0] * h)} ${f1(y + n[1] * h)} L ${f1(x2)} ${f1(yLomo(x2) + 1.2)} Z" fill="${relleno}"${trazo ? ` stroke="${trazo}" stroke-width=".8" stroke-linejoin="round"` : ""}/>`;
    };
    let espalda = "";
    if (R.espalda === "cresta") for (let i = 0; i < 11; i++) espalda += pincho(ex0 + (ex1 - ex0) * i / 10, 3.6, 4.4, oscuro);
    if (R.espalda === "espinas") for (let i = 0; i < 5; i++) espalda += pincho(ex0 + (ex1 - ex0) * (i + 0.5) / 5, 7, 9.5, oscuro);
    if (R.espalda === "placas") for (let i = 0; i < 6; i++) espalda += pincho(ex0 + (ex1 - ex0) * (i + 0.5) / 6, 8.5, 5.5 + 2.5 * Math.sin((i + 0.5) / 6 * Math.PI), lejos, oscuro);
    if (R.espalda === "continua") {
      let alto_ = "", bajo_ = "";
      for (let i = 0; i <= 16; i++) { const x = ex0 + (ex1 - ex0) * i / 16, n = normalLomo(x), h = i % 2 ? 6.5 : 2.5; alto_ += ` L ${f1(x + n[0] * h)} ${f1(yLomo(x) + n[1] * h)}`; }
      for (let i = 16; i >= 0; i--) { const x = ex0 + (ex1 - ex0) * i / 16; bajo_ += ` L ${f1(x)} ${f1(yLomo(x) + 1.2)}`; }
      espalda += `<path d="M ${f1(ex0)} ${f1(yLomo(ex0) + 1.2)}${alto_}${bajo_} Z" fill="${oscuro}" opacity=".92"/>`;
    }

    /* ---- piel y patrones (recortados al cuerpo) */
    let capaCuerpo = "";
    const caja = `x="${f1(xAtras - rCadera - 2)}" y="${f1(cy - alto - 8)}" height="${f1(alto * 2 + 16)}"`;
    const ancho = (xFrente - xAtras) + rCadera + rPecho + 4;
    // volumen para todos: vientre algo más oscuro y una luz suave en el lomo
    capaCuerpo += `<ellipse cx="${f1(centro)}" cy="${f1(cy + alto * 0.62)}" rx="${f1(ancho * 0.55)}" ry="${f1(alto * 0.42)}" fill="${oscuro}" opacity=".16"/>`;
    if (R.piel === "escamas") capaCuerpo += `<rect ${caja} width="${f1(ancho)}" fill="url(#${uid}e)"/>`;
    if (R.piel === "mixta") capaCuerpo += `<rect ${caja} width="${f1(ancho * 0.55)}" fill="url(#${uid}e)"/>`;
    if (R.piel === "placas") for (let i = 0; i < 6; i++) { const x = xAtras - 4 + i * ((xFrente - xAtras + 10) / 6); capaCuerpo += `<path d="M ${f1(x)} ${f1(lomo - 9)} Q ${f1(x + 5)} ${f1(cy)} ${f1(x)} ${f1(cy + alto / 2 + 9)}" fill="none" stroke="${oscuro}" stroke-width="1.1" opacity=".38"/>`; }
    if (R.piel === "lisa") capaCuerpo += `<ellipse cx="${f1(centro)}" cy="${f1(cy - alto * 0.3)}" rx="${f1(ancho * 0.36)}" ry="${f1(alto * 0.14)}" fill="${claro}" opacity=".22"/>`;
    if (R.piel === "pelo" && g("pelaje") > 0.6) for (let i = 0; i < 9; i++) capaCuerpo += `<path d="M ${f1(xAtras - 6 + i * ((xFrente - xAtras + 14) / 9))} ${f1(cy + alto / 2 - 1)} q 1.2 3.4 -0.8 5.6" fill="none" stroke="${oscuro}" stroke-width="1.5" opacity=".45"/>`;
    if (R.patron === "dorsal") {
      let d = "";
      LOMO.forEach((q, i) => { if (q[0] >= xAtras - 2 && q[0] <= xFrente - 2) d += (d ? " L " : "M ") + f1(q[0]) + " " + f1(q[1] + 3); });
      capaCuerpo += `<path d="${d}" stroke="${oscuro}" stroke-width="5" stroke-linejoin="round" opacity=".5" fill="none"/>`;
    }
    if (R.patron === "bandas") for (let i = 0; i < 5; i++) { const x = xAtras + i * ((xFrente - xAtras) / 4.4); capaCuerpo += `<path d="M ${f1(x + 3)} ${f1(lomo - 9)} Q ${f1(x + 8)} ${f1(cy)} ${f1(x)} ${f1(cy + alto / 2 + 9)}" fill="none" stroke="${oscuro}" stroke-width="2.8" opacity=".4"/>`; }
    // manchas: del gen del motor (capa moteada o con manchas) o del patrón de identidad
    let manchas = "";
    const conManchas = /mancha|motead/.test(perfil.capa || "");
    if (conManchas || R.patron === "manchas") {
      let semilla = (perfil.id * 2654435761) >>> 0;
      const al = () => { semilla = (Math.imul(semilla, 1664525) + 1013904223) >>> 0; return semilla / 4294967296; };
      const cuantas = /motead/.test(perfil.capa || "") ? 9 : conManchas ? 4 : 5;
      for (let i = 0; i < cuantas; i++) manchas += `<circle cx="${f1(xAtras + al() * (xFrente - xAtras))}" cy="${f1(cy - alto * 0.3 + al() * alto * 0.6)}" r="${f1(2.2 + al() * 3.4)}" fill="${claro}" opacity=".75"/>`;
    }
    const sobreCuerpo = `<g clip-path="url(#${uid}c)">${capaCuerpo}${manchas}</g>`;

    /* ---- composición y encuadre */
    const alturaCuerno = ["ramas", "unico", "recto", "espiral", "curvo"].includes(R.cuernos) ? 20 : R.cuernos === "ninguno" ? 4 : 11;
    const arriba = Math.min(cabY - cabezaY - alturaCuerno, cuelloY - 6, R.alas === "membranosas" ? lomo - 36 : lomo - 18);
    const izq = Math.min(xAtras - rCadera - largoCola * (R.cola === "corta" ? 0.5 : 0.95) - 6, R.alas === "membranosas" ? ax - 36 : 999);
    const der = cabX + puntaX + 5;
    const kAlto = (suelo + 8) / Math.max(40, suelo - arriba), kAncho = 226 / Math.max(60, der - izq);
    const k = escala * Math.min(1, kAlto, kAncho), cx = (izq + der) / 2;

    return `<svg class="${opciones.clase || "hip-silueta"}" viewBox="0 -8 240 148" role="img" aria-label="${(opciones.titulo || perfil.nombre || "Criatura").replace(/"/g, "&quot;")}" xmlns="http://www.w3.org/2000/svg">` + defs +
      `<g transform="translate(120 ${suelo}) scale(${k.toFixed(3)}) translate(${f1(-cx)} ${-suelo})">` +
      `<ellipse cx="${f1(cx)}" cy="${suelo}" rx="${f1(Math.min(100, (der - izq) * 0.45))}" ry="3" fill="rgba(0,0,0,.28)"/>` +
      `<g class="hip-resp" style="animation-delay:-${(perfil.id % 7) * 0.6}s">` +
      (corre ? `<g><animateTransform attributeName="transform" type="translate" dur="${ciclo}s" repeatCount="indefinite" values="0 0;0 -2.6;0 0;0 -1.4;0 0"/>` : "") +
      alas + cola + patasLejos + cuello +
      `<path d="${cuerpoD}" fill="${relleno}"/>` + sobreCuerpo + espalda +
      patasCerca + cabeza +
      (corre ? `</g>` : "") +
      `</g></g></svg>`;
  }

  /* Para o reanuda el galope de un dibujo (svg) de la pista. Parado vuelve a la pose inicial. */
  function galope(svg, activo) {
    if (!svg || !svg.pauseAnimations) return;
    const q = activo ? "1" : "0";
    if (svg.dataset.galope === q) return;
    svg.dataset.galope = q;
    if (activo) svg.unpauseAnimations(); else { svg.setCurrentTime(0); svg.pauseAnimations(); }
  }

  return { silueta, colorCapa, registrar, rasgos, galope };
})();
