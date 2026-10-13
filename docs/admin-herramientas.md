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
| 1, 3 | Editor de entradas del compendio + Side | 2 | Pendiente |
| 2 | Editor de cronología | 2 | Pendiente |
| 5 | Editor de reglas, economía y estadísticas | 2 | Pendiente |
| 4 | Editor de pines del mapa | 2 | Pendiente |
| 13 | Anuncios y novedades | 2 | Pendiente |
| 6, 7 | Balance y prueba de cartas | 3 | Pendiente |
| 8 | Dificultad de los rivales | 3 | Pendiente |
| 9, 10 | Regalos y eventos, calendario del Hipódromo | 3 | Pendiente (coordinar con las sesiones de Economía e Hipódromo) |
| 11, 12 | Editor de diálogos del Bufón e interruptores | 4 | Pendiente |
| 14 a 17 | Actividad en vivo, mensajes, bloqueo de cuentas, respuestas a peticiones | 4 | Pendiente |
| 22 | Gestor de imágenes y audio | 4 | Pendiente |

## Fase 1

### Cambios (historial y deshacer)

`admin_cambios` guarda, por cada INSERT/UPDATE/DELETE de una tabla registrada, cómo estaba la fila antes y cómo quedó, con quién y cuándo (120 días). `admin_cambios_listar` y `admin_cambio_revertir` son solo para Admin. Revertir devuelve la fila a su estado anterior (o la borra / la vuelve a crear) y queda anotado como un cambio nuevo, así que se puede rehacer. Un UPDATE que no cambia nada no se anota.

Tablas registradas: `cartas_definiciones`, `cartas_catalogo`, `cartas_vinculos`, `musica_paginas`, `fanarts_side`, `fanarts_ocultos`, `fanarts_subidos`, `rocola_nombres`, `rocola_ocultas`, `rocola_fondos`. Para sumar otra: `select admin_registrar_tabla('mi_tabla', array['columna_clave'], 'Nombre legible');`.

No registra las tablas de la economía de cartas ni las de jugadores (tienen su propio registro).

### Copias

Descarga un JSON leyendo las tablas desde la sesión del Admin. «Solo contenido» o «Completa». Las tablas que no existen se anotan y se saltan. No incluye contraseñas (viven en Supabase Auth).

### Salud

Abre cada página en un marco invisible (sin sonido) y anota errores de código, recursos que no cargan e imágenes rotas. Una página se da por revisada 3,5 s después de que su HTML esté listo.
