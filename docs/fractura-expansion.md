# La Fractura: expansión a trece ejércitos

Documento de reglas y de trabajo. Todo lo que sigue es plan. Todavía no hay código. Se cierra aquí lo que pueda obligar a rehacer cosas después. Los números son una primera estimación y se ajustan con simulaciones.

Estado: aprobado el concepto el 29-oct-2026. Falta empezar la base común.

## 1. Qué cambia

- Los ejércitos pasan de seis a trece.
- Cada ejército tiene sus propias tropas (nombre, texto y dibujo) sobre los mismos cinco roles de hoy, más una exclusiva.
- Cada ejército tiene un único héroe invocable, con requisitos propios. Dolbred tiene un sorteo de tres.
- Cada ejército tiene una mecánica propia y una curva de poder esperada.
- Los Peregrinos del Alba pasan a ser los Santos de Asmodeo. Los Hijos del Acero se quedan, con Rykerd como héroe.

Lo que no cambia: el motor determinista, la campaña (rangos, casas, reliquias, caídos), las guerras entre jugadores y la regla de que lo que pasa en la Fractura no altera la historia del mundo.

## 2. Los trece ejércitos

| Nombre visible | Identificador | Mecánica propia | Líder |
|---|---|---|---|
| Brurland (Caballeros del Reino) | `caballeros-del-reino` | Fortalezas más fuertes. Magia rudimentaria: su escuela arcana no pasa del escalón 2 | Mariscal del Reino |
| Dolbred (Academia Arcana) | `academia-arcana-de-dolbred` | Investigar más barato | Rector de la Academia |
| Osses (Trono de Ceniza) | `trono-de-ceniza` | Todo se paga con Ánima | Ceniza Coronada |
| Compañía Dorada | `compania-dorada` | Oro | Capitán General |
| Hijos del Acero | `hijos-del-acero` | +2 de ataque a monstruos y criaturas salvajes | Maestro Cazador |
| Santos de Asmodeo | `santos-de-asmodeo` | Consagración | Primado de Ithranor |
| Nikaalia (Natonocturnos) | `nikaalia` | Noche eterna y sobornos | El Don |
| Seosan | `seosan` | Duelo | Gran Maestro de Kaishoto |
| Okran | `okran` | Furia | Jefe de Vornhaal |
| Pelgiria (Hermandad de Cala Ronca) | `pelgiria` | Navegar | Capitán de la Hermandad |
| Mravec | `mravec` | Devorar y adaptar | La Satrapía |
| Nernib | `nernib` | Taller | Oligarca |
| Balutia | `balutia` | Tributo | Emperador |

Los identificadores antiguos se conservan (ver sección 8). Los nombres visibles pueden cambiar sin tocar los identificadores.

### Anclas de lore

- **Brurland.** Adam Kovacs, capitán de los Caballeros del Reino. Instituto Vesalio. Ocupación de Broneland por Osses.
- **Dolbred.** Miraveil con sus siete torres, la Academia y los tratados «Fundamentos de...». Guardián de Vaelmoot. Konnovan, el zorro de fuego del bosque.
- **Osses.** Sepulkrad y Ceniza Coronada. Cátedra de Ceniza. Fuerte Desdén, donde se retiene a Rykerd.
- **Compañía Dorada.** Mano de Oro, que ha servido y combatido contra casi todas las naciones.
- **Hijos del Acero.** Cazadores de monstruos a sueldo. Cobraron el triple por la cacería de Rykerd.
- **Santos de Asmodeo.** Teocracia humana de clérigos y paladines, desconfiada de las demás razas. Catedral de la Vigilia, del Alba y de la Pureza, Fyre, Vigía del Camino, Bosque de las Confesiones. Es el brazo armado de la Iglesia de Asmodeo, con el tono de una cruzada. Conserva de los Peregrinos lo sagrado: curación, paladines y santuarios.
- **Nikaalia.** Noche eterna bajo un domo de Nigredo. Umbrathil, Bajovela, Mercado de las Sombras. Los Natonocturnos son gánsteres de estilo noir.
- **Seosan.** Escuelas marciales que se respetan entre sí, duelos formales, la religión Senkai y la leyenda del Kirin. Kaishoto es la capital.
- **Okran.** Clanes bárbaros y hombres bestia. Vornhaal, Círculo de Huesos, Tierras Altas.
- **Pelgiria.** Archipiélago. Thalassar, Cala Ronca, Puerto Franco, los escudontes (tortugas gigantes de mar). La Hermandad de Cala Ronca es un invento pirata para la Fractura, con aire de gánster de cubierta y pólvora.
- **Mravec.** Satrapía de insectoides, descendientes de Reginamex, la Reina Hormiga. Quitinismo. Zaphara, Kelbara, la Madre del Desierto y los gusanos de arena. Su mecánica toma de las hormigas quimera de Hunter x Hunter y del aire de Silithus y Ahn'Qiraj.
- **Nernib.** Ciudad-estado de gnomos y warforged. Autómatas, Guardiópetras, Mirmeción (guardianes contra hormigas gigantes), Balistrix, Runexis.
- **Balutia.** Imperio de legiones. La Ergástula, el Yunque Ardiente y las dodogamas. Utiliza las costumbres locales como herramienta de dominio.

