/* El guardado en el servidor (Supabase). De momento solo existe el guardado en el navegador (estado.ts):
   esta funcion es el punto donde se conectara pitter_guardar cuando se instale el SQL. No falla nunca: sin servidor, se juega igual. */

import type { Estado } from "./estado.ts";

export async function guardarServidor(_estado: Estado): Promise<boolean> {
  return false;
}

export async function cargarServidor(): Promise<Partial<Estado> | null> {
  return null;
}
