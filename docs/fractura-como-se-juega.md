# La Fractura: cómo se juega, hoy y tras la expansión

Este documento explica todo el juego a nivel de reglas y de experiencia: la campaña entre guerras, cómo se prepara una guerra, cómo funciona cada turno, qué hace cada ejército y cómo cambiará con la expansión a trece ejércitos.

- **Parte A** describe lo que existe hoy y funciona. Está sacado del código del motor, no de memoria.
- **Parte B** describe lo que está planeado y todavía no se ha programado. Está marcado como **[Plan]**.
- **Parte C** es una referencia rápida con las tablas de números.

Las cifras del plan son estimaciones. Se ajustan con simulaciones antes de darlas por buenas.

---

# PARTE A. Cómo funciona hoy

## 1. Qué es La Fractura

Un juego de estrategia por turnos para dos bandos. Cada jugador lleva un ejército de soldados con nombre, apellido, historia y familia. Las guerras se libran en la Fractura, un espacio fuera del mundo conocido, hecho de fragmentos de lugares, sueños y recuerdos. Lo que pasa allí no cambia el canon de la campaña de rol. Sí cambia a tus soldados: ganan experiencia, se hieren, mueren, tienen hijos y fundan casas.

Es una página oculta: solo la ve el admin (se abre desde Minijuegos, en «En pruebas»).

El ciclo de juego tiene cuatro pantallas:

1. **Elegir ejército.** Seis ejércitos. Cada cuenta puede fundar uno de cada.
2. **Cuartel.** Gestionas soldados, casas, reliquias y crónicas, y preparas la siguiente guerra.
3. **La guerra.** Mapa en pantalla completa y turnos hasta que alguien gana.
4. **Fin de la guerra.** Crónica narrada, ascensos, muertes, nacimientos y, si ganaste contra la IA, la posibilidad de una carta.

## 2. El ejército y sus soldados (la campaña)

### 2.1 El ejército

Cada cuenta tiene un ejército por facción, con nombre propio, un año de la Fractura que va avanzando y un historial de guerras. Empieza con **seis soldados fundadores** (con clases propias de la facción) y se guarda en el navegador y, si hay sesión, en el servidor.

Cada guerra que termina hace pasar **1 o 2 años** (al azar).

### 2.2 El soldado

Cada soldado es una persona con:

- **Nombre y casa** (apellido). Los nombres salen de listas por cultura, inventadas.
- **Sexo, edad y origen.** Los orígenes son *voluntario*, *mercenario*, *habitante*, *eco* y *criatura*. Cada uno ajusta un poco las características (por ejemplo el mercenario tiene +1 de Fuerza y -1 de Voluntad; el eco, +1 de Magia e Inteligencia; la criatura, +1 de Constitución y Voluntad).
- **Seis características de 1 a 10**: Fuerza, Constitución, Velocidad, Inteligencia, Voluntad y Magia. Salen de la media de su clase con algo de azar. Los hijos heredan: 60 % de la clase, 20 % del padre y 20 % de azar.
- **Victorias, bajas causadas, guerras, cicatrices, hitos** (un diario de lo que le pasa).

Qué hacen las características:

| Característica | Efecto en la guerra |
|---|---|
| Constitución | Vida: +1 por cada 2 puntos por encima de 5 (y -1 por debajo) |
| Fuerza o Magia (según la clase) | Ataque: +1 por cada 3 puntos por encima de 5 |
| Velocidad | Con 9 o más gana +1 de movimiento. Con 2 o menos pierde 1 |
| Voluntad | Probabilidad de quedar en pie con 1 de vida cuando le tocaba morir. Una vez por guerra, con (Voluntad-4)x7 %, hasta un máximo del 50 %. Deja una cicatriz |
| Inteligencia | Si tiene 8 o más y su ejército gana, suma 1 victoria extra |

### 2.3 Rangos

El rango sale de las victorias y suma vida y ataque:

| Rango | Victorias | Vida | Ataque |
|---|---|---|---|
| Recluta | 0 | 0 | 0 |
| Soldado | 5 | +1 | 0 |
| Veterano | 15 | +2 | 0 |
| Élite | 30 | +3 | +1 |
| Leyenda | 50 | +5 | +2 |

Cada baja que causa un soldado en una guerra le da 1 victoria. Si el muerto era un oficial (un líder, un capitán o un veterano o superior), le da 1 más.

Al llegar a **Veterano** el jugador elige una **especialización**, una sola vez:

| Especialización | Efecto |
|---|---|
| Guardia | +2 de defensa |
| Duelista | +2 de ataque contra unidades que están solas |
| Explorador | +1 de movimiento y ve una casilla más lejos |
| Tirador | +1 de alcance |
| Rompelíneas | +2 de ataque contra unidades en ciudades o fortalezas, y contra pesadas (defensa 3 o más) |

### 2.4 Apodos

Los soldados ganan apodos por lo que les pasa: cicatrices («el Astillado», «Cara de Mapa»), muchas bajas («el Segador»), velocidad, sabiduría, firmeza o longevidad. Se leen en las crónicas y en la ficha.

### 2.5 El contingente

No todos los soldados van a cada guerra. El **contingente** es el grupo que sale a combatir:

- Empieza en **6** y sube **1 por cada 3 guerras ganadas**, con tope de **12**.
- Solo quienes van pueden ganar experiencia o morir.
- Si llevas menos de seis, la compañía recibe reclutas de relleno hasta llegar a seis.
- El botón «Elegir los mejores» arma un contingente por rango y victorias, sin más de la mitad de la misma clase.

### 2.6 Capitanes y compañías

Un soldado de rango Soldado o superior puede ser **capitán** (máximo 3 en el ejército). Cada capitán manda una **compañía** (I, II o III) de hasta 4 soldados más.

