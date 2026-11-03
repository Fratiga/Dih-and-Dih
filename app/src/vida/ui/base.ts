/* Piezas de interfaz de Vida Artificial: crear elementos, botones con espera visible, avisos y textos de ayuda. */

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

export interface OpcionesBoton {
  clase?: string;
  tip?: string;
  silencioso?: boolean;
}

/** Un boton con el estilo de la pagina. Si la accion tarda, la espera se ve en el propio boton (un circulo y el texto apagado). */
export function boton(texto: string | Node, alClic: (b: HTMLButtonElement) => void | Promise<void>, o: OpcionesBoton = {}): HTMLButtonElement {
  const b = h("button", { type: "button", clase: `va-btn ${o.clase ?? ""}`.trim(), "data-tip": o.tip }, texto);
  b.addEventListener("pointerenter", () => { if (!b.disabled && !o.silencioso) sonido.hover(); });
  b.addEventListener("click", async () => {
    if (b.disabled || b.classList.contains("espera")) return;
    if (!o.silencioso) sonido.clic();
    const r = alClic(b);
    if (r instanceof Promise) {
      const t = window.setTimeout(() => b.classList.add("espera"), 250);
      try { await r; } finally { window.clearTimeout(t); b.classList.remove("espera"); }
    }
  });
  return b;
}

export const esperar = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

/** Cede el hilo un instante para que el navegador pinte (se usa en trabajos largos para que el boton muestre su avance). */
export const respirar = (): Promise<void> => new Promise((r) => window.setTimeout(r, 0));

let tip: HTMLElement | null = null;

/** Cualquier elemento con data-tip="Titulo|Texto" (o solo "Texto") muestra una ayuda con el estilo de la pagina. */
export function iniciarAyudas(raiz: HTMLElement): void {
  tip = h("div", { clase: "va-tip", role: "tooltip" });
  raiz.append(tip);
  const mostrar = (e: PointerEvent): void => {
    const t = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-tip]");
    if (!t || !tip) { tip?.classList.remove("visible"); return; }
    const [a, b] = (t.dataset.tip ?? "").split("|");
    tip.replaceChildren(b ? h("strong", {}, a) : "", b ?? a);
    const r = t.getBoundingClientRect();
    tip.classList.add("visible");
    const w = tip.offsetWidth;
    const x = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    const arriba = r.top - tip.offsetHeight - 10;
    tip.style.left = `${x}px`;
    tip.style.top = `${arriba > 8 ? arriba : r.bottom + 10}px`;
  };
  raiz.addEventListener("pointerover", mostrar);
  raiz.addEventListener("pointerdown", () => tip?.classList.remove("visible"));
  raiz.addEventListener("pointerleave", () => tip?.classList.remove("visible"));
}

export function aviso(raiz: HTMLElement, texto: string, ms = 2200): void {
  const a = h("div", { clase: "va-aviso" }, texto);
  raiz.append(a);
  requestAnimationFrame(() => a.classList.add("visible"));
  window.setTimeout(() => { a.classList.remove("visible"); window.setTimeout(() => a.remove(), 300); }, ms);
}
