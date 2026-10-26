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

const COLOR = 0x8a6d3b;
const EFIMERO = 64;
const SIN_MENCIONES = { parse: [] };   // nada de lo que venga de la base de datos puede mencionar a nadie

export const COMANDOS = [
  { name: "ayuda", type: 1, description: "Qué puede hacer este bot", dm_permission: false },
  { name: "vincular", type: 1, description: "Vincula tu cuenta de la web con tu cuenta de Discord", dm_permission: false,
    options: [{ type: 3, name: "codigo", description: "El código que te da la web (Tablón de Discord)", required: true, min_length: 4, max_length: 20 }] },
  { name: "desvincular", type: 1, description: "Quita la vinculación de tu cuenta de la web con Discord", dm_permission: false },
  { name: "perfil", type: 1, description: "Tus estadísticas y tu colección (solo lo ves tú)", dm_permission: false },
  { name: "clasificacion", type: 1, description: "Las mejores marcas de un juego", dm_permission: false,
    options: [
      { type: 3, name: "juego", description: "Qué juego", required: true,
        choices: [{ name: "Hooey", value: "hooey" }, { name: "Ajedrez", value: "ajedrez" }, { name: "Arquería", value: "arqueria" }] },
      { type: 5, name: "publico", description: "Enseñarla a todos en el canal (por defecto solo la ves tú)" }] },
  { name: "cartas", type: 1, description: "Busca una carta de Triunfos por nombre (solo lo ves tú)", dm_permission: false,
    options: [{ type: 3, name: "nombre", description: "Parte del nombre", required: true, min_length: 2, max_length: 40 }] },
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
    title: "The great mice",
    description: "El bot del compendio. Casi todo lo que responde lo ves solo tú.",
    fields: [
      { name: "/vincular  /desvincular", value: "Une tu cuenta de la web con tu Discord. Genera el código en el Tablón de Discord de la web." },
      { name: "/perfil", value: "Tus estadísticas, tus tokens y tu colección." },
      { name: "/clasificacion", value: "Las mejores marcas de Hooey, Ajedrez y Arquería." },
      { name: "/cartas", value: "Busca una carta de Triunfos." },
      { name: "/eventos", value: "Avisos del sitio y próximas carreras del Hipódromo." }],
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
  if (!lista?.length) return privado("No encontré ninguna carta con ese nombre (o no puedes verla).");
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
  // En público se pide sin identificador: solo lo que ve cualquiera, nada de un Side.
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

const MANEJADORES = { ayuda: (i, c) => ayuda(c), vincular, desvincular, perfil, clasificacion, cartas, eventos };

/* Punto de entrada. `ctx` = { rpc(nombre, args) -> datos (lanza si falla), sitio, log(mensaje) }.
   Devuelve siempre algo que se puede mandar a Discord; nunca lanza. */
export async function responder(inter, ctx) {
  try {
    if (inter?.type === 1) return { type: 1 };   // PING (así comprueba Discord la dirección)
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
