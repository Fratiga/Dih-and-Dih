// Prueba de las mesas de La Fractura: varios «navegadores» juegan la misma guerra pasándose solo lo que guarda el servidor
// (la configuración y las acciones de cada turno) y tienen que ver siempre lo mismo.
// Cada jugador lo lleva la máquina, pero sus acciones se anotan y se mandan como las de una persona. Los asientos de la
// máquina no se mandan: cada navegador los vuelve a jugar. Se prueban también el turno de un ausente y la rendición, y un
// navegador que entra tarde y reconstruye la guerra desde el principio.
// Uso: node tools/probar-fractura-mesa.js [guerras]
const path = require("path");
const js = f => require(path.join(__dirname, "..", "js", f));
const D = js("fractura-datos.js");
js("fractura-soldados.js"); js("fractura-mapa.js");
const FM = js("fractura-motor.js");
const IA = js("fractura-ia.js");
const MESA = js("fractura-mesa.js");

const N = parseInt(process.argv[2] || "6", 10);
const facciones = Object.keys(D.FACCIONES), formas = Object.keys(D.FORMAS_MAPA);
let fallos = 0, comprobaciones = 0;
const ok = (cond, texto) => { comprobaciones++; if (!cond) { fallos++; console.log("  FALLA:", texto); } };
const copia = x => JSON.parse(JSON.stringify(x));

/* Juega el turno de un asiento como lo haría su dueño y devuelve las acciones que mandaría */
function jugarComoPersona(est, j) {
  const acc = [], original = FM.aplicar;
  FM.aplicar = (e, a) => { const r = original(e, a); if (r && r.ok && e === est) acc.push(copia(a)); return r; };
  try { IA.jugarTurno(est, j); if (est.ganador === null && est.activo === j) FM.aplicar(est, { t: "terminar" }); } finally { FM.aplicar = original; }
  return acc;
}

function mesa(semilla, plazas, nHumanos) {
  // Lo que guardaría el servidor al empezar
  const jugadores = [], humanos = [];
  for (let i = 0; i < plazas; i++) {
    const f = facciones[(semilla * 3 + i * 4) % facciones.length], humano = i < nHumanos;
    jugadores.push(humano ? { nombre: `Ejército ${i}`, faccion: f, humano: true, soldados: [] } : { faccion: f, humano: false, nivelIA: "normal" });
    humanos.push(humano ? `u${i}` : null);
  }
  if (new Set(jugadores.map(j => j.faccion)).size < plazas) return null;   // ejércitos repetidos: esa mesa no se podría abrir
  const cfg = { semilla, tipo: "reinos", forma: formas[semilla % formas.length], plazas, pvp: true, reglas: D.REGLAS, hold: 6, anio: 1, jugadores, humanos, equipos: plazas === 4 && semilla % 5 === 0 };
  if (cfg.equipos) cfg.jugadores.forEach((j, i) => { j.equipo = i % 2; });
  const turnos = [];
  // Un navegador por jugador
  const cl = humanos.map((u, i) => (u ? { asiento: i, est: MESA.crear(copia(cfg), i) } : null)).filter(Boolean);
  const ctx = `semilla ${semilla}, ${plazas} plazas, ${nHumanos} jugadores, ${cfg.forma}`;
  let guarda = 0, ausentes = 0, rendidos = 0;
  while (cl[0].est.ganador === null && guarda++ < 900) {
    const j = cl[0].est.activo;
    ok(cl.every(c => c.est.activo === j), `${ctx}: no coinciden en a quién le toca (turno ${cl[0].est.turno})`);
    if (!humanos[j]) { ok(false, `${ctx}: el turno quedó en un asiento de la máquina`); break; }
    const yo = cl.find(c => c.asiento === j);
    let entrada;
    const tirada = (semilla * 31 + guarda * 17) % 23;
    if (tirada === 0 && nHumanos > 1) {
      // Se le pasó el plazo: otro navegador pide que juegue la máquina
      const otro = cl.find(c => c.asiento !== j);
      IA.turnoCompleto(otro.est, j);
      const d = MESA.despues(otro.est, humanos, otro.asiento);
      entrada = { j, ausente: true, h: d.firma };
      MESA.avanzarMaquina(otro.est, humanos);
      turnos.push(copia(entrada));
      cl.forEach(c => { if (c !== otro) ok(MESA.aplicarEntrada(c.est, humanos, copia(entrada)), `${ctx}: el turno del ausente no coincide (turno ${c.est.turno})`); });
      ausentes++;
    } else if (tirada === 1 && guarda > 6 && cl.filter(c => !c.est.jugadores[c.asiento].eliminado).length > 1 && !yo.est.jugadores[j].eliminado) {
      // Se rinde a mitad de turno: manda lo que llevaba hecho y la rendición
      const acc = jugarComoPersona(yo.est, j).filter(a => a.t !== "terminar");
      // (jugarComoPersona ya cerró el turno; se rehace el estado desde lo guardado para rendirse de verdad a mitad de turno)
      yo.est = MESA.crear(copia(cfg), j);
      turnos.forEach(t => MESA.aplicarEntrada(yo.est, humanos, copia(t)));
      acc.forEach(a => { if (yo.est.ganador === null) FM.aplicar(yo.est, a); });
      FM.rendir(yo.est, j);
      const d = MESA.despues(yo.est, humanos, j);
      entrada = { j, acc, rendicion: true, h: d.firma };
      MESA.avanzarMaquina(yo.est, humanos);
      turnos.push(copia(entrada));
      cl.forEach(c => { if (c !== yo) ok(MESA.aplicarEntrada(c.est, humanos, copia(entrada)), `${ctx}: la rendición no coincide (turno ${c.est.turno})`); });
      rendidos++;
    } else {
      const acc = jugarComoPersona(yo.est, j);
      const d = MESA.despues(yo.est, humanos, j);
      ok(humanos[d.siguiente] !== null && humanos[d.siguiente] !== undefined, `${ctx}: el siguiente no es un jugador`);
      entrada = { j, acc, h: d.firma };
      MESA.avanzarMaquina(yo.est, humanos);
      ok(FM.firma(yo.est) === d.firma, `${ctx}: la firma calculada en la copia no es la de la guerra`);
      turnos.push(copia(entrada));
      cl.forEach(c => { if (c !== yo) ok(MESA.aplicarEntrada(c.est, humanos, copia(entrada)), `${ctx}: un navegador ve otra guerra (turno ${c.est.turno})`); });
    }
    const f0 = FM.firma(cl[0].est);
    ok(cl.every(c => FM.firma(c.est) === f0), `${ctx}: las firmas no coinciden tras el turno ${turnos.length}`);
  }
  ok(cl[0].est.ganador !== null, `${ctx}: la guerra no termina`);
  const fin = MESA.ganadoresTexto(cl[0].est);
  ok(cl.every(c => MESA.ganadoresTexto(c.est) === fin), `${ctx}: no coinciden en quién gana`);
  ok(fin === "empate" || /^[0-7](,[0-7])*$/.test(fin), `${ctx}: final con formato raro (${fin})`);
  // Alguien abre la guerra más tarde (o recarga la página): la reconstruye entera desde lo guardado
  const tarde = MESA.crear(copia(cfg), cl[cl.length - 1].asiento);
  let bien = true;
  turnos.forEach(t => { if (!MESA.aplicarEntrada(tarde, humanos, copia(t))) bien = false; });
  ok(bien && FM.firma(tarde) === FM.firma(cl[0].est), `${ctx}: reconstruir la guerra desde el principio da otra cosa`);
  return { turnos: turnos.length, ausentes, rendidos, fin, ronda: cl[0].est.turno, pesa: JSON.stringify(turnos).length };
}

