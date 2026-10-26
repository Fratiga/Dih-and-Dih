"use strict";
const test = require("node:test");
const assert = require("node:assert");
const WebSocket = require("ws");
const { crearServidor } = require("../servidor.js");
const Sim = require("../estocatta-sim.js");

const { CFG } = Sim;
const dormir = ms => new Promise(r => setTimeout(r, ms));

async function verificar(token) {
  if (typeof token !== "string") return null;
  const m = token.match(/^T:([a-z0-9]+):(\w+)$/);
  if (!m) return null;
  if (m[1] === "intruso") return { prohibido: true };
  return { id: m[1], nombre: m[2] };
}

const CERCA_DE_SALIDA = e => { e.j[0].x = CFG.PISTA - CFG.SALIDA - 30; e.j.forEach(f => f.proteccion = 0); };

async function iniciar(extra) {
  const registros = [];
  const srv = crearServidor(Object.assign({
    verificar,
    registrar: async r => { registros.push(r); return { guardado: true }; },
    sinCuenta: true, esperaReconexion: 400, envioCada: 1, latidoMs: 5000
  }, extra || {}));
  const puerto = await srv.escuchar(0);
  return { srv, puerto, registros };
}

function cliente(puerto, opciones) {
  const ws = new WebSocket("ws://127.0.0.1:" + puerto, opciones);
  const c = { ws, msgs: [], cerrado: false, codigoCierre: 0 };
  ws.on("message", d => c.msgs.push(JSON.parse(d.toString())));
  ws.on("close", code => { c.cerrado = true; c.codigoCierre = code; });
  c.abierto = new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
  c.abierto.catch(() => {});
  c.enviar = m => ws.send(typeof m === "string" ? m : JSON.stringify(m));
  c.esperar = async (pred, ms) => {
    const limite = Date.now() + (ms || 2000);
    let desde = 0;
    while (Date.now() < limite) {
      for (; desde < c.msgs.length; desde++) if (pred(c.msgs[desde])) return c.msgs[desde];
      await dormir(10);
    }
    throw new Error("no llegó el mensaje esperado. Recibidos: " + c.msgs.slice(-5).map(m => m.t + (m.codigo ? ":" + m.codigo : "")).join(","));
  };
  return c;
}
async function entrar(puerto, token) {
  const c = cliente(puerto);
  await c.abierto;
  c.enviar({ t: "hola", token });
  await c.esperar(m => m.t === "ok");
  return c;
}
async function parejaEnSala(puerto, a, b) {
  const ca = await entrar(puerto, "T:" + a + ":" + a), cb = await entrar(puerto, "T:" + b + ":" + b);
  ca.enviar({ t: "crear" });
  const sala = await ca.esperar(m => m.t === "sala");
  cb.enviar({ t: "unir", codigo: sala.codigo });
  await cb.esperar(m => m.t === "sala" && m.jugadores.filter(Boolean).length === 2);
  return { ca, cb, codigo: sala.codigo };
}
async function empezarPartida(ca, cb) {
  ca.enviar({ t: "listo" }); cb.enviar({ t: "listo" });
  await ca.esperar(m => m.t === "est" && m.ini);
  await cb.esperar(m => m.t === "est" && m.ini);
}
function cerrarTodo(srv, ...cs) { cs.forEach(c => { try { c.ws.terminate(); } catch (e) { /* ya cerrada */ } }); return srv.cerrar(); }

test("un token inválido se rechaza y se cierra la conexión", async () => {
  const { srv, puerto } = await iniciar();
  const c = cliente(puerto); await c.abierto;
  c.enviar({ t: "hola", token: "falso" });
  const err = await c.esperar(m => m.t === "error");
  assert.equal(err.codigo, "token");
  await dormir(100);
  assert.ok(c.cerrado);
  await cerrarTodo(srv, c);
});

test("sin saludo no se puede crear sala", async () => {
  const { srv, puerto } = await iniciar();
  const c = cliente(puerto); await c.abierto;
  c.enviar({ t: "crear" });
  const err = await c.esperar(m => m.t === "error");
  assert.equal(err.codigo, "sin_sesion");
  assert.equal(srv.salas.size, 0);
  await cerrarTodo(srv, c);
});

