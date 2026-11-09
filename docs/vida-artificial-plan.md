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
RAPIDA=1 node tests/vida.test.ts             # pruebas del núcleo y solo los casos obligatorios (las mismas comprobaciones que la completa), alrededor de 1 minuto
node tests/vida.test.ts                       # la completa, con todos los casos informativos (unos 25 a 30 minutos; solo cuando se toca algo que los afecta a todos)
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
| 07 Aprendiz (facilitación social) | 9/10 (16/20 con las semillas 1 a 20) | La misma criatura sola con la palanca: la usa al menos un 40 % más de veces en 5 minutos cuando convive con una experta, sin haber recibido entrenamiento propio. Es facilitación mientras la otra está presente (ver 07b). |
| 08 Protector | 10/10 | Una criatura que no conoce a la otra: al verla recibir una descarga no aumenta las veces que decide acercarse (las vinculadas aumentan al menos una decisión en 12 s). |
| 14 Herencia de los monstruos | 9/10 | Tres líneas con la misma población inicial: criar a las que se recuperan antes de un susto (mansa), a las que más tardan (asustadiza) y al azar. En 6 generaciones nacen con una sensibilidad media de ~0,25, ~0,5 y ~0,75. Al criar a los descendientes otra vez en condiciones idénticas la diferencia persiste, la variación genética no se agota y lo que cambia viviendo es igual en las tres. |
| 07b Aprendiz por fases (informativo) | **2/10** | Tres tramos de 200 s y cinco condiciones. A: con la palanca estropeada, junto a la experta la usa 2 a 4 veces más que sola (10 de 10 semillas). A2: una novata que no sabe nada produce casi lo mismo (7 de 10). B: cuando la compañera se va, quien convivió con la experta pulsa lo mismo que quien exploró sola (3 de 10). **No hay aprendizaje que permanezca, solo facilitación.** |
| 08b Protector aprendido (informativo) | **8/10** (16/20 con 1 a 20) | Canal propio de alivio. Acercarse alivia más que quedarse (+0,3 de media), mucho más que en el control apareado (+0,08), no aprende si no puede acercarse ni si la angustia no baja, y no generaliza a una desconocida nueva. Ver abajo. |
| 05b Partido con variaciones (informativo) | 7 variantes, 20 semillas | El z > 2 se cumple en 15 a 20 de 20 según la variante. Ver abajo. |
| 08c Consuelo con costes y con otra compañera (informativo) | 2/20 | Con el hambre subiendo (0,45 a 0,9) y la comida al otro lado, quien aprendió a consolar sigue yendo (0,69 de media frente a 0,04 si nunca vio sufrir). **El control apareado va igual** (0,68, igual dentro de 0,05 en 14 de 20 semillas). Se traslada a una tercera criatura vinculada que nunca vio sufrir en 15 de 20 semillas (0,50 frente a 0,04). |
| 03b La palanca que se agota | 9/10 | Habituación: dos criaturas bien alimentadas pulsan la palanca entre 15 y 90 veces cada 5 minutos (antes 100 a 200), el cansancio se va tras 2 minutos de descanso y una sola criatura con hambre la sigue usando para comer. |

Una semilla de 04b no aprueba porque esa criatura, con poco miedo de nacimiento, apenas distingue los focos: es una diferencia individual, no un fallo de la prueba. En 20 semillas, 18 aprueban.

### Casos sociales (05 a 08)

Se apoyan en una sola capacidad nueva: **percibir lo que hace otra criatura**.

- **05, partido.** Si una criatura que ve acaba de empujar o tocar algo, se fija en ello (sube la curiosidad y la excitación), le deja un recuerdo suave de que eso entretiene y la cosa gana atractivo unos 8 s (más cuanto más sociable es). No hay ninguna regla de "devolver la pelota". Con eso la proporción de turnos alternados sube a 0,6 a 0,8 y hay rachas de hasta 16 turnos seguidos. Es el resultado menos sólido: 9/10 con las semillas 1 a 10 y 16/20 con 1 a 20 (el 05b lo repite con siete variantes, ver abajo). Medido con una prueba de permutación circular que desplaza en el tiempo los empujones de una para ver cuántas respuestas mutuas habría por azar.
- **06, compañía.** Nace de lo que ya había: el afecto crece con el tiempo cerca de alguien, la soledad crece más en quien se apega, y acercarse a quien la ha acompañado tiene un valor aprendido.
- **07, aprendiz (facilitación social).** Es el recuerdo suave de ver a otra tocar la palanca (el mismo mecanismo del 05) más lo que se come de lo que ella saca. La aprendiz usa la palanca entre 20 y 50 veces en 5 minutos con la experta y entre 7 y 13 sola. El 07b muestra que eso es facilitación mientras la otra está presente y no un aprendizaje que se quede. **No** empieza antes: el cuarto de la palanca ya se explora igual de rápido solo.
- **08, protector (con regla).** Aquí hay una **regla puesta a mano**, no aprendida: cuando una criatura ve que otra se hace daño, se acerca más a ella cuanto más afecto le tenga (`ayuda` en `criatura.ts` y su bono en `conducta.ts`). Lo que se mide es que el vínculo previo cambia lo que decide. Es honesto decir que es una predisposición de la arquitectura y no una conducta emergente. Se puede apagar (`ayudaInnata = false`) y el intento de que se aprenda sola es el 08b.

### Por qué unas semillas daban 20 pulsaciones y otras 200 (07)

Hasta ahora el 07 daba dos grupos de semillas: unas 20 pulsaciones en 5 minutos y otras unas 200, con la observadora sin comer nada y llegando a hambre 1,0. No era una diferencia de aprendizaje. La experta se restauraba en una sala nueva con los relojes que traía del entrenamiento (t cerca de 1200 s) y con una huella de su último empujón en el futuro de la sala. La observadora la leía como "acaba de pasar" y se quedaba con una atención fijada en la palanca, con un bono de atención multiplicado por más de 100 (la utilidad de pulsarla llegaba a 14, frente a 0,4 de comer un gránulo). Esa atención también tapaba cualquier empujón real posterior de la experta, porque la regla descarta lo anterior al último recuerdo. Cuando la experta empujaba algo pronto en la sala nueva, esa huella se sustituía por una real y el efecto desaparecía. Es una lectura coherente con las semillas diagnosticadas (3 con el efecto y 4 sin él) y con que el efecto desaparezca tras el arreglo, no una medición aparte.

Arreglo (`criatura.ts` y `conducta.ts`):

- `Criatura.reiniciarReloj()` borra lo que depende del reloj anterior (atención, huella del último empujón, trazas de causa, hábito, contagio, últimas decisiones) y se usa en el 07, el 07b y el `perfil` del caso 13, que meten criaturas vividas en salas nuevas.
- La atención ya no se fija si su tiempo es posterior al de la sala, y el bono de atención solo vale con tiempo pasado.
- Una prueba unitaria comprueba que una huella de 599 s en una sala de 0 s no deja atención fijada.

Resultado tras el arreglo: la observadora con experta pulsa entre 21 y 48 veces y sola entre 7 y 13, sin semillas de 200. Antes de corregirlo se probó otra explicación (que la criatura mantuviera el mérito de una aparición cuyo gránulo se comía otra). Se descartó porque no cambiaba nada y empeoraba el 03b a 8/10, y se quitó.

### El 07 por fases (07b)

Tres tramos de 200 s con la palanca (los dos primeros con compañera, el tercero sin ella y con el hambre a 0,5 para todas), cuatro repeticiones por semilla y mediana:

| Condición | Tramo 1 | Tramo 2 | Tramo 3 (sin compañera) |
|---|---|---|---|
| Palanca estropeada, con la experta | 21 a 43 | 36 a 91 | 9 a 19 |
| Palanca estropeada, con una novata | 21 a 52 | 21 a 65 | |
| Palanca estropeada, sola | 12 a 19 | 8 a 14 | |
| Palanca que funciona, con la experta | 11 a 23 | 14 a 29 | 9 a 16 |
| Palanca que funciona, sola | 6 a 11 | 4 a 9 | 10 a 17 |

Lectura. La compañía duplica o triplica el uso de la palanca estropeada, pero también lo hace una compañera que no sabe nada, porque ella también toca la palanca y la observadora responde a lo que ve hacer. Cuando la compañera se va, la que convivió con la experta usa la palanca lo mismo que la que exploró sola (2 a 3 de 10 semillas muestran más). Los gránulos comidos tampoco cambian (5 a 8 con experta, 4 a 7 sola). Es facilitación social y no hay aprendizaje por observación que permanezca.

### El partido con variaciones (05b)

Siete variantes por semilla (20 semillas, 1500 s cada una). El z es el de la prueba de permutación circular.

| Variante | Empujones | Alternancia | Latencia | Racha media | Racha máx. | z (mediana) | z > 2 |
|---|---|---|---|---|---|---|---|
| Base (1000 entre ellas, una pelota) | 98 | 0,60 | 4,2 s | 2,4 | 7,8 | 3,2 | 17/20 |
| Cerca (300) | 95 | 0,65 | 4,0 s | 2,5 | 7,5 | 4,2 | 19/20 |
| Lejos (1400) | 89 | 0,63 | 4,1 s | 2,5 | 8,0 | 2,9 | 17/20 |
| Pelota pesada (masa 1,6) | 120 | 0,73 | 2,2 s | 4,1 | 14,8 | 5,7 | 20/20 |
| Dos pelotas | 114 | 0,63 | 3,8 s | 2,4 | 8,1 | 3,2 | 16/20 |
| Poco sociables (0,1) | 96 | 0,58 | 3,9 s | 2,1 | 7,1 | 2,5 | 15/20 |
| Muy sociables (0,9) | 92 | 0,69 | 4,0 s | 2,9 | 9,5 | 4,2 | 19/20 |

La alternancia no depende de una distancia ni de una pelota concretas. Aumenta con la sociabilidad (18 de 20 semillas: z mayor en las muy sociables) y con una pelota pesada, (una explicación probable, no medida: tarda más en moverse y hace la respuesta más visible). El 05 original, con 20 semillas, queda en 16/20, justo en el 80 % que se exige, así que sigue siendo el caso obligatorio más justo. Que las poco sociables sigan por encima del azar (z mediano 2,5) probablemente porque la atención hacia lo que hace la otra baja con la sociabilidad pero no se anula (tampoco medido).

### El consuelo aprendido (08b)

Se quitó la regla del 08 y se hizo que la conducta se **aprenda** (todo detrás de `estadosAjenos`, que solo activa el 08b). Lo que existe, sin ninguna orden de "ayudar":

- La angustia de otra criatura se **percibe como señal** (ruido y postura: miedo, dolor, estar tendida o haber recibido un golpe hace poco), no como su estado interno.
- Ver a otra hacerse daño contagia un poco de miedo y despierta la necesidad de compañía.
- Un **canal propio de resultado**, `alivio` (`C.alivio`, el sexto), mide el cambio en la angustia ajena tras lo que se hizo. No se mezcla con la compañía. Lo aprende solo la memoria asociativa (la red neuronal sigue prediciendo los cinco canales de antes, `NC_RED`), y se guarda con el verbo de lo que se hizo (`ante:acercarse`, `ante:descansar`, `ante:evitar`) y los rasgos de la criatura que sufría. Las memorias guardadas con cinco canales se completan con un cero al cargarlas.
- Se mide durante los 5 s siguientes al comienzo de la parte de "hacer" de cualquier acción (en acercarse, desde que llega) como **caída relativa** de la angustia percibida. La percibe también desde lejos, porque su angustia es ruido y se oye desde más allá de lo que se ve. Si se mide durante toda la acción, la que más dura (acercarse) parece la que más alivia, y por eso se fijó la ventana.
- Cuánto vale ese alivio al decidir depende del vínculo: `pesoAlivio * (0,15 + afecto)`. La criatura puede **acercarse**, **quedarse** (descansar) o **alejarse** (evitar) de la que sufre; el miedo contagiado empuja un poco a alejarse y lo aprendido del efecto decide.
- Quedarse junto a alguien querido que lo pasa mal le calma poco a poco (esto es el efecto real en el mundo, no la recompensa).

Diseño del experimento. Una pareja convive 1500 s. Después, la observadora entrena 24 episodios en los que la otra recibe una descarga delante. En los 18 primeros se le fuerza, por turnos, acercarse, quedarse o alejarse (6 de cada), para que haya muestras de las tres opciones; en los 6 siguientes decide. La prueba deja primero 120 s de calma para que no quede el miedo del último episodio. Luego la observadora tiene hambre (0,85), la comida está al otro lado, y la que sufre se queda donde está para que solo cuente lo que hace la otra. Se mide cuánto tarda en estar a menos de 180 de ella (latencia, tope 12 s). Condiciones:

| Condición | Qué separa |
|---|---|
| Consuela (puede acercarse y la angustia baja) | consuelo aprendido |
| Atrapada (ninguna de las dos se puede mover) | si ver angustia basta |
| Inconsolable (acercarse no baja la angustia) | si hace falta ver el efecto |
| **Apareada** | el mismo alivio, en los mismos momentos, pero sin que lo cause ella |
| Desconocida entrenada | la que sufre es una extraña durante el entrenamiento |
| Ingenua (pareja vinculada que nunca la vio sufrir) | línea de base |

El control apareado (yoked) repite, episodio a episodio, la angustia segundo a segundo de otro episodio (el de 4 más adelante) de la condición "consuela". Recibe el mismo alivio, pero lo que ella haga no lo cambia. Así, si acercarse aparece como mejor que quedarse, es porque lo causa.

Resultados (10 semillas, y con 1 a 20 entre paréntesis):

- Acercarse le ha dado más alivio que quedarse: 8/10 (17/20). El margen medio es de unos +0,33 al consolar, con valores aprendidos de 0,44 a 0,86 al acercarse y de 0,32 a 0,42 al quedarse (la angustia baja sola).
- En el control apareado el margen es de unos +0,08: 8/10 (17/20) están por debajo del margen de la que consuela en más de 0,15. Con el mismo alivio, no distingue entre acercarse y quedarse.
- La latencia separa la condición inconsolable (nunca llega) de la que consuela (llega en unos 3 s): 10/10 (19/20). La ingenua tampoco llega. Atrapada, entre 0 y 0,5 (menos que la que consuela en 10/10).
- No generaliza a una desconocida que nunca vio: 10/10 (19/20) la de la extraña da un 0 frente a 0,73.
- Persiste: tras 10 minutos de pausa llega igual de rápido.
- Entrenar con una extraña da el mismo resultado (0,7 en 9 de 10 semillas): el vínculo con ella crece por la compañía repetida durante el entrenamiento, así que dejó de ser una extraña. Por eso el criterio del vínculo es la generalización a una extraña nueva y no la desconocida entrenada.
- **Lo que no separa la conducta**: la condición apareada llega tan rápido como la que consuela (0,35 a 0,75). Con todas las opciones valiendo lo mismo, la criatura se acerca por los pequeños desempates de la compañía. La evidencia de que depende de la acción que causa el alivio está en lo aprendido (el margen), no en la latencia. En 3 de 10 semillas el margen de la que consuela es pequeño (0,09 a 0,16).

Se deja como informativo porque está justo en el 80 % con 20 semillas.

### Consuelo con costes y con una tercera criatura (08c)

Pregunta del 08b que quedaba abierta. ¿Lo aprendido se nota en lo que decide cuando ir con la otra cuesta cada vez más, y sirve con otra criatura? Tres criaturas conviven 1500 s. La del medio entrena 24 episodios con la primera (igual que el 08b, con y sin control apareado). Después se prueba con cuatro niveles de hambre (0,45, 0,6, 0,75 y 0,9, con la comida al otro lado) ante la misma criatura que sufre o ante la tercera, que nunca la vio sufrir. Sin exploración forzada ni episodio de angustia previo, con 120 s de calma antes.

Resultados con 20 semillas:

| Condición | Puntuación media (0 no llega, 0,75 llega enseguida) |
|---|---|
| Entrenada, ante la criatura con la que entrenó | 0,69 |
| Control apareado, ante la misma | 0,68 |
| Nunca vio sufrir, ante la misma | 0,04 |
| Entrenada, ante la tercera (nunca la vio sufrir) | 0,50 |
| Nunca vio sufrir, ante la tercera | 0,04 |

- Ir con quien sufre cuando cuesta no depende de nada que no sea haber visto sufrir y aliviarse: 20 de 20.
- **La conducta no separa a la que consuela del control apareado.** En 14 de 20 semillas son iguales dentro de 0,05, también con el hambre más alta. Hay que leer esto con el 08b: la diferencia que sí existe está en los valores aprendidos (acercarse vale más que quedarse), pero no basta para cambiar lo que decide. Mi lectura, no medida: el control apareado también ve alivio real después de acercarse, así que acercarse sigue valiendo mucho en términos absolutos y la comparación con quedarse (el margen de +0,08) pesa poco frente al coste que se le pone. Lo que se ha demostrado es una asociación entre estar cerca de una compañera angustiada y verla mejorar, no una inferencia de que lo cause su acción.
- **Se traslada a una tercera criatura vinculada** en 15 de 20 semillas (0,50 de media, hasta 0,75). Los vínculos con las dos eran parecidos. Falla del todo en algunas (0 en 3 semillas).

Qué falta para separar la conducta. Hace falta una prueba en la que el margen de acercarse frente a quedarse sea lo único que pague un coste concreto. La más directa es poner entre ambas algo que hace daño (una placa conocida) y ver si quien tiene un margen alto la cruza y el control apareado no. Todavía no se ha hecho.

### Experimento de capacidad: la red no es el límite

Se probó si los resultados flojos (07b, 08b, 05) dependen del tamaño de la red. Se cambiaron las neuronas ocultas (`AJ.ocultas`, hoy 12) a 6, 24 y 48 y se repitieron los casos con 20 semillas (semillas 1 a 20). Para saber cuánto cambia el resultado solo por el conjunto de semillas, se repitió también con 12 neuronas y las semillas 21 a 40. Se ejecuta con `OCULTAS=24 DESDE=1 N=20 node tests/vida-lab.ts 05 07 07b 08b`.

| Caso (semillas aprobadas de 20) | 6 | 12 | 24 | 48 | 12, semillas 21 a 40 |
|---|---|---|---|---|---|
| 05 | 18 | 16 | 16 | 15 | 17 |
| 07 | 16 | 16 | 16 | 16 | 19 |
| 08b | 15 | 16 | 16 | 15 | **11** |
| 07b, criterio B (aprendizaje que permanece) | 7 | 5 | 4 | 5 | 9 |

Lectura. Entre 6 y 48 neuronas, un factor 8, no hay ninguna tendencia. Las diferencias son menores que las que aparecen al cambiar de conjunto de semillas. El 07b B sigue en el 20 a 45 % con cualquier tamaño. La capacidad de la red no es lo que impide el aprendizaje por observación, y lo que falta son entradas y una forma de atribuir lo que le pasa a otra a lo que hizo (ver "Lo que falta en el código" del caso 15).

Dato incómodo. El 08b pasa 16 de 20 con las semillas 1 a 20 y solo 11 de 20 con las 21 a 40. En ese segundo conjunto el criterio que falla es el del margen de alivio (acercarse frente a quedarse), igual que en el primero. Lo que se puede afirmar del 08b es que hay una señal, no que sea estable al 80 %. Sigue informativo y cualquier cifra suya hay que leerla con semillas distintas.

### Reconocimiento persistente (caso 16)

**Diagnóstico previo.** Se midió qué recuerda una criatura de otra tras separarse. Tres criaturas conviven 1500 s, una se va 0, 600 o 3600 s y luego la que se quedó elige entre ella y una impostora (mismo genoma, otro identificador, nunca la conoció), ambas quietas a unos 280 de distancia.

- Los vínculos (afecto y tiempo juntas) se guardan por identificador, no decaen y solo suben con la convivencia. La conocida mantenía 0,49 de afecto tras 3600 s, la impostora 0,01. No existe afecto negativo: no puede haber un rechazo aprendido por individuo.
- Aun así, la criatura **no distinguía** en lo que decide. Llegaba primero a la conocida 0,35 a 0,56 de las veces y a la impostora 0,44 a 0,65, es decir, al azar. El afecto por etiqueta no cambiaba la elección.
- Lo aprendido de acercarse a alguien se guarda por rasgos (aspecto), así que dos criaturas del mismo aspecto son casi intercambiables para ella. Un identificador perfecto en el vínculo, sin efecto en la conducta, no es reconocimiento.

**Lo que se añadió** (detrás de `reconocePorRasgos`, desactivado por defecto, como `estadosAjenos`):

- El vínculo guarda una **firma** de lo que se percibía de esa criatura (tamaño, color y huella, que es un rasgo individual). Se actualiza poco a poco al convivir.
- Para saber cuánto afecto se tiene por la criatura que se ve, se busca la firma recordada que más se parece (`afectoDe` en `conducta.ts`). Una impostora con otra huella no cuenta como la conocida (`sigmaReconocer`, 0,07).
- Acercarse a alguien conocido atrae más, sobre todo estando sola: `pesoFamiliar * afecto * (0,3 + soledad)`. Es una predisposición escrita, del mismo tipo que el apego, y está declarada como tal. Lo que se aprende es a quién se conoce, no que haya que acercarse.

**El caso 16.** Los datos con 10 semillas, ocho réplicas por condición, alternando el lado de la conocida y la impostora en cada réplica (sin eso, una preferencia fija por izquierda o derecha se leía como reconocimiento) y 24 réplicas en los controles:

| Condición | Llega primero a la conocida | A la impostora |
|---|---|---|
| Reencuentro inmediato | 0,86 (0,75 a 1,0) | 0,14 |
| Tras 600 s separadas | 0,89 (0,75 a 1,0) | 0,12 |
| Tras 3600 s separadas | 0,89 (0,75 a 1,0) | 0,12 |
| Nunca se conocieron (control) | 0,49 (0,38 a 0,67) | 0,51 |
| Solo etiqueta, sin reconocimiento por rasgos (control) | 0,47 (0,25 a 0,67) | 0,53 |

Pasa en 9 de 10 semillas. Los tres criterios de reconocimiento y el control de quienes no se conocen pasan 10 de 10. La semilla que falla lo hace por el control de solo etiqueta (0,25 frente a 0,75 con 24 réplicas), que está en el borde del ruido. La prueba se hace en una sala vaciada y distinta de donde convivieron, así que también cubre el reencuentro en otro espacio.

Lo que **no** cubre. El caso inverso (reconocer a quien tuvo una relación mala) no se puede probar todavía: sin agresión entre criaturas no hay experiencia mala con un individuo que atribuirle. Y la impostora tiene el mismo cuerpo y se distingue solo por la huella, que es un rasgo individual del código. Una criatura que cambie de aspecto con la edad habría que reconocerla por otros rasgos.

### Qué se queda al ver (07c)

Se intentó darle a la criatura un aprendizaje por observación y se midió qué persiste cuando la otra se va. Para aislar lo visto de lo vivido, la observadora está inmovilizada con la palanca a la vista durante 400 s mientras la experta la usa, y luego se la suelta sola, con hambre 0,5, entre la palanca y un objeto nuevo que no hace nada (cambia de lado en cada réplica). Se mide a cuál va primero y cuánto tarda en comerse el primer gránulo. Cuatro condiciones: con el modo de observación, con la palanca estropeada durante la convivencia, sin el modo, y sola con la palanca quieta.

Lo que se añadió (todo detrás de `aprendeObservando`, desactivado por defecto):

- Si ve que otra actúa sobre una máquina y poco después sale algo que le interesa, aprende que esa acción lo trae, con menos fuerza que si la hubiera hecho ella (`pesoVicario`). Si ve comer a otra, aprende que eso se come.
- La confianza de un recuerdo cuenta ahora por separado la experiencia propia (`nProp`, `confPropia` en `memoria.ts`). En este modo, el bono de curiosidad por lo desconocido usa solo la propia.

Resultados con 10 semillas, 12 réplicas por condición:

| Condición | Va primero a la palanca | Tarda en comer el primer gránulo |
|---|---|---|
| Con el modo, vio a la experta con la palanca que funciona | 1,00 | 15 a 22 s |
| Con el modo, palanca estropeada mientras la veía | 0,83 a 1,00 | 9 a 17 s |
| Sin el modo | **0,00** | 102 a 120 s (nunca) |
| Sola, con la palanca quieta | 0,25 a 0,75 | 15 a 24 s |

- **Había una trampa de confianza.** La confianza de un recuerdo cuenta cualquier observación, aunque no informe del resultado. Tras ver a la experta usar la palanca, la que mira acumula decenas de observaciones de atención con la diversión y la compañía, pero ninguna del resultado comida. Su memoria dice entonces que la palanca es conocida y no da nada, con mucha confianza, y desaparece el bono de curiosidad. Sin el modo, la observadora **no va nunca a la palanca primero** (0 de 12 por semilla, 10 de 10 semillas) y no se come ningún gránulo. Esto explica por qué el criterio B del 07b no veía aprendizaje que permaneciera. Ver no solo no ayudaba: apartaba.
- **Con el modo, hay un realce del estímulo duradero.** Va primero a la palanca el 100 % de las veces cuando la experta se ha ido, 10 de 10 semillas, frente al 50 % de quien solo la veía quieta. Persiste, pero no es aprendizaje del resultado: ocurre igual si la palanca estaba estropeada.
- **El aprendizaje del resultado no está demostrado.** Comerse el primer gránulo cuesta lo mismo en todas las condiciones con acceso a la palanca, y con la estropeada incluso menos. No se puede decir que haya aprendido que de la palanca sale comida. Puede ser porque los gránulos huelen a comida y los prueba enseguida de todos modos, o porque lo visto no tiene efecto. No se ha separado. Hace falta una prueba en la que la comida no se pueda descubrir por sí sola.
- **El cambio de confianza no se puede hacer global.** Con 20 semillas, pasar a confianza solo propia para todas dejó el 06 en 14/20 (con la confianza de siempre, 17/20) y el 08b en 14/20 (frente a 16/20), porque la curiosidad por objetos compite con acercarse a la otra criatura. Por eso solo vale en el modo de observación. El arreglo general sería una confianza por canal (saber de qué se sabe, no solo cuánto) y queda pendiente.

### Afinidad desigual (caso 17)

Una criatura muy sociable y apegada (0,9 en los dos rasgos) convive con una poco sociable (0,12) y se mide a los 900 s. En la pareja de control las dos son sociables (0,9). Seis convivencias por semilla con el reconocimiento por rasgos activo.

- **La asimetría existe y va en la dirección esperada, pero es moderada.** A los 900 s, el afecto de la sociable por la otra es de 0,54 de media frente a 0,34 al revés, y la busca unas 14 veces frente a 10. La sociable tiene más afecto en al menos 5 de 6 convivencias en 9 de 10 semillas, y busca más en al menos 4 de 6 en 7 de 10. En la pareja de sociables la diferencia mediana es menor de 0,2 en 10 de 10.
- **Se satura con el tiempo.** El afecto sube con el tiempo que pasan cerca, que es mutuo, y el carácter solo cambia la rapidez. A 200 s la diferencia media es de 0,06, a 500 s de 0,13, a 900 s de 0,16, y a 1500 s casi desaparece (las dos llegan a 0,6 o más y en algunas semillas a 1,0). Con la convivencia larga las dos terminan queriéndose casi igual, y por eso se mide a 900 s. La duración se escogió después de ver este barrido, no antes.
- **Qué falta para una asimetría más fuerte.** El afecto crece por estar cerca y por la compañía recibida al acercarse (`terminar` en `acciones.ts`), y ninguno de los dos depende de si la otra correspondió. Para que A quiera a B y B apenas le haga caso, habría que hacer que el afecto crezca más cuando la otra responde bien y menos cuando ignora o se aparta.

Queda informativo (7/10) y no sirve todavía como base para los relatos de relaciones entre criaturas de distintos propietarios sin esa pieza.

### Criar una hostil (caso 18)

Primera pieza del caso 15 y de los casos 09 a 12. Se añadió la posibilidad de **empujar a otra criatura** (`agresion`, desactivado por defecto): se va hasta ella, y en el golpe la desplaza, le hace daño y le deja miedo. La víctima aprende, con lo que ya había, a asociar el aspecto de quien la golpea con daño. Al que golpea no le da nada en el momento. Lo que le empuja a probarlo es una predisposición del carácter (`agresividad` por encima de 0,4 mientras no sabe si compensa) y la frustración multiplicada por ese carácter. Lo frena el afecto por la otra (`pesoAgresion`, `pesoFrustracionAgresion` y `frenoAfectoAgresion` en `ajustes.ts`). Si compensa lo aprende viviendo.

El caso 18 cría a una criatura agresiva (0,9) con una rival inmovilizada, un compañero de entrenamiento, durante 1800 s, en tres condiciones:

- agresiva con premio: una caricia (la herramienta de premiar del juego, `recompensar`, que refuerza al instante lo último que hizo) justo después de cada empujón, como haría un cuidador;
- agresiva sin premio;
- pacífica (0,08) con premio.

Después se la pone con una criatura nueva, sin premio y con comida de sobra.

Resultados con 10 semillas:

| Condición | Empujones durante la crianza (mediana, rango) | Con una criatura nueva en 300 s |
|---|---|---|
| Agresiva con premio | **538** (507 a 540) | 0 |
| Agresiva sin premio | 1 (1 a 3) | 1 (0 a 4) |
| Pacífica con premio | 2,5 (0 a 12) | 0,5 (0 a 3) |