const t0 = Date.now();
let hechas = 0, aus = 0, ren = 0, peso = 0, maxTurno = 0;
const finales = {};
for (let i = 0; i < N * 3 && hechas < N; i++) {
  const semilla = 4000 + i * 53;
  const plazas = 2 + (i % 5), nHumanos = Math.max(2, Math.min(plazas, 2 + (i % 3)));
  let r;
  try { r = mesa(semilla, plazas, nHumanos); }
  catch (e) { fallos++; console.log(`  REVIENTA: semilla ${semilla}: ${e.stack.split("\n").slice(0, 4).join(" | ")}`); continue; }
  if (!r) continue;
  hechas++; aus += r.ausentes; ren += r.rendidos; peso += r.pesa; maxTurno = Math.max(maxTurno, ...[r.pesa / Math.max(1, r.turnos)]);
  finales[r.fin === "empate" ? "empate" : r.fin.includes(",") ? "equipo" : "uno"] = (finales[r.fin === "empate" ? "empate" : r.fin.includes(",") ? "equipo" : "uno"] || 0) + 1;
  console.log(`  semilla ${semilla}: ${plazas} plazas, ${nHumanos} jugadores, ${r.turnos} turnos mandados (ronda ${r.ronda}), gana ${r.fin}, ${r.ausentes} ausentes, ${r.rendidos} rendiciones, ${(r.pesa / 1024).toFixed(0)} KB guardados`);
}
console.log(`${hechas} mesas, ${aus} turnos de ausente, ${ren} rendiciones. Finales: ${JSON.stringify(finales)}. Media guardada por mesa: ${(peso / Math.max(1, hechas) / 1024).toFixed(0)} KB; turno más pesado de media: ${(maxTurno / 1024).toFixed(1)} KB`);
console.log(`${comprobaciones} comprobaciones, ${fallos} fallos, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(fallos ? 1 : 0);
