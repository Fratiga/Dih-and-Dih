/* =============================================================================
   ROLL20 — genera texto, nunca tira nada ni toca la API de Roll20. Todo acá
   son strings a copiar. Ver sección 14 del spec: valores numéricos finales,
   nunca referencias tipo @{selected|...}.
============================================================================= */

// "+4" / "-1" / "+0" — nunca "+-1" ni un número pelado sin signo.
function fichasSigno(n) {
  const v = Math.trunc(Number(n) || 0);
  return v >= 0 ? `+${v}` : `${v}`;
}

/* d20 con modificador, en los 3 modos + consulta. bonusExtra ya viene
   formateado con signo (o vacío) — se concatena tal cual al final. */
function fichasFormulaD20(bonus, modo) {
  const b = fichasSigno(bonus);
  const dados = {
    normal: "1d20",
    ventaja: "2d20kh1",
    desventaja: "2d20kl1",
    consulta: "?{Tipo de tirada|Normal,1d20|Ventaja,2d20kh1|Desventaja,2d20kl1}"
  }[modo] || "1d20";
  return `${dados}${b}`;
}

function fichasPreguntaAjuste(activar) {
  return activar ? "+?{Bonificación adicional|0}" : "";
}

/* --- Pruebas de habilidad / salvación / iniciativa ---------------------- */
function fichasComandoPrueba(nombre, bonus, { modo = "normal", preguntarAjuste = false } = {}) {
  const formula = fichasFormulaD20(bonus, modo) + fichasPreguntaAjuste(preguntarAjuste);
  return `${nombre}: [[${formula}]]`;
}

function fichasComandoIniciativa(bonus, opts = {}) {
  return fichasComandoPrueba("Iniciativa", bonus, opts);
}

/* --- Ataques -------------------------------------------------------------
   danoFormula es texto libre del jugador ("1d8+2"); se envuelve tal cual,
   no se recalcula ni se toca — el jugador es dueño de esa fórmula. */
function fichasComandoAtaque(nombreArma, bonusAtaque, opts = {}) {
  return fichasComandoPrueba(`Ataque con ${nombreArma}`, bonusAtaque, opts);
}

function fichasComandoDano(nombreArma, danoFormula, tipoDano) {
  const tipo = tipoDano ? ` ${tipoDano}` : "";
  return `Daño de ${nombreArma}: [[${danoFormula}]]${tipo}`;
}

function fichasComandoAtaqueYDano(personajeNombre, nombreArma, bonusAtaque, danoFormula, tipoDano, opts = {}) {
  const { modo = "normal", preguntarAjuste = false, narrativa = true } = opts;
  const formula = fichasFormulaD20(bonusAtaque, modo) + fichasPreguntaAjuste(preguntarAjuste);
  const tipo = tipoDano ? ` ${tipoDano}` : "";
  const lineas = [];
  if (narrativa) lineas.push(`/em ataca con ${nombreArma}`);
  lineas.push(`Ataque: [[${formula}]]`);
  lineas.push(`Daño: [[${danoFormula}]]${tipo}`);
  return lineas.join("\n");
}

/* --- Hechizos ------------------------------------------------------------ */
function fichasComandoHechizoAtaque(nombreHechizo, bonusAtaque, danoFormula, tipoDano, opts = {}) {
  const formula = fichasFormulaD20(bonusAtaque, opts.modo || "normal") + fichasPreguntaAjuste(opts.preguntarAjuste);
  const tipo = tipoDano ? ` de ${tipoDano}` : "";
  const lineas = [`${nombreHechizo} — Ataque mágico: [[${formula}]]`];
  if (danoFormula) lineas.push(`Daño: [[${danoFormula}]]${tipo}`);
  return lineas.join("\n");
}

function fichasComandoHechizoSalvacion(nombreHechizo, atributoNombre, cd, danoFormula, tipoDano) {
  const lineas = [`${nombreHechizo} — Salvación de ${atributoNombre} CD ${Math.trunc(Number(cd) || 0)}`];
  if (danoFormula) {
    const tipo = tipoDano ? ` de ${tipoDano}` : "";
    lineas.push(`Daño: [[${danoFormula}]]${tipo}`);
  }
  return lineas.join("\n");
}

function fichasComandoHechizoCuracion(nombreHechizo, curacionFormula) {
  return `${nombreHechizo} — Curación: [[${curacionFormula}]] PV`;
}

/* --- Rasgos con fórmula libre --------------------------------------------
   El jugador escribe su propia expresión (puede ser un d20+X, un dado de
   daño, un texto con [[...]] ya armado, etc.) — acá solo se envuelve con
   el nombre, no se reinterpreta. */
function fichasComandoRasgo(nombre, formulaLibre) {
  return `${nombre}: ${formulaLibre}`;
}

/* --- Copiar al portapapeles ----------------------------------------------
   Devuelve una Promise<boolean> (true = clipboard API funcionó). El
   llamador es responsable de mostrar el campo de respaldo si da false. */
async function fichasCopiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (e) {
    return false;
  }
}

/* --- Bloque de macros para "Copiar todas las macros" ---------------------
   grupos: [{ titulo, comandos: [string,...] }] ya generados por el llamador. */
function fichasBloqueMacros(grupos) {
  return grupos
    .filter(g => g.comandos.length)
    .map(g => `# ${g.titulo}\n${g.comandos.join("\n")}`)
    .join("\n\n");
}
