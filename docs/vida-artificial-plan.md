# Vida Artificial: plan del primer prototipo (Fase 1 y 2)

**Estado (3-nov-2026): OCULTO, solo admin.** Página `app/dist/vida.html` (código en `app/src/vida/`), con tarjeta en Minijuegos > En pruebas. El diseño completo está en `docs/vida-artificial-diseno.md` y los casos extremos 19 a 38 en `docs/vida-artificial-casos-extremos.md`. Este documento recoge lo que se decidió al construir el prototipo, cómo está repartido, qué números se pueden ajustar y qué falta.

El alcance de este prototipo es solo la inteligencia: una habitación, dos criaturas con el mismo genoma, unos pocos objetos, necesidades, percepción, memoria y aprendizaje. Sin economía, sin multijugador, sin reproducción.

## Decisiones

1. **Mismo stack que Pitter-Patter** (Vite + TypeScript + Phaser 4, carpeta `app/`, entrada `app/vida.html`). Motivos: el núcleo de simulación tiene que ser un módulo puro que se pruebe en Node (`node app/tests/vida.test.ts`, mismo estilo que `tablero.test.ts`), y con TypeScript las pruebas y el juego comparten exactamente el mismo código. El jugador no instala nada y el resultado compilado (`app/dist`) se sube a `main` como el resto. No hay servidores nuevos.
2. **Núcleo puro y determinista.** Nada de `nucleo/` ni `lab/` toca Phaser o el DOM. Con la misma semilla y la misma configuración la vida es idéntica (`Azar`, mulberry32, cuyo estado es un entero). Cada criatura, cada mundo y cada simulación llevan su propio azar derivado de la semilla, así lo que hace uno no cambia el azar de otro.
3. **La red no lleva reglas.** Al nacer predice casi nada (salida con sesgo -3, probado en los tests) y solo hay dos cosas innatas, ambas del genoma: una atracción pequeña por lo que huele bien (`priorOlor`) y un poco de interés por otras criaturas. Todo lo demás se aprende.
4. **Cerebro híbrido** (detalle abajo): percepción, biología, emociones, memoria asociativa, red recurrente, selección de comportamientos por utilidad y ejecución de acciones.
5. **Los casos del documento son experimentos con control.** Un caso no se aprueba porque salga una vez: se ejecuta con 10 semillas, cada una se juzga con 4 o 5 criterios y se pide que el control (sin el estímulo, o sin la posibilidad social) se comporte claramente distinto.
6. **Mortalidad "protegida" por ahora**: la salud nunca baja de un mínimo. Las otras modalidades (recuperable, permanente) quedan para la fase de mundo compartido.
7. **Guardado en el navegador** (`localStorage`, clave `vidaArtificialEstado`). Se guarda el estado completo y la hora; al volver se simula el tiempo pasado en pasos de 1 s con un tope de 8 horas y se muestra un resumen. El modelo de Supabase queda para otra fase.
8. **Un día de las criaturas son 30 minutos de simulación** (`DIA = 1800`). Un reloj de laboratorio muestra "Día 3 · 14:20" y de noche (20 h a 6 h) la sala se oscurece.
9. **Arte dibujado en código**, sin archivos de imagen, con la estética de las inspiraciones: un corte lateral de laboratorio (como *Creatures*) con un rincón cálido (nido, planta, ventana redonda, lámpara ámbar) a la izquierda, una ventana de observación en el centro y tubos de contención verdes y cian a la derecha. Las criaturas son pálidas y translúcidas, de cuatro patas curvas y gruesas, zarpas blandas, cabeza grande, ojos grandes y orejas caídas con la punta luminosa (la primera versión tenía orejas con barbas y dedos largos y se leía como un insecto). El aspecto sale de un genoma visual (`Cuerpo` en `nucleo/genoma.ts`: tono, tamaño, longitud y grosor de las patas, caída de las orejas, tamaño de cabeza y de ojos, motas), así que una mutación cambia el dibujo cambiando números. La expresión se mezcla con la postura: las pupilas se abren con la curiosidad y se cierran con el miedo, las orejas se levantan con la atención y se pegan hacia atrás con miedo, y una luz en el collar cambia de color con el ánimo (azul asustado, rojo frustrado, verde contento, ámbar curioso). Cada una lleva un collar de color propio (sale de su huella) para distinguir a los gemelos.
10. **Interfaz plana y oscura**, con filetes finos, un cian frío para lo vivo y un ámbar cálido para lo acogedor. Sin degradados dorados ni sombras en relieve. Todos los controles llevan el estilo de la página, y toda espera de más de 250 ms se ve en el propio botón. Los dos paneles y la bandeja de objetos se pliegan con una lengüeta (en pantallas de menos de 1500 px de ancho la memoria empieza plegada) y "Observar" los esconde todos.

