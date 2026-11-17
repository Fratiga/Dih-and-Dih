/* Pruebas de las reglas 5 de La Fractura: órdenes, caminos, Portal, administración, transmutación, obras,
   sanadores, héroes (renombre, habilidades, golpe que no mata) y gigantes de 2×2.
   Uso: node tools/probar-fractura-v5.js */
const D = require("../js/fractura-datos.js");
const FM = require("../js/fractura-motor.js");
const IA = require("../js/fractura-ia.js");
let fallos = 0, hechas = 0;
const ok = (c, m) => { hechas++; if (!c) { fallos++; console.log("  FALLO:", m); } };

const guerra = (facs, extra) => FM.crearGuerra(Object.assign({ semilla: 4242, tipo: "reinos", forma: "continente", dificultad: "normal", anio: 1, tregua: 0,
  jugadores: facs.map((f, i) => ({ nombre: `B${i}`, faccion: f, humano: i === 0, nivelIA: "normal" })) }, extra || {}));
const limpiar = est => { Object.keys(est.unidades).forEach(k => delete est.unidades[k]); };
const llano = (est, x, y) => { const c = est.casillas[y][x]; if (c.t === "agua" || c.t === "vacio" || c.t === "montana") c.t = "llanura"; };
const poner = (est, j, clase, x, y, extra) => { llano(est, x, y); const u = FM.nuevaUnidad(est, j, clase, x, y, null, extra); u.pm = FM.ef(est, u).mov; return u; };
const libre = (est, cerca, d) => { for (let r = d; r < 20; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = cerca.x + dx, y = cerca.y + dy; if (FM.dentro(est, x, y) && !FM.unidadEn(est, x, y) && !est.casillas[y][x].est && est.casillas[y][x].t !== "vacio" && est.casillas[y][x].t !== "agua") return { x, y }; } return null; };
const rico = jug => Object.keys(jug.recursos).forEach(k => { jug.recursos[k] = 999; });

// --- Órdenes ---
{
  const est = guerra(["caballeros-del-reino", "hijos-del-acero"]);
  limpiar(est); est.activo = 0;
  const cap = FM.ciudadesDe(est, 0).find(c => c.capital), enemiga = FM.ciudadesDe(est, 1).find(c => c.capital);
  const a = libre(est, cap, 2), u = poner(est, 0, "guerrero", a.x, a.y);
  u.orden = { tipo: "conquistar", ciudad: enemiga.id, x: enemiga.x, y: enemiga.y };
  const antes = Math.max(Math.abs(u.x - enemiga.x), Math.abs(u.y - enemiga.y));
  const acc = [];
  IA.cumplirOrdenes(est, 0, x => { const r = FM.aplicar(est, x); if (r.ok) acc.push(x); return r; });
  ok(acc.some(x => x.t === "mover"), "la orden Conquistar no mueve");
  ok(Math.max(Math.abs(u.x - enemiga.x), Math.abs(u.y - enemiga.y)) < antes, "Conquistar no se acerca a la ciudad");
  // Curarse: una tropa muy herida deja su orden y vuelve a casa
  const b = libre(est, cap, 3), w = poner(est, 0, "guerrero", b.x, b.y);
  w.orden = { tipo: "matanza" }; w.hp = 2;
  const avisos = IA.cumplirOrdenes(est, 0, x => FM.aplicar(est, x));
  ok(w.orden && w.orden.tipo === "curarse" && w.orden.anterior.tipo === "matanza", "una tropa muy herida no vuelve a curarse");
  ok(avisos.some(t => t.texto.includes("herida")), "no avisa de que vuelve a curarse");
  // Explorar: se para si ve a un enemigo más fuerte
  const c0 = libre(est, cap, 4), e = poner(est, 0, "picaro", c0.x, c0.y);
  e.orden = { tipo: "explorar" };
  const g = libre(est, c0, 2), fuerte = poner(est, 1, "paladin", g.x, g.y);
  void fuerte;
  FM.actualizarVision(est, 0);
  IA.cumplirOrdenes(est, 0, x => FM.aplicar(est, x));
  ok(!e.orden, "Explorar no se corta al ver un enemigo más fuerte");
}

