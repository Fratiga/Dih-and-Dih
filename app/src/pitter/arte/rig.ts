/* Un personaje hecho con piezas sueltas (sombrero, cabeza, torso, brazos, piernas...), como los modelos originales de Pitter-Patter.
   Las piezas viven en assets/pitter/rig/<id>/ junto a un rig.json que dice donde va cada una en un lienzo de 1000x1000, de que pieza cuelga,
   sobre que punto gira y que poses tiene. De ahi salen las cinco expresiones del juego, el retrato y la ficha; las poses son transformaciones
   de las piezas (mover, girar, estirar), asi que se ajustan en el JSON sin tocar codigo. */

export interface Transformacion {
  dx?: number;
  dy?: number;
  /** Grados. Positivo gira en el sentido de las agujas del reloj. */
  rot?: number;
  sx?: number;
  sy?: number;
}

export type PoseRig = Record<string, Transformacion>;

export interface PiezaRig {
  id: string;
  archivo: string;
  x: number;
  y: number;
  w: number;
  h: number;
  padre: string | null;
  pivote: [number, number];
}

export interface DatosRig {
  id: string;
  lienzo: number;
  /** Las piezas van de atras hacia delante. */
  piezas: PiezaRig[];
  /** Una pose por nombre de expresion (idle, blink, feliz, dolor, poder). */
  poses: Record<string, PoseRig>;
  /** Parte del lienzo que se encuadra en el chibi. */
  encuadre: { x: number; y: number; w: number; h: number };
  /** Parte que se encuadra en el retrato (la cabeza). */
  encuadreRetrato: { x: number; y: number; w: number; h: number };
  retrato: string[];
}

export interface Rig {
  datos: DatosRig;
  imagenes: Map<string, HTMLImageElement>;
}

function cargarImagen(url: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = url;
  });
}

export async function cargarRig(urlJson: string): Promise<Rig | null> {
  let datos: DatosRig;
  try {
    const r = await fetch(urlJson, { cache: "no-cache" });
    if (!r.ok) return null;
    datos = (await r.json()) as DatosRig;
  } catch {
    return null;
  }
  const base = urlJson.slice(0, urlJson.lastIndexOf("/") + 1);
  const imagenes = new Map<string, HTMLImageElement>();
  for (const p of datos.piezas) {
    const im = await cargarImagen(base + p.archivo);
    if (!im) return null;
    imagenes.set(p.id, im);
  }
  return { datos, imagenes };
}

function aplicar(c: CanvasRenderingContext2D, p: PiezaRig, t: Transformacion | undefined): void {
  if (!t) return;
  c.translate(t.dx ?? 0, t.dy ?? 0);
  if (t.rot || t.sx !== undefined || t.sy !== undefined) {
    c.translate(p.pivote[0], p.pivote[1]);
    if (t.rot) c.rotate((t.rot * Math.PI) / 180);
    c.scale(t.sx ?? 1, t.sy ?? 1);
    c.translate(-p.pivote[0], -p.pivote[1]);
  }
}

/** Dibuja las piezas (o solo algunas) con una pose. El contexto debe llevar ya la escala y el desplazamiento que encuadran el lienzo. */
export function dibujarRig(c: CanvasRenderingContext2D, rig: Rig, pose: PoseRig, solo?: string[]): void {
  const porId = new Map(rig.datos.piezas.map((p) => [p.id, p]));
  for (const p of rig.datos.piezas) {
    if (solo && !solo.includes(p.id)) continue;
    const im = rig.imagenes.get(p.id);
    if (!im) continue;
    // La cadena de padres, del mas alto al propio
    const cadena: PiezaRig[] = [];
    for (let q: PiezaRig | undefined = p; q; q = q.padre ? porId.get(q.padre) : undefined) cadena.unshift(q);
    c.save();
    for (const q of cadena) aplicar(c, q, pose[q.id]);
    c.drawImage(im, p.x, p.y);
    c.restore();
  }
}
