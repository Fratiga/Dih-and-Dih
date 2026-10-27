# El Pozo del Dragón

Juego de dados con apuestas de tokens y cartas entre jugadores (`pozo-dragon.html`). Tres modalidades en un mismo motor de dados: **Solo contra el Dragón**, **Duelo de Dragones** (dos jugadores) y **El Pozo Compartido** (de dos a seis).

**Estado (27 de octubre de 2026): OCULTO.** Solo lo ve y lo juega el admin, por orden del usuario, hasta que diga lo contrario. El SQL está **probado contra Postgres local** (Docker, 142 comprobaciones más las peticiones simultáneas y los permisos, ver «Pruebas»), pero todavía no con una sesión real de Supabase.

## Cómo está escondido

- `pozo-dragon.html` lleva `js/oculto.js` el primero del `<head>`: quien no sea admin vuelve a Minijuegos.
- Solo aparece en «En pruebas» de Minijuegos (tarjeta «Solo admin»). No está en el lobby, ni en la taberna, ni como tarjeta pública.
- **El servidor también lo cierra:** cada función pública empieza con `pozo_i_acceso()`, que exige sesión y, mientras el ajuste `pozo_dragon_publico` sea `false`, que quien llama sea admin.

Para abrirlo a todos (solo cuando el usuario lo diga):

1. Correr `docs/pozo-dragon.sql` en Supabase y probarlo con dos cuentas (admin).
2. `update cartas_economia_ajustes set valor = 'true' where clave = 'pozo_dragon_publico';`
3. Quitar `<script src="js/oculto.js...">` de `pozo-dragon.html`, pasar la tarjeta de `JUEGOS` (en «En pruebas») a una tarjeta normal de `minijuegos.html` y, si se quiere, ponerlo en el lobby (`js/lobby-salas.js`).
4. Subir la versión (`?v=`) de lo que se toque.

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

- Apuestas una cantidad de tokens, tiras los tres dados y, tras cada tirada que no sea Ruina, **cobras o sigues**. Máximo cinco tiradas: en la quinta sin Ruina **cobras solo**.
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

### Contra pagos duplicados

- **Empezar** lleva un identificador nuevo por partida (`unique (user_id, cliente)`): repetirlo (doble clic, reintento tras un corte) devuelve la misma partida sin descontar otra vez. La apuesta se descuenta antes de crear la partida y en la misma transacción.
- **Tirar y cobrar** llevan el **paso** de la partida: una petición repetida no tira dos veces ni cobra dos veces.
- **El pago** lo hace `pozo_i_solo_cerrar`, que solo actúa si la partida sigue `en_curso` y la deja `terminada` en la misma transacción, bajo el candado del jugador. Una partida cerrada no se puede pagar otra vez.
- Un índice único deja **una sola partida en curso** por jugador.

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
- **Solitario:** empezar idempotente, apuesta descontada una vez, pareja y escalera, cobrar una sola vez, clic doble, Ruina, cobro automático en la quinta, abandono (devuelta o cobro automático, una sola vez) y 3.000 partidas al azar (retorno 95,9–96,0 % cobrando siempre en la primera tirada, igual que la fórmula; la billetera cuadra con la suma de los netos).
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
