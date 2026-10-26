# La crónica del mundo

Una lista corta de lo que pasa en la taberna, escrita por el servidor y leída por todos: cartas raras ganadas, intercambios y crías (sin nombres), apuestas que pagan mucho, rachas y desafíos de oro de Veintiuna, copas del Hipódromo y las noticias que escribe el Admin. Sale en la pestaña **Crónica** del Tablón de la taberna (`index.html`), y una ficha en los avisos dice cuántas novedades hay desde la última vez que la abriste.

No sustituye a nada que ya existía: los **avisos** son personales (lo que te espera a ti), las **Novedades** son los cambios del sitio escritos a mano, `eventos_sitio` son los eventos con fechas del Admin y `hipodromo_noticias` cuenta el mundo de las criaturas. La crónica trata de lo que hacen los jugadores.

## Archivos

| Archivo | Para qué |
|---|---|
| `docs/cronica-1_base.sql` | Tablas `cronica_sucesos` y `cronica_tipos`, la función interna `cronica_i_anotar`, la lectura (`cronica_ver`, `cronica_contar`) y las funciones de Admin |
| `docs/cronica-2_disparadores.sql` | Ocho disparadores que anotan los sucesos solos. Cada uno se crea solo si su tabla existe |
| `js/cronica.js` | Las frases de cada tipo (plantillas con varias formas) y «hace 5 min» |
| `js/cronica-taberna.js` | La pestaña Crónica del Tablón |
| `js/avisos-taberna.js` | La ficha «La taberna: N novedades» (fuente `cronica()`) |
| `js/admin-cronica.js` | Pestaña «Crónica» del Admin (grupo «Contenido del sitio») |
| `docs/pruebas/t_cronica.sh` | 96 comprobaciones del SQL |
| `tools/probar-cronica.js` | Comprobaciones de las frases |

Orden en Supabase: `docs/cronica-1_base.sql` y después `docs/cronica-2_disparadores.sql` (después de la economía de cartas, el Hipódromo y Veintiuna; lo que falte se salta y se corre el archivo otra vez cuando exista). Se pueden repetir.

## Qué se anota y cuándo

| Tipo | Se anota cuando | Umbral (editable en Admin) | Nombre |
|---|---|---|---|
| `carta_ganada` | entra una fila en `cartas_registro` con origen `juego` (recompensas, sellos, forja) | rara o superior; 3 por jugador y día y el resto se junta en «ganó N cartas hoy». No cuentan compras al Buhonero, regalos del Admin ni crías | con nombre |
| `intercambio` | una oferta de `cartas_intercambios` pasa a `aceptada` | alguna carta rara o superior, o 3 cartas o más en total | anónimo |
| `cria_nacida` | una cría de `cartas_crias` pasa a `nacida` (al recogerla del corral) | rara o superior, o la primera de su especie en el mundo | anónimo |
| `apuesta_hipodromo` | una apuesta de `hipodromo_apuestas` pasa a `ganada` | paga 4 veces o más lo apostado y 200 tokens o más. Con «doble» solo cuenta el último eslabón, medido contra la apuesta inicial | con nombre |
| `apuesta_veintiuna` | una mano o mesa con apuesta termina en `veintiuna_partidas` | igual (4 veces y 200 tokens). Una mano individual paga como máximo 2,5 veces, así que solo salta en mesas con amigos de 4 o más | con nombre |
| `racha_veintiuna` | cambia `racha` en `veintiuna_estadisticas` | desde la 4.ª victoria seguida y hasta que pierde: **una sola línea viva** que se actualiza y se cierra al perder. Si supera la mejor racha de todos, es récord | con nombre |
| `logro_oro_veintiuna` | se completa un desafío de nivel oro (`veintiuna_logros`) | todos los de oro; como se reinician cada día, puede volver a salir mañana | con nombre |
| `copa_hipodromo` | se publica una carrera de copa o Gran Premio en `hipodromo_carreras` | solo criaturas con dueño humano | con nombre |
| `nota` | el Admin la escribe (`cronica_publicar`) | sin umbral | el DM |
| `partida_dificil` | (apagado) ganar a un rival difícil | esas partidas contra una IA las informa el navegador y sería falsificable | |

Los disparadores observan tablas de resultados que ya existen, así que **ninguna función de los juegos se ha tocado** y volver a correr un SQL antiguo no los quita. Cada uno atrapa sus errores: un fallo de la crónica nunca rompe el juego (hay una prueba que renombra la tabla para comprobarlo).

## Quién ve qué

- Cada suceso lleva el **Side** de quien lo hizo (si los dos de un intercambio son de Sides distintos, lo ven los dos). Solo lo ve ese Side, el Admin y quien tenga la excepción de `side_excepciones` (`side_ve_ambos()`, opcional). Las noticias del Admin pueden ir a un Side o a los dos.
- En los tipos **anónimos** (intercambios y crías) `cronica_ver` devuelve el usuario vacío a todos menos al Admin. La fila sí guarda quién fue, para auditar. Si el suceso te toca, la lista te lo marca como «te toca». Los datos de la fila llevan cartas, nunca nombres de personas.
- Un suceso no se enseña antes de su hora (`visible_desde`): una copa no se cuenta hasta que acaba la carrera, porque el resultado se guarda una hora antes.
- La lista oculta lo de más de 14 días (60 las noticias del Admin) sin borrarlo.
- Nadie lee ni escribe las tablas directo: todo pasa por funciones `security definer`.

## Añadir un tipo nuevo

1. Fila en `cronica_tipos` (en `cronica-1_base.sql`: nombre, juego, activo, umbrales).
2. Un disparador en `cronica-2_disparadores.sql` que llame a `cronica_i_anotar(tipo, usuario, otro, side, datos, clave, enlace)`. La `clave` evita anotar dos veces lo mismo.
3. Una frase en `js/cronica.js` (`FRASES`, `ICONOS`) y el nombre en `js/admin-cronica.js` (`NOMBRES`). `node tools/probar-cronica.js` falla si un tipo sembrado no tiene frase.
4. Pruebas en `docs/pruebas/t_cronica.sh`.

## Probarla

- SQL: `BD=cronica sh docs/pruebas/cargar_local.sh todo && BD=cronica sh docs/pruebas/t_cronica.sh` (usa su propia base para no chocar con otras sesiones).
- Frases: `node tools/probar-cronica.js`.
- Taberna: `index.html?cronica=prueba` enseña sucesos de ejemplo sin sesión; `?avisos=prueba` incluye la ficha de las novedades.

## No hecho todavía

- La cinta de arriba de la taberna (`#lbTicker`) no mezcla sucesos con las novedades.
- La página completa `cronica.html` (El Registro: rivalidades, récords y campeones).
- Ganar a un rival difícil de ajedrez queda apagado hasta que el servidor confirme el resultado.
- Cartas ganadas en el pozo de Veintiuna o en apuestas de cartas entre jugadores (pasan por `cartas_movimientos`, no por `cartas_registro`).
- Avisar por Discord: ver las ideas en la propuesta de integración con el bot.
