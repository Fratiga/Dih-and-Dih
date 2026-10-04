/* =============================================================================
   IMPORTADOR DE PDF — adaptador para la hoja de personaje D&D 5e de Roll20
   (en español) impresa a PDF. Ese PDF no tiene campos de formulario: es texto
   dibujado en posiciones fijas, así que se lee con pdf.js (se carga solo
   cuando hace falta) y se interpreta por posición, anclado a las etiquetas
   de la hoja ("NOMBRE DE PERSONAJE", "FUERZA", "TIRADAS DE SALVACIÓN"...).

   Qué trae y qué no: la hoja impresa muestra totales (por ejemplo "+5" de
   ataque o "4" en Perspicacia), no de dónde salen. Por eso la competencia en
   salvaciones y habilidades se DEDUCE comparando el total con el modificador
   del atributo y el bono de competencia, y lo que no se puede saber con
   certeza (PV, bonos raciales, tipo de dado de golpe...) queda en
   "pendientes de revisión" para que el jugador lo confirme. Nunca se guarda
   directo: siempre pasa por la pantalla de revisión.
============================================================================= */

const FICHAS_PDFJS_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
const FICHAS_PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

function fichasPdfRoll20Id() { return "pdf-roll20-5e"; }

/* --- Lectura con pdf.js ---------------------------------------------------- */
function fichasCargarScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("No se pudo cargar " + src));
    document.head.appendChild(s);
  });
}

async function fichasPdfRoll20Extraer(arrayBuffer) {
  if (!window.pdfjsLib) await fichasCargarScript(FICHAS_PDFJS_URL);
  const pdfjs = window.pdfjsLib;
  if (!pdfjs) throw new Error("No se pudo cargar el lector de PDF (¿sin conexión a internet?).");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    // El worker tiene que ser del mismo origen: se baja el código y se sirve como blob.
    const codigo = await (await fetch(FICHAS_PDFJS_WORKER_URL)).text();
    pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([codigo], { type: "text/javascript" }));
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) }).promise;
  const paginas = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const contenido = await (await doc.getPage(n)).getTextContent();
    paginas.push(contenido.items
      .filter(i => i.str && i.str.trim() !== "")
      .map(i => ({ str: i.str.trim(), x: i.transform[4], y: i.transform[5] })));
  }
  return paginas;
}

/* --- Utilidades de posición ----------------------------------------------- */
function fichasR20Sin(texto) {
  return String(texto).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\./g, "").replace(/\s+/g, " ").trim();
}

function fichasR20Etiqueta(items, texto) {
  const t = fichasR20Sin(texto);
  return items.find(i => fichasR20Sin(i.str) === t) || null;
}

/* Valor escrito justo ENCIMA de una etiqueta (en esta hoja las etiquetas van debajo del campo). */
function fichasR20ValorSobre(items, etiqueta, { maxDist = 30, tolX = 45 } = {}) {
  if (!etiqueta) return "";
  const candidatos = items
    .filter(i => i.y > etiqueta.y && i.y - etiqueta.y <= maxDist && Math.abs(i.x - etiqueta.x) <= tolX)
    .sort((a, b) => (a.y - etiqueta.y) - (b.y - etiqueta.y));
  return candidatos.length ? candidatos[0].str : "";
}

/* Agrupa en líneas (mismo y, ±2) ordenadas de arriba hacia abajo. La hoja
   tiene varias columnas con texto a la misma altura, así que siempre se
   agrupa dentro de una franja horizontal (xMin..xMax), nunca a lo ancho. */
function fichasR20LineasEn(items, xMin, xMax) {
  return fichasR20Lineas(items.filter(i => i.x >= xMin && i.x < xMax));
}

function fichasR20Lineas(items) {
  const orden = items.slice().sort((a, b) => b.y - a.y || a.x - b.x);
  const lineas = [];
  orden.forEach(it => {
    const l = lineas.find(x => Math.abs(x.y - it.y) <= 2);
    if (l) l.items.push(it); else lineas.push({ y: it.y, items: [it] });
  });
  lineas.forEach(l => l.items.sort((a, b) => a.x - b.x));
  lineas.forEach(l => { l.texto = l.items.map(i => i.str).join(" "); l.x = l.items[0].x; });
  return lineas;
}

function fichasR20Entero(texto) {
  const m = String(texto == null ? "" : texto).trim().match(/^[+-]?\d+$/);
  return m ? parseInt(texto, 10) : null;
}

