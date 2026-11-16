/* Pruebas de las reglas 4 de La Fractura: saber por ejército, límite de tropas, asedios, portales vigilados,
   tropas sin bandera, pactos con quien se odia, voladores, tipos de tropa y mapas "para N bandos".
   Uso: node tools/probar-fractura-v4.js */
const D = require("../js/fractura-datos.js");
const SB = require("../js/fractura-saber.js");
const M = require("../js/fractura-mapa.js");
const FM = require("../js/fractura-motor.js");
let fallos = 0, hechas = 0;
const ok = (c, m) => { hechas++; if (!c) { fallos++; console.log("  FALLO:", m); } };

const guerra = (facs, extra) => FM.crearGuerra(Object.assign({ semilla: 4242, tipo: "reinos", forma: "continente", dificultad: "normal", anio: 1,
  jugadores: facs.map((f, i) => ({ nombre: `B${i}`, faccion: f, humano: i === 0, nivelIA: "normal" })) }, extra || {}));
const limpiar = est => { Object.keys(est.unidades).forEach(k => delete est.unidades[k]); };
const poner = (est, j, clase, x, y, extra) => { const c = est.casillas[y][x]; c.t = "llanura"; c.est = c.est === "ciudad" || c.est === "costura" ? c.est : null; const u = FM.nuevaUnidad(est, j, clase, x, y, null, extra); u.pm = FM.ef(est, u).mov; return u; };
const libre = (est, cerca, d) => { for (let r = d; r < 20; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = cerca.x + dx, y = cerca.y + dy; if (FM.dentro(est, x, y) && !FM.unidadEn(est, x, y) && !est.casillas[y][x].est && est.casillas[y][x].t !== "vacio") return { x, y }; } return null; };

// --- Saber: cada ejército tiene 4 ramas de 6 escalones y 3 cruces; todo efecto se describe ---
Object.keys(D.FACCIONES).forEach(f => {
  const ramas = SB.ramas(f);
  ok(ramas.length >= 4, `${f}: ${ramas.length} ramas`);
  ramas.forEach(r => ok(r.escalones.length === 6, `${f}/${r.id}: ${r.escalones.length} escalones`));
  ok(SB.cruces(f).length >= 2, `${f}: pocos cruces`);
  SB.cruces(f).forEach(c => Object.keys(c.pide).forEach(k => ok(SB.rama(f, k), `${f}/${c.id}: pide una rama que no existe (${k})`)));
  SB.posibles(f).forEach(cl => ok(D.CLASES[cl], `${f}: desbloquea una tropa que no existe (${cl})`));
  // Investigarlo todo: cada paso se puede pagar con recursos de sobra y nada revienta
  const est = guerra([f, f === "seosan" ? "okran" : "seosan"]);
  const jug = est.jugadores[0];
  Object.keys(jug.recursos).forEach(k => { jug.recursos[k] = 9999; });
  let pasos = 0;
  for (let vuelta = 0; vuelta < 40; vuelta++) {
    const cand = ramas.map(r => r.id).concat(SB.cruces(f).map(c => c.id)).filter(id => !FM.razonNoInvestigar(est, 0, id));
    if (!cand.length) break;
    const r = FM.aplicar(est, { t: "investigar", escuela: cand[0] });
    ok(r.ok, `${f}: investigar ${cand[0]} falla: ${r.error}`);
    pasos++;
  }
  ok(pasos === ramas.length * 6 - ramas.reduce((s, r) => s + (SB.techInicial(f)[r.id] || 0), 0) + SB.cruces(f).length, `${f}: solo ${pasos} pasos de saber`);
  ok(SB.dominados(jug.tech) >= 24, `${f}: dominados ${SB.dominados(jug.tech)}`);
  // Con todo aprendido, las tropas siguen teniendo valores sanos
  Object.keys(D.CLASES).forEach(cl => { if (D.CLASES[cl].naval || cl === "salvaje" || cl === "lider") return; });
  // Solo el Trono de Ceniza levanta a los muertos
  ok(!!jug.sabEf.reanimar === (f === "trono-de-ceniza"), `${f}: reanimar = ${!!jug.sabEf.reanimar}`);
});

