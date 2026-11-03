/* Percepcion y decision. La criatura no tiene una tabla de "si ves esto, haz aquello". Para cada cosa que percibe y cada cosa que
   podria hacer con ella, estima lo que suele resultar (con lo que recuerda y con lo que predice su red), lo pesa segun lo que necesita
   y lo que le importa a su caracter, y elige entre las mejores con algo de azar. */

import { AJ } from "./ajustes.ts";
import { acota } from "./azar.ts";
import { CATALOGO } from "./catalogo.ts";
import type { Criatura, Entorno } from "./criatura.ts";
import { BINES } from "./memoria.ts";
import { C, D, E, IDX, N, NC, R, resCero, VERBOS_OBJETO, type Percepto, type Res, type Verbo } from "./tipos.ts";

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

export function featuresCriatura(o: Criatura): number[] {
  const t = o.genoma.cuerpo.tono;
  return [0.6, o.genoma.cuerpo.tamano * 0.5, 0.5, acota(1 - (t - 100) / 160, 0.05, 0.95), acota((t - 100) / 160, 0.05, 0.95), 0.3, 0, acota(Math.abs(o.vx) / 140), 1, o.huella];
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
    out.push({ id: o.id, nombre: def.nombre, tipo: o.tipo, esCriatura: false, x: o.x, dist, f, m, cerca: dist < 90, recordado: false });
  }
  for (const o of env.criaturas) {
    if (o === c || !o.vivo) continue;
    const dist = Math.abs(o.x - c.x);
    if (dist > vista * 1.3) continue;
    out.push({ id: 1000 + o.id, nombre: o.nombre, tipo: "criatura", esCriatura: true, x: o.x, dist, f: featuresCriatura(o), m: M_TODO, cerca: dist < 130, recordado: false });
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
    const sin = 0.55 * red[k] * (k === C.sacia && v !== "probar" ? 0.4 : 1) + 0.45 * prior[k];
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

  for (const p of ps) {
    const verbos: readonly Verbo[] = p.esCriatura ? ["acercarse"] : (["probar", "empujar", "tocar"] as const);
    for (const v of verbos) {
      if (!VERBOS_OBJETO.includes(v)) continue;
      const A = c.mem.predecir(v, p.f, p.m, p.x / ancho);
      const res = esperar(c, p, v, env);
      res[C.dano] = Math.max(res[C.dano], peligroDelTrayecto(c, c.x, p.x, ancho) * 0.9);
      let u = utilidad(res, p.dist, A.conf, p.esCriatura);
      if (p.recordado) u -= 0.03 + 0.01 * (env.t - (c.mem.avist.find((a) => a.id === p.id)?.t ?? env.t)) / 60;
      if (act && act.v === v && act.obj === p.id) u += persistir;
      cand.push({ v, p, dest: p.x, u, cambia: true, espera: res });
    }
    // Alejarse de lo que sabe que hace dano
    const P = c.mem.predecir("presencia", p.f, p.m, p.x / ancho);
    const amenaza = Math.max(P.res[C.dano], P.res[C.susto] * 0.8) * P.conf;
    if (amenaza > 0.12 && !p.recordado) {
      const cerca = acota(1 - (p.dist - 40) / 320, 0.08, 1);
      let u = amenaza * (1.1 + miedoRaz + ras[R.miedo]) * cerca * (1 - 0.3 * hambre);
      if (act && act.v === "evitar" && act.obj === p.id) u += persistir;
      cand.push({ v: "evitar", p, dest: 0, u, cambia: true, espera: resCero() });
    }
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
    if (act && act.v === "explorar") u += persistir * 0.6;
    cand.push({ v: "explorar", p: null, dest: mejor, u, cambia: true, espera: resCero() });
  }
  // Descansar y dormir
  {
    const s = nec[N.sueno];
    let u = 0.09 + 0.3 * s;
    if (act && act.v === "descansar") u += persistir * 0.5;
    cand.push({ v: "descansar", p: null, dest: c.x, u, cambia: true, espera: resCero() });
    const durmiendo = act?.v === "dormir";
    if (s > 0.4 || (durmiendo && s > 0.12)) {
      let ud = (s - 0.4) * 2.4 - miedoRaz * 0.8 - nec[N.dolor] * 0.5;
      if (s > 0.92) ud += 3;
      if (durmiendo) ud = Math.max(ud, 1.2);
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
