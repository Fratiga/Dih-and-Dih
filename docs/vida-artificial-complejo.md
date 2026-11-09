# Vida Artificial: del cuarto al complejo de salas

Propuesta de arquitectura, 11-nov-2026. **No se ha tocado código.** Primero el estudio de cómo está hoy el espacio, después la arquitectura y las decisiones que hacen falta, y al final el orden de trabajo.

## 1. Cómo está hoy el espacio

**Simulación.**
- El mundo es una línea. `Mundo` (`nucleo/mundo.ts`) tiene un ancho de 1600 unidades (`AJ.ancho`, configurable por simulación) y todo se sitúa por una coordenada `x`. La altura `z` de los objetos solo se dibuja. La criatura no tiene `z`.
- Una criatura tiene un `x` y nada más. No hay colisión entre criaturas (nada impide que dos ocupen el mismo punto), y las barreras nuevas (`Mundo.cruce`) son lo único sólido.
- Percepción (`conducta.ts`): ve hasta 360 unidades (el 22 % del ancho), huele hasta 760 y oye hasta 1000. A otras criaturas las ve hasta 468. Con 1600 de ancho, el oído y el olfato cubren casi toda la sala.
- La **memoria usa el sitio normalizado** (`lug = x / ancho`, de 0 a 1) en 16 casillas (`BINES`), igual que las visitas para explorar y la entrada de la red. El territorio (`radioTerritorio` 260) y el hogar también están en unidades.
- Hay un máximo de 4 criaturas vivas por sala (`AJ.maxCriaturasSala`), y cada criatura recorre a todas las demás y a todos los objetos en cada decisión.
- `Simulacion` tiene un solo `Mundo`. Todos los casos del laboratorio la crean con `nuevaSim` y colocan cosas por posiciones fijas (400, 900, 1000...). La regresión depende de que una sala de 1600 sea igual que hoy.
- El estado guardado (`EstadoSim` v1) lleva un mundo.

**Escena.** `escenas/Laboratorio.ts` dibuja un único corte de habitación de 2560 x 1440 px (`arte/medidas.ts`, 1,59 px por unidad) con tres capas de fondo fijas (`arte/fondo.ts`). La cámara tiene tres planos (panorama, seguir, cercano) con zoom y arrastre. La interfaz (ficha, memoria, bandeja, interruptores) está pensada para una sola sala.

**Lo que el hacinamiento hace a los resultados.** Medido con `tests/diag-hacinamiento.ts` (5 semillas, 900 s, sala de 1600): con **dos criaturas, el 66 % del tiempo se ven entre sí y el 39 % están a menos de 130 unidades**. Con **cuatro, un par cualquiera se ve el 67 % del tiempo, está en contacto el 42 %, y las cuatro se ven entre todas el 36 %**. En un mundo así, el vínculo, la competencia, la defensa y la territorialidad se miden casi siempre con el otro encima, y una criatura no puede alejarse de nadie sin salir del mundo. Es un sesgo de los casos 25 a 40 y conviene tenerlo presente al leerlos. No es un defecto de los criterios: es de la sala.

## 2. Los lugares ya hablados

De `vida-artificial-diseno.md` y de las peticiones anteriores:
- **Tres espacios** del diseño original: laboratorio personal, hábitat compartido (multijugador) e instalaciones especiales (contención, cámaras de observación, zonas de reproducción, laboratorio de genética, cuarentena).
- **Dirección de lugares:** laboratorios de ciencia ficción con cubas de contención verdes y cian, pasillos de cuarentena, salas de observación, y los cortes laterales de habitaciones de *Creatures*. La referencia es una sección vista de lado, con salas conectadas.
- **Un terreno con profundidad**, como el del corral del Hipódromo, y una cámara que se vea desde más lejos. Se dejó dicho que la profundidad empieza siendo solo de dibujo.
- **Altura con efecto real** en tres niveles discretos (suelo, estante, alto), aprobada.
- **Agua** (W7) para las criaturas nadadoras futuras, y **contención** como caso extremo (la brecha de contención).
- **Laboratorios individuales, espacios compartidos y mortalidad configurable**, decididos por el DM.