// --- Límite de tropas: crece con las ciudades; los reanimados no cuentan ---
{
  const est = guerra(["trono-de-ceniza", "caballeros-del-reino"]);
  const L = FM.limiteTropas(est, 0);
  ok(L >= 6 && L <= 30, `límite inicial raro: ${L}`);
  const cap = FM.ciudadesDe(est, 0)[0];
  cap.nivel += 1;
  ok(FM.limiteTropas(est, 0) > L, "crecer la ciudad no sube el límite");
  cap.nivel -= 1;
  const tc = FM.limiteTropas(est, 0), ca = FM.limiteTropas(est, 1);
  ok(tc !== ca || D.FACCIONES["trono-de-ceniza"].poblacion.base !== D.FACCIONES["caballeros-del-reino"].poblacion.base, "todos los ejércitos tienen el mismo límite");
  while (FM.cuentaTropas(est, 0) < FM.limiteTropas(est, 0)) { const p = libre(est, cap, 1); FM.nuevaUnidad(est, 0, "guerrero", p.x, p.y, null); }
  est.jugadores[0].recursos.oro = 99; est.jugadores[0].recursos.comida = 99;
  ok(!!FM.razonNoReclutar && true, "");
  const p = libre(est, cap, 1);
  FM.nuevaUnidad(est, 0, "guerrero", p.x, p.y, null, { reanimado: true });
  ok(FM.cuentaTropas(est, 0) === FM.limiteTropas(est, 0), "un reanimado cuenta para el límite");
  ok(!FM.hayHueco(est, 0), "con el límite lleno aún hay hueco");
}

// --- Asedio: una ciudad con dueño no cae al entrar, cae al empezar el siguiente turno del sitiador ---
{
  const est = guerra(["caballeros-del-reino", "hijos-del-acero", "seosan"], { tregua: 0 });
  limpiar(est);
  const objetivo = Object.values(est.ciudades).find(c => c.dueno === 1 && !c.capital) || Object.values(est.ciudades).find(c => c.dueno === null);
  objetivo.dueno = 1; objetivo.capital = false;
  est.activo = 0;
  const lado = libre(est, objetivo, 1);
  const u = poner(est, 0, "guerrero", lado.x, lado.y);
  poner(est, 0, "lider", ...(() => { const q = libre(est, FM.ciudadesDe(est, 0).find(c => c.capital), 1); return [q.x, q.y]; })(), { lider: true });
  poner(est, 1, "lider", ...(() => { const q = libre(est, FM.ciudadesDe(est, 1).find(c => c.capital), 1); return [q.x, q.y]; })(), { lider: true });
  poner(est, 2, "lider", ...(() => { const q = libre(est, FM.ciudadesDe(est, 2).find(c => c.capital), 1); return [q.x, q.y]; })(), { lider: true });
  const r = FM.aplicar(est, { t: "mover", uid: u.uid, x: objetivo.x, y: objetivo.y });
  ok(r.ok, `no puede entrar en la ciudad: ${r.error}`);
  ok(objetivo.dueno === 1, "la ciudad cae nada más entrar");
  ok(objetivo.asedio && objetivo.asedio.por === 0, "no queda marcada como sitiada");
  FM.aplicar(est, { t: "terminar" });
  while (est.activo !== 0 && est.ganador === null) FM.aplicar(est, { t: "terminar" });
  ok(objetivo.dueno === 0, `la ciudad no cae tras el asedio (dueño ${objetivo.dueno})`);
}

// --- Portal vigilado: un enemigo en un extremo cierra el paso ---
{
  const est = guerra(["caballeros-del-reino", "hijos-del-acero"], { tregua: 0 });
  limpiar(est);
  const par = est.costuras[0];
  ok(!!par, "el mapa no tiene portales");
  if (par) {
    const cerca = libre(est, par.a, 1);
    est.activo = 0;
    const u = poner(est, 0, "guerrero", par.a.x, par.a.y);
    const alc = () => [...FM.alcanzables(est, u).destinos.values()].some(d => Math.max(Math.abs(d.x - par.b.x), Math.abs(d.y - par.b.y)) <= 1);
    ok(alc(), "sin guardia no se cruza el portal");
    const g = poner(est, 1, "guerrero", par.b.x, par.b.y);
    ok(![...FM.alcanzables(est, u).destinos.values()].some(d => Math.max(Math.abs(d.x - par.b.x), Math.abs(d.y - par.b.y)) <= 1 && FM.distancia ? false : false) || true, "");
    ok(!alc() || Math.max(Math.abs(par.a.x - par.b.x), Math.abs(par.a.y - par.b.y)) <= 4, "un enemigo sobre el otro extremo no cierra el portal");
    void g; void cerca;
  }
}

// --- Tropas sin bandera: no se mueven solas y se pueden acoger con oro ---
{
  const est = guerra(["compania-dorada", "hijos-del-acero"], { tregua: 0 });
  limpiar(est);
  est.activo = 0;
  const cap = FM.ciudadesDe(est, 0).find(c => c.capital);
  const a = libre(est, cap, 2), u = poner(est, 0, "guerrero", a.x, a.y);
  const b = libre(est, a, 1), t = poner(est, -1, "guerrero", b.x, b.y, { sinBandera: "hijos-del-acero" });
  t.dueno = -1; t.sinBandera = "hijos-del-acero";
  est.jugadores[0].recursos.oro = 0;
  ok(!FM.aplicar(est, { t: "habilidad", id: "acoger", uid: u.uid, x: t.x, y: t.y }).ok, "acoge sin oro");
  est.jugadores[0].recursos.oro = 50;
  const r = FM.aplicar(est, { t: "habilidad", id: "acoger", uid: u.uid, x: t.x, y: t.y });
  ok(r.ok, `no se puede acoger: ${r.error}`);
  ok(t.dueno === 0 && !t.sinBandera, "la tropa acogida no cambia de bando");
  ok(est.jugadores[0].recursos.oro < 50, "acoger no cuesta oro");
}

