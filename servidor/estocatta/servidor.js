"use strict";
/* Servidor de Estocatta. Es el único que decide: los navegadores mandan teclas (qué
   quiere hacer cada jugador) y reciben el estado. Nunca envían posiciones, golpes ni
   ganadores, y si lo intentan se ignora.

   Una sala tiene dos plazas. Cada plaza queda atada a la cuenta que la ocupó (el
   identificador sale del token de Supabase, no de lo que diga el cliente), así que
   nadie puede mover a otro jugador ni sentarse en dos plazas a la vez.

   Variables de entorno (todas opcionales para probar en local):
     PORT                     puerto (Render lo pone solo)
     SUPABASE_URL             por defecto el proyecto del compendio
     SUPABASE_ANON_KEY        clave pública para validar tokens
     SUPABASE_SERVICE_KEY     clave de servicio: solo para anotar resultados
     SOLO_ADMIN               "1" (por defecto) solo deja entrar a admins; "0" abre a todos
     ORIGENES                 orígenes permitidos separados por comas
   Los resultados se anotan una sola vez por partida (ver docs/estocatta.sql). */

const http = require("http");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const Sim = require("./estocatta-sim.js");

const { CFG } = Sim;
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const POR_DEFECTO = {
  envioCada: 2,                      // un estado cada N ticks (30 / 2 = 15 por segundo)
  esperaReconexion: CFG.ESPERA_RECONEXION,
  limiteSalas: 60,
  limitePorIp: 12,
  mensajesPorSegundo: 90,
  salaVaciaMs: 60000,
  salaTerminadaMs: 300000,
  latidoMs: 20000
};

/* --- Validación de cuentas y registro de resultados (se pueden sustituir al probar) --- */

function crearVerificadorSupabase(env) {
  const url = env.SUPABASE_URL || "https://ilicqboqelrjuvtslaxd.supabase.co";
  const clave = env.SUPABASE_ANON_KEY || "sb_publishable_c9kPJ1tWbzCSiqVvmBJ0og_rUW9uLee";
  const soloAdmin = env.SOLO_ADMIN !== "0";
  async function pedir(ruta, token, opciones) {
    return fetch(url + ruta, Object.assign({ headers: { apikey: clave, Authorization: "Bearer " + token, "Content-Type": "application/json" } }, opciones || {}));
  }
  return async function verificar(token) {
    if (typeof token !== "string" || token.length < 20 || token.length > 4000) return null;
    const r = await pedir("/auth/v1/user", token);
    if (!r.ok) return null;
    const u = await r.json();
    if (!u || !u.id) return null;
    let nombre = "";
    try {
      const p = await pedir("/rest/v1/perfiles?select=username&user_id=eq." + encodeURIComponent(u.id), token);
      if (p.ok) { const f = await p.json(); nombre = (f[0] && f[0].username) || ""; }
    } catch (e) { /* sin nombre: se usa el correo */ }
    if (!nombre) nombre = String(u.email || "Jugador").split("@")[0];
    let admin = false;
    try {
      const a = await pedir("/rest/v1/rpc/fichas_es_admin", token, { method: "POST", body: "{}" });
      admin = a.ok && (await a.json()) === true;
    } catch (e) { admin = false; }
    if (soloAdmin && !admin) return { prohibido: true };
    return { id: u.id, nombre: nombre.slice(0, 20), admin };
  };
}

function crearRegistradorSupabase(env) {
  const url = env.SUPABASE_URL || "https://ilicqboqelrjuvtslaxd.supabase.co";
  const servicio = env.SUPABASE_SERVICE_KEY;
  if (!servicio) return async () => ({ guardado: false, motivo: "sin_clave" });
  return async function registrar(r) {
    const resp = await fetch(url + "/rest/v1/rpc/estocatta_registrar", {
      method: "POST",
      headers: { apikey: servicio, Authorization: "Bearer " + servicio, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_partida: r.partida, p_j0: r.j0, p_j1: r.j1, p_ganador: r.ganador, p_motivo: r.motivo,
        p_bajas0: r.bajas0, p_bajas1: r.bajas1, p_duracion_ms: r.duracionMs
      })
    });
    if (!resp.ok) throw new Error("registro: " + resp.status);
    return { guardado: true };
  };
}