## 3. Tropas

Los cinco roles de siempre (primera línea, hostigador, artillería, tanque, infiltrador) más una exclusiva. Cada ejército pone nombre, texto y dibujo. Donde la tabla marca **P** hay silueta propia. Donde no, la tropa comparte base y solo cambia nombre y colores. Cada tropa se compone de piezas intercambiables: cuerpo del rol, cabeza o yelmo de la facción, arma y paleta.

🔫 usa pólvora. ★ puede devorar y adaptar (solo tres tropas en total, las de Mravec).

| Ejército | Primera línea | Hostigador | Artillería | Tanque | Infiltrador | Exclusiva |
|---|---|---|---|---|---|---|
| Brurland | Miliciano (P) | Montaraz | Hechicero de armas | Escudero de Hierro | Batidor | Caballero |
| Dolbred | Guardián del Colegio | Cartógrafo de campo | Adepto (P) | Armadura animada (P) | Ilusionista | Archimago |
| Osses | Caminante (P) | Acechador | Nigromante de la Cátedra (P) | Abominación (P) | Carroñero | Legión de huesos |
| Compañía Dorada | Alabardero a sueldo | Ballestero contratado (P) | Hechicero a sueldo | Escudero de Oro | Cuchillo de alquiler | Mercenario |
| Hijos del Acero | Alanceador de caza | Batidor de caza | Alquimista de cazadores | Escudero de cacería | Rastreador | Ballestero pesado |
| Santos de Asmodeo | Cruzado (P) | Vigía del Camino | Oficiante del Alba | Paladín de la Pureza (P) | Confesor | Consagrador |
| Nikaalia | Matón (P) | Pistolero de callejón 🔫 | Alquimista de Bajovela | Guardaespaldas | Sicario | Capo |
| Seosan | Discípulo de escuela (P) | Arquero de Yumigaoka | Monje de Senkai (P) | Guardián de templo | Sombra de Tetsumura | Maestro de escuela |
| Okran | Guerrero de clan (P) | Lanzador de huesos | Chamán de huesos | Gran hombre bestia (P) | Acechador de estepa | Berserker |
| Pelgiria | Marinero de abordaje | Arcabucero de cubierta 🔫 | Cañonero 🔫 | Jinete de escudonte (P) | Contrabandista | Barrilero |
| Mravec | Guerrera del Panal ★ | Escupidor de ácido | Sacerdote de Quitina | Centinela de quitina (P) | Acechador de arena ★ | Quimera ★ |
| Nernib | Operario acorazado | Artillero de Balistrix 🔫 | Artificiero gnomo | Warforged (P) | Explorador mecánico | Autómata |
| Balutia | Legionario (P) | Auxiliar de provincias | Pirotecnista del Yunque 🔫 | Pretoriano | Delator de la Corte | Condenado de la Ergástula |

