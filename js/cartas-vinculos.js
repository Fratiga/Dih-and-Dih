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
    { id: "comadrejas", nombre: "Las Comadrejas", miembros: ["rook", "bull", "garra", "baraja", "senora-de-la-madriguera"],
      texto: "La banda de contrabandistas que entró arrastrando una jaula a La Taberna del Gigante, con su jefa. Se cubren las espaldas.",
      niveles: [{ n: 2, atq: 1 }, { n: 3, atq: 1, pv: 1 }, { n: 4, atq: 2, pv: 1 }, { n: 5, atq: 2, pv: 2 }] },
    { id: "fugitivos", nombre: "Compañeros de huida", miembros: ["orina", "edge", "hornet", "sir-buffolet", "enzo", "mattei", "eledar"],
      texto: "Los fugitivos que se escondieron en el granero de Dagren. No se aguantan del todo, pero juntos sobreviven.",
      niveles: [{ n: 2, atq: 1, pv: 1 }, { n: 4, atq: 2, pv: 1 }, { n: 6, atq: 2, pv: 2 }],
      completo: { requiere: ["orina", "edge", "hornet", "sir-buffolet", "enzo", "mattei", "eledar"], nombre: "Contra todo el reino: los siete juntos ganan +1/+1 y una Barrera", atq: 1, pv: 1, barrera: true } },
    { id: "forasteros", nombre: "Los forasteros de Brurland", miembros: ["laia", "eledar", "ryn", "hooey-magoo", "cassius-coldgrave", "torvrena"],
      texto: "El grupo que se entregó en Kigan, aceptó la misión del Rey y partió al norte a matar al dragón.",
      niveles: [{ n: 3, atq: 1 }, { n: 5, atq: 1, pv: 1 }, { n: 6, atq: 1, pv: 2 }],
      completo: { requiere: ["laia", "eledar", "ryn", "hooey-magoo", "sigismund"], nombre: "Juntos hasta el dragón: el grupo entero gana una Barrera", barrera: true } },
    { id: "banda-de-cassius", nombre: "La banda de Cassius", miembros: ["cassius-coldgrave", "billy", "voss", "victor"],
      texto: "El charlatán de Vado Ceniza y los tres matones que trabajan para él.",
      niveles: [{ n: 2, atq: 1, pv: 1 }, { n: 3, atq: 2, pv: 1 }, { n: 4, atq: 2, pv: 2 }],
      completo: { requiere: ["cassius-coldgrave", "billy", "voss", "victor"], nombre: "El jefe y su banda: con ellos detrás, todos ganan +1/+0 y Cassius sí bloquea", atq: 1, ind: { "cassius-coldgrave": { quita: ["noBloquea"] } } } },
    { id: "ultimo-apunte", nombre: "Los Seis del Último Apunte", miembros: ["rojo-ultimo-apunte", "verde-ultimo-apunte", "morado-ultimo-apunte", "amarillo-ultimo-apunte", "azul-ultimo-apunte", "gris-ultimo-apunte"],
      texto: "Seis discípulos que se reconocen por un color. Cazan juntos.",
      niveles: [{ n: 2, atq: 1, pv: 1 }, { n: 4, atq: 2, pv: 1 }, { n: 6, atq: 2, pv: 2 }] },
    { id: "instituto", nombre: "Personal del Instituto", miembros: ["coronel-tobi", "baltasar-sorel", "elias-morcant", "nico", "clef", "ulis", "enfermera-harrow", "la-anatomista"],
      texto: "Quienes trabajan en las instalaciones del Instituto Vesalio, cada uno a su manera.",
      niveles: [{ n: 2, atq: 1 }, { n: 4, atq: 1, pv: 1 }, { n: 6, atq: 2, pv: 1 }] },
    { id: "corona", nombre: "La Corona de Brurland", miembros: ["julius-goldenside", "leonard-goldenside", "adam-kovacs", "adam-kovacs-h"],
      texto: "El rey, su hijo y el capitán de los Caballeros del Reino.",
      niveles: [{ n: 2, atq: 1 }, { n: 3, atq: 1, pv: 1 }],
      completo: { requiere: ["julius-goldenside", "leonard-goldenside", "adam-kovacs"], nombre: "La corte: el rey, el príncipe y el capitán ganan Duro", palabras: ["duro"] } },
    { id: "refugio", nombre: "Los del refugio", miembros: ["eklino-a", "coach", "ocevat"],
      texto: "Quienes defendieron las barricadas la noche del dragón.",
      niveles: [{ n: 2, pv: 1 }, { n: 3, atq: 1, pv: 1 }],
      completo: { requiere: ["eklino-a", "coach", "ocevat"], nombre: "Resistir hasta el amanecer: los tres ganan Duro", palabras: ["duro"] } },

    // --- Lote 2: las facciones y los oficios del compendio ------------------------
    { id: "milicia-de-brurland", nombre: "La milicia de Brurland", miembros: ["arquero-de-la-milicia", "sargento-de-la-milicia", "miliciano-de-brurland", "caballero-de-brurland", "mago-de-milicia"],
      texto: "Los soldados que guardan las fronteras de Brurland, cada uno en su puesto.",
      niveles: [{ n: 2, atq: 1 }, { n: 3, atq: 1, pv: 1 }, { n: 4, atq: 2, pv: 1 }],
      completo: { requiere: ["arquero-de-la-milicia", "sargento-de-la-milicia", "miliciano-de-brurland"], nombre: "Línea de escudos y arcos: el arquero, el sargento y el miliciano ganan Duro", palabras: ["duro"] } },
    { id: "caballeros-del-reino", nombre: "Los Caballeros del Reino", miembros: ["adam-kovacs", "el-primer-juramentado", "caballero-de-brurland"],
      texto: "La élite militar de Brurland, atada por juramento a recuperar Broneland.",
      niveles: [{ n: 2, atq: 1 }, { n: 3, atq: 1, pv: 1 }] },
    { id: "peregrinos-del-alba", nombre: "Los Peregrinos del Alba", miembros: ["la-primera-aurora", "peregrino-del-alba", "novicio"],
      texto: "La rama itinerante del Kaneísmo: caminan juntos y rezan por quien se cruza.",
      niveles: [{ n: 2, pv: 1 }, { n: 3, atq: 1, pv: 1 }] },
    { id: "cambalache", nombre: "El mercado de Cambalache", miembros: ["pregonero-de-cambalache", "el-tiznado", "contrabandista", "ladron-de-bolsillos", "mercader-viajero"],
      texto: "Todo se vende en Cambalache y nadie pregunta de dónde viene. Se conocen todos.",
      niveles: [{ n: 2, atq: 1 }, { n: 3, atq: 1, pv: 1 }, { n: 4, atq: 2, pv: 1 }] },
    { id: "bandera-negra", nombre: "La Flota de Bandera Negra", miembros: ["senor-de-las-calas", "capitan-de-barco", "pescador"],
      texto: "Lo que queda de la era pirata, escondido en las calas de Genevia.",
      niveles: [{ n: 2, atq: 1 }, { n: 3, atq: 1, pv: 1 }] },
    { id: "dolbred", nombre: "La Academia de Dolbred", miembros: ["decano-de-los-fundamentos", "aprendiz-de-mago", "mago-de-milicia"],
      texto: "Los magos que estudiaron los «Fundamentos de...» en Dolbred.",
      niveles: [{ n: 2, atq: 1 }, { n: 3, atq: 1, pv: 1 }] },

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
    { id: "legion-balutiana", tipo: "lazo", nombre: "La legión es su familia", miembros: ["legado-del-aguila", "soldado-balutiano"], texto: "El general y el soldado que no conoce otra familia que la Guardia Imperial.",
      niveles: [{ n: 2, ind: { "soldado-balutiano": { atq: 1, pv: 1 }, "legado-del-aguila": { pv: 1 } } }] },
    { id: "nernib", tipo: "lazo", nombre: "Todo descubrimiento sirve para algo", miembros: ["primer-engranaje", "alquimista-de-nernib"], texto: "En Nernib la innovación vale más que la nobleza.",
      niveles: [{ n: 2, ind: { "primer-engranaje": { pv: 1 }, "alquimista-de-nernib": { atq: 1 } } }] },
    { id: "granja", tipo: "lazo", nombre: "Contra las plagas de la granja", miembros: ["granjero-con-horca", "sapo-beluto"], texto: "El granjero cría al sapo y el sapo cuida los graneros.",
      niveles: [{ n: 2, ind: { "granjero-con-horca": { pv: 1 }, "sapo-beluto": { atq: 1 } } }] },
    { id: "exploradores", tipo: "lazo", nombre: "Mapas y ruinas", miembros: ["trazahorizontes", "el-desenterrador"], texto: "Una dibuja el mundo conocido y el otro busca lo que había antes.",
      niveles: [{ n: 2, ind: { trazahorizontes: { pv: 1 }, "el-desenterrador": { atq: 1 } } }] },
    { id: "templo-hospital", tipo: "lazo", nombre: "Templo y hospital", miembros: ["velador-de-umbrathil", "boticaria"], texto: "En Umbrathil los templos son también hospitales.",
      niveles: [{ n: 2, ind: { "velador-de-umbrathil": { pv: 1 }, boticaria: { pv: 1 } } }] },
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
    { id: "bestia-gigante", nombre: "Orden de Clef", bando: ["ulis"], contra: ["darian"],
      texto: "Clef le ordenó a Ulis atacar a Darian y ella se transformó en un monstruo ajolote grande. En la historia el ataque se canceló, pero en la mesa Ulis gana +3/+3 frente a él.",
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
    { id: "licencia-revocada", nombre: "La licencia", bando: ["magistrada-de-la-colmena"], contra: ["decano-de-los-fundamentos", "aprendiz-de-mago"],
      texto: "Las dos coinciden en cómo funciona un hechizo y discrepan en quién puede usarlo. La Magistrada gana +1 de ataque y hace 1 más contra los magos de Dolbred.",
      paraBando: { atq: 1, bonusContra: 1 }, paraContra: {} },
    { id: "utilidad-o-nada", nombre: "Utilidad o nada", bando: ["primer-engranaje"], contra: ["decano-de-los-fundamentos"],
      texto: "Nernib exige que cada descubrimiento sirva para algo y Dolbred persigue el saber por sí mismo. Se desprecian y los dos ganan +1 de ataque.",
      paraBando: { atq: 1 }, paraContra: { atq: 1 } },
    { id: "enemigo-declarado", nombre: "Enemigo declarado", bando: ["ceniza-coronada"], contra: ["el-primer-juramentado", "adam-kovacs", "caballero-de-brurland"],
      texto: "El Trono de Ceniza ocupa Broneland y los Caballeros del Reino juraron recuperarla. El soberano hace 1 más contra ellos y ellos ganan +1 de ataque.",
      paraBando: { bonusContra: 1 }, paraContra: { atq: 1 } },
    { id: "competencia-menor", nombre: "Competencia menor", bando: ["portador-del-sello-rojo"], contra: ["senora-de-la-madriguera"],
      texto: "Un fugitivo puede esconderse para siempre, pero una deuda siempre la paga alguien. Los dos se estorban y se pegan 1 más.",
      paraBando: { bonusContra: 1 }, paraContra: { bonusContra: 1 } },
    { id: "cada-dragon-que-cae", nombre: "Cada dragón que cae", bando: ["el-ultimo-matadragones"], contra: ["dragon-ancestral", "dragon-dorado", "dragon-de-magma", "draco", "dragarto", "protodraco"],
      texto: "El Matadragones puede desafiar a un dragón aunque haya Provocar. Cuando lo mata, roba una carta.",
      paraBando: {
        marca: true,
        alMatarContra: c => { c.M.log(c.est, `${c.M.nombre(c.est, c.u)} cobra el dragón.`); c.M.robar(c.est, c.j, 1); }
      }, paraContra: {} },
    { id: "robos-a-granjas", nombre: "Robos a granjas", bando: ["granjero-con-horca"], contra: ["gofiri-la-jauria", "hiena-de-la-jauria"],
      texto: "La Jauría se lleva lo que encuentra en las granjas. El granjero hace 2 más contra sus hienas.",
      paraBando: { bonusContra: 2 }, paraContra: {} },
    { id: "mala-fortuna", nombre: "Mala fortuna", bando: ["zraith"], contra: ["caballero-de-brurland", "el-primer-juramentado", "adam-kovacs"],
      texto: "Más de un caballero jura haber visto su silueta justo antes de una desgracia. Zraith gana +1 de ataque frente a ellos.",
      paraBando: { atq: 1 }, paraContra: {} },
    { id: "nadie-le-da-ordenes", nombre: "Nadie le da órdenes al Coronel", bando: ["coronel-tobi"], contra: ["rojo-ultimo-apunte"],
      texto: "Rojo no para de dar órdenes y el Coronel no las acepta: gana +2 de ataque mientras Rojo esté enfrente.",
      paraBando: { atq: 2 }, paraContra: {} }
  ];

  raiz.CARTAS_VINCULOS = { circulos, rivalidades };
  const base = { circulos: circulos.map(c => c.id), rivalidades: rivalidades.map(r => r.id) };

  /* Vínculos guardados en el servidor (tabla cartas_vinculos, los edita el editor de cartas). Cada fila
     reemplaza al vínculo con su id, lo crea si es nuevo o lo quita si trae borrado. En una rivalidad se
     conservan solo los efectos de código del archivo (alMatarContra, alMorirPropia...); los números son los de la fila. Se vuelve a aplicar
     desde cero cada vez, así que se puede llamar tras cada guardado. Una fila mal formada se ignora. */
  const lista = a => Array.isArray(a) && a.length && a.every(x => typeof x === "string") ? a : null;
  function valido(tipo, d) {
    if (!d || typeof d !== "object") return false;
    if (tipo === "rivalidad") return !!(lista(d.bando) && lista(d.contra));
    return !!(lista(d.miembros) && Array.isArray(d.niveles) && d.niveles.length && d.niveles.every(n => n && typeof n.n === "number"));
  }
  const soloCodigo = o => { const r = {}; Object.keys(o || {}).forEach(k => { if (typeof o[k] === "function") r[k] = o[k]; }); return r; };
  const originales = { circulos: circulos.slice(), rivalidades: rivalidades.slice() };
  raiz.aplicarVinculosServidor = function (filas) {
    const nuevos = { circulos: originales.circulos.slice(), rivalidades: originales.rivalidades.slice() };
    (filas || []).forEach(f => {
      try {
        const grupo = f.tipo === "rivalidad" ? nuevos.rivalidades : nuevos.circulos;
        const i = grupo.findIndex(x => x.id === f.id);
        if (f.borrado) { if (i >= 0) grupo.splice(i, 1); return; }
        if (!valido(f.tipo, f.data)) return;
        let v;
        if (f.tipo === "rivalidad") {
          const e = i >= 0 ? grupo[i] : {};
          v = Object.assign({}, f.data, { id: f.id,
            paraBando: Object.assign(soloCodigo(e.paraBando), f.data.paraBando),
            paraContra: Object.assign(soloCodigo(e.paraContra), f.data.paraContra) });
        } else {
          v = Object.assign({}, f.data, { id: f.id });
          if (f.tipo === "lazo") v.tipo = "lazo"; else delete v.tipo;
        }
        if (i >= 0) grupo[i] = v; else grupo.push(v);
      } catch (e) { /* una fila rota no debe tumbar el resto */ }
    });
    circulos.splice(0, circulos.length, ...nuevos.circulos);
    rivalidades.splice(0, rivalidades.length, ...nuevos.rivalidades);
    if (raiz.CartasMotor && raiz.CartasMotor.VINC) {
      raiz.CartasMotor.VINC.circulos.splice(0, raiz.CartasMotor.VINC.circulos.length, ...circulos);
      raiz.CartasMotor.VINC.rivalidades.splice(0, raiz.CartasMotor.VINC.rivalidades.length, ...rivalidades);
    }
  };
  /* Las listas tal como vienen del archivo (para mostrar «restaurar» en el editor) */
  raiz.vinculosBase = () => ({ circulos: base.circulos.slice(), rivalidades: base.rivalidades.slice() });
  /* Para el álbum: los vínculos amistosos de una carta (los de rivalidad son secretos) */
  raiz.vinculosDeCarta = id => circulos.filter(c => c.miembros.includes(id) || (c.completo && (c.completo.requiere || []).includes(id)));
  if (raiz.CartasMotor) raiz.CartasMotor.registrarVinculos(raiz.CARTAS_VINCULOS);
  else raiz.__registrarVinculosCartas = M => M.registrarVinculos(raiz.CARTAS_VINCULOS);
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.CARTAS_VINCULOS;
})(typeof window !== "undefined" ? window : globalThis);
