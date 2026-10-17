// Comprueba las frases editables del Buhonero y del herrero: que js/dialogos-personajes.js reemplaza solo lo que debe, que las de fábrica (ORIGINALES) no cambian y que
// cada grupo tiene su explicación para el editor de Admin. Uso (desde la raíz del proyecto):  node docs/pruebas-web/dialogos_personajes.js
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

function mundo(guardado) {
  const almacen = guardado ? { dialogosPersonajes: JSON.stringify(guardado) } : {};
  const ctx = {
    console, matchMedia: () => ({ matches: true }), fetch: () => Promise.reject(new Error("sin red")),
    localStorage: { getItem: k => (k in almacen ? almacen[k] : null), setItem: (k, v) => { almacen[k] = v; } },
    sessionStorage: { getItem: () => String(Date.now()), setItem() {} }   // «ya se preguntó hace poco»: no hay refresco de red
  };
  ctx.window = ctx;   // el global del contexto es la propia ventana, para que DialogosPersonajes se vea también sin «window.»
  vm.createContext(ctx);
  for (const f of ["js/dialogos-personajes.js", "js/puesto-buhonero.js", "js/forja-herrero.js"]) {
    vm.runInContext(fs.readFileSync(path.join(RAIZ, f), "utf8"), ctx);
  }
  return ctx;
}

console.log("== Sin nada guardado, todo queda de fábrica");
let W = mundo(null);
const B = W.PuestoBuhonero, H = W.ForjaHerrero;
comprobar("el Buhonero tiene sus grupos de siempre", Object.keys(B.FRASES).length >= 12, true);
comprobar("el herrero también", Object.keys(H.FRASES).length >= 10, true);
comprobar("las de fábrica coinciden con las que usa el personaje", JSON.stringify(B.FRASES) === JSON.stringify(B.ORIGINALES) && JSON.stringify(H.FRASES) === JSON.stringify(H.ORIGINALES), true);
comprobar("cada grupo del Buhonero tiene su explicación para el editor", Object.keys(B.FRASES).every(g => typeof B.CUANDO[g] === "string" && B.CUANDO[g].length > 5), true);
comprobar("cada grupo del herrero también", Object.keys(H.FRASES).every(g => typeof H.CUANDO[g] === "string" && H.CUANDO[g].length > 5), true);
comprobar("ninguna frase de fábrica pasa los límites del servidor (1 a 30 frases, hasta 240 letras)", [B, H].every(P => Object.values(P.FRASES).every(l => W.DialogosPersonajes.valida(l))), true);

console.log("== Con frases guardadas");
W = mundo({ buhonero: { saludo: ["Hola, viajero.", "  Pasa.  "], exito: ["Hecho."], inventado: ["x"], error: [] }, herrero: { golpe: ["Calla."], fallo: ["", "x"], elige: "texto" } });
const B2 = W.PuestoBuhonero, H2 = W.ForjaHerrero;
comprobar("un grupo guardado reemplaza al de fábrica (y se recortan los espacios)", B2.FRASES.saludo, ["Hola, viajero.", "Pasa."]);
comprobar("otro grupo del mismo personaje", B2.FRASES.exito, ["Hecho."]);
comprobar("un grupo que el personaje no conoce se ignora", "inventado" in B2.FRASES, false);
comprobar("una lista vacía se ignora y queda de fábrica", B2.FRASES.error, B2.ORIGINALES.error);
comprobar("los grupos sin tocar siguen de fábrica", B2.FRASES.vacio, B2.ORIGINALES.vacio);
comprobar("las de fábrica no cambian aunque haya frases guardadas", B2.ORIGINALES.saludo.length >= 3 && B2.ORIGINALES.saludo[0] !== "Hola, viajero.", true);
comprobar("las frases del Buhonero no se mezclan con las del herrero", H2.FRASES.saludo, H2.ORIGINALES.saludo);
comprobar("el herrero recibe las suyas", H2.FRASES.golpe, ["Calla."]);
comprobar("una frase vacía anula la lista entera", H2.FRASES.fallo, H2.ORIGINALES.fallo);
comprobar("un texto donde iba una lista se ignora", H2.FRASES.elige, H2.ORIGINALES.elige);

console.log("== Los límites");
const D = W.DialogosPersonajes;
comprobar("31 frases no valen", D.valida(Array.from({ length: 31 }, () => "a")), false);
comprobar("30 frases sí", D.valida(Array.from({ length: 30 }, () => "a")), true);
comprobar("una frase de 241 letras no vale", D.valida(["a".repeat(241)]), false);
comprobar("una de 240 sí", D.valida(["a".repeat(240)]), true);
comprobar("un número no vale", D.valida([1]), false);
comprobar("el almacenamiento roto no rompe nada", (() => { const w = mundo(null); return typeof w.DialogosPersonajes.leer(); })(), "object");

console.log(fallos ? `\n${fallos} fallo(s).` : "\nTodo bien.");
process.exit(fallos ? 1 : 0);
