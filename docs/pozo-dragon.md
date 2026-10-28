# El Pozo del Dragón

Juego de dados con apuestas de tokens y cartas entre jugadores (`pozo-dragon.html`). Tres modalidades en un mismo motor de dados: **Solo contra el Dragón**, **Duelo de Dragones** (dos jugadores) y **El Pozo Compartido** (de dos a seis).

**Estado (28-10-2026): ABIERTO a todos los jugadores**, por orden del usuario. El SQL está instalado en Supabase y probado contra Postgres local (Docker, ver «Pruebas»). En Minijuegos es una tarjeta normal. **Pendiente en producción:** instalar el SQL nuevo ( entero, es idempotente) para activar los desafíos de cartas y el solitario sin tope de tiradas; hasta entonces el servidor es el anterior (la quinta tirada se cobra sola y la página esconde el botón de Desafíos).

## Cómo se esconde (por si hay que cerrarlo otra vez)

El juego se abrió quitando `js/oculto.js` de `pozo-dragon.html`, pasando su tarjeta a las tarjetas normales de `minijuegos.html` y poniendo `pozo_dragon_publico` a `true`. Para esconderlo de nuevo, en este orden:

1. `update cartas_economia_ajustes set valor = 'false' where clave = 'pozo_dragon_publico';` (desde ese momento **el servidor** solo responde al admin: cada función pública empieza con `pozo_i_acceso()`).
2. Volver a poner `<script src="js/oculto.js...">` el primero del `<head>` de `pozo-dragon.html` y la tarjeta en la lista `JUEGOS` («En pruebas») de `minijuegos.html`.
3. Subir la versión (`?v=`) de lo que se toque.

Las partidas en curso no se pierden: al reabrirlo siguen donde estaban.

## Las combinaciones (tres dados, 216 resultados)

Clasificación determinista y excluyente, en este orden: **Ruina** (suma de 3 a 5), **triple seis**, **otros triples** (2 a 5; el 1-1-1 es Ruina), **escalera** (1-2-3, 2-3-4, 3-4-5, 4-5-6), **pareja** (exactamente dos iguales) y **ceniza**. La Ruina manda sobre todo: 1-1-2 es Ruina aunque tenga pareja.

| Resultado | Casos | Probabilidad |
|---|---:|---:|
| Ruina | 10/216 | 4,63 % |
| Triple 2–5 | 4/216 | 1,85 % |
| Triple seis | 1/216 | 0,46 % |
| Escalera | 24/216 | 11,11 % |
| Pareja | 81/216 | 37,50 % |
| Ceniza | 96/216 | 44,44 % |

Verificado con los 216 resultados en `tools/pozo-dragon-simulacion.js` y en `docs/pruebas-web/pozo_dragon.js`. La clasificación vive en el SQL (`pozo_i_clasificar`) y está copiada en `js/pozo-dragon-vista.js`; una prueba comprueba que no se separan.

## Duelo de Dragones

- Dos jugadores, tres dados cada uno por ronda, tiran por turnos (abre la ronda el que no abrió la anterior; el primero se sortea).
- **Jerarquía** (`pozo_i_fuerza`): Ruina < ceniza < pareja < escalera < triple < triple seis. Dentro de una categoría: Ruina por la suma, ceniza por los dados de mayor a menor, pareja por su valor y luego el dado suelto, escalera por su dado más alto, triple por su valor. Mismo conjunto de dados = empate de ronda.
- Gana quien llegue a **2 rondas** (mejor de tres), máximo **5 rondas** (los empates gastan ronda). Al llegar al límite gana quien lleve más rondas; si van igualados, **empate: cada uno recupera lo suyo**.
- El ganador se lleva el dinero y las cartas del perdedor.
- Turno de 30 s: si se acaba, los dados los tira el servidor; **3 turnos seguidos** sin jugar es abandono y pierde. Salir en pleno duelo es abandonar. Si ninguno da señales durante 5 minutos, empate.
- No usa la lógica de bonos del modo compartido.

## El Pozo Compartido

De 2 a 6 jugadores, misma apuesta cada uno. **El pozo son las apuestas y nada más: el juego no crea ni destruye dinero.**

