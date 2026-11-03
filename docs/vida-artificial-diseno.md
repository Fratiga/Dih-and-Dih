# Vida Artificial: simulador de criaturas autónomas

Documento de diseño recibido el 3-nov-2026 (texto pegado por el DM, sin imágenes). Es el punto de partida del proyecto. Las decisiones de este documento son suyas, salvo lo marcado como pendiente en `docs/vida-artificial-plan.md` cuando exista.

**Objetivo de calidad:** el juego debe tener la calidad y la inmersión de *JoJo's Pitter-Patter Pop!* (el minijuego Pitter-Patter de este repo es la referencia de acabado: interfaz cuidada, animación, sonido, transiciones, nada que parezca una hoja de cálculo).

**Inspiración visual:** carpeta `C:\Users\mherr\OneDrive\Desktop\dnd\Inspiraciones` (fuera del repo, no se sube). Dos subcarpetas:
- `Direccion de criaturas` (26 imágenes): biohorror de laboratorio (estilo Giger/Alien, extremidades largas, esqueletos, depredadores flacos), hojas de diseño con etapas de crecimiento y herencia entre padres e hijos, y unas pocas criaturas tiernas (cerdo-medusa de colores, tortuga-esfera). El contraste entre lo tierno y lo inquietante es la idea.
- `Direccion de lugares` (18 imágenes): laboratorios de ciencia ficción con cubas de contención verdes y cian, pasillos de cuarentena, salas de observación, y capturas de *Creatures* (1996) y *Creatures 3*: cortes laterales de habitaciones con máquinas, plantas y Norns.

## Fantasía central

> No programas lo que una criatura debe hacer. Creas las condiciones en las que aprende a hacerlo.

No es un simulador de mascotas, es un simulador de vida artificial, aprendizaje y evolución. El jugador no colecciona criaturas con habilidades: cría organismos con necesidades, predisposiciones, recuerdos y capacidad de aprender. Los entrena con experiencias, observa cómo se relacionan y modifica indirectamente su evolución.

**Regla que se mantiene en todo el proyecto:** los comportamientos emergentes deben ser reales, no una colección de eventos aleatorios disfrazados de inteligencia.

Decisiones ya tomadas por el DM: inteligencia híbrida, laboratorios individuales, espacios compartidos y mortalidad configurable.

## 1. Estructura general

Tres espacios que comparten el mismo sistema biológico (una criatura no puede comportarse de una manera en el laboratorio y tener otra inteligencia en el hábitat):

- **A. Laboratorio personal** (privado): criar y observar, experimentar con estímulos, reproducir, construir recintos, estudiar anatomía y comportamiento.
- **B. Hábitat compartido** (multijugador): criaturas de distintos jugadores, interacción social, encuentros y reproducción autorizada, ecosistema común, accidentes y conflictos.
- **C. Instalaciones especiales:** contención de organismos peligrosos, cámaras de observación, zonas de reproducción, laboratorios de genética, cuarentena.

## 2. El cerebro: arquitectura híbrida

No un único sistema de IA para todo. Módulos que colaboran:

1. **Percepción:** objetos, organismos, sonidos, olores, distancias, acontecimientos.
2. **Biología:** hambre, energía, salud, temperatura, dolor, sueño.
3. **Emociones:** miedo, curiosidad, frustración, apego, excitación.
4. **Memoria y aprendizaje:** asociaciones, experiencias, refuerzos, hábitos, aprendizaje social.
5. **Decisión:** red neuronal pequeña + selección de acciones + prioridades biológicas.
6. **Comportamiento:** explorar, comer, jugar, huir, acercarse, investigar, atacar, descansar. Las consecuencias retroalimentan la memoria.

