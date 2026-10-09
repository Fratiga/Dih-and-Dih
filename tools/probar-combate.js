// Prueba del combate de Triunfos (declarar, bloquear, palabras clave, reacciones) y 300 partidas al azar.
// Uso: node tools/probar-combate.js
const vm = require("vm"), fs = require("fs"), path = require("path");
const sb = { console }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
for (const f of ["cartas-datos", "cartas-motor", "cartas-efectos", "cartas-vinculos"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", `${f}.js`), "utf8"), sb, { filename: f });
const M = sb.CartasMotor;
const cartas = {}; sb.CARTAS.forEach(c => { cartas[c.id] = { id: c.id, nombre: c.nombre, tipo: c.tipo, rareza: c.rareza, afinidad: c.afinidad, coste: c.coste, atq: c.atq ?? null, pv: c.pv ?? null, habilidad: c.habilidad || "" }; });
// las cartas que solo existen en el servidor (Eledar, Laia, Leonard...): copia en tools/cartas-del-servidor.js
require("./cartas-del-servidor.js").forEach(c => { cartas[c.id] = { id: c.id, nombre: c.nombre, tipo: c.tipo, rareza: c.rareza, afinidad: c.afinidad, coste: c.coste, atq: c.atq ?? null, pv: c.pv ?? null, habilidad: c.habilidad || "" }; });
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
M.registrar("t-temible", { palabras: ["temible"] }); mk("t-temible", 3, 3);
{ const e = partida([], []); turnoDe(e, 0);
  const a = poner(e, 0, "t-temible"); const b = poner(e, 1, "t24"), c = poner(e, 1, "t11");
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 0); ok(M.aplicar(e, { t: "bloquear", b: [[a.uid, c.uid]] }, 1).error, "Temible: no la bloquea una unidad de menos de 3 de ataque");
  ok(M.aplicar(e, { t: "bloquear", b: [[a.uid, b.uid]] }, 1).error, "t24 (ataque 2) tampoco"); M.aplicar(e, { t: "pasar" }, 1); }
// 6b) Desafío
{ const e = partida([], []); turnoDe(e, 0); const g = poner(e, 0, "garra"); const manta = poner(e, 1, "manta-del-cielo"); const otra = poner(e, 1, "t24");
  ok(M.objetivosDeDesafio(e, g).includes(manta.uid), "Garra puede desafiar a una voladora");
  const r = M.aplicar(e, { t: "atacar", u: [g.uid], d: { [g.uid]: manta.uid } }, 0); ok(r.ok, "atacar con desafío " + JSON.stringify(r));
  ok(!e.pendiente && !M.buscar(e, manta.uid), "la voladora fue obligada a bloquear y recibió el golpe"); ok(e.jugadores[1].vida === 20, "el desafío no deja pasar el golpe al jugador"); }
{ const e = partida([], []); turnoDe(e, 0); const g = poner(e, 0, "garra"); const bull = poner(e, 1, "bull"); const manta = poner(e, 1, "manta-del-cielo");
  ok(M.objetivosDeDesafio(e, g).length === 1 && M.objetivosDeDesafio(e, g)[0] === bull.uid, "Provocar: el desafío debe apuntar a Bull primero");
  ok(M.aplicar(e, { t: "atacar", u: [g.uid], d: { [g.uid]: manta.uid } }, 0).error, "no se puede saltar a Provocar"); }
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t33"); const bull = poner(e, 1, "bull");
  ok(M.objetivosDeDesafio(e, a).length === 0, "sin Desafiante no se desafía"); ok(M.aplicar(e, { t: "atacar", u: [a.uid], d: { [a.uid]: bull.uid } }, 0).error, "desafío sin Desafiante"); }
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t33"); const bull = poner(e, 1, "bull"); const manta = poner(e, 1, "manta-del-cielo"); manta.flags.marcadaPor = 0;
  ok(M.objetivosDeDesafio(e, a).includes(manta.uid), "la marcada es Vulnerable: cualquiera de sus atacantes la desafía, aunque haya Provocar");
  ok(M.aplicar(e, { t: "atacar", u: [a.uid], d: { [a.uid]: manta.uid } }, 0).ok && !M.buscar(e, manta.uid), "desafío a la marcada: 3 de ataque +2 por la marca matan a la Aeromanta de 3 de vida"); }
{ const e = partida([], []); turnoDe(e, 0); e.terreno = { cartaId: "puente-de-las-legiones", dueno: 0, restantes: 2, turnoEntrada: 0, desde: 1 };
  const g = poner(e, 0, "garra"); const bull = poner(e, 1, "bull"); const manta = poner(e, 1, "manta-del-cielo");
  ok(M.objetivosDeDesafio(e, g).includes(manta.uid), "Puente de las Legiones: los desafíos ignoran Provocar"); }
{ const e = partida([], []); turnoDe(e, 0); const bull = poner(e, 1, "bull"); const manta = poner(e, 1, "manta-del-cielo", { barrera: false });
  const garra = M.ponerUnidad(e, 0, "garra", true, M.buscar(e, bull.uid).u);
  ok(!M.tienePalabra(e, bull, "provocar") && M.tienePalabra(e, manta, "volar"), "Arpón: quita Provocar");
  const m2 = M.ponerUnidad(e, 1, "manta-del-cielo", false, null); const g2 = M.ponerUnidad(e, 0, "garra", true, M.buscar(e, m2.uid).u);
  ok(!M.tienePalabra(e, m2, "volar"), "Arpón: quita Volar a la voladora");
  e.activo = 1; e.turno += 1; ok(!M.tienePalabra(e, m2, "volar"), "sigue sin Volar en el turno del rival (así sus voladoras se bloquean)");
  e.turno += 1; ok(M.tienePalabra(e, m2, "volar"), "después recupera Volar"); }
{ const e = partida([], []); turnoDe(e, 0); const g = poner(e, 0, "garra"), a2 = poner(e, 0, "t33"); const d1 = poner(e, 1, "t24"), d2 = poner(e, 1, "t11"); d1.flags.noBloqueaHasta = 0;
  M.aplicar(e, { t: "atacar", u: [g.uid, a2.uid], d: { [g.uid]: d1.uid } }, 0);
  ok(e.pendiente && e.pendiente.tipo === "bloqueo" && e.combate.forzados[g.uid] === d1.uid, "el desafío fija ese bloqueo y deja elegir el resto");
  ok(M.aplicar(e, { t: "bloquear", b: [[a2.uid, d1.uid]] }, 1).error, "el desafiado no puede bloquear a otro");
  ok(M.aplicar(e, { t: "bloquear", b: [[g.uid, d2.uid]] }, 1).error, "el atacante desafiante ya tiene su bloqueador");
  ok(M.aplicar(e, { t: "bloquear", b: [[a2.uid, d2.uid]] }, 1).ok, "el otro atacante sí puede ser bloqueado por otra unidad"); }
{ const e = partida([], []); turnoDe(e, 0); const g = poner(e, 0, "garra"); const cas = poner(e, 1, "cassius-coldgrave");
  M.aplicar(e, { t: "atacar", u: [g.uid], d: { [g.uid]: cas.uid } }, 0); ok(cas.pv < 3 || !M.buscar(e, cas.uid), "un desafío obliga a bloquear a quien no puede bloquear"); }
{ const e = partida([], []); turnoDe(e, 0); const g = poner(e, 0, "garra"), a2 = poner(e, 0, "t33"); const d1 = poner(e, 1, "t24"); e.jugadores[1].mano = ["bomba-de-humo"]; e.jugadores[1].energia = 5;
  M.aplicar(e, { t: "atacar", u: [g.uid, a2.uid], d: { [g.uid]: d1.uid } }, 0); M.aplicar(e, { t: "reaccionar", i: 0, o: { u: g.uid } }, 1);
  ok(e.combate && !(g.uid in e.combate.forzados) && e.combate.atacantes.length === 1, "la bomba sobre el desafiante libera al desafiado"); }
// 7) Veloz
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "enzo"); a.atq = 3; const b = poner(e, 1, "t24"); b.atq = 4; b.pv = 3; b.pvMax = 3;
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 0); M.aplicar(e, { t: "bloquear", b: [[a.uid, b.uid]] }, 1);
  ok(!M.buscar(e, b.uid) && M.buscar(e, a.uid) && a.pv === 3, `Veloz mata primero y no recibe daño (a.pv ${a.pv})`); }
