# Economía de cartas: borrador de diseño

Este documento reúne lo que ya está decidido, lo que se propone y lo que falta por elegir. Nada marcado como **Propuesta** ni como **Pendiente** está aprobado. Sirve para decidir antes de programar y para que quien lo implemente no dé por buena una regla que todavía no se ha elegido.

Cada punto lleva una de tres etiquetas.

- **Decidido**: lo dijo el DM. No se cambia sin preguntar.
- **Propuesta**: una forma razonable de resolverlo, con sus números cuando hacen falta. Se puede cambiar.
- **Pendiente**: hay que elegir. Se resume en la sección 14.

## Estado de la construcción (12 de octubre de 2026)

Las fases 1 a 6 del orden de la sección 13 están construidas y aplicadas en Supabase. Las reglas de las secciones 3 a 11 que aparecen como **Propuesta** se implementaron tal como están escritas, con los números que se indican. Lo que cambie desde el panel de admin se puede ajustar sin tocar código.

**Decidido desde entonces**

- Se elige la opción **C** de la sección 5.1: el límite global cuenta lo emitido alguna vez y lo que vuelve al mercado queda en la reserva, que se reparte antes de emitir copias nuevas.
- Los límites globales de partida están puestos con la tabla de `economia_2_limites_iniciales.sql` (personajes 8, 5, 3 y 1; criaturas y objetos 20, 12, 5 y 1; reacciones 15, 8 y 4; terrenos 12, 8 y 4; legendarias 1; el Bufón conserva su 5). Son valores provisionales: se corrigen carta por carta en Admin > Economía de cartas.

**Excepciones documentadas (provisionales, no se tocan sin aprobación)**

- **El Bufón** (`el-bufon`, limitada): límite global 5, una copia por jugador (el efectivo sale de la regla de las limitadas, `limite_jugador` está vacío) y no obtenible por recompensas (`obtenible` en falso). Solo llega a un jugador por regalo del admin. La regla general dice que una limitada tiene 1 copia global; el 5 del Bufón es la excepción, conservada tal como estaba antes de la economía.
- **Mercader frente a forja**: hoy el mercader es más barato que la forja para subir de categoría (3 comunes por una poco común frente a 5 en la forja; 2 poco comunes por una rara frente a 3 poco comunes con un 20 % de fallo). No es un ciclo que genere valor, pero es una diferencia de diseño. No se han cambiado los costes; se mide primero con las pruebas de explotación de `docs/economia-correcciones-plan.md`.

**Qué hay y dónde**

| Pieza | Dónde se maneja | Archivos |
|---|---|---|
| Ejemplares, libro de movimientos, bloqueos, límites y auditoría | Admin > Economía de cartas (límites, auditoría, movimientos) | `economia_1_nucleo.sql`, `js/admin-economia.js` |
| Recompensas de ajedrez, duelo, arquería y Hooey | Se muestran solas al terminar una partida contra la casa | `economia_3_recompensas.sql`, `js/recompensas.js` |
| Duelos de cartas con apuesta | Batalla (lobby): elegir cartas al retar y al aceptar | `economia_4_apuestas.sql`, `js/batalla-apuestas.js`, `js/batalla.js` |
| Intercambios, mercader y forja | Triunfos > Intercambios | `economia_5_intercambios.sql`, `economia_6_forja.sql`, `intercambios.html`, `js/intercambios.js` |

**Detalles que no estaban en el borrador**

- Los duelos con apuesta cruzan el aviso de resultado de los dos navegadores: si coinciden se resuelve; si discrepan queda en disputa y la resuelve el admin (función `cartas_admin_resolver_apuesta`); declararse perdedor es definitivo; si solo avisa uno y el otro calla 10 minutos, vale lo que dijo.
- Las recompensas usan una partida registrada en el servidor (permiso al empezar, entrega al terminar) con un tiempo mínimo por juego. Los juegos contra la casa corren en el navegador, así que el servidor no puede comprobar la puntuación: la defensa real son los topes diarios, los rendimientos decrecientes y la revisión del admin.
- El mercader empieza vacío: su inventario sale de lo que los jugadores le cambian y de la reserva. El admin puede ponerle ofertas especiales desde la pestaña Mercader de Intercambios.
- La forja trae tres recetas (fundir comunes, alquimia y contrapeso) que el admin puede cambiar con `cartas_admin_guardar_receta`.