- Cada jugador tiene un **peso**: 100 % (su apuesta) más los bonos de sus tiradas.
- Bonos (en % de la apuesta): pareja **+12,5 %**, escalera **+37,5 %**, triple **+75 %**, triple seis **+200 %**, ceniza 0.
- **Ruina:** eliminado, pierde su peso y su apuesta se queda en el pozo.
- Tras cada tirada sin Ruina: **cobrar** (te quedas con el peso que llevas) o **continuar**. Cobrar es una decisión válida, no una derrota. Máximo 5 tiradas por jugador: en la última sin Ruina cobras solo.
- Cuando ya no queda nadie en juego, el pozo entero se reparte entre quienes no sufrieron Ruina **en proporción al peso**: parte = pozo × tu peso / suma de los pesos (céntimos hacia abajo; lo que sobre va al de mayor peso).
- Si solo queda un jugador en juego, **sigue él solo** hasta cobrar, caer o agotar tiradas (decisión: la mesa no lo expulsa; evita que el primero en cobrar decida la partida).
- Quien no llega a tirar ni una vez (tiempo agotado o sale) **recupera su apuesta y no entra en el reparto**. Si todos sufren Ruina, se devuelven las apuestas.
- Turno de 30 s: si se acaba, retirada automática con el peso que lleve. Salir de la mesa en marcha cuenta igual.
- **Cartas:** las de los eliminados forman un botín que se reparte de una en una (primero las más raras) entre los supervivientes, de mayor a menor peso. Las demás vuelven a su dueño.

### Por qué no se usó la tabla de bonos tal cual (simulación)

La tabla propuesta (pareja 25 %, escalera 75 %, triple 150 %, triple seis 400 %) suma de media un **22,3 %** de la apuesta por tirada, con un 4,63 % de Ruina. No se puede pagar sin crear dinero: pagada de la casa, cada jugador cobraría de media un 22 % (si cobra al instante), un 61 % (tres tiradas) o un 93 % (cinco) de su apuesta **creados de la nada** en cada partida.

Se probaron varios modelos con tabla ×1 y reducciones (`tools/pozo-dragon-simulacion.js`, 40.000 a 100.000 mesas por escenario):

- Bonos pagados solo con lo que pierden los eliminados: **cobrar en la primera tirada domina** a todas las demás estrategias. No hay tensión.
- Bonos como peso que reparte el pozo entero (el modelo del juego) con la tabla original: **seguir hasta la quinta tirada domina**, con +19 % de ventaja frente a quien cobra pronto en mesas de 4. Tampoco hay decisión.
- El mismo modelo con los **bonos a la mitad** (los del juego): ninguna estrategia extrema domina. En mesas de 4 con tres rivales prudentes, el neto medio por partida es −3,1 % (cobrar siempre en la primera tirada), +0,1 % (prudente), +1,1 % (seguir hasta el final) y +2,1 % (el que recalcula su parte esperada cada turno). Hay decisión real, la habilidad se nota unos puntos y la suma pagada es siempre igual a la apostada (desvío medio de 1e-15 en coma flotante; en SQL es `numeric` exacto).

Ajuste, pues, de la tabla: **todos los bonos a la mitad**. Se guardan en `cartas_economia_ajustes` (`pozo_bono_*`) para poder cambiarlos sin tocar código. Otras cifras de la simulación (mesas de 4 prudentes): una mesa dura de media 11,5 tiradas y todos caen en Ruina en el 0,03 % de las mesas.

Una consecuencia que conviene saber: **el pozo central no crece**, es la suma de las apuestas. Lo que crece durante la partida es el peso de cada jugador y, con él, «su parte hoy» (se enseña en cada asiento y en el botón de cobrar).

## Solo contra el Dragón

Tercera modalidad, con el mismo motor de dados, la misma clasificación y el mismo dinero (`hipodromo_*`) que las otras dos, pero con reglas de partida propias (sección 12 del SQL).

