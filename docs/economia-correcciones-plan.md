# Economía de cartas: plan de correcciones (12 de octubre de 2026)

Estado: **nada de esto está aplicado en producción**. Hay tres migraciones de SQL en `docs/` (probadas en local) y este plan. Las recompensas de cartas siguen apagadas (`cartas_juegos.activo = false` en los cuatro juegos) desde que lo pediste.

## 1. Entorno de pruebas: Postgres local en Docker (gratis)

Una rama de Supabase habría nacido sin tablas ni funciones (el proyecto solo tiene 3 migraciones registradas; casi todo se aplicó pegando SQL) y cuesta dinero, así que se descartó. Las pruebas corren en un **Postgres 17 local en Docker** con un Supabase simulado (roles `anon` y `authenticated`, esquema `auth`, `auth.uid()` leyendo la sesión simulada). No toca producción, no cuesta nada y permite abrir varias conexiones reales a la vez.

- El esquema base se leyó del catálogo de producción (solo estructura, sin datos de jugadores) y las funciones de `economia-1` a `economia-6` se cargaron desde el repositorio.
- Se comprobó función por función contra producción: 70 funciones, 51 idénticas al carácter, 13 que solo difieren en comentarios o variables sin usar (misma lógica, verificado), y 8 que no están en el repositorio (viejas funciones del editor y del combate) y no se necesitan para las pruebas.
- Cómo usarlo: `docs/pruebas/README.md`.

### Resultados

| | Código actual de producción | Con las correcciones |
|---|---|---|
| Comprobaciones que pasan | 140 de 231 (sin la batería de explotación, añadida después) | 243 de 243 |
| Comprobaciones que fallan | 91 | 0 |
| Interbloqueos en el estrés | n/a | 0 |

Lo que se reproduce hoy con el código de producción, con dos conexiones reales a la vez:

- **A2**: dos compras al mercader con las mismas tres cartas dan **dos cartas del mercader por una entrega**. La auditoría no lo detecta.
- **A3**: un intercambio mueve una copia que sigue ofrecida en otro intercambio abierto; el segundo intercambio queda abierto sobre una copia que ya es de otro.
- **A9**: cinco compras, cinco forjas y ocho ofertas simultáneas **se saltan** los topes de 3, 3 y 5.
- **A1**: un reto con `p_cartas` inventado guarda las cartas falsas (ataque 99, nombre «HACK», una carta que no existe), y quien acepta pisa las cartas del retador con las suyas (77 y 88).
- **Regla de silencio actual**: con un solo aviso y el otro callado, a los pocos minutos la partida **se resuelve a favor de quien avisó** y se lleva las cartas del otro.
- **A7**: un jugador cambia su Side de A a B, se borra el perfil y toma el nombre de otro jugador (también con otras mayúsculas).
- **A10**: cualquier jugador puede llamar a `cartas_mazo_error` sobre otro usuario y saber qué cartas le faltan; las funciones internas existen y las tablas conservan permisos de escritura (RLS las frena, pero es la única barrera).
- **A6**: leído en el código; el editor no se puede probar en «antes» porque la `cartas_guardar` anterior no está en el repositorio.

Lo que encontraron las pruebas en mis propios borradores: `cartas_guardar` fallaba para el editor (`text[] || 'rareza'` se interpretaba como literal de array). Corregido en `economia-8_permisos.sql` con `array_append`.

Lo que **no** cubre el entorno local: el navegador con sesión real de Supabase, y la versión exacta de Auth y PostgREST. Por eso, antes de declarar el sistema listo, hay que repetir el reto con apuesta, el intercambio, el mercader y la forja con dos navegadores reales en la web publicada.

## 2. Cambios previstos

Se aplican en este orden, cada archivo como una migración registrada (así queda en la historia de Supabase):

