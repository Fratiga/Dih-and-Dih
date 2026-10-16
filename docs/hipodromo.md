# Hipódromo: un mundo de carreras que sigue sin ti

Estado: está todo hecho y **desplegado en el Supabase real** (tablas, funciones, Edge Function y la tarea de cada minuto). El motor, el SQL y las pruebas están al día. La página (`hipodromo.html`) es solo para admin, como Ostelar o Duelo: sale en el hub de Minijuegos y en el panel de Admin solo para cuentas admin, y quien entre por la dirección vuelve a Minijuegos. Este documento explica cómo funciona, qué se probó y qué falta.

La idea, en una frase: un mundo de criaturas corredoras que nacen, compiten, se lesionan, se retiran, crían y mueren con o sin ti. Puedes mirarlo y apostar cada hora (ganador, podio, exacta, pozo y doble), y también tener tu propia cuadra: adoptar o comprar criaturas, inscribirlas, entrenarlas, cuidarlas, marcarles una táctica y cruzarlas.

## Qué hay

| archivo | qué es |
|---|---|
| `data/hipodromo-palabras.js` | Las listas de palabras de los nombres, en español (con género) y en inglés. |
| `js/hipodromo-nombres.js` | El generador de nombres: gramática, concordancia, herencia, homenajes y nombres de carrera. |
| `js/hipodromo-rasgos.js` | Los rasgos de las criaturas (cuernos, alas, piel, ojos, patas extra, núcleo...): las tablas de frecuencia, la herencia, los textos y **lo que hace cada uno en la carrera**. Lo comparten el motor y el dibujo. |
| `js/hipodromo-motor.js` | El mundo: genes, cuerpo, rasgos, carrera, pistas (con las arcanas), cuotas, apuestas (con pozo y doble), vida, la cuadra de los jugadores, noticias, perfil público y el paso del servidor. Reglas puras, sin pantalla ni reloj propio. |
| `hipodromo.html`, `css/hipodromo.css`, `js/hipodromo-pagina.js` | La página, con dos modos: servidor (el normal, con sesión) y prueba local. |
| `js/hipodromo-online.js` | El modo servidor de la página: lee el mundo compartido de Supabase, apuesta y manda órdenes con las funciones del servidor. |
| `js/hipodromo-glosario.js` | El glosario: ~80 explicaciones de las palabras técnicas (terreno, drenaje, cuota, podio, estilo, núcleo...). Se señalan o se tocan y sale la explicación en una caja flotante. Para añadir una: una línea en `G` y `HipodromoGlosario.tip("clave", "texto")`. |
| `js/hipodromo-cuadra.js` | La pestaña «Mi cuadra». No sabe de dónde salen los datos: la página le pasa un objeto `api` (servidor o local). |
| `js/hipodromo-dibujo.js`, `js/hipodromo-pista.js` | El dibujo de las criaturas (SVG) y la pista de la carrera (cámara que sigue al pelotón, clima y terreno, galope animado). |
| `hipodromo-vivo.html`, `css/hipodromo-vivo.css`, `js/hipodromo-vivo.js`, `js/hipodromo-vida.js` | La página inmersiva para ver las carreras (ver «Hipódromo en vivo»). `hipodromo-vida.js` mueve a las criaturas; `hipodromo-pista.js` aporta el paisaje y los recorridos. |
| `tools/probar-hipodromo.js` | 247 comprobaciones y un informe de equilibrio. `node tools/probar-hipodromo.js` (un minuto) o `--rapido`. |
| `tools/probar-hipodromo-sql.js` | 62 comprobaciones del SQL contra un PostgreSQL de verdad (Docker, contenedor `cartas-pruebas`), con el motor de verdad. |
| `docs/hipodromo.sql` | Tablas, permisos y funciones del servidor (guardar, apostar, ordenar, saldo). |
| `docs/hipodromo-avanzar.ts` | La Edge Function de Supabase, la que mueve el mundo cada minuto. |

## La página

Tiene dos modos con la misma pantalla.

- **Servidor** (el normal): hace falta haber iniciado sesión (en «Mis personajes»). El mundo es uno solo para todos y a la hora real: lo escribe la Edge Function, la página lo lee de Supabase, ajusta su reloj con la hora del servidor (`hipodromo_ahora()`) y se actualiza sola (más seguido cerca de la salida y mientras espera que el servidor aplique el resultado). Las monedas, las apuestas y las órdenes de la cuadra son del servidor: se mandan con funciones que comprueban saldo y plazo.
- **Prueba local** (sin sesión, sin servidor, o con `?local` en la dirección): el mundo corre entero en el navegador y se guarda en `localStorage` (clave `hipodromoLocal`). Hay un reloj virtual (pausa, 1×, 10×, 60×, 600×) y se puede ver lo oculto (probabilidad real, forma, genes). Las monedas son del navegador y cualquiera puede tocarlas.

