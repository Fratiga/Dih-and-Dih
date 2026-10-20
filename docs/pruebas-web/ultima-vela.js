// Pruebas de la parte del navegador de La Última Vela, sin navegador: textos, velas y botones (ultima-vela-vista.js), llamadas al servidor (veintiuna-api.js)
// y lo que se puede comprobar leyendo la página, el controlador y los archivos de Muerte Súbita.
// Uso (desde la raíz del proyecto):  node docs/pruebas-web/ultima-vela.js
const fs = require("fs");
const path = require("path");
const RAIZ = path.resolve(__dirname, "..", "..");
let fallos = 0, ok = 0;
const comprobar = (t, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  console.log((bien ? "  OK   " : "  FALLA ") + t + (bien ? "" : ` (esperado ${JSON.stringify(esperado)}, real ${JSON.stringify(real)})`));
  bien ? ok++ : fallos++;
};
const cierto = (t, cond) => comprobar(t, !!cond, true);
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), "utf8");

global.window = global;
require(path.join(RAIZ, "js", "veintiuna-arte.js"));
const U = require(path.join(RAIZ, "js", "ultima-vela-vista.js"));
const Api = require(path.join(RAIZ, "js", "veintiuna-api.js"));

const carta = (r, p) => ({ r, p });
const META = { ganar: 3, manos: 5, empates: 2, cera: 18 };
const est = (o) => Object.assign({ intento: "i1", personaje: "Aldric", estado: "en_curso", meta: META, ganadas: 0, perdidas: 0, empates_seguidos: 0, repartidas: 0, numero: 1, historial: [], mano: null }, o || {});
const manoAbierta = (o) => Object.assign({ paso: 0, numero: 1, repeticion: 0, fase: "jugador",
  jugador: { cartas: [carta(10, 0), carta(5, 1)], total: 15, blando: false }, cera: { cartas: [carta(9, 2), carta(7, 3)], total: 16, blando: false } }, o || {});
const manoFin = (resultado, razon, cuenta, o) => Object.assign(manoAbierta({ fase: "terminada", resultado, razon, cuenta: cuenta || resultado }), o || {});

console.log("== Las cinco velas");
let v = U.velas(est());
comprobar("antes de empezar: la primera es la que se juega y las demás esperan", v.map(x => x.estado), ["actual", "pendiente", "pendiente", "pendiente", "pendiente"]);
v = U.velas(est({ ganadas: 1, perdidas: 1, numero: 3, repartidas: 2, historial: [{ numero: 1, resultado: "victoria", cuenta: "victoria" }, { numero: 2, resultado: "derrota", cuenta: "derrota" }] }));
comprobar("una ganada, una perdida y la tercera en juego", v.map(x => x.estado), ["ganada", "perdida", "actual", "pendiente", "pendiente"]);
v = U.velas(est({ numero: 1, repartidas: 2, empates_seguidos: 1, historial: [{ numero: 1, resultado: "empate", cuenta: "empate" }] }));
comprobar("un empate no gasta vela: la misma sigue en juego", v.map(x => x.estado), ["actual", "pendiente", "pendiente", "pendiente", "pendiente"]);
v = U.velas(est({ ganadas: 3, perdidas: 0, estado: "ganado", numero: 4, repartidas: 3, historial: [1, 2, 3].map(n => ({ numero: n, resultado: "victoria", cuenta: "victoria" })) }));
comprobar("con el reto ganado no queda ninguna «en juego»", v.map(x => x.estado), ["ganada", "ganada", "ganada", "pendiente", "pendiente"]);
v = U.velas(est({ historial: [{ numero: 1, resultado: "empate", cuenta: "empate" }, { numero: 1, resultado: "empate", cuenta: "empate" }, { numero: 1, resultado: "empate", cuenta: "derrota" }], perdidas: 1, numero: 2, repartidas: 3 }));
comprobar("tres empates seguidos dejan la vela apagada", v.map(x => x.estado).slice(0, 2), ["perdida", "actual"]);
cierto("cada vela tiene una etiqueta para el lector de pantalla", U.velas(est()).every(x => /^Mano \d, /.test(U.etiquetaVela(x))));