test("en pruebas: una cuenta sin permiso no entra", async () => {
  const { srv, puerto } = await iniciar();
  const c = cliente(puerto); await c.abierto;
  c.enviar({ t: "hola", token: "T:intruso:x" });
  const err = await c.esperar(m => m.t === "error");
  assert.equal(err.codigo, "prohibido");
  await cerrarTodo(srv, c);
});

test("crear sala, unirse con el código y empezar cuando los dos están listos", async () => {
  const { srv, puerto } = await iniciar();
  const { ca, cb, codigo } = await parejaEnSala(puerto, "ana", "beto");
  assert.match(codigo, /^[A-Z0-9]{5}$/);
  ca.enviar({ t: "listo" });
  await dormir(80);
  assert.equal(srv.salas.get(codigo).estado, "espera", "con uno solo listo no empieza");
  cb.enviar({ t: "listo" });
  const est = await ca.esperar(m => m.t === "est" && m.ini);
  assert.equal(est.f, "juego");
  assert.equal(est.cfg.pista, CFG.PISTA);
  await cerrarTodo(srv, ca, cb);
});

test("un tercer jugador no puede entrar en una sala completa", async () => {
  const { srv, puerto } = await iniciar();
  const { ca, cb, codigo } = await parejaEnSala(puerto, "ana", "beto");
  const cc = await entrar(puerto, "T:carla:carla");
  cc.enviar({ t: "unir", codigo });
  const err = await cc.esperar(m => m.t === "error");
  assert.equal(err.codigo, "sala_llena");
  assert.equal(srv.salas.get(codigo).plazas.filter(Boolean).length, 2);
  await cerrarTodo(srv, ca, cb, cc);
});

test("una sala inexistente da error", async () => {
  const { srv, puerto } = await iniciar();
  const c = await entrar(puerto, "T:ana:ana");
  c.enviar({ t: "unir", codigo: "ZZZZZ" });
  assert.equal((await c.esperar(m => m.t === "error")).codigo, "sala_inexistente");
  await cerrarTodo(srv, c);
});

test("dos plazas no pueden ser de la misma cuenta", async () => {
  const { srv, puerto } = await iniciar();
  const a1 = await entrar(puerto, "T:ana:ana");
  a1.enviar({ t: "crear" });
  const sala = await a1.esperar(m => m.t === "sala");
  const a2 = await entrar(puerto, "T:ana:ana");        // la misma cuenta en otra pestaña
  a2.enviar({ t: "unir", codigo: sala.codigo });
  await dormir(150);
  const s = srv.salas.get(sala.codigo);
  assert.equal(s.plazas.filter(Boolean).length, 1, "no hay una segunda plaza para la misma cuenta");
  await cerrarTodo(srv, a1, a2);
});

test("el cliente no puede mandar posiciones, golpes ni ganadores", async () => {
  const { srv, puerto } = await iniciar();
  const { ca, cb, codigo } = await parejaEnSala(puerto, "ana", "beto");
  await empezarPartida(ca, cb);
  const s = srv.salas.get(codigo);
  const x0 = s.sim.j[0].x, x1 = s.sim.j[1].x;
  ca.enviar({ t: "est", j: [{ x: 4700, y: 0 }], g: 0, ganador: 0 });
  ca.enviar({ t: "in", x: 4700, pos: 4700, ganador: 0, mov: 0 });
  ca.enviar({ t: "fin", ganador: 0 });
  ca.enviar({ t: "matar", quien: 1 });
  ca.enviar("esto no es json");
  ca.enviar({ t: "in", ev: ["hacker", "teletransporte"] });
  await dormir(250);
  assert.equal(s.sim.ganador, -1);
  assert.equal(s.estado, "juego");
  assert.equal(s.sim.j[0].x, x0);
  assert.equal(s.sim.j[1].x, x1);
  assert.ok(s.sim.j[1].vivo);
  await cerrarTodo(srv, ca, cb);
});