En la guerra:

- El capitán tiene +2 de vida.
- Los de su compañía que estén a 2 casillas o menos de él ganan +1 de defensa.
- Si el capitán cae, su compañía pierde 1 de ataque durante 3 turnos.
- Solo un capitán puede llevar estandarte (un tipo de reliquia).

### 2.7 Reliquias

Hay 18 reliquias con nombre, en cuatro huecos: **arma, armadura, accesorio y estandarte**. Se encuentran en ruinas, en fortalezas custodiadas o en las manos de enemigos caídos. Cada soldado lleva como máximo una por hueco.

Tienen **historial de propietarios**: cuando alguien cae, su reliquia queda sin dueño en el reliquiario y tú decides quién la hereda. Si la recibe el hijo de quien la llevaba, queda anotada como «heredada».

Algunas reliquias dan estadísticas (+3 de ataque, +2 de defensa, +1 de movimiento), otras curan a los aliados contiguos, dan maná u oro por turno, o mejoran la visión. Los estandartes dan un aura a los aliados a 2 casillas o menos.

Al terminar una guerra: las reliquias que llevan los vivos se quedan. Las que estaban en el suelo se quedan si ganaste, y si no hay un 50 % de perderlas. Las que tenía el enemigo se pierden para siempre.

### 2.8 Heridos y muertes

Cuando un soldado cae en combate, no siempre muere. Al cerrar la guerra:

- Tiene entre un **33 y un 65 %** de quedar **gravemente herido**, según su Voluntad y su Constitución. Se salva, gana una cicatriz y se queda **fuera de las dos guerras siguientes** (convaleciente).
- Si no, **muere** y pasa al Salón de los Caídos, con su epitafio.

Si el ejército domina la escuela de muerte hasta el escalón 4 (Inmortalidad), la mitad de los muertos regresa como **Renaciente**: sigue en filas, con una cicatriz, y vuelve «distinto»: dos años más joven.

### 2.9 Reclutas durante la guerra

Los soldados que se crean durante la guerra (entrenados en una ciudad o salidos de unas ruinas) solo se quedan en el ejército si están entre los cinco que más destacaron y no cayeron. El resto desaparece.

### 2.10 Luto, compañeros y némesis

- **Compañeros de armas.** Cada par de soldados que va junto a una guerra suma una al contador de «guerras juntos».
- **Luto.** Cuando un soldado muere, quienes más combatieron a su lado (3 guerras o más, hasta 2 personas) quedan **de luto**: +1 de ataque durante 3 guerras.
- **Némesis.** Si el soldado que mató a uno de los tuyos (de rango Soldado o superior) sobrevive a la guerra, queda anotado como némesis. Volverá más adelante como **capitán del rival**, con +1 de Fuerza y de Constitución. Si lo matas tú, desaparece de la lista.

### 2.11 Familia y casas

Al cerrar cada guerra, los soldados pueden tener hijos si cumplen **todo** esto: 28 años o más, 10 o más victorias, 4 o más años de servicio, menos de 3 hijos, al menos 5 años desde el último, y un 30 % de azar. Hay un tope de 6 niños a la vez.

- La pareja es otro soldado con quien lleva 4 guerras juntas (40 %) o una persona de fuera.
- El hijo lleva la casa del padre, hereda un 60 % de la clase y es de la misma clase que el padre la mitad de las veces.
- Se alista a los **16 años**.
- El padre pasa a «establecido» (sigue en filas).

Las **casas** se forman solas, por apellido, y tienen un árbol de generaciones.

### 2.12 Retiro y vejez

- Con **52 años o más**: 25 % de retirarse por guerra.
- Con **66 años o más**: 50 % de morir de vejez por guerra.
- El ejército tiene un máximo de **80 soldados**. Si se pasa, se retiran los más viejos.

## 3. Preparar la guerra

Antes de empezar eliges:

1. **El contingente** (hasta el límite).
2. **El tipo de Fractura** (cinco, o al azar). Cambia el mapa y las reglas del lugar.
3. **El rival** (una de las otras facciones, o al azar). Al azar prefiere facciones contra las que aún no has ganado.
4. **La dificultad** (fácil, normal, difícil).

El rival crece con tu ejército. La IA recibe tropas según la dificultad (4, 6 u 8 soldados) más hasta **4 extra** por cada 4 guerras que hayas ganado, y sus soldados vienen más curtidos cuanto mayor es la media de victorias de tu contingente. Un némesis tuyo puede aparecer como su capitán.

### Tipos de Fractura

| Tipo | Rasgo |
|---|---|
| La Fractura de los Reinos | El mapa estable. Fortalezas, ciudades y fronteras medievales |
| El Sueño de los Muertos | Mucho campo de huesos. El Ánima abunda y los caídos pueden volver como criaturas errantes |
| El Jardín Imposible | Mucho bosque que se expande solo y muchas criaturas |
| El Archivo Hundido | Más ruinas, más reliquias y más guardianes |
| El Horizonte Roto | Mucho vacío, recursos escasos (la mitad de lo que rinde el terreno) y costuras que cambian de sitio |

## 4. La guerra

### 4.1 El mapa

- **13x13 casillas**, siempre simétrico por giro de 180 grados para que ambos lados empiecen en igualdad, y siempre conectado.
- Dividido en **9 regiones** (3x3 fragmentos). Cada región es un fragmento de un lugar del compendio (estable) o inventado (onírico o imposible).
- Cada lado empieza en su **capital**, en esquinas opuestas.
- En el centro está el **Núcleo del Sueño**.
- Hay ciudades neutrales, **fortalezas** y **ruinas** repartidas, y **costuras**: pares de casillas unidas que permiten teletransportarse de una a otra.

