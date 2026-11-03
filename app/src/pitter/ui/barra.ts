import type { Shell } from "../shell.ts";
import { boton, h } from "./base.ts";
import { abrirAjustes } from "./ajustes.ts";
import { alternarAdmin, esAdmin } from "./admin.ts";

export interface OpcionesBarra {
  /** null = muestra el logo; si no, un titulo de pantalla con boton de volver. */
  titulo: string | null;
  volver?: () => void;
  extra?: HTMLElement[];
}

/* La cabecera del juego: no es la de la web. Un boton discreto vuelve al sitio. */
export function barra(shell: Shell, o: OpcionesBarra): HTMLElement {
  const izq = h("div", { clase: "izq" });
  if (o.titulo === null) {
    izq.append(h("span", { clase: "pt-logo" }, "PITTER", h("span", {}, "-"), "PATTER"));
  } else {
    izq.append(
      boton("◀ Salón", () => { if (o.volver) o.volver(); else void shell.ir("menu"); }, { chico: true, color: "amarillo", tip: "Volver al salón" }),
      h("h1", { clase: "pt-titulo-pantalla" }, o.titulo),
    );
  }
  const der = h("div", { clase: "der" });
  if (o.extra) der.append(...o.extra);
  if (esAdmin()) der.append(boton("🛠", () => alternarAdmin(shell), { chico: true, icono: true, color: "amarillo", tip: "Admin|Ver todo y hacer pruebas (F2)" }));
  der.append(
    boton("⚙", () => abrirAjustes(shell), { chico: true, icono: true, color: "violeta", tip: "Ajustes|Volumen, calidad y progreso" }),
    (() => {
      const b = boton(shell.enPantallaCompleta ? "⤡" : "⤢", () => void shell.pantallaCompleta(), { chico: true, icono: true, color: "turquesa", tip: "Pantalla completa (F)" });
      b.dataset.pc = "1";
      b.setAttribute("aria-pressed", shell.enPantallaCompleta ? "true" : "false");
      return b;
    })(),
    h("a", { clase: "pt-btn chico icono azul pt-volver", href: "../../minijuegos.html", "data-tip": "Volver a la web", "aria-label": "Volver a la web" }, "⌂"),
  );
  return h("div", { clase: "pt-barra" }, izq, der);
}
