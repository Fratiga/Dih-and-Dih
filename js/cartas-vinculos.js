/* =============================================================================
   CARTAS MALDITAS — vínculos y rivalidades. Cómo se llevan los personajes de la
   historia cuando coinciden en la mesa. Las relaciones salen de las fichas del
   compendio (relacionesConocidas) y de la cronología. El motor
   (cartas-motor.js) lo calcula todo mirando los dos campos; aquí solo hay datos.

   CÍRCULOS (y LAZOS, que son círculos de dos). Cada carta miembro gana el bono
   del nivel más alto que alcance el número de miembros DISTINTOS que haya en su
   campo (n). Un nivel puede traer atq, pv, palabras (palabras clave que gana),
   quita (palabras que pierde), reduce, guarda (ids de aliadas a las que cubre),
   barrera, y ind: { idDeCarta: bono } para dar algo solo a un miembro.
   `completo` suma otro bono cuando están todas las cartas de `requiere`.

   RIVALIDADES (secretas). Se activan cuando hay una carta del `bando` en un campo
   y una de `contra` en el contrario. La carta no dice nada: el registro anuncia la
   rivalidad cuando se activa. Cada lado recibe lo suyo:
     paraBando / paraContra:
       atq, pv, palabras                       bonos mientras la rivalidad esté activa
       bonusContra: n                          daño extra en combate contra la rival
       marca: true                             puede desafiar a la rival aunque haya Provocar
       anulaAlMorirContra: true                si el bando mata a la rival, su habilidad al morir no ocurre
       alMatarContra({ est, M, u, j, muerta }) lo que gana el bando al matarla
       alMorirPropia({ est, M, u, j })         lo que hace la rival al caer mientras dura la rivalidad
   Ver «Vínculos y rivalidades» en docs/combate-triunfos.md.
============================================================================= */
(function (raiz) {
  const circulos = [
    // --- Círculos --------------------------------------------------------------
    { id: "comadrejas", nombre: "Las Comadrejas", miembros: ["rook", "bull", "garra", "baraja"],
      texto: "La banda de contrabandistas que entró arrastrando una jaula a La Taberna del Gigante. Se cubren las espaldas.",
      niveles: [{ n: 2, atq: 1 }, { n: 3, atq: 1, pv: 1 }, { n: 4, atq: 2, pv: 1 }] },
    { id: "fugitivos", nombre: "Compañeros de huida", miembros: ["orina", "edge", "hornet", "sir-buffolet", "enzo", "mattei", "eledar"],
      texto: "Los fugitivos que se escondieron en el granero de Dagren. No se aguantan del todo, pero juntos sobreviven.",
      niveles: [{ n: 2, atq: 1, pv: 1 }, { n: 4, atq: 2, pv: 1 }, { n: 6, atq: 2, pv: 2 }],
      completo: { requiere: ["orina", "edge", "hornet", "sir-buffolet", "enzo", "mattei", "eledar"], nombre: "Contra todo el reino: los siete juntos ganan +1/+1 y una Barrera", atq: 1, pv: 1, barrera: true } },
    { id: "forasteros", nombre: "Los forasteros de Brurland", miembros: ["laia", "eledar", "ryn", "hooey-magoo", "sigismund", "cassius-coldgrave", "torvrena", "darian"],
      texto: "El grupo que se entregó en Kigan, aceptó la misión del príncipe y partió al norte a matar al dragón.",
      niveles: [{ n: 3, atq: 1 }, { n: 5, atq: 1, pv: 1 }, { n: 7, atq: 1, pv: 2 }],
      completo: { requiere: ["laia", "eledar", "ryn", "hooey-magoo", "sigismund"], nombre: "Juntos hasta el dragón: el grupo entero gana una Barrera", barrera: true } },
    { id: "banda-de-cassius", nombre: "La banda de Cassius", miembros: ["cassius-coldgrave", "billy", "voss", "victor"],
      texto: "El charlatán de Vado Ceniza y los tres matones que trabajan para él.",
      niveles: [{ n: 2, atq: 1, pv: 1 }, { n: 3, atq: 2, pv: 1 }, { n: 4, atq: 2, pv: 2 }],
      completo: { requiere: ["cassius-coldgrave", "billy", "voss", "victor"], nombre: "El jefe y su banda: con ellos detrás, todos ganan +1/+0 y Cassius sí bloquea", atq: 1, ind: { "cassius-coldgrave": { quita: ["noBloquea"] } } } },
    { id: "ultimo-apunte", nombre: "Los Seis del Último Apunte", miembros: ["rojo-ultimo-apunte", "verde-ultimo-apunte", "morado-ultimo-apunte", "amarillo-ultimo-apunte", "azul-ultimo-apunte", "gris-ultimo-apunte"],
      texto: "Seis discípulos que se reconocen por un color. Cazan juntos.",
      niveles: [{ n: 2, atq: 1, pv: 1 }, { n: 4, atq: 2, pv: 1 }, { n: 6, atq: 2, pv: 2 }] },
    { id: "instituto", nombre: "Personal del Instituto", miembros: ["coronel-tobi", "baltasar-sorel", "elias-morcant", "nico", "clef", "ulis", "enfermera-harrow"],
      texto: "Quienes trabajan en las instalaciones del Instituto Vesalio, cada uno a su manera.",
      niveles: [{ n: 2, atq: 1 }, { n: 4, atq: 1, pv: 1 }, { n: 6, atq: 2, pv: 1 }] },
    { id: "corona", nombre: "La Corona de Brurland", miembros: ["julius-goldenside", "leonard-goldenside", "adam-kovacs", "adam-kovacs-h"],
      texto: "El rey, su hijo y el capitán de la Guardia Real.",
      niveles: [{ n: 2, atq: 1 }, { n: 3, atq: 1, pv: 1 }],
      completo: { requiere: ["julius-goldenside", "leonard-goldenside", "adam-kovacs"], nombre: "La guardia real: el rey, el príncipe y el capitán ganan Duro", palabras: ["duro"] } },
    { id: "refugio", nombre: "Los del refugio", miembros: ["eklino-a", "coach", "ocevat"],
      texto: "Quienes defendieron las barricadas la noche del dragón.",
      niveles: [{ n: 2, pv: 1 }, { n: 3, atq: 1, pv: 1 }],
      completo: { requiere: ["eklino-a", "coach", "ocevat"], nombre: "Resistir hasta el amanecer: los tres ganan Duro", palabras: ["duro"] } },

    // --- Lazos (dos cartas que se conocen) ----------------------------------------
    { id: "coach-ryn", tipo: "lazo", nombre: "Dio la vida por ella", miembros: ["coach", "ryn"], texto: "Coach se interpuso entre el protodraco y Ryn.",
      niveles: [{ n: 2, ind: { coach: { guarda: ["ryn"] }, ryn: { pv: 1 } } }] },
    { id: "coach-orina", tipo: "lazo", nombre: "El goblin vivió gracias a él", miembros: ["coach", "orina"], texto: "Coach se interpuso entre el protodraco y Orina.",
      niveles: [{ n: 2, ind: { coach: { guarda: ["orina"] }, orina: { pv: 1 } } }] },
    { id: "sigismund-ocevat", tipo: "lazo", nombre: "Fue su maestro", miembros: ["sigismund", "ocevat"], texto: "Sigismund fue discípulo de Ocevat.",
      niveles: [{ n: 2, ind: { sigismund: { atq: 1, pv: 1 }, ocevat: { pv: 1 } } }] },
    { id: "clef-ulis", tipo: "lazo", nombre: "Le da órdenes y ella las sigue", miembros: ["clef", "ulis"], texto: "Ulis hace lo que Clef le ordena.",
      niveles: [{ n: 2, ind: { ulis: { atq: 1, pv: 1 }, clef: { pv: 1 } } }] },
    { id: "enzo-mattei", tipo: "lazo", nombre: "Cobradores de recompensas", miembros: ["enzo", "mattei"], texto: "Mattei sigue a Enzo y lo ayuda a cobrar recompensas.",
      niveles: [{ n: 2, ind: { enzo: { atq: 1 }, mattei: { pv: 1 } } }] },
    { id: "ryn-sett", tipo: "lazo", nombre: "Quedaron en verse en Wolfmere", miembros: ["ryn", "sett"], texto: "Se conocieron en la taberna y la conversación terminó mejor de lo esperado.",
      niveles: [{ n: 2, ind: { ryn: { atq: 1 }, sett: { atq: 1 } } }] },
    { id: "laia-isa", tipo: "lazo", nombre: "Amigos de calabozo", miembros: ["laia", "isa"], texto: "Se conocieron en los calabozos de Kigan y quedaron en verse en la taberna.",
      niveles: [{ n: 2, ind: { laia: { pv: 1 }, isa: { atq: 1 } } }] },
    { id: "ledros-vieja", tipo: "lazo", nombre: "Conoce su verdadero nombre", miembros: ["ledros", "vieja-de-la-espesura"], texto: "La ermitaña sabe quién fue Ledros y pidió que le dieran descanso.",
      niveles: [{ n: 2, ind: { ledros: { pv: 2 }, "vieja-de-la-espesura": { atq: 1 } } }] },
    { id: "sorel-nico", tipo: "lazo", nombre: "Busca su atención", miembros: ["baltasar-sorel", "nico"], texto: "Nico busca constantemente la atención del doctor Sorel.",
      niveles: [{ n: 2, ind: { nico: { atq: 1 } } }] }
  ];

  const rivalidades = [
    { id: "la-muerte-que-mereces", nombre: "La muerte que mereces", bando: ["enzo"], contra: ["orina"],
      texto: "Enzo vino por Orina. Si es él quien lo mata, el Proyectil de Orina no se dispara, y cobra la recompensa: roba una carta.",
      paraBando: {
        bonusContra: 1, anulaAlMorirContra: true,
        alMatarContra: c => { c.M.log(c.est, `${c.M.nombre(c.est, c.u)} cobra la recompensa por Orina.`); c.M.robar(c.est, c.j, 1); }
      }, paraContra: {} },
    { id: "el-arpon-no-avisa", nombre: "El arpón no avisa", bando: ["rook"], contra: ["eledar"],
      texto: "Ni las cartas de Eledar vieron venir el arpón. Rook puede desafiarlo aunque haya Provocar y le pega 1 más.",
      paraBando: { marca: true, bonusContra: 1 }, paraContra: {} },
    { id: "hubert-magnolia", nombre: "Hubert Magnolia", bando: ["rojo-ultimo-apunte", "verde-ultimo-apunte", "morado-ultimo-apunte", "amarillo-ultimo-apunte", "azul-ultimo-apunte", "gris-ultimo-apunte"], contra: ["hooey-magoo"],
      texto: "Los Seis cazan a Hooey: ganan +1 de ataque. Pero hubo una explosión que Hooey no recuerda: si cae, hace 3 de daño a cada unidad enemiga del Último Apunte.",
      paraBando: { atq: 1 },
      paraContra: {
        alMorirPropia: c => {
          const objetivos = c.est.jugadores[1 - c.j].campo.filter(o => o.cartaId.endsWith("-ultimo-apunte"));
          if (!objetivos.length) return;
          c.M.log(c.est, "Una explosión sacude a Hooey: Hubert Magnolia se lleva por delante al Último Apunte.");
          objetivos.slice().forEach(o => c.M.infligir(c.est, { u: o.uid }, 3, { tipo: "habilidad", dueno: c.j }));
        }
      } },
    { id: "bestia-gigante", nombre: "Bestia gigante", bando: ["ulis"], contra: ["darian"],
      texto: "Clef le ordenó a Ulis que atacara a Darian: ella se transforma en una bestia gigante y gana +3/+3.",
      paraBando: { atq: 3, pv: 3 }, paraContra: {} },
    { id: "usted-se-queda", nombre: "Usted se queda", bando: ["enfermera-harrow"], contra: ["laia"],
      texto: "Harrow quiere estudiar a Laia en persona. Puede desafiarlo aunque haya Provocar y le pega 1 más; Laia, que se niega, esquiva la mitad de los golpes.",
      paraBando: { marca: true, bonusContra: 1 }, paraContra: { palabras: ["esquivo"] } },
    { id: "brazo-militar", nombre: "Brazo militar", bando: ["dagren"], contra: ["guillotina"],
      texto: "Guillotina le arrancó un brazo a Dagren y él se puso uno militar para devolverle el favor: +2 de daño contra ella.",
      paraBando: { bonusContra: 2 }, paraContra: {} },
    { id: "lagrimas-de-ledros", nombre: "Lágrimas del espectro", bando: ["ledros"], contra: ["sir-buffolet"],
      texto: "El mal bardo hizo llorar a Ledros y los espíritus se soltaron: Ledros hace 2 de daño extra a Sir Buffolet.",
      paraBando: { bonusContra: 2 }, paraContra: {} },
    { id: "nadie-le-da-ordenes", nombre: "Nadie le da órdenes al Coronel", bando: ["coronel-tobi"], contra: ["rojo-ultimo-apunte"],
      texto: "Rojo no para de dar órdenes y el Coronel no las acepta: gana +2 de ataque mientras Rojo esté enfrente.",
      paraBando: { atq: 2 }, paraContra: {} }
  ];

  raiz.CARTAS_VINCULOS = { circulos, rivalidades };
  /* Para el álbum: los vínculos amistosos de una carta (los de rivalidad son secretos) */
  raiz.vinculosDeCarta = id => circulos.filter(c => c.miembros.includes(id));
  if (raiz.CartasMotor) raiz.CartasMotor.registrarVinculos(raiz.CARTAS_VINCULOS);
  else raiz.__registrarVinculosCartas = M => M.registrarVinculos(raiz.CARTAS_VINCULOS);
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.CARTAS_VINCULOS;
})(typeof window !== "undefined" ? window : globalThis);
