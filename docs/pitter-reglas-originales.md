# Pitter-Patter: reglas de combate del original (lo que se sabe y lo que no)

Estudio hecho el 2-nov-2026 sobre `dump.cs`, que es la lista de clases, campos y nombres de métodos del juego (sin código y sin números). Sirve para saber **cómo está montado** el combate. No sirve para saber los valores: los tiempos, los multiplicadores y las tablas están en datos que el dump no incluye. Esos valores se afinan a ojo.

No se copia código, arte ni tablas. Solo se toman las ideas de las reglas.

Cada punto lleva una etiqueta: **[nombre]** lo dicen los nombres del dump con claridad, **[inferido]** lo deduzco de esos nombres, **[desconocido]** no hay manera de saberlo.

## 1. Tablero y piezas

- Casillas **cuadradas**, con coordenadas enteras (X, Y). El tablero tiene `GridWidth × GridHeight`. En las capturas son 6 columnas. Las casillas se llaman `HexSpace` pero no son hexágonos. [nombre + captura]
- Cada pieza pertenece a un **personaje** (`RegisteredChara`) y tiene un **tipo de pieza** (`PieceTypeData`). Se agrupan las del mismo personaje; el color del fondo es el del personaje (9 colores: rojo, naranja, amarillo, verde, azul, morado, rosa, blanco, negro). [nombre]
- Tipos de pieza: Normal, Bomba, Stand, Elemental, Blank (hueco), Enemy, Buff, DeBuff, Box (bloque), Power, SkillResistant, Crystal y Shabon (burbuja). Cada tipo tiene banderas: se puede arrastrar, tiene gravedad, bloquea la gravedad, se agrupa consigo misma, la borra una bomba, puntúa al borrarse, se queda en el Rush, y un efecto al agruparse, al tocarla, al cambiarla y permanente. [nombre]
- Hay un tope de piezas Elementales a la vez (`MaxElementals`). [nombre]
- Los personajes que salen son los del equipo: líder, sub y extras (`SpawnCharaList`, `ExtraSpawnList`). Hay lista de prohibidos y de extras. [nombre]
- La partida empieza con un tablero sin ninguna agrupación hecha (`SetupNoMatchSpawnList`). [nombre]

## 2. Tiempo real, no por turnos

- La batalla tiene reloj (`MaxBattleTime`, `RemainingTime`). Las piezas caen y se generan solas, con estados Spawn, Drop y Wait y una pausa configurable entre generaciones. [nombre]
- No hay «turno». Se puede mover mientras hay combos en marcha; algunas acciones esperan a que todo esté estable (`AllPiecesStable`). [inferido]
- Si pasas un rato sin mover aparece una pista con un movimiento que agrupa (`HintTime`, `GetAutoMatchSuggestion`). [nombre]

## 3. Cómo se mueve

- Se toca una pieza y se arrastra. La pieza tocada se intercambia con las casillas por las que pasa el dedo (`touchPiece`, `swapPiece`, `swapSpace`, `GetSwapSpace`). [nombre]
- Hay una distancia mínima de arrastre (`DragLockDistance`). Al superarla la dirección **se bloquea en horizontal o en vertical** (`EDragDir`) y la pieza se mueve por esa fila o columna (`DragOnSameLane`). [nombre]
- Hay piezas que no se pueden mover (`CantMoveSpace`, `CanDrag`). [nombre]
- Al soltar se comprueban las agrupaciones (`EndDrag`, `RegisterCombos`). [inferido]

## 4. Agrupar y tamaño