### 2.1 La parte neuronal
Red pequeña y recurrente, inspirada en *Creatures*. Su función es aprender asociaciones entre estímulos internos y externos y las acciones disponibles. Ejemplo: percibe una criatura, tiene hambre y curiosidad, recuerda que acercarse terminó en pelea, decide mantener distancia. Otra de la misma especie con otras experiencias podría acercarse amistosamente. La red no contiene reglas del tipo «si ves una criatura, huye»: aprende asociaciones y preferencias.

### 2.2 La parte conductual
Las redes no controlan cada pequeño movimiento. Un sistema de selección de comportamientos por prioridades y puntuaciones (satisfacer una necesidad, evitar un peligro, investigar, buscar compañía, repetir una conducta recompensada, descansar). La red influye en las puntuaciones y en la selección; un sistema de acciones ejecuta. Así hay criaturas creíbles sin que la red aprenda a caminar desde cero.

### 2.3 Aprendizaje por consecuencias
No una recompensa inmediata simplista. Incluye: refuerzo inmediato, aprendizaje de consecuencias posteriores, asociación entre estímulos y acontecimientos, olvido gradual de recuerdos poco usados y **generalización** (una criatura castigada por acercarse a una luz roja puede evitar otras luces rojas aunque nunca las haya sufrido).

## 3. Personalidad, memoria y necesidades

| Rasgo | Qué representa |
|---|---|
| Curiosidad | Interés por explorar estímulos nuevos |
| Sociabilidad | Tendencia a acercarse a otros organismos |
| Agresividad | Predisposición a respuestas hostiles |
| Miedo | Sensibilidad ante amenazas |
| Apego | Tendencia a formar vínculos |
| Persistencia | Capacidad de insistir en una conducta |
| Territorialidad | Tendencia a defender espacios |
| Sensibilidad | Intensidad de respuesta ante estímulos |

No todos son hereditarios de forma directa: algunos son predisposiciones genéticas y otros estados desarrollados durante la vida.

**Memoria individual:** acontecimientos relevantes, asociaciones aprendidas e indicadores de frecuencia. No se guarda cada fotograma. Ejemplo de registro: «Día 3, positivo, recibió alimento después de acercarse a una figura humanoide»; comportamientos observados: «busca proximidad con el segundo organismo, evita descansar cerca del dispositivo sonoro». Importa para el rendimiento y para que el jugador entienda la historia de cada organismo.

## 4. Genética y evolución

Tres elementos por criatura: **genotipo** (información heredable), **fenotipo** (lo que realmente desarrolla) y **experiencia** (lo que aprende en vida).

- **Genoma modular** en vez de un modelo 3D por criatura: extremidades (cantidad, longitud, articulación), cabeza, piel, ojos, metabolismo, sistema nervioso (memoria, plasticidad, sensibilidad), sistema muscular. En la primera versión, piezas anatómicas modulares, esqueletos compatibles y variantes de sprites, no geometría libre.
- **Reproducción:** herencia de ambos progenitores, mutaciones pequeñas, dominantes y recesivos, costes y compensaciones (más fuerza, más alimento; sentidos muy finos, más sobresaltos), influencia del ambiente. No debe ocurrir que cada generación sea simplemente más fuerte.
- **Evolución conductual:** los hijos heredan predisposiciones, no los recuerdos. La selección natural en el hábitat debe hacer más frecuentes los rasgos de quienes sobreviven y se reproducen, y eso debe verse en el árbol genealógico.

## 5. Entrenamiento: enseñar mediante experiencias

Sin lista de órdenes. Herramientas: recompensas, estímulos (objetos, sonidos, señales), marcadores (referencias espaciales y sensoriales), objetos interactivos, barreras, compañeros (aprendizaje social) y observación.

Ejemplo, conseguir que una criatura vigile una puerta (no existe la opción «vigilar»): colocar un objeto interesante cerca, recompensar cuando permanece allí, introducir un estímulo que cruza la puerta, reforzar las respuestas deseadas, repetir con distintos estímulos, retirar las recompensas poco a poco. Puede haber efectos secundarios (territorialidad, frustración, apego excesivo a la zona).

