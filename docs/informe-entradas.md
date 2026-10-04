# Informe de entradas incompletas

Generado con `node tools/informe-entradas.js`. No se modificó ningún dato.

Se marca una entrada cuando:

- **sin summary**: falta el campo.
- **summary vacío**: existe pero está en blanco.
- **sin tags**: falta el campo o la lista está vacía.
- **sin lado**: falta el campo `lado` o la lista está vacía.
- **summary más largo que el contenido**: el summary tiene más caracteres que el texto de `content` (sin etiquetas HTML).

## Resumen

- `data/personajes.js`: 51 entradas, 0 con algún problema. Sin problemas.
- `data/lugares.js`: 372 entradas, 1 con algún problema. Ninguna entrada tiene el campo `lado` (esta colección no lo usa), por eso no se marca. summary más largo que el contenido: 1.
- `data/bestiario.js`: 294 entradas, 1 con algún problema. Ninguna entrada tiene el campo `lado` (esta colección no lo usa), por eso no se marca. sin tags: 1.

## data/personajes.js

Ninguna entrada con problemas.

## data/lugares.js

| id | título | problemas |
|---|---|---|
| dimveil | Dimveil | summary más largo que el contenido (62 frente a 4 caracteres) |

## data/bestiario.js

| id | título | problemas |
|---|---|---|
| pancholin | Pancholin | sin tags |