// --- Caminos propios: por tu territorio el bosque cuesta la mitad ---
{
  const est = guerra(["caballeros-del-reino", "hijos-del-acero"]);
  limpiar(est); est.activo = 0;
  const cap = FM.ciudadesDe(est, 0).find(c => c.capital);
  const a = libre(est, cap, 1), u = poner(est, 0, "guerrero", a.x, a.y);
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const c = est.casillas[a.y + dy] && est.casillas[a.y + dy][a.x + dx]; if (c && !c.est && (dx || dy)) c.t = "bosque"; }
  u.pm = 3;
  const propio = Math.max(...[...FM.alcanzables(est, u).destinos.values()].map(n => Math.max(Math.abs(n.x - u.x), Math.abs(n.y - u.y))));
  est.regiones.forEach(r => { r.dueno = null; });
  const ajeno = Math.max(...[...FM.alcanzables(est, u).destinos.values()].map(n => Math.max(Math.abs(n.x - u.x), Math.abs(n.y - u.y))), 0);
  ok(propio > ajeno, `por su territorio no llega más lejos (${propio} contra ${ajeno})`);
}

// --- Portal ---
{
  const est = guerra(["academia-arcana-de-dolbred", "hijos-del-acero"]);
  limpiar(est); est.activo = 0;
  const jug = est.jugadores[0]; rico(jug);
  const [c1] = FM.ciudadesDe(est, 0);
  const c2 = Object.values(est.ciudades).find(c => c.dueno === null);
  c2.dueno = 0;
  ok(!!FM.razonNoConstruir(est, 0, c1.id, "portal"), "el Portal se construye sin nivel");
  c1.nivel = 5; c2.nivel = 5;
  ok(/escalón/.test(FM.razonNoConstruir(est, 0, c1.id, "portal") || ""), "el Portal no pide saber");
  jug.tech[Object.keys(jug.tech)[0]] = 4; FM.rehacerSaber(est, 0);
  c1.edificios = []; c2.edificios = [];
  ok(FM.aplicar(est, { t: "construir", ciudad: c1.id, edificio: "portal" }).ok, "no se construye el Portal");
  c2.edificios.push("portal");
  const a = libre(est, c1, 1), u = poner(est, 0, "guerrero", a.x, a.y);
  const oro = jug.recursos.oro;
  const r = FM.aplicar(est, { t: "portal", uid: u.uid, ciudad: c2.id });
  ok(r.ok && Math.max(Math.abs(u.x - c2.x), Math.abs(u.y - c2.y)) <= 1, `el portal no lleva a la tropa: ${r.error}`);
  ok(jug.recursos.oro === oro - 4, "el portal no cobra");
  const b = libre(est, c1, 1), w = poner(est, 0, "guerrero", b.x, b.y);
  ok(!FM.aplicar(est, { t: "portal", uid: w.uid, ciudad: c2.id }).ok, "el portal se usa dos veces en un turno");
}

