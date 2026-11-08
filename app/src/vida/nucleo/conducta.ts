/* Percepcion y decision. La criatura no tiene una tabla de "si ves esto, haz aquello". Para cada cosa que percibe y cada cosa que
   podria hacer con ella, estima lo que suele resultar (con lo que recuerda y con lo que predice su red), lo pesa segun lo que necesita
   y lo que le importa a su caracter, y elige entre las mejores con algo de azar. */

import { AJ } from "./ajustes.ts";
import { acota } from "./azar.ts";
import { CATALOGO } from "./catalogo.ts";
import type { Criatura, Entorno } from "./criatura.ts";
import { BINES } from "./memoria.ts";
import { sexoDe } from "./genoma.ts";
import { ANGUSTIA_VISIBLE, C, D, E, IDX, N, NC, R, resCero, VERBOS_OBJETO, type Percepto, type Res, type Verbo } from "./tipos.ts";

export interface Cand {
  v: Verbo;
  p: Percepto | null;
  dest: number;
  u: number;
  /** Si puede interrumpir lo que hace ahora. */
  cambia: boolean;
  espera: Res;
}

const M_LEJOS = [0, 0, 0, 0, 0, 1, 1, 0.4, 0, 0];
const M_TODO = new Array<number>(D).fill(1);

/** Lo que se ve de otra criatura. El ruido y la postura de angustia (gritos, temblor, estar tendida) entran como el rasgo de "sonido":
    es lo unico que se percibe de su estado, no su miedo ni su dolor reales. */
export function featuresCriatura(o: Criatura, conAngustia = false): number[] {
  const t = o.genoma.cuerpo.tono;
  const angustia = !conAngustia ? 0 : acota(Math.max(o.emo[E.miedo], o.nec[N.dolor], o.incap >= 0 ? 1 : 0, o.t - o.ultimoDano < 3 ? 0.8 : 0));
  // Los cuernos se ven como angulosidad (menos redondez), un rasgo que en una criatura era siempre 0,6: sin cuernos no cambia nada. Se probo en el brillo y
  // se descarto, porque el brillo alto ya se asocia con peligro (los focos que dan descarga).
  return [0.6 - 0.4 * (o.genoma.cuerpo.cuernos ?? 0), o.genoma.cuerpo.tamano * 0.5, 0.5, acota(1 - (t - 100) / 160, 0.05, 0.95), acota((t - 100) / 160, 0.05, 0.95), 0.3, angustia, acota(Math.abs(o.vx) / 140), 1, o.huella];
}

/** Lo que se percibe de alguien y no cambia de un momento a otro: tamano, color y huella. */
const DIMS_FIRMA = [IDX.tamano, IDX.calidez, IDX.verdor, IDX.huella];
export const firmaDe = (f: number[]): number[] => DIMS_FIRMA.map((i) => f[i]);

/** Cuanto se aparta de lo normal cada rasgo de aspecto que se puede coger manía o gusto (de -1 a 1): tamaño, color calido, color verde y cuernos. */
export const contrasteAspecto = (f: number[]): number[] => [
  acota((f[IDX.tamano] - 0.5) / 0.1, -1, 1),
  acota((f[IDX.calidez] - 0.5) * 2, -1, 1),
  acota((f[IDX.verdor] - 0.5) * 2, -1, 1),
  acota(((0.6 - f[IDX.redondez]) / 0.2) - 1, -1, 1),
];

/** Lo que le gusta o le disgusta a `c` la criatura que percibe en `p`, de -1 a 1: lo aprendido de su aspecto (se generaliza a cualquiera con ese rasgo)
    y lo que sabe de su conducta (si la ha visto pegar a otras). */
export function gustoDe(c: Criatura, p: Percepto): number {
  if (!c.gustos) return 0;
  const k = contrasteAspecto(p.f);
  let g = 0;
  for (let i = 0; i < k.length; i++) g += c.valencias[i] * k[i];
  // Se suma, no se promedia: una manía fuerte a un solo rasgo tiene que poder pesar
  return acota(g - 0.6 * (c.reputacion[p.id]?.agresion ?? 0), -1, 1);
}

