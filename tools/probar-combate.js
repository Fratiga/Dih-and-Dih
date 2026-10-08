// Prueba del combate de Triunfos (declarar, bloquear, palabras clave, reacciones) y 300 partidas al azar.
// Uso: node tools/probar-combate.js
const vm = require("vm"), fs = require("fs"), path = require("path");
const sb = { console }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
for (const f of ["cartas-datos", "cartas-motor", "cartas-efectos"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", `${f}.js`), "utf8"), sb, { filename: f });
const M = sb.CartasMotor;
const cartas = {}; sb.CARTAS.forEach(c => { cartas[c.id] = { id: c.id, nombre: c.nombre, tipo: c.tipo, rareza: c.rareza, afinidad: c.afinidad, coste: c.coste, atq: c.atq ?? null, pv: c.pv ?? null, habilidad: c.habilidad || "" }; });
// cartas de prueba
const mk = (id, atq, pv) => { cartas[id] = { id, nombre: id, tipo: "Criatura", rareza: "comun", afinidad: ["carne"], coste: 0, atq, pv, habilidad: "" }; };
mk("t11", 1, 1); mk("t33", 3, 3); mk("t24", 2, 4); mk("t52", 5, 2);
const fallos = []; let n = 0;
const ok = (c, msg) => { n++; if (!c) fallos.push(msg); };
function partida(mazoA, mazoB, primero = 0) {
  const relleno = Array.from({ length: 20 }, () => "t11");
  const est = M.crearPartida({ semilla: 3, primero, cartas, jugadores: [{ id: "a", nombre: "A", mazo: mazoA.concat(relleno) }, { id: "b", nombre: "B", mazo: mazoB.concat(relleno) }] });
  return est;
}
// pone unidades directamente (sin pasar por la mano) para probar el combate
function poner(est, j, id, extra = {}) { const u = M.ponerUnidad(est, j, id, false, null); u.entro = 0; Object.assign(u.flags, extra); return u; }
function turnoDe(est, j) { let g = 0; while (est.activo !== j && g++ < 4) M.aplicar(est, { t: "fin" }, est.activo); est.jugadores[j].campo.forEach(u => { u.entro = 0; }); }

// 1) sin bloqueo: golpea al jugador
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t33"); e.jugadores[1].campo.length = 0;
  let r = M.aplicar(e, { t: "atacar", u: [a.uid] }, 0); ok(r.ok, "atacar ok");
  ok(e.jugadores[1].vida === 17 && !e.pendiente && !e.combate, "sin defensores el golpe llega al jugador"); }
// 2) bloqueo 1 a 1: daño simultáneo
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t33"), b = poner(e, 1, "t24");
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 0); ok(e.pendiente && e.pendiente.tipo === "bloqueo" && M.quienActua(e) === 1, "abre ventana de bloqueo");
  let r = M.aplicar(e, { t: "bloquear", b: [[a.uid, b.uid]] }, 1); ok(r.ok, "bloquear ok " + JSON.stringify(r));
  ok(b.pv === 1 && a.pv === 1, `daño simultáneo (b ${b.pv}, a ${a.pv})`); ok(e.jugadores[1].vida === 20, "bloqueado no golpea al jugador");
  ok(e.ultimoCombate && e.ultimoCombate.pares.length === 1 && e.ultimoCombate.pares[0].b.uid === b.uid, "ultimoCombate registrado"); }
// 3) no bloquear
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t33"); poner(e, 1, "t24");
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 0); M.aplicar(e, { t: "pasar" }, 1); ok(e.jugadores[1].vida === 17, "pasar = sin bloqueos"); }
// 4) varios atacantes, un bloqueador por atacante, un atacante por bloqueador
{ const e = partida([], []); turnoDe(e, 0); const a1 = poner(e, 0, "t33"), a2 = poner(e, 0, "t52"); const b = poner(e, 1, "t24");
  M.aplicar(e, { t: "atacar", u: [a1.uid, a2.uid] }, 0);
  ok(M.aplicar(e, { t: "bloquear", b: [[a1.uid, b.uid], [a2.uid, b.uid]] }, 1).error, "un bloqueador no bloquea a dos");
  ok(M.aplicar(e, { t: "bloquear", b: [[a1.uid, b.uid]] }, 1).ok, "bloquea a uno");
  ok(e.jugadores[1].vida === 15, `el otro golpea al jugador (vida ${e.jugadores[1].vida})`); }
