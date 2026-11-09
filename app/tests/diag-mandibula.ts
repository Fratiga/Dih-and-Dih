/* Diagnostico (no es un caso): el rendimiento depredador del caso 40, ¿ve la mandibula? Compara genomas con mandibula 0 y 0,9, sin tocar nada mas. */
import { Criatura } from "../src/vida/nucleo/criatura.ts";
import { clonarGenoma, especializar } from "../src/vida/nucleo/genoma.ts";
import { mezclar } from "../src/vida/nucleo/azar.ts";
import { DIA, R } from "../src/vida/nucleo/tipos.ts";
import { genomaDe, media, nuevaSim } from "../src/vida/lab/laboratorio.ts";

const semilla = Number(process.env.SEMILLA ?? 1);
const gPresa = genomaDe(semilla, 409);
const base = { recursos: 0.3, defensa: 0.3, depredador: 0.6, territorial: 0, craneo: 0, mandibula: 0, garras: 0, agilidad: 0 };
const rend = (mand: number, k: number, robusta: boolean): { dano: number; golpes: number; saludMin: number } => {
  const g = especializar(genomaDe(semilla, 415), { ...base, mandibula: mand });
  const s = nuevaSim({ semilla: mezclar(semilla, 411, k), objetos: [], criaturas: [{ genoma: clonarGenoma(g), x: 500 }], comedero: null, mortalidad: "protegida" });
  const H = s.criaturas[0];
  H.agresion = true; H.conflictoComida = true; H.reconocePorRasgos = true; H.capRegistro = 20000; H.edad = DIA;
  for (let i = 0; i < 2; i++) { for (const o of [...s.mundo.objetos]) s.mundo.quitar(o.id); s.mundo.agregar("cadaver", 1000, { porciones: 6 }); H.x = 500; H.accion = null; H.nec[0] = 0.7; s.avanzar(45); }
  for (const o of [...s.mundo.objetos]) s.mundo.quitar(o.id);
  const P = new Criatura(10, "Presa", clonarGenoma(gPresa), 1000, mezclar(semilla, 412, k));
  P.agresion = true; P.capRegistro = 5000; P.rasgos[R.agresividad] = 0.1; P.base[R.agresividad] = 0.1; P.salud = robusta ? 1.0 : 0.6; if (robusta) P.atrapada = true;
  s.criaturas = [H, P];
  H.x = 400; H.accion = null; H.nec[0] = 0.7; H.emo.fill(0);
  P.x = 650; P.accion = null;
  const s0 = P.salud;
  let min = P.salud;
  s.ganchos.push(() => { min = Math.min(min, P.salud); });
  s.avanzar(120);
  const golpes = H.registro.filter((r) => r.kind === "inicio" && r.v === "empujar" && r.obj === 1000 + P.id).length;
  return { dano: s0 - min, golpes, saludMin: min };
};
for (const robusta of [false, true]) {
  for (const mand of [0, 0.9]) {
    const rs = Array.from({ length: 12 }, (_, k) => rend(mand, k, robusta));
    console.log(`robusta=${robusta} mandibula=${mand}`, "dano medio", media(rs.map((r) => r.dano)).toFixed(3), "golpes medios", media(rs.map((r) => r.golpes)).toFixed(1), "salud minima media", media(rs.map((r) => r.saludMin)).toFixed(3), "danos", rs.map((r) => r.dano.toFixed(2)).join(" "));
  }
}
