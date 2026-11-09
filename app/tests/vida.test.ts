import { Azar } from "../src/vida/nucleo/azar.ts";
import { Red, insertarColumnas } from "../src/vida/nucleo/red.ts";
import { Simulacion } from "../src/vida/nucleo/simulacion.ts";
import { genomaNuevo, clonarGenoma, cruzar, sexoDe, especializar, ESPECIALIZACIONES } from "../src/vida/nucleo/genoma.ts";
import { AJ } from "../src/vida/nucleo/ajustes.ts";
import { Memoria, semejanza } from "../src/vida/nucleo/memoria.ts";
import { Criatura, NI } from "../src/vida/nucleo/criatura.ts";
import { C, NC_RED as NC, RASGOS } from "../src/vida/nucleo/tipos.ts";
import { featuresCriatura } from "../src/vida/nucleo/conducta.ts";
import { ModeloAjeno } from "../src/vida/nucleo/modeloajeno.ts";
import { CASOS, CASOS_OBLIGATORIOS } from "../src/vida/lab/casos.ts";
import { actor, calentada, ejecutarCaso, impactos, nuevaSim, tablaInforme } from "../src/vida/lab/laboratorio.ts";

let fallos = 0, ok = 0;
const afirma = (c: boolean, m: string) => { if (c) ok++; else { fallos++; console.log("FALLA:", m); } };

// EXTRA=4 ejecuta todo con 4 entradas ampliables en la red: los resultados tienen que ser identicos a los de EXTRA=0 (ninguna criatura las usa)
if (process.env.EXTRA) AJ.entradasExtra = Number(process.env.EXTRA);
const cfg = (semilla: number, objetos = [{ tipo: "pelota", x: 700 }, { tipo: "fruta", x: 1100 }], g = genomaNuevo(semilla)) => ({
  semilla, objetos, criaturas: [{ genoma: g, x: 300 }], comedero: { cada: 150, max: 2, tipo: "fruta" },
});

// 1. La red: nace sin preferencias, aprende y se guarda
{
  const r = new Red(NI, AJ.ocultas, NC, 99);
  const x = new Array(NI).fill(0).map((_, i) => (i % 3) / 3);
  const antes = r.predecir(x);
  afirma(antes.every((v) => v < 0.12), "una red recien nacida no predice casi nada (no trae reglas)");
  const objetivo = [0.8, 0, 0, 0, 0];
  let e0 = 0, e1 = 0;
  for (let i = 0; i < 200; i++) { const e = r.entrenar(x, objetivo, 0.12); if (i === 0) e0 = e; e1 = e; }
  afirma(e1 < e0 * 0.1, "la red aprende: el error baja a menos de una decima parte");
  afirma(r.predecir(x)[0] > 0.6, "tras aprender, predice lo que paso");
  const r2 = Red.desde(JSON.parse(JSON.stringify(r.estado())));
  afirma(JSON.stringify(r2.predecir(x)) === JSON.stringify(r.predecir(x)), "la red se guarda y se restaura igual");
  const y = new Array(NI).fill(0.5);
  const h0 = r.h.slice();
  r.avanzar(y);
  afirma(r.h.some((v, i) => v !== h0[i]), "la red es recurrente: su estado interno cambia con lo que percibe");
  r.olvidar(1);
  afirma(r.predecir(x)[0] < 0.12, "olvido total: vuelve a los pesos de nacimiento");
}

// 1b. Red con entradas ampliables: con entrada cero no cambia nada de lo que ya hacia
{
  const EXTRA = 5;
  let identicas = true, pesosIguales = true, extrasEnCero = true;
  for (const semilla of [1, 7, 99]) {
    const a = new Red(NI, AJ.ocultas, NC, semilla);
    const b = new Red(NI, AJ.ocultas, NC, semilla, undefined, EXTRA);
    const azar = new Azar(semilla * 31 + 5);
    for (let paso = 0; paso < 600; paso++) {
      const xa = Array.from({ length: NI }, () => azar.next());
      const xb = xa.concat(new Array(EXTRA).fill(0));
      const objetivo = Array.from({ length: NC }, () => azar.next());
      const canales = paso % 3 === 0 ? [true, false, true, false, true] : undefined;
      if (paso % 4 === 0) { a.avanzar(xa); b.avanzar(xb); }
      const pa = a.predecir(xa), pb = b.predecir(xb);
      if (pa.some((v, i) => v !== pb[i])) identicas = false;
      if (a.entrenar(xa, objetivo, 0.12, canales) !== b.entrenar(xb, objetivo, 0.12, canales)) identicas = false;
      if (paso % 50 === 0) { a.olvidar(0.05); b.olvidar(0.05); }
    }
    const ampliada = insertarColumnas(a.w1, NI, NI + EXTRA, a.nH);
    if (ampliada.some((v, i) => v !== b.w1[i])) pesosIguales = false;
    if (a.w2.some((v, i) => v !== b.w2[i]) || a.b1.some((v, i) => v !== b.b1[i]) || a.b2.some((v, i) => v !== b.b2[i]) || a.h.some((v, i) => v !== b.h[i])) pesosIguales = false;
    const nCol = NI + EXTRA + b.nH;
    for (let j = 0; j < b.nH; j++) for (let i = NI; i < NI + EXTRA; i++) if (b.w1[j * nCol + i] !== 0) extrasEnCero = false;
  }
  afirma(identicas, "una red con entradas ampliables da las mismas predicciones y el mismo error que la de siempre, paso a paso (avanzar, predecir, entrenar y olvidar)");
  afirma(pesosIguales, "y deja exactamente los mismos pesos, sesgos y estado interno (los de siempre, en su sitio)");
  afirma(extrasEnCero, "las entradas ampliables siguen en cero tras aprender y olvidar mientras valen cero");
  // La entrada nueva puede usarse: con peso cero no cambia la salida aunque valga 1, y al aprender con ella se activa
  const c = new Red(NI, AJ.ocultas, NC, 3, undefined, 2);
  const x1 = new Array(NI + 2).fill(0).map((_, i) => (i < NI ? (i % 3) / 3 : 0));
  const x2 = x1.slice(); x2[NI] = 1;
  afirma(JSON.stringify(c.predecir(x1)) === JSON.stringify(c.predecir(x2)), "una entrada nueva con peso cero no cambia la salida aunque valga 1");
  for (let i = 0; i < 300; i++) c.entrenar(x2, [0.9, 0, 0, 0, 0], 0.12);
  afirma(Math.abs(c.predecir(x2)[0] - c.predecir(x1)[0]) > 0.02, "pero al aprender con ella la red la aprovecha");
  // Guardar y restaurar: un estado de la red de siempre se restaura en una ampliable, rellenado con ceros, y sigue igual
  const vieja = new Red(NI, AJ.ocultas, NC, 11);
  const xs = new Array(NI).fill(0).map((_, i) => ((i * 7) % 5) / 5);
  for (let i = 0; i < 100; i++) { vieja.avanzar(xs); vieja.entrenar(xs, [0.5, 0.1, 0, 0.2, 0], 0.1); }
  const nueva = Red.desde(JSON.parse(JSON.stringify(vieja.estado())), 4);
  const xe = xs.concat([0, 0, 0, 0]);
  afirma(nueva.nIn === NI + 4 && nueva.nBase === NI, "un estado guardado con la red de siempre se restaura con las entradas ampliables añadidas");
  let sigue = true;
  for (let i = 0; i < 100; i++) {
    const objetivo = [0.2 + (i % 3) / 10, 0, 0.3, 0, 0];
    if (vieja.entrenar(xs, objetivo, 0.1) !== nueva.entrenar(xe, objetivo, 0.1)) sigue = false;
    vieja.avanzar(xs); nueva.avanzar(xe);
    if (vieja.predecir(xs).some((v, k) => v !== nueva.predecir(xe)[k])) sigue = false;
  }
  afirma(sigue, "y desde ahi sigue aprendiendo exactamente igual que la original");
  const guardada = Red.desde(JSON.parse(JSON.stringify(nueva.estado())), 4);
  afirma(JSON.stringify(guardada.predecir(xe)) === JSON.stringify(nueva.predecir(xe)) && guardada.nBase === NI, "una red ampliable se guarda y se restaura igual");
}

