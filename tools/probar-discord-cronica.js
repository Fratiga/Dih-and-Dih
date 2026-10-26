// Pruebas de la parte 2 del bot de Discord: /cronica, /racha, /desafios, /carrera, /saldo y los anuncios de la crónica y el recordatorio de Veintiuna.
// Sin Discord ni Supabase. Uso: node tools/probar-discord-cronica.js        (la parte SQL: docs/pruebas/t_discord_cronica.sh)
import fs from "node:fs";
import { responder, COMANDOS } from "../docs/discord/comandos.js";
import { procesar, mensajeCronica, mensajeRecordatorio, mensajeCarrera } from "../docs/discord-avisos/avisos.js";

let fallos = 0, bien = 0;
const ok = (c, msg, extra) => { if (c) { bien++; console.log("  OK   " + msg); } else { fallos++; console.log("  FALLA " + msg + (extra ? " -> " + extra : "")); } };
const leer = r => fs.readFileSync(new URL("../" + r, import.meta.url), "utf8");

console.log("== Las copias de js/cronica.js");
{
  const original = leer("js/cronica.js");
  ok(leer("docs/discord/cronica.js") === original, "la copia de docs/discord/ es idéntica a js/cronica.js (si falla: copia js/cronica.js ahí)");
  ok(leer("docs/discord-avisos/cronica.js") === original, "y la de docs/discord-avisos/ también");
  ok(COMANDOS.length === 13, "hay 13 comandos registrables", String(COMANDOS.length));
  ok(COMANDOS.every(c => /^[a-z]{3,32}$/.test(c.name) && c.description.length <= 100 && c.dm_permission === false), "todos con nombre y descripción válidos para Discord y sin mensajes directos");
  ok(new Set(COMANDOS.map(c => c.name)).size === COMANDOS.length, "ningún nombre se repite");
}

const USUARIO = "123456789012345678";
const inter = (name, options = []) => ({ type: 2, application_id: "999", guild_id: "555", member: { user: { id: USUARIO, username: "t" } }, data: { name, options } });
const ctxCon = rpc => ({ rpc, indice: async () => [], sitio: "https://sitio.test/app/", log: () => {} });
const mide = e => {
  const campos = e.fields || [];
  const total = (e.title || "").length + (e.description || "").length + campos.reduce((s, f) => s + f.name.length + f.value.length, 0) + (e.footer?.text || "").length;
  return (e.title || "").length <= 256 && (e.description || "").length <= 4096 && campos.length <= 25 && total <= 6000 &&
    campos.every(f => f.name && f.value && f.name.length <= 256 && f.value.length <= 1024);
};

