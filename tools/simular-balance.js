// Simulación de balance de Triunfos: mazos al azar (o con tema) jugados por un bot sencillo. Sirve para ver qué cartas
// ganan mucho más (o mucho menos) de lo normal, cuánto duran las partidas y cuánto se llena el campo.
// Uso: node tools/simular-balance.js [partidas=4000] [semilla=1] [--temas] [--sin-vinculos] [--campo=N] [--json=archivo] [--unidades=15 (0 = sin composición fija)]
//   --temas: además prueba mazos hechos alrededor de un círculo de vínculos (js/cartas-vinculos.js).
//   --sin-vinculos y --campo=6: para comparar con cómo era el juego antes de los vínculos y del campo de 10.
// El bot no es listo: juega lo más caro que puede, ataca cuando no pierde la unidad y bloquea si le conviene. Vale para
// comparar cartas entre sí, no para saber cómo jugaría una persona.
const vm = require("vm"), fs = require("fs"), path = require("path");
const sb = { console }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
const UNIDADES = Number(((process.argv.find(a => a.startsWith("--unidades=")) || "").split("=")[1]) || 15);
const SIN_VINC = process.argv.includes("--sin-vinculos"), CAMPO = (process.argv.find(a => a.startsWith("--campo=")) || "").split("=")[1];
for (const f of ["cartas-datos", "cartas-motor", "cartas-efectos"].concat(SIN_VINC ? [] : ["cartas-vinculos"])) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", `${f}.js`), "utf8"), sb, { filename: f });
const M = sb.CartasMotor;
if (CAMPO) M.C.CAMPO_MAX = Number(CAMPO);
const cartas = {};
sb.CARTAS.forEach(c => { cartas[c.id] = { id: c.id, nombre: c.nombre, tipo: c.tipo, rareza: c.rareza, afinidad: c.afinidad, coste: c.coste, atq: c.atq ?? null, pv: c.pv ?? null, habilidad: c.habilidad || "", lado: c.lado || null, obtenible: c.obtenible }; });
require("./cartas-del-servidor.js").forEach(c => { cartas[c.id] = Object.assign({ lado: null, obtenible: true }, c); });
const todas = Object.values(cartas).filter(c => c.obtenible !== false && c.id !== "el-bufon");

