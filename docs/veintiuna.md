# Las Veintiuna Velas

Un blackjack contra la casa (`veintiuna.html`) con una regla especial distinta en cada mano. La mesa es una casa de juego a la luz de las velas y la crupier se llama Cera: una figura de cera con una corona de velas.

**Estado (17 de octubre de 2026):** subido pero **oculto a los jugadores**. Solo lo abre la cuenta de admin (`js/oculto.js`, tarjeta en «En pruebas» de Minijuegos y puerta con marca de admin en la sala recreativa). El SQL (`docs/veintiuna.sql`) lo corre el usuario en Supabase; hasta entonces la página sale con el aviso «La mesa todavía no está montada». Las recompensas de cartas nacen apagadas.

Para abrirlo a todos: quitar `oculto.js` de `veintiuna.html`, pasar la tarjeta del array `JUEGOS` a las tarjetas normales de `minijuegos.html` y quitar el `true` de su entrada en `MAPA` de `js/lobby-salas.js`.

## Reglas

- Baraja de 52 cartas, **barajada de nuevo en cada mano**. Dos cartas para ti, una visible y una oculta para el crupier.
- As 1 u 11, J, Q y K valen 10 (11 con la Maldición), el resto su número. Sin dividir, doblar, seguro ni rendición.
- El crupier pide con 16 o menos y **se planta con 17 o más, también con 17 blando**.
- Blackjack natural: 21 con las dos primeras cartas. Un 21 conseguido pidiendo no lo es.
- Pagos: victoria 1 a 1, natural 3 a 2, empate devuelve, derrota pierde.
- **Orden al repartir** (decide la mano en el momento, sin que haya que jugarla): 1) te pasas de 21 (solo Maldición: dos figuras suman 22), pierdes; 2) natural de los dos, empate; 3) tu natural, 3 a 2; 4) natural del crupier, pierdes; 5) el crupier se pasa (solo Maldición), ganas. Si la mano sigue, el crupier no tiene natural (es lo que pasa en cualquier mesa donde el crupier mira su carta; la carta oculta en sí no sale del servidor).

## Las tres reglas especiales

El servidor elige la regla de cada mano. **La de la próxima mano se enseña antes de apostar** y no cambia hasta repartirla (recargar la página no la cambia).

| Regla | Qué hace | Peaje |
|---|---|---|
| **Fortuna** | Si pides y te pasas de 21, puedes pagar el peaje para que esa carta valga 1 (un as fijo en 1, aunque sea un rey). Una vez por mano. Si no pagas, pierdes. | 60 % de la apuesta |
| **Maldición** | J, Q y K valen 11 para ti y para el crupier. Dos figuras suman 22 (te pasas al repartir). Rey + 10 es blackjack natural. | ninguno |
| **Última voluntad** | En lugar de plantarte, pagas y el crupier **roba una carta de más antes de jugar su turno** (aunque ya tuviera 17 o más); después sigue con su regla de siempre. Una vez por mano. Si se pasa, ganas. | 85 % de la apuesta |

Los peajes se cobran en el momento de usarlos, no se devuelven y se guardan en el libro de monedas. En la mesa de práctica son simbólicos. Los tres números (60 %, 85 % y un mínimo de puntos para la Última voluntad, 0 = cualquier mano) están en `cartas_economia_ajustes` (`veintiuna_peaje_fortuna`, `veintiuna_peaje_voluntad`, `veintiuna_voluntad_minimo`) y se pueden cambiar sin tocar código.

### Por qué esos peajes (equilibrio medido)

Sin peaje, las dos reglas activas rompen la mesa: la Fortuna daba al jugador un +14 % y la Última voluntad un +25 % de valor esperado. Se calcularon con una estrategia óptima exacta (programación dinámica, baraja infinita, solo pedir y plantarse) y se comprobaron con simulaciones de millones de manos:

| Regla | Valor esperado del jugador con juego óptimo |
|---|---|
| Sin regla (blackjack base con estas reglas) | −2,4 % |
| Maldición | −3,1 % |
| Fortuna, peaje 60 % | −1,1 % |
| Última voluntad, peaje 85 % | −1,1 % |

Ninguna regla es favorable al jugador, así que apostar fuerte solo en las manos que te gustan no da ventaja. El promedio de las tres es parecido al blackjack base. La Última voluntad solo compensa en un puñado de situaciones (sobre todo 13 a 17 contra un 10 del crupier): es un botón de apuro, no un truco constante. El cálculo exacto está en `tools/veintiuna-equilibrio.js` (`node tools/veintiuna-equilibrio.js`); `docs/pruebas/t_veintiuna_ev.sql` juega miles de manos de verdad contra el servidor y comprueba que el SQL coincide con la simulación.

## Monedas

