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

/** El laboratorio libre: un complejo de siete salas con las medidas y las conexiones decididas (ver docs/vida-artificial-complejo.md). Dos criaturas gemelas en la habitacion principal. */
export function complejoNuevo(semilla = Date.now() % 1_000_000): Simulacion {
  const g = genomaNuevo(semilla, "A");
  const s = new Simulacion({
    semilla,
    objetos: [{ tipo: "pelota", x: 1500 }],
    criaturas: [{ genoma: clonarGenoma(g), x: 1700, nombre: "Brisa" }, { genoma: clonarGenoma(g), x: 2000, nombre: "Nube" }],
    comedero: { cada: 140, max: 3, tipo: "fruta" },
    ancho: 4000,
  });
  Object.assign(s.salas[0], { nombre: "Habitación principal", tipo: "principal", capacidad: 8, mapa: { c: 0, f: 0, w: 2 } });
  const sala = (nombre: string, tipo: string, ancho: number, mapa: { c: number; f: number }, extra: { capacidad?: number; comedero?: { cada: number; max: number; tipo: string } } = {}): number => {
    const k = s.agregarSala(nombre, tipo, ancho);
    Object.assign(s.salas[k], { capacidad: 6, mapa, ...extra });
    return k;
  };
  const comedor = sala("Comedor", "comedor", 2400, { c: 0, f: 1 }, { comedero: { cada: 60, max: 4, tipo: "fruta" } });
  const habitat = sala("Hábitat natural", "habitat", 3200, { c: 1, f: 1 }, { capacidad: 8 });
  const obstaculos = sala("Zona de obstáculos", "obstaculos", 2400, { c: 0, f: 2 });
  const acuatica = sala("Zona acuática", "acuatica", 3200, { c: 1, f: 2 }, { capacidad: 8 });
  const elevada = sala("Zona elevada", "elevada", 2400, { c: 0, f: 3 });
  const observacion = sala("Observación", "observacion", 1600, { c: 1, f: 3 }, { capacidad: 4 });
  // Habitacion principal: comedor, habitat, obstaculos y observacion. Y entre ellas: habitat con acuatica, acuatica con elevada, elevada con obstaculos.
  s.conectar(0, 3700, comedor, 200);
  s.conectar(0, 300, habitat, 3000);
  s.conectar(0, 3000, obstaculos, 200);
  s.conectar(0, 2000, observacion, 800);
  s.conectar(habitat, 200, acuatica, 3000);
  s.conectar(acuatica, 200, elevada, 2200);
  s.conectar(elevada, 200, obstaculos, 2200);
  // Un poco de vida: fruta en el comedor, rejas en la zona de obstaculos
  s.salas[comedor].mundo.agregar("fruta", 1200);
  s.salas[obstaculos].mundo.agregar("reja", 1200);
  s.salas[obstaculos].mundo.agregar("reja", 1700);
  return s;
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
