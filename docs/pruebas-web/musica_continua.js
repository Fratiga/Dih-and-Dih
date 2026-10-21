// Prueba de la opción «continua» de la música por página (js/musica-paginas.js), sin navegador: con un entorno simulado se comprueba que, con la opción,
// empezar o terminar una partida no cambia ni interrumpe la canción, y que sin ella la lista de partida sigue sustituyendo a la de fondo.
// Uso (desde la raíz del proyecto):  node docs/pruebas-web/musica_continua.js
const fs = require("fs");
const path = require("path");
const RAIZ = path.resolve(__dirname, "..", "..");
let fallos = 0, ok = 0;
const comprobar = (t, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  console.log((bien ? "  OK   " : "  FALLA ") + t + (bien ? "" : ` (esperado ${JSON.stringify(esperado)}, real ${JSON.stringify(real)})`));
  bien ? ok++ : fallos++;
};
const codigo = fs.readFileSync(path.join(RAIZ, "js", "musica-paginas.js"), "utf8");

// Carga el reproductor en una «página» simulada con esa configuración guardada en el caché del navegador
function cargar(config) {
  const almacen = { musicaPaginasCfg: JSON.stringify({ "veintiuna.html": config }) };
  const pausas = { n: 0 };
  class Audio {
    constructor() { this.src = ""; this.volume = 1; this.paused = true; this.ended = false; this.currentTime = 0; this.cambios = []; Audio.ultimo = this; }
    addEventListener() {} play() { this.paused = false; return Promise.resolve(); } pause() { if (!this.paused) pausas.n++; this.paused = true; }
  }
  const instancias = [];
  const AudioSim = function () { const a = new Audio(); let src = ""; Object.defineProperty(a, "src", { get: () => src, set: v => { src = v; a.cambios.push(v); } }); instancias.push(a); return a; };
  const ventana = {
    location: { pathname: "/veintiuna.html" }, localStorage: { getItem: k => (k in almacen ? almacen[k] : null), setItem: (k, v) => { almacen[k] = String(v); } },
    document: { hidden: false, readyState: "complete", body: null, head: { appendChild() {} }, addEventListener() {}, getElementById: () => null, querySelector: () => null, currentScript: null, createElement: () => ({ style: {}, addEventListener() {}, querySelector: () => null, appendChild() {} }) },
    addEventListener() {}, fetch: () => Promise.reject(new Error("sin red")), Audio: AudioSim, console, encodeURI, decodeURI, JSON, Math, Date, Array, Set, WeakSet, Promise, Number, String, Object
  };
  ventana.window = ventana;
  const f = new Function(...Object.keys(ventana), codigo);
  f(...Object.values(ventana));
  return { P: ventana.MusicaPaginas, audio: instancias[0], pausas, almacen };
}
const fondo = { lista: ["a.mp3", "b.mp3"], desdeCero: true, mezclar: false, volumen: 0.5 };
const partidaCfg = { lista: ["p1.mp3"], desdeCero: true, mezclar: false, volumen: 0.5 };
const sonando = a => decodeURIComponent(a.src);

console.log("== Sin la opción: la partida cambia de canción (como siempre)");
let t = cargar(Object.assign({}, fondo, { partida: partidaCfg }));
comprobar("al cargar suena la lista de fondo", sonando(t.audio), "a.mp3");
t.P.partida(true);
comprobar("al empezar una partida suena la de partida", sonando(t.audio), "p1.mp3");
t.P.partida(false);
comprobar("al terminarla vuelve la de fondo", sonando(t.audio), "a.mp3");

console.log("== Con «continua»: la canción no se toca");
t = cargar(Object.assign({}, fondo, { partida: partidaCfg, continua: true }));
const antes = t.audio.cambios.length;
t.audio.currentTime = 42;
t.P.partida(true);
comprobar("empezar una partida no cambia la canción", [sonando(t.audio), t.audio.cambios.length], ["a.mp3", antes]);
comprobar("ni la detiene", t.audio.paused, false);
comprobar("ni la rebobina", t.audio.currentTime, 42);
t.P.partida(false);
comprobar("terminarla tampoco cambia nada", [sonando(t.audio), t.audio.cambios.length, t.audio.paused, t.audio.currentTime], ["a.mp3", antes, false, 42]);
t.P.partida(true); t.P.partida(false); t.P.partida(true);
comprobar("varias partidas seguidas, igual", [sonando(t.audio), t.audio.cambios.length], ["a.mp3", antes]);

console.log("== Con «continua» y sin lista de partida");
t = cargar(Object.assign({}, fondo, { continua: true }));
t.P.partida(true);
comprobar("sigue la de fondo", sonando(t.audio), "a.mp3");

console.log("== Con «continua» y solo lista de partida");
t = cargar({ lista: [], partida: partidaCfg, continua: true });
comprobar("la de partida suena siempre, también sin partida", sonando(t.audio), "p1.mp3");
const n = t.audio.cambios.length;
t.P.partida(true); t.P.partida(false);
comprobar("y no se interrumpe al empezar ni terminar una partida", [sonando(t.audio), t.audio.cambios.length], ["p1.mp3", n]);

console.log("== El editor guarda y lee la opción");
const ed = fs.readFileSync(path.join(RAIZ, "js", "musica-paginas-editor.js"), "utf8");
comprobar("el editor muestra la casilla solo en páginas con partida", /st\.conPartida \? `<div class="mpe-opciones mpe-continua">/.test(ed), true);
comprobar("la lee de la configuración, la copia con la lista de otra página y la guarda", [/continua: !!\(o\.config && o\.config\.continua\)/.test(ed), /st\.continua = !!otra\.continua/.test(ed), /cfg\.continua = true/.test(ed)], [true, true, true]);

console.log(fallos ? `\n${fallos} fallo(s), ${ok} bien.` : `\nTodo bien (${ok} comprobaciones).`);
process.exit(fallos ? 1 : 0);
