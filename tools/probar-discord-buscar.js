// Pruebas de la búsqueda del compendio para el bot de Discord (/buscar): el texto, el índice generado desde data/*.js, la visibilidad por Side,
// el orden de los resultados, el autocompletado, los parches de Admin y los límites de tamaño de Discord. Sin Discord ni Supabase.
// Uso: node tools/probar-discord-buscar.js
import fs from "node:fs";
import { aTexto, normalizar, extracto, fragmento } from "../docs/discord/texto.js";
import { aplicarParches, buscar, cargarIndice, embedDetalle, embedLista, entradaVisible, olvidarIndice, subseccionVisible, sugerencias } from "../docs/discord/buscar.js";
import { responder, olvidarAccesos } from "../docs/discord/comandos.js";
import { cargarDatos, construirIndice } from "./generar-indice-discord.js";

let fallos = 0, bien = 0;
const ok = (c, msg, extra) => { if (c) { bien++; console.log("  OK   " + msg); } else { fallos++; console.log("  FALLA " + msg + (extra ? " -> " + extra : "")); } };

console.log("== Texto");
{
  ok(aTexto("<p>Hola <strong>mundo</strong>.</p><p>Otra &amp; &quot;cosa&quot; &#233; &#x41;</p>") === 'Hola mundo.\n\nOtra & "cosa" é A', "quita las etiquetas y decodifica entidades", JSON.stringify(aTexto("<p>Hola <strong>mundo</strong>.</p><p>Otra &amp; &quot;cosa&quot; &#233; &#x41;</p>")));
  ok(aTexto("<ul><li>uno</li><li>dos</li></ul>") === "• uno\n• dos", "las listas llevan viñeta");
  ok(aTexto("<p>una frase partida\n   en dos líneas del código</p>\n<p>otro</p>") === "una frase partida en dos líneas del código\n\notro", "un salto de línea dentro de un párrafo no parte el texto en Discord", JSON.stringify(aTexto("<p>una frase partida\n   en dos líneas del código</p>\n<p>otro</p>")));
  ok(aTexto("a<br>b") === "a\nb", "pero un <br> sí es un salto");
  ok(!aTexto("<script>alert(1)</script><style>.x{}</style>texto").includes("alert") && aTexto("<script>x</script>texto") === "texto", "no deja pasar el contenido de script ni style");
  ok(aTexto("<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>").split("\n").length === 2, "las tablas se leen fila por fila");
  ok(aTexto(null) === "" && aTexto(undefined) === "" && aTexto("") === "", "entradas vacías");
  ok(aTexto("&#99999999999;&#0;") === "", "una entidad numérica imposible no rompe nada");
  ok(normalizar("Dracología – ¡Fundamentos!") === "dracologia fundamentos" && normalizar(null) === "", "normalizar quita tildes y signos");
  const largo = "Primera frase. ".repeat(100);
  const ex = extracto(largo, 200);
  ok(ex.length <= 205 && ex.endsWith("…"), "un extracto largo se corta con puntos suspensivos", String(ex.length));
  ok(extracto("corto", 200) === "corto", "uno corto se deja igual");
  ok(fragmento("Los dragones viven en Relania desde hace siglos.", ["relania"], 30).includes("Relania"), "el fragmento enseña dónde aparece la palabra");
  ok(fragmento("sin nada", ["zzz"]) === "", "sin coincidencia no devuelve nada");
}

