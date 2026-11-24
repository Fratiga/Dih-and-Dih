/* =============================================================================
   LA FRACTURA: datos del juego. Aquí solo hay datos y tablas; las reglas viven en
   fractura-motor.js y lo que persiste entre guerras en fractura-campana.js.
   Se carga igual en el navegador y en Node (tools/probar-fractura.js).
   REGLAS es la versión de las reglas: una guerra guardada con otra versión no se puede continuar.
   MOTOR cambia con cada ajuste de reglas dentro de una versión: las mesas que empezaron con otro MOTOR se
   recalculan con el código nuevo en vez de bloquearse (súbelo en el mismo commit que cambie el motor o la IA).

   Lore: la Fractura es un espacio fuera del mundo conocido, hecho de fragmentos de lugares,
   sueños y recuerdos. Lo que pasa en una guerra no cambia el canon. Los nombres de lugares y
   facciones salen del compendio (solo lo público); los soldados y las casas son inventados.
============================================================================= */
(function (raiz) {
  const RECURSOS = ["comida", "materiales", "mineral", "oro", "mana", "anima"];
  const RECURSO_NOMBRE = { comida: "Alimento", materiales: "Materiales", mineral: "Mineral", oro: "Oro", mana: "Maná", anima: "Ánima" };

  /* --- Terreno: coste de movimiento (0 = no se puede pisar), defensa y lo que rinde a una ciudad cercana --- */
  const TERRENOS = {
    llanura: { nombre: "Llanura", mov: 1, def: 0, rinde: { comida: 0.5 }, color: "#8a9a4b" },
    bosque: { nombre: "Bosque", mov: 2, def: 1, rinde: { materiales: 0.75 }, color: "#3f6b3a" },
    montana: { nombre: "Montaña", mov: 3, def: 2, rinde: { mineral: 0.75 }, color: "#7d7468" },
    desierto: { nombre: "Desierto", mov: 2, def: 0, rinde: { oro: 0.75 }, color: "#c9a96a" },
    agua: { nombre: "Agua", mov: 0, def: 0, rinde: { comida: 0.5 }, color: "#3b6a9c", navegable: true },
    magica: { nombre: "Zona mágica", mov: 1, def: 0, rinde: { mana: 1.5 }, color: "#8f5bc4" },
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
    guerrero: { nombre: "Guerrero", tipo: ["infanteria"], contra: { piquero: 1 }, rol: "Primera línea", hp: 12, atq: 4, def: 2, mov: 3, alc: 1, atqEstat: "FUE",
      perfil: { FUE: 7, CON: 7, VEL: 4, INT: 4, VOL: 6, MAG: 1 }, coste: { comida: 2, oro: 2 }, requiere: {},
      texto: "Mucha vida y buen daño cuerpo a cuerpo. Los aliados a su lado reciben 1 de daño menos." },
    cazador: { nombre: "Cazador", tipo: ["tirador"], contra: { volador: 2 }, rol: "Hostigamiento", hp: 9, atq: 3, def: 1, mov: 4, alc: 3, atqEstat: "FUE",
      perfil: { FUE: 5, CON: 4, VEL: 7, INT: 5, VOL: 5, MAG: 2 }, coste: { comida: 2, oro: 2, materiales: 1 }, requiere: {},
      texto: "Ataca de lejos, se mueve mucho y puede retirarse después de disparar. Pega más desde un bosque." },
    arcanista: { nombre: "Arcanista", tipo: ["magia"], contra: { jinete_pesado: 2, monstruo: 1 }, rol: "Artillería mágica", hp: 7, atq: 4, def: 0, mov: 3, alc: 2, atqEstat: "MAG",
      perfil: { FUE: 2, CON: 3, VEL: 4, INT: 8, VOL: 6, MAG: 8 }, coste: { comida: 2, oro: 2, mana: 3 }, requiere: { edificio: "santuario", saber: true },
      texto: "Muy frágil. Su golpe alcanza también a los enemigos pegados al objetivo y puede cambiar el terreno." },
    paladin: { nombre: "Paladín", tipo: ["infanteria"], contra: { jinete: 1 }, rol: "Tanque y apoyo", hp: 16, atq: 3, def: 4, mov: 3, alc: 1, atqEstat: "FUE",
      perfil: { FUE: 6, CON: 8, VEL: 3, INT: 5, VOL: 8, MAG: 3 }, coste: { comida: 3, oro: 4, mineral: 2 }, requiere: { edificio: "cuartel" },
      texto: "Defensa altísima y un aura que da 1 de defensa a quienes lo rodean." },
    picaro: { nombre: "Pícaro", tipo: ["infanteria"], contra: { magia: 2, tirador: 2 }, rol: "Infiltración", hp: 8, atq: 4, def: 1, mov: 4, alc: 1, atqEstat: "FUE",
      perfil: { FUE: 5, CON: 4, VEL: 8, INT: 6, VOL: 5, MAG: 2 }, coste: { comida: 2, oro: 3 }, requiere: { edificio: "cuartel" },
      texto: "Pega la mitad más si el objetivo está solo, se desengancha sin problema y puede sabotear edificios enemigos." },
    caballero: { nombre: "Caballero", tipo: ["jinete_pesado"], contra: { infanteria: 2, tirador: 1 }, rol: "Caballería pesada", hp: 14, atq: 5, def: 3, mov: 4, alc: 1, atqEstat: "FUE", exclusiva: "caballeros-del-reino",
      perfil: { FUE: 7, CON: 7, VEL: 6, INT: 4, VOL: 6, MAG: 1 }, coste: { comida: 3, oro: 5, mineral: 2 }, requiere: { edificio: "herreria" },
      carga: 2, texto: "Si avanza al menos dos casillas antes de atacar, pega 2 más. Fuerte contra la infantería y débil contra los piqueros." },
    archimago: { nombre: "Archimago", tipo: ["magia"], contra: { jinete_pesado: 2, monstruo: 1 }, rol: "Magia mayor", hp: 9, atq: 6, def: 1, mov: 3, alc: 3, atqEstat: "MAG", exclusiva: "academia-arcana-de-dolbred",
      perfil: { FUE: 2, CON: 4, VEL: 4, INT: 9, VOL: 7, MAG: 9 }, coste: { comida: 2, oro: 4, mana: 5 }, requiere: { edificio: "torre_magia", saber: true },
      texto: "Magia de largo alcance con golpe en área." },
    esqueleto: { nombre: "Legión de huesos", tipo: ["infanteria"], contra: {}, rol: "Tropa barata", hp: 10, atq: 3, def: 1, mov: 3, alc: 1, atqEstat: "FUE", exclusiva: "trono-de-ceniza", muertoViviente: true,
      perfil: { FUE: 5, CON: 4, VEL: 4, INT: 2, VOL: 9, MAG: 1 }, coste: { anima: 1 }, requiere: {},
      texto: "Se paga solo con Ánima. No necesita comida y no siente miedo." },
    ballestero: { nombre: "Ballestero pesado", tipo: ["tirador"], contra: { monstruo: 2, jinete_pesado: 2, volador: 2 }, rol: "Caza mayor", hp: 10, atq: 4, def: 1, mov: 3, alc: 3, atqEstat: "FUE", exclusiva: "hijos-del-acero",
      perfil: { FUE: 6, CON: 5, VEL: 5, INT: 5, VOL: 7, MAG: 1 }, coste: { comida: 2, oro: 3, mineral: 1 }, requiere: { edificio: "cuartel" },
      texto: "Fuerte contra monstruos, voladores y caballería pesada." },
    mercenario: { nombre: "Mercenario", tipo: ["piquero", "infanteria"], contra: { jinete: 3, jinete_pesado: 3, volador: 1 }, rol: "Contrato", hp: 12, atq: 4, def: 2, mov: 3, alc: 1, atqEstat: "FUE", exclusiva: "compania-dorada",
      perfil: { FUE: 6, CON: 6, VEL: 5, INT: 4, VOL: 5, MAG: 1 }, coste: { oro: 5 }, requiere: {},
      texto: "Piquero de oficio. No pide comida ni edificio y es muy fuerte contra la caballería." },
    sanador: { nombre: "Peregrino sanador", tipo: ["apoyo"], contra: {}, rol: "Curación", hp: 9, atq: 1, def: 1, mov: 3, alc: 1, atqEstat: "VOL", exclusiva: "santos-de-asmodeo", sanador: true,
      perfil: { FUE: 3, CON: 5, VEL: 4, INT: 6, VOL: 9, MAG: 5 }, coste: { comida: 2, oro: 3 }, requiere: { edificio: "santuario" },
      texto: "Cura 4 de vida a los aliados que tiene al lado al empezar tu turno. Puede consagrar el terreno." },
    capo: { nombre: "Capo", tipo: ["infanteria"], contra: {}, rol: "Mando", hp: 9, atq: 4, def: 1, mov: 3, alc: 1, atqEstat: "INT", exclusiva: "nikaalia",
      perfil: { FUE: 5, CON: 5, VEL: 5, INT: 8, VOL: 7, MAG: 1 }, coste: { comida: 2, oro: 4 }, requiere: { edificio: "cuartel" },
      texto: "Los aliados que tiene al lado ganan +1 de ataque." },
    maestro: { nombre: "Maestro de escuela", tipo: ["infanteria"], contra: { infanteria: 2 }, rol: "Duelista", hp: 10, atq: 5, def: 1, mov: 4, alc: 1, atqEstat: "VEL", exclusiva: "seosan",
      perfil: { FUE: 6, CON: 5, VEL: 8, INT: 6, VOL: 8, MAG: 2 }, coste: { comida: 3, oro: 4, mineral: 1 }, requiere: { edificio: "cuartel" },
      texto: "+2 de ataque contra una unidad que está sola, además del Duelo de Seosan. Fuerte contra la infantería." },
    berserker: { nombre: "Berserker", tipo: ["infanteria"], contra: { piquero: 2 }, rol: "Choque", hp: 11, atq: 4, def: 0, mov: 3, alc: 1, atqEstat: "FUE", exclusiva: "okran",
      perfil: { FUE: 8, CON: 7, VEL: 5, INT: 2, VOL: 7, MAG: 1 }, coste: { comida: 3, oro: 2 }, requiere: {},
      texto: "En minoría pega y aguanta más: +1 de ataque y +1 de defensa por cada enemigo a su lado de más que aliados a su lado, hasta +3. También al defenderse." },
    barrilero: { nombre: "Barrilero", tipo: ["asedio"], contra: {}, rol: "Demolición", hp: 6, atq: 3, def: 0, mov: 3, alc: 1, atqEstat: "FUE", exclusiva: "pelgiria",
      perfil: { FUE: 5, CON: 4, VEL: 5, INT: 3, VOL: 8, MAG: 1 }, coste: { comida: 1, oro: 3 }, requiere: {},
      texto: "Al morir explota: 3 de daño a todo lo que tenga alrededor, amigo o enemigo." },
    quimera: { nombre: "Quimera", tipo: ["monstruo"], contra: { infanteria: 1 }, rol: "Depredador", hp: 11, atq: 4, def: 2, mov: 3, alc: 1, atqEstat: "FUE", exclusiva: "mravec",
      perfil: { FUE: 7, CON: 7, VEL: 5, INT: 3, VOL: 7, MAG: 2 }, coste: { comida: 3, oro: 2, mineral: 2 }, requiere: { edificio: "cuartel" },
      texto: "Devora y adapta: gana un rasgo según lo que mata." },
    automata: { nombre: "Autómata", tipo: ["infanteria"], contra: {}, rol: "Constructo", hp: 8, atq: 3, def: 2, mov: 3, alc: 1, atqEstat: "FUE", exclusiva: "nernib", sinComida: true,
      perfil: { FUE: 6, CON: 7, VEL: 3, INT: 2, VOL: 10, MAG: 1 }, coste: { materiales: 2, mineral: 1 }, requiere: { edificio: "taller" },
      texto: "No come. El Taller entrega uno gratis cada 4 turnos." },
    condenado: { nombre: "Condenado de la Ergástula", tipo: ["piquero", "infanteria"], contra: { jinete: 2, jinete_pesado: 2 }, rol: "Tropa barata", hp: 8, atq: 3, def: 1, mov: 3, alc: 1, atqEstat: "FUE", exclusiva: "balutia",
      perfil: { FUE: 5, CON: 5, VEL: 4, INT: 3, VOL: 4, MAG: 1 }, coste: { comida: 1, oro: 1 }, requiere: {},
      texto: "Preso de la Ergástula armado a la fuerza. Pega poco y aguanta poco, pero sale en cualquier ciudad." },
    /* --- Piqueros, jinetes y voladores. Cada tipo es fuerte contra otro (contra) y débil contra un tercero. --- */
    // Segunda tropa propia de cada ejército (noviembre de 2026)
    heraldo: { nombre: "Heraldo", tipo: ["apoyo"], contra: {}, rol: "Mando", hp: 9, atq: 2, def: 2, mov: 4, alc: 1, atqEstat: "VOL", exclusiva: "caballeros-del-reino", auraAtq1: 1,
      perfil: { FUE: 5, CON: 6, VEL: 6, INT: 5, VOL: 8, MAG: 1 }, coste: { comida: 2, oro: 4 }, requiere: { edificio: "academia_militar" },
      texto: "Los aliados a su lado ganan +1 de ataque." },
    golem: { nombre: "Gólem de runas", tipo: ["infanteria", "monstruo"], contra: { tirador: 1 }, rol: "Constructo", hp: 16, atq: 4, def: 3, mov: 2, alc: 1, atqEstat: "FUE", exclusiva: "academia-arcana-de-dolbred", sinComida: true,
      perfil: { FUE: 9, CON: 9, VEL: 2, INT: 1, VOL: 5, MAG: 4 }, coste: { mana: 4, mineral: 3, materiales: 2 }, requiere: { edificio: "torre_magia" },
      rompe: true, texto: "Mucha vida y defensa, pero lento. No come." },
    coloso: { nombre: "Coloso de huesos", tipo: ["monstruo"], contra: { infanteria: 1, piquero: 1 }, rol: "Ariete", hp: 18, atq: 5, def: 2, mov: 2, alc: 1, atqEstat: "FUE", exclusiva: "trono-de-ceniza", muertoViviente: true, regenera: 2,
      perfil: { FUE: 9, CON: 8, VEL: 2, INT: 1, VOL: 6, MAG: 2 }, coste: { anima: 4, mineral: 2 }, requiere: { edificio: "santuario" },
      rompe: true, texto: "Se recompone: se cura 2 más cada turno." },
    cobrador: { nombre: "Cobrador", tipo: ["infanteria"], contra: { apoyo: 2 }, rol: "Saqueo", hp: 10, atq: 4, def: 1, mov: 4, alc: 1, atqEstat: "VEL", exclusiva: "compania-dorada", roba: 2,
      perfil: { FUE: 6, CON: 5, VEL: 7, INT: 6, VOL: 5, MAG: 1 }, coste: { comida: 2, oro: 3 }, requiere: { edificio: "mercado" },
      texto: "Cada golpe que da le quita 2 de oro al dueño del herido y te lo da a ti." },
    halconero: { nombre: "Halconero", tipo: ["tirador"], contra: { volador: 3, jinete: 1 }, rol: "Caza alada", hp: 9, atq: 3, def: 1, mov: 3, alc: 2, atqEstat: "VEL", exclusiva: "hijos-del-acero", vision: 2,
      perfil: { FUE: 4, CON: 5, VEL: 7, INT: 6, VOL: 5, MAG: 1 }, coste: { comida: 2, oro: 3 }, requiere: { edificio: "cuartel" },
      texto: "Su halcón ve dos casillas más lejos y caza voladores." },
    inquisidor: { nombre: "Inquisidor", tipo: ["infanteria"], contra: { magia: 3, monstruo: 2 }, rol: "Cazador de herejes", hp: 11, atq: 4, def: 2, mov: 3, alc: 1, atqEstat: "VOL", exclusiva: "santos-de-asmodeo",
      perfil: { FUE: 6, CON: 6, VEL: 5, INT: 5, VOL: 8, MAG: 2 }, coste: { comida: 2, oro: 4 }, requiere: { edificio: "catedral" },
      texto: "Pega mucho más a magos y monstruos." },
    sicario: { nombre: "Sicario", tipo: ["infanteria"], contra: { apoyo: 2, magia: 1 }, rol: "Asesino", hp: 8, atq: 5, def: 0, mov: 4, alc: 1, atqEstat: "VEL", exclusiva: "nikaalia", sinRespuesta: true,
      perfil: { FUE: 5, CON: 4, VEL: 8, INT: 6, VOL: 5, MAG: 1 }, coste: { comida: 1, oro: 4 }, requiere: { edificio: "cuartel" },
      texto: "Golpea sin que le respondan." },
    aguila: { nombre: "Águila de las cumbres", tipo: ["volador"], contra: { tirador: 1, apoyo: 1 }, rol: "Exploración aérea", hp: 10, atq: 4, def: 1, mov: 6, alc: 1, atqEstat: "VEL", exclusiva: "okran", vuela: true, vision: 1,
      perfil: { FUE: 6, CON: 5, VEL: 9, INT: 3, VOL: 5, MAG: 1 }, coste: { comida: 3, oro: 2 }, requiere: { edificio: "circulo_huesos" },
      texto: "Vuela por encima de todo y ve una casilla más lejos." },
    tortuga: { nombre: "Tortuga de guerra", tipo: ["monstruo"], contra: { jinete: 1 }, rol: "Muralla viva", hp: 18, atq: 3, def: 4, mov: 2, alc: 1, atqEstat: "FUE", exclusiva: "pelgiria", regenera: 1,
      perfil: { FUE: 7, CON: 10, VEL: 2, INT: 2, VOL: 6, MAG: 1 }, coste: { comida: 3, oro: 3, materiales: 2 }, requiere: { edificio: "muelle" },
      rompe: true, texto: "Caparazón enorme: mucha defensa y se cura 1 más cada turno." },
    zapadora: { nombre: "Obrera zapadora", tipo: ["asedio"], contra: {}, rol: "Zapadora", hp: 10, atq: 3, def: 2, mov: 3, alc: 1, atqEstat: "FUE", exclusiva: "mravec", atqCiudad: 3,
      perfil: { FUE: 7, CON: 6, VEL: 4, INT: 3, VOL: 5, MAG: 1 }, coste: { comida: 2, oro: 2, materiales: 1 }, requiere: { edificio: "cuartel" },
      texto: "Socava los muros: +3 de ataque contra lo que está en una ciudad o una fortaleza." },
    carro: { nombre: "Carro de vapor", tipo: ["asedio", "jinete_pesado"], contra: { infanteria: 1 }, rol: "Artillería", hp: 15, atq: 4, def: 3, mov: 3, alc: 2, atqEstat: "INT", exclusiva: "nernib", sinComida: true, area: true,
      perfil: { FUE: 6, CON: 8, VEL: 4, INT: 7, VOL: 5, MAG: 1 }, coste: { mineral: 4, materiales: 3, oro: 2 }, requiere: { edificio: "taller" },
      rompe: true, texto: "Su cañón llega a dos casillas y salpica a los que rodean al objetivo. No come." },
    escorpion: { nombre: "Escorpión", tipo: ["asedio", "tirador"], contra: { jinete_pesado: 1, monstruo: 1 }, rol: "Artillería", hp: 9, atq: 4, def: 1, mov: 2, alc: 3, atqEstat: "INT", exclusiva: "balutia", atqCiudad: 2,
      perfil: { FUE: 5, CON: 5, VEL: 3, INT: 7, VOL: 5, MAG: 1 }, coste: { materiales: 3, mineral: 2, oro: 2 }, requiere: { edificio: "arsenal" },
      texto: "Dispara a tres casillas y castiga los muros: +2 contra lo que está en una ciudad o una fortaleza." },
    // Un sanador para cada ejército (reglas 5)
    capellan: { nombre: "Capellán", tipo: ["apoyo"], contra: {}, rol: "Curación", hp: 9, atq: 1, def: 1, mov: 3, alc: 1, atqEstat: "VOL", exclusiva: "caballeros-del-reino", sanador: 4, 
      perfil: { FUE: 3, CON: 5, VEL: 4, INT: 6, VOL: 8, MAG: 4 }, coste: { comida: 2, oro: 3 }, requiere: { edificio: "santuario" },
      texto: "Cura 4 de vida a los aliados que tiene al lado al empezar tu turno." },
    alquimista: { nombre: "Alquimista", tipo: ["apoyo"], contra: {}, rol: "Curación", hp: 9, atq: 1, def: 1, mov: 3, alc: 1, atqEstat: "VOL", exclusiva: "academia-arcana-de-dolbred", sanador: 4, manaTurno: 1, 
      perfil: { FUE: 3, CON: 5, VEL: 4, INT: 6, VOL: 8, MAG: 4 }, coste: { comida: 2, oro: 3 }, requiere: { edificio: "biblioteca" },
      texto: "Cura 4 a los aliados de al lado al empezar tu turno y da +1 de maná por turno." },
    embalsamador: { nombre: "Embalsamador", tipo: ["apoyo"], contra: {}, rol: "Curación", hp: 9, atq: 1, def: 1, mov: 3, alc: 1, atqEstat: "VOL", exclusiva: "trono-de-ceniza", sanador: 4, curaSoloPropios: true, 
      perfil: { FUE: 3, CON: 5, VEL: 4, INT: 6, VOL: 8, MAG: 4 }, coste: { comida: 2, oro: 3 }, requiere: { edificio: "santuario" },
      texto: "Recompone 4 de vida a las tropas de Osses que tiene al lado. A los vivos no los toca." },
    barbero: { nombre: "Barbero cirujano", tipo: ["apoyo"], contra: {}, rol: "Curación", hp: 9, atq: 1, def: 1, mov: 3, alc: 1, atqEstat: "VOL", exclusiva: "compania-dorada", sanador: 6, cobra: 1, 
      perfil: { FUE: 3, CON: 5, VEL: 4, INT: 6, VOL: 8, MAG: 4 }, coste: { comida: 2, oro: 3 }, requiere: { edificio: "santuario" },
      texto: "Cura 6 a cada aliado de al lado, pero cobra 1 de oro por cada uno." },
    curandero: { nombre: "Curandero de cacería", tipo: ["apoyo"], contra: {}, rol: "Curación", hp: 9, atq: 1, def: 1, mov: 3, alc: 1, atqEstat: "VOL", exclusiva: "hijos-del-acero", sanador: 4, curaMonstruo: 3, 
      perfil: { FUE: 3, CON: 5, VEL: 4, INT: 6, VOL: 8, MAG: 4 }, coste: { comida: 2, oro: 3 }, requiere: { edificio: "santuario" },
      texto: "Cura 4 a los aliados de al lado; 3 más si los hirió un monstruo." },
    matasanos: { nombre: "Matasanos", tipo: ["apoyo"], contra: {}, rol: "Curación", hp: 9, atq: 1, def: 1, mov: 3, alc: 1, atqEstat: "VOL", exclusiva: "nikaalia", sanador: 4, 
      perfil: { FUE: 3, CON: 5, VEL: 4, INT: 6, VOL: 8, MAG: 4 }, coste: { comida: 2, oro: 3 }, requiere: { edificio: "santuario" },
      texto: "Cura 4 de vida a los aliados que tiene al lado al empezar tu turno." },
    monje: { nombre: "Monje herbolario", tipo: ["apoyo"], contra: {}, rol: "Curación", hp: 9, atq: 1, def: 1, mov: 3, alc: 1, atqEstat: "VOL", exclusiva: "seosan", sanador: 4, 
      perfil: { FUE: 3, CON: 5, VEL: 4, INT: 6, VOL: 8, MAG: 4 }, coste: { comida: 2, oro: 3 }, requiere: { edificio: "santuario" },
      texto: "Cura 4 de vida a los aliados que tiene al lado al empezar tu turno." },
    chaman: { nombre: "Chamán", tipo: ["apoyo"], contra: {}, rol: "Curación", hp: 9, atq: 1, def: 1, mov: 3, alc: 1, atqEstat: "VOL", exclusiva: "okran", sanador: 3, sanadorRadio: 2, 
      perfil: { FUE: 3, CON: 5, VEL: 4, INT: 6, VOL: 8, MAG: 4 }, coste: { comida: 2, oro: 3 }, requiere: { edificio: "circulo_huesos" },
      texto: "Cura 3 a los aliados a 2 casillas o menos al empezar tu turno. Con Fuegos de campamento (Clanes) levanta campamentos que curan y entrenan tropas básicas lejos de casa." },
    cirujano: { nombre: "Cirujano de a bordo", tipo: ["apoyo"], contra: {}, rol: "Curación", hp: 9, atq: 1, def: 1, mov: 3, alc: 1, atqEstat: "VOL", exclusiva: "pelgiria", sanador: 4, curaBarcos: true, 
      perfil: { FUE: 3, CON: 5, VEL: 4, INT: 6, VOL: 8, MAG: 4 }, coste: { comida: 2, oro: 3 }, requiere: { edificio: "santuario" },
      texto: "Cura 4 a los aliados de al lado al empezar tu turno, barcos incluidos." },
    nodriza: { nombre: "Nodriza", tipo: ["apoyo"], contra: {}, rol: "Curación", hp: 9, atq: 1, def: 1, mov: 3, alc: 1, atqEstat: "VOL", exclusiva: "mravec", sanador: 4, 
      perfil: { FUE: 3, CON: 5, VEL: 4, INT: 6, VOL: 8, MAG: 4 }, coste: { comida: 2, oro: 3 }, requiere: { edificio: "santuario" },
      texto: "Cura 4 de vida a los aliados que tiene al lado al empezar tu turno." },
    mecanico: { nombre: "Mecánico", tipo: ["apoyo"], contra: {}, rol: "Curación", hp: 9, atq: 1, def: 1, mov: 3, alc: 1, atqEstat: "VOL", exclusiva: "nernib", sanador: 2, curaMaquinas: 6, 
      perfil: { FUE: 3, CON: 5, VEL: 4, INT: 6, VOL: 8, MAG: 4 }, coste: { comida: 2, oro: 3 }, requiere: { edificio: "taller" },
      texto: "Repara 6 a los autómatas, carros y barcos de al lado. A los vivos solo los cura 2." },
    medicus: { nombre: "Medicus", tipo: ["apoyo"], contra: {}, rol: "Curación", hp: 9, atq: 1, def: 1, mov: 3, alc: 1, atqEstat: "VOL", exclusiva: "balutia", sanador: 4, 
      perfil: { FUE: 3, CON: 5, VEL: 4, INT: 6, VOL: 8, MAG: 4 }, coste: { comida: 2, oro: 3 }, requiere: { edificio: "santuario" },
      texto: "Cura 4 de vida a los aliados que tiene al lado al empezar tu turno." },
    piquero: { nombre: "Piquero", tipo: ["piquero", "infanteria"], contra: { jinete: 3, jinete_pesado: 3, volador: 1 }, rol: "Contra caballería", hp: 11, atq: 3, def: 2, mov: 3, alc: 1, atqEstat: "FUE",
      perfil: { FUE: 6, CON: 6, VEL: 4, INT: 4, VOL: 6, MAG: 1 }, coste: { comida: 2, oro: 2, materiales: 1 }, requiere: { edificio: "cuartel" },
      texto: "Muy fuerte contra jinetes y caballería pesada. Lento y débil contra la infantería de espada." },
    jinete: { nombre: "Jinete", tipo: ["jinete"], contra: { tirador: 2, magia: 2, asedio: 2 }, rol: "Caballería ligera", hp: 10, atq: 3, def: 1, mov: 5, alc: 1, atqEstat: "VEL",
      perfil: { FUE: 5, CON: 5, VEL: 8, INT: 5, VOL: 5, MAG: 1 }, coste: { comida: 2, oro: 3 }, requiere: { edificio: "establo" },
      texto: "Rápido para explorar. Fuerte contra tiradores, magos y máquinas. Débil contra los piqueros." },
    hostigador: { nombre: "Arquero montado", tipo: ["jinete", "tirador"], contra: { infanteria: 1 }, rol: "Hostigamiento a caballo", hp: 9, atq: 3, def: 1, mov: 5, alc: 2, atqEstat: "VEL", golpeaYSigue: true,
      perfil: { FUE: 5, CON: 4, VEL: 8, INT: 5, VOL: 5, MAG: 1 }, coste: { comida: 2, oro: 3, materiales: 1 }, requiere: { edificio: "establo", saber: true },
      texto: "Dispara a 2 casillas y puede seguir moviéndose después. Débil contra los piqueros y los tiradores." },
    catafracto: { nombre: "Caballería pesada", tipo: ["jinete_pesado"], contra: { infanteria: 2, tirador: 1 }, rol: "Carga", hp: 15, atq: 5, def: 3, mov: 4, alc: 1, atqEstat: "FUE", carga: 2,
      perfil: { FUE: 7, CON: 7, VEL: 5, INT: 4, VOL: 6, MAG: 1 }, coste: { comida: 3, oro: 5, mineral: 3 }, requiere: { edificio: "establo", saber: true },
      texto: "Si avanza al menos dos casillas antes de atacar, pega 2 más. Fuerte contra la infantería, débil contra los piqueros y la magia." },
    volador: { nombre: "Volador", tipo: ["volador"], contra: { asedio: 2, magia: 1 }, rol: "Exploración aérea", hp: 8, atq: 3, def: 1, mov: 5, alc: 1, atqEstat: "VEL", vuela: true, vision: 1,
      perfil: { FUE: 4, CON: 4, VEL: 9, INT: 5, VOL: 5, MAG: 2 }, coste: { comida: 2, oro: 3 }, requiere: { edificio: "aviario", saber: true },
      texto: "Vuela: cruza montañas y agua sin gastar más y ve una casilla más. Débil contra los tiradores." },
    jinete_alado: { nombre: "Montura voladora", tipo: ["volador", "jinete_pesado"], contra: { infanteria: 1, tirador: 1 }, rol: "Caballería del aire", hp: 14, atq: 5, def: 2, mov: 5, alc: 1, atqEstat: "FUE", vuela: true, carga: 1,
      perfil: { FUE: 7, CON: 6, VEL: 7, INT: 5, VOL: 7, MAG: 2 }, coste: { comida: 3, oro: 6, mana: 2 }, requiere: { edificio: "aviario", saber: true },
      texto: "Vuela por encima de todo y carga desde el aire. Débil contra los tiradores y los piqueros." },
    kirin: { nombre: "Kirin", tipo: ["volador", "magia"], contra: { jinete_pesado: 1 }, rol: "Bestia del trueno", hp: 15, atq: 5, def: 2, mov: 5, alc: 2, atqEstat: "MAG", vuela: true, linea: true, unico: 1, exclusiva: "seosan", monstruo: true,
      perfil: { FUE: 6, CON: 6, VEL: 8, INT: 6, VOL: 8, MAG: 9 }, coste: { mana: 6, oro: 6 }, requiere: { edificio: "aviario", saber: true },
      texto: "Solo puede haber uno. Su rayo alcanza también a quien esté detrás del objetivo. Vuela." },
    /* --- Barcos. Solo navegan. Se botan en una ciudad con muelle y aparecen en el agua de al lado. No son soldados:
           no ganan experiencia ni pasan al ejército. canon: disparan pólvora. pesado: no pueden moverse y disparar. --- */
    galera: { nombre: "Galera", tipo: ["barco"], contra: {}, rol: "Barco de guerra", naval: 1, hp: 11, atq: 3, def: 1, mov: 4, alc: 2, atqEstat: "FUE", noSoldado: true,
      coste: { materiales: 3, oro: 3 }, requiere: { edificio: "muelle" }, texto: "El barco de siempre. Dispara a otros barcos y a quien esté cerca de la orilla." },
    brulote: { nombre: "Brulote", tipo: ["barco"], contra: {}, rol: "Cazabarcos", naval: 2, hp: 8, atq: 4, def: 0, mov: 5, alc: 1, atqEstat: "FUE", noSoldado: true, atqBarco: 3,
      coste: { materiales: 2, oro: 3 }, requiere: { edificio: "astillero" }, texto: "Un casco viejo cargado de fuego. +3 de ataque contra barcos y tropas embarcadas. Rápido y frágil." },
    bombarda: { nombre: "Galeón de bombardas", tipo: ["barco"], contra: {}, rol: "Asedio desde el mar", naval: 3, hp: 13, atq: 6, def: 1, mov: 3, alc: 3, atqEstat: "FUE", noSoldado: true, canon: true, pesado: true, atqPlaza: 2,
      coste: { materiales: 5, oro: 5, mineral: 3 }, requiere: { edificio: "atarazana" }, texto: "Alcance 3 y +2 contra quien se guarece en una ciudad o una fortaleza. No puede moverse y disparar en el mismo turno." },
    bergantin: { nombre: "Bergantín de la Hermandad", tipo: ["barco"], contra: {}, rol: "Corsario", naval: 1, hp: 11, atq: 4, def: 1, mov: 5, alc: 2, atqEstat: "FUE", noSoldado: true, canon: true, exclusiva: "pelgiria", golpeaYSigue: true,
      coste: { materiales: 3, oro: 3 }, requiere: { edificio: "muelle" }, texto: "Velas negras. Después de disparar puede seguir navegando." },
    trirreme: { nombre: "Trirreme imperial", tipo: ["barco"], contra: {}, rol: "Espolón", naval: 2, hp: 12, atq: 4, def: 1, mov: 4, alc: 1, atqEstat: "FUE", noSoldado: true, exclusiva: "balutia", espolon: 3,
      coste: { materiales: 4, oro: 3 }, requiere: { edificio: "astillero" }, texto: "Si avanza al menos dos casillas antes de atacar, embiste: +3 de ataque." },
    acorazado: { nombre: "Acorazado de vapor", tipo: ["barco"], contra: {}, rol: "Fortaleza flotante", naval: 3, hp: 16, atq: 5, def: 3, mov: 3, alc: 2, atqEstat: "FUE", noSoldado: true, canon: true, exclusiva: "nernib", sinComida: true,
      coste: { materiales: 5, mineral: 5, oro: 3 }, requiere: { edificio: "atarazana" }, texto: "Casco de hierro y caldera. Muy difícil de hundir. No come." },
    nave_ahogados: { nombre: "Nave de los ahogados", tipo: ["barco"], contra: {}, rol: "Barco fantasma", naval: 1, hp: 12, atq: 4, def: 1, mov: 3, alc: 2, atqEstat: "VOL", noSoldado: true, exclusiva: "trono-de-ceniza", muertoViviente: true, curaAlMatar: 3,
      coste: { anima: 4 }, requiere: { edificio: "muelle" }, texto: "Se paga con Ánima y no come. Cada vez que hunde o mata, se cura 3." },
    carraca: { nombre: "Carraca mercante", tipo: ["barco"], contra: {}, rol: "Comercio armado", naval: 1, hp: 12, atq: 2, def: 1, mov: 3, alc: 2, atqEstat: "FUE", noSoldado: true, canon: true, exclusiva: "compania-dorada", oroTurno: 2,
      coste: { oro: 6 }, requiere: { edificio: "muelle" }, texto: "Pega poco, pero mientras siga a flote da 2 de oro por turno." },
    heroe: { nombre: "Héroe", tipo: ["heroe"], contra: {}, rol: "Héroe", hp: 20, atq: 5, def: 3, mov: 3, alc: 1, atqEstat: "FUE", noReclutable: true,
      perfil: { FUE: 8, CON: 8, VEL: 6, INT: 7, VOL: 9, MAG: 5 }, coste: {}, requiere: {}, texto: "Un eco de alguien que dejó huella en el mundo." },
    eco: { nombre: "Eco", tipo: ["magia"], contra: { jinete_pesado: 2, monstruo: 1 }, rol: "Magia única", hp: 10, atq: 6, def: 1, mov: 3, alc: 2, atqEstat: "MAG",
      perfil: { FUE: 2, CON: 5, VEL: 5, INT: 8, VOL: 8, MAG: 10 }, coste: { mana: 6, oro: 4 }, requiere: { edificio: "torre_magia", saber: true },
      texto: "Una manifestación de la Fractura. Magia de alcance con golpe en área." },
    lider: { nombre: "Líder", tipo: ["heroe"], contra: {}, rol: "Figura de la facción", hp: 18, atq: 5, def: 3, mov: 3, alc: 1, atqEstat: "FUE", noReclutable: true,
      perfil: { FUE: 8, CON: 8, VEL: 5, INT: 7, VOL: 9, MAG: 4 }, coste: {}, requiere: {}, texto: "Eco de una figura de su facción." },
    // Criaturas sin dueño que guardan ruinas y fortalezas
    salvaje: { nombre: "Criatura de la Fractura", tipo: ["monstruo"], contra: {}, rol: "Guardián", hp: 14, atq: 4, def: 2, mov: 2, alc: 1, atqEstat: "FUE", noReclutable: true, monstruo: true,
      perfil: { FUE: 6, CON: 7, VEL: 4, INT: 2, VOL: 8, MAG: 3 }, coste: {}, requiere: {}, texto: "Nacida de un fragmento inestable." }
  };
  // Clases que sale a la venta por defecto (las exclusivas entran según la facción)
  const CLASES_BASE = ["guerrero", "cazador", "arcanista", "paladin", "picaro", "piquero"];
  // Barcos que cualquier ejército puede botar, por nivel de muelle (1 muelle, 2 astillero, 3 atarazana)
  /* Obras de ciudad: se pagan, duran unos turnos y se pueden repetir */
  const OBRAS = {
    fortificar: { nombre: "Fortificar", turnos: 3, coste: { materiales: 6, oro: 4 }, texto: "+2 de defensa a quien esté en la ciudad durante 3 turnos." },
    fiesta: { nombre: "Fiesta", turnos: 3, coste: { comida: 8, oro: 6 }, texto: "+2 al límite de tropas, también por encima del máximo del ejército, y se curan 2 más en la ciudad durante 3 turnos." },
    levas: { nombre: "Levas", turnos: 1, coste: { oro: 8, comida: 4 }, texto: "La ciudad entrena dos tropas este turno en vez de una." },
    vigias: { nombre: "Vigías", turnos: 3, coste: { oro: 3, materiales: 2 }, texto: "La ciudad ve 2 casillas más lejos durante 3 turnos." }
  };
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
    cuartel: { nombre: "Cuartel", rama: "mil", nivel: 2, coste: { materiales: 4, oro: 3 }, rinde: {}, texto: "Permite entrenar {tropas}. Los reclutas cuestan 1 de oro menos." },
    herreria: { nombre: "Herrería", rama: "mil", nivel: 2, coste: { materiales: 3, mineral: 2, oro: 2 }, rinde: {}, previo: ["cuartel"], texto: "+1 de defensa a quien guarnece la ciudad. Permite forjar {tropas}." },
    arsenal: { nombre: "Arsenal", rama: "mil", nivel: 3, coste: { materiales: 4, mineral: 4, oro: 4 }, rinde: {}, previo: ["herreria"], texto: "Los reclutas salen con +1 de ataque." },
    academia_militar: { nombre: "Academia militar", rama: "mil", nivel: 3, coste: { materiales: 4, oro: 6 }, rinde: {}, previo: ["cuartel"], texto: "Los reclutas salen con 3 victorias de experiencia." },
    fortaleza: { nombre: "Fortaleza", rama: "mil", nivel: 4, coste: { mineral: 6, materiales: 4, oro: 4 }, rinde: {}, previo: ["herreria"], texto: "+2 de defensa en la ciudad y cura 2 más a quien la guarnece." },
    santuario: { nombre: "Santuario", rama: "mag", nivel: 1, coste: { materiales: 3, oro: 3 }, rinde: { mana: 2 }, texto: "+2 de maná. Permite entrenar {tropas}." },
    biblioteca: { nombre: "Biblioteca arcana", rama: "mag", nivel: 2, coste: { materiales: 3, oro: 5 }, rinde: { mana: 2 }, previo: ["santuario"], texto: "+2 de maná. Investigar cuesta 1 de maná menos por escalón." },
    torre_magia: { nombre: "Torre de magia", rama: "mag", nivel: 3, coste: { mineral: 3, oro: 6, mana: 4 }, rinde: { mana: 3 }, previo: ["biblioteca"], texto: "+3 de maná. Permite invocar {tropas}." },
    refugio: { nombre: "Refugio", rama: "mil", nivel: 2, coste: { materiales: 6, oro: 6, mineral: 2 }, rinde: {}, noCapital: true, texto: "Si cae tu capital, esta ciudad pasa a serlo y sigues en la guerra." },
    // Edificios propios de un ejército
    taller: { nombre: "Taller", rama: "mil", nivel: 2, coste: { materiales: 5, mineral: 2 }, rinde: {}, solo: "nernib", texto: "Permite montar {tropas}. Entrega uno gratis cada 4 turnos (hasta 3 vivos)." },
    perrera: { nombre: "Perrera de Cadenas", rama: "mil", nivel: 2, coste: { mineral: 6, materiales: 4 }, rinde: {}, solo: "hijos-del-acero", previo: ["cuartel"], texto: "Las jaulas donde se retiene lo que no se puede matar. Hace falta para invocar a Rykerd." },
    catedral: { nombre: "Catedral", rama: "mag", nivel: 2, coste: { materiales: 5, oro: 5 }, rinde: { mana: 1 }, solo: "santos-de-asmodeo", previo: ["santuario"], texto: "+1 de maná. Consagra dos casillas alrededor de la ciudad en vez de una." },
    dojo: { nombre: "Dojo", rama: "mil", nivel: 2, coste: { materiales: 5, oro: 3 }, rinde: {}, solo: "seosan", previo: ["cuartel"], texto: "Los reclutas de esta ciudad salen con 2 victorias de experiencia." },
    circulo_huesos: { nombre: "Círculo de Huesos", rama: "mag", nivel: 1, coste: { materiales: 3, oro: 2 }, rinde: { anima: 1 }, solo: "okran", texto: "+1 de Ánima. Lugar de los chamanes." },
    // Monturas: el Establo cría jinetes y el Aviario, voladores. Cada ejército les da su nombre (edificiosNombre).
    establo: { nombre: "Establo", rama: "mil", nivel: 1, coste: { materiales: 3, oro: 3 }, rinde: {}, texto: "Permite entrenar {tropas}." },
    portal: { nombre: "Portal", rama: "mag", nivel: 3, nivelCiudad: 5, escalon: 4, coste: { mana: 20, oro: 20, mineral: 10 }, rinde: {}, texto: "Mueve una tropa al instante a otra ciudad tuya con portal. Cada viaje cuesta 4 de oro y 2 de maná (el doble las tropas pesadas y los héroes). Un viaje por portal y turno, y no funciona si alguna de las dos ciudades está sitiada o tiene enemigos al lado." },
    transmutacion: { nombre: "Transmutación", rama: "eco", nivel: 2, coste: { mana: 6, oro: 6, materiales: 4 }, rinde: {}, texto: "Cambia hasta 6 de un recurso por otro cada turno: 3 por 2. El Ánima no se consigue así." },
    aviario: { nombre: "Aviario", rama: "mil", nivel: 2, coste: { materiales: 4, oro: 4, mana: 1 }, rinde: {}, texto: "Permite criar {tropas}." },
    // El mar: cada nivel de muelle deja botar barcos mejores. Piden agua a dos casillas de la ciudad.
    muelle: { nombre: "Muelle", rama: "eco", nivel: 1, coste: { materiales: 4, oro: 2 }, rinde: { comida: 1, oro: 1 }, agua: true, texto: "+1 de alimento y +1 de oro. Tus tropas pueden embarcar y la ciudad bota galeras. Pide agua cerca." },
    astillero: { nombre: "Astillero", rama: "mil", nivel: 2, coste: { materiales: 5, oro: 4 }, rinde: {}, previo: ["muelle"], agua: true, texto: "Permite botar {tropas}." },
    atarazana: { nombre: "Atarazana", rama: "mil", nivel: 3, coste: { materiales: 6, mineral: 4, oro: 5 }, rinde: {}, previo: ["astillero"], agua: true, texto: "Permite botar {tropas}." }
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
      poblacion: { base: 4, porNivel: [3, 3, 3, 3, 4], niveles: ["Aldea", "Villa", "Ciudad amurallada", "Plaza fuerte", "Corte"], tope: 30 },
      odia: ["trono-de-ceniza", "okran", "mravec"],
      edificiosNombre: { portal: "Puerta del Reino", transmutacion: "Lonja del Reino", establo: "Cuadras Reales", aviario: "Grifera" },
      naval: { nivel: "Corrientes", texto: "Una marina modesta, para vigilar su costa." },
      diplomacia: { pacta: 0.6, traiciona: 0 },
      nombre: "Los Caballeros del Reino", corto: "Brurland", color: "#c8a24a", bandera: "#7a1f2b", cultura: "comun", origen: "Brurland", curva: "Depende del mapa",
      resumen: "La élite militar de Brurland. Ejército profesional, fortificaciones y caballería pesada.",
      ventaja: "Las fortalezas dan +1 de defensa extra, empiezan con Disciplina y forjan caballeros. Su caballería es la mejor de la Fractura. Leva feudal: cada fortaleza suya, del mapa o construida en una ciudad, sube en 1 el límite de tropas.",
      mods: { fortalezaDef: 1, levaFeudal: 1 },
      lider: { titulo: "Mariscal del Reino", aura: { auraDef: 1 }, estado: { nombre: "El deber continúa", texto: "Sin su mariscal, todas las unidades ganan +1 de ataque.", atq: 1 } },
      origenes: ["voluntario", "habitante"], clasesExtra: ["caballero", "jinete", "heraldo", "capellan"], heroe: ["adam"],
      tropas: {
        guerrero: ["Miliciano", "Gambesón, capacete de hierro, lanza corta y el pendón del Reino pintado en el escudo."],
        cazador: ["Montaraz", "Capa parda, capucha y arco largo."],
        arcanista: ["Hechicero de armas", "Mago de campaña con cota bajo la túnica y una varita de hierro."],
        paladin: ["Escudero de Hierro", "Armadura completa y un pavés tan alto como él."],
        picaro: ["Batidor", "Explorador ligero con capa corta y daga."],
        caballero: ["Caballero", "Yelmo cerrado con penacho, lanza de carga y el escudo del Reino."],
        heraldo: ["Heraldo del Reino", "Tabardo con el escudo del Reino, una trompa de latón y el estandarte al hombro."],
        capellan: ["Capellán del Reino", "Hábito blanco bajo la cota de malla y un frasco de agua bendita al cinto."],
        lider: ["Mariscal del Reino", "Armadura de gala, capa roja y corona de mando."],
        piquero: ["Piquero del Reino", "Pica larga, capacete y peto con el escudo del Reino."],
        jinete: ["Jinete ligero", "Caballo ligero, peto y lanza corta."],
        jinete_alado: ["Caballero grifo", "Armadura completa sobre un grifo de plumas pardas."],
        eco: ["Eco de armas", "Una armadura vacía que flota y pelea sola."]
      }
    },
    "academia-arcana-de-dolbred": {
      poblacion: { base: 4, porNivel: [2, 2, 3, 3, 3], niveles: ["Torre", "Colegio menor", "Colegio", "Ciudad académica", "Gran Academia"], tope: 24 },
      odia: ["nernib", "trono-de-ceniza"],
      edificiosNombre: { portal: "Círculo de Traslación", transmutacion: "Gabinete de Alquimia", establo: "Cuadras del Colegio", aviario: "Cátedra de bestias" },
      naval: { nivel: "Corrientes", texto: "Poca flota. Prefieren cambiar el terreno a cruzar el mar." },
      diplomacia: { pacta: 0.8, traiciona: 0.05 },
      nombre: "Academia Arcana de Dolbred", corto: "Dolbred", color: "#8f6fd8", bandera: "#2d2a6b", cultura: "comun", origen: "Dolbred", curva: "Late game",
      resumen: "La mayor concentración de archimagos conocida. Investiga más rápido y juega con el terreno.",
      ventaja: "Empieza dominando Resonancia, investigar cuesta un 25 % menos de maná, los magos tienen +2 de vida y pueden invocar archimagos.",
      mods: { transmutaBien: true, investigarMana: 0.75, hpClase: { arcanista: 2, archimago: 2 }, manaInicial: 5, atqClase: { arcanista: 1, archimago: 1 } },
      lider: { titulo: "Rector de la Academia", aura: { mana: 2 }, estado: { nombre: "Cierre de la Academia", texto: "Sin su rector, investigar cuesta el doble.", investigarMana: 2 } },
      origenes: ["eco", "voluntario"], clasesExtra: ["archimago", "golem", "alquimista"], heroe: ["brasa", "humores", "umbral"],
      tropas: {
        guerrero: ["Guardián del Colegio", "Media armadura sobre la toga y una alabarda con runas."],
        cazador: ["Cartógrafo de campo", "Sombrero de ala, tubo de mapas a la espalda y ballesta ligera."],
        arcanista: ["Adepto", "Túnica, capucha puntiaguda y el orbe de su Colegio."],
        paladin: ["Armadura animada", "Una armadura vacía movida por runas. Por la visera sale luz violeta."],
        picaro: ["Ilusionista", "Máscara lisa y una capa que cambia de color."],
        archimago: ["Archimago", "Sombrero de ala ancha, barba blanca y un cristal en el báculo."],
        golem: ["Gólem de runas", "Mole de piedra tallada con runas que brillan en violeta."],
        alquimista: ["Alquimista de los Humores", "Túnica verde manchada, gafas de cristal grueso y un cinturón de ampollas."],
        lider: ["Rector de la Academia", "Toga de gala y birrete con las siete torres."],
        piquero: ["Lancero del Colegio", "Túnica violeta sobre la cota y una lanza con runas."],
        volador: ["Familiar alado", "Gato negro con alas de murciélago y ojos de tinta."],
        jinete_alado: ["Jinete de mantícora", "Mago con capa sobre una mantícora domada."],
        eco: ["Eco", "Una figura de luz que repite lo que hizo un mago muerto."]
      }
    },
    "trono-de-ceniza": {
      poblacion: { base: 5, porNivel: [3, 4, 4, 4, 5], niveles: ["Fosa", "Cripta", "Osario", "Necrópolis", "Ciudad de los muertos"], tope: 34 },
      odia: "vivos",
      edificiosNombre: { portal: "Puerta de Ceniza", transmutacion: "Crisol de Huesos", establo: "Cuadra de huesos", aviario: "Nido de carroña" },
      naval: { nivel: "A su manera", barcoMax: 1, barcos: ["nave_ahogados"], embarcaSinMuelle: true, fondo: true, movEmbarcada: 2, texto: "Sus tropas no respiran. Cruzan el agua andando por el fondo, despacio, sin muelle y sin perder su defensa. Solo botan galeras y la Nave de los ahogados." },
      diplomacia: { pacta: 0.2, traiciona: 0.3 },
      nombre: "El Trono de Ceniza", corto: "Osses", color: "#9a9486", bandera: "#3d3a38", cultura: "sombrio", origen: "Osses", curva: "Desgaste", monstruos: true, irrefugiable: true,
      resumen: "El gobierno de la Unión de Osses: monstruos y no muertos bajo un mismo estandarte.",
      ventaja: "Sin gasto de comida, tropas baratas de Ánima, +2 de Ánima por ciudad y cada baja deja más. Las ciudades dan 1 de oro menos.",
      mods: { sinComida: true, oroCiudad: -1, anima_baja: 1, animaCiudad: 2 },
      lider: { titulo: "Ceniza Coronada", aura: { auraAtq: 1 }, estado: { nombre: "Los huesos no olvidan", texto: "Sin su soberano, todas las unidades ganan +2 de vida máxima.", hp: 2 } },
      origenes: ["criatura", "eco"], clasesExtra: ["esqueleto", "jinete", "coloso", "embalsamador"], heroe: ["ceniciento"],
      tropas: {
        guerrero: ["Caminante", "Un cadáver armado con lo que llevaba al morir."],
        cazador: ["Acechador", "Necrófago encorvado que lanza esquirlas de hueso."],
        arcanista: ["Nigromante de la Cátedra", "Toga negra, capirote y un báculo con calavera."],
        paladin: ["Abominación", "Varios cuerpos cosidos en uno, con placas atornilladas."],
        picaro: ["Carroñero", "Necrófago flaco y rápido, de garras largas."],
        esqueleto: ["Legión de huesos", "Capucha rota, carne gris y una espada oxidada."],
        coloso: ["Coloso de huesos", "Cientos de huesos atados en un solo cuerpo, más alto que una casa."],
        embalsamador: ["Embalsamador", "Capirote negro, vendas en los brazos y un tarro de resinas."],
        lider: ["Ceniza Coronada", "Corona de hierro sobre un cráneo y manto de ceniza."],
        piquero: ["Lancero sin carne", "Esqueleto alto con una pica oxidada."],
        jinete: ["Jinete de huesos", "Caballero muerto sobre un caballo sin piel."],
        volador: ["Cuervo de osario", "Cuervo enorme y desplumado, de ojos verdes."],
        jinete_alado: ["Wyvern podrido", "Un wyvern muerto con un jinete encapuchado encima."],
        eco: ["Eco de la Cátedra", "Un espectro de nigromante que todavía recita."]
      }
    },
    "compania-dorada": {
      poblacion: { base: 4, porNivel: [3, 3, 3, 4, 4], niveles: ["Campamento", "Cuartel de paso", "Plaza de contratas", "Banca", "Sede de la Compañía"], tope: 30 },
      odia: [],
      edificiosNombre: { portal: "Paso de los Banqueros", transmutacion: "Casa de Cambio", establo: "Caballerizas", aviario: "Palomar" },
      naval: { nivel: "Buenos", barcos: ["carraca"], muelleOro: 2, texto: "Compran sus flotas. Cada muelle les rinde 2 de oro más y tienen carracas mercantes." },
      diplomacia: { pacta: 0.7, traiciona: 0.4 },
      nombre: "Compañía Dorada", corto: "Compañía Dorada", color: "#e0b23a", bandera: "#5a4311", cultura: "comun", origen: "El continente", curva: "Early game",
      resumen: "El ejército mercenario más grande del continente. Todo se resuelve con oro.",
      ventaja: "+3 de oro por ciudad, 12 de oro extra al empezar y mercenarios que se contratan al instante sin edificio. Rescates: por cada oficial enemigo que matan, su bando paga 6 de oro (12 por un héroe o el líder). Si no tiene oro, paga con otros recursos.",
      mods: { oroCiudad: 3, oroInicial: 12, rescate: 6 },
      lider: { titulo: "Capitán General", aura: { oro: 3 }, estado: { nombre: "Contrato roto", texto: "Sin su capitán, el oro que rinde cada ciudad se reduce a la mitad.", oroMitad: true } },
      origenes: ["mercenario"], clasesExtra: ["mercenario", "jinete", "cobrador", "barbero"], heroe: ["mano_de_oro"],
      tropas: {
        guerrero: ["Alabardero a sueldo", "Jubón acuchillado amarillo y negro, sombrero con pluma y alabarda."],
        cazador: ["Ballestero contratado", "Ballesta de acero y un pavés pintado a la espalda."],
        arcanista: ["Hechicero a sueldo", "Anillos en todos los dedos y la bolsa de monedas a la vista."],
        paladin: ["Escudero de Oro", "Coraza dorada, morrión y rodela."],
        picaro: ["Cuchillo de alquiler", "Antifaz, capa corta y dos dagas."],
        mercenario: ["Mercenario", "Pañuelo rojo, parche en el ojo y espadón."],
        cobrador: ["Cobrador de la Compañía", "Libro de cuentas al cinto, porra con clavos y una sonrisa de oro."],
        barbero: ["Barbero de la Compañía", "Mandil de cuero, navaja, sierra y una bolsa para cobrar."],
        lider: ["Capitán General", "Coraza dorada, banda de mando y sombrero de plumas."],
        piquero: ["Piquero de la Compañía", "Pica, morrión y calzas a rayas."],
        jinete: ["Lanza a sueldo", "Caballo ligero y lanza de torneo."],
        hostigador: ["Pistolero montado", "Dos pistolas y un caballo nervioso."],
        catafracto: ["Coracero", "Coraza dorada y caballo bardado."],
        eco: ["Espíritu contratado", "Un espíritu que firmó un contrato que no puede romper."]
      }
    },
    "hijos-del-acero": {
      poblacion: { base: 4, porNivel: [3, 3, 3, 3, 3], niveles: ["Puesto de caza", "Fuerte de empalizada", "Fuerte", "Bastión", "Fortaleza del Acero"], tope: 28 },
      odia: ["trono-de-ceniza", "okran", "mravec"],
      edificiosNombre: { portal: "Senda del Cazador", transmutacion: "Almacén de Pieles", establo: "Perrera y cuadras", aviario: "Halconera" },
      naval: { nivel: "Flojos", barcoMax: 2, texto: "Cazadores de tierra firme. No pasan del astillero." },
      diplomacia: { pacta: 0.6, traiciona: 0 },
      nombre: "Hijos del Acero", corto: "Hijos del Acero", color: "#9fb0bd", bandera: "#2b3a45", cultura: "comun", origen: "Internacional", curva: "Mid game",
      resumen: "Mercenarios que solo cazan monstruos. Una ballesta bien puesta vale por un ejército.",
      ventaja: "+2 de ataque contra monstruos y criaturas salvajes, y ballesteros pesados de serie. Marcar la presa: sus ballesteros y halconeros marcan a un enemigo a 5 casillas o menos. Durante 2 turnos se le ve aunque haya niebla o noche y todas sus tropas le pegan 1 más.",
      mods: { atqMonstruo: 2, marcar: ["ballestero", "halconero"] },
      lider: { titulo: "Maestro Cazador", aura: { atqMonstruo: 1 }, estado: { nombre: "La caza no se detiene", texto: "Sin su maestro, los cazadores y ballesteros ganan +1 de ataque.", atqClases: { cazador: 1, ballestero: 1 } } },
      origenes: ["mercenario", "voluntario"], clasesExtra: ["ballestero", "jinete", "halconero", "curandero"], heroe: ["rykerd"],
      tropas: {
        guerrero: ["Alanceador de caza", "Abrigo de cuero con trofeos y una lanza de jabalí con travesaño."],
        cazador: ["Batidor de caza", "Sombrero de ala ancha, arco y capa de montero."],
        arcanista: ["Alquimista de cazadores", "Máscara de filtros y bandolera de frascos."],
        paladin: ["Escudero de cacería", "Escudo de torre con marcas de garras."],
        picaro: ["Rastreador", "Capa de pieles y cuchillos de desollar."],
        ballestero: ["Ballestero pesado", "Celada, ballesta de torno y virotes gruesos."],
        halconero: ["Halconero", "Guante de cuero grueso y un halcón encapuchado en el puño."],
        curandero: ["Curandero de cacería", "Bolsa de hierbas, cuchillo de desollar y vendas manchadas."],
        lider: ["Maestro Cazador", "Sombrero de ala, abrigo largo y una cabeza de monstruo al cinto."],
        piquero: ["Lancero de jabalíes", "Lanza de cruceta para frenar la carga de las bestias."],
        jinete: ["Montero", "Jinete con una jauría de perros de presa."],
        hostigador: ["Ballestero montado", "Ballesta ligera y caballo de monte."]
      }
    },
    "santos-de-asmodeo": {
      poblacion: { base: 4, porNivel: [3, 3, 3, 4, 4], niveles: ["Ermita", "Parroquia", "Abadía", "Catedral", "Sede del Primado"], tope: 30 },
      odia: ["mravec", "okran", "trono-de-ceniza", "nernib", "pelgiria"],
      edificiosNombre: { portal: "Puerta del Alba", transmutacion: "Diezmo", establo: "Caballerizas de la Orden", aviario: "Nido sagrado" },
      naval: { nivel: "Corrientes", texto: "Flota de cruzada, sin nada propio." },
      diplomacia: { pacta: 0.6, traiciona: 0.3, soloHumanos: true },
      nombre: "Santos de Asmodeo", corto: "Santos de Asmodeo", color: "#efe2b8", bandera: "#8a1c1c", cultura: "comun", origen: "Ithranor", curva: "Depende del mapa",
      resumen: "El brazo armado de la Iglesia de Asmodeo. Una teocracia de clérigos y paladines en cruzada.",
      ventaja: "Consagran el terreno: en casillas consagradas sus tropas tienen +1 de defensa y se curan. Los paladines son más recios y baratos.",
      mods: { consagra: true, curaExtra: 1, costeClase: { paladin: { oro: -1 }, sanador: { oro: -1 } }, hpClase: { paladin: 2 } },
      lider: { titulo: "Primado de Ithranor", aura: { cura: 2 }, estado: { nombre: "La cruzada sigue", texto: "Sin su primado, todas las unidades ganan +1 de defensa.", def: 1 } },
      origenes: ["voluntario", "habitante"], clasesExtra: ["sanador", "inquisidor"], heroe: ["vigilante"],
      tropas: {
        guerrero: ["Cruzado", "Gran yelmo, sobreveste blanca con el sol rojo de Asmodeo y espada."],
        cazador: ["Vigía del Camino", "Capelina de hierro, arco y un farol al cinto."],
        arcanista: ["Oficiante del Alba", "Casulla blanca y roja y un incensario encendido."],
        paladin: ["Paladín de la Pureza", "Armadura blanca completa, maza y un halo de metal en el yelmo."],
        picaro: ["Confesor", "Hábito oscuro, capucha y un punzón dentro del breviario."],
        sanador: ["Consagrador", "Sacerdote con estola roja y báculo solar."],
        inquisidor: ["Inquisidor", "Sombrero de ala ancha, abrigo rojo y un mazo con el sol grabado."],
        lider: ["Primado de Ithranor", "Mitra, capa pluvial y un báculo de oro."],
        piquero: ["Hermano de la Pica", "Hábito blanco sobre la cota y una pica."],
        catafracto: ["Caballero de la Vigilia", "Armadura blanca y caballo bardado con soles."],
        jinete_alado: ["Jinete de hipogrifo", "Paladín sobre un hipogrifo blanco."],
        eco: ["Eco del Alba", "Un santo de luz con los ojos cerrados."]
      }
    },
    nikaalia: {
      poblacion: { base: 4, porNivel: [2, 3, 3, 3, 4], niveles: ["Callejón", "Barrio", "Distrito", "Ciudad de los Dones", "Umbrathil"], tope: 26 },
      odia: ["santos-de-asmodeo"],
      edificiosNombre: { portal: "Puerta Trasera", transmutacion: "Contrabando", establo: "Cuadras del puerto", aviario: "Campanario de murciélagos" },
      naval: { nivel: "Buenos", texto: "Contrabandistas. Sus barcos, como sus tropas, no se ven hasta tenerlos encima." },
      diplomacia: { pacta: 0.8, traiciona: 0.5 },
      nombre: "Natonocturnos de Nikaalia", corto: "Nikaalia", color: "#c05aa8", bandera: "#1c1026", cultura: "nocturno", origen: "Nikaalia", curva: "Early game",
      resumen: "Las familias de Umbrathil, criadas bajo la noche eterna del domo. Gánsteres antes que soldados.",
      ventaja: "Noche eterna: los rivales ven una casilla menos y sus tropas no se ven hasta tener un enemigo al lado. Sobornan criaturas con oro. Tienen pistoleros.",
      mods: { noche: true, soborno: 4, oroInicial: 6, polvora: { cazador: true } },
      lider: { titulo: "El Don", aura: { oro: 2 }, estado: { nombre: "Guerra de familias", texto: "Sin su Don, todas las unidades ganan +1 de ataque.", atq: 1 } },
      origenes: ["mercenario", "habitante"], clasesExtra: ["capo", "jinete", "sicario", "matasanos"], heroe: ["ottavio"],
      tropas: {
        guerrero: ["Matón", "Gabardina, sombrero de ala y un tubo de plomo."],
        cazador: ["Pistolero de callejón", "Traje oscuro, sombrero calado y pistola de rueda."],
        arcanista: ["Alquimista de Bajovela", "Delantal de cuero, gafas ahumadas y frascos de Nigredo."],
        paladin: ["Guardaespaldas", "Enorme, con abrigo largo sobre placas y una puerta de carruaje por escudo."],
        picaro: ["Sicario", "Guantes, bufanda sobre la cara y un estilete."],
        capo: ["Capo", "Traje de raya, abrigo sobre los hombros y bastón de estoque."],
        sicario: ["Sicario de la familia", "Abrigo largo, guantes negros y un cuchillo fino en la manga."],
        matasanos: ["Matasanos de la familia", "Bata blanca bajo el abrigo, maletín negro y pocas preguntas."],
        lider: ["El Don", "Abrigo de pieles, sombrero y un anillo en cada dedo."],
        piquero: ["Matón de la vara", "Vara larga con clavos y una bufanda sobre la cara."],
        jinete: ["Correo nocturno", "Caballo negro, capa y farol apagado."],
        volador: ["Murciélago espía", "Murciélago grande con el collar de una familia."]
      }
    },
    seosan: {
      poblacion: { base: 4, porNivel: [2, 2, 3, 3, 3], niveles: ["Aldea", "Dojo", "Escuela", "Ciudad templo", "Kaishoto"], tope: 24 },
      odia: ["okran", "mravec"],
      edificiosNombre: { portal: "Puerta del Viento", transmutacion: "Mercado de Arroz", establo: "Cuadras de Yumigaoka", aviario: "Templo del Trueno" },
      naval: { nivel: "Buenos", barcoMov: 1, texto: "Navegan en juncos ligeros. Sus barcos tienen +1 de movimiento." },
      diplomacia: { pacta: 0.5, traiciona: 0 },
      nombre: "Escuelas de Seosan", corto: "Seosan", color: "#5fc08f", bandera: "#173528", cultura: "seosan", origen: "Seosan", curva: "Depende del mapa",
      resumen: "Escuelas marciales que se respetan entre sí y resuelven sus asuntos en duelo.",
      ventaja: "Duelo: +2 de ataque contra una unidad que está sola, y en ese combate nadie recibe ayuda de los que tiene al lado. Sus maestros de escuela lo aprovechan todavía más. Postura: la tropa que no se mueve en su turno gana +2 de defensa hasta el siguiente y, si la atacan cuerpo a cuerpo, golpea primero.",
      mods: { duelo: 2, postura: true },
      lider: { titulo: "Gran Maestro de Kaishoto", aura: { auraAtq: 1 }, estado: { nombre: "Los discípulos recuerdan", texto: "Sin su maestro, todas las unidades ganan +1 de defensa.", def: 1 } },
      origenes: ["voluntario", "habitante"], clasesExtra: ["maestro", "monje"], heroe: ["genichiro"],
      tropas: {
        guerrero: ["Discípulo de escuela", "Ropa ceñida, cinta en la frente y sable."],
        cazador: ["Arquero de Yumigaoka", "Sombrero de paja y un arco más alto que él."],
        arcanista: ["Monje de Senkai", "Túnica azafrán, sombrero de cesta y un rosario grande."],
        paladin: ["Guardián de templo", "Armadura lacada de láminas, máscara de demonio y lanza de hoja curva."],
        picaro: ["Sombra de Tetsumura", "De negro, con la cara tapada y una hoja corta."],
        maestro: ["Maestro de escuela", "Kimono con el emblema de su escuela y dos sables."],
        monje: ["Monje herbolario", "Hábito azafrán, sombrero de paja y un cesto de hierbas."],
        lider: ["Gran Maestro de Kaishoto", "Yelmo de cuernos, armadura lacada y abanico de mando."],
        piquero: ["Lancero de templo", "Yari largo y armadura lacada."],
        hostigador: ["Arquero yabusame", "Arquero a caballo con el arco largo de Yumigaoka."],
        kirin: ["Kirin", "Ciervo dragón de escamas de jade, crin de rayos y un solo cuerno."]
      }
    },
    okran: {
      poblacion: { base: 5, porNivel: [3, 4, 4, 4, 4], niveles: ["Campamento", "Poblado", "Clan", "Gran clan", "Vornhaal"], tope: 32 },
      odia: ["caballeros-del-reino", "santos-de-asmodeo", "hijos-del-acero"],
      edificiosNombre: { portal: "Piedra de los Ancestros", transmutacion: "Trueque de Clanes", establo: "Cubil de lobos", aviario: "Peñasco de águilas" },
      naval: { nivel: "Torpes", barcoMax: 1, muelleCoste: 2, movEmbarcada: 2, texto: "Gente de las Tierras Altas. Los muelles les cuestan el doble, solo botan galeras y embarcados van despacio." },
      diplomacia: { pacta: 0.4, traiciona: 0.4 },
      nombre: "Clanes de Okran", corto: "Okran", color: "#b8672e", bandera: "#33200f", cultura: "okran", origen: "Okran", curva: "Early game",
      resumen: "Clanes bárbaros y hombres bestia de las Tierras Altas. Solo respetan la fuerza.",
      ventaja: "Furia: +1 de ataque por cada cuarto de vida perdido, hasta +3. Botín: cada enemigo que cae da comida y oro, y al tomar una ciudad se lleva parte de lo que guarda ese bando. Viejas deudas: +1 de ataque contra los ejércitos que odia. Marcha de la horda: +1 de movimiento a quien empieza el turno junto a otra tropa suya. En su saber aprenden a levantar campamentos y a cobrarse trofeos de caza. Sus tropas no necesitan edificios para lo básico.",
      mods: { furia: 3, monstruoClases: ["paladin", "picaro"], botin: true, deudas: 1, horda: true, campamento: "chaman" },
      lider: { titulo: "Jefe de Vornhaal", aura: { auraAtq: 1 }, estado: { nombre: "Sangre por el jefe", texto: "Sin su jefe, todas las unidades ganan +1 de ataque.", atq: 1 } },
      origenes: ["habitante", "criatura"], clasesExtra: ["berserker", "jinete", "aguila", "chaman"], heroe: ["ebonrabia"],
      tropas: {
        guerrero: ["Guerrero de clan", "Pieles, pintura de guerra y un hacha de dos manos."],
        cazador: ["Lanzador de huesos", "Collar de dientes y un haz de jabalinas de hueso."],
        arcanista: ["Chamán de huesos", "Un cráneo de ciervo por máscara y un bastón con sonajas."],
        paladin: ["Gran hombre bestia", "Mitad hombre y mitad bisonte, con cuernos y un tronco por maza."],
        picaro: ["Acechador de estepa", "Hombre lobo flaco con una capa de hierba seca."],
        berserker: ["Berserker", "Torso desnudo lleno de cicatrices y un hacha en cada mano."],
        aguila: ["Águila de las cumbres", "Un águila del tamaño de un caballo, de plumas pardas y garras de hierro."],
        chaman: ["Chamán del clan", "Cráneo de ciervo, pieles y un bastón con amuletos."],
        lider: ["Jefe de Vornhaal", "Capa de oso, casco de cuernos y un hacha enorme."],
        piquero: ["Portador de colmillos", "Lanza hecha con un colmillo de mamut."],
        jinete: ["Jinete de lobo", "Guerrero sobre un lobo gris de las Tierras Altas."],
        hostigador: ["Arquero de estepa", "Arco corto de asta y un lobo veloz."],
        eco: ["Eco de los ancestros", "El espíritu de un jefe antiguo, hecho de humo y huesos."]
      }
    },
    pelgiria: {
      poblacion: { base: 4, porNivel: [3, 3, 3, 3, 4], niveles: ["Cala", "Fondeadero", "Puerto", "Puerto franco", "Cala Ronca"], tope: 28 },
      odia: ["balutia", "santos-de-asmodeo"],
      edificiosNombre: { portal: "Remolino", transmutacion: "Lonja del Puerto", establo: "Cuadras del muelle", aviario: "Palomar" },
      naval: { nivel: "Maestros", barcos: ["bergantin"], barcoMov: 1, barcoAtq: 1, muelleCoste: 0.5, embarcaSinMuelle: true, marinos: true, movEmbarcada: 4, texto: "Viven del mar. Embarcan y desembarcan sin perder el turno ni la defensa, pelean embarcados, sus muelles cuestan la mitad y sus barcos son más rápidos y pegan más." },
      diplomacia: { pacta: 0.7, traiciona: 0.4 },
      nombre: "Hermandad de Cala Ronca", corto: "Pelgiria", color: "#36a9b0", bandera: "#0f3138", cultura: "pelgiria", origen: "Pelgiria", curva: "Depende del mapa",
      resumen: "Piratas del archipiélago de Pelgiria. Pólvora, abordajes y tortugas de mar gigantes.",
      ventaja: "Maestros del mar: embarcan sin muelle y sin perder el turno, pelean embarcados y sus barcos son los mejores. Tienen arcabuceros, cañoneros y barrileros que explotan.",
      mods: { polvora: { cazador: true, arcanista: true } },
      lider: { titulo: "Capitán de la Hermandad", aura: { oro: 2 }, estado: { nombre: "Cada cual a lo suyo", texto: "Sin su capitán, todas las unidades ganan +1 de ataque.", atq: 1 } },
      origenes: ["mercenario", "habitante"], clasesExtra: ["barrilero", "tortuga", "cirujano"], heroe: ["dientesal"],
      tropas: {
        guerrero: ["Marinero de abordaje", "Pañuelo en la cabeza, sable corto y rodela."],
        cazador: ["Arcabucero de cubierta", "Tricornio y un arcabuz largo."],
        arcanista: ["Cañonero", "Empuja un cañón ligero de cubierta con la mecha lista."],
        paladin: ["Jinete de escudonte", "Montado en una tortuga gigante con castillete en el caparazón."],
        picaro: ["Contrabandista", "Capa encerada, farol ciego y puñal."],
        barrilero: ["Barrilero", "Carga a la espalda un barril de pólvora con la mecha encendida."],
        tortuga: ["Tortuga de guerra", "Tortuga de mar gigante con un fortín de tablas sobre el caparazón."],
        cirujano: ["Cirujano de a bordo", "Pañuelo en la cabeza, delantal y una sierra de amputar."],
        lider: ["Capitán de la Hermandad", "Casaca larga, tricornio con pluma y sable."],
        piquero: ["Abordador de chuzo", "Chuzo de abordaje y pañuelo al cuello."]
      }
    },
    mravec: {
      poblacion: { base: 5, porNivel: [4, 4, 4, 5, 5], niveles: ["Galería", "Hormiguero", "Colmena", "Gran colmena", "Zaphara"], tope: 36 },
      odia: ["santos-de-asmodeo", "hijos-del-acero"],
      edificiosNombre: { portal: "Túnel de la Reina", transmutacion: "Despensa de la Colmena", establo: "Criadero de escarabajos", aviario: "Celdas aladas" },
      naval: { nivel: "Negados", barcoMax: 0, sinMuelle: true, embarcaSinMuelle: true, movEmbarcada: 2, texto: "Vienen del desierto. No construyen muelles ni barcos. Cruzan el agua en balsas de quitina, despacio y sin defensa." },
      diplomacia: { pacta: 0, traiciona: 0 },
      nombre: "Satrapía de Mravec", corto: "Mravec", color: "#b4c23a", bandera: "#3d3a10", cultura: "mravec", origen: "Mravec", curva: "Late game", monstruos: true, irrefugiable: true,
      resumen: "Insectoides del desierto, descendientes de la Reina Hormiga. Lo que devoran, lo aprenden.",
      ventaja: "Devorar y adaptar: tres de sus tropas ganan un rasgo del enemigo que matan (hasta dos por unidad). Enjambre: +1 de defensa a la tropa que tiene al lado dos aliados o más.",
      mods: { devora: ["guerrero", "picaro", "quimera"], enjambre: 1 },
      lider: { titulo: "Voz de la Satrapía", aura: { auraDef: 1 }, estado: { nombre: "El Panal se cierra", texto: "Sin su voz, todas las unidades ganan +2 de vida máxima.", hp: 2 } },
      origenes: ["criatura"], clasesExtra: ["quimera", "zapadora", "nodriza"], heroe: ["zaphar"],
      tropas: {
        guerrero: ["Guerrera del Panal", "Hormiga soldado erguida, de cuatro brazos, con lanza y escudo de quitina."],
        cazador: ["Escupidor de ácido", "Abdomen hinchado y mandíbulas que gotean."],
        arcanista: ["Sacerdote de Quitina", "Mantis con velo y un báculo de ámbar."],
        paladin: ["Centinela de quitina", "Escarabajo acorazado con un cuerno."],
        picaro: ["Acechador de arena", "Hormiga león de pinzas largas, medio enterrada."],
        quimera: ["Quimera", "Mezcla de lo que ha devorado: alas, pinzas y aguijón."],
        zapadora: ["Obrera zapadora", "Hormiga obrera de mandíbulas anchas, hechas para cavar bajo las murallas."],
        nodriza: ["Nodriza de la colmena", "Hormiga obrera de color miel que cuida de las crías."],
        lider: ["Voz de la Satrapía", "Insecto alto y delgado con corona de ámbar y manto de alas."],
        piquero: ["Lancera del Panal", "Hormiga soldado de mandíbulas largas como picas."],
        volador: ["Avispa de guerra", "Avispa del tamaño de un perro."],
        jinete_alado: ["Jinete de libélula", "Guerrera del Panal sobre una libélula gigante."],
        catafracto: ["Escarabajo de guerra", "Escarabajo acorazado con una guerrera encima."]
      }
    },
    nernib: {
      poblacion: { base: 4, porNivel: [2, 3, 3, 3, 3], niveles: ["Taller", "Barrio fabril", "Ciudad fabril", "Distrito de la Oligarquía", "La Ciudadela"], tope: 26 },
      odia: ["academia-arcana-de-dolbred", "mravec"],
      edificiosNombre: { portal: "Teleférico Arcano", transmutacion: "Refinería", establo: "Garaje de velocípedos", aviario: "Hangar" },
      naval: { nivel: "Buenos", barcos: ["acorazado"], barcoDef: 1, texto: "Tienen los mejores ingenieros navales. Sus barcos tienen +1 de defensa y construyen acorazados de vapor." },
      diplomacia: { pacta: 0.6, traiciona: 0.1 },
      nombre: "Oligarquía de Nernib", corto: "Nernib", color: "#6fb6e0", bandera: "#26323e", cultura: "nernib", origen: "Nernib", curva: "Late game",
      resumen: "Ciudad-estado de gnomos y forjados. Lo que no pueden vencer, lo fabrican.",
      ventaja: "Taller: construyen autómatas que no comen, y el taller entrega uno gratis cada 4 turnos (hasta 3). Tienen fusileros.",
      mods: { taller: true, polvora: { cazador: true } },
      lider: { titulo: "Oligarca", aura: { mana: 2 }, estado: { nombre: "Protocolo de emergencia", texto: "Sin su oligarca, todas las unidades ganan +1 de defensa.", def: 1 } },
      origenes: ["voluntario", "eco"], clasesExtra: ["automata", "jinete", "carro", "mecanico"], heroe: ["engranaje"],
      tropas: {
        guerrero: ["Operario acorazado", "Un gnomo dentro de un traje de placas remachadas, con martillo de vapor."],
        cazador: ["Artillero de Balistrix", "Un gnomo con gafas y un fusil más largo que él."],
        arcanista: ["Artificiero gnomo", "Mochila de bobinas y un guantelete que chispea."],
        paladin: ["Forjado", "Constructo de metal y madera con un solo ojo de luz."],
        picaro: ["Explorador mecánico", "Autómata pequeño de patas largas con una lente por cabeza."],
        automata: ["Autómata", "Obrero de latón con brazos de pistón."],
        carro: ["Carro de vapor", "Caldera con ruedas, chimenea humeante y un cañón corto en el morro."],
        mecanico: ["Mecánico de Nernib", "Gafas de soldar, mandil de cuero y una llave enorme."],
        lider: ["Oligarca", "Un gnomo anciano en un trono andante de latón."],
        piquero: ["Alabardero de Nernib", "Alabarda de vapor y casco con una lente."],
        jinete: ["Velocípedo de vapor", "Biciclo de hierro con caldera y un piloto con gafas."],
        volador: ["Ornitóptero", "Máquina de alas batientes y hélice de latón."],
        eco: ["Espectro de éter", "Una figura azul de chispas que sale de un condensador."]
      }
    },
    balutia: {
      poblacion: { base: 5, porNivel: [3, 4, 4, 4, 4], niveles: ["Castro", "Colonia", "Municipio", "Provincia", "El Foro"], tope: 34 },
      odia: ["pelgiria", "okran"],
      edificiosNombre: { portal: "Arco del Emperador", transmutacion: "Erario", establo: "Cuadras de la legión", aviario: "Aquilario" },
      naval: { nivel: "Buenos", barcos: ["trirreme"], texto: "La flota del Imperio pelea embistiendo. Tienen trirremes." },
      diplomacia: { pacta: 0.6, traiciona: 0.4 },
      nombre: "Imperio de Balutia", corto: "Balutia", color: "#c23a3a", bandera: "#3a0f14", cultura: "balutia", origen: "Balutia", curva: "Mid game",
      resumen: "El imperio de las legiones. Conquista una provincia y pone a su gente en primera fila.",
      ventaja: "Tributo: cada ciudad que conquista le entrega un Auxiliar de provincias (hasta 3). Tropas baratas de la Ergástula. Testudo: contra los ataques a distancia, cada legionario gana +1 de defensa por cada legionario aliado a su lado (hasta +2).",
      mods: { tributo: 3, polvora: { arcanista: true }, testudo: { clase: "guerrero", max: 2 } },
      lider: { titulo: "Legado del Emperador", aura: { auraDef: 1 }, estado: { nombre: "La legión no se rinde", texto: "Sin su legado, todas las unidades ganan +1 de ataque.", atq: 1 } },
      origenes: ["voluntario", "habitante"], clasesExtra: ["condenado", "jinete", "escorpion", "medicus"], heroe: ["reinhardt"],
      tropas: {
        guerrero: ["Legionario", "Escudo rectangular, yelmo con carrilleras y espada corta."],
        cazador: ["Auxiliar de provincias", "Tropa de las provincias, con jabalinas y escudo ovalado."],
        arcanista: ["Pirotecnista del Yunque", "Mandil de herrero y un tubo de fuego del Yunque Ardiente."],
        paladin: ["Pretoriano", "Coraza musculada, capa púrpura y penacho."],
        picaro: ["Delator de la Corte", "Toga gris, tablilla de cera y un puñal en la manga."],
        condenado: ["Condenado de la Ergástula", "Un preso con los grilletes rotos y un arma prestada."],
        escorpion: ["Escorpión de la legión", "Ballesta gigante sobre ruedas, servida por dos legionarios."],
        medicus: ["Medicus de la legión", "Casco de legionario, caja de instrumentos y vendas limpias."],
        lider: ["Legado del Emperador", "Coraza dorada, capa púrpura y corona de laurel."],
        piquero: ["Triario", "Lanza larga y escudo grande, el veterano de la última fila."],
        jinete: ["Équite", "Jinete de túnica roja y lanza."],
        catafracto: ["Catafracto", "Jinete y caballo cubiertos de escamas de bronce."],
        eco: ["Eco del Imperio", "Un legionario de luz con el águila en el escudo."]
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

  /* Cada ejército llama a sus edificios de monturas a su manera */
  function nombreEdificio(id, faccion) {
    const f = faccion ? FACCIONES[faccionReal(faccion)] : null;
    return (f && f.edificiosNombre && f.edificiosNombre[id]) || (EDIFICIOS[id] ? EDIFICIOS[id].nombre : id);
  }
  /* El nombre de cada nivel de ciudad en ese ejército (Aldea, Villa... u Osario, Necrópolis...) */
  function nivelCiudad(faccion, nivel) {
    const f = faccion ? FACCIONES[faccionReal(faccion)] : null;
    const l = (f && f.poblacion && f.poblacion.niveles) || ["Aldea", "Villa", "Ciudad", "Gran ciudad", "Capital"];
    return l[Math.max(0, Math.min(l.length - 1, nivel - 1))];
  }

  /* El texto de un edificio para un ejército: {tropas} se cambia por las tropas de ese ejército que lo piden.
     Sin ejército (la ayuda general) se nombran las tropas por su papel. Si no hay ninguna, esa frase se quita. */
  function textoEdificio(id, faccion) {
    const ed = EDIFICIOS[id];
    if (!ed) return "";
    if (!ed.texto.includes("{tropas}")) return ed.texto;
    const f = faccion ? FACCIONES[faccionReal(faccion)] : null;
    const clases = Object.keys(CLASES).filter(cl => CLASES[cl].requiere && CLASES[cl].requiere.edificio === id && !CLASES[cl].noReclutable)
      .filter(cl => {
        const k = CLASES[cl];
        if (!f) return !k.exclusiva;
        if (k.exclusiva) return k.exclusiva === faccionReal(faccion);
        if (k.naval) { const nv = f.naval || {}; return (nv.barcoMax === undefined || k.naval <= nv.barcoMax) && !nv.sinMuelle; }
        return CLASES_BASE.includes(cl) || (f.clasesExtra || []).includes(cl) || (raiz.FracturaSaber ? raiz.FracturaSaber.posibles(faccion).includes(cl) : cl === "eco");
      });
    const nombres = clases.map(cl => (f ? tropa(faccion, cl).nombre : CLASES[cl].nombre).toLowerCase());
    if (!nombres.length) return ed.texto.replace(/[^.]*\{tropas\}[^.]*\.\s*/, "").trim() || "Sin tropas propias de tu ejército.";
    const lista = nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}` : nombres[0];
    return ed.texto.replace("{tropas}", lista);
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
    ottavio: { faccion: "nikaalia", nombre: "Doña Ottavia Umbral", titulo: "Dueña del Mercado de las Sombras", sexo: "f", nivel: 1, hp: 18, atq: 5, def: 3, mov: 3, alc: 1,
      coste: { oro: 10 }, req: [{ t: "mercado" }],
      ef: { sobornoMitad: true, velo: true, activa: { id: "contratar", nombre: "Una oferta", texto: "Paga 2 de oro: una criatura salvaje a su lado lucha por ti 3 turnos.", cd: 2, coste: { oro: 2 } } },
      texto: "Sus sobornos cuestan la mitad. Los aliados a su lado no pueden ser atacados desde lejos.", aspecto: "Traje blanco, abrigo negro, sombrero de ala ancha sobre una melena oscura y un bastón con pomo de cuervo." },
    brasa: { faccion: "academia-arcana-de-dolbred", nombre: "Ilvaren Brasalba", titulo: "Colegio de la Brasa Viva", nivel: 2, hp: 22, atq: 5, def: 3, mov: 3, alc: 3, magia: true,
      coste: { mana: 10, oro: 4 }, req: [{ t: "edificio", id: "torre_magia" }, { t: "saber", n: 5 }],
      ef: { activa: { id: "area", nombre: "Pira", texto: "3 de daño a todo lo que haya en un cuadro de 3x3, hasta a 3 casillas.", cd: 4, dano: 3, alc: 3 } },
      texto: "Ataca a 3 casillas.", aspecto: "Elfo de fuego, con la melena y la túnica a medio arder." },
    humores: { faccion: "academia-arcana-de-dolbred", nombre: "Maese Croacio Verruguilla", titulo: "Colegio de los Humores", nivel: 2, hp: 22, atq: 4, def: 3, mov: 3, alc: 2, magia: true,
      coste: { mana: 10, oro: 4 }, req: [{ t: "edificio", id: "torre_magia" }, { t: "saber", n: 5 }],
      ef: { manaTurno: 2, activa: { id: "curar", nombre: "Triaca", texto: "Cura 4 a todos los aliados a 2 casillas.", cd: 3, cura: 4, radio: 2 } },
      texto: "+2 de maná por turno.", aspecto: "Hombre sapo pequeño con máscara de médico de la peste y maletín de ampollas." },
    umbral: { faccion: "academia-arcana-de-dolbred", nombre: "Custodia Aldenvar", titulo: "Colegio del Umbral", nivel: 2, hp: 24, atq: 4, def: 4, mov: 3, alc: 1, magia: true,
      coste: { mana: 10, oro: 4 }, req: [{ t: "edificio", id: "torre_magia" }, { t: "saber", n: 5 }],
      ef: { auraDef1: 2, activa: { id: "muro", nombre: "Muro de runas", texto: "Bloquea una casilla vacía durante 2 turnos.", cd: 4, alc: 3 } },
      texto: "Los aliados a su lado ganan +2 de defensa.", aspecto: "Anciana alta con armadura de pergaminos rúnicos y un grimorio por escudo." },
    ceniciento: { faccion: "trono-de-ceniza", nombre: "El Ceniciento", titulo: "Mano de Ceniza Coronada", nivel: 2, hp: 23, atq: 5, def: 3, mov: 3, alc: 1, muertoViviente: true,
      coste: { anima: 10 }, req: [{ t: "saber", n: 5 }, { t: "cuenta", k: "perdidas", n: 1, texto: "Haber perdido una unidad en esta guerra" }],
      ef: { alzaCaidos: true, activa: { id: "alzar", nombre: "Volved", texto: "Una sola vez: levanta al aliado caído más fuerte, con 2 de vida.", cd: 99 } },
      texto: "Cuando muere un aliado a 2 casillas, aparece una Legión de huesos (una por turno).", aspecto: "Armadura quemada, un manto de ceniza que no deja de caer y brasas por ojos." },
    vigilante: { faccion: "santos-de-asmodeo", nombre: "El Vigilante", titulo: "Custodio de la Catedral de la Vigilia", nivel: 2, hp: 24, atq: 5, def: 3, mov: 3, alc: 1,
      coste: { oro: 8, mana: 4 }, req: [{ t: "edificio", id: "catedral" }, { t: "consagradas", n: 12 }],
      ef: { consagraAlPisar: true, escudoAliados: true },
      texto: "Consagra las casillas que pisa. Los aliados a su lado ignoran el primer golpe de cada turno.", aspecto: "Armadura blanca sin rostro, seis alas de metal plegadas y una espada de llama." },
    genichiro: { faccion: "seosan", nombre: "Genichiro Nakamuro", titulo: "Samurái de la Escuela del Río Rojo", nivel: 2, hp: 22, atq: 6, def: 3, mov: 3, alc: 1, bestia: false,
      coste: { mana: 6, oro: 6 }, req: [{ t: "edificio", id: "dojo" }, { t: "cuenta", k: "duelos", n: 3, texto: "Ganar 3 duelos (matar a una unidad que está sola)" }],
      ef: { atqSolo: 3, sinRespuesta: true, activa: { id: "formar", nombre: "Postura del río", texto: "Los aliados a su lado ganan +1 de defensa hasta tu próximo turno.", cd: 3 } },
      texto: "+3 de ataque contra una unidad que está sola. Quien recibe su golpe no puede responder.", aspecto: "Draconiano rojo de escamas duras, cara alargada de cocodrilo, barba trenzada, cola gruesa y un sombrero de arroz que le tapa los ojos." },
    ebonrabia: { faccion: "okran", nombre: "Ebonrabia", titulo: "De la sangre del Behemoth", nivel: 2, hp: 24, atq: 5, def: 3, mov: 3, alc: 1, bestia: true,
      coste: { comida: 6, oro: 4 }, req: [{ t: "edificio", id: "circulo_huesos" }, { t: "cuenta", k: "racha", n: 3, texto: "Matar a 3 enemigos seguidos sin perder ninguna unidad" }],
      ef: { furia: 5, curaAlMatar: 4 },
      texto: "Su furia llega a +5 de ataque y se cura 4 cada vez que mata.", aspecto: "Simio enorme de pelo negro con las puntas doradas, dos cuernos hacia atrás y unos brazos que echan chispas cuando se enfurece." },
    dientesal: { faccion: "pelgiria", nombre: "Capitana Dientesal", titulo: "La voz de Cala Ronca", nivel: 2, hp: 22, atq: 5, def: 3, mov: 3, alc: 2,
      coste: { oro: 10, materiales: 4 }, req: [{ t: "edificio", id: "astillero" }, { t: "cuenta", k: "saqueos", n: 2, texto: "Tomar 2 ciudades" }],
      ef: { activa: { id: "area", nombre: "Andanada de barriles", texto: "3 de daño a todo lo que haya en un cuadro de 3x3, hasta a 3 casillas.", cd: 3, dano: 3, alc: 3 }, activa2: { id: "curar", nombre: "Limonada de a bordo", texto: "Cura 3 a los aliados a 2 casillas.", cd: 3, cura: 3, radio: 2 } },
      texto: "Ataca a 2 casillas con su pistola.", aspecto: "Casaca roja, tricornio, un diente de sal por colmillo y dos pistolas." },
    zaphar: { faccion: "mravec", nombre: "Zaphar", titulo: "Primer vástago de la Reina", nivel: 2, hp: 22, atq: 5, def: 3, mov: 3, alc: 1, bestia: true,
      coste: { comida: 8, mineral: 4 }, req: [{ t: "cuenta", k: "devorados", n: 5, texto: "Devorar a 5 enemigos" }],
      ef: { devoraSinTope: true },
      texto: "Ocupa 2×2 casillas. Devora y adapta: cada enemigo que mata, también al engullirlo, le deja un rasgo según lo que era (vida, ataque, defensa, alcance o movimiento). Puede repetirlos y no tienen tope. Su colmena le tiende un puente: cruza el agua una casilla por turno, sin defensa.", aspecto: "Hormiga reina guerrera, alta, con alas de ámbar y mandíbulas doradas." },
    reinhardt: { faccion: "balutia", nombre: "Reinhardt Shield", titulo: "General de la Legión Negra", nivel: 2, hp: 24, atq: 5, def: 4, mov: 3, alc: 1,
      coste: { oro: 10, mineral: 3 }, req: [{ t: "regiones", n: 3 }],
      ef: { tributoMejor: true, auraDef1: 1, contraHeroe: { jinete: 2, jinete_pesado: 2 } },
      texto: "El Tributo entrega un Pretoriano en vez de un Auxiliar. Los aliados a su lado ganan +1 de defensa. Su alabarda pega 2 más a la caballería.", aspecto: "Armadura negra, pelo rojo corto, barba corta, un parche en el ojo y una alabarda." },
    rykerd: { faccion: "hijos-del-acero", nombre: "Rykerd, el Imperdonable", titulo: "Lo que los Hijos del Acero no debieron cazar", nivel: 3, hp: 30, atq: 6, def: 3, mov: 3, alc: 1, muertoViviente: true,
      coste: { oro: 12, mineral: 8, comida: 6, anima: 4 }, req: [{ t: "fortaleza" }, { t: "cuenta", k: "salvajes", n: 3, texto: "Cazar 3 criaturas salvajes" }, { t: "saber", n: 6 }, { t: "edificio", id: "perrera" }, { t: "turno", n: 8 }],
      ef: { temible: 1, rencor: 2, contencion: true },
      texto: "Los enemigos a su lado pierden 1 de ataque. Gana +2 de ataque cada vez que muere un aliado. Si cae el Maestro Cazador, se desata 3 turnos.", aspecto: "Alto y pálido, a medio camino entre un hombre y un dragón: cabeza larga y lisa, alas que acaban en dedos y unos ojos que no parpadean. Arrastra cadenas rotas." }
  };

  /* =========================================================================
     Reglas 5: héroes raros y legendarios. Cuestan el triple, piden renombre y un turno mínimo
     (requisitosHeroe en el motor), son el doble de fuertes y tienen una pasiva y dos habilidades.
     Los radios de las auras van en { n, r }: n de bono a r casillas o menos.
  ========================================================================= */
  const HEROES_V5 = {
    adam: { hp: 52, atq: 10, def: 6, mov: 3, texto: "Los aliados a 3 casillas o menos ganan +2 de ataque. Los jinetes cerca de él cargan sin recorrer 2 casillas.",
      ef: { auraAtq: { n: 2, r: 3 }, cargaLibre: 2,
        activa: { id: "formar", nombre: "Formad filas", texto: "Los aliados a 2 casillas o menos ganan +2 de defensa hasta tu próximo turno.", cd: 3, radio: 2, def: 2 },
        activa2: { id: "reino", nombre: "Por el Reino", texto: "Una vez por guerra: los aliados a 3 casillas o menos recuperan el movimiento y pueden volver a atacar este turno.", cd: 99, radio: 3 } } },
    mano_de_oro: { hp: 48, atq: 9, def: 5, mov: 3, texto: "Llega con 4 mercenarios y da +5 de oro por turno.",
      ef: { llegaCon: ["mercenario", "mercenario", "mercenario", "mercenario"], oroTurno: 5,
        activa: { id: "comprar", nombre: "Todo tiene un precio", texto: "Por 8 de oro, una tropa enemiga sin rango (o una criatura) a 2 casillas o menos lucha por ti 3 turnos. Los héroes y los líderes no se venden.", cd: 3, alc: 2, coste: { oro: 8 } },
        activa2: { id: "pagaDoble", nombre: "Paga doble", texto: "Por 6 de oro, todos tus mercenarios tienen +2 de ataque este turno.", cd: 3, coste: { oro: 6 }, atq: 2 } } },
    engranaje: { tam: 2, modoAgua: "fondo", hp: 50, atq: 8, def: 7, mov: 3, texto: "Ocupa 2×2 casillas. Llega con 4 autómatas. Tus autómatas tienen +2 de ataque y +1 de defensa. Cruza el mar andando por el fondo, a la mitad de su movimiento; bajo el agua no ataca ni puede ser atacado.",
      ef: { llegaCon: ["automata", "automata", "automata", "automata"], atqClaseAliada: { automata: 2 }, defClaseAliada: { automata: 1 },
        activa: { id: "reparar", nombre: "Reparar", texto: "Repara 6 a todas tus máquinas a 2 casillas o menos: autómatas, carros y barcos.", cd: 3, radio: 2, cura: 6 },
        activa2: { id: "montaje", nombre: "Línea de montaje", texto: "Monta un autómata a su lado. No cuenta para el límite de tropas.", cd: 4, clase: "automata", n: 1 } } },
    ottavio: { hp: 46, atq: 9, def: 5, mov: 4, texto: "Un soborno gratis por turno. Los aliados a 2 casillas o menos no pueden ser atacados desde lejos.",
      ef: { sobornoGratis: true, velo: 2,
        activa: { id: "comprar", nombre: "Una oferta", texto: "Compra durante 3 turnos a una criatura o a un recluta enemigo a su lado.", cd: 3, alc: 1, soloReclutas: true },
        activa2: { id: "ocultar", nombre: "La noche es nuestra", texto: "Ella y los aliados a 2 casillas o menos se ocultan hasta que ataquen.", cd: 4, radio: 2, turnos: 3 } } },
    brasa: { hp: 44, atq: 10, def: 4, mov: 3, alc: 3, texto: "Ataca a 3 casillas. Lo que golpea se queda ardiendo un turno: 2 de daño a quien esté en esa casilla.",
      ef: { ardiente: 1,
        activa: { id: "area", nombre: "Pira", texto: "6 de daño a todo lo que haya en un cuadro de 3×3, hasta a 4 casillas. El cuadro arde 2 turnos.", cd: 4, dano: 6, alc: 4, fuego: 2 },
        activa2: { id: "muro", nombre: "Muro de fuego", texto: "Una línea de 3 casillas ardiendo que nadie puede cruzar durante 2 turnos.", cd: 4, alc: 4, largo: 3, turnos: 2, fuego: true } } },
    humores: { hp: 44, atq: 8, def: 5, mov: 3, alc: 2, texto: "+4 de maná por turno.",
      ef: { manaTurno: 4,
        activa: { id: "curar", nombre: "Triaca", texto: "Cura 8 a todos los aliados a 3 casillas o menos y les quita estar frenados.", cd: 3, cura: 8, radio: 3, limpia: true },
        activa2: { id: "miasma", nombre: "Miasma", texto: "Los enemigos a 2 casillas o menos tienen −2 de ataque durante 2 turnos.", cd: 4, radio: 2, atq: 2, turnos: 2 } } },
    umbral: { hp: 52, atq: 8, def: 7, mov: 3, texto: "Los aliados a 2 casillas o menos tienen +2 de defensa.",
      ef: { auraDef: { n: 2, r: 2 },
        activa: { id: "muro", nombre: "Muro de runas", texto: "Levanta un muro de 3 casillas en línea durante 3 turnos.", cd: 4, alc: 3, largo: 3, turnos: 3 },
        activa2: { id: "sello", nombre: "Sello", texto: "Una ciudad tuya a 3 casillas o menos no puede ser tomada ni sitiada durante 3 turnos.", cd: 6, alc: 3, turnos: 3 } } },
    ceniciento: { hp: 50, atq: 10, def: 5, mov: 3, texto: "Cuando cae una tropa de Osses a 3 casillas o menos, se levanta como la que era, con media vida (hasta 2 por turno). Las que no son de Osses vuelven como Legión de huesos. No ocupan límite.",
      ef: { alzaCaidos: { r: 3, n: 2 },
        activa: { id: "alzar", nombre: "Volved", texto: "Levanta a los 3 caídos más fuertes a 3 casillas o menos, con toda su vida.", cd: 6, n: 3, radio: 3 },
        activa2: { id: "marea", nombre: "Marea de ceniza", texto: "Las tropas de Osses a 3 casillas o menos tienen +2 de ataque y se curan 2 durante 2 turnos.", cd: 4, radio: 3, atq: 2, cura: 2, turnos: 2 } } },
    vigilante: { hp: 52, atq: 9, def: 6, mov: 3, texto: "Consagra la casilla que pisa y las de alrededor. Los aliados a 2 casillas o menos ignoran el primer golpe de cada turno.",
      ef: { consagraAlPisar: 1, escudoAliados: 2,
        activa: { id: "juicio", nombre: "Juicio", texto: "6 de daño a un enemigo a 3 casillas o menos; el doble a los muertos vivientes y a los monstruos.", cd: 3, alc: 3, dano: 6 },
        activa2: { id: "alba", nombre: "Luz del alba", texto: "Cura 6 a tus tropas en casillas consagradas y hace 3 de daño a los enemigos que estén en ellas, a 4 casillas o menos.", cd: 4, radio: 4, cura: 6, dano: 3 } } },
    genichiro: { hp: 48, atq: 11, def: 5, mov: 4, texto: "+5 de ataque contra una unidad que está sola. Quien recibe su golpe no puede responder.",
      ef: { atqSolo: 5, sinRespuesta: true,
        activa: { id: "corte", nombre: "Corte del río", texto: "Golpea a todos los enemigos que tiene al lado.", cd: 3 },
        activa2: { id: "desafio", nombre: "Desafío", texto: "Elige un enemigo a 3 casillas o menos. Hasta que uno caiga, o durante 2 turnos, nadie más puede atacarlos ni ayudarlos. Si gana, +2 de ataque el resto de la guerra.", cd: 5, alc: 3, turnos: 2 } } },
    ebonrabia: { tam: 2, hp: 56, atq: 10, def: 5, mov: 4, texto: "Ocupa 2×2 casillas. Su furia llega a +7 de ataque y se cura 8 cada vez que mata.",
      ef: { furia: 7, curaAlMatar: 8,
        activa: { id: "miasma", nombre: "Rugido", texto: "Los enemigos a 2 casillas o menos tienen −2 de ataque y quedan trabados durante 2 turnos.", cd: 4, radio: 2, atq: 2, turnos: 2, traba: true },
        activa2: { id: "salto", nombre: "Salto del trueno", texto: "Salta a una casilla a 3 o menos, también sobre el agua, y golpea a los enemigos de alrededor con la mitad de su ataque.", cd: 3, alc: 3, golpe: true } } },
    dientesal: { hp: 46, atq: 9, def: 5, mov: 3, alc: 2, texto: "Ataca a 2 casillas con su pistola. Sus barcos a 3 casillas o menos tienen +2 de ataque.",
      ef: { barcosAtq: { n: 2, r: 3 },
        activa: { id: "area", nombre: "Andanada de barriles", texto: "5 de daño a todo lo que haya en un cuadro de 3×3, hasta a 4 casillas.", cd: 3, dano: 5, alc: 4 },
        activa2: { id: "curar", nombre: "Limonada de a bordo", texto: "Cura 6 a los aliados a 2 casillas o menos, barcos incluidos.", cd: 3, cura: 6, radio: 2 } } },
    zaphar: { tam: 2, modoAgua: "puente", hp: 50, atq: 10, def: 5, mov: 3, texto: "Ocupa 2×2 casillas. Devora y adapta: cada enemigo que mata, también al engullirlo, le deja un rasgo según lo que era (vida, ataque, defensa, alcance o movimiento). Puede repetirlos y no tienen tope. Su colmena le tiende un puente: cruza el agua una casilla por turno, sin defensa.",
      ef: { devoraSinTope: true,
        activa: { id: "engullir", nombre: "Engullir", texto: "Se come a un enemigo a su lado que tenga un tercio de su vida o menos: muere al instante, Zaphar gana su rasgo y se cura 6.", cd: 3, cura: 6 },
        activa2: { id: "montaje", nombre: "Llamada de la colmena", texto: "Salen 2 Obreras zapadoras a su lado. No cuentan para el límite de tropas.", cd: 5, clase: "zapadora", n: 2 } } },
    reinhardt: { hp: 54, atq: 9, def: 7, mov: 3, texto: "Mientras viva, cada ciudad conquistada entrega un Pretoriano, sin tope. Los aliados a 2 casillas o menos tienen +2 de defensa. Su alabarda pega 2 más a la caballería.",
      ef: { tributoMejor: true, tributoSinTope: true, auraDef: { n: 2, r: 2 }, contraHeroe: { jinete: 2, jinete_pesado: 2 },
        activa: { id: "muralla", nombre: "Muralla de escudos", texto: "Hasta tu próximo turno, los aliados a 2 casillas o menos no reciben más de 4 de daño por golpe.", cd: 4, radio: 2, tope: 4 },
        activa2: { id: "corte", nombre: "Barrido", texto: "Golpea a todos los enemigos que tiene al lado; a los jinetes, el doble.", cd: 3, multJinete: 2 } } },
    rykerd: { tam: 2, hp: 60, atq: 11, def: 5, mov: 3, texto: "Ocupa 2×2 casillas. Los enemigos a 2 casillas o menos pierden 2 de ataque. Gana +3 de ataque por cada aliado que muere. Si cae el Maestro Cazador, se desata 3 turnos.",
      ef: { temible: { n: 2, r: 2 }, rencor: 3, contencion: true,
        activa: { id: "linea", nombre: "Ira del Imperdonable", texto: "6 de daño a todos los enemigos en una línea de 4 casillas.", cd: 4, largo: 4, dano: 6 },
        activa2: { id: "salto", nombre: "Salto", texto: "Va a cualquier casilla libre a 5 o menos, sin importar el terreno ni el agua.", cd: 3, alc: 5 } } }
  };
  Object.keys(HEROES_V5).forEach(k => {
    const h = HEROES[k], n = HEROES_V5[k];
    Object.assign(h, n);
    const c = {}; Object.keys(h.coste).forEach(r => { c[r] = h.coste[r] * 3; }); h.coste = c;
  });
  // Reglas 5: los requisitos propios de cada héroe, más duros. Además piden renombre y un turno mínimo (abajo)
  const REQ_V5 = {
    adam: [{ t: "fortaleza" }, { t: "edificio", id: "herreria" }, { t: "regiones", n: 3 }, { t: "oficiales", n: 2 }],
    mano_de_oro: [{ t: "edificio", id: "banco" }, { t: "ciudades", n: 5 }, { t: "cuenta", k: "saqueos", n: 2, texto: "Tomar 2 ciudades" }],
    engranaje: [{ t: "edificio", id: "taller" }, { t: "saber", n: 7 }, { t: "ciudades", n: 4 }],
    ottavio: [{ t: "mercado" }, { t: "saber", n: 5 }, { t: "cuenta", k: "duelos", n: 3, texto: "Matar a 3 enemigos que estaban solos" }],
    brasa: [{ t: "edificio", id: "torre_magia" }, { t: "saber", n: 8 }, { t: "matados", n: 10 }],
    humores: [{ t: "edificio", id: "torre_magia" }, { t: "saber", n: 8 }, { t: "matados", n: 10 }],
    umbral: [{ t: "edificio", id: "torre_magia" }, { t: "saber", n: 8 }, { t: "matados", n: 10 }],
    ceniciento: [{ t: "saber", n: 6 }, { t: "muertos", n: 30 }, { t: "cuenta", k: "perdidas", n: 5, texto: "Haber perdido 5 unidades en esta guerra" }],
    vigilante: [{ t: "edificio", id: "catedral" }, { t: "consagradas", n: 20 }, { t: "ciudades", n: 4 }],
    genichiro: [{ t: "edificio", id: "dojo" }, { t: "saber", n: 6 }, { t: "cuenta", k: "duelos", n: 6, texto: "Ganar 6 duelos (matar a una unidad que está sola)" }],
    ebonrabia: [{ t: "edificio", id: "circulo_huesos" }, { t: "cuenta", k: "racha", n: 5, texto: "Matar a 5 enemigos seguidos sin perder ninguna unidad" }, { t: "cuenta", k: "salvajes", n: 2, texto: "Cazar 2 criaturas salvajes" }],
    dientesal: [{ t: "edificio", id: "astillero" }, { t: "cuenta", k: "saqueos", n: 3, texto: "Tomar 3 ciudades" }, { t: "matados", n: 12 }],
    zaphar: [{ t: "cuenta", k: "devorados", n: 10, texto: "Devorar a 10 enemigos" }, { t: "ciudades", n: 5 }],
    reinhardt: [{ t: "regiones", n: 5 }, { t: "cuenta", k: "tributos", n: 2, texto: "Cobrar 2 tributos de ciudades conquistadas" }, { t: "oficiales", n: 2 }],
    rykerd: [{ t: "fortaleza" }, { t: "cuenta", k: "salvajes", n: 5, texto: "Cazar 5 criaturas salvajes" }, { t: "saber", n: 8 }, { t: "edificio", id: "perrera" }]
  };
  Object.keys(REQ_V5).forEach(k => { if (HEROES[k]) HEROES[k].req = REQ_V5[k]; });
  // Lo que un ejército necesita para invocar a su héroe, además de su requisito propio
  const RENOMBRE_HEROE = 100;
  const TURNO_HEROE = { pequeno: 10, normal: 12, grande: 14, enorme: 16 };


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
    archipielago: { nombre: "Archipiélago", texto: "Islas pequeñas separadas por canales. Casi todo se decide con barcos.", maritimo: true },
    mar_interior: { nombre: "Mar interior", texto: "Un anillo de tierra alrededor de un mar, con el Núcleo en una isla en el centro.", maritimo: true }
  };

  /* Fragmentos: nombres de lugares reales del compendio (estables) o inventados (oníricos e imposibles) */
  const FRAGMENTOS = {
    estable: ["Osses", "Brurland", "Dolbred", "Nernib", "Seosan", "Rasganorte", "Thanea", "Uldum", "Relania", "Kalvia", "Mravec", "Broneland", "Cudbusland", "Galadhel", "Okran", "Genevia", "Chakur", "Merador"],
    onirico: ["El Granero de Hojaseca", "La Posada del Caminante", "Los Robles Viejos", "Plaza del Campanario", "Pozo de la Elvira", "La Feria del Ganado", "Alto del Cierzo",
      "Camino de los Arrieros", "Ribera de las Viudas", "Los Perales Negros", "Torre de los Molineros", "Puente de la Calzada", "Las Eras Altas", "Patio de las Comadres", "Vega de los Sauces"],
    imposible: ["El Mar de Pared", "Bastión de la Estrella", "Ciudad de las Mil Puertas", "El Llano de las Lanzas", "Los Peldaños del Abismo", "La Bóveda Rota", "La Biblioteca Quemada",
      "Faro de Piedra Negra", "El Aguacero Suspendido", "La Hora Partida", "Monte de las Cavernas", "Río Contracorriente", "Galería de los Dobles", "Las Salinas Blancas", "El Cabo Torcido"]
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
    cicatriz: [["el Astillado", "la Astillada"], ["el Remendado", "la Remendada"], ["el Zurcido", "la Zurcida"], ["el Quebrado", "la Quebrada"], ["Cara de Mapa", "Cara de Mapa"],
      ["Media Oreja", "Media Oreja"], ["Tres Dedos", "Tres Dedos"], ["el Tuerto", "la Tuerta"], ["Boca Torcida", "Boca Torcida"], ["el Cosido", "la Cosida"], ["Cuello de Cuerda", "Cuello de Cuerda"],
      ["el Mordido", "la Mordida"], ["Sin Nariz", "Sin Nariz"], ["el Quemado", "la Quemada"], ["Diente Roto", "Diente Roto"], ["el Rajado", "la Rajada"], ["Piel de Lija", "Piel de Lija"]],
    matador: [["el Segador", "la Segadora"], ["Mano de Hierro", "Mano de Hierro"], ["el Verdugo", "la Verdugo"], ["el Cuervo", "la Cuervo"], ["Rompehuesos", "Rompehuesos"], ["el Desollador", "la Desolladora"],
      ["Comecuervos", "Comecuervos"], ["el Carnicero", "la Carnicera"], ["Machacacráneos", "Machacacráneos"], ["el Que Ríe", "la Que Ríe"], ["Bebesangre", "Bebesangre"], ["el Tajador", "la Tajadora"],
      ["Mataperros", "Mataperros"], ["el Hacha", "el Hacha"], ["Cien Muescas", "Cien Muescas"], ["el Lento", "la Lenta"], ["Mordisco", "Mordisco"]],
    firme: [["el Firme", "la Firme"], ["el Muro", "la Muralla"], ["Pie de Roble", "Pie de Roble"], ["el Yunque", "la Yunque"], ["Piedra", "Piedra"], ["el Terco", "la Terca"], ["Espalda de Buey", "Espalda de Buey"], ["el Poste", "la Poste"]],
    veloz: [["el Galgo", "la Galga"], ["Pies de Viento", "Pies de Viento"], ["el Rayo", "la Chispa"], ["el Liebre", "la Liebre"], ["Sombra Corta", "Sombra Corta"], ["el Gamo", "la Gama"], ["Talones", "Talones"]],
    sabio: [["el Cuaderno", "la Cuaderna"], ["Ojo de Tinta", "Ojo de Tinta"], ["el Contable", "la Contable"], ["Cuatro Ojos", "Cuatro Ojos"], ["el Zorro", "la Zorra"], ["el Mapa", "la Mapa"]],
    longevo: [["el Viejo", "la Vieja"], ["el Perenne", "la Perenne"], ["Abuelo", "Abuela"], ["el Que Sigue", "la Que Sigue"], ["Barba Gris", "Trenza Gris"], ["el Último", "la Última"]],
    capitan: [["el Capitán", "la Capitana"], ["el Que Manda", "la Que Manda"], ["Voz de Trueno", "Voz de Trueno"], ["el Sargento", "la Sargento"]],
    // Títulos que se ganan por lo que hace cada uno en la guerra (al estilo de los capitanes de Shadow of War)
    jefes: [["Matarreyes", "Matarreyes"], ["Rompecoronas", "Rompecoronas"], ["Cazacapitanes", "Cazacapitanes"], ["el Regicida", "la Regicida"], ["Degüellajefes", "Degüellajefes"], ["Quiebraestandartes", "Quiebraestandartes"]],
    inmortal: [["el Inmortal", "la Inmortal"], ["Duro de Matar", "Dura de Matar"], ["Siete Vidas", "Siete Vidas"], ["el Terco", "la Terca"], ["Medio Muerto", "Medio Muerta"], ["Tumba Vacía", "Tumba Vacía"]],
    monstruos: [["Cazabestias", "Cazabestias"], ["el Desollador", "la Desolladora"], ["Mataogros", "Mataogros"], ["Colmillo Roto", "Colmillo Roto"], ["el Matador de Bestias", "la Matadora de Bestias"]],
    lejos: [["Ojo Fino", "Ojo Fino"], ["Pulso Firme", "Pulso Firme"], ["el Certero", "la Certera"], ["Mil Flechas", "Mil Flechas"], ["el Paciente", "la Paciente"]],
    cerca: [["Rompehuesos", "Rompehuesos"], ["el Carnicero", "la Carnicera"], ["Puño de Hierro", "Puño de Hierro"], ["Muerdecuellos", "Muerdecuellos"], ["el Sin Miedo", "la Sin Miedo"]],
    solos: [["el Carroñero", "la Carroñera"], ["el Rematador", "la Rematadora"], ["Cuchillo de Rezagados", "Cuchillo de Rezagados"], ["el Acechador", "la Acechadora"]],
    saqueo: [["el Saqueador", "la Saqueadora"], ["Mano Larga", "Mano Larga"], ["Rompepuertas", "Rompepuertas"], ["el Primero en Entrar", "la Primera en Entrar"]],
    mar: [["Lobo de Mar", "Loba de Mar"], ["el Salobre", "la Salobre"], ["Pie de Barco", "Pie de Barco"]],
    andarin: [["Botas Rotas", "Botas Rotas"], ["el Andarín", "la Andarina"], ["Pies de Viento", "Pies de Viento"]]
  };


  raiz.FRACTURA_DATOS = {
    RECURSOS, RECURSO_NOMBRE, TERRENOS, ESTRUCTURAS, CLASES, CLASES_BASE, ESPECIALIZACIONES, RANGOS, EDIFICIOS, ESCUELAS, RELIQUIAS, SLOTS, OBRAS, FACCIONES,
    TIPOS_FRACTURA, FRAGMENTOS, SUCESOS, DIFICULTADES, NOMBRES, ORIGENES, APODOS, HEROES, RENOMBRE_HEROE, TURNO_HEROE, ALIAS_FACCION, faccionReal, tropa, textoEdificio, nombreEdificio, nivelCiudad, BARCOS_BASE, NOMBRES_BARCO, FORMAS_MAPA, REGLAS: 5, MOTOR: 20271155
  };
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.FRACTURA_DATOS;
})(typeof window !== "undefined" ? window : globalThis);
