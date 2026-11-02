import type { Pantalla, Shell } from "../shell.ts";
import { boton, h, estrellas } from "./base.ts";
import { barra } from "./barra.ts";
import { AFINIDADES, RAREZAS, personaje, personajesVisibles, type Personaje } from "../datos/roster.ts";
import { sinergia } from "../datos/sinergias.ts";
import { sonido } from "../audio/audio.ts";
import { urlChibi, urlRetrato } from "./puzzle.ts";

/* El equipo de dos: principal y compañero, sus habilidades frente a frente y lo que pasa cuando se juntan. */
export function pantallaEquipo(shell: Shell, datos: unknown): Pantalla {
  const e = shell.estado;
  const pedido = (datos as { poner?: string } | undefined)?.poner;
  const raiz = shell.ui;
  const mios = personajesVisibles().filter((p) => e.desbloqueados.includes(p.id));
  let slot: 0 | 1 = 0;
  raiz.append(barra(shell, { titulo: "Tu equipo" }));

  const escena = h("div", { clase: "pt-eq-escena" });
  const centro = h("div", { clase: "pt-eq-centro" });
  const tira = h("div", { clase: "pt-eq-tira" });
  const guardados = h("aside", { clase: "pt-eq-guardados" });
  raiz.append(h("div", { clase: "pt-equipo" }, h("main", { clase: "pt-equipo-main" }, escena, centro, tira), guardados));

  const get = (i: 0 | 1): Personaje => personaje(e.equipo[i]) as Personaje;

  function asignar(id: string, en: 0 | 1): void {
    const otro: 0 | 1 = en === 0 ? 1 : 0;
    if (e.equipo[en] === id) return;
    if (e.equipo[otro] === id) e.equipo[otro] = e.equipo[en];
    e.equipo[en] = id;
    shell.guardar();
    sonido.cargada();
    pintar(true);
  }

  function pedestal(i: 0 | 1, rebote: boolean): HTMLElement {
    const p = get(i);
    const r = RAREZAS[p.rareza];
    const caja = h("button", { type: "button", clase: `pt-pedestal ${slot === i ? "activo" : ""} ${rebote ? "rebota" : ""}`, style: `--col:${p.color};--marco:${r.marco}`, "aria-pressed": slot === i ? "true" : "false", "aria-label": `${i === 0 ? "Principal" : "Compañero"}: ${p.nombre}` },
      h("span", { clase: "pt-pedestal-rol" }, i === 0 ? "Principal" : "Compañero"),
      h("img", { src: urlChibi(p.id, rebote ? "feliz" : "idle"), alt: p.nombre }),
      h("span", { clase: "pt-pedestal-base" }),
      h("b", {}, p.nombre),
      h("span", { clase: "pt-pedestal-afin", style: `background:${AFINIDADES[p.afinidad].color}` }, AFINIDADES[p.afinidad].nombre),
    );
    caja.addEventListener("click", () => { slot = i; sonido.clic(); pintar(false); });
    return caja;
  }

  function tarjetaHab(p: Personaje): HTMLElement {
    return h("div", { clase: "pt-eq-hab", style: `--col:${p.color}` }, h("small", {}, p.nombre), h("b", {}, p.habilidad.nombre), h("p", {}, p.habilidad.texto), h("small", { clase: "carga" }, `Carga: ${p.habilidad.carga} fichas`));
  }

  function pintar(rebote: boolean): void {
    const a = get(0), b = get(1);
    const s = sinergia(a, b);
    escena.replaceChildren(pedestal(0, rebote), h("div", { clase: `pt-eq-mas ${s.tipo}` }, h("span", {}, s.tipo === "especial" ? "★" : "+")), pedestal(1, rebote));
    centro.replaceChildren(
      h("div", { clase: "pt-eq-habs" }, tarjetaHab(a), h("span", { clase: "pt-vs" }, "VS"), tarjetaHab(b)),
      h("div", { clase: `pt-eq-sin ${s.tipo}` }, h("b", {}, s.nombre), h("p", {}, s.texto)),
    );
    if (rebote && s.tipo === "especial") { sonido.desbloqueo(); centro.querySelector(".pt-eq-sin")?.classList.add("destello"); }
    tira.replaceChildren(h("small", { clase: "pt-tira-titulo" }, slot === 0 ? "Elige el principal" : "Elige el compañero"), ...mios.map((p) => {
      const usado = e.equipo.includes(p.id);
      const b2 = h("button", { type: "button", clase: `pt-mini ${usado ? "usado" : ""}`, style: `--col:${p.color};--marco:${RAREZAS[p.rareza].marco}`, "data-tip": `${p.nombre}|${p.habilidad.nombre}` },
        h("img", { src: urlRetrato(p.id), alt: p.nombre }), h("span", {}, p.nombre.split(" ")[0]));
      b2.addEventListener("click", () => asignar(p.id, slot));
      return b2;
    }));
    pintarGuardados();
  }

  function pintarGuardados(): void {
    const nombre = h("input", { type: "text", maxlength: 18, placeholder: "Nombre del equipo", clase: "pt-input", "aria-label": "Nombre del equipo" });
    const guardar = boton("Guardar este equipo", () => {
      const t = nombre.value.trim() || `${get(0).nombre.split(" ")[0]} y ${get(1).nombre.split(" ")[0]}`;
      if (e.equipos.length >= 8) { shell.avisar("Ya tienes 8 equipos guardados. Borra alguno."); sonido.invalido(); return; }
      e.equipos.push({ nombre: t, ids: [e.equipo[0], e.equipo[1]] });
      shell.guardar();
      shell.avisar(`Equipo «${t}» guardado`);
      pintarGuardados();
    }, { chico: true, color: "turquesa" });
    guardados.replaceChildren(
      h("h2", {}, "Equipos guardados"),
      h("div", { clase: "pt-guardar" }, nombre, guardar),
      ...(e.equipos.length ? e.equipos.map((q, i) => {
        const a = personaje(q.ids[0]), b = personaje(q.ids[1]);
        const util = a && b && e.desbloqueados.includes(a.id) && e.desbloqueados.includes(b.id);
        return h("div", { clase: `pt-eq-guardado ${util ? "" : "inutil"}` },
          h("div", { clase: "duo" }, a ? h("img", { src: urlRetrato(a.id), alt: a.nombre }) : "", b ? h("img", { src: urlRetrato(b.id), alt: b.nombre }) : ""),
          h("div", { clase: "nom" }, h("b", {}, q.nombre), h("small", {}, a && b ? sinergia(a, b).nombre : "")),
          boton("Usar", () => { if (!util) { sonido.invalido(); return; } e.equipo = [q.ids[0], q.ids[1]]; shell.guardar(); sonido.cargada(); pintar(true); }, { chico: true, color: "azul", deshabilitado: !util }),
          boton("✕", () => { e.equipos.splice(i, 1); shell.guardar(); pintarGuardados(); }, { chico: true, icono: true, color: "rosa", tip: "Borrar" }),
        );
      }) : [h("p", { clase: "pt-nota" }, "Aquí aparecerán los equipos que guardes.")]),
      h("div", { clase: "pt-eq-jugar" }, boton("¡A jugar!", () => void shell.ir("campana"), { color: "rosa" })),
    );
  }

  if (pedido && e.desbloqueados.includes(pedido)) { slot = 1; asignar(pedido, 1); } else pintar(false);
  void estrellas;
  return { desmontar() { /* nada */ } };
}
