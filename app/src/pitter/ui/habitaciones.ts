import type { Pantalla, Shell } from "../shell.ts";
import { boton, h, modal } from "./base.ts";
import { cabeceraMansion } from "./cabecera.ts";
import { MUEBLES, dibujarMueble } from "../arte/escenarios.ts";
import { TEMAS_HAB } from "../arte/habitacion.ts";
import { AFINIDADES, personaje, personajesVisibles } from "../datos/roster.ts";
import type { Habitacion } from "../estado.ts";
import { sonido } from "../audio/audio.ts";
import { urlArte, urlRetrato } from "./puzzle.ts";

/* La habitacion, con los controles en el sitio donde los pone el original: la placa con el nombre y los residentes arriba, el diorama en el centro
   y abajo una fila con Volver, Favorito, Regalo, Redecorar, Convivir y Cambiar. */
export function pantallaHabitaciones(shell: Shell, datos: unknown): Pantalla {
  const e = shell.estado;
  const raiz = shell.ui;
  let indice = Math.min(e.habitaciones.length - 1, (datos as { indice?: number } | undefined)?.indice ?? 0);
  let editar = false;
  const emitir = (cfg: object): void => { shell.juego?.events.emit("pt:hab", cfg); };
  const hab = (): Habitacion => e.habitaciones[indice];

  raiz.append(cabeceraMansion(shell, [boton("📷", () => { shell.juego?.events.emit("pt:foto"); }, { chico: true, icono: true, color: "rosa", tip: "Sacar una foto de la habitación" })]));

  /* --- la placa con el nombre y los residentes --- */
  const placaNombre = h("b", {});
  const placaRes = h("span", { clase: "pt-placa-res" });
  const placa = h("div", { clase: "pt-placa" }, placaNombre, placaRes);

  /* --- columnas laterales: al decorar, muebles a la derecha y fondos a la izquierda --- */
  const izq = h("aside", { clase: "pt-lat izq", hidden: true });
  const der = h("aside", { clase: "pt-lat der", hidden: true });

  /* --- la fila de abajo --- */
  const btnFav = boton("★", () => elegirFavorito(), { icono: true, color: "amarillo", tip: "Favorito|Elige a quién ves en el menú" });
  btnFav.classList.add("pt-redondo");
  const btnReg = boton("Regalo", () => regalar(), { color: "rosa", tip: "Regalo|Un detalle para quien vive aquí" });
  btnReg.classList.add("pt-ancho");
  const btnCon = boton("👥", () => convivir(), { icono: true, color: "turquesa", tip: "Convivir|Elige quién vive en esta habitación (hasta 2)" });
  btnCon.classList.add("pt-redondo");
  const btnVolver = boton("◀ Volver", () => void shell.ir("menu", { desde: indice }, "rapida"), { color: "amarillo" });
  const btnRedec = boton("Redecorar", () => alternarEdicion(), { color: "rosa" });
  btnRedec.classList.add("pt-gigante-hab");
  const btnCambiar = boton("Cambiar", () => cambiarHabitacion(), { color: "amarillo", tip: "Pasa a la siguiente habitación" });
  const fila = h("div", { clase: "pt-hab-fila" }, btnVolver, btnFav, btnReg, btnRedec, btnCon, btnCambiar);

  /* --- tira de dialogo: una cinta de papel rasgado, algo torcida, con el retrato asomando por un lado --- */
  const tira = h("div", { clase: "pt-tira", hidden: true });
  let tiraT = 0;
  /* Un borde rasgado distinto cada vez: puntos a lo largo de arriba y de abajo con un pequeño desplazamiento al azar. */
  const rasgado = (): string => {
    const n = 34;
    const arriba: string[] = [], abajo: string[] = [];
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * 100;
      arriba.push(`${x.toFixed(1)}% ${(Math.random() * 9 + 1).toFixed(1)}%`);
      abajo.push(`${(100 - x).toFixed(1)}% ${(100 - Math.random() * 9 - 1).toFixed(1)}%`);
    }
    return `polygon(0% 12%,${arriba.join(",")},100% 88%,${abajo.join(",")})`;
  };
  const mostrarTira = (d: unknown): void => {
    const { id, texto, lado } = d as { id: string; texto: string; lado?: number };
    const p = personaje(id);
    if (!p) return;
    const cinta = h("div", { clase: "pt-cinta" }, h("small", {}, p.nombre), h("b", {}, texto));
    cinta.style.clipPath = rasgado();
    const retrato = h("img", { clase: "pt-tira-retrato", src: urlRetrato(id), alt: "" });
    tira.className = `pt-tira ${lado === 1 ? "der" : "izq"}`;
    tira.style.setProperty("--giro", `${(lado === 1 ? 1 : -1) * (1 + Math.random() * 1.5)}deg`);
    tira.replaceChildren(cinta, retrato);
    tira.hidden = false;
    const dur = Math.min(6500, 2400 + texto.length * 55);
    tira.style.setProperty("--dur", `${dur}ms`);
    tira.classList.remove("entra");
    tira.getBoundingClientRect();
    tira.classList.add("entra");
    window.clearTimeout(tiraT);
    tiraT = window.setTimeout(() => { tira.hidden = true; }, dur);
  };
  shell.juego?.events.on("pt:tira", mostrarTira);

  raiz.append(placa, izq, der, fila, tira);

  /* --- pintar --- */
  function pintar(): void {
    const hb = hab();
    placaNombre.textContent = `Habitación ${indice + 1}`;
    placaRes.replaceChildren(...hb.residentes.map((id) => {
      const p = personaje(id);
      return p ? h("span", { clase: "res", style: `--col:${AFINIDADES[p.afinidad].color}` }, h("img", { src: urlRetrato(id), alt: "" }), p.nombre.split(" ")[0]) : "";
    }));
    btnRedec.textContent = editar ? "Listo" : "Redecorar";
    izq.hidden = !editar;
    der.hidden = !editar;
    fila.classList.toggle("editando", editar);
    if (editar) { pintarFondos(); pintarMuebles(); }
  }

  function pintarFondos(): void {
    izq.replaceChildren(h("small", {}, "Fondo"), ...TEMAS_HAB.map((t) => {
      const b = h("button", { type: "button", clase: `pt-tema ${hab().fondo === t.id ? "sel" : ""}`, style: `--a:${t.pared[0]};--b:${t.pared[1]};--c:${t.zocalo}`, "data-tip": t.nombre }, h("span", {}), h("i", {}, t.nombre));
      b.addEventListener("click", () => { hab().fondo = t.id; sonido.mueble(); shell.guardar(); emitir({ refrescar: true }); pintar(); });
      return b;
    }));
  }

  function pintarMuebles(): void {
    const t = TEMAS_HAB.find((x) => x.id === hab().fondo) ?? TEMAS_HAB[0];
    der.replaceChildren(h("small", {}, "Muebles"), h("p", { clase: "ayuda" }, "Pulsa para poner uno. Arrástralo para moverlo y suéltalo por debajo del suelo para quitarlo."),
      ...e.muebles.map((id) => {
        const def = MUEBLES.find((d) => d.id === id);
        if (!def) return "";
        const b = h("button", { type: "button", clase: "pt-mueble", "data-tip": `${def.nombre}|Pulsa para poner uno` }, h("img", { src: urlArte(`mue:${id}:${t.detalle}`, dibujarMueble(id, t.detalle)), alt: def.nombre }), h("span", {}, def.nombre));
        b.addEventListener("click", () => { shell.juego?.events.emit("pt:hab-nuevo", id); });
        return b;
      }));
  }

  function alternarEdicion(): void {
    editar = !editar;
    emitir({ editar });
    if (!editar) { shell.guardar(true); shell.avisar("Habitación guardada"); }
    sonido.clic();
    pintar();
  }

  function cambiarHabitacion(): void {
    if (e.habitaciones.length < 2) { shell.avisar("Todavía solo tienes una habitación. Consigue estrellas para abrir más."); sonido.invalido(); return; }
    if (editar) alternarEdicion();
    indice = (indice + 1) % e.habitaciones.length;
    emitir({ indice });
    pintar();
  }

  function regalar(): void {
    const hb = hab();
    if (!hb.residentes.length) { shell.avisar("Aquí no vive nadie todavía."); sonido.invalido(); return; }
    sonido.desbloqueo();
    shell.juego?.events.emit("pt:regalo");
    hb.residentes.forEach((id, i) => window.setTimeout(() => mostrarTira({ id, texto: ["¡Es justo lo que quería!", "¡Gracias! Lo guardo aquí.", "¿Para mí? ¡Qué detalle!"][i % 3] }), 300 + i * 1500));
    e.stats.regalos = (e.stats.regalos ?? 0) + 1;
    shell.guardar();
  }

  function elegirFavorito(): void {
    const ids = hab().residentes;
    if (!ids.length) { shell.avisar("Aquí no vive nadie todavía."); sonido.invalido(); return; }
    const caja = h("div", { clase: "pt-res-rejilla" }, ...ids.map((id) => {
      const p = personaje(id);
      if (!p) return "";
      const b = h("button", { type: "button", clase: `pt-mini ${e.favorito === id ? "usado" : ""}`, style: `--col:${p.color};--marco:#2a1545` }, h("img", { src: urlRetrato(id), alt: p.nombre }), h("span", {}, p.nombre.split(" ")[0]));
      b.addEventListener("click", () => { e.favorito = id; shell.guardar(); sonido.cargada(); shell.avisar(`${p.nombre} es ahora tu favorito.`); m.cerrar(); });
      return b;
    }));
    const m = modal(shell.raiz, "Tu favorito", h("div", {}, h("p", { clase: "pt-nota" }, "Es el que se ve en el menú."), caja), { botones: [boton("Cerrar", () => m.cerrar(), { color: "amarillo" })] });
  }

  function convivir(): void {
    const mios = personajesVisibles().filter((p) => e.desbloqueados.includes(p.id));
    const actual = new Set(hab().residentes);
    const rej = h("div", { clase: "pt-res-rejilla" });
    const pintarRej = () => rej.replaceChildren(...mios.map((p) => {
      const b = h("button", { type: "button", clase: `pt-mini ${actual.has(p.id) ? "usado" : ""}`, style: `--col:${p.color};--marco:#2a1545` }, h("img", { src: urlRetrato(p.id), alt: p.nombre }), h("span", {}, p.nombre.split(" ")[0]));
      b.addEventListener("click", () => {
        if (actual.has(p.id)) actual.delete(p.id);
        else if (actual.size >= 2) { shell.avisar("En cada habitación caben 2."); sonido.invalido(); return; }
        else actual.add(p.id);
        sonido.clic();
        pintarRej();
      });
      return b;
    }));
    pintarRej();
    const m = modal(shell.raiz, "¿Quién vive aquí?", h("div", {}, h("p", { clase: "pt-nota" }, "Hasta 2 personajes por habitación. Si ya viven en otra, se mudan."), rej), {
      botones: [boton("Listo", () => m.cerrar(), { color: "amarillo" })],
      alCerrar: () => {
        e.habitaciones.forEach((h2, i) => { if (i !== indice) h2.residentes = h2.residentes.filter((id) => !actual.has(id)); });
        hab().residentes = [...actual];
        shell.guardar(true); emitir({ refrescar: true }); pintar();
      },
    });
  }

  pintar();
  return { desmontar() { shell.juego?.events.off("pt:tira", mostrarTira); window.clearTimeout(tiraT); if (editar) shell.guardar(true); } };
}
