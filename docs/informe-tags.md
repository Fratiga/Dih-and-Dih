# Informe de tags

## Convención aplicada

- Minúsculas, sin espacios, con guion medio entre palabras (por ejemplo `cuerpo-a-cuerpo`).
- Las tildes y la ñ se conservan. Los tags se muestran tal cual en las tarjetas y en los filtros, y quitarlas ("montana", "dracónico" → "draconico") empeoraría el texto visible. Ya hay muchos tags con tilde que funcionan como etiqueta del filtro del mapa (`montaña`, `región`, `volcán`, `río`, `prisión`).
- Se revisaron los 336 tags distintos (2831 usos) de `data/*.js`. No había mezcla de mayúsculas ni de estilos como `side-a` / `lado-a` / `NPC` / `npc`. Todos eran ya minúsculas, `side-a`, `side-b` y `npc` se usan siempre así. Lo único que no cumplía la convención eran tags con espacios.

## Cambios

| tag antes | tag después | veces | archivo |
|---|---|---|---|
| `cuerpo a cuerpo` | `cuerpo-a-cuerpo` | 28 | data/armas.js |
| `a distancia` | `a-distancia` | 9 | data/armas.js |
| `orden religiosa` | `orden-religiosa` | 10 | data/facciones.js |
| `orden militar` | `orden-militar` | 4 | data/facciones.js |
| `orden marcial` | `orden-marcial` | 2 | data/facciones.js |
| `maldición ancestral` | `maldición-ancestral` | 1 | data/razas.js |
| `proteccion` | `protección` | 6 | data/objetos.js |

Total: 60 usos cambiados en 4 archivos. El último es una corrección de ortografía (ver `docs/informe-ortografia.md`), no de formato.

## Código que compara tags

Se buscó en `js/` y en los `.html` (sin tocar los archivos de la sesión Cartas) todo lo que filtre o compare por un tag concreto.

| lugar | qué hacía | acción |
|---|---|---|
| `armas.html` (TAG_GROUPS, grupo "Alcance") | listaba `cuerpo a cuerpo` y `a distancia` | actualizado a `cuerpo-a-cuerpo` y `a-distancia` |
| `objetos.html` (TAG_GROUPS, grupo "Categoría") | listaba `proteccion` | actualizado a `protección` |
| `facciones.html` (TAG_GROUPS, grupo "Tipo") | listaba `orden religiosa` y `orden militar` | actualizado a `orden-religiosa` y `orden-militar` |
| `js/ostelar-datos.js` línea 25 | `tags.includes("a distancia")` | actualizado a `"a-distancia"` |
| `js/mapa.js` | compara con `capital`, `catedral`, `fortaleza`, `torre`, `prisión`, `aldea`, `reino`, `imperio`, `provincia`, `ciudad-estado`, `región`, `continente`, `isla`, `bosque`, `montaña`, `volcán`, `río`, `lago`, `ciudad` | sin cambios, ya cumplían |
| `js/ostelar-datos.js` línea 148 | compara con `marcial` | sin cambios |
| `js/compendio.js`, `js/busqueda-global.js`, `js/modal.js` | leen los tags sin compararlos con valores fijos | sin cambios |
| `js/admin-personajes.js` | genera tags desde un campo de texto | sin cambios |

Nota: `orden-marcial` no está en ningún grupo de `facciones.html`, así que sigue apareciendo en "Otras características", igual que antes.

## Sin tocar

- Los tags con tilde (`acuático`, `dracónico`, `mágico`, `montaña`, etc.) quedan como están. Si prefieres una versión sin tildes, es un cambio fácil de aplicar pero implica tocar `js/mapa.js`.
