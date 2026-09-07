/* =============================================================================
   BIENVENIDA MULTILINGÜE. Cada vez que alguien entra al compendio por la
   página principal, aparece un pequeño saludo de "bienvenido" en un idioma
   distinto y al azar, mitad reales y mitad inventados para este mundo.
============================================================================= */
(function () {
  const pool = window.SALUDOS_BIENVENIDA || [];
  if (!pool.length) return;
  const saludo = pool[Math.floor(Math.random() * pool.length)];

  function mostrar() {
    const toast = document.createElement("div");
    toast.className = "bienvenida-toast";
    toast.innerHTML = `
      <p class="bienvenida-texto"></p>
      <p class="bienvenida-idioma"></p>
    `;
    toast.querySelector(".bienvenida-texto").textContent = saludo.texto;
    toast.querySelector(".bienvenida-idioma").textContent = `— ${saludo.idioma}`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("bienvenida-toast-visible"));

    function cerrar() {
      toast.classList.remove("bienvenida-toast-visible");
      setTimeout(() => toast.remove(), 400);
    }
    toast.addEventListener("click", cerrar);
    setTimeout(cerrar, 4500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mostrar);
  } else {
    mostrar();
  }
})();
