/* =============================================================================
   CÁLCULOS — funciones puras, nada de DOM. Todo lo que aparece en la ficha
   se deriva acá a partir de los datos guardados; no se guarda ningún
   resultado ya calculado (sección 14: "no guardes copias desactualizadas").
============================================================================= */

function fichasModificador(puntuacion) {
  return Math.floor((Number(puntuacion) - 10) / 2);
}

/* Sin tope de nivel en esta campaña: la progresión estándar de D&D
   (+2 en 1-4, +3 en 5-8, ...) sigue subiendo de a +1 cada 4 niveles más
   allá del 20, en vez de quedar fija en +6. */
function fichasCompetenciaBase(nivelTotal) {
  const n = Number(nivelTotal) || 1;
  return 2 + Math.floor(Math.max(0, n - 1) / 4);
}

function fichasCompetenciaTotal(personaje) {
  return fichasCompetenciaBase(personaje.identidad.nivelTotal) + Number(personaje.competenciaAjusteManual || 0);
}

/* Regla casera de esta campaña: 2 puntos por cada nivel ganado (empieza a
   sumar en nivel 2, nadie gasta puntos de mejora todavía en nivel 1). */
function fichasPuntosPorNivel(nivelTotal) {
  return 2 * Math.max(0, Number(nivelTotal) - 1);
}

/* Aparte de la regla casera de arriba, la clase sola ya da 2 puntos extra
   en cada nivel múltiplo de 4 (Mejora de característica del D&D base:
   4, 8, 12...), sin tope de nivel. */
function fichasPuntosMejoraClase(nivelTotal) {
  return 2 * Math.floor(Math.max(0, Number(nivelTotal) || 0) / 4);
}

function fichasPuntosDisponiblesTotal(nivelTotal) {
  return fichasPuntosPorNivel(nivelTotal) + fichasPuntosMejoraClase(nivelTotal);
}

// Todo personaje de esta campaña arranca en 8 en las seis características,
// sin excepción — no es un dato por personaje, así que no se guarda.
const FICHAS_PUNTUACION_BASE = 8;

// Tope real de la compra por puntos de creación de D&D: ninguna
// característica puede comprarse por encima de 15 antes de la racial, sin
// importar cuántos de los 27 puntos tenga disponibles.
const FICHAS_TOPE_COMPRA_CREACION = 15;

// Costo real de la compra por puntos, tabla oficial de D&D: de 8 a 13 cada
// punto cuesta 1, pero 14 y 15 cuestan 2 cada uno.
const FICHAS_COSTO_COMPRA_PUNTOS = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const FICHAS_PRESUPUESTO_COMPRA_PUNTOS = 27;

/* Cuánto de la puntuación actual de cada atributo viene de gastar puntos
   de mejora POR NIVEL, en vez de la compra por puntos de creación.

   Primero cada atributo intenta cubrirse desde la creación hasta su tope
   de 15 (antes de racial). Pero la compra por puntos no es lineal — 14 y
   15 cuestan el doble por punto — así que maximizar los seis atributos
   hasta su tope puede costar más de los 27 reales. Cuando pasa eso, hay
   que seguir bajando creación (empezando por donde bajar un punto ahorra
   más costo, o sea los tramos 14→15) y subir nivel en su lugar, hasta que
   el costo total vuelva a entrar en el presupuesto. */
function fichasPuntosRepartidos(personaje) {
  const atributos = FICHAS_ATRIBUTOS.map(({ id }) => {
    const actual = Number(personaje.atributos[id]) || 0;
    const racial = Number(personaje.atributosRaciales?.[id]) || 0;
    const antesDeRacial = actual - racial;
    const creacion = Math.min(FICHAS_TOPE_COMPRA_CREACION, Math.max(FICHAS_PUNTUACION_BASE, antesDeRacial));
    return { creacion, nivel: Math.max(0, antesDeRacial - creacion) };
  });

  let costoTotal = atributos.reduce((t, a) => t + FICHAS_COSTO_COMPRA_PUNTOS[a.creacion], 0);
  while (costoTotal > FICHAS_PRESUPUESTO_COMPRA_PUNTOS) {
    let mejor = null;
    atributos.forEach(a => {
      if (a.creacion <= FICHAS_PUNTUACION_BASE) return;
      const ahorro = FICHAS_COSTO_COMPRA_PUNTOS[a.creacion] - FICHAS_COSTO_COMPRA_PUNTOS[a.creacion - 1];
      if (!mejor || ahorro > mejor.ahorro) mejor = { a, ahorro };
    });
    if (!mejor) break; // los seis ya están en 8, no hay más para bajar
    mejor.a.creacion -= 1;
    mejor.a.nivel += 1;
    costoTotal -= mejor.ahorro;
  }

  return atributos.reduce((t, a) => t + a.nivel, 0);
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