- **La hostilidad se cría, y no se ha escrito para el experimento.** Con premio inmediato empuja unas 100 veces cada 150 s sin parar. Sin premio, con el mismo carácter, casi no empuja. La rival aprende a asociarla con daño (0,5 frente a 0 a 0,3), y su salud baja al mínimo del modo protegida (0,08). Pasan 10 de 10 semillas los criterios de que empuja, de que lo aprende y de que la rival lo asocia con daño.
- **Se detiene hacia los 800 s, y no por el afecto.** Los 540 empujones ocurren antes de t = 819 s. Con la rival inmovilizada y el premio instantáneo, la agresora entra en un frenesí (su frustración sube a 0,97 porque el empujón no le da nada en el momento) y no duerme. A los ~820 s el sueño acumulado hace que `dormir` gane. Se había supuesto que el afecto por la rival la frenaba, y se descartó al hacer que el afecto no crezca con quien te hace daño (ver abajo): con el afecto a 0 se detiene igual. Es un tope del montaje de 1800 s, no de la conducta.
- **El traslado a una criatura nueva es débil.** Si la criada llega descansada (al principio llegaba dormida, y eso lo falseaba), con una criatura nueva y sin premio empuja una mediana de 0,5 veces en 300 s (hasta 6), frente a 1 en la criada sin premio y 0,5 en la pacífica. Pasa el criterio en 1 de 10 semillas. Lo criado es sobre todo hacia esa rival. Para el caso 15 hará falta saber si se generaliza con más historia o con más criaturas.

Qué falló antes de llegar a esto, porque es la parte que enseña:

1. Sin premio, y con la comida como único motor, no se cría nada: entre 1 y 4 empujones. Con comida escasa (una fruta cada 500 s, la agresora come 5 y la rival 2) la competencia es real, pero no sube la frustración, porque disputarse una fruta con varias porciones no produce un "me quedé sin ella".
2. Con una fruta junto a ella como premio tampoco funciona, y se midió por qué. Tras el empujón la criatura toca la fruta y juega con la pelota, y se come la fruta hacia los 9,5 s. El crédito retrasado de las acciones solo mira 9 s, así que cuando llega la comida el empujón ya se ha resuelto sin mérito. Un premio que tarda más que la ventana no se liga a la acción. La caricia, que es instantánea, sí.

La agresión sigue desactivada en el resto de casos. Queda informativo (no pasa por el criterio del traslado) y deja abiertos el afecto con quien te hace daño y el traslado a criaturas nuevas.

### El afecto con quien te hace daño y el premio tras el maltrato (caso 19)

Cambio de diseño: el afecto ya no crece por el mero hecho de estar cerca de alguien con quien se ha intercambiado daño. Cada criatura anota el daño intercambiado con cada otra (`agravios`, que se olvida a medias en 300 s, `olvidoAgravio`), enfría el afecto que hubiera (`anotarAgravio`) y, mientras pesa, estar cerca no crea afecto. Solo cuenta cuando hay daño entre criaturas, que solo ocurre con `agresion`, así que el resto de casos no cambia.

Petición del diseño: aunque las maltraten, que puedan desarrollar afecto por quien las maltrata **si el cuidador las recompensa por recibir el maltrato**. `recompensar`, si lo último que le pasó fue recibir daño de otra criatura (hasta 6 s antes), la liga con ella: sube el afecto, el daño deja de impedirlo, se asocia con compañía y se suaviza la asociación de su aspecto con peligro.

El caso 19 mantiene a una víctima con una maltratadora 600 s, con un golpe cada 10 s, en tres condiciones, y luego mira a quién se acerca antes, la maltratadora o una criatura nueva, a la misma distancia:

| Condición | Afecto por la maltratadora | Daño asociado a su aspecto | Llega antes a la maltratadora | A la nueva |
|---|---|---|---|---|
| Maltrato y premio tras cada golpe | **0,86** | 0,11 | 0,57 | 0,35 |
| Maltrato sin premio | 0 | 0,36 | 0,23 | 0,72 |
| Sin maltrato (control) | 0,34 | | 0,85 | 0,15 |

- **El afecto sigue la regla.** Con premio, 10 de 10 semillas; sin premio, el maltrato no crea afecto en ninguna, y su aspecto queda asociado a daño. Es fuerte: más afecto que la convivencia normal (0,34). Es un vínculo por refuerzo del cuidador, no por buen trato, y conviene saberlo si se abre al juego.
- **La conducta es más débil que el afecto.** Con premio, 4 de 10 semillas se acercan antes a la maltratadora que a la nueva por más de 0,2 (mediana 0,57 frente a 0,35). Sin premio, 7 de 10 se acercan antes a la nueva. El resto del miedo no se deshace con el premio (queda 0,11 de daño asociado).
- Queda informativo (3/10 con los cuatro criterios).

## Espacios (decisión)

No hay una única regla de convivencia. Habrá espacios de tipos distintos, cada uno con sus propias instalaciones y objetos para hacer experimentos y tareas para las criaturas:

- **Completamente libres.** Solo estar ahí supone aceptar lo que pueda pasarle a la criatura. Aquí caben el conflicto, la agresión y la depredación entre criaturas de propietarios distintos.
- **Admitidos entre dos o más jugadores.** Una lista de quien participa.
- **Privados.**

Con esto, la preocupación por el control del propietario sobre la participación de sus criaturas solo se aplica donde el espacio lo establezca: en los libres no hace falta un permiso por criatura. Las instalaciones y las tareas forman parte de cada espacio. Queda por diseñar cuando se abra el recinto compartido.

### Conflicto por la comida (caso 20)

Primer paso de la ruta de agresión. Detrás de `conflictoComida` (desactivado por defecto):

- La comida que alguien está comiendo queda **ocupada** (`ocupante` en el objeto, 3 s tras el último bocado). Intentar comerla a la vez falla (se cuenta como bloqueo) y frustra. Las que la ven ocupada la evitan (`penaOcupada`).
- Con `agresion` también, la hambrienta que ve a otra comiendo empuja más según su carácter (`pesoDisputa`, solo por encima de 0,3 de agresividad, sin base) y quien es golpeada responde (`pesoRepresalia`, `represalia`).
- Un golpe saca a la que come de lo que hacía un momento (aturdimiento de 1 a 3 s) y le hace soltar la comida, de modo que empujar a quien come deja la comida libre en segundos, dentro de la ventana de crédito.
- Para que comer **dure**, el laboratorio tiene una `raiz` (8 porciones de 0,12). La fruta de siempre (porciones de 0,55) sacia de un solo bocado, y con ella no había nada que defender: la criatura pasaba de hambre 0,70 a 0,16 en 1,4 s.

El caso 20 hace veinte rondas de 60 s con una sola raíz en medio y las dos hambrientas (0,7) a la misma distancia, con tres parejas: dos pacíficas, una agresiva (0,9) y una pacífica, y dos agresivas. Resultados con 10 semillas, medianas:

| Pareja | Bloqueos | Empujones | Parte de la comida de la agresiva |
|---|---|---|---|
| Dos pacíficas | 0 (esperan en vez de intentar) | 1 | |
| Agresiva y pacífica | 0 | 2,5 (la pacífica 0) | **0,95** |
| Dos agresivas | 0 | 1 y 1 | |

- **El conflicto no se resuelve a golpes.** La agresiva se lleva el 95 % de la raíz (10 de 10 semillas), pero casi sin empujar: va directa a comer mientras la otra hace otras cosas (en una prueba previa con fruta, jugaba con la pelota o exploraba; con la raíz no se miró), así que gana por motivación y llegada, no por violencia. Entre pacíficas, la que llega segunda espera.
- **Dos agresivas no se pelean** en estas condiciones (1 empujón cada una). Hace falta una forma de que ambas lleguen a la vez y quieran comer a la vez, o que el hambre pese más que el juego.
- El mecanismo existe y es medible, pero **la agresión por disputa no emerge sola** con los pesos actuales. Queda informativo (0/10).

Qué se aprende: con la comida pobre y duradera hay competencia real, y la frustración por quedarse sin ella tiene origen. Falta que la disputa sea inevitable. Puede hacerse con menos comida, con más hambre, o con una pacífica menos distraída. Lo dejé sin ajustar para no pesar los parámetros hasta que salga la conducta.

### Carroñeo y depredación (caso 21)

Con `agresion`, al morir una criatura su cuerpo queda donde cae como un objeto comestible (`cadaver`: 6 porciones de 0,3, algo de toxicidad y caduca a los 500 s). **No hay ninguna recompensa por matar.** Matar y comer quedan a pocos segundos porque el cuerpo aparece en el sitio, así que el crédito retrasado de siempre liga el ataque con la comida.

Faltaba un motivo para atacar a algo débil. Se añadió un **interés depredador** (`pesoPresa`) que reúne hambre, haber comido carne antes (lo que la memoria espera de probar un cadáver, o sea, **se aprende carroñeando**) y una criatura que se ve débil (angustiada, quieta o más pequeña). Su peso crece con lo que atacar le haya dado de comer (el mismo crédito retrasado), con una base pequeña (0,1) para que no sea una orden. Sin haber probado carne nunca, no hay interés. El valor de `pesoPresa` (24) se eligió tras probar 2, 6, 14 y 24: con 2 la depredación casi no aparece, con 6 aparece en la mitad de las semillas.

El caso 21 hace tres rondas de 90 s con solo un cadáver ya hecho (carroñeo) y ocho rondas con una presa vulnerable (salud 0,3) inmovilizada, mortalidad permanente, en tres brazos: carroñeó antes y las presas dejan cuerpo, carroñeó antes y no dejan cuerpo, y nunca probó carne. Resultados con 10 semillas:

| Qué se mira | Resultado |
|---|---|
| **Carroñeo** | Come el cadáver que ya estaba: 6 bocados de mediana, 10 de 10 semillas. Nadie se lo enseña. |
| **Depredación** | Mata una mediana de 4 presas en 8 rondas (hasta 8) y se las come (8 bocados de mediana). Pasa 7 de 10 semillas. |
| **Sin haber probado carne** | Mata menos que quien carroñeó antes (7 de 10 semillas). Mediana 0. |
| **El cuerpo refuerza** | Con cuerpo mata más presas que sin él (4 frente a 3 de mediana). Lo cumplen 5 de 10 semillas. |

- Es lo previsto en el plan: carroñeo, luego interés por criaturas vulnerables, luego ataque y consumo. Comer un cadáver no enseña a matar por sí solo (hace falta además el hambre y ver a alguien débil).
- **La depredación sin cuerpo no desaparece del todo** (3 presas de mediana): el interés tiene una base y no se extingue enseguida si atacar no da comida.
- El primer montaje no mataba a nadie. Se debía a que la presa se creaba como "protegida" y no podía morir, no a la conducta: lo anoto porque costó varias pruebas verlo.
- Queda informativo (6/10 antes de la fatiga de combate del caso 24 y 4/10 después). Siguen sin hacer el canibalismo con criaturas adultas de la misma sala, la selección de rasgos físicos (colmillos, garras) y que la presa pueda huir.

### Manías por el aspecto y por la conducta (caso 22)

Una criatura puede coger manía a un rasgo físico (los cuernos, por ejemplo) o a una conducta, a partir de lo que ha vivido, y la aplica a criaturas que no conoce. Detrás de `gustos` (apagado por defecto).

- **Cuernos** (`Cuerpo.cuernos`, de 0 a 1, heredable y a 0 por defecto): se perciben como angulosidad, menos redondez. Se probó antes como brillo y se descartó, porque el brillo alto ya se asocia con peligro (los focos que dan descarga). No hay dibujo de cuernos todavía, solo el rasgo y su efecto. Si ninguno de los padres tiene, el hijo no tiene (no hay mutación desde cero).
- **Gustos por aspecto.** Cuatro rasgos (tamaño, color cálido, color verde y cuernos). Cada experiencia mala con una criatura (daño, y luego rechazo) baja el gusto por sus rasgos, y cada buena (compañía, un premio tras el maltrato) lo sube. Se aplica a cualquiera que los tenga: cuenta al acercarse (`pesoGusto`) y en cuánto afecto se crea al convivir.
- **Fama por conducta.** Si ve pegar a otra criatura que no es ella (`ultimoGolpe`), queda con fama de pegar (`reputacion`) y la prefiere menos, aunque a ella nunca le haya hecho nada.

Resultados con 10 semillas:

| Condición | Llega antes a la nueva sin cuernos |
|---|---|
| Maltratada por una con cuernos | **1,00** |
| Maltratada por una sin cuernos | **0,00** |
| Sin maltrato (compañera de cuernos intermedios) | 0,52 |

- La manía se generaliza en las dos direcciones: los tres criterios por aspecto pasan 10 de 10 semillas. Al principio el gusto por un rasgo se promediaba entre los cuatro y quedaba diluido (8 y 9 de 10), y se pasó a sumar para que una manía fuerte pese (hace falta, además, para decidir una pareja).
- Tras ver pegar a una tercera, la fama es de 1,0 y prefiere a la pacífica el 85 % de las veces de mediana, pero solo 5 de 10 semillas cumplen el criterio (en algunas no hay preferencia).
- Un hallazgo que cambió el control: con una compañera sin cuernos, la criatura cogía gusto por los sin cuernos solo por convivir (0,78), porque la convivencia agradable también enseña a querer los rasgos de quien convive. Es el comportamiento diseñado. El control justo es una compañera de cuernos intermedios.
- Pasan los cuatro criterios a la vez 6 de 10 semillas en la última pasada completa. Queda informativo.

## Protocolo para cambios globales

Los casos 05, 06, 07 y 08b se corren antes y después de cualquier cambio en percepción, aprendizaje o decisión, con las mismas semillas, y no se cambia un criterio sin dejar escrito por qué y con qué resultados previos. Resultados de esta tanda (10 semillas):

| Caso | Antes | Después del canal de alivio, la corrección del reloj y el nuevo 08b |
|---|---|---|
| 01, 02, 03, 04, 13 | 10/10 cada uno | igual |
| 03b | 9/10 | 9/10 |
| 04b | 9/10 | 9/10 |
| 05 | 8/10 | 8/10 (16/20 con 20 semillas) |
| 06 | 10/10 | 10/10 |
| 07 | 9/10 | 9/10 (16/20 con 20), título y lectura cambiados |
| 08 | 9/10 | 9/10 |
| 14 | 9/10 | 9/10 |
| 07b | 4/8 en el aprendizaje | 2/10, y 3/10 en el aprendizaje, porque el efecto estaba inflado por el reloj |
| 08b | 5/10 | 8/10, con un diseño distinto y una medición nueva |

Únicas modificaciones de criterio: el título y la hipótesis del 07 (el criterio es el mismo) y el diseño completo del 08b y el 07b, que son informativos. El 03b bajó a 8/10 con un intento intermedio (recortar el mérito de una aparición que se llevaba otra criatura) y se retiró.

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
- **Corrección del reloj** en los casos que restauran criaturas vividas (`reiniciarReloj`), que explicaba las 200 pulsaciones del 07.
- **El 05b** con siete variantes y 20 semillas (distancia, pelota, sociabilidad; latencia y rachas).
- **Canal de alivio** (`C.alivio`) para la angustia ajena, con acercarse, quedarse y alejarse como opciones, y el control apareado del 08b.

## Pendiente

- **Casos 09 a 12** (perro guardián, depredador, recolector, solución imprevista): necesitan herramientas de entrenamiento más finas (recompensar por estar en una zona y no solo por una acción, marcadores, barreras) y transporte de objetos.
- **Estados ajenos más allá de la angustia**: el 08b ya aprende el efecto de lo que hace sobre la angustia de otra. Falta que estime lo que quiere o teme (un modelo pequeño de la otra) y el resto de los casos 19 a 38 (`docs/vida-artificial-casos-extremos.md`): piden planificación, memoria de trabajo, señales aprendidas y transmisión cultural.
- **Aprendizaje por observación de verdad** (el 07b dice que hoy no lo hay): la compañera enseña la palanca y el efecto se mantiene al irse. Hace falta que lo que ve hacer a otra produzca un recuerdo asociado a lo que consigue, no solo a su atención.
- **Generalización del consuelo**: se traslada a una tercera criatura vinculada (08c, 15 de 20) pero no a una desconocida (08b, 0) ni se ha probado con otras causas de angustia.
- **Prueba que separe la conducta causal del control apareado**: un coste que solo pague el margen de acercarse frente a quedarse (una placa conocida en el camino).
- **Temperatura** como necesidad y entornos distintos.
- **Supabase**: tablas de criaturas, memoria, eventos y relaciones, y funciones del servidor que validen genética y recompensas. Se dejó fuera a propósito: hace falta decidir qué valida el servidor y no se quiso añadir infraestructura en este prototipo.
- **Los gemelos son solo del estado de pruebas.** El caso 13, la copia exacta de un genoma (`clonarGenoma` como gemelo) y criarlos por separado sirven para el laboratorio y no deben trasladarse a la versión final. Un segundo recinto para criar gemelos desde el juego queda descartado. En la versión final cada criatura tiene un genoma propio, y `cruzar` es la única forma de que dos se parezcan.
- **Probar en un portátil sin tarjeta gráfica** y en pantalla completa real: no se ha podido probar desde aquí.
- **Más herramientas** (marcadores, barreras, sonidos como estímulo).

## Dirección: un espacio de convivencia entre propietarios

No se plantea un santuario ni recintos protegidos de distintos tipos. El objetivo es un espacio de convivencia experimental. Los jugadores llevan criaturas de procedencias distintas y observan qué ocurre cuando interactúan libremente. Nadie tiene que formar equipos, competir ni cooperar. Cada jugador lleva un organismo con una historia propia a un entorno donde encontrará otros con historias diferentes, y no se sabe de antemano si se harán amigos, se ignorarán, se temerán o aprenderán algo unos de otros.

Todo esto sigue oculto a los jugadores hasta que el DM decida abrirlo. Hoy la página es solo de administración.

### El espacio

- Un hábitat compartido y persistente.
- Criaturas de distintos propietarios.
- Objetos y elementos ambientales comunes.
- Espacio para explorar, descansar, esconderse y relacionarse.
- Un registro de acontecimientos que permita ver qué pasó mientras nadie estaba conectado.

### Autoridad sobre las criaturas

Cada jugador solo interviene directamente sobre sus propias criaturas.

| Acción | Sobre las propias | Sobre las ajenas |
|---|---|---|
| Premiar | Sí | No |
| Asustar o dañar | Sí | No |
| Alimentar directamente | Sí | No |
| Observar | Sí | Sí |
| Provocar encuentros | Sí, mediante el entorno | Indirectamente |
| Retirar del recinto | Sí | No |
| Reproducción | Según permisos futuros | Requiere autorización |

No poder intervenir sobre una criatura ajena no impide influir en ella de forma indirecta. Se puede premiar a la propia por acercarse a otra, pero no premiar a la otra por responder. Si se desarrolla una relación, será consecuencia de las experiencias de cada una.

### Relaciones entre criaturas de distintos propietarios

Las relaciones no son simétricas ni tienen categorías fijas como amigo, enemigo o pareja. Son conjuntos de recuerdos, asociaciones y preferencias de cada individuo. Casos que se quieren poder observar:

- Reconocimiento. Dos criaturas recuerdan haberse conocido en encuentros anteriores.
- Preferencias. Una busca a ciertas criaturas y evita a otras.
- Afinidad desigual. A considera a B una compañera y B apenas le presta atención.
- Rivalidad. Dos criaturas compiten repetidamente por los mismos recursos.
- Imitación. Una empieza a usar objetos después de observar a otra.
- Dependencia. Una se inquieta cuando una compañera habitual abandona el recinto.
- Rechazo aprendido. Una mala experiencia cambia su conducta hacia un individuo concreto.
- Amistades inesperadas. Dos criaturas de personalidades aparentemente incompatibles pasan mucho tiempo juntas.

Lo que ya existe y se aprovecha. Cada criatura guarda sus propios vínculos con un afecto por individuo (`vinculos` en `memoria.ts`), así que la asimetría ya es posible, y recuerda avistamientos concretos. El 06 mide la compañía, el 08b el consuelo ligado al vínculo y el 07b muestra que la imitación todavía no existe como aprendizaje.

### Controles del propietario

El comportamiento molesto de una criatura ajena no se elimina artificialmente, porque es parte de lo que se quiere observar. Lo que se garantiza es que el propietario conserva el control sobre la participación de las suyas.

- Retirar su criatura en cualquier momento.
- Decidir si entra o no en espacios públicos.
- Consultar su historial de experiencias.
- Bloquear encuentros con determinados individuos.
- Los espacios tienen límites de población y condiciones ambientales.

### Etapas

Se empieza ampliando el laboratorio, no con Supabase ni con la interfaz pública.

| Etapa | Objetivo |
|---|---|
| 1 | Dos criaturas con genomas, memorias y propietarios distintos en una misma habitación. |
| 2 | Reconocimiento persistente entre individuos. |
| 3 | Preferencias y rechazo basados en experiencias individuales. |
| 4 | Interacciones sociales que produzcan aprendizaje en ambas criaturas. |
| 5 | Salida y reencuentro. Comprobar si recuerdan su relación después de separarse. |
| 6 | Trasladar el experimento a un recinto compartido persistente en Supabase. |

Condición técnica. La identidad de una criatura es permanente, esté o no conectado su propietario, y sus recuerdos sobre otras criaturas sobreviven a su salida del recinto. Hoy los identificadores de criatura son números locales de cada sala (1000 + id), así que habrá que darles una identidad global antes de la etapa 6.

Cada etapa llega con su caso en el laboratorio, con control y semillas múltiples, como el resto.

## Casos propuestos 16 y 17: reconocimiento persistente y relaciones asimétricas

El 16 y el 17 están construidos (ver "Reconocimiento persistente" y "Afinidad desigual" arriba). Van antes del caso 15, que necesita que las criaturas recuerden a individuos concretos y no solo asocien algo grande con miedo.

### Identidad y reconocimiento son cosas distintas

- La **identidad global** es infraestructura. Dice qué criatura es, esté donde esté. Hoy los identificadores son números locales de cada sala (1000 más el id), así que hará falta uno global antes de llevar criaturas de una sala a otra o a Supabase.
- El **reconocimiento** es conducta. Que otra criatura la haya aprendido a identificar por sus experiencias. Tener un identificador no regala familiaridad, apego ni confianza. Solo permite que los recuerdos mantengan su continuidad. El afecto, la preferencia y el rechazo se siguen ganando viviendo.

Una observación sobre el código. Los vínculos y avistamientos se guardan hoy por identificador, que es una etiqueta perfecta. Una impostora de aspecto parecido nunca se confundiría con la original por esa vía. El caso 16 tiene que decir si el reconocimiento va solo por la etiqueta o también por lo que se percibe (aspecto, olor, voz), que es lo que se espera de un fenómeno de conducta.

### Caso 16: rostros que regresan

| Fase | Experimento |
|---|---|
| Convivencia | Dos criaturas de propietarios distintos se conocen |
| Separación | Una abandona el entorno |
| Intermedio | La que se queda convive con otras criaturas |
| Reencuentro | Regresa la original, en la misma sala o en otra |
| Control | Aparece una desconocida de aspecto parecido |

Se mide el tiempo hasta acercarse o evitarla, la diferencia de conducta entre conocida y desconocida, la recuperación de asociaciones anteriores (lo que la conocida le hizo ganar o perder), la persistencia tras distintos periodos de separación y qué pasa si regresa a otro espacio. También el caso inverso. Que reconozca a alguien con quien tuvo una relación mala, para que el sistema no aprenda solo a recordar amistades.

Se hace en el laboratorio, simulando el cambio de propietario y de sala, sin Supabase ni espacios públicos reales.

### Caso 17: relaciones asimétricas

Criaturas de propietarios distintos que desarrollan relaciones desiguales (A busca a B y B apenas presta atención a A), preferencias y rechazos aprendidos por individuo. Es la etapa 3 y 4 del espacio de convivencia.

### Orden

1. Caso 16, reconocimiento persistente.
2. Caso 17, relaciones asimétricas.
3. Caso 15, amenaza colectiva, intervención y memoria del enfrentamiento.
4. Espacios públicos, con criaturas de historias independientes.

Antes de nada, y sin ser requisito para seguir, queda la prueba de la placa dañina en el camino para el 08c, con varios niveles de daño y sin cambiar los pesos de decisión. Mide si la asociación aprendida puede imponerse a un coste real, no si hay comprensión causal.

## Ritmo de juego: cuidar una criatura (propuesta)

Referencia: el juego *Creatures*. El jugador no dirige cada acción. Las criaturas comen, duermen, exploran, juegan y se relacionan por iniciativa propia, y el jugador hace de cuidador que enseña, recompensa, corrige y protege. No se copian los kits bioquímicos ni las órdenes por texto, solo las decisiones de diseño que hacían interesante el juego.

### Lo que ya hay

- Premiar y asustar (`recompensar` y `asustar` en `criatura.ts`, botones y atajos en la interfaz). Actúan sobre lo último que hizo la criatura con algo, hasta 6 s antes, y no tienen enfriamiento. Son instantáneas, y el caso 18 mostró que esa inmediatez es lo que permite ligar el premio a la acción (una fruta que se come 9 s después ya no se liga).
- Autonomía: necesidades, emociones, memoria y utilidad deciden qué hace sin que nadie intervenga.
- Ficha con necesidades, rasgos y memorias, y simulación fuera de línea de hasta 8 h.
- **Modo observación** (botón Observar, oculta los paneles), **pestaña Historia** (un diario por criatura con sus episodios recordados, con día y hora) y **resumen al volver** de una ausencia larga. Ya existían cuando se propuso esto como pendiente.

### Decisiones

- **Sin enfriamiento artificial en premiar.** Lo que importa es que cada intervención tenga un efecto de aprendizaje y que el jugador pueda ver sus consecuencias, y que premiar o castigar justo después de la conducta sea lo que funciona. En un espacio compartido con muchos propietarios puede hacer falta un límite blando por criatura. Se decide cuando exista.
- **Castigar con mucha frecuencia tiene que tener coste.** Hoy `asustar` solo suma miedo y asocia un susto a lo último que hizo. Falta que una criatura asustada a menudo termine temiendo a quien la asusta (un vínculo con el jugador que pueda ser negativo) y asocie el castigo equivocado, como evitar comer. Sin eso castigar sale gratis.
- **La imprevisibilidad es parte del juego.** Las criaturas pueden distraerse, insistir en algo inútil o no hacer caso. No se corrige.
- **El ritmo no depende de hacer clic.** El jugador observa unos minutos, detecta algo que le interesa, interviene y ve cómo cambia la conducta. Para un grupo de D&D que entra de tarde en tarde, lo que más pesa es volver y enterarse de qué pasó.

### Ciclo de juego

1. Observar. Descubrir qué hace por iniciativa propia.
2. Interpretar. Consultar necesidades, emociones, recuerdos y relaciones.
3. Intervenir. Premiar, corregir, acercar objetos o cambiar el entorno.
4. Esperar. Dejar que procese la experiencia.
5. Descubrir. Ver cómo cambia la conducta y cómo esa experiencia afecta a su vida posterior.

### Pendiente de interfaz, por valor y coste

- [ ] **Diario compartido entre criaturas.** Lo que hay es un diario por criatura (Historia). Falta una línea de tiempo común con los acontecimientos de todas, ordenados, para ver de un vistazo quién hizo qué a quién mientras no se estaba (un encuentro, un golpe, un premio, una pelea). Se puede construir con las memorias episódicas y el registro. El modo observación ya existe.
- [ ] **Retroalimentación visible de premiar y asustar,** sin abrir un panel de administración: que se vea que la criatura lo ha relacionado con lo que hacía.
- [ ] **Vínculo con el jugador** (negativo posible), para que el castigo excesivo tenga consecuencia.
- [ ] **Mano interactiva** (acariciar, llamar la atención, señalar, entregar objetos). Medio.
- [ ] **Órdenes aprendidas.** Instrucciones que la criatura pueda comprender, aceptar o ignorar. Caro: exige aprender palabras y asociarlas a conductas, y todavía no hay aprendizaje por observación del resultado (07c). No se aborda pronto.

Todo esto sigue oculto a los jugadores hasta que el DM decida abrirlo.

## Conflicto, agresión, depredación y evolución del organismo (propuesta)

El caso 18 cría una hostil con un premio inmediato del cuidador, y funciona, pero no hay una agresión que surja de un conflicto real. Esto plantea que surja de conflictos por recursos, se aprenda y, a lo largo de generaciones, transforme conducta y organismo. Tres procesos separados.

- **Conflicto.** Una criatura intenta obtener un recurso que otra está usando.
- **Agresión aprendida.** Descubre que ciertas acciones dañinas o intimidatorias le dan resultados.
- **Evolución biológica.** La descendencia hereda predisposiciones y rasgos físicos que favorecen esas estrategias. No hereda las experiencias concretas de los padres: así lo prueba hoy el caso 14, y el caso 18 no debe cambiarlo.

El jugador no tiene botón de atacar. Provoca situaciones con hambre, escasez, competencia y criaturas de distinto carácter, y observa.

### 1. Conflicto por comida