// 1c. Entradas ampliables en una simulacion entera: nada cambia para quien no las usa
{
  const correr = (extra: number, sim?: ReturnType<typeof nuevaSim>, mas = 900) => {
    AJ.entradasExtra = extra;
    const s = sim ?? nuevaSim({ semilla: 61, objetos: [{ tipo: "pelota", x: 700 }, { tipo: "palanca", x: 1000 }], criaturas: [{ genoma: genomaNuevo(1), x: 300 }, { genoma: genomaNuevo(2), x: 600 }], comedero: { cada: 80, max: 2, tipo: "fruta" } });
    s.avanzar(mas);
    return s;
  };
  const huella = (s: ReturnType<typeof nuevaSim>): string => JSON.stringify(s.criaturas.map((c) => [c.registro, c.x, c.nec, c.emo, c.mem.protos.length, c.mem.episodios.length, c.rasgos]));
  const previo = AJ.entradasExtra;
  const base = correr(0);
  const ampliada = correr(4);
  afirma(ampliada.criaturas.every((c) => c.red.nIn === NI + 4) && base.criaturas.every((c) => c.red.nIn === NI), "las criaturas de la simulacion ampliada tienen la red con las entradas nuevas");
  afirma(huella(base) === huella(ampliada), "una simulacion de 900 s con 2 criaturas es idéntica con 4 entradas ampliables y sin ellas (acciones, posiciones, necesidades, emociones, memoria y rasgos)");
  // Restaurar un estado antiguo en un mundo con entradas ampliables y seguir: idéntico a seguir sin ellas
  const guardado = base.serializar();
  AJ.entradasExtra = 0;
  const seguirBase = correr(0, Simulacion.restaurar(JSON.parse(JSON.stringify(guardado))), 300);
  AJ.entradasExtra = 4;
  const restaurada = Simulacion.restaurar(JSON.parse(JSON.stringify(guardado)));
  const seguirAmp = correr(4, restaurada, 300);
  afirma(seguirAmp.criaturas.every((c) => c.red.nIn === NI + 4) && huella(seguirBase) === huella(seguirAmp), "restaurar una partida guardada antes de las entradas ampliables y seguir 300 s da lo mismo que seguir sin ellas");
  AJ.entradasExtra = previo;
}

// 1d. Razas simples: actores con regla fija, que no aprenden ni cambian
{
  const golpesDe = (c: Criatura): number => c.registro.filter((r) => r.kind === "impacto" && r.v === "empujar" && r.tipo === "criatura").length;
  const sH = nuevaSim({ semilla: 5, objetos: [], criaturas: [{ genoma: genomaNuevo(1), x: 300 }], comedero: null });
  const h = actor("hostil", 9, 700, 5);
  sH.criaturas.push(h);
  sH.avanzar(300);
  const nueva = new Red(NI, AJ.ocultas, NC, h.genoma.semillaCerebro, undefined, AJ.entradasExtra);
  afirma(golpesDe(h) >= 8 && sH.criaturas[0].ultimoDano > 0, "una raza simple hostil pega sin parar a la criatura que ve y la hace sufrir");
  afirma(h.rasgos.every((v, i) => v === h.base[i]) && h.red.w1.every((v, i) => v === nueva.w1[i]) && h.red.w2.every((v, i) => v === nueva.w2[i]), "y no cambia: sus rasgos y su red siguen como al nacer");
  const sA = nuevaSim({ semilla: 5, objetos: [], criaturas: [{ genoma: genomaNuevo(1), x: 300 }], comedero: null });
  const am = actor("amistosa", 8, 900, 5);
  sA.criaturas.push(am);
  let cerca = 0, pasos = 0;
  sA.ganchos.push(() => { if (sA.t > 60) { pasos++; if (Math.abs(am.x - sA.criaturas[0].x) < 200) cerca++; } });
  sA.avanzar(300);
  afirma(golpesDe(am) === 0 && cerca / pasos > 0.6, "una raza simple amistosa no pega nunca y se queda cerca de la otra");
  afirma(Simulacion.restaurar(sH.serializar()).criaturas.some((c) => c.rutina === "hostil"), "la raza simple se guarda y se restaura");
}

