/* =============================================================================
   IMPORTADOR DE PDF — adaptador específico para la plantilla de
   "ficha DND (3).pdf". Los nombres de campo de este AcroForm son genéricos
   (page0_field4, Text_16, etc.), así que no hay forma de adivinar qué es
   qué sin conocer ESTA plantilla puntual — de ahí el patrón de adaptador:
   el día que aparezca otra plantilla, se agrega otro archivo
   fichas-pdf-<nombre>.js con la misma forma (detectar + importar) y se
   suma a FICHAS_PDF_ADAPTADORES en fichas-ui.js, sin tocar este.

   Mapeo de campos verificado contra el PDF real (no solo contra el spec):
     page0_field4  -> nombre
     page0_field3  -> raza
     page0_field2  -> clase
     page0_field5  -> nivel
     Text_16..21   -> Fuerza, Destreza, Constitución, Inteligencia, Sabiduría, Carisma
     Text_5        -> CA
     Text_6        -> PV máximos
     page0_field6  -> PV actuales (a veces viene con basura tipo ":3")
     page0_field8  -> iniciativa (total, no el ajuste)
     page0_field9  -> velocidad
     page0_field7  -> nombres de armas (una por línea)
     Text_8        -> daños de armas (una por línea, alineado con field7)
     page0_field10 -> competencias/habilidades escritas en texto libre
     page0_field15 -> inventario en texto libre
     Text_22..27   -> totales ESCRITOS de salvaciones (solo referencia:
                      spec pide recalcular desde atributos, no confiar en
                      esto para decidir competencia/pericia/ajuste)

   Nunca se toman los modificadores/totales escritos como fuente de verdad
   para lo que la ficha puede recalcular sola — se recalculan desde los
   atributos. Lo que no se puede derivar con seguridad se deja en
   "pendientesRevision" para que el jugador lo confirme a mano.
============================================================================= */

function fichasPdfLaiaId() { return "pdf-laia"; }

function fichasTextoCampo(form, nombre) {
  try {
    const campo = form.getTextField(nombre);
    const v = campo.getText();
    return v == null ? "" : v.trim();
  } catch (e) {
    return "";
  }
}

/* true si el PDF cargado tiene la forma de ESTA plantilla puntual. */
function fichasPdfLaiaDetectar(form) {
  const nombres = new Set(form.getFields().map(f => f.getName()));
  return ["page0_field4", "page0_field3", "page0_field2", "Text_16", "Text_17"]
    .every(n => nombres.has(n));
}

function fichasParsearEnteroLimpio(texto) {
  if (texto == null) return { valor: null, limpio: true };
  const t = String(texto).trim();
  if (t === "") return { valor: null, limpio: true };
  if (/^-?\d+$/.test(t)) return { valor: parseInt(t, 10), limpio: true };
  // Algo como ":3" — se rescata el número, pero se marca para revisar.
  const m = t.match(/-?\d+/);
  return { valor: m ? parseInt(m[0], 10) : null, limpio: false, crudo: t };
}

/* Devuelve { personaje, pendientesRevision } — personaje ya tiene la forma
   de fichasPersonajeVacio(), listo para mostrarse en la pantalla de
   revisión (nunca se guarda directo, sección 15 del spec). */
