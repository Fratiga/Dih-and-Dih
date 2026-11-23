# Ancho de banda de Supabase (egress)

El plan gratuito da 5,5 GB al mes de salida, más otros 5,5 GB de salida servida desde la caché del CDN. El 20 de noviembre de 2026 Supabase avisó que se pasó la cuota. Desde el 21 de diciembre de 2026 aplica la política de uso justo: si se sigue pasando, pueden restringir el servicio.

## Qué gastaba (registros del 18 al 22 de noviembre de 2026)

| Origen | Gasto por día | Motivo |
| --- | --- | --- |
| Música de fondo de las páginas (bucket `musica_fondos`) | 0,4 a 0,9 GB | `<audio preload="auto">` bajaba la canción entera en cada página, también con la música en silencio. El navegador no reutiliza bien las respuestas 206 (por trozos) del audio. Además hay FLAC de 25 a 28 MB. |
| Música del tablero (bucket `tablero`, mp3) | hasta 0,2 GB en días de partida | Mismo problema: cada jugador volvía a bajar la pista. |
| Fanarts (bucket `fanarts`) | hasta 0,1 GB | PNG de 1,5 a 6 MB. |
| Base de datos (REST) | muy poco | La Fractura ya usa un pulso liviano (`mesaPulso`). |

El CDN de Supabase no ayuda: una respuesta servida desde su caché (HIT) cuenta igual como «cached egress». Lo único que de verdad ahorra es que el navegador del jugador no vuelva a pedir el archivo, o que el archivo pese menos.

## Reglas para todo el código nuevo

1. **Audio de Supabase Storage: siempre por `AudioCache`** (`js/audio-cache.js`). `await AudioCache.obtener(url)` devuelve un `blob:` que se baja una sola vez por navegador y se guarda en la Cache Storage. Nunca `new Audio(urlDeSupabase)` ni `audio.src = urlDeSupabase` directo para música que suena más de una vez.
2. **No cargar audio que no va a sonar.** Nada de `preload="auto"` en audio de Supabase. Se pone el `src` solo cuando va a sonar de verdad (sin silencio, con la pestaña visible). Ver `sonar()` en `js/musica-paginas.js`.
3. **Imágenes: siempre por `ImagenCompacta`** (`js/imagen-compacta.js`) antes de subir. `await ImagenCompacta.reducir(archivo, { max, calidad })` pasa PNG y JPG pesados a WebP. Deja intactos los GIF, los WebP y los PNG animados.
4. **Toda subida con caché larga.** Con supabase-js: `cacheControl: "31536000"`. Con XHR o fetch directo: la cabecera `cache-control: max-age=31536000`. Los nombres de archivo llevan un id único, así que nunca se sobrescriben.
5. **Nada de `select("*")` en algo que se repite** (consultas periódicas, listas). Se piden solo las columnas que se usan. Para saber si algo cambió, una consulta mínima (como `mesaPulso`) y la fila entera solo cuando cambió.
6. **Consultas periódicas: lo más espaciadas posible**, y en pausa con la pestaña oculta (`document.hidden`).
7. **Nada de archivos fijos del sitio en Supabase.** Logos, fondos y música fija van en `assets/` del repo (GitHub Pages no cuenta para Supabase).

## Recompresión del audio (23 de noviembre de 2026)

Se pasaron a MP3 de 128 kbps 56 canciones: 45 de la Rocola de fondos (`musica_fondos`, incluidos los 8 FLAC) y las 11 del tablero que usa la gramola. Bajaron de 615 MB a 186 MB. Cada archivo nuevo lleva el sufijo `-128k.mp3` junto al original, y los enlaces de `musica_fondos`, `musica_paginas.config` y `tablero_estado` (gramola y música) apuntan a los nuevos. Se saltaron las 3 canciones que ya estaban cerca de 128 kbps. La Rocola pública (`rocola`) no se tocó, porque sus canciones sirven a juegos de ritmo y un cambio de codificación puede correr el compás unos milisegundos.

- Los originales se borraron de Supabase el mismo día, junto con 11 copias repetidas del tablero que no usaba nadie (de *Libra Creature Of Night* y *Valley Of Fools* se dejó una copia sin usar de cada una). El almacenamiento bajó a unos 360 MB.
- Los originales están respaldados en `%USERPROFILE%\respaldo-audio-supabase` (616 MB), fuera de OneDrive.
- Scripts en `tools/recomprimir-audio/`. `convertir.mjs` baja, respalda y codifica. `subir.mjs` sube o borra. Necesitan `npm install @breezystack/lamejs audio-decode` en esa carpeta y un `plan.json` con `[bucket, nombre, bytes]`. Para subir o borrar sin clave de servicio se crea una regla temporal de Storage para `anon` limitada a los nombres exactos, y se quita al terminar.
- Una petición HEAD a Storage responde `private, no-cache`. Es normal: la descarga (GET) sí responde `public, max-age=31536000`.

## Cómo medir

Con el MCP de Supabase, `query_logs` sobre `edge_logs`, agrupando por `log_attributes['request.path']` y sumando `log_attributes['response.headers.content_length']`. Ventanas de 24 horas como máximo. En el panel: Reports, luego Usage.
