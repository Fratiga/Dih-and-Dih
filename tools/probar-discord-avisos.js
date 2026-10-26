// Pruebas de la Edge Function de avisos de Discord (docs/discord-avisos/avisos.js) sin Discord ni Supabase: entrada con clave,
// mensajes, reintentos, límites de velocidad y que un fallo de Discord no rompa nada.
// Uso: node tools/probar-discord-avisos.js        (la parte SQL se prueba con docs/pruebas/t_discord_avisos.sh)
import { atender, procesar, mensajeCarrera } from "../docs/discord-avisos/avisos.js";

let fallos = 0, bien = 0;
const ok = (c, msg, extra) => { if (c) { bien++; console.log("  OK   " + msg); } else { fallos++; console.log("  FALLA " + msg + (extra ? " -> " + extra : "")); } };

const CLAVE = "clave-de-prueba-larga-0123456789";
const TOKEN = "TOKEN-SECRETO-QUE-NO-DEBE-SALIR";
const entorno = (extra = {}) => n => ({ DISCORD_AVISOS_CLAVE: CLAVE, DISCORD_BOT_TOKEN: TOKEN, ...extra })[n];
const carrera = { n: 612, nombre: "Grand Cup of the Spell", grado: "gran", pista: "ceniza", dist: 1600, bolsa: 5000, hora: 1793000000, cierre: 1792999940 };
const fila = (id = 1, extra = {}) => ({ id, origen: "carrera", clave: "carrera:" + id, canal_id: "444444444444444444", contenido: carrera, intentos: 1, ...extra });

// Una «base de datos» de mentira que recuerda lo que se le pide
function mundo({ filas = [fila()], encolar = 1, falla = {} } = {}) {
  const w = { llamadas: [], marcas: [], logs: [] };
  w.rpc = async (nombre, args) => {
    w.llamadas.push(nombre);
    if (falla[nombre]) { const e = new Error("fallo de prueba " + TOKEN.slice(0, 5)); e.code = "XX000"; throw e; }
    if (nombre === "discord_i_encolar_carreras") return encolar;
    if (nombre === "discord_i_tomar_cola") return filas;
    if (nombre === "discord_i_marcar_cola") { w.marcas.push(args); return null; }
    return null;
  };
  w.log = m => w.logs.push(m);
  return w;
}
const peticion = (cabeceras = {}, metodo = "POST") => new Request("https://ejemplo.test/functions/v1/discord-avisos", { method: metodo, headers: cabeceras, body: metodo === "POST" ? "{}" : undefined });

console.log("== Quién puede llamarla");
{
  const w = mundo(); let envios = 0;
  const enviar = async () => { envios++; return { estado: 200 }; };
  let r = await atender(peticion({ "x-discord-clave": CLAVE }), { entorno: entorno(), rpc: w.rpc, enviar, log: w.log });
  ok(r.status === 200 && envios === 1, "con la clave buena publica el aviso");
  envios = 0; const w2 = mundo();
  r = await atender(peticion({ "x-discord-clave": "otra" }), { entorno: entorno(), rpc: w2.rpc, enviar, log: w2.log });
  ok(r.status === 401 && envios === 0 && w2.llamadas.length === 0, "con una clave mala recibe 401 sin tocar la base de datos ni Discord");
  r = await atender(peticion({}), { entorno: entorno(), rpc: w2.rpc, enviar, log: w2.log });
  ok(r.status === 401, "sin clave, 401");
  r = await atender(peticion({ "x-discord-clave": CLAVE + "x" }), { entorno: entorno(), rpc: w2.rpc, enviar, log: w2.log });
  ok(r.status === 401, "una clave con un carácter de más, 401");
  r = await atender(peticion({ "x-discord-clave": CLAVE }, "GET"), { entorno: entorno(), rpc: w2.rpc, enviar, log: w2.log });
  ok(r.status === 405, "un GET no se atiende");
  r = await atender(peticion({ "x-discord-clave": "corta" }), { entorno: entorno({ DISCORD_AVISOS_CLAVE: "corta" }), rpc: w2.rpc, enviar, log: w2.log });
  ok(r.status === 500, "una clave configurada demasiado corta se rechaza (falla cerrado, no abierto)");
  r = await atender(peticion({ "x-discord-clave": "" }), { entorno: entorno({ DISCORD_AVISOS_CLAVE: undefined }), rpc: w2.rpc, enviar, log: w2.log });
  ok(r.status === 500, "sin clave configurada, falla sin dejar pasar a nadie ni siquiera con una clave vacía");
  r = await atender(peticion({ "x-discord-clave": CLAVE }), { entorno: entorno({ DISCORD_BOT_TOKEN: undefined }), rpc: w2.rpc, enviar, log: w2.log });
  ok(r.status === 500, "sin el token del bot, falla");
  const cuerpo = await (await atender(peticion({ "x-discord-clave": CLAVE }), { entorno: entorno(), rpc: mundo().rpc, enviar, log: () => {} })).json();
  ok(JSON.stringify(cuerpo) === JSON.stringify({ encoladas: 1, enviadas: 1, reintentos: 0, fallidas: 0 }), "la respuesta es un resumen de números, sin datos de nadie", JSON.stringify(cuerpo));
}

