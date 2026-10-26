// Pruebas del bot de Discord que no necesitan Discord ni Supabase: la comprobación de firmas (con firmas Ed25519 de verdad),
// la entrada de la Edge Function (servidor.js) y las respuestas de los comandos (comandos.js) con una base de datos de mentira.
// Uso: node tools/probar-discord.js        (las pruebas de la parte SQL están en docs/pruebas/t_discord.sh)
import { webcrypto as crypto } from "node:crypto";
import { verificarFirma } from "../docs/discord/firma.js";
import { atender } from "../docs/discord/servidor.js";
import { responder, COMANDOS } from "../docs/discord/comandos.js";

let fallos = 0, bien = 0;
const ok = (c, msg, extra) => { if (c) { bien++; console.log("  OK   " + msg); } else { fallos++; console.log("  FALLA " + msg + (extra ? " -> " + extra : "")); } };
const hex = b => Buffer.from(b).toString("hex");

// Un par de claves como el de una aplicación de Discord
const par = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const publicaHex = hex(await crypto.subtle.exportKey("raw", par.publicKey));
const otro = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const firmar = async (marca, cuerpo, llave = par.privateKey) => hex(await crypto.subtle.sign({ name: "Ed25519" }, llave, new TextEncoder().encode(marca + cuerpo)));
const ahora = () => String(Math.floor(Date.now() / 1000));

console.log("== Firma de Discord");
{
  const cuerpo = JSON.stringify({ type: 1 }), marca = ahora(), f = await firmar(marca, cuerpo);
  ok(await verificarFirma({ clavePublicaHex: publicaHex, firmaHex: f, marca, cuerpo }), "una firma buena vale");
  ok(!(await verificarFirma({ clavePublicaHex: publicaHex, firmaHex: f, marca, cuerpo: cuerpo + " " })), "si el cuerpo cambia un solo carácter, no vale");
  ok(!(await verificarFirma({ clavePublicaHex: publicaHex, firmaHex: f, marca: String(Number(marca) + 1), cuerpo })), "si cambia la marca de tiempo, no vale");
  ok(!(await verificarFirma({ clavePublicaHex: publicaHex, firmaHex: await firmar(marca, cuerpo, otro.privateKey), marca, cuerpo })), "firmada con otra clave, no vale");
  const vieja = String(Number(marca) - 3600);
  ok(!(await verificarFirma({ clavePublicaHex: publicaHex, firmaHex: await firmar(vieja, cuerpo), marca: vieja, cuerpo })), "una firma buena pero de hace una hora no vale (no se puede reutilizar)");
  const futura = String(Number(marca) + 3600);
  ok(!(await verificarFirma({ clavePublicaHex: publicaHex, firmaHex: await firmar(futura, cuerpo), marca: futura, cuerpo })), "ni una del futuro");
  for (const [nombre, args] of [
    ["firma vacía", { firmaHex: "" }], ["firma que no es hexadecimal", { firmaHex: "zz".repeat(64) }], ["firma corta", { firmaHex: f.slice(0, 20) }],
    ["marca vacía", { marca: "" }], ["marca que no es un número", { marca: "ayer" }], ["clave rota", { clavePublicaHex: "1234" }], ["sin clave", { clavePublicaHex: undefined }]
  ]) {
    let r, lanzo = false;
    try { r = await verificarFirma({ clavePublicaHex: publicaHex, firmaHex: f, marca, cuerpo, ...args }); } catch { lanzo = true; }
    ok(!lanzo && r === false, `${nombre}: dice que no, sin lanzar error`);
  }
}

