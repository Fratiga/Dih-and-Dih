/* =============================================================================
   EL POZO DEL DRAGÓN: comprobación de las combinaciones y simulación de la economía del Pozo Compartido.
   Uso:  node tools/pozo-dragon-simulacion.js [mesas por escenario, por defecto 100000]

   1) Recorre los 216 resultados de tres dados y comprueba la clasificación (Ruina, triple seis, triple, escalera, pareja, ceniza) y sus probabilidades.
   2) Calcula el valor esperado de una tirada con la tabla de bonos.
   3) Simula mesas del Pozo Compartido con EL MISMO modelo que docs/pozo-dragon.sql y varias estrategias de cobro:
        - Todos ponen la misma apuesta. El pozo es la suma de las apuestas. No entra ni sale nada más: no se crea ni se destruye dinero.
        - Cada jugador tiene un PESO: 1 (su apuesta) más los bonos de sus tiradas (en fracciones de la apuesta).
        - Ruina: el jugador sale de la competición por el pozo (peso 0) y su apuesta se queda en el pozo.
        - Cobrar (o llegar a cinco tiradas sin Ruina) cierra su participación con el peso que lleve.
        - Al acabar la mesa, el pozo entero se reparte entre quienes no sufrieron Ruina en proporción a su peso.
        - Quien no llegó a tirar ni una vez sale de la mesa y recupera su apuesta (no cuenta en el reparto).
        - Si todos sufren Ruina, se devuelven las apuestas.
      Comprueba que lo pagado es SIEMPRE igual a lo apostado y mide cada estrategia. Compara la tabla de bonos original (×1) con la que usa el juego (×0,5).
   4) Para contrastar: cuánto dinero se crearía si los bonos se pagaran de la nada (lo que el juego NO hace).
============================================================================= */
const MESAS = Number(process.argv[2]) || 100000;
let semilla = 20271027;
const azar = () => (semilla = (semilla * 1664525 + 1013904223) >>> 0) / 4294967296;
const dado = () => 1 + Math.floor(azar() * 6);

/* ---------------------------------------------------------------- clasificación (la misma que docs/pozo-dragon.sql) */
function clasificar(a, b, c) {
  if (a + b + c <= 5) return "ruina";
  if (a === b && b === c) return a === 6 ? "triple_seis" : "triple";
  const o = [a, b, c].sort((x, y) => x - y);
  if (o[1] === o[0] + 1 && o[2] === o[1] + 1) return "escalera";
  if (a === b || b === c || a === c) return "pareja";
  return "ceniza";
}
const BONO_ORIGINAL = { ruina: 0, ceniza: 0, pareja: 0.25, escalera: 0.75, triple: 1.5, triple_seis: 4 };
const FACTOR_JUEGO = 0.5;                                           // los bonos de la tabla original se aplican a la mitad (ver el apartado de equilibrio)
const bonosDe = f => Object.fromEntries(Object.entries(BONO_ORIGINAL).map(([k, v]) => [k, v * f]));

console.log("== Los 216 resultados");
const cuenta = {};
for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) { const k = clasificar(a, b, c); cuenta[k] = (cuenta[k] || 0) + 1; }
const ESPERADO = { ruina: 10, triple_seis: 1, triple: 4, escalera: 24, pareja: 81, ceniza: 96 };
let ok = true;
for (const k of Object.keys(ESPERADO)) { const bien = cuenta[k] === ESPERADO[k]; ok = ok && bien; console.log(`  ${bien ? "OK   " : "FALLA"} ${k.padEnd(12)} ${String(cuenta[k]).padStart(3)}/216 = ${(cuenta[k] / 216 * 100).toFixed(2)} %`); }
console.log(`  ${Object.values(cuenta).reduce((x, y) => x + y, 0) === 216 && ok ? "OK   " : "FALLA"} los seis grupos suman 216 y cada resultado cae en uno solo`);
const PROB = Object.fromEntries(Object.keys(cuenta).map(k => [k, cuenta[k] / 216]));
for (const f of [1, FACTOR_JUEGO]) {
  const ev = Object.keys(PROB).reduce((s, k) => s + PROB[k] * bonosDe(f)[k], 0);
  console.log(`\n== Bonos ×${f}: una tirada añade de media ${(ev * 100).toFixed(2)} % de la apuesta al peso y tiene un ${(PROB.ruina * 100).toFixed(2)} % de Ruina`);
}

/* ---------------------------------------------------------------- una mesa del Pozo Compartido */
function mesa(estrategias, f) {
  const B = bonosDe(f), N = estrategias.length, MAX = 5;
  const J = estrategias.map((e, i) => ({ i, e, estado: "activo", tiradas: 0, w: 1, pago: 0 }));
  let turno = Math.floor(azar() * N), guardia = 0, tiradasTotales = 0;
  const pesoVivo = () => J.filter(j => j.estado !== "ruina").reduce((s, j) => s + j.w, 0);
  const decide = j => {
    if (j.e[0] === "r") return j.tiradas >= Number(j.e.slice(1));          // r1: cobra tras la primera tirada; r5: sigue hasta Ruina o cinco tiradas
    if (j.e === "miope") {                                                  // cobra si, con los pesos de ahora, tirar una vez más no mejora su parte esperada
      const W = pesoVivo(), ahora = N * j.w / W; let ev = 0;
      for (const k of Object.keys(PROB)) { if (k === "ruina") continue; ev += PROB[k] * N * (j.w + B[k]) / (W + B[k]); }
      return ev <= ahora;
    }
    return true;
  };
  while (J.some(j => j.estado === "activo") && guardia++ < 5000) {
    while (J[turno].estado !== "activo") turno = (turno + 1) % N;
    const j = J[turno], k = clasificar(dado(), dado(), dado());
    j.tiradas++; tiradasTotales++;
    if (k === "ruina") j.estado = "ruina";
    else { j.w += B[k]; if (j.tiradas >= MAX || decide(j)) j.estado = "retirado"; }
    turno = (turno + 1) % N;
  }
  const sup = J.filter(j => j.estado === "retirado"), peso = sup.reduce((s, j) => s + j.w, 0);
  if (!sup.length) J.forEach(j => { j.pago = 1; });                         // todos en Ruina: se devuelven las apuestas
  else sup.forEach(j => { j.pago = N * j.w / peso; });
  return { J, N, pagado: J.reduce((s, j) => s + j.pago, 0), tiradasTotales, todosRuina: !sup.length };
}

