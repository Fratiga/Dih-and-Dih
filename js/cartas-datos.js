/* =============================================================================
   CARTAS MALDITAS — catálogo. Cada carta apunta a una entrada del compendio
   (fuente) y de ahí saca su descripción, para que el lore viva en un solo
   sitio. La rareza es la dificultad de conseguirla, no su fuerza.

   El servidor tiene su propia copia mínima (id, rareza, lado, obtenible,
   limite): se genera con scratchpad/cartas_semilla.sql desde este archivo.
   Si cambias una rareza, un lado o añades una carta, vuelve a generar y correr
   ese SQL.

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
  const A = { lado: ["A"] };
  const AB = { lado: ["A", "B"] };
  const Bl = { lado: ["B"] };

  // --- Personajes -----------------------------------------------------------
  u("rook", "Rook", "Personaje", P("rook"), "rara", "caceria", 4, 5, 4, "Cazador solitario: +2 de ataque mientras sea tu única unidad en el campo.", A);
  u("bull", "Bull", "Personaje", P("bull"), "comun", "juramento", 3, 3, 4, "Provocar: los enemigos deben atacar a esta unidad antes que a otras.", AB);
  u("garra", "Garra", "Personaje", P("garra"), "comun", "caceria", 2, 3, 2, "Arpón: al entrar, una unidad enemiga no puede bloquear este turno.", AB);
  u("baraja", "Baraja", "Personaje", P("baraja"), "infrecuente", "arcano", 3, 2, 3, "Cartas del destino: al entrar, roba una carta.", AB);
  u("ocevat", "Ocevat", "Personaje", P("ocevat"), "rara", "juramento", 5, 4, 6, "Defensor del refugio: una vez por turno, recibe en lugar de una unidad aliada el daño que esta fuera a recibir.", AB);
  u("verdam", "Verdam", "Personaje", P("verdam"), "legendaria", "caceria", 7, 7, 6, "Marca de la presa: al entrar, marca a una unidad enemiga. Tus ataques contra ella hacen 2 de daño extra y ignoran Provocar.", AB);
  u("eklino-a", "Eklino", "Personaje", P("eklino-a"), "comun", "juramento", 2, 1, 5, "Provocar. Defender el refugio: las demás unidades aliadas ganan +1 de vida al entrar.", A);
  u("dagren", "Dagren", "Personaje", P("dagren"), "infrecuente", "carne", 4, 4, 5, "Furia de veterano: gana +1 de ataque cada vez que recibe daño.", A);
  u("orina", "Orina", "Personaje", P("orina"), "infrecuente", "juramento", 1, 1, 1, "Proyectil: al morir, inflige 3 de daño a una unidad enemiga.", A);
  u("edge", "Edge", "Personaje", P("edge"), "comun", "sombra", 3, 3, 2, "Ataque furtivo: +2 de daño si el objetivo ya recibió daño este turno.", A);
  u("hornet", "Hornet", "Personaje", P("hornet"), "comun", "caceria", 3, 3, 3, "Disparo certero: al entrar, inflige 1 de daño a una unidad enemiga.", A);
  u("sir-buffolet", "Sir Buffolet", "Personaje", P("sir-buffolet"), "infrecuente", "arcano", 2, 2, 2, "Mal bardo: al entrar, cada jugador descarta una carta al azar.", A);
  u("enzo", "Enzo", "Personaje", P("enzo"), "infrecuente", "carne", 4, 2, 3, "Golpe doble: ataca dos veces por turno.", A);
  u("mattei", "Mattei", "Personaje", P("mattei"), "comun", "sombra", 1, 1, 2, "Escurridizo: no puede ser objetivo de ataques el turno en que entra.", A);
  u("adam-kovacs", "Adam Kovacs", "Personaje", P("adam-kovacs"), "rara", "juramento", 6, 6, 7, "Capitán: tus demás unidades tienen +1 de ataque.", Bl);
  u("cassius-coldgrave", "Cassius Coldgrave", "Personaje", P("cassius-coldgrave"), "infrecuente", "caceria", 3, 2, 3, "Cobarde: no puede ser atacado mientras tengas otra unidad en el campo.", Bl);
  u("torvrena", "Torvrena", "Personaje", P("torvrena"), "infrecuente", "caceria", 4, 4, 4, "Trampa de mandíbula: al entrar, una unidad enemiga no puede atacar el próximo turno.", Bl);
  u("ryn", "Ryn", "Personaje", P("ryn"), "rara", "arcano", 3, 2, 3, "Canción de bardo: al entrar, una unidad aliada gana +2/+2 este turno.", Bl);
  u("hooey-magoo", "Hooey Magoo", "Personaje", P("hooey-magoo"), "rara", "carne", 3, 4, 3, "Sacrificado: al morir, roba una carta.", Bl);

  // --- Criaturas ------------------------------------------------------------
  u("kobold", "Kobold", "Criatura", B("kobold"), "comun", "carne", 1, 1, 1, "Instinto de manada: +1 de ataque por cada otro Kobold en el campo.");
  u("manta-del-cielo", "Aeromanta", "Criatura", B("manta-del-cielo"), "comun", "arcano", 2, 1, 3, "Volar: solo puede ser bloqueada por unidades voladoras.");
  u("lobo", "Lobo", "Criatura", B("lobo"), "comun", "caceria", 2, 2, 2, "Cazador: +1 de ataque contra unidades que ya tengan daño.");
  u("cuervo-del-augurio", "Cuervo del augurio", "Criatura", B("cuervo-del-augurio"), "comun", "eternidad", 1, 1, 1, "Augurio: al entrar, mira la carta superior de tu mazo.");
  u("guiverno", "Guiverno", "Criatura", B("guiverno"), "rara", "caceria", 5, 5, 4, "Volar. Depredador del cielo: +1 de ataque contra unidades terrestres.");
  u("hidra", "Hidra", "Criatura", B("hidra"), "rara", "carne", 6, 4, 7, "Cabezas regenerativas: al inicio de tu turno recupera 2 de vida.");
  u("draco", "Draco", "Criatura", B("draco"), "legendaria", "carne", 7, 7, 7, "Cuerpo blindado: reduce en 2 el daño que recibe.");
  u("kraken", "Kraken", "Criatura", B("kraken"), "legendaria", "arcano", 7, 6, 8, "Hambre insaciable: cuando destruye una unidad, roba una carta.");

  // --- Objetos --------------------------------------------------------------
  o("pocion-de-curacion-menor", "Poción de curación menor", "Objeto", O("pocion-de-curacion-menor"), "comun", "carne", 1, "Cura 3 de vida a una unidad o a ti.");
  o("escudo-reforzado", "Escudo reforzado", "Objeto", O("escudo-reforzado"), "comun", "juramento", 2, "Equipo: la unidad gana +0/+3.");
  o("baraja-de-cartas", "Baraja de cartas", "Objeto", O("baraja-de-cartas"), "infrecuente", "arcano", 2, "Roba dos cartas.");
  o("bomba-de-humo", "Bomba de humo", "Objeto", O("bomba-de-humo"), "infrecuente", "sombra", 2, "Reacción: tus unidades no pueden ser objetivo del siguiente ataque del rival.");
  o("cristal-de-mana", "Cristal de maná", "Objeto", O("cristal-de-mana"), "infrecuente", "arcano", 0, "Gana 2 de energía este turno.");
  o("capucha-oscura", "Capucha oscura", "Objeto", O("capucha-oscura"), "comun", "sombra", 1, "Equipo: la unidad no puede ser objetivo de habilidades enemigas el turno en que entra.");

  // --- Especiales (solo por regalo del admin) -------------------------------
  u("el-bufon", "El Bufón", "Entidad", { data: null, id: null }, "limitada", "arcano", 4, 3, 3, "Cambio de reglas: al entrar, hasta el final del turno cada jugador puede jugar una carta más.", { obtenible: false, limite: 5, epiteto: "El último espectador" });

  window.CARTAS = lista;
  window.cartaPorId = id => lista.find(c => c.id === id) || null;
})();
