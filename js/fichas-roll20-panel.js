/* =============================================================================
   ROLL20 — el panel de tiradas de una ficha (lo que se guarda en fichas_personajes.roll20 y usan el plugin de
   Roll20 y la pestaña Tiradas del tablero). Funciones puras: dependen solo de fichas-modelo, fichas-calc y
   fichas-roll20. Antes vivían dentro de fichas-ui.js; salen aquí para que el tablero pueda volver a generar
   las tiradas de una ficha cuando cambian sus estadísticas (la Grieta de Dexter), con el mismo código.
============================================================================= */

const FICHAS_NOMBRES_ATRIBUTOS = { fue: "Fuerza", des: "Destreza", con: "Constitución", int: "Inteligencia", sab: "Sabiduría", car: "Carisma" };

/* El nivel de un conjuro es un número (0 = truco) o, si el jugador escribe otra
   cosa, ese texto tal cual (una letra, por ejemplo). Los números se ordenan
   primero y las letras después, y cada nivel distinto tiene su propio grupo
   en la lista. */
function fichasNormalizarNivelHechizo(v) {
  const t = String(v == null ? "" : v).trim().slice(0, 12);
  if (t === "") return 0;
  if (/^\d+$/.test(t)) return Number(t);
  return t.length === 1 ? t.toUpperCase() : t; // "a" y "A" son el mismo nivel
}

function fichasInfoNivelHechizo(h) {
  const n = fichasNormalizarNivelHechizo(h.nivel);
  if (typeof n === "string") return { clave: `t${n.toLowerCase()}`, texto: n, etiqueta: n, corto: `nv. ${n}`, titulo: `Nivel ${n}` };
  if (n > 0) return { clave: `n${n}`, numero: n, etiqueta: `Nv ${n}`, corto: `nv. ${n}`, titulo: `Nivel ${n}` };
  return { clave: "n0", numero: 0, etiqueta: "Truco", corto: "truco", titulo: "Trucos" };
}

function fichasEtiquetaNivelHechizo(h) {
  return fichasInfoNivelHechizo(h).etiqueta;
}

function fichasComandoMacroRoll20(p, m) {
  const partes = [];
  if (m.narrativa) partes.push(`/em ${m.narrativa}`);
  const formula = m.modoTirada && m.modoTirada !== "normal"
    ? fichasFormulaD20(m.modificadorFijo, m.modoTirada)
    : `${fichasResolverFormula(p, m.formula)}${m.modificadorFijo ? fichasSigno(m.modificadorFijo) : ""}`;
  partes.push(`${m.nombre}: [[${formula}]]${m.tipoDano ? ` ${m.tipoDano}` : ""}`);
  return partes.join("\n");
}

/* ==========================================================================
   PANEL ROLL20: lista unificada + búsqueda/filtro + favoritos
========================================================================== */
function fichasListaRoll20(p) {
  const items = [];

  Object.entries(FICHAS_NOMBRES_ATRIBUTOS).forEach(([id, nombre]) => {
    items.push({ id: `salv:${id}`, categoria: "Salvaciones", texto: `Salvación de ${nombre}: ${fichasSigno(fichasSalvacionTotal(p, id))}`, tipo: "salvacion", refId: id });
  });
  FICHAS_HABILIDADES.forEach(h => {
    items.push({ id: `hab:${h.id}`, categoria: "Habilidades", texto: `${h.nombre}: ${fichasSigno(fichasHabilidadTotal(p, h.id))}`, tipo: "habilidad", refId: h.id });
  });
  items.push({ id: "iniciativa", categoria: "Combate", texto: `Iniciativa: ${fichasSigno(fichasIniciativaTotal(p))}`, tipo: "iniciativa", refId: null });
  p.ataques.forEach(a => {
    items.push({ id: `ataquedano:${a.id}`, categoria: "Ataques", texto: `${a.nombre}: ataque ${fichasSigno(fichasAtaqueTotal(p, a))}, daño ${fichasDanoAtaque(p, a) || "—"}`, tipo: "ataquedano", refId: a.id });
  });
  p.hechizos.filter(h => h.disponible !== false).forEach(h => {
    items.push({ id: `hechizo:${h.id}`, categoria: "Conjuros", texto: `${h.nombre} (${fichasInfoNivelHechizo(h).corto})`, tipo: "hechizo", refId: h.id });
  });
  p.rasgos.filter(r => r.formulaRoll20 && r.disponible !== false).forEach(r => {
    items.push({ id: `rasgo:${r.id}`, categoria: "Rasgos", texto: r.nombre, tipo: "rasgo", refId: r.id });
  });
  p.macros.forEach(m => {
    items.push({ id: `macro:${m.id}`, categoria: "Macros", texto: m.nombre, tipo: "macro", refId: m.id });
  });
  return items;
}

