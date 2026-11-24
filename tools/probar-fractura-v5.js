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
// --- Órdenes con objetivo: ir a un punto (explorar, matanza) y escoltar a una tropa (defender) ---
{
  const est = guerra(["caballeros-del-reino", "hijos-del-acero"]);
  limpiar(est); est.activo = 0;
  const cap = FM.ciudadesDe(est, 0).find(c => c.capital), enemiga = FM.ciudadesDe(est, 1).find(c => c.capital);
  const d = (p, q) => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y));
  const a = libre(est, cap, 2), ex = poner(est, 0, "guerrero", a.x, a.y);
  const punto = { x: enemiga.x, y: enemiga.y };
  ex.orden = { tipo: "explorar", x: punto.x, y: punto.y };
  const d0 = d(ex, punto);
  IA.cumplirOrdenes(est, 0, x => FM.aplicar(est, x));
  ok(d(ex, punto) < d0, "Explorar con un punto marcado no se acerca a él");
  ok(ex.orden && ex.orden.x === punto.x, "Explorar pierde el punto marcado antes de llegar");
  const b = libre(est, cap, 3), ma = poner(est, 0, "guerrero", b.x, b.y);
  ma.orden = { tipo: "matanza", x: punto.x, y: punto.y };
  const d1 = d(ma, punto);
  IA.cumplirOrdenes(est, 0, x => FM.aplicar(est, x));
  ok(d(ma, punto) < d1, "Matanza con un punto marcado no se acerca a él");
  // Escoltar: el guardián va junto a su protegido
  const c0 = libre(est, cap, 4), prot = poner(est, 0, "arcanista", c0.x, c0.y);
  const g0 = libre(est, c0, 5), guard = poner(est, 0, "guerrero", g0.x, g0.y);
  guard.orden = { tipo: "defender", uid: prot.uid, x: prot.x, y: prot.y };
  const m = (p, q) => Math.abs(p.x - q.x) + Math.abs(p.y - q.y), d2 = m(guard, prot);
  IA.cumplirOrdenes(est, 0, x => FM.aplicar(est, x));
  ok(m(guard, prot) < d2 || d(guard, prot) <= 1, "Defender a una tropa no se acerca a ella");
  // Si el protegido cae, el guardián se queda defendiendo donde está
  delete est.unidades[prot.uid];
  const av = IA.cumplirOrdenes(est, 0, x => FM.aplicar(est, x));
  ok(guard.orden && guard.orden.tipo === "defender" && !guard.orden.uid && av.some(t => t.texto.includes("escoltaba")), "el guardián no se entera de que cayó su protegido");
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

// --- Levas: dos barcos en el mismo turno ---
{
  const est = guerra(["pelgiria", "hijos-del-acero"], { forma: "archipielago" });
  limpiar(est); est.activo = 0;
  const jug = est.jugadores[0]; rico(jug);
  const ci = Object.values(est.ciudades).find(c => FM.aguasLibres(est, c).length >= 2);
  if (ci) ci.dueno = 0;
  ok(!!ci, "no hay ciudad con agua para la prueba de barcos");
  if (ci) {
    ["muelle", "astillero"].forEach(e => { if (!ci.edificios.includes(e)) ci.edificios.push(e); });
    ok(FM.aplicar(est, { t: "obra", ciudad: ci.id, id: "levas" }).ok, "no se pueden encargar Levas");
    const barcos = () => Object.values(est.unidades).filter(u => u.dueno === 0 && FM.esBarco(u)).length, antes = barcos();
    const a1 = FM.aguasLibres(est, ci)[0];
    const r1 = FM.aplicar(est, { t: "reclutar", ciudad: ci.id, clase: "brulote", x: a1.x, y: a1.y });
    const a2 = FM.aguasLibres(est, ci)[0];
    const r2 = FM.aplicar(est, { t: "reclutar", ciudad: ci.id, clase: "brulote", x: a2.x, y: a2.y });
    ok(r1.ok && r2.ok, `con Levas no salen dos barcos: ${r1.error || ""} ${r2.error || ""}`);
    ok(barcos() === antes + 2, "con Levas no hay dos barcos nuevos");
    ok(a1.x !== a2.x || a1.y !== a2.y, "los dos barcos salen en la misma casilla");
    const r3 = FM.aplicar(est, { t: "reclutar", ciudad: ci.id, clase: "brulote" });
    ok(!r3.ok, "con Levas sale un tercer barco");
  }
}