**Decidido el 13 de octubre de 2026: el hipódromo tiene moneda y se cambia por cartas.** Las cartas se pueden vender a la reserva por monedas del hipódromo según su rareza y comprar de la reserva con esas monedas (comprar no emite cartas nuevas y cuesta 2,5 veces lo que se paga al vender). En el hipódromo se empieza con 0 monedas. Es la excepción a «no existe una moneda universal» de la sección 1: la moneda existe solo dentro del hipódromo. Detalle en `docs/hipodromo.md` («Cartas y monedas») y `docs/hipodromo-2_cartas.sql`.

**Todavía sin construir**

- Apuestas y recompensas en Muerte Súbita (sección 10), a la espera de tu decisión.
- Carreras, estrategia militar (la Fractura), expediciones, criadero, taberna de rumores y refugio personal: ninguno entrega ni mueve cartas todavía. Cuando se conecten, tienen que usar `cartas_i_emitir`, `cartas_i_transferir`, `cartas_i_retirar` y `cartas_i_bloquear` como el resto.
- Panel de vigilancia (11.5) más allá de la auditoría y los movimientos.
- Torneos con fondo de premios (sección 9, punto 8).

## 1. Idea general

Los minijuegos de la página se conectan mediante cartas coleccionables. Las cartas cumplen tres funciones a la vez.

- Coleccionables: se consiguen, se guardan y se intercambian.
- Recursos de juego: se usan en minijuegos, sobre todo en el juego de cartas.
- Moneda: se pagan, se apuestan y se cambian por otras cartas y servicios.

**Decidido.** No existe una moneda universal. No se crean fichas, puntos ni recursos que circulen entre juegos. La economía es cerrada y está hecha solo de cartas. La comunidad es pequeña, unos diez jugadores.

**Decidido.** Una carta no tiene que ser buena en combate para tener valor. Puede valer por su utilidad, su rareza, su aspecto, su lugar en una colección o su uso en otro minijuego. Así una carta limitada puede ser muy codiciada sin decidir quién gana los duelos.

**Decidido.** Todo minijuego debe ofrecer dos cosas: una forma de ganar cartas y una forma de retar a otro jugador apostando cartas. La sección 12 lo aplica juego por juego.

## 2. Qué existe hoy en el sitio

Conviene partir de lo que ya hay para no construir dos sistemas.

| Pieza | Qué hace hoy | Qué le falta para esta economía |
|---|---|---|
| `cartas_catalogo` | Una fila por carta (rareza, lado, tipo, `limite`, `copias_max`, publicada) | `limite` solo significa «edición numerada» y solo se aplica a las limitadas. No hay límite global general ni límite por jugador configurable |
| `cartas_coleccion` | Cuántas copias tiene cada jugador (un contador, sin identidad por copia) | Identificador único por ejemplar |
| `cartas_numeradas` | Número de edición (01/05) solo en cartas con `limite` | Extenderlo a todas las cartas |
| `cartas_registro` | Historial con origen `juego`, `admin` o `quitada` | Un libro de movimientos completo (transferencias, bloqueos, retiradas) |
| `cartas_regalar` / `cartas_quitar` | El admin da o quita una copia | Pasar a ser un caso más del sistema de emisión |
| Mazos y partidas | Validan que el jugador tiene las cartas y reparten el reto entre jugadores | Apuestas, bloqueo de cartas apostadas y traspaso al terminar |
| Regla guardada | Al perder contra una IA la carta «vuelve al mercado», no se destruye | Hace falta definir ese mercado (sección 7) |

Ojo con tres límites distintos que no deben mezclarse.

1. `limite` actual: tamaño de la edición numerada de una carta.
2. `copias_max` actual: cuántas copias entran en **un mazo**.
3. Los dos límites nuevos de esta economía: global y por jugador.

## 3. Los límites de copias

### 3.1 Qué se corrige

**Decidido.** Los números 3 y 10 son del límite **por jugador**, no del global. El límite global es independiente, es propio de cada carta y **sus valores todavía no están definidos**. Quien implemente no debe suponer que coinciden.

| Límite | Qué controla | Valores |
|---|---|---|
| Por jugador | Cuántas copias de una misma carta puede tener cada jugador | Personajes 3. Criaturas, objetos y terrenos 10. Legendarias y limitadas 1 |
| Global | Cuántas copias de una carta pueden existir en toda la página | **Pendiente**, uno por carta. Legendarias y limitadas 1, con excepciones |
| Por mazo | Cuántas entran en un mazo | Ya existe (`copias_max`) |

**Decidido.** Los dos primeros se comprueban por separado y siempre en el servidor. El global es un tope de emisión. No obliga a que existan todas las copias desde el principio.

