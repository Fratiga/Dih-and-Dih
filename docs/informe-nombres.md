# Informe de nombres propios con variantes

Generado con `node tools/informe-nombres.js`. No se corrigió nada.

## Cómo se detectó

- Se barrieron 30 archivos: `data/*.js` y `cronologia-*.md`. Se quitaron las etiquetas HTML antes de buscar.
- Un nombre propio es una secuencia de palabras con mayúscula inicial, con espacio, guion medio o "de/del/de la" entre ellas. Se descartan las palabras que también aparecen en minúscula dos o más veces (palabras comunes al inicio de oración).
- **Grupo 1, mismas letras con otra forma**: variantes que solo difieren en tilde, mayúsculas, guiones, espacios, apóstrofos o título ("Dr." / "Doctor").
- **Grupo 2, posibles erratas**: nombres de una sola palabra que difieren en 1 letra (2 si tienen 9 o más) y de los cuales al menos uno aparece 3 veces o menos. Es una lista de sospechosos, muchos serán nombres distintos de verdad.

## Grupo 1: variantes de escritura


### Jumpscare

| variante | veces | archivos |
|---|---|---|
| Jumpscare | 22 | data/jumpscare.js (22) |
| JUMPSCARE | 2 | data/jumpscare.js (2) |

### Hubert Magnolia

| variante | veces | archivos |
|---|---|---|
| Hubert Magnolia | 11 | data/bufon-contenido.js (5), data/personajes.js (2), data/bufon-evidencia.js (1), data/cronologia-b.js (1), data/entries.js (1), cronologia-lado-b.md (1) |
| Dr. Hubert Magnolia | 1 | data/entries.js (1) |

### El Rostro

| variante | veces | archivos |
|---|---|---|
| El Rostro | 7 | data/bufon-contenido.js (5), data/bufon-voces.js (2) |
| EL ROSTRO | 1 | data/bufon-voces.js (1) |

### La Herida

| variante | veces | archivos |
|---|---|---|
| La Herida | 7 | data/bufon-contenido.js (5), data/bufon-voces.js (2) |
| LA HERIDA | 1 | data/bufon-voces.js (1) |

### El Apetito

| variante | veces | archivos |
|---|---|---|
| El Apetito | 4 | data/bufon-contenido.js (2), data/bufon-voces.js (2) |
| EL APETITO | 1 | data/bufon-voces.js (1) |

### Miembro de las Comadrejas

| variante | veces | archivos |
|---|---|---|
| Miembro de las Comadrejas | 3 | data/personajes.js (3) |
| Miembro de Las Comadrejas | 2 | data/personajes.js (2) |

### El Hilo

| variante | veces | archivos |
|---|---|---|
| El Hilo | 2 | data/bufon-contenido.js (1), data/bufon-voces.js (1) |
| EL HILO | 1 | data/bufon-voces.js (1) |

### LA COARTADA

| variante | veces | archivos |
|---|---|---|
| LA COARTADA | 1 | data/bufon-voces.js (1) |
| La Coartada | 1 | data/bufon-voces.js (1) |

### EL TESTIGO

| variante | veces | archivos |
|---|---|---|
| EL TESTIGO | 1 | data/bufon-voces.js (1) |
| El Testigo | 1 | data/bufon-voces.js (1) |

### LA GRIETA

| variante | veces | archivos |
|---|---|---|
| LA GRIETA | 1 | data/bufon-voces.js (1) |
| La Grieta | 1 | data/bufon-voces.js (1) |

### LA MURALLA

| variante | veces | archivos |
|---|---|---|
| LA MURALLA | 1 | data/bufon-voces.js (1) |
| La Muralla | 1 | data/bufon-voces.js (1) |

### When

| variante | veces | archivos |
|---|---|---|
| When | 1 | data/fanarts.js (1) |
| WHEN | 1 | data/fanarts.js (1) |

### Líder de Las Comadrejas

| variante | veces | archivos |
|---|---|---|
| Líder de Las Comadrejas | 1 | data/personajes.js (1) |
| Líder de las Comadrejas | 1 | data/personajes.js (1) |

## Grupo 2: posibles erratas (distancia de 1 o 2 letras)

| nombre A | veces | nombre B | veces | archivos donde aparece el menos frecuente |
|---|---|---|---|---|
| Pregúntame | 2 | Pregúntale | 1 | data/bufon-contenido.js (1) |
| Pregúntame | 2 | Preguntaste | 1 | data/bufon-contenido.js (1) |
| Confías | 3 | Confían | 1 | data/bufon-contenido.js (1) |
| Pregúntale | 1 | Preguntaste | 1 | data/bufon-contenido.js (1) |
| Desmontaje | 2 | Desmontar | 1 | data/entries.js (1) |
| Veylra | 2 | Veyla | 1 | data/entries.js (1) |
| Hilos | 1 | Hitos | 1 | data/pergaminos.js (1) |
| Atletismo | 15 | Ascetismo | 1 | data/entries.js (1) |
| Reencantar | 1 | Desencantar | 1 | data/entries.js (1) |
| Yaaay | 1 | Yaaayy | 1 | data/fanarts.js (1) |
| Embaucador | 3 | Emboscador | 1 | data/pergaminos.js (1) |
| Harto | 1 | Harta | 1 | data/personajes.js (1) |
| Grapple | 1 | Grappled | 1 | data/reglas.js (1) |
| Enganchado | 2 | Enganchadas | 1 | data/stats.js (1) |
