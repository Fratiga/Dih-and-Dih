# Las Veintiuna Velas

Un blackjack contra la casa (`veintiuna.html`) con una regla especial distinta en cada mano. La mesa es una casa de juego a la luz de las velas y la crupier se llama Cera: una figura de cera con una corona de velas.

**Estado (18 de octubre de 2026):** **abierto a todos los jugadores** (por orden del usuario). Una sola entrada: la tarjeta «Las Veintiuna Velas» de Minijuegos, la mesa de blackjack de la taberna (rincón de cartas, abajo a la izquierda) y la sala recreativa llevan a `veintiuna.html`, y desde ahí el botón «Con amigos» de la cabecera lleva a la mesa con amigos (no tiene tarjeta ni puerta propia). Sigue pendiente que el usuario corra `docs/veintiuna.sql` en Supabase: hasta entonces los jugadores ven «La mesa todavía no está abierta» (el admin ve el aviso técnico). Las recompensas de cartas nacen apagadas.

Si hubiera que volver a esconderlo: poner `<script src="js/oculto.js">` el primero del `<head>` de `veintiuna.html` y de `veintiuna-amigos.html`, devolver las tarjetas al array `JUEGOS` de `minijuegos.html`, poner el cuarto elemento `true` en sus entradas de `MAPA` (`js/lobby-salas.js`) y `data-admin-only` en el objeto y en el enlace móvil de `index.html`.

## Reglas

- Baraja de 52 cartas, **barajada de nuevo en cada mano**. Dos cartas para ti, una visible y una oculta para el crupier.
- As 1 u 11, J, Q y K valen 10 (11 con la Maldición), el resto su número. Sin dividir, doblar, seguro ni rendición.
- El crupier pide con 16 o menos y **se planta con 17 o más, también con 17 blando** (con la Vela corta se planta con 16).
- Blackjack natural: 21 con las dos primeras cartas. Un 21 conseguido pidiendo no lo es.
- Pagos: victoria 1 a 1, natural 3 a 2 (6 a 5 con la Vela corta), empate devuelve, derrota pierde.
- **Orden al repartir** (decide la mano en el momento, sin que haya que jugarla): 1) te pasas de 21 (solo Maldición: dos figuras suman 22), pierdes; 2) natural de los dos, empate; 3) tu natural, 3 a 2; 4) natural del crupier, pierdes; 5) el crupier se pasa (solo Maldición), ganas. Si la mano sigue, el crupier no tiene natural (es lo que pasa en cualquier mesa donde el crupier mira su carta; la carta oculta en sí no sale del servidor).

## Las ocho reglas especiales

El servidor elige la regla de cada mano. **La de la próxima mano se enseña antes de apostar** y no cambia hasta repartirla (recargar la página no la cambia).

| Regla | Qué hace | Peaje |
|---|---|---|
| **Fortuna** | Si pides y te pasas de 21, puedes pagar el peaje para que esa carta valga 1 (un as fijo en 1, aunque sea un rey). Una vez por mano. Si no pagas, pierdes. | 60 % de la apuesta |
| **Maldición** | J, Q y K valen 11 para ti y para el crupier. Dos figuras suman 22 (te pasas al repartir). Rey + 10 es blackjack natural. | ninguno |
| **Última voluntad** | Una vez por mano, mientras no tengas 21, pagas el peaje y **cambias tu última carta por la siguiente de la baraja**. Si la nueva te pasa de 21, pierdes (no hay Fortuna en esta regla). El crupier juega su turno de siempre. | 50 % de la apuesta |
| **Ojo del Tahúr** | Una vez por mano, mientras no tengas 21, pagas el peaje y **ves la siguiente carta de la baraja** (la que sacarías si pides). Solo mira: no cambia nada. | 35 % de la apuesta |
| **Cartas marcadas** | Una vez por mano pagas el peaje y **ves la carta oculta del crupier**. Solo la ves tú y la carta no cambia. | 18 % de la apuesta |
| **Trueque con la casa** | Una vez por mano, antes de pedir carta, **tu primera carta y la que el crupier enseña se intercambian** (la oculta no se toca). Si te deja en 21 no es natural. | 100 % de la apuesta |
| **Vela corta** | El crupier se planta con 16 (pide con 15 o menos; un 17 blando sigue siendo plantarse) y **el natural paga 6 a 5** en lugar de 3 a 2. Sin botón ni peaje. | ninguno |
| **Pacto del Bufón** | Al repartir, un dado: 1-2 no pasa nada; 3-4 cambia la carta visible del crupier por la siguiente de la baraja; 5-6 cambia tu primera carta. Sin botón ni peaje. Neutral en valor esperado, solo mete caos. | ninguno |