### 4.2 Terrenos

| Terreno | Movimiento | Defensa | Rinde a una ciudad cercana |
|---|---|---|---|
| Llanura | 1 | 0 | +1 comida |
| Bosque | 2 | +1 | +1 materiales |
| Montaña | 3 | +2 | +1 mineral |
| Desierto | 2 | 0 | +1 oro |
| Agua | no se pisa | | +1 comida |
| Zona mágica | 1 | 0 | +2 maná |
| Campo de huesos | 1 | 0 | +1 Ánima |
| Vacío | no se pisa | | |

Las estructuras suman defensa: ciudad +1, fortaleza +2, ruinas +1, Núcleo +1.

### 4.3 Cómo empieza

Cada bando empieza con:

| Recurso | Cantidad |
|---|---|
| Alimento | 6 |
| Materiales | 6 |
| Mineral | 2 |
| Oro | 8 |
| Maná | 3 |
| Ánima | 0 |

El segundo jugador recibe además +4 de oro y +2 de alimento, para compensar que mueve después. Cada facción ajusta esto un poco (ver sección 7): por ejemplo, la Compañía Dorada suma 12 de oro (20 en total), la Academia 5 de maná y el Trono de Ceniza empieza sin alimento y con 5 de Ánima.

Cada bando tiene una **capital** (ciudad de nivel 2) y un **Líder**, una unidad especial de la facción (18 de vida, 5 de ataque, 3 de defensa) que da un **aura** a los aliados cercanos y que, si cae, deja al ejército en un estado debilitado propio de cada facción.

Los soldados del contingente aparecen alrededor de la capital.

Hay **guardianes salvajes** (criaturas sin dueño) en cada fortaleza y en la mitad de las ruinas (todas, en el Archivo Hundido). No tienen contraataque cuando atacan y golpean a lo más herido de lo que tengan a tiro.

Cada partida dura como máximo **35 turnos** (cada turno son los dos jugadores).

### 4.4 Qué haces en tu turno

Todo en un turno es libre y sin orden fijo, con estas acciones:

| Acción | Qué hace |
|---|---|
| Mover | Mueve una unidad hasta sus puntos de movimiento. Se puede mover varias veces mientras queden puntos |
| Atacar | Una vez por unidad y turno. Después de atacar la unidad ya no puede moverse (salvo el cazador, que puede retirarse hasta 2 casillas) |
| Reclutar | Una unidad por ciudad y turno. Aparece junto a la ciudad, sin poder moverse ni atacar ese turno |
| Construir | Un edificio en una ciudad |
| Mejorar | Sube el nivel de una ciudad (máximo 5). Cuesta 4 materiales y 3 de oro por el nivel actual |
| Investigar | Un escalón de una escuela |
| Habilidad | Una acción especial de ciertas clases |
| Terminar turno | Cierra tu turno |

El máximo es de **18 unidades** por bando.

### 4.5 Qué pasa al empezar tu turno

1. **Ingresos.** Cobras de todas tus ciudades y edificios (sección 4.9).
2. **Mantenimiento de comida.** Cada unidad (sin contar el líder) por encima de 3 por ciudad cuesta 1 de alimento al turno. Si falta alimento, unidades al azar pierden 2 de vida cada una.
3. **Curación.** Cada unidad se cura según dónde está y qué lleva (sección 4.8).
4. **Movimiento restablecido** y los ataques disponibles otra vez.
5. Se actualiza la niebla de guerra.

Al empezar cada ronda (cuando el primer jugador abre un turno nuevo) las criaturas salvajes actúan y ocurren los sucesos de las regiones.

### 4.6 Movimiento

- Se mueve en las **8 direcciones**, pagando el coste del terreno de cada casilla.
- No se puede pisar agua ni vacío, ni terminar encima de otra unidad.
- Se puede pasar por casillas de aliados, no de enemigos.
- Una unidad **pegada a un enemigo** solo puede dar un paso. Los **cazadores y pícaros** están exentos y se mueven con libertad.
- Las **costuras** llevan a la casilla gemela por 1 de coste.
- Al entrar en una **ciudad enemiga o neutral**, se **conquista**. Los edificios de una ciudad conquistada quedan desactivados 2 turnos y no puede reclutar ese turno.
- Al entrar en una **fortaleza** que no es tuya, se toma.
- Al entrar en **ruinas** sin saquear, se saquean (sección 4.12).
- Las reliquias del suelo se recogen al pisar la casilla.

### 4.7 Combate

El daño de un golpe es:

> Ataque + 1 - (Defensa / 2, redondeado hacia abajo), con un mínimo de 1

Donde el **Ataque** es el de la unidad con todos sus bonos, y la **Defensa** es la del objetivo más la del terreno y la estructura en que está.

Bonos de ataque situacionales:

| Quién | Cuándo | Bono |
|---|---|---|
| Cazador | En un bosque | +1 |
| Pícaro | El objetivo está solo (sin aliados adyacentes) | +50 % |
| Caballero | Si avanzó 2 o más casillas antes de atacar | +2 |
| Duelista | El objetivo está solo | +2 |
| Rompelíneas | Objetivo en ciudad o fortaleza, o con defensa 3 o más | +2 |
| Ballestero | Contra monstruos o con defensa 3 o más | +2 |
| Quien domina Anatomía | Contra unidades heridas | +1 |

Reglas que cambian el daño:

