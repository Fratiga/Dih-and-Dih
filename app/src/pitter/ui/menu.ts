import type { Pantalla, Shell } from "../shell.ts";
import { boton, h, modal } from "./base.ts";
import { personaje } from "../datos/roster.ts";
import { JEFES } from "../datos/campana.ts";
import { MUEBLES } from "../arte/escenarios.ts";
import { sonido } from "../audio/audio.ts";
import { urlJefe, urlRetrato } from "./puzzle.ts";
import { cabeceraMansion } from "./cabecera.ts";

const hoy = (): string => new Date().toISOString().slice(0, 10);

const ICONO = {
  libro: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 10h14c2 0 3 1 3 3v26c0-2-1-3-3-3H8z" fill="#fff"/><path d="M40 10H26c-2 0-3 1-3 3v26c0-2 1-3 3-3h14z" fill="#ffe36b"/><path d="M8 10h14c2 0 3 1 3 3v26c0-2-1-3-3-3H8zM40 10H26c-2 0-3 1-3 3v26c0-2 1-3 3-3h14z" fill="none" stroke="#2a1545" stroke-width="3.5" stroke-linejoin="round"/></svg>',
  espadas: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 40L36 8l4 4-28 32z M40 40L12 8 8 12l28 32z" fill="#fff" stroke="#2a1545" stroke-width="3.5" stroke-linejoin="round"/><path d="M6 36l6 6M42 36l-6 6" stroke="#2a1545" stroke-width="5" stroke-linecap="round"/></svg>',
  equipo: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="17" cy="18" r="9" fill="#fff" stroke="#2a1545" stroke-width="3.5"/><circle cx="32" cy="22" r="8" fill="#ffe36b" stroke="#2a1545" stroke-width="3.5"/><path d="M4 42c0-9 6-13 13-13s13 4 13 13zM28 42c0-6 3-10 8-10s9 3 9 10z" fill="#fff" stroke="#2a1545" stroke-width="3.5" stroke-linejoin="round"/></svg>',
  regalo: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="20" width="34" height="22" rx="3" fill="#fff" stroke="#2a1545" stroke-width="3.5"/><rect x="5" y="14" width="38" height="8" rx="3" fill="#ffe36b" stroke="#2a1545" stroke-width="3.5"/><path d="M24 14v28M24 14c-4-9-12-8-10-3s8 3 10 3zm0 0c4-9 12-8 10-3s-8 3-10 3z" fill="none" stroke="#2a1545" stroke-width="3.5" stroke-linejoin="round"/></svg>',
  copa: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 8h20v12c0 7-4 11-10 11s-10-4-10-11z" fill="#ffe36b" stroke="#2a1545" stroke-width="3.5" stroke-linejoin="round"/><path d="M14 12H6c0 7 3 10 8 10M34 12h8c0 7-3 10-8 10" fill="none" stroke="#2a1545" stroke-width="3.5"/><path d="M24 31v7M15 42h18" stroke="#2a1545" stroke-width="4" stroke-linecap="round"/></svg>',
  mueble: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="22" width="32" height="14" rx="5" fill="#fff" stroke="#2a1545" stroke-width="3.5"/><rect x="12" y="12" width="24" height="12" rx="5" fill="#ffe36b" stroke="#2a1545" stroke-width="3.5"/><path d="M12 36v6M36 36v6" stroke="#2a1545" stroke-width="4" stroke-linecap="round"/></svg>',
  ayuda: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M17 18c0-5 3-8 8-8s8 3 8 7c0 6-8 6-8 12" fill="none" stroke="#2a1545" stroke-width="5" stroke-linecap="round"/><circle cx="25" cy="39" r="3.5" fill="#2a1545"/></svg>',
};

function icono(svg: string): HTMLElement {
  const s = h("span", { clase: "ico" });
  s.innerHTML = svg;
  return s;
}

