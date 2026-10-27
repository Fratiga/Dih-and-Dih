# Crianza: corrales y Mi habitación

Las cartas de tipo **Criatura** se pueden criar. No hay forja para ellas: se crían en los **corrales** de **Mi habitación** (`habitacion.html`).

## Reglas

- Hay **seis corrales**, uno por medio: aviario, corral del bosque, madriguera, ciénaga, cámara de hielo y cubil. Cada criatura pertenece a uno (tabla `cartas_cria_especies`).
- Un corral solo funciona con **dos copias tuyas, libres y de la misma criatura**. No se pueden usar copias de dos criaturas distintas ni copias bloqueadas por un duelo, un trueque u otra cría. Las copias se consiguen como el resto de cartas (recompensas, Buhonero, intercambios).
- Un corral guarda **una pareja a la vez**; con seis corrales, como mucho seis parejas por jugador.
- La cría pasa por **tres fases** (cortejo, gestación y cría; los nombres son de cada corral y las horas, de cada especie). Mientras dura, las dos copias están bloqueadas (referencia `cria:<id>`): no se pueden apostar, cambiar ni criar otra vez.
- Al terminar, el jugador **recoge** la cría: las dos copias vuelven a él y recibe **una copia nueva**. Sale de la reserva si hay una; si no, se emite una nueva. Respeta siempre el límite global, el límite por jugador y la etiqueta «En circulación».
- **Sobrepoblación**: si la especie ya llegó a su límite global y no queda ninguna en la reserva, no se puede empezar («Sobrepoblación de la especie: hay que respetar el medio ambiente.»). Si se llena mientras la pareja está en el corral, al recoger no nace nada, las dos copias vuelven al jugador y la cría queda como `sin_cupo`.
- Después de un nacimiento el corral **descansa** (`descanso_horas` de la especie) antes de aceptar otra pareja.
- El jugador puede **sacar a la pareja** antes de tiempo: no nace nada y se pierde el avance.
- Si por cualquier motivo las dos copias ya no estaban en el corral al recoger (un admin soltó el bloqueo, por ejemplo), la cría se cancela y no se da nada.

## Tiempos por especie (estimación inicial)

El total se reparte 20 % / 55 % / 25 % entre las tres fases y el descanso es la mitad del total. Se cambian desde **Admin → Economía → Crianza**.

| Corral | Especies (horas totales) |
|---|---|
| Aviario | Cuervo del augurio 12, Halcón Linire 18, Aeromanta 36, Guiverno 60, Zraith 96, Fénix 96, Pegaso 36, Hipogrifo 36, Grifo 60 |
| Corral del bosque | Colmillo Gris 24, Lopus 24, Perro sabio 24, Fulguepardo 36, Guillotina 48, Kirin 60, Unicornio 60, Manticora 72, Behemoth 96 |
| Madriguera | Rata 6, Kobold 12 |
| Ciénaga | Sapo Beluto 12, Hidra 72, Kraken 96, Kelpie 36, Leviatán 96, Cubo gelatinoso 24 |
| Cámara de hielo | Gelifante 72 |
| Cubil | Cocatriz 24, Dragarto 72, Protodraco 72, Draco 96, Dragón Dorado 72, Dragón de Magma 72, Dragón Ancestral 96, Basilisco 72 |

Las criaturas del segundo lote (Fénix, Pegaso, Kirin, Dragón Dorado...) entran con `docs/economia-27_corrales_ampliados.sql` (solo las que existan ya en el catálogo del servidor). Las demás criaturas nuevas del catálogo no se pueden criar hasta configurarlas (aparecen en el panel como «sin configurar»).

La pantalla de corrales solo ofrece criar las criaturas de las que el jugador tiene algún ejemplar libre, y nunca las únicas (límite global menor que 2). En el dibujo, cada hábitat tiene hasta diez sitios (`SITIOS` en `js/corrales-arte.js`), asignados por orden alfabético del id de la carta.

## Piezas

| Pieza | Qué hace |
|---|---|
| `docs/economia-18_crianza.sql` | Tablas `cartas_corrales`, `cartas_cria_especies`, `cartas_crias`; funciones `cartas_corral_ver / iniciar / recoger / sacar`, `cartas_admin_crianza`, `cartas_admin_guardar_cria`; suelta los bloqueos huérfanos de crías; y cambia el mensaje de la forja cuando no se pueden crear más objetos («No se pueden crear más objetos de este calibre.»). |
| `habitacion.html`, `css/habitacion.css`, `js/habitacion.js` | La página: escena con estantería (colección), mesa de mazos, puerta a la taberna y los seis corrales, con el estado de cada uno, un diálogo por corral y cajas laterales (tus números, tus corrales, especies listas para criar, últimas crías). |
| `js/admin-economia.js` (vista «Crianza») | Corral, horas por fase, descanso y si se puede criar, por criatura; y las crías en curso de todos. |
| `docs/pruebas/t_crianza.sh` | Pruebas: configuración, parejas inválidas, bloqueos, fases, nacimiento, descanso, sobrepoblación (al empezar y al recoger), copia de la reserva, límite por jugador, dos peticiones a la vez, cancelación y bloqueos huérfanos. |

## Qué va en el inicio y qué es personal

- **Inicio (la taberna)**: lo compartido. Hay una puerta a «Mi habitación» y un puesto de Intercambios (los dos, de momento, solo para admin, igual que Triunfos).
- **Mi habitación**: lo personal. Tu colección (con la estantería que se llena según cuánto del álbum tienes), tus mazos, tus corrales y tus crías. Las cajas laterales usan el mismo estilo que las del inicio.

## La pantalla de Corrales (corrales.html)

El foco es el corral activo. Arriba, seis miniaturas para cambiar de hábitat (con su lámpara de estado); debajo, un escenario grande con el bioma animado y las criaturas de ese
hábitat en sus sitios (las que tienes, encendidas; las que aún no, en sombra; las listas para criar, con un halo); después, la ficha del corral (nombre, estado y reloj, fuera del
dibujo) y el panel de lo que se puede hacer: elegir pareja para criar o, con una cría en curso, sus tres fases y el botón de recoger o sacar. Con una cría en curso el escenario
enseña a la pareja junto al nido y lo que pasa en cada fase (corazones, huevo, cría). Los tres biomas de exterior (aviario, bosque, ciénaga) usan el cielo real (`js/cielo.js`).

- Arte de los biomas, sitios y sitios de la pareja: `js/corrales-arte.js` (`SITIOS` y `PAREJA` por hábitat).
- Cada criatura se dibuja con `assets/criaturas/<id de la carta>.png` (ver `assets/criaturas/README.md`); hoy son siluetas de prueba que se regeneran con `tools/criaturas_placeholder.py`.
- La lógica y los datos son los de siempre (`js/corrales-lib.js`, `js/corrales.js`): no cambió ninguna operación.