Los peajes se cobran en el momento de usarlos, no se devuelven y se guardan en el libro de tokens. En la mesa de práctica son simbólicos. Los peajes (60, 50, 35, 18 y 100 %) están en `cartas_economia_ajustes` (`veintiuna_peaje_fortuna`, `_voluntad`, `_ojo`, `_marcadas`, `_trueque`) y se pueden cambiar sin tocar código. Si se suben o bajan, repetir el cálculo con `tools/veintiuna-reglas-nuevas.js`.

### Por qué esos peajes (equilibrio medido)

Sin peaje, las dos reglas activas rompen la mesa: la Fortuna daba al jugador un +14 % y cambiar la última carta un +16 % de valor esperado. Se calcularon con una estrategia óptima exacta (programación dinámica, baraja infinita, solo pedir, plantarse y cambiar) y se comprobaron con simulaciones de millones de manos con la baraja de 52:

| Regla | Valor esperado del jugador con juego óptimo |
|---|---|
| Sin regla (blackjack base con estas reglas) | −2,4 % |
| Maldición | −3,1 % |
| Fortuna, peaje 60 % | −1,1 % |
| Última voluntad (cambiar la última carta), peaje 50 % | −1,9 % exacto, −1,4 % con la baraja de 52 |
| Ojo del Tahúr, peaje 35 % | −1,9 % |
| Cartas marcadas, peaje 18 % | −1,85 % |
| Trueque con la casa, peaje 100 % | −1,5 % |
| Vela corta (crupier con 16 y natural a 6 a 5) | −1,74 % (con el natural a 3 a 2 sería −0,39 %: el 6 a 5 es lo que la equilibra) |
| Pacto del Bufón | −2,4 %, igual que el base (cambia una carta al azar: ni ayuda ni estorba de media) |

Las tres reglas nuevas con peaje se calcularon igual (programación dinámica exacta con baraja infinita, y un simulador de la baraja de 52 con estrategias fijas sencillas para comprobar que el SQL calcula lo mismo). Sin peaje el Ojo daría al jugador cerca de un +17 % y las Cartas marcadas cerca de un +3 %. Por eso el peaje del Ojo es alto (saber la próxima carta decide pedir o plantarse) y el de las Cartas marcadas es bajo (conocer la oculta del crupier ayuda poco).

Ninguna regla es favorable al jugador, así que apostar fuerte solo en las manos que te gustan no da ventaja. El promedio de las ocho es parecido al blackjack base. La Última voluntad es una herramienta de decisión: conviene sobre todo con 15 o 16 tras una carta pequeña (cambiar un 5 desde 11 nunca pasa de 21) y casi nunca con una mano alta. La versión anterior (el crupier roba una carta de más) era demasiado fuerte para repartir un peaje razonable y sentía como multa, por eso se cambió. El cálculo exacto está en `tools/veintiuna-equilibrio.js` (Fortuna y Maldición) y `tools/veintiuna-voluntad-cambio.js` (la Última voluntad); `docs/pruebas/t_veintiuna_ev.sql` juega miles de manos de verdad contra el servidor y comprueba que el SQL coincide con la simulación.

