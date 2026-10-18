# Herramientas de Admin: plan y estado

Idea: que el Admin pueda hacer desde la web lo que hoy se pide a Claude. Cada herramienta se entrega por fases, con su SQL (en `docs/admin/`, probado en local con `sh docs/admin/probar_historial.sh`) y su pestaña en `admin.html`.

Reglas comunes:

- Todo lo que se edita desde la web queda en tablas con RLS: lee quien corresponda, escribe solo una función del servidor que comprueba `fichas_es_admin()`.
- Toda tabla editable se registra en `admin_registrar_tabla(...)` (historial) para poder deshacer.
- El sitio sigue siendo estático: lo editado se mezcla sobre los archivos de `data/*.js` al cargar, y sin las tablas el sitio funciona igual que antes.
- El SQL se corre a mano en Supabase, en el orden de esta lista.

## Estado

| # | Herramienta | Fase | Estado |
|---|---|---|---|
| 21 | Historial y Deshacer (pestaña Cambios) | 1 | Hecha. SQL: `docs/admin/admin_historial.sql` |
| 20 | Copias de seguridad (pestaña Copias) | 1 | Hecha, sin SQL |
| 19 | Panel de salud (pestaña Salud) | 1 | Hecha, sin SQL |
| 18 | Música por página | antes | Hecha. SQL: `scratchpad/musica_paginas.sql` |
| 1, 3 | Editor de entradas del compendio + quién lo ve (Side) | 2 | Hecho. SQL: `docs/admin/contenido_servidor.sql` |
| 2 | Editor de cronología | 2 | Hecho (misma pestaña Contenido) |
| 5 | Editor de reglas y economía | 2 | Hecho. Las estadísticas de combate ya se editan en su página (`docs/estadisticas-edicion.md`) |
| 4 | Editor de pines del mapa (arrastrar sobre el mapa) | 2 | Hecho |
| 13 | Anuncios y novedades del lobby | 2 | Hecho (colección «Novedades del lobby») |
| 6, 7 | Balance y prueba de cartas (pestaña Balance: partidas reales y simulador) | 3 | Hecha, sin SQL. El simulador (`js/cartas-simulador.js`) usa el motor real |
| 8 | Dificultad de los rivales (pestaña Rivales: Ajedrez, Arquería y Duelo) | 3 | Hecha. SQL: `docs/admin/rivales.sql` |
| 9 | Regalos y eventos (pestaña Regalos y eventos) | 3 | Hecho. SQL: `docs/admin/regalos_eventos.sql` |
| 10 | Calendario del Hipódromo (pestaña Calendario) | 3 | Hecho como vista de solo lectura, sin SQL. No se edita a mano: el motor genera y corre las carreras, y cambiarlas puede descuadrar apuestas y premios |
| 12 | Interruptores del sitio | 4 | Hecho. SQL: `docs/admin/herramientas_2.sql` |
| 11 | Editor de diálogos del Bufón (pestaña Bufón: textos) | 4 | Hecho. SQL: `docs/admin/bufon_textos.sql` |
| 14 | Actividad en vivo (pestaña En vivo) | 4 | Hecha (presencia, sin SQL) |
| 15 | Mensajes a jugadores | 4 | Hecho. SQL: `herramientas_2.sql` |
| 16 | Suspensión de cuentas | 4 | Hecha (suave: avisa y cierra la sesión). SQL: `herramientas_2.sql` |
| 17 | Respuestas a peticiones | 4 | Hechas. SQL: `herramientas_2.sql` |
| 22 | Gestor de imágenes y audio (pestaña Archivos) | 4 | Hecho. SQL: `herramientas_2.sql` |

## Fase 1

### Cambios (historial y deshacer)

`admin_cambios` guarda, por cada INSERT/UPDATE/DELETE de una tabla registrada, cómo estaba la fila antes y cómo quedó, con quién y cuándo (120 días). `admin_cambios_listar` y `admin_cambio_revertir` son solo para Admin. Revertir devuelve la fila a su estado anterior (o la borra / la vuelve a crear) y queda anotado como un cambio nuevo, así que se puede rehacer. Un UPDATE que no cambia nada no se anota.

Tablas registradas: `cartas_definiciones`, `cartas_catalogo`, `cartas_vinculos`, `musica_paginas`, `fanarts_side`, `fanarts_ocultos`, `fanarts_subidos`, `rocola_nombres`, `rocola_ocultas`, `rocola_fondos`. Para sumar otra: `select admin_registrar_tabla('mi_tabla', array['columna_clave'], 'Nombre legible');`.

No registra las tablas de la economía de cartas ni las de jugadores (tienen su propio registro).

### Copias

