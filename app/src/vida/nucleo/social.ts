/* Atencion social: lo que una criatura puede ver que otra dedica a una tercera. Es una senal perceptible y reutilizable (celos ahora, aprendizaje por observacion
   y reconocimiento de relaciones mas adelante), no un estado interno de nadie.

   Cada observadora la calcula por su cuenta con lo que ve (posicion, orientacion y permanencia de las criaturas que tiene a la vista). Nadie guarda
   «a quien atiendo»: asi la que mira no recibe informacion privilegiada sobre vinculos o intenciones ajenas.

   Estar cerca no es prestar atencion. Hace falta, a la vez: proximidad, orientacion del cuerpo hacia la otra, no ir de paso (poca velocidad) y que eso dure.
   La senal desaparece en cuanto la interaccion se corta (continuidad). */

import { AJ } from "./ajustes.ts";
import type { Criatura } from "./criatura.ts";

/** ¿Esta `a` ahora mismo en postura de atender a `b`? (solo geometria visible; la permanencia se comprueba en el seguimiento) */
export function atendiendoAhora(a: Criatura, b: Criatura): boolean {
  if (!a.vivo || a.incap >= 0 || a.dormido) return false;
  const d = b.x - a.x;
  if (Math.abs(d) > AJ.atencionAlcance) return false;
  // Orientada hacia la otra y sin ir de paso
  return a.dir * d > 0 && Math.abs(a.vx) < AJ.atencionVelocidad;
}

interface Racha {
  /** Desde cuando se cumple de forma continua. */
  desde: number;
  /** La ultima vez que se vio cumplirse. */
  ultima: number;
}

export class SeguimientoAtencion {
  private rachas = new Map<string, Racha>();

  /** Se llama una vez por paso con las criaturas que la observadora tiene a la vista (ella misma incluida, para saber si la atienden a ella). */
  actualizar(vistas: Criatura[], t: number): void {
    for (const a of vistas) {
      for (const b of vistas) {
        if (a === b) continue;
        const k = `${a.id}>${b.id}`;
        const r = this.rachas.get(k);
        if (atendiendoAhora(a, b)) {
          if (!r || t - r.ultima > AJ.atencionContinuidad) this.rachas.set(k, { desde: t, ultima: t });
          else r.ultima = t;
        } else if (r && t - r.ultima > AJ.atencionContinuidad) this.rachas.delete(k);
      }
    }
  }

  /** Cuantos segundos lleva `a` atendiendo a `b` sin cortarse, o 0 si no hay atencion sostenida (menos que la permanencia, o interrumpida). */
  duracion(a: number, b: number, t: number): number {
    const r = this.rachas.get(`${a}>${b}`);
    if (!r || t - r.ultima > AJ.atencionContinuidad) return 0;
    const d = r.ultima - r.desde;
    return d >= AJ.atencionPermanencia ? d : 0;
  }
}