1. `economia-7_integridad.sql` (A1, A2, A3, A9, A11 y regla de silencio)
2. `economia-8_permisos.sql` (A6, A7, A10)
3. `economia-9_panel_admin.sql` (funciones del panel)
4. `economia-10_verificacion.sql` (avisos falsos y abandono, ver sección 7)
5. `economia-11_en_circulacion.sql` (etiqueta «En circulación»: una carta que no lo está no sale por recompensas, forja, reserva ni escaparate del mercader, aunque esté publicada y sea ganable; solo la pone el admin; las cartas nuevas nacen fuera)
6. La Edge Function `cartas-verificar` (`docs/cartas-verificar.ts`) y los cambios de navegador (panel, aviso de nombre repetido, estado de las partidas canceladas, columna «En circulación»).

| Hallazgo | Corrección | Qué cambia para un jugador |
|---|---|---|
| **A1** | `cartas_retar` y `cartas_responder` construyen las estadísticas con `cartas_i_instantanea` (desde `cartas_definiciones` y el catálogo). El parámetro `p_cartas` se conserva en la firma pero se ignora. Al aceptar, `cartas = nuevas \|\| cartas`: lo ya guardado del retador manda. En duelos con apuesta, además, el mazo debe estar respaldado por copias reales, también para admin y editores. | Nada visible |
| **A2** | Mercader, forja e intercambios llaman a `cartas_i_exigir`: con el candado del jugador y las filas bloqueadas comprueban dueño, estado y (si están bloqueadas) la operación que las retiene. `cartas_i_retirar` ya no acepta copias que están en reserva, en el mercader o destruidas. | Un doble envío da el error «Alguna de las cartas ya no está disponible» en vez de duplicar la carta |
| **A3** | `cartas_i_mover_forzado` solo mueve copias libres o bloqueadas por el mismo intercambio, y nunca borra el bloqueo de otra operación. `cartas_i_transferir` exige que la referencia del bloqueo coincida. | Nada visible |
| **A6** | `cartas_guardar` solo deja al admin cambiar rareza, tipo, lado, `obtenible` y límite global de una carta existente. Si un editor intenta cambiarlos, se conservan los actuales y la respuesta lista los campos ignorados. Una carta nueva de un editor nace con límite vacío y no obtenible. | El editor sigue editando nombre, texto, coste, ataque, imagen y formas |
| **A7** | Disparador en `perfiles`: el Side no cambia una vez elegido (excepto el admin, como ya prevé la interfaz). Nombre de usuario único sin distinguir mayúsculas, de 2 a 30 caracteres. La política que permitía `DELETE` del propio perfil se sustituye por tres (leer, crear y actualizar el propio). | Elegir un nombre ya usado da «Ese nombre de usuario ya está en uso» |
| **A9** | Candado por jugador (`cartas_i_candado_jugador`) en forja, mercader, intercambios, inicio y fin de partida de recompensas, retos con apuesta y aceptación. Las funciones públicas de forja, oferta y recompensas se envuelven; el original pasa a `cartas_i_*_nucleo`. | Nada visible |
| **A10** | Se quita el permiso de ejecución a quien no ha iniciado sesión en todas las funciones de cartas (salvo `cartas_puede_editar` y `cartas_es_editor`, que usan las políticas de lectura), se cierran a los navegadores las funciones internas (`cartas_i_*`, `cartas_mazo_error`, etc.) y se quitan escrituras directas a las tablas `cartas_*`, `perfiles` (borrar) y `fichas_admins`. | Nada visible |
| **A11** | Regla de silencio, bloqueos huérfanos y panel (ver sección 3). | Una apuesta atascada se devuelve sola |

### Regla de silencio de las apuestas (según tu propuesta)

- Si solo uno de los dos avisa un resultado y el otro no lo confirma en **24 horas**, la apuesta se devuelve (`estado = 'cancelada'`, `motivo = 'tiempo'`). **Nadie gana por avisar primero.**
- Si los dos avisan lo mismo, se resuelve al momento. Si discrepan, pasa a disputa y la resuelve el admin. Declararse perdedor sigue siendo definitivo.
- El plazo se lee de `cartas_economia_ajustes` (`apuesta_silencio_horas`) y se cambia desde el panel.

### Recuperación de bloqueos atascados