- Son las **monedas del Hipódromo**: se usa su billetera (`hipodromo_billeteras`) y su libro (`hipodromo_movimientos`). No hay billetera ni moneda nuevas.
- Apuestas de 10 a 100 de 10 en 10 (`veintiuna_apuesta_min`, `_max`, `_paso`). La apuesta mediana del Hipódromo es 20 y la máxima 50; las billeteras reales tienen entre 0 y 100. El paso de 10 hace que el 3 a 2 sea siempre un número entero.
- La apuesta se cobra al repartir; el pago (apuesta incluida) al terminar. Cada movimiento lleva en el concepto el identificador de la mano («Veintiuna Velas: apuesta (mano …)») y la mano guarda los números de sus movimientos (`mov_cobro`, `mov_peaje`, `mov_pago`).
- **Mesa de práctica**: mismas cartas y reglas, apuesta simbólica, no toca la billetera, no da monedas. Cuenta para los desafíos, para que la colección no dependa de apostar.
- No se cambia ninguna fuente de ingresos del Hipódromo ni de otros juegos. Esta mesa solo mueve monedas entre la billetera y la casa, y con las reglas de arriba la casa gana de media. Las monedas siguen entrando por las vías de siempre (vender cartas, carreras, regalos del Admin).

## Seguridad: la autoridad es el servidor

Todo está en `docs/veintiuna.sql`. El navegador pide y pinta.

- La baraja se baraja en el servidor con `gen_random_uuid()` (aleatoriedad criptográfica de Postgres), se guarda en `veintiuna_partidas` y **esa tabla no se puede leer desde el navegador** (solo el admin). Las respuestas llevan únicamente las cartas ya visibles: la oculta del crupier no sale hasta que la mano termina (las pruebas comprueban la respuesta de red, no solo la pantalla).
- Una mano abierta por jugador (índice único parcial). Reparte con un identificador de petición: repetirla devuelve la misma mano sin cobrar otra vez. Cada acción lleva el número de paso: repetir una ya aplicada devuelve el estado actual sin aplicarla de nuevo; un paso del futuro se rechaza.
- Todo en una transacción con un candado por jugador. La liquidación solo ocurre si la mano sigue «en curso», así que no puede pagar dos veces ni con dos peticiones a la vez (probado con sesiones paralelas reales).
- Una mano abandonada se cierra sola a los 30 minutos: el servidor se planta por ti (o acepta el pasarte si estabas decidiendo la Fortuna) y paga lo que toque.
- Permisos mínimos: las tablas no admiten escrituras directas; las funciones internas (`veintiuna_i_*`) no se pueden llamar desde el navegador; solo las cinco públicas (`veintiuna_mesa`, `_repartir`, `_accion`, `_historial`, `_reclamar`) se conceden a `authenticated`.
- Si hay un corte de red, el navegador muestra el aviso con «Reintentar» y repite la petición con los mismos identificadores: es seguro aunque la primera sí hubiera llegado.

## Cartas coleccionables: los desafíos

El progreso principal son **desafíos** que el servidor comprueba al terminar cada mano (con o sin apuesta). Cada uno se completa una vez y se reclama una vez; da una carta.

| Nivel | Desafíos |
|---|---|
| Bronce (valor 1, «bueno») | Primera vela (ganar una mano) · Bajo la Maldición · Peaje pagado (ganar tras salvar la mano con la Fortuna) · La última palabra (ganar tras la Última voluntad) |
| Plata (valor 3, «excelente») | Veintiuna exacta (llegar a 21 pidiendo) · Blackjack natural · Tres velas seguidas · Las tres voluntades (ganar con cada regla) |
| Oro (valor 4, «extraordinario») | Seis velas seguidas · Cinco cartas sin pasarte · Maestro de la mesa (50 victorias) |

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
- Animaciones: reparto desde el zapato, giro de la carta oculta, el turno del crupier carta a carta, cambio de placa de regla, resultado con brillo (victoria), apagón (derrota), saldo que cuenta, monedas que vuelan. Todas cuentan algo que el servidor ya confirmó, se saltan con un clic, Espacio o Intro, y se apagan con `prefers-reduced-motion`.
- Teclado: P pedir, L plantarse, V Última voluntad o Fortuna, A aceptar la derrota, Intro otra mano. Foco visible, `aria-live` para anunciar cada carta y el resultado, botones deshabilitados con `aria-disabled` que explican por qué al pulsarlos, diálogos nativos con foco atrapado, objetivos táctiles de 44 px o más, contraste calculado.
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
| `js/veintiuna-api.js` | Las cinco llamadas al servidor y los errores de red (puro) |
| `docs/veintiuna.sql` | Tablas, reglas del juego, economía y desafíos |
| `docs/pruebas/t_veintiuna*.sql/.sh`, `docs/pruebas-web/veintiuna.js` | Pruebas |
| `assets/minijuegos/veintiuna.svg` | Ilustración de la tarjeta de Minijuegos |

## Pendiente

- Correr `docs/veintiuna.sql` en Supabase (después de la economía de cartas y del Hipódromo; se puede repetir).
- Probar con una sesión real de Supabase (aquí se probó contra un Postgres local con el mismo esquema y una pasarela que ejecuta las funciones de verdad como un jugador).
- Elegir música para la página y encender las recompensas cuando se decida abrirlo.