/* El mismo texto que arman los botones "Copiar", pero para cualquier personaje
   y modo (normal / ventaja / desventaja). Devuelve null si ese item no tiene
   variantes de modo. */
function fichasComandoItemRoll20(p, item, modo) {
  const opts = { modo };
  switch (item.tipo) {
    case "salvacion": return fichasComandoPrueba(`Salvación de ${FICHAS_NOMBRES_ATRIBUTOS[item.refId]}`, fichasSalvacionTotal(p, item.refId), opts);
    case "habilidad": return fichasComandoPrueba(FICHAS_HABILIDADES.find(h => h.id === item.refId).nombre, fichasHabilidadTotal(p, item.refId), opts);
    case "iniciativa": return fichasComandoIniciativa(fichasIniciativaTotal(p), opts);
    case "ataquedano": {
      const a = p.ataques.find(x => x.id === item.refId);
      return fichasComandoAtaqueYDano(p.identidad.nombre, a.nombre, fichasAtaqueTotal(p, a), fichasDanoAtaque(p, a), a.tipoDano, opts);
    }
    case "hechizo": {
      const h = p.hechizos.find(x => x.id === item.refId);
      if (h.tipo === "ataque") return fichasComandoHechizoAtaque(h.nombre, fichasLanzamientoAtaque(p), fichasResolverFormula(p, h.dano), h.tipoDano, opts);
      if (h.tipo === "salvacion") return fichasComandoHechizoSalvacion(h.nombre, FICHAS_NOMBRES_ATRIBUTOS[p.lanzamiento.atributo], fichasLanzamientoCD(p), fichasResolverFormula(p, h.dano), h.tipoDano);
      return h.dano ? fichasComandoHechizoCuracion(h.nombre, fichasResolverFormula(p, h.dano)) : h.nombre;
    }
    case "rasgo": {
      const r = p.rasgos.find(x => x.id === item.refId);
      return fichasComandoRasgo(r.nombre, fichasResolverFormula(p, r.formulaRoll20));
    }
    case "macro": return fichasComandoMacroRoll20(p, p.macros.find(x => x.id === item.refId));
    default: return null;
  }
}

/* Texto que el panel de Roll20 muestra al pasar el mouse sobre una tirada
   (descripción del rasgo, datos del hechizo, notas del ataque...). */
function fichasDescripcionItemRoll20(p, item) {
  const partes = [];
  if (item.tipo === "rasgo") {
    const r = p.rasgos.find(x => x.id === item.refId);
    if (r) {
      if (r.descripcion) partes.push(r.descripcion);
      if (r.usosMax) partes.push(`Usos: ${r.usosActuales ?? "?"}/${r.usosMax}`);
    }
  } else if (item.tipo === "hechizo") {
    const h = p.hechizos.find(x => x.id === item.refId);
    if (h) {
      const datos = [h.escuela, h.tiempo, h.alcance, h.duracion, h.componentes].filter(Boolean).join(" · ");
      if (datos) partes.push(datos);
      if (h.descripcion) partes.push(h.descripcion);
    }
  } else if (item.tipo === "ataquedano") {
    const a = p.ataques.find(x => x.id === item.refId);
    if (a) {
      const datos = [a.alcance, a.propiedades].filter(Boolean).join(" · ");
      if (datos) partes.push(datos);
      if (a.notas) partes.push(a.notas);
    }
  } else if (item.tipo === "macro") {
    const m = p.macros.find(x => x.id === item.refId);
    if (m) {
      if (m.narrativa) partes.push(m.narrativa);
      if (m.notas) partes.push(m.notas);
    }
  }
  const texto = partes.join("\n").trim();
  return texto.length > 700 ? texto.slice(0, 700) + "…" : texto;
}

/* Cómo se arma cada tirada, para mostrarlo en Roll20 al pasar el mouse y en
   la ventana de confirmación: de dónde sale cada número. */
