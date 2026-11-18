// La Fractura: arma los scripts de las dos páginas a partir de las partes de js/fractura-ui/.
//   js/fractura-cuartel.js = comun.js + cuartel.js  (fractura.html: portada, ejércitos, cuartel, mesas)
//   js/fractura-guerra.js  = comun.js + guerra.js   (fractura-guerra.html: el tablero, el final y la guerra de una mesa)
// Cada salida va envuelta en una sola función, así que dentro de una página todo comparte el mismo ámbito, como antes.
// También avisa si una página usa algo que solo se declara en la otra (se rompería al ejecutarse).
// Uso: node tools/construir-fractura-ui.js   (correrlo después de tocar cualquier parte; las salidas se suben a main)
const fs = require("fs"), path = require("path");
const raiz = path.join(__dirname, "..");
const parte = n => fs.readFileSync(path.join(raiz, "js", "fractura-ui", `${n}.js`), "utf8").replace(/\r\n/g, "\n");
const comun = parte("comun"), cuartel = parte("cuartel"), guerra = parte("guerra");

const CABECERA = {
  cuartel: "LA FRACTURA: la portada, elegir ejército, el cuartel (soldados, casas, reliquias, salón de los caídos, crónicas,\n   historia del mundo) y el vestíbulo de las mesas. La guerra se juega en fractura-guerra.html.",
  guerra: "LA FRACTURA: la guerra sobre el tablero, el final con su crónica y la guerra de una mesa.\n   Se llega desde fractura.html. Al acabar o al salir se vuelve al cuartel."
};
function armar(nombre, propia) {
  return `/* =============================================================================\n   ${CABECERA[nombre]}\n   ARCHIVO GENERADO por tools/construir-fractura-ui.js a partir de js/fractura-ui/comun.js y js/fractura-ui/${nombre}.js.\n   No se edita aquí: se edita la parte y se vuelve a correr el script.\n============================================================================= */\n(function () {\n${comun}\n${propia}})();\n`;
}

// Lo que declara cada parte en su primer nivel (dos espacios de sangría)
function declarados(txt) {
  const s = new Set();
  const re = /^  (?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([^=;]+?)\s*(?:=|;))/gm;
  let m;
  while ((m = re.exec(txt))) {
    if (m[1]) s.add(m[1]);
    else m[2].replace(/[{}\[\]]/g, " ").split(",").forEach(x => { const n = x.trim().split(/[\s:=]/).pop(); if (/^[A-Za-z_$][\w$]*$/.test(n)) s.add(n); });
  }
  return s;
}
const dC = declarados(comun), dCu = declarados(cuartel), dG = declarados(guerra);
// Quita comentarios y textos (también el texto de las plantillas `...`, pero no lo que va dentro de ${...})
// para no confundir palabras sueltas con usos
function limpio(t) {
  let out = "", i = 0;
  const pila = [];   // "tpl" = dentro de `...`; un número = profundidad de llaves dentro de ${...}
  while (i < t.length) {
    const c = t[i], d = t[i + 1], top = pila[pila.length - 1];
    if (top === "tpl") {
      if (c === "\\") { i += 2; continue; }
      if (c === "`") { pila.pop(); out += '""'; i++; continue; }
      if (c === "$" && d === "{") { pila.push(0); out += " "; i += 2; continue; }
      if (c === "\n") out += "\n";
      i++; continue;
    }
    if (c === "/" && d === "*") { const f = t.indexOf("*/", i + 2); i = f < 0 ? t.length : f + 2; out += " "; continue; }
    if (c === "/" && d === "/") { const f = t.indexOf("\n", i); i = f < 0 ? t.length : f; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < t.length && t[j] !== c && t[j] !== "\n") j += t[j] === "\\" ? 2 : 1; out += '""'; i = j + 1; continue; }
    if (c === "`") { pila.push("tpl"); i++; continue; }
    if (typeof top === "number") {
      if (c === "{") pila[pila.length - 1]++;
      else if (c === "}") { if (top === 0) { pila.pop(); i++; continue; } pila[pila.length - 1]--; }
    }
    out += c; i++;
  }
  return out;
}
function revisar(nombre, propia, ajena) {
  const txt = limpio(comun + "\n" + propia), fallos = [];
  ajena.forEach(id => {
    if (dC.has(id) || declarados(propia).has(id)) return;
    const re = new RegExp(`(^|[^\\w$.])${id.replace(/\$/g, "\\$")}(?![\\w$])`, "m");
    if (re.test(txt)) fallos.push(id);
  });
  return fallos;
}
const fCu = revisar("cuartel", cuartel, dG), fG = revisar("guerra", guerra, dCu);
fs.writeFileSync(path.join(raiz, "js", "fractura-cuartel.js"), armar("cuartel", cuartel));
fs.writeFileSync(path.join(raiz, "js", "fractura-guerra.js"), armar("guerra", guerra));
if (fCu.length) console.log("El cuartel usa cosas que solo existen en la guerra:", fCu.join(", "));
if (fG.length) console.log("La guerra usa cosas que solo existen en el cuartel:", fG.join(", "));
console.log(`Hecho: js/fractura-cuartel.js (${(comun.length + cuartel.length) >> 10} KB) y js/fractura-guerra.js (${(comun.length + guerra.length) >> 10} KB).`);
process.exit(fCu.length || fG.length ? 1 : 0);