- Cada vez que alguien abre el lobby, el servidor suelta los bloqueos cuya apuesta o intercambio ya terminó o no existe. Soltar es idempotente (solo toca copias en estado `bloqueada`), así que no se devuelve dos veces ni se mueve una copia que ya cambió de dueño.
- Una apuesta activa nunca se suelta a mano desde los bloqueos; se resuelve o se cancela por su vía, que devuelve las cartas una sola vez.
- Si al repartir una apuesta falla una carta por un motivo inesperado, la partida queda en disputa con una incidencia. Antes ese error se tragaba en silencio y la carta volvía a su dueño sin aviso.

## 3. Panel de administración (solo admin)

Funciones nuevas en `economia-9_panel_admin.sql`, todas con `fichas_es_admin()` por dentro:

- `cartas_admin_apuestas()`: disputas, avisos sin confirmar, partidas sin avisos y retos sin respuesta, con cuándo se devolverán.
- `cartas_admin_partida(id)`: la partida completa para revisar una disputa.
- `cartas_admin_resolver_apuesta(id, resultado)`: ya existía; ahora deja constancia.
- `cartas_admin_bloqueos()` y `cartas_admin_liberar_bloqueos(referencia, motivo)`.
- `cartas_admin_incidencias()` y `cartas_admin_cerrar_incidencia(id)`.
- `cartas_admin_juegos()` y `cartas_admin_guardar_juego()` (ya existían) y `cartas_admin_recetas()` y `cartas_admin_guardar_receta()` (ahora con validación).

La interfaz (nuevas vistas en la pestaña «Economía de cartas» de `admin.html`) se escribe cuando el SQL pase las pruebas, para no maquetar sobre funciones que cambien.

## 4. Riesgos de migración

| Riesgo | Efecto | Mitigación |
|---|---|---|
| Las funciones se sustituyen con `create or replace` | Un fallo a medias dejaría mezcla de versiones | Cada archivo se aplica como una sola migración (transacción única); antes se guarda un volcado de las funciones y políticas actuales en `docs/rollback/` |
| Las funciones envueltas se renombran (`cartas_i_*_nucleo`) | La función original conservaría su permiso para el navegador y se saltaría el candado | El archivo revoca el permiso del núcleo en la misma migración; la prueba de permisos lo comprueba |
| Quitar permisos a quien no ha iniciado sesión | Una página que llame a una función sin sesión empezaría a fallar | Revisadas todas las llamadas del código: solo `cartas_es_editor` se usa sin sesión y se conserva; la prueba de regresión carga cada página con y sin sesión |
| Quitar escrituras a las tablas | Un flujo no documentado dejaría de escribir | Ninguna tabla de cartas tiene política de escritura, así que ese flujo ya fallaba hoy; se comprueba también `perfiles` (registro, Side, nombre) |
| Índice único del nombre | Fallaría si hubiera nombres repetidos | Hoy hay 14 perfiles y ninguno repetido; el archivo renombra los repetidos (`nombre (2)`) antes de crear el índice |
| Disparador del Side | Podría bloquear el alta de cuentas nuevas | Pasar de vacío a A o B está permitido; la prueba de regresión cubre el registro completo |
| Candados nuevos | Dos operaciones cruzadas pueden provocar un interbloqueo | Orden fijo (jugadores, cartas, filas). Si Postgres aun así aborta una, no se pierde nada y el navegador puede reintentar |
| Datos existentes | Ninguna migración reescribe cartas, ejemplares ni movimientos (hoy hay 0 ejemplares) | Auditoría `cartas_auditoria()` antes y después |

## 5. Pruebas

Todas en el entorno local (sección 1), con usuarios inventados. Ninguna toca datos de jugadores. Código en `docs/pruebas/`.

