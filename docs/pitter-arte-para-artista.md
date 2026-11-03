# Pitter-Patter: lista de piezas de arte para un artista

Todo lo que hoy se ve en el juego está dibujado por código como sustituto provisional. Este documento lista **cada pieza que hay que reemplazar**, con su tamaño, su uso y qué detalles importan. Está pensado para pasárselo a quien dibuje.

**Estilo de referencia:** *JoJo's Pitter-Patter Pop!* (chibis de cabeza grande, contorno oscuro grueso, colores planos y vivos, sombreado simple, mucha expresión). La paleta de la interfaz es violeta oscuro, rosa, crema y turquesa. Contorno común: `#2a1545`.

## Cómo entregar

- **PNG con fondo transparente**, salvo donde se diga lo contrario.
- Los tamaños son los **de diseño**. Conviene entregar al **doble** (×2) para pantallas grandes; el juego reduce sin problema. Si una pieza se agranda en el juego (por ejemplo el chibi en un bloque grande), el doble es lo mínimo recomendable.
- Nombrar los archivos con el **id** que aparece en las tablas (por ejemplo `bull.png`, `kobold.png`).
- Hoy el juego solo carga arte definitivo para **personajes y jefes** (`assets/pitter/manifest.json`). Para el resto de piezas basta con entregar los PNG con los nombres de esta lista: yo conecto cada una al juego cuando lleguen.

---

## 1. Personajes jugables (16)

Cada uno necesita **un chibi de cuerpo entero**. De ese mismo dibujo salen la ficha del tablero, el retrato de la colección y el retrato de los diálogos, así que **la cabeza debe quedar en el 60 % superior** y verse bien recortada.

| Pieza | Tamaño de diseño | Notas |
|---|---|---|
| Chibi de cuerpo entero | **256 × 320 px** (proporción 4:5) | De frente, pies tocando la base, fondo transparente. El juego lo anima solo (respira, camina, salta, se agranda). |
| Ficha del tablero | **160 × 160 px** | Cuadrado con el **color del personaje** de fondo y su cara. Se muestra a unos 85 px. Si no se entrega aparte, la saco del chibi. |
| Retrato (colección, resultados, diálogos) | **256 × 256 px** | Solo cabeza y hombros, fondo transparente. Si no se entrega aparte, lo saco del chibi. |

**Expresiones opcionales** (hoy el juego usa 5 por personaje; si se dibujan, mejor; si no, se deducen de la base): `idle` (reposo), `blink` (ojos cerrados), `feliz`, `dolor`, `poder` (pose de habilidad, también se usa agrandada en los bloques grandes del tablero).

| id | Personaje | Color de la ficha |
|---|---|---|
| `bull` | Bull | `#3f8cff` |
| `garra` | Garra | `#ff8a2a` |
| `baraja` | Baraja | `#18c4b8` |
| `ocevat` | Ocevat | `#2f6fe0` |
| `verdam` | Verdam | `#f0603a` |
| `gareth` | Gareth | `#8a6a3c` |
| `ceniza-coronada` | Ceniza Coronada | `#46c27c` |
| `rook` | Rook | `#ffb02e` |
| `dagren` | Dagren | `#ff5252` |
| `sir-buffolet` | Sir Buffolet | `#38d9ee` |
| `edge` | Edge | `#a46cff` |
| `torvrena` | Torvrena | `#e3a23a` |
| `ryn` | Ryn | `#2dd4c8` |
| `hooey-magoo` | Hooey Magoo | `#ff6b8a` |
| `cassius-coldgrave` | Cassius Coldgrave | `#ff7f50` |
| `adam-kovacs` | Adam Kovacs | `#5a8dff` |

Cada color tiene que seguir siendo **distinguible de los demás** en el tablero (seis personajes a la vez). Ahora los muñecos provisionales llevan un gorro del color de su afinidad; el dibujo real manda.

### Personajes por piezas (el formato que más se parece al original)

Es mejor entregar cada personaje **en piezas sueltas**, con cada pieza en su sitio en un lienzo de **1000 × 1000 px** y fondo transparente. Así se puede animar de verdad (respirar, caminar, saludar, sentarse, dormir) en vez de mover una sola imagen. Las que ya tenemos de Cassius Coldgrave son: pelo de atrás, capa, piernas, brazo izquierdo, brazo derecho, torso, cabeza y sombrero.

Para replicar las animaciones de los personajes originales **faltan**, por personaje:

