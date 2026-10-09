/* =============================================================================
   CARTAS MALDITAS — catálogo. Cada carta apunta a una entrada del compendio
   (fuente) y de ahí saca su descripción, para que el lore viva en un solo
   sitio. La rareza es la dificultad de conseguirla, no su fuerza.

   Este archivo es solo el punto de partida. Lo que el Admin y los editores
   cambian desde el editor del álbum se guarda en el servidor
   (scratchpad/cartas_editor.sql) y reemplaza a esta lista carta por carta, y
   las cartas nuevas se crean allí. El servidor tiene además su propia copia
   mínima (id, rareza, lado, obtenible, limite): scratchpad/cartas.sql la
   siembra desde aquí, solo con las cartas que todavía no existen.

   lado: null = la ven todos; ["A"], ["B"] o ["A","B"] igual que en las
   entradas (un jugador no ve ni recibe cartas del lado contrario).
   obtenible: false = solo por regalo del admin.
   limite: copias numeradas que pueden existir (solo cartas limitadas).
============================================================================= */
window.CARTAS_RAREZAS = {
  comun: { nombre: "Común", orden: 1 },
  infrecuente: { nombre: "Infrecuente", orden: 2 },
  rara: { nombre: "Rara", orden: 3 },
  legendaria: { nombre: "Legendaria", orden: 4 },
  limitada: { nombre: "Limitada", orden: 5 }
};

window.CARTAS_TIPOS = ["Personaje", "Criatura", "Entidad", "Objeto", "Acción", "Terreno", "Reacción"];
// Tipos que llevan ataque y vida
window.CARTAS_TIPOS_UNIDAD = ["Personaje", "Criatura", "Entidad"];

window.CARTAS_AFINIDADES = {
  juramento: { nombre: "Juramento", descripcion: "Defensa, protección, curación y represalias." },
  sombra: { nombre: "Sombra", descripcion: "Engaño, evasión, venenos y ataques sorpresa." },
  carne: { nombre: "Carne", descripcion: "Regeneración, mutaciones, sacrificios y adaptación." },
  arcano: { nombre: "Arcano", descripcion: "Manipulación de energía, efectos y control del campo." },
  eternidad: { nombre: "Eternidad", descripcion: "Resurrección, inmortalidad, desgaste y persistencia." },
  caceria: { nombre: "Cacería", descripcion: "Daño dirigido, trampas, preparación y eliminación de objetivos." }
};

