// Edge Function «discord-avisos» de Supabase (Deno): publica en Discord los avisos de la cola (por ahora, «la carrera sale en 2 minutos»).
//
// La llama pg_cron cada minuto con una clave propia (docs/discord-avisos.sql explica cómo programarlo). Cada vez:
//   1. pide a la base de datos que apunte en la cola las carreras que salen en los próximos 2 minutos (una sola vez por carrera),
//   2. toma lo pendiente y lo publica en el canal configurado con el token del bot,
//   3. apunta si salió o si hay que reintentar. Un fallo de Discord no toca ninguna carrera ni apuesta.
//
// Preparación (una sola vez; pasos completos en docs/discord.md):
//   * Ejecutar docs/discord-avisos.sql, elegir el canal (discord_canales) y programar la tarea.
//   * Crear la función «discord-avisos» y copiar dentro, SIN cambiarlos, estos dos archivos de docs/discord-avisos/:   index.ts   avisos.js
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

// Publica un mensaje en un canal. Nunca lanza: devuelve el código HTTP (0 si ni siquiera hubo respuesta) y, si Discord pide esperar, cuánto.
async function enviar(canalId: string, cuerpo: Record<string, unknown>, nonce: string) {
  try {
    const r = await fetch(`https://discord.com/api/v10/channels/${canalId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${Deno.env.get("DISCORD_BOT_TOKEN")}`, "Content-Type": "application/json", "User-Agent": "TheGreatMice (avisos, 1.0)" },
      body: JSON.stringify({ ...cuerpo, nonce }),
      signal: AbortSignal.timeout(8000)
    });
    if (r.ok) return { estado: r.status };
    const t = await r.text().catch(() => "");
    let error = "", reintentoSeg = 0;
    try { const j = JSON.parse(t); error = String(j.message || "").slice(0, 80); reintentoSeg = Number(j.retry_after) || Number(r.headers.get("retry-after")) || 0; } catch { /* sin cuerpo */ }
    return { estado: r.status, error, reintentoSeg };
  } catch {
    return { estado: 0, error: "sin respuesta" };
  }
}

Deno.serve((req: Request) => atender(req, { entorno: (n: string) => Deno.env.get(n), rpc, enviar, log: (m: string) => console.error(m) }));
