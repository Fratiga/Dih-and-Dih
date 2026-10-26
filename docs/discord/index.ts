// Edge Function «discord» de Supabase (Deno): la dirección de «Interactions» del bot «The great mice» (aplicación «D&D»).
//
// Qué hace: Discord manda aquí cada comando slash que alguien escribe en el servidor. La función (servidor.js)
//   1. comprueba la firma Ed25519 de Discord (sin ella contesta 401: nadie más puede hacerse pasar por Discord),
//   2. comprueba que la petición es de NUESTRA aplicación (y, si se configuró, de NUESTRO servidor),
//   3. llama a la función SQL que toca (docs/discord.sql decide qué se puede ver y a quién) con la clave de servicio, y
//   4. contesta con el mensaje. Las respuestas son privadas salvo /clasificacion y /eventos con «publico: sí».
// No hay ningún proceso encendido ni servidor aparte: Discord llama a esta función solo cuando alguien usa un comando.
//
// Preparación (una sola vez; los pasos completos están en docs/discord.md):
//   * Ejecutar docs/discord.sql en el editor SQL de Supabase.
//   * Crear la función:  supabase functions new discord  y copiar dentro de supabase/functions/discord/ estos siete archivos de docs/discord/,
//     SIN cambiarlos:   index.ts   servidor.js   comandos.js   firma.js   buscar.js   texto.js   cronica.js
//   * Secretos (el token del bot NO va aquí: esta función no lo necesita, solo el script de registrar comandos):
//       supabase secrets set DISCORD_PUBLIC_KEY=<clave pública de la aplicación> DISCORD_APP_ID=<id de la aplicación> DISCORD_GUILD_ID=<id del servidor>
//       supabase secrets set SITIO_URL=https://fratiga.github.io/Dih-and-Dih/        (opcional; es el valor por defecto)
//     (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya los pone Supabase.)
//   * Desplegar SIN comprobar JWT, porque quien llama es Discord y lo que vale es su firma:
//       supabase functions deploy discord --no-verify-jwt
//   * En el portal de Discord (Developer Portal > tu aplicación > General Information) pegar en «Interactions Endpoint URL»:
//       https://<PROYECTO>.supabase.co/functions/v1/discord
//     Discord manda un PING firmado y no deja guardar la dirección si no contestamos bien.
//   * Registrar los comandos:  node docs/discord/registrar.js   (con las variables de docs/discord/.env.example)

import { createClient } from "npm:@supabase/supabase-js@2";
import { atender } from "./servidor.js";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const rpc = async (nombre: string, args: Record<string, unknown>) => {
  const { data, error } = await sb.rpc(nombre, args);
  if (error) throw error;
  return data;
};

// Lo editado desde el panel de Admin (tabla contenido_servidor): se aplica encima del índice de búsqueda. Si falla, el índice se usa tal cual.
const parches = async () => {
  const { data, error } = await sb.from("contenido_servidor").select("coleccion,clave,data,borrado");
  if (error) throw error;
  return data;
};

Deno.serve((req: Request) => atender(req, { entorno: (n: string) => Deno.env.get(n), rpc, parches, log: (m: string) => console.error(m) }));
