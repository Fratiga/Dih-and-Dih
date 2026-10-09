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
      { nombre: "Cazador Solitario (Pasiva)", descripcion: "Mientras solo tenga un enemigo a 30 pies o menos: +2 CA, +10 pies de velocidad, +2d6 daño." },
      { nombre: "Arpón (Acción)", descripcion: "Alcance 60 pies. +10 al impacto. Daño: 2d8+5 perforante. El objetivo queda Enganchado." },
      { nombre: "Arrastre (Bonus)", descripcion: "Una criatura Enganchada es arrastrada hasta quedar adyacente. No requiere tirada." },
      { nombre: "Degüello (Acción)", descripcion: "Solo puede usarse sobre criaturas Enganchadas. +10 al impacto. Daño: 3d8+5 cortante. Si el objetivo está por debajo del 40% de su vida, debe superar una salvación de Constitución CD 18 o muere instantáneamente." },
      { nombre: "Paso entre Sombras (Bonus)", descripcion: "Se teletransporta hasta 30 pies entre zonas oscuras." },
      { nombre: "Bomba de Humo (Recarga 5-6)", descripcion: "Crea una nube de 20 pies. Obtiene Ocultamiento Total." },
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
      { nombre: "Disparo de Perdigones (Acción)", descripcion: "Ataque en cono de 15 pies. Daño: 2d8 + Fuerza. Todas las criaturas golpeadas superan una salvación de Fuerza CD 15 o son empujadas 10 pies." },
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
      { nombre: "Cartas Carmesí (Acción)", descripcion: "Selecciona un punto a 60 pies, radio 9 pies. Todas las criaturas en el área reciben 3d6 de daño de fuerza (mitad con salvación de Destreza)." },
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
      { nombre: "Defender Refugio (Pasiva)", descripcion: "Mientras permanezca a menos de 10 pies de un aldeano, obtiene +2 CA y los enemigos tienen desventaja para atacar a los civiles." },
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
      { nombre: "Arco Largo (Acción)", descripcion: "Alcance 150/600 pies. +5 al impacto. Daño: 1d8+3 perforante." },
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
    tipo: "Dracónico",
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
    nombre: "Restos espectrales",
    rol: "Infantería",
    tipo: "No-muerto",
    nivel: 3,
    pv: 32,
    ca: 14,
    velocidad: "30 pies",
    stats: { fue: 16, des: 8, con: 16, int: 2, sab: 6, car: 1 },
    habilidades: [
      { nombre: "Cuerpo Improvisado (Rasgo)", descripcion: "Al aparecer tira 1d4 para determinar su cuerpo, que modifica ligeramente sus estadísticas: Barro (+10 PV, -2 CA, reduce la velocidad del objetivo 10 pies al golpear), Raíces (+10 pies de alcance, puede inmovilizar), Piedra (+2 CA, vulnerable al daño contundente), o Madera (+10 pies de movimiento, vulnerable al fuego)." },
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
      { nombre: "Lamento (Recarga 5-6)", descripcion: "Todas las criaturas a 20 pies hacen una salvación de Sabiduría CD 12 o quedan con desventaja en su siguiente ataque." }
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
      { nombre: "Depredador Felino (Pasiva)", descripcion: "Conoce la dirección aproximada de cualquier felino en 1 milla; ventaja en ataques contra criaturas de tipo Felino." },
      { nombre: "Instinto Animal (Pasiva)", descripcion: "No provoca ataques de oportunidad al abandonar el alcance de criaturas inferiores a tamaño Grande." },
      { nombre: "Cazadora Incansable (Pasiva)", descripcion: "Mientras persiga a un objetivo felino, ignora terreno difícil, no puede ser asustada y su velocidad aumenta 10 pies." },
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
    tipo: "Dracónico",
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
    tipo: "Dracónico",
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
    tipo: "Dracónico",
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
    tipo: "Dracónico",
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
    tipo: "Dracónico",
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
    tipo: "Dracónico",
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
      { nombre: "Finta sonriente (Recarga 5-6)", descripcion: "Elige una criatura a 15 pies que pueda verla. El objetivo realiza una salvación de Sabiduría CD 15. Si falla, Voss tiene ventaja en su siguiente ataque contra ella y el objetivo no puede realizar reacciones hasta el comienzo de su próximo turno." },
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
      { nombre: "Hachón pesado (Acción)", descripcion: "Ataque cuerpo a cuerpo, alcance 5 pies. +8 al ataque. Daño: 1d12+5 cortante." },
      { nombre: "Cornada de embestida (Pasiva)", descripcion: "Si se mueve al menos 15 pies en línea recta antes de golpear con su hachón, el objetivo recibe 1d6 de daño perforante adicional y debe superar una salvación de Fuerza CD 16 o caer Derribado." },
      { nombre: "Golpe contra el suelo (Recarga 5-6)", descripcion: "Golpea el suelo. Todas las criaturas a su elección en un radio de 10 pies deben realizar una salvación de Destreza CD 16. Fallo: 2d6+3 de daño contundente y quedan Derribadas. Éxito: la mitad del daño y no caen." },
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
  },
  {
    id: "rojo-ultimo-apunte",
    personajeId: "rojo-ultimo-apunte",
    nombre: "Rojo",
    rol: "El Bocazas · Daño y liderazgo",
    tipo: "Humanoide",
    nivel: 4,
    pv: 42,
    ca: 15,
    velocidad: "30 pies",
    iniciativa: "+2",
    stats: { fue: 10, des: 14, con: 14, int: 16, sab: 10, car: 14 },
    notas: [
      "Encuentro difícil para seis personajes de nivel 4 (con los puntos de característica adicionales). Rasgos compartidos por Los Seis del Último Apunte: Competencia +2, CD de habilidades de conjuro 13, ataques mágicos +5.",
      "Cobardía organizada: mientras tenga a otro miembro consciente a 10 pies, +1 a la CA. Pierden el beneficio cuando quedan tres o menos con vida.",
      "Objetivo prioritario: siempre conocen la ubicación de Hooey mientras esté a 60 pies y no pueden ser engañados por ilusiones que imiten su aspecto. Intentan derribarlo, pero no rematarlo. Primero quieren abrirlo y recuperar lo que quede del maestro."
    ],
    habilidades: [
      { nombre: "Proyectil Carmesí (Ataque mágico)", descripcion: "A 60 pies: +5, daño 1d10 + 3 de fuego." },
      { nombre: "¡Todos contra ese idiota! (Recarga 5–6)", descripcion: "Elige una criatura a 60 pies. Hasta el comienzo del siguiente turno de Rojo, el primer ataque que cada uno de sus compañeros realice contra ella inflige 1d4 de daño adicional." },
      { nombre: "Salida espectacular (1/combate)", descripcion: "Rojo arroja una carga al suelo. Todas las criaturas a 10 pies hacen una salvación de Destreza CD 13. Fallo: 2d6 de fuego y son empujadas 10 pies. Éxito: mitad del daño y no son empujadas. Rojo puede desplazarse inmediatamente hasta 15 pies sin provocar ataques de oportunidad." }
    ],
    estrategia: "«¡Lo teníamos acorralado hasta que ustedes decidieron participar!» Señala a Hooey como objetivo prioritario y da órdenes evidentes que después finge que salieron según su plan."
  },
  {
    id: "verde-ultimo-apunte",
    personajeId: "verde-ultimo-apunte",
    nombre: "Verde",
    rol: "El Rastrero · Hostigador",
    tipo: "Humanoide",
    nivel: 4,
    pv: 34,
    ca: 16,
    velocidad: "35 pies",
    iniciativa: "+4",
    stats: { fue: 9, des: 18, con: 12, int: 14, sab: 13, car: 10 },
    notas: [
      "Rasgos compartidos por Los Seis del Último Apunte: Competencia +2, CD de habilidades de conjuro 13, ataques mágicos +5.",
      "Cobardía organizada: mientras tenga a otro miembro consciente a 10 pies, +1 a la CA. Pierden el beneficio cuando quedan tres o menos con vida.",
      "Objetivo prioritario: siempre conocen la ubicación de Hooey mientras esté a 60 pies y no pueden ser engañados por ilusiones que imiten su aspecto. Intentan derribarlo, pero no rematarlo. Primero quieren abrirlo y recuperar lo que quede del maestro."
    ],
    habilidades: [
      { nombre: "Cuchillada de Tiza (Ataque cuerpo a cuerpo)", descripcion: "+6, daño 1d6 + 4 cortante. Inflige 1d6 adicional si uno de sus aliados está a 5 pies del objetivo." },
      { nombre: "Paso por la Manga (Acción adicional)", descripcion: "Se teletransporta hasta 20 pies hacia un espacio junto a una criatura. Su siguiente ataque durante ese turno tiene ventaja." },
      { nombre: "Eso era importante, ¿no? (1/combate)", descripcion: "Una criatura a 5 pies hace una salvación de Destreza CD 14. Si falla, Verde le roba un foco, bolsa de componentes u objeto pequeño que lleve visible. La víctima no puede lanzar conjuros que requieran ese objeto hasta recuperarlo arrebatándoselo con una acción o derribando a Verde." }
    ],
    estrategia: "«¿Tu plan necesitaba esto? Qué mala suerte.» Se teletransporta detrás de los lanzadores de conjuros y roba sus focos apenas puede."
  },
  {
    id: "morado-ultimo-apunte",
    personajeId: "morado-ultimo-apunte",
    nombre: "Morado",
    rol: "El Aguafiestas · Control y contramagia",
    tipo: "Humanoide",
    nivel: 4,
    pv: 36,
    ca: 14,
    velocidad: "30 pies",
    iniciativa: "+2",
    stats: { fue: 8, des: 14, con: 14, int: 17, sab: 12, car: 13 },
    notas: [
      "Rasgos compartidos por Los Seis del Último Apunte: Competencia +2, CD de habilidades de conjuro 13, ataques mágicos +5.",
      "Cobardía organizada: mientras tenga a otro miembro consciente a 10 pies, +1 a la CA. Pierden el beneficio cuando quedan tres o menos con vida.",
      "Objetivo prioritario: siempre conocen la ubicación de Hooey mientras esté a 60 pies y no pueden ser engañados por ilusiones que imiten su aspecto. Intentan derribarlo, pero no rematarlo. Primero quieren abrirlo y recuperar lo que quede del maestro.",
      "Contramagia Callejera (Reacción, 3 usos compartidos entre Azul, Morado y Gris): cuando una criatura que puedan ver a 60 pies lance un conjuro, uno de ellos intenta arruinarlo con 1d20 + 5 contra 10 + nivel del conjuro. Éxito: el conjuro se pierde. Fracaso: el conjuro funciona y su lanzador obtiene ventaja en el siguiente ataque mágico que realice contra quien intentó contrarrestarlo."
    ],
    habilidades: [
      { nombre: "Cadena Violeta (Ataque mágico)", descripcion: "A 60 pies: +5, daño 1d8 + 3 psíquico y la velocidad del objetivo se reduce 10 pies hasta su siguiente turno." },
      { nombre: "Quédate ahí (Recarga 5–6)", descripcion: "Una criatura a 60 pies hace una salvación de Fuerza CD 13. Fallo: queda Restringida por cadenas mágicas, puede repetir la salvación al final de cada turno. Las cadenas también pueden destruirse: CA 13, 10 PV." },
      { nombre: "No, no, inténtalo otra vez (Reacción, 1/combate)", descripcion: "Después de que una criatura supere una salvación, Morado la obliga a repetirla. Debe aceptar el segundo resultado." }
    ],
    estrategia: "«Casi te sale. Lo cual, sinceramente, lo hace más gracioso.» Inmoviliza a quien esté protegiendo a Hooey."
  },
  {
    id: "amarillo-ultimo-apunte",
    personajeId: "amarillo-ultimo-apunte",
    nombre: "Amarillo",
    rol: "El Matón · Tanque y protección",
    tipo: "Humanoide",
    nivel: 4,
    pv: 52,
    ca: 17,
    velocidad: "30 pies",
    iniciativa: "+0",
    stats: { fue: 18, des: 10, con: 17, int: 10, sab: 12, car: 9 },
    notas: [
      "Rasgos compartidos por Los Seis del Último Apunte: Competencia +2, CD de habilidades de conjuro 13, ataques mágicos +5.",
      "Cobardía organizada: mientras tenga a otro miembro consciente a 10 pies, +1 a la CA. Pierden el beneficio cuando quedan tres o menos con vida.",
      "Objetivo prioritario: siempre conocen la ubicación de Hooey mientras esté a 60 pies y no pueden ser engañados por ilusiones que imiten su aspecto. Intentan derribarlo, pero no rematarlo. Primero quieren abrirlo y recuperar lo que quede del maestro."
    ],
    habilidades: [
      { nombre: "Bastonazo Académico (Ataque cuerpo a cuerpo)", descripcion: "+6, daño 1d10 + 4 contundente." },
      { nombre: "Aparta, intelectual (Acción adicional)", descripcion: "Después de golpear, el objetivo hace una salvación de Fuerza CD 14. Si falla, Amarillo lo empuja 10 pies o lo derriba." },
      { nombre: "Le pegabas a otro (Reacción)", descripcion: "Cuando un aliado a 5 pies sea golpeado, Amarillo intercambia posiciones con él y recibe el daño en su lugar. Después puede realizar un Bastonazo Académico contra el atacante." },
      { nombre: "Cabezazo (Recarga 6)", descripcion: "Ataque cuerpo a cuerpo: +6, daño 2d6 + 4. El objetivo no puede utilizar reacciones hasta el comienzo de su siguiente turno." }
    ],
    estrategia: "«No sé qué significa 'profano'. ¿Es un insulto? Porque te rompo la cara.» Bloquea el camino hacia Gris y Azul."
  },
  {
    id: "azul-ultimo-apunte",
    personajeId: "azul-ultimo-apunte",
    nombre: "Azul",
    rol: "El Tramposo · Contramagia y manipulación",
    tipo: "Humanoide",
    nivel: 4,
    pv: 35,
    ca: 15,
    velocidad: "30 pies",
    iniciativa: "+2",
    stats: { fue: 8, des: 14, con: 13, int: 18, sab: 12, car: 10 },
    notas: [
      "Rasgos compartidos por Los Seis del Último Apunte: Competencia +2, CD de habilidades de conjuro 13, ataques mágicos +5.",
      "Cobardía organizada: mientras tenga a otro miembro consciente a 10 pies, +1 a la CA. Pierden el beneficio cuando quedan tres o menos con vida.",
      "Objetivo prioritario: siempre conocen la ubicación de Hooey mientras esté a 60 pies y no pueden ser engañados por ilusiones que imiten su aspecto. Intentan derribarlo, pero no rematarlo. Primero quieren abrirlo y recuperar lo que quede del maestro.",
      "Contramagia Callejera (Reacción, 3 usos compartidos entre Azul, Morado y Gris): cuando una criatura que puedan ver a 60 pies lance un conjuro, uno de ellos intenta arruinarlo con 1d20 + 5 contra 10 + nivel del conjuro. Éxito: el conjuro se pierde. Fracaso: el conjuro funciona y su lanzador obtiene ventaja en el siguiente ataque mágico que realice contra quien intentó contrarrestarlo."
    ],
    habilidades: [
      { nombre: "Dardo Índigo (Ataque mágico)", descripcion: "A 60 pies: +6, daño 1d8 + 4 de fuerza." },
      { nombre: "Rebote Impertinente (Reacción, 1/combate)", descripcion: "Cuando sea objetivo de un ataque mágico que falle, puede redirigirlo contra otra criatura situada a 30 pies. Utiliza la tirada original contra la CA del nuevo objetivo." },
      { nombre: "Silencio Selectivo (Recarga 5–6)", descripcion: "Crea una esfera de 10 pies de radio a 60 pies que dura hasta el comienzo de su siguiente turno. Dentro de ella no pueden emplearse componentes verbales." }
    ],
    estrategia: "«¡No se escucha! ¡Habla más fuerte!» (Siempre grita esto desde fuera de su propio Silencio Selectivo.) Nunca ataca cuando puede interrumpir, estorbar o hacer que alguien se golpee solo, y guarda la contramagia para curaciones, huidas o conjuros de control."
  },
  {
    id: "gris-ultimo-apunte",
    personajeId: "gris-ultimo-apunte",
    nombre: "Gris",
    rol: "El Verdadero Discípulo · Apoyo y jefe secundario",
    tipo: "Humanoide",
    nivel: 4,
    pv: 46,
    ca: 14,
    velocidad: "30 pies",
    iniciativa: "+1",
    stats: { fue: 8, des: 12, con: 16, int: 18, sab: 15, car: 11 },
    notas: [
      "Rasgos compartidos por Los Seis del Último Apunte: Competencia +2, CD de habilidades de conjuro 13, ataques mágicos +5.",
      "Cobardía organizada: mientras tenga a otro miembro consciente a 10 pies, +1 a la CA. Pierden el beneficio cuando quedan tres o menos con vida.",
      "Objetivo prioritario: siempre conocen la ubicación de Hooey mientras esté a 60 pies y no pueden ser engañados por ilusiones que imiten su aspecto. Intentan derribarlo, pero no rematarlo. Primero quieren abrirlo y recuperar lo que quede del maestro.",
      "Contramagia Callejera (Reacción, 3 usos compartidos entre Azul, Morado y Gris): cuando una criatura que puedan ver a 60 pies lance un conjuro, uno de ellos intenta arruinarlo con 1d20 + 5 contra 10 + nivel del conjuro. Éxito: el conjuro se pierde. Fracaso: el conjuro funciona y su lanzador obtiene ventaja en el siguiente ataque mágico que realice contra quien intentó contrarrestarlo."
    ],
    habilidades: [
      { nombre: "Fragmento de Lección (Ataque mágico)", descripcion: "A 60 pies: +6, daño 2d6 + 4 psíquico." },
      { nombre: "Eso no fue lo que nos enseñó (Acción adicional)", descripcion: "Un aliado a 60 pies puede repetir inmediatamente una salvación que haya fallado o desplazarse hasta la mitad de su velocidad sin provocar ataques de oportunidad." },
      { nombre: "Corrección del Maestro (2/combate)", descripcion: "Cuando un aliado falle un ataque, Gris convierte el fallo en impacto. No puede utilizarse para convertir un ataque en crítico." },
      { nombre: "Examen Final (1/combate)", descripcion: "Hasta tres criaturas a 60 pies hacen una salvación de Inteligencia CD 14. Fallo: 2d6 psíquico y quedan Aturdidas hasta el final de su siguiente turno. Éxito: mitad del daño y no quedan Aturdidas. Cada objetivo puede obtener ventaja contestando rápidamente una pregunta sobre el maestro, su ropa o los conocimientos que Hooey devoró. Una respuesta convincente basta, aunque sea improvisada." }
    ],
    estrategia: "«Pueden burlarse de nosotros. Pueden llamarnos ladrones, vándalos o fracasados. Pero él nos enseñó a pensar. Y ahora mismo, una parte de él se pudre dentro de esa cosa.» El más experimentado y el único que entiende por completo el ritual del Ánima; su comportamiento ridículo desaparece cuando habla del maestro. Mantiene unido al grupo y usa Examen Final cuando puede alcanzar a al menos tres personajes. Cuando caen tres de los Seis, la fanfarronería del grupo desaparece: Gris ofrece detener la pelea si les permiten extraer del cuerpo de Hooey los restos del maestro mediante un procedimiento probablemente desagradable, pero no necesariamente mortal."
  },
  {
    id: "darian",
    personajeId: "darian",
    nombre: "Darian Veyr",
    rol: "Aliado poderoso / Destructor",
    tipo: "Humanoide",
    raza: "Humano",
    pv: 126,
    ca: 18,
    velocidad: "30 pies",
    stats: { fue: 20, des: 14, con: 19, int: 11, sab: 16, car: 12 },
    equipo: ["Desgarro (mandoble de costilla)", "Armadura de placas óseas"],
    notas: [
      "Salvaciones: FUE +8, CON +7, SAB +6. Habilidades: Atletismo +8, Percepción +6, Supervivencia +9. Resistencia: necrótico. Percepción pasiva 16.",
      "Ataque múltiple: dos ataques con Desgarro."
    ],
    habilidades: [
      { nombre: "Desgarro (Acción)", descripcion: "+8 al impacto, alcance 5 pies. Daño: 2d6+5 cortante, +1d6 contra criaturas de carne. Al reducir a una criatura a 0 PV, puede moverse hasta 10 pies y hacer un ataque adicional (uno por turno)." },
      { nombre: "Golpe Cauterizante (Recarga 5–6)", descripcion: "Ataque con Desgarro. Si impacta: 2d6+5 cortante más 3d6 de fuego. El objetivo no recupera PV hasta el final del siguiente turno de Darian y no deja Restos Palpitantes si muere." },
      { nombre: "Sujétalo, yo lo abro (Reacción, 3/descanso largo)", descripcion: "Cuando una criatura a 5 pies de Darian es golpeada por uno de los personajes, hace un ataque con Desgarro contra ella." },
      { nombre: "Demasiado Terco (Pasiva)", descripcion: "La primera vez que llega a 0 PV, cae a 1 PV y obtiene 20 PV temporales. Mientras los conserve, no puede retirarse voluntariamente de ningún enemigo." },
      { nombre: "Injerto del Dominio (Pasiva)", descripcion: "Dentro del dominio recupera 10 PV al inicio de cada uno de sus turnos si tiene menos de la mitad de sus PV, salvo que haya recibido daño de fuego o radiante desde el final de su turno anterior. Fuera del dominio su máximo de PV baja 10 por cada hora hasta que sus órganos sean reemplazados o se encuentre una cura." }
    ],
    estrategia: "Al principio cree que el grupo es una imitación del dominio y lanza un cuchillo contra la sombra de quien le hable. Para convencerlo hay que mostrarle un objeto posterior a su desaparición o contarle algo reciente que el dominio no pueda conocer. Una vez de su lado pelea en primera línea y pide que le sujeten a los enemigos para abrirlos con Desgarro. Si cae fuera del dominio, pide que tomen el cuaderno antes de curarlo."
  },
  {
    id: "coronel-tobi",
    personajeId: "coronel-tobi",
    nombre: "Coronel Tobi",
    rol: "Élite · Guardián de la puerta",
    tipo: "Humanoide",
    raza: "Humanoide mutante Grande · Caótico neutral",
    pv: 115,
    ca: 16,
    velocidad: "30 pies",
    stats: { fue: 22, des: 10, con: 20, int: 6, sab: 10, car: 8 },
    notas: [
      "Salvaciones: FUE +9, CON +8. Percepción pasiva 10. Competencia +3.",
      "Resistencias: daño contundente, perforante y cortante de ataques no mágicos. Inmunidad a estados: asustado.",
      "¡Alto, intrusos! (Pasiva): mientras custodia la puerta tiene ventaja en las pruebas para evitar ser empujado o derribado, y puede usar su reacción para impedir que una criatura que intente atravesar su espacio pase de largo.",
      "Cuerpo experimental (Pasiva): la primera vez que recibe daño en cada turno, lo reduce en 5.",
      "¡No me des órdenes! (Reacción): cuando una criatura lo contradice o se burla de su rango, se mueve hasta 10 pies hacia ella sin provocar ataques de oportunidad. Si queda a su alcance, puede hacer un ataque de puñetazo."
    ],
    habilidades: [
      { nombre: "Multiataque (Acción)", descripcion: "Realiza dos ataques de puñetazo." },
      { nombre: "Puñetazo (Acción)", descripcion: "+9 al impacto, alcance 5 pies, un objetivo. Daño: 15 (2d8+6) contundente." },
      { nombre: "¡A cubierto! (Recarga 5–6)", descripcion: "Se lanza contra un enemigo recorriendo hasta 20 pies en línea recta. Cada criatura en su trayectoria hace una salvación de Fuerza CD 16 o recibe 18 (3d8+5) contundente y cae derribada. Si el objetivo choca contra una pared, recibe 7 (2d6) adicional." },
      { nombre: "¡Fuego de artillería! (1/día)", descripcion: "Arranca un trozo de mobiliario, tubería o escombro y lo arroja a un punto a 40 pies. Las criaturas en un radio de 10 pies hacen una salvación de Destreza CD 16 o reciben 22 (4d10) contundente, o la mitad si tienen éxito." },
      { nombre: "¡La puerta no se toca! (Reacción)", descripcion: "Cuando una criatura a su alcance intenta abrir la puerta que custodia, hace un ataque de puñetazo contra ella. Si impacta, además la empuja 10 pies." }
    ],
    estrategia: "«¡Alto, intrusos!» Se planta frente a la puerta y no la abandona. Saluda a quien parezca un superior, exige credenciales y se enfurece con quien lo contradice o se burla de su rango. Guarda ¡Fuego de artillería! para grupos amontonados."
  },
  {
    id: "baltasar-sorel",
    personajeId: "baltasar-sorel",
    nombre: "Dr. Baltasar Sorel",
    rol: "Apoyo / Manipulación biológica",
    tipo: "Humanoide",
    pv: 75,
    ca: 16,
    velocidad: "30 pies",
    stats: { fue: 14, des: 18, con: 18, int: 20, sab: 16, car: 12 },
    equipo: ["Fusil de inoculación (experimental)"],
    habilidades: [
      { nombre: "Disparo contaminante (Acción)", descripcion: "+7 al impacto, alcance 80/240 pies. Daño: 14 (2d8+5) perforante. El objetivo hace una salvación de Constitución CD 15 o sufre 1d6 de veneno al inicio de su siguiente turno." },
      { nombre: "Dosis de supresión (Recarga 5–6)", descripcion: "Dispara una ampolla que estalla en un radio de 10 pies. Los afectados hacen una salvación de Constitución CD 15 o tienen desventaja en su siguiente tirada de ataque." },
      { nombre: "Cambio de cargador (Acción adicional)", descripcion: "Recarga su fusil. Si un aliado está a 10 pies, puede ordenarle como reacción que se mueva hasta la mitad de su velocidad." }
    ],
    estrategia: "«No dañen los instrumentos. Ya hemos perdido suficientes muestras esta semana.» Establece la zona de fuego detrás de una cobertura y dispara a quienes se mantienen a distancia o intentan acercarse, priorizando a los que parecen capaces de curar o apoyar. Si cae Elías, deja de mantener su posición y empieza a retroceder."
  },
  {
    id: "elias-morcant",
    personajeId: "elias-morcant",
    nombre: "Dr. Elías Morcant",
    rol: "Hostigador / Combate cuerpo a cuerpo",
    tipo: "Humanoide",
    pv: 58,
    ca: 14,
    velocidad: "30 pies",
    stats: { fue: 12, des: 16, con: 16, int: 20, sab: 14, car: 14 },
    equipo: ["Instrumental quirúrgico"],
    habilidades: [
      { nombre: "Bisturí (Acción)", descripcion: "+6 al impacto, alcance 5 pies. Daño: 10 (2d4+5) cortante." },
      { nombre: "Inyección paralizante (Recarga 5–6)", descripcion: "+6 al impacto, alcance 5 pies. Daño: 7 (1d4+5) perforante. El objetivo hace una salvación de Constitución CD 14 o queda con velocidad 0 hasta el final de su siguiente turno." },
      { nombre: "Sutura de emergencia (Acción, 2/día)", descripcion: "Restaura 18 PG a un aliado a 5 pies con una mezcla de tejido regenerativo. El objetivo también puede terminar una condición de envenenado." },
      { nombre: "Incisión exploratoria (Pasiva)", descripcion: "Si impacta con el bisturí a una criatura que haya recibido daño desde el comienzo de su último turno, inflige 5 (1d10) de daño adicional." }
    ],
    estrategia: "«¡Doctor, doctor! ¡Esta vez sí que está reaccionando como esperábamos!» Inmoviliza a los jugadores con sus inyecciones y aprovecha las aperturas para curar a Baltasar o a Nico. Intenta mantenerse cerca de sus compañeros, pero se acerca a los jugadores si ve la oportunidad de probar sus instrumentos. Si cae Baltasar, se pone nervioso."
  },
  {
    id: "nico",
    personajeId: "nico",
    nombre: "Nicolás «Nico»",
    rol: "Hostigador / Combate cuerpo a cuerpo",
    tipo: "Humanoide",
    pv: 48,
    ca: 15,
    velocidad: "35 pies",
    stats: { fue: 18, des: 18, con: 16, int: 12, sab: 12, car: 10 },
    equipo: ["Jeringa de presión (lanza, compuesto que altera la musculatura)"],
    habilidades: [
      { nombre: "Pinchazo (Acción)", descripcion: "+7 al impacto, alcance 5 pies. Daño: 12 (2d6+5) perforante." },
      { nombre: "Sobredosis (Recarga 5–6)", descripcion: "+7 al impacto, alcance 5 pies. Daño: 10 (1d10+5) perforante. El objetivo hace una salvación de Constitución CD 14 o tiene desventaja en las pruebas de Fuerza hasta el final de su siguiente turno." },
      { nombre: "¡A que no me atrapas! (Acción adicional)", descripcion: "Se desplaza hasta 15 pies sin provocar ataques de oportunidad de las criaturas a las que haya atacado este turno." },
      { nombre: "Pequeño ayudante (Reacción)", descripcion: "Cuando un aliado a 10 pies impacta a un enemigo, se mueve hasta 10 pies hacia ese enemigo, siempre que no atraviese espacios ocupados." }
    ],
    estrategia: "«¡Mírame! ¡Mírame! ¡Hoy hice tres pinchazos seguidos! ¿Viste, Baltasar?» Se concentra en un jugador debilitado y aprovecha su movilidad para entrar y salir del combate. Se ríe cuando consigue inyectar sus compuestos y busca constantemente la atención de Baltasar. Si cae Baltasar, se enfurece y ataca sin pensar."
  },
  {
    id: "restos-de-ledros-piedra",
    personajeId: "ledros",
    nombre: "Restos espectrales (Piedra)",
    rol: "Infantería",
    tipo: "No-muerto",
    nivel: 3,
    pv: 32,
    ca: 16,
    velocidad: "30 pies",
    stats: { fue: 16, des: 8, con: 16, int: 2, sab: 6, car: 1 },
    notas: [
      "Cuerpo de piedra: 2 de CA más que los restos comunes. Vulnerable al daño contundente."
    ],
    habilidades: [
      { nombre: "Cuerpo de Piedra (Pasiva)", descripcion: "Tiene 2 de CA más que los restos comunes. Es vulnerable al daño contundente." },
      { nombre: "Golpe Deforme (Acción)", descripcion: "+5 al impacto. Daño: 2d6+3 contundente." },
      { nombre: "Aferrarse (Acción adicional)", descripcion: "El objetivo hace una salvación de Fuerza CD 13 o queda Restringido." },
      { nombre: "Alma Inestable (Al morir)", descripcion: "Al morir explota: todas las criaturas a 5 pies reciben 1d6 de daño necrótico." }
    ],
    estrategia: "Avanza sin desviarse y aguanta casi todo. Los golpes pesados (mazas, martillos, empujones) son lo único que lo rompe rápido. Si sujeta a alguien, los demás lo rodean."
  },
  {
    id: "restos-de-ledros-madera",
    personajeId: "ledros",
    nombre: "Restos espectrales (Madera)",
    rol: "Infantería",
    tipo: "No-muerto",
    nivel: 3,
    pv: 32,
    ca: 14,
    velocidad: "40 pies",
    stats: { fue: 16, des: 8, con: 16, int: 2, sab: 6, car: 1 },
    notas: [
      "Cuerpo de madera: se mueve 10 pies más rápido que los restos comunes. Vulnerable al fuego."
    ],
    habilidades: [
      { nombre: "Cuerpo de Madera (Pasiva)", descripcion: "Se mueve 10 pies más rápido que los restos comunes. Es vulnerable al fuego." },
      { nombre: "Golpe Deforme (Acción)", descripcion: "+5 al impacto. Daño: 2d6+3 contundente." },
      { nombre: "Aferrarse (Acción adicional)", descripcion: "El objetivo hace una salvación de Fuerza CD 13 o queda Restringido." },
      { nombre: "Alma Inestable (Al morir)", descripcion: "Al morir explota: todas las criaturas a 5 pies reciben 1d6 de daño necrótico." }
    ],
    estrategia: "Es el más rápido: llega primero y sujeta al que quede más separado del grupo. El fuego lo destruye enseguida."
  },
  {
    id: "restos-de-ledros-barro",
    personajeId: "ledros",
    nombre: "Restos espectrales (Barro)",
    rol: "Infantería",
    tipo: "No-muerto",
    nivel: 3,
    pv: 42,
    ca: 12,
    velocidad: "30 pies",
    stats: { fue: 16, des: 8, con: 16, int: 2, sab: 6, car: 1 },
    notas: [
      "Cuerpo de barro: 10 PV más y 2 de CA menos que los restos comunes. Sus golpes ralentizan al objetivo."
    ],
    habilidades: [
      { nombre: "Cuerpo de Barro (Pasiva)", descripcion: "Tiene 10 PV más y 2 de CA menos que los restos comunes. Cada golpe que impacta reduce 10 pies la velocidad del objetivo hasta el final de su siguiente turno." },
      { nombre: "Golpe Deforme (Acción)", descripcion: "+5 al impacto. Daño: 2d6+3 contundente. La velocidad del objetivo baja 10 pies hasta el final de su siguiente turno." },
      { nombre: "Aferrarse (Acción adicional)", descripcion: "El objetivo hace una salvación de Fuerza CD 13 o queda Restringido." },
      { nombre: "Alma Inestable (Al morir)", descripcion: "Al morir explota: todas las criaturas a 5 pies reciben 1d6 de daño necrótico." }
    ],
    estrategia: "Se acerca a quien intenta huir y lo va frenando con cada golpe. Pega poco, pero deja a los blancos en el sitio para que los demás lleguen."
  },
  {
    id: "desollado",
    nombre: "El Desollado",
    rol: "Bruto · Hemorragia",
    tipo: "Monstruosidad",
    raza: "Mutante desollado Grande · Caótico malvado",
    nivel: 5,
    pv: 160,
    ca: 15,
    velocidad: "40 pies",
    stats: { fue: 20, des: 16, con: 18, int: 4, sab: 10, car: 5 },
    notas: [
      "Salvaciones: FUE +8, CON +7. Percepción pasiva 10. Competencia +3.",
      "Resistencia al daño necrótico. Inmunidad a estados: asustado.",
      "Sangrando: la criatura recibe 1d6 de daño necrótico al inicio de cada uno de sus turnos. Termina cuando alguien usa una acción para vendarla (Medicina CD 12) o cuando recupera PV."
    ],
    habilidades: [
      { nombre: "Frenesí de Sangre (Pasiva)", descripcion: "Ventaja en los ataques contra criaturas Sangrando o con la mitad de sus PV o menos. Mientras él tenga la mitad de sus PV o menos, sus Zarpazos infligen 1d6 de daño necrótico adicional." },
      { nombre: "Carne Resbaladiza (Pasiva)", descripcion: "Ventaja en pruebas y salvaciones para evitar o romper un agarre o una restricción. Los ataques de oportunidad contra él tienen desventaja." },
      { nombre: "Multiataque (Acción)", descripcion: "Realiza dos ataques de Zarpazo Desgarrado." },
      { nombre: "Zarpazo Desgarrado (Acción)", descripcion: "+8 al impacto, alcance 10 pies, un objetivo. Daño: 2d8+5 cortante. El objetivo hace una salvación de Constitución CD 16 o queda Sangrando." },
      { nombre: "Látigo de Tiras (Recarga 5-6)", descripcion: "Línea de 20 pies de largo y 5 de ancho. Cada criatura en ella hace una salvación de Destreza CD 16 o recibe 4d8 de daño cortante y queda Sangrando. Si supera la salvación, recibe la mitad y no sangra." },
      { nombre: "Chupar Sangre (Acción adicional)", descripcion: "Recupera 1d10+5 PV por cada criatura Sangrando a 10 pies o menos de él (máximo 3 criaturas)." }
    ],
    estrategia: "No distingue aliados de enemigos, pero huele la sangre: va primero por el más herido y se pega al que sangra. Usa el Látigo cuando hay tres o más en línea. Si nadie sangra, retrocede 20 pies y deja que el Látigo trabaje antes de cerrar distancia otra vez. Vendar a tiempo le quita la curación, y el fuego lo frena en seco."
  },
  {
    id: "acechador-descabezado",
    nombre: "Acechador Descabezado",
    rol: "Emboscador · Rastreador",
    tipo: "Monstruosidad",
    raza: "Cérvido mutado Grande · Neutral malvado",
    nivel: 5,
    pv: 150,
    ca: 16,
    velocidad: "60 pies",
    stats: { fue: 19, des: 16, con: 18, int: 7, sab: 16, car: 8 },
    notas: [
      "Salvaciones: DES +6, SAB +6. Habilidades: Sigilo +6, Percepción +6. Percepción pasiva 16. Competencia +3.",
      "Visión ciega 60 pies. No tiene cabeza ni ojos que cegar: inmune a cegado. Inmunidad a estados: hechizado.",
      "Debilidad: la luz brillante lo desorienta. Con luz brillante a 30 pies o menos, tiene desventaja en Sigilo y no puede usar Fundirse con la Espesura."
    ],
    habilidades: [
      { nombre: "Sentido del Rastro (Pasiva)", descripcion: "Ventaja en Percepción y Supervivencia para seguir a criaturas heridas o que hayan hablado en voz alta en la última hora." },
      { nombre: "Emboscada (Pasiva)", descripcion: "La primera vez que golpea a una criatura que no lo ha visto, o que está sorprendida, inflige 3d6 de daño adicional." },
      { nombre: "Fundirse con la Espesura (Acción adicional)", descripcion: "Se esconde, incluso si solo está en penumbra o tras un obstáculo que le dé cobertura." },
      { nombre: "Multiataque (Acción)", descripcion: "Realiza un ataque de Cornada y uno de Pisotón." },
      { nombre: "Cornada (Acción)", descripcion: "+7 al impacto, alcance 10 pies, un objetivo. Daño: 2d10+4 perforante." },
      { nombre: "Pisotón (Acción)", descripcion: "+7 al impacto, alcance 5 pies, un objetivo. Daño: 2d8+4 contundente. Tiene ventaja si el objetivo está Derribado." },
      { nombre: "Embestida de Cornamenta (Recarga 5-6)", descripcion: "Si se mueve al menos 20 pies en línea recta hacia un objetivo: +7 al impacto. Daño: 3d10+4 perforante. El objetivo hace una salvación de Fuerza CD 15 o cae Derribado." },
      { nombre: "Eco Robado (Acción)", descripcion: "Imita la voz de una criatura que haya oído. Una criatura a 60 pies que lo oiga hace una salvación de Sabiduría CD 14 o queda Hechizada hasta el final de su siguiente turno: usa su movimiento para acercarse a la voz por el camino más directo, sin meterse en peligros evidentes." },
      { nombre: "Lomo de Espinas (Reacción)", descripcion: "Cuando una criatura lo agarra o se sube a él, recibe 2d6 de daño perforante." }
    ],
    estrategia: "Huye de las luces y se queda quieto entre los árboles hasta que alguien se separa del grupo. Usa Eco Robado para sacar a uno del camino, lo embosca por la espalda y lo pisotea si cae. Si pierde la emboscada y baja de 60 PV, se esconde y vuelve a atacar desde otro ángulo. Mantener al grupo junto y llevar luz le quita casi todo."
  },
  {
    id: "mortaja-de-ojos",
    nombre: "La Mortaja de Ojos",
    rol: "Control · Terror psíquico",
    tipo: "Aberración",
    raza: "Aberración informe Grande · Caótico malvado",
    nivel: 5,
    pv: 142,
    ca: 15,
    velocidad: "30 pies, vuelo 30 pies (flota)",
    stats: { fue: 14, des: 12, con: 18, int: 12, sab: 14, car: 18 },
    notas: [
      "Salvaciones: SAB +5, CAR +7. Habilidades: Percepción +5. Percepción pasiva 15. Competencia +3.",
      "Resistencia al daño necrótico y psíquico, y al contundente, perforante y cortante de ataques no mágicos. Vulnerabilidad al daño radiante. Inmunidad a estados: asustado, cegado.",
      "Visión en la oscuridad 120 pies."
    ],
    habilidades: [
      { nombre: "Mil Ojos (Pasiva)", descripcion: "Ve a criaturas invisibles a 60 pies, no puede ser sorprendida y tiene ventaja en Percepción basada en la vista." },
      { nombre: "Cuerpo de Sombra (Pasiva)", descripcion: "Si empieza su turno en luz brillante recibe 1d8 de daño radiante, y mientras la luz le dé, no puede usar Pozo de Sombra." },
      { nombre: "Multiataque (Acción)", descripcion: "Realiza una Mordida Babosa y un Zarcillo de Sombra." },
      { nombre: "Mordida Babosa (Acción)", descripcion: "+7 al impacto, alcance 5 pies, un objetivo. Daño: 2d10+2 perforante. El objetivo recibe además 2d6 de daño necrótico." },
      { nombre: "Zarcillo de Sombra (Acción)", descripcion: "+7 al impacto, alcance 15 pies, un objetivo. Daño: 2d6+2 necrótico. El objetivo queda Agarrado (escapa con una prueba de Fuerza o Destreza CD 13). Solo puede agarrar a una criatura a la vez." },
      { nombre: "Mirada Múltiple (Recarga 5-6)", descripcion: "Todas las criaturas a 30 pies que puedan ver sus ojos hacen una salvación de Sabiduría CD 15 o reciben 4d8 de daño psíquico y quedan Asustadas hasta el final de su siguiente turno. Si superan la salvación, reciben la mitad. Una criatura que aparta la mirada tiene ventaja en la salvación, pero tiene desventaja en sus ataques contra la Mortaja hasta el inicio de su siguiente turno." },
      { nombre: "Pozo de Sombra (Acción adicional)", descripcion: "Apaga toda luz no mágica en un radio de 20 pies a su alrededor hasta el inicio de su siguiente turno. Las luces mágicas de nivel 2 o menor también se apagan." }
    ],
    estrategia: "Flota hacia quien más ruido hace. Abre con Mirada Múltiple en cuanto tres o más la ven, agarra con el Zarcillo al que intenta huir y lo acerca para morderlo. La luz brillante la hiere y la obliga a retroceder: si el grupo la tiene, se esconde en la oscuridad y espera. Es mala persiguiendo y peor en espacios abiertos y bien iluminados."
  },
  {
    id: "gigante-velludo",
    nombre: "Gigante Velludo",
    rol: "Bruto · Emboscador",
    tipo: "Gigante",
    raza: "Gigante Grande · Neutral",
    nivel: 5,
    pv: 200,
    ca: 15,
    velocidad: "40 pies",
    stats: { fue: 23, des: 10, con: 20, int: 6, sab: 12, car: 7 },
    notas: [
      "Salvaciones: FUE +9, CON +8. Percepción +4, pasiva 14. Competencia +3.",
      "Resistencia al daño de frío. Vulnerabilidad al daño de fuego.",
      "Ardiendo: recibe 1d6 de daño de fuego al inicio de cada uno de sus turnos hasta que use su acción para apagar el pelaje."
    ],
    habilidades: [
      { nombre: "Doble Mirada (Pasiva)", descripcion: "Tiene un ojo en la cabeza y otro en el pecho: no puede ser sorprendido y tiene ventaja en Percepción. Punto ciego: los ataques contra él desde su espalda tienen ventaja y ignoran Ojo del Pecho." },
      { nombre: "Pelaje Inflamable (Pasiva)", descripcion: "Al recibir daño de fuego queda Ardiendo (ver notas)." },
      { nombre: "Emboscada del Pilar (Pasiva)", descripcion: "Si empieza el combate oculto tras una columna o una cobertura que lo tape por completo, la primera vez que golpea a una criatura que no lo ve inflige 3d8 de daño contundente adicional." },
      { nombre: "Multiataque (Acción)", descripcion: "Realiza dos ataques de Puñetazo Aplastante." },
      { nombre: "Puñetazo Aplastante (Acción)", descripcion: "+9 al impacto, alcance 10 pies, un objetivo. Daño: 3d8+6 contundente." },
      { nombre: "Agarrón y Estrujar (Acción)", descripcion: "Un objetivo Grande o menor al que haya golpeado con Puñetazo Aplastante este turno hace una salvación de Fuerza CD 17 o queda Agarrado (escapa con una prueba de Fuerza o Acrobacias CD 17). Al inicio de cada turno suyo, la criatura Agarrada recibe 2d8+6 de daño contundente." },
      { nombre: "Lanzar Escombro (Acción)", descripcion: "+9 al impacto, alcance 40/80 pies, un objetivo. Daño: 3d10+6 contundente." },
      { nombre: "Ojo del Pecho (Reacción, 1/ronda)", descripcion: "Cuando una criatura lo ataca a distancia o lo apunta con un conjuro desde su frente, ese ataque o conjuro tiene desventaja. No funciona contra lo que venga desde su espalda." }
    ],
    estrategia: "Se queda tras una columna o un muro y espera a que alguien pase para salirle a golpes. Agarra al más frágil y lo exprime, y lanza escombros a los que se quedan lejos. Si pierde la cobertura, se pone de espaldas a la pared para que nadie le llegue por detrás. Rodearlo y el fuego lo derrumban."
  },
  {
    id: "segador-acorazado",
    nombre: "Segador Acorazado",
    rol: "Cazador · Carroñero blindado",
    tipo: "Monstruosidad",
    raza: "Artrópodo Grande · Sin alineamiento",
    nivel: 5,
    pv: 150,
    ca: 18,
    velocidad: "50 pies",
    stats: { fue: 20, des: 14, con: 18, int: 4, sab: 12, car: 4 },
    notas: [
      "Salvaciones: FUE +8, CON +7. Percepción +4, pasiva 14. Competencia +3.",
      "Resistencia al daño cortante y perforante de ataques no mágicos. Visión en la oscuridad 60 pies."
    ],
    habilidades: [
      { nombre: "Caparazón de Placas (Pasiva)", descripcion: "CA 18. Si recibe 20 o más de daño contundente de un solo ataque, una placa se rompe y su CA baja 2 (mínimo 12) hasta que use Devorar." },
      { nombre: "Carroñero (Pasiva)", descripcion: "Huele la sangre a 120 pies. Tiene ventaja en los ataques contra criaturas Derribadas, Restringidas o con la mitad de sus PV o menos." },
      { nombre: "Multiataque (Acción)", descripcion: "Realiza un ataque de Hoja de la Cabeza y uno de Garra de Tijera." },
      { nombre: "Hoja de la Cabeza (Acción)", descripcion: "+8 al impacto, alcance 10 pies, un objetivo. Daño: 2d10+5 cortante." },
      { nombre: "Garra de Tijera (Acción)", descripcion: "+8 al impacto, alcance 10 pies, un objetivo. Daño: 2d6+5 perforante. El objetivo queda Agarrado (escapa con una prueba de Fuerza o Acrobacias CD 16). Esa garra no puede atacar a otra criatura mientras sujeta a una." },
      { nombre: "Devorar (Acción adicional)", descripcion: "Contra una criatura que esté Agarrada por él: recibe 2d8+5 perforante y el Segador recupera 1d10+5 PV. Además repara todas las placas rotas." },
      { nombre: "Zancada Segadora (Recarga 5-6)", descripcion: "Se mueve hasta 30 pies en línea recta sin provocar ataques de oportunidad. Cada criatura en su camino hace una salvación de Destreza CD 16 o recibe 4d8 de daño cortante y cae Derribada. Si supera la salvación, recibe la mitad y no cae." }
    ],
    estrategia: "Corta el terreno en línea recta y no se detiene por nada. Agarra al primero que alcanza, lo devora y vuelve a repararse. Usa Zancada Segadora cuando hay dos o más alineados y remata a quien cae. Un golpe fuerte de arma contundente le rompe las placas y lo deja mucho más fácil de herir."
  },
  {
    id: "callador",
    nombre: "El Callador",
    rol: "Control · Silencio",
    tipo: "Humanoide",
    raza: "Inquisidor enmascarado · Legal malvado",
    nivel: 5,
    pv: 120,
    ca: 16,
    velocidad: "30 pies",
    stats: { fue: 10, des: 14, con: 16, int: 16, sab: 16, car: 18 },
    notas: [
      "Salvaciones: SAB +6, CAR +7. Habilidades: Percepción +6, Perspicacia +6. Percepción pasiva 16. Competencia +3.",
      "Inmunidad al daño de trueno y a los efectos que dependan del oído. Ventaja en salvaciones contra hechizado y asustado.",
      "Silenciada: la criatura no puede hablar ni lanzar conjuros con componente verbal.",
      "Máscara agrietada: si recibe un golpe crítico, o 25 o más de daño en un solo ataque, la máscara se parte y pierde Aura de Silencio y Tragar Conjuro hasta el final del combate."
    ],
    habilidades: [
      { nombre: "Aura de Silencio (Pasiva)", descripcion: "En un radio de 15 pies a su alrededor no hay sonido. Las criaturas dentro de esa zona no pueden lanzar conjuros con componente verbal y no oyen nada mientras estén dentro." },
      { nombre: "Multiataque (Acción)", descripcion: "Realiza dos ataques de Dedo en los Labios." },
      { nombre: "Dedo en los Labios (Acción)", descripcion: "+7 al impacto, alcance 30 pies, un objetivo. Daño: 3d8+4 psíquico. El objetivo queda Silenciada hasta el final de su siguiente turno." },
      { nombre: "Grito Tragado (Recarga 5-6)", descripcion: "Todas las criaturas a 20 pies que puedan oírlo hacen una salvación de Constitución CD 15 o reciben 5d8 de daño psíquico (mitad si superan). Las que fallan quedan Silenciadas y sordas hasta el final de su siguiente turno." },
      { nombre: "Tragar Conjuro (Reacción, 1/ronda)", descripcion: "Cuando una criatura a 30 pies o menos lanza un conjuro con componente verbal, la máscara se traga la palabra: hace una salvación de Carisma CD 15 o el conjuro falla y gasta el espacio de conjuro." },
      { nombre: "Paso Mudo (Acción adicional)", descripcion: "Se mueve hasta 20 pies sin hacer ruido ni provocar ataques de oportunidad." }
    ],
    estrategia: "Se mantiene a distancia y calla primero a quien lance conjuros o sane al grupo. Si hay varios sanadores o lanzadores juntos, abre con Grito Tragado. No tiene aguante: en cuerpo a cuerpo es frágil y Paso Mudo es su única salida. Un golpe fuerte en la máscara lo deja sin Aura ni Tragar Conjuro, así que conviene que el más pesado del grupo lo alcance rápido."
  },
  {
    id: "miron",
    nombre: "El Mirón",
    rol: "Acechador · Terror",
    tipo: "Monstruosidad",
    raza: "Aparición pálida · Caótico malvado",
    nivel: 5,
    pv: 125,
    ca: 16,
    velocidad: "40 pies",
    stats: { fue: 14, des: 18, con: 14, int: 8, sab: 14, car: 6 },
    notas: [
      "Salvaciones: DES +7, SAB +5. Habilidades: Sigilo +10, Percepción +5. Percepción pasiva 15. Competencia +3.",
      "Visión en la oscuridad 120 pies. Inmunidad a estados: asustado. Resistencia al daño necrótico y psíquico."
    ],
    habilidades: [
      { nombre: "Ojos Blancos (Pasiva)", descripcion: "La primera vez que una criatura lo ve en un combate, hace una salvación de Sabiduría CD 13 o queda Asustada hasta el final de su siguiente turno. Si supera la salvación, es inmune a esta ventaja durante 24 horas." },
      { nombre: "Quieto Bajo la Mirada (Pasiva)", descripcion: "Mientras al menos una criatura enemiga que no esté Cegada lo mire de frente a 60 pies o menos, su velocidad baja a 10 pies, no puede usar Aparecer a la Espalda y sus ataques tienen desventaja. Si al inicio de su turno nadie lo mira, se mueve el doble de su velocidad." },
      { nombre: "Cuerpo Elástico (Pasiva)", descripcion: "Puede pasar por espacios de 6 pulgadas de ancho sin comprimirse. Ventaja en pruebas de Sigilo." },
      { nombre: "Aparecer a la Espalda (Acción adicional)", descripcion: "Si ninguna criatura lo está mirando, se teletransporta hasta 40 pies a un espacio libre adyacente a una criatura que no lo vea." },
      { nombre: "Multiataque (Acción)", descripcion: "Realiza dos ataques de Zarpazo Largo." },
      { nombre: "Zarpazo Largo (Acción)", descripcion: "+7 al impacto, alcance 10 pies, un objetivo. Daño: 2d8+4 cortante. Si el objetivo no lo estaba mirando, inflige 2d6 de daño cortante adicional." },
      { nombre: "Sonrisa Rota (Recarga 5-6)", descripcion: "Una criatura a 30 pies que pueda verlo hace una salvación de Sabiduría CD 13 o recibe 4d8 de daño psíquico y queda Asustada y Restringida hasta el final de su siguiente turno (mitad del daño si supera la salvación, y no queda afectada)." },
      { nombre: "Descoyuntarse (Reacción)", descripcion: "Cuando es agarrado o restringido, se libera sin tirada y se mueve hasta 10 pies sin provocar ataques de oportunidad." }
    ],
    estrategia: "Se queda quieto a plena vista, medio escondido, y cuando alguien parpadea o se da vuelta aparece a la espalda del más débil. Mientras alguien lo mire se arrastra despacio y casi no ataca: lo peor que puede hacer un grupo es dejar de vigilarlo. Con alguien siempre atento y la formación pegada, es manejable. Sin eso, va picando de uno en uno."
  },
  {
    id: "colgado",
    nombre: "El Colgado",
    rol: "Bruto · Ejecutor",
    tipo: "Monstruosidad",
    raza: "Ejecutor mutante Grande · Caótico malvado",
    nivel: 5,
    pv: 180,
    ca: 16,
    velocidad: "30 pies",
    stats: { fue: 22, des: 10, con: 20, int: 5, sab: 10, car: 5 },
    notas: [
      "Salvaciones: FUE +9, CON +8. Percepción pasiva 10. Competencia +3.",
      "Visión ciega 30 pies (no tiene ojos: huele y oye). Inmunidad a estados: cegado, asustado.",
      "Cadena del gancho: CA 15, 20 PV. Si se destruye, el Colgado pierde Cadena del Gancho y Colgar al Intruso hasta el final del combate."
    ],
    habilidades: [
      { nombre: "Hombros de Roca (Pasiva)", descripcion: "Reduce en 3 el daño que recibe de ataques con arma. Ventaja en salvaciones contra ser derribado o empujado." },
      { nombre: "Olfato Ciego (Pasiva)", descripcion: "Visión ciega 30 pies. Ventaja en Percepción basada en el olfato o el oído." },
      { nombre: "Multiataque (Acción)", descripcion: "Realiza un ataque de Cadena del Gancho y uno de Puñetazo." },
      { nombre: "Cadena del Gancho (Acción)", descripcion: "+9 al impacto, alcance 15 pies, un objetivo. Daño: 2d10+6 perforante. El objetivo hace una salvación de Fuerza CD 17 o es arrastrado hasta 10 pies hacia él y queda Agarrado (escapa con una prueba de Fuerza o Acrobacias CD 17)." },
      { nombre: "Puñetazo (Acción)", descripcion: "+9 al impacto, alcance 5 pies, un objetivo. Daño: 3d8+6 contundente." },
      { nombre: "Lengua Colgante (Acción adicional)", descripcion: "Una criatura Agarrada por él hace una salvación de Constitución CD 17 o recibe 2d6 de daño necrótico y queda Envenenada hasta el final de su siguiente turno." },
      { nombre: "Colgar al Intruso (Recarga 5-6)", descripcion: "Una criatura Agarrada por él hace una salvación de Fuerza CD 17 o queda colgada del gancho: Restringida, a 5 pies del suelo, y recibe 3d10 de daño perforante. Al inicio de cada turno suyo recibe 1d10 perforante adicional. Se libera destruyendo la cadena o con una prueba de Fuerza CD 17." }
    ],
    estrategia: "Camina hacia el sonido más cercano y no se detiene. Engancha al que se separa, lo arrastra y lo cuelga; después sigue con el siguiente. No usa tácticas: pega fuerte y despacio. Cortar la cadena libera a la víctima y le quita sus mejores armas, y por la espalda no tiene ojos que lo adviertan."
  },
  {
    id: "reptil-indestructible",
    nombre: "Reptil Indestructible",
    rol: "Jefe · Adaptación",
    tipo: "Monstruosidad",
    raza: "Reptil colosal Enorme · Caótico malvado",
    nivel: 7,
    pv: 230,
    ca: 17,
    velocidad: "40 pies, nado 40 pies, excavar 20 pies (tierra y roca blanda)",
    stats: { fue: 23, des: 12, con: 24, int: 14, sab: 12, car: 10 },
    notas: [
      "Salvaciones: FUE +9, CON +10. Percepción pasiva 11. Competencia +3.",
      "Resistencia al daño ácido. Inmunidad al veneno. Inmunidad a estados: asustado, hechizado, envenenado.",
      "Entiende y habla Común. No se rinde, no negocia y no acepta tratos.",
      "Inspirado en el SCP-682, de la Fundación SCP (CC BY-SA 3.0)."
    ],
    habilidades: [
      { nombre: "Adaptación Implacable (Pasiva)", descripcion: "Cada vez que recibe daño de un tipo, obtiene resistencia a ese tipo hasta el final de su siguiente turno. Solo mantiene resistencia a dos tipos a la vez: al adaptarse a un tercero, pierde la más antigua. Si en una misma ronda recibe daño de tres o más tipos distintos, pierde todas sus resistencias adquiridas hasta el final de su siguiente turno." },
      { nombre: "Regeneración (Pasiva)", descripcion: "Recupera 15 PV al inicio de cada uno de sus turnos. Si desde su turno anterior recibió daño de fuego o ácido, no se regenera en ese turno." },
      { nombre: "Indestructible (Pasiva, 2/combate)", descripcion: "Cuando queda a 0 PV no muere: al final de la ronda se levanta con 80 PV y es inmune durante el resto del combate al tipo de daño que lo derribó. La tercera vez que queda a 0 PV, excava y huye. Si no puede excavar (suelo de piedra trabajada, metal o cemento), muere." },
      { nombre: "Odio Absoluto (Pasiva)", descripcion: "Tiene ventaja en los ataques contra criaturas que le hayan hecho daño desde su último turno, y siempre ataca primero a la que más PV le haya quitado." },
      { nombre: "Multiataque (Acción)", descripcion: "Realiza una Mordida y dos Garras." },
      { nombre: "Mordida (Acción)", descripcion: "+9 al impacto, alcance 10 pies, un objetivo. Daño: 3d10+6 perforante. Si el objetivo es Grande o menor, queda Agarrado (escapa con una prueba de Fuerza o Acrobacias CD 17). Mientras lo sujeta, la Mordida no puede atacar a otra criatura." },
      { nombre: "Garra (Acción)", descripcion: "+9 al impacto, alcance 10 pies, un objetivo. Daño: 2d6+6 cortante." },
      { nombre: "Saliva Ácida (Recarga 5-6)", descripcion: "Línea de 30 pies de largo y 5 de ancho. Cada criatura en ella hace una salvación de Destreza CD 17: 6d6 de daño ácido (mitad si supera). Las armas y armaduras no mágicas de quienes fallen se corroen: -1 al daño del arma o a la CA de la armadura hasta el siguiente descanso corto." }
    ],
    estrategia: "Odia todo lo vivo y no tiene miedo ni prisa. Se lanza contra quien más daño le ha hecho y se adapta: si insistes con un solo tipo de daño, deja de sentirlo. Cambia de tipo de daño cada turno, usa fuego o ácido para parar su regeneración y gasta sus dos resurrecciones antes de intentar matarlo de verdad. Para un grupo de nivel 5 es un jefe de supervivencia: salir vivos y cerrarle la puerta es una victoria válida."
  },
  {
    id: "perseguidor",
    nombre: "El Perseguidor",
    rol: "Bruto · Cazador implacable",
    tipo: "Monstruosidad",
    raza: "Cuerpo experimental Grande · Neutral malvado",
    nivel: 5,
    pv: 190,
    ca: 15,
    velocidad: "40 pies",
    stats: { fue: 22, des: 12, con: 22, int: 4, sab: 10, car: 5 },
    notas: [
      "Salvaciones: FUE +9, CON +9. Percepción pasiva 10. Competencia +3.",
      "Inmunidad a estados: asustado. Ignora el terreno difícil."
    ],
    habilidades: [
      { nombre: "Resistencia Implacable (Pasiva, 1/día)", descripcion: "Si el daño lo dejaría a 0 PV, se queda a 1 PV." },
      { nombre: "Persecución Obstinada (Reacción, 1/ronda)", descripcion: "Cuando una criatura que él pueda ver sale de su alcance, se mueve hasta la mitad de su velocidad hacia ella sin provocar ataques de oportunidad." },
      { nombre: "Multiataque (Acción)", descripcion: "Realiza un ataque de Puñetazo Demoledor y uno de Tentáculo." },
      { nombre: "Puñetazo Demoledor (Acción)", descripcion: "+9 al impacto, alcance 5 pies, un objetivo. Daño: 3d8+6 contundente." },
      { nombre: "Tentáculo (Acción)", descripcion: "+9 al impacto, alcance 15 pies, un objetivo. Daño: 2d8+6 contundente. El objetivo queda Agarrado (escapa con una prueba de Fuerza o Acrobacias CD 17). Solo puede sujetar a una criatura a la vez." },
      { nombre: "Arrastre de Carne (Acción adicional)", descripcion: "Atrae hasta 15 pies hacia él a una criatura Agarrada por su Tentáculo." },
      { nombre: "Marca del Cazador (Acción adicional)", descripcion: "Elige a una criatura que pueda ver. Mientras la persigue (hasta que ella muera, salga de su vista durante 1 minuto o se elija otra marca), su velocidad aumenta 10 pies y tiene ventaja en los ataques contra ella." }
    ],
    estrategia: "Elige a la criatura que más daño le ha hecho y la persigue sin tregua, ignorando a los demás salvo que se interpongan. La atrapa con el Tentáculo, la arrastra y la golpea. No negocia, no se asusta y apenas siente el dolor. Para pararlo hay que bloquear el paso o usar a un aliado como señuelo y cortarle el camino con terreno que no pueda atravesar."
  },
  {
    id: "nurse-harrow",
    nombre: "Nurse Harrow",
    rol: "Élite · Soporte hostil · Control",
    tipo: "Humanoide",
    raza: "Humanoide Mediana · Médica de campo",
    nivel: 5,
    pv: 95,
    ca: 15,
    velocidad: "30 pies",
    stats: { fue: 10, des: 16, con: 16, int: 18, sab: 16, car: 14 },
    equipo: ["Jeringa hipodérmica enorme", "Maletín de recuperación (con un ojo dentro)", "Instrumental quirúrgico"],
    notas: [
      "Salvaciones: CON +6, INT +7, SAB +6. Habilidades: Medicina +9 (pericia), Investigación +7, Percepción +6. Percepción pasiva 16. Competencia +3.",
      "Bonificador de ataque +7 y CD de sus habilidades 15 (Inteligencia).",
      "Tiene una acción y una acción adicional por turno. No usa dos veces en el mismo turno una habilidad con recarga.",
      "Concepto: enfermera de combate. Pelea con una jeringa enorme y un maletín con un ojo dentro. Cura a los suyos para que sigan en pie y a los demás les corta la curación."
    ],
    habilidades: [
      { nombre: "Yo sé lo que te conviene (Reacción)", descripcion: "Cuando un aliado a 30 pies o menos cae a 0 PV, Harrow puede estabilizarlo al instante: el aliado recupera 1 PV y obtiene 10 PV temporales. Una criatura solo se beneficia de este efecto una vez por descanso largo. Harrow no puede usarlo sobre sí misma." },
      { nombre: "Jeringa hipodérmica (Acción)", descripcion: "Ataque a distancia, alcance 60 pies. +7 al impacto. Daño: 2d8+3 perforante. El objetivo recibe 1d6 de daño necrótico adicional y hace una salvación de Constitución CD 15 o no puede recuperar PV hasta el inicio del siguiente turno de Harrow." },
      { nombre: "Jeringa curativa (Acción)", descripcion: "Dispara la jeringa contra un aliado a 60 pies: sin tirada de ataque, el aliado recupera 2d8+4 PV." },
      { nombre: "Maletín de recuperación (Acción adicional, Recarga 5-6)", descripcion: "El ojo del maletín se abre y absorbe la vitalidad de una criatura herida que Harrow pueda ver a 40 pies. El objetivo hace una salvación de Constitución CD 15 o recibe 3d8 de daño necrótico (mitad si supera). Harrow o un aliado a 30 pies de ella recupera PV iguales a la mitad del daño infligido. No funciona contra criaturas sin vida biológica." },
      { nombre: "Sanguijuelas de asistencia (Recarga 4-6)", descripcion: "Acción. Libera una nube de sanguijuelas en una esfera de 15 pies de radio centrada en un punto a 60 pies. Los enemigos en el área hacen una salvación de Destreza CD 15: si fallan, reciben 3d6 de daño necrótico y su velocidad se reduce a la mitad durante 1 turno; si superan, la mitad del daño y sin reducción. Elige hasta dos aliados dentro del área: cada uno recupera 2d8 PV. Las sanguijuelas los evitan a propósito." },
      { nombre: "Terror acechante (Acción adicional, 1/combate)", descripcion: "El maletín flota, sus cierres se abren y algo observa desde dentro. Durante 3 turnos: tiene velocidad de vuelo de 30 pies y flota; ventaja en pruebas de Medicina y en salvaciones de Constitución para mantener la concentración; una vez por turno, cuando daña a alguien con su jeringa, puede curar a un aliado a 30 pies (1d8+4 PV); los enemigos a 10 pies tienen desventaja en pruebas de Percepción basadas en la vista. Al terminar no puede volver a activarlo hasta un descanso largo." }
    ],
    estrategia: "Estricta y aterradora, pero convencida de que salva vidas. «No se mueva. Está empeorando su condición.» «Puede gritar si lo necesita. No afecta al procedimiento.» «¿Ve? Ya está mejorando. Debería darme las gracias.» «Usted no está autorizado para morir.» Abre disparando la jeringa al más peligroso del grupo para cortarle la recuperación. En mitad del combate usa las Sanguijuelas cuando varios enemigos se agrupan, y sostiene a los suyos. Cuando un aliado está a punto de caer, activa el Maletín para robar vitalidad y salvarlo. En la fase final usa Terror acechante para flotar sobre la primera línea y seguir tratando a sus aliados mientras ataca. Funciona mejor acompañada de dos o tres experimentadores débiles: sola aguanta, pero su peligro real es impedir que los jugadores terminen con sus compañeros. Con 4 jugadores de nivel 5 y atributos reforzados, empieza con estos PV y súmale o quítale según cuántos enemigos la acompañen."
  },
  {
    id: "ulis",
    personajeId: "ulis",
    nombre: "Ulis",
    rol: "Élite · Bruto · Cambiaformas",
    tipo: "Humanoide",
    raza: "Ajolote Pequeña / Grande · Cambiaformas",
    nivel: 5,
    pv: 126,
    ca: 16,
    velocidad: "30 pies",
    stats: { fue: 22, des: 16, con: 20, int: 10, sab: 12, car: 8 },
    notas: [
      "Salvaciones: FUE +9, CON +8. Habilidades: Percepción +4 (pasiva 14), Sigilo +6, Atletismo +9. Competencia +3. Anfibia: respira aire y agua y nada a 40 pies.",
      "Los atributos de arriba son los de su forma de monstruo. En forma de niña tiene FUE 10 (modificador +0) y es de tamaño Pequeño; en forma de monstruo es de tamaño Grande. Los PV, la CA y la regeneración son los mismos en las dos formas.",
      "Tiene una acción y una acción adicional por turno. Transformarse usa la acción adicional.",
      "Concepto: niña ajolote que se transforma a voluntad en un monstruo ajolote grande, sin desgaste aparente."
    ],
    habilidades: [
      { nombre: "Transformación (Acción adicional, a voluntad)", descripcion: "Cambia entre su forma de niña y su forma de monstruo ajolote. Puede hacerlo todas las veces que quiera, sin límite de usos y sin coste: no queda agotada, no pierde PV y no necesita descansar entre un cambio y otro. Conserva los PV que tenga al transformarse." },
      { nombre: "Regeneración de ajolote (Pasiva)", descripcion: "Al inicio de su turno recupera 5 PV si tiene al menos 1 PV. Si recibió daño de fuego o de ácido desde su último turno, no se regenera ese turno." },
      { nombre: "Escurridiza (Pasiva, forma de niña)", descripcion: "Es de tamaño Pequeño: puede atravesar el espacio de criaturas Medianas o mayores y no provoca ataques de oportunidad al moverse." },
      { nombre: "Arañazo (Acción, forma de niña)", descripcion: "+6 al impacto, alcance 5 pies, un objetivo. Daño: 2d6+3 cortante." },
      { nombre: "Piel resbaladiza (Reacción, forma de niña)", descripcion: "Cuando un ataque la impacta, reduce el daño que recibe en 1d10+5." },
      { nombre: "Multiataque (Acción, forma de monstruo)", descripcion: "Realiza un ataque de Mordisco y uno de Coletazo." },
      { nombre: "Mordisco (Acción, forma de monstruo)", descripcion: "+9 al impacto, alcance 10 pies, un objetivo. Daño: 3d8+6 perforante. Un objetivo Mediano o menor queda Agarrado (escapa con una prueba de Fuerza o Acrobacias CD 17). Mientras sujeta a una criatura no puede morder a otra." },
      { nombre: "Coletazo (Acción, forma de monstruo)", descripcion: "+9 al impacto, alcance 10 pies, un objetivo. Daño: 2d10+6 contundente. El objetivo hace una salvación de Fuerza CD 17 o cae Derribado." },
      { nombre: "Oleada viscosa (Acción, forma de monstruo, Recarga 5–6)", descripcion: "Vomita una oleada de agua y limo en un cono de 15 pies. Las criaturas en el área hacen una salvación de Destreza CD 16: si fallan, reciben 4d6 contundente y son empujados 10 pies; si superan, la mitad del daño y no se mueven." }
    ],
    estrategia: "Habla poco y casi siempre hace lo que Clef le manda. Empieza como niña, se cuela entre los enemigos sin provocar ataques de oportunidad y se transforma en cuanto está pegada al objetivo. Muerde y agarra al más peligroso, derriba con la cola a quien la rodea y usa la Oleada cuando hay varios en el cono. Si se está llevando mucho daño vuelve a ser niña para recortar el golpe con la Piel resbaladiza y se transforma otra vez en su turno, porque cambiar no le cuesta nada. Contra ella funcionan el fuego y el ácido: sin regeneración se queda sin su mejor defensa. Con 4 jugadores de nivel 5 y atributos reforzados, empieza con estos PV y súmale o quítale según cuántos enemigos la acompañen."
  }
];