## Reparto en módulos

| Módulo del diseño | Archivo | Qué hace |
|---|---|---|
| `creature-core` | `nucleo/criatura.ts` | Estado biológico (hambre, sueño, dolor, aburrimiento, soledad, salud), emociones, rasgos, aprendizaje de cada experiencia, crédito causal, dolor y premios del jugador, serialización. |
| (percepción y decisión) | `nucleo/conducta.ts` | Qué percibe (vista, olfato, oído, recuerdos) y puntuación de cada opción. |
| `creature-behavior` | `nucleo/acciones.ts` | Ejecuta la acción elegida: ir, llegar, hacer, terminar. |
| `creature-brain` | `nucleo/red.ts` | Red recurrente pequeña (Elman) con aprendizaje y olvido. |
| `creature-memory` | `nucleo/memoria.ts` | Asociaciones, avistamientos, episodios legibles, hábitos y vínculos. |
| `creature-genetics` | `nucleo/genoma.ts` | Genoma (rasgos, plasticidad, memoria, sentidos, cuerpo). Reproducción y mutación llegan en la Fase 4. |
| `creature-world` | `nucleo/mundo.ts`, `nucleo/catalogo.ts` | Habitación, objetos, física sencilla, máquinas, peligros. |
| `creature-simulation` | `nucleo/simulacion.ts` | Pasos, tiempo fuera de línea con tope, guardar y restaurar. |
| Laboratorio de pruebas | `lab/laboratorio.ts`, `lab/casos.ts` | Casos, semillas, controles, informes. Panel dentro del juego en `ui/labDev.ts`. |
| `creature-renderer` | `arte/criatura.ts`, `arte/objetos.ts`, `arte/fondo.ts`, `escenas/Laboratorio.ts` | Dibujo y animación, cámara, efectos, sonidos que salen de lo que pasa. |
| `creature-ui` | `ui/interfaz.ts`, `ui/titulo.ts`, `ui/base.ts` | Ficha, memoria, bandeja, controles. |
| `creature-storage` | `guardado.ts`, `juego.ts` | Guardado local y controlador del juego. |
| Audio | `audio/audio.ts` | Ambiente y efectos sintetizados. |

## El cerebro, paso a paso

1. **Percepción.** Cada cosa tiene 10 rasgos sensoriales (redondez, tamaño, brillo, calidez, verdor, olor, sonido, movimiento, vivo, huella). Se ve a 360 unidades, se huele hasta 760 (solo el olor, el sonido y el movimiento) y se oye hasta 1000. Lo que se ve de lejos solo da algunos rasgos, y al comparar con lo vivido solo cuentan esos. Además recuerda dónde vio cada cosa por última vez (hasta 14 avistamientos) y va a mirar si sigue allí.
2. **Biología.** Cinco necesidades que suben con el tiempo y bajan al satisfacerlas, y la salud.
3. **Emociones.** Miedo, curiosidad, frustración, apego y excitación: suben con los hechos y decaen. Cambian lo que elige y cómo se la ve (orejas, cola, ojos, postura).
4. **Memoria asociativa.** Cada experiencia deja o refuerza una asociación "esto, hecho así, dio tal resultado" (cinco resultados: sacia, daño, diversión, compañía, susto). Se aprende con una experiencia, se funde con las parecidas, se difumina si no se usa (vida media de 3 h, más larga cuanto más importante) y se aplica a lo parecido por semejanza (**generalización**). Hay asociaciones de acción (probar, empujar, tocar, acercarse), de presencia (qué suele pasar cerca de eso, para el miedo) y de lugar.
5. **Crédito causal.** Una acción recibe parte del mérito de lo que ocurre en los 9 s siguientes. Si algo sale de una máquina poco después de tocarla, la acción se queda con el valor que la criatura cree que tiene lo que salió. Así aprende a usar una palanca sin que nadie se lo diga.
6. **Red neuronal recurrente.** 12 unidades ocultas con realimentación. Recibe lo que percibe, la acción que se plantea, sus necesidades, sus emociones y dónde está, y predice el resultado de esa acción. Aprende con un paso de gradiente por experiencia y olvida volviendo a los pesos de nacimiento. Cuando la memoria asociativa no tiene suficiente experiencia, pesa más la red.
7. **Decisión.** Para cada cosa que percibe y cada cosa que puede hacer con ella (más explorar, descansar y dormir), suma lo esperado ponderado por lo que necesita ahora y por su carácter, resta el daño esperado, el coste del viaje y el miedo, añade un bono de curiosidad por lo que no conoce y elige con un softmax. Lo que ya está haciendo solo se interrumpe si lo nuevo es claramente mejor (histéresis, más fuerte en las persistentes).
8. **Ejecución.** Ir, llegar, hacer y terminar. La animación sale de lo que ocurre aquí: no hay una animación por acción sino una postura que se mezcla con la anterior.