**Decidido.** Legendarias y limitadas tienen una sola copia global, salvo excepciones que se fijan carta por carta. Como el límite por jugador de esas cartas es 1, solo un jugador puede tenerlas a la vez.

### 3.2 Herramienta para modificar los límites

**Decidido.** Hace falta una herramienta para cambiar el límite global y el límite por jugador. **Propuesta** de cómo debe funcionar, dentro del panel de admin y junto al editor de cartas:

- Una tabla con una fila por carta y estas columnas: tipo, rareza, límite global, emitidas, en circulación, en reserva, límite por jugador, límite por mazo.
- Los límites por jugador salen por defecto del tipo de carta (3, 10 o 1), pero cada carta puede tener el suyo propio.
- El límite global empieza **sin definir**. Una carta sin límite global definido no se emite nunca por recompensa. Solo la puede dar el admin a mano. Así no sale nada por accidente mientras no se fijan los números.
- Edición por lotes (por ejemplo, «todas las criaturas comunes a 20») y edición individual.
- Cada cambio queda registrado con quién, cuándo y el valor anterior.
- Si el nuevo límite es menor que lo ya emitido o que lo que tiene algún jugador, no se quita nada a nadie. La carta queda «por encima del límite»: no se puede emitir ni recibir más copias hasta bajar del tope. El admin ve el aviso y decide.

### 3.3 Cómo elegir los valores globales (Propuesta)

Como no hay cifras, esta es una forma de calcularlas para discutir. No es una decisión.

```
límite global ≈ jugadores activos × copias que se quiere que tenga cada uno × factor de escasez
```

El factor de escasez va de 1 (muy común) a 0,1 (muy rara). Con diez jugadores, una criatura común que se quiere que casi todos tengan en dos copias saldría en torno a 20. Un personaje poco común, en torno a 6. Una carta rara, entre 2 y 3. Son órdenes de magnitud, no valores aprobados.

## 4. Modelo de datos: cada ejemplar es único

**Decidido.** Cada copia debe tener un identificador único para controlar su propiedad, sus transferencias y su disponibilidad.

**Propuesta.**

- `cartas_ejemplares`: una fila por copia emitida. Campos: `id` (uuid), `carta_id`, `numero_emision` (1, 2, 3... por carta, que sirve también como número de edición), `propietario`, `estado`, `atributos` (JSON para lo que aporten otros juegos, como el linaje de una criatura criada), `creada`.
- `cartas_movimientos`: libro de movimientos que no se edita ni se borra. Cada fila guarda el tipo, el ejemplar, de quién a quién, el motivo, la referencia (partida, apuesta, servicio) y quién lo provocó.
- `cartas_bloqueos`: copias retenidas por una apuesta, un intercambio, un torneo o un uso temporal. Guarda ejemplar, motivo, referencia y caducidad.
- La colección que ve el jugador se calcula a partir de los ejemplares. `cartas_coleccion` pasa a ser una vista.

**Estados de un ejemplar:** `en_reserva` (emitida pero sin dueño, disponible para volver a repartirse), `poseida`, `bloqueada`, `en_mercader`, `destruida`.

**Migración.** Las cantidades actuales se convierten en ejemplares, uno por copia, con número de emisión asignado por orden. El libro de movimientos arranca con una fila de emisión por cada una y la nota «migración». Las copias numeradas conservan su número.

**Regla de oro.** Todo cambio de dueño o de estado pasa por una función del servidor que lo hace de forma atómica, bloquea la carta mientras comprueba los límites y escribe en el libro. Nada se modifica desde el navegador.

## 5. Las operaciones económicas

**Decidido.** Hay cuatro operaciones distintas con reglas distintas. **Propuesta**: añadir una quinta que es solo de control, el bloqueo.

| Operación | Qué pasa | Cambia lo que existe |
|---|---|---|
| Emisión | El sistema crea o reparte una copia nueva. Respeta el límite global | Sí, sube |
| Transferencia | Una carta cambia de jugador (apuesta, intercambio, compra) | No |
| Gasto o retirada | Una carta se entrega a un servicio, se sacrifica o se retira | Según el servicio |
| Uso temporal | Una carta trabaja en un juego pero sigue siendo del jugador | No |
| Bloqueo | La copia queda retenida mientras dura algo, para que no se use dos veces | No |

### 5.1 Qué cuenta contra el límite global (Pendiente, con recomendación)

La pregunta es qué ocurre con la capacidad cuando una copia se destruye.

