/* =============================================================================
   LA TABERNA — pequeños añadidos del estilo nuevo en las páginas con cabecera:
   pasa el Side a la raíz (para teñir el tema "La Taberna") y pone el pie de
   página. Los colores, la letra y el fondo los decide js/temas.js (botón Tema).
============================================================================= */
(function () {
  const raiz = document.documentElement;

  function aplicarLado() {
    const lado = typeof ladoActual === "function" ? ladoActual() : localStorage.getItem("compendioLado");
    if (lado === "A" || lado === "B") raiz.dataset.lado = lado; else delete raiz.dataset.lado;
  }
  aplicarLado();
  window.addEventListener("storage", aplicarLado);

  function ponerPie() {
    if (document.querySelector(".tb-pie") || document.body.classList.contains("lb")) return;
    const pie = document.createElement("footer");
    pie.className = "tb-pie";
    pie.innerHTML = `<p><a href="index.html">← Volver a la taberna</a> · <a href="#" id="tbArriba">Subir ↑</a></p>
      <p>Hecho a mano para la mesa. Nada de esto es oficial de nadie.</p>`;
    document.body.appendChild(pie);
    pie.querySelector("#tbArriba").addEventListener("click", e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ponerPie); else ponerPie();
})();
