/* =============================================================================
   LA ÚLTIMA VELA: comprobación mano a mano de que el servidor juega las MISMAS reglas que la simulación (tools/veintiuna-ultima-vela.js).
   Genera barajas al azar, calcula con la simulación qué pasa con cada una (regla «Testigo + Cera exigente», jugadores novato y básico) y escribe por la salida
   estándar un SQL que repite cada mano en el servidor (t_r_comparar, de docs/pruebas/t_veintiuna_reto.sql) y devuelve t (igual) o f (distinto).
   Uso:  node tools/veintiuna-ultima-vela-verificar.js [barajas, por defecto 1500] | psql ...
============================================================================= */
const { mano } = require("./veintiuna-ultima-vela.js");
const N = Number(process.argv[2]) || 1500;
let semilla = 20271019;
const azar = () => (semilla = (semilla * 1664525 + 1013904223) >>> 0) / 4294967296;
const nombre = x => (x > 0 ? "victoria" : x < 0 ? "derrota" : "empate");
const filas = [];
for (let i = 0; i < N; i++) {
  const m = Array.from({ length: 52 }, (_, n) => n);                         // carta del servidor: 0 a 51 (rango = n % 13 + 1)
  for (let j = 51; j > 0; j--) { const k = Math.floor(azar() * (j + 1)); [m[j], m[k]] = [m[k], m[j]]; }
  const rangos = m.map(n => (n % 13) + 1);
  for (const nivel of ["novato", "basico"]) filas.push(`select t_r_comparar('{${m.join(",")}}'::smallint[], '${nivel}', '${nombre(mano("testigo18", nivel, rangos))}');`);
}
console.log(filas.join("\n"));
