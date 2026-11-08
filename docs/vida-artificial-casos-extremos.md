# Vida Artificial: casos extremos de inteligencia (E19 a E38)

Texto recibido del DM el 3-nov-2026, a continuación de los 18 casos de `docs/vida-artificial-diseno.md`. **Numeración:** desde el 8-nov-2026 estos casos se escriben **E19 a E38** (la «E» es de extremos). El laboratorio de pruebas (`app/src/vida/lab/casos.ts`) usa los números 16 a 32 para otras pruebas, así que «caso 25» a secas es del laboratorio y «E25» es el maestro. Cuando un caso extremo tiene una prueba equivalente o parcial en el laboratorio se indica con *(Laboratorio: caso N)*. Qué capacidades exige cada uno y en qué orden se construyen está en `docs/vida-artificial-plan.md`, en «Mapa de capacidades para los casos pendientes». No son comportamientos garantizados ni objetivos explícitos del jugador: deben poder emerger de la interacción entre genética, experiencia y entorno. Ninguno está implementado todavía. Requieren ampliar el modelo (memoria episódica, comunicación, planificación, reconocimiento de individuos, aprendizaje social acumulativo, adaptación biológica durante la vida).

## I. Inteligencia estratégica y resolución de problemas
- **E19. El ingeniero accidental.** Mueve objetos para alcanzar otros fuera de su alcance y acaba combinando herramientas y obstáculos. Prueba: un desafío de tres o más acciones sin entrenar esa secuencia. Demuestra planificación, memoria de trabajo y composición de acciones.
- **E20. La fuga calculada.** Aprende que ciertas acciones del cuidador preceden a la apertura de su recinto y espera, se acerca o manipula objetos en esos momentos. Prueba: cambiar el horario de apertura. Demuestra secuencias temporales, anticipación y planificación.
- **E21. El acechador.** Aprende que perseguir directo hace huir al objetivo y empieza a esconderse, esperar o rodear. Prueba: objetivos que reaccionan a su presencia. Demuestra adaptación estratégica y aprendizaje de las respuestas de otros agentes. *(Laboratorio: casos 21 y 26, caza y persistencia depredadora, sin que las presas aprendan del cazador)*
- **E22. La herramienta improvisada.** Descubre que un objeto sirve para alcanzar, mover o activar otro. Prueba: herramientas distintas y desafíos que pidan usos nuevos. Demuestra transferencia de aprendizaje y uso funcional de objetos.

## II. Conductas sociales complejas
- **E23. La cooperación espontánea.** Dos criaturas descubren que una tarea imposible a solas se completa juntas. Prueba: un objeto demasiado pesado para una, manipulable por dos. Demuestra coordinación, aprendizaje social y adaptación de roles.
- **E24. La jerarquía emergente.** Un grupo desarrolla relaciones estables de dominancia, sumisión o cooperación alrededor de recursos. Prueba: si se mantienen, cambian y afectan el acceso a recursos. Demuestra memoria social, reconocimiento individual y dinámica de grupo. *(Laboratorio: caso 25, quién quiere la comida de otra, con un par)*
- **E25. El maestro.** Una criatura experimentada facilita que otra aprenda (acerca objetos, repite una acción cuando la otra mira). Prueba: comparar el aprendizaje de quien convive con expertos y de quien no. Demuestra enseñanza activa, no solo imitación. *(Laboratorio: casos 07, 07b y 07c, que solo muestran facilitación)*
- **E26. El rescate.** Una criatura queda atrapada o incapacitada y otra cambia su conducta para acercarse, ayudar o quedarse junto a ella. Prueba: si la ayuda depende de vínculos previos, experiencias y señales de necesidad. Demuestra conducta prosocial y sensibilidad a estados ajenos. *(Laboratorio: casos 08, 08b y 08c, protector y consuelo)*

## III. Engaño, manipulación y aprendizaje adversarial
Requieren que las criaturas aprendan que otros organismos tienen estados internos, expectativas y respuestas predecibles.
- **E27. El falso dormido.** Aprende que los cuidadores se acercan cuando parece descansar y se queda inmóvil, reanudando la actividad cuando se acercan. Prueba: variar las condiciones de observación. Demuestra contingencias sociales y conducta engañosa emergente.
- **E28. El ladrón oportunista.** Aprende a distraer a otra para llegar a un recurso que esta protege. Prueba: recursos disputados e interacciones repetidas. Demuestra adaptación social y estrategias indirectas. *(Laboratorio: caso 20, conflicto por la comida)*
- **E29. La llamada falsa.** Aprende que una señal atrae a otras y la emite donde no existe el estímulo que la provoca. Prueba: si otras acuden y si el emisor la repite según sus resultados. Demuestra comunicación aprendida y uso estratégico de señales.