El Eco (magia única, escuela arcana 4) sigue siendo común a todos y no cambia.

### Exclusivas nuevas: estadísticas provisionales

Formato: vida / ataque / defensa / movimiento / alcance. Las exclusivas que ya existen no cambian.

| Tropa | Estadísticas | Coste | Requiere | Efecto |
|---|---|---|---|---|
| Capo (Nikaalia) | 9 / 4 / 1 / 3 / 1 | 2 comida, 4 oro | Cuartel | Los aliados adyacentes ganan +1 de ataque |
| Maestro de escuela (Seosan) | 10 / 5 / 1 / 4 / 1 | 3 comida, 4 oro, 1 mineral | Cuartel | +2 de ataque contra una unidad que está sola |
| Berserker (Okran) | 11 / 4 / 0 / 3 / 1 | 3 comida, 2 oro | Nada | Furia reforzada: +1 de ataque extra a partir de la mitad de vida |
| Barrilero (Pelgiria) | 6 / 3 / 0 / 3 / 1 | 1 comida, 3 oro | Nada | Al morir explota: 3 de daño en 3x3 |
| Quimera (Mravec) ★ | 11 / 4 / 2 / 3 / 1 | 3 comida, 2 oro, 2 mineral | Cuartel | Devora y adapta |
| Autómata (Nernib) | 8 / 3 / 2 / 3 / 1 | 2 materiales, 1 mineral | Taller | Sin comida |
| Condenado de la Ergástula (Balutia) | 8 / 3 / 1 / 3 / 1 | 1 comida, 1 oro | Nada | Tropa barata |
| Consagrador (Asmodeo) | 9 / 1 / 1 / 3 / 1 | 2 comida, 2 oro | Santuario | Cura 4 a los aliados de al lado al empezar tu turno (el rol del Sanador) |

### Escala común

Para no ajustar a mano 78 emparejamientos, cada tropa se mide con un presupuesto de puntos aproximado: vida / 2 + 1,5 por cada punto de ataque, defensa y alcance + 1 por movimiento. Una tropa común ronda los 9 a 11 puntos y una exclusiva, los 11 a 13. Los héroes quedan por tramos, según su nivel (sección 5). La escala sirve para detectar tropas fuera de línea. No sustituye a las simulaciones.

## 4. Mecánicas propias

Cada mecánica tiene una regla de una línea para que no quede ambigua.

| Mecánica | Ejército | Regla |
|---|---|---|
| Fortalezas fuertes | Brurland | Las fortalezas dan +1 de defensa extra. La escuela arcana tiene techo en el escalón 2 (no hay Eco ni archimagos) |
| Investigación barata | Dolbred | Investigar cuesta un 25 % menos de maná |
| Ánima | Osses | Sin comida. Cada baja deja Ánima extra. Las ciudades dan 1 de oro menos |
| Oro | Compañía | +3 de oro por ciudad y 12 de oro extra al empezar. Los mercenarios no necesitan edificio |
| Caza mayor | Hijos del Acero | +2 de ataque contra monstruos y criaturas salvajes |
| Consagración | Santos de Asmodeo | Una casilla consagrada (la ciudad y un anillo alrededor) da +1 de defensa a los aliados y cura 1 más por turno. Consagrar cuesta un turno de un Consagrador |
| Noche eterna | Nikaalia | Los rivales ven una casilla menos. Una unidad escondida no se puede seleccionar ni atacar hasta que un enemigo esté a 1 casilla. Los sobornos cuestan oro y cambian de bando a una criatura salvaje 2 turnos |
| Duelo | Seosan | +2 de ataque a una unidad que ataca a otra que está sola, y ambas se quedan sin ayuda de aliados adyacentes |
| Furia | Okran | +1 de ataque por cada 25 % de vida perdida, con tope de +3 |
| Navegar | Pelgiria | Solo las unidades de Pelgiria cruzan casillas de agua, a coste 1 |
| Devorar y adaptar | Mravec | Solo tres tropas (★). Quien mata gana un rasgo según el rol del muerto: primera línea, +2 de vida máxima; hostigador, +1 de alcance; artillería, +1 de ataque; tanque, +1 de defensa; infiltrador, +1 de movimiento. Máximo 2 rasgos por unidad y por guerra, sin repetir el mismo. Una unidad con 2 rasgos no gana más. Las tropas creadas durante la guerra también pueden adaptarse |
| Taller | Nernib | Un Autómata gratis cada 4 turnos, máximo 3 vivos. Si no hay casilla libre se salta ese turno |
| Tributo | Balutia | Al conquistar una ciudad aparece un Auxiliar de provincias. Una vez por ciudad, máximo 3 por guerra |