// 1e. Secuelas fisicas: dejan evidencia en la criatura, limitan lo que hace y no pasan nada si estan apagadas
{
  const montar = (secuelas: boolean) => {
    const s = nuevaSim({ semilla: 8, objetos: [], criaturas: [{ genoma: genomaNuevo(3), x: 300 }], comedero: null, secuelas });
    s.criaturas.push(actor("hostil", 9, 600, 8));
    s.criaturas[1].permiteSecuelas = false;
    s.avanzar(900);
    return s;
  };
  const con = montar(true), sin = montar(false);
  const v = con.criaturas[0];
  afirma(sin.criaturas[0].secuelas.length === 0 && sin.criaturas[0].factorMovilidad() === 1 && sin.criaturas[0].factorFuerza() === 1 && sin.criaturas[0].factorVista() === 1 && sin.criaturas[0].factorOido() === 1, "con las secuelas apagadas no queda ninguna y todos los factores valen exactamente 1");
  afirma(v.secuelas.length >= 1 && v.secuelas.every((q) => q.texto.length > 10 && q.efecto.length > 5 && q.gravedad > 0 && q.gravedad <= 1 && q.causa === 1009), "los golpes repetidos dejan secuelas, con su texto, su efecto y quien las causó");
  afirma(v.mem.episodios.some((e) => e.clave.startsWith("secuela:")), "y quedan en su historia como un episodio");
  const limites = [v.factorMovilidad(), v.factorFuerza(), v.factorVista(), v.factorOido()];
  afirma(limites.every((f) => f <= 1 && f >= 0.4) && limites.some((f) => f < 1), "cada secuela limita lo que puede hacer, y de forma acotada");
  afirma(new Set(v.secuelas.map((q) => q.tipo)).size === v.secuelas.length, "no repite el mismo tipo de secuela");
  afirma(Simulacion.restaurar(con.serializar()).criaturas[0].secuelas.length === v.secuelas.length && Simulacion.restaurar(con.serializar()).secuelas, "las secuelas se guardan y se restauran");
  // El efecto funcional se nota: una cojera la hace ir mas despacio
  const coja = new Criatura(1, "Coja", genomaNuevo(4), 1000, 5);
  coja.secuelas.push({ tipo: "cojera", zona: "pata trasera", gravedad: 1, t: 0, causa: 1002, texto: "", efecto: "" });
  afirma(Math.abs(coja.factorMovilidad() - (1 - AJ.limiteCojera)) < 1e-12, "una cojera de gravedad 1 limita el movimiento exactamente al límite fijado");
}

// 1f. Extincion del miedo aprendido: baja con contacto seguro con quien se teme, y solo si esta encendida
{
  const probar = (extincion: boolean) => {
    const s = nuevaSim({ semilla: 12, objetos: [], criaturas: [{ genoma: genomaNuevo(5), x: 400 }], comedero: null });
    const V = s.criaturas[0];
    const H = actor("hostil", 9, 700, 12);
    s.criaturas.push(H);
    s.avanzar(250);
    const f = featuresCriatura(H);
    const peligro = (): number => { const p = V.mem.predecir("presencia", f, new Array(10).fill(1), 0); return p.res[C.dano] * p.conf; };
    const antes = peligro();
    s.criaturas = [V];
    V.extincion = extincion;
    const ya = actor("amistosa", 8, 650, 12);
    ya.genoma = JSON.parse(JSON.stringify(H.genoma)); ya.huella = H.huella;
    s.criaturas.push(ya);
    s.avanzar(700);
    return { antes, despues: peligro() };
  };
  const con = probar(true), sin = probar(false);
  afirma(con.antes > 0.2 && sin.antes > 0.2, "tras ser golpeada espera peligro de quien la golpeó");
  afirma(con.despues < 0.5 * con.antes, "con la extinción, 700 s junto a quien se parece a ella y es inofensivo bajan el peligro esperado a menos de la mitad");
  afirma(sin.despues > 0.9 * sin.antes, "sin la extinción casi no baja (solo el olvido de horas)");
}

// 1g. Asustar y premiar actuan sobre el objeto y no solo sobre el verbo: si se la asusta justo despues de tocar la pelota, deja de empujarla tambien
{
  const empujes = (c: Criatura, t0: number, t1: number): number => c.registro.filter((r) => r.kind === "impacto" && r.v === "empujar" && r.tipo === "pelota" && r.t >= t0 && r.t < t1).length;
  let control = 0, asustada = 0, semillasConSusto = 0;
  for (const semilla of [41, 43, 44, 45, 46]) {
    const correr = (susto: boolean) => {
      const s = nuevaSim({ semilla, objetos: [{ tipo: "pelota", x: 600 }], criaturas: [{ genoma: genomaNuevo(semilla), x: 400 }], comedero: { cada: 100, max: 2, tipo: "fruta" } });
      const c = s.criaturas[0];
      s.avanzar(900);
      let ultimo = -1, veces = 0;
      s.ganchos.push(() => {
        const r = [...c.registro].reverse().find((x) => x.kind === "impacto" && x.v === "tocar" && x.tipo === "pelota");
        if (susto && r && r.t !== ultimo && s.t - r.t < 1 && veces === 0) { ultimo = r.t; veces++; c.asustar({ mundo: s.mundo, criaturas: s.criaturas, t: s.t }); }
      });
      s.avanzar(300);
      s.ganchos.length = 0;
      const t1 = s.t;
      s.avanzar(300);
      return { n: empujes(c, t1, s.t), veces };
    };
    const a = correr(false), b = correr(true);
    if (b.veces > 0) { semillasConSusto++; control += a.n; asustada += b.n; }
  }
  afirma(semillasConSusto >= 3 && control >= 20, "(hay al menos 3 criaturas a las que se pudo asustar justo después de tocar la pelota, y sin susto la empujan decenas de veces)");
  afirma(asustada <= 0.35 * control, "si se la asusta justo después de tocar la pelota, deja de empujarla también (el susto es del objeto)");
  const c2 = nuevaSim({ semilla: 41, objetos: [{ tipo: "pelota", x: 600 }], criaturas: [{ genoma: genomaNuevo(41), x: 400 }], comedero: null }).criaturas[0];
  c2.mem.aprender("tocar", [0.9, 0.4, 0.5, 0.4, 0.5, 0.2, 0, 0.5, 0, 0.5], 0.4, [0, 0, 0.3, 0, 0], "pelota", "pelota", 0, undefined, 1);
  c2.registrar({ t: 5, kind: "impacto", v: "tocar", tipo: "pelota", obj: 1, res: [0, 0, 0.3, 0, 0] });
  c2.trazas.push({ v: "tocar", tipo: "pelota", f: [0.9, 0.4, 0.5, 0.4, 0.5, 0.2, 0, 0.5, 0, 0.5], nombre: "pelota", t: 5 } as never);
  c2.recompensar({ mundo: nuevaSim({ semilla: 1, objetos: [], criaturas: [], comedero: null }).mundo, criaturas: [c2], t: 6 });
  afirma(c2.mem.protos.some((p) => p.v === "probar" && p.tipo === "pelota" && p.res[2] > 0.1) && c2.mem.protos.some((p) => p.v === "empujar" && p.tipo === "pelota" && p.res[2] > 0.1), "premiar tras tocar la pelota la vuelve agradable también para probarla y empujarla");
}

