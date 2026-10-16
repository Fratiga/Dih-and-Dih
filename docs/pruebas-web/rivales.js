// Comprueba la dificultad de los rivales: que la tabla de cada juego se puede leer desde su archivo (lo que usa la pestaña Rivales del panel de Admin) y que
// js/rivales-ajustes.js aplica los ajustes sin dejar que rompan nada. Uso (desde la raíz del proyecto):  node docs/pruebas-web/rivales.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = path.resolve(__dirname, "..", "..");
let fallos = 0;
const comprobar = (t, real, esperado) => {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  console.log((ok ? "  OK   " : "  FALLA ") + t + (ok ? "" : ` (esperado ${JSON.stringify(esperado)}, real ${JSON.stringify(real)})`));
  if (!ok) fallos++;
};

// 1) El extractor del panel: se saca del propio archivo para probar exactamente el mismo código
const adminSrc = fs.readFileSync(path.join(RAIZ, "js", "admin-rivales.js"), "utf8");
const m = adminSrc.match(/function extraerLiteral[\s\S]*?\n  }\n/);
const extraer = new Function(`${m[0]}; return extraerLiteral;`)();

console.log("== La tabla de rivales de cada juego se puede leer");
const juegos = { ajedrez: "ajedrez.js", arqueria: "arqueria.js", duelo: "duelo.js" };
const tablas = {};
for (const [juego, archivo] of Object.entries(juegos)) {
  const literal = extraer(fs.readFileSync(path.join(RAIZ, "js", archivo), "utf8"), "RIVALES");
  let datos = null;
  try { datos = literal ? new Function(`return (${literal});`)() : null; } catch (e) { datos = null; }
  const lista = datos ? (Array.isArray(datos) ? datos : Object.keys(datos).map(id => Object.assign({ id }, datos[id]))) : [];
  tablas[juego] = lista;
  comprobar(`${juego}: se lee y tiene rivales`, lista.length > 0, true);
  comprobar(`${juego}: cada rival tiene id y algún número que cambiar`, lista.every(r => r.id && Object.values(r).some(v => typeof v === "number")), true);
}
comprobar("ajedrez: está Ocevat con 'prof' y 'error'", ["prof", "error"].every(k => typeof tablas.ajedrez.find(r => r.id === "ocevat")[k] === "number"), true);
comprobar("duelo: está el Caballero con 'reaccion'", typeof tablas.duelo.find(r => r.id === "caballero").reaccion, "number");
comprobar("arqueria: está Hornet con 'precision'", typeof tablas.arqueria.find(r => r.id === "hornet").precision, "number");

// 2) Aplicar ajustes
console.log("== Los ajustes se aplican sin romper nada");
const ctx = { window: {}, localStorage: { getItem: () => null, setItem() {} }, sessionStorage: { getItem: () => null, setItem() {} }, fetch: () => Promise.reject(new Error("sin red")), console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(RAIZ, "js", "rivales-ajustes.js"), "utf8"), ctx);
const { aplicar } = ctx.window.RivalesAjustes;
const copia = o => JSON.parse(JSON.stringify(o));

let duelo = copia(tablas.duelo);
const n = aplicar("duelo", duelo, { duelo: { caballero: { reaccion: 0.1, dano: [1, 2] }, noexiste: { hp: 1 } } });
comprobar("duelo: se cambia un número y una lista", [duelo.find(r => r.id === "caballero").reaccion, duelo.find(r => r.id === "caballero").dano, n], [0.1, [1, 2], 2]);
comprobar("duelo: lo que no se tocó queda igual", duelo.find(r => r.id === "recluta"), tablas.duelo.find(r => r.id === "recluta"));

duelo = copia(tablas.duelo);
aplicar("duelo", duelo, { duelo: { caballero: { dano: [1, 2, 3], hp: [5], reaccion: "rápido", inventado: 9 } } });
const cab = duelo.find(r => r.id === "caballero"), cab0 = tablas.duelo.find(r => r.id === "caballero");
comprobar("una lista de otro largo, un número por una lista, un texto y un campo que no existe se ignoran", [cab.dano, cab.hp, cab.reaccion, cab.inventado], [cab0.dano, cab0.hp, cab0.reaccion, undefined]);

const arq = copia(tablas.arqueria);
const objeto = {}; arq.forEach(r => { const { id, ...resto } = r; objeto[id] = resto; });
aplicar("arqueria", objeto, { arqueria: { hornet: { precision: 0.5 } } });
comprobar("arquería (tabla por ids): también se aplica", objeto.hornet.precision, 0.5);
comprobar("un juego sin ajustes no cambia nada", aplicar("ajedrez", copia(tablas.ajedrez), { duelo: { caballero: { hp: 1 } } }), 0);

console.log(fallos ? `\n${fallos} fallo(s).` : "\nTodo bien.");
process.exit(fallos ? 1 : 0);