### Pólvora

- Daño alto. El disparo consume la recarga y esta se recupera al empezar tu siguiente turno.
- No se puede mover y disparar en el mismo turno.
- «Atraviesa 1»: resta 1 a la defensa del objetivo solo en ese golpe, y se aplica una sola vez en el cálculo de daño.

## 5. Héroes

### Reglas comunes de invocación

1. Cada ejército tiene un único héroe. Dolbred tiene un sorteo al empezar la guerra.
2. Se puede invocar una sola vez por guerra y no vuelve si cae.
3. Los requisitos se comprueban solo al invocar. Si después se pierde el edificio, el héroe sigue.
4. Las condiciones de partida (bajas, saqueos, duelos, regiones) cuentan solo los acontecimientos de esa guerra.
5. Aparece junto a la ciudad desde la que se invoca. Si no hay casilla libre, el botón queda apagado con el motivo.
6. Cuenta para el máximo de unidades (18).
7. Son ecos. No entran en la lista de soldados, no ganan experiencia y no llevan equipo.
8. Lo que crean (mercenarios, autómatas) se queda aunque el héroe caiga.
9. La interfaz muestra los requisitos como una lista con marca de cumplido o pendiente y la cantidad que falta.
10. Dolbred: el sorteo usa el generador de la propia guerra, así que es reproducible.

### Niveles

| Nivel | Vida | Ataque | Defensa | Uso |
|---|---|---|---|---|
| 1 | 18 a 20 | 4 a 5 | 3 a 4 | Requisitos moderados |
| 2 | 22 a 24 | 5 | 3 | Requisitos altos |
| 3 | 30 | 6 | 3 | El más difícil de invocar y el más recompensante |

### Lista

| Nivel | Héroe | Ejército | Requisitos | Efecto principal |
|---|---|---|---|---|
| 1 | Adam Kovacs (lore) | Brurland | Fortaleza propia y herrería. Coste: 3 comida, 4 oro, 3 mineral | Los aliados a 2 casillas ganan +1 de ataque. Activa: «Formad filas», los adyacentes ganan +1 de defensa hasta tu próximo turno (cada 3 turnos) |
| 1 | Mano de Oro (lore) | Compañía | 12 de oro, sin edificio | Llega con 2 Mercenarios. +2 de oro por turno mientras viva. Activa: paga 4 de oro y una criatura salvaje adyacente lucha por ti 3 turnos |
| 1 | Primer Engranaje (lore) | Nernib | Taller y 10 de materiales | Crea 2 Autómatas. Tus Autómatas tienen +1 de ataque |
| 1 | Don Ottavio Umbral (invento) | Nikaalia | Controlar el Mercado de las Sombras y 10 de oro de soborno | Sus sobornos cuestan la mitad. Aura que oculta a los aliados adyacentes |
| 2 | Maestros de los Colegios | Dolbred | Torre de magia, escuela arcana 3 y 10 de maná | Ver abajo |
| 2 | El Ceniciento | Osses | Escuela de muerte 3, 10 de Ánima y un aliado caído en esa guerra | Habilidad de Ceniza Coronada: alza una vez a la unidad aliada caída más fuerte con 2 de vida. Cuando muere un aliado cercano aparece una Legión de huesos gratis (máximo 1 por turno) |
| 2 | El Vigilante (invento) | Asmodeo | Catedral en la ciudad y 3 casillas consagradas | Consagra las casillas que pisa. Los aliados cercanos ignoran el primer golpe de cada turno |
| 2 | Kirin (lore) | Seosan | Dojo y 3 duelos ganados | Ataque eléctrico en línea. Los enemigos que golpea no pueden retirarse ese turno |
| 2 | Ebonrabia (lore) | Okran | Círculo de Huesos y 3 bajas sin perder una unidad | Furia ampliada (tope de +5). Se cura al matar |
| 2 | Capitana Dientesal (invento) | Pelgiria | Puerto propio y haber saqueado 2 ciudades | «Andanada de barriles»: 3 de daño en 3x3. «Limonada de a bordo»: cura 3 a los aliados cercanos |
| 2 | Zaphar, primer vástago (invento) | Mravec | Haber devorado 5 enemigos | Devora y adapta sin tope. Los rasgos de los muertos se suman a él |
| 2 | Legada Orsa Valcarón (invento) | Balutia | Controlar 3 regiones | El Tributo da una tropa de nivel superior. Los aliados de provincias ganan +1 de defensa |
| 3 | Rykerd, El Imperdonable (lore) | Hijos del Acero | Cuatro condiciones, ver abajo | Temible, Rencor, +2 contra monstruos, Contención |

