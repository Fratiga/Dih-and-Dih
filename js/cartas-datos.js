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
  u("ulis", "Ulis", "Personaje", P("ulis"), "infrecuente", "carne", 2, 1, 3, "Monstruo ajolote: al atacar se transforma, sin coste ni desgaste, y tiene +2 de ataque. Si pasas un turno sin atacar con ella, vuelve a ser una niña. Ajolote: al inicio de tu turno recupera 1 de vida.", Object.assign(Be("La ajolote"), { formas: [{ nombre: "Monstruo ajolote", imagen: null, ajuste: null }] }));
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

  // --- Lote 2: líderes de facción, NPCs, criaturas, objetos, reacciones y terrenos (todavía sin foto: llegan despublicadas, ver scratchpad/cartas_lote2.sql)
  u("el-mitrado", "El Mitrado", "Personaje", null, "legendaria", "juramento", 6, 4, 6, "Bula de Asmodeo: las habilidades enemigas no pueden elegir a tus demás unidades de Juramento.", { descripcion: "Cabeza de la Iglesia de Asmodeo. Quien jura bajo su palabra queda a la sombra de su mitra.", epiteto: "Asmitra" });
  u("la-primera-aurora", "La Primera Aurora", "Personaje", null, "rara", "juramento", 4, 2, 5, "Amanecer: al inicio de tu turno, cura 2 de vida a tu unidad herida con menos vida.", { descripcion: "Abre la marcha de los Peregrinos del Alba, la rama itinerante del Kaneísmo, que no tiene fronteras propias.", epiteto: "Peralba" });
  u("el-primer-juramentado", "El Primer Juramentado", "Personaje", null, "legendaria", "juramento", 6, 4, 6, "Investidura: tus demás unidades de Juramento entran con Barrera.", { descripcion: "Caballero del Reino, el primero en jurar que recuperaría Broneland. Los demás caballeros repiten su juramento al ser investidos.", epiteto: "Juraldo" });
  u("atalaya-de-vardun", "Atalaya de Vardun", "Personaje", null, "rara", "juramento", 5, 3, 7, "Provocar. Escucha del hielo: al entrar, una unidad enemiga con 4 o más de ataque no puede atacar hasta el final del próximo turno de su dueño.", { descripcion: "Goliat de los Vigilantes de la Grieta. Pasó años escuchando crujidos que ningún viento debería producir.", epiteto: "Vigrieta" });
  u("legado-del-aguila", "Legado del Águila", "Personaje", null, "legendaria", "juramento", 6, 4, 5, "Formación imperial: tus demás unidades de Juramento tienen +1 de ataque (+2 si controlas 3 o más unidades de Juramento).", { descripcion: "Donde pisa su estandarte, pisa el Imperio de Balutia. Sus soldados no recuerdan otra familia que la legión.", epiteto: "Centurio" });
  u("senora-de-la-madriguera", "Señora de la Madriguera", "Personaje", null, "rara", "caceria", 3, 2, 3, "Captura: al entrar, devuelve a la mano de su dueño a una unidad enemiga herida.", { descripcion: "Cumple cualquier encargo si el precio es suficiente y no pregunta qué hizo el fugitivo.", epiteto: "Jefa de las Comadrejas" });
  u("el-tiznado", "El Tiznado", "Personaje", null, "infrecuente", "sombra", 3, 2, 3, "Contrabando: al entrar, roba un Objeto de tu mazo.", { descripcion: "Su mercancía sale de yacimientos ajenos y nunca llega a los libros oficiales.", epiteto: "Cabecilla de la Cofradía del Carbón" });
  u("pregonero-de-cambalache", "Pregonero de Cambalache", "Personaje", null, "rara", "sombra", 4, 2, 4, "Puja: al entrar, ambos jugadores roban una carta. El rival descarta además la de menor coste de su mano.", { descripcion: "Canta las pujas en Cambalache, a las afueras de Aurelport. Todo se vende y nadie pregunta de dónde viene.", epiteto: "Pregalache" });
  u("primer-engranaje", "Primer Engranaje", "Personaje", null, "rara", "arcano", 5, 2, 5, "Taller: al entrar, crea 2 Autómatas (1/2). Tus Autómatas tienen +1 de ataque.", { descripcion: "En Nernib la innovación vale más que la nobleza, y él es el primero de todos los artificieros.", epiteto: "Cognibio" });
  u("decano-de-los-fundamentos", "Decano de los Fundamentos", "Personaje", null, "legendaria", "arcano", 6, 3, 6, "Cátedra: al entrar, roba una carta de Arcano de tu mazo. Tus cartas de Arcano cuestan 1 menos.", { descripcion: "Cada tratado de los «Fundamentos de...» que circula por las bibliotecas del mundo sale de sus prensas.", epiteto: "Cátedron" });
  u("la-anatomista", "La Anatomista", "Personaje", null, "rara", "carne", 4, 3, 4, "Disección: al entrar, puedes destruir a otra unidad aliada. La Anatomista gana su ataque y su vida.", { descripcion: "Científica del Instituto Vesalio, la institución médica que dirige Dexter y financia Brurland. Sus propósitos nunca han estado del todo claros.", epiteto: "Bisturía" });
  u("trazahorizontes", "Trazahorizontes", "Personaje", null, "infrecuente", "arcano", 3, 2, 3, "Exploración: al entrar, roba un Terreno de tu mazo. Si no hay ninguno, roba una carta.", { descripcion: "Publica cada hallazgo verificado sin cobrar por el acceso, y por eso vive pobre y respetada.", epiteto: "Ventarrossa" });
  u("el-desenterrador", "El Desenterrador", "Personaje", null, "rara", "eternidad", 4, 3, 4, "Excavación: al entrar, devuelve a tu mano un Objeto o una Acción de tu cementerio.", { descripcion: "Para él cualquier ruina lo bastante vieja es anterior a la humanidad. La comunidad académica lo considera un excéntrico.", epiteto: "Desolterro" });
  u("mano-de-oro", "Mano de Oro", "Personaje", null, "rara", "juramento", 5, 3, 4, "Contrato dorado: al entrar, crea 2 Mercenarios (2/1).", { descripcion: "Ha servido a casi todas las naciones y se ha enfrentado a casi todas, sin que eso dañe su reputación.", epiteto: "Mercadoro" });
  u("el-ultimo-matadragones", "El Último Matadragones", "Personaje", null, "rara", "caceria", 5, 4, 5, "Desafiante. Escuela Matadragones: +4 de ataque contra los Dragones y contra las unidades de coste 6 o más.", { descripcion: "Solo mata cuando de verdad no queda alternativa. Su técnica viene de una escuela que casi se perdió.", epiteto: "Escamacero" });
  u("primer-velo-del-eclipse", "Primer Velo del Eclipse", "Personaje", null, "rara", "sombra", 5, 3, 5, "Escurridizo. Intriga: al entrar, el rival descarta una carta al azar.", { descripcion: "Nadie sabe qué persigue el Consejo, pero su sombra aparece detrás de los grandes acontecimientos.", epiteto: "Eclivelo" });
  u("el-anfitrion", "El Anfitrión", "Personaje", null, "rara", "sombra", 4, 3, 4, "Cobro de protección: al inicio de tu turno, si el rival controla más unidades que tú, ganas 1 de energía.", { descripcion: "En El Espejismo todo negocio le paga sin que nadie lo diga en voz alta.", epiteto: "Espejero" });
  u("senor-de-las-calas", "Señor de las Calas", "Personaje", null, "rara", "caceria", 4, 3, 3, "Saqueo: cuando golpea al jugador rival, robas una carta y el rival descarta una al azar.", { descripcion: "Navega desde las calas menores de Genevia, lejos de los puertos que ya cambiaron de reputación.", epiteto: "Rumbonero" });
  u("ceniza-coronada", "Ceniza Coronada", "Personaje", null, "legendaria", "eternidad", 7, 5, 7, "Corona de huesos: al entrar, devuelve con 2 de vida a la unidad más fuerte de tu cementerio. Cuando muere otra unidad aliada, crea un Centinela (1/1).", { descripcion: "Gobierna desde el nivel más profundo de Sepulkrad el mayor imperio de monstruos y no-muertos del mundo.", epiteto: "Sepulkrón" });
  u("magistrada-de-la-colmena", "Magistrada de la Colmena", "Personaje", null, "infrecuente", "arcano", 4, 2, 5, "Sentencia: al entrar, el rival no puede jugar Objetos ni Acciones hasta el final de su próximo turno.", { descripcion: "Puede quitarle la licencia a cualquier mago de la satrapía. Ni la Academia de Dolbred tiene ese poder.", epiteto: "Mandíbula" });
  u("portador-del-sello-rojo", "Portador del Sello Rojo", "Personaje", null, "infrecuente", "sombra", 3, 3, 2, "Embargo: al entrar, el rival descarta la carta de mayor coste de su mano.", { descripcion: "Se presenta con el contrato original en una mano y argumentos menos legales en la otra.", epiteto: "Cobrojo" });
  u("velador-de-umbrathil", "Velador de Umbrathil", "Personaje", null, "rara", "eternidad", 4, 2, 5, "Registro: al entrar, mira las 3 cartas superiores del mazo rival y manda al fondo la de mayor coste.", { descripcion: "Bajo la noche perpetua de Umbrathil, registra cada fenómeno sobrenatural antes de que la memoria lo distorsione.", epiteto: "Archivista de la Herida" });
  u("posadero", "Posadero", "Personaje", null, "comun", "juramento", 1, 1, 2, "Cama y plato: al entrar, cura 3 de vida a otra unidad aliada.", { descripcion: "Sirve sopa a quien llega y no hace preguntas hasta que se acaba.", copiasMax: 3 });
  u("herrero-de-aldea", "Herrero de aldea", "Personaje", null, "comun", "juramento", 2, 2, 2, "Forja: al entrar, otra unidad aliada gana +1/+1 para siempre.", { descripcion: "Arregla el arado por la mañana y la espada por la tarde.", copiasMax: 3 });
  u("boticaria", "Boticaria", "Personaje", null, "comun", "carne", 2, 1, 3, "Recetario: al entrar, cura 2 de vida a todas tus unidades.", { descripcion: "Tiene un ungüento para casi todo y una explicación larga para lo demás.", copiasMax: 3 });
  u("bardo-ambulante", "Bardo ambulante", "Personaje", null, "comun", "arcano", 2, 1, 2, "Canción de taberna: al entrar, tus unidades ganan +1 de ataque hasta el final del turno.", { descripcion: "Canta lo que la gente quiere oír, y casi siempre acierta.", copiasMax: 3 });
  u("mercader-viajero", "Mercader viajero", "Personaje", null, "comun", "sombra", 2, 1, 3, "Trueque: al entrar, descarta la carta de menor coste de tu mano y roba 2 cartas.", { descripcion: "Cambia lo que le sobra por lo que le falta, y siempre sale ganando.", copiasMax: 3 });
  u("guardia-de-la-ciudad", "Guardia de la ciudad", "Personaje", null, "comun", "juramento", 2, 1, 4, "Provocar.", { descripcion: "Vigila la puerta y se queda donde lo ponen. Eso ya es mucho.", copiasMax: 3 });
  u("novicio", "Novicio", "Personaje", null, "comun", "juramento", 1, 1, 2, "Fervor: +1 de ataque por cada otra unidad de Juramento que controles (hasta +3).", { descripcion: "Reza con más ganas que práctica, y la fe de los demás le contagia las manos.", copiasMax: 3 });
  u("cazador-de-brurland", "Cazador de Brurland", "Personaje", null, "comun", "caceria", 2, 2, 2, "Rastreador: +2 de ataque contra Criaturas.", { descripcion: "Conoce los bosques del reino mejor que sus propios caminos.", copiasMax: 3 });
  u("granjero-con-horca", "Granjero con horca", "Personaje", null, "comun", "juramento", 1, 1, 2, "Horca: cuando una unidad le hace daño en combate, esa unidad recibe 1 de daño.", { descripcion: "No es soldado, pero defiende su cosecha como si lo fuera.", copiasMax: 3 });
  u("ladron-de-bolsillos", "Ladrón de bolsillos", "Personaje", null, "comun", "sombra", 1, 1, 1, "Escurridizo el turno en que entra. Cuando golpea al jugador, robas una carta.", { descripcion: "Nadie lo ve llegar, y cuando lo ven ya falta algo.", copiasMax: 3 });
  u("contrabandista", "Contrabandista", "Personaje", null, "comun", "sombra", 2, 2, 2, "Soborno: al entrar, una unidad enemiga pierde Provocar hasta el final del próximo turno de su dueño.", { descripcion: "Una moneda bien puesta abre cualquier puerta que un guardia tenga cerrada.", copiasMax: 3 });
  u("alquimista-de-nernib", "Alquimista de Nernib", "Personaje", null, "infrecuente", "arcano", 3, 2, 3, "Inversión: al entrar, una unidad intercambia su ataque y su vida actuales.", { descripcion: "Los laboratorios de Nernib exigen que cada descubrimiento sirva para algo. El suyo sirve para casi todo.", copiasMax: 2 });
  u("aprendiz-de-mago", "Aprendiz de mago", "Personaje", null, "comun", "arcano", 1, 1, 1, "Chispa: al entrar, inflige 1 de daño a una unidad enemiga.", { descripcion: "Todavía no sabe por qué funciona. Funciona.", copiasMax: 3 });
  u("capitan-de-barco", "Capitán de barco", "Personaje", null, "infrecuente", "juramento", 3, 2, 4, "Cambio de rumbo: al entrar, devuelve a tu mano a otra unidad aliada.", { descripcion: "Sabe cuándo virar y cuándo volver a puerto.", copiasMax: 2 });
  u("pescador", "Pescador", "Personaje", null, "comun", "caceria", 1, 1, 2, "Red: al entrar, si hay un terreno en juego, roba una Criatura o un Objeto al azar de la afinidad de ese terreno, aunque no esté en tu mazo. Cuanto más rara es la carta, menos probable es que salga.", { descripcion: "Lo que saca la red depende del agua que le toque.", copiasMax: 3 });
  u("minero-de-pozohumo", "Minero de Pozohumo", "Personaje", null, "comun", "carne", 2, 2, 3, "Pulmón de mina: no recibe daño de terrenos.", { descripcion: "Respira humo desde niño y ya no le hace nada.", copiasMax: 3 });
  u("ciego-profeta", "Ciego profeta", "Personaje", null, "infrecuente", "eternidad", 3, 1, 4, "Visión: al entrar, mira la carta superior del mazo rival. Si es una unidad, va al fondo de su mazo.", { descripcion: "Dice lo que va a pasar. Los que lo escuchan después de que ocurra no suelen agradecerlo.", copiasMax: 2 });
  u("verdugo", "Verdugo", "Personaje", null, "infrecuente", "carne", 3, 3, 2, "Ejecución: al entrar, destruye una unidad enemiga con la mitad o menos de su vida.", { descripcion: "Hace su trabajo rápido y sin ceremonia.", copiasMax: 2 });
  u("escriba-del-contrato", "Escriba del contrato", "Personaje", null, "infrecuente", "juramento", 2, 1, 3, "Letra pequeña: al entrar, el rival no puede jugar Reacciones este turno.", { descripcion: "Lo que firmaste decía más de lo que leíste.", copiasMax: 2 });
  u("peregrino-del-alba", "Peregrino del Alba", "Personaje", null, "comun", "juramento", 1, 1, 1, "Último consuelo: al morir, cura 3 de vida a tu unidad herida con menos vida.", { descripcion: "Camina sin rumbo fijo y reza por quien se cruza en su camino.", copiasMax: 3 });
  u("soldado-balutiano", "Soldado balutiano", "Personaje", null, "comun", "juramento", 2, 2, 2, "Duro.", { descripcion: "Disciplina de legión: aprende a recibir el golpe antes de aprender a darlo.", copiasMax: 3 });
  u("sepulturero", "Sepulturero", "Personaje", null, "comun", "eternidad", 2, 1, 3, "Pala: al entrar, devuelve a tu mano la unidad de menor coste de tu cementerio.", { descripcion: "Sabe quién está enterrado en cada tumba y quién no debería estarlo.", copiasMax: 3 });
  u("fenix", "Fénix", "Criatura", null, "legendaria", "eternidad", 6, 5, 4, "Renace: la primera vez que muere, vuelve al campo con 2 de vida.", { descripcion: "Arde y vuelve, y cada vez parece más segura de que volverá." });
  u("kirin", "Kirin", "Criatura", null, "rara", "arcano", 4, 3, 4, "Purificar: al entrar, quita los efectos negativos de tus unidades y cura 2 de vida a cada una.", { descripcion: "Camina sin pisar la hierba y limpia el aire a su paso." });
  u("manticora", "Manticora", "Criatura", null, "rara", "caceria", 5, 4, 4, "Púas: al entrar, inflige 1 de daño a cada unidad enemiga.", { descripcion: "Cuerpo de león, cola de púas y una sonrisa que no conviene devolver." });
  u("basilisco", "Basilisco", "Criatura", null, "rara", "sombra", 5, 3, 6, "Mirada petrificante: cuando una unidad le hace daño en combate, esa unidad no puede atacar ni bloquear hasta el final del próximo turno de su dueño.", { descripcion: "Lo que lo mira un instante de más no vuelve a moverse igual." });
  u("medusa", "Medusa", "Criatura", null, "rara", "sombra", 6, 3, 5, "Cabellera de serpientes: al entrar, inflige 1 de daño a cada unidad enemiga y ninguna puede atacar hasta el final del próximo turno de su dueño.", { descripcion: "Sus serpientes miran por ella cuando ella no mira." });
  u("kelpie", "Kelpie", "Criatura", null, "infrecuente", "carne", 3, 2, 4, "Aguas traidoras: al entrar, una unidad enemiga sin Volar no puede atacar hasta el final del próximo turno de su dueño.", { descripcion: "Caballo de agua que ofrece su lomo a los viajeros cansados." });
  u("unicornio", "Unicornio", "Criatura", null, "rara", "arcano", 4, 2, 4, "Escurridizo. Cuerno sagrado: al entrar, cura al máximo a otra unidad aliada.", { descripcion: "Se deja ver muy pocas veces, y nunca por quien lo busca." });
  u("behemoth", "Behemoth", "Criatura", null, "legendaria", "carne", 7, 6, 7, "Duro. Estampida: al entrar, inflige 3 de daño a una unidad enemiga.", { descripcion: "Cuando se mueve, el suelo no sabe si quedarse." });
  u("leviatan", "Leviatán", "Criatura", null, "legendaria", "arcano", 8, 6, 9, "Marea viva: cada vez que ataca, inflige 2 de daño a cada unidad enemiga antes de los bloqueos.", { descripcion: "Detrás de él, el mar ya no se parece a sí mismo." });
  u("gargola", "Gárgola", "Criatura", null, "infrecuente", "eternidad", 3, 2, 3, "Duro. Piedra viva: cuando muere, deja un Fragmento de gárgola (2/3, reduce en 1 el daño que recibe).", { descripcion: "Vigila desde las cornisas y baja cuando nadie mira hacia arriba." });
  u("pegaso", "Pegaso", "Criatura", null, "infrecuente", "arcano", 3, 2, 3, "Volar. Al entrar, otra unidad aliada gana Volar hasta el final del turno.", { descripcion: "Cabalgadura de nubes que presta su vuelo a quien la monte." });
  u("hipogrifo", "Hipogrifo", "Criatura", null, "infrecuente", "caceria", 4, 3, 3, "Volar. Veloz.", { descripcion: "Mitad águila, mitad caballo, y todo prisa." });
  u("grifo", "Grifo", "Criatura", null, "rara", "caceria", 4, 3, 4, "Volar. Temible: no lo bloquean unidades con menos de 3 de ataque.", { descripcion: "Guarda lo que le importa desde el aire y baja solo a morder." });
  u("dragon-dorado", "Dragón Dorado", "Criatura", null, "rara", "arcano", 6, 3, 5, "Volar. Escamas doradas: Duro (recibe 1 menos de daño).", { descripcion: "Duerme sobre oro y lo reparte solo cuando le conviene." });
  u("dragon-de-magma", "Dragón de Magma", "Criatura", null, "rara", "carne", 6, 4, 5, "Arrollar. Aliento de magma: al entrar, inflige 2 de daño a una unidad enemiga.", { descripcion: "Donde se posa, la roca vuelve a ser líquida." });
  u("dragon-ancestral", "Dragón Ancestral", "Criatura", null, "legendaria", "eternidad", 9, 7, 9, "Volar. Duro. Sueño milenario: al entrar, inflige 4 de daño a una unidad enemiga.", { descripcion: "Lleva tanto tiempo despierto que ya no recuerda cuándo empezó." });
  u("arbol-ancestral-de-eon", "Árbol Ancestral de Eon", "Criatura", null, "legendaria", "carne", 6, 2, 8, "Provocar. Raíces: al inicio de tu turno gana +1/+1 (hasta +4/+4).", { descripcion: "Más viejo que el bosque que lo rodea, y todavía creciendo." });
  u("lao-shan-lung", "Lao Shan Lung", "Criatura", null, "legendaria", "eternidad", 9, 8, 11, "Duro. Avance del titán: cada vez que ataca, el terreno en juego se desvanece.", { descripcion: "Un titán que camina por encima de todo, y el paisaje se acomoda a su paso." });
  u("borealis-titan-glacial", "Borealis", "Criatura", null, "legendaria", "eternidad", 8, 6, 9, "Duro. Escarcha: al entrar, las unidades enemigas no pueden atacar hasta el final del próximo turno de su dueño.", { descripcion: "Cuando despierta, el frío llega antes que él.", epiteto: "Titán Glacial" });
  u("rykerd-el-imperdonable", "Rykerd", "Criatura", null, "legendaria", "sombra", 6, 4, 5, "Temible. Rencor: gana +2 de ataque cada vez que muere otra unidad aliada.", { descripcion: "No olvida una sola muerte, y se las cobra todas.", epiteto: "El Imperdonable" });
  u("ekizias-el-recolector", "Ekizias", "Criatura", null, "rara", "eternidad", 5, 3, 5, "Cosecha: la primera vez cada turno que muere una unidad enemiga, robas una carta.", { descripcion: "Se queda con lo que los demás dejan caer.", epiteto: "El Recolector", copiasMax: 1 });
  u("la-madre-del-desierto", "La Madre del Desierto", "Criatura", null, "legendaria", "carne", 8, 5, 9, "Cría de arena: al entrar, crea 2 Gusanos de arena (2/2). Al inicio de tu turno, crea otro.", { descripcion: "Matriarca colosal de los grandes gusanos de Mravec, venerada en el desierto desde antes del Quitinismo." });
  u("mimico", "Mímico", "Criatura", null, "infrecuente", "sombra", 3, 2, 3, "Disfraz: Escurridizo el turno en que entra. Cuando muere, el rival descarta una carta al azar.", { descripcion: "Se parece a un cofre, a una puerta, a lo que tú quieras abrir." });
  u("cubo-gelatinoso", "Cubo gelatinoso", "Criatura", null, "infrecuente", "carne", 4, 2, 5, "Absorber: cada vez que destruye a una unidad, gana +1/+1.", { descripcion: "Recorre las mazmorras limpiando lo que encuentra, huesos incluidos." });
  u("ent-mayor", "Ent Mayor", "Criatura", null, "rara", "carne", 5, 3, 6, "Provocar. Tus demás unidades de Carne tienen +1 de ataque.", { descripcion: "Camina despacio, y todo lo que crece a su alrededor lo sigue." });
  u("gofiri-la-jauria", "Gofiri", "Criatura", B("la-jauria"), "legendaria", "caceria", 5, 2, 3, "Desafiante. Jauría: al entrar, crea 2 Hienas de la Jauría (1/1, Veloz). Las Hienas tienen +1 de ataque por cada otro miembro de La Jauría en tu campo (hasta +2). La cresta: cuando muere el Alfa, una Hiena toma su lugar (2/3, Desafiante), y así mientras queden hienas.", { epiteto: "La Jauría" });
  o("espada-larga", "Espada larga", "Objeto", null, "comun", "juramento", 2, "Equipo: una unidad aliada gana +2/+0.", { descripcion: "Un arma recta y honrada, de las que no piden explicación." });
  o("daga-envenenada", "Daga envenenada", "Objeto", null, "comun", "sombra", 1, "Equipo: una unidad aliada gana +1/+0 y Veloz.", { descripcion: "Corta poco, pero lo que corta no se cura rápido." });
  o("arco-largo", "Arco largo", "Objeto", null, "infrecuente", "caceria", 3, "Equipo: una unidad aliada gana +1/+0 y Volar.", { descripcion: "Quien lo tensa golpea desde donde nadie lo alcanza." });
  o("lanza-de-caballeria", "Lanza de caballería", "Objeto", null, "infrecuente", "juramento", 3, "Equipo: una unidad aliada gana +2/+0 y Arrollar.", { descripcion: "Hecha para una carga larga y un impacto que atraviesa." });
  o("armadura-de-malla", "Armadura de malla", "Objeto", null, "comun", "juramento", 2, "Equipo: una unidad aliada gana +0/+1 y Duro.", { descripcion: "Pesa, suena y salva más vidas de las que cuenta." });
  o("pocion-de-fuerza", "Poción de fuerza", "Acción", null, "comun", "carne", 1, "Una unidad aliada gana +3 de ataque hasta el final del turno.", { descripcion: "Sabe mal y funciona un rato." });
  o("antidoto", "Antídoto", "Acción", null, "comun", "carne", 1, "Quita los efectos negativos de una unidad aliada y la cura 2 de vida.", { descripcion: "El frasco más barato de cualquier botica y el que más se agradece." });
  o("pergamino-de-bola-de-fuego", "Pergamino de bola de fuego", "Acción", null, "infrecuente", "arcano", 4, "Inflige 2 de daño a cada unidad enemiga.", { descripcion: "Un conjuro viejo en una hoja que se deshace al leerla." });
  o("anillo-de-invisibilidad", "Anillo de invisibilidad", "Objeto", null, "rara", "sombra", 3, "Equipo: una unidad aliada es Escurridizo para siempre.", { descripcion: "Quien se lo pone deja de estar en el recuerdo de los demás." });
  o("capa-elfica", "Capa élfica", "Objeto", null, "infrecuente", "sombra", 2, "Equipo: una unidad aliada gana +0/+1 y Esquivo.", { descripcion: "Se dobla con la luz y el golpe se pierde en el pliegue." });
  o("botas-de-velocidad", "Botas de velocidad", "Objeto", null, "infrecuente", "caceria", 2, "Equipo: una unidad aliada gana Veloz y puede atacar el turno en que entra.", { descripcion: "Cuando las calzas, el camino se acorta solo." });
  o("lampara-de-aceite", "Lámpara de aceite", "Objeto", null, "comun", "arcano", 1, "Roba una carta. Si el rival tiene 5 o más cartas en la mano, roba otra.", { descripcion: "Alumbra lo justo para ver lo que el otro esconde." });
  o("cuerda-de-seda", "Cuerda de seda", "Acción", null, "comun", "caceria", 1, "Una unidad enemiga pierde Volar hasta el final del próximo turno de su dueño.", { descripcion: "Ligera, fina y casi imposible de romper." });
  o("mapa-del-tesoro", "Mapa del tesoro", "Acción", null, "infrecuente", "eternidad", 2, "Roba una carta. Si hay un terreno en juego, roba dos.", { descripcion: "Una cruz, un camino y la promesa de que alguien ya estuvo ahí." });
  o("cofre-con-trampa", "Cofre con trampa", "Acción", null, "infrecuente", "sombra", 2, "Roba 2 cartas y recibes 2 de daño.", { descripcion: "Lo bueno de un cofre es lo que tiene dentro. Lo malo es lo que tiene alrededor." });
  o("bomba-alquimica-de-nernib", "Bomba alquímica de Nernib", "Acción", null, "infrecuente", "arcano", 3, "Inflige 3 de daño a una unidad enemiga y 1 al jugador rival.", { descripcion: "Los artificieros de Nernib prueban cada diseño antes de venderlo. Casi siempre." });
  o("reliquia-de-asmodeo", "Reliquia de Asmodeo", "Objeto", null, "rara", "juramento", 4, "Equipo: una unidad aliada de Juramento gana +2/+2 y Barrera.", { descripcion: "Un objeto bendecido por la Iglesia de Asmodeo, que nunca se separa de su portador." });
  o("contrato-firmado", "Contrato firmado", "Acción", null, "rara", "juramento", 3, "El rival no puede jugar cartas de coste 5 o más hasta el final de su próximo turno.", { descripcion: "Sellado ante los Tribunales del Iurismo: una palabra dada modifica el mundo." });
  o("moneda-de-la-suerte", "Moneda de la suerte", "Acción", null, "comun", "sombra", 1, "Lanza una moneda: si sale cara, ganas 2 de energía; si sale cruz, robas una carta.", { descripcion: "Siempre cae del lado que menos esperabas." });
  o("cuerno-de-guerra", "Cuerno de guerra", "Acción", null, "infrecuente", "juramento", 3, "Tus unidades ganan +2 de ataque hasta el final del turno.", { descripcion: "Un solo toque y nadie recuerda por qué tenía miedo." });
  o("brujula-de-los-cartografos", "Brújula de los Cartógrafos", "Objeto", null, "comun", "arcano", 1, "Roba una carta y gana 1 de energía.", { descripcion: "Señala lo que aún no está en ningún mapa." });
  o("estandarte-de-brurland", "Estandarte de Brurland", "Objeto", null, "rara", "juramento", 3, "Equipo: una unidad aliada gana +1/+2 y Provocar.", { descripcion: "Donde ondea, los caballeros se agrupan sin que nadie lo ordene." });
  o("parada", "Parada", "Reacción", null, "comun", "juramento", 2, "Reacción: cuando el rival declare un ataque, tus unidades ganan Barrera.", { descripcion: "El primer golpe siempre se puede desviar." });
  o("contraataque", "Contraataque", "Reacción", null, "infrecuente", "juramento", 2, "Reacción: cuando el rival declare un ataque, una de sus unidades atacantes, a tu elección, recibe 2 de daño (4 si controlas una unidad de Juramento).", { descripcion: "Cada golpe deja una puerta abierta, y alguien la usa." });
  o("emboscada", "Emboscada", "Reacción", null, "infrecuente", "sombra", 3, "Reacción: cuando el rival declare un ataque, crea 2 Emboscados (2/1) que pueden bloquear.", { descripcion: "Nadie los vio hasta que ya estaban en medio." });
  o("espejo-arcano", "Espejo arcano", "Reacción", null, "rara", "arcano", 3, "Reacción: cuando el rival juegue un objeto o una acción, cancélalo y añade una copia a tu mano.", { descripcion: "Devuelve lo que le muestran, pero se queda con el original." });
  o("contrahechizo", "Contrahechizo", "Reacción", null, "rara", "arcano", 3, "Reacción: cuando el rival juegue un objeto, una acción o un terreno, cancélalo y roba una carta.", { descripcion: "Una palabra a destiempo deshace lo que otro tardó en preparar." });
  o("esquiva", "Esquiva", "Reacción", null, "comun", "sombra", 1, "Reacción: cuando el rival declare un ataque, una de sus unidades atacantes, a tu elección, pierde 3 de ataque hasta el final del turno.", { descripcion: "Un paso al costado y todo el peso queda en el aire." });
  o("ultima-voluntad", "Última voluntad", "Reacción", null, "infrecuente", "eternidad", 3, "Reacción: cuando el rival declare un ataque, devuelve al campo, con 1 de vida, la última unidad de tu cementerio.", { descripcion: "Lo que se prometió antes de morir se cumple igual." });
  o("muro-de-escudos", "Muro de escudos", "Reacción", null, "comun", "juramento", 2, "Reacción: cuando el rival declare un ataque, tus unidades ganan Duro hasta el final del turno.", { descripcion: "Uno junto a otro, hasta que no queda hueco." });
  o("pacto-roto", "Pacto roto", "Reacción", null, "infrecuente", "sombra", 2, "Reacción: cuando el rival juegue una unidad de coste 4 o menos, cancélala.", { descripcion: "Lo acordado ya no vale, y quien llegaba lo descubre en la puerta." });
  o("clausula-oculta", "Cláusula oculta", "Reacción", null, "rara", "juramento", 3, "Reacción: cuando el rival juegue una carta de coste 5 o más, cancélala.", { descripcion: "Estaba escrita desde el principio, y nadie la había leído." });
  o("intervencion-divina", "Intervención divina", "Reacción", null, "rara", "juramento", 4, "Reacción: cuando el rival declare un ataque, tus unidades se curan al máximo y tú ganas 4 de vida.", { descripcion: "Algo escuchó, y respondió." });
  o("trampa-de-foso", "Trampa de foso", "Reacción", null, "infrecuente", "caceria", 2, "Reacción: cuando el rival declare un ataque, una de sus unidades atacantes, a tu elección, recibe 2 de daño, sale del ataque y no puede atacar en su próximo turno.", { descripcion: "Un tablón mal puesto y una caída más larga de lo que parecía." });
  o("rafaga-de-flechas", "Ráfaga de flechas", "Reacción", null, "comun", "caceria", 2, "Reacción: cuando el rival declare un ataque, inflige 1 de daño a cada unidad atacante.", { descripcion: "El cielo se oscurece un instante y después vuelve a aclararse." });
  o("llamada-a-las-armas", "Llamada a las armas", "Reacción", null, "comun", "juramento", 3, "Reacción: cuando el rival declare un ataque, crea 2 Reclutas (1/2) que pueden bloquear.", { descripcion: "Suena la campana y salen de las casas con lo que tengan a mano." });
  o("soborno", "Soborno", "Reacción", null, "infrecuente", "sombra", 3, "Reacción: cuando el rival declare un ataque, una de sus unidades atacantes, a tu elección, no ataca, y robas una carta.", { descripcion: "Todo el mundo tiene un precio, y alguien lo escribió en una bolsa." });
  o("huida-estrategica", "Huida estratégica", "Reacción", null, "comun", "sombra", 1, "Reacción: cuando el rival declare un ataque, devuelve a tu mano a tu unidad con menos vida.", { descripcion: "Retirarse a tiempo también es una forma de ganar." });
  o("rezo-del-neravismo", "Rezo del Neravismo", "Reacción", null, "infrecuente", "eternidad", 2, "Reacción: cuando el rival declare un ataque, devuelve a tu mano la última carta de tu cementerio.", { descripcion: "Solo desaparece del todo quien deja de ser recordado." });
  o("geiseres-de-nigredo", "Géiseres de Nigredo", "Terreno", null, "infrecuente", "carne", 3, "Erupciones: durante 3 turnos, al final de cada turno una unidad al azar, de cualquier jugador, recibe 2 de daño.", { descripcion: "El suelo de los yacimientos de Nigredo respira, y a veces escupe." });
  o("mina-de-pozohumo", "Mina de Pozohumo", "Terreno", null, "infrecuente", "juramento", 3, "Veta de Nigredo: mientras esté en juego, al inicio de tu turno ganas 1 de energía.", { descripcion: "Una galería estrecha, un candil y la veta que no se acaba." });
  o("taberna-del-camino", "Taberna del Camino", "Terreno", null, "comun", "juramento", 2, "Hogar de paso: durante 3 turnos, al inicio de tu turno cura 2 de vida a todas tus unidades.", { descripcion: "Fuego encendido, sopa caliente y una cama para el que llegue." });

  window.CARTAS = lista;
  window.cartaPorId = id => lista.find(c => c.id === id) || null;
})();