// 8) Barrera
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t33"); const b = poner(e, 1, "t33", { barrera: true });
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 0); M.aplicar(e, { t: "bloquear", b: [[a.uid, b.uid]] }, 1);
  ok(b.pv === 3 && !b.flags.barrera, "Barrera absorbe el primer daño"); }
// 8b) Esquivo: recibe la mitad del daño de combate
M.registrar("t-esquivo", { palabras: ["esquivo"] }); mk("t-esquivo", 1, 2);
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t33"); const b = poner(e, 1, "t-esquivo"); // 1/2
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 0); M.aplicar(e, { t: "bloquear", b: [[a.uid, b.uid]] }, 1);
  ok(b.pv === 1 && !M.buscar(e, a.uid) === false, `Esquivo: 3 de daño pasan a 1 (pv ${b.pv})`); }
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t11"); const b = poner(e, 1, "t-esquivo");
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 0); M.aplicar(e, { t: "bloquear", b: [[a.uid, b.uid]] }, 1);
  ok(b.pv === 2, `Esquivo: 1 de daño se esquiva del todo (pv ${b.pv})`); }
// 8c) Escurridizo: ni desafíos ni habilidades enemigas pueden elegirlo
{ const e = partida([], []); turnoDe(e, 0); const g = poner(e, 0, "garra"); const mat = M.ponerUnidad(e, 1, "mattei", false, null); const otra = poner(e, 1, "t24");
  ok(M.esEscurridizo(e, mat), "Mattei recién entrado es escurridizo");
  ok(!M.objetivosDeDesafio(e, g).includes(mat.uid) && M.objetivosDeDesafio(e, g).includes(otra.uid), "no se puede desafiar a Mattei");
  ok(M.aplicar(e, { t: "atacar", u: [g.uid], d: { [g.uid]: mat.uid } }, 0).error, "desafío a Mattei rechazado");
  ok(!M.puedeApuntarHabilidad(e, mat, 0) && M.puedeApuntarHabilidad(e, mat, 1), "las habilidades enemigas no le apuntan, las suyas sí");
  const hornet = M.ponerUnidad(e, 0, "hornet", false, null); ok(!M.requisitoDeJugada(e, 0, "hornet").validos.some(v => v.u === mat.uid), "Hornet no puede apuntarle");
  // pasa el turno siguiente y deja de serlo
  e.turno += 1; ok(M.esEscurridizo(e, mat), "sigue siéndolo el turno siguiente"); e.turno += 1; ok(!M.esEscurridizo(e, mat), "luego deja de serlo"); }
{ const e = partida([], []); turnoDe(e, 0); const g = poner(e, 0, "garra"); const cas = poner(e, 1, "cassius-coldgrave");
  ok(M.esEscurridizo(e, cas) === false && M.objetivosDeDesafio(e, g).includes(cas.uid), "Cassius solo es vulnerable");
  const otra = poner(e, 1, "t24"); ok(M.esEscurridizo(e, cas) && !M.objetivosDeDesafio(e, g).includes(cas.uid), "con otra unidad en el campo, Cassius es escurridizo");
  cas.flags.marcadaPor = 0; ok(!M.objetivosDeDesafio(e, g).includes(cas.uid), "escurridizo gana a la marca");
  const a = poner(e, 0, "t33"); M.aplicar(e, { t: "atacar", u: [a.uid] }, 0); ok(!e.pendiente || e.pendiente.tipo === "bloqueo", "puede ser atacado por combate normal si bloquea"); }
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t33"); const mat = M.ponerUnidad(e, 1, "mattei", false, null);
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 0); M.aplicar(e, { t: "bloquear", b: [[a.uid, mat.uid]] }, 1);
  ok(!M.buscar(e, mat.uid), "si Mattei bloquea, recibe el daño de combate normal"); }
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

// 14b) Cartas del compendio añadidas con las afinidades: Darian y la Cueva de Carne
const terreno = (e, id, dueno, restantes = null) => { e.terreno = { cartaId: id, dueno, restantes, turnoEntrada: 0, desde: e.turno }; M.sincronizarTerreno(e); };
{ const e = partida([], []); turnoDe(e, 0); const d = poner(e, 0, "darian");
  ok(M.atqEfectivo(e, d) === 3 && d.pv === 4 && d.flags.barrera && M.tienePalabra(e, d, "duro"), "Darian: 3/4 con Barrera y Duro");
  e.jugadores[0].mano = ["cueva-de-carne"]; e.jugadores[0].energia = 10;
  ok(M.aplicar(e, { t: "jugar", i: 0 }, 0).ok, "juega la Cueva de Carne");
  ok(M.atqEfectivo(e, d) === 6 && d.pv === 8 && d.pvMax === 8, `Darian dentro de la Cueva: duplica ataque y vida (${M.atqEfectivo(e, d)}/${d.pv})`);
  const d2 = M.ponerUnidad(e, 0, "darian", false, null);
  ok(M.atqEfectivo(e, d2) === 6 && d2.pvMax === 8, "un Darian que entra con la Cueva ya en juego también se duplica");
  d.pv = 6; terreno(e, "puente-de-las-legiones", 0, 2);
  ok(M.atqEfectivo(e, d) === 3 && d.pvMax === 4 && d.pv === 4, `al irse la Cueva vuelve a 3/4 (${M.atqEfectivo(e, d)}/${d.pv}/${d.pvMax})`);
  terreno(e, "cueva-de-carne", 1); ok(M.atqEfectivo(e, d) === 6 && d.pvMax === 8, "la Cueva del rival también lo duplica (el terreno es de todos)");
  terreno(e, "cueva-de-carne", 1); ok(d.pvMax === 8, "no se duplica dos veces"); }
{ const e = partida([], []); turnoDe(e, 0); const d = poner(e, 0, "darian"); const r = poner(e, 1, "t24");
  M.infligir(e, { u: d.uid }, 5, { tipo: "habilidad" }); ok(d.pv === 4 && !d.flags.barrera, "Darian: la Barrera absorbe el primer golpe");
  M.infligir(e, { u: d.uid }, 2, { tipo: "habilidad" }); ok(d.pv === 3, "y después Duro quita 1"); }
// Fauces Grises: Desafiante a la Cacería del dueño
{ const e = partida([], []); turnoDe(e, 0); const h = poner(e, 0, "hornet"), ry = poner(e, 0, "ryn"), hr = poner(e, 1, "hornet");
  const manta = poner(e, 1, "manta-del-cielo");
  ok(!M.tienePalabra(e, h, "desafiante"), "sin terreno, Hornet no desafía");
  terreno(e, "fauces-grises", 0, 3);
  ok(M.tienePalabra(e, h, "desafiante") && !M.tienePalabra(e, ry, "desafiante") && !M.tienePalabra(e, hr, "desafiante"), "Fauces Grises: solo la Cacería de su dueño es Desafiante");
  ok(M.aplicar(e, { t: "atacar", u: [h.uid], d: { [h.uid]: manta.uid } }, 0).ok, "Hornet desafía a la voladora");
  ok(e.ultimoCombate && e.ultimoCombate.pares[0].desafio, "el desafío quedó registrado"); }
// Pozo de la Eternidad
{ const e = partida([], []); turnoDe(e, 0); terreno(e, "pozo-de-la-eternidad", 0);
  const g = poner(e, 0, "mamut-gelido"), g2 = poner(e, 0, "mamut-gelido"), b = poner(e, 0, "bull"), rival = poner(e, 1, "mamut-gelido");
  M.infligir(e, { u: g.uid }, 20, { tipo: "habilidad" });
  const vuelto = e.jugadores[0].campo.find(u => u.cartaId === "mamut-gelido" && u.uid !== g2.uid);
  ok(vuelto && vuelto.pv === 1 && vuelto.hueco === g.hueco && !e.jugadores[0].cementerio.includes("mamut-gelido"), "Pozo: la unidad de Eternidad vuelve con 1 de vida, en su hueco");
  M.infligir(e, { u: g2.uid }, 20, { tipo: "habilidad" }); ok(!M.buscar(e, g2.uid) && e.jugadores[0].cementerio.includes("mamut-gelido"), "solo una vez por turno");
  M.infligir(e, { u: b.uid }, 20, { tipo: "habilidad" }); ok(!M.buscar(e, b.uid), "una unidad de otra afinidad no vuelve");
  e.terreno.usado = 0; M.infligir(e, { u: rival.uid }, 20, { tipo: "habilidad" }); ok(!M.buscar(e, rival.uid), "la del rival tampoco"); }