console.log("== /cronica");
{
  const ahora = new Date().toISOString();
  const sucesos = [
    { id: 1, tipo: "carta_ganada", user: "Uno", yo: true, actualizado: ahora, datos: { nombre: "Dragón Dorado", origen: "sellos" }, enlace: "cartas.html" },
    { id: 2, tipo: "intercambio", user: null, otro: null, yo: false, actualizado: ahora, datos: { dio: [{ nombre: "Draco", n: 1 }], recibio: [{ nombre: "Kobold", n: 2 }] }, enlace: "intercambios.html" },
    { id: 3, tipo: "nota", user: null, yo: false, actualizado: ahora, datos: { texto: "El puente de Valmar cayó." } },
    { id: 4, tipo: "tipo_que_no_existe", user: "X", datos: {}, actualizado: ahora },
    { id: 5, tipo: "carta_ganada", user: "**@everyone** `x` _y_ [z](http://malo.test) <@123>", yo: false, actualizado: ahora, datos: { nombre: "Rata" } }];
  let llamada;
  let r = await responder(inter("cronica"), ctxCon(async (n, a) => { llamada = { n, a }; return sucesos; }));
  const e = r.data.embeds[0];
  ok(r.data.flags === 64 && llamada.n === "discord_i_cronica" && llamada.a.p_discord_id === USUARIO && llamada.a.p_limite === 10, "es privado y pide solo la crónica de quien escribe");
  ok(/Uno/.test(e.description) && /Dragón Dorado/.test(e.description) && /te toca/.test(e.description), "usa las frases de la web y marca lo que le toca");
  ok(/Se cerró un intercambio|cambió de manos|Alguien dio/.test(e.description) && !/Uno.*Draco/.test(e.description), "el intercambio sale sin decir quién fue");
  ok(/El puente de Valmar/.test(e.description), "las noticias del Admin salen");
  ok(!/tipo_que_no_existe/.test(e.description) && e.description.split("\n\n").length === 4, "un tipo que no se sabe contar se salta sin romper nada");
  ok(/<t:\d+:R>/.test(e.description), "cada línea lleva su hora como marca de Discord");
  ok(!e.description.includes("**@everyone**") && !e.description.includes("[z](http") && !e.description.includes("<@123>") && e.description.includes("\\<@123\\>"), "los símbolos de Markdown de un nombre de jugador se escapan (nada de enlaces ni menciones colados)");
  ok(r.data.allowed_mentions.parse.length === 0 && mide(e), "no menciona a nadie y cabe en los límites de Discord");
  r = await responder(inter("cronica"), ctxCon(async () => []));
  ok(/Todavía no ha pasado nada/.test(r.data.embeds[0].description), "sin sucesos lo dice");
  r = await responder(inter("cronica"), ctxCon(async () => { const x = new Error("Primero vincula tu cuenta: genera un código en la web y usa /vincular."); x.code = "P0001"; throw x; }));
  ok(/Primero vincula/.test(r.data.content) && r.data.flags === 64, "sin cuenta vinculada enseña el motivo");
  const muchos = Array.from({ length: 15 }, (_, i) => ({ id: i + 10, tipo: "nota", user: null, actualizado: ahora, datos: { texto: "x".repeat(400) } }));
  r = await responder(inter("cronica"), ctxCon(async () => muchos));
  ok(mide(r.data.embeds[0]), "con 15 sucesos largos sigue cabiendo");
}

console.log("== /racha, /desafios, /saldo");
{
  const reinicia = Math.floor(Date.now() / 1000) + 3600;
  const desafios = [
    { id: "a", nombre: "Primera vela", nivel: "bronce", estado: "reclamado" }, { id: "b", nombre: "Peaje pagado", nivel: "bronce", estado: "pendiente" },
    { id: "c", nombre: "Tres velas seguidas", nivel: "plata", estado: "completado" }, { id: "d", nombre: "La suerte bien pagada", nivel: "oro", estado: "pendiente" }];
  let r = await responder(inter("racha"), ctxCon(async () => ({ rondas: 20, victorias: 11, racha: 4, mejor_racha: 6, desafios: [], reinicia })));
  ok(/\*\*4\*\*/.test(r.data.embeds[0].description) && r.data.flags === 64 && mide(r.data.embeds[0]), "/racha enseña la racha actual, en privado");
  ok(r.data.embeds[0].fields.some(f => f.value === "6") && r.data.embeds[0].fields.some(f => /11 de 20/.test(f.value)), "y la mejor racha y las victorias");
  r = await responder(inter("racha"), ctxCon(async () => ({ rondas: 0, victorias: 0, racha: 0, mejor_racha: 0 })));
  ok(/ninguna victoria seguida/.test(r.data.embeds[0].description), "sin racha lo dice");
  r = await responder(inter("desafios"), ctxCon(async () => ({ desafios, reinicia, rondas: 0 })));
  const e = r.data.embeds[0];
  ok(e.fields.map(f => f.name).join() === "Bronce,Plata,Oro", "los desafíos salen por nivel");
  ok(e.fields[0].value.includes("✅ Primera vela") && e.fields[0].value.includes("▫️ Peaje pagado") && e.fields[1].value.includes("☑️"), "con su marca: reclamado, completado sin reclamar o pendiente");
  ok(e.description.includes("**2** de 4") && e.description.includes(`<t:${reinicia}:R>`) && /se pierde/.test(e.description), "dice cuántos van, cuándo se reinician y que lo no reclamado se pierde");
  ok(mide(e), "cabe en los límites de Discord");
  r = await responder(inter("desafios"), ctxCon(async () => ({ desafios: [], reinicia })));
  ok(r.data.embeds[0].fields.length === 0 && mide(r.data.embeds[0]), "sin desafíos no rompe nada");
  r = await responder(inter("saldo"), ctxCon(async () => 1234.5));
  ok(r.data.flags === 64 && /1\.234,5|1,234\.5|1234,5|1234\.5/.test(r.data.content), "/saldo da los tokens, en privado", r.data.content);
  let args; await responder(inter("saldo", [{ name: "usuario", value: "999" }]), ctxCon(async (n, a) => { args = a; return 0; }));
  ok(Object.keys(args).join() === "p_discord_id" && args.p_discord_id === USUARIO, "ninguno de estos comandos admite pedir los datos de otra persona");
}