**Generalización:** reaccionar a un objeto no implica reaccionar igual a todos. Depende de las experiencias y de la capacidad cognitiva. Una criatura puede proteger una figura e ignorar otra casi idéntica; otra puede generalizar de más y atacar cualquier cosa parecida.

## 6. Hábitats y multijugador

Se separa la propiedad de las criaturas del lugar donde viven.

- **Laboratorios privados:** control de organismos, instalaciones, experimentos, reproducciones y condiciones ambientales; se puede invitar a observar o colaborar.
- **Hábitat compartido:** espacio persistente con reglas comunes; las criaturas se conocen, forman vínculos, se evitan, compiten, se reproducen si las condiciones lo permiten, aprenden unas de otras y entran en conflicto. La interacción no depende de que ambos dueños estén conectados.
- **Protección del ecosistema:** nadie debe poder destruir gratis el trabajo de otro. Tres niveles: **Santuario** (nadie muere por otros organismos), **Reserva** (conflictos y heridas con mecanismos de protección), **Zona experimental** (muerte permanente y más riesgo). El propietario autoriza qué organismos se reproducen con los suyos y cuándo.

## 7. Mortalidad configurable

| Modalidad | Consecuencia |
|---|---|
| Protegida | No mueren por accidentes o ataques; pueden quedar heridas |
| Recuperable | Pueden morir, pero hay tratamientos y recuperación limitada |
| Permanente | La muerte es definitiva |

La genética influye en resistencia, recuperación y longevidad, sin hacer inmortal a nadie. **Legado:** al morir se conserva el genoma, el árbol genealógico, las experiencias, los descubrimientos, el historial de comportamiento y los descendientes.

## 8. Diseño visual e interfaz

No una interfaz de gestión llena de barras y formularios: debe transmitir que hay organismos viviendo en un lugar. Mezcla de la inocencia y expresividad de los Norns, la estética de laboratorio biológico, el encanto de los juegos de criaturas coleccionables y el contraste entre instalaciones acogedoras y cámaras de contención inquietantes.

- **Pantalla principal:** la criatura en el centro. Panel de necesidades, estado emocional, acciones de interacción, información de la criatura, acceso a observación y entrenamiento, laboratorio y árbol genealógico.
- **Observar sin intervenir** es indispensable: poder quedarse mirando varios minutos. Que una criatura descubra un objeto, lo manipule, se asuste, vuelva y termine jugando debe entretener por sí mismo. Cámara de seguimiento de un organismo.
- **Animaciones combinables** (no una animación única por movimiento): reposo, caminar, correr, comer, dormir, explorar, interactuar, acicalarse, jugar, mostrar miedo, agredir, defenderse, socializar. El comportamiento decide qué hacer y la animación lo representa.

## 9. Arquitectura técnica para el sitio

El sitio es estático con JavaScript clásico, GitHub Pages y Supabase. No introducir infraestructura de servidores permanentemente activos para este minijuego. (Nota del repo: desde el 26-oct-2026 se admite un paso de build si es gratuito y los jugadores no instalan nada; el minijuego Pitter-Patter usa Vite + TypeScript + Phaser 4 en `app/`.)

Módulos independientes, no diez sistemas mezclados en un archivo: `creature-core` (estado biológico y decisiones), `creature-brain` (red y aprendizaje), `creature-memory`, `creature-genetics`, `creature-behavior`, `creature-world` (entorno, objetos, percepción), `creature-simulation`, `creature-renderer` (sprites y animaciones), `creature-ui`, `creature-storage` (persistencia y Supabase).

