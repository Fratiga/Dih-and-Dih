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
    nivel: 20,
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
  },
  {
    id: "colmillo-gris",
    nombre: "Colmillo Gris",
    rol: "Depredador",
    tipo: "Bestia",
    nivel: 3,
    pv: 52,
    ca: 15,
    velocidad: "50 pies",
    stats: { fue: 18, des: 15, con: 16, int: 3, sab: 14, car: 6 },
    habilidades: [
      { nombre: "Embestida (Acción)", descripcion: "Si se mueve al menos 30 pies antes de atacar: +6 al ataque. Daño: 2d10+4. El objetivo falla una salvación de Fuerza CD 14 o cae Derribado." },
      { nombre: "Colmillos (Acción)", descripcion: "+6 al ataque. Daño: 2d8+4. Si el objetivo está Derribado, añade 1d8 adicional." },
      { nombre: "Instinto Cazador (Pasiva)", descripcion: "Siempre ataca al enemigo con menos PV visibles." },
      { nombre: "Olfato (Pasiva)", descripcion: "Ventaja para detectar criaturas ocultas." },
      { nombre: "Huida Desesperada (Pasiva)", descripcion: "Cuando baja del 20% de vida intenta escapar; si lo logra, puede reaparecer más adelante con cicatrices." }
    ],
    estrategia: "No lucha hasta morir. Hace una gran embestida inicial, intenta derribar a una presa, la muerde un par de veces y, si el combate deja de favorecerle, huye."
  },
  {
    id: "guillotina",
    nombre: "Guillotina",
    rol: "Superdepredador",
    tipo: "Bestia",
    nivel: 7,
    pv: 180,
    ca: 17,
    velocidad: "60 pies",
    stats: { fue: 22, des: 18, con: 18, int: 4, sab: 18, car: 6 },
    habilidades: [
      { nombre: "Depredador Felino (Pasiva)", descripcion: "Conoce la dirección aproximada de cualquier felino en 1 km; ventaja en ataques contra criaturas de tipo Felino." },
      { nombre: "Instinto Animal (Pasiva)", descripcion: "No provoca ataques de oportunidad al abandonar el alcance de criaturas inferiores a tamaño Grande." },
      { nombre: "Cazadora Incansable (Pasiva)", descripcion: "Mientras persiga a un objetivo felino, ignora terreno difícil, no puede ser asustada y su velocidad aumenta 3 metros." },
      { nombre: "Mordida Guillotina (Acción)", descripcion: "+9 al ataque. Daño: 3d10+6 perforante. Si el objetivo es un Felino añade 2d10 de daño." },
      { nombre: "Zarpazo (Acción)", descripcion: "+9 al ataque. Daño: 2d8+6 cortante. Si impacta puede empujar 10 pies." },
      { nombre: "Salto Depredador (Acción)", descripcion: "Se mueve hasta 40 pies sin provocar ataques de oportunidad y puede atacar de inmediato al terminar." },
      { nombre: "Desmembrar (Recarga 5-6)", descripcion: "+10 al ataque. Daño: 4d10+6 cortante. Si deja al objetivo por debajo del 25% de sus PV, este falla una salvación de Constitución CD 17 y pierde una extremidad." },
      { nombre: "Instinto de Caza (Pasiva)", descripcion: "Si logra sujetar a una criatura felina, su siguiente acción siempre es huir con ella; jamás permanece luchando innecesariamente." }
    ],
    estrategia: "Ignora a quien no represente una amenaza inmediata. Si alguien se interpone, lo aparta de un zarpazo. Si consigue atrapar a su presa felina, escapa de inmediato hacia el bosque."
  },
  {
    id: "dragarto",
    nombre: "Dragarto",
    rol: "Bestia de Choque",
    tipo: "Draconico",
    nivel: 3,
    pv: 48,
    ca: 15,
    velocidad: "40 pies",
    stats: { fue: 18, des: 14, con: 16, int: 3, sab: 12, car: 5 },
    habilidades: [
      { nombre: "Mordisco (Acción)", descripcion: "+6 al ataque. Daño: 2d8+4 perforante." },
      { nombre: "Zarpazo (Acción)", descripcion: "+6 al ataque. Daño: 1d10+4 cortante." },
      { nombre: "Embestida (Acción)", descripcion: "Si se mueve al menos 20 pies en línea recta, inflige 2d6 de daño adicional; el objetivo falla una salvación de Fuerza CD 14 o cae Derribado." },
      { nombre: "Frenesí (Pasiva)", descripcion: "Cuando baja del 50% de vida obtiene ventaja en ataques cuerpo a cuerpo y sus ataques infligen +2 de daño." }
    ],
    estrategia: "Corre hacia el enemigo más cercano y rompe líneas defensivas. Persigue a los enemigos caídos."
  },
  {
    id: "protodraco",
    nombre: "Protodraco",
    rol: "Depredador Aéreo",
    tipo: "Draconico",
    raza: "Dragón Grande",
    nivel: 6,
    pv: 145,
    ca: 18,
    velocidad: "40 pies, vuelo 80 pies",
    stats: { fue: 22, des: 16, con: 20, int: 6, sab: 14, car: 10 },
    notas: [
      "Salvaciones: Fue +9, Des +6, Con +8, Sab +5",
      "Habilidades: Percepción +5, Atletismo +9, Acrobacias +6",
      "Percepción pasiva: 15",
      "Resistencia al daño: el tipo asociado a su aliento",
      "Inmune a asustado"
    ],
    habilidades: [
      { nombre: "Instinto Depredador (Pasiva)", descripcion: "Ventaja en iniciativa y en Percepción relacionada con criaturas heridas; ventaja al atacar a quien tenga menos de la mitad de sus PV." },
      { nombre: "Alas Inmaduras (Pasiva)", descripcion: "Puede hacer movimientos bruscos en vuelo sin perder altura; ante un ataque de oportunidad en vuelo puede desplazarse hasta 15 pies antes de que se resuelva, sin provocar más ataques." },
      { nombre: "Sangre Dracónica (Pasiva)", descripcion: "Ventaja en salvaciones contra veneno, enfermedad y efectos que alteren su cuerpo." },
      { nombre: "Multiataque (Acción)", descripcion: "Realiza tres ataques: una Mordida y dos Garras." },
      { nombre: "Mordida (Acción)", descripcion: "+9 al ataque, alcance 10 pies. Daño: 2d10+6 perforante. El objetivo falla una salvación de Fuerza CD 17 o queda agarrado." },
      { nombre: "Garra (Acción)", descripcion: "+9 al ataque, alcance 10 pies. Daño: 2d6+6 cortante." },
      { nombre: "Cola (Acción)", descripcion: "+9 al ataque, alcance 15 pies. Daño: 2d8+6 contundente." },
      { nombre: "Aliento Dracónico (Recarga 5-6)", descripcion: "Cono de 30 pies. Salvación de Destreza CD 16: 6d8 de daño elemental (mitad si supera). Por debajo de la mitad de sus PV inflige 8d8 en su lugar." },
      { nombre: "Aleteo Violento (Acción Especial)", descripcion: "Todas las criaturas a 10 pies fallan una salvación de Fuerza CD 17 o reciben 2d8+6 de daño contundente y son desplazadas 10 pies; después puede volar hasta la mitad de su velocidad." },
      { nombre: "Embestida Aérea (Acción Especial)", descripcion: "Si vuela al menos 30 pies en línea recta y golpea con Mordida, inflige 3d8 de daño adicional y el objetivo falla una salvación de Fuerza CD 17 o cae Derribado." }
    ],
    estrategia: "No es inteligente como un dragón verdadero, ni protege tesoros: es un depredador territorial. Ataca desde el aire, separa a una presa del grupo, la derriba y la arrastra lejos; usa su aliento cuando puede alcanzar a varios objetivos. Por debajo de 30 PV intenta huir, salvo que esté protegiendo un nido."
  },
  {
    id: "guiverno",
    nombre: "Guiverno",
    rol: "Depredador Aéreo",
    tipo: "Draconico",
    raza: "Dragón Grande",
    nivel: 9,
    pv: 210,
    ca: 20,
    velocidad: "50 pies, vuelo 140 pies",
    stats: { fue: 24, des: 22, con: 22, int: 5, sab: 16, car: 10 },
    notas: [
      "Salvaciones: Fue +12, Des +11, Con +11, Sab +6",
      "Habilidades: Acrobacias +11, Percepción +8, Supervivencia +8",
      "Percepción pasiva: 18",
      "Resistencia al daño: el tipo asociado a su aliento",
      "Inmune a asustado"
    ],
    habilidades: [
      { nombre: "Depredador del Cielo (Pasiva)", descripcion: "Ventaja en iniciativa; no provoca ataques de oportunidad al volar fuera de alcance." },
      { nombre: "Cazador Aéreo (Pasiva)", descripcion: "Si se desplaza al menos 30 pies en línea recta antes de golpear, ese ataque inflige 2d8 de daño adicional hasta el final del turno." },
      { nombre: "Sangre Dracónica (Pasiva)", descripcion: "Ventaja en salvaciones contra veneno, enfermedad y efectos que alteren su cuerpo." },
      { nombre: "Vuelo Instintivo (Pasiva)", descripcion: "Puede girar hasta 180 grados en vuelo sin perder velocidad ni altura." },
      { nombre: "Multiataque (Acción)", descripcion: "Realiza cuatro ataques: una Mordida, dos Garras y una Cola." },
      { nombre: "Mordida (Acción)", descripcion: "+12 al ataque, alcance 10 pies. Daño: 2d10+7 perforante." },
      { nombre: "Garra (Acción)", descripcion: "+12 al ataque, alcance 10 pies. Daño: 2d8+7 cortante." },
      { nombre: "Cola (Acción)", descripcion: "+12 al ataque, alcance 15 pies. Daño: 2d10+7 perforante. El objetivo falla una salvación de Constitución CD 19 o queda envenenado 1 minuto, recibiendo 2d8 de daño de veneno al inicio de cada turno (puede repetir la salvación cada turno)." },
      { nombre: "Aliento Dracónico (Recarga 5-6)", descripcion: "Línea de 60x5 pies. Salvación de Destreza CD 18: 8d10 de daño elemental (mitad si supera)." },
      { nombre: "Embestida del Cielo (Acción Especial)", descripcion: "Si vuela al menos 60 pies en línea recta y golpea con Mordida, inflige 4d8 de daño adicional y el objetivo falla una salvación de Fuerza CD 19 o cae Derribado." },
      { nombre: "Picado Mortal (Acción Especial)", descripcion: "Desciende hasta 80 pies hacia un objetivo; si termina a 5 pies, ataca con Garra y, si impacta, inflige 3d8 de daño adicional." },
      { nombre: "Giro Aéreo (Reacción)", descripcion: "Ante un ataque, se desplaza hasta 20 pies en cualquier dirección sin provocar ataques de oportunidad; si el ataque queda fuera de alcance, falla." }
    ],
    estrategia: "Rara vez lucha en tierra. Ataca desde grandes alturas, realiza picados y usa su velocidad para retirarse antes de que puedan responderle. No protege tesoros; su inteligencia es la de un depredador excepcionalmente astuto."
  },
  {
    id: "draco",
    nombre: "Draco",
    rol: "Depredador Terrestre",
    tipo: "Draconico",
    raza: "Dragón Grande",
    nivel: 12,
    pv: 260,
    ca: 21,
    velocidad: "40 pies, excavar 20 pies",
    stats: { fue: 30, des: 14, con: 28, int: 6, sab: 16, car: 12 },
    notas: [
      "Salvaciones: Fue +15, Des +7, Con +14, Sab +8",
      "Habilidades: Atletismo +15, Percepción +8, Supervivencia +8",
      "Percepción pasiva: 18",
      "Resistencia al daño: el tipo asociado a su aliento",
      "Inmune a asustado"
    ],
    habilidades: [
      { nombre: "Fuerza Monstruosa (Pasiva)", descripcion: "Cuenta como criatura Enorme para empujar, arrastrar, levantar o transportar; ventaja para resistir ser empujado, derribado o agarrado." },
      { nombre: "Cuerpo Blindado (Pasiva)", descripcion: "Al recibir daño de un ataque cuerpo a cuerpo, puede reducirlo en 10 puntos." },
      { nombre: "Sangre Dracónica (Pasiva)", descripcion: "Ventaja en salvaciones contra veneno, enfermedad y efectos que alteren su cuerpo." },
      { nombre: "Embestida Brutal (Pasiva)", descripcion: "Si se mueve al menos 20 pies en línea recta y golpea con Mordida, inflige 3d10 de daño adicional y el objetivo falla una salvación de Fuerza CD 23 o cae Derribado." },
      { nombre: "Multiataque (Acción)", descripcion: "Realiza cuatro ataques: una Mordida, dos Garras y una Cola." },
      { nombre: "Mordida (Acción)", descripcion: "+15 al ataque, alcance 15 pies. Daño: 3d12+10 perforante." },
      { nombre: "Garra (Acción)", descripcion: "+15 al ataque, alcance 10 pies. Daño: 2d10+10 cortante." },
      { nombre: "Cola (Acción)", descripcion: "+15 al ataque, alcance 20 pies. Daño: 3d10+10 contundente. El objetivo falla una salvación de Fuerza CD 23 o cae Derribado." },
      { nombre: "Aliento Dracónico (Recarga 5-6)", descripcion: "Cono de 45 pies. Salvación de Constitución CD 21: 10d10 de daño elemental (mitad si supera)." },
      { nombre: "Pisotón (Acción Especial)", descripcion: "Todas las criaturas a 15 pies hacen una salvación de Destreza CD 23: si fallan reciben 3d10+10 de daño contundente y caen Derribadas; si superan, solo mitad de daño." },
      { nombre: "Mordida Aplastante (Acción Especial)", descripcion: "Ataque de Mordida contra una criatura Derribada; si impacta, inflige 4d12+10 de daño perforante en lugar del daño normal." },
      { nombre: "Resistencia Muscular (Reacción)", descripcion: "Al recibir daño de un ataque, lo reduce en 25 puntos; si el ataque era cuerpo a cuerpo, el atacante recibe 2d10 de daño contundente." }
    ],
    estrategia: "No necesita alas para dominar: se lanza directamente contra sus enemigos, usa su enorme fuerza para derribarlos y permanece sobre ellos hasta matarlos. A diferencia del guiverno, no depende de la velocidad."
  },
  {
    id: "dragonante",
    nombre: "Dragonante",
    rol: "Guerrero Dracónico",
    tipo: "Draconico",
    raza: "Dragón Grande",
    nivel: 16,
    pv: 340,
    ca: 23,
    velocidad: "40 pies",
    stats: { fue: 28, des: 18, con: 28, int: 16, sab: 18, car: 20 },
    notas: [
      "Salvaciones: Fue +14, Des +9, Con +14, Int +8, Sab +9, Car +10",
      "Habilidades: Atletismo +14, Percepción +9, Intimidación +10, Supervivencia +9",
      "Percepción pasiva: 19",
      "Resistencia al daño: el tipo asociado a su aliento",
      "Inmune a asustado y encantado"
    ],
    habilidades: [
      { nombre: "Sangre Dracónica (Pasiva)", descripcion: "Ventaja en salvaciones contra veneno, enfermedad y efectos que alteren su cuerpo; resistencia al daño mágico elemental de su propia estirpe." },
      { nombre: "Disciplina Dracónica (Pasiva)", descripcion: "Suficiente inteligencia para tácticas coordinadas y usar herramientas; ventaja en iniciativa y no puede ser sorprendido mientras esté consciente." },
      { nombre: "Escamas Endurecidas (Pasiva)", descripcion: "Al recibir daño de un ataque, puede reducirlo en 10 puntos." },
      { nombre: "Ferocidad Dracónica (Pasiva)", descripcion: "Por debajo de la mitad de sus PV obtiene ventaja en todas sus tiradas de ataque y sus ataques infligen +5 de daño." },
      { nombre: "Corazón Elemental (Pasiva)", descripcion: "No necesita tirada de recarga para su aliento mientras esté por debajo de la mitad de sus PV." },
      { nombre: "Multiataque (Acción)", descripcion: "Realiza cuatro ataques: una Mordida, dos Garras y una Cola." },
      { nombre: "Mordida (Acción)", descripcion: "+14 al ataque, alcance 10 pies. Daño: 3d10+9 perforante + 2d8 elemental." },
      { nombre: "Garra (Acción)", descripcion: "+14 al ataque, alcance 10 pies. Daño: 2d8+9 cortante." },
      { nombre: "Cola (Acción)", descripcion: "+14 al ataque, alcance 15 pies. Daño: 3d10+9 contundente. El objetivo falla una salvación de Fuerza CD 22 o cae Derribado." },
      { nombre: "Aliento Dracónico (Recarga 5-6)", descripcion: "Cono de 60 pies. Salvación de Destreza CD 22: 12d10 de daño elemental (mitad si supera); por debajo de la mitad de sus PV inflige 16d10 en su lugar." },
      { nombre: "Embestida Dracónica (Acción Especial)", descripcion: "Se mueve hasta su velocidad en línea recta y ataca con Mordida; si impacta, inflige 4d10 de daño adicional y el objetivo falla una salvación de Fuerza CD 22 o cae Derribado." },
      { nombre: "Golpe de Escamas (Acción Especial)", descripcion: "Prueba enfrentada de Atletismo contra una criatura a 10 pies; si gana, ambas reciben 3d8 de daño contundente pero solo el objetivo cae Derribado." },
      { nombre: "Rugido de Guerra (Acción Especial)", descripcion: "Hasta tres aliados a 60 pies que lo escuchen pueden usar de inmediato su reacción para atacar." },
      { nombre: "Contraataque Dracónico (Reacción)", descripcion: "Cuando falla un ataque cuerpo a cuerpo contra él, realiza de inmediato un ataque de Garra." },
      { nombre: "Endurecer Escamas (Reacción)", descripcion: "Al recibir daño, lo reduce en 25 puntos; si venía de un ataque cuerpo a cuerpo, el atacante recibe 2d8 de daño elemental." },
      { nombre: "Acciones Legendarias (hasta 3 por ronda)", descripcion: "Movimiento (hasta la mitad de su velocidad sin provocar ataques de oportunidad), Garra, Cola, Rugido (2 acciones: salvación de Sabiduría CD 22 a 60 pies o queda asustado), Aliento (3 acciones: usa su Aliento Dracónico si está disponible)." },
      { nombre: "Segunda Fase — Ascensión Dracónica (Rasgo especial)", descripcion: "Al llegar a 0 PV no muere: recupera 150 PV, termina toda condición y entra en una fase mejorada (CA 25, +5 al daño, velocidad 50 pies, 4 acciones legendarias, regeneración 20 PV/turno). Núcleo Desatado acumula +1d8 elemental cada turno; el Aliento Primordial pasa a 18d10 en cono de 90 pies. Devastación (3 acciones legendarias) encadena Mordida y dos Garras con 2d8 elemental extra cada uno; Rugido del Heredero (4 acciones legendarias) somete a los enemigos a 90 pies a una salvación de Sabiduría CD 25 o sufren 6d10 de daño psíquico y quedan asustados 1 minuto." },
      { nombre: "Muerte", descripcion: "Al llegar de nuevo a 0 PV, su núcleo elemental colapsa definitivamente y su cuerpo queda inmóvil mientras las escamas se desprenden." }
    ],
    estrategia: "Lucha con disciplina y tácticas, no solo instinto: embiste, encadena Garra y Cola, y reserva su aliento para cuando pueda alcanzar a varios objetivos a la vez. Si cae, su Segunda Fase lo devuelve al combate todavía más agresivo."
  },
  {
    id: "dragon",
    nombre: "Dragón",
    rol: "Jefe Final",
    tipo: "Draconico",
    raza: "Dragón Gargantuesco",
    nivel: 20,
    pv: 1500,
    ca: 32,
    velocidad: "60 pies, vuelo 120 pies, excavar 40 pies",
    stats: { fue: 40, des: 28, con: 40, int: 30, sab: 32, car: 36 },
    notas: [
      "Salvaciones: Fue +27, Des +21, Con +27, Int +22, Sab +23, Car +25",
      "Habilidades: Percepción +23, Perspicacia +23, Atletismo +27, Intimidación +25",
      "Percepción pasiva: 33",
      "Resistencia legendaria: 5/día",
      "Inmune a asustado, encantado, paralizado, petrificado, envenenado, aturdido",
      "Resistencia al daño contundente, cortante y perforante de ataques no mágicos",
      "Inmune al daño elemental de su propio aliento"
    ],
    habilidades: [
      { nombre: "Resistencia Legendaria (Pasiva, 5/día)", descripcion: "Si falla una salvación, puede elegir superarla en su lugar." },
      { nombre: "Regeneración Dracónica (Pasiva)", descripcion: "Recupera 30 PV al inicio de cada turno; si recibió daño de al menos tres criaturas distintas en la ronda anterior, recupera 20 PV adicionales." },
      { nombre: "Instinto del Depredador (Pasiva)", descripcion: "Ventaja en iniciativa y no puede ser sorprendido; ventaja para evitar ser derribado, agarrado o desplazado contra su voluntad." },
      { nombre: "Voluntad Inquebrantable (Pasiva)", descripcion: "La primera vez que quedaría incapacitado, paralizado, aturdido o impedido de actuar en el combate, puede ignorar el efecto." },
      { nombre: "Presencia Aterradora (Acción)", descripcion: "Cada criatura elegida a 120 pies falla una salvación de Sabiduría CD 30 o queda asustada 1 minuto; quien la supere es inmune 24 horas." },
      { nombre: "Multiataque (Acción)", descripcion: "Realiza cinco ataques: una Mordida, dos Garras y dos ataques de Cola o Garra." },
      { nombre: "Mordida (Acción)", descripcion: "+27 al ataque, alcance 20 pies. Daño: 4d12+15 perforante + 4d10 elemental. El objetivo falla una salvación de Fuerza CD 30 o queda agarrado." },
      { nombre: "Garra (Acción)", descripcion: "+27 al ataque, alcance 15 pies. Daño: 4d8+15 cortante." },
      { nombre: "Cola (Acción)", descripcion: "+27 al ataque, alcance 30 pies. Daño: 4d10+15 contundente. El objetivo falla una salvación de Fuerza CD 30 o es desplazado 30 pies y cae Derribado." },
      { nombre: "Aliento del Dragón (Recarga 4-6)", descripcion: "Cono de 150 pies. Salvación de Destreza CD 30: 30d10 de daño elemental (mitad si supera). Recibirlo dos veces en el combate causa Saturación Elemental, que anula la resistencia a este daño." },
      { nombre: "Acciones Legendarias (hasta 5 por ronda)", descripcion: "Movimiento, Garra, Cola, Rugido (2 acciones: salvación de Sabiduría CD 30 a 120 pies o quedan asustadas y sin reacciones), Golpe de Alas (3 acciones: salvación de Destreza CD 30 a 40 pies, 15d10+15 de daño contundente y Derribo con desplazamiento de 30 pies; después puede volar la mitad de su velocidad)." },
      { nombre: "Desviar (Reacción)", descripcion: "Cuando una criatura visible lo ataca, obtiene +10 CA contra ese ataque." },
      { nombre: "Resistencia (Reacción)", descripcion: "Al recibir daño, puede reducirlo en 50 puntos." },
      { nombre: "Contraataque (Reacción)", descripcion: "Cuando una criatura a 30 pies falla un ataque cuerpo a cuerpo contra él, realiza de inmediato un ataque de Cola contra ella." },
      { nombre: "Segunda Fase — El Dragón Desatado (Rasgo especial)", descripcion: "Al llegar a 0 PV no muere: recupera 500 PV, termina toda condición y recupera de inmediato su Aliento del Dragón. CA sube a 35, velocidad de vuelo a 150 pies, ataques con +1 dado de daño, 6 acciones legendarias por ronda y Regeneración Dracónica a 50 PV. Furia del Dragón acumula +2 al daño por turno (máx. +20). Aliento Desatado pasa a 40d10 en cono de 180 pies. Devastación (3 acciones legendarias) encadena Mordida, Garra y Cola ignorando resistencias. Rugido del Fin (5 acciones legendarias) somete a los enemigos a 180 pies a una salvación de Sabiduría CD 35 o sufren 10d12 de daño psíquico y quedan aturdidos hasta el final de su siguiente turno." },
      { nombre: "Muerte", descripcion: "Al llegar de nuevo a 0 PV, muere definitivamente: su cuerpo colosal cae al suelo provocando un terremoto. Todas las criaturas a 60 pies fallan una salvación de Destreza CD 30 o reciben 10d10 de daño contundente y caen Derribadas." }
    ],
    estrategia: "El jefe final de la campaña. Abre con Presencia Aterradora y castiga a quien se acerque con Multiataque; reserva el Aliento del Dragón para golpear a varios objetivos a la vez y usa sus acciones legendarias entre turnos para no dejar respiro. Su Segunda Fase lo hace notablemente más letal, así que el grupo debe estar preparado para una pelea en dos actos."
  },
  {
    id: "voss",
    nombre: "Voss",
    rol: "Velocidad / Destreza / Hostigamiento",
    tipo: "Humanoide",
    raza: "Humana",
    nivel: 4,
    pv: 34,
    ca: 16,
    velocidad: "40 pies",
    stats: { fue: 8, des: 20, con: 12, int: 11, sab: 14, car: 14 },
    equipo: ["Estoque"],
    notas: [
      "Iniciativa: +5",
      "Salvaciones: Des +7",
      "Habilidades: Acrobacias +7, Engaño +4, Percepción +4, Sigilo +7",
      "Percepción pasiva: 14"
    ],
    habilidades: [
      { nombre: "Estoque veloz (Acción)", descripcion: "Ataque cuerpo a cuerpo, alcance 5 pies. +7 al ataque. Daño: 1d8+5 perforante. Si recorrió al menos 15 pies antes de atacar, inflige 1d6 de daño adicional." },
      { nombre: "Paso evasivo (Acción Adicional)", descripcion: "Puede Correr, Destrabarse o Esconderse." },
      { nombre: "Corte al pasar (Pasiva)", descripcion: "Una vez por turno, después de golpear a una criatura, puede moverse hasta 10 pies sin provocar ataques de oportunidad de ese objetivo." },
      { nombre: "Finta sonriente (Recarga 5-6)", descripcion: "Elige una criatura a 15 pies que pueda verla. El objetivo realiza una salvación de Sabiduría CD 14. Si falla, Voss tiene ventaja en su siguiente ataque contra ella y el objetivo no puede realizar reacciones hasta el comienzo de su próximo turno." },
      { nombre: "Desvío (Reacción)", descripcion: "Cuando recibe un ataque cuerpo a cuerpo que pueda ver, aumenta su CA en 3 contra ese ataque. Debe decidirlo antes de saber si el ataque impacta." }
    ],
    estrategia: "Hostiga y se reposiciona: nunca se queda al alcance de un solo enemigo por mucho tiempo. Rodea a Billy, golpea al objetivo que marcó Victor y se retira antes de que puedan responderle."
  },
  {
    id: "billy",
    nombre: "Billy",
    rol: "Constitución / Fuerza / Tanque",
    tipo: "Humanoide",
    raza: "Hombre bestia (Cabra)",
    nivel: 5,
    pv: 58,
    ca: 17,
    velocidad: "30 pies",
    stats: { fue: 20, des: 10, con: 20, int: 8, sab: 13, car: 9 },
    equipo: ["Hachón pesado"],
    notas: [
      "Iniciativa: +0",
      "Salvaciones: Fue +7, Con +7",
      "Habilidades: Atletismo +7, Intimidación +1, Percepción +3",
      "Percepción pasiva: 13"
    ],
    habilidades: [
      { nombre: "Hachón pesado (Acción)", descripcion: "Ataque cuerpo a cuerpo, alcance 5 pies. +7 al ataque. Daño: 1d12+5 cortante." },
      { nombre: "Cornada de embestida (Pasiva)", descripcion: "Si se mueve al menos 15 pies en línea recta antes de golpear con su hachón, el objetivo recibe 1d6 de daño perforante adicional y debe superar una salvación de Fuerza CD 15 o caer Derribado." },
      { nombre: "Golpe contra el suelo (Recarga 5-6)", descripcion: "Golpea el suelo. Todas las criaturas a su elección en un radio de 10 pies deben realizar una salvación de Destreza CD 15. Fallo: 2d6+3 de daño contundente y quedan Derribadas. Éxito: la mitad del daño y no caen." },
      { nombre: "Muro de carne (Pasiva, 1/ronda)", descripcion: "Los enemigos provocan un ataque de oportunidad de Billy incluso si se mueven usando la acción Destrabarse, siempre que intenten pasar junto a él para acercarse a uno de sus aliados." },
      { nombre: "Interponerse (Reacción)", descripcion: "Cuando un aliado a 5 pies recibe un ataque, Billy se convierte en el objetivo en su lugar." },
      { nombre: "Demasiado terco para caer (Rasgo único)", descripcion: "La primera vez que baja a 20 PV o menos, obtiene inmediatamente 10 PV temporales y no puede ser empujado ni derribado hasta el final de su siguiente turno." }
    ],
    estrategia: "Contiene al grupo: se coloca entre sus compañeros y el peligro, y derriba a cualquiera que intente atravesar su posición. Avanza primero y bloquea el acceso a Victor; si alguien alcanza a un aliado, usa Interponerse. Si el grupo se agrupa demasiado, es el momento de un Golpe contra el suelo."
  },
  {
    id: "victor",
    nombre: "Victor",
    rol: "Inteligencia / Carisma / Control",
    tipo: "Humanoide",
    raza: "Hombre bestia (Murciélago)",
    nivel: 4,
    pv: 31,
    ca: 14,
    velocidad: "30 pies",
    stats: { fue: 8, des: 16, con: 13, int: 20, sab: 12, car: 18 },
    equipo: [],
    notas: [
      "Iniciativa: +3",
      "Salvaciones: Int +7, Car +6",
      "Habilidades: Arcana +7, Engaño +6, Investigación +7, Persuasión +6"
    ],
    habilidades: [
      { nombre: "Aguja mental (Acción)", descripcion: "Ataque mágico a distancia, alcance 60 pies. +7 al ataque. Daño: 2d8+3 psíquico." },
      { nombre: "Exponer debilidad (Acción Adicional)", descripcion: "Marca a una criatura que pueda ver a 60 pies hasta el comienzo de su siguiente turno. La primera vez que un aliado de Victor golpee al objetivo marcado, el ataque inflige 1d6 de daño adicional." },
      { nombre: "Palabras paralizantes (Recarga 5-6)", descripcion: "Una criatura a 30 pies que pueda escucharlo realiza una salvación de Sabiduría CD 15. Si falla, recibe 2d6 de daño psíquico y queda Restringida por pensamientos intrusivos hasta el final de su siguiente turno. Puede repetir la salvación inmediatamente después de recibir daño, terminando el efecto si tiene éxito." },
      { nombre: "Orden humillante (1/combate)", descripcion: "Hasta dos criaturas a 30 pies deben superar una salvación de Sabiduría CD 15. Quien falle elige de inmediato: alejarse 15 pies de Victor sin provocar ataques de oportunidad, soltar un objeto que sostenga, o caer Derribada." },
      { nombre: "Ya lo había previsto (Reacción)", descripcion: "Cuando una criatura marcada por Exponer debilidad lo ataca, impone desventaja a esa tirada. Debe declarar la reacción antes de conocer el resultado." }
    ],
    estrategia: "Dirige el combate: marca al personaje más vulnerable o peligroso apenas empieza la pelea. Si el grupo intenta rodearlos, usa Orden humillante para romper su formación. Si alguien logra llegar hasta él, confía en que Billy use Interponerse antes de que eso pase."
  },
  {
    id: "torvrena",
    nombre: "Torvrena",
    rol: "Fuerza / Constitución / Captura",
    tipo: "Humanoide",
    raza: "Hombre bestia (Gato)",
    nivel: 4,
    pv: 48,
    ca: 16,
    velocidad: "30 pies",
    stats: { fue: 18, des: 12, con: 18, int: 11, sab: 16, car: 9 },
    equipo: ["Hachuela de carnicero", "Tres arpones encadenados", "Dos trampas de mandíbula", "Cuerda reforzada de 50 pies", "Herramientas para recolectar partes de monstruos", "Una poción de curación común", "Ungüento contra quemaduras", "Abrigo y equipo de escalada"],
    notas: [
      "Iniciativa: +1",
      "Salvaciones: Fue +6, Con +6",
      "Habilidades: Atletismo +6, Investigación +2, Naturaleza +2, Percepción +5, Supervivencia +5",
      "Percepción pasiva: 15"
    ],
    habilidades: [
      { nombre: "Hachuela de carnicero (Acción)", descripcion: "Ataque cuerpo a cuerpo, alcance 5 pies. +6 al ataque. Daño: 1d10+4 cortante. Contra una criatura Agarrada, Restringida o Derribada, inflige 1d6 de daño adicional." },
      { nombre: "Arpón encadenado (Acción)", descripcion: "Ataque a distancia, alcance 30/60 pies. +6 al ataque. Daño: 1d8+4 perforante. Una criatura Grande o menor golpeada queda enganchada: no puede alejarse a más de 30 pies de Torvrena, que puede arrastrarla 10 pies como acción adicional ganando una prueba enfrentada de Atletismo, y una criatura voladora debe superar una salvación de Fuerza CD 14 al empezar su turno o descender 20 pies. La criatura enganchada puede usar su acción para una prueba de Fuerza CD 14 y arrancarse el arpón. Torvrena solo lleva tres." },
      { nombre: "Trampa de mandíbula (Acción)", descripcion: "Instala una de sus dos trampas en un espacio a 5 pies. La primera criatura que entre debe superar una salvación de Destreza CD 14 o recibir 1d6+3 de daño perforante y quedar Restringida (puede detectarse con Percepción CD 13; liberarse con Fuerza CD 14)." },
      { nombre: "Estudiar a la presa (Acción Adicional)", descripcion: "Estudia a una criatura visible a 60 pies con una prueba de Supervivencia CD 10 + la mitad del nivel o VD de la criatura. Con éxito, el DM revela una resistencia/inmunidad, su ataque más peligroso, un rasgo de movimiento, una vulnerabilidad, o el estado aproximado de sus PV; además el próximo ataque de Torvrena contra ella tiene ventaja. Una vez por criatura por combate." },
      { nombre: "Aguantar el impacto (Reacción, 2/descanso corto)", descripcion: "Cuando recibe daño, lo reduce en 1d10+4." },
      { nombre: "Presa contra el suelo (Acción Adicional)", descripcion: "Cuando golpea cuerpo a cuerpo a una criatura Grande o menor enganchada por su arpón, intenta Derribarla con una prueba enfrentada de Atletismo. Si gana, la criatura cae Derribada y no puede levantarse hasta liberarse del arpón o superar Fuerza CD 14 al empezar su turno." },
      { nombre: "Rematar a la bestia (1/turno)", descripcion: "Cuando golpea a una criatura a la mitad de sus PV máximos o menos, añade 1d4 al daño (1d6 si es bestia, monstruosidad o dragón)." },
      { nombre: "Instinto de supervivencia (Pasiva)", descripcion: "Ventaja en salvaciones contra Asustado y en pruebas para rastrear bestias, monstruosidades y dragones. No puede ser sorprendido por criaturas cuyo rastro haya estado siguiendo." }
    ],
    estrategia: "«Todo monstruo tiene una parte blanda. El problema es sobrevivir hasta encontrarla.» No intenta superar a las bestias en velocidad: las inmoviliza con arpón y trampas, soporta su furia con Aguantar el impacto y espera el momento para rematarlas. No reemplaza a un miembro del grupo — su aporte es retener al objetivo, revelar información con Estudiar a la presa y crear oportunidades de ataque. Solo se compromete a entrar en la guarida si se le garantiza quedarse con una parte valiosa del cadáver."
  }
];
