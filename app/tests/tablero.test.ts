import { Tablero, N, TOTAL, REGLAS, type Paso } from "../src/pitter/motor/tablero.ts";
import { usarHabilidad } from "../src/pitter/motor/habilidades.ts";
import type { Verbo } from "../src/pitter/datos/roster.ts";
import { MotorLider } from "../src/pitter/motor/lider.ts";
import { LIDERES } from "../src/pitter/datos/lideres.ts";

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

// 5. Tamaño del grupo y ventana del combo
{
  const t = new Tablero({ semilla: 9, tipos: 6, equipo: [0, 1], atqEquipo: [3, 4] });
  afirma(t.multTamano(4) === 1 && t.multTamano(6) > t.multTamano(5) && t.multTamano(5) > t.multTamano(4), "un grupo mas grande hace mas dano");
  afirma(t.multTamano(99) === t.multTamano(REGLAS.porTamano.length - 1), "el tamaño no crece sin fin");
  const v0 = t.ventanaCombo();
  t.combo = 30;
  afirma(t.ventanaCombo() < v0 && t.ventanaCombo() >= REGLAS.ventanaMin, "la ventana del combo baja con el combo y tiene suelo");
  // Un grupo formado a mano trae su rectangulo
  const u = new Tablero({ semilla: 3, tipos: 6, equipo: [0, 1], atqEquipo: [3, 4] });
  for (const i of [0, 1, 6, 7]) u.celdas[i].tipo = 5;
  const g = u.grupos().find((x) => x.tipo === 5 && x.celdas.includes(0));
  afirma(!!g && g.rect && g.caja.x0 === 0 && g.caja.x1 === 1 && g.caja.y0 === 0 && g.caja.y1 === 1, "un cuadrado de 2x2 se detecta como rectangulo");
}

// 6. Habilidad de lider
{
  const prueba = (id: string, ctx: Partial<{ puntos: number; combo: number; vidaFrac: number; tiempoRestante: number; tiempoJugado: number; stand: boolean }>) => {
    const m = new MotorLider(LIDERES[id]);
    return m.actualizar(0.016, { puntos: 0, combo: 0, vidaFrac: 1, tiempoRestante: 60, tiempoJugado: 1, stand: false, ...ctx });
  };
  afirma(Object.keys(LIDERES).length === 16, "hay 16 lideres");
  afirma(prueba("bull", {}).ataque > 1, "siempre: el ataque sube");
  afirma(prueba("ocevat", { tiempoRestante: 10 }).ataque > 1 && prueba("ocevat", { tiempoRestante: 40 }).ataque === 1, "tiempo bajo: solo con poco tiempo");
  afirma(prueba("verdam", { vidaFrac: 0.3 }).ataque > 1 && prueba("verdam", { vidaFrac: 0.9 }).ataque === 1, "vida del jefe baja");
  afirma(prueba("dagren", { stand: true }).ataque > 1 && prueba("dagren", { stand: false }).ataque === 1, "solo durante el Stand Up");
  afirma(prueba("garra", { tiempoJugado: 1 }).unicos.length === 1, "inicio salta una vez");
  {
    const m = new MotorLider(LIDERES["garra"]);
    const c = { puntos: 0, combo: 0, vidaFrac: 1, tiempoRestante: 60, tiempoJugado: 1, stand: false };
    m.actualizar(0.016, c); const r2 = m.actualizar(0.016, c);
    afirma(r2.unicos.length === 0, "inicio no se repite");
  }
  {
    const m = new MotorLider(LIDERES["ceniza-coronada"]);
    const c = { puntos: 1600, combo: 0, vidaFrac: 1, tiempoRestante: 60, tiempoJugado: 5, stand: false };
    const a = m.actualizar(0.016, c).unicos.length; const b = m.actualizar(0.016, c).unicos.length;
    c.puntos = 3100; const d = m.actualizar(0.016, c).unicos.length;
    afirma(a === 1 && b === 0 && d === 1, "puntos: salta una vez por cada escalon");
  }
  {
    const m = new MotorLider(LIDERES["rook"]);
    m.alGrupo(5); afirma(m.actualizar(0.016, { puntos: 0, combo: 0, vidaFrac: 1, tiempoRestante: 60, tiempoJugado: 1, stand: false }).ataque === 1, "grupo pequeño no dispara");
    m.alGrupo(6); const r = m.actualizar(0.016, { puntos: 0, combo: 0, vidaFrac: 1, tiempoRestante: 60, tiempoJugado: 1, stand: false });
    afirma(r.ataque > 1, "grupo grande sube el ataque un rato");
    let sigue = true; for (let i = 0; i < 300; i++) sigue = m.actualizar(0.02, { puntos: 0, combo: 0, vidaFrac: 1, tiempoRestante: 60, tiempoJugado: 1, stand: false }).ataque > 1;
    afirma(!sigue, "el empujon dura unos segundos y se acaba");
  }
  {
    const m = new MotorLider(LIDERES["baraja"]);
    const base = { puntos: 0, vidaFrac: 1, tiempoRestante: 60, tiempoJugado: 1, stand: false };
    const a = m.actualizar(0.016, { ...base, combo: 6 }).unicos.length, b = m.actualizar(0.016, { ...base, combo: 7 }).unicos.length;
    m.actualizar(0.016, { ...base, combo: 0 });
    const c = m.actualizar(0.016, { ...base, combo: 6 }).unicos.length;
    afirma(a === 1 && b === 0 && c === 1, "combo: salta al llegar y otra vez tras romperse");
  }
}