| Batería | Estado | Qué cubre |
|---|---|---|
| Regresión | pasa (59 comprobaciones) | Regalar y quitar, reserva y límites, intercambio completo, cancelado, caducado y con errores, límite por jugador al intercambiar, mercader, forja con éxito, fallo y sin salida, defensas internas del núcleo, recompensas encendidas en la copia local |
| Dos sesiones concurrentes | pasa | Dos compras al mercader con las mismas cartas (A2), aceptar un intercambio con una copia ofrecida en otro (A3) |
| Topes diarios | pasa | 5 compras y 5 forjas a la vez contra el tope de 3, 8 ofertas contra el tope de 5, dos forjas con las mismas cartas (A9) |
| Permisos | pasa (87 comprobaciones) | Sin sesión, jugador, editor y admin: funciones de admin, funciones internas, escrituras directas, Side, nombre, editor de cartas, validación de recetas y ajustes (A6, A7, A10) |
| Apuestas | pasa (59 comprobaciones) | Cartas del duelo desde las definiciones (A1), avisos iguales y de empate, disputa y resolución del admin, regla de 24 horas, 72 horas sin avisos, plazo cambiado por el admin, concesión, reto sin respuesta, bloqueos huérfanos, liberación por el admin, editor sin cartas (A11) |
| Explotación | pasa | Cada receta pierde valor de media; el mercader cobra siempre más de lo que vale la carta; dos cuentas colaborando no crean valor; 45 operaciones aleatorias donde el valor total nunca sube (subió 0 veces, bajó 6) |
| Estrés | pasa | Más de 120 operaciones aleatorias simultáneas de cuatro jugadores: 0 interbloqueos, ninguna carta perdida o duplicada, auditoría limpia, todos dentro de su límite |

Por hacer:

- **Sesiones reales**: el reto con apuesta, el intercambio, el mercader y la forja con dos navegadores sobre la web publicada. Hasta que eso se haga y se vea en pantalla, **no se declara el sistema listo para el lanzamiento**.
- Aceptar el mismo intercambio desde dos sesiones a la vez, y avisar el mismo resultado de una apuesta desde dos sesiones a la vez: están cubiertos por el candado de los jugadores y por el `for update` de la fila, pero no tienen batería propia.
- Reparto de recompensas con la carta agotándose a mitad, cuando se reactiven.

### Explotación: lo que midieron las pruebas (sin cambiar costes)

- No hay ciclo que cree valor. La forja siempre pierde (fundir comunes 5 → 2, alquimia 6 → 2,8 esperado, contrapeso 8 → 1,8). El mercader conserva el valor total, pero el jugador pierde al menos 1 en cada cambio.
- **La diferencia de precio es grande**: por la forja una rara cuesta de media 3,5 poco comunes, unas **17,5 comunes**; por el mercader cuesta **4 comunes** si ese día la tiene en el escaparate. Es unas 4,4 veces más barato. Lo frena que el mercader solo vende lo que otros le han dado (o la reserva), muestra como mucho 6 ofertas al día y cada jugador hace 3 cambios al día. Decisión tuya si quieres igualarlos.
- La forja y los jugadores pueden agotar la capacidad de emisión de las raras (cada forja con éxito emite una copia nueva y las destruidas no liberan hueco).

## 6. Recompensas (fase 2) y A4

Siguen apagadas hasta que el álbum y los flujos estén probados. No se borra ninguna recompensa ni carta.

Hoy los cuatro juegos corren enteros en el navegador y el servidor solo recibe «gané» y una puntuación. Propuesta por juego para no dar cartas por resultados que el servidor no puede verificar (leído el código de cada uno):

| Juego | Cómo funciona hoy | Qué se puede validar | Qué exige rediseñar |
|---|---|---|---|
| **Arquería** | Blancos con generador de semilla (los mismos en los dos navegadores en partidas entre jugadores); disparo con clic, puntúa la cercanía al centro; rival simulado | **La más viable.** El servidor entrega la semilla al empezar; el navegador manda la lista de disparos (posición y tiempo) y una Edge Function recalcula los blancos y la puntuación | Que el puntaje del rival simulado también salga de la semilla (hoy usa `Math.random` en parte) |
| **Ajedrez contra la casa** | Reglas y IA en el navegador; la IA usa `Math.random` sin semilla | Que cada jugada sea legal y que la partida acabe de verdad en mate o tablas, con la lista de jugadas y una librería de ajedrez en una Edge Function | La fuerza del rival: el navegador puede jugar contra una IA más débil que la declarada. Hay que mover la IA al servidor o hacerla reproducible desde una semilla |
| **Duelo contra la casa** | Duelo de reflejos en tiempo real (atacar, bloquear, esquivar) con IA que reacciona; no usa el motor de cartas; `Math.random` sin semilla | Solo plausibilidad: duración mínima, que una victoria exija un tiempo razonable | Simulación determinista con semilla del servidor y registro de entradas con marcas de tiempo para volver a jugarla. Es el más caro de verificar |
| **Hooey (racha)** | Oleadas que caen a velocidad fija; la racha es el número de aciertos seguidos | Cota de plausibilidad (la racha no puede superar los segundos jugados dividido entre el intervalo de las oleadas) | Oleadas desde una semilla del servidor y registro de cada acierto con su marca de tiempo. Sin eso, la racha es falsificable |