- **Simulación por intervalos:** se guarda el estado y la hora de la última simulación; al volver a cargar se calcula el tiempo transcurrido y se simulan pasos discretos de lo pendiente. Máximo de tiempo offline, resumen de acontecimientos y prioridad a las necesidades y eventos importantes. No se simula ocho horas fotograma a fotograma.
- **Multijugador y autoridad:** la simulación local corre en JS, pero lo importante se valida. El cliente muestra decisiones y animaciones; Supabase guarda estados y acontecimientos; las funciones del servidor validan reproducción, propiedad y transferencias; RLS impide tocar criaturas ajenas; control de concurrencia en hábitats compartidos. El navegador no es la autoridad definitiva sobre genética ni recompensas.
- **Modelo de datos (propuesta):** `criaturas`, `criaturas_genetica`, `criaturas_cerebro`, `criaturas_memoria`, `criaturas_eventos`, `criaturas_relaciones`, `criaturas_reproduccion`, `habitats`, `habitat_objetos`, `habitat_criaturas`. JSONB para datos compactos, pero identificadores, propietarios, relaciones y campos consultados con frecuencia normalizados.
- **Optimización:** no guardar cada movimiento, no simular constantemente cada criatura, no usar redes enormes, no cargar todos los recuerdos de todas las criaturas a la vez. Simulación local mientras se observa, guardado periódico, solo información relevante para el aprendizaje.

## 10. Plan por etapas

La inteligencia artificial va primero porque todo lo demás depende de ella.

1. **Fase 1, el primer organismo** (prioridad máxima): criatura con necesidades y personalidad, movimiento autónomo, percepción de objetos, alimentación y descanso, decisiones sin intervención, primer sistema de memoria. Resultado: una criatura que puede vivir por sí misma.
2. **Fase 2, el aprendizaje:** red pequeña, aprendizaje asociativo, recompensas y castigos, recuerdos persistentes, generalización, diferencias individuales. Resultado: dos criaturas iguales de nacimiento pueden acabar comportándose distinto.
3. **Fase 3, el ecosistema:** varias criaturas, interacción social, objetos manipulables, juego, competencia y conflictos, aprendizaje por observación.
4. **Fase 4, genética:** genoma modular, reproducción, mutaciones, herencia, árbol genealógico, variaciones anatómicas.
5. **Fase 5, entrenamiento y experimentación:** herramientas de recompensa, estímulos, marcadores, contención, conductas aprendidas complejas.
6. **Fase 6, mundo compartido:** hábitats públicos, visitas, intercambios, reproducción entre jugadores, reglas de mortalidad, persistencia compartida.

## 11. Qué no se hace al principio

Cerebro neuronal enorme, IA generativa para conversar, animales con miles de genes, mundo 3D completo, simulación permanente en servidor, evolución totalmente aleatoria, miles de animaciones individuales. Tampoco muchas especies: una especie con inteligencia convincente y biología interesante vale más que veinte que solo cambian de apariencia.

## 12. Criterios para saber si la IA funciona

| Prueba | Qué debe demostrar |
|---|---|
| Criaturas gemelas | Diferentes experiencias producen diferentes conductas |
| Recompensa | Una acción reforzada se vuelve más frecuente |
| Castigo | Aprende a evitar determinadas experiencias |
| Generalización | Responde a estímulos similares sin haberlos experimentado todos |
| Memoria | Recuerda asociaciones después de desconectarse |
| Sociabilidad | Desarrolla preferencias por ciertos organismos |
| Descubrimiento | Aprende a manipular objetos sin instrucciones específicas |
| Reproducción | Los descendientes heredan predisposiciones, no recuerdos |
| Emergencia | Puede desarrollar secuencias de comportamiento no programadas |

La prueba más importante: si dos jugadores reciben organismos genéticamente idénticos y los crían en condiciones distintas, ¿pueden acabar con criaturas realmente distintas?

## 13. Visión final

La inocencia no se puede perder. Una criatura monstruosa debe poder dormirse abrazando un objeto. Un depredador puede sentir curiosidad por una mariposa. Un organismo muy agresivo puede tener miedo a la oscuridad. Una criatura cariñosa puede desarrollar celos. Organismos con contradicciones: ni máquinas de matar ni mascotas que producen felicidad.