function fichasPdfLaiaImportar(form) {
  const pendientes = [];
  const personaje = fichasPersonajeVacio();
  personaje.importado = { origen: fichasPdfLaiaId(), pendientesRevision: pendientes };

  personaje.identidad.nombre = fichasTextoCampo(form, "page0_field4");
  personaje.identidad.raza = fichasTextoCampo(form, "page0_field3");
  personaje.identidad.clase = fichasTextoCampo(form, "page0_field2");

  const nivel = fichasParsearEnteroLimpio(fichasTextoCampo(form, "page0_field5"));
  personaje.identidad.nivelTotal = nivel.valor ?? 1;
  if (!nivel.limpio) pendientes.push(`Nivel: el PDF traía "${nivel.crudo}", revisa que sea correcto.`);

  const ORDEN_ATRIBUTOS = ["fue", "des", "con", "int", "sab", "car"];
  const CAMPOS_ATRIBUTOS = ["Text_16", "Text_17", "Text_18", "Text_19", "Text_20", "Text_21"];
  ORDEN_ATRIBUTOS.forEach((attr, i) => {
    const r = fichasParsearEnteroLimpio(fichasTextoCampo(form, CAMPOS_ATRIBUTOS[i]));
    personaje.atributos[attr] = r.valor ?? 10;
    if (!r.limpio) pendientes.push(`Atributo ${attr}: el PDF traía "${r.crudo}", revisa el valor.`);
  });

  const ca = fichasParsearEnteroLimpio(fichasTextoCampo(form, "Text_5"));
  personaje.combate.ca.modo = "manual";
  personaje.combate.ca.manual = ca.valor ?? 10;
  if (!ca.limpio) pendientes.push(`CA: el PDF traía "${ca.crudo}", revisa el valor.`);

  const pvMax = fichasParsearEnteroLimpio(fichasTextoCampo(form, "Text_6"));
  personaje.combate.pvMax = pvMax.valor ?? 0;
  if (!pvMax.limpio) pendientes.push(`PV máximos: el PDF traía "${pvMax.crudo}", revisa el valor.`);

  const pvActual = fichasParsearEnteroLimpio(fichasTextoCampo(form, "page0_field6"));
  // Este campo suele venir con basura tipo ":3" no porque el dato esté
  // corrupto, sino porque en esta mesa los PV actuales no se llevan en el
  // PDF — se siguen en vivo desde Roll20. Por eso, si no es un número
  // limpio, no tiene sentido "rescatar" un dígito de ahí (podría no tener
  // ninguna relación con los PV reales): se parte de PV máximos, que es
  // el único punto de partida razonable, y se avisa para que se ajuste a
  // mano si la partida ya está en curso.
  if (pvActual.limpio) {
    personaje.combate.pvActual = pvActual.valor ?? personaje.combate.pvMax;
  } else {
    personaje.combate.pvActual = personaje.combate.pvMax;
    pendientes.push(`PV actuales: el PDF traía "${pvActual.crudo}", que en esta plantilla suele significar que los PV actuales no se llevan ahí (se siguen desde Roll20). Se dejó en el máximo (${personaje.combate.pvMax}), ajústalo a los PV reales si la partida ya está en curso.`);
  }

  const iniciativaTotalPdf = fichasParsearEnteroLimpio(fichasTextoCampo(form, "page0_field8"));
  if (iniciativaTotalPdf.valor != null) {
    const modDes = fichasModificador(personaje.atributos.des);
    personaje.combate.iniciativaAjuste = iniciativaTotalPdf.valor - modDes;
    if (personaje.combate.iniciativaAjuste !== 0) {
      pendientes.push(`Iniciativa: el PDF decía ${fichasSigno(iniciativaTotalPdf.valor)} pero el modificador de Destreza da ${fichasSigno(modDes)}. Se guardó un ajuste manual de ${fichasSigno(personaje.combate.iniciativaAjuste)} para que el total siga cerrando, revísalo.`);
    }
  }
  if (!iniciativaTotalPdf.limpio && iniciativaTotalPdf.crudo) {
    pendientes.push(`Iniciativa: el PDF traía "${iniciativaTotalPdf.crudo}", revisa el valor.`);
  }

  const velocidad = fichasParsearEnteroLimpio(fichasTextoCampo(form, "page0_field9"));
  personaje.combate.velocidad = velocidad.valor ?? 30;

  // Armas: dos campos multilínea alineados por índice.
  const nombresArmas = fichasTextoCampo(form, "page0_field7").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const danosArmas = fichasTextoCampo(form, "Text_8").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  nombresArmas.forEach((nombre, i) => {
    personaje.ataques.push({
      id: fichasNuevoId(),
      nombre,
      atributo: "fue",
      competente: true,
      ajusteAtaque: 0,
      dano: danosArmas[i] || "",
      tipoDano: "",
      alcance: "",
      municionActual: null,
      municionMax: null,
      propiedades: "",
      notas: "Importado del PDF: el ataque total no venía desglosado, revisa atributo/competencia/bonificación."
    });
  });
  if (nombresArmas.length) {
    pendientes.push(`Ataques (${nombresArmas.length}): se importaron con Fuerza y competencia por defecto, y sin tipo de daño, el PDF no distinguía eso. Ajústalos a mano.`);
  }

  // Texto libre que no se puede parsear con seguridad: se conserva, no se descarta.
  const competenciasTexto = fichasTextoCampo(form, "page0_field10");
  const inventarioTexto = fichasTextoCampo(form, "page0_field15");
  if (competenciasTexto) {
    personaje.identidad.notasPublicas = `Competencias/habilidades importadas del PDF (texto libre, revisar y pasar a los campos correspondientes):\n${competenciasTexto}`;
    pendientes.push("Competencias y habilidades: quedaron como texto en Notas — no se pudieron repartir solas entre las habilidades de la ficha.");
  }
  if (inventarioTexto) {
    personaje.inventario.objetos.push({
      id: fichasNuevoId(),
      nombre: "Inventario importado del PDF",
      cantidad: 1,
      peso: null,
      estado: "guardado",
      descripcion: inventarioTexto,
      notas: "Revisar y separar en objetos individuales si hace falta.",
      cargasActuales: null,
      cargasMax: null,
      valor: null
    });
    pendientes.push("Inventario: quedó como un solo objeto con todo el texto. Sepáralo en la pestaña Inventario si quieres cada cosa por separado.");
  }

  // Totales de salvación escritos en el PDF: solo referencia, nunca se
  // usan para decidir competencia/pericia/ajuste (eso sería adivinar).
  const CAMPOS_SALVACIONES = ["Text_22", "Text_23", "Text_24", "Text_25", "Text_26", "Text_27"];
  const salvacionesTexto = ORDEN_ATRIBUTOS
    .map((attr, i) => `${attr}: ${fichasTextoCampo(form, CAMPOS_SALVACIONES[i]) || "—"}`)
    .join(", ");
  pendientes.push(`Salvaciones: el PDF traía estos totales escritos (${salvacionesTexto}), pero no decían si venían de competencia, pericia o un ajuste manual. No se aplicaron solos: marca "competente" donde corresponda y la ficha recalcula.`);

  return { personaje, pendientesRevision: pendientes };
}

/* Punto de entrada: recibe el ArrayBuffer del archivo ya leído (fichas-ui.js
   hace el FileReader), devuelve { adaptador, personaje, pendientesRevision }
   o lanza si ningún adaptador conocido reconoce el PDF. */
async function fichasImportarPdf(arrayBuffer) {
  if (!window.PDFLib) throw new Error("No se pudo cargar el lector de PDF (sin conexión a internet?).");
  const pdf = await window.PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const form = pdf.getForm();

  if (fichasPdfLaiaDetectar(form)) {
    const { personaje, pendientesRevision } = fichasPdfLaiaImportar(form);
    return { adaptador: "Ficha D&D (plantilla de referencia)", personaje, pendientesRevision };
  }

  throw new Error("Este PDF no coincide con ninguna plantilla reconocida todavía. Por ahora solo se puede importar la plantilla de referencia (la misma estructura que ficha DND (3).pdf).");
}
