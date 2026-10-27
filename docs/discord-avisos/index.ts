// Edge Function «discord-avisos» de Supabase (Deno): publica en Discord los avisos de la cola.
//
// La llama pg_cron cada minuto con una clave propia (docs/discord-avisos.sql explica cómo programarlo). Cada vez:
//   1. pide a la base de datos que apunte en la cola lo que toque: carreras que salen en 2 minutos, sucesos fuertes de la crónica, el recordatorio de Veintiuna,
//      el resumen semanal, las novedades del sitio, las entradas nuevas del compendio y los avisos personales de quien los activó con /avisos,
//   2. toma lo pendiente y lo publica con el token del bot (en un canal, o por mensaje privado cuando el destino es «dm:<id de Discord>»),
//   3. apunta si salió o si hay que reintentar. Un fallo de Discord no toca ninguna carrera ni apuesta.
//
// Preparación (una sola vez; pasos completos en docs/discord.md):
//   * Ejecutar docs/discord-avisos.sql (y, para lo demás, docs/discord-2_consultas.sql y docs/discord-3_extras.sql), elegir los canales (discord_canales) y programar la tarea.
//   * Crear la función «discord-avisos» y copiar dentro, SIN cambiarlos, estos tres archivos de docs/discord-avisos/:   index.ts   avisos.js   cronica.js
//   * Secretos (Edge Functions > Secrets):
//       DISCORD_BOT_TOKEN      el token del bot (es secreto: solo aquí y en tu .env, nunca en el repositorio ni en un chat)
//       DISCORD_AVISOS_CLAVE   una clave larga al azar que inventas tú; la misma que lleva la tarea del cron
//       SITIO_URL              opcional, https://fratiga.github.io/Dih-and-Dih/ por defecto
//   * Desplegar SIN comprobar JWT, porque quien llama es el cron con su clave:   supabase functions deploy discord-avisos --no-verify-jwt
//     (o en el panel: desactivar «Verify JWT» en los ajustes de la función).

import { createClient } from "npm:@supabase/supabase-js@2";
import { atender } from "./avisos.js";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const rpc = async (nombre: string, args: Record<string, unknown>) => {
  const { data, error } = await sb.rpc(nombre, args);
  if (error) throw error;
  return data;
};

const API = "https://discord.com/api/v10";
const cabeceras = () => ({ Authorization: `Bot ${Deno.env.get("DISCORD_BOT_TOKEN")}`, "Content-Type": "application/json", "User-Agent": "TheGreatMice (avisos, 1.1)" });

// Lo que Discord contesta cuando algo sale mal: el código HTTP, su código propio (50007 = no acepta mensajes privados) y cuánto esperar si pide esperar.
async function fallo(r: Response) {
  const t = await r.text().catch(() => "");
  let error = "", reintentoSeg = 0, codigo = 0;
  try { const j = JSON.parse(t); error = String(j.message || "").slice(0, 80); reintentoSeg = Number(j.retry_after) || Number(r.headers.get("retry-after")) || 0; codigo = Number(j.code) || 0; } catch { /* sin cuerpo */ }
  return { estado: r.status, error, reintentoSeg, codigo };
}

// El canal de mensajes privados con una persona (se crea la primera vez y se recuerda mientras la función siga encendida).
const dms = new Map<string, string>();
async function canalPrivado(discordId: string) {
  const guardado = dms.get(discordId);
  if (guardado) return { id: guardado };
  const r = await fetch(`${API}/users/@me/channels`, { method: "POST", headers: cabeceras(), body: JSON.stringify({ recipient_id: discordId }), signal: AbortSignal.timeout(8000) });
  if (!r.ok) return { fallo: await fallo(r) };
  const j = await r.json().catch(() => ({}));
  if (!j.id) return { fallo: { estado: 502, error: "sin canal", reintentoSeg: 0, codigo: 0 } };
  if (dms.size > 500) dms.clear();
  dms.set(discordId, j.id);
  return { id: j.id as string };
}

// Publica un mensaje en un canal (o por privado si el destino es «dm:<id>»). Nunca lanza: devuelve el código HTTP (0 si ni siquiera hubo respuesta).
async function enviar(destino: string, cuerpo: Record<string, unknown>, nonce: string) {
  try {
    let canal = destino;
    if (destino.startsWith("dm:")) {
      const id = destino.slice(3);
      if (!/^[0-9]{15,25}$/.test(id)) return { estado: 400, error: "destino no válido" };
      const c = await canalPrivado(id);
      if (c.fallo) return c.fallo;
      canal = c.id!;
    }
    const r = await fetch(`${API}/channels/${canal}/messages`, { method: "POST", headers: cabeceras(), body: JSON.stringify({ ...cuerpo, nonce }), signal: AbortSignal.timeout(8000) });
    if (r.ok) return { estado: r.status };
    const f = await fallo(r);
    if (destino.startsWith("dm:") && (f.estado === 404 || f.codigo === 10003)) dms.delete(destino.slice(3));   // el canal guardado ya no vale: la próxima vez se crea otro
    return f;
  } catch {
    return { estado: 0, error: "sin respuesta" };
  }
}

Deno.serve((req: Request) => atender(req, { entorno: (n: string) => Deno.env.get(n), rpc, enviar, obtener: (u: string) => fetch(u), log: (m: string) => console.error(m) }));