## 3. Arquitectura propuesta

### 3.1 Cada sala es un `Mundo`

`Mundo` ya es una sala: una línea con objetos, física y barreras. Se mantiene sin cambios, y se añade por encima un **`Complejo`**, que es una lista de salas conectadas.

```
Complejo
  salas: Sala[]            cada una con su Mundo (su ancho, sus objetos)
  conexiones: Conexion[]   una puerta es un par (sala A, x) <-> (sala B, x)

Sala = { id, nombre, tipo, medio, niveles, fondo, mundo: Mundo }
Criatura.sala: número de sala (además de su x)
```

Lo que consigue:
- **Dentro de una sala no cambia nada.** La criatura percibe y decide con el `Mundo` de su sala y con las criaturas de su sala, exactamente como hoy. La regresión sigue valiendo, y una sala de 1600 con un solo ocupante equivale a un experimento actual.
- **Las salas pueden tener forma de grafo** (un pasillo con tres puertas, un anillo, una sala sin salida) y no solo de cadena. La simulación sigue siendo de una dimensión por sala.
- **El coste crece con las criaturas de cada sala**, no con el total. Es la base para pasar de 4 criaturas y para la percepción social optimizada que ya estaba en la lista.

### 3.2 Las puertas son objetos

Una puerta es un objeto del catálogo, con un enlace a otra sala y su estado (abierta, cerrada, con cerrojo). Una puerta cerrada es una barrera (la mecánica de `cruce` y los tiempos de bloqueo ya existen), y una abierta se puede cruzar. Así se reutiliza lo hecho:
- **Cruzar** es un verbo más, `cruzar`, con su entrada ampliable. La criatura lo descubre como cualquier otro: por curiosidad, por hambre (si algo que huele está al otro lado) o por lo aprendido. Nadie le dice que cambie de sala.
- **Abrir** es otra interacción. Una puerta puede abrirse con una palanca, con una placa de peso (que es el transporte más la barrera, ya pedido), a empujones si es de las que se rompen, o con una llave. Los mecanismos del punto 5 del orden de trabajo pasan a ser lo que abre las puertas.
- Lo que llega de otra sala (olor, sonido) se puede filtrar por una puerta abierta, más débil con la distancia. Empieza sin hacerse: dos salas no se perciben.

### 3.3 Memoria por sala

El sitio de la memoria pasa de `x / ancho` a **`(sala, x / ancho)`**. Cada sala tiene sus propias 16 casillas de visitas y de lugar, de modo que explorar, el miedo a un sitio y el hogar son por sala. Es el cambio más delicado de la arquitectura, porque toca la memoria, la red (la entrada del sitio) y el guardado. Se hace tras comprobar que con una sala sola todo da lo mismo, como se hizo con las entradas ampliables.

### 3.4 Propiedades de cada sala

Una sala no es un fondo distinto. Cada tipo trae reglas:

| Sala | Qué aporta de verdad |
|---|---|
| Habitación principal | Espacio amplio (3200 o más), sin objetos preparados. Convivencia y conducta libre. |
| Comedor | Comederos y comida repartida, competencia, transporte y almacenamiento. |
| Zona de obstáculos | Rejas, puertas, palancas y placas de peso. Recorridos reconfigurables. |
| Cámara de pruebas | Una sola sala configurable y reproducible, que es la de siempre (`nuevaSim`). |
| Hábitat natural | Recursos que crecen y se agotan, refugios (sitios que bajan el miedo o dan sueño), terreno. |
| Zona acuática | Medio con otra física y otros recursos (W7). Un criterio de velocidad y de respiración distinto. |
| Zona elevada | Tres niveles (suelo, estante, alto), con alcance y percepción distintos en cada uno (W2). |
| Aislamiento | Una sala pequeña con una sola puerta, para observar a solas o en pareja. |
| Contención | Una sala con la puerta que solo se abre desde fuera, y paredes que aguantan lo que su ocupante pueda romper. |

