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
// Ofuscado a propósito (no es seguridad real, solo evita que alguien
// lea de un vistazo con "Ver código fuente" exactamente qué respuesta
// prueba cada Side — ver el mismo criterio en bufonAlias() de
// secreto.html). Grupos, para referencia de quien edite esto:
//   pet_rescue            — cría de Bestia Trémula (A) vs. grifón (B),
//                           contrabandeada por Las Comadrejas.
//   gareth_relationship   — en A, Gareth debe un favor por una Bestia
//                           Trémula adulta; en B es solo el dueño del
//                           lugar, sin esa historia en común.
//   dragon_first_wound    — primera herida real al dragón: usar a
//                           Orina como proyectil (A) vs. cargar una
//                           vieja balista de asedio (B).
//   post_refuge_decision  — tras la masacre del refugio, A queda
//                           fugitivo; B se entrega y espera juicio.
window.BUFON_EVIDENCIA = JSON.parse(
  (() => {
    const b64 = "eyJwZXRfYmVzdGlhX3RyZW11bGEiOnsic2lkZSI6IkEiLCJ3ZWlnaHQiOjQsIm1lbW9yeUdyb3VwIjoicGV0X3Jlc2N1ZSJ9LCJwZXRfZ3JpZm9uIjp7InNpZGUiOiJCIiwid2VpZ2h0Ijo0LCJtZW1vcnlHcm91cCI6InBldF9yZXNjdWUifSwicGV0X2NvbW9fdW5fZ2F0byI6eyJzaWRlIjoiQSIsIndlaWdodCI6MiwibWVtb3J5R3JvdXAiOiJwZXRfcmVzY3VlIn0sImdhcmV0aF9ub3NfZGViZSI6eyJzaWRlIjoiQSIsIndlaWdodCI6NCwibWVtb3J5R3JvdXAiOiJnYXJldGhfcmVsYXRpb25zaGlwIn0sImdhcmV0aF9ub19kZWJlX25hZGEiOnsic2lkZSI6IkIiLCJ3ZWlnaHQiOjIsIm1lbW9yeUdyb3VwIjoiZ2FyZXRoX3JlbGF0aW9uc2hpcCJ9LCJkcmFnb25fcHJveWVjdGlsIjp7InNpZGUiOiJBIiwid2VpZ2h0Ijo0LCJtZW1vcnlHcm91cCI6ImRyYWdvbl9maXJzdF93b3VuZCJ9LCJkcmFnb25fYmFsaXN0YSI6eyJzaWRlIjoiQiIsIndlaWdodCI6NCwibWVtb3J5R3JvdXAiOiJkcmFnb25fZmlyc3Rfd291bmQifSwicmVmdWdlX2h1eWVyb24iOnsic2lkZSI6IkEiLCJ3ZWlnaHQiOjQsIm1lbW9yeUdyb3VwIjoicG9zdF9yZWZ1Z2VfZGVjaXNpb24ifSwicmVmdWdlX2VudHJlZ2Fyb24iOnsic2lkZSI6IkIiLCJ3ZWlnaHQiOjQsIm1lbW9yeUdyb3VwIjoicG9zdF9yZWZ1Z2VfZGVjaXNpb24ifX0=";
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  })()
);

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
  // Los cuatro nuevos (mattei_se_unio en adelante) son del ciclo propio
  // de Side A — Mattei, Enzo, Dagren, Guillotina — Capítulos VI-VII de
  // cronologia-a.js. A diferencia de B, no depende de ningún mecanismo
  // de "generación 2": son hechos que ya pasaron en mesa, sin esperar a
  // que se junten varios jugadores para destrabarlos.
  A: [
    "pet_rescued", "dragon_first_wounded", "refuge_destroyed", "gareth_reencounter",
    "eledar_asesinado", "mattei_se_unio", "enzo_venganza_revelada",
    "dagren_cobra_renta", "guillotina_identificada"
  ],
  // Los siete nuevos son del ciclo "Lo que queda" (Ledros, el Comerciante de
  // Dávidas, Hubert Magnolia, etc. — Capítulos VI-VII de cronologia-b.js).
  B: [
    "pet_rescued", "dragon_first_wounded", "refuge_destroyed", "gareth_reencounter",
    "met_ledros", "chose_mask", "cassius_joined", "torvrena_hired",
    "hubert_magnolia_named", "trial_rumors_heard", "eledar_ankle_hurt",
    "conocio_isa"
  ]
};