**Personalidad.** Los 8 rasgos del documento. Cada uno tiene una predisposición genética y un valor vivido, que se mueve con lo que pasa (el daño sube el miedo y baja la curiosidad, lo divertido de lo nuevo sube la curiosidad, la compañía sube la sociabilidad, insistir tras fallar y acertar sube la persistencia) hasta 0,45 de distancia de la predisposición, y vuelve despacio hacia ella. La ficha muestra ambos en un gráfico: la línea clara es con lo que nació y el relleno es cómo es ahora.

## Cómo probarlo

```bash
cd app
node tests/vida.test.ts                       # pruebas del núcleo y los casos (10 semillas cada uno), unos 30 s
N=14 V=1 node tests/vida-lab.ts 01 04b        # un caso concreto con detalle por semilla
npm run build                                 # compila a app/dist (hay que subirlo a main)
npx vite build --config vite.vida.config.ts   # solo Vida Artificial, a app/dist-vida (para probar sin tocar app/dist)
```

Para verlo en local se sirve `app/dist` (o `app/dist-vida`) y se abre `vida.html` con `localStorage.compendioAdmin = "1"`. En el navegador, `window.vida` da acceso a `juego`, `escena` y `game` para saltar a cualquier situación (`window.vida.juego.sim.avanzar(600)`, `window.vida.juego.fijarVelocidad(16)`). El panel "Laboratorio de pruebas" del título ejecuta los mismos casos con los mismos resultados.

Rueda del ratón sobre la sala (no sobre un panel): hacia arriba se acerca (sala, seguir, cerca) y hacia abajo vuelve a la vista de la sala. Arrastrar con el botón derecho o el central mueve la cámara en los planos cercanos. Teclas (agrupadas junto a la mano izquierda): Q y E cambian de criatura (también Tab y Mayús+Tab), A premia, S asusta, D observa, F pantalla completa, G sonido, C cámara, X quita el objeto bajo el ratón (también Supr), espacio pausa, 1 2 3 velocidades.

## Resultados de los casos (10 semillas, 1 a 10)

| Caso | Resultado | Control |
|---|---|---|
| 01 Pelota | 10/10 | Bola atornillada (igual de redonda, no se mueve): el interés baja a la mitad o menos. Quien nunca vio la pelota tarda más en encontrarla. |
| 02 Alimento | 10/10 | Quien nunca probó el alimento tarda más en encontrarlo. Un alimento que sienta mal se aprende como dañino. |
| 03 Máquina | 10/10 | Palanca estropeada (se mueve y suena pero no suelta nada): no aprende que traiga comida y pasa hambre. |
| 04 Peligro | 10/10 | Placa que no descarga: no se evita. Se evita la zona sin la placa y también la placa apagada. |
| 04b Generalización | 9/10 | Quien no recibió la descarga no tiene preferencia por el foco azul sobre el rojo nuevo. Los focos rojos se parecen (semejanza 0,70) y el azul no (0,0006). |
| 13 Gemelos | 10/10 | Dos gemelos criados igual se parecen mucho más entre sí que dos criados en habitaciones distintas (distancia de conducta 0,01 a 0,13 frente a 0,75 a 1,2). |
| 05 Partido | 9/10 (16/20 con las semillas 1 a 20) | Cada criatura en su sala con su pelota: sin posibilidad de responder, no hay turnos por encima del azar (en 2 de 20 semillas el control sale por encima de z = 2, lo esperable con ese umbral). |
| 06 Compañía | 9/10 | Dos criaturas que no se conocen: tardan más en juntarse (menos del 80 % del tiempo en las vinculadas) y pasan menos tiempo cerca. |
| 07 Aprendiz | 8/10 | La misma criatura sola con la palanca: usa la palanca más del doble de veces en 5 minutos cuando convive con una experta, sin haber recibido entrenamiento propio. |
| 08 Protector | 10/10 | Una criatura que no conoce a la otra: al verla recibir una descarga no aumenta las veces que decide acercarse (las vinculadas aumentan al menos una decisión en 12 s). |
| 14 Herencia de los monstruos | 9/10 | Tres líneas con la misma población inicial: criar a las que se recuperan antes de un susto (mansa), a las que más tardan (asustadiza) y al azar. En 6 generaciones nacen con una sensibilidad media de ~0,25, ~0,5 y ~0,75. Al criar a los descendientes otra vez en condiciones idénticas la diferencia persiste, la variación genética no se agota y lo que cambia viviendo es igual en las tres. |
| 07b Aprendiz por partes (informativo) | 7/10 | A: con la palanca estropeada y junto a la experta la usa ~8 veces más que sola, así que **hay facilitación social pura**. B: cuando la experta se va, en 4 de 8 semillas sigue usándola mucho más que quien la exploró sola (133 a 146 frente a 7 a 16 pulsaciones) y en las otras no. |
| 08b Protector aprendido (informativo) | **5/10** | Cinco condiciones sin regla de ayuda (ver abajo): hay señal, pero no pasa el 80 %. |
| 03b La palanca que se agota | 9/10 | Habituación: dos criaturas bien alimentadas pulsan la palanca entre 15 y 90 veces cada 5 minutos (antes 100 a 200), el cansancio se va tras 2 minutos de descanso y una sola criatura con hambre la sigue usando para comer. |