- **A. El límite cuenta lo emitido alguna vez.** Una copia destruida no libera hueco. Es la opción más estricta y protege la rareza.
- **B. El límite cuenta lo que existe ahora.** Destruir libera un hueco que se puede volver a emitir. Cualquier sumidero pasa a ser un grifo: sacrificar una carta permitiría repartir otra igual más tarde.
- **C. Variante de A con reserva.** Las copias que «vuelven al mercado» pasan a `en_reserva` y se reparten otra vez sin consumir emisión nueva, porque ya fueron emitidas. Las destruidas se pierden para siempre.

**Propuesta: C.** Encaja con la regla ya decidida de que perder contra una IA devuelve la carta al mercado. Deja claro que hay dos tipos de retirada.

- `retirada_a_reserva`: la copia sigue existiendo, vuelve a estar disponible y se reparte primero que ninguna emisión nueva.
- `retirada_destruida`: la copia desaparece para siempre y baja de verdad la oferta total.

Cada servicio elige uno de los dos. Por defecto, el sacrificio y la forja destruyen, y las apuestas contra el sistema devuelven a la reserva. **Pendiente** confirmar servicio por servicio.

Al repartir una recompensa se usa siempre primero la reserva y solo después una emisión nueva, y las dos comprueban el límite por jugador.

### 5.2 Invariante de auditoría (Propuesta)

En cualquier momento tiene que cumplirse para cada carta:

```
emitidas = poseídas + bloqueadas + en mercader + en reserva + destruidas
emitidas ≤ límite global
```

Una función de auditoría lo comprueba y el admin la puede lanzar a mano. Si no cuadra, se muestra el libro de movimientos de esa carta.

## 6. Cómo se obtienen cartas

### 6.1 Comprobaciones antes de entregar (Decidido)

Antes de dar una carta, el servidor comprueba, en este orden:

1. Que la carta esté disponible como recompensa de ese minijuego.
2. Que no se haya alcanzado el límite global (contando la reserva como disponible).
3. Que el jugador no haya llegado a su límite individual.
4. Que la copia concreta no esté asignada a otro jugador ni reservada para otra cosa.

Si falla alguna, no se entrega esa carta y se aplica una alternativa (sección 6.5). **Nunca** se supera un límite por entregar un premio.

### 6.2 Tramos de rendimiento (Propuesta)

Cada minijuego define cuatro umbrales sobre su propia puntuación. No hay una fórmula común.

| Tramo | Qué da |
|---|---|
| Participación | Ninguna carta. Suma progreso (6.4) |
| Buen resultado | Una carta común o poco común del grupo del juego |
| Excelente | Una carta poco común o rara del grupo del juego |
| Extraordinario | Una carta rara garantizada. Es el único tramo que puede abrir un logro especial (6.6) |

El tramo se decide comparando con los umbrales del juego y no con la clasificación de los demás. Así lo que gana uno no se lo quita a otro y los principiantes no quedan fuera por nivel.

Probabilidades de partida, para afinar con una simulación.

| Tramo | Común | Poco común | Rara |
|---|---|---|---|
| Buen resultado | 80 % | 20 % | 0 % |
| Excelente | 0 % | 60 % | 40 % |
| Extraordinario | 0 % | 0 % | 100 % |

**Mejora personal.** Superar tu propia mejor marca en un 10 % o más sube un tramo, una vez al día. Ayuda a quien empieza sin regalar nada a quien ya domina.

### 6.3 Qué cartas puede entregar cada minijuego (Propuesta)

Cada minijuego tiene una lista de **grupos de premio**, editable por el admin. Un grupo es una selección de cartas definida por filtros (tipo, rareza, afinidad, etiqueta temática) y no una lista fija de nombres.

- Carreras: criaturas, objetos y terrenos de carrera.
- Estrategia militar: unidades, equipo y terrenos.
- Expediciones: reliquias y objetos.
- Casos y rumores: personajes, terrenos y cartas de lore.

Una carta puede estar en el grupo de más de un juego. La regla es que cada juego deje claro de qué grupos sale su premio.

**Legendarias y limitadas.** Nunca entran en un grupo aleatorio. Solo se entregan por un evento, un logro concreto o un torneo, definido a mano por el admin (6.6).

### 6.4 Progreso hacia una recompensa (Propuesta)

La participación suma «sellos» en un contador **de ese juego**. Con cinco sellos se obtiene una carta común de su grupo y el contador vuelve a cero.