// 1h. Modelo de las otras (etapa 1): lleva la cuenta de lo que suele seguir a lo que se ve hacer, y escala el realce con ello
{
  const m = new ModeloAjeno();
  afirma(m.realce("empujar:palanca") === 1, "sin datos el realce vale 1 (como hasta ahora)");
  for (let i = 0; i < 5; i++) { m.verAccion("empujar:palanca", i * 10, 7); m.verAccion("empujar:palanca", i * 10, 7); }
  m.cerrar(100);
  afirma(m.cuenta("empujar:palanca").cerradas === 5, "cada acción vista se cuenta una sola vez");
  afirma(m.realce("empujar:palanca") === 0, "tras cinco acciones sin ningún resultado, el realce de verlas vale 0");
  const b = new ModeloAjeno();
  for (let i = 0; i < 6; i++) { b.verAccion("empujar:palanca2", i * 10, 8); b.verResultado(8, i * 10 + 2); }
  b.cerrar(100);
  afirma(b.realce("empujar:palanca2") === 1 && b.cuenta("empujar:palanca2").exitos === 6, "si a cada acción le sigue un resultado, el realce se mantiene en 1");
  const c = new ModeloAjeno();
  for (let i = 0; i < 6; i++) { c.verAccion("tocar:x", i * 10, 9); if (i < 2) c.verResultado(9, i * 10 + 1); }
  c.cerrar(100);
  afirma(Math.abs(c.realce("tocar:x") - (2 * 2) / 6) < 1e-12, "con un resultado cada tres acciones, el realce es el doble de esa fracción");
  c.verAccion("tocar:x", 200, 9); c.verResultado(9, 300);
  c.cerrar(400);
  afirma(c.cuenta("tocar:x").cerradas === 7 && c.cuenta("tocar:x").exitos === 2, "un resultado fuera del plazo no cuenta");
  afirma(JSON.stringify(ModeloAjeno.desde(c.estado()).estado()) === JSON.stringify(c.estado()), "el modelo se guarda y se restaura igual");
  const cr = new Criatura(1, "A", genomaNuevo(1), 300, 1);
  cr.modelo = new ModeloAjeno();
  cr.modelo.verAccion("empujar:palanca", 3, 1);
  afirma(Criatura.desde(JSON.parse(JSON.stringify(cr.estado())), 1).modelo?.cuenta("empujar:palanca") !== undefined && Criatura.desde(JSON.parse(JSON.stringify(cr.estado())), 1).modelo !== null, "la criatura guarda y restaura su modelo de las otras");
  afirma(new Criatura(1, "A", genomaNuevo(1), 300, 1).modelo === null, "por defecto no hay modelo (apagado)");
  // Lo que se sabe por evidencia cuenta como saber propio: refuerza la confianza propia de una asociacion
  const mem = cr.mem;
  const asoc = mem.aprender("empujar", [0.1, 0.7, 0.7, 0.5, 0.3, 0, 0.2, 0, 0, 0.5], 0.5, [0, 0, 0.2, 0, 0, 0], "palanca", "palanca", 0, undefined, 1, false);
  const propiaAntes = asoc.nProp ?? 0;
  mem.reforzar(asoc, [0, 0, 0, 0, 0, 0], [true, true, true, true, true, true], 1, 5, true);
  afirma((asoc.nProp ?? 0) === propiaAntes + 1 && asoc.res[2] < 0.2, "reforzar con saber propio sube la confianza propia y lleva el resultado hacia lo aprendido (aquí, nada)");
}

