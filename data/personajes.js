window.PERSONAJES = [
  {
    id: "rook",
    title: "Rook",
    category: "Personajes",
    tags: ["npc", "comadrejas"],
    summary: "Líder de Las Comadrejas, asesino y ejecutor.",
    retrato: "",
    titulo: "Líder de las Comadrejas",
    raza: "Humano",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "Asesino / Ejecutor",
    faccion: "las-comadrejas",
    primeraAparicion: "La Taberna del Gigante",
    lado: ["B"],
    relacionesConocidas: [
      { id: "bull", nota: "Compañero de banda" },
      { id: "garra", nota: "Compañero de banda" },
      { id: "baraja", nota: "Compañero de banda" }
    ],
    content: `
      <p>El líder de Las Comadrejas. Frío, metódico y de reputación temida. Se dice
      que nunca ha aceptado un encargo que no pudiera completar.</p>
    `
  },
  {
    id: "bull",
    title: "Bull",
    category: "Personajes",
    tags: ["npc", "comadrejas"],
    summary: "Miembro de Las Comadrejas, bruto pero paciente.",
    retrato: "",
    titulo: "Miembro de las Comadrejas",
    raza: "Humano",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "Mercenario",
    faccion: "las-comadrejas",
    primeraAparicion: "La Taberna del Gigante",
    lado: ["A", "B"],
    relacionesConocidas: [
      { id: "rook", nota: "lider de banda" },
      { id: "baraja", nota: "Compañero de banda" },
      { id: "garra", nota: "Compañero de banda" }
    ],
    content: `
      <p><em>"El que se mueva primero, muere primero."</em></p>
      <p>Miembro de Las Comadrejas junto a Baraja desde la infancia. Bruto pero
      paciente, prefiere ocupar puertas, pasillos y puentes antes que perseguir.</p>
    `
  },
  {
    id: "garra",
    title: "Garra",
    category: "Personajes",
    tags: ["npc", "comadrejas"],
    summary: "Miembro más nuevo de Las Comadrejas, mal genio e impaciente.",
    retrato: "",
    titulo: "Miembro de las Comadrejas",
    raza: "Semigigante",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "Mercenario",
    faccion: "las-comadrejas",
    primeraAparicion: "La Taberna del Gigante",
    lado: ["A", "B"],
    relacionesConocidas: [
      { id: "rook", nota: "Compañero de banda" },
      { id: "bull", nota: "Compañero de banda" },
      { id: "baraja", nota: "Compañero de banda" }
    ],
    content: `
      <p><em>"Nunca tuve que correr tras una presa."</em></p>
      <p>El miembro más nuevo del trío. Mal genio e impaciente, se encarga de
      mantener alejados a los curiosos y separar a sus objetivos del resto.</p>
    `
  },
  {
    id: "baraja",
    title: "Baraja",
    category: "Personajes",
    tags: ["npc", "comadrejas"],
    summary: "El cerebro de Las Comadrejas.",
    retrato: "",
    titulo: "Miembro de las Comadrejas",
    raza: "Humano",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "Mercenario",
    faccion: "las-comadrejas",
    primeraAparicion: "La Taberna del Gigante",
    lado: ["A", "B"],
    relacionesConocidas: [
      { id: "bull", nota: "Compañero de banda" },
      { id: "rook", nota: "Compañero de banda" },
      { id: "garra", nota: "Compañero de banda" }
    ],
    content: `
      <p><em>"Las probabilidades siempre están de mi lado."</em></p>
      <p>Compañero de banda —y algunos dicen que algo más— de Bull. El cerebro del trío.
      Nunca entra en combate cuerpo a cuerpo y siempre actúa al final.</p>
    `
  },
  {
    id: "ocevat",
    title: "Ocevat",
    category: "Personajes",
    tags: ["histórico", "aarakocra", "refugio", "har"],
    summary: "Paladín aarakocra que murió defendiendo el refugio y a los protagonistas.",
    retrato: "",
    titulo: "Paladín",
    raza: "Aarakocra",
    tipo: "Histórico",
    lugarOrigen: "",
    ocupacion: "Paladín",
    faccion: "",
    primeraAparicion: "El Refugio",
    lado: ["A", "B"],
    relacionesConocidas: [],
    content: `
      <p>Un paladín aarakocra, noble y de trato amable incluso en medio del desastre.
      Luchó junto a los protagonistas en la defensa del refugio y no sobrevivió a esa
      noche, pero antes de caer les encomendó una tarea que terminó definiendo el resto
      de su historia en Brurland: espantar al dragón que había caído sobre la ciudad.</p>
    `
  },
  {
    id: "verdam",
    title: "Verdam",
    category: "Personajes",
    tags: ["npc", "explorador", "refugio"],
    summary: "Explorador humano de paradero desconocido, encontrado junto a los cadáveres del refugio.",
    retrato: "",
    titulo: "Explorador",
    raza: "Humano",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "Explorador",
    faccion: "",
    primeraAparicion: "El Refugio",
    lado: ["A", "B"],
    relacionesConocidas: [],
    content: `
      <p>Un explorador humano, poco hablador y de intenciones difíciles de leer. Cuando
      los protagonistas llegaron al refugio lo encontraron junto a los cadáveres de los
      refugiados y de Ocevat, sin tiempo ni ocasión para hacerle una sola pregunta. En
      cuanto aparecieron los guardias, escapó del lugar sin dar explicaciones. Su
      paradero actual se desconoce.</p>
    `
  },
  {
    id: "eklino-a",
    title: "Eklino",
    category: "Personajes",
    tags: ["histórico", "hombre-bestia", "refugio", "side-a"],
    summary: "Encargado del refugio, hombre bestia foca, murió defendiéndolo junto al resto de los suyos.",
    retrato: "",
    titulo: "Encargado del refugio",
    raza: "Hombre bestia (Foca)",
    tipo: "Histórico",
    lugarOrigen: "",
    ocupacion: "Encargado del refugio",
    faccion: "",
    primeraAparicion: "El Refugio",
    lado: ["A"],
    relacionesConocidas: [],
    content: `
      <p>Un hombre bestia con rasgos de foca, encargado de organizar el refugio
      improvisado durante el ataque a Brurland. No se apartó de su puesto cuando la
      situación empeoró, y cayó esa noche junto al resto de quienes se quedaron a
      defenderlo hasta el final.</p>
    `
  },
  {
    id: "eklino-b",
    title: "Eklino",
    category: "Personajes",
    tags: ["histórico", "hombre-bestia", "refugio", "side-b"],
    summary: "Encargado del refugio, hombre bestia foca, murió luchando contra los dragartos que lo asediaron.",
    retrato: "",
    titulo: "Encargado del refugio",
    raza: "Hombre bestia (Foca)",
    tipo: "Histórico",
    lugarOrigen: "",
    ocupacion: "Encargado del refugio",
    faccion: "",
    primeraAparicion: "El Refugio",
    lado: ["B"],
    relacionesConocidas: [],
    content: `
      <p>Un hombre bestia con rasgos de foca, encargado de organizar el refugio
      improvisado durante el ataque a Brurland. Murió luchando contra los dragartos
      que asediaron el refugio, defendiéndolo hasta el último momento.</p>
    `
  },
  {
    id: "coach-a",
    title: "Coach",
    category: "Personajes",
    tags: ["histórico", "refugio", "side-a"],
    summary: "Aldeano del refugio, notablemente más fuerte que el resto, se sacrificó para salvar a Orina del aliento de un protodraco.",
    retrato: "",
    titulo: "Aldeano del refugio",
    raza: "",
    tipo: "Histórico",
    lugarOrigen: "",
    ocupacion: "",
    faccion: "",
    primeraAparicion: "El Refugio",
    lado: ["A"],
    relacionesConocidas: [],
    content: `
      <p>Un aldeano refugiado en Brurland aquella noche, bastante más fuerte que el
      resto de quienes se resguardaban junto a él. Cuando el aliento de un protodraco
      barrió la línea de defensa, se interpuso para salvar a Orina, y pagó esa decisión
      con su vida.</p>
    `
  },
  {
    id: "coach-b",
    title: "Coach",
    category: "Personajes",
    tags: ["histórico", "refugio", "side-b"],
    summary: "Enviado por la familia de Ryn para encontrarla en Brurland, se sacrificó para salvar a los protagonistas del aliento del dragón.",
    retrato: "",
    titulo: "Enviado de la familia de Ryn",
    raza: "",
    tipo: "Histórico",
    lugarOrigen: "",
    ocupacion: "",
    faccion: "",
    primeraAparicion: "El Refugio",
    lado: ["B"],
    relacionesConocidas: [],
    content: `
      <p>Enviado por la familia de Ryn con la orden de encontrarla en Brurland, la
      búsqueda lo llevó directamente al ataque que sacudió la ciudad. Se sacrificó para
      salvar a los protagonistas del aliento del dragón, sin haber llegado siquiera a
      completar la misión que lo trajo hasta allí.</p>
    `
  },
  {
    id: "dagren",
    title: "Dagren",
    category: "Personajes",
    tags: ["npc", "bárbaro"],
    summary: "Bárbaro de edad avanzada que actualmente da refugio a los protagonistas en su granero.",
    retrato: "",
    titulo: "Bárbaro",
    raza: "",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "",
    faccion: "",
    primeraAparicion: "",
    lado: ["A"],
    relacionesConocidas: [
      { id: "guillotina", nota: "Le arrancó un brazo al atacar su granero" }
    ],
    content: `
      <p>Un bárbaro ya entrado en años que les da refugio a los protagonistas en su
      granero, en las tierras de la Ley. Perdió un brazo cuando Guillotina, arrastrada
      hasta allí por accidente por los propios protagonistas, atacó la propiedad.</p>
    `
  },
  {
    id: "adam-kovacs",
    title: "Adam Kovacs",
    category: "Personajes",
    tags: ["npc", "guardia-real", "kigan"],
    summary: "Capitán de la Guardia Real, reconocido por su fuerza y agradecido con los protagonistas por su ayuda durante el ataque del dragón.",
    retrato: "",
    titulo: "Capitán de la Guardia Real",
    raza: "",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "Capitán de la Guardia Real",
    faccion: "",
    primeraAparicion: "Los Calabozos de Kigan",
    lado: ["B"],
    relacionesConocidas: [],
    content: `
      <p>Capitán de la Guardia Real, reconocido por su fuerza incluso entre sus propios
      soldados. Se encontraba en alta mar cuando el dragón atacó Brurland, y desde
      entonces está agradecido con los protagonistas por la ayuda que prestaron durante
      el ataque.</p>
    `
  },
  {
    id: "prisionero-enmascarado",
    title: "Prisionero Enmascarado",
    category: "Personajes",
    tags: ["npc", "prisionero", "kigan"],
    summary: "Prisionero con una máscara de hierro, encarcelado junto a otra persona por seducir a la reina.",
    retrato: "",
    titulo: "Prisionero",
    raza: "",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "",
    faccion: "",
    primeraAparicion: "Los Calabozos de Kigan",
    lado: ["B"],
    relacionesConocidas: [],
    content: `
      <p>Un prisionero que nunca se quita la máscara de hierro que cubre su rostro.
      Terminó encerrado junto a otra persona por seducir a la reina, un escándalo que
      terminó en una orden de ejecución para ambos. Nadie parece haberlo visto sin la
      máscara, aunque se dice que es alguien muy hermoso.</p>
    `
  },
  {
    id: "sunny-y-hoare",
    title: "Sunny y Hoare",
    category: "Personajes",
    tags: ["npc", "prisioneros", "kigan"],
    summary: "Prisioneros a quienes los protagonistas ayudaron a escapar, amigos de los padres de Laia.",
    retrato: "",
    titulo: "Prisioneros",
    raza: "",
    tipo: "NPC",
    lugarOrigen: "",
    ocupacion: "",
    faccion: "",
    primeraAparicion: "Los Calabozos de Kigan",
    lado: ["B"],
    relacionesConocidas: [],
    content: `
      <p>Dos prisioneros a los que los protagonistas facilitaron la fuga desde los
      calabozos de Kigan. Son amigos de los padres de Laia, un vínculo que pesó a la
      hora de decidir ayudarlos.</p>
    `
  }
];