Una semilla de 04b no aprueba porque esa criatura, con poco miedo de nacimiento, apenas distingue los focos: es una diferencia individual, no un fallo de la prueba. En 20 semillas, 18 aprueban.

### Casos sociales (05 a 08)

Se apoyan en una sola capacidad nueva: **percibir lo que hace otra criatura**.

- **05, partido.** Si una criatura que ve acaba de empujar o tocar algo, se fija en ello (sube la curiosidad y la excitación), le deja un recuerdo suave de que eso entretiene y la cosa gana atractivo unos 8 s (más cuanto más sociable es). No hay ninguna regla de "devolver la pelota". Con eso la proporción de turnos alternados sube a 0,6 a 0,8 y hay rachas de hasta 16 turnos seguidos. Es el resultado menos sólido: 9/10 con las semillas 1 a 10 y 16/20 con 1 a 20. Medido con una prueba de permutación circular que desplaza en el tiempo los empujones de una para ver cuántas respuestas mutuas habría por azar.
- **06, compañía.** Nace de lo que ya había: el afecto crece con el tiempo cerca de alguien, la soledad crece más en quien se apega, y acercarse a quien la ha acompañado tiene un valor aprendido.
- **07, aprendiz.** Es el recuerdo suave de ver a otra tocar la palanca (el mismo mecanismo del 05) más lo que se come de lo que ella saca. La aprendiz usa la palanca entre 1,5 y 19 veces más que sola (antes de la habituación, casi siempre unas 200 pulsaciones en 5 minutos; ahora la pareja a veces se queda en unas 20, y el criterio pasó de "más del doble" a "un 40 % más"). **No** empieza antes: el cuarto de la palanca ya se explora igual de rápido solo.
- **08, protector (con regla).** Aquí hay una **regla puesta a mano**, no aprendida: cuando una criatura ve que otra se hace daño, se acerca más a ella cuanto más afecto le tenga (`ayuda` en `criatura.ts` y su bono en `conducta.ts`). Lo que se mide es que el vínculo previo cambia lo que decide. Es honesto decir que es una predisposición de la arquitectura y no una conducta emergente. Se puede apagar (`ayudaInnata = false`) y el intento de que se aprenda sola es el 08b.

### Estados ajenos y el 08b: una señal parcial

Se quitó la regla del 08 y se probó a que la conducta se **aprenda**. Lo que existe, sin ninguna orden de "ayudar" (todo detrás de `estadosAjenos`, que solo activa el 08b):

- La angustia de otra criatura se **percibe como señal** (ruido y postura: miedo, dolor, estar tendida o haber recibido un golpe hace poco), no como su estado interno.
- Ver a otra hacerse daño contagia un poco de miedo y despierta la **necesidad de compañía** (más en quien se apega y quiere a la otra).
- Quedarse junto a alguien querido que lo pasa mal **le calma** (su miedo y su dolor bajan mientras está con ella). Eso es un efecto de la acción que se **ve**: la angustia que se percibía al llegar y la que se percibe al irse. Ese alivio visible suma a la compañía que siente quien se acerca. Si la angustia no baja, no hay alivio que aprender.

