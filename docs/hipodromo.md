# Hipódromo: un mundo de carreras que sigue sin ti

Estado: el motor, las palabras para los nombres, el SQL, la función de servidor, las pruebas y una **página de prueba en modo local** están hechos. La página (`hipodromo.html`) es solo para admin, como Ostelar o Duelo: sale en el hub de Minijuegos y en el panel de Admin solo para cuentas admin, y quien entre por la dirección vuelve a Minijuegos. Este documento explica cómo funciona, qué se probó y qué falta.

La idea, en una frase: el jugador no posee ni entrena a nadie. Observa un mundo de criaturas corredoras que nacen, compiten, se lesionan, se retiran, crían y mueren con o sin él, y decide en quién confía su apuesta cada 30 minutos.

## Qué hay

| archivo | qué es |
|---|---|
| `data/hipodromo-palabras.js` | Las listas de palabras de los nombres, en español (con género) y en inglés. |
| `js/hipodromo-nombres.js` | El generador de nombres: gramática, concordancia, herencia, homenajes y nombres de carrera. |
| `js/hipodromo-motor.js` | El mundo: genes, cuerpo, carrera, cuotas, apuestas, vida, noticias, perfil público y el paso del servidor. Reglas puras, sin pantalla ni reloj propio. |
| `hipodromo.html`, `css/hipodromo.css`, `js/hipodromo-pagina.js`, `js/hipodromo-dibujo.js` | La página de prueba en modo local (ver «La página de prueba») y el dibujo de las criaturas. |
| `tools/probar-hipodromo.js` | 158 comprobaciones y un informe de equilibrio. `node tools/probar-hipodromo.js` (un minuto) o `--rapido` (medio minuto). |
| `docs/hipodromo.sql` | Tablas, permisos y la función que guarda cada tanda. Probado en PostgreSQL 16. |
| `docs/hipodromo-avanzar.ts` | La Edge Function de Supabase. **No se ejecutó nunca** (aquí no hay Deno ni acceso a Supabase). |

## La página de prueba

`hipodromo.html` corre el mundo entero en el navegador, sin Supabase, y lo guarda en `localStorage` (clave `hipodromoLocal`, unos 250 KB). Al abrirla por primera vez crea un mundo con 300 carreras de historia (tarda un par de segundos) y la primera carrera sale a los 4 minutos.

- **Reloj**: es virtual y solo avanza con la página abierta. Hay pausa, 1×, 10×, 60× y 600×, y un botón que salta a la salida, salta la carrera o pasa a la siguiente. Durante la carrera el reloj no pasa de 10× para que se vea.
- **Carrera**: la próxima carrera con pista, distancia, bolsa, pronóstico y rumores; las inscritas con su dibujo, récord, estrellas, últimas cuatro carreras y cuota (se pulsa la cuota para apostar); el panel de apuesta (ganador, podio y exacta); la carrera animada con los tiempos por tramo, con tropiezos y lesiones marcados; y el último resultado.
- **Criaturas**: todas las vivas y las retiradas, con filtros (en condiciones de correr, lesionadas, crías, en la cría, retiradas y fallecidas, leyendas, favoritas), orden y búsqueda. La ficha enseña el cuerpo, las aptitudes por terreno, el linaje, las últimas carreras y lo que has apostado por ella, y se puede seguir (favoritas).
- **Noticias**, **Mis apuestas** (saldo, pendientes, historial y rendimiento) y **Mundo** (estadísticas y ajustes).
- **Lo oculto**: una casilla en Mundo enseña la probabilidad real de cada inscrita, lo que «vale» su cuota, y en la ficha el rating, la forma, la fatiga, el talento y los genes. Sirve para comprobar el equilibrio.
- Las monedas empiezan en 1000. Como todo es local, cualquiera puede tocarlas desde las herramientas del navegador.

El dibujo es una silueta simple generada a partir de las proporciones del perfil (`HipodromoDibujo.silueta`). Cuando haya arte se cambia esa sola función.

## Cómo se mueve el mundo

Hay un reloj para todos: la carrera `n` sale a las `t0 + n * 30 min`. Todos los jugadores ven la misma carrera.

