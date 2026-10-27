// Pruebas de la parte 3 del bot de Discord: /ficha, /avisos, el resumen semanal, las novedades del sitio, las entradas nuevas del compendio y los mensajes
// privados. Sin Discord ni Supabase. Uso: node tools/probar-discord-extras.js        (la parte SQL: docs/pruebas/t_discord_extras.sh)
import { responder, COMANDOS } from "../docs/discord/comandos.js";
import { procesar, revisarIndice, mensajeResumen, mensajeNovedad, mensajeEntradas, mensajeDmCarrera, mensajeDmCria } from "../docs/discord-avisos/avisos.js";

let fallos = 0, bien = 0;
const ok = (c, msg, extra) => { if (c) { bien++; console.log("  OK   " + msg); } else { fallos++; console.log("  FALLA " + msg + (extra ? " -> " + extra : "")); } };
const USUARIO = "123456789012345678";
const inter = (name, options = [], tipo = 2) => ({ type: tipo, application_id: "999", guild_id: "555", member: { user: { id: USUARIO, username: "t" } }, data: { name, options } });
const ctxCon = rpc => ({ rpc, indice: async () => [], sitio: "https://sitio.test/app/", log: () => {} });
const mide = e => {
  const campos = e.fields || [];
  const total = (e.title || "").length + (e.description || "").length + campos.reduce((s, f) => s + f.name.length + f.value.length, 0) + (e.footer?.text || "").length;
  return (e.title || "").length <= 256 && (e.description || "").length <= 4096 && campos.length <= 25 && total <= 6000 &&
    campos.every(f => f.name && f.value && f.name.length <= 256 && f.value.length <= 1024) && (e.footer?.text || "").length <= 2048;
};

const FICHA = { nombre: "Aldric", clase: "Guerrero", subclase: "Campeón", raza: "Humano", trasfondo: "Soldado", alineamiento: "Legal bueno", campania: "La Brecha", nivel: 6, experiencia: 14000,
  pv: 38, pv_max: 52, pv_temp: 5, velocidad: "30 pies", ca: 18, iniciativa: 2, competencia: 3,
  atributos: { fue: { punt: 18, mod: 4 }, des: { punt: 14, mod: 2 }, con: { punt: 16, mod: 3 }, int: { punt: 8, mod: -1 }, sab: { punt: 12, mod: 1 }, car: { punt: 10, mod: 0 } },
  condiciones: "Asustado", resistencias: "necrótico", inmunidades: null, vulnerabilidades: null, monedas: { oro: 120, plata: 5, cobre: 0 },
  ataques: ["Espada larga", "Arco corto"], n_rasgos: 7, n_hechizos: 0, fallecido: false, actualizada: "2026-10-20T10:00:00Z" };
const LISTA = [{ nombre: "Aldric", clase: "Guerrero", nivel: 6 }, { nombre: "Brisa", clase: "Pícara", nivel: 3 }];

