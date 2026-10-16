// Comprueba la edición de textos del Bufón: que el diálogo real se carga y se puede recorrer como lo hace el panel de Admin, y que js/bufon-textos.js aplica los
// textos guardados sin romper el diálogo. Uso (desde la raíz del proyecto):  node docs/pruebas-web/bufon_textos.js
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

function nuevoMundo() {
  const ctx = { atob: s => Buffer.from(s, "base64").toString("binary"), window: {}, localStorage: { getItem: () => null, setItem() {} }, sessionStorage: { getItem: () => null, setItem() {} }, fetch: () => Promise.reject(new Error("sin red")), console };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  // los mismos archivos que carga el panel (js/admin-bufon-textos.js) y secreto.html
  for (const f of ["data/bufon-contenido.js", "data/bufon-evidencia.js", "data/bufon-voces.js", "data/bufon-ciclos-lista.js", "data/bufon-ciclos.js", "data/bufon-ciclo-fase3.js", "data/bufon-nombres-personajes.js"]) {
    try { vm.runInContext(fs.readFileSync(path.join(RAIZ, f), "utf8"), ctx); } catch (e) { console.log("  (aviso) " + f + ": " + e.message); }
  }
  vm.runInContext(fs.readFileSync(path.join(RAIZ, "js", "bufon-textos.js"), "utf8"), ctx);
  return ctx.window;
}

console.log("== El diálogo real se puede recorrer");
const W = nuevoMundo();
const D = W.BUFON_DIALOGO;
comprobar("hay un diálogo con nodos y elecciones", !!(D && D.nodos && D.elecciones), true);
const nodos = Object.keys(D.nodos).filter(id => Array.isArray(D.nodos[id].lineas) && D.nodos[id].lineas.every(l => typeof l === "string"));
comprobar("hay nodos con líneas de texto editables", nodos.length > 100, true);
const opciones = [];
Object.keys(D.elecciones).forEach(e => ((D.elecciones[e] || {}).opciones || []).forEach(o => { if (typeof o.texto === "string") opciones.push([e, o.id]); }));
comprobar("hay botones de elección editables", opciones.length > 20, true);
comprobar("los ids de los nodos caben en la clave del servidor (letras, números, _ . -)", nodos.every(id => /^[A-Za-z0-9_.-]{1,100}$/.test(id)), true);
comprobar("los ids de elecciones y opciones también", opciones.every(([e, o]) => /^[A-Za-z0-9_.-]{1,100}$/.test(e) && /^[A-Za-z0-9_.-]{1,100}$/.test(o)), true);

console.log("== Aplicar textos sin romper nada");
const aplicar = W.BufonTextos.aplicar;
const id1 = nodos[0], [e1, o1] = opciones[0];
const antes = JSON.parse(JSON.stringify(D.nodos[id1]));
const n = aplicar(D, { ["n:" + id1]: ["Línea nueva uno.", "Línea nueva dos."], [`o:${e1}:${o1}`]: "Botón nuevo", "n:no_existe": ["x"], "o:no:existe": "x" });
comprobar("se aplican el nodo y la opción", [n, D.nodos[id1].lineas, D.elecciones[e1].opciones.find(o => o.id === o1).texto], [2, ["Línea nueva uno.", "Línea nueva dos."], "Botón nuevo"]);
comprobar("lo demás del nodo (ramas, condiciones) queda igual", Object.keys(D.nodos[id1]).filter(k => k !== "lineas").every(k => JSON.stringify(D.nodos[id1][k]) === JSON.stringify(antes[k])), true);
const W2 = nuevoMundo(); const D2 = W2.BUFON_DIALOGO;
comprobar("valores que no encajan se ignoran (lista vacía, texto en vez de lista, línea vacía, número)", W2.BufonTextos.aplicar(D2, { ["n:" + id1]: [], ["n:" + nodos[1]]: "texto", ["n:" + nodos[2]]: ["ok", ""], ["n:" + nodos[3]]: [1] }), 0);
comprobar("el nodo no cambió con valores malos", D2.nodos[id1].lineas, antes.lineas);
const conFuncion = Object.keys(D.nodos).find(id => typeof D.nodos[id].lineas === "function");
if (conFuncion) comprobar("un nodo cuyas líneas calcula una función no se toca", W2.BufonTextos.aplicar(D2, { ["n:" + conFuncion]: ["x"] }), 0);

console.log(fallos ? `\n${fallos} fallo(s).` : "\nTodo bien.");
process.exit(fallos ? 1 : 0);