// 5) una sola vez por turno
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t33"), a2 = poner(e, 0, "t11");
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 0); ok(M.aplicar(e, { t: "atacar", u: [a2.uid] }, 0).error, "no se ataca dos veces por turno"); }
// 6) volar: solo lo bloquea quien vuela; Temible; noBloquea; noBloqueaHasta
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "manta-del-cielo"); const b = poner(e, 1, "t33");
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 0); ok(!e.pendiente && e.jugadores[1].vida === 19, "volar sin bloqueadores que vuelen: se resuelve solo"); }
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t33"); const b = poner(e, 1, "t24", { noBloqueaHasta: 99 });
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 0); ok(!e.pendiente, "noBloqueaHasta impide bloquear"); }
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t33"); const b = poner(e, 1, "cassius-coldgrave");
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 0); ok(!e.pendiente, "Cassius no bloquea"); }
{ const e = partida([], []); turnoDe(e, 0); e.terreno = { cartaId: "puente-de-las-legiones", dueno: 0, restantes: 2, turnoEntrada: 0, desde: 1 };
  const a = poner(e, 0, "t33"); const b = poner(e, 1, "t24"), c = poner(e, 1, "t11");
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 0); ok(M.aplicar(e, { t: "bloquear", b: [[a.uid, c.uid]] }, 1).error, "Temible: no la bloquea una unidad de menos de 3 de ataque");
  ok(M.aplicar(e, { t: "bloquear", b: [[a.uid, b.uid]] }, 1).error, "t24 (ataque 2) tampoco"); M.aplicar(e, { t: "pasar" }, 1); }
// 7) Veloz
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "enzo"); a.atq = 3; const b = poner(e, 1, "t24"); b.atq = 4; b.pv = 3; b.pvMax = 3;
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 0); M.aplicar(e, { t: "bloquear", b: [[a.uid, b.uid]] }, 1);
  ok(!M.buscar(e, b.uid) && M.buscar(e, a.uid) && a.pv === 3, `Veloz mata primero y no recibe daño (a.pv ${a.pv})`); }
// 8) Barrera
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t33"); const b = poner(e, 1, "t33", { barrera: true });
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 0); M.aplicar(e, { t: "bloquear", b: [[a.uid, b.uid]] }, 1);
  ok(b.pv === 3 && !b.flags.barrera, "Barrera absorbe el primer daño"); }
// 9) Arrollar
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "kraken"); const b = poner(e, 1, "t11");
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 0); M.aplicar(e, { t: "bloquear", b: [[a.uid, b.uid]] }, 1);
  ok(e.jugadores[1].vida === 15, `Arrollar: 6 de daño a un 1/1 pasan 5 al jugador (vida ${e.jugadores[1].vida})`); }
// 10) Reacción bomba de humo con objetivo
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t33"), a2 = poner(e, 0, "t52"); poner(e, 1, "t24");
  e.jugadores[1].mano = ["bomba-de-humo"]; e.jugadores[1].energia = 5;
  const r = M.aplicar(e, { t: "atacar", u: [a.uid, a2.uid] }, 0); ok(r.pendiente && e.pendiente.tipo === "ataque", "hay ventana de reacción");
  ok(M.aplicar(e, { t: "reaccionar", i: 0 }, 1).error, "la bomba exige elegir atacante");
  ok(M.aplicar(e, { t: "reaccionar", i: 0, o: { u: a2.uid } }, 1).ok, "bomba sobre a2");
  ok(e.combate && e.combate.atacantes.length === 1 && e.pendiente && e.pendiente.tipo === "bloqueo", "tras la reacción sigue el bloqueo con un atacante");
  M.aplicar(e, { t: "pasar" }, 1); ok(e.jugadores[1].vida === 17, "solo golpea el atacante restante"); }