```
programar(n)      al terminar la anterior: inscritos, puertas, pronóstico, cuotas, rumores
                  y el resultado entero (secreto: la base de datos lo esconde hasta la hora de salida)
hora - 60 s       se cierran las apuestas
hora              sale la carrera (75 s en pantalla, con los tiempos por tramo para animarla)
hora + 90 s       el servidor aplica el resultado: premios, rating, lesiones, retiros, crías, noticias
                  y programa la siguiente
```

El resultado de la carrera `n` se calcula 30 minutos antes de correrse, pero no se aplica al mundo hasta 90 segundos después de la salida. Así no hace falta un servidor puntual al segundo: la propia base de datos oculta la fila de `hipodromo_carreras` hasta su hora (política `hora <= now()`), y la animación en el navegador arranca para todos a la vez.

Todo el azar sale de la semilla del mundo y del número de carrera (`crearRng(semilla, "fase", n)`), no de un estado oculto. Por eso el mundo es un objeto JSON, se puede guardar y reanudar, y ponerse al día de golpe da exactamente lo mismo que ir carrera a carrera (está comprobado, también tras pasar por `jsonb` de Postgres).

## Las criaturas

Una especie propia, no caballos. El nombre `cérvago` es provisional (`HipodromoMotor.ESPECIE`, un solo sitio para cambiarlo).

**El cuerpo revela las capacidades.** Cada criatura tiene 8 genes entre 0 y 1; cinco dan sus capacidades y tres dan otras cosas:

| parte del cuerpo | gen | qué dice |
|---|---|---|
| Patas | `pat` | velocidad punta |
| Pecho | `pul` | resistencia (cuánto aguanta antes de aflojar) |
| Ancas | `mus` | salida y aceleración, y recupera antes del cansancio |
| Cola | `col` | agilidad en las curvas |
| Mirada | `ojo` | temple: cuánto se equivoca y cuánto la altera el mal tiempo |
| Pezuña | `pez` | ancha rinde con barro, fina con pista seca |
| Pelaje | `pel` | denso rinde con frío, ralo con calor |
| Talla | `tam` | nada, solo adorno |

El perfil público trae el cuerpo con 5 niveles de texto por parte («Patas larguísimas, casi de grulla»), un **arquetipo** (Flecha, Tanque, Saltador, Maratonista) y una **silueta** con 12 proporciones de 0 a 1 para dibujarla (longitud de patas, pecho, cadera, cola, cuerpo, torso, grosor de patas, cuello, cabeza...). Cuello y cabeza son adorno puro; el resto sale de los genes. La interfaz puede dibujar el cuerpo sin enseñar un solo número.

**Lo que no se ve** (solo está en el estado del servidor): los genes exactos, un *talento oculto* de cada capacidad (la cría no es una copia del cuerpo), la **forma del día** (sube y baja con el tiempo), la fatiga y el rating real. Dos criaturas con el mismo cuerpo no rinden igual, y por eso el historial sigue importando.

**Lo que sí se aprende corriendo**: estrellas con ruido que mejoran con las salidas (con pocas carreras pueden engañar), estrellas por tipo de terreno (hacen falta 2 salidas en ese terreno), etiquetas («Se crece en terreno pesado», «En mala racha»), el estilo (va al frente, remonta desde atrás) a partir de 3 salidas, y las secuelas visibles de lesiones permanentes («cojea un poco de una pata trasera»).

**Etapas de la vida**, por edad: cría, potro, joven, adulto, veterano, y al final retirado o fallecido. `HipodromoMotor.etapaDe(edad, estado)` la calcula; el dibujo puede cambiar con ella.

## La carrera

Cada tramo es de 100 m. Una criatura reparte su energía con el esfuerzo que aguanta hasta la meta: en las carreras cortas manda la velocidad y en las largas la resistencia. Un velocista (velocidad 80, resistencia 40) gana el 76 % de los duelos con un fondista (50 y 85) en 800 m y solo el 25 % en 3000 m.

Pesan también: la pista (7 pistas con curvas, cuestas y drenaje distintos), el tiempo (6 estados con una cadena de Markov: un día lluvioso suele seguir a otro), la humedad acumulada de la pista, la puerta de salida, el tráfico para los que corren atrás, el duelo de líderes (si hay varios al frente se queman), los tropiezos, el cansancio, la edad y la forma del día.

