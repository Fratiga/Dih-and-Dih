/* Los casos de exito de inteligencia artificial del documento de diseno (docs/vida-artificial-diseno.md), como experimentos.
   Implementados: 01 a 04 (un individuo aprende), 04b (generalizacion), 13 (gemelos) y 05 (partido improvisado, preparado).
   Cada uno usa varias semillas y un control. Los criterios estan escritos para que no se cumplan por casualidad. */

import { C } from "../nucleo/tipos.ts";
import { clonarGenoma } from "../nucleo/genoma.ts";
import { CATALOGO } from "../nucleo/catalogo.ts";
import { Azar, mezclar } from "../nucleo/azar.ts";
import { semejanza } from "../nucleo/memoria.ts";
import { Criatura, type Registro } from "../nucleo/criatura.ts";
import type { Simulacion } from "../nucleo/simulacion.ts";
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
  hipotesis: "Una criatura que nunca vio una pelota descubre que puede empujarla, se divierte y acaba yendo a buscarla por iniciativa propia. Con una bola atornillada (igual de redonda, que no se mueve) el interes se apaga.",
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

    // Iniciativa: la pelota esta lejos y fuera de la vista. Quien la vio hace un momento sabe donde esta; quien no, tiene que encontrarla explorando.
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
      "con la bola atornillada el interes baja a la mitad o menos": fija <= sostenido * 0.5,
      "va a buscarla sin verla (<= 90 s) y antes que quien no la conoce": tL <= 90 && tL < tN,
    }, { empujones_1: primeros, empujones_2: sostenido, empujones_bola_fija: fija, esperaDiversion: aprendido, tBusca: tL, tBuscaSinExperiencia: tN }, cA, 960, { "diversion esperada de empujar": curva });
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso02: Caso = {
  id: "02",
  titulo: "La asociacion del alimento",
  hipotesis: "Una criatura hambrienta prueba un alimento nuevo, aprende que quita el hambre y despues lo busca aunque no lo vea ni lo huela. Quien nunca lo ha probado tarda mas en encontrarlo.",
  minimo: 0.8,
  ejecutar(semilla) {
    const g = genomaDe(semilla);
    const S = nuevaSim({ semilla, objetos: [{ tipo: "fruta", x: 1420 }, { tipo: "fruta", x: 1480 }], criaturas: [{ genoma: g, x: 650 }], comedero: null });
    const c = S.criaturas[0];
    c.nec[0] = 0.6;
    S.avanzar(240);
    const bocados = impactos(c, "probar", "fruta");
    const sacia = esperado(c, "probar", "fruta", C.sacia);

    // Mas tarde: vuelve a tener hambre. La fruta esta al fondo, donde la vio hace un momento, lejos y sin que la huela
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
      "lo encuentra antes que quien nunca lo probo": tL < tN,
      "si algo le sienta mal, lo aprende (o no lo prueba)": aprendeBaya,
    }, { bocados, sacia, tBusca: tL, tBuscaSinExperiencia: tN, malaBaya }, c, 240);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

export const caso03: Caso = {
  id: "03",
  titulo: "La maquina accidental",
  hipotesis: "Una palanca suelta un granulo de comida poco despues de tocarla. La criatura descubre sin instrucciones que tocarla trae comida y repite la accion cuando la necesita. Con una palanca estropeada (se mueve y suena, pero no suelta nada) eso no ocurre.",
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

const ZONA = 200;

export const caso04: Caso = {
  id: "04",
  titulo: "El recuerdo del peligro",
  hipotesis: "Una criatura que sufre descargas en una placa evita despues esa zona aunque la placa ya no este, y tambien la placa si vuelve a aparecer apagada. Quien pisa una placa que no descarga no la evita.",
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
  titulo: "Generalizacion del peligro",
  hipotesis: "Una criatura que recibio una descarga de un foco rojo evita despues otro foco rojo que nunca toco, pero no uno azul. Quien no recibio la descarga no tiene esa preferencia.",
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
      "se parece mas al rojo que al azul (comprobacion de la prueba)": sRojo > sAzul * 20,
      "pasa menos tiempo junto al foco rojo nuevo que junto al azul": T.parteRojo <= 0.45,
      "mas que quien no recibio la descarga": T.parteRojo < K.parteRojo - 0.1,
    }, { parteRojoTratada: T.parteRojo, parteRojoControl: K.parteRojo }, T.c, 860);
  },
};

/* ---------------------------------------------------------------------------------------------------------------- */

/** Pruebas de conducta iguales para todos: se coloca a la criatura (con lo que ha vivido) ante una eleccion y se ve que hace.
    Cada prueba se repite 16 veces con distinto azar, asi el resultado es una probabilidad y no un golpe de suerte.
      1. Entre una pelota y una palanca, con que juega primero.
      2. Entre un foco rojo y uno azul (ninguno descarga), junto a cual pasa mas tiempo.
      3. Con una placa apagada en el suelo, cuanto se mantiene lejos de ella. */
export function perfil(c: Criatura, semilla: number, variante: number): number[] {
  const REPS = 16;
  const preparar = (objetos: { tipo: string; x: number; activo?: boolean }[], r: number, hambre: number) => {
    const s = nuevaSim({ semilla: mezclar(semilla, 900, variante, r), objetos, criaturas: [{ genoma: clonarGenoma(c.genoma), x: 800 }], comedero: null });
    const t = Criatura.desde({ ...c.estado(), x: 800, accion: null, id: 1 }, mezclar(semilla, 901, variante, r));
    t.azar.s = mezclar(semilla, 902, variante, r);
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
  hipotesis: "Dos criaturas con el mismo genoma, criadas en habitaciones distintas, acaban comportandose distinto y esa diferencia se explica por lo que vivieron. Dos gemelos criados igual se parecen mucho mas entre si.",
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
      "mas que dos gemelos criados igual (el doble o mas)": dAB > dAA * 2,
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

/** Cuantas veces el empujon lo da una criatura distinta a la anterior, poco despues (turnos), y la racha mas larga. */
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

/** Cuanto se responden: cuantas veces un empujon de una cae poco despues de uno de la otra. */
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
  hipotesis: "Dos criaturas, una pelota y ninguna orden de jugar juntas. Se pasan la pelota con mas turnos alternados de los que daria el azar, y eso desaparece si cada una juega con su pelota, sin posibilidad de responder a la otra.",
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
      "mas turnos alternados que el azar (z > 2)": z > 2,
      "hay rachas de al menos 3 turnos seguidos": T.racha >= 3,
      "sin posibilidad de responder, no pasa (z < 2)": zC < 2,
    }, { empujones: seq.length, alternan: T.alternan, pares: T.pares, racha: T.racha, z, zControl: zC }, juntas.criaturas[0], 1500);
  },
};

export const CASOS: Caso[] = [caso01, caso02, caso03, caso04, caso04b, caso13, caso05];
export const CASOS_OBLIGATORIOS = ["01", "02", "03", "04", "04b", "13"];