console.log("== /ficha");
{
  ok(COMANDOS.length === 15 && COMANDOS.some(c => c.name === "ficha") && COMANDOS.some(c => c.name === "avisos"), "los comandos /ficha y /avisos están en la lista (15 en total)");
  ok(COMANDOS.find(c => c.name === "ficha").options[0].autocomplete === true, "/ficha tiene autocompletado del nombre");
  let llamada;
  let r = await responder(inter("ficha", [{ name: "nombre", value: "ald" }]), ctxCon(async (n, a) => { llamada = { n, a }; return { lista: LISTA, ficha: FICHA }; }));
  const e = r.data.embeds[0];
  ok(r.data.flags === 64 && llamada.n === "discord_i_fichas" && llamada.a.p_discord_id === USUARIO && llamada.a.p_nombre === "ald", "es privado y pide solo las fichas de quien escribe");
  ok(e.title === "Aldric" && /Nivel 6/.test(e.description) && /Guerrero \(Campeón\)/.test(e.description) && /Humano/.test(e.description), "enseña nombre, nivel, clase y raza");
  ok(e.fields.find(f => f.name === "Vida").value.includes("38 / 52") && e.fields.find(f => f.name === "Vida").value.includes("+5 temporales"), "la vida con los puntos temporales");
  ok(e.fields.find(f => f.name === "CA").value === "18" && e.fields.find(f => f.name === "Iniciativa").value === "+2" && e.fields.find(f => f.name === "Competencia").value === "+3", "CA, iniciativa y competencia");
  ok(/\*\*INT\*\* 8 \(−1\)/.test(e.fields.find(f => f.name === "Atributos").value) && /\*\*FUE\*\* 18 \(\+4\)/.test(e.fields.find(f => f.name === "Atributos").value), "los atributos con su modificador (el negativo con signo menos)");
  ok(e.fields.some(f => f.name === "Condiciones" && f.value === "Asustado") && !e.fields.some(f => f.name === "Inmunidades"), "enseña lo que tiene y calla lo que no");
  ok(/Espada larga/.test(e.fields.find(f => f.name === "Ataques").value) && /120 oro/.test(e.fields.find(f => f.name === "Monedas").value), "los ataques y las monedas");
  ok(e.timestamp === "2026-10-20T10:00:00.000Z" && /Solo lo ves tú/.test(e.footer.text), "dice cuándo se guardó por última vez y que es privado");
  ok(!JSON.stringify(e).match(/historia|descripcionFisica|ownerEmail/i), "no hay ni rastro de la historia, la descripción física ni el correo");
  ok(mide(e) && r.data.allowed_mentions.parse.length === 0, "cabe en los límites de Discord y no menciona a nadie");

  r = await responder(inter("ficha"), ctxCon(async () => ({ lista: LISTA, ficha: null })));
  ok(r.data.embeds[0].title === "Tus personajes" && /Aldric/.test(r.data.embeds[0].description) && /Brisa/.test(r.data.embeds[0].description), "sin nombre, da la lista de tus personajes");
  r = await responder(inter("ficha", [{ name: "nombre", value: "zzz" }]), ctxCon(async () => ({ lista: LISTA, ficha: null })));
  ok(/No encontré ninguno que se llame «zzz»/.test(r.data.embeds[0].description) && /Aldric/.test(r.data.embeds[0].description), "un nombre que no existe lo dice y da la lista");
  r = await responder(inter("ficha"), ctxCon(async () => ({ lista: [], ficha: null })));
  ok(/ningún personaje/.test(r.data.content) && r.data.flags === 64, "sin personajes lo dice");
  r = await responder(inter("ficha"), ctxCon(async () => { const x = new Error("Primero vincula tu cuenta: genera un código en la web y usa /vincular."); x.code = "P0001"; throw x; }));
  ok(/Primero vincula/.test(r.data.content), "sin cuenta vinculada enseña el motivo");
  r = await responder(inter("ficha", [{ name: "nombre", value: "otro" }, { name: "usuario", value: "999999999999999999" }]), ctxCon(async (n, a) => { llamada = a; return { lista: LISTA, ficha: FICHA }; }));
  ok(Object.keys(llamada).sort().join() === "p_discord_id,p_nombre" && llamada.p_discord_id === USUARIO, "no hay manera de pedir la ficha de otra persona");
  r = await responder(inter("ficha"), ctxCon(async () => ({ lista: LISTA, ficha: { ...FICHA, nombre: "**@everyone** [x](http://malo.test)", fallecido: true, condiciones: "<@123>", ataques: ["`ataque`"] } })));
  const rd = JSON.stringify(r.data.embeds[0]);
  ok(!rd.includes("**@everyone**") && !rd.includes("[x](http") && !rd.includes("<@123>") && /Fallecido/.test(r.data.embeds[0].description), "los símbolos de Markdown de un nombre no cuelan nada, y un personaje fallecido lo dice");
  r = await responder(inter("ficha"), ctxCon(async () => ({ lista: LISTA, ficha: { nombre: "Sin datos", atributos: {}, ataques: [], monedas: {} } })));
  ok(r.data.embeds[0].title === "Sin datos" && mide(r.data.embeds[0]), "una ficha casi vacía no rompe nada");
  const larga = { ...FICHA, nombre: "N".repeat(500), condiciones: "c".repeat(900), resistencias: "r".repeat(900), ataques: Array.from({ length: 6 }, () => "a".repeat(60)) };
  r = await responder(inter("ficha"), ctxCon(async () => ({ lista: LISTA, ficha: larga })));
  ok(mide(r.data.embeds[0]), "una ficha con textos larguísimos sigue cabiendo");
  const muchas = Array.from({ length: 40 }, (_, i) => ({ nombre: "Personaje " + i, clase: "Clase", nivel: i }));
  r = await responder(inter("ficha"), ctxCon(async () => ({ lista: muchas, ficha: null })));
  ok(mide(r.data.embeds[0]), "con 40 personajes la lista cabe");
}