// 1i. Especializacion de combate: opcional, y sin ella todo vale lo de siempre
{
  const normal = new Criatura(1, "N", genomaNuevo(21), 300, 21);
  afirma(normal.factorVelocidadEsp() === 1 && normal.factorGolpeEsp() === 1 && normal.factorMetabolismoEsp() === 1 && normal.factorDepredador() === 1 && normal.rutaTerritorial() === 0 && normal.rutaRecursos() === normal.rasgos[2], "sin especialización todos los factores valen exactamente 1, la ruta de recursos es su agresividad y no hay ruta territorial");
  const emb = new Criatura(2, "E", especializar(genomaNuevo(21), "embestidor"), 300, 21);
  afirma(emb.factorGolpeEsp() > 1.3 && emb.factorVelocidadEsp() < 1 && emb.factorMetabolismoEsp() > 1, "un embestidor pega más, es más lento y gasta más");
  const cor = new Criatura(3, "C", especializar(genomaNuevo(21), "corredor"), 300, 21);
  afirma(cor.factorVelocidadEsp() > 1.2 && cor.factorGolpeEsp() < 1 && cor.factorMetabolismoEsp() > 1, "un corredor es más rápido, pega menos y gasta más");
  const mor = new Criatura(4, "M", especializar(genomaNuevo(21), "mordedor"), 300, 21);
  afirma(mor.factorDepredador() > 1.4 && mor.factorGolpeEsp() > 1.3, "un mordedor tiene más interés en cazar y pega más");
  afirma(Object.keys(ESPECIALIZACIONES).length === 6 && Object.values(ESPECIALIZACIONES).every((e) => Object.values(e).every((v) => v >= 0 && v <= 1)), "las seis especializaciones de ejemplo tienen valores entre 0 y 1");
  const g1 = genomaNuevo(31), g2 = genomaNuevo(32);
  afirma(cruzar(g1, g2, 5).especializacion === undefined, "si ninguno de los padres tiene especialización, el hijo tampoco (no sale de la nada)");
  const hijo = cruzar(especializar(g1, "mordedor"), g2, 5);
  afirma(!!hijo.especializacion && Object.values(hijo.especializacion).every((v) => v >= 0 && v <= 1) && JSON.stringify(cruzar(especializar(g1, "mordedor"), g2, 5)) === JSON.stringify(hijo), "con un padre especializado el hijo hereda (con mutaciones pequeñas), dentro de rango y de forma determinista");
  afirma(Criatura.desde(JSON.parse(JSON.stringify(emb.estado())), 21).genoma.especializacion?.craneo === 0.9, "la especialización se guarda y se restaura");
}

// 2. Determinismo y semilla
{
  const a = new Simulacion(cfg(11));
  const b = new Simulacion(cfg(11));
  a.avanzar(600); b.avanzar(600);
  afirma(JSON.stringify(a.serializar()) === JSON.stringify(b.serializar()), "misma semilla, misma vida");
  const c = new Simulacion(cfg(12));
  c.avanzar(600);
  afirma(JSON.stringify(a.serializar()) !== JSON.stringify(c.serializar()), "otra semilla, otra vida");
}

// 3. Guardar y restaurar continua exactamente igual
{
  const a = new Simulacion(cfg(21));
  a.avanzar(420);
  const texto = JSON.stringify(a.serializar());
  const b = Simulacion.restaurar(JSON.parse(texto));
  afirma(JSON.stringify(b.serializar()) === texto, "restaurar devuelve el mismo estado");
  a.avanzar(420); b.avanzar(420);
  afirma(JSON.stringify(a.serializar()) === JSON.stringify(b.serializar()), "tras restaurar, la simulacion sigue igual que sin guardar");
}

// 4. Simulacion fuera de linea, con tope
{
  const a = new Simulacion(cfg(31));
  a.avanzar(300);
  const t0 = a.t;
  const r = a.fueraDeLinea(48 * 3600);
  afirma(r.recortado && Math.abs(r.segundos - AJ.topeFueraDeLinea) < 1, "el tiempo fuera de linea se recorta al tope");
  afirma(Math.abs(a.t - t0 - AJ.topeFueraDeLinea) < 2, "se simula exactamente el tope");
  afirma(a.criaturas[0].vivo && a.criaturas[0].salud > 0, "sigue viva tras 8 horas fuera");
  afirma(r.criaturas[0].sucesos.length <= 5, "el resumen trae pocos sucesos");
  const b = new Simulacion(cfg(32));
  const r2 = b.fueraDeLinea(600);
  afirma(!r2.recortado, "un rato corto no se recorta");
}

// 5. La memoria se difumina, lo importante dura mas, y generaliza
{
  const m = new Memoria(1, 1);
  const f = [0.8, 0.3, 0.95, 0.95, 0, 0, 0.3, 0, 0, 0];
  const g = [0.7, 0.45, 0.9, 0.9, 0.05, 0, 0.3, 0, 0, 0];
  const azul = [0.8, 0.3, 0.95, 0.05, 0.2, 0, 0.3, 0, 0, 0];
  const uno = new Array(10).fill(1);
  m.aprender("presencia", f, 0, [0, 0.6, 0, 0, 0.3], "foco_rojo", "foco rojo", 0, [false, true, false, false, true]);
  m.aprender("tocar", [0.5, 0.5, 0.5, 0.5, 0.5, 0.1, 0, 0, 0, 0], 0, [0, 0, 0.1, 0, 0], "x", "x", 0);
  const pr = m.predecir("presencia", g, uno, 0);
  const pa = m.predecir("presencia", azul, uno, 0);
  afirma(pr.res[C.dano] > 0.5 && pr.conf > pa.conf * 3, "generaliza: una cosa parecida despierta el recuerdo, una distinta casi nada");
  afirma(semejanza(f, g, uno) > 0.5 && semejanza(f, azul, uno) < 0.01, "la semejanza decrece con la diferencia");
  m.olvidar(12 * 3600);
  const peligro = m.protos.find((p) => p.v === "presencia");
  const neutro = m.protos.find((p) => p.v === "tocar");
  afirma(!!peligro && (!neutro || peligro.fuerza > neutro.fuerza), "lo que hizo dano se olvida mas despacio que lo neutro");
  afirma(!!peligro && peligro.fuerza < 0.5, "a las 12 horas sin repetirse ya se ha difuminado");
  m.olvidar(60 * 3600);
  afirma(!m.protos.some((p) => p.v === "tocar"), "lo neutro acaba desapareciendo");
}

// 6. Vive sola
{
  const s = new Simulacion(cfg(41));
  const c = s.criaturas[0];
  let hambreMax = 0;
  s.ganchos.push(() => { hambreMax = Math.max(hambreMax, c.nec[0]); });
  s.avanzar(2400);
  afirma(c.vivo && c.salud > 0.6, "una criatura sola vive 40 minutos con salud");
  afirma(hambreMax < 0.95, "come antes de pasar hambre extrema");
  afirma(c.mem.episodios.length > 2 && c.mem.episodios.every((e) => typeof e.texto === "string" && e.texto.length > 5), "deja una memoria legible");
  afirma(c.mem.episodios.length <= AJ.maxEpisodios, "la memoria de episodios tiene tope");
  afirma(c.rasgos.every((v, i) => v >= 0 && v <= 1 && Math.abs(v - c.base[i]) <= AJ.desarrolloMax + 1e-9), "los rasgos se mantienen cerca de su predisposicion");
  afirma(c.mem.protos.length > 0 && c.mem.protos.length <= AJ.capacidad * c.genoma.memoria + 1, "las asociaciones tienen tope");
  afirma(c.rasgos.length === RASGOS.length, "tiene los 8 rasgos de personalidad");
}