// --- Levas encargadas después de entrenar: deja entrenar otra ---
{
  const est = guerra(["caballeros-del-reino", "hijos-del-acero"]);
  limpiar(est); est.activo = 0;
  const jug = est.jugadores[0]; rico(jug);
  const cap = FM.ciudadesDe(est, 0).find(c => c.capital);
  const r1 = FM.aplicar(est, { t: "reclutar", ciudad: cap.id, clase: "guerrero" });
  ok(r1.ok && !FM.aplicar(est, { t: "reclutar", ciudad: cap.id, clase: "guerrero" }).ok, "sin Levas se entrenan dos tropas");
  ok(FM.aplicar(est, { t: "obra", ciudad: cap.id, id: "levas" }).ok, "no se pueden encargar Levas después de entrenar");
  const r2 = FM.aplicar(est, { t: "reclutar", ciudad: cap.id, clase: "guerrero" });
  ok(r2.ok, `Levas encargadas después de entrenar no dejan entrenar otra: ${r2.error || ""}`);
  ok(!FM.aplicar(est, { t: "reclutar", ciudad: cap.id, clase: "guerrero" }).ok, "con Levas se entrenan tres tropas");
}

// --- Berserker: en minoría pega y aguanta más (hasta +3) ---
{
  const est = guerra(["okran", "hijos-del-acero"]);
  limpiar(est); est.activo = 0;
  const x = 12, y = 12;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) llano(est, x + dx, y + dy);
  const b = poner(est, 0, "berserker", x, y);
  const base = FM.ef(est, b);
  const e1 = poner(est, 1, "guerrero", x + 1, y), e2 = poner(est, 1, "guerrero", x - 1, y), e3 = poner(est, 1, "guerrero", x, y + 1);
  const con3 = FM.ef(est, b);
  ok(con3.atq === base.atq + 3 && con3.def === base.def + 3, `solo contra 3 no gana +3/+3 (ataque ${base.atq}→${con3.atq}, defensa ${base.def}→${con3.def})`);
  const al = poner(est, 0, "guerrero", x, y - 1);
  const con3y1 = FM.ef(est, b);
  ok(con3y1.atq === base.atq + 2 && con3y1.def === base.def + 2, "con un aliado al lado no baja a +2/+2");
  delete est.unidades[al.uid];
  poner(est, 1, "guerrero", x + 1, y + 1);
  ok(FM.ef(est, b).atq === base.atq + 3, "con 4 enemigos pasa del tope de +3");
  [e1, e2, e3].forEach(w => { delete est.unidades[w.uid]; });
  Object.values(est.unidades).filter(w => w.dueno === 1).forEach(w => { delete est.unidades[w.uid]; });
  ok(FM.minoriaBerserker(est, b) === 0, "sin enemigos al lado tiene bono de minoría");
}