test("cada jugador solo controla su luchador", async () => {
  const { srv, puerto } = await iniciar();
  const { ca, cb, codigo } = await parejaEnSala(puerto, "ana", "beto");
  await empezarPartida(ca, cb);
  const s = srv.salas.get(codigo);
  const x0 = s.sim.j[0].x, x1 = s.sim.j[1].x;
  ca.enviar({ t: "in", mov: 1, correr: true });
  await dormir(400);
  assert.ok(s.sim.j[0].x > x0 + 20, "ana mueve a su luchador");
  assert.equal(s.sim.j[1].x, x1, "el de beto no se mueve por lo que haga ana");
  await cerrarTodo(srv, ca, cb);
});

test("llegar a la salida gana y el resultado se anota una sola vez", async () => {
  const { srv, puerto, registros } = await iniciar({ ajustarPartida: CERCA_DE_SALIDA });
  const { ca, cb, codigo } = await parejaEnSala(puerto, "ana", "beto");
  await empezarPartida(ca, cb);
  ca.enviar({ t: "in", mov: 1, correr: true });
  const fin = await ca.esperar(m => m.t === "est" && m.f === "fin");
  assert.equal(fin.g, 0);
  assert.equal(fin.m, "salida");
  await ca.esperar(m => m.t === "guardado");
  await dormir(100);
  assert.equal(registros.length, 1);
  assert.equal(registros[0].j0, "ana");
  assert.equal(registros[0].j1, "beto");
  assert.equal(registros[0].ganador, 0);
  // seguir mandando teclas no vuelve a anotar nada
  ca.enviar({ t: "in", mov: 1 });
  await dormir(150);
  assert.equal(registros.length, 1);
  assert.equal(srv.salas.get(codigo).estado, "fin");
  await cerrarTodo(srv, ca, cb);
});

test("revancha: nueva partida con identificador distinto y nuevo registro", async () => {
  const { srv, puerto, registros } = await iniciar({ ajustarPartida: CERCA_DE_SALIDA });
  const { ca, cb } = await parejaEnSala(puerto, "ana", "beto");
  await empezarPartida(ca, cb);
  ca.enviar({ t: "in", mov: 1, correr: true });
  await ca.esperar(m => m.t === "est" && m.f === "fin");
  await dormir(100);
  ca.msgs.length = 0; cb.msgs.length = 0;
  ca.enviar({ t: "revancha" });
  await dormir(80);
  assert.equal(srv.salas.size, 1);
  cb.enviar({ t: "revancha" });
  await ca.esperar(m => m.t === "est" && m.ini);
  ca.enviar({ t: "in", mov: 1, correr: true });
  await ca.esperar(m => m.t === "est" && m.f === "fin");
  await dormir(150);
  assert.equal(registros.length, 2);
  assert.notEqual(registros[0].partida, registros[1].partida);
  await cerrarTodo(srv, ca, cb);
});

test("una desconexión pausa la partida y, si no vuelve, pierde por abandono", async () => {
  const { srv, puerto, registros } = await iniciar({ esperaReconexion: 300 });
  const { ca, cb } = await parejaEnSala(puerto, "ana", "beto");
  await empezarPartida(ca, cb);
  cb.ws.terminate();
  const pausa = await ca.esperar(m => m.t === "pausa");
  assert.equal(pausa.plaza, 1);
  const fin = await ca.esperar(m => m.t === "est" && m.f === "fin", 2000);
  assert.equal(fin.g, 0);
  assert.equal(fin.m, "abandono");
  await dormir(100);
  assert.equal(registros.length, 1);
  assert.equal(registros[0].ganador, 0);
  await cerrarTodo(srv, ca, cb);
});

test("la partida no queda bloqueada si los dos se desconectan", async () => {
  const { srv, puerto, registros } = await iniciar({ esperaReconexion: 200, salaVaciaMs: 100, salaTerminadaMs: 100, latidoMs: 80 });
  const { ca, cb, codigo } = await parejaEnSala(puerto, "ana", "beto");
  await empezarPartida(ca, cb);
  ca.ws.terminate(); cb.ws.terminate();
  await dormir(700);
  assert.equal(registros.length, 1, "se resuelve y se anota una vez");
  assert.equal(srv.salas.has(codigo), false, "la sala vacía se limpia");
  await cerrarTodo(srv, ca, cb);
});

