/* Ejecuta los casos del laboratorio de pruebas de Vida Artificial y muestra el resultado de cada semilla.
   Uso: N=10 V=1 node app/tests/vida-lab.ts 01 04b   (N = numero de semillas, V = detalle por semilla, los numeros son los ids de caso) */
import { CASOS, } from "../src/vida/lab/casos.ts";
import { ejecutarCaso, tablaInforme } from "../src/vida/lab/laboratorio.ts";
import { AJ } from "../src/vida/nucleo/ajustes.ts";
const ids = process.argv.slice(2);
const n = Number(process.env.N ?? 6);
/* Para experimentos de capacidad: OCULTAS=24 cambia las neuronas ocultas de la red y DESDE=21 empieza en otra semilla. */
if (process.env.OCULTAS) AJ.ocultas = Number(process.env.OCULTAS);
if (process.env.EXTRA) AJ.entradasExtra = Number(process.env.EXTRA);
if (process.env.PESO_DEFENSA) AJ.pesoDefensa = Number(process.env.PESO_DEFENSA);
const desde = Number(process.env.DESDE ?? 1);
for (const caso of CASOS) {
  if (ids.length && !ids.includes(caso.id)) continue;
  const t0 = Date.now();
  const inf = ejecutarCaso(caso, Array.from({ length: n }, (_, i) => i + desde));
  console.log(tablaInforme(inf), `(${Date.now() - t0} ms)`);
  if (process.env.V) for (const r of inf.resultados) console.log("  ", r.semilla, r.ok ? "ok" : "NO", JSON.stringify(Object.fromEntries(Object.entries(r.metricas).map(([k, v]) => [k, Math.round(v * 100) / 100]))), Object.entries(r.criterios).filter(([, v]) => !v).map(([k]) => k).join(" | "));
}