/** Cuanto afecto tiene la criatura `c` por la que percibe en `p`. Con el reconocimiento por rasgos se busca a quien mas se parece a lo recordado
    (una impostora con otra huella no cuenta como ella); si no, se usa la etiqueta de identificador. */
export function afectoDe(c: Criatura, p: Percepto): number {
  if (!c.reconocePorRasgos) return c.mem.vinculos.find((q) => q.id === p.id)?.afecto ?? 0;
  const s = firmaDe(p.f);
  let mejor = 0;
  for (const v of c.mem.vinculos) {
    if (!v.firma) continue;
    let d = 0;
    for (let i = 0; i < s.length; i++) d += (v.firma[i] - s[i]) ** 2;
    d = Math.sqrt(d / s.length);
    const parecido = Math.exp(-((d / AJ.sigmaReconocer) ** 2));
    if (parecido > 0.5) mejor = Math.max(mejor, v.afecto * parecido);
  }
  return mejor;
}

export function featuresObjeto(o: { tipo: string; vx: number; vz: number }): number[] {
  const def = CATALOGO[o.tipo];
  const mov = acota((Math.abs(o.vx) + Math.abs(o.vz) * 0.3) / 150);
  return [def.f[0], def.f[1], def.f[2], def.f[3], def.f[4], def.f[5], def.f[6], mov, 0, 0];
}

/** Lo que la criatura percibe ahora: lo que ve, lo que huele y oye desde mas lejos, y lo que recuerda de donde estaba. */
export function percibir(c: Criatura, env: Entorno): Percepto[] {
  const g = c.genoma;
  const vista = AJ.vista * g.vista;
  const olfato = AJ.olfato * g.olfato;
  const oido = AJ.oido * g.oido;
  const out: Percepto[] = [];
  for (const o of env.mundo.objetos) {
    const def = CATALOGO[o.tipo];
    const dist = Math.abs(o.x - c.x);
    const f = featuresObjeto(o);
    let m: number[] | null = null;
    if (dist <= vista) m = M_TODO;
    else if ((dist <= olfato && def.f[5] > 0.25) || (dist <= oido && def.f[6] > 0.4)) {
      m = M_LEJOS;
      for (let i = 0; i < D; i++) if (!M_LEJOS[i]) f[i] = 0.5;
    }
    if (!m) continue;
    const ocupada = c.conflictoComida && o.ocupante !== undefined && o.ocupante !== c.id && env.t - (o.tOcupante ?? -99) < 3;
    out.push({ id: o.id, nombre: def.nombre, tipo: o.tipo, esCriatura: false, x: o.x, dist, f, m, cerca: dist < 90, recordado: false, ...(ocupada ? { ocupada: true, ocupante: o.ocupante } : {}) });
  }
  for (const o of env.criaturas) {
    if (o === c || !o.vivo) continue;
    const dist = Math.abs(o.x - c.x);
    if (dist > vista * 1.3) continue;
    out.push({ id: 1000 + o.id, nombre: o.nombre, tipo: "criatura", esCriatura: true, x: o.x, dist, f: featuresCriatura(o, c.estadosAjenos), m: M_TODO, cerca: dist < 130, recordado: false });
  }
  // Lo que recuerda y ahora no ve
  for (const a of c.mem.avist) {
    if (out.some((p) => p.id === a.id)) continue;
    if (env.t - a.t < 2) continue;
    const dist = Math.abs(a.x - c.x);
    if (dist < 80) continue;
    out.push({ id: a.id, nombre: a.nombre, tipo: a.tipo, esCriatura: false, x: a.x, dist, f: a.f, m: M_TODO, cerca: false, recordado: true });
  }
  return out;
}

/** Cuanto espera la criatura que le quite el hambre probar algo con esos rasgos. */
export function valorDeProbar(c: Criatura, f: number[], env: Entorno): number {
  return esperar(c, { id: -1, nombre: "", tipo: "", esCriatura: false, x: c.x, dist: 0, f, m: M_TODO, cerca: true, recordado: false }, "probar", env)[C.sacia];
}

