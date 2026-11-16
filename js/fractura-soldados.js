/* =============================================================================
   LA FRACTURA: soldados. Cada soldado es un individuo con nombre, casa, características ocultas,
   victorias, rango, equipo, familia y apodo. Este archivo crea soldados y calcula lo que sale de
   sus características; lo que les pasa entre guerras (ascensos, hijos, muerte) está en
   fractura-campana.js.
   Se usa igual en el navegador y en Node. Depende de fractura-datos.js.
============================================================================= */
(function (raiz) {
  const D = raiz.FRACTURA_DATOS || (typeof require !== "undefined" ? require("./fractura-datos.js") : null);
  const { CLASES, RANGOS, NOMBRES, ORIGENES, APODOS } = D;
  const STATS = ["FUE", "CON", "VEL", "INT", "VOL", "MAG"];

  /* Generador pseudoaleatorio con semilla (mulberry32). El estado vive en un objeto { s } para poder guardarlo. */
  function rnd(r) {
    r.s = (r.s + 0x6D2B79F5) >>> 0;
    let t = r.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const ent = (r, n) => Math.floor(rnd(r) * n);
  const elegir = (r, lista) => lista[ent(r, lista.length)];
  const limitar = (v, a, b) => Math.max(a, Math.min(b, v));

  function idNuevo(r) {
    let s = "s";
    for (let i = 0; i < 7; i++) s += "abcdefghijklmnopqrstuvwxyz0123456789"[ent(r, 36)];
    return s;
  }

  function perfilDe(clase, origen) {
    const base = Object.assign({}, CLASES[clase].perfil);
    const mod = (ORIGENES[origen] || {}).stat || {};
    Object.keys(mod).forEach(k => { base[k] = limitar(base[k] + mod[k], 1, 10); });
    return base;
  }

  /* Características de un recluta: la media de su clase con algo de variación */
  function caracteristicas(r, clase, origen) {
    const p = perfilDe(clase, origen), out = {};
    STATS.forEach(k => { out[k] = limitar(Math.round(p[k] + (rnd(r) + rnd(r) - 1) * 2.2), 1, 10); });
    return out;
  }

  /* Características de un hijo: 60 % de su clase, 20 % del padre o madre y 20 % de azar */
  function caracteristicasHijo(r, clase, origen, padre) {
    const p = perfilDe(clase, origen), out = {};
    STATS.forEach(k => {
      out[k] = limitar(Math.round(0.6 * p[k] + 0.2 * (padre ? padre.stats[k] : p[k]) + 0.2 * (1 + rnd(r) * 9)), 1, 10);
    });
    return out;
  }

  function nombreNuevo(r, cultura, sexo) {
    const pool = NOMBRES[cultura] || NOMBRES.comun;
    return elegir(r, pool[sexo === "f" ? "f" : "m"]);
  }
  const casaNueva = (r, cultura) => elegir(r, (NOMBRES[cultura] || NOMBRES.comun).casas);

  /* opts: { clase, cultura, origen, anio, edad, sexo, casa, padre, nacimiento, faccion } */
  function crearSoldado(r, opts) {
    const clase = opts.clase;
    const cultura = opts.cultura || "comun";
    const origen = opts.origen || "voluntario";
    const sexo = opts.sexo || (rnd(r) < 0.5 ? "m" : "f");
    const edad = opts.edad === undefined ? 17 + ent(r, 10) : opts.edad;
    const anio = opts.anio === undefined ? 1 : opts.anio;
    const padre = opts.padre || null;
    return {
      id: idNuevo(r),
      nombre: nombreNuevo(r, cultura, sexo),
      apodo: null,
      casa: opts.casa || casaNueva(r, cultura),
      sexo, clase, origen, cultura,
      stats: padre ? caracteristicasHijo(r, clase, origen, padre) : caracteristicas(r, clase, origen),
      nacimiento: opts.nacimiento === undefined ? anio - edad : opts.nacimiento,
      ingreso: anio,
      victorias: 0, bajas: 0, oficiales: 0, guerras: 0, ganadas: 0, cicatrices: 0,
      spec: null, ascensoPendiente: false,
      equipo: {}, capitan: false, compania: null,
      estado: "activo",
      padre: padre ? padre.id : null, madre: opts.madreId || null, madreNombre: opts.madreNombre || null,
      pareja: null, parejaNombre: null, hijos: [],
      companeros: {}, luto: null,
      hitos: [], muerte: null, renacido: 0
    };
  }

  const rangoDe = victorias => {
    let rg = RANGOS[0];
    RANGOS.forEach(x => { if (victorias >= x.desde) rg = x; });
    return rg;
  };
  const rangoIndice = victorias => RANGOS.indexOf(rangoDe(victorias));
  const edadDe = (s, anio) => Math.max(0, anio - s.nacimiento);
  const aniosDeServicio = (s, anio) => Math.max(0, anio - s.ingreso);
  const nombreCompleto = s => `${s.nombre} ${s.casa}`;
  const nombreConApodo = s => `${s.nombre} ${s.casa}${s.apodo ? ` «${s.apodo}»` : ""}`;

  /* Modificadores que salen de las características */
  const modHp = s => Math.floor((s.stats.CON - 5) / 2);
  const modAtq = (s, clase) => Math.floor((s.stats[CLASES[clase].atqEstat] - 5) / 3);
  const modMov = s => (s.stats.VEL >= 9 ? 1 : s.stats.VEL <= 2 ? -1 : 0);
  /* Probabilidad de quedar con 1 de vida en vez de morir (una vez por guerra) */
  const probVoluntad = s => limitar((s.stats.VOL - 4) * 0.07, 0, 0.5);

  /* usados: los apodos que ya lleva alguien del mismo ejército, para no repetirlos */
  function apodoPara(r, s, tipo, usados) {
    const lista = APODOS[tipo];
    if (!lista) return null;
    const libres = usados ? lista.filter(par => !usados.has(par[0]) && !usados.has(par[1])) : lista;
    if (!libres.length) return null;
    return elegir(r, libres)[s.sexo === "f" ? 1 : 0];
  }

  /* Manías: lo que se le nota a un soldado por cómo se le ha usado en las guerras (sale de s.uso). nombreFac(id) da el nombre de un ejército */
  const TERRENO_MANIA = { bosque: "Pelea casi siempre desde el bosque.", montana: "Busca la altura de las montañas para pelear.", desierto: "Se mueve por el desierto como por su casa.",
    agua: "Ha peleado mucho desde el agua.", magica: "Le atraen las zonas mágicas.", huesos: "Pelea a menudo entre los campos de huesos." };
  function manias(s, nombreFac) {
    const u = s.uso || {}, out = [], g = u.golpes || 0, guerras = Math.max(1, s.guerras || 0);
    if (g >= 6 && (u.lejos || 0) >= g * 0.7) out.push("Prefiere pelear de lejos.");
    else if (g >= 6 && (u.cerca || 0) >= g * 0.85) out.push("Siempre busca el cuerpo a cuerpo.");
    const ters = Object.keys(u).filter(k => k.startsWith("t:")), totT = ters.reduce((a, k) => a + u[k], 0);
    const topT = ters.sort((a, b) => u[b] - u[a])[0];
    if (topT && totT >= 5 && u[topT] >= totT * 0.5 && TERRENO_MANIA[topT.slice(2)]) out.push(TERRENO_MANIA[topT.slice(2)]);
    if ((u.borde || 0) >= 2) out.push(`Ha estado al borde de la muerte ${u.borde} veces y sigue en pie.`);
    const facs = Object.keys(u).filter(k => k.startsWith("f:")).sort((a, b) => u[b] - u[a]);
    if (facs.length && u[facs[0]] >= 3 && nombreFac) out.push(`Le tiene ganas a ${nombreFac(facs[0].slice(2))}: lleva ${u[facs[0]]} bajas suyas.`);
    if ((u.monstruos || 0) >= 3) out.push(`Ha cazado ${u.monstruos} monstruos.`);
    if ((u.jefes || 0) >= 2) out.push("Va a por los jefes del enemigo.");
    if ((u.solos || 0) >= 6) out.push("Remata a los que se quedan solos.");
    if ((u.ciudades || 0) >= 2) out.push("Le gusta entrar el primero en las ciudades.");
    if ((u.ruinas || 0) >= 2) out.push("Registra todas las ruinas que encuentra.");
    if ((u.pasos || 0) / guerras >= 20) out.push("No se está quieto: recorre más terreno que nadie.");
    if ((u.mar || 0) >= 4) out.push("Ha pasado mucho tiempo embarcado.");
    if ((s.guerras || 0) >= 3 && g / guerras < 1.5) out.push("Sale poco a pelear y se queda atrás.");
    if ((s.cicatrices || 0) >= 3) out.push(`Lleva ${s.cicatrices} cicatrices.`);
    return out.slice(0, 5);
  }

  const parentescoEntre = (a, b) => {
    if (!a || !b) return null;
    if (a.padre && a.padre === b.id) return a.sexo === "f" ? "hija" : "hijo";
    if (b.padre && b.padre === a.id) return a.sexo === "f" ? "madre" : "padre";
    if (a.padre && a.padre === b.padre) return "hermano";
    if (a.pareja === b.id) return "pareja";
    return null;
  };

  raiz.FracturaSoldados = {
    STATS, rnd, ent, elegir, limitar, idNuevo, perfilDe, caracteristicas, caracteristicasHijo, nombreNuevo, casaNueva, crearSoldado,
    manias, rangoDe, rangoIndice, edadDe, aniosDeServicio, nombreCompleto, nombreConApodo, modHp, modAtq, modMov, probVoluntad, apodoPara, parentescoEntre
  };
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.FracturaSoldados;
})(typeof window !== "undefined" ? window : globalThis);