- Un grupo se crea a partir de una pieza raíz y un mínimo de piezas (`RegisterComboForPiece(root, minMatch)`). El mínimo puede cambiar por regla de jefe (`RuleMinBlockCount`). La wiki dice 4 o más; se mantiene hasta que haya algo mejor. [nombre + wiki]
- Cada grupo es un `ComboData` con estado de pulso, tamaño máximo y personaje mayoritario. [nombre]
- Las piezas de un grupo **se pliegan hacia una casilla** (`MergeToSpace`, `GetNextFoldSpace`, `MergeVisualPieces`) y los grupos grandes se ven como **una sola pieza grande** (`CurrentSize`, `HideBigSizePieces`). Es el bloque grande de la captura. [nombre + captura]
- El tamaño del grupo cuenta para la puntuación (tabla por tamaño, tabla por número de piezas, bonus por mismo tamaño). [nombre]
- Hay **formas especiales**: cuadrados (`SquareShapeList`, `CheckSquareShape`) y una forma que crea bombas (`BombShape`). Cada forma tiene un bonus propio (`ShapeCoinBonus`). [nombre]
- Un grupo puede dejar una **bomba** (`CanCreateBomb`, `BombCreationCount`). Las bombas explotan al tocarlas (`ProcTapEffect`) o al final (`ProcAllBombs`). [nombre]

## 5. Combo

- Cada grupo suma al contador de combo (`ComboCount`) y reinicia un temporizador (`ComboTimer`). Cuando se acaba, el combo se rompe. [nombre]
- Hay una tabla de bonus por combo con dos datos por nivel: un bonus de puntuación y cuánto dura la ventana (`ComboBonusData`). [nombre]
- Romper el combo es una condición que pueden usar los jefes (`CheckComboBreakCondition`). [nombre]

## 6. Daño

- La puntuación es daño al jefe. Se calcula con: coeficiente de grupo normal, tablas por tamaño y por piezas, multiplicador según el personaje (líder, sub u otros), bonus de combo, bonus de forma y la ataque base del personaje (`AtkMin` más `AtkInc` por nivel). [nombre]
- Hay multiplicadores aparte para el modo Fever (el follow-up) y para el Rush. [nombre]
- Hay daño de grupos normales, de habilidades y de «stand» por separado (`NormalBuffDamage`, `SkillBuffDamage`, `StandBuffDamage`), para los buffs. [nombre]
- Los jefes pueden poner reglas: daño mínimo, multiplicador del daño normal, daño forzado, multiplicador de borrado por habilidad, tamaño mínimo de stand. [nombre]

## 7. Follow-up, el «Stand Up Time» (Fever)

- Hay un **medidor** (`FollowUpCounter`) que se llena cuando explotan fichas (`AddPopCount`, `CountFollowUpGauge`) y **se pudre con el tiempo** (`FollowUpCounterRotRate`). Se considera cargado al pasar un umbral (`FollowUpActiveCount`, `IsFollowUpCharged`). [nombre]
- Al cargarse empieza el modo (`TryStartFollowUp`, con un efecto «FeverStart»). El nombre del efecto indica que Fever y Stand Up son lo mismo. Si arranca solo o con un toque: [desconocido, probablemente solo]. [nombre + inferido]
- Dura un tiempo (`FollowUpActiveTime`), se le suma tiempo al empezar y por cada agrupación (`FollowUpStartAddTime`, `FollowUpMatchAddTime`). [nombre]
- Durante el modo, los grupos **no desaparecen**: se registran como grupos «de follow-up» (`IsInFollowUpCombo`) y se quedan de pie en el tablero, con otro aspecto. [nombre]
- Al acabar el tiempo hay una secuencia: esperar a que acabe lo que se esté procesando, voltear las piezas, cargar, **atacar todas a la vez** y terminar (`EFollowUpEnd`, `AttackAllFollowUp`). El daño se acumula (`followUpDamage`) y lleva su multiplicador (`FollowUpDmgMultiplyer`). [nombre]
- Si el reloj de la batalla sigue corriendo durante el modo lo decide cada jefe (`FollowUpTimePasses`). [nombre]
- Cada agrupación en el modo carga también las habilidades (`FollowUpMatchSkillAdd`). [nombre]

## 8. Habilidades