Pestañas: **Carrera** (la próxima con pista, distancia, bolsa, pronóstico, rumores y las reglas de la pista arcana; las inscritas con cuota; el panel de apuesta; la carrera animada; el último resultado), **Mi cuadra**, **Criaturas** (con filtros y la ficha de cada una: cuerpo, rasgos y lo que hacen, aptitudes por terreno, linaje, carreras, dueño y precio), **Noticias**, **Mis apuestas** y **Mundo**.

**Cómo está organizada (octubre de 2026).** Arriba, el título con la entrada «Ver en vivo» y las monedas; debajo, una barra que se queda fija al bajar con el estado de la carrera, la cuenta atrás y las pestañas (el reloj de prueba va escondido en un desplegable y solo existe en modo local). En Carrera, las inscritas son tarjetas (puerta, dibujo, valoración, últimas, y un botón con la cuota a ganador y la de podio; la favorita lleva sello) y el boleto de apuesta queda pegado a un lado; en pantalla estrecha el boleto es una hoja que sube desde abajo con un botón fijo «Apostar» y se cierra solo al apostar. El boleto enseña un retrato quieto de la criatura elegida (dos en la exacta): puerta, edad, valoración, últimas carreras, lo que cree el mercado y lo que ya llevas apostado con ella; dice con claridad lo que te queda si pierdes y lo que ganas si aciertas, avisa cuando es un 30 % o más de tus monedas, y esas apuestas grandes (y el doble) piden pulsar «Apostar» dos veces. El doble es un interruptor. En Mi cuadra hay tres vistas (Mis criaturas, Mercado y Avisos) y el mercado son tarjetas ordenables, de doce en doce.

### La carrera en pantalla

`HipodromoPista` dibuja la carrera como una toma de televisión: la cámara sigue al líder y hace zoom según lo juntos que vayan, y las criaturas, grandes y galopando, corren en carriles con profundidad. Es solo la parte visual: cada criatura pasa por cada marca de 100 m exactamente en el tiempo que dice el motor; entre marcas la velocidad se suaviza y se le suman arranques y flojeras que valen cero en cada marca. La carrera dura entre 38 y 62 segundos en pantalla según la distancia (más 3 de cuenta atrás), aunque el motor la cuenta como 75 s. Se ve el clima (lluvia, tormenta con rayos, niebla, calor) y el terreno (charcos y barro según la humedad, hierba, arcilla, arena y los suelos arcanos), las zonas donde actúa la regla de una pista arcana, los tropiezos (la criatura se encabrita) y las lesiones (cojea). Hay marcador de metros que faltan y top 5, minimapa y las criaturas por las que has apostado llevan ★.

### El dibujo y los rasgos

El dibujo es una silueta en SVG (`HipodromoDibujo.silueta`) con cuatro estilos (plano, caricatura, pixel y elegante; el elegido es el elegante). Dos cosas por separado: la **morfología** (largo de patas, pecho, cadera, cola, torso...) sale de los genes y dice algo de las capacidades; los **rasgos** (cuernos, orejas, cuello, cola, espalda, piel, patas extra, ojos, alas, dedos, patrón de color y núcleo) los decide el motor al nacer, se heredan (46 % del padre, 46 % de la madre y 8 % nuevo) y van en `perfil.rasgos`. El dibujo también muestra la **etapa de la vida** (las crías son pequeñas, de patas cortas y cabeza grande; los veteranos tienen canas en el hocico), las **secuelas** (vendaje en la pata, cicatrices en la grupa, vendaje en el lomo, jadeo, sudor) y las **lesiones de ahora** (vendaje).

## Hipódromo en vivo (`hipodromo-vivo.html`)

Segunda página, aparte de la principal (que sigue con las apuestas, las fichas, las noticias, la cuadra y el mundo): la pista a pantalla completa para vivir las carreras. Se llega desde «▶ Ver las carreras en vivo» en la barra de arriba del hipódromo, y desde ella se vuelve (← Hipódromo), se va a apostar (`hipodromo.html#carrera`) o a los resultados completos (`#noticias`). La página principal entiende esos `#pestaña`.

