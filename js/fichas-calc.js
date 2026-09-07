/* =============================================================================
   CÁLCULOS — funciones puras, nada de DOM. Todo lo que aparece en la ficha
   se deriva acá a partir de los datos guardados; no se guarda ningún
   resultado ya calculado (sección 14: "no guardes copias desactualizadas").
============================================================================= */

function fichasModificador(puntuacion) {
  return Math.floor((Number(puntuacion) - 10) / 2);
}

function fichasPuntosPorNivel(nivelTotal) {
  return 2 * Math.max(0, Number(nivelTotal) - 1);
}

function fichasCompetenciaBase(nivelTotal) {
  const n = Number(nivelTotal) || 1;
  if (n >= 17) return 6;
  if (n >= 13) return 5;
  if (n >= 9) return 4;
  if (n >= 5) return 3;
  return 2;
}

function fichasCompetenciaTotal(personaje) {
  return fichasCompetenciaBase(personaje.identidad.nivelTotal) + Number(personaje.competenciaAjusteManual || 0);
}

/* Modificador final de un atributo: el de la puntuación + el ajuste manual
   (objetos, maldiciones, reglas caseras) — el calculado nunca es editable. */
function fichasModificadorFinal(personaje, attrId) {
  const base = fichasModificador(personaje.atributos[attrId]);
  const ajuste = Number(personaje.ajustesAtributos?.[attrId] || 0);
  return base + ajuste;
}

function fichasSalvacionTotal(personaje, attrId) {
  const salv = personaje.salvaciones[attrId];
  const competencia = salv.competente ? fichasCompetenciaTotal(personaje) : 0;
  return fichasModificadorFinal(personaje, attrId) + competencia + Number(salv.ajuste || 0);
}

function fichasHabilidadTotal(personaje, habId) {
  const def = FICHAS_HABILIDADES.find(h => h.id === habId);
  const hab = personaje.habilidades[habId];
  const mod = fichasModificadorFinal(personaje, def.atributo);
  const comp = fichasCompetenciaTotal(personaje);
  let porNivel = 0;
  if (hab.nivel === "competente") porNivel = comp;
  else if (hab.nivel === "pericia") porNivel = comp * 2;
  return mod + porNivel + Number(hab.ajuste || 0);
}

function fichasPercepcionPasiva(personaje) {
  return 10 + fichasHabilidadTotal(personaje, "percepcion");
}

function fichasIniciativaTotal(personaje) {
  return fichasModificadorFinal(personaje, "des") + Number(personaje.combate.iniciativaAjuste || 0);
}

function fichasCATotal(personaje) {
  const ca = personaje.combate.ca;
  if (ca.modo === "manual") return Number(ca.manual || 10);
  const desMod = ca.incluyeDes ? fichasModificadorFinal(personaje, "des") : 0;
  return Number(ca.armadura || 10) + Number(ca.escudo || 0) + desMod + Number(ca.otros || 0);
}

function fichasAtaqueTotal(personaje, ataque) {
  const mod = fichasModificadorFinal(personaje, ataque.atributo);
  const comp = ataque.competente ? fichasCompetenciaTotal(personaje) : 0;
  return mod + comp + Number(ataque.ajusteAtaque || 0);
}

function fichasLanzamientoAtaque(personaje) {
  const l = personaje.lanzamiento;
  if (l.manual) return Number(l.ataqueManual || 0);
  return fichasModificadorFinal(personaje, l.atributo) + fichasCompetenciaTotal(personaje) + Number(l.ajusteAtaque || 0);
}

function fichasLanzamientoCD(personaje) {
  const l = personaje.lanzamiento;
  if (l.manual) return Number(l.cdManual || 10);
  return 8 + fichasModificadorFinal(personaje, l.atributo) + fichasCompetenciaTotal(personaje) + Number(l.ajusteCD || 0);
}
