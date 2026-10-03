/* Música del Dominio compartida por la puerta/selección y por los combates:
   una sola canción en loop, con volumen que se recuerda entre páginas y se
   retoma por donde iba al pasar de una página a otra. */
(function () {
  const CLAVE_VOLUMEN = "msVolumen";
  const CLAVE_SILENCIO = "msSilencio";
  const CLAVE_TIEMPO = "msMusicaTiempo";

  const ICONO_SONIDO = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const ICONO_MUDO = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  function leer(clave, porDefecto, almacen) {
    try {
      const v = (almacen || localStorage).getItem(clave);
      return v === null ? porDefecto : v;
    } catch (e) { return porDefecto; }
  }
  function guardar(clave, valor, almacen) {
    try { (almacen || localStorage).setItem(clave, String(valor)); } catch (e) { /* sin almacenamiento */ }
  }

  function crear({ contenedor }) {
    // Si el archivo no está, el navegador simplemente no suena.
    const audio = new Audio(encodeURI("assets/cosas/The Crack of Doom.mp3"));
    audio.loop = true;

    let volumen = Math.min(1, Math.max(0, parseFloat(leer(CLAVE_VOLUMEN, "0.5")) || 0.5));
    let silenciado = leer(CLAVE_SILENCIO, "0") === "1";
    const aplicar = () => { audio.volume = silenciado ? 0 : volumen; };
    aplicar();

    const tiempo = parseFloat(leer(CLAVE_TIEMPO, "0", sessionStorage)) || 0;
    if (tiempo > 0) {
      audio.addEventListener("loadedmetadata", () => {
        if (tiempo < audio.duration) audio.currentTime = tiempo;
      }, { once: true });
    }
    window.addEventListener("pagehide", () => {
      guardar(CLAVE_TIEMPO, audio.currentTime, sessionStorage);
      audio.pause();
    });

    if (contenedor) {
      contenedor.innerHTML = `
        <button type="button" class="ms-vol-boton" aria-label="Silenciar o activar la música"></button>
        <input type="range" class="ms-vol-rango" min="0" max="100" step="1" aria-label="Volumen de la música">`;
      const boton = contenedor.querySelector(".ms-vol-boton");
      const rango = contenedor.querySelector(".ms-vol-rango");
      const pintar = () => {
        rango.value = String(Math.round((silenciado ? 0 : volumen) * 100));
        boton.innerHTML = silenciado || volumen === 0 ? ICONO_MUDO : ICONO_SONIDO;
      };
      rango.addEventListener("input", () => {
        volumen = rango.value / 100;
        silenciado = volumen === 0;
        guardar(CLAVE_VOLUMEN, volumen);
        guardar(CLAVE_SILENCIO, silenciado ? "1" : "0");
        aplicar();
        pintar();
      });
      boton.addEventListener("click", () => {
        silenciado = !silenciado;
        if (!silenciado && volumen === 0) volumen = 0.5;
        guardar(CLAVE_SILENCIO, silenciado ? "1" : "0");
        guardar(CLAVE_VOLUMEN, volumen);
        aplicar();
        pintar();
      });
      pintar();
    }
    return audio;
  }

  window.MsMusica = { crear };
})();
