# La Fractura: plan para las reglas 5

Acordado con el usuario el 17-nov-2026. Todo se hace de una vez y sube junto, con `D.REGLAS = 5`. Las guerras guardadas y las mesas en curso de reglas anteriores dejarán de cargarse: avisar antes de subir.

Orden de las fases: cada una se apoya en las anteriores. Al acabar cada fase, correr las pruebas (ver «Pruebas») antes de seguir.

---

## Fase 1. Órdenes de las tropas

Seis órdenes que la tropa cumple sola cada turno, con la lógica de la máquina (`js/fractura-ia.js`):

| Orden | Qué hace | Cuándo se corta (y avisa) |
|---|---|---|
| Explorar | Va hacia lo que no ve, evita peleas | Ve un enemigo más fuerte o le queda poca vida |
| Defender | Se queda junto a una ciudad o casilla y ataca lo que se acerque | Nunca, hasta que se quite |
| Conquistar | Marcha hacia la ciudad elegida y la asedia | La toma o queda muy herida |
| Matanza | Busca al enemigo más cercano o más débil y lo ataca | Queda muy herida |
| Reforzar | Va al punto de reunión de su ciudad | Al llegar pasa a Defender |
| Curarse | Vuelve a la ciudad más cercana | Sana: vuelve a su orden anterior |

- Datos: `u.orden = { tipo, x, y, ciudad, anterior }`. No entra en `FM.firma` (no cambia reglas).
- IA: funciones `ordenExplorar`, `ordenDefender`, `ordenConquistar`, `ordenMatanza`, `ordenReforzar`, `ordenCurarse` que devuelven acciones normales (`mover`, `atacar`, `habilidad`). Así valen en las mesas sin tocar el servidor.
- Ejecución: al pulsar «Terminar turno», antes de pasar, se cumplen las órdenes una a una con su animación. Las tropas con orden no cuentan en «sin órdenes».
- Interfaz: botones de orden en la tarjeta de la tropa (las que piden destino entran en modo de elegir casilla), icono de la orden sobre la ficha en el tablero (`app/src/fractura/escena.ts`), aviso cuando una orden se corta.
- Selección de varias tropas: arrastrar una caja con Mayús para dar la misma orden a todas.
- Mesas: la orden se guarda en el estado local; si se reconstruye la guerra desde el servidor, se pierden (aceptable, avisarlo en la ayuda).

## Fase 2. Retaguardia

1. Punto de reunión: `ciudad.reunion = { x, y }` o el id de otra ciudad. Lo que entrena esa ciudad sale con la orden Reforzar. Se marca desde el panel de la ciudad.
2. Caminos propios: moverse por casillas de provincias propias cuesta la mitad (redondeando hacia arriba, mínimo 1). Cambiar `alcanzables` en `js/fractura-motor.js`.
3. Portal de ciudad (edificio nuevo `portal`):
   - Pide la ciudad en su nivel máximo y un escalón IV o más en alguna rama del saber.
   - Cuesta unos 20 de maná, 20 de oro y 10 de mineral.
   - Nombre por ejército en `edificiosNombre` (Puerta del Reino, Círculo de Traslación, Puerta de Ceniza, etc.).
   - Acción `{ t: "portal", uid, de, a }`. Cuesta 4 de oro y 2 de maná por tropa; el doble para tropas pesadas y héroes. La tropa llega sin movimiento.
   - Una tropa por portal y turno. No funciona si la ciudad de salida o la de llegada está sitiada o tiene un enemigo al lado.
   - La IA lo usa para llevar tropas al frente y a su héroe a otro continente.

## Fase 3. Recursos

1. Administración: las tres primeras ciudades no cuestan. Desde la cuarta, cada una cuesta 1 de oro más que la anterior (4.ª: 1, 5.ª: 2...). Se resta en `ingresoDe` y sale en el desglose del oro como «Administración».
2. Transmutación (edificio nuevo, nombre por ejército):
   - Cada ciudad que la tenga convierte hasta 6 de un recurso por turno en otro, 3 por 2. Dolbred, 1 por 1. El Ánima no se puede conseguir así.
   - Acción `{ t: "transmutar", ciudad, de, a, n }`.