console.log("== Autocompletado de /ficha");
{
  const ctx = ctxCon(async () => ({ lista: LISTA, ficha: null }));
  let r = await responder(inter("ficha", [{ name: "nombre", value: "", focused: true }], 4), ctx);
  ok(r.type === 8 && r.data.choices.length === 2 && r.data.choices[0].value === "Aldric" && /Guerrero 6/.test(r.data.choices[0].name), "con el campo vacío sugiere tus personajes, con clase y nivel");
  r = await responder(inter("ficha", [{ name: "nombre", value: "bri", focused: true }], 4), ctx);
  ok(r.data.choices.length === 1 && r.data.choices[0].value === "Brisa", "filtra por lo que escribes");
  r = await responder(inter("ficha", [{ name: "nombre", value: "zz", focused: true }], 4), ctx);
  ok(r.data.choices.length === 0, "sin coincidencias, nada");
  const muchas = Array.from({ length: 60 }, (_, i) => ({ nombre: "P" + i + "x".repeat(150), clase: "C", nivel: 1 }));
  r = await responder(inter("ficha", [{ name: "nombre", value: "", focused: true }], 4), ctxCon(async () => ({ lista: muchas, ficha: null })));
  ok(r.data.choices.length === 25 && r.data.choices.every(c => c.name.length <= 100 && c.value.length <= 100), "como mucho 25 sugerencias, y cada una cabe en los límites de Discord");
  r = await responder(inter("ficha", [{ name: "nombre", value: "a", focused: true }], 4), ctxCon(async () => { throw new Error("sin red"); }));
  ok(r.type === 8 && r.data.choices.length === 0, "si falla la base de datos, sin sugerencias y sin error");
  let preguntas = 0;
  await responder(inter("ficha", [{ name: "nombre", value: "a", focused: true }], 4), ctxCon(async (n, a) => { preguntas++; return { lista: [], ficha: null }; }));
  ok(preguntas === 1, "una sugerencia es una sola pregunta, y siempre con p_nombre vacío (no se piden fichas ajenas)");
}

console.log("== /avisos");
{
  let args;
  let r = await responder(inter("avisos"), ctxCon(async (n, a) => { args = a; return { cria: false, carrera: false }; }));
  ok(args.p_cria === null && args.p_carrera === null && r.data.flags === 64 && /▫️ Apagado/.test(JSON.stringify(r.data.embeds[0].fields)), "sin opciones solo enseña el estado, y por defecto todo apagado");
  r = await responder(inter("avisos", [{ name: "cria", value: true }]), ctxCon(async (n, a) => { args = a; return { cria: true, carrera: false }; }));
  ok(args.p_cria === true && args.p_carrera === null && /Listo/.test(r.data.embeds[0].title) && /✅ Activado/.test(r.data.embeds[0].fields[0].value), "activar uno cambia solo ese");
  r = await responder(inter("avisos", [{ name: "cria", value: false }, { name: "carrera", value: true }]), ctxCon(async (n, a) => { args = a; return { cria: false, carrera: true }; }));
  ok(args.p_cria === false && args.p_carrera === true, "se pueden cambiar los dos a la vez");
  r = await responder(inter("avisos", [{ name: "cria", value: "sí" }]), ctxCon(async (n, a) => { args = a; return { cria: false, carrera: false }; }));
  ok(args.p_cria === null, "un valor que no es sí o no se ignora");
  ok(/mensajes directos/.test(r.data.embeds[0].description) && /no insisto/.test(r.data.embeds[0].description), "explica lo de los mensajes directos y que no insiste");
  r = await responder(inter("avisos", [{ name: "usuario", value: "999" }]), ctxCon(async (n, a) => { args = a; return { cria: false, carrera: false }; }));
  ok(Object.keys(args).sort().join() === "p_carrera,p_cria,p_discord_id" && args.p_discord_id === USUARIO, "solo se tocan los avisos de quien escribe");
}

