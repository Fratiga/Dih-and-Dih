/* =============================================================================
   CONTENIDO EDITABLE DESDE LA WEB
   Mezcla lo guardado en la tabla contenido_servidor (docs/admin/contenido_servidor.sql) con las listas de data/*.js:
   cada fila es un parche sobre un elemento (o un elemento nuevo, o un borrado). Va justo después de los archivos de datos
   y antes de lo que los usa, para que la página se pinte ya con todo mezclado.

   - Lo último que se sabe se guarda en este navegador y se aplica al instante (sin esperar a la red).
   - En segundo plano se pregunta al servidor qué cambió; si algo cambió se baja, se guarda y la página se recarga UNA vez.
   - Sin la tabla o sin conexión, no pasa nada: el sitio es el de los archivos.
============================================================================= */
(function () {
  const URL_BASE = "https://ilicqboqelrjuvtslaxd.supabase.co";
  const KEY = "sb_publishable_c9kPJ1tWbzCSiqVvmBJ0og_rUW9uLee";
  const CLAVE_CACHE = "contenidoServidor";
  const CLAVE_RECARGA = "contenidoRecargado";

  /* Qué listas se pueden editar y cómo se identifica cada elemento */
  const porId = i => i.id;
  const CONF = {
    ENTRIES: { nombre: "Textos", clave: porId },
    PERSONAJES: { nombre: "Personajes", clave: porId },
    LUGARES: { nombre: "Lugares", clave: porId },
    FACCIONES: { nombre: "Facciones", clave: porId },
    PERGAMINOS: { nombre: "Pergaminos", clave: porId },
    ARMAS: { nombre: "Armas", clave: porId },
    BESTIARIO: { nombre: "Bestiario", clave: porId },
    RAZAS: { nombre: "Razas", clave: porId },
    RELIGIONES: { nombre: "Religiones", clave: porId },
    OBJETOS: { nombre: "Objetos", clave: porId },
    CRONOLOGIA_A: { nombre: "Cronología (Side A)", clave: porId, ordenar: { campo: "orden" } },
    CRONOLOGIA_B: { nombre: "Cronología (Side B)", clave: porId, ordenar: { campo: "orden" } },
    CRONOLOGIA_ARCOS: { nombre: "Cronología: arcos", clave: porId, ordenar: { campo: "orden" } },
    REGLAS: { nombre: "Reglas", clave: i => i.titulo },
    ECONOMIA: { nombre: "Economía", clave: i => `${i.categoria}|${i.nombre}` },
    NOVEDADES: { nombre: "Novedades del lobby", clave: i => `${i.fecha}|${i.titulo}`, ordenar: { campo: "fecha", desc: true } },
    MAPA_PUNTOS: { nombre: "Mapa: pines", clave: i => i.lugarId }
  };

  /* Las listas tal como vienen de los archivos (antes de mezclar). Cada elemento es el original, sin tocar. */
  const BASE = {};
  Object.keys(CONF).forEach(col => { if (Array.isArray(window[col])) BASE[col] = window[col].slice(); });

  const sep = "\u0001";
  const leerCache = () => {
    try { const c = JSON.parse(localStorage.getItem(CLAVE_CACHE) || "null"); if (c && c.filas) return c; } catch (e) { /* cache rota */ }
    return { filas: {} };
  };
  function escribirCache(c) {
    try { localStorage.setItem(CLAVE_CACHE, JSON.stringify(c)); return true; } catch (e) { return false; }
  }

  function fusionar(base, data) {
    const m = Object.assign({}, base || {}, data || {});
    Object.keys(m).forEach(k => { if (m[k] === null) delete m[k]; });   // null en el parche = quitar el campo
    return m;
  }

  /* Rehace cada lista en su sitio a partir de la base y de las filas (se puede llamar las veces que haga falta) */
  function aplicar(filas) {
    const porColeccion = {};
    Object.values(filas).forEach(f => { (porColeccion[f.coleccion] = porColeccion[f.coleccion] || []).push(f); });
    Object.keys(BASE).forEach(col => {
      const conf = CONF[col], lista = window[col];
      const parches = new Map((porColeccion[col] || []).map(f => [f.clave, f]));
      const resultado = [];
      const usadas = new Set();
      BASE[col].forEach(item => {
        const k = String(conf.clave(item));
        const f = parches.get(k);
        if (!f) { resultado.push(item); return; }
        usadas.add(k);
        if (!f.borrado) resultado.push(fusionar(item, f.data));
      });
      // Los que no estaban en el archivo: elementos nuevos creados desde la web
      (porColeccion[col] || []).filter(f => !usadas.has(f.clave) && !f.borrado)
        .sort((a, b) => String(a.actualizada).localeCompare(String(b.actualizada)))
        .forEach(f => resultado.push(fusionar(null, f.data)));
      if (conf.ordenar) {
        const { campo, desc } = conf.ordenar;
        const val = x => (x[campo] === undefined ? Infinity : x[campo]);
        resultado.sort((a, b) => { const A = val(a), B = val(b); return (A < B ? -1 : A > B ? 1 : 0) * (desc ? -1 : 1); });
      }
      lista.splice(0, lista.length, ...resultado);
    });
  }

  const filasDeCache = () => leerCache().filas;
  if (Object.keys(BASE).length && Object.keys(filasDeCache()).length) {
    try { aplicar(filasDeCache()); } catch (e) { /* una fila rota no debe tumbar la página */ }
  }

  /* --- Sincronización con el servidor --- */
  const cab = { apikey: KEY, Authorization: `Bearer ${KEY}` };
  const idFila = (c, k) => c + sep + k;

  async function traer() {
    const r = await fetch(`${URL_BASE}/rest/v1/contenido_servidor?select=coleccion,clave,actualizada`, { headers: cab });
    if (!r.ok) return null;
    return r.json();
  }

  /* Baja lo que cambió. Devuelve { cambiadas, quitadas } o null si no se pudo preguntar. */
  async function sincronizar() {
    try {
      const ligero = await traer();
      if (!ligero) return null;
      const cache = leerCache();
      const vivas = new Set();
      const cambiadas = [];
      ligero.forEach(f => {
        const id = idFila(f.coleccion, f.clave);
        vivas.add(id);
        if (!cache.filas[id] || cache.filas[id].actualizada !== f.actualizada) cambiadas.push(f);
      });
      const quitadas = Object.keys(cache.filas).filter(id => !vivas.has(id));
      if (!cambiadas.length && !quitadas.length) return { cambiadas: [], quitadas: [] };
      const porCol = {};
      cambiadas.forEach(f => { (porCol[f.coleccion] = porCol[f.coleccion] || []).push(f.clave); });
      for (const col of Object.keys(porCol)) {
        const claves = porCol[col].map(k => `"${k.replace(/"/g, '\\"')}"`).join(",");
        const url = `${URL_BASE}/rest/v1/contenido_servidor?coleccion=eq.${encodeURIComponent(col)}&clave=in.(${encodeURIComponent(claves)})&select=coleccion,clave,data,borrado,actualizada`;
        const r = await fetch(url, { headers: cab });
        if (!r.ok) return null;
        (await r.json()).forEach(f => { cache.filas[idFila(f.coleccion, f.clave)] = f; });
      }
      quitadas.forEach(id => { delete cache.filas[id]; });
      escribirCache(cache);
      return { cambiadas, quitadas: quitadas.map(id => { const [coleccion, clave] = id.split(sep); return { coleccion, clave }; }), cache };
    } catch (e) {
      return null;   // sin conexión o sin la tabla
    }
  }

  async function alCargar() {
    // Una consulta cada 20 s como mucho (al cambiar de página varias veces seguidas no hace falta preguntar siempre)
    try {
      const t = Number(sessionStorage.getItem("contenidoConsultado") || 0);
      if (Date.now() - t < 20000) return;
      sessionStorage.setItem("contenidoConsultado", String(Date.now()));
    } catch (e) { /* sin almacenamiento: se pregunta siempre */ }
    const r = await sincronizar();
    if (!r || (!r.cambiadas.length && !r.quitadas.length)) return;
    window.dispatchEvent(new CustomEvent("contenido-servidor", { detail: r }));
    // Si lo que cambió es de esta página, se recarga una vez para que se pinte con todo mezclado
    const afecta = [...r.cambiadas, ...r.quitadas].some(f => BASE[f.coleccion]);
    if (!afecta) return;
    const firma = [...r.cambiadas.map(f => `${f.coleccion}${sep}${f.clave}${sep}${f.actualizada}`), ...r.quitadas.map(f => `-${f.coleccion}${sep}${f.clave}`)].sort().join("|");
    try {
      if (sessionStorage.getItem(CLAVE_RECARGA) === firma) return;
      sessionStorage.setItem(CLAVE_RECARGA, firma);
    } catch (e) { return; }
    if (/\/admin\.html$/i.test(location.pathname)) return;   // el panel de Admin se refresca solo
    location.reload();
  }

  /* --- Para el editor del panel de Admin --- */
  async function llamar(rpc, args) {
    const supabase = await fichasCliente();
    const { error } = await supabase.rpc(rpc, args);
    if (error) throw error;
  }

  window.ContenidoServidor = {
    CONF,
    colecciones: () => Object.keys(BASE),
    base: col => (BASE[col] || []).slice(),
    filas: () => Object.values(filasDeCache()),
    fila: (col, clave) => filasDeCache()[idFila(col, clave)] || null,
    claveDe: (col, item) => String(CONF[col].clave(item)),
    fusionar,
    guardar: async (col, clave, data, borrado) => { await llamar("contenido_guardar", { p_coleccion: col, p_clave: clave, p_data: data, p_borrado: !!borrado }); await window.ContenidoServidor.refrescar(); },
    restaurar: async (col, clave) => { await llamar("contenido_restaurar", { p_coleccion: col, p_clave: clave }); await window.ContenidoServidor.refrescar(); },
    /* Baja lo último del servidor y rehace las listas en su sitio (sin recargar la página) */
    refrescar: async () => { const r = await sincronizar(); if (r) aplicar(filasDeCache()); return r; }
  };

  if (Object.keys(BASE).length) alCargar();
})();
