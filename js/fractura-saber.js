/* =============================================================================
   LA FRACTURA: el saber de cada ejército. Cada ejército tiene su propio árbol, con cuatro ramas de seis
   escalones, que refleja su forma de hacer la guerra. Cada escalón pide el anterior de su rama.
   Un escalón dice lo que hace con «ef»; el motor junta los efectos de todo lo aprendido (efectos()).
   El texto de cada escalón se escribe solo a partir de sus efectos y con los nombres de las tropas de ese
   ejército (describir()), así no hay textos que digan una cosa y efectos que hagan otra.
   Se usa igual en el navegador y en Node.
============================================================================= */
(function (raiz) {
  const D = raiz.FRACTURA_DATOS || (typeof require !== "undefined" ? require("./fractura-datos.js") : null);

  // Lo que cuesta cada escalón (I a IV) si la rama no dice otra cosa
  const COSTE = [{ mana: 3, oro: 2 }, { mana: 5, oro: 3 }, { mana: 8, oro: 4 }, { mana: 11, oro: 6 }, { mana: 15, oro: 8 }, { mana: 20, oro: 10 }];
  const COSTE_ANIMA = [{ anima: 3, mana: 1 }, { anima: 5, mana: 2 }, { anima: 8, mana: 3 }, { anima: 11, mana: 4 }, { anima: 15, mana: 6 }, { anima: 20, mana: 8 }];
  const COSTE_ORO = [{ oro: 4, mana: 1 }, { oro: 6, mana: 2 }, { oro: 9, mana: 3 }, { oro: 12, mana: 4 }, { oro: 16, mana: 5 }, { oro: 21, mana: 7 }];
  const COSTE_CRUCE = { mana: 14, oro: 10 };
  const n = (nombre, ef) => ({ nombre, ef });
  const R = (id, nombre, color, escalones, coste) => ({ id, nombre, color, escalones, coste: coste || COSTE });
  const MAGIA = { area: 0.75, frena: true };

  const ARBOLES = {
    "caballeros-del-reino": [
      R("orden", "Orden de Caballería", "#c8a24a", [n("Disciplina", { hpClase: { guerrero: 1, paladin: 1, piquero: 1 } }), n("Formación", { formacion: true }), n("Lanzas de carga", { cargaExtra: 1, atqClase: { caballero: 1 } }), n("Maestría", { veteranos: true }), n("Votos de la Orden", { hp: 1, def: 1 }), n("Gran Maestre", { atq: 1, veteranos: true, poblacion: 2 })]),
      R("murallas", "Murallas del Reino", "#9a8f7a", [n("Mampostería", { fortalezaDef: 1 }), n("Guarniciones", { curaCiudad: 2 }), n("Levas del Reino", { poblacion: 3 }), n("Ciudadelas", { ciudadDef: 1 }), n("Torres de vigía", { vision: 1, ciudadDef: 1 }), n("El Reino no cae", { fortalezaDef: 2, curaCiudad: 2 })], COSTE_ORO),
      R("cuadras", "Cuadras Reales", "#7a5a3a", [n("Remontas", { movTipo: { jinete: 1, jinete_pesado: 1 } }), n("Bardas", { defTipo: { jinete: 1, jinete_pesado: 1 } }), n("Grifos de Brurland", { desbloquea: ["jinete_alado"] }), n("Escuadrón Real", { atqTipo: { jinete_pesado: 1, volador: 1 } }), n("Caballos de guerra", { hpTipo: { jinete: 2, jinete_pesado: 2 } }), n("Carga del Reino", { cargaExtra: 2 })]),
      R("armas", "Hechicería de Armas", "#7a6ab8", [n("Escuela de armas", { desbloquea: ["arcanista"] }), n("Runas de filo", MAGIA), n("Herrería rúnica", { atq: 1 }), n("Estandartes benditos", { hp: 1, vision: 1 }), n("Filo de luz", { atqTipo: { magia: 1 }, alcTipo: { magia: 1 } }), n("Ecos de armas", { desbloquea: ["eco"] })])
    ],
    "academia-arcana-de-dolbred": [
      R("brasa", "Colegio de la Brasa", "#d8683a", [n("Primera llama", { desbloquea: ["arcanista"], atqClase: { arcanista: 1 } }), n("Resonancia", Object.assign({ desbloquea: ["archimago"] }, MAGIA)), n("Columna de fuego", { atqTipo: { magia: 1 } }), n("Alta magia", { desbloquea: ["eco"], alcTipo: { magia: 1 } }), n("Lluvia de ascuas", { atqClase: { archimago: 1, arcanista: 1 } }), n("Sol pequeño", { atqTipo: { magia: 2 } })]),
      R("humores", "Colegio de los Humores", "#7fbf6a", [n("Triaca", { cura: 1 }), n("Botica", { curaCiudad: 2 }), n("Destilería", { manaCiudad: 1 }), n("Panacea", { hp: 2 }), n("Elixires", { hpTipo: { magia: 2 } }), n("Cuerpo nuevo", { cura: 2 })]),
      R("umbral", "Colegio del Umbral", "#8f6fd8", [n("Sello menor", { defTipo: { magia: 1 } }), n("Transmutación", { transmutar: true, ecoExtra: 1 }), n("Guardas", { ciudadDef: 1 }), n("Biblioteca infinita", { investigar: 2 }), n("Puertas selladas", { fortalezaDef: 1, ciudadDef: 1 }), n("Bóveda del saber", { investigar: 2, manaTurno: 3 })]),
      R("bestias", "Cátedra de Bestias", "#6fa0c0", [n("Familiares", { desbloquea: ["volador"] }), n("Vuelo arcano", { movTipo: { volador: 1 } }), n("Ojos prestados", { vision: 1 }), n("Mantícoras", { desbloquea: ["jinete_alado"] }), n("Bridas de luz", { hpTipo: { volador: 2 } }), n("Bestias mayores", { atqTipo: { volador: 1, jinete_pesado: 1 } })])
    ],
    "trono-de-ceniza": [
      R("tanato", "Tanatología", "#9af27a", [n("Anatomía", { heridos: 1 }), n("Conservación", { animaBaja: 2, cura: 1 }), n("Reanimación", { reanimar: true }), n("Inmortalidad", { inmortalidad: true }), n("Sudario", { cura: 1, hp: 1 }), n("Muerte que camina", { animaBaja: 2, heridos: 1 })], COSTE_ANIMA),
      R("huesos", "Osamenta", "#d9d1bb", [n("Huesos duros", { hpClase: { esqueleto: 2, guerrero: 1 } }), n("Legión", { poblacion: 3 }), n("Falange de hueso", { formacion: true }), n("Huesos de hierro", { defClase: { esqueleto: 1, paladin: 1 } }), n("Osario sin fondo", { poblacion: 3 }), n("Marea de huesos", { atqClase: { esqueleto: 1, guerrero: 1 }, hpClase: { esqueleto: 2 } })], COSTE_ANIMA),
      R("catedra", "Cátedra Negra", "#7a5a8a", [n("Nigromancia", { desbloquea: ["arcanista"] }), n("Lamento", MAGIA), n("Ecos de la Cátedra", { desbloquea: ["eco"] }), n("Noche sin fin", { atqTipo: { magia: 1 }, alcTipo: { magia: 1 } }), n("Coro de lamentos", { atqTipo: { magia: 1 } }), n("Cátedra eterna", { animaTurno: 2, manaTurno: 2 })]),
      R("carrona", "Carroña Alada", "#8a8478", [n("Cuervos de osario", { desbloquea: ["volador"] }), n("Jinetes de hueso", { movTipo: { jinete: 1 }, atqTipo: { jinete: 1 } }), n("Wyverns podridos", { desbloquea: ["jinete_alado"] }), n("Plaga", { heridos: 1, animaBaja: 1 }), n("Alas negras", { movTipo: { volador: 1 }, hpTipo: { volador: 2 } }), n("Cielo de carroña", { atqTipo: { volador: 1, jinete: 1 } })], COSTE_ANIMA)
    ],
    "compania-dorada": [
      R("contratas", "Contratas", "#e0b23a", [n("Banca de campaña", { oroCiudad: 1 }), n("Primas", { reclutaOro: 1 }), n("Letras de cambio", { oroTurno: 3 }), n("Sede de la Compañía", { poblacion: 4 }), n("Monopolio", { oroCiudad: 1, oroTurno: 2 }), n("Todo tiene precio", { reclutaOro: 1, poblacion: 3 })], COSTE_ORO),
      R("picas", "Picas y Alabardas", "#9a8a6a", [n("Cuadros de picas", { defTipo: { piquero: 1 } }), n("Formación", { formacion: true }), n("Acero de contrato", { atq: 1 }), n("Veteranos de mil guerras", { veteranos: true }), n("Erizo de picas", { contra: { jinete: 1, jinete_pesado: 1 }, defTipo: { piquero: 1 } }), n("Tercio", { atq: 1, hpTipo: { piquero: 2 } })]),
      R("caballeria", "Caballería a Sueldo", "#b08a3a", [n("Remontas", { movTipo: { jinete: 1 } }), n("Pistoleros montados", { desbloquea: ["hostigador"] }), n("Herraduras de oro", { defTipo: { jinete: 1, jinete_pesado: 1 } }), n("Coraceros", { desbloquea: ["catafracto"] }), n("Caracola", { atqClase: { hostigador: 1 } }), n("Carga dorada", { cargaExtra: 2, hpTipo: { jinete_pesado: 2 } })]),
      R("magia", "Magia Contratada", "#8a7a5a", [n("Hechiceros a sueldo", { desbloquea: ["arcanista"] }), n("Polvo de oro", MAGIA), n("Alquimia", { ecoExtra: 1 }), n("Grandes contratos", { desbloquea: ["eco"] }), n("Hechizos de contrato", { atqTipo: { magia: 1 } }), n("Oro que piensa", { manaCiudad: 1, investigar: 1 })])
    ],
    "hijos-del-acero": [
      R("caza", "Caza Mayor", "#9fb0bd", [n("Trampas", { contra: { monstruo: 1 } }), n("Ballestas de torno", { atqClase: { ballestero: 1, cazador: 1 } }), n("Rastros", { vision: 1 }), n("Caza del Behemoth", { contra: { monstruo: 2, volador: 1 } }), n("Arpones", { alcClase: { ballestero: 1 } }), n("Cazadores de leyenda", { contra: { monstruo: 2, volador: 1, jinete_pesado: 1 } })]),
      R("acero", "Disciplina de Acero", "#7a8a94", [n("Disciplina", { hpClase: { guerrero: 1, paladin: 1, piquero: 1 } }), n("Formación", { formacion: true }), n("Acero", { atq: 1 }), n("Maestría", { veteranos: true }), n("Templado", { def: 1 }), n("Juramento de acero", { atq: 1, hp: 1 })]),
      R("monteros", "Monteros", "#8a7a5a", [n("Perros de presa", { movTipo: { jinete: 1 } }), n("Ballesteros montados", { desbloquea: ["hostigador"] }), n("Monterías", { atqTipo: { jinete: 1 } }), n("Perrera mayor", { poblacion: 3 }), n("Jauría", { contra: { tirador: 1 }, atqTipo: { jinete: 1 } }), n("Montería real", { movTipo: { jinete: 1 }, hpTipo: { jinete: 2 } })]),
      R("alquimia", "Alquimia de Caza", "#6a8a5a", [n("Venenos", { desbloquea: ["arcanista"] }), n("Bombas de humo", MAGIA), n("Fortines", { fortalezaDef: 1 }), n("Pólvora negra", { polvora: { cazador: true } }), n("Bilis de dragón", { atqTipo: { magia: 1 } }), n("Pólvora de caza", { polvora: { ballestero: true } })])
    ],
    "santos-de-asmodeo": [
      R("consagra", "Consagración", "#efe2b8", [n("Agua bendita", { cura: 1 }), n("Peregrinaje", { consagraRadio: 1 }), n("Relicarios", { curaCiudad: 2 }), n("Vigilia eterna", { hp: 2 }), n("Tierra santa", { consagraRadio: 1, cura: 1 }), n("Milagro", { hp: 2, curaCiudad: 2 })]),
      R("cruzada", "Cruzada", "#c84a3a", [n("Disciplina", { hpClase: { guerrero: 1, paladin: 1, piquero: 1 } }), n("Fe armada", { formacion: true }), n("Celo", { atq: 1 }), n("Mártires", { veteranos: true }), n("Penitencia", { atqClase: { guerrero: 1, paladin: 1 } }), n("Guerra santa", { atq: 1, veteranos: true })]),
      R("alba", "Oficio del Alba", "#d4b06a", [n("Oficiantes", { desbloquea: ["arcanista"] }), n("Luz del alba", MAGIA), n("Juicio", { contra: { monstruo: 2 } }), n("Ecos del Alba", { desbloquea: ["eco"] }), n("Sol que juzga", { atqTipo: { magia: 1 }, contra: { monstruo: 1 } }), n("Coro del Alba", { alcTipo: { magia: 1 }, manaTurno: 2 })]),
      R("vigilia", "Caballería de la Vigilia", "#c9b88a", [n("Caballeros de la Vigilia", { desbloquea: ["catafracto"] }), n("Herrajes benditos", { defTipo: { jinete_pesado: 1 } }), n("Hipogrifos", { desbloquea: ["jinete_alado"] }), n("Carga santa", { cargaExtra: 1 }), n("Alas de la Vigilia", { movTipo: { volador: 1 }, defTipo: { volador: 1 } }), n("Cruzada a caballo", { hpTipo: { jinete_pesado: 3 } })])
    ],
    nikaalia: [
      R("noche", "La Noche", "#c05aa8", [n("Ojos en la calle", { vision: 1 }), n("Pasos quedos", { movClase: { picaro: 1, capo: 1 } }), n("Cuchillos en la oscuridad", { heridos: 2 }), n("Noche cerrada", { atqClase: { picaro: 2, capo: 1 } }), n("Sin testigos", { heridos: 1, movTipo: { infanteria: 1 } }), n("La hora de los cuchillos", { atq: 1 })]),
      R("familias", "Las Familias", "#8a6a9a", [n("Sobornos", { soborno: 1 }), n("Deudas", { oroCiudad: 1 }), n("Protección", { poblacion: 3 }), n("El Don manda", { veteranos: true }), n("Omertà", { veteranos: true, def: 1 }), n("Imperio del crimen", { oroCiudad: 2, poblacion: 2 })], COSTE_ORO),
      R("bajovela", "Alquimia de Bajovela", "#7a5a8a", [n("Alambiques", { desbloquea: ["arcanista"] }), n("Vapores", MAGIA), n("Pólvora fina", { polvora: { arcanista: true } }), n("Murciélagos", { desbloquea: ["volador"] }), n("Humo negro", { atqTipo: { magia: 1 } }), n("Alas de la noche", { movTipo: { volador: 1 }, atqTipo: { volador: 1 } })]),
      R("correos", "Correos Nocturnos", "#5a4a6a", [n("Caballos negros", { movTipo: { jinete: 1 } }), n("Herraduras de fieltro", { defTipo: { jinete: 1 } }), n("Contrabando", { oroTurno: 2 }), n("Rutas del mercado", { investigar: 1 }), n("Contactos", { vision: 1 }), n("Red de correos", { oroTurno: 3, movTipo: { jinete: 1 } })])
    ],
    seosan: [
      R("escuelas", "Escuelas", "#5fc08f", [n("Kata", { atqClase: { guerrero: 1, maestro: 1 } }), n("Duelo", { duelo: 1 }), n("Zanshin", { defTipo: { infanteria: 1 } }), n("Maestría", { veteranos: true }), n("Un solo corte", { atqClase: { maestro: 1, guerrero: 1 } }), n("Camino de la espada", { duelo: 1, atq: 1 })]),
      R("senkai", "Templos de Senkai", "#c9862e", [n("Monjes", { desbloquea: ["arcanista"] }), n("Mantra", MAGIA), n("Trueno", { atqTipo: { magia: 1 } }), n("El Kirin", { desbloquea: ["kirin"] }), n("Tormenta", { alcTipo: { magia: 1 } }), n("Cielo de Senkai", { hpTipo: { volador: 3 }, atqTipo: { magia: 1 } })]),
      R("yumigaoka", "Yumigaoka", "#7a9a6a", [n("Arcos largos", { alcClase: { cazador: 1 } }), n("Yabusame", { desbloquea: ["hostigador"] }), n("Flecha silbante", { contra: { volador: 2 } }), n("Lluvia de flechas", { atqTipo: { tirador: 1 } }), n("Tiro desde la silla", { atqClase: { hostigador: 1 }, movClase: { hostigador: 1 } }), n("Arqueros del emperador", { alcTipo: { tirador: 1 } })]),
      R("tetsumura", "Tetsumura", "#3a5a4a", [n("Sombras", { movClase: { picaro: 1 } }), n("Venenos", { heridos: 1 }), n("Guardianes", { hpClase: { paladin: 2 } }), n("Gran escuela", { poblacion: 3 }), n("Paso de sombra", { heridos: 1, movClase: { picaro: 1 } }), n("Muralla de templos", { ciudadDef: 1, curaCiudad: 2 })])
    ],
    okran: [
      R("furia", "Furia", "#b8672e", [n("Sangre caliente", { furia: 1 }), n("Gritos de guerra", { atqClase: { berserker: 1, guerrero: 1 } }), n("Trofeos", { curaMatar: 2 }), n("Rabia del Behemoth", { furia: 1, hp: 1 }), n("Sin dolor", { hp: 1, curaMatar: 1 }), n("Berserkergang", { furia: 1, atqClase: { berserker: 1 } })]),
      R("clanes", "Clanes", "#8a5a2e", [n("Fuegos de campamento", { comidaCiudad: 1 }), n("Gran clan", { poblacion: 4 }), n("Asambleas", { veteranos: true }), n("Tierras Altas", { formacion: true }), n("Fiesta de la cosecha", { comidaCiudad: 1, cura: 1 }), n("Horda", { poblacion: 4 })], COSTE_ORO),
      R("lobos", "Lobos", "#7a6a5a", [n("Jinetes de lobo", { movTipo: { jinete: 1 } }), n("Arqueros de estepa", { desbloquea: ["hostigador"] }), n("Manada", { atqTipo: { jinete: 1 } }), n("Aullido", { contra: { tirador: 1, magia: 1 } }), n("Lobos grandes", { hpTipo: { jinete: 2 } }), n("La gran cacería", { movTipo: { jinete: 1 }, atqTipo: { jinete: 1 } })]),
      R("chamanes", "Chamanes de Hueso", "#d9c9a6", [n("Chamanes", { desbloquea: ["arcanista"] }), n("Polvo de huesos", MAGIA), n("Espíritus", { cura: 1 }), n("Ecos de los ancestros", { desbloquea: ["eco"] }), n("Tambores", { atqTipo: { magia: 1 } }), n("Voz de los muertos", { veteranos: true, manaTurno: 2 })])
    ],
    pelgiria: [
      R("hermandad", "Hermandad", "#36a9b0", [n("Botín", { oroCiudad: 1 }), n("Reparto justo", { reclutaOro: 1 }), n("Abordaje", { atqClase: { guerrero: 1, piquero: 1 } }), n("Puerto franco", { poblacion: 3 }), n("Código pirata", { veteranos: true }), n("Reina de los mares", { oroCiudad: 1, oroTurno: 3 })], COSTE_ORO),
      R("mar", "Mar", "#2a7a9a", [n("Velas rápidas", { barcoMov: 1 }), n("Andanadas", { barcoAtq: 1 }), n("Cascos forrados", { barcoDef: 1 }), n("Almirantazgo", { barcoAtq: 1, barcoMov: 1 }), n("Piratas de verdad", { barcoAtq: 1, barcoDef: 1 }), n("Flota negra", { barcoMov: 1, barcoAtq: 1 })]),
      R("polvora", "Pólvora", "#c9862e", [n("Cañoneros", { desbloquea: ["arcanista"] }), n("Mosquetes", { atqClase: { cazador: 1 } }), n("Granadas", MAGIA), n("Barriles mayores", { atqClase: { barrilero: 2 } }), n("Cañones ligeros", { alcClase: { arcanista: 1 } }), n("Pólvora de Cala Ronca", { atqClase: { cazador: 1, arcanista: 1 } })]),
      R("corsarios", "Corsarios", "#4a6a7a", [n("Contrabando", { oroTurno: 2 }), n("Vigías", { vision: 1 }), n("Ron", { cura: 1 }), n("Viejos lobos de mar", { veteranos: true }), n("Patentes de corso", { oroTurno: 2, reclutaOro: 1 }), n("Leyendas de taberna", { poblacion: 3, hp: 1 })])
    ],
    mravec: [
      R("panal", "Panal", "#b4c23a", [n("Larvas", { poblacion: 3 }), n("Guerreras", { hpClase: { guerrero: 2 } }), n("Enjambre", { formacion: true }), n("Reina madre", { poblacion: 4 }), n("Celdas reales", { hpClase: { paladin: 2 } }), n("Marea de quitina", { atqClase: { guerrero: 1, piquero: 1 } })]),
      R("devorar", "Devorar", "#7a8a2a", [n("Fauces", { devora: 1 }), n("Digestión", { curaMatar: 2 }), n("Mutación", { atqClase: { quimera: 1 } }), n("Adaptación", { devora: 1, hp: 1 }), n("Hambre", { curaMatar: 2, heridos: 1 }), n("Forma perfecta", { devora: 1, atqClase: { quimera: 1 } })]),
      R("alas", "Alas", "#c9b84a", [n("Avispas", { desbloquea: ["volador"] }), n("Zumbido", { movTipo: { volador: 1 } }), n("Libélulas", { desbloquea: ["jinete_alado"] }), n("Aguijones", { atqTipo: { volador: 1 } }), n("Nubes de avispas", { hpTipo: { volador: 2 } }), n("Cielo de la Reina", { movTipo: { volador: 1 }, atqTipo: { volador: 1 } })]),
      R("quitina", "Quitina", "#6a5a2a", [n("Sacerdotes", { desbloquea: ["arcanista"] }), n("Ácido", MAGIA), n("Caparazón", { def: 1 }), n("Escarabajos de guerra", { desbloquea: ["catafracto"] }), n("Ácido mayor", { atqTipo: { magia: 1 } }), n("Coraza viva", { def: 1, hp: 1 })])
    ],
    nernib: [
      R("taller", "Taller", "#c79a44", [n("Engranajes", { defClase: { automata: 1 } }), n("Cadena de montaje", { poblacion: 3 }), n("Calderas", { atqClase: { automata: 1, paladin: 1 } }), n("Forjados mayores", { hpClase: { automata: 3, paladin: 2 } }), n("Producción en serie", { poblacion: 3 }), n("Colosos", { atqClase: { automata: 2 }, defClase: { automata: 1 } })]),
      R("ingenieria", "Ingeniería", "#6fb6e0", [n("Artificieros", { desbloquea: ["arcanista"] }), n("Metralla", MAGIA), n("Transmutación", { transmutar: true, ecoExtra: 1 }), n("Espectros de éter", { desbloquea: ["eco"] }), n("Bobinas", { alcTipo: { magia: 1 } }), n("Condensadores", { atqTipo: { magia: 2 } })]),
      R("vapor", "Vapor", "#8a8a8a", [n("Velocípedos", { movTipo: { jinete: 1 } }), n("Ornitópteros", { desbloquea: ["volador"] }), n("Blindaje", { defTipo: { jinete: 1, volador: 1 } }), n("Acorazados", { barcoDef: 1, barcoAtq: 1 }), n("Calderas dobles", { movTipo: { jinete: 1, volador: 1 } }), n("Flota aérea", { hpTipo: { volador: 3 }, atqTipo: { volador: 1 } })]),
      R("oligarquia", "Oligarquía", "#6a7a8a", [n("Mercado", { oroCiudad: 1 }), n("Patentes", { investigar: 1 }), n("Fundiciones", { mineralCiudad: 1 }), n("Consejo", { veteranos: true }), n("Bolsa de Nernib", { oroCiudad: 1, oroTurno: 2 }), n("Cien patentes", { investigar: 2, veteranos: true })], COSTE_ORO)
    ],
    balutia: [
      R("legion", "Legión", "#c23a3a", [n("Disciplina", { hpClase: { guerrero: 1, paladin: 1, piquero: 1 } }), n("Testudo", { formacion: true }), n("Gladio", { atq: 1 }), n("Pretorianos", { veteranos: true }), n("Pilum", { atqClase: { guerrero: 1, condenado: 1 } }), n("Águilas de la Legión", { atq: 1, hp: 1 })]),
      R("provincias", "Provincias", "#9a6a3a", [n("Calzadas", { movTipo: { infanteria: 1 } }), n("Tributo", { tributo: 1 }), n("Colonias", { poblacion: 4 }), n("Ergástulas", { reclutaOro: 1 }), n("Censo", { oroCiudad: 1, comidaCiudad: 1 }), n("Pax de Balutia", { poblacion: 4, curaCiudad: 2 })], COSTE_ORO),
      R("caballeria", "Caballería", "#7a2a2a", [n("Équites", { movTipo: { jinete: 1 } }), n("Catafractos", { desbloquea: ["catafracto"] }), n("Lanzas largas", { cargaExtra: 1 }), n("Alas de caballería", { defTipo: { jinete: 1, jinete_pesado: 1 } }), n("Bardas de bronce", { hpTipo: { jinete_pesado: 3 } }), n("Clibanarios", { cargaExtra: 1, atqTipo: { jinete_pesado: 1 } })]),
      R("yunque", "El Yunque", "#c9862e", [n("Pirotecnistas", { desbloquea: ["arcanista"] }), n("Fuego griego", MAGIA), n("Arietes", { atqCiudad: 2 }), n("Ecos del Imperio", { desbloquea: ["eco"] }), n("Onagros", { atqCiudad: 2 }), n("Fuego del Imperio", { atqTipo: { magia: 1 }, alcTipo: { magia: 1 } })])
    ]
  };
  /* Escalones cruzados: piden haber llegado a un escalón en dos ramas. Se guardan en tech con su id (1 = dominado). */
  const X = (id, nombre, pide, ef) => ({ id, nombre, pide, ef, coste: COSTE_CRUCE, cruce: true });
  const CRUCES = {
    "caballeros-del-reino": [
      X("paladines", "Caballeros paladines", { orden: 3, armas: 2 }, { atqTipo: { jinete_pesado: 1 }, defTipo: { magia: 1 } }),
      X("castillos", "Castillos de caballería", { murallas: 3, cuadras: 3 }, { curaCiudad: 2, hpTipo: { jinete: 2, jinete_pesado: 2 } }),
      X("grifos_runas", "Grifos de runas", { cuadras: 4, armas: 3 }, { atqTipo: { volador: 2 } })
    ],
    "academia-arcana-de-dolbred": [
      X("fuego_vivo", "Fuego que cura", { brasa: 3, humores: 3 }, { curaMatar: 2, atqClase: { arcanista: 1 } }),
      X("bestias_sello", "Bestias selladas", { umbral: 3, bestias: 3 }, { defTipo: { volador: 2 } }),
      X("archicolegio", "El Archicolegio", { brasa: 5, umbral: 4 }, { atqTipo: { magia: 1 }, investigar: 2 })
    ],
    "trono-de-ceniza": [
      X("legion_eterna", "Legión eterna", { tanato: 3, huesos: 3 }, { poblacion: 3, cura: 1 }),
      X("jinetes_catedra", "Jinetes de la Cátedra", { catedra: 3, carrona: 3 }, { atqTipo: { volador: 1, magia: 1 } }),
      X("rey_ceniza", "El Rey de Ceniza", { tanato: 5, catedra: 4 }, { atq: 1, animaTurno: 3 })
    ],
    "compania-dorada": [
      X("caballeria_pagada", "Caballería bien pagada", { contratas: 3, caballeria: 3 }, { atqTipo: { jinete: 1, jinete_pesado: 1 } }),
      X("picas_magia", "Picas encantadas", { picas: 3, magia: 3 }, { atqTipo: { piquero: 1 } }),
      X("compania_inmortal", "La Compañía inmortal", { contratas: 5, picas: 4 }, { veteranos: true, poblacion: 4 })
    ],
    "hijos-del-acero": [
      X("cazadores_montados", "Cazadores a caballo", { caza: 3, monteros: 3 }, { contra: { monstruo: 1 }, alcClase: { hostigador: 1 } }),
      X("acero_alquimico", "Acero alquímico", { acero: 3, alquimia: 3 }, { atq: 1 }),
      X("orden_cazadores", "La Orden de los Cazadores", { caza: 5, acero: 4 }, { contra: { monstruo: 2, jinete_pesado: 1 } })
    ],
    "santos-de-asmodeo": [
      X("cruzados_alba", "Cruzados del Alba", { cruzada: 3, alba: 3 }, { contra: { monstruo: 1 }, atqTipo: { infanteria: 1 } }),
      X("vigilia_santa", "Vigilia santa", { consagra: 3, vigilia: 3 }, { hpTipo: { jinete_pesado: 2, volador: 2 }, cura: 1 }),
      X("juicio_final", "Juicio final", { alba: 5, cruzada: 4 }, { atq: 1, hp: 1 })
    ],
    "nikaalia": [
      X("asesinos_alquimistas", "Venenos de Bajovela", { noche: 3, bajovela: 3 }, { heridos: 2 }),
      X("mercado_noche", "Mercado de la noche", { familias: 3, correos: 3 }, { oroTurno: 4 }),
      X("reina_noche", "La Reina de la Noche", { noche: 5, familias: 4 }, { atq: 1, veteranos: true })
    ],
    "seosan": [
      X("samurai_montado", "Samuráis a caballo", { escuelas: 3, yumigaoka: 3 }, { atqClase: { hostigador: 1 }, duelo: 1 }),
      X("monjes_guerreros", "Monjes guerreros", { senkai: 3, tetsumura: 3 }, { hp: 1, cura: 1 }),
      X("kaishoto", "Las Cien Escuelas", { escuelas: 5, senkai: 4 }, { atq: 1, poblacion: 2 })
    ],
    "okran": [
      X("lobos_furia", "Lobos rabiosos", { furia: 3, lobos: 3 }, { atqTipo: { jinete: 1 }, curaMatar: 1 }),
      X("chamanes_clan", "Consejo de chamanes", { clanes: 3, chamanes: 3 }, { manaCiudad: 1, veteranos: true }),
      X("behemoth", "Hijos del Behemoth", { furia: 5, clanes: 4 }, { hp: 2, furia: 1 })
    ],
    "pelgiria": [
      X("abordaje_polvora", "Abordaje con pólvora", { hermandad: 3, polvora: 3 }, { atqClase: { guerrero: 1, barrilero: 1 } }),
      X("corsarios_mar", "Corsarios del rey", { mar: 3, corsarios: 3 }, { barcoAtq: 1, oroTurno: 2 }),
      X("cala_ronca", "El trono de Cala Ronca", { mar: 5, hermandad: 4 }, { barcoAtq: 1, barcoMov: 1, poblacion: 3 })
    ],
    "mravec": [
      X("enjambre_alado", "Enjambre alado", { panal: 3, alas: 3 }, { poblacion: 2, atqTipo: { volador: 1 } }),
      X("quimera_acida", "Quimeras ácidas", { devorar: 3, quitina: 3 }, { atqClase: { quimera: 1 }, def: 1 }),
      X("satrapia", "La Satrapía eterna", { panal: 5, devorar: 4 }, { hp: 2, poblacion: 3 })
    ],
    "nernib": [
      X("automatas_vapor", "Autómatas de vapor", { taller: 3, vapor: 3 }, { movClase: { automata: 1 }, hpClase: { automata: 2 } }),
      X("eter_patentado", "Éter patentado", { ingenieria: 3, oligarquia: 3 }, { manaCiudad: 1, ecoExtra: 1 }),
      X("ciudadela", "La Ciudadela eterna", { taller: 5, ingenieria: 4 }, { atq: 1, def: 1 })
    ],
    "balutia": [
      X("legion_montada", "Legión montada", { legion: 3, caballeria: 3 }, { formacion: true, hpTipo: { jinete: 2 } }),
      X("asedio_imperial", "Asedio imperial", { provincias: 3, yunque: 3 }, { atqCiudad: 2 }),
      X("emperador", "La mirada del Emperador", { legion: 5, provincias: 4 }, { atq: 1, veteranos: true, poblacion: 2 })
    ]
  };

  // Con qué empieza cada ejército dominado
  const INICIAL = {
    "caballeros-del-reino": { orden: 1 }, "academia-arcana-de-dolbred": { brasa: 2 }, "trono-de-ceniza": { tanato: 2 }, "compania-dorada": { picas: 1 },
    "hijos-del-acero": { acero: 1 }, "santos-de-asmodeo": { cruzada: 1 }, nikaalia: { noche: 1 }, seosan: { escuelas: 1 }, okran: { furia: 1 },
    pelgiria: { hermandad: 1 }, mravec: { devorar: 1 }, nernib: { ingenieria: 1 }, balutia: { legion: 1 }
  };

  const real = f => (D && D.faccionReal ? D.faccionReal(f) : f);
  const ramas = f => ARBOLES[real(f)] || ARBOLES["caballeros-del-reino"];
  const cruces = f => CRUCES[real(f)] || [];
  const cruce = (f, id) => cruces(f).find(c => c.id === id) || null;
  /* ¿Se puede aprender ya esta cruce? Devuelve lo que falta (null si nada) */
  function faltaCruce(f, tech, id) {
    const c = cruce(f, id);
    if (!c) return "Eso no existe.";
    if (tech[id]) return "Ya lo dominas.";
    const falta = Object.keys(c.pide).filter(r => (tech[r] || 0) < c.pide[r]);
    return falta.length ? `Hace falta ${falta.map(r => `${rama(f, r).nombre} ${["I", "II", "III", "IV", "V", "VI"][c.pide[r] - 1]}`).join(" y ")}.` : null;
  }
  /* Las tropas que el saber de un ejército puede llegar a desbloquear */
  function posibles(f) {
    const out = new Set();
    ramas(f).forEach(r => r.escalones.forEach(e => (e.ef.desbloquea || []).forEach(c => out.add(c))));
    cruces(f).forEach(c => (c.ef.desbloquea || []).forEach(x => out.add(x)));
    return Array.from(out);
  }
  const rama = (f, id) => ramas(f).find(r => r.id === id) || null;
  function techInicial(f) {
    const t = {};
    ramas(f).forEach(r => { t[r.id] = 0; });
    Object.assign(t, INICIAL[real(f)] || {});
    return t;
  }
  const costeDe = (f, id, nivel) => { const c = cruce(f, id); if (c) return Object.assign({}, c.coste); const r = rama(f, id); return Object.assign({}, (r ? r.coste : COSTE)[Math.min(5, nivel)]); };

  /* Junta los efectos de todo lo dominado. Números: se suman. Objetos: se suman campo a campo. Listas: se unen. Sí/no: basta uno. */
  // Lo que se suma si se aprende dos veces (en dos escalones o en un cruce)
  const APILA = { veteranos: 1, formacion: 1 };
  function juntar(a, b) {
    Object.keys(b).forEach(k => {
      const v = b[k];
      if (typeof v === "number") a[k] = (a[k] || 0) + v;
      else if (Array.isArray(v)) a[k] = Array.from(new Set((a[k] || []).concat(v)));
      else if (v && typeof v === "object") { a[k] = a[k] || {}; juntar(a[k], v); }
      else if (v === true) a[k] = APILA[k] ? (a[k] === true ? 1 : a[k] || 0) + 1 : true;
    });
    return a;
  }
  function efectos(f, tech) {
    const out = {};
    ramas(f).forEach(r => { const nv = (tech && tech[r.id]) || 0; for (let i = 0; i < nv && i < r.escalones.length; i++) juntar(out, r.escalones[i].ef); });
    cruces(f).forEach(c => { if (tech && tech[c.id]) juntar(out, c.ef); });
    // El área de la magia no se suma: vale la mejor
    if (out.area) out.area = 0.75;
    return out;
  }
  const dominados = tech => Object.values(tech || {}).reduce((a, b) => a + (b || 0), 0);
  const ESCALONES = 6;

  /* --- El texto de un escalón, a partir de sus efectos y con las tropas de ese ejército --- */
  const TIPO_NOMBRE = { infanteria: "la infantería", piquero: "los piqueros", tirador: "los tiradores", jinete: "los jinetes", jinete_pesado: "la caballería pesada", volador: "los voladores", magia: "los magos", monstruo: "las bestias y los monstruos", barco: "los barcos", asedio: "las máquinas de asedio" };
  const STAT = { hp: "de vida", atq: "de ataque", def: "de defensa", mov: "de movimiento", alc: "de alcance" };
  function nombres(f, clases) {
    const l = clases.map(cl => (D.tropa ? D.tropa(f, cl).nombre : cl));
    return l.length > 1 ? `${l.slice(0, -1).join(", ")} y ${l[l.length - 1]}` : l[0];
  }
  /* ya: lo que el ejército tendría antes de este escalón, para decir «otro +1» cuando se suma */
  function describir(f, ef, ya) {
    ya = ya || {};
    const fr = [];
    const disponibles = cl => { const F = D.FACCIONES[real(f)]; return D.CLASES_BASE.includes(cl) || (F.clasesExtra || []).includes(cl) || posibles(f).includes(cl); };
    // Lo que va para todas las tropas, en una sola frase
    const globales = Object.keys(STAT).filter(k => ef[k]).map(k => `+${ef[k]} ${STAT[k]}`);
    if (globales.length) fr.push(`Todas tus tropas: ${globales.length > 1 ? `${globales.slice(0, -1).join(", ")} y ${globales[globales.length - 1]}` : globales[0]}.`);
    Object.keys(STAT).forEach(k => {
      const o = ef[`${k}Clase`];
      if (o) { const cls = Object.keys(o).filter(disponibles); const vals = new Set(cls.map(c => o[c])); if (cls.length) fr.push(vals.size === 1 ? `+${o[cls[0]]} ${STAT[k]} para ${nombres(f, cls)}.` : cls.map(c => `+${o[c]} ${STAT[k]} para ${nombres(f, [c])}.`).join(" ")); }
      const t = ef[`${k}Tipo`];
      if (t) Object.keys(t).forEach(tp => fr.push(`+${t[tp]} ${STAT[k]} para ${TIPO_NOMBRE[tp] || tp}.`));
    });
    if (ef.contra) Object.keys(ef.contra).forEach(tp => fr.push(`+${ef.contra[tp]} de ataque contra ${TIPO_NOMBRE[tp] || tp}.`));
    if (ef.vision) fr.push(`Tus tropas ven ${ef.vision === 1 ? "una casilla" : `${ef.vision} casillas`} más lejos.`);
    if (ef.desbloquea) fr.push(`Permite entrenar ${nombres(f, ef.desbloquea)}.`);
    if (ef.formacion) fr.push(ya.formacion ? "La formación da otro +1 de defensa." : "Quien tiene al lado un aliado de su misma tropa gana +1 de defensa.");
    if (ef.veteranos) fr.push(ya.veteranos ? "Los veteranos o mejores ganan otro +1 de ataque y +1 de defensa." : "Los veteranos o mejores ganan +1 de ataque y +1 de defensa.");
    if (ef.heridos) fr.push(`+${ef.heridos} de ataque contra tropas heridas.`);
    if (ef.area) fr.push("El golpe de tus magos alcanza al 75 % a los que rodean al objetivo y lo frena un turno.");
    if (ef.transmutar) fr.push("Tus magos pueden cambiar el terreno de una casilla por 3 de maná.");
    if (ef.ecoExtra) fr.push(`Cada edificio de economía rinde ${ef.ecoExtra} más.`);
    if (ef.animaBaja) fr.push(`Cada enemigo que cae te deja ${ef.animaBaja} de Ánima.`);
    if (ef.cura) fr.push(`Tus tropas se curan ${ef.cura} más cada turno.`);
    if (ef.curaCiudad) fr.push(`En tus ciudades se curan ${ef.curaCiudad} más.`);
    if (ef.curaMatar) fr.push(`Quien mata a un enemigo se cura ${ef.curaMatar}.`);
    if (ef.reanimar) fr.push("Tus tropas pueden levantar a un caído que tengan al lado por 3 de Ánima. Los reanimados no cuentan para el límite de tropas.");
    if (ef.inmortalidad) fr.push("Al acabar la guerra, la mitad de tus soldados caídos vuelve.");
    ["oro", "comida", "mana", "materiales", "mineral"].forEach(k => { if (ef[`${k}Ciudad`]) fr.push(`+${ef[`${k}Ciudad`]} de ${D.RECURSO_NOMBRE[k].toLowerCase()} por ciudad.`); });
    ["oro", "mana", "anima"].forEach(k => { if (ef[`${k}Turno`]) fr.push(`+${ef[`${k}Turno`]} de ${D.RECURSO_NOMBRE[k].toLowerCase()} por turno.`); });
    if (ef.poblacion) fr.push(`+${ef.poblacion} al límite de tropas.`);
    if (ef.reclutaOro) fr.push(`Entrenar tropas cuesta ${ef.reclutaOro} de oro menos.`);
    if (ef.fortalezaDef) fr.push(`+${ef.fortalezaDef} de defensa en las ciudades con Fortaleza.`);
    if (ef.ciudadDef) fr.push(`+${ef.ciudadDef} de defensa a quien guarnece tus ciudades.`);
    if (ef.cargaExtra) fr.push(`La carga de la caballería pega ${ef.cargaExtra} más.`);
    if (ef.atqCiudad) fr.push(`+${ef.atqCiudad} de ataque contra quien defiende una ciudad o una fortaleza.`);
    if (ef.consagraRadio) fr.push("Consagras una casilla más alrededor.");
    if (ef.soborno) fr.push(`Sobornar cuesta ${ef.soborno} de oro menos.`);
    if (ef.furia) fr.push(`La furia llega a +${ef.furia} más.`);
    if (ef.devora) fr.push("Cada tropa que devora guarda un rasgo más.");
    if (ef.tributo) fr.push(`El Tributo entrega ${ef.tributo} tropa más.`);
    if (ef.duelo) fr.push(`El Duelo da +${ef.duelo} más.`);
    if (ef.barcoMov) fr.push(`Tus barcos: +${ef.barcoMov} de movimiento.`);
    if (ef.barcoAtq) fr.push(`Tus barcos: +${ef.barcoAtq} de ataque.`);
    if (ef.barcoDef) fr.push(`Tus barcos: +${ef.barcoDef} de defensa.`);
    if (ef.investigar) fr.push(`Cada escalón cuesta ${ef.investigar} de maná menos.`);
    if (ef.polvora) fr.push(`${nombres(f, Object.keys(ef.polvora))} pasa${Object.keys(ef.polvora).length > 1 ? "n" : ""} a usar pólvora.`);
    return fr.join(" ");
  }

  raiz.FracturaSaber = { ARBOLES, CRUCES, INICIAL, COSTE, ESCALONES, ramas, rama, cruces, cruce, faltaCruce, posibles, techInicial, costeDe, efectos, juntar, dominados, describir };
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.FracturaSaber;
})(typeof window !== "undefined" ? window : globalThis);
