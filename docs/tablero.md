# Tablero (tablero.html)

Tablero de juego propio que imita la interfaz de Roll20 para que los jugadores no tengan que aprender nada nuevo.
Solo el DJ navega entre páginas; todos los jugadores ven a la vez la página que él elige.

## Archivos

| Archivo | Qué hace |
|---|---|
| `tablero.html` | Página (pantalla completa, sin la cabecera del compendio) |
| `css/tablero.css` | Estilo claro con acento magenta, como Roll20 |
| `js/tablero.js` | La app: carga, sincronización, deshacer, portapapeles, teclado y comandos del chat |
| `js/tablero-red.js` | Red: Supabase (normal) o local (`?local=1`, todo en el navegador; `&jugador=1` simula a un jugador) |
| `js/tablero-lienzo.js` | Lienzo con Konva: capas, fichas con barras, nombres y auras, cuadrícula, máscara, dibujo, texto, medida y señales |
| `js/tablero-fx.js` | Efectos con partículas (los tipos y colores del panel de Efectos de Roll20) |
| `js/tablero-dados.js` | Dados en modo local y cómo se pintan las tiradas en el chat |
| `js/tablero-ventanas.js` | Ventanas flotantes, modales, menús, fichitas de jugadores y editor con formato |
| `js/tablero-paneles.js` | Barra de herramientas, paneles que salen de ella, zoom, orden de turno, ajustes de ficha, menú de una ficha, páginas |
| `js/tablero-lado.js` | Pestañas de la derecha: chat, arte, diario, compendio, gramola, macros y ajustes |
| `docs/admin/tablero.sql` | Tablas, RLS y funciones. Se corre en Supabase |
| `docs/pruebas/t_tablero.sh` | Pruebas del SQL en la base local |

## Seguridad

Lo decide el servidor (RLS), no la interfaz:

- La capa del DJ, las notas del DJ (de fichas y del diario) y las tiradas secretas no llegan nunca a un jugador.
- Un jugador ve solo la página de los jugadores. Mueve las fichas que controla (`tablero_mover`), cambia barras si el
  DJ lo permite (`tablero_barra`), dibuja y escribe en la capa de fichas (`tablero_crear_propio`) y borra solo lo suyo.
- Las tiradas se hacen en el servidor (`tablero_i_tirar`), también las de iniciativa y las tiradas en línea `[[...]]`.
- Los valores de las barras que el DJ marca como «no ver» sí llegan al navegador (están en `datos`); solo se ocultan al
  pintar. Para algo secreto de verdad están las notas del DJ.

## Probar

```bash
BD=tablero sh docs/pruebas/cargar_local.sh && BD=tablero sh docs/pruebas/t_tablero.sh
```

En el navegador, sin Supabase: `tablero.html?local=1` (DJ) y en otra pestaña `tablero.html?local=1&jugador=1`.

## Pendiente

- Iluminación dinámica (muros, luces, visión por personaje). Hoy está la máscara manual.
- Enlazar las barras a atributos de la ficha (`fichas_personajes`).
- Tinte en imágenes de otros sitios sin permisos CORS (en las propias y en las de Supabase funciona).
- Listas de reproducción en la gramola (hoy: una pista a la vez de `data/musica.js`).
