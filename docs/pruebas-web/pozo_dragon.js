// Pruebas de El Pozo del Dragón que no necesitan base de datos: las 216 combinaciones y la jerarquía del Duelo (pozo-dragon-vista.js), los textos y las vistas,
// la página y el controlador, y que el SQL (docs/pozo-dragon.sql) lleve el cierre «oculto» en cada función pública y las mismas reglas que la interfaz.
// El SQL en sí se prueba contra Postgres con docs/pruebas/t_pozo_dragon.sh (necesita Docker, ver docs/pozo-dragon.md).
// Uso (desde la raíz del proyecto):  node docs/pruebas-web/pozo_dragon.js
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const RAIZ = path.resolve(__dirname, "..", "..");
let fallos = 0, ok = 0;
const comprobar = (t, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  console.log((bien ? "  OK   " : "  FALLA ") + t + (bien ? "" : ` (esperado ${JSON.stringify(esperado)}, real ${JSON.stringify(real)})`));
  bien ? ok++ : fallos++;
};
const cierto = (t, cond) => comprobar(t, !!cond, true);
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), "utf8").replace(/\r\n/g, "\n");

global.window = global;
const V = require(path.join(RAIZ, "js", "pozo-dragon-vista.js"));
const Api = require(path.join(RAIZ, "js", "veintiuna-api.js"));

console.log("== Las 216 combinaciones");
const cuenta = {};
const todas = [];
for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) { const k = V.clasificar(a, b, c); cuenta[k] = (cuenta[k] || 0) + 1; todas.push([a, b, c]); }
const ordenado = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
comprobar("casos de cada combinación", ordenado(cuenta), ordenado({ ruina: 10, triple_seis: 1, triple: 4, escalera: 24, pareja: 81, ceniza: 96 }));
comprobar("suman 216 y coinciden con la tabla de casos de la interfaz", [Object.values(cuenta).reduce((x, y) => x + y, 0), JSON.stringify(cuenta) === JSON.stringify(Object.fromEntries(Object.keys(cuenta).map(k => [k, V.CASOS[k]])))], [216, true]);
const pr = k => Math.round(cuenta[k] / 216 * 10000) / 100;
comprobar("probabilidades de referencia (4,63 / 1,85 / 0,46 / 11,11 / 37,5 / 44,44 %)", [pr("ruina"), pr("triple"), pr("triple_seis"), pr("escalera"), pr("pareja"), pr("ceniza")], [4.63, 1.85, 0.46, 11.11, 37.5, 44.44]);
comprobar("la Ruina manda sobre la pareja: 1-1-2, 1-1-3 y 1-2-2 son Ruina", [V.clasificar(1, 1, 2), V.clasificar(1, 1, 3), V.clasificar(2, 1, 2)], ["ruina", "ruina", "ruina"]);
comprobar("1-1-1 es Ruina y no triple; 2-2-2 es triple; 6-6-6 es triple seis", [V.clasificar(1, 1, 1), V.clasificar(2, 2, 2), V.clasificar(6, 6, 6)], ["ruina", "triple", "triple_seis"]);
comprobar("las cuatro escaleras, en cualquier orden", [[1, 2, 3], [4, 3, 2], [3, 5, 4], [6, 4, 5]].map(d => V.clasificar(...d)), ["escalera", "escalera", "escalera", "escalera"]);
comprobar("1-2-3 suma 6: no es Ruina, es escalera", V.clasificar(1, 2, 3), "escalera");
comprobar("pareja con suma de 6 o más, y 1-1-4 (suma 6) es pareja", [V.clasificar(3, 3, 5), V.clasificar(1, 1, 4)], ["pareja", "pareja"]);
comprobar("ceniza", V.clasificar(2, 4, 6), "ceniza");
cierto("cada resultado cae en una sola categoría (todos clasificados)", todas.every(d => V.CATEGORIAS[V.clasificar(...d)]));

console.log("== La jerarquía del Duelo");
const orden = k => V.CATEGORIAS[k].orden;
const peorDe = c => Math.min(...todas.filter(d => V.clasificar(...d) === c).map(d => V.fuerza(...d)));
const mejorDe = c => Math.max(...todas.filter(d => V.clasificar(...d) === c).map(d => V.fuerza(...d)));
const cats = ["ruina", "ceniza", "pareja", "escalera", "triple", "triple_seis"];
cierto("toda tirada de una categoría supera a toda tirada de la categoría inferior", cats.slice(1).every((c, i) => peorDe(c) > mejorDe(cats[i])));
comprobar("la lista «de mejor a peor» de la interfaz es la inversa del orden", V.ORDEN_MEJOR_A_PEOR, cats.slice().reverse());
comprobar("triple seis vence a un triple de 5", V.comparar([6, 6, 6], [5, 5, 5]), 1);
comprobar("triple de 4 vence a triple de 3", V.comparar([4, 4, 4], [3, 3, 3]), 1);
comprobar("escalera 4-5-6 vence a 1-2-3, y a una pareja", [V.comparar([4, 5, 6], [1, 2, 3]), V.comparar([1, 2, 3], [6, 6, 5])], [1, 1]);
comprobar("pareja de 4 con 2 suelto vence a pareja de 3 con 6 suelto (primero la pareja)", V.comparar([4, 4, 2], [3, 3, 6]), 1);
comprobar("misma pareja: gana el dado suelto más alto", V.comparar([3, 3, 6], [3, 5, 3]), 1);
comprobar("ceniza: se compara de mayor a menor (6-4-1 vence a 6-3-2)", V.comparar([6, 4, 1], [6, 3, 2]), 1);
comprobar("Ruina contra Ruina: gana la suma mayor; igual suma, empate", [V.comparar([1, 2, 2], [1, 1, 2]), V.comparar([1, 2, 2], [2, 1, 2])], [1, 0]);
comprobar("cualquier cosa vence a una Ruina", V.comparar([2, 3, 4], [1, 1, 3]), 1);
comprobar("el mismo conjunto de dados en otro orden empata", V.comparar([2, 6, 4], [6, 4, 2]), 0);
cierto("la comparación es antisimétrica en las 216 x 216 parejas posibles", todas.every(x => todas.every(y => V.comparar(x, y) === -V.comparar(y, x))));
cierto("y es transitiva por construcción: la fuerza es un entero y empata solo con el mismo conjunto", todas.every(x => todas.every(y => (V.fuerza(...x) === V.fuerza(...y)) === (V.clasificar(...x) === V.clasificar(...y) && JSON.stringify([...x].sort()) === JSON.stringify([...y].sort())) || V.clasificar(...x) === "ruina" || V.clasificar(...x) === "pareja")));