// 7. Gemelos: nacen iguales
{
  const g = genomaNuevo(51);
  const s1 = nuevaSim({ semilla: 5, objetos: [], criaturas: [{ genoma: g, x: 300 }], comedero: null });
  const s2 = nuevaSim({ semilla: 6, objetos: [], criaturas: [{ genoma: clonarGenoma(g), x: 300 }], comedero: null });
  const [a, b] = [s1.criaturas[0], s2.criaturas[0]];
  afirma(JSON.stringify(a.genoma) === JSON.stringify(b.genoma), "los gemelos tienen el mismo genoma");
  afirma(JSON.stringify(a.red.w1) === JSON.stringify(b.red.w1) && JSON.stringify(a.red.w2) === JSON.stringify(b.red.w2), "y los mismos pesos de nacimiento");
  afirma(a.huella !== b.huella, "pero se distinguen entre si (cada una tiene su huella)");
}

// 7b. Todo cae al suelo, tenga masa o no (una palanca soltada en el aire no se queda flotando)
{
  const s = nuevaSim({ semilla: 3, objetos: [], criaturas: [{ genoma: genomaNuevo(3), x: 100 }], comedero: null });
  const palanca = s.mundo.agregar("palanca", 900, { z: 40, vz: 0 });
  const placa = s.mundo.agregar("placa", 1200, { z: 40, vz: 0 });
  const pelota = s.mundo.agregar("pelota", 600, { z: 300, vz: 0 });
  s.avanzar(8);
  afirma(palanca.z === 0 && placa.z === 0, "los objetos fijos soltados en el aire caen al suelo");
  afirma(pelota.z >= 0 && pelota.z < 5, "lo que tiene masa tambien cae y acaba parado");
  afirma(Math.abs(palanca.x - 900) < 0.001, "y lo fijo no se desplaza");
}

// 7c. El comedero se puede apagar
{
  const s = new Simulacion({ semilla: 8, objetos: [], criaturas: [{ genoma: genomaNuevo(8), x: 300 }], comedero: { cada: 20, max: 3, tipo: "fruta" } });
  s.avanzar(200);
  const con = s.mundo.objetos.length;
  s.comedero!.activo = false;
  for (const o of [...s.mundo.objetos]) s.mundo.quitar(o.id);
  s.criaturas[0].nec[0] = 0;
  s.avanzar(200);
  afirma(con > 0 && s.mundo.objetos.length === 0, "con el comedero apagado no cae fruta");
  const r = Simulacion.restaurar(JSON.parse(JSON.stringify(s.serializar())));
  afirma(r.comedero?.activo === false, "el interruptor se guarda y se restaura");
}

// 7d. Ultimo recurso: con mucha hambre y sin otra cosa, se come hasta lo que sienta mal. Con comida sana a mano, no.
{
  const bocados = (conFruta: boolean, semilla: number): { baya: number; fruta: number; primero: string } => {
    const objs = [{ tipo: "baya", x: 700, porciones: 8 }, ...(conFruta ? [{ tipo: "fruta", x: 900 }] : [])];
    const s = nuevaSim({ semilla, objetos: objs, criaturas: [{ genoma: genomaNuevo(semilla), x: 800 }], comedero: null });
    const c = s.criaturas[0];
    // Ya sabe que la baya sienta mal
    c.mem.aprender("probar", [0.6, 0.25, 0.5, 0.85, 0.1, 0.55, 0, 0, 0, 0], 0.4, [0.2, 0.3, 0, 0, 0], "baya", "baya roja", 0, undefined);
    c.mem.aprender("presencia", [0.6, 0.25, 0.5, 0.85, 0.1, 0.55, 0, 0, 0, 0], 0, [0, 0.3, 0, 0, 0.15], "baya", "baya roja", 0, [false, true, false, false, true]);
    c.nec[0] = 0.98;
    s.avanzar(150);
    const primero = c.registro.find((r) => r.kind === "impacto" && r.v === "probar");
    return { baya: impactos(c, "probar", "baya"), fruta: impactos(c, "probar", "fruta"), primero: primero?.tipo ?? "" };
  };
  let ultimoRecurso = 0, prefiereSana = 0;
  for (let sd = 1; sd <= 8; sd++) {
    if (bocados(false, sd).baya >= 1) ultimoRecurso++;
    const con = bocados(true, sd);
    if (con.primero === "fruta") prefiereSana++;
  }
  afirma(ultimoRecurso >= 7, `sin otra comida, se come las bayas aunque sepa que sientan mal (${ultimoRecurso} de 8 semillas)`);
  afirma(prefiereSana >= 7, `con fruta a mano, come primero la fruta (${prefiereSana} de 8 semillas)`);
}

