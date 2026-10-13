// Prueba de js/cartas-verificar.js: vuelve a jugar partidas completas y comprueba el veredicto.
// Uso: node tools/probar-verificacion.js
const vm = require("vm"), fs = require("fs"), path = require("path");
const sb = { console }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
for (const f of ["cartas-datos", "cartas-motor", "cartas-efectos", "cartas-vinculos", "cartas-verificar"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", `${f}.js`), "utf8"), sb, { filename: f });
}
const M = sb.CartasMotor, V = sb.CartasVerificar;
const cartas = {};
sb.CARTAS.forEach(c => { cartas[c.id] = { id: c.id, nombre: c.nombre, tipo: c.tipo, rareza: c.rareza, afinidad: c.afinidad, coste: c.coste, atq: c.atq ?? null, pv: c.pv ?? null, habilidad: c.habilidad || "" }; });
require("./cartas-del-servidor.js").forEach(c => { cartas[c.id] = { id: c.id, nombre: c.nombre, tipo: c.tipo, rareza: c.rareza, afinidad: c.afinidad, coste: c.coste, atq: c.atq ?? null, pv: c.pv ?? null, habilidad: c.habilidad || "" }; });
const ids = Object.keys(cartas);
const azar = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

const fallos = []; let n = 0;
const ok = (c, msg) => { n++; if (!c) fallos.push(msg); };

/* Juega una partida entera al azar y devuelve la fila tal como la guardaría cartas_partidas */
function jugar(g, { cortar = null } = {}) {
  const r = azar(g + 5000);
  const mazo = () => Array.from({ length: 24 }, () => ids[Math.floor(r() * ids.length)]);
  const j1 = { id: "u1", nombre: "Uno", mazo: mazo() }, j2 = { id: "u2", nombre: "Dos", mazo: mazo() };
  const semilla = g + 1, primero = g % 2;
  const e = M.crearPartida({ semilla, primero, cartas, jugadores: [j1, j2] });
  const acciones = [];
  // El turno que guardaría el servidor (cartas_responder lo fija según quién empieza y cartas_accion lo cambia con cada «fin»)
  let turno = primero === 0 ? "u1" : "u2";
  let pasos = 0;
  while (e.ganador === null && pasos++ < 1500 && (cortar === null || acciones.length < cortar)) {
    const legales = M.accionesLegales(e); const quien = M.quienActua(e);
    let a = legales[Math.floor(r() * legales.length)];
    const ataques = legales.filter(x => x.t === "atacar"); if (ataques.length && r() < 0.5) a = ataques[Math.floor(r() * ataques.length)];
    const bl = legales.filter(x => x.t === "bloquear" && x.b.length); if (bl.length && r() < 0.8) a = bl[Math.floor(r() * bl.length)];
    M.aplicar(e, a, quien);
    acciones.push(a);
    if (a.t === "fin") turno = turno === "u1" ? "u2" : "u1";
  }
  return {
    e,
    fila: { semilla, primero, cartas, j1: j1.id, j2: j2.id, nombre1: j1.nombre, nombre2: j2.nombre, mazo1: j1.mazo, mazo2: j2.mazo, acciones, turno, motor1: M.VERSION, motor2: M.VERSION, actualizada: new Date().toISOString() }
  };
}
const resultadoDe = e => e.ganador === "empate" ? "empate" : e.ganador === 0 ? "j1" : "j2";

let terminadas = 0, abandonos = 0, enJuego = 0;
for (let g = 0; g < 120; g++) {
  const { e, fila } = jugar(g);
  if (e.ganador === null) continue;
  terminadas++;
  const v = V.analizar(fila, M);
  ok(v.estado === "terminada" && v.resultado === resultadoDe(e), `partida ${g}: el veredicto (${JSON.stringify(v)}) no coincide con el ganador real (${resultadoDe(e)})`);
  ok(v.ignoradas === 0, `partida ${g}: una acción legal se ignoró (${v.ignoradas})`);
  // determinista: el mismo registro da el mismo veredicto
  ok(JSON.stringify(V.analizar(fila, M)) === JSON.stringify(v), `partida ${g}: dos repeticiones dan veredictos distintos`);
  // Un aviso falso queda al descubierto
  const falso = resultadoDe(e) === "j1" ? "j2" : "j1";
  const f2 = Object.assign({}, fila, { reporte1: falso, reporte2: resultadoDe(e) });
  const fa = V.avisosFalsos(f2, v);
  ok(fa.length === 1 && fa[0].jugador === 1 && fa[0].verdad === resultadoDe(e), `partida ${g}: el aviso falso no se detecta (${JSON.stringify(fa)})`);
  // Acciones inventadas o ilegales mezcladas en el registro no cambian nada
  const basura = [{ t: "jugar", i: 99 }, { t: "atacar", u: [123456, 654321] }, { t: "bloquear", b: [[-5, -6]] }, { t: "nada" }, { t: "reaccionar", i: 99 }, null, 5, "x", { t: "jugar", i: -1 }];
  const sucia = fila.acciones.flatMap((a, i) => (i % 5 === 0 ? [basura[i % basura.length], a] : [a]));
  const v2 = V.analizar(Object.assign({}, fila, { acciones: sucia }), M);
  ok(v2.estado === "terminada" && v2.resultado === v.resultado, `partida ${g}: acciones inventadas en el registro cambiaron el resultado (${JSON.stringify(v2)})`);
  ok(v2.ignoradas > 0, `partida ${g}: las acciones inventadas no se contaron como ignoradas`);
}
ok(terminadas > 60, `se esperaban más de 60 partidas terminadas, hubo ${terminadas}`);

// Partidas cortadas a mitad: siguen en juego, y si el que debe actuar lleva mucho sin hacerlo, pierde
for (let g = 200; g < 260; g++) {
  const { e, fila } = jugar(g, { cortar: 7 + (g % 9) });
  if (e.ganador !== null) continue;
  const quien = M.quienActua(e);
  const hace = h => new Date(Date.now() - h * 3600000).toISOString();
  const v1 = V.analizar(Object.assign({}, fila, { actualizada: hace(3) }), M, { horasTurno: 48 });
  ok(v1.estado === "en_juego" && v1.actua === quien, `partida ${g}: debería seguir en juego con ${quien} por actuar (${JSON.stringify(v1)})`);
  const v2 = V.analizar(Object.assign({}, fila, { actualizada: hace(49) }), M, { horasTurno: 48 });
  ok(v2.estado === "abandono" && v2.pierde === quien && v2.resultado === (quien === 0 ? "j2" : "j1"), `partida ${g}: debería perder por abandono quien tenía que actuar (${JSON.stringify(v2)})`);
  const v3 = V.analizar(Object.assign({}, fila, { actualizada: hace(500) }), M, { horasTurno: 0 });
  ok(v3.estado === "en_juego", `partida ${g}: sin plazo configurado nunca hay abandono (${JSON.stringify(v3)})`);
  enJuego++; abandonos++;
}
ok(enJuego > 30, `se esperaban más de 30 partidas cortadas, hubo ${enJuego}`);

// Seguros de la decisión (motor y turno)
{
  let probadas = 0;
  for (let g = 300; g < 330 && probadas < 10; g++) {
    const { e, fila } = jugar(g, { cortar: 9 });
    if (e.ganador !== null) continue;
    probadas++;
    const hace = h => new Date(Date.now() - h * 3600000).toISOString();
    const vieja = Object.assign({}, fila, { actualizada: hace(60) });
    ok(V.analizar(vieja, M, { horasTurno: 48 }).estado === "abandono", `partida ${g}: con todo en orden debe haber abandono`);
    // Motor: si alguno de los dos no registró la versión, o es otra, no se decide nada
    ["motor1", "motor2"].forEach(k => {
      ["", null, "0.0.1"].forEach(malo => {
        const r = V.analizar(Object.assign({}, vieja, { [k]: malo || undefined }), M, { horasTurno: 48 });
        ok(r.estado === "motor", `partida ${g}: ${k}=${JSON.stringify(malo)} debería rechazarse por el motor (${r.estado})`);
      });
    });
    // Turno: si el turno guardado no cuadra con la repetición, no se da el abandono
    const otro = fila.turno === fila.j1 ? fila.j2 : fila.j1;
    const r1 = V.analizar(Object.assign({}, vieja, { turno: otro }), M, { horasTurno: 48 });
    ok(r1.estado === "error", `partida ${g}: un turno guardado distinto debe impedir el abandono (${r1.estado})`);
    const r2 = V.analizar(Object.assign({}, vieja, { turno: null }), M, { horasTurno: 48 });
    ok(r2.estado === "error", `partida ${g}: sin turno guardado no se da el abandono (${r2.estado})`);
    // Pero si la partida ya terminó según el registro, un turno estropeado no salva al que pierde
  }
  for (let g = 0; g < 60; g++) {
    const { e, fila } = jugar(g);
    if (e.ganador === null) continue;
    const r = V.analizar(Object.assign({}, fila, { turno: "cualquiera" }), M, { horasTurno: 48 });
    ok(r.estado === "terminada" && r.resultado === resultadoDe(e), `partida ${g}: un turno estropeado no debe cambiar una partida terminada (${JSON.stringify(r)})`);
  }
  ok(probadas >= 5, "se esperaban al menos 5 partidas cortadas para probar los seguros");
}

// Entradas incompletas o rotas: error claro, sin excepciones
ok(V.analizar(null, M).estado === "error", "fila nula debe dar error");
ok(V.analizar({ semilla: null }, M).estado === "error", "sin semilla debe dar error");
ok(V.analizar({ semilla: 1, primero: 0, mazo1: [], mazo2: [], cartas: {}, j1: "a", j2: "b", motor1: M.VERSION, motor2: M.VERSION }, M).estado !== undefined, "mazos vacíos no lanzan excepción");
ok(V.analizar({ semilla: 1, primero: 0, mazo1: ["inexistente"], mazo2: ["inexistente"], cartas: {}, j1: "a", j2: "b", motor1: M.VERSION, motor2: M.VERSION, acciones: [{ t: "fin" }] }, M).estado !== undefined, "cartas inexistentes no lanzan excepción");

console.log(`${n} comprobaciones, ${terminadas} partidas terminadas verificadas, ${enJuego} cortadas, ${abandonos} abandonos`);
if (fallos.length) { console.log(`${fallos.length} FALLOS:`); fallos.slice(0, 20).forEach(f => console.log("  - " + f)); process.exit(1); }
console.log("TODO BIEN");