**Descubrimiento de comportamientos no documentados:** el jugador encuentra una conducta extraña, investiga las experiencias que la causaron, la reproduce y comprueba si los descendientes tienen predisposición. Catálogo comunitario de descubrimientos (primera criatura que abrió una compuerta, primera población con juego colectivo, primera que reconoció a un cuidador tras una separación larga, primera línea con una mutación anatómica inédita). No son logros de puntos.

**Siguiente paso recomendado:** un prototipo exclusivamente de inteligencia artificial. Una habitación, dos criaturas genéticamente idénticas, algunos objetos, necesidades, memoria y aprendizaje. Sin economía, sin multijugador, sin reproducción todavía. Si esas dos criaturas aprenden, desarrollan preferencias y sorprenden al jugador, está el corazón del juego.

---

# Casos de éxito de inteligencia artificial

Son experimentos de validación de vida artificial, no misiones. Cada caso tiene una hipótesis de comportamiento, condiciones iniciales, un resultado esperado, por qué demuestra que el sistema funciona y variantes inesperadas que también cuentan como éxito.

## I. Aprendizaje individual
1. **El descubrimiento de la pelota** (caso fundamental). Una pelota en una habitación con una criatura que nunca la vio. Éxito: descubre que puede empujarla, perseguirla y manipularla, y aprende a buscarla por iniciativa propia. Demuestra curiosidad, experimentación y aprendizaje de las consecuencias de sus acciones.
2. **La asociación del alimento.** Se introduce un alimento nuevo y la criatura lo prueba. Éxito: lo reconoce y lo busca después, incluso sin tenerlo a la vista. Demuestra memoria asociativa y preferencias.
3. **La máquina accidental.** Un mecanismo que produce un resultado al manipularlo. Éxito: la criatura descubre cómo activarlo y repite la acción para obtener el resultado. Demuestra aprendizaje instrumental y causa-efecto.
4. **El recuerdo del peligro.** Se expone a una criatura a un estímulo desagradable en una zona. Éxito: evita después esa zona o estímulos asociados, aunque el peligro no esté. Demuestra memoria a largo plazo, condicionamiento y anticipación.

## II. Inteligencia social y comportamiento emergente
5. **El partido improvisado** (caso fundamental). Dos criaturas, una pelota y ninguna instrucción de jugar juntas. Éxito: empiezan a perseguir, empujar y devolver la pelota, con una interacción recíproca. No basta con que ambas empujen la pelota al azar: deben responder a las acciones de la otra.
6. **La compañía.** Dos criaturas juntas mucho tiempo. Éxito: preferencia mutua y búsqueda mutua para descansar o explorar. Demuestra reconocimiento individual, memoria social y vínculos.
7. **El aprendiz.** Una criatura experimentada manipula un objeto mientras otra observa. Éxito: la segunda empieza a reproducir la conducta sin haber recibido el mismo entrenamiento. Demuestra observación, imitación y aprendizaje social.
8. **El protector inesperado.** Dos criaturas con vínculo. Una vive un peligro. Éxito: la otra cambia sola su comportamiento para quedarse cerca, interponerse o acompañar. Demuestra que las preferencias influyen en las decisiones.

## III. Entrenamiento y conductas complejas
9. **El perro guardián** (caso fundamental). El jugador recompensa ciertas conductas cerca de una entrada y ante ciertos estímulos. Éxito: la criatura acaba quedándose en la zona y reaccionando a las presencias que aprendió a reconocer. Demuestra refuerzo, discriminación de estímulos y generalización.
10. **El depredador condicionado.** Se refuerzan persecución y respuesta agresiva ante ciertos estímulos. Éxito: desarrolla un patrón de acecho y persecución, pero conserva otras conductas independientes. Demuestra especialización sin una clase de combate programada.
11. **El recolector.** Objetos dispersos y recompensas por interactuar con ellos en ubicaciones concretas. Éxito: empieza a transportar objetos hacia una zona sin una orden explícita. Demuestra encadenamiento de acciones y objetivos espaciales.
12. **La solución imprevista.** Una criatura necesita alcanzar un objeto detrás de un obstáculo manipulable. Éxito: descubre una secuencia de interacciones que lo supera sin haber sido entrenada para ese mecanismo. Demuestra exploración, adaptación y combinación de acciones conocidas.

