# La taberna (index.html): salas, mesa de protagonistas y sprites

## Qué hay

- **Sala principal.** Escenario SVG de 1280 x 700 dentro de `index.html` (`#lbEscena`). La portada es más ancha que antes (`body.lb-grande`).
  La mesa común es el foco: banco corrido, dos taburetes, jarras delante de cada plaza y los protagonistas al triple de tamaño. En la pared solo hay
  lo imprescindible, bien separado: la puerta personal de Mi habitación, la estantería (Compendio), el mapa, la ventana al exterior con la rocola, la
  chimenea con el cuadro que cicla los fanarts, **un solo tablón** (las peticiones, con los cuatro fanarts más nuevos clavados como enlaces a la galería),
  el escritorio de Mis personajes y la puerta de los Establos. En el suelo: un rincón de juegos (mesa de Triunfos y la máquina que lleva a Minijuegos) a un
  lado y el puesto de Intercambios al otro. Solo para el admin, la puerta del Despacho bajo el mapa.
- **Orden de la sala.** Las puertas (Mi habitación, Establos, Despacho, el arco de la Biblioteca) y los muebles altos apoyan en la pared; lo que cuelga (mapa,
  cuadros, tablones, faroles) va más arriba; en el suelo solo hay muebles sueltos y la mesa común. Los carteles con el nombre de cada objeto se pintan en una capa
  superior (`#lbEtiquetas`, la llena `js/lobby-salas.js`) para que ningún mueble los tape. Ojo: GitHub Pages no publica archivos cuyo nombre empieza por `_`.
- **Decoración sin enlace.** Espadas, escudo, diana y mesa de ajedrez ya no abren nada (`.lb-deco-fija`, `pointer-events: none`). Duelo, Ajedrez y Arquería
  se juegan desde Minijuegos o desde la Sala recreativa.
- **Cielo y clima.** Las ventanas (la de la taberna, la de Mi habitación, el exterior de los Establos y la ventana del Despacho) siguen la hora de quien mira y a veces
  cambian el clima: `js/cielo.js` + `css/cielo.css`. `?hora=21&cielo=tormenta` fuerza hora y clima para probar.
- **Salas** (en la misma página, por el hash de la URL; se llega a ellas con las pestañas de arriba de la escena): `#biblioteca`, `#juegos`, `#establos` y `#despacho` (solo admin; sin permiso vuelve a la taberna).
  Las dibuja `js/lobby-salas.js` a partir de `MAPA`, que es la única lista de enlaces: de ahí salen también las pestañas de arriba de la escena y la lista
  «Todas las puertas del sitio». En el móvil (menos de 700 px) la escena se cambia por puertas grandes y la lista va abierta.
- **Hipódromo.** No está en la sala de juegos: vive en los Establos con el Hipódromo en vivo y los Corrales.
- **Aviso de la carrera.** Con 5 minutos o menos para la salida, la taberna enseña bajo la cinta de novedades una franja con la cuenta atrás, un enlace al Hipódromo en vivo y otro
  para apostar (mientras no cierren las apuestas). Mientras corre dice que está corriendo y luego se quita sola (`js/aviso-hipodromo.js`; lee `hipodromo_programa` y el reloj
  `hipodromo_ahora`, nada más). `index.html?caballos=90` simula una carrera que sale en 90 segundos.

## Añadir una página nueva

1. Añade su enlace a una sala en `MAPA` (`js/lobby-salas.js`): `[href, nombre, arte, soloAdmin]`.
2. Si la página tiene un objeto propio en la taberna, dibújalo en el SVG de `index.html` dentro de un `<a class="lb-spot" href="...">` y ponlo también en `MAPA.taberna`.
3. Corre `node docs/pruebas-web/enlaces_lobby.js`: falla si alguna página del sitio no está enlazada (salvo `index`, `secreto`, `muerte-subita` y `encuentro-verdam`, que se dejan fuera a propósito).

## La mesa de los protagonistas

`js/taberna-mesa.js` sienta a la mesa común (grupos `#lbMesaAtras` y `#lbMesaLados`) a quien esté conectado, con los datos reales de presencia
(`js/presencia.js`: `id`, `nombre`, `oculto`). Cada uno conserva su puesto mientras siga conectado y quien se aleja de la pestaña se ve apagado.
Hay seis puestos (`PUESTOS`); si hay más gente se escribe «+N más en la taberna». Para más puestos basta añadir entradas a `PUESTOS`.

`index.html?mesa=prueba` sienta tres siluetas llamadas «Prueba 1..3» (con `&n=6`, seis) solo para comprobar la composición. No son jugadores.

### Sprites

- PNG de **32 x 48 px**, fondo transparente, figura **sentada de frente**, con el asiento en el centro de la base (ancla: 16, 47).
- Se dibujan al triple (96 x 144 unidades del escenario) con `image-rendering: pixelated`: nada de suavizado ni filtros. El nombre solo aparece al pasar el cursor, enfocar o tocar al personaje.
- Para ponerle sprite a un jugador, añade una entrada en `data/protagonistas.js` con su nombre en minúsculas y sin tildes:
  `"nombre": { sprite: "assets/protagonistas/nombre.png", personaje: "Nombre del personaje" }`.
