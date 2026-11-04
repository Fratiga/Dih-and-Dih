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
- Queda informativo (5/10). Siguen sin hacer el canibalismo con criaturas adultas de la misma sala, la selección de rasgos físicos (colmillos, garras) y que la presa pueda huir.

### Manías por el aspecto y por la conducta (caso 22)

Una criatura puede coger manía a un rasgo físico (los cuernos, por ejemplo) o a una conducta, a partir de lo que ha vivido, y la aplica a criaturas que no conoce. Detrás de `gustos` (apagado por defecto).

- **Cuernos** (`Cuerpo.cuernos`, de 0 a 1, heredable y a 0 por defecto): se perciben como angulosidad, menos redondez. Se probó antes como brillo y se descartó, porque el brillo alto ya se asocia con peligro (los focos que dan descarga). No hay dibujo de cuernos todavía, solo el rasgo y su efecto. Si ninguno de los padres tiene, el hijo no tiene (no hay mutación desde cero).
- **Gustos por aspecto.** Cuatro rasgos (tamaño, color cálido, color verde y cuernos). Cada experiencia mala con una criatura (daño, y luego rechazo) baja el gusto por sus rasgos, y cada buena (compañía, un premio tras el maltrato) lo sube. Se aplica a cualquiera que los tenga: cuenta al acercarse (`pesoGusto`) y en cuánto afecto se crea al convivir.
- **Fama por conducta.** Si ve pegar a otra criatura que no es ella (`ultimoGolpe`), queda con fama de pegar (`reputacion`) y la prefiere menos, aunque a ella nunca le haya hecho nada.

Resultados con 10 semillas:

| Condición | Llega antes a la nueva sin cuernos |
|---|---|
| Maltratada por una con cuernos | **0,93** |
| Maltratada por una sin cuernos | **0,17** |
| Sin maltrato (compañera de cuernos intermedios) | 0,56 |

- La manía se generaliza en las dos direcciones. Pasan 8 y 9 de 10 semillas, y el control sin preferencia 9 de 10.
- Tras ver pegar a una tercera, la fama es de 1,0 y prefiere a la pacífica el 81 % de las veces (7 de 10 semillas).
- Un hallazgo que cambió el control: con una compañera sin cuernos, la criatura cogía gusto por los sin cuernos solo por convivir (0,78), porque la convivencia agradable también enseña a querer los rasgos de quien convive. Es el comportamiento diseñado. El control justo es una compañera de cuernos intermedios.
- Pasan los cuatro criterios a la vez 5 de 10 semillas. Queda informativo.

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

## Reproducción: camadas, cortejo y rechazo (parcialmente hecho)

Sale de una conversación sobre cómo debería comportarse la reproducción. Se recoge la lógica, en términos de conducta.

### Hecho

- **Crías.** El botón Criar ya existía. Ahora crea una **camada**: casi siempre una cría (80 %), a veces dos (17 %) y pocas veces tres (3 %), sin pasar del hueco que quede en la sala (`tamanoCamada` y `parir` en `simulacion.ts`, `camadaDos` y `camadaTres` en `ajustes.ts`).
- **Mellizos, no gemelos idénticos.** Cada cría cruza los genomas por separado, así que son hermanas distintas. Los gemelos idénticos (el mismo genoma) quedan fuera, coherente con que los gemelos son solo del estado de pruebas. Si en algún momento se quisieran como nacimiento raro, es una decisión aparte.
- **Sexo.** Sale del genoma sin gastar azar nuevo (`sexoDe` en `genoma.ts`): sobre la mitad de cada uno. De momento no cambia nada: Criar no lo exige y nadie lo percibe.
- Pruebas unitarias del reparto de camadas, de que los mellizos no son clones y respetan el hueco, y del reparto del sexo.

### Diseño pendiente