## Tokens

- Son los **tokens de juego** del Hipódromo: se usa su billetera (`hipodromo_billeteras`) y su libro (`hipodromo_movimientos`). No hay billetera ni token nuevos.
- Apuestas **sin máximo** (decisión del usuario, 18-oct-2026): desde 10, de 10 en 10, hasta lo que tengas en la billetera. En `cartas_economia_ajustes`, `veintiuna_apuesta_max` en `0` significa «sin tope»; si algún día hace falta uno, se pone ahí (`veintiuna_apuesta_min` y `_paso` siguen siendo 10). El paso de 10 hace que el 3 a 2 sea siempre un número entero. Las fichas llegan a 1000 y hay un botón «Todo lo que tengo».
- La apuesta se cobra al repartir; el pago (apuesta incluida) al terminar. Cada movimiento lleva en el concepto el identificador de la mano («Veintiuna Velas: apuesta (mano …)») y la mano guarda los números de sus movimientos (`mov_cobro`, `mov_peaje`, `mov_pago`).
- **Mesa de práctica**: mismas cartas y reglas, apuesta simbólica, no toca la billetera, no da tokens. **No cuenta para los desafíos ni para las rachas** (decisión del 18-oct-2026): sirve para aprender las reglas. Sí suma en rondas, victorias y derrotas de las estadísticas.
- No se cambia ninguna fuente de ingresos del Hipódromo ni de otros juegos. Esta mesa solo mueve tokens entre la billetera y la casa, y con las reglas de arriba la casa gana de media. Los tokens siguen entrando por las vías de siempre (vender cartas, carreras, regalos del Admin).

## Mesa con amigos (`veintiuna-amigos.html`)

La misma mesa para hasta **cinco jugadores** (`veintiuna_mesa_asientos`). Se entra desde la mesa de blackjack de la taberna (rincón de cartas, abajo a la izquierda, con Cera detrás), desde «Jugar con amigos» en la mesa individual o con un enlace de invitación (`veintiuna-amigos.html?mesa=ABCDE`).

- **Quién juega contra quién:** todos juegan **contra la casa**, no entre sí. Cada uno apuesta sus tokens y cobra o paga solo por su mano; hay **una regla especial por ronda para toda la mesa** (se enseña antes de apostar) y cada jugador usa su acción (peaje incluido) en su turno. Con el Ojo del Tahúr ves la siguiente carta **tú solo**; con las Cartas marcadas, la oculta del crupier **tú solo**; con el Trueque cambia la carta visible del crupier para todos; el dado del Bufón es uno para toda la mesa.
- **Mesas:** públicas (salen en la lista) o privadas (solo con el código de 5 caracteres). Quien crea la mesa elige si lleva pozo de cartas. Solo se puede estar sentado en una mesa, y sentado no se puede jugar la mano individual.
- **Baraja:** doble (104 cartas), barajada de nuevo en cada ronda, porque con cinco jugadores una sola podría quedarse corta. El valor esperado cambia una décima de punto como mucho respecto a las cuentas de una baraja.
- **Una ronda:** apuestas (se reparte cuando todos están listos o 45 s después de que apueste el primero; quien crea la mesa puede repartir ya) → reparto → turnos por asiento (45 s cada uno; si no juegas, el servidor te planta, y si lo dejas pasar dos veces seguidas te levanta de la mesa) → el crupier juega → resultado (10 s) → siguiente ronda. Los naturales se pagan al repartir, igual que en la individual. Se puede **jugar sin apostar** (mano de práctica: no cobra ni paga y no cuenta para desafíos) o **pasar** la ronda.
- **Salir:** a mitad de ronda pierdes tu mano por abandono (la apuesta ya está pagada). Antes de repartir no cuesta nada. Quien lleva más de 150 s sin dar señales (la página abierta avisa cada pocos segundos) se levanta solo. Si se va quien creó la mesa, pasa al siguiente que se sentó; cuando se va el último, la mesa se cierra.
- **Desafíos y tokens:** las manos con apuesta cuentan para desafíos, rachas y estadísticas igual que en la individual; el libro de tokens lleva el mismo concepto («Veintiuna Velas: apuesta (mano …)»).

