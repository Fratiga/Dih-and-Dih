// Estilos para los mapas automáticos de Zarabanda y Parranda. Cada estilo sale de un mapa hecho a mano
// que ya está guardado (siempre en Zarabanda): al elegirlo, los mapas automáticos de cualquier canción
// copian cuántas notas por segundo pone esa persona, cuánto repite un mismo carril, cuántas largas y
// dobles hace y si prefiere los tiempos o los contratiempos. Se mide en el momento, así que si el mapa
// de referencia se sigue editando, el estilo se va afinando solo.
// Para añadir uno: pon aquí la canción (tal como está en data/musica.js), la dificultad y el nombre.
window.ESTILOS_MAPAS = [
  {
    id: "nuni",
    nombre: "Estilo de Nuni",
    detalle: "Sale de su mapa Experto de Rayman Origins (Lums of the Water)",
    cancion: "assets/musica/Rayman Origins Music Sea of Serendipity ~ Lums of the Water - Soniman001.mp3",
    dificultad: "experto"
  },
  {
    id: "wonxarle",
    nombre: "Estilo de Wonxarle",
    detalle: "Sale de su mapa Experto de Excuse me Kirk (todavía lo está editando)",
    cancion: "assets/musica/Excuse me Kirk (Lyric video) - Khamsim.mp3",
    dificultad: "experto"
  }
];
