/* Diagnostico (no es un caso): cuanto se juntan las criaturas en la sala de 1600 unidades. */
import { nuevaSim, genomaDe } from "../src/vida/lab/laboratorio.ts";
import { mezclar } from "../src/vida/nucleo/azar.ts";
import { AJ } from "../src/vida/nucleo/ajustes.ts";
for (const n of [2, 4]) {
  const res = { vista: 0, vistaTodas: 0, contacto: 0, pasos: 0 };
  for (let sem = 1; sem <= 5; sem++) {
    const s = nuevaSim({ semilla: mezclar(sem, 77), objetos: [{ tipo: "pelota", x: 800 }, { tipo: "palanca", x: 1200 }], criaturas: Array.from({ length: n }, (_, i) => ({ genoma: genomaDe(sem, 70 + i), x: 200 + (i * 1200) / n })), comedero: { cada: 60, max: 2, tipo: "fruta" } });
    s.ganchos.push(() => {
      res.pasos++;
      let pares = 0, enVista = 0, enContacto = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { pares++; const d = Math.abs(s.criaturas[i].x - s.criaturas[j].x); if (d <= AJ.vista) enVista++; if (d <= 130) enContacto++; }
      res.vista += enVista / pares; res.contacto += enContacto / pares;
      if (enVista === pares) res.vistaTodas++;
    });
    s.avanzar(900);
  }
  console.log(`${n} criaturas en 1600 unidades: pares a la vista ${(100 * res.vista / res.pasos).toFixed(0)} % del tiempo, pares en contacto (menos de 130) ${(100 * res.contacto / res.pasos).toFixed(0)} %, todas a la vista de todas ${(100 * res.vistaTodas / res.pasos).toFixed(0)} %`);
}
