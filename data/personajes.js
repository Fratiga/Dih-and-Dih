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
    lado: ["A", "B"],
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
  }
];
