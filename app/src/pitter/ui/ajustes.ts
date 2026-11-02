import type { Shell } from "../shell.ts";
import { boton, h, modal } from "./base.ts";
import { sonido } from "../audio/audio.ts";
import { estadoInicial } from "../estado.ts";

function deslizador(etiqueta: string, valor: number, alCambiar: (v: number) => void, apagado: boolean, alApagar: (v: boolean) => void): HTMLElement {
  const rango = h("input", { type: "range", min: 0, max: 100, value: Math.round(valor * 100), clase: "pt-rango", "aria-label": etiqueta });
  const num = h("output", { clase: "pt-rango-num" }, `${Math.round(valor * 100)}`);
  rango.addEventListener("input", () => { const v = Number(rango.value) / 100; num.textContent = String(Math.round(v * 100)); alCambiar(v); });
  rango.addEventListener("change", () => sonido.clic());
  const mudo = boton(apagado ? "🔇" : "🔊", (b) => { apagado = !apagado; b.textContent = apagado ? "🔇" : "🔊"; b.setAttribute("aria-pressed", apagado ? "false" : "true"); alApagar(apagado); }, { chico: true, icono: true, color: "turquesa", silencioso: true, tip: "Silenciar" });
  mudo.classList.add("apagable");
  mudo.setAttribute("aria-pressed", apagado ? "false" : "true");
  return h("div", { clase: "pt-fila" }, h("label", {}, etiqueta), rango, num, mudo);
}

function segmentos<T extends string>(opciones: [T, string][], actual: T, alCambiar: (v: T) => void): HTMLElement {
  const caja = h("div", { clase: "pt-segmentos", role: "radiogroup" });
  const marcar = (v: T) => caja.querySelectorAll("button").forEach((b) => b.classList.toggle("sel", b.dataset.v === v));
  for (const [v, t] of opciones) {
    const b = boton(t, () => { marcar(v); alCambiar(v); }, { chico: true, color: "violeta" });
    b.dataset.v = v;
    b.setAttribute("role", "radio");
    caja.append(b);
  }
  marcar(actual);
  return caja;
}

export function abrirAjustes(shell: Shell): void {
  const a = shell.estado.ajustes;
  const cuerpo = h("div", { clase: "pt-ajustes" });
  cuerpo.append(
    deslizador("Música", a.musica, (v) => { a.musica = v; sonido.fijar(a); }, a.silencioMusica, (m) => { a.silencioMusica = m; sonido.fijar(a); }),
    deslizador("Efectos", a.efectos, (v) => { a.efectos = v; sonido.fijar(a); }, a.silencioEfectos, (m) => { a.silencioEfectos = m; sonido.fijar(a); sonido.clic(); }),
    h("div", { clase: "pt-fila" }, h("label", {}, "Efectos visuales"), segmentos([["alta", "Todos"], ["media", "Menos"], ["baja", "Mínimos"]], a.calidad, (v) => { a.calidad = v; shell.guardar(); })),
    h("div", { clase: "pt-fila" }, h("label", {}, "Movimiento"), segmentos([["no", "Completo"], ["si", "Reducido"]], a.movimientoReducido ? "si" : "no", (v) => { a.movimientoReducido = v === "si"; shell.guardar(); })),
    h("div", { clase: "pt-fila" }, h("label", {}, "Pantalla"), boton(shell.enPantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa", () => void shell.pantallaCompleta(), { chico: true, color: "turquesa" })),
    h("p", { clase: "pt-nota" }, "Atajos: F pantalla completa · M música · P pausa · Q y W habilidades del equipo · Esc cierra ventanas."),
  );
  let confirmar = false;
  const borrar = boton("Borrar mi progreso", (b) => {
    if (!confirmar) { confirmar = true; b.textContent = "¿Seguro? Pulsa otra vez"; window.setTimeout(() => { confirmar = false; b.textContent = "Borrar mi progreso"; }, 3500); return; }
    shell.estado = { ...estadoInicial(), ajustes: shell.estado.ajustes };
    shell.guardar(true);
    shell.avisar("Progreso borrado");
    m.cerrar();
    void shell.ir("menu", undefined, "centro");
  }, { chico: true, color: "rosa" });
  const m = modal(shell.raiz, "Ajustes", cuerpo, { botones: [borrar, boton("Listo", () => m.cerrar(), { color: "amarillo" })], alCerrar: () => shell.guardar() });
}
