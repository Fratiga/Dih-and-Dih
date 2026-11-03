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

Rueda del ratón sobre la sala (no sobre un panel): hacia arriba se acerca (sala, seguir, cerca) y hacia abajo vuelve a la vista de la sala. Teclas: espacio pausa, 1 2 3 velocidades, O observar, C cámara, Tab cambia de criatura, P premiar, S asustar, M sonido, F pantalla completa.

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

Una semilla de 04b no aprueba porque esa criatura, con poco miedo de nacimiento, apenas distingue los focos: es una diferencia individual, no un fallo de la prueba. En 20 semillas, 18 aprueban.

### Caso 05, partido improvisado

Dos criaturas, una pelota, 25 minutos y dos medidas de reciprocidad: turnos alternados con rachas y una prueba de permutación circular que desplaza en el tiempo los empujones de una para ver cuántas respuestas mutuas habría por azar.

Sin percepción del otro no había reciprocidad (0/10: ambas jugaban mucho, 80 a 120 empujones, pero la proporción de turnos alternados era de 0,5, lo que daría el azar). Se añadió que **cada criatura perciba lo que hace la otra**: si una criatura que ve acaba de empujar o tocar algo, se fija en ello (sube la curiosidad y la excitación), le deja un recuerdo suave de que eso entretiene y la cosa gana atractivo unos 8 s (más cuanto más sociable es). No hay ninguna regla de "devolver la pelota". Con eso la proporción de turnos alternados sube a 0,6 a 0,8 y hay rachas de hasta 16 turnos seguidos.

Es el resultado menos sólido de los casos: 9/10 con las semillas 1 a 10 y 16/20 con 1 a 20. Antes se probó que compartir diversión cuente como compañía y una habituación por objeto; esto último debilitaba el caso 13 y se quitó.

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

## Pendiente

- **Casos sociales y de entrenamiento**: 06 (compañía), 07 (aprendiz), 08 (protector), 09 (perro guardián), 10 a 12. El 05 ya tiene la base (percepción de lo que hace el otro); el 07 puede apoyarse en el recuerdo suave que deja verlo.
- **Reproducción y herencia** (Fase 4): hoy solo hay genoma, sin cruce ni mutación. Los hijos deben heredar predisposiciones y no recuerdos (ya está preparado: el cerebro y la memoria nacen de nuevo). El genoma visual ya es heredable: falta el cruce y la mutación.
- **Mortalidad** recuperable y permanente, y legado.
- **Estados ajenos y comunicación** (casos 19 a 38): ver `docs/vida-artificial-casos-extremos.md`.
- **Temperatura** como necesidad y entornos distintos.
- **Supabase**: tablas de criaturas, memoria, eventos y relaciones; funciones del servidor que validen genética y recompensas.
- **Mover la cámara** con el ratón y más herramientas (marcadores, barreras, sonidos como estímulo).
- **Probar en un portátil sin tarjeta gráfica** y en pantalla completa real.
- **Un segundo recinto** para criar a los gemelos por separado desde el juego (hoy conviven en una sala; para separarlos basta con elegir qué objetos hay y a quién se premia o asusta).
- **Sonido**: la música ambiental es solo un zumbido y gotas. Falta una pista propia si se quiere.

## Recomendación para la siguiente fase

1. **Ampliar la percepción del otro.** Hoy solo se percibe que otra criatura empujó o tocó algo. Falta que entren comer, asustarse y su estado (casos 06, 07, 08 y los de estados ajenos).
2. **Medir antes de ampliar.** Cada capacidad nueva debe llegar con su caso en el laboratorio, con control y 10 semillas, como se hizo aquí.
3. **Aprendizaje por observación (caso 07)** antes de la reproducción: es lo que separa "heredan predisposiciones" de "heredan costumbres".
4. **Después, genética** (Fase 4), con los casos 14 y 15, y solo entonces el hábitat compartido.