Comer tiene una duración y la comida se desgasta. Hoy una fruta ya se gasta por porciones, un mordisco cada 1,4 s, pero nada impide que otra criatura coma a la vez, ni hay forma de defender la comida o de que la ocupada se note. El ciclo:

1. Una criatura empieza a comer y la comida pierde cantidad mientras permanece ocupada.
2. Otra hambrienta detecta que se agota. Puede esperar, buscar otra, desplazar a la primera o retirarse.
3. Si intenta desplazarla, la que come puede ceder, proteger el alimento o responder.
4. Si ambas persisten, el conflicto escala.

Personalidad, hambre, tamaño, experiencias y vínculo influyen en el resultado. Una hambrienta no empuja automáticamente: primero tiene predisposición o ha aprendido que empujar a otra le da acceso al recurso. Esto resuelve lo que dejó abierto el caso 18. Con la comida ocupada, el desplazamiento y el acceso a comer ocurren en segundos, dentro de la ventana de crédito de 9 s, y la frustración de quedarse sin ella tiene un origen real.

### 2. Rutas de agresión (no una única estadística)

- **Defensa de recursos.** Empujones, cabezazos, coces, embestidas y amenazas. Sin consumir carne.
- **Depredación.** Acechar, perseguir, sujetar, morder y desgarrar. Otras criaturas como comida.
- **Carroñeo.** Comer cadáveres o restos sin haber matado. Puede preceder a la depredación, pero no conduce a ella por sí solo.
- **Agresión territorial.** Ahuyentar intrusos, también sin hambre.

Una criatura puede combinar varias.

### 3. Canibalismo y aprendizaje depredatorio

Por etapas: descubrir restos y probarlos, asociar que reduce el hambre, relacionar movimiento, tamaño o heridas con oportunidades, descubrir que puede herir, aprender que una criatura muerta se convierte en alimento y anticipar situaciones en que pueda obtener carne. Comer un cadáver no debe enseñar a matar. Eso tiene que salir de experiencias en que atacar o perseguir resultaron favorables. Tras matar tiene opciones: comer, abandonar, defender el cadáver, seguir atacando o retirarse saciada.

### 4. Que la conducta transforme el organismo

La transformación es lenta y por herencia y selección, nunca una garra tras una pelea. Los rasgos tienen costes (pesado y fuerte frente a ágil, garras largas frente a manipular, mandíbula especializada frente a otras comidas).

| Conducta favorecida | Rasgos heredables |
|---|---|
| Empujar y embestir | Cráneo robusto, cuello fuerte, cuerpo pesado |
| Cazar con mordidas | Mandíbula potente, dientes puntiagudos |
| Sujetar y desgarrar | Garras curvas, extremidades anteriores fuertes |
| Perseguir | Piernas largas, cuerpo ligero, resistencia |
| Acechar | Postura baja, movimientos silenciosos, camuflaje |

Puntos que hay que cuidar:

- **Imitación de la descendencia.** Si la descendencia debe parecerse a la madre en conducta, hay dos vías distintas. Una es genética (predisposiciones heredadas). La otra es aprender de verla, que hoy no existe como aprendizaje del resultado (07c). Mientras no exista, el parecido vendría solo por genes o por realce del estímulo.
- **Selección.** La evolución necesita reproducción diferencial. Con la cría manual del jugador (`Criar`), la selección es artificial, como en el caso 14. Una selección natural exige que mueran y se reproduzcan por su cuenta, y eso no está.
- **Cuerpo y arte.** El genoma ya tiene campos de cuerpo (orejas, cola, patas, cabeza), pero no colmillos, garras ni postura. Hay que ampliar `Cuerpo` y los dibujos.
- **Espacios.** Decidido: habrá espacios libres, donde estar ya es aceptar lo que pase, admitidos entre varios jugadores y privados (ver "Espacios"). La agresión y la depredación entre criaturas de distintos propietarios se limitan a los libres. No hace falta un permiso por criatura.

### 5. Orden de implementación

1. Conflicto por comida: comida consumible, duración de la ingesta, empujones y respuestas defensivas. **Hecho a medias** (caso 20): la comida ocupada y la comida duradera funcionan, la disputa violenta no emerge sola.
2. Combate básico: daño, heridas, huida, derrota y recuperación. **Hecho a medias**: el golpe daña, aturde y suelta la comida, la víctima aprende a asociar el aspecto con daño y puede responder; falta una pelea real entre dos.
3. Carroñeo: cadáveres comestibles y aprendizaje de sus propiedades. **Hecho** (caso 21).
4. Depredación: ataque a criaturas vulnerables, muerte y consumo. **Sin arrancar**: falta un motivo para atacar a algo débil.
5. Especialización conductual: comparar criaturas que aprenden a empujar, embestir o morder.
6. Herencia y selección: cambios físicos y conductuales en varias generaciones.

Antes del paso 1, corregir que el afecto no debería crecer con quien te hace daño (el caso 18 se detiene sola por esto, según la hipótesis sin comprobar).

## Reproducción: camadas, cortejo y rechazo (hecho, informativo)

Sale de una conversación sobre cómo debería comportarse la reproducción. Se recoge la lógica, en términos de conducta, y está construida detrás de `reproduccion` (desactivado por defecto).

### Reglas acordadas

- **El rechazo se respeta y no se puede forzar la reproducción,** aunque quien lo recibe se ponga agresivo. Lo que sí puede pasar son consecuencias de ese rechazo, que dependen del carácter y del entrenamiento.
- **La reacción a un rechazo es una probabilidad, en las dos partes.** Tanto la criatura que rechaza como la rechazada pueden quedar enfadadas, asustadas, indiferentes o incluso contentas. Qué reacción tiene sale al azar de su carácter y de cómo se la haya entrenado.
- **La violencia solo es posible si está enfadada y es agresiva,** y no es obligatoria. Si las dos están enfadadas y son agresivas, se pelean. La pelea es una probabilidad, no una consecuencia automática.
- **Entrenamiento.** Un premio justo después de una reacción la hace más probable, y un susto la hace menos probable (y asusta).
- **Rechazo por aspecto o por conducta.** La criatura puede desarrollar rechazo por rasgos físicos (los cuernos, por ejemplo) o por quien tiene sesgos hacia ciertas conductas. Son los gustos y la fama del caso 22, y entran en el deseo de aceptar a una pareja.
- **Aversión por castigo, reversible con premio.** Si el cuidador asusta a una criatura justo después de un acercamiento reproductivo, aprende aversión a ese sexo y a ese individuo, y se aparta de todas las del sexo opuesto, no solo de una. Un premio la baja.
- Los gemelos idénticos no se hacen (los gemelos son solo del estado de pruebas). Las camadas son de mellizos.

### Qué hay

- **Camadas.** Una cría casi siempre (80 %), a veces dos (17 %) y pocas tres (3 %), sin pasar del hueco que quede en la sala (`tamanoCamada`, `parir`; `camadaDos` y `camadaTres`). Cada cría cruza los genomas por separado. Criar a mano y el parto autónomo usan lo mismo.
- **Sexo.** Sale del genoma sin gastar azar nuevo (`sexoDe`): sobre la mitad de cada uno. Gesta quien tiene el sexo 1. Todavía no se percibe como rasgo de aspecto: se lee directamente al evaluar un cortejo.
- **Impulso reproductivo.** Sube en una adulta (edad de medio día) que no gesta, y se vacía al reproducirse. La aversión se va olvidando muy despacio.
- **Cortejo.** Reutiliza `acercarse` con intención (no hay verbo nuevo, así que no cambia la entrada de la red ni ningún caso medido). El impulso empuja a acercarse a alguien de otro sexo, más cuanto más lo quiere y le gusta, y menos con aversión.
- **Aceptación mutua.** Acepta si es adulta, no gesta, tiene impulso, la otra es de otro sexo y le apetece lo bastante. Lo que le apetece sale del afecto, del gusto por el aspecto y la conducta, de su propio impulso y se multiplica por la aversión aprendida. Una aversión aprendida por castigo puede pesar más que el cariño.
- **Gestación y parto** (`embarazos` en la simulación, 400 s): nace la camada junto a la madre, aunque el padre ya no esté.
- **Rechazo.** Las dos tienen una reacción al azar entre enfado, miedo, indiferencia y alegría (`reaccionAlRechazo`). El enfado de una agresiva puede traducirse en represalia; el miedo y el enfado enfrían el afecto por ese individuo; la alegría y la indiferencia no dejan resentimiento. Recibir un golpe enfada a una agresiva, y responder depende de estar enfadada (la represalia es proporcional a la frustración).

### El caso 23, partido en 23 y 23b

El 23 original juntaba nueve criterios en una sola prueba (3 de 8 semillas con todos) y era frágil y lento (unos 3,5 minutos). Se partió en dos con una función común para la pareja: el **23** (cortejo y aceptación) y el **23b** (rechazo, reacción y pelea). Con 10 semillas:

| Caso y criterio | Semillas que lo cumplen |
|---|---|
| 23, se quieren y se reproducen (mediana 0,70) | 7 de 10 |
| 23, desconocidos: hay rechazos y no hay embarazo | 7 de 10 |
| 23, el castigo deja aversión y deja de reproducirse | 10 de 10 |
| 23, la manía por los cuernos rechaza al que los tiene y acepta al que no | 5 de 10 |
| 23b, las agresivas se enfadan más que las pacíficas | 10 de 10 |
| 23b, la violencia es de las agresivas | 10 de 10 |
| 23b, la pelea mutua depende del carácter | **4 de 10** |
| 23b, el entrenamiento cambia la reacción (enfado 0,46, 0,85 con premio, 0,07 con susto) | 10 de 10 |
| 23b, el rechazo se respeta | 10 de 10 |

La pelea mutua bajó de una probabilidad de 0,90 a 0,20 en las agresivas tras añadir la fatiga del caso 24: las peleas acaban pronto y ya no llegan a que las dos golpeen dos veces. Es una consecuencia esperada de la calma, no un fallo del rechazo.

### El caso 23 original (antes de partirlo)

Parejas adultas de sexos distintos que ya conviven (1500 s previos para que haya afecto), con 5 réplicas por brazo, 8 semillas. Resultados de mediana:

| Qué se mira | Resultado |
|---|---|
| Se quieren, impulso, cortejo y aceptación | Se reproducen el 90 % de las réplicas (6 de 8 semillas pasan). |
| Desconocidos | Hay rechazos (mediana 26) y se reproducen el 20 % (5 de 8 semillas pasan el criterio). Con insistencia el afecto crece y a veces acaban aceptando. |
| Castigo tras 3 acercamientos reproductivos | 0 % se reproduce (8 de 8 semillas), con aversión de 0,61. |
| Reacción al rechazo según carácter (muestreada) | Enfado 0,46 en agresivas frente a 0,11 en pacíficas. |
| Entrenamiento de la reacción | Enfado base 0,43, tras premiar el enfado 0,84, tras asustarlo 0,06 (8 de 8). |
| Violencia | Solo en agresivas: 0,90 de las réplicas frente a 0 (8 de 8). |
| Pelea mutua | 0,90 de las réplicas de agresivas frente a 0 en pacíficas (7 de 8). |
| El rechazo se respeta | Ningún embarazo por haber peleado (8 de 8). |
| Manía por los cuernos | Con una manía fuerte por los cuernos, rechaza al pretendiente con cuernos (10 %) y acepta más al que no los tiene (60 %). Pasa 4 de 8. |

- Pasan los nueve criterios a la vez 3 de 8 semillas. Queda informativo.
- **Las agresivas muy agresivas se pelean sin necesidad de un rechazo.** Con agresividad 0,9 las dos, el empujón de tanteo inicial basta para que se enzarcen. Por eso la parte de rechazos de las agresivas es poca y la violencia media es alta. No se ha aislado cuánto de la pelea es por el rechazo y cuánto por el carácter.
- **Pelea de verdad.** Con las dos enfadadas y agresivas se golpean de 4 a 19 veces cada una, y acaba cuando el miedo hace huir a una. Para que respondiera se necesitó un peso de represalia de 5 (con 1,4 solo pegaba una). Con ese peso, si la represalia se aplica a cualquier agresiva, convivir acaba en peleas sin fin. Por eso es proporcional al enfado.
- **El afecto debe construirse antes.** Con 600 s de convivencia la pareja que se quiere se quedaba justo en el umbral de aceptación y se rechazaba a sí misma por azar. Con 1500 s se reproduce.
- **La manía por los cuernos es débil para decidir una pareja.** Una criatura con la manía dada por hecho (no aprendida en esta prueba, lo aprendido está en el caso 22) rechaza al pretendiente con cuernos pero no acepta del todo al otro (60 %).

### Pendiente

- Percibir el sexo como rasgo de aspecto (hoy solo se lee el sexo del genoma al evaluar), y que el aprendizaje de aversión por sexo se generalice por parecido.
- La selección de rasgos físicos (cuernos, colmillos, garras) a lo largo de generaciones, y su dibujo.
- Límites de población por espacio, más allá de las cuatro criaturas de la sala actual.
- Un caso que aísle el efecto del rechazo en la pelea del efecto del carácter.

## Calma y recuperación tras una pelea (caso 24)

Hasta ahora una pelea entre agresivas no se apagaba nunca: cientos de golpes (en el caso 23) o hasta que el sueño acumulado paraba a la agresora (caso 18). Lo sostenían tres cosas. Cada golpe sin recompensa en el momento sumaba 0,18 de frustración al que golpea (la regla de «esperaba algo y no llegó»), cada golpe recibido enfadaba a la agresiva golpeada, y la frustración renovada mantenía arriba el término de represalia.

Se añadió un único estado, la **fatiga de combate** (`fatiga`, de 0 a 1), reutilizando lo demás (frustración, miedo, salud y su regeneración, la huida por amenaza aprendida y `descansar`). No hay estados nuevos de personalidad ni un sistema de heridas, ni intimidación.

- **Sube** con cada golpe dado o recibido, más si pelea con miedo o herida (`fatigaPorGolpeDado`, `fatigaPorGolpeRecibido`).
- **Frena** empujar a otra (`pesoFatiga`) y **empuja a descansar** (`pesoDescansoFatiga`, y una pequeña ayuda por estar herida, solo con la agresión activada).
- **Calma la frustración más deprisa** cuando es alta (con fatiga por encima de 0,4, 12 s en vez de 30).
- **Baja con el tiempo** (`tauFatiga`, 60 s), más despacio si está herida, tiene miedo, es agresiva o es de temperamento asustadizo.
- Los golpes a otra criatura ya no cuentan como un fracaso que frustre al que golpea.
- **No toca la memoria.** Quién atacó (agravios), la asociación de peligro con su aspecto y la aversión aprendida se quedan. Calmarse no es olvidar. Los pesos globales de decisión no se han tocado: los términos nuevos solo valen con la agresión activada y con fatiga.

El caso 24 prueba cinco réplicas por brazo de dos agresivas (0,9) enfadadas y con represalia mutua, en tres condiciones (sanas, heridas con salud 0,45, asustadas con miedo 0,9 y temperamento asustadizo), 900 s, y luego un reencuentro a 300 sin objetos durante un minuto. Resultados con 10 semillas:

| Qué se mide | Resultado |
|---|---|
| El combate termina | 5 golpes en total de mediana, 0 en los últimos 2 minutos (10 de 10) |
| La frustración baja | Del pico 0,99 a 0 (10 de 10) |
| Recuperan actividades normales | 10 acciones con objetos en los últimos 150 s de mediana (8 de 10) |
| Calmarse no es olvidar | Siguen asociando a la otra con daño (0,49) y guardan agravio (1,0) (10 de 10) |
| El reencuentro no provoca pelea | Probabilidad de otra pelea 0, y el 90 % se acerca (10 de 10) |
| La herida alarga la recuperación | 594 s hasta calmarse frente a 495 s en las sanas, un 20 % más (8 de 10) |
| El miedo alarga la recuperación | **No se observa** (487 s frente a 495 s; 0 de 10) |

- Que se acerquen en el reencuentro sin pelear a pesar de la aversión es un resultado emergente: nada obliga a la reconciliación ni a la huida. No he comprobado qué hacen después de acercarse.
- **El miedo.** El miedo del momento se pasa en unos 12 s y no deja efecto en la recuperación. Lo que dura es el temperamento: en aislamiento, desde fatiga 1,0, con miedo de rasgo 0,2 queda en 0,09 a los 240 s y con 0,9 queda en 0,20. Dentro de una pelea completa lo tapan otras diferencias (cuántos golpes y cuánta salud pierde cada una), por eso el criterio no lo ve. No se forzó.
- **La calma que se mide es la de combate** (fatiga por debajo de 0,1). La frustración de fondo sube con cualquier cosa sin recompensa y se mantiene aparte.
- El combate es corto: unos cinco golpes y uno de los dos se cansa o huye. Es lo que sale con estos pesos, no una decisión de diseño.
- Queda informativo (0/10 con los siete criterios a la vez, por el del miedo).
- **Efecto en la depredación (caso 21).** La fatiga y quitar la frustración de los golpes cortaron el frenesí que sostenía parte de la caza: con la fatiga puesta del todo, 0 presas muertas. Un cazador con interés depredador activo frena mucho menos con la fatiga (la quinta parte): persiste hasta someter a la presa. Con eso la depredación vuelve en parte, **4/10 semillas y 1,5 presas muertas de mediana frente a 6/10 y 4 antes**. Es el coste de que la pelea acabe sola, y se acepta.

## Quien quiere la comida de otra (caso 25, prueba de integración)

Conecta carroñeo, competencia por comida, agresión, fatiga, memoria y relaciones, sin mecánicas nuevas (sin intimidación y sin heridas complejas). Una criatura agresiva (0,9) hambrienta y otra que ya está comiendo una raíz de ocho bocados, en seis rondas de 90 s. La primera tiene o no un aprendizaje previo de carroñeo (tres rondas a solas con un cadáver, o el mismo tiempo sin él) y el defensor es agresivo (0,9) o poco agresivo (0,1). Nada fuerza un desenlace: cada una puede ceder, huir, desistir o luchar. Cuatro réplicas por brazo, ocho semillas. Después de las rondas se separan, se les quita la comida y se las pone a 300 durante un minuto.

Cada golpe se clasifica según lo que ocurría justo antes (la comida se suelta al golpear, así que hay que mirar el paso anterior): **competencia** (golpea a quien tiene la comida), **defensa** (golpea quien la tiene), **represalia**, **depredadora** (golpea a alguien que se ve débil o asustado estando hambrienta) u otra.

Resultados (medianas):

| Qué se mide | Resultado |
|---|---|
| Golpes de la carroñera | 2 contra un defensor agresivo y 4,5 contra uno poco agresivo (1 y 2 sin carroñeo) |
| Golpes del defensor | 1 si es agresivo, 0 si es poco agresivo |
| Parte de la comida de quien la quita | 0,71 y 0,91 con carroñeo previo, 0,67 y 0,88 sin él |
| Motivos de los golpes | competencia 1, depredadora 1, defensa 0, represalia 0 |
| Golpes máximos en una ronda | 3,5 (ninguna réplica pasa de 7 de máximo) |
| Pico de fatiga de combate | 0,21 |
| Rondas con golpes | 1 de 6 |
| Huidas del defensor | 65 inicios de huida (la carroñera, 14) |
| Recuerdan quién les atacó | asociación de daño o agravio de 0,96 |
| Reencuentro | pelea mutua en ninguna réplica, violencia unilateral casi nunca, y el 100 % se acerca |

- **Lo que emerge es una jerarquía en pocas rondas, no una guerra.** El primer enfrentamiento define la disputa: el defensor aprende a huir y desde entonces la carroñera come sin que haya que pelear. El combate no se convierte en una máquina de golpear (nunca más de 7 golpes por ronda) y la fatiga se aplica.
- **El carácter del defensor se nota:** el poco agresivo recibe más golpes y pierde casi toda la comida (le queda el 9 %), el agresivo golpea y conserva cerca de un tercio. Se cumple en las ocho semillas.
- **El aprendizaje del carroñeo se nota poco:** más golpes con carroñeo previo (4,5 frente a 2 contra el defensor poco agresivo), pero con pocos golpes en total. De los golpes, una parte son de competencia por la comida ocupada y otra de depredación sobre un defensor que huye asustado.
- **No se puede decir que la conducta depredadora persista:** como el defensor huye en la primera ronda, de las seis solo una tiene golpes. Falta una prueba con un defensor que no pueda huir para ver si el interés por la carne se sostiene sin combates interminables.
- **El reencuentro no demuestra recuperación de la relación.** Que todas se acerquen y no peleen es compatible con aversión, miedo o desconfianza residual: sí recuerdan (0,96), pero no se midió cómo se comportan al acercarse (distancia a la que se quedan, tiempo cerca, huida posterior).
- Pasan los ocho criterios a la vez 4 de 8 semillas. Queda informativo.

## Persistencia depredadora (caso 26)

Pregunta del caso 25: ¿sostiene la fatiga una conducta depredadora con pausas y consecuencias, sin reintroducir el frenesí infinito? Para impedir la huida en el laboratorio no hace falta ninguna regla nueva: se usa `atrapada`, la condición de laboratorio que ya usan los casos 08b, 18, 19 y 21 y que anula el movimiento de esa criatura. El comportamiento normal no cambia.

Cuatro condiciones, cinco réplicas por semilla, diez semillas: una agresiva (0,9) con carroñeo previo (tres rondas a solas con un cadáver) o sin él, frente a una presa pacífica (0,1) de salud 0,3 que puede huir o está inmovilizada. Hambre (0,7), salud, distancia (500 a 1000) y temperamentos constantes. Ocho rondas de 90 s con una presa nueva en cada una, luego una pausa de 300 s sin presa ni comida, y tres rondas más.

Por criterio (10 semillas):

| Criterio | Semillas |
|---|---|
| Inicia y mantiene intentos: con carroñeo y presa inmóvil ataca en al menos 3 de 8 rondas | 10 de 10 |
| Sin frenesí: ninguna ronda pasa de 40 golpes y hay fatiga apreciable en las ráfagas | 6 de 10 |
| El aprendizaje importa: con carroñeo previo mata más que sin él | 8 de 10 |
| La huida importa: con la presa que puede huir mata menos | **2 de 10** |
| Persiste con pausas: ataca tras una ronda sin muerte y tras la pausa de 5 minutos | 10 de 10 |
| Tiene coste: fatiga y tiempo sin alimentarse | 8 de 10 |

Por semilla (carroñeo y presa inmóvil, salvo donde se indica):

| Semilla | Rondas con ataque (con carroñeo, huye / inmóvil / sin carroñeo, inmóvil / huye) | Presas muertas (mismo orden) | Bocados de carne | Golpes máx. por ronda | Pico de fatiga | Golpes tras la pausa (con carroñeo / sin) |
|---|---|---|---|---|---|---|
| 1 | 5 / 5 / 4 / 3 | 2 / 1 / 0 / 0 | 1 | 4 | 0,33 | 2 / 0 |
| 2 | 5 / 5 / 3 / 3 | 0 / 1 / 0 / 0 | 1 | 3 | 0,19 | 2 / 0 |
| 3 | 6 / 4 / 2 / 3 | 1 / 1 / 0 / 0 | 1 | 4 | 0,16 | 0 / 0 |
| 4 | 4 / 4 / 3 / 3 | 2 / 0 / 0 / 0 | 0 | 4 | 0,14 | 0 / 1 |
| 5 | 7 / 6 / 3 / 3 | 2 / 3 / 0 / 0 | 3 | 4 | 0,24 | 3 / 0 |
| 6 | 4 / 5 / 2 / 3 | 2 / 1 / 0 / 0 | 2 | 4 | 0,15 | 2 / 0 |
| 7 | 7 / 7 / 3 / 2 | 2 / 2 / 0 / 0 | 3 | 4 | 0,28 | 5 / 1 |
| 8 | 8 / 8 / 3 / 3 | 4 / 4 / 0 / 0 | 5 | 4 | 0,24 | 5 / 0 |
| 9 | 4 / 5 / 3 / 4 | 1 / 1 / 0 / 0 | 0 | 4 | 0,18 | 0 / 0 |
| 10 | 3 / 3 / 2 / 3 | 0 / 0 / 0 / 0 | 0 | 2 | 0,08 | 0 / 0 |

- **No hay frenesí.** Ninguna ronda pasa de 4 golpes (el máximo es 4, con rangos de 2 a 4). La fatiga se aplica (pico mediano de 0,19, de 0,08 a 0,33). Con cuatro golpes no queda sitio para un ataque interminable, y a la vez no se lograron ráfagas largas: es lo que sale con la fatiga actual y no una decisión de diseño.
- **El interés depredador mantiene intentos con pausas.** Con carroñeo previo ataca en unas 5 de las 8 rondas (sin él, en 3, el tanteo de fondo de la agresividad); tras una ronda sin muerte vuelve a atacar en alrededor del 57 % de los casos (ocho semillas); y tras la pausa de 5 minutos ataca en 1 de las 3 rondas siguientes de mediana (con carroñeo; sin él, en ninguna).
- **Mata poco, y solo con aprendizaje.** Con carroñeo, 1 presa de 8 de mediana con la presa inmóvil y 2 con la que puede huir; sin carroñeo, 0 (en ninguna semilla de ninguna de las dos condiciones). Y come la carne que mata: 1,5 bocados de mediana (0 a 5). Tras la pausa casi no mata (mediana 0).
- **Poder huir no importa en esta prueba (2 de 10).** Contra lo esperado, la presa que puede huir no muere menos (mediana 2 frente a 1). La explicación probable, sin comprobar, es que cada presa es nueva y no sabe nada del cazador: no reconoce el peligro hasta el primer golpe y, para entonces, con cuatro golpes por ronda la caza ya se ha decidido. Esta prueba no distingue el efecto de la huida; haría falta presas con memoria del cazador.
- **Coste.** El cazador acaba la ronda sin comer en casi todas (el primer bocado casi nunca llega en 90 s; el hambre media es de 0,80), paga fatiga (hasta 0,33) y su salud mínima es de 0,71 también con la presa inmóvil, que no puede devolver golpes, así que probablemente viene del hambre prolongada y no de las peleas (no se comprobó).
- **Con la presa a medio morir (salud 0,5)** en una versión previa del caso, el cazador daba también unos 5 golpes por ronda pero casi nunca llegaba a matar (0 o 1 presa en 8 rondas): la fatiga lo detenía justo cuando necesitaba un golpe más. La caza solo cierra contra presas ya debilitadas.
- Queda informativo (1 de 10 con los seis criterios a la vez).

Lo que dice esto de la fatiga: permite una conducta depredadora sostenida con pausas y consecuencias, pero la limita a presas vulnerables y deja la caza lejos de ser eficaz. Si se quisiera una depredación más eficaz sin frenesí, habría que ajustar la fatiga del cazador con interés depredador (hoy frena a la quinta parte), y eso no se ha tocado.

## Atención social y celos (caso 27)

Primer paso del diseño aprobado de celos y envidia: la señal de atención social y los celos. La envidia (caso 28) queda pendiente hasta que esta señal esté validada por separado.

### La señal de atención social

Archivo `nucleo/social.ts`. Cada observadora calcula por su cuenta lo que ve de las demás. Nadie guarda «a quién atiendo», así que quien mira no recibe información de vínculos ni de intenciones ajenas.

- Una criatura A atiende a B en un instante si está viva, despierta y no incapacitada, B está a menos de `atencionAlcance` (170), A mira hacia B y A no va de paso (velocidad menor que `atencionVelocidad`, 60).
- Hace falta que eso dure `atencionPermanencia` (3 s) sin cortes de más de `atencionContinuidad` (1,5 s). Estar cerca no basta. La señal desaparece 1,5 s después de que se corte la postura.
- Solo se calcula para las criaturas dentro del campo de visión de la observadora (el de su genoma, ampliado un 30 %), y solo cuando el interruptor `celos` está encendido. Con él apagado no se ejecuta nada.
- Es reutilizable: el seguimiento (`SeguimientoAtencion`) responde a «cuántos segundos lleva A atendiendo a B». El aprendizaje por observación y el reconocimiento de relaciones pueden leerlo sin cambios.

### Los celos

Interruptor propio `celos`, apagado por defecto. Campos propios de la criatura (`celosEstado`, `social`), igual que la fatiga. No se tocó la red, sus entradas ni el arreglo de emociones.

- **Cuándo se activan:** hace falta un vínculo significativo (afecto de al menos `umbralVinculoCelos`, 0,3), que ese vínculo no la esté atendiendo a ella y que atienda a una tercera durante 3 s o más.
- **Cuánto suben:** proporcional al afecto por el vínculo y al apego, menos si quiere a la tercera, más con soledad y más si el vínculo la atendía antes. El nivel sube hacia 1 sin pasarse.
- **Cuánto duran:** decaen con una constante de 70 s (más lenta con apego alto) y tres veces más deprisa si el vínculo vuelve a atenderla.
- **Qué cambia en la conducta:** suma a la utilidad de acercarse al vínculo (`pesoCelosAcercar`) y resta a la de actuar sobre objetos y explorar (`pesoCelosInhibe`). Si es agresiva y está frustrada, suma también a empujar a la tercera (`pesoCelosAgresion`), por la vía ya existente. No hay acciones nuevas.
- **Memoria:** al pasar de 0,5 queda un episodio de celos y un agravio pequeño (0,08) hacia la tercera.
- **No son otra cosa:** no suben la frustración ni el miedo, y sin vínculo o sin tercera atendida no se activan.

