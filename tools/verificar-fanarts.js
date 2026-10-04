// Comprueba que cada ruta de data/fanarts.js existe, sin rutas repetidas ni archivos repetidos en assets/fanarts.
// Uso: node tools/verificar-fanarts.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const raiz = path.join(__dirname, "..");
const sandbox = {};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(raiz, "data", "fanarts.js"), "utf8"), sandbox);
const rutas = sandbox.FANARTS || [];

let problemas = 0;
const avisar = msg => { problemas++; console.log("  " + msg); };

const vistas = new Set();
const vistasMin = new Map();
for (const r of rutas) {
  if (vistas.has(r)) avisar(`ruta repetida: ${r}`);
  vistas.add(r);
  const min = r.toLowerCase();
  if (vistasMin.has(min) && vistasMin.get(min) !== r) avisar(`rutas que solo difieren en mayúsculas: ${vistasMin.get(min)} / ${r}`);
  vistasMin.set(min, r);
  if (!fs.existsSync(path.join(raiz, r))) avisar(`no existe el archivo: ${r}`);
}

const dir = path.join(raiz, "assets", "fanarts");
const archivos = fs.readdirSync(dir).filter(f => fs.statSync(path.join(dir, f)).isFile());
const porHash = new Map();
for (const f of archivos) {
  const h = crypto.createHash("sha1").update(fs.readFileSync(path.join(dir, f))).digest("hex");
  porHash.set(h, [...(porHash.get(h) || []), f]);
  if (!vistas.has(`assets/fanarts/${f}`)) avisar(`archivo sin ruta en data/fanarts.js: ${f}`);
}
for (const grupo of porHash.values()) {
  if (grupo.length > 1) avisar(`archivos con contenido idéntico: ${grupo.join(" = ")}`);
}

if (problemas) { console.log(`${problemas} problema(s).`); process.exit(1); }
console.log(`OK: ${rutas.length} rutas, ${archivos.length} archivos.`);
