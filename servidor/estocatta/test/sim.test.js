"use strict";
const test = require("node:test");
const assert = require("node:assert");
const E = require("../estocatta-sim.js");
const { CFG, ms } = E;

/* Partida ya empezada, con los dos luchadores a la distancia dada, uno frente al otro. */
function duelo(dist, extra) {
  const e = E.crearPartida({ sinCuenta: true });
  const c = CFG.PISTA / 2;
  e.j[0].x = c - dist / 2; e.j[1].x = c + dist / 2;
  if (extra && extra.sinProteccion !== false) e.j.forEach(f => f.proteccion = 0);
  return e;
}
const N = { mov: 0 };
function ticks(e, n, a, b) { for (let i = 0; i < n; i++) E.paso(e, [typeof a === "function" ? a(i) : a, typeof b === "function" ? b(i) : b]); }
function una(e, a, b) { E.paso(e, [a, b]); }
const ev = (...x) => ({ mov: 0, ev: x });
function hasta(e, cond, max) { for (let i = 0; i < (max || 600); i++) { if (cond(e)) return true; E.paso(e, [N, N]); } return cond(e); }

test("los dos pueden moverse y atacar en el mismo tick", () => {
  const e = duelo(600);
  una(e, { mov: 1 }, { mov: -1 });
  assert.ok(e.j[0].x > CFG.PISTA / 2 - 300 && e.j[1].x < CFG.PISTA / 2 + 300);
  una(e, ev("estocada"), ev("estocada"));
  assert.equal(e.j[0].accion.tipo, "estocada");
  assert.equal(e.j[1].accion.tipo, "estocada");
});

test("una estocada no llega más lejos que su alcance", () => {
  const lejos = duelo(CFG.ESTOCADA.alcance + CFG.ANCHO_CUERPO / 2 + 60);
  una(lejos, ev("estocada"), N);
  ticks(lejos, 30, N, N);
  assert.ok(lejos.j[1].vivo, "a esta distancia no debe herir");
  const cerca = duelo(120);
  una(cerca, ev("estocada"), N);
  ticks(cerca, 30, N, N);
  assert.ok(!cerca.j[1].vivo && cerca.j[0].bajas === 1, "a corta distancia mata");
});

test("el golpe no alcanza a quien está a la espalda", () => {
  const e = duelo(100);
  e.j[0].cara = -1;                       // mira hacia el lado contrario del rival
  una(e, ev("estocada"), N);
  ticks(e, 30, N, N);
  assert.ok(e.j[1].vivo);
});

test("la preparación se ve venir: no mata en el mismo tick", () => {
  const e = duelo(100);
  una(e, ev("estocada"), N);
  assert.ok(e.j[1].vivo);
  assert.equal(e.j[0].accion.fase, "prep");
});

test("la guardia a la misma altura bloquea; a otra altura no", () => {
  const e = duelo(120);
  una(e, ev("estocada"), { mov: 0, guardia: true });
  ticks(e, 30, N, { mov: 0, guardia: true });
  assert.ok(e.j[1].vivo, "guardia media contra estocada media");

  const f = duelo(120);
  una(f, ev("altura+", "estocada"), { mov: 0, guardia: true });   // el atacante sube la espada
  ticks(f, 30, N, { mov: 0, guardia: true });
  assert.ok(!f.j[1].vivo, "guardia media no cubre una estocada alta");
});

test("un ataque bloqueado deja una recuperación larga al atacante", () => {
  const e = duelo(120);
  una(e, ev("estocada"), { mov: 0, guardia: true });
  let bloqueado = false;
  for (let i = 0; i < 40 && !bloqueado; i++) { una(e, N, { mov: 0, guardia: true }); bloqueado = e.eventos.some(v => v.e === "bloqueo"); }
  assert.ok(bloqueado, "se produce el bloqueo");
  assert.ok(e.j[1].vivo);
  assert.equal(e.j[0].accion.fase, "recup");
  assert.ok(e.j[0].accion.t >= ms(CFG.ESTOCADA.recup + CFG.BLOQUEO.retroceso_atacante) - 1, "recuperación ampliada tras ser bloqueado");
});