Recomendación: mientras un juego no tenga validación completa, que dé como mucho **sellos** (están acotados por los topes diarios) y no cartas por tramo. El orden de menor a mayor esfuerzo es arquería, ajedrez, Hooey y duelo.

## 7. Avisos falsos y abandono: verificar con el registro de la partida

Corrección a lo que dije antes: un cliente modificado **no** puede ganar mandando jugadas ilegales. El motor ignora una acción que no vale igual en todos los navegadores (`M.reproducir`), y `cartas_accion` ya comprueba de quién es el turno. El registro de acciones guardado en `cartas_partidas` es la verdad: cualquiera que lo repita con la semilla, los mazos y las cartas guardadas obtiene el mismo ganador. Lo único que hoy cree el servidor sin comprobar es lo que cada jugador **avisa** al final.

Qué hay hecho (todo probado en local, sin desplegar):

- `js/cartas-verificar.js`: vuelve a jugar el registro y devuelve un veredicto (terminada con ganador, abandono, en juego o error). Funciona en el navegador, en Node y en el servidor. `node tools/probar-verificacion.js`: 906 comprobaciones sobre 120 partidas completas al azar (el veredicto siempre coincide con el ganador real, un registro con acciones inventadas da el mismo resultado, y un aviso falso queda al descubierto) y 60 partidas cortadas (abandono tras el plazo).
- `docs/economia-10_verificacion.sql`: `cartas_i_aplicar_verificacion`, que solo puede llamar el servidor. Reparte las cartas una sola vez, es idempotente, y anota en las incidencias quién avisó algo desmentido y quién abandonó (el panel lo suma por jugador).
- `docs/cartas-verificar.ts`: la Edge Function que lo une. La pueden llamar los dos jugadores y el admin con su sesión.
- Navegador: `js/batalla.js` la llama sola cuando hay una disputa, un aviso sin confirmar a los 2 minutos o una partida parada 6 horas, y justo después de avisar un resultado. El panel tiene «Qué dice el registro» y «Resolver según el registro».

Cómo queda cada trampa:

| Trampa | Antes | Ahora (con la función desplegada) |
|---|---|---|
| Avisar que ganó sin haber ganado | Disputa para el admin, o ganaba si el otro callaba | El registro decide al momento; el que mintió no gana nada y queda anotado |
| Perder y no avisar | La apuesta se devolvía a las 24 h y el que perdió no perdía nada | Si el registro dice que perdió, pierde; no hace falta que avise |
| Desaparecer a mitad de partida | A las 72 h se devolvía | Pierde por abandono quien tenía que actuar y lleva más de `apuesta_turno_horas` (48 h por defecto) sin hacerlo |
| Abandonar para no perder | Sin consecuencias | Igual que el anterior |
| Jugadas ilegales | Ignoradas, sin efecto | Igual |

Qué sigue sin cubrir:

- Si la función no está desplegada o falla, valen las reglas de tiempo de economia_7 (disputa para el admin y devolución a las 24 y 72 horas).
- **Versión del motor**: la función repite la partida con el motor del commit que se fije al desplegarla. Si cambias `js/cartas-motor.js`, `cartas-efectos.js` o `cartas-vinculos.js` hay que actualizar ese commit, o se repetirían las partidas con reglas distintas a las que vieron los jugadores. Los vínculos del servidor (tabla `cartas_vinculos`) se leen en el momento de repetir: editarlos con una partida apostada en marcha podría cambiar su resultado.
- Pasarse cartas entre dos cuentas propias: acotado por los límites, no impedible.
- Lo mismo para las recompensas de los minijuegos contra la casa (sección 6) sigue pendiente: esos juegos no tienen registro que repetir.