console.log("== El mensaje de la carrera");
{
  const m = mensajeCarrera(carrera, "https://sitio.test/app/");
  const e = m.embeds[0];
  ok(/La carrera 612 sale en 2 minutos/.test(e.title) && e.description === "Grand Cup of the Spell", "dice cuál es la carrera y cuándo sale");
  const texto = JSON.stringify(m);
  ok(texto.includes("Gran Premio") && texto.includes("Valle de Ceniza"), "usa los nombres del grado y de la pista, no los códigos");
  ok(texto.includes("5.000") || texto.includes("5,000") || texto.includes("5000"), "enseña la bolsa");
  ok(texto.includes("https://sitio.test/app/hipodromo-vivo.html") && texto.includes("https://sitio.test/app/hipodromo.html"), "lleva los enlaces a verla en vivo y a apostar, sin barras dobles");
  ok(texto.includes("<t:1792999940:R>"), "las horas van como marcas de Discord (cada uno las ve en su zona horaria)");
  ok(m.allowed_mentions.parse.length === 0, "no menciona a nadie");
  ok(e.fields.every(f => f.name && f.value && f.value.length <= 1024), "ningún campo vacío ni demasiado largo");
  ok(!/resultado|ganador|favorita|cuota|mercado/i.test(texto), "no menciona ganadores, cuotas ni nada del resultado");
  const raro = mensajeCarrera({ n: 1, nombre: "x".repeat(2000), grado: "inventado", pista: "inventada", hora: 1793000000 }, "https://s.test/");
  ok(raro.embeds[0].description.length <= 300 && raro.embeds[0].fields.every(f => f.value), "con datos raros o larguísimos sigue siendo un mensaje válido");
}

