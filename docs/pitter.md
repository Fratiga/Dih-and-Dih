# Pitter-Patter

Puzzle de fichas inspirado en *JoJo's Pitter-Patter Pop!*, con los personajes de la campaña. Es un juego de PC dentro de la web: ocupa toda la ventana, tiene su propia interfaz y no recarga la página al cambiar de pantalla.

**Estado (nov-2026): OCULTO, solo admin.** Página `app/dist/pitter.html` (código en `app/src/pitter/`), con tarjeta en Minijuegos > En pruebas. El SQL (`docs/pitter.sql`) está escrito y **sin ejecutar ni probar**: Docker Desktop se cerró con un error al intentar arrancarlo (ver «Pendiente»).

## Cómo está hecho

- Phaser 4 + TypeScript + Vite, en `app/`. Una sola página con un armazón (`shell.ts`) que cambia de pantalla con una cortina de fichas. Phaser dibuja lo vivo (menú, tablero, habitaciones); lo que lleva texto va en HTML encima (cabeceras, paneles, colección, equipo).
- Los datos de la campaña son los globales de siempre (`data/personajes.js`, `data/bestiario.js`, `js/cartas-datos.js`), cargados con etiquetas de script clásicas. Nada de esto se duplica: el nombre, la rareza, la afinidad y el Side de cada personaje salen de su carta.
- Todo el arte está dibujado en código (`arte/`). No hay arte chibi definitivo. Ver «Arte».
- La lógica del tablero (`motor/`) es pura y determinista: no usa Phaser ni el navegador. Tiene pruebas en Node: `node app/tests/tablero.test.ts` (79.000 comprobaciones).

## Cómo compilar y probar

```bash
cd app
npm run build                                   # compila a app/dist (hay que subirlo a main)
npx vite build --config vite.pitter.config.ts   # solo Pitter, a app/dist-pitter (para probar sin tocar app/dist; está ignorado por git)
node tests/tablero.test.ts                      # pruebas del motor
```

Para verlo en local se sirve la raíz del repositorio (los datos se cargan con `../../data/...`) y se abre `app/dist/pitter.html`. Hace falta `localStorage.compendioAdmin = "1"`. Con `window.pitter.ir("puzzle", { jefe: 0, equipo: ["bull", "garra"] })` se salta a cualquier pantalla.

## Pantallas (como el original)

- **Mansión** (menú): un edificio **octogonal** con 3 pisos de 8 habitaciones (24 en total, como el original). Cada piso es un anillo que se gira, no una torre que se sube. Arriba, el nivel y las cuentas. A la derecha, los iconos (Regalo, Récords, Muebles, Ayuda). Abajo, los tres botones grandes: Colección, ¡Batalla! (el central, más grande) y Equipo. Un banner con el próximo rival y otro con el favorito.
  - **Geometría (3D real):** cada habitación es una caja (hueco de 560 de ancho, 290 de alto y 520 de fondo) cuya fachada de ladrillo es un lado del octógono. Una sola cámara mira de frente, algo elevada, y proyecta todo en perspectiva: pared del fondo, paredes laterales, suelo y techo se dibujan como triángulos con `Mesh2D` de Phaser 4 y se recortan contra el hueco de la fachada. Las habitaciones de los lados se ven de lado, con sus paredes y su suelo. Los personajes y muebles son carteles que siguen la misma proyección (`SalaVista.proyectar`). Todos los pisos usan la misma cámara, así que las fachadas encajan sin huecos y los pisos de arriba se ven desde abajo (techo) y los de abajo desde arriba (suelo). Código: `escenas/cuarto3d.ts` (proyección y mallas), `arte/caras.ts` (atlas de las seis caras de cada tema), `arte/mansion.ts` (medidas, fachada, base y tejado), `escenas/Menu.ts`.
  - **Base y tejado:** la planta baja (puerta grande, ventanas con postigos, macetas) gira con el primer piso y el tejado (tejas y una buhardilla) con el último. Se pueden arrastrar igual que las habitaciones de su piso.
  - **Rotación:** se arrastra con el ratón para girar el piso bajo el cursor (la velocidad está limitada). Al soltar, encaja en el sector más cercano con inercia moderada. Las flechas de los lados (o ← →) giran un sector.
  - **Pisos:** ↑ ↓, la rueda o los botones del indicador cambian de piso. La cámara sube o baja con suavidad. El indicador dice el piso, la habitación y cuántos sectores hay. Los pisos que no miras se ven apagados.
  - **Habitaciones:** la primera está abierta y cada estrella ganada abre otra (la habitación `k` se abre con `k` estrellas). Las cerradas tienen la puerta con candado y dicen cuántas estrellas faltan.
  - **Entrar y volver:** un clic en la habitación de enfrente hace zoom hasta ella y la abre (Intro también). Al volver con «Volver» sale el zoom inverso desde esa misma habitación.
  - **Persistencia:** `estado.mansion` guarda el piso y el sector de cada piso, y `estado.habitaciones` los residentes y los muebles de cada habitación. Al pasar de 4×6 a 3×8 la posición guardada se reinicia sola; las habitaciones no se tocan.
  - **Requisito:** `Mesh2D` solo dibuja con WebGL. Sin WebGL las habitaciones del menú no se verían.