### Modo «todos contra todos»

Quien crea la mesa elige entre **contra la casa** (el de siempre) y **todos contra todos**: no hay crupier que juegue (Cera solo reparte) y los jugadores se pelean entre sí por un bote.

- **El bote** es la suma de lo que apuesta cada jugador con tokens, y se lo lleva la **mejor mano** de entre quienes apostaron y no se pasaron ni se fueron: un blackjack natural (21 con dos cartas) gana a cualquier total y, después, gana el total más alto. Si empatan arriba, el bote se reparte a partes iguales (el céntimo sobrante, al primero). Si se pasan todos, se devuelven las apuestas. Los peajes de las reglas no entran en el bote: se pagan a la casa.
- **Hace falta que apuesten tokens al menos dos jugadores**; si no, esa ronda se juega sin apostar y se avisa. Quien juega sin apostar compite por la gloria (cuenta como victoria o derrota en las estadísticas) pero no gana ni pierde tokens.
- Cada jugador ve las cartas de todos, así que **quién juega primero rota cada ronda** (el último en jugar sabe lo que han hecho los demás).
- Quien se pasa queda fuera, pero su mano sigue abierta hasta el final de la ronda: su apuesta ya está en el bote. Quien se levanta a mitad de ronda deja su apuesta en el bote y no puede ganar.
- **Reglas que se sortean:** las que no necesitan crupier (Fortuna, Maldición, Última voluntad, Ojo del Tahúr y Pacto del Bufón; este último solo cambia la primera carta de un jugador al azar, o nada). Trueque, Cartas marcadas y Vela corta no salen.
- **No cuenta para desafíos ni rachas** (así nadie los gana pactando con un amigo). Sí cuenta en las estadísticas de manos y de tokens.
- El pozo de cartas funciona igual, pero gana la mejor mano de quienes pusieron carta y **no se pasaron** (no hace falta ganar a la casa porque no hay casa).
- Tablas y funciones: `veintiuna_mesas.modo`, `veintiuna_partidas.duelo`/`orden`, y `veintiuna_i_amigos_resolver_duelo`, que reparte el bote al acabar la ronda. Las manos pasadas o abandonadas usan las fases `pasada` y `abandonada` hasta ese momento.

### Pozo de cartas entre jugadores

Solo en las mesas creadas «con pozo de cartas». Es la forma de apostarse cartas entre jugadores y sigue las reglas de la economía de cartas (sección 9 de `docs/economia-de-cartas.md`: el ganador se lleva las cartas, nunca se crean ni se destruyen, el bloqueo es el oficial, se respetan los límites por jugador).

- Antes de repartir, cada jugador puede poner **una** carta suya. Se **bloquea** (`cartas_i_bloquear`) hasta que acaba la ronda y todos ven qué hay en el pozo y de quién es.
- **Equilibrio:** las cartas del pozo no pueden diferir en más de una categoría de rareza (el mismo criterio de los duelos de Triunfos). Máximo `veintiuna_pozo_max_dia` veces al día por jugador (5).
- Para que haya pozo tienen que poner carta **al menos dos** de los que juegan la ronda. Si no, la carta vuelve sola a su dueño al repartir y se le avisa.
- **Quién gana:** entre quienes pusieron carta y **ganaron a la casa** (victoria o natural), se lleva todo el pozo el de mejor mano: un natural vale más que cualquier total y, después, gana el total más alto. Si empatan arriba, o nadie ganó a la casa, cada carta vuelve a su dueño. Quien se levanta a mitad de ronda no puede ganar, pero su carta sigue en juego.
- Si al ganador ya no le cabe una carta (límite por jugador), esa carta vuelve a su dueño y no hay error. Cada traspaso queda en el libro de cartas (`cartas_movimientos`) y el pozo en `veintiuna_pozos` / `veintiuna_pozo_cartas`.
- Esta forma de elegir al ganador (18-oct-2026) busca que nadie gane cartas sin ganarle a la casa y que decida la mejor mano; está en `veintiuna_i_pozo_resolver` si hay que cambiarla.

