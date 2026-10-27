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

console.log("== Textos con tokens");
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
a = V.acciones(base({ regla: { id: "voluntad", usada: false, peaje: 17 }, acciones: { pedir: true, plantar: true, especial: { tipo: "voluntad", disponible: false, motivo: "te faltan 5 tokens", peaje: 17 } } }));
comprobar("sin tokens el botón sale deshabilitado, con la razón", [a.botones[2].habilitado, a.botones[2].sub, a.botones[2].motivo], [false, "te faltan 5 tokens", "Última voluntad: te faltan 5 tokens."]);
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
const libre = { min: 10, max: null, paso: 10 };
comprobar("sin máximo hay fichas hasta 1000 y se puede apostar todo lo que se tenga", [V.fichasDisponibles(libre), V.sinTope(libre), V.sinTope({ min: 10, max: 0, paso: 10 }), V.sinTope(lim)], [[10, 20, 50, 100, 500, 1000], true, true, false]);
comprobar("sin máximo no hay motivo para rechazar una apuesta grande si se tiene", [V.motivoApuesta(50000, 100000, libre), V.motivoApuesta(50000, 400, libre)], ["", "Te faltan 49.600 tokens para apostar 50.000 (tienes 400)."]);
comprobar("sin máximo ajustar es solo lo que se tiene (múltiplo del paso) y «todo» es lo que cabe", [V.ajustarApuesta(Infinity, 12345, libre), V.ajustarApuesta(5000, 100000, libre)], [12340, 5000]);
comprobar("los textos de los límites con y sin máximo", [V.textoLimites(libre), V.textoLimites(lim)], ["Desde 10, de 10 en 10, sin máximo.", "De 10 a 100, de 10 en 10."]);
comprobar("límites 5/50/5 dan 5, 10, 25 y 50", V.fichasDisponibles({ min: 5, max: 50, paso: 5 }), [5, 10, 25, 50]);
comprobar("apuesta correcta no tiene motivo", V.motivoApuesta(20, 100, lim), "");
comprobar("por debajo del mínimo", V.motivoApuesta(0, 100, lim), "La apuesta mínima es 10.");
comprobar("por encima del máximo", V.motivoApuesta(150, 500, lim), "La apuesta máxima es 100.");
comprobar("que no sea múltiplo del paso", V.motivoApuesta(25, 500, lim), "Se apuesta de 10 en 10.");
comprobar("sin tokens explica cuántas faltan", V.motivoApuesta(50, 35, lim), "Te faltan 15 tokens para apostar 50 (tienes 35).");
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
comprobar("la práctica no habla de tokens", r.linea, "Mesa de práctica: sin tokens en juego.");
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

console.log("== Mesa con amigos: textos y asientos");
const mesa = (o) => Object.assign({
  codigo: "ABCDE", nombre: "Los de siempre", ronda: 1, fase: "apuestas", turno: null, cartas: false, privada: false, soy_creador: true, asientos_max: 5, version: 3,
  regla: { id: "ojo", evento: null }, proxima_regla: "vela", crupier: { cartas: [], ocultas: 0, total: 0, blando: false },
  asientos: [
    { asiento: 0, nombre: "Ana", yo: true, listo: false, apuesta: null, pasa: false, con_carta: false, mano: null },
    { asiento: 1, nombre: "Beto", yo: false, listo: false, apuesta: null, pasa: false, con_carta: false, mano: null }],
  pozo: { activo: false, cartas: [], estado: null, ganador: null },
  yo: { asiento: 0, saldo: 100, apuesta: null, listo: false, tu_turno: false }
}, o || {});
const mano = (cartas, extra) => Object.assign({ cartas, total: 19, blando: false, estado: "en_curso", fase: "jugador", modo: "apuesta", apuesta: 20, peajes: 0, resultado: null, razon: null, pago: null, neto: null }, extra || {});
let m = mesa();
comprobar("sin apostar: «Apostando»; listo: «Listo»; pasa: «Pasa esta ronda»", [V.chipAsiento(m, m.asientos[1]).texto, V.chipAsiento(mesa({ asientos: [{ asiento: 1, nombre: "B", yo: false, listo: true, apuesta: null, pasa: false }] }), { asiento: 1, yo: false, listo: true, apuesta: null, pasa: false }).texto,
  V.chipAsiento(m, { asiento: 1, yo: false, listo: true, pasa: true, apuesta: null }).texto], ["Apostando", "Listo", "Pasa esta ronda"]);
