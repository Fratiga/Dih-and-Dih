// Comprueba que la guía de Triunfos del lobby (data/triunfos-guia.js) sigue al motor: cada palabra clave, cada
// tipo de habilidad y cada gancho de terreno tiene su entrada; las cartas que cita existen; los números
// (vida, mano, campo, tiempos) coinciden con las reglas; y los textos respetan el estilo de la casa.
// Uso: node tools/verificar-guia.js
const vm = require("vm"), fs = require("fs"), path = require("path");
const raiz = path.join(__dirname, "..");
const leer = f => fs.readFileSync(path.join(raiz, f), "utf8");
const sb = { console }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
for (const f of ["data/triunfos-guia.js", "js/cartas-datos.js", "js/cartas-motor.js", "js/cartas-efectos.js"]) vm.runInContext(leer(f), sb, { filename: f });
const G = sb.TRIUNFOS_GUIA, M = sb.CartasMotor;
const fallos = [];
const ok = (c, msg) => { if (!c) fallos.push(msg); };

// 1) Palabras clave: las del motor, las de las cartas y las que muestra el tablero
const palabrasGuia = new Set(G.palabras.map(p => p.id));
const delMotor = new Set([...leer("js/cartas-motor.js").matchAll(/tienePalabra\([^,()]+,[^,()]+,\s*"(\w+)"\)/g)].map(m => m[1]));
const deCartas = new Set(Object.values(M.EFECTOS).flatMap(ef => ef.palabras || []));
const deTablero = ["barrera", "escurridizo", "marcada"];
[...delMotor, ...deCartas, ...deTablero].forEach(k => ok(palabrasGuia.has(k), `falta la palabra clave «${k}» en la guía`));
G.palabras.forEach(p => { ok(p.nombre && p.resumen && p.detalle && p.detalle.length, `la palabra «${p.id}» está incompleta`); });
ok(new Set(G.palabras.map(p => p.id)).size === G.palabras.length, "palabras clave repetidas en la guía");

// 2) Tipos de habilidad: cada campo de cartas-efectos.js debe estar cubierto o ser interno
const campos = new Set(G.habilidades.map(h => h.campo).filter(Boolean));
const INTERNOS = new Set(["alCrear", "guardianUnaVez", "duplicaEn", "escurridizo"]);   // ajustes de otra habilidad o estados
const usados = new Set(Object.values(M.EFECTOS).flatMap(ef => Object.keys(ef)));
usados.forEach(k => ok(campos.has(k) || INTERNOS.has(k), `el campo «${k}» de cartas-efectos.js no está en la guía (habilidades[].campo)`));
// duplicaEn y pasivaAtq se explican bajo «Pasiva»; escurridizo bajo las palabras clave
ok(campos.has("terreno"), "falta la entrada de Terreno");

// 3) Ganchos de terreno
const GANCHOS = new Set(["duracion", "costeMod", "inicioTurno", "finTurno", "alEntrarUnidad", "alMorirUnidad", "daPalabra", "eco"]);
new Set(Object.values(M.TERRENOS).flatMap(t => Object.keys(t))).forEach(k => ok(GANCHOS.has(k), `gancho de terreno «${k}» sin revisar: actualiza la guía y GANCHOS en tools/verificar-guia.js`));

// 4) Cartas citadas
const ids = new Set(sb.CARTAS.map(c => c.id));
const citadas = [...G.palabras.flatMap(p => [...(p.cartas || []), ...(p.tambien || [])]), ...G.habilidades.flatMap(h => h.ejemplos || [])];
citadas.forEach(id => ok(ids.has(id), `la guía cita una carta que no existe: ${id}`));

// 5) Números que no pueden irse de las reglas
const texto = JSON.stringify(G);
const C = M.C;
const debe = (cadena, que) => ok(texto.includes(cadena), `la guía debería decir «${cadena}» (${que})`);
debe(`${C.VIDA} de vida`, "vida inicial");
debe(`${C.MANO_INICIAL} cartas`, "mano inicial");
debe(`${C.CAMPO_MAX} huecos`, "huecos del campo");
debe(`Caben ${C.MANO_MAX}`, "tamaño de la mano");
debe(`máximo de ${C.ENERGIA_MAX}`, "energía máxima");
debe(`entre ${C.MAZO_MIN} y ${C.MAZO_MAX} cartas`, "tamaño del mazo");
debe(`${M.TOPE_COPIAS.comun} de las comunes`, "copias de las comunes");
debe(`${M.TOPE_COPIAS.rara} de las raras`, "copias de las raras");
debe(`${M.TOPE_COPIAS.legendaria} de las legendarias`, "copias de las legendarias");
const bat = leer("js/batalla.js");
const seg = n => `${Number(n) / 1000} segundos`;
const bloqueo = bat.match(/ESPERA_BLOQUEO = (\d+)/), reaccion = bat.match(/ESPERA_REACCION = (\d+)/);
ok(bloqueo && texto.includes(seg(bloqueo[1])), "el tiempo para bloquear de la guía no coincide con batalla.js");
ok(reaccion && texto.includes(seg(reaccion[1])), "el tiempo para reaccionar de la guía no coincide con batalla.js");

// 6) Estilo de los textos: sin rayas largas ni voseo
const textos = []; (function recorre(v) { if (typeof v === "string") textos.push(v); else if (Array.isArray(v)) v.forEach(recorre); else if (v && typeof v === "object") Object.values(v).forEach(recorre); })(G);
textos.forEach(t => {
  ok(!/[—–]/.test(t), `raya larga en: ${t.slice(0, 60)}`);
  ok(!/\b(tenés|podés|elegí|hacé|mirá|sabés|querés|jugá|pulsá|usá|fijate|acá)\b/i.test(t), `voseo en: ${t.slice(0, 60)}`);
});

console.log(fallos.length ? `${fallos.length} fallo(s):\n  ${fallos.join("\n  ")}` : `OK: guía al día (${G.palabras.length} palabras, ${G.habilidades.length} tipos de habilidad, ${G.glosario.length} términos).`);
process.exit(fallos.length ? 1 : 0);