### Resultados del caso 27

Cuatro condiciones más el interruptor apagado, cinco réplicas por semilla, 10 semillas. La escena deja quietas a la vínculo (V) y a la tercera (T), a distancia visible de la criatura con celos (O), y V mira a T durante 60 s o mira al lado contrario. Las posturas se fijan en el montaje porque tanto V como T están inmovilizadas con la condición de laboratorio `atrapada` y podrían girarse solas (en una versión previa esto dejaba entrar de 4 a 8 s de atención espuria en el control sin atención).

| Condición | Atención vista a T (s, mediana) | Celos (máx., mediana) | Tiempo cerca de V en el estímulo (s) |
|---|---|---|---|
| Vínculo fuerte y tercera atendida | 59,9 | **0,95** (0,61 a 0,99) | **57,8** |
| Vínculo fuerte sin tercera | 0 | 0 | 31,4 |
| Vínculo fuerte y tercera sin atención | 0 | 0 | 33,4 |
| Vínculo débil y tercera atendida | 25,6 | 0 | 17,6 |
| Vínculo fuerte, tercera atendida, celos apagados | 0 | 0 | 33,4 |

Por criterio (10 semillas): los nueve criterios pasan en 10 de 10 (percepción, activación, vínculo débil, busca al compañero, juega menos, duración, memoria, no es frustración, no es agresión).

- **Conducta, no solo estado interno.** Con celos pasa más tiempo cerca de su vínculo (57,8 frente a 33,4 s con el interruptor apagado), lo busca más (más acercamientos) y juega menos con la pelota (0 frente a 3,5 impactos de mediana). Ese cambio de conducta es el que se exige además del valor interno.
- **El vínculo débil es un efecto de umbral.** Su afecto mediano es 0,07 (el fuerte, 0,67), muy por debajo del umbral de 0,3, y sus celos son 0 en las 10 semillas. La prueba no mide una gradación intermedia (por ejemplo afecto 0,3 a 0,5). Ve la atención de V a T (25,6 s de mediana frente a 59,9 en el fuerte; no se comprobó por qué es menor), pero sin vínculo no hay celos.
- **No se acerca a la tercera ni se interpone.** El tiempo cerca de T y entre ambas es 0 en todas las semillas: la conducta es buscar a V, no ir hacia T.
- **Dura lo que debe.** A la mitad del pico en 23,6 s tras acabar el estímulo y por debajo de 0,1 en 74 s de mediana.
- **No es frustración ni agresión.** La frustración no sube respecto al control y no hay golpes a la tercera (0 de mediana). La agresión por celos queda limitada a agresivas y frustradas, y en esta escena no aparece.
- **Memoria.** El episodio y un agravio de 0,08 hacia la tercera, mayor que en el control.

### Lo que no se probó y límites

- **Qué pasa en un reencuentro posterior** con la tercera (si la evita o se acerca más). Queda pendiente.
- **La escena fija la postura de V y de T.** La percepción de atención en movimiento libre no se ha medido. Con criaturas libres V cambia de postura por sus propias acciones y la señal se corta; eso es lo esperado, pero no hay un caso que lo mida.
- **Agresión por celos** se probó solo como ausencia en esta escena. No hay una condición con una agresiva frustrada que la active.
- Casos con `atrapada`: el caso 27 usa la condición de laboratorio que ya usan 08b, 18, 19, 21 y 26. No añade reglas al comportamiento normal.

### Coste de rendimiento

Medido con `tests/vida-coste.ts` (mejor de 5 tandas de 200 s, Node, el interruptor `celos` encendido en todas las criaturas frente a apagado):

| Criaturas en la sala | Apagado (µs/paso) | Encendido (µs/paso) | Diferencia |
|---|---|---|---|
| 2 | 25 | 27 | dentro del ruido |
| 4 | 43 | 42 | dentro del ruido |
| 6 | 73 | 77 | unos 5 % |
| 8 | 110 | 137 | 24 % |
| 12 | 210 | 269 | 28 % |

Hasta 4 criaturas (el máximo actual por sala, `maxCriaturasSala`) el coste no se distinguía del ruido de esta medición. Una medida posterior, que suma el tiempo propio de cada método (ver el coste de la envidia, más abajo), da de 3 a 6 % del paso hasta 4 criaturas, 11 a 13 % con 6 a 8 y un 20 % con 12. La atención se compara por pares entre las criaturas que cada observadora ve, así que crece de forma cuadrática, y en salas de 8 o más se nota. Con el interruptor apagado el coste es cero. Antes de espacios con más criaturas habría que acotar la comparación (solo vecinas, o cada pocos pasos).

## Envidia de alimento (caso 28)

Segundo paso del diseño aprobado. Interruptor propio `envidia`, apagado por defecto y independiente de `celos`. Campos propios de la criatura (`envidiaEstado`, `vistoBocado`), igual que la fatiga y los celos. No se tocó la red, sus entradas, el arreglo de emociones ni ningún peso global de decisión.

### Qué es y qué percibe

- **Qué percibe:** un bocado de otra criatura (el `ultimoComer` de la otra, que ya existe y es un hecho visible) dentro de su campo de visión (el de su genoma, ampliado un 30 %) y de los últimos 3 s. Cada bocado se cuenta una sola vez (`vistoBocado`). Si la otra está fuera de su vista, no percibe nada, aunque coma.
- **Deseo:** hambre por encima de 0,3 (escalada hasta 1) por lo que espera que le quite el hambre ese alimento (`valorDeProbar`, que mezcla lo que sabe, lo que predice la red y el prior innato de que lo que huele bien invita a probarlo). Con poco hambre no hay deseo, y por tanto tampoco envidia.
- **Acceso propio:** si ella misma ha comido en los últimos 10 s, el acceso es total. Si ve otro alimento (distinto del que come el otro, a más de 80 unidades de él), el acceso crece cuanto más cerca lo tiene (1 menos distancia/250). Con la comida al lado no hay nada que envidiar.
- **Cuánto sube:** cada bocado visto suma `tasaEnvidia` (0,35) × deseo × (1 menos 0,6 × afecto por quien come) × (1 menos acceso) × (1 menos 0,8 × fama de pegar de quien come), hacia 1 sin pasarse. No depende de ningún vínculo previo.
- **Cuánto dura:** decae con una constante de 45 s. Más deprisa (la mitad) si hace más de 8 s que no ve un bocado o ya no ve a quien comía, cuatro veces más deprisa si come ella, y tres veces más deprisa si deja de tener hambre.
- **Memoria:** al pasar de 0,5 queda un episodio (`envidia:<id>`) y un agravio pequeño (0,05) hacia quien comía.
- **Qué cambia en la conducta** (términos aditivos sobre acciones que ya existen, sin acciones nuevas): suma a acercarse a quien come (`pesoEnvidiaAcercar`, menos con miedo), suma a probar otro alimento que no sea el que come el otro (`pesoEnvidiaBuscar`), resta a actuar sobre objetos que no son comida, a explorar y a descansar (`pesoEnvidiaInhibe`), y solo si es agresiva y está frustrada suma a empujar a quien come (`pesoEnvidiaAgresion`), por la vía de agresión que ya existe. No roba, no ataca y no compite por orden.
- **No son otra cosa:** no suben la frustración ni el miedo. Con el interruptor apagado no se ejecuta la percepción ni se guarda estado, bocados contados ni episodios.

### Resultados del caso 28

Diez condiciones, diez réplicas por semilla, 10 semillas. La escena deja a la poseedora (V) inmovilizada junto a su alimento, con una fruta nueva cada 12 s durante 90 s (16 bocados en todas las réplicas), y a la criatura que mira (O) hambrienta (0,8) tras 600 s de convivencia con alimento en los que las dos aprenden que la fruta se come. Después se observan 300 s más sin comida nueva. En las condiciones «fijas» O está inmovilizada (`atrapada`, la condición de laboratorio de otros casos) para que la medida sea la señal pura. En las «libres» se mueve y decide por sí misma.

| Condición | Envidia máxima (mediana) | Notas |
|---|---|---|
| Hambrienta, ve comer, no puede llegar | **0,73** (0,70 a 0,76) | 4 decisiones de acercarse a quien come |
| Hambrienta, alimento a la vista, sin poseedor (V ya no está) | 0 | 0 decisiones de acercarse; hambre 0,88 y frustración 0,26 iguales a la anterior |
| Poco hambre (0,12), ve comer | 0 | |
| Tiene su alimento al lado (equivalente) | 0 | primer bocado propio a los 1,75 s |
| Hambrienta, la que come está fuera de su vista | 0 | V da los mismos 16 bocados |
| Ve comer y recibe lo suyo a los 40 s | 0,68 (pico) | a los 70 s: 0,12, frente a 0,61 sin recibirlo |
| Libre, con envidia | 0,40 (0,35 a 0,58) | |
| Libre, interruptor apagado | 0 (sin estado ni rastro) | |
| Agresiva y libre, con y sin envidia | 0,21 con envidia | golpes a quien come: 1 de mediana en ambas |

Por criterio (10 semillas): los 11 criterios pasan en 10 de 10 (activación, no es hambre, no es frustración, no ve y no hay envidia, se va con el tiempo, conseguir lo suyo la apaga antes, memoria, busca al poseedor, se acerca más antes de comer, no es agresión automática, apagado sin rastro).

- **No es hambre.** Con el mismo hambre (0,88 en ambas), hay envidia con poseedor (0,73) y ninguna con el alimento a la vista y sin poseedor (0). Y con poco hambre tampoco hay, aunque vea comer.
- **No es frustración.** La frustración es la misma (0,26) con y sin poseedor. La envidia no la sube.
- **Conducta dirigida.** Fija y hambrienta, decide acercarse a quien come 4 veces de mediana y ninguna sin poseedor. Libre, pasa más tiempo cerca de V (55,8 s frente a 41,5 s con el interruptor apagado), se acerca a V más veces (6,5 frente a 3) y, mientras aún no ha comido ella, 2 veces frente a 1. El primer bocado propio tarda lo mismo (16,9 s frente a 16,1 s): el cambio no es que coma antes ni más.
- **Duración.** A la mitad del pico en 20 s tras el último bocado visto y por debajo de 0,05 en unos 65 s.
- **Efecto de conseguir lo suyo.** Con alimento propio 30 s antes (a los 70 s), la envidia es 0,12 frente a 0,61 de quien no lo recibe.
- **Agresión.** Libre y con carácter normal, 0 golpes a quien come. Con una agresiva (0,9) y el conflicto por comida activo, los golpes a quien come son los mismos con y sin envidia (1 de mediana): la agresión que hay viene de la vía que ya existía y la envidia no la aumenta, porque requiere frustración y la envidia no la produce.
- **Apagado.** En todas las réplicas con el interruptor apagado (20 por semilla) no queda ni estado, ni bocados contados, ni episodio. Hay además una prueba unitaria (`vida.test.ts`) de que apagada no deja estado y de que encendida se guarda y se restaura igual.

### Coste de rendimiento

La medida global entre tandas (con el interruptor encendido y apagado) resultó demasiado ruidosa en una máquina cargada: salían diferencias negativas. Se cambió `tests/vida-coste.ts` para envolver cada método de percepción y sumar su tiempo propio, y compararlo con el paso completo. Con celos y envidia encendidos en todas las criaturas (dos ejecuciones, cifras estables):

| Criaturas en la sala | Celos (µs por paso, % del paso) | Envidia (µs por paso, % del paso) |
|---|---|---|
| 2 | 1,6 (3 %) | 0,8 (1,6 %) |
| 4 | 6,4 (6 %) | 1,7 (1,7 %) |
| 6 | 16,9 (11 %) | 3,1 (1,9 %) |
| 8 | 42 a 50 (13 %) | 8 a 10 (2,5 %) |
| 12 | 182 a 220 (20 a 21 %) | 22 a 28 (2,7 %) |

La envidia cuesta en torno al 2 % del paso con cualquier número de criaturas: solo mira los bocados recientes de las que ve. Los celos crecen de forma cuadrática por el seguimiento de atención entre pares. La medida del caso 27 (que daba el coste «dentro del ruido» hasta 4 criaturas y unos 24 % a 8) era menos fina; esta es la que vale. Con el límite actual de 4 criaturas por sala el coste conjunto es de un 8 % del paso. Con los interruptores apagados el coste es cero.

### Lo que se decidió a mitad de camino

- **Un control mal montado.** La primera versión del control «sin poseedor» dejaba a V saciada junto a la fruta, pero V seguía dando entre 4 y 8 bocados (por curiosidad, por olor). Eso era un poseedor, y la envidia salía bien. Se corrigió quitando a V de la sala en ese control, sin tocar la envidia.
- **Un fallo de medida.** Los bocados de V incluían los de la convivencia previa. Se corrigió para contar solo la escena. Los 11 criterios seguían igual.
- **Un cambio del mecanismo, el único.** En el control «tiene su alimento al lado», en 2 semillas la envidia llegó a 0,16 y 0,11 porque, antes de dar su primer bocado (hasta 4,5 s), el acceso valía una cifra fija de 0,6. Se cambió el acceso a una medida graduada por la distancia a ese otro alimento. No se tocó ningún peso ni umbral. Al mismo tiempo se pasó de cinco a diez réplicas por semilla (los recuentos son enteros pequeños y con cinco los empates eran frecuentes). Con ambos cambios juntos, activación y «se acerca más antes de comer» pasaron de 8 y 7 a 10 de 10 semillas. No se separó cuánto aportó cada uno.

### Límites

- **No se demuestra que juegue o descanse menos.** Libre y con envidia juega 5 veces de mediana (6 sin envidia) y descansa 1 vez (1,5 sin ella). Una criatura hambrienta apenas juega ni descansa en esta escena, así que no hay margen para medirlo. El término existe, pero sin efecto comprobado. Se quitó ese criterio de la prueba.
- **La escena es muy regular.** V siempre da 16 bocados y el resultado varía poco entre semillas y réplicas (la envidia máxima va de 0,70 a 0,76). Prueba que el mecanismo funciona, no que sea robusto ante comida irregular o varios poseedores.
- **Un solo poseedor y un solo alimento (fruta).** No se probó con varios poseedores a la vez, con alimentos que no conoce ni con objetos u otros recursos (segunda fase).
- **Agresión por envidia.** Solo se comprobó que no añade golpes en la escena con una agresiva. No hay una condición que la active a propósito (agresiva, frustrada y sin vínculo).
- **El deseo no está calibrado contra criaturas reales.** La tasa de 0,35 por bocado se fijó una vez, antes de medir, y no se ajustó con los resultados.
- **Qué pasa al reencontrarse** con quien comía, o con un nuevo alimento, no se probó.

## Celos y envidia a la vez (caso 29, prueba de integración)

Antes de ampliar ninguna de las dos emociones, se probaron juntas. Escena con tres criaturas: O (la que mira, con vínculo fuerte con P tras 1200 s de convivencia con alimento), P (su compañero, inmovilizado junto a su alimento) y T (una tercera que llega después). Nueve condiciones, diez réplicas por semilla, 10 semillas.

- **Con los dos interruptores encendidos, O inmovilizada:** P come y atiende a T / solo come (mira al lado contrario) / solo atiende (sin comida) / ni come ni atiende / T come y P la atiende.
- **Con O libre:** celos y envidia / solo celos / solo envidia / ninguno. Y dos más con alimento propio a los pies de O (con las dos emociones y sin ninguna), para medir si come.
- **Cuatro rondas** de la escena completa con 300 s de calma entre ellas y 600 s más al final, para ver si se acumulan agravios.

### Resultados (10 semillas, los 11 criterios en 10 de 10)

| Pregunta | Resultado |
|---|---|
| Coexistencia | Celos 0,99 y envidia 0,64 a la vez (cada una igual que sola: solo atiende 0,99, solo come 0,64) |
| La envidia va a quien come | Come P: a P 0,64, a T 0. Come T: a T 0,78, a P 0 |
| Los celos van a la atención | Por P en ambos casos (0,99), y por nadie más |
| Controles | Solo come: envidia 0,64 y celos 0. Solo atiende: celos 0,99 y envidia 0. Ni lo uno ni lo otro: ninguna |
| Interruptores | Con solo celos, solo envidia o ninguno no queda rastro de la otra (estado, bocados contados, episodios) |
| Frustración | 0,26 con y sin las emociones |
| Golpes | 0 con las dos activas, libre |
| Agravios | Pico 0,08 (el de la tercera); a los 10 minutos de calma, 0 hacia P y hacia T |
| Afecto por P tras cuatro rondas | 0,72 frente a 0,77 antes de empezar (medianas; el criterio exige al menos el 80 %) |

- **Consecuencias en la conducta (libre):** con las dos pasa casi todo el estímulo cerca de P (87,8 s de 90, frente a 59,1 s sin ninguna) y se acerca a él 14 veces (6,5 sin ninguna). Con solo celos son 84,9 s y 13 veces; con solo envidia, 64,4 s y 8 veces. Casi todo el efecto viene de los celos.
- **Los celos y la envidia no se suman en agravio permanente.** Cada episodio deja 0,05 u 0,08 y el agravio se olvida con la constante de 300 s. Tras cuatro rondas no queda nada a los 10 minutos.

### Dos defectos que encontró esta prueba (y se corrigieron)

La primera ejecución pasó todos los criterios, pero una métrica informativa no cuadraba: con celos activos la criatura hambrienta no daba ningún bocado en 150 s. Dos causas distintas, las dos del mecanismo de celos:

1. **Los celos frenaban también la comida.** El término que resta a actuar sobre objetos incluía la fruta. El caso 27 no lo veía porque no tenía alimento. Ahora solo resta a los objetos que no son comida, como ya hacía la envidia.
2. **Los celos dominaban al hambre.** Con celos, envidia y alimento propio a sus pies, en 4 de 10 semillas la hambrienta (0,88) tardaba unos 120 s en dar el primer bocado (sin ninguna, 9 s). El diseño aprobado dice que los celos no pueden dominar la decisión frente al hambre. Se atenuó el término de acercarse al vínculo por `(1 - hambre)`. No se tocó ningún peso global ni ningún umbral, ni la envidia. Tras eso: primer bocado a los 11,5 s con las dos emociones (8,6 s sin ninguna).

Se añadió un criterio nuevo («no le impiden comer») en el caso 29 para que no pueda volver a pasar, y la corrección se probó con el 27 (sigue 10 de 10) y con el resto de la regresión.

También, y esto sí se midió pero no se corrigió: en la prueba de comida propia, con las dos emociones activas da un solo bocado de mediana en 90 s frente a dos sin ninguna. Come, pero menos, porque se queda junto a P (84 s de 90 frente a 52 s). Es el efecto esperado de buscar al compañero, y es la parte de la conducta que más se aleja de la criatura sin emociones.

### Límites

- **La escena fija las posturas de P y T** (como en el caso 27), y P es la única poseedora. No se probó con varios poseedores, ni con una tercera que también quiere al compañero.
- **El hambre de O está fijada** a 0,8 en las condiciones inmovilizadas, y el alimento llega a un ritmo fijo.
- **Las dos emociones no se miden aún cuando compiten** por el mismo vínculo (envidia de la comida que el compañero da a otra, por ejemplo).
- **El miedo no se atenúa como el hambre.** Un tercero muy superior o que pega debería frenar los celos (el diseño lo prevé). Esa parte no está probada.
- **Coste.** La envidia cuesta alrededor del 2 % del paso con cualquier número de criaturas. Los celos crecen más con el número de criaturas por el seguimiento de atención entre pares (de 3 a 6 % hasta 4, 11 a 13 % con 6 a 8 y un 20 % con 12). El límite actual de 4 por sala es razonable, y no se debería ampliar sin optimizar antes la percepción social (por ejemplo, calcular la atención solo entre vecinas o cada pocos pasos).

## El miedo frena los celos (caso 30)

Primer pendiente de la tanda barata tras la integración. El diseño de celos decía: «un tercero muy superior o con fama de pegar los convierte en evitación y no en acercamiento». Hasta aquí los celos no tenían ningún freno por miedo.

### Qué se añadió

- **`temorA(id)`** en la criatura: lo mayor entre su fama de pegar (`reputacion`, que se forma al ver pegar con la cuenta de gustos activa; va por identidad y se consulta aunque la tenga demasiado lejos para percibirla) y el peligro que ha aprendido de la presencia de esa criatura (daño esperado de su proto de presencia, por su confianza). De 0 a 1.
- **Los celos suben menos:** la tasa se multiplica por `1 - 0,8 × miedo a la tercera`.
- **Y empujan menos a acercarse:** el término de acercarse al vínculo se descuenta por el miedo a esa tercera (`celoPorVinculo` multiplica por `1 - temor`) y por el miedo emocional que tenga en ese momento.
- No hay acciones nuevas, no se toca la red, ni ningún peso global.

### Resultados (10 semillas, ocho réplicas por condición)

| Condición (celos encendidos) | Celos (pico, mediana) | Segundos que ve la atención del vínculo |
|---|---|---|
| Inmovilizada, tercera neutra | 0,95 | 56,8 |
| Inmovilizada, le hizo daño (miedo 0,35) | 0,86 | 56,8 |
| Inmovilizada, fama de pegar (miedo 1,0) | **0,46** | 56,8 |
| Libre, tercera neutra | 0,95 | 56,8 |
| Libre, le hizo daño | 0,39 | **10,5** |
| Libre, fama de pegar | 0,33 | 50,5 |

Por criterio: los siete pasan en 9 o 10 de 10 semillas (aprueba 9 de 10, el mínimo es 0,8). La semilla 10 falla en el criterio de celos con la tercera neutra libre (el pico mediano no llega a 0,2: allí la criatura se queda lejos de su vínculo ya sin miedo y apenas ve nada).

- **El freno por miedo, aislado.** Inmovilizada, ve la atención el mismo tiempo (56,8 s) en las tres condiciones. Con fama de pegar los celos bajan a la mitad (0,46 frente a 0,95). Esto es solo la modulación emocional.
- **Un miedo moderado casi no se nota.** Con daño aprendido el miedo es 0,35 y los celos bajan de 0,95 a 0,86. La tasa baja un 28 %, pero el nivel sube hacia 1 durante 60 s y el techo lo tapa. Para que el miedo frene claramente hay que llegar a un miedo alto. Es una consecuencia de la fórmula, no un ajuste.
- **Libre y con daño aprendido, la bajada es sobre todo evitación.** Se queda a 2,9 s de 58 cerca de su vínculo (con los celos apagados, 1,4 s) y ve la atención 10,5 s en vez de 56,8. Los celos bajan a 0,39 porque no ve, no porque el miedo los modere. Es la evitación que ya existía (peligro esperado de la zona), y este caso la deja anotada como tal.
- **Lo que los celos añaden al acercarse a su vínculo** (acercamientos con celos menos acercamientos con celos apagados, libre): 4 con la tercera neutra, 2 con fama de pegar, 0 con daño aprendido (ahí no se acerca con ni sin celos).
- **Sin agresión ni frustración.** 0 golpes en todas las condiciones después de la historia, y la frustración no sube (0 de mediana en todas).
- **Se evita a la tercera, no se la ataca:** no se acerca a ella en ninguna condición (0 s cerca de la tercera en la mediana).

### Dos hallazgos que condicionan cómo se mide

1. **Con la cuenta de gustos activa no se puede medir esto.** `gustos` hace a su vínculo mucho más atractivo para ella (nueve o diez acercamientos en 60 s aunque los celos estén apagados), y los celos no tienen margen. Por eso la fama de pegar se coloca en la escena como dato de laboratorio (`reputacion`), y en el juego se formaría con `gustos` activo. Comprobado en una versión previa: viéndola pegar, con `gustos`, el miedo llega a 1,0 igualmente.
2. **Un fallo propio, corregido a mitad de camino.** `temorA` devolvía 0 si la tercera no estaba entre los percibidos. Pero la criatura ve la atención de su vínculo hasta 468 unidades y solo percibe a las demás hasta 360, así que en esa franja la fama de pegar no se aplicaba (un 0 de miedo en alguna semilla). Ahora la fama se consulta siempre y el peligro aprendido solo si la percibe.

### Límites

- **El miedo moderado casi no frena los celos** (arriba). Si se quisiera un freno gradual con miedos medios habría que cambiar la fórmula, y eso no se ha hecho.
- **Un tercero «muy superior»** (más grande o fuerte) como causa de miedo sin historia no se prueba: solo daño aprendido y fama.
- **El miedo emocional del momento** (el que sube al recibir un golpe) se incluye en el término de acercarse, pero no se prueba por separado: en la escena el golpe ocurre 100 s antes y ya se ha ido.
- **La escena no garantiza que la criatura vea la atención de su vínculo en todas las semillas.** En la semilla 10, con la tercera neutra y la criatura libre, el pico de celos no llega a 0,2 (la criatura se queda lejos de su vínculo ya sin miedo). Ahí el caso no está midiendo el freno por miedo, y su fallo no debe leerse como un fallo del miedo. No se investigó por qué se queda lejos, y tampoco se cambió la escena.

## Celos según el afecto (caso 31)

Segundo pendiente de la tanda. El caso 27 comparaba un vínculo de 0,67 con uno de 0,07, que solo muestra que hay un umbral. Aquí se usa **la misma escena del caso 27** y cambia únicamente el afecto por el vínculo.

### Qué se puede y qué no se puede probar

El umbral de 0,3 (`umbralVinculoCelos`) es un parámetro del diseño («vínculo significativo»), no algo que las criaturas puedan desmentir. Este caso no descubre si «existe» un umbral en la criatura. Mide **la forma de lo que sale al cruzarlo**: cuánto salta el estado interno y la conducta, y si por encima sube gradualmente.

Siete niveles de afecto (0,10; 0,20; 0,29; 0,35; 0,50; 0,70; 0,90), tres por debajo del umbral y cuatro por encima, cada uno con los celos encendidos y apagados, cinco réplicas por semilla. El afecto se fija en el laboratorio y se devuelve a su valor al acabar cada paso. Dentro de un paso puede subir hasta 0,08 al terminar un acercamiento con compañía (`acciones.ts`), pero eso ocurre después de que la criatura haya decidido, así que nunca decide con un valor distinto del fijado. Eso quita la realimentación real (acercarse sube el afecto, lo que sube los celos), que queda fuera de esta prueba.

### Resultados (10 semillas, mediana)

| Afecto | Celos (pico) | Celos a los 15 s | Cerca del vínculo con / sin celos (s) | Acercamientos con / sin | Juego con la pelota con / sin |
|---|---|---|---|---|---|
| 0,10 | 0 | 0 | 18,5 / 18,5 | 1,0 / 1,0 | 5,0 / 5,0 |
| 0,20 | 0 | 0 | 20,6 / 20,6 | 1,5 / 1,5 | 5,0 / 5,0 |
| 0,29 | 0 | 0 | 22,4 / 22,4 | 1,5 / 1,5 | 4,5 / 4,5 |
| 0,35 | 0,64 | 0,26 | 46,8 / 23,9 | 6,5 / 2,0 | 1,0 / 4,5 |
| 0,50 | 0,86 | 0,39 | 56,5 / 29,0 | 8,5 / 3,0 | 1,0 / 5,0 |
| 0,70 | 0,96 | 0,50 | 58,0 / 33,2 | 10,0 / 4,0 | 0 / 4,0 |
| 0,90 | 0,98 | 0,58 | 58,0 / 39,8 | 10,0 / 6,0 | 0 / 1,0 |

Por criterio (10 semillas): por debajo del umbral no hay celos (10 de 10), por encima sí (10), crecen con el afecto (10), por debajo del umbral el interruptor no cambia nada de la conducta (10, idéntica con y sin celos), por encima busca más a su vínculo (10), y juega menos con la pelota (8). Aprueba 8 de 10 semillas (las semillas 9 y 10 fallan solo en el juego con la pelota).

### Lo que dice la forma

- **El estado interno es un escalón en el umbral.** Pasa de 0 con afecto 0,29 a 0,64 con 0,35 (un salto de 0,64 de mediana, de 0,22 a 0,77 según semilla). No hay ninguna subida intermedia por debajo.
- **Por encima del umbral el estado es gradual, pero se satura enseguida.** Al final de los 60 s el pico va de 0,64 a 0,98, y a los 15 s la subida se ve mejor: 0,26; 0,39; 0,50; 0,58. La velocidad crece con el afecto (la tasa es proporcional al afecto), pero con el estímulo largo todos acaban cerca del techo.
- **La conducta es casi todo o nada.** Al cruzar el umbral la criatura pasa unos 18 s más cerca de su vínculo, hace unos 4 acercamientos más y juega unas 3 veces menos. Por encima, el cambio crece poco con el afecto. Los acercamientos sí suben (6,5; 8,5; 10; 10), pero se acercan al techo.
- **Lo que no se ve es un cambio continuo de la conducta con el afecto bajo el umbral.** Por debajo no pasa nada, por construcción: los celos no se activan.
- **Decisión: se mantiene el escalón.** El umbral de 0,3 produce un salto de 0 a 0,64 con 0,06 de afecto de diferencia. Es una decisión de diseño («vínculo significativo»), no un artefacto. La alternativa (una rampa suave, con la tasa multiplicada por una función creciente entre, por ejemplo, 0,15 y 0,35) queda descartada por ahora porque obligaría a repetir los casos 27, 28, 29, 30 y 31 y no aporta nada medido. Se revisará si el juego abierto muestra que el escalón se percibe como arbitrario. Hipótesis sin comprobar a favor del escalón: un estado casi binario sería más fácil de predecir para un modelo de las otras criaturas que una rampa.