**Reloj.** No tiene reloj propio: usa el del servidor (`HipodromoOnline`, `ahora()`). Lo que se ve en cada instante sale solo de esa hora y de los datos guardados de la carrera, así que entrar a mitad de carrera, recargar o abrir dos pestañas enseña lo mismo y nunca crea ni cambia un resultado. Cada carrera pasa por cinco fases:

| fase | cuándo | qué se ve |
|---|---|---|
| Espera | desde que se cargan las criaturas de la carrera hasta 30 s antes de la salida | criaturas en la zona de salida: pastan, miran alrededor, caminan, se sientan, se echan, se saludan |
| Preparación | los 30 s antes de la hora | se levantan las que descansan, se orientan hacia la salida, caminan a su puerta (un guion fijo según la hora), se ponen atentas (los nerviosos raspan el suelo) y a 3 s se agachan; cuenta atrás 5…1; la cámara se acerca a las puertas |
| Carrera | desde la hora hasta que cruza la última (38 a 62 s en pantalla, como siempre) | las puertas suben, galope, la cámara sigue al pelotón; la ganadora brilla y sale su nombre |
| Resultados | 30 s después de la meta | frenan hasta pararse, la ganadora celebra, jadean; tarjeta con el resultado oficial |
| Recuperación | 120 s más | descansan en la zona de meta; en los últimos 14 s se van; fundido y aparece la pista de salida con las de la siguiente carrera, que entran caminando |

La duración visual de la carrera no toca el calendario: la siguiente sale a su hora de todos modos.

**De dónde salen las posiciones.** `HipodromoPista.trayectorias(res, carriles)` (la misma pieza que mueve la toma de la página principal, que ahora se hace con ella): cada criatura pasa por cada marca de 100 m exactamente cuando lo dice el resultado guardado. No hay ganador decidido aquí.

**Limitaciones del servidor y cómo se resolvieron** (sin tocar la base de datos ni la Edge Function):
- El resultado solo se ve desde la hora de salida (RLS). La página lo pide cada 300 ms desde medio segundo antes; mientras llega, las criaturas esperan en la puerta.
- La carrera siguiente solo se programa 90 s después de la salida, así que durante los resultados y la recuperación la «carrera actual» ya no es la última fila de `hipodromo_programa`. La página guarda las carreras que ha visto y, si entras en ese rato, trae la anterior (`n - 1`) del programa y de las carreras. La recuperación (2 min) acaba mucho después de que se programe la siguiente, así que no hay hueco.
- Antes de la salida solo se sabe el clima de la carrera anterior (`climaPrevio`): se muestra ese y, al llegar el resultado, cambia poco a poco al de verdad (y el terreno con él).

**Las criaturas.** Se dibujan con el mismo SVG (`HipodromoDibujo.silueta(per, { vivo: true })`), que en ese modo sale en piezas con nombre (patas con muslo y caña, cuello, cabeza, orejas, ojos, cola) y con sus medidas en `data-rig`. `js/hipodromo-vida.js`:
- **Títere**: cada pata se resuelve con cinemática inversa a partir de dónde tiene que pisar el pie. Las mismas reglas sirven para caminar, trotar, galopar, pastar, echarse y sentarse con las patas que tenga (cuatro, seis, pares dobles delante o detrás). Las patas de atrás, al echarse o sentarse, se pliegan hacia delante bajo el vientre y la articulación queda arriba. Cuernos, espinas, alas, cuello largo y colas especiales se mueven con su pieza.
- **Actor**: una lista corta de estados (pastar, mirar, caminar, sentar, echar, levantar, acercarse y saludar a otra, preparación, galope, frenar, celebrar, salir). El ángulo de sentada se calcula por criatura para que la grupa quede a ras de suelo y las delanteras sigan apoyadas aunque tengan las patas cortas. Los nerviosos (gen de mirada) descansan menos y raspan el suelo antes de salir. Nada está sincronizado entre criaturas ni entre espectadores, salvo el guion de la preparación y las posiciones de la carrera.

**Música.** Usa el sistema de siempre (`js/musica-paginas.js`, tabla `musica_paginas`): la página es «Hipódromo en vivo» en el ⚙ del admin y tiene dos listas, «Espera» (la de fondo: espera, resultados y recuperación) y «Carrera» (la de «partida»: de 30 s antes de la salida hasta la meta). La página llama a `MusicaPaginas.partida(true/false)` según la fase que marca el reloj global, no según cuándo entraste; si el navegador no deja sonar hasta que toques, sale un aviso. El volumen y el silencio son los de `mj-volumen.js` (la barra de abajo a la derecha) y el ♪; pausar la música no para la carrera.

