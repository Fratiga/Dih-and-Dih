/* =============================================================================
   EL POZO DEL DRAGÓN, MODO SOLITARIO: cálculo exacto del retorno al jugador y simulación.
   Uso:  node tools/pozo-dragon-solo.js [partidas por estrategia, por defecto 400000]

   Reglas del modo (docs/pozo-dragon.sql, pozo_solo_*): apuestas S y el premio provisional empieza en S. Cada tirada sin Ruina suma al premio un bono (% de S) según la
   combinación; la ceniza no suma; la Ruina pierde todo y termina la partida. Tras cada tirada sin Ruina puedes cobrar o seguir. Máximo cinco tiradas: en la quinta cobras solo.
   Aquí paga la CASA (no hay otros jugadores), así que el juego crea tokens cuando ganas y los destruye cuando pierdes. Para que no se creen tokens sin respaldo, la tabla
   tiene que dejar a la casa una ventaja: el retorno al jugador (RTP) con la MEJOR estrategia posible tiene que ser menor que el 100 %.
   1) Programación dinámica exacta: el valor esperado del juego óptimo para cada factor de la tabla (×1 es la tabla propuesta: 25/75/150/400 %).
   2) Estrategias fijas (cobrar siempre en la primera tirada, a la segunda... o seguir hasta el final) simuladas, para comprobar la programación dinámica.
============================================================================= */
const N = Number(process.argv[2]) || 400000;
const CASOS = { ruina: 10, ceniza: 96, pareja: 81, escalera: 24, triple: 4, triple_seis: 1 };
const BASE = { ruina: 0, ceniza: 0, pareja: 0.25, escalera: 0.75, triple: 1.5, triple_seis: 4 };
const MAX = 5;

function clasificar(a, b, c) {
  if (a + b + c <= 5) return "ruina";
  if (a === b && b === c) return a === 6 ? "triple_seis" : "triple";
  const o = [a, b, c].sort((x, y) => x - y);
  if (o[1] === o[0] + 1 && o[2] === o[1] + 1) return "escalera";
  if (a === b || b === c || a === c) return "pareja";
  return "ceniza";
}
{ // los casos de arriba son los de los 216 resultados
  const c = {}; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let d = 1; d <= 6; d++) { const k = clasificar(a, b, d); c[k] = (c[k] || 0) + 1; }
  for (const k of Object.keys(CASOS)) if (c[k] !== CASOS[k]) throw new Error("casos distintos: " + k);
}

// Valor esperado del juego óptimo con los bonos de la tabla × k. Devuelve { rtp, tiradasMedias, rtpCobrarYa }
function optimo(k) {
  const memo = new Map();
  // v(r, b): valor de estar tras la tirada r (sin Ruina) con bono acumulado b; se puede cobrar (1 + b) o seguir
  function v(r, b) {
    if (r >= MAX) return { valor: 1 + b, sigue: false };
    const clave = r + "|" + b.toFixed(6);
    if (memo.has(clave)) return memo.get(clave);
    let seguir = 0;
    for (const c of Object.keys(CASOS)) { if (c === "ruina") continue; seguir += CASOS[c] / 216 * v(r + 1, b + BASE[c] * k).valor; }
    const res = seguir > 1 + b ? { valor: seguir, sigue: true } : { valor: 1 + b, sigue: false };
    memo.set(clave, res); return res;
  }
  let inicio = 0, cobrarYa = 0;
  for (const c of Object.keys(CASOS)) { if (c === "ruina") continue; inicio += CASOS[c] / 216 * v(1, BASE[c] * k).valor; cobrarYa += CASOS[c] / 216 * (1 + BASE[c] * k); }
  return { rtp: inicio, rtpCobrarYa: cobrarYa, v };
}

console.log("== Retorno al jugador (RTP) con la mejor estrategia posible, por factor de la tabla");
console.log("   factor   pareja  escalera  triple  triple seis | RTP óptimo | RTP cobrando en la 1.ª tirada | ventaja de la casa");
const filas = [];
for (const k of [1, 0.75, 0.5, 0.4, 0.35, 0.3, 0.25, 0.2]) {
  const o = optimo(k); filas.push([k, o]);
  console.log(`   ×${String(k).padEnd(5)}   ${(25 * k).toFixed(1).padStart(5)} %  ${(75 * k).toFixed(1).padStart(6)} %  ${(150 * k).toFixed(1).padStart(5)} %  ${(400 * k).toFixed(0).padStart(6)} %    |   ${(o.rtp * 100).toFixed(2).padStart(6)} %  |   ${(o.rtpCobrarYa * 100).toFixed(2).padStart(6)} %    | ${((1 - o.rtp) * 100).toFixed(2)} %`);
}