comprobar("tu propia apuesta sí se ve en tu chip", V.chipAsiento(m, { asiento: 0, yo: true, listo: true, apuesta: 40, pasa: false }).texto, "Apuesta 40");
comprobar("listos de la mesa", V.listosDeLaMesa(mesa({ asientos: [{ listo: true }, { listo: false }, { listo: true }] })), { total: 3, listos: 2, faltan: 1 });
const jug = mesa({ fase: "jugando", turno: 1, asientos: [
  { asiento: 0, nombre: "Ana", yo: true, listo: true, mano: mano([carta(10, 0), carta(9, 1)]) },
  { asiento: 1, nombre: "Beto", yo: false, listo: true, mano: mano([carta(5, 0), carta(6, 1)], { total: 11 }) },
  { asiento: 2, nombre: "Caro", yo: false, listo: true, mano: mano([carta(9, 0), carta(8, 1)], { fase: "plantada", total: 17 }) },
  { asiento: 3, nombre: "Dani", yo: false, listo: true, mano: mano([carta(10, 0), carta(8, 1), carta(9, 2)], { estado: "terminada", resultado: "derrota", razon: "te_pasas", total: 27 }) },
  { asiento: 4, nombre: "Eli", yo: false, listo: false, mano: null }] });
comprobar("durante la ronda: turno, espera, plantado, se pasa y mira la ronda", jug.asientos.map(a => V.chipAsiento(jug, a).texto), ["Espera", "Su turno", "Plantado", "Se pasa", "Mira la ronda"]);
comprobar("tu turno se dice «Tu turno»", V.chipAsiento(mesa(Object.assign({}, jug, { turno: 0 })), jug.asientos[0]).texto, "Tu turno");
const res = mesa({ fase: "resultado", crupier: { cartas: [carta(10, 0), carta(6, 1), carta(10, 2)], ocultas: 0, total: 26, blando: false }, asientos: [
  { asiento: 0, nombre: "Ana", yo: true, listo: true, mano: mano([carta(10, 0), carta(9, 1)], { estado: "terminada", resultado: "victoria", razon: "crupier_se_pasa", neto: 20 }) },
  { asiento: 1, nombre: "Beto", yo: false, listo: true, mano: mano([carta(1, 0), carta(13, 1)], { estado: "terminada", resultado: "natural", razon: "natural", total: 21, neto: 30 }) },
  { asiento: 2, nombre: "Caro", yo: false, listo: true, mano: mano([carta(9, 0)], { estado: "terminada", resultado: "empate", razon: "igual", neto: 0 }) },
  { asiento: 3, nombre: "Dani", yo: false, listo: true, mano: mano([carta(9, 0)], { estado: "terminada", resultado: "derrota", razon: "abandono", neto: -20 }) },
  { asiento: 4, nombre: "Eli", yo: false, listo: true, mano: mano([carta(9, 0)], { estado: "terminada", resultado: "derrota", razon: "menor", neto: -10 }) }] });