// Campamento de las Astas Caídas
{ const e = partida([], []); turnoDe(e, 0); terreno(e, "campamento-de-las-astas-caidas", 0);
  const a = poner(e, 0, "t33"), b = poner(e, 0, "t24"), c = poner(e, 0, "t11"), r = poner(e, 1, "t33");
  M.infligir(e, { u: r.uid }, 9, { tipo: "habilidad" }); ok(M.atqEfectivo(e, a) === 3, "muere una del rival: sin luto");
  M.infligir(e, { u: c.uid }, 9, { tipo: "habilidad" });
  ok(M.atqEfectivo(e, a) === 4 && M.atqEfectivo(e, b) === 3, "Campamento: las demás ganan +1 de ataque");
  M.infligir(e, { u: b.uid }, 9, { tipo: "habilidad" }); ok(M.atqEfectivo(e, a) === 4, "solo la primera muerte de cada turno");
  M.aplicar(e, { t: "fin" }, 0); ok(M.atqEfectivo(e, a) === 4, "sigue en el turno del rival");
  M.aplicar(e, { t: "fin" }, 1); ok(M.atqEfectivo(e, a) === 4, "y en el propio turno siguiente");
  M.aplicar(e, { t: "fin" }, 0); ok(M.atqEfectivo(e, a) === 3, "luego termina"); }
// Carroñada
{ const e = partida([], []); turnoDe(e, 0); terreno(e, "carronada", 0);
  const a = poner(e, 0, "t33"), p = poner(e, 0, "bull"), v = poner(e, 1, "t11"); a.pv = 1;
  M.infligir(e, { u: v.uid }, 5, { tipo: "habilidad" }); ok(a.pv === 3 && p.pv === 4, `Carroñada: los de Carne se curan 2 cuando cae una unidad (${a.pv})`); }
// Montaña del Eco Arcano
{ const e = partida([], []); turnoDe(e, 0); const J = e.jugadores[0];
  const robadas = () => { J.mano = []; M.ponerUnidad(e, 0, "baraja", true, null); return J.mano.length; };
  const sinEco = robadas();
  terreno(e, "montana-del-eco-arcano", 0, 3); const conEco = robadas();
  ok(sinEco === 1 && conEco === 2, `Eco: la habilidad al entrar de una unidad de Arcano se repite (${sinEco} y ${conEco})`);
  const t = poner(e, 0, "t33"); M.ponerUnidad(e, 0, "ryn", true, t); ok(M.atqEfectivo(e, t) === 7, "Ryn bajo el eco da +4");
  const t2 = poner(e, 0, "t33"); M.ponerUnidad(e, 0, "hornet", true, null);   // sin objetivo no debe fallar
  terreno(e, "montana-del-eco-arcano", 1, 3); ok(robadas() === 1, "el eco solo vale para su dueño");
  terreno(e, "montana-del-eco-arcano", 0, 3); J.mano = []; M.ponerUnidad(e, 0, "t33", true, null); ok(J.mano.length === 0, "ni para unidades de otra afinidad"); }
// La banda de Cassius
{ const e = partida([], []); turnoDe(e, 0); const v = poner(e, 0, "voss"); e.jugadores[1].campo.length = 0; e.jugadores[1].mano = ["t11", "t11", "t11"];
  M.aplicar(e, { t: "atacar", u: [v.uid] }, 0); ok(e.jugadores[1].mano.length === 2 && e.jugadores[1].vida === 17, "Voss: al golpear al jugador, este descarta una carta"); }
{ const e = partida([], []); turnoDe(e, 0); const v = poner(e, 0, "voss"); const b = poner(e, 1, "t24"); e.jugadores[1].mano = ["t11", "t11"];
  M.aplicar(e, { t: "atacar", u: [v.uid] }, 0); M.aplicar(e, { t: "bloquear", b: [[v.uid, b.uid]] }, 1); ok(e.jugadores[1].mano.length === 2, "Voss bloqueada: sin descarte"); }
{ const e = partida([], []); turnoDe(e, 0); const t = poner(e, 1, "t33"), t2 = poner(e, 1, "t11");
  const vic = M.ponerUnidad(e, 0, "victor", true, t);
  ok(M.marcadaVigente(e, t) === 0 && M.objetivosDeDesafio(e, poner(e, 0, "t33")).includes(t.uid), "Victor: la unidad queda marcada y cualquiera puede desafiarla");
  e.turno += 2; ok(M.marcadaVigente(e, t) === 0, "sigue marcada hasta el final de tu próximo turno");
  e.turno += 1; ok(M.marcadaVigente(e, t) === null && M.objetivosDeDesafio(e, vic).length === 0, "y luego se acaba"); }
{ const e = partida([], []); turnoDe(e, 0); const b = poner(e, 1, "billy"), o = poner(e, 1, "t11"), g = poner(e, 0, "garra");
  ok(M.objetivosDeDesafio(e, g).length === 1 && M.objetivosDeDesafio(e, g)[0] === b.uid, "Billy tiene Provocar"); }
// Los Seis del Último Apunte
{ const e = partida([], []); turnoDe(e, 0); const am = poner(e, 0, "amarillo-ultimo-apunte"), a = poner(e, 0, "t33"), b = poner(e, 0, "t24");
  M.infligir(e, { u: a.uid }, 2, { tipo: "habilidad" }); ok(a.pv === 3 && am.pv === 4, "Amarillo recibe el primer golpe de una aliada (con Duro)");
  M.infligir(e, { u: b.uid }, 2, { tipo: "habilidad" }); ok(b.pv === 2 && am.pv === 4, "pero solo esa primera vez"); }
{ const e = partida([], []); turnoDe(e, 0); const r1 = poner(e, 1, "t24"), r2 = poner(e, 1, "t24");
  M.ponerUnidad(e, 0, "azul-ultimo-apunte", true, r1); const a = poner(e, 0, "t33");
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 0); ok(e.pendiente && !M.puedeBloquear(e, r1, a) && M.puedeBloquear(e, r2, a), "Azul: la unidad señalada no puede bloquear este turno");
  M.aplicar(e, { t: "pasar" }, 1); }
{ const e = partida([], []); turnoDe(e, 0); const r1 = poner(e, 1, "t24");
  M.ponerUnidad(e, 0, "morado-ultimo-apunte", true, r1);
  ok(r1.flags.noBloqueaHasta >= e.turno + 1 && r1.flags.noAtacaHasta >= e.turno + 1, "Morado: ni ataca ni bloquea hasta el final de su próximo turno");
  M.aplicar(e, { t: "fin" }, 0); r1.entro = 0; ok(!M.unidadPuedeAtacar(e, r1), "no puede atacar en su turno"); }
{ const e = partida([], []); turnoDe(e, 0); const g = poner(e, 0, "gris-ultimo-apunte"), a = poner(e, 0, "t33");
  ok(M.atqEfectivo(e, a) === 4 && M.atqEfectivo(e, g) === 1, "Gris: las demás tienen +1 de ataque"); }
{ const e = partida([], []); turnoDe(e, 0); const g = poner(e, 0, "gris-ultimo-apunte"), a = poner(e, 0, "t33");
  const rojo = M.ponerUnidad(e, 0, "rojo-ultimo-apunte", true, null);
  ok(g.pv === 6 && M.atqEfectivo(e, g) === 3 && a.pv === 3 && M.tienePalabra(e, rojo, "desafiante"), "Rojo: solo los del Último Apunte ganan +1/+1 (y juntos, el vínculo del Último Apunte suma otro +1/+1)"); }
{ const e = partida([], []); turnoDe(e, 0); const big = poner(e, 0, "t24"); big.pv = 1; big.pvMax = 10; big.atq = 2;
  M.ponerUnidad(e, 0, "elias-morcant", true, big); ok(big.pv === 6, `Elías cura 5 a una de Carne (${big.pv})`);
  const ry = poner(e, 0, "ryn"); ry.pv = 1; ry.pvMax = 10; M.ponerUnidad(e, 0, "elias-morcant", true, ry); ok(ry.pv === 4, `y 3 a una de otra afinidad (${ry.pv})`);
}
{ const e = partida([], []); turnoDe(e, 0); const el = poner(e, 0, "elias-morcant"), tgt = poner(e, 1, "t33"); tgt.flags.danada = true;
  M.aplicar(e, { t: "atacar", u: [el.uid] }, 0); M.aplicar(e, { t: "bloquear", b: [[el.uid, tgt.uid]] }, 1);
  ok(!M.buscar(e, tgt.uid), "Elías: +2 de daño contra una unidad que ya recibió daño (2+2 matan a la de 3 de vida)"); }
{ const e = partida([], []); turnoDe(e, 0); const el = poner(e, 0, "elias-morcant"), tgt = poner(e, 1, "t33");
  M.aplicar(e, { t: "atacar", u: [el.uid] }, 0); M.aplicar(e, { t: "bloquear", b: [[el.uid, tgt.uid]] }, 1);
  ok(tgt.pv === 1, "y sin daño previo pega solo 2"); }
{ const e = partida([], []); turnoDe(e, 0); const t = poner(e, 1, "t33"); M.ponerUnidad(e, 0, "baltasar-sorel", true, t); ok(t.pv === 1, "Baltasar: 2 de daño al entrar");
  const t2 = poner(e, 1, "t33"); M.ponerUnidad(e, 0, "protodraco", true, t2); ok(t2.pv === 1 && M.tienePalabra(e, M.todas(e).find(u => u.cartaId === "protodraco"), "volar"), "Protodraco: Volar y 2 de daño al entrar"); }
{ const e = partida([], []); turnoDe(e, 0); const n = poner(e, 0, "nico"), tobi = poner(e, 0, "coronel-tobi"), f = poner(e, 0, "felino-veloz-mistico");
  ok(M.tienePalabra(e, n, "esquivo") && M.tienePalabra(e, tobi, "provocar") && M.tienePalabra(e, tobi, "arrollar"), "Nico Esquivo; Tobi Provocar y Arrollar");
  ok(M.esEscurridizo(e, f) && M.tienePalabra(e, f, "veloz"), "Fulguepardo: Veloz y Escurridizo al entrar");
  const gu = poner(e, 0, "guillotina"), dr = poner(e, 0, "dragarto"), ge = poner(e, 0, "mamut-gelido"), ha = poner(e, 0, "halcon-linire"), co = poner(e, 0, "colmillo-gris");
  ok(M.tienePalabra(e, gu, "veloz") && M.tienePalabra(e, gu, "arrollar") && M.tienePalabra(e, dr, "arrollar") && M.tienePalabra(e, ge, "duro") && M.tienePalabra(e, ha, "volar") && M.tienePalabra(e, co, "veloz"), "palabras de las criaturas nuevas"); }
