// Prueba del hipódromo: nombres, cuerpo y genes, la carrera, cuotas y apuestas, y un mundo largo (años de carreras).
// Termina con un informe de equilibrio. Uso: node tools/probar-hipodromo.js [--rapido]
const vm = require("vm"), fs = require("fs"), path = require("path");
const rapido = process.argv.includes("--rapido");
const sb = { console }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
for (const f of ["data/hipodromo-palabras.js", "js/hipodromo-nombres.js", "js/hipodromo-motor.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), sb, { filename: f });
const M = sb.HipodromoMotor, N = sb.HipodromoNombres, P = sb.HIPODROMO_PALABRAS, I = M._interno, C = M.C;
const fallos = []; let n = 0;
const ok = (c, msg) => { n++; if (!c) fallos.push(msg); };
const media = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const desv = a => { const m = media(a); return Math.sqrt(media(a.map(x => (x - m) * (x - m)))); };
const mediana = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
const pct = x => (x * 100).toFixed(1) + " %";
const informe = [];
const T0 = Date.now();

// 1) Azar repetible
{ const a = M.crearRng("x", 1), b = M.crearRng("x", 1), c = M.crearRng("x", 2);
  const sa = Array.from({ length: 5 }, () => a.f()), sb2 = Array.from({ length: 5 }, () => b.f()), sc = Array.from({ length: 5 }, () => c.f());
  ok(JSON.stringify(sa) === JSON.stringify(sb2), "misma semilla, misma secuencia");
  ok(JSON.stringify(sa) !== JSON.stringify(sc), "semillas distintas, secuencias distintas");
  const r = M.crearRng("dist"); const xs = Array.from({ length: 20000 }, () => r.f());
  ok(Math.abs(media(xs) - 0.5) < 0.01 && xs.every(x => x >= 0 && x < 1), "f() es uniforme en [0,1)");
  const ns = Array.from({ length: 20000 }, () => r.norm(5, 2));
  ok(Math.abs(media(ns) - 5) < 0.08 && Math.abs(desv(ns) - 2) < 0.08, "norm() tiene la media y la desviación pedidas");
  const bar = r.baraja([1, 2, 3, 4, 5, 6]); ok(bar.slice().sort().join() === "1,2,3,4,5,6", "baraja conserva los elementos"); }

// 2) Nombres
{ const rng = M.crearRng("nombres"), usados = {}, meta = [];
  const total = 6000;
  for (let i = 0; i < total; i++) meta.push(N.nombrar(rng, { sexo: i % 2 ? "f" : "m", usados }));
  const nombres = meta.map(x => x.nombre);
  ok(new Set(nombres.map(x => x.toLowerCase())).size === total, "los 6000 nombres son únicos");
  ok(nombres.every(x => !/undefined|NaN|\[object|  |^ | $/.test(x)), "ningún nombre tiene undefined, NaN ni espacios raros");
  ok(nombres.every(x => x.length <= N.LARGO_MAX + 6), "ningún nombre pasa del largo máximo (más el numeral)");
  const minusc = new Set(["de", "del", "la", "o", "y", "of", "the"]);
  ok(nombres.every(x => x.split(" ").every(w => /^[A-ZÁÉÍÓÚÑ0-9]/.test(w) || minusc.has(w))), "cada palabra empieza en mayúscula (salvo de, del, la, of, the...)");
  ok(nombres.every(x => !/[—–]/.test(x)), "sin rayas largas en los nombres");
  const por = k => meta.filter(x => x.idioma === k).length / total;
  informe.push(`nombres: español ${pct(por("es"))}, inglés ${pct(por("en"))}, mezclados ${pct(por("mixto"))}, repetidos con numeral ${pct(nombres.filter(x => / (II|III|IV|V|VI|VII|VIII|IX|X)$/.test(x)).length / total)}`);
  ok(por("es") > 0.35 && por("es") < 0.55 && por("en") > 0.35 && por("en") < 0.55, "español e inglés van equilibrados");
  ok(por("mixto") > 0.05 && por("mixto") < 0.16, "alrededor del 10 % mezcla idiomas");
  const ra = M.crearRng("anomalos"); const libres = Array.from({ length: 6000 }, () => N.nombrar(ra, { sexo: "m" }));
  const anom = libres.filter(x => x.plantilla === "anomalo").length / libres.length; ok(anom > 0.015 && anom < 0.045, `los nombres absurdos son raros (${pct(anom)})`); informe.push(`nombres absurdos de una pieza: ${pct(anom)}`);
  // concordancia en español: adjetivo + sustantivo
  const sust = new Map(P.es.sustantivos.map(s => [s.s, s]));
  const adj = P.es.adjetivos;
  let revisadas = 0, malas = [];
  meta.filter(x => x.plantilla === "adjsust" && x.idioma === "es").forEach(x => {
    const w = x.nombre.split(" "); if (w.length !== 2) return;
    const [a, b] = sust.has(w[0]) ? [w[1], sust.get(w[0])] : [w[0], sust.get(w[1])];
    if (!b) return;
    revisadas++;
    const bien = adj.some(ad => (b.g === "f" ? ad.f : ad.m) === a);
    if (!bien) malas.push(x.nombre);
  });
  ok(revisadas > 400 && malas.length === 0, `el adjetivo concuerda con el sustantivo (${revisadas} revisados, mal: ${malas.slice(0, 3).join(", ")})`);
  // "del" y "de la"
  let dd = 0, mal = [];
  meta.filter(x => x.plantilla === "sustdesust" && x.idioma === "es").forEach(x => {
    const m1 = x.nombre.match(/^(.+?) (del|de la|de) (.+)$/); if (!m1) return;
    const b = sust.get(m1[3]); if (!b) return; dd++;
    if (m1[2] === "del" && b.g !== "m") mal.push(x.nombre);
    if (m1[2] === "de la" && b.g !== "f") mal.push(x.nombre);
  });
  ok(dd > 200 && mal.length === 0, `"del" con masculino y "de la" con femenino (${dd} revisados, mal: ${mal.slice(0, 3).join(", ")})`);
  ok(!nombres.some(x => /\bde el\b/i.test(x)), 'nunca sale "de el"');
  // títulos según el sexo
  const rf = M.crearRng("titf"), rm = M.crearRng("titm");
  const titF = new Set([...P.es.titulos.map(t => t.f), "Lady", "Miss", "Captain", "Sergeant", "Doctor", "Master", "Admiral", "Professor"]);
  const titM = new Set([...P.es.titulos.map(t => t.m), "Sir", "Baron", "Count", "Duke", "Captain", "Sergeant", "Doctor", "Master", "Admiral", "Professor"]);
  const tf = [], tm = [];
  for (let i = 0; i < 3000; i++) { tf.push(N.nombrar(rf, { sexo: "f" })); tm.push(N.nombrar(rm, { sexo: "m" })); }
  ok(tf.filter(x => x.plantilla === "titulo").every(x => titF.has(x.nombre.split(" ")[0])), "las hembras reciben títulos femeninos");
  ok(tm.filter(x => x.plantilla === "titulo").every(x => titM.has(x.nombre.split(" ")[0])), "los machos reciben títulos masculinos");
  const malF = tf.filter(x => x.plantilla === "titulo" && /^(Sir|Baron|Count|Duke|Don|Señor|Barón|Conde|Duque|Fray) /.test(x.nombre));
  ok(malF.length === 0, "ninguna hembra con título de macho: " + malF.slice(0, 3).map(x => x.nombre).join(", "));
  // herencia
  const rh = M.crearRng("herencia"), padres = [{ nombre: "Trueno Hambriento" }, { nombre: "Biscuit of the Moon" }];
  const her = Array.from({ length: 800 }, () => N.nombrar(rh, { sexo: "m", padres }));
  const conF = her.filter(x => x.frag);
  ok(conF.length > 800 * 0.2 && conF.length < 800 * 0.5, `se hereda una palabra de los padres en torno al 38 % (${pct(conF.length / 800)})`);
  ok(conF.every(x => x.nombre.toLowerCase().includes(x.frag.toLowerCase()) && x.nombre !== "Trueno Hambriento"), "el nombre heredado contiene la palabra heredada y no copia al padre");
  informe.push(`herencia: ${conF.slice(0, 5).map(x => x.nombre).join(", ")}`);
  // carreras
  const rc = M.crearRng("carreras");
  ["gran", "selecta", "corriente", "novatos"].forEach(g => { const v = Array.from({ length: 200 }, () => N.nombrarCarrera(rc, g)); ok(v.every(x => x && !/undefined|\bde el\b/.test(x)), `nombres de carrera ${g} bien formados`); informe.push(`carrera ${g}: ${v.slice(0, 3).join(" / ")}`); });
  // palabras
  const todas = JSON.stringify(P);
  ok(!/[—–]/.test(todas), "las listas de palabras no llevan rayas largas");
  ["es", "en"].forEach(l => ["sustantivos", "adjetivos", "objetos", "verbos", "conceptos", "titulos", "nombres", "serios", "frases", "anomalos"].forEach(k => ok(P[l][k] && P[l][k].length >= 8, `lista ${l}.${k} con palabras suficientes`)));
  ok(new Set(P.es.sustantivos.map(s => s.s)).size === P.es.sustantivos.length && new Set(P.en.sustantivos).size === P.en.sustantivos.length, "sin sustantivos repetidos"); }

// 3) Cuerpo y genes
{ const rng = M.crearRng("genes"), mundo = { sigId: 0, nombres: {} };
  const cs = Array.from({ length: 300 }, () => I.nuevaCriatura(mundo, rng, { nac: 0 }));
  ok(cs.every(c => M.cuerpo(c).length === 8 && M.cuerpo(c).every(p => p.nivel >= 1 && p.nivel <= 5 && p.texto)), "el cuerpo tiene 8 partes con nivel 1-5 y texto");
  ok(M.GENES.every(k => { const v = cs.map(c => [c.genes[k], I.nivelDe(c.genes[k])]).sort((a, b) => a[0] - b[0]); return v.every((x, i) => i === 0 || x[1] >= v[i - 1][1]); }), "el nivel del cuerpo sube con el gen");
  ok(cs.every(c => M.STATS.every(s => I.statsBase(c)[s] >= 8 && I.statsBase(c)[s] <= 100)), "las estadísticas quedan entre 8 y 100");
  const a = cs[0].genes, b = cs[1].genes, hijos = Array.from({ length: 3000 }, () => I.mezclarGenes(rng, a, b));
  ok(hijos.every(h => M.GENES.every(k => h[k] >= 0.02 && h[k] <= 0.98)), "los genes de las crías se quedan entre 0.02 y 0.98");
  ok(M.GENES.every(k => Math.abs(media(hijos.map(h => h[k])) - (a[k] + b[k]) / 2) < 0.04 && desv(hijos.map(h => h[k])) > 0.03), "las crías salen de la mitad de los padres con variación");
  const fr = [...cs].sort((x, y) => (x.genes.pat + x.genes.pul + x.genes.mus) - (y.genes.pat + y.genes.pul + y.genes.mus));
  ok(I.fragilidad(fr[fr.length - 1]) > I.fragilidad(fr[0]), "las más completas se lesionan más");
  informe.push(`fundadores: fragilidad ${I.fragilidad(fr[0]).toFixed(2)} - ${I.fragilidad(fr[fr.length - 1]).toFixed(2)}, velocidad media ${media(cs.map(c => I.statsBase(c).vel)).toFixed(1)} (desv ${desv(cs.map(c => I.statsBase(c).vel)).toFixed(1)})`); }

// 4) La carrera
const base = (x) => Object.assign({ id: 1, puerta: 1, vel: 60, res: 60, ace: 60, agi: 60, tem: 60, ritmo: 0.5, frag: 0.75, fatiga: 0 }, x || {});
const condBase = (dist, x) => Object.assign({ clima: "despejado", hum: 0.2, temp: 0.1, ruido: 1, incid: 1, dist, nSeg: dist / 100, curvas: 0.4, costeTramo: 1.05 }, x || {});
// de cada 8: un corredor especial contra siete normales; devuelve cuántas veces gana el especial
function victorias(especial, cond, otros, veces) {
  let g = 0;
  for (let j = 0; j < veces; j++) {
    const r = M.crearRng("v", JSON.stringify(especial), JSON.stringify(cond.dist), j);
    const es = [base(Object.assign({ id: 0, puerta: 1 }, especial))].concat(Array.from({ length: 7 }, (_, k) => base(Object.assign({ id: k + 1, puerta: k + 2 }, otros || {}))));
    const out = I.ordenLlegada(I.simular(r, es, cond));
    if (out[0].id === 0) g++;
  }
  return g / veces;
}
function cabezaACabeza(a, b, cond, veces) {
  let g = 0;
  for (let j = 0; j < veces; j++) {
    const r = M.crearRng("hh", JSON.stringify(a), JSON.stringify(b), cond.dist, j);
    const es = [base(Object.assign({ id: 0, puerta: 1 }, a)), base(Object.assign({ id: 1, puerta: 2 }, b))];
    if (I.ordenLlegada(I.simular(r, es, cond))[0].id === 0) g++;
  }
  return g / veces;
}
{ const V = rapido ? 500 : 1500;
  const cond = condBase(1200), es = Array.from({ length: 8 }, (_, k) => base({ id: k, puerta: k + 1 }));
  const o1 = I.simular(M.crearRng("det"), es, cond), o2 = I.simular(M.crearRng("det"), es, cond);
  ok(JSON.stringify(o1) === JSON.stringify(o2), "la misma semilla da la misma carrera");
  const orden = I.ordenLlegada(o1);
  ok(orden.length === 8 && new Set(orden.map(o => o.id)).size === 8, "llegan todos y cada uno una vez");
  ok(orden.every((o, i) => i === 0 || o.t >= orden[i - 1].t), "la clasificación está ordenada por tiempo");
  ok(o1.every(o => o.tramos.length === 12 && o.tramos.every((t, i) => t > 0 && (i === 0 || t > o.tramos[i - 1]))), "los tiempos por tramo crecen y hay uno por cada 100 m");
  // velocidad y resistencia según la distancia
  const c800 = condBase(800), c3000 = condBase(3000), c1600 = condBase(1600);
  const nulo = { incid: 0 };
  const v800 = cabezaACabeza({ vel: 80, res: 40 }, { vel: 50, res: 85 }, condBase(800, nulo), V);
  const v3000 = cabezaACabeza({ vel: 80, res: 40 }, { vel: 50, res: 85 }, condBase(3000, nulo), V);
  ok(v800 > 0.7 && v3000 < 0.3, `el velocista gana en 800 (${pct(v800)}) y pierde en 3000 (${pct(v3000)}) ante el fondista`);
  informe.push(`velocista (vel 80, res 40) contra fondista (vel 50, res 85): gana el ${pct(v800)} en 800 m y el ${pct(v3000)} en 3000 m`);
  const sprint = victorias({ vel: 80 }, condBase(1000), {}, V), igual = victorias({}, condBase(1000), {}, V);
  ok(sprint > igual + 0.12, `+20 de velocidad ayuda (${pct(sprint)} contra ${pct(igual)})`);
  ok(Math.abs(igual - 0.125) < 0.04, `un corredor normal gana 1 de 8 (${pct(igual)})`);
  const resSprint = victorias({ res: 90 }, condBase(800), {}, V), resFondo = victorias({ res: 90 }, condBase(3000), {}, V);
  ok(resFondo > resSprint + 0.1, `la resistencia pesa más en 3000 (${pct(resFondo)}) que en 800 (${pct(resSprint)})`);
  // terreno y clima
  const mojado = condBase(1600, { hum: 0.9, temp: -0.3 }), seco = condBase(1600, { hum: 0.0 });
  const ancha = { genes: null };
  // el efecto de la pezuña, el pelaje, el cansancio y la forma entra por efectivo(): se mide con la misma criatura cambiando una sola cosa
  const mundo = { n: 400, sigId: 0, nombres: {} }, rg = M.crearRng("terr");
  const molde = I.nuevaCriatura(mundo, rg, { nac: 0 });
  const var1 = (cambios) => { const c = JSON.parse(JSON.stringify(molde)); c.fatiga = 0; c.forma = 0; Object.keys(cambios).forEach(k => { if (k in c.genes) c.genes[k] = cambios[k]; else c[k] = cambios[k]; }); return c; };
  const difVel = (A, B, cond) => I.efectivo(mundo, var1(A), cond, 1).vel - I.efectivo(mundo, var1(B), cond, 2).vel;
  const gAncha = { pez: 0.95 }, gFina = { pez: 0.05 };
  ok(difVel(gAncha, gFina, I.condiciones({ pista: "charco", dist: 1600, mojadoPrevio: 0.8 }, "lluvia")) > 15, "con barro, la pezuña ancha rinde más que la fina");
  ok(difVel(gAncha, gFina, I.condiciones({ pista: "ceniza", dist: 1600, mojadoPrevio: 0 }, "despejado")) < 0, "con pista seca, la pezuña fina rinde más que la ancha");
  ok(difVel({ pel: 0.05 }, { pel: 0.95 }, I.condiciones({ pista: "silver", dist: 1600, mojadoPrevio: 0 }, "calor")) > 15, "con calor, el pelaje ralo rinde más que el denso");
  ok(difVel({ pel: 0.95 }, { pel: 0.05 }, I.condiciones({ pista: "silver", dist: 1600, mojadoPrevio: 0 }, "nublado")) > 0, "con tiempo fresco, el pelaje denso rinde más que el ralo");
  ok(I.condiciones({ pista: "ceniza", dist: 1600, mojadoPrevio: 0.5 }, "lluvia").hum < I.condiciones({ pista: "charco", dist: 1600, mojadoPrevio: 0.5 }, "lluvia").hum, "la pista que drena bien se moja menos que la de arcilla");
  // cansancio y forma: en partidas de dos, con los valores que salen de efectivo()
  { const condF = condBase(1600), h2h = (A, B) => { let g = 0; const K = 800;
      for (let j = 0; j < K; j++) { const ea = I.efectivo(mundo, var1(A), condF, 1), eb = I.efectivo(mundo, var1(B), condF, 2); ea.id = 0; eb.id = 1; if (I.ordenLlegada(I.simular(M.crearRng("h2h", JSON.stringify(A), j), [ea, eb], condF))[0].id === 0) g++; }
      return g / K; };
    const cans = h2h({ fatiga: 60 }, {}), buena = h2h({ forma: 1.5 }, { forma: -1.5 });
    ok(cans < 0.4, `una criatura cansada pierde ante una fresca (gana el ${pct(cans)})`);
    ok(buena > 0.6, `una criatura en forma gana a una en baja forma (${pct(buena)})`); }
  // duelo de líderes
  { let tSolo = 0, tDuelo = 0; const K = 200;
    for (let j = 0; j < K; j++) {
      const r1 = M.crearRng("duelo", j), r2 = M.crearRng("duelo", j);
      const a = [base({ id: 0, puerta: 1, ritmo: 0.9 })].concat(Array.from({ length: 5 }, (_, k) => base({ id: k + 1, puerta: k + 2, ritmo: 0.3 })));
      const b = [base({ id: 0, puerta: 1, ritmo: 0.9 })].concat(Array.from({ length: 2 }, (_, k) => base({ id: k + 1, puerta: k + 2, ritmo: 0.9 })), Array.from({ length: 3 }, (_, k) => base({ id: k + 3, puerta: k + 4, ritmo: 0.3 })));
      tSolo += I.simular(r1, a, condBase(2000, { incid: 0 }))[0].t; tDuelo += I.simular(r2, b, condBase(2000, { incid: 0 }))[0].t;
    }
    ok(tDuelo > tSolo, "con varios líderes, el que va al frente tarda más (duelo de ritmo)"); }
  // lesiones
  const les = (x, cond) => { let l = 0, tot = 0; for (let j = 0; j < 4000; j++) { const r = M.crearRng("les", JSON.stringify(x), j); const o = I.simular(r, [base(x)], cond)[0]; tot++; if (o.lesTramo >= 0) l++; } return l / tot; };
  const lBase = les({}, condBase(1600)), lFrag = les({ frag: 2.2 }, condBase(1600)), lCans = les({ fatiga: 60 }, condBase(1600)), lBarro = les({}, condBase(1600, { hum: 0.9, incid: 1.8 }));
  ok(lBase > 0.004 && lBase < 0.03, `lesiones por salida en condiciones normales (${pct(lBase)})`);
  ok(lFrag > lBase && lCans > lBase && lBarro > lBase, "se lesionan más las frágiles, las cansadas y con barro y tormenta");
  informe.push(`lesiones por salida: normal ${pct(lBase)}, frágil ${pct(lFrag)}, cansada ${pct(lCans)}, barro y tormenta ${pct(lBarro)}`); }

// 5) Un mundo largo
const AÑOS = rapido ? 3 : 8, CARRERAS = AÑOS * C.ANIO;
let m;
const apuestas = [], tiposNoticiaGlobal = {};
const simsDe = i => ((i + 1) >= CARRERAS / 4 && (i + 1) % 5 === 0 ? C.SIMS : 12);   // la carrera que se va a analizar se programa con todas las simulaciones
{ const t0 = Date.UTC(2026, 0, 1);
  m = M.crearMundo("prueba-larga", { calentar: 150, t0, simsCalentar: 20 });
  const m2 = M.crearMundo("prueba-larga", { calentar: 150, t0, simsCalentar: 20 });
  ok(JSON.stringify(m) === JSON.stringify(m2), "el mismo mundo con la misma semilla es idéntico");
  ok(M.horaDe(m, m.n) - M.horaDe(m, m.n - 1) === 30 * 60000 && M.horaDe(m, m.n) > t0, "una carrera cada 30 minutos");
  const todos = new Map();         // todas las criaturas que pasaron por el mundo
  const regis = c => { if (!todos.has(c.id)) todos.set(c.id, c); };
  m.vivos.forEach(regis); m.criadores.forEach(regis);
  const premiosInicio = [...todos.values()].reduce((a, c) => a + c.premios, 0);
  let pagado = 0, bolsas = 0, tiposNoticia = tiposNoticiaGlobal, grados = {}, climas = {}, campos = [], dist = {}, jorn = {}, nuevosId = new Set(), snapshot = null, restoJson = null;
  const poolMin = [], deltaRating = [];
  const noticiasTexto = [];
  const partidas = [], errores = [];
  const t1 = Date.now();
  for (let i = 0; i < CARRERAS; i++) {
    const prog = m.proxima, sec = prog.secreto;
    // una de cada 5 carreras (cuando ya hay historia) se guarda para el análisis de cuotas, con una segunda estimación independiente de la probabilidad real
    if (i >= CARRERAS / 4 && i % 5 === 0 && sec.res) {
      const csA = prog.entrantes.map(e => M.buscar(m, e.id));
      apuestas.push({ prog: JSON.parse(JSON.stringify(M.programaPublico(prog))), pReal: sec.pReal, res: JSON.parse(JSON.stringify(sec.res)), pEv: I.montecarlo(m, Object.assign({}, prog, { n: prog.n + 1000000 }), csA, C.SIMS) });
    }
    if (i === Math.floor(CARRERAS / 2)) snapshot = JSON.stringify(m);
    const sumaAntes = prog.entrantes.reduce((a, e) => a + M.buscar(m, e.id).rating, 0);
    const ev = M.avanzar(m, { sims: simsDe(i) });
    if (ev.resultado) {
      const idsEnt = ev.resultado.llegada.map(l => l.id);
      const sumaDespues = idsEnt.reduce((a, id) => { const c = M.buscar(m, id) || ev.perfiles.find(p => p.id === id); return a + (c.rating != null ? c.rating : 0); }, 0);
      if (idsEnt.every(id => M.buscar(m, id))) deltaRating.push(Math.abs(sumaDespues - sumaAntes));
      pagado += ev.resultado.llegada.reduce((a, l) => a + l.premio, 0); bolsas += ev.resultado.bolsa;
      campos.push(ev.resultado.llegada.length); grados[ev.resultado.grado] = (grados[ev.resultado.grado] || 0) + 1; climas[ev.resultado.clima] = (climas[ev.resultado.clima] || 0) + 1;
      const kd = `${ev.resultado.dist}`; dist[kd] = (dist[kd] || 0) + 1;
      const j = Math.floor(ev.resultado.n / C.JORNADA); (jorn[j] = jorn[j] || new Set()).add(ev.resultado.pista);
    }
    ev.noticias.forEach(x => { tiposNoticia[x.tipo] = (tiposNoticia[x.tipo] || 0) + 1; noticiasTexto.push(x.titulo, x.texto); });
    m.vivos.forEach(regis); m.criadores.forEach(regis); ev.bajas.forEach(regis);
    poolMin.push(m.vivos.length);
    if (i % 100 === 0) { const ids = m.vivos.concat(m.criadores).map(c => c.id); if (new Set(ids).size !== ids.length) errores.push("id repetido en la carrera " + i); }
    if (i === Math.floor(CARRERAS / 2) + 79) restoJson = JSON.stringify(m);
  }
  const seg = (Date.now() - t1) / 1000;
  informe.push(`mundo: ${CARRERAS} carreras (${AÑOS} años) en ${seg.toFixed(1)} s`);
  ok(errores.length === 0, errores.join("; "));
  ok(Math.min(...poolMin) >= 75 && Math.max(...poolMin) <= 120, `el número de criaturas vivas se mantiene (${Math.min(...poolMin)} a ${Math.max(...poolMin)})`);
  ok(campos.every(x => x >= 3 && x <= 10) && media(campos) > 6.5, `los campos son de 3 a 10 corredores (media ${media(campos).toFixed(1)})`);
  ["gran", "selecta", "corriente", "novatos"].forEach(g => ok(grados[g] > 0, `se corren carreras de categoría ${g}`));
  ok(Math.abs(grados.gran / CARRERAS - 1 / 12) < 0.01 && Math.abs(grados.corriente / CARRERAS - 0.5) < 0.02, "las categorías siguen el calendario de 12 carreras");
  ok(M.ESTADOS_CLIMA.every(w => climas[w] > 0), "sale todo tipo de clima: " + M.ESTADOS_CLIMA.map(w => `${w} ${pct((climas[w] || 0) / CARRERAS)}`).join(", "));
  ok(Object.values(jorn).every(s => s.size === 1), "cada jornada de 12 carreras es en una sola pista");
  ok(Object.keys(dist).length >= 6, "se corren al menos 6 distancias distintas");
  ok(Math.abs(pagado / bolsas - 0.9) < 0.12, `los premios pagados son el 90 % de las bolsas, el resto no llega a los puestos (${pct(pagado / bolsas)})`);
  const todosArr = [...todos.values()];
  const premiosTotal = todosArr.reduce((a, c) => a + c.premios, 0);
  ok(premiosTotal - premiosInicio === pagado, `los premios de las criaturas suman exactamente lo pagado (${premiosTotal - premiosInicio} contra ${pagado})`);
  ok(todosArr.every(c => c.vic <= c.salidas && c.vic + c.seg + c.ter <= c.salidas && c.hist.length <= C.HISTORIAL), "los récords son coherentes");
  ok(deltaRating.length > 100 && Math.max(...deltaRating) < 1e-6, "el rating se reparte sin crear ni perder puntos");
  ok(new Set(todosArr.map(c => c.nombre.toLowerCase())).size === todosArr.length, "no hay dos criaturas con el mismo nombre en todo el mundo");
  const retirados = todosArr.filter(c => c.estado !== "activo");
  const edadRetiro = retirados.filter(c => c.salidas > 0).map(c => (c.ultima - c.nac) / C.ANIO);
  const carrera = retirados.filter(c => c.salidas > 0).map(c => c.salidas);
  ok(m.vivos.every(c => M.edadAnios(m.n, c) < 9.01), "nadie vive en pista pasados los 9 años");
  ok(media(carrera) > 15 && media(carrera) < 120, `una carrera dura de 15 a 120 salidas (media ${media(carrera).toFixed(0)})`);
  ok(m.stats.nacidos > 0 && Math.abs(m.stats.nacidos - m.stats.retirados) < Math.max(40, 0.35 * m.stats.retirados), `nacen y se retiran parecido (${m.stats.nacidos} contra ${m.stats.retirados})`);
  ["resultado", "lesion", "retiro", "nacimiento", "racha", "debut", "rumor", "record", "accidente"].forEach(t => ok(tiposNoticia[t] > 0, `salen noticias de tipo ${t}`));
  ok(noticiasTexto.every(t => t && !/undefined|NaN|\[object|[—–]|\b(tenés|podés|sabés|querés)\b/.test(t)), "las noticias están bien formadas, sin rayas largas ni voseo");
  const ejemplos = [];
  informe.push(`noticias: ${Object.entries(tiposNoticia).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  informe.push(`ciclo de vida: ${(m.stats.lesiones / AÑOS).toFixed(1)} lesiones al año (${pct(m.stats.lesiones / (campos.reduce((a, b) => a + b, 0)))} por salida), ${(m.stats.retirados / AÑOS).toFixed(1)} retiros y ${(m.stats.nacidos / AÑOS).toFixed(1)} nacimientos al año, salidas por carrera ${media(carrera).toFixed(0)}, edad media al retirarse ${media(edadRetiro).toFixed(1)} años, criadores ${m.criadores.length}`);
  informe.push(`salidas por criatura y año: ${(campos.reduce((a, b) => a + b, 0) / AÑOS / media(poolMin)).toFixed(1)}`);
  // deriva genética
  const g0 = M.crearMundo("deriva", { calentar: 0, t0: 0 });
  const mg = (mundo, k) => media(mundo.vivos.map(c => c.genes[k]));
  const dg0 = M.GENES.map(k => mg(m, k) - mg(g0, k)), neutro = dg0[M.GENES.indexOf("tam")];   // la talla no hace nada: su cambio es la deriva por azar
  const dg = dg0.map(d => d - neutro);
  const sumaFin = media(m.vivos.map(c => c.genes.pat + c.genes.pul + c.genes.mus)), sumaIni = media(g0.vivos.map(c => c.genes.pat + c.genes.pul + c.genes.mus));
  informe.push(`deriva genética tras ${AÑOS} años: ${M.GENES.map((k, i) => `${k} ${dg[i] >= 0 ? "+" : ""}${dg[i].toFixed(3)}`).join(", ")}; suma pat+pul+mus ${sumaIni.toFixed(2)} -> ${sumaFin.toFixed(2)} (talla, que no hace nada: ${neutro >= 0 ? "+" : ""}${neutro.toFixed(3)})`);
  ok(dg.every(d => Math.abs(d) < 0.09) && Math.abs(sumaFin - sumaIni - 3 * neutro) < 0.2, "los genes no se disparan con las generaciones");
  ok(desv(m.vivos.map(c => c.genes.pat)) > 0.07, "la población conserva variedad genética");
  // reanudar desde una copia JSON da el mismo mundo
  { const copia = JSON.parse(snapshot);
    for (let i = 0; i < 80; i++) M.avanzar(copia, { sims: simsDe(Math.floor(CARRERAS / 2) + i) });
    ok(JSON.stringify(copia) === restoJson, "guardar el mundo como JSON y seguir da exactamente lo mismo"); }
  // lo que sale al público
  { const c = m.vivos.find(x => x.salidas > 3), p = M.perfil(m, c), js = JSON.stringify(p);
    ["genes", "talento", "forma", "fatiga", "rating", "perm", "ritmo", "pReal"].forEach(k => ok(!js.includes(`"${k}"`), `el perfil público no enseña «${k}»`));
    ok(p.cuerpo.length === 8 && p.estrellas >= 0.5 && p.estrellas <= 5, "el perfil tiene cuerpo y estrellas");
    const pp = JSON.stringify(M.programaPublico(m.proxima));
    ["secreto", "pReal", "llegada", "tramos", "veraz"].forEach(k => ok(!pp.includes(`"${k}"`), `el programa público no enseña «${k}»`));
    const ev = M.avanzar(m, { sims: 12 }), pe = JSON.stringify(ev.programa);
    ok(!pe.includes('"secreto"') && !pe.includes('"pReal"'), "el programa que devuelve avanzar() es público");
    ok(ev.perfiles.every(x => !JSON.stringify(x).includes('"genes"')), "los perfiles que devuelve avanzar() son públicos"); }
  // estrellas con ruido que baja con las salidas
  { const rs = [], rj = [];
    todosArr.filter(c => c.salidas >= 12).slice(0, 80).forEach(c => { const bak = c.salidas; const z = (c.rating - 1500) / 110; const ruido = k => { c.salidas = k; const e = M.estrellas(c); c.salidas = bak; return e - clamp(Math.round((3 + 1.2 * z) * 2) / 2); }; const clamp = x => Math.min(5, Math.max(0.5, x)); rs.push(Math.abs(ruido(2))); rj.push(Math.abs(ruido(bak))); });
    ok(media(rs) > media(rj), `las estrellas son más fiables con más salidas (error ${media(rs).toFixed(2)} con 2, ${media(rj).toFixed(2)} con muchas)`); } }

// 5b) Vida fuera de la pista, generaciones, nombres de homenaje y perfil ampliado
{ const rng = M.crearRng("homenaje"), usados = { peregrino: 1 };
  const a = N.nombrar(rng, { sexo: "m", homenaje: "Peregrino", usados }), b = N.nombrar(rng, { sexo: "f", homenaje: "Peregrino", usados }), c2 = N.nombrar(rng, { sexo: "m", homenaje: "Peregrino II", usados });
  ok(a.nombre === "Peregrino II" && b.nombre === "Peregrino III" && c2.nombre === "Peregrino IV", `los homenajes llevan numeral (${a.nombre}, ${b.nombre}, ${c2.nombre})`);
  ok(["cría", "potro", "joven", "adulto", "veterano", "retirado", "fallecido"].join() === [M.etapaDe(0.2, "activo"), M.etapaDe(0.8, "activo"), M.etapaDe(2, "activo"), M.etapaDe(4, "activo"), M.etapaDe(6, "activo"), M.etapaDe(6, "criador"), M.etapaDe(3, "fallecido")].join(), "las etapas de la vida siguen la edad y el estado");
  const w = M.crearMundo("vida", { calentar: 0, t0: 0 });
  const x = w.vivos[0], y = w.vivos[1];
  x.fatiga = 40; y.fatiga = 40; x.genes.mus = 0.95; y.genes.mus = 0.05; x.lesion = y.lesion = null;
  I.cicloVital(w, { noticias: [], cambios: new Set(), bajas: [], retirarPor: new Map(), nacidos: [] });
  ok(x.fatiga < y.fatiga && x.fatiga > 36 && y.fatiga < 39, `las ancas fuertes recuperan antes del cansancio (${x.fatiga.toFixed(2)} contra ${y.fatiga.toFixed(2)})`);
  // genealogía y lo que se ve de cada una
  const todos = new Map(); [...m.vivos, ...m.criadores].forEach(c => todos.set(c.id, c));
  const conPadres = [...todos.values()].filter(c => c.padre && c.madre);
  ok(conPadres.length > 10 && conPadres.every(c => { const p = todos.get(c.padre.id), q = todos.get(c.madre.id); return !p || !q || c.gen === Math.max(p.gen, q.gen) + 1; }), `la generación de cada cría es la de sus padres más uno (${conPadres.length} con padres)`);
  ok(m.vivos.concat(m.criadores).every(c => c.gen >= 1), "todas tienen generación");
  const muestra = m.vivos.filter(c => c.salidas >= 3).slice(0, 40);
  ok(muestra.length > 10 && muestra.every(c => { const p = M.perfil(m, c); return Object.values(p.silueta).every(v => v >= 0 && v <= 1) && Object.keys(p.silueta).length === 12 && Array.isArray(p.etiquetas) && Array.isArray(p.secuelas) && ["firme", "bueno", "blando", "pesado"].every(k => k in p.aptitudes) && (p.arquetipo === null || ["Saltador", "Flecha", "Tanque", "Maratonista"].includes(p.arquetipo)); }), "el perfil trae silueta, aptitudes por pista, etiquetas, secuelas y arquetipo");
  const conApt = muestra.map(c => M.perfil(m, c)).filter(p => Object.values(p.aptitudes).some(Boolean));
  ok(conApt.length > 0 && conApt.every(p => Object.values(p.aptitudes).every(a => !a || (a.estrellas >= 1 && a.estrellas <= 5 && a.salidas >= 2))), "las estrellas por pista solo salen con 2 salidas o más en esa pista");
  const arq = {}; [...todos.values()].forEach(c => { const q = M.arquetipo(c) || "ninguno"; arq[q] = (arq[q] || 0) + 1; });
  informe.push("cuerpos tipo: " + Object.entries(arq).map(([k, v]) => `${k} ${v}`).join(", "));
  ok(["Saltador", "Flecha", "Tanque", "Maratonista"].every(k => arq[k] > 0), "salen los cuatro cuerpos tipo");
  const leyendas = [...todos.values()].filter(M.esLeyenda); informe.push(`leyendas en el mundo: ${leyendas.length}${leyendas.length ? " (" + leyendas.slice(0, 3).map(c => `${c.nombre}, ${c.vic} victorias`).join("; ") + ")" : ""}`);
  ok(m.stats.muertes <= m.stats.incidentes && m.stats.incidentes > 0, `hay incidentes fuera de la pista (${m.stats.incidentes}, ${m.stats.muertes} muertes)`);
  ok(!m.vivos.concat(m.criadores).some(c => c.estado === "fallecido"), "nadie fallecido sigue en la lista de vivos");
  const n2 = Object.assign({}, tiposNoticiaGlobal); ok((n2.regreso || 0) <= (n2.fuga || 0), "cada regreso de un fugado tiene su fuga");
  ok(M.ESPECIE.singular && M.ESPECIE.plural, "la especie tiene nombre (provisional)"); }

// 5c) El paso del servidor: crear el mundo, esperar, avanzar una carrera, ponerse al día
{ const tramo = 30 * 60000, ahora0 = Date.UTC(2027, 2, 12, 16, 7, 0);
  const guarda = (r, fila) => ({ version: (fila ? fila.version : 0) + 1, mundo: JSON.parse(JSON.stringify(r.lote.mundo)) });   // lo que haría la base de datos
  const r0 = M.paso(null, ahora0, { calentar: 40, semilla: "servidor", simsCalentar: 12 });
  ok(r0 && r0.version === 0 && r0.lote.criaturas.length > 100 && r0.lote.programas.length === 1 && r0.lote.carreras.length === 1, "la primera vez crea el mundo, la población y la primera carrera");
  const h0 = r0.lote.programas[0].hora;
  ok(h0 % tramo === 0 && h0 - ahora0 >= 5 * 60000 && h0 - ahora0 < 5 * 60000 + tramo, `la primera carrera sale en una media hora redonda a más de 5 minutos (${new Date(h0).toISOString()})`);
  ok(r0.lote.programas[0].n === 40 && r0.lote.mundo.n === 40, "el mundo arranca en la carrera siguiente a la historia previa");
  let fila = guarda(r0, null);
  ok(M.paso(fila, h0 - 1000) === null && M.paso(fila, h0 + 60000) === null, "mientras no pasen 90 s de la salida, no se aplica nada");
  const r1 = M.paso(fila, h0 + 100000, { sims: 12 });
  ok(r1 && r1.avanzadas === 1 && r1.version === 1 && r1.lote.programas[0].n === 41 && r1.lote.carreras[0].n === 41 && r1.lote.noticias.some(x => x.tipo === "resultado"), "pasados 90 s se aplica la carrera, se programa la siguiente y salen noticias");
  ok(r1.lote.criaturas.length >= 6 && r1.lote.criaturas.every(c => c.publico && !JSON.stringify(c).includes('"genes"')), "solo se envían las criaturas que cambiaron y sin datos ocultos");
  fila = guarda(r1, fila);
  ok(M.paso(fila, h0 + 100000, { sims: 12 }) === null, "con el mundo ya al día no hay nada más que hacer");
  // ponerse al día de golpe o carrera a carrera da el mismo mundo
  const hasta = h0 + 5 * tramo + 100000;
  const todo = M.paso(guarda(r0, null), hasta, { sims: 12 });
  let f2 = guarda(r0, null), pasos = 0;
  for (let h = h0 + 100000; h <= hasta; h += tramo) { const r = M.paso(f2, h, { sims: 12 }); if (r) { f2 = guarda(r, f2); pasos++; } }
  ok(todo.avanzadas === 6 && pasos === 6 && JSON.stringify(todo.lote.mundo) === JSON.stringify(f2.mundo), `ponerse al día de golpe (${todo.avanzadas} carreras) da lo mismo que ir carrera a carrera`);
  ok(todo.lote.programas.map(p => p.n).join() === "41,42,43,44,45,46" && todo.lote.criaturas.length === new Set(todo.lote.criaturas.map(c => c.id)).size, "el lote trae una programación por carrera y cada criatura una sola vez");
  ok(M.paso(guarda(r0, null), h0 + 40 * tramo, { sims: 12, max: 5 }).avanzadas === 5, "si hace falta, avanza por tandas (máximo configurable)"); }

// 6) Cuotas y apuestas, con las carreras analizadas del mundo largo
{ const prog = apuestas.map(a => a.prog);
  informe.push(`carreras analizadas para las cuotas: ${apuestas.length}`);
  ok(prog.every(p => p.entrantes.every(e => e.gan >= C.CUOTA_MIN && e.pod >= C.CUOTA_MIN && e.pod <= e.gan + 0.011)), "las cuotas son al menos 1,05 y el podio nunca paga más que ganar");
  const sobre = prog.map(p => p.entrantes.reduce((a, e) => a + 1 / e.gan, 0));
  ok(Math.abs(media(sobre) - 1.15) < 0.04, `las cuotas de ganador suman un 15 % de margen (${media(sobre).toFixed(3)})`);
  ok(prog.every(p => Math.abs(p.entrantes.reduce((a, e) => a + p.mercado[e.id], 0) - 1) < 0.002), "las probabilidades del público suman 1");
  const idxFav = prog.map(p => p.entrantes.reduce((a, e, k) => (e.gan < p.entrantes[a].gan ? k : a), 0));
  // calibración del mercado: lo que dice contra lo que de verdad pasa (estimación independiente de 400 simulaciones)
  { const bins = [[0, 0.08], [0.08, 0.15], [0.15, 0.25], [0.25, 0.4], [0.4, 1.01]];
    const filas = bins.map(([lo, hi]) => { const v = []; apuestas.forEach(a => a.prog.entrantes.forEach((e, k) => { const q = a.prog.mercado[e.id]; if (q >= lo && q < hi) v.push([q, a.pEv.gan[k]]); })); return v.length ? `${lo.toFixed(2)}-${Math.min(hi, 1).toFixed(2)}: público ${pct(media(v.map(x => x[0])))}, real ${pct(media(v.map(x => x[1])))} (${v.length})` : null; }).filter(Boolean);
    informe.push("calibración del mercado: " + filas.join(" | "));
    const pFavM = media(apuestas.map((a, i) => a.prog.mercado[a.prog.entrantes[idxFav[i]].id])), pFavR = media(apuestas.map((a, i) => a.pEv.gan[idxFav[i]]));
    informe.push(`el favorito del público: ${pct(pFavM)} según las cuotas, ${pct(pFavR)} en realidad`);
    ok(Math.abs(pFavM - pFavR) < 0.05, `el favorito gana más o menos lo que dicen sus cuotas (${pct(pFavR)} contra ${pct(pFavM)})`);
    ok(pFavR > 0.2 && pFavR < 0.5, `el favorito gana entre el 20 y el 50 % de las veces (${pct(pFavR)})`); }
  // exacta
  const pe = prog.slice(0, 80).map(p => { const ids = p.entrantes.map(e => e.id), pub = ids.map(id => p.mercado[id]); let s = 0; for (let a = 0; a < ids.length; a++) for (let b = 0; b < ids.length; b++) if (a !== b) s += 1 / M.cuotaExacta(pub, a, b); return s; });
  ok(Math.abs(media(pe) - 1.25) < 0.08, `las cuotas de la exacta suman un 25 % de margen (${media(pe).toFixed(3)})`);
  // liquidar y ventana
  { const a = apuestas[0], l = a.res.llegada, p = a.prog;
    const g = M.liquidar({ tipo: "ganador", sel: l[0].id, monto: 10, cuota: 3.5 }, a.res), pd = M.liquidar({ tipo: "podio", sel: l[2].id, monto: 10, cuota: 1.5 }, a.res);
    const nop = M.liquidar({ tipo: "podio", sel: l[l.length - 1].id, monto: 10, cuota: 1.5 }, a.res), ex = M.liquidar({ tipo: "exacta", sel: [l[0].id, l[1].id], monto: 4, cuota: 20 }, a.res), exMal = M.liquidar({ tipo: "exacta", sel: [l[1].id, l[0].id], monto: 4, cuota: 20 }, a.res);
    ok(g.gana && g.pago === 35 && pd.gana && pd.pago === 15 && !nop.gana && nop.pago === 0 && ex.pago === 80 && !exMal.gana, "liquidar paga ganador, podio y exacta (y la exacta exige el orden)");
    ok(M.cuotaApuesta(p, "ganador", l[0].id) === p.entrantes.find(e => e.id === l[0].id).gan && M.cuotaApuesta(p, "podio", 99999999) === null && M.cuotaApuesta(p, "exacta", [l[0].id, l[0].id]) === null, "cuotaApuesta devuelve la cuota publicada y rechaza lo que no existe");
    ok(M.ventana(p, p.cierre - 1) === "abierta" && M.ventana(p, p.cierre) === "cerrada" && M.ventana(p, p.hora) === "corriendo" && M.ventana(p, p.hora + 75000) === "terminada", "las apuestas cierran 60 s antes y la carrera dura 75 s"); }
  // retorno esperado por apuesta de 1, calculado con la probabilidad real (no con lo que salió, que con pocas carreras es solo suerte)
  const esperado = (elige, tipo) => { let suma = 0, nb = 0;
    apuestas.forEach((a, i) => { (elige(a, i) || []).forEach(k => { const e = a.prog.entrantes[k]; suma += (tipo === "ganador" ? a.pEv.gan[k] * e.gan : a.pEv.pod[k] * e.pod); nb++; }); });
    return { roi: nb ? suma / nb - 1 : NaN, n: nb }; };
  const todos = a => a.prog.entrantes.map((e, k) => k);
  const valor = (a, tipo, umbral) => { const p = tipo === "ganador" ? a.pReal.gan : a.pReal.pod; const best = a.prog.entrantes.map((e, k) => [k, p[k] * (tipo === "ganador" ? e.gan : e.pod)]).filter(x => x[1] >= umbral).sort((x, y) => y[1] - x[1])[0]; return best ? [best[0]] : null; };
  const R = {
    "al favorito, a ganador": esperado((a, i) => [idxFav[i]], "ganador"),
    "al de mayor cuota, a ganador": esperado(a => [a.prog.entrantes.reduce((x, e, k) => (e.gan > a.prog.entrantes[x].gan ? k : x), 0)], "ganador"),
    "a cualquiera, a ganador": esperado(todos, "ganador"),
    "al favorito, a podio": esperado((a, i) => [idxFav[i]], "podio"),
    "a cualquiera, a podio": esperado(todos, "podio"),
    "con la probabilidad real, a ganador si vale más de 1,10": esperado(a => valor(a, "ganador", 1.10), "ganador"),
    "con la probabilidad real, a podio si vale más de 1,10": esperado(a => valor(a, "podio", 1.10), "podio")
  };
  Object.entries(R).forEach(([k, v]) => informe.push(`retorno esperado apostando ${k}: ${(v.roi * 100).toFixed(1)} % (${v.n} apuestas)`));
  ok(R["al favorito, a ganador"].roi < 0 && R["al favorito, a ganador"].roi > -0.3, `apostar siempre al favorito pierde poco (${(R["al favorito, a ganador"].roi * 100).toFixed(1)} %)`);
  ok(R["a cualquiera, a ganador"].roi < -0.01 && R["a cualquiera, a ganador"].roi > -0.4, `apostar a cualquiera también pierde (${(R["a cualquiera, a ganador"].roi * 100).toFixed(1)} %)`);
  ok(["al favorito, a ganador", "al de mayor cuota, a ganador", "a cualquiera, a ganador", "al favorito, a podio", "a cualquiera, a podio"].every(k => R[k].roi < 0.1), "ninguna forma ingenua de apostar sale rentable");
  const sabe = R["con la probabilidad real, a ganador si vale más de 1,10"];
  ok(sabe.n > 15 && sabe.roi > 0.02, `con información real se puede ganar (${(sabe.roi * 100).toFixed(1)} %)`);
  ok(sabe.roi < 0.6, "pero no es dinero regalado"); }

console.log(informe.map(x => "  " + x).join("\n"));
console.log(fallos.length ? `${fallos.length} fallo(s) de ${n}:\n  ${fallos.join("\n  ")}` : `OK: ${n} comprobaciones del hipódromo (${((Date.now() - T0) / 1000).toFixed(0)} s)`);
process.exit(fallos.length ? 1 : 0);
