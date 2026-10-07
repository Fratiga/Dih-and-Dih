/* =============================================================================
   LISTA DE CICLOS DEL BUFÓN.

   Cada jugador está en UN ciclo y solo recibe el contenido de ese ciclo
   (ver "CICLOS DEL JUGADOR" en secreto.html). Esta lista da el nombre de
   cada número y la leen el panel de Admin ("Progreso del Bufón", para mover
   a un lado o a un jugador de ciclo), el Laboratorio y el propio Bufón.

     Ciclo 1   el contenido original (el menú de siempre y sus recuerdos).
     Ciclo 2   "Lo que queda": Ledros, el comerciante, Laia, Mattei, Enzo...
     Ciclo 3+  un archivo propio cada uno: data/bufon-ciclo-<id>.js

   "prefijos" (solo en los ciclos 1 y 2, que están escritos a mano en
   bufon-contenido.js) dice a qué ciclo pertenece cada nodo según el
   comienzo de su id. Lo usa la auditoría para comprobar que un jugador
   nunca recibe contenido de otro ciclo. Los ciclos de archivo (3+) no lo
   necesitan: el constructor ya sabe cuáles son sus nodos.

   Para sumar un ciclo nuevo:
     node tools/bufon/bufon.js nuevo-ciclo <numero> <id> "Nombre"
   que agrega la línea aquí, crea el archivo y lo conecta en secreto.html.
============================================================================= */
window.BUFON_LISTA_CICLOS = [
  {
    numero: 1, nombre: "Contenido original",
    prefijos: ["resp_", "bufon_pet_", "bufon_gareth", "bufon_dragon_", "bufon_post_refuge", "bufon_refuge_", "bufon_brurland_"]
  },
  {
    numero: 2, nombre: "Lo que queda",
    prefijos: [
      "bufon_ledros_", "bufon_comerciante_", "bufon_hubert_", "bufon_laia_", "bufon_mattei_", "bufon_enzo_",
      "bufon_dagren_", "bufon_guillotina_", "bufon_eledar_", "bufon_cassius_", "bufon_torvrena_", "bufon_ryn_",
      "bufon_juicio_", "bufon_side_a_eledar_muerte"
    ]
  },
  { numero: 3, nombre: "Fase 3" },
  // @@CICLOS@@  (nuevo-ciclo agrega los ciclos nuevos justo encima de esta línea)
];
