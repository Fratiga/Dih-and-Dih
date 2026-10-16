/* =============================================================================
   GUÍA DE LA TABERNA (index.html)
   Un diálogo de tres pasos para quien llega por primera vez: crear un personaje, recorrer la taberna y probar un juego. Sale solo la primera vez que alguien
   con sesión abre la taberna (si es una de sus dos primeras visitas, así no la ven los jugadores de siempre) y se puede volver a abrir desde el pie de la página
   («Ver la guía de la taberna»). Recuerda en este navegador que ya se vio (lbGuiaVista). index.html?guia=1 la abre siempre.
============================================================================= */
(function () {
  const PASOS = [
    { titulo: "1 · Crea a tu personaje", texto: "Todo empieza en tu ficha. Crea a tu personaje en «Mis personajes»: tus datos quedan guardados en tu cuenta y es lo que otros ven cuando te sientas a la mesa.",
      enlace: ["fichas.html", "Ir a Mis personajes"] },
    { titulo: "2 · Recorre la taberna", texto: "Cada objeto es una puerta. La estantería y el arco llevan al compendio y a la biblioteca; el mapa, a los lugares; la puerta de la izquierda es tu habitación (cartas, mazos y forja), y la de la derecha, los establos con el Hipódromo y los corrales. En la mesa del centro se sienta quien está conectado.",
      enlace: ["compendio.html", "Abrir el Compendio"] },
    { titulo: "3 · Prueba un juego", texto: "La máquina recreativa y el cartel del Salón de juegos llevan a los minijuegos: ajedrez, arquería, ritmo y las cartas de Triunfos. Arriba de la taberna aparecen avisos cuando algo te espera: un reto, una cría lista o una carrera a punto de salir.",
      enlace: ["minijuegos.html", "Ir a Minijuegos"] }
  ];
  const CLAVE = "lbGuiaVista";
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const visto = () => { try { return localStorage.getItem(CLAVE) === "1"; } catch (e) { return false; } };
  const marcar = () => { try { localStorage.setItem(CLAVE, "1"); } catch (e) { /* sin almacenamiento */ } };

  let dlg = null, paso = 0;
  function pintar() {
    const p = PASOS[paso];
    dlg.querySelector(".gi-cuerpo").innerHTML = `<p class="lb-eyebrow">★ GUÍA DE LA TABERNA · PASO ${paso + 1} DE ${PASOS.length} ★</p>
      <h2>${esc(p.titulo)}</h2><p>${esc(p.texto)}</p>
      <p><a class="lb-boton" href="${esc(p.enlace[0])}">${esc(p.enlace[1])}</a></p>`;
    dlg.querySelector("[data-atras]").hidden = paso === 0;
    dlg.querySelector("[data-sigue]").textContent = paso === PASOS.length - 1 ? "Entendido" : "Siguiente";
    dlg.querySelector(".gi-puntos").innerHTML = PASOS.map((_, i) => `<i class="${i === paso ? "gi-aqui" : ""}"></i>`).join("");
  }
  function abrir() {
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.className = "gi-dialogo";
      dlg.setAttribute("aria-label", "Guía de la taberna");
      dlg.innerHTML = `<div class="gi-cuerpo"></div><div class="gi-puntos" aria-hidden="true"></div>
        <div class="gi-botones"><button type="button" class="lb-boton" data-atras>Atrás</button><button type="button" class="lb-boton" data-sigue>Siguiente</button><button type="button" class="gi-saltar" data-saltar>Saltar la guía</button></div>`;
      dlg.addEventListener("click", ev => {
        if (ev.target.closest("[data-atras]")) { paso = Math.max(0, paso - 1); pintar(); }
        else if (ev.target.closest("[data-sigue]")) { if (paso >= PASOS.length - 1) { marcar(); dlg.close(); } else { paso++; pintar(); } }
        else if (ev.target.closest("[data-saltar]")) { marcar(); dlg.close(); }
      });
      dlg.addEventListener("close", marcar);
      document.body.appendChild(dlg);
    }
    paso = 0; pintar();
    if (!dlg.open) dlg.showModal();
  }

  function visitas() { try { return parseInt(localStorage.getItem("lbVisitas"), 10) || 0; } catch (e) { return 0; } }
  function iniciar() {
    const boton = document.getElementById("lbVerGuia");
    if (boton) boton.addEventListener("click", abrir);
    const fuerza = /[?&]guia=1\b/.test(location.search);
    if (fuerza) { setTimeout(abrir, 300); return; }
    const alEntrar = sesion => { if (sesion && !visto() && visitas() <= 2) setTimeout(abrir, 800); };
    if (typeof fichasEnCambioDeSesion === "function") {
      let hecho = false;
      fichasEnCambioDeSesion(ses => { if (!hecho && ses) { hecho = true; alEntrar(ses); } }).catch(() => {});
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
