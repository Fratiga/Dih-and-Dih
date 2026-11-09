/* Modelo de las otras criaturas, etapa 1: llevar la cuenta de lo que suele seguir a lo que hace otra.

   Cada observadora apunta, con lo que ve, cada vez que otra actua sobre un objeto (por ejemplo, pulsa una palanca) y si en los segundos siguientes aparece algo que se puede comer cerca
   de ese objeto. Con las cuentas estima cuantas veces a esa accion sobre ese tipo de objeto le siguio un resultado. No lee nada interno de la otra (necesidades, emociones, vinculos
   ni intenciones): solo lo que se ve pasar.

   Se usa para una cosa: el realce que provoca ver a otra tocar algo (curiosidad, atraccion por el objeto) se escala con la evidencia. Mientras no hay datos (menos de `MINIMO`
   acciones vistas y cerradas) vale 1, como hasta ahora; con datos, vale mas cuanto mas a menudo siguio un resultado a la accion, y 0 si nunca. Asi, un objeto que otra pulsa una y otra
   vez sin que salga nada deja de atraer, y uno que da resultado sigue atrayendo.

   Es opcional (`modeloAjeno` en la criatura, apagado por defecto). Apagado no se ejecuta ni se guarda nada. No toca la red neuronal ni sus entradas. */

/** Segundos desde que se ve la accion en los que un resultado cuenta como consecuencia de ella. */
export const VENTANA_RESULTADO = 6;
/** Acciones vistas y cerradas que hacen falta para fiarse de la cuenta. */
export const MINIMO = 3;

interface Cuenta {
  /** Acciones cerradas (con su plazo cumplido, hayan tenido resultado o no). */
  cerradas: number;
  /** De ellas, a cuantas siguio un resultado. */
  exitos: number;
}

interface Pendiente {
  clave: string;
  t: number;
  /** El objeto sobre el que se actuo. */
  obj: number;
  exito: boolean;
}

export interface EstadoModeloAjeno {
  cuentas: Record<string, Cuenta>;
  pendientes: Pendiente[];
}

export class ModeloAjeno {
  private cuentas: Record<string, Cuenta> = {};
  private pendientes: Pendiente[] = [];

  /** Ha visto a otra actuar (`verbo:tipo`) sobre el objeto `obj` en el instante `t`. Cada accion se apunta una sola vez. */
  verAccion(clave: string, t: number, obj: number): void {
    if (this.pendientes.some((p) => p.obj === obj && p.t === t)) return;
    this.pendientes.push({ clave, t, obj, exito: false });
  }

  /** Ha visto aparecer algo comestible a partir del objeto `obj`: cuenta como resultado de las acciones recientes sobre el. */
  verResultado(obj: number, t: number): void {
    for (const p of this.pendientes) if (p.obj === obj && !p.exito && t - p.t <= VENTANA_RESULTADO && t >= p.t) p.exito = true;
  }

  /** Cierra las acciones cuyo plazo ha pasado y las suma a la cuenta. */
  cerrar(t: number): void {
    if (!this.pendientes.length) return;
    const quedan: Pendiente[] = [];
    for (const p of this.pendientes) {
      if (t - p.t <= VENTANA_RESULTADO) { quedan.push(p); continue; }
      const c = (this.cuentas[p.clave] ??= { cerradas: 0, exitos: 0 });
      c.cerradas++;
      if (p.exito) c.exitos++;
    }
    this.pendientes = quedan;
  }

  /** Cuanto realce merece ver actuar sobre eso, de 0 a 1: 1 sin datos suficientes, y con datos, el doble de la fraccion de veces que le siguio un resultado (con tope en 1). */
  realce(clave: string): number {
    const c = this.cuentas[clave];
    if (!c || c.cerradas < MINIMO) return 1;
    return Math.min(1, (2 * c.exitos) / c.cerradas);
  }

  /** Lo que sabe de esa accion, para verlo: acciones cerradas y a cuantas siguio un resultado. */
  cuenta(clave: string): { cerradas: number; exitos: number } {
    const c = this.cuentas[clave];
    return c ? { cerradas: c.cerradas, exitos: c.exitos } : { cerradas: 0, exitos: 0 };
  }

  estado(): EstadoModeloAjeno {
    return JSON.parse(JSON.stringify({ cuentas: this.cuentas, pendientes: this.pendientes })) as EstadoModeloAjeno;
  }

  static desde(e: EstadoModeloAjeno | null | undefined): ModeloAjeno {
    const m = new ModeloAjeno();
    if (e) {
      m.cuentas = JSON.parse(JSON.stringify(e.cuentas ?? {}));
      m.pendientes = JSON.parse(JSON.stringify(e.pendientes ?? []));
    }
    return m;
  }
}