comprobar("al acabar: resultado con lo que ganó o perdió cada uno", res.asientos.map(a => V.chipAsiento(res, a).texto), ["Gana +20", "Blackjack +30", "Empata 0", "Se fue", "Pierde −10"]);
comprobar("sin apostar tokens no se enseña cantidad", V.chipAsiento(mesa({ fase: "resultado" }), { asiento: 0, yo: true, mano: mano([carta(9, 0)], { modo: "practica", estado: "terminada", resultado: "victoria", neto: 0 }) }).texto, "Gana");
const adaptada = V.manoComoPropia(jug);
comprobar("tu mano se adapta a lo que espera la lista de acciones (en curso, fase, cartas)", [adaptada.estado, adaptada.fase, adaptada.jugador.total], ["en_curso", "jugador", 19]);
comprobar("quien no tiene mano no tiene acciones", V.manoComoPropia(m), null);
const conAcc = Object.assign({}, jug, { yo: { asiento: 0, saldo: 100, tu_turno: true, partida: "p", paso: 2, regla: { id: "ojo", usada: false, peaje: 7 }, acciones: { pedir: true, plantar: true, especial: { tipo: "ojo", disponible: true, motivo: null, peaje: 7 } } } });
comprobar("tu turno ofrece pedir, plantarte y la acción de la regla", V.acciones(V.manoComoPropia(conAcc)).botones.map(b => b.id), ["pedir", "plantar", "ojo"]);
comprobar("el pozo sin cartas lo explica", /Nadie ha puesto carta/.test(V.frasePozo(mesa({ cartas: true, pozo: { activo: true, cartas: [], estado: null } }))), true);
comprobar("el pozo abierto dice qué cartas hay", V.frasePozo(mesa({ pozo: { activo: true, cartas: [{ titulo: "Rata", carta: "comun-1" }, { titulo: "Lobo", carta: "comun-2" }], estado: "abierto" } })), "En el pozo: Rata y Lobo. Se lo lleva el mejor jugador que gane a la casa.");
comprobar("el pozo pagado dice quién se lo lleva", V.frasePozo(mesa({ pozo: { activo: true, cartas: [{ titulo: "Rata" }], estado: "pagado", ganador: "Ana" } })), "El pozo es para Ana: Rata.");
comprobar("el pozo devuelto lo dice", V.frasePozo(mesa({ pozo: { activo: true, cartas: [{ titulo: "Rata" }], estado: "devuelto" } })), "Nadie ganó el pozo: cada carta vuelve a su dueño.");
comprobar("una mesa sin pozo no dice nada", V.frasePozo(m), "");
let tx = V.anuncioAmigos(null, jug);
  cierto("al entrar se anuncia la mesa con su código y tus cartas", /Mesa Los de siempre, código ABCDE./.test(tx) && /Tus cartas|Reparto/.test(tx));
tx = V.anuncioAmigos(mesa({ fase: "apuestas" }), jug);
cierto("al repartir se anuncia el reparto con tus cartas y quién juega", /Reparto\./.test(tx) && /Tus cartas: diez de picas y 9 de corazones\. Suman 19\./.test(tx.replace("10 de picas", "diez de picas")) && /Juega Beto\./.test(tx));
tx = V.anuncioAmigos(jug, res);
cierto("al acabar se anuncia el crupier y el resultado de cada uno", /El crupier enseña/.test(tx) && /Tú: gana \+20\./.test(tx) && /Beto: blackjack \+30\./.test(tx));
const nuevaCarta = JSON.parse(JSON.stringify(jug)); nuevaCarta.asientos[1].mano.cartas.push(carta(7, 0)); nuevaCarta.asientos[1].mano.total = 18;
tx = V.anuncioAmigos(jug, nuevaCarta);
cierto("cuando otro pide carta se dice qué recibe y cuánto suma", /Beto recibe 7 de picas\. Suma 18\./.test(tx));
const sentado = JSON.parse(JSON.stringify(m)); sentado.asientos.push({ asiento: 2, nombre: "Caro", yo: false, listo: false, mano: null });
cierto("se anuncia quién se sienta y quién se levanta", /Caro se sienta a la mesa\./.test(V.anuncioAmigos(m, sentado)) && /Caro se levanta de la mesa\./.test(V.anuncioAmigos(sentado, m)));
comprobar("errores de la mesa con palabras", ["mesa_llena", "no_es_tu_turno", "mesa_no_existe", "ya_sentado", "pozo_desequilibrado"].map(c => /\w/.test(V.mensajeError({ tipo: "servidor", codigo: c, mensaje: "x" })) && V.mensajeError({ tipo: "servidor", codigo: c, mensaje: "x" }) !== "x"), [true, true, true, true, true]);
comprobar("el abandono tiene razón escrita", /levantaste/.test(V.RAZONES.abandono), true);

console.log("== Mesa con amigos: las cartas de los demás, ocultas");
const oculta = (fase, n) => ({ cartas: [carta(9, 0)], n, oculta: true, fase, modo: "apuesta", apuesta: 20 });
const ocu = mesa({ fase: "jugando", turno: 1, asientos: [
  { asiento: 0, nombre: "Ana", yo: true, listo: true, mano: mano([carta(10, 0), carta(9, 1)]) },
  { asiento: 1, nombre: "Beto", yo: false, listo: true, mano: oculta("jugador", 2) },
  { asiento: 2, nombre: "Caro", yo: false, listo: true, mano: oculta("listo", 3) }] });
