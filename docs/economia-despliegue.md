# Economía de cartas: plan de despliegue por etapas (13 de octubre de 2026)

**Estado: nada de esto está aplicado en producción.** Este documento es la confirmación previa que pediste: qué hay realmente desplegado, el orden exacto, las dependencias, la recuperación y las discrepancias que encontré. Me detengo ahí hasta que decidas.

## 1. Qué hay realmente desplegado hoy (leído de producción, solo lectura, 13 de octubre)

| Pieza | Estado real |
|---|---|
| Funciones de cartas | 73 funciones (cartas y `fichas_es_admin`). Su huella coincide exactamente con la que usé para probar. Las de `economia-1` a `economia-6` del repositorio son equivalentes (solo difieren en comentarios y en una variable sin usar). Otras 8 solo existen en producción y no están en el repositorio (`cartas_accion`, `cartas_guardar`, `cartas_guardar_mazo`, `cartas_borrar_mazo`, `cartas_jugadores`, `cartas_admin_set_editor`, `cartas_vinculo_guardar`, `cartas_vinculo_restaurar`) |
| Estructura | Columnas, índices, políticas, seguridad por filas, disparadores y permisos de tablas **idénticos** a mi entorno de pruebas. Una diferencia: producción tiene además la restricción `cartas_ejemplares_check` (estado y dueño siempre concuerdan), que no está en `economia-1`; es más estricta y mis funciones la cumplen. Ya está en el entorno local |
| Migraciones registradas | Solo 5 (hipódromo, estadísticas, formas de cartas, hipódromo servidor, hipódromo cartas y monedas). **Ninguna de la economía de cartas**: se aplicó pegando SQL |
| Recompensas de cartas | Apagadas en los 4 juegos (`cartas_juegos.activo = false`) |
| Datos | **1 carta real**: el Fulguepardo nº 1 de Frutipep, premio de Hooey del 12 de octubre a las 21:13 (antes de apagar las recompensas). 5 partidas de cartas, ninguna con apuesta. 14 perfiles sin nombres repetidos. La auditoría (`cartas_auditoria()`) devuelve vacío |
| Funciones del servidor (Edge) | `admin-gestionar-cuenta` y `hipodromo-avanzar`. **Ninguna de cartas** |
| Tareas programadas | Solo `hipodromo-avanzar`, cada minuto |
| Páginas publicadas | `main` (67a51e7) está desplegado. Incluye el panel de economía, el lobby de batalla y `batalla.js` con las llamadas a la verificación. Con el servidor sin migrar, esas llamadas fallan sin efecto (las vistas del panel muestran «No se pudo cargar») |
| Cambios locales aún sin publicar | `VERSION` del motor, registro de la versión desde el navegador y los textos del panel de la última tanda; se publican con la etapa 3 |
| Avisos de seguridad de Supabase | 6 avisos antiguos de todo el proyecto (vista con definer, función con `search_path` mutable, funciones de definer ejecutables sin sesión, protección de contraseñas filtradas desactivada). Ninguno es de cartas; mi A10 solo cierra las de cartas |

## 2. Discrepancias que encontré (lo que me hace parar)

### D1. El Hipódromo compra y vende cartas con monedas (otra sesión, ya desplegado)
`hipodromo_comprar_carta`, `hipodromo_vender_carta` y `hipodromo_cartas_reserva` se desplegaron en la migración `hipodromo_cartas_y_monedas`. Comprar saca una copia **de la reserva**; vender manda una copia **a la reserva** (precios: común 50/20, poco común 150/60, rara 500/200, legendaria 2000/800; compra/venta).
- **Compatibilidad con mis migraciones: probada** (`docs/pruebas/t_externas.sh`). Usan el núcleo con las mismas firmas y los mismos candados, y funcionan antes y después. Con la etiqueta «En circulación», **comprar una carta no lista falla sin cobrar**.
- **Hoy**: la página está oculta a jugadores (`oculto.js`) pero las funciones las puede llamar cualquier sesión, y hay 1 billetera con saldo 0, así que no hay monedas con que comprar.
- **Lo que choca con tus reglas** (decisión tuya, no la toco): (a) es una moneda que cambia por cartas, y en el diseño dijiste que no habría moneda universal; (b) **admite legendarias** (el mercader las excluye): una legendaria puede pasar a la reserva por 800 monedas y comprarse por 2000; (c) `hipodromo_cartas_reserva()` enseña cartas que no están en circulación (la compra falla, pero aparecen).