3. Obras de ciudad (repetibles, se pagan, duran unos turnos). Acción `{ t: "obra", ciudad, id }`:
   - Fortificar: +2 de defensa en la ciudad 3 turnos.
   - Fiesta: +2 al límite de tropas y más curación en la ciudad 3 turnos.
   - Levas: la ciudad entrena dos tropas este turno.
   - Vigías: la ciudad ve más lejos 3 turnos.
4. Medir antes y después: añadir a `tools/probar-fractura.js` cuántos recursos quedan sin gastar al final, por tamaño de mapa. El objetivo es que en mapas grandes no se acumulen.

## Fase 4. Sanadores en todos los ejércitos

Una clase de sanador por ejército (el Peregrino de los Santos se queda como está). Generalizar la curación de `iniciarTurno` (hoy mira `w.clase === "sanador"`) a un campo `cura` de la clase, con variantes:

| Ejército | Sanador | Particularidad |
|---|---|---|
| Caballeros | Capellán | Normal |
| Dolbred | Alquimista de los Humores | Cura y da +1 de maná |
| Osses | Embalsamador | Solo recompone muertos vivientes y reanimados |
| Compañía Dorada | Barbero cirujano | Cura más, pero cobra oro |
| Hijos del Acero | Curandero de cacería | Cura más a los heridos por monstruos |
| Nikaalia | Matasanos de la familia | Normal |
| Seosan | Monje herbolario | Normal |
| Okran | Chamán | Cura en un área pequeña |
| Pelgiria | Cirujano de a bordo | Cura también a los barcos |
| Mravec | Nodriza de la colmena | Normal |
| Nernib | Mecánico | Repara autómatas y carros, cura poco a los vivos |
| Balutia | Medicus de la legión | Normal |

Con figura (`js/fractura-figuras.js`) y retrato (`js/fractura-retratos.js`) propios, nombre en `tropas` de cada ejército, la IA los mantiene cerca de los heridos.

## Fase 5. Héroes: raros y legendarios

### Rareza
- Renombre por ejército (`jug.renombre`): se gana al matar oficiales, tomar ciudades, ganar duelos y aguantar asedios.
- Para invocar: mucho renombre, un turno mínimo según el tamaño del mapa (por ejemplo turno 20 en mapa normal), su requisito propio y un coste muy alto.
- Objetivo: que salga en 1 de cada 4 o 5 guerras, casi siempre en las largas. Ajustar con simulaciones.

### Para todos
- Duelo de leyendas: cuando dos héroes se enfrentan, cámara lenta, aviso grande y línea propia en la crónica.
- Ningún golpe los mata de una vez: los deja a 1 de vida, una vez por guerra.
- Se curan 3 por turno aunque no descansen.