/* El menu es la mansion: arriba tu nivel y tus cuentas, a la derecha los iconos, abajo los tres botones grandes y las habitaciones en la torre. */
export function pantallaMenu(shell: Shell): Pantalla {
  const e = shell.estado;
  const raiz = shell.ui;
  const proximo = Math.min(JEFES.length - 1, e.jefesSuperados.length);
  const j = JEFES[proximo];

  const bar = cabeceraMansion(shell);

  /* --- el banner del proximo rival, como el de eventos del original --- */
  const banner = h("button", { type: "button", clase: "pt-banner-rival", "aria-label": `Próximo rival: ${j.nombre}` },
    h("img", { src: urlJefe(j.id), alt: "" }),
    h("span", {}, h("small", {}, "Próximo rival"), h("b", {}, j.nombre), h("em", {}, j.frase)),
  );
  banner.addEventListener("click", () => { sonido.clic(); void shell.ir("campana"); });
  const perfil = personaje(e.favorito) ?? personaje(e.equipo[0]);
  const tarjetaEquipo = perfil ? h("button", { type: "button", clase: "pt-banner-equipo", "aria-label": "Tu equipo" },
    h("img", { src: urlRetrato(perfil.id), alt: "" }), h("span", {}, h("small", {}, "Tu equipo"), h("b", {}, e.equipo.map((id) => personaje(id)?.nombre.split(" ")[0] ?? "").join(" y ")))) : h("span");
  tarjetaEquipo.addEventListener("click", () => { sonido.clic(); void shell.ir("equipo"); });
  const izquierda = h("div", { clase: "pt-menu-izq" }, banner, tarjetaEquipo);

  /* --- columna de iconos a la derecha --- */
  const hayRegalo = e.regaloDia !== hoy();
  const lado = (ico: string, texto: string, f: () => void, color: "amarillo" | "turquesa" | "rosa" | "azul", insig = false): HTMLElement => {
    const b = boton(h("span", { clase: "pt-lado-cont" }, icono(ico), h("small", {}, texto)), f, { color, silencioso: false });
    b.classList.add("pt-lado");
    if (insig) b.append(h("i", { clase: "pt-punto" }));
    return b;
  };
  const derecha = h("div", { clase: "pt-menu-der" },
    lado(ICONO.regalo, "Regalo", () => abrirRegalo(), "rosa", hayRegalo),
    lado(ICONO.copa, "Récords", () => void shell.ir("progreso"), "amarillo"),
    lado(ICONO.mueble, "Muebles", () => abrirMuebles(), "turquesa"),
    lado(ICONO.ayuda, "Ayuda", () => abrirAyuda(), "azul"),
  );

  /* --- los tres botones grandes de abajo --- */
  const grande = (txt: string, ico: string, f: () => void, clase: string): HTMLElement => {
    const b = boton(h("span", { clase: "pt-gr-cont" }, icono(ico), h("b", {}, txt)), f, { color: clase === "centro" ? "rosa" : "amarillo" });
    b.classList.add("pt-grande", clase);
    return b;
  };
  const nav = h("div", { clase: "pt-menu-nav" },
    grande("Colección", ICONO.libro, () => void shell.ir("coleccion"), "izq"),
    grande("¡Batalla!", ICONO.espadas, () => void shell.ir("campana"), "centro"),
    grande("Equipo", ICONO.equipo, () => void shell.ir("equipo"), "der"),
  );

  /* --- la mansion: flechas para girar, pisos y un indicador --- */
  const emitir = (ev: string, d?: unknown): void => { shell.juego?.events.emit(ev, d); };
  const flecha = (txt: string, dir: number, clase: string, tip: string): HTMLElement => { const b = boton(txt, () => emitir("pt:girar", dir), { icono: true, color: "amarillo", tip }); b.classList.add("pt-flecha", clase); return b; };
  const bIzq = flecha("◀", -1, "izq", "Girar a la izquierda (←)");
  const bDer = flecha("▶", 1, "der", "Girar a la derecha (→)");
  const bSube = boton("▲", () => emitir("pt:piso", 1), { chico: true, icono: true, color: "violeta", tip: "Piso de arriba (↑)" });
  const bBaja = boton("▼", () => emitir("pt:piso", -1), { chico: true, icono: true, color: "violeta", tip: "Piso de abajo (↓)" });
  const indTitulo = h("b", {}, "");
  const indSub = h("small", {}, "");
  const puntos = h("span", { clase: "pt-sectores" });
  const indicador = h("div", { clase: "pt-ind-mansion" }, bBaja, h("div", { clase: "pt-ind-centro" }, indTitulo, puntos, indSub), bSube);
  const alEstado = (d: unknown): void => {
    const x = d as { piso: number; pisos: number; sector: number; sectores: number; k: number; abierta: boolean; faltan: number; nombre: string };
    indTitulo.textContent = `Piso ${x.piso + 1} de ${x.pisos} · ${x.nombre}`;
    indSub.textContent = x.abierta ? "Pulsa la habitación de en medio para entrar" : `Se abre con ${x.k} estrellas (te faltan ${x.faltan})`;
    puntos.replaceChildren(...Array.from({ length: x.sectores }, (_v, i) => h("i", { clase: i === x.sector ? "on" : "" })));
    bBaja.disabled = x.piso === 0;
    bSube.disabled = x.piso >= x.pisos - 1;
  };
  shell.juego?.events.on("pt:mansion", alEstado);
  const teclas = (ev: KeyboardEvent): void => {
    if (document.querySelector(".pt-velo")) return;
    const t = ev.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
    if (ev.key === "ArrowLeft") { ev.preventDefault(); emitir("pt:girar", -1); }
    else if (ev.key === "ArrowRight") { ev.preventDefault(); emitir("pt:girar", 1); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); emitir("pt:piso", 1); }
    else if (ev.key === "ArrowDown") { ev.preventDefault(); emitir("pt:piso", -1); }
    else if (ev.key === "Enter") { emitir("pt:entrar-frente"); }
  };
  document.addEventListener("keydown", teclas);

  raiz.append(bar, izquierda, derecha, bIzq, bDer, indicador, nav, h("div", { clase: "pt-ayuda" }, "F pantalla completa · M música"));

  /* --- ventanas --- */
  function abrirRegalo(): void {
    if (e.regaloDia === hoy()) { sonido.invalido(); shell.avisar("Ya has abierto el regalo de hoy. Vuelve mañana."); return; }
    const faltan = MUEBLES.filter((m) => !e.muebles.includes(m.id));
    e.regaloDia = hoy();
    let texto = "Hoy no hay muebles nuevos. Ya los tienes todos.";
    let id = "";
    if (faltan.length) { const f = faltan[Math.floor(Math.random() * faltan.length)]; id = f.id; e.muebles.push(f.id); texto = `¡Un ${f.nombre.toLowerCase()} para tus habitaciones!`; }
    shell.guardar();
    sonido.desbloqueo();
    const m = modal(shell.raiz, "¡Regalo del día!", h("div", { clase: "pt-regalo" }, h("div", { clase: "caja" }, icono(ICONO.regalo)), h("p", {}, texto)), { botones: [boton("Genial", () => m.cerrar(), { color: "amarillo" })] });
    void id;
    derecha.querySelectorAll(".pt-punto").forEach((p) => p.remove());
  }

  function abrirMuebles(): void {
    const tiene = new Set(e.muebles);
    const rej = h("div", { clase: "pt-catalogo" }, ...MUEBLES.map((mu) => h("div", { clase: `pt-cat-item ${tiene.has(mu.id) ? "" : "falta"}` }, h("b", {}, mu.nombre), h("small", {}, tiene.has(mu.id) ? "Ya lo tienes" : "Consíguelo con el regalo del día o derrotando jefes"))));
    const m = modal(shell.raiz, "Muebles", rej, { botones: [boton("Cerrar", () => m.cerrar(), { color: "amarillo" })] });
  }

  function abrirAyuda(): void {
    const m = modal(shell.raiz, "La mansión", h("div", { clase: "pt-pausa" },
      h("p", {}, "La mansión es redonda. Arrastra con el ratón, o usa las flechas, para girar el piso que miras. Con ↑ ↓ o la rueda cambias de piso. Pulsa la habitación de en medio para entrar y decorarla."),
      h("p", {}, "Con «¡Batalla!» eliges un jefe. Con «Colección» ves a tus personajes y con «Equipo» eliges a los dos que juegan juntos."),
      h("p", {}, "Cada estrella que ganas abre una habitación nueva. Cada día puedes abrir un regalo."),
    ), { botones: [boton("Entendido", () => m.cerrar(), { color: "amarillo" })] });
  }

  return { desmontar() { document.removeEventListener("keydown", teclas); shell.juego?.events.off("pt:mansion", alEstado); shell.ui.classList.remove("saliendo"); } };
}
