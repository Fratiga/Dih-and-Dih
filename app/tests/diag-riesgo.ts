/* Diagnostico (no es un caso): que pesa en contra de ir a la fruta de la placa tras el primer contacto, con el interruptor hambreArriesga encendido. */
import { nuevaSim, genomaDe } from "../src/vida/lab/laboratorio.ts";
import { mezclar } from "../src/vida/nucleo/azar.ts";
import { R, C } from "../src/vida/nucleo/tipos.ts";
import { candidatas, percibir } from "../src/vida/nucleo/conducta.ts";
const semilla = 1;
const s = nuevaSim({ semilla: mezclar(semilla, 431), objetos: [], criaturas: [{ genoma: genomaDe(semilla, 431), x: 400 }], comedero: null, mortalidad: "protegida" });
const c = s.criaturas[0];
c.hambreArriesga = true; c.rasgos[R.miedo] = 0.15; c.base[R.miedo] = 0.15; c.nec[0] = 0.75;
s.mundo.agregar("placa", 900); s.mundo.agregar("fruta", 900);
for (const t of [20, 60, 120, 300, 600]) {
  s.avanzar(t - s.t);
  const env = { mundo: s.mundo, criaturas: s.criaturas, t: s.t } as never;
  const ps = percibir(c, env);
  const cands = candidatas(c, ps, env);
  const f = cands.filter((k) => k.p && k.p.tipo === "fruta").map((k) => `${k.v}:u=${k.u.toFixed(2)} sacia=${k.espera[C.sacia].toFixed(2)} dano=${k.espera[C.dano].toFixed(2)} susto=${k.espera[C.susto].toFixed(2)}`);
  const ev = cands.filter((k) => k.v === "evitar").map((k) => `evitar ${k.p?.tipo}:u=${k.u.toFixed(2)}`);
  const otras = cands.filter((k) => !k.p).map((k) => `${k.v}:u=${k.u.toFixed(2)}`);
  console.log(`t=${t} x=${c.x.toFixed(0)} hambre=${c.nec[0].toFixed(2)} apetito=${c.apetitoRiesgo().toFixed(2)} miedoEmo=${c.emo[0].toFixed(2)}`, f.join(" | "), ev.join(" | "), otras.join(" | "));
}
