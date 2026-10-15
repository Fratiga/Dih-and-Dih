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
| 6, 7 | Balance y prueba de cartas | 3 | Pendiente |
| 8 | Dificultad de los rivales | 3 | Pendiente |
| 9, 10 | Regalos y eventos, calendario del Hipódromo | 3 | Pendiente (coordinar con las sesiones de Economía e Hipódromo) |
| 12 | Interruptores del sitio | 4 | Hecho. SQL: `docs/admin/herramientas_2.sql` |
| 11 | Editor de diálogos del Bufón | 4 | Pendiente |
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
