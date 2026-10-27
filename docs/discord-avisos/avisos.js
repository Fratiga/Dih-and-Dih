// Lógica de la Edge Function «discord-avisos»: apunta en la cola los avisos que toquen y publica en Discord los pendientes.
// Es JavaScript normal (corre en Deno y en Node, donde se prueba con tools/probar-discord-avisos.js). No sabe nada de Deno: recibe
//   rpc(nombre, args)                  -> datos de una función SQL (lanza si falla)
//   enviar(canalId, cuerpo, nonce)     -> { estado: <código HTTP>, reintentoSeg?: n, error?: texto }   (no lanza)
// Un fallo de Discord solo deja el aviso en la cola para reintentarlo: nunca toca las carreras ni las apuestas.

import "./cronica.js";   // las frases de la crónica (copia sin cambios de js/cronica.js); deja el objeto en globalThis.Cronica
const Cronica = globalThis.Cronica;

const COLOR = 0x8a6d3b;
const GRADOS = { gran: "Gran Premio", selecta: "Selecta", corriente: "Corriente", novatos: "Novatos", copa_bronce: "Copa de Bronce", copa_plata: "Copa de Plata", copa_oro: "Copa de Oro", copa_leyendas: "Copa de las Leyendas" };
const PISTAS = { pesares: "Pradera de los Tres Pesares", charco: "El Charco Dorado", impuesto: "Cuesta del Impuesto", ceniza: "Valle de Ceniza", mapache: "Anillo del Mapache", silver: "Silver Mile", hollow: "Hollow Oak Park", espejos: "Corredor de los Espejos", cielo: "Cielo Roto", cienaga: "Ciénaga Susurrante", brasas: "Cuenca de Brasas" };

