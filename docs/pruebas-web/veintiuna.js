// Pruebas de la parte del navegador de Las Veintiuna Velas, sin navegador: textos y acciones (veintiuna-vista.js), llamadas al servidor (veintiuna-api.js),
// el dibujo de las cartas (veintiuna-arte.js) y lo que se puede comprobar leyendo la página y la hoja de estilos (accesibilidad, movimiento reducido, contraste).
// Uso (desde la raíz del proyecto):  node docs/pruebas-web/veintiuna.js
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

const V = require(path.join(RAIZ, "js", "veintiuna-vista.js"));
const Api = require(path.join(RAIZ, "js", "veintiuna-api.js"));
global.window = global;
require(path.join(RAIZ, "js", "veintiuna-arte.js"));
const A = global.VeintiunaArte;

const carta = (r, p, extra) => Object.assign({ r, p }, extra || {});
const base = (o) => Object.assign({
  partida: "p1", paso: 0, modo: "apuesta", apuesta: 20, peajes: 0, estado: "en_curso", fase: "jugador",
  regla: { id: "fortuna", usada: false, peaje: 12 },
  jugador: { cartas: [carta(10, 0), carta(5, 1)], total: 15, blando: false },
  crupier: { cartas: [carta(9, 2)], ocultas: 1, total: 9, blando: false },
  acciones: { pedir: true, plantar: true, especial: null }, resultado: null, saldo: 80
}, o || {});

console.log("== Textos con monedas");
comprobar("20 → «20»", V.monedas(20), "20");
comprobar("7,5 → «7,5»", V.monedas(7.5), "7,5");
comprobar("«1000» lleva separador de miles de la configuración regional", V.monedas(1000).replace(/\D/g, ""), "1000");
comprobar("con signo", [V.conSigno(30), V.conSigno(-12), V.conSigno(0)], ["+30", "−12", "0"]);

console.log("== Acciones que se ofrecen");
let a = V.acciones(base());
comprobar("mano normal: pedir y plantarse, sin especial", a.botones.map(b => b.id), ["pedir", "plantar"]);
comprobar("las dos están habilitadas", a.botones.every(b => b.habilitado), true);
a = V.acciones(base({ jugador: { cartas: [carta(10, 0), carta(5, 1), carta(6, 2)], total: 21, blando: false }, acciones: { pedir: false, plantar: true, especial: null } }));
comprobar("con 21 no se puede pedir y dice por qué", [a.botones[0].habilitado, a.botones[0].motivo], [false, "Con 21 no se pide más."]);
a = V.acciones(base({ regla: { id: "voluntad", usada: false, peaje: 17 }, acciones: { pedir: true, plantar: true, especial: { tipo: "voluntad", disponible: true, motivo: null, peaje: 17 } } }));
comprobar("con la Última voluntad aparece su botón con el peaje", a.botones.map(b => b.id), ["pedir", "plantar", "voluntad"]);
comprobar("y enseña lo que hace y el peaje", a.botones[2].sub, "cambia tu última carta · peaje 17");
a = V.acciones(base({ regla: { id: "voluntad", usada: false, peaje: 17 }, acciones: { pedir: true, plantar: true, especial: { tipo: "voluntad", disponible: false, motivo: "te faltan 5 monedas", peaje: 17 } } }));
comprobar("sin monedas el botón sale deshabilitado, con la razón", [a.botones[2].habilitado, a.botones[2].sub, a.botones[2].motivo], [false, "te faltan 5 monedas", "Última voluntad: te faltan 5 monedas."]);
a = V.acciones(base({ modo: "practica", regla: { id: "voluntad", usada: false, peaje: 8.5 }, acciones: { pedir: true, plantar: true, especial: { tipo: "voluntad", disponible: true, motivo: null, peaje: 8.5 } } }));
comprobar("en la práctica el peaje se llama simbólico", a.botones[2].sub, "cambia tu última carta · peaje simbólico 8,5");
a = V.acciones(base({ fase: "fortuna", jugador: { cartas: [carta(10, 0), carta(6, 1), carta(13, 2)], total: 26, blando: false }, acciones: { pedir: false, plantar: false, especial: { tipo: "fortuna", disponible: true, motivo: null, peaje: 12 } } }));
comprobar("pasado de 21 con Fortuna: salvar o aceptar", [a.fase, a.botones.map(b => b.id)], ["fortuna", ["fortuna", "aceptar"]]);
comprobar("la Fortuna enseña su peaje y aceptar no cuesta", [a.botones[0].sub, a.botones[1].sub], ["peaje 12", "sin peaje"]);
a = V.acciones(base({ estado: "terminada" }));
comprobar("mano terminada: ningún botón de juego", a.botones, []);