- Apuestas una cantidad de tokens, tiras los tres dados y, tras cada tirada que no sea Ruina, **cobras o sigues**. Las cinco primeras tiradas son «seguras» (solo el riesgo de los dados, 4,63 %). **Después de la quinta se puede seguir tirando**, pero el Dragón carga los dados (ver «Más allá de la quinta tirada»).
- **Ruina:** pierdes el premio provisional y termina la partida. Ceniza: no cambia el premio. Pareja, escalera, triple y triple seis: lo suben.
- **Premio = apuesta × (1 − tributo) × (1 + suma de bonos)**, céntimos hacia abajo. Tributo del Dragón **5 %**, visible antes de apostar y sin otras comisiones. Bonos: pareja **+6,25 %**, escalera **+18,75 %**, triple **+37,5 %**, triple seis **+100 %** (la cuarta parte de la tabla propuesta).
- Solo dinero. No hay cartas: la casa no puede entregar cartas sin salirse de los límites y de la reserva de la economía de cartas.
- Una partida a la vez por jugador, y no se puede estar a la vez en una mesa. Recargar recupera la partida. Si te vas, a los 120 s se cierra sola: **sin tiradas se te devuelve la apuesta entera; con tiradas cobras lo que lleves**.

### Quién financia el premio (y por qué no se usó la tabla tal cual)

En solitario **paga la casa**: no hay otros jugadores, así que el juego crea tokens cuando ganas y los destruye cuando pierdes. Para que eso no sean recompensas sin respaldo, la tabla tiene que dejar a la casa una ventaja con la **mejor estrategia posible**. Cálculo exacto por programación dinámica (`node tools/pozo-dragon-solo.js`):

| Bonos | Tributo | RTP con juego óptimo | Cobrando siempre en la 1.ª tirada |
|---|---|---:|---:|
| Tabla propuesta (×1: 25/75/150/400 %) | 0 | **171,4 %** | 117,7 % |
| ×0,5 | 0 | 125,3 % | 106,5 % |
| ×0,25 (los del juego) | 0 | 102,6 % | 101,0 % |
| ×0,2 | 0 | 99,8 % | 99,8 % |
| **×0,25** | **5 %** | **97,49 %** | **95,91 %** |

- Con la tabla propuesta la casa regalaría de media un 71 % de la apuesta en cada partida: dinero creado de la nada.
- Solo con bonos habría que bajarlos a un 3 % (pareja 0,7 %, escalera 2,1 %...) para dejar un 4 % a la casa, y el pozo prácticamente no crecería. Por eso se combina un tributo visible con bonos a la cuarta parte.
- **Resultado:** ventaja mínima de la casa del **2,51 %** (con juego perfecto); 3 a 4 % para quien juega por intuición. Ninguna estrategia fija supera el 100 % (96–97 % con tributo). La estrategia óptima es seguir mientras el bono acumulado sea de hasta el 18,75 % y cobrar con el 25 % o más: hay decisión real.
- El pago máximo posible es **6×** la apuesta antes del tributo (cinco triples seis seguidos, probabilidad 2e-12).
- Todos los valores están en `cartas_economia_ajustes` (`pozo_solo_*`) para poder cambiarlos sin tocar código. La interfaz muestra los que manda el servidor en cada partida.

### Más allá de la quinta tirada
Se puede seguir tirando todo lo que quieras, pero **el peligro sube de forma exponencial** y **la pantalla no lo dice** (a propósito: se aprende jugando).
- Antes de cada tirada extra el servidor sortea una **Ruina forzada**: 8 % en la sexta, 16 % en la séptima, 32 %, 64 % y un tope del 95 % (ajustes `pozo_solo_peligro_inicial`, `pozo_solo_peligro_factor` y `pozo_solo_peligro_max`). Si sale, los dados enseñan una tirada de Ruina corriente (suma de 3 a 5, una de las diez posibles, al azar). Si no, se tiran normalmente (con su 4,63 % de siempre).
- **No hay información de más:** el estado del servidor no incluye el peligro, la tabla de probabilidades se oculta después de la quinta, la elección dice «El Dragón no avisa» en vez de un porcentaje y las reglas solo dicen que después de la quinta el Dragón no cuenta cuánto arriesgas. Los puntos de tiradas siguen creciendo y la etiqueta pasa de «Tirada 5 de 5» a «Tirada 6».
- **Economía:** `node tools/pozo-dragon-solo.js` lo comprueba con programación dinámica: tras la quinta tirada, seguir pierde valor esperado con cualquier bono acumulado (−7,1 % de la apuesta en el mejor caso), así que **el retorno óptimo sigue siendo el de las cinco tiradas (97,49 %)** y la casa no pierde nada con la regla.
- Después de la quinta ya no se cobra solo: se cobra cuando tú decides (o por abandono, como siempre).

