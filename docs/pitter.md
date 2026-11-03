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
  - **Losas entre pisos:** entre dos pisos hay una losa octogonal. Con la cámara por encima se ve la terraza del anillo de abajo y por debajo la parte inferior del de arriba, así que cuando los anillos están girados distinto no queda ningún hueco vacío (`Menu.dibujarPlacas`).
  - **Base y tejado:** la planta baja (puerta grande, ventanas con postigos, macetas) gira con el primer piso y el tejado (tejas y una buhardilla) con el último. Se pueden arrastrar igual que las habitaciones de su piso.
  - **Rotación:** se arrastra con el ratón para girar el piso bajo el cursor (la velocidad está limitada). Al soltar, encaja en el sector más cercano con inercia moderada. Las flechas de los lados (o ← →) giran un sector.
  - **Pisos:** ↑ ↓, la rueda o los botones del indicador cambian de piso. La cámara sube o baja con suavidad. El indicador dice el piso, la habitación y cuántos sectores hay. Los pisos que no miras se ven apagados.
  - **Habitaciones:** la primera está abierta y cada estrella ganada abre otra (la habitación `k` se abre con `k` estrellas). Las cerradas tienen la puerta con candado y dicen cuántas estrellas faltan.
  - **Entrar y volver:** un clic en la habitación de enfrente hace zoom hasta ella y la abre (Intro también). Al volver con «Volver» sale el zoom inverso desde esa misma habitación.
  - **Persistencia:** `estado.mansion` guarda el piso y el sector de cada piso, y `estado.habitaciones` los residentes y los muebles de cada habitación. Al pasar de 4×6 a 3×8 la posición guardada se reinicia sola; las habitaciones no se tocan.
  - **Requisito:** `Mesh2D` solo dibuja con WebGL. Sin WebGL las habitaciones del menú no se verían.
- **Habitación**: el mismo edificio visto de cerca, con la habitación en perspectiva en el centro (pared de fondo, dos laterales, suelo, luces de carril). Placa con el nombre y los residentes arriba. Abajo: Volver, Favorito, Regalo, Redecorar, Convivir y Cambiar. Hasta 2 residentes por habitación. Los personajes pasean, se sientan, duermen y juegan en silencio. **Al entrar en la habitación habla uno solo de los residentes, una sola vez**, con una tira de papel rasgado y torcido, con su retrato asomando por un lado (`datos/dialogos.ts`: frase propia, de los muebles, de su compañero o general, sin repetir las últimas 24). Al redecorar, los muebles se arrastran (por debajo del suelo se quitan) y se cambia el fondo.
- **Partida**: de arriba abajo, el jefe con su barra de vida, el reloj, el tablero y el equipo con sus medidores de tres estrellas. A los lados, el marcador, el combo y el Stand Up Time.
- **Colección**: álbum con marcos por rareza, filtros y una presentación para cada personaje. Los que faltan salen como siluetas con una pista de dónde conseguirlos.
- **Equipo**: dos pedestales, habilidades frente a frente y sinergias. Se guardan equipos con nombre.
- **Récords**: estadísticas, récord por jefe y logros.

## Reglas del puzzle

