// Los comandos del bot «The great mice» (aplicación «D&D»). Aquí solo hay lógica de presentación: cada comando llama a una función SQL de
// docs/discord.sql (que decide qué se puede ver) y da forma a la respuesta. Ninguna regla de juego vive aquí.
//
// Reglas de privacidad que se cumplen en este archivo:
//   * Casi todo se responde en privado (efímero): lo ve solo quien lo pidió. Así una carta o un aviso de un Side nunca se cuela en un canal que
//     lee el otro. Solo /clasificacion y /eventos pueden salir a la vista de todos si la persona pone «publico: sí», y en ese caso se piden con
//     el identificador vacío, es decir, solo lo que ve cualquiera (sin avisos de un Side).
//   * Nunca se acepta el nombre de otra persona: /perfil siempre es el de quien escribe el comando.
//   * Los errores técnicos no se enseñan: solo los mensajes que escribimos nosotros en SQL (código P0001) o aquí.
// Es JavaScript normal: corre en Deno (Edge Function) y en Node (pruebas).
import { buscar, embedDetalle, embedLista, entradaVisible, porId, sugerencias } from "./buscar.js";
import "./cronica.js";   // las frases de la crónica (copia sin cambios de js/cronica.js); deja el objeto en globalThis.Cronica
const Cronica = globalThis.Cronica;

const COLOR = 0x8a6d3b;
const EFIMERO = 64;
const SIN_MENCIONES = { parse: [] };   // nada de lo que venga de la base de datos puede mencionar a nadie

export const COMANDOS = [
  { name: "ayuda", type: 1, description: "Qué hace el botsiño", dm_permission: false },
  { name: "vincular", type: 1, description: "Vincula tu cuenta de la pagina con tu cuenta de Discord", dm_permission: false,
    options: [{ type: 3, name: "codigo", description: "El código que esta en el Tablón de Discord", required: true, min_length: 4, max_length: 20 }] },
  { name: "desvincular", type: 1, description: "Quita la vinculación de tu cuenta de la web con Discord (Si quieres supongo jaaj...)", dm_permission: false },
  { name: "perfil", type: 1, description: "Tus estadísticas y tu colección (solo lo ves tú)", dm_permission: false },
  { name: "clasificacion", type: 1, description: "Las mejores marcas de los jueguiños", dm_permission: false,
    options: [
      { type: 3, name: "juego", description: "Qué juego", required: true,
        choices: [{ name: "Hooey", value: "hooey" }, { name: "Ajedrez", value: "ajedrez" }, { name: "Arquería", value: "arqueria" }] },
      { type: 5, name: "publico", description: "Enseñarla a todos en el canal (por defecto solo la ves tú)" }] },
  { name: "buscar", type: 1, description: "Busca en el compendio: lugares, personajes, bestiario, reglas, precios... (solo lo ves tú)", dm_permission: false,
    options: [
      { type: 3, name: "consulta", description: "Qué buscas. Mientras escribes salen sugerencias", required: true, autocomplete: true, min_length: 2, max_length: 80 },
      { type: 3, name: "categoria", description: "Limitar a un tipo de entrada",
        choices: ["Lugares", "Bestiario", "Personajes", "Razas", "Facciones", "Textos", "Religión", "Pergaminos", "Armas", "Objetos", "Reglas", "Economía", "Cronología"].map(n => ({ name: n, value: n })) }] },
  { name: "cartas", type: 1, description: "Busca una carta de Triunfos por nombre (solo lo ves tú)", dm_permission: false,
    options: [{ type: 3, name: "nombre", description: "Parte del nombre", required: true, min_length: 2, max_length: 40 }] },
  { name: "cronica", type: 1, description: "Lo último que pasó en la taberna (solo lo que ve tu Side)", dm_permission: false },
  { name: "racha", type: 1, description: "Tu racha en Las Veintiuna Velas", dm_permission: false },
  { name: "desafios", type: 1, description: "Tus desafíos de hoy en Las Veintiuna Velas", dm_permission: false },
  { name: "carrera", type: 1, description: "La próxima carrera del Hipódromo y sus favoritas", dm_permission: false },
  { name: "saldo", type: 1, description: "Tus tokens de juego", dm_permission: false },
  { name: "ficha", type: 1, description: "Un resumen de tu personaje de Mis personajes (solo lo ves tú)", dm_permission: false,
    options: [{ type: 3, name: "nombre", description: "Cuál de tus personajes (si tienes uno solo, no hace falta)", autocomplete: true, max_length: 80 }] },
  { name: "avisos", type: 1, description: "Elige qué avisos te mando por mensaje privado", dm_permission: false,
    options: [
      { type: 5, name: "cria", description: "Avisarme cuando una cría esté lista" },
      { type: 5, name: "carrera", description: "Avisarme 2 minutos antes de que corra una criatura mía" }] },
  { name: "eventos", type: 1, description: "Avisos del sitio y próximas carreras", dm_permission: false,
    options: [{ type: 5, name: "publico", description: "Enseñarlos a todos en el canal (solo los avisos de todos)" }] }
];

