// Prueba de La Fractura: guerras completas de máquina contra máquina, de 2 a 8 bandos y con los trece ejércitos.
// Comprueba que no revienta, que el estado se mantiene coherente y que la misma semilla da la misma guerra.
// Uso: node tools/probar-fractura.js [guerras por tamaño]
const path = require("path");
const js = f => require(path.join(__dirname, "..", "js", f));
const D = js("fractura-datos.js");
js("fractura-soldados.js"); js("fractura-mapa.js");
const FM = js("fractura-motor.js");
const IA = js("fractura-ia.js");

const N = parseInt(process.argv[2] || "6", 10);
const facciones = Object.keys(D.FACCIONES);
const tipos = Object.keys(D.TIPOS_FRACTURA);
let fallos = 0, comprobaciones = 0;
const ok = (cond, texto) => { comprobaciones++; if (!cond) { fallos++; console.log("  FALLA:", texto); } };

function invariantes(est, ctx) {
  const vistas = new Set();
  Object.values(est.unidades).forEach(u => {
    const k = `${u.x},${u.y}`;
    ok(!vistas.has(k), `${ctx}: dos unidades en ${k}`);
    vistas.add(k);
    ok(FM.dentro(est, u.x, u.y), `${ctx}: unidad fuera del mapa`);
    const c = est.casillas[u.y][u.x];
    ok(c.t !== "vacio", `${ctx}: unidad en el vacío`);
    ok(u.hp > 0 && u.hp <= FM.ef(est, u).hpMax + 2, `${ctx}: vida rara ${u.hp}/${FM.ef(est, u).hpMax} (${u.clase})`);
    ok(est.ganador !== null || u.dueno === -1 || !est.jugadores[u.dueno].eliminado, `${ctx}: unidad de un bando eliminado`);
  });
  est.jugadores.forEach(j => Object.keys(j.recursos).forEach(k => ok(j.recursos[k] >= 0 && Number.isFinite(j.recursos[k]), `${ctx}: recurso ${k} = ${j.recursos[k]}`)));
  Object.values(est.ciudades).forEach(c => ok(est.ganador !== null || c.dueno === null || !est.jugadores[c.dueno].eliminado, `${ctx}: ciudad de un bando eliminado`));
}

function guerra(semilla, bandos, equipos) {
  const jugadores = [];
  for (let i = 0; i < bandos; i++) jugadores.push({ nombre: `Bando ${i + 1}`, faccion: facciones[(semilla * 7 + i * 5) % facciones.length], humano: false, nivelIA: ["facil", "normal", "dificil"][(semilla + i) % 3], equipo: equipos ? i % 2 : undefined });
  const cfg = { semilla, tipo: tipos[semilla % tipos.length], dificultad: "normal", anio: 1, jugadores };
  const est = FM.crearGuerra(cfg);
  let guard = 0;
  const heroes = new Set();
  while (est.ganador === null && guard++ < 1200) {
    const j = est.activo;
    IA.turnoCompleto(est, j);
    est.jugadores.forEach(o => { if (o.heroeInvocado) heroes.add(o.heroeInvocado); });
    if (guard % 7 === 0) invariantes(est, `semilla ${semilla}, ${bandos} bandos, turno ${est.turno}`);
  }
  ok(est.ganador !== null, `semilla ${semilla}, ${bandos} bandos: la guerra no termina (turno ${est.turno})`);
  invariantes(est, `semilla ${semilla} final`);
  return { est, heroes, cfg };
}

const firma = est => JSON.stringify([est.turno, est.ganador, est.razon, est.rs, Object.values(est.unidades).map(u => [u.uid, u.x, u.y, u.hp, u.dueno]), est.jugadores.map(j => j.recursos)]);
const resumen = {}, heroesVistos = new Set(), finales = {};
const t0 = Date.now();
for (let bandos = 2; bandos <= 8; bandos++) {
  for (let i = 0; i < N; i++) {
    const semilla = 1000 + bandos * 97 + i * 131;
    const equipos = bandos % 2 === 0 && i % 3 === 2;
    let r;
    try { r = guerra(semilla, bandos, equipos); }
    catch (e) { fallos++; console.log(`  REVIENTA: semilla ${semilla}, ${bandos} bandos: ${e.stack.split("\n").slice(0, 4).join(" | ")}`); continue; }
    r.heroes.forEach(h => heroesVistos.add(h));
    const motivo = /capital/.test(r.est.razon) ? "capital" : /Núcleo/.test(r.est.razon) ? "nucleo" : /tiempo/.test(r.est.razon) ? "tiempo" : /último|tropas/.test(r.est.razon) ? "aniquilado" : "otro";
    finales[motivo] = (finales[motivo] || 0) + 1;
    resumen[bandos] = resumen[bandos] || { guerras: 0, turnos: 0 };
    resumen[bandos].guerras++; resumen[bandos].turnos += r.est.turno;
    if (r.est.ganador !== "empate" && r.est.ganador !== null) { const f = r.est.jugadores[r.est.ganador].faccion; resumen.gana = resumen.gana || {}; resumen.gana[f] = (resumen.gana[f] || 0) + 1; }
    // La misma semilla tiene que dar la misma guerra
    if (i === 0) { const otra = guerra(semilla, bandos, equipos); ok(firma(otra.est) === firma(r.est), `semilla ${semilla}, ${bandos} bandos: la repetición no coincide`); }
  }
}
for (let b = 2; b <= 8; b++) if (resumen[b]) console.log(`${b} bandos: ${resumen[b].guerras} guerras, ${(resumen[b].turnos / resumen[b].guerras).toFixed(1)} turnos de media`);
console.log("Cómo terminan:", JSON.stringify(finales));
console.log("Victorias por ejército:", JSON.stringify(resumen.gana || {}));
console.log(`Héroes invocados (${heroesVistos.size} de ${Object.keys(D.HEROES).length}):`, Array.from(heroesVistos).join(", "));
console.log(`${comprobaciones} comprobaciones, ${fallos} fallos, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(fallos ? 1 : 0);
