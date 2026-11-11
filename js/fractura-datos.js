/* =============================================================================
   LA FRACTURA: datos del juego. Aquí solo hay datos y tablas; las reglas viven en
   fractura-motor.js y lo que persiste entre guerras en fractura-campana.js.
   Se carga igual en el navegador y en Node (tools/probar-fractura.js).
   REGLAS es la versión de las reglas: una guerra guardada con otra versión no se puede continuar.

   Lore: la Fractura es un espacio fuera del mundo conocido, hecho de fragmentos de lugares,
   sueños y recuerdos. Lo que pasa en una guerra no cambia el canon. Los nombres de lugares y
   facciones salen del compendio (solo lo público); los soldados y las casas son inventados.
============================================================================= */
(function (raiz) {
  const RECURSOS = ["comida", "materiales", "mineral", "oro", "mana", "anima"];
  const RECURSO_NOMBRE = { comida: "Alimento", materiales: "Materiales", mineral: "Mineral", oro: "Oro", mana: "Maná", anima: "Ánima" };

  /* --- Terreno: coste de movimiento (0 = no se puede pisar), defensa y lo que rinde a una ciudad cercana --- */
  const TERRENOS = {
    llanura: { nombre: "Llanura", mov: 1, def: 0, rinde: { comida: 1 }, color: "#8a9a4b" },
    bosque: { nombre: "Bosque", mov: 2, def: 1, rinde: { materiales: 1 }, color: "#3f6b3a" },
    montana: { nombre: "Montaña", mov: 3, def: 2, rinde: { mineral: 1 }, color: "#7d7468" },
    desierto: { nombre: "Desierto", mov: 2, def: 0, rinde: { oro: 1 }, color: "#c9a96a" },
    agua: { nombre: "Agua", mov: 0, def: 0, rinde: { comida: 1 }, color: "#3b6a9c", navegable: true },
    magica: { nombre: "Zona mágica", mov: 1, def: 0, rinde: { mana: 2 }, color: "#8f5bc4" },
    huesos: { nombre: "Campo de huesos", mov: 1, def: 0, rinde: { anima: 1 }, color: "#a39c8a" },
    vacio: { nombre: "Vacío", mov: 0, def: 0, rinde: {}, color: "#15101c" }
  };

  /* --- Estructuras que se pueden poner sobre un terreno --- */
  const ESTRUCTURAS = {
    ciudad: { nombre: "Ciudad", def: 1 },
    fortaleza: { nombre: "Fortaleza", def: 2 },
    ruinas: { nombre: "Ruinas", def: 1 },
    nucleo: { nombre: "Núcleo del Sueño", def: 1 },
    costura: { nombre: "Costura", def: 0 }
  };

  /* --- Clases. mov = puntos de movimiento; alc = alcance (1 = cuerpo a cuerpo).
         perfil = media de las seis características de un soldado de esa clase (1 a 10). --- */
  const CLASES = {
    guerrero: { nombre: "Guerrero", rol: "Primera línea", hp: 12, atq: 4, def: 2, mov: 3, alc: 1, atqEstat: "FUE",
      perfil: { FUE: 7, CON: 7, VEL: 4, INT: 4, VOL: 6, MAG: 1 }, coste: { comida: 2, oro: 2 }, requiere: {},
      texto: "Mucha vida y buen daño cuerpo a cuerpo. Los aliados a su lado reciben 1 de daño menos." },
    cazador: { nombre: "Cazador", rol: "Hostigamiento", hp: 9, atq: 3, def: 1, mov: 4, alc: 3, atqEstat: "FUE",
      perfil: { FUE: 5, CON: 4, VEL: 7, INT: 5, VOL: 5, MAG: 2 }, coste: { comida: 2, oro: 2, materiales: 1 }, requiere: {},
      texto: "Ataca de lejos, se mueve mucho y puede retirarse después de disparar. Pega más desde un bosque." },
    arcanista: { nombre: "Arcanista", rol: "Artillería mágica", hp: 7, atq: 4, def: 0, mov: 3, alc: 2, atqEstat: "MAG",
      perfil: { FUE: 2, CON: 3, VEL: 4, INT: 8, VOL: 6, MAG: 8 }, coste: { comida: 2, oro: 2, mana: 3 }, requiere: { edificio: "santuario", escuela: ["arcano", 1] },
      texto: "Muy frágil. Su golpe alcanza también a los enemigos pegados al objetivo y puede cambiar el terreno." },
    paladin: { nombre: "Paladín", rol: "Tanque y apoyo", hp: 16, atq: 3, def: 4, mov: 3, alc: 1, atqEstat: "FUE",
      perfil: { FUE: 6, CON: 8, VEL: 3, INT: 5, VOL: 8, MAG: 3 }, coste: { comida: 3, oro: 4, mineral: 2 }, requiere: { edificio: "cuartel" },
      texto: "Defensa altísima y un aura que da 1 de defensa a quienes lo rodean. Es caro." },
    picaro: { nombre: "Pícaro", rol: "Infiltración", hp: 8, atq: 4, def: 1, mov: 4, alc: 1, atqEstat: "FUE",
      perfil: { FUE: 5, CON: 4, VEL: 8, INT: 6, VOL: 5, MAG: 2 }, coste: { comida: 2, oro: 3 }, requiere: { edificio: "cuartel" },
      texto: "Pega la mitad más si el objetivo está solo, se desengancha sin problema y puede sabotear edificios enemigos." },
    caballero: { nombre: "Caballero", rol: "Caballería pesada", hp: 14, atq: 5, def: 3, mov: 4, alc: 1, atqEstat: "FUE", exclusiva: "caballeros-del-reino",
      perfil: { FUE: 7, CON: 7, VEL: 6, INT: 4, VOL: 6, MAG: 1 }, coste: { comida: 3, oro: 5, mineral: 2 }, requiere: { edificio: "herreria" },
      texto: "Si avanza al menos dos casillas antes de atacar, pega 2 más." },
    archimago: { nombre: "Archimago", rol: "Magia mayor", hp: 9, atq: 6, def: 1, mov: 3, alc: 3, atqEstat: "MAG", exclusiva: "academia-arcana-de-dolbred",
      perfil: { FUE: 2, CON: 4, VEL: 4, INT: 9, VOL: 7, MAG: 9 }, coste: { comida: 2, oro: 4, mana: 5 }, requiere: { edificio: "torre_magia", escuela: ["arcano", 2] },
      texto: "Magia de largo alcance con golpe en área." },
    esqueleto: { nombre: "Legión de huesos", rol: "Tropa barata", hp: 10, atq: 3, def: 1, mov: 3, alc: 1, atqEstat: "FUE", exclusiva: "trono-de-ceniza", muertoViviente: true,
      perfil: { FUE: 5, CON: 4, VEL: 4, INT: 2, VOL: 9, MAG: 1 }, coste: { anima: 1 }, requiere: {},
      texto: "Se paga solo con Ánima. No necesita comida y no siente miedo." },
    ballestero: { nombre: "Ballestero pesado", rol: "Caza mayor", hp: 10, atq: 4, def: 1, mov: 3, alc: 3, atqEstat: "FUE", exclusiva: "hijos-del-acero",
      perfil: { FUE: 6, CON: 5, VEL: 5, INT: 5, VOL: 7, MAG: 1 }, coste: { comida: 2, oro: 3, mineral: 1 }, requiere: { edificio: "cuartel" },
      texto: "Pega 2 más a monstruos y a unidades muy blindadas." },
    mercenario: { nombre: "Mercenario", rol: "Contrato", hp: 12, atq: 4, def: 2, mov: 3, alc: 1, atqEstat: "FUE", exclusiva: "compania-dorada",
      perfil: { FUE: 6, CON: 6, VEL: 5, INT: 4, VOL: 5, MAG: 1 }, coste: { oro: 5 }, requiere: {},
      texto: "Se contrata con oro y no pide comida ni edificio. Caro, pero llega al instante." },
    sanador: { nombre: "Peregrino sanador", rol: "Curación", hp: 9, atq: 1, def: 1, mov: 3, alc: 1, atqEstat: "VOL", exclusiva: "santos-de-asmodeo", sanador: true,
      perfil: { FUE: 3, CON: 5, VEL: 4, INT: 6, VOL: 9, MAG: 5 }, coste: { comida: 2, oro: 3 }, requiere: { edificio: "santuario" },
      texto: "Cura 4 de vida a los aliados que tiene al lado al empezar tu turno. Puede consagrar el terreno." },
    capo: { nombre: "Capo", rol: "Mando", hp: 9, atq: 4, def: 1, mov: 3, alc: 1, atqEstat: "INT", exclusiva: "nikaalia",
      perfil: { FUE: 5, CON: 5, VEL: 5, INT: 8, VOL: 7, MAG: 1 }, coste: { comida: 2, oro: 4 }, requiere: { edificio: "cuartel" },
      texto: "Los aliados que tiene al lado ganan +1 de ataque." },
    maestro: { nombre: "Maestro de escuela", rol: "Duelista", hp: 10, atq: 5, def: 1, mov: 4, alc: 1, atqEstat: "VEL", exclusiva: "seosan",
      perfil: { FUE: 6, CON: 5, VEL: 8, INT: 6, VOL: 8, MAG: 2 }, coste: { comida: 3, oro: 4, mineral: 1 }, requiere: { edificio: "cuartel" },
      texto: "+2 de ataque contra una unidad que está sola, además del Duelo de Seosan." },
    berserker: { nombre: "Berserker", rol: "Choque", hp: 11, atq: 4, def: 0, mov: 3, alc: 1, atqEstat: "FUE", exclusiva: "okran",
      perfil: { FUE: 8, CON: 7, VEL: 5, INT: 2, VOL: 7, MAG: 1 }, coste: { comida: 3, oro: 2 }, requiere: {},
      texto: "Furia reforzada: gana 1 de ataque más cuando baja de la mitad de la vida." },
    barrilero: { nombre: "Barrilero", rol: "Demolición", hp: 6, atq: 3, def: 0, mov: 3, alc: 1, atqEstat: "FUE", exclusiva: "pelgiria",
      perfil: { FUE: 5, CON: 4, VEL: 5, INT: 3, VOL: 8, MAG: 1 }, coste: { comida: 1, oro: 3 }, requiere: {},
      texto: "Al morir explota: 3 de daño a todo lo que tenga alrededor, amigo o enemigo." },
    quimera: { nombre: "Quimera", rol: "Depredador", hp: 11, atq: 4, def: 2, mov: 3, alc: 1, atqEstat: "FUE", exclusiva: "mravec",
      perfil: { FUE: 7, CON: 7, VEL: 5, INT: 3, VOL: 7, MAG: 2 }, coste: { comida: 3, oro: 2, mineral: 2 }, requiere: { edificio: "cuartel" },
      texto: "Devora y adapta: gana un rasgo según lo que mata." },
    automata: { nombre: "Autómata", rol: "Constructo", hp: 8, atq: 3, def: 2, mov: 3, alc: 1, atqEstat: "FUE", exclusiva: "nernib", sinComida: true,
      perfil: { FUE: 6, CON: 7, VEL: 3, INT: 2, VOL: 10, MAG: 1 }, coste: { materiales: 2, mineral: 1 }, requiere: { edificio: "taller" },
      texto: "No come. El Taller entrega uno gratis cada 4 turnos." },
    condenado: { nombre: "Condenado de la Ergástula", rol: "Tropa barata", hp: 8, atq: 3, def: 1, mov: 3, alc: 1, atqEstat: "FUE", exclusiva: "balutia",
      perfil: { FUE: 5, CON: 5, VEL: 4, INT: 3, VOL: 4, MAG: 1 }, coste: { comida: 1, oro: 1 }, requiere: {},
      texto: "Barato y prescindible." },
    /* --- Barcos. Solo navegan. Se botan en una ciudad con muelle y aparecen en el agua de al lado. No son soldados:
           no ganan experiencia ni pasan al ejército. canon: disparan pólvora. pesado: no pueden moverse y disparar. --- */
    galera: { nombre: "Galera", rol: "Barco de guerra", naval: 1, hp: 11, atq: 3, def: 1, mov: 4, alc: 2, atqEstat: "FUE", noSoldado: true,
      coste: { materiales: 3, oro: 3 }, requiere: { edificio: "muelle" }, texto: "El barco de siempre. Dispara a otros barcos y a quien esté cerca de la orilla." },
    brulote: { nombre: "Brulote", rol: "Cazabarcos", naval: 2, hp: 8, atq: 4, def: 0, mov: 5, alc: 1, atqEstat: "FUE", noSoldado: true, atqBarco: 3,
      coste: { materiales: 2, oro: 3 }, requiere: { edificio: "astillero" }, texto: "Un casco viejo cargado de fuego. +3 de ataque contra barcos y tropas embarcadas. Rápido y frágil." },
    bombarda: { nombre: "Galeón de bombardas", rol: "Asedio desde el mar", naval: 3, hp: 13, atq: 6, def: 1, mov: 3, alc: 3, atqEstat: "FUE", noSoldado: true, canon: true, pesado: true, atqPlaza: 2,
      coste: { materiales: 5, oro: 5, mineral: 3 }, requiere: { edificio: "atarazana" }, texto: "Alcance 3 y +2 contra quien se guarece en una ciudad o una fortaleza. No puede moverse y disparar en el mismo turno." },
    bergantin: { nombre: "Bergantín de la Hermandad", rol: "Corsario", naval: 1, hp: 11, atq: 4, def: 1, mov: 5, alc: 2, atqEstat: "FUE", noSoldado: true, canon: true, exclusiva: "pelgiria", golpeaYSigue: true,
      coste: { materiales: 3, oro: 3 }, requiere: { edificio: "muelle" }, texto: "Velas negras. Después de disparar puede seguir navegando." },
    trirreme: { nombre: "Trirreme imperial", rol: "Espolón", naval: 2, hp: 12, atq: 4, def: 1, mov: 4, alc: 1, atqEstat: "FUE", noSoldado: true, exclusiva: "balutia", espolon: 3,
      coste: { materiales: 4, oro: 3 }, requiere: { edificio: "astillero" }, texto: "Si avanza al menos dos casillas antes de atacar, embiste: +3 de ataque." },
    acorazado: { nombre: "Acorazado de vapor", rol: "Fortaleza flotante", naval: 3, hp: 16, atq: 5, def: 3, mov: 3, alc: 2, atqEstat: "FUE", noSoldado: true, canon: true, exclusiva: "nernib", sinComida: true,
      coste: { materiales: 5, mineral: 5, oro: 3 }, requiere: { edificio: "atarazana" }, texto: "Casco de hierro y caldera. Muy difícil de hundir. No come." },
    nave_ahogados: { nombre: "Nave de los ahogados", rol: "Barco fantasma", naval: 1, hp: 12, atq: 4, def: 1, mov: 3, alc: 2, atqEstat: "VOL", noSoldado: true, exclusiva: "trono-de-ceniza", muertoViviente: true, curaAlMatar: 3,
      coste: { anima: 4 }, requiere: { edificio: "muelle" }, texto: "Se paga con Ánima y no come. Cada vez que hunde o mata, se cura 3." },
    carraca: { nombre: "Carraca mercante", rol: "Comercio armado", naval: 1, hp: 12, atq: 2, def: 1, mov: 3, alc: 2, atqEstat: "FUE", noSoldado: true, canon: true, exclusiva: "compania-dorada", oroTurno: 2,
      coste: { oro: 6 }, requiere: { edificio: "muelle" }, texto: "Pega poco, pero mientras siga a flote da 2 de oro por turno." },
    heroe: { nombre: "Héroe", rol: "Héroe", hp: 20, atq: 5, def: 3, mov: 3, alc: 1, atqEstat: "FUE", noReclutable: true,
      perfil: { FUE: 8, CON: 8, VEL: 6, INT: 7, VOL: 9, MAG: 5 }, coste: {}, requiere: {}, texto: "Un eco de alguien que dejó huella en el mundo." },
    eco: { nombre: "Eco", rol: "Magia única", hp: 10, atq: 6, def: 1, mov: 3, alc: 2, atqEstat: "MAG",
      perfil: { FUE: 2, CON: 5, VEL: 5, INT: 8, VOL: 8, MAG: 10 }, coste: { mana: 6, oro: 4 }, requiere: { edificio: "torre_magia", escuela: ["arcano", 4] },
      texto: "Una manifestación de la Fractura. Magia de alcance con golpe en área." },
    lider: { nombre: "Líder", rol: "Figura de la facción", hp: 18, atq: 5, def: 3, mov: 3, alc: 1, atqEstat: "FUE", noReclutable: true,
      perfil: { FUE: 8, CON: 8, VEL: 5, INT: 7, VOL: 9, MAG: 4 }, coste: {}, requiere: {}, texto: "Eco de una figura de su facción." },
    // Criaturas sin dueño que guardan ruinas y fortalezas
    salvaje: { nombre: "Criatura de la Fractura", rol: "Guardián", hp: 14, atq: 4, def: 2, mov: 2, alc: 1, atqEstat: "FUE", noReclutable: true, monstruo: true,
      perfil: { FUE: 6, CON: 7, VEL: 4, INT: 2, VOL: 8, MAG: 3 }, coste: {}, requiere: {}, texto: "Nacida de un fragmento inestable." }
  };
  // Clases que sale a la venta por defecto (las exclusivas entran según la facción)
  const CLASES_BASE = ["guerrero", "cazador", "arcanista", "paladin", "picaro"];
  // Barcos que cualquier ejército puede botar, por nivel de muelle (1 muelle, 2 astillero, 3 atarazana)
  const BARCOS_BASE = ["galera", "brulote", "bombarda"];
  const NOMBRES_BARCO = ["La Golondrina", "El Tozudo", "La Viuda", "El Buen Viaje", "La Sorda", "El Cormorán", "La Paciencia", "El Tres Hermanos", "La Deuda", "El Malavenido", "La Estrella Baja", "El Rencor",
    "La Niña del Faro", "El Sinvergüenza", "La Marea", "El Último Trago", "La Costurera", "El Gaviota", "La Zurda", "El Perro Viejo"];

  const ESPECIALIZACIONES = {
    guardia: { nombre: "Guardia", texto: "+2 de defensa.", def: 2 },
    duelista: { nombre: "Duelista", texto: "+2 de ataque contra unidades que están solas.", atqSolo: 2 },
    explorador: { nombre: "Explorador", texto: "+1 de movimiento y ve una casilla más lejos.", mov: 1, vision: 1 },
    tirador: { nombre: "Tirador", texto: "+1 de alcance.", alc: 1 },
    rompelineas: { nombre: "Rompelíneas", texto: "+2 de ataque contra unidades en ciudades o fortalezas y contra unidades pesadas (defensa 3 o más).", atqPesado: 2 }
  };

  /* --- Rangos por victorias. bono: lo que suma el rango (vida y ataque). --- */
  const RANGOS = [
    { id: "recluta", nombre: "Recluta", desde: 0, hp: 0, atq: 0 },
    { id: "soldado", nombre: "Soldado", desde: 5, hp: 1, atq: 0 },
    { id: "veterano", nombre: "Veterano", desde: 15, hp: 2, atq: 0 },
    { id: "elite", nombre: "Élite", desde: 30, hp: 3, atq: 1 },
    { id: "leyenda", nombre: "Leyenda", desde: 50, hp: 5, atq: 2 }
  ];

  /* --- Edificios. rama: eco, mil, mag. nivel: 1 a 4. rinde: lo que suma por turno. --- */
  const EDIFICIOS = {
    granja: { nombre: "Granja", rama: "eco", nivel: 1, coste: { materiales: 3, oro: 2 }, rinde: { comida: 2 }, terreno: ["llanura", "agua"], texto: "+2 de alimento. Pide llanura o agua cerca." },
    aserradero: { nombre: "Aserradero", rama: "eco", nivel: 1, coste: { oro: 3 }, rinde: { materiales: 2 }, terreno: ["bosque"], texto: "+2 de materiales. Pide un bosque cerca." },
    mina: { nombre: "Mina", rama: "eco", nivel: 1, coste: { materiales: 3, oro: 2 }, rinde: { mineral: 2 }, terreno: ["montana"], texto: "+2 de mineral. Pide una montaña cerca." },
    mercado: { nombre: "Mercado", rama: "eco", nivel: 2, coste: { materiales: 4, oro: 4 }, rinde: { oro: 3 }, previo: ["granja", "aserradero", "mina"], texto: "+3 de oro. Pide otro edificio de economía." },
    banco: { nombre: "Banco", rama: "eco", nivel: 3, coste: { oro: 8, mineral: 3 }, rinde: { oro: 4 }, previo: ["mercado"], texto: "+4 de oro." },
    cuartel: { nombre: "Cuartel", rama: "mil", nivel: 2, coste: { materiales: 4, oro: 3 }, rinde: {}, texto: "Permite entrenar pícaros y paladines. Los reclutas cuestan 1 de oro menos." },
    herreria: { nombre: "Herrería", rama: "mil", nivel: 2, coste: { materiales: 3, mineral: 2, oro: 2 }, rinde: {}, previo: ["cuartel"], texto: "+1 de defensa a quien guarnece la ciudad. Permite forjar caballeros." },
    arsenal: { nombre: "Arsenal", rama: "mil", nivel: 3, coste: { materiales: 4, mineral: 4, oro: 4 }, rinde: {}, previo: ["herreria"], texto: "Los reclutas salen con +1 de ataque." },
    academia_militar: { nombre: "Academia militar", rama: "mil", nivel: 3, coste: { materiales: 4, oro: 6 }, rinde: {}, previo: ["cuartel"], texto: "Los reclutas salen con 3 victorias de experiencia." },
    fortaleza: { nombre: "Fortaleza", rama: "mil", nivel: 4, coste: { mineral: 6, materiales: 4, oro: 4 }, rinde: {}, previo: ["herreria"], texto: "+2 de defensa en la ciudad y cura 2 más a quien la guarnece." },
    santuario: { nombre: "Santuario", rama: "mag", nivel: 1, coste: { materiales: 3, oro: 3 }, rinde: { mana: 2 }, texto: "+2 de maná. Permite entrenar arcanistas y sanadores." },
    biblioteca: { nombre: "Biblioteca arcana", rama: "mag", nivel: 2, coste: { materiales: 3, oro: 5 }, rinde: { mana: 2 }, previo: ["santuario"], texto: "+2 de maná. Investigar cuesta 1 de maná menos por escalón." },
    torre_magia: { nombre: "Torre de magia", rama: "mag", nivel: 3, coste: { mineral: 3, oro: 6, mana: 4 }, rinde: { mana: 3 }, previo: ["biblioteca"], texto: "+3 de maná. Permite invocar archimagos." },
    refugio: { nombre: "Refugio", rama: "mil", nivel: 2, coste: { materiales: 6, oro: 6, mineral: 2 }, rinde: {}, noCapital: true, texto: "Si cae tu capital, esta ciudad pasa a serlo y sigues en la guerra." },
    // Edificios propios de un ejército
    taller: { nombre: "Taller", rama: "mil", nivel: 2, coste: { materiales: 5, mineral: 2 }, rinde: {}, solo: "nernib", texto: "Permite montar autómatas. Entrega uno gratis cada 4 turnos (hasta 3 vivos)." },
    perrera: { nombre: "Perrera de Cadenas", rama: "mil", nivel: 2, coste: { mineral: 6, materiales: 4 }, rinde: {}, solo: "hijos-del-acero", previo: ["cuartel"], texto: "Las jaulas donde se retiene lo que no se puede matar. Hace falta para invocar a Rykerd." },
    catedral: { nombre: "Catedral", rama: "mag", nivel: 2, coste: { materiales: 5, oro: 5 }, rinde: { mana: 1 }, solo: "santos-de-asmodeo", previo: ["santuario"], texto: "+1 de maná. Consagra dos casillas alrededor de la ciudad en vez de una." },
    dojo: { nombre: "Dojo", rama: "mil", nivel: 2, coste: { materiales: 5, oro: 3 }, rinde: {}, solo: "seosan", previo: ["cuartel"], texto: "Los reclutas de esta ciudad salen con 2 victorias de experiencia." },
    circulo_huesos: { nombre: "Círculo de Huesos", rama: "mag", nivel: 1, coste: { materiales: 3, oro: 2 }, rinde: { anima: 1 }, solo: "okran", texto: "+1 de Ánima. Lugar de los chamanes." },
    // El mar: cada nivel de muelle deja botar barcos mejores. Piden agua a dos casillas de la ciudad.
    muelle: { nombre: "Muelle", rama: "eco", nivel: 1, coste: { materiales: 4, oro: 2 }, rinde: { comida: 1, oro: 1 }, agua: true, texto: "+1 de alimento y +1 de oro. Tus tropas pueden embarcar y la ciudad bota galeras. Pide agua cerca." },
    astillero: { nombre: "Astillero", rama: "mil", nivel: 2, coste: { materiales: 5, oro: 4 }, rinde: {}, previo: ["muelle"], agua: true, texto: "Permite botar brulotes y los barcos propios de algunos ejércitos." },
    atarazana: { nombre: "Atarazana", rama: "mil", nivel: 3, coste: { materiales: 6, mineral: 4, oro: 5 }, rinde: {}, previo: ["astillero"], agua: true, texto: "Permite botar galeones de bombardas." }
  };

  /* --- Escuelas de desarrollo (cada escalón pide el anterior). coste de maná por escalón (más oro). --- */
  const ESCUELAS = {
    militar: { nombre: "Militar", escalones: [
      { id: "disciplina", nombre: "Disciplina", texto: "Los guerreros y paladines ganan +1 de vida.", coste: { mana: 4, oro: 2 } },
      { id: "formacion", nombre: "Formación", texto: "Quien tiene al lado un aliado de su misma clase gana +1 de defensa.", coste: { mana: 7, oro: 3 } },
      { id: "acero", nombre: "Acero", texto: "Todas tus unidades ganan +1 de ataque.", coste: { mana: 11, oro: 5 } },
      { id: "maestria", nombre: "Maestría", texto: "Veteranos o mejores ganan +1 de ataque y +1 de defensa.", coste: { mana: 16, oro: 8 } }
    ] },
    arcano: { nombre: "Arcano", escalones: [
      { id: "teoria", nombre: "Teoría mágica", texto: "Permite entrenar arcanistas.", coste: { mana: 4, oro: 2 } },
      { id: "resonancia", nombre: "Resonancia", texto: "El golpe de arcanistas y archimagos frena al objetivo (pierde 1 de movimiento un turno) y alcanza al 75 % en área.", coste: { mana: 7, oro: 3 } },
      { id: "transmutacion", nombre: "Transmutación", texto: "Cada edificio de economía rinde 1 más, y los arcanistas pueden cambiar el terreno por 3 de maná.", coste: { mana: 11, oro: 5 } },
      { id: "alta_magia", nombre: "Alta magia", texto: "Permite invocar Ecos (unidad mágica única) y los arcanistas ganan +1 de alcance.", coste: { mana: 16, oro: 8 } }
    ] },
    tanato: { nombre: "Tanatología", escalones: [
      { id: "anatomia", nombre: "Anatomía", texto: "+1 de ataque contra unidades heridas.", coste: { mana: 4, oro: 2 } },
      { id: "conservacion", nombre: "Conservación", texto: "Cada baja deja 2 de Ánima, y tus unidades curan 1 más por turno.", coste: { mana: 7, oro: 3 } },
      { id: "reanimacion", nombre: "Reanimación", texto: "Gasta 3 de Ánima para levantar a un caído, tuyo o enemigo, como unidad propia con la mitad de vida.", coste: { mana: 11, oro: 5 } },
      { id: "inmortalidad", nombre: "Inmortalidad", texto: "Al terminar la guerra, la mitad de tus soldados caídos regresan como Renacientes.", coste: { mana: 16, oro: 8 } }
    ] }
  };

  /* --- Reliquias: pocas, con nombre y con efecto. slot: arma, armadura, accesorio, estandarte --- */
  const RELIQUIAS = {
    espada_osses: { nombre: "Espada de Osses", slot: "arma", bono: { atq: 3 }, texto: "+3 de ataque." },
    lanza_tres_puertas: { nombre: "Lanza de las Tres Puertas", slot: "arma", bono: { atq: 2, def: 1 }, texto: "+2 de ataque y +1 de defensa." },
    martillo_alba: { nombre: "Martillo del Alba", slot: "arma", bono: { atq: 2, cura: 1 }, texto: "+2 de ataque. Cura 1 a los aliados contiguos cada turno." },
    arco_vigia: { nombre: "Arco del Último Vigía", slot: "arma", bono: { atq: 1, alc: 1 }, texto: "+1 de ataque y +1 de alcance." },
    daga_sin_nombre: { nombre: "Daga Sin Nombre", slot: "arma", bono: { atq: 2, mov: 1 }, texto: "+2 de ataque y +1 de movimiento." },
    baston_dolbred: { nombre: "Bastón de Dolbred", slot: "arma", bono: { atq: 2, mana: 1 }, texto: "+2 de ataque y +1 de maná por turno." },
    escudo_ultimo_guardia: { nombre: "Escudo del Último Guardia", slot: "armadura", bono: { def: 2 }, texto: "+2 de defensa." },
    coraza_quebrada: { nombre: "Coraza Quebrada", slot: "armadura", bono: { def: 1, hp: 3 }, texto: "+1 de defensa y +3 de vida." },
    manto_cazador_gris: { nombre: "Manto del Cazador Gris", slot: "armadura", bono: { def: 1, movBosque: 1 }, texto: "+1 de defensa y +1 de movimiento en bosque." },
    yelmo_gylas: { nombre: "Yelmo de Gylas", slot: "armadura", bono: { def: 1, vision: 1 }, texto: "+1 de defensa y ve una casilla más lejos." },
    anillo_nernib: { nombre: "Anillo de Nernib", slot: "accesorio", bono: { mov: 1 }, texto: "+1 de movimiento." },
    cristal_mana: { nombre: "Cristal de Maná", slot: "accesorio", bono: { mana: 2 }, texto: "+2 de maná por turno mientras lo lleve alguien vivo." },
    brujula_cartografos: { nombre: "Brújula de los Cartógrafos", slot: "accesorio", bono: { vision: 2 }, texto: "Ve dos casillas más lejos." },
    talisman_alba: { nombre: "Talismán del Alba", slot: "accesorio", bono: { hp: 2, cura: 2 }, texto: "+2 de vida y cura 2 a los aliados contiguos cada turno." },
    colmillo_dragon: { nombre: "Colmillo de Dragón", slot: "accesorio", bono: { atqMonstruo: 3 }, texto: "+3 de ataque contra monstruos." },
    estandarte_brurland: { nombre: "Estandarte de Brurland", slot: "estandarte", bono: { auraDef: 1 }, texto: "Los aliados a 2 casillas o menos ganan +1 de defensa." },
    pendon_cenizas: { nombre: "Pendón de Cenizas", slot: "estandarte", bono: { auraAtq: 1 }, texto: "Los aliados a 2 casillas o menos ganan +1 de ataque." },
    bandera_sexto_sol: { nombre: "Bandera del Sexto Sol", slot: "estandarte", bono: { auraMov: 1 }, texto: "Los aliados a 2 casillas o menos ganan +1 de movimiento." },
    estandarte_dorado: { nombre: "Estandarte Dorado", slot: "estandarte", bono: { oro: 2 }, texto: "+2 de oro por turno mientras siga en pie." }
  };
  const SLOTS = ["arma", "armadura", "accesorio", "estandarte"];

  /* --- Facciones jugables. Cada una cambia reglas con unos pocos modificadores (los lee el motor).
         tropas: nombre y aspecto de cada clase en ese ejército. La clase (el rol) es la misma para todos.
         curva: cuándo es fuerte. heroe: a quién puede invocar (dos o más = sorteo al empezar la guerra). --- */
  const FACCIONES = {
    "caballeros-del-reino": {
      naval: { nivel: "Corrientes", texto: "Una marina modesta, para vigilar su costa." },
      diplomacia: { pacta: 0.6, traiciona: 0 },
      nombre: "Los Caballeros del Reino", corto: "Brurland", color: "#c8a24a", bandera: "#7a1f2b", cultura: "comun", origen: "Brurland", curva: "Depende del mapa",
      resumen: "La élite militar de Brurland. Ejército profesional, fortificaciones y caballería pesada.",
      ventaja: "Las fortalezas dan +1 de defensa extra, empiezan con Disciplina y pueden forjar caballeros. Su magia no pasa del segundo escalón.",
      mods: { fortalezaDef: 1, arcanoMax: 2 }, escuelaInicial: ["militar", 1],
      lider: { titulo: "Mariscal del Reino", aura: { auraDef: 1 }, estado: { nombre: "El deber continúa", texto: "Sin su mariscal, todas las unidades ganan +1 de ataque.", atq: 1 } },
      origenes: ["voluntario", "habitante"], clasesExtra: ["caballero"], heroe: ["adam"],
      tropas: {
        guerrero: ["Miliciano", "Gambesón, capacete de hierro, lanza corta y el pendón del Reino pintado en el escudo."],
        cazador: ["Montaraz", "Capa parda, capucha y arco largo."],
        arcanista: ["Hechicero de armas", "Mago de campaña con cota bajo la túnica y una varita de hierro."],
        paladin: ["Escudero de Hierro", "Armadura completa y un pavés tan alto como él."],
        picaro: ["Batidor", "Explorador ligero con capa corta y daga."],
        caballero: ["Caballero", "Yelmo cerrado con penacho, lanza de carga y el escudo del Reino."],
        lider: ["Mariscal del Reino", "Armadura de gala, capa roja y corona de mando."]
      }
    },
    "academia-arcana-de-dolbred": {
      naval: { nivel: "Corrientes", texto: "Poca flota. Prefieren cambiar el terreno a cruzar el mar." },
      diplomacia: { pacta: 0.8, traiciona: 0.05 },
      nombre: "Academia Arcana de Dolbred", corto: "Dolbred", color: "#8f6fd8", bandera: "#2d2a6b", cultura: "comun", origen: "Dolbred", curva: "Tardío",
      resumen: "La mayor concentración de archimagos conocida. Investiga más rápido y juega con el terreno.",
      ventaja: "Empieza dominando Resonancia, investigar cuesta un 25 % menos de maná, los magos tienen +2 de vida y pueden invocar archimagos.",
      mods: { investigarMana: 0.75, hpClase: { arcanista: 2, archimago: 2 }, manaInicial: 5, atqClase: { arcanista: 1, archimago: 1 } }, escuelaInicial: ["arcano", 2],
      lider: { titulo: "Rector de la Academia", aura: { mana: 2 }, estado: { nombre: "Cierre de la Academia", texto: "Sin su rector, investigar cuesta el doble.", investigarMana: 2 } },
      origenes: ["eco", "voluntario"], clasesExtra: ["archimago"], heroe: ["brasa", "humores", "umbral"],
      tropas: {
        guerrero: ["Guardián del Colegio", "Media armadura sobre la toga y una alabarda con runas."],
        cazador: ["Cartógrafo de campo", "Sombrero de ala, tubo de mapas a la espalda y ballesta ligera."],
        arcanista: ["Adepto", "Túnica, capucha puntiaguda y el orbe de su Colegio."],
        paladin: ["Armadura animada", "Una armadura vacía movida por runas. Por la visera sale luz violeta."],
        picaro: ["Ilusionista", "Máscara lisa y una capa que cambia de color."],
        archimago: ["Archimago", "Sombrero de ala ancha, barba blanca y un cristal en el báculo."],
        lider: ["Rector de la Academia", "Toga de gala y birrete con las siete torres."]
      }
    },
    "trono-de-ceniza": {
      naval: { nivel: "A su manera", barcoMax: 1, barcos: ["nave_ahogados"], embarcaSinMuelle: true, fondo: true, movEmbarcada: 2, texto: "Los muertos no respiran: sus tropas cruzan el agua andando por el fondo, despacio, sin muelle y sin perder su defensa. Solo botan galeras y la Nave de los ahogados." },
      diplomacia: { pacta: 0.2, traiciona: 0.3 },
      nombre: "El Trono de Ceniza", corto: "Osses", color: "#9a9486", bandera: "#3d3a38", cultura: "sombrio", origen: "Osses", curva: "Desgaste", monstruos: true, irrefugiable: true,
      resumen: "El gobierno de la Unión de Osses: monstruos y no muertos bajo un mismo estandarte.",
      ventaja: "Sin gasto de comida, tropas baratas de Ánima, +2 de Ánima por ciudad y cada baja deja más. Las ciudades dan 1 de oro menos.",
      mods: { sinComida: true, oroCiudad: -1, anima_baja: 1, animaCiudad: 2 }, escuelaInicial: ["tanato", 2],
      lider: { titulo: "Ceniza Coronada", aura: { auraAtq: 1 }, estado: { nombre: "Los huesos no olvidan", texto: "Sin su soberano, todas las unidades ganan +2 de vida máxima.", hp: 2 } },
      origenes: ["criatura", "eco"], clasesExtra: ["esqueleto"], heroe: ["ceniciento"],
      tropas: {
        guerrero: ["Caminante", "Un cadáver armado con lo que llevaba al morir."],
        cazador: ["Acechador", "Necrófago encorvado que lanza esquirlas de hueso."],
        arcanista: ["Nigromante de la Cátedra", "Toga negra, capirote y un báculo con calavera."],
        paladin: ["Abominación", "Varios cuerpos cosidos en uno, con placas atornilladas."],
        picaro: ["Carroñero", "Necrófago flaco y rápido, de garras largas."],
        esqueleto: ["Legión de huesos", "Capucha rota, carne gris y una espada oxidada."],
        lider: ["Ceniza Coronada", "Corona de hierro sobre un cráneo y manto de ceniza."]
      }
    },
    "compania-dorada": {
      naval: { nivel: "Buenos", barcos: ["carraca"], muelleOro: 2, texto: "Compran sus flotas. Cada muelle les rinde 2 de oro más y tienen carracas mercantes." },
      diplomacia: { pacta: 0.7, traiciona: 0.4 },
      nombre: "Compañía Dorada", corto: "Compañía Dorada", color: "#e0b23a", bandera: "#5a4311", cultura: "comun", origen: "El continente", curva: "Empieza fuerte",
      resumen: "El ejército mercenario más grande del continente. Todo se resuelve con oro.",
      ventaja: "+3 de oro por ciudad, 12 de oro extra al empezar y mercenarios que se contratan al instante sin edificio.",
      mods: { oroCiudad: 3, oroInicial: 12 }, escuelaInicial: ["militar", 1],
      lider: { titulo: "Capitán General", aura: { oro: 3 }, estado: { nombre: "Contrato roto", texto: "Sin su capitán, el oro que rinde cada ciudad se reduce a la mitad.", oroMitad: true } },
      origenes: ["mercenario"], clasesExtra: ["mercenario"], heroe: ["mano_de_oro"],
      tropas: {
        guerrero: ["Alabardero a sueldo", "Jubón acuchillado amarillo y negro, sombrero con pluma y alabarda."],
        cazador: ["Ballestero contratado", "Ballesta de acero y un pavés pintado a la espalda."],
        arcanista: ["Hechicero a sueldo", "Anillos en todos los dedos y la bolsa de monedas a la vista."],
        paladin: ["Escudero de Oro", "Coraza dorada, morrión y rodela."],
        picaro: ["Cuchillo de alquiler", "Antifaz, capa corta y dos dagas."],
        mercenario: ["Mercenario", "Pañuelo rojo, parche en el ojo y espadón."],
        lider: ["Capitán General", "Coraza dorada, banda de mando y sombrero de plumas."]
      }
    },
    "hijos-del-acero": {
      naval: { nivel: "Flojos", barcoMax: 2, texto: "Cazadores de tierra firme. No pasan del astillero." },
      diplomacia: { pacta: 0.6, traiciona: 0 },
      nombre: "Hijos del Acero", corto: "Hijos del Acero", color: "#9fb0bd", bandera: "#2b3a45", cultura: "comun", origen: "Internacional", curva: "Pico",
      resumen: "Mercenarios que solo cazan monstruos. Una ballesta bien puesta vale por un ejército.",
      ventaja: "+2 de ataque contra monstruos y criaturas salvajes, y ballesteros pesados de serie.",
      mods: { atqMonstruo: 2 }, escuelaInicial: ["militar", 1],
      lider: { titulo: "Maestro Cazador", aura: { atqMonstruo: 1 }, estado: { nombre: "La caza no se detiene", texto: "Sin su maestro, los cazadores y ballesteros ganan +1 de ataque.", atqClases: { cazador: 1, ballestero: 1 } } },
      origenes: ["mercenario", "voluntario"], clasesExtra: ["ballestero"], heroe: ["rykerd"],
      tropas: {
        guerrero: ["Alanceador de caza", "Abrigo de cuero con trofeos y una lanza de jabalí con travesaño."],
        cazador: ["Batidor de caza", "Sombrero de ala ancha, arco y capa de montero."],
        arcanista: ["Alquimista de cazadores", "Máscara de filtros y bandolera de frascos."],
        paladin: ["Escudero de cacería", "Escudo de torre con marcas de garras."],
        picaro: ["Rastreador", "Capa de pieles y cuchillos de desollar."],
        ballestero: ["Ballestero pesado", "Celada, ballesta de torno y virotes gruesos."],
        lider: ["Maestro Cazador", "Sombrero de ala, abrigo largo y una cabeza de monstruo al cinto."]
      }
    },
    "santos-de-asmodeo": {
      naval: { nivel: "Corrientes", texto: "Flota de cruzada, sin nada propio." },
      diplomacia: { pacta: 0.6, traiciona: 0.3, soloHumanos: true },
      nombre: "Santos de Asmodeo", corto: "Santos de Asmodeo", color: "#efe2b8", bandera: "#8a1c1c", cultura: "comun", origen: "Ithranor", curva: "Depende del mapa",
      resumen: "El brazo armado de la Iglesia de Asmodeo. Una teocracia de clérigos y paladines en cruzada.",
      ventaja: "Consagran el terreno: en casillas consagradas sus tropas tienen +1 de defensa y se curan. Los paladines son más recios y baratos.",
      mods: { consagra: true, curaExtra: 1, costeClase: { paladin: { oro: -1 }, sanador: { oro: -1 } }, hpClase: { paladin: 2 } }, escuelaInicial: ["militar", 1],
      lider: { titulo: "Primado de Ithranor", aura: { cura: 2 }, estado: { nombre: "La cruzada sigue", texto: "Sin su primado, todas las unidades ganan +1 de defensa.", def: 1 } },
      origenes: ["voluntario", "habitante"], clasesExtra: ["sanador"], heroe: ["vigilante"],
      tropas: {
        guerrero: ["Cruzado", "Gran yelmo, sobreveste blanca con el sol rojo de Asmodeo y espada."],
        cazador: ["Vigía del Camino", "Capelina de hierro, arco y un farol al cinto."],
        arcanista: ["Oficiante del Alba", "Casulla blanca y roja y un incensario encendido."],
        paladin: ["Paladín de la Pureza", "Armadura blanca completa, maza y un halo de metal en el yelmo."],
        picaro: ["Confesor", "Hábito oscuro, capucha y un punzón dentro del breviario."],
        sanador: ["Consagrador", "Sacerdote con estola roja y báculo solar."],
        lider: ["Primado de Ithranor", "Mitra, capa pluvial y un báculo de oro."]
      }
    },
    nikaalia: {
      naval: { nivel: "Buenos", texto: "Contrabandistas. Sus barcos, como sus tropas, no se ven hasta tenerlos encima." },
      diplomacia: { pacta: 0.8, traiciona: 0.5 },
      nombre: "Natonocturnos de Nikaalia", corto: "Nikaalia", color: "#c05aa8", bandera: "#1c1026", cultura: "nocturno", origen: "Nikaalia", curva: "Empieza fuerte",
      resumen: "Las familias de Umbrathil, criadas bajo la noche eterna del domo. Gánsteres antes que soldados.",
      ventaja: "Noche eterna: los rivales ven una casilla menos y sus tropas no se ven hasta tener un enemigo al lado. Sobornan criaturas con oro. Tienen pistoleros.",
      mods: { noche: true, soborno: 4, oroInicial: 6, polvora: { cazador: true } }, escuelaInicial: ["tanato", 1],
      lider: { titulo: "El Don", aura: { oro: 2 }, estado: { nombre: "Guerra de familias", texto: "Sin su Don, todas las unidades ganan +1 de ataque.", atq: 1 } },
      origenes: ["mercenario", "habitante"], clasesExtra: ["capo"], heroe: ["ottavio"],
      tropas: {
        guerrero: ["Matón", "Gabardina, sombrero de ala y un tubo de plomo."],
        cazador: ["Pistolero de callejón", "Traje oscuro, sombrero calado y pistola de rueda."],
        arcanista: ["Alquimista de Bajovela", "Delantal de cuero, gafas ahumadas y frascos de Nigredo."],
        paladin: ["Guardaespaldas", "Enorme, con abrigo largo sobre placas y una puerta de carruaje por escudo."],
        picaro: ["Sicario", "Guantes, bufanda sobre la cara y un estilete."],
        capo: ["Capo", "Traje de raya, abrigo sobre los hombros y bastón de estoque."],
        lider: ["El Don", "Abrigo de pieles, sombrero y un anillo en cada dedo."]
      }
    },
    seosan: {
      naval: { nivel: "Buenos", barcoMov: 1, texto: "Juncos rápidos: sus barcos tienen +1 de movimiento." },
      diplomacia: { pacta: 0.5, traiciona: 0 },
      nombre: "Escuelas de Seosan", corto: "Seosan", color: "#5fc08f", bandera: "#173528", cultura: "seosan", origen: "Seosan", curva: "Depende del mapa",
      resumen: "Escuelas marciales que se respetan entre sí y resuelven sus asuntos en duelo.",
      ventaja: "Duelo: +2 de ataque contra una unidad que está sola, y en ese combate nadie recibe ayuda de los que tiene al lado. Sus maestros de escuela lo aprovechan todavía más.",
      mods: { duelo: 2 }, escuelaInicial: ["militar", 1],
      lider: { titulo: "Gran Maestro de Kaishoto", aura: { auraAtq: 1 }, estado: { nombre: "Los discípulos recuerdan", texto: "Sin su maestro, todas las unidades ganan +1 de defensa.", def: 1 } },
      origenes: ["voluntario", "habitante"], clasesExtra: ["maestro"], heroe: ["kirin"],
      tropas: {
        guerrero: ["Discípulo de escuela", "Ropa ceñida, cinta en la frente y sable."],
        cazador: ["Arquero de Yumigaoka", "Sombrero de paja y un arco más alto que él."],
        arcanista: ["Monje de Senkai", "Túnica azafrán, sombrero de cesta y un rosario grande."],
        paladin: ["Guardián de templo", "Armadura lacada de láminas, máscara de demonio y lanza de hoja curva."],
        picaro: ["Sombra de Tetsumura", "De negro, con la cara tapada y una hoja corta."],
        maestro: ["Maestro de escuela", "Kimono con el emblema de su escuela y dos sables."],
        lider: ["Gran Maestro de Kaishoto", "Yelmo de cuernos, armadura lacada y abanico de mando."]
      }
    },
    okran: {
      naval: { nivel: "Torpes", barcoMax: 1, muelleCoste: 2, movEmbarcada: 2, texto: "Gente de las Tierras Altas. Los muelles les cuestan el doble, solo botan galeras y embarcados van despacio." },
      diplomacia: { pacta: 0.4, traiciona: 0.4 },
      nombre: "Clanes de Okran", corto: "Okran", color: "#b8672e", bandera: "#33200f", cultura: "okran", origen: "Okran", curva: "Empieza fuerte",
      resumen: "Clanes bárbaros y hombres bestia de las Tierras Altas. Solo respetan la fuerza.",
      ventaja: "Furia: +1 de ataque por cada cuarto de vida perdido, hasta +3. Sus tropas no necesitan edificios para lo básico.",
      mods: { furia: 3, monstruoClases: ["paladin", "picaro"] }, escuelaInicial: ["militar", 1],
      lider: { titulo: "Jefe de Vornhaal", aura: { auraAtq: 1 }, estado: { nombre: "Sangre por el jefe", texto: "Sin su jefe, todas las unidades ganan +1 de ataque.", atq: 1 } },
      origenes: ["habitante", "criatura"], clasesExtra: ["berserker"], heroe: ["ebonrabia"],
      tropas: {
        guerrero: ["Guerrero de clan", "Pieles, pintura de guerra y un hacha de dos manos."],
        cazador: ["Lanzador de huesos", "Collar de dientes y un haz de jabalinas de hueso."],
        arcanista: ["Chamán de huesos", "Un cráneo de ciervo por máscara y un bastón con sonajas."],
        paladin: ["Gran hombre bestia", "Mitad hombre y mitad bisonte, con cuernos y un tronco por maza."],
        picaro: ["Acechador de estepa", "Hombre lobo flaco con una capa de hierba seca."],
        berserker: ["Berserker", "Torso desnudo lleno de cicatrices y un hacha en cada mano."],
        lider: ["Jefe de Vornhaal", "Capa de oso, casco de cuernos y un hacha enorme."]
      }
    },
    pelgiria: {
      naval: { nivel: "Maestros", barcos: ["bergantin"], barcoMov: 1, barcoAtq: 1, muelleCoste: 0.5, embarcaSinMuelle: true, marinos: true, movEmbarcada: 4, texto: "El mar es su casa. Embarcan y desembarcan sin perder el turno ni la defensa, pelean embarcados, sus muelles cuestan la mitad y sus barcos son más rápidos y pegan más." },
      diplomacia: { pacta: 0.7, traiciona: 0.4 },
      nombre: "Hermandad de Cala Ronca", corto: "Pelgiria", color: "#36a9b0", bandera: "#0f3138", cultura: "pelgiria", origen: "Pelgiria", curva: "Depende del mapa",
      resumen: "Piratas del archipiélago de Pelgiria. Pólvora, abordajes y tortugas de mar gigantes.",
      ventaja: "Maestros del mar: embarcan sin muelle y sin perder el turno, pelean embarcados y sus barcos son los mejores. Tienen arcabuceros, cañoneros y barrileros que explotan.",
      mods: { polvora: { cazador: true, arcanista: true } }, escuelaInicial: ["militar", 1],
      lider: { titulo: "Capitán de la Hermandad", aura: { oro: 2 }, estado: { nombre: "Cada cual a lo suyo", texto: "Sin su capitán, todas las unidades ganan +1 de ataque.", atq: 1 } },
      origenes: ["mercenario", "habitante"], clasesExtra: ["barrilero"], heroe: ["dientesal"],
      tropas: {
        guerrero: ["Marinero de abordaje", "Pañuelo en la cabeza, sable corto y rodela."],
        cazador: ["Arcabucero de cubierta", "Tricornio y un arcabuz largo."],
        arcanista: ["Cañonero", "Empuja un cañón ligero de cubierta con la mecha lista."],
        paladin: ["Jinete de escudonte", "Montado en una tortuga gigante con castillete en el caparazón."],
        picaro: ["Contrabandista", "Capa encerada, farol ciego y puñal."],
        barrilero: ["Barrilero", "Carga a la espalda un barril de pólvora con la mecha encendida."],
        lider: ["Capitán de la Hermandad", "Casaca larga, tricornio con pluma y sable."]
      }
    },
    mravec: {
      naval: { nivel: "Negados", barcoMax: 0, sinMuelle: true, embarcaSinMuelle: true, movEmbarcada: 2, texto: "Hijos del desierto. No construyen muelles ni barcos. Cruzan el agua en balsas de quitina, despacio y sin defensa." },
      diplomacia: { pacta: 0, traiciona: 0 },
      nombre: "Satrapía de Mravec", corto: "Mravec", color: "#b4c23a", bandera: "#3d3a10", cultura: "mravec", origen: "Mravec", curva: "Tardío", monstruos: true, irrefugiable: true,
      resumen: "Insectoides del desierto, descendientes de la Reina Hormiga. Lo que devoran, lo aprenden.",
      ventaja: "Devorar y adaptar: tres de sus tropas ganan un rasgo del enemigo que matan (hasta dos por unidad).",
      mods: { devora: ["guerrero", "picaro", "quimera"] }, escuelaInicial: ["tanato", 1],
      lider: { titulo: "Voz de la Satrapía", aura: { auraDef: 1 }, estado: { nombre: "El Panal se cierra", texto: "Sin su voz, todas las unidades ganan +2 de vida máxima.", hp: 2 } },
      origenes: ["criatura"], clasesExtra: ["quimera"], heroe: ["zaphar"],
      tropas: {
        guerrero: ["Guerrera del Panal", "Hormiga soldado erguida, de cuatro brazos, con lanza y escudo de quitina."],
        cazador: ["Escupidor de ácido", "Abdomen hinchado y mandíbulas que gotean."],
        arcanista: ["Sacerdote de Quitina", "Mantis con velo y un báculo de ámbar."],
        paladin: ["Centinela de quitina", "Escarabajo acorazado con un cuerno."],
        picaro: ["Acechador de arena", "Hormiga león de pinzas largas, medio enterrada."],
        quimera: ["Quimera", "Mezcla de lo que ha devorado: alas, pinzas y aguijón."],
        lider: ["Voz de la Satrapía", "Insecto alto y delgado con corona de ámbar y manto de alas."]
      }
    },
    nernib: {
      naval: { nivel: "Buenos", barcos: ["acorazado"], barcoDef: 1, texto: "Ingeniería naval: sus barcos tienen +1 de defensa y construyen acorazados de vapor." },
      diplomacia: { pacta: 0.6, traiciona: 0.1 },
      nombre: "Oligarquía de Nernib", corto: "Nernib", color: "#6fb6e0", bandera: "#26323e", cultura: "nernib", origen: "Nernib", curva: "Tardío",
      resumen: "Ciudad-estado de gnomos y forjados. Lo que no pueden vencer, lo fabrican.",
      ventaja: "Taller: construyen autómatas que no comen, y el taller entrega uno gratis cada 4 turnos (hasta 3). Tienen fusileros.",
      mods: { taller: true, polvora: { cazador: true } }, escuelaInicial: ["arcano", 1],
      lider: { titulo: "Oligarca", aura: { mana: 2 }, estado: { nombre: "Protocolo de emergencia", texto: "Sin su oligarca, todas las unidades ganan +1 de defensa.", def: 1 } },
      origenes: ["voluntario", "eco"], clasesExtra: ["automata"], heroe: ["engranaje"],
      tropas: {
        guerrero: ["Operario acorazado", "Un gnomo dentro de un traje de placas remachadas, con martillo de vapor."],
        cazador: ["Artillero de Balistrix", "Un gnomo con gafas y un fusil más largo que él."],
        arcanista: ["Artificiero gnomo", "Mochila de bobinas y un guantelete que chispea."],
        paladin: ["Forjado", "Constructo de metal y madera con un solo ojo de luz."],
        picaro: ["Explorador mecánico", "Autómata pequeño de patas largas con una lente por cabeza."],
        automata: ["Autómata", "Obrero de latón con brazos de pistón."],
        lider: ["Oligarca", "Un gnomo anciano en un trono andante de latón."]
      }
    },
    balutia: {
      naval: { nivel: "Buenos", barcos: ["trirreme"], texto: "La flota del Imperio embiste: tienen trirremes." },
      diplomacia: { pacta: 0.6, traiciona: 0.4 },
      nombre: "Imperio de Balutia", corto: "Balutia", color: "#c23a3a", bandera: "#3a0f14", cultura: "balutia", origen: "Balutia", curva: "Pico",
      resumen: "El imperio de las legiones. Conquista una provincia y pone a su gente en primera fila.",
      ventaja: "Tributo: cada ciudad que conquista le entrega un Auxiliar de provincias (hasta 3). Tropas baratas de la Ergástula.",
      mods: { tributo: 3, polvora: { arcanista: true } }, escuelaInicial: ["militar", 1],
      lider: { titulo: "Legado del Emperador", aura: { auraDef: 1 }, estado: { nombre: "La legión no se rinde", texto: "Sin su legado, todas las unidades ganan +1 de ataque.", atq: 1 } },
      origenes: ["voluntario", "habitante"], clasesExtra: ["condenado"], heroe: ["orsa"],
      tropas: {
        guerrero: ["Legionario", "Escudo rectangular, yelmo con carrilleras y espada corta."],
        cazador: ["Auxiliar de provincias", "Tropa de las provincias, con jabalinas y escudo ovalado."],
        arcanista: ["Pirotecnista del Yunque", "Mandil de herrero y un tubo de fuego del Yunque Ardiente."],
        paladin: ["Pretoriano", "Coraza musculada, capa púrpura y penacho."],
        picaro: ["Delator de la Corte", "Toga gris, tablilla de cera y un puñal en la manga."],
        condenado: ["Condenado de la Ergástula", "Un preso con los grilletes rotos y un arma prestada."],
        lider: ["Legado del Emperador", "Coraza dorada, capa púrpura y corona de laurel."]
      }
    }
  };
  // Identificadores antiguos que siguen valiendo para los ejércitos ya guardados
  const ALIAS_FACCION = { "peregrinos-del-alba": "santos-de-asmodeo" };
  const faccionReal = id => ALIAS_FACCION[id] || id;
  /* Nombre, rol y texto de una clase tal como se llama en un ejército concreto */
  function tropa(faccion, clase) {
    const cl = CLASES[clase] || {};
    const f = FACCIONES[faccionReal(faccion)];
    const t = f && f.tropas && f.tropas[clase];
    const polvora = !!(f && f.mods.polvora && f.mods.polvora[clase]);
    return { nombre: t ? t[0] : cl.nombre || clase, aspecto: t ? t[1] : "", rol: cl.rol || "", texto: (cl.texto || "") + (polvora ? " Usa pólvora: pega 2 más y atraviesa 1 de defensa, pero no puede moverse y disparar en el mismo turno." : ""), polvora };
  }

  /* --- Héroes. Uno por ejército (Dolbred sortea uno por Colegio). Son ecos: no ganan experiencia ni llevan equipo.
         req: lo que se comprueba al invocar. ef: lo que hacen (lo lee el motor). --- */
  const HEROES = {
    adam: { faccion: "caballeros-del-reino", nombre: "Adam Kovacs", titulo: "Capitán de los Caballeros del Reino", nivel: 1, hp: 20, atq: 5, def: 4, mov: 3, alc: 1,
      coste: { comida: 3, oro: 4, mineral: 3 }, req: [{ t: "fortaleza" }, { t: "edificio", id: "herreria" }],
      ef: { auraAtq2: 1, activa: { id: "formar", nombre: "Formad filas", texto: "Los aliados a su lado ganan +1 de defensa hasta tu próximo turno.", cd: 3 } },
      texto: "Los aliados a 2 casillas ganan +1 de ataque.", aspecto: "Armadura azul y oro de los Caballeros, capa blanca y espadón." },
    mano_de_oro: { faccion: "compania-dorada", nombre: "Mano de Oro", titulo: "Ha servido y combatido contra casi todos", nivel: 1, hp: 19, atq: 5, def: 3, mov: 3, alc: 1,
      coste: { oro: 12 }, req: [],
      ef: { llegaCon: ["mercenario", "mercenario"], oroTurno: 2, activa: { id: "contratar", nombre: "Todo tiene un precio", texto: "Paga 4 de oro: una criatura salvaje a su lado lucha por ti 3 turnos.", cd: 2, coste: { oro: 4 } } },
      texto: "Llega con 2 mercenarios y da +2 de oro por turno.", aspecto: "Un guantelete de oro macizo, coraza negra y capa amarilla." },
    engranaje: { faccion: "nernib", nombre: "Primer Engranaje", titulo: "El primer forjado de Nernib", nivel: 1, hp: 20, atq: 4, def: 4, mov: 3, alc: 1,
      coste: { materiales: 10, mineral: 2 }, req: [{ t: "edificio", id: "taller" }],
      ef: { llegaCon: ["automata", "automata"], atqClaseAliada: { automata: 1 } },
      texto: "Llega con 2 autómatas. Tus autómatas tienen +1 de ataque.", aspecto: "Forjado antiguo de bronce verdoso con un gran engranaje en el pecho." },
    ottavio: { faccion: "nikaalia", nombre: "Don Ottavio Umbral", titulo: "Dueño del Mercado de las Sombras", nivel: 1, hp: 18, atq: 5, def: 3, mov: 3, alc: 1,
      coste: { oro: 10 }, req: [{ t: "mercado" }],
      ef: { sobornoMitad: true, velo: true, activa: { id: "contratar", nombre: "Una oferta", texto: "Paga 2 de oro: una criatura salvaje a su lado lucha por ti 3 turnos.", cd: 2, coste: { oro: 2 } } },
      texto: "Sus sobornos cuestan la mitad. Los aliados a su lado no pueden ser atacados desde lejos.", aspecto: "Traje blanco, abrigo negro, sombrero y un bastón con pomo de cuervo." },
    brasa: { faccion: "academia-arcana-de-dolbred", nombre: "Ilvaren Brasalba", titulo: "Colegio de la Brasa Viva", nivel: 2, hp: 22, atq: 5, def: 3, mov: 3, alc: 3, magia: true,
      coste: { mana: 10, oro: 4 }, req: [{ t: "edificio", id: "torre_magia" }, { t: "escuela", e: "arcano", n: 3 }], variantes: ["Ilvaren Brasalba", "Konnovan, el zorro de fuego"],
      ef: { activa: { id: "area", nombre: "Pira", texto: "3 de daño a todo lo que haya en un cuadro de 3x3, hasta a 3 casillas.", cd: 4, dano: 3, alc: 3 } },
      texto: "Ataca a 3 casillas.", aspecto: "Elfo de fuego, con la melena y la túnica a medio arder." },
    humores: { faccion: "academia-arcana-de-dolbred", nombre: "Maese Croacio Verruguilla", titulo: "Colegio de los Humores", nivel: 2, hp: 22, atq: 4, def: 3, mov: 3, alc: 2, magia: true,
      coste: { mana: 10, oro: 4 }, req: [{ t: "edificio", id: "torre_magia" }, { t: "escuela", e: "arcano", n: 3 }], variantes: ["Maese Croacio Verruguilla", "El Decano de los Fundamentos"],
      ef: { manaTurno: 2, activa: { id: "curar", nombre: "Triaca", texto: "Cura 4 a todos los aliados a 2 casillas.", cd: 3, cura: 4, radio: 2 } },
      texto: "+2 de maná por turno.", aspecto: "Hombre sapo pequeño con máscara de médico de la peste y maletín de ampollas." },
    umbral: { faccion: "academia-arcana-de-dolbred", nombre: "Custodia Aldenvar", titulo: "Colegio del Umbral", nivel: 2, hp: 24, atq: 4, def: 4, mov: 3, alc: 1, magia: true,
      coste: { mana: 10, oro: 4 }, req: [{ t: "edificio", id: "torre_magia" }, { t: "escuela", e: "arcano", n: 3 }], variantes: ["Custodia Aldenvar", "Ysolde Vaelward, guardiana de Vaelmoot"],
      ef: { auraDef1: 2, activa: { id: "muro", nombre: "Muro de runas", texto: "Bloquea una casilla vacía durante 2 turnos.", cd: 4, alc: 3 } },
      texto: "Los aliados a su lado ganan +2 de defensa.", aspecto: "Anciana alta con armadura de pergaminos rúnicos y un grimorio por escudo." },
    ceniciento: { faccion: "trono-de-ceniza", nombre: "El Ceniciento", titulo: "Mano de Ceniza Coronada", nivel: 2, hp: 23, atq: 5, def: 3, mov: 3, alc: 1, muertoViviente: true,
      coste: { anima: 10 }, req: [{ t: "escuela", e: "tanato", n: 3 }, { t: "cuenta", k: "perdidas", n: 1, texto: "Haber perdido una unidad en esta guerra" }],
      ef: { alzaCaidos: true, activa: { id: "alzar", nombre: "Volved", texto: "Una sola vez: levanta al aliado caído más fuerte, con 2 de vida.", cd: 99 } },
      texto: "Cuando muere un aliado a 2 casillas, aparece una Legión de huesos (una por turno).", aspecto: "Armadura quemada, un manto de ceniza que no deja de caer y brasas por ojos." },
    vigilante: { faccion: "santos-de-asmodeo", nombre: "El Vigilante", titulo: "Custodio de la Catedral de la Vigilia", nivel: 2, hp: 24, atq: 5, def: 3, mov: 3, alc: 1,
      coste: { oro: 8, mana: 4 }, req: [{ t: "edificio", id: "catedral" }, { t: "consagradas", n: 12 }],
      ef: { consagraAlPisar: true, escudoAliados: true },
      texto: "Consagra las casillas que pisa. Los aliados a su lado ignoran el primer golpe de cada turno.", aspecto: "Armadura blanca sin rostro, seis alas de metal plegadas y una espada de llama." },
    kirin: { faccion: "seosan", nombre: "El Kirin", titulo: "La bestia del trueno de Senkai", nivel: 2, hp: 22, atq: 5, def: 3, mov: 4, alc: 2, magia: true, bestia: true,
      coste: { mana: 6, oro: 6 }, req: [{ t: "edificio", id: "dojo" }, { t: "cuenta", k: "duelos", n: 3, texto: "Ganar 3 duelos (matar a una unidad que está sola)" }],
      ef: { linea: true, clava: true },
      texto: "Su rayo alcanza también a quien esté detrás del objetivo. A quien golpea no puede moverse en su siguiente turno.", aspecto: "Ciervo dragón de escamas de jade, crin de rayos y un solo cuerno." },
    ebonrabia: { faccion: "okran", nombre: "Ebonrabia", titulo: "De la sangre del Behemoth", nivel: 2, hp: 24, atq: 5, def: 3, mov: 3, alc: 1, bestia: true,
      coste: { comida: 6, oro: 4 }, req: [{ t: "edificio", id: "circulo_huesos" }, { t: "cuenta", k: "racha", n: 3, texto: "Matar a 3 enemigos seguidos sin perder ninguna unidad" }],
      ef: { furia: 5, curaAlMatar: 4 },
      texto: "Su furia llega a +5 de ataque y se cura 4 cada vez que mata.", aspecto: "Bestia negra de lomo erizado, colmillos de jabalí y ojos rojos." },
    dientesal: { faccion: "pelgiria", nombre: "Capitana Dientesal", titulo: "La voz de Cala Ronca", nivel: 2, hp: 22, atq: 5, def: 3, mov: 3, alc: 2,
      coste: { oro: 10, materiales: 4 }, req: [{ t: "edificio", id: "astillero" }, { t: "cuenta", k: "saqueos", n: 2, texto: "Tomar 2 ciudades" }],
      ef: { activa: { id: "area", nombre: "Andanada de barriles", texto: "3 de daño a todo lo que haya en un cuadro de 3x3, hasta a 3 casillas.", cd: 3, dano: 3, alc: 3 }, activa2: { id: "curar", nombre: "Limonada de a bordo", texto: "Cura 3 a los aliados a 2 casillas.", cd: 3, cura: 3, radio: 2 } },
      texto: "Ataca a 2 casillas con su pistola.", aspecto: "Casaca roja, tricornio, un diente de sal por colmillo y dos pistolas." },
    zaphar: { faccion: "mravec", nombre: "Zaphar", titulo: "Primer vástago de la Reina", nivel: 2, hp: 22, atq: 5, def: 3, mov: 3, alc: 1, bestia: true,
      coste: { comida: 8, mineral: 4 }, req: [{ t: "cuenta", k: "devorados", n: 5, texto: "Devorar a 5 enemigos" }],
      ef: { devoraSinTope: true },
      texto: "Devora y adapta sin límite: cada enemigo que mata le deja un rasgo.", aspecto: "Hormiga reina guerrera, alta, con alas de ámbar y mandíbulas doradas." },
    orsa: { faccion: "balutia", nombre: "Legada Orsa Valcarón", titulo: "Conquistadora de provincias", nivel: 2, hp: 23, atq: 5, def: 3, mov: 3, alc: 1,
      coste: { oro: 10, mineral: 3 }, req: [{ t: "regiones", n: 3 }],
      ef: { tributoMejor: true, defClaseAliada: { cazador: 1 } },
      texto: "El Tributo entrega un Pretoriano en vez de un Auxiliar. Los Auxiliares ganan +1 de defensa.", aspecto: "Coraza de bronce, capa púrpura, yelmo con penacho transversal y un estandarte con águila." },
    rykerd: { faccion: "hijos-del-acero", nombre: "Rykerd, el Imperdonable", titulo: "Lo que los Hijos del Acero no debieron cazar", nivel: 3, hp: 30, atq: 6, def: 3, mov: 3, alc: 1, muertoViviente: true,
      coste: { oro: 12, mineral: 8, comida: 6, anima: 4 }, req: [{ t: "fortaleza" }, { t: "cuenta", k: "salvajes", n: 3, texto: "Cazar 3 criaturas salvajes" }, { t: "escuela", e: "militar", n: 3 }, { t: "edificio", id: "perrera" }, { t: "turno", n: 8 }],
      ef: { temible: 1, rencor: 2, contencion: true },
      texto: "Los enemigos a su lado pierden 1 de ataque. Gana +2 de ataque cada vez que muere un aliado. Si cae el Maestro Cazador, se desata 3 turnos.", aspecto: "Un caballero muerto y enorme, cargado de cadenas rotas, con un mandoble mellado." }
  };

  /* --- Mapas: cada tipo de Fractura cambia los terrenos, las cosas neutrales y las reglas del lugar --- */
  const TIPOS_FRACTURA = {
    reinos: { nombre: "La Fractura de los Reinos", texto: "Fortalezas, ciudades y fronteras medievales. Es el mapa más estable.",
      terrenos: { llanura: 40, bosque: 22, montana: 15, desierto: 6, agua: 8, magica: 5, huesos: 4 }, estab: [60, 95], tiposFragmento: { estable: 70, onirico: 25, imposible: 5 },
      neutrales: 6, fortalezas: 2, ruinas: 4, costuras: 2, costurasMueven: false, vacio: 0 },
    muertos: { nombre: "El Sueño de los Muertos", texto: "Necrópolis y campos de batalla donde los caídos vuelven a levantarse. El Ánima abunda.",
      terrenos: { llanura: 25, bosque: 12, montana: 12, desierto: 10, agua: 4, magica: 7, huesos: 30 }, estab: [35, 75], tiposFragmento: { estable: 30, onirico: 50, imposible: 20 },
      neutrales: 5, fortalezas: 2, ruinas: 5, costuras: 2, costurasMueven: true, vacio: 0, reviven: true },
    jardin: { nombre: "El Jardín Imposible", texto: "Bosques y criaturas extrañas. Los territorios se expanden y los recursos crecen solos.",
      terrenos: { llanura: 22, bosque: 40, montana: 8, desierto: 3, agua: 15, magica: 10, huesos: 2 }, estab: [40, 80], tiposFragmento: { estable: 35, onirico: 55, imposible: 10 },
      neutrales: 7, fortalezas: 1, ruinas: 3, costuras: 3, costurasMueven: true, vacio: 0, crece: true },
    archivo: { nombre: "El Archivo Hundido", texto: "Ruinas de civilizaciones olvidadas y laboratorios. Hay más reliquias y más guardianes.",
      terrenos: { llanura: 28, bosque: 8, montana: 20, desierto: 18, agua: 6, magica: 14, huesos: 6 }, estab: [45, 85], tiposFragmento: { estable: 50, onirico: 20, imposible: 30 },
      neutrales: 4, fortalezas: 2, ruinas: 8, costuras: 2, costurasMueven: false, vacio: 0, reliquias: true },
    horizonte: { nombre: "El Horizonte Roto", texto: "Fragmentos flotantes, conexiones inestables y recursos escasos. Las costuras cambian de sitio.",
      terrenos: { llanura: 30, bosque: 10, montana: 12, desierto: 8, agua: 0, magica: 10, huesos: 2, vacio: 28 }, estab: [20, 60], tiposFragmento: { estable: 15, onirico: 35, imposible: 50 },
      neutrales: 5, fortalezas: 1, ruinas: 4, costuras: 4, costurasMueven: true, vacio: 28, escaso: true }
  };

  /* Formas del mapa: cómo se reparten la tierra y el agua. maritimo: hace falta el mar para llegar a los demás. */
  const FORMAS_MAPA = {
    continente: { nombre: "Continente", texto: "Una sola masa de tierra con algún lago. El mar la rodea y sirve para flanquear." },
    lagos: { nombre: "Tierra de lagos", texto: "Tierra firme salpicada de lagos grandes. Los pasos entre ellos se defienden bien." },
    rios: { nombre: "Ríos", texto: "Ríos que bajan de las sierras y parten el mapa. Se cruzan por los vados o embarcando." },
    continentes: { nombre: "Continentes", texto: "Cada bando en su tierra, con un brazo de mar por medio. El Núcleo, en una isla.", maritimo: true },
    archipielago: { nombre: "Archipiélago", texto: "Islas pequeñas. Quien manda en el mar, manda en la guerra.", maritimo: true },
    mar_interior: { nombre: "Mar interior", texto: "Un anillo de tierra alrededor de un mar, con el Núcleo en una isla en el centro.", maritimo: true }
  };

  /* Fragmentos: nombres de lugares reales del compendio (estables) o inventados (oníricos e imposibles) */
  const FRAGMENTOS = {
    estable: ["Osses", "Brurland", "Dolbred", "Nernib", "Seosan", "Rasganorte", "Thanea", "Uldum", "Relania", "Kalvia", "Mravec", "Broneland", "Cudbusland", "Galadhel", "Okran", "Genevia", "Chakur", "Merador"],
    onirico: ["El Sueño del Granero", "La Casa de los Pasos", "El Bosque que Recuerda", "La Plaza Sin Hora", "El Pozo Dormido", "La Feria Olvidada", "La Colina del Eco",
      "El Camino de Vuelta", "La Orilla de Nadie", "El Huerto de Invierno", "La Torre que Sueña", "El Puente Dormido", "La Era de las Cigarras", "El Patio de las Voces", "La Vega Quieta"],
    imposible: ["El Mar Vertical", "La Estrella Fortaleza", "La Ciudad Sin Nombre", "El Campo de los Que No Mueren", "La Escalera al Revés", "El Cielo Hundido", "La Biblioteca de Humo",
      "El Faro Enterrado", "La Lluvia Detenida", "El Reloj de Arena Roto", "La Montaña Hueca", "El Río que Sube", "La Sala de los Espejos", "El Jardín de Sal", "La Costa Doblada"]
  };

  /* Sucesos de los fragmentos inestables */
  const SUCESOS = ["criatura", "costura", "terreno", "recurso"];

  const DIFICULTADES = {
    facil: { nombre: "Fácil", erra: 0.35, bonoRecursos: 0, investiga: false, enfoca: false, tropas: 4 },
    normal: { nombre: "Normal", erra: 0.1, bonoRecursos: 0, investiga: true, enfoca: true, tropas: 6 },
    dificil: { nombre: "Difícil", erra: 0, bonoRecursos: 0.25, investiga: true, enfoca: true, tropas: 8 }
  };

  /* --- Soldados: nombres inventados (nada del canon) --- */
  const NOMBRES = {
    comun: {
      m: ["Ardan", "Bram", "Olen", "Tomas", "Ivo", "Dorin", "Kael", "Marek", "Sorin", "Taven", "Ulric", "Varo", "Wendel", "Yoren", "Eldric", "Fenn", "Garrick", "Hollis", "Joren", "Lucan",
        "Merrick", "Nestor", "Orrin", "Perrin", "Quill", "Rhodan", "Stellan", "Tamsin", "Alaric", "Bastien", "Corvin", "Dax", "Emeric", "Finnian", "Gideon", "Harlan", "Isidor", "Jasper", "Kellan", "Leopold"],
      f: ["Mira", "Elen", "Sera", "Alma", "Brisa", "Cora", "Dalia", "Edda", "Freya", "Gala", "Hilde", "Inara", "Jessa", "Kira", "Lena", "Maren", "Nara", "Orla", "Petra", "Quilla",
        "Rosa", "Selma", "Tessa", "Una", "Vera", "Wren", "Ximena", "Yara", "Zora", "Aldara", "Berta", "Clea", "Dana", "Esme", "Fiora", "Greta", "Helga", "Irene", "Juna", "Katia"],
      casas: ["Aldrich", "Brandt", "Corvane", "Dunmore", "Estrel", "Falke", "Garrow", "Holt", "Ilmar", "Jarrow", "Kestrel", "Lorne", "Marrow", "Norvik", "Ostrava", "Pell", "Quarry", "Ravenne", "Selk", "Thorne",
        "Ulmer", "Valdis", "Whitlock", "Yarrow", "Zeller", "Ambrose", "Blackmere", "Cairn", "Dorrance", "Everard", "Fennick", "Grayle", "Hartwell", "Ironside", "Jessup", "Kingsley", "Lockhart", "Mournel", "Northcott", "Oakheart"]
    },
    sombrio: {
      m: ["Grakk", "Murn", "Osk", "Harg", "Tzul", "Brakh", "Vorn", "Skarn", "Dreg", "Korvak", "Rusk", "Thrum", "Gorm", "Nekh", "Ulgar", "Brann", "Hask", "Morg", "Zarn", "Kurt"],
      f: ["Ysra", "Mhorra", "Vesk", "Tahl", "Brisk", "Ulla", "Kessa", "Orga", "Nahr", "Sorsha", "Dhura", "Grisa", "Hevra", "Ilsa", "Morvah", "Zuhl", "Rhee", "Tarn", "Vola", "Yurga"],
      casas: ["Huesogris", "Tumbaseca", "Polvo", "Cenicero", "Sepulcro", "Ossaria", "Mortaja", "Cripta", "Losa", "Vigilnegra", "Cadaver", "Osario", "Sudario", "Lapida", "Nichos", "Crespon"]
    },
    nocturno: {
      m: ["Ottavio", "Renzo", "Silvano", "Tullio", "Vico", "Dario", "Enzio", "Fausto", "Guido", "Lazzaro", "Marcelo", "Nico", "Orfeo", "Primo", "Rocco", "Salvio", "Tano", "Ugo", "Vito", "Zeno"],
      f: ["Allegra", "Bianca", "Carmela", "Donata", "Elettra", "Fiamma", "Gilda", "Isotta", "Lucrezia", "Mirella", "Nerina", "Ornella", "Perla", "Rosalba", "Serafina", "Tosca", "Velia", "Zita", "Ombretta", "Noctavia"],
      casas: ["Umbral", "Bajovela", "Nigredo", "Farolnegro", "Malasombra", "Trasluz", "Penumbra", "Callehonda", "Sietellaves", "Mediavoz", "Cuervoblanco", "Humoviejo", "Tintanegra", "Lunamuerta", "Velafría", "Sinrostro"]
    },
    seosan: {
      m: ["Haruo", "Kenji", "Ryota", "Daichi", "Isamu", "Jiro", "Kaito", "Masaru", "Noboru", "Osamu", "Renzo", "Shiro", "Takeo", "Yasu", "Goro", "Hideo", "Tetsu", "Kazu", "Minoru", "Akio"],
      f: ["Akane", "Chiyo", "Emi", "Fumiko", "Hana", "Izumi", "Kaede", "Mayu", "Natsu", "Rin", "Sayo", "Tomoe", "Umeko", "Yuki", "Asami", "Kiku", "Michi", "Nao", "Suzu", "Haru"],
      casas: ["Kaishoto", "Yumigaoka", "Tetsumura", "Senkai", "Hoshikawa", "Kurogane", "Aoyama", "Shirasagi", "Takenoha", "Mizuhara", "Akagi", "Tsukimori", "Ishigaki", "Kazehaya", "Nagareboshi", "Fujinami"]
    },
    okran: {
      m: ["Brokk", "Dorn", "Garm", "Hrolf", "Jorund", "Kragh", "Odd", "Ragnar", "Skoll", "Thrain", "Ulf", "Varg", "Bjarn", "Eirik", "Fenn", "Gunnar", "Halvar", "Ketil", "Runolf", "Torvald"],
      f: ["Astrid", "Brenna", "Dagny", "Eira", "Frida", "Gudrun", "Hild", "Ingrid", "Jorunn", "Kara", "Liv", "Ragna", "Sigrun", "Thyra", "Ulfa", "Yrsa", "Runa", "Svala", "Tova", "Vigdis"],
      casas: ["Vornhaal", "Colmillorroto", "Pielgris", "Cuernoalto", "Rompehuesos", "Nieveroja", "Lomoerizado", "Garranegra", "Aullido", "Piedrahonda", "Sangrefría", "Altotrueno", "Pezuñahendida", "Dientelargo", "Cicatriz", "Hachavieja"]
    },
    pelgiria: {
      m: ["Amaro", "Bruno", "Caleb", "Delmar", "Esteban", "Fermín", "Gaspar", "Hernán", "Íñigo", "Joaquín", "León", "Marino", "Nuño", "Óscar", "Pascual", "Quirce", "Roque", "Simón", "Telmo", "Yago"],
      f: ["Alba", "Brisa", "Coral", "Dulce", "Estela", "Flor", "Gema", "Iria", "Juana", "Lía", "Marina", "Nerea", "Olalla", "Perla", "Rita", "Sol", "Tirsa", "Úrsula", "Vela", "Zaida"],
      casas: ["Calarronca", "Dientesal", "Malamar", "Puertofranco", "Barlovento", "Sotavento", "Trespalos", "Aguamala", "Quillarrota", "Marejada", "Bajamar", "Cabonegro", "Anclavieja", "Tiburón", "Salitre", "Rompeolas"]
    },
    mravec: {
      m: ["Zaphar", "Kelbar", "Xith", "Rakzul", "Mirmek", "Chitan", "Zerek", "Akhet", "Tzikar", "Vespar", "Skarab", "Kzanth", "Ormik", "Haztek", "Zul", "Kheprak", "Thrix", "Azzar", "Mandib", "Quitar"],
      f: ["Zaphara", "Kelbara", "Xitha", "Reginamex", "Mirmeka", "Chitana", "Zereka", "Akheta", "Tzikara", "Vespara", "Skaraba", "Kzantha", "Ormika", "Hazteka", "Zula", "Khepra", "Thrixa", "Azzara", "Melifa", "Quitina"],
      casas: ["del Primer Panal", "de la Cámara Honda", "del Ámbar", "de la Arena Madre", "del Túnel Rojo", "de las Mil Patas", "del Enjambre Dorado", "de la Mandíbula", "del Aguijón", "de la Cría", "de la Muda", "del Polvo Dulce"]
    },
    nernib: {
      m: ["Fizwick", "Bolt", "Tinker", "Gimble", "Runex", "Corbin", "Dabble", "Fenwick", "Gizmo", "Hobnob", "Jasper", "Kipp", "Merrin", "Nackle", "Orvil", "Pim", "Quentin", "Rivet", "Sprock", "Wizzle"],
      f: ["Tilda", "Pipa", "Nyx", "Bimble", "Clink", "Dottie", "Ember", "Fenna", "Gilly", "Hespa", "Ivy", "Junie", "Kessa", "Lumi", "Minka", "Nella", "Orla", "Posy", "Roswyn", "Zanna"],
      casas: ["Balistrix", "Runexis", "Mirmeción", "Guardiópetra", "Tornillodoro", "Cobrefino", "Engranaje", "Muelletenso", "Válvula", "Chispazo", "Latónviejo", "Remache", "Bielamanca", "Trescuerdas", "Rodamiento", "Soldadura"]
    },
    balutia: {
      m: ["Aurelio", "Cayo", "Décimo", "Fabio", "Galo", "Horacio", "Julio", "Lucio", "Marco", "Nerva", "Octavio", "Publio", "Quinto", "Rufo", "Sexto", "Tito", "Valerio", "Casio", "Máximo", "Severo"],
      f: ["Aurelia", "Camila", "Drusila", "Fabia", "Gala", "Hortensia", "Julia", "Livia", "Marcia", "Octavia", "Paulina", "Quinta", "Rufina", "Sabina", "Tulia", "Valeria", "Casia", "Flavia", "Orsa", "Vibia"],
      casas: ["Valcarón", "Ergastulo", "Yunquardiente", "Dodogama", "Altamira", "Ferrato", "Laurencio", "Praetor", "Sagunto", "Tribunal", "Vexilo", "Corvino", "Áquila", "Decumano", "Cohorte", "Limes"]
    }
  };
  const ORIGENES = {
    voluntario: { nombre: "Voluntario que entró en la Fractura", stat: {} },
    mercenario: { nombre: "Mercenario en busca de riquezas", stat: { VOL: -1, FUE: 1 } },
    habitante: { nombre: "Habitante de un fragmento aislado", stat: { CON: 1 } },
    eco: { nombre: "Eco de una persona real", stat: { MAG: 1, INT: 1 } },
    criatura: { nombre: "Criatura nacida en la Fractura", stat: { CON: 1, VOL: 1 } }
  };
  // Apodos: se ganan por lo que le pasa al soldado. [masculino, femenino]
  const APODOS = {
    cicatriz: [["el Astillado", "la Astillada"], ["el Remendado", "la Remendada"], ["el Zurcido", "la Zurcida"], ["el Quebrado", "la Quebrada"], ["Cara de Mapa", "Cara de Mapa"]],
    matador: [["el Segador", "la Segadora"], ["Mano de Hierro", "Mano de Hierro"], ["el Verdugo", "la Verdugo"], ["el Cuervo", "la Cuervo"]],
    firme: [["el Firme", "la Firme"], ["el Muro", "la Muralla"], ["Pie de Roble", "Pie de Roble"]],
    veloz: [["el Galgo", "la Galga"], ["Pies de Viento", "Pies de Viento"], ["el Rayo", "la Chispa"]],
    sabio: [["el Cuaderno", "la Cuaderna"], ["Ojo de Tinta", "Ojo de Tinta"]],
    longevo: [["el Viejo", "la Vieja"], ["el Perenne", "la Perenne"]],
    capitan: [["el Capitán", "la Capitana"]]
  };

  raiz.FRACTURA_DATOS = {
    RECURSOS, RECURSO_NOMBRE, TERRENOS, ESTRUCTURAS, CLASES, CLASES_BASE, ESPECIALIZACIONES, RANGOS, EDIFICIOS, ESCUELAS, RELIQUIAS, SLOTS, FACCIONES,
    TIPOS_FRACTURA, FRAGMENTOS, SUCESOS, DIFICULTADES, NOMBRES, ORIGENES, APODOS, HEROES, ALIAS_FACCION, faccionReal, tropa, BARCOS_BASE, NOMBRES_BARCO, FORMAS_MAPA, REGLAS: 3
  };
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.FRACTURA_DATOS;
})(typeof window !== "undefined" ? window : globalThis);
