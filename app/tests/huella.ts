/* Huella de una simulacion entera: sirve para comprobar que un cambio de arquitectura no altera nada de lo que ya hacia (se ejecuta en dos copias del codigo y se comparan). */
import { nuevaSim, genomaDe } from "../src/vida/lab/laboratorio.ts";
import { mezclar } from "../src/vida/nucleo/azar.ts";
import { createHash } from "node:crypto";
const partes: string[] = [];
for (const sem of [1, 2, 3]) {
  const s = nuevaSim({ semilla: mezclar(sem, 5), objetos: [{ tipo: "pelota", x: 700 }, { tipo: "palanca", x: 1000 }, { tipo: "placa", x: 300 }], criaturas: [0, 1, 2].map((i) => ({ genoma: genomaDe(sem, 50 + i), x: 300 + i * 400 })), comedero: { cada: 50, max: 2, tipo: "fruta" } });
  for (const c of s.criaturas) { c.agresion = true; c.reconocePorRasgos = true; }
  s.avanzar(1500);
  partes.push(JSON.stringify(s.criaturas.map((c) => [c.registro, c.x, c.nec, c.emo, c.mem.protos.length, c.mem.episodios.length, c.rasgos, c.salud])), JSON.stringify(s.mundo.objetos.map((o) => [o.tipo, o.x, o.porciones])));
}
console.log(createHash("sha256").update(partes.join("|")).digest("hex"));