- Si el objetivo tiene **un guerrero adyacente**, el daño baja en 1 (mínimo 1).
- **Contraataque**: si el objetivo sobrevive y el atacante está dentro del alcance del objetivo, este responde con el 60 % del daño que haría él (redondeado hacia arriba). Solo contraataca quien tiene ataque mayor que 1 (el sanador no).
- **Arcanistas y archimagos** golpean también a los enemigos adyacentes al objetivo: al 50 % del daño, o al 75 % con Resonancia. Además frenan al objetivo (pierde 1 de movimiento un turno) si tienen Resonancia.
- Un soldado con Voluntad puede salvarse con 1 de vida (sección 2.2).

Las unidades con defensa alta son muy difíciles de bajar con ataques bajos: por ejemplo, un paladín con defensa 4 en una montaña tiene defensa efectiva 6, y un golpe de ataque 3 le hace 1.

### 4.8 Curación

Una unidad se cura al empezar tu turno por la suma de:

- **+2** si descansó (no se movió ni atacó ni recibió daño el turno anterior).
- **+3** si está en una ciudad tuya (y **+2 más** si esa ciudad tiene Fortaleza).
- **+2** si está en una fortaleza tuya.
- **+4** si tiene un **sanador** al lado.
- Lo que den sus reliquias de curación, y +1 si domina Conservación (escuela de muerte, escalón 2).

### 4.9 Economía

Por turno, cada **ciudad** tuya da:

- +1 de alimento y +1 de materiales.
- Oro: 1 + el nivel de la ciudad (+ bonos de facción).
- Lo que rinda el terreno a 1 casilla de distancia (a 2 si la ciudad es de nivel 3 o más).
- Lo que rindan sus edificios.

Los ingresos totales se ven en la barra de arriba junto a cada recurso. La **escuela arcana en Transmutación** hace que cada edificio de economía rinda 1 más.

### 4.10 Ciudades y edificios

Cada ciudad tiene **nivel + 2 huecos** de edificio. Los edificios tienen requisitos previos y están organizados en tres ramas. **A partir del nivel 3, una ciudad solo puede especializarse en una rama.**

| Rama | Edificio | Nivel | Qué hace |
|---|---|---|---|
| Economía | Granja | 1 | +2 alimento (pide llanura o agua cerca) |
| | Aserradero | 1 | +2 materiales (pide bosque cerca) |
| | Mina | 1 | +2 mineral (pide montaña cerca) |
| | Mercado | 2 | +3 oro (pide otro edificio de economía) |
| | Banco | 3 | +4 oro (pide Mercado) |
| Militar | Cuartel | 2 | Permite pícaros y paladines. Los reclutas cuestan 1 de oro menos |
| | Herrería | 2 | +1 de defensa a quien guarnece la ciudad. Permite forjar caballeros |
| | Arsenal | 3 | Los reclutas salen con +1 de ataque |
| | Academia militar | 3 | Los reclutas salen con 3 victorias de experiencia |
| | Fortaleza | 4 | +2 de defensa en la ciudad y cura 2 más |
| Mágica | Santuario | 1 | +2 maná. Permite arcanistas y sanadores |
| | Biblioteca arcana | 2 | +2 maná. Investigar cuesta menos maná por escalón |
| | Torre de magia | 3 | +3 maná. Permite invocar archimagos |

### 4.11 Investigación

Hay **tres escuelas** de cuatro escalones cada una. Cada escalón pide el anterior y cuesta maná y oro:

| Escuela | Escalón 1 | Escalón 2 | Escalón 3 | Escalón 4 |
|---|---|---|---|---|
| **Militar** | Disciplina: guerreros y paladines +1 de vida | Formación: +1 de defensa con un aliado de la misma clase al lado | Acero: todas las unidades +1 de ataque | Maestría: veteranos o mejores +1 de ataque y de defensa |
| **Arcano** | Teoría mágica: permite arcanistas | Resonancia: el golpe mágico frena al objetivo y alcanza al 75 % | Transmutación: edificios de economía +1, y los arcanistas pueden cambiar el terreno | Alta magia: permite invocar Ecos y los arcanistas +1 de alcance |
| **Tanatología** | Anatomía: +1 de ataque contra heridos | Conservación: cada baja deja 2 de Ánima y las unidades curan 1 más | Reanimación: gastas 3 de Ánima para levantar a un caído | Inmortalidad: al terminar la guerra, la mitad de tus caídos regresan |

Los costes suben de 4 de maná y 2 de oro en el escalón 1 a 16 de maná y 8 de oro en el 4.

### 4.12 Ruinas, criaturas y sucesos

**Saqueo de ruinas.** La primera vez que se pisa una ruina, tira un dado:

| Resultado | Probabilidad |
|---|---|
| Una reliquia | 28 % (50 % en el Archivo Hundido) |
| 3 a 5 de un recurso (alimento, materiales, mineral u oro) | 42 % (20 % en el Archivo) |
| +5 de maná y +2 de Ánima | 15 % |
| Un eco (un soldado nuevo) que se une a tu ejército, o +5 de oro si no hay sitio | 15 % |

**Regiones y estabilidad.** Cada región tiene una estabilidad de 0 a 100. Sube 2 por ronda donde alguien manda. Baja 1 por ronda en los fragmentos inestables sin dueño. Una región es de quien tiene más ciudades y fortalezas en ella. Cuando la estabilidad baja de 30, hay un 28 % por ronda de que ocurra un **suceso**:

- Aparece una **criatura errante**.
- Una **costura se mueve** (solo en los mapas inestables).
- El **terreno cambia** en una casilla.
- El dueño de la región recibe **2 de maná o de Ánima**.

En el Jardín Imposible los bosques se expanden. En el Sueño de los Muertos, algunos caídos se levantan como criaturas errantes. En el Horizonte Roto las costuras cambian de sitio cada 6 rondas.

### 4.13 Habilidades especiales

