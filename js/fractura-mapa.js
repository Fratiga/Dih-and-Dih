/* =============================================================================
   LA FRACTURA: generación del mapa. Todo sale de una semilla, así que la misma semilla da el mismo
   mapa. El mapa es simétrico por giro de 180 grados para que los dos lados partan en igualdad:
   lo que hay en una casilla está también en la casilla opuesta.
   Casillas 13x13. Regiones: una cuadrícula de 3x3 fragmentos de 4, 5 y 4 casillas.
============================================================================= */
(function (raiz) {
  const D = raiz.FRACTURA_DATOS || (typeof require !== "undefined" ? require("./fractura-datos.js") : null);
  const S = raiz.FracturaSoldados || (typeof require !== "undefined" ? require("./fractura-soldados.js") : null);
  const { TERRENOS, TIPOS_FRACTURA, FRAGMENTOS } = D;
  const { rnd, ent } = S;

  const ANCHO = 13, ALTO = 13;
  const regionDe = (x, y) => (y < 4 ? 0 : y < 9 ? 3 : 6) + (x < 4 ? 0 : x < 9 ? 1 : 2);
  const espejo = (x, y, w, h) => ({ x: w - 1 - x, y: h - 1 - y });
  const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

  function pesoElegir(r, pesos) {
    let total = 0;
    Object.keys(pesos).forEach(k => { total += pesos[k]; });
    let v = rnd(r) * total;
    for (const k of Object.keys(pesos)) { v -= pesos[k]; if (v < 0) return k; }
    return Object.keys(pesos)[0];
  }

  function barajar(r, lista) {
    const a = lista.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = ent(r, i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  const pasable = c => TERRENOS[c.t].mov > 0;

  function conectado(casillas, w, h, a, b) {
    const visto = new Set([`${a.x},${a.y}`]);
    const cola = [a];
    while (cola.length) {
      const p = cola.shift();
      if (p.x === b.x && p.y === b.y) return true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = p.x + dx, y = p.y + dy;
        if (x < 0 || y < 0 || x >= w || y >= h || visto.has(`${x},${y}`) || !pasable(casillas[y][x])) continue;
        visto.add(`${x},${y}`);
        cola.push({ x, y });
      }
    }
    return false;
  }

  /* Pone la casilla y su opuesta */
  function poner(casillas, w, h, x, y, cambios) {
    const m = espejo(x, y, w, h);
    Object.assign(casillas[y][x], cambios);
    Object.assign(casillas[m.y][m.x], cambios);
  }

  function generarMapa(semilla, tipoId, opciones) {
    const tipo = TIPOS_FRACTURA[tipoId] || TIPOS_FRACTURA.reinos;
    const r = { s: (semilla >>> 0) || 1 };
    const w = ANCHO, h = ALTO;
    const n = w * h, mitad = (n - 1) / 2;

    // Regiones: los fragmentos de arriba se repiten abajo (el del centro es uno solo)
    const regiones = [];
    const nombresUsados = new Set();
    const tiposFr = {};
    for (let i = 0; i < 9; i++) {
      const op = 8 - i;
      let tf;
      if (i === 4) tf = tipoId === "reinos" || tipoId === "archivo" ? "onirico" : "imposible";
      else if (i > op) tf = tiposFr[op];
      else tf = pesoElegir(r, tipo.tiposFragmento);
      tiposFr[i] = tf;
    }
    for (let i = 0; i < 9; i++) {
      const tf = tiposFr[i];
      const pool = barajar(r, FRAGMENTOS[tf]).filter(nm => !nombresUsados.has(nm));
      const nombre = pool.length ? pool[0] : `${FRAGMENTOS[tf][0]} ${i}`;
      nombresUsados.add(nombre);
      regiones.push({ id: i, nombre: tf === "estable" ? `Fragmento de ${nombre}` : nombre, tipo: tf, estab: 0, dueno: null });
    }
    for (let i = 0; i < 9; i++) {
      const op = 8 - i;
      if (i < op) {
        const e = Math.round(tipo.estab[0] + rnd(r) * (tipo.estab[1] - tipo.estab[0]));
        const ajuste = regiones[i].tipo === "estable" ? 15 : regiones[i].tipo === "imposible" ? -15 : 0;
        regiones[i].estab = regiones[op].estab = Math.max(5, Math.min(100, e + ajuste));
      } else if (i === 4) {
        regiones[4].estab = Math.round(tipo.estab[0] + rnd(r) * (tipo.estab[1] - tipo.estab[0]));
      }
    }

    // Terreno
    const casillas = [];
    for (let y = 0; y < h; y++) { casillas.push([]); for (let x = 0; x < w; x++) casillas[y].push({ t: "llanura", region: regionDe(x, y), est: null, objetos: [] }); }
    for (let i = 0; i <= mitad; i++) {
      const x = i % w, y = Math.floor(i / w);
      const rg = regiones[regionDe(x, y)];
      const pesos = Object.assign({}, tipo.terrenos);
      if (rg.tipo === "onirico") { pesos.magica = (pesos.magica || 0) * 2 + 2; pesos.bosque = (pesos.bosque || 0) + 6; }
      if (rg.tipo === "imposible") { pesos.magica = (pesos.magica || 0) * 2 + 3; pesos.huesos = (pesos.huesos || 0) + 4; if (tipo.vacio) pesos.vacio = tipo.vacio * 1.3; }
      if (rg.tipo === "estable") { pesos.llanura = (pesos.llanura || 0) + 8; if (tipo.vacio) pesos.vacio = Math.round(tipo.vacio * 0.5); }
      const t = pesoElegir(r, pesos);
      poner(casillas, w, h, x, y, { t });
    }

    // Capitales en esquinas opuestas, con terreno amable alrededor
    const cap0 = { x: 1, y: 1 }, cap1 = espejo(1, 1, w, h);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = cap0.x + dx, y = cap0.y + dy;
      const t = !dx && !dy ? "llanura" : rnd(r) < 0.6 ? "llanura" : rnd(r) < 0.6 ? "bosque" : "montana";
      poner(casillas, w, h, x, y, { t });
    }
    // Núcleo del Sueño en el centro
    const centro = { x: (w - 1) / 2, y: (h - 1) / 2 };
    poner(casillas, w, h, centro.x, centro.y, { t: "llanura", est: "nucleo" });

    // Comunicación asegurada: si algo quedó aislado, se abre un camino (también simétrico)
    const abrir = (a, b) => {
      let x = a.x, y = a.y;
      while (x !== b.x || y !== b.y) {
        if (x !== b.x) x += Math.sign(b.x - x);
        if (y !== b.y) y += Math.sign(b.y - y);
        if (!pasable(casillas[y][x])) poner(casillas, w, h, x, y, { t: "llanura" });
      }
    };
    if (!conectado(casillas, w, h, cap0, cap1)) abrir(cap0, centro);
    if (!conectado(casillas, w, h, cap0, cap1)) abrir(cap0, cap1);

    const ocupadas = [cap0, cap1, centro];
    casillas[cap0.y][cap0.x].est = "ciudad"; casillas[cap1.y][cap1.x].est = "ciudad";
    const libre = (x, y, sep) => {
      const c = casillas[y][x];
      return !c.est && pasable(c) && ocupadas.every(o => dist(o, { x, y }) >= sep);
    };
    // Coloca pares de estructuras simétricas
    const colocar = (cuantos, est, sepCap, sepEntre) => {
      const pares = Math.max(1, Math.round(cuantos / 2));
      const puestos = [];
      let intentos = 0;
      while (puestos.length < pares && intentos++ < 400) {
        const i = ent(r, mitad);
        const x = i % w, y = Math.floor(i / w);
        if (dist(cap0, { x, y }) < sepCap || dist(cap1, { x, y }) < sepCap) continue;
        const m = espejo(x, y, w, h);
        if (!libre(x, y, sepEntre) || !libre(m.x, m.y, sepEntre) || dist({ x, y }, m) < 2) continue;
        poner(casillas, w, h, x, y, { est });
        ocupadas.push({ x, y }, m);
        puestos.push({ x, y }, m);
      }
      return puestos;
    };
    const sitios = colocar(tipo.neutrales, "ciudad", 4, 3);
    const fortalezas = colocar(tipo.fortalezas, "fortaleza", 3, 3);
    const ruinas = colocar(tipo.ruinas, "ruinas", 3, 2);

    // Costuras: cada una une una casilla con su opuesta
    const costuras = [];
    const pares = tipo.costuras;
    let intentos = 0;
    while (costuras.length < pares && intentos++ < 400) {
      const i = ent(r, mitad);
      const x = i % w, y = Math.floor(i / w);
      const m = espejo(x, y, w, h);
      if (dist(cap0, { x, y }) < 3 || dist(cap1, { x, y }) < 3) continue;
      if (!libre(x, y, 2) || !libre(m.x, m.y, 2)) continue;
      casillas[y][x].est = "costura"; casillas[m.y][m.x].est = "costura";
      casillas[y][x].costura = costuras.length; casillas[m.y][m.x].costura = costuras.length;
      costuras.push({ a: { x, y }, b: m });
      ocupadas.push({ x, y }, m);
    }

    return { ancho: w, alto: h, casillas, regiones, costuras, capitales: [cap0, cap1], nucleo: centro, sitios, fortalezas, ruinas, rng: r.s };
  }

  /* Mueve las costuras a otras casillas (en los mapas inestables). Devuelve true si algo cambió. */
  function moverCostura(est, r, indice, ocupado) {
    const w = est.ancho, h = est.alto, mitad = (w * h - 1) / 2;
    const c = est.costuras[indice];
    if (!c) return false;
    for (let intento = 0; intento < 60; intento++) {
      const i = ent(r, mitad);
      const x = i % w, y = Math.floor(i / w);
      const m = espejo(x, y, w, h);
      const a = est.casillas[y][x], b = est.casillas[m.y][m.x];
      if (a.est || b.est || !pasable(a) || !pasable(b)) continue;
      if (dist(est.capitales[0], { x, y }) < 3 || dist(est.capitales[1], { x, y }) < 3) continue;
      if (ocupado && (ocupado(x, y) || ocupado(m.x, m.y))) continue;
      const va = est.casillas[c.a.y][c.a.x], vb = est.casillas[c.b.y][c.b.x];
      va.est = null; delete va.costura; vb.est = null; delete vb.costura;
      a.est = "costura"; a.costura = indice; b.est = "costura"; b.costura = indice;
      c.a = { x, y }; c.b = m;
      return true;
    }
    return false;
  }

  raiz.FracturaMapa = { ANCHO, ALTO, regionDe, espejo, dist, generarMapa, moverCostura, conectado, pasable };
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.FracturaMapa;
})(typeof window !== "undefined" ? window : globalThis);
