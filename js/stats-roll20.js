/* =============================================================================
   ENEMIGOS PARA ROLL20 — convierte las fichas de Estadísticas (data/stats.js)
   en comandos de chat de Roll20 listos para usar.

   Las habilidades están escritas como texto libre ("+10 al impacto. Daño:
   2d8+5 perforante..."), así que acá se leen con reglas simples: bonificador
   de ataque, fórmula de daño, salvaciones con CD y curaciones. Lo que no tiene
   nada tirable (rasgos pasivos, efectos) se manda al chat como anuncio con su
   descripción, para que el máster lo tenga a la vista. Nunca se inventa un
   número: si el texto no lo dice, el comando no lo lleva.
============================================================================= */

const STATS_R20_ATRIBUTOS = {
  fuerza: "fue", destreza: "des", constitucion: "con",
  inteligencia: "int", sabiduria: "sab", carisma: "car"
};
const STATS_R20_NOMBRE_ATRIBUTO = {
  fue: "Fuerza", des: "Destreza", con: "Constitución", int: "Inteligencia", sab: "Sabiduría", car: "Carisma"
};

function statsR20Sin(texto) {
  return String(texto).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function statsR20Mod(s, atributo) {
  const v = s.stats && Number.isFinite(Number(s.stats[atributo])) ? Number(s.stats[atributo]) : 10;
  return Math.floor((v - 10) / 2);
}

function statsR20Signo(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

function statsR20D20(bonus, modo) {
  const dados = { normal: "1d20", ventaja: "2d20kh1", desventaja: "2d20kl1" }[modo] || "1d20";
  return bonus ? `${dados}${statsR20Signo(bonus)}` : dados;
}

/* "2d8 + Fuerza" -> "2d8+4" usando los modificadores del propio enemigo. */
function statsR20Formula(textoFormula, s) {
  let f = textoFormula.replace(/\s+/g, "");
  Object.entries(STATS_R20_ATRIBUTOS).forEach(([nombre, id]) => {
    f = f.replace(new RegExp(nombre, "ig"), () => String(statsR20Mod(s, id)));
  });
  f = f.replace(/\+-/g, "-").replace(/--/g, "+");
  return f;
}

const STATS_R20_RE_DADOS = "\\d+d\\d+(?:\\s*[+-]\\s*(?:\\d+|fuerza|destreza|constituci[oó]n|inteligencia|sabidur[ií]a|carisma))*";
const STATS_R20_TIPOS = "perforante|cortante|contundente|elemental|fuego|fr[ií]o|veneno|[aá]cido|necr[oó]tico|radiante|ps[ií]quico|fuerza|rel[aá]mpago|trueno|el[eé]ctrico|el[eé]ctrica";

/* Devuelve { ataque, danos:[{formula,tipo}], salvaciones:[{atributo,cd}], curacion }
   con lo que el texto de una habilidad deja leer. */
function statsR20Leer(texto, s, nombreHab = "") {
  const t = String(texto);
  const r = { ataque: null, danos: [], salvaciones: [], curacion: null };

  // "+N al impacto" siempre es un ataque. "+N al ataque" solo si hay un "Daño:" explícito;
  // si no, suele ser un bono (p. ej. "+2 al ataque y +2d8 al daño" de una marca).
  const mImpacto = t.match(/([+-]\d+)\s+al\s+impacto/i);
  const mAlAtaque = /Da[nñ]o\s*:/i.test(t) ? t.match(/([+-]\d+)\s+al\s+ataque/i) : null;
  const mAtaqueEtiqueta = t.match(/Ataque(?:\s+m[aá]gico)?\s*:?\s*([+-]\d+)\b/i);
  const mPorNombre = /ataque/i.test(nombreHab) ? t.match(/(?:^|[\s:,])([+-]\d+)(?![\d\s]*d\d)/) : null;
  const mAtaque = mImpacto || mAlAtaque || mAtaqueEtiqueta || mPorNombre;
  if (mAtaque) r.ataque = parseInt(mAtaque[1], 10);

  const reSalv = /salvaci[oó]n\s+de\s+([A-Za-záéíóúñÁÉÍÓÚÑ]+)[^.;]*?CD\s*(\d+)/ig;
  let m;
  while ((m = reSalv.exec(t))) {
    const id = STATS_R20_ATRIBUTOS[statsR20Sin(m[1])];
    if (id) r.salvaciones.push({ atributo: id, cd: parseInt(m[2], 10) });
  }

  const mCura = t.match(new RegExp(`(?:recupera|restaura|cura)\\s+(${STATS_R20_RE_DADOS})`, "i"));
  if (mCura) r.curacion = statsR20Formula(mCura[1], s);

  // Daño: lo que sigue a "Daño:" / "recibe" / "reciben" / "inflige" con dados; el primero es el principal.
  const reDano = new RegExp(`(?:Da[nñ]o\\s*:?|recibe[n]?|inflige[n]?|causa[n]?|a[nñ]ade[n]?|CD\\s*\\d+\\s*:)\\s+(?:\\d+\\s*\\()?(${STATS_R20_RE_DADOS})\\)?(?:\\s+(?:de\\s+(?:da[nñ]o\\s+(?:de\\s+)?)?)?(${STATS_R20_TIPOS}))?`, "ig");
  while ((m = reDano.exec(t))) {
    if (r.curacion && statsR20Formula(m[1], s) === r.curacion) continue;
    const adicional = /adicional/i.test(t.slice(m.index, m.index + m[0].length + 14));
    r.danos.push({ formula: statsR20Formula(m[1], s), tipo: m[2] || "", adicional });
  }
  return r;
}

function statsR20Limpiar(nombre) {
  return String(nombre).replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

/* Comando de una habilidad para un modo ("normal" | "ventaja" | "desventaja"). */
function statsR20ComandoHabilidad(s, hab, modo) {
  const nombre = statsR20Limpiar(hab.nombre);
  const esPasiva = /\(\s*pasiva\s*\)/i.test(hab.nombre);
  const l = esPasiva ? { ataque: null, danos: [], salvaciones: [], curacion: null } : statsR20Leer(hab.descripcion, s, hab.nombre);
  const lineas = [`/em ${s.nombre} usa ${nombre}`];
  let automatizada = false;

  if (l.ataque !== null) { lineas.push(`Ataque: [[${statsR20D20(l.ataque, modo)}]]`); automatizada = true; }
  l.salvaciones.forEach(sv => {
    lineas.push(`Salvación de ${STATS_R20_NOMBRE_ATRIBUTO[sv.atributo]} CD ${sv.cd}`);
    automatizada = true;
  });
  l.danos.forEach((d, i) => {
    const etiqueta = d.adicional ? "Daño adicional" : (i === 0 ? "Daño" : "Daño extra");
    lineas.push(`${etiqueta}: [[${d.formula}]]${d.tipo ? " " + d.tipo : ""}`);
    automatizada = true;
  });
  if (l.curacion) { lineas.push(`Curación: [[${l.curacion}]] PV`); automatizada = true; }
  if (!automatizada) lineas.push(`${nombre}: ${hab.descripcion}`);

  return { texto: lineas.join("\n"), automatizada, tieneAtaque: l.ataque !== null };
}

/* Todo lo que se publica de un enemigo: tiradas básicas + sus habilidades. */
function statsR20Enemigo(s) {
  const items = [];

  const iniciativa = s.iniciativa !== undefined && Number.isFinite(parseInt(s.iniciativa, 10))
    ? parseInt(s.iniciativa, 10) : statsR20Mod(s, "des");
  const basicas = [{ id: "ini", texto: "Iniciativa", bonus: iniciativa, etiqueta: `${s.nombre}: Iniciativa` }];
  Object.entries(STATS_R20_NOMBRE_ATRIBUTO).forEach(([id, nombre]) => {
    basicas.push({ id: `sv-${id}`, texto: `Salvación de ${nombre} (${statsR20Signo(statsR20Mod(s, id))})`, bonus: statsR20Mod(s, id), etiqueta: `${s.nombre}: Salvación de ${nombre}` });
  });
  basicas.forEach(b => {
    items.push({
      id: b.id, categoria: "Tiradas", texto: b.texto, tieneModo: true,
      cmd: {
        normal: `${b.etiqueta}: [[${statsR20D20(b.bonus, "normal")}]]`,
        ventaja: `${b.etiqueta}: [[${statsR20D20(b.bonus, "ventaja")}]]`,
        desventaja: `${b.etiqueta}: [[${statsR20D20(b.bonus, "desventaja")}]]`
      }
    });
  });

  (s.habilidades || []).forEach((h, i) => {
    const normal = statsR20ComandoHabilidad(s, h, "normal");
    items.push({
      id: `hab-${i}`,
      categoria: normal.automatizada ? "Acciones" : "Rasgos",
      texto: h.nombre,
      desc: h.descripcion || "",
      tieneModo: normal.tieneAtaque,
      cmd: {
        normal: normal.texto,
        ventaja: statsR20ComandoHabilidad(s, h, "ventaja").texto,
        desventaja: statsR20ComandoHabilidad(s, h, "desventaja").texto
      }
    });
  });

  const orden = { Acciones: 0, Rasgos: 1, Tiradas: 2 };
  items.sort((a, b) => orden[a.categoria] - orden[b.categoria]);
  return { id: s.id, nombre: s.nombre, rol: s.rol || "", pv: s.pv !== undefined ? s.pv : null, ca: s.ca !== undefined ? s.ca : null, velocidad: s.velocidad || null, items };
}