console.log("== Entrada de la función (servidor.js)");
const llamadas = [];
const rpcFalso = async (nombre, args) => { llamadas.push({ nombre, args }); return RESPUESTAS[nombre]?.(args); };
const RESPUESTAS = {};
const entorno = (extra = {}) => n => ({ DISCORD_PUBLIC_KEY: publicaHex, DISCORD_APP_ID: "999", DISCORD_GUILD_ID: "555", ...extra })[n];
async function pedir(cuerpoObj, { metodo = "POST", llave = par.privateKey, marca = ahora(), env = entorno(), cabeceras = {} } = {}) {
  const cuerpo = typeof cuerpoObj === "string" ? cuerpoObj : JSON.stringify(cuerpoObj);
  const f = await firmar(marca, cuerpo, llave);
  const req = new Request("https://ejemplo.test/functions/v1/discord", { method: metodo, headers: { "x-signature-ed25519": f, "x-signature-timestamp": marca, ...cabeceras }, body: metodo === "POST" ? cuerpo : undefined });
  const logs = [];
  const res = await atender(req, { entorno: env, rpc: rpcFalso, log: m => logs.push(m) });
  let json = null; try { json = await res.clone().json(); } catch { /* texto */ }
  return { estado: res.status, json, logs };
}
const usuario = (id = "123456789012345678") => ({ id, username: "tester", global_name: "Tester" });
const cmd = (name, options = [], extra = {}) => ({ type: 2, application_id: "999", guild_id: "555", member: { user: usuario() }, data: { name, options }, ...extra });

{
  let r = await pedir({ type: 1, application_id: "999" });
  ok(r.estado === 200 && r.json?.type === 1, "el PING firmado se contesta con PONG");
  r = await pedir({ type: 1, application_id: "999" }, { llave: otro.privateKey });
  ok(r.estado === 401, "una petición con firma de otra clave recibe 401 (así lo exige Discord)");
  r = await pedir({ type: 1, application_id: "999" }, { cabeceras: { "x-signature-ed25519": "00".repeat(64) } });
  ok(r.estado === 401, "una firma inventada recibe 401");
  r = await pedir({ type: 1 }, { metodo: "GET" });
  ok(r.estado === 405, "un GET no se atiende");
  r = await pedir({ type: 1, application_id: "999" }, { env: entorno({ DISCORD_PUBLIC_KEY: undefined }) });
  ok(r.estado === 500, "sin la clave pública configurada, falla sin dejar pasar a nadie");
  r = await pedir("esto no es json");
  ok(r.estado === 400, "un cuerpo que no es JSON, aun bien firmado, recibe 400");
  r = await pedir({ type: 1, application_id: "otra-app" });
  ok(r.estado === 401, "una petición firmada pero de otra aplicación se rechaza");
  r = await pedir("x".repeat(30000));
  ok(r.estado === 413, "un cuerpo enorme se rechaza antes de interpretarlo");
  llamadas.length = 0;
  r = await pedir(cmd("perfil", [], { guild_id: "otro-servidor" }));
  ok(r.estado === 200 && /solo funciona en el servidor/.test(r.json?.data?.content || "") && llamadas.length === 0, "un comando de otro servidor se rechaza sin tocar la base de datos");
  RESPUESTAS.discord_i_perfil = () => ({ usuario: "Uno", side: "A", cartas: { total: 3, distintas: 2 }, tokens: 10, juegos: [], hooey: null, veintiuna: null });
  r = await pedir(cmd("perfil"));
  ok(r.estado === 200 && r.json?.type === 4 && llamadas[0]?.nombre === "discord_i_perfil", "un comando bien firmado llega a su función");
}

