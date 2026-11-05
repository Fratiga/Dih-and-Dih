/* Mide cuanto cuesta la percepcion social (celos y envidia) con varias criaturas en la misma sala.
   Se envuelve cada metodo y se suma su tiempo, asi que la medida no depende del ruido de la maquina entre tandas. Se compara con el tiempo total del paso.
   Uso: node tests/vida-coste.ts */
import { genomaDe, nuevaSim } from "../src/vida/lab/laboratorio.ts";
import { Criatura } from "../src/vida/nucleo/criatura.ts";

const proto = Criatura.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
const acumulado: Record<string, number> = { sentirCelos: 0, sentirEnvidia: 0 };
for (const nombre of Object.keys(acumulado)) {
  const original = proto[nombre];
  proto[nombre] = function (this: unknown, ...a: unknown[]) {
    const t0 = performance.now();
    const r = original.apply(this, a);
    acumulado[nombre] += performance.now() - t0;
    return r;
  };
}

function medir(n: number): { total: number; celos: number; envidia: number } {
  const crs = Array.from({ length: n }, (_, i) => ({ genoma: genomaDe(7, 300 + i), x: 300 + i * 120 }));
  const s = nuevaSim({ semilla: 7, objetos: [{ tipo: "pelota", x: 700 }], criaturas: crs, comedero: { cada: 100, max: 3, tipo: "fruta" } });
  for (const c of s.criaturas) { c.celos = true; c.envidia = true; c.capRegistro = 1000; }
  s.avanzar(100);
  acumulado.sentirCelos = 0; acumulado.sentirEnvidia = 0;
  const t0 = performance.now();
  s.avanzar(800);
  const pasos = 800 / 0.25;
  return { total: ((performance.now() - t0) / pasos) * 1000, celos: (acumulado.sentirCelos / pasos) * 1000, envidia: (acumulado.sentirEnvidia / pasos) * 1000 };
}
medir(8);
for (const n of [2, 4, 6, 8, 12]) {
  const m = medir(n);
  console.log(`${n} criaturas: paso completo ${m.total.toFixed(0)} us, celos ${m.celos.toFixed(1)} us (${((m.celos / m.total) * 100).toFixed(1)} %), envidia ${m.envidia.toFixed(1)} us (${((m.envidia / m.total) * 100).toFixed(1)} %)`);
}