### Sin tope de apuesta
El servidor no impone máximo en ninguna modalidad (`pozo_solo_apuesta_max` y `pozo_apuesta_max` valen 0 = sin máximo). Solo hay un mínimo, múltiplos de 10 y el saldo que tengas. Para que no parezca que hay un techo, las fichas rápidas llegan hasta 100 veces el mínimo y hay una ficha **Todo** que pone todo tu saldo (redondeado a múltiplos de 10).

### Contra pagos duplicados

- **Empezar** lleva un identificador nuevo por partida (`unique (user_id, cliente)`): repetirlo (doble clic, reintento tras un corte) devuelve la misma partida sin descontar otra vez. La apuesta se descuenta antes de crear la partida y en la misma transacción.
- **Tirar y cobrar** llevan el **paso** de la partida: una petición repetida no tira dos veces ni cobra dos veces.
- **El pago** lo hace `pozo_i_solo_cerrar`, que solo actúa si la partida sigue `en_curso` y la deja `terminada` en la misma transacción, bajo el candado del jugador. Una partida cerrada no se puede pagar otra vez.
- Un índice único deja **una sola partida en curso** por jugador.

## Desafíos: cartas por jugar
Mismo sistema que Las Veintiuna Velas (`docs/veintiuna.md`): el servidor cuenta lo que haces, cada desafío se completa y se reclama **una vez al día** y da una carta de Triunfos. Se reinician a las 00:00 UTC (lo completado y sin reclamar se pierde). Reutilizan el sistema oficial de recompensas: una fila en `cartas_juegos` (`pozo_dragon`, **encendida y con 2 cartas al día como máximo**, igual que Veintiuna hoy), `cartas_i_juego_terminar_nucleo` y los mismos topes, límites, circulación y reserva. Si no hay carta que dar, el desafío **no se gasta**. Bronce vale 1 («bueno»), plata 3 («excelente») y oro 4 («extraordinario»).

| Nivel | Desafío | Qué hay que hacer |
|---|---|---|
| Bronce | Una más | Tirar después de la quinta tirada en el solitario |
| Bronce | El diezmo del Dragón | Perder 500 tokens en Ruinas del solitario en un día |
| Bronce | Mala racha | Caer en Ruina tres veces seguidas en el solitario |
| Plata | Doble o nada | Cobrar un premio de al menos el doble de tu apuesta |
| Plata | Mil tokens al fuego | Apostar 1.000 tokens en total en un día en el solitario |
| Plata | Seis, seis, seis | Sacar un triple seis en el solitario |
| Plata | Sin red | Hacer tres tiradas después de la quinta en un día |
| Plata | Duelo limpio | Ganar un duelo 2 a 0 con dinero en juego |
| Oro | Todo o nada | Apostar el 90 % de tu saldo (mínimo 100) en una partida y cobrarla |
| Oro | Hasta el fondo | Cobrar después de ocho tiradas o más |
| Oro | Remontada imposible | Ganar un duelo con dinero en juego tras perder la primera ronda |
| Oro | Último en pie | Cobrar en una mesa compartida con dinero en juego en la que caen en Ruina al menos otros dos jugadores |

- **Cuenta solo con dinero en juego** (los duelos y mesas compartidas, con la apuesta mínima como mínimo) para que nadie los gane pactando gratis con un amigo; una partida en solitario devuelta sin tiradas no cuenta.
- Progreso en `pozo_progreso.contadores` (por día) y completados en `pozo_logros`; la definición en `pozo_logros_def`. Los ganchos están al cerrar una partida (`pozo_i_solo_cerrar`) y al terminar un duelo o una mesa compartida, protegidos para que un fallo de los desafíos nunca estropee un pago.
- En la página: botón **Desafíos** (con una insignia con los que puedes reclamar), un diálogo por niveles con barras de progreso y la misma pantalla de carta ganada que Las Veintiuna Velas (`js/recompensas.js`).
- Funciones públicas: `pozo_desafios()` y `pozo_reclamar(logro)`. Se pueden apagar o ajustar en Admin → Economía → Juegos y recetas.

## Dinero y cartas

