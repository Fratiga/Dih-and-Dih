# La taberna (index.html): salas, mesa de protagonistas y sprites

## Qué hay

- **Sala principal.** Escenario SVG de 1280 x 700 dentro de `index.html` (`#lbEscena`). La portada es más ancha que antes (`body.lb-grande`).
  Objetos con enlace: estantería (Compendio), arco de la Biblioteca, mapa, cartel del Salón de juegos (Minijuegos), rocola, cuadro de fanarts (cicla las
  imágenes), tablón de anuncios (Peticiones), **tablón de últimos fanarts** (los cuatro más nuevos), escritorio (Mis personajes), puerta de Mi habitación,
  mesa de Triunfos, puesto de Intercambios, máquina de la Sala recreativa, puerta de los Establos y, solo para el admin, la puerta del Despacho.
- **Decoración sin enlace.** Espadas, escudo, diana y mesa de ajedrez ya no abren nada (`.lb-deco-fija`, `pointer-events: none`). Duelo, Ajedrez y Arquería
  se juegan desde Minijuegos o desde la Sala recreativa.
- **Salas** (en la misma página, por el hash de la URL): `#biblioteca`, `#juegos`, `#establos` y `#despacho` (solo admin; sin permiso vuelve a la taberna).
  Las dibuja `js/lobby-salas.js` a partir de `MAPA`, que es la única lista de enlaces: de ahí salen también las pestañas de arriba de la escena y la lista
  «Todas las puertas del sitio». En el móvil (menos de 700 px) la escena se cambia por puertas grandes y la lista va abierta.
- **Hipódromo.** No está en la sala de juegos: vive en los Establos con el Hipódromo en vivo y los Corrales.

## Añadir una página nueva

1. Añade su enlace a una sala en `MAPA` (`js/lobby-salas.js`): `[href, nombre, arte, soloAdmin]`.
2. Si la página tiene un objeto propio en la taberna, dibújalo en el SVG de `index.html` dentro de un `<a class="lb-spot" href="...">` y ponlo también en `MAPA.taberna`.
3. Corre `node docs/pruebas-web/enlaces_lobby.js`: falla si alguna página del sitio no está enlazada (salvo `index`, `secreto`, `muerte-subita` y `encuentro-verdam`, que se dejan fuera a propósito).

## La mesa de los protagonistas

`js/taberna-mesa.js` sienta a la mesa común (grupos `#lbMesaAtras` y `#lbMesaLados`) a quien esté conectado, con los datos reales de presencia
(`js/presencia.js`: `id`, `nombre`, `oculto`). Cada uno conserva su puesto mientras siga conectado y quien se aleja de la pestaña se ve apagado.
Hay seis puestos (`PUESTOS`); si hay más gente se escribe «+N más en la taberna». Para más puestos basta añadir entradas a `PUESTOS`.

`index.html?mesa=prueba` sienta siete siluetas llamadas «Prueba 1...7» solo para comprobar la composición. No son jugadores.

### Sprites

- PNG de **32 x 48 px**, fondo transparente, figura **sentada de frente**, con el asiento en el centro de la base (ancla: 16, 47).
- Se dibujan al doble (64 x 96 unidades del escenario) con `image-rendering: pixelated`: nada de suavizado ni filtros.
- Para ponerle sprite a un jugador, añade una entrada en `data/protagonistas.js` con su nombre en minúsculas y sin tildes:
  `"nombre": { sprite: "assets/protagonistas/nombre.png", personaje: "Nombre del personaje" }`.
- Sin entrada se usa la silueta provisional `assets/protagonistas/silueta.png`, que se regenera con `tools/silueta_protagonistas.py`.

## Fanarts

- El cuadro sobre la chimenea sigue ciclando `data/rotacion.js` (js/common.js).
- El tablón de fanarts nuevos (`#lbTablonCuadros`, lo llena `js/lobby.js`) muestra los cuatro últimos de `fanarts_subidos`; si faltan, completa con los
  últimos de `data/rotacion.js`.

## Intercambios, forja y corrales

- `intercambios.html` es una página de la taberna (ya no cuelga de Triunfos) y solo tiene Tablón, Mis intercambios y Buhonero.
- La **forja** está en Mi habitación (`js/forja.js`, objeto del escenario).
- Los **corrales** tienen su pantalla (`corrales.html`, `js/corrales.js`, `js/corrales-lib.js`): un hábitat grande, una franja con los seis y el panel de cría
  debajo. Se llega por la puerta de Mi habitación y desde los Establos.
- El Buhonero y el Hipódromo reparten del mismo montón de cartas (`docs/economia-20_reserva_compartida.sql`).