El **pronóstico** que se publica es la fila de la cadena de Markov del tiempo actual: la probabilidad real, no una pista falsa. El tiempo que sale puede no ser el más probable.

## Cuotas y apuestas

Las cuotas son fijas y salen de 400 simulaciones de la carrera (con el tiempo muestreado del pronóstico). El «público» no ve la probabilidad real: mezcla lo que sabe (parte de la verdad) con la reputación (el rating), le suma un error mayor con las criaturas que casi no han corrido y la normaliza. Después se descuenta un 15 % de margen.

Medido en 173 carreras de un mundo de 8 años, con una segunda estimación independiente de la probabilidad real:

- El mercado está calibrado por tramos: lo que dice el público y lo que de verdad pasa coinciden (3,4 % contra 3,7 %, 11,1 % contra 11,4 %, 31,2 % contra 31,3 %...). El favorito gana en torno al 40 % de las veces.
- Apostar siempre al favorito, a cualquiera o al que más paga rinde entre -15 % y +7 % esperado por apuesta (el margen de la casa es del 15 %). Ninguna forma ingenua es rentable de forma estable.
- Un jugador con la probabilidad real exacta, que solo apuesta cuando vale más de 1,10, rinde entre +25 % y +50 %. Es el techo de saber todo, algo que ningún jugador puede: lo que sabe un jugador de verdad (cuerpo, historial, pista, rumores) es una parte de eso. Los rumores de cuadra aciertan el 65 % de las veces.

Tipos de apuesta:

- **Ganador**: primero en la meta.
- **Podio**: entre los tres primeros (cuota con su propia probabilidad, deformada como la de ganar).
- **Exacta**: primero y segundo en ese orden (cuota con Harville, margen del 25 %).

`liquidar(apuesta, resultado)` devuelve `{ gana, pago }`; `cuotaApuesta(programa, tipo, sel)` devuelve la cuota publicada; `ventana(programa, ahora)` dice si está `abierta`, `cerrada`, `corriendo` o `terminada`.

**No hay «doble» con cuota fija**, y no es por falta de ganas: el campo de la carrera siguiente no existe hasta que se aplica el resultado de la actual (depende de quién se lesionó, quién quedó cansado y de las valoraciones nuevas), así que no se puede poner precio antes de que se corra la primera. La alternativa que sí funciona es el **doble encadenado**: si ganas una apuesta, puedes jugar lo ganado a ganador en la carrera siguiente mientras sus apuestas sigan abiertas. Es solo una apuesta normal con el premio como importe; no necesita nada del motor.

## La vida

- **Fatiga**: cada salida suma cansancio (más en las largas y con barro) y cada carrera que pasa resta. Las ancas fuertes recuperan antes. Cansada, una criatura rinde menos y se lesiona más.
- **Lesiones en carrera**: unas 0,7 % por salida en condiciones normales; hasta 2,4 % si es frágil, está cansada o hay barro y tormenta. Las más completas (patas, pecho y ancas altos) son más frágiles, para que las ganadoras no acaben perfectas. Leve (unas 10 a 30 carreras fuera), media (36 a 96, con una probabilidad de secuela permanente) y grave (se retira).
- **Fuera de la pista** (no todo pasa corriendo): accidente en el entrenamiento, enfermedad, accidente en los establos, fuga y, rara vez, muerte. Es un incidente cada 20 carreras en todo el mundo, más o menos, y el 6 % de ellos es una muerte: del orden de una cada 4 a 7 días del mundo real. Una criatura fugada vuelve al cabo de 30 a 160 carreras.
- **Retiro**: por edad (desde los 5 años, con riesgo creciente, y a los 9 sin remedio), por bajo rendimiento, por secuelas o por lesión grave. Las que fueron buenas pasan a la cría.
- **Cría**: cada 6 carreras se comprueba cuántas criaturas faltan y nacen las necesarias. Los padres salen de las retiradas buenas, con preferencia por las de más prestigio, sin emparentar. Un 15 % de los nacimientos son de otra región, con genes nuevos, para que la población no se agote ni derive hacia un solo cuerpo (en 8 años no se disparó: ningún gen se movió más de 0,08 respecto a uno que no hace nada).
- **Generaciones y leyendas**: cada cría es de la generación de sus padres más uno. Una leyenda es la que ganó 14 carreras o 3 Grandes Premios. A veces la cría de una leyenda lleva su nombre con un numeral (`Peregrino II`).
- **Premios**: cada categoría (Gran Premio, Selecta, Corriente, Novatos) tiene su bolsa y la reparte entre los 5 primeros. Los premios no son monedas del jugador, solo el palmarés de la criatura.