**Prueba local** (sin sesión o con `?local`): un mundo pequeño en el navegador con botones para saltar a cada fase (`?t=segundos` desde la salida, negativo = antes: `?local&t=-30`). Lo comparte con la página principal solo en el código del motor.

## Los rasgos tienen efecto (`js/hipodromo-rasgos.js`)

Todo lo que tiene efecto se ve en el cuerpo, así que quien lee bien la criatura sabe qué hace; los efectos son pequeños a propósito (valen lo que un cuerpo algo mejor o peor). Cada ficha lista los rasgos y, si hacen algo, lo que hacen.

| rasgo | efecto |
|---|---|
| Patas extra | Seis patas: arranque +5, agilidad -2, algo más frágil. Delanteras dobles: arranque +3, velocidad +2. Traseras dobles: arranque +6. Par fino: agilidad +4 (o +3 y resistencia +2 si va en medio). |
| Alas | Pequeñas, de membrana y de plumas alivian las cuestas, casi no dejan tropezar y vuelan en el Cielo Roto; pesan (velocidad -1 a -3). Las atrofiadas son adorno. |
| Cuernos | Los grandes (astas, corona, muchos, espiral) frenan el aire (-3 vel.) pero abren paso en el pelotón; los de choque (recto, delante, único, colmillos, laterales) abren paso y la hacen algo más frágil; los de atrás y curvos cortan el aire (+2 vel.). |
| Piel | Escamas: menos lesiones, menos efecto del clima, -2 vel. Placas: la que menos se lesiona, -4 vel., -2 res. Mixta: casi no nota el clima. Lisa: +2 vel., más frágil. |
| Ojos | Tres: temple +4, la niebla la desordena menos. Cuatro: temple +7 y los Espejos casi no la engañan. |
| Dedos | Palmeadas: mejor en terreno blando y en la Ciénaga. Garras: tropiezan menos y agarran en las cuestas. Cuatro dedos: tropiezan menos. |
| Cola | Aleta y plumas: agilidad +3 y +2. Maza: arranque +2, velocidad -2. |
| Cuello | Serpentino y segmentado: ganan unos centímetros al estirar el cuello en la meta. Grueso: resistencia +2. |
| Orejas / espalda | Dos pares de orejas: temple +3. Espinas y placas dorsales: un poco de paso en el pelotón y algo de protección. |
| Núcleo de carrera | Latente, vivo y ardiente. Solo importa en las pistas arcanas (ventaja de 0,4 %, 1 % y 1,6 % de velocidad) y los más vivos son más frágiles. |
| Adorno | Hocico y patrón de color no hacen nada. |

## Pistas arcanas

Además de las siete pistas normales hay cuatro con reglas propias, que salen la mitad de veces (una jornada de cada cuatro o cinco). Las reglas están en `HipodromoMotor.REGLAS_ARCANAS` y la página las explica en la carrera.

- **Corredor de los Espejos** (ilusión): en algunos tramos los espejos confunden y pierden ritmo; el temple y los ojos de más ayudan.
- **Cielo Roto** (corrientes): hay tramos de aire ascendente donde las criaturas con alas ganan velocidad; es una pista de cuestas.
- **Ciénaga Susurrante** (sumidero): el suelo se las come, todas gastan más energía, menos las de patas palmeadas; siempre húmeda.
- **Cuenca de Brasas** (brasas): calor extremo siempre; el pelaje denso sufre y la piel de escamas y placas ayuda.

En todas responde el núcleo de la criatura.

## Cómo se mueve el mundo

Hay un reloj para todos: la carrera `n` sale a las `t0 + n * 60 min` (`C.MINUTOS`: una carrera cada hora, 24 al día, y cae en la hora en punto). Todos los jugadores ven la misma carrera.

```
programar(n)      al terminar la anterior: inscritos, puertas, pronóstico, cuotas, rumores
                  y el resultado entero (secreto: la base de datos lo esconde hasta la hora de salida)
hora - 60 s       se cierran las apuestas
hora              sale la carrera (75 s en pantalla, con los tiempos por tramo para animarla)
hora + 90 s       el servidor aplica el resultado: premios, rating, lesiones, retiros, crías, noticias
                  y programa la siguiente
```

El resultado de la carrera `n` se calcula una hora antes de correrse, pero no se aplica al mundo hasta 90 segundos después de la salida. Así no hace falta un servidor puntual al segundo: la propia base de datos oculta la fila de `hipodromo_carreras` hasta su hora (política `hora <= now()`), y la animación en el navegador arranca para todos a la vez.

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