| Pieza o pose que falta | Para qué |
|---|---|
| **Su Stand como sprite aparte** (en el archivo original se llama «Hol Horse & Emperor» pero Emperor no viene) | Aparece junto al personaje al usar la habilidad y en el Stand Up Time. |
| **Cara por emociones**: ojos y cejas (feliz, enfadado, dolor, sorpresa, dormido), y boca abierta o sonriendo | Hoy la cara es una sola y los ojos quedan tapados por la sombra del sombrero. |
| **Piernas separadas** (izquierda y derecha, con bota) y un **pelvis/cinturón** aparte | Ciclo de caminar y correr, sentarse, saltar. |
| **Pose sentado** y **pose tumbado** (dormido) | Las habitaciones: dormir en la cama, sentarse en el sillón. |
| **Brazos en dos o tres piezas** (brazo, antebrazo, mano) | Saludar, señalar, llevarse la mano al sombrero. |
| **Manos alternativas**: abierta, saludando, pulgar arriba, **pistola apuntando de frente**, tocando el ala del sombrero | Cada animación pide una mano distinta. Ahora solo hay un puño y una pistola hacia abajo. |
| **Pluma del sombrero aparte** y **ala delantera aparte** | Balanceo al caminar y levantar el ala. |
| **Faldones del poncho** izquierdo y derecho | Movimiento al correr y al saltar. |
| **Cara dañada** (golpeado, aturdido) y **vista de victoria** (pose con los brazos arriba) | Resultados de la partida. |
| **Retrato grande de corte** (busto de frente, unos 1200 × 1600 px) | Aparece al usar la habilidad, como en el original. |

La **pose de Hol Horse** de Cassius (la mano derecha en forma de pistola) ya viene en las piezas. Lo que le falta para que se vea completa es la pistola de la mano y el Stand.

## 2. Jefes (8)

| Pieza | Tamaño de diseño |
|---|---|
| Un PNG cuadrado por jefe, de frente, pies abajo | **512 × 512 px** |

Ids: `kobold`, `dragarto`, `protodraco`, `basilisco`, `hidra`, `behemoth`, `kraken`, `dragon-de-magma`. Se ven pequeños (unos 140 px de alto) en la tarjeta del jefe y más grandes al caer. Son criaturas del bestiario público de la campaña.

## 3. Fichas especiales del tablero

| id | Qué es | Tamaño |
|---|---|---|
| `bloque1`, `bloque2`, `bloque3` | Bloque que pone un jefe. Tres estados de daño (3 = recién puesto, 1 = a punto de romperse). | **160 × 160 px** |
| `caja` | Caja que deja un grupo de 6 o más. Se toca para limpiar cinco fichas en cruz. Tiene que parecer algo que se toca. | **160 × 160 px** |
| `hielo` | Capa translúcida sobre una ficha congelada (no se puede mover). | **160 × 160 px**, transparente |
| `tinta` | Mancha que sustituye a la ficha y la oculta con una interrogación. | **160 × 160 px** |

## 4. Bloque grande de un grupo

Cuando se junta un grupo, las fichas se funden en **una sola pieza grande** con el personaje. Hoy sale del chibi `poder` agrandado sobre un rectángulo de su color. Si se quiere arte propio, hacen falta:

| Pieza | Tamaño | Notas |
|---|---|---|
| Marco del bloque (rectángulo redondeado) | **9-patch, mínimo 96 × 96 px** | Contorno oscuro, brillo arriba, que aguante cualquier proporción de 2×2 a 4×3 casillas. |
| Chibi en pose de ataque por personaje | **512 × 640 px** (el doble del chibi) | Lo mejor es una pose `poder` pensada para verse enorme. |
| Aura (anillo de brillo) | **256 × 256 px**, blanco y transparente | Se tiñe del color del personaje. |

## 5. Iconos

**Afinidades (6)**, usados en tarjetas y marcos. Mono-color blanco, **96 × 96 px**: `escudo` (Juramento), `luna` (Sombra), `gota` (Carne), `estrella` (Arcano), `aro` (Eternidad), `flecha` (Cacería).

**Iconos de menú (7)**, **96 × 96 px**, a color con contorno `#2a1545`: `libro` (Colección), `espadas` (¡Batalla!), `equipo`, `regalo`, `copa` (Récords), `mueble`, `ayuda`.