const JUEGOS = { hooey: "Hooey", ajedrez: "Ajedrez", arqueria: "Arquería" };
const RAREZAS = { comun: "Común", infrecuente: "Infrecuente", rara: "Rara", legendaria: "Legendaria", limitada: "Limitada" };

const corta = (s, n) => { s = String(s ?? ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const num = n => Number(n ?? 0).toLocaleString("es");
const opcion = (inter, nombre) => (inter.data?.options || []).find(o => o.name === nombre)?.value;
const quien = inter => inter.member?.user ?? inter.user ?? {};
const unix = ms => Math.floor(ms / 1000);

const privado = (contenido, extra = {}) => ({ type: 4, data: { content: contenido, flags: EFIMERO, allowed_mentions: SIN_MENCIONES, ...extra } });
const embed = (e, { publico = false } = {}) => ({ type: 4, data: { embeds: [{ color: COLOR, ...e }], flags: publico ? 0 : EFIMERO, allowed_mentions: SIN_MENCIONES } });

function enlace(sitio, pagina) { return sitio.replace(/\/+$/, "") + "/" + pagina; }

async function ayuda(ctx) {
  return embed({
    title: "THE GREAT MICE",
    description: "El bot del compendio. Casi todo lo que responde lo ves solo tú.",
    fields: [
      { name: "/vincular  /desvincular", value: "Une tu cuenta de la web con tu Discord. Genera el código en el Tablón de Discord de la web." },
      { name: "/perfil", value: "Tus estadísticas, tus tokens y tu colección." },
      { name: "/clasificacion", value: "Las mejores marcas de Hooey, Ajedrez y Arquería." },
      { name: "/buscar", value: "Busca en el compendio: lugares, personajes, bestiario, reglas, precios... Solo ves lo de tu Side." },
      { name: "/cartas", value: "Busca una carta de Triunfos." },
      { name: "/cronica", value: "Lo último que pasó en la taberna, solo lo que ve tu Side." },
      { name: "/racha  /desafios  /saldo", value: "Tu racha y tus desafíos de Las Veintiuna Velas, y tus tokens." },
      { name: "/ficha", value: "Un resumen de tu personaje de Mis personajes." },
      { name: "/avisos", value: "Elige si quieres un mensaje privado cuando una cría esté lista o una criatura tuya vaya a correr." },
      { name: "/carrera", value: "La próxima carrera del Hipódromo y sus favoritas." },
      { name: "/eventos", value: "Avisos del sitio y próximas carreras de los caballinhos." }],
    url: enlace(ctx.sitio, "index.html")
  });
}

async function vincular(inter, ctx) {
  const u = quien(inter);
  const codigo = String(opcion(inter, "codigo") ?? "");
  const r = await ctx.rpc("discord_i_vincular", { p_codigo: codigo, p_discord_id: u.id, p_discord_nombre: u.global_name || u.username || null });
  if (!r?.ok) return privado(`❌ ${r?.mensaje || "No se pudo vincular."}`);
  return privado(`✅ Listo. Tu Discord quedó vinculado con **${r.usuario}**. Prueba con /perfil. Puedes quitarlo cuando quieras con /desvincular.`);
}

async function desvincular(inter, ctx) {
  const ok = await ctx.rpc("discord_i_desvincular", { p_discord_id: quien(inter).id });
  return privado(ok ? "✅ Tu cuenta quedó desvinculada." : "Tu Discord no estaba vinculado con ninguna cuenta.");
}

async function perfil(inter, ctx) {
  const p = await ctx.rpc("discord_i_perfil", { p_discord_id: quien(inter).id });
  const campos = [];
  if (p.side) campos.push({ name: "Side", value: p.side, inline: true });
  campos.push({ name: "Cartas", value: `${num(p.cartas?.total)} copias, ${num(p.cartas?.distintas)} distintas`, inline: true });
  if (p.tokens != null) campos.push({ name: "Tokens de juego", value: num(p.tokens), inline: true });
  for (const j of p.juegos || []) {
    const partes = [`${num(j.partidas)} partidas`, `${num(j.victorias)} victorias`, `${num(j.derrotas)} derrotas`];
    if (j.tablas) partes.push(`${num(j.tablas)} tablas`);
    campos.push({ name: JUEGOS[j.juego] || corta(j.juego, 40), value: partes.join(" · "), inline: false });
  }
  if (p.hooey) campos.push({ name: "Hooey", value: `${num(p.hooey.total)} puntos · mejor racha ${num(p.hooey.mejor_racha)}`, inline: false });
  if (p.veintiuna) campos.push({ name: "Las Veintiuna Velas", value: `${num(p.veintiuna.rondas)} rondas · ${num(p.veintiuna.victorias)} victorias · mejor racha ${num(p.veintiuna.mejor_racha)}`, inline: false });
  return embed({ title: corta(p.usuario, 60), description: "Tu perfil en el compendio.", fields: campos.slice(0, 25), url: enlace(ctx.sitio, "minijuegos.html") });
}

async function clasificacion(inter, ctx) {
  const juego = String(opcion(inter, "juego") ?? "");
  const publico = opcion(inter, "publico") === true;
  const filas = await ctx.rpc("discord_i_clasificacion", { p_juego: juego });
  const medallas = ["🥇", "🥈", "🥉"];
  const lineas = (filas || []).map((f, i) => `${medallas[i] || `**${i + 1}.**`} ${corta(f.usuario, 40)}: ${num(f.puntos)}${f.extra != null ? ` (${num(f.extra)})` : ""}`);
  const unidad = juego === "hooey" ? "Puntos (mejor racha)" : "Victorias (partidas)";
  return embed({ title: `Clasificación de ${JUEGOS[juego] || juego}`, description: lineas.length ? `${unidad}\n\n${lineas.join("\n")}` : "Todavía no hay marcas.", url: enlace(ctx.sitio, "minijuegos.html") }, { publico });
}

async function cartas(inter, ctx) {
  const lista = await ctx.rpc("discord_i_cartas", { p_discord_id: quien(inter).id, p_texto: String(opcion(inter, "nombre") ?? "") });
  if (!lista?.length) return privado("No encontré ninguna carta con ese nombre (o esta PROHIBIDA).");
  const c = lista[0];
  const stats = [];
  if (c.coste != null) stats.push(`Coste ${c.coste}`);
  if (c.atq != null && c.pv != null) stats.push(`${c.atq}/${c.pv}`);
  const campos = [
    { name: "Tipo", value: corta(c.tipo, 40) || "Carta", inline: true },
    { name: "Rareza", value: RAREZAS[c.rareza] || corta(c.rareza, 40) || "—", inline: true }];
  if (stats.length) campos.push({ name: "Cifras", value: stats.join(" · "), inline: true });
  if (Array.isArray(c.afinidad) && c.afinidad.length) campos.push({ name: "Afinidad", value: corta(c.afinidad.join(", "), 100), inline: true });
  if (c.habilidad) campos.push({ name: "Habilidad", value: corta(c.habilidad, 1000), inline: false });
  const e = { title: corta(c.nombre + (c.epiteto ? `, ${c.epiteto}` : ""), 200), description: corta(c.descripcion || "", 600), fields: campos, url: enlace(ctx.sitio, "cartas.html") };
  if (typeof c.imagen === "string" && /^https:\/\//.test(c.imagen)) e.thumbnail = { url: c.imagen };
  if (lista.length > 1) e.footer = { text: "También: " + corta(lista.slice(1).map(x => x.nombre).join(", "), 180) };
  return embed(e);
}

async function eventos(inter, ctx) {
  const publico = opcion(inter, "publico") === true;
  const r = await ctx.rpc("discord_i_eventos", { p_discord_id: publico ? null : quien(inter).id });
  const campos = [];
  for (const ev of r?.eventos || []) {
    const cuando = ev.hasta ? `Hasta <t:${unix(Date.parse(ev.hasta))}:f>` : "";
    const donde = ev.enlace ? `\n${enlace(ctx.sitio, ev.enlace)}` : "";
    campos.push({ name: corta(ev.titulo, 250), value: corta([ev.texto, cuando].filter(Boolean).join("\n") + donde, 1000) });
  }
  for (const c of r?.carreras || []) {
    const extra = [c.grado, c.bolsa != null ? `bolsa ${num(c.bolsa)}` : null, c.inscripcion != null ? `inscripción ${num(c.inscripcion)}` : null].filter(Boolean).join(" · ");
    campos.push({ name: `🏇 ${corta(c.nombre, 240)}`, value: `<t:${c.hora}:R> (<t:${c.hora}:f>)${extra ? `\n${extra}` : ""}` });
  }
  return embed({ title: "Eventos y próximas carreras", description: campos.length ? undefined : "No hay avisos ni carreras próximas.", fields: campos.slice(0, 10), url: enlace(ctx.sitio, "index.html") }, { publico });
}

/* Qué puede ver esa persona del compendio (su Side, o todo). Se recuerda un minuto para no preguntar a la base de datos en cada tecla del autocompletado. */
const accesos = new Map();
async function accesoDe(ctx, id) {
  const hit = accesos.get(id), t = Date.now();
  if (hit && t - hit.t < 60000) return hit.v;
  const r = await ctx.rpc("discord_i_acceso", { p_discord_id: id });
  const v = { vinculado: !!r?.vinculado, side: r?.side === "A" || r?.side === "B" ? r.side : null, veAmbos: !!r?.ve_ambos };
  if (accesos.size > 500) accesos.clear();
  accesos.set(id, { t, v });
  return v;
}
export function olvidarAccesos() { accesos.clear(); }

async function buscarEnCompendio(inter, ctx) {
  const consulta = String(opcion(inter, "consulta") ?? "").slice(0, 80);
  const categoria = opcion(inter, "categoria");
  const [acceso, entradas] = await Promise.all([accesoDe(ctx, quien(inter).id), ctx.indice()]);
  // Una sugerencia del autocompletado llega como «id:<id>»: es esa entrada exacta (si esa persona puede verla; si no, es como si no existiera).
  if (consulta.startsWith("id:")) {
    const e = porId(entradas, consulta.slice(3));
    if (!e || !entradaVisible(e, acceso)) return privado("No encontré esa entrada (o no puedes verla).");
    const otros = buscar(entradas, e.t, acceso, { limite: 4 }).filter(h => h.e.id !== e.id).slice(0, 3);
    return embed(embedDetalle(e, acceso, ctx.sitio, otros));
  }
  if (consulta.trim().length < 2) return privado("Escribe al menos 2 letras de lo que buscas.");
  const hallados = buscar(entradas, consulta, acceso, { categoria, limite: 8 });
  if (!hallados.length) return privado(`No encontré nada para «${corta(consulta, 60)}»${categoria ? ` en ${categoria}` : ""}. Prueba con otra palabra o sin la categoría.`);
  // Si el primero coincide con el título entero y es claramente el mejor, se enseña su detalle; si no, la lista.
  if (hallados[0].puntos >= 800 && (hallados.length === 1 || hallados[0].puntos - hallados[1].puntos >= 150))
    return embed(embedDetalle(hallados[0].e, acceso, ctx.sitio, hallados.slice(1, 4)));
  return embed(embedLista(hallados, consulta, ctx.sitio));
}

/* Autocompletado de /buscar: hasta 25 títulos que esa persona puede ver. Nunca sugiere algo de otro Side. */
async function autocompletarFicha(inter, ctx, texto) {
  const r = await ctx.rpc("discord_i_fichas", { p_discord_id: quien(inter).id, p_nombre: null });
  const t = texto.trim().toLowerCase();
  const choices = (r?.lista || []).filter(f => !t || String(f.nombre).toLowerCase().includes(t)).slice(0, 25)
    .map(f => ({ name: corta(`${f.nombre}${f.clase ? ` (${f.clase}${f.nivel != null ? ` ${f.nivel}` : ""})` : ""}`, 100), value: corta(f.nombre, 100) }));
  return { type: 8, data: { choices } };
}

async function autocompletar(inter, ctx) {
  const foco = (inter.data?.options || []).find(o => o.focused);
  if (inter.data?.name === "ficha" && foco && foco.name === "nombre") return autocompletarFicha(inter, ctx, String(foco.value ?? "").slice(0, 80));
  if (inter.data?.name !== "buscar" || !foco || foco.name !== "consulta") return { type: 8, data: { choices: [] } };
  const texto = String(foco.value ?? "").slice(0, 80);
  if (texto.trim().length < 2) return { type: 8, data: { choices: [] } };
  const [acceso, entradas] = await Promise.all([accesoDe(ctx, quien(inter).id), ctx.indice()]);
  return { type: 8, data: { choices: sugerencias(entradas, texto, acceso, opcion(inter, "categoria")) } };
}

/* Los textos de la crónica no vienen escapados (js/cronica.js lo avisa): los nombres de jugadores pueden llevar símbolos de Markdown. */
const escapar = t => String(t ?? "").replace(/([\\*_~`|>[\]<])/g, "\\$1");

async function cronica(inter, ctx) {
  const lista = await ctx.rpc("discord_i_cronica", { p_discord_id: quien(inter).id, p_limite: 10 });
  const lineas = [];
  for (const sc of lista || []) {
    const l = Cronica.linea({ id: sc.id, tipo: sc.tipo, user: sc.user, otro: sc.otro, yo: sc.yo, datos: sc.datos, enlace: sc.enlace });
    if (!l) continue;
    lineas.push(`${l.icono} ${escapar(l.texto)}${l.mio ? " **(te toca)**" : ""} · <t:${unix(Date.parse(sc.actualizado))}:R>`);
  }
  return embed({ title: "Crónica del mundo", description: corta(lineas.length ? lineas.join("\n\n") : "Todavía no ha pasado nada que contar.", 3800), url: enlace(ctx.sitio, "cronica.html"),
                 footer: { text: "Solo ves lo de tu Side. En los intercambios y las crías no se dice quién fue." } });
}

async function racha(inter, ctx) {
  const v = await ctx.rpc("discord_i_veintiuna", { p_discord_id: quien(inter).id });
  const viva = Number(v.racha) > 0;
  return embed({ title: "Tu racha en Las Veintiuna Velas",
    description: viva ? `Llevas **${num(v.racha)}** victorias seguidas.` : "Ahora mismo no llevas ninguna victoria seguida.",
    fields: [{ name: "Mejor racha", value: num(v.mejor_racha), inline: true }, { name: "Victorias", value: `${num(v.victorias)} de ${num(v.rondas)} rondas`, inline: true }],
    url: enlace(ctx.sitio, "veintiuna.html") });
}

const MARCAS = { reclamado: "✅", completado: "☑️", pendiente: "▫️" };
async function desafios(inter, ctx) {
  const v = await ctx.rpc("discord_i_veintiuna", { p_discord_id: quien(inter).id });
  const grupos = { bronce: [], plata: [], oro: [] };
  for (const d of v.desafios || []) (grupos[d.nivel] || (grupos[d.nivel] = [])).push(`${MARCAS[d.estado] || "▫️"} ${corta(d.nombre, 60)}`);
  const hechos = (v.desafios || []).filter(d => d.estado !== "pendiente").length;
  const campos = Object.entries(grupos).filter(([, l]) => l.length).map(([n, l]) => ({ name: n.charAt(0).toUpperCase() + n.slice(1), value: corta(l.join("\n"), 1000), inline: true }));
  return embed({ title: "Tus desafíos de hoy", description: `Completados: **${hechos}** de ${(v.desafios || []).length}. Se reinician <t:${v.reinicia}:R> (00:00 UTC) y lo completado sin reclamar se pierde.`,
    fields: campos, footer: { text: "✅ reclamado · ☑️ completado, sin reclamar · ▫️ pendiente" }, url: enlace(ctx.sitio, "veintiuna.html") });
}

async function carrera(inter, ctx) {
  const c = await ctx.rpc("discord_i_carrera", { p_discord_id: quien(inter).id });
  if (!c?.hay) return privado("No hay ninguna carrera programada ahora mismo.");
  const entrantes = (c.entrantes || []).map((e, i) => `**${i + 1}.** ${corta(escapar(e.nombre), 60)} (puerta ${e.puerta}) · ganador x${e.gan} · podio x${e.pod}${e.dueno ? ` · de ${corta(escapar(e.dueno), 40)}` : ""}`);
  return embed({ title: corta(`🏇 Carrera ${c.n}: ${c.nombre || ""}`, 250),
    description: c.suspendida ? "Esta carrera está suspendida." : `Sale <t:${c.hora}:R> (<t:${c.hora}:t>). Las apuestas cierran <t:${c.cierre}:R>.`,
    fields: [
      ...(entrantes.length ? [{ name: "Favoritas", value: corta(entrantes.join("\n"), 1000) }] : []),
      ...(c.bolsa != null ? [{ name: "Bolsa", value: `${num(c.bolsa)} tokens`, inline: true }] : []),
      ...(c.dist != null ? [{ name: "Distancia", value: `${num(c.dist)} m`, inline: true }] : [])],
    url: enlace(ctx.sitio, "hipodromo.html") });
}

async function saldo(inter, ctx) {
  const t = await ctx.rpc("discord_i_saldo", { p_discord_id: quien(inter).id });
  return privado(`💰 Tienes **${num(t)}** tokens de juego.`);
}

const firmado = n => (n >= 0 ? "+" : "−") + Math.abs(n);

async function ficha(inter, ctx) {
  const nombre = String(opcion(inter, "nombre") ?? "").slice(0, 80).trim();
  const r = await ctx.rpc("discord_i_fichas", { p_discord_id: quien(inter).id, p_nombre: nombre || null });
  const lista = r?.lista || [];
  if (!lista.length) return privado("Todavía no tienes ningún personaje en Mis personajes.");
  const f = r.ficha;
  if (!f) {
    const nombres = lista.slice(0, 15).map(x => `• **${escapar(corta(x.nombre, 60))}**${x.clase ? ` · ${escapar(corta(x.clase, 40))}${x.nivel != null ? ` ${x.nivel}` : ""}` : ""}`).join("\n");
    return embed({ title: "Tus personajes", description: corta(`${nombre ? `No encontré ninguno que se llame «${escapar(corta(nombre, 40))}». ` : ""}${nombres}\n\nUsa /ficha y elige uno.`, 3000), url: enlace(ctx.sitio, "fichas.html") });
  }
  const linea1 = [f.nivel != null ? `Nivel ${f.nivel}` : null, f.clase ? `${f.clase}${f.subclase ? ` (${f.subclase})` : ""}` : null, f.raza].filter(Boolean).join(" · ");
  const linea2 = [f.trasfondo, f.alineamiento, f.campania].filter(Boolean).join(" · ");
  const campos = [];
  if (f.pv != null || f.pv_max != null) campos.push({ name: "Vida", value: `${num(f.pv)} / ${num(f.pv_max)}${f.pv_temp ? ` (+${num(f.pv_temp)} temporales)` : ""}`, inline: true });
  if (f.ca != null) campos.push({ name: "CA", value: num(f.ca), inline: true });
  if (f.iniciativa != null) campos.push({ name: "Iniciativa", value: firmado(f.iniciativa), inline: true });
  if (f.velocidad) campos.push({ name: "Velocidad", value: corta(escapar(f.velocidad), 40), inline: true });
  if (f.competencia != null) campos.push({ name: "Competencia", value: firmado(f.competencia), inline: true });
  const nombresAtr = { fue: "FUE", des: "DES", con: "CON", int: "INT", sab: "SAB", car: "CAR" };
  const atr = Object.entries(nombresAtr).filter(([k]) => f.atributos?.[k]?.punt != null).map(([k, n]) => `**${n}** ${f.atributos[k].punt} (${firmado(f.atributos[k].mod)})`);
  if (atr.length) campos.push({ name: "Atributos", value: atr.join(" · ") });
  for (const [k, etiqueta] of [["condiciones", "Condiciones"], ["resistencias", "Resistencias"], ["inmunidades", "Inmunidades"], ["vulnerabilidades", "Vulnerabilidades"]])
    if (f[k]) campos.push({ name: etiqueta, value: corta(escapar(f[k]), 300), inline: true });
  if (Array.isArray(f.ataques) && f.ataques.length) campos.push({ name: "Ataques", value: corta(f.ataques.map(a => escapar(a)).join(" · "), 1000) });
  const m = f.monedas || {};
  if (m.oro != null || m.plata != null || m.cobre != null) campos.push({ name: "Monedas", value: `${num(m.oro)} oro · ${num(m.plata)} plata · ${num(m.cobre)} cobre`, inline: true });
  if (f.n_rasgos || f.n_hechizos) campos.push({ name: "Anotados", value: [f.n_rasgos ? `${f.n_rasgos} rasgos` : null, f.n_hechizos ? `${f.n_hechizos} hechizos` : null].filter(Boolean).join(" · "), inline: true });
  const e = { title: corta(escapar(f.nombre), 250), description: corta([f.fallecido ? "☠️ **Fallecido**" : "", escapar(linea1), escapar(linea2)].filter(Boolean).join("\n"), 1000) || "—",
    fields: campos.slice(0, 25), url: enlace(ctx.sitio, "fichas.html"), footer: { text: "Solo lo ves tú. Se actualiza cuando guardas cambios en la web." } };
  if (f.actualizada && !isNaN(Date.parse(f.actualizada))) e.timestamp = new Date(f.actualizada).toISOString();
  return embed(e);
}

async function avisos(inter, ctx) {
  const cria = opcion(inter, "cria"), carrera = opcion(inter, "carrera");
  const r = await ctx.rpc("discord_i_avisos", { p_discord_id: quien(inter).id, p_cria: typeof cria === "boolean" ? cria : null, p_carrera: typeof carrera === "boolean" ? carrera : null });
  const cambio = typeof cria === "boolean" || typeof carrera === "boolean";
  const estado = b => (b ? "✅ Activado" : "▫️ Apagado");
  return embed({ title: cambio ? "Listo, avisos actualizados" : "Tus avisos por mensaje privado",
    description: "Te escribo por mensaje privado, solo si lo activas aquí. Para que llegue, en Discord tienes que permitir mensajes directos de los miembros de este servidor (Ajustes del servidor > Privacidad). Si no llegan, no insisto.",
    fields: [{ name: "Cría lista", value: estado(r.cria), inline: true }, { name: "Tu criatura corre pronto", value: estado(r.carrera), inline: true }],
    footer: { text: "Cambia uno con /avisos cria:sí o /avisos carrera:no" } });
}

const MANEJADORES = { ayuda: (i, c) => ayuda(c), vincular, desvincular, perfil, clasificacion, buscar: buscarEnCompendio, cartas, cronica, racha, desafios, carrera, saldo, ficha, avisos, eventos };

/* Punto de entrada. `ctx` = { rpc(nombre, args) -> datos (lanza si falla), indice() -> entradas del compendio, sitio, log(mensaje) }.
   Devuelve siempre algo que se puede mandar a Discord; nunca lanza. */
export async function responder(inter, ctx) {
  try {
    if (inter?.type === 1) return { type: 1 };   // PING (así comprueba Discord la dirección)
    if (inter?.type === 4) { if (!quien(inter).id) return { type: 8, data: { choices: [] } }; try { return await autocompletar(inter, ctx); } catch (e) { return { type: 8, data: { choices: [] } }; } }   // autocompletado: si algo falla, sin sugerencias
    if (inter?.type !== 2) return privado("No sé qué hacer con eso.");
    const manejar = MANEJADORES[inter.data?.name];
    if (!manejar) return privado("No conozco ese comando.");
    if (!quien(inter).id) return privado("No pude saber quién eres.");
    return await manejar(inter, ctx);
  } catch (e) {
    // Los mensajes que escribimos en SQL (raise exception, código P0001) se pueden enseñar tal cual. Cualquier otra cosa es un fallo técnico:
    // se apunta en el registro sin datos de nadie y la persona recibe un aviso corriente.
    if (e && e.code === "P0001" && typeof e.message === "string") return privado(`❌ ${corta(e.message, 400)}`);
    try { ctx.log?.(`fallo en /${inter?.data?.name}: ${e?.code || ""} ${String(e?.message || e).slice(0, 200)}`); } catch (_) { /* nada */ }
    return privado("Algo falló por mi parte. Prueba de nuevo en un rato.");
  }
}