const corta = (s, n) => { s = String(s ?? ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const num = n => Number(n ?? 0).toLocaleString("es");
const enlace = (sitio, pagina) => sitio.replace(/\/+$/, "") + "/" + pagina;

/* El mensaje de una carrera que sale pronto. Solo usa datos públicos de la carrera (nombre, grado, pista, bolsa, horas). Nunca nada del resultado. */
export function mensajeCarrera(c, sitio) {
  const campos = [
    { name: "Grado", value: GRADOS[c.grado] || corta(c.grado, 60) || "—", inline: true },
    { name: "Pista", value: PISTAS[c.pista] || corta(c.pista, 60) || "—", inline: true }];
  if (c.dist != null) campos.push({ name: "Distancia", value: `${num(c.dist)} m`, inline: true });
  if (c.bolsa != null) campos.push({ name: "Bolsa", value: `${num(c.bolsa)} tokens`, inline: true });
  if (c.cierre) campos.push({ name: "Apuestas", value: `Cierran <t:${Number(c.cierre)}:R>`, inline: true });
  campos.push({ name: "Ver o apostar", value: `[En vivo](${enlace(sitio, "hipodromo-vivo.html")}) · [Hipódromo](${enlace(sitio, "hipodromo.html")})`, inline: false });
  return {
    embeds: [{
      color: COLOR,
      title: corta(`${/^(gran|copa_)/.test(c.grado || "") ? "🏆" : "🏇"} La carrera ${c.n ?? ""} sale en 2 minutos`, 250),
      description: corta(c.nombre || "", 300),
      fields: campos,
      timestamp: new Date(Number(c.hora) * 1000).toISOString()
    }],
    allowed_mentions: { parse: [] }
  };
}

/* Los textos de la crónica no vienen escapados: un nombre de jugador puede llevar símbolos de Markdown. */
const escapar = t => String(t ?? "").replace(/([\\*_~`|>[\]<])/g, "\\$1");

/* Un suceso de la crónica del mundo, con la misma frase que enseña la web. Si no se sabe contar ese tipo, no se publica nada. */
export function mensajeCronica(c, sitio) {
  const l = Cronica.linea({ id: c.id, tipo: c.tipo, user: c.user, datos: c.datos, enlace: c.enlace });
  if (!l) return null;
  const ver = c.enlace && /^[a-z0-9_-]+\.html(#[A-Za-z0-9_-]*)?$/.test(c.enlace) ? `\n[Ver en el sitio](${enlace(sitio, c.enlace)})` : "";
  return { embeds: [{ color: COLOR, description: corta(`${l.icono} ${escapar(l.texto)}${ver}`, 1500), footer: { text: "Crónica del mundo" } }], allowed_mentions: { parse: [] } };
}

/* El recordatorio de que los desafíos de Las Veintiuna Velas se reinician. */
export function mensajeRecordatorio(c, sitio) {
  if (c.tipo !== "veintiuna_reinicio") return null;
  return {
    embeds: [{ color: COLOR, title: "🕯 Los desafíos de Las Veintiuna Velas se reinician", description: `Será <t:${Number(c.hora)}:R> (00:00 UTC). Lo que hayas completado y no hayas reclamado se pierde.\n[Ir a la mesa](${enlace(sitio, "veintiuna.html")})` }],
    allowed_mentions: { parse: [] }
  };
}

const RAREZAS = { comun: "Común", infrecuente: "Infrecuente", rara: "Rara", legendaria: "Legendaria", limitada: "Limitada" };
const enlaceSeguro = e => (typeof e === "string" && /^[a-z0-9_-]+\.html(#[A-Za-z0-9_%.=-]*)?$/.test(e) ? e : null);

/* El resumen de la semana de un canal: la mejor racha de Veintiuna, la apuesta más pagada del Hipódromo y las cartas más raras. Solo sale lo que hubo. */
export function mensajeResumen(c, sitio) {
  const campos = [];
  if (c.racha && c.racha.racha != null) campos.push({ name: "Mejor racha de Las Veintiuna Velas", value: corta(`${escapar(c.racha.user)}: ${num(c.racha.racha)} victorias seguidas`, 1000) });
  if (c.apuesta && c.apuesta.pago != null) {
    const cria = Array.isArray(c.apuesta.criaturas) ? c.apuesta.criaturas.join(", ") : c.apuesta.criaturas;
    campos.push({ name: "Apuesta más pagada del Hipódromo", value: corta(`${escapar(c.apuesta.user)} apostó ${num(c.apuesta.monto)} tokens${cria ? ` por ${escapar(cria)}` : ""} y cobró ${num(c.apuesta.pago)}${c.apuesta.mult ? ` (${String(c.apuesta.mult).replace(".", ",")} veces)` : ""}`, 1000) });
  }
  if (Array.isArray(c.cartas) && c.cartas.length) {
    const lineas = c.cartas.map(x => `${escapar(x.nombre || "Una carta")} (${RAREZAS[x.rareza] || escapar(x.rareza || "carta")}), de ${escapar(x.user)}`);
    campos.push({ name: `Cartas más raras (${num(c.total_cartas)} ganadas en total)`, value: corta(lineas.join("\n"), 1000) });
  }
  if (!campos.length) return null;
  return { embeds: [{ color: COLOR, title: "📅 La semana en la taberna", description: "Lo más destacado de los últimos 7 días.", fields: campos, footer: { text: "Crónica del mundo" } }], allowed_mentions: { parse: [] } };
}

/* Una novedad del sitio (data/novedades.js o la que escribe el Admin), con su enlace. */
export function mensajeNovedad(c, sitio) {
  if (!c.titulo) return null;
  const e = enlaceSeguro(c.enlace);
  return {
    embeds: [{ color: COLOR, title: corta(`🆕 ${c.titulo}`, 250), description: corta(`${escapar(c.texto || "")}${e ? `\n[Verlo en el sitio](${enlace(sitio, e)})` : ""}`, 1500), footer: { text: "Novedades del sitio" } }],
    allowed_mentions: { parse: [] }
  };
}

/* Entradas nuevas del compendio: hasta 8 títulos con su enlace y cuántas hay en total. */
export function mensajeEntradas(c, sitio) {
  const items = Array.isArray(c.items) ? c.items : [];
  if (!items.length) return null;
  const lineas = items.map(i => {
    const titulo = escapar(corta(i.t, 100));
    const e = enlaceSeguro(i.p);
    return `• ${e ? `[${titulo}](${enlace(sitio, e)})` : titulo}${i.c ? ` · ${escapar(corta(i.c, 40))}` : ""}`;
  });
  const resto = Number(c.total) - items.length;
  return {
    embeds: [{ color: COLOR, title: Number(c.total) === 1 ? "📖 Una entrada nueva en el compendio" : `📖 ${num(c.total)} entradas nuevas en el compendio`,
      description: corta(lineas.join("\n") + (resto > 0 ? `\ny ${num(resto)} más.` : ""), 3000), footer: { text: "Compendio" } }],
    allowed_mentions: { parse: [] }
  };
}

/* Mensaje privado: tu criatura corre en 2 minutos. */
export function mensajeDmCarrera(c, sitio) {
  const lista = Array.isArray(c.criaturas) ? c.criaturas : [];
  if (!lista.length) return null;
  const nombres = lista.map(x => `${escapar(corta(x.nombre, 60))}${x.puerta ? ` (puerta ${escapar(x.puerta)})` : ""}`).join(", ");
  return {
    embeds: [{ color: COLOR, title: lista.length === 1 ? "🏇 Tu criatura corre en 2 minutos" : "🏇 Tus criaturas corren en 2 minutos",
      description: corta(`${nombres} en la carrera ${escapar(c.n)}: ${escapar(corta(c.nombre, 100))}.\nSale <t:${Number(c.hora)}:R>.\n[Verla en vivo](${enlace(sitio, "hipodromo-vivo.html")})`, 1500),
      footer: { text: "Puedes apagar estos avisos con /avisos" } }],
    allowed_mentions: { parse: [] }
  };
}

/* Mensaje privado: tu cría está lista. */
export function mensajeDmCria(c, sitio) {
  return {
    embeds: [{ color: COLOR, title: "🥚 Tu cría está lista", description: corta(`La cría de ${escapar(corta(c.cria || "tu criatura", 80))} ya se puede recoger en el corral.\n[Ir a los corrales](${enlace(sitio, "corrales.html")})`, 1000),
      footer: { text: "Puedes apagar estos avisos con /avisos" } }],
    allowed_mentions: { parse: [] }
  };
}

function mensajeDe(fila, sitio) {
  if (fila.origen === "carrera") return mensajeCarrera(fila.contenido || {}, sitio);
  if (fila.origen === "cronica") return mensajeCronica(fila.contenido || {}, sitio);
  if (fila.origen === "recordatorio") return mensajeRecordatorio(fila.contenido || {}, sitio);
  if (fila.origen === "resumen") return mensajeResumen(fila.contenido || {}, sitio);
  if (fila.origen === "novedad") return mensajeNovedad(fila.contenido || {}, sitio);
  if (fila.origen === "entradas") return mensajeEntradas(fila.contenido || {}, sitio);
  if (fila.origen === "dm") {
    const c = fila.contenido || {};
    return c.tipo === "dm_carrera" ? mensajeDmCarrera(c, sitio) : c.tipo === "dm_cria" ? mensajeDmCria(c, sitio) : null;
  }
  return null;
}

/* Las novedades del sitio y las entradas nuevas del compendio salen del índice de búsqueda (data/discord-indice.json). Se mira como mucho una vez cada
   10 minutos (lo decide la base de datos, así que no depende de que esta función siga encendida) y solo si hay un canal «novedades» encendido. */
export async function revisarIndice({ rpc, obtener, sitio, log = () => {} }) {
  let toca = false;
  try { toca = (await rpc("discord_i_indice_toca", {})) === true; } catch (e) { log(`no pude saber si toca mirar el índice: ${e?.code || ""}`); return 0; }
  if (!toca) return 0;
  let idx;
  try {
    const r = await obtener(enlace(sitio, "data/discord-indice.json"));
    if (!r.ok) throw new Error("índice " + r.status);
    idx = await r.json();
  } catch (e) { log(`no pude bajar el índice del compendio: ${String(e?.message || e).slice(0, 100)}`); return 0; }
  let n = 0;
  for (const nv of (Array.isArray(idx.novedades) ? idx.novedades : []).slice(0, 30)) {
    n += Number(await rpc("discord_i_encolar_novedad", { p_clave: nv.clave, p_titulo: nv.titulo, p_texto: nv.texto ?? "", p_enlace: nv.enlace ?? null, p_fecha: nv.fecha })) || 0;
  }
  const entradas = Array.isArray(idx.entradas) ? idx.entradas : [];
  if (entradas.length) {
    const nuevas = new Set((await rpc("discord_i_indice_nuevas", { p_ids: entradas.map(e => e.id).filter(Boolean) })) || []);
    // Solo las que no son de un Side: un canal lo leen los dos (las de un Side se pueden buscar con /buscar, pero no se anuncian)
    const items = entradas.filter(e => nuevas.has(e.id) && (!e.l || !e.l.length)).map(e => ({ id: e.id, t: e.t, c: e.c, p: e.p }));
    if (items.length) n += Number(await rpc("discord_i_encolar_entradas", { p_items: items })) || 0;
  }
  return n;
}

/* Una pasada completa: encola lo nuevo y publica lo pendiente. Devuelve un resumen sin datos privados. */
export async function procesar({ rpc, enviar, sitio, log = () => {}, max = 10, obtener = (u) => fetch(u) }) {
  const resumen = { encoladas: 0, enviadas: 0, reintentos: 0, fallidas: 0 };
  try { resumen.encoladas = Number(await rpc("discord_i_encolar_carreras", {})) || 0; }
  catch (e) { log(`no pude mirar las carreras: ${e?.code || ""} ${String(e?.message || e).slice(0, 150)}`); }
  // La crónica y el recordatorio de Veintiuna van aparte: si todavía no está su SQL (docs/discord-2_consultas.sql), solo se apunta en el registro y las carreras siguen.
  try { resumen.encoladas += Number(await rpc("discord_i_encolar_cronica", {})) || 0; }
  catch (e) { log(`no pude mirar la crónica: ${e?.code || ""} ${String(e?.message || e).slice(0, 150)}`); }
  // Cada cosa aparte: si falta el SQL de una (docs/discord-3_extras.sql) no impide las demás.
  for (const [nombre, que] of [["discord_i_encolar_resumen", "el resumen semanal"], ["discord_i_encolar_novedades_admin", "las novedades del Admin"], ["discord_i_encolar_personales", "los avisos personales"]]) {
    try { resumen.encoladas += Number(await rpc(nombre, {})) || 0; }
    catch (e) { log(`no pude mirar ${que}: ${e?.code || ""} ${String(e?.message || e).slice(0, 150)}`); }
  }
  try { resumen.encoladas += await revisarIndice({ rpc, obtener, sitio, log }); }
  catch (e) { log(`no pude revisar el índice del compendio: ${e?.code || ""} ${String(e?.message || e).slice(0, 150)}`); }

  let filas = [];
  try { filas = (await rpc("discord_i_tomar_cola", { p_max: max })) || []; }
  catch (e) { log(`no pude leer la cola: ${e?.code || ""} ${String(e?.message || e).slice(0, 150)}`); return resumen; }

  for (const f of filas) {
    let ok = false, error = null, espera = 60;
    try {
      const cuerpo = mensajeDe(f, sitio);
      if (!cuerpo) { error = "tipo de aviso desconocido"; espera = 900; }
      else {
        // nonce + enforce_nonce: si Discord ya recibió este mismo aviso (p. ej. el envío salió bien y falló al apuntarlo), no lo publica otra vez.
        const r = await enviar(f.canal_id, { ...cuerpo, enforce_nonce: true }, String(f.id));
        if (r.estado >= 200 && r.estado < 300) ok = true;
        else if (r.estado === 429) { error = "Discord pide esperar (429)"; espera = Math.ceil(r.reintentoSeg || 30); }
        else if (r.estado >= 500 || r.estado === 0) { error = `Discord no contesta (${r.estado})`; espera = 30; }
        else if (r.codigo === 50007 || r.codigo === 10013) { error = "La persona no acepta mensajes privados del bot (o ya no está en Discord)"; espera = 0; }   // 0 = no insistas
        else { error = `Discord rechazó el aviso (${r.estado}${r.error ? ": " + r.error : ""}). Revisa el canal y los permisos del bot.`; espera = 300; }
      }
    } catch (e) { error = "fallo al enviar: " + String(e?.message || e).slice(0, 100); }
    try { await rpc("discord_i_marcar_cola", { p_id: f.id, p_ok: ok, p_error: error, p_espera_seg: espera }); }
    catch (e) { log(`no pude apuntar el resultado del aviso ${f.id}: ${e?.code || ""}`); }
    if (ok) resumen.enviadas++;
    else if (f.intentos >= 5) resumen.fallidas++;
    else resumen.reintentos++;
    if (!ok) log(`aviso ${f.id} (${f.origen}) no salió: ${error}`);
  }
  // De vez en cuando (1 de cada 60 pasadas) se limpia lo ya resuelto de hace más de una semana.
  if (Math.random() < 1 / 60) { try { await rpc("discord_i_limpiar_cola", {}); } catch (_) { /* no importa */ } }
  return resumen;
}

const iguales = (a, b) => {   // comparación de claves sin atajos por el primer carácter distinto
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

/* La entrada HTTP: solo el cron (que lleva la clave en x-discord-clave) puede llamarla. */
export async function atender(req, { entorno, rpc, enviar, log = () => {}, obtener }) {
  const json = (estado, cuerpo) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json" } });
  if (req.method !== "POST") return json(405, { error: "Solo POST" });
  const clave = entorno("DISCORD_AVISOS_CLAVE");
  if (!clave || clave.length < 16) { log("Falta DISCORD_AVISOS_CLAVE (o es demasiado corta)"); return json(500, { error: "sin configurar" }); }
  if (!iguales(req.headers.get("x-discord-clave") ?? "", clave)) return json(401, { error: "clave" });
  if (!entorno("DISCORD_BOT_TOKEN")) { log("Falta DISCORD_BOT_TOKEN"); return json(500, { error: "sin configurar" }); }
  const sitio = entorno("SITIO_URL") || "https://fratiga.github.io/Dih-and-Dih/";
  return json(200, await procesar({ rpc, enviar, sitio, log, obtener }));
}
