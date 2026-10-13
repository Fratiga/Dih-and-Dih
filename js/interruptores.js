/* =============================================================================
   INTERRUPTORES DEL SITIO (tabla sitio_interruptores, docs/admin/herramientas_2.sql)
   El Admin enciende o apaga partes del sitio desde su panel (pestaña Interruptores). Lo último que se sabe se guarda en este
   navegador; los scripts lo leen directo de ahí (ver apagado() en cada uno) y esta página lo refresca en segundo plano, así que
   un cambio se nota en la siguiente página que se abre. Sin la tabla o sin conexión, todo sigue encendido.
============================================================================= */
(function () {
  const URL_BASE = "https://ilicqboqelrjuvtslaxd.supabase.co";
  const KEY = "sb_publishable_c9kPJ1tWbzCSiqVvmBJ0og_rUW9uLee";
  const CLAVE = "sitioInterruptores";

  window.interruptorApagado = clave => {
    try { return (JSON.parse(localStorage.getItem(CLAVE) || "{}") || {})[clave] === false; } catch (e) { return false; }
  };

  async function refrescar() {
    try {
      const t = Number(sessionStorage.getItem(CLAVE + "T") || 0);
      if (Date.now() - t < 30000) return;
      sessionStorage.setItem(CLAVE + "T", String(Date.now()));
    } catch (e) { /* sin almacenamiento: se pregunta siempre */ }
    try {
      const r = await fetch(`${URL_BASE}/rest/v1/sitio_interruptores?select=clave,activo`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
      if (!r.ok) return;
      const mapa = {};
      (await r.json()).forEach(f => { mapa[f.clave] = f.activo; });
      localStorage.setItem(CLAVE, JSON.stringify(mapa));
    } catch (e) { /* sin conexión: se queda lo último */ }
  }
  refrescar();
})();