test("la parada con buen momento aturde al atacante y da contragolpe", () => {
  const e = duelo(120);
  // el defensor pulsa parada justo cuando el golpe va a caer
  una(e, ev("estocada"), N);
  const prep = ms(CFG.ESTOCADA.prep);
  ticks(e, prep - ms(CFG.PARADA.ventana) , N, N);
  una(e, N, ev("parada"));
  hasta(e, x => x.j[0].aturdido > 0 || !x.j[1].vivo, 60);
  assert.ok(e.j[0].aturdido > 0, "el atacante queda aturdido");
  assert.ok(e.j[1].vivo);
  assert.ok(e.j[1].contra > 0, "el defensor gana la ventana de contragolpe");
});

test("la parada no es invulnerabilidad: fuera de tiempo, mueres", () => {
  const e = duelo(120);
  una(e, N, ev("parada"));               // se gasta la ventana antes de tiempo
  ticks(e, ms(CFG.PARADA.ventana) + 1, N, N);
  una(e, ev("estocada"), N);
  ticks(e, 40, N, N);
  assert.ok(!e.j[1].vivo);
});

test("tras fallar una parada hay recuperación en la que no se puede actuar", () => {
  const e = duelo(300);
  una(e, N, ev("parada"));
  ticks(e, ms(CFG.PARADA.ventana) + 1, N, N);
  una(e, N, ev("estocada"));
  assert.notEqual(e.j[1].accion && e.j[1].accion.tipo, "estocada");
});

test("la guardia no se puede mantener sin fin", () => {
  const e = duelo(500);
  ticks(e, ms(CFG.GUARDIA.maxima) + 5, N, { mov: 0, guardia: true });
  assert.ok(!e.j[1].guardando && e.j[1].sinGuardia > 0, "la guardia se cansa");
});

test("agacharse esquiva una estocada alta; saltar esquiva una baja", () => {
  const a = duelo(120);
  una(a, ev("altura+", "estocada"), { mov: 0, agachar: true });
  ticks(a, 30, N, { mov: 0, agachar: true });
  assert.ok(a.j[1].vivo, "agachado esquiva la estocada alta");

  const c = duelo(200);
  una(c, N, { mov: 0, ev: ["saltar"] });
  ticks(c, 4, N, N);
  una(c, ev("altura-", "estocada"), N);
  hasta(c, x => !x.j[0].accion || x.j[0].accion.fase === "recup", 40);
  assert.ok(c.j[1].vivo, "en el aire una estocada baja pasa por debajo");
});

test("un salto alto no protege de una estocada alta", () => {
  const e = duelo(150);
  una(e, N, ev("saltar"));
  ticks(e, 3, N, N);
  una(e, ev("altura+", "estocada"), N);
  hasta(e, x => !x.j[1].vivo || !x.j[0].accion, 40);
  assert.ok(!e.j[1].vivo, "el aire deja alta y media expuestas");
});

test("un tajo cubre varias alturas", () => {
  const e = duelo(150);
  una(e, ev("tajo"), { mov: 0, agachar: true });    // tajo medio: llega a las tres alturas
  ticks(e, 60, N, { mov: 0, agachar: true });
  assert.ok(!e.j[1].vivo);
});

test("el tajo es más lento y su recuperación mayor que la estocada", () => {
  assert.ok(CFG.TAJO.prep > CFG.ESTOCADA.prep && CFG.TAJO.recup > CFG.ESTOCADA.recup);
  assert.ok(CFG.TAJO.alcance > CFG.ESTOCADA.alcance);
});

test("un ataque fallido deja una ventana para responder", () => {
  const e = duelo(CFG.ESTOCADA.alcance + 20 + CFG.ANCHO_CUERPO / 2 + 40);
  una(e, ev("estocada"), N);
  hasta(e, x => x.j[0].accion && x.j[0].accion.fase === "recup", 40);
  una(e, N, { mov: -1 });                              // el rival se acerca
  una(e, N, ev("estocada"));
  ticks(e, 30, N, N);
  assert.ok(!e.j[0].vivo, "quien falla puede ser castigado durante su recuperación");
});

test("la finta no hace daño", () => {
  const e = duelo(100);
  una(e, ev("finta"), N);
  ticks(e, 40, N, N);
  assert.ok(e.j[1].vivo);
});

test("una finta puede cancelarse en un ataque con preparación recortada", () => {
  const e = duelo(120);
  una(e, ev("finta"), N);
  una(e, ev("estocada"), N);
  assert.equal(e.j[0].accion.tipo, "estocada");
  assert.ok(e.j[0].accion.t < ms(CFG.ESTOCADA.prep));
});

test("choque: dos estocadas a la misma altura se anulan", () => {
  const e = duelo(150);
  una(e, ev("estocada"), ev("estocada"));
  hasta(e, x => x.eventos.some(v => v.e === "choque") || !x.j[0].vivo || !x.j[1].vivo, 60);
  assert.ok(e.j[0].vivo && e.j[1].vivo);
});

