# Cómo están hechas las salas 2.5D (guía para otra sesión)

Maquetas 3D sencillas con texturas pixel art y personajes en sprites 2D, al estilo de Eastward, Stardew u Octopath. Todo es código:
no hay modelos 3D ni imágenes de textura. Sirve de base para cualquier escena del sitio que quiera «volumen sin perder el píxel».

Archivos (`js/salas3d/`, módulos ES, three.js 0.180 por CDN):

| Archivo | Qué hace |
|---|---|
| `motor.js` | Renderer, cámara, la caja de la sala, ayudas para montar objetos (`ctx`), zonas con enlace, gente de la mesa, caminos A*, cielo de las ventanas, cursor/clics, bucle. Exporta `montarSalas3D(contenedor, opciones)`. |
| `salas.js` | Una función por sala que coloca todo con `ctx`. Exporta `SALAS = { clave: { nombre, dibujar(ctx), admin? } }`. |
| `texturas.js` | Texturas y sprites pintados píxel a píxel en lienzos pequeños con semilla fija. Exporta `crearTexturas(THREE)` → `{ T, S, lienzo, textura, tono, rng }`. |

La portada (`index.html`) los monta con un `<script type="module">` y vuelve al dibujo plano si no hay WebGL o algo falla (`window.lbPlano`).

## 1. La idea

1. **Caja de maqueta.** Suelo con canto, pared del fondo y dos laterales con grosor, cortadas por delante (se ve el corte, como una casa de
   muñecas). Coordenadas fijas: x de -7 a 7, pared del fondo en z = -4.5, borde delantero del suelo en z = 3.4, alto 4.4 (unidades ≈ metros).
2. **Cámara fija** de frente y desde arriba: `PerspectiveCamera(31°)`, posición `(0, 7.6, 15.4)`, mirando a `(0, 1.25, -0.4)`, lienzo 2:1.
   Cada sala puede cambiarla (`ctx.camara`), p. ej. la biblioteca, que es más alta. Un poco de paralaje con el ratón para notar el volumen.
3. **Muebles = primitivas** (`BoxGeometry`, `CylinderGeometry`, planos) con `MeshLambertMaterial`. Tienen volumen, así que tapan y dan sombra.
4. **Texturas pixel art pintadas en código** sobre lienzos de 32–96 px, con `NearestFilter` y sin mipmaps: tablones, piedra, yeso, papel
   pintado, libros, botellas, alfombra, fieltro, corcho, letreros... Densidad aproximada: 32 píxeles de textura por unidad.
5. **Personajes y criaturas = sprites planos** (`PlaneGeometry` + `MeshBasicMaterial`, `alphaTest: 0.5`, `toneMapped: false`) girados hacia la
   cámara cada fotograma. Como viven en la escena 3D, el búfer de profundidad decide solo quién tapa a quién.
6. **Luces**: `HemisphereLight` de ambiente + puntos (fuego, velas, faroles) + un `SpotLight` por sala con sombra. ACES y exposición 1.42.

## 2. Montar una sala (lo que se escribe en `salas.js`)

```js
function mi_sala(c) {                       // c = contexto del motor
  const { T, S, ZF } = c;
  c.cascaron({ pared: T.papel("#4a1a24", "#5a2230"), suelo: T.moqueta("#24442f", "#33683f") });   // la caja
  c.luzAmbiente(1.4, 0xa07080, 0x3a2a1a);

  // Un objeto con enlace: se agrupa, se construye con primitivas y se marca como zona
  const g = c.grupo(-0.6, 0, -0.4, null);   // null = sin colgar todavía (zona() lo cuelga)
  c.caja3(3.0, 0.12, 1.5, c.color(0x4a2a1c), 0, 0.72, 0, g);                          // tablero de la mesa
  c.plano(2.8, 1.3, c.L(T.fieltro("#1f5a3a")), 0, 0.845, 0, 0, -Math.PI / 2, g);       // fieltro encima
  c.zona(g, "batalla.html", "Batalla");      // al pasar el cursor se ilumina y enseña el nombre; al pulsar abre la página
  c.ocupar(-0.6, -0.4, 3.1, 2.8);            // que nadie camine a través de la mesa

  c.puerta(-1, -1.3, "#taberna", "Volver a la taberna", { letrero: "TABERNA" });   // un href con # cambia de sala sin recargar
  c.vela(0.3, 0.86, 0.2);                    // decoración con vida
  c.foco(0xffc478, 40, 11, 1.0, 0, 3.4, 0, 0, 0, 0.2, true);   // la única luz con sombra
}
export const SALAS = { ..., mi_sala: { nombre: "Mi sala", dibujar: mi_sala } };
```

Ayudas de `ctx` (todas en coordenadas del mundo salvo que se pase un grupo `padre`):