### Dolbred: los tres Colegios

Las tres escuelas de magia de la Academia se llaman Colegios. No se confunden con la Cátedra de Ceniza de Osses. Al empezar la guerra el juego sortea un candidato por Colegio. Ves los tres que salen y puedes invocar uno.

| Colegio | Candidatos | Aspecto | Efecto |
|---|---|---|---|
| **Brasa Viva** (ataque) | Ilvaren Brasalba, o Konnovan (lore, zorro de fuego) | Elfo de fuego, melena y túnica a medio arder. O el zorro | Alcance 3. Activa «Pira»: 3 de daño en 3x3 cada 4 turnos |
| **Humores** (apoyo) | Maese Croacio Verruguilla, o el Decano de los Fundamentos (lore) | Hombre sapo pequeño con máscara de doctor de la peste y maletín de ampollas. O el Decano | +2 de maná por turno. Activa «Triaca»: cura 4 a todos los cercanos |
| **Umbral** (defensa) | Custodia Aldenvar, o Ysolde Vaelward (guardiana de Vaelmoot) | Anciana alta con armadura de pergaminos rúnicos y un grimorio como escudo. O la guardiana | +2 de defensa a los adyacentes. Activa «Muro de runas»: bloquea una casilla 2 turnos |

### Rykerd, el más difícil

Debe cumplir los cuatro requisitos a la vez:

1. Una **fortaleza capturada**, que hace de Fuerte Desdén.
2. Haber **cazado 3 criaturas salvajes**.
3. Escuela militar 3 y un edificio nuevo, la **Perrera de Cadenas** (6 de mineral, 4 de materiales).
4. **Pagar** 12 de oro, 8 de mineral, 6 de comida y 4 de Ánima, y estar al menos en el turno 8.

Estadísticas aproximadas: 30 / 6 / 3 / 3 / 1.

- **Temible:** los enemigos adyacentes pierden 1 de ataque.
- **Rencor:** +2 de ataque cada vez que muere un aliado (como en la carta).
- **+2 contra monstruos**, por la ventaja del ejército.
- **No muerto:** no gasta comida.
- **Contención:** si cae el Maestro Cazador, Rykerd se desata y ataca a la unidad más cercana, de cualquier bando, durante 3 turnos. Pasados los tres turnos vuelve a obedecer.

La Contención es lo que pasa después de invocarlo. No es un requisito.

## 6. Curvas de poder

La idea de fondo: no todos los ejércitos son fuertes en todo momento de la guerra. Hay estrategias claras contra cada uno, por ejemplo atacar pronto a quien necesita tiempo, o aguantar a quien se agota. No se busca un 50 % de victorias idéntico para todos.

La curva sale de las propias mecánicas. No se aplican bonificaciones ni penalizaciones por llegar a cierto turno.

