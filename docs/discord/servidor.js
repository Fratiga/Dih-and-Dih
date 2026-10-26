// La parte de la Edge Function «discord» que no depende de Deno: recibe la petición de Discord, la comprueba y contesta.
// Está aparte de index.ts para poder probarla en Node (tools/probar-discord.js) con firmas de verdad.
//   entorno(nombre)  -> valor de un secreto o undefined
//   rpc(nombre, args) -> datos de una función SQL (lanza si falla)
//   obtener(url)      -> Response (fetch), para bajar el índice de búsqueda del sitio
//   parches()         -> filas de contenido_servidor (lo editado desde el panel de Admin); opcional
import { verificarFirma } from "./firma.js";
import { responder } from "./comandos.js";
import { cargarIndice } from "./buscar.js";

const respuesta = (estado, cuerpo) =>
  new Response(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo), {
    status: estado, headers: { "Content-Type": typeof cuerpo === "string" ? "text/plain" : "application/json" }
  });

export async function atender(req, { entorno, rpc, log = () => {}, obtener = (u) => fetch(u), parches }) {
  if (req.method !== "POST") return respuesta(405, "Solo POST");

  const clave = entorno("DISCORD_PUBLIC_KEY");
  if (!clave) { log("Falta el secreto DISCORD_PUBLIC_KEY"); return respuesta(500, "Sin configurar"); }

  // El cuerpo se lee como TEXTO y tal cual: la firma se calcula sobre esos bytes exactos, no sobre el JSON ya interpretado.
  const cuerpo = await req.text();
  if (cuerpo.length > 20000) return respuesta(413, "Demasiado grande");
  const valida = await verificarFirma({
    clavePublicaHex: clave,
    firmaHex: req.headers.get("x-signature-ed25519") ?? "",
    marca: req.headers.get("x-signature-timestamp") ?? "",
    cuerpo
  });
  if (!valida) return respuesta(401, "Firma no válida");

  let inter;
  try { inter = JSON.parse(cuerpo); } catch { return respuesta(400, "JSON no válido"); }

  // Que sea de nuestra aplicación (y de nuestro servidor, si se configuró). El PING no trae servidor.
  const app = entorno("DISCORD_APP_ID");
  if (app && inter.application_id !== app) return respuesta(401, "Aplicación distinta");
  const servidor = entorno("DISCORD_GUILD_ID");
  if (inter.type !== 1 && servidor && inter.guild_id !== servidor) {
    // El autocompletado (tipo 4) no admite un mensaje: se contesta sin sugerencias.
    if (inter.type === 4) return respuesta(200, { type: 8, data: { choices: [] } });
    return respuesta(200, { type: 4, data: { content: "Este bot solo funciona en el servidor de la campaña.", flags: 64 } });
  }

  const sitio = entorno("SITIO_URL") || "https://fratiga.github.io/Dih-and-Dih/";
  const indice = () => cargarIndice({ sitio, obtener, parches });
  return respuesta(200, await responder(inter, { rpc, indice, sitio, log }));
}