const lugarBin = (x: number, ancho: number) => Math.min(BINES - 1, Math.floor((x / ancho) * BINES));

/** Lo que espera la criatura que resulte de hacer `v` con lo percibido `p`. Mezcla lo recordado y lo que predice la red. */
function esperar(c: Criatura, p: Percepto, v: Verbo, env: Entorno): Res {
  const ancho = env.mundo.ancho;
  const lug = p.x / ancho;
  const A = c.mem.predecir(v, p.f, p.m, lug);
  const entrada = c.entrada(p.f, v, p.x, ancho);
  const red = c.red.predecir(entrada);
  // Lo unico que sabe de nacimiento: lo que huele bien invita a probarlo
  const prior = resCero();
  if (v === "probar") prior[C.sacia] = c.genoma.priorOlor * p.f[IDX.olor] * p.m[IDX.olor];
  if (v === "acercarse" && p.esCriatura) prior[C.compania] = 0.12 + 0.15 * c.rasgos[R.sociabilidad];
  const res = resCero();
  for (let k = 0; k < NC; k++) {
    const sin = 0.55 * (red[k] ?? 0) * (k === C.sacia && v !== "probar" ? 0.4 : 1) + 0.45 * prior[k];
    res[k] = A.conf * A.res[k] + (1 - A.conf) * sin;
  }
  // El peligro que asocia a esa cosa, haga lo que haga con ella
  const P = c.mem.predecir("presencia", p.f, p.m, lug);
  res[C.dano] = Math.max(res[C.dano], P.res[C.dano] * P.conf);
  res[C.susto] = Math.max(res[C.susto], P.res[C.susto] * P.conf);
  return res;
}

function peligroDelTrayecto(c: Criatura, desde: number, hasta: number, ancho: number): number {
  let peor = 0;
  for (let i = 1; i <= 4; i++) {
    const x = desde + ((hasta - desde) * i) / 4;
    const L = c.mem.predecir("lugar", [], [], x / ancho);
    peor = Math.max(peor, L.res[C.dano] * L.conf);
  }
  return peor;
}

