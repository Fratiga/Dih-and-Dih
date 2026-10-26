// Comprobación de la firma de Discord. Discord firma cada petición a nuestra dirección con Ed25519 (cabeceras X-Signature-Ed25519 y
// X-Signature-Timestamp) y exige que respondamos 401 a las que no cuadren. Sin esto, cualquiera podría hacerse pasar por Discord.
// Es JavaScript normal (sirve en Deno, que es donde corre la Edge Function, y en Node, donde se prueba con tools/probar-discord.js).

const ahoraSeg = () => Math.floor(Date.now() / 1000);

export function hexABytes(hex) {
  if (typeof hex !== "string" || hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/* Devuelve true solo si la firma es válida para (marca de tiempo + cuerpo tal cual llegó) con la clave pública de la aplicación.
   Rechaza también las peticiones con una marca de tiempo de hace más de `toleranciaSeg` segundos (o del futuro), para que una petición
   firmada que alguien copie no valga de por vida. Nunca lanza: cualquier cosa rara es un «no». */
export async function verificarFirma({ clavePublicaHex, firmaHex, marca, cuerpo, toleranciaSeg = 300 }) {
  try {
    const clave = hexABytes(clavePublicaHex), firma = hexABytes(firmaHex);
    if (!clave || clave.length !== 32 || !firma || firma.length !== 64) return false;
    const t = Number(marca);
    if (!Number.isFinite(t) || Math.abs(ahoraSeg() - t) > toleranciaSeg) return false;
    const llave = await crypto.subtle.importKey("raw", clave, { name: "Ed25519" }, false, ["verify"]);
    const mensaje = new TextEncoder().encode(String(marca) + String(cuerpo));
    return await crypto.subtle.verify({ name: "Ed25519" }, llave, firma, mensaje);
  } catch (e) {
    return false;
  }
}