- **Dinero:** los tokens del Hipódromo (`hipodromo_billeteras` / `hipodromo_movimientos`). La apuesta se **descuenta al confirmar** (el saldo disponible ya no la cuenta) y se abona al liquidar o devolver. Cada movimiento queda en el libro con el código de la mesa.
- **Cartas:** se bloquean con `cartas_i_bloquear` (referencia `pozodragon:<mesa>:<jugador>`, que la limpieza de huérfanos de la economía no toca) y cambian de dueño solo con `cartas_i_transferir`, que respeta los límites por jugador, por categoría y globales. Si una transferencia no es legal, la carta **vuelve a su dueño** (nunca se ignora un límite).
- **Tipos de apuesta:** solo dinero, solo cartas o mixta. Cada jugador pone la misma cantidad de dinero y el mismo **número** de cartas (0 a 3); no se exige igual valor de mercado: cada uno ve lo que arriesgan los demás antes de confirmar.
- **Confirmación:** tras cerrarse la inscripción, cada jugador ve las condiciones y confirma con la versión de condiciones que tenía en pantalla. Si entra o sale alguien o alguien cambia sus cartas, las condiciones cambian y **todos confirman otra vez** (lo reservado se devuelve). La reserva es atómica: saldo y cartas, o nada. Los cambios de cartas están limitados a 6 por sala. La partida no empieza si falta una confirmación o una reserva.
- **Cancelación:** sala vacía, vencida (30 min) o sin confirmar a tiempo (90 s): todo se devuelve.
- Sin comisiones.

## Arquitectura

| Pieza | Dónde |
|---|---|
| Tablas `pozo_mesas`, `pozo_jugadores`, `pozo_tiradas`, `pozo_rondas` (nadie las lee ni escribe desde el navegador; solo el admin puede mirarlas) | `docs/pozo-dragon.sql` |
| Dados (`gen_random_uuid`), clasificación, fuerza, turnos, reservas, liquidación, plazos | `docs/pozo-dragon.sql` |
| Funciones públicas del solitario: `pozo_solo_estado`, `pozo_solo_empezar`, `pozo_solo_tirar`, `pozo_solo_cobrar`, `pozo_solo_descartar` (tablas `pozo_solo` y `pozo_solo_tiradas`) | `docs/pozo-dragon.sql`, sección 12 |
| Funciones públicas de las mesas: `pozo_lista`, `pozo_crear`, `pozo_unirse`, `pozo_cerrar_inscripcion`, `pozo_ofrecer`, `pozo_confirmar`, `pozo_retirar_confirmacion`, `pozo_salir`, `pozo_tirar`, `pozo_cobrar`, `pozo_continuar`, `pozo_estado`, `pozo_mis_cartas` | `docs/pozo-dragon.sql` |
| Llamadas del navegador (`api.pozo.*`) | `js/veintiuna-api.js` |
| Textos, reglas y decisiones de pantalla (puro, probado en Node) | `js/pozo-dragon-vista.js` |
| Dibujos (dados, ojo del dragón, monedas) | `js/pozo-dragon-arte.js` |
| Controlador (lobby, sala, mesa, animaciones, sonido opcional, brasas) | `js/pozo-dragon.js` |
| Estilos | `css/pozo-dragon.css` |

- **Sin tiempo real:** el navegador pregunta por `pozo_estado(version)` cada 1,5 s (5 s con la pestaña en segundo plano); si no cambió nada recibe `{sin_cambios}`. Es el mismo patrón de la mesa con amigos de Las Veintiuna Velas: no se introdujo ninguna infraestructura nueva.
- **El cliente nunca manda dados ni resultados.** Las acciones de turno llevan el **paso** de la mesa que veía el jugador: repetirlas (clic doble, reintento tras un corte) no las aplica dos veces. Todo bajo un candado por mesa y otro por jugador.
- **Recuperación:** `pozo_estado` devuelve la mesa tal como está; recargar o desconectarse no devuelve una apuesta ni permite repetir una tirada.
- **Plazos sin que nadie mire:** cada llamada a `pozo_lista` y cada sondeo resuelven las mesas vencidas (salas que no empezaron, turnos agotados, mesas abandonadas). Si nadie abre el juego, una mesa colgada espera hasta que alguien lo haga.
- Las animaciones de los dados enseñan un resultado ya decidido (las caras al azar solo se ven mientras ruedan). Se respeta `prefers-reduced-motion`; el sonido es opcional y está apagable.
- Superficies planas, sin degradados dorados en los botones (ver la preferencia anotada).

