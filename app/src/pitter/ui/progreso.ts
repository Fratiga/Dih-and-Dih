import type { Pantalla, Shell } from "../shell.ts";
import { h } from "./base.ts";
import { barra } from "./barra.ts";
import { JEFES } from "../datos/campana.ts";
import { LOGROS } from "../datos/logros.ts";
import { estrellasTotales } from "../estado.ts";
import { urlJefe } from "./puzzle.ts";

/* Récords por jefe, estadísticas de siempre y logros. */
export function pantallaProgreso(shell: Shell): Pantalla {
  const e = shell.estado;
  const raiz = shell.ui;
  raiz.append(barra(shell, { titulo: "Récords" }));
  const minutos = Math.round(e.stats.tiempo / 60);
  const dato = (t: string, v: string): HTMLElement => h("div", { clase: "pt-dato" }, h("small", {}, t), h("b", {}, v));
  const stats = h("section", { clase: "pt-panel pt-prog-stats" },
    h("h2", {}, "Tu historial"),
    h("div", { clase: "pt-datos-rejilla" },
      dato("Partidas", String(e.stats.partidas)), dato("Victorias", String(e.stats.victorias)), dato("Derrotas", String(e.stats.derrotas)),
      dato("Estrellas", `${estrellasTotales(e)} / ${JEFES.length * 3}`), dato("Mejor combo", String(e.stats.mejorCombo)), dato("Fichas borradas", String(e.stats.fichas)),
      dato("Habilidades", String(e.stats.habilidades)), dato("Stand Up Time", String(e.stats.standUp)), dato("Tiempo jugado", minutos < 1 ? "menos de 1 min" : `${minutos} min`),
    ),
  );
  const filas = JEFES.map((j) => {
    const r = e.records[j.id];
    return h("li", { clase: r ? "" : "sin" },
      h("img", { src: urlJefe(j.id), alt: "" }),
      h("b", {}, j.nombre),
      h("span", { clase: "est" }, ...[0, 1, 2].map((k) => h("i", { clase: r && k < r.estrellas ? "on" : "" }, "★"))),
      h("span", {}, r ? `${r.puntos} pts` : "—"),
      h("span", {}, r ? `${r.mejorTiempo} s` : "—"),
      h("span", {}, r ? `combo ${r.combo}` : "—"),
    );
  });
  const records = h("section", { clase: "pt-panel pt-prog-records" }, h("h2", {}, "Récords por jefe"), h("ul", { clase: "pt-records" }, ...filas));
  const logros = h("section", { clase: "pt-panel pt-prog-logros" }, h("h2", {}, "Logros"),
    h("div", { clase: "pt-logros" }, ...LOGROS.map((l) => {
      const p = l.progreso(e);
      const hecho = p.actual >= p.meta;
      return h("div", { clase: `pt-logro ${hecho ? "hecho" : ""}` },
        h("span", { clase: "medalla" }, hecho ? "★" : "☆"),
        h("div", {}, h("b", {}, l.nombre), h("small", {}, l.texto), h("div", { clase: "pt-barra-prog" }, h("i", { style: `width:${Math.min(100, (p.actual / p.meta) * 100)}%` })), h("small", { clase: "n" }, `${Math.min(p.actual, p.meta)} / ${p.meta}`)),
      );
    })),
  );
  raiz.append(h("div", { clase: "pt-progreso" }, h("div", { clase: "col" }, stats, records), logros));
  return { desmontar() { /* nada */ } };
}
