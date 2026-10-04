# Informe de ortografía

## Qué se corrigió

Solo errores inequívocos en texto visible. El resto del texto ya estaba bien acentuado.

| archivo | cambio | veces |
|---|---|---|
| data/objetos.js | tag `proteccion` → `protección` | 6 |
| objetos.html | grupo de filtro "Categoría": `proteccion` → `protección` (debe coincidir con el tag) | 1 |
| data/stats.js | `tipo: "Draconico"` → `"Dracónico"` | 7 |
| data/bufon-musica.js | comentario con voseo que quedó de la primera ronda: "Agregá" → "Agrega" | 1 |

## Qué se revisó y salió limpio

- Palabras sin tilde que sí existen con tilde en el resto del sitio (acción, sesión, reacción, etc.): todas las apariciones restantes son identificadores de código, ids, clases CSS, anclas (`#cap-conclusion`), claves de datos o nombres de archivo, no texto visible. No se tocaron.
- Palabras sin tilde que son correctas como verbos o adjetivos (continua, perdida, seria, valida, limite, interprete, practica y similares): sin cambios.
- Abreviaturas de chat (q, xq, pq, tmb, xfa): ninguna en texto visible.
- Dobles espacios en prosa: ninguno. Los que hay son alineación de código y comentarios.
- Signos de apertura ¿ y ¡: las preguntas sin ¿ en la misma línea son preguntas que abren en una línea anterior.
- Faltas de bulto como "dió", "fué", "vió", "guión", "porqué": ninguna.

## Dudoso, sin cambiar

### 1. "sólo" con tilde (218 apariciones)

La RAE desaconseja la tilde en "solo" desde 2010, y el resto del sitio escribe "solo" sin tilde. No es un error, es una decisión de estilo. Si quieres unificar, se puede cambiar todo a "solo" de una vez.

