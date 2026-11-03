import type { Shell } from "../shell.ts";
import { boton, h } from "./base.ts";
import { JEFES } from "../datos/campana.ts";
import { personajesVisibles } from "../datos/roster.ts";
import { estrellasTotales, nivelMansion } from "../estado.ts";
import { abrirAjustes } from "./ajustes.ts";
import { alternarAdmin, esAdmin } from "./admin.ts";

/* La cabecera de la mansion: el nivel, las cuentas y los botones de siempre. La usan el menu y las habitaciones, como en el original. */
export function cabeceraMansion(shell: Shell, extra: HTMLElement[] = []): HTMLElement {
  const e = shell.estado;
  const estrellas = estrellasTotales(e);
  const pct = (estrellas / (JEFES.length * 3)) * 100;
  const insignia = h("div", { clase: "pt-nivel", "data-tip": "Nivel de la mansión|Sube con las victorias, las estrellas y los personajes" },
    h("small", {}, "NIVEL"), h("b", {}, String(nivelMansion(e))), h("div", { clase: "pt-nivel-barra" }, h("i", { style: `width:${pct}%` })));
  const cuenta = (t: string, v: string): HTMLElement => h("div", { clase: "pt-cuenta" }, h("b", { clase: "ic" }, t), h("span", {}, v));
  return h("div", { clase: "pt-menu-top" },
    insignia,
    h("div", { clase: "pt-cuentas" }, cuenta("★", `${estrellas} / ${JEFES.length * 3}`), cuenta("☺", `${e.desbloqueados.length} / ${personajesVisibles().length}`)),
    h("div", { clase: "pt-menu-top-der" },
      ...extra,
      ...(esAdmin() ? [boton("🛠", () => alternarAdmin(shell), { chico: true, icono: true, color: "amarillo", tip: "Admin|Ver todo y hacer pruebas (F2)" })] : []),
      boton("⚙", () => abrirAjustes(shell), { chico: true, icono: true, color: "violeta", tip: "Ajustes" }),
      (() => { const b = boton(shell.enPantallaCompleta ? "⤡" : "⤢", () => void shell.pantallaCompleta(), { chico: true, icono: true, color: "turquesa", tip: "Pantalla completa (F)" }); b.dataset.pc = "1"; return b; })(),
      h("a", { clase: "pt-btn chico icono azul", href: "../../minijuegos.html", "data-tip": "Volver a la web", "aria-label": "Volver a la web" }, "⌂"),
    ),
  );
}