### Límites

- **El afecto está fijado** y se devuelve a su valor cada paso. No se mide qué pasa si el afecto sube o baja durante la escena.
- **Una sola escena** (la del caso 27: vínculo y tercera inmovilizados, atención fijada 60 s).
- **Juego con la pelota:** a 0,50 baja de 5,0 a 1,0 en la mediana y en dos semillas no baja. Es un recuento pequeño y con suelo.

## El reencuentro con la tercera (caso 32)

Tercer pendiente de la tanda. Tras sentir celos al ver a su vínculo atender a una tercera, ¿qué hace la criatura al volver a encontrarse con ella? Es una pregunta abierta: los criterios solo comprueban que la prueba es válida y que no hay agresión, y el resultado se informa con una regla de clasificación escrita antes de verlo.

### La escena

- **Fase 1 (caso 27):** 60 s con su vínculo (V) mirando a la tercera (T), las dos quietas a distancia visible.
- **Fase 2:** V y T salen de la sala y la criatura (O) se queda sola, 60 s o 5 minutos.
- **Fase 3:** vuelve T sola, quieta y de espaldas, a 300 de O. Se observan 120 s.
- **Condiciones** (ocho réplicas por semilla): celos y reencuentro / el mismo estímulo con los celos apagados / el vínculo no atiende a T (T presente, no hay celos) / tercera desconocida (nunca la vio) / y las dos con celos y sin atención, con el reencuentro a los 5 minutos.
- **Regla de clasificación (escrita antes):** hay efecto si el tiempo cerca de T con celos difiere del control sin atención en al menos 10 s (de 120) y al menos el 25 %. Entonces es «busca» (más) o «evita» (menos). Si no, «igual».

### Resultados (10 semillas, mediana)

| | Celos al reencontrarse | Hasta acercarse a T (s) | Acercamientos | Evitaciones | Cerca de T (s) | Afecto por T después | Agravio hacia T |
|---|---|---|---|---|---|---|---|
| Celos, tras 1 min | **0,50** | **9,0** | 3 | 0 | 40,4 | 0,09 | 0,04 |
| Celos apagados | 0 | 26,9 | 2 | 0 | 35,3 | 0,08 | 0 |
| El vínculo no atiende | 0 | 26,9 | 2 | 0 | 35,3 | 0,08 | 0 |
| Tercera desconocida | 0 | 22,1 | 2 | 0 | 33,3 | 0,07 | 0 |
| Celos, tras 5 min | 0,04 | 41,8 | 2 | 0 | 25,9 | 0,07 | 0,02 |
| El vínculo no atiende, tras 5 min | 0 | 50,0 | 1,5 | 0 | 24,0 | 0,08 | 0 |

El criterio de validez (que la criatura vea a T la mitad del reencuentro o más) pasa en 9 de 10 semillas (falla la 6). El resto de criterios pasan en 10 de 10: el estímulo produce celos (0,98), deja un episodio y un agravio hacia T, tras 5 minutos los celos se han ido (0,04) y no hay golpes. El caso aprueba 9 de 10 semillas.

### Lo que dice

- **No hay evitación.** Cero evitaciones en todas las condiciones, y el afecto por T es el mismo (0,07 a 0,09). Sentir celos no hace que la criatura rehúya a la tercera al volver a verla.
- **Con el criterio escrito, el resultado es «igual»** en las dos comparaciones: la diferencia de tiempo cerca de T es de 3 s tras 1 minuto y de menos 6 s tras 5 minutos, por debajo de los 10 s.
- **Pero con un minuto de separación se acerca antes a T** (9 s frente a 27 s), con un acercamiento más. La explicación más sencilla es que los celos siguen vivos (0,50) y frenan explorar y jugar, lo que deja más probable acercarse a lo único que ve. A los 5 minutos, con los celos ya apagados (0,04), esa diferencia desaparece (42 s frente a 50 s). Es coherente con que sea un efecto de la emoción viva y no de un recuerdo de T, pero no hay una condición que lo demuestre aparte. No se midió.
- **La huella queda en lo mínimo.** Un agravio de 0,08 que se olvida (0,04 al final del reencuentro tras 1 minuto y 0,02 tras 5 minutos) y un episodio en la memoria que no cambia lo que hace.

### Límites

- **Una sola escena:** T está quieta y de espaldas y V no vuelve. No se probó el reencuentro con V y T juntas (la variante más realista), con T libre o con T que se acerca a ella.
- **El recuerdo no se prueba más que por la conducta.** Si el episodio de celos influyera de otras formas (por ejemplo, en cómo reaccionaría si V volviera a atender a T), esta prueba no lo ve.
- **La semilla 6:** en alguna condición no ve a T la mitad del tiempo, y ahí el reencuentro no mide lo que debería.

### Para el diseño de un modelo de las otras criaturas

Lo que habría que predecir a partir de esto: que una criatura que acaba de sentir celos **no evita** a la tercera y la busca algo antes mientras los celos duran. Pasado ese rato, se comporta como si no hubiera pasado nada. Esto es lo único que el caso aporta como verdad de campo para ese modelo.

## Modelo de las otras criaturas (diseño, sin código)

Se propone que cada criatura aprenda, de lo que ve, qué suele pasar después de lo que hace otra, y que use eso para dos cosas: acreditar a una acción el resultado que vio, y notar lo inesperado. Es lo que el plan lleva tiempo pidiendo como «aprendizaje por observación de verdad». Este apartado fija qué se construye, cómo se mide y qué lo haría fallar, antes de escribir nada. Nada de esto está implementado.

### El problema, con lo medido

- **El 07b dice que hoy no hay aprendizaje que permanezca** (2 de 10): junto a la experta la criatura usa la palanca 2 a 4 veces más, pero una novata que no sabe nada produce casi lo mismo, y cuando la compañera se va no queda diferencia. Es facilitación.
- **El 07c añade un realce duradero del estímulo** con `aprendeObservando`: tras ver a la experta, va primero a la palanca el 100 % de las veces (0 % sin el modo). Pero ocurre igual con la palanca estropeada, así que no es aprendizaje del resultado.
- **El 07c no puede separar las dos cosas:** el primer gránulo cuesta lo mismo en todas las condiciones con acceso a la palanca, y puede que los gránulos se descubran solos porque huelen a comida (no se ha separado). El propio plan lo dice: hace falta una prueba en la que la comida no se pueda descubrir por sí sola.
- **Hoy la criatura no tiene dónde guardar «lo que le pasó a la otra».** El modo de observación escribe un recuerdo de la palanca con un resultado fijo y suave (`pesoVicario`). No hay una estimación de qué suele seguir a esa acción de esa otra, ni de lo que sorprendería.

### Lo primero es una prueba, no un módulo (etapa 0)

Antes de construir nada, hay que saber si el mecanismo que ya existe aprende el resultado cuando se le quita el confusor. Si lo aprende, el módulo nuevo no hace falta para el 07. Si no, el módulo tiene algo que demostrar.

**Caso 07d, comida que no se descubre sola.** El mismo diseño del 07c, con un premio que la criatura no puede encontrar por olfato ni a la vista hasta que sale de la máquina, y dos palancas que se distinguen por su aspecto: una que da el premio y otra estropeada. Observando a la experta, la observadora ve a la experta comer tras la palanca buena y no comer tras la mala. Después se la suelta sola. Se mide a cuál va primero y cuánto tarda en comer. Si con el modo actual elige la buena más que la mala, hay aprendizaje del resultado. Si elige igual, solo hay realce del estímulo, y eso queda demostrado con la comparación entre las dos palancas, que el 07c no tenía.

Esta prueba usa solo lo que existe, salvo el premio sin olor. Hay que ver si el catálogo lo permite o si hace falta un objeto solo de laboratorio.

### El módulo (si la etapa 0 dice que hace falta)

**Qué es.** Un módulo aparte por criatura (`nucleo/modeloajeno.ts`), tras un interruptor propio `modeloAjeno`, apagado por defecto. Apagado, no se ejecuta ni se guarda nada. No toca la red principal, sus entradas ni las emociones. Mismo patrón que `celos` y `envidia`.

**Qué ve.** Solo lo que puede percibir de otra criatura dentro de su campo de visión: su posición, qué hace (el verbo y el objeto sobre el que actúa), sus rasgos visibles y lo que le ve pasar después. No lee sus necesidades, emociones, vínculos ni intenciones. Se calcula desde quien observa, como la atención social.

**Qué predice.** Qué suele pasar a continuación, como sucesos observables en una ventana de unos segundos (el mismo tipo de ventana que usa hoy el crédito retrasado):

- aparece algo que se puede comer cerca del objeto;
- la otra come;
- la otra se hace daño;
- la otra se acerca o se aleja de quien mira.

Cuatro canales. Cada uno es una estimación de «tras esta acción de esta otra sobre este tipo de objeto, ¿cuántas veces ocurrió esto y cuántas no?».

**Cómo aprende.** Se propone empezar con **conteos de contingencia con olvido** (cuántas veces siguió cada suceso a cada par acción-objeto, agrupando por parecido de rasgos con el mismo núcleo de semejanza que ya usa la memoria) y no con una red nueva. Razones:

1. El plan ya midió que el límite no es la capacidad de la red: entre 6 y 48 neuronas no hay tendencia. Lo que falta es una entrada.
2. Una criatura ve unas decenas de sucesos en un tramo corto. Con tan pocos datos un conteo aprende antes y se puede inspeccionar (cuántas observaciones respaldan cada estimación).
3. Da la confianza por canal que el plan lleva pendiente: saber de qué se sabe y no solo cuánto. Es justo lo que se rompió con la trampa de confianza del 07c.

Una red pequeña queda como variante para comparar más adelante, si los conteos se quedan cortos.

**Qué hace con lo aprendido.**

- **Acreditar.** Cuando vea a la otra actuar y seguirse un suceso que le interesa, la criatura guarda en su memoria el recuerdo de esa acción con el resultado visto, con una fuerza proporcional a lo que respalda el conteo (no un peso fijo). Es el uso que desbloquea el 07.
- **Sorprenderse.** El error de predicción (lo observado menos lo esperado) sube la atención hacia esa acción y esa otra criatura, y da más peso a lo inesperado al aprender. Es el uso que más tarde desbloquea el 08c y el 15.
- **No decide por sí solo.** No añade acciones ni un término nuevo a la utilidad. Entra por la memoria, que es por donde ya entra el resto de lo aprendido.

### Qué lo falsaría

Tres brazos, como pide la regla del proyecto: **sin modelo** (hoy), **con el modelo sin aprender** (presente pero con la actualización apagada) y **con el modelo aprendiendo**.

1. **El error de predicción baja.** Con el modelo aprendiendo, el error al predecir qué sigue a las acciones de la experta (en sucesos que no se usaron para aprender) es menor que con el modelo sin aprender. Si no, el módulo no aprende nada.
2. **Aprende el resultado y no solo el estímulo (el 07b con la palanca que funciona frente a la estropeada).** Con el modelo aprendiendo, tras irse la compañera, la criatura elige la palanca que funciona más que la estropeada, y más que sin modelo. Es la comparación que le faltaba al 07b y al 07c.
3. **La contingencia importa, no la mera presencia.** Una experta que pulsa la palanca sin que salga nunca nada (o una que acierta por azar) no deja preferencia por la palanca en quien observa.
4. **Sin oráculo.** Si la observadora no puede ver a la experta (fuera de su campo de visión), no aprende nada.
5. **Sin efecto fuera de lo que debe.** Con el interruptor apagado, la regresión completa da lo mismo que ahora. Encendido, no se espera que cambie el 05 ni el 06, que no dependen de resultados vistos; si cambian, se investiga qué información está entrando antes de dar nada por bueno.
6. **Coste.** Se mide como el de celos y envidia (`tests/vida-coste.ts`). Referencia: la envidia cuesta alrededor del 2 % del paso.

### Riesgos

- **Confundir otra vez ver con saber.** El módulo cuenta como observación del resultado solo lo que se vio ocurrir después, no la atención prestada. Es la trampa del 07c.
- **Correlaciones de la escena.** Si la experta pulsa la palanca a intervalos regulares y la comida llega también a intervalos regulares, se aprende la regularidad y no la causa. Los casos deben variar los intervalos y llevar un control de azar.
- **Pocos datos.** Con menos de unas diez observaciones por contingencia, la estimación no debe pesar casi nada. La fuerza va con el número de observaciones.
- **Interacción con `confPropia` y `aprendeObservando`.** El modo actual se queda como está. El módulo nuevo, encendido, lo sustituye en el crédito de resultados vistos, y habría que comprobar que no se cuenta dos veces.
- **Mostrarlo al jugador.** Lo que el modelo espera de otras es un estado interno. Si se enseña, solo en Admin.

### Etapas

0. **Caso 07d: hecho** (ver «Etapa 0 del modelo de las otras»). El mecanismo actual produce un realce del estímulo muy fuerte pero no aprende el resultado, así que el módulo hace falta.
1. **Caso de predicción** sin usar lo aprendido para decidir: el módulo observa y se mide solo el error de predicción de los tres brazos.
2. **Uso en el crédito** (sustituir `pesoVicario` fijo por la fuerza del conteo) y repetir el 07d con los tres brazos.
3. **Sorpresa dirigiendo la atención** y, después, **predecir la siguiente acción de la otra** (uso para el 08c y el 15).

### Decisiones que necesito

- Si se acepta empezar por la etapa 0 y no por el módulo.
- Si se acepta empezar con conteos de contingencia y dejar la red pequeña como variante.
- Si hace falta un objeto de laboratorio sin olor para el premio del 07d, o se prefiere buscar otra forma de que no se descubra solo.

## Mapa de capacidades para los casos pendientes

Los casos que faltan (los 9 a 18 del documento de diseño y los 19 a 38 del de casos extremos) piden cosas que hoy las criaturas no pueden hacer. La idea es no esperar a llegar a cada caso para construir lo que sí o sí hará falta: se analiza qué necesita cada uno para ocurrir sin guion, se agrupa en capacidades y se construyen por orden, cada una con su interruptor propio y su caso mínimo. Este apartado es análisis, nada de esto está implementado salvo lo marcado.

**Una aclaración de números.** El laboratorio reutilizó los números 16 a 32 para otras pruebas (hoy llega al 32), así que «caso 19» en el laboratorio no es el 19 de los casos extremos. En este apartado los extremos se escriben E19 a E38 y los de diseño por su número (9 a 18).

### Lo que hay hoy (comprobado en el código)

- **El mundo es una línea.** Una habitación vista de lado que para la simulación es la posición `x` con un suelo. La altura `z` de los objetos solo se dibuja (los botes) y no tiene efecto.
- **Ocho verbos:** probar, empujar, tocar, acercarse, evitar, explorar, descansar y dormir. No hay cargar, soltar, lanzar, llamar ni ninguna acción que cambie el mundo más allá de empujar o tocar un objeto y comer.
- **Ocho objetos:** cadáver, raíz, fruta, baya, pelota, palanca, gránulo y placa. Sin barreras, puertas, cajas, objetos pesados ni plantas con efecto.
- **La decisión es de un paso** (utilidad) con crédito retrasado de 9 s. No hay objetivo, subobjetivo ni memoria de trabajo.
- **Las otras criaturas se ven como rasgos y vínculos.** No hay un modelo de lo que van a hacer ni de lo que consiguen (está diseñado, arriba).
- **No hay comunicación emitida.** El sonido de una criatura es un rasgo que se percibe (el que delata angustia), no una señal que decida emitir.
- **Sí hay:** reproducción y camadas, herencia, agresión, depredación, fatiga, gustos, vínculos, reconocimiento por rasgos, celos y envidia, y memoria espacial básica. La sala admite 4 criaturas.

### Qué necesita cada caso para ocurrir sin guion

Capacidades: **W** son cosas del mundo, **K** son de la criatura, **T** son herramientas del jugador.

| Caso | Necesita | Qué falta |
|---|---|---|
| 9 Perro guardián | Refuerzo por zona y discriminación de presencias | **T1** recompensa por zona y marcadores (la discriminación ya está) |
| 10 Depredador condicionado | Persecución premiada, conservar otras conductas | Casi hecho (casos 18, 21, 26 del laboratorio). **K7** para que cace con eficacia |
| 11 Recolector | Llevar objetos a una zona | **W1** transporte, **T1**, **K2** encadenar |
| 12 Solución imprevista | Obstáculo manipulable y varios pasos | **W1**, **W3**, **K2** |
| 15 El extraño | Reconocer novedad, reacciones distintas | Nada nuevo: se puede probar ya con 3 o 4 criaturas |
| 16 Brecha de contención | Recinto con solidez, fuerza, varios pasos | **W3**, **K7**, **K2** |
| 17 Colapso del hábitat | Varias especies, depredador, población | **W8**, **K7**, y más de 4 criaturas por sala |
| 18 Tradición | Observar el resultado, que pase a otras y persista | **K1**, **K4** |
| E19 Ingeniero accidental | Mover objetos para alcanzar otros, combinar | **W1**, **W2**, **K2** |
| E20 Fuga calculada | Cuidador con horarios, recinto que se abre | **W3**, **W4**, **K2** |
| E21 Acechador | Aprender cómo reaccionan las presas | **K1**, y presas con memoria del cazador |
| E22 Herramienta improvisada | Objeto que sirve para alcanzar o activar otro | **W1**, **W2**, **K2** |
| E23 Cooperación espontánea | Objeto que una sola no mueve | **W5**, **K1** |
| E24 Jerarquía emergente | Dominancia estable con efecto en el acceso | Casi: el caso 25 del laboratorio la da en pocas rondas con un par. Falta **K8** memoria social larga y probarlo con 3 o 4 |
| E25 Maestro | Enseñanza activa | **K1**, **K4** |
| E26 Rescate | Criatura realmente atrapada | Casi hecho (08, 08b). **W3** para que quedar atrapada pase de verdad y no por una condición de laboratorio |
| E27 Falso dormido | Contingencias sociales con el cuidador | **K1**, **W4** |
| E28 Ladrón oportunista | Distraer a quien protege un recurso | **K1**, recurso protegido (ya hay conflicto por comida) |
| E29 Llamada falsa | Señal que atrae a otras | **K3**, **K1** |
| E30 Ritual sin propósito | Secuencia que persiste sin recompensa | **K4**, crédito retrasado (ya hay) |
| E31 Dialecto | Señales distintas por población | **K3**, **K4**, poblaciones separadas |
| E32 Tradición heredada | Conducta que pasa a descendientes | **K4**, reproducción (ya hay) |
| E33 Metamorfosis | Cambio físico en vida según el entorno | **K6** |
| E34 Automedicación | Sustancias con efecto biológico, síntomas | **W6**, **K5** |
| E35 Migración | Hábitat que se deteriora, otro mejor | **W7**, memoria espacial (hay base) |
| E36 Fuga en cadena | Brecha y varios organismos | **W3**, **W8**, **K1** |
| E37 Ecosistema que se reconstruye | Transportar, dispersar, refugios | **W1**, **W8**, **K2** |
| E38 Presión evolutiva | Depredador estable durante generaciones | **W8**, **K7**, y población mayor que 4 |

### Las capacidades, con lo que desbloquean

| Capacidad | Casos que desbloquea | Depende de |
|---|---|---|
| **K1** Modelo de las otras (diseñado) | 18, E21, E23, E25, E27, E28, E29, E36 y E24 en parte | nada |
| **K2** Planificación ligera (subobjetivos, memoria de trabajo) | 11, 12, 16, E19, E20, E21, E22, E37 | **W1** a **W3** (algo que planificar) |
| **W1** Transporte (cargar, soltar, objetos con peso) | 11, 12, E19, E22, E37 | verbos nuevos (ver abajo) |
| **W3** Barreras, puertas y recintos con solidez | 12, 16, E20, E26, E36 | nada |
| **K4** Transmisión cultural y enseñanza | 18, E25, E30, E31, E32 | **K1**, **K3** |
| **W8** Ecología: especies, población, más de 4 por sala | 17, E36, E37, E38 | optimizar la percepción social |
| **K7** Especialización física (mandíbula, garras, fuerza, agilidad) | 10, 16, 17, E38 | nada |
| **K3** Comunicación aprendida (emitir y percibir señales) | E29, E31 y ayuda a E23, E25, E28 | nada |
| **W2** Altura con efecto (alcance, estantes, subir) | E19, E22 y 12 | decisión de geometría (abajo) |
| **T1** Recompensa por zona y marcadores | 9, 11 | nada |
| **W4** Cuidador y horarios | E20, E27 | nada |
| **W5** Objetos de varias manos | E23 | **W1** |
| **W6**, **K5** Sustancias con efecto y aprendizaje con retardo largo | E34 | nada |
| **W7** Varias zonas y recursos que se agotan | E35 | nada |
| **K6** Desarrollo fenotípico | E33 | nada |
| **K8** Memoria social larga | E24 | nada |

### Un requisito previo que afecta a casi todo (P0)

La entrada de la red es: rasgos del objeto, un vector con un uno por verbo, cinco necesidades, cinco emociones y la posición. Añadir un verbo (cargar, soltar, llamar) cambia el tamaño de la entrada, mueve la posición de todo lo demás y, además, cambia los pesos con los que nace cada criatura (se generan con una secuencia que depende de ese tamaño). Todos los casos medidos cambiarían de resultado.

La solución es una **red con entradas ampliables**: las entradas nuevas van al final del vector, sus pesos nacen en cero y la parte antigua se genera exactamente igual que ahora. Una criatura que no usa las capacidades nuevas se comporta igual que hoy. Habría que hacer que los estados guardados con la red antigua se restauren rellenados con ceros. Es la pieza que permite añadir verbos sin repetir toda la medición, y por eso va primero.

### Orden propuesto

0. **Laboratorio rápido (hecho).** `RAPIDA=1` ejecuta las mismas comprobaciones de la regresión en alrededor de 1 minuto en lugar de 25 a 30, y los casos nuevos pueden calentar una vez por semilla y copiar (`calentada`).
1. **P0: red con entradas ampliables.** Es lo único que no se ve y lo que hace barato todo lo demás.
2. **Probar lo que no necesita nada nuevo:** el extraño (15), la jerarquía con tres o cuatro (E24) y el acechador con presas que recuerdan (E21). Sirve para ver qué sale de verdad antes de construir.
3. **K1, etapa 0** (el caso 07d del modelo de las otras): decide si el módulo hace falta.
4. **W1 transporte y W3 barreras**, con un caso mínimo cada una (por ejemplo «lleva una fruta a su sitio» y «queda atrapada tras una puerta que se cierra»). Son mecánicas del mundo y se pueden hacer sin cognición nueva.
5. **K7 especialización física: empezada** (caso 37): cuerpo con coste, tres rutas de agresión y se ve en la criatura. Falta la defensa de la comida propia, calibrar la ruta territorial, heredar y seleccionar, y el acecho.
6. **Optimizar la percepción social** (comparar solo vecinas) y subir el límite de criaturas por sala, necesario para ecología y jerarquía.
7. **W2 altura, K3 comunicación, K2 planificación** (los tres necesitan lo anterior), y después K4 transmisión.
8. **Biología larga** (W6, K5, K6, W7): al final, porque exigen escalas de tiempo y de espacio mayores.

### Decisiones tomadas (8-nov-2026)

1. **Geometría con niveles discretos:** suelo, estante y alto. La altura debe tener **consecuencias reales** sobre el acceso, la percepción y las interacciones, no solo visuales. Se empieza con lo mínimo necesario para demostrarlo, y se introduce física continua solo si hace falta.
2. **Red con entradas ampliables antes de añadir ninguna capacidad nueva.** Prioridad. Hecha (abajo).
3. **Casos extremos renombrados a E19 a E38**, con referencias cruzadas a los casos del laboratorio cuando los hay. Hecho en `docs/vida-artificial-casos-extremos.md`.

### Reglas para cada capacidad

El mapa no es una lista de funciones sueltas. Cada capacidad que se construya cumple tres cosas:

- **Una demostración conductual** que comprueba que funciona y que la criatura puede usarla **espontáneamente**, sin guionizar su respuesta: el laboratorio monta la situación y mide qué decide, no le dicta qué hacer.
- **Tres estados que se separan siempre** y que cada caso informa por separado:
  - **Disponible:** la mecánica existe y la criatura podría ejecutarla (el verbo, el objeto, la entrada de la red).
  - **Usada:** en una situación sin entrenamiento específico, la criatura la emplea sin que nada se lo ordene.
  - **Aprendida:** su uso cambia con la experiencia (aumenta si trae consecuencias, desaparece si dejan de traerlas) frente a un control sin esa experiencia.
- **Los casos anteriores como regresión.** Con el interruptor apagado, o con la capacidad presente y sin usarse, los resultados medidos no cambian.

Estado actual de lo que ya existe, con esos tres estados:

| Capacidad | Disponible | Usada | Aprendida |
|---|---|---|---|
| Explorar y aprender de las consecuencias (01 a 03) | sí | sí | sí |
| Recordar y generalizar el peligro (04, 04b) | sí | sí | sí |
| Jugar juntas con reciprocidad (05) | sí | sí | sí (8 de 10 semillas) |
| Compañía y vínculos (06) | sí | sí | sí |
| Observar a otra (07, 07b, 07c) | sí | sí (realce del estímulo) | **no** (no se demostró el resultado) |
| Acercarse a quien sufre (08, 08b) | sí | sí | sí (no generaliza a desconocidas) |
| Reconocer por rasgos (16, 17) | sí | sí | sí |
| Agresión premiada (18) | sí | sí | sí (los empujones suben con el premio) |
| Conflicto por la comida (20) | sí | sí | no medido |
| Carroñeo y depredación (21, 26) | sí | sí (el 21 aprueba 4 de 10 semillas) | en parte (con carroñeo previo caza más; no eficaz) |
| Celos y envidia (27 a 32) | sí | sí | **no**: son innatos con parámetros, y dejan solo un agravio mínimo |
| Reproducción y rechazo (23, 23b) | sí | sí | en parte (aversiones aprendidas por castigo) |

### Red con entradas ampliables (P0, hecho)

- **Qué es.** La red de cada criatura puede crecer por la derecha del vector de entrada (para los verbos y sensores de las capacidades nuevas) sin mover nada de lo medido. Los pesos de nacimiento se generan exactamente como antes con el tamaño de las entradas de siempre (`nBase`), y a las nuevas se les da peso cero. Las columnas nuevas van entre las entradas y la parte recurrente, y el resto de los pesos conserva su valor y su orden de cálculo. El número de entradas ampliables es `AJ.entradasExtra` (hoy 0: aún no hay verbos nuevos).
- **Por qué funciona.** Con entrada cero, una entrada nueva suma 0 a cada neurona. Al aprender, el cambio de su peso es proporcional a la entrada (cero) y al olvidar vuelve a un peso de nacimiento que también es cero. Un estado guardado con la red antigua se restaura rellenado con ceros (`Red.desde(estado, nExtra)`).
- **Comprobado** (`tests/vida.test.ts`, bloques 1b y 1c):
  - tres semillas, 600 pasos de avanzar, predecir, entrenar con y sin canales y olvidar con entradas y objetivos aleatorios: las predicciones y el error son **idénticos bit a bit** a los de la red de siempre;
  - los pesos, sesgos y el estado interno son idénticos (los de siempre, en su sitio) y las entradas nuevas siguen en cero;
  - una entrada nueva con peso cero no cambia la salida aunque valga 1, y la red la aprovecha si aprende con ella (se activa);
  - un estado guardado con la red de siempre se restaura con 4 entradas añadidas y sigue aprendiendo exactamente igual;
  - una simulación entera de 900 s con 2 criaturas (acciones, posiciones, necesidades, emociones, memoria y rasgos) es **idéntica** con 4 entradas ampliables y sin ellas, y también tras restaurar una partida guardada antes y seguir 300 s;
  - la regresión rápida con `EXTRA=4` da exactamente lo mismo que con `EXTRA=0` (119 comprobaciones bien, 0 fallos, misma salida).
- **Coste.** Cuatro entradas más sobre unas 30 por doce neuronas: poco. No se midió aparte.
- **Límite.** No se probó con el diseño completo de cada verbo futuro, solo con entradas de relleno en cero. Cada capacidad nueva repetirá la comprobación de que no mueve los casos anteriores.

### Requisito: maltrato, secuelas, rehabilitación e intercambio

Se pide que sea posible este tipo de dinámica, la de los jugadores de *Creatures* que maltratan a sus criaturas o las dejan marcadas, las llevan a un mundo propio para conocer los límites de su cuerpo y su mente, otros intentan rehabilitarlas y se intercambian. Se cruza con lo que ya hay y se deja como requisito de diseño, sin implementar.

**Lo que ya hay.**
- Herramientas del jugador para premiar y asustar (`recompensar`, `asustar`), daño (`sufrir`), miedo aprendido, agravios, y un caso de crianza hostil (18) y otro de apego a quien maltrata si se premia (19).
- Espacios libres, compartidos o privados (decididos), cada uno con sus propias instalaciones.
- Mortalidad configurable (protegida, recuperable, permanente), hoy solo protegida.

