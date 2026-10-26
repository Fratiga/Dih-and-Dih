/* Textos de la pagina (aviso de interaccion, dialogo y contador de FPS). Van en HTML y no dentro del lienzo
   para que se vean nitidos aunque el juego se escale. */

const $ = (id: string): HTMLElement | null => document.getElementById(id);

let temporizador = 0;

export function ponerAviso(texto: string | null): void {
  const el = $("aviso");
  if (!el) return;
  el.textContent = texto ?? "";
  el.classList.toggle("oculto", !texto);
}

export function mostrarDialogo(nombre: string, texto: string): void {
  const caja = $("dialogo");
  const quien = $("dialogoNombre");
  const que = $("dialogoTexto");
  if (!caja || !quien || !que) return;
  quien.textContent = nombre;
  que.textContent = texto;
  caja.classList.remove("oculto");
  window.clearTimeout(temporizador);
  temporizador = window.setTimeout(ocultarDialogo, 5000);
}

export function ocultarDialogo(): void {
  $("dialogo")?.classList.add("oculto");
}

export function ponerFps(fps: number): void {
  const el = $("fps");
  if (el) el.textContent = `${Math.round(fps)} FPS`;
}