// --- Okran: botín, saqueo, viejas deudas, trofeos de caza, marcha de la horda y campamentos ---
{
  const est = guerra(["okran", "caballeros-del-reino"]);
  limpiar(est); est.activo = 0;
  const jo = est.jugadores[0], jc = est.jugadores[1];
  ok(FM.razonCampamento(est, 0, poner(est, 0, "chaman", 3, 3)) !== null, "se levantan campamentos sin aprender Fuegos de campamento");
  limpiar(est);
  jo.sabEf = Object.assign({}, jo.sabEf, { trofeos: true, campamento: true });
  const x = 14, y = 14;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) llano(est, x + dx, y + dy);
  // Viejas deudas: Okran odia a Brurland, así que le pega 1 más que a un bando que no odia
  const g = poner(est, 0, "guerrero", x, y), e = poner(est, 1, "guerrero", x + 1, y);
  const conDeuda = FM.calcularDano(est, g, e);
  const facOk = D.FACCIONES.okran; const odiaba = facOk.odia; facOk.odia = [];
  const sinDeuda = FM.calcularDano(est, g, e); facOk.odia = odiaba;
  ok(conDeuda === sinDeuda + 1, `Viejas deudas no suma 1 (${sinDeuda} → ${conDeuda})`);
  // Botín: matar da comida y oro
  rico(jo); const c0 = jo.recursos.comida, o0 = jo.recursos.oro;
  e.hp = 1; FM.aplicar(est, { t: "atacar", uid: g.uid, x: e.x, y: e.y });
  ok(!est.unidades[e.uid] && jo.recursos.comida === c0 + 2 && jo.recursos.oro === o0 + 1, "matar no da el botín (+2 comida, +1 oro)");
  // Trofeos de caza: una criatura salvaje cura y da +1 de vida para toda la guerra
  const g2 = poner(est, 0, "guerrero", x, y + 2), bestia = poner(est, -1, "salvaje", x + 1, y + 2, { errante: true });
  bestia.hp = 1; const hpMax0 = FM.ef(est, g2).hpMax; g2.hp = 3;
  FM.aplicar(est, { t: "atacar", uid: g2.uid, x: bestia.x, y: bestia.y });
  ok(g2.trofeos === 1 && FM.ef(est, g2).hpMax === hpMax0 + 1 && g2.hp >= 6, "el trofeo de caza no cura o no da +1 de vida");
  // Saqueo: al tomar una ciudad de otro bando se lleva el 20 % (hasta 30)
  jc.recursos.comida = 100; jc.recursos.oro = 50; jc.recursos.materiales = 10;
  const ciu = FM.ciudadesDe(est, 1)[0], oA = jo.recursos.oro;
  FM.capturarCiudad(est, g, ciu);
  ok(jc.recursos.comida === 80 && jc.recursos.oro === 40 && jo.recursos.oro === oA + 10, "el saqueo no se lleva el 20 %");
}
{
  // Marcha de la horda: +1 de movimiento a quien empieza junto a otra tropa propia (en otra guerra: la de arriba acabó al tomar la capital)
  const est = guerra(["okran", "caballeros-del-reino"]);
  const jo = est.jugadores[0], x = 14, y = 14;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) llano(est, x + dx, y + dy);
  limpiar(est); est.activo = 0;
  const h1 = poner(est, 0, "guerrero", x, y), h2 = poner(est, 0, "guerrero", x + 1, y), solo = poner(est, 0, "guerrero", x - 3, y - 3);
  FM.aplicar(est, { t: "terminar" }); FM.aplicar(est, { t: "terminar" });
  ok(est.activo === 0 && h1.pm === FM.ef(est, h1).mov + 1 && h2.pm === FM.ef(est, h2).mov + 1 && solo.pm === FM.ef(est, solo).mov, "la marcha de la horda no da +1 de movimiento solo a los que van juntos");
  // Campamento: lo levanta el chamán, cura, entrena básicas una vez por turno y un enemigo lo arrasa
  limpiar(est); est.activo = 0; rico(jo);
  jo.sabEf = Object.assign({}, jo.sabEf, { campamento: true });
  const ch = poner(est, 0, "chaman", x, y);
  ok(!!FM.razonCampamento(est, 0, poner(est, 0, "guerrero", x - 2, y), x - 2, y + 1), "un guerrero puede levantar campamentos");
  const rcp = FM.aplicar(est, { t: "habilidad", id: "campamento", uid: ch.uid, x: x + 1, y });
  ok(rcp.ok, `el chamán no levanta el campamento: ${rcp.error || ""}`);
  const cp = (est.campamentos || [])[0];
  ok(cp && cp.x === x + 1, "no queda el campamento");
  const r1 = FM.aplicar(est, { t: "reclutar", campamento: cp.id, clase: "guerrero" });
  ok(r1.ok && FM.unidadEn(est, cp.x, cp.y), `no se entrena en el campamento: ${r1.error || ""}`);
  ok(!FM.aplicar(est, { t: "reclutar", campamento: cp.id, clase: "guerrero" }).ok, "el campamento entrena dos veces en un turno");
  ok(!FM.aplicar(est, { t: "reclutar", campamento: cp.id, clase: "berserker" }).ok, "en el campamento se entrena algo que no es básico");
  const herido = FM.unidadEn(est, cp.x, cp.y); herido.hp = 2;
  FM.aplicar(est, { t: "terminar" }); FM.aplicar(est, { t: "terminar" });
  ok(herido.hp >= 5, `el campamento no cura (vida ${herido.hp})`);
  est.activo = 1;
  delete est.unidades[herido.uid];
  const enemigo = poner(est, 1, "jinete", cp.x + 2, cp.y); enemigo.pm = 5;
  FM.aplicar(est, { t: "mover", uid: enemigo.uid, x: cp.x, y: cp.y });
  ok(!(est.campamentos || []).length, "un enemigo que pisa el campamento no lo arrasa");
}

