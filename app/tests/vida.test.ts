import { Red } from "../src/vida/nucleo/red.ts";
import { Simulacion } from "../src/vida/nucleo/simulacion.ts";
import { genomaNuevo, clonarGenoma, cruzar } from "../src/vida/nucleo/genoma.ts";
import { AJ } from "../src/vida/nucleo/ajustes.ts";
import { Memoria, semejanza } from "../src/vida/nucleo/memoria.ts";
import { Criatura, NI } from "../src/vida/nucleo/criatura.ts";
import { C, NC, RASGOS } from "../src/vida/nucleo/tipos.ts";
import { CASOS, CASOS_OBLIGATORIOS } from "../src/vida/lab/casos.ts";
import { ejecutarCaso, impactos, nuevaSim, tablaInforme } from "../src/vida/lab/laboratorio.ts";

let fallos = 0, ok = 0;
const afirma = (c: boolean, m: string) => { if (c) ok++; else { fallos++; console.log("FALLA:", m); } };

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

// 8. Los casos de exito del documento de diseno, con varias semillas y control
const SEMILLAS = Array.from({ length: Number(process.env.N ?? 10) }, (_, i) => i + 1);
for (const caso of CASOS) {
  const obligatorio = CASOS_OBLIGATORIOS.includes(caso.id);
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