- Cada personaje tiene **tres**: una activa, una pasiva y una de líder. [nombre]
- **Activa:** hay un botón por personaje (líder y sub, `SkillButton[]`) y un medidor (`SkillGauge`). El medidor se carga con las piezas **de ese personaje** que explotan (`AddPopCount`, el efecto `ChargeWithColor`), con el tiempo (`UpdateSkillGaugeTime`) y con otras habilidades. Se lanza **con el botón** (`ActivateSkill`) cuando está lista (`IsSkillReady`). No hay ningún indicio de lanzamiento automático. [nombre]
- El contador que se ve junto a cada personaje (`SkillCounter`, con un efecto «último») parece **cuántas piezas faltan** para tenerla lista. Las estrellas son el nivel (`SkillGaugeLv`). [inferido]
- Estilos: normal, Boost (sube de nivel con los usos), un solo uso y StandUp (se activa al entrar en el modo). [nombre]
- Se puede limitar cuántas veces se usa (`RuleSkillUseLimit`) y cuánto carga (`RuleSkillGaugeRate`). [nombre]
- Familias de efectos, para inspirarse: borrar zonas o piezas (cruces, líneas, tipos), **transferir** (cambiar piezas al color del personaje), **parar el tiempo** y dejar agrupar solo a mano, cambiar el medidor de otras habilidades, entrar al modo follow-up, buffs de poder, ralentizar o curar al jefe. [nombre]
- Alcance: todo el tablero, un área fija, un área que se elige tocando, una línea que se elige con un deslizamiento, o al azar. [nombre]
- **Pasiva:** se evalúa sola (`TickPassiveSkills`). [nombre]
- **Líder:** se dispara **sola por condiciones**, y una de las condiciones es la **puntuación** (`ScoreHigherThan`, `ScoreLessThan`). Otras: al empezar, siempre, cada ataque, cada habilidad, vida del jefe, número de piezas del grupo, forma, tamaño de stand, combo, durante el modo follow-up, cada cierto tiempo al azar y piezas caídas. Los efectos son subir el ataque con el tiempo o por grupo, combos extra, cargar medidores, cargar el modo, cambiar piezas, añadir tiempo y soltar piezas. [nombre]

## 9. Jefes

- Un jefe tiene vida, un límite de tiempo, un conjunto de reglas, habilidades propias, un patrón de ataques y piezas de ataque (`AttackPieceType`, `AttackPower`) que ensucian el tablero. [nombre]
- Sus ataques se disparan por **condiciones** (`AttackCondition`): vida restante, uso de la habilidad de líder o de sub, borrado de ciertas piezas, romper el combo, ataque normal del jugador, daño del stand, tamaño de stand, cada cierto tiempo, cambio del medidor, entrada en el follow-up. [nombre]
- Hay minijuegos de jefe (piedra-papel-tijera, béisbol) que no se van a hacer. [nombre]

## 10. Final de la batalla

- Al acabarse el tiempo se procesan las habilidades, las bombas y las agrupaciones pendientes antes de contar (`EEndCheckState`). [nombre]
- Existe un **Rush**: una secuencia final de ataque de los personajes contra el jefe, con medidor propio y multiplicador propio (`RushTime`, `RushDamageMultiplier`). Cuándo se activa exactamente [desconocido]. [nombre]
- Modos: normal, de puntuación, bingo, cadena y torre. [nombre]

## Qué cambia en nuestro motor

El motor actual (por turnos, 6×6, arrastre libre) se queda corto en esto: tiempo real, bloqueo de eje, ventana de combo, modo follow-up con medidor que se pudre y sigue el esquema de arriba, bloque grande al agrupar, bombas y cuadrados, y habilidades con botón, pasiva y de líder por condición. Lo que ya está bien: cuadrícula 6×6, intercambio por el camino, caja de 6+, habilidades hechas a mano, jefes del bestiario.

## Qué se ha hecho ya

Bloqueo de eje al arrastrar, ventana de tiempo del combo, tamaño de grupo, bloque grande al agrupar (también de pie en el Stand Up), medidor del Stand Up que se pierde y da tiempo por grupo, habilidades con botón y contador de fichas que faltan, y habilidad de líder por condición (`docs/pitter.md`). Falta: pasiva, Rush, piezas especiales y mover durante la resolución.
