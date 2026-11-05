/* Los casos de exito de inteligencia artificial del documento de diseno (docs/vida-artificial-diseno.md), como experimentos.
   Implementados: 01 a 04 (un individuo aprende), 04b (generalización), 13 (gemelos) y 05 (partido improvisado, preparado).
   Cada uno usa varias semillas y un control. Los criterios estan escritos para que no se cumplan por casualidad. */

import { C, DIA, E, R, type Verbo } from "../nucleo/tipos.ts";
import { clonarGenoma, cruzar, sexoDe, type Genoma } from "../nucleo/genoma.ts";
import { CATALOGO } from "../nucleo/catalogo.ts";
import { Azar, mezclar } from "../nucleo/azar.ts";
import { semejanza } from "../nucleo/memoria.ts";
import { featuresCriatura } from "../nucleo/conducta.ts";
import { Criatura, type Registro } from "../nucleo/criatura.ts";
import { Simulacion } from "../nucleo/simulacion.ts";
import { avanzarMuestreando, conteoAcciones, genomaDe, impactos, media, mediana, nuevaSim, replica, type Caso, type ResSemilla } from "./laboratorio.ts";

const UNOS = new Array<number>(10).fill(1);
const rasgosDe = (tipo: string): number[] => [...CATALOGO[tipo].f, 0, 0, 0];
const manip = (c: Criatura, tipo: string, t0 = 0, t1 = Infinity) => impactos(c, "empujar", tipo, t0, t1) + impactos(c, "tocar", tipo, t0, t1);
const esperado = (c: Criatura, v: "probar" | "empujar" | "tocar", tipo: string, canal: number): number => c.mem.predecir(v, rasgosDe(tipo), UNOS, 0.5).res[canal];

function resultado(semilla: number, criterios: Record<string, boolean>, metricas: Record<string, number>, c: Criatura | null, segundos: number, curvas: ResSemilla["curvas"] = {}): ResSemilla {
  return { semilla, ok: Object.values(criterios).every(Boolean), criterios, metricas, acciones: c ? conteoAcciones(c) : {}, curvas, segundos };
}

