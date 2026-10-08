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
  u("adam-kovacs", "Adam Kovacs", "Personaje", P("adam-kovacs"), "rara", "juramento", 6, 6, 7, "Capitán: tus demás unidades tienen +1 de ataque.", Bl);
  u("cassius-coldgrave", "Cassius Coldgrave", "Personaje", P("cassius-coldgrave"), "infrecuente", "caceria", 3, 2, 3, "Cobarde: no puede bloquear. Escurridizo: mientras controles otra unidad, los desafíos y las habilidades enemigas no pueden elegirlo.", Bl);
  u("torvrena", "Torvrena", "Personaje", P("torvrena"), "infrecuente", "caceria", 4, 4, 4, "Trampa de mandíbula: al entrar, una unidad enemiga no puede atacar el próximo turno.", Bl);
  u("ryn", "Ryn", "Personaje", P("ryn"), "rara", "arcano", 3, 2, 3, "Canción de bardo: al entrar, una unidad aliada gana +2/+2 este turno.", Bl);
  u("hooey-magoo", "Hooey Magoo", "Personaje", P("hooey-magoo"), "rara", "carne", 3, 4, 3, "Sacrificado: al morir, roba una carta.", Bl);

  // --- Criaturas ------------------------------------------------------------
  u("kobold", "Kobold", "Criatura", B("kobold"), "comun", "carne", 1, 1, 1, "Instinto de manada: +1 de ataque por cada otro Kobold en el campo.");
  u("manta-del-cielo", "Aeromanta", "Criatura", B("manta-del-cielo"), "comun", "arcano", 2, 1, 3, "Volar: solo puede ser bloqueada por unidades que también vuelan.");
  u("lobo", "Lobo", "Criatura", B("lobo"), "comun", "caceria", 2, 2, 2, "Cazador: +1 de ataque contra unidades que ya tengan daño.");
  u("cuervo-del-augurio", "Cuervo del augurio", "Criatura", B("cuervo-del-augurio"), "comun", "eternidad", 1, 1, 1, "Augurio: al entrar, mira la carta superior de tu mazo.");
  u("guiverno", "Guiverno", "Criatura", B("guiverno"), "rara", "caceria", 5, 5, 4, "Volar: solo puede ser bloqueado por unidades que también vuelan. Depredador del cielo: +1 de ataque contra unidades terrestres.");
  u("hidra", "Hidra", "Criatura", B("hidra"), "rara", "carne", 6, 4, 7, "Cabezas regenerativas: al inicio de tu turno recupera 2 de vida.");
  u("draco", "Draco", "Criatura", B("draco"), "legendaria", "carne", 7, 7, 7, "Cuerpo blindado: reduce en 2 el daño que recibe.");
  u("kraken", "Kraken", "Criatura", B("kraken"), "legendaria", "arcano", 7, 6, 8, "Arrollar: el daño que sobra al matar a su bloqueador pasa al jugador. Hambre insaciable: cuando destruye una unidad, roba una carta.");

  // --- Objetos --------------------------------------------------------------
  o("pocion-de-curacion-menor", "Poción de curación menor", "Objeto", O("pocion-de-curacion-menor"), "comun", "carne", 1, "Cura 3 de vida a una unidad o a ti.");
  o("escudo-reforzado", "Escudo reforzado", "Objeto", O("escudo-reforzado"), "comun", "juramento", 2, "Equipo: la unidad gana +0/+3.");
  o("baraja-de-cartas", "Baraja de cartas", "Objeto", O("baraja-de-cartas"), "infrecuente", "arcano", 2, "Roba dos cartas.");
  o("bomba-de-humo", "Bomba de humo", "Reacción", O("bomba-de-humo"), "infrecuente", "sombra", 2, "Reacción: cuando el rival declare un ataque, una de sus unidades atacantes se queda fuera del combate.");
  o("cristal-de-mana", "Cristal de maná", "Objeto", O("cristal-de-mana"), "infrecuente", "arcano", 0, "Gana 2 de energía este turno.");
  o("capucha-oscura", "Capucha oscura", "Objeto", O("capucha-oscura"), "comun", "sombra", 1, "Equipo: las habilidades enemigas no pueden apuntar a la unidad.");

  // --- Reacciones: se juegan en el turno del rival, como respuesta a lo que hace
  o("silbato-de-guardia", "Silbato de guardia", "Reacción", O("silbato-de-guardia"), "comun", "juramento", 1, "Reacción: cuando el rival declare un ataque, tus unidades ganan +0/+2 hasta el final del turno.");
  o("llave-maestra-defectuosa", "Llave maestra defectuosa", "Reacción", O("llave-maestra-defectuosa"), "infrecuente", "sombra", 2, "Reacción: cuando el rival juegue un objeto, una acción o un terreno, cancélalo.");

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
  // Subsección que solo ve el Side B de La Espesura: la carta es solo para el Side B
  o("cueva-de-carne", "La Cueva de Carne", "Terreno", L("la-espesura"), "rara", "carne", 4,
    "Interior vivo: mientras esté en juego, al final de cada turno las unidades de Carne recuperan 1 de vida y las demás unidades reciben 1 de daño.",
    { lado: ["B"], descripcion: "Una cueva hecha enteramente de carne, tibia y húmeda, bajo la mansión de La Espesura. Las paredes laten, y probablemente son el interior de una de las criaturas de arriba." });

  // --- Especiales (solo por regalo del admin) -------------------------------
  u("el-bufon", "El Bufón", "Entidad", { data: null, id: null }, "limitada", "arcano", 4, 3, 3, "Cambio de reglas: al entrar, hasta el final del turno tus cartas cuestan 1 menos.", { obtenible: false, limite: 5, epiteto: "El último espectador" });

  window.CARTAS = lista;
  window.cartaPorId = id => lista.find(c => c.id === id) || null;
})();