Lo que no es de la sala sino del sistema: el cerebro, el cuerpo, la memoria y las reglas del medio (que cada sala declara) son los mismos en todas.

### 3.4 bis. Sed y agua con función propia

Petición del 11-nov-2026: que las criaturas tengan que beber, para que el agua sirva de algo más que de medio, y que pueda haber depredadores acuáticos que merodeen por el agua y se coman a criaturas terrestres o a otras marinas. **Toda variación sale de la misma criatura base**: no hay especies con código aparte, solo genomas distintos de la misma.

- **La sed es una necesidad nueva, opcional.** Hoy hay cinco necesidades (hambre, sueño, dolor, aburrimiento, soledad) en un vector fijo que entra en la red y en el guardado. Para no mover nada, la sed se guarda aparte, como la fatiga de combate (`sed`, de 0 a 1), con su propia entrada ampliable y un interruptor por sala o por criatura, apagado por defecto. Apagada, no existe y todo vale lo de siempre.
- **Agua para beber.** Un objeto `agua` (un bebedero, un charco, la orilla de una zona acuática) con su verbo `beber`, que se aprende como `probar` (rasgos de lo que se bebe, qué sacia la sed, qué sienta mal). Lo puede haber en cualquier sala. Una zona acuática no es la única fuente, pero sí la que da más agua y más riesgos.
- **Qué pasa si no bebe.** Primero, malestar (la sed pesa en la utilidad como el hambre); después, menos fuerza y más cansancio; al final, daño. Se decide cuánto, con la misma regla de siempre: no se pone un número hasta medirlo.
- **Agua y reparto del espacio.** Si el agua está en un sitio concreto, la criatura tiene que ir allí a diario, y el agua se vuelve un sitio de encuentro, de competencia (quién bebe primero, quién defiende el charco) y de peligro. Es lo que le da función al territorio y a la defensa de recursos, que hoy solo se miden con la comida.
- **Depredador acuático, sin especie nueva.** Es una criatura del mismo tipo con otro genoma, con rasgos de cuerpo para el medio acuático (el plan nadador, que sigue sin empezar), con la especialización de depredador y con una **preferencia de medio** heredable (dónde se siente cómoda). Para que exista como conducta y no como evento hay que dar al agua lo mínimo. Un medio con otra velocidad, una zona de orilla donde las terrestres beben y una zona profunda a la que solo van las que nadan, y que el interés de cazar (que ya existe) tenga alcance sobre quien está bebiendo en la orilla. Las criaturas terrestres aprenden por experiencia a beber lejos, a beber en grupo o a no ir, por lo que les pasa.
- **Qué hay que evitar.** Un monstruo que aparece cuando conviene. El depredador acuático vive de lo que come y se queda sin hambre o sin comida igual que los demás. Si la orilla se queda sin presas, se va o pasa hambre.
- **Cuándo.** La sed y el bebedero se pueden hacer antes que la zona acuática (con una sala y un objeto). El depredador acuático necesita el medio acuático y el plan nadador, así que va después de ambos, siguiendo el orden de trabajo.

### 3.5 Laboratorio libre y cámaras experimentales

- **Laboratorio libre.** Un `Complejo` persistente con salas conectadas donde las criaturas viven. Es lo que ve el jugador.
- **Cámaras experimentales.** Un `Complejo` de una sala, creado desde una configuración y una semilla (lo que hace hoy `nuevaSim`). Los casos, las réplicas y la regresión siguen usándolas. Una criatura del laboratorio se puede **copiar** a una cámara para repetir lo que le pasó con condiciones controladas (la técnica de `calentada` ya hace algo parecido).
- Los casos nuevos de espacio (migración, territorialidad con salida, quién abre la puerta) usan complejos pequeños de dos o tres salas, también reproducibles. Lo que no pueden hacer es mezclarse con el laboratorio libre.

