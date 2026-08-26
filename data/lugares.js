window.LUGARES = [
  {
    id: "thanea",
    title: "Thanea",
    category: "Lugares",
    tags: ["continente"],
    summary: "El continente más antiguo del mundo y el menos explorado.",
    region: "",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: ["Rasganorte", "Galadhel", "Dimveil"],
    content: `
      <p>El continente más antiguo del mundo y el menos explorado. Thanea une el polo
      norte y el polo sur mediante un inmenso supercontinente que actúa como una
      columna vertebral para el planeta. Se trata de una tierra salvaje donde las
      leyes de la naturaleza parecen distintas a las del resto del mundo. Ningún
      reino ha conseguido conquistarla y pocas expediciones regresan.</p>
    `
  },
  {
    id: "rasganorte",
    title: "Rasganorte",
    category: "Lugares",
    tags: ["región", "thanea"],
    summary: "Las tierras eternamente congeladas de Thanea.",
    region: "Thanea",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: ["Bahía Rota", "Vardun Helada", "Skalgrimr", "Mil Hogueras", "Ciudadela de Hueso", "Glaciar Eterno", "Bosque de Escarcha", "Fiordo de los Ahogados"],
    content: `
      <p>Las tierras eternamente congeladas de Thanea reciben este nombre por las
      grietas profundas que cruzan el hielo de costa a costa, cicatrices que los
      goliats locales atribuyen a alguna violencia antigua que el propio continente
      todavía no ha terminado de olvidar. Las ventiscas nunca dejan de soplar por completo, y bajo
      el hielo descansan civilizaciones perdidas mucho más antiguas que la
      humanidad, restos que ocasionalmente el deshielo estacional deja al
      descubierto antes de que la nieve vuelva a cubrirlos. Muy al norte, donde
      el hielo se hace más profundo, los goliats evitan las zonas que Borealis
      marca con su aliento gélido. Nadie ha visto un segundo ejemplar de ese
      titán cuadrúpedo, pero las tormentas de nieve repentinas que arrasan la
      zona bastan para que nadie ponga en duda su existencia.</p>
      <p>Pese a su clima hostil, Rasganorte alberga una cultura propia bien
      asentada, clanes goliat que se reúnen cada verano en el Campamento de las Mil
      Hogueras y asentamientos permanentes como Bahía Rota o la sombría Ciudadela de
      Hueso. A diferencia del resto de Thanea, aquí sí llegan comerciantes
      ocasionales dispuestos a arriesgarse por pieles, marfil de bestias heladas y
      los pocos objetos que la Ciudadela recupera de las ruinas bajo el hielo.</p>
    `
  },
  {
    id: "bahia-rota",
    title: "Bahía Rota",
    category: "Lugares",
    tags: ["aldea", "rasganorte", "thanea"],
    summary: "El único asentamiento permanente en la costa de Rasganorte, una aldea de balleneros que sobrevive donde ni los Goliats se molestan en reclamar tierra.",
    region: "Rasganorte, Thanea",
    gobierno: "Consejo de capitanes balleneros",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Un puñado de casas bajas encajadas entre acantilados de hielo, construidas
      para resistir vientos que derribarían cualquier otra estructura. Su puerto,
      congelado más de medio año, solo se abre a la caza de ballenas y focas durante
      la breve temporada en que el hielo cede lo suficiente como para botar los
      barcos.</p>
      <p>Los Goliats nunca han intentado expulsar a los balleneros de Bahía Rota,
      ya que para un pueblo que considera absurdo poseer tierra fija, una franja de roca
      helada azotada por el mar no vale ni la discusión. El resultado es una
      convivencia distante pero sin conflicto, con intercambios ocasionales de aceite
      y pieles cuando alguna caravana nómada se acerca a la costa.</p>
    `
  },
  {
    id: "vardun-helada",
    title: "Vardun Helada",
    category: "Lugares",
    tags: ["ciudad", "rasganorte", "thanea", "ruinas"],
    summary: "Ruinas de una ciudad sepultada bajo el hielo de Rasganorte, restos de una civilización anterior a los Goliats que nadie ha logrado identificar con certeza.",
    region: "Rasganorte, Thanea",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El hielo de Rasganorte conserva Vardun casi intacta bajo varios metros de
      nieve compacta, con torres y murallas visibles solo cuando una ventisca
      particularmente violenta arranca la capa superior el tiempo suficiente para que
      algún viajero afortunado, o imprudente, vea sus formas. Nadie ha excavado la
      ciudad por completo. El frío mismo se encarga de sepultarla de nuevo cada vez
      que alguien lo intenta.</p>
      <p>Los Goliats evitan Vardun por costumbre más que por miedo declarado, aunque
      sus historias orales mencionan algo que "todavía sueña" bajo el hielo. Los
      pocos eruditos de Dolbred que han intentado expediciones formales no suelen
      regresar con más que bocetos apresurados y teorías contradictorias sobre a qué
      pueblo perteneció la ciudad.</p>
    `
  },
  {
    id: "skalgrimr",
    title: "Skalgrimr",
    category: "Lugares",
    tags: ["ciudad", "rasganorte", "thanea", "ruinas"],
    summary: "Fortaleza en ruinas tallada directamente en un glaciar de Rasganorte, distinta en arquitectura y origen a Vardun Helada.",
    region: "Rasganorte, Thanea",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>A diferencia de Vardun, tallada en piedra, Skalgrimr fue esculpida
      directamente en el cuerpo de un glaciar que conserva sus salones congelados
      desde incontables generaciones, con columnas de hielo azul tan antiguo que
      apenas transmite luz. Nadie sabe si el glaciar creció sobre una ciudad
      existente o si sus constructores tallaron la fortaleza en hielo desde el
      principio.</p>
      <p>Los Goliats que se aventuran cerca describen sonidos que ningún viento
      debería producir, crujidos que parecen casi palabras, aunque ningún clan admite
      abiertamente haber escuchado con suficiente claridad para entenderlas. Quienes
      buscan gloria mencionan Skalgrimr como la prueba definitiva de resistencia;
      quienes buscan sobrevivir la evitan por completo.</p>
    `
  },
  {
    id: "campamento-de-las-mil-hogueras",
    title: "Mil Hogueras",
    category: "Lugares",
    tags: ["aldea", "rasganorte", "thanea"],
    summary: "Punto de reunión estacional donde los clanes Goliat se congregan cada verano, el único asentamiento de Rasganorte que no pretende ser permanente.",
    region: "Rasganorte, Thanea",
    gobierno: "Consejo temporal de jefes de clan",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Cuando el deshielo de verano abre un breve respiro entre tormentas, docenas
      de clanes Goliat convergen en el mismo valle protegido, levantando durante
      unas semanas el campamento más grande que Rasganorte ve en todo el año.
      Ninguna hoguera se enciende dos veranos seguidos en el mismo punto exacto,
      pero el nombre se mantiene porque el número, más o menos, siempre se
      cumple.</p>
      <p>Aquí se resuelven disputas entre clanes, se organizan competencias de
      resistencia que definen el prestigio social del año siguiente, y los
      pocos comerciantes de Bahía Rota que se atreven a subir
      tanto hacia el interior intercambian herramientas por pieles y aceite. Cuando
      termina el deshielo, el campamento desaparece tan completamente como si nunca
      hubiera existido. Ese es, precisamente, el punto.</p>
    `
  },
  {
    id: "ciudadela-de-hueso",
    title: "Ciudadela de Hueso",
    category: "Lugares",
    tags: ["ciudad", "rasganorte", "thanea", "ruinas"],
    summary: "Restos de una tercera ciudad perdida de Rasganorte, construida enteramente con huesos de criaturas colosales que ya no existen en el mundo conocido.",
    region: "Rasganorte, Thanea",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Donde Vardun usa piedra y Skalgrimr usa hielo, la Ciudadela de Hueso emplea
      huesos, arcos de costillas que sostienen techos enteros, columnas hechas de
      vértebras apiladas más grandes que cualquier ballena que hoy surque los mares
      de Rasganorte. Ningún erudito ha identificado con certeza a qué criaturas
      pertenecieron esos huesos, aunque casi todos coinciden en que debieron ser
      colosales incluso para los estándares de esta región.</p>
      <p>Los balleneros de Bahía Rota evitan mencionar la Ciudadela en voz alta
      durante la temporada de caza, una superstición que ni ellos mismos saben
      explicar con claridad, aunque más de uno admite en privado que preferiría no
      descubrir qué cazó originalmente a esas criaturas.</p>
    `
  },
  {
    id: "galadhel",
    title: "Galadhel",
    category: "Lugares",
    tags: ["región", "thanea"],
    summary: "???.",
    region: "Thanea",
    gobierno: "???",
    religionPredominante: "",
    lugaresDestacados: ["Korva", "Zynd", "Veylra", "Thalwyn"],
    content: `
      <p>???.</p>
    `
  },
  {
    id: "korva",
    title: "Korva",
    category: "Lugares",
    tags: ["reino", "galadhel"],
    summary: "???.",
    region: "Galadhel, Thanea",
    gobierno: "???",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>???.</p>
    `
  },
  {
    id: "zynd",
    title: "Zynd",
    category: "Lugares",
    tags: ["reino", "galadhel"],
    summary: "???.",
    region: "Galadhel, Thanea",
    gobierno: "???",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>???.</p>
    `
  },
  {
    id: "veylra",
    title: "Veylra",
    category: "Lugares",
    tags: ["reino", "galadhel"],
    summary: "???.",
    region: "Galadhel, Thanea",
    gobierno: "???",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>???.</p>
    `
  },
  {
    id: "thalwyn",
    title: "Thalwyn",
    category: "Lugares",
    tags: ["reino", "galadhel"],
    summary: "???.",
    region: "Galadhel, Thanea",
    gobierno: "???",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>???.</p>
    `
  },
  {
    id: "dimveil",
    title: "Dimveil",
    category: "Lugares",
    tags: ["región", "thanea", "nigredo"],
    summary: "El extremo sur de Thanea, una tierra consumida por el Nigredo.",
    region: "Thanea",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: ["Corxia"],
    content: `
      <p>???.</p>
    `
  },
  {
    id: "corxia",
    title: "Corxia",
    category: "Lugares",
    tags: ["ciudad", "dimveil"],
    summary: "La única ciudad conocida de Dimveil.",
    region: "Dimveil, Thanea",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>La única ciudad conocida de Dimveil. Construida sobre inmensas plataformas de
      piedra para evitar el contacto directo con el Nigredo, sirve como el último
      puesto de avanzada antes del verdadero sur del continente.</p>
    `
  },
  {
    id: "gylas",
    title: "Gylas",
    category: "Lugares",
    tags: ["continente"],
    summary: "El continente más poblado del mundo conocido y escenario principal de la campaña.",
    region: "",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: ["Roah", "Derrovia", "Genevia"],
    content: `
      <p>El continente más poblado del mundo conocido y escenario principal de la
      campaña. A diferencia de Thanea, aquí las naciones prosperan, comercian y
      guerrean constantemente, sin el manto de misterio que cubre el continente
      sur. Sus fronteras cambian con cada generación, y sus conflictos políticos,
      más que cualquier fuerza natural, determinarán el futuro del mundo.</p>
      <p>Gylas se divide en tres grandes regiones con carácter propio, la fría y
      montañosa Roah, hogar de teocracias, bárbaros y el imperio de monstruos de
      Osses; la boscosa Derrovia, fragmentada entre reinos de caballería, satrapías
      insectoides y las Marchas Nobrianas; y el archipiélago de Genevia, dominio de
      piratas reformados, buceadores de perlas y el poderoso reino naval de
      Pelgiria. Ningún poder único domina el continente entero, y esa fragmentación
      constante es, para muchos eruditos, la razón por la que Gylas nunca conoce
      una paz duradera.</p>
    `
  },
  {
    id: "roah",
    title: "Roah",
    category: "Lugares",
    tags: ["región", "gylas"],
    summary: "Las tierras del norte de Gylas.",
    region: "Gylas",
    gobierno: "",
    religionPredominante: "Kaneísmo",
    lugaresDestacados: ["Asmodeo", "Okran", "Osses", "Dolbred"],
    content: `
      <p>Las tierras del norte de Gylas. Un territorio donde conviven fanatismo
      religioso, pueblos bárbaros y antiguas potencias monstruosas. Ningún poder
      único gobierna Roah en su conjunto: Asmodeo predica que la humanidad es la
      única raza legítima justo al lado de Osses, el mayor imperio de monstruos y
      no-muertos del mundo conocido, y ninguno de los dos ha logrado imponerse sobre
      el otro pese a siglos de hostilidad abierta.</p>
      <p>Entre esos dos extremos sobreviven Okran, cuyos clanes bárbaros no rinden
      cuentas a nadie más que a sí mismos, y Dolbred, un reino de académicos arcanos
      que prefiere mantenerse al margen de cualquier conflicto que no amenace
      directamente el estudio de la magia. Los viajeros que cruzan Roah de punta a
      punta suelen decir que ningún otro territorio del mundo cambia tanto de
      carácter en tan poca distancia.</p>
    `
  },
  {
    id: "asmodeo",
    title: "Asmodeo",
    category: "Lugares",
    tags: ["reino", "roah", "teocracia"],
    summary: "Una teocracia humana gobernada por la Iglesia de Asmodeo.",
    region: "Roah, Gylas",
    gobierno: "Teocracia (Iglesia de Asmodeo)",
    religionPredominante: "Iglesia de Asmodeo",
    lugaresDestacados: ["Ithranor (capital)", "Catedral de la Vigilia", "Catedral del Alba", "Catedral de la Pureza", "Fyre", "Semilla del Alba", "Vigía del Camino", "Guarda de Fyre", "Yermo Cenizo", "Bosque de las Confesiones", "Río Carmesí"],
    content: `
      <p>Una teocracia humana gobernada por la Iglesia de Asmodeo. Sus habitantes
      consideran a la humanidad la única raza legítima y desconfían profundamente de
      cualquier otra especie inteligente. Sus clérigos y paladines mantienen un
      estricto control religioso y su influencia se extiende mucho más allá de sus
      fronteras.</p>
      <p>Su capital, Ithranor, funciona como corazón administrativo y espiritual del
      reino a la vez, y ningún edicto religioso importante se promulga sin pasar
      primero por sus salones. Pese a su rigidez interna, Asmodeo mantiene relaciones
      diplomáticas activas —aunque tensas— con casi todos sus vecinos de Roah,
      conscientes de que el aislamiento total debilitaría su influencia más de lo que
      la protegería.</p>
    `
  },
  {
    id: "okran",
    title: "Okran",
    category: "Lugares",
    tags: ["reino", "roah", "bárbaros"],
    summary: "Una vasta región ocupada por clanes bárbaros.",
    region: "Roah, Gylas",
    gobierno: "Clanes bárbaros",
    religionPredominante: "",
    lugaresDestacados: ["Vornhaal (capital)", "Grimhold", "Colmillo Negro", "Círculo de Huesos", "Puesto de Hueso Roto", "Tierras Altas de Okran", "La Estepa Quebrada", "Bosque de los Ancestros"],
    content: `
      <p>Una vasta región ocupada por clanes bárbaros. Sus habitantes respetan
      únicamente la fuerza y sobreviven en uno de los climas más hostiles del
      continente. En algún punto de ese territorio vive Behemoth, un coloso
      solitario cuya fuerza nunca ha sido medida con precisión, y más de un
      guerrero ha intentado ganarse un nombre retándolo sin volver jamás para
      contarlo. Aunque el resto del mundo los considera salvajes, poseen una
      tradición oral y una cultura ancestral sorprendentemente rica.</p>
      <p>No existe una capital fija en el sentido tradicional: Vornhaal, el gran salón
      donde los clanes se reúnen, cambia de tamaño e importancia según la estación y
      qué clan domine el liderazgo del momento. Los orcos que habitan Okran han
      aprendido a convivir con un territorio que no perdona errores, y esa misma
      dureza compartida —más que cualquier tratado formal— es lo que mantiene unidos a
      clanes que, de otro modo, rara vez se pondrían de acuerdo en algo.</p>
    `
  },
  {
    id: "guardia-de-colmillo",
    title: "Guardia de Colmillo",
    category: "Lugares",
    tags: ["aldea", "fortaleza", "osses", "roah", "monstruos"],
    summary: "Guarnición del norte de Osses que vigila la frontera con los clanes orcos de Okran, línea de contención que ninguna de las dos partes ha logrado desplazar en generaciones.",
    region: "Osses, Roah, Gylas",
    gobierno: "Guarnición de la Unión de Osses",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>La línea que separa Osses de los clanes orcos de Okran apenas se ha movido
      en generaciones, y Guardia de Colmillo existe para que siga siendo así.
      Ghouls, hombres bestia y soldados vivos rotan en sus torres de vigilancia,
      atentos a cualquier movimiento de guerra que cruce desde las Tierras Altas
      vecinas.</p>
      <p>Las escaramuzas son frecuentes pero pocas veces decisivas, más una prueba de
      resistencia mutua que un intento real de conquista. Los veteranos de ambos
      lados han aprendido a reconocerse por nombre, y algunos incluso comercian en
      secreto durante las treguas no oficiales que siguen a cada choque.</p>
    `
  },
  {
    id: "el-trueque-frio",
    title: "El Trueque Frío",
    category: "Lugares",
    tags: ["aldea", "osses", "roah", "monstruos", "mercante"],
    summary: "Puesto de intercambio en la frontera norte de Osses donde comerciantes monstruosos y clanes de Okran negocian pese a la desconfianza mutua que define la relación entre ambos pueblos.",
    region: "Osses, Roah, Gylas",
    gobierno: "Consejo mixto, renovado cada temporada",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Ni Osses ni Okran reclaman abiertamente El Trueque Frío como territorio
      propio, un vacío legal que ambos aprovechan para comerciar sin comprometer
      su orgullo. Pieles y hierro de los clanes cambian de manos por hierbas
      curativas y trabajos de herrería que solo los artesanos monstruosos de Osses
      dominan con esa precisión.</p>
      <p>Un consejo mixto, renovado cada temporada por representantes de ambos
      lados, resuelve las disputas antes de que escalen a algo más serio. La
      desconfianza nunca desaparece del todo, pero el beneficio mutuo ha bastado
      hasta ahora para mantener el puesto funcionando pese a generaciones de
      conflicto fronterizo.</p>
    `
  },
  {
    id: "osario-de-la-frontera",
    title: "Osario de la Frontera",
    category: "Lugares",
    tags: ["aldea", "osses", "roah", "monstruos", "no-muertos"],
    summary: "Asentamiento construido sobre el campo de batalla de un antiguo choque fronterizo con Okran, donde los caídos de ambos bandos siguen sirviendo a la Unión como centinelas no muertos.",
    region: "Osses, Roah, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Generaciones atrás, una batalla fronteriza dejó tantos cuerpos sin
      recoger que la Unión decidió, simplemente, levantar un asentamiento sobre
      ellos y aprovechar lo que quedaba. Los caídos de aquel choque, orcos y
      monstruos por igual, siguen cumpliendo servicio como centinelas no muertos
      que patrullan los límites del pueblo sin necesidad de descanso ni relevo.</p>
      <p>Los habitantes vivos de Osario de la Frontera conviven con esa vigilancia
      permanente sin mostrar demasiada incomodidad, acostumbrados a un pueblo
      donde los muertos de la guerra nunca terminaron de retirarse del puesto que
      ocupaban cuando cayeron.</p>
    `
  },
  {
    id: "osses",
    title: "Osses",
    category: "Lugares",
    tags: ["reino", "roah", "monstruos", "no-muertos"],
    summary: "El mayor imperio de monstruos y no muertos del mundo.",
    region: "Roah, Gylas",
    gobierno: "Unión de Osses",
    religionPredominante: "",
    lugaresDestacados: ["Sepulkrad (capital)", "Karnhold", "Fauces Grises", "Cátedra de Ceniza", "Fosonegro", "Descanso de los Vivos", "El Pantano Marchito", "Bosque de Huesos Blancos", "El Lago Sin Fondo", "Carroñada", "Fuerte Desdén", "Molino de Huesos", "Guardia de Colmillo", "El Trueque Frío", "Osario de la Frontera", "Corazón de Piedra", "Vado Pálido"],
    content: `
      <p>El mayor imperio de monstruos y no muertos del mundo. Fundado sobre la idea
      de que la humanidad representa la mayor amenaza para el resto de las especies,
      Osses reúne innumerables razas monstruosas bajo un mismo estandarte. Sus
      habitantes desprecian profundamente a los humanos, aunque mantienen relaciones
      diplomáticas con otros reinos cuando les resulta conveniente. Se dice que La
      Errante, una ballena legendaria a la que nadie ha conseguido localizar dos
      veces, fue la primera criatura no-muerta en surgir sin ayuda de nigromante
      alguno, y el imperio la señala como prueba de que la no-muerte no depende de
      nadie externo a ella misma.</p>
      <p>Sepulkrad, su capital, resume en una sola ciudad la naturaleza de todo el
      imperio. Construida sobre catacumbas ancestrales, alberga a vivos y no-muertos
      por igual bajo un acuerdo social que en cualquier otro reino resultaría
      impensable. El Bosque de Huesos Blancos tampoco es terreno seguro para
      forasteros. Ekizias, un árbol putrefacto que fusiona con su propio cuerpo
      cualquier resto que encuentra, convirtió hace tiempo esa arboleda en zona
      prohibida incluso para muchos de los propios habitantes del reino. Osses ha
      absorbido territorio brurlandés en años recientes —
      Broneland sigue bajo su ocupación— y muchos temen que su apetito expansionista
      todavía no haya terminado.</p>
    `
  },
  {
    id: "carronada",
    title: "Carroñada",
    category: "Lugares",
    tags: ["aldea", "osses", "roah", "monstruos"],
    summary: "Asentamiento del sur de Osses que vive de procesar los restos de las campañas fronterizas, ghouls y carroñeros trabajando codo a codo con curtidores vivos.",
    region: "Osses, Roah, Gylas",
    gobierno: "Gremio de carroñeros",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Cada campaña fronteriza de Osses deja atrás un campo de batalla que
      alguien tiene que limpiar, y ese trabajo terminó dando forma a Carroñada. Ghouls
      organizados en cuadrillas trabajan junto a curtidores y herreros vivos,
      separando huesos, cuero y metal recuperable con una eficiencia que ningún
      otro asentamiento del imperio necesita igualar.</p>
      <p>El olor mantiene alejados a los visitantes que no tienen negocios ahí,
      algo que sus habitantes consideran una ventaja más que un problema. Lo que
      sale de Carroñada rumbo a Sepulkrad y Fosonegro casi nunca se desperdicia,
      desde pergamino de piel curtida hasta polvo de hueso para los rituales de la
      Cátedra de Ceniza.</p>
    `
  },
  {
    id: "fuerte-desden",
    title: "Fuerte Desdén",
    category: "Lugares",
    tags: ["aldea", "fortaleza", "osses", "roah", "monstruos"],
    summary: "Guarnición fronteriza en el sur de Osses que vigila el territorio absorbido tras la ocupación de Broneland, poblada por igual de vivos y no muertos leales a la Unión.",
    region: "Osses, Roah, Gylas",
    gobierno: "Guarnición de la Unión de Osses",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Los muros de Fuerte Desdén se construyeron con la piedra de fortalezas
      brurlandesas desmanteladas tras la ocupación, un gesto deliberado de la
      Unión para dejar claro a la población local quién gobierna ahora el
      territorio. Su guarnición mezcla soldados vivos con no muertos disciplinados,
      formación que muchos otros reinos considerarían impensable pero que en
      Osses es rutina.</p>
      <p>Patrullas salen del fuerte casi a diario para vigilar los caminos que
      conectan la frontera sur con el resto del imperio, atentas tanto a
      incursiones externas como a levantamientos internos de una población
      brurlandesa que no siempre acepta con gusto su nueva lealtad.</p>
    `
  },
  {
    id: "molino-de-huesos",
    title: "Molino de Huesos",
    category: "Lugares",
    tags: ["aldea", "osses", "roah", "monstruos"],
    summary: "Aldea industrial del sur de Osses donde se muelen huesos y restos hasta convertirlos en abono, pegamento y componentes rituales para la Cátedra de Ceniza.",
    region: "Osses, Roah, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El chirrido constante de las ruedas de molino se escucha desde bastante
      antes de llegar a la aldea, procesando cargamentos que Carroñada y las
      cuadrillas fronterizas envían sin descanso. Lo que sale de aquí pocas veces se
      parece a su origen, convertido en abono para los campos de Osses, pegamento
      industrial o polvo fino para rituales necrománticos.</p>
      <p>Trabajar en el molino no atrae a nadie por elección propia, y casi
      todos sus trabajadores son condenados menores de la Unión que pagan su deuda con
      años de trabajo forzado. Los que sobreviven el tiempo completo suelen quedarse
      de todas formas, sin muchos otros lugares dispuestos a recibirlos.</p>
    `
  },
  {
    id: "corazon-de-piedra",
    title: "Corazón de Piedra",
    category: "Lugares",
    tags: ["ciudad", "osses", "roah", "monstruos"],
    summary: "Ciudad de Osses habitada por medusas, basiliscos y otras criaturas petrificantes, que usan su propia maldición como material de construcción.",
    region: "Osses, Roah, Gylas",
    gobierno: "Consejo de linajes petrificantes",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Las murallas de Corazón de Piedra fueron talladas, se petrificaron, una
      técnica que sus habitantes perfeccionaron para levantar defensas más
      rápido y más baratas que cualquier cantera podría igualar. Medusas,
      basiliscos y algunas estirpes menos conocidas conviven aquí bajo un
      acuerdo simple, nadie usa su mirada dentro de los límites de la ciudad
      sin el consentimiento explícito de la víctima.</p>
      <p>Los pocos visitantes que llegan a comerciar reciben un velo especial en
      la puerta, tejido por artesanos locales, y quien se niega a usarlo no
      pasa de la entrada. Las estatuas que decoran cada plaza no son
      esculturas: son advertencias, y los propios habitantes de la ciudad
      evitan mirarlas de cerca por respeto a quien fueron alguna vez.</p>
    `
  },
  {
    id: "vado-palido",
    title: "Vado Pálido",
    category: "Lugares",
    tags: ["ciudad", "osses", "roah", "monstruos", "mercante"],
    summary: "Ciudad de Osses en la frontera con Dolbred donde monstruos y magos comercian bajo una tregua estricta, la única vía formal de contacto entre ambos reinos.",
    region: "Osses, Roah, Gylas",
    gobierno: "Consejo mixto, renovado cada temporada",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Osses y Dolbred no se llevan bien, pero ambos necesitan lo que el otro
      produce, y Vado Pálido existe para que ese intercambio ocurra sin que
      nadie tenga que cruzar la frontera armado. Magos de Miraveil vienen a
      comprar componentes que solo se consiguen entre criaturas monstruosas, y
      la Unión compra hechizos y protecciones que ningún nigromante propio sabe
      replicar.</p>
      <p>La tregua se renueva cada temporada mediante un ritual formal que
      ambos consejos consideran tedioso pero necesario, y romperla se castiga
      con la expulsión permanente de la ciudad para cualquier bando. La
      soberanía sobre Vado Pálido quedó siempre sin resolver, y tanto Osses
      como Dolbred prefieren dejarlo así antes que arriesgar la tregua por
      una bandera.</p>
    `
  },
  {
    id: "fauces-grises",
    title: "Fauces Grises",
    category: "Lugares",
    tags: ["ciudad", "osses", "roah", "monstruos"],
    summary: "Ciudad de cazadores hombres bestia que abastece a Sepulkrad de carne, pieles y guías capaces de rastrear presas que ninguna otra raza del imperio puede seguir.",
    region: "Osses, Roah, Gylas",
    gobierno: "Consejo de manadas",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Fauces Grises se organiza menos como una ciudad tradicional y más como un
      territorio de caza compartido entre docenas de manadas de hombres bestia, cada
      una con su propio rincón reconocido y su propio consejo de ancianos que
      resuelve disputas antes de que lleguen a los colmillos. Ningún edificio de la
      ciudad supera un par de pisos, construido más para el movimiento rápido que
      para la ostentación.</p>
      <p>La Unión de Osses depende de Fauces Grises para carne, pieles y, sobre
      todo, guías capaces de rastrear presas a través de
      terrenos donde ningún esqueleto ni espectro se movería con igual
      eficacia. Los propios hombres bestia consideran la relación mutuamente
      beneficiosa, aunque no pocos recuerdan que Osses los aceptó primero por
      utilidad y solo después, quizás, por algo parecido al respeto.</p>
    `
  },
  {
    id: "catedra-de-ceniza",
    title: "Cátedra de Ceniza",
    category: "Lugares",
    tags: ["ciudad", "osses", "roah", "no-muertos", "magia"],
    summary: "Academia de nigromancia donde se forman los magos que sostienen la maquinaria no-muerta del imperio, a poca distancia de Sepulkrad.",
    region: "Osses, Roah, Gylas",
    gobierno: "Colegio de Nigromantes",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Detrás de casi todo esqueleto que se alza en Osses hay, en algún momento
      de su formación, un graduado de la Cátedra de Ceniza que perfeccionó la
      técnica exacta que lo mantiene en pie. La academia entrena a la mayoría de los
      nigromantes del imperio, desde quienes levantan guarniciones enteras de
      soldados óseos hasta quienes se especializan en preservar espectros con
      suficiente coherencia para que conserven memoria útil.</p>
      <p>Sus aulas huelen permanentemente a tierra removida, y ningún estudiante se
      gradúa sin haber levantado, mantenido y finalmente disuelto correctamente al
      menos un cuerpo completo, un proceso que la Cátedra considera tan importante
      como cualquier examen escrito. Los graduados más talentosos terminan
      trabajando directamente para Karnhold, aunque la Cátedra evita mencionar ese
      destino en sus materiales de admisión.</p>
      <p>Cuando un muerto se lleva un secreto a la tumba, la Cátedra recurre a sus
      estudiantes slimefolk antes que a cualquier otro método. Un slimefolk formado
      aquí puede, bajo supervisión ritual, recuperar la última voluntad o el último
      recuerdo de restos recién consumidos, un servicio que resuelve más disputas de
      herencia y traiciones sin confesar de lo que cualquier tribunal humano lograría
      por su cuenta. La técnica se enseña con tanto rigor como cualquier otro proceso
      de la academia, y los graduados no la consideran menos digna que levantar un
      ejército de esqueletos.</p>
    `
  },
  {
    id: "fosonegro",
    title: "Fosonegro",
    category: "Lugares",
    tags: ["aldea", "osses", "roah", "monstruos"],
    summary: "Asentamiento de trolls y ogros que extraen piedra y madera de los bosques y canteras que rodean Sepulkrad, la mano de obra más resistente del imperio.",
    region: "Osses, Roah, Gylas",
    gobierno: "El más fuerte, reconocido informalmente",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Fosonegro produce más piedra en bruto y madera talada que cualquier otro
      punto de Osses, con trolls y ogros que trabajan canteras y bosques que
      agotarían a cualquier cuadrilla más pequeña en semanas. La regeneración
      natural de los trolls resulta, para la Unión de Osses, una ventaja logística
      que ningún otro pueblo del imperio puede ofrecer, y las canteras más
      peligrosas se reservan casi exclusivamente para ellos.</p>
      <p>La jerarquía de Fosonegro se resuelve casi siempre por fuerza directa, sin
      consejo ni votación, aunque quienes lo visitan notan que la violencia entre
      sus habitantes es sorprendentemente rara. Nadie desafía a un líder sin estar
      seguro de poder ganar, y perder una disputa sin morir en el intento se
      considera, dentro del asentamiento, una forma aceptable de resolver las
      cosas.</p>
    `
  },
  {
    id: "descanso-de-los-vivos",
    title: "Descanso de los Vivos",
    category: "Lugares",
    tags: ["aldea", "osses", "roah"],
    summary: "La única aldea humana de Osses habitada por elección propia, donde antiguos refugiados y desertores conviven con el imperio en vez de sobrevivirlo.",
    region: "Osses, Roah, Gylas",
    gobierno: "Consejo de vecinos, bajo tolerancia de la Unión de Osses",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>A diferencia de Karnhold, nadie en Descanso de los Vivos llegó encadenado.
      Sus habitantes son, casi todos, refugiados de guerras humanas que
      consideraron la promesa de Osses, trabajo a cambio de seguridad y una vida
      que nadie puede arrebatarles por decreto real, mejor que cualquier
      alternativa que sus reinos de origen les ofrecían.</p>
      <p>La convivencia no es sencilla. Los propios vecinos de Descanso de los
      Vivos admiten vivir de un permiso que Osses podría revocar en cualquier
      momento si decidiera que ya no les resultan útiles, pero la mayoría considera esa
      incertidumbre preferible a la que dejaron atrás. Los demás súbditos del
      imperio los observan con una mezcla de curiosidad y sospecha que ni ellos
      mismos saben resolver por completo.</p>
    `
  },
  {
    id: "dolbred",
    title: "Dolbred",
    category: "Lugares",
    tags: ["reino", "roah", "magia"],
    summary: "Un reino hermético dedicado casi por completo al estudio de la magia.",
    region: "Roah, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: ["Miraveil (capital)", "Cima de la Torre", "Sembradura", "El Cráter", "Puente Franco", "La Toga Rota", "Bosque de las Runas Vivas", "Montaña del Eco Arcano", "Lago de Cristal"],
    content: `
      <p>Un reino hermético dedicado casi por completo al estudio de la magia. Solo los
      magos más talentosos sobreviven a su rigurosa formación. Sus bibliotecas
      contienen algunos de los mayores conocimientos arcanos del mundo y sus
      habitantes casi nunca intervienen en asuntos internacionales salvo cuando la
      magia misma está en peligro. En sus bosques vive Konnovan, un zorro capaz de
      manejar la magia de fuego a un nivel comparable al de cualquier archimago;
      algunos círculos de Miraveil mantienen con él un pacto informal, entregándole
      maná a cambio de que sus tierras permanezcan intactas. En el Bosque de las
      Runas Vivas, algunos viajeros aseguran haber visto lobos del tamaño de un
      árbol con un tercer ojo en la frente, criaturas que muchos magos de Miraveil
      creen que sirven a algo mucho más peligroso que ellos mismos.</p>
      <p>Su capital, Miraveil, reúne siete torres unidas por puentes de magia
      permanente, donde se concentra casi toda esa erudición. Dolbred es también,
      informalmente, el guardián autoproclamado de Vaelmoot, la isla neutral donde
      antiguamente se reunían los reinos del mundo para dialogar. Nadie recuerda
      cuándo exactamente Dolbred asumió esa responsabilidad, pero décadas después
      sigue manteniendo una guardia constante sobre un lugar que el resto del mundo
      prefiere no pensar demasiado.</p>
    `
  },
  {
    id: "sembradura",
    title: "Sembradura",
    category: "Lugares",
    tags: ["aldea", "dolbred", "roah", "magia"],
    summary: "Aldea agrícola de Dolbred que usa magia de crecimiento acelerado para alimentar a una capital que casi no cultiva nada por su cuenta.",
    region: "Dolbred, Roah, Gylas",
    gobierno: "Gremio de Naturgia Aplicada",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Los campos de Sembradura no crecen según el calendario natural. El Gremio de
      Naturgia Aplicada que administra la aldea mantiene rotaciones de cultivo
      aceleradas mediante encantamientos de crecimiento que triplican, en el mejor
      de los casos, el rendimiento que cualquier granja mundana obtendría en el
      mismo terreno, una necesidad absoluta para alimentar a una capital que apenas
      produce alimento propio.</p>
      <p>Los agricultores de Sembradura estudian tanto agronomía tradicional como
      los rudimentos de la Naturgia que Dolbred enseña en Miraveil, aunque pocos
      aspiran a graduarse como magos completos. Prefieren, según explican, un
      oficio donde los errores producen cosechas fallidas y no explosiones
      arcanas.</p>
    `
  },
  {
    id: "el-crater",
    title: "El Cráter",
    category: "Lugares",
    tags: ["aldea", "dolbred", "roah", "magia"],
    summary: "Pueblo remoto de Dolbred construido alrededor de un antiguo cráter de pruebas arcanas, donde se ensayan hechizos demasiado peligrosos para Miraveil.",
    region: "Dolbred, Roah, Gylas",
    gobierno: "Comité de Seguridad Ritual",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Cada academia de Miraveil que necesita probar un hechizo capaz de salir
      mal de forma catastrófica envía a sus investigadores hasta El Cráter, una
      depresión en el terreno formada, según los registros, por un experimento
      fallido de generaciones atrás que nadie se atrevió a repetir cerca de la
      capital. El Comité de Seguridad Ritual que administra el pueblo existe casi
      exclusivamente para decidir qué experimentos pueden proceder y cuáles deben
      trasladarse todavía más lejos.</p>
      <p>Vivir en El Cráter significa aceptar temblores ocasionales, luces
      extrañas en el cielo nocturno y la posibilidad, remota pero real, de que
      algún experimento salga mal de una forma que ningún manual anticipó. Sus
      habitantes, casi todos técnicos y ex-estudiantes de Seguridad Ritual,
      consideran el riesgo un precio razonable a cambio de trabajar en la frontera
      real de lo que la magia puede hacer.</p>
    `
  },
  {
    id: "puente-franco",
    title: "Puente Franco",
    category: "Lugares",
    tags: ["ciudad", "dolbred", "roah", "mercante"],
    summary: "La puerta comercial de Dolbred, donde mercaderes del resto de Roah intercambian bienes mundanos por artefactos y conocimiento arcano sin necesidad de cruzar hacia Miraveil.",
    region: "Dolbred, Roah, Gylas",
    gobierno: "Consejo de gremios mercantiles, bajo licencia de las academias",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Casi ningún forastero llega jamás a ver Miraveil de cerca. Puente Franco
      fue levantado justo para evitarles esa necesidad, y aquí mercaderes de todo
      Roah intercambian grano, madera, metal y cualquier bien mundano que Dolbred
      no produce por artefactos menores, pergaminos autorizados para exportación y
      el ocasional consejo arcano que las academias consideran seguro compartir
      fuera de sus muros.</p>
      <p>El Consejo de gremios que administra la ciudad opera bajo licencia directa
      de las academias, y cada transacción de cierto valor pasa por inspección
      para asegurar que ningún objeto verdaderamente peligroso salga de Dolbred por
      error. Los comerciantes locales se enorgullecen de conocer, mejor que
      cualquier forastero, exactamente qué puede y qué no puede cruzar la frontera
      sin generar un incidente diplomático.</p>
    `
  },
  {
    id: "la-toga-rota",
    title: "La Toga Rota",
    category: "Lugares",
    tags: ["aldea", "dolbred", "roah", "magia"],
    summary: "Aldea de exestudiantes que no lograron graduarse de las academias de Miraveil pero eligieron quedarse en Dolbred antes que volver a casa sin honor.",
    region: "Dolbred, Roah, Gylas",
    gobierno: "Sin autoridad formal",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Muchos llegan a Miraveil soñando con una torre y una toga sin terminar
      graduándose, y La Toga Rota existe para quienes prefirieron
      quedarse en Dolbred de todos modos antes que regresar a sus reinos de origen
      cargando el peso de un fracaso académico. Sus habitantes conocen lo
      suficiente de magia para ser peligrosos y lo suficiente sobre sus propios
      límites para no intentarlo demasiado.</p>
      <p>El pueblo vive de vender servicios mágicos menores, hechizos simples,
      identificación básica de objetos, pequeños encantamientos domésticos, a
      precios que ninguna academia oficial se molestaría en cobrar. Las propias
      academias de Miraveil los ven con una mezcla de lástima y utilidad
      práctica, conscientes de que Dolbred necesita magia de bajo nivel tanto como
      necesita a sus genios certificados.</p>
    `
  },
  {
    id: "cima-de-la-torre",
    title: "Cima de la Torre",
    category: "Lugares",
    tags: ["torre", "dolbred", "roah", "magia"],
    summary: "La cumbre de la mayor montaña de Dolbred, donde reside el Rey Mago, la autoridad real del reino, oculta incluso a ojos de sus propias academias.",
    region: "Dolbred, Roah, Gylas",
    gobierno: "El Rey Mago",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El Consejo de academias que gobierna oficialmente Miraveil no es, en realidad,
      la máxima autoridad de Dolbred, solo la única que el resto del mundo conoce.
      En la cumbre de la montaña más alta del reino, muy por encima de las nubes que
      cubren permanentemente sus laderas inferiores, se alza una única torre solitaria
      donde reside el Rey Mago, una figura que ni los propios miembros del Consejo
      afirman haber visto en persona más de una vez en su vida.</p>
      <p>Nadie sabe con certeza cuánto tiempo lleva gobernando, ni siquiera si "el Rey
      Mago" designa siempre a la misma persona o a un título que se transmite en
      secreto entre sucesores. Lo único que Dolbred admite abiertamente es que ciertas
      decisiones, las más graves, las que podrían alterar el equilibrio arcano del
      mundo, nunca las toma el Consejo por su cuenta. Suben la montaña, y bajan ya
      resueltas.</p>
    `
  },
  {
    id: "derrovia",
    title: "Derrovia",
    category: "Lugares",
    tags: ["región", "gylas"],
    summary: "La región occidental de Gylas, antiguo corazón político del continente.",
    region: "Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: ["Brurland", "Broneland", "Mravec", "Fel", "Cudbusland", "Seosan", "Nobriana"],
    content: `
      <p>La región occidental de Gylas. Durante siglos fue el corazón político del
      continente, pero las guerras, las invasiones y la fragmentación de antiguos
      reinos la transformaron en una tierra donde conviven viejas potencias,
      principados rivales y territorios ocupados. Brurland conserva el linaje más
      directo de aquel pasado, aunque la ocupación de Broneland por la Unión de Osses
      y la satrapía insectoide de Mravec recuerdan a diario que ningún reino de
      Derrovia está libre de perder territorio.</p>
      <p>Al sur, Fel y Cudbusland siguen disputándose el trono vacío del desaparecido
      Reino de Tarrena sin que ninguno reconozca la legitimidad del otro, mientras
      Seosan se mantuvo casi al margen de todo este desorden gracias a su
      aislamiento en la península. Entre Seosan y Brurland persisten las Marchas
      Nobrianas, una franja de bosque que ningún reino vecino ha logrado someter en
      serio, y que en la práctica funciona como el único territorio de Derrovia que
      nadie más que sus propios habitantes controla.</p>
    `
  },
  {
    id: "brurland",
    title: "Brurland",
    category: "Lugares",
    tags: ["reino", "derrovia", "caballería", "dragones"],
    summary: "Un antiguo reino de caballería marcado por el honor, los dragones y la expansión militar.",
    region: "Derrovia, Gylas",
    gobierno: "Corona de Brurland",
    religionPredominante: "Mortismo",
    lugaresDestacados: ["Kigan (capital)", "Wolfmere", "Rivenport", "Vado Ceniza", "Marshfield", "Wheatholt", "Stonedelve", "Bosque de Cenizas", "Torre del Silencio", "Catedral del Juramento", "Río del Caballero", "Colinas de Wolfmere", "Espuela Rota", "Capilla de las Astas Caídas", "Los Centinelas Helados"],
    content: `
      <p>Un antiguo reino de caballería cuya historia está marcada por el honor, los
      dragones y la expansión militar. Aunque continúa siendo una potencia
      respetada, las recientes tragedias han puesto en duda la estabilidad de la
      corona y la confianza de sus propios héroes. Muy al norte de sus fronteras
      vive Zraith, un águila del tamaño de una montaña envuelta en una tormenta
      eléctrica permanente que ella misma genera, y más de un caballero brurlandés
      jura haber visto su silueta entre las nubes justo antes de una desgracia.</p>
      <p>Kigan, su capital costera asentada en un golfo protegido, sigue siendo un
      puerto tan estratégico como ceremonial, aunque los estandartes ondean a media
      asta con más frecuencia de la que cualquier brurlandés recuerda. La frontera
      boscosa de Nobriana al oeste y la sombra de la ocupación de Osses en Broneland
      al Norte mantienen al reino en un estado de alerta constante, incluso mientras
      intenta proyectar hacia fuera una estabilidad que por dentro ya no
      termina de sentir.</p>
    `
  },
  {
    id: "espuela-rota",
    title: "Espuela Rota",
    category: "Lugares",
    tags: ["aldea", "brurland", "derrovia", "caballería"],
    summary: "Aldea al suroeste de Kigan donde se retiran los caballeros que la reciente tragedia dejó incapaces de volver a montar, viviendo de la tierra en lugar de la lanza.",
    region: "Brurland, Derrovia, Gylas",
    gobierno: "Consejo de veteranos",
    religionPredominante: "Mortismo",
    lugaresDestacados: [],
    content: `
      <p>Cada casa de Espuela Rota pertenece a un caballero que ya no puede
      cabalgar, algunos por heridas de guerra, otros por un miedo que la
      tragedia reciente dejó grabado demasiado hondo para superarlo. La corona
      les concede tierra y una pensión modesta a cambio de su silencio sobre lo
      que vieron, un trato que la mayoría acepta sin discutir demasiado.</p>
      <p>El nombre viene de la costumbre local de clavar una espuela partida
      sobre la puerta de cada casa, símbolo tanto de honor pasado como de
      servicio terminado. Los jóvenes de la aldea crecen escuchando historias de
      gloria contadas por hombres que ya no pueden demostrarla, y no todos salen
      convencidos de querer seguir sus pasos.</p>
    `
  },
  {
    id: "capilla-de-las-astas-caidas",
    title: "Capilla de las Astas Caídas",
    category: "Lugares",
    tags: ["aldea", "brurland", "derrovia", "caballería"],
    summary: "Campamento de duelo improvisado al suroeste de Kigan, levantado apenas semanas atrás por familias que todavía no tienen dónde llorar a los caídos de la tragedia de la corona.",
    region: "Brurland, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "Mortismo",
    lugaresDestacados: [],
    content: `
      <p>La tierra alrededor de la capilla todavía está removida, docenas de
      astas de lanza rotas clavadas apenas semanas atrás por familias que
      llegaron desde Kigan sin cuerpo que enterrar. Cada astilla clavada es
      reciente, la corteza todavía sin curtir por el clima, y nuevas familias
      siguen llegando a diario a añadir un nombre que todavía duele demasiado
      para pronunciarlo dos veces seguidas.</p>
      <p>Un puñado de sacerdotes del Mortismo llegó desde Kigan poco después de
      la tragedia para improvisar algo de estructura sobre lo que empezó como
      duelo espontáneo, y todavía están decidiendo cómo va a funcionar la
      capilla una vez que el dolor más agudo empiece a asentarse. Nadie aquí
      habla todavía de tradición ni de ceremonia fija, apenas de sobrevivir
      un día de luto a la vez.</p>
    `
  },
  {
    id: "bosque-de-cenizas",
    title: "Bosque de Cenizas",
    category: "Lugares",
    tags: ["bosque", "derrovia", "brurland"],
    summary: "Un bosque calcinado hace generaciones por la furia de un dragón, donde la ceniza todavía cae como una nevada que nunca termina.",
    region: "Brurland, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Lo que alguna vez fue un bosque denso hoy es un páramo de troncos grises y
      quebradizos, calcinados por el aliento de un dragón mucho antes de que naciera
      el bisabuelo del actual rey. La tierra nunca se recuperó. Nada vuelve a crecer
      entre las cenizas, y una fina capa de polvo gris cae de forma constante desde
      el cielo, como si el incendio, en el fondo, nunca hubiera terminado.</p>
      <p>Los brurlandeses consideran el lugar sagrado a su manera, ya que aquí se
      libró una de las primeras batallas de la orden de caballería que juró proteger al reino
      de los dragones, y el nombre que después heredaría Vado Ceniza, mucho más al
      sur, nació como homenaje directo a este sitio original. Pocos se aventuran
      a cruzarlo por gusto, pero los caballeros más devotos todavía hacen el
      peregrinaje una vez en la vida.</p>
    `
  },
  {
    id: "torre-del-silencio",
    title: "Torre del Silencio",
    category: "Lugares",
    tags: ["torre", "prisión", "derrovia", "brurland"],
    summary: "Una fortaleza-prisión frente a la costa de Kigan donde Brurland encierra a quienes considera demasiado peligrosos para ejecutar.",
    region: "Brurland, Derrovia, Gylas",
    gobierno: "Guarnición de la Corona de Brurland",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Sobre un islote rocoso frente al golfo de Kigan se alza la Torre del
      Silencio, la prisión donde la corona de Brurland encierra aquello que no se
      atreve a matar ni puede permitirse liberar, desde criminales de guerra hasta
      caballeros caídos en deshonra irreversible y, según los rumores que nadie confirma
      oficialmente, algo con escamas en el nivel más bajo. Solo se llega por bote, y
      los guardias rotan cada pocos meses para que ninguno llegue a conocer demasiado
      bien a quienes vigila.</p>
      <p>Desde las recientes tragedias que sacudieron a la corona, la disciplina de la
      guarnición se ha resentido. Se dice, en voz baja, que hace tiempo nadie hace un
      recuento completo de las celdas del fondo. Nadie en Kigan quiere ser el primero
      en preguntar si todo lo que debería seguir encerrado en la Torre del Silencio
      sigue, en efecto, encerrado.</p>
    `
  },
  {
    id: "catedral-del-juramento",
    title: "Catedral del Juramento",
    category: "Lugares",
    tags: ["catedral", "brurland", "derrovia", "kaneísmo", "mortismo"],
    summary: "La única misión de la Iglesia de Asmodeo en Brurland, cuyos clérigos juraron públicamente jamás imponer el Kaneísmo sobre el Mortismo local.",
    region: "Brurland, Derrovia, Gylas",
    gobierno: "Misión eclesiástica de la Iglesia de Asmodeo",
    religionPredominante: "Mortismo (con misión activa de la Iglesia de Asmodeo)",
    lugaresDestacados: [],
    content: `
      <p>La Catedral del Juramento recibe su nombre del voto que cada clérigo de la
      Iglesia de Asmodeo pronuncia en público al llegar a Kigan, la promesa de jamás
      predicar el Kaneísmo por encima del Mortismo que los brurlandeses ya practican.
      Ningún otro puesto de la Iglesia fuera de Roah opera bajo una condición tan
      explícita, y la propia Corona insistió en que el juramento se grabara en la
      piedra del pórtico para que nadie, dentro o fuera de la catedral, pudiera
      alegar que lo olvidó.</p>
      <p>Dentro de sus muros conviven dos fes que nunca terminan de mezclarse. Los ritos
      solares del Kaneísmo se celebran en privado, mientras que los funerales y
      ceremonias públicas siguen el Mortismo local, oficiados por sacerdotes
      brurlandeses que aceptan la presencia asmodeana más por costumbre diplomática
      que por afecto genuino. La Iglesia mantiene la misión abierta principalmente
      porque cerrarla sería, para Asmodeo, admitir que su fe no puede sostenerse
      fuera de sus propias fronteras.</p>
    `
  },
  {
    id: "broneland",
    title: "Broneland",
    category: "Lugares",
    tags: ["reino", "derrovia", "territorio-ocupado"],
    summary: "Antiguo territorio de Brurland, hoy ocupado por la Unión de Osses.",
    region: "Derrovia, Gylas",
    gobierno: "Territorio ocupado por la Unión de Osses",
    religionPredominante: "Mortismo",
    lugaresDestacados: ["Ostwyn (capital)", "Fuerte Ceniza", "Piedrablanca", "Buen Trato", "Paso de los Fugitivos", "Bosque Cautivo", "Río de la Frontera", "Pantano de la Rendición"],
    content: `
      <p>Antiguamente perteneciente a Brurland, hoy es un territorio ocupado por la
      Unión de Osses. Aunque el nombre original prácticamente ha desaparecido de los
      mapas oficiales, sus habitantes todavía recuerdan haber sido brurlandeses. La
      ocupación ha dividido a la población entre quienes aceptan el nuevo orden y
      quienes aún sueñan con recuperar su antiguo reino.</p>
      <p>Ostwyn, la antigua capital brurlandesa, conserva su arquitectura de piedra
      clara bajo estandartes que ya no le pertenecen, y sus tabernas todavía guardan
      canciones que se cantan en voz baja. La ocupación mantiene el orden mediante
      guarniciones mixtas de tropas monstruosas y colaboradores locales, pero la
      resistencia silenciosa nunca llegó a desaparecer, solo aprendió a no llamar la
      atención.</p>
    `
  },
  {
    id: "mravec",
    title: "Mravec",
    category: "Lugares",
    tags: ["reino", "derrovia", "insectoides"],
    summary: "Una antigua satrapía desértica gobernada por una dinastía insectoide.",
    region: "Derrovia, Gylas",
    gobierno: "Satrapía insectoide (dinastía descendiente de la Reina Hormiga)",
    religionPredominante: "Quitinismo",
    lugaresDestacados: ["Quitinal (capital)", "Zaphara", "Kelbara", "Duna Cambiante", "El Panal Silencioso", "Dunas del Enjambre", "El Oasis de Quitina", "La Colmena de Piedra", "Fragua de Caparazón", "Telar de Seda"],
    content: `
      <p>Una antigua satrapía desértica gobernada por una dinastía insectoide. Sus
      habitantes descienden de los Ignotos, criaturas nacidas del Nigredo que con el
      paso de los siglos desarrollaron inteligencia, cultura y civilización. En el
      centro del reino permanece Reginamex, la inmensa Reina Hormiga, una criatura
      casi animalística cuya sola existencia mantiene unida a la colonia.</p>
      <p>Paradójicamente, son sus descendientes quienes gobiernan realmente. Cada
      generación nace más inteligente y sofisticada que la anterior, venerando a su
      madre como el origen de toda la nación mientras toman las decisiones políticas
      en su nombre. Fuera de la colonia, otras comunidades del desierto veneran una
      figura distinta, La Madre del Desierto, matriarca de todos los grandes gusanos
      de arena, capaz de oscurecer el cielo con tormentas cuando emerge. Nadie
      gobierna en su nombre; su favor se gana o se pierde tributo a tributo.</p>
    `
  },
  {
    id: "kelbara",
    title: "Kelbara",
    category: "Lugares",
    tags: ["ciudad", "mravec", "derrovia", "insectoides", "desierto"],
    summary: "Colonia satélite de Quitinal, la expansión más reciente de la dinastía insectoide hacia el borde oriental del desierto.",
    region: "Mravec, Derrovia, Gylas",
    gobierno: "Satrapía insectoide, gobernada por un descendiente menor de la Reina",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Kelbara creció, literalmente, desde una sola cámara excavada por un puñado
      de descendientes menores de la Reina Hormiga enviados a expandir el
      territorio de la satrapía hacia el borde oriental del desierto. Décadas
      después, la colonia sigue las mismas reglas orgánicas de crecimiento que
      Quitinal, secreciones endurecidas convertidas en muros y túneles según la
      colonia lo necesita, aunque a menor escala.</p>
      <p>El descendiente que gobierna Kelbara responde formalmente ante la Reina,
      pero la distancia con Quitinal le concede una autonomía práctica que ningún
      funcionario de la capital cuestiona demasiado en voz alta. Los mercaderes
      humanos que llegan hasta aquí describen la colonia como una versión más
      accesible, y ligeramente menos inquietante, de la propia capital.</p>
    `
  },
  {
    id: "duna-cambiante",
    title: "Duna Cambiante",
    category: "Lugares",
    tags: ["aldea", "mravec", "derrovia", "desierto", "mercante"],
    summary: "Puesto de caravanas en el desierto de Mravec donde comerciantes humanos, insectoides y de otros pueblos intercambian bienes sin necesidad de cruzar hasta Quitinal.",
    region: "Mravec, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Los mapas de Mravec nunca marcan a Duna Cambiante en el mismo lugar dos
      veces, un nombre que sus propios fundadores eligieron con ironía deliberada
      para un
      puesto de caravanas que en realidad ocupa una posición bastante fija, cerca
      del cruce de las dos rutas comerciales más transitadas del desierto. La broma
      se mantiene porque, para cualquier forastero que se pierde en la primera
      visita, el nombre parece completamente literal.</p>
      <p>Aquí conviven comerciantes humanos, insectoides menores de la satrapía y
      viajeros de reinos mucho más lejanos, todos bajo una tregua comercial tácita
      que nadie ha necesitado poner por escrito. Duna Cambiante prospera
      porque ninguna autoridad, ni la satrapía ni ningún reino humano,
      se ha molestado en reclamarla formalmente.</p>
    `
  },
  {
    id: "panal-silencioso",
    title: "El Panal Silencioso",
    category: "Lugares",
    tags: ["aldea", "mravec", "derrovia", "desierto"],
    summary: "Aldea-santuario del Quitinismo en el desierto de Mravec, donde sacerdotes de todas las razas estudian la responsabilidad del poder lejos de la corte de Quitinal.",
    region: "Mravec, Derrovia, Gylas",
    gobierno: "Orden sacerdotal del Quitinismo",
    religionPredominante: "Quitinismo",
    lugaresDestacados: [],
    content: `
      <p>El Panal Silencioso toma su nombre de la disciplina que exige a quienes
      viven allí, un voto de silencio parcial que sus sacerdotes consideran
      esencial para practicar la virtud central del Quitinismo, la responsabilidad
      sobre el poder que uno ejerce. Aquí, magos de cualquier raza y reino pueden
      retirarse durante semanas o meses a examinar exactamente qué han hecho con su
      magia y por qué.</p>
      <p>A diferencia de Quitinal, gobernada por la dinastía insectoide, el Panal
      Silencioso no reconoce autoridad de sangre alguna. Cualquier sacerdote
      suficientemente disciplinado puede ascender dentro de la orden, sin importar
      si desciende de la Reina Hormiga o llegó como peregrino humano buscando
      alivio para una conciencia cargada.</p>
    `
  },
  {
    id: "fel",
    title: "Fel",
    category: "Lugares",
    tags: ["reino", "derrovia", "tarrena"],
    summary: "Uno de los dos estados surgidos tras la desaparición del Reino de Tarrena.",
    region: "Derrovia, Gylas",
    gobierno: "Principado (hijo del último rey de Tarrena)",
    religionPredominante: "",
    lugaresDestacados: ["Vulkrest (capital)", "Catedral de las Fraguas", "Pozohumo", "El Hollín", "La Encrucijada de Hierro", "Carbonar", "Bosque Partido", "Río Tarrena", "Colinas de Vulkrest"],
    content: `
      <p>Uno de los dos estados surgidos tras la desaparición del Reino de Tarrena.
      Gobernado por uno de los hijos del último rey, Fel pretende explotar los
      abundantes recursos del antiguo reino mediante una rápida industrialización y
      una fuerte expansión económica, manteniendo una rivalidad constante con su
      nación hermana.</p>
      <p>Vulkrest, su capital industrial, vive bajo un cielo permanentemente teñido de
      gris por el humo de sus fundiciones, símbolo tanto de su prosperidad como del
      ritmo insostenible al que la persigue. La rivalidad con Cudbusland se respira en
      cada frontera compartida, cada tratado comercial firmado a regañadientes y cada
      carguero que ambos principados compiten por llenar primero.</p>
    `
  },
  {
    id: "pozohumo",
    title: "Pozohumo",
    category: "Lugares",
    tags: ["ciudad", "fel", "derrovia", "tecnología"],
    summary: "Ciudad minera que extrae el mineral de los yacimientos heredados de Tarrena, la fuente directa de todo lo que arde en las fundiciones de Vulkrest.",
    region: "Fel, Derrovia, Gylas",
    gobierno: "Administración del Principado de Fel",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Pozohumo explota su yacimiento con más intensidad que cualquier otro punto
      de Fel, con turnos de veinticuatro horas sin interrupción que extraen el
      mineral que después baja por vagonetas hacia las fundiciones de Vulkrest. La
      ciudad creció literalmente alrededor de los pozos, con calles que siguen el
      trazado irregular de las vetas más que ningún plan urbanístico
      deliberado.</p>
      <p>El príncipe visita Pozohumo con la frecuencia suficiente para que sus
      habitantes no olviden que la ciudad existe, en última instancia, para
      sostener la prosperidad de Vulkrest, no la propia. Los mineros lo saben, y
      esa consciencia alimenta el descontento que los sindicatos de
      obreros llevan años tratando de organizar en algo más que quejas
      dispersas.</p>
    `
  },
  {
    id: "el-hollin",
    title: "El Hollín",
    category: "Lugares",
    tags: ["aldea", "fel", "derrovia"],
    summary: "Barrio-dormitorio a las afueras de Vulkrest donde vive la mayoría de los trabajadores de las fundiciones, tan cerca del humo que ningún cielo despejado dura más de una hora.",
    region: "Fel, Derrovia, Gylas",
    gobierno: "Sin autoridad propia, administrado desde Vulkrest",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El Hollín no aparece en ningún mapa oficial de Fel como una entidad
      separada de Vulkrest, aunque cualquiera que camine sus calles sabe
      distinguir de inmediato dónde termina la capital y empieza el barrio que la
      sostiene. Sus edificios se apiñan tan cerca de las fundiciones que el ruido
      no para nunca, ni siquiera durante las pocas horas que los
      trabajadores dedican a dormir.</p>
      <p>La mayoría de los sindicatos de obreros de Fel nacieron aquí, en
      reuniones que empezaron como quejas compartidas sobre horarios y salarios y
      terminaron convirtiéndose en algo parecido a una organización real. El
      príncipe deja hacer mientras la actividad sindical no interrumpa la producción,
      un equilibrio que ambas partes consideran temporal.</p>
    `
  },
  {
    id: "encrucijada-de-hierro",
    title: "La Encrucijada de Hierro",
    category: "Lugares",
    tags: ["ciudad", "fel", "derrovia"],
    summary: "Sede de los principales sindicatos de obreros de Fel, la única ciudad del principado donde los trabajadores, no los capataces, tienen la última palabra.",
    region: "Fel, Derrovia, Gylas",
    gobierno: "Federación de Sindicatos de Fel",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>La Encrucijada de Hierro no se parece a ninguna otra ciudad de Fel,
      fundada por trabajadores que ahorraron generación tras generación hasta
      comprar, literalmente, el terreno donde hoy se levanta. La Federación de
      Sindicatos que la gobierna no responde directamente ante el príncipe, un
      arreglo legal poco común que sigue en pie porque prohibirlo generaría una
      huelga general que paralizaría toda la industria.</p>
      <p>Los delegados sindicales de Pozohumo, El Hollín y la propia Vulkrest se
      reúnen aquí regularmente para coordinar demandas y, ocasionalmente,
      huelgas. El príncipe mantiene observadores permanentes en la ciudad, aunque
      la Encrucijada ha aprendido a hablar con suficiente cuidado como para nunca
      darle una excusa clara para intervenir.</p>
    `
  },
  {
    id: "carbonar",
    title: "Carbonar",
    category: "Lugares",
    tags: ["aldea", "fel", "derrovia"],
    summary: "Aldea forestal que talla y quema madera para producir el carbón que alimenta las fundiciones de Vulkrest día y noche.",
    region: "Fel, Derrovia, Gylas",
    gobierno: "Administración del Principado de Fel",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Los bosques que rodean Carbonar existen, en la práctica, para
      convertirse en carbón, talados y quemados en hornos que funcionan de forma
      casi continua para mantener las fundiciones de Vulkrest alimentadas. El
      ritmo de tala supera con claridad al de reforestación, algo que ni el
      propio pueblo ni el principado han encontrado motivos suficientes para
      corregir todavía.</p>
      <p>Sus habitantes conocen el oficio de generación en generación, y los
      carboneros más experimentados pueden calcular, solo por el color y el olor
      del humo, si un horno está a punto de fallar. Nadie en Fel discute
      abiertamente qué pasará con Vulkrest cuando los bosques alrededor de
      Carbonar finalmente se agoten, aunque todos saben que la pregunta, tarde o
      temprano, tendrá que responderse.</p>
    `
  },
  {
    id: "cudbusland",
    title: "Cudbusland",
    category: "Lugares",
    tags: ["reino", "derrovia", "tarrena"],
    summary: "El segundo heredero del desaparecido Reino de Tarrena.",
    region: "Derrovia, Gylas",
    gobierno: "Principado (segundo heredero de Tarrena)",
    religionPredominante: "",
    lugaresDestacados: ["Rothmoor (capital)", "Telarfina", "Campos de Tarrena", "Puesto Contendido", "Feria del Heredero", "Campos de Rothmoor", "Bosque del Heredero", "Río Compartido"],
    content: `
      <p>El segundo heredero del desaparecido Reino de Tarrena. Su príncipe reclama
      exactamente los mismos territorios que Fel, aunque defiende un modelo
      completamente distinto para aprovechar sus riquezas naturales. Décadas después
      de la división, ninguno de los dos principados reconoce la legitimidad del
      otro.</p>
      <p>Rothmoor, su capital, optó deliberadamente por un crecimiento más medido que
      el de su vecino, con talleres artesanales en lugar de fundiciones a gran escala,
      aunque muchos sospechan que la diferencia responde más a la falta de capital que
      a una convicción real. Esos mismos talleres tallan muchas de sus piezas con
      colmillos de colmirraz, un jabalí colosal cazado tanto por su carne como por
      sus colmillos decorativos. La disputa por el trono perdido de Tarrena sigue sin
      resolverse, y ninguno de los dos herederos parece dispuesto a ceder mientras
      viva.</p>
      <p>En las tierras altas que ninguno de los dos herederos se ha molestado en
      reclamar formalmente, sobreviven algunos cíclopes que ya habitaban esas
      canteras y montañas mucho antes de que el reino se dividiera. Cudbusland
      ocasionalmente contrata a alguno como mano de obra bruta para trabajos que
      ningún otro pueblo acepta, pagando en herramientas o comida antes que en
      autoridad. Los cíclopes no muestran lealtad ni a Cudbusland ni a Fel, y no
      parecen echarla en falta mientras las ruinas sigan siendo suyas.</p>
    `
  },
  {
    id: "seosan",
    title: "Seosan",
    category: "Lugares",
    tags: ["reino", "derrovia"],
    summary: "Una península aislada cuya cultura evolucionó casi al margen del resto del continente.",
    region: "Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "Senkai",
    lugaresDestacados: ["Kaishoto (capital)", "Zanmyo", "Kensho", "Yumigaoka", "Tetsumura", "Komezato", "Yuiwa", "Fudeoka", "Ebizura", "Sakaimura", "Konoura", "Hita", "Bosque de Bambú de Kensho", "Acantilado de Zanmyo", "Monte Senkai"],
    content: `
      <p>Una península aislada cuya cultura evolucionó apartada del
      resto del continente. Sus habitantes conservan antiguas filosofías, escuelas
      marciales y tradiciones que apenas existen fuera de sus fronteras. El honor
      personal y la disciplina ocupan un lugar mucho más importante que la riqueza o
      la política.</p>
      <p>Kaishoto, su capital, organiza la vida del reino en torno a decenas de
      escuelas marciales que compiten entre sí sin dejar jamás de respetarse. Los
      duelos formales resuelven la mayoría de las disputas internas, y los pocos
      forasteros que logran ganarse la confianza de alguna escuela describen una
      disciplina que se siente, de fondo, casi palpable en el aire. Un avistamiento
      de Kirin, una criatura capaz de controlar la electricidad y tan escasa que
      pocos maestros pueden decir haberla visto, todavía se considera el mejor
      augurio posible para fundar una nueva escuela.</p>
    `
  },
  {
    id: "nobriana",
    title: "Nobriana",
    category: "Lugares",
    tags: ["reino", "derrovia", "gylas", "bosque"],
    summary: "Las Marchas Nobrianas, una franja boscosa entre Seosan y el Reino de Brurland, demasiado indomable para que ningún reino vecino la controle en serio.",
    region: "Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "Edrasismo",
    lugaresDestacados: ["La Espesura", "Vernúmbra", "Cruce Verde", "Santuario de Edrasis", "Puesto del Manto Gris", "Refugio de Kaishoto", "Mercado de las Raíces", "Río Vernúmbra", "Claro Sagrado"],
    content: `
      <p>Ni Brurland ni Seosan han logrado —o realmente intentado— extender su
      autoridad total sobre esta franja de bosques densos y colinas escarpadas que
      separa a ambos reinos, justo al sur de Mravec. Los mapas la marcan bajo el
      nombre de Nobriana, aunque casi todo el mundo prefiere el apodo popular de las
      Marchas Nobrianas, en referencia a su condición de frontera indomable entre
      potencias vecinas.</p>
      <p>Caravanas y viajeros que cruzan entre Seosan y Brurland prefieren rutas más
      largas por la costa antes que atravesar las Marchas directamente, y quienes sí
      se aventuran suelen llevar guías locales que conocen los caminos seguros. No es
      tierra maldita ni especialmente peligrosa comparada con otros rincones del
      mundo. Simplemente pertenece a quienes ya viven en ella.</p>
      <p>Tres pueblos, aparte de los escasos humanos que se aventuran a vivir aquí,
      consideran las Marchas su hogar. Los silvanos, cuerpos de corteza y musgo que se
      mueven con una lentitud paciente, son con diferencia los más antiguos; los
      bugbears cazan por emboscada entre la maleza más espesa, tan sigilosos que la
      mayoría de los viajeros nunca llega a verlos aunque sientan la mirada; y los
      centauros se desplazan siguiendo las migraciones de los rebaños del bosque, sin
      asentarse en un mismo claro más de unas semanas. Los tres mantienen fronteras
      internas no escritas y prefieren no interferir en los asuntos ajenos,
      conscientes de que el bosque alcanza para todos.</p>
    `
  },
  {
    id: "la-espesura",
    title: "La Espesura",
    category: "Lugares",
    tags: ["bosque", "derrovia", "nobriana", "sobrenatural"],
    summary: "La única parte de las Marchas Nobrianas que ni sus propios guías se atreven a cruzar, un bosque denso y neblinoso con una presencia que jamás termina de dejarse ver.",
    region: "Nobriana, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "Edrasismo",
    lugaresDestacados: [],
    content: `
      <p>Cerca del extremo Este de las Marchas Nobrianas, a apenas un par de días a pie
      de las murallas de Kigan, los árboles crecen tan juntos que el sol apenas
      atraviesa el dosel. Una niebla espesa y fría cubre el suelo a cualquier hora del
      día, en cualquier estación, y ni brújulas ni estrellas sirven de mucho ahí dentro:
      los pocos que han vuelto hablan de horas caminando en círculos sin darse cuenta.</p>
      <p>Hasta los propios guías locales rodean La Espesura en lugar de cruzarla. Nadie
      que haya entrado asegura haber visto con claridad qué habita ahí.</p>
      <p>Algunos silvanos de las Marchas sostienen que los más viejos de su pueblo se
      retiraron aquí generaciones atrás y jamás volvieron a salir. Ni ellos mismos se
      atreven a confirmar si eso significa que murieron, que se fundieron con el
      propio bosque, o que simplemente decidieron que ya no tenían nada que buscar
      fuera de la niebla. Los guías de Vernúmbra evitan mencionar la teoría a los
      forasteros, no sea que alguno decida comprobarla en persona.</p>
    `
  },
  {
    id: "vernumbra",
    title: "Vernúmbra",
    category: "Lugares",
    tags: ["aldea", "derrovia", "nobriana"],
    summary: "El único asentamiento reconocido de los propios habitantes de las Marchas Nobrianas, oculto tan bien que ni Brurland ni Seosan lo marcan en sus mapas oficiales.",
    region: "Nobriana, Derrovia, Gylas",
    gobierno: "Consejo de ancianos",
    religionPredominante: "Edrasismo",
    lugaresDestacados: [],
    content: `
      <p>Cuando se dice que las Marchas Nobrianas "pertenecen a quienes ya viven en
      ella", Vernúmbra es exactamente a quién se refiere esa frase. Construida entre
      raíces de árboles centenarios y casi invisible a menos que alguien
      sepa exactamente dónde mirar, es el único asentamiento permanente de los
      propios nobrianos, un pueblo que ni Brurland ni Seosan terminan de
      clasificar como súbditos de nadie.</p>
      <p>Los guías que cruzan las Marchas con viajeros extranjeros suelen ser, en
      realidad, habitantes de Vernúmbra, aunque casi nunca lo admiten abiertamente. El
      pueblo no comercia con monedas, sino con intercambios directos de bienes, y
      solo con quienes ya demostraron, cruzando el bosque una vez, que merecen esa
      confianza.</p>
    `
  },
  {
    id: "puesto-del-manto-gris",
    title: "Puesto del Manto Gris",
    category: "Lugares",
    tags: ["aldea", "derrovia", "nobriana"],
    summary: "Puesto de vigilancia brurlandés en el borde oriental de las Marchas Nobrianas, tan cerca del límite del bosque como Brurland se atreve a construir.",
    region: "Nobriana, Derrovia, Gylas",
    gobierno: "Guarnición brurlandesa",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Brurland nunca ha reclamado las Marchas Nobrianas en serio, pero tampoco
      deja de vigilar su frontera. El Puesto del Manto Gris responde a ese
      equilibrio incómodo, lo bastante cerca del bosque para observar
      cualquier movimiento inusual, lo bastante lejos para no provocar a los
      nobrianos que consideran cualquier avance mayor una violación directa de su
      territorio.</p>
      <p>Los soldados destinados aquí aprenden rápido a distinguir entre un guía de
      Vernúmbra dispuesto a comerciar y cualquier otra presencia en el límite del
      bosque, una habilidad que ningún manual militar de Brurland enseña con la
      misma precisión que la experiencia directa. El puesto rota su guarnición con
      frecuencia, consciente de que la paciencia con las Marchas se agota rápido en
      cualquier soldado.</p>
    `
  },
  {
    id: "refugio-de-kaishoto",
    title: "Refugio de Kaishoto",
    category: "Lugares",
    tags: ["aldea", "derrovia", "nobriana"],
    summary: "Refugio de caza y comercio del lado de Seosan en el límite de las Marchas Nobrianas, contraparte occidental del Puesto del Manto Gris.",
    region: "Nobriana, Derrovia, Gylas",
    gobierno: "Gremio de cazadores de Kaishoto",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Donde Brurland vigila con soldados, Seosan prefiere vigilar con
      cazadores, y el Refugio de Kaishoto sirve tanto de puesto de observación
      informal como de punto de partida para las expediciones de caza que se
      aventuran hasta el borde, pero nunca dentro, de las Marchas Nobrianas. El
      gremio que lo administra mantiene relaciones cordiales, aunque distantes, con
      los guías de Vernúmbra que ocasionalmente cruzan hasta aquí a comerciar.</p>
      <p>A diferencia del Manto Gris, el Refugio carece de intención militar
      declarada, algo que sus propios administradores insisten en recordar a
      cualquier visitante que llegue con preguntas sobre las capacidades
      defensivas de las Marchas. Sea cierto o no, la distinción le ha
      ahorrado al Refugio más de un conflicto diplomático con Vernúmbra a lo largo
      de los años.</p>
    `
  },
  {
    id: "mercado-de-las-raices",
    title: "Mercado de las Raíces",
    category: "Lugares",
    tags: ["aldea", "derrovia", "nobriana", "mercante"],
    summary: "Enclave comercial autorizado por Vernúmbra donde herbolarios extranjeros compran plantas medicinales que solo crecen en las Marchas Nobrianas.",
    region: "Nobriana, Derrovia, Gylas",
    gobierno: "Gremio de herbolarios, con licencia de Vernúmbra",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Los herbolarios extranjeros no pueden internarse por su cuenta en las
      Marchas Nobrianas, así que el Mercado de las Raíces les acerca el bosque
      sin que tengan que cruzar su límite. Guías de Vernúmbra traen aquí, en cantidades
      cuidadosamente limitadas, plantas medicinales que no crecen en ningún otro
      punto del mundo conocido, vendiéndolas a un gremio de herbolarios que ha
      obtenido, con paciencia de años, el permiso tácito de los propios nobrianos
      para operar en este único punto.</p>
      <p>El equilibrio es frágil y todos lo saben. Vernúmbra podría cerrar el
      mercado en cualquier momento sin explicación, y el gremio de herbolarios se
      cuida mucho de no presionar jamás por más acceso del que ya tiene. Las raíces
      que salen de aquí terminan en boticarios de medio Gylas, aunque casi ninguno
      sabe exactamente de dónde vienen ni lo que costó conseguirlas.</p>
    `
  },
  {
    id: "cruce-verde",
    title: "Cruce Verde",
    category: "Lugares",
    tags: ["aldea", "derrovia", "nobriana"],
    summary: "Puesto de descanso neutral en el corazón de las Marchas Nobrianas, el único punto donde viajeros de Brurland y Seosan comercian sin tensión.",
    region: "Nobriana, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>A medio camino entre Brurland y Seosan, en un claro que los propios
      nobrianos mantienen despejado por acuerdo tácito, se alza el Cruce Verde, un
      puñado de refugios y un mercado improvisado donde viajeros de ambos reinos se
      cruzan sin la desconfianza que normalmente los separa. Nadie lo gobierna
      formalmente, y esa ausencia de bandera es justo lo que lo mantiene en
      pie.</p>
      <p>Comerciantes de Kigan y Kaishoto intercambian aquí mercancías que de otro
      modo tendrían que rodear la península entera por mar, y los guías locales de
      Vernúmbra cobran un peaje informal por mantener el claro seguro. Ninguna de las
      dos coronas reclama el lugar, conscientes de que hacerlo probablemente lo
      arruinaría.</p>
    `
  },
  {
    id: "santuario-de-edrasis",
    title: "Santuario de Edrasis",
    category: "Lugares",
    tags: ["catedral", "derrovia", "nobriana"],
    summary: "El templo más importante del Edrasismo, escondido en lo profundo de las Marchas Nobrianas y accesible solo con permiso de los propios nobrianos.",
    region: "Nobriana, Derrovia, Gylas",
    gobierno: "Sacerdocio del Edrasismo",
    religionPredominante: "Edrasismo",
    lugaresDestacados: [],
    content: `
      <p>El templo principal del Edrasismo no se construyó para ser encontrado. Sus
      sacerdotes lo levantaron generaciones atrás en lo más profundo de las Marchas,
      confiando en que la propia naturaleza recóndita del bosque protegería la fe
      mejor que cualquier muralla. Ni Brurland ni Seosan han presionado nunca por
      acceder a él directamente.</p>
      <p>Los pocos fieles externos que logran una peregrinación hasta el Santuario
      necesitan, casi siempre, el permiso y la guía de Vernúmbra para llegar. Los
      sacerdotes reciben a quienes completan el viaje con la discreción de
      siempre, sin ceremonia excesiva, pero sin prisa por dejarlos
      partir tampoco.</p>
    `
  },
  {
    id: "telarfina",
    title: "Telarfina",
    category: "Lugares",
    tags: ["ciudad", "cudbusland", "derrovia"],
    summary: "Ciudad-taller de Cudbusland especializada en tejidos y bordados finos, el contraejemplo favorito del principado frente a la producción en masa de Fel.",
    region: "Cudbusland, Derrovia, Gylas",
    gobierno: "Gremio de Tejedores",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Telarfina produce en una temporada completa lo que una sola fundición de
      Vulkrest podría igualar en valor de mercado en apenas unas semanas, un dato
      que sus propios artesanos prefieren no mencionar en voz alta mientras
      insisten, con razón, en que ningún telar de Fel logra la misma calidad. Cada
      pieza que sale de sus talleres lleva la marca personal del artesano que la
      terminó, una práctica que Cudbusland promueve como prueba de su superioridad
      cualitativa sobre la cantidad industrial de su rival.</p>
      <p>El Gremio de Tejedores mantiene estándares tan estrictos que un aprendiz
      puede pasar años antes de que se le permita vender una sola pieza bajo su
      propio nombre. El príncipe de Cudbusland cita a Telarfina con frecuencia en
      sus discursos como prueba de que el crecimiento medido produce mejores
      resultados que la prisa de Vulkrest, aunque los mercaderes de la ciudad
      admiten, en privado, que también les vendría bien vender un poco más
      rápido.</p>
    `
  },
  {
    id: "campos-de-tarrena",
    title: "Campos de Tarrena",
    category: "Lugares",
    tags: ["aldea", "cudbusland", "derrovia"],
    summary: "Aldea agrícola que alimenta a Rothmoor con métodos tradicionales, deliberadamente distintos a cualquier innovación que pudiera asociarse con Fel.",
    region: "Cudbusland, Derrovia, Gylas",
    gobierno: "Consejo de granjeros",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Campos de Tarrena cultiva la tierra de la misma forma que
      lo hacían los súbditos del antiguo Reino de Tarrena antes de su
      desaparición, una elección que sus habitantes defienden como respeto a la
      tradición y que sus críticos en Fel señalan como simple resistencia al
      cambio. El nombre de la aldea no es casualidad. Fue elegido, deliberadamente,
      para reclamar una continuidad con el reino perdido que Rothmoor considera
      legítimamente suya.</p>
      <p>El Consejo de granjeros que administra la aldea rechaza sistemáticamente
      cualquier oferta de mecanización que llegue desde comerciantes vinculados a
      Fel, sin importar cuán ventajosa parezca la propuesta. Prefieren, según
      explican, cosechar menos y dormir tranquilos sabiendo que ningún fundidor de
      Vulkrest puede alardear de haber cambiado su forma de vida.</p>
    `
  },
  {
    id: "puesto-contendido",
    title: "Puesto Contendido",
    category: "Lugares",
    tags: ["aldea", "cudbusland", "derrovia"],
    summary: "Aldea fronteriza en el límite disputado entre Cudbusland y Fel, donde ambos principados mantienen presencia simbólica sin llegar jamás a un conflicto abierto.",
    region: "Cudbusland, Derrovia, Gylas",
    gobierno: "Administración compartida, en la práctica disputada",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Ni un solo tratado formal reconoce a quién pertenece exactamente Puesto
      Contendido, y esa ambigüedad legal define cada aspecto de la vida en la
      aldea, desde qué moneda circula con más frecuencia hasta qué príncipe
      reciben sus habitantes con más entusiasmo cuando decide visitarla. Ambos
      principados mantienen aquí una presencia simbólica, suficiente para reclamar
      el territorio pero insuficiente para provocar una guerra que ninguno de los
      dos realmente quiere.</p>
      <p>Sus habitantes han aprendido a navegar la ambigüedad con pragmatismo,
      pagando impuestos parciales a ambas coronas y evitando cuidadosamente tomar
      partido en público. La disputa por el trono de Tarrena, según dicen los más
      cínicos de Puesto Contendido, terminará algún día, pero probablemente no en
      esta generación ni en la siguiente.</p>
    `
  },
  {
    id: "feria-del-heredero",
    title: "Feria del Heredero",
    category: "Lugares",
    tags: ["ciudad", "cudbusland", "derrovia", "mercante"],
    summary: "Mercado de exportación de Cudbusland donde comerciantes extranjeros compran artesanía fina sin necesidad de negociar directamente con los gremios de Rothmoor.",
    region: "Cudbusland, Derrovia, Gylas",
    gobierno: "Consejo de comercio exterior",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Feria del Heredero organiza su calendario entero alrededor de las
      temporadas de comercio internacional, recibiendo a mercaderes de medio
      Derrovia que vienen a comprar los tejidos de Telarfina, las manufacturas de
      Rothmoor y cualquier otra artesanía fina que Cudbusland tenga para ofrecer
      ese año. El nombre de la ciudad es, según todos entienden, una reafirmación
      silenciosa de que su príncipe considera el trono de Tarrena legítimamente
      suyo.</p>
      <p>El Consejo de comercio exterior negocia acuerdos que ningún gremio
      individual podría cerrar por su cuenta, y aquí se libra la rivalidad
      económica con Fel, en cifras de exportación y contratos
      firmados, más que en cualquier frontera física. Perder una feria comercial
      importante frente a Vulkrest se considera, en los círculos diplomáticos de
      Cudbusland, una derrota casi tan grave como perder una batalla.</p>
    `
  },
  {
    id: "genevia",
    title: "Genevia",
    category: "Lugares",
    tags: ["región", "gylas", "archipiélago"],
    summary: "Un enorme archipiélago que sirve de puente comercial entre continentes.",
    region: "Gylas",
    gobierno: "",
    religionPredominante: "Talasismo",
    lugaresDestacados: ["Pelgiria", "Isla del Compás", "Bancosur", "Refugio de la Marea", "Coral Hundido", "Nido de Gaviotas"],
    content: `
      <p>Un enorme archipiélago formado por cientos de islas repartidas entre rutas
      comerciales y mares peligrosos. Durante siglos ha servido como puente entre
      continentes, convirtiéndose en refugio de navegantes, comerciantes y
      piratas. Sus aguas profundas ocultan amenazas memorables, desde el Kraken
      que arrastra barcos enteros al fondo hasta Carthral, una langosta apenas más
      grande que una mano cuya pinza puede desatar un tsunami.</p>
      <p>Casi toda esa actividad se concentra en Pelgiria, el mayor reino insular de
      la región, aunque cientos de islas menores permanecen sin bandera reconocida ni
      gobierno propio, habitadas apenas por pequeñas comunidades de pescadores o
      completamente deshabitadas. Ningún poder externo ha intentado jamás conquistar
      Genevia en su totalidad, porque administrar un territorio disperso en tantas islas
      resulta, según los pocos que lo han considerado en serio, mucho más caro que
      cualquier beneficio que pudiera reportar.</p>
      <p>Entre esas islas menores viven los lagartos, un pueblo pragmático que evalúa
      cada situación en términos de supervivencia inmediata antes que de tradición o
      ganancia futura. No construyen ciudades en el sentido convencional del término,
      sino asentamientos que se desplazan según las mareas y las temporadas de pesca.
      Los pocos comerciantes que intentan negociar con ellos aprenden rápido que un
      lagarto puede ser un aliado extraordinario en una emergencia y un enemigo
      impredecible si se lo provoca sin motivo aparente.</p>
    `
  },
  {
    id: "isla-del-compas",
    title: "Isla del Compás",
    category: "Lugares",
    tags: ["ciudad", "genevia", "gylas", "archipiélago"],
    summary: "Isla que sostiene el gran observatorio de navegación de Genevia, tan indispensable para cruzar los arrecifes del archipiélago que ningún capitán se arriesga a convertirla en un enemigo.",
    region: "Genevia, Gylas",
    gobierno: "Colegio de Navegantes",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>La torre que corona Isla del Compás no es un faro común, sino un
      observatorio que cruza avistamientos de estrellas, corrientes y mareas para
      producir las únicas cartas de navegación confiables de todo Genevia, un
      archipiélago sembrado de arrecifes traicioneros y corrientes que cambian de
      un mes a otro. El Colegio de Navegantes que lo mantiene actualiza sus
      cartas constantemente, y vender una copia desactualizada a sabiendas se
      castiga con la expulsión permanente del gremio.</p>
      <p>Ni un solo reino de la región ha intentado tomar la isla por la fuerza,
      conscientes de que hacerlo pondría en riesgo el propio observatorio del
      que dependen sus flotas para no terminar como uno más de los cascos que
      pueblan los arrecifes cercanos. Piratas y comerciantes de bandos enfrentados
      comparten sus muelles sin incidentes por la misma razón práctica, hundir a
      un rival aquí no vale la pena si el precio es perder acceso a las únicas
      cartas capaces de mantenerlos con vida en aguas abiertas.</p>
    `
  },
  {
    id: "bancosur",
    title: "Bancosur",
    category: "Lugares",
    tags: ["aldea", "genevia", "gylas", "archipiélago"],
    summary: "Una de las cientos de pequeñas comunidades pesqueras de Genevia sin bandera ni gobierno propio, sostenida enteramente por el mar que la rodea.",
    region: "Genevia, Gylas",
    gobierno: "Sin gobierno propio",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Bancosur no aparece en ningún registro oficial de ningún reino, apenas
      un puñado de casas de madera construidas sobre pilotes en el extremo de un
      arrecife que ofrece, casi todo el año, pesca abundante y suficiente
      protección contra las peores tormentas. Sus habitantes viven exactamente
      como generaciones anteriores lo hicieron, sin necesidad ni deseo de que
      ningún reino los reclame.</p>
      <p>De vez en cuando, algún barco de Pelgiria o algún otro poder cercano
      pasa lo bastante cerca como para ofrecerles protección formal a cambio de
      tributo. La respuesta, invariablemente, es la misma cortés negativa.
      Bancosur ha sobrevivido tormentas, piratas y la indiferencia general del
      mundo durante generaciones sin necesitar una bandera. No ven motivo para
      empezar ahora.</p>
    `
  },
  {
    id: "refugio-de-la-marea",
    title: "Refugio de la Marea",
    category: "Lugares",
    tags: ["aldea", "genevia", "gylas", "archipiélago", "piratas"],
    summary: "Puerto discreto de Genevia donde tripulaciones piratas reparan barcos y descansan lejos del alcance de cualquier armada, siempre que respeten sus reglas locales.",
    region: "Genevia, Gylas",
    gobierno: "Código local, impuesto por consenso de capitanes",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Las armadas de Gylas nunca han logrado localizar Refugio de la Marea con
      precisión suficiente para atacarlo dos veces seguidas, escondido entre
      canales estrechos que cambian con las mareas lo bastante como para que
      solo quienes conocen la ruta puedan entrar sin encallar. Las tripulaciones
      piratas que lo utilizan pagan, a cambio de refugio, un código local de
      conducta que ningún capitán se atreve a romper.</p>
      <p>Pelear dentro del puerto está terminantemente prohibido, sin importar
      cuánta enemistad exista fuera de sus aguas, y quien lo intenta descubre
      rápidamente que el resto de las tripulaciones ancladas se une contra el
      infractor sin dudarlo. La regla ha mantenido a Refugio de la Marea
      funcionando como puerto neutral durante más tiempo del que cualquier
      pirata individual lleva navegando.</p>
    `
  },
  {
    id: "coral-hundido",
    title: "Coral Hundido",
    category: "Lugares",
    tags: ["ciudad", "genevia", "gylas", "archipiélago", "acuático"],
    summary: "Ciudad construida alrededor de un cementerio de naufragios, donde buzos y salvadores recuperan cargamentos perdidos de generaciones de tormentas y batallas navales.",
    region: "Genevia, Gylas",
    gobierno: "Gremio de Buzos y Salvadores",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Las aguas alrededor de Coral Hundido esconden más barcos hundidos que
      cualquier otro punto de Genevia, resultado de generaciones de tormentas,
      batallas navales y la simple mala suerte de navegar entre arrecifes
      traicioneros. El Gremio de Buzos y Salvadores que administra la ciudad ha
      convertido ese cementerio marino en la industria principal del lugar,
      recuperando cargamentos, metales y ocasionalmente algo más valioso que
      cualquier mapa de tesoros.</p>
      <p>Ni un solo reino reclama derechos sobre lo que Coral Hundido recupera de
      sus propios naufragios históricos, una laguna legal que la ciudad explota
      sin remordimiento. Los buzos más experimentados conocen el fondo marino
      cercano mejor que cualquier cartógrafo conoce la superficie, y algunos
      aseguran poder identificar un naufragio solo por la forma en que las
      corrientes se mueven sobre él.</p>
    `
  },
  {
    id: "nido-de-gaviotas",
    title: "Nido de Gaviotas",
    category: "Lugares",
    tags: ["aldea", "genevia", "gylas", "archipiélago"],
    summary: "Isla menor de Genevia donde generaciones de criadores han entrenado a las gaviotas mensajeras que sostienen la comunicación rápida entre las islas del archipiélago.",
    region: "Genevia, Gylas",
    gobierno: "Gremio de criadores",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Las jaulas y perchas que cubren la isla no están ahí por casualidad,
      Nido de Gaviotas cría y entrena a las aves que llevan mensajes urgentes
      entre puertos que, por barco, tardarían días en comunicarse. El oficio se
      transmite de padres a hijos, y cada familia guarda con celo los métodos que
      usa para que sus gaviotas vuelvan siempre a la percha correcta.</p>
      <p>Comerciantes, consejos portuarios y hasta algún que otro contrabandista
      pagan bien por un mensaje que llegue antes que cualquier barco rival. La
      demanda ha convertido a un caserío diminuto en un punto de paso obligado
      para cualquiera en Genevia que necesite noticias urgentes, aunque sus
      calles apenas alcancen para un puñado de familias.</p>
      <p>Los criadores más veteranos reconocen a sus mejores aves por el vuelo
      antes que por el plumaje, y se dice que algunas líneas de gaviotas llevan
      generaciones enteras sirviendo a la misma familia de mercaderes en
      Thalassar. Perder una cría entrenada a manos de un rival se considera un
      golpe casi tan grave como perder un barco, y los secretos del oficio no
      salen de la isla por ningún precio.</p>
    `
  },
  {
    id: "pelgiria",
    title: "Pelgiria",
    category: "Lugares",
    tags: ["reino", "genevia", "archipiélago"],
    summary: "El mayor archipiélago de Genevia.",
    region: "Genevia, Gylas",
    gobierno: "Islas con costumbres y gobernantes propios",
    religionPredominante: "Talasismo",
    lugaresDestacados: ["Thalassar (capital)", "Cala Ronca", "Campanario del Viento", "Huesos", "Isla de Sal", "Jardín de Coral", "Carenaria", "Perlamar", "Puerto Franco"],
    content: `
      <p>El mayor archipiélago de Genevia. Cada isla posee costumbres y gobernantes
      propios, unidos únicamente por el comercio marítimo y una profunda tradición
      naval. Sus habitantes conocen el océano mejor que cualquier otra civilización
      del mundo.</p>
      <p>Thalassar, su mayor puerto y capital de facto, funciona como un laberinto de
      muelles y mercados flotantes donde cada isla envía representantes a un consejo
      portuario que pocas veces logra un acuerdo unánime. Antiguos piratas
      reconvertidos en armadores respetados conviven con familias de navegantes que
      llevan generaciones surcando las mismas rutas, en un reino donde el mar importa
      mucho más que cualquier corona. Algunas de esas familias todavía navegan a
      lomos de escudontes, tortugas gigantescas de mar abierto tan longevas que un
      solo ejemplar puede acompañar a varias generaciones de marineros.</p>
      <p>Bajo la superficie que surcan barcos y rutas comerciales vive un pueblo que
      casi nunca emerge por necesidad. Los elfos del mar navegan las corrientes más
      profundas de Pelgiria con una gracia que ni los propios tritones alcanzan a
      igualar, pero prefieren asentamientos alejados de los muelles y mercados
      flotantes de Thalassar. Cuando alguno decide salir a la superficie suele ser
      por simple curiosidad, y los marineros que han compartido cubierta con uno
      cuentan que desaparece de nuevo bajo el agua tan pronto como sacia su
      interés.</p>
    `
  },
  {
    id: "sindra",
    title: "Sindra",
    category: "Lugares",
    tags: ["continente"],
    summary: "El continente más desarrollado tecnológica y económicamente del mundo conocido.",
    region: "",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: ["Merador", "Kretor", "Uldum"],
    content: `
      <p>El continente más desarrollado tecnológica y económicamente del mundo
      conocido. Grandes imperios, ciudades industriales y estados mercantes conviven
      en un delicado equilibrio político donde la innovación resulta tan importante
      como la fuerza militar, y donde una sola invención puede desplazar el poder
      de un reino entero de la noche a la mañana.</p>
      <p>Tres potencias definen el pulso de Sindra, el vasto Imperio de Balutia,
      que expande sus fronteras provincia a provincia desde el corazón de Kretor;
      la región mercante de Merador, donde Kalvia y las ciudades forjadoras de
      Goloria mueven más riqueza que la mayoría de los reinos combinados; y el
      fracturado Uldum, tierra de ruinas antiguas donde conviven la noche eterna de
      Nikaalia, el cementerio de dragones de Relania y la alianza bárbara de Har.
      Nernib, la ciudad-estado de los inventores, no pertenece a ninguna de las
      tres, y precisamente por eso vende su tecnología a todas ellas por igual.</p>
    `
  },
  {
    id: "merador",
    title: "Merador",
    category: "Lugares",
    tags: ["región", "sindra"],
    summary: "La región central de Sindra, histórico núcleo del Imperio de Balutia.",
    region: "Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: ["Goloria", "Ornamen", "Nernib (capital)"],
    content: `
      <p>La región central de Sindra. Históricamente fue el núcleo del Imperio de
      Balutia, motivo por el que aún hoy muchas de sus provincias conservan culturas
      propias a pesar de pertenecer al mismo imperio. Goloria funciona como su brazo
      militar, con ciudades fortificadas que alimentan a las legiones imperiales,
      mientras que Ornamen conserva casi intacta su religión y organización social
      originales, un privilegio que la corona pocas veces concede a un territorio
      conquistado.</p>
      <p>En el centro de Merador, Nernib se sostiene como una anomalía política, una
      ciudad-estado de inventores que nunca fue formalmente anexada al imperio, y
      que Balutia deja en paz como vecina independiente porque necesita su tecnología más
      de lo que le conviene conquistarla. Ningún otro punto del imperio combina tan
      de cerca la disciplina militar, la tradición religiosa y la innovación
      artificiera como esta región.</p>
    `
  },
  {
    id: "goloria",
    title: "Goloria",
    category: "Lugares",
    tags: ["provincia", "merador", "balutia"],
    summary: "La provincia occidental del Imperio, centro militar de Balutia.",
    region: "Merador, Sindra",
    gobierno: "Provincia del Imperio de Balutia",
    religionPredominante: "",
    lugaresDestacados: ["Castrianum (capital)", "Ferrastra", "Halara", "Granaria", "Dientes de Hierro", "Navium", "Vinculum", "Lanaria", "Río Ferrum", "Cañón de Ferrastra", "Rediles de Goloria", "El Carbonal"],
    content: `
      <p>La provincia occidental del Imperio. Reconocida por sus ciudades fortificadas
      y por servir como uno de los principales centros militares de Balutia, Goloria
      lleva generaciones formando a los oficiales que después comandan legiones en
      fronteras muy lejanas de su tierra natal. Castrianum, su capital, funciona
      tanto como sede administrativa como academia militar, y pocos nobles de la
      provincia consideran completa la educación de un hijo sin al menos un año de
      instrucción entre sus murallas.</p>
      <p>Bajo la superficie militar, Goloria arma a las legiones imperiales
      gracias a las minas de Los Dientes de Hierro y las forjas de
      Ferrastra, que trabajan con mano de obra conquistada bajo condiciones que la
      Corona prefiere no examinar demasiado de cerca. El Colegio de Vinculadores de
      Vinculum vigila de cerca a los elementales de tierra que la minería libera
      ocasionalmente, un recordatorio constante de que ni siquiera la provincia más
      disciplinada del imperio está completamente bajo control.</p>
    `
  },
  {
    id: "ornamen",
    title: "Ornamen",
    category: "Lugares",
    tags: ["provincia", "merador", "balutia"],
    summary: "La provincia meridional del Imperio de Balutia.",
    region: "Merador, Sindra",
    gobierno: "Provincia del Imperio de Balutia",
    religionPredominante: "Ternarismo",
    lugaresDestacados: ["Solenna (capital)", "Yunque Ardiente", "Triastra", "Vitrium", "La Boca de Ornamen", "Ternaria", "Marenna", "Termas de Ornamen", "Bosque de Triastra", "Cinabrio", "Puntafuego", "Rescoldo", "Alfar de Ceniza", "Huerta de Solenna", "Robledal Meridional", "Salinas del Cabo", "Capilla del Equilibrio", "Los Acantilados Grises", "Puerta de Ornamen", "Mercado Alto", "Cristalería Imperial", "Travesía", "Curtiduría del Norte", "Cráter Dormido", "Mosaicos de Ornamen", "Minas de Azufre", "El Observatorio del Cráter", "Viñedos de Brasa", "Cantera de Obsidiana", "Refugio de los Quemados", "Marea Tibia"],
    content: `
      <p>La provincia meridional del Imperio de Balutia. Aunque completamente integrada
      en el imperio, conserva sus tradiciones originales, visibles en
      su arquitectura, religión y organización social, y en especial en el
      Ternarismo, la fe dominante que interpreta la actividad volcánica constante de
      la región como una manifestación física de su propia teología. Los genasi
      ígneos nativos de Ornamen prosperan aquí como en ningún otro punto del
      imperio, trabajando el vidrio en Vitrium, la cerámica esmaltada en Alfar de
      Ceniza y el propio calor de la tierra en las salinas y termas que salpican la
      provincia.</p>
      <p>Solenna, su capital, administra un territorio donde la geografía manda
      tanto como la Corona, aldeas enteras se construyen alrededor de grietas
      volcánicas o dependen del calor residual del subsuelo para su industria. La
      Boca de Ornamen, punto de peregrinaje sagrado para el Ternarismo, atrae
      devotos de toda Kretor, y el propio Yunque Ardiente, la fortaleza forjada
      junto a su ladera, recuerda a cada visitante que en Ornamen la fe, la
      industria y la tierra misma siguen entrelazadas, sin separarse jamás por completo.</p>
    `
  },
  {
    id: "ferrastra",
    title: "Ferrastra",
    category: "Lugares",
    tags: ["ciudad", "goloria", "balutia"],
    summary: "Ciudad forjadora de Goloria donde el hierro de sus minas se convierte en armas y armaduras para las legiones imperiales.",
    region: "Goloria, Merador, Sindra",
    gobierno: "Ciudad bajo administración militar imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Una ciudad de forjas que nunca se apagan, construida junto a las minas de
      hierro que alimentan las guarniciones de Goloria. El humo de sus talleres se ve
      desde las murallas de la fortaleza más cercana, y el golpeteo constante de los
      martillos marca el paso de las horas mejor que cualquier campana.</p>
      <p>Quienes trabajan sus forjas no llegaron casi nunca por elección, sino
      como tributo de guerra, mano de obra conquistada que paga con años de trabajo lo que
      sus pueblos deben al Imperio. El acero que sale de Ferrastra no distingue entre
      manos leales y manos forzadas, y a la corona, sinceramente, tampoco parece
      importarle demasiado la diferencia.</p>
    `
  },
  {
    id: "castrianum",
    title: "Castrianum",
    category: "Lugares",
    tags: ["ciudad", "capital", "goloria", "merador", "balutia"],
    summary: "Capital provincial de Goloria y ciudad-academia donde se forman los oficiales del Imperio, hermanada con las forjas de Ferrastra que arman a sus cadetes.",
    region: "Goloria, Merador, Sindra",
    gobierno: "Comandancia militar imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Goloria es, según la doctrina oficial, el principal centro militar del
      Imperio, y Castrianum es la prueba de esa doctrina hecha ciudad, con patios
      de instrucción, murallas dobles y una academia que forma a los
      oficiales que después comandan legiones en fronteras que sus cadetes jamás
      llegan a ver desde la ciudad. Nadie se gradúa de Castrianum sin haber
      marchado, primero, las mismas calzadas que sus tropas marcharán después.</p>
      <p>Cada cadete recibe su primera espada de las forjas de Ferrastra, a poca
      distancia carretera adentro, y muchos oficiales conservan esa misma arma toda
      su carrera como recordatorio de dónde empezaron. La ciudad vigila además la
      costa occidental de Goloria, la única frontera de la provincia que no
      comparte con ninguna otra parte del imperio, y sus guarniciones nunca han
      bajado la guardia frente al mar.</p>
    `
  },
  {
    id: "halara",
    title: "Halara",
    category: "Lugares",
    tags: ["aldea", "goloria", "merador", "balutia"],
    summary: "Aldea pesquera y salinera en la costa de Goloria, que abastece de sal y pescado en salazón a las guarniciones de Castrianum.",
    region: "Goloria, Merador, Sindra",
    gobierno: "Aldea bajo administración militar imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Las salinas de Halara se extienden por la costa como tableros pálidos,
      cosechadas por familias que llevan generaciones extrayendo sal del mismo
      tramo de mar. Buena parte de esa sal, junto con el pescado que sus barcas
      traen a diario, termina en las raciones de los cadetes y legionarios de
      Castrianum, a poca distancia carretera adentro.</p>
      <p>Halara abastece casi exclusivamente a Goloria misma, no al resto del
      imperio como el hierro de Ferrastra, algo que sus habitantes mencionan con
      cierto orgullo local. Mientras otras aldeas de la provincia pagan tributo
      directo a Nigrastel, la suya alimenta primero a los soldados que defienden su
      propia costa.</p>
    `
  },
  {
    id: "granaria",
    title: "Granaria",
    category: "Lugares",
    tags: ["aldea", "goloria", "merador", "balutia"],
    summary: "Aldea agrícola de Goloria que alimenta a los cadetes de Castrianum y presta cuadrillas de cosecha a las forjas de Ferrastra, con ayuda ocasional de elementales de tierra vinculados.",
    region: "Goloria, Merador, Sindra",
    gobierno: "Aldea bajo administración militar imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Los graneros de Granaria alimentan a Castrianum y sus guarniciones desde que
      la ciudad-academia existe, con campos de trigo organizados en parcelas casi tan
      disciplinadas como los patios de instrucción que abastecen. Los administradores
      militares fijan cuotas de entrega con la misma rigidez que aplicarían a un envío
      de armas, y ningún agricultor local recuerda una cosecha tarde que no haya
      generado una visita incómoda de algún oficial de intendencia.</p>
      <p>Buena parte de la mano de obra estacional llega prestada de Ferrastra,
      cuadrillas de forjadores que cambian el martillo por la hoz durante las semanas
      de cosecha, cuando las forjas reducen turnos y el campo necesita brazos.
      Ocasionalmente, cuando la cosecha se atrasa, escoltas imperiales conducen
      elementales de tierra vinculados a través de los campos, prestados
      temporalmente de las minas cercanas, capaces de arar en una tarde lo que una
      cuadrilla humana tardaría una semana.</p>
    `
  },
  {
    id: "dientes-de-hierro",
    title: "Dientes de Hierro",
    category: "Lugares",
    tags: ["montaña", "goloria", "merador", "balutia"],
    summary: "Cordillera de Goloria que alimenta las forjas de Ferrastra, con galerías profundas donde los mineros a veces se topan con elementales de tierra que rompieron su vínculo.",
    region: "Goloria, Merador, Sindra",
    gobierno: "Concesión minera imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>La cordillera que los mineros llaman los Dientes de Hierro alimenta las
      forjas de Ferrastra desde que existe registro escrito de la provincia, con vetas
      de mineral tan ricas que el Imperio nunca ha necesitado buscar una segunda
      fuente en Goloria. Los túneles más profundos se excavan bajo supervisión de
      magos imperiales, no solo por la calidad del mineral, sino por lo que a veces se
      encuentra junto a él.</p>
      <p>Los vínculos fallidos de elementales de tierra, convocados originalmente para
      acelerar la extracción, terminan con más frecuencia de la que la corona admite
      abiertamente atrapados en las vetas más profundas de la montaña, sueltos de su
      convocación pero incapaces de abandonar la roca que los ató. Los mineros de
      Ferrastra aprenden pronto a reconocer el temblor particular que anuncia uno de
      estos encuentros, y ninguna cuadrilla entra a ciertas galerías sin un mago de
      guarnición cerca.</p>
    `
  },
  {
    id: "navium",
    title: "Navium",
    category: "Lugares",
    tags: ["ciudad", "goloria", "merador", "balutia", "costero"],
    summary: "Base naval imperial al sur de Halara, la única frontera marítima de Goloria, con astilleros que producen la mayoría de la flota del mar occidental.",
    region: "Goloria, Merador, Sindra",
    gobierno: "Almirantazgo imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Navium vigila la única frontera de Goloria que ninguna legión terrestre
      puede defender, al sur de las salinas de Halara, con astilleros que producen
      la flota que el Imperio mantiene en el mar occidental. Sus
      muelles apenas conocen el descanso, entre galeras de guerra en reparación y
      barcazas que llevan mineral de Ferrastra hacia puertos más lejanos.</p>
      <p>El Almirantazgo que gobierna la ciudad mantiene una rivalidad discreta con
      Castrianum, a poca distancia carretera adentro, sobre cuál de las dos
      instituciones merece más crédito por la seguridad de la provincia. Castrianum
      entrena oficiales que jamás pisan un barco; Navium entrena marinos que casi nunca
      ven un campo de batalla en tierra, y ambas escuelas están convencidas, en
      privado, de que la otra tiene el trabajo más fácil.</p>
    `
  },
  {
    id: "vinculum",
    title: "Vinculum",
    category: "Lugares",
    tags: ["ciudad", "goloria", "merador", "balutia", "magia"],
    summary: "Ciudad del Colegio de Vinculadores Imperiales, que convoca y supervisa a los elementales de tierra que trabajan los Dientes de Hierro y persigue a los que rompen su vínculo.",
    region: "Goloria, Merador, Sindra",
    gobierno: "Colegio de Vinculadores Imperiales",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Vinculum existe por una necesidad muy específica, supervisar a los
      elementales de tierra convocados para trabajar las minas de los Dientes de
      Hierro, a poca distancia de aquí, y contener a los que rompen su vínculo antes
      de que causen daños que Ferrastra no pueda absorber en su cadena de producción.
      El Colegio de Vinculadores Imperiales que gobierna la ciudad combina
      investigación arcana con administración minera de una forma que ninguna otra
      institución del imperio ha necesitado replicar.</p>
      <p>Cada convocación nueva se registra con un detalle casi obsesivo, nombre del
      elemental, fecha, mago responsable y condiciones del vínculo, porque los
      archivos de Vinculum son, en la práctica, el único mapa fiable de cuántos
      vínculos fallidos podrían seguir sueltos bajo la montaña. Los propios
      vinculadores admiten, entre ellos, que ese número probablemente sea más alto de
      lo que jamás informarán a la corona.</p>
    `
  },
  {
    id: "lanaria",
    title: "Lanaria",
    category: "Lugares",
    tags: ["aldea", "goloria", "merador", "balutia"],
    summary: "Aldea textil en el sur de Goloria que esquila y tiñe la lana que abastece los uniformes de las legiones imperiales.",
    region: "Goloria, Merador, Sindra",
    gobierno: "Aldea bajo administración militar imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Los rebaños que pastan alrededor de Lanaria producen la lana
      que termina convertida en capas, mantas y forros de las legiones imperiales, y
      sus telares trabajan a un ritmo que solo se detiene durante los meses más
      fríos, cuando el ganado necesita más atención que las hebras.</p>
      <p>El tinte característico de Lanaria, un rojo oscuro que ningún otro pueblo de
      la provincia ha conseguido replicar exactamente, distingue a simple vista un
      uniforme fabricado aquí de cualquier imitación, y los administradores militares
      de Castrianum insisten en comprar exclusivamente a los telares locales por esa
      misma razón. Falsificar el tinte de Lanaria se considera, en la práctica, casi
      tan grave como falsificar un rango militar.</p>
    `
  },
  {
    id: "rio-ferrum",
    title: "Río Ferrum",
    category: "Lugares",
    tags: ["río", "goloria", "merador", "balutia"],
    summary: "Río que transporta el mineral de los Dientes de Hierro hasta las forjas de Ferrastra y, finalmente, hasta los astilleros de Navium.",
    region: "Goloria, Merador, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El Río Ferrum nace en las laderas de los Dientes de Hierro, teñido de un
      óxido rojizo que le da nombre mucho antes de que alcance las forjas de
      Ferrastra, y barcazas de fondo plano bajan por su cauce cargadas de mineral en
      bruto a un ritmo que ningún carro terrestre igualaría.</p>
      <p>Río abajo, el agua se aclara lo suficiente como para que Navium la
      aproveche en sus astilleros, aunque los pescadores de la desembocadura todavía
      se quejan de un sabor metálico que ninguna generación ha logrado explicar del
      todo. Los ingenieros de Vinculum sospechan que el color del río guarda
      relación con los vínculos fallidos de la montaña, aunque ningún estudio
      oficial se ha atrevido a confirmarlo.</p>
    `
  },
  {
    id: "nernib",
    title: "Nernib",
    category: "Lugares",
    tags: ["ciudad-estado", "merador", "tecnología"],
    summary: "La ciudad-estado de inventores, capital de sí misma, una metrópolis de niveles elevados y bronce donde la innovación vale más que la nobleza.",
    region: "Merador, Sindra",
    gobierno: "Oligarquía de artificieros, ingenieros y científicos",
    religionPredominante: "Heliurgia",
    lugaresDestacados: ["Mekhanis", "Vitalor", "Vaporum", "Balistrix", "Runexis", "La Cantera de Bronce", "El Río de Vapor", "Pantano de Chatarra"],
    content: `
      <p>Nernib se construyó hacia arriba antes que hacia afuera. Plataformas de bronce
      y cristal se apilan una sobre otra, unidas por puentes mecánicos y ascensores
      rúnicos que suben y bajan a un ritmo constante. Los niveles superiores, donde
      reside la oligarquía de artificieros que gobierna la ciudad, brillan de noche con
      luces de artificio que ningún otro punto del mundo conocido puede replicar;
      abajo, en los talleres y fundiciones que sostienen esa riqueza, el ruido de los
      martillos y el vapor no se detiene jamás. Entre esas plataformas vigilan las
      Guardiópetras, antiguos constructos rúnicos con forma de estatua que custodian
      los niveles elevados desde mucho antes de que naciera la oligarquía actual;
      nadie recuerda quién grabó las runas que las mantienen en pie.</p>
      <p>Nunca tuvo un rey ni una corona propia. Gobernarse a sí misma como
      ciudad-estado y como capital al mismo tiempo le resultó, desde el principio, más
      eficiente que inventar una jerarquía que sus propios ciudadanos no
      necesitaban. Autómatas, prótesis mecánicas, motores de vapor y armas
      experimentales son parte de la vida cotidiana de una sociedad donde un
      artificiero brillante nacido en los niveles bajos tiene, al menos en teoría, el
      mismo camino hacia arriba que cualquier heredero de la oligarquía. Nernib capital
      concentra el gobierno y el comercio, pero cada especialidad tiene su propia
      ciudad satélite dentro de la ciudad-estado, cada una con su propio gremio y su
      propio orgullo. Una de sus exportaciones más singulares son los Mirmeción,
      guardianes creados con magia avanzada para controlar plagas de hormigas
      gigantes, vendidos por sus gremios con tanto orgullo como cualquier otro
      invento de la ciudad.</p>
      <p>La oligarquía de artificieros que gobierna la ciudad está compuesta, en su
      inmensa mayoría, de gnomos, aunque formalmente es el mérito técnico y no la
      raza lo que determina quién asciende en sus filas. Los warforged nacieron de
      esa misma obsesión por resolver problemas. Fueron construidos originalmente
      como autómatas para trabajos peligrosos, y en algún momento no determinado
      empezaron a tomar decisiones que nadie había programado. Hoy se los reconoce
      como ciudadanos con derechos plenos, aunque ni los propios gnomos que los
      diseñaron saben explicar con certeza qué los volvió conscientes.</p>
    `
  },
  {
    id: "mekhanis",
    title: "Mekhanis",
    category: "Lugares",
    tags: ["ciudad", "merador", "tecnología", "nernib"],
    summary: "Ciudad-taller de Nernib especializada en autómatas, desde sirvientes mecánicos domésticos hasta constructos de guardia que patrullan sus propias calles.",
    region: "Merador, Sindra",
    gobierno: "Gremio de Automatistas, bajo la oligarquía de Nernib",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>En Mekhanis nada camina que no haya sido construido primero. Sirvientes
      mecánicos ordenan las calles, mensajeros con patas de bronce corren entre
      talleres, y hasta la vigilancia nocturna corre a cargo de constructos armados
      que ningún gremio rival de Nernib ha logrado igualar en precisión. Sus propios
      habitantes bromean con que la ciudad tiene más autómatas que personas
      caminando por sus calles en cualquier momento del día.</p>
      <p>El Gremio de Automatistas mantiene una rivalidad amistosa, aunque no siempre
      discreta, con los artificieros de Balistrix, que insisten en que un buen
      autómata debería, ante todo, saber pelear. Mekhanis prefiere pensar en
      utilidad antes que en violencia, aunque nadie en la ciudad niega que sus
      últimos modelos de guardia podrían competir sin problema con cualquier arma
      experimental salida de la ciudad rival.</p>
    `
  },
  {
    id: "vitalor",
    title: "Vitalor",
    category: "Lugares",
    tags: ["ciudad", "merador", "tecnología", "nernib"],
    summary: "Ciudad-hospital de Nernib donde cirujanos y artificieros trabajan codo a codo para reemplazar lo que la guerra, el trabajo o la enfermedad se llevaron.",
    region: "Merador, Sindra",
    gobierno: "Colegio de Cirujanos-Artificieros, bajo la oligarquía de Nernib",
    religionPredominante: "Heliurgia",
    lugaresDestacados: [],
    content: `
      <p>Vitalor recibe pacientes de medio continente, desde veteranos de las
      legiones balutias hasta mineros de Goloria que perdieron un brazo en un
      derrumbe, pasando por algún noble dispuesto a pagar una fortuna por una mano
      mecánica más precisa que la original. Sus cirujanos-artificieros trabajan en
      pares, uno para el cuerpo y otro para el mecanismo, una división del trabajo
      que ninguna otra ciudad de Nernib ha necesitado replicar.</p>
      <p>La Heliurgia encuentra en Vitalor a algunos de sus fieles más devotos,
      porque para muchos pacientes despertar con una extremidad nueva funcionando
      bajo la luz del primer amanecer después de la cirugía se siente menos como
      ingeniería y más como un milagro. Los sacerdotes locales han dejado de
      corregirlos.</p>
    `
  },
  {
    id: "vaporum",
    title: "Vaporum",
    category: "Lugares",
    tags: ["ciudad", "merador", "tecnología", "nernib"],
    summary: "Ciudad-fábrica de Nernib cuyos motores de vapor mueven los ascensores, prensas y telares de toda la ciudad-estado.",
    region: "Merador, Sindra",
    gobierno: "Consorcio de Ingenieros del Vapor, bajo la oligarquía de Nernib",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El cielo sobre Vaporum siempre lleva algo de bruma, con columnas de vapor
      que suben día y noche desde cientos de chimeneas que alimentan las fábricas,
      prensas y telares que sostienen la economía de Nernib. El calor
      constante ha vuelto a sus habitantes casi inmunes a temperaturas que dejarían
      mareado a cualquier forastero en minutos.</p>
      <p>La energía que mueve los ascensores rúnicos de Nernib capital
      sale primero de aquí, transportada por tuberías presurizadas que cruzan la
      ciudad-estado entera. El Consorcio de Ingenieros del Vapor cobra por ese
      servicio una tarifa que ninguna otra ciudad de Nernib se atreve a cuestionar
      demasiado en voz alta.</p>
    `
  },
  {
    id: "balistrix",
    title: "Balistrix",
    category: "Lugares",
    tags: ["ciudad", "merador", "tecnología", "nernib"],
    summary: "Ciudad-arsenal de Nernib donde se diseñan y prueban las armas experimentales que después se venden, con generosos márgenes, a cualquier ejército dispuesto a pagarlas.",
    region: "Merador, Sindra",
    gobierno: "Arsenal Consorciado, bajo la oligarquía de Nernib",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Las afueras de Balistrix funcionan como campo de pruebas permanente,
      entre explosiones controladas, disparos de prototipos y el ocasional
      accidente memorable, algo tan cotidiano en su paisaje sonoro que sus
      habitantes han aprendido a distinguir, solo por el ruido, qué taller acaba
      de tener un buen día y cuál acaba de tener uno muy malo.</p>
      <p>Balistrix vende poder de fuego, no utilidad como Mekhanis, y no pregunta
      demasiado a quién vende. Legiones balutias, mercenarios de Chakur y hasta
      algún reino que oficialmente condena el comercio de armas figuran entre sus
      clientes habituales. El Arsenal Consorciado sostiene que la neutralidad
      comercial de Nernib es simplemente buen negocio.</p>
    `
  },
  {
    id: "runexis",
    title: "Runexis",
    category: "Lugares",
    tags: ["ciudad", "merador", "tecnología", "nernib"],
    summary: "Ciudad-laboratorio de Nernib donde runas mágicas y mecanismos de bronce se combinan en artefactos que ninguna otra escuela del mundo sabe replicar.",
    region: "Merador, Sindra",
    gobierno: "Cátedra de Magitécnica, bajo la oligarquía de Nernib",
    religionPredominante: "Heliurgia",
    lugaresDestacados: [],
    content: `
      <p>Runexis nació de una pregunta que ningún otro taller de Nernib se había
      tomado en serio, sobre qué pasaría si una runa mágica reemplazara, en vez de
      complementar, una pieza mecánica entera. Sus laboratorios combinan grabados
      arcanos con engranajes de precisión en artefactos que ninguna otra escuela de
      artificio del mundo conocido sabe replicar con exactitud, ni siquiera copiando el
      diseño terminado.</p>
      <p>Los ascensores rúnicos que conectan los niveles de Nernib capital nacieron
      aquí, y la Cátedra de Magitécnica sigue perfeccionando variantes cada vez más
      ambiciosas, como armas que se recargan solas, prótesis que aprenden del
      cuerpo que las porta o autómatas que ya no necesitan cuerda ni vapor para
      moverse. Cada avance nuevo, tarde o temprano, termina adoptado por Vitalor,
      Balistrix o Mekhanis, aunque Runexis siempre insiste en quedarse con el
      mérito original.</p>
    `
  },
  {
    id: "kretor",
    title: "Kretor",
    category: "Lugares",
    tags: ["región", "sindra", "balutia"],
    summary: "La región más poderosa del continente y centro político del Imperio de Balutia.",
    region: "Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: ["Nigrastel (capital)", "Nordea", "Balutia", "Grandeu", "Kalvia", "Paso Cerrado", "Frumentia", "Bosque de la Corona"],
    content: `
      <p>La región más poderosa del continente y centro político del Imperio de
      Balutia. Aunque el imperio gobierna desde una única corona, cada provincia
      conserva la cultura que poseía antes de su conquista, dando
      lugar a un territorio extraordinariamente diverso.</p>
      <p>Nordea, cuna histórica de la dinastía imperial, contrasta con Grandeu, la
      provincia más extensa y culturalmente heterogénea del imperio, y con Kalvia, un
      principado mercante que conserva su propio príncipe y su propia moneda pese a
      formar parte nominal de Kretor. Nigrastel, la capital imperial, se levanta en
      algún punto entre las tres, recordándoles a todas, con sus murallas y sus
      legiones permanentes, quién sostiene la corona en última instancia.</p>
    `
  },
  {
    id: "nordea",
    title: "Nordea",
    category: "Lugares",
    tags: ["provincia", "kretor", "balutia"],
    summary: "La cuna histórica del Imperio de Balutia.",
    region: "Kretor, Sindra",
    gobierno: "Provincia del Imperio de Balutia",
    religionPredominante: "",
    lugaresDestacados: ["Palatina (capital)", "Marcanor", "Vinealta", "Robledal de los Nombres", "Emporium", "Iuridia", "Custodia", "El Lago de las Casas", "Cascada de Vinealta", "Vado del Alba", "Atalaya del Norte", "Molino de Marcanor", "Los Huertos de Palatina"],
    content: `
      <p>La cuna histórica del imperio. Aquí nació la dinastía imperial y todavía se
      encuentran las ciudades más antiguas y prestigiosas de Balutia, empezando por
      Palatina, capital provincial y hogar simbólico de la Corona pese a que el
      poder real gobierna desde Nigrastel hace generaciones. Los linajes nobles más
      antiguos del imperio siguen concentrados aquí, y muchos consideran un origen
      nordeano casi tan valioso como un título formal a la hora de medir el
      prestigio de una familia.</p>
      <p>Esa antigüedad se nota en todo, desde los viñedos escalonados de Vinealta,
      cultivados desde antes de que el imperio existiera como tal, hasta el
      Robledal de los Nombres, arboleda sagrada donde se han tallado generaciones
      de linajes en la corteza de sus árboles más viejos. La provincia comercia
      activamente con Kalvia a través de rutas que cruzan la Atalaya del Norte, y
      esa cercanía con un vecino próspero ha convertido a Nordea en una de las
      regiones más ricas del imperio, tradición y comercio conviviendo sin mucha
      fricción entre sí.</p>
    `
  },
  {
    id: "balutia",
    title: "Imperio de Balutia",
    category: "Lugares",
    tags: ["imperio", "kretor"],
    summary: "El mayor imperio del mundo conocido.",
    region: "Kretor, Sindra",
    gobierno: "Corona imperial de Balutia",
    religionPredominante: "",
    lugaresDestacados: ["Nigrastel (capital)", "Nordea", "Grandeu", "Baluarte Umbrío", "El Yugo de Kretor", "Yunque Ardiente", "La Ergástula", "Paso Cerrado", "Confluencia", "Campoforja", "Vado Imperial", "Graneros de la Corona", "Aduana del Ámbar", "Vigía de Relania", "Canteras del Óbolo", "Castramoro", "El Miliario de Piedra", "Puente de las Legiones", "Río Imperial", "Catedral de la Corona", "Villa Cetrina", "Molino Imperial", "El Trifinio", "El Bosque Imperial", "Postas del Yugo", "Colinas del Ámbar", "Campo de Marcha", "Confín Imperial", "El Semillero", "Praesidium"],
    content: `
      <p>El mayor imperio del mundo conocido. Su política expansionista ha convertido a
      Balutia en la principal amenaza para el equilibrio internacional. El imperio
      incorpora las costumbres locales a su propia identidad en lugar de borrarlas,
      utilizando la diversidad cultural como una herramienta más para fortalecer su
      dominio. Un templo, un gremio o un linaje conquistado no suele desaparecer bajo
      la bandera imperial; simplemente aprende a servir a una corona nueva.</p>
      <p>La doctrina no nace de generosidad. Balutia mide a sus súbditos por utilidad,
      no por sangre, y un genasi ígneo de Sindra, un artificiero nacido en una provincia
      recién sometida o un mercenario extranjero pueden ascender en la jerarquía
      imperial tan rápido como cualquier noble de Nordea, siempre que
      demuestren que valen el gasto de mantenerlos. Quien no demuestra esa utilidad,
      o quien se resiste demasiado tiempo, termina con frecuencia pagando su
      tributo en los campos de La Ergástula o en las fundiciones del Yunque Ardiente.
      Ahí, los condenados a trabajar comparten las laderas volcánicas con dodogamas,
      criaturas de roca y mineral cuya saliva actúa como catalizador explosivo, y
      los capataces prefieren no molestarlas sin motivo. El Imperio no pregunta de
      dónde viene la fuerza; solo exige que rinda cuentas.</p>
      <p>Esa misma lógica sostiene la maquinaria que mantiene unido a un territorio
      tan vasto, con calzadas imperiales que conectan cada provincia con Nigrastel en
      cuestión de días, legiones permanentes acuarteladas a lo largo de las rutas
      comerciales, y una ciudadanía plena que, en contadas ocasiones pero de forma
      real, se ofrece a quienes sirven a la Corona el tiempo suficiente. Los gobernadores
      provinciales administran Nordea, Grandeu, Goloria y Ornamen con considerable
      autonomía local, siempre que el tributo llegue completo y a tiempo.</p>
      <p>Esa autonomía tiene un costo político. Generales, gobernadores y casas
      nobles compiten sin descanso por el favor de la Corona, y la
      expansión imperial de los últimos años responde tanto a la ambición personal de
      algún comandante deseoso de gloria como a cualquier plan de estado deliberado.
      La corte de Nigrastel es, en la práctica, un campo de batalla tan real como
      cualquier frontera —solo que ahí las armas son favores, deudas y información.</p>
    `
  },
  {
    id: "nigrastel",
    title: "Nigrastel",
    category: "Lugares",
    tags: ["ciudad", "capital", "kretor", "balutia"],
    summary: "Capital imperial de Balutia, una ciudad-fortaleza de piedra negra bajo un cielo permanentemente teñido de humo, construida en gran parte con tributo y mano de obra de las provincias conquistadas.",
    region: "Kretor, Sindra",
    gobierno: "Corte Imperial de Balutia",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Nigrastel no fue construida para ser hermosa. Sus murallas de piedra negra se
      alzan en anillos concéntricos alrededor del Palacio de la Corona, una torre que
      domina el horizonte de la ciudad y que, según cuentan los viajeros, es visible
      desde cualquier punto de Kretor en un día despejado, algo que, dado el humo
      constante de las forjas imperiales que cubre la ciudad, ocurre pocas veces al
      año. Cada anillo de murallas conmemora una conquista distinta, y los estandartes
      capturados de docenas de reinos y provincias cuelgan permanentemente de sus
      almenas, tan desteñidos por el hollín que muchos ya no se distinguen entre sí.</p>
      <p>Buena parte de la ciudad se construyó, y se sigue ampliando, con piedra,
      mano de obra y riqueza extraídas como tributo de guerra de cada territorio que
      la Corona incorpora al imperio. Legiones enteras acampan de forma permanente en sus
      afueras, y las calzadas que salen de sus puertas hacia Nordea, Grandeu y el resto
      de las provincias están diseñadas, ante todo, para mover tropas con rapidez.
      Ningún ciudadano de Nigrastel olvida, ni por un momento, que vive en el corazón
      de la maquinaria que conquistó su mundo.</p>
    `
  },
  {
    id: "el-semillero",
    title: "El Semillero",
    category: "Lugares",
    tags: ["ciudad", "kretor", "balutia"],
    summary: "Academia-orfanato en el corazón de Kretor que recoge a los huérfanos de las guerras fronterizas del Imperio y los devuelve, años después, a las mismas legiones que los dejaron sin familia.",
    region: "Kretor, Sindra",
    gobierno: "Gobernador Aurelio Ferrox, por nombramiento directo de la Corona",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Oficialmente, El Semillero es una de las instituciones más
      celebradas de la Corona, un refugio donde los huérfanos que dejan
      atrás las guerras fronterizas de Balutia reciben comida, techo e
      instrucción que en cualquier otra circunstancia jamás habrían tenido.
      El Gobernador Aurelio Ferrox, que administra la institución desde su
      fundación, la describe en cada informe anual como la prueba de que el
      imperio no abandona a quienes su propia expansión deja sin nada.</p>
      <p>Lo que esos informes no detallan es que casi ningún huérfano sale
      de El Semillero hacia una vida distinta de la que perdió, cada
      graduación nutre directamente a las legiones que necesitan reponer
      bajas en la misma frontera que los dejó sin familia. El Gobernador
      defiende el sistema como algo simplemente lógico cuando alguien se lo
      pregunta, un imperio en guerra necesita soldados, la guerra produce
      huérfanos, y un huérfano entrenado desde niño es un soldado que ya no
      tiene nada más que perder. Pocos en la Corte se atreven a preguntar en
      voz alta por qué las fronteras que alimentan El Semillero arden con
      tanta regularidad.</p>
    `
  },
  {
    id: "confluencia",
    title: "Confluencia",
    category: "Lugares",
    tags: ["ciudad", "kretor", "balutia"],
    summary: "Nudo de calzadas imperiales donde convergen las rutas de Nordea, Ornamen y Grandeu antes de llegar a Nigrastel, punto de paso obligado para tropas y tributo.",
    region: "Kretor, Sindra",
    gobierno: "Intendencia militar imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Cuatro calzadas imperiales se cruzan en Confluencia antes de unirse en la
      única vía que lleva directamente a Nigrastel, convirtiendo a la ciudad en un
      cuello de botella que la administración militar vigila con más cuidado que
      cualquier frontera exterior. Convoyes de tributo procedentes de Nordea,
      Ornamen y Grandeu se reagrupan aquí antes de completar el último tramo hacia
      la capital, escoltados por legiones que se relevan por turnos.</p>
      <p>La ciudad creció alrededor de los depósitos de la intendencia, con
      posadas, herrerías y mercados que dependen casi por completo del tráfico
      constante entre las provincias y el corazón del imperio. Cuando una vía se
      corta por mal tiempo o disturbios locales, Confluencia es la primera en
      notar el atasco de carretas que se acumula en sus puertas.</p>
    `
  },
  {
    id: "campoforja",
    title: "Campoforja",
    category: "Lugares",
    tags: ["aldea", "kretor", "balutia"],
    summary: "Aldea de artesanos reasentados por decreto imperial en el corazón de Kretor, cada familia originaria de una provincia distinta y obligada a producir para las forjas de Nigrastel.",
    region: "Kretor, Sindra",
    gobierno: "Administración imperial directa",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Cada familia de Campoforja llegó de una provincia distinta, trasladada
      por decreto imperial décadas atrás para concentrar en un mismo lugar los
      oficios que Nigrastel necesitaba con más urgencia. Herreros de Grandeu,
      talladores de Ornamen y tejedores de Nordea conviven en calles que todavía
      conservan, en los nombres de sus barrios, el recuerdo de dónde vino cada
      linaje fundador.</p>
      <p>La producción de la aldea se destina casi por completo a la capital, y
      sus habitantes reciben a cambio exenciones fiscales que en cualquier otra
      provincia despertarían envidia. Pocos se atreven a decir en voz alta que
      preferirían haberse quedado en sus tierras de origen.</p>
    `
  },
  {
    id: "vado-imperial",
    title: "Vado Imperial",
    category: "Lugares",
    tags: ["aldea", "fortaleza", "kretor", "balutia"],
    summary: "Guarnición sobre el único vado seguro del río que separa el corazón de Kretor de la frontera con Grandeu, controlada por la Corona para regular el paso de tropas y mercancía.",
    region: "Kretor, Sindra",
    gobierno: "Guarnición imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El resto del río se vuelve intransitable poco después de la crecida
      anual, así que todo el tráfico entre el corazón de Kretor y Grandeu termina
      pasando por este único vado seguro. La Corona mantiene ahí una guarnición
      permanente con instrucciones claras, nadie cruza sin declarar carga y
      destino, y las patrullas registran cada carreta con una minuciosidad que
      exaspera a los mercaderes en días de mucho tráfico.</p>
      <p>Un pequeño mercado se instala junto a la guarnición durante los meses de
      mayor tránsito, aprovechando la espera obligada de las caravanas para vender
      comida caliente y forraje a precios que solo un monopolio de facto permite
      sostener.</p>
    `
  },
  {
    id: "graneros-de-la-corona",
    title: "Graneros de la Corona",
    category: "Lugares",
    tags: ["aldea", "kretor", "balutia"],
    summary: "Complejo de silos y depósitos donde se almacena el grano recaudado como tributo de Nordea, Ornamen y Grandeu antes de repartirse entre las legiones del imperio.",
    region: "Kretor, Sindra",
    gobierno: "Intendencia militar imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Filas de silos de piedra se alzan sobre el terreno más seco de todo
      Kretor, elegido por su capacidad particular para mantener el grano libre
      de humedad durante años si es necesario. Aquí converge el
      tributo agrícola de Nordea, Ornamen y Grandeu, calculado y almacenado por
      escribas imperiales que llevan registro de cada provincia hasta el último
      saco.</p>
      <p>En años de mala cosecha, la Corona decide desde estos graneros qué
      provincias reciben ayuda y cuáles deben resolver su escasez por cuenta
      propia, una decisión que pesa más en la política interna del imperio de lo
      que cualquier discurso desde Nigrastel podría lograr.</p>
    `
  },
  {
    id: "castramoro",
    title: "Castramoro",
    category: "Lugares",
    tags: ["aldea", "kretor", "balutia"],
    summary: "Antiguo campamento de marcha de las legiones imperiales, convertido en asentamiento permanente en el corazón de Kretor después de generaciones de uso continuo.",
    region: "Kretor, Sindra",
    gobierno: "Veteranos licenciados, bajo supervisión imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Cada legión que marcha entre Nordea y Grandeu acampa, por costumbre
      más que por orden expresa, en el mismo terreno que sus predecesoras
      usaron durante generaciones. Con el tiempo, las empalizadas temporales se
      volvieron zanjas permanentes, y las zanjas se volvieron calles, hasta que
      Castramoro dejó de ser un campamento y se convirtió en un pueblo con
      nombre propio.</p>
      <p>Muchos de sus habitantes son veteranos licenciados que decidieron
      quedarse en lugar de volver a sus provincias de origen, y el trazado
      entero sigue el plano militar clásico con una precisión que ningún
      urbanista civil se molestó nunca en corregir. Las nuevas legiones que
      acampan aquí encuentran, sin saberlo, exactamente el mismo esquema que
      usaron sus abuelos.</p>
    `
  },
  {
    id: "praesidium",
    title: "Praesidium",
    category: "Lugares",
    tags: ["ciudad", "kretor", "balutia"],
    summary: "Ciudad-corte del General Maxencio Ilyth, comandante de la Novena Legión, que gobierna su territorio con una autoridad tan absoluta que muchos en Kretor la consideran un reino dentro del Imperio.",
    region: "Kretor, Sindra",
    gobierno: "General Maxencio Ilyth, comandante de la Novena Legión",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>La Novena Legión no jura lealtad a la Corona en primer lugar, sino
      al General Maxencio Ilyth, un detalle que Nigrastel prefiere ignorar porque
      ningún otro comandante ha logrado mantener la frontera oriental tan
      segura ni tan barata. Praesidium creció alrededor de su cuartel
      general hasta convertirse en una corte en miniatura, con sus propios
      tribunales, su propia moneda de curso interno y una guardia personal
      que responde antes al General que a cualquier edicto imperial.</p>
      <p>Ilyth trata a los demás generales y gobernadores de Kretor como
      pares antes que como colegas, tejiendo alianzas y rivalidades que
      tienen tanto de estrategia militar como de ajedrez cortesano. La
      Corona observa ese equilibrio de poder sin intervenir, consciente de
      que cualquier intento de recortar la autoridad de Ilyth podría costar
      más de lo que vale la pena arriesgar, y de que un día, si la sucesión
      alguna vez se abre, hombres como él serán quienes decidan el
      resultado.</p>
    `
  },
  {
    id: "miliario-de-piedra",
    title: "El Miliario de Piedra",
    category: "Lugares",
    tags: ["aldea", "kretor", "balutia"],
    summary: "Aldea que creció alrededor del miliario central de Kretor, el punto desde el que se miden todas las distancias oficiales del Imperio de Balutia.",
    region: "Kretor, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Todo mapa imperial mide sus distancias a partir del bloque de piedra
      grabado que da nombre a la aldea, colocado hace siglos por topógrafos que
      calcularon el punto más equidistante entre las provincias que entonces
      formaban el imperio. Aunque el territorio creció mucho desde entonces, la
      Corona nunca autorizó mover el miliario original, así que las distancias
      oficiales siguen calculándose desde aquí aunque ya no sea, en la
      práctica, el centro geográfico de nada.</p>
      <p>Comerciantes y mensajeros ajustan sus tarifas de viaje según las
      marcas talladas en el propio bloque, y disputar una distancia oficial
      significa, en la práctica, discutir con una piedra que lleva siglos sin
      moverse ni un palmo.</p>
    `
  },
  {
    id: "puente-de-las-legiones",
    title: "Puente de las Legiones",
    category: "Lugares",
    tags: ["fortaleza", "kretor", "balutia"],
    summary: "Torre-puente en el corazón de Kretor construida para que las legiones crucen un barranco sin desviarse de la ruta directa entre Nordea y Grandeu.",
    region: "Kretor, Sindra",
    gobierno: "Guarnición imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El barranco que corta esta ruta habría obligado a cualquier legión a un
      rodeo de días, así que los ingenieros imperiales levantaron una
      torre-puente lo bastante ancha para que columnas enteras la crucen en
      formación de marcha sin romper el paso. Las almenas superiores vigilan
      el valle en ambas direcciones, y ninguna caravana cruza sin que la
      guarnición registre su carga.</p>
      <p>La estructura ha resistido crecidas, terremotos menores y al menos un
      intento de sabotaje que sus defensores recuerdan con más orgullo del que
      admiten en voz alta. Perder el puente significaría cortar en dos la ruta
      militar más importante del corazón del imperio, algo que la Corona no
      está dispuesta a arriesgar.</p>
    `
  },
  {
    id: "rio-imperial",
    title: "Río Imperial",
    category: "Lugares",
    tags: ["río", "kretor", "balutia"],
    summary: "Curso de agua que atraviesa el corazón de Kretor de norte a sur, principal vía de transporte fluvial entre Nordea y las provincias del sur.",
    region: "Kretor, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Barcazas cargadas de tributo, tropas y correspondencia oficial bajan
      por el Río Imperial casi a diario, aprovechando una corriente lo
      bastante mansa como para navegar en ambas direcciones sin depender del
      viento. Su nombre no es una exageración retórica, la Corona clasificó
      formalmente sus aguas como vía militar prioritaria hace generaciones, y
      cualquier tráfico civil cede el paso cuando pasa un convoy oficial.</p>
      <p>Pueblos ribereños de toda la provincia dependen del río tanto para
      comerciar como para desplazarse, y los pocos puentes que lo cruzan están
      vigilados con el mismo cuidado que las murallas de Nigrastel.</p>
    `
  },
  {
    id: "catedral-de-la-corona",
    title: "Catedral de la Corona",
    category: "Lugares",
    tags: ["catedral", "kretor", "balutia"],
    summary: "Templo estatal en el corazón de Kretor donde se coronan los emperadores de Balutia, construido para representar a todas las provincias sometidas bajo un mismo techo.",
    region: "Kretor, Sindra",
    gobierno: "Clero estatal imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Cada emperador de Balutia recibe la corona en este templo, cuyas
      naves laterales exhiben símbolos religiosos de cada provincia y pueblo
      sometido, dispuestos sin jerarquía visible como recordatorio de que
      todos sirven a la misma corona por igual. El altar central no pertenece
      a ningún culto en particular, una decisión deliberada para que la
      ceremonia de coronación no favorezca a una fe sobre otra.</p>
      <p>Fuera de las coronaciones, la catedral funciona como archivo de
      tratados y juramentos de vasallaje, custodiados por un clero estatal
      que no responde a ninguna religión específica sino directamente a la
      Corona. Romper un juramento firmado aquí se considera, en la práctica
      totalidad del imperio, una ofensa tanto política como sagrada.</p>
    `
  },
  {
    id: "villa-cetrina",
    title: "Villa Cetrina",
    category: "Lugares",
    tags: ["aldea", "kretor", "balutia"],
    summary: "Aldea de cetreros imperiales en el corazón de Kretor que cría y entrena a las aves usadas para comunicación rápida entre Nigrastel y las provincias.",
    region: "Kretor, Sindra",
    gobierno: "Cuerpo de cetrería imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Las aves que salen de Villa Cetrina llevan mensajes oficiales a
      velocidades que ningún jinete podría igualar, entrenadas por
      generaciones de cetreros al servicio directo de la Corona. Cada nido
      registrado responde a un código de silbidos distinto, y perder un ave
      entrenada se investiga tan a fondo como la pérdida de un mensajero
      humano.</p>
      <p>El Cuerpo de Cetrería mantiene rutas fijas entre Nigrastel y cada
      capital provincial, y sus aves más veteranas conocen el trayecto tan
      bien que no suelen necesitar supervisión una vez lanzadas. Villa Cetrina
      entera vive de ese oficio, y sus habitantes tratan a las aves con un
      respeto que roza la veneración.</p>
    `
  },
  {
    id: "molino-imperial",
    title: "Molino Imperial",
    category: "Lugares",
    tags: ["aldea", "kretor", "balutia"],
    summary: "Complejo de molinos harineros en el corazón de Kretor que procesa el grano de los Graneros de la Corona antes de distribuirlo a las legiones.",
    region: "Kretor, Sindra",
    gobierno: "Intendencia militar imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El grano que sale de los Graneros de la Corona llega primero a
      Molino Imperial, donde una hilera de ruedas hidráulicas lo convierte en
      la harina que alimenta a las legiones destacadas en todo Kretor. Las
      ruedas giran día y noche durante la temporada de mayor demanda militar,
      y los molineros trabajan por turnos para no detener la producción ni
      una hora.</p>
      <p>La Intendencia fija cuotas estrictas de reparto entre guarniciones,
      y un déficit de harina en cualquier fortaleza cercana se investiga
      primero aquí antes que en cualquier otro punto de la cadena de
      suministro.</p>
    `
  },
  {
    id: "el-trifinio",
    title: "El Trifinio",
    category: "Lugares",
    tags: ["ciudad", "kretor", "balutia"],
    summary: "Ciudad administrativa levantada en el punto exacto donde convergen las fronteras de Ornamen, Grandeu y el corazón de Kretor, sede de los tribunales que resuelven disputas interprovinciales.",
    region: "Kretor, Sindra",
    gobierno: "Tribunal interprovincial imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Tres fronteras provinciales se tocan en un único punto dentro de El
      Trifinio, marcado en el centro de la ciudad con una columna de piedra
      que ningún gobernador local tiene autoridad para mover. La disposición
      no es casualidad, la Corona fundó la ciudad deliberadamente sobre ese
      punto para que ningún litigio entre Ornamen, Grandeu y el resto de
      Kretor tuviera que resolverse en territorio que favoreciera a una de
      las partes.</p>
      <p>El tribunal que administra la ciudad atiende disputas de límites,
      aguas compartidas y rutas comerciales que cruzan más de una provincia,
      y sus jueces se seleccionan específicamente de fuera de las tres
      jurisdicciones en conflicto para evitar cualquier sospecha de
      favoritismo. Perder un caso en El Trifinio se considera, en los
      círculos administrativos del imperio, una humillación mayor que
      perderlo en cualquier tribunal provincial ordinario.</p>
    `
  },
  {
    id: "bosque-imperial",
    title: "El Bosque Imperial",
    category: "Lugares",
    tags: ["bosque", "kretor", "balutia"],
    summary: "Coto de caza y reserva maderera en el corazón de Kretor, administrado directamente por la Corona para abastecer a Nigrastel de leña y piezas de caza.",
    region: "Kretor, Sindra",
    gobierno: "Administración imperial directa",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Toda concesión privada queda excluida del Bosque Imperial, reservado
      por decreto de la Corona para abastecer directamente a Nigrastel de
      leña, madera de construcción y piezas de caza reservadas a la mesa
      imperial. Guardabosques con rango militar patrullan sus senderos, y
      cazar sin permiso expreso se castiga como si fuera un delito contra la
      propia Corona.</p>
      <p>Cada otoño, una cacería ceremonial reúne a nobles de toda Kretor
      invitados personalmente por la corte, un privilegio tan codiciado que
      algunas familias esperan generaciones por una invitación. El resto del
      año, el bosque permanece prácticamente vacío salvo por sus
      guardabosques, silencioso de una manera que pocos lugares tan cerca de
      la capital logran igualar.</p>
    `
  },
  {
    id: "postas-del-yugo",
    title: "Postas del Yugo",
    category: "Lugares",
    tags: ["aldea", "kretor", "balutia"],
    summary: "Aldea de relevo en el camino hacia El Yugo de Kretor donde los mensajeros imperiales cambian de montura antes de completar el último tramo hacia la frontera con Nordea.",
    region: "Kretor, Sindra",
    gobierno: "Cuerpo de mensajería imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Todo mensajero imperial cambia de montura en Postas del Yugo antes de
      completar el trayecto hacia El Yugo de Kretor, donde establos
      permanentemente abastecidos garantizan que ni el cansancio del caballo
      ni el clima retrasen un despacho urgente. El Cuerpo de mensajería
      mantiene un registro estricto de cada relevo, y un caballo devuelto en
      mal estado genera una investigación tan seria como un mensaje
      extraviado.</p>
      <p>La aldea vive casi por completo de ese tránsito constante, con
      posadas y herrerías que atienden tanto a mensajeros oficiales como a
      los pocos viajeros civiles que aprovechan la misma ruta hacia Custodia
      y el Yugo. Nadie en Postas del Yugo recuerda un día sin al menos un
      jinete pasando a toda velocidad por su única calle principal.</p>
    `
  },
  {
    id: "colinas-del-ambar",
    title: "Colinas del Ámbar",
    category: "Lugares",
    tags: ["naturaleza", "kretor", "balutia"],
    summary: "Colinas del este de Kretor donde se extrae el ámbar fósil que los mercaderes de Kalvia tasan y revenden en la Aduana del Ámbar cercana.",
    region: "Kretor, Sindra",
    gobierno: "Concesión imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Bajo la tierra suelta de estas colinas se acumulan generaciones de
      resina fosilizada, expuesta poco a poco por la erosión y recogida por
      familias que conocen de memoria qué laderas dan mejor cosecha después
      de una temporada de lluvias fuertes. El ámbar más limpio viaja
      directamente a la Aduana cercana, donde los inspectores lo separan del
      que todavía necesita pulido antes de la venta.</p>
      <p>Algunas piezas conservan insectos o fragmentos vegetales atrapados
      en su interior, y esas se venden aparte a coleccionistas dispuestos a
      pagar varias veces el precio del ámbar común. Los recolectores locales
      las reconocen a simple vista incluso cubiertas de tierra, un ojo
      entrenado durante toda una vida de escarbar las mismas colinas.</p>
    `
  },
  {
    id: "campo-de-marcha",
    title: "Campo de Marcha",
    category: "Lugares",
    tags: ["aldea", "kretor", "balutia"],
    summary: "Campo de entrenamiento en el corazón de Kretor donde las legiones practican formaciones de marcha antes de desplegarse hacia las provincias.",
    region: "Kretor, Sindra",
    gobierno: "Guarnición imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El terreno llano de Campo de Marcha se eligió específicamente por su
      falta de accidentes geográficos, ideal para que legiones recién
      formadas practiquen las formaciones cerradas que después mantendrán en
      campaña real. El suelo lleva tanto tiempo compactado por botas
      marchando en formación que apenas crece hierba en las rutas de
      entrenamiento más usadas.</p>
      <p>Veteranos retirados se ganan la vida aquí como instructores,
      cobrando por adiestrar a reclutas que en unos meses partirán hacia
      fronteras que ellos mismos defendieron años atrás. La aldea que creció
      alrededor del campo vive casi por completo de abastecer a la guarnición
      y a las familias que vienen a despedir a sus hijos antes del primer
      despliegue.</p>
    `
  },
  {
    id: "confin-imperial",
    title: "Confín Imperial",
    category: "Lugares",
    tags: ["ciudad", "kretor", "balutia"],
    summary: "Ciudad administrativa en el límite sureste del corazón de Kretor, último punto de control imperial directo antes de que el territorio pase a manos de los gobernadores de Grandeu.",
    region: "Kretor, Sindra",
    gobierno: "Intendencia imperial fronteriza",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Confín Imperial marca, en la práctica administrativa, el límite
      exacto donde termina el control directo de la Corona y empieza la
      autoridad delegada de los gobernadores de Grandeu. Todo decreto que
      viaja hacia esa provincia se registra aquí por última vez antes de
      salir de la supervisión inmediata de Nigrastel, y todo tributo que
      entra se revisa aquí por primera vez.</p>
      <p>Los funcionarios destinados a Confín Imperial consideran su puesto
      un peldaño necesario pero incómodo, ni lo bastante prestigioso como la
      capital ni lo bastante lejano como para sentirse una aventura. La
      ciudad misma parece compartir ese ánimo, ordenada y funcional, sin
      ninguna ambición particular de destacar más allá de cumplir su función.</p>
    `
  },
  {
    id: "aduana-del-ambar",
    title: "Aduana del Ámbar",
    category: "Lugares",
    tags: ["ciudad", "kretor", "balutia", "mercante"],
    summary: "Ciudad aduanera en el este de Kretor donde las caravanas de Kalvia pagan aranceles imperiales antes de internarse en el corazón de Balutia.",
    region: "Kretor, Sindra",
    gobierno: "Aduana imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Toda caravana que entra a Kretor desde Kalvia pasa primero por la Aduana
      del Ámbar, donde funcionarios imperiales tasan cada carga según tablas que
      se actualizan varias veces al año. El nombre viene de las resinas fósiles
      que los mercaderes kalvianos traen en abundancia, una de las mercancías que
      más disputas de valuación genera entre los inspectores.</p>
      <p>La relación entre Balutia y el principado mercante se sostiene, en buena
      parte, sobre los aranceles que se cobran aquí, y cualquier intento de
      Kalvia por renegociar las tarifas termina, tarde o temprano, discutiéndose
      en esta misma ciudad antes de llegar a Nigrastel.</p>
    `
  },
  {
    id: "vigia-de-relania",
    title: "Vigía de Relania",
    category: "Lugares",
    tags: ["aldea", "fortaleza", "kretor", "balutia"],
    summary: "Guarnición imperial en el límite oriental de Kretor que vigila la frontera con Relania, atenta a los dragones que ocasionalmente sobrevuelan el territorio imperial.",
    region: "Kretor, Sindra",
    gobierno: "Guarnición imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Balutia y Relania mantienen una paz incómoda, y Vigía de Relania existe
      para asegurarse de que siga siendo así. Sus centinelas vigilan tanto
      movimientos de tropas como el vuelo ocasional de algún dragón que se
      aventura más allá de su territorio, un evento que activa protocolos de
      alerta que ninguna otra guarnición fronteriza de Kretor necesita ensayar.</p>
      <p>La Corona prefiere mantener el trato diplomático con Relania antes que
      arriesgar un conflicto abierto, así que las órdenes son claras, observar,
      registrar y no provocar. Los soldados destinados aquí aprenden rápido a
      distinguir un sobrevuelo curioso de una amenaza real.</p>
    `
  },
  {
    id: "canteras-del-obolo",
    title: "Canteras del Óbolo",
    category: "Lugares",
    tags: ["aldea", "kretor", "balutia"],
    summary: "Canteras del este de Kretor que proveen la piedra empleada en la expansión constante de las murallas de Nigrastel.",
    region: "Kretor, Sindra",
    gobierno: "Concesión imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Cada anillo nuevo de murallas que se añade a Nigrastel sale, casi en su
      totalidad, de estas canteras. Los bloques se cortan según medidas exactas
      dictadas por los arquitectos imperiales, y las cuadrillas que trabajan aquí
      reciben paga por bloque terminado, no por jornada, un sistema que mantiene
      la producción constante incluso en los meses más duros.</p>
      <p>El nombre de las canteras viene de la moneda con la que tradicionalmente
      se pagaba a los primeros canteros, retirada de circulación hace siglos pero
      todavía usada como unidad informal de cálculo entre los capataces del
      lugar.</p>
    `
  },
  {
    id: "frumentia",
    title: "Frumentia",
    category: "Lugares",
    tags: ["aldea", "kretor", "balutia"],
    summary: "Aldea agrícola en el corazón de Kretor que alimenta directamente a Nigrastel, sin la intermediación de ningún gobernador provincial.",
    region: "Kretor, Sindra",
    gobierno: "Aldea bajo administración imperial directa",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Frumentia carga con un peso logístico que ninguna otra aldea soporta, la
      más cercana de las tierras agrícolas que alimentan a Nigrastel directamente, sin la
      intermediación de un gobernador provincial que reclame primero su parte del
      tributo. Sus campos se organizan según calendarios fijados desde la propia
      corte imperial, no desde ninguna administración local.</p>
      <p>Vivir tan cerca del corazón del Imperio tiene sus ventajas, con calzadas
      mejor mantenidas que en cualquier otra aldea de Kretor y protección legionaria
      casi constante, pero también sus costos. Ningún funcionario de Nigrastel
      acepta jamás una excusa para una cosecha tardía, sin importar cuánto se aleje
      esa excusa de la aldea misma.</p>
    `
  },
  {
    id: "bosque-de-la-corona",
    title: "Bosque de la Corona",
    category: "Lugares",
    tags: ["bosque", "kretor", "balutia"],
    summary: "Coto de caza reservado a la familia imperial en el corazón de Kretor, vigilado con más celo que varias fronteras del Imperio.",
    region: "Kretor, Sindra",
    gobierno: "Reserva imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Cazar dentro del Bosque de la Corona, sea súbdito noble o plebeyo, exige
      invitación expresa de la familia imperial, un privilegio que se concede
      con tanta escasez que la mayoría de los generales de Balutia jamás recibe la
      oportunidad en toda su carrera. Los guardabosques que lo vigilan responden
      directamente ante Nigrastel, no ante ningún gobernador provincial.</p>
      <p>Se dice que cada emperador desde la fundación de la dinastía ha cazado al
      menos una vez entre sus árboles, y que algunas de las decisiones políticas más
      importantes de la historia imperial se cerraron durante esas cacerías, lejos de
      la corte y sus intrigas. Nadie fuera de la familia imperial sabe con certeza
      cuántas de esas historias son ciertas y cuántas simplemente convenientes.</p>
    `
  },
  {
    id: "grandeu",
    title: "Grandeu",
    category: "Lugares",
    tags: ["provincia", "kretor", "balutia"],
    summary: "La provincia más extensa del Imperio de Balutia.",
    region: "Kretor, Sindra",
    gobierno: "Provincia del Imperio de Balutia",
    religionPredominante: "",
    lugaresDestacados: ["Ducalia (capital)", "Baluarte Umbrío", "Tolvera", "La Ergástula", "Victrix", "Quercia", "Equitania", "Cumbres de Ceniza", "Compitum", "Horrea", "Caudal Alto", "Lago de Tolvera", "Cantera Gris", "El Río Fúlgido", "La Cresta Gris", "Atalaya de Ducalia", "Capilla de los Legionarios"],
    content: `
      <p>La provincia más extensa del imperio. Su enorme territorio alberga
      incontables pueblos y culturas que, pese a formar parte de Balutia desde hace
      generaciones, conservan una identidad claramente diferenciada, un mosaico que
      Ducalia, su capital, administra más como intendencia que como gobierno
      unificado. El Baluarte Umbrío domina el paisaje de la provincia casi tanto
      como su propia capital, un recordatorio permanente en piedra negra de que la
      extensión de Grandeu también la convierte en la más vigilada de todas las
      provincias imperiales.</p>
      <p>Esa vigilancia no es gratuita, un territorio tan vasto ofrece demasiados
      rincones donde una identidad local podría convertirse en algo más peligroso
      para la Corona. Canteras, minas y cuarteles se reparten por todo Grandeu en
      una red que mantiene ocupados a miles de trabajadores bajo contrato
      imperial, mientras las
      Cumbres de Ceniza recuerdan a cada aldea cercana que la provincia sigue
      siendo, bajo la superficie, un territorio volcánicamente inquieto tanto en lo
      geológico como en lo político.</p>
    `
  },
  {
    id: "marcanor",
    title: "Marcanor",
    category: "Lugares",
    tags: ["aldea", "nordea", "balutia"],
    summary: "Colonia de veteranos legionarios fundada en la cuna del Imperio, tan leal a la corona que muchos la consideran más imperial que la propia capital.",
    region: "Nordea, Kretor, Sindra",
    gobierno: "Colonia de veteranos, administrada por un consejo de oficiales retirados",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Fundada generaciones atrás como tierra de retiro para legionarios que
      sirvieron toda su vida a la corona, Marcanor conserva un orden casi militar
      incluso en tiempos de paz. Sus calles llevan los nombres de campañas que ya
      nadie recuerda con detalle, y no hay casa en el pueblo que no cuente con al
      menos un antepasado que marchó bajo el águila imperial.</p>
      <p>El fervor con que aquí se celebran las fiestas imperiales incomoda incluso a
      algunos funcionarios de la capital, con banderas en cada ventana, juramentos
      recitados de memoria por niños que todavía no saben leer. Balutia recluta un
      número desproporcionado de sus oficiales entre los hijos de Marcanor, y nadie
      en el pueblo lo considera una casualidad.</p>
    `
  },
  {
    id: "palatina",
    title: "Palatina",
    category: "Lugares",
    tags: ["ciudad", "capital", "nordea", "kretor", "balutia"],
    summary: "Capital provincial de Nordea y ciudad de las Casas Antiguas, donde la nobleza de sangre más vieja del Imperio resiste, a su manera, la meritocracia que gobierna desde Nigrastel.",
    region: "Nordea, Kretor, Sindra",
    gobierno: "Consejo de las Casas Antiguas, bajo supervisión imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Villas de mármol blanco y jardines en terraza cubren las colinas de
      Palatina, un contraste deliberado con la piedra negra y el humo permanente de
      Nigrastel. Aquí viven las Casas que rastrean su linaje hasta antes de la
      propia dinastía imperial, generaciones que consideran Nordea entera una
      posesión familiar mucho más que una provincia.</p>
      <p>La doctrina imperial mide a sus súbditos por utilidad, no por sangre, y esa
      idea incomoda a Palatina más que a cualquier otro rincón del imperio, donde un
      general nacido en Marcanor o un artificiero ascendido desde los niveles bajos
      de Nernib puede alcanzar honores que ninguna Casa Antigua está dispuesta a
      conceder de buena gana. La corte de Nigrastel hace la vista gorda ante su
      orgullo herido porque necesita su dinero y su historia; Palatina se pliega a
      la corte porque, hasta ahora, no le ha quedado otra opción.</p>
    `
  },
  {
    id: "vinealta",
    title: "Vinealta",
    category: "Lugares",
    tags: ["aldea", "nordea", "kretor", "balutia"],
    summary: "Aldea vitivinícola de Nordea que abastece de vino a las Casas Antiguas de Palatina, cultivada por familias humanas ligadas a esos linajes desde hace generaciones.",
    region: "Nordea, Kretor, Sindra",
    gobierno: "Aldea bajo tutela de las Casas Antiguas de Palatina",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Las laderas de Vinealta se cubren de vides desde antes de que exista memoria
      escrita de Nordea, cultivadas por familias humanas que sirven a las Casas
      Antiguas de Palatina desde tantas generaciones atrás que ya nadie distingue con
      claridad si son siervos, arrendatarios o algo intermedio que ningún título legal
      describe con precisión. Cada Casa reclama sus propias hileras de vid como
      extensión de su propio escudo de armas.</p>
      <p>El vino de Vinealta apenas sale de Nordea, reservado casi por completo para
      las mesas de Palatina y las ceremonias que allí se celebran. Los pocos veteranos
      de Marcanor que se retiran aquí en vez de quedarse entre sus antiguos camaradas
      suelen decir que cambiaron un juramento por otro, la disciplina de la legión por
      la paciencia que exige una vid que tarda años en dar su primera cosecha
      aprovechable.</p>
    `
  },
  {
    id: "robledal-de-los-nombres",
    title: "Robledal de los Nombres",
    category: "Lugares",
    tags: ["bosque", "nordea", "kretor", "balutia"],
    summary: "Bosque sagrado de Nordea donde generaciones de las Casas Antiguas y veteranos de Marcanor tallan el nombre de sus muertos en la corteza de robles centenarios.",
    region: "Nordea, Kretor, Sindra",
    gobierno: "Sin autoridad formal, custodiado informalmente por las Casas Antiguas",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Cada roble del Robledal lleva tallado, en algún punto de su tronco, el nombre
      de quien fue enterrado bajo sus raíces, una costumbre tan antigua que los
      ejemplares más viejos ya no conservan corteza legible, solo cicatrices de
      escritura que nadie sabe descifrar. Las Casas Antiguas de Palatina consideran el
      bosque una extensión de su propia genealogía, un árbol por generación, aunque
      ninguna Casa posee autoridad exclusiva sobre él.</p>
      <p>Los veteranos de Marcanor comparten esa misma reverencia por motivos
      distintos, ya que muchos piden ser enterrados aquí en vez de en el cementerio
      militar del pueblo, convencidos de que un roble recuerda mejor que cualquier
      lápida. El resultado es un bosque donde generales imperiales y soldados rasos
      descansan bajo troncos indistinguibles entre sí, algo que ninguna de las dos
      comunidades comenta demasiado en voz alta.</p>
    `
  },
  {
    id: "emporium",
    title: "Emporium",
    category: "Lugares",
    tags: ["ciudad", "nordea", "kretor", "balutia", "mercante"],
    summary: "Mercado fronterizo crecido junto al extremo norteño del Paso Cerrado, con una comunidad estable de mercaderes goblin llegados de Kalvia.",
    region: "Nordea, Kretor, Sindra",
    gobierno: "Consejo de gremios mercantiles, bajo supervisión imperial",
    religionPredominante: "Iurismo",
    lugaresDestacados: [],
    content: `
      <p>Emporium creció, ladrillo a ladrillo, alrededor del extremo norteño del Paso
      Cerrado, en el punto exacto donde las caravanas que cruzan hacia Kalvia hacen su
      última parada antes de pagar el peaje imperial. Ningún plano oficial marcó jamás
      su fundación. Simplemente apareció, primero como campamento de mercaderes,
      después como mercado permanente, hasta que la corona decidió que era más
      rentable regularlo que desmantelarlo.</p>
      <p>Mercaderes goblin de Kalvia mantienen aquí una comunidad estable, los
      primeros rostros no humanos que muchos soldados de Nordea llegan a conocer bien,
      y el Iurismo, la fe contractual de Kalvia, se ha extendido entre los propios
      comerciantes locales, tan naturalmente como se adopta cualquier
      costumbre útil para cerrar tratos. El Consejo de gremios que gobierna la ciudad
      responde, en la práctica, más ante sus propios libros de cuentas que ante
      cualquier gobernador imperial.</p>
    `
  },
  {
    id: "iuridia",
    title: "Iuridia",
    category: "Lugares",
    tags: ["ciudad", "nordea", "kretor", "balutia"],
    summary: "Sede de la Cátedra de Derecho Imperial en Nordea, donde se forman los magistrados que aplican la doctrina de utilidad, no sangre, contrapeso incómodo a la nobleza de Palatina.",
    region: "Nordea, Kretor, Sindra",
    gobierno: "Cátedra de Derecho Imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Iuridia existe para una única función, formar a los magistrados que
      interpretan y aplican la ley imperial en cada rincón de Balutia, y su
      arquitectura lo refleja sin disimulo, con tribunales de práctica, archivos de
      sentencias históricas y una Cátedra de Derecho que acepta estudiantes por
      examen, sin importar de qué provincia o linaje provengan.</p>
      <p>Esa misma meritocracia legal convierte a Iuridia en la contraparte incómoda
      de Palatina, a pocos días de camino, donde las Casas Antiguas todavía miden el
      valor de una persona por su sangre. Los graduados de la Cátedra citan con
      frecuencia, casi como venganza, la doctrina imperial de que ningún linaje vale
      más que su utilidad demostrada, y no pocos magistrados nacidos en provincias
      recién conquistadas han presidido juicios contra nobles de Nordea sin que la
      corona haya movido un dedo para impedirlo.</p>
    `
  },
  {
    id: "custodia",
    title: "Custodia",
    category: "Lugares",
    tags: ["aldea", "nordea", "kretor", "balutia"],
    summary: "Aldea de posta en la calzada entre Nordea y El Yugo de Kretor, último punto de descanso de las caravanas antes de cruzar el paso.",
    region: "Nordea, Kretor, Sindra",
    gobierno: "Aldea bajo administración militar imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Custodia existe porque ninguna caravana quiere llegar al Yugo de Kretor con
      las bestias de carga agotadas, y su puñado de posadas, establos y almacenes de
      forraje se ha vuelto, con los siglos, tan indispensable para el tránsito
      imperial como las propias torres gemelas que vigilan el paso más adelante.</p>
      <p>La guarnición del Yugo rota a su personal a través de Custodia,
      y no es raro que un legionario recién asignado pase aquí su última noche de
      permiso antes de meses de servicio bajo la sombra del arco. El pueblo ha
      aprendido a vivir de esa despedida, ofreciendo la última comida caliente, la
      última cama blanda y la última conversación despreocupada antes de la
      disciplina del paso.</p>
    `
  },
  {
    id: "lago-de-las-casas",
    title: "El Lago de las Casas",
    category: "Lugares",
    tags: ["lago", "nordea", "kretor", "balutia"],
    summary: "Lago ceremonial cerca de Palatina donde las Casas Antiguas celebran nacimientos, matrimonios y funerales desde generaciones antes del Imperio.",
    region: "Nordea, Kretor, Sindra",
    gobierno: "Sin autoridad formal, custodiado por las Casas Antiguas",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Las aguas quietas dEl Lago de las Casas reflejan las villas de Palatina
      desde la colina vecina, y ninguna Casa Antigua considera completo un
      nacimiento, un matrimonio o un funeral sin al menos una ceremonia breve en su
      orilla, una costumbre que sobrevivió intacta a la conquista imperial
      simplemente porque a nadie en Nigrastel le pareció que valiera la pena
      prohibirla.</p>
      <p>Los barqueros que cruzan visitantes de una orilla a otra pertenecen, casi
      todos, a familias que llevan generaciones prestando el mismo servicio, y
      algunos aseguran conocer de memoria a qué Casa pertenece cada embarcadero con
      solo mirar el escudo tallado en el poste. El lago no aparece en ningún mapa
      militar imperial. Palatina prefiere que siga siendo así.</p>
    `
  },
  {
    id: "kalvia",
    title: "Kalvia",
    category: "Lugares",
    tags: ["reino", "kretor", "mercante"],
    summary: "Un próspero reino mercante gobernado por el Príncipe Mercante.",
    region: "Kretor, Sindra",
    gobierno: "Principado mercante (Príncipe Mercante)",
    religionPredominante: "Iurismo",
    lugaresDestacados: ["Aurelport (capital)", "Banca Alta", "Barrio Verde", "Astillera del Príncipe", "Tribunal de los Sellos", "Las Mil Velas", "Río del Peaje", "Colinas Doradas", "La Isla de la Farola", "Cambalache", "Puente de Plata", "Casa de Pesas", "Diques Secos", "Arrecife del Naufragio", "Mercado de Invierno", "Linde del Principado", "Cantera de Mármol Rosado", "La Lonja de los Naufragios", "El Archivo de las Rutas"],
    content: `
      <p>Un próspero reino mercante gobernado por el Príncipe Mercante. La riqueza
      determina el poder político, y las decisiones del gobierno suelen tomarse en
      función del beneficio económico antes que de cualquier ideal. Sus puertos,
      bancos y compañías comerciales ejercen una influencia comparable a la de
      ejércitos enteros.</p>
      <p>Aurelport, su capital, se organiza como cualquier otro reino organizaría
      un ejército, con idéntica precisión, de modo que cada muelle, cada bóveda y
      cada ruta comercial responde a una lógica estrictamente económica. Se dice que en
      Kalvia todo tiene un precio, y quienes han hecho negocios allí casi nunca
      encuentran motivos para contradecirlo.</p>
    `
  },
  {
    id: "baluarte-umbrio",
    title: "Baluarte Umbrío",
    category: "Lugares",
    tags: ["fortaleza", "grandeu", "balutia"],
    summary: "Una fortaleza colosal de piedra negra que domina las tierras altas de Grandeu, recordatorio permanente de que la provincia más extensa del Imperio es también la más vigilada.",
    region: "Grandeu, Kretor, Sindra",
    gobierno: "Guarnición imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El Baluarte Umbrío supera en escala deliberadamente opresiva a cualquier otra
      construcción del Imperio, con murallas de piedra oscura que se alzan varios
      cientos de metros sobre las tierras altas de Grandeu, visibles, según dicen sus
      arquitectos con orgullo, desde cualquier aldea conquistada en un día de cielo
      despejado. No fue construido para resistir un asedio que nadie espera; fue
      construido para que ninguna provincia olvide, ni por un instante, quién gobierna
      Kretor.</p>
      <p>Dentro de sus murallas viven varias legiones permanentes, arsenales suficientes
      para sofocar cualquier levantamiento provincial en semanas, y una guarnición de
      magos imperiales que mantiene la fortaleza iluminada por fuego artificial incluso
      en las noches más cerradas. Los habitantes de Tolvera y otras aldeas cercanas han
      aprendido a vivir bajo su sombra literal, aunque pocos hablan en voz alta sobre lo
      que sienten al respecto.</p>
    `
  },
  {
    id: "yugo-de-kretor",
    title: "El Yugo de Kretor",
    category: "Lugares",
    tags: ["fortaleza", "kretor", "balutia"],
    summary: "Dos torres gemelas unidas por un arco colosal que se alza sobre el único paso de montaña hacia el corazón del Imperio, obligando a todo viajero a cruzar bajo su sombra.",
    region: "Kretor, Sindra",
    gobierno: "Guarnición imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Toda ruta terrestre hacia el corazón de Kretor atraviesa, tarde o temprano, el
      único paso de montaña custodiado por el Yugo, dos torres gemelas de piedra negra
      unidas por un arco tan colosal que proyecta sombra sobre la caravana más larga
      durante los minutos que tarda en cruzarlo por completo. El diseño no es casual,
      y ningún arquitecto imperial lo niega. Cruzar bajo el Yugo es, para cualquier
      súbdito conquistado, una lección de humildad que no requiere palabras.</p>
      <p>Los peajes que cobra la guarnición financian el mantenimiento
      militar de la región, y ningún mercader se atreve a buscar rutas alternativas.
      Las pocas que existen son deliberadamente peores. Se dice que el propio nombre
      de la estructura nació como burla de los pueblos conquistados hacia sus
      captores, y que el Imperio, lejos de ofenderse, decidió adoptarlo con orgullo.</p>
    `
  },
  {
    id: "yunque-ardiente",
    title: "Yunque Ardiente",
    category: "Lugares",
    tags: ["fortaleza", "ornamen", "balutia", "volcánico"],
    summary: "Fortaleza-forja construida sobre una grieta volcánica activa en Ornamen, donde elementales de fuego capturados alimentan las fundiciones que arman a las legiones del Imperio.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "Guarnición imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El Yunque Ardiente se alza directamente sobre una grieta volcánica activa,
      con muros de piedra ennegrecida que se mantienen siempre tibios al tacto. En su
      interior, elementales de fuego capturados, algunos convocados a propósito y
      otros simplemente atrapados al desviar el cauce de lava hacia los hornos, pasan
      su existencia entera alimentando fundiciones que nunca se apagan, forjando las
      armas y armaduras que equipan a legiones enteras.</p>
      <p>El calor es tal que la guarnición rota cada pocas semanas, y los genasi
      ígneos de la región son de los pocos capaces de trabajar turnos completos sin
      protección especial, lo que los convierte en mano de obra muy solicitada y, para
      algunos, en la prueba de que el Imperio sabe exactamente a quién le conviene
      tratar bien. Ornamen entera huele, en los días de viento sur, al humo constante
      de sus chimeneas.</p>
    `
  },
  {
    id: "triastra",
    title: "Triastra",
    category: "Lugares",
    tags: ["ciudad", "ornamen", "merador", "balutia"],
    summary: "Sede del Triunvirato sacerdotal del Ternarismo en Ornamen, donde los genasi ígneos del Yunque Ardiente acuden a purificarse entre turnos en la forja.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "Triunvirato sacerdotal del Ternarismo",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>Tres torres idénticas se alzan sobre el templo central de Triastra, una por
      cada aspecto que venera el Ternarismo, y ningún otro edificio de Ornamen
      recibe tantas ofrendas ni tantos peregrinos. El Triunvirato sacerdotal que
      gobierna la ciudad conserva, incluso bajo dominio imperial, una autoridad que
      ningún gobernador de Balutia se ha atrevido todavía a desafiar abiertamente.</p>
      <p>Los genasi ígneos que rotan turnos en las fundiciones del Yunque Ardiente, a
      poca distancia de aquí, hacen el viaje a Triastra siempre que pueden para
      purificarse en sus rituales antes de volver al calor de la grieta volcánica.
      El propio Imperio ha aprendido a no interferir con esa costumbre, ya que una
      guarnición de elementales de fuego rinde mejor, según sus propios oficiales,
      cuando su fe se mantiene intacta.</p>
    `
  },
  {
    id: "vitrium",
    title: "Vitrium",
    category: "Lugares",
    tags: ["aldea", "ornamen", "merador", "balutia", "volcánico"],
    summary: "Aldea de talladores de obsidiana en Ornamen, habitada mayoritariamente por genasi ígneos que abastecen de espejos y símbolos rituales al Ternarismo de Triastra.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "Gremio de talladores, bajo tutela del Triunvirato sacerdotal",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>El vidrio volcánico que da nombre a Vitrium se forma cada vez que la lava del
      Yunque Ardiente, a poca distancia de aquí, entra en contacto brusco con agua de
      manantial, y los talladores del pueblo llevan generaciones convirtiendo esos
      fragmentos negros en herramientas rituales, cuchillas ceremoniales y los tres
      espejos que todo templo del Ternarismo necesita para sus ritos de
      purificación.</p>
      <p>La mayoría de sus habitantes son genasi ígneos, capaces de manipular la
      obsidiana recién formada sin esperar a que se enfríe del todo, algo que ningún
      tallador humano puede replicar sin arriesgar quemaduras graves. Los sacerdotes
      de Triastra dependen casi por completo del gremio local para sus espejos y
      símbolos rituales, y aseguran que ningún vidrio tallado por manos que no arden
      de verdad conserva la misma pureza.</p>
    `
  },
  {
    id: "boca-de-ornamen",
    title: "La Boca de Ornamen",
    category: "Lugares",
    tags: ["volcán", "ornamen", "merador", "balutia"],
    summary: "La grieta volcánica activa sobre la que se construyó el Yunque Ardiente, lugar de peregrinaje del Ternarismo y origen espiritual de los genasi ígneos de la provincia.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>Antes de que el Imperio construyera el Yunque Ardiente sobre su ladera, la
      Boca de Ornamen ya era considerada sagrada por quienes habitaban la provincia,
      una grieta volcánica activa que los primeros sacerdotes del Ternarismo
      interpretaron como la prueba física de que el equilibrio entre cuerpo, mente y
      alma podía romperse en la superficie del mundo. Peregrinos siguen subiendo hasta
      su borde para arrojar ofrendas, aunque ahora comparten el camino con convoyes de
      mineral imperial.</p>
      <p>Los genasi ígneos de la región consideran la Boca su lugar de origen
      espiritual, sin importar cuántas generaciones lleve su familia viviendo lejos de
      Ornamen, y muchos peregrinan aquí al menos una vez en la vida para sostener la
      mano sobre la roca fundida el tiempo suficiente para sentir, según describen,
      que el fuego los reconoce. El Triunvirato sacerdotal de Triastra oficia una
      ceremonia anual en el borde del cráter que ningún gobernador imperial se ha
      atrevido nunca a cancelar.</p>
    `
  },
  {
    id: "solenna",
    title: "Solenna",
    category: "Lugares",
    tags: ["ciudad", "capital", "ornamen", "merador", "balutia"],
    summary: "Capital provincial de Ornamen, antigua sede secular anterior a la conquista, hoy despacho del gobernador y contrapeso político a la autoridad religiosa de Triastra.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "Gobernador provincial, bajo la corona imperial",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>Solenna gobernaba Ornamen mucho antes de que Balutia supiera que la
      provincia existía, y el Imperio, fiel a su costumbre de absorber en vez de
      borrar, conservó la ciudad como sede administrativa en vez de imponer una
      capital nueva. Sus edificios de piedra clara, tallados con motivos que ningún
      artesano imperial sabría identificar con seguridad, siguen alojando al gobernador provincial
      exactamente donde antes se sentaba el último rey local.</p>
      <p>Esa continuidad genera una tensión que todos en Ornamen perciben, ya
      que Triastra concentra la autoridad religiosa de la provincia mientras Solenna
      concentra la administrativa, y ambas ciudades compiten, con cortesía impecable,
      por decidir cuál de las dos habla realmente en nombre de Ornamen ante Nigrastel.
      El Triunvirato sacerdotal y el gobernador se visitan con regularidad, y ninguno
      de los dos ha perdido todavía una sola de esas discusiones en público.</p>
    `
  },
  {
    id: "ternaria",
    title: "Ternaria",
    category: "Lugares",
    tags: ["ciudad", "ornamen", "merador", "balutia"],
    summary: "Ciudad académica de Ornamen donde los filósofos naturales estudian Sal, Mercurio y Azufre como disciplina, no solo como fe, con material que le compra directamente a Vitrium.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "Colegio de Filosofía Natural",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>Mientras Triastra ora, Ternaria experimenta. La ciudad alberga el Colegio de
      Filosofía Natural, que estudia con metodología casi académica las mismas tres
      sustancias que el Ternarismo venera como símbolos, Sal, Mercurio y Azufre,
      buscando principios que expliquen por qué la teología de la provincia describe
      el mundo con tanta precisión práctica.</p>
      <p>Los alquimistas de Vitrium, a poca distancia de aquí, proveen a Ternaria de
      vidrio volcánico y minerales que ningún otro punto del imperio consigue con la
      misma pureza, y el Colegio devuelve el favor formando a los propios talladores
      en técnicas que mejoran su oficio. El Triunvirato sacerdotal ve a Ternaria
      con cierta incomodidad teológica, consciente de que reducir sus tres principios
      sagrados a fórmulas repetibles resulta, para algunos sacerdotes, una forma sutil
      de herejía que nadie se atreve a nombrar así en voz alta.</p>
    `
  },
  {
    id: "marenna",
    title: "Marenna",
    category: "Lugares",
    tags: ["aldea", "ornamen", "merador", "balutia"],
    summary: "Aldea pesquera en la costa occidental de Ornamen que provee de pescado y sal a Solenna y a los peregrinos que suben hacia La Boca de Ornamen.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "Aldea bajo administración de Solenna",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Las barcas de Marenna salen antes del amanecer y regresan con suficiente
      pescado para abastecer tanto la mesa del gobernador en Solenna como los
      puestos improvisados que aparecen junto al camino de peregrinación hacia la
      Boca de Ornamen, donde los viajeros compran provisiones antes de emprender la
      subida.</p>
      <p>A diferencia de Halara en Goloria, cuya sal se destina casi por completo a
      las guarniciones, la de Marenna se vende libremente en los mercados de
      Ornamen, y sus salineros consideran una cuestión de orgullo local que ningún
      funcionario imperial haya intentado todavía reclamar la producción para la
      corona. Nadie en el pueblo apuesta a que esa suerte dure para siempre.</p>
    `
  },
  {
    id: "termas-de-ornamen",
    title: "Termas de Ornamen",
    category: "Lugares",
    tags: ["naturaleza", "ornamen", "merador", "balutia", "volcánico"],
    summary: "Manantiales de agua caliente alimentados por el mismo calor volcánico que La Boca de Ornamen, visitados por peregrinos del Ternarismo y genasi ígneos.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>El mismo calor que alimenta La Boca de Ornamen, a poca distancia de aquí,
      calienta también estos manantiales, donde el agua brota lo bastante caliente
      como para cocinar un huevo en los charcos más cercanos a la fuente y lo
      bastante templada, más lejos, para que los peregrinos se bañen sin
      quemarse.</p>
      <p>El Ternarismo interpreta las Termas como el punto exacto donde el fuego se
      vuelve agua sin dejar de ser, en esencia, la misma energía, una demostración
      física de su propia teología que ningún sermón necesita explicar. Los
      genasi ígneos que trabajan en Vitrium y en el Yunque Ardiente vienen aquí a
      relajarse entre turnos, aunque para ellos el agua pocas veces se siente tan
      caliente como para los peregrinos humanos que se bañan a su lado.</p>
    `
  },
  {
    id: "ergastula",
    title: "La Ergástula",
    category: "Lugares",
    tags: ["fortaleza", "grandeu", "balutia"],
    summary: "Complejo fortificado de trabajo forzado en Grandeu donde el tributo humano de las provincias conquistadas se convierte en grano, metal y mano de obra para la maquinaria de guerra del Imperio.",
    region: "Grandeu, Kretor, Sindra",
    gobierno: "Guarnición imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Oficialmente, La Ergástula es un centro de procesamiento de tributo. En la
      práctica, es la fortaleza-prisión más grande del Imperio, con campos, minas y
      talleres rodeados por murallas bajas pero interminables, donde miles de
      súbditos de provincias recién conquistadas cumplen años de trabajo forzado como
      parte del tributo de guerra que sus pueblos deben a la corona. Nadie en Balutia
      llama esclavos a quienes trabajan ahí. El término oficial es "deudores de
      guerra", aunque la diferencia práctica es difícil de encontrar.</p>
      <p>El grano, el metal y los bienes que salen de La Ergástula sostienen buena
      parte del esfuerzo militar imperial, y su administración se considera uno de los
      cargos más rentables que la corona puede ofrecer, aunque también de los menos
      codiciados socialmente. Quienes cumplen su condena y sobreviven reciben, al menos en teoría,
      la ciudadanía imperial completa; son pocos los que llegan a esa fecha sin haber
      envejecido una década de más.</p>
    `
  },
  {
    id: "victrix",
    title: "Victrix",
    category: "Lugares",
    tags: ["ciudad", "grandeu", "kretor", "balutia"],
    summary: "Ciudad-arena de Grandeu construida alrededor del mayor coliseo del Imperio, donde los condenados de La Ergástula cercana pueden comprar su libertad a espada.",
    region: "Grandeu, Kretor, Sindra",
    gobierno: "Editor Imperial de los Juegos",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Todo en Victrix converge en su arena, una estructura ovalada de piedra que
      domina el centro de la ciudad y que en días de juegos recibe a más gente de
      la que vive en la propia Victrix el resto del año. Comerciantes, apostadores
      y familias enteras viajan desde Nigrastel y provincias más lejanas para
      presenciar combates que la propaganda imperial exporta como prueba de la
      fuerza y la disciplina de Balutia.</p>
      <p>Buena parte de sus gladiadores llega directamente de La Ergástula, a pocos
      días de camino. Quien sobrevive suficientes combates gana lo que ningún
      trabajo forzado ofrece, una salida rápida hacia la ciudadanía imperial
      completa. Los que triunfan de verdad se convierten en héroes populares con
      estatuas propias en la ciudad, y no faltan generales que reclutan a los
      mejores retirados de la arena para sus legiones, convencidos de que nada
      prueba mejor el temple de un soldado que haber sobrevivido a Victrix.</p>
    `
  },
  {
    id: "paso-cerrado",
    title: "Paso Cerrado",
    category: "Lugares",
    tags: ["fortaleza", "kretor", "balutia"],
    summary: "Fortaleza tallada directamente en un desfiladero de montaña entre Nordea y Kalvia, tan estrecha que una guarnición reducida basta para detener a un ejército entero.",
    region: "Kretor, Sindra",
    gobierno: "Guarnición imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El Paso Cerrado no fue construido, sino tallado directamente en la roca de un
      desfiladero tan angosto que dos carretas no pueden cruzarlo a la vez. Torres de
      vigilancia se asoman desde ambos lados del cañón, tan altas que los arqueros
      apostados en ellas dominan cualquier columna que intente forzar el paso desde
      abajo. Una guarnición de apenas un centenar de soldados basta, según los propios
      manuales militares imperiales, para contener a un ejército completo mientras
      dure el suministro.</p>
      <p>La ruta conecta Nordea con Kalvia, y el comercio legal entre la
      cuna dinástica del Imperio y el reino mercante pasa bajo su sombra. Se dice que
      el Paso Cerrado nunca ha caído en batalla. Solo una vez, hace generaciones,
      cambió de manos por soborno, y sus actuales comandantes lo recuerdan como
      advertencia cada vez que revisan la lista de sobornos rechazados ese mes.</p>
    `
  },
  {
    id: "tolvera",
    title: "Tolvera",
    category: "Lugares",
    tags: ["aldea", "grandeu", "balutia"],
    summary: "Aldea de las tierras altas de Grandeu que paga tributo al Imperio sin haber cedido jamás su lengua ni sus dioses.",
    region: "Grandeu, Kretor, Sindra",
    gobierno: "Aldea tributaria del Imperio de Balutia",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Encaramada en las terrazas de piedra de las tierras altas de Grandeu, Tolvera
      existía mucho antes de que las primeras calzadas imperiales llegaran a la
      provincia. Sus tejidos, teñidos con pigmentos que ningún otro pueblo de la
      región sabe replicar, todavía se venden en los mercados de la capital como
      curiosidad exótica de una de las tantas culturas que Balutia se anexó.</p>
      <p>Dos veces al año llegan los recaudadores imperiales, cobran su tributo y se
      marchan sin preguntar demasiado. A cambio, Tolvera conserva lo que de verdad le
      importa. Su lengua se sigue hablando en cada casa, sus dioses siguen recibiendo
      ofrendas en el mismo altar de siempre, y el nombre imperial de la provincia se
      usa solo cuando hay un funcionario delante.</p>
    `
  },
  {
    id: "quercia",
    title: "Quercia",
    category: "Lugares",
    tags: ["aldea", "grandeu", "kretor", "balutia"],
    summary: "Aldea maderera en los bosques de Grandeu que talla y transporta el roble usado en las máquinas de asedio y andamiajes del Imperio.",
    region: "Grandeu, Kretor, Sindra",
    gobierno: "Aldea tributaria del Imperio de Balutia",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Los bosques que rodean Quercia proveen el roble que el
      Imperio necesita para sus máquinas de asedio, andamios y refuerzos de
      fortaleza, incluidos los que sostienen las murallas del Baluarte Umbrío no
      muy lejos de aquí. Generaciones de leñadores han aprendido a talar sin vaciar
      el bosque entero, una disciplina que sus propios ancianos enseñan como si
      fuera un oficio sagrado.</p>
      <p>Como Tolvera, en las tierras altas de la misma provincia, Quercia conserva
      creencias anteriores a la conquista imperial. Aquí se venera a los árboles
      más viejos del bosque como algo cercano a ancestros, y ningún recaudador
      imperial ha logrado nunca explicar por completo por qué ciertos troncos
      jamás llegan a la lista de tributo.</p>
    `
  },
  {
    id: "equitania",
    title: "Equitania",
    category: "Lugares",
    tags: ["aldea", "grandeu", "kretor", "balutia"],
    summary: "Aldea ganadera de las llanuras de Grandeu que cría los caballos de guerra de las legiones imperiales, con costumbres jinetes anteriores a la conquista.",
    region: "Grandeu, Kretor, Sindra",
    gobierno: "Aldea tributaria del Imperio de Balutia",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Las llanuras que rodean Equitania crían los mejores caballos de guerra del
      Imperio, una tradición ganadera que sus habitantes practicaban generaciones
      antes de que las legiones balutias reclamaran la provincia y descubrieran, con
      cierta sorpresa, que no tenían nada que enseñarle al pueblo local sobre monta ni
      cría selectiva. Cada potro nacido en sus praderas se registra con el mismo
      cuidado que un noble registraría un heredero.</p>
      <p>Como Tolvera y Quercia en otros puntos de Grandeu, Equitania conserva
      costumbres anteriores a la conquista, con jinetes que todavía compiten en
      carreras rituales que ningún calendario imperial reconoce oficialmente. El
      Imperio no se atreve a tocar la tradición porque depende de ella. Ninguna legión de
      caballería de Kretor monta un caballo que no haya nacido, primero, en estas
      llanuras.</p>
    `
  },
  {
    id: "cumbres-de-ceniza",
    title: "Cumbres de Ceniza",
    category: "Lugares",
    tags: ["volcán", "grandeu", "kretor", "balutia"],
    summary: "Picos volcánicos de las tierras altas de Grandeu que dan al Baluarte Umbrío su ceniza constante, trabajados por genasi ígneos que extraen mineral de sus laderas activas.",
    region: "Grandeu, Kretor, Sindra",
    gobierno: "Guarnición imperial, bajo mando del Baluarte Umbrío",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El Baluarte Umbrío no debe su nombre solo a la piedra oscura de sus
      murallas, sino a la ceniza que las Cumbres cercanas arrojan sobre la fortaleza
      cada vez que sus cráteres despiertan, un fenómeno lo bastante frecuente como
      para que ningún soldado destinado allí recuerde con claridad cómo se ve el
      cielo sin ella. Los arquitectos imperiales aprovecharon esa oscuridad constante
      al diseñar la fortaleza, convencidos de que una guarnición acostumbrada a ver
      poco de cerca vigila mejor lo que sí puede ver de lejos.</p>
      <p>Los genasi ígneos que trabajan las forjas menores del Baluarte extraen
      mineral directamente de las laderas activas, un trabajo que ninguna otra raza
      de la guarnición está dispuesta a realizar sin protección especial. Tolvera y
      Quercia, las aldeas tributarias más cercanas, culpan a las Cumbres de buena
      parte de la ceniza que cubre sus propios tejados, aunque ninguna se atreve a
      reclamarle nada al Imperio por un fenómeno que la corona no puede controlar ni
      fingir que controla.</p>
    `
  },
  {
    id: "compitum",
    title: "Compitum",
    category: "Lugares",
    tags: ["ciudad", "grandeu", "kretor", "balutia", "mercante"],
    summary: "Ciudad de encrucijada en Grandeu donde confluyen el camino de la madera de Quercia y las calzadas hacia las provincias orientales, punto de entrada del comercio con Uldum.",
    region: "Grandeu, Kretor, Sindra",
    gobierno: "Consejo de caravaneros, bajo supervisión imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Las rutas comerciales relevantes de Kretor pasan, todas, por Compitum,
      construida exactamente donde el camino de la madera que sale de Quercia se cruza con las
      calzadas imperiales que conectan Nigrastel con las provincias orientales y, más
      allá de ellas, con las rutas hacia Uldum. La ciudad no fabrica ni cultiva casi
      nada propio. Vive, entera, de cobrar por el paso de lo que otros producen.</p>
      <p>El Consejo de caravaneros que la gobierna negocia tarifas de tránsito con la
      misma intensidad con la que Nigrastel negocia tratados, y ha aprendido a leer el
      estado del imperio entero simplemente observando qué mercancías dejan de cruzar
      sus puertas. Comerciantes de Relania y Uldum se cruzan a diario con legionarios
      balutios en sus calles, y Compitum ha desarrollado, casi por necesidad, la
      apertura comercial de un puerto sin tener mar cerca.</p>
    `
  },
  {
    id: "ducalia",
    title: "Ducalia",
    category: "Lugares",
    tags: ["ciudad", "capital", "grandeu", "kretor", "balutia"],
    summary: "Capital provincial de Grandeu, construida por decreto en el punto que minimiza distancias a Tolvera, Quercia y Equitania, sede del gobernador que media entre sus culturas dispersas.",
    region: "Grandeu, Kretor, Sindra",
    gobierno: "Gobernador provincial, bajo la corona imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Gobernar una provincia tan extensa y dispersa como Grandeu exige una capital
      que nadie eligió por tradición ni por historia, y Ducalia es exactamente eso,
      una ciudad construida por decreto administrativo en el punto que minimizaba la
      distancia a Tolvera, Quercia, Equitania y las fortalezas que vigilan sus
      fronteras internas. Ningún edificio de la ciudad tiene más de unas pocas
      generaciones.</p>
      <p>El gobernador que reside aquí administra, en la práctica, un mosaico de
      pueblos que comparten poco entre sí salvo el tributo que pagan a la misma
      corona, y su trabajo diario consiste sobre todo en mediar disputas que ni Tolvera
      ni Quercia llevarían jamás directamente a Nigrastel. Los funcionarios de
      Ducalia bromean, sin demasiado humor, con que su ciudad existe únicamente para
      que el resto de Grandeu no tenga que hablar directamente entre sí.</p>
    `
  },
  {
    id: "horrea",
    title: "Horrea",
    category: "Lugares",
    tags: ["aldea", "grandeu", "kretor", "balutia"],
    summary: "Depósito de suministros entre Victrix y La Ergástula que alimenta tanto a las multitudes de la arena como a los condenados de la fortaleza-prisión.",
    region: "Grandeu, Kretor, Sindra",
    gobierno: "Aldea bajo administración militar imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Horrea existe para resolver un problema logístico muy concreto, alimentar a
      las multitudes que llenan Victrix en días de juegos y, al mismo tiempo, a los
      miles de condenados que trabajan en La Ergástula, dos demandas que ningún otro
      punto de Grandeu podría satisfacer a la vez sin desabastecer a alguna de las
      dos.</p>
      <p>Sus almacenes rotan grano, carne salada y vino barato en cantidades que
      ningún pueblo de su tamaño debería necesitar, y los carreteros que hacen la
      ruta entre Horrea y ambos destinos bromean con que conocen el camino mejor
      dormidos que despiertos. Nadie envidia el trabajo de calcular, cada temporada
      de juegos, cuánto sobra para los prisioneros y cuánto se destina a los
      espectadores.</p>
    `
  },
  {
    id: "caudal-alto",
    title: "Caudal Alto",
    category: "Lugares",
    tags: ["río", "grandeu", "kretor", "balutia"],
    summary: "Río de montaña que baja desde las Cumbres de Ceniza y riega las terrazas de Tolvera antes de perderse en las tierras bajas de Grandeu.",
    region: "Grandeu, Kretor, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El Caudal Alto nace del deshielo y la lluvia que se acumulan en las
      laderas de las Cumbres de Ceniza, cargado de ceniza fina que Tolvera aprovecha,
      río abajo, para enriquecer las terrazas donde cultiva sus tejidos teñidos.
      Ningún otro punto de la provincia explica tan bien por qué las tierras altas de
      Grandeu, pese a la ceniza volcánica, siguen siendo fértiles.</p>
      <p>La guarnición del Baluarte Umbrío depende del Caudal Alto para su
      suministro de agua, y mantiene una pequeña estación río arriba que vigila tanto
      la calidad del agua como cualquier señal de actividad volcánica creciente en
      las Cumbres. Un cambio repentino en el color o la temperatura del río es, para
      ellos, una alarma tan seria como cualquier señal de humo.</p>
    `
  },
  {
    id: "banca-alta",
    title: "Banca Alta",
    category: "Lugares",
    tags: ["ciudad", "kalvia", "kretor", "sindra", "mercante"],
    summary: "Ciudad-banco de Kalvia donde se administran los créditos y seguros que financian la mayoría del comercio marítimo de Sindra.",
    region: "Kalvia, Kretor, Sindra",
    gobierno: "Consorcio de banqueros",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Todo cargamento importante de Kalvia pasa, en algún momento, por los
      libros de Banca Alta, donde un consorcio de banqueros administra créditos,
      seguros marítimos y letras de cambio que financian el comercio
      de todo el continente. Sus bóvedas, talladas directamente en la roca de una
      colina que ningún otro edificio de Kalvia se atreve a igualar en
      fortificación, custodian más riqueza que la tesorería de más de un reino
      vecino.</p>
      <p>El propio Príncipe Mercante mantiene una relación cautelosa con el
      Consorcio, consciente de que Banca Alta financia tanto sus proyectos como
      los de cualquier rival que pueda pagar el interés correspondiente. Pocos en
      Kalvia discuten abiertamente si el Consorcio o la corona ejerce más poder
      real sobre el principado, aunque casi todos tienen una opinión formada al
      respecto.</p>
    `
  },
  {
    id: "barrio-verde",
    title: "Barrio Verde",
    category: "Lugares",
    tags: ["aldea", "kalvia", "kretor", "sindra", "mercante"],
    summary: "Barrio semiautónomo de Aurelport donde la comunidad goblin de Kalvia gestiona sus propios negocios, préstamos y disputas.",
    region: "Kalvia, Kretor, Sindra",
    gobierno: "Consejo goblin, tolerado por el Príncipe Mercante",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Barrio Verde funciona, en la práctica, como una ciudad dentro de otra
      ciudad, con sus propias reglas comerciales, su propio sistema de préstamos y
      un consejo goblin que resuelve disputas internas sin necesidad de recurrir a
      los tribunales de Aurelport. El Príncipe Mercante no interfiere
      porque esa autonomía le resulta rentable.</p>
      <p>Los hobgoblins que organizan la vida comercial del barrio
      mantienen estructuras casi corporativas, con jerarquías de mando que no
      desentonarían en cualquier compañía mercantil legítima del principado. Los
      goblins de fuera de Kalvia consideran Barrio Verde algo cercano a una tierra
      prometida, un lugar donde su reputación de codiciosos se trata, casi, como
      una virtud profesional.</p>
    `
  },
  {
    id: "astillera-del-principe",
    title: "Astillera del Príncipe",
    category: "Lugares",
    tags: ["ciudad", "kalvia", "kretor", "sindra", "mercante"],
    summary: "Astillero estatal de Kalvia que construye la flota mercante y de guerra que sostiene el poder naval del principado.",
    region: "Kalvia, Kretor, Sindra",
    gobierno: "Administración directa del Príncipe Mercante",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>A diferencia de casi todo lo demás en Kalvia, la Astillera del Príncipe
      no se administra como negocio privado, sino como propiedad directa de la
      corona, un recordatorio de que incluso el principado más obsesionado con el
      beneficio reconoce que ciertas cosas, como la flota que protege sus rutas
      comerciales, no pueden depender enteramente del mercado libre.</p>
      <p>Miles de carpinteros, cordeleros y herreros navales trabajan en turnos
      que casi nunca se detienen, produciendo tanto los galeones de guerra que
      escoltan convoyes como los barcos mercantes más rápidos de todo Sindra. El
      Príncipe Mercante visita la Astillera con más frecuencia que cualquier otro
      punto de su principado, consciente de que su fortuna entera flota,
      literalmente, sobre lo que aquí se construye.</p>
    `
  },
  {
    id: "tribunal-de-los-sellos",
    title: "Tribunal de los Sellos",
    category: "Lugares",
    tags: ["ciudad", "kalvia", "kretor", "sindra"],
    summary: "Sede de los tribunales contractuales del Iurismo, donde se resuelven disputas comerciales según la letra exacta de cada acuerdo firmado.",
    region: "Kalvia, Kretor, Sindra",
    gobierno: "Tribunales del Iurismo",
    religionPredominante: "Iurismo",
    lugaresDestacados: [],
    content: `
      <p>Todo contrato firmado en Kalvia necesita sobrevivir el escrutinio del
      Tribunal de los Sellos antes de considerarse verdaderamente seguro, donde
      jueces formados en la doctrina del Iurismo interpretan acuerdos comerciales
      con una literalidad que ha arruinado a más de un mercader descuidado con su
      propia letra pequeña. La ciudad entera respira la misma lógica contractual
      que sostiene la fe kalviana, y es que una promesa importa porque otros
      construyeron decisiones alrededor de ella.</p>
      <p>Los sacerdotes del Iurismo que presiden el tribunal no distinguen entre
      disputas religiosas y comerciales, considerando ambas manifestaciones del
      mismo principio sagrado. Un mercader que rompe un contrato en Kalvia no solo
      enfrenta consecuencias legales, sino algo parecido a una falta religiosa, y
      el Tribunal de los Sellos se asegura de que ambas cosas se sientan con el
      mismo peso.</p>
    `
  },
  {
    id: "cambalache",
    title: "Cambalache",
    category: "Lugares",
    tags: ["aldea", "kalvia", "kretor", "sindra", "mercante"],
    summary: "Mercado informal a las afueras de Aurelport donde se cierran tratos que ningún notario del Iurismo llegaría a sellar, permitido siempre que no perturbe el comercio legal.",
    region: "Kalvia, Kretor, Sindra",
    gobierno: "Sin autoridad formal",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Fuera del alcance de los tribunales del Iurismo, Cambalache funciona con
      una lógica propia, basada en la reputación y la memoria antes que en
      contratos escritos. Mercancía de origen dudoso, favores pendientes y deudas
      de honor cambian de manos aquí a diario, en tratos que ninguna de las partes
      querría ver registrados en Banca Alta.</p>
      <p>El Príncipe Mercante conoce perfectamente la existencia del lugar y elige
      no intervenir, consciente de que casi todo lo que se comercia en
      Cambalache termina, tarde o temprano, alimentando el comercio legal que sí
      paga impuestos. Cerrarlo, calculan sus consejeros, saldría más caro que
      dejarlo seguir.</p>
    `
  },
  {
    id: "puente-de-plata",
    title: "Puente de Plata",
    category: "Lugares",
    tags: ["ciudad", "kalvia", "kretor", "sindra", "mercante"],
    summary: "Ciudad-peaje construida sobre el único cruce practicable hacia el interior de Kalvia, donde cada carreta paga su tributo antes de continuar viaje.",
    region: "Kalvia, Kretor, Sindra",
    gobierno: "Concesión del Principado mercante",
    religionPredominante: "Iurismo",
    lugaresDestacados: [],
    content: `
      <p>Toda mercancía que entra a Kalvia por tierra cruza este puente tarde o
      temprano, un embudo natural que el Príncipe Mercante convirtió hace
      generaciones en una fuente de ingresos constante. Las tarifas se recalculan
      cada temporada según el volumen de tráfico, y los recaudadores que trabajan
      en sus torretas conocen de memoria el precio exacto de casi cualquier carga.</p>
      <p>Alrededor del puente creció una ciudad entera de posadas, cambistas y
      reparadores de carretas, todos dependientes del mismo flujo constante de
      viajeros que no tienen más remedio que detenerse aquí. Evitar el peaje
      significa un rodeo de varios días por terreno mucho peor.</p>
    `
  },
  {
    id: "casa-de-pesas",
    title: "Casa de Pesas",
    category: "Lugares",
    tags: ["ciudad", "kalvia", "kretor", "sindra", "mercante"],
    summary: "Sede de la oficina de pesos y medidas de Kalvia, que certifica balanzas, monedas y contenedores comerciales para todo el principado.",
    region: "Kalvia, Kretor, Sindra",
    gobierno: "Oficina de Pesos y Medidas",
    religionPredominante: "Iurismo",
    lugaresDestacados: [],
    content: `
      <p>Cada balanza comercial de Kalvia lleva un sello grabado en la Casa de
      Pesas, renovado anualmente tras una inspección que revisa desde las básculas
      de los mercados de Aurelport hasta los grandes contenedores que salen de la
      Astillera del Príncipe. Un sello vencido o falsificado invalida
      automáticamente cualquier contrato firmado con esa balanza como referencia.</p>
      <p>Los inspectores que trabajan aquí gozan de una autoridad que pocos cargos
      del principado igualan, porque un error en sus mediciones puede arruinar
      transacciones por valor de fortunas enteras. El Iurismo los considera casi
      sacerdotes de un culto menor, dedicados a la exactitud como forma de
      justicia.</p>
    `
  },
  {
    id: "diques-secos",
    title: "Diques Secos",
    category: "Lugares",
    tags: ["ciudad", "kalvia", "kretor", "sindra", "mercante"],
    summary: "Complejo de reparación naval junto a Aurelport donde se calafatean y reparan los barcos mercantes dañados por las rutas más peligrosas de Sindra.",
    region: "Kalvia, Kretor, Sindra",
    gobierno: "Gremio de carpinteros navales",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Una hilera de diques permite vaciar el agua de mar y dejar expuestos los
      cascos de los barcos que vuelven maltrechos de sus rutas, con el Gremio de
      Carpinteros Navales trabajando por turnos para devolverlos al mar en el
      menor tiempo posible. Cada día que un barco pasa en dique seco es un día sin
      generar beneficio, y en Kalvia eso se calcula hasta la última moneda.</p>
      <p>Capitanes de otros reinos contratan reparaciones aquí incluso cuando
      podrían hacerlo más barato en casa, atraídos por una rapidez que en Kalvia
      se ha convertido en seña de identidad tanto como su reputación mercantil.</p>
    `
  },
  {
    id: "arrecife-del-naufragio",
    title: "Arrecife del Naufragio",
    category: "Lugares",
    tags: ["naturaleza", "kalvia", "kretor", "sindra"],
    summary: "Arrecife traicionero frente a la costa de Kalvia responsable de más pólizas de seguro marítimo cobradas que ningún otro punto del principado.",
    region: "Kalvia, Kretor, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Docenas de cascos rotos descansan bajo la superficie de este arrecife,
      apenas visible en marea alta y letal para cualquier capitán que subestime su
      posición exacta. Banca Alta calcula sus primas de seguro marítimo tomando
      este punto como referencia obligada, y las rutas que lo bordean cuestan más
      caras a causa del riesgo que representa.</p>
      <p>Pescadores locales han aprendido a aprovechar la abundancia de vida
      marina que se acumula entre los restos hundidos, aunque faenar demasiado
      cerca del arrecife sigue considerándose una apuesta que no siempre sale
      bien.</p>
    `
  },
  {
    id: "mercado-de-invierno",
    title: "Mercado de Invierno",
    category: "Lugares",
    tags: ["aldea", "kalvia", "kretor", "sindra", "mercante"],
    summary: "Mercado estacional que solo abre durante los meses fríos, cuando las rutas marítimas se vuelven más lentas y el comercio terrestre gana protagonismo en Kalvia.",
    region: "Kalvia, Kretor, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Durante el invierno, cuando las tormentas ralentizan el tráfico marítimo
      de Aurelport, comerciantes de todo Kalvia trasladan sus negocios a este
      mercado terrestre, montado y desmontado cada temporada tan eficientemente
      como se administra cualquier otro negocio del principado.
      Puestos de madera prefabricada se ensamblan en cuestión de horas.</p>
      <p>El resto del año, el terreno queda vacío en la práctica, marcado apenas
      por las bases de piedra donde se anclan los puestos temporada tras temporada.
      Los mercaderes más supersticiosos evitan pisar el lugar fuera de época,
      convencidos de que trae mala suerte comercial.</p>
    `
  },
  {
    id: "uldum",
    title: "Uldum",
    category: "Lugares",
    tags: ["región", "sindra", "ruinas"],
    summary: "El continente más antiguo de la civilización conocida.",
    region: "Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: ["Nikaalia", "Relania", "Har", "Chakur", "Polvo de Reyes", "Guarida de Escamas", "Campamento del Erudito", "Manantial de las Cuatro Coronas", "Tumbaquieta"],
    content: `
      <p>El continente más antiguo de la civilización conocida. Sus desiertos,
      montañas y mares esconden las ruinas de imperios cuya existencia apenas
      sobrevive en los mitos. Muchos creen que los dioses caminaron por estas tierras
      antes de abandonar el mundo, dejando tras de sí monumentos imposibles de
      construir con la tecnología actual.</p>
      <p>Los cuatro reinos que hoy ocupan Uldum viven, cada uno a su manera, bajo la
      sombra de ese pasado. Nikaalia se hundió bajo un domo de noche eterna que
      ningún erudito ha logrado revertir, Relania alberga el cementerio de
      dragones que dio origen a los draconianos, Har se fragmentó en decenas de
      pequeños reinos gobernados por jarls, y Chakur sigue reconstruyendo, piedra a
      piedra, la civilización que enanos y elfos compartieron antes de una guerra que
      ninguno de los dos pueblos recuerda por completo. Entre las ruinas que separan
      estos cuatro territorios sobreviven aldeas como Polvo de Reyes, cuyos
      habitantes se ganan la vida excavando fragmentos de un pasado que Uldum entero
      parece incapaz de explicar por entero. Entre esas mismas ruinas se cruzan,
      sin buscarse, dos colosos muy distintos. Lao Shan Lung es tan lento y
      longevo que algunos lo confunden con parte del paisaje, mientras que Ragnomol
      excava túneles propios que a veces se topan, por accidente, con los de los
      propios habitantes de Polvo de Reyes.</p>
    `
  },
  {
    id: "nikaalia",
    title: "Nikaalia",
    category: "Lugares",
    tags: ["reino", "uldum", "nigredo", "oscuridad"],
    summary: "Una nación condenada a vivir bajo una noche eterna.",
    region: "Uldum, Sindra",
    gobierno: "",
    religionPredominante: "Umbrismo",
    lugaresDestacados: ["Umbrathil (capital)", "Bajovela", "Esporal", "Forjahonda", "Claustro", "El Bosque sin Luna", "Lago Negro", "Ceniza Eterna", "Puerto Umbral", "Boca Óxido", "Los Estratos", "Mercado de las Sombras", "El Espejismo"],
    content: `
      <p>Una nación condenada a vivir bajo una noche eterna. Un inmenso domo de Nigredo
      cubre el cielo desde hace siglos, impidiendo que la luz del sol alcance la
      superficie. La oscuridad no solo envenena el aire, sino también la mente de
      quienes habitan bajo ella.</p>
      <p>Los habitantes de Nikaalia nacen sabiendo que algún día la oscuridad terminará
      por consumir una parte de ellos. El crimen, la locura y la violencia forman
      parte de la vida cotidiana, no por necesidad, sino porque el Nigredo alimenta
      lentamente los peores impulsos del alma. Algunos aseguran haber sentido, en
      El Bosque sin Luna, la presencia de Selenia, una entidad sin rostro nacida de
      una unión que nunca debió ocurrir, cuyo simple paso cerca sume a cualquiera
      en una paranoia que tarda semanas en desaparecer.</p>
      <p>Aun así, la ciudad nunca deja de vivir. Sus mercados funcionan de madrugada,
      sus catedrales jamás apagan sus velas y las calles permanecen iluminadas
      únicamente por antorchas y lámparas de aceite.</p>
    `
  },
  {
    id: "relania",
    title: "Relania",
    category: "Lugares",
    tags: ["reino", "uldum", "dragones"],
    summary: "Un reino construido alrededor del cementerio de los dragones del mundo.",
    region: "Uldum, Sindra",
    gobierno: "",
    religionPredominante: "Culto al Pozo de la Eternidad",
    lugaresDestacados: ["Ethelgard (capital)", "El Pozo de la Eternidad", "Escamargo", "Vigía del Borde", "Última Posada", "Osario del Comercio", "Picos del Osario", "Valle de las Escamas", "Río de Huesos", "Talla de Hueso", "Retiro de los Guardianes", "Los Rediles del Pozo", "La Muda"],
    content: `
      <p>Un reino construido alrededor del lugar donde alguna vez existió el Pozo de la
      Eternidad. Actualmente ese inmenso cráter sirve como cementerio para los
      dragones del mundo. Cuando un dragón siente que su vida llega a su fin,
      emprende un último viaje hacia Relania para descansar junto a sus
      ancestros. El territorio que rodea el cráter sigue habitado por el Dragón, el
      más famoso y pacífico de los grandes dragones vivos, cuyo linaje dio origen a
      los draconianos; en el Retiro de los Guardianes vigilan el cielo los Fulgoval,
      Fulgor y Vendaval, guardianes dracónicos con dominio sobre el rayo y el viento.</p>
      <p>Los habitantes consideran este lugar sagrado y no suelen intervenir en los
      conflictos del mundo. Para ellos, los imperios nacen y desaparecen igual que
      las estaciones. Se dice que los huesos de los dragones aún conservan parte de
      su poder, aunque nadie ha conseguido extraerlo sin sufrir consecuencias. El
      Culto al Pozo de la Eternidad gobierna en la práctica la vida religiosa del
      reino entero, decidiendo qué expediciones se autorizan y qué huesos pueden
      venderse legalmente fuera de sus fronteras. También es el Culto quien
      mantiene alimentada a Zenoj, una aberración de múltiples cabezas nacida de un
      cruce que nunca debió repetirse, recluida en una montaña remota para que no
      tenga motivos para abandonarla.</p>
    `
  },
  {
    id: "escamargo",
    title: "Escamargo",
    category: "Lugares",
    tags: ["ciudad", "relania", "uldum", "sindra", "dragones"],
    summary: "Ciudad de draconianos, descendientes directos de los dragones que reposan en el Pozo de la Eternidad, que consideran su propia existencia una forma de duelo perpetuo.",
    region: "Relania, Uldum, Sindra",
    gobierno: "Consejo de linajes dracónicos",
    religionPredominante: "Culto al Pozo de la Eternidad",
    lugaresDestacados: [],
    content: `
      <p>Escamargo alberga a la mayor concentración de draconianos del mundo
      conocido, descendientes que llevan generaciones organizando su sociedad
      alrededor de un principio compartido, honrar a los ancestros que descansan a
      poca distancia en el Pozo de la Eternidad. Cada linaje mantiene registros
      genealógicos meticulosos que remontan, con distinto grado de certeza, hasta
      un dragón específico entre los huesos del cráter.</p>
      <p>El Consejo de linajes que gobierna la ciudad interviene poco en
      asuntos externos a Relania, siguiendo la misma filosofía de distancia que
      caracteriza a todo el reino. Los draconianos de Escamargo consideran su
      propia existencia una forma de duelo perpetuo y respetuoso, ni tristeza
      constante ni indiferencia, simplemente memoria sostenida generación tras
      generación.</p>
    `
  },
  {
    id: "vigia-del-borde",
    title: "Vigía del Borde",
    category: "Lugares",
    tags: ["aldea", "relania", "uldum", "sindra", "dragones"],
    summary: "Puesto de guardianes que patrulla el perímetro del Pozo de la Eternidad, evitando que buscadores de reliquias profanen el cementerio de dragones.",
    region: "Relania, Uldum, Sindra",
    gobierno: "Orden de Guardianes del Pozo",
    religionPredominante: "Culto al Pozo de la Eternidad",
    lugaresDestacados: [],
    content: `
      <p>La Orden de Guardianes que vive en Vigía del Borde dedica su existencia
      entera a una sola tarea, asegurarse de que ningún buscador de reliquias, por
      más desesperado o codicioso que sea, logre extraer huesos dracónicos del
      Pozo de la Eternidad sin autorización. Los pocos que lo intentan descubren
      que los guardianes conocen cada sendero de acceso al cráter mejor que ellos
      mismos.</p>
      <p>Los guardianes no consideran su trabajo un castigo, sino un honor que se
      hereda dentro de ciertas familias desde hace generaciones. Vivir
      permanentemente al borde del cementerio más sagrado de Relania implica
      presenciar, con cierta regularidad, la llegada de un dragón moribundo en su
      último vuelo, un espectáculo que ningún guardián describe jamás como
      rutinario.</p>
    `
  },
  {
    id: "pozo-de-la-eternidad",
    title: "El Pozo de la Eternidad",
    category: "Lugares",
    tags: ["naturaleza", "relania", "uldum", "sindra", "dragones"],
    summary: "Cráter sagrado en el centro de Relania donde alguna vez existió el pozo que da nombre al reino, hoy cementerio final de todos los dragones del mundo.",
    region: "Relania, Uldum, Sindra",
    gobierno: "Culto al Pozo de la Eternidad",
    religionPredominante: "Culto al Pozo de la Eternidad",
    lugaresDestacados: [],
    content: `
      <p>Los relatos sobre qué era exactamente el Pozo antes de
      convertirse en cráter se contradicen entre sí, algunos hablan de una fuente de agua que no
      envejecía nada de lo que tocaba, otros de una grieta directa hacia algo
      más antiguo que el propio mundo. Lo único que Relania entera acepta sin
      discutir es lo que el lugar es ahora, el punto exacto hacia el que
      vuela cualquier dragón que siente cerca su propia muerte.</p>
      <p>El fondo del cráter desaparece bajo capas de huesos acumuladas
      durante más generaciones de las que Ethelgard puede contar con
      precisión, y el Culto que administra el lugar prohíbe terminantemente
      cualquier excavación que no sea estrictamente ceremonial. Vigía del
      Borde patrulla su perímetro exterior, pero dentro del propio cráter no
      hay guardias, solo el acuerdo tácito de que nadie profana lo que tantos
      dragones eligieron como último destino.</p>
      <p>Parte de la magia residual del cráter terminó impregnando carne y sangre, pero
      en ciertos puntos del perímetro, donde la concentración es más alta, cristalizó
      directamente sobre la roca hasta que algunas de esas formaciones despertaron.
      Los cristalinos que nacen así no comparten la devoción de Escamargo hacia el
      lugar; para ellos su propia existencia es un hecho simple, no una prueba del
      poder del Pozo que exija explicación.</p>
    `
  },
  {
    id: "ultima-posada",
    title: "Última Posada",
    category: "Lugares",
    tags: ["aldea", "relania", "uldum", "sindra", "dragones"],
    summary: "Aldea de posada en el camino hacia el Pozo de la Eternidad, último punto de descanso tanto para peregrinos de duelo como, ocasionalmente, para dragones que emprenden su viaje final.",
    region: "Relania, Uldum, Sindra",
    gobierno: "Hermandad de posaderos",
    religionPredominante: "Culto al Pozo de la Eternidad",
    lugaresDestacados: [],
    content: `
      <p>Última Posada recibe a dos tipos de viajeros muy distintos, peregrinos
      que llegan desde todo Uldum para presentar sus respetos en el Pozo de la
      Eternidad, y ocasionalmente dragones en las últimas etapas de su viaje
      final, que sobrevuelan la aldea a baja altura como si reconocieran, incluso
      en ese estado, que están cerca de casa.</p>
      <p>La Hermandad de posaderos que administra la aldea ha desarrollado un
      protocolo silencioso para esos avistamientos, despejar el cielo, guardar
      silencio y dejar que el dragón continúe sin interrupción. Ningún posadero de
      la aldea ha olvidado jamás la primera vez que presenció el paso de uno, sin
      importar cuántos años lleve trabajando allí.</p>
    `
  },
  {
    id: "osario-del-comercio",
    title: "Osario del Comercio",
    category: "Lugares",
    tags: ["ciudad", "relania", "uldum", "sindra", "dragones", "mercante"],
    summary: "Ciudad fronteriza donde se comercia, bajo estricta supervisión del Culto, con fragmentos óseos dracónicos autorizados para salir de Relania.",
    region: "Relania, Uldum, Sindra",
    gobierno: "Culto al Pozo de la Eternidad, mediante licencias comerciales",
    religionPredominante: "Culto al Pozo de la Eternidad",
    lugaresDestacados: [],
    content: `
      <p>El Osario del Comercio existe como la única salida legal para los
      fragmentos óseos dracónicos que el Culto al Pozo de la Eternidad autoriza,
      en circunstancias muy específicas, a abandonar Relania. Cada pieza que se
      vende aquí lleva un sello que certifica su origen y su autorización, y
      comerciar con huesos sin ese sello se castiga con una severidad que ningún
      otro delito comercial del reino recibe.</p>
      <p>Compradores de todo Sindra llegan hasta aquí buscando el poder residual
      que, según se dice, todavía conservan ciertos fragmentos, aunque el Culto se
      asegura de que nada verdaderamente peligroso salga jamás a la venta. Los
      propios mercaderes de la ciudad conocen los riesgos mejor que nadie, y
      ninguno se arriesga a vender algo que después no pueda controlar.</p>
    `
  },
  {
    id: "har",
    title: "Har",
    category: "Lugares",
    tags: ["reino", "uldum", "alianza"],
    summary: "Una alianza inestable de reinos del norte gobernados por jarls, reyes y caudillos.",
    region: "Uldum, Sindra",
    gobierno: "Alianza de pequeños reinos (jarls, reyes y caudillos)",
    religionPredominante: "Korvath",
    lugaresDestacados: ["Skarholm (capital)", "Kraghold", "Fiordoscuro", "Piedra del Legado", "Mercado del Deshielo", "Glaciar de los Juramentos", "Fiordo Helado", "Bosque de Invierno", "Thrandheim", "Balvik", "Vardsund", "El Círculo de Hierro", "Manantial de Brasa", "Cripta de los Lobos", "El Salón de los Cantores", "Los Yermos del Destierro"],
    content: `
      <p>Una alianza inestable de reinos del norte. Aunque los extranjeros la
      consideran una sola nación, Har está formada por decenas de pequeños reinos
      gobernados por jarls, reyes y caudillos que cambian constantemente de
      aliados.</p>
      <p>La guerra es habitual, pero no por odio. Para los habitantes de Har, un
      enemigo digno puede convertirse mañana en un aliado... y viceversa. En Har
      existe una antigua ley: "Ningún desacuerdo merece diez mil muertos."</p>
      <p>En los riscos que ningún jarl se ha molestado en reclamar viven los
      aarakocra, un pueblo alado que observa las alianzas cambiantes desde las
      alturas. Algunos jarls contratan a sus exploradores para vigilar movimientos
      de tropas rivales desde el aire, uno de los pocos acuerdos que casi ningún
      reino de Har discute abiertamente. Más peligrosos son los Yermos del
      Destierro, donde manadas como la de Gofiri cazan con una coordinación que
      roza lo antinatural. Si el líder cae, otro ocupa su lugar de inmediato y el
      grupo no pierde el paso.</p>
    `
  },
  {
    id: "chakur",
    title: "Chakur",
    category: "Lugares",
    tags: ["reino", "uldum", "enanos", "elfos"],
    summary: "La cuna ancestral compartida de enanos y elfos, según los relatos.",
    region: "Uldum, Sindra",
    gobierno: "",
    religionPredominante: "Neravismo",
    lugaresDestacados: ["Khazgard (capital enana)", "Ailenor (capital élfica)", "Piedraverde", "Forjafría", "Umbrallar", "Montaña Compartida", "Bosque de las Dos Coronas", "El Lago Subterráneo", "Las Ruinas de Kharzun-Vael", "Baluarte Gemelo", "Verdesavia", "Kroth-Baraz", "El Cruce", "Raíz de los Ancestros", "Salón de los Reyes Perdidos", "Minas de Luzverde"],
    content: `
      <p>La cuna ancestral según los relatos. Antes de que existieran reinos humanos,
      ambas razas construyeron aquí una de las mayores civilizaciones de la
      historia. Todo terminó con una guerra tan devastadora que ninguna de las dos
      culturas conserva un relato completo de lo sucedido.</p>
      <p>Siglos después, la expansión del Imperio de Balutia obligó a los enanos a
      regresar a la tierra de sus antepasados. Los elfos nunca se marcharon. Desde
      entonces conviven bajo una paz extremadamente frágil. En la Raíz de los
      Ancestros crece el Árbol Ancestral de Eon, un árbol colosal cuyas propias
      raíces mantienen fértil la tierra que ambos pueblos se disputan, protegido
      por un ejército propio de Ent que solo ataca a quien daña el bosque.</p>
    `
  },
  {
    id: "ithranor",
    title: "Ithranor",
    category: "Lugares",
    tags: ["ciudad", "capital", "asmodeo", "roah"],
    summary: "Ciudad catedralicia, sede de la Iglesia de Asmodeo y corazón del poder teocrático humano.",
    region: "Asmodeo, Roah, Gylas",
    gobierno: "Sede de la Iglesia de Asmodeo",
    religionPredominante: "Iglesia de Asmodeo",
    lugaresDestacados: [],
    content: `
      <p>Construida en torno a la Gran Catedral de Asmodeo, cuyas campanas marcan cada
      hora del día para toda la ciudad, Ithranor es tanto centro religioso como
      administrativo del reino. Sus calles están dispuestas en círculos concéntricos
      alrededor del templo mayor, y ningún edificio puede superar su altura sin permiso
      expreso del clero.</p>
      <p>Clérigos y paladines patrullan abiertamente sus calles, y la presencia de
      cualquier raza no humana suele atraer miradas de sospecha, cuando no
      interrogatorios directos. Pese a esta rigidez, Ithranor es también un centro de
      peregrinación respetado en todo Roah, y sus mercados de reliquias e íconos
      religiosos atraen comerciantes de fe dispuestos a tolerar sus estrictas normas a
      cambio del prestigio de vender allí.</p>
    `
  },
  {
    id: "fyre",
    title: "Fyre",
    category: "Lugares",
    tags: ["ciudad", "asmodeo", "roah", "demonios"],
    summary: "Ciudad tomada por el rey demonio en el extremo norte de Asmodeo, contenida pero jamás reconquistada por generaciones de paladines.",
    region: "Asmodeo, Roah, Gylas",
    gobierno: "El rey demonio",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Nadie en Asmodeo recuerda con exactitud cuándo Fyre dejó de ser una ciudad
      leal para convertirse en el trono del rey demonio, solo que para cuando la
      Iglesia reaccionó, ya era demasiado tarde para reconquistarla sin un costo que
      ningún papa estuvo dispuesto a pagar. Hoy sus murallas ennegrecidas y sus torres
      retorcidas marcan hoy el límite norte del reino tan claramente como antes
      marcaban su orgullo.</p>
      <p>Generación tras generación de paladines mantiene el cerco, conteniendo
      cualquier incursión que salga de sus puertas sin jamás cruzar hacia dentro. El
      propio rey demonio, por razones que ningún clérigo ha logrado explicar por completo,
      tampoco ha intentado romper el asedio en serio. Se limita a probar la resolución
      de sus captores una y otra vez, como si el cerco mismo, y no la ciudad, fuera lo
      que realmente le interesara.</p>
    `
  },
  {
    id: "semilla-del-alba",
    title: "Semilla del Alba",
    category: "Lugares",
    tags: ["aldea", "asmodeo", "roah"],
    summary: "Aldea agrícola que alimenta a Ithranor, donde cada cosecha se bendice antes de salir hacia la capital.",
    region: "Asmodeo, Roah, Gylas",
    gobierno: "Aldea bajo supervisión de la Iglesia de Asmodeo",
    religionPredominante: "Iglesia de Asmodeo",
    lugaresDestacados: [],
    content: `
      <p>Todo grano que sale de Semilla del Alba pasa antes por la bendición de un
      sacerdote itinerante, una costumbre tan arraigada que los propios agricultores
      considerarían impensable vender su cosecha sin ese paso, sin importar cuánto
      retrase la carga hacia Ithranor. El pueblo entero organiza su calendario
      agrícola alrededor de las festividades religiosas, no al revés.</p>
      <p>Los pocos forasteros que pasan por aquí notan enseguida que Semilla del
      Alba trata la piedad como una obligación cívica más que como devoción
      personal, algo que sus propios habitantes no consideran contradictorio en
      absoluto. Alimentar a la capital de la fe es, para ellos, una forma de fe en
      sí misma.</p>
    `
  },
  {
    id: "vigia-del-camino",
    title: "Vigía del Camino",
    category: "Lugares",
    tags: ["aldea", "asmodeo", "roah"],
    summary: "Aldea de posada en la ruta de peregrinación entre la Catedral del Alba e Ithranor, que vive enteramente del paso de fieles.",
    region: "Asmodeo, Roah, Gylas",
    gobierno: "Aldea bajo supervisión de la Iglesia de Asmodeo",
    religionPredominante: "Iglesia de Asmodeo",
    lugaresDestacados: [],
    content: `
      <p>Toda la economía de Vigía del Camino depende de un único recurso
      renovable, los peregrinos que caminan entre la Catedral del Alba e Ithranor y
      necesitan, en algún punto del trayecto, una cama, una comida caliente o una
      vela nueva para terminar el viaje. Sus posadas se construyeron, sin
      excepción, con el frente orientado hacia el camino, no hacia ninguna plaza
      central que el pueblo ni siquiera se molestó en construir.</p>
      <p>Los posaderos locales conocen de memoria las variantes regionales de casi
      cada oración de peregrinaje que se recita en Roah, y no es raro escuchar a un
      tabernero corregir a un viajero cansado que se equivoca de verso. Nadie en
      Vigía del Camino lo consideraría descortesía. Lo consideran, simplemente,
      buen servicio.</p>
    `
  },
  {
    id: "guarda-de-fyre",
    title: "Guarda de Fyre",
    category: "Lugares",
    tags: ["aldea", "asmodeo", "roah"],
    summary: "Aldea fortificada que abastece el cerco permanente de los paladines contra Fyre, el asentamiento humano más cercano al trono del rey demonio.",
    region: "Asmodeo, Roah, Gylas",
    gobierno: "Aldea bajo administración de la Catedral de la Vigilia",
    religionPredominante: "Iglesia de Asmodeo",
    lugaresDestacados: [],
    content: `
      <p>Los habitantes de Guarda de Fyre viven más cerca de Fyre que cualquier
      otro civil de Asmodeo, un pueblo que existe casi exclusivamente para mantener
      alimentado, armado y sano al cordón de paladines que sostiene el cerco. Sus
      herreros trabajan casi en exclusiva para la Catedral de la Vigilia, a poca
      distancia, y sus curanderos han visto más heridas de guerra que cualquier
      hospital de la capital.</p>
      <p>Vivir aquí significa aceptar que las noches ocasionalmente traen ruidos
      que ningún manual religioso sabe explicar bien, y que la línea entre zona
      segura y frontera activa depende, algunas semanas, de qué tan bien haya
      dormido el rey demonio. Quienes se quedan lo hacen por fe, por familia, o
      porque en algún momento dejaron de encontrar razones para irse.</p>
    `
  },
  {
    id: "catedral-de-la-vigilia",
    title: "Catedral de la Vigilia",
    category: "Lugares",
    tags: ["catedral", "asmodeo", "roah"],
    summary: "Catedral fronteriza en el norte de Asmodeo, levantada como bastión de fe y retaguardia de los paladines que contienen las incursiones de Fyre.",
    region: "Asmodeo, Roah, Gylas",
    gobierno: "Sede de la Iglesia de Asmodeo",
    religionPredominante: "Iglesia de Asmodeo",
    lugaresDestacados: [],
    content: `
      <p>La Catedral de la Vigilia concentra la determinación de la Iglesia tanto como
      Ithranor concentra su administración. Construida a poca distancia de la frontera
      norte, más cerca de Fyre que cualquier otro templo del reino, sirve como
      retaguardia permanente para los paladines que sostienen la línea contra el rey
      demonio. Sus campanas marcan turnos de guardia, no las horas del día.</p>
      <p>Servir en la Vigilia no se considera un destino cómodo entre el clero, aunque
      casi nadie lo rechaza cuando se le ofrece, porque hacerlo es, dentro de la
      Iglesia, la prueba de fe más reconocida que existe. Sus salones interiores están cubiertos de
      placas con los nombres de paladines caídos, y se dice que ningún sacerdote de la
      Vigilia ha dormido jamás una noche completa sin despertar, al menos una vez,
      creyendo haber oído las campanas.</p>
      <p>Los paladines que sostienen la línea contra Fyre no siempre luchan solos. En
      los momentos más duros del asedio se han visto descender presencias luminosas y
      ajenas que combaten junto a ellos y se marchan de nuevo sin dar explicaciones
      que ningún sacerdote de la Vigilia se atreva a exigir. Nadie sabe con certeza si
      los ángeles acuden por devoción a la Iglesia, por un juicio propio sobre el rey
      demonio, o por razones que escapan a cualquier mortal, y muy pocos en la Vigilia
      se atreven a preguntárselo directamente a uno.</p>
    `
  },
  {
    id: "catedral-del-alba",
    title: "Catedral del Alba",
    category: "Lugares",
    tags: ["catedral", "asmodeo", "roah"],
    summary: "La cuna original de la fe, anterior a Ithranor, donde según la tradición el primer amanecer bendijo a la humanidad como raza elegida.",
    region: "Asmodeo, Roah, Gylas",
    gobierno: "Sede de la Iglesia de Asmodeo",
    religionPredominante: "Iglesia de Asmodeo",
    lugaresDestacados: [],
    content: `
      <p>Mucho antes de que Ithranor existiera siquiera como aldea, la Catedral del
      Alba ya recibía peregrinos. Construida sobre la colina más oriental de Asmodeo,
      su fachada está orientada con una precisión que ningún arquitecto moderno se
      atreve a alterar. El primer rayo de sol de cada solsticio entra directamente por
      el óculo central y golpea el altar mayor, un fenómeno que la tradición
      interpreta como la bendición original que marcó a la humanidad como raza
      elegida.</p>
      <p>Todo aasimar nacido en Asmodeo es traído aquí antes de cumplir un año para
      recibir la unción formal de la Iglesia, y muchos de los peregrinos que
      cruzan el reino terminan su viaje en esta colina y no en la capital. Los
      sacerdotes del Alba se consideran a sí mismos guardianes de una tradición más
      pura y antigua que la burocracia religiosa de Ithranor, una opinión que
      pocas veces dicen en voz alta delante de un cardenal.</p>
    `
  },
  {
    id: "catedral-de-la-pureza",
    title: "Catedral de la Pureza",
    category: "Lugares",
    tags: ["catedral", "asmodeo", "roah"],
    summary: "Sede de la Inquisición de Asmodeo, donde se entrena y despacha a quienes purgan la herejía y la presencia no humana dentro de las propias fronteras del reino.",
    region: "Asmodeo, Roah, Gylas",
    gobierno: "Inquisición de la Iglesia de Asmodeo",
    religionPredominante: "Iglesia de Asmodeo",
    lugaresDestacados: [],
    content: `
      <p>Mientras la Catedral de la Vigilia mira hacia Fyre, la Catedral de la Pureza
      mira hacia adentro. Aquí se forma y se despacha a los inquisidores encargados de
      investigar herejías, pactos ocultos y cualquier presencia no humana que logre
      infiltrarse en territorio de Asmodeo, con una autoridad que en la práctica supera
      a la de casi cualquier noble local. Sus mazmorras, mucho más grandes de lo que
      su fachada modesta sugiere, casi nunca están vacías.</p>
      <p>El nombre de la Pureza no se pronuncia con indiferencia en Asmodeo. Para
      los fieles devotos es garantía de seguridad; para cualquiera
      con algo que ocultar, motivo suficiente para no llamar la atención. Los propios
      inquisidores cultivan esa reputación con cuidado, conscientes de que el miedo
      resuelve la mitad de su trabajo antes de que empiece.</p>
    `
  },
  {
    id: "catedral-del-juramento",
    title: "Catedral del Juramento",
    category: "Lugares",
    tags: ["catedral", "brurland", "derrovia"],
    summary: "Misión de la Iglesia de Asmodeo autorizada en territorio brurlandés, donde cada clérigo debe jurar públicamente no imponer su fe sobre el Mortismo local.",
    region: "Brurland, Derrovia, Gylas",
    gobierno: "Misión de la Iglesia de Asmodeo",
    religionPredominante: "Mortismo",
    lugaresDestacados: [],
    content: `
      <p>Que la Iglesia de Asmodeo mantenga una catedral funcionando en un reino de
      mayoría Mortismo dice tanto de la diplomacia de Brurland como de la ambición de
      la Iglesia. Su nombre no es casual. Cada clérigo destinado aquí debe jurar
      públicamente, ante la corona brurlandesa, que no buscará convertir por la fuerza
      ni la coerción a ningún súbdito del reino, un juramento que la Iglesia exige en
      muy pocos otros lugares del mundo.</p>
      <p>La relación funciona, a su manera, porque ambas partes la
      necesitan. Brurland gana acceso a una red diplomática y comercial que de otro modo
      le sería hostil, y la Iglesia mantiene un pie firme fuera de Roah. Los propios
      brurlandeses tratan la catedral con la cortesía distante que reservarían
      para cualquier embajada extranjera, ni más ni menos.</p>
    `
  },
  {
    id: "catedral-de-las-fraguas",
    title: "Catedral de las Fraguas",
    category: "Lugares",
    tags: ["catedral", "fel", "derrovia"],
    summary: "Misión de la Iglesia de Asmodeo en el corazón industrial de Fel, donde la fe compite abiertamente con el humo de las fundiciones por la atención de sus habitantes.",
    region: "Fel, Derrovia, Gylas",
    gobierno: "Misión de la Iglesia de Asmodeo",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Levantada con el mismo hollín gris que cubre el resto de Vulkrest, la Catedral
      de las Fraguas tuvo que adaptar su arquitectura tradicional a una ciudad que no se
      detiene por ningún oficio religioso, y sus campanas suenan más fuerte que las de
      cualquier otra catedral de la Iglesia, simplemente para hacerse oír por encima del
      ruido constante de las fundiciones vecinas.</p>
      <p>Fel nunca fue territorio natural para la Iglesia de Asmodeo, ya que el
      principado no tiene fe predominante propia, ocupado como está en su industrialización. Esa
      misma ausencia de competencia religiosa resultó, paradójicamente, una
      oportunidad. Los misioneros destinados aquí aprenden rápido a competir por
      audiencia con capataces y sindicatos de obreros antes que con otros clérigos.</p>
    `
  },
  {
    id: "vornhaal",
    title: "Vornhaal",
    category: "Lugares",
    tags: ["ciudad", "capital", "okran", "roah", "bárbaros"],
    summary: "Gran salón fortificado donde los clanes bárbaros de Okran se reúnen para resolver disputas y jurar alianzas.",
    region: "Okran, Roah, Gylas",
    gobierno: "El clan dominante en el Gran Salón",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Más un enorme campamento fortificado que una ciudad en el sentido tradicional,
      Vornhaal crece y se reduce según la estación. En invierno alberga a la mayoría de
      los clanes refugiados del frío, mientras que en los meses cálidos muchos regresan
      a sus propios territorios de caza. Su corazón es el Gran Salón, una construcción
      de madera y piedra donde los jefes de clan se reúnen para resolver disputas
      mediante combate ritual o palabra jurada.</p>
      <p>No existe un gobernante único. Quien logra imponer su voluntad en el Gran Salón
      dirige Vornhaal hasta que otro lo desafíe con éxito. Los relatos orales se
      transmiten de generación en generación alrededor de sus fogatas, preservando una
      historia que ningún libro de Okran ha registrado jamás.</p>
    `
  },
  {
    id: "sepulkrad",
    title: "Sepulkrad",
    category: "Lugares",
    tags: ["ciudad", "capital", "osses", "roah", "no-muertos"],
    summary: "Capital construida sobre catacumbas ancestrales, sede de la Unión de Osses y hogar de sus razas monstruosas.",
    region: "Osses, Roah, Gylas",
    gobierno: "Unión de Osses",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Levantada literalmente sobre un laberinto de catacumbas que se extiende varios
      niveles bajo tierra, Sepulkrad alberga tanto a los vivos como a innumerables
      no-muertos que conviven bajo un frágil pero funcional acuerdo social. Sus torres,
      construidas con huesos fosilizados de criaturas que nadie ha logrado identificar,
      se alzan sobre plazas donde monstruos de todo tipo comercian sin necesidad de
      ocultarse.</p>
      <p>La Unión de Osses gobierna desde el Trono de Ceniza, una estructura ubicada en
      el nivel más profundo de la ciudad conocido por los vivos. Los pocos humanos que
      residen allí lo hacen bajo permiso estricto y revocable, conscientes de que su presencia
      es apenas soportada por una nación que considera a su especie la mayor amenaza
      del mundo.</p>
    `
  },
  {
    id: "karnhold",
    title: "Karnhold",
    category: "Lugares",
    tags: ["prisión", "osses", "roah", "no-muertos"],
    summary: "Complejo de Osses donde poblaciones humanas capturadas se mantienen con vida bajo vigilancia, criadas y cosechadas de forma sistemática para alimentar la maquinaria no-muerta del imperio.",
    region: "Osses, Roah, Gylas",
    gobierno: "Unión de Osses",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>A las afueras de Sepulkrad, tras un cerco de piedra y hueso que nadie cruza
      sin permiso, Karnhold alberga generaciones enteras de humanos que nunca han
      conocido otra vida. La Unión de Osses les provee comida, techo y descendencia
      asegurada, lo suficiente para que la población nunca disminuya, el mismo
      cuidado que cualquier imperio dedica a un recurso que no piensa
      desperdiciar.</p>
      <p>Nada se pierde. Los que mueren de viejos se alzan como esqueletos antes de
      que el cuerpo termine de enfriarse; los que mueren de miedo o desesperación,
      algo que Osses ha aprendido a provocar de manera profesional, dejan tras de sí
      espectros que se suman a sus filas sin necesidad de ritual alguno. Lo que queda
      —huesos, piel, órganos— se reparte entre nigromantes y artesanos que casi
      nunca preguntan de dónde viene. Para el resto del imperio, Karnhold es la prueba
      silenciosa de que hasta la especie que más desprecian sigue siendo útil, bien
      administrada.</p>
    `
  },
  {
    id: "miraveil",
    title: "Miraveil",
    category: "Lugares",
    tags: ["ciudad", "capital", "dolbred", "roah", "magia"],
    summary: "Ciudad-torre hermética, sede de las principales academias arcanas del reino y hogar de sus bibliotecas más antiguas.",
    region: "Dolbred, Roah, Gylas",
    gobierno: "Consejo de academias arcanas",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Miraveil no se parece a ninguna otra capital del continente. Construida en
      torno a siete torres unidas por puentes flotantes sostenidos por magia
      permanente, alberga la mayor concentración de conocimiento arcano conocida en
      Gylas. Solo se puede acceder a sus niveles superiores mediante conjuros de vuelo o
      los ascensores rúnicos que sus propios magos mantienen en funcionamiento.</p>
      <p>Sus habitantes casi no abandonan la ciudad, y los estudiantes que no logran
      superar las rigurosas pruebas de las academias son enviados de regreso a sus
      hogares sin honor alguno. Se dice que en los sótanos de la torre más antigua se
      guardan hechizos que ni siquiera el resto del reino conoce.</p>
      <p>Esos mismos sótanos son, de tanto en tanto, el punto donde algún experimento
      arcano abre una fisura hacia otro plano y deja pasar a un grupo de githyanki
      armados, que toman lo que buscan y desaparecen por la misma grieta antes de que
      los guardias terminen de reaccionar. El consejo de academias ha aprendido a
      reconocer las señales que preceden una incursión, aunque predecirlas con
      certeza sigue fuera de su alcance.</p>
      <p>Entre los estudiantes que llegan por voluntad propia y se quedan, los
      vedalken destacan por una paciencia metódica que exaspera a más de un
      compañero de laboratorio. Muchos de los métodos de estudio más rigurosos que se
      enseñan en las academias llevan la huella de algún maestro vedalken que
      prefirió entender cada variable antes de arriesgar un solo hechizo.</p>
    `
  },
  {
    id: "kigan",
    title: "Kigan",
    category: "Lugares",
    tags: ["ciudad", "capital", "brurland", "derrovia", "gylas"],
    summary: "Capital costera de Brurland, asentada en un golfo protegido que combina puerto militar y sede de la corona.",
    region: "Brurland, Derrovia, Gylas",
    gobierno: "Corona de Brurland",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Kigan se alza sobre los acantilados que rodean un amplio golfo, con su puerto
      natural resguardado de las peores tormentas del mar. Desde la Corona de Brurland
      gobierna un reino marcado por el honor y la caballería, y las murallas de la
      ciudad —reforzadas tras generaciones de guerra— todavía muestran cicatrices de
      antiguos asedios que sus habitantes se niegan a reparar por completo, como recordatorio
      permanente.</p>
      <p>El golfo protege tanto a la flota real como a los mercantes que llegan desde
      Genevia y Derrovia, convirtiendo a Kigan en un puerto tan estratégico como
      ceremonial. En los últimos tiempos, las tragedias recientes que sacudieron al
      reino han dejado su huella también aquí, y los estandartes ondean a media asta con
      más frecuencia de la que cualquier brurlandés recuerda.</p>
      <p>La Corona nunca ha explicado con claridad por qué ciertas familias de su
      realeza envejecen tan despacio, y los rumores llevan generaciones circulando
      por los salones de Kigan. Nobles que apenas cambian de rostro entre un
      retrato y el siguiente, decisiones de la corte que nadie fuera de palacio
      alcanza a entender. Desde que las tragedias recientes sacudieron la estabilidad del reino,
      esas sospechas se susurran con menos cautela que antes, aunque nadie de la
      realeza ha confirmado ni desmentido nada.</p>
    `
  },
  {
    id: "ostwyn",
    title: "Ostwyn",
    category: "Lugares",
    tags: ["ciudad", "capital", "broneland", "derrovia", "gylas", "territorio-ocupado"],
    summary: "Antigua ciudad brurlandesa, hoy sede administrativa de la ocupación de la Unión de Osses.",
    region: "Broneland, Derrovia, Gylas",
    gobierno: "Administración de ocupación de la Unión de Osses",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Ostwyn conserva la arquitectura de piedra clara típica de Brurland, aunque los
      estandartes que ahora cuelgan de sus torres pertenecen a la Unión de Osses.
      Guarniciones mixtas de tropas monstruosas y colaboradores locales mantienen el
      orden en sus calles, mientras la población original sobrevive
      alternando entre la resignación y la resistencia silenciosa.</p>
      <p>Los mercados todavía funcionan, aunque bajo fuertes impuestos de ocupación, y
      no es raro escuchar canciones brurlandesas antiguas cantadas en voz baja en las
      tabernas, como un recordatorio de un reino que muchos de sus habitantes todavía
      consideran su verdadero hogar.</p>
      <p>Entre las tropas monstruosas que patrullan las calles de Ostwyn, los trolls
      destacan por una razón simple. Ningún golpe que la resistencia consigue
      asestarles parece quedarse pegado por mucho tiempo, y su sola presencia basta,
      la mayoría de las veces, para disuadir intentos de sabotaje antes de que
      lleguen a intentarse. Los oficiales de Osses no bajan la guardia frente a
      ellos, pero admiten que ninguna otra fuerza de choque ofrece un rendimiento
      similar a tan bajo costo militar.</p>
    `
  },
  {
    id: "fuerte-ceniza",
    title: "Fuerte Ceniza",
    category: "Lugares",
    tags: ["ciudad", "broneland", "derrovia", "territorio-ocupado"],
    summary: "Guarnición fortificada de la Unión de Osses en el corazón de Broneland, construida para proyectar control militar más que para gobernar.",
    region: "Broneland, Derrovia, Gylas",
    gobierno: "Guarnición de la Unión de Osses",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Fuerte Ceniza no existía antes de la ocupación. La Unión de Osses lo
      levantó en apenas unos años sobre tierra brurlandesa requisada, con murallas
      de piedra oscura que contrastan deliberadamente con la arquitectura clara del
      resto de Broneland, un recordatorio visual de quién sostiene el poder real en
      la región. Ninguna guarnición del territorio ocupado está mejor equipada.</p>
      <p>Tropas monstruosas y colaboradores locales entrenados por Osses comparten
      cuarteles en un arreglo que a ninguno de los dos bandos termina de resultarle
      cómodo, aunque la disciplina impuesta desde arriba mantiene las tensiones
      internas fuera de vista. Los brurlandeses que todavía sueñan con la
      liberación consideran Fuerte Ceniza el símbolo más claro de todo lo que han
      perdido.</p>
    `
  },
  {
    id: "piedrablanca",
    title: "Piedrablanca",
    category: "Lugares",
    tags: ["aldea", "broneland", "derrovia", "territorio-ocupado"],
    summary: "Aldea remota de Broneland donde la resistencia brurlandesa organiza sus operaciones lejos de la vigilancia de Ostwyn.",
    region: "Broneland, Derrovia, Gylas",
    gobierno: "Consejo clandestino de resistencia",
    religionPredominante: "Mortismo",
    lugaresDestacados: [],
    content: `
      <p>Nada en la apariencia de Piedrablanca sugiere que sea el corazón
      operativo de la resistencia brurlandesa. Sus casas de piedra clara,
      idénticas a cualquier otra aldea de Broneland, ocultan sótanos, pasadizos y
      depósitos de armas que ninguna patrulla de Osses ha logrado descubrir en años
      de vigilancia intermitente.</p>
      <p>El consejo clandestino que coordina la resistencia desde aquí evita
      cuidadosamente cualquier acción que atraiga demasiada atención sobre la
      aldea misma, prefiriendo golpes pequeños y constantes antes que un
      levantamiento abierto que Osses aplastaría sin dificultad. Sus habitantes
      cantan las mismas canciones brurlandesas que se escuchan en las tabernas de
      Ostwyn, pero aquí nadie baja la voz al hacerlo.</p>
    `
  },
  {
    id: "buen-trato",
    title: "Buen Trato",
    category: "Lugares",
    tags: ["aldea", "broneland", "derrovia", "territorio-ocupado"],
    summary: "Aldea de Broneland que prosperó cooperando abiertamente con la ocupación de Osses, para disgusto silencioso del resto del territorio.",
    region: "Broneland, Derrovia, Gylas",
    gobierno: "Consejo local, leal a la administración de ocupación",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Mientras el resto de Broneland sobrevive la ocupación con resignación
      o resistencia, Buen Trato eligió una tercera vía, cooperar abiertamente con
      la Unión de Osses a cambio de impuestos reducidos, protección prioritaria y
      acceso a mercados que el resto del territorio ocupado no disfruta. La aldea
      prospera visiblemente más que sus vecinas, una diferencia que nadie necesita
      señalar en voz alta.</p>
      <p>El resto de Broneland trata a Buen Trato con una mezcla de envidia y
      desprecio que sus propios habitantes prefieren ignorar. Algunos justifican
      la cooperación como pragmatismo necesario; otros, en privado, admiten que
      simplemente decidieron que un antiguo reino perdido no vale tanto como una
      cosecha segura.</p>
    `
  },
  {
    id: "paso-de-los-fugitivos",
    title: "Paso de los Fugitivos",
    category: "Lugares",
    tags: ["aldea", "broneland", "derrovia", "territorio-ocupado"],
    summary: "Aldea fronteriza de Broneland desde donde los brurlandeses que ya no soportan la ocupación cruzan hacia el Brurland libre.",
    region: "Broneland, Derrovia, Gylas",
    gobierno: "Sin autoridad formal reconocida por la ocupación",
    religionPredominante: "Mortismo",
    lugaresDestacados: [],
    content: `
      <p>Los funcionarios de Osses jamás admiten abiertamente que Paso de los
      Fugitivos existe para lo que claramente existe, un punto de la frontera lo
      bastante remoto y lo bastante mal vigilado como para que quienes ya no
      soportan la ocupación puedan cruzar hacia el Brurland libre con una
      probabilidad razonable de lograrlo. Las patrullas pasan por aquí con menos
      frecuencia de la que deberían, algo que los propios brurlandeses de Broneland
      no cuestionan demasiado.</p>
      <p>Quienes deciden quedarse en la aldea en vez de cruzar suelen ser familias
      que ayudan a otros a hacerlo, guías informales que conocen cada sendero
      seguro y cada patrulla previsible. Ninguno se llama a sí mismo parte de la
      resistencia. Simplemente ayudan a quien lo pide, y prefieren no darle
      demasiadas vueltas a por qué.</p>
    `
  },
  {
    id: "quitinal",
    title: "Quitinal",
    category: "Lugares",
    tags: ["ciudad", "capital", "mravec", "derrovia", "gylas", "insectoides"],
    summary: "Capital insectoide construida en torno a la Reina Hormiga, corazón político y religioso de la satrapía.",
    region: "Mravec, Derrovia, Gylas",
    gobierno: "Satrapía insectoide",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Quitinal crece literalmente a partir de secreciones endurecidas producidas por
      la propia colonia, formando estructuras orgánicas que ningún arquitecto ha
      diseñado conscientemente. En su centro exacto reside la Reina Hormiga, protegida
      por generaciones de su propia descendencia, cada vez más inteligente y
      sofisticada que la anterior.</p>
      <p>La satrapía se gobierna oficialmente en nombre de la Reina, aunque son sus
      descendientes quienes toman las decisiones reales desde cámaras adyacentes a su
      cámara real. Los visitantes extranjeros describen la ciudad como fascinante e
      inquietante a partes iguales, por la manera en que arquitectura y biología se
      confunden en cada esquina.</p>
    `
  },
  {
    id: "vulkrest",
    title: "Vulkrest",
    category: "Lugares",
    tags: ["ciudad", "capital", "fel", "derrovia", "gylas", "tecnología"],
    summary: "Capital industrial de Fel, dominada por fundiciones y minas que financian la rápida expansión del principado.",
    region: "Fel, Derrovia, Gylas",
    gobierno: "Principado de Fel",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El cielo sobre Vulkrest casi nunca está despejado. El humo constante de sus
      fundiciones tiñe el horizonte de gris incluso en los días más claros. Construida
      sobre uno de los mayores yacimientos minerales heredados del antiguo Reino de
      Tarrena, la ciudad creció a un ritmo que sus propios gobernantes nunca
      lograron poner bajo control.</p>
      <p>El príncipe gobierna desde una residencia elevada sobre las fundiciones
      principales, desde donde puede observar literalmente el motor económico de su
      principado. Los trabajadores, atraídos por salarios más altos que en cualquier
      otro punto de Derrovia, siguen llegando pese a las condiciones duras que la
      industrialización acelerada ha traído consigo.</p>
    `
  },
  {
    id: "rothmoor",
    title: "Rothmoor",
    category: "Lugares",
    tags: ["ciudad", "capital", "cudbusland", "derrovia", "gylas"],
    summary: "Capital de Cudbusland, apostada por un desarrollo más gradual de las riquezas heredadas del antiguo Tarrena.",
    region: "Cudbusland, Derrovia, Gylas",
    gobierno: "Principado de Cudbusland",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>A diferencia de la vecina Vulkrest, Rothmoor optó por un crecimiento más
      medido. Sus calles empedradas conviven con talleres artesanales y pequeñas
      manufacturas en lugar de fundiciones industriales a gran escala. El príncipe de
      Cudbusland defiende públicamente este modelo como más sostenible, aunque en
      privado muchos lo atribuyen simplemente a la falta de capital para igualar la
      expansión de su rival.</p>
      <p>La rivalidad entre ambos principados se respira en cada esquina de Rothmoor,
      desde los carteles que comparan la calidad de sus productos con los de Fel hasta
      las tabernas donde comerciantes de ambos bandos discuten —a veces a los golpes—
      cuál de los dos herederos de Tarrena merece realmente el trono perdido.</p>
    `
  },
  {
    id: "kaishoto",
    title: "Kaishoto",
    category: "Lugares",
    tags: ["ciudad", "capital", "seosan", "derrovia", "gylas"],
    summary: "Capital de la península aislada de Seosan, centro de sus escuelas marciales y tradiciones ancestrales.",
    region: "Seosan, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Kaishoto se organiza alrededor de decenas de escuelas marciales, cada una con
      su propio estilo, filosofía y linaje de maestros. Los edificios bajos de madera y
      piedra, diseñados para resistir tanto terremotos como el paso de los siglos,
      contrastan con la arquitectura del resto de Derrovia, recordando lo poco que
      Seosan se mezcló históricamente con sus vecinos continentales.</p>
      <p>El honor personal se valora por encima de la riqueza, y los duelos formales
      —aunque regulados por estrictas normas que casi nunca terminan en muerte— siguen
      siendo una forma habitual de resolver disputas entre estudiantes de distintas
      escuelas. Visitantes extranjeros describen la ciudad como serena en apariencia,
      pero cargada de una disciplina casi palpable.</p>
      <p>Kaishoto también recibe estudiantes de fuera de Seosan. Los githzerai que
      llegan a la ciudad buscan silencio antes que conflicto, y algunos maestros
      locales han incorporado su filosofía de control mental a la propia enseñanza
      marcial, generando estilos híbridos que ni puristas ni tradicionalistas
      terminan de aceptar sin reservas. Los tabaxi, atraídos por historias de
      escuelas legendarias, suelen llegar como simples viajeros curiosos y terminar
      quedándose años, si no el resto de sus vidas, hasta convertirse en algunos de
      los duelistas más respetados de la ciudad.</p>
    `
  },
  {
    id: "zanmyo",
    title: "Zanmyo",
    category: "Lugares",
    tags: ["ciudad", "seosan", "derrovia"],
    summary: "Puerto de guerra de Seosan, cuna de la escuela de esgrima que forma a la mayoría de los marinos y duelistas navales de la península.",
    region: "Seosan, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "Senkai",
    lugaresDestacados: [],
    content: `
      <p>Zanmyo alberga la flota de guerra de Seosan y, con ella, la Escuela del
      Filo de Sal, cuya disciplina combina esgrima tradicional con el manejo de armas
      a bordo de un barco en movimiento. Sus estudiantes entrenan directamente sobre
      cubiertas inestables antes de tocar tierra firme, convencidos de que un duelo
      ganado con los pies firmes no demuestra nada.</p>
      <p>El puerto recibe a los pocos comerciantes extranjeros que Seosan admite, y la
      ciudad entera vive con un ojo puesto en el mar. Capitanes retirados enseñan
      junto a maestros de espada, y no es raro ver un duelo formal resolverse en el
      muelle mientras los barcos terminan de cargar.</p>
    `
  },
  {
    id: "kensho",
    title: "Kensho",
    category: "Lugares",
    tags: ["ciudad", "seosan", "derrovia"],
    summary: "Ciudad-monasterio en las montañas de Seosan, hogar de la escuela de combate desarmado más antigua de la península.",
    region: "Seosan, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "Senkai",
    lugaresDestacados: [],
    content: `
      <p>Construida en terrazas sobre la ladera de la montaña más alta de Seosan,
      Kensho alberga la escuela de combate desarmado más antigua de la península. Sus
      monjes-guerreros dividen el día entre meditación, trabajo agrícola en las
      terrazas que rodean la ciudad y entrenamiento físico que empieza antes del
      amanecer y termina mucho después de la última luz.</p>
      <p>Entrar a Kensho sin anunciarse con días de anticipación no es una opción, y
      quienes buscan aprender ahí deben primero pasar un año entero trabajando la
      tierra antes de que un maestro considere siquiera evaluarlos. Los pocos
      forasteros que completan la prueba hablan del lugar con una reverencia que rara
      vez se ve fuera de un templo.</p>
    `
  },
  {
    id: "yumigaoka",
    title: "Yumigaoka",
    category: "Lugares",
    tags: ["ciudad", "seosan", "derrovia"],
    summary: "Ciudad de colinas abiertas famosa por sus escuelas de tiro con arco y equitación, donde se celebran los torneos de caza más prestigiosos de Seosan.",
    region: "Seosan, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "Senkai",
    lugaresDestacados: [],
    content: `
      <p>Yumigaoka ocupa una franja de colinas despejadas ideal para el tiro con arco
      a caballo, disciplina que la ciudad ha refinado durante generaciones hasta
      convertirla en su seña de identidad. Sus campos de entrenamiento, marcados con
      dianas de todas las distancias imaginables, se extienden más allá de lo que la
      vista alcanza a cubrir.</p>
      <p>El torneo anual de caza y tiro que organiza la ciudad atrae a arqueros de
      toda Seosan, e incluso a algunos curiosos de Kaishoto que pocas veces se molestan
      en viajar por otra razón. Ganar el torneo tres años seguidos es, según la
      tradición local, el único logro comparable a fundar una escuela propia.</p>
    `
  },
  {
    id: "tetsumura",
    title: "Tetsumura",
    category: "Lugares",
    tags: ["aldea", "seosan", "derrovia"],
    summary: "Aldea de herreros que forja las espadas que portan los duelistas de Seosan.",
    region: "Seosan, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El sonido del martillo sobre el yunque apenas se detiene en
      Tetsumura, una aldea pequeña que produce una proporción sorprendente de las
      espadas que circulan por las escuelas de Seosan. Sus herreros aprenden el
      oficio de forma casi tan estricta como cualquier escuela marcial, con
      generaciones de familias transmitiendo técnicas que nunca ponen por escrito.</p>
      <p>Un duelista de Kaishoto que porta una hoja marcada con el sello de Tetsumura
      goza de un respeto inmediato entre sus pares, aunque los propios herreros
      insisten en que el mérito pertenece a quien empuña la espada, no a quien la
      forjó.</p>
    `
  },
  {
    id: "komezato",
    title: "Komezato",
    category: "Lugares",
    tags: ["aldea", "seosan", "derrovia"],
    summary: "Aldea agrícola que abastece de arroz a la mayoría de las escuelas marciales de Seosan.",
    region: "Seosan, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Los campos de arroz que rodean Komezato alimentan a las
      escuelas marciales de Seosan, cuyos maestros llevan generaciones enviando
      estudiantes a trabajar la tierra durante una temporada como parte de su
      formación. Se considera que ninguna disciplina física tiene sentido sin
      entender primero el esfuerzo de cultivar lo que se come.</p>
      <p>Los propios aldeanos, sin pertenecer formalmente a ninguna escuela, han
      absorbido con los siglos algo de esa misma disciplina, y pocas aldeas de Derrovia
      organizan su trabajo diario con tanta precisión colectiva como Komezato.</p>
    `
  },
  {
    id: "yuiwa",
    title: "Yuiwa",
    category: "Lugares",
    tags: ["aldea", "seosan", "derrovia"],
    summary: "Aldea de aguas termales donde duelistas heridos y maestros retirados de Seosan van a recuperarse.",
    region: "Seosan, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "Senkai",
    lugaresDestacados: [],
    content: `
      <p>Las aguas termales que dan nombre a Yuiwa atraen desde hace generaciones a
      duelistas heridos, maestros retirados y estudiantes agotados de las escuelas
      cercanas. Ninguna escuela reclama la aldea como propia, y todas la respetan por
      igual, y un enfrentamiento formal dentro de sus límites se considera una falta
      grave, sin excepción.</p>
      <p>Algunos de los maestros más legendarios de Seosan eligieron pasar sus
      últimos años en Yuiwa, y no es raro que jóvenes estudiantes hagan el viaje
      solo con la esperanza de cruzar una palabra con alguno de ellos junto a las
      aguas.</p>
    `
  },
  {
    id: "fudeoka",
    title: "Fudeoka",
    category: "Lugares",
    tags: ["aldea", "seosan", "derrovia"],
    summary: "Aldea de escribas y filósofos donde se redactan y conservan los tratados escritos sobre las escuelas marciales de Seosan.",
    region: "Seosan, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "Senkai",
    lugaresDestacados: [],
    content: `
      <p>Fudeoka no enseña ninguna técnica de combate, pero pocos lugares de Seosan
      son tan respetados por sus propios maestros de espada. Aquí se redactan y
      conservan los tratados escritos que documentan estilos, linajes y filosofías de
      cada escuela de la península, algunos con siglos de antigüedad.</p>
      <p>Sus escribas mantienen una neutralidad estricta entre escuelas rivales, y
      cualquier maestro que desee registrar formalmente una nueva técnica debe
      presentarla ante ellos antes de que se considere reconocida. Ganarse un lugar
      en los archivos de Fudeoka pesa, para muchos duelistas, tanto como ganar un
      torneo.</p>
    `
  },
  {
    id: "ebizura",
    title: "Ebizura",
    category: "Lugares",
    tags: ["aldea", "seosan", "derrovia"],
    summary: "Aldea de pescadores en la costa de Seosan, ajena en gran medida a la cultura de las escuelas marciales del interior.",
    region: "Seosan, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Ebizura vive del mar de una forma que el resto de Seosan apenas comparte:
      sus familias de pescadores casi nunca envían hijos a las grandes escuelas, y
      transmiten en cambio su propio conocimiento de corrientes, mareas y bancos de
      pesca de generación en generación.</p>
      <p>La aldea provee el pescado que llega a las mesas de Kaishoto y
      Zanmyo, y aunque sus habitantes respetan la cultura del duelo, la observan con
      la misma distancia curiosa con la que un forastero observaría cualquier otra
      costumbre ajena.</p>
    `
  },
  {
    id: "sakaimura",
    title: "Sakaimura",
    category: "Lugares",
    tags: ["aldea", "seosan", "derrovia"],
    summary: "Aldea fronteriza de Seosan más cercana a las Marchas Nobrianas, cuyos habitantes vigilan de cerca el límite del bosque.",
    region: "Seosan, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Sakaimura se asienta en el punto donde Seosan se acerca más a las Marchas
      Nobrianas, y sus habitantes han aprendido a vivir con un ojo puesto siempre en
      la línea de árboles. Ningún aldeano cruza el límite del bosque sin motivo
      serio, y menos aún después del atardecer.</p>
      <p>Varias escuelas de Kaishoto envían aquí a sus estudiantes más avanzados
      durante temporadas breves, como ejercicio de disciplina bajo tensión constante.
      Los propios sakaimuranos han dejado de sorprenderse por la cantidad de jóvenes
      duelistas que llegan buscando poner a prueba unos nervios que el bosque, tarde
      o temprano, siempre termina examinando.</p>
    `
  },
  {
    id: "konoura",
    title: "Konoura",
    category: "Lugares",
    tags: ["aldea", "seosan", "derrovia"],
    summary: "Aldea de cordeleros y calafates en el istmo angosto de Seosan, donde se construyen los botes que abastecen a Ebizura.",
    region: "Seosan, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El istmo se estrecha tanto junto a Konoura que desde sus astilleros se
      alcanza a ver el mar por ambos lados a la vez. Sus cordeleros y calafates
      construyen los botes que usan las familias pescadoras de la
      costa, siguiendo técnicas que se afinaron durante generaciones para resistir
      las corrientes cerradas que rodean la península.</p>
      <p>No pertenece a ninguna escuela marcial, aunque varios maestros retirados de
      Yuiwa han terminado estableciéndose aquí, atraídos por un ritmo de vida que no
      exige demostrar nada a nadie.</p>
    `
  },
  {
    id: "hita",
    title: "Hita",
    category: "Lugares",
    tags: ["aldea", "seosan", "derrovia"],
    summary: "Aldea de buceadoras de perlas en el extremo sur de la península de Seosan, la más aislada del reino.",
    region: "Seosan, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "Senkai",
    lugaresDestacados: [],
    content: `
      <p>En el extremo sur de la península, donde la tierra termina en un islote
      apenas unido a la costa, Hita vive del buceo de perlas casi tanto como Kaishoto
      vive del duelo. Sus buceadoras heredan el oficio de madres a hijas y descienden
      a profundidades que ningún forastero se atreve a intentar sin entrenamiento
      previo.</p>
      <p>El aislamiento de Hita la mantiene casi ajena a la política de las escuelas
      marciales, aunque las perlas que produce terminan, tarde o temprano, engastadas
      en la empuñadura de alguna espada ceremonial de Kaishoto.</p>
    `
  },
  {
    id: "thalassar",
    title: "Thalassar",
    category: "Lugares",
    tags: ["ciudad", "capital", "pelgiria", "genevia", "gylas", "archipiélago"],
    summary: "Mayor puerto de Pelgiria, punto de encuentro para navegantes, comerciantes y antiguos piratas reformados.",
    region: "Pelgiria, Genevia, Gylas",
    gobierno: "Consejo portuario de las islas",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Construida sobre pilotes que se adentran en una bahía profunda, Thalassar es
      más un laberinto de muelles, pasarelas y mercados flotantes que una ciudad
      convencional. Cada isla del archipiélago envía representantes a su consejo
      portuario, que se reúne en un salón erigido sobre el casco invertido de un
      antiguo galeón encallado hace generaciones.</p>
      <p>Esta ciudad conoce el océano mejor que cualquier otra del reino. Sus pilotos
      guían a los barcos de toda Genevia a través de corrientes y bajíos que solo ellos
      saben leer con precisión. No es raro escuchar historias —algunas ciertas, otras
      exageradas— sobre antiguos piratas que hoy son respetados armadores en sus
      muelles.</p>
      <p>Los pilotos más confiables de Thalassar no siempre son humanos. Los tritones
      que habitan las aguas del archipiélago sirven desde hace generaciones como
      guías informales para quienes se aventuran por corrientes y bajíos que ningún
      mapa describe con precisión, a cambio de tributos que van desde monedas hasta
      simples historias de tierras lejanas. Mantienen con el consejo portuario una
      relación cordial pero distante, y prefieren resolver sus propios asuntos en
      asentamientos submarinos que pocos forasteros de la ciudad han visto siquiera
      de lejos.</p>
    `
  },
  {
    id: "umbrathil",
    title: "Umbrathil",
    category: "Lugares",
    tags: ["ciudad", "capital", "nikaalia", "uldum", "sindra", "nigredo", "oscuridad"],
    summary: "Capital sumida en noche perpetua bajo el domo de Nigredo, iluminada solo por antorchas y velas encendidas sin descanso.",
    region: "Nikaalia, Uldum, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Los habitantes de Umbrathil no recuerdan haber visto el sol directamente. El
      domo de Nigredo que cubre la ciudad desde hace siglos bloquea cualquier luz
      natural, dejando que antorchas, lámparas de aceite y las velas siempre encendidas
      de sus catedrales sean la única fuente de iluminación. El comercio se organiza en
      torno a este ritmo invertido, con mercados que abren de madrugada y cierran mucho
      antes de lo que cualquier forastero esperaría.</p>
      <p>La violencia y la locura forman parte cotidiana de la vida en Umbrathil,
      alimentadas —según creen sus habitantes— por la propia corrupción del Nigredo que
      respiran día tras día. Pese a todo, la ciudad nunca deja de funcionar, sostenida
      por una resiliencia que sus vecinos de Uldum encuentran tan admirable como
      perturbadora.</p>
    `
  },
  {
    id: "ethelgard",
    title: "Ethelgard",
    category: "Lugares",
    tags: ["ciudad", "capital", "relania", "uldum", "sindra", "dragones"],
    summary: "Ciudad-santuario construida junto al Pozo de la Eternidad, guardiana del cementerio de dragones del mundo.",
    region: "Relania, Uldum, Sindra",
    gobierno: "",
    religionPredominante: "Culto al Pozo de la Eternidad",
    lugaresDestacados: [],
    content: `
      <p>Ethelgard se alza justo al borde del inmenso cráter que alguna vez fue el Pozo
      de la Eternidad, hoy convertido en el lugar de descanso final de los dragones del
      mundo. Sus habitantes construyeron la ciudad deliberadamente de espaldas al
      cráter, con templos y viviendas orientados hacia el horizonte opuesto, como
      muestra de respeto hacia un lugar que consideran sagrado y no un espectáculo.</p>
      <p>El Culto al Pozo de la Eternidad mantiene un control silencioso pero firme
      sobre la vida religiosa de la ciudad, y sus habitantes pocas veces se involucran en
      los conflictos del resto del mundo. Se dice que algunos huesos dracónicos aún
      conservan parte de su poder original, aunque nadie en Ethelgard ha logrado
      extraerlo sin sufrir consecuencias graves.</p>
    `
  },
  {
    id: "skarholm",
    title: "Skarholm",
    category: "Lugares",
    tags: ["ciudad", "capital", "har", "uldum", "sindra", "alianza"],
    summary: "Gran salón de consejo donde jarls, reyes y caudillos de Har se reúnen para negociar alianzas y resolver disputas.",
    region: "Har, Uldum, Sindra",
    gobierno: "Consejo de jarls, reyes y caudillos",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Skarholm no gobierna a Har en el sentido tradicional —ningún jarl acepta
      órdenes de otro reino, por pequeño que sea— pero funciona como el punto de
      encuentro donde se sella la mayoría de las alianzas y treguas de la región. Su
      gran salón central, tallado directamente en la roca de un antiguo acantilado, ha
      sido testigo de más pactos rotos y renovados de los que cualquier historiador
      podría contar.</p>
      <p>La ciudad crece y decrece según qué facciones estén reunidas en un momento
      dado, y su antigua ley —"ningún desacuerdo merece diez mil muertos"— se cita con
      frecuencia en sus tabernas, tanto en serio como en broma, dependiendo de cuán
      tensas estén las negociaciones del día.</p>
    `
  },
  {
    id: "khazgard",
    title: "Khazgard",
    category: "Lugares",
    tags: ["ciudad", "capital", "chakur", "uldum", "sindra", "enanos"],
    summary: "Capital enana excavada en las montañas de Chakur, reconstruida tras el regreso forzado de su pueblo desde Balutia.",
    region: "Chakur, Uldum, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Khazgard se extiende casi por completo bajo tierra, tallada directamente en la
      roca de las montañas que los enanos reclaman como cuna ancestral. Su
      reconstrucción, iniciada cuando la expansión del Imperio de Balutia obligó a su
      pueblo a regresar a estas tierras, todavía muestra secciones más nuevas junto a
      ruinas de estructuras mucho más antiguas que ningún enano vivo recuerda haber
      construido.</p>
      <p>La convivencia con los elfos vecinos de Ailenor es, oficialmente, pacífica,
      aunque las patrullas fronterizas de ambos pueblos no suelen bajar la guardia. Los
      artesanos de Khazgard son reconocidos en todo Uldum por su trabajo en piedra y
      metal, heredero directo de técnicas que se remontan a la civilización compartida
      que ambos pueblos perdieron hace siglos.</p>
    `
  },
  {
    id: "ailenor",
    title: "Ailenor",
    category: "Lugares",
    tags: ["ciudad", "capital", "chakur", "uldum", "sindra", "elfos"],
    summary: "Capital élfica de Chakur, construida entre los bosques que sus habitantes nunca abandonaron pese a siglos de guerra y pérdida.",
    region: "Chakur, Uldum, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>A diferencia de Khazgard, Ailenor no se esconde bajo tierra, sino que se extiende entre
      los árboles más antiguos de Chakur, con viviendas y templos integrados a la
      vegetación de forma tan sutil que muchos viajeros pasan cerca sin notar la
      ciudad. Sus habitantes nunca abandonaron estas tierras, ni siquiera durante los
      peores momentos de la guerra que devastó la civilización compartida de enanos y
      elfos hace generaciones.</p>
      <p>Los archivos de Ailenor, guardados en bibliotecas vivas talladas en los propios
      troncos de los árboles más viejos, conservan fragmentos de una historia que ni
      siquiera los enanos de Khazgard recuerdan por completo. La paz entre ambos
      pueblos se mantiene, pero es frágil, y los ancianos de la ciudad advierten con
      frecuencia a los más jóvenes sobre no dar por sentado lo que costó tanto
      reconstruir.</p>
    `
  },
  {
    id: "aurelport",
    title: "Aurelport",
    category: "Lugares",
    tags: ["ciudad", "capital", "kalvia", "kretor", "sindra", "mercante"],
    summary: "Capital mercante de Kalvia, sede del Príncipe Mercante y de las mayores compañías comerciales del continente.",
    region: "Kalvia, Kretor, Sindra",
    gobierno: "Principado mercante (Príncipe Mercante)",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Aurelport se organiza en torno a su puerto y sus bancos con la precisión
      militar de un reino en pie de guerra, donde cada muelle, cada bóveda y cada
      ruta comercial responde a una lógica estrictamente económica. El Príncipe
      Mercante gobierna desde una torre de cristal y oro que domina el puerto, símbolo
      deliberado de la riqueza que sostiene todo el principado.</p>
      <p>Las decisiones políticas de Aurelport rara vez se toman por ideales. Se toman
      por beneficio proyectado, y sus compañías comerciales ejercen una influencia
      comparable a la de ejércitos enteros en el resto del continente. Se dice que en
      Aurelport todo tiene un precio, incluida —según los más cínicos— la lealtad del
      propio Príncipe Mercante.</p>
      <p>Las caravanas de medianos que recorren sus rutas comerciales han construido,
      generación tras generación, una reputación de puntualidad que muchos mercaderes
      prefieren pagar de más por conservar. En una ciudad donde todo se mide en
      beneficio proyectado, esa reputación silenciosa resulta, paradójicamente, tan
      rentable como cualquier golpe de suerte comercial. Los goblins de Barrio Verde
      los tratan con un respeto cauteloso, conscientes de que ninguna artimaña iguala
      la ventaja de una palabra que siempre se cumple.</p>
    `
  },
  {
    id: "vado-ceniza",
    title: "Vado Ceniza",
    category: "Lugares",
    tags: ["aldea", "frontera", "brurland"],
    summary: "Asentamiento fronterizo de Brurland, escenario de la defensa desesperada contra un protodraco que costó la vida de Coach.",
    region: "Brurland, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Un asentamiento modesto en el límite del territorio brurlandés, compuesto por
      poco más que un puñado de granjas y un mercado semanal que atrae a viajeros de
      los alrededores. Sus defensas nunca fueron pensadas para resistir un ataque
      serio, apenas una empalizada de madera reforzada con lo que sus habitantes
      pudieron reunir con el tiempo.</p>
      <p>El pueblo es recordado hoy por una noche en particular, la defensa desesperada
      de su refugio improvisado contra un protodraco que descendió sobre las
      barricadas. Los aldeanos que sobrevivieron todavía repiten los nombres de quienes
      no lo lograron, y algunos aseguran que el sitio exacto donde cayó Coach nunca
      volvió a crecer pasto verde.</p>
    `
  },
  {
    id: "wolfmere",
    title: "Wolfmere",
    category: "Lugares",
    tags: ["ciudad", "brurland", "derrovia"],
    summary: "Ciudad-guarnición de Brurland, segunda plaza militar del reino tras Kigan, encargada de vigilar la frontera con Broneland.",
    region: "Brurland, Derrovia, Gylas",
    gobierno: "Guarnición de la Corona de Brurland",
    religionPredominante: "Mortismo",
    lugaresDestacados: [],
    content: `
      <p>Wolfmere se levanta a poca distancia de la frontera con Broneland, y su
      guarnición permanente es la segunda más numerosa del reino después de la propia
      Kigan. Sus murallas se reforzaron generación tras generación conforme la
      amenaza de Osses se volvió más real que teórica, hasta convertir la ciudad en
      un cuartel casi tan grande como el resto del asentamiento civil.</p>
      <p>Muchos de los caballeros que hoy sirven en Kigan se formaron primero en
      Wolfmere, donde la disciplina se mide en guardias cumplidas frente a la
      frontera antes que en torneos ceremoniales. La ciudad vive con una tensión
      constante que sus propios habitantes casi ya no notan, acostumbrados a
      dormir con un ojo puesto en el este.</p>
    `
  },
  {
    id: "rivenport",
    title: "Rivenport",
    category: "Lugares",
    tags: ["ciudad", "brurland", "derrovia", "mercante"],
    summary: "Ciudad comercial de Brurland asentada en el río principal del reino, centro de un comercio que la corona nunca logró someter por completo.",
    region: "Brurland, Derrovia, Gylas",
    gobierno: "Consejo de gremios, bajo autoridad nominal de la Corona",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Rivenport creció donde el río principal de Brurland se vuelve navegable,
      convirtiéndose con el tiempo en el verdadero centro comercial del reino, muy
      por delante de la propia Kigan en volumen de mercancía movida. Gremios de
      mercaderes locales negocian entre sí con una independencia que la corona
      deja correr mientras el flujo de impuestos no se interrumpa.</p>
      <p>La ciudad financia, sin decirlo demasiado alto, una parte considerable del
      esfuerzo militar de Brurland, y algunos de sus gremios más antiguos guardan
      tanta influencia real sobre las decisiones del reino como cualquier noble
      titulado. Los caballeros de Kigan lo saben, y lo dejan pasar, porque Rivenport
      siempre paga a tiempo.</p>
    `
  },
  {
    id: "marshfield",
    title: "Marshfield",
    category: "Lugares",
    tags: ["aldea", "brurland", "derrovia"],
    summary: "Feudo de criadores de caballos que abastece de monturas de guerra a la caballería de Brurland.",
    region: "Brurland, Derrovia, Gylas",
    gobierno: "Feudo bajo un señor local, vasallo de la Corona",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Los pastos húmedos que rodean Marshfield producen algunos de los mejores
      caballos de guerra de Brurland, criados durante generaciones para soportar el
      peso de un caballero armado sin perder resistencia ni temperamento. Ningún
      escuadrón de caballería del reino se considera completo sin al menos algunas
      monturas marcadas con el hierro del feudo.</p>
      <p>El señor local paga su tributo a la Corona directamente en
      caballos, un arreglo que le ha ganado una influencia desproporcionada para el
      tamaño de sus tierras. Los mozos de cuadra de Marshfield presumen, no sin
      razón, de conocer mejor el temperamento de un caballo de batalla que muchos
      caballeros que los montan.</p>
    `
  },
  {
    id: "wheatholt",
    title: "Wheatholt",
    category: "Lugares",
    tags: ["aldea", "brurland", "derrovia"],
    summary: "Feudo agrícola que sostiene el abastecimiento de grano de Brurland.",
    region: "Brurland, Derrovia, Gylas",
    gobierno: "Feudo bajo un señor local, vasallo de la Corona",
    religionPredominante: "Mortismo",
    lugaresDestacados: [],
    content: `
      <p>Los campos de trigo que rodean Wheatholt alimentan tanto a la capital como a
      las guarniciones fronterizas de Wolfmere, y su producción se considera tan
      estratégica que la Corona interviene directamente cuando una mala cosecha
      amenaza con reducirla. El feudo entero organiza su calendario en torno a la
      siembra y la cosecha con una disciplina casi militar.</p>
      <p>Sus habitantes conservan tradiciones de Mortismo particularmente arraigadas,
      y cada cosecha se cierra con un ritual de gratitud hacia quienes ya no están
      para verla. Los años de escasez, según cuentan los más ancianos del feudo, se
      recuerdan tan solemnemente como cualquier batalla perdida.</p>
    `
  },
  {
    id: "stonedelve",
    title: "Stonedelve",
    category: "Lugares",
    tags: ["aldea", "brurland", "derrovia"],
    summary: "Feudo minero que extrae la piedra y el mineral con los que se construyen y arman las fortalezas de Brurland.",
    region: "Brurland, Derrovia, Gylas",
    gobierno: "Feudo bajo un señor local, vasallo de la Corona",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Las canteras de Stonedelve proveen la piedra con la que se
      construyen y reparan las murallas de Brurland, mientras que sus vetas de
      mineral alimentan las forjas que arman a la caballería del reino. El feudo
      entero huele a piedra recién cortada y humo de fragua, incluso en las pocas
      calles que se alejan de las canteras.</p>
      <p>Generaciones de mineros han desarrollado un conocimiento del terreno que
      ningún ingeniero de la capital se atreve a cuestionar abiertamente, y no es raro
      que la Corona consulte directamente a los capataces de Stonedelve antes de
      aprobar la construcción de una nueva fortificación en cualquier parte del
      reino.</p>
    `
  },
  {
    id: "los-centinelas-helados",
    title: "Los Centinelas Helados",
    category: "Lugares",
    tags: ["montaña", "brurland", "derrovia", "gylas", "frontera"],
    summary: "Cordillera nevada en el extremo norte de Brurland, con vetas de calor volcánico bajo el hielo, donde la Corona apuesta a sus caballeros más jóvenes antes de enviarlos al frente de Broneland.",
    region: "Brurland, Derrovia, Gylas",
    gobierno: "Guarnición de la Corona de Brurland",
    religionPredominante: "Mortismo",
    lugaresDestacados: [],
    content: `
      <p>Al norte de Wolfmere, donde termina la última granja y empieza la roca
      desnuda, la frontera brurlandesa deja de ser una línea en un mapa y se
      convierte en una pared de picos nevados que ningún ejército ha intentado
      cruzar en pleno invierno. La nieve cubre casi todo el año, pero el suelo
      bajo el hielo se mantiene extrañamente tibio en ciertas grietas, columnas
      delgadas de vapor pálido que jamás terminan de congelarse. Los mineros de
      Stonedelve, que conocen la piedra mejor que nadie, aseguran que es el mismo
      fuego que arde bajo Balutia, apenas un rescoldo aquí, apagándose lento bajo
      tanto blanco.</p>
      <p>La Corona mantiene una guarnición permanente en las laderas bajas,
      construida junto a esas grietas tibias para que los caballeros de guardia
      sobrevivan el invierno sin perder los dedos. Wolfmere envía aquí a sus
      reclutas más prometedores antes de considerarlos listos para el frente de
      Broneland, una tradición no escrita que convierte sobrevivir un invierno
      completo en los Centinelas en la prueba de disciplina más respetada del
      reino. En las noches más claras, los centinelas juran ver relámpagos moverse
      entre las cumbres más altas sin nube alguna que los acompañe, y prefieren no
      preguntarse demasiado si se trata de Zraith.</p>
    `
  },
  {
    id: "grimhold-okran",
    title: "Grimhold",
    category: "Lugares",
    tags: ["aldea", "okran", "bárbaros"],
    summary: "Campamento estacional de uno de los clanes bárbaros de Okran, trasladado según la caza y el clima.",
    region: "Okran, Roah, Gylas",
    gobierno: "El jefe del clan de turno",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Grimhold no ocupa siempre el mismo lugar. Es el nombre que un clan bárbaro le
      da a su campamento del momento, sin importar dónde lo haya levantado esta
      temporada. Tiendas de piel curtida y estructuras de madera desmontables permiten
      a sus habitantes trasladarse en pocos días cuando la caza escasea o el clima se
      vuelve insostenible.</p>
      <p>Pese a su naturaleza transitoria, Grimhold mantiene tradiciones muy
      arraigadas, y cada fogata central alberga las mismas historias orales noche tras noche,
      transmitidas casi palabra por palabra de generación en generación, sin importar
      en qué rincón de Okran se encuentre el clan ese invierno.</p>
    `
  },
  {
    id: "colmillo-negro",
    title: "Colmillo Negro",
    category: "Lugares",
    tags: ["aldea", "okran", "roah", "bárbaros"],
    summary: "Campamento estacional de un clan rival a Grimhold, cuya competencia por el control del Gran Salón de Vornhaal es tan antigua que ningún anciano recuerda su origen.",
    region: "Okran, Roah, Gylas",
    gobierno: "El jefe del clan de turno",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Como Grimhold, Colmillo Negro no ocupa un lugar fijo, sino que se traslada
      según la caza y las estaciones, aunque su clan tiende a preferir los valles
      más al sur de Okran, donde la caza mayor es más abundante. La rivalidad entre
      ambos clanes por el control temporal del Gran Salón de Vornhaal es tan antigua
      que ningún anciano de ninguno de los dos bandos recuerda cómo empezó, solo que
      empezó.</p>
      <p>Pese a la rivalidad, ambos clanes se reconocen mutuamente el derecho a
      existir de una forma que ningún forastero comprende bien,
      retándose con regularidad en el Gran Salón pero jamás atacando el campamento
      del otro directamente. Los mismos ancianos que compiten ferozmente por el
      liderazgo intercambian, en privado, historias que ninguno contaría frente a su
      propio clan.</p>
    `
  },
  {
    id: "circulo-de-los-huesos",
    title: "Círculo de Huesos",
    category: "Lugares",
    tags: ["aldea", "okran", "roah", "bárbaros"],
    summary: "El único punto fijo de Okran, un anillo de huesos de bestias legendarias donde los clanes celebran ritos de paso que ninguna estación interrumpe.",
    region: "Okran, Roah, Gylas",
    gobierno: "Consejo de ancianos, neutral entre clanes",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Mientras Vornhaal crece y se encoge con las estaciones y Grimhold o
      Colmillo Negro se trasladan según la caza, el Círculo de Huesos jamás se
      mueve, un anillo de huesos de bestias legendarias cazadas por generaciones de
      guerreros de Okran, clavados en la tierra como columnas desde tiempos que
      ningún relato oral logra fechar con precisión.</p>
      <p>Un puñado de ancianos, elegidos por consenso entre todos los clanes en vez
      de pertenecer a uno solo, vive aquí de forma permanente, manteniendo el
      Círculo y presidiendo los ritos de paso que marcan cuándo un joven de Okran se
      convierte oficialmente en guerrero. Ningún clan, por rivalidad que tenga con
      otro, se atrevería a profanar este lugar. Sería, para cualquier bárbaro de
      Okran, la peor clase de deshonra imaginable.</p>
    `
  },
  {
    id: "puesto-de-hueso-roto",
    title: "Puesto de Hueso Roto",
    category: "Lugares",
    tags: ["aldea", "okran", "roah", "bárbaros", "mercante"],
    summary: "El único asentamiento permanente de comercio de Okran, donde los clanes intercambian pieles y trofeos de caza por hierro y sal de los reinos vecinos.",
    region: "Okran, Roah, Gylas",
    gobierno: "Consejo de comerciantes, con permiso de los clanes",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Ni un solo clan de Okran reclama Puesto de Hueso Roto como propio, y esa
      neutralidad forzada es lo único que le permite existir de forma
      permanente en un territorio donde casi nada más lo hace. Comerciantes de
      fuera de Okran, demasiado cautelosos para aventurarse más profundo en el
      territorio, esperan aquí a que los clanes bajen con pieles, trofeos de caza y
      ámbar tallado para intercambiarlos por hierro, sal y herramientas que Okran no
      produce.</p>
      <p>Los propios bárbaros consideran el regateo aquí una forma más de combate
      ritual, y un comerciante que cede demasiado rápido pierde respeto tan rápido
      como un guerrero que huye de un duelo. Quienes sobreviven suficientes
      temporadas de negociación en Puesto de Hueso Roto suelen ganarse, con el
      tiempo, algo parecido al respeto de los propios clanes.</p>
    `
  },
  {
    id: "zaphara-mravec",
    title: "Zaphara",
    category: "Lugares",
    tags: ["aldea", "mravec", "desierto"],
    summary: "Villa construida alrededor de uno de los pocos oasis permanentes del territorio de Mravec.",
    region: "Mravec, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Zaphara existe únicamente porque su oasis nunca se ha secado, algo que ni los
      habitantes más ancianos del pueblo saben explicar con certeza. Las casas de barro
      cocido se agrupan en anillos concéntricos alrededor del agua, y el comercio de
      caravanas que cruzan el desierto sostiene a la villa mucho más que cualquier
      cultivo posible en la zona.</p>
      <p>Vive bajo la protección nominal de la satrapía de Mravec, aunque en la
      práctica sus habitantes resuelven la mayoría de sus asuntos sin intervención
      directa de Quitinal. Algunos viajeros aseguran haber visto a descendientes de la
      Reina Hormiga pasar por el oasis camino a otros asentamientos, sin detenerse
      jamás a comerciar.</p>
    `
  },
  {
    id: "kraghold-har",
    title: "Kraghold",
    category: "Lugares",
    tags: ["aldea", "har", "alianza"],
    summary: "Uno de los muchos pequeños asentamientos que forman la alianza de Har, gobernado por su propio jarl local.",
    region: "Har, Uldum, Sindra",
    gobierno: "Jarl local",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Kraghold es apenas uno entre decenas de pequeños asentamientos similares
      repartidos por Har, cada uno gobernado por su propio jarl y con total autonomía
      sobre sus propios asuntos. Sus casas de madera y piedra están construidas para
      resistir inviernos duros, y su salón principal —mucho más modesto que el de
      Skarholm— sirve tanto de lugar de reunión como de refugio en las peores
      tormentas.</p>
      <p>La lealtad de sus habitantes hacia su jarl es fuerte, pero no ciega. Los
      pactos con otros asentamientos cambian con la misma frecuencia que en el resto
      de la alianza, y no es raro que Kraghold apoye a un bando distinto del que
      apoyaba la temporada anterior.</p>
    `
  },
  {
    id: "fiordoscuro",
    title: "Fiordoscuro",
    category: "Lugares",
    tags: ["ciudad", "har", "uldum", "sindra", "alianza"],
    summary: "Puerto de astilleros y drakkars compartido a regañadientes por varios jarls rivales, la ciudad más poblada de Har fuera de Skarholm.",
    region: "Har, Uldum, Sindra",
    gobierno: "Jarl local, con derecho de atraque compartido",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El fiordo estrecho y profundo que le da nombre a la ciudad protege sus
      astilleros de las peores tormentas del norte, razón por la cual tres jarls
      distintos reclamaron el lugar en generaciones pasadas y ninguno logró
      quedárselo por completo. El resultado, tras décadas de escaramuzas que no
      llevaron a nada, fue un acuerdo incómodo: cada jarl controla su propio muelle
      y su propio astillero, y las disputas se resuelven en el salón neutral que
      corona el acantilado sobre el puerto.</p>
      <p>Los drakkars que salen de Fiordoscuro llevan el emblema del jarl que los
      construyó, no uno común, y es habitual ver naves de facciones rivales
      compartiendo el mismo muelle en calma mientras sus tripulaciones evitan
      cruzar miradas. El acuerdo se sostiene porque a nadie le conviene romperlo:
      quien ataque a otro jarl dentro del fiordo pierde el derecho de reparar sus
      barcos ahí, y sin astilleros propios, ningún jarl de Har dura mucho.</p>
    `
  },
  {
    id: "piedra-del-legado",
    title: "Piedra del Legado",
    category: "Lugares",
    tags: ["aldea", "har", "uldum", "sindra", "alianza"],
    summary: "Campo de monolitos sagrados para el Korvath donde clanes rivales depositan armas por acuerdo tácito, uno de los pocos lugares neutrales de Har.",
    region: "Har, Uldum, Sindra",
    gobierno: "Guardianes del Korvath",
    religionPredominante: "Korvath",
    lugaresDestacados: [],
    content: `
      <p>Cientos de piedras verticales, cada una tallada con el nombre y las hazañas
      de un guerrero muerto, se alzan en hileras irregulares sobre una llanura
      abierta a varios días de camino de Skarholm. Para el Korvath, ser recordado
      en la Piedra del Legado vale más que cualquier tesoro, y los clanes de Har
      envían regularmente a sus mejores narradores para grabar los nombres de sus
      caídos antes de que otro clan reclame el honor de la última hilera libre.</p>
      <p>Los Guardianes que cuidan el lugar no responden ante jarl alguno, y su
      autoridad para exigir que las armas se depositen a las puertas del campo
      antes de entrar es respetada incluso por los caudillos más violentos de la
      alianza. Llevar un arma desenvainada entre las piedras se considera un
      insulto a todos los muertos grabados ahí, y quien lo hace pierde el derecho
      a que su propio nombre sea tallado algún día.</p>
    `
  },
  {
    id: "mercado-del-deshielo",
    title: "Mercado del Deshielo",
    category: "Lugares",
    tags: ["aldea", "har", "uldum", "sindra", "alianza", "mercante"],
    summary: "Mercado estacional en terreno neutral donde jarls rivales comercian durante el deshielo, tregua comercial que se repite cada año pese a las guerras del resto de la temporada.",
    region: "Har, Uldum, Sindra",
    gobierno: "Consejo rotativo de mercaderes",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Cuando el hielo se rompe lo suficiente para que los ríos vuelvan a ser
      navegables, decenas de caravanas y barcazas convergen sobre este cruce de
      caminos entre los territorios de varios jarls que, el resto del año, se
      consideran enemigos. La tregua dura exactamente lo que dura el mercado:
      un mes, tal vez dos, hasta que las últimas pieles y el último grano cambian
      de manos y cada mercader vuelve a las tierras de su propio jarl.</p>
      <p>El consejo que administra el mercado rota entre representantes de los
      clanes participantes cada temporada, y su única función es resolver
      disputas de precios y castigar el robo dentro de los límites del predio.
      Fuera de esos límites, la tregua no aplica, y las escoltas armadas que
      acompañan a cada caravana lo saben bien.</p>
    `
  },
  {
    id: "piedraverde-chakur",
    title: "Piedraverde",
    category: "Lugares",
    tags: ["aldea", "chakur", "frontera"],
    summary: "Aldea mixta de enanos y elfos en la frontera entre Khazgard y Ailenor, símbolo frágil de la paz entre ambos pueblos.",
    region: "Chakur, Uldum, Sindra",
    gobierno: "Consejo mixto de ancianos",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Piedraverde es, según se sabe, el único asentamiento de Chakur donde enanos y
      elfos conviven bajo un mismo techo de forma cotidiana, en lugar de limitarse a
      comerciar en la frontera. Sus construcciones mezclan piedra tallada con madera
      viva, un estilo que ninguna de las dos capitales llegó a adoptar realmente.</p>
      <p>El pueblo se sostiene sobre un consejo mixto de ancianos de ambos pueblos, que
      resuelve disputas antes de que lleguen a oídos de Khazgard o Ailenor. Muchos en
      Chakur consideran a Piedraverde la prueba viviente de que la paz frágil entre
      ambas razas todavía puede sostenerse, siempre que nadie desde fuera intente
      forzarla.</p>
    `
  },
  {
    id: "isla-de-la-farola",
    title: "La Isla de la Farola",
    category: "Lugares",
    tags: ["aldea", "kalvia", "kretor", "sindra"],
    summary: "Islote solitario frente a la costa de Kalvia con una farola perpetuamente encendida, punto de referencia obligado para toda ruta comercial hacia Aurelport.",
    region: "Kalvia, Kretor, Sindra",
    gobierno: "Concesión del Principado mercante",
    religionPredominante: "Iurismo",
    lugaresDestacados: [],
    content: `
      <p>Todo barco mercante que se dirija a Aurelport corrige el rumbo por la
      farola de esta isla, encendida sin interrupción desde que el
      Príncipe Mercante financió su construcción para reducir los naufragios en
      aguas abiertas. La familia que la mantiene vive de un estipendio fijo del
      Principado, renovado generación tras generación sin necesidad de contrato
      nuevo.</p>
      <p>El Iurismo considera el farol un símbolo del comercio justo, una luz que no
      distingue entre naves de Kalvia y naves extranjeras. Los pocos visitantes que
      atracan aquí suelen ser tripulaciones que buscan reparar velas o esperar a que
      pase una tormenta antes de completar el último tramo hasta puerto.</p>
    `
  },
  {
    id: "forjafria",
    title: "Forjafría",
    category: "Lugares",
    tags: ["aldea", "chakur", "uldum", "sindra", "enanos"],
    summary: "Puesto minero enano en las estribaciones más altas de Chakur, proveedor principal de mena para las fraguas de Khazgard.",
    region: "Chakur, Uldum, Sindra",
    gobierno: "Capataz designado por Khazgard",
    religionPredominante: "Neravismo",
    lugaresDestacados: [],
    content: `
      <p>Las vetas de hierro y plata que alimentan las fraguas de Khazgard afloran
      cerca de la superficie en Forjafría, lo bastante alto en la montaña como para
      que la nieve cubra sus tejados de piedra casi todo el año. El puesto
      creció a partir de un simple campamento minero levantado tras el regreso de
      los enanos desde Balutia, y hoy sostiene la producción de
      metal que la capital necesita para su reconstrucción.</p>
      <p>Un capataz nombrado directamente por el consejo de Khazgard administra las
      cuadrillas y reparte las cargas de mineral entre las caravanas que bajan a la
      capital cada pocas semanas. La vida en Forjafría es dura y aislada, pero sus
      mineros se enorgullecen de sostener con sus propias manos la reconstrucción
      de todo un pueblo.</p>
    `
  },
  {
    id: "umbrallar",
    title: "Umbrallar",
    category: "Lugares",
    tags: ["aldea", "chakur", "uldum", "sindra", "elfos"],
    summary: "Aldea élfica en lo más profundo del bosque de Chakur, más tradicionalista y desconfiada de forasteros que la propia Ailenor.",
    region: "Chakur, Uldum, Sindra",
    gobierno: "Círculo de ancianos",
    religionPredominante: "Neravismo",
    lugaresDestacados: [],
    content: `
      <p>Umbrallar se esconde varios días de camino más adentro del bosque que
      Ailenor, entre árboles tan viejos que sus habitantes los consideran parientes
      antes que recursos. Un círculo de ancianos, no un consejo elegido, decide
      todo lo que ocurre en la aldea, y su desconfianza hacia los forasteros
      (enanos incluidos) es mucho mayor que la que muestra la capital.</p>
      <p>Muchos elfos de Umbrallar consideran que Ailenor cedió demasiado terreno
      cultural al tratar con Khazgard tras la guerra, y prefieren mantener sus
      propias costumbres intactas antes que participar de la reconstrucción
      conjunta que se negocia en la capital. La aldea comercia lo mínimo
      indispensable, y solo a través de intermediarios de confianza.</p>
    `
  },
  {
    id: "esporal",
    title: "Esporal",
    category: "Lugares",
    tags: ["aldea", "nikaalia", "uldum", "sindra", "nigredo", "oscuridad"],
    summary: "Asentamiento fungril bajo el domo de Nigredo, donde la bioluminiscencia de sus habitantes ilumina las calles mejor que cualquier antorcha.",
    region: "Nikaalia, Uldum, Sindra",
    gobierno: "Consenso comunitario fungril",
    religionPredominante: "Umbrismo",
    lugaresDestacados: [],
    content: `
      <p>Esporal no necesita antorchas ni velas encendidas como el resto de
      Nikaalia, ya que la bioluminiscencia natural de sus habitantes fungriles
      ilumina las calles con un resplandor tenue pero constante que ningún viento
      ni ninguna lluvia apaga. Para quienes viven aquí, la oscuridad perpetua del
      domo no representa una condena, sino simplemente el clima al que su especie
      evolucionó adaptarse mejor que cualquier otra.</p>
      <p>Los fungriles de Esporal reciben con calma a los refugiados de Umbrathil
      que huyen de la violencia y la locura que el Nigredo alimenta en la capital,
      ofreciendo un ambiente que, sin dejar de ser oscuro, resulta considerablemente
      más tranquilo. El Umbrismo encuentra aquí a algunos de sus fieles más
      devotos, gente que considera su propio cuerpo la prueba viviente de que se
      puede prosperar bajo la Herida.</p>
    `
  },
  {
    id: "forjahonda",
    title: "Forjahonda",
    category: "Lugares",
    tags: ["ciudad", "nikaalia", "uldum", "sindra", "nigredo", "oscuridad"],
    summary: "Ciudad subterránea de duergar y gnomos de las profundidades que extraen minerales de los túneles bajo Nikaalia, evitando cuidadosamente la superficie.",
    region: "Nikaalia, Uldum, Sindra",
    gobierno: "Consejo dividido entre duergar y gnomos de las profundidades",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Forjahonda existe varios niveles por debajo de la propia oscuridad de
      Umbrathil, en túneles que sus habitantes duergar y gnomos de las
      profundidades excavaron con el único fin de alejarse tanto del sol que nunca
      ven como de la locura que el Nigredo alimenta arriba. La convivencia entre
      ambos pueblos es cautelosa, con secciones bien definidas de la ciudad que
      cada uno considera propias.</p>
      <p>El mineral que sale de Forjahonda alimenta la forja y la
      construcción de Umbrathil, transportado por rutas subterráneas que muy
      pocos forasteros conocen o tienen permiso de usar. Los gnomos de las
      profundidades desconfían tanto de los duergar como de cualquier expedición
      de superficie, una tensión constante que el consejo dividido de la ciudad
      apenas logra mantener bajo control.</p>
    `
  },
  {
    id: "el-claustro",
    title: "Claustro",
    category: "Lugares",
    tags: ["ciudad", "nikaalia", "uldum", "sindra", "oscuridad"],
    summary: "Monasterio-biblioteca del Umbrismo donde generaciones de sacerdotes registran cada fenómeno sobrenatural documentado bajo el domo de Nigredo.",
    region: "Nikaalia, Uldum, Sindra",
    gobierno: "Orden monástica del Umbrismo",
    religionPredominante: "Umbrismo",
    lugaresDestacados: [],
    content: `
      <p>El Claustro contiene, según sus propios monjes, el registro
      más completo de fenómenos sobrenaturales que existe en todo Uldum, cada
      incidente documentado con un detalle casi obsesivo desde que el domo de
      Nigredo cubrió Nikaalia por primera vez. Destruir conocimiento se considera,
      dentro del Umbrismo, un pecado casi tan grave como provocar la propia
      Herida.</p>
      <p>Sacerdotes de toda Nikaalia envían copias de sus propios registros
      locales al Claustro cada estación, construyendo entre todos un mapa que
      ningún sacerdote individual podría completar por su cuenta. El monasterio
      funciona también como hospital de emergencia, tal como exige la doctrina,
      atendiendo tanto heridas físicas como los episodios de locura que el
      Nigredo provoca con cierta regularidad entre la población.</p>
    `
  },
  {
    id: "bajovela-nikaalia",
    title: "Bajovela",
    category: "Lugares",
    tags: ["aldea", "nikaalia", "oscuridad"],
    summary: "Barrio-mercado a las afueras de Umbrathil, iluminado solo por velas que sus habitantes nunca dejan apagar.",
    region: "Nikaalia, Uldum, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Bajovela creció como una extensión informal de Umbrathil, demasiado pobre y
      demasiado alejada de las murallas principales para ser considerada parte formal
      de la capital. Su nombre viene de la costumbre —casi obligatoria entre sus
      habitantes— de mantener siempre una vela encendida en cada ventana, como defensa
      simbólica contra la oscuridad que todo lo rodea.</p>
      <p>El crimen es habitual y pocas veces se investiga con seriedad, pero también lo es
      una solidaridad áspera entre vecinos que han aprendido a sobrevivir juntos bajo
      el domo de Nigredo. Sus mercados nocturnos, ruidosos y abarrotados, son de los
      pocos lugares de Nikaalia donde el ambiente se siente, por unas horas, casi
      alegre.</p>
    `
  },
  {
    id: "cala-ronca-pelgiria",
    title: "Cala Ronca",
    category: "Lugares",
    tags: ["aldea", "pelgiria", "piratas"],
    summary: "Antiguo refugio de piratas en Pelgiria, hoy convertido en una tranquila villa de pescadores y armadores retirados.",
    region: "Pelgiria, Genevia, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Cala Ronca debe su nombre al sonido que el viento produce al atravesar los
      arcos rocosos que protegen su pequeña bahía, un rumor constante que sus
      habitantes aseguran haber dejado de notar hace años. Durante generaciones sirvió
      de escondite a tripulaciones que preferían mantenerse lejos de Thalassar y sus
      autoridades.</p>
      <p>Hoy es, en apariencia, una villa de pescadores como cualquier otra, aunque
      varios de sus vecinos más respetados —dueños de embarcaciones, tabernas y
      talleres de reparación naval— reconocen entre risas haber navegado bajo bandera
      negra en su juventud. Nadie en Cala Ronca hace demasiadas preguntas al respecto.</p>
    `
  },
  {
    id: "carenaria",
    title: "Carenaria",
    category: "Lugares",
    tags: ["ciudad", "pelgiria", "genevia", "gylas", "archipiélago"],
    summary: "Astillero principal de Pelgiria, donde se construyen y reparan la mayoría de los barcos que navegan bajo bandera del archipiélago.",
    region: "Pelgiria, Genevia, Gylas",
    gobierno: "Gremio de Carpinteros Navales",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Todo barco importante de Pelgiria se construye en Carenaria, donde
      generaciones de carpinteros navales han perfeccionado técnicas de
      construcción capaces de resistir tanto las tormentas de Genevia como los
      abordajes que todavía ocurren, con menos frecuencia que antes pero sin
      llegar a desaparecer, en las rutas comerciales del archipiélago.</p>
      <p>El Gremio de Carpinteros Navales que gobierna la ciudad mantiene un
      control casi absoluto sobre quién puede aprender el oficio, y un aprendiz
      que no logra impresionar a los maestros durante su primer año casi nunca
      recibe una segunda oportunidad. Thalassar depende de Carenaria tanto como
      Carenaria depende del comercio que llega a través de la capital, una
      relación que ninguna de las dos ciudades necesita explicar en voz alta.</p>
    `
  },
  {
    id: "perlamar",
    title: "Perlamar",
    category: "Lugares",
    tags: ["aldea", "pelgiria", "genevia", "gylas", "archipiélago"],
    summary: "Aldea de buceadores de perlas cuyas aguas producen algunas de las gemas marinas más codiciadas de todo Gylas.",
    region: "Pelgiria, Genevia, Gylas",
    gobierno: "Consejo de familias buceadoras",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Las familias de Perlamar bucean sin equipo especial más allá de lo que
      generaciones de práctica han perfeccionado, capaces de sostener la
      respiración el tiempo suficiente para recolectar ostras de los bancos más
      profundos que rodean la aldea. Las perlas que producen esos bancos, de un
      tono ligeramente rosado que ningún otro punto de Genevia logra igualar, se
      venden a precios que sostienen la economía local.</p>
      <p>El Consejo de familias buceadoras regula cuidadosamente cuántos bancos
      se explotan cada temporada, conscientes de que agotar el recurso destruiría
      en una generación lo que tardó siglos en formarse. Los mercaderes de
      Thalassar hacen fila cada temporada de cosecha, aunque Perlamar vende
      primero a quien mejor trate a sus buceadores, no necesariamente a quien
      ofrezca más oro.</p>
    `
  },
  {
    id: "puerto-franco-pelgiria",
    title: "Puerto Franco",
    category: "Lugares",
    tags: ["ciudad", "pelgiria", "genevia", "gylas", "archipiélago", "mercante"],
    summary: "Puesto comercial neutral entre las islas de Pelgiria, donde se resuelven disputas de comercio antes de que lleguen al consejo portuario de Thalassar.",
    region: "Pelgiria, Genevia, Gylas",
    gobierno: "Tribunal de comercio interinsular",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Puerto Franco se ocupa de resolver la mayoría de los desacuerdos comerciales
      de Pelgiria antes de que escalen hasta el consejo portuario de Thalassar. Su tribunal de
      comercio interinsular, compuesto por mercaderes retirados de distintas
      islas, arbitra disputas sobre rutas, precios y territorios de pesca con una
      rapidez que la burocracia de la capital pocas veces iguala.</p>
      <p>Cada isla de Pelgiria envía, al menos una vez al año, algún
      representante a Puerto Franco para renovar acuerdos comerciales o
      simplemente escuchar qué se está negociando. La ciudad no tiene ambiciones
      políticas propias, y esa falta de ambición es, según muchos, exactamente lo
      que le permite mantener la confianza de islas que de otro modo rivalizarían
      constantemente entre sí.</p>
    `
  },
  {
    id: "campanario-del-viento",
    title: "Campanario del Viento",
    category: "Lugares",
    tags: ["isla", "pelgiria", "genevia"],
    summary: "Isla cubierta de miles de campanillas dejadas como ofrendas por generaciones de marineros, cuyo canto colectivo guía a los barcos a través de la niebla.",
    region: "Pelgiria, Genevia, Gylas",
    gobierno: "",
    religionPredominante: "Talasismo",
    lugaresDestacados: [],
    content: `
      <p>Nadie necesita preguntar cómo llegar al Campanario del Viento. Basta
      con seguir el sonido. Generaciones de marineros de Pelgiria han dejado
      campanillas de metal, hueso o vidrio colgadas de cada rama, poste y arco rocoso de
      la isla como ofrenda de gratitud por un regreso seguro, hasta convertirla en un
      instrumento involuntario que canta con cada ráfaga de viento.</p>
      <p>En noches de niebla espesa, cuando ningún faro basta para orientar a un barco,
      los pilotos de Thalassar se guían por el canto metálico de la isla tanto como por
      cualquier carta náutica. Añadir una nueva campanilla al llegar, y no al partir,
      se considera la única forma correcta de hacerlo, ya que nadie quiere tentar a la suerte
      pidiendo un favor que todavía no le ha sido concedido.</p>
    `
  },
  {
    id: "los-huesos-pelgiria",
    title: "Huesos",
    category: "Lugares",
    tags: ["isla", "pelgiria", "genevia", "piratas"],
    summary: "Laberinto de cascos varados donde el consejo portuario de Thalassar no se atreve a poner un pie, refugio habitual de contrabandistas y fugitivos que conocen sus pasajes de memoria.",
    region: "Pelgiria, Genevia, Gylas",
    gobierno: "Sin autoridad reconocida",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Los capitanes honestos evitan adentrarse en los Huesos por voluntad
      propia, un amasijo de cascos varados unos sobre otros donde la corriente cambia de
      dirección sin aviso entre pasajes que apenas caben un bote pequeño. Esa
      fama peligrosa fue lo que terminó convirtiéndolo en escondite predilecto de
      contrabandistas y fugitivos que necesitan desaparecer de la vista de
      cualquier autoridad de Pelgiria.</p>
      <p>Quienes viven de forma permanente entre los restos no suelen hablar de su
      pasado, y las reglas no escritas del lugar dejan claro que preguntar
      demasiado sobre el cargamento ajeno puede costar caro. Thalassar sabe que
      mucho de lo que se mueve por sus muelles pasó antes por los Huesos,
      y prefiere no indagar en los detalles mientras el flujo de mercancía no se
      detenga.</p>
    `
  },
  {
    id: "isla-de-sal-pelgiria",
    title: "Isla de Sal",
    category: "Lugares",
    tags: ["isla", "pelgiria", "genevia", "mercante"],
    summary: "Isla dominada por extensas salinas naturales cuya producción funciona, de facto, como moneda propia en todo el archipiélago.",
    region: "Pelgiria, Genevia, Gylas",
    gobierno: "Gremio de saleros",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Las salinas naturales que cubren casi toda la Isla de Sal producen más
      del que cualquier otra isla de Pelgiria podría necesitar, y sus habitantes lo
      saben. Durante generaciones, sacos de su sal más pura han circulado entre las
      islas del archipiélago con tanta fiabilidad como cualquier moneda acuñada,
      aceptados sin discusión en mercados que desconfían profundamente unos de otros.</p>
      <p>El gremio de saleros que administra la producción vigila sus salinas con un
      celo casi militar, consciente de que su prosperidad depende enteramente de
      mantener la pureza y la escasez relativa de su producto. Ningún otro punto del
      archipiélago ha logrado replicar sus condiciones exactas, algo que la isla
      protege casi tan celosamente como su propia sal.</p>
    `
  },
  {
    id: "jardin-de-coral-pelgiria",
    title: "Jardín de Coral",
    category: "Lugares",
    tags: ["isla", "pelgiria", "genevia", "acuático"],
    summary: "Isla rodeada por un arrecife de coral que crece y se reorganiza tan rápido que ningún mapa de Pelgiria logra representarlo con precisión por más de una temporada.",
    region: "Pelgiria, Genevia, Gylas",
    gobierno: "",
    religionPredominante: "Talasismo",
    lugaresDestacados: [],
    content: `
      <p>Los cartógrafos de Thalassar dejaron de intentar mapear con precisión el
      arrecife del Jardín de Coral hace décadas, porque crece y se reorganiza a un ritmo que
      ningún otro coral del mundo conocido iguala, cerrando canales navegables en meses
      y abriendo otros nuevos igual de rápido, hasta el punto de que un mapa
      preciso en primavera puede resultar peligrosamente engañoso en otoño.</p>
      <p>Los pocos habitantes de la isla han aprendido a vivir con ese ritmo en lugar de
      contra él, guiando a los visitantes por canales que memorizan de nuevo cada
      pocas semanas antes que confiar en cualquier carta náutica. Aseguran que el coral
      responde, de alguna forma que nadie ha logrado explicar bien, a la presencia
      de magia cercana, una teoría que ningún erudito de Dolbred ha podido ni confirmar
      ni descartar.</p>
    `
  },
  {
    id: "guarida-de-escamas",
    title: "Guarida de Escamas",
    category: "Lugares",
    tags: ["aldea", "uldum", "ruinas"],
    summary: "Asentamiento kobold que custodia una sección de ruinas antiguas, cobrando peaje a cualquier expedición que quiera excavar en su territorio.",
    region: "Uldum, Sindra",
    gobierno: "Consejo de guardianes kobold",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Los kobolds de Guarida de Escamas custodian su sección de ruinas con la
      misma paciencia con la que custodian cualquier trampa antigua, dejando que
      los buscadores de reliquias entren siempre que paguen el peaje
      correspondiente y respeten las zonas que el consejo de guardianes marca como
      fuera de límites. Quien intenta evitar el pago descubre, generalmente
      demasiado tarde, que las trampas que los kobolds mantienen no distinguen
      entre intrusos y viejos peligros.</p>
      <p>La relación entre los kobolds y los eruditos que visitan la aldea es
      cordial en la superficie y cuidadosamente calculada por debajo, ya que ambas
      partes se necesitan mutuamente. Los kobolds conocen las ruinas mejor que
      nadie; los eruditos pagan lo suficiente como para que valga la pena seguir
      vigilando.</p>
    `
  },
  {
    id: "campamento-del-erudito",
    title: "Campamento del Erudito",
    category: "Lugares",
    tags: ["ciudad", "uldum", "ruinas"],
    summary: "Base de expediciones arqueológicas donde eruditos de Nikaalia, Relania, Har y Chakur colaboran, con más rivalidad académica que armonía, para estudiar las ruinas de Uldum.",
    region: "Uldum, Sindra",
    gobierno: "Consorcio interreino de arqueología",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El Campamento del Erudito reúne, bajo el mismo techo improvisado, a
      investigadores de los cuatro reinos de Uldum, una colaboración que sus
      propios organizadores describen como necesaria más que armoniosa. Cada
      expedición que sale del campamento lleva representantes de al menos dos
      reinos distintos, una regla impuesta después de que varias excavaciones
      independientes terminaran en disputas sobre quién tenía derecho a qué
      hallazgo.</p>
      <p>Las tiendas y estructuras semipermanentes del campamento cambian de
      configuración cada temporada, según qué zona de ruinas concentre el mayor
      interés académico ese año. Los eruditos de Relania, más acostumbrados a
      tratar con dragones que con política, suelen quejarse en privado de que
      sobreviven mejor a los peligros arqueológicos que a las reuniones del
      consorcio.</p>
    `
  },
  {
    id: "manantial-de-las-cuatro-coronas",
    title: "Manantial de las Cuatro Coronas",
    category: "Lugares",
    tags: ["ciudad", "uldum", "mercante"],
    summary: "Oasis comercial en el centro de Uldum donde mercaderes de Nikaalia, Relania, Har y Chakur intercambian bienes que ninguno de los cuatro reinos produce por su cuenta.",
    region: "Uldum, Sindra",
    gobierno: "Consejo de las Cuatro Coronas",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Los cuatro reinos de Uldum dependen, cada uno a su manera, de lo que los
      demás producen, y esa carencia compartida fue lo que dio origen al Manantial
      de las Cuatro Coronas, un oasis lo bastante equidistante de
      Nikaalia, Relania, Har y Chakur como para que ninguno de los cuatro tenga
      ventaja logística clara sobre los demás.</p>
      <p>El Consejo de las Cuatro Coronas que administra el mercado rota su
      presidencia entre representantes de cada reino cada estación, un sistema
      diseñado deliberadamente para que ninguna corona domine las negociaciones
      por demasiado tiempo. Fungriles de Nikaalia, mercaderes dracónidos de
      Relania, jarls de Har y artesanos enano-élficos de Chakur comparten el mismo
      mercado sin que ninguno lo considere territorio propio.</p>
    `
  },
  {
    id: "tumbaquieta",
    title: "Tumbaquieta",
    category: "Lugares",
    tags: ["aldea", "uldum", "ruinas"],
    summary: "Pueblo construido sobre una tumba imperial que nadie más se atrevió a excavar, habitado por quienes no tuvieron mejor opción que quedarse.",
    region: "Uldum, Sindra",
    gobierno: "Sin autoridad formal",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Tumbaquieta se levantó sobre una tumba imperial que los buscadores de
      reliquias serios evitan excavar completamente, conformándose con recuperar
      lo que encuentran cerca de la superficie antes de retirarse. Los rumores
      sobre lo que descansa en las cámaras más profundas varían según quién los
      cuente, pero todos coinciden en que quien ha bajado lo suficiente no ha
      regresado dispuesto a describir con precisión lo que vio.</p>
      <p>Sus pocos habitantes permanentes suelen ser personas que no tenían mejor
      opción que quedarse, deudores fugitivos, familias demasiado pobres para
      mudarse, buscadores de reliquias que perdieron demasiado como para marcharse
      con las manos vacías. Viven con una calma resignada sobre lo que podría
      despertar bajo sus pies, conscientes de que preocuparse todos los días no
      cambiaría nada.</p>
    `
  },
  {
    id: "polvo-de-reyes-uldum",
    title: "Polvo de Reyes",
    category: "Lugares",
    tags: ["aldea", "uldum", "ruinas"],
    summary: "Asentamiento levantado entre las ruinas de un imperio olvidado de Uldum, sostenido por el comercio de reliquias.",
    region: "Uldum, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Construido literalmente entre columnas caídas y muros a medio enterrar de un
      imperio cuyo nombre nadie recuerda, Polvo de Reyes vive de lo que sus habitantes
      logran excavar de las ruinas circundantes. Cada casa nueva incorpora, de una
      forma u otra, piedra o metal recuperado de monumentos que nadie sabe reconstruir
      con la tecnología actual.</p>
      <p>Buscadores de reliquias y eruditos de todo Sindra pasan regularmente por el
      pueblo, comprando fragmentos de un pasado que Uldum entero sigue sin poder
      explicar. Sus habitantes han aprendido a vivir con la incertidumbre de
      no saber qué —o quién— podría seguir despierto bajo las ruinas que pisan a
      diario.</p>
    `
  },
  {
    id: "vaelmoot",
    title: "Vaelmoot",
    category: "Lugares",
    tags: ["isla", "neutral", "dolbred"],
    summary: "Isla neutral entre los dos continentes donde los reinos del mundo alguna vez se reunían a dialogar, hoy vacía pero todavía protegida por todos, en especial por Dolbred.",
    region: "",
    gobierno: "Ninguno formal — vigilada informalmente por Dolbred",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Vaelmoot es la única isla del mundo conocido donde ningún reino ejerce
      soberanía formal, y la única regla que todos —sin excepción— han jurado
      respetar. Ninguna forma de violencia está permitida dentro de sus costas. Aquí,
      hace generaciones, los representantes de todos los reinos de Gylas y Sindra se
      reunían periódicamente para dialogar, negociar tratados y resolver disputas que
      en cualquier otro lugar habrían terminado en guerra.</p>
      <p>Han pasado décadas desde la última junta formal —nadie recuerda con exactitud
      por qué dejaron de convocarse, aunque las teorías no faltan— pero ningún reino se
      ha atrevido a reclamar la isla para sí ni a descuidar su protección. Dolbred, en
      particular, mantiene una guardia constante sobre Vaelmoot, tan dedicada y
      prolongada en el tiempo que informalmente ya se la considera territorio
      dolbriano en todo menos en nombre. Sus salones de consejo, vacíos y cubiertos de
      polvo, esperan la próxima vez que el mundo necesite volver a sentarse a
      hablar.</p>
    `
  },
  {
    id: "glaciar-eterno",
    title: "Glaciar Eterno",
    category: "Lugares",
    tags: ["montaña", "naturaleza", "rasganorte", "thanea"],
    summary: "Muro de hielo que nunca retrocede en el corazón de Rasganorte, bajo el cual los ancianos aseguran que duermen civilizaciones anteriores a la humanidad.",
    region: "Rasganorte, Thanea",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El Glaciar Eterno domina el horizonte de Rasganorte desde cualquier punto de
      la costa, una pared de hielo azulado que avanza y retrocede tan lentamente que
      generaciones enteras la ven como algo permanente. Bajo su superficie, grietas
      profundas exponen capas de hielo antiguo con restos de estructuras que nadie ha
      logrado excavar por completo antes de que el frío o el propio hielo cierren el
      paso de nuevo.</p>
      <p>Los cazadores de Skalgrimr suben regularmente a sus laderas más bajas en
      busca de presas que se refugian del viento en las grietas superficiales, pero
      pocos se aventuran más allá de la línea que marcan los huesos de quienes lo
      intentaron antes.</p>
    `
  },
  {
    id: "bosque-de-escarcha",
    title: "Bosque de Escarcha",
    category: "Lugares",
    tags: ["bosque", "naturaleza", "rasganorte", "thanea"],
    summary: "Bosque de coníferas permanentemente cubiertas de hielo en Rasganorte, cuyos árboles nunca pierden su capa de escarcha ni en pleno verano.",
    region: "Rasganorte, Thanea",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Los pinos del Bosque de Escarcha conservan una capa fina de hielo sobre sus
      agujas durante todo el año, un fenómeno que los sabios de Rasganorte atribuyen a
      alguna corriente fría que corre bajo la tierra del bosque, no al clima de la
      superficie. El silencio entre sus troncos es casi absoluto, roto solo por el
      crujido ocasional de una rama que cede bajo su propio peso helado.</p>
      <p>Los guerreros que se preparan para el Campamento de las Mil Hogueras a veces
      pasan una noche entera aquí sin fuego, como prueba de resistencia antes de
      unirse a la hueste. Los que sobreviven la noche no suelen hablar de lo que vieron
      entre los árboles.</p>
    `
  },
  {
    id: "fiordo-de-los-ahogados",
    title: "Fiordo de los Ahogados",
    category: "Lugares",
    tags: ["naturaleza", "rasganorte", "thanea"],
    summary: "Fiordo traicionero cerca de Bahía Rota, sembrado de restos de naufragios que sus corrientes nunca terminan de hundir.",
    region: "Rasganorte, Thanea",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Las corrientes que entran al Fiordo de los Ahogados cambian de dirección sin
      aviso, empujando barcos contra paredes de roca que apenas se distinguen bajo la
      niebla constante. Restos de cascos y mástiles rotos asoman entre las rocas más
      bajas durante la marea, recordatorio silencioso para cualquier capitán que
      considere un atajo por sus aguas.</p>
      <p>Los pocos pescadores de Bahía Rota que conocen sus pasajes seguros los
      transmiten de padres a hijos sin escribirlos en ningún mapa, convencidos de que
      un fiordo tan hambriento no merece hacerse más fácil de cruzar.</p>
    `
  },
  {
    id: "yermo-cenizo",
    title: "Yermo Cenizo",
    category: "Lugares",
    tags: ["naturaleza", "asmodeo", "roah", "gylas"],
    summary: "Extensión de tierra calcinada alrededor de Fyre, donde la Iglesia de Asmodeo asegura que arde el fuego que consumirá el mundo al final de los tiempos.",
    region: "Asmodeo, Roah, Gylas",
    gobierno: "",
    religionPredominante: "Iglesia de Asmodeo",
    lugaresDestacados: [],
    content: `
      <p>Nada crece en el Yermo Cenizo desde hace generaciones, una franja de tierra
      gris que rodea Fyre como un anillo quemado y que los sacerdotes de la Iglesia
      de Asmodeo predican como advertencia del fuego final que aguarda al mundo. El
      calor sube desde grietas del suelo incluso en las noches más frías, y quienes
      cruzan la ceniza sin protección terminan con los pulmones marcados por semanas.</p>
      <p>Peregrinos penitentes atraviesan el yermo descalzos como parte de sus
      rituales de purificación, guiados por monjes que conocen las rutas donde la
      ceniza se ha enfriado lo suficiente como para no quemar.</p>
    `
  },
  {
    id: "bosque-de-las-confesiones",
    title: "Bosque de las Confesiones",
    category: "Lugares",
    tags: ["bosque", "asmodeo", "roah", "gylas"],
    summary: "Bosque que rodea Ithranor donde los peregrinos se detienen a confesar sus pecados antes de entrar a la ciudad santa de la Iglesia de Asmodeo.",
    region: "Asmodeo, Roah, Gylas",
    gobierno: "",
    religionPredominante: "Iglesia de Asmodeo",
    lugaresDestacados: [],
    content: `
      <p>Todo camino hacia Ithranor atraviesa este bosque denso, salpicado de
      capillas diminutas donde los peregrinos se arrodillan a confesar antes de
      cruzar sus puertas. La tradición sostiene que quien entra a la ciudad santa sin
      haberse detenido aquí carga sus pecados hasta el altar mayor, algo que ningún
      devoto serio está dispuesto a arriesgar.</p>
      <p>Confesores itinerantes recorren los senderos del bosque escuchando a
      quienes prefieren hablar entre los árboles antes que ante un sacerdote de
      piedra, y cobran su servicio en historias tanto como en monedas.</p>
    `
  },
  {
    id: "rio-carmesi",
    title: "Río Carmesí",
    category: "Lugares",
    tags: ["río", "asmodeo", "roah", "gylas"],
    summary: "Río de aguas teñidas de rojo por los minerales de su lecho, que la Iglesia de Asmodeo interpreta como sangre derramada en sacrificio.",
    region: "Asmodeo, Roah, Gylas",
    gobierno: "",
    religionPredominante: "Iglesia de Asmodeo",
    lugaresDestacados: [],
    content: `
      <p>El color del Río Carmesí proviene de los depósitos minerales que atraviesa
      en las montañas cercanas, según los eruditos que han estudiado sus aguas, pero
      la explicación convence a pocos fieles de Asmodeo, que prefieren leerlo como
      sangre de sacrificios antiguos corriendo hacia el mar. Su cauce marca buena
      parte de la frontera oriental del reino.</p>
      <p>Cada ciertos años, la Iglesia organiza procesiones que siguen su curso
      completo desde el nacimiento hasta la desembocadura, deteniéndose en cada
      capilla ribereña para renovar los votos de los sacerdotes locales.</p>
    `
  },
  {
    id: "tierras-altas-de-okran",
    title: "Tierras Altas de Okran",
    category: "Lugares",
    tags: ["montaña", "okran", "roah", "gylas"],
    summary: "Cordillera donde los clanes bárbaros de Okran celebran sus asambleas anuales, terreno considerado neutral entre facciones rivales.",
    region: "Okran, Roah, Gylas",
    gobierno: "Consejo itinerante de clanes",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Cada clan de Okran reclama su propio territorio en las tierras bajas, pero
      las Tierras Altas se consideran terreno neutral desde tiempos que ningún
      anciano recuerda con exactitud. Aquí se reúnen los caudillos una vez al año
      para resolver disputas de sangre, sellar alianzas temporales y medir fuerzas en
      competencias donde salir sin heridos es la excepción.</p>
      <p>Subir a las cumbres más altas sin invitación de un clan anfitrión se
      considera una provocación directa, y los guardias que patrullan sus laderas
      durante la asamblea tienen autorización para responder con violencia.</p>
    `
  },
  {
    id: "estepa-quebrada",
    title: "La Estepa Quebrada",
    category: "Lugares",
    tags: ["naturaleza", "okran", "roah", "gylas"],
    summary: "Vasta llanura agrietada por antiguos cauces secos donde los clanes de Okran cabalgan y cazan durante la estación seca.",
    region: "Okran, Roah, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Grietas profundas cruzan La Estepa Quebrada como cicatrices, restos de ríos
      que dejaron de fluir generaciones atrás. Los jinetes de Okran conocen de memoria
      qué grietas son lo bastante anchas para tragarse a un caballo desprevenido, un
      conocimiento que separa a los cazadores experimentados de los jóvenes que
      todavía no han perdido una montura.</p>
      <p>Manadas de bisontes salvajes cruzan la estepa siguiendo rutas que apenas han
      cambiado en siglos, y cazarlas sigue siendo la prueba de valor más común entre
      los guerreros jóvenes de los clanes.</p>
    `
  },
  {
    id: "bosque-de-los-ancestros",
    title: "Bosque de los Ancestros",
    category: "Lugares",
    tags: ["bosque", "okran", "roah", "gylas"],
    summary: "Arboleda sagrada de Okran donde los clanes entierran a sus guerreros caídos y tallan su nombre en la corteza de un árbol elegido.",
    region: "Okran, Roah, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Cada árbol del bosque lleva tallado el nombre de un guerrero caído, una
      costumbre tan antigua que los troncos más viejos ya no tienen corteza legible
      bajo las capas de nombres superpuestos. Las familias de Okran viajan aquí desde
      cualquier clan para honrar a sus muertos, sin importar cuántas generaciones de
      guerra los hayan separado.</p>
      <p>Talar un árbol del bosque, incluso uno seco, se castiga con el destierro
      permanente del clan del responsable. Es, según dicen los ancianos, la única ley
      que todos los clanes de Okran respetan por igual.</p>
    `
  },
  {
    id: "pantano-marchito",
    title: "El Pantano Marchito",
    category: "Lugares",
    tags: ["naturaleza", "osses", "roah", "gylas"],
    summary: "Ciénaga de Osses donde la vegetación muere apenas brota, poblada por criaturas no muertas que emergen del lodo sin previo aviso.",
    region: "Osses, Roah, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Cualquier planta que brote en El Pantano Marchito se marchita en cuestión de
      días, marcada por el mismo influjo que mantiene caminando a los muertos de
      Osses. El lodo esconde huesos a poca profundidad, y no es raro que una mano
      descarnada se cierre sobre el tobillo de quien camina demasiado despacio.</p>
      <p>La Unión de Osses no molesta en drenarlo ni patrullarlo. Los no muertos que
      emergen de sus aguas se consideran parte del paisaje, tan naturales aquí como
      un zorro o un ciervo lo serían en cualquier otro reino.</p>
    `
  },
  {
    id: "bosque-de-huesos-blancos",
    title: "Bosque de Huesos Blancos",
    category: "Lugares",
    tags: ["bosque", "osses", "roah", "gylas"],
    summary: "Bosque de árboles descoloridos por siglos de necromancia ambiental, donde los troncos caídos se confunden con restos óseos reales.",
    region: "Osses, Roah, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>La corteza de cada árbol de este bosque perdió su color hace generaciones,
      blanqueada por la misma energía que sostiene a los no muertos de Osses.
      Troncos caídos y huesos reales se mezclan en el suelo hasta el punto de que
      distinguirlos a simple vista se ha vuelto casi imposible para cualquiera que no
      sea nativo de la zona.</p>
      <p>Los nigromantes de la Unión consideran el bosque un criadero natural,
      visitándolo con regularidad para reclutar lo que sea que se haya levantado
      entre sus raíces desde la última cosecha.</p>
    `
  },
  {
    id: "lago-sin-fondo",
    title: "El Lago Sin Fondo",
    category: "Lugares",
    tags: ["lago", "osses", "roah", "gylas"],
    summary: "Lago de aguas negras en Osses cuya profundidad nunca se ha medido con éxito, asociado por la tradición local con el origen de la Unión.",
    region: "Osses, Roah, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Todas las sondas que se han lanzado al Lago Sin Fondo se han perdido antes
      de tocar el fondo, o eso aseguran quienes lo han intentado. Sus aguas negras no
      reflejan el cielo ni de día, y la tradición de Osses sostiene que fue aquí donde
      se firmó el primer pacto entre los muertos y los vivos que dio origen a la
      Unión.</p>
      <p>Pescadores locales evitan sus orillas después del atardecer, no por miedo a
      ahogarse, sino porque aseguran que algo desde abajo devuelve la mirada cuando
      uno se asoma demasiado cerca del agua.</p>
    `
  },
  {
    id: "bosque-de-las-runas-vivas",
    title: "Bosque de las Runas Vivas",
    category: "Lugares",
    tags: ["bosque", "dolbred", "roah", "gylas"],
    summary: "Bosque de Dolbred cuyos árboles crecen marcados con runas naturales que emiten un brillo tenue, estudiado por generaciones de magos.",
    region: "Dolbred, Roah, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Los troncos de este bosque crecen con marcas que se parecen tanto a runas
      arcanas que generaciones de magos de Dolbred han dedicado carreras enteras a
      descifrarlas. Algunas emiten un brillo tenue durante la noche, más intenso
      cerca de la Cima de la Torre, lo que alimenta la teoría de que el bosque y la
      torre comparten la misma fuente de poder.</p>
      <p>Talar un árbol aquí sin autorización académica es ilegal en Dolbred, y los
      pocos que lo han intentado reportan que la madera se resiste al hacha de formas
      que ningún carpintero sabe explicar.</p>
    `
  },
  {
    id: "montana-del-eco-arcano",
    title: "Montaña del Eco Arcano",
    category: "Lugares",
    tags: ["montaña", "dolbred", "roah", "gylas"],
    summary: "Elevación de Dolbred donde los conjuros lanzados resuenan durante minutos después de completados, usada como laboratorio natural para hechiceros.",
    region: "Dolbred, Roah, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Cualquier hechizo lanzado en la ladera de esta montaña sigue resonando en el
      aire durante minutos, un eco mágico que los estudiosos de Dolbred atribuyen a
      una línea de poder particularmente densa que atraviesa la roca. El fenómeno
      convierte a la montaña en un laboratorio natural donde los aprendices ponen a
      prueba conjuros nuevos antes de arriesgarse a lanzarlos en la ciudad.</p>
      <p>Los ecos más antiguos, dicen algunos magos, todavía conservan fragmentos de
      hechizos lanzados hace siglos, audibles solo para quien sabe exactamente cómo
      escuchar entre el viento.</p>
    `
  },
  {
    id: "lago-de-cristal",
    title: "Lago de Cristal",
    category: "Lugares",
    tags: ["lago", "dolbred", "roah", "gylas"],
    summary: "Lago de aguas perfectamente transparentes en Dolbred, empleado por adivinos y hechiceros como superficie natural de adivinación.",
    region: "Dolbred, Roah, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>La claridad del Lago de Cristal permite ver su lecho entero incluso en sus
      puntos más profundos, una transparencia que los adivinos de Dolbred aprovechan
      para rituales de escrutinio que en cualquier otra agua resultarían inútiles.
      Reservar una hora de calma junto a su orilla requiere permiso del gremio de
      videntes que administra el acceso.</p>
      <p>En noches de luna llena, dicen los pescadores locales, la superficie del
      lago muestra reflejos que no corresponden al cielo actual, sino a cielos de
      otras épocas o de otros lugares del mundo.</p>
    `
  },
  {
    id: "bosque-cautivo",
    title: "Bosque Cautivo",
    category: "Lugares",
    tags: ["bosque", "broneland", "derrovia", "gylas"],
    summary: "Bosque fronterizo de Broneland bajo vigilancia constante de la Unión de Osses, símbolo de un territorio que sigue sin ser libre.",
    region: "Broneland, Derrovia, Gylas",
    gobierno: "Guarnición de la Unión de Osses",
    religionPredominante: "Mortismo",
    lugaresDestacados: [],
    content: `
      <p>Torres de vigilancia asoman entre los árboles del Bosque Cautivo, colocadas
      por la Unión de Osses para controlar cualquier movimiento de resistencia dentro
      del antiguo territorio de Brurland. Los habitantes de Broneland conocen cada
      sendero mejor que sus ocupantes, aunque moverse fuera de los caminos vigilados
      sigue siendo un riesgo real.</p>
      <p>Los sacerdotes del Mortismo local realizan sus ritos funerarios entre estos
      árboles porque la vigilancia es intensa, convencidos de que ningún
      soldado se atreve a interrumpir un entierro por miedo a la mala suerte.</p>
    `
  },
  {
    id: "rio-de-la-frontera-broneland",
    title: "Río de la Frontera",
    category: "Lugares",
    tags: ["río", "broneland", "derrovia", "gylas"],
    summary: "Curso de agua que marca el límite entre el Broneland ocupado y el territorio libre de Brurland, cruzado bajo permiso estricto en ambas direcciones.",
    region: "Broneland, Derrovia, Gylas",
    gobierno: "Guarnición de la Unión de Osses",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Puestos de control se alzan a ambos lados del río allí donde marca la
      frontera entre Broneland y Brurland, y cruzarlo sin los permisos correctos
      puede significar semanas de arresto o, en el peor de los casos, la muerte a
      manos de una guarnición nerviosa. Aun así, contrabandistas de ambos lados
      encuentran rutas nuevas cada temporada.</p>
      <p>Familias separadas por la ocupación se reúnen en sus orillas cuando las
      autoridades lo permiten, en encuentros breves vigilados de cerca por soldados
      de la Unión.</p>
    `
  },
  {
    id: "pantano-de-la-rendicion",
    title: "Pantano de la Rendición",
    category: "Lugares",
    tags: ["naturaleza", "broneland", "derrovia", "gylas"],
    summary: "Zona pantanosa donde se firmó la capitulación de Brurland ante la Unión de Osses, hoy vigilada como recordatorio permanente de la ocupación.",
    region: "Broneland, Derrovia, Gylas",
    gobierno: "Guarnición de la Unión de Osses",
    religionPredominante: "Mortismo",
    lugaresDestacados: [],
    content: `
      <p>El acuerdo que entregó territorio brurlandés a la Unión de Osses se
      firmó sobre una plataforma de madera levantada en medio de este pantano, un
      detalle que la Unión conserva deliberadamente como recordatorio de humillación
      para cualquiera que pase cerca. Una columna de piedra marca el sitio exacto,
      grabada con los términos de la rendición en un idioma que pocos locales
      todavía pueden leer sin ayuda.</p>
      <p>Los sacerdotes del Mortismo local visitan la columna en fechas señaladas
      para honrar a quienes murieron antes de la firma, un gesto que la guarnición
      permite siempre que no se convierta en protesta abierta.</p>
    `
  },
  {
    id: "dunas-del-enjambre",
    title: "Dunas del Enjambre",
    category: "Lugares",
    tags: ["naturaleza", "mravec", "derrovia", "gylas"],
    summary: "Mar de dunas en Mravec que cambia de forma con el viento, atravesado por túneles subterráneos excavados por la dinastía insectoide.",
    region: "Mravec, Derrovia, Gylas",
    gobierno: "Satrapía insectoide",
    religionPredominante: "Quitinismo",
    lugaresDestacados: [],
    content: `
      <p>El viento reordena las Dunas del Enjambre con tal frecuencia que ningún mapa
      de la superficie sigue siendo preciso más de unas semanas, pero bajo la arena
      corre una red de túneles excavados por generaciones de la dinastía insectoide
      que sí mantiene su forma. Viajar por la superficie es lento y peligroso; hacerlo
      por debajo, mucho más seguro para quien conoce las rutas.</p>
      <p>Caravanas foráneas contratan guías locales casi siempre antes de intentar
      cruzarlas, conscientes de que perderse entre las dunas durante una tormenta de
      arena casi nunca termina bien.</p>
    `
  },
  {
    id: "oasis-de-quitina",
    title: "El Oasis de Quitina",
    category: "Lugares",
    tags: ["naturaleza", "mravec", "derrovia", "gylas"],
    summary: "Oasis sagrado de Mravec donde la Reina Hormiga original habría bebido por primera vez, punto de peregrinaje del Quitinismo.",
    region: "Mravec, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "Quitinismo",
    lugaresDestacados: [],
    content: `
      <p>El agua del Oasis de Quitina nunca se seca, ni siquiera en las peores
      sequías que azotan el resto de Mravec, algo que el Quitinismo atribuye
      directamente a la bendición de la Reina Hormiga que según sus textos bebió aquí
      por primera vez. Palmeras de tallo endurecido rodean el agua, dando sombra a los
      peregrinos que llegan desde toda la satrapía.</p>
      <p>Miembros de la dinastía gobernante visitan el oasis en fechas señaladas del
      calendario religioso, en ceremonias que la población local puede presenciar
      pero no interrumpir.</p>
    `
  },
  {
    id: "colmena-de-piedra",
    title: "La Colmena de Piedra",
    category: "Lugares",
    tags: ["montaña", "mravec", "derrovia", "gylas"],
    summary: "Formación montañosa de Mravec perforada por siglos de excavación insectoide, con galerías que se extienden mucho más allá de lo cartografiado.",
    region: "Mravec, Derrovia, Gylas",
    gobierno: "Satrapía insectoide",
    religionPredominante: "Quitinismo",
    lugaresDestacados: [],
    content: `
      <p>Generaciones de la dinastía insectoide han excavado esta montaña hasta
      convertirla en una colmena de galerías interconectadas, mucho más extensa de lo
      que muestra cualquier mapa oficial. Los niveles superiores se usan para
      almacenaje y vivienda; los más profundos permanecen cerrados incluso para la
      mayoría de los súbditos de la satrapía.</p>
      <p>El zumbido constante de actividad bajo la roca es audible desde el exterior
      en las noches silenciosas, un recordatorio de que la montaña nunca duerme del
      todo.</p>
    `
  },
  {
    id: "fragua-de-caparazon",
    title: "Fragua de Caparazón",
    category: "Lugares",
    tags: ["ciudad", "mravec", "derrovia", "insectoides", "desierto"],
    summary: "Ciudad fortificada de Mravec donde se procesa el caparazón de las criaturas del desierto para fabricar armadura, tan resistente como codiciada fuera de la satrapía.",
    region: "Mravec, Derrovia, Gylas",
    gobierno: "Gremio de armeros, bajo licencia de la satrapía",
    religionPredominante: "Quitinismo",
    lugaresDestacados: [],
    content: `
      <p>El material que trabaja Fragua de Caparazón se cosecha de criaturas
      del desierto lo bastante grandes como para que cada pieza cubra un
      torso entero, y los armeros de la ciudad lo trabajan hasta convertirlo en
      placas más ligeras y resistentes que cualquier metal disponible en
      Mravec. Los talleres trabajan bajo licencia directa de la dinastía, que
      se queda con una parte fija de cada encargo terminado.</p>
      <p>Compradores de otros reinos viajan hasta aquí específicamente por esa
      armadura, dispuestos a pagar precios que triplican lo que costaría el
      metal equivalente. La ciudad entera vive de ese comercio, y sus murallas,
      hechas del mismo material que fabrica, han resistido asedios que
      habrían derribado piedra convencional mucho antes.</p>
    `
  },
  {
    id: "telar-de-seda",
    title: "Telar de Seda",
    category: "Lugares",
    tags: ["aldea", "mravec", "derrovia", "insectoides", "desierto"],
    summary: "Aldea de Mravec donde arácnidos gigantes domesticados producen la seda que viste a la corte de la satrapía y se exporta a precio de lujo fuera del desierto.",
    region: "Mravec, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "Quitinismo",
    lugaresDestacados: [],
    content: `
      <p>Generaciones de cría selectiva domesticaron a los arácnidos gigantes
      que producen la seda de Telar de Seda, criaturas que sus cuidadores tratan
      con un cariño que sorprende a cualquier forastero acostumbrado a temerles.
      La fibra que producen es más fina y resistente que cualquier seda
      importada, y viste tanto a la corte de la dinastía como a compradores
      dispuestos a pagar precios de lujo fuera del desierto.</p>
      <p>Cada familia cuida a sus propios arácnidos como si fueran ganado
      valioso, transmitiendo técnicas de crianza que no comparten fácilmente ni
      siquiera con otras familias de la aldea. Robar una cría reproductora se
      castiga con más severidad que la mayoría de los delitos violentos en
      territorio de Mravec.</p>
      <p>Las familias criadoras son, en su mayoría, arácnidos ellas mismas, parientes
      lejanos de las criaturas que domestican y con quienes comparten más que
      apariencia. Casi cualquier hilandera de la aldea puede producir su propio hilo
      si hace falta, aunque en cantidades muy inferiores a las de sus parientes
      criados, y son estas mismas familias las que organizan Telar de Seda en
      pequeños consejos de hilanderas antes que en cualquier jerarquía impuesta
      desde Quitinal.</p>
    `
  },
  {
    id: "bosque-partido",
    title: "Bosque Partido",
    category: "Lugares",
    tags: ["bosque", "fel", "derrovia", "gylas"],
    summary: "Bosque dividido literalmente por la frontera entre Fel y Cudbusland, herencia física de la fractura del antiguo Reino de Tarrena.",
    region: "Fel, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Un límite invisible atraviesa el Bosque Partido justo por donde se dividió
      el antiguo Reino de Tarrena, y los guardabosques de Fel y Cudbusland patrullan
      cada mitad con instrucciones de no cruzar sin aviso previo. Los árboles no
      distinguen la frontera, por supuesto, y sus raíces se entrelazan bajo tierra sin
      importarles a qué principado pertenece cada rama.</p>
      <p>Cazadores furtivos de ambos lados aprovechan la confusión de límites para
      operar en tierra de nadie, un problema que ninguno de los dos herederos ha
      logrado resolver por completo.</p>
    `
  },
  {
    id: "rio-tarrena",
    title: "Río Tarrena",
    category: "Lugares",
    tags: ["río", "fel", "derrovia", "gylas"],
    summary: "Río que conserva el nombre del reino desaparecido, atravesando el territorio de Fel como recordatorio de la unidad que ya no existe.",
    region: "Fel, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El Río Tarrena conservó su nombre incluso después de que el reino que lo
      bautizó se dividiera entre dos herederos, y sigue siendo la vía comercial más
      importante de Fel. Barcazas cargadas de mineral y grano bajan su corriente hacia
      Vulkrest, donde se distribuyen al resto del principado.</p>
      <p>Los pescadores más viejos todavía lo llaman por su nombre completo,
      Tarrena-que-fue, en una costumbre que sus hijos han empezado a abandonar sin que
      nadie los corrija.</p>
    `
  },
  {
    id: "colinas-de-vulkrest",
    title: "Colinas de Vulkrest",
    category: "Lugares",
    tags: ["montaña", "fel", "derrovia", "gylas"],
    summary: "Colinas mineras que rodean Vulkrest, fuente principal del hierro que sostiene la industria del principado de Fel.",
    region: "Fel, Derrovia, Gylas",
    gobierno: "Concesión del Principado de Fel",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El hierro que alimenta las forjas de Vulkrest sale casi por completo de
      estas colinas, trabajadas por cuadrillas que rotan turnos día y noche para
      mantener el ritmo de producción del principado. La tierra removida ha dejado
      terrazas artificiales visibles desde varios kilómetros de distancia.</p>
      <p>El Principado grava fuertemente cualquier concesión minera nueva, consciente
      de que las colinas son, junto con el propio río, la base económica de todo Fel.</p>
    `
  },
  {
    id: "campos-de-rothmoor",
    title: "Campos de Rothmoor",
    category: "Lugares",
    tags: ["naturaleza", "cudbusland", "derrovia", "gylas"],
    summary: "Extensas tierras de cultivo alrededor de Rothmoor que alimentan a Cudbusland entero, trabajadas por generaciones de la misma familia campesina.",
    region: "Cudbusland, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Los Campos de Rothmoor producen grano suficiente para abastecer a
      todo Cudbusland, trabajados casi siempre por las mismas familias que
      llevan generaciones cultivando la misma tierra bajo el mismo principado. La
      cosecha marca el calendario social del reino tanto como cualquier fiesta
      religiosa.</p>
      <p>Cuando el clima amenaza la cosecha, el segundo heredero de Tarrena en
      persona visita los campos para supervisar las medidas de emergencia, un gesto
      que sus campesinos valoran más que cualquier discurso.</p>
    `
  },
  {
    id: "bosque-del-heredero",
    title: "Bosque del Heredero",
    category: "Lugares",
    tags: ["bosque", "cudbusland", "derrovia", "gylas"],
    summary: "Coto de caza privado de la línea principesca de Cudbusland, reservado tradicionalmente para la formación de los futuros gobernantes.",
    region: "Cudbusland, Derrovia, Gylas",
    gobierno: "Coto privado del Principado",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Cada heredero de Cudbusland pasa parte de su juventud cazando en este
      bosque privado, una tradición que se remonta a los primeros años tras la
      fractura de Tarrena y que se considera parte esencial de su formación como
      futuro gobernante. El acceso está prohibido a cualquiera fuera de la corte sin
      invitación expresa.</p>
      <p>Guardabosques del principado mantienen la caza abundante todo el año,
      asegurándose de que ningún heredero en formación vuelva de una jornada con las
      manos vacías.</p>
    `
  },
  {
    id: "rio-compartido",
    title: "Río Compartido",
    category: "Lugares",
    tags: ["río", "cudbusland", "derrovia", "gylas"],
    summary: "Afluente que atraviesa tanto Fel como Cudbusland antes de unirse al Río Tarrena, punto habitual de negociación entre ambos herederos.",
    region: "Cudbusland, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Antes de unirse al cauce principal del Río Tarrena, este afluente cruza
      territorio de ambos principados, lo que lo convierte en escenario habitual de
      reuniones entre representantes de Fel y Cudbusland cuando necesitan negociar
      sin salir de terreno neutral. Un puente de piedra a medio camino sirve de punto
      de encuentro formal.</p>
      <p>La pesca en sus aguas se reparte por acuerdo tácito entre pescadores de
      ambos lados, uno de los pocos asuntos donde los dos herederos de Tarrena siguen
      cooperando sin fricciones.</p>
    `
  },
  {
    id: "bosque-de-bambu-de-kensho",
    title: "Bosque de Bambú de Kensho",
    category: "Lugares",
    tags: ["bosque", "seosan", "derrovia", "gylas"],
    summary: "Bosque de bambú cercano a Kensho donde los practicantes del Senkai realizan sus prácticas de meditación y esgrima al amanecer.",
    region: "Seosan, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "Senkai",
    lugaresDestacados: [],
    content: `
      <p>El bambú crece tan denso alrededor de Kensho que la luz del amanecer se
      filtra en franjas verdes entre los tallos, un efecto que los maestros de las
      escuelas marciales de Seosan consideran ideal para la meditación previa a la
      práctica de esgrima. El viento entre las cañas produce un sonido característico
      que los alumnos aprenden a usar como guía de respiración.</p>
      <p>Cortar bambú del bosque para uso personal requiere permiso de los templos
      cercanos, que administran su crecimiento con el mismo cuidado que dedican a la
      formación de sus discípulos.</p>
    `
  },
  {
    id: "acantilado-de-zanmyo",
    title: "Acantilado de Zanmyo",
    category: "Lugares",
    tags: ["naturaleza", "seosan", "derrovia", "gylas"],
    summary: "Acantilado costero junto a Zanmyo donde generaciones de monjes del Senkai han tallado escalinatas y santuarios en la roca viva.",
    region: "Seosan, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "Senkai",
    lugaresDestacados: [],
    content: `
      <p>La roca del Acantilado de Zanmyo lleva siglos siendo tallada por monjes del
      Senkai, que han abierto escalinatas y pequeños santuarios directamente en la
      piedra que cae hacia el mar. Subir hasta el santuario más alto se considera un
      rito de paso para quienes buscan ordenarse dentro de la tradición religiosa de
      Seosan.</p>
      <p>Las olas rompen con fuerza contra la base del acantilado casi todo el año,
      y más de un peregrino imprudente ha aprendido demasiado tarde a respetar la
      distancia que marcan las señales de piedra.</p>
    `
  },
  {
    id: "monte-senkai",
    title: "Monte Senkai",
    category: "Lugares",
    tags: ["montaña", "seosan", "derrovia", "gylas"],
    summary: "Montaña sagrada que da nombre a la religión predominante de Seosan, cuya cima permanece velada por nubes casi todo el año.",
    region: "Seosan, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "Senkai",
    lugaresDestacados: [],
    content: `
      <p>Pocos habitantes de Seosan han visto la cima del Monte Senkai despejada de
      nubes, un fenómeno tan raro que se registra como augurio cada vez que ocurre.
      La montaña que da nombre a la religión dominante de la península alberga
      santuarios en distintas alturas, cada uno reservado a un nivel diferente de
      iniciación espiritual.</p>
      <p>Los monjes más ancianos suben una vez al año a dejar ofrendas en el
      santuario más alto, un ascenso que ya pocos de ellos pueden completar sin ayuda
      de discípulos más jóvenes.</p>
    `
  },
  {
    id: "rio-vernumbra",
    title: "Río Vernúmbra",
    category: "Lugares",
    tags: ["río", "nobriana", "derrovia", "gylas"],
    summary: "Río que atraviesa el territorio de los Nobrianos junto a Vernúmbra, considerado sagrado por ser la única fuente de agua permanente del pueblo.",
    region: "Nobriana, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Vernúmbra se asienta donde se asienta precisamente por este río, la única
      fuente de agua permanente y confiable en un territorio donde el resto de los
      cauces son estacionales. Los Nobrianos consideran sus aguas sagradas y realizan
      ofrendas regulares en su desembocadura antes de cada estación de caza.</p>
      <p>Foráneos que acampan cerca de su curso sin el permiso de los guardianes de
      Vernúmbra reciben, en el mejor de los casos, una advertencia clara para que se
      retiren antes del anochecer.</p>
    `
  },
  {
    id: "claro-sagrado",
    title: "Claro Sagrado",
    category: "Lugares",
    tags: ["bosque", "nobriana", "derrovia", "gylas"],
    summary: "Claro circular en pleno bosque de Nobriana donde los ancianos del pueblo celebran los ritos de paso de la comunidad.",
    region: "Nobriana, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El perímetro perfectamente circular de este claro carece por completo de
      árboles, rodeado por el resto del bosque como si la vegetación misma respetara el
      espacio. Los ancianos de Vernúmbra lo usan para los ritos de paso de la
      comunidad, ceremonias cerradas a cualquiera que no forme parte del pueblo
      Nobriano.</p>
      <p>Quienes han presenciado una de estas ceremonias desde la distancia describen
      cánticos que parecen responder al viento, aunque ningún Nobriano ha confirmado
      ni desmentido esa observación a un forastero.</p>
    `
  },
  {
    id: "rio-del-caballero",
    title: "Río del Caballero",
    category: "Lugares",
    tags: ["río", "brurland", "derrovia", "gylas"],
    summary: "Río donde la caballería de Brurland entrena a diario, cruzándolo a caballo en distintos puntos para dominar el combate en terreno difícil.",
    region: "Brurland, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>La caballería de Brurland entrena a diario en las orillas de este río,
      cruzándolo una y otra vez en distintos puntos para acostumbrar a jinetes y
      monturas a combatir en terreno inestable. El sonido de cascos golpeando el agua
      se ha vuelto tan familiar para los pueblos cercanos que ya casi nadie levanta la
      vista al escucharlo.</p>
      <p>Los dragones jóvenes que Brurland cría para la guerra también aprenden aquí
      a sobrevolar cursos de agua sin perder de vista a su jinete, una habilidad clave
      antes de entrar en combate real.</p>
    `
  },
  {
    id: "colinas-de-wolfmere",
    title: "Colinas de Wolfmere",
    category: "Lugares",
    tags: ["montaña", "brurland", "derrovia", "gylas"],
    summary: "Colinas suaves alrededor de Wolfmere donde se crían los caballos de guerra que sostienen la caballería de Brurland.",
    region: "Brurland, Derrovia, Gylas",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Los pastos ondulados de estas colinas producen algunos de los mejores
      caballos de guerra de todo Gylas, criados en Wolfmere bajo un programa de
      selección que se remonta a generaciones. Los potrillos pasan su primer año
      corriendo libres por las laderas antes de comenzar cualquier entrenamiento
      formal.</p>
      <p>Compradores de otros reinos, incluso de Fel y Cudbusland, viajan hasta aquí
      cada temporada para adquirir monturas, aunque los mejores ejemplares se reservan
      siempre para la caballería del propio Brurland.</p>
    `
  },
  {
    id: "cinabrio",
    title: "Cinabrio",
    category: "Lugares",
    tags: ["aldea", "ornamen", "merador", "balutia"],
    summary: "Aldea minera del oeste de Ornamen, cercana a la frontera con la Oligarquía Nerniban, donde se extrae el pigmento rojo que tiñe las vestiduras del Ternarismo.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "Concesión imperial",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>El pigmento que da nombre a Cinabrio se extrae de una veta poco profunda
      que los mineros trabajan por turnos cortos, conscientes de que respirar
      demasiado polvo rojo termina pasando factura con los años. El mineral
      procesado viaja hacia Solenna, donde los talleres del Ternarismo lo convierten
      en el tinte oficial de las vestiduras sacerdotales de toda la provincia.</p>
      <p>La cercanía con la frontera de Nernib convierte a la aldea
      en un punto de paso habitual para comerciantes que prefieren evitar los
      caminos principales, algo que sus habitantes dejan pasar mientras nadie interfiera
      con el trabajo de la mina.</p>
    `
  },
  {
    id: "puntafuego",
    title: "Puntafuego",
    category: "Lugares",
    tags: ["ciudad", "ornamen", "merador", "balutia"],
    summary: "Ciudad portuaria de Ornamen construida sobre un espolón rocoso de roca volcánica negra que se adentra en el mar, base de la flota provincial y de las salinas que abastecen a media provincia.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "Comandancia naval imperial",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>La roca volcánica negra sobre la que se asienta Puntafuego se enfría tan
      lentamente bajo el sol que sus calles conservan el calor mucho después del
      atardecer, algo que los genasi ígneos que la habitan consideran una comodidad
      antes que una molestia. El espolón se estrecha hasta apenas unos metros de
      ancho en su punta, donde el faro de la Comandancia naval vigila el paso de
      barcos hacia los puertos de Grandeu.</p>
      <p>Las salinas que rodean la base de la ciudad, inundadas y secadas por
      turnos según la marea, abastecen de sal a Ornamen entero y financian
      el mantenimiento de la flota provincial. Cuando el mar está picado, las olas
      rompen contra ambos lados del espolón a la vez, y los pescadores más nuevos
      aprenden rápido a no subestimar lo angosto que es el camino de vuelta a
      tierra firme.</p>
    `
  },
  {
    id: "cascada-de-vinealta",
    title: "Cascada de Vinealta",
    category: "Lugares",
    tags: ["naturaleza", "nordea", "kretor", "sindra"],
    summary: "Cascada junto a Vinealta que alimenta los viñedos escalonados de la provincia, considerada parte esencial del terroir local.",
    region: "Nordea, Kretor, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El agua fría que cae de esta cascada riega los viñedos escalonados de
      Vinealta desde antes de que el Imperio de Balutia reclamara la provincia, y los
      vinicultores locales insisten en que ningún otro riego produce el mismo sabor en
      la uva. La neblina que levanta al caer mantiene los terrenos más bajos frescos
      incluso en pleno verano.</p>
      <p>Familias enteras de Vinealta organizan su calendario de cosecha alrededor
      del caudal de la cascada, que varía ligeramente con las estaciones y determina
      cuándo la uva alcanza su punto óptimo.</p>
    `
  },
  {
    id: "vado-del-alba",
    title: "Vado del Alba",
    category: "Lugares",
    tags: ["aldea", "nordea", "kretor", "balutia"],
    summary: "Aldea junto al único vado seguro entre Palatina y Marcanor, cruzado cada mañana por procesiones religiosas que aprovechan la primera luz del día.",
    region: "Nordea, Kretor, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El vado que da nombre a la aldea solo es seguro cruzar temprano, antes
      de que el deshielo de las colinas cercanas eleve la corriente durante el
      resto del día, así que Vado del Alba organiza su vida
      cotidiana alrededor de esa ventana de unas pocas horas. Comerciantes,
      peregrinos y mensajeros que necesitan cruzar aprenden rápido a llegar la
      noche anterior en lugar de arriesgarse a esperar al día siguiente.</p>
      <p>Con los años, esa costumbre matutina se mezcló con ritos religiosos
      locales, y no es raro ver procesiones completas cruzando el vado al
      primer rayo de sol, convencidas de que hacerlo trae buena fortuna para
      el resto del viaje.</p>
    `
  },
  {
    id: "atalaya-del-norte",
    title: "Atalaya del Norte",
    category: "Lugares",
    tags: ["fortaleza", "nordea", "kretor", "balutia"],
    summary: "Torre de vigilancia costera en Nordea que observa las rutas marítimas hacia Kalvia, primera línea de aviso ante cualquier movimiento naval inusual.",
    region: "Nordea, Kretor, Sindra",
    gobierno: "Guarnición imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Desde lo alto de esta torre se domina la costa que
      separa Nordea del principado mercante de Kalvia, y su guarnición lleva
      generaciones anotando cada vela que cruza el horizonte, propia o
      ajena. La relación con Kalvia es cordial, pero la Corona prefiere saber
      con antelación cualquier movimiento naval fuera de lo común antes que
      confiar ciegamente en la buena voluntad de un vecino próspero.</p>
      <p>Un sistema de señales de fuego conecta la Atalaya con Palatina,
      capaz de transmitir una alerta a la capital provincial en cuestión de
      minutos. Nunca se ha usado para anunciar una invasión real, algo que
      sus centinelas prefieren atribuir a su propia vigilancia antes que a la
      simple buena suerte.</p>
    `
  },
  {
    id: "huertos-de-palatina",
    title: "Los Huertos de Palatina",
    category: "Lugares",
    tags: ["aldea", "nordea", "kretor", "balutia"],
    summary: "Aldea frutícola que abastece la mesa de la corte de Palatina, con variedades de fruta que solo se cultivan bajo licencia directa del palacio.",
    region: "Nordea, Kretor, Sindra",
    gobierno: "Concesión de la Corte de Palatina",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Ciertas variedades de fruta que crecen en Los Huertos de Palatina no
      se cultivan en ningún otro punto de Nordea, protegidas por una licencia
      real que prohíbe exportar esquejes fuera de la aldea sin autorización
      expresa de la corte. La costumbre nació generaciones atrás, cuando un
      antiguo emperador decidió que ciertos sabores debían reservarse
      exclusivamente para su propia mesa.</p>
      <p>Los agricultores que trabajan los huertos gozan de un estatus
      peculiar, ni completamente libres ni completamente siervos, atados a la
      Corte por contrato pero bien pagados por su discreción. Vender una
      semilla de contrabando se castiga con el destierro permanente de la
      aldea, un riesgo que casi ningún agricultor ha considerado nunca que
      valga la pena correr.</p>
    `
  },
  {
    id: "molino-de-marcanor",
    title: "Molino de Marcanor",
    category: "Lugares",
    tags: ["aldea", "nordea", "kretor", "balutia"],
    summary: "Aldea harinera junto a Marcanor que procesa el grano de las tierras altas de Nordea antes de enviarlo hacia Palatina y el resto de la provincia.",
    region: "Nordea, Kretor, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Las ruedas de molino de esta aldea llevan generaciones procesando el
      grano que baja de las tierras altas cercanas a Marcanor, y su ubicación
      junto al cruce de caminos hacia Palatina la convirtió en parada
      obligada para cualquier carreta cargada de harina. La familia que
      administra el molino principal ha ocupado el puesto durante tanto
      tiempo que muchos en la provincia ya no distinguen entre el oficio y el
      apellido.</p>
      <p>Cuando la cosecha es especialmente buena, el molino trabaja turnos
      dobles durante semanas, y el zumbido constante de las ruedas se
      convierte en el sonido de fondo de toda la aldea hasta que el último
      saco queda procesado.</p>
    `
  },
  {
    id: "canon-de-ferrastra",
    title: "Cañón de Ferrastra",
    category: "Lugares",
    tags: ["naturaleza", "goloria", "merador", "sindra"],
    summary: "Cañón profundo excavado por siglos de minería en Goloria, cuyas paredes expuestas revelan capas de mineral todavía sin explotar.",
    region: "Goloria, Merador, Sindra",
    gobierno: "Concesión minera imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Siglos de excavación abrieron este cañón hasta convertirlo en una herida
      visible en el paisaje de Goloria, con paredes que exponen capas de mineral que
      Ferrastra todavía no ha terminado de procesar. Andamios y poleas imperiales
      cuelgan de sus bordes superiores, bajando cuadrillas hasta las vetas más
      recientes.</p>
      <p>El eco de los martillos resuena por todo el cañón durante el día, y se
      apaga solo durante los turnos nocturnos, cuando los ingenieros revisan la
      estabilidad de las galerías más profundas.</p>
    `
  },
  {
    id: "rediles-de-goloria",
    title: "Rediles de Goloria",
    category: "Lugares",
    tags: ["aldea", "goloria", "merador", "balutia"],
    summary: "Aldea ganadera de Goloria que cría el ganado de tiro usado en las minas y canteras de la provincia, además de abastecer de carne a Castrianum.",
    region: "Goloria, Merador, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Los animales de tiro que arrastran mineral fuera de las minas de
      Goloria nacen y se crían casi todos en Rediles de Goloria, seleccionados
      por generaciones de pastores para resistir jornadas largas bajo carga
      pesada. El resto del ganado se destina a las mesas de Castrianum, cuya
      guarnición consume carne suficiente para mantener ocupada a la aldea
      entera durante casi todo el calendario agrícola.</p>
      <p>Los pastores conocen el linaje de cada animal con el mismo cuidado
      que un noble llevaría el árbol genealógico de su familia, y venden
      crías especialmente resistentes a precios que reflejan generaciones de
      selección cuidadosa.</p>
    `
  },
  {
    id: "el-carbonal",
    title: "El Carbonal",
    category: "Lugares",
    tags: ["bosque", "goloria", "merador", "sindra"],
    summary: "Bosque de Goloria que provee la madera y el carbón vegetal que alimentan las forjas de la provincia, talado y replantado bajo estricto control imperial.",
    region: "Goloria, Merador, Sindra",
    gobierno: "Concesión forestal imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Las forjas de la provincia consumen carbón vegetal a un ritmo que
      agotaría un bosque sin manejo cuidadoso, así que la Corona impone
      cuotas estrictas de tala y exige replantar cada sección talada antes de
      autorizar la siguiente. Cuadrillas de leñadores rotan entre distintas
      zonas del bosque siguiendo un calendario que los ingenieros imperiales
      revisan cada temporada.</p>
      <p>Quien tala fuera de las zonas autorizadas enfrenta multas que
      superan varias veces el valor de la madera obtenida, una medida que ha
      mantenido el bosque productivo durante generaciones sin agotarlo por
      completo.</p>
    `
  },
  {
    id: "bosque-de-triastra",
    title: "Bosque de Triastra",
    category: "Lugares",
    tags: ["bosque", "ornamen", "merador", "sindra"],
    summary: "Bosque que rodea Triastra en Ornamen, hogar de genasi ígneos que conviven con la vegetación pese al calor constante que emana del suelo volcánico.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>El calor que sube desde el suelo volcánico de Ornamen debería impedir que
      creciera un bosque como este, pero la vegetación cercana a Triastra se ha
      adaptado durante generaciones hasta prosperar en condiciones que matarían a
      cualquier planta foránea. Sus habitantes genasi ígneos caminan entre los
      árboles sin la incomodidad que sienten los visitantes de otras provincias.</p>
      <p>Peregrinos del Ternarismo cruzan el bosque de camino a La Boca de Ornamen,
      deteniéndose a menudo en Triastra para descansar antes del ascenso final.</p>
    `
  },
  {
    id: "rescoldo",
    title: "Rescoldo",
    category: "Lugares",
    tags: ["aldea", "ornamen", "merador", "balutia", "volcánico"],
    summary: "Aldea de Ornamen construida sobre tierra que jamás llega a enfriarse por completo, donde el calor residual del subsuelo seca cerámica y curte cuero sin necesidad de hornos.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>El suelo de Rescoldo conserva un calor constante que ningún invierno
      logra apagar, resultado de bolsas de actividad volcánica poco
      profundas que corren bajo toda la aldea. Sus artesanos aprovechan ese
      calor gratuito para secar cerámica y curtir cuero sin quemar leña,
      un ahorro que vuelve sus productos más baratos que los de cualquier
      taller de Solenna.</p>
      <p>Caminar descalzo por ciertas zonas de la aldea sigue siendo, según
      advierten los locales a cualquier visitante, una mala idea incluso en
      pleno invierno. Los niños de Rescoldo aprenden a reconocer las manchas de
      tierra más caliente antes de aprender a leer, una lección que ningún
      forastero recibe a tiempo la primera vez que la necesita.</p>
    `
  },
  {
    id: "alfar-de-ceniza",
    title: "Alfar de Ceniza",
    category: "Lugares",
    tags: ["aldea", "ornamen", "merador", "balutia", "volcánico"],
    summary: "Aldea alfarera cercana al Yunque Ardiente que usa la ceniza volcánica de la provincia como esmalte, produciendo una cerámica reconocible en toda Kretor por su brillo oscuro.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "Gremio de alfareros",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>La ceniza que cae del Yunque Ardiente arruina cosechas y ensucia
      tejados en el resto de Ornamen, pero en Alfar de Ceniza se recoge con
      cuidado y se muele hasta convertirla en el esmalte que da a su cerámica
      un brillo oscuro y metálico que ningún otro taller de Kretor ha logrado
      replicar. Los hornos trabajan en turnos que siguen el ritmo de las
      erupciones menores del volcán, no el calendario.</p>
      <p>Los mercaderes que llevan piezas de Alfar de Ceniza hasta Nigrastel
      las venden como artículo de lujo, y el gremio local vigila de cerca la
      fórmula exacta del esmalte, transmitida de maestro a aprendiz sin
      registro escrito que un rival pudiera robar.</p>
    `
  },
  {
    id: "huerta-de-solenna",
    title: "Huerta de Solenna",
    category: "Lugares",
    tags: ["aldea", "ornamen", "merador", "balutia"],
    summary: "Aldea agrícola que abastece de fruta y verdura fresca a la capital provincial, aprovechando el suelo fértil que deja la ceniza volcánica al asentarse.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>La misma ceniza que ensucia tejados en el resto de la provincia deja,
      con el tiempo, un suelo excepcionalmente fértil, y los agricultores de
      Huerta de Solenna han aprendido a sacarle ventaja en lugar de
      maldecirla. Carretas cargadas de fruta y verdura fresca salen hacia
      Solenna casi a diario, siguiendo una ruta tan transitada que apenas
      necesita señalización.</p>
      <p>El Ternarismo local considera la fertilidad de la tierra una prueba
      viva de que el equilibrio entre destrucción y creación favorece, a
      largo plazo, a quien sabe esperar. Los agricultores más veteranos
      repiten esa idea casi como proverbio cada vez que un forastero se
      sorprende de ver huertos tan cerca de tierra volcánica.</p>
    `
  },
  {
    id: "curtiduria-del-norte",
    title: "Curtiduría del Norte",
    category: "Lugares",
    tags: ["ciudad", "ornamen", "merador", "balutia"],
    summary: "Ciudad curtidora en el norte de Ornamen que procesa el cuero del ganado de la provincia antes de enviarlo a los talleres del resto del Imperio.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "Gremio de curtidores",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El agua mineral que corre bajo Curtiduría del Norte, cargada de las
      mismas sales que produce Salinas del Cabo más al sur, resultó ideal
      para curtir cuero sin recurrir a los taninos vegetales que otras
      ciudades del imperio necesitan importar. El descubrimiento, casi
      accidental, convirtió a la ciudad en el mayor centro curtidor de toda
      Kretor en apenas dos generaciones.</p>
      <p>Los talleres trabajan en cadena, desde el cuero crudo que llega de
      Huerta de Solenna y sus alrededores hasta las piezas terminadas que
      salen rumbo a Nigrastel para vestir a las legiones. El olor
      característico de las curtidurías se nota a varios kilómetros de
      distancia, algo que sus habitantes ya no perciben pero que sigue
      delatando la ciudad a cualquier viajero que se acerque por primera vez.</p>
    `
  },
  {
    id: "crater-dormido",
    title: "Cráter Dormido",
    category: "Lugares",
    tags: ["naturaleza", "ornamen", "merador", "sindra", "volcánico"],
    summary: "Cráter extinto en el norte de Ornamen, contraste silencioso frente a la actividad constante de La Boca de Ornamen más al sur.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>A diferencia de La Boca de Ornamen, el Cráter Dormido no ha mostrado
      actividad alguna en generaciones, tanto tiempo que la vegetación cubrió
      por completo sus paredes internas y un pequeño lago se formó en el
      fondo. Los genasi ígneos de la provincia lo visitan con una mezcla de
      curiosidad y recelo, conscientes de que un volcán dormido no es lo
      mismo que un volcán muerto.</p>
      <p>El Ternarismo interpreta el cráter como una lección de paciencia
      antes que de peligro, un recordatorio de que hasta el fuego más
      violento eventualmente encuentra su propio equilibrio. Peregrinos
      ocasionales suben hasta el lago del fondo a meditar, aunque los
      sacerdotes locales advierten que la calma del lugar no debe
      confundirse con garantía alguna.</p>
    `
  },
  {
    id: "mosaicos-de-ornamen",
    title: "Mosaicos de Ornamen",
    category: "Lugares",
    tags: ["ciudad", "ornamen", "merador", "balutia"],
    summary: "Ciudad artesanal que combina el vidrio de Cristalería Imperial con la cerámica de Alfar de Ceniza para producir los mosaicos más buscados de Kretor.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "Gremio de mosaístas",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>Los mosaístas de esta ciudad combinan vidrio y cerámica con una
      soltura que ningún otro taller de Kretor ha logrado igualar. Reciben
      fragmentos descartados de Cristalería Imperial y esmaltes sobrantes de
      Alfar de Ceniza, y los convierten en paneles decorativos que terminan
      adornando
      templos y palacios de todo el imperio. Lo que en otro taller sería
      desperdicio, aquí se convierte en materia prima.</p>
      <p>El Ternarismo considera el oficio casi litúrgico, unir fragmentos
      rotos en algo nuevo y hermoso encaja con precisión en su doctrina del
      equilibrio, y varios de los mosaicos más venerados de la provincia
      decoran templos en lugar de residencias privadas. El Gremio local
      selecciona a sus aprendices con el mismo cuidado que un templo
      seleccionaría a sus sacerdotes.</p>
    `
  },
  {
    id: "robledal-meridional",
    title: "Robledal Meridional",
    category: "Lugares",
    tags: ["bosque", "ornamen", "merador", "sindra"],
    summary: "Bosque de robles al sur de Ornamen, una de las pocas zonas de la provincia donde la ceniza volcánica nunca llega a asentarse en cantidad.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>A diferencia de casi toda Ornamen, el Robledal Meridional queda lo
      bastante alejado de los focos volcánicos de la provincia como para que
      sus árboles crezcan sin la capa constante de ceniza que cubre el resto
      del territorio. Cazadores y leñadores lo tratan como un respiro,
      literal y figurado, del paisaje gris que domina el resto de su vida
      diaria.</p>
      <p>Algunas familias de Solenna suben hasta aquí en los días más
      calurosos del año solo para caminar entre árboles que no necesitan
      limpiarse de ceniza cada mañana, un lujo que en Ornamen pocos lugares
      pueden ofrecer.</p>
    `
  },
  {
    id: "salinas-del-cabo",
    title: "Salinas del Cabo",
    category: "Lugares",
    tags: ["aldea", "ornamen", "merador", "balutia"],
    summary: "Aldea salinera en el extremo sur de Ornamen que aprovecha el calor volcánico residual para evaporar agua de mar más rápido que cualquier salina convencional.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>El calor que sube desde el subsuelo de esta punta costera evapora el
      agua de las salinas en una fracción del tiempo que necesitaría cualquier
      instalación similar en otra provincia, y los saleros de la aldea han
      aprendido a aprovechar esa ventaja sin depender del capricho del sol. La
      sal que producen sale hacia Solenna y Puntafuego en cargamentos
      regulares, valorada por su pureza tanto como por la velocidad con la
      que se obtiene.</p>
      <p>Vivir tan cerca del calor volcánico tiene su precio, y las casas de
      Salinas del Cabo se construyen sobre pilotes de piedra para mantener
      cierta distancia del suelo más caliente. Sus habitantes bromean con que
      la aldea entera cocina su propia sal dos veces, primero bajo tierra y
      después en las eras de secado.</p>
    `
  },
  {
    id: "capilla-del-equilibrio",
    title: "Capilla del Equilibrio",
    category: "Lugares",
    tags: ["catedral", "ornamen", "merador", "balutia"],
    summary: "Santuario del Ternarismo en el interior de Ornamen donde los sacerdotes entrenan a resolver disputas siguiendo el principio del equilibrio entre cuerpo, mente y alma.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "Clero del Ternarismo",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>A diferencia de los grandes santuarios volcánicos de la provincia, la
      Capilla del Equilibrio no se construyó junto a ninguna grieta sagrada,
      sino en terreno neutral elegido por su normalidad. Aquí
      los sacerdotes del Ternarismo entrenan a arbitrar disputas civiles
      aplicando el mismo principio que rige su fe, ningún lado sale ganando
      sin que el otro pierda algo que también merece reconocerse.</p>
      <p>Familias de Solenna y Ternaria envían a sus disputas más difíciles
      hasta aquí antes de recurrir a un tribunal imperial, confiando en que
      un mediador entrenado en el equilibrio resuelva lo que la ley por sí
      sola no siempre logra dejar satisfecho a nadie.</p>
    `
  },
  {
    id: "acantilados-de-ceniza",
    title: "Los Acantilados Grises",
    category: "Lugares",
    tags: ["naturaleza", "ornamen", "merador", "sindra"],
    summary: "Acantilados costeros en el este de Ornamen, teñidos de gris permanente por siglos de ceniza volcánica arrastrada desde el interior de la provincia.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El viento que sopla desde el interior de Ornamen arrastra ceniza
      hasta esta costa durante todo el año, tiñendo de gris permanente una
      roca que en cualquier otra provincia luciría un color completamente
      distinto. Marineros que se acercan por primera vez a menudo confunden
      los acantilados con humo a la distancia, hasta que se aproximan lo
      suficiente para distinguir la piedra sólida bajo la capa de polvo.</p>
      <p>Pescadores locales conocen corrientes traicioneras que corren justo
      bajo la línea de acantilados, invisibles desde arriba pero capaces de
      arrastrar un bote pequeño contra la roca en cuestión de minutos.
      Cruzar esta franja de costa sin guía local se considera, con razón,
      una imprudencia.</p>
    `
  },
  {
    id: "puerta-de-ornamen",
    title: "Puerta de Ornamen",
    category: "Lugares",
    tags: ["ciudad", "ornamen", "merador", "balutia"],
    summary: "Ciudad aduanera en el norte de Ornamen donde se inspecciona toda mercancía que entra o sale de la provincia hacia el corazón de Kretor.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "Aduana provincial",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>Toda carreta que cruza entre Ornamen y el resto de Kretor pasa por Puerta
      de Ornamen, donde inspectores imperiales registran cargamentos de vidrio,
      cerámica esmaltada y sal antes de dejarlos continuar viaje. La ciudad vive
      casi por completo de ese tránsito, con almacenes, posadas y cambistas que
      dependen del flujo constante de caravanas más que de cualquier industria
      propia.</p>
      <p>A diferencia del resto de la provincia, aquí el Ternarismo comparte
      protagonismo con los intereses puramente comerciales, y sus templos
      locales han aprendido a coexistir con gremios de mercaderes que rezan
      menos por equilibrio espiritual que por una temporada de aranceles
      favorables.</p>
    `
  },
  {
    id: "mercado-alto",
    title: "Mercado Alto",
    category: "Lugares",
    tags: ["ciudad", "ornamen", "merador", "balutia", "mercante"],
    summary: "Ciudad comercial en el norte de Ornamen donde se negocian por adelantado las cosechas de sal, vidrio y cerámica antes de que salgan de la provincia.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "Consejo de gremios",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Los contratos que se firman en Mercado Alto determinan casi todo
      lo que Ornamen va a producir la temporada siguiente, con compradores de
      Nigrastel y Kalvia negociando por adelantado cosechas de sal, remesas de
      vidrio y lotes enteros de cerámica esmaltada antes de que salga un solo
      cargamento real de la provincia. Los precios que se fijan aquí marcan la
      pauta para el resto de Ornamen durante meses.</p>
      <p>El Consejo de gremios que administra la ciudad reúne representantes de
      Vitrium, Alfar de Ceniza y Salinas del Cabo por igual, y sus disputas
      internas sobre cuotas de producción suelen ser más encarnizadas que
      cualquier conflicto con compradores externos.</p>
    `
  },
  {
    id: "cristaleria-imperial",
    title: "Cristalería Imperial",
    category: "Lugares",
    tags: ["ciudad", "ornamen", "merador", "balutia", "volcánico"],
    summary: "Ciudad manufacturera en el norte de Ornamen donde el vidrio bruto de Vitrium se talla y pule para exportarlo terminado al resto del Imperio.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "Gremio de talladores, bajo licencia imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El vidrio que sale en bruto de Vitrium llega a Cristalería Imperial
      para su acabado final, cortado, pulido y a menudo teñido con los mismos
      minerales volcánicos que le dan a Ornamen su carácter. Piezas que en
      Vitrium seguirían siendo bloques opacos salen de aquí como ventanales,
      lentes y ornamentos que decoran palacios en Nigrastel y más allá.</p>
      <p>El Gremio de talladores guarda sus técnicas de pulido con el mismo
      celo que cualquier secreto militar, conscientes de que su ventaja sobre
      talleres rivales de otras provincias depende enteramente de que nadie
      más aprenda a replicarlas.</p>
    `
  },
  {
    id: "travesia",
    title: "Travesía",
    category: "Lugares",
    tags: ["aldea", "ornamen", "merador", "balutia", "costero"],
    summary: "Aldea pesquera en el punto más angosto de la bahía que separa Ornamen del corazón de Kretor, donde un servicio de barcazas conecta ambas orillas todo el año.",
    region: "Ornamen, Merador, Sindra",
    gobierno: "Hermandad de barqueros",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>La bahía que separa a Ornamen del resto de Kretor se estrecha lo
      bastante en este punto como para cruzarla en barcaza en cuestión de
      minutos, y Travesía existe enteramente para ese servicio. Viajeros,
      correo oficial y mercancía ligera que no puede esperar el rodeo por
      tierra hasta Puerta de Ornamen cruzan aquí, pagando un pasaje que la
      Hermandad de barqueros ajusta según la urgencia del cliente.</p>
      <p>Las mismas familias han operado las barcazas durante generaciones, y
      conocen las corrientes del estrecho lo bastante bien como para cruzar
      incluso en las peores tormentas de la temporada, algo que ningún
      forastero se atrevería a intentar sin su ayuda.</p>
    `
  },
  {
    id: "lago-de-tolvera",
    title: "Lago de Tolvera",
    category: "Lugares",
    tags: ["lago", "grandeu", "kretor", "sindra"],
    summary: "Lago de aguas oscurecidas por la ceniza que cae de las Cumbres cercanas, fuente principal de agua para Tolvera y sus alrededores.",
    region: "Grandeu, Kretor, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>La ceniza que las Cumbres de Ceniza arrojan sobre Grandeu tiñe la
      superficie del lago con una capa gris que los habitantes de Tolvera retiran
      manualmente para mantener el agua potable. Pese a ello, sigue siendo la
      principal fuente de agua dulce de toda la región, alimentando tanto a la ciudad
      como a los campos que la rodean.</p>
      <p>Pescadores locales han aprendido a leer el grosor de la capa de ceniza como
      indicador del estado de las Cumbres, una forma improvisada pero confiable de
      vigilar la actividad volcánica sin subir a comprobarlo en persona.</p>
    `
  },
  {
    id: "cantera-gris",
    title: "Cantera Gris",
    category: "Lugares",
    tags: ["aldea", "grandeu", "kretor", "balutia"],
    summary: "Aldea minera de Grandeu que extrae la piedra gris usada en la reconstrucción constante del Baluarte Umbrío.",
    region: "Grandeu, Kretor, Sindra",
    gobierno: "Concesión imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>La piedra gris que sale de esta cantera viaja casi en su totalidad
      hacia el Baluarte Umbrío, cuyas ampliaciones constantes exigen un
      suministro que ninguna otra cantera de Grandeu logra igualar en
      volumen. Los canteros trabajan turnos largos durante la temporada seca,
      cuando el transporte por carretera es más seguro y rápido.</p>
      <p>El color de la piedra combina bien con la fortaleza que abastece,
      algo que los arquitectos imperiales consideraron al elegir esta cantera
      sobre otras más cercanas pero con tonos menos uniformes. Sus habitantes
      bromean con que Cantera Gris y el Baluarte comparten el mismo mal
      humor, ninguno de los dos deja de crecer.</p>
    `
  },
  {
    id: "rio-fulgido",
    title: "El Río Fúlgido",
    category: "Lugares",
    tags: ["río", "grandeu", "kretor", "sindra"],
    summary: "Río de Grandeu cuyas aguas reflejan un brillo dorado al atardecer por los minerales que arrastra desde las canteras cercanas.",
    region: "Grandeu, Kretor, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Partículas minerales arrastradas desde las canteras cercanas dan al
      Río Fúlgido un brillo dorado especialmente notorio al atardecer, un
      espectáculo que atrae a viajeros de toda la provincia durante los
      meses de mayor actividad minera. El resto del año, el río se ve tan
      ordinario como cualquier otro curso de agua de Grandeu.</p>
      <p>Los barqueros locales han aprendido a cobrar más por cruces al
      atardecer, aprovechando que pocos pasajeros se resisten a ver el brillo
      de cerca al menos una vez. Los pescadores, en cambio, prefieren las
      horas sin brillo, cuando los peces no se distraen con destellos en la
      superficie.</p>
    `
  },
  {
    id: "cresta-gris",
    title: "La Cresta Gris",
    category: "Lugares",
    tags: ["montaña", "grandeu", "kretor", "sindra"],
    summary: "Cordillera baja de Grandeu que separa el territorio de Ducalia del de Tolvera, cruzada por un único paso vigilado permanentemente.",
    region: "Grandeu, Kretor, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>La Cresta Gris no es lo bastante alta como para detener un ejército
      decidido, pero sí lo suficiente como para que todo tráfico entre
      Ducalia y Tolvera se concentre en el único paso practicable, un cuello
      de botella que la administración provincial vigila sin descanso. Fuera
      de ese paso, cruzar la cordillera significa horas adicionales de
      camino por terreno mucho peor.</p>
      <p>Pastores locales suben sus rebaños a las laderas más bajas durante
      el verano, aprovechando pastos que ningún terreno cultivado de Grandeu
      podría ofrecer. El resto del año, la Cresta queda casi desierta,
      salvo por la guarnición que vigila el paso.</p>
    `
  },
  {
    id: "atalaya-de-ducalia",
    title: "Atalaya de Ducalia",
    category: "Lugares",
    tags: ["fortaleza", "grandeu", "kretor", "balutia"],
    summary: "Torre de vigilancia que domina los accesos a Ducalia desde la Cresta Gris, última línea de aviso antes de que cualquier amenaza alcance la capital provincial.",
    region: "Grandeu, Kretor, Sindra",
    gobierno: "Guarnición imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Desde la Atalaya de Ducalia se domina el único paso practicable a
      través de la Cresta Gris, y su guarnición mantiene comunicación
      constante con la capital provincial mediante señales de fuego que
      pueden alertar a Ducalia en minutos. Ningún convoy cruza el paso sin
      que la Atalaya lo registre antes de que llegue a las puertas de la
      ciudad.</p>
      <p>La torre ha sido ampliada varias veces desde su construcción
      original, y sus niveles inferiores sirven ahora de cuartel permanente
      para las tropas que rotan turnos de vigilancia durante todo el año.</p>
    `
  },
  {
    id: "capilla-de-los-legionarios",
    title: "Capilla de los Legionarios",
    category: "Lugares",
    tags: ["catedral", "grandeu", "kretor", "balutia"],
    summary: "Santuario junto a Ducalia donde los soldados heridos en campaña reciben tratamiento y consuelo antes de volver al servicio activo o retirarse con honores.",
    region: "Grandeu, Kretor, Sindra",
    gobierno: "Clero estatal imperial",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Los soldados heridos en las campañas de la frontera de Grandeu pasan
      por esta capilla antes de que se decida su destino, ya sea volver al
      servicio activo, un retiro con honores o, en los casos más graves,
      cuidados permanentes que la Corona financia sin regatear. El clero
      estatal que la administra trata cada caso con una eficiencia casi
      militar, más cercana a un hospital de campaña que a un templo
      tradicional.</p>
      <p>Las paredes están cubiertas de placas conmemorativas con nombres de
      legionarios que pasaron por aquí y no sobrevivieron, y cada nueva
      generación de soldados visita la capilla antes de partir a su primera
      campaña, conscientes de que podrían volver a verla en circunstancias
      muy distintas.</p>
    `
  },
  {
    id: "bahia-de-las-mil-velas",
    title: "Las Mil Velas",
    category: "Lugares",
    tags: ["naturaleza", "kalvia", "kretor", "sindra"],
    summary: "Bahía comercial de Kalvia siempre repleta de embarcaciones ancladas, corazón visible de la prosperidad mercante del principado.",
    region: "Kalvia, Kretor, Sindra",
    gobierno: "Principado mercante",
    religionPredominante: "Iurismo",
    lugaresDestacados: [],
    content: `
      <p>Nunca faltan velas ancladas en esta bahía, sin importar la temporada, un
      símbolo tan reconocible de Kalvia que los mercaderes del reino lo usan en su
      propia heráldica comercial. Barcos de una docena de reinos distintos comparten
      sus aguas bajo las reglas comerciales que impone el Príncipe Mercante desde
      Aurelport.</p>
      <p>El Iurismo local considera la bahía un espacio casi sagrado de intercambio
      justo, y sus sacerdotes median disputas comerciales entre capitanes con
      la autoridad de un auténtico tribunal de tierra firme.</p>
    `
  },
  {
    id: "rio-del-peaje",
    title: "Río del Peaje",
    category: "Lugares",
    tags: ["río", "kalvia", "kretor", "sindra"],
    summary: "Río navegable de Kalvia donde el Principado cobra derecho de paso a toda embarcación que transporte mercancía hacia el interior.",
    region: "Kalvia, Kretor, Sindra",
    gobierno: "Principado mercante",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Toda embarcación que quiera llevar mercancía desde la costa hacia el
      interior de Kalvia debe pasar por este río, y con ella, por las casetas de peaje
      que el Príncipe Mercante ha instalado en puntos estratégicos de su cauce. Las
      tarifas varían según la carga, y regatearlas es una habilidad tan valorada en
      Kalvia como cualquier destreza militar en otros reinos.</p>
      <p>Contrabandistas ocasionales intentan rutas terrestres alternativas para
      evitar el peaje, pero el terreno accidentado alrededor del río casi nunca
      deja que el ahorro compense.</p>
    `
  },
  {
    id: "colinas-doradas",
    title: "Colinas Doradas",
    category: "Lugares",
    tags: ["montaña", "kalvia", "kretor", "sindra"],
    summary: "Colinas de tierra amarillenta en Kalvia, sede de las mejores tierras agrícolas del principado y motivo de disputas comerciales frecuentes.",
    region: "Kalvia, Kretor, Sindra",
    gobierno: "Principado mercante",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El tono amarillento de la tierra da nombre a estas colinas, las más fértiles
      de todo Kalvia y por lo tanto las más disputadas entre familias mercantes que
      buscan asegurar su propia producción de grano. El Príncipe Mercante interviene
      personalmente cuando las disputas por parcelas amenazan con volverse violentas.</p>
      <p>Los contratos de arriendo de tierra en las Colinas Doradas se negocian con
      el mismo cuidado legal que cualquier ruta comercial marítima, prueba de cuánto
      valora Kalvia cada metro de suelo productivo.</p>
    `
  },
  {
    id: "puerto-umbral",
    title: "Puerto Umbral",
    category: "Lugares",
    tags: ["aldea", "nikaalia", "uldum", "sindra"],
    summary: "Aldea pesquera en la costa norte de Nikaalia, donde los faroles de aceite oscuro sustituyen a un sol que jamás sale.",
    region: "Nikaalia, Uldum, Sindra",
    gobierno: "",
    religionPredominante: "Umbrismo",
    lugaresDestacados: [],
    content: `
      <p>Los pescadores de Puerto Umbral salen a faenar guiados por faroles de
      aceite oscuro, una técnica que perfeccionaron durante generaciones enteras
      viviendo bajo la noche eterna de Nikaalia. La costa aquí es traicionera, con
      corrientes que cambian sin previo aviso, pero las capturas suelen bastar para
      abastecer tanto a la aldea como a caravanas que bajan desde Umbrathil.</p>
      <p>El Umbrismo mantiene un pequeño templo junto al muelle, donde los
      sacerdotes bendicen cada barca antes de zarpar. Los marineros más veteranos
      insisten en que rechazar esa bendición trae mala suerte, aunque nadie recuerda
      con certeza el origen exacto de la costumbre.</p>
    `
  },
  {
    id: "bosque-sin-luna",
    title: "El Bosque sin Luna",
    category: "Lugares",
    tags: ["bosque", "nikaalia", "uldum", "sindra"],
    summary: "Bosque de Nikaalia donde la vegetación creció adaptada a la noche eterna, con hojas que absorben la escasa luz disponible en vez de reflejarla.",
    region: "Nikaalia, Uldum, Sindra",
    gobierno: "",
    religionPredominante: "Umbrismo",
    lugaresDestacados: [],
    content: `
      <p>Las hojas de este bosque crecieron oscuras generación tras generación,
      adaptadas a absorber cada rastro de luz disponible bajo la noche eterna que
      cubre Nikaalia. Caminar entre sus árboles de día resulta casi tan oscuro como
      hacerlo de noche en cualquier otro reino, una diferencia que a los forasteros
      les cuesta acostumbrarse a notar.</p>
      <p>El Umbrismo considera el bosque un lugar de meditación ideal por su
      oscuridad total, y sus sacerdotes guían retiros que pueden durar semanas
      sin que el peregrino vea el sol una sola vez.</p>
    `
  },
  {
    id: "lago-negro-nikaalia",
    title: "Lago Negro",
    category: "Lugares",
    tags: ["lago", "nikaalia", "uldum", "sindra"],
    summary: "Lago de aguas completamente opacas en Nikaalia, considerado por el Umbrismo un espejo de la propia condición eterna de la nación.",
    region: "Nikaalia, Uldum, Sindra",
    gobierno: "",
    religionPredominante: "Umbrismo",
    lugaresDestacados: [],
    content: `
      <p>Nadie ha visto el fondo del Lago Negro, ni siquiera con la mejor luz
      artificial disponible en Nikaalia, y sus aguas absorben cualquier antorcha que
      se acerque demasiado a la orilla. El Umbrismo lo describe en sus textos como un
      espejo perfecto de la condición de la nación entera, condenada a existir sin
      luz propia.</p>
      <p>Peregrinos dejan ofrendas flotando en su superficie durante ciertas fechas
      del calendario religioso, convencidos de que el lago las recibe aunque nadie
      pueda comprobarlo.</p>
    `
  },
  {
    id: "boca-oxido",
    title: "Boca Óxido",
    category: "Lugares",
    tags: ["ciudad", "nikaalia", "uldum", "sindra", "nigredo", "oscuridad"],
    summary: "Ciudad-vertedero construida sobre generaciones de maquinaria descartada, dominada por bandas rivales que controlan el desguace y el reciclaje bajo la noche eterna.",
    region: "Nikaalia, Uldum, Sindra",
    gobierno: "Territorio disputado entre bandas de desguace",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Nadie gobierna Boca Óxido en el sentido tradicional, la ciudad se
      reparte entre media docena de bandas que controlan secciones enteras
      de chatarrales, cada una defendiendo su territorio con trampas
      oxidadas y guardias armados con lo que sea que el último cargamento
      descartado tuviera de aprovechable. El aire aquí sabe a metal quemado,
      y ningún forastero cruza sin escolta pagada a la banda que controla la
      ruta que necesita usar.</p>
      <p>Bajo el caos superficial existe un orden brutal pero predecible,
      las bandas respetan las rutas de comercio que les generan ingreso y
      reservan la violencia real para las disputas de territorio. Umbrathil
      hace la vista gorda con Boca Óxido porque la ciudad recicla materiales
      que de otro modo tendría que importar, y porque intervenir directamente
      en sus disputas costaría más de lo que vale la pena cobrar.</p>
    `
  },
  {
    id: "los-estratos",
    title: "Los Estratos",
    category: "Lugares",
    tags: ["ciudad", "nikaalia", "uldum", "sindra", "nigredo", "oscuridad"],
    summary: "Ciudad vertical de Nikaalia construida en niveles apilados, cada uno bajo el control de una casa noble distinta, con los pisos superiores literalmente por encima de los inferiores en todo sentido.",
    region: "Nikaalia, Uldum, Sindra",
    gobierno: "Casas nobles, una por nivel",
    religionPredominante: "Umbrismo",
    lugaresDestacados: [],
    content: `
      <p>Los Estratos crecen hacia arriba porque el suelo de Nikaalia no
      ofrece más espacio seguro, y cada nivel de la estructura pertenece a
      una casa noble distinta que defiende su piso con la ferocidad de quien
      defendería un feudo tradicional. Cuanto más alto el nivel,
      más cerca está una casa de lo poco que pasa por luz natural en
      Nikaalia, y esa cercanía simbólica vale más para las casas altas que
      cualquier riqueza material.</p>
      <p>Las disputas entre niveles rara vez estallan en guerra abierta,
      pero el sabotaje de suministros, los sobornos a guardias ajenos y las
      alianzas rotas son constantes. El Umbrismo predica que cada casa ocupa
      exactamente el nivel que su virtud espiritual merece, una doctrina que
      las casas bajas aceptan cada vez con menos paciencia.</p>
    `
  },
  {
    id: "mercado-de-las-sombras",
    title: "Mercado de las Sombras",
    category: "Lugares",
    tags: ["ciudad", "nikaalia", "uldum", "sindra", "mercante"],
    summary: "Ciudad comercial neutral de Nikaalia donde un gremio de mercaderes cobra tributo a todas las casas y bandas a cambio de garantizar comercio sin derramamiento de sangre.",
    region: "Nikaalia, Uldum, Sindra",
    gobierno: "Gremio de mercaderes",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Ni las casas nobles ni las bandas de Boca Óxido controlan Mercado de
      las Sombras, un acuerdo que el Gremio de mercaderes impone cobrando
      tributo a todas las partes por igual a cambio de garantizar que el
      comercio ocurra sin que las rivalidades de Los Estratos o las guerras
      de chatarra se derramen dentro de sus muros. Romper la paz del mercado
      cuesta el acceso permanente, un castigo que ni la casa más poderosa se
      arriesga a provocar.</p>
      <p>Todo lo que Nikaalia necesita del resto de Uldum pasa, en algún
      momento, por sus puestos, desde el mineral de Forjahonda hasta la
      chatarra reciclable de Boca Óxido. El Gremio no fabrica ni produce
      nada por sí mismo, y sin embargo pocos en Nikaalia dudan de que sea el
      poder más estable de toda la nación.</p>
    `
  },
  {
    id: "el-espejismo",
    title: "El Espejismo",
    category: "Lugares",
    tags: ["ciudad", "nikaalia", "uldum", "sindra", "nigredo", "oscuridad"],
    summary: "Ciudad de garitos, licores importados y vicios químicos que brilla con luz artificial bajo la noche eterna, fachada respetable de la familia criminal que en realidad gobierna sus calles.",
    region: "Nikaalia, Uldum, Sindra",
    gobierno: "Familia Var Ossyn, bajo apariencia de consorcio de ocio",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El Espejismo gasta más aceite y runas lumínicas que cualquier otro
      punto de Nikaalia, y sus calles se mantienen artificialmente
      iluminadas toda la noche eterna para que sus garitos, tabernas y
      fumaderos nunca cierren. Quien llega buscando olvidar un rato la
      oscuridad exterior encuentra aquí exactamente eso, y más de un visitante
      que solo pensaba quedarse una noche termina años después sin haber
      encontrado el camino de vuelta a su vida anterior.</p>
      <p>Detrás del brillo, la ciudad entera responde a la Familia Var Ossyn,
      que se presenta ante forasteros y funcionarios como un consorcio de
      ocio respetable mientras cobra protección a cada garito, arregla
      deudas de juego con algo más contundente que papeleo y resuelve sus
      propias disputas internas con una lealtad que se hereda más que se
      jura. Los Estratos y Boca Óxido libran sus guerras a la vista de todos;
      la Familia prefiere que sus propias guerras nunca lleguen a tener
      testigos.</p>
    `
  },
  {
    id: "montana-de-ceniza-fria",
    title: "Ceniza Eterna",
    category: "Lugares",
    tags: ["montaña", "nikaalia", "uldum", "sindra"],
    summary: "Montaña de Nikaalia cubierta por una ceniza que nunca se calienta, resto de una erupción antigua ocurrida antes de que cayera la noche eterna.",
    region: "Nikaalia, Uldum, Sindra",
    gobierno: "",
    religionPredominante: "Umbrismo",
    lugaresDestacados: [],
    content: `
      <p>La ceniza que cubre esta montaña no se ha calentado desde la erupción que
      la depositó, siglos atrás, según los pocos registros de Nikaalia anteriores a la
      caída de la noche eterna. Su superficie fría y gris contrasta con la vegetación
      oscura que rodea la base, dando a la montaña un aspecto casi lunar.</p>
      <p>Ascender hasta su cráter apagado forma parte de ciertos ritos de iniciación
      del Umbrismo, reservados a sacerdotes que ya han demostrado resistencia física y
      espiritual suficiente.</p>
    `
  },
  {
    id: "picos-del-osario",
    title: "Picos del Osario",
    category: "Lugares",
    tags: ["montaña", "relania", "uldum", "sindra"],
    summary: "Cordillera de Relania salpicada de huesos de dragones fosilizados, extensión natural del cementerio que da origen al reino.",
    region: "Relania, Uldum, Sindra",
    gobierno: "",
    religionPredominante: "Culto al Pozo de la Eternidad",
    lugaresDestacados: [],
    content: `
      <p>Fragmentos de huesos de dragón asoman entre la roca de estos picos, prueba
      de que el cementerio que dio origen a Relania se extiende mucho más allá de lo
      que cualquier mapa oficial reconoce. El Culto al Pozo de la Eternidad envía
      expediciones regulares para catalogar cada nuevo hallazgo antes de que
      buscadores de tesoros lo saqueen.</p>
      <p>Escaladores experimentados a veces encuentran escamas fosilizadas del
      tamaño de un escudo, reliquias que el culto compra a buen precio para evitar que
      terminen en manos privadas.</p>
    `
  },
  {
    id: "cumbre-de-los-primeros",
    title: "La Muda",
    category: "Lugares",
    tags: ["montaña", "relania", "uldum", "sindra", "dragones"],
    summary: "Montaña helada de Relania donde el hielo conserva los restos de tribus bárbaras casi prehistóricas que dejaron de ser humanas antes de morir, mucho antes de que existiera el Culto al Pozo de la Eternidad.",
    region: "Relania, Uldum, Sindra",
    gobierno: "",
    religionPredominante: "Culto al Pozo de la Eternidad",
    lugaresDestacados: [],
    content: `
      <p>La Muda toma su nombre de lo que el hielo deja entrever cuando se
      agrieta lo suficiente, cuerpos que empezaron siendo humanos y
      terminaron cubiertos de algo que ya no lo era, como si sus dueños
      hubieran mudado de piel a mitad de una transformación que ninguno llegó
      a completar. Ningún registro de Relania recuerda el nombre
      original de esas tribus, guerreros y chamanes tan antiguos que sus
      huesos aparecen mezclados con fragmentos de escama y garra que no
      pertenecen a ninguna criatura conocida, restos de los primeros
      mortales que se ligaron a los dragones generaciones antes de que el
      Culto al Pozo de la Eternidad existiera siquiera como idea.</p>
      <p>El Culto considera la cumbre un santuario más antiguo que su propia
      fe, y por eso mismo la deja prácticamente intacta, sin expediciones de
      catalogación ni permisos de excavación como los que rigen en Picos del
      Osario. Lo que descansa en el hielo, sostienen sus sacerdotes más
      viejos, dejó de ser humano mucho antes de morir, y merece el mismo
      silencio que se guarda al dragón.</p>
    `
  },
  {
    id: "valle-de-las-escamas",
    title: "Valle de las Escamas",
    category: "Lugares",
    tags: ["naturaleza", "relania", "uldum", "sindra"],
    summary: "Valle de Relania cubierto de fragmentos de escamas de dragón que brillan al sol, considerado terreno sagrado por el Culto al Pozo de la Eternidad.",
    region: "Relania, Uldum, Sindra",
    gobierno: "",
    religionPredominante: "Culto al Pozo de la Eternidad",
    lugaresDestacados: [],
    content: `
      <p>El suelo de este valle brilla bajo el sol del mediodía por los miles de
      fragmentos de escama que se han acumulado durante siglos, restos de dragones
      que vinieron aquí a morir mucho antes de que existiera el propio reino de
      Relania. Recoger escamas está permitido solo bajo supervisión del culto, que
      reclama cada hallazgo como propiedad sagrada.</p>
      <p>El viento entre las escamas sueltas produce un sonido metálico distintivo
      que los locales describen como el susurro de los dragones muertos, todavía
      presentes en el valle que los recibió.</p>
    `
  },
  {
    id: "rio-de-huesos",
    title: "Río de Huesos",
    category: "Lugares",
    tags: ["río", "relania", "uldum", "sindra"],
    summary: "Río de Relania cuyo lecho está formado en gran parte por huesos de dragón erosionados, corriente que atraviesa el corazón del cementerio.",
    region: "Relania, Uldum, Sindra",
    gobierno: "",
    religionPredominante: "Culto al Pozo de la Eternidad",
    lugaresDestacados: [],
    content: `
      <p>El agua de este río corre sobre un lecho formado en gran parte por huesos
      de dragón erosionados durante generaciones, tan pulidos por la corriente que
      muchos ya no son reconocibles como restos óseos a simple vista. Seguir su curso
      es, para el Culto al Pozo de la Eternidad, la forma más directa de recorrer el
      cementerio completo sin necesidad de excavar.</p>
      <p>Barcazas rituales navegan el río en fechas señaladas, transportando a los
      sacerdotes más antiguos hasta puntos del cauce considerados especialmente
      sagrados.</p>
    `
  },
  {
    id: "talla-de-hueso",
    title: "Talla de Hueso",
    category: "Lugares",
    tags: ["aldea", "relania", "uldum", "sindra", "dragones"],
    summary: "Aldea de artesanos con licencia del Culto para tallar fragmentos óseos de dragón sobrantes del Osario del Comercio en objetos rituales y de uso diario.",
    region: "Relania, Uldum, Sindra",
    gobierno: "Gremio de talladores, bajo licencia del Culto",
    religionPredominante: "Culto al Pozo de la Eternidad",
    lugaresDestacados: [],
    content: `
      <p>Cada pieza que trabaja Talla de Hueso proviene de fragmentos que el
      Osario del Comercio descarta por ser demasiado pequeños para la venta
      formal, restos que el Culto permite tallar siempre que el resultado
      sirva a un propósito ritual o cotidiano y no termine en manos de
      coleccionistas. Peines, cuentas de rezo y mangos de herramienta salen
      de aquí con una talla reconocible en toda Relania.</p>
      <p>Los artesanos aprenden el oficio desde niños, y cada familia guarda
      patrones de talla que se transmiten solo dentro del propio linaje. Un
      objeto de Talla de Hueso sin la marca del gremio se considera
      falsificado, y venderlo como auténtico se castiga con la pérdida
      permanente de la licencia familiar.</p>
    `
  },
  {
    id: "retiro-de-los-guardianes",
    title: "Retiro de los Guardianes",
    category: "Lugares",
    tags: ["aldea", "relania", "uldum", "sindra", "dragones"],
    summary: "Aldea donde se retiran los Guardianes del Pozo que completan su servicio en Vigía del Borde, viviendo cerca del cementerio que dedicaron su vida a proteger.",
    region: "Relania, Uldum, Sindra",
    gobierno: "Consejo de veteranos",
    religionPredominante: "Culto al Pozo de la Eternidad",
    lugaresDestacados: [],
    content: `
      <p>Los Guardianes del Pozo casi nunca eligen alejarse de Relania al
      terminar su servicio, y Retiro de los Guardianes existe porque la Orden entendió
      hace generaciones que era más sencillo construirles un lugar propio que
      pedirles que abandonaran la tierra que protegieron toda su vida adulta.
      La aldea queda lo bastante cerca de Vigía del Borde para que los
      veteranos sigan viendo el perímetro que patrullaron, pero lo bastante
      lejos para no estorbar a quienes todavía están en servicio activo.</p>
      <p>Los antiguos guardianes entrenan a los reclutas más jóvenes de forma
      informal, transmitiendo décadas de conocimiento sobre buscadores de
      reliquias y rutas de acceso al cementerio que ningún manual oficial
      recoge con el mismo detalle.</p>
    `
  },
  {
    id: "rediles-del-pozo",
    title: "Los Rediles del Pozo",
    category: "Lugares",
    tags: ["aldea", "relania", "uldum", "sindra"],
    summary: "Aldea pastoril que cría el ganado que alimenta a Ethelgard, una de las pocas comunidades de Relania cuya vida cotidiana no gira directamente en torno al Culto.",
    region: "Relania, Uldum, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Mientras el resto de Relania organiza su existencia alrededor del
      duelo y la reverencia hacia el cementerio de dragones, Los Rediles del
      Pozo se dedican, con notable normalidad, a criar el ganado que llega a
      las mesas de Ethelgard. Sus pastores respetan el Culto sin practicarlo
      con el mismo fervor que sus vecinos, una actitud que el resto del
      reino no cuestiona porque, al final, todos necesitan comer.</p>
      <p>Los rebaños pastan lo bastante lejos del cementerio como para no
      inquietarse con el paso ocasional de un dragón moribundo en su último
      vuelo, aunque los pastores más veteranos saben reconocer la silueta a
      la distancia y arrean a los animales lejos de la ruta de vuelo por pura
      precaución.</p>
    `
  },
  {
    id: "glaciar-de-los-juramentos",
    title: "Glaciar de los Juramentos",
    category: "Lugares",
    tags: ["montaña", "har", "uldum", "sindra"],
    summary: "Glaciar de Har donde los jarls rivales sellan tratados temporales, terreno considerado demasiado hostil para que ninguna facción lo controle.",
    region: "Har, Uldum, Sindra",
    gobierno: "",
    religionPredominante: "Korvath",
    lugaresDestacados: [],
    content: `
      <p>Ni siquiera el jarl más ambicioso ha logrado establecer un asentamiento
      permanente sobre este glaciar, demasiado hostil incluso para los estándares de
      Har, lo que paradójicamente lo convirtió en el terreno neutral preferido para sellar
      tratados temporales entre facciones rivales. El hielo bajo los pies de quienes
      negocian aquí recuerda a todos lo poco que dura cualquier acuerdo.</p>
      <p>Los Guardianes del Korvath consideran el glaciar sagrado por derecho propio,
      y cualquier tratado firmado sobre su superficie se considera vinculado por el
      honor de los muertos, no solo por la palabra de los vivos.</p>
    `
  },
  {
    id: "fiordo-helado",
    title: "Fiordo Helado",
    category: "Lugares",
    tags: ["naturaleza", "har", "uldum", "sindra"],
    summary: "Fiordo estrecho de Har que permanece congelado casi todo el año, usado por los clanes locales como ruta de emboscada naval.",
    region: "Har, Uldum, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El hielo cubre este fiordo estrecho durante casi todo el año, y los
      clanes de Har que conocen bien su geografía lo usan como ruta de emboscada
      cuando un rival intenta pasar por sus aguas. Romper el hielo con un drakkar
      preparado requiere tripulación experimentada, algo que separa a los verdaderos
      guerreros del mar de los aficionados.</p>
      <p>En los meses de deshielo, el fiordo se convierte brevemente en una vía
      navegable normal, y los mismos clanes que lo usaban para emboscar aprovechan
      para comerciar sin ninguna hostilidad aparente.</p>
    `
  },
  {
    id: "bosque-de-invierno-har",
    title: "Bosque de Invierno",
    category: "Lugares",
    tags: ["bosque", "har", "uldum", "sindra"],
    summary: "Bosque de coníferas de Har que permanece nevado casi todo el año, fuente de madera y caza para los asentamientos cercanos a Skarholm.",
    region: "Har, Uldum, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>La nieve casi nunca abandona por completo este bosque, ni siquiera en los
      meses más cálidos, lo que obliga a los leñadores de Har a trabajar con
      herramientas adaptadas al frío constante. La madera que extraen sostiene buena
      parte de la construcción naval de Skarholm y los asentamientos cercanos.</p>
      <p>Manadas de alces salvajes recorren el bosque siguiendo rutas que apenas
      cambian de año en año, y cazarlos sigue siendo una de las pruebas de valor más
      respetadas entre los jóvenes guerreros de la alianza.</p>
    `
  },
  {
    id: "montana-compartida",
    title: "Montaña Compartida",
    category: "Lugares",
    tags: ["montaña", "chakur", "uldum", "sindra"],
    summary: "Elevación entre Khazgard y Ailenor cuyas laderas se dividen simbólicamente entre enanos y elfos, uno de los pocos puntos altos que ambos pueblos administran juntos.",
    region: "Chakur, Uldum, Sindra",
    gobierno: "Administración conjunta enana-élfica",
    religionPredominante: "Neravismo",
    lugaresDestacados: [],
    content: `
      <p>Las laderas de esta montaña se dividen por acuerdo tácito entre ambos
      pueblos de Chakur, con los enanos trabajando las vetas minerales de un lado y
      los elfos manteniendo los bosques del otro sin invadir el territorio del vecino.
      La cima, considerada terreno neutral, alberga un pequeño santuario compartido
      del Neravismo.</p>
      <p>Representantes de Khazgard y Ailenor se reúnen aquí cada cierto tiempo para
      revisar el estado del acuerdo, una tradición que sobrevivió incluso a los años
      más tensos de la reconstrucción posterior a la guerra.</p>
    `
  },
  {
    id: "bosque-de-las-dos-coronas",
    title: "Bosque de las Dos Coronas",
    category: "Lugares",
    tags: ["bosque", "chakur", "uldum", "sindra"],
    summary: "Bosque antiguo de Chakur donde crecen entrelazados un árbol enano tallado y un árbol élfico viviente, símbolo de la civilización compartida perdida en la guerra.",
    region: "Chakur, Uldum, Sindra",
    gobierno: "",
    religionPredominante: "Neravismo",
    lugaresDestacados: [],
    content: `
      <p>En el centro de este bosque crecen entrelazados dos árboles de origen
      distinto: uno tallado por manos enanas hace siglos, otro vivo y cultivado por
      generaciones de elfos. Juntos forman lo que ambos pueblos de Chakur llaman las
      Dos Coronas, un símbolo de la civilización compartida que la guerra antigua
      estuvo a punto de borrar por completo.</p>
      <p>Parejas mixtas de enanos y elfos viajan hasta aquí para celebrar sus
      uniones, convencidas de que ningún otro lugar de Chakur representa mejor lo que
      intentan construir juntas.</p>
    `
  },
  {
    id: "lago-subterraneo-chakur",
    title: "El Lago Subterráneo",
    category: "Lugares",
    tags: ["lago", "chakur", "uldum", "sindra"],
    summary: "Lago bajo las montañas de Chakur descubierto por mineros enanos, de aguas frías y perfectamente quietas iluminadas por hongos bioluminiscentes.",
    region: "Chakur, Uldum, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Mineros de Khazgard descubrieron este lago hace generaciones mientras
      abrían una nueva galería, y decidieron dejarlo intacto en lugar de drenarlo
      para seguir excavando. Hongos bioluminiscentes cubren sus
      paredes, iluminando el agua perfectamente quieta con un resplandor azulado que
      no necesita antorchas.</p>
      <p>Exploradores élficos de Ailenor visitan ocasionalmente el lago, uno de los
      pocos puntos de Chakur donde ambos pueblos coinciden sin fricción, atraídos por
      una belleza que ninguno de los dos reclama en exclusiva.</p>
    `
  },
  {
    id: "cantera-de-bronce",
    title: "La Cantera de Bronce",
    category: "Lugares",
    tags: ["montaña", "nernib", "merador", "sindra"],
    summary: "Cantera de mineral de cobre y estaño que alimenta la producción de bronce de Nernib, corazón industrial de la ciudad-estado de los inventores.",
    region: "Nernib, Merador, Sindra",
    gobierno: "Oligarquía de artificieros",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El cobre y el estaño que sostienen la producción de bronce de Nernib salen
      casi en su totalidad de esta cantera, excavada con maquinaria que la propia
      ciudad diseñó para acelerar la extracción muy por encima de lo que lograría
      cualquier método manual. El ruido constante de los ingenios mineros se escucha
      a kilómetros de distancia.</p>
      <p>La oligarquía de artificieros rota el control de la cantera entre los
      gremios más productivos cada cierto número de años, un sistema que mantiene la
      competencia por innovar sin detener nunca la producción.</p>
    `
  },
  {
    id: "rio-de-vapor",
    title: "El Río de Vapor",
    category: "Lugares",
    tags: ["río", "nernib", "merador", "sindra"],
    summary: "Río artificialmente calentado por las fraguas de Nernib, que corre humeante todo el año y mueve gran cantidad de la maquinaria de la ciudad.",
    region: "Nernib, Merador, Sindra",
    gobierno: "Oligarquía de artificieros",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El calor residual de las fraguas de Nernib se vierte directamente en este
      río, que corre humeante durante todo el año sin importar la estación. Ruedas
      hidráulicas aprovechan tanto su corriente como su temperatura para mover parte
      de la maquinaria que sostiene la producción industrial de la ciudad-estado.</p>
      <p>Bañarse en sus aguas más calientes se ha vuelto una costumbre popular entre
      los trabajadores nocturnos, que aprovechan el calor gratuito antes de volver a
      turnos cada vez más largos.</p>
    `
  },
  {
    id: "pantano-de-chatarra",
    title: "Pantano de Chatarra",
    category: "Lugares",
    tags: ["naturaleza", "nernib", "merador", "sindra"],
    summary: "Zona pantanosa a las afueras de Nernib usada como vertedero de maquinaria obsoleta, donde carroñeros mecánicos recuperan piezas todavía útiles.",
    region: "Nernib, Merador, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Generaciones de maquinaria obsoleta se acumulan bajo el lodo de este
      pantano, vertido aquí por los gremios de Nernib cada vez que un invento queda
      superado por uno mejor. Carroñeros independientes recorren sus aguas poco
      profundas buscando piezas que todavía puedan repararse o revenderse, ignorando
      el óxido y el riesgo de cortes.</p>
      <p>La oligarquía deja hacer mientras la actividad no interfiera con nuevos
      vertidos, consciente de que el reciclaje informal ahorra a la ciudad el costo
      de un desguace oficial.</p>
    `
  },
  {
    id: "minas-de-azufre",
    title: "Minas de Azufre",
    category: "Lugares",
    tags: ["aldea", "ornamen", "merador", "balutia", "volcánico"],
    summary: "Campamento minero en las fumarolas del norte de Ornamen, donde se extrae el azufre que abastece a alquimistas y armeros de toda la Corona.",
    region: "Ornamen, Merador, Balutia",
    gobierno: "Capataz designado por la Corona",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>El aire de las Minas de Azufre jamás llega a limpiarse por completo, ni
      siquiera con los pañuelos empapados que cada minero se ata sobre la boca
      antes de bajar a las fumarolas. Las vetas amarillas que extraen aquí
      alimentan media industria alquímica de Balutia, desde la pólvora de los
      armeros imperiales hasta los ungüentos que venden los sanadores de
      Solenna.</p>
      <p>Pocos mineros duran más de una década respirando esos vapores antes de
      que la Corona los reasigne a otro trabajo, algo que el capataz explica a
      cada nueva cuadrilla el primer día sin suavizar la cifra. Aun así, la paga
      supera con creces la de cualquier otro puesto minero de la provincia, y
      las cuadrillas nunca faltan.</p>
    `
  },
  {
    id: "observatorio-del-crater",
    title: "El Observatorio del Cráter",
    category: "Lugares",
    tags: ["torre", "ornamen", "merador", "balutia", "volcánico"],
    summary: "Torre de vulcanólogos junto al Cráter Dormido, encargada de medir sus temblores y advertir a la Corona antes de que autorice nuevas construcciones cerca.",
    region: "Ornamen, Merador, Balutia",
    gobierno: "Colegio de vulcanólogos, con financiamiento imperial",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>Desde lo alto de esta torre, un pequeño colegio de estudiosos lleva
      generaciones registrando cada temblor que sacude el Cráter Dormido, con
      instrumentos que combinan precisión mecánica y plegarias al Ternarismo por
      igual. Sus informes deciden si la Corona autoriza una nueva cantera o una
      nueva aldea a pocas leguas del volcán, o si en cambio ordena evacuar lo
      que ya existe.</p>
      <p>Los sacerdotes del Triunvirato consultan regularmente a los
      vulcanólogos antes de programar sus rituales mayores, aunque ambos grupos
      discrepan a menudo sobre qué temblor es augurio y cuál es simple
      geología. La rivalidad entre ambas lecturas del mismo dato lleva décadas
      sin resolverse, y ambas partes se resisten por igual a ceder terreno.</p>
    `
  },
  {
    id: "vinedos-de-brasa",
    title: "Viñedos de Brasa",
    category: "Lugares",
    tags: ["aldea", "ornamen", "merador", "balutia", "volcánico"],
    summary: "Aldea agrícola donde el suelo volcánico de Ornamen produce un vino oscuro muy apreciado en la Corte, cultivado sobre coladas de lava ya frías.",
    region: "Ornamen, Merador, Balutia",
    gobierno: "Consejo de viñateros",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>Las cepas de Viñedos de Brasa crecen directamente sobre coladas de
      lava enfriadas hace generaciones, un suelo que en cualquier otra
      provincia se consideraría inservible pero que aquí produce un vino
      oscuro y mineral, muy buscado en los banquetes de la Corte. Los
      viñateros locales sostienen que el calor que todavía guarda la piedra
      bajo tierra madura las uvas de un modo que pocos viñedos de Balutia
      logran igualar.</p>
      <p>La cosecha se organiza en torno al calendario del Ternarismo, con una
      bendición formal antes del primer corte, y los propios trabajadores
      evitan pisar ciertas parcelas marcadas como demasiado cercanas a grietas
      activas. El riesgo forma parte del precio del vino, algo que pocos
      compradores de la capital se detienen a considerar.</p>
    `
  },
  {
    id: "cantera-de-obsidiana",
    title: "Cantera de Obsidiana",
    category: "Lugares",
    tags: ["aldea", "ornamen", "merador", "balutia", "volcánico"],
    summary: "Cantera donde se extrae la obsidiana que abastece a los talladores de Vitrium y Cristalería Imperial, arrancada de coladas de lava vitrificada.",
    region: "Ornamen, Merador, Balutia",
    gobierno: "Gremio de canteros",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>La obsidiana que sale de esta cantera se forma cuando la lava se
      enfría demasiado rápido para cristalizar como roca común, dejando vetas
      negras y afiladas que los canteros extraen con cuidado extremo para no
      fragmentarlas. Casi toda esa obsidiana termina en los talleres de
      Vitrium o en las forjas de Cristalería Imperial, convertida en cristal,
      hoja o adorno según el encargo.</p>
      <p>Trabajar la cantera exige un oído entrenado para distinguir el
      sonido de una veta estable del de una a punto de ceder, una habilidad
      que se transmite de maestro a aprendiz durante años antes de dejarlo
      trabajar solo. Los accidentes son raros pero casi siempre graves cuando
      ocurren, y el gremio local paga generosamente a quienes sobreviven lo
      bastante para enseñar a la siguiente generación.</p>
    `
  },
  {
    id: "thrandheim",
    title: "Thrandheim",
    category: "Lugares",
    tags: ["ciudad", "har", "uldum", "sindra", "alianza"],
    summary: "Fortaleza en expansión del jarl Thrandulf, quien acumula más juramentos de vasallaje que cualquier otro caudillo de Har desde la fundación de la alianza.",
    region: "Har, Uldum, Sindra",
    gobierno: "Jarl Thrandulf",
    religionPredominante: "Korvath",
    lugaresDestacados: [],
    content: `
      <p>Thrandheim empezó como un asentamiento más, apenas distinto de
      Kraghold o una decena de aldeas similares, hasta que el jarl Thrandulf
      comenzó a absorber juramentos de vasallaje de caudillos vecinos con una
      paciencia que pocos en Har le atribuían al principio. Dos generaciones
      después, su salón se ha vuelto casi tan grande como el de Skarholm, y
      sus murallas crecen cada temporada con piedra tallada por vasallos que
      antes juraban lealtad a otro.</p>
      <p>Los demás jarls hablan de Thrandulf con una mezcla de respeto y
      alarma, conscientes de que la vieja ley contra las guerras de
      exterminio no dice nada sobre acumular poder por matrimonios, pactos y
      herencias forzadas. Nadie en la alianza se atreve todavía a llamarlo
      aspirante a rey en voz alta, pero cada vez menos disimulan que lo
      piensan.</p>
    `
  },
  {
    id: "balvik",
    title: "Balvik",
    category: "Lugares",
    tags: ["aldea", "har", "uldum", "sindra", "costero"],
    summary: "Aldea ballenera en la costa norte de Har, cuya economía entera depende de la caza estacional y cuyas casas mezclan madera con hueso de ballena.",
    region: "Har, Uldum, Sindra",
    gobierno: "Jarl local",
    religionPredominante: "Korvath",
    lugaresDestacados: [],
    content: `
      <p>Cada invierno, los balleneros de Balvik salen en botes pequeños y
      peligrosamente frágiles a perseguir manadas que migran cerca de la
      costa, una caza que exige una coordinación casi ritual entre
      tripulaciones que compiten el resto del año por cualquier otra cosa. El
      hueso, la grasa y la piel de cada ballena se reparten según reglas tan
      antiguas que nadie recuerda cuándo se establecieron, y romperlas se
      castiga con destierro inmediato.</p>
      <p>Las casas de Balvik mezclan madera con costillas de ballena
      reforzando los techos, una técnica que los visitantes de otros
      asentamientos de Har encuentran macabra y los propios habitantes
      consideran simplemente práctica. Los narradores del Korvath cantan aquí
      historias distintas a las que se escuchan en Skarholm, centradas menos
      en la guerra y más en el mar como enemigo digno.</p>
    `
  },
  {
    id: "vardsund",
    title: "Vardsund",
    category: "Lugares",
    tags: ["naturaleza", "har", "uldum", "sindra"],
    summary: "Estrecho fiordo del sur de Har disputado por clanes rivales que se turnan el control de su paso, la ruta más segura hacia el Mercado del Deshielo.",
    region: "Har, Uldum, Sindra",
    gobierno: "Disputado entre clanes rivales",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>Quien controla Vardsund cobra peaje a cada drakkar que necesite
      cruzar hacia el sur, lo que ha convertido este estrecho en el punto más
      disputado de Har fuera de las propias capitales. El control cambia de
      manos con cada temporada de guerra, y algunos clanes han llegado a
      gobernarlo apenas unas semanas antes de perderlo de nuevo.</p>
      <p>La franja de tierra a cada lado del fiordo está sembrada de fortines
      abandonados de ocupaciones anteriores, algunos reutilizados por el clan
      actual y otros dejados en ruinas como recordatorio de cuán breve puede
      ser el dominio sobre este paso. Los mercaderes que cruzan camino al
      Mercado del Deshielo aprenden rápido a preguntar quién manda esta
      semana antes de negociar el peaje.</p>
    `
  },
  {
    id: "circulo-de-hierro",
    title: "El Círculo de Hierro",
    category: "Lugares",
    tags: ["naturaleza", "har", "uldum", "sindra"],
    summary: "Llanura pedregosa donde los guerreros de Har resuelven insultos personales mediante duelo formal, distinta de los campos de batalla de las guerras entre clanes.",
    region: "Har, Uldum, Sindra",
    gobierno: "Guardianes del Korvath",
    religionPredominante: "Korvath",
    lugaresDestacados: [],
    content: `
      <p>A diferencia de las guerras entre clanes, que se libran por
      territorio y alianzas, los insultos personales en Har se resuelven
      aquí, en un círculo de piedras de hierro clavadas verticalmente que
      marca el límite del combate. Dos guerreros entran, uno sale, y el
      vencedor no puede ser perseguido después por parientes del caído sin
      perder todo honor ante el Korvath.</p>
      <p>Los Guardianes que vigilan el círculo no intervienen en el combate
      mismo, solo verifican que ambos contendientes entraron por voluntad
      propia y que las armas cumplen las reglas acordadas. Jarls y campesinos
      se enfrentan aquí bajo las mismas condiciones exactas, una de las
      pocas instancias en Har donde el rango no compra ninguna ventaja.</p>
    `
  },
  {
    id: "manantial-de-brasa",
    title: "Manantial de Brasa",
    category: "Lugares",
    tags: ["naturaleza", "har", "uldum", "sindra"],
    summary: "Fuente termal en el sur de Har, uno de los pocos lugares de la región donde el agua nunca se congela, disputado más por su valor curativo que por su ubicación.",
    region: "Har, Uldum, Sindra",
    gobierno: "",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El calor que sube desde las profundidades mantiene esta fuente
      humeante incluso en pleno invierno, cuando todo lo demás en el sur de
      Har se congela sólido durante meses. Guerreros heridos viajan largas
      distancias para sumergirse en sus aguas, convencidos de que curan más
      rápido que cualquier ungüento preparado por un sanador.</p>
      <p>El manantial no pertenece a ningún clan en particular, en parte
      porque defenderlo todo el año costaría más de lo que vale, y en parte
      porque atacar a un rival malherido mientras se baña aquí se considera
      una cobardía que ni el guerrero más despiadado de la alianza está
      dispuesto a cargar.</p>
    `
  },
  {
    id: "cripta-de-los-lobos",
    title: "Cripta de los Lobos",
    category: "Lugares",
    tags: ["aldea", "har", "uldum", "sindra"],
    summary: "Red de cuevas en las montañas de Har donde el clan Ulfhaug cría y adiestra lobos de guerra desde hace generaciones, temidos casi tanto como sus guerreros.",
    region: "Har, Uldum, Sindra",
    gobierno: "Clan Ulfhaug",
    religionPredominante: "Korvath",
    lugaresDestacados: [],
    content: `
      <p>El clan Ulfhaug vive junto a estas cuevas desde tiempos que ni sus
      propios ancianos logran fechar con precisión, criando generación tras
      generación de lobos más grandes y agresivos que los que corren libres
      por el resto de Har. Cada guerrero del clan se vincula a un cachorro
      desde pequeño y lo entrena durante años antes de llevarlo a su primera
      batalla.</p>
      <p>Otros clanes de la alianza contratan a los Ulfhaug como mercenarios
      cuando necesitan romper un asedio o sembrar pánico entre tropas
      enemigas, y pagan generosamente por el privilegio. Perder a un lobo en
      combate se llora en Cripta de los Lobos con el mismo ritual que la
      muerte de un guerrero, y matar a uno sin necesidad es algo que ningún
      clan de Har perdona con facilidad.</p>
    `
  },
  {
    id: "salon-de-los-cantores",
    title: "El Salón de los Cantores",
    category: "Lugares",
    tags: ["aldea", "har", "uldum", "sindra"],
    summary: "Salón donde los skalds de Har compiten cada año por el derecho a narrar la historia reciente de la alianza, versión oral que a menudo choca con lo grabado en la Piedra del Legado.",
    region: "Har, Uldum, Sindra",
    gobierno: "Círculo de skalds",
    religionPredominante: "Korvath",
    lugaresDestacados: [],
    content: `
      <p>Una vez al año, los mejores narradores de cada clan de Har se
      reúnen en este salón para competir por el título de Voz Principal, el
      skald cuya versión de los acontecimientos recientes se considera la
      más fiel y se repite en tabernas y salones de toda la alianza durante
      los doce meses siguientes. La competencia se juzga tanto por la
      memoria como por la habilidad para convertir una escaramuza confusa en
      un relato que valga la pena cantar.</p>
      <p>Las versiones que salen de aquí no siempre coinciden con los
      nombres grabados en la Piedra del Legado, y esa fricción entre lo
      cantado y lo tallado en piedra genera disputas ocasionales sobre qué
      clan hizo realmente qué en cada batalla. Los Guardianes del Korvath se
      mantienen deliberadamente al margen de esas discusiones, considerando
      ambas formas de recordar igual de sagradas.</p>
    `
  },
  {
    id: "isla-de-los-proscritos",
    title: "Los Yermos del Destierro",
    category: "Lugares",
    tags: ["naturaleza", "har", "uldum", "sindra"],
    summary: "Franja de tierra baldía más allá del territorio de cualquier clan de Har, donde se abandona a quienes rompen el honor del Korvath, condenados a sobrevivir solos o no sobrevivir en absoluto.",
    region: "Har, Uldum, Sindra",
    gobierno: "",
    religionPredominante: "Korvath",
    lugaresDestacados: [],
    content: `
      <p>Cuando un jarl declara a alguien proscrito por romper una tregua
      sagrada, traicionar a su propio clan o profanar la Piedra del Legado,
      el castigo no es la muerte sino la expulsión a estos yermos, mucho más
      allá de las últimas tierras reclamadas por cualquier clan, con apenas
      las herramientas necesarias para intentar sobrevivir. Regresar a
      tierra reclamada sin autorización expresa se castiga con una ejecución
      inmediata que ningún clan cuestiona, sin importar cuán duro haya sido
      el destierro.</p>
      <p>Pocos proscritos duran más de un par de inviernos en los Yermos, y
      los que sobreviven ese tiempo suelen desarrollar una reputación propia
      entre cazadores y comerciantes itinerantes que a veces les dejan
      suministros a escondidas, en violación técnica de la sentencia.
      Algunos jarls hacen la vista gorda con esos gestos de compasión
      silenciosa; otros los castigan tan duramente como el crimen
      original.</p>
    `
  },
  {
    id: "refugio-de-los-quemados",
    title: "Refugio de los Quemados",
    category: "Lugares",
    tags: ["aldea", "ornamen", "merador", "balutia", "volcánico"],
    summary: "Hospicio y aldea de acogida para quienes quedan desfigurados por accidentes en las forjas, minas y coladas de Ornamen, sostenido por el Ternarismo pero mirado con recelo por el resto de la provincia.",
    region: "Ornamen, Merador, Balutia",
    gobierno: "Orden de acogida del Ternarismo",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>Nadie elige terminar en el Refugio de los Quemados. Llegan aquí los
      mineros que perdieron la vista por los vapores de las Minas de Azufre,
      los canteros marcados por una veta de obsidiana que cedió antes de
      tiempo, los aprendices de forja del Yunque Ardiente que sobrevivieron a
      un accidente que otros no contaron. El Ternarismo sostiene el hospicio
      como un deber sagrado, y sus sacerdotes tratan cada cicatriz como una
      ofrenda involuntaria a Azufre, el segundo principio de su fe.</p>
      <p>El resto de Ornamen habla poco del lugar y evita visitarlo sin
      necesidad, una incomodidad que sus propios habitantes conocen bien y
      que pocas veces discuten con extraños. Dentro del refugio, sin embargo,
      existe una solidaridad que pocos asentamientos de la provincia logran
      igualar, forjada entre personas que ya perdieron lo que más temían
      perder.</p>
    `
  },
  {
    id: "marea-tibia",
    title: "Marea Tibia",
    category: "Lugares",
    tags: ["aldea", "ornamen", "merador", "balutia", "volcánico", "costero"],
    summary: "Aldea pesquera en la punta de la península de Ornamen, donde fumarolas submarinas mantienen el agua costera caliente todo el año y atraen bancos de peces que en cualquier otra costa emigrarían con el frío.",
    region: "Ornamen, Merador, Balutia",
    gobierno: "Consejo de pescadores",
    religionPredominante: "Ternarismo",
    lugaresDestacados: [],
    content: `
      <p>El agua frente a Marea Tibia nunca baja lo suficiente de temperatura
      como para que los peces migren en invierno, gracias a fumarolas
      submarinas que calientan la corriente desde el fondo. El resultado es
      una pesca constante durante todo el año, algo que ningún otro puerto
      de Ornamen puede ofrecer, aunque los pescadores locales pagan el
      privilegio con redes que se pudren más rápido por el calor y con
      criaturas de aguas profundas que la corriente tibia atrae hacia la
      costa con más frecuencia de la que quisieran.</p>
      <p>Puntafuego compra casi toda la pesca fresca de la aldea antes de
      que llegue a cualquier otro mercado, un acuerdo informal que
      sostiene a Marea Tibia sin necesidad de que sus barcas se aventuren
      hasta la capital provincial. Los sacerdotes del Ternarismo consideran
      el fenómeno una prueba viviente de que el fuego, bien entendido, da
      tanto como quita.</p>
    `
  },
  {
    id: "linde-del-principado",
    title: "Linde del Principado",
    category: "Lugares",
    tags: ["fortaleza", "kalvia", "kretor", "sindra", "mercante"],
    summary: "Puesto fronterizo al norte de Kalvia donde termina la autoridad efectiva del Príncipe Mercante y comienza tierra de Kretor que nadie administra de forma directa.",
    region: "Kalvia, Kretor, Sindra",
    gobierno: "Guarnición del Principado mercante",
    religionPredominante: "Iurismo",
    lugaresDestacados: [],
    content: `
      <p>Todo lo que entra a Kalvia por tierra, en lugar de por mar, pasa
      primero por Linde del Principado, donde funcionarios del Iurismo
      revisan cada carga tan minuciosamente como los
      tribunales de Aurelport revisan un contrato en disputa. Más allá del puesto,
      el mapa oficial del Principado simplemente deja de estar coloreado, y
      ningún mercader serio se aventura a esas tierras sin escolta.</p>
      <p>La guarnición es pequeña, apenas suficiente para cobrar aranceles y
      rechazar a los grupos armados que ocasionalmente prueban suerte
      cruzando desde el norte. El Príncipe Mercante ha considerado más de
      una vez extender la frontera formal varias leguas más allá, pero
      ningún consejero logra justificar el gasto frente al beneficio
      comercial real que traería.</p>
    `
  },
  {
    id: "cantera-de-marmol-rosado",
    title: "Cantera de Mármol Rosado",
    category: "Lugares",
    tags: ["aldea", "kalvia", "kretor", "sindra", "mercante"],
    summary: "Cantera al norte de Kalvia de donde se extrae el mármol rosado que reviste las fachadas de Banca Alta y las mansiones de los mercaderes más ricos del Principado.",
    region: "Kalvia, Kretor, Sindra",
    gobierno: "Concesión del Principado mercante",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>El mármol veteado de rosa que sale de esta cantera se ha
      convertido, con los años, en la seña visual de la riqueza mercante de
      Kalvia. Encargar una fachada revestida con piedra de esta cantera
      cuesta más que la mansión entera construida con cualquier otro
      material, y los banqueros de Banca Alta lo saben perfectamente cuando
      deciden qué mostrar y qué esconder de su fortuna.</p>
      <p>La cantera pertenece formalmente al Principado, pero opera bajo
      una concesión que se subasta cada década al mejor postor, un contrato
      tan disputado como cualquier ruta comercial marítima. Los canteros que
      trabajan aquí ganan salarios muy por encima del resto de Kalvia,
      conscientes de que un solo bloque mal cortado puede costarle a su
      patrón un contrato completo con la capital.</p>
    `
  },
  {
    id: "lonja-de-los-naufragios",
    title: "La Lonja de los Naufragios",
    category: "Lugares",
    tags: ["ciudad", "kalvia", "kretor", "sindra", "mercante"],
    summary: "Casa de seguros marítimos de Kalvia, donde los mercaderes aseguran sus cargamentos contra tormentas, piratería y el propio Arrecife del Naufragio antes de zarpar.",
    region: "Kalvia, Kretor, Sindra",
    gobierno: "Consorcio de aseguradores, bajo licencia del Tribunal de los Sellos",
    religionPredominante: "Iurismo",
    lugaresDestacados: [],
    content: `
      <p>Todo capitán que zarpa de Aurelport con un cargamento de valor pasa
      antes por La Lonja de los Naufragios, donde un gremio de aseguradores
      calcula, cargamento por cargamento, cuánto cobrar por cubrir el
      riesgo de tormenta, piratería o un mal cálculo cerca del Arrecife del
      Naufragio. Las tarifas suben o bajan según la temporada, la ruta y la
      reputación del propio capitán, información que el gremio guarda con
      más celo que cualquier banco de Banca Alta.</p>
      <p>El Tribunal de los Sellos exige que cada póliza se registre bajo
      juramento de Iurismo, y cobrar un seguro sin haber declarado un
      riesgo conocido de antemano se castiga como fraude religioso, no solo
      comercial. Los propios aseguradores financian, en secreto, algunas de
      las expediciones de rescate que salen hacia naufragios recientes,
      menos por compasión que por reducir lo que finalmente tendrán que
      pagar.</p>
    `
  },
  {
    id: "archivo-de-las-rutas",
    title: "El Archivo de las Rutas",
    category: "Lugares",
    tags: ["ciudad", "kalvia", "kretor", "sindra", "mercante"],
    summary: "Gremio de cartógrafos de Kalvia que actualiza y vende las cartas de navegación más precisas del Principado, guardadas con el mismo celo que cualquier secreto de estado.",
    region: "Kalvia, Kretor, Sindra",
    gobierno: "Gremio de cartógrafos, bajo juramento de Iurismo",
    religionPredominante: "Iurismo",
    lugaresDestacados: [],
    content: `
      <p>Cada vez que un barco encalla cerca del Arrecife del Naufragio o
      una tormenta reabre un canal que se creía cerrado, un cartógrafo del
      Archivo sale a verificar el cambio antes de que la carta oficial se
      actualice. Los capitanes de Aurelport pagan una cuota anual por
      acceso a las versiones más recientes, y navegar con una carta vencida
      se considera, entre los propios marineros, casi tan imprudente como
      zarpar sin seguro de La Lonja de los Naufragios.</p>
      <p>El gremio exige a cada cartógrafo un juramento de Iurismo que
      prohíbe vender copias a comerciantes de otros principados, un secreto
      que ha costado más de una expulsión y, según los rumores menos
      comprobables, algún accidente demasiado conveniente. El Príncipe
      Mercante considera las cartas del Archivo una ventaja comercial tan
      valiosa como cualquier flota, y las trata con la misma discreción.</p>
    `
  },
  {
    id: "ruinas-de-kharzun-vael",
    title: "Las Ruinas de Kharzun-Vael",
    category: "Lugares",
    tags: ["ruinas", "chakur", "uldum", "sindra"],
    summary: "Restos de la civilización compartida de enanos y elfos previa a la guerra, campo de batalla final que ninguno de los dos pueblos se ha atrevido a reconstruir.",
    region: "Chakur, Uldum, Sindra",
    gobierno: "",
    religionPredominante: "Neravismo",
    lugaresDestacados: [],
    content: `
      <p>Aquí se libró la última gran batalla de la guerra que partió en dos
      la civilización compartida de enanos y elfos, y aquí sigue casi todo
      tal como quedó cuando terminó: columnas talladas a medias entre piedra
      y madera viva, armaduras fundidas por algo que ningún relato
      sobreviviente termina de explicar, y calles que alguna vez sirvieron a un
      solo pueblo dividido ahora en dos.</p>
      <p>Ni Khazgard ni Ailenor han autorizado una reconstrucción formal,
      cada capital alegando que hacerlo sin la otra sería una provocación.
      Estudiosos de ambas ciudades visitan las ruinas por separado, casi
      siempre coordinando fechas para no cruzarse, y lo que encuentran ahí
      pocas veces coincide del todo con lo que la otra capital recuerda de la
      misma historia compartida.</p>
    `
  },
  {
    id: "baluarte-gemelo",
    title: "Baluarte Gemelo",
    category: "Lugares",
    tags: ["fortaleza", "chakur", "uldum", "sindra", "enanos", "elfos"],
    summary: "Guarnición fronteriza entre Khazgard y Ailenor con mando compartido entre ambos pueblos, símbolo tenso de una paz que ninguna de las dos capitales quiere romper primero.",
    region: "Chakur, Uldum, Sindra",
    gobierno: "Mando conjunto enano-élfico, rotativo",
    religionPredominante: "Neravismo",
    lugaresDestacados: [],
    content: `
      <p>El mando de Baluarte Gemelo rota cada temporada entre un oficial de
      Khazgard y uno de Ailenor, un arreglo diseñado para que ninguna de las
      dos capitales pueda acusar a la otra de controlar la frontera en
      exclusiva. Las tropas de ambos pueblos comparten cuartel, turnos de
      guardia y suministros, aunque solo de vez en cuando comparten mesa, por
      costumbre más que por prohibición.</p>
      <p>La guarnición existe oficialmente para vigilar incursiones
      externas, pero todos en Chakur saben que su función real es contener
      cualquier roce fronterizo entre ambos pueblos antes de que escale.
      Ningún oficial destinado aquí ignora que un solo error de juicio
      podría reabrir una guerra que las dos capitales llevan generaciones
      intentando no repetir.</p>
    `
  },
  {
    id: "verdesavia",
    title: "Verdesavia",
    category: "Lugares",
    tags: ["aldea", "chakur", "uldum", "sindra", "elfos"],
    summary: "Aldea élfica dedicada al cultivo de frutales y viñas en los claros cercanos a Ailenor, principal proveedora de alimento fresco para ambas capitales de Chakur.",
    region: "Chakur, Uldum, Sindra",
    gobierno: "Consejo de cultivadores",
    religionPredominante: "Neravismo",
    lugaresDestacados: [],
    content: `
      <p>Los claros que rodean Verdesavia se despejaron generaciones atrás,
      no talando árboles sino guiando su crecimiento con paciencia élfica
      hasta abrir espacio suficiente para huertos y viñas. La aldea abastece
      de fruta fresca tanto a Ailenor como, mediante caravanas regulares, a
      Khazgard, uno de los pocos productos que ambas capitales importan del
      mismo lugar sin fricción.</p>
      <p>Los cultivadores de Verdesavia mantienen una relación comercial más
      fluida con los enanos que la propia Ailenor, simplemente porque la
      comida no representa la misma carga histórica que la tierra o la
      memoria. Caravaneros enanos y elfos que se cruzan aquí intercambian
      bromas que en cualquier otro punto de la frontera sonarían a
      provocación.</p>
    `
  },
  {
    id: "kroth-baraz",
    title: "Kroth-Baraz",
    category: "Lugares",
    tags: ["aldea", "chakur", "uldum", "sindra", "enanos"],
    summary: "Asentamiento minero enano en las montañas más altas de Chakur, refugio de quienes consideran que Khazgard cedió demasiado a los elfos tras la guerra.",
    region: "Chakur, Uldum, Sindra",
    gobierno: "Consejo de clanes disidentes",
    religionPredominante: "Neravismo",
    lugaresDestacados: [],
    content: `
      <p>Kroth-Baraz se fundó con enanos que abandonaron Khazgard poco
      después de la reconstrucción, convencidos de que el consejo de la
      capital había sacrificado demasiado terreno y demasiado orgullo por
      una paz con los elfos que consideraban ni pedida ni necesaria. El
      asentamiento vive de sus propias minas, sin depender del comercio con
      Ailenor que sostiene a tantos otros asentamientos de Chakur.</p>
      <p>Khazgard no reconoce oficialmente al consejo de clanes disidentes
      que gobierna Kroth-Baraz, pero tampoco ha intentado someterlo por la
      fuerza, consciente de que hacerlo confirmaría exactamente las
      acusaciones de debilidad que sus fundadores lanzaron al marcharse. La
      relación entre ambos se sostiene en un silencio incómodo que ninguna
      de las dos partes ha decidido romper todavía.</p>
    `
  },
  {
    id: "el-cruce-chakur",
    title: "El Cruce",
    category: "Lugares",
    tags: ["aldea", "chakur", "uldum", "sindra", "mercante"],
    summary: "Cruce de caminos entre Khazgard y Ailenor donde mercaderes enanos y élficos comercian bajo contrato formal, más institucional que la convivencia cotidiana de Piedraverde.",
    region: "Chakur, Uldum, Sindra",
    gobierno: "Cámara de comercio mixta",
    religionPredominante: "",
    lugaresDestacados: [],
    content: `
      <p>A diferencia de Piedraverde, donde enanos y elfos conviven día a
      día bajo un mismo techo, El Cruce existe únicamente para el comercio,
      un mercado permanente donde caravanas de ambas capitales intercambian
      bienes bajo contratos redactados y sellados por una cámara mixta.
      Nadie vive aquí de forma permanente, solo mercaderes, escribas y los
      guardias que ambas partes rotan cada temporada.</p>
      <p>Los contratos de El Cruce tienen fama de ser los documentos más
      precisos de todo Chakur, escritos para prevenir cualquier disputa que
      pudiera escalar innecesariamente entre dos pueblos que ya tienen
      suficientes motivos históricos para desconfiar el uno del otro.
      Romper un contrato firmado aquí arruina la reputación comercial de un
      mercader en ambas capitales a la vez, un castigo que ningún gremio
      toma a la ligera.</p>
    `
  },
  {
    id: "raiz-de-los-ancestros",
    title: "Raíz de los Ancestros",
    category: "Lugares",
    tags: ["naturaleza", "chakur", "uldum", "sindra", "elfos"],
    summary: "Arboleda sagrada donde los elfos de Chakur entierran a sus muertos entre las raíces de árboles centenarios, considerada la memoria viva del pueblo élfico.",
    region: "Chakur, Uldum, Sindra",
    gobierno: "Guardianes del Neravismo",
    religionPredominante: "Neravismo",
    lugaresDestacados: [],
    content: `
      <p>Cada elfo de Chakur espera, en teoría, terminar enterrado entre las
      raíces de esta arboleda, donde generaciones de cuerpos se han
      integrado tan por completo al suelo que los propios sacerdotes del
      Neravismo aseguran poder sentir la presencia de los ancestros en la
      savia de los árboles más viejos. No es una creencia que se discuta
      abiertamente con forasteros.</p>
      <p>Los Guardianes que cuidan el lugar deciden quién puede ser
      enterrado aquí y quién no, una autoridad que ni siquiera el consejo de
      Ailenor cuestiona en público. Elfos exiliados o deshonrados durante la
      vida no suelen lograr ese privilegio final, sin importar cuánto lo
      hayan pedido antes de morir.</p>
    `
  },
  {
    id: "salon-de-los-reyes-perdidos",
    title: "Salón de los Reyes Perdidos",
    category: "Lugares",
    tags: ["aldea", "chakur", "uldum", "sindra", "enanos"],
    summary: "Cripta subterránea con las tumbas de los reyes enanos previos a la guerra, sellada durante siglos y reabierta solo tras el regreso del pueblo enano a Chakur.",
    region: "Chakur, Uldum, Sindra",
    gobierno: "Guardianes del Neravismo",
    religionPredominante: "Neravismo",
    lugaresDestacados: [],
    content: `
      <p>Los enanos que regresaron a Chakur tras la expansión de Balutia
      encontraron esta cripta exactamente como sus antepasados la habían
      sellado generaciones antes de que la guerra terminara de destruir la
      civilización compartida, con las tumbas de los antiguos reyes intactas
      y sin profanar. Reabrirla se consideró, en su momento, la prueba más
      clara de que el pueblo enano finalmente había vuelto a casa.</p>
      <p>Hoy el Salón se abre solo para coronaciones simbólicas y funerales
      de figuras excepcionales, ceremonias que Khazgard organiza con una
      solemnidad que no dedica a ningún otro lugar de la capital. Los elfos
      de Ailenor, invitados por cortesía a las ceremonias más importantes,
      entran siempre sin armas, un gesto que ambos pueblos entienden sin
      necesidad de explicarlo.</p>
    `
  },
  {
    id: "minas-de-luzverde",
    title: "Minas de Luzverde",
    category: "Lugares",
    tags: ["naturaleza", "chakur", "uldum", "sindra", "enanos", "elfos"],
    summary: "Yacimiento de gemas bajo una arboleda sagrada élfica, fuente de tensión constante entre los mineros enanos que quieren explotarlo y los elfos que protegen la superficie.",
    region: "Chakur, Uldum, Sindra",
    gobierno: "Disputado",
    religionPredominante: "Neravismo",
    lugaresDestacados: [],
    content: `
      <p>Las gemas que se encuentran bajo Minas de Luzverde figuran entre
      las más valiosas de Chakur, lo que no ha impedido que la explotación
      formal del yacimiento lleve décadas detenida. Los túneles necesarios
      pasarían directamente bajo una arboleda que los elfos consideran
      sagrada desde antes de la guerra, y los enanos de Kroth-Baraz presionan
      con más insistencia que Khazgard para autorizar la extracción.</p>
      <p>Cada cierto tiempo, algún cantero ambicioso intenta abrir un túnel
      sin permiso, y cada vez los guardianes élficos lo detectan antes de
      que avance demasiado. El conflicto no ha escalado a violencia abierta
      todavía, pero ambas capitales lo tratan como uno de los puntos más
      frágiles de su paz, uno de los pocos donde un solo incidente mal
      manejado podría deshacer generaciones de reconstrucción.</p>
    `
  }
];
