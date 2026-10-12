/* Marcas personales del Duelo junto al título: victorias totales y rivales vencidos, leídos de lo que
   el juego ya guarda en este navegador. Se actualizan al cerrar cada combate. */
(function () {
  const CLAVE = "compendioDueloVictorias";
  const victoriasEl = document.getElementById("dlVictorias");
  const vencidosEl = document.getElementById("dlVencidos");
  if (!victoriasEl || !vencidosEl) return;

  function leer() {
    try { return JSON.parse(localStorage.getItem(CLAVE) || "{}") || {}; } catch (e) { return {}; }
  }

  function poner(el, valor) {
    const texto = String(valor);
    if (el.textContent === texto) return;
    el.textContent = texto;
    el.classList.remove("dl-pop");
    void el.offsetWidth;
    el.classList.add("dl-pop");
  }

  function pintar() {
    const v = leer();
    const valores = Object.values(v).map(n => Number(n) || 0);
    const total = document.querySelectorAll("#dueloRivales .duelo-rival").length;
    poner(victoriasEl, valores.reduce((a, b) => a + b, 0));
    poner(vencidosEl, total ? `${valores.filter(n => n > 0).length} / ${total}` : valores.filter(n => n > 0).length);
  }

  pintar();
  // El juego pinta los rivales y la pantalla final por su cuenta: se mira cuando cambian
  const fin = document.getElementById("dueloFin");
  const rivales = document.getElementById("dueloRivales");
  if (fin) new MutationObserver(pintar).observe(fin, { attributes: true, attributeFilter: ["class"] });
  if (rivales) new MutationObserver(pintar).observe(rivales, { childList: true });
})();
