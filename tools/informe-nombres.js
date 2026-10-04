// Genera docs/informe-nombres.md: nombres propios que aparecen escritos de varias formas.
// Barre data/*.js y cronologia-*.md. No modifica ningún archivo.
// Uso: node tools/informe-nombres.js
const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..");
const archivos = [
  ...fs.readdirSync(path.join(raiz, "data")).filter(f => f.endsWith(".js")).map(f => "data/" + f),
  ...fs.readdirSync(raiz).filter(f => /^cronologia-.*\.md$/.test(f))
];

const plegar = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const clave = s => plegar(s).replace(/[^a-z0-9ñ]/g, "");

const CAP = "[A-ZÁÉÍÓÚÜÑ][\\p{L}'’]*";
const palabraRE = new RegExp(`[\\p{L}][\\p{L}'’]*`, "gu");
const entidadRE = new RegExp(
  `(?<![\\p{L}\\d])(?:(?:Dr|Dra|Doctor|Doctora)\\.?\\s+)?${CAP}(?:(?:[ \\-]|\\s+(?:de|del|de la|de los|de las)\\s+)${CAP})*`,
  "gu"
);
const TITULO_RE = /^(Dr|Dra|Doctor|Doctora)\.?\s+(.*)$/u;

// Vocabulario en minúscula: palabras que aparecen en minúscula son palabras comunes, no nombres.
const textos = {};
const minus = new Map();
for (const f of archivos) {
  const t = fs.readFileSync(path.join(raiz, f), "utf8")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ");
  textos[f] = t;
  for (const w of t.match(palabraRE) || []) {
    if (w[0] === w[0].toLowerCase() && w[0] !== w[0].toUpperCase()) minus.set(plegar(w), (minus.get(plegar(w)) || 0) + 1);
  }
}
const comun = w => (minus.get(plegar(w)) || 0) >= 2;

// Entidades: secuencia de palabras con mayúscula.
const entidades = new Map(); // forma -> { total, porArchivo }
const anotar = (forma, f) => {
  const e = entidades.get(forma) || { total: 0, porArchivo: {} };
  e.total++;
  e.porArchivo[f] = (e.porArchivo[f] || 0) + 1;
  entidades.set(forma, e);
};
for (const f of archivos) {
  for (const m of textos[f].matchAll(entidadRE)) {
    let forma = m[0].replace(/\s+/g, " ").replace(/['’]+$/, "").trim();
    const partes = forma.split(/[ \-]/).filter(Boolean);
    const sinTitulo = forma.replace(TITULO_RE, "$2");
    if (!TITULO_RE.test(forma) && partes.length === 1 && (comun(partes[0]) || partes[0].length < 3)) continue;
    if (TITULO_RE.test(forma) && !sinTitulo) continue;
    anotar(forma, f);
  }
}

// Agrupar por clave plegada (tilde, mayúsculas, guiones, espacios) y por título.
const grupos = new Map();
for (const [forma, info] of entidades) {
  const tm = forma.match(TITULO_RE);
  const nucleo = tm ? tm[2] : forma;
  const k = clave(nucleo);
  if (k.length < 3) continue;
  const g = grupos.get(k) || [];
  g.push({ forma, ...info });
  grupos.set(k, g);
}
const variantes = [...grupos.values()].filter(g => g.length > 1);

// Parecidos por distancia de edición (posibles erratas).
const dist = (a, b) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
};
const unaPalabra = k => grupos.get(k).every(v => !/[ \-]/.test(v.forma.replace(TITULO_RE, "$2")));
const claves = [...grupos.keys()].filter(k => k.length >= 5 && !/^[ivxlcdm]+$/.test(k) && !comun(k) && unaPalabra(k));
const totalClave = k => grupos.get(k).reduce((n, v) => n + v.total, 0);
const parecidos = [];
for (let i = 0; i < claves.length; i++) for (let j = i + 1; j < claves.length; j++) {
  const a = claves[i], b = claves[j];
  if (Math.abs(a.length - b.length) > 1) continue;
  const total = [totalClave(a), totalClave(b)];
  if (Math.min(...total) > 3) continue; // dos nombres bien asentados suelen ser personajes distintos
  if (a + "s" === b || b + "s" === a || a + "es" === b || b + "es" === a) continue;
  const max = Math.min(a.length, b.length) >= 9 ? 2 : 1;
  if (dist(a, b) <= max) parecidos.push([a, b]);
}

const fmtArchivos = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} (${n})`).join(", ");
const orden = g => g.sort((a, b) => b.total - a.total);
let md = `# Informe de nombres propios con variantes

Generado con \`node tools/informe-nombres.js\`. No se corrigió nada.

## Cómo se detectó

- Se barrieron ${archivos.length} archivos: \`data/*.js\` y \`cronologia-*.md\`. Se quitaron las etiquetas HTML antes de buscar.
- Un nombre propio es una secuencia de palabras con mayúscula inicial, con espacio, guion medio o "de/del/de la" entre ellas. Se descartan las palabras que también aparecen en minúscula dos o más veces (palabras comunes al inicio de oración).
- **Grupo 1, mismas letras con otra forma**: variantes que solo difieren en tilde, mayúsculas, guiones, espacios, apóstrofos o título ("Dr." / "Doctor").
- **Grupo 2, posibles erratas**: nombres de una sola palabra que difieren en 1 letra (2 si tienen 9 o más) y de los cuales al menos uno aparece 3 veces o menos. Es una lista de sospechosos, muchos serán nombres distintos de verdad.

## Grupo 1: variantes de escritura

`;
if (!variantes.length) md += "No se encontró ninguno.\n";
variantes.sort((a, b) => b.reduce((n, v) => n + v.total, 0) - a.reduce((n, v) => n + v.total, 0));
for (const g of variantes) {
  md += `\n### ${orden(g)[0].forma}\n\n| variante | veces | archivos |\n|---|---|---|\n`;
  for (const v of orden(g)) md += `| ${v.forma} | ${v.total} | ${fmtArchivos(v.porArchivo)} |\n`;
}
md += `\n## Grupo 2: posibles erratas (distancia de 1 o 2 letras)\n\n`;
if (!parecidos.length) md += "No se encontró ninguno.\n";
else {
  md += `| nombre A | veces | nombre B | veces | archivos donde aparece el menos frecuente |\n|---|---|---|---|---|\n`;
  for (const [a, b] of parecidos) {
    const [x, y] = totalClave(a) >= totalClave(b) ? [a, b] : [b, a];
    const fx = orden(grupos.get(x))[0], fy = orden(grupos.get(y))[0];
    md += `| ${fx.forma} | ${totalClave(x)} | ${fy.forma} | ${totalClave(y)} | ${fmtArchivos(fy.porArchivo)} |\n`;
  }
}
fs.writeFileSync(path.join(raiz, "docs", "informe-nombres.md"), md);
console.log(`docs/informe-nombres.md: ${variantes.length} grupos de variantes, ${parecidos.length} parecidos.`);