| Habilidad | Quién | Qué hace |
|---|---|---|
| Alterar terreno | Arcanista o archimago con Transmutación | Cuesta 3 de maná. Cambia una casilla a llanura, bosque o desierto. Enfriamiento de 2 turnos |
| Sabotear | Pícaro junto a una ciudad enemiga | Desactiva un edificio enemigo durante 3 turnos |
| Reanimar | Cualquier unidad con Reanimación | Cuesta 3 de Ánima. Levanta a un caído adyacente (tuyo o enemigo) como unidad propia, con la mitad de vida |

### 4.14 Niebla de guerra

Solo ves lo que alcanzan tus unidades (2 casillas, más lo que den las reliquias o especializaciones), tus ciudades (3) y tus fortalezas (2). Lo que viste y ya no ves queda marcado como recordado, sin las unidades. **Lo que ocurre en la niebla no se anima ni se ve.** La IA ve todo el mapa.

### 4.15 Cómo se gana

Hay cuatro formas de que acabe la guerra:

1. **Capital.** Entrar en la capital rival con una unidad gana de inmediato.
2. **Núcleo del Sueño.** Si terminas tu turno con una unidad sobre el Núcleo, suma 1 al contador. Con **6 turnos seguidos** gana. Si lo dejas, vuelve a cero. Si el rival lo toma, también.
3. **Aniquilación.** Quien se queda sin unidades ni ciudades pierde.
4. **Puntos al turno 35.** Cada ciudad vale 3 puntos, cada fortaleza 2, cada región 2, cada baja enemiga 1, cada oficial enemigo abatido 2 y cada turno sobre el Núcleo 1. Gana quien más tenga. Si empatan, es un empate.

Puedes **rendirte**: cuenta como derrota. Los soldados conservan lo que hayan ganado, pero pierdes lo que no hayas recuperado.

## 5. La guerra por dentro: las clases

| Clase | Rol | Vida / Ataque / Defensa / Movimiento / Alcance | Coste | Requiere |
|---|---|---|---|---|
| Guerrero | Primera línea | 12 / 4 / 2 / 3 / 1 | 2 comida, 2 oro | Nada |
| Cazador | Hostigamiento | 9 / 3 / 1 / 4 / 3 | 2 comida, 2 oro, 1 materiales | Nada |
| Arcanista | Artillería mágica | 7 / 4 / 0 / 3 / 2 | 2 comida, 2 oro, 3 maná | Santuario y Teoría mágica |
| Paladín | Tanque y apoyo | 16 / 3 / 4 / 3 / 1 | 3 comida, 4 oro, 2 mineral | Cuartel |
| Pícaro | Infiltración | 8 / 4 / 1 / 4 / 1 | 2 comida, 3 oro | Cuartel |
| Eco | Magia única | 10 / 6 / 1 / 3 / 2 | 6 maná, 4 oro | Torre de magia y Alta magia |

Lo que añade cada una:

- **Guerrero.** Los aliados a su lado reciben 1 de daño menos.
- **Cazador.** Ataca de lejos, se mueve mucho, puede retirarse hasta 2 casillas tras disparar y pega más desde un bosque. Ignora el bloqueo de unidades pegadas.
- **Arcanista.** Muy frágil. Su golpe alcanza al área y puede cambiar el terreno.
- **Paladín.** Defensa altísima y un aura de +1 de defensa a quienes lo rodean. Caro.
- **Pícaro.** Pega la mitad más si el objetivo está solo, se mueve libre de bloqueos y puede sabotear edificios.
- **Eco.** Una manifestación de la Fractura. Magia de alcance con golpe en área.

Más las exclusivas de cada facción (sección 7), el **Líder** (que no se entrena, solo aparece al principio) y la **Criatura de la Fractura**, neutral, que guarda ruinas y fortalezas (14 de vida, 4 de ataque, 2 de defensa).

## 6. La IA

El rival controlado por la máquina juega con las mismas reglas que tú, sin ver trampas salvo el extra de recursos de la dificultad **Difícil** (+25 %). Ve todo el mapa.

Cada turno:

1. **Investiga**, prefiriendo la escuela de su facción.
2. **Construye** por una lista de preferencias (más militar o más mágica, según la facción), y sube de nivel las ciudades cuando se queda sin huecos.
3. **Recluta** hasta un tope que crece con los turnos, eligiendo clases que equilibren su ejército.
4. **Mueve y ataca**: ataca donde más rinde (descartando ataques que le salgan caros si está herida), captura ciudades, fortalezas y ruinas, retira a los heridos a una ciudad propia, protege a las unidades débiles con una escolta y defiende su capital si hay amenaza cerca. El líder se queda cerca de su capital.

Los tres niveles se diferencian en cuánto **yerra** (fácil, un 35 % de las decisiones de ataque se las salta), si **investiga** y **enfoca** objetivos, el número de tropas iniciales y el bono de recursos.

## 7. Los seis ejércitos de hoy