| Tipo | Ejércitos | De dónde sale la fuerza | Cómo se contrarresta |
|---|---|---|---|
| Temprana | Compañía Dorada, Okran, Nikaalia | Oro inicial, Furia, sigilo y sobornos | Aguantar el primer empuje. Los rivales desarrollan defensas y economía |
| Tardía | Dolbred, Nernib, Mravec | Tecnología, producción y adaptaciones | Presionarlos antes de que acumulen |
| Desgaste | Osses | Las bajas dan Ánima | No alimentarlo con bajas y destruir sus fuerzas antes de que acumulen |
| Pico | Hijos del Acero, Balutia | Rykerd preparado, conquistas en cadena | Cortar la expansión o matar al Maestro Cazador |
| Situacional | Seosan, Pelgiria, Asmodeo, Brurland | Duelos y composición, el agua del mapa, el territorio consagrado, las fortalezas | Elegir el campo de batalla y la formación |

Reglas de diseño:

- Un ejército débil al inicio siempre debe tener algo que hacer (defender, expandirse, investigar).
- El reloj de 35 turnos es una regla común a todos. Los ejércitos tardíos deben alcanzar su fuerza hacia el turno 20 o 25. Si su pico llega después, no se pueden jugar.
- Los requisitos de los héroes son difíciles pero comprensibles y alcanzables.

### Medición

Un script que enfrenta N partidas por emparejamiento, en ambos lados, con mapas y posiciones iniciales variados. Mide:

1. **Resultados:** victorias, derrotas y empates, y cómo termina cada guerra.
2. **Estado de la guerra** en turnos fijos (6, 12, 18, 24 y 35): territorio, ciudades, economía, tecnología y unidades supervivientes.
3. **Condición de victoria** y recursos que le quedan al vencedor.

No se mide la victoria por la duración de la partida, porque confunde el poder de un ejército con lo que tarda en cerrar. No hace falta probar los 78 emparejamientos antes de seguir desarrollando: pruebas de humo, enfrentamientos representativos y simulaciones repetidas de los que parezcan más desequilibrados.

## 7. Interfaz e IA

- La portada pasa a trece tarjetas en cuadrícula, con la etiqueta de la curva del ejército («Empieza fuerte», «Tardío», «Depende del mapa»).
- En la ciudad, un botón «Invocar héroe» con la lista de requisitos.
- La IA necesita un perfil por curva (agresiva pronto o constructora), saber invocar héroes y usar pólvora (recarga), devorar y sigilo.
- Cada ejército necesita su lista de nombres y apellidos (13 culturas).

## 8. Datos guardados y compatibilidad

- **Identificadores:** se conservan los seis actuales. `peregrinos-del-alba` se trata como alias de `santos-de-asmodeo`.
- **Ejércitos guardados:** `fractura_ejercitos` se indexa por usuario y facción. Al cargar un ejército de `peregrinos-del-alba`, se escribe una vez con el nuevo identificador y se borra el antiguo. Si existieran los dos, se conserva el nuevo y no se pisa.
- **Soldados:** conservan su clase base. Cambian solo el nombre y el dibujo que se muestran según el ejército.
- **Historial** (`fractura_guerras`): los textos antiguos se mantienen. El nombre se resuelve con el alias.
- **Versión de reglas:** cada guerra lleva un número de versión de reglas. Una guerra empezada con una versión antigua se reproduce con las reglas y datos de esa versión. Se conserva una copia congelada de los datos de los seis ejércitos actuales. Sin esto, una partida ya empezada, o una entre jugadores, no daría el mismo resultado al reproducirla.
- **Guerra en curso del navegador:** si existe al actualizar, se termina con las reglas antiguas.
- **SQL:** puede que no haga falta cambiar el esquema. Se confirma antes de empezar, mirando qué hay en las tablas reales.

## 9. Orden de trabajo