Un primer diseño, con una recompensa por consolar que no dependía de ningún efecto visible, dio 0/8 y la criatura entrenada acabó yendo con la otra *menos* que las que no habían visto nada. La versión actual separa lo que pedía la revisión del diseño. La criatura que mira tiene hambre y la comida está al otro lado, así que ir con la otra cuesta algo. Cada condición entrena 20 episodios en los que la otra recibe una descarga delante:

| Condición | Qué separa | Veces que va con ella (media de 10 semillas) |
|---|---|---|
| Puede acercarse y la angustia baja | consuelo aprendido | ~0,48 |
| No puede acercarse (atrapada) | si ver angustia basta | ~0,33 |
| Se acerca, pero la angustia no baja | si hace falta ver el efecto | ~0,20 |
| La que sufre es una desconocida | si el vínculo importa | ~0,39 |
| Nunca la vio sufrir | línea de base | ~0,39 |

Lectura, con cautela: **sí hay una señal que va en la dirección esperada** (8 de 10 semillas: va más con ella cuando acercarse alivia que cuando no; 8 de 10: más que si no pudo acercarse; 7 de 10: más que con una desconocida). Aprende sobre todo que acercarse **no sirve** cuando no alivia (cae a ~0,20), y apenas sube por encima de la línea de base cuando sí alivia. Solo 5 de 10 semillas cumplen los cinco criterios a la vez, así que el caso queda como informativo. Falta una forma de que la criatura estime lo que siente la otra y planifique en consecuencia (los casos 19 a 38).

## Números ajustables

Todos en `nucleo/ajustes.ts` (objeto `AJ`), salvo los que se indican.

| Qué | Valor | Efecto |
|---|---|---|
| `dt` | 0,25 s | Paso de la simulación. La escena lo interpola para que el movimiento sea fluido. |
| `hambre`, `sueno`, `aburrimiento`, `soledad` | 0,0016 / 0,001 / 0,004 / 0,0018 por s | Rapidez con que suben las necesidades (hambre llena en unos 10 min). |
| `sigma` | 0,24 | Anchura de la semejanza. Más grande, más generaliza. |
| `fusion` | 0,82 | Dos recuerdos con más semejanza que esto se funden. |
| `vidaMedia` | 3 h | Vida media de un recuerdo no usado (x memoria del genoma, x1 a x3 si importó). |
| `alfaMin` | 0,3 | Cuánto cambia un recuerdo con cada experiencia nueva. Más bajo, más inercia. |
| `ventanaCausal`, `tauCausal` | 9 s, 3,5 s | Cuánto tiempo después sigue contando una acción. |
| `lrRed`, `ocultas` | 0,12, 12 | Aprendizaje y tamaño de la red. |
| `temperatura` | 0,07 | Cuánto azar hay al elegir. |
| `pesoSacia`, `pesoDano`, `costeViaje`, `bonoCuriosidad` | 2,2 / 1,7 / 0,0002 / 0,9 | Pesos de la decisión. |
| `desarrolloMax` | 0,45 | Cuánto puede alejarse un rasgo vivido de su predisposición. |
| `topeFueraDeLinea`, `dtFueraDeLinea` | 8 h, 1 s | Simulación del tiempo que se estuvo fuera. |
| `DIA` (en `tipos.ts`) | 1800 s | Duración de un día de las criaturas. |
| Tasas de desarrollo de rasgos | en `criatura.ts` (`sufrir`, `experimentar`) | 0,14 de miedo por daño, 0,05 de curiosidad por descubrimiento divertido, etc. |

Los objetos (qué alimentan, qué hacen daño) están en `nucleo/catalogo.ts`.

## Rendimiento

Una criatura cuesta unos 40 µs por paso en Node. A 16x con dos criaturas se simulan unos 64 pasos por segundo (uno por fotograma). Las criaturas se redibujan a 30 fotogramas por segundo (lienzo de 770 x 660) y a 1920 x 1080 el bucle de la escena cuesta unos 6 ms. Ocho horas fuera de línea con dos criaturas se simulan en unos 2,4 s (medido en Node), en trozos para que la página siga respondiendo. El estado guardado ocupa unos 40 KB.

## Hecho después de la primera entrega