### 3.6 Cámara e interfaz

- **Una sala se dibuja a la vez**, con el fondo y las reglas de su tipo (el fondo ya está separado por capas). Las demás se simulan sin dibujarse.
- **Un mapa del complejo**: un esquema con las salas como cajas, las puertas como enlaces y un punto por criatura, con su estado (come, duerme, pelea). Un clic va a la sala, y el modo general muestra todo el complejo a la vez.
- Se conservan los tres planos de cámara de una sala, el seguir a una criatura aunque cambie de sala (la cámara cruza la puerta), pausa y velocidades, y la ficha, que dice en qué sala está.
- La profundidad del terreno (el corral del Hipódromo) se hace por sala como dibujo, sin efecto en la simulación, hasta que haya una decisión sobre planos.

### 3.7 Guardado

`EstadoSim` pasa a v2 con una lista de salas, conexiones y criaturas con su sala. Un guardado v1 se convierte en un complejo de una sala. Hasta que cambie el formato, las partidas actuales se siguen abriendo.

## 4. Decisiones que hacen falta

1. **Grafo de salas con una línea cada una (recomendado) o una sola línea larga con puertas.** La línea larga es más barata (todo el código actual sigue igual), pero solo permite cadenas, el coste crece con el total y la memoria por sitio se diluye. El grafo cuesta una capa nueva y una migración del guardado, y es lo que permite ramificar, migrar y crecer.
2. **Tamaño de cada sala.** Propongo 1600 como medida mínima (las cámaras) y entre 3200 y 4800 para la habitación principal, con la visión en 360. Con 3200 una criatura ve el 11 % y eso ya separa a las que viven a un lado de las del otro.
3. **Capacidad.** Hoy 4 criaturas por sala. Propongo mantener 4 por sala en cámaras, de 6 a 8 en las salas grandes (con medida de rendimiento antes), y subir el total del complejo.
4. **Si la altura y el agua entran en la sala o en una capa de niveles.** Propongo que la sala declare niveles (suelo, estante, alto) y medio (aire o agua), y que lo que cambie sea la regla (alcance, velocidad), no el espacio.
5. **Qué entra de la profundidad.** Solo dibujo, como se dijo.
6. **La sed.** Opcional y aparte del vector de necesidades (recomendado). Falta decidir cuánto daña no beber y si el agua puede acabarse (un charco que se seca, una fuente que se recarga).
7. **Variación de criaturas.** Todo sale del genoma base. Falta decidir qué rasgos de medio y de cuerpo entran en el genoma (preferencia de medio, aletas, branquias, peso) antes de los planes corporales.

## 5. Orden de trabajo, con lo que cada paso no debe romper

1. **Este documento y la decisión 1 a 5.** Sin código.
2. **`Complejo` con una sola sala.** Comprobación: la regresión (173 comprobaciones) y los casos en los que se pueda dar idéntica la misma huella con y sin él. No se añade nada visible.
3. **Dos salas, una puerta y el verbo `cruzar`.** Caso mínimo: una criatura hambrienta con comida al otro lado de una puerta abierta. Después, memoria por sala con la misma prueba de equivalencia. Mapa del complejo y cámara.
4. **Habitación principal grande y comedor.** Aquí se repite medición del hacinamiento (el diagnóstico de arriba) y se marcan los casos anteriores cuya lectura cambia.
5. **Transporte visual** (lo que se lleva, con la postura de la criatura, y soltar donde se quiere), y **zona de obstáculos** con puertas, placas y palancas.
6. **Altura, agua y sed.** Primero la sed con un bebedero (una sala y un objeto), después el medio acuático y la altura como propiedades de sala. El depredador acuático va tras el medio y el plan nadador.
7. **Cooperación y observación** con puertas, y la comparación con el laboratorio libre.
8. **Planes corporales.**

Cada paso mantiene lo de siempre: interruptores apagados por defecto, la regresión, la separación entre lo disponible, lo usado y lo aprendido, y los criterios escritos antes de ejecutar.