// 7e. Mortalidad configurable: protegida, recuperable y permanente
{
  const hambrienta = (mortalidad: "protegida" | "recuperable" | "permanente") => {
    const s = new Simulacion({ semilla: 12, objetos: [], criaturas: [{ genoma: genomaNuevo(12), x: 500 }], comedero: null, mortalidad });
    const c = s.criaturas[0];
    c.nec[0] = 1; c.salud = 0.1;
    return { s, c };
  };
  {
    const { s, c } = hambrienta("protegida");
    s.avanzar(300);
    afirma(c.vivo && c.salud >= 0.08 && s.legado.length === 0, "protegida: nunca muere");
  }
  {
    const { s, c } = hambrienta("permanente");
    s.avanzar(300);
    afirma(!c.vivo && s.legado.length === 1, "permanente: muere y deja su legado");
    afirma(/hambre/.test(s.legado[0].causa) && s.legado[0].genoma.rasgos.length === 8 && s.legado[0].episodios.length > 0, "el legado guarda la causa, el genoma y su historia");
    const r = Simulacion.restaurar(JSON.parse(JSON.stringify(s.serializar())));
    afirma(!r.criaturas[0].vivo && r.legado.length === 1 && r.mortalidad === "permanente", "la muerte y el legado se guardan y se restauran");
  }
  {
    const { s, c } = hambrienta("recuperable");
    s.avanzar(150);
    afirma(c.vivo && c.incap >= 0 && c.accion === null, "recuperable: queda tendida, no muerta");
    const x = c.x;
    s.avanzar(10);
    afirma(c.x === x, "y no se mueve");
    c.recompensar({ mundo: s.mundo, criaturas: s.criaturas, t: s.t });
    afirma(c.incap < 0 && c.salud > 0.3, "una caricia la reanima");
    c.nec[0] = 1; c.salud = 0.02;
    s.avanzar(120);
    afirma(c.incap >= 0, "y si vuelve a caer");
    s.avanzar(300);
    afirma(!c.vivo && s.legado.length === 1, "tendida demasiado tiempo sin cuidados, muere");
  }
}

// 7f. Herencia: los hijos reciben predisposiciones mezcladas y mutaciones pequenas, no recuerdos
{
  const a = genomaNuevo(61, "A"), b = genomaNuevo(62, "B");
  let dentro = 0, total = 0, igualA = 0, mutados = 0, fuera = 0;
  const medias = [0, 0];
  const hijos = Array.from({ length: 60 }, (_, i) => cruzar(a, b, 1000 + i));
  for (const h of hijos) {
    h.rasgos.forEach((v, i) => {
      const lo = Math.min(a.rasgos[i], b.rasgos[i]), hi = Math.max(a.rasgos[i], b.rasgos[i]);
      total++;
      if (v >= lo - 1e-9 && v <= hi + 1e-9) dentro++; else mutados++;
      if (v === a.rasgos[i] || v === b.rasgos[i]) igualA++;
      if (v < 0.05 - 1e-9 || v > 0.95 + 1e-9) fuera++;
      medias[0] += v;
    });
    medias[1] += 0;
  }
  const mediaHijos = medias[0] / total, mediaPadres = (a.rasgos.reduce((x, y) => x + y, 0) + b.rasgos.reduce((x, y) => x + y, 0)) / 16;
  afirma(dentro / total > 0.7, "la mayoria de los rasgos de un hijo estan entre los de sus padres");
  afirma(mutados > 0 && mutados / total < 0.25, "hay mutaciones, pero pequenas y poco frecuentes");
  afirma(igualA > total * 0.3, "muchos rasgos se heredan tal cual de uno de los padres");
  afirma(fuera === 0, "ningun rasgo sale de su rango");
  afirma(Math.abs(mediaHijos - mediaPadres) < 0.08, "en conjunto no son ni mas fuertes ni mas debiles que sus padres");
  afirma(new Set(hijos.map((h) => Math.round(h.rasgos[0] * 1000))).size > 5, "salen combinaciones nuevas");
  afirma(hijos.every((h) => h.cuerpo.longitudPata! >= 0.8 && h.cuerpo.longitudPata! <= 1.3), "tambien el cuerpo respeta sus rangos");
  // Los padres han vivido: sus rasgos actuales y su memoria no se heredan
  const s = new Simulacion({ semilla: 9, objetos: [{ tipo: "pelota", x: 700 }, { tipo: "fruta", x: 900 }], criaturas: [{ genoma: a, x: 400 }, { genoma: b, x: 600 }], comedero: { cada: 100, max: 2, tipo: "fruta" } });
  s.avanzar(900);
  const [pa, pb] = s.criaturas;
  pa.rasgos[3] = Math.min(1, pa.base[3] + 0.4);
  const hijo = s.nacer(pa, pb);
  afirma(pa.mem.protos.length > 0 && hijo.mem.protos.length === 0 && hijo.mem.episodios.length === 0, "el hijo nace sin recuerdos aunque los padres tengan muchos");
  afirma(JSON.stringify(hijo.rasgos) === JSON.stringify(hijo.genoma.rasgos), "y con el caracter de su genoma, no con el que los padres desarrollaron");
  afirma(hijo.padres.length === 2 && s.criaturas.length === 3, "nace en la sala con sus padres anotados");
  afirma(hijo.generacion === 1 && pa.generacion === 0, "y su generacion es una mas que la de sus padres");
  const s2 = Simulacion.restaurar(JSON.parse(JSON.stringify(s.serializar())));
  afirma(s2.criaturas[2].padres.join() === hijo.padres.join(), "los padres se guardan");
}

// 7b. Meter una criatura vivida en una sala nueva: lo que mira no puede venir del reloj anterior
{
  const semilla = 61;
  const g = genomaNuevo(semilla);
  const vieja = nuevaSim({ semilla, objetos: [{ tipo: "palanca", x: 800 }], criaturas: [{ genoma: g, x: 300 }], comedero: null });
  vieja.criaturas[0].nec[0] = 0.5;
  vieja.avanzar(600);
  const est = vieja.criaturas[0].estado();
  const mirada = (limpiar: boolean): number => {
    const s = nuevaSim({ semilla: semilla + 1, objetos: [{ tipo: "palanca", x: 800 }], criaturas: [{ genoma: genomaNuevo(semilla + 1), x: 300 }], comedero: null });
    s.criaturas[0].nec[0] = 0.5;
    const e = Criatura.desde({ ...est, id: 2, x: 520, accion: null }, 5);
    if (limpiar) e.reiniciarReloj();
    // Una huella de la experta con tiempo del futuro, como si viniera de una sala con 600 s vividos
    else e.ultimoImpacto = { obj: 1, v: "empujar", t: 599, quien: 2 };
    s.criaturas.push(e);
    s.avanzar(120);
    return s.criaturas[0].atencion?.t ?? 0;
  };
  afirma(mirada(false) < 130, "una atencion con tiempo futuro no se queda fijada en la criatura que mira (queda como mucho al reloj de la sala)");
  afirma(mirada(true) < 130, "tras reiniciarReloj no queda nada del reloj anterior");
}

