/* =============================================================================
   ALMACENAMIENTO — CRUD de fichas contra la tabla de Supabase
   "fichas_personajes". El aislamiento entre jugadores lo hace RLS del lado
   del servidor (auth.uid() = owner_id), no código de acá: por eso este
   archivo no filtra nada por dueño, simplemente pide "mis fichas" y
   Supabase ya devuelve solo las que le corresponden a la sesión actual.

   Todo el objeto del personaje (identidad, atributos, ataques, hechizos,
   etc. — ver fichas-modelo.js) se guarda entero como jsonb en la columna
   "data". No hace falta una tabla normalizada para esto: nadie más
   necesita consultar estos datos con SQL aparte de este mismo código.

   fichasStorage es la única interfaz que usa fichas-ui.js — igual que
   antes con la versión de localStorage, solo que ahora todo es async
   porque hay red de por medio. */

async function fichasStorageListar({ incluirArchivadas = false } = {}) {
  const supabase = await fichasCliente();
  let query = supabase
    .from("fichas_personajes")
    .select("id, data, archivado, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (!incluirArchivadas) query = query.eq("archivado", false);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(fila => fichasMigrar({ ...fila.data, id: fila.id, archivado: fila.archivado }));
}

async function fichasStorageObtener(id) {
  const supabase = await fichasCliente();
  const { data, error } = await supabase
    .from("fichas_personajes")
    .select("id, data, archivado")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return fichasMigrar({ ...data.data, id: data.id, archivado: data.archivado });
}

/* upsert: mismo id = actualiza, id nuevo = inserta. owner_id lo pone la
   base de datos sola (default auth.uid() en la tabla), así que ni
   necesitamos mandarlo — y aunque lo mandáramos mal, RLS no dejaría
   guardar una fila con el owner_id de otro. */
async function fichasStorageGuardar(personaje) {
  const supabase = await fichasCliente();
  if (!personaje.ownerEmail) {
    const sesion = await fichasSesionActual();
    personaje.ownerEmail = sesion?.user?.email || "";
    personaje.ownerUsername = (typeof nombreUsuario === "function" && nombreUsuario()) || "";
  }
  personaje.updatedAt = new Date().toISOString();
  const { error } = await supabase.from("fichas_personajes").upsert({
    id: personaje.id,
    archivado: !!personaje.archivado,
    data: personaje,
    updated_at: personaje.updatedAt
  });
  if (error) throw error;
  return personaje;
}

async function fichasStorageArchivar(id, archivado = true) {
  const personaje = await fichasStorageObtener(id);
  if (!personaje) return null;
  personaje.archivado = archivado;
  return fichasStorageGuardar(personaje);
}

async function fichasStorageEliminar(id) {
  const supabase = await fichasCliente();
  const { error } = await supabase.from("fichas_personajes").delete().eq("id", id);
  if (error) throw error;
}

async function fichasStorageDuplicar(id) {
  const original = await fichasStorageObtener(id);
  if (!original) return null;
  const copia = JSON.parse(JSON.stringify(original));
  copia.id = fichasNuevoId();
  copia.identidad.nombre = original.identidad.nombre ? `${original.identidad.nombre} (copia)` : "Copia";
  copia.createdAt = new Date().toISOString();
  copia.archivado = false;
  return fichasStorageGuardar(copia);
}

// Punto único de acceso — cambiar de backend en el futuro es reescribir
// este objeto, sin tocar fichas-ui.js.
const fichasStorage = {
  listar: fichasStorageListar,
  obtener: fichasStorageObtener,
  guardar: fichasStorageGuardar,
  archivar: fichasStorageArchivar,
  eliminar: fichasStorageEliminar,
  duplicar: fichasStorageDuplicar
};

/* --- Exportación / importación de respaldos ------------------------------- */
async function fichasExportarUno(id) {
  const p = await fichasStorage.obtener(id);
  if (!p) return null;
  return JSON.stringify({ tipo: "ficha-dnd-personaje", version: FICHAS_VERSION_ACTUAL, personaje: p }, null, 2);
}

async function fichasExportarTodos() {
  const todos = await fichasStorage.listar({ incluirArchivadas: true });
  return JSON.stringify({ tipo: "ficha-dnd-respaldo", version: FICHAS_VERSION_ACTUAL, personajes: todos }, null, 2);
}

/* Valida la forma mínima de un JSON importado sin ejecutar nada de su
   contenido (sección 17 del spec: "nunca ejecutes contenido incluido
   dentro de un respaldo"). Devuelve { ok, personajes, error }. */
function fichasValidarImportacion(texto) {
  let data;
  try {
    data = JSON.parse(texto);
  } catch (e) {
    return { ok: false, error: "El archivo no es JSON válido." };
  }
  let personajes = [];
  if (data?.tipo === "ficha-dnd-personaje" && data.personaje) personajes = [data.personaje];
  else if (data?.tipo === "ficha-dnd-respaldo" && Array.isArray(data.personajes)) personajes = data.personajes;
  else return { ok: false, error: "No parece un respaldo de fichas de este sitio." };

  const validos = personajes.filter(p => p && typeof p === "object" && p.identidad && p.atributos);
  if (!validos.length) return { ok: false, error: "El archivo no contiene ninguna ficha reconocible." };
  return { ok: true, personajes: validos };
}

/* Importa como fichas NUEVAS: siempre genera id nuevo, nunca pisa una
   existente. Ideal tanto para "recuperar un respaldo" como para migrar
   fichas hechas en otra cuenta. */
async function fichasImportarRespaldo(personajes) {
  const resultados = [];
  for (const p of personajes) {
    const copia = fichasMigrar(JSON.parse(JSON.stringify(p)));
    copia.id = fichasNuevoId();
    copia.archivado = false;
    resultados.push(await fichasStorage.guardar(copia));
  }
  return resultados;
}