**Lo que sí se aprende corriendo**: estrellas con ruido que mejoran con las salidas (con pocas carreras pueden engañar), estrellas por tipo de terreno (hacen falta 2 salidas en ese terreno), etiquetas («Rinde mejor en terreno pesado», «En mala racha»), el estilo (va al frente, remonta desde atrás) a partir de 3 salidas, y las secuelas visibles de lesiones permanentes («cojea un poco de una pata trasera»).

**Etapas de la vida**, por edad: cría, potro, joven, adulto, veterano, y al final retirado o fallecido. `HipodromoMotor.etapaDe(edad, estado)` la calcula; el dibujo puede cambiar con ella.

## La carrera

**Altibajos (octubre de 2026).** Además del cuerpo y de cómo amanece la criatura (`SIG_DIA`), cada una lleva rachas que duran varios tramos (`SIG_RACHA` y `RHO_RACHA`): se va, se queda atrás o se recupera. Con eso el líder a mitad de carrera gana el 53 % de las veces (antes el 66 %), hay en promedio 1,7 cambios de líder por carrera (antes 1,1) y el favorito gana menos. Para que las cuotas siguieran justas se bajó `AGUDEZA` de 1,35 a 1,22. La animación añade encima unas ondas de ritmo solo visuales (valen cero en la salida y en la meta).

**Quién corre contra quién (octubre de 2026).** Los entrenadores del mundo no meten a cualquiera: para cada carrera calculan la **fuerza** de cada criatura disponible (lo que tardaría corriendo sola, sin azar, con la pista, la distancia y el clima de esa carrera: cuenta forma, fatiga, edad, rasgos y terreno; `fuerzas` en el motor) y las ordenan. La categoría fija de qué parte de esa lista sale el grupo (Gran Premio, de arriba; Selecta, medio-alto; Corriente, medio; Novatos, abajo y las que debutan) y, dentro de esa parte, se escoge el grupo seguido que corre más junto. Así los campos son parejos: antes un 16 % de los inscritos tenía menos de un 3 % de ganar y el favorito se llevaba de media un 35 %; ahora son un 9 % y un 28 % (medido con `motor` de 3 años, 360 carreras). El Gran Premio sigue siendo el más desigual porque arriba hay pocas criaturas y se despegan del resto. Las criaturas con dueño no pasan por esto: las inscribe su dueño y entran siempre. Ajustes en `EMPAREJA` (`zona` por categoría, `compacto`: cuánto se exige que corran juntas; menos de 0,004 hace que la categoría deje de importar).

Cada tramo es de 100 m. Una criatura reparte su energía con el esfuerzo que aguanta hasta la meta: en las carreras cortas manda la velocidad y en las largas la resistencia. Un velocista (velocidad 80, resistencia 40) gana el 76 % de los duelos con un fondista (50 y 85) en 800 m y solo el 25 % en 3000 m.

Pesan también: la pista (7 pistas con curvas, cuestas y drenaje distintos), el tiempo (6 estados con una cadena de Markov: un día lluvioso suele seguir a otro), la humedad acumulada de la pista, la puerta de salida, el tráfico para los que corren atrás, el duelo de líderes (si hay varios al frente se queman), los tropiezos, el cansancio, la edad y la forma del día.

El **pronóstico** que se publica es la fila de la cadena de Markov del tiempo actual: la probabilidad real, no una pista falsa. El tiempo que sale puede no ser el más probable.

## Cuotas y apuestas

Las cuotas son fijas y salen de 400 simulaciones de la carrera (con el tiempo muestreado del pronóstico). El «público» no ve la probabilidad real: mezcla lo que sabe (parte de la verdad) con la reputación (el rating), le suma un error mayor con las criaturas que casi no han corrido y la normaliza. Después se descuenta un 15 % de margen.

Medido en 173 carreras de un mundo de 8 años, con una segunda estimación independiente de la probabilidad real:

- El mercado está calibrado por tramos: lo que dice el público y lo que de verdad pasa coinciden (4,1 % contra 4,0 %, 11,2 % contra 11,2 %, 19,7 % contra 19,7 %, 30,6 % contra 30,3 %, 49,8 % contra 50,7 %). El favorito gana en torno al 36 % de las veces.
- Apostar siempre al favorito, a cualquiera o al que más paga rinde en torno a -14 % esperado por apuesta (el margen de la casa es del 15 %). Ninguna forma ingenua es rentable.
- Un jugador con la probabilidad real exacta, que solo apuesta cuando vale más de 1,10, rinde en torno a +30 %. Es el techo de saber todo, algo que ningún jugador puede: lo que sabe un jugador de verdad (cuerpo, historial, pista, rumores) es una parte de eso. Los rumores de cuadra aciertan el 65 % de las veces.