// Objetos nuevos
{ const e = partida([], []); turnoDe(e, 0); const t = poner(e, 1, "t33"), esc = poner(e, 1, "t11", { escurridizoHasta: 99 });
  e.jugadores[0].mano = ["veneno-debil"]; e.jugadores[0].energia = 5;
  const req = M.requisitoDeJugada(e, 0, "veneno-debil"); ok(req.validos.length === 1 && req.validos[0].u === t.uid, "un objeto hostil no puede apuntar a una escurridiza");
  ok(M.aplicar(e, { t: "jugar", i: 0, o: { u: t.uid } }, 0).ok && M.atqEfectivo(e, t) === 1, "Veneno débil: -2 de ataque");
  M.aplicar(e, { t: "fin" }, 0); ok(M.atqEfectivo(e, t) === 1, "dura en el turno del rival"); M.aplicar(e, { t: "fin" }, 1); ok(M.atqEfectivo(e, t) === 3, "y luego se acaba"); }
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t33"); e.jugadores[0].mano = ["capa-reversible"]; e.jugadores[0].energia = 5;
  M.aplicar(e, { t: "jugar", i: 0, o: { u: a.uid } }, 0); ok(M.esEscurridizo(e, a), "Capa reversible: Escurridizo");
  e.turno += 1; ok(M.esEscurridizo(e, a), "durante el turno del rival"); e.turno += 1; ok(!M.esEscurridizo(e, a), "y luego no"); }
{ const e = partida([], []); turnoDe(e, 0); const c = poner(e, 0, "t24"), ry = poner(e, 0, "ryn"); c.pv = 1; ry.pv = 1;
  e.jugadores[0].mano = ["kit-de-sanador", "kit-de-sanador"]; e.jugadores[0].energia = 9;
  M.aplicar(e, { t: "jugar", i: 0, o: { u: ry.uid } }, 0); ok(ry.pv === 3 && M.atqEfectivo(e, ry) === 2 && ry.pvMax === 3, `Kit de sanador: cura 4, sin bono a otra afinidad (${ry.pv})`);
  M.aplicar(e, { t: "jugar", i: 0, o: { u: c.uid } }, 0); ok(c.pv === 5 && M.atqEfectivo(e, c) === 3 && c.pvMax === 5, `y a una de Carne le da +1/+1 (${c.pv}/${c.pvMax})`); }
{ const e = partida([], []); turnoDe(e, 0); const J = e.jugadores[0]; J.mano = ["corneta-de-senales"]; J.energia = 3; poner(e, 0, "bull");
  let n0 = J.mano.length; M.aplicar(e, { t: "jugar", i: 0 }, 0); ok(J.mano.length - (n0 - 1) === 1, "Corneta: una carta con menos de dos de Juramento");
  J.mano = ["corneta-de-senales"]; J.energia = 3; poner(e, 0, "billy"); n0 = J.mano.length; M.aplicar(e, { t: "jugar", i: 0 }, 0); ok(J.mano.length - (n0 - 1) === 2, "y dos con dos de Juramento"); }
{ const e = partida([], []); turnoDe(e, 0); const J = e.jugadores[0]; J.energia = 9; J.mano = ["sales-aromaticas"];
  J.cementerio = ["bull", "centinela", "kraken", "cristal-de-mana"];
  M.aplicar(e, { t: "jugar", i: 0 }, 0); const k = J.campo.find(u => u.cartaId === "kraken");
  ok(k && k.pv === 1 && !J.cementerio.includes("kraken") && J.cementerio.includes("bull"), "Sales aromáticas: despierta a la última unidad del cementerio con 1 de vida");
  J.mano = ["sales-aromaticas"]; J.cementerio = ["cristal-de-mana"]; ok(M.aplicar(e, { t: "jugar", i: 0 }, 0).ok, "sin nadie a quien despertar no falla"); }
// Reacciones nuevas
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t33"), m = poner(e, 0, "t52", { escurridizoHasta: 99 });
  e.jugadores[1].mano = ["trampa-para-animales"]; e.jugadores[1].energia = 5;
  M.aplicar(e, { t: "atacar", u: [a.uid, m.uid] }, 0);
  const req = M.requisitoDeReaccion(e, 1, "trampa-para-animales");
  ok(e.pendiente && req.validos.length === 1 && req.validos[0].u === a.uid, "Trampa para animales: no puede apuntar a una escurridiza");
  ok(M.aplicar(e, { t: "reaccionar", i: 0, o: { u: m.uid } }, 1).error, "elegirla se rechaza");
  ok(M.aplicar(e, { t: "reaccionar", i: 0, o: { u: a.uid } }, 1).ok && !M.buscar(e, a.uid), "y hiere a la elegida (3 de daño matan a la de 3 de vida)");
  ok(e.jugadores[1].vida === 15, `la otra atacante golpea al jugador (vida ${e.jugadores[1].vida})`); }
{ const e = partida([], []); turnoDe(e, 0); const m = poner(e, 0, "t33", { escurridizoHasta: 99 });
  e.jugadores[1].mano = ["trampa-para-animales"]; e.jugadores[1].energia = 5;
  M.aplicar(e, { t: "atacar", u: [m.uid] }, 0); ok(!e.pendiente && e.jugadores[1].vida === 17, "sin objetivo posible no hay ventana de reacción"); }
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t33"), b = poner(e, 0, "t52");
  e.jugadores[1].mano = ["saco-de-abrojos"]; e.jugadores[1].energia = 5;
  M.aplicar(e, { t: "atacar", u: [a.uid, b.uid] }, 0); M.aplicar(e, { t: "reaccionar", i: 0 }, 1);
  ok(e.jugadores[1].vida === 20 - (2 + 4), `Saco de abrojos: cada atacante pierde 1 de ataque (vida ${e.jugadores[1].vida})`);
  ok(M.atqEfectivo(e, a) === 2, "hasta el final del turno"); }

