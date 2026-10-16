// Prueba del lote 2 de Triunfos (líderes de facción, NPCs, criaturas, objetos, reacciones y terrenos).
// Uso: node tools/probar-lote2.js
const vm = require("vm"), fs = require("fs"), path = require("path");
const sb = { console }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
for (const f of ["cartas-datos", "cartas-motor", "cartas-efectos", "cartas-vinculos"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", `${f}.js`), "utf8"), sb, { filename: f });
const M = sb.CartasMotor;
const cartas = {}; sb.CARTAS.forEach(c => { cartas[c.id] = { id: c.id, nombre: c.nombre, tipo: c.tipo, rareza: c.rareza, afinidad: c.afinidad, coste: c.coste, atq: c.atq ?? null, pv: c.pv ?? null, habilidad: c.habilidad || "", copiasMax: c.copiasMax }; });
require("./cartas-del-servidor.js").forEach(c => { cartas[c.id] = { id: c.id, nombre: c.nombre, tipo: c.tipo, rareza: c.rareza, afinidad: c.afinidad, coste: c.coste, atq: c.atq ?? null, pv: c.pv ?? null, habilidad: c.habilidad || "" }; });
const mk = (id, atq, pv, extra) => { cartas[id] = Object.assign({ id, nombre: id, tipo: "Criatura", rareza: "comun", afinidad: ["carne"], coste: 0, atq, pv, habilidad: "" }, extra || {}); };
mk("t11", 1, 1); mk("t33", 3, 3); mk("t24", 2, 4); mk("t52", 5, 2); mk("tvuela", 2, 2);
M.registrar("tvuela", { palabras: ["volar"] });
const fallos = []; let n = 0;
const ok = (c, msg) => { n++; if (!c) fallos.push(msg); };

// Los ids del lote son los que van tras el comentario «Lote 2» en js/cartas-datos.js
const datos = fs.readFileSync(path.join(__dirname, "..", "js", "cartas-datos.js"), "utf8");
const ids = [...datos.slice(datos.indexOf("// --- Lote 2")).matchAll(/^\s+[uo]\("([a-z0-9-]+)"/gm)].map(m => m[1]);

function partida(mazoA = [], mazoB = [], primero = 0) {
  const relleno = Array.from({ length: 20 }, () => "t11");
  return M.crearPartida({ semilla: 7, primero, cartas, jugadores: [{ id: "a", nombre: "A", mazo: mazoA.concat(relleno) }, { id: "b", nombre: "B", mazo: mazoB.concat(relleno) }] });
}
const poner = (est, j, id, extra = {}) => { const u = M.ponerUnidad(est, j, id, false, null); u.entro = 0; Object.assign(u.flags, extra); return u; };
function turnoDe(est, j) { let g = 0; while (est.activo !== j && g++ < 4) M.aplicar(est, { t: "fin" }, est.activo); est.jugadores[j].campo.forEach(u => { u.entro = 0; }); }
// Juega la carta con todo el ánimo: energía de sobra y, si pide objetivo, el primero válido
function jugar(est, j, id) {
  const J = est.jugadores[j]; J.mano = [id]; J.energia = 10;
  const req = M.requisitoDeJugada(est, j, id);
  const o = req && req.validos.length ? req.validos[0] : undefined;
  return M.aplicar(est, o ? { t: "jugar", i: 0, o } : { t: "jugar", i: 0 }, j);
}

// 0) Cada carta del lote existe una sola vez y tiene lo que le corresponde
ok(new Set(ids).size === ids.length && ids.length === 112, `112 cartas distintas en el lote (${ids.length})`);
ids.forEach(id => {
  const c = sb.cartaPorId(id);
  ok(!!c, `${id} existe en cartas-datos.js`);
  if (!c) return;
  ok(c.habilidad && c.descripcion, `${id} tiene habilidad y descripción`);
  if (M.esUnidad(c)) ok(Number.isFinite(c.atq) && Number.isFinite(c.pv) && c.coste >= 0, `${id}: ataque y vida`);
  const sinEfecto = !M.EFECTOS[id] && !M.TERRENOS[id];
  ok(!sinEfecto, `${id} tiene su efecto programado`);
});
ok(sb.CARTAS.length === new Set(sb.CARTAS.map(c => c.id)).size, "ningún id de carta se repite en todo el catálogo");

// 1) Todas las cartas se juegan sin error con un campo con gente de los dos lados, y el registro no revienta
ids.forEach(id => {
  const m = cartas[id];
  if (m.tipo === "Reacción") return;
  const e = partida(["pocion-de-curacion-menor", "kobold", "guardia-de-la-ciudad", "pergamino-de-bola-de-fuego", "geiseres-de-nigredo"], ["kobold", "hidra", "lobo", "baraja-de-cartas"]);
  turnoDe(e, 0);
  poner(e, 0, "t33"); poner(e, 0, "t24"); poner(e, 0, "bull"); const rival = [poner(e, 1, "t33"), poner(e, 1, "t24"), poner(e, 1, "tvuela")];
  rival[1].pv = 1;
  let r;
  try { r = jugar(e, 0, id); } catch (err) { fallos.push(`excepción al jugar ${id}: ${err.stack.split("\n").slice(0, 3).join(" | ")}`); return; }
  ok(!r.error, `${id} se puede jugar (${r.error || ""})`);
});

// 2) Líderes
{ const e = partida(); turnoDe(e, 0); const mit = poner(e, 0, "el-mitrado"); const v = poner(e, 0, "bull"); const otro = poner(e, 0, "t33");
  ok(!M.puedeApuntarHabilidad(e, v, 1) && M.puedeApuntarHabilidad(e, otro, 1) && M.puedeApuntarHabilidad(e, mit, 1), "El Mitrado cubre a las demás de Juramento, no a sí mismo ni a las de otra afinidad"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "la-primera-aurora"); const t = poner(e, 0, "t33"); t.pv = 1;
  M.aplicar(e, { t: "fin" }, 0); M.aplicar(e, { t: "fin" }, 1); ok(t.pv === 3, `La Primera Aurora cura 2 al inicio de tu turno (${t.pv})`); }
{ const e = partida(); turnoDe(e, 0); poner(e, 0, "el-primer-juramentado"); M.ponerUnidad(e, 0, "bull", false, null);
  ok(e.jugadores[0].campo.find(u => u.cartaId === "bull").flags.barrera === true, "El Primer Juramentado: las de Juramento entran con Barrera"); }
{ const e = partida(); turnoDe(e, 0); const t = poner(e, 1, "t52"), d = poner(e, 1, "t11");
  const r = M.requisitoDeJugada(e, 0, "atalaya-de-vardun"); ok(r.validos.length === 1 && r.validos[0].u === t.uid, "Atalaya solo elige unidades con 4 o más de ataque");
  M.ponerUnidad(e, 0, "atalaya-de-vardun", true, t); ok(t.flags.noAtacaHasta >= e.turno + 1, "y la frena el próximo turno"); }
{ const e = partida(); turnoDe(e, 0); poner(e, 0, "legado-del-aguila"); const a = poner(e, 0, "bull"), b = poner(e, 0, "t33");
  ok(M.atqEfectivo(e, a) === 4 && M.atqEfectivo(e, b) === 3, "Legado: +1 a una de Juramento y no a las otras");
  poner(e, 0, "billy"); ok(M.atqEfectivo(e, a) === 5, "con 3 de Juramento da +2"); }
{ const e = partida(); turnoDe(e, 0); const herida = poner(e, 1, "t33"); herida.pv = 1; const sana = poner(e, 1, "t24");
  const r = M.requisitoDeJugada(e, 0, "senora-de-la-madriguera"); ok(r.validos.length === 1, "Señora de la Madriguera solo elige unidades heridas");
  M.ponerUnidad(e, 0, "senora-de-la-madriguera", true, herida); ok(!M.buscar(e, herida.uid) && e.jugadores[1].mano.includes("t33"), "y la devuelve a la mano"); }
{ const e = partida(["pocion-de-curacion-menor"], []); turnoDe(e, 0); const J = e.jugadores[0]; J.mano = []; J.mazo = ["kobold", "pocion-de-curacion-menor", "lobo"];
  M.ponerUnidad(e, 0, "el-tiznado", true, null); ok(J.mano.length === 1 && J.mano[0] === "pocion-de-curacion-menor" && J.mazo.length === 2, "El Tiznado roba un Objeto del mazo"); }
{ const e = partida(); turnoDe(e, 0); const A = e.jugadores[0], B = e.jugadores[1]; A.mano = []; B.mano = ["pergamino-de-bola-de-fuego", "t11", "t33"]; B.cartas = null;
  M.ponerUnidad(e, 0, "pregonero-de-cambalache", true, null); ok(A.mano.length === 1 && B.mano.length === 3 && B.mano.includes("pergamino-de-bola-de-fuego") && B.mano.includes("t33"), `Pregonero: ambos roban y el rival descarta una de las más baratas (${B.mano})`); }
{ const e = partida(); turnoDe(e, 0); M.ponerUnidad(e, 0, "primer-engranaje", true, null); const c = e.jugadores[0].campo;
  ok(c.filter(u => u.cartaId === "automata").length === 2 && M.atqEfectivo(e, c.find(u => u.cartaId === "automata")) === 2, "Primer Engranaje crea 2 Autómatas con +1 de ataque"); }
{ const e = partida(); turnoDe(e, 0); const J = e.jugadores[0]; J.mazo = ["kobold", "pergamino-de-bola-de-fuego", "lobo"]; J.mano = [];
  M.ponerUnidad(e, 0, "decano-de-los-fundamentos", true, null);
  ok(J.mano.includes("pergamino-de-bola-de-fuego") && M.costeDe(e, 0, "pergamino-de-bola-de-fuego") === 3 && M.costeDe(e, 0, "kobold") === 1, "Decano: roba una de Arcano y las de Arcano cuestan 1 menos"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "t33"); const r = M.requisitoDeJugada(e, 0, "la-anatomista");
  M.ponerUnidad(e, 0, "la-anatomista", true, a); const an = e.jugadores[0].campo.find(u => u.cartaId === "la-anatomista");
  ok(!M.buscar(e, a.uid) && an.atq === 6 && an.pv === 7, `La Anatomista absorbe a su víctima (${an.atq}/${an.pv})`); }
{ const e = partida(); turnoDe(e, 0); const J = e.jugadores[0]; J.mazo = ["kobold", "los-huesos"]; J.mano = [];
  M.ponerUnidad(e, 0, "trazahorizontes", true, null); ok(J.mano.length === 1 && J.mano[0] === "los-huesos", "Trazahorizontes roba un terreno");
  J.mazo = ["kobold", "lobo"]; J.mano = []; M.ponerUnidad(e, 0, "trazahorizontes", true, null); ok(J.mano.length === 1 && J.mano[0] === "kobold", "o una carta si no hay"); }
{ const e = partida(); turnoDe(e, 0); const J = e.jugadores[0]; J.cementerio = ["kobold", "pocion-de-curacion-menor", "lobo"]; J.mano = [];
  M.ponerUnidad(e, 0, "el-desenterrador", true, null); ok(J.mano.includes("pocion-de-curacion-menor") && !J.cementerio.includes("pocion-de-curacion-menor"), "El Desenterrador recupera un Objeto del cementerio"); }
{ const e = partida(); turnoDe(e, 0); M.ponerUnidad(e, 0, "mano-de-oro", true, null); ok(e.jugadores[0].campo.filter(u => u.cartaId === "mercenario").length === 2, "Mano de Oro crea 2 Mercenarios"); }
{ const e = partida(); turnoDe(e, 0); const m = poner(e, 0, "el-ultimo-matadragones"); const dr = poner(e, 1, "draco"), p = poner(e, 1, "t33");
  ok(M.efectoDe(e, m).bonusAtaque(e, m, dr) === 4 && M.efectoDe(e, m).bonusAtaque(e, m, p) === 0, "Matadragones: +4 contra Dragones y nada contra una unidad normal"); }
{ const e = partida(); turnoDe(e, 0); const v = poner(e, 0, "primer-velo-del-eclipse"); const B = e.jugadores[1]; B.mano = ["t11", "t33"];
  ok(M.esEscurridizo(e, v), "Primer Velo: Escurridizo"); M.ponerUnidad(e, 0, "primer-velo-del-eclipse", true, null); ok(B.mano.length === 1, "y el rival descarta una carta al entrar"); }
{ const e = partida(); turnoDe(e, 0); poner(e, 0, "el-anfitrion"); poner(e, 1, "t11"); poner(e, 1, "t11");
  M.aplicar(e, { t: "fin" }, 0); M.aplicar(e, { t: "fin" }, 1); const J = e.jugadores[0]; ok(J.energia === J.energiaMax + 1, `El Anfitrión da 1 de energía si el rival tiene más unidades (${J.energia}/${J.energiaMax})`); }
{ const e = partida(); turnoDe(e, 0); const s = poner(e, 0, "senor-de-las-calas"); e.jugadores[1].campo.length = 0; const J = e.jugadores[0], B = e.jugadores[1]; const m0 = J.mano.length, b0 = B.mano.length;
  M.aplicar(e, { t: "atacar", u: [s.uid] }, 0); ok(J.mano.length === m0 + 1 && B.mano.length === b0 - 1, "Señor de las Calas: roba y el rival descarta al golpear al jugador"); }
{ const e = partida(); turnoDe(e, 0); const J = e.jugadores[0]; J.cementerio = ["t11", "dragarto"];
  const c = M.ponerUnidad(e, 0, "ceniza-coronada", true, null); ok(e.jugadores[0].campo.some(u => u.cartaId === "dragarto" && u.pv === 2), "Ceniza Coronada revive a la más fuerte con 2 de vida");
  const x = poner(e, 0, "t11"); M.morir(e, x, { tipo: "habilidad" }); ok(e.jugadores[0].campo.some(u => u.cartaId === "centinela"), "y crea un Centinela cuando muere otra aliada"); }
{ const e = partida(); turnoDe(e, 0); const J1 = e.jugadores[1]; J1.mano = ["pergamino-de-bola-de-fuego", "t11"]; J1.energia = 10;
  M.ponerUnidad(e, 0, "magistrada-de-la-colmena", true, null); e.activo = 1; e.turno += 1;
  ok(M.motivoVeto(e, 1, M.meta(e, "pergamino-de-bola-de-fuego")) && !M.motivoVeto(e, 1, M.meta(e, "t11")), "Magistrada: el rival no puede jugar Acciones pero sí unidades");
  ok(M.aplicar(e, { t: "jugar", i: 0 }, 1).error, "y el motor rechaza la jugada");
  ok(!M.accionesLegales(e).some(a => a.t === "jugar" && a.i === 0), "las acciones legales ya no la incluyen");
  e.turno += 2; ok(!M.motivoVeto(e, 1, M.meta(e, "pergamino-de-bola-de-fuego")), "y el veto termina"); }
{ const e = partida(); turnoDe(e, 0); const B = e.jugadores[1]; B.mano = ["t11", "ocevat", "hidra"];
  M.ponerUnidad(e, 0, "portador-del-sello-rojo", true, null); ok(!B.mano.includes("hidra") && B.mano.length === 2, "Portador: el rival descarta la de mayor coste"); }
{ const e = partida(); turnoDe(e, 0); const B = e.jugadores[1]; B.mazo = ["t11", "kobold", "hidra", "lobo"];
  M.ponerUnidad(e, 0, "velador-de-umbrathil", true, null); ok(B.mazo[B.mazo.length - 1] === "hidra" && B.mazo.length === 4, "Velador manda al fondo la más cara de las tres primeras"); }

// 3) NPCs
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "t33"); a.pv = 1; M.ponerUnidad(e, 0, "posadero", true, a); ok(a.pv === 3 + 0 || a.pv === 3, `Posadero cura 3 (${a.pv})`); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "t33"); M.ponerUnidad(e, 0, "herrero-de-aldea", true, a); ok(a.atq === 4 && a.pvMax === 4, "Herrero: +1/+1"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "t33"); a.pv = 1; M.ponerUnidad(e, 0, "boticaria", true, null); ok(a.pv === 3, "Boticaria cura 2 a todas"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "t33"); M.ponerUnidad(e, 0, "bardo-ambulante", true, null); ok(M.atqEfectivo(e, a) === 4, "Bardo: +1 de ataque este turno"); }
{ const e = partida(); turnoDe(e, 0); const J = e.jugadores[0]; J.mano = ["hidra", "t11"]; const antes = J.mazo.length; M.ponerUnidad(e, 0, "mercader-viajero", true, null);
  ok(J.mano.length === 3 && J.mano[0] === "hidra" && J.mazo.length === antes - 2 && J.descartes.includes("t11"), `Mercader viajero descarta la más barata y roba 2 (${J.mano})`); }
{ const e = partida(); turnoDe(e, 0); const g = poner(e, 0, "guardia-de-la-ciudad"); ok(M.tienePalabra(e, g, "provocar"), "Guardia: Provocar"); const s = poner(e, 0, "soldado-balutiano"); ok(M.tienePalabra(e, s, "duro"), "Soldado: Duro"); }
{ const e = partida(); turnoDe(e, 0); const nv = poner(e, 0, "novicio"); ok(M.atqEfectivo(e, nv) === 1, "Novicio solo: 1"); poner(e, 0, "bull"); poner(e, 0, "billy"); ok(M.atqEfectivo(e, nv) === 3, "Novicio: +1 por cada otra de Juramento"); }
{ const e = partida(); turnoDe(e, 0); const c = poner(e, 0, "cazador-de-brurland"); ok(M.efectoDe(e, c).bonusAtaque(e, c, poner(e, 1, "kobold")) === 2 && M.efectoDe(e, c).bonusAtaque(e, c, poner(e, 1, "bull")) === 0, "Cazador: +2 contra Criaturas"); }
{ const e = partida(); turnoDe(e, 0); const g = poner(e, 0, "granjero-con-horca"); const atk = poner(e, 1, "t33"); M.infligir(e, { u: g.uid }, 1, { tipo: "combate", uid: atk.uid }); ok(atk.pv === 2, "Granjero: 1 de daño a quien lo golpea en combate"); }
{ const e = partida(); turnoDe(e, 0); const l = M.ponerUnidad(e, 0, "ladron-de-bolsillos", false, null); ok(M.esEscurridizo(e, l), "Ladrón: Escurridizo al entrar"); }
{ const e = partida(); turnoDe(e, 0); const p = poner(e, 1, "bull"); M.ponerUnidad(e, 0, "contrabandista", true, p); ok(!M.tienePalabra(e, p, "provocar"), "Contrabandista quita Provocar"); }
{ const e = partida(); turnoDe(e, 0); const t = poner(e, 1, "t52"); M.ponerUnidad(e, 0, "alquimista-de-nernib", true, t); ok(t.atq === 2 && t.pv === 5, `Alquimista invierte 5/2 en 2/5 (${t.atq}/${t.pv})`); }
{ const e = partida(); turnoDe(e, 0); const t = poner(e, 1, "t24"); M.ponerUnidad(e, 0, "aprendiz-de-mago", true, t); ok(t.pv === 3, "Aprendiz: 1 de daño"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "t33"); M.ponerUnidad(e, 0, "capitan-de-barco", true, a); ok(!M.buscar(e, a.uid) && e.jugadores[0].mano.includes("t33"), "Capitán de barco devuelve a otra aliada"); }
{ const e = partida(); turnoDe(e, 0); const J = e.jugadores[0]; let n0 = J.mano.length; M.ponerUnidad(e, 0, "pescador", true, null); ok(J.mano.length === n0, "Pescador no roba sin terreno");
  e.terreno = { cartaId: "los-huesos", dueno: 1, restantes: 3, turnoEntrada: 0, desde: 1, ligadoA: null }; const mazo0 = J.mazo.length; M.ponerUnidad(e, 0, "pescador", true, null);
  const sacada = cartas[J.mano[J.mano.length - 1]];
  ok(J.mano.length === n0 + 1 && J.mazo.length === mazo0 && sacada.afinidad.includes("sombra") && ["comun", "infrecuente", "rara"].includes(sacada.rareza), `Pescador saca una carta de la afinidad del terreno sin tocar el mazo (${sacada.nombre})`);
  // Es un sorteo con semilla: la misma partida da la misma carta
  const dist = new Set(); for (let s = 1; s <= 30; s++) { const e2 = partida(); e2.rng = s * 977; turnoDe(e2, 0); e2.terreno = { cartaId: "los-huesos", dueno: 1, restantes: 3, turnoEntrada: 0, desde: 1, ligadoA: null }; const J2 = e2.jugadores[0]; J2.mano = []; M.ponerUnidad(e2, 0, "pescador", true, null); dist.add(J2.mano[0]); }
  ok(dist.size > 3, `y no es siempre la misma (${dist.size} distintas en 30 sorteos)`); }
{ const e = partida(); turnoDe(e, 0); const m = poner(e, 0, "minero-de-pozohumo"); M.infligir(e, { u: m.uid }, 2, { tipo: "terreno" }); ok(m.pv === 3, "Minero no recibe daño de terrenos"); M.infligir(e, { u: m.uid }, 2, { tipo: "habilidad" }); ok(m.pv === 1, "pero sí de lo demás"); }
{ const e = partida(); turnoDe(e, 0); const B = e.jugadores[1]; B.mazo = ["kobold", "pocion-de-curacion-menor"]; M.ponerUnidad(e, 0, "ciego-profeta", true, null); ok(B.mazo[B.mazo.length - 1] === "kobold", "Ciego profeta manda una unidad al fondo");
  B.mazo = ["pocion-de-curacion-menor", "kobold"]; M.ponerUnidad(e, 0, "ciego-profeta", true, null); ok(B.mazo[0] === "pocion-de-curacion-menor", "pero no un objeto"); }
{ const e = partida(); turnoDe(e, 0); const t = poner(e, 1, "t33"); t.pv = 1; const sana = poner(e, 1, "t24");
  const r = M.requisitoDeJugada(e, 0, "verdugo"); ok(r.validos.length === 1, "Verdugo solo elige las de la mitad de vida o menos"); M.ponerUnidad(e, 0, "verdugo", true, t); ok(!M.buscar(e, t.uid), "y la destruye"); }
{ const e = partida(); turnoDe(e, 0); M.ponerUnidad(e, 0, "escriba-del-contrato", true, null); ok(M.motivoVeto(e, 1, M.meta(e, "bomba-de-humo")), "Escriba: el rival no puede jugar Reacciones este turno");
  const B = e.jugadores[1]; B.mano = ["bomba-de-humo"]; B.energia = 5; const a = poner(e, 0, "t33"); ok(M.reaccionesPosibles(e, 1, { tipo: "ataque", actor: 0, atacantes: [a.uid] }).length === 0, "y no aparece como reacción posible"); }
{ const e = partida(); turnoDe(e, 0); const p = poner(e, 0, "peregrino-del-alba"), a = poner(e, 0, "t33"); a.pv = 1; M.morir(e, p, { tipo: "habilidad" }); ok(a.pv === 3 + 0 || a.pv === 3, "Peregrino: cura 3 al morir"); }
{ const e = partida(); turnoDe(e, 0); const J = e.jugadores[0]; J.cementerio = ["hidra", "kobold", "bull"]; J.mano = []; M.ponerUnidad(e, 0, "sepulturero", true, null); ok(J.mano.length === 1 && J.mano[0] === "kobold", "Sepulturero recupera la unidad más barata"); }

