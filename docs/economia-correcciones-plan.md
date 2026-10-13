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
| Comprobaciones que pasan | __PROD_OK__ | __TODO_OK__ |
| Comprobaciones que fallan | __PROD_FALLA__ | 0 |
| Interbloqueos en el estrés | n/a | 0 |

Lo que se reproduce hoy con el código de producción, con dos conexiones reales a la vez:

- **A2**: dos compras al mercader con las mismas tres cartas dan **dos cartas del mercader por una entrega**. La auditoría no lo detecta.
- **A3**: un intercambio mueve una copia que sigue ofrecida en otro intercambio abierto; el segundo intercambio queda abierto sobre una copia que ya es de otro.
- **A9**: cinco compras, cinco forjas y ocho ofertas simultáneas **se saltan** los topes de 3, 3 y 5.
- **A1, A6, A7, A10**: reproducidos leyendo el código y con las baterías de permisos y de apuestas.

Lo que encontraron las pruebas en mis propios borradores: `cartas_guardar` fallaba para el editor (`text[] || 'rareza'` se interpretaba como literal de array). Corregido en `economia-8_permisos.sql` con `array_append`.

Lo que **no** cubre el entorno local: el navegador con sesión real de Supabase, y la versión exacta de Auth y PostgREST. Por eso, antes de declarar el sistema listo, hay que repetir el reto con apuesta, el intercambio, el mercader y la forja con dos navegadores reales en la web publicada.

## 2. Cambios previstos

Se aplican en este orden, cada archivo como una migración registrada (así queda en la historia de Supabase):

1. `economia-7_integridad.sql` (A1, A2, A3, A9, A11 y regla de silencio)
2. `economia-8_permisos.sql` (A6, A7, A10)
3. `economia-9_panel_admin.sql` (funciones del panel)
4. Cambios de navegador (panel admin, mensajes de error de nombre repetido, selector de apuestas que deja de mandar las estadísticas).

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

Todas en la rama de pruebas, con usuarios inventados. Ninguna toca datos de jugadores.

**Regresión** (flujo completo, sin concurrencia): regalar, retar y aceptar sin apuesta y con apuesta, terminar con avisos iguales, distintos y de uno solo, rendirse, rechazar, caducar, intercambio completo y cancelado, compra al mercader, cada receta de la forja con éxito y fallo, panel de límites, editor de cartas, registro de cuenta nueva, cambio de nombre. Tras cada una, `cartas_auditoria()` debe volver vacía.

**Dos sesiones concurrentes** (dos peticiones en paralelo al mismo tiempo; una retiene sus candados con una espera dentro de la misma transacción):

1. Dos compras al mercader sobre ofertas distintas con las mismas cartas de entrada: solo una debe tener éxito.
2. Aceptar un intercambio mientras el oferente lo cancela y apuesta la misma copia.
3. Dos aceptaciones del mismo intercambio.
4. Dos reportes del mismo resultado de una apuesta y un reporte contra una rendición: la apuesta se reparte una sola vez.
5. Cinco forjas o compras simultáneas contra el tope diario de 3.
6. Reparto de recompensas con la carta pedida agotándose a mitad (cuando se reactiven, en la rama).
7. `cartas_refrescar` desde dos sesiones a la vez sobre las mismas apuestas atascadas.

**Permisos** (como `anon`, como jugador, como editor y como admin): cada función de admin, cada función interna, cada escritura directa a cada tabla, `cartas_guardar` con campos económicos, cambio de Side y de nombre por un jugador, un editor y un admin.

**Explotación** (documentar sin cambiar costes): ciclo mercader + forja con cantidades pequeñas y grandes, ida y vuelta de copias entre dos cuentas, forja que agota la capacidad de emisión de las raras, y la ventaja de precio del mercader frente a la forja.

**Sesiones reales**: la rama también sirve para entrar con dos navegadores a la web publicada apuntando a esa rama. Hasta que eso se haga y se vea en pantalla el reto con apuesta, el intercambio, el mercader y la forja, **no se declara el sistema listo para el lanzamiento**.

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

## 7. Límites de lo que se puede corregir sin rediseñar

`cartas_accion` solo comprueba que la acción tenga forma válida y que sea el turno de quien la manda. La legalidad de una jugada (por ejemplo, jugar una carta que no está en la mano) la deciden los dos navegadores al reproducir la partida, no el servidor. Un cliente modificado puede mandar acciones ilegales; si el navegador del rival las rechaza o se desincroniza, el resultado acabará en disputa, pero el servidor no lo impide. La corrección completa es la misma que la de los duelos contra la casa: validar la partida en el servidor con el motor. Queda como decisión tuya (sección 8).

## 8. Decisiones que te corresponden

1. **Inactividad de una partida apostada sin ningún aviso**: propongo 72 horas hasta devolver la apuesta (`apuesta_inactividad_horas`). Tú fijaste solo las 24 horas del caso de un aviso.
2. **Disputas sin resolver**: hoy esperan al admin sin límite. ¿Se devuelven solas pasado un plazo (por ejemplo 14 días) o siempre las resuelves tú?
3. **Editores y cartas nuevas**: una carta que crea un editor nace sin límite y no obtenible. ¿Quieres que además quede sin publicar hasta que la revises?
4. **Campos que se protegen a los editores**: rareza, tipo, lado, obtenible y límite global. El tipo y el lado no estaban en tu lista, pero cambian el límite por jugador y a quién le sale la carta.
5. **Validar partidas en el servidor** (sección 7 y A4). Es la única forma de cerrar el fraude por acciones ilegales y por puntuaciones inventadas, y supone portar el motor a una Edge Function.
6. **Forja que gasta capacidad de emisión** y **mercader más barato que la forja**: documentados, sin cambios.
7. **Límites globales provisionales**: sin tocar. Siguen pendientes de tu revisión.