| Ayuda | Para qué |
|---|---|
| `caja3(w, h, d, mat, x, y, z, padre, sombra)` | Caja con la base en `y` (no el centro). |
| `plano(w, h, mat, x, y, z, ry, rx, padre)` | Plano: cuadros, letreros, alfombras (`rx = -π/2` lo tumba). |
| `cilindro(rt, rb, h, seg, mat, x, y, z, padre, theta, desde)` | Barriles, patas, medias lunas (`theta = π`). |
| `sprite(tex, w, h, x, y, z, ry, padre)` | Decoración 2D pegada a una pared. |
| `figura([texturas], ancho, alto, x, y, z, { cambio, salta, volteo })` | Alguien que mira a la cámara y alterna cuadros (tabernero, criaturas). |
| `cascaron({ alto, pared, suelo, zocalo, viga, postes, tapa })` | La caja de la sala. |
| `puerta(lado, pos, href, nombre, { doble, madera, letrero, icono })` | lado -1/1 paredes laterales, 0 la del fondo. |
| `ventana(x, y, w, h)` | Cielo real (hora y clima de `js/cielo.js`), haz de luz y polvo. |
| `fuego(x, y, z)`, `vela(x, y, z)` | Llama animada con luz que parpadea. |
| `zona(grupo, href, nombre)` | Objeto con enlace. **Clona los materiales** del grupo (para resaltarlo sin tocar otros): si luego hay que cambiar un material (p. ej. poner una foto), cógelo de la malla después de llamar a `zona`. |
| `ocupar(x, z, w, d, margen)` | Marca la rejilla del suelo (casillas de 0,2) como ocupada para el A*. |
| `animar(fn(dt, t))` | Algo que cambia cada fotograma (pantallas, luces, gatos). |
| `imagen(mat, url, w, h)` | Carga una foto recortada para llenar el marco sin deformarla. |
| `camara([x, y, z], [x, y, z])`, `luzAmbiente(i, cielo, suelo)`, `fondo(color)`, `puestos([...])` | Ajustes de la sala. |

## 3. Cosas que no son obvias (aprendidas al hacerlo)

- **Sprites con `toneMapped: false`.** Si no, el tono ACES los lava y se ven blanquecinos.
- **Sprites al encoger: `minFilter = LinearMipmapLinearFilter`.** Con `NearestFilter` al reducirse saltan píxeles y se ven sucios; al
  ampliarse sí `NearestFilter`.
- **Lo que está delante de una cara lo pones un poco por delante de ella** (el fuego en z + 0.01 respecto al hueco de la chimenea, el cuadro
  delante del tiro). Si queda dentro de una caja, no se ve. El fuego y el resplandor usan `depthWrite: false` y `renderOrder` para pintarse encima.
- **Sombras calculadas una sola vez** (`shadowMap.autoUpdate = false` y `needsUpdate = true` al entrar en la sala): son de muebles quietos.
  Una sola luz con sombra por sala; las luces puntuales con sombra cuestan seis pasadas cada una.
- **Rendimiento (el PC del usuario es una Intel UHD):** sin MSAA, tope de unos 1,3 millones de píxeles de dibujo, 30 fps si algo se mueve y
  20 en reposo, bucle parado si la pestaña está oculta o el lienzo fuera de pantalla. Un fotograma tarda unos 2 ms en un equipo normal.
- **Primer dibujo aunque la pestaña esté oculta**, para no enseñar nunca un lienzo vacío.
- **El rol de admin llega tarde:** el motor mira cada 2 s si ha cambiado y, si cambia, rehace la sala (aparecen las puertas de admin).
- **Caché:** los imports internos del módulo (`./texturas.js?v=...`, `./salas.js?v=...`) llevan versión; súbela junto con la del `<script>`
  de `index.html` o el navegador servirá módulos viejos.
- **Respaldo:** la portada decide en un `<script>` normal si hay WebGL y ancho ≥ 700 px; si el módulo no llega (`onerror`) o lanza un error,
  `window.lbPlano()` vuelve al dibujo plano.
- **Caminos:** A* de 8 vecinos sobre la rejilla de `ocupar` y luego se recorta el camino saltando a la casilla más lejana que se vea en línea
  recta. Para subir a un asiento: andar hasta la casilla de detrás del banco y saltar con una parábola.
- **Probar sin esperar:** en la consola se puede sustituir `requestAnimationFrame` por una cola y avanzar fotogramas a mano para llevar a un
  personaje a donde se quiera y hacer la captura; y `window.Salas3DActiva.medir()` da los milisegundos de un fotograma con `gl.finish()`.

## 4. Para reutilizarlo en otra página

Copia el patrón, no hace falta todo el motor: renderer sin MSAA y con tope de píxeles, una caja con paredes cortadas, primitivas con
texturas de `crearTexturas(THREE)`, sprites que miran a la cámara para los personajes, una lista de zonas para el `Raycaster` y un bucle con
tope de fps. `docs/taberna.md` explica qué hay en cada sala de la taberna.