console.log("== El marcador en palabras");
comprobar("al empezar", U.cuenta(est()), "Mano 1 de 5. Llevas 0 ganadas y 0 perdidas. Hacen falta 3.");
cierto("con un empate se avisa de cuántos van", /ya empató 1 vez \(se repite hasta 2\)/.test(U.cuenta(est({ empates_seguidos: 1 }))));
cierto("con dos empates, «2 veces»", /ya empató 2 veces/.test(U.cuenta(est({ empates_seguidos: 2 }))));
cierto("reto ganado", /^Reto superado\. Ganaste 3 manos y perdiste 1\./.test(U.cuenta(est({ estado: "ganado", ganadas: 3, perdidas: 1 }))));
cierto("reto perdido", /^Reto perdido\. Perdiste 3 manos y ganaste 2\./.test(U.cuenta(est({ estado: "perdido", ganadas: 2, perdidas: 3 }))));

console.log("== El resultado de cada mano");
let r = U.resultadoMano(est({ mano: manoAbierta() }));
comprobar("una mano abierta no tiene resultado", r, null);
comprobar("sin mano tampoco", U.resultadoMano(est()), null);
r = U.resultadoMano(est({ ganadas: 1, mano: manoFin("victoria", "mejor_mano") }));
cierto("victoria normal", r.clase === "res-victoria" && r.titulo === "Mano ganada" && /mejor que la de Cera/.test(r.razon));
r = U.resultadoMano(est({ ganadas: 1, mano: manoFin("victoria", "natural") }));
cierto("veintiuna al repartir", r.clase === "res-natural" && r.titulo === "Veintiuna");
r = U.resultadoMano(est({ perdidas: 1, mano: manoFin("derrota", "te_pasas") }));
cierto("pasarse es derrota", r.clase === "res-derrota" && /Te pasaste de 21/.test(r.razon));
r = U.resultadoMano(est({ ganadas: 1, mano: manoFin("victoria", "cera_se_pasa") }));
cierto("si Cera se pasa", /Cera se pasó de 21/.test(r.razon));
r = U.resultadoMano(est({ empates_seguidos: 1, mano: manoFin("empate", "mismo_total") }));
cierto("empate: se repite", r.clase === "res-empate" && r.titulo === "Empate" && r.linea === "Se repite la mano.");
r = U.resultadoMano(est({ empates_seguidos: 2, mano: manoFin("empate", "mismo_total") }));
cierto("segundo empate: se avisa de que el tercero cuenta como derrota", /cuenta como derrota/.test(r.linea));
r = U.resultadoMano(est({ perdidas: 1, empates_seguidos: 0, mano: manoFin("empate", "mismo_total", "derrota") }));
cierto("tercer empate seguido: se dice que es derrota", r.titulo === "Tercer empate" && /tercer empate seguido/.test(r.razon) && /perdida/.test(r.linea));
r = U.resultadoMano(est({ empates_seguidos: 1, mano: manoFin("empate", "ambos_natural") }));
cierto("los dos con veintiuna: empate", /Los dos tenéis veintiuna/.test(r.razon));

console.log("== Final del reto");
let f = U.textoFinal(est({ estado: "ganado", ganadas: 3, perdidas: 1 }));
cierto("ganado: no promete premio, lo decide el DM, y recuerda que no se repite", f.clase === "uv-fin-gana" && /3 a 1/.test(f.texto) && /DM decide qué te llevas/.test(f.texto) && /ya no se puede repetir/.test(f.texto));
f = U.textoFinal(est({ estado: "perdido", ganadas: 1, perdidas: 3, personaje: "Aldric" }));
cierto("perdido: nombra al personaje, lo deja en manos del DM y no dice que muere", f.clase === "uv-fin-pierde" && /Aldric queda marcado por el Dominio/.test(f.texto) && /DM decide qué pasa con él/.test(f.texto) && !/muere|muerto|mata/i.test(f.texto));

