/* =============================================================================
   HIPÓDROMO: botones que esperan. Lo que tarda (una orden de la cuadra, una compra de cartas, una apuesta) lo dice el propio botón que se ha pulsado, con un
   círculo que gira y un texto como «Entrenando...», y se apaga hasta que acabe, para no pensar que la página se ha quedado colgada ni pulsarlo dos veces.
   Donde el botón se vuelve a dibujar mientras espera (la cuadra y las cartas pintan su HTML entero), la pieza guarda qué se está haciendo y marca el botón
   después de cada dibujo. Estilo: .hip-espera en css/hipodromo.css.
============================================================================= */
window.HipEspera = (function () {
  "use strict";
  function poner(b, texto) {
    if (!b || b.classList.contains("hip-espera")) return;
    b._texto = b.textContent; b.textContent = texto || "Un momento...";
    b.classList.add("hip-espera"); b.disabled = true; b.setAttribute("aria-busy", "true");
  }
  function quitar(b) {
    if (!b || !b.classList.contains("hip-espera")) return;
    b.classList.remove("hip-espera"); b.disabled = false; b.removeAttribute("aria-busy");
    if (b._texto != null) b.textContent = b._texto;
  }
  return { poner, quitar };
})();
