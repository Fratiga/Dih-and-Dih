import type { Pantalla, Shell } from "../shell.ts";
import { boton, h } from "./base.ts";
import { barra } from "./barra.ts";
import { JEFES, type Jefe } from "../datos/campana.ts";
import { personaje } from "../datos/roster.ts";
import { sinergia } from "../datos/sinergias.ts";
import { proximoJefe } from "../estado.ts";
import { urlChibi, urlJefe } from "./puzzle.ts";
import { sonido } from "../audio/audio.ts";

const ICONO_ATAQUE: Record<string, string> = { bloques: "Pone bloques", congelar: "Congela fichas", tinta: "Mancha de tinta" };

/* La eleccion de rival: un camino con un jefe por parada. */
export function pantallaCampana(shell: Shell): Pantalla {
  const e = shell.estado;
  const maxAbierto = Math.min(JEFES.length - 1, proximoJefe(e));
  let sel = maxAbierto;
  const raiz = shell.ui;
  raiz.append(barra(shell, { titulo: "Elige a tu rival" }));

  const mapa = h("div", { clase: "pt-mapa" });
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "pt-mapa-camino");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  mapa.append(svg);
  const pos = JEFES.map((_, i) => ({ x: 7 + (i * 86) / (JEFES.length - 1), y: i % 2 === 0 ? 68 : 32 }));
  const trazo = document.createElementNS("http://www.w3.org/2000/svg", "path");
  trazo.setAttribute("d", pos.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `S ${(pos[i - 1].x + p.x) / 2} ${i % 2 ? 6 : 94} ${p.x} ${p.y}`)).join(" "));
  trazo.setAttribute("class", "camino");
  svg.append(trazo);
  const nodos: HTMLButtonElement[] = [];
  JEFES.forEach((j, i) => {
    const r = e.records[j.id];
    const abierto = i <= maxAbierto;
    const n = h("button", { type: "button", clase: `pt-nodo ${abierto ? "" : "bloqueado"} ${e.jefesSuperados.includes(j.id) ? "superado" : ""}`, style: `left:${pos[i].x}%;top:${pos[i].y}%`, "aria-label": abierto ? j.nombre : "Bloqueado" },
      h("span", { clase: "pt-nodo-img" }, abierto ? h("img", { src: urlJefe(j.id), alt: "" }) : h("b", {}, "🔒")),
      h("span", { clase: "pt-nodo-nombre" }, abierto ? j.nombre : "???"),
      h("span", { clase: "pt-nodo-est" }, ...[0, 1, 2].map((k) => h("i", { clase: r && k < r.estrellas ? "on" : "" }, "★"))),
    );
    n.addEventListener("click", () => { if (!abierto) { sonido.invalido(); shell.avisar("Derrota al rival anterior para abrir este camino."); return; } sel = i; sonido.clic(); pintar(); });
    mapa.append(n);
    nodos.push(n);
  });

  const detalle = h("aside", { clase: "pt-detalle-jefe" });
  const contenedor = h("div", { clase: "pt-campana" }, mapa, detalle);
  raiz.append(contenedor);

  function equipoBloque(): HTMLElement {
    const a = personaje(e.equipo[0]);
    const b = personaje(e.equipo[1]);
    if (!a || !b) return h("div");
    const s = sinergia(a, b);
    return h("div", { clase: "pt-camp-equipo" },
      h("div", { clase: "pt-camp-duo" }, h("img", { src: urlChibi(a.id), alt: a.nombre }), h("img", { src: urlChibi(b.id), alt: b.nombre })),
      h("div", {}, h("b", {}, `${a.nombre} y ${b.nombre}`), h("small", { clase: `sin ${s.tipo}` }, s.nombre)),
      boton("Cambiar", () => void shell.ir("equipo"), { chico: true, color: "turquesa" }),
    );
  }

  function pintar(): void {
    nodos.forEach((n, i) => n.classList.toggle("sel", i === sel));
    const j: Jefe = JEFES[sel];
    const r = e.records[j.id];
    detalle.replaceChildren(
      h("div", { clase: "pt-detalle-img" }, h("img", { src: urlJefe(j.id), alt: j.nombre })),
      h("h2", {}, j.nombre),
      h("p", { clase: "pt-detalle-frase" }, j.frase),
      h("ul", { clase: "pt-detalle-datos" },
        h("li", {}, h("small", {}, "Vida"), h("b", {}, String(j.vida))),
        h("li", {}, h("small", {}, "Tiempo"), h("b", {}, `${j.tiempo} s`)),
        h("li", {}, h("small", {}, "Récord"), h("b", {}, r ? `${r.puntos}` : "—")),
      ),
      h("p", { clase: "pt-detalle-ataques" }, j.fases.length ? j.fases.map((f) => `${ICONO_ATAQUE[f.tipo]} cada ${f.cada} s`).join(" · ") : "No hace nada especial. Sirve para aprender."),
      equipoBloque(),
      boton("¡A jugar!", async () => { await shell.ir("puzzle", { jefe: sel, equipo: [...e.equipo] }); }, { color: "rosa" }),
    );
  }
  pintar();
  return { desmontar() { /* nada */ } };
}
