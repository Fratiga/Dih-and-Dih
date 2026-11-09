/* Los casos de exito de inteligencia artificial del documento de diseno (docs/vida-artificial-diseno.md), como experimentos.
   Implementados: 01 a 04 (un individuo aprende), 04b (generalización), 13 (gemelos) y 05 (partido improvisado, preparado).
   Cada uno usa varias semillas y un control. Los criterios estan escritos para que no se cumplan por casualidad. */

import { AJ } from "../nucleo/ajustes.ts";
import { C, DIA, E, R, type Verbo } from "../nucleo/tipos.ts";
import { clonarGenoma, cruzar, especializar, sexoDe, type Especializacion, type Genoma, type TipoEspecializacion } from "../nucleo/genoma.ts";
import { CATALOGO } from "../nucleo/catalogo.ts";
import { Azar, mezclar } from "../nucleo/azar.ts";
import { semejanza } from "../nucleo/memoria.ts";
import { featuresCriatura } from "../nucleo/conducta.ts";
import { Criatura, type Registro } from "../nucleo/criatura.ts";
import { ModeloAjeno } from "../nucleo/modeloajeno.ts";
import { Simulacion } from "../nucleo/simulacion.ts";
import { actor, avanzarMuestreando, calentada, conteoAcciones, genomaDe, impactos, media, mediana, nuevaSim, replica, type Caso, type ResSemilla } from "./laboratorio.ts";

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

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso29: Caso = {
  id: "29",
  titulo: "Celos y envidia a la vez",
  hipotesis: "Una criatura puede sentir celos de su compañero y envidia de la comida que este obtiene al mismo tiempo, sin que una anule a la otra. La envidia va a quien posee el alimento y los celos a la atención que su compañero presta a una tercera. Cada interruptor funciona por separado: con solo uno encendido no queda rastro del otro. Juntas no producen agresión ni acciones nuevas, y repetidas varias veces no dejan un agravio permanente ni dañan el vínculo.",
  minimo: 0.8,
  ejecutar(semilla) {
    const REP = 10;
    const ESTIMULO = 90;
    const CADA = 12;
    const CALMA = 300;
    const RONDAS = 4;
    type Brazo = "come y atiende" | "solo come" | "solo atiende" | "ni come ni atiende" | "la tercera come y atiende" | "libre con celos y envidia" | "libre solo celos" | "libre solo envidia" | "libre sin ninguno" | "libre con comida propia y las dos" | "libre con comida propia sin ninguna";
    const gO = genomaDe(semilla, 291);
    const gP = genomaDe(semilla, 292);
    const gT = genomaDe(semilla, 293);
    const golpes = (c: Criatura): number => c.registro.filter((r) => r.kind === "impacto" && r.v === "empujar" && r.tipo === "criatura").length;
    const afectoA = (O: Criatura, id: number): number => O.mem.vinculos.find((q) => q.id === 1000 + id)?.afecto ?? 0;
    const agravioA = (O: Criatura, id: number, t: number): number => { const a = O.agravios[1000 + id]; return a ? a.n * Math.exp(-(t - a.t) / AJ.olvidoAgravio) : 0; };
    // Escena comun: O (con vinculo fuerte con P tras 1200 s de convivencia con alimento), P (su compañero) y una tercera T que llega despues
    const montar = (k: number, celos: boolean, envidia: boolean, libre: boolean) => {
      const s = nuevaSim({ semilla: mezclar(semilla, 294, k), objetos: [{ tipo: "pelota", x: 450 }], criaturas: [{ genoma: clonarGenoma(gO), x: 600 }, { genoma: clonarGenoma(gP), x: 800 }], comedero: { cada: 100, max: 2, tipo: "fruta" } });
      const [O, P] = s.criaturas;
      for (const c of s.criaturas) { c.reconocePorRasgos = true; c.capRegistro = 50000; }
      s.avanzar(1200);
      const T = new Criatura(3, "Tercera", clonarGenoma(gT), 1000, mezclar(semilla, 295, k));
      T.reconocePorRasgos = true; T.capRegistro = 5000;
      s.criaturas.push(T);
      for (const o of [...s.mundo.objetos]) if (o.tipo === "fruta") s.mundo.quitar(o.id);
      s.comedero = null;
      O.celos = celos; O.envidia = envidia;
      O.x = 400; O.accion = null; O.emo.fill(0); O.nec[1] = 0.1; O.nec[3] = 0.3; O.nec[4] = 0.3; O.atrapada = !libre;
      P.x = 700; P.accion = null; P.emo.fill(0); P.nec[1] = 0.1; P.atrapada = true; P.vx = 0;
      T.x = 820; T.accion = null; T.nec[1] = 0.1; T.atrapada = true; T.vx = 0; T.dir = -1;
      const pelota = s.mundo.objetos.find((o) => o.tipo === "pelota");
      if (pelota) pelota.x = 450;
      return { s, O, P, T };
    };
    const tieneFruta = (s: Simulacion, x: number): number => s.mundo.objetos.filter((o) => o.tipo === "fruta" && Math.abs(o.x - x) < 60).length;
    const probar = (brazo: Brazo, k: number) => {
      const libre = brazo.startsWith("libre");
      const propia = brazo.includes("comida propia");
      const celos = !(brazo === "libre solo envidia" || brazo === "libre sin ninguno" || brazo.endsWith("sin ninguna"));
      const envidia = !(brazo === "libre solo celos" || brazo === "libre sin ninguno" || brazo.endsWith("sin ninguna"));
      const { s, O, P, T } = montar(k, celos, envidia, libre);
      const pCome = brazo === "come y atiende" || brazo === "solo come" || libre;
      const tCome = brazo === "la tercera come y atiende";
      const pAtiende = brazo === "come y atiende" || brazo === "solo atiende" || brazo === "la tercera come y atiende" || libre;
      O.nec[0] = 0.8;
      P.nec[0] = pCome ? 0.8 : 0;
      T.nec[0] = tCome ? 0.8 : 0;
      const t0 = s.t;
      let prox = 0, cercaDeP = 0, celoMax = 0, envMax = 0, coexiste = 0, envP = 0, envT = 0, celoPorP = 0, celoOtros = 0, frustracionMax = 0, hambreSuma = 0, hambreN = 0;
      s.ganchos.push(() => {
        const dt = s.t - t0;
        // Posturas de la escena: P mira a T mientras dura el estimulo si la atiende, y si no, al lado contrario
        P.dir = pAtiende && dt <= ESTIMULO ? 1 : -1;
        T.dir = -1;
        if (dt <= ESTIMULO) {
          if (!libre) O.nec[0] = Math.max(O.nec[0], 0.8);
          if (pCome) P.nec[0] = Math.max(P.nec[0], 0.8);
          if (tCome) T.nec[0] = Math.max(T.nec[0], 0.8);
          if (dt >= prox) {
            prox = dt + CADA;
            if (pCome && tieneFruta(s, 700) < 2) s.mundo.agregar("fruta", 700);
            if (tCome && tieneFruta(s, 820) < 2) s.mundo.agregar("fruta", 820);
            if (propia && tieneFruta(s, 400) < 2) s.mundo.agregar("fruta", 400);
          }
          if (Math.abs(O.x - P.x) < 150) cercaDeP += 0.25;
          hambreSuma += O.nec[0]; hambreN++;
        }
        const c = O.celoMaximo(), e = O.envidiaMaxima();
        celoMax = Math.max(celoMax, c); envMax = Math.max(envMax, e); coexiste = Math.max(coexiste, Math.min(c, e));
        envP = Math.max(envP, O.envidiaPor(P.id)); envT = Math.max(envT, O.envidiaPor(T.id));
        celoPorP = Math.max(celoPorP, O.celoPorVinculo(P.id));
        for (const x of O.celosEstado) if (x.vinculo !== P.id) celoOtros = Math.max(celoOtros, x.nivel);
        frustracionMax = Math.max(frustracionMax, O.emo[E.frustracion]);
      });
      s.avanzar(ESTIMULO + 60);
      const registro = O.registro;
      const dentro = (r: { t: number }): boolean => r.t >= t0 && r.t < t0 + ESTIMULO;
      const acercaP = registro.filter((r) => r.kind === "inicio" && r.v === "acercarse" && r.obj === 1000 + P.id && dentro(r)).length;
      const propios = registro.filter((r) => r.kind === "impacto" && r.v === "probar" && r.tipo !== "criatura" && (r.res?.[0] ?? 0) > 0.05 && r.t >= t0);
      const episodios = (pref: string): boolean => O.mem.episodios.some((e) => e.clave.startsWith(pref));
      return {
        celoMax, envMax, coexiste, envP, envT, celoPorP, celoOtros, frustracionMax, hambreMedia: hambreN ? hambreSuma / hambreN : 0, cercaDeP, acercaP, golpes: golpes(O),
        primerBocado: propios.length ? propios[0].t - t0 : ESTIMULO + 60, bocadosPropios: propios.filter(dentro).length,
        recuerdaCelos: episodios("celos:"), recuerdaEnvidia: episodios("envidia:"),
        restosCelos: O.celosEstado.length + Object.keys(O.atendidaPor).length + (episodios("celos:") ? 1 : 0),
        restosEnvidia: O.envidiaEstado.length + Object.keys(O.vistoBocado).length + (episodios("envidia:") ? 1 : 0),
      };
    };
    // Repetida: cuatro veces la escena completa con calma entre medias, para ver que los agravios no se acumulan y el vinculo no se rompe
    const repetida = (k: number) => {
      const { s, O, P, T } = montar(k, true, true, false);
      const afectoAntes = afectoA(O, P.id);
      const t0 = s.t;
      let prox = 0, agravioPico = 0, afectoMin = afectoAntes;
      const ciclo = ESTIMULO + CALMA;
      s.ganchos.push(() => {
        const dt = (s.t - t0) % ciclo;
        const enEstimulo = dt <= ESTIMULO && s.t - t0 < RONDAS * ciclo;
        P.dir = enEstimulo ? 1 : -1;
        T.dir = -1;
        if (enEstimulo) {
          O.nec[0] = Math.max(O.nec[0], 0.8); P.nec[0] = Math.max(P.nec[0], 0.8); T.nec[0] = 0;
          if (dt >= prox) { prox = dt + CADA; if (tieneFruta(s, 700) < 2) s.mundo.agregar("fruta", 700); }
        } else {
          prox = 0;
          P.nec[0] = Math.min(P.nec[0], 0.3);
        }
        agravioPico = Math.max(agravioPico, agravioA(O, P.id, s.t), agravioA(O, T.id, s.t));
        afectoMin = Math.min(afectoMin, afectoA(O, P.id));
      });
      s.avanzar(RONDAS * ciclo + 600);
      return { agravioPico, agravioFinalP: agravioA(O, P.id, s.t), agravioFinalT: agravioA(O, T.id, s.t), afectoAntes, afectoFinal: afectoA(O, P.id), afectoMin, golpes: golpes(O), celosFinal: O.celoMaximo(), envidiaFinal: O.envidiaMaxima() };
    };
    const brazos: Brazo[] = ["come y atiende", "solo come", "solo atiende", "ni come ni atiende", "la tercera come y atiende", "libre con celos y envidia", "libre solo celos", "libre solo envidia", "libre sin ninguno", "libre con comida propia y las dos", "libre con comida propia sin ninguna"];
    const r = Object.fromEntries(brazos.map((b) => [b, Array.from({ length: REP }, (_, k) => probar(b, k))])) as Record<Brazo, ReturnType<typeof probar>[]>;
    const rep = Array.from({ length: REP }, (_, k) => repetida(k));
    const med = (b: Brazo, f: (x: ReturnType<typeof probar>) => number): number => mediana(r[b].map(f));
    const medR = (f: (x: ReturnType<typeof repetida>) => number): number => mediana(rep.map(f));
    const [CA, SC, SA, NN, TC, LB, LC, LE, L0, PB, P0] = brazos;
    const todas = (b: Brazo, f: (x: ReturnType<typeof probar>) => boolean): boolean => r[b].every(f);
    return resultado(semilla, {
      "coexisten: con vínculo fuerte, su compañero comiendo y atendiendo a la tercera siente a la vez celos y envidia (0,2 o más las dos al mismo tiempo), y ninguna se reduce a menos de tres cuartos de la que sentiría sola": med(CA, (x) => x.coexiste) >= 0.2 && med(CA, (x) => x.celoMax) >= 0.75 * med(SA, (x) => x.celoMax) && med(CA, (x) => x.envMax) >= 0.75 * med(SC, (x) => x.envMax),
      "la envidia va a quien come: comiendo el compañero, a él (0,2 o más) y no a la tercera (menos de 0,05); comiendo la tercera, a la tercera y no al compañero": med(CA, (x) => x.envP) >= 0.2 && med(CA, (x) => x.envT) < 0.05 && med(TC, (x) => x.envT) >= 0.2 && med(TC, (x) => x.envP) < 0.05,
      "los celos van a la atención: por el compañero que atiende a la tercera (0,2 o más) y por nadie más (menos de 0,05), comiendo él o comiendo ella": med(CA, (x) => x.celoPorP) >= 0.2 && med(CA, (x) => x.celoOtros) < 0.05 && med(TC, (x) => x.celoPorP) >= 0.2 && med(TC, (x) => x.celoOtros) < 0.05,
      "controles: si solo come hay envidia y no celos, si solo atiende hay celos y no envidia, y si no hace ninguna de las dos cosas no hay ninguna (menos de 0,1 las que no tocan)": med(SC, (x) => x.envMax) >= 0.2 && med(SC, (x) => x.celoMax) < 0.1 && med(SA, (x) => x.celoMax) >= 0.2 && med(SA, (x) => x.envMax) < 0.1 && med(NN, (x) => x.celoMax) < 0.1 && med(NN, (x) => x.envMax) < 0.1,
      "interruptores independientes: con solo celos no queda rastro de envidia, con solo envidia no queda rastro de celos, sin ninguno no queda rastro de ninguna, y con los dos aparecen las dos (0,1 o más)": todas(LC, (x) => x.restosEnvidia === 0) && todas(LE, (x) => x.restosCelos === 0) && todas(L0, (x) => x.restosCelos === 0 && x.restosEnvidia === 0) && med(LC, (x) => x.celoMax) >= 0.1 && med(LE, (x) => x.envMax) >= 0.1 && med(LB, (x) => x.celoMax) >= 0.1 && med(LB, (x) => x.envMax) >= 0.1,
      "conducta: libre, con las dos busca más a su compañero que sin ninguna (más tiempo cerca de él o más acercamientos)": med(LB, (x) => x.cercaDeP) > med(L0, (x) => x.cercaDeP) || med(LB, (x) => x.acercaP) > med(L0, (x) => x.acercaP),
      "no le impiden comer: libre, hambrienta y con alimento propio a sus pies, come también con celos y envidia activos (al menos un bocado propio en el estímulo y el primero en menos de 60 s, de mediana)": [PB, P0].every((b) => med(b, (x) => x.bocadosPropios) >= 1 && med(b, (x) => x.primerBocado) < 60),
      "no es hambre ni frustración: la frustración no sube más de 0,1 por encima del control en el que no hay ni comida ni atención": med(CA, (x) => x.frustracionMax) <= med(NN, (x) => x.frustracionMax) + 0.1,
      "sin agresión: no golpea a nadie (0 golpes de mediana) con las dos activas, libre": med(LB, (x) => x.golpes) === 0,
      "memoria: recuerda los dos episodios, el de celos y el de envidia (la mitad de las réplicas o más)": r[CA].filter((x) => x.recuerdaCelos).length >= REP / 2 && r[CA].filter((x) => x.recuerdaEnvidia).length >= REP / 2,
      "sin enemistad permanente: tras cuatro rondas y 10 minutos de calma, el agravio efectivo hacia el compañero y hacia la tercera es menor que 0,1, el pico no pasa de 0,5, el afecto por el compañero conserva al menos el 80 % del inicial y no hay golpes ni celos ni envidia vivos": medR((x) => x.agravioFinalP) < 0.1 && medR((x) => x.agravioFinalT) < 0.1 && medR((x) => x.agravioPico) <= 0.5 && medR((x) => x.afectoFinal / Math.max(0.01, x.afectoAntes)) >= 0.8 && medR((x) => x.golpes) === 0 && medR((x) => x.celosFinal) < 0.05 && medR((x) => x.envidiaFinal) < 0.05,
    }, {
      celosComeYAtiende: med(CA, (x) => x.celoMax), envidiaComeYAtiende: med(CA, (x) => x.envMax), coexistenciaComeYAtiende: med(CA, (x) => x.coexiste),
      celosSoloAtiende: med(SA, (x) => x.celoMax), envidiaSoloCome: med(SC, (x) => x.envMax), celosSoloCome: med(SC, (x) => x.celoMax), envidiaSoloAtiende: med(SA, (x) => x.envMax),
      celosNiNi: med(NN, (x) => x.celoMax), envidiaNiNi: med(NN, (x) => x.envMax),
      envidiaALaPoseedora: med(CA, (x) => x.envP), envidiaALaTercera: med(CA, (x) => x.envT), envidiaTerceraCome_aTercera: med(TC, (x) => x.envT), envidiaTerceraCome_aCompanero: med(TC, (x) => x.envP),
      celosPorCompanero: med(CA, (x) => x.celoPorP), celosPorOtros: med(CA, (x) => x.celoOtros), celosTerceraCome: med(TC, (x) => x.celoPorP),
      frustracionComeYAtiende: med(CA, (x) => x.frustracionMax), frustracionNiNi: med(NN, (x) => x.frustracionMax),
      libreCelosAmbos: med(LB, (x) => x.celoMax), libreEnvidiaAmbos: med(LB, (x) => x.envMax), libreCelosSolo: med(LC, (x) => x.celoMax), libreEnvidiaSolo: med(LE, (x) => x.envMax),
      cercaDePAmbos: med(LB, (x) => x.cercaDeP), cercaDePSoloCelos: med(LC, (x) => x.cercaDeP), cercaDePSoloEnvidia: med(LE, (x) => x.cercaDeP), cercaDePNinguno: med(L0, (x) => x.cercaDeP),
      acercamientosAmbos: med(LB, (x) => x.acercaP), acercamientosSoloCelos: med(LC, (x) => x.acercaP), acercamientosSoloEnvidia: med(LE, (x) => x.acercaP), acercamientosNinguno: med(L0, (x) => x.acercaP),
      primerBocadoAmbos: med(LB, (x) => x.primerBocado), primerBocadoSoloCelos: med(LC, (x) => x.primerBocado), primerBocadoSoloEnvidia: med(LE, (x) => x.primerBocado), primerBocadoNinguno: med(L0, (x) => x.primerBocado),
      primerBocadoComidaPropiaAmbos: med(PB, (x) => x.primerBocado), primerBocadoComidaPropiaNinguno: med(P0, (x) => x.primerBocado), bocadosComidaPropiaAmbos: med(PB, (x) => x.bocadosPropios), bocadosComidaPropiaNinguno: med(P0, (x) => x.bocadosPropios), cercaDePComidaPropiaAmbos: med(PB, (x) => x.cercaDeP), cercaDePComidaPropiaNinguno: med(P0, (x) => x.cercaDeP),
      golpesLibreAmbos: med(LB, (x) => x.golpes),
      agravioPicoRondas: medR((x) => x.agravioPico), agravioFinalCompanero: medR((x) => x.agravioFinalP), agravioFinalTercera: medR((x) => x.agravioFinalT),
      afectoAntesRondas: medR((x) => x.afectoAntes), afectoFinalRondas: medR((x) => x.afectoFinal), afectoMinimoRondas: medR((x) => x.afectoMin),
    }, null, 1200 + ESTIMULO + 60 + RONDAS * (ESTIMULO + CALMA) + 600);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso30: Caso = {
  id: "30",
  titulo: "El miedo frena los celos",
  hipotesis: "Si la tercera que recibe la atención de su vínculo le da miedo, porque le ha hecho daño o porque tiene fama de pegar, los celos suben menos y la empujan menos a acercarse a su vínculo (que está junto a la tercera). No es que se vuelva agresiva: busca menos esa zona. Con una tercera sin historia pasa lo del caso 27. Con los celos apagados el miedo, por sí solo, no explica la diferencia.",
  minimo: 0.8,
  ejecutar(semilla) {
    const REP = 8;
    const ESTIMULO = 60;
    const OBSERVA = 200;
    type Brazo = "atrapada, neutra" | "atrapada, le hizo daño" | "atrapada, con fama de pegar" | "neutra" | "le hizo daño" | "con fama de pegar" | "neutra, celos apagados" | "le hizo daño, celos apagados" | "con fama de pegar, celos apagados";
    const gO = genomaDe(semilla, 301);
    const gV = genomaDe(semilla, 302);
    const gT = genomaDe(semilla, 303);
    const golpes = (c: Criatura): number => c.registro.filter((r) => r.kind === "impacto" && r.v === "empujar" && r.tipo === "criatura").length;
    const probar = (brazo: Brazo, k: number) => {
      const daño = brazo.includes("hizo daño");
      const fama = brazo.includes("fama");
      const apagado = brazo.endsWith("apagados");
      const atrapada = brazo.startsWith("atrapada");
      const s = nuevaSim({ semilla: mezclar(semilla, 304, k), objetos: [{ tipo: "pelota", x: 700 }], criaturas: [{ genoma: clonarGenoma(gO), x: 600 }, { genoma: clonarGenoma(gV), x: 800 }], comedero: { cada: 100, max: 2, tipo: "fruta" } });
      const [O, V] = s.criaturas;
      for (const c of s.criaturas) { c.reconocePorRasgos = true; c.capRegistro = 50000; }
      O.celos = !apagado;
      s.avanzar(1200);
      const T = new Criatura(3, "Tercera", clonarGenoma(gT), 1000, mezclar(semilla, 305, k));
      T.reconocePorRasgos = true; T.capRegistro = 5000;
      s.criaturas.push(T);
      for (const o of [...s.mundo.objetos]) if (o.tipo === "fruta") s.mundo.quitar(o.id);
      s.comedero = null;
      // Historia con la tercera, de 100 s en todos los brazos (en el neutro no pasa nada): diez golpes que le hace a O, o diez golpes que se la ve dar a otra
      O.x = 500; O.accion = null; V.x = 800; V.atrapada = true; V.accion = null; V.vx = 0;
      T.x = 570; T.accion = null; T.atrapada = true; T.vx = 0;
      let prox = s.t + 10;
      const fin = s.t + 100;
      s.ganchos.push(() => {
        if (s.t >= fin) return;
        if (s.t >= prox) {
          prox += 10;
          if (daño) { T.x = O.x + 70; O.sufrir(0.4, 1000 + T.id, null, 0.3); O.anotarAgravio(1000 + T.id, 0.4); T.anotarAgravio(1000 + O.id, 0.25); }
        }
      });
      s.avanzar(100);
      // Escena como en el caso 27: V y T quietas a distancia visible de O, y V mira a T mientras dura el estimulo
      O.accion = null; O.emo.fill(0); O.nec[0] = 0.15; O.nec[1] = 0.1; O.nec[3] = 0.3; O.nec[4] = 0.3; O.x = 500;
      T.x = 920; T.dir = -1;
      const pelota = s.mundo.objetos.find((o) => o.tipo === "pelota");
      if (pelota) pelota.x = 480;
      // La fama de pegar es un dato de laboratorio (en el juego se forma al verla pegar, con la cuenta de gustos activa); con gustos apagado la atraccion por su vinculo llena el recuento de acercamientos y los celos no tienen margen
      if (fama) O.reputacion[1000 + T.id] = { agresion: 1 };
      O.atrapada = atrapada;
      const temor0 = O.temorA(T.id);
      const t0 = s.t;
      let celoMax = 0, frustracionMax = 0, cercaDeV = 0, cercaDeT = 0, aVista = 0;
      const juego0 = O.registro.length;
      s.ganchos.push(() => {
        const dt = s.t - t0;
        if (dt < 0) return;
        V.dir = dt <= ESTIMULO ? 1 : -1;
        T.dir = -1;
        celoMax = Math.max(celoMax, O.celoMaximo());
        if (dt <= ESTIMULO && O.social.duracion(V.id, T.id, s.t) > 0) aVista += 0.25;
        frustracionMax = Math.max(frustracionMax, O.emo[E.frustracion]);
        if (dt <= ESTIMULO) {
          if (Math.abs(O.x - V.x) < 150) cercaDeV += 0.25;
          if (Math.abs(O.x - T.x) < 150) cercaDeT += 0.25;
        }
      });
      s.avanzar(ESTIMULO + OBSERVA);
      const dentro = (r: { t: number }): boolean => r.t >= t0 && r.t < t0 + ESTIMULO;
      const acercaV = O.registro.slice(juego0).filter((r) => r.kind === "inicio" && r.v === "acercarse" && r.obj === 1000 + V.id && dentro(r)).length;
      const evitaT = O.registro.slice(juego0).filter((r) => r.kind === "inicio" && r.v === "evitar" && r.obj === 1000 + T.id && dentro(r)).length;
      const golpesNuevos = O.registro.slice(juego0).filter((r) => r.kind === "impacto" && r.v === "empujar" && r.tipo === "criatura").length;
      return { celoMax, aVista, frustracionMax, cercaDeV, cercaDeT, acercaV, evitaT, temor0, golpesNuevos, golpesTotal: golpes(O) };
    };
    const brazos: Brazo[] = ["atrapada, neutra", "atrapada, le hizo daño", "atrapada, con fama de pegar", "neutra", "le hizo daño", "con fama de pegar", "neutra, celos apagados", "le hizo daño, celos apagados", "con fama de pegar, celos apagados"];
    const r = Object.fromEntries(brazos.map((b) => [b, Array.from({ length: REP }, (_, k) => probar(b, k))])) as Record<Brazo, ReturnType<typeof probar>[]>;
    const med = (b: Brazo, f: (x: ReturnType<typeof probar>) => number): number => mediana(r[b].map(f));
    const [AN, AD, AF, N0, DA, FA, N0o, DAo, FAo] = brazos;
    // Lo que añaden los celos a los acercamientos a su vinculo: brazo con celos menos el mismo brazo con los celos apagados
    const ganaNeutra = med(N0, (x) => x.acercaV) - med(N0o, (x) => x.acercaV);
    const ganaDanio = med(DA, (x) => x.acercaV) - med(DAo, (x) => x.acercaV);
    const ganaFama = med(FA, (x) => x.acercaV) - med(FAo, (x) => x.acercaV);
    return resultado(semilla, {
      "sin miedo, celos como siempre: con una tercera sin historia los celos son claros (0,2 o más), inmovilizada y libre": med(AN, (x) => x.celoMax) >= 0.2 && med(N0, (x) => x.celoMax) >= 0.2,
      "el miedo se forma: la teme (0,2 o más) si le hizo daño o tiene fama de pegar, y no si es neutra (menos de 0,1)": med(AD, (x) => x.temor0) >= 0.2 && med(AF, (x) => x.temor0) >= 0.2 && med(AN, (x) => x.temor0) < 0.1,
      "el miedo frena los celos aunque vea lo mismo (inmovilizada): con fama de pegar el pico es al menos un 20 % menor que con la neutra, y ve la atención de su vínculo durante al menos el 80 % del tiempo que la ve con la neutra": med(AF, (x) => x.celoMax) <= 0.8 * med(AN, (x) => x.celoMax) && med(AF, (x) => x.aVista) >= 0.8 * med(AN, (x) => x.aVista),
      "el miedo frena lo que los celos la empujan a hacer: con fama de pegar los celos suman menos acercamientos a su vínculo que con la neutra": ganaFama < ganaNeutra,
      "con daño aprendido hay menos celos que con la neutra (al menos un 20 % menos de pico)": med(DA, (x) => x.celoMax) <= 0.8 * med(N0, (x) => x.celoMax),
      "no se vuelve agresiva: no golpea a nadie después de la historia (0 golpes de mediana, en ningún brazo)": brazos.every((b) => med(b, (x) => x.golpesNuevos) === 0),
      "no es frustración: la frustración no sube más de 0,1 por encima de la de la neutra (con fama y con daño)": [DA, FA].every((b) => med(b, (x) => x.frustracionMax) <= med(N0, (x) => x.frustracionMax) + 0.1),
    }, {
      celosInmovilNeutra: med(AN, (x) => x.celoMax), celosInmovilHizoDanio: med(AD, (x) => x.celoMax), celosInmovilFama: med(AF, (x) => x.celoMax), vistaInmovilNeutra: med(AN, (x) => x.aVista), vistaInmovilHizoDanio: med(AD, (x) => x.aVista), vistaInmovilFama: med(AF, (x) => x.aVista),
      celosNeutra: med(N0, (x) => x.celoMax), celosHizoDanio: med(DA, (x) => x.celoMax), celosFamaDePegar: med(FA, (x) => x.celoMax),
      temorNeutra: med(AN, (x) => x.temor0), temorHizoDanio: med(AD, (x) => x.temor0), temorFamaDePegar: med(AF, (x) => x.temor0),
      segundosQueVeLaAtencionNeutra: med(N0, (x) => x.aVista), segundosQueVeLaAtencionHizoDanio: med(DA, (x) => x.aVista), segundosQueVeLaAtencionFama: med(FA, (x) => x.aVista),
      cercaDeVNeutra: med(N0, (x) => x.cercaDeV), cercaDeVHizoDanio: med(DA, (x) => x.cercaDeV), cercaDeVFama: med(FA, (x) => x.cercaDeV),
      cercaDeVNeutraApagado: med(N0o, (x) => x.cercaDeV), cercaDeVHizoDanioApagado: med(DAo, (x) => x.cercaDeV), cercaDeVFamaApagado: med(FAo, (x) => x.cercaDeV),
      acercamientosNeutra: med(N0, (x) => x.acercaV), acercamientosHizoDanio: med(DA, (x) => x.acercaV), acercamientosFama: med(FA, (x) => x.acercaV),
      acercamientosNeutraApagado: med(N0o, (x) => x.acercaV), acercamientosHizoDanioApagado: med(DAo, (x) => x.acercaV), acercamientosFamaApagado: med(FAo, (x) => x.acercaV),
      gananciaDeLosCelosNeutra: ganaNeutra, gananciaDeLosCelosHizoDanio: ganaDanio, gananciaDeLosCelosFama: ganaFama,
      cercaDeTNeutra: med(N0, (x) => x.cercaDeT), cercaDeTHizoDanio: med(DA, (x) => x.cercaDeT), cercaDeTFama: med(FA, (x) => x.cercaDeT),
      evitaTNeutra: med(N0, (x) => x.evitaT), evitaTHizoDanio: med(DA, (x) => x.evitaT), evitaTFama: med(FA, (x) => x.evitaT),
      frustracionNeutra: med(N0, (x) => x.frustracionMax), frustracionHizoDanio: med(DA, (x) => x.frustracionMax), frustracionFama: med(FA, (x) => x.frustracionMax),
    }, null, 1200 + 100 + ESTIMULO + OBSERVA);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso31: Caso = {
  id: "31",
  titulo: "Celos según el afecto",
  hipotesis: "Con la escena del caso 27 y solo el afecto por el vínculo cambiado (0,10; 0,20; 0,29; 0,35; 0,50; 0,70; 0,90), se caracteriza la forma del umbral. Por debajo del umbral de 0,3 no hay celos ni ningún cambio de conducta (con los celos encendidos o apagados la criatura hace lo mismo). Por encima los hay y crecen con el afecto. El caso no puede descubrir si el umbral 'existe' en las criaturas (es un parámetro de diseño), sino cuánto salta el estado interno y la conducta al cruzarlo: si lo que se ve es un escalón, o una subida gradual.",
  minimo: 0.8,
  ejecutar(semilla) {
    const REP = 5;
    const ESTIMULO = 60;
    const OBSERVA = 200;
    const AFECTOS = [0.10, 0.20, 0.29, 0.35, 0.50, 0.70, 0.90];
    const gO = genomaDe(semilla, 311);
    const gV = genomaDe(semilla, 312);
    const gT = genomaDe(semilla, 313);
    const probar = (afecto: number, apagado: boolean, k: number) => {
      const s = nuevaSim({ semilla: mezclar(semilla, 314, k), objetos: [{ tipo: "pelota", x: 700 }], criaturas: [{ genoma: clonarGenoma(gO), x: 600 }, { genoma: clonarGenoma(gV), x: 800 }], comedero: { cada: 100, max: 2, tipo: "fruta" } });
      const [O, V] = s.criaturas;
      for (const c of s.criaturas) { c.reconocePorRasgos = true; c.capRegistro = 50000; }
      O.celos = !apagado;
      s.avanzar(1200);
      const T = new Criatura(3, "Tercera", clonarGenoma(gT), 1000, mezclar(semilla, 315, k));
      T.reconocePorRasgos = true; T.capRegistro = 5000;
      s.criaturas.push(T);
      for (const o of [...s.mundo.objetos]) if (o.tipo === "fruta") s.mundo.quitar(o.id);
      s.comedero = null;
      // Escena del caso 27: V y T quietas a distancia visible de O, y V mira a T durante el estimulo
      O.x = 500; O.accion = null; O.emo.fill(0); O.nec[0] = 0.15; O.nec[1] = 0.1; O.nec[3] = 0.3; O.nec[4] = 0.3;
      V.x = 800; V.atrapada = true; V.accion = null; V.vx = 0;
      T.x = 920; T.atrapada = true; T.accion = null; T.vx = 0; T.dir = -1;
      const pelota = s.mundo.objetos.find((o) => o.tipo === "pelota");
      if (pelota) pelota.x = 480;
      // Lo unico que cambia: el afecto por su vinculo, fijado (dato de laboratorio) y devuelto a su valor al acabar cada paso. Dentro de un paso puede subir hasta 0,08 al terminar un acercamiento con compañia, despues de que ella haya decidido, asi que nunca decide con un valor distinto del fijado
      const vinculo = O.mem.vinculos.find((q) => q.id === 1000 + V.id);
      if (vinculo) vinculo.afecto = afecto;
      const t0 = s.t;
      let celoMax = 0, cercaDeV = 0, aVista = 0, frustracionMax = 0, afectoAlto = 0, afectoBajo = 9, celo15 = -1;
      const juego0 = O.registro.length;
      s.ganchos.push(() => {
        const dt = s.t - t0;
        if (dt < 0) return;
        V.dir = dt <= ESTIMULO ? 1 : -1;
        T.dir = -1;
        // Se anota lo mas alto y lo mas bajo que llego a valer en un paso antes de devolverlo a su valor (el olvido periodico lo mueve un poco)
        if (vinculo) { afectoAlto = Math.max(afectoAlto, vinculo.afecto); afectoBajo = Math.min(afectoBajo, vinculo.afecto); vinculo.afecto = afecto; }
        if (dt >= 15 && celo15 < 0) celo15 = O.celoMaximo();
        celoMax = Math.max(celoMax, O.celoMaximo());
        frustracionMax = Math.max(frustracionMax, O.emo[E.frustracion]);
        if (dt <= ESTIMULO) {
          if (Math.abs(O.x - V.x) < 150) cercaDeV += 0.25;
          if (O.social.duracion(V.id, T.id, s.t) > 0) aVista += 0.25;
        }
      });
      s.avanzar(ESTIMULO + OBSERVA);
      const dentro = (r: { t: number }): boolean => r.t >= t0 && r.t < t0 + ESTIMULO;
      const reg = O.registro.slice(juego0);
      const acercaV = reg.filter((r) => r.kind === "inicio" && r.v === "acercarse" && r.obj === 1000 + V.id && dentro(r)).length;
      const juego = reg.filter((r) => r.kind === "impacto" && r.tipo !== "criatura" && (r.v === "empujar" || r.v === "tocar") && dentro(r)).length;
      return { celoMax, celo15, cercaDeV, aVista, acercaV, juego, frustracionMax, cruzaElUmbral: afecto < AJ.umbralVinculoCelos ? afectoAlto >= AJ.umbralVinculoCelos : afectoBajo < AJ.umbralVinculoCelos, deriva: Math.max(afectoAlto - afecto, afecto - afectoBajo) };
    };
    const rc = AFECTOS.map((a) => Array.from({ length: REP }, (_, k) => probar(a, false, k)));
    const ra = AFECTOS.map((a) => Array.from({ length: REP }, (_, k) => probar(a, true, k)));
    type R = ReturnType<typeof probar>;
    const medC = (i: number, f: (x: R) => number): number => mediana(rc[i].map(f));
    const medA = (i: number, f: (x: R) => number): number => mediana(ra[i].map(f));
    const debajo = [0, 1, 2];
    const encima = [3, 4, 5, 6];
    const celos = AFECTOS.map((_, i) => medC(i, (x) => x.celoMax));
    const diferenciaConducta = (i: number): number => Math.abs(medC(i, (x) => x.cercaDeV) - medA(i, (x) => x.cercaDeV)) + Math.abs(medC(i, (x) => x.acercaV) - medA(i, (x) => x.acercaV)) + Math.abs(medC(i, (x) => x.juego) - medA(i, (x) => x.juego));
    const metricas: Record<string, number> = {};
    AFECTOS.forEach((a, i) => {
      const e = String(Math.round(a * 100));
      metricas[`celos_${e}`] = celos[i];
      metricas[`celosA15s_${e}`] = medC(i, (x) => x.celo15);
      metricas[`derivaDelAfecto_${e}`] = medC(i, (x) => x.deriva);
      metricas[`aVista_${e}`] = medC(i, (x) => x.aVista);
      metricas[`cercaDeV_${e}`] = medC(i, (x) => x.cercaDeV);
      metricas[`cercaDeV_${e}_apagado`] = medA(i, (x) => x.cercaDeV);
      metricas[`acercamientos_${e}`] = medC(i, (x) => x.acercaV);
      metricas[`acercamientos_${e}_apagado`] = medA(i, (x) => x.acercaV);
      metricas[`juego_${e}`] = medC(i, (x) => x.juego);
      metricas[`juego_${e}_apagado`] = medA(i, (x) => x.juego);
    });
    metricas.saltoDeCelosAlCruzarElUmbral = celos[3] - celos[2];
    metricas.saltoDeCercaDeVAlCruzarElUmbral = (medC(3, (x) => x.cercaDeV) - medA(3, (x) => x.cercaDeV)) - (medC(2, (x) => x.cercaDeV) - medA(2, (x) => x.cercaDeV));
    return resultado(semilla, {
      "por debajo del umbral no hay celos: con afecto 0,10; 0,20 y 0,29 el pico es menor que 0,05": debajo.every((i) => celos[i] < 0.05),
      "por encima del umbral los hay: con afecto 0,35 el pico es de 0,2 o más": celos[3] >= 0.2,
      "crecen con el afecto: con 0,35; 0,50; 0,70 y 0,90 el pico no baja de un nivel al siguiente (a lo sumo 0,05 de retroceso)": encima.slice(1).every((i) => celos[i] >= celos[i - 1] - 0.05),
      "el interruptor no hace nada por debajo del umbral: con 0,10; 0,20 y 0,29 la conducta es la misma con los celos encendidos y apagados (tiempo cerca, acercamientos y juego)": debajo.every((i) => diferenciaConducta(i) === 0),
      "por encima del umbral cambia la conducta: con 0,50 busca más a su vínculo con los celos que sin ellos (más tiempo cerca o más acercamientos)": medC(4, (x) => x.cercaDeV) > medA(4, (x) => x.cercaDeV) || medC(4, (x) => x.acercaV) > medA(4, (x) => x.acercaV),
      "y juega menos con la pelota con los celos que sin ellos (con 0,50)": medC(4, (x) => x.juego) < medA(4, (x) => x.juego),
    }, metricas, null, 1200 + ESTIMULO + OBSERVA);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso32: Caso = {
  id: "32",
  titulo: "El reencuentro con la tercera",
  hipotesis: "Tras sentir celos al ver a su vínculo atender a una tercera, y después de un minuto separadas, ¿qué hace la criatura al volver a encontrarse con la tercera sola? Puede evitarla, buscarla más o comportarse igual. Se compara con tres controles: los mismos hechos con los celos apagados, la tercera presente pero sin que el vínculo la atienda (no hay celos) y una tercera desconocida. Es una pregunta abierta: no se fija de antemano qué debería pasar. Los criterios solo comprueban que la prueba es válida (el estímulo produce celos, deja la huella prevista, la criatura ve a la tercera) y que no hay agresión; el resultado conductual se informa y se clasifica con una regla escrita antes de verlo.",
  minimo: 0.8,
  ejecutar(semilla) {
    const REP = 8;
    const ESTIMULO = 60;
    const SEPARADAS = 60;
    const SEPARADAS_LARGO = 300;
    const REENCUENTRO = 120;
    type Brazo = "celos y reencuentro" | "mismo estimulo, celos apagados" | "el vinculo no atiende a la tercera" | "tercera desconocida" | "celos, reencuentro tras 5 min" | "el vinculo no atiende, reencuentro tras 5 min";
    const gO = genomaDe(semilla, 321);
    const gV = genomaDe(semilla, 322);
    const gT = genomaDe(semilla, 323);
    const afectoA = (O: Criatura, id: number): number => O.mem.vinculos.find((q) => q.id === 1000 + id)?.afecto ?? 0;
    const probar = (brazo: Brazo, k: number) => {
      const apagado = brazo === "mismo estimulo, celos apagados";
      const sinAtencion = brazo === "el vinculo no atiende a la tercera" || brazo === "el vinculo no atiende, reencuentro tras 5 min";
      const separadas = brazo.includes("5 min") ? SEPARADAS_LARGO : SEPARADAS;
      const desconocida = brazo === "tercera desconocida";
      const s = nuevaSim({ semilla: mezclar(semilla, 324, k), objetos: [{ tipo: "pelota", x: 700 }], criaturas: [{ genoma: clonarGenoma(gO), x: 600 }, { genoma: clonarGenoma(gV), x: 800 }], comedero: { cada: 100, max: 2, tipo: "fruta" } });
      const [O, V] = s.criaturas;
      for (const c of s.criaturas) { c.reconocePorRasgos = true; c.capRegistro = 50000; }
      O.celos = !apagado;
      s.avanzar(1200);
      const T = new Criatura(3, "Tercera", clonarGenoma(gT), 1000, mezclar(semilla, 325, k));
      T.reconocePorRasgos = true; T.capRegistro = 5000;
      for (const o of [...s.mundo.objetos]) if (o.tipo === "fruta") s.mundo.quitar(o.id);
      s.comedero = null;
      // Fase 1 (caso 27): V y T quietas a distancia visible de O, y V mira a T durante el estimulo (salvo en los controles)
      O.x = 500; O.accion = null; O.emo.fill(0); O.nec[0] = 0.15; O.nec[1] = 0.1; O.nec[3] = 0.3; O.nec[4] = 0.3;
      V.x = 800; V.atrapada = true; V.accion = null; V.vx = 0;
      T.x = 920; T.atrapada = true; T.accion = null; T.vx = 0; T.dir = -1; T.nec[0] = 0;
      if (!desconocida) s.criaturas.push(T);
      const pelota = s.mundo.objetos.find((o) => o.tipo === "pelota");
      if (pelota) pelota.x = 480;
      const afectoVAntes = afectoA(O, V.id);
      const t0 = s.t;
      let celoMaxEstimulo = 0;
      let fase: "estimulo" | "separadas" | "reencuentro" = "estimulo";
      let vistaT = 0, pasosReencuentro = 0, cercaDeT = 0, celoAlReencuentro = -1;
      let tReencuentro = -1;
      s.ganchos.push(() => {
        const dt = s.t - t0;
        if (fase === "estimulo") {
          V.dir = !sinAtencion && dt <= ESTIMULO ? 1 : -1;
          T.dir = -1;
          celoMaxEstimulo = Math.max(celoMaxEstimulo, O.celoMaximo());
        } else if (fase === "reencuentro") {
          T.dir = O.x > T.x ? -1 : 1; // de espaldas a ella: no la atiende
          pasosReencuentro++;
          if (O.percibidos.some((p) => p.id === 1000 + T.id)) vistaT++;
          if (Math.abs(O.x - T.x) < 150) cercaDeT += 0.25;
        }
      });
      s.avanzar(ESTIMULO);
      const afectoTTrasEstimulo = afectoA(O, T.id);
      const afectoVTrasEstimulo = afectoA(O, V.id);
      const episodioTrasEstimulo = O.mem.episodios.some((e) => e.clave.startsWith("celos:"));
      // Fase 2: separadas. V y T se van de la sala y O se queda sola
      fase = "separadas";
      s.criaturas = [O];
      O.accion = null;
      s.avanzar(separadas);
      celoAlReencuentro = O.celoMaximo();
      const afectoVTrasSepararse = afectoA(O, V.id);
      // Fase 3: vuelve la tercera sola, quieta y de espaldas, a 300 de O
      T.atrapada = true; T.accion = null; T.vx = 0; T.nec[0] = 0; T.emo.fill(0);
      T.x = O.x + 300 < 1500 ? O.x + 300 : O.x - 300;
      s.criaturas.push(T);
      fase = "reencuentro";
      tReencuentro = s.t;
      const reg0 = O.registro.length;
      s.avanzar(REENCUENTRO);
      const reg = O.registro.slice(reg0);
      const primero = (v: string): number => { const r = reg.find((x) => x.kind === "inicio" && x.v === v && x.obj === 1000 + T.id); return r ? r.t - tReencuentro : REENCUENTRO; };
      const cuenta = (v: string): number => reg.filter((x) => x.kind === "inicio" && x.v === v && x.obj === 1000 + T.id).length;
      const golpesAT = reg.filter((x) => x.kind === "impacto" && x.v === "empujar" && x.tipo === "criatura").length;
      const agravioT = (() => { const a = O.agravios[1000 + T.id]; return a ? a.n * Math.exp(-(s.t - a.t) / AJ.olvidoAgravio) : 0; })();
      return {
        celoMaxEstimulo, celoAlReencuentro, episodio: episodioTrasEstimulo, agravioT, afectoVAntes, afectoVTrasEstimulo, afectoVTrasSepararse,
        afectoTTrasEstimulo, afectoTDespues: afectoA(O, T.id), vistaT: pasosReencuentro ? vistaT / pasosReencuentro : 0,
        tAcerca: primero("acercarse"), tEvita: primero("evitar"), acercamientos: cuenta("acercarse"), evitaciones: cuenta("evitar"), cercaDeT, golpesAT,
      };
    };
    const brazos: Brazo[] = ["celos y reencuentro", "mismo estimulo, celos apagados", "el vinculo no atiende a la tercera", "tercera desconocida", "celos, reencuentro tras 5 min", "el vinculo no atiende, reencuentro tras 5 min"];
    const r = Object.fromEntries(brazos.map((b) => [b, Array.from({ length: REP }, (_, k) => probar(b, k))])) as Record<Brazo, ReturnType<typeof probar>[]>;
    const med = (b: Brazo, f: (x: ReturnType<typeof probar>) => number): number => mediana(r[b].map(f));
    const [CR, AP, SA, DE, CL, SL] = brazos;
    // Regla de clasificacion, escrita antes de ver los resultados: se compara el tiempo cerca de la tercera con los celos frente al control de «el vinculo no atiende» (mediana).
    // Hay efecto si la diferencia es de al menos 10 s (de 120) y de al menos el 25 % del control; se mira a la vez que los acercamientos no vayan en sentido contrario.
    const dif = med(CR, (x) => x.cercaDeT) - med(SA, (x) => x.cercaDeT);
    const base = Math.max(1, med(SA, (x) => x.cercaDeT));
    const clase = Math.abs(dif) >= 10 && Math.abs(dif) >= 0.25 * base ? (dif > 0 ? 1 : -1) : 0;
    const difL = med(CL, (x) => x.cercaDeT) - med(SL, (x) => x.cercaDeT);
    const baseL = Math.max(1, med(SL, (x) => x.cercaDeT));
    const claseL = Math.abs(difL) >= 10 && Math.abs(difL) >= 0.25 * baseL ? (difL > 0 ? 1 : -1) : 0;
    return resultado(semilla, {
      "el estímulo produce celos: con celos el pico es de 0,2 o más, y menor que 0,1 con los celos apagados, sin atención del vínculo y sin tercera": med(CR, (x) => x.celoMaxEstimulo) >= 0.2 && [AP, SA, DE].every((b) => med(b, (x) => x.celoMaxEstimulo) < 0.1),
      "deja la huella prevista: con celos queda un episodio (la mitad de las réplicas o más) y un agravio hacia la tercera mayor que en los controles": r[CR].filter((x) => x.episodio).length >= REP / 2 && med(CR, (x) => x.agravioT) > Math.max(med(AP, (x) => x.agravioT), med(SA, (x) => x.agravioT), med(DE, (x) => x.agravioT)),
      "la prueba es válida: en el reencuentro la criatura ve a la tercera la mitad del tiempo o más en todas las condiciones": brazos.every((b) => med(b, (x) => x.vistaT) >= 0.5),
      "tras 5 minutos los celos se han ido: al reencontrarse son menores que 0,1 en mediana, y la criatura sigue recordando el episodio (la mitad de las réplicas o más)": med(CL, (x) => x.celoAlReencuentro) < 0.1 && r[CL].filter((x) => x.episodio).length >= REP / 2,
      "sin agresión: no golpea a la tercera en el reencuentro (0 golpes de mediana en ninguna condición)": brazos.every((b) => med(b, (x) => x.golpesAT) === 0),
    }, {
      celosEnElEstimulo: med(CR, (x) => x.celoMaxEstimulo), celosAlReencontrarse: med(CR, (x) => x.celoAlReencuentro),
      agravioHaciaLaTerceraCelos: med(CR, (x) => x.agravioT), agravioHaciaLaTerceraApagado: med(AP, (x) => x.agravioT), agravioHaciaLaTerceraSinAtencion: med(SA, (x) => x.agravioT), agravioHaciaLaTerceraDesconocida: med(DE, (x) => x.agravioT),
      afectoVinculoAntes: med(CR, (x) => x.afectoVAntes), afectoVinculoTrasEstimulo: med(CR, (x) => x.afectoVTrasEstimulo), afectoVinculoTrasSepararse: med(CR, (x) => x.afectoVTrasSepararse),
      afectoVinculoTrasEstimuloApagado: med(AP, (x) => x.afectoVTrasEstimulo), afectoVinculoTrasSepararseApagado: med(AP, (x) => x.afectoVTrasSepararse), afectoVinculoTrasSepararseSinAtencion: med(SA, (x) => x.afectoVTrasSepararse),
      afectoTerceraTrasEstimulo: med(CR, (x) => x.afectoTTrasEstimulo), afectoTerceraDespues: med(CR, (x) => x.afectoTDespues), afectoTerceraDespuesApagado: med(AP, (x) => x.afectoTDespues), afectoTerceraDespuesSinAtencion: med(SA, (x) => x.afectoTDespues), afectoTerceraDespuesDesconocida: med(DE, (x) => x.afectoTDespues),
      vistaTerceraCelos: med(CR, (x) => x.vistaT), vistaTerceraApagado: med(AP, (x) => x.vistaT), vistaTerceraSinAtencion: med(SA, (x) => x.vistaT), vistaTerceraDesconocida: med(DE, (x) => x.vistaT),
      segundosHastaAcercarseCelos: med(CR, (x) => x.tAcerca), segundosHastaAcercarseApagado: med(AP, (x) => x.tAcerca), segundosHastaAcercarseSinAtencion: med(SA, (x) => x.tAcerca), segundosHastaAcercarseDesconocida: med(DE, (x) => x.tAcerca),
      segundosHastaEvitarCelos: med(CR, (x) => x.tEvita), segundosHastaEvitarSinAtencion: med(SA, (x) => x.tEvita), segundosHastaEvitarDesconocida: med(DE, (x) => x.tEvita),
      acercamientosCelos: med(CR, (x) => x.acercamientos), acercamientosApagado: med(AP, (x) => x.acercamientos), acercamientosSinAtencion: med(SA, (x) => x.acercamientos), acercamientosDesconocida: med(DE, (x) => x.acercamientos),
      evitacionesCelos: med(CR, (x) => x.evitaciones), evitacionesApagado: med(AP, (x) => x.evitaciones), evitacionesSinAtencion: med(SA, (x) => x.evitaciones), evitacionesDesconocida: med(DE, (x) => x.evitaciones),
      segundosCercaDeLaTerceraCelos: med(CR, (x) => x.cercaDeT), segundosCercaDeLaTerceraApagado: med(AP, (x) => x.cercaDeT), segundosCercaDeLaTerceraSinAtencion: med(SA, (x) => x.cercaDeT), segundosCercaDeLaTerceraDesconocida: med(DE, (x) => x.cercaDeT),
      diferenciaDeTiempoCercaCelosMenosSinAtencion: dif,
      clasificacion_1_busca_0_igual_menos1_evita: clase,
      celosAlReencontrarseTras5min: med(CL, (x) => x.celoAlReencuentro), agravioTras5min: med(CL, (x) => x.agravioT), agravioTras5minSinAtencion: med(SL, (x) => x.agravioT),
      segundosHastaAcercarseTras5min: med(CL, (x) => x.tAcerca), segundosHastaAcercarseTras5minSinAtencion: med(SL, (x) => x.tAcerca),
      acercamientosTras5min: med(CL, (x) => x.acercamientos), acercamientosTras5minSinAtencion: med(SL, (x) => x.acercamientos),
      evitacionesTras5min: med(CL, (x) => x.evitaciones), evitacionesTras5minSinAtencion: med(SL, (x) => x.evitaciones),
      segundosCercaDeLaTerceraTras5min: med(CL, (x) => x.cercaDeT), segundosCercaDeLaTerceraTras5minSinAtencion: med(SL, (x) => x.cercaDeT),
      afectoTerceraDespuesTras5min: med(CL, (x) => x.afectoTDespues), afectoTerceraDespuesTras5minSinAtencion: med(SL, (x) => x.afectoTDespues),
      diferenciaDeTiempoCercaTras5min: difL, clasificacionTras5min_1_busca_0_igual_menos1_evita: claseL,
    }, null, 1200 + ESTIMULO + SEPARADAS_LARGO + REENCUENTRO);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso33: Caso = {
  id: "33",
  titulo: "Rehabilitación",
  hipotesis: "Una criatura maltratada por una agresora de regla fija (la raza simple hostil) aprende a temerla. Al pasar a otra sala con otro cuidado conserva ese miedo. Se mide si puede recuperarse y qué lo hace posible. Con la extinción del miedo encendida, el contacto seguro con lo que teme (la propia agresora, ya inofensiva y de compañera) lo baja mucho. La compañía de una amistosa de la misma raza pero con otra huella, o de una distinta, o estar sola, no lo baja, porque el recuerdo es de un individuo y lo que se parece poco no cuenta. Sin la extinción no se recupera. Después, ante un doble inofensivo de la agresora, se mide qué hace: se acerca, evita, se queda cerca. No se le dicta nada.",
  minimo: 0.8,
  ejecutar(semilla) {
    const REP = 5;
    const ABUSO = 300;
    const REHABILITACION = 900;
    const PRUEBA = 150;
    type Brazo = "con la agresora ya inofensiva" | "con una amistosa de su raza, otra huella" | "con una amistosa distinta" | "sola" | "sin maltrato, con la inofensiva" | "como la primera, sin extincion";
    const gV = genomaDe(semilla, 331);
    const peligro = (V: Criatura, H: Criatura): number => { const p = V.mem.predecir("presencia", featuresCriatura(H), new Array(10).fill(1), 0); return p.res[C.dano] * p.conf; };
    const probar = (brazo: Brazo, k: number) => {
      const maltratada = brazo !== "sin maltrato, con la inofensiva";
      const misma = brazo === "con la agresora ya inofensiva" || brazo === "sin maltrato, con la inofensiva" || brazo === "como la primera, sin extincion";
      const raza = brazo === "con una amistosa de su raza, otra huella";
      const distinta = brazo === "con una amistosa distinta";
      const extincion = brazo !== "como la primera, sin extincion";
      // Fase 1: la sala de la agresora (en el control, la misma sala sin agresora)
      const s1 = nuevaSim({ semilla: mezclar(semilla, 334, k), objetos: [{ tipo: "pelota", x: 500 }], criaturas: [{ genoma: clonarGenoma(gV), x: 400 }], comedero: { cada: 100, max: 2, tipo: "fruta" } });
      const V = s1.criaturas[0];
      V.capRegistro = 50000;
      const H = actor("hostil", 9, 700, semilla);
      if (maltratada) s1.criaturas.push(H);
      s1.avanzar(ABUSO);
      const golpesRecibidos = H.registro.filter((r) => r.kind === "impacto" && r.v === "empujar" && r.tipo === "criatura").length;
      const peligroTrasAbuso = peligro(V, H);
      const miedoRasgoAbuso = V.rasgos[R.miedo] - V.base[R.miedo];
      // Fase 2: el traspaso. Una sala nueva con otro cuidado; la criatura conserva lo aprendido (solo se borra lo que depende del reloj anterior)
      const s2 = nuevaSim({ semilla: mezclar(semilla, 335, k), objetos: [{ tipo: "pelota", x: 800 }], criaturas: [], comedero: { cada: 100, max: 2, tipo: "fruta" } });
      V.reiniciarReloj();
      V.accion = null; V.x = 400; V.extincion = extincion;
      s2.criaturas.push(V);
      if (misma || raza || distinta) {
        // Una amistosa que ocupa el sitio de la agresora: con su misma pinta y huella (la propia agresora ya inofensiva), con su pinta y otra huella (otra de su raza,
        // con la huella a 0,5 de distancia), o distinta en todo (con la huella tambien lejana). Las huellas se fijan para que no dependan del azar.
        const amiga = actor("amistosa", 8, 650, semilla);
        if (misma || raza) amiga.genoma = clonarGenoma(H.genoma);
        amiga.huella = misma ? H.huella : (H.huella + 0.5) % 1;
        s2.criaturas.push(amiga);
      }
      const peligroAlLlegar = peligro(V, H);
      const t0 = s2.t;
      let miedoSuma = 0, miedoN = 0, juegoFinal = 0, primerJuego = REHABILITACION;
      const juego0 = V.registro.length;
      s2.ganchos.push(() => {
        const dt = s2.t - t0;
        if (dt > REHABILITACION - 300) { miedoSuma += V.emo[E.miedo]; miedoN++; }
      });
      s2.avanzar(REHABILITACION);
      const miedoRehab = miedoN ? miedoSuma / miedoN : 0;
      const reg = V.registro.slice(juego0);
      const juegos = reg.filter((r) => r.kind === "impacto" && r.tipo === "pelota" && (r.v === "empujar" || r.v === "tocar"));
      if (juegos.length) primerJuego = juegos[0].t - t0;
      juegoFinal = juegos.filter((r) => r.t >= t0 + REHABILITACION - 300).length;
      const peligroTrasRehab = peligro(V, H);
      // Fase 3: un doble inofensivo de la agresora (misma pinta, quieto y de espaldas) a 300 de la criatura
      s2.criaturas = s2.criaturas.filter((c) => c === V);
      const doble = actor("amistosa", 7, V.x + 300 < 1500 ? V.x + 300 : V.x - 300, semilla);
      doble.genoma = clonarGenoma(H.genoma);
      doble.huella = H.huella;
      doble.atrapada = true; doble.dir = V.x > doble.x ? -1 : 1;
      s2.criaturas.push(doble);
      V.accion = null;
      const tP = s2.t;
      let miedoPico = 0, cerca = 0;
      s2.ganchos.push(() => {
        if (s2.t < tP) return;
        doble.dir = V.x > doble.x ? -1 : 1;
        miedoPico = Math.max(miedoPico, V.emo[E.miedo]);
        if (Math.abs(V.x - doble.x) < 150) cerca += 0.25;
      });
      const reg1 = V.registro.length;
      s2.avanzar(PRUEBA);
      const regP = V.registro.slice(reg1);
      const primero = (v: string): number => { const r = regP.find((x) => x.kind === "inicio" && x.v === v && x.obj === 1000 + doble.id); return r ? r.t - tP : PRUEBA; };
      const cuenta = (v: string): number => regP.filter((x) => x.kind === "inicio" && x.v === v && x.obj === 1000 + doble.id).length;
      const golpesAlDoble = regP.filter((x) => x.kind === "impacto" && x.v === "empujar" && x.tipo === "criatura").length;
      return {
        golpesRecibidos, peligroTrasAbuso, peligroAlLlegar, peligroTrasRehab, miedoRasgoAbuso, miedoRehab, juegoFinal, primerJuego,
        tAcerca: primero("acercarse"), acercamientos: cuenta("acercarse"), evitaciones: cuenta("evitar"), cerca, miedoPico, golpesAlDoble,
        baja: peligroAlLlegar > 0.01 ? 1 - peligroTrasRehab / peligroAlLlegar : 0,
      };
    };
    const brazos: Brazo[] = ["con la agresora ya inofensiva", "con una amistosa de su raza, otra huella", "con una amistosa distinta", "sola", "sin maltrato, con la inofensiva", "como la primera, sin extincion"];
    const r = Object.fromEntries(brazos.map((b) => [b, Array.from({ length: REP }, (_, k) => probar(b, k))])) as Record<Brazo, ReturnType<typeof probar>[]>;
    const med = (b: Brazo, f: (x: ReturnType<typeof probar>) => number): number => mediana(r[b].map(f));
    const [AP, AR, AD, SO, SM, SE] = brazos;
    return resultado(semilla, {
      "el maltrato deja huella: tras 300 s con la agresora espera peligro de ella (0,2 o más), y con el control sin maltrato no (menos de 0,1)": [AP, AR, AD, SO, SE].every((b) => med(b, (x) => x.peligroTrasAbuso) >= 0.2) && med(SM, (x) => x.peligroTrasAbuso) < 0.1,
      "la agresora pega de verdad: 8 golpes o más en los 300 s": med(AP, (x) => x.golpesRecibidos) >= 8,
      "el traspaso conserva lo aprendido: al llegar a la sala nueva el peligro esperado es el mismo que al salir de la anterior": [AP, AR, AD, SO, SE].every((b) => r[b].every((x) => Math.abs(x.peligroAlLlegar - x.peligroTrasAbuso) < 0.01)),
      "sola no se recupera en 15 minutos: el peligro esperado baja menos del 30 %": med(SO, (x) => x.baja) < 0.3,
      "con la propia agresora ya inofensiva y la extinción encendida baja mucho: al menos un 50 %, y más que sola, que con una amistosa de su raza con otra huella y que con una distinta": med(AP, (x) => x.baja) >= 0.5 && med(AP, (x) => x.baja) > Math.max(med(SO, (x) => x.baja), med(AR, (x) => x.baja), med(AD, (x) => x.baja)),
      "el recuerdo es de un individuo: con una amistosa de su raza pero con otra huella, o distinta, el peligro esperado baja menos del 30 %": med(AR, (x) => x.baja) < 0.3 && med(AD, (x) => x.baja) < 0.3,
      "sin la extinción no baja: con las mismas condiciones y el interruptor apagado el peligro esperado baja menos del 30 %": med(SE, (x) => x.baja) < 0.3,
      "tras la rehabilitación ante el doble de la agresora evita menos que sola y pasa más tiempo cerca, y al menos la mitad del tiempo que la que nunca fue maltratada (acercarse no sirve de medida: ni el control se acerca a una criatura quieta y de espaldas)": med(AP, (x) => x.evitaciones) < med(SO, (x) => x.evitaciones) && med(AP, (x) => x.cerca) > med(SO, (x) => x.cerca) && med(AP, (x) => x.cerca) >= 0.5 * med(SM, (x) => x.cerca),
      "vuelve a jugar con la pelota en la sala nueva (al menos un juego en los últimos 5 minutos, con la agresora ya inofensiva)": med(AP, (x) => x.juegoFinal) >= 1,
      "sin agresión: no golpea al doble (0 golpes de mediana en ninguna condición)": brazos.every((b) => med(b, (x) => x.golpesAlDoble) === 0),
    }, {
      golpesRecibidos: med(AP, (x) => x.golpesRecibidos), miedoDelRasgoTrasAbuso: med(AP, (x) => x.miedoRasgoAbuso),
      peligroTrasAbuso: med(AP, (x) => x.peligroTrasAbuso), peligroTrasAbusoControl: med(SM, (x) => x.peligroTrasAbuso),
      peligroTrasRehabilitarInofensiva: med(AP, (x) => x.peligroTrasRehab), peligroTrasRehabilitarSuRaza: med(AR, (x) => x.peligroTrasRehab), peligroTrasRehabilitarDistinta: med(AD, (x) => x.peligroTrasRehab), peligroTrasRehabilitarSola: med(SO, (x) => x.peligroTrasRehab), peligroTrasRehabilitarSinExtincion: med(SE, (x) => x.peligroTrasRehab),
      bajaInofensiva: med(AP, (x) => x.baja), bajaSuRaza: med(AR, (x) => x.baja), bajaDistinta: med(AD, (x) => x.baja), bajaSola: med(SO, (x) => x.baja), bajaSinExtincion: med(SE, (x) => x.baja),
      miedoMedioRehabInofensiva: med(AP, (x) => x.miedoRehab), miedoMedioRehabDistinta: med(AD, (x) => x.miedoRehab), miedoMedioRehabSola: med(SO, (x) => x.miedoRehab),
      segundosHastaJugarInofensiva: med(AP, (x) => x.primerJuego), segundosHastaJugarDistinta: med(AD, (x) => x.primerJuego), segundosHastaJugarSola: med(SO, (x) => x.primerJuego), segundosHastaJugarControl: med(SM, (x) => x.primerJuego),
      juegosFinalInofensiva: med(AP, (x) => x.juegoFinal), juegosFinalDistinta: med(AD, (x) => x.juegoFinal), juegosFinalSola: med(SO, (x) => x.juegoFinal), juegosFinalControl: med(SM, (x) => x.juegoFinal),
      segundosHastaAcercarseInofensiva: med(AP, (x) => x.tAcerca), segundosHastaAcercarseDistinta: med(AD, (x) => x.tAcerca), segundosHastaAcercarseSola: med(SO, (x) => x.tAcerca), segundosHastaAcercarseControl: med(SM, (x) => x.tAcerca), segundosHastaAcercarseSinExtincion: med(SE, (x) => x.tAcerca),
      acercamientosInofensiva: med(AP, (x) => x.acercamientos), acercamientosDistinta: med(AD, (x) => x.acercamientos), acercamientosSola: med(SO, (x) => x.acercamientos), acercamientosControl: med(SM, (x) => x.acercamientos),
      evitacionesInofensiva: med(AP, (x) => x.evitaciones), evitacionesDistinta: med(AD, (x) => x.evitaciones), evitacionesSola: med(SO, (x) => x.evitaciones), evitacionesControl: med(SM, (x) => x.evitaciones),
      segundosCercaDelDobleInofensiva: med(AP, (x) => x.cerca), segundosCercaDelDobleSola: med(SO, (x) => x.cerca), segundosCercaDelDobleControl: med(SM, (x) => x.cerca),
      miedoPicoInofensiva: med(AP, (x) => x.miedoPico), miedoPicoSola: med(SO, (x) => x.miedoPico), miedoPicoControl: med(SM, (x) => x.miedoPico),
    }, null, ABUSO + REHABILITACION + PRUEBA);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso34: Caso = {
  id: "34",
  titulo: "El extraño",
  hipotesis: "Tres criaturas que llevan un rato conviviendo reciben a una desconocida. No tienen una regla para esto: cada una decide con lo que es y lo que ha vivido. Se espera que reaccionen distinto a una desconocida que a una conocida que vuelve, y que no reaccionen todas igual entre sí. La hostilidad no es automática: las agresivas atacan más que las demás, pero no hay un umbral limpio (también empuja a la desconocida la curiosidad por lo nuevo). Es una prueba abierta: no se fija qué hace cada una, solo se mide.",
  minimo: 0.8,
  ejecutar(semilla) {
    const REP = 5;
    const CONVIVENCIA = 900;
    const VISITA = 200;
    type Brazo = "desconocida" | "conocida que vuelve";
    const genomas = [genomaDe(semilla, 341), genomaDe(semilla, 342), genomaDe(semilla, 343)];
    const gVisita = genomaDe(semilla, 344);
    const probar = (brazo: Brazo, k: number) => {
      const conocida = brazo === "conocida que vuelve";
      const s = nuevaSim({ semilla: mezclar(semilla, 345, k), objetos: [{ tipo: "pelota", x: 600 }], criaturas: genomas.map((g, i) => ({ genoma: clonarGenoma(g), x: 400 + i * 150 })), comedero: { cada: 100, max: 3, tipo: "fruta" } });
      for (const c of s.criaturas) { c.reconocePorRasgos = true; c.agresion = true; c.capRegistro = 50000; }
      s.avanzar(CONVIVENCIA);
      // Quien llega: una desconocida con su propio genoma, o una de las tres que se fue 200 s y vuelve (entonces las que quedan son dos)
      let visita: Criatura;
      let residentes: Criatura[];
      if (conocida) {
        visita = s.criaturas[2];
        residentes = s.criaturas.slice(0, 2);
        s.criaturas = residentes.slice();
        s.avanzar(200);
        visita.accion = null; visita.x = 1100;
        s.criaturas.push(visita);
      } else {
        residentes = s.criaturas.slice();
        visita = new Criatura(4, "Visita", clonarGenoma(gVisita), 1000, mezclar(semilla, 346, k));
        visita.reconocePorRasgos = true; visita.agresion = true; visita.capRegistro = 5000;
        visita.x = 1100;
        s.criaturas.push(visita);
      }
      const t0 = s.t;
      const regs0 = residentes.map((c) => c.registro.length);
      s.avanzar(VISITA);
      const filas = residentes.map((c, i) => {
        const reg = c.registro.slice(regs0[i]);
        const sobreVisita = (v: string): { t: number }[] => reg.filter((r) => r.kind === "inicio" && r.v === v && r.obj === 1000 + visita.id);
        const acerca = sobreVisita("acercarse"), evita = sobreVisita("evitar"), ataca = sobreVisita("empujar");
        const clase = ataca.length ? "ataca" : evita.length >= 2 && !acerca.length ? "evita" : acerca.length && acerca[0].t - t0 < 60 ? "se acerca" : "indiferente";
        return { acercamientos: acerca.length, evitaciones: evita.length, ataques: ataca.length, tAcerca: acerca.length ? acerca[0].t - t0 : VISITA, clase, agres: c.rasgos[R.agresividad], curioso: c.rasgos[R.curiosidad] - c.rasgos[R.miedo] };
      });
      return {
        acerca: media(filas.map((f) => f.acercamientos)), evita: media(filas.map((f) => f.evitaciones)), ataques: filas.reduce((n, f) => n + f.ataques, 0),
        clases: new Set(filas.map((f) => f.clase)).size, ataquesDePacificas: filas.filter((f) => f.agres < 0.5).reduce((n, f) => n + f.ataques, 0),
        tAcerca: media(filas.map((f) => f.tAcerca)), filas,
      };
    };
    const brazos: Brazo[] = ["desconocida", "conocida que vuelve"];
    const r = Object.fromEntries(brazos.map((b) => [b, Array.from({ length: REP }, (_, k) => probar(b, k))])) as Record<Brazo, ReturnType<typeof probar>[]>;
    const med = (b: Brazo, f: (x: ReturnType<typeof probar>) => number): number => mediana(r[b].map(f));
    const [DE, CO] = brazos;
    const todas = r[DE].flatMap((x) => x.filas);
    const agr = todas.filter((f) => f.agres >= 0.5), otr = todas.filter((f) => f.agres < 0.5);
    const tasa = (g: typeof todas): number => (g.length ? g.filter((f) => f.ataques > 0).length / g.length : 0);
    // Correlacion entre lo curiosa (curiosidad menos miedo) y lo que se acerca menos lo que evita, con las tres residentes de esta semilla y sus replicas
    const xs = todas.map((f) => f.curioso), ys = todas.map((f) => f.acercamientos - f.evitaciones);
    const mx = media(xs), my = media(ys);
    const cov = media(xs.map((x, i) => (x - mx) * (ys[i] - my)));
    const sx = Math.sqrt(media(xs.map((x) => (x - mx) ** 2))), sy = Math.sqrt(media(ys.map((y) => (y - my) ** 2)));
    const correlacion = sx > 0 && sy > 0 ? cov / (sx * sy) : 0;
    return resultado(semilla, {
      "reconoce la novedad: reacciona distinto a una desconocida que a una conocida que vuelve (se acerca o evita al menos 1 vez más de mediana en alguno de los dos sentidos)": Math.abs(med(DE, (x) => x.acerca) - med(CO, (x) => x.acerca)) >= 1 || Math.abs(med(DE, (x) => x.evita) - med(CO, (x) => x.evita)) >= 1,
      "no reaccionan todas igual: ante la desconocida hay al menos dos tipos de reacción distintos entre las tres, en la mitad de las réplicas o más": r[DE].filter((x) => x.clases >= 2).length >= REP / 2,
      "la hostilidad depende del carácter: las criaturas con agresividad de 0,5 o más atacan a la desconocida en una proporción mayor que las demás (si hay de las dos clases)": !(agr.length && otr.length) || tasa(agr) > tasa(otr),
    }, {
      acercamientosDesconocida: med(DE, (x) => x.acerca), acercamientosConocida: med(CO, (x) => x.acerca),
      evitacionesDesconocida: med(DE, (x) => x.evita), evitacionesConocida: med(CO, (x) => x.evita),
      ataquesDesconocida: med(DE, (x) => x.ataques), ataquesConocida: med(CO, (x) => x.ataques),
      segundosHastaAcercarseDesconocida: med(DE, (x) => x.tAcerca), segundosHastaAcercarseConocida: med(CO, (x) => x.tAcerca),
      tiposDeReaccionDesconocida: med(DE, (x) => x.clases), tiposDeReaccionConocida: med(CO, (x) => x.clases),
      correlacionCaracterYAcercarse: correlacion,
      agresividadMinimaDeQuienAtaca: Math.min(9, ...todas.filter((f) => f.clase === "ataca").map((f) => f.agres)), agresividadMaximaDeQuienNoAtaca: Math.max(0, ...todas.filter((f) => f.clase !== "ataca").map((f) => f.agres)),
      proporcionQueAtacaConAgresividadAlta: tasa(agr), proporcionQueAtacaConAgresividadBaja: tasa(otr), residentesAgresivos: agr.length, residentesNoAgresivos: otr.length,
      agresividadMediaDeQuienAtaca: media(todas.filter((f) => f.clase === "ataca").map((f) => f.agres)),
      residentesSeAcercan: todas.filter((f) => f.clase === "se acerca").length, residentesEvitan: todas.filter((f) => f.clase === "evita").length, residentesAtacan: todas.filter((f) => f.clase === "ataca").length, residentesIndiferentes: todas.filter((f) => f.clase === "indiferente").length,
    }, null, CONVIVENCIA + 200 + VISITA);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso07d: Caso = {
  id: "07d",
  titulo: "Lo que se aprende al ver: el resultado o solo el estímulo",
  hipotesis: "Etapa 0 del modelo de las otras. El 07c no podía separar si quien mira aprende lo que consigue la otra o solo se fija más en lo que ella toca. Aquí hay dos palancas de distinto color (para poder distinguirlas), una buena y una estropeada, y la observadora solo ve a la experta con una. Si aprende el resultado, quien vio pulsar la buena va a la de ese color, y quien vio pulsar la estropeada, que no dio nada, va a la otra, que es la buena. Si solo hay realce del estímulo, cada una va a la palanca que vio pulsar, sea cual sea el resultado. Es una prueba abierta: se mide qué hace.",
  minimo: 0.8,
  ejecutar(semilla) {
    const REP = 12;
    const gE = genomaDe(semilla, 701);
    const gO = genomaDe(semilla, 702);
    const X = nuevaSim({ semilla, objetos: [{ tipo: "palanca", x: 800 }], criaturas: [{ genoma: gE, x: 300 }], comedero: null });
    X.criaturas[0].nec[0] = 0.5;
    X.avanzar(1200);
    const estadoExperta = X.criaturas[0].estado();
    type Brazo = "ve pulsar la buena" | "ve pulsar la estropeada" | "ve la palanca quieta" | "ve pulsar la buena, sin el modo" | "ve pulsar la buena, con el modelo" | "ve pulsar la estropeada, con el modelo";
    /** 400 s inmovilizada viendo a la experta (o la palanca quieta) y luego 120 s suelta, sola, con hambre 0,5, entre dos palancas de distinto color (cambian de lado en cada replica).
        Quien ve pulsar la buena o las quietas se encuentra la buena de ese color y la estropeada del otro; quien ve pulsar la estropeada se encuentra esa estropeada y la buena del otro color. */
    const prueba = (brazo: Brazo, k: number): { buena: number } => {
      const vioEstropeada = brazo === "ve pulsar la estropeada" || brazo === "ve pulsar la estropeada, con el modelo";
      const objetos = vioEstropeada ? [{ tipo: "palanca_rota", x: 800 }] : [{ tipo: "palanca", x: 800 }];
      const s = nuevaSim({ semilla: mezclar(semilla, 703, k), objetos, criaturas: [{ genoma: gO, x: 560 }], comedero: null });
      const obs = s.criaturas[0];
      obs.nec[0] = 0.5;
      obs.aprendeObservando = brazo !== "ve pulsar la buena, sin el modo";
      obs.atrapada = true;
      if (brazo.endsWith("con el modelo")) obs.modelo = new ModeloAjeno();
      const conExperta = brazo !== "ve la palanca quieta";
      if (conExperta) {
        const e = Criatura.desde({ ...estadoExperta, id: 2, x: 700, accion: null }, mezclar(semilla, 704, k));
        e.azar.s = mezclar(semilla, 705, k);
        e.reiniciarReloj();
        e.capRegistro = 100000;
        e.nec[0] = 0.55;
        s.criaturas.push(e);
      }
      s.avanzar(400);
      const pulsaciones = conExperta ? s.criaturas[1].registro.filter((r) => r.kind === "impacto" && (r.tipo === "palanca" || r.tipo === "palanca_rota") && (r.v === "empujar" || r.v === "tocar")).length : 0;
      if (conExperta) s.criaturas.splice(1, 1);
      for (const o of [...s.mundo.objetos]) s.mundo.quitar(o.id);
      const izq = k % 2 === 0;
      const [buena, mala] = vioEstropeada ? ["palanca2", "palanca_rota"] : ["palanca", "palanca2_rota"];
      s.mundo.agregar(buena, izq ? 250 : 750);
      s.mundo.agregar(mala, izq ? 750 : 250);
      obs.nec[0] = 0.5;
      obs.accion = null;
      obs.atrapada = false;
      obs.x = 500;
      const t0 = s.t;
      let primero = "";
      s.ganchos.push(() => {
        if (primero) return;
        if (manip(obs, buena, t0) > 0) primero = "buena";
        else if (manip(obs, mala, t0) > 0) primero = "mala";
      });
      s.avanzar(120);
      return { buena: primero === "buena" ? 1 : primero === "mala" ? 0 : 0.5, pulsaciones } as { buena: number };
    };
    const brazos: Brazo[] = ["ve pulsar la buena", "ve pulsar la estropeada", "ve la palanca quieta", "ve pulsar la buena, sin el modo", "ve pulsar la buena, con el modelo", "ve pulsar la estropeada, con el modelo"];
    const p: Record<string, { buena: number }> = {};
    for (const b of brazos) {
      const r = Array.from({ length: REP }, (_, k) => prueba(b, k));
      p[b] = { buena: media(r.map((x) => x.buena)) };
    }
    const [A, B, C, D, A2, B2] = brazos;
    // Con la palanca quieta se mide la preferencia de base por el color: va a la buena (del color 1) frente a la estropeada del color 2. Para quien vio la estropeada del color 1,
    // lo que hubiera hecho sin experiencia es el reves: ir a la buena del color 2 es 1 menos eso.
    const baseA = p[C].buena, baseB = 1 - p[C].buena;
    return resultado(semilla, {
      "realce actual: sin el módulo, quien vio a la experta pulsar la palanca buena va primero a la buena más que quien vio la palanca quieta (+0,2) y en 2 de cada 3 veces o más": p[A].buena >= 0.65 && p[A].buena > baseA + 0.2,
      "sin el módulo no aprende el resultado: quien vio pulsar la estropeada va a la buena del otro color como mucho lo que iría sin experiencia (no se aleja de la que vio pulsar)": p[B].buena <= baseB,
      "con el módulo sí: quien vio a la experta pulsar la estropeada (y no salir nada) va a la buena del otro color más de lo que iría sin experiencia (+0,1)": p[B2].buena > baseB + 0.1,
      "y con el módulo no pierde el realce de lo que da resultado: quien vio pulsar la buena sigue yendo primero a ella en 2 de cada 3 veces o más": p[A2].buena >= 0.65,
      "sin el modo de observación no aprende: ver pulsar la buena no la hace ir más a la buena que quien vio la palanca quieta (a lo sumo +0,1)": p[D].buena <= baseA + 0.1,
    }, {
      buenaVioPulsarLaBuena: p[A].buena, buenaVioPulsarLaEstropeada: p[B].buena, buenaVioLaPalancaQuieta: p[C].buena, buenaSinElModo: p[D].buena,
      buenaVioPulsarLaBuenaConModelo: p[A2].buena, buenaVioPulsarLaEstropeadaConModelo: p[B2].buena, lineaDeBaseParaLaEstropeada: baseB,
    }, null, 520);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso35: Caso = {
  id: "35",
  titulo: "La jerarquía alrededor de la comida (cuatro criaturas)",
  hipotesis: "Cuatro criaturas hambrientas y un solo punto de comida que se repone poco a poco. Con la agresión y el conflicto por comida encendidos, se espera que el reparto no sea parejo, que ese orden se mantenga entre la primera y la segunda mitad, que se apoye en quién empuja, y que si desaparece quien más comía, otra ocupe su sitio. Sin agresión (control) no debe haber orden por empujones. Es el caso E24 con cuatro: se mide, no se fija quién domina.",
  minimo: 0.8,
  ejecutar(semilla) {
    const REP = 5;
    const MITAD = 750;
    type Brazo = "con agresion" | "sin agresion";
    const gs = [genomaDe(semilla, 351), genomaDe(semilla, 352), genomaDe(semilla, 353), genomaDe(semilla, 354)];
    const bocados = (c: Criatura, t0: number, t1: number): number => c.registro.filter((r) => r.kind === "impacto" && r.v === "probar" && r.tipo === "fruta" && (r.res?.[0] ?? 0) > 0.05 && r.t >= t0 && r.t < t1).length;
    const empujes = (c: Criatura): number => c.registro.filter((r) => r.kind === "impacto" && r.v === "empujar" && r.tipo === "criatura").length;
    /** Correlacion de rangos de Spearman entre dos listas (con empates por rango medio). */
    const rangos = (v: number[]): number[] => v.map((x) => v.filter((y) => y < x).length + (v.filter((y) => y === x).length - 1) / 2);
    const spearman = (a: number[], b: number[]): number => {
      const ra = rangos(a), rb = rangos(b);
      const ma = media(ra), mb = media(rb);
      const cov = media(ra.map((x, i) => (x - ma) * (rb[i] - mb)));
      const sa = Math.sqrt(media(ra.map((x) => (x - ma) ** 2))), sb = Math.sqrt(media(rb.map((x) => (x - mb) ** 2)));
      return sa > 0 && sb > 0 ? cov / (sa * sb) : 0;
    };
    const probar = (brazo: Brazo, k: number) => {
      const agresion = brazo === "con agresion";
      const s = nuevaSim({ semilla: mezclar(semilla, 355, k), objetos: [], criaturas: gs.map((g, i) => ({ genoma: clonarGenoma(g), x: 300 + i * 120 })), comedero: { cada: 25, max: 1, tipo: "fruta" } });
      for (const c of s.criaturas) { c.agresion = agresion; c.conflictoComida = agresion; c.reconocePorRasgos = true; c.capRegistro = 100000; c.nec[0] = 0.8; }
      const todas = s.criaturas.slice();
      s.avanzar(MITAD);
      const comio1 = todas.map((c) => bocados(c, 0, MITAD));
      // A mitad, se retira a la que mas ha comido (si hay una clara) y se ve si otra ocupa su sitio
      const lider = comio1.indexOf(Math.max(...comio1));
      s.criaturas = todas.filter((_, i) => i !== lider);
      s.avanzar(MITAD);
      const comio2 = todas.map((c) => bocados(c, MITAD, 2 * MITAD));
      const total1 = comio1.reduce((a, b) => a + b, 0), total2 = comio2.reduce((a, b) => a + b, 0);
      // Para ver si el orden se mantiene se compara la primera mitad con la segunda de las tres que siguen, sin la lider
      const resto = todas.map((_, i) => i).filter((i) => i !== lider);
      const orden = spearman(resto.map((i) => comio1[i]), resto.map((i) => comio2[i]));
      const comeMas = Math.max(...comio1), comeMenos = Math.min(...comio1);
      const empuja = todas.map(empujes);
      const heredero = Math.max(...resto.map((i) => comio2[i])) / Math.max(1, total2);
      return { desigualdad: comeMas / Math.max(1, comeMenos), orden, relacionEmpujes: spearman(empuja, comio1), empujesTotal: empuja.reduce((a, b) => a + b, 0), total1, total2, heredero, comeLider: comeMas / Math.max(1, total1) };
    };
    const brazos: Brazo[] = ["con agresion", "sin agresion"];
    const r = Object.fromEntries(brazos.map((b) => [b, Array.from({ length: REP }, (_, k) => probar(b, k))])) as Record<Brazo, ReturnType<typeof probar>[]>;
    const med = (b: Brazo, f: (x: ReturnType<typeof probar>) => number): number => mediana(r[b].map(f));
    const [CA, SA] = brazos;
    return resultado(semilla, {
      "hay reparto desigual: con agresión la que más come se lleva al menos 1,5 veces lo de la que menos (mediana), y se come (10 bocados o más entre las cuatro)": med(CA, (x) => x.desigualdad) >= 1.5 && med(CA, (x) => x.total1) >= 10,
      "se apoya en los empujones: con agresión hay empujones entre ellas (3 o más en los 1500 s) y quien más empuja come más (correlación de rangos positiva)": med(CA, (x) => x.empujesTotal) >= 3 && med(CA, (x) => x.relacionEmpujes) > 0,
      "el control no tiene empujones: sin agresión no hay ninguno": r[SA].every((x) => x.empujesTotal === 0),
      "el orden se mantiene: entre las tres que quedan, quien más comía antes de retirar a la líder sigue comiendo más después (correlación de rangos de 0,2 o más, mediana)": med(CA, (x) => x.orden) >= 0.2,
      "otra ocupa el sitio: tras retirar a la líder, la que más come se lleva al menos un tercio de lo que se come (mediana)": med(CA, (x) => x.heredero) >= 0.34,
    }, {
      desigualdadConAgresion: med(CA, (x) => x.desigualdad), desigualdadSinAgresion: med(SA, (x) => x.desigualdad),
      bocadosPrimeraMitadConAgresion: med(CA, (x) => x.total1), bocadosPrimeraMitadSinAgresion: med(SA, (x) => x.total1), bocadosSegundaMitadConAgresion: med(CA, (x) => x.total2),
      empujesConAgresion: med(CA, (x) => x.empujesTotal), correlacionEmpujesYComida: med(CA, (x) => x.relacionEmpujes),
      correlacionDelOrdenTrasRetirarALaLider: med(CA, (x) => x.orden), correlacionDelOrdenSinAgresion: med(SA, (x) => x.orden),
      fraccionQueSeLlevaLaLider: med(CA, (x) => x.comeLider), fraccionQueSeLlevaLaHeredera: med(CA, (x) => x.heredero),
    }, null, 2 * MITAD);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso36: Caso = {
  id: "36",
  titulo: "El acechador y las presas que recuerdan",
  hipotesis: "El caso 26 usaba una presa nueva en cada ronda, y por eso no se podía ver si huir importa. Aquí la presa es siempre la misma, libre para huir y con memoria. Se espera que quien sufre rondas de caza aprenda a huir antes o a recibir menos golpes que una presa nueva cada vez, y se mide si el cazador cambia lo que hace (esperar, acercarse, empujar). No se le dice que se esconda ni que espere: se mide qué sale. Es el caso E21 con lo que hay hoy: no hay escondites ni rodeos, solo los verbos de siempre. La presa empieza a la vista del cazador (a 250 de distancia: la vista llega a 360). Una primera versión la ponía a 500, fuera de su vista, y el cazador casi no la atacaba porque ni la veía.",
  minimo: 0.8,
  ejecutar(semilla) {
    const REP = 5;
    const RONDAS = 8;
    const POR_RONDA = 90;
    type Brazo = "la misma presa" | "una presa nueva cada ronda";
    const gH = clonarGenoma(genomaDe(semilla, 361));
    gH.rasgos[R.agresividad] = 0.9;
    const gP = genomaDe(semilla, 362);
    const probar = (brazo: Brazo, k: number) => {
      const misma = brazo === "la misma presa";
      const s = nuevaSim({ semilla: mezclar(semilla, 363, k), objetos: [], criaturas: [{ genoma: clonarGenoma(gH), x: 500 }], comedero: null, mortalidad: "protegida" });
      const H = s.criaturas[0];
      H.agresion = true; H.conflictoComida = true; H.reconocePorRasgos = true; H.capRegistro = 200000; H.edad = DIA;
      // Aprendizaje previo: tres rondas a solas con un cadaver (el cazador sabe que la carne alimenta)
      for (let i = 0; i < 3; i++) {
        for (const o of [...s.mundo.objetos]) s.mundo.quitar(o.id);
        s.mundo.agregar("cadaver", 1000, { porciones: 6 });
        H.x = 500; H.accion = null; H.nec[0] = 0.7;
        s.avanzar(POR_RONDA);
      }
      for (const o of [...s.mundo.objetos]) s.mundo.quitar(o.id);
      const nuevaPresa = (n: number): Criatura => {
        const p = new Criatura(10 + n, `Presa ${n}`, clonarGenoma(gP), 1000, mezclar(semilla, 364, k, n));
        p.agresion = true; p.reconocePorRasgos = true; p.capRegistro = 50000; p.salud = 0.6; p.rasgos[R.agresividad] = 0.1; p.base[R.agresividad] = 0.1;
        return p;
      };
      let presa = nuevaPresa(0);
      const rondas: { golpes: number; huida: number; distHuida: number; espera: number; acerca: number }[] = [];
      for (let r = 0; r < RONDAS; r++) {
        if (!misma || r === 0) presa = nuevaPresa(r);
        s.criaturas = [H, presa];
        H.x = 400; H.accion = null; H.nec[0] = 0.7; H.emo.fill(0);
        presa.x = 650; presa.accion = null; presa.emo.fill(0); presa.nec[0] = 0.3; presa.salud = 0.6;
        const t0 = s.t;
        const regH = H.registro.length, regP = presa.registro.length;
        let distHuida = 0, huida = POR_RONDA, espera = 0;
        s.ganchos.push(() => {
          if (s.t < t0 || s.t >= t0 + POR_RONDA) return;
          if (huida === POR_RONDA) {
            const ev = presa.registro.slice(regP).find((x) => x.kind === "inicio" && x.v === "evitar" && x.obj === 1000 + H.id);
            if (ev) { huida = ev.t - t0; distHuida = Math.abs(H.x - presa.x); }
          }
          if (H.accion?.v === "descansar" && Math.abs(H.x - presa.x) < 500) espera += 0.25;
        });
        s.avanzar(POR_RONDA);
        s.ganchos.length = 0;
        const golpes = H.registro.slice(regH).filter((x) => x.kind === "impacto" && x.v === "empujar" && x.tipo === "criatura").length;
        const acerca = H.registro.slice(regH).filter((x) => x.kind === "inicio" && x.v === "acercarse" && x.obj === 1000 + presa.id).length;
        rondas.push({ golpes, huida, distHuida, espera, acerca });
      }
      const primeras = rondas.slice(0, 2), ultimas = rondas.slice(-2);
      const m = (a: typeof rondas, f: (x: (typeof rondas)[number]) => number): number => media(a.map(f));
      return {
        golpesPrimeras: m(primeras, (x) => x.golpes), golpesUltimas: m(ultimas, (x) => x.golpes),
        huidaPrimeras: m(primeras, (x) => x.huida), huidaUltimas: m(ultimas, (x) => x.huida),
        esperaPrimeras: m(primeras, (x) => x.espera), esperaUltimas: m(ultimas, (x) => x.espera),
        acercaPrimeras: m(primeras, (x) => x.acerca), acercaUltimas: m(ultimas, (x) => x.acerca),
        golpesTotal: rondas.reduce((n, x) => n + x.golpes, 0),
      };
    };
    const brazos: Brazo[] = ["la misma presa", "una presa nueva cada ronda"];
    const r = Object.fromEntries(brazos.map((b) => [b, Array.from({ length: REP }, (_, k) => probar(b, k))])) as Record<Brazo, ReturnType<typeof probar>[]>;
    const med = (b: Brazo, f: (x: ReturnType<typeof probar>) => number): number => mediana(r[b].map(f));
    const [M, N] = brazos;
    return resultado(semilla, {
      "hay caza: el cazador golpea a la presa (5 golpes o más en las ocho rondas, de mediana, con la misma presa)": med(M, (x) => x.golpesTotal) >= 5,
      "la presa que recuerda aprende: en las dos últimas rondas recibe menos golpes que en las dos primeras (con la misma presa)": med(M, (x) => x.golpesUltimas) < med(M, (x) => x.golpesPrimeras),
      "y huye antes: tarda menos en echar a huir en las dos últimas rondas que en las dos primeras": med(M, (x) => x.huidaUltimas) < med(M, (x) => x.huidaPrimeras),
      "la memoria importa: en las dos últimas rondas la presa que recuerda recibe menos golpes que una presa nueva": med(M, (x) => x.golpesUltimas) < med(N, (x) => x.golpesUltimas),
    }, {
      golpesPrimerasMisma: med(M, (x) => x.golpesPrimeras), golpesUltimasMisma: med(M, (x) => x.golpesUltimas), golpesPrimerasNueva: med(N, (x) => x.golpesPrimeras), golpesUltimasNueva: med(N, (x) => x.golpesUltimas),
      huidaPrimerasMisma: med(M, (x) => x.huidaPrimeras), huidaUltimasMisma: med(M, (x) => x.huidaUltimas), huidaPrimerasNueva: med(N, (x) => x.huidaPrimeras), huidaUltimasNueva: med(N, (x) => x.huidaUltimas),
      esperaDelCazadorPrimeras: med(M, (x) => x.esperaPrimeras), esperaDelCazadorUltimas: med(M, (x) => x.esperaUltimas),
      acercamientosDelCazadorPrimeras: med(M, (x) => x.acercaPrimeras), acercamientosDelCazadorUltimas: med(M, (x) => x.acercaUltimas),
    }, null, 3 * POR_RONDA + RONDAS * POR_RONDA);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso37: Caso = {
  id: "37",
  titulo: "Especialización de combate: rutas y cuerpo",
  hipotesis: "La agresión no es una sola estadística. Seis estilos (embestidor, mordedor, desgarrador, corredor, guardián de recursos, territorial) y una criatura sin especializar se enfrentan a las mismas cuatro situaciones: disputar comida con un rival, cazar a una presa, un intruso cuando no hay hambre, y estar sin comer. Se espera que cada estilo gane en lo suyo y no en lo demás, que ese cuerpo cueste (más hambre), y que solo la ruta territorial ataque a un intruso sin hambre. Es una prueba abierta: se mide, no se garantiza cada resultado.",
  minimo: 0.8,
  ejecutar(semilla) {
    const REP = 4;
    type Tipo = "sin especializar" | TipoEspecializacion;
    const TIPOS: Tipo[] = ["sin especializar", "embestidor", "mordedor", "desgarrador", "corredor", "guardian de recursos", "territorial"];
    const gBase = clonarGenoma(genomaDe(semilla, 371));
    gBase.rasgos[R.agresividad] = 0.5;
    const gRival = clonarGenoma(genomaDe(semilla, 372));
    gRival.rasgos[R.agresividad] = 0.5;
    const gPresa = genomaDe(semilla, 373);
    const gIntruso = genomaDe(semilla, 374);
    const genomaDe_ = (t: Tipo): Genoma => (t === "sin especializar" ? clonarGenoma(gBase) : especializar(gBase, t));
    const bocados = (c: Criatura, t0: number, t1: number): number => c.registro.filter((r) => r.kind === "impacto" && r.v === "probar" && r.tipo === "fruta" && (r.res?.[0] ?? 0) > 0.05 && r.t >= t0 && r.t < t1).length;
    const golpes = (c: Criatura): number => c.registro.filter((r) => r.kind === "impacto" && r.v === "empujar" && r.tipo === "criatura").length;
    const probar = (tipo: Tipo, k: number) => {
      // 1. Disputa de comida con un rival sin especializar: hambrientos los dos, una fruta cada 25 s
      const s1 = nuevaSim({ semilla: mezclar(semilla, 375, k), objetos: [], criaturas: [{ genoma: genomaDe_(tipo), x: 400 }, { genoma: clonarGenoma(gRival), x: 700 }], comedero: { cada: 25, max: 1, tipo: "fruta" }, mortalidad: "protegida" });
      const [S1, R1] = s1.criaturas;
      for (const c of s1.criaturas) { c.agresion = true; c.conflictoComida = true; c.reconocePorRasgos = true; c.capRegistro = 100000; c.nec[0] = 0.8; }
      s1.avanzar(400);
      const bS = bocados(S1, 0, 400), bR = bocados(R1, 0, 400);
      const reparto = bS + bR > 0 ? bS / (bS + bR) : 0.5;
      const empujesDisputa = golpes(S1);
      // 2. Caza: carroñeo previo (sabe que la carne alimenta) y una presa sana libre a la vista
      const s2 = nuevaSim({ semilla: mezclar(semilla, 376, k), objetos: [], criaturas: [{ genoma: genomaDe_(tipo), x: 500 }], comedero: null, mortalidad: "protegida" });
      const S2 = s2.criaturas[0];
      S2.agresion = true; S2.conflictoComida = true; S2.reconocePorRasgos = true; S2.capRegistro = 100000; S2.edad = DIA;
      for (let i = 0; i < 3; i++) { for (const o of [...s2.mundo.objetos]) s2.mundo.quitar(o.id); s2.mundo.agregar("cadaver", 1000, { porciones: 6 }); S2.x = 500; S2.accion = null; S2.nec[0] = 0.7; s2.avanzar(90); }
      for (const o of [...s2.mundo.objetos]) s2.mundo.quitar(o.id);
      const P = new Criatura(10, "Presa", clonarGenoma(gPresa), 1000, mezclar(semilla, 377, k));
      P.agresion = true; P.reconocePorRasgos = true; P.capRegistro = 50000; P.rasgos[R.agresividad] = 0.1; P.base[R.agresividad] = 0.1; P.salud = 0.6;
      s2.criaturas = [S2, P];
      S2.x = 400; S2.accion = null; S2.nec[0] = 0.7; S2.emo.fill(0);
      P.x = 650; P.accion = null;
      let saludMin = P.salud;
      const g0 = golpes(S2);
      s2.ganchos.push(() => { saludMin = Math.min(saludMin, P.salud); });
      s2.avanzar(180);
      const golpesCaza = golpes(S2) - g0;
      const dano = 0.6 - saludMin;
      // 3. Intruso con la criatura saciada, en su sitio habitual: ¿lo ahuyenta sin hambre?
      const s3 = nuevaSim({ semilla: mezclar(semilla, 378, k), objetos: [], criaturas: [{ genoma: genomaDe_(tipo), x: 600 }], comedero: null, mortalidad: "protegida" });
      const S3 = s3.criaturas[0];
      S3.agresion = true; S3.reconocePorRasgos = true; S3.capRegistro = 100000;
      s3.ganchos.push(() => { S3.nec[0] = 0.05; });
      s3.avanzar(600);
      const N = new Criatura(11, "Intruso", clonarGenoma(gIntruso), 1000, mezclar(semilla, 379, k));
      N.agresion = true; N.capRegistro = 50000; N.x = 800; N.nec[0] = 0.05;
      s3.ganchos.push(() => { N.nec[0] = 0.05; });
      s3.criaturas.push(N);
      const r0 = S3.registro.length;
      s3.avanzar(200);
      const ataquesAlIntruso = S3.registro.slice(r0).filter((r) => r.kind === "inicio" && r.v === "empujar" && r.obj === 1000 + N.id).length;
      // 4. El coste de ese cuerpo: cuanta hambre acumula en 300 s sin comer
      const s4 = nuevaSim({ semilla: mezclar(semilla, 380, k), objetos: [], criaturas: [{ genoma: genomaDe_(tipo), x: 600 }], comedero: null, mortalidad: "protegida" });
      s4.criaturas[0].nec[0] = 0.1;
      s4.avanzar(300);
      const hambre = s4.criaturas[0].nec[0];
      return { reparto, empujesDisputa, golpesCaza, dano, ataquesAlIntruso, hambre, danoPorGolpe: golpesCaza > 0 ? dano / golpesCaza : 0 };
    };
    const r = Object.fromEntries(TIPOS.map((t) => [t, Array.from({ length: REP }, (_, k) => probar(t, k))])) as Record<Tipo, ReturnType<typeof probar>[]>;
    const med = (t: Tipo, f: (x: ReturnType<typeof probar>) => number): number => mediana(r[t].map(f));
    const B: Tipo = "sin especializar";
    const especializados = TIPOS.filter((t) => t !== B);
    const metricas: Record<string, number> = {};
    for (const t of TIPOS) {
      const e = t.replace(/ /g, "_");
      metricas[`reparto_${e}`] = med(t, (x) => x.reparto); metricas[`golpesCaza_${e}`] = med(t, (x) => x.golpesCaza); metricas[`dano_${e}`] = med(t, (x) => x.dano);
      metricas[`ataquesIntruso_${e}`] = med(t, (x) => x.ataquesAlIntruso); metricas[`hambre300s_${e}`] = med(t, (x) => x.hambre); metricas[`empujesDisputa_${e}`] = med(t, (x) => x.empujesDisputa);
    }
    return resultado(semilla, {
      "el cuerpo cuesta: sin comer 300 s, todos los especializados acaban con más hambre que la que no lo está": especializados.every((t) => med(t, (x) => x.hambre) > med(B, (x) => x.hambre)),
      "defender recursos: el guardián de recursos y el embestidor se llevan una parte de la comida mayor que la que no está especializada": med("guardian de recursos", (x) => x.reparto) > med(B, (x) => x.reparto) && med("embestidor", (x) => x.reparto) > med(B, (x) => x.reparto),
      "cazar: el mordedor y el desgarrador hacen más daño a la presa que la que no está especializada": med("mordedor", (x) => x.dano) > med(B, (x) => x.dano) && med("desgarrador", (x) => x.dano) > med(B, (x) => x.dano),
      "el corredor alcanza a la presa (golpea tanto como la no especializada) pero cada golpe daña menos": med("corredor", (x) => x.golpesCaza) >= med(B, (x) => x.golpesCaza) && med("corredor", (x) => x.danoPorGolpe) < med(B, (x) => x.danoPorGolpe),
      "la ruta territorial ahuyenta más al intruso sin hambre: ataca al menos el doble de veces que la que no está especializada (que también lo empuja alguna vez por curiosidad, como se vio en el caso 34)": med("territorial", (x) => x.ataquesAlIntruso) >= 2 * Math.max(1, med(B, (x) => x.ataquesAlIntruso)),
      "las rutas no son una sola estadística: el guardián de recursos disputa más la comida que el mordedor, y el mordedor hace más daño a la presa que el guardián": med("guardian de recursos", (x) => x.empujesDisputa) > med("mordedor", (x) => x.empujesDisputa) && med("mordedor", (x) => x.dano) > med("guardian de recursos", (x) => x.dano),
    }, metricas, null, 400 + 270 + 800 + 300);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso38: Caso = {
  id: "38",
  titulo: "Defensa de la comida propia",
  hipotesis: "Quien está comiendo puede empujar a otra que se acerca a su comida. No es automático: compite con seguir comiendo, huir o esperar, y se decide con el sorteo de siempre. Se espera que pese más con hambre, con agresividad, sin miedo, con ventaja de tamaño y tras haber sido robada o golpeada por esa criatura, y menos con vínculo. Y que sea una ruta distinta de la apropiación (quitar la comida a quien come): quien defiende mucho y se apropia poco no es igual a quien se apropia mucho y defiende poco. Criterios fijados antes de ejecutar (ver el plan).",
  minimo: 0.8,
  ejecutar(semilla) {
    const REP = 12;
    const VENTANA = 120;
    const RASGO = R;
    type Cond = "base" | "saciada" | "con vinculo" | "llega una mas grande" | "llega una mas pequena" | "con agravio previo" | "agresiva" | "miedosa" | "ocupante: defensa alta, recursos baja" | "ocupante: recursos alta, defensa baja" | "llega: defensa alta, recursos baja" | "llega: recursos alta, defensa baja" | "ocupante sin ruta de defensa (diagnostico)";
    const gS = genomaDe(semilla, 381);
    const gR = genomaDe(semilla, 382);
    const esp = (recursos: number, defensa: number): Especializacion => ({ recursos, defensa, depredador: 0.5, territorial: 0, craneo: 0, mandibula: 0, garras: 0, agilidad: 0 });
    const empujesSobre = (c: Criatura, otra: Criatura, t0: number): number => c.registro.filter((r) => r.kind === "inicio" && r.v === "empujar" && r.obj === 1000 + otra.id && r.t >= t0).length;
    const ponerRasgo = (c: Criatura, i: number, v: number): void => { c.rasgos[i] = v; c.base[i] = v; };
    const probar = (cond: Cond, k: number) => {
      const gOc = especializar(gS, cond === "ocupante: defensa alta, recursos baja" ? esp(0.1, 0.9) : cond === "ocupante: recursos alta, defensa baja" ? esp(0.9, 0.1) : cond === "ocupante sin ruta de defensa (diagnostico)" ? esp(0, 0) : esp(0.3, 0.6));
      const gLl = cond === "llega: defensa alta, recursos baja" ? especializar(gR, esp(0.1, 0.9)) : cond === "llega: recursos alta, defensa baja" ? especializar(gR, esp(0.9, 0.1)) : clonarGenoma(gR);
      gOc.cuerpo.tamano = cond === "llega una mas grande" ? 0.9 : cond === "llega una mas pequena" ? 1.2 : 1;
      gLl.cuerpo.tamano = cond === "llega una mas grande" ? 1.2 : cond === "llega una mas pequena" ? 0.9 : 1;
      const s = nuevaSim({ semilla: mezclar(semilla, 383, k), objetos: [], criaturas: [{ genoma: gOc, x: 500 }, { genoma: gLl, x: 1000 }], comedero: null, mortalidad: "protegida" });
      const [S, R] = s.criaturas;
      for (const c of s.criaturas) { c.agresion = true; c.conflictoComida = true; c.reconocePorRasgos = true; c.capRegistro = 50000; }
      S.nec[0] = cond === "saciada" ? 0.3 : 0.8;
      R.nec[0] = 0.6;
      ponerRasgo(S, RASGO.agresividad, cond === "agresiva" ? 0.9 : 0.5);
      ponerRasgo(S, RASGO.miedo, cond === "miedosa" ? 0.9 : 0.3);
      ponerRasgo(R, RASGO.agresividad, 0.5);
      if (cond === "con vinculo") S.mem.vinculo(1000 + R.id, "R").afecto = 0.8;
      if (cond === "con agravio previo") S.anotarAgravio(1000 + R.id, 0.4);
      const comida = (): void => { if (!s.mundo.objetos.some((o) => o.tipo === "fruta" && Math.abs(o.x - S.x) < 60)) s.mundo.agregar("fruta", S.x); };
      comida();
      let ocupada = 0, prox = 0;
      const t0 = s.t;
      s.ganchos.push(() => {
        if (s.t - t0 >= prox) { prox = s.t - t0 + 4; comida(); }
        if (s.mundo.objetos.some((o) => o.ocupante === S.id && s.t - (o.tOcupante ?? -99) < 3) && Math.abs(R.x - S.x) < 250) ocupada += 0.25;
      });
      s.avanzar(VENTANA);
      return { defensas: empujesSobre(S, R, t0), apropiaciones: empujesSobre(R, S, t0), ocupada };
    };
    const conds: Cond[] = ["base", "saciada", "con vinculo", "llega una mas grande", "llega una mas pequena", "con agravio previo", "agresiva", "miedosa", "ocupante: defensa alta, recursos baja", "ocupante: recursos alta, defensa baja", "llega: defensa alta, recursos baja", "llega: recursos alta, defensa baja", "ocupante sin ruta de defensa (diagnostico)"];
    const r = Object.fromEntries(conds.map((c) => [c, Array.from({ length: REP }, (_, k) => probar(c, k))])) as Record<Cond, ReturnType<typeof probar>[]>;
    const med = (c: Cond, f: (x: ReturnType<typeof probar>) => number): number => mediana(r[c].map(f));
    // Probabilidad de defender (o de apropiarse): fraccion de replicas con al menos un empujon
    const pDef = (c: Cond): number => r[c].filter((x) => x.defensas > 0).length / REP;
    const pApro = (c: Cond): number => r[c].filter((x) => x.apropiaciones > 0).length / REP;
    const fraccionBase = pDef("base");
    const metricas: Record<string, number> = {};
    for (const c of conds) { const e = c.replace(/[ :,]+/g, "_"); metricas[`pDefiende_${e}`] = pDef(c); metricas[`pSeApropia_${e}`] = pApro(c); metricas[`defensas_${e}`] = med(c, (x) => x.defensas); metricas[`segundosOcupada_${e}`] = med(c, (x) => x.ocupada); }
    metricas.pesoDefensa = AJ.pesoDefensa;
    return resultado(semilla, {
      "defiende más hambrienta que saciada (al menos 0,15 más de probabilidad)": pDef("base") >= pDef("saciada") + 0.15,
      "defiende menos a una criatura a la que quiere: como mucho la mitad de probabilidad que sin vínculo": pDef("con vinculo") <= 0.5 * pDef("base"),
      "defiende menos frente a una más grande y más frente a una más pequeña, que la base": pDef("llega una mas grande") < pDef("base") && pDef("llega una mas pequena") > pDef("base"),
      "defiende más tras haber sido golpeada o robada por esa criatura (agravio previo)": pDef("con agravio previo") > pDef("base"),
      "la personalidad pesa: más con agresividad alta que con la base, y menos con miedo alto": pDef("agresiva") > pDef("base") && pDef("miedosa") < pDef("base"),
      "no es automática: en la base defiende entre el 20 % y el 90 % de las réplicas": fraccionBase >= 0.2 && fraccionBase <= 0.9,
      "las rutas se separan: defensa alta y recursos baja defiende con más probabilidad que al revés, y recursos alta y defensa baja se apropia con más probabilidad que al revés": pDef("ocupante: defensa alta, recursos baja") > pDef("ocupante: recursos alta, defensa baja") && pApro("llega: recursos alta, defensa baja") > pApro("llega: defensa alta, recursos baja"),
    }, metricas, null, VENTANA);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso39: Caso = {
  id: "39",
  titulo: "Territorialidad: medida y calibración del peso",
  hipotesis: "El peso de la ruta territorial (1,2) no tenía justificación. Se mide la respuesta de una criatura territorial saciada ante cinco situaciones con una grilla de pesos y se compara con cinco criterios de coherencia con lo descrito en el diseño («ahuyentar intrusos, también sin hambre»), fijados antes de ver ningún resultado. Regla de elección, también fijada antes: `pesoTerritorial` pasa a ser el menor peso de la grilla que cumple los cinco criterios en al menos 8 de 10 semillas; si ninguno los cumple, no se cambia. Este caso no es una prueba de aprobado: mide.",
  minimo: 0.8,
  ejecutar(semilla) {
    const REP = 4;
    const PESOS = [0.3, 0.6, 1.2, 2.0];
    const VENTANA = 100;
    const gT = especializar(genomaDe(semilla, 391), { recursos: 0.3, defensa: 0, depredador: 0.2, territorial: 0.9, craneo: 0, mandibula: 0, garras: 0, agilidad: 0 });
    gT.rasgos[R.agresividad] = 0.5;
    const gN = genomaDe(semilla, 392);
    const ataques = (c: Criatura, N: Criatura, t0: number, t1: number): number => c.registro.filter((r) => r.kind === "inicio" && r.v === "empujar" && r.obj === 1000 + N.id && r.t >= t0 && r.t < t1).length;
    /** La criatura territorial vive sola 600 s, saciada (o con una conocida), para tener su sitio habitual; se copia y a cada situacion se le añade la intrusa. */
    const calentar = (conocida: boolean, k: number): Simulacion => {
      const s = nuevaSim({ semilla: mezclar(semilla, 393, k), objetos: [], criaturas: [{ genoma: clonarGenoma(gT), x: 600 }, ...(conocida ? [{ genoma: clonarGenoma(gN), x: 700 }] : [])], comedero: null, mortalidad: "protegida" });
      for (const c of s.criaturas) { c.agresion = true; c.reconocePorRasgos = true; c.capRegistro = 50000; }
      s.ganchos.push(() => { for (const c of s.criaturas) c.nec[0] = Math.min(c.nec[0], 0.05); });
      s.avanzar(600);
      s.ganchos.length = 0;
      return s;
    };
    const situacion = (peso: number, sit: "desconocida sin comida" | "desconocida junto a un alimento propio" | "conocida" | "fuera del territorio" | "se retira", k: number) => {
      const conocida = sit === "conocida";
      const s = calentada(`terr-${semilla}-${k}-${conocida ? 1 : 0}`, () => calentar(conocida, k), k);
      const S = s.criaturas[0];
      S.agresion = true;
      let N: Criatura;
      if (conocida) { N = s.criaturas[1]; S.mem.vinculo(1000 + N.id, "N").afecto = 0.8; }
      else { N = new Criatura(5, "Intrusa", clonarGenoma(gN), 1000, mezclar(semilla, 394, k)); N.agresion = true; N.capRegistro = 5000; s.criaturas.push(N); }
      const hogar = S.hogar ?? S.x;
      const dentro = Math.max(60, Math.min(s.mundo.ancho - 60, hogar + (hogar < s.mundo.ancho - 300 ? 150 : -150)));
      const fuera = Math.max(60, Math.min(s.mundo.ancho - 60, hogar + (hogar < s.mundo.ancho - 700 ? 500 : -500)));
      N.accion = null; N.atrapada = true; N.nec[0] = sit === "desconocida junto a un alimento propio" ? 0.7 : 0.05;
      N.x = sit === "fuera del territorio" ? fuera : dentro;
      if (sit === "desconocida junto a un alimento propio") s.mundo.agregar("fruta", Math.max(60, Math.min(s.mundo.ancho - 60, dentro + (hogar < s.mundo.ancho - 300 ? -30 : 30))));
      S.accion = null; S.nec[0] = 0.05;
      const previo = AJ.pesoTerritorial;
      AJ.pesoTerritorial = peso;
      const t0 = s.t;
      s.ganchos.push(() => { S.nec[0] = Math.min(S.nec[0], 0.05); if (sit === "se retira" && s.t - t0 >= 30) N.x = fuera; });
      s.avanzar(sit === "se retira" ? 60 : VENTANA);
      AJ.pesoTerritorial = previo;
      return sit === "se retira" ? { dentro: ataques(S, N, t0, t0 + 30), trasSalir: ataques(S, N, t0 + 30, t0 + 60) } : { dentro: ataques(S, N, t0, t0 + VENTANA), trasSalir: 0 };
    };
    const sits = ["desconocida sin comida", "desconocida junto a un alimento propio", "conocida", "fuera del territorio", "se retira"] as const;
    const datos: Record<string, Record<string, { dentro: number; trasSalir: number }[]>> = {};
    for (const w of PESOS) {
      datos[String(w)] = {};
      for (const sit of sits) datos[String(w)][sit] = Array.from({ length: REP }, (_, k) => situacion(w, sit, k));
    }
    const m = (w: number, sit: (typeof sits)[number], f: (x: { dentro: number; trasSalir: number }) => number): number => mediana(datos[String(w)][sit].map(f));
    const cumple = (w: number): { c1: boolean; c2: boolean; c3: boolean; c4: boolean; c5: boolean } => {
      const desc = m(w, "desconocida sin comida", (x) => x.dentro);
      const con = m(w, "conocida", (x) => x.dentro);
      const fue = m(w, "fuera del territorio", (x) => x.dentro);
      return { c1: desc >= 1, c2: desc <= 6, c3: con <= 0.5 * desc, c4: fue <= 1 && fue <= 0.25 * desc, c5: m(w, "se retira", (x) => x.trasSalir) <= 1 };
    };
    const metricas: Record<string, number> = {};
    const todos = (w: number): boolean => { const c = cumple(w); return c.c1 && c.c2 && c.c3 && c.c4 && c.c5; };
    for (const w of PESOS) {
      const e = String(w).replace(".", "_");
      const c = cumple(w);
      metricas[`sinComida_${e}`] = m(w, "desconocida sin comida", (x) => x.dentro);
      metricas[`juntoAlimento_${e}`] = m(w, "desconocida junto a un alimento propio", (x) => x.dentro);
      metricas[`conocida_${e}`] = m(w, "conocida", (x) => x.dentro);
      metricas[`fuera_${e}`] = m(w, "fuera del territorio", (x) => x.dentro);
      metricas[`seRetira_dentro_${e}`] = m(w, "se retira", (x) => x.dentro);
      metricas[`seRetira_trasSalir_${e}`] = m(w, "se retira", (x) => x.trasSalir);
      metricas[`C1_${e}`] = c.c1 ? 1 : 0; metricas[`C2_${e}`] = c.c2 ? 1 : 0; metricas[`C3_${e}`] = c.c3 ? 1 : 0; metricas[`C4_${e}`] = c.c4 ? 1 : 0; metricas[`C5_${e}`] = c.c5 ? 1 : 0;
      metricas[`cumpleTodos_${e}`] = todos(w) ? 1 : 0;
    }
    return resultado(semilla, {
      "algún peso de la grilla cumple los cinco criterios de coherencia (informativo; la elección del peso se hace con el conjunto de las semillas)": PESOS.some(todos),
    }, metricas, null, 700);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso40: Caso = {
  id: "40",
  titulo: "Herencia y selección de la especialización",
  hipotesis: "Una línea seleccionada por rendimiento depredador debería mostrar una subida reconocible de la mandíbula, y una seleccionada por disputas de recursos, cambios coherentes en los rasgos que la ayudan (cráneo, ruta de recursos o de defensa). Lo que se hereda son predisposiciones (genes), no lo aprendido. Criterios fijados antes de ejecutar (ver el plan). Ocho criaturas por generación, ocho generaciones, con tres mediciones por criatura, tres líneas: depredadora, de recursos y un control sin selección.",
  minimo: 0.8,
  ejecutar(semilla) {
    const N = 8;
    const GENERACIONES = 8;
    const MEDICIONES = 3;
    const ELEGIDAS = 3;
    const gPresa = genomaDe(semilla, 409);
    const gRival = clonarGenoma(genomaDe(semilla, 408));
    gRival.rasgos[R.agresividad] = 0.5;
    const bocados = (c: Criatura): number => c.registro.filter((r) => r.kind === "impacto" && r.v === "probar" && r.tipo === "fruta" && (r.res?.[0] ?? 0) > 0.05).length;
    /** Rendimiento depredador: daño a una presa sana libre en 120 s, tras dos rondas de carroñeo (para que sepa que la carne alimenta). */
    const rendimientoDepredador = (g: Genoma, k: number, robusta = false): number => {
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
      const salud0 = P.salud;
      let min = P.salud;
      s.ganchos.push(() => { min = Math.min(min, P.salud); });
      s.avanzar(120);
      return salud0 - min;
    };
    /** Rendimiento en disputas: su parte de las frutas compartidas con un rival sin especializar, hambrientos los dos, en 300 s. */
    const rendimientoRecursos = (g: Genoma, k: number): number => {
      const s = nuevaSim({ semilla: mezclar(semilla, 413, k), objetos: [], criaturas: [{ genoma: clonarGenoma(g), x: 400 }, { genoma: clonarGenoma(gRival), x: 700 }], comedero: { cada: 25, max: 1, tipo: "fruta" }, mortalidad: "protegida" });
      for (const c of s.criaturas) { c.agresion = true; c.conflictoComida = true; c.reconocePorRasgos = true; c.capRegistro = 20000; c.nec[0] = 0.8; }
      s.avanzar(300);
      const a = bocados(s.criaturas[0]), b = bocados(s.criaturas[1]);
      return a + b > 0 ? a / (a + b) : 0.5;
    };
    const inicial = (i: number): Genoma => {
      const r = new Azar(mezclar(semilla, 414, i));
      const e: Especializacion = { recursos: 0.6 * r.next(), defensa: 0.6 * r.next(), depredador: 0.6 * r.next(), territorial: 0.6 * r.next(), craneo: 0.6 * r.next(), mandibula: 0.6 * r.next(), garras: 0.6 * r.next(), agilidad: 0.6 * r.next() };
      const g = clonarGenoma(genomaDe(semilla, 415 + i));
      g.especializacion = e;
      return g;
    };
    type Linea = "depredadora" | "de recursos" | "control" | "mandibula directa" | "depredadora robusta";
    const media_ = (gs: Genoma[], f: (e: Especializacion) => number): number => media(gs.map((g) => f(g.especializacion as Especializacion)));
    const evolucionar = (linea: Linea): { primera: Genoma[]; ultima: Genoma[] } => {
      let pob = Array.from({ length: N }, (_, i) => inicial(i));
      const primera = pob.map((g) => clonarGenoma(g));
      for (let gen = 0; gen < GENERACIONES; gen++) {
        let elegidas: Genoma[];
        if (linea === "control") {
          const azar = new Azar(mezclar(semilla, 416, gen));
          const idx = [...pob.keys()].sort(() => azar.next() - 0.5).slice(0, ELEGIDAS);
          elegidas = idx.map((i) => pob[i]);
        } else if (linea === "mandibula directa") {
          const puntos = pob.map((g, i) => ({ g, f: (g.especializacion as Especializacion).mandibula, i }));
          puntos.sort((a, b) => b.f - a.f || a.i - b.i);
          elegidas = puntos.slice(0, ELEGIDAS).map((p) => p.g);
        } else {
          const puntos = pob.map((g, i) => ({ g, f: linea === "depredadora robusta" ? media(Array.from({ length: MEDICIONES }, (_, m) => rendimientoDepredador(g, gen * 100 + i * 10 + m, true))) : linea === "depredadora" ? media(Array.from({ length: MEDICIONES }, (_, m) => rendimientoDepredador(g, gen * 100 + i * 10 + m))) : media(Array.from({ length: MEDICIONES }, (_, m) => rendimientoRecursos(g, gen * 100 + i * 10 + m))), i }));
          puntos.sort((a, b) => b.f - a.f || a.i - b.i);
          elegidas = puntos.slice(0, ELEGIDAS).map((p) => p.g);
        }
        const azar = new Azar(mezclar(semilla, 417, gen));
        pob = Array.from({ length: N }, (_, i) => cruzar(elegidas[Math.floor(azar.next() * elegidas.length)], elegidas[Math.floor(azar.next() * elegidas.length)], mezclar(semilla, 418, gen, i)));
      }
      return { primera, ultima: pob };
    };
    const lineas: Record<Linea, { primera: Genoma[]; ultima: Genoma[] }> = { depredadora: evolucionar("depredadora"), "de recursos": evolucionar("de recursos"), control: evolucionar("control"), "mandibula directa": evolucionar("mandibula directa"), "depredadora robusta": evolucionar("depredadora robusta") };
    const cambio = (l: Linea, f: (e: Especializacion) => number): number => media_(lineas[l].ultima, f) - media_(lineas[l].primera, f);
    // Las crias solo traen genes: padres que han vivido y aprendido, y una cria que nace sin memoria y con los rasgos en su predisposicion
    const sp = nuevaSim({ semilla: mezclar(semilla, 419, 0), objetos: [{ tipo: "pelota", x: 600 }], criaturas: [{ genoma: inicial(0), x: 400 }, { genoma: inicial(1), x: 700 }], comedero: { cada: 100, max: 2, tipo: "fruta" } });
    for (const c of sp.criaturas) c.agresion = true;
    sp.avanzar(900);
    const hijo = sp.nacer(sp.criaturas[0], sp.criaturas[1]);
    const padresAprendieron = sp.criaturas[0].mem.protos.length > 3;
    const nacioNuevo = hijo.mem.protos.length === 0 && hijo.rasgos.every((v, i) => Math.abs(v - hijo.base[i]) < 1e-9) && !!hijo.genoma.especializacion;
    const dMand = cambio("depredadora", (e) => e.mandibula), dMandControl = cambio("control", (e) => e.mandibula), dMandRecursos = cambio("de recursos", (e) => e.mandibula);
    const dMandDirecta = cambio("mandibula directa", (e) => e.mandibula), dMandRobusta = cambio("depredadora robusta", (e) => e.mandibula);
    const dRec = Math.max(cambio("de recursos", (e) => e.craneo) - cambio("control", (e) => e.craneo), cambio("de recursos", (e) => e.recursos) - cambio("control", (e) => e.recursos), cambio("de recursos", (e) => e.defensa ?? e.recursos) - cambio("control", (e) => e.defensa ?? e.recursos));
    return resultado(semilla, {
      "depredadora: la mandíbula media sube al menos 0,15 entre la primera y la última generación, y al menos 0,10 más que en el control": dMand >= 0.15 && dMand - dMandControl >= 0.1,
      "de recursos: sube al menos 0,10 más que el control en el cráneo, la ruta de recursos o la de defensa": dRec >= 0.1,
      "no se hereda lo vivido: los padres han aprendido y la cría nace sin asociaciones, con los rasgos en su predisposición y con genes de la especialización": padresAprendieron && nacioNuevo,
      "especificidad: la mandíbula de la línea de recursos sube como mucho la mitad que la de la depredadora": dMand > 0 && dMandRecursos <= 0.5 * dMand,
      "control positivo: la línea seleccionada directamente por la mandíbula sube al menos 0,25 más que el control (si falla, la herencia o la selección no funcionan)": dMandDirecta - dMandControl >= 0.25,
      "depredadora sobre presa inmóvil y robusta: la mandíbula sube al menos 0,15 más que el control": dMandRobusta - dMandControl >= 0.15,
    }, {
      mandibulaDirecta: dMandDirecta, mandibulaRobusta: dMandRobusta,
      depredadorRobusta: cambio("depredadora robusta", (e) => e.depredador), garrasRobusta: cambio("depredadora robusta", (e) => e.garras),
      mandibulaDepredadora: dMand, mandibulaControl: dMandControl, mandibulaRecursos: dMandRecursos,
      craneoRecursos: cambio("de recursos", (e) => e.craneo), craneoControl: cambio("control", (e) => e.craneo), craneoDepredadora: cambio("depredadora", (e) => e.craneo),
      recursosRecursos: cambio("de recursos", (e) => e.recursos), recursosControl: cambio("control", (e) => e.recursos),
      defensaRecursos: cambio("de recursos", (e) => e.defensa ?? e.recursos), defensaControl: cambio("control", (e) => e.defensa ?? e.recursos),
      depredadorDepredadora: cambio("depredadora", (e) => e.depredador), garrasDepredadora: cambio("depredadora", (e) => e.garras), agilidadDepredadora: cambio("depredadora", (e) => e.agilidad),
      mejoraDelCraneoDeLaDeRecursosSobreElControl: dRec, padresConMemoria: padresAprendieron ? 1 : 0, criaNaceNueva: nacioNuevo ? 1 : 0,
    }, null, 0);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

/** Antes del experimento, la criatura vive `PREVIA` s comiendo fruta en suelo seguro (x = 300), para que sepa que la fruta alimenta. Sin ella (los casos 41 y 41b), solo la conoce por el olor. */
const PREVIA = 150;
function previaDeFruta(s: Simulacion): void {
  let sin = -1;
  s.mundo.agregar("fruta", 300);
  const g = (q: Simulacion) => {
    const hay = q.mundo.objetos.some((o) => o.tipo === "fruta");
    if (hay) sin = -1; else if (sin < 0) sin = q.t; else if (q.t - sin >= 10) { q.mundo.agregar("fruta", 300); sin = -1; }
  };
  s.ganchos.push(g);
  s.avanzar(PREVIA);
  s.ganchos.splice(s.ganchos.indexOf(g), 1);
  for (const o of [...s.mundo.objetos]) s.mundo.quitar(o.id);
  s.criaturas[0].x = 400; s.criaturas[0].accion = null; s.criaturas[0].nec[0] = 0.75;
}

function ejecutar41(semilla: number, arriesga: boolean, previa = false): ResSemilla {
    const DUR = 900;
    const MITAD = DUR / 2;
    const PLACA = 900;
    const previo = AJ.entradasExtra;
    AJ.entradasExtra = Math.max(previo, 4);
    try {
      type Cond = "A" | "B" | "C" | "D";
      const correr = (cond: Cond) => {
        const s = nuevaSim({ semilla: mezclar(semilla, 411), objetos: [], criaturas: [{ genoma: genomaDe(semilla, 411), x: 400 }], comedero: null, mortalidad: "protegida" });
        const c = s.criaturas[0];
        c.puedeCargar = cond !== "B";
        c.hambreArriesga = arriesga;
        c.nec[0] = 0.75;
        c.capRegistro = 50000;
        if (previa) previaDeFruta(s);
        const T0 = s.t;
        if (cond !== "D") s.mundo.agregar(cond === "C" ? "placa_inocua" : "placa", PLACA);
        s.mundo.agregar("fruta", PLACA);
        let frutas = 1, sinFruta = -1, cargas = 0, cargas1 = 0, previa: number | null = null;
        const seg = [0, 0];
        const xs: number[] = [];
        s.ganchos.push(() => {
          xs.push(c.x);
          const mitad = s.t - T0 < MITAD ? 0 : 1;
          if (cond !== "D" && Math.abs(c.x - PLACA) <= 75) seg[mitad] += AJ.dt;
          if (c.lleva !== null && previa === null) { cargas++; if (mitad === 0) cargas1++; }
          previa = c.lleva;
          const hay = s.mundo.objetos.some((o) => o.tipo === "fruta" && (Math.abs(o.x - PLACA) < 60 || o.llevadoPor !== undefined));
          if (hay) sinFruta = -1;
          else if (sinFruta < 0) sinFruta = s.t;
          else if (s.t - sinFruta >= 25) { s.mundo.agregar("fruta", PLACA); frutas++; sinFruta = -1; }
        });
        s.avanzar(DUR);
        const dentro = [0, 0], fuera = [0, 0];
        for (const r of c.registro) {
          if (r.kind !== "impacto" || r.v !== "probar" || (r.res?.[0] ?? 0) <= 0.1 || r.t < T0) continue;
          const x = xs[Math.min(xs.length - 1, Math.max(0, Math.floor((r.t - T0) / AJ.dt) - 1))];
          (Math.abs(x - PLACA) <= 75 ? dentro : fuera)[r.t - T0 < MITAD ? 0 : 1]++;
        }
        const prop2 = dentro[1] + fuera[1] > 0 ? fuera[1] / (dentro[1] + fuera[1]) : 0;
        return { cargas, cargas1, frutas, seg, dentro, fuera, prop2, comidas2: dentro[1] + fuera[1] };
      };
      const A = correr("A"), B = correr("B"), Cc = correr("C"), D = correr("D");
      return resultado(semilla, {
        "usada espontáneamente: con transporte y placa peligrosa carga la fruta al menos una vez": A.cargas >= 1,
        "aprendida por el daño: en la segunda mitad come fuera de la placa al menos la mitad de lo que come (con al menos 2 bocados) y 0,2 más que con una placa inocua": A.comidas2 >= 2 && A.prop2 >= 0.5 && A.prop2 - Cc.prop2 >= 0.2,
        "menos tiempo sobre la placa en la segunda mitad que sin transporte (como mucho el 70 %)": A.seg[1] <= 0.7 * B.seg[1],
        "no carga todas las frutas (como mucho el 95 %)": A.cargas <= 0.95 * A.frutas,
      }, {
        cargasA: A.cargas, cargasC: Cc.cargas, cargasD: D.cargas, frutasA: A.frutas,
        cargasPrimeraMitadA: A.cargas1,
        segPlacaA1: A.seg[0], segPlacaA2: A.seg[1], segPlacaB1: B.seg[0], segPlacaB2: B.seg[1], segPlacaC1: Cc.seg[0], segPlacaC2: Cc.seg[1],
        dentroA1: A.dentro[0], fueraA1: A.fuera[0], dentroA2: A.dentro[1], fueraA2: A.fuera[1],
        dentroB2: B.dentro[1], dentroC2: Cc.dentro[1], fueraC2: Cc.fuera[1], propFueraA2: A.prop2, propFueraC2: Cc.prop2,
      }, null, DUR);
    } finally {
      AJ.entradasExtra = previo;
    }
}

export const caso41: Caso = {
  id: "41",
  titulo: "Transporte: comida donde hace daño",
  hipotesis: "Con el transporte encendido, una criatura sola con hambre y una fruta sobre una placa que da descargas puede, sin que nadie se lo indique, recoger la fruta y comerla fuera de la placa, y hacerlo más con la experiencia porque la placa duele. Se separa lo disponible (comprobado aparte, bloque 1j de los tests), lo usado espontáneamente (cargar al menos una vez) y lo aprendido (comer fuera de la placa en la segunda mitad, más que con una placa inocua, y menos tiempo sobre la placa que sin transporte). Criterios fijados antes de ejecutar (ver el plan).",
  minimo: 0.8,
  ejecutar: (semilla) => ejecutar41(semilla, false),
};

export const caso41b: Caso = {
  id: "41b",
  titulo: "Transporte: comida donde hace daño, con el hambre compitiendo con el miedo",
  hipotesis: "El mismo experimento del caso 41 con el interruptor `hambreArriesga` encendido en la criatura. Se espera que la criatura con hambre acabe acercándose a la fruta de la placa, que a veces la recoja y la coma fuera, y que lo haga más si la placa duele. Los criterios son los del caso 41, fijados antes (ver la adenda del plan).",
  minimo: 0.8,
  ejecutar: (semilla) => ejecutar41(semilla, true),
};

export const caso41c: Caso = {
  id: "41c",
  titulo: "Transporte: comida donde hace daño, con la criatura ya habituada a la fruta",
  hipotesis: "El caso 41 con una corrección de protocolo hecha después de ver datos (ver el plan): antes de empezar, la criatura vive 150 s comiendo fruta en suelo seguro, porque el diagnóstico del caso 43 mostró que en el caso 41 nunca había comido fruta y solo la conocía por el olor (esperaba 0,10 de saciedad). Mismos criterios, interruptor `hambreArriesga` apagado.",
  minimo: 0.8,
  ejecutar: (semilla) => ejecutar41(semilla, false, true),
};

export const caso41d: Caso = {
  id: "41d",
  titulo: "Transporte: comida donde hace daño, habituada a la fruta y con el hambre compitiendo con el miedo",
  hipotesis: "El caso 41c con el interruptor `hambreArriesga` encendido. Mismos criterios.",
  minimo: 0.8,
  ejecutar: (semilla) => ejecutar41(semilla, true, true),
};

export const caso43: Caso = {
  id: "43",
  titulo: "Hambre contra peligro conocido",
  hipotesis: "Con el interruptor `hambreArriesga`, el hambre compite con el miedo a un peligro ya conocido, sin apagarlo: una criatura valiente y hambrienta vuelve a por la fruta que está sobre una placa que duele, una miedosa casi no, con una placa leve va más que con la de siempre y con una fuerte mucho menos. Criterios fijados antes de ejecutar (ver la adenda del plan).",
  minimo: 0.8,
  ejecutar: (semilla) => ejecutar43(semilla, false),
};

function ejecutar43(semilla: number, previa: boolean): ResSemilla {
    const DUR = 900;
    const PLACA = 900;
    type Brazo = "K" | "V" | "M" | "L" | "F";
    const correr = (brazo: Brazo) => {
      const s = nuevaSim({ semilla: mezclar(semilla, 431), objetos: [], criaturas: [{ genoma: genomaDe(semilla, 431), x: 400 }], comedero: null, mortalidad: "protegida" });
      const c = s.criaturas[0];
      c.hambreArriesga = brazo !== "K";
      const miedo = brazo === "M" ? 0.85 : 0.15;
      c.rasgos[R.miedo] = miedo; c.base[R.miedo] = miedo;
      c.nec[0] = 0.75;
      c.capRegistro = 50000;
      if (previa) previaDeFruta(s);
      const T0 = s.t;
      s.mundo.agregar(brazo === "L" ? "placa_leve" : brazo === "F" ? "placa_fuerte" : "placa", PLACA);
      s.mundo.agregar("fruta", PLACA);
      let sinFruta = -1, seg = 0;
      s.ganchos.push(() => {
        if (Math.abs(c.x - PLACA) <= 75) seg += AJ.dt;
        const hay = s.mundo.objetos.some((o) => o.tipo === "fruta" && Math.abs(o.x - PLACA) < 60);
        if (hay) sinFruta = -1;
        else if (sinFruta < 0) sinFruta = s.t;
        else if (s.t - sinFruta >= 25) { s.mundo.agregar("fruta", PLACA); sinFruta = -1; }
      });
      s.avanzar(DUR);
      const bocados = c.registro.filter((r) => r.kind === "impacto" && r.v === "probar" && r.tipo === "fruta" && (r.res?.[0] ?? 0) > 0.1 && r.t >= T0).length;
      return { bocados, seg };
    };
    const K = correr("K"), V = correr("V"), M = correr("M"), L = correr("L"), F = correr("F");
    return resultado(semilla, {
      "sin el interruptor no vuelve a la placa (como mucho 1 bocado)": K.bocados <= 1,
      "con el interruptor, la valiente vuelve a por la fruta (al menos 3 bocados y 2 más que sin él)": V.bocados >= 3 && V.bocados >= K.bocados + 2,
      "el carácter importa: la miedosa come como mucho la mitad que la valiente": M.bocados <= 0.5 * V.bocados,
      "la gravedad importa: con la placa leve come al menos lo que con la de siempre y con la fuerte como mucho la mitad": V.bocados >= 3 && L.bocados >= V.bocados && F.bocados <= 0.5 * V.bocados,
    }, {
      bocadosK: K.bocados, bocadosV: V.bocados, bocadosM: M.bocados, bocadosL: L.bocados, bocadosF: F.bocados,
      segPlacaK: K.seg, segPlacaV: V.seg, segPlacaM: M.seg, segPlacaL: L.seg, segPlacaF: F.seg,
    }, null, DUR);
}

export const caso43b: Caso = {
  id: "43b",
  titulo: "Hambre contra peligro conocido, con la criatura ya habituada a la fruta",
  hipotesis: "El caso 43 con la corrección de protocolo del caso 41c (150 s previos comiendo fruta en suelo seguro). Mismos criterios.",
  minimo: 0.8,
  ejecutar: (semilla) => ejecutar43(semilla, true),
};

/* ---------------------------------------------------------------------------------------------------------------- */

function ejecutar42(semilla: number, aprende: boolean): ResSemilla {
    const DUR = 900;
    const MITAD = DUR / 2;
    const REJA = 800;
    const FRUTA = 900;
    type Cond = "A" | "B" | "C" | "D";
    const correr = (cond: Cond) => {
      const tipoReja = cond === "C" ? "reja_fija" : "reja";
      const s = nuevaSim({ semilla: mezclar(semilla, 421), objetos: [], criaturas: [{ genoma: genomaDe(semilla, 421), x: 400 }], comedero: null, mortalidad: "protegida" });
      const c = s.criaturas[0];
      c.nec[0] = 0.8;
      c.aprendeBloqueos = aprende;
      c.capRegistro = 50000;
      const hayReja = (): boolean => s.mundo.objetos.some((o) => o.tipo === tipoReja);
      const hayFrutaDetras = (): boolean => s.mundo.objetos.some((o) => o.tipo === "fruta" && o.x > REJA);
      const poner = (): void => {
        if (cond !== "D" && !hayReja()) s.mundo.agregar(tipoReja, REJA);
        if (cond !== "B" && !hayFrutaDetras()) s.mundo.agregar("fruta", FRUTA);
      };
      poner();
      if (cond === "B") s.mundo.agregar("fruta", 150);
      const xs: number[] = [];
      let maxIntacta = 0;
      let estado: "activo" | "espera" = "activo";
      let t0 = 0, tEspera = 0, sinCerca = -1;
      const episodios: { t0: number; t1: number }[] = [];
      s.ganchos.push(() => {
        xs.push(c.x);
        if (cond !== "D" && hayReja()) maxIntacta = Math.max(maxIntacta, c.x);
        if (cond === "B") {
          const cerca = s.mundo.objetos.some((o) => o.tipo === "fruta" && o.x < 700);
          if (cerca) sinCerca = -1;
          else if (sinCerca < 0) sinCerca = s.t;
          else if (s.t - sinCerca >= 25) { s.mundo.agregar("fruta", 150); sinCerca = -1; }
        }
        if (estado === "activo") {
          const resuelto = cond === "D" ? !hayFrutaDetras() : cond === "B" ? !hayReja() : cond === "A" ? !hayReja() && !hayFrutaDetras() : false;
          if (resuelto || s.t - t0 >= 150) { episodios.push({ t0, t1: s.t }); estado = "espera"; tEspera = s.t; }
        } else if (s.t - tEspera >= 20) { c.x = 400; c.vx = 0; c.accion = null; poner(); estado = "activo"; t0 = s.t; }
      });
      s.avanzar(DUR);
      const empujones = [0, 0];
      for (const r of c.registro) if (r.kind === "inicio" && r.v === "empujar" && r.tipo === tipoReja) empujones[r.t < MITAD ? 0 : 1]++;
      const xAt = (t: number): number => xs[Math.min(xs.length - 1, Math.max(0, Math.floor(t / AJ.dt) - 1))];
      // Tiempo desde el inicio de cada episodio hasta el primer bocado de la fruta que estaba detras de la reja (o, sin reja, de la que estaba a la vista)
      const tiempos: number[] = [];
      for (const e of episodios) {
        const b = c.registro.find((r) => r.kind === "impacto" && r.v === "probar" && (r.res?.[0] ?? 0) > 0.1 && r.t >= e.t0 && r.t <= e.t1 + 1 && xAt(r.t) > (cond === "D" ? 850 : REJA));
        if (b) tiempos.push(b.t - e.t0);
      }
      const bocados = c.registro.filter((r) => r.kind === "impacto" && r.v === "probar" && r.tipo === "fruta" && (r.res?.[0] ?? 0) > 0.1).length;
      return { empujones, tiempos, episodios: episodios.length, maxIntacta, bocados };
    };
    const A = correr("A"), B = correr("B"), Cc = correr("C"), D = correr("D");
    const emA = A.empujones[0] + A.empujones[1];
    return resultado(semilla, {
      "barrera real: con la reja intacta nunca pasa de x = 774 (ni con la que se rompe ni con la fija)": A.maxIntacta <= 774.01 && Cc.maxIntacta <= 774.01,
      "usada espontáneamente: empuja la reja al menos 3 veces": emA >= 3,
      "llega a la comida: rompe la reja y come detrás al menos una vez": A.tiempos.length >= 1,
      "aprendida: con al menos 3 episodios completados, el último tarda como mucho el 70 % del primero": A.tiempos.length >= 3 && A.tiempos[A.tiempos.length - 1] <= 0.7 * A.tiempos[0],
      "por la comida: en la segunda mitad empuja la reja al menos 2 veces más con comida detrás que sin ella": A.empujones[1] >= B.empujones[1] + 2,
      "aprende que no sirve: con la reja fija, los empujones de la segunda mitad son como mucho la mitad de los de la primera (con al menos 2 en la primera)": Cc.empujones[0] >= 2 && Cc.empujones[1] <= 0.5 * Cc.empujones[0],
    }, {
      empujonesA1: A.empujones[0], empujonesA2: A.empujones[1], empujonesB1: B.empujones[0], empujonesB2: B.empujones[1], empujonesC1: Cc.empujones[0], empujonesC2: Cc.empujones[1],
      episodiosA: A.episodios, episodiosCompletadosA: A.tiempos.length, primeroA: A.tiempos[0] ?? -1, ultimoA: A.tiempos.length ? A.tiempos[A.tiempos.length - 1] : -1,
      episodiosD: D.episodios, tiempoMedioD: D.tiempos.length ? media(D.tiempos) : -1, maxXIntactaA: A.maxIntacta, maxXIntactaC: Cc.maxIntacta,
      episodiosB: B.episodios, episodiosC: Cc.episodios, bocadosA: A.bocados, bocadosB: B.bocados, bocadosC: Cc.bocados, bocadosD: D.bocados,
    }, null, DUR);
}

export const caso42: Caso = {
  id: "42",
  titulo: "Barreras: comida detrás de una reja",
  hipotesis: "Una reja cierra el paso a una fruta visible. Una criatura hambrienta puede, sin que nadie se lo indique, empujar la reja (lo hace por curiosidad, no por saber que se rompe), romperla, llegar a la comida y, con los episodios, tardar menos. Controles: la misma reja sin comida detrás (empuja por la comida y no por costumbre) y una reja que no se rompe (deja de empujarla cuando no sirve). Criterios fijados antes de ejecutar (ver el plan).",
  minimo: 0.8,
  ejecutar: (semilla) => ejecutar42(semilla, false),
};

export const caso42b: Caso = {
  id: "42b",
  titulo: "Barreras: comida detrás de una reja, aprendiendo de los choques",
  hipotesis: "El mismo experimento del caso 42 con el interruptor `aprendeBloqueos` encendido en la criatura: un intento cortado por una barrera deja un recuerdo de que ahí, con eso, no se consigue nada. Se espera que la criatura hambrienta deje de insistir contra la reja, la empuje, la rompa, llegue a la comida y tarde menos con los episodios, y que no lo haga por costumbre (sin comida detrás) ni con una reja que no se rompe. Los criterios 2 a 6 son los del caso 42, fijados antes (ver la adenda del plan).",
  minimo: 0.8,
  ejecutar: (semilla) => ejecutar42(semilla, true),
};

export const CASOS: Caso[] = [caso01, caso02, caso03, caso03b, caso04, caso04b, caso13, caso05, caso05b, caso06, caso07, caso08, caso08b, caso08c, caso07b, caso07c, caso07d, caso16, caso17, caso18, caso19, caso20, caso21, caso22, caso23, caso23b, caso24, caso25, caso26, caso27, caso28, caso29, caso30, caso31, caso32, caso33, caso34, caso35, caso36, caso37, caso38, caso39, caso40, caso41, caso41b, caso41c, caso41d, caso43, caso43b, caso42, caso42b, caso14];
export const CASOS_OBLIGATORIOS = ["01", "02", "03", "03b", "04", "04b", "13", "05", "06", "07", "08", "14"];
