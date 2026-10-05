/* Rol DJ de Zarabanda: quién puede entrar al editor de mapas y subir canciones a la rocola.
   Pueden los Admin y las cuentas con el rol DJ (se da desde el panel de Admin, pestaña Cuentas).
   El servidor es el que manda (ver scratchpad/ritmo_dj.sql); esto solo decide qué se muestra.
   Requiere js/fichas-supabase.js. */
(function () {
  const CLAVE_DJ = "compendioRitmoDJ";

  function cacheado() {
    try {
      return localStorage.getItem("compendioAdmin") === "1" || localStorage.getItem(CLAVE_DJ) === "1";
    } catch (e) { return false; }
  }

  /* Pregunta al servidor: { sesion, admin, dj, puede }. Sin sesión o sin conexión devuelve que no. */
  async function verificar() {
    try {
      const sesion = await fichasSesionActual();
      if (!sesion) {
        try { localStorage.removeItem(CLAVE_DJ); } catch (e) { /* sin almacenamiento */ }
        return { sesion: false, admin: false, dj: false, puede: false };
      }
      const supabase = await fichasCliente();
      const [a, d] = await Promise.all([supabase.rpc("fichas_es_admin"), supabase.rpc("ritmo_es_dj")]);
      const admin = !!a.data;
      const dj = !!d.data;
      try { localStorage.setItem(CLAVE_DJ, dj ? "1" : "0"); } catch (e) { /* sin almacenamiento */ }
      return { sesion: true, admin, dj, puede: admin || dj };
    } catch (e) {
      return { sesion: false, admin: false, dj: false, puede: false, error: true };
    }
  }

  window.RitmoRol = { cacheado, verificar };
})();
