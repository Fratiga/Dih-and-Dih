# Economía de cartas: plan de correcciones (12 de octubre de 2026)

Estado: **nada de esto está aplicado en producción**. Hay tres borradores de SQL en `docs/` y este plan. Las recompensas de cartas siguen apagadas (`cartas_juegos.activo = false` en los cuatro juegos) desde que lo pediste.

## 1. Cómo se va a probar: el entorno de pruebas

El proyecto de Supabase no guarda su historia de migraciones (solo hay 3 registradas: hipódromo, estadísticas y formas de cartas). Casi todo se aplicó pegando SQL en el editor. Una rama de Supabase se crea reproduciendo esa historia, así que nacería **sin tablas ni funciones**. Para que la prueba valga hay que cargarle antes el esquema real.

Opciones:

| Opción | Qué es | Coste | Fidelidad |
|---|---|---|---|
| **A (recomendada)** | Rama de Supabase del proyecto actual. Se le carga un volcado del esquema de producción (tablas, restricciones, índices, políticas, funciones, disparadores y permisos, leído del catálogo) y se verifica que cada función coincide con la de producción. Datos solo de prueba, con 4 usuarios inventados. | 0,01344 USD por hora de rama (unos 0,32 USD al día) mientras exista. Se borra al terminar. | Alta, comprobable función por función |
| B | Un proyecto de Supabase aparte con el mismo volcado | Depende del plan de la organización | Igual que A, más trabajo y más ruido |
| C | Pruebas con `begin ... rollback` contra producción | Ninguno | No toca datos, pero toma candados en producción y no cumple tu regla de no probar ahí |

La rama necesita tu confirmación de coste, así que **no la he creado**.

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

Propuesta por juego para no dar cartas por resultados que el servidor no puede verificar. Es preliminar: antes de implementar hay que leer cada motor.

| Juego | Qué recibe hoy el servidor | Validación posible | Qué exige rediseño |
|---|---|---|---|
| Duelo contra la casa | Resultado y clave del rival, declarados por el navegador | El motor de cartas es determinista con semilla, igual que en los duelos entre jugadores. El servidor entregaría la semilla al empezar, el navegador mandaría la lista de acciones y una función en el servidor volvería a jugar la partida con el mismo motor para decidir el ganador | Que el rival de la casa sea determinista (o que sus decisiones queden en el registro) y portar `cartas-motor.js` a una Edge Function |
| Ajedrez contra la casa | Resultado y rival | Legalidad de cada jugada y fin de partida (mate o tablas) con una Edge Function | Que la IA sea reproducible desde una semilla del servidor; si no, el navegador puede jugar contra una IA más débil que la declarada |
| Arquería | Resultado y puntuación | Plausibilidad (tiempo mínimo, puntuación máxima posible) | Física determinista con semilla del servidor y registro de cada disparo para reproducirla; sin eso solo se puede limitar el daño |
| Hooey (racha) | Racha | Cota de plausibilidad (racha máxima por segundo) | Registro de eventos con marcas de tiempo; sin eso la racha es falsificable |

Mientras un juego no tenga validación completa, la recomendación es que dé como mucho **sellos** (que están acotados por los topes diarios) y no cartas por tramo.

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