| Ejército | Ventaja | Exclusiva | Líder y aura | Si cae el líder |
|---|---|---|---|---|
| **Caballeros del Reino** | Las fortalezas dan +1 de defensa extra. Empiezan con Disciplina | Caballero (14/5/3/4/1, pega 2 más si avanza 2 casillas) | Mariscal del Reino: +1 de defensa a los cercanos | Todas las unidades ganan +1 de ataque |
| **Academia Arcana de Dolbred** | Empieza con Resonancia y 5 de maná extra. Investigar cuesta un 25 % menos de maná. Arcanistas y archimagos tienen +2 de vida y +1 de ataque | Archimago (9/6/1/3/3, golpe en área) | Rector de la Academia: +2 de maná | Investigar cuesta el doble |
| **Trono de Ceniza** | Sin gasto de comida. +2 de Ánima por ciudad y cada baja deja más. Las ciudades dan 1 de oro menos | Legión de huesos (10/3/1/3/1, cuesta solo 1 de Ánima) | Soberano de las Cenizas: +1 de ataque | Todas las unidades ganan +2 de vida |
| **Compañía Dorada** | +3 de oro por ciudad y 12 de oro extra al empezar | Mercenario (12/4/2/3/1, 5 de oro, sin edificio ni comida) | Capitán General: +3 de oro | El oro de las ciudades se reduce a la mitad |
| **Hijos del Acero** | +2 de ataque contra monstruos y criaturas salvajes | Ballestero pesado (10/4/1/3/1, +2 contra monstruos o con defensa 3 o más) | Maestro Cazador: +1 de ataque contra monstruos | Cazadores y ballesteros ganan +1 de ataque |
| **Peregrinos del Alba** | Sus unidades curan 2 más por turno. Los paladines tienen +2 de vida y cuestan 1 de oro menos | Peregrino sanador (9/1/1/3/1, cura 4 a los de al lado, no ataca) | Hermana Mayor: +2 de curación | Todas las unidades ganan +1 de defensa |

## 8. Guerras entre jugadores y premios

### 8.1 Duelos

Un jugador puede **retar** a otro jugador registrado, eligiendo el tipo de Fractura. El rival acepta con su propio contingente.

- Es **asíncrono**: cada quien juega su turno cuando puede.
- La guerra se **reconstruye** desde una semilla y la lista de acciones guardada, así que los dos ven exactamente lo mismo.
- Si alguien cae, cae **de verdad** para su ejército.
- Se puede abandonar con **Rendirse**.
- No dan cartas, pero quedan en la historia del mundo.

### 8.2 Premio por ganar contra la IA

Ganar contra la IA da derecho a **una carta de Triunfos**. El servidor decide qué sale: una carta de la rareza que correspondan los logros de esa guerra, un sello (si no queda carta que dar o se llegó al tope del día) o nada (si las recompensas están apagadas).

Logros que cuentan: victoria, victoria en difícil, victoria por el Núcleo o por la capital, primera victoria contra una facción, un soldado que llega a Leyenda, haber matado a un némesis, una casa de tres generaciones y haber hallado una reliquia.

### 8.3 Historia del mundo

Todas las guerras (de todos los jugadores) alimentan una crónica común: cuántas se han disputado, cuántas capitales se tomaron, cuántas veces alguien dominó el Núcleo, cuántos cayeron y las últimas guerras con su relato.

### 8.4 Guardado

- El ejército se guarda en el navegador y, con sesión, en el servidor.
- Una guerra en curso se guarda sola y se puede **retomar** desde la pantalla de inicio.
- Si no hay SQL ejecutado en el servidor, el juego funciona igual, pero solo guarda en el navegador.

---

# PARTE B. Cómo cambia con la expansión **[Plan]**

Todo lo siguiente es plan. Nada está programado todavía. El documento de reglas detallado está en `docs/fractura-expansion.md`.

## 9. De seis a trece ejércitos

| Ejército | Qué es | Mecánica propia |
|---|---|---|
| Brurland (Caballeros del Reino) | Antes Caballeros | Fortalezas más fuertes. Magia rudimentaria: no pasa del escalón 2 de la escuela arcana |
| Dolbred (Academia) | Antes Academia | Investigar más barato |
| Osses (Trono de Ceniza) | Antes Trono | Todo se paga con Ánima |
| Compañía Dorada | Igual | Oro |
| Hijos del Acero | Igual | +2 de ataque a monstruos |
| Santos de Asmodeo | **Antes los Peregrinos del Alba.** Ahora son el brazo armado de la Iglesia de Asmodeo, en tono de cruzada | **Consagración** |
| Nikaalia (Natonocturnos) | **Nuevo.** Gánsteres de estilo noir bajo una noche eterna | **Noche eterna y sobornos** |
| Seosan | **Nuevo.** Escuelas marciales, honor y duelos | **Duelo** |
| Okran | **Nuevo.** Clanes bárbaros y hombres bestia | **Furia** |
| Pelgiria (Hermandad de Cala Ronca) | **Nuevo.** Piratas, pólvora y escudontes | **Navegar** |
| Mravec | **Nuevo.** Satrapía insectoide, de las hormigas quimera | **Devorar y adaptar** |
| Nernib | **Nuevo.** Gnomos, warforged y autómatas | **Taller** |
| Balutia | **Nuevo.** Imperio de legiones | **Tributo** |

Cada ejército sigue teniendo su Líder (con aura y estado si cae), sus ventajas y su exclusiva. Los ejércitos guardados de los Peregrinos pasarán a ser Santos de Asmodeo.

## 10. Tropas propias por ejército

Los cinco roles de siempre (primera línea, hostigador, artillería, tanque, infiltrador) más una exclusiva se mantienen. Lo que cambia es que **cada ejército tiene sus nombres, textos y dibujos** sobre esos roles. Un guerrero de Brurland es un **Miliciano**, en Osses un **Caminante**, en Okran un **Guerrero de clan**.

Las reglas de cada rol no cambian: un Caminante sigue siendo «primera línea» y funciona como el guerrero actual. La diferencia es de identidad y presentación, y en algunos casos de pequeños ajustes. Los soldados guardados conservan su clase base: lo que cambia es el nombre y el dibujo que se muestran según su ejército.

La tabla completa (13 ejércitos por 6 tropas) está en `docs/fractura-expansion.md`.

## 11. Héroes invocables

Cada ejército tiene **un héroe**, una unidad especial **invocada** desde una ciudad. No es un soldado del ejército (es un eco): no entra en tu lista, no gana rango, no lleva reliquias y no cuenta para la campaña.