test("quien vuelve a tiempo recupera su plaza y la partida sigue", async () => {
  const { srv, puerto, registros } = await iniciar({ esperaReconexion: 800 });
  const { ca, cb, codigo } = await parejaEnSala(puerto, "ana", "beto");
  await empezarPartida(ca, cb);
  cb.ws.terminate();
  await ca.esperar(m => m.t === "pausa");
  const cb2 = cliente(puerto); await cb2.abierto;
  cb2.enviar({ t: "hola", token: "T:beto:beto" });
  const ok = await cb2.esperar(m => m.t === "ok");
  assert.equal(ok.reconectado, true);
  await ca.esperar(m => m.t === "reanuda");
  const est = await cb2.esperar(m => m.t === "est" && m.ini);
  assert.equal(est.f, "juego");
  const n0 = srv.salas.get(codigo).sim.tick;
  await dormir(200);
  assert.ok(srv.salas.get(codigo).sim.tick > n0, "el reloj de la partida vuelve a correr");
  await dormir(900);
  assert.equal(registros.length, 0, "no hubo abandono");
  await cerrarTodo(srv, ca, cb, cb2);
});

test("un tercero no puede quedarse con una plaza ni mover a nadie", async () => {
  const { srv, puerto } = await iniciar();
  const { ca, cb, codigo } = await parejaEnSala(puerto, "ana", "beto");
  await empezarPartida(ca, cb);
  const intruso = await entrar(puerto, "T:carla:carla");
  intruso.enviar({ t: "in", mov: 1, correr: true });
  intruso.enviar({ t: "unir", codigo });
  await dormir(250);
  const s = srv.salas.get(codigo);
  assert.equal(s.sim.j[0].x, CFG.PISTA / 2 - CFG.SEPARACION_INICIAL);
  assert.equal(s.sim.j[1].x, CFG.PISTA / 2 + CFG.SEPARACION_INICIAL);
  await cerrarTodo(srv, ca, cb, intruso);
});

test("si no se puede anotar el resultado, se avisa y no se finge que se guardó", async () => {
  const { srv, puerto } = await iniciar({
    registrar: async () => { throw new Error("sin conexión con Supabase"); },
    ajustarPartida: CERCA_DE_SALIDA
  });
  const { ca, cb } = await parejaEnSala(puerto, "ana", "beto");
  await empezarPartida(ca, cb);
  ca.enviar({ t: "in", mov: 1, correr: true });
  const g = await ca.esperar(m => m.t === "guardado");
  assert.equal(g.guardado, false);
  await cerrarTodo(srv, ca, cb);
});

test("un cliente que inunda de mensajes no tumba el servidor", async () => {
  const { srv, puerto } = await iniciar();
  const { ca, cb, codigo } = await parejaEnSala(puerto, "ana", "beto");
  await empezarPartida(ca, cb);
  for (let i = 0; i < 3000; i++) ca.enviar({ t: "in", mov: 1, ev: ["estocada", "tajo", "saltar", "finta"] });
  await dormir(300);
  const estado = srv.salas.get(codigo).estado;
  assert.ok(estado === "juego" || estado === "fin");
  const salud = await fetch("http://127.0.0.1:" + puerto + "/salud").then(r => r.json());
  assert.equal(salud.ok, true);
  await cerrarTodo(srv, ca, cb);
});

test("un origen no permitido no puede conectar", async () => {
  const { srv, puerto } = await iniciar();
  const c = cliente(puerto, { headers: { Origin: "https://sitio-malo.example" } });
  const resultado = await new Promise(r => { c.ws.on("error", () => r("rechazado")); c.ws.on("open", () => r("abierto")); });
  assert.equal(resultado, "rechazado");
  await srv.cerrar();
});

test("el resultado de la simulación llega por la red: territorio al acabarse el tiempo", async () => {
  const { srv, puerto, registros } = await iniciar({ tiempoPartida: 600, ajustarPartida: e => { e.j[0].x = 3000; e.j[1].x = 3600; } });
  const { ca, cb } = await parejaEnSala(puerto, "ana", "beto");
  await empezarPartida(ca, cb);
  const fin = await ca.esperar(m => m.t === "est" && m.f === "fin", 3000);
  assert.equal(fin.m, "territorio");
  assert.equal(fin.g, 0);
  await dormir(100);
  assert.equal(registros.length, 1);
  await cerrarTodo(srv, ca, cb);
});