### Cómo está hecha

- Cada jugador sigue teniendo **su mano en `veintiuna_partidas`** (con `mesa`, `asiento` y `ronda_id`): las mismas reglas, peajes, desafíos y libro de tokens. Lo compartido (baraja, posición, cartas del crupier) vive en `veintiuna_mesas` y se copia a las manos en curso después de cada acción.
- Tablas: `veintiuna_mesas`, `veintiuna_asientos`, `veintiuna_pozos`, `veintiuna_pozo_cartas`. Ninguna se lee ni se escribe desde el navegador (solo el admin puede mirarlas); todo pasa por las funciones `veintiuna_amigos_*` (`lista`, `crear`, `unirse`, `salir`, `estado`, `apostar`, `pasar`, `repartir`, `accion`, `mis_cartas`), que son `security definer` y solo se conceden a `authenticated`.
- **Sin tiempo real:** el navegador pregunta por `veintiuna_amigos_estado(version)` cada 1,5 s (5 s con la pestaña en segundo plano). Si no cambió nada solo recibe `{sin_cambios}`. Esa llamada es también la señal de que sigues sentado, y quien la hace hace avanzar la mesa si toca (plazos, reparto, siguiente ronda), con un candado por mesa.
- **Lo que no sale del servidor:** la baraja, la carta oculta del crupier hasta que acaba la ronda, y lo que ve cada uno con el Ojo o las Cartas marcadas. Las manos de todos sí se ven (en una mesa de verdad también).
- Las apuestas de los demás no se ven hasta que se reparte.

## Seguridad: la autoridad es el servidor

Todo está en `docs/veintiuna.sql`. El navegador pide y pinta.

- La baraja se baraja en el servidor con `gen_random_uuid()` (aleatoriedad criptográfica de Postgres), se guarda en `veintiuna_partidas` y **esa tabla no se puede leer desde el navegador** (solo el admin). Las respuestas llevan únicamente las cartas ya visibles: la oculta del crupier no sale hasta que la mano termina (las pruebas comprueban la respuesta de red, no solo la pantalla).
- Una mano abierta por jugador (índice único parcial). Reparte con un identificador de petición: repetirla devuelve la misma mano sin cobrar otra vez. Cada acción lleva el número de paso: repetir una ya aplicada devuelve el estado actual sin aplicarla de nuevo; un paso del futuro se rechaza.
- Todo en una transacción con un candado por jugador. La liquidación solo ocurre si la mano sigue «en curso», así que no puede pagar dos veces ni con dos peticiones a la vez (probado con sesiones paralelas reales).
- Una mano abandonada se cierra sola a los 30 minutos: el servidor se planta por ti (o acepta el pasarte si estabas decidiendo la Fortuna) y paga lo que toque.
- Permisos mínimos: las tablas no admiten escrituras directas; las funciones internas (`veintiuna_i_*`) no se pueden llamar desde el navegador; solo las cinco públicas (`veintiuna_mesa`, `_repartir`, `_accion`, `_historial`, `_reclamar`) se conceden a `authenticated`.
- Si hay un corte de red, el navegador muestra el aviso con «Reintentar» y repite la petición con los mismos identificadores: es seguro aunque la primera sí hubiera llegado.

## Cartas coleccionables: los desafíos

El progreso principal son **desafíos** que el servidor comprueba al terminar cada mano (con o sin apuesta). Cada uno se completa una vez y se reclama una vez; da una carta. Premian conocer las reglas, adaptarse a ellas y arriesgar, no repetir manos: no hay cuotas de victorias (se quitaron «Maestro de la mesa», seis victorias seguidas y el blackjack natural, que eran repetir o pura suerte).