## 8. Decisiones que te corresponden

1. **Horas para perder por abandono** (`apuesta_turno_horas`): propongo 48. Quien tiene que actuar y no lo hace en ese plazo pierde la partida y las cartas apostadas. Es el número que más afecta a jugar con calma; se cambia desde el panel sin tocar código.
2. **Inactividad sin ningún aviso**: propongo 72 horas hasta devolver la apuesta (`apuesta_inactividad_horas`). Solo se usa si la función de verificación no está o no puede decidir.
3. **Disputas sin resolver**: con la verificación desplegada casi no deberían quedar; las que sí (error de la función) esperan al admin sin límite. ¿Se devuelven solas pasado un plazo (por ejemplo 14 días)?
4. **Editores y cartas nuevas**: una carta que crea un editor nace sin límite, no obtenible y ahora **fuera de circulación**. ¿Quieres que además quede sin publicar hasta que la revises?
5. **Campos que se protegen a los editores**: rareza, tipo, lado, obtenible y límite global. El tipo y el lado no estaban en tu lista, pero cambian el límite por jugador y a quién le sale la carta.
6. **Etiqueta «En circulación»**: todas las cartas que ya existen quedan **fuera** hasta que las marques (Admin > Economía de cartas, con selección por lotes). Es lo más seguro: nada se cuela. El efecto es que, al encender las recompensas, no saldrá ninguna carta hasta que marques las que estén listas.
7. **Desplegar la función de verificación**: hay que fijar el commit del motor y desplegar con la cuenta de Supabase. Lo hago yo cuando lo apruebes.
8. **Forja que gasta capacidad de emisión** y **mercader más barato que la forja**: documentados, sin cambios.
9. **Límites globales provisionales**: sin tocar. Siguen pendientes de tu revisión.

## 9. Cómo se aplicaría en producción (cuando lo apruebes)

Nada de esto se ha hecho. Orden previsto:

1. **Copia de seguridad de lo que se va a sustituir**: volcado de las funciones afectadas (incluida la `cartas_guardar` actual, que no está en el repositorio), de la política de `perfiles` y de los permisos de tablas y funciones, guardado en `docs/rollback/`.
2. **Tres migraciones registradas** (`apply_migration`), una por archivo y cada una en una sola transacción: `economia_7_integridad`, `economia_8_permisos`, `economia_9_panel_admin`. Hoy la base está vacía de ejemplares, movimientos y bloqueos, así que ninguna reescribe datos de jugadores. Lo único que toca filas es el índice único de nombres (hoy 14 perfiles, ninguno repetido).
3. **Comprobaciones solo de lectura**: que las huellas de las funciones coincidan con las del entorno local, que `anon` no pueda ejecutar las funciones cerradas, que las políticas y disparadores estén y que `cartas_auditoria()` devuelva vacío.
4. **Deshacer**: volver a cargar los archivos `economia-1` a `economia-6` restaura las funciones tal como estaban (los envoltorios se sustituyen por los originales), y el volcado de `docs/rollback/` restaura `cartas_guardar`, la política de `perfiles` y los permisos. El núcleo renombrado (`cartas_i_*_nucleo`) y las funciones nuevas se pueden borrar sin consecuencias.
5. **Páginas**: los cambios de navegador ya están publicados y son compatibles con las dos versiones del servidor (las vistas nuevas del panel muestran «No se pudo cargar» hasta que exista la función). Tras la migración, un cambio posterior puede dejar de enviar las estadísticas de las cartas en los retos (ahora se ignoran).
6. **Sesiones reales**: con cuentas de prueba o con tu cuenta de admin, un reto con apuesta, un intercambio, el mercader y la forja en dos navegadores sobre la web publicada. Eso crea datos en producción, así que lo haríamos juntos y con cuentas inventadas que luego se borran, o lo dejas tú para cuando quieras.