### D2. La recompensa de La Fractura se salta toda la economía
`fractura_recompensa` (ya existía antes de la economía) **escribe directamente en `cartas_coleccion`** sin crear ejemplares. Probado en local: tras una recompensa la colección dice 1 copia y los ejemplares dicen 0, y la auditoría marca 1 problema. Además ignora límites por jugador, límite global y la etiqueta «En circulación», y esa copia fantasma se pierde en cuanto el jugador reciba un ejemplar real de esa carta (el disparador reescribe la colección desde los ejemplares). Hoy: 0 guerras, la página está oculta, pero la función la puede llamar cualquier sesión. **Propuesta**: desactivarla hasta conectarla bien (`docs/economia-12_vias_externas.sql`, borrador). Encaja con «mantén apagadas las recompensas».

### D3. Hay 1 carta real
Ya no es verdad que producción esté vacía. No cambia nada técnico: las migraciones no reescriben ejemplares. La carta se queda con Frutipep; su definición (Fulguepardo) pasará a «fuera de circulación» como todas.

### D4. La base tiene una restricción que el repositorio no conoce
Ver la tabla de arriba. Ya incorporada a las pruebas. Pendiente: guardarla en `economia-1` para que el repositorio reproduzca producción (lo hago con la etapa 0).

## 3. Orden exacto, dependencias y comprobaciones

Cada etapa se aplica con `apply_migration` (una transacción) **después de tomar una copia** (`tomar_copia`), y al terminar te entrego lo aplicado, los resultados y los riesgos antes de pasar a la siguiente. Las comprobaciones entre etapas son de **solo lectura**: huellas de funciones y de permisos comparadas con las del entorno local, `cartas_auditoria()`, estado de los juegos y de la carta real.

| Etapa | Qué | Depende de | Qué cambia en producción | Comprobaciones |
|---|---|---|---|---|
| **0** | `economia-etapa0_respaldo.sql` y `tomar_copia('e0')` | nada | Crea el esquema `respaldo_economia_20261013` (invisible a los navegadores) con las funciones, políticas, permisos y datos. **No cambia ningún comportamiento** | La huella no cambia; el esquema no es legible desde sesiones; la copia tiene las 73 funciones |
| **1** | `economia-7_integridad.sql` | etapa 0 y `economia-1` a `economia-6` ya en producción | A1 (cartas del duelo desde el servidor), A2/A3 (dueño y estado dentro de la transacción), A9 (candado por jugador), A11 (bloqueos huérfanos, regla de 24 h, cierre de disputas a 14 días), `cartas_incidencias` | Huella de funciones = la local tras la etapa 1; permisos de las funciones envueltas (el núcleo `_nucleo` sin permiso de navegador); auditoría vacía; carta real intacta; juegos apagados |
| **2** | `economia-8_permisos.sql` | etapa 1 | A6 (editores), A7 (Side fijo, nombre único, sin borrar perfil), A10 (permisos de funciones y tablas) | Huella de permisos = local; `perfiles` con 14 filas y los nombres sin cambios; índice único creado; **tú entras y cambias tu nombre y compruebas el registro de una cuenta** (lo hace una persona, yo no creo cuentas) |
| **3** | `economia-9_panel_admin.sql`, `-10_verificacion.sql`, `-11_en_circulacion.sql` + publicar los cambios locales de navegador | etapa 1 (usa `cartas_incidencias` y los candados) | Panel, verificación (solo SQL: aún no hay función que la llame), etiqueta «En circulación» (**todas las cartas quedan fuera**) | Huellas; 108 cartas con `en_circulacion = false`; ajustes nuevos (`apuesta_turno_horas` = 48, `disputa_dias` = 14); el panel carga sus vistas con tu sesión |
| **4** | Desplegar `cartas-verificar` | etapa 3 + un commit fijado del motor con `VERSION` publicada | Una Edge Function nueva; sin cron | Ver sección 5. Prueba con datos reales solo con tu permiso |
| **5** | Decisiones D1 y D2 | tu respuesta | Según lo que decidas | — |