// --- Administración, transmutación y obras ---
{
  const est = guerra(["academia-arcana-de-dolbred", "caballeros-del-reino"]);
  const cs = Object.values(est.ciudades).filter(c => c.dueno === null).slice(0, 5);
  cs.forEach(c => { c.dueno = 0; });
  const d = FM.ingresoDe(est, 0, true);
  ok(d.fuentes["Administración"] && d.fuentes["Administración"].oro === -6, `la administración de 6 ciudades no cuesta 6 (1+2+3) (${JSON.stringify(d.fuentes["Administración"])})`);
  est.activo = 0;
  const jug = est.jugadores[0]; rico(jug);
  const c = FM.ciudadesDe(est, 0)[0];
  c.edificios.push("transmutacion");
  const oro = jug.recursos.oro;
  ok(FM.aplicar(est, { t: "transmutar", ciudad: c.id, de: "materiales", a: "oro", n: 6 }).ok, "no transmuta");
  ok(jug.recursos.oro === oro + 6, "Dolbred no transmuta 1 por 1");
  ok(!FM.aplicar(est, { t: "transmutar", ciudad: c.id, de: "materiales", a: "oro", n: 3 }).ok, "transmuta más de 6 por turno");
  ok(!FM.aplicar(est, { t: "transmutar", ciudad: FM.ciudadesDe(est, 0)[1].id, de: "oro", a: "anima", n: 3 }).ok, "se consigue Ánima transmutando");
  const L = FM.limiteTropas(est, 0);
  ok(FM.aplicar(est, { t: "obra", ciudad: c.id, id: "fiesta" }).ok && FM.limiteTropas(est, 0) === L + 2, "la fiesta no sube el límite");
  ok(!FM.aplicar(est, { t: "obra", ciudad: c.id, id: "fiesta" }).ok, "la misma obra se repite estando en marcha");
  ok(FM.aplicar(est, { t: "obra", ciudad: c.id, id: "levas" }).ok, "no hace levas");
  ok(FM.aplicar(est, { t: "reclutar", ciudad: c.id, clase: "guerrero" }).ok && FM.aplicar(est, { t: "reclutar", ciudad: c.id, clase: "guerrero" }).ok, "con levas no entrena dos");
}

// --- Sanadores: todos los ejércitos tienen uno ---
{
  Object.keys(D.FACCIONES).forEach(f => ok(D.FACCIONES[f].clasesExtra.some(c => D.CLASES[c].sanador) || f === "santos-de-asmodeo", `${f} no tiene sanador`));
  const est = guerra(["trono-de-ceniza", "caballeros-del-reino"]);
  limpiar(est); est.activo = 1;
  const cap = FM.ciudadesDe(est, 0).find(c => c.capital), a = libre(est, cap, 4);
  const s = poner(est, 0, "embalsamador", a.x, a.y), b = libre(est, a, 1), herido = poner(est, 0, "guerrero", b.x, b.y);
  herido.hp = 3;
  FM.aplicar(est, { t: "terminar" });
  ok(herido.hp > 3, "el embalsamador no cura a los suyos");
  void s;
}

// --- Héroes: renombre y turno mínimo, golpe que no mata, habilidades ---
{
  const est = guerra(["trono-de-ceniza", "caballeros-del-reino"]);
  est.activo = 0;
  const jug = est.jugadores[0]; rico(jug);
  const cap = FM.ciudadesDe(est, 0).find(c => c.capital);
  cap.edificios = []; jug.tech = Object.assign(jug.tech, { tanato: 6, huesos: 6 }); FM.rehacerSaber(est, 0); jug.cuenta.perdidas = 5;
  let rq = FM.requisitosHeroe(est, 0, "ceniciento", cap.id);
  ok(!rq.ok && rq.lista.some(r => /renombre/i.test(r.texto) && !r.ok), "el héroe no pide renombre");
  ok(rq.lista.some(r => /caído 30/.test(r.texto) && !r.ok), "el Ceniciento no pide muertos en la guerra");
  est.stats.bajas[1] = 30;
  jug.renombre = 999; est.turno = 60;
  rq = FM.requisitosHeroe(est, 0, "ceniciento", cap.id);
  ok(rq.ok, `con todo cumplido no se invoca: ${rq.razon}`);
  const r = FM.aplicar(est, { t: "invocar", ciudad: cap.id, heroe: "ceniciento" });
  ok(r.ok, `no se invoca: ${r.error}`);
  const h = est.unidades[jug.heroeUid];
  ok(h && h.hp >= 50, "el héroe no es más fuerte");
  // Golpe que no mata, una vez
  FM.aplicarDano ? null : null;
  const hpAntes = h.hp; void hpAntes;
  const ene = poner(est, 1, "guerrero", libre(est, h, 1).x, libre(est, h, 1).y);
  h.hp = 1;
  FM.matar ? null : null;
  est.activo = 1; ene.atacado = false;
  const g = FM.aplicar(est, { t: "atacar", uid: ene.uid, x: h.x, y: h.y });
  ok(g.ok, `no se puede atacar al héroe: ${g.error}`);
  ok(est.unidades[h.uid] && h.hp === 1 && h.aguanteUsado, "el primer golpe mortal mata al héroe");
  // La pasiva del Ceniciento levanta como la tropa que era
  est.activo = 0;
  const ab = libre(est, h, 1), abom = poner(est, 0, "paladin", ab.x, ab.y, null);
  abom.s = { id: "sX", nombre: "Prueba", casa: "Test", victorias: 0, stats: { FUE: 5, CON: 5, VEL: 5, INT: 5, VOL: 1, MAG: 1 }, equipo: {}, hitos: [] };
  FM.matar(est, abom, null);
  const levantado = Object.values(est.unidades).find(w => w.alzado && w.dueno === 0);
  ok(levantado && levantado.clase === "paladin" && levantado.reanimado, "el Ceniciento no levanta a la Abominación como Abominación");
}