Basadas en la [JoJo Wiki](https://jojowiki.com/JoJo's_Pitter-Patter_Pop!) y en el estudio de la estructura del juego original. Ver `docs/pitter-reglas-originales.md` para lo que se sabe, lo que se infiere y lo que no se puede saber. Los números están en `REGLAS` (`motor/tablero.ts`) y en `datos/lideres.ts` para poder ajustarlos.

- Tablero de 6×6. Se arrastra una ficha **hacia donde se quiera** (también en diagonal). Las que pisa se apartan un hueco, una a una. Al soltar, los grupos de **4 o más** fichas iguales que se tocan se juntan y desaparecen.
- **Bloque grande.** Las fichas de un grupo se pliegan hacia su centro y una sola pieza grande con el personaje las sustituye (rectángulo si el grupo lo llena, cuadrado equivalente si no). Después sale una bola hacia el jefe.
- **Tamaño.** Un grupo grande hace más daño (`REGLAS.porTamano`).
- **Combo con ventana de tiempo.** Cada grupo suma al combo y reinicia una barra (`REGLAS.ventanaBase`, baja un poco con el combo, mínimo `ventanaMin`). Si se acaba, el combo se rompe. La barra solo corre cuando no se está resolviendo nada, y no corre durante el Stand Up Time. El daño sube con el combo y **se detiene en 200** (`REGLAS.comboMax`), como en el original.
- Un grupo de **6 o más** deja una Caja. Al tocarla, ella y las cuatro fichas que la rodean **pasan a ser fichas de su personaje** (forman un grupo de cinco). Las fichas creadas por una Caja no pueden dejar otra Caja.
- **Habilidad activa.** Cada personaje del equipo tiene una (16 hechas a mano, `datos/roster.ts` y `motor/habilidades.ts`). Se carga con las fichas **de ese personaje** que se borran (las de otros cargan menos) y se lanza **con el botón** (Q y W), también durante el Stand Up Time pero no en el Rush. Junto a cada medidor pone cuántas fichas faltan. **Al acabarse el tiempo o caer el jefe, un medidor lleno borra todas las fichas de ese personaje** (suma puntos y daño, y puede salvar la partida).
- **Habilidad de líder.** La del primero del equipo salta **sola** al cumplirse su condición (`motor/lider.ts`, `datos/lideres.ts`). Hay condiciones que se mantienen (siempre, durante el Stand Up, poco tiempo, jefe herido) y otras que saltan una vez (al empezar, cada cierto tiempo, cada tantos puntos, al llegar a un combo, con un grupo grande). Los efectos son subir el daño, cargar los medidores, ganar tiempo, subir el Stand Up, sumar combo o convertir fichas.
- **Stand Up Time.** El medidor se llena al borrar fichas y **se va perdiendo** si nadie lo alimenta. Al llenarse empieza solo. El reloj se para. Los grupos **no desaparecen**: se quedan de pie como bloques grandes y cada uno da unos segundos más (`standMax`). Al acabar atacan todos a la vez, y cada cuadrado de 2×2 multiplica el daño.
- **Habilidad pasiva.** La de cada uno de los dos del equipo está siempre puesta (`datos/pasivas.ts`): más tiempo al empezar, más daño de sus fichas, carga más rápida de su habilidad, Stand Up más rápido o combo más largo. Se ve al pasar el ratón por su retrato.
- **Rush.** Si el jefe cae con al menos el 30 % del tiempo por delante, empiezan 5 segundos en los que se sigue juntando fichas, **sin obstáculos ni piezas especiales**, y los puntos valen doble. Después sale el resultado. La wiki dice que el Rush llega al derrotar al jefe «dentro de un tiempo». Cuánto es ese tiempo no se sabe, el 30 % es una suposición (`RUSH_TIEMPO_MIN`).
- **Mover durante la cascada.** Se puede agarrar y mover una ficha mientras aún se anima la cascada anterior, siempre que esa ficha ya esté quieta en su sitio. Lo que salga de ahí se anima cuando acabe lo anterior (`Puzzle.reproducir` va en cola). Las fichas de pie del Stand Up Time no se pueden mover.
- Los jefes (`datos/campana.ts`) son criaturas del bestiario público, no los enemigos de las fichas del DM. Cada uno estropea el tablero a su manera: bloques (como las piezas Box), fichas congeladas y fichas con tinta (como DeBuff).
- **Lo que aún no está:** las piezas especiales del original que no se pueden deducir de los nombres (Crystal, Shabon, Elemental, Power) y las bombas con forma. La Caja de 6 o más hace de bomba. Los números son a ojo, no los del original.

## Herramientas de admin

Con `localStorage.compendioAdmin = "1"` aparece un botón 🛠 en la cabecera (o la tecla **F2**) que abre un panel flotante que no tapa el juego (`ui/admin.ts`).

- **Progreso** (cambia la partida guardada, hay que pulsarlo a propósito): desbloquear a todos los personajes, superar los 8 jefes con 3 estrellas (abre las 24 habitaciones y da los muebles), abrir las 24 habitaciones sin dar los jefes por superados, todos los muebles, personajes al nivel 10 y repetir el regalo de hoy.
- **Combate a elegir:** cualquier jefe con cualquier pareja de personajes, sin tenerlos abiertos.
- **En la partida:** habilidades llenas, Stand Up lleno, +30 s, combo +10, jefe al 10 % o curado o derrotado, perder, ataque del jefe ahora, poner una Caja, bloques, hielo o tinta, limpiar obstáculos. Y cuatro interruptores: reloj parado, el jefe no ataca, habilidades siempre llenas y daño ×10.

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