Para no crear una moneda disfrazada, el contador cumple cuatro reglas: es propio de un solo juego, no se puede transferir, no se puede gastar en nada que no sea la recompensa de ese juego y no se acumula más allá de un ciclo.

### 6.5 Cuando una carta no está disponible (Propuesta)

El servidor prueba, en este orden, hasta encontrar una salida:

1. Otra carta del mismo grupo y del mismo tramo.
2. Una carta de rareza inferior del mismo grupo.
3. Una copia de la reserva (siempre se mira antes de emitir).
4. Un sello extra y, si el contador llega a su tope, la carta se entrega al reponerse el grupo.
5. Un aviso al jugador de que esa recompensa está agotada por ahora.

Los premios agotados no se esconden. El jugador ve qué cartas siguen disponibles en cada juego.

### 6.6 Logros y eventos (Propuesta)

Son premios definidos a mano, no sorteados. Cada uno indica la condición (por ejemplo, «ganar el torneo de la semana»), la carta y quién lo concede. El servidor verifica la condición y la disponibilidad. Las legendarias solo salen por aquí.

### 6.7 Ritmo de emisión (Propuesta)

Para que no se agote todo el primer fin de semana, el admin elige para cada carta o grupo cuánto debe durar su emisión. Con el límite global, las copias que quedan y el tiempo previsto, el servidor calcula cuántas puede repartir por semana. Si va por delante del plan, baja la probabilidad de que salgan. Si va por detrás, la sube un poco. Es un regulador, no una cuota fija.

## 7. Cartas agotadas y nuevas emisiones

**Propuesta.** Cada carta pasa por tres situaciones.

- Abierta: quedan copias por emitir o en reserva.
- Agotada: no queda nada por emitir ni en reserva. Solo circula lo que ya existe.
- Cerrada: el admin decidió que no se emite más aunque quede margen.

Una carta agotada sigue valiendo, y mucho. Se consigue por intercambio, apuesta o mercader.

**Nuevas emisiones.** No hay emisión automática. Para ampliar una carta, el admin sube su límite global desde la herramienta de la sección 3.2. Cada ampliación queda en el libro. Conviene hacerlas por temporadas o eventos, para que tengan sentido en la campaña.

**Excepciones de las legendarias.** Una legendaria con más de una copia global se configura a mano y debería tener una razón clara en la campaña.

**La reserva del mercado.** Es el conjunto de ejemplares en `en_reserva`. Se reparte primero que cualquier emisión nueva. No se vende ni se regala sin pasar por una de las operaciones de la sección 5.

## 8. El mercader y los intercambios

### 8.1 Intercambios entre jugadores (Propuesta)

- Un jugador ofrece una o más cartas y pide otras. Puede dirigirlo a alguien concreto o dejarlo abierto en un tablón.
- Al aceptar, las cartas de ambos pasan a `bloqueada`. Antes de completar, el servidor comprueba los límites individuales de los dos lados y la disponibilidad de cada copia. Si algo falla, no se hace nada.
- Las ofertas abiertas caducan (por ejemplo, a los siete días) y se pueden cancelar mientras nadie las acepte.
- Una oferta dirigida permite intercambiar cuando el otro jugador no está conectado. Acepta cuando entra.
- Todo queda en el libro de movimientos.

### 8.2 Cómo valorar sin moneda (Propuesta)

El mercader no paga con dinero, así que necesita una regla de equivalencia basada solo en cartas.

- Cada carta tiene una **categoría de valor** interna, que sale de su rareza y su tipo. No es un precio visible. Solo sirve para decidir qué cambios acepta el mercader.
- Los cambios que ofrece son de la forma «da estas cartas, recibe esta». Por ejemplo, dos cartas de una categoría para una de la categoría superior.
- La regla de diseño es que **entregar y recibir nunca se compensan del todo**. El mercader siempre se queda con algo más de lo que da. Así no sirve para dar vueltas a una carta y ganar valor.

### 8.3 Qué hace el mercader (Propuesta)

- **Compra** cartas que a nadie le interesan y las guarda en su inventario (`en_mercader`). Esas cartas se pueden revender más adelante, no desaparecen.
- **Vende** cartas de su inventario y copias de la reserva, siempre cambiándolas por otras cartas.
- **Rota** su inventario. Cada día muestra solo unas pocas ofertas, con existencias limitadas.
- **Ofrece** de vez en cuando una carta de inventario limitado, con una razón de campaña (el mercader es «imposible»).
- **Sirve de contraparte** cuando no hay otro jugador que quiera cambiar.

### 8.4 Reglas del mercader (Propuesta)