// Fuerza Helénica: el daño contra una unidad es su vida, las resistencias siguen valiendo y sin bloqueo mata al jugador
M.registrar("t-exacto", { fuerzaHelenica: true }); mk("t-exacto", 4, 6);
M.registrar("t-duro", { palabras: ["duro"] }); mk("t-duro", 2, 5);
const exacto = (obj, atkExtra) => { const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t-exacto"); const b = poner(e, 1, obj.id, obj.flags || {});
  if (obj.pv) { b.pv = obj.pv; b.pvMax = Math.max(b.pvMax, obj.pv); }
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 0); M.aplicar(e, { t: "bloquear", b: [[a.uid, b.uid]] }, 1); return { e, a, b }; };
{ const { a, b, e } = exacto({ id: "t24", pv: 4 }); ok(!M.buscar(e, b.uid) && a.pv === 4, `Fuerza Helénica: mata a la unidad bloqueadora de 4 de vida y recibe su ataque (a.pv ${a.pv})`); }
{ const { a, b, e } = exacto({ id: "t24", pv: 4 }); ok(e.ultimoCombate.pares[0].dA === 4, "el daño registrado es la vida del objetivo"); }
{ const { b, e } = exacto({ id: "t-duro" }); ok(M.buscar(e, b.uid) && b.pv === 1, `Duro: queda con 1 de vida (${b.pv})`); }
{ const { b, e } = exacto({ id: "t-esquivo", pv: 6 }); ok(M.buscar(e, b.uid) && b.pv === 3, `Esquivo: recibe la mitad (${b.pv})`); }
{ const { b, e } = exacto({ id: "t33", flags: { barrera: true } }); ok(b.pv === 3 && !b.flags.barrera, "Barrera: absorbe el golpe entero"); }
{ const { b, e } = exacto({ id: "draco" }); ok(M.buscar(e, b.uid) && b.pv === 2, `Draco reduce 2: sobrevive con 2 (${b.pv})`); }
{ const { b, e } = exacto({ id: "t-duro", flags: { marcadaPor: 0 } }); ok(b.pv === 1, `la marca no suma: sigue siendo la vida exacta (${b.pv})`); }
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t-exacto"); e.jugadores[1].campo.length = 0;
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 0);
  ok(e.jugadores[1].vida <= 0 && e.ganador === 0, `sin bloqueo, toca al jugador y lo derrota de un golpe (vida ${e.jugadores[1].vida}, ganador ${e.ganador})`);
  ok(e.log.some(l => /Fuerza Helénica: cae de un solo golpe/.test(typeof l === "string" ? l : l.texto || "")), "el registro lo cuenta"); }
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t-exacto"); const b = poner(e, 1, "t24"); e.jugadores[1].vida = 3;
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 0); M.aplicar(e, { t: "bloquear", b: [[a.uid, b.uid]] }, 1);
  ok(e.jugadores[1].vida === 3 && e.ganador === null, `si la bloquean, el jugador no recibe nada (vida ${e.jugadores[1].vida})`); }
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t-exacto"), a2 = poner(e, 0, "t11"); e.jugadores[1].campo.length = 0; e.jugadores[1].vida = 1;
  M.aplicar(e, { t: "atacar", u: [a2.uid, a.uid] }, 0); ok(e.ganador === 0, "también derrota a un jugador con poca vida mientras otros atacan"); }
{ const e = partida([], []); turnoDe(e, 1); const a = poner(e, 1, "t-exacto"); e.jugadores[0].campo.length = 0;
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 1); ok(e.ganador === 1, "vale igual para el segundo jugador"); }
{ const e = partida([], []); turnoDe(e, 1); const a = poner(e, 1, "t52"); const b = poner(e, 0, "t-exacto"); a.pv = 4; a.pvMax = 4; e.jugadores[0].campo.forEach(u => { u.entro = 0; });
  M.aplicar(e, { t: "atacar", u: [a.uid] }, 1); M.aplicar(e, { t: "bloquear", b: [[a.uid, b.uid]] }, 0);
  ok(!M.buscar(e, a.uid) && b.pv === 1, `al bloquear también mata al atacante (b.pv ${b.pv})`); }
{ const e = partida([], []); turnoDe(e, 0); const a = poner(e, 0, "t-exacto"), amigo = poner(e, 0, "t11"); const og = poner(e, 1, "ocevat"), v = poner(e, 1, "t24"); v.pv = 3; v.pvMax = 4;
  M.aplicar(e, { t: "atacar", u: [a.uid], d: {} }, 0); M.aplicar(e, { t: "bloquear", b: [[a.uid, v.uid]] }, 1);
  ok(M.buscar(e, v.uid) && v.pv === 3 && og.pv === 3, `el guardián recibe el golpe en su lugar: el objetivo se salva y Ocevat queda en ${og.pv}/6`); }
ok(!!(M.EFECTOS["adam-kovacs-h"] && M.EFECTOS["adam-kovacs-h"].fuerzaHelenica), "Adam, héroe de Brurland (adam-kovacs-h): Fuerza Helénica registrada");