Los botones, paneles, medidores y barras están hechos con CSS (paleta: tinta `#2a1545`, crema `#fff6e5`, rosa `#ff4f9a`, violeta `#7a4cff`, turquesa `#1ed7c8`, amarillo `#ffd23f`, azul `#3d8bff`, verde `#4fdc7a`, rojo `#ff5252`). No hay que dibujarlos salvo que se quiera rehacer el estilo.

## 6. La mansión (menú)

Es un edificio de **8 lados** con 3 pisos de 8 habitaciones, visto en 3D desde fuera. Cada pieza se pega sobre una cara del edificio; se deforma en perspectiva, así que hay que dibujarlas **planas y de frente**.

### 6.1 Fachada de un piso

| Pieza | Tamaño de diseño | Notas |
|---|---|---|
| `fachada-ladrillo` | **640 × 370** (800 × 463 px) | Pared de ladrillo con el hueco de la habitación **en el centro**: hueco de 560 × 290 con 40 de marco a los lados, 56 arriba y 24 abajo. El hueco se recorta por código, el dibujo debe llegar hasta el borde interior. Se repite por todas las habitaciones. |
| `fachada-puerta` | **560 × 290** (700 × 363 px) | La puerta que tapa una habitación cerrada, con candado. Debe llenar el hueco entero. |

### 6.2 Planta baja (3 variantes)

Tres paredes de **640 × 170** (800 × 213 px). El juego las alterna alrededor del edificio y la primera lleva la entrada.

| id | Qué lleva |
|---|---|
| `base-puerta` | Puerta grande de dos hojas con arco y escalón. |
| `base-ventanas` | Ventanas con postigos y una maceta. |
| `base-macetas` | Una ventana y varias macetas. |

### 6.3 Tejado (2 variantes)

Dos caras de **640 × 250** (800 × 313 px). Cada cara es un trapecio inclinado: la parte de arriba (el remate) se estrecha hasta un **30 %** del ancho, así que lo importante conviene dibujarlo en la mitad de abajo.

| id | Qué lleva |
|---|---|
| `techo-tejas` | Tejas naranjas. |
| `techo-buhardilla` | Tejas con una buhardilla y su ventana. |

### 6.4 Entorno

| id | Tamaño | Notas |
|---|---|---|
| `fondo-jardin` | **2560 × 1080** (3200 × 1350 px) | Atardecer violeta-rosa con colinas, árboles y flores. Detrás del edificio; el centro lo tapa el edificio. |
| `marco-habitacion` | **2560 × 1080** | Fachada de ladrillo con tejado y buhardilla que rodea a la habitación en su pantalla, vista de cerca. El hueco central (1312 × 665 px, empieza en x 624, y 252) debe quedar **transparente**. |

## 7. La habitación por dentro (4 temas)

Cada habitación es una **caja** con 5 caras que se proyectan en perspectiva. Hay **4 temas** de decoración: `rombos` (morado), `verde` (botella), `mandarina`, `noche` (estrellas). Cada tema necesita **estas 5 caras**, planas y de frente:

| Cara | Tamaño de diseño | Tamaño recomendado | Notas |
|---|---|---|---|
| `fondo` | 560 × 290 | 700 × 363 px | Pared del fondo (la que se ve de frente). |
| `izquierda` | 520 × 290 | 650 × 363 px | Pared izquierda. **Izquierda del dibujo = junto a la pared del fondo**, derecha = junto al hueco. |
| `derecha` | 520 × 290 | 650 × 363 px | Pared derecha. **Izquierda del dibujo = junto al hueco**, derecha = junto a la pared del fondo. |
| `suelo` | 560 × 520 | 700 × 650 px | Arriba del dibujo = fondo de la habitación, abajo = junto al hueco. |
| `techo` | 560 × 520 | 700 × 650 px | Igual que el suelo. |

Detalles que hoy tiene cada cara y se pueden conservar o cambiar: estantería verde en el fondo, cuadro en la pared izquierda, ventana con celosía en la derecha, alfombra en el suelo, luces de riel en el techo. Los bordes llevan un contorno oscuro de unas 4 unidades.

Además, en la pantalla de una habitación (más grande) se ve el **diorama plano** de la misma habitación: **1500 × 760** (1875 × 950 px) por tema, con la perspectiva ya dibujada. Si se hace arte nuevo, esta pieza también hay que rehacerla: es la que sustituye a las 5 caras cuando se está dentro.

## 8. Muebles (8)