0. **Base común:** tabla de tropas por ejército, versión de reglas, alias de identificadores, sistema de invocación con requisitos, piezas de arte intercambiables y listas de nombres.
1. **Prueba vertical: Brurland contra Osses**, con Adam y el Ceniciento, de principio a fin. Tropas, invocación, guardado, partida contra la IA y repetición de una partida entre jugadores. No se abre el resto hasta que esto funcione.
2. **Bloque 1:** Dolbred, Compañía, Hijos del Acero (con Rykerd) y Santos de Asmodeo, y la migración de los Peregrinos.
3. **Bloque 2:** Okran, Balutia, Seosan, Nikaalia (con pólvora).
4. **Bloque 3:** Pelgiria, Mravec, Nernib, que tienen las mecánicas más raras y pueden tocar el motor (navegar, devorar, taller).
5. **Equilibrio:** simulaciones tras cada bloque, empezando por los ejércitos nuevos y los que tengan ventajas económicas acumulativas.

El arte no bloquea el sistema. Primero cada unidad tiene una representación coherente con su ejército y su rol, y después se añaden los retratos especiales de los héroes y las unidades emblemáticas. Calculo unos 40 retratos y figuras de tablero nuevos entre tropas y héroes. Con las piezas intercambiables sale bastante menos.

## 10. Decisiones tomadas y abiertas

Cerradas:
- Un héroe por ejército. Selenia y Behemoth no entran como héroes.
- Okran invoca a Ebonrabia, de la familia del Behemoth.
- El sacerdote de Asmodeo se llama Consagrador y conserva el rol de curación.
- Brurland tiene magia, más rudimentaria que la de Dolbred.
- Hay armas de fuego, equilibradas con recarga y perforación parcial.
- Solo tres tropas de Mravec devoran y adaptan.

Abiertas, con mi valor por defecto:
- Los nombres inventados (Don Ottavio Umbral, Capitana Dientesal, Zaphar, Legada Orsa Valcarón, El Vigilante, y los de los Colegios) se pueden cambiar.
- Las estadísticas de las exclusivas nuevas y de los héroes son provisionales y se ajustan con las simulaciones.
- Selenia y Behemoth podrían ser jefes neutrales en algún tipo de Fractura más adelante. No entra en este plan.

## 11. Retención y bucle entre guerras

Ideas aprobadas el 30-oct-2026. Todas son plan, nada está programado. Objetivo: que cada guerra deje algo que contar y una decisión que tomar, y que el jugador quiera «una guerra más».

**Los premios en cartas quedan fuera por ahora.** Nada de esta sección da cartas. El premio actual por ganar contra la IA no cambia. Cómo ganar cartas con estos sistemas se decide más adelante.

### Bucle de después de la guerra

1. **Un momento garantizado.** Al cerrar cada guerra, el soldado con más peso narrativo (más guerras, heridas y vínculos) vive algo concreto: salva a otro, sobrevive por poco, hereda una reliquia, es ascendido. No es al azar puro. Los textos deben ser llanos y concretos, sin tono grandilocuente, y se revisan a mano.
2. **Una decisión con coste.** Ejemplo: un veterano queda convaleciente y eliges entre retirarlo a la reserva, forzarlo a volver (riesgo de morir) o darle el mando de una compañía (sube pero no combate). Se suman a las que ya existen (especialización del veterano, quién hereda una reliquia, capitanes).
3. **Evaluación S/A/B** de cada guerra, según bajas sufridas, eficiencia y turnos usados. Hay que definir bien qué mide para que no se pueda «cultivar».

### Némesis activo

- **Tablón de caza:** lista visible de tus némesis vivos, con nombre, facción, dónde aparecieron y qué te quitaron. Cada uno lleva una recompensa (una reliquia, oro o un rasgo para quien lo mate).
- **Deuda de sangre:** si un némesis mata a 3 de los tuyos, sube de rango y pasa a ser un mini jefe con botín garantizado.
- **El ciclo:** al matar a uno, su hijo o hermano aparece más tarde con +1.

### Botín y descubrimientos

