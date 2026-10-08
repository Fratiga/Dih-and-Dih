// Comprueba que no quedan alert/confirm/prompt nativos y que cada página que carga un script
// con dialogo.* también carga js/dialogos.js.
// Uso: node tools/verificar-dialogos.js
const fs = require("fs");
const path = require("path");
const raiz = path.join(__dirname, "..");
const lista = d => fs.readdirSync(path.join(raiz, d)).filter(f => f.endsWith(".js")).map(f => `${d}/${f}`);
const htmls = fs.readdirSync(raiz).filter(f => f.endsWith(".html"));
const nativo = /(^|[^.\w$])(alert|confirm|prompt)\s*\(/;
let problemas = 0;
const avisar = m => { problemas++; console.log("  " + m); };

const usa = new Set();
for (const f of [...lista("js"), ...htmls]) {
  if (f === "js/dialogos.js") continue;
  const lineas = fs.readFileSync(path.join(raiz, f), "utf8").split("\n");
  lineas.forEach((l, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
    if (nativo.test(l)) avisar(`${f}:${i + 1} usa un aviso nativo: ${l.trim().slice(0, 100)}`);
    if (/\bdialogo\./.test(l)) usa.add(f);
  });
}
for (const h of htmls) {
  const t = fs.readFileSync(path.join(raiz, h), "utf8");
  const scripts = [...t.matchAll(/<script src="(js\/[^"?]+)/g)].map(m => m[1]);
  const necesita = usa.has(h) || scripts.some(s => usa.has(s));
  if (necesita && !scripts.includes("js/dialogos.js")) avisar(`${h} usa dialogo.* pero no carga js/dialogos.js`);
}
console.log(problemas ? `${problemas} problema(s).` : "OK: sin avisos nativos y todas las páginas cargan dialogos.js.");
process.exit(problemas ? 1 : 0);