function fichasCalculoItemRoll20(p, item) {
  const comp = fichasCompetenciaTotal(p);
  const mod = id => `mod. ${FICHAS_NOMBRES_ATRIBUTOS[id]} ${fichasSigno(fichasModificadorFinal(p, id))}`;
  const ajuste = n => (Number(n) ? ` + ajuste ${fichasSigno(n)}` : "");
  switch (item.tipo) {
    case "salvacion": {
      const s = p.salvaciones[item.refId];
      return `1d20 + ${mod(item.refId)}${s.competente ? ` + competencia ${fichasSigno(comp)}` : ""}${ajuste(s.ajuste)}`;
    }
    case "habilidad": {
      const def = FICHAS_HABILIDADES.find(h => h.id === item.refId);
      const h = p.habilidades[item.refId];
      const nivel = h.nivel === "pericia" ? ` + pericia ${fichasSigno(comp * 2)}` : h.nivel === "competente" ? ` + competencia ${fichasSigno(comp)}` : "";
      return `1d20 + ${mod(def.atributo)}${nivel}${ajuste(h.ajuste)}`;
    }
    case "iniciativa": return `1d20 + ${mod("des")}${ajuste(p.combate.iniciativaAjuste)}`;
    case "ataquedano": {
      const a = p.ataques.find(x => x.id === item.refId);
      if (!a) return "";
      const lineas = [`Ataque: 1d20 + ${mod(a.atributo)}${a.competente ? ` + competencia ${fichasSigno(comp)}` : ""}${ajuste(a.ajusteAtaque)} = ${fichasSigno(fichasAtaqueTotal(p, a))}`];
      const dano = fichasDanoAtaque(p, a);
      if (dano) lineas.push(`Daño: ${dano}${a.tipoDano ? ` ${a.tipoDano}` : ""}`);
      return lineas.join("\n");
    }
    case "hechizo": {
      const h = p.hechizos.find(x => x.id === item.refId);
      if (!h) return "";
      const dano = h.dano ? fichasResolverFormula(p, h.dano) : "";
      const lineaDano = dano ? `Daño: ${dano}${h.tipoDano ? ` de ${h.tipoDano}` : ""}` : "";
      if (h.tipo === "ataque") return [`Ataque mágico: 1d20 ${fichasSigno(fichasLanzamientoAtaque(p))} (ataque de conjuros)`, lineaDano].filter(Boolean).join("\n");
      if (h.tipo === "salvacion") return [`El objetivo salva contra CD ${fichasLanzamientoCD(p)} (${FICHAS_NOMBRES_ATRIBUTOS[p.lanzamiento.atributo]})`, lineaDano].filter(Boolean).join("\n");
      return dano ? `Curación: ${dano}` : "";
    }
    case "rasgo": {
      const r = p.rasgos.find(x => x.id === item.refId);
      return r ? fichasResolverFormula(p, r.formulaRoll20) : "";
    }
    default: return "";
  }
}

function fichasPayloadRoll20(p) {
  const items = fichasListaRoll20(p).map(i => {
    const cmd = {
      normal: fichasComandoItemRoll20(p, i, "normal"),
      ventaja: fichasComandoItemRoll20(p, i, "ventaja"),
      desventaja: fichasComandoItemRoll20(p, i, "desventaja")
    };
    const desc = fichasDescripcionItemRoll20(p, i);
    let calc = "";
    try { calc = fichasCalculoItemRoll20(p, i); } catch (e) { /* sin desglose */ }
    let chat = "";
    if (i.tipo === "hechizo") {
      const h = p.hechizos.find(x => x.id === i.refId);
      if (h && h.descripcionEnChat !== false) chat = fichasChatDeHechizo(h, fichasEtiquetaNivelHechizo(h));
    }
    let municion = null;
    if (i.tipo === "ataquedano") {
      const a = p.ataques.find(x => x.id === i.refId);
      if (a && Number(a.municionMax) > 0) municion = { actual: Number(a.municionActual) || 0, max: Number(a.municionMax), ataque: a.id };
    }
    return { id: i.id, categoria: i.categoria, texto: i.texto, favorita: p.favoritosRoll20.includes(i.id), cmd, ...(desc ? { desc } : {}), ...(chat ? { chat } : {}), ...(calc ? { calc } : {}), ...(municion ? { municion } : {}) };
  });
  items.sort((a, b) => Number(b.favorita) - Number(a.favorita));
  return { id: p.id, nombre: p.identidad.nombre || "Sin nombre", velocidad: p.combate.velocidad, items };
}