test("dos estocadas a distinta altura matan a los dos", () => {
  const e = duelo(110);
  una(e, ev("altura+", "estocada"), ev("altura-", "estocada"));
  hasta(e, x => !x.j[0].vivo || !x.j[1].vivo, 60);
  assert.ok(!e.j[0].vivo && !e.j[1].vivo);
  assert.equal(e.ventaja, -1);
});

test("los cuerpos no se atraviesan caminando", () => {
  const e = duelo(120);
  ticks(e, 60, { mov: 1 }, N);
  assert.ok(e.j[0].x < e.j[1].x);
});

test("se puede pasar por encima saltando, pero el salto es vulnerable", () => {
  const e = duelo(160);
  una(e, { mov: 1, correr: true, ev: ["saltar"] }, N);
  ticks(e, 50, { mov: 1, correr: true }, N);
  assert.ok(e.j[0].x > e.j[1].x, "ha pasado al otro lado");
});

test("al reaparecer hay protección y no se muere de inmediato", () => {
  const e = duelo(110);
  una(e, ev("estocada"), N);
  hasta(e, x => !x.j[1].vivo, 60);
  hasta(e, x => x.j[1].vivo, 200);
  assert.ok(e.j[1].proteccion > 0);
  const k = e.j[0];
  // el que lo mató se coloca cerca y ataca mientras dura la protección
  k.x = e.j[1].x - 100; k.accion = null; k.aturdido = 0;
  una(e, ev("estocada"), N);
  ticks(e, 25, N, N);
  assert.ok(e.j[1].vivo, "protegido: el golpe no lo mata");
});

test("la protección termina en cuanto el protegido ataca", () => {
  const e = duelo(300);
  e.j[1].proteccion = 50;
  una(e, N, ev("estocada"));
  assert.equal(e.j[1].proteccion, 0);
  una(e, N, ev("estocada"));
  const f = duelo(300); f.j[1].proteccion = 50;
  una(f, N, ev("finta"));
  assert.equal(f.j[1].proteccion, 0, "fintar también la termina");
});

test("reaparece delante de quien lo mató, hacia su salida", () => {
  const e = duelo(110);
  una(e, ev("estocada"), N);
  hasta(e, x => !x.j[1].vivo, 60);
  assert.equal(e.ventaja, 0);
  const xk = () => e.j[0].x;
  hasta(e, x => x.j[1].vivo, 200);
  assert.ok(e.j[1].x > xk() + CFG.DISTANCIA_MINIMA_REAPARICION - 1, "delante de quien mató, hacia la derecha");
  assert.ok(e.j[1].x <= CFG.PISTA - 30);
});

test("tras morir en plena persecución, el que mató ahora tiene la ventaja", () => {
  const e = duelo(110);
  una(e, ev("estocada"), N);
  hasta(e, x => !x.j[1].vivo, 60);
  hasta(e, x => x.j[1].vivo && x.j[1].proteccion === 0, 400);
  // el rival ahora ataca desde su lado y mata al primero
  e.j[0].x = e.j[1].x - 100; e.j[0].accion = null; e.j[0].aturdido = 0; e.j[0].proteccion = 0;
  una(e, N, ev("estocada"));
  hasta(e, x => !x.j[0].vivo, 80);
  assert.equal(e.ventaja, 1);
  hasta(e, x => x.j[0].vivo, 200);
  assert.ok(e.j[0].x < e.j[1].x - CFG.DISTANCIA_MINIMA_REAPARICION + 1, "reaparece delante del jugador 1, hacia la izquierda");
});

test("gana quien llega a la salida, no quien acumula bajas", () => {
  const e = duelo(600);
  e.j[0].x = CFG.PISTA - CFG.SALIDA - 5;
  ticks(e, 10, { mov: 1 }, N);
  assert.equal(e.fase, "fin");
  assert.equal(e.ganador, 0);
  assert.equal(e.motivo, "salida");
  const f = duelo(600);
  f.j[0].bajas = 5;
  ticks(f, 10, N, N);
  assert.equal(f.fase, "juego", "las bajas por sí solas no ganan");
});

test("el jugador 1 gana al llegar a la izquierda", () => {
  const e = duelo(600);
  e.j[1].x = CFG.SALIDA + 5;
  ticks(e, 10, N, { mov: -1 });
  assert.equal(e.ganador, 1);
});

