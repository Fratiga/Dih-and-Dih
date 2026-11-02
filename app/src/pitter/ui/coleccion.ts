import type { Pantalla, Shell } from "../shell.ts";
import { boton, estrellas, h, modal, esperar } from "./base.ts";
import { barra } from "./barra.ts";
import { AFINIDADES, RAREZAS, personajesVisibles, type Afinidad, type Personaje, type Rareza } from "../datos/roster.ts";
import { JEFES } from "../datos/campana.ts";
import { sinergia } from "../datos/sinergias.ts";
import { sonido } from "../audio/audio.ts";
import { urlChibi, urlRetrato } from "./puzzle.ts";
import type { Expresion } from "../arte/chibis.ts";

/* El album: cada personaje es una ficha coleccionable. Al elegir una se abre su presentacion. */
export function pantallaColeccion(shell: Shell, datos: unknown): Pantalla {
  const e = shell.estado;
  const todos = personajesVisibles();
  const raiz = shell.ui;
  const filtro = { rareza: "" as "" | Rareza, afinidad: "" as "" | Afinidad, soloMios: false };
  const nuevos = todos.filter((p) => e.desbloqueados.includes(p.id) && !e.vistos.includes(p.id));
  raiz.append(barra(shell, { titulo: "Colección" }));

  const cuadricula = h("div", { clase: "pt-album-rejilla" });
  const contador = h("div", { clase: "pt-album-cuenta" });
  const filtros = h("aside", { clase: "pt-album-filtros" });

  const chips = <T extends string>(titulo: string, opciones: [T | "", string, string?][], valor: () => T | "", poner: (v: T | "") => void): HTMLElement => {
    const caja = h("div", { clase: "pt-chips" }, h("small", {}, titulo));
    const fila = h("div", { clase: "pt-chips-fila" });
    for (const [v, t, color] of opciones) {
      const b = boton(t, () => { poner(v); sonido.clic(); pintarFiltros(); pintar(); }, { chico: true, color: "violeta", silencioso: true });
      b.dataset.v = v;
      if (color) b.style.setProperty("--chip", color);
      b.classList.add("chip");
      fila.append(b);
    }
    caja.append(fila);
    (caja as HTMLElement & { marcar?: () => void }).marcar = () => fila.querySelectorAll("button").forEach((b) => b.classList.toggle("sel", b.dataset.v === valor()));
    return caja;
  };
  const cRareza = chips<Rareza>("Rareza", [["", "Todas"], ...(Object.keys(RAREZAS) as Rareza[]).filter((r) => todos.some((p) => p.rareza === r)).map((r) => [r, RAREZAS[r].nombre, RAREZAS[r].marco] as [Rareza, string, string])], () => filtro.rareza, (v) => (filtro.rareza = v));
  const cAfin = chips<Afinidad>("Afinidad", [["", "Todas"], ...(Object.keys(AFINIDADES) as Afinidad[]).map((a) => [a, AFINIDADES[a].nombre, AFINIDADES[a].color] as [Afinidad, string, string])], () => filtro.afinidad, (v) => (filtro.afinidad = v));
  const cMios = boton("Solo los que tengo", (b) => { filtro.soloMios = !filtro.soloMios; b.classList.toggle("sel", filtro.soloMios); sonido.clic(); pintar(); }, { chico: true, color: "turquesa", silencioso: true });
  function pintarFiltros(): void { (cRareza as HTMLElement & { marcar: () => void }).marcar(); (cAfin as HTMLElement & { marcar: () => void }).marcar(); }
  filtros.append(h("div", { clase: "pt-album-resumen" }, contador, h("div", { clase: "pt-barra-prog" }, h("i", {}))), cRareza, cAfin, cMios);
  pintarFiltros();

  const cuerpo = h("div", { clase: "pt-album" }, filtros, h("main", { clase: "pt-album-centro" }, cuadricula));
  raiz.append(cuerpo);

  function pistaDeBloqueo(p: Personaje): string {
    const faltan = todos.filter((q) => !e.desbloqueados.includes(q.id));
    const i = faltan.findIndex((q) => q.id === p.id);
    const jefe = JEFES[Math.min(JEFES.length - 1, e.jefesSuperados.length + Math.floor(i / 2))];
    return `Derrota a ${jefe?.nombre ?? "un jefe"} para conseguirlo`;
  }

  function ficha(p: Personaje): HTMLElement {
    const mio = e.desbloqueados.includes(p.id);
    const r = RAREZAS[p.rareza];
    const nuevo = mio && !e.vistos.includes(p.id);
    const b = h("button", { type: "button", clase: `pt-ficha ${mio ? "" : "bloqueada"} ${nuevo ? "nueva" : ""}`, style: `--marco:${r.marco};--col:${p.color};--brillo:${r.brillo}`, "aria-label": mio ? p.nombre : "Personaje bloqueado", "data-tip": mio ? `${p.nombre}|${p.habilidad.nombre}: ${p.habilidad.texto}` : "Bloqueado|" + pistaDeBloqueo(p) },
      h("span", { clase: "pt-ficha-cuadro" }, h("img", { src: urlRetrato(p.id), alt: "" })),
      h("span", { clase: "pt-ficha-nombre" }, mio ? p.nombre : "???"),
      h("span", { clase: "pt-ficha-pie" }, estrellas(r.estrellas), h("em", { style: `background:${AFINIDADES[p.afinidad].color}` }, mio ? AFINIDADES[p.afinidad].nombre : "?")),
      nuevo ? h("span", { clase: "pt-ficha-nuevo" }, "¡Nuevo!") : "",
    );
    b.addEventListener("click", () => {
      if (!mio) { sonido.invalido(); shell.avisar(pistaDeBloqueo(p)); return; }
      void presentar(p, b);
    });
    return b;
  }

  function pintar(): void {
    const lista = todos.filter((p) => (!filtro.rareza || p.rareza === filtro.rareza) && (!filtro.afinidad || p.afinidad === filtro.afinidad) && (!filtro.soloMios || e.desbloqueados.includes(p.id)));
    cuadricula.replaceChildren(...lista.map(ficha));
    if (!lista.length) cuadricula.append(h("p", { clase: "pt-vacio" }, "Ninguno con esos filtros."));
    const mios = todos.filter((p) => e.desbloqueados.includes(p.id)).length;
    contador.replaceChildren(h("b", {}, `${mios} / ${todos.length}`), " personajes");
    (filtros.querySelector(".pt-barra-prog i") as HTMLElement).style.width = `${(mios / Math.max(1, todos.length)) * 100}%`;
  }
  pintar();

  /* --- La presentacion de un personaje --- */
  async function presentar(p: Personaje, origen: HTMLElement): Promise<void> {
    sonido.desbloqueo();
    if (!e.vistos.includes(p.id)) { e.vistos.push(p.id); shell.guardar(); origen.classList.remove("nueva"); origen.querySelector(".pt-ficha-nuevo")?.remove(); }
    const r = RAREZAS[p.rareza];
    const img = h("img", { src: urlChibi(p.id), alt: p.nombre, clase: "pt-pres-chibi" });
    const reaccionar = (x: Expresion, clase: string): void => {
      img.src = urlChibi(p.id, x);
      img.classList.remove("salta", "poder");
      img.getBoundingClientRect();
      img.classList.add(clase);
      window.setTimeout(() => { img.src = urlChibi(p.id); }, 1100);
    };
    img.addEventListener("click", () => { sonido.cargada(); reaccionar("feliz", "salta"); });
    const poder = boton("Habilidad", () => { sonido.habilidad(); reaccionar("poder", "poder"); }, { chico: true, color: "rosa", silencioso: true });
    const dolor = boton("Ay", () => { sonido.invalido(); reaccionar("dolor", "salta"); }, { chico: true, color: "azul", silencioso: true });
    const estaEnEquipo = e.equipo.includes(p.id);
    const comp = e.equipo.filter((id) => id !== p.id).map((id) => todos.find((q) => q.id === id)).filter(Boolean)[0] as Personaje | undefined;
    const sin = comp ? sinergia(p, comp) : null;
    const nivel = e.niveles[p.id] ?? 0;
    const contenido = h("div", { clase: "pt-pres", style: `--col:${p.color};--marco:${r.marco}` },
      h("div", { clase: "pt-pres-escena" },
        h("div", { clase: "pt-pres-foco" }),
        img,
        h("div", { clase: "pt-pres-botones" }, poder, dolor),
      ),
      h("div", { clase: "pt-pres-datos" },
        h("small", { clase: "pt-pres-rareza" }, r.nombre, " · ", estrellas(r.estrellas)),
        h("p", { clase: "pt-pres-epiteto" }, p.epiteto || AFINIDADES[p.afinidad].nombre),
        h("div", { clase: "pt-pres-chips" },
          h("span", { clase: "chip", style: `background:${AFINIDADES[p.afinidad].color}` }, AFINIDADES[p.afinidad].nombre),
          h("span", { clase: "chip claro" }, `Ataque ${p.atq}`), h("span", { clase: "chip claro" }, `Vida ${p.pv}`), h("span", { clase: "chip claro" }, `Nivel ${nivel + 1}`),
        ),
        h("div", { clase: "pt-pres-hab" }, h("small", {}, "Habilidad"), h("b", {}, p.habilidad.nombre), h("p", {}, p.habilidad.texto), h("small", { clase: "carga" }, `Se carga con ${Math.round(p.habilidad.carga * (1 - 0.02 * nivel))} fichas suyas`)),
        p.resumen ? h("p", { clase: "pt-pres-resumen" }, p.resumen) : "",
        sin && sin.tipo !== "ninguna" ? h("p", { clase: "pt-pres-sin" }, h("b", {}, `Con ${comp?.nombre}: ${sin.nombre}. `), sin.texto) : "",
      ),
    );
    const botones: HTMLElement[] = [
      boton(estaEnEquipo ? "Ya está en tu equipo" : "Ponerlo en el equipo", () => { void m.cerrar(); void shell.ir("equipo", { poner: p.id }, "centro"); }, { color: "turquesa", deshabilitado: estaEnEquipo }),
      boton("Cerrar", () => m.cerrar(), { color: "amarillo" }),
    ];
    const m = modal(shell.raiz, p.nombre, contenido, { ancho: 980, botones });
    m.el.querySelector(".pt-modal")?.classList.add("pt-modal-pres");
    await esperar(60);
    reaccionar("feliz", "salta");
  }

  // Los nuevos se anuncian una vez
  if (nuevos.length) window.setTimeout(() => shell.avisar(`¡${nuevos.length === 1 ? "Un personaje nuevo" : nuevos.length + " personajes nuevos"} en tu colección!`, 2600), 700);
  void datos;
  return { desmontar() { /* nada */ } };
}