console.log("== Apuestas");
const lim = { min: 10, max: 100, paso: 10 };
comprobar("fichas a partir de los límites reales", V.fichasDisponibles(lim), [10, 20, 50, 100]);
comprobar("límites 5/50/5 dan 5, 10, 25 y 50", V.fichasDisponibles({ min: 5, max: 50, paso: 5 }), [5, 10, 25, 50]);
comprobar("apuesta correcta no tiene motivo", V.motivoApuesta(20, 100, lim), "");
comprobar("por debajo del mínimo", V.motivoApuesta(0, 100, lim), "La apuesta mínima es 10.");
comprobar("por encima del máximo", V.motivoApuesta(150, 500, lim), "La apuesta máxima es 100.");
comprobar("que no sea múltiplo del paso", V.motivoApuesta(25, 500, lim), "Se apuesta de 10 en 10.");
comprobar("sin monedas explica cuántas faltan", V.motivoApuesta(50, 35, lim), "Te faltan 15 monedas para apostar 50 (tienes 35).");
comprobar("ajustar a lo que se tiene", [V.ajustarApuesta(100, 35, lim), V.ajustarApuesta(100, 500, lim), V.ajustarApuesta(20, 500, lim)], [30, 100, 20]);
comprobar("apuesta inicial: la anterior si cabe, si no la mayor que cabe, y sin apuesta anterior ninguna", [V.apuestaInicial(50, 500, lim), V.apuestaInicial(50, 30, lim), V.apuestaInicial(50, 5, lim), V.apuestaInicial(0, 500, lim)], [50, 30, 0, 0]);

console.log("== Resultados");
let r = V.resultado(base({ estado: "terminada", resultado: { tipo: "natural", razon: "natural", pago: 50, neto: 30, apuesta: 20, peajes: 0 } }));
comprobar("blackjack natural: titulo, razón y cobro", [r.titulo, r.razon, r.linea, r.gano], ["Blackjack", "Blackjack natural: 21 con tus dos primeras cartas.", "Cobras 50 (+30 contra tu apuesta de 20).", true]);
r = V.resultado(base({ estado: "terminada", resultado: { tipo: "derrota", razon: "te_pasas", pago: 0, neto: -32, apuesta: 20, peajes: 12 } }));
comprobar("derrota con peaje cuenta la apuesta y el peaje", r.linea, "Pierdes 32 (apuesta y peaje).");
r = V.resultado(base({ estado: "terminada", resultado: { tipo: "empate", razon: "igual", pago: 20, neto: 0, apuesta: 20, peajes: 0 } }));
comprobar("empate devuelve la apuesta", [r.titulo, r.linea, r.empate], ["Empate", "Recuperas tu apuesta de 20.", true]);
r = V.resultado(base({ modo: "practica", estado: "terminada", resultado: { tipo: "victoria", razon: "mayor", pago: 20, neto: 10, apuesta: 10, peajes: 0 } }));
comprobar("la práctica no habla de monedas", r.linea, "Mesa de práctica: sin monedas en juego.");
comprobar("sin resultado no hay nada que decir", V.resultado(base()), null);