## La presentación y la escena de cada tirada

Es solo presentación: la lógica, las apuestas, el servidor y los tres modos son los de siempre. Los resultados los decide el servidor; todo lo que se anima los enseña.

### El dragón
- Se dibuja por capas en `js/pozo-dragon-arte.js`, a partir de una ilustración de referencia (no se ha copiado ninguna imagen de terceros). Los degradados, las escamas y la mitad izquierda de la cara viven **una sola vez** en un `<svg>` oculto (`A.defs()`, no puede ser `display:none`) y cada dragón de la página es un `<use>` de ahí.
- Cada dragón son **dos capas**: el cuerpo, que nunca se anima, y los ojos (resplandor, iris, pupila rasgada, párpados), que son lo único que se mueve. Seguir al cursor o parpadear no repinta la cara.
- **Sin filtros ni desenfoques** (es lo que más pesa al pintar): el brillo son degradados radiales. Una prueba comprueba que no aparecen `<filter`, `feGaussianBlur`, `blur()` ni `drop-shadow`.
- Sus ojos siguen al cursor (pupila y iris con distinto recorrido, una sola escritura por fotograma). Con `prefers-reduced-motion` no se mueven. El cuerpo apenas se ve (ver más abajo).
- Dos tamaños: el grande del lobby (`A.dragonHeroe()`, con las alas abiertas) y la cara pequeña de la mesa (`A.dragonCara()`), encima del tapete.
- En la mesa **reacciona** (`data-e` del marco): *espera* (tranquilo, parpadea), *mira* (te toca: pupilas estrechas), *ruina* (ojos rojos de golpe, ruge), *premio* (ojos más vivos con una pareja, escalera o triple), *gran* (triple seis: late tres veces) y *cobro* (cierra los ojos mientras el oro viaja al saldo).

### Cada tirada es una secuencia de cinco momentos
1. **Decisión:** el jugador pulsa; mientras dura la escena no hay botones en pantalla («El Dragón observa los dados…»).
2. **Lanzamiento (~1,3 s):** tres cubos 3D de hueso (CSS 3D, sin librerías) caen desde arriba, chocan, rebotan tres veces y giran cada vez más despacio hasta quedar en su cara. Los puntos de cada cara son imágenes en línea.
3. **Revelación:** la combinación aparece con su propio tratamiento (nombre, color, barra de intensidad y dados teñidos: la Ruina es roja, la ceniza apagada, el triple seis dorado) y el dragón reacciona.
4. **Resolución:** el contador del premio sube o baja con suavidad, aparece un «+17,81» flotando y los discos del montón caen (o, con una Ruina, arden y suben hacia el dragón con monedas rojas).
5. **Elección:** vuelven los botones. Al cobrar, el dragón cierra los ojos, 12 monedas vuelan al saldo y el saldo cuenta hasta su valor.

La orquesta `pozo-dragon.js` (`teatro`, `teatroSolo`, `teatroMesa`) y las piezas están en `js/pozo-dragon-escena.js`. Funciona igual en los tres modos: el solitario, el duelo (cada lado tira sus dados) y el pozo compartido (cada tirada nueva, en orden).

- Se pinta primero el cuadro anterior, se anima y al final se pinta el del servidor: la animación nunca decide nada y siempre acaba en lo que dice el servidor.
- Lo que llegue del servidor mientras dura la escena espera en cola (`S.cola`) y se aplica al terminar. Si algo se atasca, a los 9 s la escena se salta sola; las animaciones y los contadores tienen además su propio límite de tiempo (una pestaña en segundo plano no deja la mesa colgada).
- **Se puede saltar** (clic en la mesa, Espacio, Intro o Escape) **y acelerar** (botón «Rápido», se recuerda). Con `prefers-reduced-motion`, o al recargar la página, no se anima nada y se pinta el cuadro final.
- Medido en el navegador: ~7 ms por fotograma en reposo, durante la tirada y moviendo el ratón sobre el dragón.