// --- Gigantes de 2×2 ---
{
  const est = guerra(["hijos-del-acero", "caballeros-del-reino"]);
  limpiar(est); est.activo = 0;
  const cap = FM.ciudadesDe(est, 0).find(c => c.capital);
  const jug = est.jugadores[0]; rico(jug); jug.renombre = 999; est.turno = 60;
  const p = FM.huecoGrande(est, cap, 0);
  ok(!!p, "no hay hueco de 2×2 junto a la capital");
  const u = FM.nuevaUnidad(est, 0, "heroe", p.x, p.y, null, { heroe: "rykerd", nombre: "Rykerd", cd: 0, cd2: 0 }); u.tam = 2; u.pm = 3;
  ok(FM.unidadEn(est, p.x + 1, p.y + 1) === u, "el gigante no ocupa sus 4 casillas");
  const destinos = [...FM.alcanzables(est, u).destinos.values()];
  ok(destinos.length > 0, "el gigante no se mueve");
  ok(destinos.every(n => FM.celdasDe({ x: n.x, y: n.y, tam: 2 }).every(q => est.casillas[q.y][q.x].t !== "agua")), "Rykerd se para en el agua");
  const e = poner(est, 1, "guerrero", p.x + 2, p.y + 1);
  ok(FM.vecinosEnemigos(est, u).includes(e), "un enemigo junto a su segunda columna no cuenta como vecino");
}

// --- Núcleo: la máquina va a por quien lo retiene ---
{
  const est = guerra(["caballeros-del-reino", "hijos-del-acero"]);
  limpiar(est); est.activo = 1; est.turno = 10;
  const n = est.nucleo;
  const enNucleo = poner(est, 0, "guerrero", n.x, n.y);
  const otro = poner(est, 0, "guerrero", n.x + 2, n.y);
  otro.hp = 3; enNucleo.hp = 9;
  const ia = poner(est, 1, "guerrero", n.x + 1, n.y + 1);
  est.nucleoHold[0] = 3;
  const golpes = IA.jugarTurno(est, 1, { sinDiplomacia: true }).filter(acc => acc.t === "atacar");
  ok(golpes.length && golpes[0].x === n.x && golpes[0].y === n.y, "la máquina prefiere rematar a otro antes que echar a quien retiene el Núcleo");
  void ia; void otro;
}

// --- La magia pega 2 más a los no muertos ---
{
  const est = guerra(["caballeros-del-reino", "trono-de-ceniza", "hijos-del-acero"]);
  limpiar(est); est.activo = 0;
  const cap = FM.ciudadesDe(est, 0).find(c => c.capital);
  const p = libre(est, cap, 3);
  const mago = poner(est, 0, "arcanista", p.x, p.y);
  const muerto = poner(est, 1, "guerrero", p.x + 1, p.y);
  const vivo = poner(est, 2, "guerrero", p.x, p.y + 1);
  const dM = FM.calcularDano(est, mago, muerto), dV = FM.calcularDano(est, mago, vivo);
  ok(dM >= dV + 2, `el mago no pega más a Osses (${dM} contra ${dV})`);
}

console.log(`${hechas} comprobaciones, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
