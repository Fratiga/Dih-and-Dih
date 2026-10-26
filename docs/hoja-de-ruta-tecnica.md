# Hoja de ruta técnica y visual

Última revisión: 26-oct-2026. Se actualiza al cerrar cada bloque de trabajo.

## Cómo está construida la web

- Sitio estático de varias páginas (48 HTML) en GitHub Pages. Unas 62.000 líneas de JavaScript en scripts clásicos, sin npm, sin build y sin TypeScript. La caché se rompe con `?v=NNNNNNNN` en cada etiqueta.
- La regla del proyecto es que se abra con solo servir los archivos, sin pasos de instalación. Cualquier librería nueva va por CDN con versión fija o como archivo dentro del repositorio.
- Supabase pone las cuentas, la economía de cartas, el Hipódromo, la Veintiuna, el ajedrez, la arquería y la presencia. Las reglas sensibles viven en funciones SQL.
- Three.js 0.180 (build WebGPU, que cae a WebGL2) por importmap, solo en Slappy, el sacrificio de bufones y la habitación. Los demás juegos dibujan con canvas 2D, SVG o CSS.
- No hay Phaser ni WebAssembly. WebAssembly no se puede cargar abriendo el archivo directamente con `file://`, así que cualquier uso futuro exige servir la web.

## Estado de los proyectos

| Proyecto | Estado real | Tecnología actual |
|---|---|---|
| La Fractura | Oculto (solo admin). Motor puro y determinista que corre también en Node, IA, campaña, guardado y crónica. Cuartel rehecho el 20-oct con retratos procedurales. | Canvas 2D (`fractura-tablero.js`, 953 líneas) |
| Duelo | Oculto. Duelo 1 contra 1 en tiempo real contra un rival simulado (atacar, bloquear, esquivar), campo lógico de 960×600, solo formas. **No existe una versión multijugador tipo Nidhogg** ni código ni notas sobre ella. | Canvas 2D (`duelo.js`, 549 líneas) |
| Hipódromo | En producción. Motor determinista con servidor autoritativo. La pista ya tiene cámara con zoom, paisaje en capas y clima; `hipodromo-vivo.html` la reutiliza. | Canvas 2D |
| Taberna y lobby | Salas con escena SVG y CSS, sistema de salas, presencia y Slappy encima en WebGPU. | SVG, CSS, Three.js |
| Mapa | PNG de 1494×748 con 362 pines en porcentaje (`data/mapa.js`). La reconstrucción vectorial por capas ya está acordada y en curso en local (`scratchpad/mapa-vectorial/`). **Esta hoja de ruta no la toca.** | PNG, DOM |
| Compendio, cartas y demás | HTML, CSS y SVG. Funcionan bien con eso. | DOM |
| Ostelar | Oculto. Combate por casillas en canvas 2D. | Canvas 2D |

## Lo que he medido

Los tiempos de carga no son fiables con el panel oculto, así que solo cuento bytes.

- `index.html` pesa unos 4,2 MB y `compendio.html` unos 6,2 MB.
- El carrusel del encabezado cargaba PNG de hasta 3,9 MB. La imagen actual y la siguiente se descargan en cada visita.
- Los `data/*.js` suman 3,4 MB sin comprimir y se cargan completos en unas 30 páginas, aunque muchas solo necesitan una colección para abrir un modal. `compendio.html` descarga 3,1 MB de scripts.
- No he encontrado cuellos de botella de CPU en los juegos de canvas. No hay base para migrar nada a WebGL por rendimiento.

## Hoja de ruta

Niveles: 1 mejora ligera, 2 estructural localizada, 3 funcionalidad avanzada, 4 experimental.

### Inmediata

1. **Carrusel del encabezado a JPEG (nivel 1). Hecho.** Cuatro PNG pasan a JPEG (de 3,9 MB a 1,4 MB, de 2,4 MB a 0,14 MB, y otras dos). Los PNG originales siguen en el repositorio, sin enlazar.
2. **Peso de los datos (nivel 2).** Medir qué páginas cargan colecciones que no usan y cargarlas bajo demanda. Riesgo medio porque `modal.js` lee `ALL_ENTRIES` y muchas páginas dependen del orden de los scripts. Se empieza por una página (`mapa.html`) como prueba.
3. **Fractura, legibilidad del tablero (nivel 1 y 2).** Ya hay casillas de movimiento resaltadas, niebla de guerra, panel de unidad y animaciones. En mi prueba el tablero era legible pero pequeño y con mucho vacío. Antes de tocar nada necesito saber qué te molesta exactamente. Se queda en canvas 2D. Es un juego oculto, así que no hay riesgo para los jugadores.

### Siguiente

4. **Duelo (nivel 2).** Decidir si debe ser online. Si lo es, se separa lógica de dibujo y se reutiliza el patrón de la arquería (canal de Supabase para la mira, semilla compartida, validación en el servidor). Los sprites pixel art dependen de tener arte.
5. **Hipódromo, pulido visual (nivel 1 y 2).** Posiciones, resultados y transición de apuestas sobre el canvas actual. Sin WebGL salvo que se mida un problema.
6. **Taberna, sala piloto explorable (nivel 3).** Una sola sala con personajes y puntos de interacción. Se compara Phaser contra un canvas propio solo si la prueba 2D lo justifica.

### Futura

- Escenas 3D de criaturas del Hipódromo con el Three.js ya cargado.
- Otras salas explorables, presencia de jugadores y accesos contextuales a los juegos.
- WebAssembly solo si aparece una simulación con un cuello de botella medido (la IA de la Fractura es el candidato más probable).

### Experimental (nivel 4)

Emulación, recompilación y ports quedan fuera del repositorio publicado hasta que demuestren utilidad: en `scratchpad/` (ignorado por git) o en un repositorio aparte. Todo lo del repositorio se publica en GitHub Pages. Un prototipo solo se hace con una pregunta concreta y un criterio de éxito.

## Decisiones tomadas

- No migrar a Phaser ni a otro motor de forma global: lo que hay funciona y no tiene un problema de rendimiento medido.
- WebGL solo donde aporte algo visible. Three.js se queda para las escenas 3D.
- Los PNG originales se conservan al convertirlos; borrarlos es una decisión aparte.

## Pendiente de confirmar con el usuario

- Si existe en otro sitio el duelo multijugador tipo Nidhogg o es una idea nueva.
- Qué le molesta del tablero de la Fractura.
- Si prefiere dejar los experimentos de nivel 4 en un repositorio separado.

## Próxima tarea recomendada

Medir el peso de datos de `mapa.html` y probar la carga bajo demanda de las colecciones. Después, la legibilidad del tablero de la Fractura cuando se concrete qué molesta.