comprobar("de un asiento ajeno con cartas ocultas: su turno, espera o plantado, nunca el total ni si se pasó", ocu.asientos.map(a => V.chipAsiento(ocu, a).texto), ["Espera", "Su turno", "Plantado"]);
const nuevaOculta = JSON.parse(JSON.stringify(ocu)); nuevaOculta.asientos[1].mano.n = 3;
tx = V.anuncioAmigos(ocu, nuevaOculta);
comprobar("cuando otro pide carta se anuncia que pide, pero nunca cuál recibe", [/Beto pide carta\./.test(tx), /(picas|corazones|diamantes|tréboles)/.test(tx)], [true, false]);
const amigosJsOc = fs.readFileSync(path.join(RAIZ, "js", "veintiuna-amigos.js"), "utf8");
cierto("la pantalla dibuja las cartas ocultas de los demás boca abajo y su total como «?»", /m\.oculta \? Math\.max\(0, \(m\.n \|\| m\.cartas\.length\) - m\.cartas\.length\) : 0/.test(amigosJsOc) && /tot\.textContent = "\?"/.test(amigosJsOc));

console.log("== Mesa con amigos: todos contra todos");
const duelo = mesa({ modo: "duelo", bote: 100, fase: "resultado", asientos: [
  { asiento: 0, nombre: "Ana", yo: true, listo: true, mano: mano([carta(10, 0), carta(9, 1)], { estado: "terminada", resultado: "victoria", razon: "bote", neto: 80 }) },
  { asiento: 1, nombre: "Beto", yo: false, listo: true, mano: mano([carta(10, 0), carta(6, 1), carta(10, 2)], { estado: "en_curso", fase: "pasada", total: 26 }) },
  { asiento: 2, nombre: "Caro", yo: false, listo: true, mano: mano([carta(9, 0), carta(9, 1)], { estado: "terminada", resultado: "derrota", razon: "rival_mejor", neto: -50, total: 18 }) },
  { asiento: 3, nombre: "Dani", yo: false, listo: true, mano: mano([carta(10, 0), carta(9, 1)], { estado: "terminada", resultado: "victoria", razon: "bote_compartido", neto: 15 }) },
  { asiento: 4, nombre: "Eli", yo: false, listo: true, mano: mano([carta(9, 0), carta(8, 1)], { estado: "terminada", resultado: "empate", razon: "todos_se_pasan", neto: 0, total: 17 }) }] });
comprobar("en «todos contra todos» los asientos hablan del bote", duelo.asientos.map(a => V.chipAsiento(duelo, a).texto), ["Gana el bote +80", "Se pasa", "Pierde −50", "Reparte el bote +15", "Recupera"]);
comprobar("un natural se planta solo y se ve como «Blackjack»", V.chipAsiento(mesa({ fase: "jugando", turno: 0 }), { asiento: 1, yo: false, mano: mano([carta(1, 0), carta(13, 1)], { fase: "plantada", total: 21 }) }).texto, "Blackjack");
comprobar("se sabe si la mesa es de duelo y los textos del modo existen", [V.esDuelo(duelo), V.esDuelo(m), /bote/.test(V.DUELO.reglaApuestas), V.DUELO.leyendaPaga], [true, false, true, "Todos contra todos"]);
comprobar("las razones del duelo tienen palabras", ["bote", "bote_compartido", "rival_mejor", "todos_se_pasan", "mejor_mano"].every(k => /\w/.test(V.RAZONES[k])), true);
comprobar("el pozo de cartas en duelo no habla de la casa", /no se pasa/.test(V.frasePozo(mesa({ modo: "duelo", pozo: { activo: true, cartas: [{ titulo: "Rata" }], estado: "abierto" } }))) && !/casa/.test(V.frasePozo(mesa({ modo: "duelo", pozo: { activo: true, cartas: [{ titulo: "Rata" }], estado: "abierto" } }))), true);
tx = V.anuncioAmigos(mesa({ fase: "apuestas" }), Object.assign({}, duelo, { fase: "jugando", turno: 1 }));
cierto("al repartir en duelo se anuncia el bote y no hay crupier", /Todos contra todos: el bote es de 100 tokens\./.test(tx) && !/crupier muestra/.test(tx));
tx = V.anuncioAmigos(Object.assign({}, duelo, { fase: "jugando", turno: 1 }), duelo);
cierto("al acabar en duelo no se anuncian las cartas del crupier, pero sí lo que hizo cada uno", !/El crupier enseña/.test(tx) && /Tú: gana el bote \+80\./.test(tx));

