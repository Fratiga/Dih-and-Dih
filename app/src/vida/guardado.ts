/* Guardado en el navegador. Se guarda el estado completo de la simulacion (criaturas, cerebros, memorias, objetos) y la hora, para que al volver
   se simule el tiempo transcurrido (con tope). El modelo de Supabase queda para una fase posterior. */

import { genomaNuevo, clonarGenoma } from "./nucleo/genoma.ts";
import { Simulacion, type EstadoSim } from "./nucleo/simulacion.ts";

export interface AjustesVida {
  volumen: number;
  silencio: boolean;
  velocidad: number;
  camara: "panorama" | "seguir" | "cercano";
}

export interface Guardado {
  v: 1;
  sim: EstadoSim;
  /** Marca de tiempo real (ms) del ultimo guardado. */
  ultima: number;
  ajustes: AjustesVida;
  seleccion: number;
  creada: number;
}

const CLAVE = "vidaArtificialEstado";

export const AJUSTES_INICIALES: AjustesVida = { volumen: 0.7, silencio: false, velocidad: 1, camara: "panorama" };

export function cargarGuardado(): Guardado | null {
  try {
    const t = localStorage.getItem(CLAVE);
    if (!t) return null;
    const g = JSON.parse(t) as Guardado;
    if (g.v !== 1 || !g.sim) return null;
    return { ...g, ajustes: { ...AJUSTES_INICIALES, ...g.ajustes } };
  } catch {
    return null;
  }
}

export function guardarLocal(g: Guardado): boolean {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(g));
    return true;
  } catch {
    return false;
  }
}

export function borrarGuardado(): void {
  try { localStorage.removeItem(CLAVE); } catch { /* sin acceso al almacenamiento */ }
}

/** Un ensayo nuevo: una habitacion, dos criaturas con el mismo genoma (gemelas), una pelota y un dispensador de fruta. */
export function simulacionNueva(semilla = Date.now() % 1_000_000): Simulacion {
  const g = genomaNuevo(semilla, "A");
  return new Simulacion({
    semilla,
    objetos: [{ tipo: "pelota", x: 820 }],
    criaturas: [{ genoma: clonarGenoma(g), x: 360, nombre: "Brisa" }, { genoma: clonarGenoma(g), x: 520, nombre: "Nube" }],
    comedero: { cada: 140, max: 2, tipo: "fruta" },
  });
}