// 4) Criaturas
{ const e = partida(); turnoDe(e, 0); const f = M.ponerUnidad(e, 0, "fenix", false, null); M.morir(e, f, { tipo: "habilidad" });
  const f2 = e.jugadores[0].campo.find(u => u.cartaId === "fenix"); ok(f2 && f2.pv === 2 && f2.flags.renacida, "Fénix renace con 2 de vida"); M.morir(e, f2, { tipo: "habilidad" }); ok(!e.jugadores[0].campo.some(u => u.cartaId === "fenix"), "y solo una vez"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "t33"); M.mod(e, a, -2, 0, e.turno + 3); a.flags.noAtacaHasta = 99; a.pv = 1; M.ponerUnidad(e, 0, "kirin", true, null); ok(M.atqEfectivo(e, a) === 3 && a.flags.noAtacaHasta === 0 && a.pv === 3, "Kirin limpia lo negativo y cura 2"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 1, "t33"), b = poner(e, 1, "t24"); M.ponerUnidad(e, 0, "manticora", true, null); ok(a.pv === 2 && b.pv === 3, "Manticora: 1 de daño a todas"); }
{ const e = partida(); turnoDe(e, 0); const b = poner(e, 0, "basilisco"); const atk = poner(e, 1, "t33"); M.infligir(e, { u: b.uid }, 1, { tipo: "combate", uid: atk.uid }); ok(atk.flags.noAtacaHasta > e.turno && atk.flags.noBloqueaHasta > e.turno, "Basilisco petrifica a quien lo daña en combate"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 1, "t33"), b = poner(e, 1, "t24"); M.ponerUnidad(e, 0, "medusa", true, null); ok(a.pv === 2 && b.pv === 3 && a.flags.noAtacaHasta > e.turno && b.flags.noAtacaHasta > e.turno, "Medusa: 1 de daño y nadie ataca"); }
{ const e = partida(); turnoDe(e, 0); const v = poner(e, 1, "tvuela"), s = poner(e, 1, "t33"); const r = M.requisitoDeJugada(e, 0, "kelpie"); ok(r.validos.length === 1 && r.validos[0].u === s.uid, "Kelpie solo elige unidades sin Volar"); }
{ const e = partida(); turnoDe(e, 0); const u = poner(e, 0, "unicornio"), a = poner(e, 0, "t33"); a.pv = 1; ok(M.esEscurridizo(e, u), "Unicornio: Escurridizo"); M.ponerUnidad(e, 0, "unicornio", true, a); ok(a.pv === 3, "y cura al máximo"); }
{ const e = partida(); turnoDe(e, 0); const t = poner(e, 1, "t52"); M.ponerUnidad(e, 0, "behemoth", true, t); ok(!M.buscar(e, t.uid), "Behemoth: 3 de daño al entrar"); }
{ const e = partida(); turnoDe(e, 0); const l = poner(e, 0, "leviatan"); const a = poner(e, 1, "t33"), b = poner(e, 1, "t24"); M.aplicar(e, { t: "atacar", u: [l.uid] }, 0); ok(a.pv === 1 && b.pv === 2, "Leviatán: 2 de daño a todas al atacar"); }
{ const e = partida(); turnoDe(e, 0); const g = poner(e, 0, "gargola"); M.morir(e, g, { tipo: "habilidad" }); ok(e.jugadores[0].campo.some(u => u.cartaId === "resto-piedra"), "Gárgola deja un Resto de piedra"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "t33"); M.ponerUnidad(e, 0, "pegaso", true, a); ok(M.tienePalabra(e, a, "volar"), "Pegaso da Volar este turno"); M.aplicar(e, { t: "fin" }, 0); ok(!M.tienePalabra(e, a, "volar"), "y se acaba"); }
{ const e = partida(); turnoDe(e, 0); const h = poner(e, 0, "hipogrifo"), g = poner(e, 0, "grifo"); ok(M.tienePalabra(e, h, "volar") && M.tienePalabra(e, h, "veloz") && M.tienePalabra(e, g, "temible"), "Hipogrifo y Grifo"); }
{ const e = partida(); turnoDe(e, 0); const n0 = e.jugadores[0].mano.length; M.ponerUnidad(e, 0, "dragon-dorado", true, null); ok(e.jugadores[0].mano.length === n0 + 2, "Dragón Dorado: roba 2"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 1, "t33"); M.ponerUnidad(e, 0, "dragon-de-magma", true, null); ok(a.pv === 1, "Dragón de Magma: 2 a todas"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 1, "t52"); M.ponerUnidad(e, 0, "dragon-ancestral", true, a); ok(!M.buscar(e, a.uid), "Dragón Ancestral: 4 de daño"); }
{ const e = partida(); turnoDe(e, 0); const t = poner(e, 0, "arbol-ancestral-de-eon"); for (let i = 0; i < 12; i++) M.aplicar(e, { t: "fin" }, e.activo); ok(t.atq === 6 && t.pvMax === 12, `Árbol: crece hasta +4/+4 (${t.atq}/${t.pvMax})`); }
{ const e = partida(); turnoDe(e, 0); const l = poner(e, 0, "lao-shan-lung"); e.terreno = { cartaId: "los-huesos", dueno: 1, restantes: 3, turnoEntrada: 0, desde: 1, ligadoA: null }; e.jugadores[1].campo.length = 0;
  M.aplicar(e, { t: "atacar", u: [l.uid] }, 0); ok(e.terreno === null, "Lao Shan Lung deshace el terreno al atacar"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 1, "t33"); M.ponerUnidad(e, 0, "borealis-titan-glacial", true, null); ok(a.flags.noAtacaHasta > e.turno, "Borealis: congela al campo rival"); }
{ const e = partida(); turnoDe(e, 0); const r = poner(e, 0, "rykerd-el-imperdonable"), x = poner(e, 0, "t11"); M.morir(e, x, { tipo: "habilidad" }); ok(r.atq === 6, "Rykerd: +2 por cada aliada que cae"); }
{ const e = partida(); turnoDe(e, 0); const ek = poner(e, 0, "ekizias-el-recolector"); const n0 = e.jugadores[0].mano.length; const a = poner(e, 1, "t11"), b = poner(e, 1, "t11"); M.morir(e, a, { tipo: "habilidad" }); M.morir(e, b, { tipo: "habilidad" });
  ok(e.jugadores[0].mano.length === n0 + 1, "Ekizias roba solo una vez por turno"); }
{ const e = partida(); turnoDe(e, 0); M.ponerUnidad(e, 0, "la-madre-del-desierto", true, null); const g = () => e.jugadores[0].campo.filter(u => u.cartaId === "gusano-de-arena").length;
  ok(g() === 2, "Madre del Desierto crea 2 gusanos"); M.aplicar(e, { t: "fin" }, 0); M.aplicar(e, { t: "fin" }, 1); ok(g() === 3, "y otro al inicio de tu turno"); }
{ const e = partida(); turnoDe(e, 0); const m = M.ponerUnidad(e, 0, "mimico", false, null); ok(M.esEscurridizo(e, m), "Mímico: Escurridizo al entrar"); const B = e.jugadores[1]; B.mano = ["t11"]; M.morir(e, m, { tipo: "habilidad" }); ok(B.mano.length === 0, "y el rival descarta al morir"); }
{ const e = partida(); turnoDe(e, 0); const c = poner(e, 0, "cubo-gelatinoso"); const v = poner(e, 1, "t11"); M.infligir(e, { u: v.uid }, 5, { tipo: "combate", uid: c.uid }); ok(c.atq === 3 && c.pvMax === 6, `Cubo gelatinoso absorbe (${c.atq}/${c.pvMax})`); }
{ const e = partida(); turnoDe(e, 0); poner(e, 0, "ent-mayor"); const a = poner(e, 0, "t33"), p = poner(e, 0, "bull"); ok(M.atqEfectivo(e, a) === 4 && M.atqEfectivo(e, p) === 4 - 1, "Ent Mayor: +1 a las de Carne (t33 es Carne, Bull no)"); }
{ const e = partida(); turnoDe(e, 0); M.ponerUnidad(e, 0, "gofiri-la-jauria", true, null); const c = e.jugadores[0].campo.filter(u => u.cartaId === "cachorro-de-jauria"); ok(c.length === 2 && M.tienePalabra(e, c[0], "veloz"), "Gofiri crea 2 cachorros Veloz"); }