// 7. La Caja convierte cinco fichas en cruz, y esas no dejan otra Caja
{
  const t = new Tablero({ semilla: 21, tipos: 6, equipo: [0, 1], atqEquipo: [3, 4] });
  const idx = 14; // fila 2, columna 2
  t.celdas[idx].caja = true;
  const tipo = t.celdas[idx].tipo;
  const cruz = [idx, ...t.vecinos(idx)];
  const pasos = t.tocarCaja(idx);
  afirma(pasos[0].k === "convertir", "tocar una caja convierte fichas");
  // tras resolver, la cruz entera se ha borrado como grupo (5 fichas del mismo personaje)
  afirma(t.grupos().length === 0, "caja: sin grupos al final");
  afirma(pasos.some((p) => p.k === "borrar"), "caja: la cruz forma un grupo y se borra");
  void tipo; void cruz;
  // un grupo con fichas de caja no deja otra caja
  const u = new Tablero({ semilla: 22, tipos: 6, equipo: [0, 1], atqEquipo: [3, 4] });
  for (const i of [0, 1, 2, 6, 7, 8]) { u.celdas[i].tipo = 5; u.celdas[i].deCaja = i === 0; }
  const ps = u.resolver();
  const b = ps.find((p) => p.k === "borrar") as Extract<Paso, { k: "borrar" }> | undefined;
  afirma(!!b && b.cajas.length === 0, "un grupo con fichas de una caja no deja otra caja");
  const v = new Tablero({ semilla: 22, tipos: 6, equipo: [0, 1], atqEquipo: [3, 4] });
  for (const i of [0, 1, 2, 6, 7, 8]) v.celdas[i].tipo = 5;
  const bv = v.resolver().find((p) => p.k === "borrar") as Extract<Paso, { k: "borrar" }> | undefined;
  afirma(!!bv && bv.cajas.length === 1, "un grupo normal de 6 si deja caja");
}

// 8. Combo: el dano se detiene en 200
{
  const t = new Tablero({ semilla: 5, tipos: 6, equipo: [0, 1], atqEquipo: [3, 4] });
  t.combo = 200; const m200 = t.multCombo(); t.combo = 900;
  afirma(t.multCombo() === m200, "el combo deja de subir el dano en 200");
  t.combo = 10; const m10 = t.multCombo(); t.combo = 20;
  afirma(t.multCombo() > m10, "mas combo, mas dano");
}

// 9. Rush: se quitan obstaculos y piezas especiales
{
  const t = new Tablero({ semilla: 8, tipos: 6, equipo: [0, 1], atqEquipo: [3, 4] });
  t.celdas[1].bloque = 2; t.celdas[2].caja = true; t.celdas[3].congelada = true; t.celdas[4].tinta = true;
  const p = t.limpiarParaRush();
  afirma(p.length === 1 && t.celdas.every((c) => c.bloque === 0 && !c.caja && !c.congelada && !c.tinta), "el Rush deja el tablero limpio");
}
console.log(`${ok} comprobaciones bien, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
