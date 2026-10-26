# Mapa vectorial del mundo

Reconstrucción por capas del mapa de Azgaar (`assets/mapa/Boes_2026-03-26-23-45.png`). Los lugares siguen en `data/mapa.js` y sus fichas en `data/lugares.js`: el mapa no copia fichas.

## Archivos

| Archivo | Qué es |
|---|---|
| `js/mapa-vectorial.js` | Visor: SVG por capas, zoom y arrastre, iconos, buscador, filtros, plan B con el PNG |
| `js/mapa-editor.js`, `css/mapa-editor.css` | Editor (solo Admin, se carga al pulsar el lápiz) |
| `css/mapa-vectorial.css` | Estilos del visor |
| `data/mapa-mundo.json` | Mapa de partida (geografía, ríos, caminos, rutas, relieve, nombres) |
| `assets/mapa/mar.png` | El mar horneado (profundidad, aguas someras, oleaje) |
| `assets/mapa/iconos.svg` | Iconos de Azgaar (MIT, ver `LICENCIA-AZGAAR.txt`) |
| `docs/admin/mapa_mundo.sql` | Tabla `mapa_mundo` + historial, `mapa_guardar` con control de versión, `mapa_versiones`, `mapa_restaurar`, `mapa_version_datos` |

## Cómo se carga

1. Se pinta enseguida la última versión guardada que vio ese navegador (caché) o, si no hay, `data/mapa-mundo.json`.
2. Después, sin hacer esperar, se pregunta a Supabase por la versión guardada; si es otra, se cambia.
3. Si el JSON no carga, se muestra el PNG de siempre con los puntos de antes.

## Editor (Admin)

Herramientas: seleccionar y mover (nombres, relieve, lugares), puntos de costas, fronteras, ríos, caminos y rutas (los extremos compartidos se mueven juntos), reinos (nombre, color, ficha, pasar islas a otro reino), nombres nuevos, relieve con pincel, dibujar ríos/caminos/rutas, dibujar lagos y regiones. Deshacer/rehacer, guardar con nota, versiones (cargar para revisar o restaurar), exportar e importar JSON con validación, descartar. Al salir con cambios sin guardar pide confirmación.

Mover un lugar guarda solo su posición en `posiciones` del documento; la ficha no cambia.

## Pruebas hechas

- Segmentación: tierra/mar 99,9 %, reinos 98,9 % (peor: Broneland 93,8 %).
- SQL en Docker (`probar_mapa.sh`, base privada): 14 comprobaciones bien, y el mapa real completo se guarda.
- Editor en el navegador con eventos simulados: mover puntos, deshacer/rehacer, mover y cambiar nombres, poner relieve, dibujar un río, recolorear un reino, pasar una isla, guardar sin tabla (avisa).
- No medido: FPS reales con el panel visible.

## Funciones ocultas (hechas, solo las ve el Admin)

Se publican desde el editor, en «Más → Funciones para jugadores» (campo `ajustes.publico` del documento). Hoy están todas apagadas.

- **Regla de viaje**: botón de la regla. Marca puntos, doble clic termina. Da los km (4 km por píxel, la escala del original) y los días a pie lento, normal y rápido (29, 39 y 48 km al día, ritmos de D&D 5e) y en barco de vela (77 km al día).
- **Colorear por**: reinos, religión predominante, región o continente, con leyenda. Sale de los campos `religionPredominante` y `region` de las fichas de los reinos.
- **Épocas**: «Más → Épocas del mapa». Cada época es una copia de la geografía y los nombres que se edita aparte (`epocas` en el documento); al guardar, el presente queda siempre en su sitio. Las épocas nacen ocultas; no hay ninguna creada.
- **Visibilidad por lado**: cada nombre, relieve, río, camino, ruta, región y lago tiene «Visible para» (todos, Side A, Side B o solo el DM). Los lugares siguen la misma regla de Side que el resto de la web (`entryEsVisible`). El Admin lo ve todo y los reinos restringidos llevan un borde discontinuo.

## Pendiente

- Exportar a PNG y notas del DM.
- Regenerar desde el original: las herramientas viven en `scratchpad/mapa-vectorial/tools/` (no se suben).
