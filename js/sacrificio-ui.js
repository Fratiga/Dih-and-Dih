/* Detalles de interfaz de la página de Hooey que no tocan el juego:
   pestañas de los rankings y una onda corta donde se hace clic en el campo. */
(function () {
  // Pestañas: un ranking a la vez para que no le quiten atención al juego
  const pestanas = document.querySelectorAll(".hy-pestana");
  const paneles = document.querySelectorAll(".hy-rankings [data-panel]");
  pestanas.forEach(boton => boton.addEventListener("click", () => {
    pestanas.forEach(b => b.classList.toggle("activa", b === boton));
    paneles.forEach(p => { p.hidden = p.dataset.panel !== boton.dataset.rank; });
  }));

  // Onda de impacto: un anillo que nace donde se toca y se apaga solo (sin tocar el juego)
  const escenario = document.querySelector(".sacrificio-escenario");
  if (!escenario) return;
  escenario.addEventListener("pointerdown", ev => {
    if (ev.target.closest(".sacrificio-play")) return;
    const caja = escenario.getBoundingClientRect();
    const onda = document.createElement("span");
    onda.className = "hy-onda";
    onda.style.left = (ev.clientX - caja.left) + "px";
    onda.style.top = (ev.clientY - caja.top) + "px";
    escenario.appendChild(onda);
    setTimeout(() => onda.remove(), 420);
  }, { passive: true });
})();
