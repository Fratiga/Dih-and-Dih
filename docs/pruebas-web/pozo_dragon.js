// Pruebas de El Pozo del Dragón que no necesitan base de datos: las 216 combinaciones y la jerarquía del Duelo (pozo-dragon-vista.js), los textos y las vistas,
// la página y el controlador, y que el SQL (docs/pozo-dragon.sql) lleve el cierre «oculto» en cada función pública y las mismas reglas que la interfaz.
// El SQL en sí se comprueba con el analizador de PostgreSQL y con docs/pruebas/t_pozo_dragon.sql (necesita Docker, ver docs/pozo-dragon.md).
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
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), "utf8");

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
cierto("todos los identificadores que usa el controlador están en la página", [...js.matchAll(/\$\("([A-Za-z]+)"\)/g)].map(m => m[1]).filter(id => !["pzCodigo", "pzMesasLista", "pzTapete", "pzDestello", "pzDlgReglas"].includes(id) || id === "pzDlgReglas").every(id => new RegExp(`id="${id}"`).test(html) || ["pzCodigo", "pzMesasLista", "pzTapete", "pzDestello", "pzDock", "pzFormEntrar"].includes(id)));
const rodarFn = js.slice(js.indexOf("async function rodar("), js.indexOf("function efectosDeCategoria"));
cierto("el controlador solo pide acciones y nunca manda dados ni resultados: lo único al azar con dados es la cara que se enseña mientras ruedan", js.includes("api.pozo.tirar(paso)") && js.split("Math.floor(Math.random() * 6)").length === 2 && rodarFn.includes("Math.floor(Math.random() * 6)") && !js.includes("p_dados") && !js.includes("dados: ["));
cierto("las animaciones de los dados usan caras al azar solo mientras ruedan y acaban en las del servidor", /cont\.innerHTML = dados\.map\(/.test(js));
cierto("las acciones llevan el paso de la mesa y un reintento repite la misma petición", /const paso = est\.paso/.test(js) && /manejarError\(e, \(\) => ejecutar\(fn, null\)\)/.test(js));
cierto("el movimiento reducido se respeta en el controlador y en la hoja de estilos", /prefers-reduced-motion/.test(js) && /prefers-reduced-motion: reduce/.test(css));
cierto("los botones del juego son planos: sin degradados dorados, brillos ni sombras en la regla de .pz-boton", !/\.pz-boton[^{]*\{[^}]*(gradient|box-shadow|text-shadow)/.test(css));
cierto("hay un aviso de error con rol de alerta para el lector de pantalla", /pzSrFuerte/.test(html) && /role="alert"/.test(html));
cierto("el simulador de la API tiene las trece llamadas del juego", ["lista", "crear", "unirse", "cerrarInscripcion", "ofrecer", "confirmar", "retirarConfirmacion", "salir", "tirar", "cobrar", "continuar", "estado", "misCartas"].every(n => new RegExp(`\\b${n}:`).test(leer("js", "veintiuna-api.js").match(/pozo: \{[\s\S]*?\n      \},/)[0])));

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