- Solo mueve copias que ya existen o que están en la reserva. **No crea copias** y no gasta emisión salvo que el admin amplíe un límite y lo registre.
- Respeta el límite por jugador de quien le compra.
- Hay un tope diario de cambios por jugador.
- No devuelve la misma carta que acaba de comprar durante un día completo.
- Lo que más tiempo lleva en su inventario baja de categoría (se cambia más barato). Lo que más se pide sube.
- Todo cambio queda en el libro.

## 9. Apuestas en el juego de cartas

**Decidido.**

- Modalidades: duelo amistoso sin apuestas, duelo con apuestas acordadas antes de empezar y torneo con un fondo de premios hecho con las cartas de entrada.
- En un duelo apostado, el ganador recibe las cartas de ambos. En un empate cada uno recupera las suyas.
- Abandonar tras confirmar la apuesta cuenta como derrota, salvo un fallo técnico que justifique cancelar la partida.
- Las cartas apostadas se bloquean durante la partida para que no se puedan intercambiar, gastar ni apostar en otra a la vez.
- Antes de confirmar, se verifica que el traspaso respete los límites individuales y globales.
- Las apuestas entre jugadores nunca crean cartas nuevas.

**Propuesta** para equilibrarlas.

1. **Flujo.** Reto, propuesta de apuesta, respuesta (acepta, contraoferta o rechaza), confirmación de los dos, bloqueo, partida, resolución. Hasta la confirmación se puede cancelar. Tras ella no.
2. **Equilibrio de lo apostado.** Los dos lados apuestan cartas de categorías de valor parecidas (8.2). La diferencia máxima permitida es de una categoría. Para apostar cartas muy distintas hace falta que ambos lo acepten expresamente.
3. **Protección del que recibe el reto.** Cada jugador puede indicar qué cartas no apostaría nunca. La interfaz las oculta de su lista de apuesta.
4. **Cartas del mazo.** Pendiente de decidir si se puede apostar una carta que está en el mazo con el que se juega. Es posible porque se bloquea, pero cambia el mazo al perder.
5. **Resolución y límites.** Se comprueba el límite individual del ganador al proponer y al confirmar. Si al resolver ya no cabe (por ejemplo, ganó otra copia entretanto), esa carta vuelve a su dueño original y se avisa a los dos. No se supera ningún límite.
6. **Frecuencia.** Máximo de apuestas por día y por jugador, y un tiempo mínimo entre la misma pareja de jugadores. Frena el abuso y el efecto de «revancha hasta recuperar».
7. **Colusión.** Con una comunidad pequeña lo más práctico es un registro que el admin pueda revisar: pares de jugadores con muchas transferencias en una dirección, o una cuenta que acumula todo. No se bloquea automáticamente. Se avisa.
8. **Torneos.** Cada participante bloquea sus cartas de entrada. Se reparten como premios, por ejemplo así: el campeón recibe la mitad y el finalista la cuarta parte, y el resto se reparte entre las posiciones siguientes. Las cartas indivisibles se asignan por orden de posición. Si el torneo se cancela, todo se devuelve.
9. **Contra una IA.** Ya decidido: perder devuelve la carta a la reserva. Ganar a una IA no da cartas de otros jugadores. Da una recompensa del sistema bajo las reglas de la sección 6.

## 10. Muerte Súbita

**Decidido.**

- Es un modo de alto riesgo, separado de los duelos de cartas ordinarios.
- La entrada exige nivel 4 como mínimo.
- La muerte del personaje es permanente.
- El desafío puede ser combate, ajedrez, estrategia o una competición, según la categoría del oponente.

**Idea del DM, sin decidir.** Si un jugador tiene la carta del mismo personaje que el oponente del reto, podría apostar la propia carta. Normalmente serán cartas legendarias, porque los personajes de Muerte Súbita lo suelen ser.

**Pendiente.** Estas son las preguntas que abre esa idea.

- ¿Apostar la carta es obligatorio, opcional o no existe?
- Si se pierde el reto y el personaje muere, ¿qué pasa con la carta? Puede destruirse (un funeral para siempre), volver a la reserva o pasar a otro jugador.
- Si se gana, ¿se recibe algo de cartas, o solo se sobrevive?
- Una legendaria con una sola copia global, si se destruye, deja de existir. Conviene decidir si eso es lo deseado o si la carta del personaje debe volver a la reserva.
- ¿Se podría apostar otra carta distinta de la del personaje?

Hasta que se decida, Muerte Súbita **no mueve cartas**.

## 11. Evitar acumulación y abusos