let maxDesvio = 0;
function escenario(nombre, estrategias, f) {
  const acum = estrategias.map(() => ({ neto: 0, ruina: 0, grande: 0, neg: 0 }));
  let tiradas = 0, todosRuina = 0;
  for (let p = 0; p < MESAS; p++) {
    const r = mesa(estrategias, f);
    maxDesvio = Math.max(maxDesvio, Math.abs(r.pagado - r.N));
    tiradas += r.tiradasTotales; todosRuina += r.todosRuina ? 1 : 0;
    r.J.forEach((j, i) => { const n = j.pago - 1; acum[i].neto += n; acum[i].ruina += j.estado === "ruina" ? 1 : 0; if (n >= 1) acum[i].grande++; if (n < 0) acum[i].neg++; });
  }
  const fila = acum.map((a, i) => `${estrategias[i]} ${a.neto >= 0 ? "+" : ""}${(a.neto / MESAS * 100).toFixed(1)} %`).join(" | ");
  console.log(`  ${nombre.padEnd(34)} ${fila}`);
  return { acum, tiradas: tiradas / MESAS, todosRuina: todosRuina / MESAS };
}

console.log(`\n== Pozo Compartido: ${MESAS.toLocaleString("es")} mesas por escenario. Resultado neto medio (pagado - apostado) en % de la apuesta; el primero es el que se desvía.`);
for (const f of [1, FACTOR_JUEGO]) {
  console.log(`\n### Bonos ×${f} ${f === FACTOR_JUEGO ? "(los del juego: pareja 12,5 %, escalera 37,5 %, triple 75 %, triple seis 200 %)" : "(tabla original: pareja 25 %, escalera 75 %, triple 150 %, triple seis 400 %)"}`);
  for (const n of [2, 4, 6]) {
    console.log(`  -- ${n} jugadores`);
    for (const base of ["r1", "r3", "r5"]) for (const e of ["r1", "r3", "r5", "miope"]) if (e !== base) escenario(`${e} contra ${n - 1} «${base}»`, [e, ...Array(n - 1).fill(base)], f);
  }
}
console.log(`\n  Desvío máximo entre lo pagado y lo apostado en una mesa: ${maxDesvio.toExponential(2)} (en apuestas) ${maxDesvio < 1e-9 ? "→ el juego no crea ni destruye dinero" : "→ ¡NO CUADRA!"}`);

console.log("\n== Perfiles con los bonos del juego (mesas de 4: un jugador de cada perfil contra tres «r3»)");
for (const e of ["r1", "r3", "r5", "miope"]) {
  const arr = [e, "r3", "r3", "r3"]; let n = 0, ruina = 0, grandes = 0, suma = 0, maxPago = 0;
  for (let p = 0; p < MESAS; p++) { const r = mesa(arr, FACTOR_JUEGO), j = r.J[0]; n++; suma += j.pago - 1; if (j.estado === "ruina") ruina++; if (j.pago - 1 >= 1) grandes++; maxPago = Math.max(maxPago, j.pago); }
  console.log(`  ${e.padEnd(6)} neto medio ${(suma / n * 100 >= 0 ? "+" : "")}${(suma / n * 100).toFixed(1)} % | Ruina ${(ruina / n * 100).toFixed(1)} % | gana tanto como apostó o más ${(grandes / n * 100).toFixed(1)} % | mayor pago ${maxPago.toFixed(1)}×`);
}
const largo = escenario("duración (tiradas por mesa de 4 «r3»)", Array(4).fill("r3"), FACTOR_JUEGO);
console.log(`  Una mesa de 4 jugadores prudentes dura de media ${largo.tiradas.toFixed(1)} tiradas; todos en Ruina en el ${(largo.todosRuina * 100).toFixed(3)} % de las mesas`);

/* ---------------------------------------------------------------- lo que crearía pagar los bonos «de la casa» */
console.log("\n== Contraste: dinero creado si los bonos de la tabla original se pagaran de la nada (el juego NO lo hace)");
for (const e of ["r1", "r3", "r5"]) {
  let bonos = 0;
  for (let p = 0; p < MESAS; p++) {
    let t = 0, b = 0;
    for (;;) { const k = clasificar(dado(), dado(), dado()); t++; if (k === "ruina") { b = 0; break; } b += BONO_ORIGINAL[k]; if (t >= 5 || t >= Number(e.slice(1))) break; }
    bonos += b;
  }
  console.log(`  ${e.padEnd(4)} cada jugador cobraría de media ${(bonos / MESAS * 100).toFixed(1)} % de su apuesta, creados de la nada, en cada partida`);
}
