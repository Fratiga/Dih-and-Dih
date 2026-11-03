/* Ejecucion de las acciones: moverse, llegar, hacer y terminar. La decision ya esta tomada, aqui solo se lleva a cabo.
   La animacion que se ve sale de lo que esta pasando aqui (la fase, el verbo, el estado de animo), no al reves. */

import { AJ } from "./ajustes.ts";
import { acota } from "./azar.ts";
import type { Accion, Criatura, Entorno } from "./criatura.ts";
import { featuresCriatura, featuresObjeto, type Cand } from "./conducta.ts";
import type { Objeto } from "./mundo.ts";
import { C, E, N, R, resCero } from "./tipos.ts";

const DURACION = { probar: 1.4, empujar: 0.8, tocar: 0.9 } as const;
const IMPACTO = 0.4;

export function iniciar(c: Criatura, cand: Cand, env: Entorno): Accion {
  const p = cand.p;
  const a: Accion = {
    v: cand.v,
    obj: p ? p.id : -1,
    tipo: p ? p.tipo : "",
    nombre: p ? p.nombre : "",
    esCriatura: !!p?.esCriatura,
    recordado: !!p?.recordado,
    dest: cand.dest,
    fase: "ir",
    t0: env.t,
    tf: env.t,
    dur: 0,
    hecho: false,
    comp: 0,
    f: p ? p.f.slice() : [],
    espera: cand.espera,
  };
  if (cand.v === "evitar" && p) {
    const lejos = c.x >= p.x ? 1 : -1;
    a.dest = acota(c.x + lejos * 300, 50, env.mundo.ancho - 50);
  }
  if (cand.v === "descansar") a.dur = 4 + c.azar.next() * 5;
  if (cand.v === "explorar") a.dur = 1.5 + c.azar.next() * 1.8;
  if (cand.v === "dormir") a.dur = 10;
  if (cand.v === "acercarse") a.dur = 4 + c.azar.next() * 3;
  if (cand.v === "descansar" || cand.v === "dormir") { a.fase = "hacer"; if (cand.v === "dormir") c.dormido = true; }
  if (c.dormido && cand.v !== "dormir") c.dormido = false;
  c.registrar({ t: env.t, kind: "inicio", v: cand.v, tipo: a.tipo, obj: a.obj });
  return a;
}

function terminar(c: Criatura, a: Accion, env: Entorno, fallo = false): void {
  if (a.v === "acercarse" && a.hecho) {
    // La compania recibida depende de como reciba el otro que te acerques
    const otro = env.criaturas.find((o) => 1000 + o.id === a.obj);
    let calidad = 0.7;
    if (otro) calidad = acota(0.45 + 0.5 * otro.rasgos[R.sociabilidad] - 0.5 * Math.max(0, otro.rasgos[R.agresividad] - 0.55) - (otro.dormido ? 0.3 : 0));
    const afecto = c.mem.vinculos.find((q) => q.id === a.obj)?.afecto ?? 0;
    const res = resCero();
    if (!c.estadosAjenos) res[C.compania] = acota(a.comp * calidad);
    else {
      // La compania de alguien conocido pesa mas que la de un extrano. Y si al llegar la otra estaba mal y al irse esta mejor, se nota:
      // el alivio que se ve (que baje su angustia) es parte de lo que se siente al haber estado con ella. Si no baja, no hay alivio que aprender.
      calidad = acota(calidad * (0.6 + 0.8 * afecto));
      const alivio = otro && a.angustiaIni !== undefined ? Math.max(0, a.angustiaIni - featuresCriatura(otro, true)[6]) : 0;
      res[C.compania] = acota(a.comp * calidad + 1.4 * alivio * (afecto > 0.2 ? 1 : 0));
      const alterada = Math.max(0, c.emo[E.miedo] - 0.1);
      if (afecto > 0.2 && alterada > 0.05) c.emo[E.miedo] *= 0.55;
    }
    if (calidad < 0.25) { res[C.dano] = 0.1; res[C.susto] = 0.3; }
    c.experimentar(a, res, true, env);
    const v = c.mem.vinculo(a.obj, a.nombre);
    v.afecto = acota(v.afecto + 0.08 * res[C.compania]);
  }
  if (fallo && a.v !== "evitar" && a.v !== "explorar") {
    c.emo[E.frustracion] = acota(c.emo[E.frustracion] + 0.12);
    if (a.recordado) c.mem.olvidarAvistamiento(a.obj);
  }
  if (a.v === "dormir") c.dormido = false;
  c.accion = null;
  c.espera = 0.25 + 0.25 * (1 - c.rasgos[R.persistencia]);
  c.proxDecision = 0;
}

function mover(c: Criatura, destino: number, vel: number, dt: number, ancho: number): void {
  if (c.atrapada) { c.vx = 0; return; }
  const d = destino - c.x;
  const paso = Math.min(Math.abs(d), vel * dt);
  if (Math.abs(d) > 0.5) c.dir = d > 0 ? 1 : -1;
  c.x = acota(c.x + Math.sign(d) * paso, 10, ancho - 10);
  c.vx = (Math.sign(d) * paso) / dt;
}