// 7b2. Envidia: con el interruptor apagado no queda rastro (ni estado ni bocados contados) y encendida sobrevive a guardar y restaurar
{
  const montar = (envidia: boolean) => {
    const s = nuevaSim({ semilla: 91, objetos: [], criaturas: [{ genoma: genomaNuevo(11), x: 400 }, { genoma: genomaNuevo(12), x: 600 }], comedero: { cada: 40, max: 2, tipo: "fruta" } });
    s.criaturas[0].envidia = envidia;
    s.avanzar(900);
    return s;
  };
  const apagada = montar(false);
  afirma(apagada.criaturas[0].envidiaEstado.length === 0 && Object.keys(apagada.criaturas[0].vistoBocado).length === 0, "con la envidia apagada no hay estado ni bocados contados");
  const encendida = montar(true);
  const r = Simulacion.restaurar(encendida.serializar());
  afirma(r.criaturas[0].envidia === true && JSON.stringify(r.criaturas[0].envidiaEstado) === JSON.stringify(encendida.criaturas[0].envidiaEstado) && JSON.stringify(r.criaturas[0].vistoBocado) === JSON.stringify(encendida.criaturas[0].vistoBocado), "la envidia se guarda y se restaura igual");
}

// 7c. Camadas: casi siempre una cria, a veces dos o tres, cada una con su propio genoma (mellizos, no gemelos identicos)
{
  const s = nuevaSim({ semilla: 77, objetos: [], criaturas: [{ genoma: genomaNuevo(1), x: 300 }, { genoma: genomaNuevo(2), x: 500 }], comedero: null });
  const [a, b] = s.criaturas;
  const cuenta = [0, 0, 0, 0];
  for (let i = 0; i < 3000; i++) {
    s.t = i;
    cuenta[s.tamanoCamada(a, b)]++;
  }
  afirma(cuenta[1] / 3000 > 0.74 && cuenta[1] / 3000 < 0.86, `una cria en el 80 % de las camadas (sale ${(cuenta[1] / 30).toFixed(0)} %)`);
  afirma(cuenta[2] / 3000 > 0.12 && cuenta[2] / 3000 < 0.22, `dos crias en el 17 % (sale ${(cuenta[2] / 30).toFixed(0)} %)`);
  afirma(cuenta[3] > 0 && cuenta[3] / 3000 < 0.06, `tres crias pocas veces (sale ${(cuenta[3] / 30).toFixed(1)} %)`);
  // Una camada de tres: no son clones entre si y respeta el hueco
  s.t = 0;
  let camada: Criatura[] = [];
  for (let t = 0; t < 400 && camada.length < 3; t++) { s.t = t; camada = s.parir(a, b, 3); if (camada.length < 3) for (const h of camada) s.criaturas.splice(s.criaturas.indexOf(h), 1); }
  afirma(camada.length === 3, "se encuentra una camada de tres");
  afirma(new Set(camada.map((h) => h.genoma.semillaCerebro)).size === 3, "los mellizos tienen genomas distintos (no son gemelos identicos)");
  afirma(camada.every((h) => h.padres[0] === a.id && h.padres[1] === b.id && h.generacion === 1), "todos descienden de la misma pareja");
  afirma(s.parir(a, b, 0).length === 0 && s.parir(a, b, 1).length <= 1, "no se pasa del hueco de la sala");
  // El sexo: sobre la mitad de cada uno
  let unos = 0;
  for (let i = 0; i < 400; i++) unos += sexoDe(genomaNuevo(i + 100));
  afirma(unos > 160 && unos < 240, `el sexo reparte sobre la mitad (sale ${unos} de 400)`);
}

// 7d. Simulaciones calentadas: una copia por replica, cada una con su azar y sin tocar a las demas, y construir solo una vez por clave
{
  let veces = 0;
  const construir = () => { veces++; const s = nuevaSim({ semilla: 33, objetos: [], criaturas: [{ genoma: genomaNuevo(1), x: 300 }, { genoma: genomaNuevo(2), x: 500 }], comedero: { cada: 60, max: 2, tipo: "fruta" } }); s.avanzar(200); return s; };
  const a = calentada("prueba", construir, 1);
  const b = calentada("prueba", construir, 2);
  a.criaturas[0].x = 900;
  afirma(veces === 1, "una simulacion calentada se construye una sola vez por clave");
  afirma(a.t === b.t && b.criaturas[0].x !== 900, "cada copia es independiente de las demas y parte del mismo instante");
}

// 8. Los casos de exito del documento de diseno, con varias semillas y control
const SEMILLAS = Array.from({ length: Number(process.env.N ?? 10) }, (_, i) => i + 1);
for (const caso of CASOS) {
  const obligatorio = CASOS_OBLIGATORIOS.includes(caso.id);
  // RAPIDA=1: solo los casos obligatorios (son los unicos que cuentan comprobaciones). Los informativos se miran aparte con tests/vida-lab.ts, o sin esta variable cuando se toca algo que los afecta a todos
  if (process.env.RAPIDA && !obligatorio) continue;
  const t0 = Date.now();
  const inf = ejecutarCaso(caso, SEMILLAS);
  console.log(tablaInforme(inf), `(${((Date.now() - t0) / 1000).toFixed(1)} s)${obligatorio ? "" : "  [informativo: no es obligatorio en esta fase]"}`);
  if (obligatorio) {
    afirma(inf.pasa, `caso ${caso.id} ${caso.titulo}: ${inf.aprobadas}/${SEMILLAS.length} semillas (se piden ${Math.ceil(caso.minimo * SEMILLAS.length)})`);
    afirma(inf.resultados.every((r) => Object.keys(r.criterios).length >= 3), `caso ${caso.id}: cada semilla se juzga con al menos 3 criterios`);
    afirma(inf.resultados.every((r) => Object.keys(r.acciones).length > 0), `caso ${caso.id}: queda registro de acciones`);
  }
}

console.log(`${ok} comprobaciones bien, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
void C;
