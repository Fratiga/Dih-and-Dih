// Utilidades de texto para la búsqueda del bot (y para generar su índice): quitar el HTML de las entradas, normalizar para buscar y cortar extractos.
// JavaScript normal: lo usan la Edge Function (Deno) y tools/generar-indice-discord.js (Node).

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»", ndash: "–", mdash: "—", hellip: "…", iquest: "¿", iexcl: "¡" };

function decodificar(s) {
  return s
    .replace(/&#(\d+);/g, (m, n) => { const c = Number(n); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : ""; })
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => { const c = parseInt(n, 16); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : ""; })
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n.toLowerCase()] ?? m);
}

/* De HTML a texto plano: los párrafos y títulos quedan separados por una línea en blanco, los elementos de lista llevan «• » y las tablas se
   leen fila por fila. Nada de lo que hay dentro de <script> o <style> sale. */
export function aTexto(html) {
  if (!html) return "";
  let s = String(html)
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/\s*\r?\n\s*/g, " ")   // los saltos de línea del código fuente son espacios; solo cuentan <br> y el final de cada bloque
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|section|article|blockquote|table|ul|ol)>/gi, "\n\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/(td|th)>/gi, " | ")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, "");
  s = decodificar(s)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\| *(?=\n|$)/g, "")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/* Para comparar: minúsculas y sin tildes ni signos. */
export function normalizar(s) {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ\s]/g, " ").replace(/\s+/g, " ").trim();
}

/* Un extracto de hasta `max` caracteres que respeta los párrafos (corta en un final de frase o de párrafo si puede). */
export function extracto(texto, max = 900) {
  const t = String(texto ?? "").trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  const fin = Math.max(corte.lastIndexOf("\n\n"), corte.lastIndexOf(". "), corte.lastIndexOf(".\n"));
  return (fin > max * 0.5 ? corte.slice(0, fin + 1) : corte.replace(/\s+\S*$/, "")).trim() + (fin > max * 0.5 && corte[fin] === "." ? " …" : "…");
}

/* El fragmento del texto donde aparece la primera palabra buscada (para enseñar por qué salió un resultado). */
export function fragmento(texto, palabras, ancho = 160) {
  const norm = normalizar(texto);
  for (const p of palabras) {
    const i = norm.indexOf(p);
    if (i < 0) continue;
    // La posición en el texto normalizado puede desviarse del original (tildes, signos). Se busca de nuevo sobre el original sin tildes.
    const sinTildes = String(texto).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const j = sinTildes.indexOf(p);
    const pos = j >= 0 ? j : Math.min(i, texto.length - 1);
    const ini = Math.max(0, pos - Math.floor(ancho / 2));
    let f = String(texto).slice(ini, ini + ancho).replace(/\s+/g, " ").trim();
    if (ini > 0) f = "…" + f;
    if (ini + ancho < texto.length) f += "…";
    return f;
  }
  return "";
}