### Cada héroe (cifras: vida · ataque · defensa · movimiento)
- **Adam Kovacs** 52·10·6·3. Pasiva: +2 de ataque a los aliados a 3 casillas y los jinetes cerca de él cargan sin recorrer 2 casillas. Formad filas: +2 de defensa a los aliados a 2 casillas (⟳3). Por el Reino: una vez por guerra, los aliados a 3 casillas recuperan movimiento y pueden volver a atacar.
- **Mano de Oro** 48·9·5·3. Pasiva: llega con 4 mercenarios y +5 de oro por turno. Todo tiene un precio: 8 de oro, cualquier tropa enemiga sin rango a 2 casillas lucha por ti 3 turnos, nunca héroes ni líderes (⟳3). Paga doble: 6 de oro, tus mercenarios +2 de ataque este turno (⟳3).
- **Primer Engranaje** 50·8·7·3. Pasiva: llega con 4 autómatas, que tienen +2 de ataque y +1 de defensa. Reparar: 6 a todas tus máquinas a 2 casillas, barcos incluidos (⟳3). Línea de montaje: un autómata gratis que no cuenta para el límite (⟳4).
- **Doña Ottavia Umbral** 46·9·5·4. Pasiva: un soborno gratis por turno; los aliados a 2 casillas no pueden ser atacados desde lejos. Una oferta: compra 3 turnos a una criatura o a un recluta enemigo a su lado (⟳3). La noche es nuestra: ella y los aliados a 2 casillas se ocultan hasta que ataquen (⟳4).
- **Ilvaren Brasalba** 44·10·4·3, alcance 3. Pasiva: sus ataques dejan la casilla ardiendo 1 turno (2 de daño a quien entre o se quede). Pira: 6 de daño en 3×3 hasta a 4 casillas y lo deja ardiendo 2 turnos (⟳4). Muro de fuego: línea de 3 casillas ardiendo que nadie cruza 2 turnos (⟳4).
- **Maese Croacio Verruguilla** 44·8·5·3, alcance 2. Pasiva: +4 de maná por turno. Triaca: cura 8 a los aliados a 3 casillas y les quita estar frenados (⟳3). Miasma: −2 de ataque a los enemigos a 2 casillas durante 2 turnos (⟳4).
- **Custodia Aldenvar** 52·8·7·3. Pasiva: +2 de defensa a los aliados a 2 casillas. Muro de runas: 3 casillas en línea durante 3 turnos (⟳4). Sello: una ciudad tuya a 3 casillas no puede ser tomada ni sitiada 3 turnos (⟳6).
- **El Ceniciento** 50·10·5·3.
  - Pasiva: cuando muere una tropa de Osses a 3 casillas, se levanta como la tropa que era, con media vida, hasta 2 por turno. Las que no son de Osses (aliados de pacto, acogidas, desertores) vuelven como Legión de huesos. Lo levantado cuenta como reanimado (no ocupa límite), no gasta la acción del héroe y quita la tumba del caído.
  - Volved: levanta a los 3 caídos más fuertes a 3 casillas, con toda su vida (⟳6). Sigue siendo su acción del turno; si no se puede usar, el botón dice por qué.
  - Marea de ceniza: las tropas de Osses a 3 casillas, +2 de ataque y se curan 2 durante 2 turnos (⟳4).
- **El Vigilante** 52·9·6·3. Pasiva: consagra la casilla que pisa y las de alrededor; los aliados a 2 casillas ignoran el primer golpe de cada turno. Juicio: 6 de daño a un enemigo a 3 casillas, el doble contra muertos vivientes y monstruos (⟳3). Luz del alba: cura 6 a los aliados en casillas consagradas y daña 3 a los enemigos en ellas (⟳4).
- **Genichiro Nakamuro** 48·11·5·4. Pasiva: +5 de ataque contra una unidad sola; quien recibe su golpe no responde. Corte del río: golpea a todos los enemigos a su lado (⟳3). Desafío: con un enemigo a 3 casillas, nadie más puede atacarlos ni ayudarlos hasta que uno caiga o pasen 2 turnos; si gana, +2 de ataque el resto de la guerra (⟳5).
- **Ebonrabia** 56·10·5·4. Pasiva: furia hasta +7 y se cura 8 al matar. Rugido: −2 de ataque y trabados 2 turnos a los enemigos a 2 casillas (⟳4). Salto del trueno: salta a 3 casillas y golpea en 3×3 con la mitad de su ataque (⟳3).
- **Capitana Dientesal** 46·9·5·3, alcance 2. Pasiva: sus barcos a 3 casillas, +2 de ataque. Andanada de barriles: 5 de daño en 3×3 hasta a 4 casillas (⟳3). Limonada de a bordo: cura 6 a los aliados a 2 casillas, barcos incluidos (⟳3).
- **Zaphar** 50·10·5·3. Pasiva: devora y adapta sin límite. Engullir: mata a un enemigo a su lado con un tercio de vida o menos, gana su rasgo y se cura 6 (⟳3). Llamada de la colmena: 2 Obreras zapadoras a su lado que no cuentan para el límite (⟳5).
- **Reinhardt Shield** 54·9·7·3. Pasiva: cada ciudad conquistada entrega un Pretoriano mientras viva; +2 de defensa a los aliados a 2 casillas; su alabarda pega 2 más a la caballería. Muralla de escudos: hasta tu próximo turno, los aliados a 2 casillas no reciben más de 4 de daño por golpe (⟳4). Barrido: golpea a todos los enemigos a su lado, el doble a los jinetes (⟳3).
- **Rykerd, el Imperdonable** 60·11·5·3. Pasiva: −2 de ataque a los enemigos a 2 casillas; +3 de ataque por cada aliado que muere; si cae el Maestro Cazador se desata. Ira del Imperdonable: 6 de daño en una línea de 4 casillas (⟳4). Salto: a cualquier casilla a 5 sin importar el terreno (⟳3). A Rykerd se le trata como humano: nada de «dragón» en los textos.

