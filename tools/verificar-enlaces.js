// Comprueba que cada referencia entre entradas de data/*.js apunta a una entrada que existe.
// Uso: node tools/verificar-enlaces.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dataDir = path.join(__dirname, "..", "data");
const sandbox = { window: {}, console, TextDecoder, atob: s => Buffer.from(s, "base64").toString("binary") };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of fs.readdirSync(dataDir).filter(f => f.endsWith(".js"))) {
  try { vm.runInContext(fs.readFileSync(path.join(dataDir, f), "utf8"), sandbox, { filename: f }); }
  catch (e) { console.error(`No se pudo cargar ${f}: ${e.message}`); }
}

const COLECCIONES = ["ENTRIES", "PERSONAJES", "LUGARES", "FACCIONES", "PERGAMINOS", "ARMAS", "BESTIARIO", "RAZAS", "RELIGIONES", "OBJETOS"];
const todas = COLECCIONES.flatMap(c => sandbox[c] || []);
const ids = new Set();
const duplicados = [];
for (const e of todas) {
  if (ids.has(e.id)) duplicados.push(e.id);
  ids.add(e.id);
}
const lugares = new Set((sandbox.LUGARES || []).map(l => l.id));

const rotos = [];
const chequear = (origen, campo, id, conjunto = ids) => {
  if (id && !conjunto.has(id)) rotos.push(`${origen} -> ${campo}: "${id}"`);
};

for (const e of sandbox.PERSONAJES || []) {
  chequear(e.id, "lugarOrigen", e.lugarOrigen);
  chequear(e.id, "faccion", e.faccion);
  (e.relacionesConocidas || []).forEach(r => chequear(e.id, "relacionesConocidas", r.id));
}
for (const e of sandbox.FACCIONES || []) {
  (e.miembrosConocidos || []).forEach(id => chequear(e.id, "miembrosConocidos", id));
  (e.relaciones || []).forEach(r => chequear(e.id, "relaciones", r.id));
}
for (const e of sandbox.BESTIARIO || []) chequear(e.id, "region", e.region);
for (const p of sandbox.MAPA_PUNTOS || []) chequear("MAPA_PUNTOS", "lugarId", p.lugarId, lugares);
for (const s of sandbox.STATS || []) chequear(`STATS ${s.id}`, "personajeId", s.personajeId);

duplicados.forEach(id => console.warn(`Aviso: id duplicado entre entradas: "${id}" (el modal abre solo la primera)`));

if (rotos.length) {
  console.log(`${rotos.length} problema(s):`);
  rotos.forEach(r => console.log("  " + r));
  process.exit(1);
}
console.log(`OK: ${todas.length} entradas, ningún enlace roto.`);