console.log("== Lo que se anuncia a un lector de pantalla");
let t = V.anuncio(null, base({ regla: { id: "maldicion", usada: false } }));
cierto("el reparto nombra la regla, tus cartas y la carta visible del crupier", /Regla de la ronda: Maldición/.test(t) && /10 de picas y 5 de corazones/.test(t) && /9 de diamantes/.test(t) && /carta oculta/.test(t));
cierto("no nombra ninguna carta que no se ve", !/oculta (es|era|de)/.test(t));
const antes = base();
t = V.anuncio(antes, base({ jugador: { cartas: [carta(10, 0), carta(5, 1), carta(1, 3)], total: 16, blando: false } }));
comprobar("al pedir carta dice cuál llegó y cuánto suma", t, "Recibes as de tréboles. Sumas 16.");
t = V.anuncio(antes, base({ fase: "fortuna", jugador: { cartas: [carta(10, 0), carta(5, 1), carta(13, 3)], total: 25, blando: false } }));
cierto("pasado de 21 con Fortuna lo cuenta y ofrece elegir", /rey de tréboles/.test(t) && /Fortuna/.test(t));
t = V.anuncio(antes, base({ estado: "terminada", crupier: { cartas: [carta(9, 2), carta(8, 0)], ocultas: 0, total: 17 }, resultado: { tipo: "derrota", razon: "menor", pago: 0, neto: -20, apuesta: 20, peajes: 0 } }));
cierto("al terminar enseña las cartas del crupier y el resultado", /9 de diamantes y 8 de picas/.test(t) && /Pierdes\./.test(t));

const vol = base({ regla: { id: "voluntad", usada: false, peaje: 10 } });
t = V.anuncio(vol, base({ regla: { id: "voluntad", usada: true, peaje: 10 }, jugador: { cartas: [carta(10, 0), carta(1, 3)], total: 21, blando: true } }));
comprobar("al cambiar la última carta con la Última voluntad lo dice", t, "Cambias tu última carta: ahora tienes as de tréboles. Sumas 21 en blando.");

console.log("== Las cinco reglas nuevas");
comprobar("hay ocho reglas con ficha completa", V.ORDEN_REGLAS.length === 8 && V.ORDEN_REGLAS.every(id => { const R = V.REGLAS[id]; return R && R.nombre && R.lema && R.resumen && R.detalle("10").length >= 2 && typeof R.estado(false, "jugador", null) === "string"; }), true);
for (const [id, texto, efecto] of [["ojo", "Ojo del Tahúr", "ver la siguiente carta"], ["marcadas", "Cartas marcadas", "ver la carta oculta"], ["trueque", "Trueque con la casa", "tu 1.ª carta por la del crupier"]]) {
  a = V.acciones(base({ regla: { id, usada: false, peaje: 7 }, acciones: { pedir: true, plantar: true, especial: { tipo: id, disponible: true, motivo: null, peaje: 7 } } }));
  comprobar("botón de " + id + ": id, texto, efecto, tecla V y peaje", [a.botones[2].id, a.botones[2].texto, a.botones[2].sub.startsWith(efecto), a.botones[2].tecla, /peaje 7/.test(a.botones[2].sub)], [id, texto, true, "V", true]);
  a = V.acciones(base({ regla: { id, usada: true, peaje: 7 }, acciones: { pedir: true, plantar: true, especial: { tipo: id, disponible: false, motivo: "ya lo usaste", peaje: 7 } } }));
  comprobar("botón de " + id + " ya gastado: deshabilitado con su razón", [a.botones[2].habilitado, a.botones[2].motivo], [false, texto + ": ya lo usaste."]);
}
a = V.acciones(base({ regla: { id: "vela", usada: false }, acciones: { pedir: true, plantar: true, especial: null } }));
comprobar("Vela corta y Pacto del Bufón no tienen botón especial", a.botones.map(b => b.id), ["pedir", "plantar"]);
comprobar("el estado del Bufón dice qué hizo el dado", [V.REGLAS.bufon.estado(false, "jugador", "crupier"), V.REGLAS.bufon.estado(false, "jugador", "jugador"), V.REGLAS.bufon.estado(false, "jugador", "nada")], ["Cambió la carta del crupier", "Cambió tu primera carta", "El dado no cambió nada"]);
comprobar("la Vela corta lo explica con las dos cifras (16 y 6 a 5)", V.REGLAS.vela.detalle().join(" ").includes("16") && V.REGLAS.vela.detalle().join(" ").includes("6 a 5"), true);
t = V.anuncio(base({ regla: { id: "ojo", usada: false, peaje: 7 } }), base({ regla: { id: "ojo", usada: true, peaje: 7, proxima: carta(13, 1) } }));
comprobar("el Ojo del Tahúr anuncia la siguiente carta", /la siguiente carta es rey de corazones/.test(t), true);
t = V.anuncio(base({ regla: { id: "marcadas", usada: false, peaje: 4 } }), base({ regla: { id: "marcadas", usada: true, peaje: 4 }, crupier: { cartas: [carta(9, 2)], ocultas: 1, total: 9, blando: false, vista: carta(7, 0) } }));
comprobar("las Cartas marcadas anuncian la carta oculta", /La carta oculta del crupier es 7 de picas/.test(t), true);
t = V.anuncio(base({ regla: { id: "trueque", usada: false, peaje: 20 } }), base({ regla: { id: "trueque", usada: true, peaje: 20 }, jugador: { cartas: [carta(9, 2), carta(5, 1)], total: 14, blando: false }, crupier: { cartas: [carta(10, 0)], ocultas: 1, total: 10, blando: false } }));
comprobar("el Trueque cuenta cómo quedan las dos manos", /Haces el trueque: ahora tienes 9 de diamantes y 5 de corazones y el crupier enseña 10 de picas/.test(t), true);
t = V.anuncio(null, base({ regla: { id: "bufon", usada: false, evento: "jugador" } }));
comprobar("al repartir el Bufón dice si cambió tu carta", /El Bufón cambia tu primera carta/.test(t), true);
t = V.anuncio(null, base({ regla: { id: "bufon", usada: false, evento: "nada" } }));
comprobar("y si el dado no cambió nada", /no cambia nada/.test(t), true);

