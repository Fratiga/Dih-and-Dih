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
    habilidad: "Carroñero: cada vez que muere otra unidad, de cualquier jugador, gana +1/+1 (hasta 3 veces)." },
  // Eran 1/1 sin habilidad (SQL: cartas_diez_vacias.sql)
  { id: "rata", nombre: "Rata", epiteto: "", tipo: "Criatura", rareza: "comun", afinidad: ["sombra"], coste: 1, atq: 1, pv: 1, habilidad: "Sabandija: el turno en que entra, ni los desafíos ni las habilidades enemigas pueden elegirla." },
  { id: "perro-sabio", nombre: "Perro sabio", epiteto: "", tipo: "Criatura", rareza: "comun", afinidad: ["arcano"], coste: 2, atq: 2, pv: 2, habilidad: "Consejo sabio: al entrar, roba una carta." },
  { id: "arquero-de-la-milicia", nombre: "Arquero de la Milicia", epiteto: "", tipo: "Personaje", rareza: "comun", afinidad: ["juramento"], coste: 2, atq: 2, pv: 1, habilidad: "Disparo de cobertura: al entrar, una unidad enemiga pierde 1 de ataque hasta el final del próximo turno de su dueño." },
  { id: "caballero-de-brurland", nombre: "Caballero de Brurland", epiteto: "", tipo: "Personaje", rareza: "comun", afinidad: ["juramento"], coste: 5, atq: 4, pv: 5, habilidad: "Embestida: Arrollar. Resolución inquebrantable: la primera vez que fuera a morir, se queda con 1 de vida." },
  { id: "sargento-de-la-milicia", nombre: "Sargento de la Milicia", epiteto: "", tipo: "Personaje", rareza: "comun", afinidad: ["juramento"], coste: 3, atq: 2, pv: 4, habilidad: "¡Adelante!: al entrar, tus demás unidades de Juramento ganan +1 de ataque este turno." },
  { id: "mago-de-milicia", nombre: "Mago de la Milicia", epiteto: "", tipo: "Personaje", rareza: "comun", afinidad: ["juramento","arcano"], coste: 2, atq: 1, pv: 2, habilidad: "Resguardo: al entrar, una unidad aliada gana Barrera (ignora el primer daño que reciba)." },
  { id: "sapo-beluto", nombre: "Sapo Beluto", epiteto: "", tipo: "Criatura", rareza: "comun", afinidad: ["caceria"], coste: 2, atq: 1, pv: 4, habilidad: "Cazador de plagas: +3 de ataque contra unidades con Volar." },
  { id: "miliciano-de-brurland", nombre: "Miliciano de Brurland", epiteto: "", tipo: "Personaje", rareza: "comun", afinidad: ["juramento"], coste: 2, atq: 2, pv: 3, habilidad: "Formación cerrada: recibe 1 menos de daño mientras controlas otra unidad de Juramento." },
  { id: "cocatriz", nombre: "Cocatriz", epiteto: "", tipo: "Criatura", rareza: "comun", afinidad: ["carne"], coste: 3, atq: 2, pv: 2, habilidad: "Aliento negro: al entrar, una unidad enemiga pierde 2 de ataque hasta el final del próximo turno de su dueño." },
  { id: "zraith", nombre: "Zraith", epiteto: "El Águila de la Tormenta", tipo: "Criatura", rareza: "legendaria", afinidad: ["arcano"], coste: 7, atq: 5, pv: 6, habilidad: "Volar: solo puede ser bloqueada por unidades que también vuelan. Tormenta: al entrar, levanta la Tormenta de Zraith, un terreno que dura mientras ella siga en juego. Al final de tu turno, cae un rayo sobre una unidad enemiga al azar (1 de daño)." }
];