| Nivel | Desafíos |
|---|---|
| Bronce (valor 1, «bueno») | Primera vela (ganar una mano) · Bajo la Maldición · Peaje pagado (ganar tras salvar la mano con la Fortuna) · La última palabra (ganar tras cambiar una carta con la Última voluntad) |
| Plata (valor 3, «excelente») | Veintiuna exacta (llegar a 21 pidiendo) · Sin miedo (plantarte con 14 o menos y ganar) · Tres velas seguidas · Tres caras de la mesa (ganar con tres reglas distintas) |
| Oro (valor 4, «extraordinario») | Reescribir el destino (ganar con 20 o 21 tras cambiar una carta con la Última voluntad) · Cinco cartas sin pasarte · La suerte bien pagada (ganar con 21 exactos tras salvar la mano con la Fortuna) |

Reutilizan el sistema oficial de recompensas, sin crear otro: el juego es una fila más de `cartas_juegos` (`veintiuna`) y reclamar cierra una partida de recompensa con `cartas_i_juego_terminar_nucleo`, igual que La Fractura. Heredan por eso los topes diarios, los límites global y por jugador, la etiqueta «En circulación», la reserva compartida, que las legendarias y limitadas nunca salgan y el libro de movimientos. Decisiones propias:

- **Una carta al día como mucho desde la mesa** (`tope_dia` 1), y probabilidad 1 en cada tramo para que un desafío completado no se convierta en un sello.
- Si no hay carta que dar (juego apagado, tope del día, todo agotado), el desafío **no se gasta**: queda guardado y se reclama más tarde. Todo el cierre se deshace con un punto de guardado, sin dejar sellos ni registro de más.
- Se anula la «mejora personal» del sistema general (sube un tramo al superar tu mejor puntaje), porque aquí el valor es un nivel de desafío, no un puntaje.
- El editor de Juegos y recetas del Admin ya lo gestiona: se amplió `cartas_i_validar_valores` (parche automático dentro de `veintiuna.sql`) y `js/admin-economia.js` enseña los tres valores de nivel.
- **Nace apagado** (`activo = false`): se enciende en Admin → Economía → Juegos y recetas. Los grupos de cartas y los pesos por tramo son los de Ajedrez y se editan allí.

El 17-oct-2026 el catálogo real tiene 41 comunes, 37 poco comunes y 24 raras obtenibles, así que 11 desafíos nunca inundan nada. Limitación conocida: como la práctica cuenta, un script podría completar los desafíos sin apostar. Está acotado: son 11 reclamos en total, uno al día como mucho, y pasan por todos los límites de la colección.

## Apuestas con cartas (no implementadas)

No hay ninguna infraestructura anticipada. Cuando llegue el momento, el sistema de la economía ya tiene lo necesario: `cartas_i_bloquear` (cartas retenidas durante una operación), `cartas_i_transferir`, `cartas_i_retirar` (a la reserva o destruida) y las reglas de Triunfos para apuestas (voluntarias, sin salirse de la circulación, la carta perdida contra la casa vuelve a la reserva). Una mesa con cartas sería otro modo de `veintiuna_repartir` con su propia pestaña de confirmación, sin tocar la billetera.

## Música y sonido

- `veintiuna.html` está registrada en `js/musica-paginas.js` (lista de páginas y de páginas con partida): el Admin le asigna una playlist de la Rocola de fondos desde el ⚙ de la página y suena mientras hay una mano abierta. **No hay música asignada todavía** y no se ha añadido ningún archivo de audio: la integración está lista, falta elegir las canciones.
- Efectos de la mesa (carta, giro, ficha, victoria, derrota, empate, vela): se sintetizan con Web Audio, sin archivos. Pasan por el volumen general del sitio (`js/mj-volumen.js`) y hay un botón «Efectos» para apagarlos. No suena nada hasta el primer clic.

