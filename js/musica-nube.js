/* Canciones subidas a la rocola por los DJ (tabla rocola_canciones, archivos en Storage) y
   canciones del sitio que un DJ o Admin ocultó (tabla rocola_ocultas).
   Se carga justo después de data/musica.js y ajusta window.MUSICA:
   - Al cargar, usa la última lista guardada en este navegador, para que todo (rocola, Zarabanda,
     editor) la tenga desde el primer momento.
   - En segundo plano pide las listas al servidor, las guarda y avisa con el evento "musica-nube"
     (detail: { nuevas, quitadas }) si algo cambió. No necesita iniciar sesión: las listas son públicas. */
(function () {
  const URL_BASE = "https://ilicqboqelrjuvtslaxd.supabase.co";
  const CLAVE = "rocolaNubeCache";
  const CLAVE_OCULTAS = "rocolaOcultasCache";
  const CLAVE_NOMBRES = "rocolaNombresCache";
  const KEY = "sb_publishable_c9kPJ1tWbzCSiqVvmBJ0og_rUW9uLee";

  window.MUSICA = window.MUSICA || [];
  // Las canciones que trae el sitio, antes de ocultar ninguna (el gestor las necesita para poder restaurarlas)
  window.MUSICA_ESTATICAS = window.MUSICA.slice();
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

  // Oculta (o devuelve) las canciones del sitio según la lista de rutas; cambia el arreglo en su sitio
  function aplicarOcultas(rutas) {
    const set = new Set(rutas);
    const quitadas = [];
    const nuevas = [];
    window.MUSICA_ESTATICAS.forEach(r => {
      const i = window.MUSICA.indexOf(r);
      if (set.has(r) && i >= 0) { window.MUSICA.splice(i, 1); quitadas.push(r); }
      else if (!set.has(r) && i < 0) { window.MUSICA.push(r); nuevas.push(r); }
    });
    return { quitadas, nuevas };
  }

  function leer(clave) {
    try { return JSON.parse(localStorage.getItem(clave) || "[]") || []; } catch (e) { return []; }
  }
  function escribir(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* sin almacenamiento */ }
  }

  // Nombres puestos a mano a las canciones que trae el sitio (tabla rocola_nombres)
  function aplicarNombres(lista) {
    lista.forEach(c => {
      if (!c || !c.ruta || !c.titulo) return;
      window.MUSICA_NUBE_NOMBRES[c.ruta] = c.artista ? `${c.titulo} - ${c.artista}` : c.titulo;
    });
  }

  let guardada = leer(CLAVE);
  let ocultas = leer(CLAVE_OCULTAS);
  aplicar(guardada);
  aplicarOcultas(ocultas);
  aplicarNombres(leer(CLAVE_NOMBRES));

  async function pedir(tabla, columnas, orden) {
    const resp = await fetch(`${URL_BASE}/rest/v1/${tabla}?select=${columnas}${orden ? "&order=" + orden : ""}`, {
      headers: { apikey: KEY, Authorization: "Bearer " + KEY }
    });
    if (!resp.ok) return null;
    const datos = await resp.json();
    return Array.isArray(datos) ? datos : null;
  }

  async function refrescar() {
    const nuevas = [];
    const quitadas = [];
    const nombresAntes = JSON.stringify(window.MUSICA_NUBE_NOMBRES);
    try {
      const lista = await pedir("rocola_canciones", "ruta,titulo,artista,duracion", "creada.asc");
      if (lista) {
        escribir(CLAVE, lista);
        // Lo que ya no está en el servidor se quita de la lista de esta página
        const vigentes = new Set(lista.map(c => c.ruta));
        guardada.forEach(c => {
          if (!vigentes.has(c.ruta)) {
            const i = window.MUSICA.indexOf(c.ruta);
            if (i >= 0) { window.MUSICA.splice(i, 1); quitadas.push(c.ruta); }
          }
        });
        guardada = lista;
        nuevas.push(...aplicar(lista));
      }
    } catch (e) { /* sin conexión */ }
    try {
      // Si la tabla todavía no existe (falta rocola_gestor.sql) la respuesta no es válida y se ignora
      const filas = await pedir("rocola_ocultas", "ruta");
      if (filas) {
        ocultas = filas.map(f => f.ruta);
        escribir(CLAVE_OCULTAS, ocultas);
        const r = aplicarOcultas(ocultas);
        quitadas.push(...r.quitadas);
        nuevas.push(...r.nuevas);
      }
    } catch (e) { /* sin conexión */ }
    try {
      const nombres = await pedir("rocola_nombres", "ruta,titulo,artista");
      if (nombres) {
        // Una canción a la que se le quitó el nombre a mano vuelve al de su archivo
        leer(CLAVE_NOMBRES).forEach(c => {
          if (!nombres.some(n => n.ruta === c.ruta)) delete window.MUSICA_NUBE_NOMBRES[c.ruta];
        });
        escribir(CLAVE_NOMBRES, nombres);
        aplicarNombres(nombres);
        // Las subidas conservan su nombre de la tabla rocola_canciones
        aplicar(guardada);
      }
    } catch (e) { /* sin conexión */ }
    if (nombresAntes !== JSON.stringify(window.MUSICA_NUBE_NOMBRES)) window.dispatchEvent(new CustomEvent("musica-nombres"));
    if (nuevas.length || quitadas.length) window.dispatchEvent(new CustomEvent("musica-nube", { detail: { nuevas, quitadas } }));
    return nuevas;
  }

  window.MusicaNube = { refrescar, aplicar };
  refrescar();
})();
