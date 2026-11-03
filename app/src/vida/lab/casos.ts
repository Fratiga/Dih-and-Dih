/* Los casos de exito de inteligencia artificial del documento de diseno (docs/vida-artificial-diseno.md), como experimentos.
   Implementados: 01 a 04 (un individuo aprende), 04b (generalización), 13 (gemelos) y 05 (partido improvisado, preparado).
   Cada uno usa varias semillas y un control. Los criterios estan escritos para que no se cumplan por casualidad. */

import { C } from "../nucleo/tipos.ts";
import { clonarGenoma, cruzar, type Genoma } from "../nucleo/genoma.ts";
import { CATALOGO } from "../nucleo/catalogo.ts";
import { Azar, mezclar } from "../nucleo/azar.ts";
import { semejanza } from "../nucleo/memoria.ts";
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
function empujones(cs: { id: number; registro: Registro[] }[], desde: number): { t: number; id: number }[] {
  const out: { t: number; id: number }[] = [];
  for (const c of cs) for (const r of c.registro) if (r.kind === "impacto" && r.v === "empujar" && r.tipo === "pelota" && r.t >= desde) out.push({ t: r.t, id: c.id });
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
  titulo: "El aprendiz",
  hipotesis: "Una criatura que nunca ha tocado una palanca empieza a usarla antes si convive con otra que ya sabe, sin haber recibido ningún entrenamiento propio.",
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
  hipotesis: "Una criatura aprende a acercarse a una compañera que sufre solo si su acercamiento tiene un efecto que se ve: la angustia de la otra baja. Cinco condiciones separan miedo contagiado, evitación y consuelo. Si no puede acercarse, si la angustia no baja, o si la otra es una desconocida, no aprende lo mismo. No hay ninguna regla de ayuda.",
  minimo: 0.8,
  ejecutar(semilla) {
    const g1 = genomaDe(semilla, 81);
    const g2 = genomaDe(semilla, 82);
    const gX = genomaDe(semilla, 84);
    const preparar = (s: Simulacion): void => { for (const c of s.criaturas) { c.ayudaInnata = false; c.estadosAjenos = true; } };
    const juntos = nuevaSim({ semilla, objetos: [{ tipo: "pelota", x: 800 }], criaturas: [{ genoma: g1, x: 500 }, { genoma: g2, x: 700 }], comedero: { cada: 140, max: 2, tipo: "fruta" } });
    preparar(juntos);
    juntos.avanzar(1500);
    const afecto = Math.max(...juntos.criaturas.map((c) => c.mem.vinculos.reduce((m, v) => Math.max(m, v.afecto), 0)));
    for (const o of [...juntos.mundo.objetos]) juntos.mundo.quitar(o.id);
    juntos.comedero = null;
    const base = juntos.serializar();

    const colocar = (a: Criatura, b: Criatura): void => {
      a.x = 1000; b.x = 600; a.accion = null; b.accion = null;
      for (const c of [a, b]) { c.nec[0] = 0.1; c.nec[1] = 0.1; c.nec[3] = 0.2; c.nec[4] = 0.25; c.emo[1] = 0.4; }
    };
    // Una descarga a la otra, estando ella delante. Nadie le dice a la que mira que se acerque. Con hambre y comida al otro lado, para ir
    // con la otra hay que dejar de comer. Devuelve 1 si llega junto a ella (a menos de 180 unidades) en los segundos siguientes, 0 si no.
    const episodio = (s: Simulacion, a: Criatura, b: Criatura, segundos: number, conComida: boolean): number => {
      for (const o of [...s.mundo.objetos]) s.mundo.quitar(o.id);
      if (conComida) s.mundo.agregar("fruta", 300, { porciones: 6 });
      colocar(a, b);
      b.nec[0] = conComida ? 0.6 : 0.1;
      let llego = 0;
      const g = () => { if (Math.abs(a.x - b.x) < 180) llego = 1; };
      s.ganchos.push(g);
      a.sufrir(0.7, -1, null, 0.5);
      s.avanzar(segundos);
      s.ganchos.splice(s.ganchos.indexOf(g), 1);
      return llego;
    };
    type Condicion = "consuela" | "atrapada" | "inconsolable" | "desconocida";
    // Entrenamiento: 20 episodios de la otra recibiendo una descarga delante, segun la condicion
    const entrenar = (cond: Condicion): { s: Simulacion; objetivo: number; b: number } => {
      if (cond === "desconocida") {
        // La misma criatura, con su vinculo intacto, pero la que sufre ahora es una desconocida (su companera no esta)
        const r = Simulacion.restaurar(base);
        r.azar.s = mezclar(semilla, 95);
        for (const c of r.criaturas) { c.azar.s = mezclar(semilla, 96, c.id); c.capRegistro = 100000; }
        const B = r.criaturas[1];
        const S = new Criatura(3, "Extraña", clonarGenoma(gX), 1000, mezclar(semilla, 97));
        S.ayudaInnata = false; S.estadosAjenos = true; S.capRegistro = 100000;
        r.criaturas = [B, S];
        for (let i = 0; i < 20; i++) { episodio(r, S, B, 20, false); r.avanzar(8); }
        return { s: r, objetivo: 1, b: 0 };
      }
      const r = Simulacion.restaurar(base);
      r.azar.s = mezclar(semilla, 93);
      for (const c of r.criaturas) { c.azar.s = mezclar(semilla, 94, c.id); c.capRegistro = 100000; }
      const [A, B] = r.criaturas;
      B.atrapada = cond === "atrapada";
      A.inconsolable = cond === "inconsolable";
      for (let i = 0; i < 20; i++) { episodio(r, A, B, 20, false); r.avanzar(8); }
      B.atrapada = false; A.inconsolable = false; A.emo[0] = 0; A.nec[2] = 0;
      return { s: r, objetivo: 0, b: 1 };
    };
    const prueba = (e: { s: Simulacion; objetivo: number; b: number }): number => {
      const v: number[] = [];
      for (let k = 0; k < 16; k++) {
        const r = replica(e.s, k);
        v.push(episodio(r, r.criaturas[e.objetivo], r.criaturas[e.b], 12, true));
      }
      return media(v);
    };
    const res: Record<Condicion | "ingenua", number> = { consuela: 0, atrapada: 0, inconsolable: 0, desconocida: 0, ingenua: 0 };
    for (const c of ["consuela", "atrapada", "inconsolable", "desconocida"] as Condicion[]) res[c] = prueba(entrenar(c));
    const vn: number[] = [];
    for (let k = 0; k < 16; k++) {
      const n = nuevaSim({ semilla: mezclar(semilla, 85, k), objetos: [], criaturas: [{ genoma: g1, x: 1000 }, { genoma: g2, x: 600 }], comedero: null });
      preparar(n);
      vn.push(episodio(n, n.criaturas[0], n.criaturas[1], 12, true));
    }
    res.ingenua = media(vn);
    return resultado(semilla, {
      "han creado un vínculo antes (afecto > 0,3)": afecto > 0.3,
      "si la angustia bajaba al acercarse, va más veces con ella que si no bajaba (+0,15): aprende del efecto": res.consuela > res.inconsolable + 0.15,
      "y más que si no pudo acercarse (+0,1): ver angustia no basta": res.consuela > res.atrapada + 0.1,
      "y más que si la que sufría era una desconocida (+0,1): el vínculo importa": res.consuela > res.desconocida + 0.1,
      "sin quedar por debajo de quien nunca la vio sufrir (-0,1)": res.consuela > res.ingenua - 0.1,
    }, { afecto, consuela: res.consuela, noPudoAcercarse: res.atrapada, laAngustiaNoBajaba: res.inconsolable, desconocida: res.desconocida, ingenua: res.ingenua }, juntos.criaturas[0], 1500);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso07b: Caso = {
  id: "07b",
  titulo: "El aprendiz, por partes",
  hipotesis: "Separa lo que podria estar midiendo el caso 07. A: con la palanca estropeada (se mueve pero no suelta nada), ¿usarla mas junto a la experta es solo facilitacion social? B: tras convivir con la experta, ¿sigue usandola mas cuando ella se va, o solo la usaba mientras estaba?",
  minimo: 0.5,
  ejecutar(semilla) {
    const gE = genomaDe(semilla, 71);
    const gO = genomaDe(semilla, 72);
    const X = nuevaSim({ semilla, objetos: [{ tipo: "palanca", x: 800 }], criaturas: [{ genoma: gE, x: 300 }], comedero: null });
    X.criaturas[0].nec[0] = 0.5;
    X.avanzar(1200);
    const estadoExperta = X.criaturas[0].estado();
    const montar = (tipo: string, conExperta: boolean, k: number): { s: Simulacion; obs: Criatura } => {
      const s = nuevaSim({ semilla: mezclar(semilla, 75, k, conExperta ? 1 : 0), objetos: [{ tipo, x: 800 }], criaturas: [{ genoma: gO, x: 300 }], comedero: null });
      const obs = s.criaturas[0];
      obs.nec[0] = 0.5;
      if (conExperta) {
        const e = Criatura.desde({ ...estadoExperta, id: 2, x: 520, accion: null }, mezclar(semilla, 76, k));
        e.azar.s = mezclar(semilla, 77, k);
        e.reiniciarReloj();
        e.capRegistro = 100000;
        e.nec[0] = 0.55;
        s.criaturas.push(e);
      }
      return { s, obs };
    };
    // A: sin recompensa, solo se ve a la otra usar algo
    const fa = [0, 1, 2, 3].map((k) => { const { s, obs } = montar("palanca_rota", true, k); s.avanzar(300); return manip(obs, "palanca_rota"); });
    const sa = [0, 1, 2, 3].map((k) => { const { s, obs } = montar("palanca_rota", false, k); s.avanzar(300); return manip(obs, "palanca_rota"); });
    // B: la experta se va y se mide lo que hace la aprendiz sola con la palanca que funciona
    const pb = (conExperta: boolean): number[] => [0, 1, 2, 3].map((k) => {
      const { s, obs } = montar("palanca", conExperta, k);
      s.avanzar(300);
      if (conExperta) s.criaturas.splice(1, 1);
      for (const o of [...s.mundo.objetos]) if (o.tipo !== "palanca") s.mundo.quitar(o.id);
      const antes = manip(obs, "palanca");
      obs.nec[0] = 0.5;
      s.avanzar(200);
      return manip(obs, "palanca") - antes;
    });
    const conB = pb(true), solaB = pb(false);
    const mFa = mediana(fa), mSa = mediana(sa), mCb = mediana(conB), mSb = mediana(solaB);
    return resultado(semilla, {
      "A: con la palanca estropeada, junto a la experta la usa mas que sola (facilitacion social)": mFa > mSa,
      "B: cuando la experta se va, sigue usando la palanca mas que quien exploro sola (aprendizaje)": mCb > mSb,
    }, { estropeadaConExperta: mFa, estropeadaSola: mSa, sinExpertaTrasConvivir: mCb, sinExpertaExploroSola: mSb }, null, 300);
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

export const CASOS: Caso[] = [caso01, caso02, caso03, caso03b, caso04, caso04b, caso13, caso05, caso06, caso07, caso08, caso08b, caso07b, caso14];
export const CASOS_OBLIGATORIOS = ["01", "02", "03", "03b", "04", "04b", "13", "05", "06", "07", "08", "14"];