Tipos de apuesta:

- **Ganador**: primero en la meta.
- **Podio**: entre los tres primeros (cuota con su propia probabilidad, deformada como la de ganar).
- **Exacta**: primero y segundo en ese orden (cuota con Harville, margen del 25 %).

`liquidar(apuesta, resultado)` devuelve `{ gana, pago }`; `cuotaApuesta(programa, tipo, sel)` devuelve la cuota publicada; `ventana(programa, ahora)` dice si está `abierta`, `cerrada`, `corriendo` o `terminada`.

**El doble y el pozo.** No hay «doble» con cuota fija: el campo de la carrera siguiente no existe hasta que se aplica el resultado de la actual, así que no se le puede poner precio antes. El **doble** que sí hay es un encadenado: marcas «doble» en una apuesta a ganador y, si aciertas, lo que cobras no pasa a tu saldo sino que se juega solo a ganador al favorito de la carrera siguiente (el de menor cuota), con su cuota fija, si todavía se puede apostar; si no, se cobra normal. El **pozo** es un tipo de apuesta distinto, sin cuota fija: todo lo apostado al pozo de esa carrera más un bote de la casa de 50 monedas, menos el 10 % de retención, se reparte entre los que aciertan al ganador en proporción a lo que pusieron (nunca menos de lo apostado). Cuanta menos gente acierta, más paga; si nadie acierta, la casa se queda con todo. Se enseña una cuota estimada con lo que hay apostado en ese momento (la vista `hipodromo_pozos` da las sumas por criatura, sin decir quién apostó).

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

Hay 24 carreras al día (una por hora). Eso fija todo lo demás, y las dos cosas que se pidieron chocan: que una criatura corra «cada 2 a 5 carreras» y que se la siga durante meses. Cada criatura hace del orden de 50 salidas en su vida; con las 24 carreras diarias, cuantas menos carreras entre salida y salida, antes se acaba su carrera. Todo está medido en carreras, no en horas: pasar de una carrera cada 30 minutos a una cada hora (octubre de 2026) duplicó el tiempo real de todo, y un año de las criaturas pasó de 3 a 6 días. Si se quiere que un año vuelva a ser de 3 días, se baja `C.ANIO` a 72 (y las criaturas correrían la mitad de veces por año). Tres ajustes posibles (se cambian con `C.OBJETIVO` y `C.ANIO`, y el resto se reescala solo):

| ajuste | criaturas vivas | un año del mundo | cada criatura corre | una carrera dura | ejemplo |
|---|---|---|---|---|---|
| **Por defecto** | 96 | 144 carreras (6 días) | cada 12 horas | unos 24 días | «Peregrino corre esta noche» |
| Largo | 288 | 432 carreras (18 días) | cada 36 horas | unos 66 días | tres generaciones en seis meses |
| Frecuente | 40 | 60 carreras (2,5 días) | cada 5 horas | unos 10 días | todos conocen a todos, pero se renuevan rápido |

Los valores 96 y 288 están medidos en simulaciones de 6 años de mundo (la población se mantiene, la gente nace y se retira al mismo ritmo y las salidas por año son iguales). El «frecuente» no se probó. Elegir uno depende de cuánta gente va a mirar: con poca comunidad, más criaturas significan menos caras conocidas.

## La cuadra

Cada jugador puede tener hasta 4 criaturas. Lo que tiene dueño no lo inscriben los entrenadores del mundo: lo decide su dueño.