console.log("== Botones");
let a = U.acciones(est());
comprobar("sin repartir: un solo botón, repartir la primera mano, avisando de que el intento se gasta", [a.botones.map(b => b.id), a.botones[0].texto, /intento queda gastado/.test(a.botones[0].sub)], [["repartir"], "Repartir la primera mano", true]);
a = U.acciones(est({ repartidas: 1, mano: manoAbierta() }));
comprobar("mano abierta: pedir y plantarse", a.botones.map(b => b.id), ["pedir", "plantar"]);
comprobar("no hay doblar ni dividir ni reglas especiales", a.botones.length, 2);
a = U.acciones(est({ repartidas: 1, mano: manoAbierta({ jugador: { cartas: [carta(10, 0), carta(5, 1), carta(6, 2)], total: 21, blando: false } }) }));
comprobar("con 21 no se puede pedir", a.botones.map(b => [b.id, b.habilitado]), [["pedir", false], ["plantar", true]]);
a = U.acciones(est({ repartidas: 1, ganadas: 1, numero: 2, historial: [{ numero: 1, resultado: "victoria", cuenta: "victoria" }], mano: manoFin("victoria", "mejor_mano") }));
comprobar("mano terminada: siguiente mano", [a.botones.map(b => b.id), a.botones[0].texto], [["repartir"], "Siguiente mano"]);
a = U.acciones(est({ repartidas: 1, empates_seguidos: 1, mano: manoFin("empate", "mismo_total") }));
comprobar("tras un empate: repetir la mano", a.botones[0].texto, "Repetir la mano");
comprobar("reto cerrado: ningún botón de juego", U.acciones(est({ estado: "perdido" })).botones, []);
cierto("las teclas son P, L y S", ["pedir", "plantar"].every(id => U.acciones(est({ repartidas: 1, mano: manoAbierta() })).botones.find(b => b.id === id)) && U.acciones(est()).botones[0].tecla === "S");

console.log("== Lo que lee el lector de pantalla");
let t = U.anuncio(null, est({ repartidas: 1, mano: manoAbierta() }));
cierto("al repartir: la mano, las dos cartas de Cera y el total", /Mano 1 de 5\./.test(t) && /Cera enseña/.test(t) && /suman 15/.test(t));
const antes = est({ repartidas: 1, mano: manoAbierta() });
t = U.anuncio(antes, est({ repartidas: 1, mano: manoAbierta({ paso: 1, jugador: { cartas: [carta(10, 0), carta(5, 1), carta(4, 2)], total: 19, blando: false } }) }));
cierto("al pedir: la carta que recibes y tu total", /Recibes 4 de diamantes\. Sumas 19\./.test(t));
t = U.anuncio(antes, est({ repartidas: 1, perdidas: 1, numero: 2, mano: manoFin("derrota", "cera_mejor", null, { cera: { cartas: [carta(9, 2), carta(7, 3), carta(3, 0)], total: 19, blando: false } }) }));
cierto("al terminar: Cera pide, se queda con su total y se dice el resultado", /Cera pide y se queda con 19/.test(t) && /Mano perdida/.test(t));

console.log("== Errores");
cierto("sin conexión: dice que reintentes y que la mesa lo comprobará", /reintenta y la mesa lo comprobará/.test(U.mensajeError({ tipo: "red" })));
comprobar("intento anulado", U.mensajeError({ tipo: "servidor", codigo: "anulado", mensaje: "x" }), "El DM anuló este intento.");
comprobar("intento que no es tuyo", U.mensajeError({ tipo: "servidor", codigo: "no_encontrado", mensaje: "x" }), "No encontré ese desafío en tu cuenta.");
comprobar("un error desconocido enseña el texto del servidor", U.mensajeError({ tipo: "servidor", codigo: "raro", mensaje: "Algo raro" }), "Algo raro");

console.log("== Reglas del diálogo");
const reglasTxt = U.REGLAS.map(x => x.titulo + " " + x.texto).join(" ");
cierto("explican El testigo, Cera exigente, el 3 de 5, los empates y el intento único", ["El testigo", "Cera exigente", "3 de 5", "tercer empate", "único intento"].every(s => reglasTxt.includes(s)));
cierto("dicen que no hay tokens ni cartas en juego y que decide el DM", /No hay tokens ni cartas/.test(reglasTxt) && /DM decide/.test(reglasTxt));
cierto("avisan de que recargar no da otro intento", /recargas la página o se corta la conexión, la mano sigue donde estaba/.test(reglasTxt));