Descarga un JSON leyendo las tablas desde la sesión del Admin. «Solo contenido» o «Completa». Las tablas que no existen se anotan y se saltan. No incluye contraseñas (viven en Supabase Auth).

### Salud

Abre cada página en un marco invisible (sin sonido) y anota errores de código, recursos que no cargan e imágenes rotas. Una página se da por revisada 3,5 s después de que su HTML esté listo.

## Fase 2: contenido

Pestaña **Contenido**. Elige qué editar (entradas por categoría, cronología de cada Side, arcos, reglas, economía, novedades, pines del mapa), busca, y edita en un formulario: casillas para los campos principales, un editor de HTML con barra y vista previa para los textos largos, y una casilla JSON para el resto de campos.

Cómo funciona por dentro (`js/contenido-servidor.js`, va justo después de los `data/*.js` en cada página):

- La tabla `contenido_servidor` guarda un PARCHE por elemento: los campos que cambiaron respecto al archivo (un campo en `null` se quita), un elemento nuevo completo, o `borrado = true`.
- Al cargar, la página aplica al instante lo último que sabe (guardado en el navegador) y en segundo plano pregunta al servidor; si algo cambió, lo baja y se recarga una vez. Como mucho una consulta cada 20 segundos.
- «Volver al original» borra el parche. Un parche vacío se convierte en eso solo.
- Los archivos `data/*.js` siguen mandando en todo lo que no se parchea: si yo corrijo un texto en el archivo, se ve salvo que lo hayas editado tú.
- El identificador de un elemento nuevo solo admite minúsculas, números y guiones. La clave de las reglas es el título; la de la economía, categoría + nombre; la de las novedades, fecha + título; la de los pines, el id del lugar.

Probado: SQL en local (`sh docs/admin/probar_contenido.sh`) y mezcla en el navegador con filas simuladas. No probado: guardar con una sesión real de admin (aquí no hay).

El editor del mapa se abre al elegir «Mapa: pines»: arrastra un pin para moverlo, o elige un lugar sin pin y toca el mapa.

## Fase 4 (primera parte)

SQL: `docs/admin/herramientas_2.sql` (se prueba con `sh docs/admin/probar_herramientas2.sh`).

- **Interruptores**: tabla `sitio_interruptores`. Los scripts leen la última copia guardada en el navegador (`sitioInterruptores`) y `js/interruptores.js` la refresca; un cambio se nota en la siguiente página que abra cada jugador. Hay cuatro: el gorro del Bufón, su risita, la música de páginas y «En la taberna». Para sumar uno: añádelo a `INTERRUPTORES` en `js/admin-herramientas-2.js` y haz que el script lo lea con la misma fórmula.
- **Mensajes**: `admin_mensajes`. Para todos, un Side o una cuenta; con caducidad. `js/avisos-admin.js` (en las páginas de uso) los muestra una vez y recuerda cuáles vio la persona en su navegador.
- **Suspensión**: `cuentas_suspendidas`. Es suave: al abrir una página la cuenta ve el motivo y se le cierra la sesión, pero el servidor no le bloquea nada (quien sepa cómo podría saltarla). Para un bloqueo duro habría que condicionar las políticas RLS de cada tabla, o desactivar al usuario desde el panel de Supabase.
- **Respuestas a peticiones**: `peticiones.respuesta`; `peticiones_estado` ahora devuelve también la respuesta, que sale en «Tus peticiones».
- **Archivos**: bucket público `archivos` con escritura solo de Admin; copia el enlace de cada archivo para pegarlo en el HTML de una entrada.
- **En vivo**: usa la presencia de `js/presencia.js`, que ahora anuncia también la página real (vacía si es una escondida) y desde cuándo.

- Rocola de fondos (biblioteca de música de páginas, aparte de la Rocola pública, solo Admin): `docs/admin/musica_fondos.sql` (probado con `sh docs/admin/probar_musica_fondos.sh`), `js/musica-fondos.js`, pestaña «Música de fondo» y desplegable en el editor ⚙.

## Dificultad de los rivales

SQL: `docs/admin/rivales.sql` (se prueba con `sh docs/admin/probar_rivales.sh`). Pestaña **Rivales**: elige el juego y, por cada rival, cambia sus números (reflejos, precisión, vida, jugadas que mira por adelantado...). Los valores de fábrica se leen del propio archivo de cada juego
(`const RIVALES = ...`), así que no hay una segunda lista que se desincronice; lo que escribas se guarda en `rivales_ajustes` (un número o una lista corta por rival y campo) y cada juego lo pone encima al cargar (`js/rivales-ajustes.js`, que se llama justo después de definir `RIVALES`
en `ajedrez.js`, `arqueria.js` y `duelo.js`). Un valor que no encaja se ignora. Vacío = el de fábrica; «Volver al original» borra los cambios de ese rival. `node docs/pruebas-web/rivales.js` comprueba que el literal de cada juego se sigue pudiendo leer.
Las victorias ya registradas contra un rival siguen contando aunque lo hagas más fácil.

