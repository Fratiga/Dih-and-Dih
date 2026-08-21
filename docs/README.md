# Compendio D&D

Wiki pública para jugadores.

## Cómo usarla

1. Abre `index.html` en un navegador (o cualquier otra página `.html` del sitio).
2. Añade entradas en el archivo de `data/` que corresponda según el tipo (ver abajo).
3. Los `id` deben ser únicos entre todas las colecciones, no solo dentro de cada archivo (se usan para referencias cruzadas, ej. la facción de un personaje).
4. Mantén fuera de esta versión cualquier secreto de GM. En particular: nunca pongas estadísticas de combate (PV, CA, tiradas, daño) de monstruos/NPCs — el Bestiario solo describe comportamiento y un nivel de amenaza cualitativo, nunca los números crudos.
5. Si una entrada viene de un documento fuente que inventa países/regiones ficticias (como el libro de Bestiario), no menciones esos nombres de lugar en el sitio — conserva solo el tipo de hábitat (bosque, desierto, zona volcánica, etc.).

## Estructura del sitio

El sitio es multi-página: cada ítem de la barra de navegación superior es un archivo `.html` propio, no una sección dentro de una sola página.

- `index.html` — Compendio: todas las entradas mezcladas, buscables.
- `mapa.html` — mapa interactivo del mundo con pines clicables sobre `mapa/Boes_2026-03-26-23-45.png`; cada pin abre el mismo modal de detalle que el resto del sitio con la ficha completa del Lugar.
- `cronologia.html` — crónica de lo que le fue ocurriendo al grupo, narrada como capítulos de un libro (no como una bitácora de sesiones). Sin buscador ni modal: se lee de corrido, capítulo tras capítulo.
- `lugares.html`, `facciones.html`, `personajes.html`, `textos.html`, `pergaminos.html`, `armas.html`, `bestiario.html`, `razas.html`, `religion.html` — una página por categoría, mismo buscador/grid/modal que el Compendio pero acotado a esa categoría.
- `reglas.html` — referencia rápida de reglas (movimiento, acciones, estados, etc.), desde `data/reglas.js`.
- `armas.html` también incluye un glosario estático (propiedades, tipos de daño, monedas) arriba del grid de armas.
- `fanarts.html` — galería de imágenes de `fanarts/`.
- `rocola.html` — reproductor de música de `musica/`, con mini-reproductor persistente (aleatorio, sin repetir hasta agotar la lista) visible en el resto de las páginas.

Todas comparten el mismo header/nav (duplicado en cada archivo, a propósito: el sitio no usa servidor, así que no hay forma de compartir un parcial de HTML sin romper la regla de "abrir con doble clic") y la misma lógica en `js/`:

- `js/common.js` — carrusel de imágenes del header, `prettyName`/`fmtTime`. Se carga en todas las páginas.
- `js/player.js` — motor de audio compartido (mezcla aleatoria, persistencia entre páginas, mini-reproductor). Se carga en todas las páginas.
- `js/modal.js` — todo lo compartido para mostrar el detalle de una entrada: `ALL_ENTRIES` (mezcla de las nueve colecciones), `entryTitleById` (resuelve referencias cruzadas), `cardMeta`/`modalExtraMeta` y `openEntryModal`. Se carga en `index.html`, las 9 páginas de categoría y `mapa.html`, siempre antes de `js/compendio.js` o `js/mapa.js`.
- `js/compendio.js` — grid, búsqueda y filtro por etiquetas; llama a `openEntryModal` de `js/modal.js` al hacer clic en una tarjeta. Se carga en `index.html` y en las 9 páginas de categoría; cada página de categoría fija `window.PAGE_CATEGORY` antes de cargarlo para acotar el contenido.
- `js/mapa.js` — pinta los pines de `data/mapa.js` sobre la imagen del mapa y abre `openEntryModal` al clickearlos. Solo en `mapa.html`.
- `js/cronologia.js` — ordena `window.CRONOLOGIA` por `orden` y pinta cada capítulo directamente en la página (sin modal, se lee como un libro). Solo en `cronologia.html`.
- `js/fanarts.js`, `js/rocola.js`, `js/reglas.js` — lógica específica de cada una de esas páginas.

## Formato de una entrada

Hay nueve colecciones, cada una en su propio archivo dentro de `data/`. Todas comparten estos campos base:

- `id`: identificador único (en todo el sitio, no solo en el archivo).
- `title`: nombre visible.
- `category`: categoría (`"Personajes"`, `"Lugares"`, `"Facciones"`, `"Pergaminos"`, `"Armas"`, `"Bestiario"`, `"Razas"`, `"Religión"`, o libre para `entries.js`).
- `tags`: etiquetas.
- `summary`: resumen mostrado en las tarjetas.
- `content`: contenido HTML de la entrada.