// --- Los otros seis ejércitos: lo que tienen de serie y lo que aprenden ---
const Sd = require("../js/fractura-soldados.js");
const zona = (est, x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { llano(est, x + dx, y + dy); const c = est.casillas[y + dy][x + dx]; if (c.t === "bosque") c.t = "llanura"; } };
const sinEstructura = (est, x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (est.casillas[y + dy][x + dx].est) return false; return true; };
const sitioLimpio = est => { for (let y = 3; y < est.alto - 3; y++) for (let x = 3; x < est.ancho - 3; x++) if (sinEstructura(est, x, y, 2)) return { x, y }; return null; };
// Hijos del Acero: Marcar la presa y Trampas
{
  const est = guerra(["hijos-del-acero", "okran"]);
  limpiar(est); est.activo = 0;
  const jh = est.jugadores[0], { x, y } = sitioLimpio(est);
  zona(est, x, y, 2);
  const b = poner(est, 0, "ballestero", x - 2, y), g = poner(est, 0, "guerrero", x, y + 1), e = poner(est, 1, "guerrero", x + 1, y + 1);
  FM.actualizarVision(est, 0);
  const sin = FM.calcularDano(est, g, e);
  const r = FM.aplicar(est, { t: "habilidad", id: "marcar", uid: b.uid, x: e.x, y: e.y });
  ok(r.ok, `el ballestero no marca la presa: ${r.error || ""}`);
  ok(FM.calcularDano(est, g, e) === sin + 1, "contra la presa marcada no se pega 1 más");
  est.vision[0].fill(0);
  ok(FM.veUnidad(est, 0, e), "la presa marcada no se ve en la niebla");
  ok(!FM.aplicar(est, { t: "habilidad", id: "marcar", uid: b.uid, x: e.x, y: e.y }).ok, "se puede marcar otra vez sin esperar");
  ok(!FM.aplicar(est, { t: "habilidad", id: "marcar", uid: g.uid, x: e.x, y: e.y }).ok, "un guerrero puede marcar presas");
  est.turno += 2;
  ok(!FM.marcadaPara(est, 0, e), "la marca no se acaba a los 2 turnos");
  est.turno -= 2;
  // Trampas: solo con el saber, en un bosque libre de al lado
  limpiar(est); rico(jh);
  const c = poner(est, 0, "cazador", x, y);
  est.casillas[y - 1][x].t = "bosque";
  ok(!FM.aplicar(est, { t: "habilidad", id: "trampa", uid: c.uid, x, y: y - 1 }).ok, "se ponen trampas sin aprender Trampas");
  jh.sabEf = Object.assign({}, jh.sabEf, { trampas: true });
  ok(!FM.aplicar(est, { t: "habilidad", id: "trampa", uid: c.uid, x: x + 1, y }).ok, "se pone una trampa fuera del bosque");
  const rt = FM.aplicar(est, { t: "habilidad", id: "trampa", uid: c.uid, x, y: y - 1 });
  ok(rt.ok && est.trampas.length === 1, `el cazador no pone la trampa: ${rt.error || ""}`);
  est.activo = 1;
  const presa = poner(est, 1, "jinete", x - 2, y - 2); presa.pm = 6;
  const hp0 = presa.hp;
  FM.aplicar(est, { t: "mover", uid: presa.uid, x, y: y - 1 });
  ok(presa.x === x && presa.y === y - 1 && presa.pm === 0 && presa.hp === hp0 - 2 && !est.trampas.length, "la trampa no para y hiere al que la pisa");
}
// Seosan: Postura y Camino de la espada
{
  const est = guerra(["seosan", "okran"]);
  limpiar(est); est.activo = 0;
  const js = est.jugadores[0], { x, y } = sitioLimpio(est);
  zona(est, x, y, 2);
  const s1 = poner(est, 0, "guerrero", x, y), andan = poner(est, 0, "guerrero", x - 2, y - 2), atk = poner(est, 1, "guerrero", x + 1, y);
  const def0 = FM.ef(est, s1).def;
  FM.aplicar(est, { t: "mover", uid: andan.uid, x: x - 2, y: y - 1 });
  FM.aplicar(est, { t: "terminar" });
  ok(s1.efectos.postura && FM.ef(est, s1).def === def0 + 2, "quien no se mueve no gana +2 de defensa");
  ok(!andan.efectos.postura, "quien se movió también queda en guardia");
  const ra = FM.aplicar(est, { t: "atacar", uid: atk.uid, x: s1.x, y: s1.y });
  const golpes = (ra.ev || []).filter(v => v.k === "golpe");
  ok(golpes.length >= 1 && golpes[0].de === s1.uid && golpes.filter(v => v.de === s1.uid).length === 1, "en guardia no golpea primero (o golpea dos veces)");
  FM.aplicar(est, { t: "terminar" });
  ok(!s1.efectos.postura, "la guardia no se acaba al empezar su turno");
  // Camino de la espada: un duelo ganado vale 2 victorias
  limpiar(est); est.activo = 0;
  const d1 = poner(est, 0, "guerrero", x, y), solo = poner(est, 1, "guerrero", x + 1, y);
  solo.hp = 1; FM.aplicar(est, { t: "atacar", uid: d1.uid, x: solo.x, y: solo.y });
  const v1 = d1.vicG;
  js.sabEf = Object.assign({}, js.sabEf, { caminoEspada: true });
  const d2 = poner(est, 0, "guerrero", x, y + 2), solo2 = poner(est, 1, "guerrero", x + 1, y + 2);
  solo2.hp = 1; d2.atacado = false; FM.aplicar(est, { t: "atacar", uid: d2.uid, x: solo2.x, y: solo2.y });
  ok(v1 === 1 && d2.vicG === 2, `Camino de la espada no da una victoria más (${v1} y ${d2.vicG})`);
}
// Mravec: Enjambre y Túneles
{
  const est = guerra(["mravec", "okran"]);
  limpiar(est); est.activo = 0;
  const jm = est.jugadores[0], { x, y } = sitioLimpio(est);
  zona(est, x, y, 2);
  const a = poner(est, 0, "guerrero", x, y), d0 = FM.ef(est, a).def;
  poner(est, 0, "picaro", x + 1, y);
  ok(FM.ef(est, a).def === d0, "Enjambre da defensa con un solo aliado al lado");
  poner(est, 0, "quimera", x - 1, y);
  ok(FM.ef(est, a).def === d0 + 1, "Enjambre no da +1 de defensa con dos aliados al lado");
  // Túneles: entre dos casillas del territorio propio
  limpiar(est); rico(jm);
  const cap = FM.ciudadesDe(est, 0).find(c => c.capital);
  const boca = (bx, by) => FM.dentro(est, bx, by) && FM.enTerritorio(est, 0, bx, by) && est.casillas[by][bx].t !== "agua" && D.TERRENOS[est.casillas[by][bx].t].mov > 0 && !est.casillas[by][bx].est;
  let A = null, B = null;
  for (let dy = -2; dy <= 2 && !A; dy++) for (let dx = -2; dx <= 2 && !A; dx++) if ((dx || dy) && boca(cap.x + dx, cap.y + dy)) A = { x: cap.x + dx, y: cap.y + dy };
  for (let r = 6; r >= 3 && !B && A; r--) for (let dy = -r; dy <= r && !B; dy++) for (let dx = -r; dx <= r && !B; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && boca(A.x + dx, A.y + dy)) B = { x: A.x + dx, y: A.y + dy };
  ok(A && B, "no hay sitio para probar los túneles");
  if (A && B) {
    const z = poner(est, 0, "zapadora", A.x, A.y);
    ok(!FM.aplicar(est, { t: "habilidad", id: "tunel", uid: z.uid, x: B.x, y: B.y }).ok, "se cava un túnel sin aprender Túneles");
    jm.sabEf = Object.assign({}, jm.sabEf, { tuneles: true });
    const rt = FM.aplicar(est, { t: "habilidad", id: "tunel", uid: z.uid, x: B.x, y: B.y });
    ok(rt.ok && est.tuneles.length === 1, `la zapadora no cava el túnel: ${rt.error || ""}`);
    delete est.unidades[z.uid];
    const w = poner(est, 0, "guerrero", A.x, A.y);
    const nodo = FM.alcanzables(est, w).destinos.get(`${B.x},${B.y}`);
    ok(nodo && nodo.c === 1, `cruzar el túnel no cuesta 1 (${nodo ? nodo.c : "no llega"})`);
    // Un enemigo que pisa una boca lo hunde
    est.activo = 1;
    let cerca = null;
    for (let dy = -1; dy <= 1 && !cerca; dy++) for (let dx = -1; dx <= 1 && !cerca; dx++) { const qx = B.x + dx, qy = B.y + dy; if ((dx || dy) && FM.dentro(est, qx, qy) && !FM.unidadEn(est, qx, qy) && D.TERRENOS[est.casillas[qy][qx].t].mov > 0 && est.casillas[qy][qx].t !== "agua" && !est.casillas[qy][qx].est) cerca = { x: qx, y: qy }; }
    if (cerca) {
      const e = poner(est, 1, "guerrero", cerca.x, cerca.y); e.pm = 6;
      FM.aplicar(est, { t: "mover", uid: e.uid, x: B.x, y: B.y });
      ok(e.x === B.x && !est.tuneles.length, "un enemigo que pisa la boca no hunde el túnel");
    }
  }
}
// Brurland: Leva feudal y Levas del Reino
{
  const est = guerra(["caballeros-del-reino", "okran"]);
  limpiar(est); est.activo = 0;
  const jb = est.jugadores[0];
  const l0 = FM.limiteTropas(est, 0), n0 = FM.fortalezasDe(est, 0).length;
  ok(est.fortalezas.length > 0, "el mapa no tiene fortalezas para probar");
  const fi = est.fortalezasDueno.findIndex(d => d !== 0);
  if (fi >= 0) {
    est.fortalezasDueno[fi] = 0;
    ok(FM.limiteTropas(est, 0) === l0 + 1 && FM.fortalezasDe(est, 0).length === n0 + 1, "una fortaleza tomada no sube el límite en 1");
    jb.sabEf = Object.assign({}, jb.sabEf, { levaFortaleza: true });
    for (let i = 0; i < 12; i++) FM.aplicar(est, { t: "terminar" });
    const n = FM.fortalezasDe(est, 0).length, mil = FM.unidadesDe(est, 0).filter(u => u.clase === "guerrero").length;
    ok(mil === n, `las fortalezas no dan un miliciano cada 5 turnos (${mil} milicianos, ${n} fortalezas)`);
  }
}
// Compañía Dorada: Rescates y Contratos
{
  const est = guerra(["compania-dorada", "okran"]);
  limpiar(est); est.activo = 0;
  const jd = est.jugadores[0], jo = est.jugadores[1], { x, y } = sitioLimpio(est);
  zona(est, x, y, 2);
  const a = poner(est, 0, "guerrero", x, y);
  const sol = Sd.crearSoldado({ s: 7 }, { clase: "guerrero", cultura: D.FACCIONES.okran.cultura, origen: "criatura", anio: 1 });
  sol.capitan = true;
  const e = FM.nuevaUnidad(est, 1, "guerrero", x + 1, y, sol); e.hp = 1; e.voluntadUsada = true;
  jo.recursos.oro = 3; jo.recursos.comida = 50;
  const oro0 = jd.recursos.oro, com0 = jd.recursos.comida;
  FM.aplicar(est, { t: "atacar", uid: a.uid, x: e.x, y: e.y });
  ok(!est.unidades[e.uid] && jo.recursos.oro === 0 && jo.recursos.comida === 47 && jd.recursos.oro === oro0 + 3 && jd.recursos.comida === com0 + 3, "el rescate del capitán no se paga (3 de oro y el resto en comida)");
  // Contratos: comprar una ciudad sin dueño con una tropa cerca
  const neutra = Object.values(est.ciudades).find(c => c.dueno === null);
  ok(!!neutra, "no hay ciudad neutral para probar");
  if (neutra) {
    limpiar(est); jd.recursos.oro = 999;
    let p = null;
    for (let dy = -3; dy <= 3 && !p; dy++) for (let dx = -3; dx <= 3 && !p; dx++) { const qx = neutra.x + dx, qy = neutra.y + dy; if (Math.max(Math.abs(dx), Math.abs(dy)) >= 2 && FM.dentro(est, qx, qy) && !est.casillas[qy][qx].est) p = { x: qx, y: qy }; }
    const t = poner(est, 0, "guerrero", p.x, p.y);
    ok(!FM.aplicar(est, { t: "habilidad", id: "contrato", uid: t.uid, x: neutra.x, y: neutra.y }).ok, "se compra una ciudad sin aprender Contratos");
    jd.sabEf = Object.assign({}, jd.sabEf, { contratos: true });
    const precio = FM.precioContrato(neutra);
    const rc = FM.aplicar(est, { t: "habilidad", id: "contrato", uid: t.uid, x: neutra.x, y: neutra.y });
    ok(rc.ok && neutra.dueno === 0 && jd.recursos.oro === 999 - precio, `no se compra la ciudad neutral: ${rc.error || ""}`);
    const otra = Object.values(est.ciudades).find(c => c.dueno === null);
    if (otra) ok(!!FM.razonContrato(est, 0, t, otra.x, otra.y), "se compran dos ciudades en un turno");
  }
}
// Balutia: Testudo y Castra
{
  const est = guerra(["balutia", "okran"]);
  limpiar(est); est.activo = 1;
  const jb = est.jugadores[0], { x, y } = sitioLimpio(est);
  zona(est, x, y, 2);
  const l = poner(est, 0, "guerrero", x, y);
  poner(est, 0, "guerrero", x - 1, y); poner(est, 0, "guerrero", x, y - 1);
  const arq = poner(est, 1, "ballestero", x + 2, y); arq.bonoDesafio = 8;
  const mel = poner(est, 1, "guerrero", x + 1, y + 1); mel.bonoDesafio = 8;
  const facB = D.FACCIONES.balutia, tt = facB.mods.testudo;
  const conT = FM.calcularDano(est, arq, l), conTm = FM.calcularDano(est, mel, l);
  delete facB.mods.testudo;
  const sinT = FM.calcularDano(est, arq, l), sinTm = FM.calcularDano(est, mel, l);
  facB.mods.testudo = tt;
  ok(sinT - conT === 1, `Testudo no frena los disparos (${sinT} → ${conT})`);
  ok(sinTm === conTm, "Testudo también frena el cuerpo a cuerpo");
  // Castra: la ciudad tomada queda fortificada 3 turnos
  const neutra = Object.values(est.ciudades).find(c => c.dueno === null);
  if (neutra) {
    jb.sabEf = Object.assign({}, jb.sabEf, { castra: true });
    FM.capturarCiudad(est, l, neutra);
    ok(neutra.dueno === 0 && neutra.obras.fortificar === est.turno + 2, "Castra no fortifica la ciudad conquistada");
  }
}

console.log(`${hechas} comprobaciones, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
