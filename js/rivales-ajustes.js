/* =============================================================================
   DIFICULTAD DE LOS RIVALES (tabla rivales_ajustes, docs/admin/rivales.sql)
   El Admin cambia desde su panel (pestaña Rivales) los números de los rivales de Ajedrez, Arquería y Duelo. Cada juego define su tabla de rivales como
   siempre y justo después llama a RivalesAjustes.aplicar("juego", RIVALES): lo que haya guardado en el servidor se pone encima, campo por campo. Lo último que se
   sabe se guarda en este navegador y se lee directo (como interruptores.js), así que un cambio se nota en la siguiente partida que se abre. Un valor que no
   encaja (un número donde había una lista, o un campo que no existe) se ignora: nunca puede romper un juego. Sin la tabla o sin conexión, todo queda como en el archivo.
============================================================================= */
(function () {
  const URL_BASE = "https://ilicqboqelrjuvtslaxd.supabase.co";
  const KEY = "sb_publishable_c9kPJ1tWbzCSiqVvmBJ0og_rUW9uLee";
  const CLAVE = "rivalesAjustes";

  const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE) || "{}") || {}; } catch (e) { return {}; } };
  const esNumero = v => typeof v === "number" && Number.isFinite(v);
  const esLista = v => Array.isArray(v) && v.length > 0 && v.every(esNumero);

  /* rivales: una lista con { id, ... } o un objeto { id: {...} }. Devuelve cuántos campos se cambiaron. */
  function aplicar(juego, rivales, mapa) {
    mapa = (mapa || leer())[juego];
    if (!mapa || !rivales) return 0;
    const porId = {};
    if (Array.isArray(rivales)) rivales.forEach(r => { if (r && r.id) porId[r.id] = r; });
    else Object.keys(rivales).forEach(id => { porId[id] = rivales[id]; });
    let n = 0;
    Object.keys(mapa).forEach(id => {
      const r = porId[id];
      if (!r) return;
      const campos = mapa[id] || {};
      Object.keys(campos).forEach(campo => {
        const base = r[campo], v = campos[campo];
        if (esNumero(base) && esNumero(v)) { r[campo] = v; n++; }
        else if (esLista(base) && esLista(v) && v.length === base.length) { r[campo] = v.slice(); n++; }
      });
    });
    return n;
  }

  async function refrescar() {
    try {
      const t = Number(sessionStorage.getItem(CLAVE + "T") || 0);
      if (Date.now() - t < 30000) return;
      sessionStorage.setItem(CLAVE + "T", String(Date.now()));
    } catch (e) { /* sin almacenamiento: se pregunta siempre */ }
    try {
      const r = await fetch(`${URL_BASE}/rest/v1/rivales_ajustes?select=juego,rival,campo,valor`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
      if (!r.ok) return;
      const mapa = {};
      (await r.json()).forEach(f => { ((mapa[f.juego] = mapa[f.juego] || {})[f.rival] = mapa[f.juego][f.rival] || {})[f.campo] = f.valor; });
      localStorage.setItem(CLAVE, JSON.stringify(mapa));
    } catch (e) { /* sin conexión: se queda lo último */ }
  }

  window.RivalesAjustes = { aplicar, leer, refrescar };
  refrescar();
})();