1. **Impulso reproductivo** como necesidad nueva. Sube cuando es adulta y baja al reproducirse o con el tiempo, igual que el hambre. Mueve a buscar pareja, pero no elige a quién.
2. **A quién busca.** Quien conoce y quiere (afecto, reconocimiento por rasgos) y el sexo distinto. Depende de la historia con cada individuo, no de una regla fija.
3. **Cortejo y aceptación mutua.** Quien busca se acerca con esa intención y la otra acepta o rechaza. Rechaza si el afecto por quien se acerca es bajo, si no tiene impulso, si está en mal estado (hambre, miedo) o por lo aprendido: si **ya fue castigada tras un intento de reproducirse**, o si la otra recibió un castigo por intentarlo, la sola aproximación provoca mala reacción y se niega.
4. **La reproducción solo ocurre con aceptación de las dos. El rechazo se respeta y no se puede forzar,** aunque quien lo recibe se ponga agresivo. Lo que sí puede hacer es **ponerse violenta**. Según cuánta **aversión a la reproducción** tenga la criatura que rechazó, el rechazo puede acabar en una pelea si las dos son agresivas. La agresividad no cambia el resultado de la petición, solo lo que pasa después.
5. **Consecuencias del rechazo para quien lo recibe.** Frustración (ya existe) y, según el carácter, **agresividad** hacia ese individuo (con `agresion`) o **resentimiento** (enfría el afecto y se anota un agravio, con `anotarAgravio`, y se aparta). Si se repite, queda como aversión hacia ese individuo.
6. **Aversión aprendida por castigo.** Si el cuidador asusta a una criatura cada vez que tiene una interacción reproductiva, aprende a asociar esa conducta y los rasgos de ese sexo con un susto, y con el tiempo se aparta de todas las del sexo opuesto, no solo de una. Es reversible con premios. Para que se generalice hay que poder percibir el sexo como rasgo. Hoy no se percibe.
7. **Aversión por rasgos físicos y por conducta.** La criatura puede desarrollar rechazo por ciertas características físicas (que no le gusten los cuernos, por ejemplo) o por criaturas con sesgos hacia ciertas conductas. Son los gustos y la fama del caso 22, y entran en la decisión de aceptar a una pareja.
8. Todo se expresa con conducta aprendida y no con etiquetas de personalidad.

### Qué hay que construir

- Sexo percibible como rasgo de lo que se ve de otra criatura.
- Necesidad de impulso reproductivo.
- Una acción de cortejo. Si es un verbo nuevo cambia el tamaño de la entrada de la red y mueve todos los casos medidos, así que primero se prueba reutilizando `acercarse` con intención, y solo si no basta se añade el verbo y se repite toda la regresión.
- Aceptación y rechazo, gestación y parto sin intervención del jugador (con camadas), y límites de población por espacio.
- Casos de laboratorio: cortejo y rechazo con distintos afectos, aversión aprendida por castigo y su reversión con premios, y herencia a lo largo de generaciones.

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

1. **Aprendizaje por observación del resultado.** El 07c muestra que con el modo hay un realce duradero del estímulo, pero no que aprenda qué consigue la otra. Hace falta una prueba en la que la comida no se pueda descubrir sola. Y, en general, una confianza de recuerdo por canal que no perjudique a los casos sociales.
2. **Una prueba de conducta que separe el consuelo causal del apareado** (08c dice que hoy no la hay), y después probar el consuelo con otras formas de angustia y con desconocidas.
3. **Herramientas de entrenamiento** (recompensa por zona, marcadores, barreras) y **transporte de objetos**: abren los casos 09 a 12.
4. **Medir antes de ampliar.** Cada capacidad nueva debe llegar con su caso en el laboratorio, con control y 10 semillas, y con un control que pueda hacerla fallar. Antes de tocar nada global, correr 05, 06, 07 y 08b.
5. Diario compartido entre criaturas (ritmo de juego, arriba). El modo observación y el diario por criatura ya existen.
5b. Conflicto por comida (primer paso de la sección de agresión), que también abre el caso 15 y los casos 09 a 12.
5c. Casos 16 y 17 (reconocimiento persistente y relaciones asimétricas), ya construidos, que son las etapas 2 a 5 del espacio de convivencia entre propietarios.
6. El caso 15 después, porque necesita esos recuerdos de individuos, la agresión entre criaturas y la atribución de efectos a otras. La agresión puede prepararse en paralelo.
7. Solo al final, el recinto compartido persistente y Supabase (etapa 6).
