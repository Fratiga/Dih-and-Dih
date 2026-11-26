// Comprueba que el lobby (index.html + js/lobby-salas.js) enlaza TODAS las páginas del sitio y que sus objetos llevan donde deben.
// Uso (desde la raíz del proyecto):  node docs/pruebas-web/enlaces_lobby.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = path.resolve(__dirname, "..", "..");
let fallos = 0;
const ok = t => console.log("  OK   " + t);
const mal = t => { console.log("  FALLA " + t); fallos++; };
const comprobar = (t, cond, extra) => (cond ? ok(t) : mal(t + (extra ? ` (${extra})` : "")));

// Páginas que no se enlazan a propósito: la propia portada y las secretas
const EXCLUIDAS = new Set(["index.html", "secreto.html", "muerte-subita.html", "encuentro-verdam.html", "veintiuna-amigos.html", "ultima-vela.html", "fractura-guerra.html", "concurso-jugador.html", "mapa-vectorial-prueba.html"]);   // fractura-guerra se abre desde el cuartel de La Fractura; concurso-jugador solo sirve con el enlace personal de cada jugador; mapa-vectorial-prueba es una prueba local   // la mesa con amigos solo se entra desde Las Veintiuna Velas y La Última Vela desde Muerte Súbita; El Pozo del Dragón está oculto (solo admin, tarjeta «En pruebas» de Minijuegos) hasta que se abra

// El mapa del lobby: se ejecuta lobby-salas.js sin navegador, con la página «sin cargar» para que no dibuje nada
const ventana = {};
const contexto = { window: ventana, document: { readyState: "loading", addEventListener() {}, getElementById() { return null; } }, location: { hash: "" }, console };
vm.createContext(contexto);
vm.runInContext(fs.readFileSync(path.join(RAIZ, "js", "lobby-salas.js"), "utf8"), contexto);
const { MAPA, ORDEN: ORDEN_SALAS } = ventana.LobbyMapa;

const hrefsMapa = new Set();
Object.values(MAPA).forEach(s => s.grupos.forEach(g => g.enlaces.forEach(e => hrefsMapa.add(e[0]))));