export function ejecutar(c: Criatura, env: Entorno, dt: number): void {
  const a = c.accion;
  if (!a) return;
  const ancho = env.mundo.ancho;
  const g = c.genoma;
  const caminar = AJ.velCaminar * g.velocidad;
  const correr = AJ.velCorrer * g.velocidad;
  c.vx = 0;

  if (a.fase === "ir") {
    let pos = a.dest;
    let objetivo: Objeto | undefined;
    if (a.v === "probar" || a.v === "empujar" || a.v === "tocar") {
      objetivo = env.mundo.obj(a.obj);
      if (!objetivo && !a.recordado) { terminar(c, a, env, true); return; }
      if (objetivo) pos = objetivo.x;
    } else if (a.v === "acercarse") {
      const otro = env.criaturas.find((o) => 1000 + o.id === a.obj);
      if (!otro || !otro.vivo) { terminar(c, a, env, true); return; }
      pos = otro.x + (c.x < otro.x ? -70 : 70);
    }
    const aprox = a.v === "evitar" || a.v === "explorar" ? 6 : a.v === "acercarse" ? 12 : AJ.alcance;
    if (Math.abs(pos - c.x) <= aprox) {
      if (a.recordado && !objetivo) {
        // Llego a donde recordaba algo y ya no esta
        c.mem.olvidarAvistamiento(a.obj);
        terminar(c, a, env, true);
        return;
      }
      a.fase = "hacer";
      a.tf = env.t;
      if (a.v === "explorar") {
        const bin = Math.min(15, Math.floor((c.x / ancho) * 16));
        // Ver un sitio poco visto entretiene un poco
        c.nec[N.aburrimiento] = acota(c.nec[N.aburrimiento] - 0.08 * acota(1 - c.mem.visitas[bin] / 3));
        c.mem.visitas[bin] += 1;
      }
      if (objetivo) {
        c.dir = objetivo.x >= c.x ? 1 : -1;
        // De cerca lo ve entero: lo que aprenda queda guardado con todos sus rasgos, no con los que olia de lejos
        if (a.v !== "acercarse") a.f = featuresObjeto(objetivo);
      }
      if (a.v === "acercarse") {
        const otro = env.criaturas.find((o) => 1000 + o.id === a.obj);
        if (otro) a.f = featuresCriatura(otro, c.estadosAjenos);
      }
    } else {
      const moviendo = objetivo && Math.abs(objetivo.vx) > 30;
      const rapido = a.v === "evitar" || c.emo[E.miedo] > 0.45 || (moviendo && a.v !== "explorar");
      mover(c, pos, rapido ? correr : caminar, dt, ancho);
      if (env.t - a.t0 > (a.v === "evitar" ? 7 : 18)) terminar(c, a, env, true);
    }
    return;
  }

  // fase "hacer"
  const dur = a.v === "probar" || a.v === "empujar" || a.v === "tocar" ? DURACION[a.v] : a.dur;
  const t = env.t - a.tf;
  if (a.v === "probar" || a.v === "empujar" || a.v === "tocar") {
    const ob = env.mundo.obj(a.obj);
    if (!a.hecho) {
      if (!ob || Math.abs(ob.x - c.x) > AJ.alcance * 2) { a.fase = "ir"; if (!ob) terminar(c, a, env, true); return; }
      c.dir = ob.x >= c.x ? 1 : -1;
      if (t >= IMPACTO) {
        const r = env.mundo.interactuar(a.v, a.obj, c.x, g.fuerza);
        a.hecho = true;
        c.experimentar(a, r.res, r.efecto, env);
      }
    }
    if (t >= dur) terminar(c, a, env);
    return;
  }
  if (a.v === "acercarse") {
    const otro = env.criaturas.find((o) => 1000 + o.id === a.obj);
    if (!otro || !otro.vivo) { terminar(c, a, env, true); return; }
    c.dir = otro.x >= c.x ? 1 : -1;
    if (Math.abs(otro.x - c.x) > 150) { a.fase = "ir"; return; }
    a.hecho = true;
    a.comp += dt * 0.07;
    // Quedarse junto a alguien querido que lo pasa mal le calma poco a poco, salvo que nada pueda aliviarla (condicion de laboratorio)
    if (c.estadosAjenos) {
      if (a.angustiaIni === undefined) a.angustiaIni = featuresCriatura(otro, true)[6];
      const af = c.mem.vinculos.find((q) => q.id === a.obj)?.afecto ?? 0;
      if (af > 0.2 && !otro.inconsolable) {
        otro.emo[E.miedo] = acota(otro.emo[E.miedo] - 0.14 * af * dt);
        otro.nec[N.dolor] = acota(otro.nec[N.dolor] - 0.06 * af * dt);
      }
    }
    if (t >= dur) terminar(c, a, env);
    return;
  }
  if (a.v === "dormir") {
    c.dormido = true;
    if ((t >= a.dur && c.nec[N.sueno] < 0.12) || c.nec[N.hambre] > 0.97) terminar(c, a, env);
    return;
  }
  if (t >= dur) terminar(c, a, env);
}