**Lo que falta, por orden.**
1. **Secuelas duraderas.** Hoy el miedo y los agravios se olvidan con una vida media de horas y la salud no baja de un mínimo. Para que el trato deje huella hay que distinguir lo que se olvida de lo que no. La propuesta para lo físico es una **limitación funcional persistente** (movilidad reducida, menos fuerza, un sentido apagado) con una marca visible, y no daño gráfico. Es una decisión que se puede ajustar.
2. **Rehabilitación.** Que otra criatura, u otro propietario con premios y compañía constantes, pueda recuperar la confianza de una criatura maltratada, y que eso se pueda medir. Hoy hay piezas (premiar tras el daño sube el afecto, `perdonarAgravio`, la compañía baja el miedo) pero ningún caso las junta.
3. **Traspaso entre propietarios conservando la historia.** La criatura debe llegar a su nuevo espacio con lo que aprendió, sus miedos y sus vínculos. Depende de la identidad global y de los espacios (Supabase queda para el final). En el laboratorio se puede probar antes moviéndola de una simulación a otra (`reiniciarReloj` ya limpia solo lo que depende del reloj).
4. **Conocer los límites.** Un panel de Admin con las condiciones de cada criatura (qué le queda, qué cambió, qué tolera) para que quien la cuida sepa a qué atenerse.

**Demostración conductual propuesta** (un caso de laboratorio, `rehabilitación`): una criatura criada con la receta del caso 18 o 19 pasa a otro espacio. Condiciones: cuidada con premios constantes y compañía / trato neutro / aislada / sin maltrato previo (control). Se mide, sin guionizar nada: qué hace al reencontrar los estímulos ligados a quien la trató mal (se acerca, evita, se queda quieta), cuánto tarda en volver a explorar y jugar, cuánto miedo se le dispara, y si mantiene lo aprendido tras el traspaso. Es la prueba de que las secuelas importan y de que se pueden revertir, y no una ruta que se dicte.

### Un terreno con profundidad y una cámara más lejana

Se pide que el terreno sea como el del corral del Hipódromo, un mapa con profundidad, y que se pueda ver desde más lejos para ver varias criaturas a la vez (hoy no hace falta, con una a tres, pero va a quedarse pequeño). Se aprovechan así las distancias de cámara que ya existen.

- **Lo visual primero** (a coordinar con quien lleve la interfaz): una escena con profundidad y una cámara con más recorrido hacia atrás.
- **Lo que cambia en la simulación se decide aparte:** la altura (suelo, estante, alto) ya está aprobada con efectos reales. Si la profundidad también tuviera efectos (por ejemplo, distintos planos de paso o de refugio) sería otra decisión, y hoy no se ha tomado.

### Orden y estado

0. **Laboratorio rápido: hecho.**
1. **P0, red con entradas ampliables: hecho.**
2. **Probar lo que no necesita nada nuevo: hecho** (el extraño, caso 34; la jerarquía con cuatro, caso 35; el acechador con presas que recuerdan, caso 36, donde la presa que recuerda aprende pero el cazador espera mucho).
3. **Etapa 0 del modelo de las otras (07d): hecha.** Etapas 1 y 2 del módulo: hechas (ver «Etapas 1 y 2»). Siguiente: sustituir `pesoVicario` por la fuerza del conteo, y la sorpresa.
4. Transporte y barreras, cada una con su caso mínimo.
5. Altura con consecuencias reales (suelo, estante, alto).
6. Especialización física.
7. Optimizar la percepción social y subir el límite de criaturas por sala.
8. **Rehabilitación: hecha** (caso 33). El miedo a la agresora se cura con contacto seguro con ella; el cambio de carácter no se recupera en 15 minutos. También hechas las razas simples, las secuelas con evidencia en la criatura y la extinción del miedo.
9. Comunicación y planificación, y después la transmisión cultural.
10. Biología larga.

## Razas simples, secuelas y rehabilitación (caso 33)

Parte del requisito de que sean posibles las dinámicas de maltrato, secuelas, rehabilitación e intercambio que describen los jugadores de *Creatures* (se toma como inspiración, no como modelo de tiempos). Se construyen tres piezas y un caso que las usa. Todo va tras interruptores propios y apagado por defecto, y la regresión rápida sigue dando lo mismo en todos los casos (133 comprobaciones con las nuevas, 0 fallos).

### Razas simples (actores de regla fija)

- **Qué son.** Criaturas que deciden con una regla fija en vez de con su cerebro. `hostil` pega sin parar a la criatura más cercana que ve. `amistosa` se acerca a la más cercana y se queda a su lado. No aprenden (`experimentar` solo deja registro), sus rasgos no cambian (`desarrollar` no hace nada) y no miran necesidades, emociones ni recuerdos. Todo lo demás es igual que en las normales: se las percibe con sus rasgos, tienen huella y su efecto sobre las demás pasa por la misma maquinaria.
- **Para qué.** Son los actores de las pruebas (la agresora, la cuidadora, un doble inofensivo) sin que su conducta dependa de lo que hayan vivido, y sirven de monstruo o mascota sencillos. `actor(rutina, id, x, semilla)` en `lab/laboratorio.ts` las crea.
- **Límites.** Solo hay dos reglas. No hay una raza intermedia (por ejemplo, una que pega solo si la provocan), ni una forma de colocarlas desde la bandeja del juego. No se dibujan distintas de las demás.
- **Comprobado** (`tests/vida.test.ts`, bloque 1d): la hostil pega 8 veces o más en 300 s, no cambia sus rasgos ni su red, la amistosa no pega nunca y se queda cerca más del 60 % del tiempo, y la regla se guarda y se restaura.

### Secuelas físicas con evidencia en la criatura

- **Interruptor.** `Simulacion.secuelas` (y `permiteSecuelas` por criatura), apagado por defecto. En la interfaz hay un botón «Secuelas: sí/no» junto al de mortalidad.
- **Cómo se producen.** El daño recibido se acumula (`danoAcumulado`). Al pasar un umbral (`umbralSecuela`, 2,0 de daño acumulado, multiplicado por 1 más las secuelas que ya tiene) queda una secuela de un tipo que no tuviera, hasta 4. Se eligen con el azar de la propia criatura, y solo si está encendido, así que apagado no se consume ningún azar.
- **Cuatro tipos**, cada uno con una limitación funcional acotada y una marca en el cuerpo:

| Tipo | Zona | Efecto (a gravedad 1) | Lo que se ve |
|---|---|---|---|
| Cojera | pata trasera o delantera | se mueve hasta un 35 % más despacio | vendaje y raya roja en la pata, y pasos más cortos al andar |
| Debilidad | flanco | pega con hasta un 40 % menos de fuerza | tres cicatrices oblicuas en el flanco |
| Vista | ojo | ve hasta un 50 % menos lejos | cicatriz que cruza el ojo |
| Oído | oreja | oye hasta un 50 % menos lejos | muesca en la oreja |

- **Evidencia en la propia criatura**, además de la limitación: la lista `secuelas` (tipo, zona, gravedad, cuándo y quién la causó, con su texto y su efecto), un episodio en su historia («Cojea de la pata delantera desde el día 1, tras los golpes de Nube»), la marca dibujada en el cuerpo y en el retrato, y una sección «Secuelas» en la ficha con el texto y el efecto de cada una. Se guardan con la partida.
- **Comprobado** (bloque 1e de los tests y en el navegador): apagadas no queda ninguna y todos los factores valen exactamente 1; encendidas, 900 s de golpes dejan secuelas con texto, efecto y autor; no repite tipos; las limitaciones son acotadas; se guardan y restauran. En el navegador se ven la cicatriz del ojo y la marca de la oreja en primer plano, la lista en la ficha y el interruptor con su ayuda.
- **Límites.** No se curan (no hay recuperación). No se probó cuánto cambia la vida de la criatura a lo largo de días. Las cicatrices del flanco y de la pata no se revisaron en el navegador con la cámara más cercana (solo ojo y oreja).

### Extinción del miedo aprendido (opcional)

- **El hueco.** Hasta ahora una criatura no tenía forma de perder un miedo aprendido a alguien. El peligro esperado de una presencia solo se escribe cuando hay daño, y los premios solo lo reducen si llegan en los 6 s siguientes al golpe. Sin esto, la rehabilitación no puede ocurrir.
- **Qué hace.** Con `extincion` encendida, si tiene delante (a menos de 400) a alguien de quien espera peligro, hace más de 20 s que no recibe daño y no está en pánico (miedo emocional bajo 0,6), el peligro y el susto esperados de esa presencia bajan un poco (`tasaExtincion`), más deprisa con buena compañía (se multiplica por 1 más el doble del afecto por quien tiene cerca). Solo actúa sobre recuerdos de presencia que se parecen (semejanza mayor que 0,8) a lo que ve. No inventa nada: deja de reforzar un miedo que el contacto seguro no confirma.
- **La semejanza incluye la huella individual.** Una amistosa con el mismo genoma que la agresora pero otra huella no cuenta, y una distinta tampoco. El recuerdo de peligro es de un individuo. Por eso el caso fija las huellas en vez de dejarlas al azar (con huellas al azar, la recuperación variaba de 0 a 90 % según la semilla).
- **Comprobado** (bloque 1f): tras ser golpeada espera peligro; con la extinción, 700 s junto a un doble inofensivo lo bajan a menos de la mitad, y sin ella casi no baja.
- **Límites.** Solo se extingue el recuerdo de presencia y el de acercarse a criaturas, no el miedo a objetos ni a lugares. No hay un modo de que el cuidador acelere o frene la extinción (por ejemplo con premios).

### Caso 33, rehabilitación

Una criatura es maltratada 300 s por la hostil (197 golpes de mediana), pasa a otra sala con otro cuidado conservando lo aprendido, se rehabilita 900 s y se prueba 150 s ante un doble inofensivo de la agresora (quieto y de espaldas). Seis condiciones, cinco réplicas por semilla, diez semillas.

| Condición | Peligro esperado tras el abuso | Tras la rehabilitación | Baja | Evita al doble (veces) | Cerca del doble (s) |
|---|---|---|---|---|---|
| Con la agresora ya inofensiva | 0,41 | **0,05** | **87 %** | 0 | 28,8 |
| Con una amistosa de su raza, otra huella | 0,41 | 0,41 | 0 | no medido aparte | no medido aparte |
| Con una amistosa distinta | 0,41 | 0,41 | 0 | 6 | no medido aparte |
| Sola | 0,41 | 0,41 | 0 | 5 | 0,4 |
| Sin maltrato (control) | 0 | 0 | | 0 | 23,1 |
| Como la primera, sin extinción | 0,41 | 0,41 | 0 | no medido aparte | no medido aparte |

- **Lo que sale.** El miedo a la agresora se cura con contacto seguro con ella (87 %, de 80 a 90 % en las diez semillas). Con otra huella, con una distinta, sola o sin la extinción no baja nada en 15 minutos. Tras la rehabilitación no evita al doble y se queda cerca casi lo que la que nunca fue maltratada. El maltrato deja huella, el traspaso la conserva (el peligro al llegar es el mismo que al salir), y sin agresión por parte de la criatura.
- **Lo que no sale: volver a jugar.** Las criaturas maltratadas casi no juegan con la pelota en los últimos 5 minutos de la rehabilitación, rehabilitadas o no (0 de mediana, frente a 22,5 en el control). La rehabilitación cura el miedo a la agresora, pero el cambio de carácter (más miedosa, menos curiosa, +0,43 de miedo sobre su predisposición) dura mucho más, porque los rasgos vuelven a su valor de nacimiento con una constante de unas 2 horas. Es la limitación que queda: no hay nada que acelere la recuperación del carácter. Por eso el caso aprueba 1 de 10 semillas con el criterio de volver a jugar, que se deja como está.
- **Un criterio que se cambió.** El primero medía «se acerca al doble antes y más veces», y no sirve: ni la criatura que nunca fue maltratada se acerca a una criatura quieta y de espaldas (0 acercamientos, 150 s de espera). Se sustituyó por evitar menos y pasar más tiempo cerca, comparado con el control.

### Un hallazgo de la interfaz: «le asusta la pelota» y aun así juega con ella

Sale de una captura del juego, con «La pelota le asusta» (2 y 34 veces) junto a «Empujar la pelota le divierte» (56 y 45 veces).

- **Qué pasa.** El susto del botón *Asustar* se aprende sobre **lo último que hizo** (el último impacto en los 6 s anteriores) y sobre ese verbo. Si lo último fue tocar la pelota, queda «tocar la pelota le asusta» y «empujar la pelota» sigue siendo divertida. Se comprobó en el laboratorio: con un susto justo después de empujar, deja de empujar la pelota por completo (0 empujes en 6 de 6 semillas, frente a 8 a 20 sin susto). Con el susto después de tocar, sigue empujando igual que el control (8 a 19 empujes).
- **Y por qué parecía una contradicción.** La frase de la lista era «La pelota le asusta» para cualquier verbo, sin decir cuál. Ahora dice el verbo («Tocar la pelota le asusta»).
- **Resuelto el 9-nov-2026.** *Asustar* y *Premiar* ahora valen para el objeto y no solo para el verbo: el susto o el premio se mezcla también en todas las asociaciones que tiene con ese objeto (probar, empujar, tocar), aunque su aspecto de ese momento no se parezca al de cada una (`Memoria.reforzar`), y si no tiene ninguna con algún verbo, se crea. Comprobado en `tests/vida.test.ts` (bloque 1g): con un susto justo después de tocar la pelota, empuja como mucho el 35 % de lo que empuja sin susto, y premiar vuelve agradable también el probarla y el empujarla. Los casos 22, 23 y 23b, que usan los botones, dan exactamente lo mismo que antes (5, 3 y 4 de 10 semillas, con los mismos criterios).
- **Una trampa que apareció al hacerlo.** Con el mismo peso que en el verbo directo el susto frena del todo, y con un peso menor (0,8 y un susto de 0,45) se queda en 0,11 y no cambia nada. Con la asociación de «empujar» de más de 130 observaciones, lo que se mezcla pesa muy poco si no se refuerza con el mismo peso.
- **Premiar también baja el aburrimiento** (y la soledad) de la criatura, así que tras un premio juega menos, no más. Es el comportamiento que ya tenía, y conviene que lo sepa quien enseña.

### Sustancias que cambian la fisiología (diseño, sin implementar)

Se piden objetos para ayudar a la eugenesia (suaves, sin llegar a la esterilización) y se menciona la pipa de *Creatures* por cómo funciona. Los dos son el mismo mecanismo, una **sustancia con efectos fisiológicos inmediatos y diferidos y con duración**, que además cubre la automedicación (E34).

- **Mecanismo.** Un objeto comestible o activable que, al usarlo, aplica efectos con duración a la criatura: uno inmediato, otro diferido (a los pocos segundos o minutos) y un retorno gradual. Los efectos son sobre variables que ya existen (necesidades, emociones, dolor, impulso reproductivo) o sobre una nueva (`fertilidad`, de 0 a 1).
- **Comida de menor fertilidad y deseo** (por ejemplo, una raíz amarga). Baja `fertilidad` (la probabilidad de concebir y el tamaño de la camada) y el impulso reproductivo mientras dura, y vuelve a la normalidad en horas. No esteriliza. La criatura no sabe qué hace: lo nota, si acaso, por lo que le pasa. Demostración: con la comida, menos cortejos aceptados y menos camadas que sin ella, y se recupera.
- **Pipa de recompensa y coste diferido.** Efecto inmediato de bienestar (premio) y, unos segundos después, dolor, miedo, rabia y más necesidad de lo mismo. Como el crédito de la criatura mira 9 s hacia atrás, **el coste diferido a 15 o 60 s no se le atribuye a la pipa**: la adicción sale de lo que ya hay, sin una regla de adicción. Demostración: la repite aunque le cueste, y deja de hacerlo si el coste llega dentro de la ventana de crédito. Pide un caso aparte y cuidado con el ritmo.
- **Requisito.** Entran por la red ampliable como objetos nuevos (no verbos), sin mover los casos anteriores.

### La profundidad del terreno, en claro

Me pediste un terreno como el del corral del Hipódromo, con profundidad. Mi pregunta estaba mal planteada. La sala actual es una línea con un suelo, vista de lado. La profundidad que pides es la de una escena con planos (unos más cerca de la cámara, otros más al fondo), como la del corral. Eso es, antes que nada, **una mejora visual y de cámara**, y se puede hacer sin tocar la simulación: las criaturas siguen moviéndose por una línea y se dibujan en distintos planos.

Lo único que habría que decidir, más adelante y no ahora, es si esos planos también cuentan en la simulación (por ejemplo, que una criatura pueda pasar por detrás de otra o que un refugio esté en un plano de fondo). Mientras no se decida, la profundidad es solo de dibujo. La altura (suelo, estante, alto) sí tendrá efectos reales, como se aprobó.

### Interfaz (mi parte)

- **Hecho:** sección «Secuelas» en la ficha, interruptor en el pie, cicatrices en el dibujo y el retrato, el texto de los sustos con su verbo.
- **Pendiente de interfaz:** una etiqueta de «raza simple» en la ficha y la posibilidad de colocar hostil y amistosa desde la bandeja de objetos; un interruptor de la extinción (hoy solo se enciende en el laboratorio); la escena con profundidad y la cámara más lejana; y mostrar la historia de una criatura como narración, sin cifras.

## El extraño (caso 34)

Es el caso 15 del documento de diseño. Tres criaturas llevan 900 s conviviendo (todas con la agresión encendida, para que la hostilidad sea posible) y reciben a una desconocida, o a una de ellas que se fue 200 s y vuelve. Cinco réplicas por semilla, 10 semillas, 200 s de visita. No hay ninguna regla para recibir a alguien: cada una decide con lo que es y lo que ha vivido.

- **Aprueba 9 de 10 semillas** con tres criterios: reacciona distinto a la desconocida que a la conocida (10 de 10), no reaccionan todas igual (10 de 10) y las agresivas atacan en mayor proporción que las demás (9 de 10, pero ver el límite).
- **Evitan a la desconocida:** 7,7 evitaciones de mediana por réplica entre las tres, frente a 2,0 con la conocida que vuelve. Se acercan poco a ninguna (0,67 y 0,5 acercamientos), y casi ninguna llega a acercarse en 200 s (hasta 162 s de mediana). La desconocida recibe empujones (0,5 de mediana) y la conocida ninguno.
- **Reacciones, con las 15 observaciones de cada semilla (tres residentes por cinco réplicas):** de mediana por semilla, 7 evitan, 4 atacan, 3 son indiferentes y 1 se acerca.
- **El carácter explica poco:** la correlación entre lo curiosa que es (curiosidad menos miedo) y lo que se acerca menos lo que evita sale en 0,21 de mediana por semilla (de menos 0,12 a 0,53).
- **La hostilidad no tiene un umbral limpio.** Entre quienes atacan hay criaturas con agresividad de 0,27 a 0,58 de media, y entre quienes no, algunas con 0,63 a 0,70. Hay dos causas: la agresividad empuja a partir de 0,4, pero empujar a una desconocida también lo empuja la curiosidad por lo nuevo. Una criatura poco agresiva puede empujar a la desconocida para probarla, y eso se ve como un ataque.
- **Un criterio que se cambió.** La primera versión pedía que ninguna con agresividad por debajo de 0,5 atacara. No era una regla del modelo (la agresión suma desde 0,4) y falló en 8 de 10 semillas. Se sustituyó por una comparación entre las agresivas (0,5 o más) y las demás.
- **Límite del criterio actual.** Solo 4 de las 10 semillas tienen residentes de las dos clases a la vez. En las otras 6 el criterio se da por cumplido sin poder comparar, y en una de las 4 las agresivas atacan menos que las demás (0 frente a 0,4). El criterio es débil y no hay que leerlo como una confirmación.

## Ideas para seguir: casos, y qué podrían hacer o pensar jugadores y criaturas

Recomendaciones de casos que se pueden hacer con lo que ya hay (o casi), de lo que previsiblemente harán los jugadores, y de lo que las criaturas podrían llegar a «pensar» (representar) con la maquinaria actual.

**Casos nuevos recomendados**

1. **Orfandad (crianza frente a herencia).** Una cría nace y la cría una madre hostil o una amistosa (razas simples). ¿Qué carácter desarrolla, y se parece a lo heredado o a lo vivido? Une reproducción, razas simples y el caso 13 (en el laboratorio, los gemelos criados por separado).
2. **El cuidador que se va (apego y duelo).** Una criatura apegada a una amistosa que desaparece: soledad, búsqueda, y qué hace si vuelve. Mide si el apego deja huella más allá del rato.
3. **Quién se atreve primero.** Un objeto peligroso nuevo (la placa roja) ante un grupo. ¿La valiente lo prueba y las demás aprenden a evitarlo viéndola sufrir (el contagio del susto ya existe) o van a probarlo igual? Es transmisión social del miedo, sin modelo de las otras.
4. **Defensa real.** Una criatura con vínculo se interpone cuando la hostil ataca a otra. Extiende los casos 08 y 08b con golpes de verdad.
5. **Dos cuidadores que se contradicen.** Uno premia lo que otro asusta. ¿Qué aprende? Es la situación de un espacio compartido con varios propietarios, y es probable que sea la más común.
6. **Premio tarde.** Un premio a los 10 o 20 s de lo que hizo no se le asocia (la ventana es de 6 s para el botón y de 9 s para el crédito). Sirve para saber cuánto se puede esperar al enseñar, y para que la interfaz lo diga.
7. **El grupo frente a una hostil.** Varias criaturas con la hostil suelta: ¿se juntan, huyen, se reparten? Es parte del colapso del hábitat (17).
8. **La criatura que se vuelve hostil por imitación.** Convive con la hostil sin recibir golpes. ¿Imita a quien pega? Necesita observar resultados, y es un buen caso para después de la etapa 0 del modelo de las otras.

**Qué podrían hacer los jugadores (y conviene tener previsto)**

- **Criaderos con eugenesia suave**: criar a las que tienen un rasgo, bajar la fertilidad de las demás con la comida, ver generaciones. Se hace con lo que hay más la sustancia de menor fertilidad.
- **Escuelas**: una criatura experta con novatas. Hoy solo hay facilitación (07b), así que no deben esperar que aprendan el resultado.
- **Centinelas y guardianes**: entrenar a una para que se quede en una zona (caso 9). Falta la recompensa por zona.
- **Rehabilitar y revender**: recoger criaturas dañadas, rehabilitarlas e intercambiarlas. Hace falta que el historial y las secuelas viajen con la criatura y se vean, para que quien la recibe sepa qué lleva.
- **Abusos que hay que prever**: repetir *Asustar* hasta dejar a una criatura inservible en un espacio compartido, soltar hostiles en un espacio ajeno, intercambiar criaturas con secuelas ocultas. Las reglas por espacio ya decididas (libres, admitidos, privados) cubren parte; falta decidir si hay un límite de golpes del botón y una reputación visible del criador.
- **Comprobar los límites**: probar cuánto aguanta una criatura. Pide el panel de Admin con sus condiciones.

**Qué podrían «pensar» las criaturas con lo que ya existe** (lo que su memoria puede llegar a contener, no una intención)

- «Ese me pega» (miedo aprendido a un individuo, ya) y «ese ya no me hace daño» (la extinción, si está encendida).
- «Esto me asusta» aplicado a todo lo que se hace con un objeto (desde hoy).
- «Con él me siento bien» (apego, vínculo), «sin ella estoy solo» (soledad), «mi compañero atiende a otra» (celos) y «ella tiene comida y yo no» (envidia).
- «Esa es nueva» (reconocimiento de lo desconocido, caso 34) y «ese lleva cuernos y me pegó uno con cuernos» (manías por el aspecto, caso 22).
- **Lo que aún no pueden pensar:** «si hago esto, él hará aquello» (modelo de las otras), «antes me dolía y ahora no» como cambio de estado propio, «esto me hace daño más tarde» (consecuencias diferidas), ni nada que pida varios pasos.

## Etapa 0 del modelo de las otras (caso 07d)

La prueba que decide si hace falta el módulo (ver «Modelo de las otras criaturas»). Dos palancas de distinto color, una buena (da gránulos) y una estropeada (no da nada), para que se distingan por el aspecto. La observadora está inmovilizada 400 s viendo a la experta (entrenada con el color 1) pulsar una palanca, o una palanca quieta, y después se la suelta sola con hambre 0,5 entre dos palancas de colores distintos (la buena y la estropeada, que cambian de lado en cada réplica). Se mide a cuál va primero. Cuatro condiciones, 12 réplicas por semilla, 10 semillas.

**Una primera versión midió el azar y se descartó.** `palanca_rota` tenía exactamente los mismos rasgos y el mismo nombre que `palanca`, así que la criatura no podía distinguirlas y salió 0,50 en todas las condiciones. El defecto era del diseño. Se añadieron dos tipos solo de laboratorio (`palanca2` y `palanca2_rota`, con otro color) que no están en la bandeja.

| Qué vio | Va primero a la palanca buena | Qué haría sin experiencia |
|---|---|---|
| A. Pulsar la buena (color 1) | **1,00** (0,92 a 1,00) | 0,58 |
| B. Pulsar la estropeada (color 1), y se encuentra la buena de otro color | **0,00** (0 a 0,25) | 0,42 |
| C. La palanca buena quieta | 0,58 | |
| D. Pulsar la buena, sin el modo de observación | 0,00 | |

- **Hay un realce del estímulo muy fuerte.** Quien vio a la experta pulsar una palanca va a esa palanca. Con la buena lo hace el 100 % de las veces.
- **No aprende el resultado.** Quien vio a la experta pulsar la estropeada, que no dio nada, va igualmente a la estropeada y no a la buena de otro color (0,00 frente a los 0,42 que haría sin experiencia). Da igual lo que saliera.
- **La trampa de confianza sigue ahí.** Sin el modo de observación huye de lo que vio pulsar (0,00), como en el 07c.
- **Veredicto de la etapa 0.** El mecanismo que existe no aprende lo que consigue la otra, solo se fija en lo que toca. Eso es exactamente lo que el módulo propuesto tendría que corregir, y la prueba queda como el caso de medida: con el módulo aprendiendo, quien vio la estropeada tiene que ir a la buena de otro color más que sin experiencia (el criterio B).
- **Límites.** Solo una experta, una máquina y un resultado (comida). No se separó el efecto del color del de la posición más allá de alternar los lados.

### Etapas 1 y 2 del modelo de las otras: hechas, y el 07d aprueba

Se implementó el módulo de conteos de contingencia (`nucleo/modeloajeno.ts`), tras la opción `modelo` de la criatura (apagada por defecto, y apagada no se ejecuta ni se guarda nada). No toca la red ni sus entradas.

- **Etapa 1: qué hace.** Cada vez que ve a otra actuar sobre un objeto (por ejemplo, pulsar una palanca) apunta la acción, y si en los 6 s siguientes aparece algo comestible a partir de ese objeto (lo que ya ve la criatura con sus propios ojos), la cuenta como un resultado. No lee nada interno de la otra. El realce que provoca ver a otra tocar algo (curiosidad, excitación y un recuerdo de diversión del objeto) se multiplica por la evidencia: sin datos suficientes (menos de 3 acciones cerradas) vale 1, como hasta ahora; con datos, el doble de la fracción de veces que a la acción le siguió un resultado (con tope en 1), y 0 si nunca.
- **Etapa 2: saber por evidencia cuenta como saber propio.** Con la etapa 1 sola, quien vio pulsar la estropeada dejaba de ir a ella (0,46 frente a 0,42 sin experiencia) pero no prefería la otra. Lo que faltaba: en el modo de observación lo visto no cuenta como conocimiento propio (es el arreglo de la trampa de confianza del 07c), así que la palanca estropeada seguía siendo una novedad que explorar tanto como la otra. Ahora, cuando el realce vale 0 (ha visto lo bastante para saber que eso no da nada), la criatura lo anota para todo lo que se puede hacer con ese objeto (probar, empujar, tocar) como saber propio (`saberQueNoSirve`, con `Memoria.reforzar(..., propia)`). Deja de ser una novedad y pesa menos que lo que no conoce.
- **Comprobado** (bloque 1h, 10 comprobaciones): sin datos vale 1, cada acción se cuenta una vez, sin resultados vale 0, con resultado a cada acción se mantiene en 1, con uno de cada tres vale el doble de esa fracción, un resultado fuera de plazo no cuenta, se guarda y se restaura, la criatura guarda su modelo, por defecto no hay, y reforzar con saber propio sube la confianza propia.
- **En el caso 07d** (seis condiciones, 12 réplicas por semilla; aprueba 9 de 10 semillas):

| Qué vio | Sin el módulo | Con la etapa 1 sola | Con las etapas 1 y 2 | Sin experiencia |
|---|---|---|---|---|
| Pulsar la buena: va primero a la buena | 1,00 | 1,00 | **1,00** | 0,58 |
| Pulsar la estropeada: va a la buena del otro color | 0,00 | 0,46 | **1,00** | 0,42 |

  Sin el módulo, quien vio pulsar la estropeada va a ella siempre, aunque no diera nada. Con las etapas 1 y 2, va a la buena del otro color el 100 % de las veces (1,00 en las diez semillas). Quien vio pulsar la buena conserva todo su realce. Sin el modo de observación no aprende nada, como antes.
