/* =============================================================================
   HIPÓDROMO: palabras para los nombres de las criaturas (las usa js/hipodromo-motor.js).
   Cada idioma tiene sus propias listas. En español los sustantivos llevan género (g: "m" o "f") y los
   adjetivos sus dos formas, para que el nombre concuerde ("Gato Hambriento", "Cometa Hambrienta").
   pos de un adjetivo: "pre" va delante ("Pequeña Cometa"), "post" detrás, "any" cualquiera de las dos.
   Tono: absurdo, de taberna y de campaña de rol, sin groserías ni insultos.
============================================================================= */
window.HIPODROMO_PALABRAS = {
  es: {
    adjetivos: [
      { m: "Pequeño", f: "Pequeña", pos: "pre" }, { m: "Gran", f: "Gran", pos: "pre" }, { m: "Último", f: "Última", pos: "pre" },
      { m: "Buen", f: "Buena", pos: "pre" }, { m: "Mal", f: "Mala", pos: "pre" }, { m: "Primer", f: "Primera", pos: "pre" },
      { m: "Dorado", f: "Dorada", pos: "any" }, { m: "Plateado", f: "Plateada", pos: "any" }, { m: "Carmesí", f: "Carmesí", pos: "post" },
      { m: "Hambriento", f: "Hambrienta", pos: "post" }, { m: "Furioso", f: "Furiosa", pos: "post" }, { m: "Elegante", f: "Elegante", pos: "any" },
      { m: "Silencioso", f: "Silenciosa", pos: "post" }, { m: "Cansado", f: "Cansada", pos: "post" }, { m: "Perdido", f: "Perdida", pos: "post" },
      { m: "Afortunado", f: "Afortunada", pos: "post" }, { m: "Sospechoso", f: "Sospechosa", pos: "post" }, { m: "Valiente", f: "Valiente", pos: "any" },
      { m: "Torpe", f: "Torpe", pos: "post" }, { m: "Terrible", f: "Terrible", pos: "any" }, { m: "Salvaje", f: "Salvaje", pos: "post" },
      { m: "Mojado", f: "Mojada", pos: "post" }, { m: "Oxidado", f: "Oxidada", pos: "post" }, { m: "Prestado", f: "Prestada", pos: "post" },
      { m: "Eterno", f: "Eterna", pos: "any" }, { m: "Frágil", f: "Frágil", pos: "post" }, { m: "Orgulloso", f: "Orgullosa", pos: "post" },
      { m: "Tímido", f: "Tímida", pos: "post" }, { m: "Ruidoso", f: "Ruidosa", pos: "post" }, { m: "Fugaz", f: "Fugaz", pos: "post" },
      { m: "Nocturno", f: "Nocturna", pos: "post" }, { m: "Ceniciento", f: "Cenicienta", pos: "post" }, { m: "Maldito", f: "Maldita", pos: "post" },
      { m: "Bendito", f: "Bendita", pos: "post" }, { m: "Hueco", f: "Hueca", pos: "post" }, { m: "Roto", f: "Rota", pos: "post" },
      { m: "Ligero", f: "Ligera", pos: "post" }, { m: "Pesado", f: "Pesada", pos: "post" }, { m: "Inútil", f: "Inútil", pos: "post" },
      { m: "Sagrado", f: "Sagrada", pos: "any" }, { m: "Medio", f: "Media", pos: "pre" }, { m: "Falso", f: "Falsa", pos: "any" },
      { m: "Feliz", f: "Feliz", pos: "post" }, { m: "Triste", f: "Triste", pos: "post" }, { m: "Veloz", f: "Veloz", pos: "post" },
      { m: "Antiguo", f: "Antigua", pos: "any" }, { m: "Insomne", f: "Insomne", pos: "post" }, { m: "Caduco", f: "Caduca", pos: "post" },
      { m: "Envidioso", f: "Envidiosa", pos: "post" }, { m: "Resignado", f: "Resignada", pos: "post" }, { m: "Imposible", f: "Imposible", pos: "post" }
    ],
    sustantivos: [
      // Naturaleza
      { s: "Trueno", g: "m" }, { s: "Ceniza", g: "f" }, { s: "Cometa", g: "m" }, { s: "Luna", g: "f" }, { s: "Marea", g: "f" },
      { s: "Brasa", g: "f" }, { s: "Niebla", g: "f" }, { s: "Escarcha", g: "f" }, { s: "Relámpago", g: "m" }, { s: "Vendaval", g: "m" },
      { s: "Amanecer", g: "m" }, { s: "Crepúsculo", g: "m" }, { s: "Barro", g: "m" }, { s: "Charco", g: "m" }, { s: "Eclipse", g: "m" },
      { s: "Tormenta", g: "f" }, { s: "Espina", g: "f" }, { s: "Roble", g: "m" }, { s: "Musgo", g: "m" }, { s: "Rocío", g: "m" },
      // Objetos
      { s: "Campana", g: "f" }, { s: "Cuchillo", g: "m" }, { s: "Galleta", g: "f" }, { s: "Calcetín", g: "m" }, { s: "Microondas", g: "m" },
      { s: "Impuesto", g: "m" }, { s: "Reloj", g: "m" }, { s: "Paraguas", g: "m" }, { s: "Sombrero", g: "m" }, { s: "Candado", g: "m" },
      { s: "Escalera", g: "f" }, { s: "Cuchara", g: "f" }, { s: "Pergamino", g: "m" }, { s: "Dado", g: "m" }, { s: "Poción", g: "f" },
      { s: "Taberna", g: "f" }, { s: "Moneda", g: "f" }, { s: "Espejo", g: "m" }, { s: "Botella", g: "f" }, { s: "Linterna", g: "f" },
      { s: "Tostada", g: "f" }, { s: "Alfombra", g: "f" }, { s: "Sartén", g: "f" }, { s: "Corneta", g: "f" }, { s: "Almohada", g: "f" },
      // Animales
      { s: "Rata", g: "f" }, { s: "Cuervo", g: "m" }, { s: "Gallina", g: "f" }, { s: "Polilla", g: "f" }, { s: "Mapache", g: "m" },
      { s: "Sapo", g: "m" }, { s: "Lombriz", g: "f" }, { s: "Gato", g: "m" }, { s: "Pulga", g: "f" }, { s: "Mosquito", g: "m" },
      { s: "Ganso", g: "m" }, { s: "Tejón", g: "m" }, { s: "Zorro", g: "m" }, { s: "Cangrejo", g: "m" }, { s: "Pato", g: "m" },
      // Conceptos
      { s: "Problema", g: "m" }, { s: "Accidente", g: "m" }, { s: "Fortuna", g: "f" }, { s: "Memoria", g: "f" }, { s: "Rumor", g: "m" },
      { s: "Deuda", g: "f" }, { s: "Reembolso", g: "m" }, { s: "Inversión", g: "f" }, { s: "Coartada", g: "f" }, { s: "Milagro", g: "m" },
      { s: "Error", g: "m" }, { s: "Secreto", g: "m" }, { s: "Promesa", g: "f" }, { s: "Venganza", g: "f" }, { s: "Resaca", g: "f" },
      { s: "Advertencia", g: "f" }, { s: "Capricho", g: "m" }, { s: "Excusa", g: "f" }, { s: "Malentendido", g: "m" }, { s: "Presagio", g: "m" },
      // Fantasía y mesa de rol
      { s: "Kobold", g: "m" }, { s: "Mímico", g: "m" }, { s: "Dragón", g: "m" }, { s: "Bardo", g: "m" }, { s: "Gólem", g: "m" },
      { s: "Trasgo", g: "m" }, { s: "Hechizo", g: "m" }, { s: "Crítico", g: "m" }, { s: "Pifia", g: "f" }, { s: "Mazmorra", g: "f" },
      { s: "Tesoro", g: "m" }, { s: "Cofre", g: "m" }, { s: "Antorcha", g: "f" }, { s: "Emboscada", g: "f" }, { s: "Tirada", g: "f" },
      { s: "Posada", g: "f" }, { s: "Peaje", g: "m" }, { s: "Centinela", g: "m" }, { s: "Juramento", g: "m" }, { s: "Gremio", g: "m" }
    ],
    // Se usan con un verbo en imperativo: "Persigue Truenos"
    objetos: ["Truenos", "Sombras", "Fantasmas", "Nubes", "Impuestos", "Deudas", "Estrellas", "Promesas", "Cuervos", "Dragones", "Fortunas", "Recuerdos", "Tesoros", "Mañanas", "Milagros"],
    verbos: ["Persigue", "Come", "Recuerda", "Roba", "Cuenta", "Compra", "Evita", "Vende", "Cruza", "Busca", "Espanta", "Desafía", "Perdona", "Olvida", "Encuentra", "Esquiva"],
    conceptos: [
      "Sin Mañana", "Mala Idea", "Una Vez Más", "Ya Veremos", "Casi Nunca", "Sin Reembolso", "Último Aviso", "Hora Punta", "Cuenta Pendiente",
      "Sin Remedio", "Dudoso Honor", "Plan B", "Por Si Acaso", "Última Ronda", "Fin De Mes", "Mala Racha", "Paso Franco", "Doble o Nada",
      "Tiempo Muerto", "A Medias", "Sin Frenos", "Pura Suerte", "Gran Estreno", "Casa Llena", "Cuerda Floja", "Línea Roja", "Cuarto Creciente"
    ],
    titulos: [
      { m: "Don", f: "Doña" }, { m: "Señor", f: "Señorita" }, { m: "Capitán", f: "Capitana" }, { m: "Sargento", f: "Sargenta" },
      { m: "Doctor", f: "Doctora" }, { m: "Fray", f: "Sor" }, { m: "Barón", f: "Baronesa" }, { m: "Conde", f: "Condesa" },
      { m: "Maestro", f: "Maestra" }, { m: "Duque", f: "Duquesa" }, { m: "Almirante", f: "Almirante" }, { m: "Profesor", f: "Profesora" }
    ],
    // Nombres de persona poco serios, con su género. Los títulos y adjetivos concuerdan con la criatura, no con el nombre.
    nombres: ["Paco", "Manolo", "Greg", "Kevin", "Nicolás", "Marisol", "Gertrudis", "Bernardo", "Chuy", "Wendy", "Brenda", "Fernando", "Tomás", "Genoveva", "Ramiro", "Cuca", "Nacho", "Pepa", "Rigoberto", "Maruja", "Sebastián", "Eulalia", "Ambrosio", "Domitila", "Lupe", "Gaspar", "Remedios", "Ezequiel", "Facundo", "Dolores"],
    serios: ["Peregrino", "Tempestad", "Cardenal", "Aurora", "Centella", "Marfil", "Obsidiana", "Vendaval", "Estela", "Ámbar", "Mistral", "Perdición", "Alba", "Salitre", "Rescoldo", "Bruma", "Horizonte", "Ocaso", "Ónix", "Cenit", "Garnacha", "Ventisca", "Abedul", "Halcón", "Zafiro"],
    frases: [
      "Te Lo Dije", "Otra Vez No", "Dónde Está Mi Dinero", "Eso Fue Todo", "Qué Remedio", "Dame Un Minuto", "No Me Mires", "Ni Hablar",
      "Ahí Voy", "Todo Bien", "Yo No Fui", "Mejor Mañana", "Ya Lo Sabía", "Cuenta Conmigo", "Quién Pregunta", "Sin Comentarios", "Eso Dicen", "Vale Pues"
    ],
    anomalos: [
      "Desafortunadamente Kevin", "Mi Mamá", "Cena De Microondas", "Probablemente Bien", "Técnicamente Greg", "Lunes Por La Mañana",
      "Garantía Vencida", "Contraseña Olvidada", "Hola Soy Un Caballo", "No Soy Yo Es Mi Abogado", "Pizza De Anoche", "Factura Sorpresa",
      "Sinceramente Nadie", "Disculpe Las Molestias", "Pagaré Mañana", "Casi Un Dragón", "Error Cuarenta y Cuatro", "Bajo Sospecha"
    ]
  },
  en: {
    adjetivos: [
      { w: "Little" }, { w: "Big" }, { w: "Golden" }, { w: "Silver" }, { w: "Crimson" }, { w: "Hungry" }, { w: "Furious" }, { w: "Elegant" },
      { w: "Silent" }, { w: "Tired" }, { w: "Lost" }, { w: "Lucky" }, { w: "Suspicious" }, { w: "Brave" }, { w: "Clumsy" }, { w: "Terrible" },
      { w: "Wild" }, { w: "Wet" }, { w: "Rusty" }, { w: "Borrowed" }, { w: "Eternal" }, { w: "Fragile" }, { w: "Proud" }, { w: "Shy" },
      { w: "Loud" }, { w: "Fleeting" }, { w: "Ashen" }, { w: "Cursed" }, { w: "Blessed" }, { w: "Hollow" }, { w: "Broken" }, { w: "Useless" },
      { w: "Sacred" }, { w: "Fake" }, { w: "Happy" }, { w: "Sad" }, { w: "Swift" }, { w: "Ancient" }, { w: "Sleepless" }, { w: "Expired" },
      { w: "Jealous" }, { w: "Resigned" }, { w: "Impossible" }, { w: "Velvet" }, { w: "Last" }, { w: "Final" }, { w: "Dead" }, { w: "Bitter" },
      { w: "Honest" }, { w: "Stubborn" }
    ],
    sustantivos: [
      "Thunder", "Biscuit", "Knife", "Problem", "Accident", "Moon", "Tax", "Sock", "Warning", "Bell", "Comet", "Ghost", "Rat", "Dirt",
      "Pancake", "Mud", "Fortune", "Dawn", "Storm", "Microwave", "Dinner", "Evasion", "Reckoning", "Encore", "Morning", "Whisper",
      "Candle", "Anchor", "Crow", "Moth", "Raccoon", "Toad", "Goose", "Badger", "Fox", "Crab", "Duck", "Teapot", "Umbrella", "Hat",
      "Lantern", "Pillow", "Toast", "Carpet", "Spoon", "Dice", "Potion", "Tavern", "Coin", "Mirror", "Bottle", "Ember", "Frost", "Fog",
      "Eclipse", "Gale", "Dusk", "Thorn", "Oak", "Moss", "Rumor", "Debt", "Refund", "Investment", "Alibi", "Miracle", "Mistake",
      "Secret", "Promise", "Revenge", "Hangover", "Excuse", "Omen", "Kobold", "Mimic", "Dragon", "Bard", "Golem", "Goblin", "Spell",
      "Critical", "Dungeon", "Treasure", "Chest", "Torch", "Ambush", "Toll", "Sentinel", "Oath", "Guild", "Cheese", "Bucket", "Sandwich"
    ],
    objetos: ["Thunder", "Shadows", "Ghosts", "Dirt", "Rainbows", "Taxes", "Debts", "Dragons", "Bills", "Dreams", "Treasure", "Memories", "Tomorrows", "Miracles", "Crows"],
    verbos: ["Chase", "Eat", "Remember", "Steal", "Count", "Buy", "Dodge", "Sell", "Cross", "Seek", "Scare", "Defy", "Forgive", "Forget", "Find", "Outrun"],
    conceptos: [
      "No Tomorrow", "Bad Idea", "One More Time", "We Will See", "Almost Never", "No Refunds", "Final Warning", "Rush Hour", "Unpaid Tab",
      "No Remedy", "Dubious Honor", "Plan B", "Just In Case", "Last Call", "End Of Month", "Losing Streak", "Free Pass", "Double Or Nothing",
      "Dead Reckoning", "Last Encore", "Borrowed Time", "Cold Open", "Full House", "Thin Ice", "Red Line", "Silver Bell", "Little Comet"
    ],
    titulos: ["Sir", "Lady", "Captain", "Sergeant", "Doctor", "Baron", "Count", "Master", "Duke", "Admiral", "Professor", "Miss"],
    nombres: ["Steve", "Greg", "Kevin", "Gary", "Brenda", "Doug", "Larry", "Trevor", "Wendy", "Todd", "Gerald", "Bernard", "Susan", "Dennis", "Marge", "Keith", "Craig", "Linda", "Barry", "Horace", "Edna", "Cecil", "Mabel", "Percy", "Gladys"],
    serios: ["Silver Dawn", "Ashen Morning", "Dead Reckoning", "Last Encore", "Little Comet", "Winter Rose", "Iron Psalm", "Pale Rider", "Cold Harbor", "Midnight", "Wildfire", "Starling", "Evergreen", "Solstice", "Tidewater", "Nightjar", "Ironwood", "Paragon"],
    frases: [
      "I Told You", "Not Again", "Wheres My Money", "That Was It", "Fine Whatever", "Give Me A Minute", "Dont Look At Me", "No Way",
      "Here I Go", "All Good", "Wasnt Me", "Maybe Tomorrow", "I Knew It", "Count Me In", "Who Asked", "No Comment", "So They Say", "Sure Thing"
    ],
    anomalos: [
      "Unfortunately Kevin", "Your Mom", "Microwave Dinner", "Probably Fine", "Technically Greg", "Monday Morning", "Expired Warranty",
      "Forgotten Password", "Hello I Am A Horse", "Not Me Its My Lawyer", "Last Nights Pizza", "Surprise Invoice", "Honestly Nobody",
      "Sorry For The Trouble", "Ill Pay Tomorrow", "Almost A Dragon", "Error Four Four", "Under Suspicion"
    ]
  },
  // Para mezclar idiomas dentro de un mismo nombre
  mixto: {
    adverbios: ["Técnicamente", "Probablemente", "Casi", "Sinceramente", "Desafortunadamente", "Supuestamente"]
  }
};
