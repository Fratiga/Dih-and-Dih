/* Laboratorio de pruebas dentro del juego (solo desarrollo, igual que el resto de la pagina: solo admin).
   Ejecuta los casos de exito con varias semillas y con sus controles, y muestra que criterios se cumplen en cada una. */

import { CASOS } from "../lab/casos.ts";
import type { InformeCaso, ResSemilla } from "../lab/laboratorio.ts";
import { boton, h, respirar } from "./base.ts";

const SEMILLAS = Array.from({ length: 10 }, (_, i) => i + 1);

export function abrirLaboratorio(raiz: HTMLElement): void {
  const resultados = h("div", {});
  let cancelado = false;
  const cerrar = (): void => { cancelado = true; modal.remove(); };
  const ejecutar = boton("Ejecutar los casos", async (b) => {
    resultados.replaceChildren();
    cancelado = false;
    const t0 = performance.now();
    for (const caso of CASOS) {
      const res: ResSemilla[] = [];
      for (const s of SEMILLAS) {
        if (cancelado) return;
        b.textContent = `Caso ${caso.id} · semilla ${s} de ${SEMILLAS.length}`;
        await respirar();
        res.push(caso.ejecutar(s));
      }
      const aprobadas = res.filter((r) => r.ok).length;
      const porCriterio: Record<string, number> = {};
      for (const r of res) for (const [k, v] of Object.entries(r.criterios)) porCriterio[k] = (porCriterio[k] ?? 0) + (v ? 1 : 0);
      const inf: InformeCaso = { id: caso.id, titulo: caso.titulo, semillas: SEMILLAS, resultados: res, aprobadas, pasa: aprobadas / SEMILLAS.length >= caso.minimo, porCriterio };
      resultados.append(tarjeta(inf, caso.hipotesis));
    }
    b.textContent = "Ejecutar los casos";
    resultados.prepend(h("p", { clase: "va-sub-modal" }, `Terminado en ${((performance.now() - t0) / 1000).toFixed(1)} s. Semillas ${SEMILLAS[0]} a ${SEMILLAS[SEMILLAS.length - 1]}.`));
  }, { clase: "va-btn-lleno progreso" });
  const modal = h("div", { clase: "va-modal" },
    h("div", { clase: "va-caja va-lab", style: "width:min(900px,100%)" },
      h("h2", {}, "Laboratorio de pruebas"),
      h("p", { clase: "va-sub-modal" }, "Cada caso se ejecuta con 10 semillas y un control (sin el estímulo o sin la posibilidad social). Un caso solo se aprueba si lo cumplen casi todas las semillas."),
      resultados,
      h("div", { clase: "va-pie-modal" }, boton("Cerrar", cerrar), ejecutar),
    ),
  );
  raiz.append(modal);
}

function tarjeta(inf: InformeCaso, hipotesis: string): HTMLElement {
  const filas = Object.entries(inf.porCriterio).map(([k, n]) => h("tr", {}, h("td", { clase: n === inf.semillas.length ? "ok" : n / inf.semillas.length >= 0.8 ? "" : "no" }, `${n}/${inf.semillas.length}`), h("td", {}, k)));
  const detalle = inf.resultados.map((r) => `semilla ${r.semilla} ${r.ok ? "cumple" : "NO cumple"}  ${JSON.stringify(Object.fromEntries(Object.entries(r.metricas).map(([k, v]) => [k, Math.round(v * 100) / 100])))}`).join("\n");
  return h("section", {},
    h("h3", {}, `Caso ${inf.id} · ${inf.titulo}`),
    h("p", { clase: inf.pasa ? "ok" : "no" }, `${inf.aprobadas} de ${inf.semillas.length} semillas. ${inf.pasa ? "Aprobado." : "No aprobado."}`),
    h("p", { style: "color:var(--apagado);font-size:14px" }, hipotesis),
    h("table", {}, h("tr", {}, h("th", {}, "Semillas"), h("th", {}, "Criterio")), ...filas),
    h("details", {}, h("summary", {}, "Medidas por semilla"), h("pre", {}, detalle)),
  );
}
