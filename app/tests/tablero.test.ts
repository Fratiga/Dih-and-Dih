import { Tablero, N, TOTAL, REGLAS, type Paso } from "../src/pitter/motor/tablero.ts";
import { usarHabilidad } from "../src/pitter/motor/habilidades.ts";
import type { Verbo } from "../src/pitter/datos/roster.ts";

let fallos = 0, ok = 0;
const afirma = (c: boolean, m: string) => { if (c) ok++; else { fallos++; console.log("FALLA:", m); } };

function invariantes(t: Tablero, nombre: string) {
  afirma(t.celdas.length === TOTAL && t.celdas.every(Boolean), `${nombre}: tablero lleno`);
  const ids = new Set(t.celdas.map(c => c.id));
  afirma(ids.size === TOTAL, `${nombre}: ids unicos`);
  afirma(t.celdas.every(c => c.tipo >= 0 && c.tipo < t.tipos), `${nombre}: tipos validos`);
}

// 1. Un tablero nuevo no trae grupos hechos y es determinista
for (let s = 1; s <= 200; s++) {
  const t = new Tablero({ semilla: s, tipos: 6, equipo: [0, 1], atqEquipo: [3, 4] });
  invariantes(t, `nuevo ${s}`);
  afirma(t.grupos().length === 0, `nuevo ${s}: sin grupos`);
  const u = new Tablero({ semilla: s, tipos: 6, equipo: [0, 1], atqEquipo: [3, 4] });
  afirma(t.celdas.map(c => c.tipo).join() === u.celdas.map(c => c.tipo).join(), `nuevo ${s}: determinista`);
}

// 2. Partidas al azar: mover, resolver, tocar cajas
let cajas = 0, grupos6 = 0, danoTotal = 0;
for (let s = 1; s <= 300; s++) {
  const t = new Tablero({ semilla: 1000 + s, tipos: 6, equipo: [0, 1], atqEquipo: [3, 4] });
  const rnd = (n: number) => Math.floor(t.rng() * n);
  for (let m = 0; m < 60; m++) {
    const a = rnd(TOTAL);
    const vs = t.vecinos(a);
    const b = vs[rnd(vs.length)];
    t.intercambiar(a, b);
    const pasos = t.resolver();
    for (const p of pasos) {
      if (p.k === "borrar") { danoTotal += p.dano; if (p.cajas.length) cajas += p.cajas.length; if (p.grupos.some(g => g.celdas.length >= REGLAS.minCaja)) grupos6++; afirma(p.dano >= 0, "dano no negativo"); }
    }
    invariantes(t, `partida ${s} mov ${m}`);
    afirma(t.grupos().length === 0, `partida ${s} mov ${m}: sin grupos tras resolver`);
    const caja = t.indicesDe(c => c.caja);
    if (caja.length && rnd(3) === 0) { t.tocarCaja(caja[0]); invariantes(t, `caja ${s}`); afirma(t.grupos().length === 0, `caja ${s}: sin grupos`); }
    if (m % 15 === 14) t.reiniciarCombo();
  }
}
console.log("cajas creadas:", cajas, "| grupos>=6:", grupos6, "| dano total:", Math.round(danoTotal));
afirma(cajas > 0, "se crean cajas alguna vez");

// 3. Todas las habilidades, con bloques y obstaculos de por medio
const verbos: [Verbo, number][] = [["convertirAzar", 9], ["borrarColumna", 1], ["barajar", 3], ["tiempo", 8], ["marcarTipo", 1], ["limpiar", 25], ["crearCajas", 2], ["cruz", 1], ["furia", 8], ["caos", 12], ["diagonales", 1], ["aturdir", 6], ["borrarTipo", 1], ["sacrificio", 5], ["fusionar", 1], ["reforzarEquipo", 1]];
for (const [v, n] of verbos) {
  for (let s = 1; s <= 60; s++) {
    const t = new Tablero({ semilla: 5000 + s, tipos: 6, equipo: [0, 1], atqEquipo: [3, 4] });
    // unos bloques, una congelada y una con tinta
    t.celdas[3].bloque = 2; t.celdas[10].bloque = 1; t.celdas[20].congelada = true; t.celdas[25].tinta = true;
    const e = usarHabilidad(t, v, n, 0, v);
    invariantes(t, `habilidad ${v} ${s}`);
    afirma(t.grupos().length === 0, `habilidad ${v} ${s}: sin grupos al final`);
    afirma(Array.isArray(e.pasos), `${v}: devuelve pasos`);
  }
}

// 4. Stand Up Time: los grupos se quedan de pie y estallan al salir
{
  const t = new Tablero({ semilla: 77, tipos: 6, equipo: [0, 1], atqEquipo: [3, 4] });
  t.entrarStand();
  let quedaron = 0;
  for (let m = 0; m < 200 && quedaron < 12; m++) {
    const a = Math.floor(t.rng() * TOTAL); const vs = t.vecinos(a); t.intercambiar(a, vs[Math.floor(t.rng() * vs.length)]);
    t.resolver();
    quedaron = t.celdas.filter(c => c.stand).length;
  }
  afirma(quedaron >= 4, `stand: se quedan fichas de pie (${quedaron})`);
  const antes = t.pozoStand;
  const pasos: Paso[] = t.salirStand();
  const est = pasos.find(p => p.k === "estallar");
  afirma(!!est && (est as any).dano >= antes, "stand: el estallido suma el pozo");
  invariantes(t, "tras stand");
  afirma(t.celdas.every(c => !c.stand), "stand: no queda nada de pie");
}
console.log(`${ok} comprobaciones bien, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
