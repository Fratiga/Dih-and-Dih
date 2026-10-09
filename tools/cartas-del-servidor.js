// Cartas que viven solo en el servidor (las creó el editor del álbum, no están en js/cartas-datos.js).
// Es una copia para las pruebas y la simulación: el servidor manda (tabla cartas_definiciones). Si alguien cambia
// una de estas cartas desde el editor, esta copia se queda atrás; no afecta al juego, solo a tools/.
// Cada carta tiene su habilidad programada en js/cartas-efectos.js.
module.exports = [
  { id: "adam-kovacs-h", nombre: "Adam Kovacs", epiteto: "El Heroe", tipo: "Personaje", rareza: "legendaria", afinidad: ["juramento", "caceria"], coste: 8, atq: 1, pv: 4,
    habilidad: "Fuerza Helénica: en combate contra una unidad, hace tanto daño como vida tenga. Si toca al jugador, lo derrota de un golpe." },
  { id: "eledar", nombre: "Eledar", epiteto: "El tarotista", tipo: "Personaje", rareza: "rara", afinidad: ["arcano"], coste: 2, atq: 1, pv: 3,
    habilidad: "Lectura de tarot: al entrar, mira las tres cartas superiores de tu mazo, roba la de mayor coste y manda las otras al fondo. Presagio fallido: recibe 1 de daño adicional de los ataques." },
  { id: "laia", nombre: "Laia", epiteto: "El cambiaformas", tipo: "Personaje", rareza: "comun", afinidad: ["sombra"], coste: 3, atq: 2, pv: 2, lado: ["B"],
    habilidad: "Cambiante: al entrar, copia el ataque y la vida de otra unidad en el campo. Manos largas: cuando ataca al jugador rival, robas una carta." },
  { id: "ledros", nombre: "Ledros", epiteto: "el espectro", tipo: "Personaje", rareza: "rara", afinidad: ["eternidad"], coste: 4, atq: 3, pv: 5, lado: ["B"],
    habilidad: "Almas errantes: al entrar, crea un Resto espectral al azar (de barro, piedra o madera). Descanso: cuando muere, tus Restos espectrales se desvanecen." },
  // Antes eran cartas vacías de 1/1 sin habilidad
  { id: "coach", nombre: "Coach", epiteto: "", tipo: "Personaje", rareza: "comun", afinidad: ["juramento"], coste: 2, atq: 1, pv: 4,
    habilidad: "Se interpone: la primera vez que una unidad aliada fuera a recibir daño, lo recibe él en su lugar." },
  { id: "julius-goldenside", nombre: "Julius Goldenside", epiteto: "El Rey", tipo: "Personaje", rareza: "rara", afinidad: ["juramento"], coste: 6, atq: 3, pv: 6,
    habilidad: "Decreto real: al entrar, una unidad enemiga ni ataca ni bloquea hasta el final de su próximo turno. Sentencia aplazada: una vez por partida, cuando una unidad aliada fuera a morir, se queda con 1 de vida." },
  { id: "leonard-goldenside", nombre: "Leonard Goldenside", epiteto: "El principe", tipo: "Personaje", rareza: "rara", afinidad: ["juramento"], coste: 5, atq: 4, pv: 5,
    habilidad: "Guardia: puede bloquear. Eisen Strum: cuando una unidad le inflige daño en combate, esa unidad recibe 2 de daño. Postura de Brynhildr: al atacar se pone de espaldas, no puede bloquear y solo lo bloquean unidades con 3 o más de ataque, y no tiene Eisen Strum. Si pasas un turno sin atacar con él, vuelve a la guardia.",
    formas: [{ nombre: "Postura de Brynhildr", imagen: null, ajuste: null }] },
  { id: "mercader", nombre: "Mercader", epiteto: "", tipo: "Personaje", rareza: "comun", afinidad: ["juramento"], coste: 1, atq: 1, pv: 3,
    habilidad: "Regateo: tus Objetos cuestan 1 menos." },
  { id: "el-vendedor-de-davidas", nombre: "El vendedor de Dávidas", epiteto: "", tipo: "Personaje", rareza: "infrecuente", afinidad: ["sombra"], coste: 3, atq: 1, pv: 3,
    habilidad: "Carroñero: cada vez que muere otra unidad, de cualquier jugador, gana +1/+1 (hasta 3 veces)." }
];