| archivo | línea | contexto |
|---|---|---|
| data/bufon-contenido.js | 328 | a tan insignificante como el "ser" y tú sólo venías a saludar.', |
| data/entries.js | 2169 | cultad adicional, pues puede afectar no sólo materia sino también la manera en que é |
| data/entries.js | 2188 | eficaz necesita, por tanto, resolver no sólo qué sustancia ocupará una región, sino |
| data/entries.js | 2223 | mpuestos que responden a intención y no sólo a estímulos físicos.</p> |
| data/entries.js | 2240 | l en corteza, cristal o metal puede ser sólo la manifestación visible de una estruct |
| data/entries.js | 2248 | to y dejar inconsistencias internas que sólo aparecen bajo tensión, uso mágico o int |
| data/entries.js | 2266 | otra capa, y es que la materia debe no sólo adoptar una forma, sino convertirse en |
| data/entries.js | 2587 | deseado. El control requiere definir no sólo hacia qué estado debe desplazarse una e |
| data/entries.js | 2723 | la influencia arcana es mínima o actúa sólo en circunstancias excepcionales. Su imp |
| data/entries.js | 2742 | depende de una estructura temporal que sólo aparece durante determinados estados.</ |
| data/entries.js | 2752 | pecies desarrollan órganos o afinidades sólo después de determinados cambios fisioló |
| data/entries.js | 2764 | ervención externa. Aun así, representan sólo una parte del fenómeno general.</p> |
| data/entries.js | 2777 | ie alar y maniobrabilidad no se explica sólo mediante musculatura. En especies de gr |
| data/entries.js | 2778 | explicaciones fisiológicas ordinarias y sólo después se introduce un componente arca |
| data/entries.js | 2797 | integran con facilidad. Otras aparecen sólo bajo determinadas combinaciones o perma |
| data/entries.js | 2910 | eología Arcana estudia estos lugares no sólo como testimonio histórico, sino como si |
| data/entries.js | 2916 | as permanecen latentes, otras conservan sólo residuos, y algunas se reactivan al rec |
| data/entries.js | 2921 | >Una estructura también puede conservar sólo parte de su función original. Una red d |
| data/entries.js | 2925 | <p>Las capas arqueológicas incluyen no sólo sedimentos, sino también superposicione |
| data/entries.js | 2947 | n uniforme o un título puede satisfacer sólo una parte de esa relación perdida.</p> |
| data/entries.js | 2981 | parente puede sostener una relación que sólo se vuelve visible cuando desaparece.</p |
| data/entries.js | 2983 | cionar energía a una estructura antigua sólo para ver qué hace es un experimento de |
| data/entries.js | 3024 | <p>Una ruina no demuestra una teoría sólo porque pueda interpretarse de acuerdo c |
| data/entries.js | 3033 | osotros. Una red puede despertar cuando sólo pretendíamos reparar uno de sus nodos.< |
| data/entries.js | 3153 | pero excluye objetos que sólo conservan un efecto externo temporal. U |
| data/entries.js | 3181 | Por ello, Dolbred registra no sólo el objeto, sino la relación entre el ob |
| data/entries.js | 3279 | <p>Una pieza encontrada puede ser sólo un componente. La tendencia a tratar to |
| data/entries.js | 3330 | <p>Una activación experimental sólo se justifica cuando la información obte |
| data/entries.js | 3415 | sólo es seguro mientras las hipótesis que lo |
| data/entries.js | 3424 | nsiderar por ello cambios externos y no sólo |
| data/entries.js | 3632 | <p>Una superficie puede limpiarse sólo hasta el punto necesario para leer una |
| data/entries.js | 3653 | por tanto, estudiar primero si el libro sólo describe |
| data/entries.js | 3758 | <p>Un objeto que sólo puede conservarse después de ser destru |
| data/entries.js | 3896 | a somática de un objeto o una firma que sólo aparece al |
| data/entries.js | 3902 | hipótesis y qué parte sólo identifica una tradición probable.</p> |
| data/entries.js | 4080 | sólo estaba presente para ser encontrado.</p |
| data/entries.js | 4081 | ado puede debilitar una hipótesis, pero sólo si se demuestra |
| data/entries.js | 4158 | <p>Las muestras de alto riesgo sólo pueden analizarse en instalaciones cert |
| data/entries.js | 4233 | les anonimizados, y las muestras reales sólo se utilizan bajo |
| data/entries.js | 4384 | forma sin perder continuidad y otras sólo pueden reproducirse bajo condiciones ri |
| data/entries.js | 4438 | generación extrema requiere resolver no sólo producción de tejido, sino información |
| data/entries.js | 4450 | e parece una especie distinta puede ser sólo una fase juvenil. Este error fue |
| data/entries.js | 4471 | <p>Algunas especies depositan huevos sólo en regiones específicas porque el ambie |
| data/entries.js | 4479 | <p>Una característica puede aparecer sólo cuando coinciden linaje y exposición.</ |
| data/entries.js | 4510 | encia dificulta la clasificación basada sólo en morfología y obliga a distinguir |
| data/entries.js | 4548 | observador que sólo evalúa vegetación, presas o refugio fís |
| data/entries.js | 4557 | sólo qué individuo la ejerce, resulta indisp |
| data/entries.js | 4686 | n dragón adulto que reclama un valle no sólo caza dentro de sus límites: su sola |
| data/entries.js | 4728 | opia emisión mágica, una adaptación que sólo resulta comprensible al |
| data/entries.js | 4742 | e a depredadores pequeños, mientras que sólo una respuesta activa |
| data/entries.js | 4749 | e uso casi exclusivamente predatorio, y sólo aparece |
| data/entries.js | 4754 | o real de una defensa que en apariencia sólo se activa ante amenaza |
| data/entries.js | 5035 | stancia ni que fluya de manera literal; sólo reconoce que los cambios poseen orden.< |
| data/entries.js | 5049 | da desde otra referencia. Esta relación sólo puede medirse |
| data/entries.js | 5132 | memoria interna y sólo pueden detectarse desde una referencia |
| data/entries.js | 5155 | s conservan información completa; otros sólo dejan residuos, |
| data/entries.js | 5223 | teórico, la operación exige definir no sólo un momento de destino, |
| data/entries.js | 5377 | ndo una estructura intenta modificar no sólo un acontecimiento, sino |
| data/entries.js | 5470 | otras sólo adoptan uno cuando necesitan interactua |
| data/entries.js | 5598 | sujeto, no sólo como costumbres culturales.</p> |
| data/entries.js | 5974 | aderas, cavidades y depósitos minerales sólo por ocupar un territorio durante sufici |
| data/entries.js | 5982 | de alas convencionales o las utilizan sólo como superficies de control. Los kairon |
| data/entries.js | 6092 | <p>El aliento dracónico es sólo una versión de una función más general. |
| data/entries.js | 6132 | extintos, otros sólo se conocen por restos y ciertos grupos |
| data/entries.js | 6141 | ya no puede explicarse sólo mediante zoología.</p> |
| data/entries.js | 6410 | ro de su estructura mineral y liberarla sólo cuando se descompone; una especie |
| data/entries.js | 6467 | <p>Los organismos no sólo responden a condiciones arcanas. En cie |
| data/entries.js | 6496 | plantas o fauna que sólo se encuentran dentro de ese radio.</p> |
| data/entries.js | 6502 | e estudiarse como sistema completo y no sólo como área de caza, y Dracología |
| data/entries.js | 6567 | puede ser invisible si el investigador sólo registra alimento y |
| data/entries.js | 6613 | sólo funcionan mientras se mantiene una pres |
| data/entries.js | 6643 | ón depende de comprender relaciones, no sólo de medir concentraciones.</p> |
| data/entries.js | 6716 | o demuestra que el modelo sea completo; sólo que capturó |
| data/entries.js | 6870 | roducir síntomas visibles y reactivarse sólo bajo |
| data/entries.js | 6930 | identificar si el ambiente sólo transporta la condición o la genera act |
| data/entries.js | 6954 | eglas de transmisión. Una maldición que sólo pasa al |
| data/entries.js | 7027 | importados, y sólo después aparece transmisión local si el |
| data/entries.js | 7029 | fuente o sólo una de las rutas.</p> |
| data/entries.js | 7128 | ión no puede salir. Un cordón sanitario sólo resulta sensato después de |
| data/entries.js | 7138 | s sirve de poco si la condición depende sólo de |
| data/entries.js | 7152 | sólo cuando los protegidos interrumpen realm |
| data/entries.js | 7173 | epidemiológico y no sólo una preocupación moral.</p> |
| data/entries.js | 7242 | puede producir casos sólo por cercanía, sin que exista ningún vín |
| data/entries.js | 7370 | precisamente ese problema. No pregunta sólo qué |
| data/entries.js | 7417 | sin mencionar que la protección sólo actúa de noche puede inducir una decisi |
| data/entries.js | 7481 | ausencia sólo resulta informativa si el método habría |
| data/entries.js | 7507 | consenso constituye evidencia y cuándo sólo describe una comunidad.</p> |
| data/entries.js | 7523 | rona puede interpretarse como monarquía sólo si se asume una convención cultural |
| data/entries.js | 7551 | precisa si sólo conserva profecías cumplidas, lo que ha |
| data/entries.js | 7629 | culpable puede ocultar que en realidad sólo reconoce una marca ritual asociada a |
| data/entries.js | 7652 | implicaturas, omisiones y contexto, no sólo la verdad |
| data/entries.js | 7727 | a experiencia merece confianza y cuándo sólo produce |
| data/entries.js | 7870 | representantes legales sólo pueden decidir cuando el afectado carec |
| data/entries.js | 7936 | <p>La resurrección sólo es éticamente aceptable si existe evide |
| data/entries.js | 7954 | fines terapéuticos excepcionales, pero sólo es legítimo con consentimiento |
| data/entries.js | 7968 | sólo la intención de quien lo creó.</p> |
| data/entries.js | 8094 | aceptado una intervención sólo porque posteriormente expresa satisfacc |
| data/entries.js | 8106 | pueden crear desigualdades profundas si sólo algunos acceden a |
| data/entries.js | 8150 | estudios limitados y, sólo después, aplicación sobre sujetos human |
| data/entries.js | 8382 | da cierta concentración dejan de actuar sólo sobre tejidos y |
| data/entries.js | 8410 | qué algunos medicamentos sólo producen efectos intensos en individuos |
| data/entries.js | 8563 | diferentes, no sólo más intensas.</p> |
| data/entries.js | 8658 | as y problemas de exposición prolongada sólo pueden |
| data/entries.js | 8828 | sólo adquiere relevancia estructural cuando |
| data/entries.js | 8851 | on usos contemporáneos a la fuente y no sólo con |
| data/entries.js | 8879 | estructura depende sólo de una secuencia fonética conocida. Tam |
| data/entries.js | 9069 | En algunas tradiciones se considera que sólo una pronunciación perfecta permite acti |
| data/entries.js | 9196 | gentes separadas parecen desarrollar no sólo cuerpos sorprendentemente compatibles |
| data/entries.js | 9281 | arte del principio contrario. Una forma sólo tiene |
| data/entries.js | 9295 | oda la disciplina. Cuando el espacio es sólo escenario, |
| data/entries.js | 9344 | sa concentración y reservan la posición sólo como |
| data/entries.js | 9417 | íticas y dejar zonas más abiertas donde sólo se |
| data/entries.js | 9455 | nto. En ellos, la geometría no describe sólo posiciones |
| data/entries.js | 9458 | estructura, pero la coreografía ritual sólo es geométrica |
| data/entries.js | 9491 | representar sólo la proyección local de una estructura q |
| data/entries.js | 9572 | mágica, y sólo después se emplean cargas mínimas y mat |
| data/entries.js | 9741 | deducirla sólo porque dos técnicas produzcan resultado |
| data/entries.js | 9976 | <p>La Peste Gris no fue sólo una crisis médica. Alteró migraciones, |
| data/entries.js | 9990 | depender sólo de reputación personal. Se estableciero |
| data/entries.js | 10078 | y qué intervención conseguía realizar; sólo después resulta posible |
| data/entries.js | 10199 | erencia aparece cuando la estructura no sólo |
| data/entries.js | 10211 | ica o corporal. Una maldición que actúa sólo cuando la víctima cruza una |
| data/entries.js | 10260 | norar descendientes biológicos y seguir sólo a quienes |
| data/entries.js | 10342 | de está encantada; una espada que quema sólo a quien la robe |
| data/entries.js | 10378 | a, pero la transmisión no debe asumirse sólo porque aparezcan casos |
| data/entries.js | 10383 | voluntario; otras sólo añaden una nueva víctima sin liberar a |
| data/entries.js | 10393 | ral cuya resolución no puede predecirse sólo por potencia.</p> |
| data/entries.js | 10425 | adicción; la destrucción bruta funciona sólo cuando |
| data/entries.js | 10461 | a contener la maldición, pues puede ser sólo parte del sistema |
| data/entries.js | 10488 | es y manifestaciones. La pregunta no es sólo qué le ocurre a la víctima, sino cuándo |
| data/entries.js | 10573 | los casos, la manifestación visible es sólo una parte |
| data/entries.js | 10590 | juramentos o ritos y no sólo descendencia biológica.<br> |
| data/entries.js | 10762 | emporánea considera que la distancia es sólo una de las relaciones |
| data/entries.js | 10808 | sólo realiza más acciones dentro de un inter |
| data/entries.js | 10937 | ones, sigue siendo posible que describa sólo una parte |
| data/entries.js | 11115 | mágicas se estudian empíricamente y no sólo mediante proporciones químicas.</p> |
| data/entries.js | 11207 | torno. Otros mantienen dependencias que sólo |
| data/entries.js | 11271 | incompletas y ejecutar sólo una parte de su configuración.</p> |
| data/entries.js | 11360 | uesta pasiva, luego exposición mínima y sólo después capacidad de retención o |
| data/entries.js | 11576 | mplios que la morfología. La disciplina sólo |
| data/entries.js | 11580 | ajenas. Algunos copian sólo silueta, otros reproducen textura, olor |
| data/entries.js | 11591 | , en el que algunas criaturas imitan no sólo el cuerpo sino |
| data/entries.js | 11599 | e evaluarse según pérdida funcional, no sólo |
| data/entries.js | 11967 | secundarias. Tratar sólo una capa puede dejar intacta la otra.</ |
| data/entries.js | 12139 | si intenta corregir sólo apariencia.</p> |
| data/entries.js | 12171 | ida; otras generan cambios estables que sólo se vuelven visibles en |
| data/entries.js | 12383 | ndición ritual o una discontinuidad que sólo aparece cuando algo intenta |
| data/entries.js | 12386 | resistencia apreciable y sólo se vuelven perceptibles cuando cambian |
| data/entries.js | 12429 | diferencias demuestran que el portal no sólo une posiciones. Debe también decidir qu |
| data/entries.js | 12490 | interior mantiene su propia extensión y sólo necesita conservar una relación |
| data/entries.js | 12502 | uestas. Una ubicación puede requerir no sólo |
| data/entries.js | 12537 | La Planología estudia estas propiedades sólo en la medida en que |
| data/entries.js | 12619 | sea sólo una propiedad de ciertas conexiones den |
| data/entries.js | 12785 | corresponde sólo a una parte reducida de los fenómenos d |
| data/entries.js | 12861 | ía mantiene una postura conservadora, y sólo habla de fragmentación cuando |
| data/entries.js | 13324 | externa sólo estableció una asociación que después c |
| data/entries.js | 13443 | sólo una fuente de evidencia entre varias.</ |
| data/entries.js | 13599 | esventaja es que la estructura completa sólo existe mientras las relaciones entre su |
| data/entries.js | 13603 | ución importa porque algunas relaciones sólo pueden establecerse después de |
| data/entries.js | 13629 | sólo el ritmo de ejecución.</p> |
| data/entries.js | 13722 | s equivale a diseñar una estructura que sólo |
| data/entries.js | 13838 | ás instructivos son aquellos en los que sólo una función deja de |
| data/entries.js | 13894 | <p>Una estructura que sólo puede detenerse mediante la misma perso |
| data/entries.js | 13915 | ar qué cambia. Sin embargo, este método sólo se utiliza en modelos seguros o |
| data/entries.js | 13953 | comprendió el alcance del procedimiento sólo porque aceptó ocupar un |
| data/entries.js | 14008 | da uno de estos criterios especifica no sólo la acción a tomar, |
| data/entries.js | 14010 | <p>Cada participante debe conocer no sólo su función normal, sino qué hacer si la |
| data/entries.js | 14197 | <p>Una inscripción sólo puede interpretarse correctamente si se |
| data/entries.js | 14255 | estabilidad. Algunos sistemas sólo necesitan una frontera visual clara; ot |
| data/entries.js | 14429 | visible puede ser sólo una interfaz para una estructura intern |
| data/entries.js | 14448 | original, mientras que fotografiar sólo fragmentos sucesivos evita presentar el |
| data/entries.js | 14455 | cos o testamentarios diseñados para que sólo un lector cualificado pudiera |
| data/entries.js | 14502 | método resulta útil sólo en sistemas muy simples.</p> |
| data/entries.js | 14629 | hacia expansión. Un ritual que sólo es seguro mientras todos sus componente |
| data/entries.js | 14666 | persona puede cumplir varias funciones sólo cuando el nivel |
| data/entries.js | 14707 | tuales permiten detenerse con seguridad sólo en ciertos momentos, marcados |
| data/entries.js | 14857 | <p>Los rituales de determinado nivel sólo pueden ser dirigidos por personal licen |
| data/entries.js | 14858 | incluye entrenamiento de seguridad, no sólo competencia mágica, y una persona |
| data/entries.js | 14927 | utación, ya que una institución aprende sólo si convierte los incidentes |
| data/entries.js | 15085 | par de una estructura. Su objeto no son sólo |
| data/entries.js | 15242 | uede engañar sistemas mal diseñados que sólo verifican posesión |
| data/entries.js | 15369 | a consiste en limitar esa red hasta que sólo las relaciones |
| data/entries.js | 16236 | enguaje académico como si los creyentes sólo estuvieran describiendo mal una |
| data/entries.js | 16729 | tra puede resultar casi autónoma aunque sólo se active unos segundos al año. La auto |
| data/entries.js | 16732 | d, mientras otros permanecen latentes y sólo |
| data/entries.js | 16747 | Puede actuar sólo como soporte de memoria y continuidad.< |
| data/entries.js | 16769 | Los sistemas que dependen del ambiente sólo son autónomos |
| data/entries.js | 16774 | que sólo se encuentra descargado.</p> |
| data/entries.js | 16784 | n que un encantamiento cambie de estado sólo cuando una variable supera cierto |
| data/entries.js | 16789 | una persona concreta. El problema no es sólo definir la condición, sino |
| data/entries.js | 16802 | estructura latente, en cambio, conserva sólo lo necesario para reconocer condiciones |
| data/entries.js | 16938 | retiran. Muchos encantamientos mayores sólo pueden instalarse |
| data/entries.js | 16967 | r de cualquiera de estas capas, y medir sólo la energía sin reconstruir las |
| data/entries.js | 16972 | <p>Algunos problemas sólo aparecen después de miles de ciclos. Lo |
| data/entries.js | 17149 | iar espacios que la geometría ordinaria sólo puede |
| data/entries.js | 17182 | rección. En otros casos, la recurrencia sólo aparece después de cumplir determinadas |
| data/entries.js | 17198 | condicional. Una sala puede reaparecer sólo mientras el viajero |
| data/entries.js | 17249 | n encontrarse frente a la misma pared y sólo uno de ellos disponer de acceso a |
| data/entries.js | 17294 | y sólo después su representación arquitectónic |
| data/entries.js | 17298 | ción externa definida o que un corredor sólo exista mientras se recorre.</p> |
| data/entries.js | 17350 | modificar patrones; la Topología Arcana sólo atribuye el |
| data/entries.js | 17371 | batalla donde perseguir a un adversario sólo |
| data/entries.js | 17429 | ctivo</strong> — región cuya adyacencia sólo se establece |
| data/entries.js | 17691 | <p>Los dispositivos de veracidad sólo son admisibles si se conoce qué propied |
| data/entries.js | 17744 | <p>Los pactos son contratos sólo cuando las partes poseen capacidad, con |
| data/entries.js | 17797 | cializada; destruirlos antes del juicio sólo se |
| data/entries.js | 17944 | ecisamente ese proceso. Su objeto no es sólo la fabricación de |
| data/entries.js | 17970 | ria opera un paso más allá. La mente no sólo detecta señales, sino que las |
| data/entries.js | 18031 | n aceptar que la ilusión será coherente sólo desde posiciones limitadas.</p> |
| data/entries.js | 18225 | icciones; las salvaguardas mentales son sólo una de varias vías |
| data/entries.js | 18302 | la mente del observador, y sólo después decidir qué señales son necesar |
| data/entries.js | 18494 | nsideran que ambas categorías comparten sólo resultados superficiales y que su funda |
| data/entries.js | 18616 | acumulan contradicciones que sólo se manifiestan cuando otra estructura i |
| data/entries.js | 18693 | can de soporte, frontera o dependencia; sólo demuestra que, si los poseen, no sabemo |
| data/reglas.js | 44 | : "Puedes realizar una acción adicional sólo cuando una habilidad, conjuro o caracte |
| secreto.html | 606 | desaparecen del menú sólo durante la visita actual y pueden volve |
| secreto.html | 1545 | parte de la página avanza una línea (no sólo el |
| secreto.html | 2473 | o lo que está más cerca que ese plano y sólo se ve lo que |

### 2. Demostrativos con tilde: éste, ésta, ésa y similares (20 apariciones)

Misma situación: la tilde no es obligatoria desde 2010. Se dejaron sin cambiar.

| archivo | línea | contexto |
|---|---|---|
| data/bufon-contenido.js | 97 | "Ah, ya empezamos con ésa.", |
| data/bufon-contenido.js | 439 | lineas: ["Ah. Entonces mezclé ésa también.", "Bien saber. Ahora tengo que |
| data/entries.js | 813 | estructura mientras ésta se encuentra en proceso de manifestació |
| data/entries.js | 1015 | uperar o imponer continuidad allí donde ésta se ha interrumpido. Existen zonas |
| data/entries.js | 1536 | ar las asociaciones mediante las cuales éste interpreta |
| data/entries.js | 1596 | rte activa del proceso mediante el cual ésta |
| data/entries.js | 1682 | de anunciar una transición antes de que ésta ocurra.</p> |
| data/entries.js | 1697 | establece dentro del intérprete o entre éste y un sistema arcano previamente formado |
| data/entries.js | 2169 | o materia sino también la manera en que ésta participa de otras estructuras.</p> |
| data/entries.js | 2802 | uctura externa puede desaparecer cuando ésta falla. Una alteración verdaderamente in |
| data/entries.js | 6898 | mecánico traslada la condición sin que ésta |
| data/entries.js | 7074 | siduos o componentes mágicos asociados, éstos deben estudiarse como |
| data/entries.js | 7196 | ue existe un exceso real de casos y que éstos |
| data/entries.js | 7932 | Cuando existe una voluntad documentada, ésta debe respetarse. En ausencia de |
| data/entries.js | 8090 | que ésta plantea derechos propios como nuevo ind |
| data/entries.js | 10317 | altera necesariamente la estructura si ésta reconoce una |
| data/entries.js | 10462 | mediante el cual ésta reconoce una relación.</p> |
| data/entries.js | 13756 | reconoce la inscripción mientras ésta permanezca legible y correctamente posi |
| data/entries.js | 14408 | institucional que éste representa.</p> |
| data/entries.js | 18235 | ar una ilusión elimina la estructura si ésta se encuentra dentro del alcance y depen |

### 3. Mayúsculas sin tilde en js/fichas-pdf-roll20.js (2 apariciones)

Son claves con las que se busca el texto en el PDF de Roll20, no texto que se vea en pantalla. Si el PDF las trae sin tilde, cambiarlas rompería la importación.

| archivo | línea | contexto |
|---|---|---|
| js/fichas-pdf-roll20.js | 132 | const ATRIBUTOS = [["FUERZA", "fue"], ["DESTREZA", "des"], ["CONSTITUCION", "con"], ["INTELIGENCIA", "int"], ["SABIDURIA", "sab"], ["C |
| js/fichas-pdf-roll20.js | 132 | "des"], ["CONSTITUCION", "con"], ["INTELIGENCIA", "int"], ["SABIDURIA", "sab"], ["CARISMA", "car"]]; |