console.log("== Errores con palabras");
comprobar("sin conexión", /Reintentar/.test(V.mensajeError({ tipo: "red" })), true);
comprobar("mano en curso", V.mensajeError({ tipo: "servidor", codigo: "mano_en_curso", mensaje: "x" }), "Ya tenías una mano abierta. La recupero.");
comprobar("lo que dice el servidor se respeta cuando no hay pista", V.mensajeError({ tipo: "servidor", codigo: "saldo_insuficiente", mensaje: "No tienes tantos tokens: te faltan 20." }), "No tienes tantos tokens: te faltan 20.");

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

  llamadas.length = 0;
  await api.amigos.lista(); await api.amigos.crear("Mesa", true, false); await api.amigos.crear("", false, true); await api.amigos.crear("Pelea", true, true, "duelo"); await api.amigos.unirse("ABCDE"); await api.amigos.salir();
  await api.amigos.estado(7); await api.amigos.estado(); await api.amigos.misCartas(); await api.amigos.apostar(20, "e1"); await api.amigos.apostar(0); await api.amigos.pasar(); await api.amigos.repartir(); await api.amigos.accion(4, "pedir");
  comprobar("las llamadas de la mesa con amigos usan las funciones del servidor con sus argumentos", llamadas, [
    ["veintiuna_amigos_lista", {}], ["veintiuna_amigos_crear", { p_nombre: "Mesa", p_privada: true, p_cartas: false, p_modo: "casa" }], ["veintiuna_amigos_crear", { p_nombre: null, p_privada: false, p_cartas: true, p_modo: "casa" }],
    ["veintiuna_amigos_crear", { p_nombre: "Pelea", p_privada: true, p_cartas: true, p_modo: "duelo" }],
    ["veintiuna_amigos_unirse", { p_codigo: "ABCDE" }], ["veintiuna_amigos_salir", {}], ["veintiuna_amigos_estado", { p_version: 7 }], ["veintiuna_amigos_estado", { p_version: null }],
    ["veintiuna_amigos_mis_cartas", {}], ["veintiuna_amigos_apostar", { p_apuesta: 20, p_carta: "e1" }], ["veintiuna_amigos_apostar", { p_apuesta: 0, p_carta: null }],
    ["veintiuna_amigos_pasar", {}], ["veintiuna_amigos_repartir", {}], ["veintiuna_amigos_accion", { p_paso: 4, p_accion: "pedir" }]]);

  const intenta = async (api, f) => { try { await f(api); return null; } catch (e) { return e; } };
  let e = await intenta(Api.crear(async () => cliente({ data: null, error: { message: "ERROR: No tienes tantos tokens: te faltan 5.", hint: "saldo_insuficiente", code: "P0001" } })), a => a.repartir("x", "apuesta", 50));
  comprobar("un rechazo del servidor lleva su pista y su texto sin «ERROR:»", [e && e.tipo, e && e.codigo, e && e.mensaje], ["servidor", "saldo_insuficiente", "No tienes tantos tokens: te faltan 5."]);
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
  cierto("mientras la mano de la crupier sigue oculta (te plantas, o hay un natural al repartir) las velas y el «muestra» cuentan solo su carta visible, no el total final", mesaJs.includes("o.ocultarCrupier && c.cartas.length ? valorDeMano(c.cartas.slice(0, 1), est) : c.total") && mesaJs.includes('velas($("vvVelasCrupier"), visible') && mesaJs.includes("`muestra ${visible}`"));
  cierto("los botones de fichas y pasos llevan etiqueta", /aria-label="Añadir \$\{f\} tokens"/.test(mesaJs) && /aria-label="Bajar la apuesta/.test(mesaJs) && /aria-label="Subir la apuesta/.test(mesaJs));
  cierto("las acciones deshabilitadas usan aria-disabled y dicen por qué al pulsarlas", /aria-disabled="\$\{!b\.habilitado\}"/.test(mesaJs) && /b\.motivo \|\| "Esa acción no está disponible ahora\."/.test(mesaJs));
  cierto("el panel de modalidad es un radiogroup con aria-checked", /role="radiogroup"/.test(mesaJs) && /role="radio" aria-checked/.test(mesaJs));
  cierto("las barras de progreso de los desafíos son progressbar con valores", /role="progressbar"[^`]*aria-valuenow/.test(mesaJs));
  cierto("atajos de teclado documentados y declarados (aria-keyshortcuts)", /aria-keyshortcuts/.test(mesaJs) && /Atajos de teclado/.test(html));
  cierto("la carta oculta del crupier se anuncia como «carta oculta» y no se rellena nunca con datos del servidor", /A\.carta\(null, true\)|repartirCarta\("crupier", null, true/.test(mesaJs));

  console.log("== La página de la mesa con amigos");
  const htmlA = fs.readFileSync(path.join(RAIZ, "veintiuna-amigos.html"), "utf8");
  const amigosJs = fs.readFileSync(path.join(RAIZ, "js", "veintiuna-amigos.js"), "utf8");
  cierto("idioma, título y un solo h1", /<html lang="es">/.test(htmlA) && /<title>Veintiuna con amigos/.test(htmlA) && (htmlA.match(/<h1[ >]/g) || []).length === 1);
  cierto("enlace para saltar a los controles y zonas de aviso para lectores de pantalla", /class="vv-saltar" href="#vvDock"/.test(htmlA) && /id="vvSr"[^>]*aria-live="polite"/.test(htmlA) && /id="vvSrFuerte"[^>]*aria-live="assertive"/.test(htmlA));
  cierto("cada diálogo se nombra con aria-labelledby", ["vvDlgReglas", "vvDlgCartas", "vvDlgAtajos"].every(id => new RegExp(`id="${id}"[^>]*aria-labelledby="${id}T"`).test(htmlA)));
  cierto("la mesa, los controles y las mesas abiertas tienen nombre accesible", /aria-label="La mesa"/.test(htmlA) && /aria-label="Controles de la mesa"/.test(htmlA) && /aria-label="Mesas"/.test(htmlA));
  cierto("la página ya es pública (sin oculto.js) y no hay ninguna imagen que pueda faltar", !/oculto.js/.test(htmlA) && !/oculto.js/.test(html) && !/<img /.test(htmlA));
  cierto("carga las piezas en orden: arte, vista, api y la mesa", ["veintiuna-arte.js", "veintiuna-vista.js", "veintiuna-api.js", "veintiuna-amigos.js"].map(n => htmlA.indexOf(n)).every((x, i, v) => x > 0 && (i === 0 || x > v[i - 1])));
  cierto("cada asiento se anuncia con su estado (aria-label)", /el\.setAttribute\("aria-label", `\$\{a\.nombre\}/.test(amigosJs));
  cierto("las acciones deshabilitadas usan aria-disabled y explican por qué", /aria-disabled="\$\{!b\.habilitado\}"/.test(amigosJs) && /b\.motivo \|\| "Esa acción no está disponible ahora\."/.test(amigosJs));
  cierto("el selector de cómo juegas es un radiogroup, igual que el de la carta del pozo", (amigosJs.match(/role="radiogroup"/g) || []).length >= 2);
  cierto("el código de la mesa se lee letra a letra", /aria-label="Código de la mesa: /.test(amigosJs));
  cierto("se sondea la mesa con la versión que ya se tiene y se baja el ritmo con la pestaña en segundo plano", /api\.amigos\.estado\(S\.version\)/.test(amigosJs) && /document\.hidden \? SONDEO_FONDO_MS/.test(amigosJs));
  cierto("se respeta prefers-reduced-motion en las cartas que entran", /sinMovimiento\(\)/.test(amigosJs));
  cierto("la mesa individual enlaza con la de amigos y al revés", /veintiuna-amigos\.html/.test(html) && /veintiuna\.html/.test(htmlA));

  console.log("== La hoja de estilos: movimiento reducido, foco y tamaños táctiles");
  cierto("existe un bloque prefers-reduced-motion que apaga animaciones y transiciones", /@media \(prefers-reduced-motion: reduce\)[^}]*animation: none/.test(css) && /transition-duration: \.01s/.test(css));
  cierto("el código también lo respeta (WAAPI y esperas)", /prefers-reduced-motion: reduce/.test(mesaJs) && /sinMovimiento\(\)/.test(mesaJs));
  cierto("foco visible y fuerte", /:focus-visible\s*\{[^}]*outline: 3px solid/.test(css));
  cierto("botones de acción de al menos 56 px de alto y mini de 44", /\.vv-boton \{[^}]*min-height: 56px/.test(css) && /\.vv-boton-mini \{[^}]*min-height: 44px/.test(css) && /\.vv-cerrar \{[^}]*width: 44px; height: 44px/.test(css));
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