### Trabajo
- Datos en `HEROES` (`js/fractura-datos.js`): cifras, `ef` con pasivas y `activa`/`activa2`.
- Motor: una rama nueva en la acción `habilidad` para cada habilidad nueva; casillas ardiendo (`est.fuego`), muros de 3, sellos de ciudad, desafíos; auras con radio; auto-curación; golpe que no mata; renombre.
- IA: cuándo invocar y cuándo usar cada habilidad.
- Tablero: efectos de fuego, sello, desafío y el duelo de leyendas.

## Fase 6. Rykerd, Zaphar, Ebonrabia y Primer Engranaje ocupan 2×2

- Datos: `tam: 2` en sus clases de héroe.
- Motor: `casillasDe(u)` (las 4 casillas, ancladas arriba a la izquierda); `unidadEn` mira las 4; `dist` entre unidades se mide desde la casilla más cercana; zona de control, visión, asedio y toma de ciudades desde cualquiera de sus casillas.
- Movimiento: se mueve el bloque entero. Cada paso cuesta lo que la casilla más cara de las dos nuevas. El bosque les cuesta 1 (lo pisotean); la montaña sí frena. Movimiento sin cambios. No caben por pasos de una casilla.
- Invocación: hace falta un hueco de 2×2 junto a la ciudad.
- Cruzar el mar:
  - Todos: Portal de ciudad (pagando el doble) y portales del mapa si hay sitio de 2×2 a la salida. Se pueden invocar en cualquier ciudad propia, también en otro continente.
  - Rykerd: su Salto (5) cruza el mar si cae en tierra.
  - Ebonrabia: su Salto del trueno (3) cruza canales estrechos.
  - Zaphar: puente de la colmena, avanza por el agua 1 casilla por turno y sin defensa.
  - Primer Engranaje: camina por el fondo a la mitad de movimiento; bajo el agua no ataca ni puede ser atacado.
- Tablero: figura del doble de tamaño centrada en sus 4 casillas, selección y ruta de 2×2.
- IA: rutas que entiendan el tamaño y los modos de cruzar.

## Fase 7. Figuras iguales a sus retratos

- Página de galería en `scratchpad/` con cada tropa de cada ejército: la figura del mapa al lado de su retrato.
- Revisar una a una y cambiar la figura (casco, color, arma) para que coincida con el retrato. Incluir los sanadores y los héroes nuevos.

## Fase 8. Cierre

- `D.REGLAS = 5`.
- «Cómo se juega»: secciones nuevas o ampliadas para órdenes, retaguardia y portal, administración, transmutación y obras, sanadores, héroes y renombre, gigantes.
- Códice actualizado.
- `docs/fractura-expansion.md`: sección «Reglas 5».
- Subir `?v=` en `fractura.html`.
- Avisar al usuario de que las guerras y mesas en curso se pierden con el cambio de reglas.

## Pruebas

- `node tools/probar-fractura-v4.js`: añadir casos para cada pieza nueva (órdenes, caminos, portal, administración, transmutación, obras, sanadores, habilidades de héroe, 2×2).
- `node tools/probar-fractura.js 2`: guerras enteras; añadir el recuento de recursos sin gastar y de héroes invocados por guerra.
- `node tools/probar-fractura-mesa.js 4`: mesas en varios navegadores (las órdenes no deben romper la sincronía).
- Objetivos: 0 fallos; héroes en 1 de cada 4 o 5 guerras; menos recursos sobrantes en mapas grandes.