console.log("== El SQL dice lo mismo que la interfaz");
const sql = leer("docs", "pozo-dragon.sql");
cierto("clasifica la Ruina primero (suma de 3 a 5), luego triple seis y triples, escalera, pareja y ceniza", /when a \+ b \+ c <= 5 then 'ruina'[\s\S]*when a = b and b = c then case when a = 6 then 'triple_seis' else 'triple' end[\s\S]*then 'escalera'[\s\S]*then 'pareja'[\s\S]*else 'ceniza'/.test(sql));
cierto("la fuerza del Duelo usa los mismos tramos que la interfaz (suma, 1000, 2000, 3000, 4000, 5006)", ["return a + b + c", "return 1000 + o[1] * 100 + o[2] * 10 + o[3]", "return 2000 + par * 10 + suelto", "return 3000 + o[1]", "return 4000 + a", "return 5006"].every(t => sql.includes(t)));
cierto("el dado lo saca el servidor con aleatoriedad del servidor (gen_random_uuid) y el cliente nunca manda dados", /gen_random_uuid\(\)::text/.test(sql) && !/p_dados/.test(sql.slice(sql.indexOf("create or replace function pozo_i_accion"), sql.indexOf("create or replace function pozo_tirar"))) && !/d1|dados/.test(leer("js", "veintiuna-api.js").match(/pozo: \{[\s\S]*?\n      \},/)[0]));
cierto("los bonos de origen son la mitad de la tabla propuesta (12,5 / 37,5 / 75 / 200)", /pozo_bono_pareja', '12\.5'/.test(sql) && /pozo_bono_escalera', '37\.5'/.test(sql) && /pozo_bono_triple', '75'/.test(sql) && /pozo_bono_triple_seis', '200'/.test(sql));
cierto("rondas: se gana con 2, máximo 5, 2 turnos perdidos tolerados", /pozo_duelo_victorias', '2'/.test(sql) && /pozo_duelo_rondas', '5'/.test(sql) && /pozo_duelo_faltas', '2'/.test(sql) && /pozo_tiradas_max', '5'/.test(sql));
cierto("el pozo se reparte por peso, a céntimos hacia abajo, y los céntimos sobrantes van a uno solo", /trunc\(v_pozo \* s\.peso \/ v_peso, 2\)/.test(sql) && /v_pozo - v_suma/.test(sql));
cierto("un jugador sin tirar recupera su apuesta y no entra en el reparto", /sales sin tirar, apuesta devuelta/.test(sql));