const html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
const escena = html.slice(html.indexOf('<svg class="lb-escena" id="lbEscena"'), html.indexOf('<div id="lbSalas"'));   // la ventana lleva un <svg> anidado: se corta donde empiezan las salas
const hrefsEscena = [...escena.matchAll(/<a [^>]*href="([^"]+)"/g)].map(m => m[1]);
const hrefsPagina = [...html.matchAll(/<a [^>]*href="([^"#][^"]*\.html[^"]*)"/g)].map(m => m[1]);

console.log("== Todas las páginas del sitio tienen enlace en el lobby");
const paginas = fs.readdirSync(RAIZ).filter(f => f.endsWith(".html") && !f.startsWith("_") && !EXCLUIDAS.has(f));
paginas.forEach(p => comprobar(`${p} está enlazada`, hrefsMapa.has(p)));

console.log("== Cada enlace del mapa lleva a una página que existe");
[...hrefsMapa].forEach(h => comprobar(`${h} existe`, fs.existsSync(path.join(RAIZ, h))));

console.log("== Los objetos de la taberna");
const paginasEscena = hrefsEscena.filter(h => h.endsWith(".html"));
const salasEscena = hrefsEscena.filter(h => h.startsWith("#")).map(h => h.slice(1));
paginasEscena.forEach(h => comprobar(`el objeto «${h}» del dibujo plano está en el mapa`, hrefsMapa.has(h)));
salasEscena.forEach(s => comprobar(`la puerta «#${s}» lleva a una sala que existe`, !!MAPA[s]));
["duelo.html", "ajedrez.html", "arqueria.html"].forEach(h => comprobar(`${h} ya no es un objeto de la taberna (solo decoración)`, !hrefsEscena.includes(h)));
["compendio.html", "minijuegos.html", "peticiones.html", "habitacion.html", "fanarts.html"].forEach(h => comprobar(`${h} sigue siendo un objeto de la taberna`, hrefsEscena.includes(h)));
comprobar("los fanarts nuevos van dentro del tablón de anuncios (js/lobby.js clava cuatro enlaces a la galería en #lbTablonCuadros)", escena.includes('id="lbTablonCuadros"') && hrefsEscena.includes("peticiones.html"));
comprobar("el cuadro que cicla los fanarts sigue en la escena", escena.includes('id="rotacionInner"'));
comprobar("las salas privadas (despacho) solo se enseñan al admin", /<a [^>]*data-admin-only[^>]*href="#despacho"/.test(escena));

console.log("== Los juegos y el Hipódromo cada uno en su sala");
const sala = (clave) => new Set(MAPA[clave].grupos.flatMap(g => g.enlaces.map(e => e[0])));
["minijuegos.html", "ajedrez.html", "arqueria.html", "ritmo.html", "parranda.html", "sacrificio.html", "duelo.html", "ostelar.html", "fractura.html"].forEach(h => comprobar(`${h} está en la sala recreativa`, sala("juegos").has(h)));
["cartas.html", "mazos.html", "batalla.html", "veintiuna.html", "pozo-dragon.html"].forEach(h => comprobar(`${h} está en el salón de naipes`, sala("naipes").has(h)));
["tablero.html", "mapa.html", "fichas.html", "cronica.html", "discord.html"].forEach(h => comprobar(`${h} está en la sala de campaña`, sala("campana").has(h)));
["hipodromo.html", "hipodromo-vivo.html", "corrales.html"].forEach(h => {
  comprobar(`${h} está en los establos`, sala("establos").has(h));
  comprobar(`${h} no está en la sala recreativa`, !sala("juegos").has(h));
});
["admin.html", "ritmo-editor.html", "parranda-editor.html"].forEach(h => comprobar(`${h} está en el despacho (solo admin)`, sala("despacho").has(h) && MAPA.despacho.admin));
["cronologia.html", "lugares.html", "facciones.html", "personajes.html", "razas.html", "religion.html", "textos.html", "pergaminos.html", "armas.html", "objetos.html", "bestiario.html", "reglas.html", "economia.html", "estadisticas.html"].forEach(h => comprobar(`${h} está en la biblioteca`, sala("biblioteca").has(h)));

comprobar("el tablero de las partidas es un objeto de la taberna", hrefsEscena.includes("tablero.html"));
comprobar("Estocatta está en la sala recreativa y abierta a todos", MAPA.juegos.grupos.some(g => g.enlaces.some(e => e[0] === "estocatta.html" && !e[3])));
comprobar("la cabina y el programa del Concurso están en el despacho", sala("despacho").has("concurso.html") && sala("despacho").has("concurso-programa.html"));
comprobar("la biblioteca de los jugadores está en la Biblioteca", sala("biblioteca").has("biblioteca.html"));
console.log("== Cada página en una sola sala");
const vistas = new Map();
Object.entries(MAPA).forEach(([c, s]) => s.grupos.forEach(g => g.enlaces.forEach(e => vistas.set(e[0], [...(vistas.get(e[0]) || []), c]))));
[...vistas].forEach(([h, salas]) => comprobar(`${h} solo está en una sala`, salas.length === 1, salas.join(", ")));

console.log("== Las salas 2.5D (js/salas3d/salas.js)");
const salas3d = fs.readFileSync(path.join(RAIZ, "js", "salas3d", "salas.js"), "utf8");
[...hrefsMapa].filter(h => h !== "forja.html").forEach(h => comprobar(`${h} tiene su objeto en la maqueta`, salas3d.includes(`"${h}"`)));
ORDEN_SALAS.forEach(c => comprobar(`la sala «${c}» existe en la maqueta`, salas3d.includes(`  ${c}: { nombre:`)));
ORDEN_SALAS.filter(c => c !== "taberna").forEach(c => comprobar(`la taberna tiene puerta a «${c}»`, salas3d.includes(`"#${c}"`)));
comprobar("la portada monta la maqueta y vuelve al dibujo plano si falla", html.includes("salas3d/motor.js") && html.includes("window.lbPlano"));

console.log("== Otros");
comprobar("la lista «Todas las puertas» sale de la misma fuente (está vacía en el HTML)", /<section class="lb-zonas" id="lbZonas"><\/section>/.test(html));
const puertas = html.slice(html.indexOf('<nav class="lb-puertas'), html.indexOf("</nav>", html.indexOf('<nav class="lb-puertas')));
comprobar("las puertas grandes del móvil no llevan al ajedrez suelto", !puertas.includes("ajedrez.html"));
comprobar("los enlaces .html de las puertas del móvil existen", [...puertas.matchAll(/href="([^"]+)"/g)].every(m => fs.existsSync(path.join(RAIZ, m[1]))));
hrefsPagina.forEach(h => comprobar(`el enlace «${h}» de index.html existe`, fs.existsSync(path.join(RAIZ, h.split("?")[0].split("#")[0]))));

console.log(fallos ? `\n${fallos} fallo(s).` : "\nTodo bien.");
process.exit(fallos ? 1 : 0);
