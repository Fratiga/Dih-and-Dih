/* =============================================================================
   DIÁLOGOS EDITADOS DEL BUHONERO Y DEL HERRERO (tabla dialogos_personajes, docs/admin/dialogos_personajes.sql)
   El Admin cambia desde su panel (pestaña Diálogos) las frases de cada personaje. js/puesto-buhonero.js y js/forja-herrero.js traen sus frases de fábrica
   y justo después llaman a DialogosPersonajes.aplicar(personaje, FRASES), que reemplaza la lista de cada grupo por la guardada. Un grupo que el personaje no
   conoce, una lista vacía o una frase que no es texto se ignoran. Lo último que se sabe se guarda en este navegador y se lee directo (como interruptores.js y
   bufon-textos.js), y refrescar() lo actualiza de fondo como mucho una vez cada 30 segundos y lo aplica también en la visita en curso.
   Sin la tabla o sin conexión, todo queda como en los archivos.
============================================================================= */
window.DialogosPersonajes = (function () {
  const URL_BASE = "https://ilicqboqelrjuvtslaxd.supabase.co";
  const KEY = "sb_publishable_c9kPJ1tWbzCSiqVvmBJ0og_rUW9uLee";
  const CLAVE = "dialogosPersonajes";
  const MAX_FRASES = 30, MAX_LARGO = 240;

  const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE) || "{}") || {}; } catch (e) { return {}; } };
  const valida = l => Array.isArray(l) && l.length >= 1 && l.length <= MAX_FRASES && l.every(t => typeof t === "string" && t.trim() !== "" && t.length <= MAX_LARGO);

  /* FRASES = { grupo: [frases] } del personaje; mapa = { personaje: { grupo: [frases] } }. Devuelve cuántos grupos se reemplazaron */
  function aplicar(personaje, FRASES, mapa) {
    const propios = (mapa || leer())[personaje];
    if (!FRASES || !propios || typeof propios !== "object") return 0;
    let n = 0;
    Object.keys(propios).forEach(grupo => {
      if (Object.prototype.hasOwnProperty.call(FRASES, grupo) && valida(propios[grupo])) { FRASES[grupo] = propios[grupo].map(t => t.trim()); n++; }
    });
    return n;
  }

  async function refrescar(personaje, FRASES) {
    try {
      const t = Number(sessionStorage.getItem(CLAVE + "T") || 0);
      if (Date.now() - t < 30000) return;
      sessionStorage.setItem(CLAVE + "T", String(Date.now()));
    } catch (e) { /* sin almacenamiento: se pregunta siempre */ }
    try {
      const r = await fetch(`${URL_BASE}/rest/v1/dialogos_personajes?select=personaje,grupo,frases`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
      if (!r.ok) return;
      const mapa = {};
      (await r.json()).forEach(f => { (mapa[f.personaje] = mapa[f.personaje] || {})[f.grupo] = f.frases; });
      localStorage.setItem(CLAVE, JSON.stringify(mapa));
      aplicar(personaje, FRASES, mapa);
    } catch (e) { /* sin conexión: se queda lo último */ }
  }

  return { aplicar, refrescar, leer, valida, MAX_FRASES, MAX_LARGO };
})();
