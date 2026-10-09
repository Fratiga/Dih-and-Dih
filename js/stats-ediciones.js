/* =============================================================================
   EDICIONES DE LAS FICHAS DE COMBATE
   Las fichas de data/stats.js son el punto de partida. Cada ficha que el Admin
   edita desde Estadísticas se guarda entera en Supabase (tabla stats_ediciones,
   ver docs/estadisticas-edicion.md) y aquí se pone encima de la original en
   window.STATS, así que Estadísticas, Roll20 y Ostelar ven la versión editada.
   Borrar la edición devuelve la ficha a como está en el repositorio.

   Si la tabla no existe o no hay red, no pasa nada: se ven las fichas originales.
============================================================================= */

// Copia de cada ficha tal como viene del repositorio (para "Restaurar original").
const STATS_BASE = new Map((window.STATS || []).map(s => [s.id, JSON.parse(JSON.stringify(s))]));
const STATS_EDITADAS = new Set();

function statsClonar(s) {
  return JSON.parse(JSON.stringify(s));
}

/* Cambia el contenido de la ficha sin cambiarle la identidad al objeto (quien la
   tenga en una variable sigue viendo la versión nueva). */
function statsPonerContenido(id, contenido) {
  const s = (window.STATS || []).find(x => x.id === id);
  if (!s) return null;
  Object.keys(s).forEach(k => { delete s[k]; });
  Object.assign(s, statsClonar(contenido), { id });
  return s;
}

async function statsCargarEdiciones() {
  try {
    const supabase = await fichasCliente();
    const { data, error } = await supabase.from("stats_ediciones").select("id, data");
    if (error || !Array.isArray(data)) return;
    data.forEach(fila => {
      if (statsPonerContenido(fila.id, fila.data)) STATS_EDITADAS.add(fila.id);
    });
  } catch (e) { /* sin red o sin tabla: se quedan las fichas originales */ }
}

async function statsGuardarEdicion(s) {
  const supabase = await fichasCliente();
  const contenido = statsClonar(s);
  const { error } = await supabase.from("stats_ediciones").upsert({ id: s.id, data: contenido });
  if (error) throw error;
  STATS_EDITADAS.add(s.id);
  return statsPonerContenido(s.id, contenido);
}

async function statsRestaurarEdicion(id) {
  const supabase = await fichasCliente();
  const { error } = await supabase.from("stats_ediciones").delete().eq("id", id);
  if (error) throw error;
  if (STATS_BASE.has(id)) statsPonerContenido(id, STATS_BASE.get(id));
  STATS_EDITADAS.delete(id);
}

// Las páginas que usan STATS esperan a esta promesa si quieren mostrar ya lo editado.
window.statsEdicionesListas = statsCargarEdiciones();