const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
const N = Number(args[0]) || 4000, SEMILLA = Number(args[1]) || 1, TEMAS = process.argv.includes("--temas");
function azar(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* --- Mazos ------------------------------------------------------------------ */
const legalPara = lado => todas.filter(c => !c.lado || c.lado.includes(lado));
function mazoAlAzar(r, lado, tam = 24, semilla = []) {
  const pool = legalPara(lado), cuenta = {}, mazo = [];
  const mete = c => { const tope = M.topeCopias(c); if ((cuenta[c.id] || 0) >= tope) return false; cuenta[c.id] = (cuenta[c.id] || 0) + 1; mazo.push(c.id); return true; };
  semilla.forEach(id => cartas[id] && mete(cartas[id]));
  // Composición fija (UNIDADES unidades y el resto de otras cartas) para que un lado con más personajes no gane solo por tener más unidades
  const esU = c => c.atq !== null && c.atq !== undefined;
  const us = pool.filter(esU), otras = pool.filter(c => !esU(c));
  let g = 0;
  if (UNIDADES) {
    while (mazo.filter(id => esU(cartas[id])).length < UNIDADES && g++ < 2000) mete(us[Math.floor(r() * us.length)]);
    while (mazo.length < tam && g++ < 4000) mete(otras[Math.floor(r() * otras.length)]);
  }
  while (mazo.length < tam && g++ < 6000) mete(pool[Math.floor(r() * pool.length)]);
  return mazo;
}

/* --- Bot --------------------------------------------------------------------- */
const valor = (est, u) => M.atqEfectivo(est, u) + u.pv;
function eligir(est, r) {
  const quien = M.quienActua(est), legales = M.accionesLegales(est);
  const J = est.jugadores[quien], R = est.jugadores[1 - quien];
  if (est.pendiente) {
    if (est.pendiente.tipo === "bloqueo") return { a: bloqueos(est, quien, J, R), quien };
    const rea = legales.filter(x => x.t === "reaccionar");
    if (rea.length && r() < 0.8) return { a: rea[Math.floor(r() * rea.length)], quien };
    return { a: { t: "pasar" }, quien };
  }
  // 1) jugar la carta más cara que se pueda pagar (con el mejor objetivo)
  const jugadas = legales.filter(x => x.t === "jugar");
  if (jugadas.length) {
    const coste = x => M.costeDe(est, quien, J.mano[x.i]);
    const mejor = Math.max(...jugadas.map(coste));
    const conMejor = jugadas.filter(x => coste(x) === mejor);
    let escogida = conMejor[0];
    // con varios objetivos para la misma carta: a un enemigo, el más fuerte; a un aliado, el más herido
    const porCarta = {}; conMejor.forEach(x => { (porCarta[x.i] = porCarta[x.i] || []).push(x); });
    const grupo = porCarta[conMejor[0].i];
    if (grupo.length > 1) {
      const peso = x => { if (!x.o || x.o.u === undefined) return 0; const h = M.buscar(est, x.o.u); if (!h) return 0; return h.j === quien ? (h.u.pvMax - h.u.pv) : valor(est, h.u); };
      escogida = grupo.reduce((a, b) => (peso(b) > peso(a) ? b : a));
    }
    if (mejor > 0 || r() < 0.9) return { a: escogida, quien };
  }
  // 2) atacar (una vez por turno)
  if (est.atacado !== est.turno) {
    const listas = J.campo.filter(u => M.unidadPuedeAtacar(est, u));
    const totalAtq = listas.reduce((s, u) => s + M.atqEfectivo(est, u), 0);
    const apuro = R.vida <= totalAtq * 1.5;
    const elegidas = listas.filter(u => {
      const blk = R.campo.filter(b => M.puedeBloquear(est, b, u));
      const peligro = blk.some(b => M.atqEfectivo(est, b) >= u.pv);
      return apuro || !peligro || blk.length === 0 || valor(est, u) <= 3;
    });
    // no dejar el campo vacío si la vida está baja
    const defensores = J.campo.length - elegidas.length;
    const ataca = J.vida < 8 && defensores === 0 ? elegidas.slice(1) : elegidas;
    if (ataca.length) {
      const d = {};
      const usados = new Set();
      ataca.forEach(u => {
        const opts = M.objetivosDeDesafio(est, u).filter(uid => !usados.has(uid));
        if (opts.length && r() < 0.5) {
          const objetivo = opts.map(uid => M.buscar(est, uid).u).sort((a, b) => valor(est, b) - valor(est, a))[0];
          d[u.uid] = objetivo.uid; usados.add(objetivo.uid);
        }
      });
      const acc = { t: "atacar", u: ataca.map(u => u.uid) };
      if (Object.keys(d).length) acc.d = d;
      return { a: acc, quien };
    }
  }
  return { a: { t: "fin" }, quien };
}

function bloqueos(est, quien, J, R) {
  const c = est.combate, pares = [], usados = new Set(Object.values(c.forzados || {}));
  const entrante = c.atacantes.reduce((s, uid) => { const h = M.buscar(est, uid); return s + (h ? M.atqEfectivo(est, h.u) : 0); }, 0);
  const peligro = entrante >= J.vida - 2;
  const orden = c.atacantes.filter(uid => !(uid in (c.forzados || {}))).map(uid => M.buscar(est, uid)).filter(Boolean).sort((a, b) => M.atqEfectivo(est, b.u) - M.atqEfectivo(est, a.u));
  orden.forEach(h => {
    const posibles = M.bloqueadoresLibres(est, h.u.uid).filter(b => !usados.has(b)).map(uid => M.buscar(est, uid).u);
    if (!posibles.length) return;
    const dano = M.atqEfectivo(est, h.u);
    const buenos = posibles.filter(b => M.atqEfectivo(est, b) >= h.u.pv && b.pv > dano);          // mata y sobrevive
    const cambios = posibles.filter(b => M.atqEfectivo(est, b) >= h.u.pv && valor(est, b) <= valor(est, h.u) + 1);   // intercambio razonable
    let b = buenos.sort((x, y) => valor(est, x) - valor(est, y))[0] || cambios.sort((x, y) => valor(est, x) - valor(est, y))[0];
    if (!b && peligro) b = posibles.sort((x, y) => valor(est, x) - valor(est, y))[0];     // sacrificio para no recibir el golpe
    if (b) { pares.push([h.u.uid, b.uid]); usados.add(b.uid); }
  });
  return { t: "bloquear", b: pares };
}

/* --- Una partida ---------------------------------------------------------------- */
function jugar(mazoA, mazoB, semilla, primero, r) {
  const est = M.crearPartida({ semilla, primero, cartas, jugadores: [{ id: "a", nombre: "A", mazo: mazoA }, { id: "b", nombre: "B", mazo: mazoB }] });
  let pasos = 0, maxCampo = 0, errores = 0;
  while (est.ganador === null && pasos++ < 4000) {
    const { a, quien } = eligir(est, r);
    let res = M.aplicar(est, a, quien);
    if (res.error) {
      // el bot se equivocó: la acción más sencilla que valga
      errores++;
      const legales = M.accionesLegales(est);
      const alt = legales.find(x => x.t === "fin" || x.t === "pasar") || legales[0];
      res = M.aplicar(est, alt, quien);
      if (res.error || errores > 40) break;
    }
    est.jugadores.forEach(J => { maxCampo = Math.max(maxCampo, J.campo.length); });
  }
  return { est, pasos, maxCampo, errores };
}

/* --- Resultados --------------------------------------------------------------------- */
function simular(titulo, generar, n) {
  const r = azar(SEMILLA * 7919);
  const porCarta = {};
  let turnos = 0, llenos = 0, fatiga = 0, sinFin = 0, empates = 0, errs = 0, victoriasPrimero = 0, partidas = 0, ganaA = 0;
  const baseLado = {};
  const campoMax = [], lados = { AB: [0, 0], AA: [0, 0], BB: [0, 0] };
  for (let g = 0; g < n; g++) {
    const { mazoA, mazoB, la, lb } = generar(r);
    const primero = g % 2;
    const { est, maxCampo, errores } = jugar(mazoA, mazoB, SEMILLA * 100000 + g, primero, r);
    errs += errores;
    if (est.ganador === null) { sinFin++; continue; }
    if (est.ganador === "empate") { empates++; continue; }
    partidas++;
    turnos += est.turno;
    if (maxCampo >= M.C.CAMPO_MAX) llenos++;
    campoMax.push(maxCampo);
    if (est.jugadores.some(J => J.fatiga > 0)) fatiga++;
    if (est.ganador === primero) victoriasPrimero++;
    if (est.ganador === 0) ganaA++;
    if (la && lb) { const k = la === lb ? la + lb : "AB"; lados[k][0]++; if (la !== lb && ((la === "A") === (est.ganador === 0))) lados[k][1]++; }
    [[mazoA, 0, la], [mazoB, 1, lb]].forEach(([mazo, j, lado]) => {
      const gano = est.ganador === j;
      if (lado) { const b = baseLado[lado] = baseLado[lado] || { j: 0, w: 0 }; b.j++; if (gano) b.w++; }
      new Set(mazo).forEach(id => {
        const x = porCarta[id] = porCarta[id] || { j: 0, w: 0, ls: {} }; x.j++; if (gano) x.w++;
        if (lado) { const y = x.ls[lado] = x.ls[lado] || { j: 0, w: 0 }; y.j++; if (gano) y.w++; }
      });
    });
  }
  const media = campoMax.reduce((s, x) => s + x, 0) / Math.max(1, campoMax.length);
  console.log(`\n=== ${titulo}: ${n} partidas, ${partidas} con ganador ===`);
  console.log(`turnos medios ${(turnos / Math.max(1, partidas)).toFixed(1)} | campo lleno (${M.C.CAMPO_MAX}) en ${(100 * llenos / Math.max(1, partidas)).toFixed(1)}% | campo máximo medio ${media.toFixed(1)} | fatiga ${(100 * fatiga / Math.max(1, partidas)).toFixed(1)}% | gana el que empieza ${(100 * victoriasPrimero / Math.max(1, partidas)).toFixed(1)}% | sin fin ${sinFin} | empates ${empates} | errores del bot ${errs}`);
  if (lados.AB[0]) console.log(`Lado A contra lado B: gana A ${(100 * lados.AB[1] / lados.AB[0]).toFixed(1)}% (${lados.AB[0]} partidas)`);
  porCarta.__resumen = { partidas, ganaA, baseLado };
  return porCarta;
}

/* Lo que gana una carta respecto a lo normal para los mazos de su lado: así una carta de un lado fuerte no sale premiada
   solo por estar en él. delta = win rate de los mazos con la carta − win rate medio de esos mazos (por lado). */
function informe(porCarta, minimo = 150) {
  const base = (porCarta.__resumen && porCarta.__resumen.baseLado) || {};
  const filas = Object.entries(porCarta).filter(([id, x]) => id !== "__resumen" && x.j >= minimo).map(([id, x]) => {
    let esp = 0, tot = 0;
    Object.entries(x.ls || {}).forEach(([l, y]) => { if (base[l] && base[l].j) { esp += y.j * base[l].w / base[l].j; tot += y.j; } });
    const wr = x.w / x.j;
    return { id, j: x.j, wr, delta: tot ? wr - esp / tot : 0, c: cartas[id] };
  });
  filas.sort((a, b) => b.delta - a.delta);
  const f = x => `${x.id.padEnd(26)} ${String(x.c.tipo).slice(0, 4).padEnd(5)} c${String(x.c.coste).padEnd(2)} ${x.c.atq !== null ? `${x.c.atq}/${x.c.pv}` : "   "}`.padEnd(48) + ` ${(100 * x.wr).toFixed(1)}%  ${x.delta >= 0 ? "+" : ""}${(100 * x.delta).toFixed(1)}  (${x.j})`;
  console.log("\nMás fuertes (win rate, y puntos sobre lo normal de su lado):"); filas.slice(0, 14).forEach(x => console.log("  " + f(x)));
  console.log("Más débiles:"); filas.slice(-14).reverse().forEach(x => console.log("  " + f(x)));
  return filas;
}

const porCarta = simular("Mazos al azar", r => {
  const la = r() < 0.5 ? "A" : "B", lb = r() < 0.5 ? "A" : "B";
  return { mazoA: mazoAlAzar(r, la), mazoB: mazoAlAzar(r, lb), la, lb };
}, N);
const filas = informe(porCarta);
const JSON_A = (process.argv.find(a => a.startsWith("--json=")) || "").split("=")[1];
if (JSON_A) fs.writeFileSync(JSON_A, JSON.stringify(filas.map(x => ({ id: x.id, j: x.j, wr: x.wr, delta: x.delta })), null, 1));

if (TEMAS) {
  const V = sb.CARTAS_VINCULOS;
  const resumen = [];
  V.circulos.filter(c => (c.tipo || "circulo") === "circulo").forEach(c => {
    const lados = ["A", "B"].filter(l => c.miembros.every(id => !cartas[id] || !cartas[id].lado || cartas[id].lado.includes(l)));
    const lado = lados[0] || "B";
    const pp = simular(`Mazo del círculo «${c.nombre}» contra mazo al azar (${lado})`, r => {
      const tema = mazoAlAzar(r, lado, 24, c.miembros.filter(id => cartas[id]));
      return { mazoA: tema, mazoB: mazoAlAzar(r, r() < 0.5 ? "A" : "B") };
    }, Math.max(300, Math.round(N / 8)));
    const rs = pp.__resumen;
    console.log(`   -> el mazo del círculo gana ${(100 * rs.ganaA / Math.max(1, rs.partidas)).toFixed(1)}%`);
    resumen.push([c.nombre, rs.ganaA / Math.max(1, rs.partidas)]);
  });
  console.log("\nResumen de mazos con tema (contra mazos al azar):");
  resumen.forEach(([n, w]) => console.log(`  ${n.padEnd(34)} ${(100 * w).toFixed(1)}%`));
}
