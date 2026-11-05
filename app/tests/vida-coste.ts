/* Mide el coste por paso de simulacion con varias criaturas en la misma sala, con el interruptor de celos apagado y encendido.
   Uso: node tests/vida-coste.ts */
import { genomaDe, nuevaSim } from "../src/vida/lab/laboratorio.ts";

function medir(n: number, celos: boolean): number {
  const crs = Array.from({ length: n }, (_, i) => ({ genoma: genomaDe(7, 300 + i), x: 300 + i * 120 }));
  const s = nuevaSim({ semilla: 7, objetos: [{ tipo: "pelota", x: 700 }], criaturas: crs, comedero: { cada: 100, max: 3, tipo: "fruta" } });
  for (const c of s.criaturas) { c.celos = celos; c.capRegistro = 1000; }
  s.avanzar(100);
  let mejor = Infinity;
  for (let r = 0; r < 5; r++) {
    const t0 = performance.now();
    s.avanzar(200);
    mejor = Math.min(mejor, performance.now() - t0);
  }
  return mejor / (200 / 0.25);
}
for (const n of [2, 4, 6, 8, 12]) {
  const a = medir(n, false), b = medir(n, true);
  console.log(`${n} criaturas: apagado ${(a * 1000).toFixed(0)} us/paso, encendido ${(b * 1000).toFixed(0)} us/paso, diferencia ${((b - a) * 1000).toFixed(0)} us (${(((b - a) / a) * 100).toFixed(1)} %)`);
}