(function () {
  const lista = [];
  /* u = unidad (personaje o criatura): coste, ataque, vida. o = objeto/entidad: sin ataque ni vida. */
  const u = (id, nombre, tipo, fuente, rareza, afinidad, coste, atq, pv, habilidad, extra) => lista.push(Object.assign({
    id, nombre, tipo, fuente, rareza, afinidad: [].concat(afinidad), coste, atq, pv, habilidad,
    lado: null, obtenible: true, limite: null
  }, extra || {}));
  const o = (id, nombre, tipo, fuente, rareza, afinidad, coste, habilidad, extra) => u(id, nombre, tipo, fuente, rareza, afinidad, coste, null, null, habilidad, extra);
  const P = id => ({ data: "PERSONAJES", id });
  const B = id => ({ data: "BESTIARIO", id });
  const O = id => ({ data: "OBJETOS", id });
  const L = id => ({ data: "LUGARES", id });
  const A = { lado: ["A"] };
  const AB = { lado: ["A", "B"] };
  const Bl = { lado: ["B"] };
  const Be = epiteto => ({ lado: ["B"], epiteto });   // Lado B con epíteto

  // --- Personajes -----------------------------------------------------------
  u("rook", "Rook", "Personaje", P("rook"), "rara", "caceria", 4, 5, 4, "Cazador solitario: +2 de ataque mientras sea tu única unidad en el campo.", A);
  u("bull", "Bull", "Personaje", P("bull"), "comun", "juramento", 3, 3, 4, "Provocar: los desafíos enemigos deben apuntar a esta unidad antes que a otras.", AB);
  u("garra", "Garra", "Personaje", P("garra"), "comun", "caceria", 2, 3, 2, "Desafiante: al atacar, elige qué unidad enemiga debe bloquearla, aunque vuele. Arpón: al entrar, una unidad enemiga pierde Provocar y Volar hasta el final del próximo turno de su dueño.", AB);
  u("baraja", "Baraja", "Personaje", P("baraja"), "infrecuente", "arcano", 3, 2, 3, "Cartas del destino: al entrar, roba una carta.", AB);
  u("ocevat", "Ocevat", "Personaje", P("ocevat"), "rara", "juramento", 5, 4, 6, "Defensor del refugio: una vez por turno, recibe en lugar de una unidad aliada el daño que esta fuera a recibir.", AB);
  u("verdam", "Verdam", "Personaje", P("verdam"), "legendaria", "caceria", 7, 7, 6, "Desafiante. Marca de la presa: al entrar, marca a una unidad enemiga. Es Vulnerable para tus unidades (cualquiera puede obligarla a bloquear, ignorando Provocar) y le hacen 2 de daño extra en combate.", AB);
  u("eklino-a", "Eklino", "Personaje", P("eklino-a"), "comun", "juramento", 2, 1, 5, "Provocar: los desafíos enemigos deben apuntar a esta unidad antes que a otras. Defender el refugio: las demás unidades aliadas ganan +1 de vida al entrar.", A);
  u("dagren", "Dagren", "Personaje", P("dagren"), "infrecuente", "carne", 4, 4, 5, "Furia de veterano: gana +1 de ataque cada vez que recibe daño.", A);
  u("orina", "Orina", "Personaje", P("orina"), "infrecuente", "juramento", 1, 1, 1, "Proyectil: al morir, inflige 3 de daño a una unidad enemiga.", A);
  u("edge", "Edge", "Personaje", P("edge"), "comun", "sombra", 3, 3, 2, "Ataque furtivo: +2 de daño contra una unidad que ya recibió daño este turno.", A);
  u("hornet", "Hornet", "Personaje", P("hornet"), "comun", "caceria", 3, 3, 3, "Disparo certero: al entrar, inflige 1 de daño a una unidad enemiga.", A);
  u("sir-buffolet", "Sir Buffolet", "Personaje", P("sir-buffolet"), "infrecuente", "arcano", 2, 2, 2, "Mal bardo: al entrar, cada jugador descarta una carta al azar.", A);
  u("enzo", "Enzo", "Personaje", P("enzo"), "infrecuente", "carne", 4, 2, 3, "Veloz: en combate golpea antes que su rival; si lo mata, no recibe daño.", A);
  u("mattei", "Mattei", "Personaje", P("mattei"), "comun", "sombra", 1, 1, 2, "Escurridizo: hasta el final del próximo turno del rival, los desafíos y las habilidades enemigas no pueden elegirlo.", A);
  u("adam-kovacs", "Adam Kovacs", "Personaje", P("adam-kovacs"), "rara", "juramento", 6, 4, 6, "Capitán: tus demás unidades tienen +1 de ataque.", Bl);
  u("cassius-coldgrave", "Cassius Coldgrave", "Personaje", P("cassius-coldgrave"), "infrecuente", "caceria", 3, 2, 3, "Cobarde: no puede bloquear. Escurridizo: mientras controles otra unidad, los desafíos y las habilidades enemigas no pueden elegirlo.", Bl);
  u("torvrena", "Torvrena", "Personaje", P("torvrena"), "infrecuente", "caceria", 4, 4, 4, "Trampa de mandíbula: al entrar, una unidad enemiga no puede atacar el próximo turno.", Bl);
  u("ryn", "Ryn", "Personaje", P("ryn"), "rara", "arcano", 3, 2, 3, "Canción de bardo: al entrar, una unidad aliada gana +2/+2 este turno.", Bl);
  u("hooey-magoo", "Hooey Magoo", "Personaje", P("hooey-magoo"), "rara", "carne", 3, 4, 3, "Sacrificado: al morir, roba una carta.", Bl);

  // La banda de Cassius: los tres que atacaron a los protagonistas en Kigan
  u("billy", "Billy", "Personaje", P("billy"), "comun", "juramento", 3, 2, 6, "Muro de carne. Provocar: los desafíos enemigos deben apuntar a esta unidad antes que a otras.", Bl);
  u("voss", "Voss", "Personaje", P("voss"), "infrecuente", "sombra", 2, 3, 2, "Veloz: en combate golpea antes que su rival; si lo mata, no recibe daño. Corte al pasar: cuando golpea al jugador, este descarta una carta al azar.", Bl);
  u("victor", "Victor", "Personaje", P("victor"), "infrecuente", "arcano", 4, 2, 4, "Exponer debilidad: al entrar, marca a una unidad enemiga hasta el final de tu próximo turno. Es Vulnerable para tus unidades (cualquiera puede obligarla a bloquear, ignorando Provocar) y le hacen 2 de daño extra en combate.", Bl);

  // Los Seis del Último Apunte
  u("amarillo-ultimo-apunte", "Amarillo", "Personaje", P("amarillo-ultimo-apunte"), "infrecuente", "juramento", 3, 2, 5, "Duro: recibe 1 menos de daño. Le pegabas a otro: la primera vez que una unidad aliada fuera a recibir daño, lo recibe él en su lugar.", Be("El Matón"));
  u("azul-ultimo-apunte", "Azul", "Personaje", P("azul-ultimo-apunte"), "comun", "sombra", 3, 2, 3, "Interrumpir: al entrar, una unidad enemiga no puede bloquear este turno.", Be("El Tramposo"));
  u("verde-ultimo-apunte", "Verde", "Personaje", P("verde-ultimo-apunte"), "comun", "sombra", 2, 2, 2, "Eso era importante, ¿no?: cuando golpea al jugador, roba una carta.", Be("El Rastrero"));
  u("morado-ultimo-apunte", "Morado", "Personaje", P("morado-ultimo-apunte"), "infrecuente", "arcano", 4, 3, 3, "Quédate ahí: al entrar, una unidad enemiga ni ataca ni bloquea hasta el final de su próximo turno.", Be("El Aguafiestas"));
  u("gris-ultimo-apunte", "Gris", "Personaje", P("gris-ultimo-apunte"), "rara", "arcano", 3, 1, 4, "Corrección del Maestro: tus demás unidades tienen +1 de ataque.", Be("El Verdadero Discípulo"));
  u("rojo-ultimo-apunte", "Rojo", "Personaje", P("rojo-ultimo-apunte"), "rara", "arcano", 5, 4, 4, "Desafiante: al atacar, elige qué unidad enemiga debe bloquearla, aunque vuele. ¡Todos contra ese idiota!: al entrar, tus demás unidades del Último Apunte ganan +1/+1.", Be("El Bocazas"));

  // El laboratorio de Dexter
  u("darian", "Darian Veyr", "Personaje", P("darian"), "rara", "carne", 4, 3, 4, "Barrera: ignora el primer daño que reciba. Duro: recibe 1 menos de daño. Injerto del Dominio: mientras La Cueva de Carne esté en juego, duplica su ataque y su vida.", Be("El Indigerible"));
  u("coronel-tobi", "Coronel Tobi", "Personaje", P("coronel-tobi"), "rara", "carne", 5, 4, 5, "La puerta no se toca. Provocar: los desafíos enemigos deben apuntar a esta unidad antes que a otras. Arrollar: el daño que sobra al matar a su bloqueador pasa al jugador.", Be("El Soldadito"));
  u("elias-morcant", "Elías Morcant", "Personaje", P("elias-morcant"), "infrecuente", "carne", 3, 2, 3, "Sutura de emergencia: al entrar, cura 3 de vida a una unidad aliada (5 si es de Carne). Incisión exploratoria: +2 de daño contra una unidad que ya recibió daño este turno.", Be("El joven"));
  u("baltasar-sorel", "Baltasar Sorel", "Personaje", P("baltasar-sorel"), "infrecuente", "sombra", 4, 3, 3, "Disparo contaminante: al entrar, inflige 2 de daño a una unidad enemiga.", Be("El veterano"));
  u("nico", "Nico", "Personaje", P("nico"), "comun", "sombra", 2, 2, 2, "¡A que no me atrapas!. Esquivo: en combate recibe la mitad del daño (redondeado hacia abajo).", Be("El pequeño"));

  // Personajes de la cronología que faltaban. Sus fichas del compendio son del Lado B; Gareth sale en las dos cronologías.
  u("gareth", "Gareth", "Personaje", { data: null, id: null }, "infrecuente", "juramento", 4, 3, 5, "Duro: recibe 1 menos de daño. Echar a la calle: al entrar, devuelve a la mano de su dueño a una unidad enemiga con coste 3 o menos.", { lado: ["A", "B"], epiteto: "El tabernero", descripcion: "Semigigante dueño de La Taberna del Gigante. Fuerte y de mal humor. La taberna sigue en pie después del ataque del dragón." });
  u("sigismund", "Sigismund", "Personaje", P("sigismund"), "infrecuente", "juramento", 4, 3, 5, "Duro: recibe 1 menos de daño. Balista de asedio: al entrar, inflige 2 de daño a una unidad enemiga (4 si vuela).", Be("El paladín"));
  u("isa", "Isa", "Personaje", P("isa"), "infrecuente", "sombra", 3, 2, 3, "Irresistible: al entrar, una unidad enemiga no puede atacar el próximo turno.", Be("El apuesto"));
  u("sett", "Sett", "Personaje", P("sett"), "comun", "carne", 3, 3, 2, "Arrollar: el daño que sobra al matar a su bloqueador pasa al jugador.", Be("El fornido"));
  u("vieja-de-la-espesura", "La Vieja de la Espesura", "Personaje", P("vieja-espesura"), "infrecuente", "eternidad", 3, 1, 4, "Consejo de la ermitaña: al entrar, roba una carta.", Be("La ermitaña"));
  u("clef", "Clef", "Personaje", P("clef"), "infrecuente", "arcano", 3, 1, 3, "Orden: al entrar, una unidad aliada gana +2 de ataque hasta el final de tu próximo turno.", Be("La científica"));
  u("ulis", "Ulis", "Personaje", P("ulis"), "infrecuente", "carne", 2, 2, 2, "Ajolote: al inicio de tu turno recupera 1 de vida.", Be("La ajolote"));
  u("enfermera-harrow", "Enfermera Harrow", "Personaje", { data: null, id: null }, "rara", "carne", 5, 2, 5, "Jeringa: al entrar, elige una unidad: si es aliada, cura 3 de vida; si es enemiga, recibe 2 de daño y no puede curarse hasta el final del próximo turno de su dueño. Yo sé lo que te conviene: una vez por partida, cuando una unidad aliada fuera a morir, se queda con 1 de vida.", { lado: ["B"], epiteto: "La enfermera", descripcion: "Enfermera de combate. Pelea con una jeringa enorme y un maletín con un ojo dentro: cura a los suyos y a los demás les corta la curación." });

  // --- Criaturas ------------------------------------------------------------
  u("kobold", "Kobold", "Criatura", B("kobold"), "comun", "carne", 1, 1, 1, "Instinto de manada: +1 de ataque por cada otro Kobold en el campo.");
  u("manta-del-cielo", "Aeromanta", "Criatura", B("manta-del-cielo"), "comun", "arcano", 2, 1, 3, "Volar: solo puede ser bloqueada por unidades que también vuelan.");
  u("lobo", "Lobo", "Criatura", B("lobo"), "comun", "caceria", 2, 2, 2, "Cazador: +1 de ataque contra unidades que ya tengan daño.");
  u("cuervo-del-augurio", "Cuervo del augurio", "Criatura", B("cuervo-del-augurio"), "comun", "eternidad", 1, 1, 1, "Augurio: al entrar, mira la carta superior de tu mazo.");
  u("guiverno", "Guiverno", "Criatura", B("guiverno"), "rara", "caceria", 5, 5, 4, "Volar: solo puede ser bloqueado por unidades que también vuelan. Depredador del cielo: +1 de ataque contra unidades terrestres.");
  u("hidra", "Hidra", "Criatura", B("hidra"), "rara", "carne", 6, 4, 7, "Cabezas regenerativas: al inicio de tu turno recupera 2 de vida.");
  u("draco", "Draco", "Criatura", B("draco"), "legendaria", "carne", 7, 7, 7, "Cuerpo blindado: reduce en 2 el daño que recibe.");
  u("kraken", "Kraken", "Criatura", B("kraken"), "legendaria", "arcano", 7, 6, 8, "Arrollar: el daño que sobra al matar a su bloqueador pasa al jugador. Hambre insaciable: cuando destruye una unidad, roba una carta.");
  u("halcon-linire", "Halcón Linire", "Criatura", B("halcon-linire"), "comun", "caceria", 2, 2, 2, "Volar: solo puede ser bloqueado por unidades que también vuelan.");
  u("colmillo-gris", "Colmillo Gris", "Criatura", B("colmillo-gris"), "comun", "caceria", 3, 3, 2, "Veloz: en combate golpea antes que su rival; si lo mata, no recibe daño.");
  u("felino-veloz-mistico", "Fulguepardo", "Criatura", B("felino-veloz-mistico"), "infrecuente", "arcano", 3, 2, 3, "Veloz: en combate golpea antes que su rival; si lo mata, no recibe daño. Teletransporte: hasta el final del próximo turno del rival, los desafíos y las habilidades enemigas no pueden elegirlo.");
  u("guillotina", "Guillotina", "Criatura", B("guillotina"), "infrecuente", "carne", 4, 4, 3, "Veloz: en combate golpea antes que su rival; si lo mata, no recibe daño. Arrollar: el daño que sobra al matar a su bloqueador pasa al jugador.");
  u("dragarto", "Dragarto", "Criatura", B("dragarto"), "rara", "carne", 5, 4, 6, "Arrollar: el daño que sobra al matar a su bloqueador pasa al jugador.");
  u("mamut-gelido", "Gelifante", "Criatura", B("mamut-gelido"), "infrecuente", "eternidad", 5, 3, 7, "Duro: recibe 1 menos de daño.");
  u("protodraco", "Protodraco", "Criatura", B("protodraco"), "rara", "eternidad", 6, 4, 5, "Volar: solo puede ser bloqueado por unidades que también vuelan. Aliento inestable: al entrar, inflige 2 de daño a una unidad enemiga.");

  // --- Objetos --------------------------------------------------------------
  o("pocion-de-curacion-menor", "Poción de curación menor", "Objeto", O("pocion-de-curacion-menor"), "comun", "carne", 1, "Cura 3 de vida a una unidad o a ti.");
  o("escudo-reforzado", "Escudo reforzado", "Objeto", O("escudo-reforzado"), "comun", "juramento", 2, "Equipo: la unidad gana +0/+3.");
  o("baraja-de-cartas", "Baraja de cartas", "Objeto", O("baraja-de-cartas"), "infrecuente", "arcano", 2, "Roba dos cartas.");
  o("bomba-de-humo", "Bomba de humo", "Reacción", O("bomba-de-humo"), "infrecuente", "sombra", 2, "Reacción: cuando el rival declare un ataque, una de sus unidades atacantes se queda fuera del combate.");
  o("cristal-de-mana", "Cristal de maná", "Objeto", O("cristal-de-mana"), "infrecuente", "arcano", 0, "Gana 2 de energía este turno.");
  o("capucha-oscura", "Capucha oscura", "Objeto", O("capucha-oscura"), "comun", "sombra", 1, "Equipo: las habilidades enemigas no pueden apuntar a la unidad.");
  o("veneno-debil", "Veneno débil", "Objeto", O("veneno-debil"), "comun", "sombra", 1, "Una unidad enemiga pierde 2 de ataque hasta el final del próximo turno de su dueño.");
  o("capa-reversible", "Capa reversible", "Objeto", O("capa-reversible"), "infrecuente", "sombra", 1, "Una unidad aliada es Escurridizo hasta el final del próximo turno del rival: los desafíos y las habilidades enemigas no pueden elegirla.");
  o("kit-de-sanador", "Kit de sanador", "Objeto", O("kit-de-sanador"), "infrecuente", "carne", 2, "Cura 4 de vida a una unidad aliada. Si es de Carne, además gana +1/+1.");
  o("corneta-de-senales", "Corneta de señales", "Objeto", O("corneta-de-senales"), "comun", "juramento", 1, "Roba una carta. Si controlas 2 o más unidades de Juramento, roba otra.");
  o("sales-aromaticas", "Sales aromáticas", "Objeto", O("sales-aromaticas"), "infrecuente", "eternidad", 3, "Despierta: devuelve al campo, con 1 de vida, la última unidad de tu cementerio.");

  // --- Reacciones: se juegan en el turno del rival, como respuesta a lo que hace
  o("silbato-de-guardia", "Silbato de guardia", "Reacción", O("silbato-de-guardia"), "comun", "juramento", 1, "Reacción: cuando el rival declare un ataque, tus unidades ganan +0/+2 hasta el final del turno.");
  o("llave-maestra-defectuosa", "Llave maestra defectuosa", "Reacción", O("llave-maestra-defectuosa"), "infrecuente", "sombra", 2, "Reacción: cuando el rival juegue un objeto, una acción o un terreno, cancélalo.");
  o("trampa-para-animales", "Trampa para animales", "Reacción", O("trampa-para-animales"), "comun", "caceria", 2, "Reacción: cuando el rival declare un ataque, una de sus unidades atacantes, a tu elección, recibe 3 de daño.");
  o("saco-de-abrojos", "Saco de abrojos", "Reacción", O("saco-de-abrojos"), "comun", "juramento", 1, "Reacción: cuando el rival declare un ataque, sus unidades atacantes pierden 1 de ataque hasta el final del turno.");

  // --- Terrenos: cambian las condiciones del combate durante varios turnos. Cada uno sale de un lugar del compendio.
  const T = (id, nombre, lugar, rareza, afinidad, coste, habilidad) => o(id, nombre, "Terreno", L(lugar), rareza, afinidad, coste, habilidad);
  T("puente-de-las-legiones", "Puente de las Legiones", "puente-de-las-legiones", "comun", "caceria", 2, "Ruta directa: durante 2 turnos, tus desafíos ignoran Provocar.");
  T("los-huesos", "Los Huesos", "los-huesos-pelgiria", "comun", "sombra", 2, "Pasajes de memoria: durante 3 turnos, tus unidades de Sombra tienen Volar.");
  T("glaciar-eterno", "Glaciar Eterno", "glaciar-eterno", "comun", "eternidad", 2, "Muro de hielo: durante 3 turnos, la primera unidad que entre en cada turno no puede atacar en el siguiente turno de su dueño.");
  T("vado-ceniza", "Vado Ceniza", "vado-ceniza", "infrecuente", "sombra", 3, "Oleada de ceniza: durante 3 turnos, las unidades no pueden ser objetivo de habilidades.");
  T("desierto-de-cenizas", "Desierto de Cenizas", "desierto-de-cenizas", "infrecuente", "eternidad", 3, "Ceniza que no cesa: durante 3 turnos, ninguna unidad puede curarse ni recuperar vida.");
  T("catedral-del-juramento", "Catedral del Juramento", "catedral-del-juramento", "infrecuente", "juramento", 3, "Juramento público: durante 3 turnos, las habilidades no pueden destruir unidades (el combate sí).");
  T("el-crater", "El Cráter", "el-crater", "infrecuente", "arcano", 2, "Pruebas arcanas: mientras esté en juego, tus cartas de Arcano cuestan 1 menos, pero al inicio de tu turno una unidad de Arcano al azar recibe 1 de daño.");
  T("kigan", "Kigan", "kigan", "infrecuente", "juramento", 3, "Puerto militar: al inicio de tu turno, si controlas 2 o más unidades, roba una carta.");
  T("torre-del-silencio", "Torre del Silencio", "torre-del-silencio", "rara", "sombra", 3, "Silencio: durante 3 turnos, las unidades no pueden activar habilidades al entrar.");
  T("la-espesura", "La Espesura", "la-espesura", "rara", "arcano", 4, "Presencia que no se ve: mientras esté en juego, al inicio de cada turno una unidad al azar, de cualquier jugador, no puede atacar ese turno.");
  T("osario-de-la-frontera", "Osario de la Frontera", "osario-de-la-frontera", "rara", "eternidad", 4, "Centinelas no muertos: mientras esté en juego, cuando una de tus unidades muere, recibes un Centinela 1/1 en el campo.");
  T("campamento-de-las-astas-caidas", "Campamento de las Astas Caídas", "campamento-de-las-astas-caidas", "infrecuente", "juramento", 3, "Luto: mientras esté en juego, la primera vez cada turno que muere una unidad tuya, tus demás unidades ganan +1 de ataque hasta el final de tu próximo turno.");
  T("fauces-grises", "Fauces Grises", "fauces-grises", "infrecuente", "caceria", 3, "Presa rastreada: durante 3 turnos, tus unidades de Cacería tienen Desafiante.");
  T("montana-del-eco-arcano", "Montaña del Eco Arcano", "montana-del-eco-arcano", "rara", "arcano", 3, "Eco de conjuros: durante 3 turnos, las habilidades al entrar de tus unidades de Arcano se activan dos veces.");
  T("pozo-de-la-eternidad", "Pozo de la Eternidad", "pozo-de-la-eternidad", "rara", "eternidad", 4, "Cementerio de dragones: mientras esté en juego, la primera unidad de Eternidad tuya que muera cada turno vuelve al campo con 1 de vida.");
  T("carronada", "Carroñada", "carronada", "comun", "carne", 2, "Carroñeros: mientras esté en juego, cuando muere una unidad, tus unidades de Carne recuperan 2 de vida.");
  // Subsección que solo ve el Side B de La Espesura: la carta es solo para el Side B
  o("cueva-de-carne", "La Cueva de Carne", "Terreno", L("la-espesura"), "rara", "carne", 4,
    "Interior vivo: mientras esté en juego, al final de cada turno las unidades de Carne recuperan 1 de vida y las demás unidades reciben 1 de daño.",
    { lado: ["B"], descripcion: "Una cueva hecha enteramente de carne, tibia y húmeda, bajo la mansión de La Espesura. Las paredes laten, y probablemente son el interior de una de las criaturas de arriba." });

  // --- Especiales (solo por regalo del admin) -------------------------------
  u("el-bufon", "El Bufón", "Entidad", { data: null, id: null }, "limitada", "arcano", 4, 3, 3, "Cambio de reglas: al entrar, hasta el final del turno tus cartas cuestan 1 menos.", { obtenible: false, limite: 5, epiteto: "El último espectador" });

  window.CARTAS = lista;
  window.cartaPorId = id => lista.find(c => c.id === id) || null;
})();