// 5) Objetos y acciones
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "t33"); jugar(e, 0, "espada-larga"); ok(a.atq === 5, "Espada larga +2"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "t33"); jugar(e, 0, "daga-envenenada"); ok(M.tienePalabra(e, a, "veloz") && a.atq === 4, "Daga: +1 y Veloz"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "t33"); jugar(e, 0, "arco-largo"); ok(M.tienePalabra(e, a, "volar"), "Arco largo: Volar"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "t33"); jugar(e, 0, "lanza-de-caballeria"); ok(M.tienePalabra(e, a, "arrollar") && a.atq === 5, "Lanza: +2 y Arrollar"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "t33"); jugar(e, 0, "armadura-de-malla"); ok(M.tienePalabra(e, a, "duro") && a.pvMax === 4, "Armadura: +0/+1 y Duro"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "t33"); jugar(e, 0, "pocion-de-fuerza"); ok(M.atqEfectivo(e, a) === 6, "Poción de fuerza +3 este turno"); M.aplicar(e, { t: "fin" }, 0); ok(M.atqEfectivo(e, a) === 3, "y vuelve a lo normal"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "t33"); M.mod(e, a, -2, 0, e.turno + 3); a.pv = 1; jugar(e, 0, "antidoto"); ok(M.atqEfectivo(e, a) === 3 && a.pv === 3, "Antídoto limpia y cura 2"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 1, "t33"), b = poner(e, 1, "t24"); jugar(e, 0, "pergamino-de-bola-de-fuego"); ok(a.pv === 1 && b.pv === 2, "Pergamino: 2 a cada enemiga"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "t33"); jugar(e, 0, "anillo-de-invisibilidad"); ok(M.esEscurridizo(e, a), "Anillo: Escurridizo"); for (let i = 0; i < 6; i++) M.aplicar(e, { t: "fin" }, e.activo); ok(M.esEscurridizo(e, a), "para siempre"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "t33"); jugar(e, 0, "capa-elfica"); ok(M.tienePalabra(e, a, "esquivo") && a.pvMax === 4, "Capa élfica"); }
{ const e = partida(); turnoDe(e, 0); const a = M.ponerUnidad(e, 0, "t33", false, null); ok(!M.unidadPuedeAtacar(e, a), "recién entrada no ataca"); jugar(e, 0, "botas-de-velocidad"); ok(M.tienePalabra(e, a, "veloz") && M.unidadPuedeAtacar(e, a), "Botas: Veloz y puede atacar ya"); }
{ const e = partida(); turnoDe(e, 0); const J = e.jugadores[0], B = e.jugadores[1]; B.mano = ["t11", "t11", "t11", "t11", "t11"]; const n0 = J.mazo.length; jugar(e, 0, "lampara-de-aceite"); ok(J.mazo.length === n0 - 2, "Lámpara: roba 2 si el rival tiene 5 cartas"); }
{ const e = partida(); turnoDe(e, 0); const v = poner(e, 1, "tvuela"); jugar(e, 0, "cuerda-de-seda"); ok(!M.tienePalabra(e, v, "volar"), "Cuerda: pierde Volar"); }
{ const e = partida(); turnoDe(e, 0); const J = e.jugadores[0]; const n0 = J.mazo.length; jugar(e, 0, "mapa-del-tesoro"); ok(J.mazo.length === n0 - 1, "Mapa sin terreno: 1"); e.terreno = { cartaId: "los-huesos", dueno: 1, restantes: 3, turnoEntrada: 0, desde: 1, ligadoA: null }; const n1 = J.mazo.length; jugar(e, 0, "mapa-del-tesoro"); ok(J.mazo.length === n1 - 2, "con terreno: 2"); }
{ const e = partida(); turnoDe(e, 0); const J = e.jugadores[0]; const n0 = J.mazo.length, v0 = J.vida; jugar(e, 0, "cofre-con-trampa"); ok(J.mazo.length === n0 - 2 && J.vida === v0 - 2, "Cofre: 2 cartas y 2 de daño"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 1, "t33"); const v0 = e.jugadores[1].vida; jugar(e, 0, "bomba-alquimica-de-nernib"); ok(a.pv === 0 || !M.buscar(e, a.uid), "Bomba: 3 de daño a la unidad"); ok(e.jugadores[1].vida === v0 - 1, "y 1 al jugador"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "t33"); const J = e.jugadores[0]; J.mano = ["reliquia-de-asmodeo"]; J.energia = 9;
  const r = M.requisitoDeJugada(e, 0, "reliquia-de-asmodeo"); ok(r.validos.length === 0, "Reliquia: solo a unidades de Juramento");
  const b = poner(e, 0, "bull"); jugar(e, 0, "reliquia-de-asmodeo"); ok(b.atq === 5 && b.flags.barrera, "y da +2/+2 y Barrera"); }
{ const e = partida(); turnoDe(e, 0); const B = e.jugadores[1]; jugar(e, 0, "contrato-firmado"); ok(M.motivoVeto(e, 1, { tipo: "Criatura", coste: 5 }) && !M.motivoVeto(e, 1, { tipo: "Criatura", coste: 4 }), "Contrato: veta cartas de coste 5 o más"); }
{ const e = partida(); turnoDe(e, 0); const J = e.jugadores[0]; const n0 = J.mazo.length; jugar(e, 0, "moneda-de-la-suerte"); ok(J.mazo.length === n0 - 1 || J.energia > 8, "Moneda: energía o carta"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "t33"), b = poner(e, 0, "t24"); jugar(e, 0, "cuerno-de-guerra"); ok(M.atqEfectivo(e, a) === 5 && M.atqEfectivo(e, b) === 4, "Cuerno: +2 a todas"); }
{ const e = partida(); turnoDe(e, 0); const J = e.jugadores[0]; const n0 = J.mazo.length; jugar(e, 0, "brujula-de-los-cartografos"); ok(J.mazo.length === n0 - 1 && J.energia === 10 - 1 + 1, "Brújula: carta y 1 de energía"); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "t33"); jugar(e, 0, "estandarte-de-brurland"); ok(M.tienePalabra(e, a, "provocar") && a.atq === 4 && a.pvMax === 5, "Estandarte: +1/+2 y Provocar"); }