Reglas comunes:

- **Una invocación por guerra** y no vuelve si cae.
- **Requisitos propios** de cada ejército, que se comprueban solo al invocar. Pueden ser edificios, escuelas, recursos o condiciones de la partida (haber saqueado dos ciudades, haber ganado tres duelos, haber devorado cinco enemigos…).
- El héroe aparece junto a la ciudad. Si no hay casilla libre, el botón queda apagado con el motivo.
- Cuenta para el máximo de 18 unidades.
- La ciudad muestra los requisitos como una lista con marca de cumplido o pendiente.
- **Dolbred** tiene un **sorteo**: al empezar la guerra se sortea un candidato por cada uno de los tres Colegios (Brasa Viva, Humores y Umbral). Ves los tres que salen y solo puedes invocar uno.

Los héroes son personajes del lore o inventados:

| Héroe | Ejército | Origen |
|---|---|---|
| Adam Kovacs | Brurland | Lore |
| Maestros de los Colegios | Dolbred | Mezcla de lore e invento |
| El Ceniciento | Osses | Campeón, con la habilidad de Ceniza Coronada |
| Mano de Oro | Compañía | Lore |
| Rykerd, El Imperdonable | Hijos del Acero | Lore. El héroe más fuerte y más difícil de invocar |
| El Vigilante | Asmodeo | Invento |
| Don Ottavio Umbral | Nikaalia | Invento |
| Kirin | Seosan | Lore |
| Ebonrabia | Okran | Lore, de la familia del Behemoth |
| Capitana Dientesal | Pelgiria | Invento |
| Zaphar, primer vástago | Mravec | Invento |
| Primer Engranaje | Nernib | Lore |
| Legada Orsa Valcarón | Balutia | Invento |

**Rykerd** es el caso especial. Para invocarlo hay que cumplir **cuatro cosas a la vez**: tener una fortaleza capturada, haber cazado 3 criaturas salvajes, dominar el escalón 3 de la escuela militar y construir la Perrera de Cadenas, y pagar mucho (oro, mineral, comida y Ánima) además de estar al menos en el turno 8. A cambio es el héroe más poderoso: unos 30 de vida y 6 de ataque, con Temible, Rencor y +2 contra monstruos.

Tiene una **Contención**: si el Maestro Cazador (el Líder) cae, Rykerd se desata y ataca a lo más cercano, de cualquier bando, durante 3 turnos. Pasado ese tiempo vuelve a obedecer.

## 12. Mecánicas nuevas por ejército

| Ejército | Regla |
|---|---|
| Brurland | Las fortalezas dan +1 de defensa extra. La escuela arcana no pasa del escalón 2 (no hay Ecos ni archimagos) |
| Santos de Asmodeo | **Consagración.** Una casilla consagrada (la ciudad y un anillo alrededor) da +1 de defensa a los aliados y cura 1 más por turno. Consagrar cuesta un turno de un Consagrador |
| Nikaalia | **Noche eterna.** Los rivales ven una casilla menos. Una unidad escondida no se puede seleccionar ni atacar hasta que un enemigo esté a 1 casilla. Los **sobornos** cuestan oro y cambian de bando a una criatura salvaje 2 turnos |
| Seosan | **Duelo.** +2 de ataque a una unidad que ataca a otra que está sola, y ambas se quedan sin ayuda de aliados adyacentes |
| Okran | **Furia.** +1 de ataque por cada 25 % de vida perdida, con tope de +3 |
| Pelgiria | **Navegar.** Solo sus unidades cruzan casillas de agua, a coste 1 |
| Mravec | **Devorar y adaptar.** Solo tres tropas pueden hacerlo (Guerrera del Panal, Acechador de arena y Quimera). Quien mata gana un rasgo según el rol del muerto, con un máximo de 2 por unidad y por guerra |
| Nernib | **Taller.** Un Autómata gratis cada 4 turnos, máximo 3 vivos |
| Balutia | **Tributo.** Al conquistar una ciudad aparece un Auxiliar de provincias. Una vez por ciudad y máximo 3 por guerra |

**Pólvora.** Algunas tropas (el pistolero de Nikaalia, el arcabucero y el cañonero de Pelgiria, el artillero de Nernib, el pirotécnico de Balutia) usan armas de fuego. El daño es alto, pero el disparo necesita **recarga**: se recupera al empezar tu siguiente turno y no se puede mover y disparar en el mismo turno. Además «atraviesa 1» de defensa del objetivo en ese golpe.

**Rasgos de devorar.** Primera línea: +2 de vida máxima. Hostigador: +1 de alcance. Artillería: +1 de ataque. Tanque: +1 de defensa. Infiltrador: +1 de movimiento. No se repite el mismo rasgo.

## 13. Curvas de poder

No todos los ejércitos son fuertes en todo momento de la guerra. La intención es que haya **estrategias claras contra cada uno**: atacar pronto a quien necesita tiempo, esperar a que se agote quien empieza fuerte, elegir el mapa que favorece a uno u otro. No se busca un 50 % de victorias idéntico en todo momento.

La curva sale de las propias mecánicas del ejército. No hay bonificaciones ni penalizaciones por llegar a cierto turno.

| Tipo | Ejércitos | De dónde sale la fuerza | Cómo se contrarresta |
|---|---|---|---|
| **Temprana** | Compañía Dorada, Okran, Nikaalia | Oro inicial, Furia, sigilo y sobornos | Aguantar el primer empuje. Los rivales desarrollan defensas y economía |
| **Tardía** | Dolbred, Nernib, Mravec | Tecnología, producción y adaptaciones | Presionarlos antes de que acumulen |
| **Desgaste** | Osses | Las bajas dan Ánima | No alimentarlo con bajas y destruir sus fuerzas antes de que acumulen |
| **Pico** | Hijos del Acero, Balutia | Rykerd preparado, conquistas en cadena | Cortar la expansión o matar al Maestro Cazador |
| **Situacional** | Seosan, Pelgiria, Asmodeo, Brurland | Duelos y composición, el agua del mapa, el territorio consagrado, las fortalezas | Elegir el campo de batalla y la formación |

