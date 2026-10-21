/* =============================================================================
   LAS VEINTIUNA VELAS: el Buhonero en la mesa. Un botón de la cabecera (y los enlaces con data-buhonero) abren un cuadro donde se venden y se compran cartas por
   tokens de juego, sin ir al Hipódromo: es la misma pieza de js/hipodromo-cartas.js, con la misma reserva, los mismos precios y la misma billetera.
   Sirve a la mesa de uno (veintiuna-mesa.js) y a la de amigos (veintiuna-amigos.js). Lo que pesa (los estilos del Hipódromo, el catálogo de cartas) se carga
   al abrirlo por primera vez. Tras cada trato avisa a la página (alCambiar) para que ponga al día los tokens de la cabecera.
============================================================================= */
window.VeintiunaBuhonero = (function () {
  "use strict";
  const VER = "20270343";

  function cargarScript(src) {
    return new Promise((ok, mal) => {
      const s = document.createElement("script");
      s.src = src + "?v=" + VER; s.onload = ok; s.onerror = () => mal(new Error("No se pudo cargar " + src));
      document.head.appendChild(s);
    });
  }
  async function preparar() {
    if (!document.querySelector('link[href^="css/hipodromo.css"]')) {
      const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "css/hipodromo.css?v=20270342"; document.head.appendChild(l);
    }
    if (!window.HipEspera) await cargarScript("js/hipodromo-espera.js");
    if (!window.HipodromoCartas) await cargarScript("js/hipodromo-cartas.js");
  }

  /* o: { abrir(dlg, html), cabecera(id, titulo, sub), dlg, supa(), yo(), alCambiar(saldo) } */
  function iniciar(o) {
    let saldo = 0, supa = null;
    const monedas = x => (Math.round(x * 100) / 100).toLocaleString("es", { maximumFractionDigits: 2 });
    async function leerSaldo() {
      const { data } = await supa.from("hipodromo_billeteras").select("saldo").eq("usuario", o.yo()).maybeSingle();
      saldo = data ? Number(data.saldo) : 0;
    }
    async function abrir() {
      o.abrir(o.dlg, `${o.cabecera("vvDlgBuhoneroT", "El Buhonero", "Cartas por tokens de juego")}<div class="vv-dlg-cuerpo"><div class="vv-tokens"><p class="vv-dock-texto">El Buhonero está preparando su carreta...</p></div></div>`);
      const cont = o.dlg.querySelector(".vv-tokens");
      try {
        await preparar();
        supa = await o.supa();
        await leerSaldo();
        const cartas = window.HipodromoCartas.crear({
          supa, yo: o.yo(), saldo: () => saldo, monedas,
          refrescarCuenta: async () => { await leerSaldo(); try { await o.alCambiar(saldo); } catch (e) { /* la mesa se pone al día sola */ } }
        }, cont, { sinEscena: true, fuera: true });
        await cartas.abrir();
      } catch (e) { cont.innerHTML = `<p class="vv-dock-texto">No se pudo abrir el Buhonero: ${String(e.message || e).replace(/[<>&]/g, "")}</p>`; }
    }
    document.addEventListener("click", ev => {
      const b = ev.target.closest("[data-buhonero]");
      if (!b) return;
      ev.preventDefault();
      abrir();
    });
    return { abrir };
  }
  return { iniciar };
})();