## Diseño y accesibilidad (resumen; el detalle está en el código)

- Todo el arte son SVG dibujados en `js/veintiuna-arte.js` (52 caras con su disposición real de símbolos, dorso con 21 llamas, fichas, iconos de reglas, la crupier con seis expresiones, tapete). No hay imágenes que puedan faltar.
- La crupier reacciona: espera, reparte, mira al jugador, juega su turno, gana y pierde. Dice una frase corta y de vez en cuando, nunca un diálogo.
- Las velas bajo cada mano son el marcador de puntos (veintiuna llamas); se vuelven azules al pasarte.
- Animaciones: reparto desde el zapato, giro de la carta oculta, el turno del crupier carta a carta, cambio de placa de regla, resultado con brillo (victoria), apagón (derrota), saldo que cuenta, tokens que vuelan. Todas cuentan algo que el servidor ya confirmó, se saltan con un clic, Espacio o Intro, y se apagan con `prefers-reduced-motion`.
- Teclado: P pedir, L plantarse, V la acción de la regla (Última voluntad, Ojo, Cartas marcadas, Trueque) o Fortuna, A aceptar la derrota, Intro otra mano. Foco visible, `aria-live` para anunciar cada carta y el resultado, botones deshabilitados con `aria-disabled` que explican por qué al pulsarlos, diálogos nativos con foco atrapado, objetivos táctiles de 44 px o más, contraste calculado.
- Móvil: las cartas y los controles van primero; el dock de acciones se queda pegado abajo.

## Pruebas

```bash
sh docs/pruebas/cargar_local.sh todo && sh docs/pruebas/t_veintiuna.sh    # reglas, reglas especiales, carta oculta, economía, permisos, concurrencia, desafíos y recompensas
node docs/pruebas-web/veintiuna.js                                        # textos, acciones, llamadas al servidor, cartas, accesibilidad y contraste
```

`VEINTIUNA_EV_MANOS=3000 sh docs/pruebas/t_veintiuna.sh` acorta las partidas de valor esperado (por defecto 12.000 por regla, unos 15 minutos en total).

## Archivos

| Archivo | Qué es |
|---|---|
| `veintiuna.html`, `css/veintiuna.css` | La página y su aspecto |
| `js/veintiuna-mesa.js` | La mesa: pantalla, animaciones, diálogos, teclado y sonido |
| `js/veintiuna-arte.js` | Todo el dibujo (SVG) |
| `js/veintiuna-vista.js` | Textos, acciones y apuestas (puro, probado en Node) |
| `tools/veintiuna-equilibrio.js`, `veintiuna-voluntad-cambio.js`, `veintiuna-reglas-nuevas.js`, `veintiuna-reglas-nuevas-b.js` | Cálculo exacto del valor esperado de cada regla |
| `js/veintiuna-api.js` | Las llamadas al servidor (la mesa individual y `amigos.*`) y los errores de red (puro) |
| `veintiuna-amigos.html`, `js/veintiuna-amigos.js` | La mesa con amigos: lobby de mesas, asientos, pozo y turnos |
| `docs/veintiuna.sql` | Tablas, reglas del juego, economía y desafíos |
| `docs/pruebas/t_veintiuna*.sql/.sh` (incluye `t_veintiuna_amigos.sql`), `docs/pruebas-web/veintiuna.js` | Pruebas |
| `assets/minijuegos/veintiuna.svg` | Ilustración de la tarjeta de Minijuegos |

## Pendiente

- Correr `docs/veintiuna.sql` en Supabase (después de la economía de cartas y del Hipódromo; se puede repetir).
- Probar con una sesión real de Supabase (aquí se probó contra un Postgres local con el mismo esquema y una pasarela que ejecuta las funciones de verdad como un jugador).
- Elegir música para la página y encender las recompensas cuando se decida abrirlo.