// Busca el factor con el que el juego óptimo devuelve el 96 % (una ventaja de la casa del 4 %, parecida a la de Las Veintiuna Velas)
function factorPara(rtpObjetivo) { let lo = 0.01, hi = 1; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (optimo(m).rtp > rtpObjetivo) hi = m; else lo = m; } return (lo + hi) / 2; }
const K96 = factorPara(0.96);
console.log(`\n   Para un RTP óptimo del 96 % (ventaja de la casa del 4 %) el factor es ×${K96.toFixed(4)}: pareja ${(25 * K96).toFixed(2)} %, escalera ${(75 * K96).toFixed(2)} %, triple ${(150 * K96).toFixed(2)} %, triple seis ${(400 * K96).toFixed(2)} %.`);
const KJ = 0.25, TRIBUTO = 0.05;
const oj = optimo(KJ);
console.log(`   Solo con bonos, ×${KJ} (pareja 6,25 %, escalera 18,75 %, triple 37,5 %, triple seis 100 %) aún deja a la casa en pérdidas: RTP óptimo ${(oj.rtp * 100).toFixed(2)} %.`);
console.log(`   Por eso el juego usa ×${KJ} MÁS un tributo visible del ${TRIBUTO * 100} % que el Dragón retiene de lo que se cobra (premio = apuesta × ${1 - TRIBUTO} × (1 + bonos)).`);
console.log(`   RTP final: óptimo ${(oj.rtp * (1 - TRIBUTO) * 100).toFixed(2)} % (ventaja de la casa ${((1 - oj.rtp * (1 - TRIBUTO)) * 100).toFixed(2)} %) | cobrando siempre en la 1.ª tirada ${(oj.rtpCobrarYa * (1 - TRIBUTO) * 100).toFixed(2)} %.`);

// La política óptima con ×KJ: ¿cuándo conviene seguir?
console.log(`\n== Política óptima con ×${KJ}: ¿sigue o cobra? (bono acumulado en % de la apuesta)`);
for (let r = 1; r < MAX; r++) {
  const posibles = new Set([0]);
  const gen = (rr, b) => { if (rr === r) { posibles.add(+b.toFixed(6)); return; } for (const c of ["ceniza", "pareja", "escalera", "triple", "triple_seis"]) gen(rr + 1, b + BASE[c] * KJ); };
  gen(0, 0);
  const lista = [...posibles].sort((a, b) => a - b).filter(b => b >= 0);
  const sigue = lista.filter(b => oj.v(r, b).sigue).map(b => b * 100), cobra = lista.filter(b => !oj.v(r, b).sigue).map(b => b * 100);
  console.log(`   tras la tirada ${r}: sigue si el bono es ${sigue.length ? "de " + Math.min(...sigue).toFixed(1) + " % a " + Math.max(...sigue).toFixed(1) + " %" : "(nunca)"}${cobra.length ? "; cobra con " + (cobra.length > 4 ? "bonos de " + Math.min(...cobra).toFixed(1) + " % o más (si no sigue)" : cobra.map(x => x.toFixed(1) + " %").join(", ")) : ""}`);
}

// Estrategias fijas simuladas (comprueban la programación dinámica y enseñan que cobrar pronto o tarde pierde casi igual)
let semilla = 20271027;
const azar = () => (semilla = (semilla * 1664525 + 1013904223) >>> 0) / 4294967296;
const dado = () => 1 + Math.floor(azar() * 6);
function partida(cobraEn, k) {   // cobraEn: nº de tirada tras la que se cobra (5 = seguir hasta el final)
  let b = 0;
  for (let t = 1; t <= MAX; t++) { const c = clasificar(dado(), dado(), dado()); if (c === "ruina") return { pago: 0, ruina: true, t }; b += BASE[c] * k; if (t >= cobraEn) return { pago: 1 + b, ruina: false, t }; }
  return { pago: 1 + b, ruina: false, t: MAX };
}
console.log(`\n== Estrategias fijas con ×${KJ} (${N.toLocaleString("es")} partidas cada una)`);
for (const e of [1, 2, 3, 4, 5]) {
  let suma = 0, ruinas = 0, grandes = 0, max = 0;
  for (let i = 0; i < N; i++) { const p = partida(e, KJ); suma += p.pago; if (p.ruina) ruinas++; if (p.pago >= 2) grandes++; if (p.pago > max) max = p.pago; }
  console.log(`   cobrar tras la tirada ${e}: RTP ${(suma / N * (1 - TRIBUTO) * 100).toFixed(2)} % (con tributo) | Ruina ${(ruinas / N * 100).toFixed(1)} % | premio de 2× o más ${(grandes / N * 100).toFixed(2)} % | mayor premio ${max.toFixed(2)}×`);
}
console.log(`   Pago máximo posible: ${(1 + 5 * 4 * KJ).toFixed(1)}× la apuesta (cinco triples seis seguidos, probabilidad ${(1 / 216 ** 5).toExponential(1)}).`);
console.log(`   Con la tabla original (×1) el RTP óptimo sería ${(filas[0][1].rtp * 100).toFixed(1)} %: la casa pagaría de media ${((filas[0][1].rtp - 1) * 100).toFixed(1)} % de más en cada partida, dinero creado de la nada.`);