console.log("== /carrera");
{
  const hora = Math.floor(Date.now() / 1000) + 1800;
  const c = { hay: true, n: 700, hora, cierre: hora - 60, nombre: "Copa de prueba", grado: "gran", pista: "ceniza", dist: 1600, bolsa: 5000, suspendida: false,
    entrantes: [{ puerta: "2", nombre: "Favorita", gan: 2.08, pod: 1.23, dueno: "Madre Hilda" }, { puerta: "3", nombre: "Segunda", gan: 4.2, pod: 1.5, dueno: null }] };
  let r = await responder(inter("carrera"), ctxCon(async () => c));
  const e = r.data.embeds[0];
  ok(/Copa de prueba/.test(e.title) && e.description.includes(`<t:${hora}:R>`) && e.description.includes(`<t:${hora - 60}:R>`), "enseña la carrera, cuándo sale y cuándo cierran las apuestas");
  ok(e.fields[0].name === "Favoritas" && e.fields[0].value.indexOf("Favorita") < e.fields[0].value.indexOf("Segunda") && /de Madre Hilda/.test(e.fields[0].value), "las favoritas por orden, con cuotas y dueño");
  ok(r.data.flags === 64 && mide(e), "en privado y dentro de los límites");
  r = await responder(inter("carrera"), ctxCon(async () => ({ hay: false })));
  ok(/No hay ninguna carrera/.test(r.data.content), "sin carrera lo dice");
  r = await responder(inter("carrera"), ctxCon(async () => ({ ...c, suspendida: true })));
  ok(/suspendida/.test(r.data.embeds[0].description), "una suspendida lo dice");
  r = await responder(inter("carrera"), ctxCon(async () => ({ hay: true, n: 1, hora, cierre: hora, entrantes: [{ puerta: "1", nombre: "**x**", gan: 1, pod: 1 }] })));
  ok(!r.data.embeds[0].fields[0].value.includes("**x**") || r.data.embeds[0].fields[0].value.includes("\\*\\*x\\*\\*"), "el nombre de una criatura también se escapa");
}

