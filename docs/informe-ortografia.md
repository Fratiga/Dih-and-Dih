# Informe de ortografía

## Qué se corrigió

Solo errores inequívocos en texto visible. El resto del texto ya estaba bien acentuado.

| archivo | cambio | veces |
|---|---|---|
| data/objetos.js | tag `proteccion` → `protección` | 6 |
| objetos.html | grupo de filtro "Categoría": `proteccion` → `protección` (debe coincidir con el tag) | 1 |
| data/stats.js | `tipo: "Draconico"` → `"Dracónico"` | 7 |
| data/bufon-musica.js | comentario con voseo que quedó de la primera ronda: "Agregá" → "Agrega" | 1 |

## Qué se revisó y salió limpio

- Palabras sin tilde que sí existen con tilde en el resto del sitio (acción, sesión, reacción, etc.): todas las apariciones restantes son identificadores de código, ids, clases CSS, anclas (`#cap-conclusion`), claves de datos o nombres de archivo, no texto visible. No se tocaron.
- Palabras sin tilde que son correctas como verbos o adjetivos (continua, perdida, seria, valida, limite, interprete, practica y similares): sin cambios.
- Abreviaturas de chat (q, xq, pq, tmb, xfa): ninguna en texto visible.
- Dobles espacios en prosa: ninguno. Los que hay son alineación de código y comentarios.
- Signos de apertura ¿ y ¡: las preguntas sin ¿ en la misma línea son preguntas que abren en una línea anterior.
- Faltas de bulto como "dió", "fué", "vió", "guión", "porqué": ninguna.

## Dudoso: ya resuelto

- **"sólo" con tilde** (218 apariciones): cambiado a "solo", como en el resto del sitio.
- **Demostrativos con tilde** (20 apariciones: éste, ésta, ésa, éstos y similares): cambiados a "este", "esta", "esa", "estos", etc.

## Dudoso, sin cambiar

### Mayúsculas sin tilde en js/fichas-pdf-roll20.js (2 apariciones)

Son claves con las que se busca el texto en el PDF de Roll20, no texto que se vea en pantalla. Si el PDF las trae sin tilde, cambiarlas rompería la importación.

| archivo | línea | contexto |
|---|---|---|
| js/fichas-pdf-roll20.js | 132 | const ATRIBUTOS = [["FUERZA", "fue"], ["DESTREZA", "des"], ["CONSTITUCION", "con"], ["INTELIGENCIA", "int"], ["SABIDURIA", "sab"], ["C |
| js/fichas-pdf-roll20.js | 132 | "des"], ["CONSTITUCION", "con"], ["INTELIGENCIA", "int"], ["SABIDURIA", "sab"], ["CARISMA", "car"]]; |