- **Conseguirlas**: **adoptar** una criatura joven de cuerpo corriente de la casa (gratis, una sola vez, a elegir el sexo) o **comprar** otra del mercado (criaturas vivas sin dueño; el precio sale solo de lo público: linaje de las crías, estrellas y palmarés de las demás, de 100 a 3000 monedas). **Vender** a la casa paga el 40 % de lo que costaría ahora y devuelve las inscripciones.
- **Inscribir** en cualquiera de las próximas 12 carreras (cuesta el 10 % de la bolsa; las inscripciones de una carrera cierran cuando termina la anterior; hasta 3 tuyas por carrera). Si la criatura no puede correr (lesión, cansancio, entrenando) o la carrera se suspende, se devuelve lo pagado. El calendario de las próximas carreras (categoría, distancia, pista y precio) está en `hipodromo_calendario`.
- **Entrenar** una capacidad: una sesión dura 6 carreras (6 horas), cuesta 30 monedas, la criatura no corre mientras tanto, mejora un poco (más si es joven, menos cuanto más entrenada, con tope de +8) y puede lesionarse.
- **Cuidar**: 40 monedas; quita 20 de cansancio y acorta una lesión leve o media un 40 %.
- **Táctica**: al frente, a media tabla o desde atrás, gratis; ir contra la naturaleza de la criatura cuesta un poco (1,2 % de velocidad por unidad de diferencia).
- **Bautizar** (25 monedas, una vez), **retirar a la cría** y **cruzar**: una hembra retirada a la cría con un semental también en la cría (la monta cuesta de 60 a 800 monedas y se paga a su dueño si es de otro jugador); la cría nace 12 carreras después y es del dueño de la madre.
- **Premios**: la bolsa de cada carrera (50 %, 25 %, 12 %, 8 %, 5 % a los cinco primeros) es del dueño. Una criatura con dueño solo se retira por salud, por edad o porque su dueño lo decide, no por rendir poco.
- **Lo privado** de cada dueño (`hipodromo_cuadras`): órdenes, cansancio, forma en palabras y las capacidades que le cuenta su entrenador, redondeadas de 5 en 5 (el talento exacto sigue oculto).
- **Economía**: correr todo el tiempo en Novatos y Corriente rinde, de media, alrededor de un 30 % menos de lo gastado (de -90 % a +90 % según la criatura): no regala dinero. Se mide en `tools/probar-hipodromo.js`.

El motor no toca monedas: dice cuánto cuesta cada orden (`costo`), cuánto devuelve (`ingreso`) y los premios (`pagos`), y quien lo llama las cobra.

## Cartas y monedas

En el hipódromo **empiezas sin monedas** (la billetera nace en 0; la criatura de la casa sí es gratis). El dinero entra de tres formas: vendiendo cartas, con los premios de tus criaturas y apostando. Es la única conexión entre la economía de cartas y el hipódromo, y cambia una decisión de `docs/economia-de-cartas.md` («no existe una moneda universal») por una moneda concreta, la del hipódromo, que el DM aprobó el 13 de octubre de 2026. Está en `docs/hipodromo-2_cartas.sql` y en la pestaña **Cartas** de la página (solo en modo servidor; los nombres de las cartas se cargan al abrirla).

- **Vender una carta tuya**: la casa la paga según su rareza y la copia pasa a la **reserva** (el conjunto de copias sin dueño que la economía de cartas reparte antes de emitir ninguna nueva). Solo se venden copias libres, no las apostadas ni las que están en un intercambio.
- **Comprar una carta**: solo de lo que hay en la reserva. No se emite nada nuevo, así que comprar no crea cartas, solo las mueve. Se respeta el límite por jugador y el Side (no se compran cartas del lado que no ves).
- **Precios por rareza** (en `hipodromo_precios_cartas`, el admin los cambia con `hipodromo_admin_precios`):

| rareza | te pagan | cuesta |
|---|---|---|
| Común | 20 | 50 |
| Infrecuente | 60 | 150 |
| Rara | 200 | 500 |
| Legendaria | 800 | 2000 |

Las **limitadas no se pueden comprar ni vender** en el hipódromo: solo las da el DM (una rareza sin precio queda fuera). Comprar cuesta 2,5 veces lo que se paga al vender: vender y recomprar siempre pierde monedas. Todo pasa por `cartas_i_retirar` y `cartas_i_emitir` de la economía de cartas, así que queda en su libro de movimientos (referencias `hipodromo:venta` y `hipodromo:compra`). Una carta común vendida (20) no llega ni a una inscripción en una carrera corriente (80): se pensó para que cambiar cartas por monedas sea una decisión, no un grifo. Los precios se pueden subir o bajar si resulta corto o largo.

## El servidor

Las monedas, las apuestas y la cuadra son del servidor. Todas las tablas `hipodromo_*` tienen RLS: cada jugador lee solo lo suyo y nadie escribe directamente; todo pasa por funciones `security definer`.