### La elección enseña el riesgo
- **Solitario:** dos tarjetas lado a lado. *Cobrar ahora* (lo que recibes y lo que ganas o pierdes respecto a tu apuesta) y *Seguir tirando* (4,63 % de Ruina con un medidor, lo que perderías, el premio con un triple seis y las tiradas que quedan).
- **Pozo compartido:** lo mismo con la parte que cobrarías ahora y tu peso.
- Las **probabilidades** van en un panel plegable (`<details>`, cerrado). En el solitario la tabla lleva ahora una columna «Bono» y otra «Premio resultante», y explica que el premio base es la apuesta menos el tributo y que cada bono es un porcentaje de ese base (p. ej. 10,09 → 10,68 con una pareja: 9,5 × (1 + 0,0625 + 0,0625)). `V.tablaSolo` y `V.tensionSolo` están probadas contra la fórmula del servidor.

### Solo se ven los ojos, y el ambiente
- **El cuerpo del dragón es una sombra casi invisible** (opacidad 0,02 en reposo): a plena vista solo se ven los ojos brillando en la oscuridad. La silueta se insinúa un instante con una Ruina (0,5), un triple seis (0,34) o un premio (0,08). La cara de la mesa y el dragón del lobby se comportan igual.
- **Los ojos respiran:** el resplandor late despacio (más rápido cuando te toca). Tras 5 s sin mover el cursor vuelven despacio al centro y parpadean; al mover el cursor siguen otra vez.
- **Humo de las fosas** al perder (con una Ruina o al perder una mesa): seis bocanadas que suben y se deshacen, hechas con círculos de degradado radial (sin filtros) y colocadas con el encuadre del dibujo (`data-vb`).
- **Viñeta:** al perder los bordes de la pantalla se oscurecen de golpe y se aclaran despacio; al ganar (triple, triple seis, cobrar) se ilumina un poco el centro.
- **Temblor** de la mesa con la Ruina y ahora también con el triple seis. **Sonido:** un gruñido grave acompaña a la Ruina.
- **Paneles tallados en la oscuridad:** filete interior y sombra hundida, y algo de transparencia para que se vea el humo del fondo. Sin `backdrop-filter` ni desenfoques: lagean en móviles.
- Todo se apaga con `prefers-reduced-motion`.

### La paleta: Vino y oro
Se probaron cinco paletas (Obsidiana y hielo, Esmeralda y latón, Vino y oro, Violeta arcano y Carbón y oro) y se eligió **Vino y oro**: fondos burdeos casi negros, oro y crema, ojos ámbar. El rojo de la Ruina, el verde de ganar y los colores de rareza no cambian. Una prueba comprueba que los fondos son vino (tono 330°–360°) y no marrón, y que el acento sigue siendo oro. Los colores están como variables en `body.pz-tema` (`css/pozo-dragon.css`), aunque muchos tonos del dibujo y de los efectos están escritos directamente en las hojas de estilo y en `pozo-dragon-arte.js`.

### El lobby y el fondo
- El solitario es el héroe (lema, apuesta con cinco fichas rápidas, riesgo en una línea y un botón grande). Duelo y Pozo Compartido quedan debajo, más pequeños, y abren su formulario en un panel común. Las reglas completas están en el panel de Reglas.
- Fondo oscuro y limpio con humo lento y brasas discretas; el grano y el relieve se reservan para el dragón, el tablero y el tesoro. Botones planos.
- **Foto propia opcional:** si existe `assets/cosas/pozo-dragon-heroe.webp`, sustituye al dibujo del dragón del lobby (si no está, se queda el dibujo).

## Pruebas

```bash
node docs/pruebas-web/pozo_dragon.js     # 120 comprobaciones sin base de datos
node tools/pozo-dragon-simulacion.js     # combinaciones y economía de las mesas (opcional: nº de mesas)
node tools/pozo-dragon-solo.js           # economía exacta del modo solitario (opcional: nº de partidas)
```

`pozo_dragon.js` comprueba: las 216 combinaciones y sus probabilidades, la jerarquía del Duelo (antisimetría sobre las 216 × 216 parejas), que el SQL tenga las mismas reglas que la interfaz, que **cada función pública del SQL empiece por el cierre «oculto»**, los textos, las vistas, la página y el controlador, y que la simulación termine bien con la suma pagada igual a la apostada.

```bash
sh docs/pruebas/cargar_local.sh todo && sh docs/pruebas/t_pozo_dragon.sh   # el SQL contra Postgres local: reglas, dinero, cartas, plazos, permisos y peticiones simultáneas
```

`t_pozo_dragon.sql` (142 comprobaciones) usa una cola de dados que solo existe en las pruebas para guionizar tiradas y comprobar los pagos al céntimo. Cubre:

