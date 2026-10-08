# Combate de Triunfos (al estilo Legends of Runeterra)

El combate dejó de ser "una unidad ataca a un objetivo". Ahora se declara un ataque con varias unidades y el rival decide quién bloquea.

## Cómo funciona

1. **Declarar.** En tu turno, una sola vez, eliges todas las unidades que atacan. Se preparan con un clic (o arrastrándolas a la franja de combate) y se declaran con **⚔ Atacar**. Una unidad que entró este turno no ataca. El botón **Todas** prepara a todas las que pueden.
2. **Reaccionar.** Si el rival tiene una reacción que encaje, puede jugarla ahora.
3. **Bloquear.** Los desafíos (ver abajo) ya fijan algunos bloqueos. El rival elige quién bloquea en el resto. Cada unidad suya bloquea como mucho a un atacante, y cada atacante recibe como mucho un bloqueador. Se elige una unidad y luego el atacante (o se arrastra hasta él). Si no hay nadie que pueda bloquear, se resuelve solo.
4. **Resolver.** Todo a la vez. Los atacantes bloqueados y sus bloqueadores se hacen daño. Los atacantes sin bloqueo golpean al jugador. Después se anima cómo salió (embestida, daño, quién cae).

Ya no se ataca al jugador ni a una unidad concreta a golpe de clic: lo que nadie bloquea llega al jugador.

## Palabras clave

| palabra | efecto |
|---|---|
| Desafiante | al atacar, elige qué unidad enemiga debe bloquearla, aunque vuele o no pueda bloquear (como el Challenger de Runeterra) |
| Provocar | regla propia: los desafíos deben apuntar antes a una unidad con Provocar |
| Marcada | es Vulnerable para quien la marcó: cualquiera de sus atacantes puede desafiarla, ignorando Provocar, y le hace +2 de daño |
| Volar | solo la bloquean unidades que también vuelan |
| Temible | no la bloquean unidades con menos de 3 de ataque |
| Veloz | en combate golpea antes; si mata a su rival, no recibe daño |
| Arrollar | el daño que sobra al matar al bloqueador pasa al jugador |
| Duro | recibe 1 menos de daño |
| Esquivo | en combate recibe la mitad del daño (redondeado hacia abajo) |
| Barrera | ignora el primer daño que reciba (se rompe) |
| No bloquea | no puede bloquear |

## Desafíos

Una unidad con Desafiante (o cualquiera, si el objetivo es una unidad marcada por su jugador) puede desafiar a una unidad enemiga al declarar el ataque. Esa unidad queda obligada a bloquearla y no puede bloquear a otro atacante. Un desafío pasa por encima de Volar y de No bloquea, pero respeta Provocar: si el rival tiene alguna unidad con Provocar, el desafío tiene que apuntar a una de ellas (salvo contra una marcada, o con el Puente de las Legiones). Cada unidad solo puede ser desafiada por un atacante. Si una reacción saca de combate al desafiante, el desafiado queda libre.

Provocar no existe en Runeterra. Aquí es una regla propia que protege de los desafíos.

## Cartas que cambiaron

| carta | antes | ahora |
|---|---|---|
| Bull | Provocar | Provocar (ahora protege de los desafíos) |
| Eklino | Provocar | Provocar (ahora protege de los desafíos) |
| Garra | al entrar, el enemigo pierde Provocar y Volar | igual, pero hasta el final del próximo turno del rival (así sus voladoras se bloquean), y además es Desafiante |
| Verdam | +2 contra la marcada e ignora Provocar | Desafiante; la marcada es Vulnerable (cualquiera de sus atacantes la desafía, sin Provocar) y recibe +2 |
| Enzo | ataca dos veces por turno | Veloz |
| Mattei | no puede ser objetivo de ataques | Esquivo |
| Cassius Coldgrave | no se le puede atacar con otra unidad en el campo | Esquivo, pero no puede bloquear |
| Aeromanta, Guiverno | solo las atacan unidades que vuelan | solo las bloquean unidades que vuelan |
| Kraken | | gana Arrollar |
| Edge | +2 si el objetivo ya recibió daño | +2 contra la unidad con la que combate si ya recibió daño |
| Bomba de humo | cancela un ataque contra una unidad tuya | una unidad atacante, a tu elección, se queda fuera del combate |
| Silbato de guardia | una unidad tuya atacada gana +0/+3 | todas tus unidades ganan +0/+2 |
| Puente de las Legiones | tus unidades ignoran Provocar | igual: tus desafíos ignoran Provocar (2 turnos) |
| Los Huesos | tus unidades de Sombra no son objetivo de ataques | tus unidades de Sombra tienen Volar (3 turnos) |

Las demás cartas no cambian. Las cartas que se editaron desde el álbum guardan su propio texto en el servidor: si alguna menciona Provocar o "atacar a una unidad", hay que reescribir ese texto a mano. Su efecto sale del código, no del texto.

## Acciones de la partida

```
{ t: "atacar",   u: [uid, ...], d?: { uidAtacante: uidDefensor } }   declara los atacantes y sus desafíos (solo el jugador activo)
{ t: "bloquear", b: [[uidAtacante, uidBloqueador]] }   elige los bloqueos (solo el rival; b: [] es no bloquear)
{ t: "reaccionar", i, o? }                              o = el atacante elegido (Bomba de humo)
{ t: "pasar" }                                          deja pasar la reacción, o equivale a no bloquear
```

## Lo que hay que tocar fuera de este repositorio

- **`cartas_accion` en Supabase** (`scratchpad/cartas_combate.sql`): debe aceptar la acción nueva **`bloquear`** (hoy solo deja pasar las acciones que conoce). Como la manda el rival, no el jugador activo, si la función comprueba de quién es el turno tiene que tratarla igual que `reaccionar` y `pasar`.
- **Partidas en línea que estén a medias**: se guardan como lista de acciones y se repiten con las reglas nuevas, así que las que ya tengan ataques se rompen. Conviene terminarlas o rendirlas antes de subir esto.
- **Pruebas del motor que no están en el repositorio**: las que usan `atacar` con un objetivo, `objetivosDeAtaque`, `ataquesMax`, Provocar o los estados `intocableHasta`, `sinProvocar` y `sinVolar` hay que actualizarlas. `node tools/probar-combate.js` prueba el combate nuevo y juega 300 partidas al azar.

## Dónde está en el código

- Reglas: `js/cartas-motor.js` (`atacar`, `iniciarBloqueo`, `bloquear`, `resolverCombate`, `puedeBloquear`).
- Habilidades: `js/cartas-efectos.js`. Textos de las cartas: `js/cartas-datos.js`.
- Pantalla: `js/batalla.js` (franja de combate, botones de atacar y bloquear, animación) y `css/cartas-juego.css`.
