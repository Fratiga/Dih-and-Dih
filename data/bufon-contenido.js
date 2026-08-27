/* =============================================================================
   CONTENIDO DEL BUFÓN — esto es lo único que hace falta tocar para escribir
   las rutas de diálogo. Formato:

   intro: array de strings, una por pantalla (se avanza con un click). Se
   muestra una sola vez por tanda, antes del menú. Dejar [] para no mostrar
   nada.

   trasfondo / dilema: pregunta + opciones (2 a 4 strings). Elegir una
   opción la guarda para revisar después en Supabase. Opcionalmente se
   puede sumar "reaccion": "texto" para una línea del Bufón después de
   elegir (si no está, vuelve directo al menú).

   bufon: pregunta + una única "respuesta" fija (no hay opciones).

   despedida: string opcional. Si está, aparece un link "irme" en el menú
   que la muestra. Dejar "" para no mostrar el link.

   Los ids deben ser únicos dentro de todo BUFON_CONTENIDO. Cada tanda
   (semana o dos, ver EPOCA_MS más abajo) se sortea un subconjunto de cada
   categoría, así no siempre son las mismas preguntas. Cada pregunta solo
   se puede responder una vez por jugador dentro de esa tanda.
============================================================================= */
window.BUFON_CONTENIDO = {
  categorias: {
    trasfondo: { titulo: "Lo que cargás" },
    dilema:    { titulo: "Lo que pesa" },
    bufon:     { titulo: "Preguntas para mí" }
  },
  intro: [
    "(ejemplo — reemplazar) Nadie preguntó si querías nacer, y sin embargo se espera que pagues por el privilegio hasta el último día."
  ],
  despedida: "",
  trasfondo: [
    {
      id: "t-ejemplo-1",
      pregunta: "(ejemplo — reemplazar) ¿Qué cargás que no podés soltar?",
      opciones: [
        "Un nombre que dejé de usar.",
        "Una promesa que no pienso cumplir.",
        "Una herida que decidí no cerrar."
      ]
    }
  ],
  dilema: [
    {
      id: "d-ejemplo-1",
      pregunta: "(ejemplo — reemplazar) Si tuvieras que elegir entre ganar y tener razón, ¿qué elegís?",
      opciones: [
        "Ganar.",
        "Tener razón.",
        "Ninguna de las dos."
      ]
    }
  ],
  bufon: [
    {
      id: "b-ejemplo-1",
      pregunta: "(ejemplo — reemplazar) ¿Quién sos?",
      respuesta: "Una respuesta que todavía no se escribió."
    }
  ]
};

/* Cuántas preguntas de cada categoría entran en una tanda. Si el banco de
   una categoría tiene menos que esto, se usan todas las que haya. */
window.BUFON_PREGUNTAS_POR_TANDA = 4;

/* Cada cuánto cambia la tanda de preguntas. Por defecto dos semanas; para
   que sea semanal, cambiar el 14 de abajo por 7. */
window.BUFON_EPOCA_MS = 14 * 24 * 60 * 60 * 1000;
window.BUFON_EPOCA_ORIGEN = Date.parse("2026-08-24T00:00:00Z");