## Editor de diálogos del Bufón

SQL: `docs/admin/bufon_textos.sql` (se prueba con `sh docs/admin/probar_bufon_textos.sh`). Pestaña **Bufón: textos**: carga el diálogo de siempre (los mismos `data/bufon-*.js` de `secreto.html`) en un marco invisible y enseña sus nodos y los botones de elección; lo que guardes va a `bufon_textos`
(`n:<nodo>` = lista de líneas, `o:<elección>:<opción>` = texto del botón) y `secreto.html` lo pone encima al cargar (`js/bufon-textos.js`). Solo cambia texto, no ramas ni condiciones. Los nodos cuyas líneas calcula una función no se pueden editar. `node docs/pruebas-web/bufon_textos.js` comprueba que el diálogo real se puede recorrer y que los textos se aplican sin romperlo.
Mantén la voz de siempre al escribir (ver la memoria «Bufón voice rules»).

## Regalos y eventos (pestaña Regalos y eventos)

Archivos: `docs/admin/regalos_eventos.sql`, `js/admin-regalos.js`, y los avisos de la taberna en `js/avisos-taberna.js`. Pruebas: `docs/pruebas/t_regalos.sh` (después de `cargar_local.sh todo`).

- **Regalar una carta**: a una persona, a un Side o a todos. Pasa por `cartas_i_emitir` (límite global, límite por jugador, reserva, libro de movimientos). A quien no le cabe se le salta y el panel lista quién y por qué.
- **Regalar tokens de juego**: mismo reparto; queda en el libro de la billetera como «Regalo del admin».
- **Eventos**: título, texto, enlace a una página, Side, fecha de inicio y fin (máximo 120 días), y un regalo opcional (carta y/o tokens). En la taberna sale como chip en la franja de avisos mientras esté en marcha. Si lleva regalo, el chip es un botón «reclama tu regalo» que cada jugador usa una vez (`evento_reclamar`). Si la carta no cabe, el reclamo se deshace y puede volver a intentar. Con reclamos ya hechos no se puede cambiar el regalo (crea otro evento).
- Quitar un evento borra también sus reclamos.

## Calendario del Hipódromo (pestaña Calendario)

Solo lectura: las próximas 48 carreras de `hipodromo_programa` (hora local, grado, distancia, pista, bolsa y clima más probable). No se edita a propósito.

## Diálogos del Buhonero y del herrero (pestaña Diálogos)

SQL: `docs/admin/dialogos_personajes.sql` (se prueba con `sh docs/admin/probar_dialogos.sh` y `node docs/pruebas-web/dialogos_personajes.js`). Archivos: `js/admin-dialogos.js` (el editor),
`js/dialogos-personajes.js` (lo que aplica las frases guardadas en cada página, con caché local como el Bufón) y los propios personajes, `js/puesto-buhonero.js` y `js/forja-herrero.js`.

- Cada personaje tiene **grupos** de frases según el momento (saludar, cerrar un trato, golpear...). Cada grupo se edita aparte: añadir, cambiar y quitar frases, **Probar una** (enseña una al azar) y **Guardar**.
- Lo guardado **reemplaza** las frases de fábrica de ese grupo; **Volver a las de fábrica** borra la fila. Si guardas exactamente las de fábrica, tampoco se queda fila.
- Un grupo necesita al menos una frase (máximo 30, de hasta 240 letras). Los momentos no se pueden inventar: los define el código de cada personaje (`CUANDO` explica cuándo se usa cada uno).
- Los jugadores lo oyen en su siguiente visita. Si se añade un momento nuevo a un personaje, hay que darle también su texto en `CUANDO` (la prueba de Node lo comprueba).

## Excepciones de Side

SQL: `docs/admin/side_excepciones.sql` (se prueba con `sh docs/admin/probar_side_excepciones.sh`). Una cuenta de la tabla `side_excepciones` ve también el contenido del otro Side (entradas del compendio, subsecciones, cartas y los jugadores conectados del otro Side) sin ser Admin ni cambiar de Side. El sitio lo pregunta al iniciar sesión (`side_ve_ambos()`) y lo guarda en el navegador (`compendioVeAmbos`, `veAmbosLados()` en `js/lado.js`). Caro queda con la excepción al correr el SQL. Para otra cuenta: `select side_excepcion_dar('<id>', 'motivo');` y para quitarla `select side_excepcion_quitar('<id>');`. No cambia nada de lo que va por Side en el servidor (mensajes, eventos) ni el Bufón.
