import type { PantallaId, Shell } from "../shell.ts";
import { h } from "./base.ts";
import { JEFES } from "../datos/campana.ts";
import { personajesVisibles } from "../datos/roster.ts";
import { MUEBLES } from "../arte/escenarios.ts";
import { asegurarHabitaciones } from "../estado.ts";

/* Herramientas para el admin: ver todo y probar sin tener que jugar para llegar. Es un panel flotante que no tapa el juego.
   Lo de "Progreso" cambia la partida guardada (hay que pulsarlo a proposito). Lo de "En la partida" solo vale dentro de un combate. */

export const esAdmin = (): boolean => {
  try { return localStorage.getItem("compendioAdmin") === "1"; } catch { return false; }
};

let panel: HTMLElement | null = null;

export function alternarAdmin(shell: Shell): void {
  if (panel) { panel.remove(); panel = null; return; }
  panel = construir(shell);
  shell.raiz.append(panel);
}

/** Se llama al cambiar de pantalla para que el panel enseñe lo que corresponde. */
export function refrescarAdmin(shell: Shell): void {
  if (!panel) return;
  panel.remove();
  panel = construir(shell);
  shell.raiz.append(panel);
}

export function cerrarAdmin(): void {
  panel?.remove();
  panel = null;
}

function construir(shell: Shell): HTMLElement {
  const e = shell.estado;
  const aviso = (t: string): void => shell.avisar(t);
  const emitir = (accion: string, valor?: unknown): void => { shell.juego?.events.emit("pt:admin", { accion, valor }); };
  const refrescarPantalla = (): void => {
    const n = shell.nombre as PantallaId | null;
    if (n && n !== "puzzle") void shell.ir(n, undefined, "rapida");
  };
  const cambiar = (texto: string, fn: () => void): void => {
    fn();
    asegurarHabitaciones(e);
    shell.guardar(true);
    aviso(texto);
    refrescarPantalla();
    refrescarAdmin(shell);
  };
  const b = (txt: string, fn: () => void, nota?: string): HTMLElement => {
    const el = h("button", { type: "button", clase: "pt-adm-b", "data-tip": nota ?? "" }, txt);
    el.addEventListener("click", fn);
    return el;
  };
  const interruptor = (txt: string, clave: string, nota?: string): HTMLElement => {
    const el = h("button", { type: "button", clase: "pt-adm-b pt-adm-i", "data-tip": nota ?? "" }, txt);
    const marca = (): void => { el.classList.toggle("on", adm[clave] === true); };
    el.addEventListener("click", () => { adm[clave] = !adm[clave]; marca(); emitir("interruptor", { clave, valor: adm[clave] }); });
    marca();
    return el;
  };
  const enPartida = shell.nombre === "puzzle";

  /* --- progreso --- */
  const progreso = h("section", {}, h("h3", {}, "Progreso"),
    b("Desbloquear a todos", () => cambiar("Todos los personajes desbloqueados.", () => { e.desbloqueados = personajesVisibles().map((p) => p.id); }), "Colección completa"),
    b("Superar los 8 jefes (3 ★)", () => cambiar("Jefes superados con tres estrellas.", () => {
      for (const j of JEFES) {
        if (!e.jefesSuperados.includes(j.id)) e.jefesSuperados.push(j.id);
        const r = e.records[j.id] ?? { puntos: 0, mejorTiempo: 0, estrellas: 0, combo: 0 };
        r.estrellas = 3; r.puntos = Math.max(r.puntos, 5000); r.mejorTiempo = r.mejorTiempo || 25; r.combo = Math.max(r.combo, 12);
        e.records[j.id] = r;
        if (j.mueble && !e.muebles.includes(j.mueble)) e.muebles.push(j.mueble);
      }
    }), "Abre además las 24 habitaciones"),
    b("Abrir las 24 habitaciones", () => cambiar("Habitaciones abiertas.", () => {
      for (const j of JEFES) { const r = e.records[j.id] ?? { puntos: 0, mejorTiempo: 0, estrellas: 0, combo: 0 }; r.estrellas = 3; e.records[j.id] = r; }
    }), "Pone tres estrellas en cada jefe sin darlos por superados"),
    b("Todos los muebles", () => cambiar("Todos los muebles conseguidos.", () => { e.muebles = MUEBLES.map((m) => m.id); })),
    b("Personajes al nivel 10", () => cambiar("Niveles al máximo.", () => { for (const p of personajesVisibles()) e.niveles[p.id] = 10; })),
    b("Regalo de hoy otra vez", () => cambiar("Puedes abrir otro regalo.", () => { e.regaloDia = ""; })),
  );

  /* --- empezar un combate cualquiera --- */
  const sJefe = h("select", { clase: "pt-adm-s" }, ...JEFES.map((j, i) => h("option", { value: String(i) }, `${i + 1}. ${j.nombre}`)));
  const lista = personajesVisibles();
  const sA = h("select", { clase: "pt-adm-s" }, ...lista.map((p) => h("option", { value: p.id }, p.nombre)));
  const sB = h("select", { clase: "pt-adm-s" }, ...lista.map((p) => h("option", { value: p.id }, p.nombre)));
  (sA as HTMLSelectElement).value = e.equipo[0];
  (sB as HTMLSelectElement).value = e.equipo[1];
  const combate = h("section", {}, h("h3", {}, "Combate a elegir"), sJefe, sA, sB,
    b("Empezar", () => {
      const a = (sA as HTMLSelectElement).value, c = (sB as HTMLSelectElement).value;
      if (a === c) { aviso("Elige dos personajes distintos."); return; }
      void shell.ir("puzzle", { jefe: Number((sJefe as HTMLSelectElement).value), equipo: [a, c] }, "rapida");
    }, "Sin necesidad de tener el jefe ni los personajes abiertos"),
  );

  /* --- dentro de la partida --- */
  const partida = h("section", {}, h("h3", {}, "En la partida"),
    ...(enPartida ? [
      b("Habilidades llenas", () => emitir("cargar")),
      b("Stand Up lleno", () => emitir("stand"), "Lo empieza ya"),
      b("+30 segundos", () => emitir("tiempo")),
      b("Combo +10", () => emitir("combo")),
      b("Jefe al 10 %", () => emitir("jefe10")),
      b("Curar al jefe", () => emitir("curar")),
      b("Derrotar al jefe", () => emitir("matar"), "Empieza el Rush si queda tiempo"),
      b("Perder la partida", () => emitir("perder")),
      b("Ataque del jefe ahora", () => emitir("ataque")),
      b("Poner una Caja", () => emitir("caja")),
      b("Poner 3 bloques", () => emitir("bloques")),
      b("Congelar 4 fichas", () => emitir("hielo")),
      b("Manchar 4 fichas de tinta", () => emitir("tinta")),
      b("Limpiar obstáculos", () => emitir("limpiar")),
      interruptor("Reloj parado", "relojParado"),
      interruptor("El jefe no ataca", "sinAtaques"),
      interruptor("Habilidades siempre llenas", "cargaInfinita"),
      interruptor("Daño ×10", "danoX10"),
    ] : [h("p", { clase: "pt-adm-nota" }, "Entra en un combate para ver las herramientas de partida.")]),
  );

  const cerrar = h("button", { type: "button", clase: "pt-adm-x", "aria-label": "Cerrar" }, "✕");
  cerrar.addEventListener("click", () => cerrarAdmin());
  return h("aside", { clase: "pt-admin" }, h("header", {}, h("b", {}, "Admin"), cerrar), progreso, combate, partida);
}

/** Interruptores que la partida lee. Duran mientras la página esté abierta. */
export const adm: Record<string, boolean> = { relojParado: false, sinAtaques: false, cargaInfinita: false, danoX10: false };
