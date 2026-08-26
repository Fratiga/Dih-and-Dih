window.STATS = [
  {
    id: "rook",
    personajeId: "rook",
    nombre: "Rook",
    rol: "Asesino / Ejecutor",
    tipo: "Humanoide",
    raza: "Humano",
    nivel: 8,
    pv: 145,
    ca: 19,
    velocidad: "40 pies",
    stats: { fue: 18, des: 22, con: 18, int: 13, sab: 17, car: 11 },
    equipo: ["Arpón con cadena", "Daga de degüello", "Cuchillo oculto", "Bombas de humo"],
    habilidades: [
      { nombre: "Depredador (Pasiva)", descripcion: "Mientras ningún enemigo esté adyacente a él, obtiene ventaja en todas las tiradas de ataque." },
      { nombre: "Cazador Solitario (Pasiva)", descripcion: "Mientras solo tenga un enemigo a 9 metros o menos: +2 CA, +3 m de velocidad, +2d6 daño." },
      { nombre: "Arpón (Acción)", descripcion: "Alcance 18 m. +10 al impacto. Daño: 2d8+5 perforante. El objetivo queda Enganchado." },
      { nombre: "Arrastre (Bonus)", descripcion: "Una criatura Enganchada es arrastrada hasta quedar adyacente. No requiere tirada." },
      { nombre: "Degüello (Acción)", descripcion: "Solo puede usarse sobre criaturas Enganchadas. +10 al impacto. Daño: 3d8+5 cortante. Si el objetivo está por debajo del 40% de su vida, debe superar una salvación de Constitución CD 18 o muere instantáneamente." },
      { nombre: "Paso entre Sombras (Bonus)", descripcion: "Se teletransporta hasta 30 pies entre zonas oscuras." },
      { nombre: "Bomba de Humo (Recarga 5-6)", descripcion: "Crea una nube de 6 metros. Obtiene Ocultamiento Total." },
      { nombre: "No Escapas (Reacción)", descripcion: "Cuando una criatura abandona su alcance puede realizar inmediatamente un ataque de Arpón." },
      { nombre: "Mirada del Verdugo (Rasgo único)", descripcion: "Al inicio de cada turno elige una criatura que pueda ver. Solo esa criatura puede realizar ataques de oportunidad contra él hasta el inicio de su siguiente turno." }
    ],
    estrategia: "Nunca pelea contra grupos."
  },
  {
    id: "bull",
    personajeId: "bull",
    nombre: "Bull",
    rol: "Tanque / Control",
    tipo: "Humanoide",
    raza: "Humano",
    nivel: 5,
    pv: 95,
    ca: 17,
    velocidad: "30 pies",
    stats: { fue: 18, des: 12, con: 18, int: 9, sab: 14, car: 10 },
    equipo: ["Escopeta de perdigones"],
    habilidades: [
      { nombre: "Disparo de Perdigones (Acción)", descripcion: "Ataque en cono de 15 pies. Daño: 2d8 + Fuerza. Todas las criaturas golpeadas superan una salvación de Fuerza CD 15 o son empujadas 3 metros." },
      { nombre: "Culatazo (Acción)", descripcion: "Ataque cuerpo a cuerpo. Daño: 1d10 + Fuerza. Si impacta puede Derribar." },
      { nombre: "¡Quieto! (Reacción)", descripcion: "Cuando una criatura abandona su alcance, realiza un Disparo de Perdigones." },
      { nombre: "Aguantar Posición (Acción Bonus)", descripcion: "Hasta el inicio de su siguiente turno obtiene resistencia al daño contundente, cortante y perforante." }
    ],
    estrategia: "Bull nunca persigue, ocupa puertas, pasillos y puentes. Su trabajo consiste en impedir que alguien llegue hasta Baraja mientras Garra trae enemigos hacia él; Bull los recibe con la escopeta."
  },
  {
    id: "garra",
    personajeId: "garra",
    nombre: "Garra",
    rol: "Controlador / Cazador",
    tipo: "Humanoide",
    raza: "Semi Gigante",
    nivel: 5,
    ca: 16,
    pv: 80,
    stats: { fue: 20, des: 13, con: 17, int: 8, sab: 12, car: 8 },
    equipo: ["Arpón con cadena"],
    habilidades: [
      { nombre: "Arpón (Acción)", descripcion: "Rango 30 pies. Ataque: 1d10 + Fuerza. Si impacta el objetivo queda Enganchado (velocidad 0 mientras dure; puede liberarse con una salvación de Fuerza)." },
      { nombre: "Arrastrar (Bonus)", descripcion: "Si una criatura está Enganchada, puede moverla hasta 20 pies hacia él." },
      { nombre: "Lanzamiento Brutal (Acción)", descripcion: "Si una criatura está adyacente puede lanzarla con una prueba enfrentada de Atletismo. Si gana, la lanza hasta 20 pies. Daño: 2d6 contundente." },
      { nombre: "Cadena Viva (Pasiva)", descripcion: "Mientras una criatura permanezca Enganchada, tiene desventaja para escapar." }
    ],
    estrategia: "Nunca busca hacer daño, busca separar. Siempre intenta atraer al sanador o al mago; después Bull termina el trabajo."
  },
  {
    id: "baraja",
    personajeId: "baraja",
    nombre: "Baraja",
    rol: "Control / Apoyo",
    tipo: "Humanoide",
    raza: "Humano",
    nivel: 4,
    pv: 55,
    ca: 14,
    stats: { fue: 8, des: 18, con: 12, int: 16, sab: 13, car: 17 },
    equipo: ["3 Cartas Carmesí", "3 Cartas Azules", "3 Cartas Doradas (se recuperan tras un descanso corto)"],
    habilidades: [
      { nombre: "Cartas Carmesí (Acción)", descripcion: "Selecciona un punto a 18 metros, radio 9 pies. Todas las criaturas en el área reciben 3d6 de daño de fuerza (mitad con salvación de Destreza)." },
      { nombre: "Cartas Azules (Acción)", descripcion: "Ataque a 60 pies. Daño: 1d6 + Destreza. Hasta el inicio de su siguiente turno, el siguiente ataque de un aliado contra ese objetivo inflige 2d6 de daño adicional." },
      { nombre: "Cartas Doradas (Acción)", descripcion: "A 60 pies, el objetivo hace una salvación de Destreza o queda Inmovilizado hasta el final de su siguiente turno; puede repetir la tirada al final de cada turno." },
      { nombre: "Truco Bajo la Manga (Pasiva)", descripcion: "Una vez por ronda puede robar una carta al azar, recuperando una ya utilizada." }
    ],
    estrategia: "Jamás entra en cuerpo a cuerpo. Siempre actúa el último. Prioridad: inmovilizar al sanador, marcar con Carta Carmesí al objetivo de Bull, y lanzar la Carmesí si tres o más enemigos están agrupados."
  },
  {
    id: "verdam",
    personajeId: "verdam",
    nombre: "Verdam",
    rol: "Cazador / Francotirador / Asesino",
    tipo: "Humanoide",
    raza: "Humano",
    nivel: 9,
    equipo: ["Arco de Caza"],
    pv: 180,
    ca: 19,
    velocidad: "35 pies",
    stats: { fue: 14, des: 24, con: 18, int: 14, sab: 20, car: 10 },
    habilidades: [
      { nombre: "Marca de la Presa (Acción Bonus)", descripcion: "Marca a una criatura visible a 120 pies. Mientras esté marcada, siempre sabe su ubicación en el mismo plano y obtiene +2 al ataque y +2d8 al daño contra ella. Solo una marca a la vez." },
      { nombre: "Disparo de Caza (Acción)", descripcion: "Ataque +11, alcance 150 pies. Daño: 2d10+7 perforante. Si el objetivo está por debajo de la mitad de sus PV, inflige 2d10 adicional (3d10 contra humanoides y no-muertos)." },
      { nombre: "Disparo Perforante (Acción)", descripcion: "Ataque +11, alcance 120 pies, atraviesa al objetivo. Daño: 4d10+7 perforante, ignora media y tres cuartos de cobertura. Contra humanoide o no-muerto reduce su velocidad 15 pies hasta el final de su siguiente turno." },
      { nombre: "Flecha de Ejecución (Acción)", descripcion: "Contra una criatura con menos de la mitad de sus PV. Daño: 6d10+7 perforante. Si queda con 30 PV o menos, salvación de Constitución CD 19 o cae a 0 PV." },
      { nombre: "Trampa de Cazador (Acción Bonus)", descripcion: "Coloca una trampa a 5 pies. La primera criatura que la pise hace una salvación de Destreza CD 19 o recibe 3d10 perforante y queda Restringida (puede repetir la salvación cada turno)." },
      { nombre: "Paso del Cazador (Reacción)", descripcion: "Cuando una criatura se acerca a 10 pies, se desplaza hasta 20 pies sin provocar ataques de oportunidad; si termina en cobertura, puede hacer una prueba de Sigilo inmediata." },
      { nombre: "Contraataque (Reacción)", descripcion: "Cuando una criatura falla un ataque contra él, realiza inmediatamente un Disparo de Caza contra ella." },
      { nombre: "Cazador de Humanoides (Pasiva)", descripcion: "Ventaja en ataques contra humanoides; una vez por turno, al impactar a un humanoide inflige 2d10 de daño adicional. Ventaja en Supervivencia para rastrearlos." },
      { nombre: "Cazador de No-Muertos (Pasiva)", descripcion: "Ventaja en ataques contra no-muertos; una vez por turno, al impactar a un no-muerto inflige 3d10 de daño radiante adicional, ignorando su resistencia a necrótico." },
      { nombre: "Aprovechar la Debilidad (Pasiva)", descripcion: "Ventaja en ataques contra criaturas con menos de la mitad de sus PV; al impactar a una de ellas, puede hacer un segundo ataque como Acción Bonus." },
      { nombre: "Cazador Paciente (Pasiva)", descripcion: "Si no se mueve durante su turno, obtiene +2 al ataque y +2d10 al daño de su próximo ataque; el beneficio termina si se mueve voluntariamente." }
    ],
    estrategia: "No entra en combate mientras el enemigo esté en buenas condiciones. Observa desde antes de la batalla y espera a que terminen de enfrentarse al dragón. Cuando los aventureros estén debilitados, dispara desde una posición elevada y cubierta: primero elimina a quienes puedan curar o devolver aliados a la batalla, después apunta a los que tengan menos PV. Nunca permanece en el mismo lugar después de disparar. Si alguien se acerca, usa Paso del Cazador y una Trampa de Cazador para recuperar distancia, y si lo persiguen, los conduce hacia un terreno que haya preparado previamente."
  },
  {
    id: "eklino",
    personajeId: "eklino-a",
    nombre: "Eklino",
    rol: "Defensor",
    tipo: "Humanoide",
    nivel: 3,
    pv: 42,
    ca: 15,
    velocidad: "30 pies",
    stats: { fue: 16, des: 12, con: 16, int: 9, sab: 13, car: 11 },
    habilidades: [
      { nombre: "Ataque", descripcion: "+5 al impacto. Daño: 1d8+3 perforante." },
      { nombre: "Empujar (Bonus)", descripcion: "Una criatura hace una salvación de Fuerza CD 13 o retrocede 5 pies." },
      { nombre: "Defender Refugio (Pasiva)", descripcion: "Mientras permanezca a menos de 3 metros de un aldeano, obtiene +2 CA y los enemigos tienen desventaja para atacar a los civiles." },
      { nombre: "Aguantar (Una vez por combate)", descripcion: "Recupera 2d8+3 PV." }
    ],
    estrategia: "Jamás abandona la entrada. Su prioridad es salvar civiles."
  },
  {
    id: "adam-kovacs",
    personajeId: "adam-kovacs",
    nombre: "Adam Kovacs",
    rol: "Capitán de los caballeros de Brurland",
    tipo: "Humanoide",
    nivel: "Desconocido, muy fuerte por lo que se sabe de sus historias, incomparable a casi nadie en poder.",
    habilidades: [],
    estrategia: ""
  },
  {
    id: "aldeano-comun",
    nombre: "Aldeano Común",
    rol: "Civil",
    tipo: "Humanoide",
    nivel: 0,
    pv: 8,
    ca: 10,
    velocidad: "60 pies",
    stats: { fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
    habilidades: [
      { nombre: "Improvisar Arma (Acción)", descripcion: "+2 al ataque. Daño: 1d4 contundente." },
      { nombre: "Pánico (Pasiva)", descripcion: "Cuando un enemigo termina su turno a 10 pies o menos, debe superar una salvación de Sabiduría CD 10 o usa toda su velocidad para huir." }
    ],
    estrategia: "No pelea. Solo intenta sobrevivir."
  },
  {
    id: "miliciano-brurland",
    nombre: "Miliciano de Brurland",
    rol: "Infantería",
    tipo: "Humanoide",
    pv: 28,
    ca: 17,
    velocidad: "30 pies",
    equipo: ["Espada larga", "Escudo", "Armadura de malla"],
    stats: { fue: 16, des: 11, con: 14, int: 10, sab: 12, car: 10 },
    habilidades: [
      { nombre: "Espada Larga (Acción)", descripcion: "Ataque cuerpo a cuerpo. +5 al impacto. Daño: 1d8+3 cortante." },
      { nombre: "Empuje con Escudo (Acción Bonus)", descripcion: "Una criatura adyacente hace una salvación de Fuerza CD 13 o es empujada 5 pies." },
      { nombre: "Formación Cerrada (Pasiva)", descripcion: "Mientras esté adyacente a otro Miliciano obtiene +1 CA, hasta un máximo de +2." }
    ],
    estrategia: "Nunca combate solo. Siempre intenta formar una línea de escudos. No persigue enemigos aislados."
  },
  {
    id: "arquero-milicia",
    nombre: "Arquero de la Milicia",
    rol: "Apoyo",
    tipo: "Humanoide",
    pv: 20,
    ca: 14,
    stats: { fue: 10, des: 16, con: 12, int: 10, sab: 13, car: 10 },
    habilidades: [
      { nombre: "Arco Largo (Acción)", descripcion: "Alcance 45/180 m. +5 al impacto. Daño: 1d8+3 perforante." },
      { nombre: "Disparo de Cobertura (Pasiva)", descripcion: "Una criatura golpeada reduce su velocidad en 10 pies hasta el final del siguiente turno." },
      { nombre: "Objetivo Marcado (Bonus)", descripcion: "Marca a un enemigo. El siguiente aliado que lo golpee inflige 1d4 de daño adicional." }
    ],
    estrategia: "Siempre permanece detrás de los escuderos. Prioriza enemigos rápidos."
  },
  {
    id: "sargento-milicia",
    nombre: "Sargento de la Milicia",
    rol: "Líder",
    tipo: "Humanoide",
    pv: 45,
    ca: 18,
    stats: { fue: 17, des: 12, con: 16, int: 12, sab: 14, car: 15 },
    equipo: ["Espada bastarda"],
    habilidades: [
      { nombre: "Espada Bastarda (Acción)", descripcion: "+6 al impacto. Daño: 1d10+4." },
      { nombre: "Orden (Bonus)", descripcion: "Un Miliciano puede moverse hasta la mitad de su velocidad sin provocar ataques de oportunidad." },
      { nombre: "Mantener la Formación (Reacción)", descripcion: "Cuando un aliado a 5 pies recibe daño, lo reduce en 1d8+2." },
      { nombre: "¡Adelante! (Recarga 5-6)", descripcion: "Todos los Milicianos cercanos pueden moverse 10 pies y realizar un ataque." }
    ],
    estrategia: "Nunca lidera desde delante. Mantiene unida la formación. Es el objetivo prioritario si los jugadores quieren romper la disciplina enemiga."
  },
  {
    id: "caballero-brurland",
    nombre: "Caballero de Brurland",
    rol: "Caballería Pesada",
    tipo: "Humanoide",
    pv: 75,
    ca: 19,
    stats: { fue: 19, des: 12, con: 18, int: 11, sab: 14, car: 15 },
    equipo: ["Espada de caballero"],
    habilidades: [
      { nombre: "Espada de Caballero (Acción)", descripcion: "+7 al impacto. Daño: 2d6+4." },
      { nombre: "Embestida (Acción)", descripcion: "Si se mueve al menos 20 pies en línea recta antes de atacar, añade 2d6 de daño; el objetivo hace una salvación de Fuerza CD 15 o cae Derribado." },
      { nombre: "Proteger al Rey (Reacción)", descripcion: "Intercepta un ataque dirigido contra un aliado a 10 pies." },
      { nombre: "Resolución Inquebrantable (Una vez por combate)", descripcion: "La primera vez que llegue a 0 PV, queda en 1 PV en su lugar." }
    ],
    estrategia: "Busca enfrentarse al personaje más fuerte. Jamás ataca enemigos indefensos. Si un aliado cae, intenta cubrir la retirada antes que perseguir."
  },
  {
    id: "kobold",
    nombre: "Kobold",
    rol: "Infantería Ligera",
    tipo: "Draconico",
    nivel: 1,
    pv: 12,
    ca: 13,
    velocidad: "30 pies",
    stats: { fue: 8, des: 15, con: 10, int: 9, sab: 8, car: 8 },
    equipo: ["Daga oxidada", "Honda"],
    habilidades: [
      { nombre: "Daga (Acción)", descripcion: "+4 al impacto. Daño: 1d4+2 perforante." },
      { nombre: "Honda (Acción)", descripcion: "Alcance 40 pies. +4 al impacto. Daño: 1d4 contundente." },
      { nombre: "Instinto de Manada (Pasiva)", descripcion: "Mientras un aliado kobold esté adyacente al objetivo, obtiene ventaja en el ataque." },
      { nombre: "Cobarde (Pasiva)", descripcion: "Cuando queda por debajo del 50% de vida, hace una salvación de Sabiduría CD 10 o intenta huir." }
    ],
    estrategia: "Nunca pelea solo. Busca rodear. Si mueren muchos compañeros, entra en pánico."
  },
  {
    id: "restos-de-ledros",
    nombre: "Restos de Ledros",
    rol: "Infantería",
    tipo: "No-muerto",
    nivel: 3,
    pv: 32,
    ca: 14,
    velocidad: "30 pies",
    stats: { fue: 16, des: 8, con: 16, int: 2, sab: 6, car: 1 },
    habilidades: [
      { nombre: "Cuerpo Improvisado (Rasgo)", descripcion: "Al aparecer tira 1d4 para determinar su cuerpo, que modifica ligeramente sus estadísticas: Barro (+10 PV, -2 CA, reduce la velocidad del objetivo 10 pies al golpear), Raíces (+10 pies de alcance, puede inmovilizar), Piedra (+2 CA, vulnerable al daño contundente), o Madera (+3 m de movimiento, vulnerable al fuego)." },
      { nombre: "Golpe Deforme (Acción)", descripcion: "+5 al impacto. Daño: 2d6+3 contundente." },
      { nombre: "Aferrarse (Bonus)", descripcion: "El objetivo hace una salvación de Fuerza CD 13 o queda Restringido." },
      { nombre: "Alma Inestable (Pasiva)", descripcion: "Al morir explota: todas las criaturas a 5 pies reciben 1d6 de daño necrótico." }
    ],
    estrategia: "No tienen inteligencia. Simplemente avanzan. Si sujetan a alguien, los demás lo rodean."
  },
  {
    id: "alma-errante",
    nombre: "Alma Errante",
    rol: "Espíritu",
    tipo: "No-muerto",
    nivel: 2,
    pv: 14,
    ca: 15,
    habilidades: [
      { nombre: "Toque Espectral (Acción)", descripcion: "+5 al impacto. Daño: 1d8 necrótico." },
      { nombre: "Atravesar (Pasiva)", descripcion: "Ignora terreno difícil y puede atravesar criaturas." },
      { nombre: "Lamento (Recarga 5-6)", descripcion: "Todas las criaturas a 6 metros hacen una salvación de Sabiduría CD 12 o quedan con desventaja en su siguiente ataque." }
    ],
    estrategia: "Pequeños espíritus que todavía no consiguen poseer materia. No son enemigos fuertes, son molestos."
  }
];
