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
const EXCLUIDAS = new Set(["index.html", "secreto.html", "muerte-subita.html", "encuentro-verdam.html", "veintiuna-amigos.html", "ultima-vela.html"]);   // la mesa con amigos solo se entra desde Las Veintiuna Velas y La Última Vela desde Muerte Súbita

// El mapa del lobby: se ejecuta lobby-salas.js sin navegador, con la página «sin cargar» para que no dibuje nada
const ventana = {};
const contexto = { window: ventana, document: { readyState: "loading", addEventListener() {}, getElementById() { return null; } }, location: { hash: "" }, console };
vm.createContext(contexto);
vm.runInContext(fs.readFileSync(path.join(RAIZ, "js", "lobby-salas.js"), "utf8"), contexto);
const { MAPA } = ventana.LobbyMapa;

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
paginasEscena.forEach(h => comprobar(`el objeto «${h}» de la escena está en el mapa de la taberna`, MAPA.taberna.grupos[0].enlaces.some(e => e[0] === h)));
salasEscena.forEach(s => comprobar(`la puerta «#${s}» lleva a una sala que existe`, !!MAPA[s]));
["duelo.html", "ajedrez.html", "arqueria.html"].forEach(h => comprobar(`${h} ya no es un objeto de la taberna (solo decoración)`, !hrefsEscena.includes(h)));
["compendio.html", "minijuegos.html", "peticiones.html", "habitacion.html", "fanarts.html"].forEach(h => comprobar(`${h} sigue siendo un objeto de la taberna`, hrefsEscena.includes(h)));
comprobar("los fanarts nuevos van dentro del tablón de anuncios (js/lobby.js clava cuatro enlaces a la galería en #lbTablonCuadros)", escena.includes('id="lbTablonCuadros"') && hrefsEscena.includes("peticiones.html"));
comprobar("el cuadro que cicla los fanarts sigue en la escena", escena.includes('id="rotacionInner"'));
comprobar("las salas privadas (despacho) solo se enseñan al admin", /<a [^>]*data-admin-only[^>]*href="#despacho"/.test(escena));

console.log("== Los juegos y el Hipódromo cada uno en su sala");
const sala = (clave) => new Set(MAPA[clave].grupos.flatMap(g => g.enlaces.map(e => e[0])));
["ajedrez.html", "arqueria.html", "ritmo.html", "parranda.html", "sacrificio.html", "duelo.html", "ostelar.html", "fractura.html", "cartas.html", "mazos.html", "batalla.html"].forEach(h => comprobar(`${h} está en la sala recreativa`, sala("juegos").has(h)));
["hipodromo.html", "hipodromo-vivo.html", "corrales.html"].forEach(h => {
  comprobar(`${h} está en los establos`, sala("establos").has(h));
  comprobar(`${h} no está en la sala recreativa`, !sala("juegos").has(h));
});
["admin.html", "ritmo-editor.html", "parranda-editor.html"].forEach(h => comprobar(`${h} está en el despacho (solo admin)`, sala("despacho").has(h) && MAPA.despacho.admin));
["cronologia.html", "lugares.html", "facciones.html", "personajes.html", "razas.html", "religion.html", "textos.html", "pergaminos.html", "armas.html", "objetos.html", "bestiario.html", "reglas.html", "economia.html", "estadisticas.html"].forEach(h => comprobar(`${h} está en la biblioteca`, sala("biblioteca").has(h)));

console.log("== Otros");
comprobar("la lista «Todas las puertas» sale de la misma fuente (está vacía en el HTML)", /<section class="lb-zonas" id="lbZonas"><\/section>/.test(html));
const puertas = html.slice(html.indexOf('<nav class="lb-puertas'), html.indexOf("</nav>", html.indexOf('<nav class="lb-puertas')));
comprobar("las puertas grandes del móvil no llevan al ajedrez suelto", !puertas.includes("ajedrez.html"));
comprobar("los enlaces .html de las puertas del móvil existen", [...puertas.matchAll(/href="([^"]+)"/g)].every(m => fs.existsSync(path.join(RAIZ, m[1]))));
hrefsPagina.forEach(h => comprobar(`el enlace «${h}» de index.html existe`, fs.existsSync(path.join(RAIZ, h.split("?")[0].split("#")[0]))));

console.log(fallos ? `\n${fallos} fallo(s).` : "\nTodo bien.");
process.exit(fallos ? 1 : 0);