console.log("== El índice generado");
const datos = cargarDatos();
const idx = construirIndice(datos);
const E = idx.entradas;
{
  const total = ["ENTRIES", "PERSONAJES", "LUGARES", "FACCIONES", "PERGAMINOS", "ARMAS", "BESTIARIO", "RAZAS", "RELIGIONES", "OBJETOS", "CRONOLOGIA_A", "CRONOLOGIA_B", "REGLAS", "ECONOMIA"].reduce((s, k) => s + (datos[k] || []).length, 0);
  ok(E.length === total, `trae todas las entradas de los archivos (${E.length})`, `${E.length} frente a ${total}`);
  ok(new Set(E.map(e => e.id)).size === E.length, "ningún identificador se repite");
  ok(E.every(e => e.t && typeof e.x === "string" && Array.isArray(e.g) && Array.isArray(e.d)), "todas tienen título, texto, etiquetas y datos");
  ok(!JSON.stringify(E).includes("<p>") && !JSON.stringify(E).includes("<div"), "no queda HTML en ninguna");
  const conLado = (datos.PERSONAJES || []).filter(p => Array.isArray(p.lado) && p.lado.length);
  ok(conLado.length > 0 && conLado.every(p => JSON.stringify(E.find(e => e.id === p.id).l) === JSON.stringify(p.lado)), `cada personaje conserva su lado (${conLado.length} con lado)`);
  ok(E.filter(e => e.c === "Cronología (Side A)").every(e => e.l.join() === "A") && E.filter(e => e.c === "Cronología (Side B)").every(e => e.l.join() === "B"), "las cronologías de cada Side llevan su lado");
  // Campos solo para el GM: nunca deben llegar al índice
  const gm = [];
  for (const k of ["ENTRIES", "PERSONAJES", "LUGARES", "FACCIONES", "PERGAMINOS", "ARMAS", "BESTIARIO", "RAZAS", "RELIGIONES", "OBJETOS"]) for (const e of datos[k] || []) if (e.datosGM) gm.push(aTexto(e.datosGM).slice(0, 50));
  ok(gm.every(t => !t || !JSON.stringify(E).includes(t.replace(/"/g, '\\"'))), `ningún dato solo para el GM entra en el índice (${gm.length} entradas lo tienen)`);
  ok(!E.some(e => "datosGM" in e), "ninguna entrada trae un campo datosGM");
  const subs = E.filter(e => e.s && e.s.length);
  ok(subs.length === (datos.LUGARES || []).filter(l => l.subsecciones && l.subsecciones.length).length && subs.every(e => e.s.every(s => /^(A|B|AB)$/.test(s.l))), `las subsecciones por lado se conservan (${subs.length} lugares)`);
  // El archivo subido tiene que ser el de hoy: si no, hay que regenerarlo
  let actual = null; try { actual = JSON.parse(fs.readFileSync(new URL("../data/discord-indice.json", import.meta.url), "utf8")); } catch (e) { /* no existe */ }
  ok(actual && JSON.stringify(actual.entradas) === JSON.stringify(E), "data/discord-indice.json está al día con data/*.js (si falla: node tools/generar-indice-discord.js)");
}

console.log("== Quién ve qué");
const A = { vinculado: true, side: "A", veAmbos: false }, B = { vinculado: true, side: "B", veAmbos: false }, TODOS = { vinculado: true, side: "A", veAmbos: true }, SIN = { vinculado: false, side: null, veAmbos: false };
{
  const soloB = E.find(e => e.l && e.l.join() === "B" && e.c === "Personajes");
  const soloA = E.find(e => e.l && e.l.join() === "A" && e.c === "Personajes");
  ok(soloA && soloB, "hay personajes solo de un Side para probar");
  ok(entradaVisible(soloB, B) && !entradaVisible(soloB, A) && !entradaVisible(soloB, SIN) && entradaVisible(soloB, TODOS), "una entrada del Side B: la ve B y quien lo ve todo, no A ni quien no vinculó");
  ok(entradaVisible(soloA, A) && !entradaVisible(soloA, B) && !entradaVisible(soloA, SIN), "y al revés con el Side A");
  const libre = E.find(e => !e.l && e.c === "Lugares");
  ok(entradaVisible(libre, SIN) && entradaVisible(libre, A) && entradaVisible(libre, B), "una entrada sin lado la ve cualquiera, incluso sin vincular");
  ok(entradaVisible(libre, undefined) && !entradaVisible(soloB, undefined) && !entradaVisible(soloB, {}), "sin datos de acceso solo se ve lo libre (falla cerrado)");
  const conSub = E.find(e => e.s && e.s.some(s => s.l === "B"));
  const subB = conSub.s.find(s => s.l === "B");
  ok(subseccionVisible(subB, B) && subseccionVisible(subB, TODOS) && !subseccionVisible(subB, A) && !subseccionVisible(subB, SIN), "una subsección del Side B solo la ve B o quien lo ve todo");
  const subAB = E.flatMap(e => e.s || []).find(s => s.l === "AB");
  if (subAB) ok(subseccionVisible(subAB, A) && subseccionVisible(subAB, B) && !subseccionVisible(subAB, SIN), "una subsección A+B la ven los dos Sides, no quien no vinculó");
  // La búsqueda por el nombre exacto de algo del otro Side no lo encuentra, ni siquiera sugerido
  const porNombreA = buscar(E, soloB.t, A, { limite: 25 }).map(h => h.e.id);
  ok(!porNombreA.includes(soloB.id), "buscar por el nombre exacto de algo del Side B siendo del A no lo devuelve");
  ok(!sugerencias(E, soloB.t, A).some(s => s.value === "id:" + soloB.id) && !sugerencias(E, soloB.t, SIN).some(s => s.value === "id:" + soloB.id), "ni el autocompletado lo sugiere");
  ok(buscar(E, soloB.t, B, { limite: 5 }).some(h => h.e.id === soloB.id), "pero a su Side sí se lo da");
  // Ninguna consulta puede sacar texto del otro Side: se busca una frase del cuerpo de una entrada del Side B
  const frase = normalizar(soloB.x).split(" ").filter(p => p.length > 6).slice(0, 3).join(" ");
  if (frase) ok(!buscar(E, frase, A, { limite: 25 }).some(h => h.e.id === soloB.id), "una frase del cuerpo de una entrada del otro Side tampoco la encuentra");
}

console.log("== Orden de los resultados");
{
  const r = buscar(E, "dracologia", SIN, { limite: 8 });
  ok(r.length > 0 && /dracolog/i.test(r[0].e.t.normalize("NFD").replace(/[̀-ͯ]/g, "")), "sin tildes encuentra «Fundamentos de la Dracología»", r[0]?.e.t);
  const exacto = E.find(e => !e.l && e.c === "Bestiario");
  const re = buscar(E, exacto.t.toUpperCase(), SIN, { limite: 5 });
  ok(re[0].e.id === exacto.id && re[0].puntos >= 1000 - 1, "el título exacto va primero, sin importar mayúsculas");
  ok(buscar(E, "xqzwv", SIN).length === 0 && buscar(E, "", SIN).length === 0 && buscar(E, "  ", SIN).length === 0 && buscar(E, "a", SIN).length === 0, "sin coincidencias, vacío o una sola letra: nada");
  const solo = buscar(E, "dragon", SIN, { categoria: "Bestiario", limite: 20 });
  ok(solo.length > 0 && solo.every(h => h.e.c === "Bestiario"), "el filtro de categoría solo deja esa categoría");
  ok(buscar(E, "ciudad", SIN, { limite: 3 }).length <= 3, "respeta el límite pedido");
  const dos = buscar(E, "dragon relania", SIN, { limite: 30 });
  ok(dos.every(h => { const n = normalizar([h.e.t, h.e.c, ...h.e.g, h.e.r, ...h.e.d.map(d => d[1]), h.e.x].join(" ")); return n.includes("dragon") && n.includes("relania"); }), "con dos palabras salen solo las que tienen las dos");
  ok(buscar(E, "la de el", SIN).length >= 0, "una consulta de solo palabras vacías no rompe nada");
  const eco = buscar(E, "escudo", SIN, { categoria: "Economía" });
  ok(Array.isArray(eco), "se puede buscar en Economía");
  ok(buscar(E, "cronologia", SIN, { categoria: "Cronología" }).every(h => h.e.l === null || h.e.l.length === 0) , "las cronologías por Side no aparecen sin vincular");
  const a = buscar(E, "capitulo", A, { categoria: "Cronología", limite: 30 }), b = buscar(E, "capitulo", B, { categoria: "Cronología", limite: 30 });
  ok(a.every(h => h.e.l.join() === "A") && b.every(h => h.e.l.join() === "B"), "cada Side ve solo su cronología");
}

console.log("== Parches del panel de Admin");
{
  const base = [
    { id: "a", t: "Aldea Vieja", c: "Lugares", g: [], r: "r", l: null, x: "texto viejo", d: [], p: "compendio.html#e=a" },
    { id: "b", t: "Bruja", c: "Bestiario", g: [], r: "", l: null, x: "", d: [], p: "compendio.html#e=b" },
    { id: "c", t: "Carlos", c: "Personajes", g: [], r: "", l: ["A"], x: "", d: [], p: "compendio.html#e=c" }];
  const r = aplicarParches(base, [
    { coleccion: "LUGARES", clave: "a", data: { title: "Aldea Nueva", content: "<p>texto <b>nuevo</b></p>", lado: ["B"] }, borrado: false },
    { coleccion: "BESTIARIO", clave: "b", data: {}, borrado: true },
    { coleccion: "PERSONAJES", clave: "c", data: { lado: null }, borrado: false },
    { coleccion: "LUGARES", clave: "d", data: { id: "d", title: "Recién creada", category: "Lugares", content: "<p>hola</p>" }, borrado: false },
    { coleccion: "MAPA_PUNTOS", clave: "z", data: { title: "no editable" }, borrado: false },
    null, { coleccion: "LUGARES" }]);
  ok(r.find(e => e.id === "a").t === "Aldea Nueva" && r.find(e => e.id === "a").x === "texto nuevo", "un parche cambia título y texto (y le quita el HTML)");
  ok(JSON.stringify(r.find(e => e.id === "a").l) === '["B"]', "también el lado");
  ok(!r.some(e => e.id === "b"), "un parche de borrado quita la entrada");
  ok(r.find(e => e.id === "c").l === null, "un parche con lado nulo la deja para todos");
  ok(r.find(e => e.id === "d")?.t === "Recién creada", "una entrada creada desde la web aparece");
  ok(!r.some(e => e.t === "no editable"), "una colección que el índice no conoce se ignora");
  ok(base.find(e => e.id === "a").t === "Aldea Vieja", "no se modifica el índice original");
  ok(!entradaVisible(r.find(e => e.id === "a"), A) && entradaVisible(r.find(e => e.id === "a"), B), "y el lado nuevo se respeta al buscar");
}

console.log("== Carga del índice");
{
  olvidarIndice();
  let t = 0; const ahora = () => t; let llamadas = 0, modo = "ok";
  const obtener = async () => { llamadas++; if (modo === "caido") throw new Error("sin red"); if (modo === "roto") return { ok: true, json: async () => ({ nada: 1 }) }; if (modo === "500") return { ok: false, status: 500 }; return { ok: true, json: async () => ({ entradas: [{ id: "x", t: "X", c: "C", g: [], r: "", l: null, x: "", d: [], p: "" }] }) }; };
  let parchesLlamadas = 0, parchesModo = "ok";
  const parches = async () => { parchesLlamadas++; if (parchesModo === "falla") throw new Error("sin tabla"); return [{ coleccion: "LUGARES", clave: "x", data: { title: "Parcheada" }, borrado: false }]; };
  let e = await cargarIndice({ sitio: "https://s.test/", obtener, parches, ahora });
  ok(e[0].t === "Parcheada" && llamadas === 1 && parchesLlamadas === 1, "la primera vez baja el índice y los parches");
  await cargarIndice({ sitio: "https://s.test/", obtener, parches, ahora });
  ok(llamadas === 1 && parchesLlamadas === 1, "la segunda vez usa lo guardado");
  t = 61000; await cargarIndice({ sitio: "https://s.test/", obtener, parches, ahora });
  ok(llamadas === 1 && parchesLlamadas === 2, "a los 60 s vuelve a pedir los parches pero no el índice");
  t = 11 * 60000; modo = "caido";
  e = await cargarIndice({ sitio: "https://s.test/", obtener, parches, ahora });
  ok(e.length === 1, "si el sitio no contesta usa la copia que ya tenía");
  for (const m of ["roto", "500"]) { modo = m; t += 11 * 60000; e = await cargarIndice({ sitio: "https://s.test/", obtener, parches, ahora }); ok(e.length === 1, `índice «${m}»: sigue con la copia buena`); }
  olvidarIndice(); modo = "ok"; t = 0; parchesModo = "falla";
  e = await cargarIndice({ sitio: "https://s.test/", obtener, parches, ahora });
  ok(e[0].t === "X", "si fallan los parches usa el índice tal cual");
  olvidarIndice(); modo = "caido";
  let lanzo = false; try { await cargarIndice({ sitio: "https://s.test/", obtener, parches, ahora }); } catch { lanzo = true; }
  ok(lanzo, "sin copia anterior y sin red, avisa (el comando contesta con un error corriente)");
  olvidarIndice();
}

console.log("== El comando /buscar");
const USUARIO = "123456789012345678";
const inter = (opciones, tipo = 2, extra = {}) => ({ type: tipo, application_id: "999", guild_id: "555", member: { user: { id: USUARIO, username: "t" } }, data: { name: "buscar", options: opciones }, ...extra });
const ctxCon = (acceso, entradas = E) => ({ rpc: async (n) => { if (n === "discord_i_acceso") return { vinculado: acceso.vinculado, side: acceso.side, ve_ambos: acceso.veAmbos }; throw new Error("no esperado " + n); }, indice: async () => entradas, sitio: "https://sitio.test/app/", log: () => {} });
const mide = (e) => {
  const campos = e.fields || [];
  const total = (e.title || "").length + (e.description || "").length + campos.reduce((s, f) => s + f.name.length + f.value.length, 0) + (e.footer?.text || "").length + (e.author?.name || "").length;
  return (e.title || "").length <= 256 && (e.description || "").length <= 4096 && campos.length <= 25 && total <= 6000 &&
    campos.every(f => f.name && f.value && f.name.length <= 256 && f.value.length <= 1024) && (e.footer?.text || "").length <= 2048 && (e.author?.name || "").length <= 256;
};
{
  olvidarAccesos();
  const exacto = E.find(e => !e.l && e.c === "Bestiario" && e.t.length > 5);
  let r = await responder(inter([{ name: "consulta", value: exacto.t }]), ctxCon(SIN));
  ok(r.type === 4 && r.data.flags === 64 && r.data.embeds[0].title === exacto.t, "un título exacto da el detalle de la entrada, en privado");
  ok(r.data.embeds[0].url === "https://sitio.test/app/" + exacto.p && r.data.allowed_mentions.parse.length === 0, "con su enlace al sitio y sin menciones");
  r = await responder(inter([{ name: "consulta", value: "id:" + exacto.id }]), ctxCon(SIN));
  ok(r.data.embeds[0].title === exacto.t, "una sugerencia del autocompletado (id:...) abre esa entrada");
  const soloB = E.find(e => e.l && e.l.join() === "B" && e.c === "Personajes");
  r = await responder(inter([{ name: "consulta", value: "id:" + soloB.id }]), ctxCon(A));
  ok(r.data.content && /No encontré esa entrada/.test(r.data.content) && !JSON.stringify(r).includes(soloB.t), "un id de otro Side, escrito a mano, contesta que no existe y no revela el título");
  olvidarAccesos();
  r = await responder(inter([{ name: "consulta", value: "id:" + soloB.id }]), ctxCon(B));
  ok(r.data.embeds && r.data.embeds[0].title === soloB.t, "a su propio Side sí se la da");
  r = await responder(inter([{ name: "consulta", value: "id:no-existe" }]), ctxCon(B));
  ok(/No encontré/.test(r.data.content), "un id que no existe");
  r = await responder(inter([{ name: "consulta", value: "dragon" }]), ctxCon(SIN));
  ok(r.data.embeds && r.data.embeds[0].description && mide(r.data.embeds[0]), "una búsqueda general da una lista o un detalle válidos para Discord");
  r = await responder(inter([{ name: "consulta", value: "xqzwv" }]), ctxCon(SIN));
  ok(/No encontré nada/.test(r.data.content), "sin resultados lo dice");
  r = await responder(inter([{ name: "consulta", value: "dragon" }, { name: "categoria", value: "Armas" }]), ctxCon(SIN));
  ok(r.data.content ? /en Armas/.test(r.data.content) : r.data.embeds[0].description.length > 0, "con categoría lo recuerda si no hay nada");
  r = await responder(inter([{ name: "consulta", value: "a" }]), ctxCon(SIN));
  ok(/al menos 2 letras/.test(r.data.content), "una letra se rechaza");
  r = await responder(inter([{ name: "consulta", value: "x".repeat(500) }]), ctxCon(SIN));
  ok(r.data.content || r.data.embeds, "una consulta enorme no rompe nada");
  // Todas las entradas generan un detalle válido
  let malas = [];
  for (const e of E) { const emb = embedDetalle(e, TODOS, "https://sitio.test/app/", []); if (!mide(emb) || !emb.description) malas.push(e.id); }
  ok(malas.length === 0, `las ${E.length} entradas del compendio dan un detalle que cabe en Discord`, malas.slice(0, 5).join(","));
  const lista = embedLista(buscar(E, "ciudad", TODOS, { limite: 8 }), "ciudad", "https://sitio.test/app/");
  ok(mide(lista) && !/\]\([^)]*\]/.test(lista.description), "la lista de resultados cabe y sus enlaces están bien formados");
  const raro = embedLista([{ e: { id: "z", t: "Título [con] corchetes", c: "C", r: "r", x: "", p: "compendio.html#e=z" }, puntos: 1, donde: "datos" }], "titulo", "https://s.test/");
  ok(!raro.description.includes("[con]"), "los corchetes del título no rompen el enlace");
  // Detalle de un lugar con subsecciones: cada Side ve las suyas
  const conSub = E.find(e => e.s && e.s.some(s => s.l === "B") && e.s.some(s => s.l === "A"));
  if (conSub) {
    const dA = embedDetalle(conSub, A, "https://s.test/", []), dB = embedDetalle(conSub, B, "https://s.test/", []), dS = embedDetalle(conSub, SIN, "https://s.test/", []);
    const nombres = emb => emb.fields.filter(f => f.name.startsWith("Dentro de")).map(f => f.name).join("|");
    ok(nombres(dA) !== nombres(dB) && nombres(dS) === "", "el detalle de un lugar enseña las subsecciones de cada Side, y ninguna sin vincular");
  } else ok(true, "(ningún lugar tiene subsecciones de los dos lados; se omite la prueba)");
}

console.log("== Autocompletado");
{
  olvidarAccesos();
  const soloB = E.find(e => e.l && e.l.join() === "B" && e.c === "Personajes");
  let r = await responder(inter([{ name: "consulta", value: "dragon", focused: true, type: 3 }], 4), ctxCon(SIN));
  ok(r.type === 8 && Array.isArray(r.data.choices) && r.data.choices.length > 0 && r.data.choices.length <= 25, "responde con hasta 25 sugerencias (tipo 8)");
  ok(r.data.choices.every(c => c.name.length <= 100 && c.value.length <= 100 && /^id:/.test(c.value)), "cada sugerencia cabe en los límites de Discord");
  r = await responder(inter([{ name: "consulta", value: "d", focused: true }], 4), ctxCon(SIN));
  ok(r.type === 8 && r.data.choices.length === 0, "con una sola letra no sugiere nada");
  r = await responder(inter([{ name: "consulta", value: soloB.t, focused: true }], 4), ctxCon(A));
  ok(!r.data.choices.some(c => c.value === "id:" + soloB.id), "no sugiere algo del otro Side");
  olvidarAccesos();
  r = await responder(inter([{ name: "consulta", value: soloB.t, focused: true }], 4), ctxCon(B));
  ok(r.data.choices.some(c => c.value === "id:" + soloB.id), "a su Side sí");
  r = await responder(inter([{ name: "categoria", value: "Lugares", focused: true }], 4), ctxCon(SIN));
  ok(r.type === 8 && r.data.choices.length === 0, "otro campo con el foco no sugiere nada");
  const rota = { ...ctxCon(SIN), indice: async () => { throw new Error("sin red"); } };
  r = await responder(inter([{ name: "consulta", value: "dragon", focused: true }], 4), rota);
  ok(r.type === 8 && r.data.choices.length === 0, "si falla el índice, sin sugerencias y sin error");
  r = await responder(inter([{ name: "consulta", value: "dragon" }]), rota);
  ok(r.data.flags === 64 && /Algo falló/.test(r.data.content), "y el comando contesta con un aviso corriente, sin detalles técnicos");
  // El acceso se recuerda: 30 teclas, una sola pregunta
  olvidarAccesos(); let preguntas = 0;
  const contado = { ...ctxCon(SIN), rpc: async (n) => { preguntas++; return { vinculado: false, side: null, ve_ambos: false }; } };
  for (const v of ["dr", "dra", "drag", "drago", "dragon"]) await responder(inter([{ name: "consulta", value: v, focused: true }], 4), contado);
  ok(preguntas === 1, "cinco teclas seguidas hacen una sola pregunta a la base de datos");
  olvidarAccesos();
  const raroAcceso = { ...ctxCon(SIN), rpc: async () => ({ vinculado: true, side: "C; drop table", ve_ambos: false }) };
  r = await responder(inter([{ name: "consulta", value: soloB.t }]), raroAcceso);
  ok(!JSON.stringify(r).includes(soloB.t) || r.data.content, "un Side raro devuelto por la base de datos se trata como sin Side");
}

console.log(`\n${fallos ? "FALLOS: " + fallos : "Todo bien."} (${bien} comprobaciones correctas)`);
process.exit(fallos ? 1 : 0);