/* --- Detección -------------------------------------------------------------- */
function fichasPdfRoll20Detectar(paginas) {
  if (!paginas.length) return false;
  const p1 = paginas[0];
  return !!fichasR20Etiqueta(p1, "NOMBRE DE PERSONAJE")
    && !!fichasR20Etiqueta(p1, "FUERZA")
    && p1.some(i => /TIRADAS DE SALVACI/i.test(i.str));
}

/* --- Importación -------------------------------------------------------------
   Devuelve { personaje, pendientesRevision }. */
function fichasPdfRoll20Importar(paginas) {
  const pendientes = [];
  const personaje = fichasPersonajeVacio();
  personaje.importado = { origen: fichasPdfRoll20Id(), pendientesRevision: pendientes };
  const p1 = paginas[0];
  const lineasIzq = fichasR20LineasEn(p1, 95, 215);
  const lineasCentro = fichasR20LineasEn(p1, 215, 400);
  const lineasDer = fichasR20LineasEn(p1, 400, 700);

  /* Identidad */
  personaje.identidad.nombre = fichasR20ValorSobre(p1, fichasR20Etiqueta(p1, "NOMBRE DE PERSONAJE"), { tolX: 80 });
  const claseNivel = fichasR20ValorSobre(p1, p1.find(i => /^CLASE/i.test(i.str) && /NIVEL/i.test(i.str)), { tolX: 60 });
  const mClase = claseNivel.match(/^(.*?)\s*(\d+)$/);
  if (mClase) {
    personaje.identidad.clase = mClase[1].trim();
    personaje.identidad.nivelTotal = parseInt(mClase[2], 10);
  } else {
    personaje.identidad.clase = claseNivel;
    pendientes.push("Clase y nivel: no se pudo separar el nivel de la clase, revísalos.");
  }
  personaje.identidad.raza = fichasR20ValorSobre(p1, fichasR20Etiqueta(p1, "RAZA"), { tolX: 60 });
  personaje.identidad.trasfondo = fichasR20ValorSobre(p1, fichasR20Etiqueta(p1, "TRASFONDO"), { tolX: 60 });
  personaje.identidad.alineamiento = fichasR20ValorSobre(p1, fichasR20Etiqueta(p1, "ALINEAMIENTO"), { tolX: 60 });

  /* Atributos: bajo cada nombre vienen el modificador y luego la puntuación */
  const ATRIBUTOS = [["FUERZA", "fue"], ["DESTREZA", "des"], ["CONSTITUCION", "con"], ["INTELIGENCIA", "int"], ["SABIDURIA", "sab"], ["CARISMA", "car"]];
  ATRIBUTOS.forEach(([nombre, id]) => {
    const et = p1.find(i => fichasR20Sin(i.str) === nombre.toLowerCase());
    const bajo = et ? p1.filter(i => i.y < et.y && et.y - i.y < 60 && Math.abs(i.x - et.x) < 40 && fichasR20Entero(i.str) !== null).sort((a, b) => b.y - a.y) : [];
    const puntuacion = bajo.length >= 2 ? fichasR20Entero(bajo[1].str) : null;
    if (puntuacion === null) {
      pendientes.push(`Atributo ${id.toUpperCase()}: no se encontró en el PDF, se dejó en 10.`);
      personaje.atributos[id] = 10;
    } else {
      personaje.atributos[id] = puntuacion;
    }
  });
  pendientes.push("Atributos: se tomaron las puntuaciones finales del PDF. Si tu raza da bonos, ficha los separa en 'Bonos, feats y competencia'; aquí quedaron todos incluidos en el valor.");

  const mod = id => fichasModificador(personaje.atributos[id]);

  /* Bono de competencia */
  let competencia = 2;
  const lineaComp = lineasIzq.find(l => /BONIFICACI.N POR COMPETENCIA/i.test(l.texto));
  if (lineaComp) {
    const n = fichasR20Entero(lineaComp.items[0].str);
    if (n !== null) competencia = n;
  }
  const baseComp = fichasCompetenciaBase(personaje.identidad.nivelTotal);
  if (competencia !== baseComp) {
    personaje.competenciaAjusteManual = competencia - baseComp;
    pendientes.push(`Competencia: el PDF dice +${competencia} pero el nivel ${personaje.identidad.nivelTotal} da +${baseComp}. Se guardó un ajuste manual de ${fichasSigno(competencia - baseComp)}.`);
  }

  /* CA, iniciativa y velocidad: tres números en la misma línea */
  const lineaVitales = lineasCentro.find(l => l.items.length === 3 && l.items.every(i => fichasR20Entero(i.str) !== null));
  if (lineaVitales) {
    const [ca, ini, vel] = lineaVitales.items.map(i => fichasR20Entero(i.str));
    personaje.combate.ca.modo = "manual";
    personaje.combate.ca.manual = ca;
    personaje.combate.iniciativaAjuste = ini - mod("des");
    personaje.combate.velocidad = vel;
    if (personaje.combate.iniciativaAjuste !== 0) {
      pendientes.push(`Iniciativa: el PDF dice ${fichasSigno(ini)} y Destreza da ${fichasSigno(mod("des"))}; se guardó un ajuste de ${fichasSigno(personaje.combate.iniciativaAjuste)}.`);
    }
  } else {
    pendientes.push("CA, iniciativa y velocidad: no se encontraron en el PDF, completa esos datos a mano.");
  }

  /* PV: la hoja impresa deja esos campos vacíos si no estaban rellenos */
  const pvMax = fichasR20Entero(fichasR20ValorSobre(p1, p1.find(i => /^Puntos de Golpe M.ximos$/i.test(i.str)), { maxDist: 40, tolX: 60 }));
  if (pvMax !== null) {
    personaje.combate.pvMax = pvMax;
    personaje.combate.pvActual = pvMax;
  } else {
    pendientes.push("Puntos de golpe: el PDF no traía los PV máximos (estaban vacíos en Roll20). Escríbelos en la pestaña Combate.");
  }
  const dados = p1.find(i => fichasR20Entero(i.str) !== null && i.x > 255 && i.x < 285 && i.y > 470 && i.y < 510);
  if (dados) {
    personaje.combate.dadosGolpe.max = fichasR20Entero(dados.str);
    personaje.combate.dadosGolpe.actuales = fichasR20Entero(dados.str);
    pendientes.push("Dados de golpe: se tomó la cantidad del PDF, pero no dice de qué dado (d6, d8, d10...). Ajusta el tipo en Combate.");
  }

  /* Salvaciones y habilidades: se deduce la competencia de total - modificador */
  const clasificar = (total, modificador) => {
    const diff = total - modificador;
    if (diff === 0) return { nivel: "ninguna", ajuste: 0 };
    if (diff === competencia) return { nivel: "competente", ajuste: 0 };
    if (diff === competencia * 2) return { nivel: "pericia", ajuste: 0 };
    return { nivel: "ninguna", ajuste: diff, raro: true };
  };

  const NOMBRES_SALVACION = { fuerza: "fue", destreza: "des", constitucion: "con", inteligencia: "int", sabiduria: "sab", carisma: "car" };
  const yTiradas = (p1.find(i => /TIRADAS DE SALVACI/i.test(i.str)) || { y: 0 }).y;
  const yHabilidades = (p1.find(i => /^HABILIDADES$/i.test(i.str)) || { y: 0 }).y;

  lineasIzq.filter(l => l.y > yTiradas).forEach(l => {
    const m = l.texto.match(/^(-?\d+)\s+(.+)$/);
    const id = m && NOMBRES_SALVACION[fichasR20Sin(m[2])];
    if (!id) return;
    const r = clasificar(parseInt(m[1], 10), mod(id));
    personaje.salvaciones[id].competente = r.nivel !== "ninguna";
    personaje.salvaciones[id].ajuste = r.ajuste;
    if (r.raro) pendientes.push(`Salvación de ${id.toUpperCase()}: el total ${m[1]} no encaja con competencia; se guardó un ajuste de ${fichasSigno(r.ajuste)}.`);
  });

  const ALIAS_HABILIDAD = { "t con animales": "trato_animales", "c arcano": "arcano", "arcanos": "arcano", "juego de manos": "juego_manos" };
  const habPorNombre = {};
  FICHAS_HABILIDADES.forEach(h => { habPorNombre[fichasR20Sin(h.nombre)] = h.id; });
  let habilidadesLeidas = 0;
  lineasIzq.filter(l => l.y < yTiradas - 10 && l.y > yHabilidades).forEach(l => {
    const m = l.texto.match(/^(-?\d+)\s+(.+?)(?:\s*\((\w+)\))?$/);
    if (!m) return;
    const clave = fichasR20Sin(m[2]);
    const id = ALIAS_HABILIDAD[clave] || habPorNombre[clave];
    if (!id) return;
    const def = FICHAS_HABILIDADES.find(h => h.id === id);
    const r = clasificar(parseInt(m[1], 10), mod(def.atributo));
    personaje.habilidades[id].nivel = r.nivel;
    personaje.habilidades[id].ajuste = r.ajuste;
    habilidadesLeidas += 1;
    if (r.raro) pendientes.push(`${def.nombre}: el total ${m[1]} no encaja con competencia ni pericia; se guardó un ajuste de ${fichasSigno(r.ajuste)}.`);
  });
  if (habilidadesLeidas < 18) pendientes.push(`Habilidades: se leyeron ${habilidadesLeidas} de 18, revisa las que falten.`);

  /* Ataques: nombre, bonificador y "daño tipo" en la misma línea */
  const yAtaquesTitulo = (p1.find(i => /^NOMBRE$/i.test(i.str) && i.x > 200) || { y: 0 }).y;
  const yAtaquesEtiqueta = (p1.find(i => /ATAQUES Y LANZAMIENTO/i.test(i.str)) || { y: 0 }).y;
  lineasCentro.filter(l => l.x < 280 && l.y < yAtaquesTitulo && l.y > yAtaquesEtiqueta).forEach(l => {
    const iBono = l.items.findIndex(i => /^[+-]\d+$/.test(i.str));
    if (iBono < 1) return;
    const nombre = l.items.slice(0, iBono).map(i => i.str).join(" ");
    const bono = parseInt(l.items[iBono].str, 10);
    const resto = l.items.slice(iBono + 1).map(i => i.str).join(" ");
    const mDano = resto.match(/^(\S+(?:\s*[+-]\s*\d+)?)\s*(.*)$/);
    // Atributo: el que, con competencia, da justo el bonificador del PDF (si hay empate, Destreza para armas a distancia).
    const candidatos = ["fue", "des"].filter(a => mod(a) + competencia === bono);
    let atributo = candidatos.length === 1 ? candidatos[0] : (/arco|ballesta|honda|dardo|pistola|daga/i.test(nombre) && candidatos.includes("des") ? "des" : (candidatos[0] || "fue"));
    let ajuste = 0;
    if (!candidatos.length) {
      ajuste = bono - (mod(atributo) + competencia);
      pendientes.push(`Ataque "${nombre}": el bonificador ${fichasSigno(bono)} no coincide con Fuerza ni Destreza más competencia; se guardó un ajuste de ${fichasSigno(ajuste)}, revísalo.`);
    }
    personaje.ataques.push({
      id: fichasNuevoId(), nombre, atributo, competente: true, ajusteAtaque: ajuste,
      dano: mDano ? mDano[1].replace(/\s+/g, "") : resto, tipoDano: mDano ? mDano[2] : "",
      alcance: "", municionActual: null, municionMax: null, propiedades: "", notas: ""
    });
  });
  if (personaje.ataques.length) pendientes.push(`Ataques (${personaje.ataques.length}): el atributo (Fuerza o Destreza) se dedujo del bonificador; compruébalo.`);

  /* Equipo: "cantidad nombre" bajo la fila de monedas */
  const yMonedas = (p1.find(i => i.str === "CP") || { y: 0 }).y;
  const yEquipoEtiqueta = (p1.find(i => /^EQUIPO$/i.test(i.str)) || { y: 0 }).y;
  lineasCentro.filter(l => l.x < 240 && l.y < yMonedas && l.y > yEquipoEtiqueta).forEach(l => {
    const m = l.texto.match(/^(\d+)\s+(.+)$/);
    if (!m) return;
    personaje.inventario.objetos.push({
      id: fichasNuevoId(), nombre: m[2], cantidad: parseInt(m[1], 10), peso: null, estado: "guardado",
      descripcion: "", notas: "", cargasActuales: null, cargasMax: null, valor: null
    });
  });
  if (personaje.inventario.objetos.length) pendientes.push("Equipo: los objetos se importaron como 'guardados'. Marca como equipados los que lleves puestos. Las monedas no se importan: escríbelas en Inventario.");

  /* Cajas de personalidad: el texto va encima de cada etiqueta */
  const etiquetasCajas = ["RASGOS DE PERSONALIDAD", "IDEALES", "VÍNCULOS", "DEFECTOS"].map(t => ({ t, e: fichasR20Etiqueta(p1, t) })).filter(c => c.e);
  const notas = [];
  etiquetasCajas.forEach((c, i) => {
    const arriba = i > 0 ? etiquetasCajas[i - 1].e.y : 700; // por encima de 700 están los datos de cabecera (jugador, etc.)
    const lineasCaja = lineasDer.filter(l => l.y < arriba && l.y > c.e.y && l.items.every(it => fichasR20Entero(it.str) === null));
    const texto = lineasCaja.map(l => l.texto).join(" ").trim();
    if (texto) notas.push(`${c.t.charAt(0) + c.t.slice(1).toLowerCase()}: ${texto}`);
  });
  if (notas.length) personaje.identidad.notasPublicas = notas.join("\n");

  /* Lanzamiento de conjuros (página 3) */
  const p3 = paginas[2] || [];
  const habLanz = p3.find(i => /^(FUERZA|DESTREZA|CONSTITUCI.N|INTELIGENCIA|SABIDUR.A|CARISMA)$/i.test(i.str));
  if (habLanz) {
    const id = NOMBRES_SALVACION[fichasR20Sin(habLanz.str)];
    personaje.lanzamiento.atributo = id;
    const nums = p3.filter(i => Math.abs(i.y - habLanz.y) <= 3 && fichasR20Entero(i.str) !== null).sort((a, b) => a.x - b.x).map(i => fichasR20Entero(i.str));
    if (nums.length >= 2) {
      const cdPdf = nums[0];
      const ataquePdf = nums[1];
      const cdCalc = 8 + competencia + mod(id);
      if (cdPdf !== cdCalc) { personaje.lanzamiento.ajusteCD = cdPdf - cdCalc; pendientes.push(`CD de conjuros: el PDF dice ${cdPdf} y el cálculo da ${cdCalc}; se guardó un ajuste de ${fichasSigno(cdPdf - cdCalc)}.`); }
      const atkCalc = competencia + mod(id);
      if (ataquePdf !== atkCalc) { personaje.lanzamiento.ajusteAtaque = ataquePdf - atkCalc; pendientes.push(`Ataque de conjuros: el PDF dice ${fichasSigno(ataquePdf)} y el cálculo da ${fichasSigno(atkCalc)}; se guardó un ajuste.`); }
    }
    // Espacios: un nivel (1-9) seguido, en la misma línea, de la cantidad de espacios
    for (let nivel = 1; nivel <= 9; nivel++) {
      const marcador = p3.find(i => i.str === String(nivel) && i.x < 440 && i.y < habLanz.y - 20 && p3.some(o => Math.abs(o.y - i.y) <= 2 && o.x > i.x + 20 && o.x < i.x + 60 && fichasR20Entero(o.str) !== null));
      if (!marcador) continue;
      const cantidad = fichasR20Entero(p3.find(o => Math.abs(o.y - marcador.y) <= 2 && o.x > marcador.x + 20 && o.x < marcador.x + 60).str);
      if (cantidad > 0) personaje.lanzamiento.espacios.push({ nivel, max: cantidad, usados: 0 });
    }
    pendientes.push("Conjuros: el PDF no trae la lista de conjuros (la página de conjuros estaba vacía). Los espacios de conjuro sí se importaron; agrega los hechizos en la pestaña Hechizos.");
  }

  /* Rasgos (página 4): tres columnas de texto. Una línea "nivel nombre" es un
     rasgo; una línea sin número justo debajo es la misma frase partida. */
  const rasgosVistos = new Set();
  const pagina4 = paginas[3] || [];
  [[0, 200], [200, 400], [400, 700]].forEach(([x0, x1]) => {
    const col = fichasR20LineasEn(pagina4, x0, x1);
    col.forEach((l, idx) => {
      const m = l.texto.match(/^(\d+)\s+(\D.*)$/);
      if (!m) return;
      let nombre = m[2];
      const sig = col[idx + 1];
      if (sig && l.y - sig.y <= 14 && !/^\d/.test(sig.texto) && sig.items.length === 1) nombre += " " + sig.texto;
      const clave = fichasR20Sin(nombre);
      if (rasgosVistos.has(clave)) return;
      rasgosVistos.add(clave);
      personaje.rasgos.push({
        id: fichasNuevoId(), nombre, descripcion: `Nivel ${m[1]} (importado del PDF)`, usosActuales: null, usosMax: null,
        tipoAccion: "pasiva", recuperacion: "manual", formulaRoll20: ""
      });
    });
  });
  if (personaje.rasgos.length) pendientes.push(`Rasgos: se importaron ${personaje.rasgos.length} desde la página de rasgos, solo con su nombre y nivel. Algunos agrupan varios rasgos en uno.`);

  return { personaje, pendientesRevision: pendientes };
}
