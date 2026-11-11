/* =============================================================================
   LA FRACTURA: generación del mapa. Todo sale de una semilla, así que la misma semilla da el mismo
   mapa. El mapa es un trozo de mundo con silueta irregular: fuera queda el vacío (se pinta como mar
   o abismo). Los terrenos se agrupan en biomas y cada ciudad, fortaleza y el Núcleo tienen su
   provincia alrededor (las regiones).
   De 2 a 8 bandos. Con 2 el mapa es simétrico por giro de 180 grados y con 4, de 90. Con otro número
   no hay simetría exacta: cada bando recibe la misma zona de salida y los mismos sitios a distancias
   parecidas.
   La forma (opciones.forma) decide cómo se reparten la tierra y el agua: continente, lagos, ríos,
   continentes, archipiélago o mar interior. El agua ("agua") se navega; el vacío de fuera, no.
============================================================================= */
(function (raiz) {
  const D = raiz.FRACTURA_DATOS || (typeof require !== "undefined" ? require("./fractura-datos.js") : null);
  const S = raiz.FracturaSoldados || (typeof require !== "undefined" ? require("./fractura-soldados.js") : null);
  const { TERRENOS, TIPOS_FRACTURA, FRAGMENTOS } = D;
  const { rnd, ent } = S;

  // Tamaño del mapa según el número de bandos
  const TAMANOS = { 2: [17, 13], 3: [19, 17], 4: [19, 19], 5: [23, 21], 6: [25, 21], 7: [27, 23], 8: [27, 25] };
  const ANCHO = 17, ALTO = 13;
  const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const espejo = (x, y, w, h) => ({ x: w - 1 - x, y: h - 1 - y });
  const pasable = c => TERRENOS[c.t].mov > 0;

  function barajar(r, lista) {
    const a = lista.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = ent(r, i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function pesoElegir(r, pesos) {
    let total = 0;
    Object.keys(pesos).forEach(k => { total += pesos[k]; });
    let v = rnd(r) * total;
    for (const k of Object.keys(pesos)) { v -= pesos[k]; if (v < 0) return k; }
    return Object.keys(pesos)[0];
  }

  /* Ruido suave y repetible: valores al azar en una rejilla, interpolados */
  function hacerRuido(semilla) {
    const h = (x, y) => { let n = (x * 374761393 + y * 668265263 + semilla * 1442695041) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
    const sua = t => t * t * (3 - 2 * t);
    return (x, y) => {
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = sua(x - x0), fy = sua(y - y0);
      const a = h(x0, y0), b = h(x0 + 1, y0), c = h(x0, y0 + 1), d = h(x0 + 1, y0 + 1);
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
  }

  function conectado(casillas, w, h, a, b, pasa) {
    pasa = pasa || pasable;
    const visto = new Set([`${a.x},${a.y}`]);
    const cola = [a];
    while (cola.length) {
      const p = cola.shift();
      if (p.x === b.x && p.y === b.y) return true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = p.x + dx, y = p.y + dy;
        if (x < 0 || y < 0 || x >= w || y >= h || visto.has(`${x},${y}`) || !pasa(casillas[y][x])) continue;
        visto.add(`${x},${y}`);
        cola.push({ x, y });
      }
    }
    return false;
  }

  function generarMapa(semilla, tipoId, opciones) {
    opciones = opciones || {};
    const tipo = TIPOS_FRACTURA[tipoId] || TIPOS_FRACTURA.reinos;
    const N = Math.max(2, Math.min(8, opciones.bandos || 2));
    // El Horizonte Roto no tiene mar: son fragmentos flotando en el vacío, sea cual sea la forma pedida
    const sinMar = tipoId === "horizonte";
    const forma = !sinMar && D.FORMAS_MAPA[opciones.forma] ? opciones.forma : "continente";
    const maritimo = !!D.FORMAS_MAPA[forma].maritimo;
    const w = TAMANOS[N][0] + (maritimo ? 4 : 0), h = TAMANOS[N][1] + (maritimo ? 4 : 0);
    const sim = N === 2 ? 2 : N === 4 ? 4 : 1;
    const r = { s: (semilla >>> 0) || 1 };
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    const dentro = (x, y) => x >= 0 && y >= 0 && x < w && y < h;

    /* Las casillas que deben ser iguales por la simetría del mapa */
    const orbita = (x, y) => {
      if (sim === 2) { const m = espejo(x, y, w, h); return m.x === x && m.y === y ? [{ x, y }] : [{ x, y }, m]; }
      if (sim === 4) {
        const out = [{ x, y }];
        let p = { x, y };
        for (let i = 0; i < 3; i++) { p = { x: w - 1 - p.y, y: p.x }; if (!out.some(o => o.x === p.x && o.y === p.y)) out.push(p); }
        return out;
      }
      return [{ x, y }];
    };
    const canonica = (x, y) => orbita(x, y).reduce((m, p) => (p.y < m.y || (p.y === m.y && p.x < m.x) ? p : m));

    // --- Capitales: repartidas alrededor del centro ---
    const capitales = [];
    const angulo0 = N === 2 ? -Math.PI * 0.8 : -Math.PI / 2 - Math.PI / N;
    const capEn = k => {
      const a = angulo0 + (2 * Math.PI * k) / N;
      return { x: Math.max(1, Math.min(w - 2, Math.round(cx + Math.cos(a) * (w / 2) * 0.74))), y: Math.max(1, Math.min(h - 2, Math.round(cy + Math.sin(a) * (h / 2) * 0.72))) };
    };
    if (sim === 1) for (let k = 0; k < N; k++) capitales.push(capEn(k));
    else {
      // Con simetría, las demás capitales son la imagen de la primera, en el orden del giro
      let p = capEn(0);
      capitales.push(p);
      for (let k = 1; k < N; k++) { p = sim === 2 ? espejo(p.x, p.y, w, h) : { x: w - 1 - p.y, y: p.x }; capitales.push(p); }
    }
    const centro = { x: Math.round(cx), y: Math.round(cy) };

    // --- Silueta: qué es tierra, qué es agua navegable y qué queda fuera ---
    const rForma = hacerRuido(ent(r, 1e6)), rHueco = hacerRuido(ent(r, 1e6)), rIsla = hacerRuido(ent(r, 1e6));
    const casillas = [];
    for (let y = 0; y < h; y++) { casillas.push([]); for (let x = 0; x < w; x++) casillas[y].push({ t: "vacio", region: -1, est: null, objetos: [] }); }
    const poner = (x, y, cambios) => orbita(x, y).forEach(p => Object.assign(casillas[p.y][p.x], cambios));
    const formaDe = (x, y) => {
      const c = canonica(x, y);
      const dx = (c.x - cx) / (w / 2), dy = (c.y - cy) / (h / 2);
      const rr = Math.sqrt(dx * dx + dy * dy);
      let lim = 0.9 + (rForma(c.x * 0.3, c.y * 0.3) - 0.5) * 0.5;
      if (c.x === 0 || c.y === 0 || c.x === w - 1 || c.y === h - 1) lim -= 0.12;
      const dc = dist(c, centro);
      const dcap = capitales.reduce((m, p) => Math.min(m, dist(p, c)), 99);
      if (forma === "continentes") {
        if (rr >= lim + 0.05) return "vacio";
        if (dc <= 1) return "tierra";                 // la isla del Núcleo
        if (dc <= 3) return "agua";
        let d1 = 1e9, d2 = 1e9;
        capitales.forEach(p => { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; });
        if (d2 - d1 < 1.7 + rHueco(c.x * 0.4, c.y * 0.4) * 1.5) return "agua";   // el brazo de mar entre dos tierras
        return rr < lim ? "tierra" : "agua";
      }
      if (forma === "archipielago") {
        if (rr >= lim + 0.08) return "vacio";
        if (dc <= 1 || dcap <= 2) return "tierra";
        // Entre la isla de un bando y la del vecino siempre hay un canal
        let d1 = 1e9, d2 = 1e9;
        capitales.forEach(p => { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; });
        if (d2 - d1 < 1.5) return "agua";
        const v = rIsla(c.x * 0.46 + 2.3, c.y * 0.46) * 0.66 + rHueco(c.x * 1.05, c.y * 1.05) * 0.34 + Math.max(0, 0.2 - dcap * 0.04);
        return v > 0.58 ? "tierra" : "agua";
      }
      if (forma === "mar_interior") {
        if (rr >= lim + 0.04) return "vacio";
        if (dc <= 1) return "tierra";
        if (rr < 0.4 + (rHueco(c.x * 0.4, c.y * 0.4) - 0.5) * 0.16 || dc <= 3) return "agua";
        return "tierra";
      }
      if (tipo.vacio && rr > 0.2 && rHueco(c.x * 0.45 + 9, c.y * 0.45) < tipo.vacio / 100 * 0.9) return "vacio";
      if (forma === "lagos") {
        if (rr >= lim + 0.05) return "vacio";
        if (dc > 2 && dcap > 2 && rIsla(c.x * 0.34 + 5.1, c.y * 0.34) > 0.66) return "agua";
        return "tierra";
      }
      return rr < lim ? "tierra" : "vacio";
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const f = formaDe(x, y); if (f !== "vacio") casillas[y][x].t = f === "agua" ? "agua" : "llanura"; }

    // --- Biomas: cada terreno tiene su campo de ruido y gana el más alto. El sesgo se ajusta para acercarse al reparto del tipo ---
    const tipos = Object.keys(tipo.terrenos).filter(t => t !== "vacio" && tipo.terrenos[t] > 0 && !(maritimo && t === "agua"));
    const ESCALA = { llanura: 0.2, bosque: 0.27, montana: 0.3, desierto: 0.2, agua: 0.33, magica: 0.55, huesos: 0.42 };
    const campos = {}, sesgo = {};
    let totalPeso = 0;
    tipos.forEach(t => { campos[t] = hacerRuido(ent(r, 1e6)); totalPeso += tipo.terrenos[t]; });
    tipos.forEach(t => { sesgo[t] = (tipo.terrenos[t] / totalPeso - 1 / tipos.length) * 0.9; });
    const tierra = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = canonica(x, y); if (c.x === x && c.y === y && casillas[y][x].t === "llanura") tierra.push({ x, y }); }
    const elegirTerreno = p => {
      let mejor = null, mv = -9;
      tipos.forEach(t => { const v = campos[t](p.x * ESCALA[t] + 3.1, p.y * ESCALA[t] + 7.7) + sesgo[t]; if (v > mv) { mv = v; mejor = t; } });
      return mejor;
    };
    for (let it = 0; it < 12; it++) {
      const cuenta = {};
      tierra.forEach(p => { const t = elegirTerreno(p); cuenta[t] = (cuenta[t] || 0) + 1; });
      tipos.forEach(t => { sesgo[t] += (tipo.terrenos[t] / totalPeso - (cuenta[t] || 0) / Math.max(1, tierra.length)) * 0.55; });
    }
    tierra.forEach(p => poner(p.x, p.y, { t: elegirTerreno(p) }));

    // --- Ríos: nacen cerca del centro y bajan hasta el mar serpenteando. Cada pocos pasos dejan un vado. ---
    if (forma === "rios") {
      const cuantos = sim === 1 ? N + 1 : sim === 2 ? 2 : 1;
      for (let i = 0; i < cuantos; i++) {
        const ang = rnd(r) * Math.PI * 2, rumbo = rnd(r) * 20;
        let x = Math.round(cx + Math.cos(ang) * 2.6), y = Math.round(cy + Math.sin(ang) * 2.6);
        let paso = 0, vado = 2 + ent(r, 3);
        for (let n = 0; n < w + h; n++) {
          if (!dentro(x, y) || casillas[y][x].t === "vacio") break;
          if (capitales.every(c => dist(c, { x, y }) > 1) && dist(centro, { x, y }) > 1) {
            if (paso >= vado) { poner(x, y, { t: "llanura", vado: true }); vado = paso + 4 + ent(r, 3); }
            else if (!casillas[y][x].vado) poner(x, y, { t: "agua" });
          }
          paso++;
          const a = Math.atan2((y - cy) / h, (x - cx) / w) + (rHueco(x * 0.33 + rumbo, y * 0.33) - 0.5) * 2.5;
          if (Math.abs(Math.cos(a)) > Math.abs(Math.sin(a))) x += Math.sign(Math.cos(a)); else y += Math.sign(Math.sin(a));
        }
      }
    }

    // --- Zona de salida: igual para todos ---
    const patron = [];
    for (let i = 0; i < 9; i++) patron.push(i === 4 ? "llanura" : rnd(r) < 0.55 ? "llanura" : rnd(r) < 0.6 ? "bosque" : "montana");
    const sellar = cap => {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = cap.x + dx, y = cap.y + dy;
        if (!dentro(x, y)) continue;
        const borde = Math.max(Math.abs(dx), Math.abs(dy)) === 2;
        if (borde) { if (casillas[y][x].t === "vacio" && Math.abs(dx) + Math.abs(dy) < 4) casillas[y][x].t = "llanura"; continue; }
        casillas[y][x].t = patron[(dy + 1) * 3 + (dx + 1)];
      }
    };
    if (sim === 1) capitales.forEach(sellar);
    else { sellar(capitales[0]); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = capitales[0].x + dx, y = capitales[0].y + dy; if (dentro(x, y)) poner(x, y, { t: casillas[y][x].t }); } }
    // Núcleo del Sueño en el centro, con tierra alrededor
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c = casillas[centro.y + dy][centro.x + dx]; if (!pasable(c)) c.t = "llanura"; }
    casillas[centro.y][centro.x].t = "llanura";
    casillas[centro.y][centro.x].est = "nucleo";

    // --- Sitios: ciudades sin dueño, fortalezas y ruinas, los mismos para cada bando ---
    const ocupadas = capitales.map(c => ({ x: c.x, y: c.y })).concat([centro]);
    capitales.forEach(c => { casillas[c.y][c.x].est = "ciudad"; });
    const sitios = [], fortalezas = [], ruinas = [];
    const propio = (p, k) => capitales.every((c, i) => i === k || dist(c, p) >= dist(capitales[k], p));
    const valido = (p, sepCap, sepEntre) => dentro(p.x, p.y) && pasable(casillas[p.y][p.x]) && !casillas[p.y][p.x].est && p.x > 0 && p.y > 0 && p.x < w - 1 && p.y < h - 1 &&
      capitales.every(c => dist(c, p) >= sepCap) && ocupadas.every(o => dist(o, p) >= sepEntre);
    const escala = Math.max(1, Math.min(w, h) / 13);
    function buscar(k, objetivo, sepCap, sepEntre, haciaCentro) {
      const cap = capitales[k];
      let mejor = null;
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const p = { x, y };
        if (!valido(p, sepCap, sepEntre)) continue;
        if (sim > 1 && !orbita(x, y).every((q, i, arr) => valido(q, sepCap, sepEntre) && arr.every((o, j) => i === j || dist(o, q) >= 2))) continue;
        let v = Math.abs(dist(cap, p) - objetivo) * 1.4 + rnd(r) * 1.6;
        if (!propio(p, k)) v += 5;
        if (haciaCentro) v += Math.max(0, dist(p, centro) - dist(cap, centro) + 1) * 0.8;
        if (!mejor || v < mejor.v) mejor = { v, p };
      }
      return mejor ? mejor.p : null;
    }
    function colocar(lista, est, cuantosPorBando, objetivos, sepCap, sepEntre, haciaCentro) {
      for (let i = 0; i < cuantosPorBando; i++) {
        const bandos = sim === 1 ? N : 1;
        for (let k = 0; k < bandos; k++) {
          const obj = Math.round(objetivos[i % objetivos.length] * escala);
          // Si el mapa está muy apretado se aceptan sitios algo más juntos antes que dejar a un bando sin el suyo
          const p = buscar(k, obj, sepCap, sepEntre, haciaCentro && i % 2 === 1) || buscar(k, obj, sepCap - 1, sepEntre - 1, false) || buscar(k, obj, 2, 1, false);
          if (!p) continue;
          orbita(p.x, p.y).forEach(q => { casillas[q.y][q.x].est = est; ocupadas.push(q); lista.push({ x: q.x, y: q.y }); });
        }
      }
    }
    colocar(sitios, "ciudad", Math.max(1, Math.round(tipo.neutrales / 2)), [4, 6, 5, 7], 4, 3, true);
    colocar(fortalezas, "fortaleza", Math.max(1, Math.round(tipo.fortalezas / 2)), [5, 7], 3, 3, true);
    colocar(ruinas, "ruinas", Math.max(1, Math.round(tipo.ruinas / 2)), [3, 6, 5, 7], 3, 2, false);

    // --- Comunicación asegurada: todo sitio importante se alcanza desde la primera capital ---
    const pasa = maritimo ? (c => pasable(c) || c.t === "agua") : pasable;
    const abrir = (a, b) => {
      let x = a.x, y = a.y;
      while (x !== b.x || y !== b.y) {
        if (x !== b.x) x += Math.sign(b.x - x);
        if (y !== b.y) y += Math.sign(b.y - y);
        if (!pasa(casillas[y][x])) poner(x, y, { t: maritimo && casillas[y][x].t === "vacio" ? "agua" : "llanura" });
      }
    };
    capitales.concat(sitios, fortalezas).forEach(p => { if (!conectado(casillas, w, h, p, centro, pasa)) abrir(p, centro); });
    ruinas.forEach(p => { if (!conectado(casillas, w, h, p, centro, pasa)) abrir(p, centro); });

    // --- El mar de alrededor: dos casillas de agua navegable pegadas a la costa. Más allá, mar abierto. ---
    if (!sinMar) {
      const costa = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (casillas[y][x].t !== "vacio") continue;
        let cerca = false;
        for (let dy = -2; dy <= 2 && !cerca; dy++) for (let dx = -2; dx <= 2; dx++) if (dentro(x + dx, y + dy) && casillas[y + dy][x + dx].t !== "vacio" && casillas[y + dy][x + dx].t !== "agua") { cerca = true; break; }
        if (cerca) costa.push({ x, y });
      }
      costa.forEach(p => { casillas[p.y][p.x].t = "agua"; });
      // En los mapas marítimos toda capital tiene el agua a dos casillas, para poder hacer su muelle
      if (maritimo) {
        const cala = cap => {
          let m = null;
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (casillas[y][x].t === "agua") { const d = dist(cap, { x, y }); if (!m || d < m.d) m = { x, y, d }; }
          if (!m || m.d <= 2) return;
          let x = m.x, y = m.y;
          while (dist(cap, { x, y }) > 2) {
            x += Math.sign(cap.x - x); y += Math.sign(cap.y - y);
            if (casillas[y][x].est) break;
            poner(x, y, { t: "agua" });
          }
        };
        if (sim === 1) capitales.forEach(cala); else cala(capitales[0]);
      }
    }

    // --- Provincias: cada ciudad, fortaleza y el Núcleo extienden la suya hasta tocar la del vecino ---
    const semillas = capitales.map((p, k) => ({ x: p.x, y: p.y, capital: k })).concat(sitios.map(p => ({ x: p.x, y: p.y })), fortalezas.map(p => ({ x: p.x, y: p.y, fortaleza: true })), [{ x: centro.x, y: centro.y, nucleo: true }]);
    const rBorde = hacerRuido(ent(r, 1e6));
    const coste = new Array(w * h).fill(1e9);
    const abiertos = [];
    semillas.forEach((sm, i) => { coste[sm.y * w + sm.x] = 0; casillas[sm.y][sm.x].region = i; abiertos.push(sm.y * w + sm.x); });
    while (abiertos.length) {
      abiertos.sort((a, b) => coste[a] - coste[b]);
      const i = abiertos.shift();
      const x = i % w, y = Math.floor(i / w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!dentro(nx, ny) || casillas[ny][nx].t === "vacio") continue;
        const cn = canonica(nx, ny);
        const nc = coste[i] + 1 + rBorde(cn.x * 0.5, cn.y * 0.5) * 0.9 + (casillas[ny][nx].t === "agua" ? 1.6 : 0);
        if (nc < coste[ny * w + nx]) { coste[ny * w + nx] = nc; casillas[ny][nx].region = casillas[y][x].region; abiertos.push(ny * w + nx); }
      }
    }
    // Islas sueltas: a la provincia de la semilla más cercana
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = casillas[y][x];
      if (c.t === "vacio" || c.region >= 0) continue;
      let m = 0;
      semillas.forEach((sm, i) => { if (dist(sm, { x, y }) < dist(semillas[m], { x, y })) m = i; });
      c.region = m;
    }
    const nombresUsados = new Set();
    const regiones = semillas.map((sm, i) => {
      const tf = sm.capital !== undefined ? "estable" : sm.nucleo ? (tipoId === "reinos" || tipoId === "archivo" ? "onirico" : "imposible") : pesoElegir(r, tipo.tiposFragmento);
      const pool = barajar(r, FRAGMENTOS[tf]).filter(nm => !nombresUsados.has(nm));
      const nombre = pool.length ? pool[0] : `${FRAGMENTOS[tf][i % FRAGMENTOS[tf].length]} ${i}`;
      nombresUsados.add(nombre);
      const e = Math.round(tipo.estab[0] + rnd(r) * (tipo.estab[1] - tipo.estab[0])) + (tf === "estable" ? 15 : tf === "imposible" ? -15 : 0);
      return { id: i, nombre: tf === "estable" ? `Fragmento de ${nombre}` : nombre, tipo: tf, estab: Math.max(5, Math.min(100, e)), dueno: null, sitio: { x: sm.x, y: sm.y }, capitalDe: sm.capital === undefined ? null : sm.capital };
    });

    // --- Costuras: pares de casillas unidas, lejos una de otra ---
    const costuras = [];
    const pares = Math.max(1, Math.round(tipo.costuras * N / 2));
    const candidatas = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (valido({ x, y }, 3, 1)) candidatas.push({ x, y });
    const lejos = Math.min(w, h) * 0.34;
    barajar(r, candidatas).forEach(a => {
      if (costuras.length >= pares || !valido(a, 3, 1)) return;
      let b = null;
      if (sim > 1) { const o = orbita(a.x, a.y); if (o.length > 1) b = o[1 + ent(r, o.length - 1)]; }
      else b = barajar(r, candidatas).find(q => dist(a, q) >= lejos && valido(q, 3, 1)) || null;
      if (!b || dist(a, b) < lejos || !valido(b, 3, 1)) return;
      casillas[a.y][a.x].est = "costura"; casillas[b.y][b.x].est = "costura";
      casillas[a.y][a.x].costura = costuras.length; casillas[b.y][b.x].costura = costuras.length;
      costuras.push({ a, b });
      ocupadas.push(a, b);
    });

    return { ancho: w, alto: h, casillas, regiones, costuras, capitales, nucleo: centro, sitios, fortalezas, ruinas, rng: r.s, sim, bandos: N, forma, maritimo };
  }

  /* Mueve una costura a otras dos casillas (en los mapas inestables). Devuelve true si algo cambió. */
  function moverCostura(est, r, indice, ocupado) {
    const w = est.ancho, h = est.alto;
    const c = est.costuras[indice];
    if (!c) return false;
    const libre = p => { const k = est.casillas[p.y][p.x]; return !k.est && pasable(k) && est.capitales.every(cap => dist(cap, p) >= 3) && !(ocupado && ocupado(p.x, p.y)); };
    for (let intento = 0; intento < 80; intento++) {
      const a = { x: 1 + ent(r, w - 2), y: 1 + ent(r, h - 2) }, b = { x: 1 + ent(r, w - 2), y: 1 + ent(r, h - 2) };
      if (dist(a, b) < Math.min(w, h) * 0.4 || !libre(a) || !libre(b)) continue;
      const va = est.casillas[c.a.y][c.a.x], vb = est.casillas[c.b.y][c.b.x];
      va.est = null; delete va.costura; vb.est = null; delete vb.costura;
      const na = est.casillas[a.y][a.x], nb = est.casillas[b.y][b.x];
      na.est = "costura"; na.costura = indice; nb.est = "costura"; nb.costura = indice;
      c.a = a; c.b = b;
      return true;
    }
    return false;
  }

  raiz.FracturaMapa = { ANCHO, ALTO, TAMANOS, espejo, dist, generarMapa, moverCostura, conectado, pasable };
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.FracturaMapa;
})(typeof window !== "undefined" ? window : globalThis);