### 11.1 Acumulación indefinida

El límite por jugador ya frena la acumulación de copias de una misma carta. Para el resto hay que dar razones para soltar cartas, sin castigar a quien colecciona.

- **Sumideros voluntarios con beneficio claro:** forja, sacrificio en el criadero, personalización del refugio, cambios con el mercader.
- **Utilidad sin consumo:** uso temporal en carreras, mazos, crianza.
- No se propone ningún impuesto ni caducidad de cartas. Eso castigaría a los jugadores que no entran a menudo.

### 11.2 Forja equilibrada (Propuesta)

- Entregar cartas para obtener una mejor debe costar más valor del que se recibe. Nunca es una vía segura para multiplicar valor.
- Algunos resultados destruyen las cartas entregadas. Otros las devuelven a la reserva. Se decide por receta.
- Las recetas son visibles, para que no sean una sorpresa, pero algunas pueden tener una probabilidad de fallo.
- Los objetos especiales tienen un tope global como el resto.

### 11.3 Abuso de los minijuegos

| Riesgo | Medida |
|---|---|
| Automatizar partidas o repetir la más fácil | Topes diarios por juego y total. Rendimientos decrecientes (cada recompensa del día tiene la mitad de probabilidad que la anterior). Tiempo mínimo de partida |
| Mandar una puntuación falsa desde el navegador | El servidor entrega una semilla y un identificador de partida al empezar. Al terminar valida que la puntuación sea posible para esa semilla y ese tiempo. Si no cuadra, no hay recompensa |
| Manipular el reloj | Todo se mide con la hora del servidor |
| Crear cuentas para sacar más premios | Las cuentas las controla el admin. Se puede exigir que una cuenta tenga una antigüedad antes de cobrar premios |
| Pasarse cartas con una segunda cuenta | Libro de movimientos revisable y aviso de patrones raros (11.5) |
| Dos acciones a la vez con la misma carta | Bloqueo por carta y operaciones atómicas en el servidor |
| Un error de entrega | El admin puede revertir un movimiento. Queda registrado y no se borra nada |

### 11.4 Los principiantes

Las recompensas dependen del rendimiento, pero no se excluye a nadie para siempre. Los umbrales se calibran por juego para que un jugador normal alcance «buen resultado». Además existen los sellos de participación, la mejora personal y la protección de las apuestas.

### 11.5 Vigilancia (Propuesta)

Un panel de solo lectura para el admin con:

- Entradas y salidas netas de cartas por jugador en los últimos siete días.
- Pares de jugadores con muchas transferencias en un solo sentido.
- Cartas agotadas y ritmo de emisión frente al plan.
- Resultado de la auditoría de la sección 5.2.

## 12. Cómo encaja cada juego sin economías paralelas

**Regla de integración.** Todos los juegos usan el mismo inventario y el mismo libro. No hay objetos, monedas ni materiales propios. Lo que un juego necesite guardar (el linaje de una criatura, el equipo de una unidad) vive en los `atributos` del ejemplar, de modo que viaja con la carta si cambia de dueño.

Cada juego ofrece como mínimo tres enganches al sistema central:

1. `recompensa(juego, resultado)`: pide una carta o un sello según la sección 6.
2. `retar_con_apuesta(juego, rival, cartas)`: crea una apuesta que se resuelve con la sección 9.
3. `uso_temporal(carta, actividad)`: bloquea la carta mientras se usa y la libera al terminar.

| Juego | Cómo se ganan cartas (emisión) | Cómo se retan jugadores apostando (transferencia) | Uso temporal | Gasto o retirada |
|---|---|---|---|---|
| Carreras de criaturas | Premios por posición del sistema, criaturas, objetos y terrenos de carrera | Apuesta directa entre jugadores sobre una carrera o un cara a cara | La criatura inscrita | Entrada o equipo consumible de carrera (opcional) |
| Juego de cartas | Premios por rendimiento y torneos | Duelo apostado y torneo | Los mazos | Ninguno |
| Estrategia militar | Unidades, equipo y terrenos según resultado | Partida entre jugadores con las cartas de ejército como apuesta | Las unidades del ejército | Bajas definitivas (a definir) |
| Expediciones al calabozo | Botín y reliquias según dificultad y salas | Carrera de expediciones entre dos jugadores con la misma semilla | El equipo llevado | Objetos consumidos en la expedición (opcional) |
| Criadero | Criaturas nuevas a partir de cruces, dentro del límite global | Concurso o duelo entre criaturas criadas | La criatura en crianza o entrenamiento | Sacrificio para una mutación |
| Forja | Resultado de la receta (objeto especial, sin emisión extra si sale de la reserva) | Reto de forja con la misma receta | Ninguno | Cartas entregadas (destruidas o a la reserva) |
| Mercader | Su inventario sale de la reserva y de lo que compra | Ninguno directo. Sirve de contraparte | Ninguno | Cartas entregadas pasan a su inventario |
| Casos y rumores | Personajes, terrenos y cartas de lore al resolver | Caso a dos: gana el que resuelve antes | Ninguno | Ninguno |
| Refugio personal | Ninguno | Ninguno | Las cartas expuestas | Cartas entregadas para aspecto (opcional) |
| Muerte Súbita | Sin decidir (sección 10) | Sin decidir (sección 10) | Ninguno | Sin decidir |