- Las 216 combinaciones y la jerarquía del Duelo con las 216 × 216 parejas; que los dados salen parejos.
- **Oculto:** un jugador normal no puede llamar a ninguna función (lista, crear, unirse, mirar, tirar, solitario) mientras `pozo_dragon_publico` sea `false`, y no se descuenta ni se crea nada; el admin sí entra; abierto, entra todo el mundo.
- **Duelo:** crear, unirse, ofrecer cartas, confirmar (versión de condiciones, reserva atómica, devolución si el rival cambia sus cartas), fuera de turno, peticiones repetidas, ronda por ronda hasta el ganador, empate al límite, más rondas al límite, abandono por tres turnos perdidos, salir en pleno duelo, mesa abandonada, y **una carta que no se puede entregar por el límite del jugador vuelve a su dueño**.
- **Pozo Compartido:** reparto por peso al céntimo (81,81 / 218,19 de 300), Ruina, botín de cartas al superviviente de mayor peso, todos en Ruina, quien sale sin tirar, el jugador que sigue solo hasta la quinta tirada (105,89 / 94,11 de 200), tiempo agotado al decidir y mesa abandonada.
- **Salas:** cancelar, vencer, salir (reinicia confirmaciones y pasa el mando), inactividad, saldo que ya no alcanza, carta que dejó de ser tuya, tope de cambios y validaciones de apuesta.
- **Solitario:** empezar idempotente, apuesta descontada una vez, pareja y escalera, cobrar una sola vez, clic doble, Ruina, ya no hay cobro automático en la quinta (se puede seguir), la Ruina forzada creciente (determinista al 100 % y estadística al 8 % y 16 %), desafíos (los doce, el reinicio diario, duelo y compartido) y reclamar cartas (tope de dos al día), abandono (devuelta o cobro automático, una sola vez) y 3.000 partidas al azar (retorno 95,9–96,0 % cobrando siempre en la primera tirada, igual que la fórmula; la billetera cuadra con la suma de los netos).
- **Al azar:** 125 mesas compartidas de 2 a 6 jugadores y 60 duelos con cobros, Ruinas y tiempos agotados: el dinero total y las cartas cuadran siempre y no queda nada bloqueado ni sin liquidar.

`t_pozo_dragon.sh` añade los **permisos** (sin sesión no se llama a nada; las funciones internas y las tablas, ni leerlas ni escribirlas) y las **peticiones simultáneas** reales con varias sesiones: empezar dos veces, abrir dos partidas distintas, cobrar dos veces, tirar dos veces con el mismo paso, tres jugadores entrando a un duelo de dos, confirmar dos veces y tirar a la vez con el rival fuera de turno.

**Lo que encontraron las pruebas:** `pozo_crear` llamaba a `make_interval(mins => ...)` con un número decimal y habría fallado en cualquier creación de mesa. Está corregido. Lo demás eran errores de las propias pruebas.

Además, el SQL pasa el analizador de sintaxis de PostgreSQL (`libpg-query`): 101 sentencias y 59 cuerpos plpgsql.

La interfaz se probó en el navegador contra un servidor simulado con estados de ejemplo (lobby, sala, confirmación, mesa compartida, decisión, duelo, final, Ruina y cancelada): sin errores en consola, dados que ruedan y se asientan, y ningún elemento que se salga de la pantalla a 375 px de ancho.

## Qué falta

- **Correr `docs/pozo-dragon.sql` en Supabase** y probarlo con una sesión real y dos cuentas (admin): lo que no cubre Postgres local es el inicio de sesión, PostgREST y Realtime. Con eso hecho, el juego está listo para abrirse cuando el usuario lo diga.
- Probarlo con una sesión real de Supabase y dos cuentas.
- El selector de cartas es una lista sencilla (nombre, rareza, número), no la carta ilustrada del álbum.
- Sin sala pública para elegir rival en el duelo más allá de las mesas públicas y el código/enlace; sin chat ni clasificaciones (fuera de alcance).
- La limpieza de mesas colgadas depende de que alguien abra el juego (ver arriba).
- Decisiones documentadas donde el encargo era ambiguo: el pozo no crece (lo que crece es el peso), el jugador en solitario sigue tirando, y quien no tira ninguna vez sale sin participar.
