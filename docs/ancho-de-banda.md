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

## Cómo medir

Con el MCP de Supabase, `query_logs` sobre `edge_logs`, agrupando por `log_attributes['request.path']` y sumando `log_attributes['response.headers.content_length']`. Ventanas de 24 horas como máximo. En el panel: Reports, luego Usage.
