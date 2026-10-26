/* Pruebas de las frases de la crónica (js/cronica.js): cada tipo sembrado en docs/cronica-1_base.sql tiene frase, ninguna sale vacía y los tipos anónimos no ponen nombres.
   Uso: node tools/probar-cronica.js */
const fs = require("fs");
const path = require("path");
const C = require("../js/cronica.js");
let fallos = 0;
const ok = (c, t) => { console.log(`  ${c ? "OK  " : "FALLA"} ${t}`); if (!c) fallos++; };

const sql = fs.readFileSync(path.join(__dirname, "../docs/cronica-1_base.sql"), "utf8");
const tipos = [...sql.matchAll(/^\s*\('([a-z_]+)', '[a-z]+', (?:true|false),/gm)].map(m => m[1]);
ok(tipos.length === 10, `el SQL siembra 10 tipos (hay ${tipos.length})`);
tipos.filter(t => t !== "partida_dificil").forEach(t => ok(typeof C.FRASES[t] === "function", `el tipo ${t} tiene frase`));
ok(C.linea({ id: 1, tipo: "tipo_que_no_existe", datos: {} }) === null, "un tipo desconocido no rompe: se salta");
ok(C.linea({ id: 1, tipo: "nota", datos: {} }) === null, "una noticia vacía no sale");

const casos = [
  { id: 1, tipo: "carta_ganada", user: "Ana", datos: { nombre: "Dragón Dorado", origen: "forja", numero: 2 } },
  { id: 2, tipo: "carta_ganada", user: "Ana", datos: { resumen: true, n: 6 } },
  { id: 3, tipo: "apuesta_hipodromo", user: "Beto", datos: { monto: 100, pago: 650, mult: 6.5, criaturas: ["Brasa", "Rayo"] } },
  { id: 4, tipo: "apuesta_veintiuna", user: "Caro", datos: { apuesta: 100, pago: 450, mult: 4.5 } },
  { id: 5, tipo: "racha_veintiuna", user: "Dani", datos: { racha: 5, activa: true } },
  { id: 6, tipo: "racha_veintiuna", user: "Dani", datos: { racha: 5, activa: false, record: true } },
  { id: 7, tipo: "logro_oro_veintiuna", user: "Ana", datos: { nombre: "Cinco cartas sin pasarte" } },
  { id: 8, tipo: "copa_hipodromo", user: "Ana", datos: { criatura: "Brasa", copa: "Copa de Oro", premio: 40000 } }
];
casos.forEach(s => { const l = C.linea(s); ok(l && l.texto.length > 10 && !/undefined|NaN|\[object/.test(l.texto), `frase de ${s.tipo} #${s.id}: ${l && l.texto}`); });
ok(/6,5 veces/.test(C.linea(casos[2]).texto), "los decimales llevan coma");
ok(!/pagó/.test(C.linea(casos[2]).texto), "con dos criaturas no se conjuga en singular");

// Los anónimos nunca nombran a nadie: aunque llegara un nombre por error, la frase no lo usa
["intercambio", "cria_nacida"].forEach(t => {
  const l = C.linea({ id: 3, tipo: t, user: "NOMBRE", otro: "OTRO", datos: { dio: [{ nombre: "Kobold", n: 1 }], recibio: [{ nombre: "Draco", n: 1 }], nombre: "Hidra", primera: true } });
  ok(l && !/NOMBRE|OTRO/.test(l.texto), `${t}: la frase no usa nombres de personas (${l && l.texto})`);
});
// Todas las variantes de cada tipo, con ids distintos
for (let id = 0; id < 6; id++) casos.concat(C.EJEMPLOS).forEach(s => { const l = C.linea(Object.assign({}, s, { id })); if (l && /undefined|NaN/.test(l.texto)) { ok(false, `variante ${id} de ${s.tipo}: ${l.texto}`); } });
ok(/ahora mismo/.test(C.hace(new Date().toISOString())) && /min/.test(C.hace(new Date(Date.now() - 600000).toISOString())) && C.hace(new Date(Date.now() - 90000000).toISOString()) === "ayer", "«hace...» funciona");
console.log(fallos ? `\nFALLOS: ${fallos}` : "\nTodo bien.");
process.exit(fallos ? 1 : 0);
