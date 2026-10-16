/* =============================================================================
   TEXTOS DEL BUFÓN EDITADOS (tabla bufon_textos, docs/admin/bufon_textos.sql)
   El Admin cambia desde su panel (pestaña Bufón: textos) lo que dice el Bufón. secreto.html carga el diálogo de siempre (data/bufon-*.js) y justo después
   BufonTextos.aplicar() sobrescribe el texto de los nodos y de los botones de elección que haya guardados. Solo cambia texto: los ids, las ramas y las
   condiciones no se tocan, y un valor que no encaja (un nodo que no existe, una lista vacía, un texto donde iba una lista) se ignora. Lo último que se sabe se guarda
   en este navegador y se lee directo (como interruptores.js), así que un cambio se nota en la siguiente visita. Sin la tabla o sin conexión, todo queda como en los archivos.
============================================================================= */
(function () {
  const URL_BASE = "https://ilicqboqelrjuvtslaxd.supabase.co";
  const KEY = "sb_publishable_c9kPJ1tWbzCSiqVvmBJ0og_rUW9uLee";
  const CLAVE = "bufonTextos";

  const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE) || "{}") || {}; } catch (e) { return {}; } };
  const esTexto = t => typeof t === "string" && t.trim() !== "";

  /* D = BUFON_DIALOGO; mapa = { clave: valor }. Devuelve cuántos textos se cambiaron. */
  function aplicar(D, mapa) {
    mapa = mapa || leer();
    if (!D || !D.nodos || !D.elecciones) return 0;
    let n = 0;
    Object.keys(mapa).forEach(clave => {
      const v = mapa[clave];
      if (clave.startsWith("n:")) {
        const nodo = D.nodos[clave.slice(2)];
        // solo las líneas escritas a mano (una lista); las que calcula una función no se tocan
        if (nodo && Array.isArray(nodo.lineas) && Array.isArray(v) && v.length && v.every(esTexto)) { nodo.lineas = v.slice(); n++; }
      } else if (clave.startsWith("o:")) {
        const [eid, oid] = clave.slice(2).split(":");
        const eleccion = D.elecciones[eid];
        const opcion = eleccion && Array.isArray(eleccion.opciones) ? eleccion.opciones.find(o => o.id === oid) : null;
        if (opcion && esTexto(v)) { opcion.texto = v; n++; }
      }
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
      const r = await fetch(`${URL_BASE}/rest/v1/bufon_textos?select=clave,valor`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
      if (!r.ok) return;
      const mapa = {};
      (await r.json()).forEach(f => { mapa[f.clave] = f.valor; });
      localStorage.setItem(CLAVE, JSON.stringify(mapa));
    } catch (e) { /* sin conexión: se queda lo último */ }
  }

  window.BufonTextos = { aplicar, leer, refrescar };
  if (window.BUFON_DIALOGO) aplicar(window.BUFON_DIALOGO);
  refrescar();
})();
