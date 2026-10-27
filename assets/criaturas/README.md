# Criaturas de los corrales

Cada criatura que se puede criar sale en su hábitat con el archivo `assets/criaturas/<id de la carta>.png`
(por ejemplo `rata.png`, `cuervo-del-augurio.png`, `mamut-gelido.png`). Si falta el archivo se usa `generica.png`.

- PNG con fondo transparente, **mirando a la derecha** y con los pies tocando la base de la imagen.
- Recomendado: 32 x 32 px (se dibuja a 4x, con píxeles nítidos, entre ~100 y ~150 unidades de ancho según el sitio). Sirve cualquier tamaño cuadrado.
- Los archivos que hay ahora son siluetas de prueba (una forma por hábitat, un color por especie). Se sustituyen por el pixel art propio con el mismo nombre.
- Los que faltan se crean con `python tools/criaturas_placeholder.py` (no pisa ningún PNG que ya exista, salvo `generica.png`).
- Una criatura nueva del catálogo: añade su PNG con el id de la carta y, para que aparezca en un corral, configúrala en Admin → Economía → Crianza.