- **Casos 05 a 08** (arriba).
- **Mortalidad configurable** (`Mortalidad` en `tipos.ts`): protegida (nunca muere), recuperable (si la salud llega a cero cae tendida, no decide ni se mueve y una caricia la reanima en menos de 4 minutos o muere) y permanente (muere). Al morir queda un **legado** (nombre, causa, genoma, rasgos y lo más importante de su historia) en la pestaña Legado. El selector está en la cabecera de la bandeja.
- **Herencia** (`cruzar` en `genoma.ts`, `Simulacion.nacer`): cada gen sale de uno de los padres, de la media o de una mutación pequeña (20 % de las veces) y nunca sale de su rango. El hijo nace sin recuerdos y con el carácter de su genoma, no con el que los padres desarrollaron. El botón Criar de la ficha funciona con la criatura elegida y la más cercana (hasta 4 vivas, y no antes de medio día de vida). Las crías se dibujan más pequeñas y crecen en día y medio.
- **Cámara**: arrastrar con el botón derecho o el central la mueve en los planos cercanos. Se pierde al cambiar de plano o de criatura.
- **Música ambiental generada**: acordes lentos sobre una escala pentatónica menor que se vuelven más sordos de noche.
- **Interruptor del comedero** y bayas como último recurso con mucha hambre.
- **Habituación** (`habituacion*` en `ajustes.ts`): cada vez que se empuja o toca algo, haya salido algo o no, crece un cansancio de ese objeto (con 10 seguidas baja la diversión esperada al 40 %). Se recupera con el descanso (vida media de 20 s). Solo afecta a la diversión esperada y a la atención que despierta lo que hace otra criatura, no a la comida: una palanca que da de comer sigue usándose cuando hay hambre. Antes dos criaturas llegaban a pulsarla cada 2 segundos sin parar, porque cada una se fijaba en que la otra la pulsaba. Un primer intento contaba solo las repeticiones que daban diversión, pero la palanca tiene 6 s de pausa y la mayoría de los toques no daban nada, así que no cansaba.
- **Caso 14 completo** (selección artificial con control, 6 generaciones, dos líneas de cada tipo) y la pestaña **Linaje** con el árbol genealógico y lo heredado.
- **Controles del aprendiz** (07b) y del protector (08b), con resultados distintos a los esperados.

## Pendiente

- **Casos 09 a 12** (perro guardián, depredador, recolector, solución imprevista): necesitan herramientas de entrenamiento más finas (recompensar por estar en una zona y no solo por una acción, marcadores, barreras) y transporte de objetos.
- **Estados ajenos reales** (el 08b falla): que la criatura estime lo que siente la otra y el efecto de lo que hace sobre ello. Y el resto de los casos 19 a 38 (`docs/vida-artificial-casos-extremos.md`): piden planificación, memoria de trabajo, señales aprendidas y transmisión cultural.
- **Más controles del caso 05** (variar la distancia, la pelota y la sociabilidad) y del 07: el 07b ya separa la facilitación del aprendizaje.
- **Temperatura** como necesidad y entornos distintos.
- **Supabase**: tablas de criaturas, memoria, eventos y relaciones, y funciones del servidor que validen genética y recompensas. Se dejó fuera a propósito: hace falta decidir qué valida el servidor y no se quiso añadir infraestructura en este prototipo.
- **Un segundo recinto** para criar a los gemelos por separado desde el juego (hoy conviven en una sala; para separarlos hay que elegir qué objetos hay y a quién se premia o asusta).
- **Probar en un portátil sin tarjeta gráfica** y en pantalla completa real: no se ha podido probar desde aquí.
- **Más herramientas** (marcadores, barreras, sonidos como estímulo).

## Recomendación para la siguiente fase

1. **Estimación del estado ajeno.** El 08b dice que percibir señales no basta. La criatura necesita un modelo pequeño de la otra (qué teme, qué quiere) y poder comprobar el efecto de lo que hace sobre él. Es la base de casi todos los casos 19 a 38.
2. **Herramientas de entrenamiento** (recompensa por zona, marcadores, barreras) y **transporte de objetos**: abren los casos 09 a 12.
3. **Controles del 05** (distancia, pelota, sociabilidad), ahora que el 07b ya separa facilitación y aprendizaje.
4. **Medir antes de ampliar.** Cada capacidad nueva debe llegar con su caso en el laboratorio, con control y 10 semillas, y con un control que pueda hacerla fallar.
5. Solo después, el hábitat compartido y Supabase.