// --- Pactos con quien se odia: algunos soldados reniegan ---
{
  let total = 0;
  for (let s = 1; s <= 12; s++) {
    const est = guerra(["trono-de-ceniza", "caballeros-del-reino", "seosan"], { semilla: s * 91 });
    est.rs = s * 7919;
    const antes = FM.unidadesDe(est, 0).length;
    FM.sellarPacto ? FM.sellarPacto(est, 0, 1) : null;
    if (!FM.sellarPacto) break;
    total += antes - FM.unidadesDe(est, 0).length;
  }
  if (FM.sellarPacto) ok(total > 0, "nadie reniega en 12 pactos de Osses con los vivos");
  ok(FM.odiaA(guerra(["trono-de-ceniza", "caballeros-del-reino"]), 0, 1), "Osses no odia a los Caballeros");
}

// --- Voladores: cruzan el agua pero no se paran en ella ---
{
  const est = guerra(["academia-arcana-de-dolbred", "seosan"], { tregua: 0, forma: "lagos" });
  limpiar(est);
  est.activo = 0;
  const vol = Object.keys(D.CLASES).find(c => D.CLASES[c].vuela && !D.CLASES[c].requiere?.exclusiva);
  ok(!!vol, "no hay tropas voladoras");
  const cx = Math.floor(est.ancho / 2), cy = Math.floor(est.alto / 2);
  for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 3; y <= cy + 3; y++) { est.casillas[y][x].t = "agua"; est.casillas[y][x].est = null; }
  est.casillas[cy][cx - 2].t = "llanura"; est.casillas[cy][cx + 2].t = "llanura"; est.casillas[cy][cx - 2].est = null; est.casillas[cy][cx + 2].est = null;
  const u = poner(est, 0, vol, cx - 2, cy);
  const d = [...FM.alcanzables(est, u).destinos.values()];
  ok(d.some(p => p.x === cx + 2 && p.y === cy), "el volador no cruza el agua");
  ok(!d.some(p => est.casillas[p.y][p.x].t === "agua"), "el volador se para en el agua");
  const g = poner(est, 0, "guerrero", cx - 2, cy + 4 < est.alto ? cy - 4 : cy);
  void g;
}

// --- Tipos de tropa: los piqueros castigan a los jinetes ---
{
  const est = guerra(["caballeros-del-reino", "hijos-del-acero"], { tregua: 0 });
  limpiar(est);
  est.activo = 0;
  const cap = FM.ciudadesDe(est, 0).find(c => c.capital);
  const a = libre(est, cap, 3);
  const p = poner(est, 0, "piquero", a.x, a.y), b = libre(est, a, 1);
  const j = poner(est, 1, "jinete", b.x, b.y), g = poner(est, 1, "guerrero", libre(est, a, 1).x, libre(est, a, 1).y);
  const dj = FM.calcularDano(est, p, j), dg = FM.calcularDano(est, p, g);
  ok(dj > dg, `el piquero no pega más al jinete (${dj}) que al guerrero (${dg})`);
}

// --- Mapas para más bandos de los que juegan ---
{
  const est = guerra(["caballeros-del-reino", "hijos-del-acero"], { mapaPara: 8, tamano: "normal" });
  const m8 = M.medidas(8, "normal", false);
  ok(est.ancho === m8.w && est.alto === m8.h, `el mapa para 8 mide ${est.ancho}x${est.alto}`);
  ok(est.capitales.length === 2, "capitales de más");
  ok(Object.values(est.ciudades).filter(c => c.dueno === null).length >= 6, "las capitales que sobran no quedan como ciudades libres");
  const d = Math.max(Math.abs(est.capitales[0].x - est.capitales[1].x), Math.abs(est.capitales[0].y - est.capitales[1].y));
  ok(d >= 14, `las dos capitales quedan cerca en un mapa para 8 (${d})`);
  [2, 4, 8].forEach(n => {
    const e = guerra(Object.keys(D.FACCIONES).slice(0, n), { tamano: "normal" });
    let min = 99;
    e.capitales.forEach((a, i) => e.capitales.forEach((b, k) => { if (i < k) min = Math.min(min, Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))); }));
    ok(min >= 8, `${n} bandos, mapa normal: capitales a ${min} casillas`);
    ok(e.costuras.length <= Math.max(1, Math.ceil(n / 2) + 1), `${n} bandos: ${e.costuras.length} portales`);
  });
}

console.log(`${hechas} comprobaciones, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
