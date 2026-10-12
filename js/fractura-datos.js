/* =============================================================================
   LA FRACTURA: datos del juego. Aquí solo hay datos y tablas; las reglas viven en
   fractura-motor.js y lo que persiste entre guerras en fractura-campana.js.
   Se carga igual en el navegador y en Node (tools/probar-fractura.js).

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
    agua: { nombre: "Agua", mov: 0, def: 0, rinde: { comida: 1 }, color: "#3b6a9c" },
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
    sanador: { nombre: "Peregrino sanador", rol: "Curación", hp: 9, atq: 1, def: 1, mov: 3, alc: 1, atqEstat: "VOL", exclusiva: "peregrinos-del-alba", sanador: true,
      perfil: { FUE: 3, CON: 5, VEL: 4, INT: 6, VOL: 9, MAG: 5 }, coste: { comida: 2, oro: 3 }, requiere: { edificio: "santuario" },
      texto: "Cura 4 de vida a los aliados que tiene al lado al empezar tu turno." },
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
    torre_magia: { nombre: "Torre de magia", rama: "mag", nivel: 3, coste: { mineral: 3, oro: 6, mana: 4 }, rinde: { mana: 3 }, previo: ["biblioteca"], texto: "+3 de maná. Permite invocar archimagos." }
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

  /* --- Facciones jugables. Cada una cambia reglas con unos pocos modificadores (los lee el motor). --- */
  const FACCIONES = {
    "caballeros-del-reino": {
      nombre: "Los Caballeros del Reino", corto: "Caballeros", color: "#c8a24a", bandera: "#7a1f2b", cultura: "comun", origen: "Brurland",
      resumen: "La élite militar de Brurland. Ejército profesional, fortificaciones y caballería pesada.",
      ventaja: "Las fortalezas dan +1 de defensa extra, empiezan con Disciplina y pueden forjar caballeros.",
      mods: { fortalezaDef: 1, hpClase: { caballero: 0 } }, escuelaInicial: ["militar", 1],
      lider: { titulo: "Mariscal del Reino", aura: { auraDef: 1 }, estado: { nombre: "El deber continúa", texto: "Sin su mariscal, todas las unidades ganan +1 de ataque.", atq: 1 } },
      origenes: ["voluntario", "habitante"], clasesExtra: ["caballero"]
    },
    "academia-arcana-de-dolbred": {
      nombre: "Academia Arcana de Dolbred", corto: "Academia", color: "#8f6fd8", bandera: "#2d2a6b", cultura: "comun", origen: "Dolbred",
      resumen: "La mayor concentración de archimagos conocida. Investiga más rápido y juega con el terreno.",
      ventaja: "Empieza dominando Resonancia, investigar cuesta un 25 % menos de maná, los magos tienen +2 de vida y pueden invocar archimagos.",
      mods: { investigarMana: 0.75, hpClase: { arcanista: 2, archimago: 2 }, manaInicial: 5, atqClase: { arcanista: 1, archimago: 1 } }, escuelaInicial: ["arcano", 2],
      lider: { titulo: "Rector de la Academia", aura: { mana: 2 }, estado: { nombre: "Cierre de la Academia", texto: "Sin su rector, investigar cuesta el doble.", investigarMana: 2 } },
      origenes: ["eco", "voluntario"], clasesExtra: ["archimago"]
    },
    "trono-de-ceniza": {
      nombre: "El Trono de Ceniza", corto: "Trono de Ceniza", color: "#9a9486", bandera: "#3d3a38", cultura: "sombrio", origen: "Osses",
      resumen: "El gobierno de la Unión de Osses: monstruos y no muertos bajo un mismo estandarte.",
      ventaja: "Sin gasto de comida, tropas baratas de Ánima, +2 de Ánima por ciudad y cada baja deja más. Las ciudades dan 1 de oro menos.",
      mods: { sinComida: true, oroCiudad: -1, anima_baja: 1, animaCiudad: 2 }, escuelaInicial: ["tanato", 2],
      lider: { titulo: "Soberano de las Cenizas", aura: { auraAtq: 1 }, estado: { nombre: "Los huesos no olvidan", texto: "Sin su soberano, todas las unidades ganan +2 de vida máxima.", hp: 2 } },
      origenes: ["criatura", "eco"], clasesExtra: ["esqueleto"]
    },
    "compania-dorada": {
      nombre: "Compañía Dorada", corto: "Compañía Dorada", color: "#e0b23a", bandera: "#5a4311", cultura: "comun", origen: "El continente",
      resumen: "El ejército mercenario más grande del continente. Todo se resuelve con oro.",
      ventaja: "+3 de oro por ciudad y mercenarios que se contratan al instante sin edificio.",
      mods: { oroCiudad: 3, oroInicial: 12 }, escuelaInicial: ["militar", 1],
      lider: { titulo: "Capitán General", aura: { oro: 3 }, estado: { nombre: "Contrato roto", texto: "Sin su capitán, el oro que rinde cada ciudad se reduce a la mitad.", oroMitad: true } },
      origenes: ["mercenario"], clasesExtra: ["mercenario"]
    },
    "hijos-del-acero": {
      nombre: "Hijos del Acero", corto: "Hijos del Acero", color: "#9fb0bd", bandera: "#2b3a45", cultura: "comun", origen: "Internacional",
      resumen: "Mercenarios que solo cazan monstruos. Una ballesta bien puesta vale por un ejército.",
      ventaja: "+2 de ataque contra monstruos y criaturas salvajes, y ballesteros pesados de serie.",
      mods: { atqMonstruo: 2 }, escuelaInicial: ["militar", 1],
      lider: { titulo: "Maestro Cazador", aura: { atqMonstruo: 1 }, estado: { nombre: "La caza no se detiene", texto: "Sin su maestro, los cazadores y ballesteros ganan +1 de ataque.", atqClases: { cazador: 1, ballestero: 1 } } },
      origenes: ["mercenario", "voluntario"], clasesExtra: ["ballestero"]
    },
    "peregrinos-del-alba": {
      nombre: "Los Peregrinos del Alba", corto: "Peregrinos", color: "#f2d27a", bandera: "#8a6a2a", cultura: "comun", origen: "Roah",
      resumen: "La rama mayoritaria del Kaneísmo, itinerante y sin fronteras propias. La misma luz alcanza a todos.",
      ventaja: "Sus unidades curan 2 más por turno, los paladines son más recios y baratos y tienen sanadores.",
      mods: { curaExtra: 2, costeClase: { paladin: { oro: -1 }, sanador: { oro: -1 } }, hpClase: { paladin: 2 } }, escuelaInicial: ["militar", 1],
      lider: { titulo: "Hermana Mayor", aura: { cura: 2 }, estado: { nombre: "La luz sigue", texto: "Sin su hermana mayor, todas las unidades ganan +1 de defensa.", def: 1 } },
      origenes: ["voluntario", "habitante"], clasesExtra: ["sanador"]
    }
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

  /* Fragmentos: nombres de lugares reales del compendio (estables) o inventados (oníricos e imposibles) */
  const FRAGMENTOS = {
    estable: ["Osses", "Brurland", "Dolbred", "Nernib", "Seosan", "Rasganorte", "Thanea", "Uldum", "Relania", "Kalvia", "Mravec", "Broneland", "Cudbusland", "Galadhel", "Okran", "Genevia", "Chakur", "Merador"],
    onirico: ["El Sueño del Granero", "La Casa de los Pasos", "El Bosque que Recuerda", "La Plaza Sin Hora", "El Pozo Dormido", "La Feria Olvidada", "La Colina del Eco"],
    imposible: ["El Mar Vertical", "La Estrella Fortaleza", "La Ciudad Sin Nombre", "El Campo de los Que No Mueren", "La Escalera al Revés", "El Cielo Hundido", "La Biblioteca de Humo"]
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
    TIPOS_FRACTURA, FRAGMENTOS, SUCESOS, DIFICULTADES, NOMBRES, ORIGENES, APODOS
  };
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.FRACTURA_DATOS;
})(typeof window !== "undefined" ? window : globalThis);