**`data/entries.js`** (`window.ENTRIES`) — hoy contiene únicamente la categoría Textos: 46 tratados académicos del mundo ("Fundamentos de la X" / "Principios de X"), cada uno con prefacio, capítulos numerados, conclusión y glosario complementario. Solo los campos base.

**`data/personajes.js`** (`window.PERSONAJES`) — además: `retrato`, `titulo`, `raza`, `tipo` (Jugador/NPC/Histórico), `lugarOrigen` (id de un lugar), `ocupacion`, `faccion` (id de una facción), `primeraAparicion`, `relacionesConocidas` (`[{id, nota}]`).

**`data/lugares.js`** (`window.LUGARES`) — además: `region`, `gobierno`, `religionPredominante`, `lugaresDestacados` (lista de strings).

**`data/facciones.js`** (`window.FACCIONES`) — además: `tipo`, `region`, `ideologia`, `miembrosConocidos` (lista de ids), `relaciones` (`[{id, signo: "aliado"|"conflicto"|"neutral", nota}]`).

**`data/pergaminos.js`** (`window.PERGAMINOS`) — Escuelas de combate/magia/filosofía y pergaminos legendarios. Solo los campos base.

**`data/armas.js`** (`window.ARMAS`) — además: `daño`, `tipoDano`, `alcance`, `peso`, `coste`, `propiedades` (lista de strings).

**`data/bestiario.js`** (`window.BESTIARIO`) — además: `clasificacion` (rol narrativo, ej. "Depredador"), `amenaza` (nivel de peligro cualitativo, ej. "Alta" — nunca estadísticas de combate reales). 287 entradas: los 5 monstruos propios de la campaña (Colmillo Gris, Colmillo Menor, Guillotina, Kobold, Dragarto) más las 282 criaturas del libro *Bestiario* de Yamada Kazuhiro (los 6 capítulos completos), recalibradas a la escala de amenaza propia del sitio (Ninguna/Baja/Moderada/Alta/Muy Alta/Extrema/Trascendente) sin mencionar nunca el sistema de estrellas original del doc, y sin nombrar ninguna de las regiones ficticias que aparecen en ese libro (solo se conservan las descripciones de hábitat).

**`data/razas.js`** (`window.RAZAS`) — razas y culturas jugables. Además: `region`, `gobierno`, `religionPredominante`, `lugaresDestacados` (lista de strings) — los mismos campos que Lugares, ya que razas.html describe pueblos/razas, no aldeas (las aldeas viven en `data/lugares.js` con tag `"aldea"`).

**`data/religiones.js`** (`window.RELIGIONES`) — 12 religiones del mundo, deliberadamente distintas en su eje moral (no variaciones de "adoramos cosas distintas"): Kaneísmo, Morthenia, Salmuria, Aderismo, Ortheísmo, Neravia, Heliurgia, Talasia, Iurismo, Vharismo, Edrasia y Korvath. Además de los campos base: `simbolo`, `principio` (la frase-lema de la fe), `muerte` y `eternos` (su postura teológica específica frente a los Eternos), mostrados como metadatos junto al título. Los nombres son **provisionales** — el plan es reemplazarlos por nombres propios de la cultura/país donde nació cada una una vez se decida esa asignación, y clasificar cada una como internacional, dominante en un país o minoritaria. La entrada general "Eternos" (que resumiría cómo la interpreta cada religión) se dejó fuera a propósito por ahora.

Los campos que referencian otra entrada (`lugarOrigen`, `faccion`, `relacionesConocidas`, `miembrosConocidos`, `relaciones`) guardan el `id` de esa entrada; el sitio resuelve el título automáticamente al mostrarlo.

**`data/mapa.js`** (`window.MAPA_PUNTOS`) — no es una colección de entradas, sino los pines del mapa: una lista de `{ lugarId, x, y }` donde `lugarId` es el `id` de un Lugar existente en `data/lugares.js` y `x`/`y` son porcentajes (0–100) de posición sobre `mapa/Boes_2026-03-26-23-45.png`. Si un pin queda mal ubicado, es cuestión de ajustar esos dos números.

**`data/cronologia.js`** (`window.CRONOLOGIA`) — tampoco es una colección de entradas del Compendio: es la lista de capítulos de la crónica, cada uno `{ id, orden, numero, title, fecha, content }`. `orden` controla el orden en que se muestran (no hace falta que coincida con el orden de creación en el archivo). `content` se redacta siempre como narración de libro — sin lenguaje de sesión de rol ("los jugadores", "combate", nombres de mecánicas) y sin nada que sea secreto de GM (ningún Acto futuro, ninguna estadística).

## Próximas mejoras recomendadas

- filtros por región y época;
- versión GM separada y protegida;
- panel para añadir/editar entradas sin tocar código.