// 6) Reacciones: se juegan cuando el rival ataca o juega
function ataque(reaccion, preparar) {
  const e = partida(); turnoDe(e, 0);
  const atk = poner(e, 0, "t33"), atk2 = poner(e, 0, "t24");
  const mia = poner(e, 1, "t24"); mia.pv = 2;
  const B = e.jugadores[1]; B.mano = [reaccion]; B.energia = 6;
  if (preparar) preparar(e, { atk, atk2, mia, B });
  const r = M.aplicar(e, { t: "atacar", u: [atk.uid, atk2.uid] }, 0);
  return { e, atk, atk2, mia, B, r };
}
const reaccionar = (x, o) => M.aplicar(x.e, o ? { t: "reaccionar", i: 0, o } : { t: "reaccionar", i: 0 }, 1);
{ const x = ataque("parada"); ok(x.e.pendiente && x.e.pendiente.tipo === "ataque", "hay ventana de reacción"); reaccionar(x); ok(x.mia.flags.barrera, "Parada: Barrera"); }
{ const x = ataque("contraataque"); reaccionar(x, { u: x.atk.uid }); ok(x.atk.pv === 1, `Contraataque: 2 de daño (${x.atk.pv})`);
  const y = ataque("contraataque", (e, k) => poner(e, 1, "bull")); reaccionar(y, { u: y.atk.uid }); ok(!M.buscar(y.e, y.atk.uid), "y 4 con una de Juramento"); }
{ const x = ataque("emboscada"); reaccionar(x); ok(x.e.jugadores[1].campo.filter(u => u.cartaId === "emboscado").length === 2, "Emboscada: 2 emboscados"); }
{ const x = ataque("esquiva"); reaccionar(x, { u: x.atk.uid }); ok(M.atqEfectivo(x.e, x.atk) === 0, "Esquiva: -3 de ataque"); }
{ const x = ataque("ultima-voluntad", (e) => { e.jugadores[1].cementerio = ["dragarto"]; }); reaccionar(x); ok(x.e.jugadores[1].campo.some(u => u.cartaId === "dragarto" && u.pv === 1), "Última voluntad revive con 1 de vida"); }
{ const x = ataque("muro-de-escudos"); reaccionar(x); ok(M.tienePalabra(x.e, x.mia, "duro"), "Muro de escudos: Duro"); }
{ const x = ataque("intervencion-divina", e => { e.jugadores[1].vida = 10; }); const v0 = x.e.jugadores[1].vida; reaccionar(x); ok(x.mia.pv === 4 && x.e.jugadores[1].vida === v0 + 4, "Intervención divina: cura todo y 4 de vida"); }
{ const x = ataque("trampa-de-foso"); reaccionar(x, { u: x.atk.uid }); ok(x.atk.pv === 1 && !x.e.combate.atacantes.includes(x.atk.uid) && x.atk.flags.noAtacaHasta > x.e.turno, "Trampa de foso: daño, sale del ataque y no ataca después"); }
{ const x = ataque("rafaga-de-flechas"); reaccionar(x); ok(x.atk.pv === 2 && x.atk2.pv === 3, "Ráfaga: 1 de daño a cada atacante"); }
{ const x = ataque("llamada-a-las-armas"); reaccionar(x); ok(x.e.jugadores[1].campo.filter(u => u.cartaId === "recluta").length === 2, "Llamada a las armas: 2 reclutas"); }
{ const x = ataque("soborno"); const n0 = x.B.mano.length; reaccionar(x, { u: x.atk2.uid }); ok(!x.e.combate.atacantes.includes(x.atk2.uid) && x.B.mano.length === n0 - 1 + 1, "Soborno: se queda fuera y robas"); }
{ const x = ataque("huida-estrategica"); reaccionar(x); ok(!M.buscar(x.e, x.mia.uid) && x.B.mano.includes("t24"), "Huida estratégica: vuelve a la mano"); }
{ const x = ataque("rezo-del-neravismo", (e) => { e.jugadores[1].cementerio = ["bull"]; }); reaccionar(x); ok(x.B.mano.includes("bull") && !x.e.jugadores[1].cementerio.includes("bull"), "Rezo del Neravismo: recupera la última carta"); }
function jugada(reaccion, carta) {
  const e = partida(); turnoDe(e, 0); const A = e.jugadores[0], B = e.jugadores[1];
  A.mano = [carta]; A.energia = 10; B.mano = [reaccion]; B.energia = 6; poner(e, 0, "t33"); poner(e, 1, "t33");
  const req = M.requisitoDeJugada(e, 0, carta); const o = req && req.validos.length ? req.validos[0] : undefined;
  const r = M.aplicar(e, o ? { t: "jugar", i: 0, o } : { t: "jugar", i: 0 }, 0);
  return { e, A, B, r };
}
{ const x = jugada("espejo-arcano", "pocion-de-fuerza"); ok(x.e.pendiente, "ventana al jugar un objeto"); M.aplicar(x.e, { t: "reaccionar", i: 0 }, 1); ok(x.B.mano.includes("pocion-de-fuerza") && x.A.cementerio.includes("pocion-de-fuerza"), "Espejo arcano: cancela y se queda una copia"); }
{ const x = jugada("contrahechizo", "pocion-de-fuerza"); const n0 = x.B.mazo.length; M.aplicar(x.e, { t: "reaccionar", i: 0 }, 1); ok(x.B.mazo.length === n0 - 1 && x.A.cementerio.includes("pocion-de-fuerza"), "Contrahechizo: cancela y roba"); }
{ const x = jugada("pacto-roto", "aprendiz-de-mago"); M.aplicar(x.e, { t: "reaccionar", i: 0 }, 1); ok(!x.e.jugadores[0].campo.some(u => u.cartaId === "aprendiz-de-mago") && x.A.cementerio.includes("aprendiz-de-mago"), "Pacto roto: cancela una unidad barata"); }
{ const x = jugada("clausula-oculta", "dragarto"); ok(x.e.pendiente, "Cláusula: ventana al jugar una carta cara"); M.aplicar(x.e, { t: "reaccionar", i: 0 }, 1); ok(!x.e.jugadores[0].campo.some(u => u.cartaId === "dragarto"), "y la cancela"); }