## Noticias

Una por carrera (con titulares distintos para la sorpresa, la foto de meta o el favorito que se hunde) y otras por récord de pista, debut, racha, lesión, accidente, enfermedad, fuga y regreso, muerte, retiro (con «Fin de una era» para las leyendas), nacimiento y rumores de cuadra antes de cada carrera. Están escritas con plantillas de varias frases en español y salen con la hora de cuando ocurren, no de la carrera que los provoca.

## Ritmo: la cuenta que no sale

Hay 48 carreras al día. Eso fija todo lo demás, y las dos cosas que se pidieron chocan: que una criatura corra «cada 2 a 5 carreras» y que se la siga durante meses. Cada criatura hace del orden de 50 salidas en su vida; con las 48 carreras diarias, cuantas menos carreras entre salida y salida, antes se acaba su carrera. Tres ajustes posibles (se cambian con `C.OBJETIVO` y `C.ANIO`, y el resto se reescala solo):

| ajuste | criaturas vivas | un año del mundo | cada criatura corre | una carrera dura | ejemplo |
|---|---|---|---|---|---|
| **Por defecto** | 96 | 144 carreras (3 días) | cada 6 horas | unos 12 días | «Peregrino corre esta noche» |
| Largo | 288 | 432 carreras (9 días) | cada 18 horas | unos 33 días | tres generaciones en cuatro meses |
| Frecuente | 40 | 60 carreras (30 horas) | cada 2,5 horas | unos 5 días | todos conocen a todos, pero se renuevan rápido |

Los valores 96 y 288 están medidos en simulaciones de 6 años de mundo (la población se mantiene, la gente nace y se retira al mismo ritmo y las salidas por año son iguales). El «frecuente» no se probó. Elegir uno depende de cuánta gente va a mirar: con poca comunidad, más criaturas significan menos caras conocidas.

## Servidor

1. `docs/hipodromo.sql` ya está aplicado en tu proyecto de Supabase (8 de octubre de 2026): las tablas están vacías, y se comprobó con el rol anónimo, el de servicio y un usuario con sesión que cada tabla ve lo que debe y que el estado secreto no se puede leer. Si hay que repetirlo se puede: crea las tablas, los permisos y `hipodromo_guardar`.
2. Despliega `docs/hipodromo-avanzar.ts` como función `hipodromo-avanzar` con los tres archivos del motor al lado. Los pasos y los secretos están al principio del archivo.
3. Programa una llamada por minuto con `pg_cron` y `pg_net`. Es idempotente: si no toca nada, responde `{avanzadas: 0}`.

Quién ve qué:

| tabla | quién lee | por qué |
|---|---|---|
| `hipodromo_estado` | nadie salvo la función de servicio | tiene los genes, el talento, la forma y el resultado de la próxima carrera |
| `hipodromo_criaturas` | todos | solo el perfil público |
| `hipodromo_programa` | todos | inscritos, puertas, pronóstico, cuotas, rumores |
| `hipodromo_carreras` | todos, desde la hora de salida | los tiempos por tramo para animar la carrera |
| `hipodromo_noticias` | todos, desde su hora | |
| `hipodromo_leyendas` | todos | vista de las leyendas |
| `hipodromo_votos` y `hipodromo_comunidad` | cada uno ve su voto; la vista solo da cuentas | opcional (ver abajo) |

`hipodromo_guardar(version, lote)` guarda el mundo, las criaturas que cambiaron, los programas, los resultados y las noticias en una sola transacción, y si otra ejecución se adelantó falla con el código `40001` para que la función relea y repita. Un resultado ya publicado no se vuelve a escribir.

Las criaturas ya nacidas antes del primer día (la historia previa de 300 carreras) existen con su palmarés, pero esas carreras no tienen fila en `hipodromo_carreras`: la interfaz debe aceptar que un puesto del historial no tenga detalle.

