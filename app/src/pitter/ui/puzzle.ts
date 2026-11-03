import type { Pantalla, Shell } from "../shell.ts";
import { boton, h, modal, esperar } from "./base.ts";
import { AFINIDADES, personaje, type Personaje } from "../datos/roster.ts";
import { pasivaDe } from "../datos/pasivas.ts";
import { JEFES, type Jefe } from "../datos/campana.ts";
import { arteGlobal, EXPRESIONES, type Expresion } from "../arte/chibis.ts";
import { sonido } from "../audio/audio.ts";
import { MUEBLES } from "../arte/escenarios.ts";
import type { DatosPuzzle } from "../escenas/Puzzle.ts";
import { abrirAjustes } from "./ajustes.ts";
import { barra } from "./barra.ts";

export interface Resultado {
  gano: boolean;
  jefe: Jefe;
  puntos: number;
  estrellas: number;
  segundos: number;
  combo: number;
  nuevos: string[];
  mueble: string;
  habilidades: number;
  standUp: number;
}

export interface Hud {
  tiempo(s: number, max: number): void;
  vida(hp: number, max: number): void;
  /** frac es lo que queda de la ventana del combo (de 0 a 1). */
  combo(n: number, mult: number, frac?: number): void;
  puntos(p: number): void;
  /** restan: cuantas fichas del personaje faltan para llenar el medidor. */
  carga(slot: 0 | 1, frac: number, restan?: number): void;
  lider(nombre: string, texto: string): void;
  stand(frac: number, activo: boolean, restante: number): void;
  banner(texto: string, tipo: "stand" | "aviso" | "rush" | "victoria" | "derrota", sub?: string): void;
  silencio(activo: boolean): void;
  habilidad(slot: 0 | 1, personaje: string, habilidad: string): void;
  expresion(slot: 0 | 1, e: Expresion): void;
  jefeGolpe(): void;
  jefeAtaca(aviso: string): void;
  jefeCae(): void;
  resultado(r: Resultado): void;
}

const urls = new Map<string, string>();
export function urlArte(clave: string, cv: HTMLCanvasElement): string {
  let u = urls.get(clave);
  if (!u) { u = cv.toDataURL("image/png"); urls.set(clave, u); }
  return u;
}
export function urlChibi(id: string, e: Expresion = "idle"): string {
  const cv = arteGlobal.v?.chibi.get(id)?.[e];
  return cv ? urlArte(`${id}:${e}`, cv) : "";
}
export function urlRetrato(id: string): string {
  const cv = arteGlobal.v?.retrato.get(id);
  return cv ? urlArte(`ret:${id}`, cv) : "";
}
export function urlJefe(id: string): string {
  const cv = arteGlobal.v?.jefes.get(id);
  return cv ? urlArte(`jefe:${id}`, cv) : "";
}
export function urlFicha(id: string): string {
  const cv = arteGlobal.v?.ficha.get(id);
  return cv ? urlArte(`fic:${id}`, cv) : "";
}