// 7) Terrenos
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "t33"), b = poner(e, 1, "t33"); const J = e.jugadores[0]; J.mano = ["geiseres-de-nigredo"]; J.energia = 5; M.aplicar(e, { t: "jugar", i: 0 }, 0);
  const suma = () => M.todas(e).reduce((s, u) => s + u.pv, 0); const antes = suma(); M.aplicar(e, { t: "fin" }, 0); ok(suma() === antes - 2, "Géiseres: 2 de daño a una unidad al azar al final del turno"); }
{ const e = partida(); turnoDe(e, 0); const J = e.jugadores[0]; J.mano = ["mina-de-pozohumo"]; J.energia = 5; M.aplicar(e, { t: "jugar", i: 0 }, 0); M.aplicar(e, { t: "fin" }, 0); M.aplicar(e, { t: "fin" }, 1);
  ok(J.energia === J.energiaMax + 1, `Mina: +1 de energía al inicio de tu turno (${J.energia}/${J.energiaMax})`); }
{ const e = partida(); turnoDe(e, 0); const a = poner(e, 0, "t33"); a.pv = 1; const J = e.jugadores[0]; J.mano = ["taberna-del-camino"]; J.energia = 5; M.aplicar(e, { t: "jugar", i: 0 }, 0); M.aplicar(e, { t: "fin" }, 0); M.aplicar(e, { t: "fin" }, 1);
  ok(a.pv === 3, `Taberna: cura 2 a todas al inicio de tu turno (${a.pv})`); }

console.log(fallos.length ? `${fallos.length} fallo(s):\n  ` + fallos.slice(0, 30).join("\n  ") : `OK: ${n} comprobaciones del lote 2.`);
process.exit(fallos.length ? 1 : 0);