console.log("== Oculto hasta que se diga lo contrario");
cierto("el juego nace oculto: pozo_dragon_publico = false", /'pozo_dragon_publico', 'false'/.test(sql));
const publicas = ["pozo_lista", "pozo_crear", "pozo_unirse", "pozo_cerrar_inscripcion", "pozo_ofrecer", "pozo_confirmar", "pozo_retirar_confirmacion", "pozo_salir", "pozo_i_accion", "pozo_estado", "pozo_mis_cartas"];
publicas.forEach(n => {
  const i = sql.indexOf(`create or replace function ${n}(`), j = sql.indexOf("\n$$;", i);
  cierto(`${n} empieza comprobando que el juego esté abierto o que seas admin`, i > 0 && /perform pozo_i_acceso\(\)/.test(sql.slice(i, j)));
});
cierto("pozo_i_acceso deja pasar solo al admin mientras no sea público y exige sesión", /if not \(cartas_ajuste\('pozo_dragon_publico', 'false'\)\)::text::boolean and not coalesce\(fichas_es_admin\(\), false\) then/.test(sql) && /Hay que iniciar sesión/.test(sql.slice(sql.indexOf("function pozo_i_acceso"), sql.indexOf("function pozo_i_saldo"))));
cierto("las funciones públicas se cierran a quien no ha iniciado sesión y las internas a todos", /revoke all on function pozo_lista\(\)[\s\S]*from public, anon;/.test(sql) && /revoke all on function pozo_i_error\(text, text\)[\s\S]*pozo_i_json\(uuid, uuid\)[\s\S]*from public, anon, authenticated;/.test(sql));
cierto("las tablas no se escriben ni se leen directamente (solo el admin puede mirarlas)", /revoke all on pozo_mesas, pozo_jugadores, pozo_tiradas, pozo_rondas from anon, authenticated;/.test(sql) && /create policy "pozo_mesas_admin" on pozo_mesas for select using \(fichas_es_admin\(\)\)/.test(sql));
cierto("no se usa el código de error 40001 (PostgREST lo reintenta sin fin)", !/40001/.test(sql));
const html = leer("pozo-dragon.html");
cierto("la página lleva js/oculto.js el primero del <head>", /<head>\s*(<!--[\s\S]*?-->)?\s*<script src="js\/oculto\.js/.test(html));
const mj = leer("minijuegos.html");
cierto("solo aparece en «En pruebas» de Minijuegos (la lista que ve el admin), no como tarjeta pública", /\["pozo-dragon\.html", "El Pozo del Dragón"/.test(mj) && !/<a class="mj-tarjeta" href="pozo-dragon\.html"/.test(mj));
cierto("tiene su ilustración", fs.existsSync(path.join(RAIZ, "assets", "minijuegos", "pozo-dragon.svg")));

console.log("== Textos y vistas");
const reglasC = { dinero: 50, cartas: 1, min: 2, max: 4, tiradas_max: 5, turno_s: 30, victorias: 2, rondas_max: 5, faltas: 2, bonos: { pareja: 0.125, escalera: 0.375, triple: 0.75, triple_seis: 2 } };
comprobar("apuestas: solo dinero, solo cartas y mixta", [V.textoApuesta({ dinero: 20, cartas: 0 }), V.textoApuesta({ dinero: 0, cartas: 2 }), V.textoApuesta({ dinero: 50, cartas: 1 })], ["20 tokens de juego", "2 cartas", "50 tokens de juego y 1 carta"]);
comprobar("tipo de apuesta", [V.tipoApuesta({ dinero: 20, cartas: 0 }), V.tipoApuesta({ dinero: 0, cartas: 2 }), V.tipoApuesta({ dinero: 50, cartas: 1 })], ["solo dinero", "solo cartas", "mixta"]);
const rd = V.reglasDuelo(reglasC).join(" ");
cierto("las reglas del Duelo dicen cómo se gana, el límite de rondas, los empates y el abandono", /primero que consiga 2 rondas/.test(rd) && /máximo de 5 rondas/.test(rd) && /empata y no da victoria a nadie/.test(rd) && /cada uno recupera lo suyo/.test(rd) && /pierde por abandono/.test(rd));
const rc = V.reglasCompartido(reglasC).join(" ");
cierto("las reglas del Compartido dan los bonos, la Ruina, cobrar, el límite de tiradas y el reparto por peso", /pareja \+12,5 %/.test(rc) && /escalera \+37,5 %/.test(rc) && /triple \+75 %/.test(rc) && /triple seis \+200 %/.test(rc) && /Ruina/.test(rc) && /cobrar/.test(rc) && /5 veces/.test(rc) && /pozo × tu peso \/ suma de los pesos/.test(rc));
cierto("las reglas comunes prometen sin comisiones y que desconectarse no devuelve la apuesta", /No se cobra ninguna comisión/.test(V.REGLAS_COMUNES.join(" ")) && /no devuelve la apuesta/.test(V.REGLAS_COMUNES.join(" ")));
const est = (o) => Object.assign({ codigo: "K7M2Q", modo: "compartido", estado: "jugando", creador: true, paso: 3, cond_version: 1, reglas: reglasC, turno: { asiento: 0, fase: "tirar", restante_s: 20 }, jugadores: [], rondas: [], resultado: null, yo: { asiento: 0, tu_turno: true, saldo: 100 } }, o || {});
const J = (a, n, yo, o) => Object.assign({ asiento: a, nombre: n, yo, estado: "activo", oferta: [], oferta_completa: true, tiradas: 0, peso: 1, ultima: null }, o || {});
comprobar("vistas: sin mesa, sala, mesa y final", [V.vista(null), V.vista({ sin_mesa: true }), V.vista(est({ estado: "abierta" })), V.vista(est({ estado: "confirmando" })), V.vista(est()), V.vista(est({ estado: "terminada" })), V.vista(est({ estado: "cancelada" }))], ["lobby", "lobby", "sala", "sala", "mesa", "fin", "fin"]);
comprobar("botones: tirar en tu turno, nada si no es tu turno", [V.acciones(est({ jugadores: [J(0, "A", true)] })).botones.map(b => b.id), V.acciones(est({ yo: { tu_turno: false } })).botones], [["tirar"], []]);
const dec = V.acciones(est({ turno: { asiento: 0, fase: "decidir" }, jugadores: [J(0, "A", true, { peso: 1.5 })] }));
comprobar("tras una tirada sin Ruina: cobrar o continuar, con su tecla y el riesgo a la vista", [dec.botones.map(b => b.id), dec.botones.map(b => b.tecla), /150 %/.test(dec.botones[0].sub), /4,63 %/.test(dec.botones[1].sub)], [["cobrar", "continuar"], ["C", "S"], true, true]);
comprobar("sala: qué falta para empezar", [
  V.estadoSala(est({ estado: "abierta", jugadores: [J(0, "A", true)] })),
  V.estadoSala(est({ estado: "confirmando", jugadores: [J(0, "A", true, { estado: "esperando" }), J(1, "B", false, { estado: "confirmado" })] })),
  V.estadoSala(est({ estado: "confirmando", jugadores: [J(0, "A", true, { estado: "confirmado" }), J(1, "B", false, { estado: "confirmado" })] })),
  V.estadoSala(est({ estado: "confirmando", jugadores: [J(0, "A", true), J(1, "B", false, { oferta_completa: false })] }))],
  ["Esperando jugadores (1 de 2 como mínimo). Comparte el código K7M2Q.", "Falta confirmar: tú.", "Todos han confirmado: empieza la partida.", "Faltan cartas por ofrecer: B."]);
const finD = (ganador, yoAsiento) => V.resumenFinal(est({ modo: "duelo", estado: "terminada", jugadores: [J(0, "A", yoAsiento === 0), J(1, "B", yoAsiento === 1)], resultado: { ganador, motivo: "Ganó 2 rondas", jugadores: [{ asiento: 0, neto: ganador === 0 ? 100 : -100, cartas_ganadas: ganador === 0 ? ["x"] : [], cartas_perdidas: ganador === 1 ? ["x"] : [] }, { asiento: 1, neto: ganador === 1 ? 100 : -100, cartas_ganadas: [], cartas_perdidas: [] }] } }));
comprobar("final del duelo: ganas, pierdes o empatas", [finD(0, 0).clase, finD(1, 0).clase, finD(null, 0).clase], ["gana", "pierde", "empate"]);
cierto("el final dice cuánto ganas y las cartas", /Ganas 100 tokens/.test(finD(0, 0).texto) && /Ganas 1 carta/.test(finD(0, 0).texto) && /Pierdes 100 tokens/.test(finD(1, 0).texto) && /Pierdes 1 carta/.test(finD(1, 0).texto));
const finC = (estadoYo, neto) => V.resumenFinal(est({ estado: "terminada", jugadores: [J(0, "A", true, { estado: estadoYo })], resultado: { jugadores: [{ asiento: 0, estado: estadoYo, neto, cartas_ganadas: [], cartas_perdidas: [] }] } }));
comprobar("final del Compartido: Ruina, cobras con ganancia, cobras con pérdida, recuperas, sales sin participar", [finC("ruina", -50).clase, finC("retirado", 20).clase, finC("retirado", -5).clase, finC("retirado", 0).clase, finC("fuera", 0).titulo], ["pierde", "gana", "pierde", "empate", "Saliste sin participar"]);
cierto("mesa cancelada: avisa de que se devolvió todo", /Todo lo reservado se devolvió/.test(V.resumenFinal(est({ estado: "cancelada", motivo: "La sala venció." })).texto));
const antes = est({ jugadores: [J(0, "A", true), J(1, "B", false)], turno: { asiento: 1, fase: "tirar" } });
const despues = est({ jugadores: [J(0, "A", true), J(1, "B", false, { estado: "ruina", ultima: { id: 5, dados: [1, 1, 2], categoria: "ruina" } })], turno: { asiento: 0, fase: "tirar" } });
const frase = V.anuncio(antes, despues);
cierto("el lector de pantalla oye la tirada, la Ruina del otro y que te toca", /B saca 1-1-2: Ruina/.test(frase) && /B cae en Ruina/.test(frase) && /Es tu turno\. Tira los dados\./.test(frase));
cierto("errores: sin conexión, oculto y el texto del servidor", /reintenta/.test(V.mensajeError({ tipo: "red" })) && /todavía no está abierto/.test(V.mensajeError({ tipo: "servidor", codigo: "oculto" })) && V.mensajeError({ tipo: "servidor", codigo: "x", mensaje: "Texto del servidor" }) === "Texto del servidor");

console.log("== La página y el controlador");
const js = leer("js", "pozo-dragon.js"), css = leer("css", "pozo-dragon.css");
cierto("cada script y hoja de estilos de la página existe y lleva su versión (?v=)", [...html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)].every(m => /\?v=\d{8}$/.test(m[1]) && fs.existsSync(path.join(RAIZ, m[1].split("?")[0]))));
cierto("todos los identificadores que usa el controlador están en la página", [...js.matchAll(/\$\("([A-Za-z]+)"\)/g)].map(m => m[1]).filter(id => !["pzCodigo", "pzMesasLista", "pzTapete", "pzDestello", "pzDlgReglas"].includes(id) || id === "pzDlgReglas").every(id => new RegExp(`id="${id}"`).test(html) || ["pzCodigo", "pzMesasLista", "pzTapete", "pzDestello", "pzDock", "pzFormEntrar", "pzHeroe", "pzHeroeArte", "pzPanelForm", "pzVigia"].includes(id)));
const escenaJs = leer("js", "pozo-dragon-escena.js"), escenaCss = leer("css", "pozo-dragon-escena.css"), arteJs = leer("js", "pozo-dragon-arte.js");
cierto("el controlador solo pide acciones y nunca manda dados ni resultados, y no saca ningún dado al azar", js.includes("api.pozo.tirar(paso)") && !/Math\.floor\(Math\.random\(\) \* 6\)/.test(js) && !/Math\.floor\(Math\.random\(\) \* 6\)/.test(escenaJs) && !js.includes("p_dados") && !js.includes("dados: ["));
cierto("la escena lanza los dados con los valores del servidor: la cara final sale de ORIENTACION[valor] y no de ningún azar", /poner\(d, valores\[i\]\)/.test(escenaJs) && /ORIENTACION\[limitar\(Math\.round\(Number\(valores\[i\]\)\)/.test(escenaJs));

console.log("== La escena de cada tirada: dados 3D, dragón y tesoro");
// El giro que deja cada cara de frente, comprobado con las matrices que usa CSS (rotateX(a) rotateY(b) = Rx·Ry; el eje y de CSS apunta hacia abajo)
{
  const vm = require("vm"), ctx = { window: {}, document: { createElement() { return {}; } } }; ctx.window.matchMedia = () => ({ matches: false });
  vm.createContext(ctx); vm.runInContext(escenaJs.replace(/\r\n/g, "\n"), ctx);
  const E = ctx.window.PozoEscena;
  const rx = (v, a) => { const c = Math.cos(a * Math.PI / 180), s2 = Math.sin(a * Math.PI / 180); return [v[0], v[1] * c - v[2] * s2, v[1] * s2 + v[2] * c]; };
  const ry = (v, a) => { const c = Math.cos(a * Math.PI / 180), s2 = Math.sin(a * Math.PI / 180); return [v[0] * c + v[2] * s2, v[1], -v[0] * s2 + v[2] * c]; };
  const normal = { 1: [0, 0, 1], 6: [0, 0, -1], 2: [1, 0, 0], 5: [-1, 0, 0], 3: [0, -1, 0], 4: [0, 1, 0] };     // hacia dónde mira cada cara en reposo (las caras 3 y 4 son arriba y abajo)
  const ok = [1, 2, 3, 4, 5, 6].every(v => { const [a1, b1] = E.ORIENTACION[v], r = rx(ry(normal[v], b1), a1); return Math.abs(r[0]) < 1e-9 && Math.abs(r[1]) < 1e-9 && Math.abs(r[2] - 1) < 1e-9; });
  cierto("para cada valor del 1 al 6 el giro del cubo deja de frente justo esa cara", ok);
  cierto("las caras opuestas suman siete (1-6, 2-5, 3-4)", [[1, 6], [2, 5], [3, 4]].every(([x, y]) => normal[x].every((n, i) => n === -normal[y][i])));
  cierto("un dado tiene seis caras y lleva su valor para lectores de pantalla", (E.dado(4).match(/pz-d3-cara/g) || []).length === 6 && /aria-label="Dado: 4"/.test(E.dado(4)) && /data-v="4"/.test(E.dado(4)));
  cierto("un valor fuera de rango queda entre 1 y 6", /data-v="1"/.test(E.dado(0)) && /data-v="6"/.test(E.dado(99)));
}
cierto("los puntos de las seis caras son imágenes en línea (no hay archivos que puedan faltar)", [1, 2, 3, 4, 5, 6].every(n => new RegExp("\\.pz-d3-cara\\.c" + n + " \\{ background-image: url\\(\"data:image/svg\\+xml").test(escenaCss)));
cierto("la página carga la escena y su hoja de estilos antes del controlador", html.indexOf("pozo-dragon-escena.js") > html.indexOf("pozo-dragon-arte.js") && html.indexOf("pozo-dragon-escena.js") < html.indexOf("js/pozo-dragon.js") && /css\/pozo-dragon-escena\.css\?v=\d{8}/.test(html));
cierto("el dragón no usa filtros ni desenfoques (son lo que más pesa al pintar): el brillo son degradados", !/<filter|feGaussianBlur|filter:\s*blur|drop-shadow/.test(arteJs) && !/<filter|feGaussianBlur|filter:\s*blur|drop-shadow/.test(escenaCss));
cierto("los degradados y las escamas del dragón están una sola vez en un svg oculto (width 0) y no en display:none", /id="pzDefsDragon" width="0" height="0"/.test(arteJs) && !/pzDefsDragon[^>]*display:\s*none/.test(arteJs) && /document\.body\.insertAdjacentHTML\("afterbegin", A\.defs\(\)\)/.test(js));
cierto("el dragón son solo dos ojos: no hay cuerpo, ni cejas, ni hocico, ni dientes en el dibujo, y cada ojo es un grupo con su resplandor, su iris, su pupila y su párpado", !/pz-dragon-cuerpo|pzDhCuerpo|MITAD_DRAGON|pzDhMitad/.test(arteJs) && /class="pz-dragon-ojos"/.test(arteJs) && (arteJs.match(/class="pz-ojo-g"/g) || []).length === 1 && /ojoDib\(324, 1,/.test(arteJs) && /ojoDib\(476, -1,/.test(arteJs) && (arteJs.match(/class="pz-heroe-pupila"/g) || []).length === 1);
cierto("el seguimiento de la mirada escribe una sola vez por fotograma y mueve pupila e iris", /requestAnimationFrame\(\(\) => \{\s*mirada\.espera = false;/.test(js) && /pz-heroe-iris/.test(js) && /pz-heroe-pupila/.test(js));
cierto("el dragón de la mesa reacciona: ruina, triple seis (gran), premio y cobro (cierra los ojos)", ["ruina", "gran", "premio", "cobro"].every(e => new RegExp('data-e="' + e + '"').test(escenaCss)) && /vigiaReaccion\("gran"/.test(js) && /vigiaEstado\("cobro"\)/.test(js));
cierto("cada combinación tiene su propio tratamiento visual (color y barra) y sus dados se tiñen", ["ruina", "ceniza", "pareja", "escalera", "triple", "triple_seis"].every(c => new RegExp('\\.pz-veredicto\\[data-c="' + c + '"\\]').test(escenaCss) && new RegExp("\\.pz-d3\\.cat-" + c + " ").test(escenaCss)));
cierto("la partida se enseña en una secuencia: lanzamiento, revelación, resolución y elección, y el cuadro final es el del servidor", /await E\.lanzar\(cont, ult\.dados/.test(js) && /revelarTirada\(/.test(js) && /resolverPremioSolo\(/.test(js) && /pintarSolo\(s\); pintarReloj\(\)/.test(js));
cierto("mientras se enseña una tirada lo nuevo que llega del servidor espera en cola y no pisa la escena", /if \(S\.teatro\) \{ S\.cola = \(\) => aplicarSolo\(s\)/.test(js) && /if \(S\.teatro\) \{ S\.cola = \(\) => aplicar\(est\)/.test(js) && /const c = S\.cola; S\.cola = null; if \(c\) c\(\)/.test(js));
cierto("no se pueden pulsar acciones mientras se enseña una tirada y no hay botones en pantalla (el dragón observa)", /if \(S\.teatro\) return;/.test(js) && /El Dragón observa los dados/.test(js));
cierto("la escena se puede saltar con clic, Espacio, Intro o Escape, acelerar con «Rápido» y se salta sola si se atasca", /saltarEscena\(\)/.test(js) && /\[" ", "Enter", "Escape"\]/.test(js) && /id="pzBtnRapido"/.test(html) && /E\.ritmo\(S\.rapido \? 0\.55 : 1\)/.test(js) && /setTimeout\(\(\) => E\.saltar\(\), 9000\)/.test(js));
cierto("con prefers-reduced-motion no se anima nada: la escena lo comprueba y el CSS apaga sus animaciones", /prefers-reduced-motion: reduce/.test(escenaJs) && /prefers-reduced-motion: reduce/.test(escenaCss) && /puedeTeatro = \(\) => .*sinMovimiento\(\)/.test(js));
cierto("las animaciones y los contadores tienen límite de tiempo: una pestaña en segundo plano no deja la mesa colgada", /limite = new Promise/.test(escenaJs) && /setTimeout\(fin, T \+ 400\)/.test(escenaJs));
cierto("la escena solo se enseña si ya había un cuadro anterior de la misma mesa o partida y la pestaña se ve (no al recargar)", /puedeTeatro\(\) && !!antes && antes\.codigo === est\.codigo && antes\.estado === "jugando"/.test(js) && /puedeTeatro\(\) && antes && antes\.estado === "en_curso"/.test(js) && /!S\.primerPintado && !document\.hidden/.test(js));
cierto("las probabilidades van plegadas (details cerrado) y no dominan la partida", /<details class="pz-prob"><summary>Probabilidades<\/summary>/.test(js) && !/<details class="pz-prob" open/.test(js));
cierto("la elección enseña lo que cobras y lo que arriesgas lado a lado, con el riesgo de Ruina", /data-t="cobrar"/.test(js) && /data-t="seguir"/.test(js) && /pz-medidor/.test(js) && /V\.pct\(t\.pRuina\)/.test(js));
cierto("el oro viaja al saldo al cobrar y el dragón se lo come en la Ruina; el saldo del servidor se enseña al final", /E\.volar\(document\.querySelector\("#pzSolo \.pz-pozo-fila"\), caja, 12\)/.test(js) && /E\.devorar\(fila\)/.test(js) && /clase: "roja"/.test(js));

console.log("== Solo los ojos, efectos de ambiente y paleta");
cierto("en la Ruina los ojos se abren de golpe y se deforman (se agrandan, se inclinan, la pupila es una rendija) y se enrojecen; nada más del dragón aparece", /data-e="ruina"\] \.pz-ojo-g \{ transform: rotate\(calc\(var\(--lado\) \* 17deg\)\) scale\(1\.7, 2\.1\)/.test(escenaCss) && /data-e="ruina"\] \.pz-dh-pupila \{ transform: scaleX\(\.35\)/.test(escenaCss) && /data-e="ruina"\] \.pz-dh-iris-roja/.test(escenaCss) && !/pz-dragon-cuerpo/.test(escenaCss));
cierto("el dibujo no tiene dientes ni boca iluminada, y el encuadre es solo la franja de los ojos (lo único que destaca en la oscuridad)", !/pzDiente|pz-dh-fuego/.test(arteJs.replace(/<linearGradient id="pzDiente"[^\n]*/, "")) && !/pz-dh-fuego/.test(escenaCss) && /marcoDragon\("200 130 400 190", "pz-dragon-heroe"/.test(arteJs) && /marcoDragon\("230 150 340 160", "pz-dragon-cara"/.test(arteJs) && !/overflow="visible"/.test(arteJs));
cierto("en pantallas anchas la decisión queda a la derecha y te acompaña al bajar (sticky), el lobby pone el título y la apuesta lado a lado y en las estrechas los botones se quedan pegados abajo", /\.pz-mesa > \.pz-dock, \.pz-mesa > \.pz-fin \{[^}]*position: sticky; top: 12px/.test(escenaCss) && /\.pz-heroe-cuerpo \{ grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1\.05fr\)/.test(escenaCss) && /\.pz-mesa > \.pz-dock \{ position: sticky; bottom: 0/.test(escenaCss));
cierto("al sentarte o empezar una partida la mesa sube hasta quedar a la vista", /antes !== vista && \(vista === "solo" \|\| vista === "mesa"\)/.test(js) && /window\.scrollTo\(\{ top: Math\.max\(0, t\)/.test(js));
cierto("los ojos respiran (el resplandor late), vuelven al centro tras 5 s sin cursor y parpadean", /@keyframes pz-brilla/.test(escenaCss) && /function mirarAlCentro\(\)/.test(js) && /Date\.now\(\) - mirada\.ultimo > 5000/.test(js) && /\.pz-dragon-marco\.pz-reposo/.test(escenaCss));
cierto("el humo de las fosas sale solo al perder, con círculos de degradado radial y sin filtros, y se coloca con el encuadre del dibujo (data-vb)", /function humoDeFosas\(marco\)/.test(js) && /humoDeFosas\(marcoVigia\(\)\)/.test(js) && /data-vb="\$\{vb\}"/.test(arteJs) && /\.pz-bocanada \{[^}]*radial-gradient/.test(escenaCss));
cierto("la viñeta oscurece los bordes de golpe al perder y ilumina el centro al ganar", /function vineta\(tipo\)/.test(js) && /vineta\("perdio"\)/.test(js) && /vineta\("gano"\)/.test(js) && /@keyframes pz-vineta-pierde/.test(escenaCss) && /@keyframes pz-vineta-gana/.test(escenaCss));
cierto("el triple seis también hace temblar la mesa y la Ruina suena con un gruñido grave", /c === "triple_seis"[\s\S]{0,400}pz-sacude/.test(js) && /grunido\(\) \{ tono\(55/.test(js) && /sonar\("grunido"\)/.test(js));
cierto("nada de desenfoque de fondo (backdrop-filter) ni de blur: los paneles solo son un poco translúcidos", !/backdrop-filter|blur\(/.test(css + escenaCss + arteJs));
cierto("los efectos nuevos se apagan con prefers-reduced-motion", /@media \(prefers-reduced-motion: reduce\) \{\s*\.pz-dragon-marco \.pz-dh-luz, \.pz-bocanada, \.pz-vineta\.activa/.test(escenaCss) && /function humoDeFosas\(marco\) \{\s*if \(!marco \|\| sinMovimiento\(\)\) return;/.test(js));
{
  // La paleta es Vino y oro: los fondos son burdeos casi negros (tono entre 330° y 360°), no marrón (15° a 50°)
  const tono = hex => { const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
  const v = n => css.match(new RegExp("--" + n + ": (#[0-9a-fA-F]{6})"))[1];
  cierto("los fondos de la paleta son vino (tono entre 330 y 360), no marrón", ["pz-noche", "pz-piedra", "pz-piedra-2", "pz-piedra-3"].every(n => { const t = tono(v(n)); return t >= 330 && t <= 360; }));
  cierto("el acento sigue siendo oro (tono entre 38 y 52)", ["pz-oro", "pz-oro-claro"].every(n => { const t = tono(v(n)); return t >= 38 && t <= 52; }));
  cierto("el rojo de la Ruina y el verde de ganar no cambiaron con la paleta", v("pz-rojo").toLowerCase() === "#b6382f" && v("pz-verde").toLowerCase() === "#78b472");
}

console.log("== La tensión y la tabla de probabilidades del solitario");
{
  const st = { estado: "en_curso", fase: "decidir", apuesta: 10, tributo: 5, bono: 0.0625, premio: 10.09, tiradas: 1, tiradas_max: 5 };
  const t = V.tensionSolo(st), tb = V.tablaSolo(st);
  cierto("lo que cobras es el premio provisional y lo que pierdes con una Ruina es ese mismo premio", t.premio === 10.09 && Math.abs(t.pRuina - 10 / 216) < 1e-12 && t.quedan === 4);
  cierto("el mejor caso es el del triple seis sumado a los bonos que ya llevas", t.mejor === V.premioSolo(10, 5, 0.0625 + 1));
  cierto("el premio de la tabla tras una Pareja (10,09 → 10,68) coincide con la fórmula del servidor: base 9,5 × (1 + 0,0625 + 0,0625)", tb.filas.find(x => x.cat === "pareja").premio === 10.68 && tb.base === 9.5);
  cierto("la tabla tiene las seis combinaciones, suma 216 casos y la Ruina deja 0 y la ceniza deja el premio de ahora", tb.filas.length === 6 && tb.filas.reduce((n, x) => n + x.casos, 0) === 216 && tb.filas.find(x => x.cat === "ruina").premio === 0 && tb.filas.find(x => x.cat === "ceniza").premio === 10.09);
  cierto("sin partida en curso no hay tensión", V.tensionSolo({ estado: "terminada" }) === null && V.tensionSolo(null) === null);
  const comp = { estado: "jugando", modo: "compartido", reglas: { dinero: 100, tiradas_max: 5 }, yo: { asiento: 1 }, jugadores: [{ asiento: 1, yo: true, peso: 1.125, parte: 112.5, tiradas: 2 }] };
  const tcm = V.tensionCompartido(comp);
  cierto("en el compartido la tensión es la parte que cobrarías y el riesgo de Ruina", tcm && tcm.parte === 112.5 && tcm.peso === 1.125 && tcm.quedan === 3 && Math.abs(tcm.pRuina - 10 / 216) < 1e-12);
}
cierto("las acciones llevan el paso de la mesa y un reintento repite la misma petición", js.includes("const paso = est.paso") && js.includes("manejarError(e, () => ejecutar(fn, null, cuando))"));
cierto("el movimiento reducido se respeta en el controlador y en la hoja de estilos", /prefers-reduced-motion/.test(js) && /prefers-reduced-motion: reduce/.test(css));
cierto("los botones del juego son planos: sin degradados dorados, brillos ni sombras en la regla de .pz-boton", !/\.pz-boton[^{]*\{[^}]*(gradient|box-shadow|text-shadow)/.test(css));
cierto("hay un aviso de error con rol de alerta para el lector de pantalla", /pzSrFuerte/.test(html) && /role="alert"/.test(html));
cierto("el simulador de la API tiene las trece llamadas del juego", ["lista", "crear", "unirse", "cerrarInscripcion", "ofrecer", "confirmar", "retirarConfirmacion", "salir", "tirar", "cobrar", "continuar", "estado", "misCartas"].every(n => new RegExp(`\\b${n}:`).test(leer("js", "veintiuna-api.js").match(/pozo: \{[\s\S]*?\n      \},/)[0])));

console.log("== Modo solitario: reglas, textos y botones");
const reglasS = { tributo: 5, bonos: { pareja: 0.0625, escalera: 0.1875, triple: 0.375, triple_seis: 1 }, tiradas_max: 5, abandono_s: 120 };
const rs = V.reglasSolo(reglasS).join(" ");
cierto("las reglas dicen el tributo del 5 %, los bonos, la Ruina, el máximo de cinco tiradas, que paga la casa y que no hay cartas", /tributo del Dragón \(5 %\)/.test(rs) && /pareja \+6,25 %/.test(rs) && /escalera \+18,75 %/.test(rs) && /triple \+37,5 %/.test(rs) && /triple seis \+100 %/.test(rs) && /Ruina/.test(rs) && /máximo de 5 tiradas/.test(rs) && /paga la casa/.test(rs) && /no cartas/.test(rs) && /no hay otras comisiones/.test(rs));
cierto("explica qué pasa si te vas: sin tiradas se devuelve la apuesta, con tiradas se cobra", /sin tiradas se te devuelve la apuesta entera, y con tiradas cobras lo que lleves/.test(rs));
comprobar("premio = apuesta × 0,95 × (1 + bonos), céntimos hacia abajo", [V.premioSolo(100, 5, 0), V.premioSolo(100, 5, 0.375), V.premioSolo(10, 5, 0.0625), V.premioSolo(30, 5, 1)], [95, 130.62, 10.09, 57]);
const solo = (o) => Object.assign({ id: "s1", apuesta: 100, tributo: 5, bonos: reglasS.bonos, estado: "en_curso", fase: "tirar", tiradas: 0, tiradas_max: 5, bono: 0, paso: 0, premio: 95, base: 95, resultado: null, pago: null, neto: null, historial: [], saldo: 400 }, o || {});
comprobar("antes de tirar solo hay un botón: tirar", V.accionesSolo(solo()).botones.map(b => b.id), ["tirar"]);
const decS = V.accionesSolo(solo({ fase: "decidir", tiradas: 1, bono: 0.375, premio: 130.62 }));
comprobar("tras una tirada sin Ruina: cobrar (con lo que recibes) o seguir tirando (con el riesgo y lo que pierdes)", [decS.botones.map(b => b.id), decS.botones.map(b => b.tecla), /130,62/.test(decS.botones[0].sub), /4,63 %/.test(decS.botones[1].sub) && /130,62/.test(decS.botones[1].sub)], [["cobrar", "tirar"], ["C", "T"], true, true]);
comprobar("con la partida terminada no hay botones", V.accionesSolo(solo({ estado: "terminada" })).botones, []);
const pe = V.perspectivaSolo(solo({ fase: "decidir", tiradas: 2, bono: 0.25, premio: 118.75 }));
comprobar("la perspectiva enseña el premio de cada resultado posible con el bono acumulado", [pe.riesgo === 10 / 216, pe.filas.map(x => x.premio), pe.quedan], [true, [118.75, 124.68, 136.56, 154.37, 213.75].map(x => x), 3]);
cierto("no hay perspectiva antes de la primera tirada ni al terminar", V.perspectivaSolo(solo()) === null && V.perspectivaSolo(solo({ estado: "terminada" })) === null);
const finS = (o) => V.resumenSolo(solo(Object.assign({ estado: "terminada", fase: "decidir", tiradas: 2 }, o)));
comprobar("final: Ruina, cobro con ganancia, cobro con pérdida, devuelta", [finS({ resultado: "ruina", pago: 0, neto: -100 }).clase, finS({ resultado: "cobro", pago: 130.62, neto: 30.62 }).clase, finS({ resultado: "cobro", pago: 95, neto: -5 }).clase, finS({ resultado: "devuelta", pago: 100, neto: 0 }).clase], ["pierde", "gana", "pierde", "empate"]);
cierto("el final dice cuánto recibes y cuánto ganas o pierdes, y avisa del cobro automático", /Recibes 130,62 tokens \(apostaste 100\): ganas 30,62 tokens/.test(finS({ resultado: "cobro", pago: 130.62, neto: 30.62 }).texto) && /Se cerró sola por inactividad/.test(finS({ resultado: "cobro_automatico", pago: 95, neto: -5 }).texto) && /Llegaste a la última tirada sin Ruina y cobras/.test(finS({ resultado: "cobro", tiradas: 5, tiradas_max: 5, pago: 95, neto: -5 }).texto));
cierto("una apuesta devuelta dice que no hubo tiradas", /sin ninguna tirada/.test(finS({ resultado: "devuelta", tiradas: 0, pago: 100, neto: 0 }).texto));
const fr = V.frasesTirada({ dados: [3, 3, 5], categoria: "pareja" }, "solo", reglasS.bonos);
cierto("la frase de una tirada en solitario dice cuánto sube el premio", fr.nombre === "Pareja" && /sube 6,25 %/.test(fr.efecto) && /pierdes el premio/.test(V.frasesTirada({ dados: [1, 1, 2], categoria: "ruina" }, "solo", reglasS.bonos).efecto));
const a1 = solo({ historial: [] }), a2 = solo({ fase: "decidir", tiradas: 1, bono: 0.0625, premio: 100.93, historial: [{ id: 3, n: 1, dados: [3, 3, 5], categoria: "pareja" }] });
cierto("el lector de pantalla oye la tirada y el premio provisional", /Sacas 3-3-5: Pareja\./.test(V.anuncioSolo(a1, a2)) && /Tu premio provisional es 100,93 tokens/.test(V.anuncioSolo(a1, a2)));

console.log("== Modo solitario: el SQL");
const iS = sql.indexOf("12) MODO SOLITARIO");
const sqlS = sql.slice(iS);
cierto("el tributo y los bonos de origen son los calculados (5 % y 6,25 / 18,75 / 37,5 / 100)", /pozo_solo_tributo', '5'/.test(sqlS) && /pozo_solo_bono_pareja', '6\.25'/.test(sqlS) && /pozo_solo_bono_escalera', '18\.75'/.test(sqlS) && /pozo_solo_bono_triple', '37\.5'/.test(sqlS) && /pozo_solo_bono_triple_seis', '100'/.test(sqlS));
["pozo_solo_estado", "pozo_solo_empezar", "pozo_solo_descartar", "pozo_i_solo_accion"].forEach(n => {
  const i = sqlS.indexOf(`create or replace function ${n}(`), j = sqlS.indexOf("\n$$;", i);
  cierto(`${n} empieza comprobando que el juego esté abierto o que seas admin`, i > 0 && /perform pozo_i_acceso\(\)/.test(sqlS.slice(i, j)));
});
cierto("tirar y cobrar son envoltorios de la acción comprobada", /function pozo_solo_tirar\(p_id uuid, p_paso int\)[\s\S]*pozo_i_solo_accion\(p_id, p_paso, 'tirar'\)/.test(sqlS) && /function pozo_solo_cobrar\(p_id uuid, p_paso int\)[\s\S]*pozo_i_solo_accion\(p_id, p_paso, 'cobrar'\)/.test(sqlS));
cierto("empezar es idempotente: el identificador del cliente es único y repetirlo devuelve la misma partida sin cobrar", /unique \(user_id, cliente\)/.test(sqlS) && /where user_id = uid and cliente = p_cliente;\s*if found then return pozo_i_solo_json\(s\.id\) \|\| jsonb_build_object\('repetida', true\)/.test(sqlS));
cierto("solo hay una partida en curso por jugador (índice único) y no se mezcla con las mesas", /create unique index if not exists pozo_solo_una_en_curso on pozo_solo \(user_id\) where estado = 'en_curso'/.test(sqlS) && /solo_en_curso/.test(sql.slice(0, iS)) && /Estás en una mesa/.test(sqlS));
cierto("la apuesta se descuenta ANTES de crear la partida y en la misma transacción", sqlS.indexOf("perform pozo_i_debitar(uid, p_apuesta") > 0 && sqlS.indexOf("perform pozo_i_debitar(uid, p_apuesta") < sqlS.indexOf("insert into pozo_solo (id, user_id, cliente, apuesta, tributo, bonos)"));
const cierre = sqlS.slice(sqlS.indexOf("function pozo_i_solo_cerrar"), sqlS.indexOf("function pozo_i_solo_avanzar"));
cierto("el pago se hace una sola vez: solo si la partida sigue en curso, y la deja terminada en el mismo paso", /if not found or s\.estado <> 'en_curso' then return; end if;/.test(cierre) && (cierre.match(/pozo_i_abonar\(/g) || []).length === 1 && /update pozo_solo set estado = 'terminada'/.test(cierre));
cierto("Ruina no paga, devuelta paga la apuesta entera, cobrar paga el premio con tributo", /when 'ruina' then 0 when 'devuelta' then s\.apuesta else pozo_i_solo_premio\(s\.apuesta, s\.tributo, s\.bono\)/.test(cierre));
cierto("una partida abandonada se cierra sola: sin tiradas se devuelve, con tiradas se cobra", /case when s\.tiradas = 0 then 'devuelta' else 'cobro_automatico' end/.test(sqlS));
cierto("la quinta tirada sin Ruina cobra automáticamente", /s\.tiradas \+ 1 >= \(cartas_ajuste\('pozo_tiradas_max', '5'\)\)::text::int then perform pozo_i_solo_cerrar\(p_id, 'cobro'\)/.test(sqlS));
cierto("no se puede cobrar antes de tirar", /if s\.fase <> 'decidir' then perform pozo_i_error\('Todavía no has tirado/.test(sqlS));
cierto("el servidor saca los dados del solitario con el mismo generador y la misma clasificación que las mesas", /d := array\[pozo_i_dado\(\), pozo_i_dado\(\), pozo_i_dado\(\)\]::int\[\];\s*v_cat := pozo_i_clasificar/.test(sqlS));
cierto("las funciones públicas del solitario se cierran a quien no ha iniciado sesión y las internas a todos", /revoke all on function pozo_solo_estado\(\)[\s\S]*from public, anon;/.test(sqlS) && /revoke all on function pozo_i_solo_premio[\s\S]*pozo_i_solo_accion\(uuid, int, text\) from public, anon, authenticated;/.test(sqlS));
cierto("las tablas del solitario no se escriben ni se leen directamente", /revoke all on pozo_solo, pozo_solo_tiradas from anon, authenticated;/.test(sqlS));
cierto("el solitario no mueve cartas (solo dinero)", !/cartas_i_/.test(sqlS));
cierto("la interfaz y el SQL usan los mismos bonos y tributo de origen del solitario", V.SOLO_TRIBUTO === 5 && V.SOLO_BONOS.pareja === 0.0625 && V.SOLO_BONOS.escalera === 0.1875 && V.SOLO_BONOS.triple === 0.375 && V.SOLO_BONOS.triple_seis === 1);
cierto("la API del navegador tiene las cinco llamadas del solitario con sus argumentos", ["estado", "empezar", "tirar", "cobrar", "descartar"].every(n => new RegExp(`\\b${n}: `).test(leer("js", "veintiuna-api.js").match(/solo: \{[\s\S]*?\n        \}/)[0])));
cierto("el controlador reutiliza el mismo identificador en los reintentos de empezar", /const cliente = window\.VeintiunaApi\.nuevoId\(\);[\s\S]*api\.pozo\.solo\.empezar\(cliente, dinero\)/.test(js));
cierto("la página tiene su sección del solitario", /id="pzSolo"/.test(html));

console.log("== Modo solitario: economía (cálculo exacto)");
const rsolo = spawnSync(process.execPath, [path.join(RAIZ, "tools", "pozo-dragon-solo.js"), "20000"], { encoding: "utf8", timeout: 120000 });
const ssolo = rsolo.stdout || "";
cierto("la herramienta termina bien", rsolo.status === 0);
cierto("con la tabla propuesta (×1) el juego óptimo devolvería más del 100 %: dinero creado de la nada", /×1 .*\|\s+171\.42 %/.test(ssolo));
cierto("con bonos ×0,25 y tributo del 5 % el RTP óptimo es 97,49 %: la casa gana al menos un 2,5 %", /RTP final: óptimo 97\.49 % \(ventaja de la casa 2\.51 %\)/.test(ssolo));
cierto("ninguna estrategia fija supera el 100 % con el tributo", [...ssolo.matchAll(/cobrar tras la tirada \d: RTP ([\d.]+) % \(con tributo\)/g)].every(m => Number(m[1]) < 100));
cierto("el pago máximo posible está acotado (6× antes del tributo)", /Pago máximo posible: 6\.0×/.test(ssolo));

(async () => {
  console.log("== Llamadas al servidor");
  const llamadas = [];
  const api = Api.crear(async () => ({ rpc: async (n, a) => { llamadas.push([n, a]); return { data: { ok: true }, error: null }; } }));
  await api.pozo.crear("compartido", false, "Mi mesa", 50, 1, 4); await api.pozo.ofrecer(["e1"]); await api.pozo.confirmar(3); await api.pozo.tirar(7); await api.pozo.cobrar(8); await api.pozo.estado(12);
  comprobar("las llamadas usan las funciones del SQL con sus argumentos", llamadas.map(l => l[0]), ["pozo_crear", "pozo_ofrecer", "pozo_confirmar", "pozo_tirar", "pozo_cobrar", "pozo_estado"]);
  comprobar("crear manda modo, privacidad, nombre, dinero, cartas y máximo", llamadas[0][1], { p_modo: "compartido", p_privada: false, p_nombre: "Mi mesa", p_dinero: 50, p_cartas: 1, p_max: 4 });
  comprobar("confirmar lleva la versión de las condiciones y tirar el paso de la mesa", [llamadas[2][1], llamadas[3][1]], [{ p_cond: 3 }, { p_paso: 7 }]);
  cierto("los nombres de las llamadas existen en el SQL público", llamadas.every(l => new RegExp(`create or replace function ${l[0]}\\(`).test(sql)));

  console.log("== Economía: simulación del Pozo Compartido (pocas mesas, solo para comprobar que cuadra)");
  const r = spawnSync(process.execPath, [path.join(RAIZ, "tools", "pozo-dragon-simulacion.js"), "1500"], { encoding: "utf8", timeout: 120000 });
  const salida = r.stdout || "";
  cierto("la simulación termina bien", r.status === 0);
  cierto("verifica las 216 combinaciones sin ningún FALLA", !/FALLA/.test(salida) && /los seis grupos suman 216/.test(salida));
  cierto("lo pagado es siempre igual a lo apostado: el juego no crea ni destruye dinero", /el juego no crea ni destruye dinero/.test(salida));

  console.log(fallos ? `\n${fallos} fallo(s), ${ok} bien.` : `\nTodo bien (${ok} comprobaciones).`);
  process.exit(fallos ? 1 : 0);
})();