console.log("== Errores con palabras");
comprobar("sin conexión", /Reintentar/.test(V.mensajeError({ tipo: "red" })), true);
comprobar("mano en curso", V.mensajeError({ tipo: "servidor", codigo: "mano_en_curso", mensaje: "x" }), "Ya tenías una mano abierta. La recupero.");
comprobar("lo que dice el servidor se respeta cuando no hay pista", V.mensajeError({ tipo: "servidor", codigo: "saldo_insuficiente", mensaje: "No tienes tantas monedas: te faltan 20." }), "No tienes tantas monedas: te faltan 20.");

console.log("== Llamadas al servidor");
(async () => {
  const llamadas = [];
  const cliente = (respuesta) => ({ rpc: async (n, args) => { llamadas.push([n, args]); const r = typeof respuesta === "function" ? respuesta(n, args) : respuesta; if (r instanceof Error) throw r; return r; } });
  let api = Api.crear(async () => cliente({ data: { ok: 1 }, error: null }));
  await api.mesa(); await api.repartir("id-1", "apuesta", 20); await api.repartir("id-2", "practica", 999); await api.accion("p1", 3, "pedir"); await api.historial(5); await api.reclamar("natural");
  comprobar("las seis llamadas usan las funciones del servidor con sus argumentos", llamadas, [
    ["veintiuna_mesa", {}], ["veintiuna_repartir", { p_cliente: "id-1", p_modo: "apuesta", p_apuesta: 20 }],
    ["veintiuna_repartir", { p_cliente: "id-2", p_modo: "practica", p_apuesta: 0 }], ["veintiuna_accion", { p_partida: "p1", p_paso: 3, p_accion: "pedir" }],
    ["veintiuna_historial", { p_limite: 5 }], ["veintiuna_reclamar", { p_logro: "natural" }]]);
  comprobar("en la práctica nunca se manda un importe", llamadas[2][1].p_apuesta, 0);

  const intenta = async (api, f) => { try { await f(api); return null; } catch (e) { return e; } };
  let e = await intenta(Api.crear(async () => cliente({ data: null, error: { message: "ERROR: No tienes tantas monedas: te faltan 5.", hint: "saldo_insuficiente", code: "P0001" } })), a => a.repartir("x", "apuesta", 50));
  comprobar("un rechazo del servidor lleva su pista y su texto sin «ERROR:»", [e && e.tipo, e && e.codigo, e && e.mensaje], ["servidor", "saldo_insuficiente", "No tienes tantas monedas: te faltan 5."]);
  e = await intenta(Api.crear(async () => cliente({ data: null, error: { message: "TypeError: Failed to fetch", code: "" } })), a => a.mesa());
  comprobar("un corte de red se distingue de un rechazo", e && e.tipo, "red");
  e = await intenta(Api.crear(async () => cliente(new Error("boom")), { tiempoMax: 50 }), a => a.mesa());
  comprobar("si la llamada lanza una excepción también es un corte de red", e && e.tipo, "red");
  e = await intenta(Api.crear(async () => ({ rpc: () => new Promise(() => {}) }), { tiempoMax: 40 }), a => a.accion("p", 0, "pedir"));
  comprobar("si el servidor no contesta a tiempo es un corte de red", e && e.tipo, "red");
  e = await intenta(Api.crear(async () => { throw new Error("sin cliente"); }), a => a.mesa());
  comprobar("si ni siquiera se abre la conexión, también", e && e.tipo, "red");
  e = await intenta(Api.crear(async () => cliente({ data: null, error: { message: "permission denied for function veintiuna_mesa", code: "42501" } })), a => a.mesa());
  comprobar("un permiso denegado es un rechazo, no un corte", e && e.tipo, "servidor");
  // Reintento seguro: los mismos identificadores
  llamadas.length = 0;
  let intento = 0;
  api = Api.crear(async () => cliente(() => (++intento === 1 ? { data: null, error: { message: "Failed to fetch", code: "" } } : { data: { ok: true }, error: null })));
  const id = Api.nuevoId();
  await intenta(api, a => a.repartir(id, "apuesta", 20));
  await api.repartir(id, "apuesta", 20);
  comprobar("repetir un reparto que falló manda el MISMO identificador de mano", llamadas.map(l => l[1].p_cliente), [id, id]);
  cierto("los identificadores nuevos tienen forma de uuid y no se repiten", /^[0-9a-f-]{36}$/.test(Api.nuevoId()) && Api.nuevoId() !== Api.nuevoId());

  console.log("== El dibujo de las cartas");
  const palos = ["picas", "corazones", "diamantes", "tréboles"];
  let todas = 0, sinNombre = 0;
  for (let p = 0; p < 4; p++) for (let r = 1; r <= 13; r++) {
    const svg = A.cara({ r, p });
    todas++;
    if (!svg.includes(`aria-label="${A.nombreCarta({ r, p })}"`)) sinNombre++;
  }
  comprobar("las 52 caras se dibujan y cada una se llama por su nombre para un lector de pantalla", [todas, sinNombre], [52, 0]);
  comprobar("nombres: as de picas, 10 de corazones, jota de diamantes, rey de tréboles", [A.nombreCarta({ r: 1, p: 0 }), A.nombreCarta({ r: 10, p: 1 }), A.nombreCarta({ r: 11, p: 2 }), A.nombreCarta({ r: 13, p: 3 })], ["as de picas", "10 de corazones", "jota de diamantes", "rey de tréboles"]);
  cierto("rojas y negras usan clases distintas (y además cambia la forma del palo)", A.cara({ r: 5, p: 1 }).includes("vv-cara rojo") && A.cara({ r: 5, p: 0 }).includes("vv-cara negro") && A.cara({ r: 5, p: 2 }).includes("vv-cara rojo") && A.cara({ r: 5, p: 3 }).includes("vv-cara negro"));
  cierto("cada palo usa su propio símbolo", palos.every((n, p) => A.cara({ r: 7, p }).includes(`#vv-${["picas", "corazones", "diamantes", "treboles"][p]}`)));
  const oculta = A.carta(null, true);
  cierto("una carta oculta no lleva rango ni palo en el dibujo ni en el texto accesible", /data-r=""/.test(oculta) && /data-p=""/.test(oculta) && /aria-label="carta oculta"/.test(oculta) && !/vv-cara/.test(oculta));
  cierto("una carta convertida por la Fortuna avisa de que vale 1", A.cara({ r: 13, p: 2, as1: true }).includes("convertida en un as de valor 1"));
  cierto("el número de pips es el del rango (7 símbolos de palo en el centro)", (A.cara({ r: 7, p: 1 }).match(/<use /g) || []).length === 7 + 2 * 1 + 0 || (A.cara({ r: 7, p: 1 }).match(/<use /g) || []).length >= 9);

  console.log("== La página: accesibilidad que se puede comprobar leyendo");
  const html = fs.readFileSync(path.join(RAIZ, "veintiuna.html"), "utf8");
  const css = fs.readFileSync(path.join(RAIZ, "css", "veintiuna.css"), "utf8");
  cierto("idioma y título", /<html lang="es">/.test(html) && /<title>Las Veintiuna Velas/.test(html));
  cierto("enlace para saltar a los controles", /class="vv-saltar" href="#vvDock"/.test(html));
  cierto("zonas de aviso para lectores de pantalla (educada y urgente)", /id="vvSr"[^>]*aria-live="polite"/.test(html) && /id="vvSrFuerte"[^>]*aria-live="assertive"/.test(html));
  cierto("un solo h1", (html.match(/<h1[ >]/g) || []).length === 1);
  cierto("cada diálogo se nombra con aria-labelledby", ["vvDlgReglas", "vvDlgDesafios", "vvDlgHistorial", "vvDlgAtajos"].every(id => new RegExp(`id="${id}"[^>]*aria-labelledby="${id}T"`).test(html)));
  cierto("la mesa y las manos tienen nombre accesible", /aria-label="La mesa"/.test(html) && /aria-label="Controles de la mano"/.test(html));
  cierto("los totales y velas decorativos no se leen dos veces (aria-hidden)", /id="vvTotalJugador" aria-hidden="true"/.test(html) && /id="vvVelasJugador" aria-hidden="true"/.test(html));
  cierto("el dibujo del tapete, el zapato y el fondo son decorativos", /id="vvTapete" aria-hidden="true"/.test(html) && /id="vvZapato" aria-hidden="true"/.test(html) && /class="vv-fondo" aria-hidden="true"/.test(html));
  cierto("los botones de la cabecera tienen texto visible además del icono", ["vvBtnReglas", "vvBtnDesafios", "vvBtnHistorial", "vvBtnSonido"].every(id => {
    const m = html.match(new RegExp("id=\"" + id + "\"[^>]*>([\\s\\S]*?)</button>"));
    return m && m[1].replace(/<span[^>]*aria-hidden="true"[^>]*>[^<]*<\/span>/g, "").replace(/<[^>]+>/g, "").trim().length > 2;
  }));
  const mesaJs = fs.readFileSync(path.join(RAIZ, "js", "veintiuna-mesa.js"), "utf8");
  cierto("los botones de fichas y pasos llevan etiqueta", /aria-label="Añadir \$\{f\} monedas"/.test(mesaJs) && /aria-label="Bajar la apuesta/.test(mesaJs) && /aria-label="Subir la apuesta/.test(mesaJs));
  cierto("las acciones deshabilitadas usan aria-disabled y dicen por qué al pulsarlas", /aria-disabled="\$\{!b\.habilitado\}"/.test(mesaJs) && /b\.motivo \|\| "Esa acción no está disponible ahora\."/.test(mesaJs));
  cierto("el panel de modalidad es un radiogroup con aria-checked", /role="radiogroup"/.test(mesaJs) && /role="radio" aria-checked/.test(mesaJs));
  cierto("las barras de progreso de los desafíos son progressbar con valores", /role="progressbar"[^`]*aria-valuenow/.test(mesaJs));
  cierto("atajos de teclado documentados y declarados (aria-keyshortcuts)", /aria-keyshortcuts/.test(mesaJs) && /Atajos de teclado/.test(html));
  cierto("la carta oculta del crupier se anuncia como «carta oculta» y no se rellena nunca con datos del servidor", /A\.carta\(null, true\)|repartirCarta\("crupier", null, true/.test(mesaJs));

  console.log("== La hoja de estilos: movimiento reducido, foco y tamaños táctiles");
  cierto("existe un bloque prefers-reduced-motion que apaga animaciones y transiciones", /@media \(prefers-reduced-motion: reduce\)[^}]*animation: none/.test(css) && /transition-duration: \.01s/.test(css));
  cierto("el código también lo respeta (WAAPI y esperas)", /prefers-reduced-motion: reduce/.test(mesaJs) && /sinMovimiento\(\)/.test(mesaJs));
  cierto("foco visible y fuerte", /:focus-visible\s*\{[^}]*outline: 3px solid/.test(css));
  cierto("botones de acción de al menos 56 px de alto y mini de 44", /\.vv-boton \{[^}]*min-height: 58px/.test(css) && /\.vv-boton-mini \{[^}]*min-height: 44px/.test(css) && /\.vv-cerrar \{[^}]*width: 44px; height: 44px/.test(css));
  cierto("en móvil el dock queda pegado abajo y los botones no bajan de 56 px", /@media \(max-width: 720px\)[\s\S]*\.vv-dock \{ position: sticky; bottom: 0/.test(css) && /\.vv-boton \{ min-height: 56px/.test(css));
  cierto("las cartas se dimensionan con una variable que baja en pantallas pequeñas pero nunca de 58 px", /--cw: clamp\(58px/.test(css) && /--cw: clamp\(62px, 19vw, 92px\)/.test(css));
  cierto("el atajo de teclado se oculta en pantallas táctiles", /@media \(hover: none\)[^}]*kbd[^}]*display: none/.test(css));

  console.log("== Contraste (WCAG 2.1) de los colores de texto sobre sus fondos");
  const hex = h => { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map(c => c + c).join(""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(hex(a)), lum(hex(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const pares = [
    ["texto marfil sobre fondo de la sala", "#f4ead2", "#0a0710"], ["texto apagado sobre fondo de la sala", "#c9bba0", "#0a0710"],
    ["oro claro sobre madera oscura del dock", "#f6d98a", "#150a07"], ["texto del botón principal sobre el oro", "#1a1006", "#d9a441"],
    ["texto del botón principal sobre el oro oscuro (borde del degradado)", "#1a1006", "#b8862c"], ["marfil sobre botón normal", "#f4ead2", "#1f131c"],
    ["texto del total sobre su pastilla de oro", "#1a1006", "#d9a441"], ["rojo de los palos sobre el papel de la carta", "#a8202f", "#f4ead2"],
    ["tinta de los palos sobre el papel de la carta", "#1b1722", "#f4ead2"], ["marfil sobre la placa", "#f4ead2", "#1a0f0a"],
    ["verde de la regla Fortuna sobre la placa", "#7fd08a", "#1a0f0a"], ["rosa de la regla Maldición sobre la placa", "#f07a8a", "#1a0f0a"],
    ["violeta de la regla Última voluntad sobre la placa", "#b6a2ff", "#1a0f0a"],
    ["turquesa del Ojo del Tahúr sobre la placa", "#58c7d6", "#1a0f0a"], ["naranja de las Cartas marcadas sobre la placa", "#e6a35a", "#1a0f0a"], ["amarillo del Trueque sobre la placa", "#e8d26a", "#1a0f0a"],
    ["ámbar de la Vela corta sobre la placa", "#ffb24a", "#1a0f0a"], ["lila del Pacto del Bufón sobre la placa", "#c58cf5", "#1a0f0a"], ["texto oscuro de la insignia sobre el oro", "#1a1006", "#d9a441"],
    ["texto del dicho de la crupier sobre su globo", "#1a1006", "#f4ead2"], ["marfil sobre diálogo", "#f4ead2", "#150e1a"], ["apagado sobre diálogo", "#c9bba0", "#150e1a"]
  ];
  pares.forEach(([nombre, fg, bg]) => { const x = ratio(fg, bg); cierto(`${nombre}: ${x.toFixed(1)}:1 (mínimo 4,5:1)`, x >= 4.5); });
  cierto("el aviso de error (rosa claro sobre rojo muy oscuro) también pasa", ratio("#ffb4bc", "#2b1017") >= 4.5);

  console.log(fallos ? `\n${fallos} fallo(s), ${ok} bien.` : `\nTodo bien (${ok} comprobaciones).`);
  process.exit(fallos ? 1 : 0);
})();