Dependencias no obvias: la etapa 3 tiene que ir **después** de la 1 (`economia-10` y `-11` usan tablas y funciones de `economia-7`); la 2 no depende de la 3; publicar `batalla.js` antes de la etapa 3 es inofensivo (los errores se ignoran). **Las etapas 1 y 2 podrían ir juntas, pero las separo para que cualquier problema de cuentas (etapa 2) no se mezcle con los de apuestas (etapa 1).**

## 4. Procedimiento de recuperación (probado)

- **Antes de cada etapa**: `select respaldo_economia_20261013.tomar_copia('eN');` guarda el texto exacto de las 73 funciones y sus permisos, las políticas, los permisos de tablas, las restricciones, los índices, los disparadores y los datos de las tablas de cartas, perfiles y fichas_admins.
- **Si algo falla**: `select respaldo_economia_20261013.restaurar('eN');` en una sola transacción vuelve a crear cada función y sus permisos, borra lo que las migraciones añadieron (funciones y disparadores), repone políticas, permisos, restricciones e índices. No borra las tablas ni columnas nuevas (inofensivas) ni toca datos.
- **Probado** (`docs/pruebas/t_recuperacion.sh`): se aplican las etapas, se vuelve atrás a cada copia y se comprueba que la huella queda **idéntica**, que ningún dato se pierde, que restaurar dos veces no estropea nada y que después se puede volver a aplicar todo con la misma huella. También probado que nadie con sesión puede leer el esquema de copias ni ejecutar la restauración. Esa prueba encontró un fallo en mi primera versión (olvidaba el disparador de `perfiles`) y ya está corregido.
- **Datos**: si hiciera falta recuperar una fila concreta, las copias `d_eN_<tabla>` están en el mismo esquema.
- **Navegador**: volver atrás una página es revertir su commit; las páginas nuevas son compatibles con ambas versiones del servidor.
- **Límite honesto**: las copias están en la misma base de datos. Si la base entera se perdiera, esto no ayuda; para eso cuentan las copias de seguridad de Supabase, que no puedo comprobar desde aquí.

## 5. Tu decisión 5: autenticidad del registro, versión del motor e idempotencia

**¿El registro es auténtico y no manipulable desde el cliente?** Sí, y está probado (`t_verificacion.sh`, sección «Autenticidad»):
- El registro (`acciones`) solo lo escribe `cartas_accion`, que exige ser uno de los dos jugadores, que sea su turno y que la partida esté en curso. Un tercero no puede añadir acciones; el que no tiene el turno no puede jugar por el otro; una acción con forma rara o demasiado larga se rechaza; una partida cerrada no admite acciones.
- Un jugador **no puede escribir en `cartas_partidas`** (ni acciones, ni semilla, ni mazos, ni cartas, ni turno, ni estado, ni resultado, ni insertar ni borrar). Esto depende de la etapa 2 (hoy lo frena solo la seguridad por filas).
- La semilla, el primer turno y los mazos los fija el servidor; las estadísticas de las cartas, desde la etapa 1.
- Una acción ilegal se ignora igual en todos los navegadores (1057 comprobaciones en `tools/probar-verificacion.js`): meter acciones inventadas no cambia el resultado. Si alguien estropea a propósito el turno guardado, una partida ya terminada se sigue dando por terminada, y un abandono se rechaza.
- Límite honesto: un jugador puede **elegir mal a propósito** sus jugadas legales o quedarse sin actuar, pero eso es jugar; no puede inventar un resultado.

**¿Se verifica con la versión correcta del motor?** Sí:
- `js/cartas-motor.js` lleva `VERSION` (hoy `2026.10.13-1`). Cada navegador la registra al abrir una partida apostada (`cartas_registrar_motor`, solo la primera vez y no se puede cambiar).
- La base de datos solo acepta un veredicto si **los dos jugadores registraron la misma versión con la que se repitió la partida**; si falta, no coincide o es otra, devuelve `motor` y no se mueve nada. Probado.
- Regla de mantenimiento: cuando cambies `cartas-motor.js`, `cartas-efectos.js` o `cartas-vinculos.js`, sube `VERSION` y el commit fijado de la función. Las partidas en marcha de la versión anterior no se deciden automáticamente (quedan para el admin o para las reglas de tiempo).
- Riesgo conocido: los vínculos del servidor se leen al repetir; editarlos con una partida apostada en marcha podría cambiar su resultado repetido (queda sin efecto automático solo si cambia la versión, así que conviene no editar vínculos con apuestas abiertas).