/* --- Salas ---------------------------------------------------------------- */

function codigoNuevo(salas) {
  for (let intento = 0; intento < 50; intento++) {
    let c = "";
    const b = crypto.randomBytes(5);
    for (let i = 0; i < 5; i++) c += ALFABETO[b[i] % ALFABETO.length];
    if (!salas.has(c)) return c;
  }
  return null;
}

function crearServidor(opciones) {
  const o = Object.assign({}, POR_DEFECTO, opciones || {});
  const env = o.env || process.env;
  const verificar = o.verificar || crearVerificadorSupabase(env);
  const registrar = o.registrar || crearRegistradorSupabase(env);
  const origenes = (env.ORIGENES || "https://fratiga.github.io").split(",").map(s => s.trim()).filter(Boolean);
  const log = o.log || (() => {});

  const salas = new Map();                    // codigo -> sala
  const salaDe = new Map();                   // userId -> codigo
  const porIp = new Map();

  const http_ = http.createServer((req, res) => {
    const cab = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };
    if (req.url === "/salud" || req.url === "/") {
      res.writeHead(200, Object.assign({ "Content-Type": "application/json" }, cab));
      res.end(JSON.stringify({ ok: true, salas: salas.size, version: Sim.CFG.TICK_HZ }));
    } else { res.writeHead(404, cab); res.end(); }
  });

  const wss = new WebSocketServer({
    server: http_, maxPayload: 4096,
    verifyClient: (info, cb) => {
      const origen = info.origin || "";
      const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origen);
      if (!origen || local || origenes.indexOf(origen) >= 0 || o.permitirCualquierOrigen) return cb(true);
      cb(false, 403, "origen no permitido");
    }
  });

  function enviar(ws, msg) {
    if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(msg)); } catch (e) { /* conexión rota */ } }
  }

  function vistaSala(s) {
    return {
      t: "sala", codigo: s.codigo, estado: s.estado,
      jugadores: s.plazas.map((p, i) => p && { plaza: i, nombre: p.nombre, listo: p.listo, conectado: p.conectado, revancha: p.revancha }),
      resultado: s.resultado || null
    };
  }
  function difundirSala(s) {
    s.plazas.forEach((p, i) => { if (p && p.ws) enviar(p.ws, Object.assign(vistaSala(s), { yo: i })); });
  }
  function difundir(s, msg) { s.plazas.forEach(p => { if (p && p.ws) enviar(p.ws, msg); }); }

  function nuevaPlaza(cuenta, ws) {
    return { id: cuenta.id, nombre: cuenta.nombre, ws, conectado: true, listo: false, revancha: false, entrada: { mov: 0, correr: false, agachar: false, guardia: false }, cola: [], desconectadoDesde: 0 };
  }

  function crearSala() {
    if (salas.size >= o.limiteSalas) return null;
    const codigo = codigoNuevo(salas);
    if (!codigo) return null;
    const s = { codigo, plazas: [null, null], estado: "espera", sim: null, partida: null, intervalo: null, inicio: 0, pausaHasta: 0, registrada: false, resultado: null, ultimaActividad: Date.now(), acumulados: [] };
    salas.set(codigo, s);
    return s;
  }

  function borrarSala(s) {
    if (s.intervalo) clearInterval(s.intervalo);
    s.plazas.forEach(p => { if (p && salaDe.get(p.id) === s.codigo) salaDe.delete(p.id); });
    salas.delete(s.codigo);
  }

  /* --- Ciclo de la partida --- */

  function empezar(s) {
    s.sim = Sim.crearPartida({ tiempo: o.tiempoPartida, sinCuenta: o.sinCuenta });
    if (o.ajustarPartida) o.ajustarPartida(s.sim);
    s.partida = crypto.randomUUID();
    s.registrada = false; s.resultado = null; s.acumulados = [];
    s.inicio = Date.now();
    s.estado = "juego";
    s.plazas.forEach(p => { p.listo = false; p.revancha = false; p.cola = []; p.entrada = { mov: 0, correr: false, agachar: false, guardia: false }; });
    difundirSala(s);
    enviar0(s);
    if (s.intervalo) clearInterval(s.intervalo);
    const ms = 1000 / CFG.TICK_HZ;
    let siguiente = Date.now() + ms;
    s.intervalo = setInterval(() => {
      // si el proceso va con retraso se recuperan ticks, con un tope para no ahogarse
      let n = 0;
      while (Date.now() >= siguiente && n < 5) { tick(s); siguiente += ms; n++; if (s.estado !== "juego") break; }
      if (Date.now() > siguiente + 1000) siguiente = Date.now() + ms;
    }, Math.floor(ms / 2));
  }

  function enviar0(s) { difundir(s, Object.assign({ t: "est", ini: 1, cfg: { pista: CFG.PISTA, salida: CFG.SALIDA, hz: CFG.TICK_HZ, ancho: CFG.ANCHO_CUERPO, alto: CFG.ALTO_CUERPO } }, Sim.instantanea(s.sim))); }

  function tick(s) {
    if (s.estado !== "juego") return;
    // pausa por desconexión: el reloj de la partida no corre, el de la espera sí
    if (s.pausaHasta) {
      if (Date.now() >= s.pausaHasta) {
        const ausente = s.plazas.findIndex(p => p && !p.conectado);
        terminarPor(s, ausente >= 0 ? ausente : 0, "abandono");
      }
      return;
    }
    const entradas = s.plazas.map(p => {
      const e = { mov: p.entrada.mov, correr: p.entrada.correr, agachar: p.entrada.agachar, guardia: p.entrada.guardia, ev: p.cola.splice(0, 3) };
      return e;
    });
    Sim.paso(s.sim, entradas);
    for (const ev of s.sim.eventos) s.acumulados.push(ev);
    const fin = s.sim.fase === "fin";
    if (fin || s.sim.tick % o.envioCada === 0) {
      const inst = Sim.instantanea(s.sim);
      inst.ev = s.acumulados; s.acumulados = [];
      difundir(s, Object.assign({ t: "est" }, inst));
    }
    if (fin) cerrarPartida(s);
  }

  function terminarPor(s, perdedor, motivo) {
    if (s.estado !== "juego") return;
    Sim.abandono(s.sim, perdedor, motivo);
    const inst = Sim.instantanea(s.sim);
    inst.ev = s.sim.eventos.slice();
    difundir(s, Object.assign({ t: "est" }, inst));
    cerrarPartida(s);
  }

  function cerrarPartida(s) {
    if (s.intervalo) { clearInterval(s.intervalo); s.intervalo = null; }
    s.estado = "fin";
    s.ultimaActividad = Date.now();
    s.pausaHasta = 0;
    const sim = s.sim;
    s.resultado = { ganador: sim.ganador, motivo: sim.motivo, bajas: [sim.j[0].bajas, sim.j[1].bajas] };
    difundirSala(s);
    if (s.registrada) return;           // el resultado se anota una sola vez por partida
    s.registrada = true;
    const r = {
      partida: s.partida, j0: s.plazas[0].id, j1: s.plazas[1].id, ganador: sim.ganador, motivo: sim.motivo,
      bajas0: sim.j[0].bajas, bajas1: sim.j[1].bajas, duracionMs: Date.now() - s.inicio
    };
    Promise.resolve().then(() => registrar(r)).then(res => {
      s.resultado.guardado = !!(res && res.guardado);
      difundir(s, { t: "guardado", guardado: s.resultado.guardado, motivo: (res && res.motivo) || "" });
    }).catch(err => {
      log("no se pudo anotar la partida " + s.partida + ": " + err.message);
      s.resultado.guardado = false;
      difundir(s, { t: "guardado", guardado: false, motivo: "error" });
    });
  }

  /* --- Mensajes --- */

  function salirDeSala(cliente, motivoVoluntario) {
    const s = salas.get(cliente.sala);
    cliente.sala = null;
    if (!s) return;
    const i = s.plazas.findIndex(p => p && p.id === cliente.id);
    if (i < 0) return;
    if (s.estado === "juego") {
      terminarPor(s, i, "abandono");
    }
    const p = s.plazas[i];
    if (p && salaDe.get(p.id) === s.codigo) salaDe.delete(p.id);
    s.plazas[i] = null;
    s.ultimaActividad = Date.now();
    if (s.estado === "fin") { /* se queda el resultado para el otro hasta que salga */ }
    if (!s.plazas[0] && !s.plazas[1]) borrarSala(s);
    else {
      if (s.estado !== "fin") { s.estado = "espera"; s.plazas.forEach(q => { if (q) q.listo = false; }); }
      difundirSala(s);
    }
  }

  function alMensaje(cliente, texto) {
    const ahora = Date.now();
    if (ahora - cliente.ventana > 1000) { cliente.ventana = ahora; cliente.mensajes = 0; }
    if (++cliente.mensajes > o.mensajesPorSegundo) return;       // exceso: se ignora
    let m;
    try { m = JSON.parse(texto); } catch (e) { return; }
    if (!m || typeof m !== "object" || typeof m.t !== "string") return;

    if (m.t === "ping") { enviar(cliente.ws, { t: "pong", c: m.c }); return; }
    if (m.t === "hola") { saludar(cliente, m); return; }
    if (!cliente.id) { enviar(cliente.ws, { t: "error", codigo: "sin_sesion", mensaje: "Inicia sesión primero." }); return; }

    const s = cliente.sala ? salas.get(cliente.sala) : null;
    const i = s ? s.plazas.findIndex(p => p && p.id === cliente.id) : -1;

    switch (m.t) {
      case "crear": {
        if (s) { enviar(cliente.ws, { t: "error", codigo: "ya_en_sala", mensaje: "Ya estás en una sala." }); return; }
        const nueva = crearSala();
        if (!nueva) { enviar(cliente.ws, { t: "error", codigo: "sin_espacio", mensaje: "Ahora mismo no caben más salas." }); return; }
        sentar(cliente, nueva, 0);
        return;
      }
      case "unir": {
        if (s) { enviar(cliente.ws, { t: "error", codigo: "ya_en_sala", mensaje: "Ya estás en una sala." }); return; }
        const codigo = String(m.codigo || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
        const destino = salas.get(codigo);
        if (!destino) { enviar(cliente.ws, { t: "error", codigo: "sala_inexistente", mensaje: "Esa sala no existe." }); return; }
        if (destino.plazas.some(p => p && p.id === cliente.id)) { enviar(cliente.ws, { t: "error", codigo: "ya_en_sala", mensaje: "Ya estás en esa sala." }); return; }
        const libre = destino.plazas.findIndex(p => !p);
        if (libre < 0 || destino.estado === "juego") { enviar(cliente.ws, { t: "error", codigo: "sala_llena", mensaje: "La sala ya está completa." }); return; }
        sentar(cliente, destino, libre);
        return;
      }
      case "listo": {
        if (!s || i < 0 || (s.estado !== "espera" && s.estado !== "fin")) return;
        if (s.estado === "fin") return;
        s.plazas[i].listo = m.listo !== false;
        difundirSala(s);
        if (s.plazas[0] && s.plazas[1] && s.plazas[0].listo && s.plazas[1].listo) empezar(s);
        return;
      }
      case "revancha": {
        if (!s || i < 0 || s.estado !== "fin") return;
        s.plazas[i].revancha = true;
        difundirSala(s);
        if (s.plazas[0] && s.plazas[1] && s.plazas[0].revancha && s.plazas[1].revancha && s.plazas[0].conectado && s.plazas[1].conectado) empezar(s);
        return;
      }
      case "in": {
        if (!s || i < 0 || s.estado !== "juego") return;
        const p = s.plazas[i];
        p.entrada = { mov: m.mov > 0 ? 1 : m.mov < 0 ? -1 : 0, correr: m.correr === true, agachar: m.agachar === true, guardia: m.guardia === true };
        if (Array.isArray(m.ev)) for (const e of m.ev.slice(0, 4)) {
          if (Sim.EVENTOS_VALIDOS.indexOf(e) >= 0 && p.cola.length < 8) p.cola.push(e);
        }
        return;
      }
      case "salir": salirDeSala(cliente, true); enviar(cliente.ws, { t: "salio" }); return;
      default: return;       // cualquier otra cosa (incluidos intentos de mandar posiciones o resultados) se ignora
    }
  }

  function sentar(cliente, s, plaza) {
    const p = nuevaPlaza(cliente, cliente.ws);
    if (s.estado === "fin") { s.estado = "espera"; s.resultado = null; s.sim = null; s.plazas.forEach(q => { if (q) { q.listo = false; q.revancha = false; } }); }
    s.plazas[plaza] = p;
    cliente.sala = s.codigo;
    salaDe.set(cliente.id, s.codigo);
    s.ultimaActividad = Date.now();
    difundirSala(s);
  }

  async function saludar(cliente, m) {
    if (cliente.id || cliente.verificando) return;
    cliente.verificando = true;
    let cuenta = null;
    try { cuenta = await verificar(m.token); } catch (e) { cuenta = null; }
    cliente.verificando = false;
    if (!cuenta) { enviar(cliente.ws, { t: "error", codigo: "token", mensaje: "No se pudo comprobar tu sesión. Vuelve a iniciar sesión." }); cliente.ws.close(4001); return; }
    if (cuenta.prohibido) { enviar(cliente.ws, { t: "error", codigo: "prohibido", mensaje: "Estocatta está en pruebas y solo la ve el admin." }); cliente.ws.close(4003); return; }
    cliente.id = cuenta.id; cliente.nombre = cuenta.nombre;

    // la misma cuenta en otra pestaña: se queda con la plaza (reconexión) y la conexión vieja se cierra
    const codigo = salaDe.get(cuenta.id);
    const s = codigo ? salas.get(codigo) : null;
    const i = s ? s.plazas.findIndex(p => p && p.id === cuenta.id) : -1;
    if (s && i >= 0) {
      const p = s.plazas[i];
      const vieja = p.ws;
      p.ws = cliente.ws; p.conectado = true; p.desconectadoDesde = 0;
      cliente.sala = s.codigo;
      if (vieja && vieja !== cliente.ws) { vieja.reemplazada = true; try { vieja.close(4000); } catch (e) { /* ya cerrada */ } }
      if (s.pausaHasta && s.plazas.every(q => q && q.conectado)) {
        s.pausaHasta = 0;
        difundir(s, { t: "reanuda" });
      }
      enviar(cliente.ws, { t: "ok", id: cuenta.id, nombre: cuenta.nombre, reconectado: true });
      difundirSala(s);
      if (s.sim) enviar(cliente.ws, Object.assign({ t: "est", ini: 1, cfg: { pista: CFG.PISTA, salida: CFG.SALIDA, hz: CFG.TICK_HZ, ancho: CFG.ANCHO_CUERPO, alto: CFG.ALTO_CUERPO } }, Sim.instantanea(s.sim)));
      return;
    }
    enviar(cliente.ws, { t: "ok", id: cuenta.id, nombre: cuenta.nombre });
  }

  function alDesconectar(cliente) {
    if (cliente.ws.reemplazada) return;
    const s = cliente.sala ? salas.get(cliente.sala) : null;
    if (!s) return;
    const i = s.plazas.findIndex(p => p && p.id === cliente.id && p.ws === cliente.ws);
    if (i < 0) return;
    const p = s.plazas[i];
    p.conectado = false; p.ws = null; p.desconectadoDesde = Date.now();
    p.entrada = { mov: 0, correr: false, agachar: false, guardia: false }; p.cola = [];
    if (s.estado === "juego") {
      // la partida se detiene y se espera un rato a que vuelva; si no vuelve, pierde
      s.pausaHasta = Date.now() + o.esperaReconexion;
      difundir(s, { t: "pausa", plaza: i, ms: o.esperaReconexion });
    } else if (s.estado === "espera") {
      s.plazas[i] = null;
      if (salaDe.get(cliente.id) === s.codigo) salaDe.delete(cliente.id);
      if (!s.plazas[0] && !s.plazas[1]) borrarSala(s);
      else { s.plazas.forEach(q => { if (q) q.listo = false; }); difundirSala(s); }
    } else {
      difundirSala(s);
    }
    s.ultimaActividad = Date.now();
  }

  wss.on("connection", (ws, req) => {
    const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim();
    const n = (porIp.get(ip) || 0) + 1;
    if (n > o.limitePorIp) { ws.close(1013); return; }
    porIp.set(ip, n);
    const cliente = { ws, id: null, nombre: "", sala: null, ventana: 0, mensajes: 0, verificando: false };
    ws.vivo = true;
    ws.on("pong", () => { ws.vivo = true; });
    ws.on("message", d => alMensaje(cliente, d.toString()));
    ws.on("close", () => {
      porIp.set(ip, Math.max(0, (porIp.get(ip) || 1) - 1));
      alDesconectar(cliente);
    });
    ws.on("error", () => { /* el cierre se trata en "close" */ });
    // sin saludo en 10 s: fuera
    setTimeout(() => { if (!cliente.id && ws.readyState === 1) ws.close(4002); }, 10000).unref();
  });

  /* Latido: cierra conexiones muertas y limpia salas abandonadas. Además mantiene despierto
     el servicio gratuito mientras haya gente conectada. */
  const latido = setInterval(() => {
    wss.clients.forEach(ws => {
      if (!ws.vivo) { ws.terminate(); return; }
      ws.vivo = false;
      try { ws.ping(); } catch (e) { /* cerrada */ }
    });
    const ahora = Date.now();
    for (const s of Array.from(salas.values())) {
      const conectados = s.plazas.filter(p => p && p.conectado).length;
      // una partida en curso no se borra: su espera de reconexión la resolverá como abandono
      if (s.estado !== "juego" && conectados === 0 && ahora - s.ultimaActividad > (s.estado === "fin" ? o.salaTerminadaMs : o.salaVaciaMs)) borrarSala(s);
    }
  }, o.latidoMs);
  latido.unref();

  return {
    http: http_, wss, salas, salaDe,
    escuchar(puerto) { return new Promise(r => http_.listen(puerto || 0, () => r(http_.address().port))); },
    cerrar() {
      clearInterval(latido);
      for (const s of salas.values()) if (s.intervalo) clearInterval(s.intervalo);
      wss.clients.forEach(c => c.terminate());
      return new Promise(r => { wss.close(() => http_.close(() => r())); });
    }
  };
}

module.exports = { crearServidor, POR_DEFECTO };

if (require.main === module) {
  const srv = crearServidor({ log: m => console.log(new Date().toISOString(), m) });
  const puerto = Number(process.env.PORT) || 8787;
  srv.escuchar(puerto).then(p => console.log("Estocatta escuchando en el puerto " + p + (process.env.SOLO_ADMIN === "0" ? "" : " (solo admin)")));
  process.on("SIGTERM", () => { srv.cerrar().then(() => process.exit(0)); });
}