console.log("== Los mensajes nuevos");
{
  const sitio = "https://sitio.test/app/";
  const res = mensajeResumen({ racha: { user: "Ana", racha: 7 }, apuesta: { user: "Beto", monto: 100, pago: 650, mult: 6.5, criaturas: ["Brasa"] }, cartas: [{ nombre: "Dragón Dorado", rareza: "legendaria", user: "Caro" }, { nombre: "Rata", rareza: "rara", user: "Ana" }], total_cartas: 9 }, sitio);
  const campos = res.embeds[0].fields;
  ok(campos.length === 3 && /Ana: 7 victorias/.test(campos[0].value) && /650/.test(campos[1].value) && /6,5 veces/.test(campos[1].value) && /Dragón Dorado \(Legendaria\), de Caro/.test(campos[2].value) && /9 ganadas/.test(campos[2].name), "el resumen semanal trae la racha, la apuesta y las cartas con sus nombres");
  ok(mide(res.embeds[0]) && res.allowed_mentions.parse.length === 0, "cabe en los límites de Discord y no menciona a nadie");
  ok(mensajeResumen({ racha: null, apuesta: null, cartas: [], total_cartas: 0 }, sitio) === null, "una semana sin nada no se publica");
  ok(mensajeResumen({ racha: { user: "Ana", racha: 3 } }, sitio).embeds[0].fields.length === 1, "solo sale lo que hubo");
  const rar = mensajeResumen({ racha: { user: "**@everyone**", racha: 3 } }, sitio);
  ok(!rar.embeds[0].fields[0].value.includes("**@everyone**"), "un nombre con Markdown se escapa");

  const nov = mensajeNovedad({ titulo: "Copas semanales", texto: "Cada semana hay tres copas.", enlace: "hipodromo.html" }, sitio);
  ok(nov.embeds[0].title === "🆕 Copas semanales" && nov.embeds[0].description.includes("https://sitio.test/app/hipodromo.html"), "una novedad lleva su título y su enlace");
  ok(!mensajeNovedad({ titulo: "x", texto: "y", enlace: "javascript:alert(1)" }, sitio).embeds[0].description.includes("javascript"), "un enlace raro no entra");
  ok(mensajeNovedad({ titulo: "", texto: "x" }, sitio) === null, "sin título no se publica");
  ok(mide(mensajeNovedad({ titulo: "T".repeat(500), texto: "x".repeat(5000) }, sitio).embeds[0]), "una novedad enorme se recorta");

  const ent = mensajeEntradas({ total: 12, items: Array.from({ length: 8 }, (_, i) => ({ t: "Entrada " + i, c: "Lugares", p: "compendio.html#e=e" + i })) }, sitio);
  ok(/12 entradas nuevas/.test(ent.embeds[0].title) && /y 4 más/.test(ent.embeds[0].description) && /\[Entrada 0\]\(https:\/\/sitio\.test\/app\/compendio\.html#e=e0\)/.test(ent.embeds[0].description), "las entradas nuevas salen con su enlace y cuántas más hay");
  ok(/Una entrada nueva/.test(mensajeEntradas({ total: 1, items: [{ t: "Sola", c: "Bestiario", p: "compendio.html#e=sola" }] }, sitio).embeds[0].title), "una sola, en singular");
  ok(mensajeEntradas({ total: 0, items: [] }, sitio) === null, "sin entradas no se publica");
  ok(!/(^|[^\\])\]\(http:\/\/malo/.test(mensajeEntradas({ total: 1, items: [{ t: "[x](http://malo.test)", c: "C", p: "http://malo.test" }] }, sitio).embeds[0].description), "un título con corchetes y un enlace raro no cuelan nada");

  const dm = mensajeDmCarrera({ n: 700, nombre: "Copa de prueba", hora: 1793000000, criaturas: [{ nombre: "Brasa", puerta: "3" }, { nombre: "Ceniza", puerta: "5" }] }, sitio);
  ok(/Tus criaturas corren/.test(dm.embeds[0].title) && /Brasa \(puerta 3\)/.test(dm.embeds[0].description) && /<t:1793000000:R>/.test(dm.embeds[0].description) && /\/avisos/.test(dm.embeds[0].footer.text), "el aviso privado de una carrera dice qué criaturas, en qué puerta y cuándo, y cómo apagarlo");
  ok(/Tu criatura corre/.test(mensajeDmCarrera({ n: 1, nombre: "x", hora: 1793000000, criaturas: [{ nombre: "A", puerta: "1" }] }, sitio).embeds[0].title), "con una sola, en singular");
  ok(mensajeDmCarrera({ n: 1, criaturas: [] }, sitio) === null, "sin criaturas no hay aviso");
  const cria = mensajeDmCria({ cria: "Hidra" }, sitio);
  ok(/cría de Hidra/.test(cria.embeds[0].description) && cria.embeds[0].description.includes("https://sitio.test/app/corrales.html"), "el aviso privado de una cría lleva su enlace a los corrales");
}

console.log("== Novedades y entradas nuevas desde el índice");
{
  const indice = { novedades: [{ clave: "2026-10-26|Algo", fecha: "2026-10-26", titulo: "Algo", texto: "x", enlace: "mapa.html" }, { clave: "2026-10-01|Viejo", fecha: "2026-10-01", titulo: "Viejo", texto: "y", enlace: null }],
    entradas: [{ id: "a", t: "A", c: "Lugares", l: null, p: "compendio.html#e=a" }, { id: "b", t: "B", c: "Personajes", l: ["B"], p: "compendio.html#e=b" }, { id: "c", t: "C", c: "Bestiario", l: [], p: "compendio.html#e=c" }] };
  const obtenerOk = async () => ({ ok: true, json: async () => indice });
  const mundo = ({ toca = true, nuevas = ["a", "b", "c"] } = {}) => {
    const w = { llamadas: [], args: {} };
    w.rpc = async (n, a) => { w.llamadas.push(n); w.args[n] = a; if (n === "discord_i_indice_toca") return toca; if (n === "discord_i_encolar_novedad") return 1; if (n === "discord_i_indice_nuevas") return nuevas; if (n === "discord_i_encolar_entradas") return 1; return 0; };
    return w;
  };
  let w = mundo();
  let n = await revisarIndice({ rpc: w.rpc, obtener: obtenerOk, sitio: "https://s.test/" });
  ok(w.llamadas.filter(x => x === "discord_i_encolar_novedad").length === 2 && n === 3, "manda cada novedad a la base de datos (ella decide cuáles son recientes) y las entradas nuevas");
  ok(w.args.discord_i_encolar_entradas.p_items.map(i => i.id).join() === "a,c", "de las entradas nuevas solo salen las que no son de un Side (la b es del Side B y no se anuncia)");
  ok(w.args.discord_i_indice_nuevas.p_ids.join() === "a,b,c", "y se apuntan todas, también las de un Side, para no anunciarlas más tarde");
  w = mundo({ toca: false });
  let bajadas = 0;
  n = await revisarIndice({ rpc: w.rpc, obtener: async () => { bajadas++; return { ok: true, json: async () => indice }; }, sitio: "https://s.test/" });
  ok(n === 0 && bajadas === 0 && w.llamadas.length === 1, "si no toca (hace menos de 10 minutos o sin canal), no baja el índice");
  w = mundo({ nuevas: [] });
  n = await revisarIndice({ rpc: w.rpc, obtener: obtenerOk, sitio: "https://s.test/" });
  ok(!w.llamadas.includes("discord_i_encolar_entradas"), "sin entradas nuevas no anuncia nada");
  const logs = [];
  w = mundo();
  n = await revisarIndice({ rpc: w.rpc, obtener: async () => ({ ok: false, status: 404 }), sitio: "https://s.test/", log: m => logs.push(m) });
  ok(n === 0 && logs.length === 1 && !w.llamadas.includes("discord_i_encolar_novedad"), "si el índice no se puede bajar, lo apunta y no hace nada más");
  n = await revisarIndice({ rpc: w.rpc, obtener: async () => { throw new Error("sin red"); }, sitio: "https://s.test/", log: m => logs.push(m) });
  ok(n === 0, "sin red tampoco rompe");
  w = mundo();
  n = await revisarIndice({ rpc: w.rpc, obtener: async () => ({ ok: true, json: async () => ({ nada: 1 }) }), sitio: "https://s.test/" });
  ok(n === 0 && !w.llamadas.includes("discord_i_encolar_entradas"), "un índice raro no rompe");
  const rpcCae = async (nombre) => { if (nombre === "discord_i_indice_toca") { const e = new Error("no existe"); e.code = "42883"; throw e; } return 0; };
  n = await revisarIndice({ rpc: rpcCae, obtener: obtenerOk, sitio: "https://s.test/", log: m => logs.push(m) });
  ok(n === 0, "si falta el SQL (todavía no se ejecutó docs/discord-3_extras.sql), no rompe");
}

console.log("== La cola con mensajes privados y las pasadas completas");
{
  const marcas = [], envios = [];
  const filas = [
    { id: 1, origen: "dm", clave: "dm:cria:1", canal_id: "dm:123456789012345678", contenido: { tipo: "dm_cria", cria: "Hidra" }, intentos: 1 },
    { id: 2, origen: "resumen", clave: "resumen:2026-43:cronica_a", canal_id: "444444444444444441", contenido: { tipo: "resumen_semanal", racha: { user: "Ana", racha: 5 }, cartas: [], total_cartas: 0 }, intentos: 1 },
    { id: 3, origen: "novedad", clave: "novedad:x", canal_id: "444444444444444444", contenido: { tipo: "novedad", titulo: "Algo", texto: "x" }, intentos: 1 },
    { id: 4, origen: "dm", clave: "dm:cria:2", canal_id: "dm:222222222222222222", contenido: { tipo: "dm_cria", cria: "Rata" }, intentos: 1 },
    { id: 5, origen: "dm", clave: "dm:x", canal_id: "dm:333333333333333333", contenido: { tipo: "dm_raro" }, intentos: 1 }];
  const rpc = async (n, a) => { if (n === "discord_i_tomar_cola") return filas; if (n === "discord_i_marcar_cola") marcas.push(a); return 0; };
  const r = await procesar({ rpc, sitio: "https://s.test/", enviar: async (canal, cuerpo, nonce) => { envios.push({ canal, nonce }); return canal === "dm:222222222222222222" ? { estado: 403, codigo: 50007, error: "Cannot send messages to this user" } : { estado: 200 }; } });
  ok(envios.length === 4 && envios[0].canal === "dm:123456789012345678", "los mensajes privados se mandan con su destino «dm:<id>»");
  ok(r.enviadas === 3, "se envían los privados, el resumen y la novedad", JSON.stringify(r));
  const m4 = marcas.find(x => x.p_id === 4);
  ok(m4.p_ok === false && m4.p_espera_seg === 0 && /no acepta mensajes privados/.test(m4.p_error), "si alguien no acepta mensajes privados, se da por perdido enseguida (espera 0) y con un motivo claro");
  ok(marcas.find(x => x.p_id === 5).p_ok === false && marcas.find(x => x.p_id === 5).p_espera_seg === 900, "un aviso privado de un tipo desconocido no se manda");
  const rpc2 = async (n) => { if (["discord_i_encolar_resumen", "discord_i_encolar_novedades_admin", "discord_i_encolar_personales"].includes(n)) throw Object.assign(new Error("does not exist"), { code: "42883" }); if (n === "discord_i_tomar_cola") return [filas[2]]; return 0; };
  const logs = [];
  const r2 = await procesar({ rpc: rpc2, enviar: async () => ({ estado: 200 }), sitio: "https://s.test/", log: m => logs.push(m) });
  ok(r2.enviadas === 1 && logs.length === 3, "si falta el SQL de lo nuevo, cada fallo se apunta y lo demás sigue funcionando");
  const llamadas = [];
  await procesar({ rpc: async (n) => { llamadas.push(n); return n === "discord_i_tomar_cola" ? [] : 0; }, enviar: async () => ({ estado: 200 }), sitio: "https://s.test/" });
  ok(["discord_i_encolar_carreras", "discord_i_encolar_cronica", "discord_i_encolar_resumen", "discord_i_encolar_novedades_admin", "discord_i_encolar_personales", "discord_i_indice_toca"].every(x => llamadas.includes(x)), "cada pasada pide a la base de datos todo lo que puede haber que avisar");
}

console.log(`\n${fallos ? "FALLOS: " + fallos : "Todo bien."} (${bien} comprobaciones correctas)`);
process.exit(fallos ? 1 : 0);
