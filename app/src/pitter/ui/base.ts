/* Piezas de interfaz propias del juego: crear elementos, botones con estados, modales con rebote, tooltips y avisos. */

import { sonido } from "../audio/audio.ts";

type Hijo = string | Node | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | undefined | ((e: Event) => void)> = {},
  ...hijos: Hijo[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === "clase") el.className = String(v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, String(v));
  }
  for (const c of hijos) if (c) el.append(c);
  return el;
}

export type ColorBoton = "rosa" | "turquesa" | "amarillo" | "violeta" | "azul";

export interface OpcionesBoton {
  color?: ColorBoton;
  chico?: boolean;
  icono?: boolean;
  tip?: string;
  deshabilitado?: boolean;
  silencioso?: boolean;
}

export function boton(texto: string | Node, alClic: (b: HTMLButtonElement) => void | Promise<void>, o: OpcionesBoton = {}): HTMLButtonElement {
  const b = h("button", { type: "button", clase: `pt-btn ${o.color && o.color !== "rosa" ? o.color : ""} ${o.chico ? "chico" : ""} ${o.icono ? "icono" : ""}`.replace(/\s+/g, " ").trim(), "data-tip": o.tip }, texto);
  if (o.deshabilitado) b.disabled = true;
  b.addEventListener("pointerenter", () => { if (!b.disabled && !o.silencioso) sonido.hover(); });
  b.addEventListener("click", async () => {
    if (b.disabled || b.classList.contains("cargando")) return;
    if (!o.silencioso) sonido.clic();
    const r = alClic(b);
    if (r instanceof Promise) {
      // La espera se ve en el propio boton
      const t = window.setTimeout(() => b.classList.add("cargando"), 250);
      try { await r; } finally { window.clearTimeout(t); b.classList.remove("cargando"); }
    }
  });
  return b;
}

/* --- Tooltips: cualquier elemento con data-tip="Titulo|Texto" --- */
let tip: HTMLElement | null = null;
export function iniciarTooltips(raiz: HTMLElement): void {
  tip = h("div", { clase: "pt-tip", role: "tooltip" });
  raiz.append(tip);
  const mostrar = (e: PointerEvent) => {
    const t = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-tip]");
    if (!t || !tip) { tip?.classList.remove("visible"); return; }
    const [a, b] = (t.dataset.tip ?? "").split("|");
    tip.replaceChildren();
    if (b !== undefined) { tip.append(h("strong", {}, a), b); } else tip.append(a);
    tip.classList.add("visible");
    const r = tip.getBoundingClientRect();
    let x = e.clientX + 16;
    let y = e.clientY + 18;
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 12;
    if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - 12;
    tip.style.left = `${Math.max(8, x)}px`;
    tip.style.top = `${Math.max(8, y)}px`;
  };
  raiz.addEventListener("pointermove", mostrar);
  raiz.addEventListener("pointerleave", () => tip?.classList.remove("visible"));
  raiz.addEventListener("pointerdown", () => tip?.classList.remove("visible"));
}

/* --- Avisos --- */
let avisoEl: HTMLElement | null = null;
let avisoT = 0;
export function aviso(raiz: HTMLElement, texto: string, ms = 2200): void {
  if (!avisoEl) { avisoEl = h("div", { clase: "pt-aviso", role: "status" }); raiz.append(avisoEl); }
  avisoEl.textContent = texto;
  avisoEl.classList.add("visible");
  window.clearTimeout(avisoT);
  avisoT = window.setTimeout(() => avisoEl?.classList.remove("visible"), ms);
}

/* --- Modales --- */
export interface Modal {
  el: HTMLElement;
  cerrar: () => void;
}

export function modal(raiz: HTMLElement, titulo: string, contenido: Node, opciones: { botones?: HTMLElement[]; ancho?: number; alCerrar?: () => void; cerrable?: boolean } = {}): Modal {
  const velo = h("div", { clase: "pt-velo" });
  const caja = h("div", { clase: "pt-modal", role: "dialog", "aria-modal": "true", "aria-label": titulo });
  if (opciones.ancho) caja.style.width = `min(${opciones.ancho}px, 94vw)`;
  const cab = h("div", { clase: "pt-modal-cab" }, h("h2", {}, titulo));
  const cuerpo = h("div", { clase: "pt-modal-cuerpo" }, contenido);
  caja.append(cab, cuerpo);
  if (opciones.botones?.length) caja.append(h("div", { clase: "pt-modal-pie" }, ...opciones.botones));
  velo.append(caja);
  raiz.append(velo);
  requestAnimationFrame(() => velo.classList.add("abierto"));
  let cerrado = false;
  const cerrar = () => {
    if (cerrado) return;
    cerrado = true;
    velo.classList.remove("abierto");
    window.setTimeout(() => velo.remove(), 260);
    document.removeEventListener("keydown", tecla, true);
    opciones.alCerrar?.();
  };
  const tecla = (e: KeyboardEvent) => { if (e.key === "Escape" && opciones.cerrable !== false) { e.stopPropagation(); cerrar(); } };
  document.addEventListener("keydown", tecla, true);
  if (opciones.cerrable !== false) {
    cab.append(boton("✕", cerrar, { chico: true, icono: true, color: "amarillo", tip: "Cerrar (Esc)" }));
    velo.addEventListener("pointerdown", (e) => { if (e.target === velo) cerrar(); });
  }
  return { el: velo, cerrar };
}

/* --- Estrellas de rareza y barras --- */
export function estrellas(n: number, total = 5): HTMLElement {
  const e = h("span", { clase: "pt-estrellas", "aria-label": `${n} de ${total}` });
  for (let i = 0; i < total; i++) e.append(h("i", { clase: i < n ? "on" : "" }, "★"));
  return e;
}

export function esperar(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}
