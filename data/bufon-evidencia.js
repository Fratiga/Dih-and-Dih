/* =============================================================================
   TABLA DE EVIDENCIA DEL BUFÓN.

   Cada choice_id de una rama de "recuerdo" (mascota, Gareth, dragón, etc.)
   que aporte información realmente diferenciadora entre Side A y Side B se
   lista acá, con:
     side:        a qué lado respalda esta respuesta.
     weight:      1 = débil, 2 = media, 4 = fuerte.
     memoryGroup: familia del recuerdo. Se usa para exigir diversidad antes
                  de que el Bufón "reconozca" un lado (ver jesterBelief en
                  secreto.html) — un solo memoryGroup nunca alcanza solo.

   Las opciones ambiguas/evasivas (aceptar la premisa del Bufón sin agregar
   nada, "no sé de qué hablás", etc.) simplemente NO aparecen acá. Si un
   choice_id no está en esta tabla, vale 0 automáticamente — no hace falta
   listarlo con weight 0.
============================================================================= */
window.BUFON_EVIDENCIA = {
  // memoryGroup: pet_rescue — cría de Bestia Trémula (A) vs. grifón (B),
  // contrabandeada por Las Comadrejas en la Taberna del Gigante.
  pet_bestia_tremula: { side: "A", weight: 4, memoryGroup: "pet_rescue" },
  pet_grifon:         { side: "B", weight: 4, memoryGroup: "pet_rescue" },
  pet_como_un_gato:   { side: "A", weight: 2, memoryGroup: "pet_rescue" },

  // memoryGroup: gareth_relationship — en A, Gareth les debe un favor por
  // haberlo ayudado antes contra una Bestia Trémula adulta. En B es solo
  // el dueño del lugar, sin esa historia en común.
  gareth_nos_debe:     { side: "A", weight: 4, memoryGroup: "gareth_relationship" },
  gareth_no_debe_nada: { side: "B", weight: 2, memoryGroup: "gareth_relationship" },

  // memoryGroup: dragon_first_wound — primera herida real al dragón, en el
  // Castillo: usar a Orina, el paladín goblin, como proyectil (A) vs.
  // cargar una vieja balista de asedio en la atalaya (B).
  dragon_proyectil: { side: "A", weight: 4, memoryGroup: "dragon_first_wound" },
  dragon_balista:    { side: "B", weight: 4, memoryGroup: "dragon_first_wound" },

  // memoryGroup: post_refuge_decision — después de la masacre del refugio,
  // A queda fugitivo (Verdam pone recompensa por ellos); B se entrega y
  // termina esperando juicio del rey Julius.
  refuge_huyeron:    { side: "A", weight: 4, memoryGroup: "post_refuge_decision" },
  refuge_entregaron: { side: "B", weight: 4, memoryGroup: "post_refuge_decision" }
};

/* =============================================================================
   HECHOS DE CAMPAÑA YA VIVIDOS EN MESA, por Side.

   Esto NO es "qué dice la crónica escrita" — es "hasta dónde llegó la mesa
   real de ese Side todavía", para que el Bufón nunca pueda traer a colación
   (ni ambiguamente) algo que ese jugador puntual todavía no vivió. Es la
   barrera de spoilers para jesterBelief; actualCampaign decide el filtro,
   el Bufón nunca la salta.

   Editar esta lista a mano después de cada sesión real. Ahora mismo asume
   que ambas mesas ya vivieron hasta donde hoy llega el texto escrito en
   cronologia-a.js/cronologia-b.js (Capítulo V incluido) — si alguna mesa
   viene más atrasada, sacar de acá los hechos que todavía no pasaron.
============================================================================= */
window.BUFON_HECHOS_CONOCIDOS = {
  A: ["pet_rescued", "dragon_first_wounded", "refuge_destroyed", "gareth_reencounter"],
  B: ["pet_rescued", "dragon_first_wounded", "refuge_destroyed", "gareth_reencounter"]
};