// 15) simulación aleatoria con accionesLegales
function azar(sem) { let x = sem >>> 0; return () => { x = (x + 0x6D2B79F5) >>> 0; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ids = Object.keys(cartas);   // incluye las cartas de prueba (t11, t-temible...), que se filtran al armar los mazos
let terminadas = 0, ataques = 0, bloqueos = 0;
// Cementerio: qué entra, en qué orden y cómo se devuelven unidades
mk("t-nigro", 2, 3); M.registrar("t-nigro", { alMorirAliada: c => { c.u.atq += 1; c.u.flags.aliadas = (c.u.flags.aliadas || 0) + 1; c.u.flags.ultimaMuerta = c.muerta.cartaId; },
  alMorirEnemiga: c => { c.u.flags.enemigas = (c.u.flags.enemigas || 0) + 1; } });
mk("t-reanima", 1, 2); M.registrar("t-reanima", { alEntrar: { resolver: c => M.revivir(c.est, c.j, { pv: 2, conEntrada: false }) } });
mk("t-fallo", 1, 1); M.registrar("t-fallo", { alMorirAliada: c => { M.revivir(c.est, c.j, { id: c.muerta.cartaId, pv: 1 }); } });
{ const e = partida([], []); turnoDe(e, 0); const J = e.jugadores[0];
  const a = poner(e, 0, "t11"), b = poner(e, 0, "t33"), c = poner(e, 0, "centinela");
  M.infligir(e, { u: a.uid }, 9, { tipo: "habilidad" }); M.infligir(e, { u: c.uid }, 9, { tipo: "habilidad" }); M.infligir(e, { u: b.uid }, 9, { tipo: "habilidad" });
  ok(J.cementerio.join() === "t11,t33", `las unidades que caen llegan al cementerio por orden y las fichas no (${J.cementerio})`);
  ok(M.cementerioDe(e, 0) === J.cementerio && M.enCementerio(e, 0).length === 2 && M.enCementerio(e, 0, m => m.pv === 3)[0].id === "t33", "cementerioDe y enCementerio");
  ok(M.exiliar(e, 0, 0) === "t11" && J.cementerio.join() === "t33" && M.exiliar(e, 0, 9) === null, "exiliar saca la carta para siempre"); }
{ const e = partida([], []); turnoDe(e, 0); const J = e.jugadores[0];
  J.cementerio = ["t11", "centinela", "t52", "t24", "cristal-de-mana"];
  const u = M.revivir(e, 0, {});
  ok(u && u.cartaId === "t24" && u.pv === u.pvMax && J.cementerio.join() === "t11,centinela,t52,cristal-de-mana", `revivir devuelve por defecto la última unidad, con la vida completa (${u && u.cartaId})`);
  ok(!M.unidadPuedeAtacar(e, u), "la unidad devuelta entra como cualquier otra: no ataca ese turno");
  ok(M.revivir(e, 0, { cual: "primera", pv: 1 }).cartaId === "t11" && M.buscar(e, u.uid) && J.campo.find(x => x.cartaId === "t11").pv === 1, "cual: primera, y pv fija la vida");
  ok(M.revivir(e, 0, { cual: "fuerte" }).cartaId === "t52" && J.cementerio.join() === "centinela,cristal-de-mana", "cual: fuerte elige la de más ataque más vida");
  ok(M.revivir(e, 0, {}) === null && J.cementerio.join() === "centinela,cristal-de-mana", "sin unidades que cumplan no hace nada (ni fichas ni objetos)");
  J.cementerio = ["t11", "t33"]; ok(M.revivir(e, 0, { id: "t33", pv: 99 }).pv === 3 && J.cementerio.join() === "t11", "id elige una carta y pv no pasa de la vida máxima");
  J.cementerio = ["t11", "t33", "t24"]; ok(M.revivir(e, 0, { filtro: m => m.atq === 2 }).cartaId === "t24", "filtro por meta");
  const k = M.revivir(e, 0, { cual: "azar" }); ok(k && J.cementerio.length === 1, "cual: azar"); }
{ const e = partida([], []); turnoDe(e, 0); const J = e.jugadores[0], R = e.jugadores[1];
  while (J.campo.length < M.C.CAMPO_MAX) poner(e, 0, "t11"); J.cementerio = ["t33"];
  ok(M.revivir(e, 0, {}) === null && J.cementerio.join() === "t33", "con el campo lleno no devuelve nada y la carta se queda en el cementerio");
  J.campo.length = 0; R.cementerio = ["t52"]; const robada = M.revivir(e, 0, { desde: 1 });
  ok(robada && robada.dueno === 0 && R.cementerio.length === 0, "desde: el cementerio del rival, la unidad entra en tu campo"); }
{ const e = partida([], []); turnoDe(e, 0); const J = e.jugadores[0]; J.cementerio = ["t24"]; J.mano = ["t-reanima"]; J.energia = 9;
  M.aplicar(e, { t: "jugar", i: 0 }, 0);
  ok(J.campo.some(u => u.cartaId === "t24" && u.pv === 2) && J.campo.some(u => u.cartaId === "t-reanima") && J.cementerio.length === 0, "una unidad que revive a otra al entrar"); }
{ const e = partida([], []); turnoDe(e, 0);
  const n = poner(e, 0, "t-nigro"), a = poner(e, 0, "t11"), r = poner(e, 1, "t11"), r2 = poner(e, 1, "t24");
  M.infligir(e, { u: a.uid }, 9, { tipo: "habilidad" });
  ok(n.flags.aliadas === 1 && n.flags.ultimaMuerta === "t11" && M.atqEfectivo(e, n) === 3 && !n.flags.enemigas, "alMorirAliada: reacciona a la caída de un aliado, con la muerta ya en el cementerio");
  M.infligir(e, { u: r.uid }, 9, { tipo: "habilidad" });
  ok(n.flags.enemigas === 1 && n.flags.aliadas === 1, "alMorirEnemiga: reacciona a la caída de un rival");
  M.infligir(e, { u: n.uid }, 9, { tipo: "habilidad" });
  ok(!M.buscar(e, n.uid) && e.jugadores[0].cementerio.includes("t-nigro"), "no se reacciona a la propia caída"); }
{ const e = partida([], []); turnoDe(e, 0); const J = e.jugadores[0]; poner(e, 0, "t-fallo"); const v = poner(e, 0, "t33");
  M.infligir(e, { u: v.uid }, 9, { tipo: "habilidad" });
  ok(J.campo.some(u => u.cartaId === "t33" && u.pv === 1) && !J.cementerio.includes("t33"), "una unidad puede devolver a la aliada que acaba de caer"); }
{ const e = partida([], []); turnoDe(e, 0); const J = e.jugadores[0];
  J.mano = ["sales-aromaticas"]; J.energia = 9; M.aplicar(e, { t: "jugar", i: 0 }, 0);
  ok(J.cementerio.at(-1) === "sales-aromaticas", "los objetos y acciones jugados van al cementerio");
  J.mano = ["osario-de-la-frontera"]; J.energia = 9; M.aplicar(e, { t: "jugar", i: 0 }, 0);
  J.mano = ["pozo-de-la-eternidad"]; J.energia = 9; M.aplicar(e, { t: "jugar", i: 0 }, 0);
  ok(J.cementerio.at(-1) === "osario-de-la-frontera" && e.terreno.cartaId === "pozo-de-la-eternidad", "un terreno reemplazado se va al cementerio de su dueño"); }


// 13) Campo de 10 unidades
{ const e = partida([], []); turnoDe(e, 0); const J = e.jugadores[0];
  ok(M.C.CAMPO_MAX === 10, "el campo tiene 10 huecos");
  for (let i = 0; i < 10; i++) poner(e, 0, "t11");
  J.mano = ["t33"]; J.energia = 9; ok(M.aplicar(e, { t: "jugar", i: 0 }, 0).error === "Tu campo está lleno.", "con 10 unidades el campo está lleno");
  ok(new Set(J.campo.map(u => u.hueco)).size === 10, "cada unidad en su hueco (0 a 9)"); }

// 14) Vínculos: círculos, lazos y completos
{ const e = partida([], []); turnoDe(e, 0);
  const rook = poner(e, 0, "rook"), bull = poner(e, 0, "bull");
  ok(M.atqEfectivo(e, bull) === 4 && bull.pv === 4, "Las Comadrejas: dos juntas, +1 de ataque");
  const garra = poner(e, 0, "garra");
  ok(M.atqEfectivo(e, bull) === 4 && bull.pv === 5 && garra.pvMax === 3, `tres Comadrejas: +1/+1 (bull ${M.atqEfectivo(e, bull)}/${bull.pv})`);
  const baraja = poner(e, 0, "baraja");
  ok(M.atqEfectivo(e, bull) === 5 && bull.pv === 5 && M.atqEfectivo(e, rook) === 7, `la banda entera: +2/+1 (bull ${M.atqEfectivo(e, bull)}/${bull.pv}, rook ${M.atqEfectivo(e, rook)})`);
  ok(M.vinculosActivos(e, bull).some(x => x.id === "comadrejas" && x.n === 4), "los vínculos activos se pueden consultar");
  M.morir(e, baraja, { tipo: "habilidad" }); M.morir(e, garra, { tipo: "habilidad" });
  ok(bull.pv === 4 && bull.pvMax === 4 && M.atqEfectivo(e, bull) === 4, `al caer sus compañeras, el bono se va (bull ${M.atqEfectivo(e, bull)}/${bull.pv})`);
  M.morir(e, rook, { tipo: "habilidad" }); ok(M.atqEfectivo(e, bull) === 3, "solo, Bull vuelve a sus números"); }
{ const e = partida([], []); turnoDe(e, 0);   // el bono de vida no cura ni deja al borde de la muerte
  const bull = poner(e, 0, "bull"), rook = poner(e, 0, "rook"); bull.pv = 2;
  const garra = poner(e, 0, "garra"); ok(bull.pv === 3 && bull.pvMax === 5, "el +1 de vida también sube la vida actual");
  M.morir(e, garra, { tipo: "habilidad" }); ok(bull.pv === 2 && bull.pvMax === 4, "al perder el bono, la vida actual baja con él"); }
{ const e = partida([], []); turnoDe(e, 0);   // completo con Barrera (una sola vez por unidad)
  const ids = ["orina", "edge", "hornet", "sir-buffolet", "enzo", "mattei", "eledar"];
  const us = ids.slice(0, 6).map(id => poner(e, 0, id));
  ok(us.every(u => !u.flags.barrera), "con seis de siete no hay Barrera");
  const eledar = poner(e, 0, "eledar");
  ok(us.concat(eledar).every(u => u.flags.barrera), "los siete fugitivos juntos ganan Barrera");
  us[0].flags.barrera = false; M.morir(e, eledar, { tipo: "habilidad" }); poner(e, 0, "eledar");
  ok(us[0].flags.barrera === false, "la Barrera de un vínculo se da una sola vez a cada unidad"); }
{ const e = partida([], []); turnoDe(e, 0); const cas = poner(e, 0, "cassius-coldgrave"), billy = poner(e, 0, "billy"), voss = poner(e, 0, "voss");
  ok(M.tienePalabra(e, cas, "noBloquea"), "Cassius con dos de su banda sigue sin bloquear");
  const victor = poner(e, 0, "victor");
  ok(!M.tienePalabra(e, cas, "noBloquea") && M.tienePalabra(e, billy, "provocar"), "con toda la banda detrás, Cassius sí bloquea");
  M.morir(e, victor, { tipo: "habilidad" }); ok(M.tienePalabra(e, cas, "noBloquea"), "sin uno de ellos vuelve a ser cobarde"); }
{ const e = partida([], []); turnoDe(e, 0);   // Coach cubre siempre a Ryn
  const ryn = poner(e, 0, "ryn"), coach = poner(e, 0, "coach");
  ok(ryn.pv === 4 && coach.pv === 4, "Coach y Ryn: Ryn gana +1 de vida");
  M.infligir(e, { u: ryn.uid }, 1, { tipo: "habilidad" }); ok(ryn.pv === 4 && coach.pv === 3, "Coach recibe el golpe en lugar de Ryn");
  M.infligir(e, { u: ryn.uid }, 1, { tipo: "habilidad" }); ok(ryn.pv === 3, "una sola vez por turno");
  e.turno += 1; M.infligir(e, { u: ryn.uid }, 1, { tipo: "habilidad" }); ok(ryn.pv === 3 && coach.pv === 2, "y otra vez al turno siguiente (por el lazo)"); }
{ const e = partida([], []); turnoDe(e, 0); const clef = poner(e, 0, "clef"), ulis = poner(e, 0, "ulis");
  ok(M.atqEfectivo(e, ulis) === 3 && ulis.pvMax === 4, "Clef y Ulis: Ulis gana +1/+1 (y +1 de ataque más por ser las dos del Instituto)");
  e.jugadores[1].campo.length = 0; const dar = poner(e, 1, "darian");
  ok(M.atqEfectivo(e, ulis) === 6 && ulis.pvMax === 7, `Ulis frente a Darian: la orden de Clef le da fuerza de monstruo (${M.atqEfectivo(e, ulis)}/${ulis.pvMax})`); }
{ const e = partida([], []); turnoDe(e, 0); const ul = poner(e, 0, "ulis"); ul.entro = 0; poner(e, 1, "t33");
  ok(M.atqEfectivo(e, ul) === 1, "Ulis fuera de combate es la niña: 1 de ataque");
  M.aplicar(e, { t: "atacar", u: [ul.uid] }, 0);
  ok(M.atqEfectivo(e, ul) === 3, "al atacar se transforma sin coste: +2 de ataque");
  M.aplicar(e, { t: "pasar" }, 1);
  ok(M.atqEfectivo(e, ul) === 1 && ul.pv === ul.pvMax, "al terminar el combate vuelve a ser la niña y no queda herida por transformarse"); }
{ const e = partida([], []); turnoDe(e, 1); const ul = poner(e, 0, "ulis"); const at = poner(e, 1, "t33"); at.entro = 0;
  M.aplicar(e, { t: "atacar", u: [at.uid] }, 1); const rb = M.aplicar(e, { t: "bloquear", b: [[at.uid, ul.uid]] }, 0);
  ok(rb.ok, "Ulis bloquea " + JSON.stringify(rb)); ok(!M.buscar(e, at.uid), "al bloquear también se transforma: golpea con 3 y destruye a una 3/3"); }

// 15) Rivalidades secretas
{ const e = partida([], []); turnoDe(e, 0); const enzo = poner(e, 0, "enzo"); const alia = poner(e, 0, "t33");
  const orina = poner(e, 1, "orina");
  ok(e.log.some(l => l.includes("La muerte que mereces")), "se anuncia la rivalidad al activarse");
  ok(M.vinculosActivos(e, enzo).some(x => x.tipo === "rivalidad" && x.nombre === "La muerte que mereces"), "Enzo tiene la rivalidad activa");
  const mano0 = e.jugadores[0].mano.length;
  M.aplicar(e, { t: "atacar", u: [enzo.uid] }, 0); M.aplicar(e, { t: "bloquear", b: [[enzo.uid, orina.uid]] }, 1);
  ok(!M.buscar(e, orina.uid) && alia.pv === 3, "si Enzo mata a Orina, su Proyectil no se dispara");
  ok(e.jugadores[0].mano.length === mano0 + 1, "y Enzo cobra la recompensa: roba una carta"); }
{ const e = partida([], []); turnoDe(e, 0); const enzo = poner(e, 0, "enzo"); const col = poner(e, 0, "colmillo-gris");   // Veloz: mata sin recibir daño
  const orina = poner(e, 1, "orina");
  M.aplicar(e, { t: "atacar", u: [col.uid] }, 0); M.aplicar(e, { t: "bloquear", b: [[col.uid, orina.uid]] }, 1);
  ok(!M.buscar(e, orina.uid) && !M.buscar(e, col.uid), "si la mata otra unidad, el Proyectil sí hace su daño (3 a Colmillo Gris)"); }
{ const e = partida([], []); turnoDe(e, 0); poner(e, 0, "enzo"); const orina = poner(e, 0, "orina");
  ok(!e.log.some(l => l.includes("La muerte que mereces")) && M.vinculosActivos(e, orina).every(x => x.tipo !== "rivalidad"), "Enzo y Orina del mismo lado no son rivales"); }
{ const e = partida([], []); turnoDe(e, 0); const rook = poner(e, 0, "rook"); const bull = poner(e, 1, "bull"), eledar = poner(e, 1, "eledar");
  ok(M.objetivosDeDesafio(e, rook).length === 1 && M.objetivosDeDesafio(e, rook)[0] === eledar.uid, "El arpón no avisa: Rook puede desafiar a Eledar aunque Bull tenga Provocar");
  ok(M.aplicar(e, { t: "atacar", u: [rook.uid], d: { [rook.uid]: eledar.uid } }, 0).ok && !M.buscar(e, eledar.uid), "el desafío mata a Eledar (7 de ataque, más 1 de Presagio fallido)"); }
{ const e = partida([], []); turnoDe(e, 0); const rojo = poner(e, 0, "rojo-ultimo-apunte"), verde = poner(e, 0, "verde-ultimo-apunte");
  const base = M.atqEfectivo(e, verde);
  const hooey = poner(e, 1, "hooey-magoo"); const robaba = e.jugadores[1].mano.length;
  ok(M.atqEfectivo(e, verde) === base + 1, "Hubert Magnolia: los del Último Apunte cazan a Hooey (+1 de ataque)");
  M.infligir(e, { u: hooey.uid }, 99, { tipo: "habilidad", dueno: 0 });
  ok(rojo.pv === 1 && !M.buscar(e, verde.uid), "al caer, Hooey explota: 3 de daño al Último Apunte (Verde muere, Rojo queda con 1)");
  ok(e.jugadores[1].mano.length === robaba + 1, "y su Sacrificado sigue robando carta"); }
{ const e = partida([], []); turnoDe(e, 0); const tobi = poner(e, 0, "coronel-tobi"); const base = M.atqEfectivo(e, tobi);
  poner(e, 1, "rojo-ultimo-apunte"); ok(M.atqEfectivo(e, tobi) === base + 2, "Nadie le da órdenes al Coronel: +2 de ataque frente a Rojo"); }
{ const e = partida([], []); turnoDe(e, 0); const dag = poner(e, 0, "dagren"); const gui = poner(e, 1, "guillotina");
  const antes = gui.pv; M.aplicar(e, { t: "atacar", u: [dag.uid] }, 0); M.aplicar(e, { t: "bloquear", b: [[dag.uid, gui.uid]] }, 1);
  ok(!M.buscar(e, gui.uid) || gui.pv < antes - 5, "Brazo militar: Dagren hace 2 de daño extra a Guillotina"); }
{ const e = partida([], []); turnoDe(e, 0); const har = poner(e, 0, "enfermera-harrow"); const laia = poner(e, 1, "laia"); poner(e, 1, "bull");
  ok(M.objetivosDeDesafio(e, har).includes(laia.uid) && M.tienePalabra(e, laia, "esquivo"), "Usted se queda: Harrow desafía a Laia pese a Provocar y Laia esquiva"); }
{ const e = partida([], []); turnoDe(e, 0); const led = poner(e, 0, "ledros"); const buf = poner(e, 1, "sir-buffolet");
  M.aplicar(e, { t: "atacar", u: [led.uid] }, 0); M.aplicar(e, { t: "bloquear", b: [[led.uid, buf.uid]] }, 1);
  ok(!M.buscar(e, buf.uid), "Lágrimas del espectro: Ledros mata a Sir Buffolet de un golpe (3 + 2)"); }

// 16) Cartas nuevas de la cronología
{ const e = partida([], []); turnoDe(e, 0); const jul = poner(e, 0, "julius-goldenside"), a = poner(e, 0, "t33"), b = poner(e, 0, "t33");
  M.infligir(e, { u: a.uid }, 9, { tipo: "habilidad" }); ok(M.buscar(e, a.uid) && a.pv === 1, "Sentencia aplazada: una unidad aliada se queda con 1 de vida");
  M.infligir(e, { u: b.uid }, 9, { tipo: "habilidad" }); ok(!M.buscar(e, b.uid), "pero solo una vez por partida"); }
{ const e = partida([], []); turnoDe(e, 0); const du = poner(e, 0, "enfermera-harrow"), a = poner(e, 0, "t33"), b = poner(e, 0, "t33");
  M.infligir(e, { u: a.uid }, 9, { tipo: "habilidad" }); ok(M.buscar(e, a.uid) && a.pv === 1, "Harrow salva a una unidad aliada: se queda con 1 de vida");
  M.infligir(e, { u: b.uid }, 9, { tipo: "habilidad" }); ok(!M.buscar(e, b.uid), "pero solo una vez por partida"); }
{ const e = partida([], []); turnoDe(e, 0); const aliada = poner(e, 0, "t33"); aliada.pv = 1; const enem = poner(e, 1, "t33");
  M.ponerUnidad(e, 0, "enfermera-harrow", true, aliada); ok(aliada.pv === 3, "Jeringa sobre una aliada: cura 3");
  const e2 = partida([], []); turnoDe(e2, 0); const en2 = poner(e2, 1, "t33");
  M.ponerUnidad(e2, 0, "enfermera-harrow", true, en2); ok(en2.pv === 1 && en2.flags.sinCurarHasta > e2.turno, "Jeringa sobre una enemiga: 2 de daño y no puede curarse");
  M.curar(e2, { u: en2.uid }, 5); ok(en2.pv === 1, "no se cura mientras dure"); }
{ const e = partida([], []); turnoDe(e, 0); const barata = poner(e, 1, "t11"), cara = poner(e, 1, "dragarto");
  const req = M.requisitoDeJugada(e, 0, "gareth"); ok(req.validos.length === 1 && req.validos[0].u === barata.uid, "Gareth solo elige unidades enemigas de coste 3 o menos");
  e.jugadores[1].mano = []; M.ponerUnidad(e, 0, "gareth", true, barata);
  ok(!M.buscar(e, barata.uid) && e.jugadores[1].mano.includes("t11") && !e.jugadores[1].cementerio.includes("t11"), "Echar a la calle: vuelve a la mano de su dueño, sin pasar por el cementerio");
  const ficha = poner(e, 1, "centinela"); M.ponerUnidad(e, 0, "gareth", true, ficha); ok(!M.buscar(e, ficha.uid) && !e.jugadores[1].mano.includes("centinela"), "una ficha echada a la calle desaparece"); }
{ const e = partida([], []); turnoDe(e, 0); const J = e.jugadores[0];
  ok(M.costeDe(e, 0, "pocion-de-curacion-menor") === 1, "sin Mercader, una poción cuesta 1");
  poner(e, 0, "mercader"); ok(M.costeDe(e, 0, "pocion-de-curacion-menor") === 0 && M.costeDe(e, 0, "garra") === 2, "Mercader: los Objetos cuestan 1 menos, las demás cartas no"); }
{ const e = partida([], []); turnoDe(e, 0); const v = poner(e, 0, "el-vendedor-de-davidas");
  for (let i = 0; i < 5; i++) { const x = poner(e, i % 2, "t11"); M.morir(e, x, { tipo: "habilidad" }); }
  ok(v.atq === 4 && v.pvMax === 6, `El vendedor de Dávidas crece con cada caída, hasta 3 veces (${v.atq}/${v.pvMax})`); }
{ const e = partida([], []); turnoDe(e, 0); const leo = poner(e, 0, "leonard-goldenside"); const atk = poner(e, 1, "t33");
  ok(M.tienePalabra(e, leo, "noBloquea") && M.tienePalabra(e, leo, "temible"), "Leonard: Postura de Brynhildr (no bloquea, difícil de bloquear)");
  const debil = poner(e, 1, "t11"); const blk = M.bloqueadoresPosibles(e, leo.uid); ok(!blk.includes(debil.uid) && blk.includes(atk.uid), "solo lo bloquean unidades con 3 o más de ataque");
  const e3 = partida([], []); turnoDe(e3, 0); const enemigo = poner(e3, 1, "t52"); M.ponerUnidad(e3, 0, "leonard-goldenside", true, enemigo);
  ok(enemigo.pv === 0 || !M.buscar(e3, enemigo.uid), "Graviert Würde: 2 de daño al entrar (mata a un t52 de 2 de vida)"); }
{ const e = partida([], []); turnoDe(e, 0); const leo = poner(e, 0, "leonard-goldenside"); const g = poner(e, 1, "garra");
  M.aplicar(e, { t: "fin" }, 0); turnoDe(e, 1); const atk = poner(e, 1, "t33"); atk.entro = 0;
  const g2 = M.buscar(e, g.uid).u; g2.entro = 0;
  M.aplicar(e, { t: "atacar", u: [g2.uid], d: { [g2.uid]: leo.uid } }, 1);
  ok(!M.buscar(e, g2.uid) && leo.pv < 5, "Eisen Strum: la atacante recibe 2 de daño de vuelta (Garra 3/2 muere)"); }
{ const e = partida([], []); turnoDe(e, 0); const sig = poner(e, 0, "sigismund"); const suelo = poner(e, 1, "t24"), vuela = poner(e, 1, "manta-del-cielo");
  const e2 = partida([], []); turnoDe(e2, 0); const m2 = poner(e2, 1, "manta-del-cielo"); M.ponerUnidad(e2, 0, "sigismund", true, m2);
  ok(!M.buscar(e2, m2.uid), "Balista de asedio: 4 de daño a una voladora (la Aeromanta de 3 cae)");
  const e3 = partida([], []); turnoDe(e3, 0); const s3 = poner(e3, 1, "t24"); M.ponerUnidad(e3, 0, "sigismund", true, s3); ok(s3.pv === 2, "y 2 de daño a una terrestre"); }
{ const e = partida([], []); turnoDe(e, 0); const x = poner(e, 1, "t33"); M.ponerUnidad(e, 0, "isa", true, x); ok(x.flags.noAtacaHasta >= e.turno + 1, "Isa: la unidad enemiga no ataca el próximo turno");
  const a = poner(e, 0, "t33"); M.ponerUnidad(e, 0, "clef", true, a); ok(M.atqEfectivo(e, a) === 5, "Clef: +2 de ataque a una aliada"); }
{ const e = partida([], []); turnoDe(e, 0); const ul = poner(e, 0, "ulis"); ul.pv = 1; M.aplicar(e, { t: "fin" }, 0); M.aplicar(e, { t: "fin" }, 1); ok(ul.pv === 2, "Ulis recupera 1 de vida al inicio de su turno"); }

for (let g = 0; g < 300; g++) {
  const r = azar(g + 1000);
  const reales = ids.filter(i => !/^t(\d|-)/.test(i));
  const mazo = () => Array.from({ length: 24 }, () => reales[Math.floor(r() * reales.length)]);
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
      const h = J.campo.map(u => u.hueco); if (new Set(h).size !== h.length || h.some(x => !(x >= 0 && x < M.C.CAMPO_MAX))) { fallos.push(`huecos inválidos partida ${g}: ${h}`); e.ganador = "x"; }
      if (J.campo.length > M.C.CAMPO_MAX) { fallos.push("campo > máximo"); e.ganador = "x"; }
    }
    if (e.combate && !e.pendiente) { fallos.push(`combate colgado sin pendiente partida ${g}`); break; }
  }
  if (e.ganador !== null) terminadas++;
}
console.log(fallos.length ? `${fallos.length} fallo(s):\n  ` + fallos.slice(0, 12).join("\n  ") : `OK: ${n} comprobaciones y ${terminadas} partidas al azar terminadas (${ataques} ataques, ${bloqueos} bloqueos).`);
process.exit(fallos.length ? 1 : 0);