/** Segundos hasta que la criatura esta a menos de `radio` de `x` (o `tope` si nunca llega). */
function tiempoHasta(s: Simulacion, c: Criatura, x: number, radio: number, tope: number): number {
  const t0 = s.t;
  let llego = tope;
  let hecho = false;
  const g = (q: Simulacion) => { if (!hecho && Math.abs(c.x - x) < radio) { hecho = true; llego = q.t - t0; } };
  s.ganchos.push(g);
  s.avanzar(tope);
  s.ganchos.splice(s.ganchos.indexOf(g), 1);
  return llego;
}

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso01: Caso = {
  id: "01",
  titulo: "El descubrimiento de la pelota",
  hipotesis: "Una criatura que nunca vio una pelota descubre que puede empujarla, se divierte y acaba yendo a buscarla por iniciativa propia. Con una bola atornillada (igual de redonda, que no se mueve) el interés se apaga.",
  minimo: 0.8,
  ejecutar(semilla) {
    const g = genomaDe(semilla);
    const montar = (tipo: string) => nuevaSim({ semilla, objetos: [{ tipo, x: 800 }], criaturas: [{ genoma: g, x: 250 }], comedero: { cada: 120, max: 2, tipo: "fruta" } });
    const A = montar("pelota");
    const cA = A.criaturas[0];
    const curva = avanzarMuestreando(A, 960, 60, () => esperado(cA, "empujar", "pelota", C.diversion));
    const B = montar("bola_fija");
    B.avanzar(960);
    const cB = B.criaturas[0];

    const primeros = manip(cA, "pelota", 0, 480);
    const sostenido = manip(cA, "pelota", 480, 960);
    const fija = manip(cB, "bola_fija", 480, 960);
    const aprendido = esperado(cA, "empujar", "pelota", C.diversion);

    // Iniciativa: la pelota está lejos y fuera de la vista. Quien la vio hace un momento sabe donde esta; quien no, tiene que encontrarla explorando.
    // Se repite con 5 replicas de cada una (mismo pasado, distinto azar) y se comparan las medianas.
    const bola = A.mundo.objetos.find((o) => o.tipo === "pelota")!;
    A.comedero = null;
    for (const o of A.mundo.objetos.filter((q) => q.tipo !== "pelota")) A.mundo.quitar(o.id);
    bola.x = 1400; bola.vx = 0;
    cA.x = 1300; cA.accion = null; cA.nec[3] = 0; cA.nec[0] = 0;
    const prep = (s: Simulacion) => { const c = s.criaturas[0]; c.nec[3] = 0.8; c.nec[0] = 0.1; c.nec[1] = 0.1; c.x = 100; c.accion = null; return c; };
    const alejar = (s: Simulacion) => { const c = s.criaturas[0]; c.nec[3] = 0; c.accion = null; s.avanzar(1.5); return prep(s); };
    const tL = mediana([0, 1, 2, 3, 4].map((k) => { const s = replica(A, k); return tiempoHasta(s, alejar(s), 1400, 70, 150); }));
    const tN = mediana([0, 1, 2, 3, 4].map((k) => {
      const s = nuevaSim({ semilla: mezclar(semilla, 55, k), objetos: [{ tipo: "pelota", x: 1400 }], criaturas: [{ genoma: g, x: 100 }], comedero: null });
      return tiempoHasta(s, prep(s), 1400, 70, 150);
    }));

    return resultado(semilla, {
      "la descubre y la empuja (primeros 8 min)": primeros >= 1,
      "sigue jugando con ella (segundos 8 min)": sostenido >= 6,
      "aprende que empujarla divierte": aprendido > 0.3,
      "con la bola atornillada el interés baja a la mitad o menos": fija <= sostenido * 0.5,
      "va a buscarla sin verla (<= 90 s) y antes que quien no la conoce": tL <= 90 && tL < tN,
    }, { empujones_1: primeros, empujones_2: sostenido, empujones_bola_fija: fija, esperaDiversion: aprendido, tBusca: tL, tBuscaSinExperiencia: tN }, cA, 960, { "diversion esperada de empujar": curva });
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso02: Caso = {
  id: "02",
  titulo: "La asociación del alimento",
  hipotesis: "Una criatura hambrienta prueba un alimento nuevo, aprende que quita el hambre y después lo busca aunque no lo vea ni lo huela. Quien nunca lo ha probado tarda más en encontrarlo.",
  minimo: 0.8,
  ejecutar(semilla) {
    const g = genomaDe(semilla);
    const S = nuevaSim({ semilla, objetos: [{ tipo: "fruta", x: 1420 }, { tipo: "fruta", x: 1480 }], criaturas: [{ genoma: g, x: 650 }], comedero: null });
    const c = S.criaturas[0];
    c.nec[0] = 0.6;
    S.avanzar(240);
    const bocados = impactos(c, "probar", "fruta");
    const sacia = esperado(c, "probar", "fruta", C.sacia);

    // Mas tarde: vuelve a tener hambre. La fruta esta al fondo, dónde la vio hace un momento, lejos y sin que la huela
    for (const o of [...S.mundo.objetos]) S.mundo.quitar(o.id);
    S.avanzar(30);
    S.mundo.agregar("fruta", 1420);
    S.mundo.agregar("fruta", 1480);
    c.x = 1350; c.accion = null; c.nec[0] = 0.05;
    const prep = (s: Simulacion) => { const k = s.criaturas[0]; k.x = 40; k.accion = null; k.nec[0] = 0.8; k.nec[3] = 0.2; return k; };
    const alejar = (s: Simulacion) => { s.criaturas[0].accion = null; s.avanzar(1.5); return prep(s); };
    const primerBocado = (s: Simulacion, k: Criatura) => {
      const ant = impactos(k, "probar", "fruta");
      const t0 = s.t;
      let t = 150;
      s.ganchos.push((q) => { if (t === 150 && impactos(k, "probar", "fruta") > ant) t = q.t - t0; });
      s.avanzar(150);
      return t;
    };
    const tL = mediana([0, 1, 2, 3, 4].map((k) => { const s = replica(S, k); return primerBocado(s, alejar(s)); }));
    const tN = mediana([0, 1, 2, 3, 4].map((k) => {
      const s = nuevaSim({ semilla: mezclar(semilla, 56, k), objetos: [{ tipo: "fruta", x: 1420 }, { tipo: "fruta", x: 1480 }], criaturas: [{ genoma: g, x: 40 }], comedero: null });
      return primerBocado(s, prep(s));
    }));

    // Eleccion entre un alimento bueno y uno que sienta mal, tras haberlos probado
    const D = nuevaSim({ semilla, objetos: [{ tipo: "fruta", x: 700 }, { tipo: "baya", x: 900, porciones: 8 }], criaturas: [{ genoma: g, x: 800 }], comedero: null });
    const cD = D.criaturas[0];
    cD.nec[0] = 0.6;
    D.avanzar(400);
    const malaBaya = esperado(cD, "probar", "baya", C.dano);
    const aprendeBaya = impactos(cD, "probar", "baya") === 0 || malaBaya > 0.15;

    return resultado(semilla, {
      "prueba el alimento nuevo (4 min)": bocados >= 1,
      "aprende que quita el hambre": sacia > 0.25,
      "lo busca sin verlo y lo encuentra en <= 90 s": tL <= 90,
      "lo encuentra antes que quien nunca lo probó": tL < tN,
      "si algo le sienta mal, lo aprende (o no lo prueba)": aprendeBaya,
    }, { bocados, sacia, tBusca: tL, tBuscaSinExperiencia: tN, malaBaya }, c, 240);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso03: Caso = {
  id: "03",
  titulo: "La máquina accidental",
  hipotesis: "Una palanca suelta un granulo de comida poco después de tocarla. La criatura descubre sin instrucciones que tocarla trae comida y repite la accion cuando la necesita. Con una palanca estropeada (se mueve y suena, pero no suelta nada) eso no ocurre.",
  minimo: 0.8,
  ejecutar(semilla) {
    const g = genomaDe(semilla);
    const montar = (tipo: string) => {
      const s = nuevaSim({ semilla, objetos: [{ tipo, x: 800 }], criaturas: [{ genoma: g, x: 300 }], comedero: null });
      s.criaturas[0].nec[0] = 0.5;
      return s;
    };
    const medir = (s: Simulacion) => {
      const c = s.criaturas[0];
      const hambre: number[] = [];
      s.ganchos.push((q) => { if (q.t > 450 && Math.round(q.t * 4) % 20 === 0) hambre.push(c.nec[0]); });
      const curva = avanzarMuestreando(s, 900, 60, () => esperado(c, "tocar", "palanca", C.sacia));
      return { c, hambre: media(hambre), curva };
    };
    const A = medir(montar("palanca"));
    const B = medir(montar("palanca_rota"));
    const cA = A.c;
    const cB = B.c;
    const comeMitad1 = impactos(cA, "probar", "granulo", 0, 450);
    const comeTodo = impactos(cA, "probar", "granulo");
    const comeControl = impactos(cB, "probar", "granulo");
    const saciaA = Math.max(esperado(cA, "tocar", "palanca", C.sacia), esperado(cA, "empujar", "palanca", C.sacia));
    const saciaB = Math.max(esperado(cB, "tocar", "palanca_rota", C.sacia), esperado(cB, "empujar", "palanca_rota", C.sacia));
    const pulsA = manip(cA, "palanca");

    return resultado(semilla, {
      "descubre la palanca y come de ella (7 min)": comeMitad1 >= 1,
      "repite: come al menos 3 granulos": comeTodo >= 3,
      "aprende que tocarla trae comida": saciaA > 0.1,
      "con la palanca estropeada no aprende eso": saciaB < 0.06 && comeControl === 0,
      "pasa menos hambre que con la palanca estropeada": A.hambre < B.hambre - 0.08,
    }, { pulsaciones: pulsA, granulos: comeTodo, esperaSacia: saciaA, esperaSaciaControl: saciaB, hambreMedia: A.hambre, hambreMediaControl: B.hambre }, cA, 900, { "comida esperada al tocar la palanca": A.curva });
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso03b: Caso = {
  id: "03b",
  titulo: "La palanca que se agota",
  hipotesis: "Repetir lo mismo entretiene cada vez menos, y el interés vuelve tras un descanso. Dos criaturas bien alimentadas no se pasan la hora pulsando la palanca, pero una que da de comer sigue usándose cuando hace falta.",
  minimo: 0.8,
  ejecutar(semilla) {
    const gA = genomaDe(semilla, 31);
    const gB = genomaDe(semilla, 32);
    // Una pareja con una palanca que funciona, durante 15 minutos: antes de la habituacion pulsaban cientos de veces
    const P = nuevaSim({ semilla, objetos: [{ tipo: "palanca", x: 800 }], criaturas: [{ genoma: gA, x: 300 }, { genoma: gB, x: 400 }], comedero: null });
    P.criaturas.forEach((c) => (c.nec[0] = 0.5));
    const tramos: number[] = [];
    for (let i = 0; i < 3; i++) { P.avanzar(300); tramos.push(media(P.criaturas.map((c) => manip(c, "palanca", i * 300, (i + 1) * 300)))); }
    const ultimos = media(tramos);
    // El cansancio de la palanca se recupera con el descanso: se la retira 2 minutos
    const pal = P.mundo.objetos.find((o) => o.tipo === "palanca")!;
    const cansada = Math.max(...P.criaturas.map((c) => c.cansancioDe(pal.id)));
    P.mundo.quitar(pal.id);
    P.avanzar(120);
    const descansada = Math.max(...P.criaturas.map((c) => c.cansancioDe(pal.id)));
    // Una sola criatura: la palanca le sirve de verdad
    const W = nuevaSim({ semilla, objetos: [{ tipo: "palanca", x: 800 }], criaturas: [{ genoma: gA, x: 300 }], comedero: null });
    const cW = W.criaturas[0];
    cW.nec[0] = 0.5;
    const hambre: number[] = [];
    W.ganchos.push((q) => { if (Math.round(q.t * 4) % 20 === 0) hambre.push(cW.nec[0]); });
    W.avanzar(900);
    const granulos = impactos(cW, "probar", "granulo");
    // Y cuando vuelve a tener mucha hambre, la usa
    for (const o of [...W.mundo.objetos]) if (o.tipo !== "palanca") W.mundo.quitar(o.id);
    cW.nec[0] = 0.9;
    const t0 = W.t;
    W.avanzar(120);
    const conHambre = manip(cW, "palanca", t0, t0 + 120);
    return resultado(semilla, {
      "dos criaturas con una palanca que funciona no la pulsan sin parar (menos de 70 veces cada 5 minutos)": ultimos < 70,
      "tras dejarla un rato, el cansancio de repetirla se ha ido (< 0,05)": descansada < 0.05 && cansada > descansada,
      "una sola criatura la usa y come (>= 3 granulos)": granulos >= 3,
      "y pasa poca hambre (media < 0,45)": media(hambre) < 0.45,
      "con mucha hambre vuelve a pulsarla (>= 3 veces en 2 minutos)": conHambre >= 3,
    }, { pulsacionesPorCriaturaCada5min: ultimos, cansancioTrasUsarla: cansada, cansancioTrasDescansar: descansada, granulos, hambreMedia: media(hambre), pulsacionesConHambre: conHambre }, cW, 900);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

const ZONA = 200;

export const caso04: Caso = {
  id: "04",
  titulo: "El recuerdo del peligro",
  hipotesis: "Una criatura que sufre descargas en una placa evita después esa zona aunque la placa ya no esté, y también la placa si vuelve a aparecer apagada. Quien pisa una placa que no descarga no la evita.",
  minimo: 0.8,
  ejecutar(semilla) {
    const g = genomaDe(semilla);
    const probar = (peligrosa: boolean) => {
      const s = nuevaSim({ semilla, objetos: [{ tipo: "placa", x: 900, activo: peligrosa }], criaturas: [{ genoma: g, x: 900 }], comedero: { cada: 100, max: 2, tipo: "fruta" } });
      const c = s.criaturas[0];
      s.avanzar(150);
      const dolores = c.mem.episodios.filter((e) => e.val < -0.2).length;
      const placa = s.mundo.objetos.find((o) => o.tipo === "placa")!;
      s.mundo.quitar(placa.id);
      // Sin la placa: cuanto tiempo pasa en la zona
      let enZona = 0;
      let pasos = 0;
      const g1 = (q: Simulacion) => { pasos++; if (Math.abs(c.x - 900) < ZONA / 2) enZona++; q.t; };
      s.ganchos.push(g1);
      s.avanzar(600);
      s.ganchos.splice(s.ganchos.indexOf(g1), 1);
      const fraccionSinPlaca = enZona / pasos;
      // La placa vuelve, apagada: ¿se acerca?
      const p2 = s.mundo.agregar("placa", 900, { activo: false });
      void p2;
      enZona = 0; pasos = 0;
      let minDist = 9999;
      const g2 = () => { pasos++; if (Math.abs(c.x - 900) < ZONA / 2) enZona++; minDist = Math.min(minDist, Math.abs(c.x - 900)); };
      s.ganchos.push(g2);
      s.avanzar(300);
      return { c, dolores, fraccionSinPlaca, fraccionConPlaca: enZona / pasos, minDist, sim: s };
    };
    const T = probar(true);
    const K = probar(false);
    return resultado(semilla, {
      "sufre la descarga": T.dolores >= 1,
      "con la placa descargando no hay duda: el control no sufre": K.dolores === 0,
      "evita la zona sin la placa (menos de la mitad que el control)": T.fraccionSinPlaca <= K.fraccionSinPlaca * 0.5,
      "evita la placa apagada (menos de la mitad que el control)": T.fraccionConPlaca <= K.fraccionConPlaca * 0.5 || T.minDist > K.minDist + 120,
    }, { zonaTratada: T.fraccionSinPlaca, zonaControl: K.fraccionSinPlaca, placaTratada: T.fraccionConPlaca, placaControl: K.fraccionConPlaca, distMinTratada: T.minDist, distMinControl: K.minDist }, T.c, 1050);
  },
};

export const caso04b: Caso = {
  id: "04b",
  titulo: "Generalización del peligro",
  hipotesis: "Una criatura que recibió una descarga de un foco rojo evita después otro foco rojo que nunca tocó, pero no uno azul. Quien no recibió la descarga no tiene esa preferencia.",
  minimo: 0.8,
  ejecutar(semilla) {
    const g = genomaDe(semilla);
    const ladoRojo = semilla % 2 === 0 ? 1100 : 500;
    const ladoAzul = 1600 - ladoRojo;
    const prueba = (descarga: boolean) => {
      const s = nuevaSim({ semilla, objetos: [{ tipo: descarga ? "foco_rojo" : "foco_rojo_b", x: 800 }], criaturas: [{ genoma: g, x: 700 }], comedero: { cada: 100, max: 2, tipo: "fruta" } });
      const c = s.criaturas[0];
      // Se la expone al foco hasta que lo toca (o se le deja tocarlo igual, en el control)
      let tocado = false;
      const t0 = s.t;
      while (s.t - t0 < 400 && !tocado) { s.avanzar(1); tocado = impactos(c, null, "foco_rojo") + impactos(c, null, "foco_rojo_b") > 0; }
      s.avanzar(60);
      // Prueba: se quita el foco que conocia y se ponen otro rojo (que no conoce) y uno azul, a la misma distancia. 4 replicas con distinto azar.
      let nr = 0, na = 0;
      for (let k = 0; k < 4; k++) {
        const r = replica(s, k);
        const cr = r.criaturas[0];
        for (const o of [...r.mundo.objetos.filter((q) => q.tipo.startsWith("foco"))]) r.mundo.quitar(o.id);
        const rojo = r.mundo.agregar("foco_rojo_b", ladoRojo);
        const azul = r.mundo.agregar("foco_azul", ladoAzul);
        cr.x = 800; cr.accion = null;
        r.ganchos.push(() => { if (Math.abs(cr.x - rojo.x) < 60) nr++; if (Math.abs(cr.x - azul.x) < 60) na++; });
        r.avanzar(240);
      }
      return { c, tocado, parteRojo: nr + na > 8 ? nr / (nr + na) : 0.5 };
    };
    const T = prueba(true);
    const K = prueba(false);
    // El foco rojo grande se parece al rojo del choque y no al azul
    const sRojo = semejanza(rasgosDe("foco_rojo"), rasgosDe("foco_rojo_b"), UNOS);
    const sAzul = semejanza(rasgosDe("foco_rojo"), rasgosDe("foco_azul"), UNOS);
    return resultado(semilla, {
      "recibe la descarga del foco rojo": T.tocado,
      "se parece más al rojo que al azul (comprobación de la prueba)": sRojo > sAzul * 20,
      "pasa menos tiempo junto al foco rojo nuevo que junto al azul": T.parteRojo <= 0.45,
      "más que quien no recibió la descarga": T.parteRojo < K.parteRojo - 0.1,
    }, { parteRojoTratada: T.parteRojo, parteRojoControl: K.parteRojo }, T.c, 860);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

/** Pruebas de conducta iguales para todos: se coloca a la criatura (con lo que ha vivido) ante una eleccion y se ve que hace.
    Cada prueba se repite 16 veces con distinto azar, asi el resultado es una probabilidad y no un golpe de suerte.
      1. Entre una pelota y una palanca, con que juega primero.
      2. Entre un foco rojo y uno azul (ninguno descarga), junto a cual pasa más tiempo.
      3. Con una placa apagada en el suelo, cuanto se mantiene lejos de ella. */
export function perfil(c: Criatura, semilla: number, variante: number): number[] {
  const REPS = 16;
  const preparar = (objetos: { tipo: string; x: number; activo?: boolean }[], r: number, hambre: number) => {
    const s = nuevaSim({ semilla: mezclar(semilla, 900, variante, r), objetos, criaturas: [{ genoma: clonarGenoma(c.genoma), x: 800 }], comedero: null });
    const t = Criatura.desde({ ...c.estado(), x: 800, accion: null, id: 1 }, mezclar(semilla, 901, variante, r));
    t.azar.s = mezclar(semilla, 902, variante, r);
    t.reiniciarReloj();
    t.habito = {};
    t.capRegistro = 100000;
    t.nec = [hambre, 0.2, 0, 0.6, 0.3];
    t.mem.avist = [];
    s.criaturas[0] = t;
    return { s, t };
  };
  let pelota = 0;
  let rojo = 0;
  let lejos = 0;
  for (let r = 0; r < REPS; r++) {
    // 1
    {
      const { s, t } = preparar([{ tipo: "pelota", x: 550 }, { tipo: "palanca", x: 1050 }], r, 0.5);
      s.avanzar(90);
      const primero = t.registro.find((q) => q.kind === "impacto" && (q.tipo === "pelota" || q.tipo === "palanca"));
      pelota += primero ? (primero.tipo === "pelota" ? 1 : 0) : 0.5;
    }
    // 2
    {
      const { s, t } = preparar([{ tipo: "foco_rojo_b", x: 550 }, { tipo: "foco_azul", x: 1050 }], r, 0.2);
      let nr = 0, na = 0;
      s.ganchos.push(() => { if (Math.abs(t.x - 550) < 100) nr++; if (Math.abs(t.x - 1050) < 100) na++; });
      s.avanzar(90);
      rojo += nr + na > 6 ? nr / (nr + na) : 0.5;
    }
    // 3
    {
      const { s, t } = preparar([{ tipo: "placa", x: 800, activo: false }], r, 0.2);
      t.x = 800;
      let cerca = 0, pasos = 0;
      s.ganchos.push(() => { pasos++; if (Math.abs(t.x - 800) < 110) cerca++; });
      s.avanzar(90);
      lejos += 1 - cerca / pasos;
    }
  }
  return [pelota / REPS, rojo / REPS, lejos / REPS];
}

const dist = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0));

export const caso13: Caso = {
  id: "13",
  titulo: "Los gemelos",
  hipotesis: "Dos criaturas con el mismo genoma, criadas en habitaciones distintas, acaban comportándose distinto y esa diferencia se explica por lo que vivieron. Dos gemelos criados igual se parecen mucho más entre sí.",
  minimo: 0.8,
  ejecutar(semilla) {
    const g = genomaDe(semilla, 13);
    const crianza = (objetos: { tipo: string; x: number }[], variante: number) => {
      const s = nuevaSim({ semilla: mezclar(semilla, 130, variante), objetos, criaturas: [{ genoma: clonarGenoma(g), x: 300 }], comedero: { cada: 110, max: 2, tipo: "fruta" } });
      s.avanzar(1500);
      return s.criaturas[0];
    };
    const salaJuego = [{ tipo: "pelota", x: 650 }, { tipo: "foco_azul", x: 1100 }];
    const salaMaquina = [{ tipo: "palanca", x: 650 }, { tipo: "foco_rojo", x: 1100 }, { tipo: "placa", x: 1350 }];
    const A = crianza(salaJuego, 1);
    const B = crianza(salaMaquina, 2);
    const A2 = crianza(salaJuego, 3);
    // Misma herencia
    const mismoGenoma = JSON.stringify(A.genoma) === JSON.stringify(B.genoma);
    const pA = perfil(A, semilla, 1);
    const pB = perfil(B, semilla, 1);
    const pA2 = perfil(A2, semilla, 1);
    const dAB = dist(pA, pB);
    const dAA = dist(pA, pA2);
    const miedoDif = Math.abs(A.rasgos[3] - B.rasgos[3]);
    // La diferencia se explica: la memoria de cada una contiene su propia historia
    const textoA = A.mem.episodios.map((e) => e.texto).join(" ");
    const textoB = B.mem.episodios.map((e) => e.texto).join(" ");
    const explica = /pelota/.test(textoA) && !/palanca/.test(textoA) && /palanca|foco rojo/.test(textoB) && !/pelota/.test(textoB);
    return resultado(semilla, {
      "mismo genoma y mismos pesos de nacimiento": mismoGenoma && JSON.stringify(A.red.estado().semilla) === JSON.stringify(B.red.estado().semilla),
      "sus conductas se separan claramente (distancia > 0.5)": dAB > 0.5,
      "más que dos gemelos criados igual (el doble o mas)": dAB > dAA * 2,
      "sus rasgos de caracter ya no son iguales": miedoDif > 0.02 || Math.abs(A.rasgos[0] - B.rasgos[0]) > 0.02,
      "la diferencia se explica por su historia (memoria)": explica,
    }, { distanciaGemelos: dAB, distanciaMismaCrianza: dAA, miedoDif }, A, 1500);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

/** Pulsaciones sobre la pelota, ordenadas en el tiempo, con quien las hizo. */
function empujones(cs: { id: number; registro: Registro[] }[], desde: number, tipo = "pelota"): { t: number; id: number }[] {
  const out: { t: number; id: number }[] = [];
  for (const c of cs) for (const r of c.registro) if (r.kind === "impacto" && r.v === "empujar" && r.tipo === tipo && r.t >= desde) out.push({ t: r.t, id: c.id });
  return out.sort((a, b) => a.t - b.t);
}

/** Cuantas veces el empujon lo da una criatura distinta a la anterior, poco después (turnos), y la racha mas larga. */
export function turnos(seq: { t: number; id: number }[], ventana = 8): { alternan: number; pares: number; racha: number } {
  let alternan = 0;
  let pares = 0;
  let racha = 0;
  let mejor = 0;
  for (let i = 1; i < seq.length; i++) {
    if (seq[i].t - seq[i - 1].t > ventana) { racha = 0; continue; }
    pares++;
    if (seq[i].id !== seq[i - 1].id) { alternan++; racha++; mejor = Math.max(mejor, racha); } else racha = 0;
  }
  return { alternan, pares, racha: mejor };
}

/** Cuanto tarda una en empujar tras un empujon de la otra (mediana, en s) y cuantos turnos seguidos dura cada racha de alternancia. */
export function ritmo(seq: { t: number; id: number }[], ventana = 8): { latencia: number; rachas: number[] } {
  const lat: number[] = [];
  const rachas: number[] = [];
  let n = 0;
  for (let i = 1; i < seq.length; i++) {
    const dt = seq[i].t - seq[i - 1].t;
    if (dt <= ventana && seq[i].id !== seq[i - 1].id) { lat.push(dt); n++; } else { if (n > 0) rachas.push(n); n = 0; }
  }
  if (n > 0) rachas.push(n);
  return { latencia: lat.length ? mediana(lat) : ventana, rachas };
}

/** Cuanto se responden: cuantas veces un empujon de una cae poco después de uno de la otra. */
function respuestas(a: number[], b: number[], ventana: number): number {
  let n = 0;
  for (const x of a) for (const y of b) if (Math.abs(x - y) <= ventana && x !== y) n++;
  return n;
}

/** Cuanta respuesta mutua habria por pura casualidad: se desplazan en el tiempo los empujones de una (prueba de permutacion circular).
    Asi se conserva cuando y cuanto juega cada una, y solo se rompe la relacion entre lo que hace una y lo que hace la otra. */
export function casualidad(seq: { t: number; id: number }[], t0: number, t1: number, semilla: number, ventana = 8, rondas = 400): { observado: number; media: number; desv: number; z: number } {
  const ids = [...new Set(seq.map((s) => s.id))];
  const a = seq.filter((s) => s.id === ids[0]).map((s) => s.t);
  const b = seq.filter((s) => s.id === ids[1]).map((s) => s.t);
  const L = t1 - t0;
  const obs = respuestas(a, b, ventana);
  const r = new Azar(semilla);
  const vals: number[] = [];
  for (let k = 0; k < rondas; k++) {
    const u = r.entre(ventana * 2, L - ventana * 2);
    vals.push(respuestas(a, b.map((x) => t0 + ((x - t0 + u) % L)), ventana));
  }
  const m = media(vals);
  const desv = Math.sqrt(media(vals.map((v) => (v - m) ** 2))) || 1;
  return { observado: obs, media: m, desv, z: (obs - m) / desv };
}

export const caso05: Caso = {
  id: "05",
  titulo: "El partido improvisado",
  hipotesis: "Dos criaturas, una pelota y ninguna orden de jugar juntas. Se pasan la pelota con más turnos alternados de los que daria el azar, y eso desaparece si cada una juega con su pelota, sin posibilidad de responder a la otra.",
  minimo: 0.8,
  ejecutar(semilla) {
    const g1 = genomaDe(semilla, 51);
    const g2 = genomaDe(semilla, 52);
    const juntas = nuevaSim({ semilla, objetos: [{ tipo: "pelota", x: 800 }], criaturas: [{ genoma: g1, x: 300 }, { genoma: g2, x: 1300 }], comedero: { cada: 80, max: 3, tipo: "fruta" } });
    juntas.avanzar(1500);
    const seq = empujones(juntas.criaturas, 300);
    const T = turnos(seq);
    const az = casualidad(seq, 300, 1500, semilla);
    const z = az.z;
    // Control: cada una en su habitacion con su pelota (no pueden responderse). Se mezclan sus empujones en el tiempo.
    const a = nuevaSim({ semilla, objetos: [{ tipo: "pelota", x: 800 }], criaturas: [{ genoma: g1, x: 300 }], comedero: { cada: 80, max: 3, tipo: "fruta" } });
    const b = nuevaSim({ semilla: semilla + 1, objetos: [{ tipo: "pelota", x: 800 }], criaturas: [{ genoma: g2, x: 1300 }], comedero: { cada: 80, max: 3, tipo: "fruta" } });
    a.avanzar(1500); b.avanzar(1500);
    const seqC = empujones([a.criaturas[0], { id: 2, registro: b.criaturas[0].registro }], 300);
    const azC = casualidad(seqC, 300, 1500, semilla + 7);
    const zC = azC.z;
    return resultado(semilla, {
      "ambas juegan con la pelota (>= 8 empujones cada una)": [1, 2].every((id) => seq.filter((s) => s.id === id).length >= 8),
      "más turnos alternados que el azar (z > 2)": z > 2,
      "hay rachas de al menos 3 turnos seguidos": T.racha >= 3,
      "sin posibilidad de responder, no pasa (z < 2)": zC < 2,
    }, { empujones: seq.length, alternan: T.alternan, pares: T.pares, racha: T.racha, z, zControl: zC }, juntas.criaturas[0], 1500);
  },
};


/** El partido con variaciones: distancia entre las dos, tipo y numero de pelotas y sociabilidad. Cada variante se mide contra el azar de sus propios tiempos
    (permutacion circular), no solo contra el aislamiento del caso 05. Informativo: sirve para ver cuando el partido se rompe. */
export const caso05b: Caso = {
  id: "05b",
  titulo: "El partido con variaciones",
  hipotesis: "El juego alternado del caso 05 no depende de una distancia, una pelota o una sociabilidad concretas. Se repite con ellas cerca o lejos, con una pelota pesada o dos pelotas, y es mayor en criaturas muy sociables que en poco sociables. Se mide la alternancia, su ritmo (latencia entre empujones) y la duración de las rachas.",
  minimo: 0.5,
  ejecutar(semilla) {
    const g1 = genomaDe(semilla, 51);
    const g2 = genomaDe(semilla, 52);
    type V = { nombre: string; x1: number; x2: number; objetos: { tipo: string; x: number }[]; soc?: number; tipo: string };
    const variantes: V[] = [
      { nombre: "base", x1: 300, x2: 1300, objetos: [{ tipo: "pelota", x: 800 }], tipo: "pelota" },
      { nombre: "cerca", x1: 650, x2: 950, objetos: [{ tipo: "pelota", x: 800 }], tipo: "pelota" },
      { nombre: "lejos", x1: 100, x2: 1500, objetos: [{ tipo: "pelota", x: 800 }], tipo: "pelota" },
      { nombre: "pelota pesada", x1: 300, x2: 1300, objetos: [{ tipo: "pelota_pesada", x: 800 }], tipo: "pelota_pesada" },
      { nombre: "dos pelotas", x1: 300, x2: 1300, objetos: [{ tipo: "pelota", x: 650 }, { tipo: "pelota", x: 950 }], tipo: "pelota" },
      { nombre: "poco sociables", x1: 300, x2: 1300, objetos: [{ tipo: "pelota", x: 800 }], soc: 0.1, tipo: "pelota" },
      { nombre: "muy sociables", x1: 300, x2: 1300, objetos: [{ tipo: "pelota", x: 800 }], soc: 0.9, tipo: "pelota" },
    ];
    const criterios: Record<string, boolean> = {};
    const metricas: Record<string, number> = {};
    const zs: Record<string, number> = {};
    let primera: Criatura | null = null;
    for (const v of variantes) {
      const ga = clonarGenoma(g1), gb = clonarGenoma(g2);
      if (v.soc !== undefined) { ga.rasgos[1] = v.soc; gb.rasgos[1] = v.soc; }
      const s = nuevaSim({ semilla, objetos: v.objetos, criaturas: [{ genoma: ga, x: v.x1 }, { genoma: gb, x: v.x2 }], comedero: { cada: 80, max: 3, tipo: "fruta" } });
      s.avanzar(1500);
      primera ??= s.criaturas[0];
      const seq = empujones(s.criaturas, 300, v.tipo);
      const ambas = [1, 2].every((id) => seq.filter((q) => q.id === id).length >= 8);
      const z = ambas ? casualidad(seq, 300, 1500, semilla).z : 0;
      const r = ritmo(seq);
      const T = turnos(seq);
      zs[v.nombre] = z;
      criterios[`${v.nombre}: juegan las dos y alternan más que el azar (z > 2)`] = ambas && z > 2;
      metricas[`${v.nombre} z`] = z;
      metricas[`${v.nombre} empujones`] = seq.length;
      metricas[`${v.nombre} alternancia`] = T.pares ? T.alternan / T.pares : 0;
      metricas[`${v.nombre} latencia`] = r.latencia;
      metricas[`${v.nombre} racha media`] = r.rachas.length ? media(r.rachas) : 0;
      metricas[`${v.nombre} racha max`] = r.rachas.length ? Math.max(...r.rachas) : 0;
    }
    criterios["las muy sociables alternan más (z) que las poco sociables"] = zs["muy sociables"] > zs["poco sociables"];
    return resultado(semilla, criterios, metricas, primera, 1500);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

/** Parte del tiempo que dos criaturas pasan a menos de `radio` una de otra, y cuanto tardan en estar cerca por primera vez. */
function medirCercania(s: Simulacion, a: Criatura, b: Criatura, radio: number, segundos: number): { fraccion: number; primera: number } {
  let cerca = 0;
  let pasos = 0;
  let primera = segundos;
  const t0 = s.t;
  const g = (q: Simulacion) => { pasos++; if (Math.abs(a.x - b.x) < radio) { cerca++; if (primera === segundos) primera = q.t - t0; } };
  s.ganchos.push(g);
  s.avanzar(segundos);
  s.ganchos.splice(s.ganchos.indexOf(g), 1);
  return { fraccion: cerca / Math.max(1, pasos), primera };
}

export const caso06: Caso = {
  id: "06",
  titulo: "La compañía",
  hipotesis: "Dos criaturas que conviven mucho tiempo se buscan cuando se las separa y pasan más tiempo juntas que dos que no se conocen.",
  minimo: 0.8,
  ejecutar(semilla) {
    const g1 = genomaDe(semilla, 61);
    const g2 = genomaDe(semilla, 62);
    const juntos = nuevaSim({ semilla, objetos: [{ tipo: "pelota", x: 800 }], criaturas: [{ genoma: g1, x: 500 }, { genoma: g2, x: 700 }], comedero: { cada: 140, max: 2, tipo: "fruta" } });
    juntos.avanzar(1500);
    const afecto = Math.max(...juntos.criaturas.map((c) => c.mem.vinculos.reduce((m, v) => Math.max(m, v.afecto), 0)));
    const separar = (s: Simulacion): { a: Criatura; b: Criatura } => {
      const [a, b] = s.criaturas;
      for (const o of [...s.mundo.objetos]) s.mundo.quitar(o.id);
      s.comedero = null;
      a.x = 150; b.x = 1450; a.accion = null; b.accion = null;
      for (const c of [a, b]) { c.nec[4] = 0.5; c.nec[0] = 0.1; c.nec[1] = 0.1; c.nec[3] = 0.2; }
      return { a, b };
    };
    const vinc: { fraccion: number; primera: number }[] = [];
    const ctrl: { fraccion: number; primera: number }[] = [];
    for (let k = 0; k < 7; k++) {
      const r = replica(juntos, k);
      const { a, b } = separar(r);
      vinc.push(medirCercania(r, a, b, 260, 200));
      const n = nuevaSim({ semilla: mezclar(semilla, 63, k), objetos: [], criaturas: [{ genoma: g1, x: 150 }, { genoma: g2, x: 1450 }], comedero: null });
      for (const c of n.criaturas) { c.nec[4] = 0.5; c.nec[0] = 0.1; c.nec[1] = 0.1; c.nec[3] = 0.2; }
      ctrl.push(medirCercania(n, n.criaturas[0], n.criaturas[1], 260, 200));
    }
    const fV = mediana(vinc.map((x) => x.fraccion)), fC = mediana(ctrl.map((x) => x.fraccion));
    const tV = mediana(vinc.map((x) => x.primera)), tC = mediana(ctrl.map((x) => x.primera));
    return resultado(semilla, {
      "han creado un vínculo (afecto > 0,3)": afecto > 0.3,
      "se buscan al separarlas: se juntan en menos del 80 % del tiempo que dos desconocidas": tV < tC * 0.8,
      "y pasan más tiempo juntas que ellas": fV > fC,
    }, { afecto, tVinculadas: tV, tDesconocidas: tC, fraccionVinculadas: fV, fraccionDesconocidas: fC }, juntos.criaturas[0], 1500);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso07: Caso = {
  id: "07",
  titulo: "El aprendiz (facilitación social)",
  hipotesis: "Una criatura que nunca ha tocado una palanca la usa más veces si convive con otra que ya sabe, sin haber recibido ningún entrenamiento propio. El 07b separa qué es: hoy es facilitación mientras la otra está presente, no aprendizaje que permanezca.",
  minimo: 0.8,
  ejecutar(semilla) {
    const gE = genomaDe(semilla, 71);
    const gO = genomaDe(semilla, 72);
    // La experta aprende sola
    const X = nuevaSim({ semilla, objetos: [{ tipo: "palanca", x: 800 }], criaturas: [{ genoma: gE, x: 300 }], comedero: null });
    X.criaturas[0].nec[0] = 0.5;
    X.avanzar(1200);
    const experta = X.criaturas[0];
    const sabe = Math.max(esperado(experta, "tocar", "palanca", C.sacia), esperado(experta, "empujar", "palanca", C.sacia)) > 0.08;
    const estadoExperta = experta.estado();
    const prueba = (conExperta: boolean, k: number): { primera: number; pulsaciones: number } => {
      const s = nuevaSim({ semilla: mezclar(semilla, 72, k, conExperta ? 1 : 0), objetos: [{ tipo: "palanca", x: 800 }], criaturas: [{ genoma: gO, x: 300 }], comedero: null });
      const obs = s.criaturas[0];
      obs.nec[0] = 0.5;
      if (conExperta) {
        const e = Criatura.desde({ ...estadoExperta, id: 2, x: 520, accion: null }, mezclar(semilla, 73, k));
        e.azar.s = mezclar(semilla, 74, k);
        e.reiniciarReloj();
        e.capRegistro = 100000;
        e.nec[0] = 0.55;
        s.criaturas.push(e);
      }
      let primera = 300;
      s.ganchos.push((q) => { if (primera === 300 && manip(obs, "palanca") > 0) primera = q.t; });
      s.avanzar(300);
      return { primera, pulsaciones: manip(obs, "palanca") };
    };
    const con = [0, 1, 2, 3].map((k) => prueba(true, k));
    const sin = [0, 1, 2, 3].map((k) => prueba(false, k));
    const tCon = mediana(con.map((x) => x.primera)), tSin = mediana(sin.map((x) => x.primera));
    const pCon = mediana(con.map((x) => x.pulsaciones)), pSin = mediana(sin.map((x) => x.pulsaciones));
    return resultado(semilla, {
      "la experta ha aprendido a usar la palanca": sabe,
      "la aprendiz usa la palanca al menos un 40 % más de veces en 5 minutos que si estuviera sola": pCon > pSin * 1.4,
      "y no la empieza mucho más tarde": tCon < tSin + 15,
    }, { primeraConExperta: tCon, primeraSola: tSin, pulsacionesConExperta: pCon, pulsacionesSola: pSin }, experta, 1200);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso08: Caso = {
  id: "08",
  titulo: "El protector inesperado (con regla de ayuda escrita a mano)",
  hipotesis: "Una criatura cambia sola su conducta para acercarse a otra con la que tiene un vínculo cuando la ve hacerse daño. Una que no la conoce no lo hace.",
  minimo: 0.8,
  ejecutar(semilla) {
    const g1 = genomaDe(semilla, 81);
    const g2 = genomaDe(semilla, 82);
    const juntos = nuevaSim({ semilla, objetos: [{ tipo: "pelota", x: 800 }], criaturas: [{ genoma: g1, x: 500 }, { genoma: g2, x: 700 }], comedero: { cada: 140, max: 2, tipo: "fruta" } });
    juntos.avanzar(1500);
    // Cuantas veces decide acercarse a la otra en los 12 s siguientes a verla recibir una descarga, frente a los 12 s anteriores (con la placa apagada)
    const respuesta = (s: Simulacion, a: Criatura, b: Criatura): number => {
      for (const o of [...s.mundo.objetos]) s.mundo.quitar(o.id);
      s.comedero = null;
      const placa = s.mundo.agregar("placa", 1000, { activo: false });
      const ventana = (): number => {
        a.x = 1000; b.x = 600; a.accion = null; b.accion = null;
        for (const c of [a, b]) { c.nec[0] = 0.1; c.nec[1] = 0.1; c.nec[3] = 0.2; c.nec[4] = 0.2; }
        const t0 = s.t;
        s.avanzar(12);
        return b.registro.filter((r) => r.kind === "inicio" && r.v === "acercarse" && r.obj === 1000 + a.id && r.t >= t0).length;
      };
      const antes = ventana();
      placa.activo = true;
      const despues = ventana();
      return despues - antes;
    };
    const vinc: number[] = [];
    const ctrl: number[] = [];
    for (let k = 0; k < 8; k++) {
      const r = replica(juntos, k);
      vinc.push(respuesta(r, r.criaturas[0], r.criaturas[1]));
      const n = nuevaSim({ semilla: mezclar(semilla, 83, k), objetos: [], criaturas: [{ genoma: g1, x: 1000 }, { genoma: g2, x: 600 }], comedero: null });
      ctrl.push(respuesta(n, n.criaturas[0], n.criaturas[1]));
    }
    const cV = media(vinc), cC = media(ctrl);
    const afecto = Math.max(...juntos.criaturas.map((c) => c.mem.vinculos.reduce((m, v) => Math.max(m, v.afecto), 0)));
    return resultado(semilla, {
      "tienen un vínculo previo": afecto > 0.3,
      "al verla sufrir decide acercarse a ella más veces que en los 12 s anteriores": cV > 0.4,
      "y mucho más que quien no la conoce (+0,5 decisiones)": cV > cC + 0.5,
    }, { afecto, aumentoVinculadas: cV, aumentoDesconocidas: cC }, juntos.criaturas[0], 1500);
  },
};

export const caso08b: Caso = {
  id: "08b",
  titulo: "El protector aprendido",
  hipotesis: "Una criatura aprende a acercarse a una compañera que sufre solo si lo que hace tiene un efecto que se ve: su angustia baja porque ella se acerca. Seis condiciones separan miedo contagiado, evitación y consuelo. Si no puede acercarse, si la angustia no baja, si baja sola a la misma hora (control apareado: ve exactamente el mismo alivio, pero no lo causa ella) o si la que sufre es una desconocida, no aprende lo mismo. No hay ninguna regla de ayuda.",
  minimo: 0.8,
  ejecutar(semilla) {
    const g1 = genomaDe(semilla, 81);
    const g2 = genomaDe(semilla, 82);
    const gX = genomaDe(semilla, 84);
    const REP = 16;
    const EP = 24;
    const TOPE = 12;
    const preparar = (s: Simulacion): void => { for (const c of s.criaturas) { c.ayudaInnata = false; c.estadosAjenos = true; } };
    const juntos = nuevaSim({ semilla, objetos: [{ tipo: "pelota", x: 800 }], criaturas: [{ genoma: g1, x: 500 }, { genoma: g2, x: 700 }], comedero: { cada: 140, max: 2, tipo: "fruta" } });
    preparar(juntos);
    juntos.avanzar(1500);
    const afecto = Math.max(...juntos.criaturas.map((c) => c.mem.vinculos.reduce((m, v) => Math.max(m, v.afecto), 0)));
    for (const o of [...juntos.mundo.objetos]) juntos.mundo.quitar(o.id);
    juntos.comedero = null;
    const base = juntos.serializar();

    const colocar = (a: Criatura, b: Criatura, baja: boolean): void => {
      a.x = 1000; b.x = 600; a.accion = null; b.accion = null;
      for (const c of [a, b]) { c.nec[0] = 0.1; c.nec[1] = 0.1; c.nec[3] = 0.2; c.nec[4] = baja ? 0.02 : 0.25; c.emo[1] = baja ? 0.2 : 0.4; }
    };
    type Guion = { miedo: number; dolor: number }[];
    interface Episodio { latencia: number; guion: Guion }
    /** Una descarga a `a` delante de `b`. Nadie le dice a `b` que se acerque. En la prueba, con hambre y comida al otro lado, para ir con la otra hay
        que dejar de comer, y la que sufre se queda donde esta para que solo cuente lo que hace `b`. Devuelve el tiempo que tarda `b` en estar junto a
        ella (a menos de 180), o TOPE si no llega, y lo que le pasa a ella segundo a segundo (para repetirlo en el control apareado). */
    const episodio = (s: Simulacion, a: Criatura, b: Criatura, segundos: number, prueba: boolean, guion?: Guion, forzado: Verbo | null = null, fijaA = prueba): Episodio => {
      for (const o of [...s.mundo.objetos]) s.mundo.quitar(o.id);
      if (prueba) s.mundo.agregar("fruta", 300, { porciones: 6 });
      colocar(a, b, prueba);
      b.nec[0] = prueba ? 0.85 : 0.1;
      a.atrapada = fijaA;
      b.verboForzado = forzado;
      let latencia = TOPE;
      const t0 = s.t;
      const grabado: Guion = [];
      const g = () => {
        const k = Math.round((s.t - t0) / 0.25) - 1;
        if (guion) { const q = guion[Math.min(guion.length - 1, Math.max(0, k))]; a.emo[0] = q.miedo; a.nec[2] = q.dolor; }
        else grabado.push({ miedo: a.emo[0], dolor: a.nec[2] });
        if (latencia === TOPE && Math.abs(a.x - b.x) < 180) latencia = s.t - t0;
      };
      s.ganchos.push(g);
      a.sufrir(0.7, -1, null, 0.5);
      s.avanzar(segundos);
      s.ganchos.splice(s.ganchos.indexOf(g), 1);
      a.atrapada = false;
      b.verboForzado = null;
      return { latencia, guion: grabado };
    };
    const puntos = (e: Episodio) => 1 - e.latencia / TOPE;

    type Condicion = "consuela" | "atrapada" | "inconsolable" | "desconocida" | "apareada";
    interface Entrenada { s: Simulacion; sufre: number; mira: number; guiones: Guion[] }
    const restaurar = (k: number): Simulacion => {
      const r = Simulacion.restaurar(base);
      r.azar.s = mezclar(semilla, 93, k);
      for (const c of r.criaturas) { c.azar.s = mezclar(semilla, 94, c.id, k); c.capRegistro = 100000; }
      return r;
    };
    const extrana = (k: number): Criatura => {
      const S = new Criatura(3, "Extraña", clonarGenoma(gX), 1000, mezclar(semilla, 97, k));
      S.ayudaInnata = false; S.estadosAjenos = true; S.capRegistro = 100000;
      return S;
    };
    // Entrenamiento: 24 episodios de la otra recibiendo una descarga delante, segun la condicion. En los 18 primeros se fuerza, por turnos, acercarse,
    // quedarse (descansar) y alejarse (evitar), para que haya muestras de las tres opciones; en los 6 siguientes decide ella.
    const forzadoEn = (i: number): Verbo | null => (i < 18 ? (["acercarse", "descansar", "evitar"] as const)[i % 3] : null);
    const entrenar = (cond: Condicion, guiones: Guion[] = []): Entrenada => {
      if (cond === "desconocida") {
        // La misma criatura, con su vinculo intacto, pero la que sufre ahora es una desconocida (su companera no esta)
        const r = restaurar(1);
        const B = r.criaturas[1];
        const S = extrana(0);
        r.criaturas = [B, S];
        for (let i = 0; i < EP; i++) { episodio(r, S, B, 20, false, undefined, forzadoEn(i)); r.avanzar(8); }
        return { s: r, sufre: 1, mira: 0, guiones: [] };
      }
      const r = restaurar(cond === "apareada" ? 2 : 0);
      const [A, B] = r.criaturas;
      B.atrapada = cond === "atrapada";
      A.inconsolable = cond === "inconsolable" || cond === "apareada";
      const grabados: Guion[] = [];
      // En el control apareado cada episodio repite lo que le paso a la otra en un episodio distinto (el de 4 mas adelante), asi que el alivio llega igual pero no depende de lo que hace
      for (let i = 0; i < EP; i++) { grabados.push(episodio(r, A, B, 20, false, cond === "apareada" ? guiones[(i + 4) % EP] : undefined, forzadoEn(i), cond === "atrapada").guion); r.avanzar(8); }
      B.atrapada = false; A.inconsolable = false; A.emo[0] = 0; A.nec[2] = 0;
      return { s: r, sufre: 0, mira: 1, guiones: grabados };
    };
    /** El alivio medio que ha visto en `nombre` tras hacer `verbo` (0 si nunca lo hizo estando ella a la vista). */
    const alivioDe = (B: Criatura, verbo: string, nombre: string): number => {
      let n = 0, acc = 0;
      for (const q of B.mem.protos) if (q.v === `ante:${verbo}` && q.nombre === nombre) { n += q.n; acc += q.n * q.res[C.alivio]; }
      return n ? acc / n : 0;
    };
    const prueba = (e: Entrenada, pausa = 120): number => {
      const v: number[] = [];
      for (let k = 0; k < REP; k++) {
        const r = replica(e.s, k);
        // Antes de la prueba pasa un rato sin nada, para que no quede miedo o excitacion del ultimo episodio
        for (const o of [...r.mundo.objetos]) r.mundo.quitar(o.id);
        r.avanzar(pausa);
        v.push(puntos(episodio(r, r.criaturas[e.sufre], r.criaturas[e.mira], TOPE, true)));
      }
      return media(v);
    };
    /** Lo mismo, pero la que sufre es una desconocida que no vio nunca (generalizar a una criatura nueva). */
    const pruebaExtrana = (e: Entrenada): number => {
      const v: number[] = [];
      for (let k = 0; k < REP; k++) {
        const r = replica(e.s, k);
        const S = extrana(10 + k);
        const B = r.criaturas[e.mira];
        r.criaturas = [B, S];
        v.push(puntos(episodio(r, S, B, TOPE, true)));
      }
      return media(v);
    };
    const aprendido = (e: Entrenada) => {
      const B = e.s.criaturas[e.mira];
      const nombre = e.s.criaturas[e.sufre].nombre;
      const acercarse = alivioDe(B, "acercarse", nombre), quedarse = alivioDe(B, "descansar", nombre), alejarse = alivioDe(B, "evitar", nombre);
      return { acercarse, quedarse, alejarse, margen: acercarse - quedarse };
    };
    const consuela = entrenar("consuela");
    const res: Record<Condicion | "ingenua", number> = { consuela: prueba(consuela), atrapada: 0, inconsolable: 0, desconocida: 0, apareada: 0, ingenua: 0 };
    for (const c of ["atrapada", "inconsolable", "desconocida"] as Condicion[]) res[c] = prueba(entrenar(c));
    const apareada = entrenar("apareada", consuela.guiones);
    res.apareada = prueba(apareada);
    const aC = aprendido(consuela), aA = aprendido(apareada);
    const vn: number[] = [];
    for (let k = 0; k < REP; k++) {
      const n = nuevaSim({ semilla: mezclar(semilla, 85, k), objetos: [], criaturas: [{ genoma: g1, x: 1000 }, { genoma: g2, x: 600 }], comedero: null });
      preparar(n);
      vn.push(puntos(episodio(n, n.criaturas[0], n.criaturas[1], TOPE, true)));
    }
    res.ingenua = media(vn);
    const trasPausa = prueba(consuela, 600);
    const conExtrana = pruebaExtrana(consuela);
    return resultado(semilla, {
      "han creado un vínculo antes (afecto > 0,3)": afecto > 0.3,
      "si la angustia bajaba al acercarse, llega antes que si no bajaba (+0,15): aprende del efecto": res.consuela > res.inconsolable + 0.15,
      "acercarse le ha dado más alivio que quedarse donde estaba (+0,15): lo aprendido separa lo que hace de lo que pasa solo": aC.margen > 0.15,
      "y esa diferencia es mucho menor si el alivio llegaba igual pero sin que lo causara ella (control apareado, -0,15)": aA.margen < aC.margen - 0.15,
      "y que si no pudo acercarse (+0,1): ver angustia no basta": res.consuela > res.atrapada + 0.1,
      "y que ante una desconocida que no ha visto nunca (+0,2): el vínculo importa": res.consuela > conExtrana + 0.2,
      "y que quien nunca la vio sufrir (+0,1): lo aprendido se nota": res.consuela > res.ingenua + 0.1,
    }, { afecto, consuela: res.consuela, noPudoAcercarse: res.atrapada, laAngustiaNoBajaba: res.inconsolable, bajabaSolaApareada: res.apareada, alivioAcercarse: aC.acercarse, alivioQuedarse: aC.quedarse, alivioAlejarse: aC.alejarse, margenAcercarse: aC.margen, margenApareada: aA.margen, alivioAcercarseApareada: aA.acercarse, alivioQuedarseApareada: aA.quedarse, desconocida: res.desconocida, ingenua: res.ingenua, tras10min: trasPausa, conUnaExtrana: conExtrana }, juntos.criaturas[0], 1500);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso08c: Caso = {
  id: "08c",
  titulo: "El consuelo, con costes y con otra compañera",
  hipotesis: "Lo aprendido en el 08b se nota en lo que decide cuando ir con la otra cuesta cada vez más (hambre creciente con la comida al otro lado), y se traslada a una tercera criatura vinculada que nunca ha visto sufrir. En el control apareado, que ve el mismo alivio sin causarlo, el punto en que deja de ir es más bajo.",
  minimo: 0.8,
  ejecutar(semilla) {
    const g1 = genomaDe(semilla, 81);
    const g2 = genomaDe(semilla, 82);
    const g3 = genomaDe(semilla, 86);
    const EP = 24;
    const REP = 8;
    const TOPE = 12;
    const HAMBRES = [0.45, 0.6, 0.75, 0.9];
    const juntos = nuevaSim({ semilla, objetos: [{ tipo: "pelota", x: 800 }], criaturas: [{ genoma: g1, x: 500 }, { genoma: g2, x: 700 }, { genoma: g3, x: 600 }], comedero: { cada: 110, max: 3, tipo: "fruta" } });
    for (const c of juntos.criaturas) { c.ayudaInnata = false; c.estadosAjenos = true; }
    juntos.avanzar(1500);
    const vinculoCon = (b: Criatura, a: Criatura): number => b.mem.vinculos.find((q) => q.id === 1000 + a.id)?.afecto ?? 0;
    const afectoA = vinculoCon(juntos.criaturas[1], juntos.criaturas[0]);
    const afectoC = vinculoCon(juntos.criaturas[1], juntos.criaturas[2]);
    for (const o of [...juntos.mundo.objetos]) juntos.mundo.quitar(o.id);
    juntos.comedero = null;
    const base = juntos.serializar();

    type Guion = { miedo: number; dolor: number }[];
    const restaurar = (k: number): Simulacion => {
      const r = Simulacion.restaurar(base);
      r.azar.s = mezclar(semilla, 193, k);
      for (const c of r.criaturas) { c.azar.s = mezclar(semilla, 194, c.id, k); c.capRegistro = 100000; }
      return r;
    };
    /** Una descarga a `a` delante de `b`. En la prueba, `b` tiene el hambre indicada con la comida al otro lado, y `a` se queda donde esta.
        Devuelve lo que tarda `b` en estar a menos de 180 de ella (TOPE si no llega) y la angustia de `a` segundo a segundo. */
    const episodio = (s: Simulacion, a: Criatura, b: Criatura, prueba: boolean, hambre: number, guion?: Guion, forzado: Verbo | null = null): { latencia: number; guion: Guion } => {
      for (const o of [...s.mundo.objetos]) s.mundo.quitar(o.id);
      if (prueba) s.mundo.agregar("fruta", 300, { porciones: 6 });
      a.x = 1000; b.x = 600; a.accion = null; b.accion = null;
      for (const c of [a, b]) { c.nec[0] = 0.1; c.nec[1] = 0.1; c.nec[3] = 0.2; c.nec[4] = prueba ? 0.02 : 0.25; c.emo[1] = prueba ? 0.2 : 0.4; }
      b.nec[0] = prueba ? hambre : 0.1;
      a.atrapada = prueba;
      b.verboForzado = forzado;
      let latencia = TOPE;
      const t0 = s.t;
      const grabado: Guion = [];
      const g = () => {
        const k = Math.round((s.t - t0) / 0.25) - 1;
        if (guion) { const q = guion[Math.min(guion.length - 1, Math.max(0, k))]; a.emo[0] = q.miedo; a.nec[2] = q.dolor; }
        else grabado.push({ miedo: a.emo[0], dolor: a.nec[2] });
        if (latencia === TOPE && Math.abs(a.x - b.x) < 180) latencia = s.t - t0;
      };
      s.ganchos.push(g);
      a.sufrir(0.7, -1, null, 0.5);
      s.avanzar(prueba ? TOPE : 20);
      s.ganchos.splice(s.ganchos.indexOf(g), 1);
      a.atrapada = false;
      b.verboForzado = null;
      return { latencia, guion: grabado };
    };
    const forzadoEn = (i: number): Verbo | null => (i < 18 ? (["acercarse", "descansar", "evitar"] as const)[i % 3] : null);
    interface Entrenada { s: Simulacion; guiones: Guion[] }
    /** Entrena a B (la del medio) con A. C no esta. Con `guiones` es el control apareado. */
    const entrenar = (guiones?: Guion[], k = 0): Entrenada => {
      const r = restaurar(k);
      const [A, B] = r.criaturas;
      r.criaturas = [A, B];
      A.inconsolable = !!guiones;
      const grabados: Guion[] = [];
      for (let i = 0; i < EP; i++) { grabados.push(episodio(r, A, B, false, 0.1, guiones ? guiones[(i + 4) % EP] : undefined, forzadoEn(i)).guion); r.avanzar(8); }
      A.inconsolable = false; A.emo[0] = 0; A.nec[2] = 0;
      return { s: r, guiones: grabados };
    };
    /** La entrenada con A, probada ante A (`ante` = 0) o ante C (`ante` = 2, que no vio sufrir nunca). Devuelve la media por nivel de hambre. */
    const curva = (e: Entrenada | null, ante: 0 | 2): number[] => HAMBRES.map((h) => {
      const v: number[] = [];
      for (let k = 0; k < REP; k++) {
        let r: Simulacion, quien: Criatura, B: Criatura;
        if (e) {
          r = replica(e.s, k);
          B = r.criaturas[1];
          if (ante === 2) {
            // C viene de la misma convivencia, con su vinculo intacto
            quien = restaurar(50 + k).criaturas[2];
            r.criaturas = [quien, B];
          } else quien = r.criaturas[0];
        } else {
          r = restaurar(100 + k);
          quien = r.criaturas[ante];
          B = r.criaturas[1];
          r.criaturas = [quien, B];
        }
        for (const o of [...r.mundo.objetos]) r.mundo.quitar(o.id);
        r.avanzar(120);
        v.push(1 - episodio(r, quien, B, true, h).latencia / TOPE);
      }
      return media(v);
    });
    const consuela = entrenar();
    const apareada = entrenar(consuela.guiones, 2);
    const cA = curva(consuela, 0), cC = curva(consuela, 2), aA = curva(apareada, 0), iA = curva(null, 0), iC = curva(null, 2);
    const m = media;
    return resultado(semilla, {
      "ha creado vínculo con las dos (afecto > 0,2 con A y con C)": afectoA > 0.2 && afectoC > 0.2,
      "con la comida más tentadora sigue yendo con ella más que si nunca la vio sufrir (+0,1, media de los cuatro niveles)": m(cA) > m(iA) + 0.1,
      "y más que el control apareado, que vio el mismo alivio sin causarlo (+0,1)": m(cA) > m(aA) + 0.1,
      "ante la tercera, que nunca vio sufrir, va más que quien nunca vio sufrir a nadie (+0,1): lo aprendido se traslada": m(cC) > m(iC) + 0.1,
    }, {
      afectoA, afectoC,
      consuelaA: m(cA), consuelaC: m(cC), apareadaA: m(aA), ingenuaA: m(iA), ingenuaC: m(iC),
      consuelaA_h90: cA[3], apareadaA_h90: aA[3], ingenuaA_h90: iA[3], consuelaC_h90: cC[3],
    }, juntos.criaturas[0], 1500);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso07b: Caso = {
  id: "07b",
  titulo: "El aprendiz, por fases",
  hipotesis: "Separa lo que mide el caso 07 en tres tramos de 200 s: dos con compañía y uno con la palanca sola. Controles: palanca estropeada (se mueve y no suelta nada, para aislar la facilitación), una compañera novata que no sabe nada (para separar imitar de simplemente estar acompañada) y la aprendiz sola. Mide cuántas veces la pulsa en cada tramo, cuántos gránulos come y si lo que hace cuando la experta se va supera lo que hace quien exploró sola.",
  minimo: 0.5,
  ejecutar(semilla) {
    const gE = genomaDe(semilla, 71);
    const gO = genomaDe(semilla, 72);
    const X = nuevaSim({ semilla, objetos: [{ tipo: "palanca", x: 800 }], criaturas: [{ genoma: gE, x: 300 }], comedero: null });
    X.criaturas[0].nec[0] = 0.5;
    X.avanzar(1200);
    const estadoExperta = X.criaturas[0].estado();
    type Compania = "experta" | "novata" | "nadie";
    /** Tres tramos de 200 s. En el tercero la compañera se va, la comida suelta se retira y el hambre vuelve a 0,5 para que todas partan igual. */
    const fases = (tipo: string, compania: Compania, k: number): { f1: number; f2: number; f3: number; granulos: number } => {
      const s = nuevaSim({ semilla: mezclar(semilla, 75, k, compania === "nadie" ? 0 : 1), objetos: [{ tipo, x: 800 }], criaturas: [{ genoma: gO, x: 300 }], comedero: null });
      const obs = s.criaturas[0];
      obs.nec[0] = 0.5;
      if (compania === "experta") {
        const e = Criatura.desde({ ...estadoExperta, id: 2, x: 520, accion: null }, mezclar(semilla, 76, k));
        e.azar.s = mezclar(semilla, 77, k);
        e.reiniciarReloj();
        e.capRegistro = 100000;
        e.nec[0] = 0.55;
        s.criaturas.push(e);
      } else if (compania === "novata") {
        const e = nuevaSim({ semilla: mezclar(semilla, 78, k), objetos: [], criaturas: [{ genoma: genomaDe(semilla, 79), x: 520 }], comedero: null }).criaturas[0];
        e.id = 2;
        e.nec[0] = 0.55;
        s.criaturas.push(e);
      }
      s.avanzar(200);
      const a = manip(obs, tipo);
      s.avanzar(200);
      const b = manip(obs, tipo);
      const granulos = impactos(obs, "probar", "granulo");
      if (compania !== "nadie") s.criaturas.splice(1, 1);
      for (const o of [...s.mundo.objetos]) if (o.tipo !== tipo) s.mundo.quitar(o.id);
      obs.nec[0] = 0.5;
      s.avanzar(200);
      return { f1: a, f2: b - a, f3: manip(obs, tipo) - b, granulos };
    };
    const reps = (tipo: string, c: Compania) => [0, 1, 2, 3].map((k) => fases(tipo, c, k));
    const med = (r: ReturnType<typeof reps>, campo: "f1" | "f2" | "f3" | "granulos") => mediana(r.map((x) => x[campo]));
    const rotaExp = reps("palanca_rota", "experta"), rotaNov = reps("palanca_rota", "novata"), rotaSola = reps("palanca_rota", "nadie");
    const funExp = reps("palanca", "experta"), funSola = reps("palanca", "nadie");
    const dentro = (r: ReturnType<typeof reps>) => med(r, "f1") + med(r, "f2");
    return resultado(semilla, {
      "A: con la palanca estropeada, junto a la experta la usa mas que sola (facilitacion social)": dentro(rotaExp) > dentro(rotaSola),
      "A2: y mas que junto a una novata que no sabe nada (imitar no es solo estar acompañada)": dentro(rotaExp) > dentro(rotaNov),
      "B: cuando la experta se va, sigue usando la palanca mas que quien exploro sola (aprendizaje)": med(funExp, "f3") > med(funSola, "f3"),
    }, {
      rotaExperta1: med(rotaExp, "f1"), rotaExperta2: med(rotaExp, "f2"), rotaExperta3: med(rotaExp, "f3"),
      rotaNovata1: med(rotaNov, "f1"), rotaNovata2: med(rotaNov, "f2"),
      rotaSola1: med(rotaSola, "f1"), rotaSola2: med(rotaSola, "f2"),
      funcionaExperta1: med(funExp, "f1"), funcionaExperta2: med(funExp, "f2"), funcionaExperta3: med(funExp, "f3"), granulosConExperta: med(funExp, "granulos"),
      funcionaSola1: med(funSola, "f1"), funcionaSola2: med(funSola, "f2"), funcionaSola3: med(funSola, "f3"), granulosSola: med(funSola, "granulos"),
    }, null, 600);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

/** Una vida de prueba: una criatura sola recibe un susto y se mide cuantos segundos de los 40 siguientes sigue asustada (se ve en su postura:
    orejas pegadas, temblor). Devuelve ese tiempo, la sensibilidad con la que nacio (genetica) y cuanto cambio viviendo (aprendizaje). */
function vidaDePrueba(g: Genoma, semilla: number): { asustada: number; nacida: number; deriva: number; vivida: number } {
  const s = nuevaSim({ semilla, objetos: [{ tipo: "pelota", x: 900 }], criaturas: [{ genoma: clonarGenoma(g), x: 800 }], comedero: null });
  const c = s.criaturas[0];
  const nacida = c.rasgos[7];
  s.avanzar(5);
  c.sufrir(0.5, -1, null, 0.4);
  let ticks = 0;
  s.ganchos.push(() => { if (c.emo[0] > 0.3) ticks++; });
  s.avanzar(40);
  return { asustada: ticks * 0.25, nacida, deriva: c.rasgos[7] - c.base[7], vivida: c.rasgos[7] };
}

export const caso14: Caso = {
  id: "14",
  titulo: "La herencia de los monstruos",
  hipotesis: "Criando durante varias generaciones solo a las criaturas que se recuperan antes de un susto, la población se vuelve más mansa; criando a las que más tardan, más asustadiza; y criando al azar, se queda donde estaba. El cambio viene de la genética: los hijos nacen con lo heredado, no con lo que sus padres aprendieron, y persiste al criar a los descendientes en condiciones idénticas.",
  minimo: 0.8,
  ejecutar(semilla) {
    const GEN = 6, N = 8, PADRES = 4;
    const inicial = Array.from({ length: N }, (_, i) => genomaDe(semilla, 140 + i));
    type Modo = "mansa" | "azar" | "asustadiza";
    const linea = (modo: Modo, ident: number): { asustada: number[]; nacida: number[]; deriva: number[]; desv: number[]; hijosConLoVivido: number; ultimos: Genoma[] } => {
      const r = new Azar(mezclar(semilla, 141, ident));
      let pob = inicial.map((g) => clonarGenoma(g));
      const asustada: number[] = [], nacida: number[] = [], deriva: number[] = [], desv: number[] = [];
      let tramposos = 0;
      for (let gen = 0; gen < GEN; gen++) {
        const vidas = pob.map((g, i) => vidaDePrueba(g, mezclar(semilla, 142, ident, gen * 100 + i)));
        asustada.push(media(vidas.map((v) => v.asustada)));
        const n = vidas.map((v) => v.nacida);
        nacida.push(media(n));
        desv.push(Math.sqrt(media(n.map((x) => (x - media(n)) ** 2))));
        deriva.push(media(vidas.map((v) => v.deriva)));
        // Se crian los que menos (mansa) o mas (asustadiza) tiempo siguen asustados, o cuatro al azar
        const orden = vidas.map((_, i) => i).sort((x, y) => vidas[x].asustada - vidas[y].asustada);
        const elegidos = modo === "mansa" ? orden.slice(0, PADRES) : modo === "asustadiza" ? orden.slice(-PADRES) : [...orden].sort(() => r.next() - 0.5).slice(0, PADRES);
        const hijos: Genoma[] = [];
        for (let i = 0; i < N; i++) {
          const a = elegidos[r.entero(PADRES)];
          let b = elegidos[r.entero(PADRES)];
          if (b === a) b = elegidos[(elegidos.indexOf(a) + 1) % PADRES];
          const h = cruzar(pob[a], pob[b], mezclar(semilla, 143, ident, gen * 100 + i));
          // Los hijos no heredan lo vivido: la sensibilidad que sus padres llegaron a tener no entra en el genoma
          if (Math.abs(vidas[a].deriva) > 0.01 && h.rasgos[7] === vidas[a].vivida) tramposos++;
          hijos.push(h);
        }
        pob = hijos;
      }
      return { asustada, nacida, deriva, desv, hijosConLoVivido: tramposos, ultimos: pob };
    };
    // Dos lineas de cada tipo, para que no sea suerte de una sola
    const MAN = [linea("mansa", 1), linea("mansa", 3)];
    const ALE = [linea("azar", 2), linea("azar", 4)];
    const ASU = [linea("asustadiza", 5), linea("asustadiza", 6)];
    const ult = GEN - 1;
    const m = (ls: typeof MAN, k: "asustada" | "nacida" | "deriva" | "desv", i: number) => media(ls.map((l) => l[k][i]));
    const asMan = m(MAN, "asustada", ult), asAle = m(ALE, "asustada", ult), asAsu = m(ASU, "asustada", ult);
    const nacMan = m(MAN, "nacida", ult), nacAle = m(ALE, "nacida", ult), nacAsu = m(ASU, "nacida", ult);
    const ini = m(MAN, "nacida", 0);
    const derMan = m(MAN, "deriva", ult), derAle = m(ALE, "deriva", ult), derAsu = m(ASU, "deriva", ult);
    const desvFinal = media([...MAN, ...ASU].map((l) => l.desv[ult]));
    // Los descendientes de la ultima generacion, criados otra vez en condiciones identicas (otras semillas): ¿persiste la diferencia?
    const retest = (ls: typeof MAN): number => media(ls.flatMap((l, j) => l.ultimos.map((g, i) => vidaDePrueba(g, mezclar(semilla, 144, j, i)).asustada)));
    const rMan = retest(MAN), rAsu = retest(ASU), rAle = retest(ALE);
    const curvas = {
      "segundos asustada, linea mansa": MAN[0].asustada.map((_, i) => ({ t: i + 1, v: m(MAN, "asustada", i) })),
      "segundos asustada, linea al azar": ALE[0].asustada.map((_, i) => ({ t: i + 1, v: m(ALE, "asustada", i) })),
      "segundos asustada, linea asustadiza": ASU[0].asustada.map((_, i) => ({ t: i + 1, v: m(ASU, "asustada", i) })),
      "variacion genetica (desviacion de la sensibilidad), linea mansa": MAN[0].desv.map((_, i) => ({ t: i + 1, v: m(MAN, "desv", i) })),
    };
    const r14 = resultado(semilla, {
      "la linea mansa se asusta menos tiempo que la criada al azar (-20 %)": asMan < asAle * 0.8,
      "nace con menos sensibilidad heredada (-0,04 frente al azar)": nacMan < nacAle - 0.04,
      "y menos que la primera generacion (-0,03)": nacMan < ini - 0.03,
      "en sentido contrario, la linea asustadiza nace con mas sensibilidad que la del azar (+0,04): el rasgo se mueve en las dos direcciones": nacAsu > nacAle + 0.04,
      "ordenadas: mansa < azar < asustadiza en lo heredado": nacMan < nacAle && nacAle < nacAsu,
      "al criar a los descendientes otra vez en condiciones identicas, la diferencia persiste (mansa < asustadiza)": rMan < rAsu,
      "no se agota la variacion genetica (desviacion > 0,03 en la ultima generacion)": desvFinal > 0.03,
      "lo vivido no se hereda: lo que cambia viviendo es parecido en todas las lineas (< 0,06)": Math.max(derMan, derAle, derAsu) - Math.min(derMan, derAle, derAsu) < 0.06,
      "y ningun hijo hereda el caracter desarrollado por sus padres": MAN.concat(ALE, ASU).every((l) => l.hijosConLoVivido === 0),
    }, { segundosAsustadaMansa: asMan, segundosAsustadaAzar: asAle, segundosAsustadaAsustadiza: asAsu, sensibilidadNacidaMansa: nacMan, sensibilidadNacidaAzar: nacAle, sensibilidadNacidaAsustadiza: nacAsu, sensibilidadInicial: ini, desviacionFinal: desvFinal, repruebaMansa: rMan, repruebaAzar: rAle, repruebaAsustadiza: rAsu }, null, 45, curvas);
    r14.acciones = { "vidas de prueba": 6 * GEN * N };
    return r14;
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso16: Caso = {
  id: "16",
  titulo: "Rostros que regresan",
  hipotesis: "Una criatura que convivió con otra la prefiere a una impostora de su mismo aspecto (que no se distingue más que por su huella) cuando se reencuentran, incluso tras mucho tiempo separadas y en otra sala. Si nunca se conocieron, no hay preferencia. Si el reconocimiento solo va por la etiqueta de identificador, tampoco: el diagnóstico previo daba azar.",
  minimo: 0.8,
  ejecutar(semilla) {
    const g1 = genomaDe(semilla, 161);
    const g2 = genomaDe(semilla, 162);
    const g3 = genomaDe(semilla, 163);
    const SEPARACIONES = [0, 600, 3600];
    const vivir = (reconoce: boolean, extra: boolean): Simulacion => {
      const cs = [{ genoma: g1, x: 500 }, { genoma: g3, x: 600 }];
      if (extra) cs.splice(1, 0, { genoma: g2, x: 700 });
      const s = nuevaSim({ semilla, objetos: [{ tipo: "pelota", x: 800 }], criaturas: cs, comedero: { cada: 110, max: 3, tipo: "fruta" } });
      for (const c of s.criaturas) c.reconocePorRasgos = reconoce;
      s.avanzar(1500);
      return s;
    };
    /** Cuantas veces llega primero junto a la conocida (B) frente a la impostora (L), con ambas quietas a 280 de ella en una sala sin nada mas. */
    const eleccion = (base: Simulacion, B0: Criatura | null, separacion: number, reconoce: boolean, tag: number, REP = 8): { pB: number; pL: number } => {
      let b = 0, l = 0;
      for (let k = 0; k < REP; k++) {
        const r = replica(base, k);
        const A = r.criaturas[0];
        // La conocida es la del medio de la convivencia; en el control de quienes no se conocen, una recien nacida con el mismo genoma
        let B: Criatura;
        if (B0) {
          B = r.criaturas[1];
          if (separacion > 0) { r.criaturas = [A, r.criaturas[2]]; r.avanzar(separacion); }
        } else {
          B = new Criatura(5, "Otra", clonarGenoma(g2), 520, mezclar(semilla, 165, k, tag));
          B.reconocePorRasgos = reconoce;
          B.capRegistro = 1000;
        }
        const L = new Criatura(6, "Impostora", clonarGenoma(g2), 1080, mezclar(semilla, 164, k, tag));
        L.reconocePorRasgos = reconoce;
        L.capRegistro = 1000;
        for (const o of [...r.mundo.objetos]) r.mundo.quitar(o.id);
        r.comedero = null;
        r.criaturas = [A, B, L];
        // Un lado distinto cada vez, para que una preferencia por izquierda o derecha no cuente como reconocer
        const izq = k % 2 === 0;
        A.x = 800; B.x = izq ? 520 : 1080; L.x = izq ? 1080 : 520; A.accion = null; B.accion = null; L.accion = null;
        B.atrapada = true; L.atrapada = true;
        A.nec[0] = 0.1; A.nec[1] = 0.1; A.nec[3] = 0.2; A.nec[4] = 0.4;
        let primera = "";
        const g = () => {
          if (primera) return;
          if (Math.abs(A.x - B.x) < 200) primera = "B";
          else if (Math.abs(A.x - L.x) < 200) primera = "L";
        };
        r.ganchos.push(g);
        r.avanzar(15);
        if (primera === "B") b++;
        else if (primera === "L") l++;
      }
      return { pB: b / REP, pL: l / REP };
    };
    const con = vivir(true, true);
    const sin = vivir(false, true);
    const noSeConocen = vivir(true, false);
    const r0 = eleccion(con, con.criaturas[1], 0, true, 0);
    const r600 = eleccion(con, con.criaturas[1], 600, true, 1);
    const r3600 = eleccion(con, con.criaturas[1], SEPARACIONES[2], true, 2);
    const ctrl = eleccion(noSeConocen, null, 0, true, 3, 24);
    const soloEtiqueta = eleccion(sin, sin.criaturas[1], 600, false, 4, 24);
    const dif = (x: { pB: number; pL: number }) => x.pB - x.pL;
    const afectoB = con.criaturas[0].mem.vinculos.find((q) => q.id === 1000 + con.criaturas[1].id)?.afecto ?? 0;
    return resultado(semilla, {
      "han creado un vínculo antes (afecto > 0,3)": afectoB > 0.3,
      "nada más reencontrarse prefiere a la conocida sobre la impostora (+0,3)": dif(r0) > 0.3,
      "y tras 600 s separadas (+0,3)": dif(r600) > 0.3,
      "y tras 3600 s separadas (+0,3): el recuerdo persiste": dif(r3600) > 0.3,
      "si nunca se conocieron no hay preferencia entre las dos (diferencia menor que 0,35)": Math.abs(dif(ctrl)) < 0.35,
      "si el reconocimiento solo va por la etiqueta, tampoco hay preferencia clara (diferencia menor que 0,35)": Math.abs(dif(soloEtiqueta)) < 0.35,
    }, { afectoB, conocida0: r0.pB, impostora0: r0.pL, conocida600: r600.pB, impostora600: r600.pL, conocida3600: r3600.pB, impostora3600: r3600.pL, noSeConocenConocida: ctrl.pB, noSeConocenImpostora: ctrl.pL, soloEtiquetaConocida: soloEtiqueta.pB, soloEtiquetaImpostora: soloEtiqueta.pL }, con.criaturas[0], 1500);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso07c: Caso = {
  id: "07c",
  titulo: "Lo que se queda al ver",
  hipotesis: "Si una criatura ve a otra actuar sobre una máquina y poco después sale algo que le interesa, aprende que esa acción lo trae, aunque no haya podido tocar nada. Para aislar lo visto de lo vivido, la observadora está inmovilizada con la palanca a la vista durante 400 s y luego se la suelta sola con una palanca que funciona. Se la suelta entre la palanca y un objeto nuevo que no hace nada. Se mide a cuál va primero (realce del estímulo: la palanca se vuelve interesante porque la usa otra) y cuánto tarda en comerse el primer gránulo (aprendizaje del resultado: que de la palanca sale comida y que eso se come). Controles: sin el aprendizaje por observación, con la palanca estropeada mientras la veía y sin experta (solo ve la palanca quieta).",
  minimo: 0.8,
  ejecutar(semilla) {
    const gE = genomaDe(semilla, 71);
    const gO = genomaDe(semilla, 72);
    const X = nuevaSim({ semilla, objetos: [{ tipo: "palanca", x: 800 }], criaturas: [{ genoma: gE, x: 300 }], comedero: null });
    X.criaturas[0].nec[0] = 0.5;
    X.avanzar(1200);
    const estadoExperta = X.criaturas[0].estado();
    type Brazo = "observa" | "rota" | "apagado" | "sola";
    /** 400 s inmovilizada viendo a la experta (o sin ella) y luego 120 s de prueba suelta, con la experta fuera, la comida retirada, hambre 0,5 y una palanca que funciona junto a un objeto nuevo que no hace nada (cambia de lado en cada réplica). Devuelve si fue primero a la palanca y cuándo come el primer gránulo (120 si nunca). */
    const prueba = (brazo: Brazo, k: number): { palanca: number; comida: number } => {
      const tipoConvivencia = brazo === "rota" ? "palanca_rota" : "palanca";
      const s = nuevaSim({ semilla: mezclar(semilla, 75, k, brazo === "sola" ? 0 : 1), objetos: [{ tipo: tipoConvivencia, x: 800 }], criaturas: [{ genoma: gO, x: 560 }], comedero: null });
      const obs = s.criaturas[0];
      obs.nec[0] = 0.5;
      obs.aprendeObservando = brazo !== "apagado";
      obs.atrapada = true;
      if (brazo !== "sola") {
        const e = Criatura.desde({ ...estadoExperta, id: 2, x: 700, accion: null }, mezclar(semilla, 76, k));
        e.azar.s = mezclar(semilla, 77, k);
        e.reiniciarReloj();
        e.capRegistro = 100000;
        e.nec[0] = 0.55;
        s.criaturas.push(e);
      }
      s.avanzar(400);
      if (brazo !== "sola") s.criaturas.splice(1, 1);
      for (const o of [...s.mundo.objetos]) s.mundo.quitar(o.id);
      const izq = k % 2 === 0;
      s.mundo.agregar("palanca", izq ? 250 : 750);
      s.mundo.agregar("bola_fija", izq ? 750 : 250);
      obs.nec[0] = 0.5;
      obs.accion = null;
      obs.atrapada = false;
      obs.x = 500;
      const t0 = s.t;
      let primero = "";
      let comida = 120;
      s.ganchos.push((q) => {
        if (!primero) {
          if (manip(obs, "palanca", t0) > 0) primero = "palanca";
          else if (manip(obs, "bola_fija", t0) > 0) primero = "bola";
        }
        if (comida === 120 && impactos(obs, "probar", "granulo", t0, Infinity, (r) => r[0] > 0.1) > 0) comida = q.t - t0;
      });
      s.avanzar(120);
      return { palanca: primero === "palanca" ? 1 : primero === "bola" ? 0 : 0.5, comida };
    };
    const brazos: Brazo[] = ["observa", "rota", "apagado", "sola"];
    const REP = 12;
    const p: Record<string, number> = {}, c: Record<string, number> = {};
    for (const b of brazos) {
      const r = Array.from({ length: REP }, (_, k) => prueba(b, k));
      p[b] = media(r.map((x) => x.palanca));
      c[b] = mediana(r.map((x) => x.comida));
    }
    return resultado(semilla, {
      "realce: con el modo de observación, quien vio a la experta usar la palanca va antes a ella que a un objeto nuevo, más que quien solo la veía quieta (+0,2)": p.observa > p.sola + 0.2,
      "sin el modo, ver a la experta no la hace más atractiva sino menos (va a ella menos que quien solo la veía quieta): la trampa de confianza": p.apagado < p.sola - 0.2,
      "resultado: tarda menos en comerse el primer gránulo que quien solo veía la palanca quieta (15 s menos)": c.observa < c.sola - 15,
      "y menos que si la palanca estaba estropeada mientras la veía (la otra actuaba y no salía nada) (15 s menos)": c.observa < c.rota - 15,
    }, {
      palancaPrimeroObserva: p.observa, palancaPrimeroEstropeada: p.rota, palancaPrimeroSinAprender: p.apagado, palancaPrimeroSola: p.sola,
      comeObserva: c.observa, comeEstropeada: c.rota, comeSinAprender: c.apagado, comeSola: c.sola,
    }, null, 600);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso17: Caso = {
  id: "17",
  titulo: "Afinidad desigual",
  hipotesis: "Dos criaturas que conviven no tienen por qué quererse por igual. Si una es muy sociable y apegada y la otra poco, la primera termina con más afecto por la segunda que al revés y es quien más la busca. Si las dos son sociables, la relación es pareja. Se mide a los 900 s: con la convivencia larga el afecto de las dos se satura y la diferencia desaparece. La asimetría sale del carácter y de lo vivido, no de una categoría de relación.",
  minimo: 0.8,
  ejecutar(semilla) {
    const REP = 6;
    /** Convive 900 s y devuelve el afecto de cada una por la otra y cuántas veces decidió acercarse a ella. */
    const convivir = (sociableA: number, sociableB: number, k: number) => {
      const gA = clonarGenoma(genomaDe(semilla, 171));
      const gB = clonarGenoma(genomaDe(semilla, 172));
      gA.rasgos[R.sociabilidad] = sociableA; gA.rasgos[R.apego] = sociableA;
      gB.rasgos[R.sociabilidad] = sociableB; gB.rasgos[R.apego] = sociableB;
      const s = nuevaSim({ semilla: mezclar(semilla, 173, k), objetos: [{ tipo: "pelota", x: 800 }], criaturas: [{ genoma: gA, x: 500 }, { genoma: gB, x: 1100 }], comedero: { cada: 110, max: 3, tipo: "fruta" } });
      for (const c of s.criaturas) c.reconocePorRasgos = true;
      s.avanzar(900);
      const [A, B] = s.criaturas;
      const afecto = (c: Criatura, otra: Criatura): number => c.mem.vinculos.find((q) => q.id === 1000 + otra.id)?.afecto ?? 0;
      const busca = (c: Criatura, otra: Criatura): number => c.registro.filter((r) => r.kind === "inicio" && r.v === "acercarse" && r.obj === 1000 + otra.id).length;
      return { aAB: afecto(A, B), aBA: afecto(B, A), buscaAB: busca(A, B), buscaBA: busca(B, A) };
    };
    const med = (xs: number[]) => mediana(xs);
    const asim = Array.from({ length: REP }, (_, k) => convivir(0.9, 0.12, k));
    const sim = Array.from({ length: REP }, (_, k) => convivir(0.9, 0.9, k));
    const dAsim = med(asim.map((x) => x.aAB - x.aBA));
    const dSim = med(sim.map((x) => Math.abs(x.aAB - x.aBA)));
    const buscaA = med(asim.map((x) => x.buscaAB)), buscaB = med(asim.map((x) => x.buscaBA));
    // En cuantas de las seis convivencias la sociable supera a la otra (no depende de un umbral de tamano)
    const masAfecto = asim.filter((x) => x.aAB > x.aBA).length;
    const masBusca = asim.filter((x) => x.buscaAB > x.buscaBA).length;
    return resultado(semilla, {
      "la sociable y apegada termina con más afecto por la otra que al revés en al menos 5 de 6 convivencias": masAfecto >= 5,
      "y es quien más la busca (más decisiones de acercarse) en al menos 4 de 6": masBusca >= 4,
      "si las dos son sociables, el afecto es parecido (diferencia mediana menor que 0,2)": dSim < 0.2,
    }, { diferenciaAfectoAsimetrica: dAsim, buscaLaSociable: buscaA, buscaLaPocoSociable: buscaB, diferenciaAfectoSimetrica: dSim, afectoSociable: med(asim.map((x) => x.aAB)), afectoPocoSociable: med(asim.map((x) => x.aBA)) }, null, 1500);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso18: Caso = {
  id: "18",
  titulo: "Criar una hostil",
  hipotesis: "La hostilidad no se escribe, se cría. Una criatura de carácter agresivo a la que su cuidador acaricia justo después de cada empujón a su compañera aprende a empujar. La misma criatura sin esa recompensa, o una de carácter pacífico con ella, no. Se mira además si lo criado se traslada a una criatura nueva, sin recompensa y con comida de sobra, y si la rival aprende a asociarla con daño.",
  minimo: 0.8,
  ejecutar(semilla) {
    const REPOSO = 1800;
    type Brazo = "premiada agresiva" | "sin premio agresiva" | "premiada pacifica";
    const gH = genomaDe(semilla, 181);
    const gV = genomaDe(semilla, 182);
    const gN = genomaDe(semilla, 183);
    const empujones = (c: Criatura, desde = 0, hasta = Infinity): number => c.registro.filter((r) => r.kind === "impacto" && r.v === "empujar" && r.tipo === "criatura" && r.t >= desde && r.t < hasta).length;
    const criar = (brazo: Brazo): { H: Criatura; V: Criatura; total: number; ultimos: number; saludV: number; evitaV: number } => {
      const h = clonarGenoma(gH);
      h.rasgos[R.agresividad] = brazo === "premiada pacifica" ? 0.08 : 0.9;
      const v = clonarGenoma(gV);
      v.rasgos[R.agresividad] = 0.25;
      const premio = brazo !== "sin premio agresiva";
      const s = nuevaSim({ semilla, objetos: [{ tipo: "pelota", x: 800 }], criaturas: [{ genoma: h, x: 500 }, { genoma: v, x: 1100 }], comedero: { cada: 100, max: 2, tipo: "fruta" } });
      for (const c of s.criaturas) { c.agresion = true; c.reconocePorRasgos = true; c.capRegistro = 200000; }
      const [H, V] = s.criaturas;
      // La rival no se puede apartar (compañera de entrenamiento): asi hay ocasion de volver a intentarlo y se ve si lo aprendido se repite
      V.atrapada = true;
      // El cuidador: una caricia (la herramienta de premiar del juego, que refuerza al instante lo ultimo que hizo) justo despues de cada empujon a su companera
      let vistos = 0;
      if (premio) s.ganchos.push(() => {
        const n = empujones(H);
        if (n > vistos) { vistos = n; H.recompensar({ mundo: s.mundo, criaturas: s.criaturas, t: s.t }); }
      });
      s.avanzar(REPOSO);
      // Lo que la rival ha aprendido de ella: cuanto dano asocia a su aspecto
      const pH = V.mem.predecir("presencia", featuresCriatura(H), new Array(10).fill(1), 0);
      return { H, V, total: empujones(H), ultimos: empujones(H, REPOSO - 600), saludV: V.salud, evitaV: pH.res[C.dano] * pH.conf };
    };
    const brazos: Brazo[] = ["premiada agresiva", "sin premio agresiva", "premiada pacifica"];
    const crias = Object.fromEntries(brazos.map((b) => [b, criar(b)])) as Record<Brazo, ReturnType<typeof criar>>;
    // Fuera de donde se crio: una criatura nueva y comida de sobra
    const normal = (b: Brazo): number => {
      const r = crias[b];
      const s = nuevaSim({ semilla: mezclar(semilla, 184, brazos.indexOf(b)), objetos: [{ tipo: "pelota", x: 800 }], criaturas: [{ genoma: clonarGenoma(r.H.genoma), x: 500 }, { genoma: clonarGenoma(gN), x: 1100 }], comedero: { cada: 20, max: 8, tipo: "fruta" } });
      // La criada, con todo lo vivido, entra en la sala nueva (en el sitio de la primera criatura)
      const H = Criatura.desde({ ...r.H.estado(), id: 1, x: 500, accion: null }, mezclar(semilla, 185, brazos.indexOf(b)));
      H.reiniciarReloj();
      H.capRegistro = 100000;
      // Llega descansada y tranquila: lo que se mide es lo aprendido, no el sueno o la rabia con que acabo la crianza
      H.dormido = false;
      H.accion = null;
      H.nec[1] = 0.1; H.nec[0] = 0.3;
      H.emo.fill(0);
      s.criaturas[0] = H;
      for (const c of s.criaturas) { c.agresion = true; c.reconocePorRasgos = true; c.capRegistro = 100000; }
      s.avanzar(300);
      return empujones(H);
    };
    const n: Record<Brazo, number> = { "premiada agresiva": normal("premiada agresiva"), "sin premio agresiva": normal("sin premio agresiva"), "premiada pacifica": normal("premiada pacifica") };
    const e = crias["premiada agresiva"], a = crias["sin premio agresiva"], p = crias["premiada pacifica"];
    return resultado(semilla, {
      "comprobación: con premio, la agresiva empuja a la rival al menos 5 veces y la rival lo asocia con daño (0,2 o más)": e.total >= 5 && e.evitaV > 0.2,
      "aprende que compensa: con premio empuja a la rival mucho más que sin premio y que la pacífica (al menos 20 veces y el triple que cada una)": e.total >= 20 && e.total > a.total * 3 && e.total > p.total * 3,
      "lo criado se ve fuera: con una criatura nueva, comida de sobra y sin premio, empuja más (3 o más) que las criadas de otra manera": n["premiada agresiva"] >= 3 && n["premiada agresiva"] > n["sin premio agresiva"] + 2 && n["premiada agresiva"] > n["premiada pacifica"] + 2,
      "la rival aprende a asociarla con daño (más que la de la crianza pacífica)": e.evitaV > p.evitaV + 0.1,
    }, {
      empujonesCriaEscasezAgresiva: e.total, empujonesCriaAbundancia: a.total, empujonesCriaPacifica: p.total,
      ultimos600EscasezAgresiva: e.ultimos, ultimos600Abundancia: a.ultimos, ultimos600Pacifica: p.ultimos,
      fueraEscasezAgresiva: n["premiada agresiva"], fueraAbundancia: n["sin premio agresiva"], fueraPacifica: n["premiada pacifica"],
      saludRivalEscasezAgresiva: e.saludV, saludRivalAbundancia: a.saludV, saludRivalPacifica: p.saludV,
      danoAsociadoEscasezAgresiva: e.evitaV, danoAsociadoPacifica: p.evitaV,
    }, e.H, REPOSO);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso19: Caso = {
  id: "19",
  titulo: "Querer a quien te maltrata",
  hipotesis: "Recibir daño de otra criatura no crea afecto por ella, ni siquiera tras mucho tiempo juntas, y su aspecto queda asociado con peligro. Pero si el cuidador recompensa a la víctima justo después de cada golpe, puede acabar queriendo a quien la maltrata y acercándose a ella. Se separa con controles: maltrato sin premio y convivencia sin maltrato.",
  minimo: 0.8,
  ejecutar(semilla) {
    const REP = 12;
    type Brazo = "maltrato y premio" | "maltrato sin premio" | "sin maltrato";
    const gV = genomaDe(semilla, 191);
    const gH = genomaDe(semilla, 192);
    const gN = genomaDe(semilla, 193);
    const vivir = (brazo: Brazo): { s: Simulacion; V: Criatura; H: Criatura; afecto: number; danoH: number } => {
      const s = nuevaSim({ semilla, objetos: [{ tipo: "pelota", x: 800 }], criaturas: [{ genoma: clonarGenoma(gV), x: 500 }, { genoma: clonarGenoma(gH), x: 1100 }], comedero: { cada: 100, max: 2, tipo: "fruta" } });
      const [V, H] = s.criaturas;
      for (const c of s.criaturas) { c.reconocePorRasgos = true; c.capRegistro = 50000; }
      let prox = 20;
      let premiar = -1;
      s.ganchos.push(() => {
        if (brazo === "sin maltrato") return;
        if (s.t >= prox) {
          prox += 10;
          // El maltrato: la otra se pone a su lado y le hace dano, y la victima lo vive como cualquier golpe
          H.x = V.x + 70; H.accion = null;
          V.sufrir(0.4, 1000 + H.id, null, 0.3);
          V.anotarAgravio(1000 + H.id, 0.4);
          H.anotarAgravio(1000 + V.id, 0.25);
          if (brazo === "maltrato y premio") premiar = s.t + 1;
        }
        if (premiar > 0 && s.t >= premiar) { premiar = -1; V.recompensar({ mundo: s.mundo, criaturas: s.criaturas, t: s.t }); }
      });
      s.avanzar(600);
      const afecto = V.mem.vinculos.find((q) => q.id === 1000 + H.id)?.afecto ?? 0;
      const pH = V.mem.predecir("presencia", featuresCriatura(H), new Array(10).fill(1), 0);
      return { s, V, H, afecto, danoH: pH.res[C.dano] * pH.conf };
    };
    /** A quien llega primero la victima, con la maltratadora y una criatura nueva quietas a 280 de ella (cambian de lado cada vez). */
    const eleccion = (r0: { s: Simulacion; V: Criatura; H: Criatura }): { pH: number; pN: number } => {
      let h = 0, n = 0;
      for (let k = 0; k < REP; k++) {
        const r = replica(r0.s, k);
        const [V, H] = r.criaturas;
        const N = new Criatura(3, "Otra", clonarGenoma(gN), 1080, mezclar(semilla, 194, k));
        N.reconocePorRasgos = true; N.capRegistro = 1000;
        for (const o of [...r.mundo.objetos]) r.mundo.quitar(o.id);
        r.comedero = null;
        r.criaturas = [V, H, N];
        const izq = k % 2 === 0;
        V.x = 800; V.accion = null; H.x = izq ? 520 : 1080; N.x = izq ? 1080 : 520;
        H.atrapada = true; N.atrapada = true; H.accion = null; N.accion = null;
        for (const c of [V]) { c.nec[0] = 0.1; c.nec[1] = 0.1; c.nec[3] = 0.2; c.nec[4] = 0.4; c.emo.fill(0); }
        let primera = "";
        r.ganchos.push(() => {
          if (primera) return;
          if (Math.abs(V.x - H.x) < 200) primera = "H";
          else if (Math.abs(V.x - N.x) < 200) primera = "N";
        });
        r.avanzar(15);
        if (primera === "H") h++;
        else if (primera === "N") n++;
      }
      return { pH: h / REP, pN: n / REP };
    };
    const brazos: Brazo[] = ["maltrato y premio", "maltrato sin premio", "sin maltrato"];
    const v = Object.fromEntries(brazos.map((b) => [b, vivir(b)])) as Record<Brazo, ReturnType<typeof vivir>>;
    const e = Object.fromEntries(brazos.map((b) => [b, eleccion(v[b])])) as Record<Brazo, { pH: number; pN: number }>;
    const p = e["maltrato y premio"], q = e["maltrato sin premio"];
    return resultado(semilla, {
      "con premio tras cada golpe, la victima acaba queriendo a quien la maltrata (afecto de 0,25 o más)": v["maltrato y premio"].afecto >= 0.25,
      "sin premio, el maltrato no crea afecto (menos de 0,1) y su aspecto queda asociado con daño (0,2 o más)": v["maltrato sin premio"].afecto < 0.1 && v["maltrato sin premio"].danoH >= 0.2,
      "con premio se acerca antes a la maltratadora que a una criatura nueva (+0,2)": p.pH > p.pN + 0.2,
      "sin premio se acerca antes a la criatura nueva (+0,2)": q.pN > q.pH + 0.2,
    }, {
      afectoConPremio: v["maltrato y premio"].afecto, afectoSinPremio: v["maltrato sin premio"].afecto, afectoSinMaltrato: v["sin maltrato"].afecto,
      danoAsociadoConPremio: v["maltrato y premio"].danoH, danoAsociadoSinPremio: v["maltrato sin premio"].danoH,
      llegaALaMaltratadoraConPremio: p.pH, llegaALaNuevaConPremio: p.pN, llegaALaMaltratadoraSinPremio: q.pH, llegaALaNuevaSinPremio: q.pN,
      llegaALaConocidaSinMaltrato: e["sin maltrato"].pH, llegaALaNuevaSinMaltrato: e["sin maltrato"].pN,
    }, v["maltrato y premio"].V, 600);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso20: Caso = {
  id: "20",
  titulo: "Conflicto por la comida",
  hipotesis: "Si la comida que otra está comiendo está ocupada, dos criaturas hambrientas ante una sola raíz de ocho bocados pequeños (veinte rondas de 60 s, con las dos a la misma distancia) entran en conflicto sin que nadie les ordene pelear. Dos pacíficas esperan o buscan otra cosa. Una agresiva y una pacífica: la agresiva empuja a la otra para quedarse con la comida y se lleva la mayor parte. Dos agresivas se empujan mutuamente, y quien es golpeada responde.",
  minimo: 0.8,
  ejecutar(semilla) {
    const RONDAS = 20;
    const POR_RONDA = 60;
    const DUR = RONDAS * POR_RONDA;
    type Brazo = "dos pacificas" | "agresiva y pacifica" | "dos agresivas";
    const empujones = (c: Criatura): number => c.registro.filter((r) => r.kind === "impacto" && r.v === "empujar" && r.tipo === "criatura").length;
    const bocados = (c: Criatura): number => c.registro.filter((r) => r.kind === "impacto" && r.v === "probar" && r.tipo === "raiz" && (r.res?.[0] ?? 0) > 0.05).length;
    const probar = (brazo: Brazo) => {
      const gA = clonarGenoma(genomaDe(semilla, 201));
      const gB = clonarGenoma(genomaDe(semilla, 202));
      gA.rasgos[R.agresividad] = brazo === "dos pacificas" ? 0.1 : 0.9;
      gB.rasgos[R.agresividad] = brazo === "dos agresivas" ? 0.9 : 0.1;
      const s = nuevaSim({ semilla, objetos: [{ tipo: "pelota", x: 800 }], criaturas: [{ genoma: gA, x: 500 }, { genoma: gB, x: 1100 }], comedero: null });
      for (const c of s.criaturas) { c.agresion = true; c.conflictoComida = true; c.reconocePorRasgos = true; c.capRegistro = 200000; c.nec[0] = 0.6; }
      const [A, B] = s.criaturas;
      // Cada ronda: una sola fruta en medio y las dos hambrientas a la misma distancia
      let ronda = -1;
      s.ganchos.push(() => {
        const r = Math.floor(s.t / POR_RONDA);
        if (r === ronda || r >= RONDAS) return;
        ronda = r;
        for (const o of [...s.mundo.objetos]) if (o.tipo === "raiz") s.mundo.quitar(o.id);
        s.mundo.agregar("raiz", 800, { porciones: 8 });
        A.x = 500; B.x = 1100; A.accion = null; B.accion = null;
        A.nec[0] = 0.7; B.nec[0] = 0.7; A.nec[1] = 0.1; B.nec[1] = 0.1;
      });
      s.avanzar(DUR);
      const bA = bocados(A), bB = bocados(B);
      return {
        empA: empujones(A), empB: empujones(B), bloqA: A.mem.acciones["bloqueada:comida"] ?? 0, bloqB: B.mem.acciones["bloqueada:comida"] ?? 0,
        parteA: bA + bB > 0 ? bA / (bA + bB) : 0.5, comidas: bA + bB, empTerc: empujones(A) > 0 ? empujones(A) : 0,
      };
    };
    const p = probar("dos pacificas"), m = probar("agresiva y pacifica"), d = probar("dos agresivas");
    return resultado(semilla, {
      "la comida ocupada bloquea: entre dos pacíficas hay bloqueos (3 o más) y casi no hay empujones (2 o menos)": p.bloqA + p.bloqB >= 3 && p.empA + p.empB <= 2,
      "una agresiva y una pacífica: la agresiva empuja a la otra (5 o más) y el triple que ella": m.empA >= 5 && m.empA > m.empB * 3,
      "y se queda con la mayor parte de la comida (más del 55 %)": m.parteA > 0.55,
      "dos agresivas: se empujan mutuamente (cada una 3 o más), es decir, la golpeada responde": d.empA >= 3 && d.empB >= 3,
    }, {
      pacificasBloqueos: p.bloqA + p.bloqB, pacificasEmpujones: p.empA + p.empB, pacificasComidas: p.comidas,
      mixtaEmpujaAgresiva: m.empA, mixtaEmpujaPacifica: m.empB, mixtaParteAgresiva: m.parteA, mixtaBloqueosPacifica: m.bloqB,
      agresivasEmpujan1: d.empA, agresivasEmpujan2: d.empB, agresivasBloqueos: d.bloqA + d.bloqB,
    }, null, DUR);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso21: Caso = {
  id: "21",
  titulo: "Carroñeo y depredación",
  hipotesis: "Comer un cadáver que ya estaba ahí enseña que la carne alimenta, pero no enseña a matar. Con ese saber, el hambre y una presa que se ve débil, una agresiva ataca y, si el cuerpo queda donde cae, come enseguida: el crédito retrasado de siempre liga el ataque con la comida y ataca más a las siguientes. Matar no recibe ninguna recompensa. Sin haber probado carne, mata menos. Y si no queda cuerpo, el ataque no se refuerza.",
  minimo: 0.8,
  ejecutar(semilla) {
    const POR_RONDA = 90;
    const RONDAS_CARRONA = 3;
    const RONDAS_PRESA = 8;
    type Brazo = "carroña y presas con cuerpo" | "carroña y presas sin cuerpo" | "sin carroña";
    const gH = clonarGenoma(genomaDe(semilla, 211));
    gH.rasgos[R.agresividad] = 0.9;
    const gP = genomaDe(semilla, 212);
    const empujones = (c: Criatura, t0 = 0, t1 = Infinity): number => c.registro.filter((r) => r.kind === "impacto" && r.v === "empujar" && r.tipo === "criatura" && r.t >= t0 && r.t < t1).length;
    const bocadosCadaver = (c: Criatura, t0 = 0, t1 = Infinity): number => c.registro.filter((r) => r.kind === "impacto" && r.v === "probar" && r.tipo === "cadaver" && (r.res?.[0] ?? 0) > 0.05 && r.t >= t0 && r.t < t1).length;
    const crear = (id: number, cuerpo: boolean): Criatura => {
      const p = new Criatura(id, `Presa ${id}`, clonarGenoma(gP), 1000, mezclar(semilla, 213, id));
      p.agresion = cuerpo;
      p.mortalidad = "permanente";
      p.salud = 0.3;
      p.atrapada = true;
      p.capRegistro = 500;
      return p;
    };
    const probar = (brazo: Brazo) => {
      const s = nuevaSim({ semilla, objetos: [{ tipo: "pelota", x: 800 }], criaturas: [{ genoma: clonarGenoma(gH), x: 500 }], comedero: null, mortalidad: "permanente" });
      const H = s.criaturas[0];
      H.agresion = true; H.conflictoComida = true; H.reconocePorRasgos = true; H.capRegistro = 200000;
      const total = RONDAS_CARRONA + RONDAS_PRESA;
      let ronda = -1;
      let nPresa = 10;
      const presas: Criatura[] = [];
      const limpiar = (): void => {
        for (const o of [...s.mundo.objetos]) if (o.tipo === "cadaver") s.mundo.quitar(o.id);
        s.criaturas = s.criaturas.filter((c) => c === H);
        H.x = 500; H.accion = null; H.nec[0] = 0.7; H.nec[1] = 0.1; H.emo.fill(0); H.dormido = false;
      };
      s.ganchos.push(() => {
        const r = Math.floor(s.t / POR_RONDA);
        if (r === ronda || r >= total) return;
        ronda = r;
        limpiar();
        if (r < RONDAS_CARRONA) {
          // Primero solo un cadaver que ya estaba ahi (salvo en el brazo que nunca prueba carne)
          if (brazo !== "sin carroña") s.mundo.agregar("cadaver", 1000, { porciones: 6 });
        } else {
          const p = crear(nPresa++, brazo === "carroña y presas con cuerpo");
          presas.push(p);
          s.criaturas.push(p);
        }
      });
      s.avanzar(total * POR_RONDA);
      const t0 = RONDAS_CARRONA * POR_RONDA;
      const porRonda = (a: number, b: number): number => empujones(H, t0 + a * POR_RONDA, t0 + b * POR_RONDA) / (b - a);
      const primeras = porRonda(0, 3), ultimas = porRonda(RONDAS_PRESA - 3, RONDAS_PRESA);
      const matadas = presas.filter((p) => !p.vivo).length;
      const carrona = bocadosCadaver(H, 0, t0);
      const cazada = bocadosCadaver(H, t0);
      // Prueba comun: una presa viva y debil, sin cuerpo al morir
      limpiar();
      const test = crear(99, false);
      s.criaturas.push(test);
      const tt = s.t;
      s.avanzar(POR_RONDA);
      return { primeras, ultimas, matadas, carrona, cazada, test: empujones(H, tt) };
    };
    const d = probar("carroña y presas con cuerpo"), n = probar("carroña y presas sin cuerpo"), c = probar("sin carroña");
    return resultado(semilla, {
      "carroñeo: come el cadáver que ya estaba (3 o más bocados) sin que nadie se lo enseñe": d.carrona >= 3,
      "sabiendo que la carne alimenta, una presa débil le da motivo para atacar: mata al menos 2 presas en 8 rondas y se las come (3 o más bocados)": d.matadas >= 2 && d.cazada >= 3,
      "sin haber probado carne mata menos presas que quien carroñeó antes": c.matadas < d.matadas,
      "el cuerpo refuerza: con cuerpo mata más presas que sin él (al menos una más)": d.matadas >= n.matadas + 1,
    }, {
      conCuerpoMatadas: d.matadas, conCuerpoCarrona: d.carrona, conCuerpoCazada: d.cazada, conCuerpoPrimeras: d.primeras, conCuerpoUltimas: d.ultimas, conCuerpoPrueba: d.test,
      sinCuerpoMatadas: n.matadas, sinCuerpoPrimeras: n.primeras, sinCuerpoUltimas: n.ultimas, sinCuerpoPrueba: n.test,
      sinCarronaMatadas: c.matadas, sinCarronaPrimeras: c.primeras, sinCarronaUltimas: c.ultimas, sinCarronaPrueba: c.test,
    }, null, (RONDAS_CARRONA + RONDAS_PRESA) * POR_RONDA);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso22: Caso = {
  id: "22",
  titulo: "Manías por el aspecto y por la conducta",
  hipotesis: "Una criatura puede coger manía a un rasgo físico (los cuernos, por ejemplo) o a una conducta (pegar a otras) por lo que ha vivido, y esa manía se aplica a criaturas que no conoce, sin que nadie se lo diga. Si la maltrata una con cuernos, rehúye a las nuevas con cuernos y prefiere a las que no los tienen. Si la maltrata una sin cuernos, al revés. Si ha visto pegar a una criatura que no es ella, la prefiere menos que a una pacífica aunque a ella nunca le haya hecho nada.",
  minimo: 0.8,
  ejecutar(semilla) {
    const REP = 16;
    type Brazo = "maltrata con cuernos" | "maltrata sin cuernos" | "sin maltrato";
    const gV = genomaDe(semilla, 221);
    const gH = genomaDe(semilla, 222);
    const gN = genomaDe(semilla, 223);
    const conCuernos = (g: Genoma, c: number): Genoma => { const q = clonarGenoma(g); q.cuerpo.cuernos = c; return q; };
    const vivir = (brazo: Brazo) => {
      // En el control la compañera tiene cuernos intermedios: la convivencia agradable enseña a querer los rasgos de quien convive, y asi no inclina hacia ninguno
      const horn = brazo === "maltrata con cuernos" ? 1 : brazo === "maltrata sin cuernos" ? 0 : 0.5;
      const s = nuevaSim({ semilla, objetos: [{ tipo: "pelota", x: 800 }], criaturas: [{ genoma: clonarGenoma(gV), x: 500 }, { genoma: conCuernos(gH, horn), x: 1100 }], comedero: { cada: 100, max: 2, tipo: "fruta" } });
      const [V, H] = s.criaturas;
      for (const c of s.criaturas) { c.reconocePorRasgos = true; c.gustos = true; c.capRegistro = 50000; }
      let prox = 20;
      s.ganchos.push(() => {
        if (brazo === "sin maltrato" || s.t < prox) return;
        prox += 10;
        H.x = V.x + 70; H.accion = null;
        V.sufrir(0.4, 1000 + H.id, null, 0.3);
        V.anotarAgravio(1000 + H.id, 0.4);
      });
      s.avanzar(400);
      return { s, V };
    };
    /** A cual de dos criaturas nuevas, iguales salvo en los cuernos, llega antes (cambian de lado cada vez). Devuelve la proporcion de veces que llega antes a la sin cuernos. */
    const eleccion = (s0: Simulacion): number => {
      let sin = 0, total = 0;
      for (let k = 0; k < REP; k++) {
        const r = replica(s0, k);
        const V = r.criaturas[0];
        const A = new Criatura(5, "Con cuernos", conCuernos(gN, 1), 1080, mezclar(semilla, 224, k));
        const B = new Criatura(6, "Sin cuernos", conCuernos(gN, 0), 520, mezclar(semilla, 225, k));
        // Solo se distinguen por los cuernos: misma huella
        B.huella = A.huella;
        for (const c of [A, B]) { c.reconocePorRasgos = true; c.gustos = true; c.capRegistro = 500; c.atrapada = true; }
        for (const o of [...r.mundo.objetos]) r.mundo.quitar(o.id);
        r.comedero = null;
        r.criaturas = [V, A, B];
        const izq = k % 2 === 0;
        V.x = 800; V.accion = null; A.x = izq ? 1080 : 520; B.x = izq ? 520 : 1080;
        V.nec[0] = 0.1; V.nec[1] = 0.1; V.nec[3] = 0.2; V.nec[4] = 0.4; V.emo.fill(0);
        let primera = "";
        r.ganchos.push(() => {
          if (primera) return;
          if (Math.abs(V.x - A.x) < 200) primera = "A";
          else if (Math.abs(V.x - B.x) < 200) primera = "B";
        });
        r.avanzar(15);
        if (primera) { total++; if (primera === "B") sin++; }
      }
      return total ? sin / total : 0.5;
    };
    // Conducta: ve a una pegar a una tercera y no le hace nada a ella
    const reputacion = (): { prefierePacifica: number; fama: number } => {
      const gP = clonarGenoma(gN);
      const s = nuevaSim({ semilla, objetos: [], criaturas: [{ genoma: clonarGenoma(gV), x: 800 }, { genoma: clonarGenoma(gH), x: 600 }, { genoma: gP, x: 1000 }, { genoma: genomaDe(semilla, 226), x: 700 }], comedero: null });
      const [V, Ag, , Victima] = s.criaturas;
      for (const c of s.criaturas) { c.reconocePorRasgos = true; c.gustos = true; c.agresion = true; c.capRegistro = 20000; }
      Ag.rasgos[R.agresividad] = 0.95;
      Victima.atrapada = true;
      s.avanzar(5);
      // Ag pega a la victima delante de V, varias veces
      for (let i = 0; i < 6; i++) {
        Ag.x = Victima.x + 60; Ag.accion = null;
        Victima.sufrir(0.3, 1000 + Ag.id, null, 0.2);
        Ag.ultimoGolpe = { t: s.t, contra: Victima.id };
        V.x = 800; Victima.x = 700;
        s.avanzar(3);
      }
      const fama = V.reputacion[1000 + Ag.id]?.agresion ?? 0;
      // Elige entre Ag y Pa, quietas
      let paz = 0, total = 0;
      for (let k = 0; k < REP; k++) {
        const r = replica(s, k);
        const [v, a, p] = r.criaturas;
        for (const o of [...r.mundo.objetos]) r.mundo.quitar(o.id);
        r.criaturas = [v, a, p];
        const izq = k % 2 === 0;
        v.x = 800; v.accion = null; a.x = izq ? 520 : 1080; p.x = izq ? 1080 : 520; a.atrapada = true; p.atrapada = true;
        v.nec[0] = 0.1; v.nec[1] = 0.1; v.nec[3] = 0.2; v.nec[4] = 0.4; v.emo.fill(0);
        let primera = "";
        r.ganchos.push(() => {
          if (primera) return;
          if (Math.abs(v.x - a.x) < 200) primera = "a";
          else if (Math.abs(v.x - p.x) < 200) primera = "p";
        });
        r.avanzar(15);
        if (primera) { total++; if (primera === "p") paz++; }
      }
      return { prefierePacifica: total ? paz / total : 0.5, fama };
    };
    const brazos: Brazo[] = ["maltrata con cuernos", "maltrata sin cuernos", "sin maltrato"];
    const e: Record<string, number> = {};
    for (const b of brazos) e[b] = eleccion(vivir(b).s);
    const rep = reputacion();
    return resultado(semilla, {
      "maltratada por una con cuernos, prefiere a las nuevas sin cuernos (más del 65 % de las veces)": e["maltrata con cuernos"] > 0.65,
      "maltratada por una sin cuernos, prefiere a las nuevas con cuernos (sin cuernos menos del 35 %)": e["maltrata sin cuernos"] < 0.35,
      "sin maltrato no tiene preferencia por los cuernos (entre el 30 y el 70 %)": e["sin maltrato"] >= 0.3 && e["sin maltrato"] <= 0.7,
      "conducta: tras ver pegar a una tercera, la criatura que pega queda con fama (0,3 o más) y prefiere a la pacífica (más del 60 %)": rep.fama >= 0.3 && rep.prefierePacifica > 0.6,
    }, {
      sinCuernosTrasMaltratoConCuernos: e["maltrata con cuernos"], sinCuernosTrasMaltratoSinCuernos: e["maltrata sin cuernos"], sinCuernosSinMaltrato: e["sin maltrato"],
      famaDeLaQuePega: rep.fama, prefierePacificaTrasVerPegar: rep.prefierePacifica,
    }, null, 400);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

type BrazoPareja = "cariño" | "desconocidos" | "castigo previo" | "castigo y agresivas" | "castigo y pacificas" | "manía por cuernos, con cuernos" | "manía por cuernos, sin cuernos";

const empujonesAOtra = (c: Criatura): number => c.registro.filter((r) => r.kind === "impacto" && r.v === "empujar" && r.tipo === "criatura").length;

/** Una pareja adulta de sexos distintos que convive, se prepara segun el brazo (afecto previo, castigo del cuidador, manía) y se deja 1100 s con la reproduccion activada.
    La usan los casos 23 (cortejo y aceptacion) y 23b (rechazo, reaccion y pelea). */
function parejaReproduccion(semilla: number, brazo: BrazoPareja, k: number) {
  const DUR = 1100;
  const genomaConSexo = (variante: number, sexo: 0 | 1): Genoma => {
    for (let v = variante; v < variante + 200; v++) { const g = genomaDe(semilla, v); if (sexoDe(g) === sexo) return g; }
    return genomaDe(semilla, variante);
  };
  const gA = clonarGenoma(genomaConSexo(231, 0));
  const gB = clonarGenoma(genomaConSexo(331, 1));
  if (brazo === "castigo y agresivas") { gA.rasgos[R.agresividad] = 0.9; gB.rasgos[R.agresividad] = 0.9; }
  if (brazo === "castigo y pacificas") { gA.rasgos[R.agresividad] = 0.1; gB.rasgos[R.agresividad] = 0.1; }
  // La hembra (sexo 1) es quien tiene la manía; el pretendiente lleva cuernos o no segun el brazo
  if (brazo === "manía por cuernos, con cuernos") gA.cuerpo.cuernos = 1;
  const s = nuevaSim({ semilla: mezclar(semilla, 232, k), objetos: [{ tipo: "pelota", x: 800 }], criaturas: [{ genoma: gA, x: 500 }, { genoma: gB, x: 700 }], comedero: { cada: 90, max: 3, tipo: "fruta" } });
  const [A, B] = s.criaturas;
  for (const c of s.criaturas) { c.edad = DIA; c.agresion = true; c.gustos = true; c.reconocePorRasgos = true; c.capRegistro = 50000; }
  // Convivencia previa para que haya afecto (nada con los desconocidos; poca con la manía de los cuernos, para que dependa del gusto)
  const previa = brazo === "desconocidos" ? 0 : brazo.startsWith("manía") ? 600 : 1500;
  s.avanzar(previa);
  for (const c of s.criaturas) { c.reproduccion = true; c.impulso = 0.7; c.emo.fill(0); c.nec[0] = 0.1; c.nec[1] = 0.1; }
  if (brazo.startsWith("manía")) B.valencias[3] = -0.9;
  // El cuidador asusta a las dos justo despues de cada uno de tres acercamientos reproductivos (entrenamiento antes de la prueba)
  if (brazo.startsWith("castigo")) {
    for (let i = 0; i < 3; i++) {
      A.ultimoCortejo = { t: s.t, con: B.id }; B.ultimoCortejo = { t: s.t, con: A.id };
      A.asustar({ mundo: s.mundo, criaturas: s.criaturas, t: s.t });
      B.asustar({ mundo: s.mundo, criaturas: s.criaturas, t: s.t });
      for (const c of s.criaturas) { c.emo.fill(0); c.accion = null; }
    }
  }
  s.avanzar(DUR);
  const crias = s.criaturas.filter((c) => c.padres.length).length;
  return {
    reprodujo: crias > 0 || s.embarazos.length > 0 || A.gestando || B.gestando,
    camada: crias, rechazos: (A.mem.acciones.rechazada ?? 0) + (B.mem.acciones.rechazada ?? 0),
    empA: empujonesAOtra(A), empB: empujonesAOtra(B), aversion: Math.max(...A.aversionSexo, ...B.aversionSexo),
  };
}

export const caso23: Caso = {
  id: "23",
  titulo: "Cortejo y aceptación",
  hipotesis: "Una pareja adulta de sexos distintos se reproduce sola si se quieren (impulso, cortejo, aceptación, gestación y parto con camada). Si no se conocen, la otra rechaza, y el rechazo se respeta: no hay embarazo. Un castigo del cuidador justo después de tres acercamientos reproductivos deja una aversión aprendida y la pareja que se quería deja de reproducirse. Una manía por los cuernos hace rechazar a un pretendiente con cuernos y aceptar a uno sin ellos. La reacción al rechazo y la pelea están en el 23b.",
  minimo: 0.8,
  ejecutar(semilla) {
    const REP = 5;
    const frac = (b: BrazoPareja): { p: number; v: ReturnType<typeof parejaReproduccion>[] } => {
      const v = Array.from({ length: REP }, (_, k) => parejaReproduccion(semilla, b, k));
      return { p: v.filter((x) => x.reprodujo).length / REP, v };
    };
    const car = frac("cariño"), des = frac("desconocidos"), cas = frac("castigo previo");
    const hCon = frac("manía por cuernos, con cuernos"), hSin = frac("manía por cuernos, sin cuernos");
    return resultado(semilla, {
      "si se quieren, la pareja se reproduce sola (en al menos 3 de 5 intentos)": car.p >= 3 / 5,
      "si no se conocen, hay rechazos y no hay embarazo (como mucho 1 de 5)": mediana(des.v.map((x) => x.rechazos)) >= 1 && des.p <= 1 / 5,
      "un castigo tras tres acercamientos deja aversión y deja de reproducirse (menos de la mitad que sin castigo)": cas.p < car.p / 2,
      "manía por los cuernos: rechaza al pretendiente con cuernos y acepta al que no los tiene": hCon.p <= 1 / 5 && hSin.p >= 3 / 5,
    }, {
      reproduceCarino: car.p, reproduceDesconocidos: des.p, reproduceCastigo: cas.p, reproduceConCuernos: hCon.p, reproduceSinCuernos: hSin.p,
      rechazosDesconocidos: mediana(des.v.map((x) => x.rechazos)), rechazosCastigo: mediana(cas.v.map((x) => x.rechazos)),
      aversionTrasCastigo: mediana(cas.v.map((x) => x.aversion)), criasCarino: mediana(car.v.map((x) => x.camada)),
    }, null, 1100);
  },
};

export const caso23b: Caso = {
  id: "23b",
  titulo: "Rechazo, reacción y pelea",
  hipotesis: "Tras un rechazo, cada una reacciona al azar según su carácter y su entrenamiento: enfado, miedo, indiferencia o alegría (también quien rechaza). La violencia solo la ejerce quien se enfada siendo agresiva, y si lo están las dos pelean: la pelea es una probabilidad que depende del carácter. El rechazo se respeta: nunca hay embarazo por haber peleado. Un premio tras una reacción la hace más probable y un susto menos.",
  minimo: 0.8,
  ejecutar(semilla) {
    const REP = 5;
    const agr = Array.from({ length: REP }, (_, k) => parejaReproduccion(semilla, "castigo y agresivas", k));
    const pac = Array.from({ length: REP }, (_, k) => parejaReproduccion(semilla, "castigo y pacificas", k));
    const med = (xs: number[]) => mediana(xs);
    const hayViolencia = (r: typeof agr): number => r.filter((x) => Math.max(x.empA, x.empB) >= 3).length / r.length;
    // Pelea: las dos se golpean (dos golpes cada una como minimo: las pacificas dan uno de tanteo por curiosidad). Acaba cuando el miedo hace huir a una, no tiene que durar.
    const mutua = (r: typeof agr): number => r.filter((x) => Math.min(x.empA, x.empB) >= 2).length / r.length;
    const violencia = (r: typeof agr): number => med(r.map((x) => Math.max(x.empA, x.empB)));
    const criatura = (agresividad: number) => {
      const ss = nuevaSim({ semilla: mezclar(semilla, 242), objetos: [], criaturas: [{ genoma: (() => { const g = clonarGenoma(genomaDe(semilla, 241)); g.rasgos[R.agresividad] = agresividad; return g; })(), x: 500 }], comedero: null });
      const c = ss.criaturas[0];
      c.reproduccion = true; c.agresion = true;
      return { ss, c };
    };
    // La reaccion al rechazo segun el caracter, muestreada directamente (sin simulacion)
    const enfadoSegunCaracter = (agresividad: number): number => {
      const { c } = criatura(agresividad);
      let n = 0;
      for (let i = 0; i < 300; i++) if (c.reaccionAlRechazo(0, 0.4) === 0) n++;
      return n / 300;
    };
    // Entrenamiento: 20 rechazos en que se premia (o se asusta) cada enfado, y luego 300 muestras sin entrenar mas
    const muestraEnfados = (signo: 0 | 1 | -1): number => {
      const { ss, c } = criatura(0.9);
      const env = () => ({ mundo: ss.mundo, criaturas: ss.criaturas, t: ss.t });
      for (let i = 0; i < 20 && signo !== 0; i++) {
        ss.t += 10;
        const r = c.reaccionAlRechazo(0, 0.4);
        c.ultimoRechazo = { t: ss.t, rol: 0, reaccion: r };
        if (r === 0) { if (signo < 0) c.recompensar(env()); else c.asustar(env()); }
      }
      let n = 0;
      for (let i = 0; i < 300; i++) if (c.reaccionAlRechazo(0, 0.4) === 0) n++;
      return n / 300;
    };
    const entr = { base: muestraEnfados(0), premio: muestraEnfados(-1), susto: muestraEnfados(1) };
    const enfAgr = enfadoSegunCaracter(0.9), enfPac = enfadoSegunCaracter(0.1);
    return resultado(semilla, {
      "las agresivas se enfadan más tras un rechazo que las pacíficas (reacción muestreada: probabilidad de enfado)": enfAgr > enfPac + 0.2,
      "la violencia es de quien se enfada siendo agresiva: las agresivas la ejercen (3 o más empujones) en alguna réplica y las pacíficas casi nunca (menos de 2 de mediana)": hayViolencia(agr) >= 1 / REP && violencia(pac) < 2,
      "la pelea mutua es una probabilidad que depende del carácter: ocurre en más del 20 % de las réplicas de agresivas y en menos del 20 % de las de pacíficas": mutua(agr) > 0.2 && mutua(pac) < 0.2,
      "entrenamiento: tras premiar un enfado, enfadarse es más probable; tras asustarlo, menos": entr.premio > entr.base * 1.25 && entr.susto < entr.base * 0.75,
      "el rechazo se respeta: en ningún intento de las agresivas hay embarazo por haber peleado (como mucho 1 de 5)": agr.filter((x) => x.reprodujo).length <= 1,
    }, {
      violenciaAgresivas: violencia(agr), violenciaPacificas: violencia(pac), probViolenciaAgresivas: hayViolencia(agr),
      probPeleaMutuaAgresivas: mutua(agr), probPeleaMutuaPacificas: mutua(pac),
      enfadoSegunCaracterAgresiva: enfAgr, enfadoSegunCaracterPacifica: enfPac,
      enfadoBase: entr.base, enfadoTrasPremio: entr.premio, enfadoTrasSusto: entr.susto,
    }, null, 1100);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso24: Caso = {
  id: "24",
  titulo: "Calma tras la pelea",
  hipotesis: "Una pelea entre dos agresivas no dura para siempre: la fatiga de los golpes limita los golpes, la frustración y la agresión bajan después, y vuelven a sus actividades normales. Calmarse no es olvidar: la aversión y la asociación de peligro se quedan. Una criatura herida o asustada tarda más en recuperarse. Al reencontrarse no se pelean automáticamente.",
  minimo: 0.8,
  ejecutar(semilla) {
    const REP = 5;
    const FIN = 900;
    type Brazo = "sanas" | "heridas" | "asustadas";
    const gA = clonarGenoma(genomaDe(semilla, 241));
    const gB = clonarGenoma(genomaDe(semilla, 242));
    gA.rasgos[R.agresividad] = 0.9;
    gB.rasgos[R.agresividad] = 0.9;
    const golpes = (c: Criatura, t0 = 0, t1 = Infinity): number => c.registro.filter((r) => r.kind === "impacto" && r.v === "empujar" && r.tipo === "criatura" && r.t >= t0 && r.t < t1).length;
    const actividad = (c: Criatura, t0: number, t1: number): number => c.registro.filter((r) => r.kind === "impacto" && r.tipo !== "criatura" && r.t >= t0 && r.t < t1).length;
    const pelea = (brazo: Brazo, k: number) => {
      const s = nuevaSim({ semilla: mezclar(semilla, 243, k), objetos: [{ tipo: "pelota", x: 800 }, { tipo: "fruta", x: 1200, porciones: 6 }], criaturas: [{ genoma: clonarGenoma(gA), x: 500 }, { genoma: clonarGenoma(gB), x: 560 }], comedero: { cada: 120, max: 2, tipo: "fruta" } });
      const [A, B] = s.criaturas;
      for (const c of s.criaturas) { c.edad = DIA; c.agresion = true; c.reconocePorRasgos = true; c.capRegistro = 100000; c.nec[0] = 0.15; c.nec[1] = 0.1; }
      // Empieza la pelea: las dos enfadadas
      for (const c of s.criaturas) c.emo[E.frustracion] = 0.8;
      A.represalia = { contra: B.id, t: 0 }; B.represalia = { contra: A.id, t: 0 };
      if (brazo === "heridas") { A.salud = 0.45; B.salud = 0.45; A.nec[2] = 0.5; B.nec[2] = 0.5; }
      // Asustadas: de temperamento asustadizo y con miedo en el momento. El miedo del momento solo dura unos segundos; lo que dura es el temperamento.
      if (brazo === "asustadas") { A.emo[E.miedo] = 0.9; B.emo[E.miedo] = 0.9; A.rasgos[R.miedo] = 0.9; B.rasgos[R.miedo] = 0.9; }
      let pico = 0;
      let tCalma = FIN;
      let calmaAnotada = false;
      s.ganchos.push(() => {
        const fr = Math.max(A.emo[E.frustracion], B.emo[E.frustracion]);
        if (s.t < 30) pico = Math.max(pico, fr);
        // Calma de combate: la fatiga de los golpes ya se ha ido en las dos (la frustracion de fondo, que sube por cualquier cosa sin recompensa, se mide aparte)
        if (!calmaAnotada && s.t > 20 && Math.max(A.fatiga, B.fatiga) < 0.1) { tCalma = s.t; calmaAnotada = true; }
      });
      s.avanzar(FIN);
      const golpesTotales = golpes(A) + golpes(B);
      const golpesFinales = golpes(A, FIN - 120) + golpes(B, FIN - 120);
      const frFinal = Math.max(A.emo[E.frustracion], B.emo[E.frustracion]);
      const normales = actividad(A, FIN - 150, FIN) + actividad(B, FIN - 150, FIN);
      const aversion = Math.max(
        A.mem.predecir("presencia", featuresCriatura(B), new Array(10).fill(1), 0).res[C.dano] * A.mem.predecir("presencia", featuresCriatura(B), new Array(10).fill(1), 0).conf,
        B.mem.predecir("presencia", featuresCriatura(A), new Array(10).fill(1), 0).res[C.dano] * B.mem.predecir("presencia", featuresCriatura(A), new Array(10).fill(1), 0).conf,
      );
      const agravio = Math.max(A.agravios[1000 + B.id]?.n ?? 0, B.agravios[1000 + A.id]?.n ?? 0);
      // Reencuentro: se separan y se ponen a 300, sin objetos, y se mira un minuto
      for (const o of [...s.mundo.objetos]) s.mundo.quitar(o.id);
      s.comedero = null;
      A.x = 650; B.x = 950; A.accion = null; B.accion = null;
      const t0 = s.t;
      let distMin = 999;
      s.ganchos.push(() => { distMin = Math.min(distMin, Math.abs(A.x - B.x)); });
      s.avanzar(60);
      const nueva = Math.min(golpes(A, t0), golpes(B, t0)) >= 2;
      return { golpesTotales, golpesFinales, pico, frFinal, normales, aversion, agravio, tCalma, nueva, acercaron: distMin < 200 };
    };
    const brazos: Brazo[] = ["sanas", "heridas", "asustadas"];
    const r = Object.fromEntries(brazos.map((b) => [b, Array.from({ length: REP }, (_, k) => pelea(b, k))])) as Record<Brazo, ReturnType<typeof pelea>[]>;
    const med = (b: Brazo, f: (x: ReturnType<typeof pelea>) => number): number => mediana(r[b].map(f));
    const sanas = r.sanas;
    const pNueva = sanas.filter((x) => x.nueva).length / REP;
    return resultado(semilla, {
      "el combate termina: en los últimos 2 minutos ya no se golpean (3 golpes o menos de mediana) y el total no es ilimitado (menos de 250)": med("sanas", (x) => x.golpesFinales) <= 3 && med("sanas", (x) => x.golpesTotales) < 250,
      "la frustración baja tras el desenlace (al final menos de la cuarta parte de su pico)": med("sanas", (x) => x.frFinal) < 0.25 * Math.max(0.1, med("sanas", (x) => x.pico)),
      "recuperan sus actividades normales (5 o más acciones con objetos en los últimos 150 s)": med("sanas", (x) => x.normales) >= 5,
      "calmarse no es olvidar: tras calmarse siguen asociando a la otra con daño (0,1 o más) o guardan agravio (0,05 o más)": med("sanas", (x) => Math.max(x.aversion, x.agravio)) >= 0.05,
      "el reencuentro no provoca automáticamente otra pelea (menos de la mitad de las réplicas)": pNueva < 0.5,
      "la herida alarga la recuperación (tarda un 10 % más o más que las sanas en calmarse)": med("heridas", (x) => x.tCalma) >= 1.1 * med("sanas", (x) => x.tCalma),
      "y el miedo (de temperamento y del momento) también (un 10 % más o más)": med("asustadas", (x) => x.tCalma) >= 1.1 * med("sanas", (x) => x.tCalma),
    }, {
      golpesTotalesSanas: med("sanas", (x) => x.golpesTotales), golpesFinalesSanas: med("sanas", (x) => x.golpesFinales), picoFrustracion: med("sanas", (x) => x.pico), frustracionFinal: med("sanas", (x) => x.frFinal),
      accionesNormales: med("sanas", (x) => x.normales), aversionResidual: med("sanas", (x) => x.aversion), agravioResidual: med("sanas", (x) => x.agravio),
      segundosHastaCalmaSanas: med("sanas", (x) => x.tCalma), segundosHastaCalmaHeridas: med("heridas", (x) => x.tCalma), segundosHastaCalmaAsustadas: med("asustadas", (x) => x.tCalma),
      probNuevaPeleaTrasReencuentro: pNueva, seAcercanAlReencontrarse: sanas.filter((x) => x.acercaron).length / REP,
      golpesTotalesHeridas: med("heridas", (x) => x.golpesTotales), golpesTotalesAsustadas: med("asustadas", (x) => x.golpesTotales),
    }, null, FIN + 60);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso25: Caso = {
  id: "25",
  titulo: "Quien quiere la comida de otra",
  hipotesis: "Una criatura hambrienta que ya sabe que la carne alimenta (por haber carroñeado) intenta quedarse con la comida que otra está comiendo. La otra puede ceder, huir o luchar según su temperamento. No se impone ningún desenlace. Lo que se espera es que el aprendizaje y el carácter produzcan decisiones distintas, que el combate no se convierta en una máquina de golpear hasta que alguien se agote y que se distingan tres motivaciones: competir por la comida de otra, defender la propia y cazar. Después de varias rondas, recuerdan quién les atacó.",
  minimo: 0.8,
  ejecutar(semilla) {
    const REP = 4;
    const RONDAS = 6;
    const POR_RONDA = 90;
    const PREVIA = 3;
    type Brazo = "carroñera y defensor agresivo" | "carroñera y defensor poco agresivo" | "sin carroñeo y defensor agresivo" | "sin carroñeo y defensor poco agresivo";
    const gH = clonarGenoma(genomaDe(semilla, 251));
    gH.rasgos[R.agresividad] = 0.9;
    const gD = genomaDe(semilla, 252);
    type Motivo = "competencia" | "defensa" | "represalia" | "depredadora" | "otra";
    const probar = (brazo: Brazo, k: number) => {
      const carroña = brazo.startsWith("carroñera");
      const agresivoD = brazo.endsWith("defensor agresivo");
      const gd = clonarGenoma(gD);
      gd.rasgos[R.agresividad] = agresivoD ? 0.9 : 0.1;
      const s = nuevaSim({ semilla: mezclar(semilla, 253, k), objetos: [{ tipo: "pelota", x: 800 }], criaturas: [{ genoma: clonarGenoma(gH), x: 400 }], comedero: null });
      const H = s.criaturas[0];
      H.agresion = true; H.conflictoComida = true; H.reconocePorRasgos = true; H.capRegistro = 200000; H.edad = DIA;
      // Aprendizaje previo: tres rondas a solas con un cadaver ya hecho (o sin cadaver, el mismo tiempo)
      for (let i = 0; i < PREVIA; i++) {
        if (carroña) s.mundo.agregar("cadaver", 1000, { porciones: 6 });
        H.x = 400; H.accion = null; H.nec[0] = 0.7; H.nec[1] = 0.1; H.emo.fill(0); H.dormido = false;
        s.avanzar(POR_RONDA);
        for (const o of [...s.mundo.objetos]) if (o.tipo === "cadaver") s.mundo.quitar(o.id);
      }
      // Llega el defensor
      const D = new Criatura(2, "Defensor", gd, 780, mezclar(semilla, 254, k));
      D.agresion = true; D.conflictoComida = true; D.reconocePorRasgos = true; D.capRegistro = 200000; D.edad = DIA; D.mortalidad = H.mortalidad;
      s.criaturas.push(D);
      const t0 = s.t;
      // Cada ronda: una raiz con ocho bocados en medio; el defensor ya la esta comiendo; la otra llega hambrienta desde lejos
      let ronda = -1;
      const motivos: Record<Motivo, number> = { competencia: 0, defensa: 0, represalia: 0, depredadora: 0, otra: 0 };
      const golpesRonda: number[] = Array(RONDAS).fill(0);
      let visto = { H: 0, D: 0 };
      let picoFatiga = 0;
      // Quien ocupaba la comida en el paso anterior: al golpear se suelta la comida de la victima antes de registrar el golpe, asi que hay que mirar antes
      let ocupabaAntes: number | undefined;
      const cuenta = (c: Criatura): number => c.registro.filter((r) => r.kind === "impacto" && r.v === "empujar" && r.tipo === "criatura").length;
      s.ganchos.push(() => {
        const r = Math.floor((s.t - t0) / POR_RONDA);
        if (r !== ronda && r < RONDAS) {
          ronda = r;
          for (const o of [...s.mundo.objetos]) if (o.tipo === "raiz") s.mundo.quitar(o.id);
          s.mundo.agregar("raiz", 800, { porciones: 8 });
          H.x = 400; D.x = 790; H.accion = null; D.accion = null; H.nec[0] = 0.7; D.nec[0] = 0.55; H.nec[1] = 0.1; D.nec[1] = 0.1;
        }
        picoFatiga = Math.max(picoFatiga, H.fatiga, D.fatiga);
        for (const [atacante, otro, clave] of [[H, D, "H"], [D, H, "D"]] as const) {
          const n = cuenta(atacante);
          if (n > visto[clave]) {
            visto[clave] = n;
            if (ronda >= 0 && ronda < RONDAS) golpesRonda[ronda]++;
            const ocupa = (c: Criatura): boolean => ocupabaAntes === c.id;
            let m: Motivo = "otra";
            if (ocupa(atacante)) m = "defensa";
            else if (ocupa(otro)) m = "competencia";
            else if (atacante.represalia && atacante.represalia.contra === otro.id && s.t - atacante.represalia.t < 10) m = "represalia";
            else if (atacante.nec[0] > 0.3 && otro.emo[E.miedo] + otro.nec[2] > 0.25) m = "depredadora";
            motivos[m]++;
          }
        }
        const comidaAhora = s.mundo.objetos.find((o) => o.tipo === "raiz");
        ocupabaAntes = comidaAhora && comidaAhora.ocupante !== undefined && s.t - (comidaAhora.tOcupante ?? -99) < 3.5 ? comidaAhora.ocupante : ocupabaAntes && s.t - 0 < 0 ? ocupabaAntes : undefined;
      });
      s.avanzar(RONDAS * POR_RONDA);
      const bocadosRaiz = (c: Criatura): number => c.registro.filter((q) => q.kind === "impacto" && q.v === "probar" && q.tipo === "raiz" && (q.res?.[0] ?? 0) > 0.05 && q.t >= t0).length;
      const golpesH = cuenta(H), golpesD = cuenta(D);
      const parteH = bocadosRaiz(H) + bocadosRaiz(D) > 0 ? bocadosRaiz(H) / (bocadosRaiz(H) + bocadosRaiz(D)) : 0.5;
      const rondasConGolpes = golpesRonda.filter((g) => g > 0).length;
      const maxGolpesRonda = Math.max(...golpesRonda);
      // Recuperacion: acciones con objetos en los ultimos 150 s... y memoria social
      const normales = H.registro.filter((r) => r.kind === "impacto" && r.tipo !== "criatura" && r.t >= s.t - 40).length + D.registro.filter((r) => r.kind === "impacto" && r.tipo !== "criatura" && r.t >= s.t - 40).length;
      const asoc = (a: Criatura, b: Criatura): number => { const p = a.mem.predecir("presencia", featuresCriatura(b), new Array(10).fill(1), 0); return p.res[C.dano] * p.conf; };
      const recuerdo = Math.max(asoc(H, D), asoc(D, H), H.agravios[1000 + D.id]?.n ?? 0, D.agravios[1000 + H.id]?.n ?? 0);
      const huyoD = D.registro.filter((q) => q.kind === "inicio" && q.v === "evitar" && q.tipo === "criatura").length;
      const huyoH = H.registro.filter((q) => q.kind === "inicio" && q.v === "evitar" && q.tipo === "criatura").length;
      // Reencuentro: separadas, sin comida, a 300, durante un minuto
      for (const o of [...s.mundo.objetos]) s.mundo.quitar(o.id);
      H.x = 650; D.x = 950; H.accion = null; D.accion = null;
      const g0H = golpesH, g0D = golpesD;
      let distMin = 999, distFin = 0;
      s.ganchos.push(() => { distMin = Math.min(distMin, Math.abs(H.x - D.x)); distFin = Math.abs(H.x - D.x); });
      s.avanzar(60);
      const peleaNueva = cuenta(H) - g0H >= 2 && cuenta(D) - g0D >= 2;
      const unilateral = !peleaNueva && (cuenta(H) - g0H >= 2 || cuenta(D) - g0D >= 2);
      return { golpesH, golpesD, parteH, motivos, rondasConGolpes, maxGolpesRonda, picoFatiga, normales, recuerdo, huyoD, huyoH, peleaNueva, unilateral, acercaron: distMin < 200, distFin };
    };
    const brazos: Brazo[] = ["carroñera y defensor agresivo", "carroñera y defensor poco agresivo", "sin carroñeo y defensor agresivo", "sin carroñeo y defensor poco agresivo"];
    const r = Object.fromEntries(brazos.map((b) => [b, Array.from({ length: REP }, (_, k) => probar(b, k))])) as Record<Brazo, ReturnType<typeof probar>[]>;
    const med = (b: Brazo, f: (x: ReturnType<typeof probar>) => number): number => mediana(r[b].map(f));
    const [cA, cP, nA, nP] = brazos;
    const todas = brazos.flatMap((b) => r[b]);
    const prob = (b: Brazo, f: (x: ReturnType<typeof probar>) => boolean): number => r[b].filter(f).length / REP;
    return resultado(semilla, {
      "hay conflicto y no se impone: la carroñera intenta quedarse con la comida de otra, con golpes de competencia en alguna réplica de cada brazo del defensor, pero no en todas": brazos.every((b) => prob(b, (x) => x.motivos.competencia > 0) > 0) && todas.some((x) => x.motivos.competencia === 0),
      "el carácter del defensor se nota: el defensor agresivo golpea más que el poco agresivo": med(cA, (x) => x.golpesD) + med(nA, (x) => x.golpesD) > med(cP, (x) => x.golpesD) + med(nP, (x) => x.golpesD),
      "el combate no es una máquina de golpear: ninguna ronda pasa de 60 golpes en ninguna réplica": todas.every((x) => x.maxGolpesRonda < 60),
      "la fatiga se aplica: hay fatiga de combate apreciable (0,2 o más) en las réplicas con golpes": todas.filter((x) => x.golpesH + x.golpesD >= 4).every((x) => x.picoFatiga >= 0.2),
      "persistencia sin interminables: la carroñera sigue intentándolo en varias rondas (tres o más de seis) en alguna réplica": todas.some((x) => x.rondasConGolpes >= 3),
      "las motivaciones se distinguen: hay golpes de competencia, de defensa y de represalia, no solo de un tipo": ["competencia", "defensa", "represalia"].every((m) => todas.some((x) => x.motivos[m as Motivo] > 0)),
      "recuerdan quién les atacó (asociación con daño o agravio de 0,1 o más) cuando hubo golpes": todas.filter((x) => x.golpesH + x.golpesD >= 4).every((x) => x.recuerdo >= 0.1),
      "el reencuentro no es automáticamente una pelea mutua (menos de la mitad de las réplicas de cada brazo)": brazos.every((b) => prob(b, (x) => x.peleaNueva) < 0.5),
    }, {
      golpesCarroñeraConDefAgresivo: med(cA, (x) => x.golpesH), golpesDefAgresivo: med(cA, (x) => x.golpesD), golpesCarroñeraConDefPoco: med(cP, (x) => x.golpesH), golpesDefPoco: med(cP, (x) => x.golpesD),
      golpesSinCarroñeoDefAgresivo: med(nA, (x) => x.golpesH), golpesSinCarroñeoDefPoco: med(nP, (x) => x.golpesH),
      parteDeLaComidaCarroñeraDefAgresivo: med(cA, (x) => x.parteH), parteCarroñeraDefPoco: med(cP, (x) => x.parteH), parteSinCarroñeoDefAgresivo: med(nA, (x) => x.parteH), parteSinCarroñeoDefPoco: med(nP, (x) => x.parteH),
      competencia: mediana(todas.map((x) => x.motivos.competencia)), defensa: mediana(todas.map((x) => x.motivos.defensa)), represalia: mediana(todas.map((x) => x.motivos.represalia)), depredadora: mediana(todas.map((x) => x.motivos.depredadora)),
      maxGolpesPorRonda: Math.max(...todas.map((x) => x.maxGolpesRonda)), picoFatiga: mediana(todas.map((x) => x.picoFatiga)),
      rondasConGolpes: mediana(todas.map((x) => x.rondasConGolpes)), recuerdo: mediana(todas.map((x) => x.recuerdo)),
      huyeDefensor: mediana(todas.map((x) => x.huyoD)), huyeCarroñera: mediana(todas.map((x) => x.huyoH)),
      probPeleaMutuaReencuentro: todas.filter((x) => x.peleaNueva).length / todas.length, probViolenciaUnilateralReencuentro: todas.filter((x) => x.unilateral).length / todas.length, seAcercanReencontrarse: todas.filter((x) => x.acercaron).length / todas.length,
    }, null, (PREVIA + RONDAS) * POR_RONDA + 60);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso26: Caso = {
  id: "26",
  titulo: "Persistencia depredadora",
  hipotesis: "Con la fatiga de combate activa, una agresiva hambrienta que ya sabe que la carne alimenta puede mantener una conducta depredadora con pausas y consecuencias, sin volver al frenesí infinito. Se compara una presa que puede huir con una que no puede durante la ventana del experimento (la condición de laboratorio `atrapada`, que no añade ninguna regla al comportamiento normal) y un control sin carroñeo previo. No se busca que ataque indefinidamente ni que siempre mate.",
  minimo: 0.8,
  ejecutar(semilla) {
    const REP = 5;
    const PREVIA = 3;
    const RONDAS = 8;
    const POR_RONDA = 90;
    const PAUSA = 300;
    const RONDAS_TRAS_PAUSA = 3;
    type Brazo = "carroñeo y presa que huye" | "carroñeo y presa inmovil" | "sin carroñeo y presa inmovil" | "sin carroñeo y presa que huye";
    const gH = clonarGenoma(genomaDe(semilla, 261));
    gH.rasgos[R.agresividad] = 0.9;
    const gP = genomaDe(semilla, 262);
    const golpesDe = (c: Criatura, t0 = 0, t1 = Infinity): number => c.registro.filter((r) => r.kind === "impacto" && r.v === "empujar" && r.tipo === "criatura" && r.t >= t0 && r.t < t1).length;
    const tiemposGolpe = (c: Criatura, t0: number, t1: number): number[] => c.registro.filter((r) => r.kind === "impacto" && r.v === "empujar" && r.tipo === "criatura" && r.t >= t0 && r.t < t1).map((r) => r.t);
    const bocadosCarne = (c: Criatura, t0: number, t1: number): number => c.registro.filter((r) => r.kind === "impacto" && r.v === "probar" && r.tipo === "cadaver" && (r.res?.[0] ?? 0) > 0.05 && r.t >= t0 && r.t < t1).length;
    const probar = (brazo: Brazo, k: number) => {
      const carroña = brazo.startsWith("carroñeo");
      const inmovil = brazo.endsWith("inmovil");
      const s = nuevaSim({ semilla: mezclar(semilla, 263, k), objetos: [{ tipo: "pelota", x: 800 }], criaturas: [{ genoma: clonarGenoma(gH), x: 500 }], comedero: null, mortalidad: "permanente" });
      const H = s.criaturas[0];
      H.agresion = true; H.conflictoComida = true; H.reconocePorRasgos = true; H.capRegistro = 200000; H.edad = DIA;
      let nPresa = 10;
      const limpiar = (): void => {
        for (const o of [...s.mundo.objetos]) if (o.tipo === "cadaver") s.mundo.quitar(o.id);
        s.criaturas = s.criaturas.filter((c) => c === H);
        H.x = 500; H.accion = null; H.nec[0] = 0.7; H.nec[1] = 0.1; H.emo[E.miedo] = 0; H.dormido = false;
      };
      const nuevaPresa = (): Criatura => {
        const p = new Criatura(nPresa++, `Presa ${nPresa}`, (() => { const g = clonarGenoma(gP); g.rasgos[R.agresividad] = 0.1; return g; })(), 1000, mezclar(semilla, 264, nPresa));
        p.agresion = true; p.mortalidad = "permanente"; p.salud = 0.3; p.atrapada = inmovil; p.capRegistro = 500;
        return p;
      };
      // Aprendizaje previo: tres rondas a solas con un cadaver ya hecho, o el mismo tiempo sin el
      for (let i = 0; i < PREVIA; i++) {
        limpiar();
        if (carroña) s.mundo.agregar("cadaver", 1000, { porciones: 6 });
        s.avanzar(POR_RONDA);
      }
      const rondas: { golpes: number; duracion: number; mato: boolean; comio: number; primerBocado: number; golpesDeLaPresa: number }[] = [];
      let picoFatiga = 0, saludMin = 1, hambreSuma = 0, hambreN = 0;
      s.ganchos.push(() => { picoFatiga = Math.max(picoFatiga, H.fatiga); saludMin = Math.min(saludMin, H.salud); hambreSuma += H.nec[0]; hambreN++; });
      const jugarRonda = (conPausaPrevia: boolean): void => {
        limpiar();
        const p = nuevaPresa();
        s.criaturas.push(p);
        const ini = s.t;
        s.avanzar(POR_RONDA);
        const ts = tiemposGolpe(H, ini, ini + POR_RONDA);
        rondas.push({
          golpes: ts.length, duracion: ts.length ? ts[ts.length - 1] - ts[0] : 0, mato: !p.vivo, comio: bocadosCarne(H, ini, ini + POR_RONDA),
          primerBocado: (() => { const b = H.registro.filter((r) => r.kind === "impacto" && r.v === "probar" && (r.res?.[0] ?? 0) > 0.05 && r.t >= ini && r.t < ini + POR_RONDA)[0]; return b ? b.t - ini : POR_RONDA; })(),
          golpesDeLaPresa: golpesDe(p),
        });
        void conPausaPrevia;
      };
      for (let r = 0; r < RONDAS; r++) jugarRonda(false);
      // Pausa: sin presa ni comida, el cazador se recupera; luego una presa nueva
      limpiar();
      s.avanzar(PAUSA);
      const fatigaTrasPausa = H.fatiga;
      for (let i = 0; i < RONDAS_TRAS_PAUSA; i++) jugarRonda(true);
      const trasPausa = rondas.slice(RONDAS);
      const previas = rondas.slice(0, RONDAS);
      const intentos = previas.filter((x) => x.golpes > 0).length;
      const matadas = rondas.filter((x) => x.mato).length;
      // Persistencia tras un intento fallido: rondas con golpes cuya anterior no acabo con la muerte de la presa
      let trasFallo = 0, trasFalloAtaca = 0;
      for (let i = 1; i < previas.length; i++) if (!previas[i - 1].mato) { trasFallo++; if (previas[i].golpes > 0) trasFalloAtaca++; }
      return {
        intentos, golpesPorRonda: previas.map((x) => x.golpes), maxGolpesRonda: Math.max(...rondas.map((x) => x.golpes)),
        duracionMediana: mediana(previas.filter((x) => x.golpes > 0).map((x) => x.duracion)), matadas, comidos: rondas.reduce((n, x) => n + x.comio, 0),
        picoFatiga, saludMin, hambreMedia: hambreN ? hambreSuma / hambreN : 0, golpesTrasPausa: trasPausa.reduce((n, x) => n + x.golpes, 0), rondasConGolpesTrasPausa: trasPausa.filter((x) => x.golpes > 0).length, matadasTrasPausa: trasPausa.filter((x) => x.mato).length, fatigaTrasPausa,
        trasFallo, trasFalloAtaca, golpesRecibidos: previas.reduce((n, x) => n + x.golpesDeLaPresa, 0),
        sinComer: mediana(previas.map((x) => x.primerBocado)),
      };
    };
    const brazos: Brazo[] = ["carroñeo y presa que huye", "carroñeo y presa inmovil", "sin carroñeo y presa inmovil", "sin carroñeo y presa que huye"];
    const r = Object.fromEntries(brazos.map((b) => [b, Array.from({ length: REP }, (_, k) => probar(b, k))])) as Record<Brazo, ReturnType<typeof probar>[]>;
    const med = (b: Brazo, f: (x: ReturnType<typeof probar>) => number): number => mediana(r[b].map(f));
    const [ch, ci, si, sh] = brazos;
    const todas = brazos.flatMap((b) => r[b]);
    return resultado(semilla, {
      "inicia y mantiene intentos: con carroñeo y la presa inmóvil ataca en al menos 3 de 8 rondas (mediana)": med(ci, (x) => x.intentos) >= 3,
      "sin frenesí: ninguna ronda de ninguna réplica pasa de 40 golpes y la fatiga de combate se aplica (0,15 o más) cuando hay una ráfaga de 3 golpes o más": todas.every((x) => x.maxGolpesRonda < 40) && todas.filter((x) => x.golpesPorRonda.some((g) => g >= 3)).every((x) => x.picoFatiga >= 0.15),
      "el aprendizaje importa: con carroñeo previo mata más presas que sin él (presa inmóvil, mediana)": med(ci, (x) => x.matadas) > med(si, (x) => x.matadas),
      "la huida importa: con la presa que puede huir mata menos que con la inmóvil (con carroñeo, mediana)": med(ch, (x) => x.matadas) < med(ci, (x) => x.matadas),
      "persiste con pausas: ataca en la ronda siguiente a un intento sin muerte, y también tras una pausa de 5 minutos (en alguna de las 3 rondas siguientes), en alguna réplica de la condición con carroñeo y presa inmóvil": r[ci].some((x) => x.trasFalloAtaca > 0) && r[ci].some((x) => x.rondasConGolpesTrasPausa > 0),
      "tiene coste: el cazador paga fatiga (pico de 0,15 o más en mediana) y no se alimenta durante parte de la ronda (el primer bocado tarda más de 5 s de mediana)": med(ci, (x) => x.picoFatiga) >= 0.15 && med(ci, (x) => x.sinComer) > 5,
    }, {
      intentosCarroneoHuye: med(ch, (x) => x.intentos), intentosCarroneoInmovil: med(ci, (x) => x.intentos), intentosSinCarroneoInmovil: med(si, (x) => x.intentos), intentosSinCarroneoHuye: med(sh, (x) => x.intentos),
      matadasCarroneoHuye: med(ch, (x) => x.matadas), matadasCarroneoInmovil: med(ci, (x) => x.matadas), matadasSinCarroneoInmovil: med(si, (x) => x.matadas), matadasSinCarroneoHuye: med(sh, (x) => x.matadas),
      comidosCarroneoInmovil: med(ci, (x) => x.comidos), comidosCarroneoHuye: med(ch, (x) => x.comidos),
      maxGolpesRonda: Math.max(...todas.map((x) => x.maxGolpesRonda)), duracionAtaqueCarroneoInmovil: med(ci, (x) => x.duracionMediana),
      picoFatigaCarroneoInmovil: med(ci, (x) => x.picoFatiga), picoFatigaCarroneoHuye: med(ch, (x) => x.picoFatiga), saludMinimaCazador: med(ci, (x) => x.saludMin), golpesRecibidosCazadorHuye: med(ch, (x) => x.golpesRecibidos),
      hambreMediaCarroneoInmovil: med(ci, (x) => x.hambreMedia), hambreMediaSinCarroneoInmovil: med(si, (x) => x.hambreMedia), segundosHastaPrimerBocado: med(ci, (x) => x.sinComer),
      golpesTrasPausaCarroneoInmovil: med(ci, (x) => x.golpesTrasPausa), golpesTrasPausaSinCarroneoInmovil: med(si, (x) => x.golpesTrasPausa), rondasConGolpesTrasPausaCarroneoInmovil: med(ci, (x) => x.rondasConGolpesTrasPausa), matadasTrasPausaCarroneoInmovil: med(ci, (x) => x.matadasTrasPausa), fatigaTrasPausa: med(ci, (x) => x.fatigaTrasPausa),
      tras_fallo_ataca: med(ci, (x) => (x.trasFallo ? x.trasFalloAtaca / x.trasFallo : 0)),
    }, null, (PREVIA + RONDAS + RONDAS_TRAS_PAUSA) * POR_RONDA + PAUSA);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso27: Caso = {
  id: "27",
  titulo: "Celos",
  hipotesis: "Una criatura con un vínculo significativo que ve a su compañero prestar atención sostenida a otra siente celos y lo muestra en lo que hace: busca a su compañero, juega y explora menos, y lo recuerda. No los siente con un vínculo débil, sin tercera, ni cuando la tercera está pero no recibe atención. Con el interruptor apagado no pasa nada. No es frustración, no es miedo y no produce agresión automática.",
  minimo: 0.8,
  ejecutar(semilla) {
    const REP = 5;
    const ESTIMULO = 60;
    const OBSERVA = 300;
    type Brazo = "vinculo fuerte y tercera atendida" | "vinculo fuerte sin tercera" | "vinculo fuerte, tercera sin atencion" | "vinculo debil y tercera atendida" | "vinculo fuerte y tercera atendida, celos apagados";
    const gO = genomaDe(semilla, 271);
    const gV = genomaDe(semilla, 272);
    const gT = genomaDe(semilla, 273);
    const golpes = (c: Criatura): number => c.registro.filter((r) => r.kind === "impacto" && r.v === "empujar" && r.tipo === "criatura").length;
    const probar = (brazo: Brazo, k: number) => {
      const fuerte = !brazo.startsWith("vinculo debil");
      const sinTercera = brazo === "vinculo fuerte sin tercera";
      const sinAtencion = brazo === "vinculo fuerte, tercera sin atencion";
      const apagado = brazo.endsWith("apagados");
      // Convivencia previa de O y V: larga (vinculo fuerte) o muy corta (debil)
      const s = nuevaSim({ semilla: mezclar(semilla, 274, k), objetos: [{ tipo: "pelota", x: 700 }], criaturas: [{ genoma: clonarGenoma(gO), x: 600 }, { genoma: clonarGenoma(gV), x: 800 }], comedero: { cada: 100, max: 2, tipo: "fruta" } });
      const [O, V] = s.criaturas;
      for (const c of s.criaturas) { c.reconocePorRasgos = true; c.capRegistro = 50000; }
      O.celos = !apagado;
      s.avanzar(fuerte ? 1200 : 80);
      const afectoOV = O.mem.vinculos.find((q) => q.id === 1000 + V.id)?.afecto ?? 0;
      // La tercera llega (salvo en el control sin tercera)
      let T: Criatura | null = null;
      if (!sinTercera) {
        T = new Criatura(3, "Tercera", clonarGenoma(gT), 1000, mezclar(semilla, 275, k));
        T.reconocePorRasgos = true; T.capRegistro = 5000;
        s.criaturas.push(T);
      }
      // Escena montada: V y T quietos, a distancia visible de O. V mira a T (atencion) o mira al lado contrario (control sin atencion).
      for (const o of [...s.mundo.objetos]) if (o.tipo === "fruta") s.mundo.quitar(o.id);
      s.comedero = null;
      O.x = 500; O.accion = null; O.emo.fill(0); O.nec[0] = 0.15; O.nec[1] = 0.1; O.nec[3] = 0.3; O.nec[4] = 0.3;
      V.x = 800; V.atrapada = true; V.accion = null; V.dir = sinAtencion ? -1 : 1; V.vx = 0;
      if (T) { T.x = 920; T.atrapada = true; T.accion = null; T.dir = -1; T.vx = 0; }
      // O no se queda quieta: tiene una pelota cerca para ver si deja de jugar
      const pelota = s.mundo.objetos.find((o) => o.tipo === "pelota");
      if (pelota) pelota.x = 480;
      const t0 = s.t;
      let atencionMax = 0, celoMax = 0, frustracionMax = 0, cercaDeV = 0, cercaDeT = 0, entreMedio = 0, tCalma = -1, aVista = 0, picoFin = 0, tMitad = -1;
      const juego0 = O.registro.length;
      s.ganchos.push(() => {
        const dt = s.t - t0;
        // Postura fija de la escena (aunque esten inmovilizadas, podrian girarse solas): V mira a T mientras dura el estimulo, o al lado contrario
        V.dir = !sinAtencion && dt <= ESTIMULO ? 1 : -1;
        if (T) T.dir = -1;
        if (T) atencionMax = Math.max(atencionMax, O.social.duracion(V.id, T.id, s.t));
        celoMax = Math.max(celoMax, O.celoMaximo());
        frustracionMax = Math.max(frustracionMax, O.emo[E.frustracion]);
        if (dt <= ESTIMULO) {
          if (Math.abs(O.x - V.x) < 150) cercaDeV += 0.25;
          if (T && Math.abs(O.x - T.x) < 150) cercaDeT += 0.25;
          if (T && O.x > Math.min(V.x, T.x) && O.x < Math.max(V.x, T.x)) entreMedio += 0.25;
        }
        if (dt <= ESTIMULO) picoFin = Math.max(picoFin, O.celoMaximo());
        if (dt > ESTIMULO && tMitad < 0 && picoFin > 0.05 && O.celoMaximo() < picoFin / 2) tMitad = dt - ESTIMULO;
        if (dt > ESTIMULO && tCalma < 0 && O.celoMaximo() < 0.1) tCalma = dt - ESTIMULO;
        if (T && dt <= ESTIMULO && O.social.duracion(V.id, T.id, s.t) > 0) aVista += 0.25;
      });
      s.avanzar(OBSERVA);
      // Conducta: acciones con objetos (jugar) durante el estimulo y acercamientos a V durante todo
      const objetos = O.registro.slice(juego0).filter((r) => r.kind === "impacto" && r.tipo !== "criatura" && r.t >= t0 && r.t < t0 + ESTIMULO).length;
      const acercaV = O.registro.slice(juego0).filter((r) => r.kind === "inicio" && r.v === "acercarse" && r.obj === 1000 + V.id && r.t >= t0 && r.t < t0 + ESTIMULO).length;
      const recuerdo = O.mem.episodios.some((e) => e.clave.startsWith("celos:"));
      const agravioT = T ? O.agravios[1000 + T.id]?.n ?? 0 : 0;
      return { afectoOV, atencionMax, aVista, celoMax, frustracionMax, cercaDeV, cercaDeT, entreMedio, objetos, acercaV, tCalma: tCalma < 0 ? OBSERVA - ESTIMULO : tCalma, tMitad: tMitad < 0 ? OBSERVA - ESTIMULO : tMitad, recuerdo, agravioT, golpesATercera: T ? golpes(O) : 0 };
    };
    const brazos: Brazo[] = ["vinculo fuerte y tercera atendida", "vinculo fuerte sin tercera", "vinculo fuerte, tercera sin atencion", "vinculo debil y tercera atendida", "vinculo fuerte y tercera atendida, celos apagados"];
    const r = Object.fromEntries(brazos.map((b) => [b, Array.from({ length: REP }, (_, k) => probar(b, k))])) as Record<Brazo, ReturnType<typeof probar>[]>;
    const med = (b: Brazo, f: (x: ReturnType<typeof probar>) => number): number => mediana(r[b].map(f));
    const [A, B, C0, Dd, E0] = brazos;
    return resultado(semilla, {
      "percepción: ve la atención sostenida de su vínculo a la tercera solo cuando existe (3 s o más), y no cuando la tercera no la recibe ni cuando no hay tercera": med(A, (x) => x.atencionMax) >= 3 && med(Dd, (x) => x.atencionMax) >= 3 && med(B, (x) => x.atencionMax) === 0 && med(C0, (x) => x.atencionMax) < 3,
      "activación: celos claros con vínculo fuerte y tercera atendida (0,2 o más), y casi nada en los controles (menos de 0,1) y con el interruptor apagado": med(A, (x) => x.celoMax) >= 0.2 && [B, C0, E0].every((b) => med(b, (x) => x.celoMax) < 0.1),
      "vínculo débil: celos mucho menores que con vínculo fuerte (menos de la mitad)": med(Dd, (x) => x.celoMax) < 0.5 * med(A, (x) => x.celoMax),
      "conducta: busca más a su compañero que en los controles (más tiempo cerca de él durante el estímulo que sin tercera, con tercera sin atención y con el interruptor apagado)": [B, C0, E0].every((b) => med(A, (x) => x.cercaDeV) > med(b, (x) => x.cercaDeV)),
      "conducta: juega menos con la pelota durante el estímulo que con el interruptor apagado": med(A, (x) => x.objetos) < med(E0, (x) => x.objetos),
      "duración: se van con el tiempo (a la mitad de su pico en menos de 120 s tras terminar el estímulo, y por debajo de 0,1 en menos de 240 s, de mediana)": med(A, (x) => x.tMitad) < 120 && med(A, (x) => x.tCalma) < 240,
      "memoria: lo recuerda como episodio y guarda un pequeño agravio hacia la tercera (más que en los controles)": r[A].filter((x) => x.recuerdo).length >= REP / 2 && med(A, (x) => x.agravioT) > med(C0, (x) => x.agravioT),
      "no es frustración: la frustración no sube más que en los controles (a lo sumo 0,1 por encima)": med(A, (x) => x.frustracionMax) <= med(C0, (x) => x.frustracionMax) + 0.1,
      "no es agresión automática: no golpea a la tercera (0 golpes de mediana)": med(A, (x) => x.golpesATercera) === 0,
    }, {
      afectoConElVinculoFuerte: med(A, (x) => x.afectoOV), afectoConElVinculoDebil: med(Dd, (x) => x.afectoOV),
      atencionVistaSegundosA: med(A, (x) => x.atencionMax), atencionVistaSegundosC: med(C0, (x) => x.atencionMax), atencionVistaSegundosDebil: med(Dd, (x) => x.atencionMax),
      celosA: med(A, (x) => x.celoMax), celosSinTercera: med(B, (x) => x.celoMax), celosTerceraSinAtencion: med(C0, (x) => x.celoMax), celosVinculoDebil: med(Dd, (x) => x.celoMax), celosApagados: med(E0, (x) => x.celoMax),
      cercaDeVA: med(A, (x) => x.cercaDeV), cercaDeVSinTercera: med(B, (x) => x.cercaDeV), cercaDeVSinAtencion: med(C0, (x) => x.cercaDeV), cercaDeVDebil: med(Dd, (x) => x.cercaDeV), cercaDeVApagado: med(E0, (x) => x.cercaDeV),
      cercaDeTA: med(A, (x) => x.cercaDeT), entreMedioA: med(A, (x) => x.entreMedio), objetosA: med(A, (x) => x.objetos), objetosApagado: med(E0, (x) => x.objetos),
      acercamientosAVA: med(A, (x) => x.acercaV), acercamientosAVApagado: med(E0, (x) => x.acercaV),
      segundosHastaCalmaA: med(A, (x) => x.tCalma), segundosHastaLaMitadA: med(A, (x) => x.tMitad), frustracionMaxA: med(A, (x) => x.frustracionMax), frustracionMaxSinAtencion: med(C0, (x) => x.frustracionMax),
      agravioTerceraA: med(A, (x) => x.agravioT), golpesATerceraA: med(A, (x) => x.golpesATercera),
    }, null, 1200 + OBSERVA);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso28: Caso = {
  id: "28",
  titulo: "Envidia",
  hipotesis: "Una criatura con hambre que ve comer a otra algo que desea y no tiene siente envidia y lo muestra en lo que hace. No la siente con hambre y con el alimento a la vista pero sin nadie que lo posea, con poco hambre, cuando tiene acceso a lo suyo, ni cuando no puede ver a quien come. Se va con el tiempo y antes si consigue su alimento. No es hambre ni frustración, no produce agresión automática y con el interruptor apagado no pasa nada. Lo que hace con ella (acercarse, buscar otro alimento, dejar de jugar) no está ordenado: se mide qué sale.",
  minimo: 0.8,
  ejecutar(semilla) {
    const REP = 10;
    const ESTIMULO = 90;
    const OBSERVA = 300;
    const CADA = 12;
    const ALIMENTA_A_LOS = 40;
    const MIDE_A_LOS = 70;
    type Brazo = "ve comer y no puede llegar" | "hambrienta sin poseedor" | "poco hambre y ve comer" | "tiene el suyo" | "el poseedor fuera de su vista" | "recibe el suyo a los 40 s"
      | "libre con envidia" | "libre sin envidia" | "agresiva con envidia" | "agresiva sin envidia";
    const gO = genomaDe(semilla, 281);
    const gV = genomaDe(semilla, 282);
    const golpes = (c: Criatura): number => c.registro.filter((r) => r.kind === "impacto" && r.v === "empujar" && r.tipo === "criatura").length;
    const probar = (brazo: Brazo, k: number) => {
      const libre = brazo.startsWith("libre") || brazo.startsWith("agresiva");
      const agresiva = brazo.startsWith("agresiva");
      const apagado = brazo.endsWith("sin envidia");
      const sinPoseedor = brazo === "hambrienta sin poseedor";
      const pocoHambre = brazo === "poco hambre y ve comer";
      const tieneElSuyo = brazo === "tiene el suyo";
      const fueraDeVista = brazo === "el poseedor fuera de su vista";
      const recibeElSuyo = brazo === "recibe el suyo a los 40 s";
      const genO = clonarGenoma(gO);
      if (agresiva) genO.rasgos[R.agresividad] = 0.9;
      // Convivencia previa de 600 s con alimento a la vista: las dos saben que la fruta se come
      const s = nuevaSim({ semilla: mezclar(semilla, 283, k), objetos: [{ tipo: "pelota", x: 450 }], criaturas: [{ genoma: genO, x: 300 }, { genoma: clonarGenoma(gV), x: 700 }], comedero: { cada: 100, max: 2, tipo: "fruta" } });
      const [O, V] = s.criaturas;
      for (const c of s.criaturas) { c.reconocePorRasgos = true; c.capRegistro = 50000; }
      s.avanzar(600);
      // Escena montada: se quita la comida y el comedero, y cada una queda en su sitio. La poseedora (V) esta inmovilizada junto a su alimento.
      for (const o of [...s.mundo.objetos]) if (o.tipo === "fruta") s.mundo.quitar(o.id);
      s.comedero = null;
      O.envidia = !apagado;
      if (agresiva) { O.agresion = true; O.conflictoComida = true; V.agresion = true; V.conflictoComida = true; }
      const xO = fueraDeVista ? 100 : 400;
      const xV = fueraDeVista ? 620 : 700;
      O.x = xO; O.accion = null; O.emo.fill(0); O.nec[0] = pocoHambre ? 0.12 : 0.8; O.nec[1] = 0.1; O.nec[3] = 0.3; O.nec[4] = 0.3; O.atrapada = !libre;
      V.x = xV; V.accion = null; V.emo.fill(0); V.nec[1] = 0.1; V.atrapada = true;
      // Sin poseedor: nadie come. El alimento esta a la vista y sin dueño (V ya no esta en la sala: una V saciada seguia dando algun bocado)
      if (sinPoseedor) s.criaturas = s.criaturas.filter((c) => c !== V);
      const pelota = s.mundo.objetos.find((o) => o.tipo === "pelota");
      if (pelota) pelota.x = xO + 50;
      const t0 = s.t;
      let proxFruta = 0, cercaDeV = 0, hambreSuma = 0, hambreN = 0, frustracionMax = 0, envMax = 0, nivel70 = -1, ultimaMordidaV = -1, bocadosV = 0;
      const serie: { dt: number; nivel: number }[] = [];
      const tienePeso = (x: number): number => s.mundo.objetos.filter((o) => o.tipo === "fruta" && Math.abs(o.x - x) < 60).length;
      s.ganchos.push(() => {
        const dt = s.t - t0;
        if (dt <= ESTIMULO) {
          // La comida llega junto a V (salvo en el control sin poseedor, donde V esta saciada) y junto a O en los brazos en que consigue la suya
          if (!sinPoseedor) V.nec[0] = Math.max(V.nec[0], 0.8);
          if (!libre && !tieneElSuyo && !recibeElSuyo && !pocoHambre) O.nec[0] = Math.max(O.nec[0], 0.8);
          if (pocoHambre) O.nec[0] = Math.min(O.nec[0], 0.12);
          if (dt >= proxFruta) {
            proxFruta = dt + CADA;
            if (tienePeso(xV) < 2) s.mundo.agregar("fruta", xV);
            if ((tieneElSuyo || (recibeElSuyo && dt >= ALIMENTA_A_LOS)) && tienePeso(xO) < 2) s.mundo.agregar("fruta", xO);
          }
          hambreSuma += O.nec[0]; hambreN++;
          if (Math.abs(O.x - V.x) < 150) cercaDeV += 0.25;
        }
        const nivel = O.envidiaMaxima();
        envMax = Math.max(envMax, nivel);
        frustracionMax = Math.max(frustracionMax, O.emo[E.frustracion]);
        if (dt >= MIDE_A_LOS && nivel70 < 0) nivel70 = nivel;
        serie.push({ dt, nivel });
      });
      s.avanzar(OBSERVA);
      const registro = O.registro;
      for (const r of V.registro) if (r.t >= t0 && r.kind === "impacto" && r.v === "probar" && r.tipo !== "criatura" && (r.res?.[0] ?? 0) > 0.05) { bocadosV++; ultimaMordidaV = Math.max(ultimaMordidaV, r.t - t0); }
      const propios = registro.filter((r) => r.kind === "impacto" && r.v === "probar" && r.tipo !== "criatura" && (r.res?.[0] ?? 0) > 0.05 && r.t >= t0);
      const dentro = (r: { t: number }): boolean => r.t >= t0 && r.t < t0 + ESTIMULO;
      const juego = registro.filter((r) => r.kind === "impacto" && r.tipo !== "criatura" && r.tipo !== "fruta" && (r.v === "empujar" || r.v === "tocar") && dentro(r)).length;
      const descansos = registro.filter((r) => r.kind === "inicio" && r.v === "descansar" && dentro(r)).length;
      const acercaV = registro.filter((r) => r.kind === "inicio" && r.v === "acercarse" && r.obj === 1000 + V.id && dentro(r)).length;
      // Mientras no ha comido ella (hasta su primer bocado, o todo el estimulo si no come): es cuando la envidia puede pesar en lo que hace
      const primero = propios.length ? Math.min(ESTIMULO, propios[0].t - t0) : ESTIMULO;
      const antes = (r: { t: number }): boolean => r.t >= t0 && r.t < t0 + primero;
      const ocioAntes = registro.filter((r) => (r.kind === "impacto" && r.tipo !== "criatura" && r.tipo !== "fruta" && (r.v === "empujar" || r.v === "tocar") && antes(r)) || (r.kind === "inicio" && (r.v === "descansar" || r.v === "explorar") && antes(r))).length;
      const acercaAntes = registro.filter((r) => r.kind === "inicio" && r.v === "acercarse" && r.obj === 1000 + V.id && antes(r)).length;
      const pico = Math.max(0, ...serie.map((x) => x.nivel));
      const tras = serie.filter((x) => x.dt >= ultimaMordidaV);
      const mitad = tras.find((x) => x.nivel < pico / 2);
      const calma = tras.find((x) => x.nivel < 0.05);
      const recuerdo = O.mem.episodios.some((e) => e.clave.startsWith("envidia:"));
      const agravioV = O.agravios[1000 + V.id]?.n ?? 0;
      return {
        envMax, nivel70, hambreMedia: hambreN ? hambreSuma / hambreN : 0, frustracionMax, cercaDeV, juego, descansos, acercaV, bocadosV, bocadosPropios: propios.filter(dentro).length,
        primerBocado: propios.length ? propios[0].t - t0 : OBSERVA,
        tMitad: mitad ? mitad.dt - Math.max(0, ultimaMordidaV) : OBSERVA, tCalma: calma ? calma.dt - Math.max(0, ultimaMordidaV) : OBSERVA,
        ocioAntes, acercaAntes, primero, recuerdo, agravioV, golpesAV: golpes(O),
        restos: O.envidiaEstado.length + (Object.keys(O.vistoBocado).length ? 1 : 0) + (recuerdo ? 1 : 0),
      };
    };
    const brazos: Brazo[] = ["ve comer y no puede llegar", "hambrienta sin poseedor", "poco hambre y ve comer", "tiene el suyo", "el poseedor fuera de su vista", "recibe el suyo a los 40 s", "libre con envidia", "libre sin envidia", "agresiva con envidia", "agresiva sin envidia"];
    const r = Object.fromEntries(brazos.map((b) => [b, Array.from({ length: REP }, (_, k) => probar(b, k))])) as Record<Brazo, ReturnType<typeof probar>[]>;
    const med = (b: Brazo, f: (x: ReturnType<typeof probar>) => number): number => mediana(r[b].map(f));
    const [J, B, C0, D0, E0, F0, A, G, H, I] = brazos;
    return resultado(semilla, {
      "activación: envidia clara al ver comer lo que desea sin poder llegar (0,2 o más), y casi nada en los controles (menos de 0,1): con el alimento a la vista y sin poseedor, con poco hambre, con alimento propio y sin ver a quien come": med(J, (x) => x.envMax) >= 0.2 && [B, C0, D0, E0].every((b) => med(b, (x) => x.envMax) < 0.1),
      "no es hambre: con el mismo hambre (diferencia menor que 0,15) hay envidia con poseedor y no la hay con el alimento a la vista y sin poseedor, y el poseedor come de verdad (5 bocados o más)": Math.abs(med(J, (x) => x.hambreMedia) - med(B, (x) => x.hambreMedia)) < 0.15 && med(J, (x) => x.envMax) >= 0.2 && med(B, (x) => x.envMax) < 0.1 && med(J, (x) => x.bocadosV) >= 5,
      "no es frustración: la frustración no sube más que sin poseedor (a lo sumo 0,1 por encima)": med(J, (x) => x.frustracionMax) <= med(B, (x) => x.frustracionMax) + 0.1,
      "no ve, no hay envidia: el poseedor come fuera de su vista (5 bocados o más) y no siente nada": med(E0, (x) => x.bocadosV) >= 5 && med(E0, (x) => x.envMax) < 0.1,
      "se va con el tiempo: a la mitad del pico en menos de 90 s tras el último bocado visto y por debajo de 0,05 en menos de 240 s (mediana)": med(J, (x) => x.tMitad) < 90 && med(J, (x) => x.tCalma) < 240,
      "conseguir lo suyo la apaga antes: 30 s después de recibir su alimento (a los 70 s) la envidia es menos de la mitad que sin recibirlo": med(F0, (x) => x.nivel70) < 0.5 * med(J, (x) => x.nivel70),
      "memoria: lo recuerda como episodio (la mitad de las réplicas o más) y guarda un pequeño agravio hacia quien comía, más que sin poseedor": r[J].filter((x) => x.recuerdo).length >= REP / 2 && med(J, (x) => x.agravioV) > med(B, (x) => x.agravioV),
      "conducta: libre, con envidia pasa más tiempo cerca de quien come o lo busca más que con el interruptor apagado": med(A, (x) => x.cercaDeV) > med(G, (x) => x.cercaDeV) || med(A, (x) => x.acercaV) > med(G, (x) => x.acercaV),
      "conducta: libre, mientras no ha comido ella, se acerca más veces a quien come que con el interruptor apagado": med(A, (x) => x.acercaAntes) > med(G, (x) => x.acercaAntes),
      "no es agresión automática: no golpea a quien come (0 golpes de mediana, libre y con envidia)": med(A, (x) => x.golpesAV) === 0,
      "apagado: con el interruptor apagado no queda rastro (ni estado, ni bocados contados, ni episodio)": [G, I].every((b) => r[b].every((x) => x.restos === 0)),
    }, {
      envidiaVeComer: med(J, (x) => x.envMax), envidiaSinPoseedor: med(B, (x) => x.envMax), envidiaPocoHambre: med(C0, (x) => x.envMax), envidiaTieneElSuyo: med(D0, (x) => x.envMax), envidiaFueraDeVista: med(E0, (x) => x.envMax),
      envidiaRecibeElSuyo: med(F0, (x) => x.envMax), envidiaLibre: med(A, (x) => x.envMax), envidiaAgresiva: med(H, (x) => x.envMax),
      nivelA70sVeComer: med(J, (x) => x.nivel70), nivelA70sRecibeElSuyo: med(F0, (x) => x.nivel70),
      hambreVeComer: med(J, (x) => x.hambreMedia), hambreSinPoseedor: med(B, (x) => x.hambreMedia), hambrePocoHambre: med(C0, (x) => x.hambreMedia), hambreTieneElSuyo: med(D0, (x) => x.hambreMedia),
      frustracionVeComer: med(J, (x) => x.frustracionMax), frustracionSinPoseedor: med(B, (x) => x.frustracionMax),
      bocadosDelPoseedor: med(J, (x) => x.bocadosV), bocadosDelPoseedorFuera: med(E0, (x) => x.bocadosV),
      segundosHastaLaMitad: med(J, (x) => x.tMitad), segundosHastaCalma: med(J, (x) => x.tCalma),
      cercaDeVLibre: med(A, (x) => x.cercaDeV), cercaDeVLibreApagado: med(G, (x) => x.cercaDeV), cercaDeVVeComer: med(J, (x) => x.cercaDeV),
      acercamientosLibre: med(A, (x) => x.acercaV), acercamientosLibreApagado: med(G, (x) => x.acercaV), acercamientosVeComer: med(J, (x) => x.acercaV), acercamientosSinPoseedor: med(B, (x) => x.acercaV),
      juegoLibre: med(A, (x) => x.juego), juegoLibreApagado: med(G, (x) => x.juego), descansosLibre: med(A, (x) => x.descansos), descansosLibreApagado: med(G, (x) => x.descansos),
      primerBocadoLibre: med(A, (x) => x.primerBocado), primerBocadoLibreApagado: med(G, (x) => x.primerBocado), bocadosPropiosLibre: med(A, (x) => x.bocadosPropios), bocadosPropiosLibreApagado: med(G, (x) => x.bocadosPropios),
      bocadosDelPoseedorSinPoseedor: med(B, (x) => x.bocadosV), primerBocadoTieneElSuyo: med(D0, (x) => x.primerBocado), bocadosPropiosTieneElSuyo: med(D0, (x) => x.bocadosPropios),
      ocioAntesDelBocadoLibre: med(A, (x) => x.ocioAntes), ocioAntesDelBocadoLibreApagado: med(G, (x) => x.ocioAntes), acercaAntesDelBocadoLibre: med(A, (x) => x.acercaAntes), acercaAntesDelBocadoLibreApagado: med(G, (x) => x.acercaAntes),
      ventanaAntesDelBocadoLibre: med(A, (x) => x.primero), ventanaAntesDelBocadoLibreApagado: med(G, (x) => x.primero),
      agravioAlPoseedor: med(J, (x) => x.agravioV), golpesLibre: med(A, (x) => x.golpesAV),
      golpesAgresivaConEnvidia: med(H, (x) => x.golpesAV), golpesAgresivaSinEnvidia: med(I, (x) => x.golpesAV),
    }, null, 600 + OBSERVA);
  },
};

export const CASOS: Caso[] = [caso01, caso02, caso03, caso03b, caso04, caso04b, caso13, caso05, caso05b, caso06, caso07, caso08, caso08b, caso08c, caso07b, caso07c, caso16, caso17, caso18, caso19, caso20, caso21, caso22, caso23, caso23b, caso24, caso25, caso26, caso27, caso28, caso14];
export const CASOS_OBLIGATORIOS = ["01", "02", "03", "03b", "04", "04b", "13", "05", "06", "07", "08", "14"];