console.log("== Los anuncios de la crónica y el recordatorio");
{
  const m = mensajeCronica({ id: 5, tipo: "copa_hipodromo", user: "Ana", datos: { criatura: "Brasa", copa: "La Copa de Bronce", premio: 10000 }, enlace: "hipodromo.html" }, "https://sitio.test/app/");
  const d = m.embeds[0].description;
  ok(/Brasa/.test(d) && /Ana/.test(d) && d.includes("https://sitio.test/app/hipodromo.html") && m.embeds[0].footer.text === "Crónica del mundo", "una copa sale con la misma frase de la web, su enlace y su pie");
  ok(m.allowed_mentions.parse.length === 0, "sin menciones");
  ok(mensajeCronica({ id: 1, tipo: "inventado", datos: {} }, "https://s.test/") === null, "un tipo que no se sabe contar no se publica");
  const evil = mensajeCronica({ id: 1, tipo: "carta_ganada", user: "[click](http://malo.test) @everyone", datos: { nombre: "Rata" }, enlace: "javascript:alert(1)" }, "https://s.test/");
  ok(!/(^|[^\\])\]\(http/.test(evil.embeds[0].description) && !evil.embeds[0].description.includes("javascript"), "un nombre con Markdown y un enlace raro no cuelan nada");
  const anon = mensajeCronica({ id: 2, tipo: "cria_nacida", user: null, datos: { nombre: "Hidra", primera: true } }, "https://s.test/");
  ok(/primera cría de Hidra/.test(anon.embeds[0].description) && !/Alguien/.test(anon.embeds[0].description), "un suceso anónimo sale sin nombre");
  const largo = mensajeCronica({ id: 3, tipo: "nota", datos: { texto: "x".repeat(5000) } }, "https://s.test/");
  ok(largo.embeds[0].description.length <= 1500, "un texto larguísimo se recorta");
  const rec = mensajeRecordatorio({ tipo: "veintiuna_reinicio", hora: 1793000000 }, "https://sitio.test/app/");
  ok(rec.embeds[0].description.includes("<t:1793000000:R>") && /se pierde/.test(rec.embeds[0].description) && rec.embeds[0].description.includes("https://sitio.test/app/veintiuna.html"), "el recordatorio dice cuándo se reinician y que lo no reclamado se pierde");
  ok(mensajeRecordatorio({ tipo: "otro" }, "https://s.test/") === null, "otro tipo de recordatorio no se publica");
  ok(mensajeCarrera({ n: 1, nombre: "x", grado: "gran", hora: 1793000000 }, "https://s.test/").embeds[0].title.startsWith("🏆") && mensajeCarrera({ n: 2, nombre: "x", grado: "novatos", hora: 1793000000 }, "https://s.test/").embeds[0].title.startsWith("🏇"), "las copas y los grandes premios llevan trofeo; las demás, caballo");

  // procesar con filas de la crónica y del recordatorio
  const marcas = [], envios = [];
  const filas = [
    { id: 1, origen: "cronica", clave: "cronica:5", canal_id: "444444444444444441", contenido: { id: 5, tipo: "copa_hipodromo", user: "Ana", datos: { criatura: "Brasa", copa: "La Copa" } }, intentos: 1 },
    { id: 2, origen: "recordatorio", clave: "veintiuna:reinicio:2026-10-26", canal_id: "444444444444444443", contenido: { tipo: "veintiuna_reinicio", hora: 1793000000 }, intentos: 1 },
    { id: 3, origen: "cronica", clave: "cronica:9", canal_id: "444444444444444441", contenido: { id: 9, tipo: "inventado", datos: {} }, intentos: 1 }];
  const rpc = async (n, a) => { if (n === "discord_i_tomar_cola") return filas; if (n === "discord_i_marcar_cola") marcas.push(a); if (n === "discord_i_encolar_cronica") return 2; return 1; };
  const r = await procesar({ rpc, enviar: async (canal, cuerpo, nonce) => { envios.push({ canal, nonce }); return { estado: 200 }; }, sitio: "https://s.test/" });
  ok(envios.length === 2 && envios[0].canal === "444444444444444441" && envios[1].canal === "444444444444444443", "cada aviso va a su canal");
  ok(r.encoladas === 3 && r.enviadas === 2, "el resumen cuenta lo apuntado (carreras y crónica) y lo enviado", JSON.stringify(r));
  ok(marcas.find(x => x.p_id === 3)?.p_ok === false, "el de un tipo desconocido se marca como fallo y no se publica");
  // si todavía no existe el SQL de la crónica, las carreras siguen
  const rpc2 = async (n) => { if (n === "discord_i_encolar_cronica") { const e = new Error("function discord_i_encolar_cronica() does not exist"); e.code = "42883"; throw e; } if (n === "discord_i_tomar_cola") return [filas[1]]; return 1; };
  const logs = [];
  const r2 = await procesar({ rpc: rpc2, enviar: async () => ({ estado: 200 }), sitio: "https://s.test/", log: m => logs.push(m) });
  ok(r2.enviadas === 1 && logs.some(l => /crónica/.test(l)), "si falta el SQL de la crónica, lo avisa en el registro y lo demás sigue funcionando");
}

console.log(`\n${fallos ? "FALLOS: " + fallos : "Todo bien."} (${bien} comprobaciones correctas)`);
process.exit(fallos ? 1 : 0);