console.log("== Lo que pasa con Discord");
{
  // 200: enviado
  let w = mundo(); const cuerpos = [];
  const bueno = async (canal, cuerpo, nonce) => { cuerpos.push({ canal, cuerpo, nonce }); return { estado: 200 }; };
  let r = await procesar({ rpc: w.rpc, enviar: bueno, sitio: "https://s.test/", log: w.log });
  ok(r.enviadas === 1 && w.marcas[0].p_ok === true, "un envío bueno se apunta como enviado");
  ok(cuerpos[0].canal === "444444444444444444" && cuerpos[0].nonce === "1" && cuerpos[0].cuerpo.enforce_nonce === true, "va al canal de la cola con un nonce (que evita publicarlo dos veces)");
  ok(JSON.stringify(cuerpos[0]).indexOf(TOKEN) === -1, "el token nunca va en el mensaje");

  // 429: espera lo que diga Discord
  w = mundo();
  r = await procesar({ rpc: w.rpc, enviar: async () => ({ estado: 429, reintentoSeg: 7.2 }), sitio: "https://s.test/", log: w.log });
  ok(r.reintentos === 1 && w.marcas[0].p_ok === false && w.marcas[0].p_espera_seg === 8, "con un 429 reintenta cuando Discord dice (7,2 s redondeado a 8)");

  // 5xx y caída
  for (const estado of [500, 502, 503, 0]) {
    w = mundo();
    r = await procesar({ rpc: w.rpc, enviar: async () => ({ estado }), sitio: "https://s.test/", log: w.log });
    ok(r.reintentos === 1 && w.marcas[0].p_ok === false && w.marcas[0].p_espera_seg === 30, `Discord caído (${estado}): se reintenta en 30 s y no se pierde`);
  }

  // 403/404: configuración
  w = mundo();
  r = await procesar({ rpc: w.rpc, enviar: async () => ({ estado: 403, error: "Missing Access" }), sitio: "https://s.test/", log: w.log });
  ok(/403/.test(w.marcas[0].p_error) && /permisos del bot/.test(w.marcas[0].p_error) && w.marcas[0].p_espera_seg === 300, "sin permiso en el canal: deja un error entendible y reintenta en 5 minutos");

  // al quinto intento se cuenta como perdida
  w = mundo({ filas: [fila(1, { intentos: 5 })] });
  r = await procesar({ rpc: w.rpc, enviar: async () => ({ estado: 403 }), sitio: "https://s.test/", log: w.log });
  ok(r.fallidas === 1 && r.reintentos === 0, "el quinto intento fallido se cuenta como perdido");

  // enviar lanza
  w = mundo();
  r = await procesar({ rpc: w.rpc, enviar: async () => { throw new Error("red caída " + TOKEN); }, sitio: "https://s.test/", log: w.log });
  ok(r.reintentos === 1 && w.marcas[0].p_ok === false, "si el envío lanza un error, se trata como fallo y se reintenta");
  ok(w.marcas[0].p_error.length <= 200, "el error guardado se recorta");

  // la base de datos falla
  w = mundo({ falla: { discord_i_encolar_carreras: true } });
  r = await procesar({ rpc: w.rpc, enviar: bueno, sitio: "https://s.test/", log: w.log });
  ok(r.enviadas === 1, "si falla mirar las carreras, igualmente publica lo pendiente");
  w = mundo({ falla: { discord_i_tomar_cola: true } });
  let envios = 0;
  r = await procesar({ rpc: w.rpc, enviar: async () => { envios++; return { estado: 200 }; }, sitio: "https://s.test/", log: w.log });
  ok(r.enviadas === 0 && envios === 0, "si falla leer la cola, no publica nada y no lanza");
  ok(!w.logs.some(l => l.includes(TOKEN)), "los registros no contienen el token");
  w = mundo({ falla: { discord_i_marcar_cola: true } });
  r = await procesar({ rpc: w.rpc, enviar: bueno, sitio: "https://s.test/", log: w.log });
  ok(r.enviadas === 1, "si falla apuntar el resultado, no se rompe (el nonce evita el doble aviso al reintentar)");

  // tipo desconocido
  w = mundo({ filas: [fila(1, { origen: "otra-cosa" })] });
  envios = 0;
  r = await procesar({ rpc: w.rpc, enviar: async () => { envios++; return { estado: 200 }; }, sitio: "https://s.test/", log: w.log });
  ok(envios === 0 && w.marcas[0].p_ok === false, "un tipo de aviso que no conoce no se publica");

  // varios avisos
  w = mundo({ filas: [fila(1), fila(2), fila(3)] });
  let n = 0;
  r = await procesar({ rpc: w.rpc, enviar: async () => ({ estado: ++n === 2 ? 500 : 200 }), sitio: "https://s.test/", log: w.log });
  ok(r.enviadas === 2 && r.reintentos === 1, "si uno falla, los demás salen igualmente");

  // nada que hacer
  w = mundo({ filas: [], encolar: 0 });
  r = await procesar({ rpc: w.rpc, enviar: bueno, sitio: "https://s.test/", log: w.log });
  ok(r.encoladas === 0 && r.enviadas === 0 && !w.llamadas.includes("discord_i_marcar_cola"), "sin nada pendiente no hace nada");
}

console.log(`\n${fallos ? "FALLOS: " + fallos : "Todo bien."} (${bien} comprobaciones correctas)`);
process.exit(fallos ? 1 : 0);
