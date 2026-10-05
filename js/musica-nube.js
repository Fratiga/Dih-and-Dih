/* Canciones subidas a la rocola por los DJ (tabla rocola_canciones, archivos en Storage).
   Se carga justo después de data/musica.js y suma esas canciones a window.MUSICA:
   - Al cargar, usa la última lista guardada en este navegador, para que todo (rocola, Zarabanda,
     editor) la tenga desde el primer momento.
   - En segundo plano pide la lista al servidor, la guarda y avisa con el evento "musica-nube"
     si hay canciones nuevas. No necesita iniciar sesión: la lista es pública. */
(function () {
  const URL_BASE = "https://ilicqboqelrjuvtslaxd.supabase.co";
  const CLAVE = "rocolaNubeCache";
  const KEY = "sb_publishable_c9kPJ1tWbzCSiqVvmBJ0og_rUW9uLee";

  window.MUSICA = window.MUSICA || [];
  window.MUSICA_NUBE_NOMBRES = window.MUSICA_NUBE_NOMBRES || {};
  window.MUSICA_NUBE_DURACIONES = window.MUSICA_NUBE_DURACIONES || {};

  function aplicar(lista) {
    const nuevas = [];
    lista.forEach(c => {
      if (!c || !c.ruta) return;
      window.MUSICA_NUBE_NOMBRES[c.ruta] = c.artista ? `${c.titulo} - ${c.artista}` : c.titulo;
      if (c.duracion) window.MUSICA_NUBE_DURACIONES[c.ruta] = Number(c.duracion);
      if (!window.MUSICA.includes(c.ruta)) { window.MUSICA.push(c.ruta); nuevas.push(c.ruta); }
    });
    return nuevas;
  }

  let guardada = [];
  try { guardada = JSON.parse(localStorage.getItem(CLAVE) || "[]") || []; } catch (e) { guardada = []; }
  aplicar(guardada);

  async function refrescar() {
    try {
      const resp = await fetch(`${URL_BASE}/rest/v1/rocola_canciones?select=ruta,titulo,artista,duracion&order=creada.asc`, {
        headers: { apikey: KEY, Authorization: "Bearer " + KEY }
      });
      if (!resp.ok) return [];
      const lista = await resp.json();
      if (!Array.isArray(lista)) return [];
      try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch (e) { /* sin almacenamiento */ }
      // Lo que ya no está en el servidor se quita de la lista de esta página
      const vigentes = new Set(lista.map(c => c.ruta));
      guardada.forEach(c => {
        if (!vigentes.has(c.ruta)) {
          const i = window.MUSICA.indexOf(c.ruta);
          if (i >= 0) window.MUSICA.splice(i, 1);
        }
      });
      guardada = lista;
      const nuevas = aplicar(lista);
      if (nuevas.length) window.dispatchEvent(new CustomEvent("musica-nube", { detail: { nuevas } }));
      return nuevas;
    } catch (e) {
      return [];
    }
  }

  window.MusicaNube = { refrescar, aplicar };
  refrescar();
})();