- **Habitación**: el mismo edificio visto de cerca, con la habitación en perspectiva en el centro (pared de fondo, dos laterales, suelo, luces de carril). Placa con el nombre y los residentes arriba. Abajo: Volver, Favorito, Regalo, Redecorar, Convivir y Cambiar. Hasta 2 residentes por habitación. Los personajes pasean, se sientan, duermen, juegan y se saludan, con tiras de diálogo rosas. Al redecorar, los muebles se arrastran (por debajo del suelo se quitan) y se cambia el fondo.
- **Partida**: de arriba abajo, el jefe con su barra de vida, el reloj, el tablero y el equipo con sus medidores de tres estrellas. A los lados, el marcador, el combo y el Stand Up Time.
- **Colección**: álbum con marcos por rareza, filtros y una presentación para cada personaje. Los que faltan salen como siluetas con una pista de dónde conseguirlos.
- **Equipo**: dos pedestales, habilidades frente a frente y sinergias. Se guardan equipos con nombre.
- **Récords**: estadísticas, récord por jefe y logros.

## Reglas del puzzle

Verificadas en la [JoJo Wiki](https://jojowiki.com/JoJo's_Pitter-Patter_Pop!) y en Wikipedia. Todo está en `REGLAS` (`motor/tablero.ts`) para poder ajustarlo.

- Tablero de 6×6. Se arrastra una ficha y las que pisa se apartan un hueco. Al soltar, los grupos de **4 o más** fichas iguales que se tocan desaparecen. Las demás caen y entran fichas nuevas. Cada grupo seguido sube el combo.
- Un grupo de **6 o más** deja una Caja: al tocarla borra cinco fichas en cruz.
- Cada personaje tiene una habilidad (16 hechas a mano, `datos/roster.ts` y `motor/habilidades.ts`) que se carga con sus fichas.
- **Stand Up Time:** cuando el medidor se llena, el tiempo se para y los grupos se quedan de pie en el tablero. Al acabar estallan todos juntos, y cada cuadrado de 2×2 de fichas de pie multiplica el daño.
- Los jefes (`datos/campana.ts`) son criaturas del bestiario público, no los enemigos de las fichas del DM. Cada uno estropea el tablero a su manera: bloques, fichas congeladas o fichas con tinta.
- **No está comprobado:** la regla exacta de movimiento del original. Las fuentes dicen que se puede coger cualquier ficha y moverla libremente, pero no cómo se desplazan las demás. Se eligió el arrastre con desplazamiento (como en Puzzle & Dragons). Es lo primero que conviene afinar si no se parece.

## Quién ve qué

Cada Side ve a los personajes compartidos y a los suyos (`puedeVer` en `roster.ts`, con las mismas claves de `localStorage` que el resto del sitio). El admin los ve todos. Los jefes y los muebles no dependen del Side.

## Progresión y recompensas

- **Cosmético, en el navegador y en el servidor:** personajes desbloqueados (dos por jefe), niveles, equipos, habitaciones, muebles, récords, estadísticas y ajustes. Nada de esto da ventajas en el rol.
- **Primera victoria de cada jefe:** tokens de juego del Hipódromo (sin moneda nueva) y, con tres estrellas, una carta por el cierre oficial de recompensas (`cartas_juegos 'pitter'`). Repetir un jefe no paga. Ver `docs/pitter.sql`.
- **Lo honesto:** el puzzle corre en el navegador, así que el servidor no puede comprobar la partida. Lo que acota la trampa es que cada jefe paga una vez, hay que superarlos en orden, los resultados deben ser plausibles, los tokens tienen un tope diario (`pitter_tokens_dia`) y las cartas pasan por los topes de siempre.
- `app/src/pitter/guardado.ts` es el punto donde se conectará `pitter_guardar` y `pitter_reclamar`. Hoy no hace nada: solo se guarda en el navegador.

## Audio

Música: las canciones de `assets/musica/` que elige `audio/audio.ts` (`PISTAS`), con fundido entre pantallas y otra pista para el Stand Up Time. Efectos: sintetizados con Web Audio, sin archivos. Música y efectos tienen volumen y silencio propios. Nada suena hasta el primer clic.

## Arte

Mientras no haya arte definitivo, los personajes son muñecos blandos del color de su ficha, con un gorro según su afinidad. A propósito no tienen pelo, piel ni rasgos de nadie. Para sustituirlos, `assets/pitter/README.md` explica el formato (un PNG por personaje y por jefe, y un `manifest.json`). El juego anima ese PNG solo y saca de él la ficha y el retrato.

## Pendiente

- Docker Desktop se cerró con el error `listening on unix://...\dockerInference ... The file cannot be accessed by the system`. Mientras no arranque, `docs/pitter.sql` no se ha probado. Falta una batería `docs/pruebas/t_pitter.sh` y conectar `guardado.ts` al servidor.
- Probar en pantalla completa real y en un portátil sin tarjeta gráfica.
- Una ayuda más completa dentro del juego, y los jefes y chibis definitivos.