## IV. Personalidad, genética y evolución
13. **Los gemelos** (caso fundamental). Dos organismos con genomas idénticos reciben experiencias muy distintas. Éxito: desarrollan preferencias, miedos, vínculos y comportamientos significativamente distintos. Demuestra que el aprendizaje afecta de verdad a la personalidad.
14. **La herencia de los monstruos.** Se reproduce una línea con rasgos físicos y predisposiciones durante varias generaciones. Éxito: aparecen descendientes con combinaciones nuevas y rasgos heredados reconocibles. Demuestra genética, mutación, herencia y selección artificial.
15. **El extraño.** Se introduce una criatura en un grupo que no conoce. Éxito: los individuos reaccionan distinto según su personalidad y experiencias; unos se acercan, otros evitan y otros se muestran hostiles. Demuestra reconocimiento de novedad y diferencias individuales.

## V. Casos extremos: el ecosistema fuera de control
16. **La brecha de contención** (caso extremo). Un organismo peligroso desarrolla capacidades físicas y conductuales suficientes para superar su recinto. Éxito: escapa aprovechando el entorno y sus capacidades, sin un evento de escape programado. Demuestra autonomía, resolución de problemas, interacción física y consecuencias emergentes.
17. **El colapso del hábitat.** Se introduce un depredador en un ecosistema con varias especies. Éxito: las criaturas reaccionan solas (algunas huyen, otras se esconden, otras se defienden) y la población puede colapsar si el depredador rompe el equilibrio. Demuestra simulación ecológica y consecuencias sistémicas.
18. **La tradición.** Una criatura descubre una forma de interactuar con un objeto que da una recompensa. Otras la observan y la imitan. Éxito: la conducta se extiende por el grupo y continúa aunque el descubridor ya no esté. Demuestra transmisión cultural y persistencia de comportamientos de grupo.

## Cómo usar los casos durante el desarrollo

| Nivel | Casos | Objetivo |
|---|---|---|
| Básico | 01 a 04 | Demostrar que un individuo aprende |
| Social | 05 a 08 | Demostrar que aprende con otros |
| Conductual | 09 a 12 | Demostrar entrenamiento y adaptación |
| Evolutivo | 13 a 15 | Demostrar personalidad y herencia |
| Avanzado | 16 a 18 | Demostrar autonomía y comportamiento emergente |

**Éxito no significa resultado garantizado.** El caso 05 no se aprueba porque dos criaturas empujaron una pelota varias veces. Debe comprobarse que hay reciprocidad entre las acciones, que la interacción se mantiene un tiempo, que las criaturas cambian sus acciones según lo que hace la otra, que no depende de una secuencia fija y que la conducta es menos probable cuando se elimina la posibilidad de interacción social. Hay que distinguir inteligencia emergente de casualidad.

**Laboratorio de pruebas.** Una instalación especial dentro del juego, al principio solo para el desarrollador, para configurar experimentos y observar resultados. Cada caso con condiciones iniciales reproducibles, semillas aleatorias registradas, número de organismos, duración, registro de acciones, historial de aprendizaje y resultado esperado frente a observado. Poder repetir el mismo experimento con distintas semillas para comprobar que no fue suerte.

**Criterio de éxito definitivo:** crear dos criaturas iguales, ponerlas en situaciones distintas y ver cómo desarrollan comportamientos propios que luego se pueden explicar por sus experiencias. Las cinco grandes pruebas de fuego son los casos **05, 09, 13, 16 y 18**.
