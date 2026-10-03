// Desafíos de Muerte Súbita. Cada rival es un personaje del mundo; la prueba
// la decide él. "motor" es el minijuego que se usa (ver js/arqueria.js).
window.MUERTE_SUBITA = [
  {
    id: "verdam-arqueria",
    rival: "Verdam",
    categoria: "Competencia",
    prueba: "Arquería",
    motor: "arqueria",
    motorRival: "verdam",
    duracion: 60,
    texto: "Un cazador que no falla. Ya te estaba apuntando antes de que llegaras.",
    recompensa: "Una reliquia de Verdam, a criterio del DM."
  },
  { id: "estrategia", categoria: "Estrategia", bloqueado: true },
  { id: "azar", categoria: "Azar", bloqueado: true },
  { id: "voluntad", categoria: "Voluntad", bloqueado: true }
];