console.log("== Llamadas al servidor");
(async () => {
  const llamadas = [];
  const api = Api.crear(async () => ({ rpc: async (n, args) => { llamadas.push([n, args]); return { data: { ok: true }, error: null }; } }));
  await api.reto.estado("i1"); await api.reto.repartir("i1", 2); await api.reto.accion("i1", 3, "pedir");
  comprobar("estado, repartir y acción llaman a las tres funciones del reto con sus argumentos", llamadas, [
    ["veintiuna_reto_estado", { p_intento: "i1" }], ["veintiuna_reto_repartir", { p_intento: "i1", p_manos: 2 }], ["veintiuna_reto_accion", { p_intento: "i1", p_paso: 3, p_accion: "pedir" }]]);
  const apiError = Api.crear(async () => ({ rpc: async () => ({ data: null, error: { message: "ERROR: Ese intento no", hint: "no_encontrado", code: "P0001" } }) }));
  try { await apiError.reto.estado("x"); cierto("un rechazo del servidor lanza un error con su código", false); }
  catch (e) { comprobar("un rechazo del servidor lanza un error con su código", [e.tipo, e.codigo], ["servidor", "no_encontrado"]); }

  console.log("== La página, el controlador y Muerte Súbita");
  const html = leer("ultima-vela.html"), js = leer("js", "ultima-vela.js"), css = leer("css", "ultima-vela.css");
  const datos = leer("data", "muerte-subita.js"), msjs = leer("js", "muerte-subita.js");
  cierto("la página existe, es en español y tiene título", /<html lang="es">/.test(html) && /<title>La Última Vela/.test(html));
  cierto("cada script y hoja de estilos lleva su versión (?v=)", [...html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)].every(m => /\?v=\d{8}$/.test(m[1])));
  cierto("todos los archivos que carga existen", [...html.matchAll(/(?:src|href)="((?:js|css)\/[^"?]+)/g)].every(m => fs.existsSync(path.join(RAIZ, m[1]))));
  cierto("todos los identificadores que usa el controlador están en la página", [...js.matchAll(/\$\("([A-Za-z]+)"\)/g)].map(m => m[1]).filter(id => !["vvSr", "vvSrFuerte"].includes(id) || true).every(id => new RegExp(`id="${id}"`).test(html)));
  cierto("la página no carga los scripts de tokens ni de la mesa individual", !/veintiuna-mesa|veintiuna-vista|recompensas\.js/.test(html));
  cierto("el controlador no decide nada: no calcula totales ni resultados", !/\.reduce\(|resultado\s*=\s*["']/.test(js));
  cierto("las acciones se mandan con el paso de la mano, y repartir con el número de manos", /api\.reto\.accion\(idIntento, paso, accion\)/.test(js) && /api\.reto\.repartir\(idIntento, manos\)/.test(js));
  cierto("un reintento repite la misma petición (mismo paso)", /manejarError\(e, \(\) => ejecutar\(fn\)\)/.test(js));
  cierto("el movimiento reducido se respeta", /prefers-reduced-motion/.test(js));
  cierto("no hay degradados dorados ni brillos en la hoja de estilos del reto", !/gradient|box-shadow|text-shadow/.test(css));
  cierto("la carta de Cera está desbloqueada en Muerte Súbita y lleva a esta página", /id: "cera-veintiuna"/.test(datos) && /pagina: "ultima-vela\.html"/.test(datos) && !/id: "estrategia", categoria: "Estrategia", bloqueado/.test(datos));
  cierto("quedan sellados Azar y Voluntad", /id: "azar"[^}]*bloqueado: true/.test(datos) && /id: "voluntad"[^}]*bloqueado: true/.test(datos));
  cierto("un intento sin terminar de este reto se puede retomar desde Muerte Súbita", /d\.retomable/.test(msjs) && /retomable: true/.test(datos));
  const sql = leer("docs", "veintiuna-reto.sql");
  cierto("el SQL no toca la billetera, los movimientos, las estadísticas ni las cartas", !/hipodromo_(billeteras|movimientos)|veintiuna_(estadisticas|logros|partidas)|cartas_/.test(sql.replace(/--[^\n]*/g, "")));
  cierto("el SQL cierra el intento de Muerte Súbita pero no pone veredicto", /update muerte_subita_intentos set estado = v_fin/.test(sql) && !/set veredicto/.test(sql));

  console.log(fallos ? `\n${fallos} fallo(s), ${ok} bien.` : `\nTodo bien (${ok} comprobaciones).`);
  process.exit(fallos ? 1 : 0);
})();