## IV. Cultura y transmisión entre generaciones
- **E30. El ritual sin propósito.** Un grupo desarrolla una secuencia de acciones alrededor de un objeto o lugar que persiste sin la recompensa original. Prueba: retirar el estímulo inicial. Demuestra tradición y persistencia cultural.
- **E31. El dialecto.** Dos poblaciones desarrollan señales distintas para lo mismo. Prueba: intercambiar individuos y medir si aprenden las señales de la nueva comunidad. Demuestra comunicación simbólica rudimentaria y transmisión cultural.
- **E32. La tradición heredada.** Una conducta inventada por un individuo pasa a compañeros, descendientes y nuevos miembros. Prueba: retirar al descubridor y ver si sobrevive varias generaciones. Demuestra cultura acumulativa y memoria colectiva distribuida. *(Laboratorio: caso 14, herencia de rasgos, sin conducta)*

## V. Biología extrema y adaptación
- **E33. La metamorfosis adaptativa.** Cambios físicos durante la vida ante condiciones ambientales persistentes. Prueba: criar bajo condiciones distintas y comparar fenotipos. Requiere regulación genética y desarrollo fenotípico, no solo mutaciones al reproducirse.
- **E34. La automedicación.** Una criatura enferma descubre que cierta planta o sustancia alivia sus síntomas. Prueba: recursos con efectos biológicos distintos. Demuestra aprendizaje basado en estados internos y selección de recursos por sus consecuencias fisiológicas. *(Laboratorio: caso 22, manías y aversiones, solo por aspecto y conducta)*
- **E35. La migración.** Una población abandona un hábitat deteriorado hacia otro mejor. Prueba: modificar gradualmente los recursos y ver si el grupo encuentra rutas y destinos alternativos. Demuestra navegación, memoria espacial y decisiones ecológicas.

## VI. Catástrofes y ecosistemas emergentes
- **E36. La fuga en cadena.** Una criatura escapa y altera a las demás: unas aprovechan la abertura, otras se esconden, otras intentan volver. Prueba: hábitat con varios organismos y una brecha física. Demuestra propagación de comportamientos y consecuencias no guionizadas.
- **E37. El ecosistema que se reconstruye.** Tras una catástrofe, las supervivientes modifican el entorno (transportan objetos, dispersan semillas, crean refugios). Prueba: retirar la infraestructura inicial. Demuestra construcción de nichos y adaptación colectiva.
- **E38. La presión evolutiva.** Un depredador altera una población durante generaciones y las presas supervivientes muestran rasgos heredables que mejoran su supervivencia. Prueba: presión ambiental estable y registro de cambios genéticos y fenotípicos. Demuestra selección natural observable. *(Laboratorio: casos 14 y 23, herencia y reproducción, sin presión de depredador)*

## Qué sistemas nuevos exigirían

| Capacidad adicional | Casos que habilita |
|---|---|
| Planificación y memoria de trabajo | E19 a E22 |
| Reconocimiento de individuos y estados ajenos | E23 a E29 |
| Comunicación aprendida | E29 a E32 |
| Transmisión cultural | E30 a E32 |
| Plasticidad del desarrollo | E33 |
| Aprendizaje basado en estados fisiológicos | E34 |
| Navegación y memoria espacial | E35 |
| Simulación multiagente y ecología | E36 a E38 |

## Lo que el prototipo ya aporta a estos casos

- Memoria espacial básica (avistamientos de objetos y zonas de dolor): base de E35.
- Crédito causal con retardo (una acción recibe parte del mérito de lo que ocurre después): base de E19, E20 y E22.
- Reconocimiento individual por huella y vínculos con afecto: base de E24, E26 y E27, aunque aún no modelan estados ajenos.
- Los gemelos y el laboratorio con semillas y controles sirven de plantilla para medir estos casos.
- Falta casi todo lo demás: planificación de varios pasos, comunicación, imitación, reproducción, desarrollo fenotípico.
