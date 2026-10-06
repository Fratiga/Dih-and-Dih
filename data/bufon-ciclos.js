/* =============================================================================
   CICLOS Y TEMAS DEL BUFÓN — formato declarativo.

   Un CICLO es un bloque de contenido con su propio interruptor (abierto o
   cerrado) y sus propios temas. Se escribe en un archivo aparte,
   data/bufon-ciclo-<id>.js, llamando a bufonAgregarCiclo({...}). Este
   archivo (el constructor) convierte esa descripción en nodos, elecciones,
   botones del menú y recuerdos espontáneos, y los suma al árbol que ya
   existe en data/bufon-contenido.js. No hace falta tocar el motor
   (secreto.html) para agregar un ciclo ni un tema.

   Para crear uno sin escribir esto a mano, usar las herramientas:
     node tools/bufon/bufon.js nuevo-ciclo <id> "Nombre"
     node tools/bufon/bufon.js nuevo-tema <ciclo> <id> "Texto del botón"
   y leer tools/bufon/LEEME.md.

   FORMATO

     bufonAgregarCiclo({
       id: "fase3",                 // a-z, 0-9 y _ ; único
       nombre: "Fase 3",
       abierto: false,              // el interruptor. Admin siempre ve todo.
       requiere: ["gen2"],          // "gen2" = la generación 2 de SU lado ya
                                    // se desbloqueó. "ciclo:<id>" = ese otro
                                    // ciclo ya está abierto.
       lados: ["A", "B"],           // opcional: omitir = los dos lados
       temas: [ ...ver abajo... ],
       nodos: { ... },              // opcional: nodos sueltos, formato de siempre
       elecciones: { ... },         // opcional
       recuerdos: [ ... ]           // opcional: candidatos espontáneos, formato
                                    // de RECUERDOS_DISPONIBLES (prioridad puede
                                    // ser "RECUERDO", "GAG", "DESPERTAR", "CRITICO")
     });

   TEMA (un personaje o asunto con varias preguntas)

     {
       id: "teros",
       boton: "Cuéntame otra vez lo del minotauro.",
         // botón del menú principal. Aparece cuando el tema ya empezó y se
         // esconde solo cuando no queda nada pendiente.
       visibleSi: ctx => true,
         // opcional: condición extra (hechos, nombres, Voces...).
       intro: {
         como: "recuerdo",          // "recuerdo" = el Bufón lo trae solo la
                                    // primera vez ; "boton" = el botón aparece
                                    // desde el principio
         lineas: ["...", "..."],
         animacion: "Parado",       // opcional
         risa: 2000                 // opcional: risa del Bufón, en milisegundos
       },
       preguntas: [                 // se destapan según "requiere"
         { id: "quien", texto: "¿Quién era?", lineas: [...], requiere: [] },
         { id: "templo", texto: "...", lineas: [...], requiere: ["quien"] }
       ],
       grupos: [                    // respuestas MUTUAMENTE EXCLUYENTES: al
                                    // elegir una, las otras desaparecen
         { id: "merecia", requiere: ["final"], opciones: [
             { id: "si",   texto: "Sí.",       lineas: [...] },
             { id: "no",   texto: "No.",       lineas: [...] },
             { id: "nose", texto: "No lo sé.", lineas: [...], neutral: true }
         ] }
       ]
     }

   Una línea puede ser un texto, o { voz: "herida", texto: "..." } para la
   interjección de una Voz interna. Reglas de estilo: ver LEEME.md.

   IDS QUE SE GENERAN (útiles para ramificar desde otros temas)
     nodo de la intro            bufon_<tema>_intro
     marca de intro vista        <tema>_intro_seen
     nodo de una pregunta        bufon_<tema>_<pregunta>
     marca de pregunta hecha     <tema>_<pregunta>      (hasCompletedDialogue)
     nodo de una respuesta       bufon_<tema>_<grupo>_<opcion>
     marca de respuesta          <tema>_<grupo>_<opcion>
     submenú                     <tema>_hub
     botón del menú principal    <ciclo>_<tema>
============================================================================= */
(function () {
  const D = window.BUFON_DIALOGO;
  window.BUFON_CICLOS = window.BUFON_CICLOS || {};
  window.BUFON_RECUERDOS_MODULOS = window.BUFON_RECUERDOS_MODULOS || [];
  window.BUFON_ERRORES_CICLOS = window.BUFON_ERRORES_CICLOS || [];
  window.BUFON_AVISOS_CICLOS = window.BUFON_AVISOS_CICLOS || [];

  const ID_VALIDO = /^[a-z0-9_]+$/;
  const PRIORIDADES = ["CRITICO", "DESPERTAR", "GAG", "RECUERDO"];

  function fallar(txt) { throw new Error(txt); }
  function avisar(txt) { window.BUFON_AVISOS_CICLOS.push(txt); }

  function validarLineas(donde, lineas) {
    if (!Array.isArray(lineas) || !lineas.length) fallar(donde + ": 'lineas' debe ser una lista con al menos una línea");
    lineas.forEach((l, i) => {
      if (typeof l === "string") {
        if (!l.trim()) fallar(donde + ": la línea " + (i + 1) + " está vacía");
      } else if (!(l && typeof l === "object" && typeof l.texto === "string" && typeof l.voz === "string")) {
        fallar(donde + ": la línea " + (i + 1) + " debe ser un texto o { voz, texto }");
      }
    });
  }

  function nuevoNodo(id, nodo) {
    if (D.nodos[id]) fallar('el nodo "' + id + '" ya existe (¿id repetido o choca con otro tema?)');
    D.nodos[id] = nodo;
  }

  function construirTema(cid, t) {
    const tid = t && t.id;
    if (!ID_VALIDO.test(tid || "")) fallar("tema sin id válido (a-z, 0-9 y _)");
    const donde = 'ciclo "' + cid + '", tema "' + tid + '"';
    if (typeof t.boton !== "string" || !t.boton.trim()) fallar(donde + ": falta 'boton' (el texto del menú principal)");
    if (!t.intro) fallar(donde + ": falta 'intro'");
    validarLineas(donde + ", intro", t.intro.lineas);

    const pre = tid + "_";
    const hubId = tid + "_hub";
    const introMarca = pre + "intro_seen";
    const preguntas = t.preguntas || [];
    const grupos = t.grupos || [];
    const idsPregunta = new Set();
    const idsGrupo = new Set();

    preguntas.forEach(p => {
      if (!ID_VALIDO.test(p.id || "")) fallar(donde + ": pregunta sin id válido");
      if (idsPregunta.has(p.id)) fallar(donde + ': pregunta "' + p.id + '" repetida');
      idsPregunta.add(p.id);
      if (typeof p.texto !== "string" || !p.texto.trim()) fallar(donde + ', pregunta "' + p.id + '": falta el texto del botón');
      validarLineas(donde + ', pregunta "' + p.id + '"', p.lineas);
    });
    grupos.forEach(g => {
      if (!ID_VALIDO.test(g.id || "")) fallar(donde + ": grupo sin id válido");
      if (idsGrupo.has(g.id) || idsPregunta.has(g.id)) fallar(donde + ': el id "' + g.id + '" ya lo usa otra pregunta o grupo');
      idsGrupo.add(g.id);
      if (!Array.isArray(g.opciones) || g.opciones.length < 2) fallar(donde + ', grupo "' + g.id + '": necesita al menos 2 opciones');
      const vistos = new Set();
      g.opciones.forEach(o => {
        if (!ID_VALIDO.test(o.id || "")) fallar(donde + ', grupo "' + g.id + '": opción sin id válido');
        if (vistos.has(o.id)) fallar(donde + ', grupo "' + g.id + '": opción "' + o.id + '" repetida');
        vistos.add(o.id);
        if (typeof o.texto !== "string" || !o.texto.trim()) fallar(donde + ', grupo "' + g.id + '", opción "' + o.id + '": falta el texto');
        validarLineas(donde + ', grupo "' + g.id + '", opción "' + o.id + '"', o.lineas);
      });
      if (!g.opciones.some(o => o.neutral)) {
        avisar(donde + ', grupo "' + g.id + '": ninguna opción marcada neutral:true. Las respuestas excluyentes deben incluir una salida neutral ("No lo sé") para no forzar al jugador a tomar partido.');
      }
    });
    [...preguntas, ...grupos].forEach(x => (x.requiere || []).forEach(r => {
      if (!idsPregunta.has(r) && !idsGrupo.has(r)) fallar(donde + ', "' + x.id + '": requiere "' + r + '", que no es ninguna pregunta ni grupo de este tema');
      if (r === x.id) fallar(donde + ', "' + x.id + '": se requiere a sí mismo');
    }));

    const marcaGrupoOpcion = (g, o) => pre + g.id + "_" + o.id;
    const grupoHecho = (ctx, g) => g.opciones.some(o => ctx.hasCompletedDialogue(marcaGrupoOpcion(g, o)));
    const cumple = (ctx, r) => idsPregunta.has(r)
      ? ctx.hasCompletedDialogue(pre + r)
      : grupoHecho(ctx, grupos.find(g => g.id === r));
    const requisitosOk = (ctx, x) => (x.requiere || []).every(r => cumple(ctx, r));
    const agotado = ctx => preguntas.every(p => ctx.hasCompletedDialogue(pre + p.id)) && grupos.every(g => grupoHecho(ctx, g));
    const extra = ctx => !t.visibleSi || t.visibleSi(ctx);

    const decorar = (nodo, src) => {
      if (src.animacion) nodo.animacion = src.animacion;
      if (src.risa) nodo.risa = src.risa;
      return nodo;
    };

    // Intro
    nuevoNodo("bufon_" + pre + "intro", decorar({
      lineas: t.intro.lineas, completeDialogue: introMarca, eleccion: hubId
    }, t.intro));
    // Preguntas
    preguntas.forEach(p => nuevoNodo("bufon_" + pre + p.id, decorar({
      lineas: p.lineas, completeDialogue: pre + p.id, eleccion: hubId
    }, p)));
    // Respuestas de cada grupo (al contestar, el tema termina: vuelve al menú)
    grupos.forEach(g => g.opciones.forEach(o => nuevoNodo("bufon_" + pre + g.id + "_" + o.id, decorar({
      lineas: o.lineas, completeDialogue: marcaGrupoOpcion(g, o), next: g.despues || "intro_reason_sin_recuerdo"
    }, o))));

    // Submenú
    if (D.elecciones[hubId]) fallar('la elección "' + hubId + '" ya existe');
    const opciones = [];
    preguntas.forEach(p => {
      const op = {
        id: pre + p.id, texto: p.texto, next: "bufon_" + pre + p.id,
        visible: ctx => ctx.cicloAbierto(cid) && requisitosOk(ctx, p) && !ctx.hasCompletedDialogue(pre + p.id)
      };
      if (p.voz) op.voz = p.voz;
      opciones.push(op);
    });
    grupos.forEach(g => g.opciones.forEach(o => opciones.push({
      id: marcaGrupoOpcion(g, o), texto: o.texto, next: "bufon_" + pre + g.id + "_" + o.id,
      visible: ctx => ctx.cicloAbierto(cid) && requisitosOk(ctx, g) && !grupoHecho(ctx, g)
    })));
    opciones.push({ id: pre + "cerrar", texto: t.cerrar || "Ya fue, sigamos con otra cosa.", next: "intro_reason_sin_recuerdo" });
    D.elecciones[hubId] = { opciones };

    // Botón del menú principal
    const comoBoton = t.intro.como === "boton";
    const idBoton = cid + "_" + tid;
    if (D.elecciones.intro_reason.opciones.some(o => o.id === idBoton)) fallar('el botón "' + idBoton + '" ya existe');
    D.elecciones.intro_reason.opciones.push({
      id: idBoton, texto: t.boton,
      visible: ctx => ctx.cicloAbierto(cid) && extra(ctx)
        && (comoBoton || ctx.hasCompletedDialogue(introMarca))
        && !agotado(ctx),
      next: ctx => ctx.hasCompletedDialogue(introMarca) ? hubId : "bufon_" + pre + "intro"
    });

    // Recuerdo espontáneo (el Bufón trae el tema solo, la primera vez)
    if (!comoBoton) {
      window.BUFON_RECUERDOS_MODULOS.push({
        prioridad: t.prioridad || "RECUERDO",
        condicion: ctx => ctx.cicloAbierto(cid) && extra(ctx) && !ctx.hasCompletedDialogue(introMarca),
        nodo: "bufon_" + pre + "intro"
      });
    }

    window.BUFON_CICLOS[cid].temas.push({
      id: tid, boton: t.boton, preguntas: preguntas.length, grupos: grupos.length,
      nodos: Object.keys(D.nodos).filter(n => n.indexOf("bufon_" + pre) === 0)
    });
  }

  function construirCiclo(cfg) {
    if (!cfg || !ID_VALIDO.test(cfg.id || "")) fallar("ciclo sin id válido (a-z, 0-9 y _)");
    if (window.BUFON_CICLOS[cfg.id]) fallar('el ciclo "' + cfg.id + '" ya existe');
    (cfg.requiere || []).forEach(r => {
      if (r !== "gen2" && !/^ciclo:[a-z0-9_]+$/.test(r)) fallar('requiere "' + r + '" no es válido (usar "gen2" o "ciclo:<id>")');
    });
    window.BUFON_CICLOS[cfg.id] = {
      id: cfg.id, nombre: cfg.nombre || cfg.id, abierto: cfg.abierto === true,
      requiere: cfg.requiere || [], lados: cfg.lados || null, temas: [],
      // La descripción original, para que el Laboratorio del Bufón (panel de
      // Admin) pueda cargar un ciclo existente en su editor.
      def: cfg
    };
    (cfg.temas || []).forEach(t => construirTema(cfg.id, t));
    Object.keys(cfg.nodos || {}).forEach(id => nuevoNodo(id, cfg.nodos[id]));
    Object.keys(cfg.elecciones || {}).forEach(id => {
      if (D.elecciones[id]) fallar('la elección "' + id + '" ya existe');
      D.elecciones[id] = cfg.elecciones[id];
    });
    (cfg.recuerdos || []).forEach(r => {
      if (typeof r.prioridad === "string" && PRIORIDADES.indexOf(r.prioridad) < 0) fallar('prioridad "' + r.prioridad + '" no válida');
      window.BUFON_RECUERDOS_MODULOS.push(r);
    });
  }

  // Un ciclo mal escrito se anota y se salta; nunca rompe la página ni el
  // resto del Bufón. Las herramientas (tools/bufon) lo reportan como error.
  window.bufonAgregarCiclo = function (cfg) {
    try {
      construirCiclo(cfg);
    } catch (e) {
      window.BUFON_ERRORES_CICLOS.push((cfg && cfg.id ? cfg.id + ": " : "") + e.message);
      if (typeof console !== "undefined") console.error("[bufon-ciclos] " + e.message);
    }
  };
})();