**¿Son idempotentes los avisos, abandonos y resoluciones simultáneas?** Sí, probado con sesiones reales a la vez (`t_simultaneas.sh`, 71 comprobaciones, 8 escenarios): dos verificaciones iguales o contrarias, verificación contra avisos, contra una rendición, contra el admin (en los dos órdenes), contra el barrido por tiempo (en los dos órdenes), un abandono contra el jugador que vuelve a actuar justo a tiempo, y dos resoluciones del admin. En todos: **una sola resolución, las cartas se mueven una sola vez o se devuelven una sola vez, nunca ambas, nadie queda anotado dos veces y la auditoría sale limpia**. Los mecanismos: todos los cierres bloquean la fila de la partida y los dos jugadores, comprueban que la apuesta siga activa y salen sin hacer nada si ya no lo está; el desbloqueo solo actúa sobre copias que siguen bloqueadas; la verificación además exige que el registro y la marca de actividad no hayan cambiado desde que se repitió.

## 6. Tus decisiones 2, 3 y 4: cómo quedaron

| Decisión | Implementación | Prueba |
|---|---|---|
| **2. Abandono a las 48 h** | Pierde por abandono quien debe actuar y no lo ha hecho. El servidor comprueba: partida en curso con apuesta activa; que el registro y la marca de actividad no hayan cambiado; que el turno guardado coincida con el de la repetición (si no, no decide); y que el plazo haya vencido **según el reloj de la base de datos**, no el de quien llama. Una disputa o una partida cerrada nunca se cierra por abandono | `t_verificacion.sh`, `probar-verificacion.js`, `t_simultaneas.sh` |
| **3. Cartas fuera de circulación** | Todas las existentes nacen fuera. Una carta fuera no entra por recompensas, forja, reserva ni escaparate del mercader (ni por las compras del Hipódromo). Los regalos manuales del admin se permiten y quedan en el libro de movimientos, en el registro de la colección y, si la carta no está en circulación, en una incidencia visible. Las ofertas especiales del mercader exigen que la carta esté en circulación. **Excepción abierta: la Fractura (D2)** | `t_circulacion.sh`, `t_externas.sh` |
| **4. Disputas a 14 días** | Una disputa sin resolver pasa a «cancelada» con motivo «sin resolver»: se devuelven las apuestas, nadie gana, los dos avisos se conservan en la partida y una incidencia los repite. El plazo (`disputa_dias`) se cambia desde el panel. Cartas nuevas de editores: sin publicar, sin límite global y no obtenibles; los editores no cambian tipo, lado, rareza, límite, disponibilidad ni la publicación de cartas existentes | `t_apuestas.sh`, `t_permisos.sh` |

Interpretación que tomé: «parámetros económicos» incluye `publicada` (un editor tampoco publica ni despublica). Si prefieres que pueda despublicar, se cambia en una línea.

## 7. Riesgos pendientes

1. **D1 y D2** (arriba): decisión tuya.
2. **Las 8 funciones que solo están en producción**: las pruebas locales no usan `cartas_guardar` (la anterior), `cartas_guardar_mazo` ni las de vínculos; su comportamiento tras la etapa 2 lo veo solo por lectura y por las pruebas de `cartas_guardar` nueva. `cartas_guardar_mazo` no la cambio.
3. **Sesiones reales**: todas las pruebas son locales. Falta repetir con dos navegadores sobre la web publicada; crea datos en producción, así que no lo hago sin tu aviso.
4. **La función de verificación no se ha podido ejecutar en Deno** (no está instalado aquí): el veredicto (`cartas-verificar.js`) y la base de datos están probados; el pegamento de la función (lectura de la partida, llamada a la RPC) es corto pero solo se verá funcionando en la etapa 4.
5. **Motor fijado por commit**: hay que mantenerlo al cambiar reglas.
6. **Hipódromo**: sigue activo para el admin y se despliega por otra sesión; una nueva migración suya podría chocar con las mías. Antes de cada etapa vuelvo a comparar las huellas.
7. **Coste**: ninguna etapa contrata nada; la función Edge y las tareas entran en el plan actual.
