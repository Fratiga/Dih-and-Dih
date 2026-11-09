# Concurso: el programa que dirige el anfitrión

Herramienta para montar y dirigir en directo un concurso de trivia por Discord, al estilo de los quizzes de RadicalSoda. Las reglas las aplica el anfitrión a mano. La herramienta se encarga de las pantallas, los pasos de revelación, los enlaces entre escenas y los datos de los jugadores.

## Páginas

| Página | Quién la ve | Qué hace |
|---|---|---|
| `concurso.html` | El anfitrión | La cabina: editor de escenas, monitor de lo que está al aire, pasos, jugadores y puntos. |
| `concurso-programa.html` | Lo que se comparte por Discord | Solo la escena al aire, a pantalla completa, sin controles. Se abre desde la cabina. |
| `concurso-jugador.html?t=TOKEN` | Cada jugador, en su equipo | Su avatar, nombre, puntos, puesto, cartas, estados y la consigna privada si la hay. |

## Archivos

| Archivo | Para qué |
|---|---|
| `js/concurso-modelo.js` | Modelo de datos (partida, jugadores, escenas, elementos, pasos), temas, guardado local e imágenes en IndexedDB. |
| `js/concurso-componentes.js` | Cada tipo de elemento: valores por defecto, cómo se dibuja y cómo se actualiza (marcador, carta, rejilla, matriz, imagen de prueba...). |
| `js/concurso-escena.js` | El escenario 16:9 (1920×1080 lógicos, escalado), el cálculo del estado de una escena en un paso, transiciones y entradas, y los sonidos. |
| `js/concurso-sync.js` | Sincronización: BroadcastChannel entre la cabina y el programa (misma computadora) y Supabase para los jugadores remotos. |
| `js/concurso-cabina.js` | La cabina entera: editor, pasos, monitor al aire, jugadores, guardar, exportar e importar. |
| `js/concurso-programa.js`, `js/concurso-jugador.js` | Las otras dos páginas. |
| `css/concurso-escena.css` | Temas y componentes (lo que se ve en el escenario). Lo usan las tres páginas. |
| `css/concurso.css` | La cabina y la vista de jugador. |
| `docs/admin/concurso.sql` | Tablas y funciones para las vistas de jugador. |

## Modelo

- **Partida:** nombre, tema, jugadores, escenas, qué está al aire (`vivo`: escena y paso), estado de juego (celdas usadas, cartas volteadas, temporizadores) y registro.
- **Escena:** nombre, carpeta, tema propio opcional, fondo, transición, elementos y pasos.
- **Elemento:** tipo, posición y tamaño en coordenadas del escenario, rotación, opacidad, animación de entrada, si empieza oculto, enlace a otra escena y propiedades de su tipo.
- **Paso:** acción (mostrar, ocultar, revelar, voltear, sonido) sobre un elemento. El estado de una escena en el paso N sale de aplicar los N primeros pasos al estado inicial, así que el programa solo necesita saber la escena y el número de paso.
- Lo que el anfitrión hace a mano durante el juego (voltear una carta concreta de la rejilla, marcar una celda de la matriz, arrancar un temporizador) va en el estado de juego de la partida, no en los pasos.

## Sincronización

- Cabina y programa: BroadcastChannel `concurso`. La cabina manda la partida entera cada vez que algo cambia. El programa, al abrir, pide el estado.
- Jugadores: la cabina publica en Supabase con `concurso_publicar` (solo Admin). Cada jugador lee lo suyo con `concurso_jugador(token)`, que devuelve sus datos privados y la parte pública de la partida. Un canal de Supabase Realtime avisa de los cambios y la página vuelve a leer. Sin cuentas: el token del enlace es la llave.
- Sin sesión de Admin en el sitio o sin el SQL corrido, todo funciona igual en local. Solo faltan las vistas remotas.

## Fase 1 (hecha) y lo que queda

Hecho: editor con mover, redimensionar, rotar, duplicar, borrar, capas, bloquear, selección múltiple, guías magnéticas, deshacer y rehacer, texto con doble clic, imágenes por URL, archivo, pegado o arrastre; escenas con carpetas, miniaturas, fondo y transición; pasos de revelación; enlaces entre escenas; monitor al aire interactivo; marcador, podio, carta, rejilla de cartas (también como panel de respuestas ocultas), matriz de categorías, imagen de prueba (recorte, silueta, desenfoque, espejo), botón, círculo de revelación y temporizador; jugadores con puntos, estados, cartas, consigna privada y enlace personal; tres temas; guardar, exportar e importar.

Pendiente: tablero de recorrido, dado, moneda y ruleta, clip de audio, lista para ordenar, comparación de impostor como componente propio, GIF y vídeo, agrupar elementos, plantillas de escena y la escena al aire dentro de la vista de jugador.