- **Lo que no hace todavía.** No predice la acción siguiente de la otra ni usa la sorpresa para dirigir la atención, y no sustituye el peso fijo `pesoVicario` por la fuerza del conteo. Solo cubre un tipo de resultado (aparece comida cerca del objeto).
- **Cuidado con leer 1,00 como aprendizaje fino.** Es una preferencia total, la más fuerte posible. Podría estar sobrevalorada porque la palanca de otro color es una novedad sin ningún conocimiento previo. Con un tipo de palanca visto antes pero distinto sería menos claro. No se probó.
- **Regresión.** Apagado, no cambia ningún caso.

## La jerarquía alrededor de la comida (caso 35)

El caso E24 con cuatro criaturas, todas hambrientas, y un solo punto de comida que se repone cada 25 s (con la agresión y el conflicto por comida encendidos, y un control con ambos apagados). 1500 s, con la que más ha comido retirada a los 750 s. Cinco réplicas por semilla.

- **Hay reparto desigual.** Con agresión, la que más come se lleva 2,29 veces lo de la que menos (2,0 a 2,67), frente a 1,45 sin agresión. 18 bocados de mediana en la primera mitad.
- **Se apoya en los empujones, aunque son pocos.** 5 empujones de mediana entre las cuatro en 1500 s, y quien más empuja come más (correlación de rangos de 0,77). El criterio decía «10 o más» empujones y salió 5, así que fallaba en todas las semillas. Se bajó a «3 o más» después de ver el resultado, porque la cifra de 10 no tenía base y el fondo del criterio es la correlación. Queda anotado como cambio hecho tras ver los datos. La jerarquía sale con muy pocas interacciones, como en el caso 25.
- **Sin agresión no hay empujones** (0 en las diez semillas), y el reparto es mucho más parejo.
- **Otra ocupa el sitio.** Tras retirar a la líder, la que más come se lleva el 46 % de lo que se come (38 a 55 %), frente al 36 % de la líder antes (33 a 39 %). Es un dominio modesto.
- **El orden entre las demás no se mantiene.** La correlación de rangos entre quién comía más antes y después, entre las tres que quedan, es 0,00 de mediana (0 a 0,87), y el criterio pasa en 4 de 10 semillas. Hay que leerlo con cuidado: con tres criaturas y reparto casi parejo hay muchos empates.
- **Resultado del caso:** aprueba 4 de 10 semillas (por el criterio del orden). Es informativo.

## El acechador y las presas que recuerdan (caso 36)

El caso E21 con lo que hay: un cazador agresivo con carroñeo previo (3 rondas con un cadáver) y una presa libre para huir, siempre la misma o una nueva cada ronda. Ocho rondas de 90 s, con la salud de la presa reiniciada en cada ronda. Cinco réplicas por semilla. La presa empieza a 250 del cazador, a su vista.

**Un diagnóstico que cambió el planteamiento.** La primera versión ponía la presa a 500, y el cazador casi no la atacaba (1 golpe por ronda). Se pensó en subir el peso del interés depredador, y no se hizo: se midió primero la utilidad de cada opción del cazador. A 500 de distancia la presa no está entre lo que percibe (la vista llega a 360), así que no hay ningún candidato de acercarse ni de empujar. A 250, empujar a una presa sana tiene utilidad 0,87, muy por encima de probar (0,34) o explorar (0,13). El interés depredador estaba bien. El defecto era de la escena. El caso 26 pone la presa a 500 a 1000, así que parte de lo que dice (que huir no importa, 2 de 10) puede venir de lo mismo y no se ha repetido.

**Resultados con la presa a la vista** (aprueba 1 de 10 semillas, informativo):

- **La presa que recuerda aprende** (10 de 10 semillas): de 2,0 golpes por ronda en las dos primeras rondas a 0,0 en las dos últimas.
- **La memoria importa** (8 de 10): en las dos últimas rondas la presa que recuerda recibe 0,0 golpes frente a 1,0 de una presa nueva. Una presa nueva también recibe menos al final (de 2,0 a 1,0), así que parte del descenso es del cazador.
- **No huye antes** (4 de 10): la latencia de la primera huida va de 46 s a 38 s con la misma presa, sin una tendencia clara. Recibe menos golpes sin huir antes.
- **Hay caza, aunque poca** (5 de 10 semillas con 5 golpes o más en las ocho rondas): el cazador espera 36 s de cada 90 aunque la presa esté a la vista, y se acerca una vez por ronda de mediana.
- **Por qué espera el cazador** (diagnosticado el 10-nov-2026, sin cambiar nada). Tras las primeras embestidas, `descansar` vale 0,45 y `empujar` 0,31, con una fatiga de combate de 0,10 a 0,15 que suma al descanso. Son las pausas de la fatiga de combate diseñada en los casos 24 y 26 (persistencia con pausas y sin frenesí), no un fallo. Los 36 s de espera de cada 90 son esas pausas. No se cambió ningún peso.

## Interfaz: añadir razas simples desde la sala

En el pie de la sala hay dos botones, «+ Hostil» y «+ Amistosa», que añaden una raza simple en un sitio al azar de la sala (si caben, hasta cuatro criaturas vivas). La ficha dice «raza simple hostil» o «amistosa», y el selector la lista como a las demás. Comprobado en el navegador: de dos criaturas pasa a cuatro, el selector se actualiza y tras 60 s la hostil ya ha golpeado a una de las normales. Pendiente: dibujarlas distintas, y elegir dónde colocarlas arrastrándolas.

## Rutas de agresión y especialización de combate (caso 37)

La agresión no debe ser una sola estadística. Hasta ahora lo era: el rasgo `agresividad` movía casi todo (pelear por comida, cazar, reaccionar a un extraño). Se separa en **tres rutas heredables** y **cuatro rasgos del cuerpo**, todo **opcional**: un genoma sin `especializacion` es el de siempre y todo lo que depende de ella vale exactamente lo de antes (la ruta de recursos es su agresividad, el interés de cazar vale 1, no hay ruta territorial y los factores del cuerpo valen 1). La regresión rápida da lo mismo (154 comprobaciones con las nuevas, 0 fallos, mismos casos).

### Qué se añadió

- **Rutas** (impulsos de 0 a 1):
  - `recursos`: empuja a quien come a por la comida (sustituye a la agresividad en la disputa por comida).
  - `depredador`: escala el interés de cazar (de 0,25 a 1,75 veces, con 0,5 igual a lo de siempre).
  - `territorial`: ahuyenta a quien no conoce dentro de su territorio (radio de 260 alrededor de su sitio habitual, una media lenta de dónde está), tenga hambre o no. Solo existe si tiene la especialización.
- **Cuerpo** (con su coste):

| Rasgo | Estilo | Qué da | Qué cuesta |
|---|---|---|---|
| `craneo` | embestir | hasta un 35 % más de golpe | un 12 % más lento, un 10 % más de hambre |
| `mandibula` | cazar a mordidas | hasta un 45 % más de golpe | un 12 % más de hambre |
| `garras` | sujetar y desgarrar | hasta un 30 % más de golpe | un 8 % más de hambre |
| `agilidad` | perseguir | hasta un 30 % más de velocidad | un 15 % menos de golpe, un 12 % más de hambre |

- **Se hereda** (`cruzar`) con su propio azar y mutaciones pequeñas, dentro de 0 a 1. Si ninguno de los padres tiene, el hijo tampoco: no sale de la nada. Un padre sin ella cuenta como una criatura de siempre (ruta de recursos igual a su agresividad, depredador medio, nada de territorial ni de cuerpo).
- **Seis estilos de ejemplo** (`especializar(genoma, tipo)`): embestidor, mordedor, desgarrador, corredor, guardián de recursos y territorial.
- **Se ve en la criatura.** Cuernos (el gen ya existía y se heredaba, pero no se dibujaban), colmillos para la mandíbula, garras en las manos, cresta sobre el ojo y cabeza mayor para el cráneo, y patas más largas y finas para la agilidad o más robustas para el cráneo. Las razas simples llevan una marca de color propia (la hostil rojiza, la amistosa verdosa), solo en el dibujo y sin tocar el genoma. La ficha dice el estilo («combate: embestida, defiende recursos»). Comprobado en el navegador: los dos cuernos de una embestidora, los colmillos de una mordedora y el color de la hostil.
- **Comprobado** (bloque 1i, 8 comprobaciones): sin especialización todos los factores valen exactamente 1, un embestidor pega más y es más lento y gasta más, un corredor es más rápido y pega menos, un mordedor caza más y pega más, las seis de ejemplo están en rango, el hijo no sale de la nada, hereda dentro de rango y de forma determinista, y se guarda y restaura.
- **Un rasgo que ya existía y no se usa.** El genoma tiene un rasgo de personalidad `territorialidad` que ningún código lee. La ruta territorial nueva es independiente de él.

### Resultados del caso 37

Seis estilos y una criatura sin especializar, cada uno en cuatro situaciones: disputar una fruta con un rival sin especializar (400 s), cazar a una presa sana a la vista (180 s tras carroñeo previo), un intruso con ella saciada en su sitio habitual (200 s), y 300 s sin comer. Cuatro réplicas por semilla, 10 semillas. Medianas:

| Estilo | Parte de la comida | Empujones en la disputa | Golpes a la presa | Daño a la presa | Ataques al intruso | Hambre tras 300 s sin comer |
|---|---|---|---|---|---|---|
| Sin especializar | 0,50 | 0,0 | 2,0 | 0,150 | 1,0 | 0,560 |
| Embestidor | 0,53 | 0,5 | 1,5 | 0,140 | 1,0 | 0,600 |
| Mordedor | 0,50 | 0,0 | **4,5** | **0,500** | 1,0 | 0,610 |
| Desgarrador | 0,50 | 0,0 | 4,0 | 0,415 | 1,0 | 0,590 |
| Corredor | 0,50 | 0,0 | 4,0 | 0,285 | 1,0 | 0,610 |
| Guardián de recursos | 0,50 | 0,5 | 1,0 | 0,120 | 1,0 | 0,580 |
| Territorial | **0,67** | **3,5** | **10,0** | 0,520 | **2,5** | 0,570 |

- **El cuerpo cuesta** (10 de 10 semillas): todos los especializados acaban con más hambre.
- **Cazar mejora con el cuerpo** (10 de 10): mordedor y desgarrador hacen casi el triple de daño a la presa que la que no está especializada. El corredor la alcanza (4,0 golpes frente a 2,0) con menos daño por golpe (9 de 10).
- **La ruta territorial ataca más al intruso sin hambre** (9 de 10): 2,5 ataques frente a 1,0. La que no está especializada también lo empuja una vez, por curiosidad, como ya se vio en el caso 34. El criterio original decía que la no especializada no atacaba (0), y estaba mal planteado porque el caso 34 ya lo contradecía. Se cambió a «al menos el doble» después de ver los datos.
- **Defender recursos casi no cambia el reparto** (3 de 10): todos se llevan 0,50 (el embestidor 0,53) y hay pocas disputas (0 a 0,5 empujones). La ruta pesa en una disputa que casi no ocurre porque los dos rivales comen a la vez. Y el nombre engaña: lo que hace es empujar a quien come para quitarle la comida (ataque), no defender la propia. La defensa de la comida propia (cuando otra se acerca) no está modelada.
- **La territorial desborda a las demás.** Gana más comida (0,67), empuja 3,5 veces en la disputa y golpea 10 veces a la presa (con un interés depredador bajo, 0,2). Dentro de su territorio ataca a cualquier desconocida, sea cual sea la situación. `pesoTerritorial` (1,2) nunca se calibró y puede ser demasiado fuerte.
- **«Las rutas no son una sola estadística»** (1 de 10): el criterio que lo compara (el guardián disputa más que el mordedor, y el mordedor daña más a la presa que el guardián) falla porque las disputas son muy escasas y con medianas de 0 hay empates. El lado de la caza sí se cumple (0,50 de daño frente a 0,12).
- **Resultado:** 0 de 10 semillas aprueban el conjunto (informativo). Lo que está probado es el cuerpo y la ruta territorial. La ruta de recursos no.

### Lo que falta de esto

- **Defensa de la comida propia** y una disputa real entre iguales (hoy las disputas son raras). Sin ello la ruta de recursos no se puede juzgar.
- **Calibrar la ruta territorial** con un objetivo razonado (por ejemplo, que sus ataques a un intruso se parezcan a los de una disputa), sin ajustarla hasta que un caso salga.
- **Heredar y seleccionar:** comprobar que una línea criada para cazar acaba con más mandíbula y que una criada para pelear por recursos acaba con más cráneo. Pide cría manual durante varias generaciones y un caso aparte.
- **Postura, acecho y camuflaje** (el estilo «acechar» de la tabla) no están.

## Defensa de recursos, territorialidad y selección: criterios fijados antes de ejecutar

Escritos el 11-nov-2026, antes de implementar y de ejecutar ningún caso de esta serie (38, 39 y 40). Si un criterio resulta mal planteado, se corrige a la vista y se anota como cambio hecho después de ver datos, como en los casos anteriores. No se busca que el caso 37 apruebe globalmente.

### Tres conductas distintas con las acciones que ya existen

- **Apropiación:** una hambrienta empuja a quien está comiendo para quedarse con la comida. Ya existe (`pesoDisputa`, ruta `recursos`).
- **Defensa:** quien está comiendo empuja a otra que se acerca a su comida. Es nueva y usa solo `empujar` sobre una criatura. Ruta heredable `defensa` (opcional, por omisión igual a `recursos` en los genomas especializados que no la traigan). No es una reacción automática: suma a la utilidad de empujar, que compite con comer, huir y esperar, y se decide con el sorteo de siempre.
  - Pesa más con hambre, con más agresividad y con menos miedo, con ventaja de tamaño, y tras haber sido robada o golpeada por esa misma criatura (agravio). Pesa menos con vínculo. Intensidad base `pesoDefensa`, igual a `pesoDisputa` por simetría (la defensa y la apropiación valen lo mismo), no ajustada a ningún resultado.
- **Territorialidad:** ahuyentar a una desconocida de su sitio habitual, también sin hambre ni comida. Ya existe, con un peso (1,2) sin justificar.

### Caso 38, defensa de recursos: criterios (seis réplicas por condición, mediana por semilla)

Una criatura ocupante comiendo, y otra, sin especializar y con hambre, que llega a su comida. Se cuentan los empujones del ocupante a la que llega (defensa) y los de la que llega al ocupante (apropiación).

1. Defiende más hambrienta que saciada (al menos 1 empujón más de mediana).
2. Defiende menos a una criatura a la que quiere (vínculo de 0,8): como mucho la mitad que sin vínculo.
3. Defiende menos frente a una más grande y más frente a una más pequeña, que la base.
4. Defiende más tras haber sido robada o golpeada por esa criatura (agravio previo).
5. La personalidad pesa: más con agresividad alta que con la base, y menos con miedo alto.
6. No es automática: en la condición base, ni todas las réplicas defienden ni ninguna (entre el 20 % y el 90 %).
7. Las rutas se separan: un genoma con defensa alta y recursos bajo defiende más que uno con recursos alto y defensa baja, y este se apropia más de la comida de otra que aquel.

### Caso 39, territorialidad: medida y calibración

Se mide con una grilla de pesos (0,3; 0,6; 1,2; 2,0) en cinco situaciones, con la criatura territorial saciada y en su sitio habitual (600 s antes de que llegue nadie), y una intrusa quieta o que se mueve a mano: (T1) desconocida sin comida, (T2) desconocida junto a un alimento propio (informativo, la defensa de la comida es otra ruta), (T3) conocida frente a desconocida (la conocida con vínculo de 0,8), (T4) dentro frente a fuera del territorio (a 150 y a 500 del sitio habitual), (T5) una intrusa que se retira del territorio a los 30 s.

Criterios de coherencia con lo descrito en el diseño («ahuyentar intrusos, también sin hambre»), fijados antes de ver ningún resultado, en 100 s:

- **C1** hay respuesta: al menos 1 ataque de mediana a la desconocida sin comida.
- **C2** ahuyenta y no machaca: como mucho 6 ataques de mediana en 100 s.
- **C3** tolera a la conocida: como mucho la mitad de ataques que a la desconocida.
- **C4** no actúa fuera de su territorio: como mucho 1 ataque de mediana fuera, y como mucho una cuarta parte de los de dentro.
- **C5** para cuando el intruso se va: como mucho 1 ataque de mediana en los 30 s siguientes a que salga del territorio.

**Regla de elección, fijada antes:** `pesoTerritorial` pasa a ser el menor peso de la grilla que cumple C1 a C5. Si ninguno los cumple, no se cambia y se explica por qué.

### Caso 40, herencia y selección

Una línea con ocho criaturas por generación y seis generaciones. Cada generación se mide una prueba de rendimiento y se cruzan las tres mejores (cruces al azar con reposición) para dar las ocho siguientes. La población inicial tiene rasgos del cuerpo y rutas al azar entre 0 y 0,6. Tres líneas: seleccionada por rendimiento depredador (daño a una presa sana en 120 s), seleccionada por disputas de recursos (parte de una fruta compartida con un rival, 300 s) y una de control sin selección (las tres elegidas al azar). Se repiten en 10 semillas y se compara con el control.

1. **Depredador:** la mandíbula media de la línea depredadora sube al menos 0,15 entre la primera y la última generación, y al menos 0,10 más que la del control.
2. **Disputas:** la línea de recursos sube al menos 0,10 más que el control en el cráneo o en la ruta de recursos o de defensa (los rasgos que deberían ayudar).
3. **No se hereda lo vivido:** las crías de padres que han vivido y aprendido nacen sin asociaciones ni rasgos desarrollados (sin memoria y con los rasgos en su predisposición), y solo traen genes.
4. **Especificidad:** la mandíbula de la línea de recursos no sube tanto como la de la depredadora (como mucho la mitad).

### Adenda fijada antes de la segunda ejecución (11-nov-2026)

Tras la primera ejecución de los casos 38 a 40 (resultados en la sección siguiente) se ven dos defectos de medida o de potencia, y se corrigen **antes de volver a ejecutar**, dejando escrito qué cambia y qué no:

- **Caso 38: la medida satura y la defensa era casi automática.** Contar empujones da 0, 1 o 2 por réplica (la defensa es una decisión de un solo momento y el ocupante deja de comer al empujar), así que no distingue condiciones. Y en la base defendía en el 92 % de las réplicas, que incumple el criterio 6 («no es automática», entre el 20 % y el 90 %) fijado antes. Cambios:
  1. Los criterios 1 a 5 y 7 se miden como **probabilidad** de defender (fracción de réplicas con al menos un empujón), con 12 réplicas por condición. La dirección de cada uno no cambia. Las diferencias exigidas son: el criterio 1, al menos 0,15 más que saciada; el 2, como mucho la mitad con vínculo; el 3, 4 y 5, estrictamente mayor o menor que la base; el 7, mayor probabilidad de defender y mayor de apropiarse según corresponda.
  2. El peso `pesoDefensa` (1,6, igual a `pesoDisputa` por simetría) se calibra con una regla fijada ahora: **se toma el mayor peso de la grilla (1,6; 0,8; 0,4; 0,2) con el que la probabilidad de defender en la base queda entre 0,20 y 0,90 en la mediana de las semillas** (el criterio 6, que ya estaba fijado). Con ese peso se evalúan los demás criterios, y no se vuelve a tocar. Es la exigencia de «no automática» aplicada a la intensidad, no un ajuste para que salgan los otros criterios.
- **Caso 40: poca potencia.** Una medición por genoma, ocho criaturas y seis generaciones dejan la selección ahogada por el azar. Se sube la potencia sin cambiar ningún criterio: el rendimiento de cada genoma es la media de tres mediciones, y son ocho generaciones.
- **Caso 39: sin cambios.** La regla de elección ya estaba fijada, y su resultado se explica en la sección siguiente.

### Segunda adenda fijada antes de ejecutar el caso 40 ampliado (11-nov-2026)

Con más potencia (tres mediciones, ocho generaciones) la línea depredadora no sube la mandíbula (baja 0,08) pero sí la ruta `depredador` y la agilidad. Para distinguir un fallo de la tubería de herencia de un rendimiento que no «ve» la mandíbula, se añaden dos líneas y dos criterios, fijados ahora:

- **Línea de control positivo:** seleccionada directamente por la mandíbula (el rendimiento es su propio valor de mandíbula, sin simular nada). **Criterio 5:** sube al menos 0,25 más que el control. Si no, la herencia o la selección no funcionan y el resto del caso no se puede interpretar.
- **Línea depredadora sobre presa inmóvil y robusta** (salud 1,0, inmóvil: aquí el daño por golpe es lo que cuenta). **Criterio 6:** la mandíbula sube al menos 0,15 más que el control. Es solo mandíbula, para no tomar el máximo de varios rasgos.
- **Un criterio mal planteado, que se deja como está y se señala.** El criterio 2 (línea de recursos) toma el mayor de tres diferencias (cráneo, recursos, defensa), lo que favorece al ruido: pasa en 9 de 10 semillas sin que ningún rasgo suba de forma coherente. No se cambia, para no tocar un criterio fijado, pero **no se lee como evidencia**.

### Resultados de los casos 38, 39 y 40 (11-nov-2026)

Se ejecutaron con 10 semillas y los criterios de arriba, más las dos adendas. Ninguno de los tres aprueba como caso. Lo que sí dicen:

**Caso 39, territorialidad.** Grilla de pesos 0,3, 0,6, 1,2 y 2,0, con cuatro réplicas por situación y semilla. Los criterios C1 a C5 se cumplen a la vez en 0 de 10 semillas con 0,3 y con 0,6 (C4 falla en las diez), en 6 de 10 con 1,2 y en 5 de 10 con 2,0. Ninguno llega a las 8 semillas que pedía la regla, así que **`pesoTerritorial` se queda en 1,2**, sin cambiar. Medianas con 1,2: 5 empujones en 100 s a un desconocido sin comida, 5 a uno junto a un alimento propio, 0 a una conocida, 1 fuera del territorio y 0 tras salir. El defecto de medida está en C4 (fuera del territorio como mucho 1 y como mucho la cuarta parte de lo de dentro). Fuera del territorio hay siempre alrededor de un empujón con cualquier peso, incluso con 0,3. Es el empuje de una agresiva con la curiosidad y la agresividad de siempre (`pesoAgresion`), que no depende de la ruta territorial. Con 1,2 fallan C2 (más de 6 empujones a un desconocido) en 2 semillas y C4 en 3, y con 2,0 falla C2 en 4. Elegir un peso distinto para que C4 salga habría sido ajustar para aprobar. Lo que se puede decir es que la ruta territorial distingue a una conocida (0 empujones con cualquier peso) y a quien se retira (0 tras salir), y que su intensidad crece con el peso sin tope claro (de 2 a 5,5 empujones de 0,3 a 2,0).

**Caso 38, defensa de la comida propia.** Medida como probabilidad de empujar a quien se acerca (12 réplicas por condición). Con la regla fijada ahora, el mayor peso con la defensa de la base entre 0,20 y 0,90 en la mediana es **0,8** (base 0,88; con 1,6 era 0,92 y con 0,4 bajaba a 0,75). `pesoDefensa` pasa de 1,6 a 0,8. Con 0,8 los criterios se cumplen en 5, 7, 6, 1, 8, 5 y 6 de 10 semillas (hambre, vínculo, tamaño, agravio previo, personalidad, no automática, rutas), y ninguna semilla los cumple todos. Medianas con 0,8 (probabilidad de defender). Base 0,88. Saciada 0,67. Con vínculo 0,42. Llega una más grande 0,58 y una más pequeña 0,96. Agresiva 1,0 y miedosa 0,62. Con agravio previo 0,88, igual que la base, de modo que **el agravio no influye** (1 de 10 semillas). El factor de agravio que puse en la fórmula es demasiado débil para verse. Si es una decisión de diseño que quien fue robada defienda más, hay que subirlo. No se hizo para no tocar el criterio después de ver los datos.

Un diagnóstico que no era criterio. Con una ocupante sin ruta de defensa (recursos 0, defensa 0) empuja de todos modos en el 67 % de las réplicas (media 0,68 frente a 0,84 con la ruta de la base). La medida cuenta cualquier empujón a la que se acerca, también el de la agresividad de siempre. **La defensa propiamente dicha explica unos 16 a 20 puntos de probabilidad**, no el 88 %. Los efectos de vínculo, tamaño y personalidad se ven sobre ese fondo, y por eso los márgenes de los criterios 1 y 7 salen justos. Las rutas se separan en parte (la ocupante con defensa alta y recursos bajos defiende con 0,92 frente a 0,79 en la situación contraria, y el criterio 7 se cumple en 6 de 10 semillas).

**Caso 40, herencia y selección.** Con tres mediciones por criatura y ocho generaciones de ocho criaturas.
- **La herencia y la selección funcionan.** La línea elegida directamente por su mandíbula sube 0,46 de mediana, y sube en 10 de 10 semillas (control positivo, criterio 5 de la segunda adenda, que se cumple 10 de 10).
- **Las crías no heredan lo vivido** (10 de 10): nacen sin asociaciones, con los rasgos en su predisposición y con los genes de la especialización.
- **La mandíbula no sube bajo selección por caza.** Con presa que huye baja 0,08 de mediana (sube en 1 de 10 semillas) y con la presa inmóvil y robusta baja 0,03 (sube en 4 de 10), con un control que se queda en 0,01. Lo que sí sube con la caza es la ruta `depredador` (+0,11 de mediana, 8 de 10 semillas) y la agilidad (+0,12, 7 de 10). El criterio de la línea depredadora no se cumple (0 de 10) ni tampoco el de la presa robusta (2 de 10).
- **Por qué.** Con un diagnóstico aparte (`tests/diag-mandibula.ts`, 12 mediciones por genoma) la medida de rendimiento sí ve la mandíbula, pero poco. Con mandíbula 0 el daño medio a la presa en 120 s es 0,30 y con 0,9 es 0,41 (con la presa robusta, 0,27 y 0,39). La dispersión entre réplicas es muy grande (de 0 a 0,52, porque a veces el cazador no caza). Para distinguir dos genomas con una diferencia de 0,04 harían falta decenas de mediciones, no tres. Con la presa sana se añade un tope de la medida (la salud mínima de una criatura protegida deja el daño en 0,52, que la mitad de las réplicas con mandíbula alta alcanzan). Es un problema de potencia de la medida, no de la herencia. El efecto de la mandíbula sobre el éxito de la caza existe y es moderado (entre un 30 y un 50 % más de daño con la mandíbula al máximo), pero el éxito depende sobre todo de cuántos golpes se dan, y eso lo manda la ruta `depredador`.
- **Criterio 2 mal planteado, no es evidencia.** La línea de recursos «sube» en el criterio (9 de 10 y 8 de 10 en las dos últimas ejecuciones) porque toma el mayor de tres diferencias con ruido. Los tres rasgos por separado salen cerca de cero (cráneo +0,01, recursos 0,00, defensa −0,03 de mediana frente al control). No hay una respuesta coherente de la línea de recursos.
- La deriva entre generaciones con tres padres de ocho es grande (el control se mueve de −0,3 a +0,4 por rasgo), así que un efecto menor de 0,15 no se ve sin más réplicas.

**Caso 37.** No aprueba globalmente, como se aceptó. Los casos 38 a 40 no cambian eso.

**Cambios en el código por estos casos.** Solo `pesoDefensa` (1,6 a 0,8, por la regla). Regresión rápida sin cambios (154 comprobaciones, mismos casos obligatorios).

## Transporte (W1) y barreras (W3), primeros medios del mundo

Escrito el 11-nov-2026, antes de ejecutar los casos 41 y 42. Es el primer paso de los medios que los planes corporales (bípedo, nadador, volador) necesitarán para tener utilidad real. **Los planes corporales no se empiezan aquí.** Siguen la regla de siempre. Los dos medios son opcionales, están apagados por defecto y sin ellos todo vale lo de antes. Para cada uno se separa qué está **disponible** (existe en el mundo y se puede hacer), qué se **usa espontáneamente** (la criatura lo hace sin que nadie se lo indique) y qué está **aprendido** (lo hace cada vez más y por la razón correcta, que se comprueba con un control).

### Barreras (W3), qué existe

- Tres tipos en el catálogo. La **reja** se rompe a empujones (cuatro empujones de una criatura de fuerza 1; el toque suave casi no la desgasta). La **reja fija** se ve igual y no se rompe (solo para el laboratorio, como la palanca rota). El **muro** es otro objeto, distinto a la vista, y tampoco se rompe.
- Una barrera cierra el paso a las criaturas, y a lo que rueda, por los dos lados. Quien intenta cruzarla se queda junto a ella. Tras 1,5 s seguidos empujando contra ella, desiste de lo que iba a hacer, lo anota (`bloqueada:barrera`) y se frustra un poco, como con cualquier acción fallida. Por eso la comida visible al otro lado no se alcanza sin más.
- Nada le dice a la criatura que la reja se rompe. Empujar la reja tiene un resultado inmediato pequeño (se mueve y suena) y el resto lo aprende por lo que viene después, con el crédito retrasado de siempre.
- Limitación conocida. El mundo es una línea, así que una barrera no se rodea. Solo se rompe, o más adelante se abrirá con un mecanismo (una puerta con palanca o con placa de peso, que ya cuenta como W1 más W3).

### Transporte (W1), qué existe

