/* =============================================================================
   VOCES INTERNAS — sistema paralelo a sideEvidence, mismo patrón: una
   tabla estática que anota choice_id ya existentes en bufon-contenido.js,
   sin ninguna estructura de diálogo aparte. Se lee desde
   construirContexto() en secreto.html; los puntos nunca se persisten
   como contador — se recalculan siempre desde bufonHistorial.

   BUFON_VOCES_INFO: nombre interno -> { nombre visible, color }. El
   color queda fijo por Voz, no cambia según escena.

   BUFON_VOCES_UMBRALES: puntaje mínimo para cada etapa (0 Dormida no
   tiene umbral, es "menos que murmullo").

   BUFON_VOCES: choice_id -> { nombreVoz: peso, ... }. Una elección puede
   alimentar más de una Voz a la vez, con pesos distintos.

   Puntos que NO vienen de esta tabla, calculados aparte en secreto.html
   (ver los bloques "MEDIDORES DE MENTIROSOS E IMPOSTORES" y "LOS OTROS
   CUATRO MEDIDORES" en construirContexto()) — las OCHO Voces reciben
   parte de su puntaje desde ahí, no solo de las filas de abajo:

     testigo   <- Mentirosos (mentir sobre hechos de campaña)
     coartada  <- Impostores (afirmar una identidad ajena)
     rostro    <- Impostores (mitad) + Identidad
     hilo      <- Impostores (mitad) + Curiosidad
     apetito   <- cruce Mentirosos×Impostores + Deseo
     grieta    <- Insistencia
     muralla   <- Reserva
     herida    <- Apego

   Si se agrega contenido nuevo para cualquiera de estas ocho, revisar
   esos bloques en secreto.html antes de asumir que el puntaje sale solo
   de las filas de acá abajo.
============================================================================= */
window.BUFON_VOCES_INFO = {
  coartada: { nombre: "LA COARTADA", color: "#D6B84C" },
  testigo:  { nombre: "EL TESTIGO",  color: "#6DBBEF" },
  grieta:   { nombre: "LA GRIETA",   color: "#B274E8" },
  muralla:  { nombre: "LA MURALLA",  color: "#9AA8B7" },
  hilo:     { nombre: "EL HILO",     color: "#55CDBD" },
  rostro:   { nombre: "EL ROSTRO",   color: "#E783C1" },
  herida:   { nombre: "LA HERIDA",   color: "#E96D6D" },
  apetito:  { nombre: "EL APETITO",  color: "#ED964B" }
};

window.BUFON_VOCES_UMBRALES = {
  murmullo: 3,
  despertar: 6,
  influencia: 10,
  presenciaFuerte: 15
};

/* =============================================================================
   TECHO NARRATIVO — separado a propósito del puntaje. El puntaje (de
   arriba) mide cuánto alimentó el jugador a cada Voz; esto mide cuánto
   se le PERMITE mostrarse todavía, ritmo puro, no intensidad. Ver
   ctx.voiceStage() en secreto.html: la etapa visible siempre es el
   mínimo entre la etapa por puntaje y este techo — el puntaje real sigue
   acumulándose sin tocarse nunca, así que subir un techo más adelante no
   pierde nada de lo ya jugado, solo destapa lo que ya estaba ahí.

   Todas en 2 (Despertar) hoy: ya hay contenido enviado y probado en esa
   etapa (los avisos de "menciona_X" de cada medidor), así que el techo
   no le quita nada a lo que el jugador ya puede ver — solo frena el
   salto a Influencia (opciones exclusivas) para que no aparezcan todas
   de golpe.

   El Rostro es la única excepción: 3 (Influencia), la "gran novedad" de
   este ciclo — su primera opción exclusiva real (ver ledros_hub en
   data/bufon-contenido.js). Subir el techo de otra Voz más adelante es
   una decisión de contenido, no de código: solo cambiar el número acá. */
window.BUFON_VOCES_TECHO = {
  coartada: 2,
  testigo: 2,
  grieta: 2,
  muralla: 2,
  herida: 2,
  hilo: 2,
  apetito: 2,
  rostro: 3
};

window.BUFON_VOCES = {
  // El Testigo — corregir la memoria de Slappy con un dato exacto.
  dragon_proyectil: { testigo: 2 },
  dragon_balista: { testigo: 2 },
  refuge_huyeron: { testigo: 1 },
  refuge_entregaron: { testigo: 1 },
  early_return_secreto: { testigo: 2, grieta: 1 },

  // La Grieta — insistir donde ya le dijeron que no.
  who_is_he: { grieta: 1 },
  despedida_que_tiempo: { grieta: 2 },

  // La Coartada — afirmar, reformular, dejar creer.
  i_do_know: { coartada: 2 },
  pet_como_un_gato: { coartada: 1 },

  // La Muralla — poner un límite, no explicar, guardarse.
  no: { muralla: 2 },
  pet_no_entender: { muralla: 1 },
  gareth_no_se: { muralla: 1 },
  registro_rechazar: { muralla: 1 },

  // La Herida — apego, conexión genuina.
  yes: { herida: 1 },
  early_return_saludo: { herida: 2 },

  // El Rostro / El Hilo — identidad y curiosidad analítica sobre ella.
  early_return_cual_real: { rostro: 2, hilo: 1 },
  early_return_yo_mismo: { rostro: 1, muralla: 1 },
  registro_aceptar: { rostro: 1 }
};

/* =============================================================================
   DESEO — mide voluntad personal explícita ("quiero X"), no volumen de
   conversación (eso es ctx.volumenConversacion, ver secreto.html, que
   ya NO alimenta a El Apetito). Auditoría completa de las 75 opciones
   existentes al momento de escribir esto: solo estas dos expresan deseo
   real bajo esta definición. El resto — preguntas, negaciones, acuerdos
   — quedó fuera a propósito, incluso casos que "suenan" a deseo por
   contener la palabra pero son en realidad Reserva ("No quiero hablar
   de eso.") u otra cosa. Ver la auditoría para el detalle opción por
   opción.

   Escala 0 (no hay) / +1 preferencia / +2 deseo claro / +3 deseo por
   encima de un costo declarado. Con el contenido de hoy el máximo
   posible es 2 — no alcanza ni para Murmullo (umbral 3). Es esperado:
   El Apetito debería ser una Voz tardía que recién empieza a crecer de
   verdad cuando se escriban ciclos donde Slappy pregunte explícitamente
   qué quiere el jugador. No bajar los umbrales para compensar esto
   artificialmente — si en varios ciclos más sigue sin poder despertar
   nunca, ahí sí se reconsidera. */
window.BUFON_DESEO = {
  registro_rechazar: 1, // "Prefiero seguir así." — preferencia explícita, sin costo
  early_return_saludo: 1 // "Solo quería hablar contigo." — deseo simple, sin costo
};