- **Pity visible en las ruinas:** cada ruina saqueada sin reliquia suma un 5 % a la siguiente, y el contador se ve. Persiste entre guerras en el ejército y entra en la configuración de la guerra al empezar.
- **Casi narrado:** cuando sale un recurso en vez de una reliquia, el texto lo cuenta («entre los escombros ves el hueco vacío de un pedestal»). Solo en el texto de las ruinas, no en los premios de cartas.
- **Un hallazgo con nombre por guerra:** una reliquia, una criatura con nombre propio y trofeo (enlazada con el bestiario), una región secreta o un suceso único.

### Antes de la guerra: contratos

La pantalla de preparar ofrece 3 contratos con riesgo y recompensa crecientes:

| Contrato | Condición | Recompensa |
|---|---|---|
| Seguro | Sin riesgo añadido | Una reliquia garantizada |
| Arriesgado | Los heridos no se curan entre guerras | Doble de botín |
| De sangre | Sin reclutas de relleno | Invocas al héroe sin cumplir los requisitos de partida (sigues pagando su coste). No vale para Rykerd |

Las recompensas de los contratos no son cartas.

### Dentro de la partida

- **Rachas:** una unidad que mata a 2 enemigos en un mismo turno gana +1 de ataque hasta el final de su próximo turno, y con 3 gana +2 (tope). Es por unidad, no por ejército, y va acompañada de un efecto visual y sonoro.
- **Remontada explícita («la Fractura se apiada de los caídos»):** si un bando va muy por detrás en puntuación, recibe una vez por guerra una ayuda a elegir entre tres (una unidad extra con la mitad de estadísticas junto a su capital, Ánima o curar a todos). Se activa por diferencia de puntos, no por turno, así que no borra las curvas de poder de cada ejército. Es la regla más delicada del plan: las simulaciones tienen que confirmar que no aplana las diferencias entre ejércitos, y si lo hace se endurece o se quita.

### Apego y progresión de cuenta

- **Herencia con rasgo:** si el hijo hereda la reliquia de su padre, gana +1 a una característica (respetando el tope de 10) o un rasgo único.
- **Prestigio de casa:** con 3 generaciones, la casa recibe un título y un estandarte propio. Con 20 victorias de la casa, +1 al máximo del contingente (con tope de +2 en total entre todas las casas).
- **Renombrar:** se puede renombrar a un soldado una vez, o ponerle un apodo propio.
- **Códice:** siluetas de las reliquias no halladas, bestiario con las criaturas aún sin matar y árbol de casas con huecos, con porcentaje de completado.
- **Logros con barra de progreso** (50 guerras, 10 casas, 5 némesis muertos, primera Leyenda, 3 generaciones…). Ninguno binario.

### Retención diaria y social

- **Fractura del día:** una guerra al día con semilla fija. Mismo mapa, mismo rival y un ejército preparado igual para todos, un solo intento. Hay ranking diario. Como el motor corre en el navegador, la clasificación es fácil de falsear. Para que valga hay que **comprobarla en el servidor** reproduciendo las acciones con el mismo motor (el Hipódromo ya usa una función de servidor con el código fijado a una versión). Requiere SQL y esa función.
- **Liga de duelos:** temporadas de 2 semanas. El ascenso y descenso de división solo tiene sentido con 8 jugadores o más. Con menos, una sola clasificación de temporada por victorias.
- **Avisos por Discord:** el bot ya envía avisos. Se añaden «es tu turno en tu duelo» y «tu soldado ha vuelto herido», y un resumen semanal de la crónica del mundo (el bot ya tiene uno hecho, sin desplegar).

### Cuándo se hace cada cosa

| Grupo | Qué incluye | Depende de |
|---|---|---|
| R1, sin cambiar reglas | Tablón de némesis, Códice y logros, renombrar, S/A/B, avisos de Discord, momento y decisión de después de la guerra | Nada. Se puede hacer en paralelo con la base común |
| R2, cambia reglas | Pity, contratos, rachas, remontada, herencia con rasgo, prestigio de casa | La **versión de reglas** del plan, para no romper partidas guardadas |
| R3, necesita servidor | Fractura del día y liga | SQL y la función de servidor. Y que haya jugadores suficientes para que merezca la pena |

La interfaz de cada una espera al rediseño visual que está en otra sesión.