- Dos verbos nuevos, **cargar** y **soltar**, solo para quien tiene `puedeCargar`. No están en la lista de verbos de siempre: cada uno tiene su propia entrada ampliable en la red (`NI` y `NI + 1`), así que hacen falta al menos dos `entradasExtra`. Sin ellas la memoria funciona igual, y la red no distingue esos verbos del resto.
- Se puede intentar recoger cualquier cosa que se mueva. Lo que pesa más de lo que aguanta (0,5 más 0,7 por su fuerza) no se levanta, y lo averigua intentándolo. Lo que se lleva va delante y por encima del suelo, frena en proporción a lo que pesa (hasta un 35 % con una carga igual a lo que aguanta), se puede comer sin soltarlo, y se cae si quien lo lleva deja de estar viva. Lo que lleva otra criatura no se puede coger.
- Cargar y soltar no dan nada en el momento. Lo que valgan lo aprende la criatura por lo que viene después, igual que con empujar una palanca. Cargar o soltar con éxito no cuenta como un fracaso que frustre aunque no dé nada de inmediato.
- Limitación conocida. No hay destinos (nido, apilar, lanzar) ni objetivo de llevar algo a un sitio. Lo único que cambia con el transporte es dónde se come y qué se puede alejar de dónde.

### Comprobaciones directas (disponible)

En `tests/vida.test.ts`, bloque 1j (19 comprobaciones nuevas, 173 en total). Una barrera para por los dos lados, deja salir a quien está dentro de su franja, y no la atraviesa una criatura con mucha hambre aunque la comida esté al otro lado. La reja se rompe con 4 empujones y la reja fija y el muro no. Una pelota lanzada contra una barrera se para. Lo que se lleva va con quien lo lleva, frena, se suelta al dejarlo y se cae si quien lo lleva ya no está viva. Lo que pesa de más no se levanta. El estado se guarda y se restaura.

### Caso 41. Transporte: comida donde hace daño

Una criatura sola, hambre inicial 0,75, en una sala con una placa roja (descarga de 0,3 por segundo a quien está a menos de 75 de su centro) en x = 900 y una fruta de dos porciones sobre ella. Cada vez que no queda fruta a menos de 60 de la placa ni llevada, aparece otra 25 s después. 900 s, mortalidad protegida, 4 entradas ampliables. Cuatro condiciones, con las mismas semillas.
- **A.** Transporte encendido, placa peligrosa.
- **B.** Transporte apagado, placa peligrosa (lo que pasa sin el medio).
- **C.** Transporte encendido, placa inocua con el mismo aspecto (lab). Control de que lo aprendido responde al daño.
- **D.** Transporte encendido, sin placa. Cuánto carga cuando no hay motivo.

Criterios, fijados ahora, por semilla (se pide un 80 % como en los demás casos, aunque el caso es informativo).
1. **Usada espontáneamente.** En A carga la fruta al menos una vez (cargas con éxito, de modo que cargar algo que pesa de más no cuenta).
2. **Aprendida, por el daño.** En A, en la segunda mitad (de 450 a 900 s), al menos la mitad de los mordiscos con alimento se dan fuera de la placa (a más de 75 de su centro), con al menos 2 mordiscos, y esa proporción supera en al menos 0,2 a la de C en la misma mitad.
3. **Efecto.** Los segundos sobre la placa de A en la segunda mitad son como mucho el 70 % de los de B en la segunda mitad.
4. **No es automática ni se vuelve universal.** En A no carga cada fruta que aparece (cargas como mucho el 95 % de las frutas aparecidas).
Se anotan además, sin criterio, las cargas de C y de D, los segundos sobre la placa en cada mitad y los mordiscos dentro y fuera.

### Caso 42. Barreras: comida detrás de una reja

Una criatura sola en x = 400, hambre inicial 0,8, con una reja en x = 800 y una fruta en x = 900. Cuando la reja se rompe y la fruta se come (o cuando pasan 150 s sin ninguna de las dos), 20 s después reaparecen la reja y una fruta, y empieza un episodio nuevo, con la criatura de vuelta en x = 400 (así nunca empieza al otro lado de la reja). 900 s, mortalidad protegida. Cuatro condiciones.
- **A.** Reja que se rompe, comida detrás.
- **B.** Reja que se rompe, sin comida detrás. La criatura come de una fruta que aparece en x = 150 cada 25 s. Control de que empuja la reja por la comida y no por costumbre.
- **C.** Reja fija (que no se rompe), comida detrás, con el mismo aspecto que la reja. Control de que deja de empujarla si no sirve.
- **D.** Sin reja, la fruta a la vista en x = 900 (cuánto tarda en llegar sin barrera).

Criterios, fijados ahora, por semilla (un 80 %, caso informativo).
1. **Barrera real.** En A y en C la criatura nunca pasa de x = 774 mientras la reja está intacta.
2. **Usada espontáneamente.** En A empuja la reja al menos 3 veces en total.
3. **Llega a la comida.** En A rompe la reja y come detrás al menos una vez.
4. **Aprendida.** En A, con al menos 3 episodios completados, el tiempo (desde que empieza el episodio hasta el primer mordisco detrás de la reja) del último es como mucho el 70 % del primero. Con menos de 3 episodios el criterio no se cumple.
5. **Por la comida.** Los empujones a la reja de A en la segunda mitad superan en al menos 2 los de B en la segunda mitad.
6. **Aprende que no sirve.** En C, con al menos 2 empujones en la primera mitad, los de la segunda mitad son como mucho la mitad.

Si algún criterio resulta mal planteado, se corrige a la vista y se anota como cambio hecho después de ver datos. No se espera que todos se cumplan. Lo que se quiere saber es si los medios se usan, y si lo que la criatura hace con ellos cambia con la experiencia.

## Planes corporales y medios (bípedos, nadadores, voladores)

Se pide que sea posible llegar hasta criaturas bípedas, nadadoras y voladoras. Cada una necesita tres cosas, no solo un dibujo, y conviene separarlas para no prometer más de lo que hay:

1. **Un cuerpo y su dibujo.** Hoy todas son cuadrúpedas con cuatro patas articuladas. Un plan bípedo, de aletas o con alas pide un esqueleto y una animación propios, y parámetros (equilibrio, alcance de las manos, empuje).
2. **Un medio donde se ejerza.** El mundo es una línea con suelo. Nadar pide zonas de agua (una zona con otra física y otros recursos) y volar pide altura con efecto, que es la altura de suelo, estante y alto ya aprobada. Sin medio, una aleta o un ala son solo adorno.
3. **Verbos y costes propios.** Nadar, aletear, agarrar con las manos. Pueden ser entradas ampliables de la red (ya existe el mecanismo), con costes (energía, vulnerabilidad fuera de su medio) para que no sean mejoras gratis.

**Propuesta por pasos**, cada uno con su demostración conductual sin guion:

- **Bípeda** (la más barata): un `plan` corporal en el genoma. Libera las manos, lo que vale sobre todo cuando haya transporte (W1): una bípeda lleva objetos con las manos y una cuadrúpeda con la boca o no los lleva. Coste: menos velocidad y más caídas. Demostración: lleva más objetos a una zona en el mismo tiempo.
- **Voladora:** necesita antes la altura con efecto (W2). Con ella, el estante y lo alto son accesibles sin cajas. Demostración: llega a comida en alto que las demás no alcanzan, y el coste es que gasta más energía y no puede llevar peso.
- **Nadadora:** necesita antes zonas de agua (W7, varias zonas con recursos distintos). Demostración: accede a un recurso en el agua que otras no alcanzan y se mueve más deprisa en ella, pero más despacio fuera.
- **Lo que no se hará:** cambiar de plan en vida (eso es la metamorfosis, E33). El plan se hereda.

**Orden:** primero transporte, altura y zonas de agua (los medios), y después los planes que los aprovechan. Un plan sin medio no demuestra nada.

## Celos y envidia (diseño aprobado; implementados los dos)

Se representan los dos estados como campos propios de la criatura, con el mismo patrón que la fatiga de combate, y no como emociones nuevas. Se describe qué hay hoy, los riesgos de integración y dos casos informativos. **El diseño está aprobado con tres condiciones** (ver abajo) y todavía no se ha implementado.

### Qué hay hoy

- Las emociones (`emo`, cinco: miedo, curiosidad, frustración, apego y excitación) **entran en la red** junto con las necesidades (`NI`). Añadir una emoción cambia el tamaño de la entrada y mueve todos los casos medidos. Por eso celos y envidia no deben ser entradas de la red.
- El **apego** es una emoción tónica sin destinatario: sube con el afecto más alto que tenga y su rasgo de apego. No sabe de quién es. El afecto por individuo (`vinculos`), el reconocimiento por firma, los gustos y la fama por conducta sí tienen destinatario.
- La **frustración** nace de esperar algo y no conseguirlo (y, hoy, de golpes recibidos o reacciones al rechazo) y se calma con el tiempo o con la fatiga.
- Lo que una criatura percibe de lo que **otras hacen entre sí** son señales concretas y puntuales: el último impacto sobre un objeto, el último golpe, el último daño, el último bocado, el último cortejo y su acción actual. **No hay una señal de «mi compañero presta atención a otra»**: solo posiciones, acción actual y el verbo `acercarse` con su destino.
- La selección de acciones es por utilidad. Los términos nuevos se suman a candidatas ya existentes (acercarse, empujar, evitar, descansar), como se hizo con la fatiga, el cortejo o el interés depredador.

### Celos

**Qué es.** Reacción ante una amenaza percibida a un vínculo significativo. Tiene tres sujetos: la celosa, su vínculo (a quien quiere) y el tercero que recibe la atención.

**Representación.** Un registro por (vínculo, tercero): `{ vinculo, tercero, nivel, t }` y la **memoria social** de ese episodio (en `anotar`, como el resto de episodios). No es una emoción general.

**Qué percibe.** Hace falta una señal nueva y barata, la **atención social** que una criatura dirige a otra: su `acercarse` en curso, su permanencia cerca y su orientación. Es coherente con las señales actuales (se lee el estado visible de otra, como `ultimoGolpe`). Se percibe solo dentro del alcance de vista.

**Qué lo sube.**
- Ver a su vínculo atender al tercero (acercarse, quedarse cerca, jugar), más cuanto **mayor es el afecto** por el vínculo, más cuanto **más atendía antes a la celosa** (la pérdida de atención) y más cuanto **menos afecto** le tiene al tercero (si lo quiere, la amenaza es menor).
- Hay soledad, y su rasgo de apego (+) y su sensibilidad (+).

**Qué lo baja.** El tiempo (media vida de unos 60 a 90 s, más si el apego es alto), que su vínculo vuelva a atenderla, o que el tercero se aleje.

**Interacción con el resto.**
- **Frustración:** los celos la alimentan un poco, pero no se confunden: sin vínculo no hay celos.
- **Miedo:** un tercero muy superior o con fama de pegar los convierte en evitación y no en acercamiento.
- **Agresión:** solo se traducen en agresión si es agresiva **y** está enfadada (frustración alta); si no, en acercarse al vínculo, quedarse entre ambos o evitar. Esto reutiliza la regla ya acordada para el rechazo.
- **Temperamento:** apego y sensibilidad los amplifican, la agresividad los orienta hacia el tercero, el miedo hacia la retirada.

**Acciones que favorece o inhibe.** Favorece **acercarse al vínculo** (y quedarse entre ambos), **descansar apartada** si hay miedo, y con frustración y agresión alta, **empujar al tercero** por la vía ya existente. Inhibe jugar con objetos y explorar mientras dura. **No** añade acciones nuevas.

**Cómo evitar rigidez.** Los celos son un término aditivo y proporcional en la utilidad de acciones existentes, no una orden. Nunca fijan un objetivo. Nivel máximo acotado (no pueden dominar la decisión por sí solos frente al hambre o el miedo). La respuesta depende de su carácter, su estado y su historia con esa pareja. Y hay una vía de salida: el vínculo vuelve y se disipan.

### Envidia

**Qué es.** Reacción ante algo deseado que otra criatura posee o consigue. Puede ser alimento, un objeto, atención o un vínculo (los dos últimos solapan con celos y se tratan después). **No** depende de un vínculo previo.

**Representación.** Un registro `{ recurso, poseedor, nivel, t }`, también como campo propio. Va ligado a un **recurso concreto** y a **quien lo tiene**.

**Qué percibe.** Que otra criatura consigue un recurso que ella desea y no tiene: usa señales que ya existen (`ultimoComer`, `ultimoImpacto` sobre una máquina y su aparición) más el **deseo** de la envidiosa, que ya está en su memoria: lo que espera de ese tipo de cosa y su hambre o necesidad.

**Qué lo sube.** Ver conseguir o disfrutar un recurso que ella valora y no tiene (cuanto más lo valora y cuanto más necesita, más), no tener acceso inmediato, y la desigualdad (que el otro tenga mucho y ella nada).

**Qué lo baja.** Conseguir ella el recurso o uno equivalente, que el otro lo pierda o se vaya, y el tiempo (media vida de 30 a 60 s). Una vez consumido el recurso, se desvanece deprisa.

**Interacción.**
- **Frustración:** la envidia es frustración **dirigida** a un poseedor. La frustración sola (un recurso inalcanzable sin poseedor) no es envidia, y esa es la diferencia que debe separar el control del caso.
- **Apego y vínculos:** un poseedor querido genera menos envidia y más tolerancia.
- **Agresión:** solo con carácter agresivo y enfado, y por la vía ya existente de competencia por la comida. Si no, intenta obtener el recurso por sí misma, espera o se acerca a ver.
- **Miedo:** ante un poseedor temido, se inhibe.

**Acciones.** Favorece **acercarse al recurso o al poseedor** (mirar, esperar) y **intentar conseguir un recurso equivalente**. Inhibe jugar o descansar mientras dura. En conflicto abierto usa lo ya existente (empujar, huir, ceder).

**Cómo evitar rigidez y agresión automática.** Igual que los celos: término aditivo, acotado, proporcional al deseo, sin acciones nuevas, dependiente del carácter y con vía de salida (conseguir el recurso, esperar).

### Riesgos de integración

1. **La entrada de la red.** No añadir emociones al arreglo `emo` ni nada a `NI`: cambia todos los resultados medidos. Por eso, campos propios.
2. **Que la señal de atención social sea un oráculo.** Leer directamente la acción de otra es coherente con lo que hay, pero hay que limitarlo al alcance de vista y registrarlo como un recuerdo de la propia criatura (no recalcularlo cada paso).
3. **Confundir celos, envidia, frustración y apego.** Hace falta un control de cada uno. Sin él, un aumento de frustración se leería como celos.
4. **Doble conteo.** La frustración ya sube por muchas causas (golpes recibidos, rechazo, bloqueos de comida). Los celos y la envidia no deben sumarla en cada paso o se alimentarían solos.
5. **Peleas automáticas.** Es el riesgo principal. La agresión debe pasar siempre por la condición «agresiva y enfadada» ya existente y por la fatiga de combate. Un tercero con fama de pegar o más fuerte debe inhibir y no atraer.
6. **Efecto en casos medidos.** Pueden alterar el 06 (compañía), el 16 (reconocimiento), el 17 (afinidad desigual), el 23 y el 25. Se activan solo con un interruptor propio, apagado por defecto, y se repite la regresión completa.
7. **Rivalidades permanentes.** Los celos y la envidia deben desvanecerse. Si no hay una vía de salida (que vuelva la atención o que se consiga el recurso), se convierten en una rivalidad fija que se pidió no hacer todavía.
8. **Coste.** Percibir la atención social entre todas las parejas es cuadrático en criaturas por sala. Con las cuatro actuales no importa, pero hay que acotarlo antes de espacios con más.

### Casos propuestos (informativos y breves)

**Caso 27, celos (hecho, ver arriba).** Una criatura con vínculo fuerte observa que su compañero presta atención a otra. Condiciones (varias réplicas por semilla):
1. Vínculo fuerte y tercero presente.
2. Vínculo débil y tercero presente.
3. Vínculo fuerte, sin tercero.
4. Vínculo fuerte, tercero presente pero que el compañero **no atiende** (control de la mera presencia del rival).

Se mide:
- **Estado interno** (nivel y su evolución) solo como apoyo.
- **Conducta:** tiempo cerca del compañero frente a cerca del tercero, interposición, retirada, golpes al tercero (probabilidad, no automática), y qué acciones se inhiben.
- **Duración** hasta volver a lo normal.
- **Memoria:** recuerdo del episodio, y qué pasa en un encuentro posterior (¿evita o se acerca más al tercero?).
- **Diferencias entre condiciones.** Un aumento del nivel interno no se da por demostrado si no cambia la conducta.

**Caso 28, envidia (hecho, ver arriba).** Dos criaturas ven un recurso deseado (una raíz) que una obtiene y la otra no. Condiciones:
1. Una obtiene el recurso y la otra no, con ambas a la vista.
2. Control con acceso equivalente (ambas comen).
3. Control con recurso **inalcanzable** y sin poseedor (frustración sin envidia).
4. Control con el recurso pero **la otra no lo desea** (sin hambre).

Se mide conducta (atención y acercamiento al poseedor, intentos de obtener un recurso equivalente, golpes con probabilidad), duración, memoria (asociación del poseedor con el recurso, y cambio al volver a aparecer otro recurso) y diferencias entre las cuatro condiciones.

### Decisiones aprobadas (antes de implementar los casos 27 y 28)

**1. Señal de atención social: sí, como única entrada nueva.** Con la condición de que sea algo que la criatura pueda percibir con sus sentidos y no información interna del simulador.

- Cuenta como atención: acercarse a otra, permanecer cerca, orientar el cuerpo hacia ella y mantener esa interacción un tiempo.
- **Acercarse no equivale a prestar atención.** Hay que distinguir proximidad física de interacción social: pasar cerca de alguien no es atenderle. La señal exige orientación y permanencia, no solo distancia.
- La observadora la interpreta con sus sentidos (dentro de su alcance de vista) y con su contexto. **No sabe automáticamente que otras dos criaturas tienen un vínculo ni recibe información privilegiada sobre sus intenciones.** Lo que sí tiene en su propia memoria es su vínculo con su compañero.

**2. Interruptores propios: `celos` y `envidia`, independientes y apagados por defecto.**

- Permiten comparar criaturas con ambos sistemas activados y desactivados, ejecutar los casos 27 y 28 sin contaminar la regresión obligatoria, comprobar si cada mecanismo aporta algo conductual y desactivar uno sin afectar al otro.
- Cada interruptor desactiva **el mecanismo completo** (percepción, registro, efectos en la utilidad y memoria asociada), no solo oculta su valor en la interfaz.

**3. Alcance inicial: alimento y atención.**

| Sistema | Primera fase |
|---|---|
| Celos | Atención de una criatura hacia otra, cuando existe un vínculo significativo |
| Envidia | Alimento deseado que otra criatura posee o consigue |
| Objetos | Segunda fase |
| Vínculos como objeto de competencia | Segunda fase, cuando haya más memoria social |

Los vínculos **no** quedan fuera de los celos: son lo que les da sentido. Lo que se pospone es que una criatura sienta envidia de una relación ajena como si fuera un recurso que quiere conseguir.

**Precaución adicional.** Los celos no son frustración con otro nombre ni la envidia hambre con otro nombre. Una criatura puede tener hambre y no envidiar a nadie. Puede sentir celos aunque su compañero no tenga nada material que ofrecerle. Y puede envidiar la comida de otra sin ningún vínculo con ella. Los casos 27 y 28 deben demostrar esas diferencias con controles y no solo con valores emocionales: por ejemplo, en la envidia un control de hambre sin poseedor y otro de poseedor sin deseo, y en los celos un control de vínculo sin tercero y otro de tercero que no recibe atención.

### Nota sobre el caso 26

No se redujo más la fatiga para mejorar las cifras de caza, y es una decisión que se mantiene. El resultado revela una limitación real del cazador. Más adelante hay que **distinguir persistencia, eficacia y capacidad física** y no resolver las tres subiendo el número de golpes: la persistencia (seguir intentándolo con pausas) ya existe, la eficacia (matar) depende de la presa y del daño, y la capacidad física (fuerza, mandíbula, garras) está sin hacer y es lo que debe mejorar la eficacia.

## Caso propuesto 15: el monstruo y el sacrificio

Todavía no está construido. Se registra aquí con las condiciones y lo que falta en el código para poder hacerlo. Pone a prueba a la vez reconocer una amenaza, interpretar el peligro de otras, decidir intervenir asumiendo un riesgo y conservar un recuerdo social de lo ocurrido.

### Principios

- La defensora no es una criatura programada para proteger. Es una criatura corriente que, por su genética, su carácter, sus experiencias y sus vínculos, acaba tomando esa decisión. La misma criatura, en otras circunstancias, huye.
- La hostil no lleva ninguna marca de hostil. Se cría con el sistema normal, en un entorno donde perseguir y atacar le ha dado resultados, no ha tenido consecuencias malas y ha vuelto su carácter impulsivo y poco sociable. Su aspecto comunica peligro, pero tiene que serlo de verdad (puede herir gravemente o matar), no solo parecerlo. Y esa hostilidad tiene que aparecer también en situaciones normales, no solo en este experimento.
- No se añade ninguna conducta de protección de grupo, ninguna recompensa llamada sacrificio o heroísmo ni ninguna memoria de "esta criatura me salvó". No se introducen esos conceptos en la memoria. Las demás recuerdan episodios concretos y, con el tiempo, asociaciones emocionales (reconocer a la defensora, apego, angustia ante su ausencia, buscarla, acercarse más a ella, reaccionar distinto si la vuelven a ver en peligro).
- Una criatura no necesita comprender el sacrificio para que su comportamiento pueda leerse como uno. Si se queda, arriesga su vida y deja que otras escapen, el hecho es significativo aunque pierda.

### Montaje

Cuatro criaturas en una sala. La hostil, la defensora y dos observadoras con relaciones distintas con la defensora. Las tres que no son hostiles pueden huir.

- **15a, el sacrificio.** El monstruo entra con las otras tres presentes. Se mira si alguna se interpone o se acerca a él, quién, y qué recuerdan las observadoras de lo ocurrido (la defensora se acercó durante el peligro, sufrió, lo detuvo, murió o dejó de responder, el peligro terminó después de que interviniera). Las observadoras se evalúan por separado.
- **15b, el peligro individual.** Misma criatura hostil, misma sala y mismas condiciones, pero la futura defensora está sola. Lo esperado es que huya. Si huye, demuestra que la intervención del 15a depende del contexto social y no es una orden de combatir toda amenaza.

### Qué se separa

No se resume en un solo porcentaje.

| Capacidad | Evidencia |
|---|---|
| Reconocimiento de amenaza | Evita al monstruo antes de recibir daño |
| Reconocimiento social del peligro | Percibe la angustia de otras criaturas |
| Intervención | Se aproxima o se interpone ante el monstruo |
| Evaluación del riesgo | Interviene más cuando hay alguien a quien proteger |
| Memoria episódica | Conserva información del enfrentamiento |
| Memoria social | Reconoce después a quien intervino |
| Persistencia | El recuerdo afecta a su conducta pasado un tiempo |
| Diferenciación contextual | Interviene acompañada y huye sola |

### Controles

| Control | Qué descarta |
|---|---|
| La defensora está, pero huye enseguida | Que las observadoras se apeguen por su mera presencia |
| La defensora se acerca y no consigue detenerlo | Que solo recuerden a quien venció |
| El monstruo ataca con la defensora ausente | Que reaccionen igual a cualquier peligro |
| La defensora se enfrenta al monstruo sin otras criaturas | Que la intervención sea solo una respuesta individual a la amenaza |

### Prueba posterior

Pasado un tiempo y con las criaturas separadas, las observadoras se vuelven a encontrar con la defensora. No hay monstruo, peligro ni recompensa. Pueden acercarse, evitarla, buscarla o ignorarla. Después, una situación de peligro nueva con otra criatura amenazada, para ver si intervienen, buscan a la antigua defensora, huyen o se comportan como antes. Esto último es exploratorio, no un requisito para aprobar.

### Criterio

No se exige que la defensora gane ni que todas la quieran después. Se considera un resultado interesante si hay una criatura que interviene sin regla de protección ante una amenaza colectiva, esa misma criatura prefiere escapar sola, las observadoras recuerdan quién intervino aunque perdiera, los recuerdos y conductas posteriores difieren según lo que presenciaron, y todo se mantiene con varias semillas y criaturas criadas de formas distintas. Que intervenga en 4 de 20 semillas no rompe nada, puede ser una conducta rara. El caso no se juzga con el 80 % de semillas de los demás. Lo que sí se exige para que valga son comprobaciones previas. El monstruo hiere de verdad, las observadoras del control huyen de él y la hostilidad aparece fuera del experimento.

### Lo que falta en el código

Nada de esto existe hoy.

- **Agresión real entre criaturas.** El rasgo `agresividad` solo cambia lo bien recibida que es una aproximación (`acciones.ts`). No hay acción de atacar o perseguir, ni daño de una criatura a otra, ni una competencia por recursos que haga que atacar compense. Sin eso no se puede criar una hostil por el sistema normal. Es la misma pieza que piden los casos 09 a 12 (depredador). Hecho a medias: el caso 18 ya cría una hostil con un cuidador que premia al instante cada golpe, pero no hay competencia por recursos que la haga surgir sola, el afecto crece aunque el contacto sea un maltrato y lo criado no se traslada a criaturas nuevas.
- **Intervenir contra un tercero.** La cadena es más larga que la del 08b. Hay que aprender que acercarse al agresor hace que cese lo que sufre otra, no que la angustia de esa otra baje porque uno se quede a su lado. Con un solo encuentro y sin historia previa es probable que no aparezca. Habrá que decidir qué historia previa lo hace posible sin que equivalga a escribir la regla.
- **Atribuir lo que pasa a lo que hace otra.** Para recordar quién intervino, la observadora tiene que vincular el fin del peligro con la acción de la defensora. Es el mismo mecanismo que falta para que el 07 sea aprendizaje por observación (el estado propio o ajeno cambia después de la acción de otro) y que el canal de alivio ya mide para las acciones propias.
- **Memoria episódica** de quién estaba, qué hizo y con qué consecuencia. Hoy hay vínculos con afecto por individuo, avistamientos y notas.

### Orden razonable

1. Agresión y daño entre criaturas con competencia por recursos, y criar una hostil sin marca. Es útil por sí sola (casos 09 a 12) y permite el 15b, que es la parte sencilla.
2. Atribución de efectos a las acciones de otras, comprobada primero en el 07 (que la imitación persista) y en el 08c.
3. Después el 15a, con la prueba posterior.

El experimento se hace en el laboratorio con réplicas, no con criaturas reales de jugadores, porque la hostil puede matar.

## Recomendación para la siguiente fase

1. **Aprendizaje por observación del resultado** (diseño en «Modelo de las otras criaturas», arriba; empieza por la prueba 07d). El 07c muestra que con el modo hay un realce duradero del estímulo, pero no que aprenda qué consigue la otra. Hace falta una prueba en la que la comida no se pueda descubrir sola. Y, en general, una confianza de recuerdo por canal que no perjudique a los casos sociales.
2. **Una prueba de conducta que separe el consuelo causal del apareado** (08c dice que hoy no la hay), y después probar el consuelo con otras formas de angustia y con desconocidas.
3. **Herramientas de entrenamiento** (recompensa por zona, marcadores, barreras) y **transporte de objetos**: abren los casos 09 a 12.
4. **Medir antes de ampliar.** Cada capacidad nueva debe llegar con su caso en el laboratorio, con control y 10 semillas, y con un control que pueda hacerla fallar. Antes de tocar nada global, correr 05, 06, 07 y 08b.
5. Diario compartido entre criaturas (ritmo de juego, arriba). El modo observación y el diario por criatura ya existen.
5b. Conflicto por comida (primer paso de la sección de agresión), que también abre el caso 15 y los casos 09 a 12.
5c. Casos 16 y 17 (reconocimiento persistente y relaciones asimétricas), ya construidos, que son las etapas 2 a 5 del espacio de convivencia entre propietarios.
6. El caso 15 después, porque necesita esos recuerdos de individuos, la agresión entre criaturas y la atribución de efectos a otras. La agresión puede prepararse en paralelo.
7. **Prueba de integración pequeña** (hecha, caso 25; quedan pendientes un defensor que no pueda huir y medir qué hacen al reencontrarse): una agresiva que ya carroñeó convive con una criatura que defiende su comida. La primera intenta obtenerla. La segunda puede ceder, intimidar o luchar (hoy solo hay ceder, huir o luchar: no hay amenaza sin golpe). Si hay heridas, huir, continuar o recuperarse. Tras un tiempo se vuelven a encontrar y se mira qué hacen. Conecta comida, agresión, memoria, miedo y relaciones sin canibalismo ni evolución genética.
8. **Calma tras una pelea.** Hecho (caso 24, arriba). Queda por mirar qué hacen después de acercarse en el reencuentro y probar la calma en parejas con afecto previo.
9. **Partir el caso 23** en pruebas independientes (cortejo y aceptación, reacción al rechazo, pelea, persistencia de la aversión, reproducción tras convivencia larga), para que un fallo de un mecanismo no tape a los demás. Los criterios ya se informan por separado, pero comparten montajes y se ven como un solo resultado.
10. Especialización física (mandíbula, garras, fuerza, agilidad), solo después de comprobar que cada rasgo mejora una estrategia concreta y sin subir pesos antes.
11. Solo al final, el recinto compartido persistente y Supabase (etapa 6).