Cada mueble es un PNG con fondo transparente, **con 10 unidades de margen** a cada lado. Los de suelo se apoyan en la base; el cuadro cuelga. El color de acento cambia según el tema de la habitación (en el dibujo conviene que ese color sea una zona fácil de teñir).

| id | Mueble | Tamaño de diseño (con margen) | Recomendado |
|---|---|---|---|
| `cama` | Cama | 380 × 240 | 475 × 300 px |
| `mesa` | Mesa de dados | 320 × 240 | 400 × 300 px |
| `planta` | Planta | 170 × 280 | 213 × 350 px |
| `lampara` | Lámpara | 140 × 320 | 175 × 400 px |
| `sillon` | Sillón | 280 × 220 | 350 × 275 px |
| `estante` | Estante | 260 × 360 | 325 × 450 px |
| `alfombra` | Alfombra | 400 × 110 | 500 × 138 px |
| `cuadro` | Cuadro | 190 × 220 | 238 × 275 px |

## 9. Fondos de combate (6 escenarios)

Un fondo por tipo de escenario, **2560 × 1080 px**, sin personajes. El centro lo ocupa el tablero (un cuadrado), así que lo importante va a los lados y arriba. Cielo arriba, suelo abajo.

| id | Se usa en |
|---|---|
| `prado` | Kobold |
| `ruinas` | Dragarto |
| `volcan` | Protodraco y Dragón de Magma |
| `pantano` | Basilisco e Hidra |
| `cueva` | Behemoth |
| `mar` | Kraken |

## 10. Diálogos de las habitaciones

Cuando un personaje habla al entrar en su habitación, sale una **tira de papel rasgado** que cruza la pantalla, con el retrato asomando por un lado, como en *Pitter-Patter Pop*.

| Pieza | Tamaño | Notas |
|---|---|---|
| `tira-dialogo` | **1500 × 220 px**, 9-patch horizontal | Papel rasgado arriba y abajo, ligeramente inclinado. Tonos azul pizarra o violeta apagado. Sin texto. |
| Retrato (el de la sección 1) | 256 × 256 px | Se coloca sobresaliendo de la tira por la izquierda o por la derecha. |

## 11. Efectos de partículas (3)

| id | Tamaño | Qué es |
|---|---|---|
| `estrella` | **64 × 64 px** | Destello de cuatro puntas (borrado de fichas, chispas). Blanco, se tiñe. |
| `punto` | **32 × 32 px** | Luciérnaga o polvo suave. Blanco con degradado a transparente. |
| `brillo` | **96 × 96 px** | Mancha de luz redonda. Se usa como aura y bola de ataque. Blanco, se tiñe. |

## 12. Pantalla de título

| Pieza | Notas |
|---|---|
| Logotipo `PITTER-PATTER` | Hoy es texto con contorno. Si hay logotipo propio: PNG transparente, **1600 × 400 px**, con el guion entre palabras en otro color (hoy amarillo). |

## 13. Audio (no es arte, pero también es provisional)

- **Música:** ya son las canciones de `assets/musica/` que eligió el DM. No hace falta nada.
- **Efectos:** están sintetizados con código (mover, borrar, caja, habilidad, Stand Up, victoria, derrota). Si se quiere sonido definitivo, pedir **WAV/OGG cortos** con estos nombres: `clic`, `hover`, `atras`, `mover`, `agarrar`, `soltar`, `agachar`, `borrar` (varios, sube con el combo), `caer`, `caja`, `habilidad`, `cargada`, `standUp`, `estalla`, `aviso`, `invalido`, `mueble`, `desbloqueo`, `reloj`, `victoria`, `derrota`.

---

## Resumen de cantidades

| Bloque | Piezas |
|---|---|
| Chibis (cuerpo entero) | 16 (+ hasta 64 expresiones si se dibujan) |
| Fichas y retratos | 32 (si se dibujan aparte) |
| Jefes | 8 |
| Fichas especiales | 6 |
| Bloque grande | 3 (marco, aura, 16 poses si se dibujan) |
| Iconos | 13 |
| Mansión | 2 (fachada) + 3 (planta baja) + 2 (tejado) + 2 (entorno) = 9 |
| Habitación, por tema | 5 caras + 1 diorama = 6 × 4 temas = 24 |
| Muebles | 8 |
| Fondos de combate | 6 |
| Tira de diálogo | 1 |
| Partículas | 3 |
| Logotipo | 1 |