test("un muerto no puede ganar aunque estuviera en la salida", () => {
  const e = duelo(110);
  e.j[0].x = CFG.PISTA - CFG.SALIDA - 3;
  e.j[1].x = e.j[0].x + 60;
  una(e, N, ev("estocada"));
  hasta(e, x => !x.j[0].vivo || x.fase === "fin", 40);
  assert.notEqual(e.ganador, 0);
});

test("fin de tiempo: gana quien lleva más territorio", () => {
  const e = duelo(600);
  e.j[0].x = 3600;                         // progreso 0.75
  e.j[1].x = 3900;                         // progreso 0.1875
  e.reloj = 2;
  ticks(e, 3, N, N);
  assert.equal(e.fase, "fin");
  assert.equal(e.ganador, 0);
  assert.equal(e.motivo, "territorio");
});

test("fin de tiempo con territorio igual: decide el número de bajas", () => {
  const e = duelo(600);
  e.j[0].x = 2300; e.j[1].x = 2500;      // 0.479 vs 0.479
  e.j[0].bajas = 2; e.j[1].bajas = 1;
  e.reloj = 2;
  ticks(e, 3, N, N);
  assert.equal(e.ganador, 0);
  assert.equal(e.motivo, "bajas");
});

test("empate total: muerte súbita y, si nadie muere, empate", () => {
  const e = duelo(600);
  e.reloj = 2;
  ticks(e, 3, N, N);
  assert.equal(e.fase, "muerte_subita");
  e.reloj = 2;
  ticks(e, 3, N, N);
  assert.equal(e.fase, "fin");
  assert.equal(e.ganador, -1);
  assert.equal(e.motivo, "empate");
});

test("muerte súbita: la primera baja decide la partida", () => {
  const e = duelo(600);
  e.reloj = 2;
  ticks(e, 3, N, N);
  e.j[0].x = 2300; e.j[1].x = 2400;
  una(e, ev("estocada"), N);
  hasta(e, x => x.fase === "fin", 60);
  assert.equal(e.ganador, 0);
  assert.equal(e.motivo, "muerte_subita");
});

test("el abandono da la victoria al otro", () => {
  const e = duelo(600);
  E.abandono(e, 1);
  assert.equal(e.fase, "fin");
  assert.equal(e.ganador, 0);
  assert.equal(e.motivo, "abandono");
});

test("la simulación es determinista", () => {
  function correr() {
    const e = E.crearPartida();
    let s = 12345;
    const azar = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const evs = ["saltar", "estocada", "tajo", "finta", "parada", "altura+", "altura-"];
    for (let i = 0; i < 2500; i++) {
      const ent = [0, 1].map(() => ({ mov: Math.floor(azar() * 3) - 1, correr: azar() < 0.4, agachar: azar() < 0.1, guardia: azar() < 0.3, ev: azar() < 0.3 ? [evs[Math.floor(azar() * evs.length)]] : [] }));
      E.paso(e, ent);
    }
    return E.huella(e);
  }
  assert.equal(correr(), correr());
});

test("las entradas basura no rompen la simulación", () => {
  const e = duelo(300);
  ticks(e, 5, { mov: "x", ev: ["hacker", 5, null], correr: "si", extra: 1 }, { mov: NaN, ev: "estocada" });
  una(e, null, undefined);
  assert.equal(e.fase, "juego");
  assert.ok(Number.isFinite(e.j[0].x) && Number.isFinite(e.j[1].x));
});

test("partida larga al azar: nunca hay estados imposibles", () => {
  const e = E.crearPartida();
  let s = 777;
  const azar = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const evs = ["saltar", "estocada", "tajo", "finta", "parada", "altura+", "altura-"];
  for (let i = 0; i < 6000 && e.fase !== "fin"; i++) {
    const ent = [0, 1].map(() => ({ mov: Math.floor(azar() * 3) - 1, correr: azar() < 0.5, agachar: azar() < 0.1, guardia: azar() < 0.3, ev: azar() < 0.4 ? [evs[Math.floor(azar() * evs.length)]] : [] }));
    E.paso(e, ent);
    for (const f of e.j) {
      assert.ok(f.x >= 0 && f.x <= CFG.PISTA, "dentro de la pista");
      assert.ok(f.y >= 0 && f.y < 400, "altura razonable");
      assert.ok(!(f.vivo && f.muertoT > 0), "un vivo no tiene cuenta atrás de muerte");
    }
  }
});
