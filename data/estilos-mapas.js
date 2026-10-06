// Estilos para los mapas automáticos de Zarabanda y Parranda. Cada estilo sale de TODOS los mapas hechos a mano
// de una persona que ya están guardados (siempre en Zarabanda). Al elegirlo, los mapas automáticos de cualquier
// canción copian lo que esa persona hace igual en todas sus canciones: cuánto repite un mismo carril, qué tan
// seguidas pone las notas y cada cuánto mete una doble. Lo que cambia de canción a canción (cuántas notas por
// segundo, si va a corcheas o a semicorcheas, cuántas largas) solo se copia cuando todos sus mapas coinciden en
// eso; si no, lo decide la canción. Se mide en el momento, así que cada mapa nuevo o editado afina el estilo solo.
// Para añadir un mapa a un estilo: pon la canción (tal como está en data/musica.js) y la dificultad en "mapas".
window.ESTILOS_MAPAS = [
  {
    id: "nuni",
    nombre: "Estilo de Nuni",
    detalle: "Sale de sus mapas Experto (por ahora Rayman Origins, Lums of the Water)",
    mapas: [
      { cancion: "assets/musica/Rayman Origins Music Sea of Serendipity ~ Lums of the Water - Soniman001.mp3", dificultad: "experto" }
    ]
  },
  {
    id: "wonxarle",
    nombre: "Estilo de Wonxarle",
    detalle: "Sale de sus mapas Experto (Excuse me Kirk, Great Escape y Love Like You)",
    mapas: [
      { cancion: "assets/musica/Excuse me Kirk (Lyric video) - Khamsim.mp3", dificultad: "experto" },
      { cancion: "assets/musica/Great Escape - cinema staff.mp3", dificultad: "experto" },
      { cancion: "assets/musica/Love Like You (feat. Rebecca Sugar) [End Credits] - Steven Universe.mp3", dificultad: "experto" }
    ]
  }
];
