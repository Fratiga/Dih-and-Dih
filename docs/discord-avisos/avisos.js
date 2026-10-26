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

function mensajeDe(fila, sitio) {
  if (fila.origen === "carrera") return mensajeCarrera(fila.contenido || {}, sitio);
  if (fila.origen === "cronica") return mensajeCronica(fila.contenido || {}, sitio);
  if (fila.origen === "recordatorio") return mensajeRecordatorio(fila.contenido || {}, sitio);
  return null;
}

/* Una pasada completa: encola lo nuevo y publica lo pendiente. Devuelve un resumen sin datos privados. */
export async function procesar({ rpc, enviar, sitio, log = () => {}, max = 10 }) {
  const resumen = { encoladas: 0, enviadas: 0, reintentos: 0, fallidas: 0 };
  try { resumen.encoladas = Number(await rpc("discord_i_encolar_carreras", {})) || 0; }
  catch (e) { log(`no pude mirar las carreras: ${e?.code || ""} ${String(e?.message || e).slice(0, 150)}`); }
  // La crónica y el recordatorio de Veintiuna van aparte: si todavía no está su SQL (docs/discord-2_consultas.sql), solo se apunta en el registro y las carreras siguen.
  try { resumen.encoladas += Number(await rpc("discord_i_encolar_cronica", {})) || 0; }
  catch (e) { log(`no pude mirar la crónica: ${e?.code || ""} ${String(e?.message || e).slice(0, 150)}`); }

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
export async function atender(req, { entorno, rpc, enviar, log = () => {} }) {
  const json = (estado, cuerpo) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json" } });
  if (req.method !== "POST") return json(405, { error: "Solo POST" });
  const clave = entorno("DISCORD_AVISOS_CLAVE");
  if (!clave || clave.length < 16) { log("Falta DISCORD_AVISOS_CLAVE (o es demasiado corta)"); return json(500, { error: "sin configurar" }); }
  if (!iguales(req.headers.get("x-discord-clave") ?? "", clave)) return json(401, { error: "clave" });
  if (!entorno("DISCORD_BOT_TOKEN")) { log("Falta DISCORD_BOT_TOKEN"); return json(500, { error: "sin configurar" }); }
  const sitio = entorno("SITIO_URL") || "https://fratiga.github.io/Dih-and-Dih/";
  return json(200, await procesar({ rpc, enviar, sitio, log }));
}
