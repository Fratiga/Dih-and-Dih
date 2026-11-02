import type { Pantalla, Shell } from "../shell.ts";
import { boton, h } from "./base.ts";
import { sonido } from "../audio/audio.ts";

/* La primera pantalla: el salon de fondo, el nombre y un boton para empezar. Aqui se pide el primer clic (el navegador no deja sonar antes). */
export function pantallaTitulo(shell: Shell): Pantalla {
  const empezar = boton("¡Empezar!", async () => {
    sonido.iniciar();
    sonido.desbloqueo();
    await shell.ir("menu", undefined, "centro");
  }, { color: "rosa", silencioso: true });
  empezar.classList.add("pt-gigante");
  const pc = boton("⤢ Pantalla completa", () => void shell.pantallaCompleta(), { chico: true, color: "turquesa" });
  const caja = h("div", { clase: "pt-titulo" },
    h("div", { clase: "pt-titulo-logo" }, h("span", {}, "PITTER"), h("span", { clase: "guion" }, "-"), h("span", {}, "PATTER")),
    h("p", { clase: "pt-titulo-sub" }, "Los personajes de la campaña, en un puzzle de fichas"),
    empezar,
    h("div", { clase: "pt-titulo-op" }, pc, h("small", {}, "Pantalla completa es opcional. El juego ocupa toda la ventana de todos modos.")),
  );
  shell.ui.append(caja);
  empezar.focus();
  return { desmontar() { /* nada */ } };
}