La portada mostrará una etiqueta de curva en cada ejército, por ejemplo «Empieza fuerte» o «Tardío».

El reloj de 35 turnos es común a todos. Los ejércitos tardíos deben alcanzar su fuerza hacia el turno 20 o 25. Si su pico llega después, no se pueden jugar.

## 14. Compatibilidad con lo guardado

- Los identificadores actuales se conservan. `peregrinos-del-alba` se trata como alias de los Santos de Asmodeo.
- Los ejércitos guardados de los Peregrinos se reescriben una vez con el nuevo identificador.
- Cada guerra lleva una **versión de reglas**. Una guerra ya empezada, incluso entre jugadores, se reproduce con las reglas y datos de la versión con que empezó. Sin esto, cambiar estadísticas o costes haría que una partida guardada diera otro resultado.
- Los soldados conservan su clase base y su historial.

## 15. Orden de trabajo y la pista visual

1. **Base común:** tabla de tropas por ejército, versión de reglas, alias, sistema de invocación y listas de nombres.
2. **Prueba vertical: Brurland contra Osses**, con Adam y el Ceniciento, de principio a fin (tropas, invocación, guardado, partida contra la IA y repetición de una partida entre jugadores).
3. **Bloque 1:** Dolbred, Compañía, Hijos del Acero (con Rykerd) y Santos de Asmodeo.
4. **Bloque 2:** Okran, Balutia, Seosan y Nikaalia.
5. **Bloque 3:** Pelgiria, Mravec y Nernib, que tienen las mecánicas más raras.
6. **Equilibrio** con simulaciones tras cada bloque.

Aparte, hay una **tarea de rediseño visual** que va en paralelo y en otra sesión: recursos con iconos y desglose, rejilla del tablero más tenue con fronteras de región reforzadas, panel de ciudad con ranuras de edificios y hueco para el botón de héroe, árbol visual de investigación y resumen de fin de turno. No cambia ninguna regla.

### 15.1 Bucle entre guerras y retención **[Plan]**

Además de los ejércitos y los héroes, hay un conjunto de ideas aprobadas para que cada guerra deje algo que contar y el jugador quiera «una guerra más». Los detalles están en la sección 11 de `docs/fractura-expansion.md`.

- **Después de cada guerra:** un momento memorable garantizado para un soldado, una decisión con coste (por ejemplo, qué hacer con un veterano herido) y una nota S/A/B.
- **Némesis activo:** un tablón de caza con tus enemigos vivos, recompensa por matarlos y deuda de sangre si matan a tres de los tuyos.
- **Botín:** contador visible que sube la probabilidad de reliquia en cada ruina, y un hallazgo con nombre garantizado por guerra.
- **Contratos** antes de salir: seguro, arriesgado o de sangre, con riesgo y recompensa crecientes.
- **Dentro de la partida:** rachas de bajas y una ayuda de remontada, a probar con simulaciones.
- **Apego:** herencia con rasgo, prestigio de casa, renombrar soldados, Códice y logros con barra.
- **Social:** Fractura del día con ranking comprobado en servidor, liga de duelos y avisos por Discord.

Nada de esto da cartas por ahora. Cómo ganar cartas con estos sistemas se decide más adelante.

---

# PARTE C. Referencia rápida

## 16. Números clave

| Concepto | Valor |
|---|---|
| Tamaño del mapa | 13x13 |
| Regiones | 9 (3x3) |
| Duración | 35 turnos |
| Núcleo para ganar | 6 turnos seguidos |
| Unidades por bando | 18 |
| Contingente | 6, +1 cada 3 victorias, máximo 12 |
| Capitanes | 3 |
| Soldados por ejército | 80 |
| Niveles de ciudad | 1 a 5 (huecos = nivel + 2) |
| Escuelas | 3, de 4 escalones |
| Reliquias | 18 |
| Convalecencia | 2 guerras |
| Edad de alistarse | 16 |
| Edad de retiro / vejez | 52 / 66 |
| Años por guerra | 1 o 2 |

## 17. Puntuación al turno 35

| Concepto | Puntos |
|---|---|
| Ciudad | 3 |
| Fortaleza | 2 |
| Región | 2 |
| Baja enemiga | 1 |
| Oficial enemigo abatido | 2 |
| Turno sobre el Núcleo | 1 |

## 18. Dificultades

| Nivel | Tropas iniciales del rival | Comportamiento |
|---|---|---|
| Fácil | 4 | Falla muchas decisiones de ataque. No investiga ni enfoca |
| Normal | 6 | Falla pocas. Investiga y enfoca |
| Difícil | 8 | No falla. +25 % de recursos |

A cualquiera se suman hasta 4 tropas extra y más experiencia según lo que lleves ganado.

## 19. Lo que sigue sin decidir

- Los números de las exclusivas nuevas y de los héroes del plan son provisionales y se ajustan con simulaciones.
- Los nombres de los héroes inventados (Don Ottavio Umbral, Capitana Dientesal, Zaphar, Legada Orsa Valcarón, El Vigilante, y los maestros nuevos de los Colegios) se pueden cambiar.
- Selenia y Behemoth no entran en la expansión. Quedan como posibles jefes neutrales más adelante.
- Falta probar con jugadores reales las guerras entre jugadores y revisar a fondo la versión móvil.