console.log("== Comandos (comandos.js)");
const ctx = { rpc: rpcFalso, sitio: "https://sitio.test/app/", log: m => ctx.logs.push(m), logs: [] };
const lleno = (n, c = "x") => c.repeat(n);
const mide = (r, desc) => {
  const e = r.data?.embeds?.[0]; if (!e) return true;
  const campos = e.fields || [];
  const total = (e.title || "").length + (e.description || "").length + campos.reduce((s, f) => s + f.name.length + f.value.length, 0) + (e.footer?.text || "").length;
  const mal = (e.title || "").length > 256 || (e.description || "").length > 4096 || campos.length > 25 || total > 6000 ||
    campos.some(f => f.name.length > 256 || f.value.length > 1024 || !f.name || !f.value) || (e.footer?.text || "").length > 2048;
  if (mal) ok(false, `${desc}: se pasa de los límites de Discord`, `total ${total}, campos ${campos.length}`);
  return !mal;
};
{
  ok(COMANDOS.length === 8 && COMANDOS.every(c => /^[a-z]{3,32}$/.test(c.name) && c.description.length <= 100), "los 8 comandos tienen nombre y descripción válidos para Discord");
  ok(COMANDOS.every(c => c.dm_permission === false), "ninguno funciona por mensaje directo");
  ok((await responder({ type: 1 }, ctx)).type === 1, "PING");
  ok((await responder(cmd("no-existe"), ctx)).data.flags === 64, "un comando desconocido se contesta en privado");
  ok((await responder({ type: 2, data: { name: "perfil" } }, ctx)).data.content.includes("quién eres"), "sin saber quién escribe, no se hace nada");

  llamadas.length = 0;
  RESPUESTAS.discord_i_vincular = a => a.p_codigo === "BUENO123" ? { ok: true, usuario: "Uno" } : { ok: false, mensaje: "Ese código no es válido o ya caducó. Genera uno nuevo en la web." };
  let r = await responder(cmd("vincular", [{ name: "codigo", value: "BUENO123" }]), ctx);
  ok(r.data.flags === 64 && /Uno/.test(r.data.content), "/vincular con un código bueno contesta en privado y con el nombre");
  ok(llamadas[0].args.p_discord_id === "123456789012345678" && llamadas[0].args.p_discord_nombre === "Tester", "usa el identificador de Discord de quien escribe, no un nombre");
  r = await responder(cmd("vincular", [{ name: "codigo", value: "MALO" }]), ctx);
  ok(/no es válido/.test(r.data.content) && r.data.flags === 64, "con un código malo enseña el motivo, en privado");

  RESPUESTAS.discord_i_desvincular = () => true;
  r = await responder(cmd("desvincular"), ctx);
  ok(/desvinculada/.test(r.data.content), "/desvincular");

  // /perfil: no existe forma de pedir el de otra persona
  llamadas.length = 0;
  r = await responder(cmd("perfil", [{ name: "usuario", value: "999999999999999999" }, { name: "id", value: "999999999999999999" }]), ctx);
  ok(llamadas.length === 1 && llamadas[0].args.p_discord_id === "123456789012345678" && Object.keys(llamadas[0].args).length === 1, "/perfil usa solo el identificador de quien escribe, aunque le pasen otros datos");
  ok(!COMANDOS.find(c => c.name === "perfil").options, "y el comando ni siquiera tiene una opción para elegir a otra persona");
  ok(r.data.flags === 64, "el perfil es privado");
  r = await responder(cmd("perfil", [], { member: undefined, user: usuario("555555555555555555") }), ctx);
  ok(llamadas.at(-1).args.p_discord_id === "555555555555555555", "también funciona cuando Discord manda user en vez de member");

  // perfil con datos enormes o raros
  RESPUESTAS.discord_i_perfil = () => ({ usuario: lleno(500), side: "B", cartas: { total: 1234567, distintas: 99 }, tokens: 0,
    juegos: Array.from({ length: 40 }, (_, i) => ({ juego: "juego" + i + lleno(80), partidas: 1, victorias: 1, derrotas: 0, tablas: 1 })), hooey: { total: 5, mejor_racha: 2 }, veintiuna: { rondas: 1, victorias: 1, mejor_racha: 1 } });
  r = await responder(cmd("perfil"), ctx);
  ok(mide(r, "perfil enorme") && r.data.embeds[0].fields.length <= 25, "un perfil con muchísimos datos se recorta a los límites de Discord");

  // clasificación
  RESPUESTAS.discord_i_clasificacion = () => [{ usuario: "Dos", puntos: 300, extra: 9 }, { usuario: "Uno", puntos: 120, extra: 5 }, { usuario: "@everyone", puntos: 1, extra: 0 }];
  r = await responder(cmd("clasificacion", [{ name: "juego", value: "hooey" }]), ctx);
  ok(r.data.flags === 64 && /🥇 Dos: 300/.test(r.data.embeds[0].description), "/clasificacion sale en privado por defecto");
  ok(r.data.allowed_mentions.parse.length === 0, "y nunca menciona a nadie (un nombre como @everyone no avisa a nadie)");
  r = await responder(cmd("clasificacion", [{ name: "juego", value: "hooey" }, { name: "publico", value: true }]), ctx);
  ok(r.data.flags === 0, "con publico: sí se enseña a todos");

  // cartas: siempre privado
  RESPUESTAS.discord_i_cartas = () => [{ id: "rata", nombre: "Rata", epiteto: "la plaga", tipo: "Criatura", rareza: "comun", coste: 1, atq: 1, pv: 1, afinidad: ["sombra"], habilidad: "Sabandija: no la eligen.", descripcion: "Rata de despensa.", imagen: "https://x.test/rata.webp" },
    { nombre: "Ratón" }];
  r = await responder(cmd("cartas", [{ name: "nombre", value: "rat" }]), ctx);
  ok(r.data.flags === 64 && r.data.embeds[0].thumbnail?.url === "https://x.test/rata.webp" && /Ratón/.test(r.data.embeds[0].footer.text), "/cartas es privado, con imagen y otras coincidencias");
  RESPUESTAS.discord_i_cartas = () => [{ nombre: "X", imagen: "javascript:alert(1)", habilidad: lleno(5000), descripcion: lleno(5000) }];
  r = await responder(cmd("cartas", [{ name: "nombre", value: "xx" }]), ctx);
  ok(!r.data.embeds[0].thumbnail && mide(r, "carta enorme"), "una imagen que no es https se ignora y los textos largos se recortan");
  RESPUESTAS.discord_i_cartas = () => [];
  r = await responder(cmd("cartas", [{ name: "nombre", value: "zzz" }]), ctx);
  ok(/No encontré/.test(r.data.content), "sin resultados lo dice");

  // eventos: en público se pide sin identificador
  llamadas.length = 0;
  RESPUESTAS.discord_i_eventos = () => ({ eventos: [{ titulo: "Torneo", texto: "Juega", enlace: "ajedrez.html", hasta: "2030-01-01T00:00:00Z" }], carreras: [{ nombre: "Copa", hora: 1900000000, grado: "Novatos", bolsa: 500, inscripcion: 50 }] });
  r = await responder(cmd("eventos"), ctx);
  ok(llamadas[0].args.p_discord_id === "123456789012345678" && r.data.flags === 64, "/eventos en privado usa tu cuenta (así salen también los de tu Side)");
  ok(r.data.embeds[0].fields[0].value.includes("https://sitio.test/app/ajedrez.html"), "los enlaces se arman con la dirección del sitio (sin barras dobles)");
  r = await responder(cmd("eventos", [{ name: "publico", value: true }]), ctx);
  ok(llamadas[1].args.p_discord_id === null && r.data.flags === 0, "/eventos con publico: sí se pide SIN identificador, para que no se cuele nada de un Side");

  // errores
  ctx.logs.length = 0;
  RESPUESTAS.discord_i_perfil = () => { const e = new Error("Primero vincula tu cuenta: genera un código en la web y usa /vincular."); e.code = "P0001"; throw e; };
  r = await responder(cmd("perfil"), ctx);
  ok(/Primero vincula/.test(r.data.content) && r.data.flags === 64 && ctx.logs.length === 0, "un mensaje nuestro de SQL (P0001) se enseña tal cual");
  RESPUESTAS.discord_i_perfil = () => { const e = new Error('relation "secreta" does not exist; password=abc'); e.code = "42P01"; throw e; };
  r = await responder(cmd("perfil"), ctx);
  ok(!/secreta|password/.test(JSON.stringify(r)) && /Algo falló/.test(r.data.content), "un error técnico no se enseña: solo un aviso corriente");
  ok(ctx.logs.length === 1, "pero queda apuntado en el registro");
  RESPUESTAS.discord_i_perfil = () => { throw "texto suelto"; };
  r = await responder(cmd("perfil"), ctx);
  ok(/Algo falló/.test(r.data.content), "incluso un error que no es un Error se contesta con normalidad");
}

console.log(`\n${fallos ? "FALLOS: " + fallos : "Todo bien."} (${bien} comprobaciones correctas)`);
process.exit(fallos ? 1 : 0);