- Un sprite propio puede medir otra cosa y traer cuadros con vida: `tam: [ancho, alto]`, `alto` (alto dibujado, por defecto 144) y, opcionales, `brillo` y `parpadeo`
  (PNG del mismo tamaño que se superponen por ratos). Ejemplo en uso: la cuenta `gigglinn` (77 x 127, tres cuadros: `gigglinn*.png`).
- `pasea: true` (ejemplo: la cuenta `magoo`, un sprite de una sola pose): ese protagonista se levanta de vez en cuando, da una vuelta a saltitos y tambaleándose por el suelo libre
  de detrás de la mesa (`PASEO` en `js/taberna-mesa.js`: entre la máquina de Minijuegos y el puesto de Intercambios, donde no hay nada con enlace), a veces hace un barrel roll y vuelve a su sitio del banco.
  Mientras camina no recibe clics y va por detrás de la mesa. Un clic estando sentado le hace dar la vuelta. Con «reducir movimiento» no se mueve. `index.html?paseo=rapido` hace que se levante a los 1,5 s.
- Sin entrada se usa la silueta provisional `assets/protagonistas/silueta.png`, que se regenera con `tools/silueta_protagonistas.py`.

## Fanarts

- El cuadro sobre la chimenea sigue ciclando `data/rotacion.js` (js/common.js).
- El tablón de fanarts nuevos (`#lbTablonCuadros`, lo llena `js/lobby.js`) muestra los cuatro últimos de `fanarts_subidos`; si faltan, completa con los
  últimos de `data/rotacion.js`.

## Intercambios, forja y corrales

- `intercambios.html` (el Mercado de los Faroles) es una página de la taberna (ya no cuelga de Triunfos) y solo tiene Tablón, Mis intercambios y Buhonero. Tiene su propia paleta y
  tipografía (`css/puesto.css`, todo colgado de `body.pu`): jade de noche, bermellón de farol, latón y corcho, con el título en Almendra. Las cartas se ven como cartas de verdad
  (`js/cartas-mini.js` + `css/cartas-mini.css`: crecen al pasar el cursor y se abren grandes al pulsarlas). El Tablón son notas clavadas en un corcho con lo que ofrece y lo que pide
  lado a lado, y marca con «lo tienes» las que puedes aceptar ahora mismo (filtro «solo las que puedo aceptar»). Mis intercambios usa las mismas notas y un libro de cuentas con el historial.
  En el Buhonero, `js/puesto-buhonero.js` dibuja la escena (un mercader encapuchado junto a su carreta, bajo faroles), mueve sus ojos con el cursor, le da frases y enciende una vela por cada
  trato que te queda hoy; las ofertas son cartas sobre un paño con una etiqueta de precio colgada (rango de valor y un ejemplo de qué llevarle).
- La **forja** tiene su propia página, `forja.html` (`js/forja.js`, `css/forja.css`, paleta de hierro, cobre oxidado y brasa; el objeto de Mi habitación es ahora la puerta). El herrero gigante
  (`js/forja-herrero.js`, inspirado en un yelmo de láminas de cobre y un mazo de madera clara) baja el mazo cuando golpeas y enciende una brasa por cada forja que te queda hoy. Los encargos
  enseñan cuántas piezas tienes (dorsos encendidos) y el temple (probabilidad de éxito). Al pulsar Forjar se abre el banco: colocas tus cartas reales en los huecos y golpeas. Las reglas
  siguen siendo las del servidor (`economia-6_forja.sql`, `economia-14_forja_reserva.sql`).
- Los **corrales** tienen su pantalla (`corrales.html`, `js/corrales.js`, `js/corrales-lib.js`): un hábitat grande, una franja con los seis y el panel de cría
  debajo. Se llega por la puerta de Mi habitación y desde los Establos.
- El Buhonero y el Hipódromo reparten del mismo montón de cartas (`docs/economia-20_reserva_compartida.sql`). En la pestaña Cartas del Hipódromo el Buhonero es quien recibe y ofrece las cartas (con tokens, no cartas por cartas), con su misma escena y voz y sin velas: ver `docs/hipodromo.md`.

## Avisos de la taberna

`js/avisos-taberna.js` pinta bajo la cinta de novedades (`#lbAvisos`) lo que espera a quien entra, cada cosa con su enlace: crías listas en los corrales, retos de ajedrez y arquería (y partidas donde te toca mover),
intercambios dirigidos a ti y ofertas nuevas del Buhonero (`intercambios.js` apunta en `lbBuhoneroVisto` lo que ya viste). Se refresca cada 2 minutos y el título de la pestaña lleva el número de avisos.
Cada fuente falla por separado: si falta una tabla o función, ese aviso no sale. `index.html?avisos=prueba` enseña cuatro avisos de ejemplo.

## Guía de la taberna

`js/guia-inicial.js`: diálogo de tres pasos (crear personaje, recorrer la taberna, probar un juego). Sale solo la primera vez que alguien con sesión abre la taberna y es una de sus dos primeras visitas;
se vuelve a abrir desde el pie («Ver la guía de la taberna»). `index.html?guia=1` la abre siempre. Recuerda en el navegador que ya se vio (`lbGuiaVista`).