El criadero y las carreras comparten criaturas. Una criatura criada es un ejemplar con atributos propios (linaje, mutaciones), y el mismo ejemplar corre en el hipódromo. No se crea un segundo tipo de «criatura de carrera».

## 13. Orden de desarrollo

Se mantiene el orden propuesto y se añade una fase previa.

0. **Decidir** lo pendiente de la sección 14 que bloquea la fase 1 (qué cuenta contra el límite global, destruir o devolver a la reserva, y los valores globales).
1. **Núcleo.** Ejemplares con identificador, libro de movimientos, bloqueos, límites global y por jugador, herramienta de límites del admin, migración de lo existente y auditoría.
2. **Motor de recompensas** y un primer minijuego que entregue cartas según su puntuación, con validación en el servidor, topes diarios y alternativas cuando algo está agotado.
3. **Juego de cartas con apuestas.** Duelos apostados con bloqueo y torneos.
4. **Intercambio entre jugadores y mercader.**
5. **Forja** o un servicio de gasto voluntario.
6. **Expediciones y el resto**, conectándolos uno a uno al inventario común.

Antes de la fase 2 conviene una pequeña **simulación** del ritmo de emisión con diez jugadores ficticios, en la línea de `tools/simular-balance.js`, para ajustar probabilidades, topes y umbrales.

## 14. Decisiones pendientes

Nada de esto está aprobado. La columna «Recomendación» es solo una sugerencia.

| # | Pregunta | Opciones | Recomendación |
|---|---|---|---|
| 1 | Valores del límite global de cada carta | Un valor por carta, método de la sección 3.3 | **Puestos de forma provisional**; se corrigen en Admin |
| 2 | ¿Qué cuenta contra el límite global? | A: lo emitido alguna vez. B: lo que existe ahora. C: A con reserva | **Elegida: C** |
| 3 | ¿Cada servicio destruye o devuelve a la reserva? | Decidirlo servicio a servicio | Sacrificio y forja destruyen. Apuestas contra el sistema devuelven |
| 4 | Excepciones a «una copia global» en legendarias y limitadas | Lista de cartas con más de una copia | Solo con motivo de campaña |
| 5 | Reglas de emisión y ritmo | Regulador de la sección 6.7, o cuota fija | Regulador |
| 6 | Probabilidades, umbrales y topes diarios | Los números de las secciones 6 y 11 | Ajustar con una simulación |
| 7 | Funcionamiento exacto del mercader | Valoración por categorías, tope diario, rotación | Sección 8 como punto de partida |
| 8 | ¿Se pueden apostar cartas del mazo en uso? | Sí, no, solo si queda un mazo válido | Permitir con aviso |
| 9 | Diferencia máxima de valor entre apuestas | Una categoría, libre con aceptación | Una categoría |
| 10 | Muerte Súbita: apuestas de cartas | No hay, opcional, obligatoria con la carta del personaje | Sección 10 |
| 11 | Qué pasa con la carta del personaje al morir | Destruir, reserva, pasar a otro jugador | Sin recomendación |
| 12 | Edad mínima de cuenta para cobrar premios | Sin edad, unos días | Unos días |
| 13 | Bajas de unidades en estrategia militar | Definitivas, recuperables | Sin recomendación |
| 14 | ¿Los sellos de participación son una cosa aparte o se omiten? | Sellos por juego, o solo premio por tramo | Sellos por juego, con las cuatro reglas de 6.4 |

## 15. Qué se construye primero

La fase 1 de la sección 13 no depende de ningún minijuego. Puede construirse y probarse sola con las cartas que ya existen: ejemplares, libro, bloqueos, los dos límites, la herramienta del admin y la migración. Todo lo demás se apoya en ella.
