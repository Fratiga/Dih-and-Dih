/* Rankings en pestañas para los minijuegos. Cualquier contenedor con el atributo data-pestanas
   que se llene con bloques .sacrificio-ranking (como hace MjStats.cargarYPintar) pasa a mostrar
   una pestaña por bloque, con el título del bloque como nombre. Si hay muchos bloques, los primeros
   van como pestañas y el resto en un desplegable "Más...". Se rehace solo cuando el ranking se
   vuelve a pintar y recuerda lo elegido. La barra va fuera del contenedor (antes de él) para que
   no se borre al repintar. */
(function () {
  const MAX_BOTONES = 5;

  function enlazar(cont) {
    const barra = document.createElement("div");
    barra.className = "mj-pestanas";
    barra.setAttribute("role", "tablist");
    cont.before(barra);
    cont.classList.add("mj-con-pestanas");
    let elegida = 0;

    function nombre(b, i) {
      const titulo = (b.querySelector("h3") || {}).textContent || `Ranking ${i + 1}`;
      return titulo.replace(/^Victorias contra /, "Vs ");
    }

    function montar() {
      const bloques = [...cont.children].filter(b => b.classList && b.classList.contains("sacrificio-ranking"));
      if (bloques.length < 2) { barra.hidden = true; bloques.forEach(b => { b.hidden = false; }); return; }
      barra.hidden = false;
      if (elegida >= bloques.length) elegida = 0;
      barra.innerHTML = "";
      const botones = bloques.length > MAX_BOTONES + 1 ? MAX_BOTONES : bloques.length;
      bloques.forEach((b, i) => { b.hidden = i !== elegida; });
      for (let i = 0; i < botones; i++) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.setAttribute("role", "tab");
        boton.className = "mj-pestana" + (i === elegida ? " activa" : "");
        boton.textContent = nombre(bloques[i], i);
        boton.title = bloques[i].querySelector("h3") ? bloques[i].querySelector("h3").textContent : "";
        boton.addEventListener("click", () => { elegida = i; montar(); });
        barra.appendChild(boton);
      }
      if (botones < bloques.length) {
        const mas = document.createElement("select");
        mas.className = "mj-pestana mj-pestana-mas" + (elegida >= botones ? " activa" : "");
        mas.setAttribute("aria-label", "Más rankings");
        mas.innerHTML = `<option value="">Más rankings...</option>` + bloques.slice(botones)
          .map((b, k) => `<option value="${botones + k}"${botones + k === elegida ? " selected" : ""}>${nombre(b, botones + k).replace(/[<>&]/g, "")}</option>`).join("");
        mas.addEventListener("change", () => { if (mas.value !== "") { elegida = Number(mas.value); montar(); } });
        barra.appendChild(mas);
      }
    }

    new MutationObserver(montar).observe(cont, { childList: true });
    montar();
  }

  function iniciar() { document.querySelectorAll("[data-pestanas]").forEach(enlazar); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
