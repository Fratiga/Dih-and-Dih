/* =============================================================================
   MODELO DE DATOS — "Mis personajes". Un objeto plano versionado por
   personaje, pensado para vivir en localStorage y viajar tal cual en un
   respaldo JSON. Nada de clases: todo son funciones puras sobre objetos,
   para que fichas-storage / fichas-ui / fichas-pdf-laia puedan compartirlo
   sin acoplarse entre sí.
============================================================================= */

const FICHAS_VERSION_ACTUAL = 1;

// Lista canónica de habilidades y a qué atributo están atadas (sección 8).
const FICHAS_HABILIDADES = [
  { id: "acrobacias", nombre: "Acrobacias", atributo: "des" },
  { id: "trato_animales", nombre: "Trato con animales", atributo: "sab" },
  { id: "arcano", nombre: "Arcano", atributo: "int" },
  { id: "atletismo", nombre: "Atletismo", atributo: "fue" },
  { id: "engano", nombre: "Engaño", atributo: "car" },
  { id: "historia", nombre: "Historia", atributo: "int" },
  { id: "perspicacia", nombre: "Perspicacia", atributo: "sab" },
  { id: "intimidacion", nombre: "Intimidación", atributo: "car" },
  { id: "investigacion", nombre: "Investigación", atributo: "int" },
  { id: "medicina", nombre: "Medicina", atributo: "sab" },
  { id: "naturaleza", nombre: "Naturaleza", atributo: "int" },
  { id: "percepcion", nombre: "Percepción", atributo: "sab" },
  { id: "interpretacion", nombre: "Interpretación", atributo: "car" },
  { id: "persuasion", nombre: "Persuasión", atributo: "car" },
  { id: "religion", nombre: "Religión", atributo: "int" },
  { id: "juego_manos", nombre: "Juego de manos", atributo: "des" },
  { id: "sigilo", nombre: "Sigilo", atributo: "des" },
  { id: "supervivencia", nombre: "Supervivencia", atributo: "sab" }
];

const FICHAS_ATRIBUTOS = [
  { id: "fue", nombre: "Fuerza" },
  { id: "des", nombre: "Destreza" },
  { id: "con", nombre: "Constitución" },
  { id: "int", nombre: "Inteligencia" },
  { id: "sab", nombre: "Sabiduría" },
  { id: "car", nombre: "Carisma" }
];

function fichasNuevoId() {
  return (crypto.randomUUID ? crypto.randomUUID() : `f-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function fichasAtributosVacios() {
  const obj = {};
  FICHAS_ATRIBUTOS.forEach(a => { obj[a.id] = 10; });
  return obj;
}

function fichasAjustesVacios() {
  const obj = {};
  FICHAS_ATRIBUTOS.forEach(a => { obj[a.id] = 0; });
  return obj;
}

function fichasSalvacionesVacias() {
  const obj = {};
  FICHAS_ATRIBUTOS.forEach(a => { obj[a.id] = { competente: false, ajuste: 0 }; });
  return obj;
}

function fichasHabilidadesVacias() {
  const obj = {};
  FICHAS_HABILIDADES.forEach(h => { obj[h.id] = { nivel: "ninguna", ajuste: 0 }; });
  return obj;
}

/* Personaje nuevo, en blanco. El dueño real (owner_id) lo pone la base de
   datos sola vía RLS/default auth.uid() — acá "side" es solo un dato
   descriptivo que el jugador elige (a qué campaña/side pertenece este
   personaje), ya no un mecanismo de aislamiento. */
function fichasPersonajeVacio() {
  const ahora = new Date().toISOString();
  return {
    id: fichasNuevoId(),
    version: FICHAS_VERSION_ACTUAL,
    side: "",
    archivado: false,
    createdAt: ahora,
    updatedAt: ahora,
    // Se completan solo en el primer guardado (ver fichas-storage.js) y
    // nunca se pisan después — sirven para que un Admin viendo la ficha de
    // otro jugador sepa de quién es, sin depender de una tabla aparte.
    // ownerEmail queda como respaldo de comparación estable; ownerUsername
    // es lo que se muestra (más lindo que un email crudo).
    ownerEmail: "",
    ownerUsername: "",

    identidad: {
      nombre: "",
      retrato: "",
      fichaFoto: "", // foto/escaneo de la ficha de juego, para el tablero de Roll20
      pronombres: "",
      raza: "",
      clase: "",
      subclase: "",
      clasesExtra: [], // [{ nombre, nivel }]
      nivelTotal: 1,
      trasfondo: "",
      alineamiento: "",
      campania: "",
      experiencia: "",
      descripcionFisica: "",
      historia: "",
      notasPublicas: ""
    },

    atributos: fichasAtributosVacios(),
    ajustesAtributos: fichasAjustesVacios(), // ajuste manual al MODIFICADOR final
    puntosPorNivelUsados: 0, // informativo, ver sección 5

    competenciaAjusteManual: 0,

    salvaciones: fichasSalvacionesVacias(),
    habilidades: fichasHabilidadesVacias(),

    combate: {
      pvMax: 0,
      pvActual: 0,
      pvTemp: 0,
      ca: { modo: "manual", manual: 10, armadura: 10, escudo: 0, otros: 0, incluyeDes: true },
      iniciativaAjuste: 0,
      velocidad: 30,
      dadosGolpe: { actuales: 1, max: 1, dado: "d8" },
      salvMuerte: { exitos: 0, fallos: 0 },
      // Texto libre, no arrays: son puramente descriptivos (sección 9 del
      // spec), ninguna fórmula los consume, así que no gana nada
      // estructurarlos como listas.
      condiciones: "",
      resistencias: "",
      inmunidades: "",
      vulnerabilidades: "",
      sentidos: ""
    },

    ataques: [], // { id, nombre, atributo, competente, ajusteAtaque, dano, tipoDano, alcance, municionActual, municionMax, propiedades, notas }

    lanzamiento: {
      atributo: "int",
      ajusteAtaque: 0,
      ajusteCD: 0,
      manual: false,
      ataqueManual: 0,
      cdManual: 10,
      espacios: [] // { nivel, max, usados }
    },
    hechizos: [], // { id, nombre, nivel, escuela, tiempo, alcance, duracion, componentes, concentracion, ritual, tipo, dano, tipoDano, descripcion, notas }

    rasgos: [], // { id, nombre, descripcion, usosActuales, usosMax, tipoAccion, recuperacion, formulaRoll20 }
    competenciasArmas: "",
    competenciasArmaduras: "",
    competenciasHerramientas: "",
    idiomas: "",

    inventario: {
      objetos: [], // { id, nombre, cantidad, peso, estado, descripcion, notas, cargasActuales, cargasMax, valor }
      monedas: { oro: 0, plata: 0, cobre: 0 },
      usarPeso: false
    },

    macros: [], // { id, nombre, formula, modificadorFijo, narrativa, tipoDano, modoTirada, notas, favorita }
    favoritosRoll20: [], // ids sintéticos de tiradas (ver fichas-roll20.js)

    importado: null // { origen: "pdf-laia", pendientesRevision: [campo,...] } o null si se creó a mano
  };
}

/* Migraciones futuras: si algún día FICHAS_VERSION_ACTUAL sube, acá se
   agregan los pasos "de v1 a v2", etc. Por ahora es identidad. */
function fichasMigrar(personaje) {
  if (!personaje.version || personaje.version < 1) personaje.version = 1;
  if (personaje.identidad && personaje.identidad.fichaFoto === undefined) personaje.identidad.fichaFoto = "";
  return personaje;
}