## Navegador: lo que tiene que hacer la interfaz

Las monedas están en el navegador, como se eligió para empezar. Hace falta:

1. Una billetera en `localStorage` (por ejemplo, la clave `hipodromoBilletera`) con saldo y apuestas pendientes `{ n, tipo, sel, monto, cuota }`. Al abrir la página y cada vez que termina una carrera, se liquidan las apuestas pendientes con `liquidar` contra la fila de `hipodromo_carreras`.
2. Leer `hipodromo_programa` (próxima carrera), `hipodromo_carreras` (resultado y animación), `hipodromo_noticias` y `hipodromo_criaturas` (perfiles).
3. Favoritos y «lo que has apostado por Peregrino» guardados también en el navegador, y un salón de la fama que sea la vista `hipodromo_leyendas`.
4. Opcional: la **opinión de la comunidad**. Cada jugador con sesión deja su voto a ganador (una criatura por carrera, se cambia hasta que cierran las apuestas) y la vista `hipodromo_comunidad` da los porcentajes. No hay monedas de por medio: es una encuesta y se puede votar una cosa y apostar otra.

**Por qué importa que las monedas sean locales**: cualquier cosa que se calcule con ellas, un ranking de apostadores por ejemplo, es manipulable desde las herramientas del navegador. Para un minijuego entre conocidos puede bastar. Si algún día importa, hay que pasar la billetera y las apuestas al servidor (una función `hipodromo_apostar` con comprobación de saldo y plazo, y la liquidación dentro de `hipodromo_guardar`). Entonces también se podría hacer que las cuotas se muevan con la popularidad de las apuestas (reparto entre jugadores en vez de cuota fija), que es lo que sugería el diseño. Con cuota fija y monedas locales no es posible.

## Qué no se hizo

- Arte de verdad: el dibujo de las criaturas y de la pista es provisional.
- Versión con servidor de la página: hoy lee y guarda todo en el navegador.
- Pistas fantásticas («arcana»), y el «Núcleo de Carrera» como órgano propio: el motor tiene `suelo` en cada pista, pero ninguna regla distinta para una pista mágica.
- Las secuelas cambian el texto del perfil pero no hay un dibujo asociado.
- El «doble» con cuota fija (ver arriba), y las cuotas que se mueven con las apuestas.

## Cómo se probó

- `node tools/probar-hipodromo.js` (158 comprobaciones, un minuto): nombres (únicos, concordancia, «del» y «de la», títulos según el sexo, herencia, homenajes, equilibrio de idiomas), genes y cuerpo, la carrera (velocista contra fondista, terreno y clima, cansancio, forma, duelo de líderes, lesiones), un mundo de 8 años (población estable, calendario, premios exactos, rating sin crear ni perder puntos, deriva genética, reanudar desde JSON da lo mismo, nada oculto en lo público, noticias bien formadas), cuotas (calibración, margen, exacta, liquidar) y el paso del servidor.
- `docs/hipodromo.sql` se ejecutó dos veces en PostgreSQL 16 local con los roles `anon`, `authenticated` y `service_role` y una función `auth.uid()` de mentira: guardar la primera vez y las siguientes, choque de versiones, lo que ve un anónimo (el resultado de una carrera futura no se ve, una vez pasada su hora sí, el estado secreto no se puede leer ni escribir), los votos (solo a quien corre, solo antes del cierre) y que los datos del motor pasados por `jsonb` y de vuelta dan los mismos resultados.
- **No se probó**: la Edge Function (solo se comprobó que el archivo se interpreta), `pg_cron` y `pg_net`, ni nada contra el Supabase real. Supabase tiene permisos por defecto distintos de los del Postgres local; el SQL los revoca explícitamente, pero conviene mirar en el panel que las tablas `hipodromo_*` salen con las políticas esperadas.

## Mandos

Todos en `HipodromoMotor.C` (reloj, tamaño del mundo, margen, cría, incidentes) y `HipodromoMotor.AJUSTE` (la afinación de la simulación y el mercado). Si se cambia algo de `AJUSTE`, vuelve a pasar `tools/probar-hipodromo.js` y mira el informe: la calibración del mercado y lo que gana el favorito son lo primero que se descuadra.
