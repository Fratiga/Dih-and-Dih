// Genera docs/informe-entradas.md: entradas de personajes, lugares y bestiario con datos incompletos.
// No modifica los datos. Uso: node tools/informe-entradas.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const raiz = path.join(__dirname, "..");
const sb = {};
sb.window = sb;
vm.createContext(sb);
const fuentes = [["data/personajes.js", "PERSONAJES"], ["data/lugares.js", "LUGARES"], ["data/bestiario.js", "BESTIARIO"]];
const texto = html => String(html || "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
const vacio = v => v === undefined || v === null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === "");

let md = `# Informe de entradas incompletas

Generado con \`node tools/informe-entradas.js\`. No se modificó ningún dato.

Se marca una entrada cuando:

- **sin summary**: falta el campo.
- **summary vacío**: existe pero está en blanco.
- **sin tags**: falta el campo o la lista está vacía.
- **sin lado**: falta el campo \`lado\` o la lista está vacía.
- **summary más largo que el contenido**: el summary tiene más caracteres que el texto de \`content\` (sin etiquetas HTML).

`;
const resumen = [];
const secciones = [];
for (const [archivo, nombre] of fuentes) {
  vm.runInContext(fs.readFileSync(path.join(raiz, archivo), "utf8"), sb);
  const lista = sb[nombre] || [];
  const usaLado = lista.some(e => "lado" in e);
  const filas = [];
  const cuentas = { "sin summary": 0, "summary vacío": 0, "sin tags": 0, "sin lado": 0, "summary más largo que el contenido": 0 };
  for (const e of lista) {
    const motivos = [];
    if (!("summary" in e)) motivos.push("sin summary");
    else if (vacio(e.summary)) motivos.push("summary vacío");
    if (vacio(e.tags)) motivos.push("sin tags");
    if (usaLado && vacio(e.lado)) motivos.push("sin lado");
    const s = texto(e.summary), c = texto(e.content);
    if (s && s.length > c.length) motivos.push(`summary más largo que el contenido (${s.length} frente a ${c.length} caracteres)`);
    for (const m of motivos) cuentas[m.replace(/ \(.*/, "")]++;
    if (motivos.length) filas.push(`| ${e.id} | ${String(e.title || "").replace(/\|/g, "\\|")} | ${motivos.join("; ")} |`);
  }
  resumen.push(`- \`${archivo}\`: ${lista.length} entradas, ${filas.length} con algún problema. ${usaLado ? "" : "Ninguna entrada tiene el campo \`lado\` (esta colección no lo usa), por eso no se marca. "}` + (Object.entries(cuentas).filter(([, n]) => n).map(([k, n]) => `${k}: ${n}`).join(", ") || "Sin problemas") + ".");
  secciones.push(`## ${archivo}\n\n${filas.length ? "| id | título | problemas |\n|---|---|---|\n" + filas.join("\n") : "Ninguna entrada con problemas."}\n`);
}
md += `## Resumen\n\n${resumen.join("\n")}\n\n${secciones.join("\n")}`;
fs.writeFileSync(path.join(raiz, "docs", "informe-entradas.md"), md);
console.log(resumen.join("\n"));