export function pantallaPuzzle(shell: Shell, d: unknown): Pantalla {
  const datos = d as DatosPuzzle;
  const jefe = JEFES[datos.jefe];
  const equipo = datos.equipo.map((id) => personaje(id)) as [Personaje, Personaje];
  const raiz = shell.ui;
  raiz.append(barra(shell, { titulo: null, extra: [h("span", { clase: "pt-chip" }, `Jefe ${datos.jefe + 1} de ${JEFES.length}`)] }));

  /* --- el equipo, en una fila bajo el tablero como en el original --- */
  const cartas: { el: HTMLElement; img: HTMLImageElement; carga: HTMLElement[]; btn: HTMLButtonElement; restan: HTMLElement }[] = [];
  const equipoFila = h("div", { clase: "pt-equipo-fila" });
  equipo.forEach((p, i) => {
    const img = h("img", { src: urlChibi(p.id), alt: p.nombre, clase: "chibi" });
    const segs = [h("i"), h("i"), h("i")];
    const restan = h("span", { clase: "pt-restan", "data-tip": "Fichas de este personaje que faltan para llenar el medidor" }, "");
    const btn = boton(h("span", {}, "¡", p.habilidad.nombre, "!"), () => { shell.juego?.events.emit("pt:habilidad", i); }, { color: i === 0 ? "rosa" : "turquesa", deshabilitado: true, silencioso: true, tip: `${p.habilidad.nombre}|${p.habilidad.texto}` });
    btn.append(h("kbd", {}, i === 0 ? "Q" : "W"));
    const el = h("div", { clase: `pt-eq-carta slot${i}`, style: `--col:${p.color}` },
      h("div", { clase: "pt-eq-retrato", "data-tip": pasivaDe(p.id) ? `Pasiva, ${pasivaDe(p.id)?.nombre}|${pasivaDe(p.id)?.texto}` : "" }, img, h("span", { clase: "pt-eq-afin", "data-tip": `${AFINIDADES[p.afinidad].nombre}|${AFINIDADES[p.afinidad].texto}` }, AFINIDADES[p.afinidad].nombre)),
      h("div", { clase: "pt-eq-col" },
        h("div", { clase: "pt-eq-nombre" }, h("b", {}, p.nombre), restan),
        h("div", { clase: "pt-medidor", "aria-label": "Carga de la habilidad" }, ...segs),
        btn,
      ),
    );
    equipoFila.append(el);
    cartas.push({ el, img, carga: segs, btn, restan });
  });

  /* --- centro, de arriba abajo como en el original: el jefe, el reloj, el tablero (hueco que dibuja el lienzo) y el equipo --- */
  const relojRelleno = h("i");
  const relojNum = h("b", {}, "60");
  const reloj = h("div", { clase: "pt-reloj" }, h("span", { clase: "pt-reloj-icono" }, "⏱"), h("div", { clase: "pt-reloj-barra" }, relojRelleno), relojNum);

  /* --- derecha: el jefe, el marcador, el combo y el Stand Up --- */
  const vidaRelleno = h("i");
  const vidaTexto = h("span", {}, "");
  const jefeImg = h("img", { src: urlJefe(jefe.id), alt: jefe.nombre, clase: "jefe-img" });
  const jefeAviso = h("small", { clase: "pt-jefe-ataque" }, jefe.fases.length ? "Cuidado: ataca cada cierto tiempo" : "No ataca. Es para aprender.");
  const jefeCard = h("div", { clase: "pt-card pt-jefe-card" },
    h("div", { clase: "pt-jefe-retrato" }, jefeImg),
    h("b", { clase: "pt-jefe-nombre" }, jefe.nombre),
    h("div", { clase: "pt-vida" }, vidaRelleno, vidaTexto),
    jefeAviso,
  );
  const puntosNum = h("b", {}, "0");
  const comboNum = h("b", {}, "0");
  const comboMult = h("small", {}, "×1,0");
  const comboBarraI = h("i");
  const comboBarra = h("div", { clase: "pt-combo-barra", "aria-label": "Tiempo que le queda al combo" }, comboBarraI);
  const liderNombre = h("b", {}, "");
  const liderTexto = h("p", {}, "");
  const standRelleno = h("i");
  const standTexto = h("small", {}, "Llénalo borrando fichas");
  const silenciado = h("div", { clase: "pt-silencio", hidden: true }, "Silenciado");
  const centro = h("main", { clase: "pt-puz-centro pt-nada" }, jefeCard, reloj, h("div", { id: "pt-zona-tablero", clase: "pt-zona pt-nada" }), equipoFila);
  const izq = h("aside", { clase: "pt-puz-izq" },
    h("div", { clase: "pt-card pt-marcador" }, h("small", {}, "Puntos"), puntosNum),
    h("div", { clase: "pt-card pt-combo" }, h("small", {}, "Combo"), comboNum, comboMult, comboBarra),
    h("div", { clase: "pt-card pt-lider" }, h("small", {}, "Habilidad de líder"), liderNombre, liderTexto),
    h("div", { clase: "pt-card pt-objetivo" }, h("small", {}, "Cómo se juega"), h("p", {}, "Arrastra una ficha por su fila o su columna. Junta 4 o más iguales; con 6 o más sale una Caja.")),
  );
  const der = h("aside", { clase: "pt-puz-der" },
    h("div", { clase: "pt-card pt-stand" }, h("div", { clase: "pt-stand-cab" }, h("b", {}, "Stand Up Time"), standTexto), h("div", { clase: "pt-stand-barra" }, standRelleno)),
    silenciado,
    h("div", { clase: "pt-puz-botones" }, boton("?", () => ayuda(), { chico: true, icono: true, color: "turquesa", tip: "Cómo se juega" }), boton("Pausa", () => pausar(), { color: "amarillo", chico: true, tip: "Pausa (P)" })),
  );

  const lienzo = h("div", { clase: "pt-puz pt-nada" }, izq, centro, der);
  raiz.append(lienzo);
  const banner = h("div", { clase: "pt-banner", "aria-live": "polite" });
  raiz.append(banner);

  /* --- piezas del Hud --- */
  let bannerT = 0;
  let comboPrev = 0;
  let pausaAbierta: ReturnType<typeof modal> | null = null;

  function pausar(): void {
    if (pausaAbierta) return;
    shell.juego?.events.emit("pt:pausa");
    pausaAbierta = modal(shell.raiz, "Pausa", h("div", { clase: "pt-pausa" }, h("p", {}, `${jefe.nombre}. Sigue donde lo dejaste.`)), {
      cerrable: true,
      alCerrar: () => { pausaAbierta = null; shell.juego?.events.emit("pt:reanudar"); },
      botones: [
        boton("Ajustes", () => abrirAjustes(shell), { chico: true, color: "violeta" }),
        boton("Salir al salón", () => { pausaAbierta?.cerrar(); void shell.ir("campana"); }, { chico: true, color: "azul" }),
        boton("Reintentar", () => { pausaAbierta?.cerrar(); void shell.ir("puzzle", datos, "rapida"); }, { chico: true, color: "turquesa" }),
        boton("Seguir", () => pausaAbierta?.cerrar(), { color: "amarillo" }),
      ],
    });
  }

  function ayuda(): void {
    const m = modal(shell.raiz, "Cómo se juega", h("div", { clase: "pt-pausa" },
      h("p", {}, "Arrastra una ficha: en cuanto te mueves un poco queda atada a su fila o a su columna, y las demás se apartan a su paso. Al soltarla, los grupos de 4 o más fichas iguales que se tocan se juntan en un bloque grande y le hacen daño al jefe. Cuanto más grande es el grupo, más daño."),
      h("p", {}, "Cada grupo seguido sube el combo y reinicia su tiempo. Si la barra se acaba, el combo se rompe."),
      h("p", {}, "Los grupos de 6 o más dejan una Caja. Tócala para borrar cinco fichas en cruz."),
      h("p", {}, "Cada personaje del equipo tiene una habilidad que se carga con sus propias fichas. Cuando está lista, púlsala (Q y W). La habilidad de líder, la del primero del equipo, salta sola al cumplirse su condición."),
      h("p", {}, "Cuando el medidor del Stand Up Time se llena, empieza solo. El tiempo se para y los grupos no desaparecen: se quedan de pie, y cada uno da unos segundos más. Al acabar atacan todos a la vez. Los cuadrados de 2×2 multiplican el daño."),
    ), { botones: [boton("Entendido", () => m.cerrar(), { color: "amarillo" })] });
  }

  const teclas = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === "q") shell.juego?.events.emit("pt:habilidad", 0);
    else if (k === "w") shell.juego?.events.emit("pt:habilidad", 1);
    else if (k === "p" || k === "escape") { if (!pausaAbierta && !document.querySelector(".pt-resultado")) pausar(); }
  };
  document.addEventListener("keydown", teclas);

  const hud: Hud = {
    tiempo(s, max) {
      relojRelleno.style.width = `${Math.max(0, (s / max) * 100)}%`;
      relojNum.textContent = String(Math.ceil(s));
      reloj.classList.toggle("urgente", s <= 10);
    },
    vida(hp, max) {
      vidaRelleno.style.width = `${Math.max(0, (hp / max) * 100)}%`;
      vidaTexto.textContent = `${Math.ceil(hp)} / ${max}`;
    },
    combo(n, mult, frac = 1) {
      comboBarraI.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
      comboNum.textContent = String(n);
      comboMult.textContent = `×${mult.toFixed(1).replace(".", ",")}`;
      comboNum.parentElement?.classList.toggle("activo", n > 0);
      if (n > comboPrev) { comboNum.animate([{ transform: "scale(1.5) rotate(-6deg)" }, { transform: "scale(1)" }], { duration: 260, easing: "cubic-bezier(0.34,1.56,0.64,1)" }); }
      comboPrev = n;
    },
    puntos(p) { puntosNum.textContent = String(Math.round(p)); },
    lider(nombre, texto) {
      liderNombre.textContent = nombre;
      liderTexto.textContent = texto;
      liderNombre.parentElement?.classList.toggle("vacio", !nombre);
    },
    carga(slot, frac, restan) {
      const c = cartas[slot];
      if (restan !== undefined) c.restan.textContent = frac >= 0.999 ? "¡Lista!" : `faltan ${restan}`;
      const f = Math.max(0, Math.min(1, frac));
      c.carga.forEach((s, i) => { s.style.setProperty("--p", `${Math.max(0, Math.min(1, f * 3 - i)) * 100}%`); });
      const lista = f >= 0.999;
      const eraLista = c.btn.classList.contains("lista");
      c.btn.disabled = !lista;
      c.btn.classList.toggle("lista", lista);
      if (lista && !eraLista) { sonido.cargada(); c.img.src = urlChibi(equipo[slot].id, "feliz"); window.setTimeout(() => { c.img.src = urlChibi(equipo[slot].id); }, 900); }
    },
    stand(frac, activo, restante) {
      standRelleno.style.width = `${Math.min(100, frac * 100)}%`;
      der.classList.toggle("stand-activo", activo);
      raiz.classList.toggle("modo-stand", activo);
      standTexto.textContent = activo ? `¡Ya! ${Math.ceil(restante)} s` : frac >= 1 ? "¡Listo!" : "Llénalo borrando fichas";
    },
    banner(texto, tipo, sub) {
      banner.className = `pt-banner ${tipo}`;
      banner.replaceChildren(h("b", {}, texto), sub ? h("small", {}, sub) : "");
      banner.getBoundingClientRect();
      banner.classList.add("visible");
      window.clearTimeout(bannerT);
      bannerT = window.setTimeout(() => banner.classList.remove("visible"), tipo === "stand" ? 1500 : 1300);
    },
    silencio(activo) { silenciado.hidden = !activo; },
    habilidad(slot, nombre, hab) {
      const p = equipo[slot];
      const corte = h("div", { clase: "pt-corte", style: `--col:${p.color}` },
        h("img", { src: urlChibi(p.id, "poder"), alt: "" }),
        h("div", { clase: "pt-corte-texto" }, h("small", {}, nombre), h("b", {}, hab)),
      );
      raiz.append(corte);
      window.setTimeout(() => corte.remove(), 1000);
    },
    expresion(slot, e) {
      const c = cartas[slot];
      c.img.src = urlChibi(equipo[slot].id, e);
      if (e !== "idle" && e !== "feliz" && e !== "dolor") window.setTimeout(() => { c.img.src = urlChibi(equipo[slot].id); }, 1400);
    },
    jefeGolpe() {
      jefeCard.classList.remove("golpe");
      jefeCard.getBoundingClientRect();
      jefeCard.classList.add("golpe");
    },
    jefeAtaca(aviso) {
      jefeCard.classList.remove("ataca");
      jefeCard.getBoundingClientRect();
      jefeCard.classList.add("ataca");
      jefeAviso.textContent = aviso;
      window.setTimeout(() => jefeCard.classList.remove("ataca"), 900);
    },
    jefeCae() { jefeCard.classList.add("cae"); },
    resultado(r) { void mostrarResultado(r); },
  };

  async function mostrarResultado(r: Resultado): Promise<void> {
    document.removeEventListener("keydown", teclas);
    const sig = datos.jefe + 1 < JEFES.length ? datos.jefe + 1 : -1;
    const estrellas = h("div", { clase: "pt-res-estrellas" }, ...[0, 1, 2].map((i) => h("span", { clase: i < r.estrellas ? "on" : "" }, "★")));
    const nuevos = r.nuevos.map((id) => personaje(id)).filter(Boolean) as Personaje[];
    const caja = h("div", { clase: `pt-resultado ${r.gano ? "gano" : "perdio"}` },
      h("div", { clase: "pt-res-panel" },
        h("h2", {}, r.gano ? "¡Victoria!" : "Casi"),
        h("p", { clase: "pt-res-sub" }, r.gano ? `${r.jefe.nombre} ha caído.` : `${r.jefe.nombre} sigue en pie. Prueba otra vez.`),
        estrellas,
        h("div", { clase: "pt-res-datos" },
          h("span", {}, h("small", {}, "Puntos"), h("b", {}, String(r.puntos))),
          h("span", {}, h("small", {}, "Tiempo"), h("b", {}, `${r.segundos} s`)),
          h("span", {}, h("small", {}, "Mejor combo"), h("b", {}, String(r.combo))),
          h("span", {}, h("small", {}, "Habilidades"), h("b", {}, String(r.habilidades))),
          h("span", {}, h("small", {}, "Stand Up"), h("b", {}, String(r.standUp))),
        ),
        nuevos.length ? h("div", { clase: "pt-res-nuevos" }, h("small", {}, "¡Nuevos en tu colección!"), h("div", {}, ...nuevos.map((p) => h("figure", { style: `--col:${p.color}` }, h("img", { src: urlRetrato(p.id), alt: p.nombre }), h("figcaption", {}, p.nombre))))) : "",
        r.mueble ? h("p", { clase: "pt-res-mueble" }, `¡Mueble nuevo para tus habitaciones: ${MUEBLES.find((m) => m.id === r.mueble)?.nombre ?? r.mueble}!`) : "",
        h("div", { clase: "pt-res-botones" },
          boton("Salón", () => void shell.ir("menu"), { chico: true, color: "azul" }),
          boton("Jefes", () => void shell.ir("campana"), { chico: true, color: "violeta" }),
          boton("Reintentar", () => void shell.ir("puzzle", datos, "rapida"), { color: "turquesa" }),
          r.gano && sig >= 0 ? boton("Siguiente jefe ▶", () => void shell.ir("puzzle", { ...datos, jefe: sig }, "diagonal"), { color: "amarillo" }) : "",
        ),
      ),
    );
    raiz.append(caja);
    const sp = [...caja.querySelectorAll<HTMLElement>(".pt-res-estrellas span.on")];
    for (let i = 0; i < sp.length; i++) { await esperar(380); sp[i].classList.add("pop"); sonido.desbloqueo(); }
    if (nuevos.length) { await esperar(400); sonido.desbloqueo(); }
    void EXPRESIONES;
  }

  shell.juego?.registry.set("hud", hud);
  return { desmontar() { document.removeEventListener("keydown", teclas); pausaAbierta?.cerrar(); raiz.classList.remove("modo-stand"); } };
}
