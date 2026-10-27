# El Pozo del Dragón

Juego de dados con apuestas de tokens y cartas entre jugadores (`pozo-dragon.html`). Dos modalidades en un mismo motor: **Duelo de Dragones** (dos jugadores) y **El Pozo Compartido** (de dos a seis).

**Estado (27 de octubre de 2026): OCULTO.** Solo lo ve y lo juega el admin, por orden del usuario, hasta que diga lo contrario. Y el SQL **no se ha ejecutado todavía contra Postgres**: se comprobó la sintaxis con el analizador real de PostgreSQL y se revisó la lógica a mano, pero faltan sus pruebas con Docker (ver «Qué falta»).

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
| Funciones públicas: `pozo_lista`, `pozo_crear`, `pozo_unirse`, `pozo_cerrar_inscripcion`, `pozo_ofrecer`, `pozo_confirmar`, `pozo_retirar_confirmacion`, `pozo_salir`, `pozo_tirar`, `pozo_cobrar`, `pozo_continuar`, `pozo_estado`, `pozo_mis_cartas` | `docs/pozo-dragon.sql` |
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
node docs/pruebas-web/pozo_dragon.js     # 80 comprobaciones sin base de datos
node tools/pozo-dragon-simulacion.js     # combinaciones y economía (opcional: nº de mesas)
```

`pozo_dragon.js` comprueba: las 216 combinaciones y sus probabilidades, la jerarquía del Duelo (antisimetría sobre las 216 × 216 parejas), que el SQL tenga las mismas reglas que la interfaz, que **cada función pública del SQL empiece por el cierre «oculto»**, los textos, las vistas, la página y el controlador, y que la simulación termine bien con la suma pagada igual a la apostada.

El SQL se comprobó con el analizador de PostgreSQL (`libpg-query`): 72 sentencias y 47 cuerpos plpgsql sin errores de sintaxis.

La interfaz se probó en el navegador contra un servidor simulado con estados de ejemplo (lobby, sala, confirmación, mesa compartida, decisión, duelo, final, Ruina y cancelada): sin errores en consola, dados que ruedan y se asientan, y ningún elemento que se salga de la pantalla a 375 px de ancho.

## Qué falta

- **Ejecutar el SQL con Docker** (`sh docs/pruebas/cargar_local.sh todo`, que ya carga `pozo-dragon.sql`) y escribir `docs/pruebas/t_pozo_dragon.sql`. Lo más importante que probar: reserva y devolución de dinero y cartas, una carta que no se puede comprometer en dos partidas, transferencias que topan con un límite, doble clic y peticiones simultáneas, fuera de turno, desconexión, recarga, cancelaciones, abandono y la suma pagada igual a la apostada con partidas al azar. Hasta que eso pase, **no abrirlo a jugadores**.
- Probarlo con una sesión real de Supabase y dos cuentas.
- El selector de cartas es una lista sencilla (nombre, rareza, número), no la carta ilustrada del álbum.
- Sin sala pública para elegir rival en el duelo más allá de las mesas públicas y el código/enlace; sin chat ni clasificaciones (fuera de alcance).
- La limpieza de mesas colgadas depende de que alguien abra el juego (ver arriba).
- Decisiones documentadas donde el encargo era ambiguo: el pozo no crece (lo que crece es el peso), el jugador en solitario sigue tirando, y quien no tira ninguna vez sale sin participar.