| tabla / función | qué hace |
|---|---|
| `hipodromo_estado` | El mundo entero con lo oculto. Nadie lo lee salvo la función de servicio. |
| `hipodromo_criaturas`, `_programa`, `_carreras`, `_noticias`, `_calendario` | Lo público. La carrera y las noticias se ven desde su hora (política `hora <= now()`). |
| `hipodromo_billeteras`, `_movimientos`, `_apuestas`, `_ordenes`, `_avisos`, `_cuadras` | Lo de cada jugador (cada uno ve solo lo suyo). |
| `hipodromo_saldo()` | Crea la billetera (**empieza en 0**) y devuelve el saldo. |
| `hipodromo_apostar(n, tipo, sel, monto, doble)` | Comprueba plazo, criatura y saldo, **pone la cuota el servidor** y descuenta. |
| `hipodromo_ordenar(datos)` | Encola una orden de la cuadra; el dueño es siempre quien la manda. |
| `hipodromo_guardar(version, lote)` | La llama la Edge Function: guarda el mundo y todo lo demás en una transacción: cobra las órdenes, paga los premios, liquida las apuestas (pozo y doble incluidos) y marca las órdenes. Con una versión vieja falla con 40001 y con un saldo negativo, con 23514: la función repite. |
| `hipodromo_ahora()` | La hora del servidor, para el reloj de la página. |
| `hipodromo_vender_carta`, `hipodromo_comprar_carta`, `hipodromo_cartas_reserva`, `hipodromo_admin_precios` | Cambiar cartas por monedas (ver «Cartas y monedas»). |

Una **Edge Function** (`hipodromo-avanzar`) corre cada minuto con `pg_cron`: lee el mundo, las órdenes pendientes y los saldos, llama a `HipodromoMotor.paso()` y guarda con `hipodromo_guardar`. Las órdenes se resuelven en el siguiente minuto y la página espera su resultado. El mundo se crea con 300 carreras de historia por vivir y se pone al día de 20 en 20 (las que quedan atrás se programan con pocas simulaciones). Pasos de despliegue y secretos en `docs/hipodromo-avanzar.ts`; lo desplegado usa los archivos del motor de un commit fijo del repositorio (importados por dirección web), no copias.

## Qué no se hizo

- Arte de verdad: el dibujo de las criaturas y de la pista es provisional (hecho con SVG y canvas).
- Intercambios de criaturas entre jugadores (hoy solo se compra a la casa y se cruza con sementales de otros).
- Un jinete aparte de la táctica, y entrenamientos distintos por estilo.
- Que las cuotas fijas de ganador, podio y exacta se muevan con las apuestas (para eso está el pozo).

## Cómo se probó

- `node tools/probar-hipodromo.js` (247 comprobaciones): nombres, genes y cuerpo, la carrera (velocista contra fondista, terreno y clima, cansancio, forma, duelo de líderes, lesiones), **rasgos** (herencia, efectos acotados, y que cada uno gane donde debe: alas en el Cielo Roto, ojos en los Espejos, palmeadas en la Ciénaga...), pistas arcanas, **la cuadra** (adoptar, comprar, inscribir con devolución, entrenar, cuidar, táctica, bautizar, cruzar, montas de otros, premios, reanudar desde JSON, que lo privado no sale en lo público y el rendimiento económico), el pozo y el doble, un mundo de años (población estable, calendario, premios exactos, rating, deriva genética, noticias), cuotas (calibración, margen, exacta, liquidar), el paso del servidor y ponerse al día en varias llamadas.
- `node tools/probar-hipodromo-sql.js` (62 comprobaciones, necesita Docker): ejecuta el SQL dos veces, comprueba permisos (anónimo y jugador), apostar con la cuota del servidor (la de la exacta coincide con la del motor), el pozo y el doble repartidos igual que en el motor, las órdenes procesadas por el motor con el cobro junto al mundo, premios y apuestas liquidados, choques de versión y saldos negativos que no dejan nada a medias.
- **Contra el Supabase real**: se aplicó el SQL, se desplegó la Edge Function, se programó el cron y se comprobó que el mundo se crea y se pone al día. Esto sacó dos cosas que el Postgres local no enseñaba: Supabase exige `WHERE` en todo `DELETE` (pg-safeupdate) y da permisos de escritura por defecto a las vistas nuevas (el SQL los quita). Los imports de la Edge Function tienen que ser estáticos.

## Mandos

Todos en `HipodromoMotor.C` (reloj, tamaño del mundo, margen, cría, incidentes) y `HipodromoMotor.AJUSTE` (la afinación de la simulación y el mercado). Si se cambia algo de `AJUSTE`, vuelve a pasar `tools/probar-hipodromo.js` y mira el informe: la calibración del mercado y lo que gana el favorito son lo primero que se descuadra.