export function candidatas(c: Criatura, ps: Percepto[], env: Entorno): Cand[] {
  const ancho = env.mundo.ancho;
  const nec = c.nec;
  const ras = c.rasgos;
  const emo = c.emo;
  const hambre = nec[N.hambre];
  const aburr = nec[N.aburrimiento];
  const sol = nec[N.soledad];
  const curio = 0.5 * ras[R.curiosidad] + 0.5 * emo[E.curiosidad];
  const miedoRaz = emo[E.miedo];
  const cand: Cand[] = [];
  const act = c.accion;
  const persistir = 0.05 + 0.25 * ras[R.persistencia];

  const pesoDano = AJ.pesoDano * (1 + 0.9 * ras[R.miedo]) * (1 + miedoRaz * 0.6) * (1 - 0.45 * hambre);
  const utilidad = (res: Res, dist: number, conf: number, esCriatura: boolean): number => {
    let u = 0;
    u += res[C.sacia] * AJ.pesoSacia * Math.max(0.03, hambre - 0.12);
    u += res[C.diversion] * (0.25 + 0.9 * aburr + 0.2 * curio);
    u += res[C.compania] * (0.1 + 1.0 * sol + 0.3 * ras[R.sociabilidad]);
    u -= res[C.dano] * pesoDano;
    u -= res[C.susto] * (0.5 + miedoRaz + 0.5 * ras[R.miedo]);
    u -= Math.min(0.25, AJ.costeViaje * dist);
    u += AJ.bonoCuriosidad * (0.3 + 0.7 * (0.6 * curio + 0.4 * aburr)) * (1 - conf) * (1 - miedoRaz) * (esCriatura ? 0.6 : 1);
    return u;
  };

  // Con mucha hambre y nada sano que comer, lo que sienta mal pero alimenta deja de dar tanto miedo (ultimo recurso)
  const crit = acota((hambre - 0.72) / 0.28);
  let ultimoRecurso = 0;
  if (crit > 0) {
    const sana = ps.some((p) => {
      if (p.esCriatura) return false;
      const r = esperar(c, p, "probar", env);
      return r[C.sacia] >= 0.25 && r[C.dano] < 0.2;
    });
    if (!sana) ultimoRecurso = crit * 0.9;
  }
  // Ver a alguien angustiado: lo que espera conseguir (que su angustia baje) segun lo que haya visto pasar antes al acercarse, quedarse o alejarse.
  // Vale mas cuanto mas afecto le tiene. No hay ninguna orden de ayudar: solo lo aprendido de su efecto.
  const angustiadas = c.estadosAjenos ? ps.filter((p) => p.esCriatura && !p.recordado && p.f[IDX.sonido] > ANGUSTIA_VISIBLE) : [];
  const pesoAlivio = (id: number): number => AJ.pesoAlivio * (0.15 + (c.mem.vinculos.find((q) => q.id === id)?.afecto ?? 0));
  const alivioEsperado = (verbo: string, p: Percepto): number => {
    const Q = c.mem.predecir(`ante:${verbo}`, p.f, p.m, p.x / ancho);
    return Q.res[C.alivio] * Q.conf;
  };
  const comestible = (p: Percepto): boolean => !p.esCriatura && c.mem.predecir("probar", p.f, p.m, p.x / ancho).res[C.sacia] > 0.05;
  for (const p of ps) {
    const verbos: readonly Verbo[] = p.esCriatura ? (c.agresion ? ["acercarse", "empujar"] : ["acercarse"]) : (["probar", "empujar", "tocar"] as const);
    for (const v of verbos) {
      if (!VERBOS_OBJETO.includes(v)) continue;
      const A = c.mem.predecir(v, p.f, p.m, p.x / ancho);
      const res = esperar(c, p, v, env);
      if (!p.esCriatura) res[C.diversion] *= 1 - AJ.habituacionMax * c.cansancioDe(p.id);
      if (ultimoRecurso > 0 && v === "probar" && comestible(p)) res[C.dano] *= 1 - ultimoRecurso;
      res[C.dano] = Math.max(res[C.dano], peligroDelTrayecto(c, c.x, p.x, ancho) * 0.9);
      if (p.esCriatura && v === "acercarse" && angustiadas.includes(p)) res[C.alivio] = alivioEsperado(v, p);
      // En el modo de aprendizaje por observacion, ver a otra usar algo no hace que deje de ser nuevo para quien mira
      let u = utilidad(res, p.dist, c.aprendeObservando ? A.confPropia : A.conf, p.esCriatura);
      if (res[C.alivio] > 0) u += res[C.alivio] * pesoAlivio(p.id);
      // Comida que otra esta comiendo: esperar o buscar otra, no comerla a la vez
      if (p.ocupada && v === "probar") u -= AJ.penaOcupada;
      // Disputa: la que tiene hambre y ve a otra comiendo empuja mas, segun su caracter. Y quien acaba de ser golpeada responde (o huye por el miedo).
      if (c.agresion && p.esCriatura && v === "empujar") {
        if (ps.some((q) => !q.esCriatura && q.ocupante === p.id - 1000 && q.dist < 400)) u += AJ.pesoDisputa * hambre * Math.max(0, ras[R.agresividad] - 0.3);
        if (c.represalia && p.id === 1000 + c.represalia.contra && env.t - c.represalia.t < 10) u += AJ.pesoRepresalia * ras[R.agresividad] * emo[E.frustracion];
      }
      // Cansada de pelear, empujar a otra apetece menos (la fatiga se va con el tiempo, no es olvido). Con interes depredador activo frena mucho menos:
      // quien caza persiste hasta someter a la presa; el limite es para peleas entre iguales
      let frenoFatiga = 1;
      // Empujar a otra criatura: el caracter agresivo empuja a probarlo mientras no sabe si compensa, la frustracion de quedarse sin lo esperado lo atiza
      // y el afecto lo frena. Que compense lo aprende
      // despues, si conseguir comida va detras de empujar a una rival (el credito retrasado de siempre)
      if (c.agresion && p.esCriatura && v === "empujar") u += AJ.pesoAgresion * Math.max(0, ras[R.agresividad] - 0.4) * (1 - A.confPropia) + AJ.pesoFrustracionAgresion * emo[E.frustracion] * ras[R.agresividad] - AJ.frenoAfectoAgresion * afectoDe(c, p);
      // Interes depredador: hambre, saber (por haberlo comido) que la carne alimenta, y una criatura que se ve debil (angustiada, quieta o mas pequena).
      // Pesa mas cuanto mas le ha dado de comer atacar antes. Sin haber probado nunca carne, no hay interes.
      if (c.agresion && p.esCriatura && v === "empujar") {
        const carne = c.mem.predecir("probar", featuresObjeto({ tipo: "cadaver", vx: 0, vz: 0 }), new Array(D).fill(1), 0.5);
        const sabeCarne = carne.res[C.sacia] * carne.conf;
        if (sabeCarne > 0.05) {
          const debil = acota(p.f[IDX.sonido] + (p.f[IDX.movimiento] < 0.05 ? 0.4 : 0) + (c.genoma.cuerpo.tamano * 0.5 - p.f[IDX.tamano]) / 0.2);
          const paga = A.res[C.sacia] * A.conf;
          const interes = AJ.pesoPresa * hambre * sabeCarne * debil * (0.1 + 0.9 * Math.min(1, paga * 3));
          u += interes;
          if (interes > 0.05) frenoFatiga = 0.2;
        }
      }
      // Buscar pareja: el impulso empuja a acercarse a alguien de otro sexo, mas si lo quiere y le gusta, y menos si ha aprendido aversion a ese sexo o a esa criatura
      if (c.reproduccion && p.esCriatura && v === "acercarse" && c.impulso > 0.4 && !c.gestando) {
        const otro = env.criaturas.find((o) => 1000 + o.id === p.id);
        if (otro && sexoDe(otro.genoma) !== sexoDe(c.genoma)) {
          const aversion = Math.max(c.aversionSexo[sexoDe(otro.genoma)], c.aversionInd[p.id] ?? 0);
          u += AJ.pesoCortejo * c.impulso * (0.3 + afectoDe(c, p) + 0.5 * Math.max(0, gustoDe(c, p))) * (1 - aversion);
        }
      }
      if (c.agresion && p.esCriatura && v === "empujar") u -= AJ.pesoFatiga * c.fatiga * frenoFatiga;
      // Celos: busca a su vinculo, juega (con lo que no es comida) y explora menos mientras dura, y solo si ademas es agresiva y esta enfadada puede empujar a la tercera
      if (c.celos && c.celosEstado.length) {
        // El hambre manda: cuanto mas hambre, menos pesa el deseo de estar con su vinculo (los celos no pueden dominar a una necesidad basica)
        if (p.esCriatura && v === "acercarse") u += AJ.pesoCelosAcercar * c.celoPorVinculo(p.id - 1000) * afectoDe(c, p) * (1 - nec[N.hambre]) * (1 - emo[E.miedo]);
        if (!p.esCriatura && (CATALOGO[p.tipo]?.porciones ?? 0) === 0) u -= AJ.pesoCelosInhibe * c.celoMaximo();
        if (p.esCriatura && v === "empujar" && c.agresion) u += AJ.pesoCelosAgresion * c.celoPorTercero(p.id - 1000) * Math.max(0, emo[E.frustracion] - 0.3) * Math.max(0, ras[R.agresividad] - 0.5);
      }
      // Envidia: se acerca a quien come lo que ella desea (a mirar, a esperar), busca otro alimento y no juega ni explora; solo si ademas es agresiva y esta enfadada puede empujarle
      if (c.envidia && c.envidiaEstado.length) {
        if (p.esCriatura && v === "acercarse") u += AJ.pesoEnvidiaAcercar * c.envidiaPor(p.id - 1000) * (1 - emo[E.miedo]);
        if (!p.esCriatura && v === "probar" && (CATALOGO[p.tipo]?.porciones ?? 0) > 0 && !c.esAlimentoEnvidiado(p.x)) u += AJ.pesoEnvidiaBuscar * c.envidiaMaxima();
        if (!p.esCriatura && (CATALOGO[p.tipo]?.porciones ?? 0) === 0) u -= AJ.pesoEnvidiaInhibe * c.envidiaMaxima();
        if (p.esCriatura && v === "empujar" && c.agresion) u += AJ.pesoEnvidiaAgresion * c.envidiaPor(p.id - 1000) * Math.max(0, emo[E.frustracion] - 0.3) * Math.max(0, ras[R.agresividad] - 0.5);
      }
      // Lo que le gusta o disgusta de su aspecto y de su conducta
      if (c.gustos && p.esCriatura && v === "acercarse") u += AJ.pesoGusto * gustoDe(c, p);
      // Acercarse a alguien conocido atrae mas, sobre todo estando sola
      if (c.reconocePorRasgos && p.esCriatura && v === "acercarse") u += AJ.pesoFamiliar * afectoDe(c, p) * (0.3 + sol);
      // Lo que acaba de hacer otra criatura con eso llama la atencion: ir a responderle
      const at = c.atencion;
      if (at && at.obj === p.id && at.v === v && env.t >= at.t && env.t - at.t < 8) u += (0.15 + 0.35 * ras[R.sociabilidad]) * (1 - (env.t - at.t) / 8) * (1 - miedoRaz) * (1 - AJ.habituacionMax * c.cansancioDe(p.id));
      if (p.recordado) u -= 0.03 + 0.01 * (env.t - (c.mem.avist.find((a) => a.id === p.id)?.t ?? env.t)) / 60;
      if (act && act.v === v && act.obj === p.id) u += persistir;
      // Regla escrita a mano (apagable): ver sufrir a alguien con quien hay un vinculo hace acercarse a el, mas cuanto mas afecto
      const ay = c.ayuda;
      if (c.ayudaInnata && ay && p.esCriatura && p.id === 1000 + ay.quien && env.t - ay.t < 12) {
        const af = c.mem.vinculos.find((q) => q.id === p.id)?.afecto ?? 0;
        u += (0.1 + 1.2 * af) * (1 - (env.t - ay.t) / 12) * (1 - 0.5 * miedoRaz);
      }
      cand.push({ v, p, dest: p.x, u, cambia: true, espera: res });
    }
    // Alejarse de lo que sabe que hace dano
    const P = c.mem.predecir("presencia", p.f, p.m, p.x / ancho);
    const amenaza = Math.max(P.res[C.dano], P.res[C.susto] * 0.8) * P.conf * (ultimoRecurso > 0 && comestible(p) ? 1 - ultimoRecurso : 1);
    if (amenaza > 0.12 && !p.recordado) {
      const cerca = acota(1 - (p.dist - 40) / 320, 0.08, 1);
      let u = amenaza * (1.1 + miedoRaz + ras[R.miedo]) * cerca * (1 - 0.3 * hambre);
      if (act && act.v === "evitar" && act.obj === p.id) u += persistir;
      cand.push({ v: "evitar", p, dest: 0, u, cambia: true, espera: resCero() });
    }
  }

  // Alejarse de alguien que lo pasa mal: el miedo contagiado lo empuja un poco, y lo aprendido de su efecto decide
  for (const q of angustiadas) {
    const afecto = c.mem.vinculos.find((w) => w.id === q.id)?.afecto ?? 0;
    let u = 0.04 + 0.6 * miedoRaz * (1 - 0.5 * afecto) + alivioEsperado("evitar", q) * pesoAlivio(q.id);
    if (act && act.v === "evitar" && act.obj === q.id) u += persistir;
    cand.push({ v: "evitar", p: q, dest: 0, u, cambia: true, espera: resCero() });
  }

  // Explorar: elige entre unos sitios y prefiere los poco visitados y sin peligro
  {
    let mejor = c.x;
    let mu = -9;
    for (let i = 0; i < 4; i++) {
      const x = c.azar.entre(60, ancho - 60);
      const bin = lugarBin(x, ancho);
      const nov = acota(1 - c.mem.visitas[bin] / 3);
      const L = c.mem.predecir("lugar", [], [], x / ancho);
      let amen = L.res[C.dano] * L.conf;
      for (const p of ps) if (!p.recordado && Math.abs(p.x - x) < 110) {
        const P = c.mem.predecir("presencia", p.f, p.m, 0);
        amen = Math.max(amen, P.res[C.dano] * P.conf);
      }
      const q = 0.25 * curio * nov - amen * pesoDano - Math.min(0.2, AJ.costeViaje * Math.abs(x - c.x) * 0.5) + c.azar.next() * 0.03;
      if (q > mu) { mu = q; mejor = x; }
    }
    let u = 0.05 + 0.12 * curio + 0.12 * aburr + mu * 0.7;
    if (c.celos) u -= AJ.pesoCelosInhibe * c.celoMaximo();
    if (c.envidia) u -= AJ.pesoEnvidiaInhibe * c.envidiaMaxima();
    if (act && act.v === "explorar") u += persistir * 0.6;
    cand.push({ v: "explorar", p: null, dest: mejor, u, cambia: true, espera: resCero() });
  }
  // Descansar y dormir
  {
    const s = nec[N.sueno];
    let u = 0.09 + 0.3 * s;
    if (act && act.v === "descansar") u += persistir * 0.5;
    if (c.envidia) u -= AJ.pesoEnvidiaInhibe * c.envidiaMaxima();
    // Tras una pelea, herida o cansada, descansa mas
    if (c.agresion) u += AJ.pesoDescansoFatiga * c.fatiga + 0.6 * (1 - c.salud);
    // Quedarse donde esta mientras otra lo pasa mal: tambien se aprende que efecto tiene
    for (const q of angustiadas) u += alivioEsperado("descansar", q) * pesoAlivio(q.id);
    cand.push({ v: "descansar", p: null, dest: c.x, u, cambia: true, espera: resCero() });
    const durmiendo = act?.v === "dormir";
    if (s > 0.4 || (durmiendo && s > 0.12)) {
      // Si acaba de hacerse dano, no se vuelve a dormir en el mismo sitio por mucho sueno que tenga
      const herida = env.t - c.ultimoDano < 10;
      let ud = (s - 0.4) * 2.4 - miedoRaz * 0.8 - nec[N.dolor] * 0.5 - (herida ? 2.5 : 0);
      if (s > 0.92 && !herida) ud += 3;
      if (durmiendo && !herida) ud = Math.max(ud, 1.2);
      cand.push({ v: "dormir", p: null, dest: c.x, u: ud, cambia: !durmiendo, espera: resCero() });
    }
  }
  // Lo que hace ahora solo se interrumpe si lo nuevo es claramente mejor
  if (act) {
    const actual = cand.find((k) => k.v === act.v && (k.p ? k.p.id === act.obj : act.obj === -1));
    if (actual) {
      for (const k of cand) if (k !== actual) k.cambia = k.u > actual.u + AJ.histeresis * (1 - 0.5 * ras[R.persistencia]) + (act.v === "dormir" ? 0.4 : 0);
    } else for (const k of cand) k.cambia = true;
  }
  return cand;
}

/** Elige con un poco de azar entre las mejores opciones (softmax). */
export function elegir(c: Criatura, cands: Cand[]): Cand | null {
  if (!cands.length) return null;
  const act = c.accion;
  // Si hay una accion en curso y nada puede interrumpirla, sigue
  if (act && !cands.some((k) => k.cambia && !(k.v === act.v && (k.p ? k.p.id === act.obj : act.obj === -1)))) return cands.find((k) => k.v === act.v && (k.p ? k.p.id === act.obj : act.obj === -1)) ?? null;
  const tau = AJ.temperatura * (1.3 - 0.5 * c.rasgos[R.persistencia]);
  let max = -Infinity;
  for (const k of cands) if (k.u > max) max = k.u;
  let sum = 0;
  const pesos = cands.map((k) => {
    const w = Math.exp((k.u - max) / tau);
    sum += w;
    return w;
  });
  let r = c.azar.next() * sum;
  for (let i = 0; i < cands.length; i++) {
    r -= pesos[i];
    if (r <= 0) return cands[i];
  }
  return cands[cands.length - 1];
}