// 11) Silbato
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t33"); const b = poner(e, 1, "t24"); e.jugadores[1].mano = ["silbato-de-guardia"]; e.jugadores[1].energia = 5;
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 0); M.aplicar(e, { t: "reaccionar", i: 0 }, 1); ok(b.pv === 6, "silbato da +2 de vida"); M.aplicar(e, { t: "pasar" }, 1); }
// 12) Hueco ordena atacantes; rechazos
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t33"); const nueva = M.ponerUnidad(e, 0, "t11", false, null);
  ok(M.aplicar(e, { t: "atacar", u: [nueva.uid] }, 0).error, "unidad recién entrada no ataca");
  ok(M.aplicar(e, { t: "atacar", u: [] }, 0).error, "ataque vacío");
  ok(M.aplicar(e, { t: "atacar", u: [999] }, 0).error, "unidad inexistente"); }
// 13) Legado: acción antigua con un solo uid
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t33"); e.jugadores[1].campo.length = 0;
  ok(M.aplicar(e, { t: "atacar", u: a.uid, o: { j: 1 } }, 0).ok, "formato antiguo no rompe"); }
// 14) emisor al reproducir
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t33"); poner(e, 1, "t24");
  M.reproducir(e, { t: "atacar", u: [a.uid] }); ok(e.pendiente && M.reproducir(e, { t: "bloquear", b: [] }).ok, "reproducir enruta bloquear al defensor"); }

// 15) simulación aleatoria con accionesLegales
function azar(sem) { let x = sem >>> 0; return () => { x = (x + 0x6D2B79F5) >>> 0; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ids = Object.keys(cartas).filter(id => !id.startsWith("t") && cartas[id].tipo !== "Terreno" || cartas[id].tipo === "Terreno");
let terminadas = 0, ataques = 0, bloqueos = 0;
for (let g = 0; g < 300; g++) {
  const r = azar(g + 1000);
  const mazo = () => Array.from({ length: 24 }, () => ids.filter(i => !i.startsWith("t")).concat([])[Math.floor(r() * ids.filter(i => !i.startsWith("t")).length)]);
  const e = M.crearPartida({ semilla: g + 1, primero: g % 2, cartas, jugadores: [{ id: "a", nombre: "A", mazo: mazo() }, { id: "b", nombre: "B", mazo: mazo() }] });
  let pasos = 0;
  while (e.ganador === null && pasos++ < 1500) {
    const legales = M.accionesLegales(e); const quien = M.quienActua(e);
    // prefiere atacar y bloquear a veces
    let a = legales[Math.floor(r() * legales.length)];
    const ataquesL = legales.filter(x => x.t === "atacar"); if (ataquesL.length && r() < 0.5) a = ataquesL[Math.floor(r() * ataquesL.length)];
    const bl = legales.filter(x => x.t === "bloquear" && x.b.length); if (bl.length && r() < 0.8) a = bl[Math.floor(r() * bl.length)];
    if (a.t === "atacar") ataques++; if (a.t === "bloquear" && a.b.length) bloqueos++;
    let res;
    try { res = M.aplicar(e, a, quien); } catch (err) { fallos.push(`excepción partida ${g}: ${err.stack.split("\n").slice(0, 3).join(" | ")} acción ${JSON.stringify(a)}`); break; }
    if (res.error) { fallos.push(`acción legal rechazada (partida ${g}): ${JSON.stringify(a)} -> ${res.error}`); break; }
    // invariantes
    for (const J of e.jugadores) {
      const h = J.campo.map(u => u.hueco); if (new Set(h).size !== h.length || h.some(x => !(x >= 0 && x < 6))) { fallos.push(`huecos inválidos partida ${g}: ${h}`); e.ganador = "x"; }
      if (J.campo.length > 6) { fallos.push("campo > 6"); e.ganador = "x"; }
    }
    if (e.combate && !e.pendiente) { fallos.push(`combate colgado sin pendiente partida ${g}`); break; }
  }
  if (e.ganador !== null) terminadas++;
}
console.log(fallos.length ? `${fallos.length} fallo(s):\n  ` + fallos.slice(0, 12).join("\n  ") : `OK: ${n} comprobaciones y ${terminadas} partidas al azar terminadas (${ataques} ataques, ${bloqueos} bloqueos).`);
process.exit(fallos.length ? 1 : 0);
