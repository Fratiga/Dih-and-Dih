window.FACCIONES = [
  {
    id: "iglesia-de-asmodeo",
    title: "Iglesia de Asmodeo",
    category: "Facciones",
    tags: ["orden religiosa", "asmodeo", "roah", "kaneísmo"],
    summary: "La principal organización religiosa de la Teocracia de Asmodeo.",
    tipo: "Orden Religiosa",
    region: "Asmodeo, Roah, Gylas",
    ideologia: "La rama más rígida y humanocéntrica del Kaneísmo: la misma luz para el rey y el mendigo, siempre que el mendigo sea humano.",
    miembrosConocidos: [],
    relaciones: [
      { id: "kaneismo", signo: "Rama disidente de" },
      { id: "peregrinos-del-alba", signo: "Rivalidad doctrinal" },
      { id: "fyre", signo: "Asedio permanente" },
      { id: "catedral-del-juramento", signo: "Misión bajo juramento de no proselitismo" }
    ],
    content: `
      <p>La principal organización religiosa de la Teocracia de Asmodeo controla la
      formación de paladines, inquisidores y clérigos, además de ejercer una enorme
      influencia política fuera de sus fronteras. Formalmente es una rama del
      Kaneísmo, la fe solar practicada en toda Roah, pero una rama que interpretó
      "la misma luz para el rey y el mendigo" como una promesa reservada
      exclusivamente a los mendigos humanos. Esa lectura, considerada herética o
      directamente vergonzosa por gran parte del resto de la región, es
      precisamente la que sostiene el poder político de Asmodeo.</p>
      <p>Generación tras generación de sus paladines mantiene el cerco sobre Fyre,
      la ciudad tomada por el rey demonio en el extremo norte del reino, una guerra
      que la Iglesia describe como su propósito más sagrado y que en la práctica
      nunca termina de resolverse. Fuera de sus fronteras sostiene misiones en
      territorios donde su fe no es mayoría, incluida una catedral en Brurland
      cuyos clérigos deben jurar públicamente no imponer el Kaneísmo sobre el
      Mortismo local, un compromiso que la propia Iglesia respeta con la misma
      rigidez que aplica a todo lo demás.</p>
    `
  },
  {
    id: "peregrinos-del-alba",
    title: "Los Peregrinos del Alba",
    category: "Facciones",
    tags: ["orden religiosa", "kaneísmo", "itinerante"],
    summary: "La rama mayoritaria del Kaneísmo, itinerante y sin fronteras propias.",
    tipo: "Orden Religiosa",
    region: "Roah, Gylas",
    ideologia: "La lectura mayoritaria del Kaneísmo: la misma luz alcanza por igual al rey y al mendigo, sin importar su raza.",
    miembrosConocidos: [],
    relaciones: [
      { id: "kaneismo", signo: "Rama mayoritaria de" },
      { id: "iglesia-de-asmodeo", signo: "Rivalidad doctrinal" }
    ],
    content: `
      <p>Una orden independiente que viaja entre reinos ayudando a víctimas de
      guerras, plagas y desastres naturales, sin cobrar por su auxilio ni preguntar
      la fe o la raza de quien lo recibe. Son respetados incluso por naciones
      enemigas entre sí, un privilegio que ninguna otra institución religiosa de
      Roah conserva intacto.</p>
      <p>Los Peregrinos sostienen la lectura del Kaneísmo que la Iglesia de Asmodeo
      abandonó hace generaciones: que la misma luz alcanza por igual al rey y al
      mendigo, sin la salvedad humana que Asmodeo añadió a la doctrina original.
      Esa diferencia casi nunca se discute en público, pero cualquier peregrino sabe
      que cruzar hacia Asmodeo significa moderar ese principio o arriesgarse a que
      sus propios clérigos les cierren las puertas.</p>
    `
  },
  {
    id: "caballeros-del-reino",
    title: "Los Caballeros del Reino",
    category: "Facciones",
    tags: ["orden militar", "brurland", "mortismo"],
    summary: "La élite militar de Brurland, atada por juramento a recuperar Broneland.",
    tipo: "Orden Militar",
    region: "Brurland, Derrovia, Gylas",
    ideologia: "El honor de un caballero se mide por lo que defiende, no por lo que conquista; recuperar Broneland es la prueba que todavía tienen pendiente.",
    miembrosConocidos: [],
    relaciones: [
      { id: "mortismo", signo: "Fe oficial de la orden" },
      { id: "osses", signo: "Enemigo declarado" },
      { id: "resistencia-de-broneland", signo: "Contacto informal, nunca reconocido" }
    ],
    content: `
      <p>La élite militar de Brurland. Solo los guerreros más distinguidos pueden
      aspirar a convertirse en héroes del reino, un honor que se concede en público
      mediante ceremonias que combinan tradición marcial con los ritos funerarios
      del Mortismo, la fe ancestral del reino.</p>
      <p>Desde la ocupación de Broneland por la Unión de Osses, la orden carga con
      una herida que ningún tratado ha cerrado. Cada caballero jura, al
      ser investido, recuperar algún día el territorio perdido, aunque la Corona
      brurlandesa evita oficialmente cualquier acción abierta que pudiera
      reencender la guerra. Algunos caballeros, extraoficialmente, sostienen
      contacto con la resistencia clandestina que opera desde Piedrablanca, un
      vínculo que ni el reino ni la orden reconocerían jamás en público.</p>
    `
  },
  {
    id: "vigilias-del-muro",
    title: "Los Vigilantes de la Grieta",
    category: "Facciones",
    tags: ["orden militar", "rasganorte", "thanea"],
    summary: "Antigua orden goliat que vigila las profundas grietas de Rasganorte y lo que podría seguir dormido bajo el hielo.",
    tipo: "Orden Militar",
    region: "Rasganorte, Thanea",
    ideologia: "Algo mucho más antiguo que la humanidad sigue latente bajo el hielo de Rasganorte, y alguien debe seguir vigilando aunque nadie más lo recuerde.",
    miembrosConocidos: [],
    relaciones: [
      { id: "rasganorte", signo: "Territorio que vigilan" },
      { id: "vardun-helada", signo: "Ruina bajo vigilancia constante" },
      { id: "circulo-de-los-cuatro", signo: "Aliados distantes" }
    ],
    content: `
      <p>Una antigua orden que vigila las profundas grietas que dan nombre a
      Rasganorte, convencida de que las civilizaciones sepultadas bajo el hielo, las
      mismas que levantan la Ciudadela de Hueso con restos de criaturas colosales o
      que permanecen intactas bajo Vardun Helada, no son simples ruinas muertas
      sino algo que todavía podría despertar. Los propios goliats de la región, que
      evitan Vardun por costumbre más que por miedo declarado, consideran a los
      Vigilantes exagerados casi tanto como los respetan.</p>
      <p>Reclutan casi exclusivamente entre goliats dispuestos a pasar años enteros
      en puestos remotos, escuchando crujidos que ningún viento debería producir y
      registrando cualquier cambio en el hielo que cubre las ruinas. El Círculo de
      los Cuatro, preocupado por señales similares en otras partes de Thanea,
      mantiene contacto ocasional con la orden, aunque ambos grupos interpretan la
      amenaza de formas distintas.</p>
    `
  },
  {
    id: "guardia-imperial-balutiana",
    title: "La Guardia Imperial Balutiana",
    category: "Facciones",
    tags: ["orden militar", "balutia", "kretor"],
    summary: "El ejército profesional permanente del Imperio de Balutia.",
    tipo: "Orden Militar",
    region: "Imperio de Balutia, Kretor, Sindra",
    ideologia: "La autoridad imperial se sostiene con soldados leales antes que con leyes, y la Guardia existe para que nunca falten.",
    miembrosConocidos: [],
    relaciones: [
      { id: "el-semillero", signo: "Fuente principal de reclutas" },
      { id: "praesidium", signo: "Tensión con la Novena Legión" },
      { id: "yunque-ardiente", signo: "Proveedor de equipo" }
    ],
    content: `
      <p>El ejército profesional permanente del Imperio de Balutia. No son
      simplemente soldados; representan la autoridad imperial allí donde pisan, y
      su disciplina se forja deliberadamente antes de que un recluta complete su
      primer año de servicio.</p>
      <p>Gran parte de sus filas nuevas llega, generación tras generación, desde
      instituciones como El Semillero, que entrega a la Guardia jóvenes que ya no
      conocen otra familia que la legión. Ese flujo constante de reclutas
      entrenados desde la infancia la mantiene numerosa, pero también alimenta un
      malestar creciente hacia generales como Maxencio Ilyth, cuya Novena Legión en
      Praesidium responde a él antes que a la Corona.</p>
    `
  },
  {
    id: "las-comadrejas",
    title: "Las Comadrejas",
    category: "Facciones",
    tags: ["criminal", "mercenarios"],
    summary: "Una banda de mercenarios especializados en capturar fugitivos.",
    tipo: "Criminal",
    region: "",
    ideologia: "",
    miembrosConocidos: ["rook", "bull", "garra", "baraja"],
    relaciones: [
      { id: "mercado-gris", signo: "Cliente de confianza" }
    ],
    content: `
      <p>Una banda de mercenarios especializados en capturar fugitivos. Su
      reputación proviene de cumplir cualquier encargo siempre que el precio sea
      suficiente, sin hacer preguntas sobre qué hizo el fugitivo para merecer la
      persecución.</p>
      <p>Rook, Bull, Garra y Baraja trabajan juntos desde hace años con una
      coordinación que ninguna banda rival de su tamaño ha logrado igualar. Se
      mueven por contactos informales antes que por contratos formales, y el
      Mercado Gris figura entre las pocas redes que confían en pagarles sin
      garantías por adelantado.</p>
    `
  },
  {
    id: "cofradia-del-carbon",
    title: "La Cofradía del Carbón",
    category: "Facciones",
    tags: ["criminal", "nigredo", "contrabando", "nikaalia"],
    summary: "Una red criminal especializada en contrabando de Nigredo, armas prohibidas y reliquias.",
    tipo: "Criminal",
    region: "Internacional, Nikaalia",
    ideologia: "",
    miembrosConocidos: [],
    relaciones: [
      { id: "recolectores-de-nigredo", signo: "Contrabandea lo que ellos extraen legalmente" },
      { id: "boca-oxido", signo: "Ruta de distribución" },
      { id: "hijos-del-vacio", signo: "Cliente recurrente" }
    ],
    content: `
      <p>Una red criminal especializada en contrabando de Nigredo, armas prohibidas
      y reliquias antiguas, que opera en prácticamente todos los continentes
      gracias a una estructura celular que ningún gobierno ha logrado desmantelar
      por completo.</p>
      <p>Gran parte de su mercancía sale de yacimientos que Los Recolectores de
      Nigredo consideran legalmente suyos, desviada antes de que llegue a
      registrarse en los libros oficiales. Boca Óxido, con sus bandas y su falta de
      autoridad central, funciona como una de sus rutas de distribución favoritas,
      y los Hijos del Vacío pagan sin preguntas por cualquier fragmento que la
      Cofradía consiga sacar de circulación legal.</p>
    `
  },
  {
    id: "mercado-gris",
    title: "El Mercado Gris",
    category: "Facciones",
    tags: ["criminal", "kalvia"],
    summary: "Una red de comerciantes ilegales donde cualquier cosa puede comprarse.",
    tipo: "Criminal",
    region: "",
    ideologia: "",
    miembrosConocidos: [],
    relaciones: [
      { id: "las-comadrejas", signo: "Cliente de confianza" },
      { id: "cambalache", signo: "Uno de sus nodos" }
    ],
    content: `
      <p>No es una organización centralizada, sino una red de comerciantes
      ilegales donde cualquier cosa puede comprarse, siempre que el comprador esté
      dispuesto a pagar y no haga demasiadas preguntas sobre la procedencia.</p>
      <p>Cambalache, a las afueras de Aurelport, funciona como uno de sus nodos más
      activos, un lugar que el propio Príncipe Mercante prefiere no cerrar porque
      casi todo lo que ahí se mueve termina alimentando el comercio legal que sí
      paga impuestos. Las Comadrejas figuran entre sus clientes habituales, tanto
      para conseguir información sobre un fugitivo como para revender lo que
      recuperan junto con él.</p>
    `
  },
  {
    id: "instituto-de-artificieros-de-nernib",
    title: "Instituto de Artificieros de Nernib",
    category: "Facciones",
    tags: ["investigación", "tecnología", "nernib", "heliurgia"],
    summary: "La organización científica más prestigiosa del mundo, brazo de investigación de la Heliurgia.",
    tipo: "Investigación",
    region: "Nernib, Merador, Sindra",
    ideologia: "Brazo de investigación de la Heliurgia: cada invento es la creación continuando aquello que todavía no ha terminado.",
    miembrosConocidos: [],
    relaciones: [
      { id: "heliurgia", signo: "Expresión institucional de" },
      { id: "academia-arcana-de-dolbred", signo: "Rivalidad metodológica" },
      { id: "cantera-de-bronce", signo: "Proveedor de materia prima" }
    ],
    content: `
      <p>La organización científica más prestigiosa del mundo. Muchos de los
      mayores inventos modernos nacieron entre sus laboratorios, financiados por
      una oligarquía de artificieros que gobierna Nernib porque allí la
      innovación vale más que la nobleza.</p>
      <p>El Instituto funciona, de hecho, como el brazo de investigación de la
      Heliurgia, la fe que sostiene que la creación todavía no ha terminado y que
      cada autómata o motor de vapor continúa esa obra inacabada. A diferencia de
      la Academia Arcana de Dolbred, que persigue el conocimiento mágico por sí
      mismo, el Instituto exige que cada descubrimiento produzca algo utilizable,
      una diferencia que ha generado más de un desprecio mutuo entre ambas
      instituciones.</p>
    `
  },
  {
    id: "academia-arcana-de-dolbred",
    title: "Academia Arcana de Dolbred",
    category: "Facciones",
    tags: ["investigación", "magia", "dolbred", "quitinismo"],
    summary: "La mayor concentración de archimagos del mundo conocido.",
    tipo: "Investigación",
    region: "Dolbred, Roah, Gylas",
    ideologia: "",
    miembrosConocidos: [],
    relaciones: [
      { id: "quitinismo", signo: "Debate doctrinal permanente" },
      { id: "instituto-de-artificieros-de-nernib", signo: "Rivalidad metodológica" },
      { id: "el-crater", signo: "Sede de investigación" }
    ],
    content: `
      <p>La mayor concentración de archimagos del mundo conocido. Sus
      investigaciones casi nunca abandonan el reino, pero sus descubrimientos
      terminan cambiando la magia de todo el continente, filtrándose despacio a
      través de manuales, aprendices itinerantes y el ocasional archimago
      exiliado. La serie de tratados "Fundamentos de..." que circula por
      bibliotecas y academias de medio mundo sale íntegramente de sus prensas, y
      cualquier erudito que cite "Dolbred" como autoridad se refiere, en la
      práctica, a esta institución.</p>
      <p>Mantiene un debate que lleva generaciones sin resolverse con el
      Quitinismo de Mravec, cuyos sacerdotes coinciden con Dolbred en casi todo lo
      técnico sobre cómo funciona un hechizo y discrepan por completo sobre si
      comprender ese mecanismo otorga derecho a usarlo sin límites. La propia
      Academia se divide internamente en la misma línea, algo que sus profesores
      más veteranos prefieren no mencionar frente a estudiantes nuevos.</p>
    `
  },
  {
    id: "fundacion-dexter",
    title: "Instituto Vesalio",
    category: "Facciones",
    tags: ["investigación", "secreta", "balutia"],
    summary: "Una institución médica financiada por la Corona balutiana, con propósitos poco claros.",
    tipo: "Investigación",
    region: "Imperio de Balutia, Kretor, Sindra",
    ideologia: "",
    miembrosConocidos: [],
    relaciones: [
      { id: "el-semillero", signo: "Fuente de sujetos de estudio no declarados" },
      { id: "guardia-imperial-balutiana", signo: "Financiamiento indirecto de la Corona" }
    ],
    content: `
      <p>Una institución médica financiada por la Corona. Oficialmente investiga
      enfermedades, mutaciones y métodos para prolongar la vida útil de un soldado
      en campaña. Muy pocos conocen lo que realmente ocurre en sus instalaciones, y
      quienes lo saben rara vez lo repiten dos veces.</p>
      <p>Corren rumores, nunca confirmados ni desmentidos con la fuerza suficiente
      para acabar con ellos, de que el Instituto recibe algo más que informes desde
      El Semillero, y de que no todos los huérfanos que desaparecen de sus
      registros terminan efectivamente en una legión. La Corona, cuando se le
      pregunta directamente, siempre da la misma respuesta, que la guerra exige
      sacrificios que no siempre pueden explicarse en público.</p>
    `
  },
  {
    id: "cartografos-del-horizonte",
    title: "Cartógrafos del Horizonte",
    category: "Facciones",
    tags: ["exploración", "internacional"],
    summary: "Organización internacional dedicada a cartografiar territorios desconocidos.",
    tipo: "Exploración",
    region: "Internacional",
    ideologia: "",
    miembrosConocidos: [],
    relaciones: [
      { id: "archivo-de-las-rutas", signo: "Rivalidad profesional" },
      { id: "sociedad-del-sexto-sol", signo: "Colaboración ocasional" }
    ],
    content: `
      <p>Una organización internacional dedicada a cartografiar territorios
      desconocidos. Muchos mueren antes de completar una expedición, y quienes
      regresan pocas veces lo hacen con el mapa completo que salieron a buscar.</p>
      <p>A diferencia de El Archivo de las Rutas de Kalvia, que guarda sus cartas
      como secreto comercial, los Cartógrafos publican cada hallazgo verificado sin
      cobrar por el acceso, una filosofía que los mantiene pobres pero también les
      garantiza un reconocimiento académico que ningún gremio mercante podría
      comprarles. La rivalidad entre ambas instituciones es más filosófica que
      hostil, aunque ningún cartógrafo del Horizonte aceptaría trabajar para Kalvia
      sin sentir que traiciona algo.</p>
    `
  },
  {
    id: "sociedad-del-sexto-sol",
    title: "Sociedad del Sexto Sol",
    category: "Facciones",
    tags: ["exploración", "arqueología"],
    summary: "Exploradores obsesionados con encontrar civilizaciones anteriores a la humanidad.",
    tipo: "Exploración",
    region: "",
    ideologia: "",
    miembrosConocidos: [],
    relaciones: [
      { id: "ruinas-de-kharzun-vael", signo: "Objeto de estudio" },
      { id: "vardun-helada", signo: "Objeto de estudio" },
      { id: "academia-arcana-de-dolbred", signo: "Escepticismo académico mutuo" }
    ],
    content: `
      <p>Exploradores obsesionados con encontrar civilizaciones anteriores a la
      humanidad. Gran parte de la comunidad académica los considera excéntricos,
      una reputación que la propia Sociedad hace poco por desmentir.</p>
      <p>Ruinas como Kharzun-Vael en Chakur o Vardun Helada bajo el hielo de
      Rasganorte figuran entre sus destinos favoritos, no porque esas
      civilizaciones sean necesariamente anteriores a la humanidad, sino porque
      cualquier ruina lo bastante antigua alimenta su teoría favorita. La Academia
      Arcana de Dolbred financia ocasionalmente sus expediciones, más por
      curiosidad genuina que por confianza en sus conclusiones.</p>
    `
  },
  {
    id: "recolectores-de-nigredo",
    title: "Los Recolectores de Nigredo",
    category: "Facciones",
    tags: ["exploración", "nigredo", "internacional"],
    summary: "Ingenieros, alquimistas y mineros dedicados a explotar los géiseres de Nigredo.",
    tipo: "Exploración",
    region: "Internacional",
    ideologia: "",
    miembrosConocidos: [],
    relaciones: [
      { id: "cofradia-del-carbon", signo: "Contrabandea su producción" },
      { id: "nikaalia", signo: "Mayor yacimiento conocido" },
      { id: "umbrismo", signo: "Tensión religiosa por el manejo del recurso" }
    ],
    content: `
      <p>Una organización de ingenieros, alquimistas y mineros dedicada a explotar
      los géiseres de Nigredo alrededor del mundo. Su trabajo sostiene gran parte
      de la economía moderna, desde la iluminación de Umbrathil hasta una porción
      considerable del comercio químico de Ornamen.</p>
      <p>Nikaalia sigue siendo su yacimiento más grande y mejor documentado, aunque
      operar bajo el domo exige convivir con un Umbrismo que ve el Nigredo como
      síntoma de una Herida antigua, no como simple recurso. La Cofradía del Carbón
      desvía una fracción constante de su producción hacia el mercado negro, una
      fuga que los Recolectores conocen bien y jamás han logrado detener del
      todo.</p>
    `
  },
  {
    id: "compania-dorada",
    title: "Compañía Dorada",
    category: "Facciones",
    tags: ["mercenarios", "internacional"],
    summary: "El ejército mercenario más grande del continente.",
    tipo: "Mercenarios",
    region: "",
    ideologia: "",
    miembrosConocidos: [],
    relaciones: [
      { id: "thrandheim", signo: "Contrato reciente" },
      { id: "herederos-de-tarrena", signo: "Contratados en el pasado" }
    ],
    content: `
      <p>El ejército mercenario más grande del continente. Han servido
      prácticamente a todas las naciones importantes, incluso enfrentándose en
      distintas campañas a antiguos clientes sin que eso afecte demasiado su
      reputación.</p>
      <p>Su contrato más reciente y comentado los llevó a Har, donde ayudaron al
      jarl Thrandulf de Thrandheim a consolidar varios juramentos de vasallaje
      disputados, un trabajo que la Compañía completó sin involucrarse en absoluto
      en la política interna de la alianza. Los Herederos de Tarrena, mucho antes,
      también recurrieron a sus servicios para presionar la reunificación de Fel y
      Cudbusland, sin resultado duradero.</p>
    `
  },
  {
    id: "hijos-del-acero",
    title: "Hijos del Acero",
    category: "Facciones",
    tags: ["mercenarios", "cazamonstruos"],
    summary: "Mercenarios especializados exclusivamente en cazar monstruos.",
    tipo: "Mercenarios",
    region: "",
    ideologia: "",
    miembrosConocidos: [],
    relaciones: [
      { id: "escuelas-de-kaishoto", signo: "Recluta egresados ocasionales" }
    ],
    content: `
      <p>Mercenarios especializados exclusivamente en cazar monstruos. Aceptan
      contratos que incluso los ejércitos regulares rechazan, desde guivernos que
      amenazan rutas comerciales hasta amenazas mucho más antiguas que nadie más
      está dispuesto a enfrentar.</p>
      <p>Entre sus cacerías más citadas figura la de Rykerd, El Imperdonable, una
      bestia que dejó tras de sí suficientes cadáveres de cazadores anteriores como
      para que la Compañía cobrara, según se dice, el triple de su tarifa habitual
      antes de aceptar el encargo. Historias como esa sostienen su reputación mejor
      que cualquier anuncio formal.</p>
    `
  },
  {
    id: "consejo-del-eclipse",
    title: "El Consejo del Eclipse",
    category: "Facciones",
    tags: ["secreta"],
    summary: "Una sociedad secreta formada por nobles, comerciantes y altos funcionarios.",
    tipo: "Secreta",
    region: "",
    ideologia: "",
    miembrosConocidos: [],
    relaciones: [
      { id: "el-semillero", signo: "Beneficiario oculto sospechado" },
      { id: "praesidium", signo: "Influencia sospechada" }
    ],
    content: `
      <p>Una sociedad secreta formada por nobles, comerciantes y altos
      funcionarios. Nadie sabe realmente qué persiguen, pero suelen aparecer detrás
      de grandes acontecimientos políticos, siempre lo bastante lejos del centro
      como para que nada se les pueda probar.</p>
      <p>Algunos investigadores independientes sostienen que el Consejo tiene
      interés directo en que las fronteras de Balutia sigan ardiendo con la
      regularidad suficiente para mantener llena una institución como El
      Semillero, aunque ninguna prueba sólida respalda esa teoría más allá de la
      coincidencia. Otros los sitúan más cerca de generales ambiciosos como
      Maxencio Ilyth que de la propia Corona, algo que tampoco se ha podido
      confirmar jamás.</p>
    `
  },
  {
    id: "custodios-del-pozo",
    title: "Los Custodios del Pozo",
    category: "Facciones",
    tags: ["secreta", "dragones", "relania"],
    summary: "El círculo interno y secreto del Culto al Pozo de la Eternidad.",
    tipo: "Secreta",
    region: "Relania, Uldum, Sindra",
    ideologia: "Ni siquiera el Culto entero necesita saber todo lo que de verdad ocurre en el Pozo.",
    miembrosConocidos: [],
    relaciones: [
      { id: "culto-al-pozo-de-la-eternidad", signo: "Círculo interno de" },
      { id: "ethelgard", signo: "Base de operaciones discreta" },
      { id: "pozo-de-la-eternidad", signo: "Objeto de vigilancia" }
    ],
    content: `
      <p>Un reducido grupo de guardianes que vive prácticamente dentro de
      Ethelgard sin que la mayoría de sus habitantes sepa distinguirlos del resto
      del clero del Culto al Pozo de la Eternidad. Su función real no es tanto
      impedir que alguien perturbe el descanso de los dragones, algo que el propio
      Culto ya vigila abiertamente, sino ocultar qué ocurre en los casos, poco
      frecuentes pero documentados, en que ese descanso no resulta tan definitivo
      como todos prefieren creer.</p>
      <p>Se reclutan exclusivamente entre los sacerdotes de mayor confianza del
      Culto, y ni siquiera el resto de la jerarquía religiosa conoce con certeza
      sus verdaderas funciones. Los rumores más persistentes hablan de fragmentos
      óseos que despiertan solos, aunque ningún Custodio ha confirmado ni
      desmentido jamás esas historias.</p>
    `
  },
  {
    id: "herederos-de-tarrena",
    title: "Los Herederos de Tarrena",
    category: "Facciones",
    tags: ["secreta", "tarrena", "fel", "cudbusland"],
    summary: "Descendientes, nobles y simpatizantes del desaparecido Reino de Tarrena.",
    tipo: "Secreta",
    region: "Fel / Cudbusland, Derrovia, Gylas",
    ideologia: "Reunificar Fel y Cudbusland bajo una única bandera.",
    miembrosConocidos: [],
    relaciones: [
      { id: "fel", signo: "Territorio que reclaman" },
      { id: "cudbusland", signo: "Territorio que reclaman" },
      { id: "compania-dorada", signo: "Contratados en el pasado" }
    ],
    content: `
      <p>Descendientes, nobles y simpatizantes del desaparecido Reino de Tarrena.
      Sueñan con reunificar Fel y Cudbusland bajo una única bandera, algo que
      ninguno de los dos estados sucesores muestra el menor interés en discutir.</p>
      <p>Fel, con su producción industrial en masa, y Cudbusland, apostado por un
      desarrollo gradual centrado en talleres como Telarfina, se han distanciado
      tanto en generaciones separadas que muchos de sus propios habitantes
      consideran la reunificación una fantasía nostálgica sin base real. Los
      Herederos contrataron alguna vez a la Compañía Dorada para presionar la causa
      por otros medios, un intento que terminó sin resultados y con una factura que
      la orden tardó años en pagar.</p>
    `
  },
  {
    id: "hermandad-del-ultimo-hombre",
    title: "La Hermandad del Último Hombre",
    category: "Facciones",
    tags: ["filosófica"],
    summary: "Filósofos que sostienen que todas las razas inteligentes desaparecerán excepto una.",
    tipo: "Filosófica",
    region: "",
    ideologia: "Todas las razas inteligentes terminarán desapareciendo excepto una.",
    miembrosConocidos: [],
    relaciones: [
      { id: "chakur", signo: "Caso de estudio citado" },
      { id: "har", signo: "Caso de estudio citado" }
    ],
    content: `
      <p>Un grupo de filósofos que sostiene que todas las razas inteligentes
      terminarán desapareciendo excepto una. Recorren el mundo recopilando
      conocimientos para preservar aquello que consideran digno de sobrevivir, sin
      ponerse nunca de acuerdo entre ellos sobre cuál de las razas actuales tiene
      más probabilidades de ser la última.</p>
      <p>Citan con frecuencia a Chakur, donde una guerra antigua estuvo a punto de
      borrar por completo tanto a enanos como a elfos, y a Har, donde la propia
      alianza cambia de forma casi cada temporada, como pruebas de que ninguna
      civilización es tan permanente como cree serlo. Sus críticos señalan que la
      Hermandad nunca ha arriesgado nada propio para comprobar sus teorías, solo
      las ha documentado desde una distancia cómoda.</p>
    `
  },
  {
    id: "hijos-del-vacio",
    title: "Los Hijos del Vacío",
    category: "Facciones",
    tags: ["filosófica", "nigredo", "cultistas"],
    summary: "Cultistas fascinados por el Nigredo que buscan la evolución de la humanidad, no su destrucción.",
    tipo: "Filosófica",
    region: "",
    ideologia: "La humanidad debe evolucionar hasta convertirse en algo completamente distinto.",
    miembrosConocidos: [],
    relaciones: [
      { id: "umbrismo", signo: "Interpretación herética de" },
      { id: "cofradia-del-carbon", signo: "Cliente recurrente" }
    ],
    content: `
      <p>Cultistas fascinados por el Nigredo y las criaturas del Vacío. No desean
      destruir el mundo. Creen que la humanidad debe evolucionar hasta convertirse
      en algo completamente distinto, y ven cada mutación provocada por el Nigredo
      como un paso adelante en lugar de una tragedia.</p>
      <p>Los sacerdotes del Umbrismo los consideran una lectura herética y
      peligrosa de su propia fe: donde el Umbrismo ve la Herida como algo que debe
      comprenderse y repararse, los Hijos del Vacío la ven como una oportunidad que
      debe acelerarse. Pagan generosamente a la Cofradía del Carbón por cualquier
      fragmento de Nigredo lo bastante inestable como para que ningún comprador
      legítimo lo toque.</p>
    `
  },
  {
    id: "circulo-de-los-cuatro",
    title: "El Círculo de los Cuatro",
    category: "Facciones",
    tags: ["filosófica", "elementales", "thanea"],
    summary: "Druidas y chamanes que intentan mantener el equilibrio entre los cuatro elementos.",
    tipo: "Filosófica",
    region: "Galadhel, Thanea",
    ideologia: "Mantener el equilibrio entre los cuatro elementos.",
    miembrosConocidos: [],
    relaciones: [
      { id: "vigilias-del-muro", signo: "Aliados distantes" },
      { id: "elementales", signo: "Vínculo espiritual" }
    ],
    content: `
      <p>Druidas y chamanes que intentan mantener el equilibrio entre los cuatro
      elementos. Ven con preocupación el crecimiento del Nigredo y consideran que
      los Señores Elementales se encuentran cada vez más desequilibrados, una
      tendencia que atribuyen a siglos de mortales explotando el fuego, el agua, la
      tierra y el aire sin devolver nada a cambio.</p>
      <p>Mantienen contacto ocasional con Los Vigilantes de la Grieta de
      Rasganorte, convencidos de que las civilizaciones sepultadas bajo el hielo
      thaneano y el desequilibrio elemental que ellos vigilan comparten, en algún
      nivel que ninguno de los dos grupos ha logrado demostrar todavía, un mismo
      origen.</p>
    `
  },
  {
    id: "culto-al-pozo-de-la-eternidad",
    title: "El Culto al Pozo de la Eternidad",
    category: "Facciones",
    tags: ["orden religiosa", "dragones", "relania"],
    summary: "La autoridad religiosa que gobierna el cementerio de dragones de Relania y todo lo que lo rodea.",
    tipo: "Orden Religiosa",
    region: "Relania, Uldum, Sindra",
    ideologia: "Los dragones no dejan de ser sagrados por estar muertos; lo que descansa en el Pozo merece el mismo silencio que se guarda ante uno vivo.",
    miembrosConocidos: [],
    relaciones: [
      { id: "ethelgard", signo: "Sede principal" },
      { id: "pozo-de-la-eternidad", signo: "Objeto de culto" },
      { id: "osario-del-comercio", signo: "Regula el comercio de huesos" },
      { id: "picos-del-osario", signo: "Autoriza expediciones de catalogación" },
      { id: "cumbre-de-los-primeros", signo: "Santuario reconocido" },
      { id: "custodios-del-pozo", signo: "Círculo interno secreto" }
    ],
    content: `
      <p>Nacido alrededor del Pozo de la Eternidad, el inmenso cráter de Relania
      donde los dragones del mundo llegan a morir, el Culto gobierna en la
      práctica la vida religiosa de Ethelgard y una parte considerable de la
      política regional que rodea al cementerio. No predica una fe separada de las
      demás tanto como una autoridad práctica: decide qué expediciones de
      catalogación entran a Picos del Osario, qué fragmentos óseos pueden venderse
      legalmente en el Osario del Comercio bajo su sello, y qué santuarios menores,
      como La Muda en las montañas heladas, merecen reconocimiento formal.</p>
      <p>Dentro de su jerarquía pública opera un círculo mucho más reducido y
      menos discutido, los Custodios del Pozo, reclutados entre los sacerdotes de
      mayor confianza para ocuparse de aquello que el Culto prefiere no explicar ni
      siquiera a sus propios fieles. La mayoría de los relanianos nunca nota la
      diferencia entre ambos grupos, y el Culto se asegura de que siga siendo
      así.</p>
    `
  },
  {
    id: "familia-var-ossyn",
    title: "La Familia Var Ossyn",
    category: "Facciones",
    tags: ["criminal", "nikaalia"],
    summary: "La familia criminal que gobierna en secreto la ciudad de El Espejismo bajo fachada de consorcio de ocio.",
    tipo: "Criminal",
    region: "Nikaalia, Uldum, Sindra",
    ideologia: "La lealtad se hereda, no se jura, y una guerra que nadie ve nunca sucedió.",
    miembrosConocidos: [],
    relaciones: [
      { id: "el-espejismo", signo: "Territorio y fachada" },
      { id: "los-estratos", signo: "Rivalidad discreta" },
      { id: "boca-oxido", signo: "Desprecio mutuo declarado" },
      { id: "gremio-de-las-sombras", signo: "Tregua comercial forzada" }
    ],
    content: `
      <p>Detrás de los garitos, licores importados y fumaderos de El Espejismo, la
      ciudad entera responde a la Familia Var Ossyn, que se presenta ante
      forasteros y funcionarios como un consorcio de ocio respetable mientras cobra
      protección a cada negocio, arregla deudas de juego con algo más contundente
      que papeleo y resuelve sus disputas internas con una lealtad que se hereda
      más que se jura.</p>
      <p>A diferencia de Los Estratos y Boca Óxido, que libran sus guerras a la
      vista de todos, la Familia prefiere que las suyas nunca tengan testigos, una
      discreción que respeta incluso en el Mercado de las Sombras, donde paga
      tributo al Gremio como cualquier otro comerciante para no arriesgar su acceso
      al resto de Nikaalia.</p>
    `
  },
  {
    id: "gremio-de-las-sombras",
    title: "El Gremio de las Sombras",
    category: "Facciones",
    tags: ["mercante", "nikaalia"],
    summary: "El gremio de mercaderes que impone la única paz comercial que Nikaalia respeta.",
    tipo: "Mercante",
    region: "Nikaalia, Uldum, Sindra",
    ideologia: "El comercio debe seguir ocurriendo sin importar cuántas casas o bandas se disputen el resto de la ciudad.",
    miembrosConocidos: [],
    relaciones: [
      { id: "mercado-de-las-sombras", signo: "Sede y territorio neutral" },
      { id: "los-estratos", signo: "Cobra tributo por igual" },
      { id: "boca-oxido", signo: "Cobra tributo por igual" },
      { id: "familia-var-ossyn", signo: "Cobra tributo por igual" }
    ],
    content: `
      <p>Ni las casas nobles de Los Estratos ni las bandas de Boca Óxido controlan
      el Mercado de las Sombras, un acuerdo que el Gremio impone cobrando tributo a
      todas las partes por igual a cambio de garantizar que el comercio ocurra sin
      que las rivalidades ajenas se derramen dentro de sus muros.</p>
      <p>El Gremio no fabrica ni produce nada por sí mismo, y aun así pocos en
      Nikaalia dudan de que sea el poder más estable de toda la nación, precisamente
      porque ninguna casa, banda o familia criminal puede permitirse perder acceso
      a él. Romper la paz del mercado cuesta el acceso permanente, un castigo que
      ni la Familia Var Ossyn se arriesga a provocar.</p>
    `
  },
  {
    id: "resistencia-de-broneland",
    title: "La Resistencia de Broneland",
    category: "Facciones",
    tags: ["secreta", "brurland", "broneland", "mortismo"],
    summary: "Consejo clandestino que coordina la resistencia brurlandesa contra la ocupación de la Unión de Osses.",
    tipo: "Secreta",
    region: "Broneland, Derrovia, Gylas",
    ideologia: "Cada no-muerto liberado es un brurlandés que finalmente termina lo que la ocupación le negó.",
    miembrosConocidos: [],
    relaciones: [
      { id: "piedrablanca", signo: "Base de operaciones" },
      { id: "osses", signo: "Enemigo declarado" },
      { id: "caballeros-del-reino", signo: "Contacto informal, nunca reconocido" },
      { id: "mortismo", signo: "Fe que sostiene su causa" }
    ],
    content: `
      <p>Desde Piedrablanca, un consejo clandestino coordina la resistencia
      brurlandesa contra la ocupación de la Unión de Osses, prefiriendo golpes
      pequeños y constantes antes que un levantamiento abierto que Osses aplastaría
      sin dificultad.</p>
      <p>Sus sacerdotes de Mortismo consideran cada no-muerto que liberan de la
      administración de Osses un acto religioso tanto como militar: un brurlandés
      que finalmente puede terminar lo que la ocupación le había negado. Algunos
      Caballeros del Reino mantienen contacto con ellos, aunque ni la orden ni la
      Corona reconocerían jamás ese vínculo en público.</p>
    `
  },
  {
    id: "guardianes-del-korvath",
    title: "Los Guardianes del Korvath",
    category: "Facciones",
    tags: ["orden religiosa", "har", "korvath"],
    summary: "Los únicos habitantes de Har que no responden ante ningún jarl, custodios de los pocos lugares neutrales de la alianza.",
    tipo: "Orden Religiosa",
    region: "Har, Uldum, Sindra",
    ideologia: "Ningún jarl gobierna lo que es sagrado; lo sagrado se sostiene solo mediante lo que se deja.",
    miembrosConocidos: [],
    relaciones: [
      { id: "korvath", signo: "Orden religiosa oficial de" },
      { id: "piedra-del-legado", signo: "Custodian" },
      { id: "glaciar-de-los-juramentos", signo: "Custodian" },
      { id: "circulo-de-hierro", signo: "Custodian" },
      { id: "thrandheim", signo: "Vigilancia cautelosa" }
    ],
    content: `
      <p>Los únicos habitantes de Har que no responden ante jarl alguno,
      encargados de custodiar los pocos lugares que la alianza entera reconoce como
      neutrales: la Piedra del Legado, donde se graban los nombres de los caídos;
      el Glaciar de los Juramentos, donde se sellan treguas; y el Círculo de
      Hierro, donde se resuelven insultos personales mediante duelo formal.</p>
      <p>Su autoridad no depende de ejércitos ni de riqueza, sino de que ni el
      caudillo más violento de la alianza está dispuesto a cargar con la deshonra
      de desafiarlos. El ascenso de Thrandulf en Thrandheim, que acumula juramentos
      de vasallaje más rápido que cualquier jarl reciente, preocupa a los
      Guardianes precisamente porque ningún poder terrenal debería crecer tanto sin
      que ellos lo vean venir.</p>
    `
  },
  {
    id: "guardianes-del-neravismo",
    title: "Los Guardianes del Neravismo",
    category: "Facciones",
    tags: ["orden religiosa", "chakur", "neravismo"],
    summary: "Orden mixta de enanos y elfos que decide quién merece ser recordado para siempre en Chakur.",
    tipo: "Orden Religiosa",
    region: "Chakur, Uldum, Sindra",
    ideologia: "Solo desaparece completamente aquel que deja de ser recordado, y alguien debe decidir quién merece ese recuerdo.",
    miembrosConocidos: [],
    relaciones: [
      { id: "neravismo", signo: "Orden religiosa oficial de" },
      { id: "raiz-de-los-ancestros", signo: "Custodian" },
      { id: "salon-de-los-reyes-perdidos", signo: "Custodian" },
      { id: "khazgard", signo: "Reconocidos por ambas capitales" },
      { id: "ailenor", signo: "Reconocidos por ambas capitales" }
    ],
    content: `
      <p>Enanos y elfos que sirven juntos en una de las pocas instituciones de
      Chakur que ninguna de las dos capitales cuestiona en público, encargados de
      decidir quién puede ser enterrado en la Raíz de los Ancestros y de abrir el
      Salón de los Reyes Perdidos solo para coronaciones simbólicas y funerales de
      figuras excepcionales.</p>
      <p>Su membresía mixta funciona como recordatorio constante de que la
      civilización compartida que la guerra antigua estuvo a punto de borrar
      todavía puede sostenerse, al menos dentro de sus propios ritos. Elfos
      exiliados o deshonrados durante la vida pocas veces logran el privilegio de un
      entierro sagrado, sin importar cuánto lo hayan pedido antes de morir.</p>
    `
  },
  {
    id: "escuelas-de-kaishoto",
    title: "Las Escuelas de Kaishoto",
    category: "Facciones",
    tags: ["orden marcial", "seosan", "senkai"],
    summary: "Decenas de escuelas marciales de Seosan que compiten entre sí sin dejar nunca de respetarse.",
    tipo: "Orden Marcial",
    region: "Seosan",
    ideologia: "Ganar sin perder el control importa más que ganar; dominarse precede a cualquier derecho de dominar a otros.",
    miembrosConocidos: [],
    relaciones: [
      { id: "senkai", signo: "Práctica ritual de" },
      { id: "kaishoto", signo: "Sede compartida" },
      { id: "hijos-del-acero", signo: "Recluta egresados ocasionales" }
    ],
    content: `
      <p>Decenas de escuelas marciales conviven en Kaishoto compitiendo
      constantemente entre sí, cada una con su propio estilo, linaje de maestros y
      lectura particular de cómo aplicar Senkai al combate, sin dejar jamás de
      respetarse formalmente unas a otras.</p>
      <p>Los duelos que resuelven la mayoría de las disputas internas de Seosan
      son, en el fondo, exámenes religiosos tanto como demostraciones técnicas, y
      un guerrero que gana perdiendo el control pierde más prestigio del que gana
      con la victoria misma. Algunos egresados de las escuelas más prestigiosas
      terminan reclutados por Hijos del Acero, atraídos por contratos que ninguna
      escuela tradicional podría ofrecerles en Seosan.</p>
    `
  },
  {
    id: "flota-de-bandera-negra",
    title: "La Flota de Bandera Negra",
    category: "Facciones",
    tags: ["criminal", "pelgiria", "talasismo", "piratas"],
    summary: "Lo que queda de la era pirata de Pelgiria, disperso pero nunca del todo extinto.",
    tipo: "Criminal",
    region: "Genevia, Pelgiria, Sindra",
    ideologia: "Cambiar de bandera no es traición si existe continuidad entre quien uno fue y quien uno es ahora.",
    miembrosConocidos: [],
    relaciones: [
      { id: "talasismo", signo: "Justificación religiosa de su historia" },
      { id: "thalassar", signo: "Puerto de origen y retiro" }
    ],
    content: `
      <p>Lo que queda de una era en que varios de los armadores más respetados de
      Thalassar navegaron antes bajo bandera negra, saqueando las mismas rutas que
      hoy protegen o financian abiertamente. La Flota nunca desapareció del todo,
      solo se volvió menos visible, operando desde calas menores de Genevia lejos
      de los puertos que ya reformaron su reputación.</p>
      <p>El Talasismo, que considera la obstinación uno de los grandes defectos
      humanos, ofrece a sus miembros una salida religiosa cómoda: cambiar de
      bandera no traiciona a quien uno fue, siempre que exista continuidad entre
      ambas personas. Pocos piratas en el mundo conocido disfrutan de una
      absolución tan bien argumentada.</p>
    `
  },
  {
    id: "trono-de-ceniza",
    title: "El Trono de Ceniza",
    category: "Facciones",
    tags: ["orden militar", "osses", "roah", "monstruos", "no-muertos"],
    summary: "El gobierno de la Unión de Osses, que rige el mayor imperio de monstruos y no-muertos del mundo desde el nivel más profundo de Sepulkrad.",
    tipo: "Orden Militar",
    region: "Osses, Roah, Gylas",
    ideologia: "La humanidad es la mayor amenaza para el resto de las especies; solo unidas bajo un mismo estandarte pueden las razas monstruosas sobrevivirle.",
    miembrosConocidos: [],
    relaciones: [
      { id: "osses", signo: "Gobierno de" },
      { id: "sepulkrad", signo: "Sede, en el nivel más profundo de la ciudad" },
      { id: "caballeros-del-reino", signo: "Enemigo declarado" },
      { id: "resistencia-de-broneland", signo: "Objetivo de contrainsurgencia" },
      { id: "broneland", signo: "Territorio ocupado" }
    ],
    content: `
      <p>Desde el nivel más profundo de Sepulkrad, tan hondo que pocos vivos lo han
      visto con sus propios ojos, el Trono de Ceniza gobierna el mayor imperio de
      monstruos y no-muertos del mundo, fundado sobre la certeza de que la
      humanidad representa la mayor amenaza para el resto de las especies
      conocidas.</p>
      <p>Su apetito expansionista no se detuvo con la absorción de Broneland, y
      cada año que la ocupación se sostiene sin una respuesta militar seria de
      Brurland confirma, a ojos del Trono, que su doctrina funciona. Trata a los
      Caballeros del Reino como una amenaza distante y a la resistencia clandestina
      que opera desde Piedrablanca como una molestia recurrente, sin saber cuánto
      se beneficia esta última de esa misma subestimación.</p>
    `
  },
  {
    id: "magistrados-de-la-reina",
    title: "Los Magistrados de la Reina",
    category: "Facciones",
    tags: ["orden religiosa", "mravec", "quitinismo", "insectoides"],
    summary: "El brazo ejecutor del Quitinismo en Mravec, encargado de vigilar que ningún mago olvide a quién pertenece de verdad su poder.",
    tipo: "Orden Religiosa",
    region: "Mravec, Derrovia",
    ideologia: "El poder utilizado nunca pertenece completamente a quien lo sostiene, y alguien debe vigilar que cada mago lo recuerde.",
    miembrosConocidos: [],
    relaciones: [
      { id: "quitinismo", signo: "Brazo ejecutor de" },
      { id: "mravec", signo: "Autoridad legal-mágica de" },
      { id: "academia-arcana-de-dolbred", signo: "Debate doctrinal permanente" },
      { id: "culto-de-la-madre", signo: "Herejía que vigilan sin reprimir" }
    ],
    content: `
      <p>Cada generación de la dinastía insectoide gobierna oficialmente en nombre
      de la Reina Hormiga, y los Magistrados existen para que esa misma lógica se
      extienda a cualquiera que practique magia dentro de la satrapía: ningún
      hechizo, sostiene el Quitinismo, deja de pertenecer también a aquello mayor
      de lo que procede.</p>
      <p>Investigan accidentes mágicos, documentan públicamente cada incidente
      grave y pueden despojar a un mago de su licencia para lanzar hechizos
      peligrosos sin supervisión, un poder que ni la propia Academia Arcana de
      Dolbred posee sobre sus estudiantes. Su rivalidad con Dolbred es célebre:
      coinciden en la mecánica de casi todo hechizo y discrepan por completo sobre
      qué derecho otorga comprenderlo.</p>
    `
  },
  {
    id: "culto-de-la-madre",
    title: "El Culto de la Madre",
    category: "Facciones",
    tags: ["secreta", "mravec", "desierto", "cultistas"],
    summary: "Veneración desértica y anterior al Quitinismo hacia la Madre del Desierto, matriarca colosal de los grandes gusanos de Mravec.",
    tipo: "Secreta",
    region: "Mravec, Derrovia",
    ideologia: "Antes de la Reina Hormiga y antes del Quitinismo, el desierto ya tenía dueña.",
    miembrosConocidos: [],
    relaciones: [
      { id: "magistrados-de-la-reina", signo: "Herejía que vigilan sin reprimir" },
      { id: "mravec", signo: "Practicado en las comunidades desérticas de" },
      { id: "quitinismo", signo: "Fe rival, más antigua" }
    ],
    content: `
      <p>Mucho antes de que la primera Reina Hormiga fundara la satrapía, las
      comunidades dispersas del desierto de Mravec ya dejaban ofrendas para algo
      colosal que dormía bajo la arena, una entidad que sus descendientes siguen
      llamando la Madre del Desierto. Su emergencia ocasional altera el clima de
      regiones enteras, y quienes la veneran sostienen que decide, con una voluntad
      que nadie más comprende, cuándo un asentamiento merece renovarse y cuándo
      merece desaparecer.</p>
      <p>El Quitinismo oficial considera el culto una reliquia supersticiosa
      incompatible con la responsabilidad que exige toda relación con el poder,
      pero los Magistrados de la Reina rara vez intervienen directamente contra sus
      practicantes, conscientes de que ninguna satrapía sobrevive mucho tiempo
      declarando la guerra a comunidades que llevan generaciones alimentando a algo
      capaz de tragarse un ejército entero.</p>
    `
  },
  {
    id: "triunvirato-sacerdotal",
    title: "El Triunvirato Sacerdotal",
    category: "Facciones",
    tags: ["orden religiosa", "ornamen", "balutia", "ternarismo"],
    summary: "Los tres sacerdotes que gobiernan Triastra en nombre del Ternarismo, con una autoridad que el Imperio nunca se ha atrevido a desafiar del todo.",
    tipo: "Orden Religiosa",
    region: "Ornamen, Merador, Balutia",
    ideologia: "Ninguna parte debe consumir al conjunto: ni el cuerpo, ni la mente, ni el alma, ni tampoco la Corona que gobierna sobre las tres.",
    miembrosConocidos: [],
    relaciones: [
      { id: "ternarismo", signo: "Autoridad religiosa oficial de" },
      { id: "triastra", signo: "Sede" },
      { id: "vitrium", signo: "Ejerce tutela sobre" },
      { id: "yunque-ardiente", signo: "Guía espiritual de sus genasi ígneos" },
      { id: "refugio-de-los-quemados", signo: "Sostiene el hospicio" }
    ],
    content: `
      <p>Tres sacerdotes gobiernan juntos Triastra, uno por cada aspecto que venera
      el Ternarismo, y ninguno de los tres puede tomar una decisión importante sin
      el acuerdo de los otros dos, una estructura que el propio Triunvirato
      considera la prueba viva de su doctrina antes que una simple formalidad de
      gobierno.</p>
      <p>Su autoridad sobrevivió intacta a la conquista imperial, algo que ningún
      gobernador balutiano se ha atrevido todavía a poner a prueba abiertamente, en
      parte porque los genasi ígneos que sirven en la Guardia rinden mejor, según
      los propios oficiales imperiales, cuando su fe se mantiene sin
      interferencias. El Triunvirato también sostiene el Refugio de los Quemados,
      tratando cada cicatriz de forja como una ofrenda que merece cuidado, no solo
      compasión.</p>
    `
  },
  {
    id: "archivistas-de-la-herida",
    title: "Los Archivistas de la Herida",
    category: "Facciones",
    tags: ["orden religiosa", "nikaalia", "umbrismo"],
    summary: "El clero del Umbrismo, que gobierna los templos-hospital de Umbrathil y documenta cada fenómeno sobrenatural de Nikaalia.",
    tipo: "Orden Religiosa",
    region: "Nikaalia, Uldum, Sindra",
    ideologia: "Documentar la Herida es el primer paso para repararla; destruir lo que se ha registrado es pecado.",
    miembrosConocidos: [],
    relaciones: [
      { id: "umbrismo", signo: "Orden religiosa oficial de" },
      { id: "umbrathil", signo: "Sede principal" },
      { id: "esporal", signo: "Estudian su bioluminiscencia como síntoma" },
      { id: "recolectores-de-nigredo", signo: "Tensión por el manejo del recurso" },
      { id: "hijos-del-vacio", signo: "Vigilancia doctrinal" }
    ],
    content: `
      <p>Bajo la noche perpetua de Umbrathil, los templos del Umbrismo funcionan
      también como hospitales, y sus sacerdotes reciben formación tanto en
      medicina como en la obligación religiosa de registrar cualquier
      acontecimiento sobrenatural inexplicable antes de que la memoria colectiva lo
      distorsione. Sus archivos, alimentados durante generaciones, forman
      probablemente la mayor colección de fenómenos anómalos de todo el mundo
      conocido.</p>
      <p>Consideran cada mutación provocada por el Nigredo un síntoma más de la
      Herida original, ni maldición ni bendición, y por eso mismo vigilan de cerca
      a los Hijos del Vacío, cuya lectura del mismo fenómeno como oportunidad
      evolutiva les resulta tan herética como peligrosa. Con Los Recolectores de
      Nigredo mantienen una relación más incómoda que hostil: necesitan el recurso
      que extraen para mantener encendidas sus velas, pero jamás dejarán de
      recordarles que extraen algo sagrado, no solo un mineral.</p>
    `
  },
  {
    id: "tribunales-del-iurismo",
    title: "Los Tribunales del Iurismo",
    category: "Facciones",
    tags: ["orden religiosa", "kalvia", "iurismo"],
    summary: "Sacerdotes y jueces a la vez, que hacen cumplir en Kalvia la letra exacta de cada contrato firmado.",
    tipo: "Orden Religiosa",
    region: "Kalvia, Kretor, Sindra",
    ideologia: "Una palabra dada modifica el mundo, y alguien debe hacer cumplir esa modificación cuando una de las partes prefiere olvidarla.",
    miembrosConocidos: [],
    relaciones: [
      { id: "iurismo", signo: "Autoridad religiosa y legal oficial de" },
      { id: "tribunal-de-los-sellos", signo: "Sede" },
      { id: "aurelport", signo: "Jurisdicción principal" },
      { id: "casa-de-pesas", signo: "Colabora en disputas comerciales" },
      { id: "mercado-gris", signo: "Jurisdicción que no alcanzan" }
    ],
    content: `
      <p>Sacerdotes y jueces a la vez, los Tribunales del Iurismo resuelven en
      Kalvia disputas comerciales según la letra exacta de cada contrato firmado,
      convencidos de que romper una promesa no es solo mala fe sino una herida real
      infligida a todo lo que otros construyeron confiando en ella.</p>
      <p>Su jurisdicción cubre cada contrato, matrimonio y vasallaje registrado
      formalmente en el Principado, pero se detiene en seco ante Cambalache y el
      resto del Mercado Gris, donde ningún trato se sella jamás con un juramento
      que ellos puedan reconocer. Los propios Tribunales prefieren no mencionar en
      público cuántos casos importantes terminan resolviéndose ahí, fuera de su
      alcance, en lugar de dentro de sus salas.</p>
    `
  },
  {
    id: "registradores-del-edrasismo",
    title: "Los Registradores del Edrasismo",
    category: "Facciones",
    tags: ["orden religiosa", "nobriana", "edrasismo"],
    summary: "Sacerdotes itinerantes de Nobriana que registran cada profecía antes de que se cumpla, nunca después.",
    tipo: "Orden Religiosa",
    region: "Nobriana, Derrovia, Gylas",
    ideologia: "No todo aquello verdadero puede ser conocido, pero toda profecía debe registrarse antes de cumplirse.",
    miembrosConocidos: [],
    relaciones: [
      { id: "edrasismo", signo: "Orden religiosa oficial de" },
      { id: "nobriana", signo: "Sede itinerante en" },
      { id: "sociedad-del-sexto-sol", signo: "Escepticismo mutuo" }
    ],
    content: `
      <p>Toda profecía reconocida por el Edrasismo se registra antes de cumplirse,
      nunca después, una regla que sus sacerdotes defienden con un rigor casi
      obsesivo porque saben exactamente cuánto se distorsiona un vaticinio cuando
      alguien lo reescribe con el resultado ya conocido.</p>
      <p>Viven dispersos por las Marchas Nobrianas en pequeños grupos itinerantes,
      guiando a los pocos forasteros que se aventuran en un territorio que ni
      Brurland ni Seosan han logrado, o realmente intentado, someter por completo. La
      Sociedad del Sexto Sol los considera aliados naturales por su fascinación
      compartida con lo desconocido, aunque los Registradores desconfían de
      cualquiera demasiado ansioso por convertir un misterio en una teoría
      cerrada.</p>
    `
  },
  {
    id: "cobradores-del-sello",
    title: "Los Cobradores del Sello",
    category: "Facciones",
    tags: ["mercenarios", "kalvia", "iurismo"],
    summary: "Los que Kalvia contrata cuando un contrato queda sin pagar y nadie quiere esperar a que un juez lo resuelva.",
    tipo: "Mercenarios",
    region: "Kalvia, Kretor, Sindra",
    ideologia: "Una deuda impaga es una promesa rota, y toda promesa rota merece cobrarse hasta el último centavo.",
    miembrosConocidos: [],
    relaciones: [
      { id: "tribunales-del-iurismo", signo: "Operan bajo su vista, rara vez con su aprobación" },
      { id: "banca-alta", signo: "Cliente principal" },
      { id: "las-comadrejas", signo: "Rivalidad profesional ocasional" }
    ],
    content: `
      <p>Cuando un préstamo de Banca Alta o un contrato sellado ante los
      Tribunales del Iurismo queda sin pagar, pocos acreedores de Kalvia
      acuden primero a un juez. Acuden a los Cobradores del Sello, que se
      presentan con el contrato original en una mano y argumentos considerablemente
      menos legales en la otra.</p>
      <p>Sus métodos rozan constantemente el límite de lo que el Iurismo
      consideraría una amenaza para obtener un juramento, motivo por el cual los
      propios Tribunales prefieren no reconocerlos oficialmente y actúan contra
      ellos solo en contadas ocasiones, siempre que la violencia se mantenga proporcional a la
      deuda reclamada. Las Comadrejas los consideran competencia menor, ya que un
      fugitivo puede esconderse para siempre, pero una deuda, tarde o temprano,
      alguien más termina pagándola.</p>
    `
  },
  {
    id: "cazadores-de-dragones",
    title: "Los Cazadores de Dragones",
    category: "Facciones",
    tags: ["orden marcial", "cazamonstruos", "dragones", "internacional"],
    summary: "Guerreros honorables que dominan técnicas de caza de dragones casi perdidas, llamados allí donde un dragón, joven o adulto, debe morir por verdadera necesidad.",
    tipo: "Orden Marcial",
    region: "Internacional",
    ideologia: "Matar a un dragón no es una hazaña que perseguir, es una carga que se acepta cuando de verdad no queda otra opción.",
    miembrosConocidos: [],
    relaciones: [
      { id: "pergaminos-legendarios", signo: "Origen de sus técnicas ancestrales" },
      { id: "culto-al-pozo-de-la-eternidad", signo: "Respeto incómodo mutuo" },
      { id: "hijos-del-acero", signo: "Reclutan a sus egresados más disciplinados" }
    ],
    content: `
      <p>A diferencia de cualquier cazador de monstruos común, quienes dominan
      las técnicas de los Cazadores de Dragones no cobran por matar bestias que
      simplemente estorban ni persiguen trofeos. Responden a llamados concretos:
      una aldea bajo asedio de un ejemplar adulto que ya no puede razonarse con
      ofrendas, un rito que exige la sangre de un dragón joven antes de que su
      fuego termine de formarse, una plaga que solo cede ante un componente que
      ningún otro monstruo puede proveer. Matan cuando de verdad no queda
      alternativa, sin que la edad del dragón cambie esa decisión.</p>
      <p>Sus técnicas descienden de la Escuela Matadragones, una de las pocas
      artes legendarias que sobrevivió, aunque fragmentada, a la desaparición de
      sus fundadores originales, y cada Cazador pasa años completando el
      entrenamiento antes de que sus maestros lo consideren listo para un encargo
      real. El Culto al Pozo de la Eternidad los mira con un respeto incómodo:
      reconoce que matar un dragón por necesidad no es lo mismo que profanar su
      descanso, pero tampoco olvida que cada Cazador exitoso deja un cadáver que
      nunca llegará al Pozo por su propio pie.</p>
      <p>La orden lleva generaciones encogiéndose, pero el descenso brutal de los
      avistamientos de dragones en los últimos años la ha dejado al borde de la
      irrelevancia: sin bestias que cazar, no hay encargos que aceptar, y sin
      encargos reales, un aprendiz nunca termina de completar el entrenamiento que
      lo convertiría en maestro. Los pocos Cazadores veteranos que quedan discuten
      cada vez más abiertamente si su arte sobrevivirá una generación más, o si
      terminará como tantas otras técnicas legendarias, reducida a un puñado de
      pergaminos que nadie ya puede replicar por completo.</p>
    `
  }
];
