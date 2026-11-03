# Arte de Pitter-Patter

Mientras no haya arte definitivo, el juego dibuja muñecos provisionales en código. Para sustituir uno, deja el PNG aquí y añádelo a `manifest.json`.

## Personajes (chibis)

- Un solo PNG por personaje en `chibis/<id>.png` (el id es el de la carta, por ejemplo `bull`, `garra`, `hooey-magoo`).
- Fondo transparente, cuerpo entero, de frente, con los pies tocando la base. Proporción cercana a 4:5 (el juego lo ajusta a 256×320).
- El juego lo anima solo (respira, salta, se agranda al usar la habilidad, se encoge al perder). De ese PNG sale también la ficha del tablero y el retrato de la colección (se recorta la parte de arriba, donde está la cara), así que la cabeza debe quedar en el 60 % superior.
- En el manifiesto: `"chibis": { "bull": "chibis/bull.png" }`.

## Jefes

- Un PNG cuadrado por jefe en `jefes/<id>.png` (`kobold`, `dragarto`, `protodraco`, `basilisco`, `hidra`, `behemoth`, `kraken`, `dragon-de-magma`).
- Fondo transparente, de frente, con los pies abajo.
- En el manifiesto: `"jefes": { "kobold": "jefes/kobold.png" }`.

Los personajes jugables son los 16 de `app/src/pitter/datos/roster.ts`.

## Personajes por piezas (rig)

En vez de un solo PNG, un personaje puede venir en **piezas sueltas**, como los modelos originales de Pitter-Patter. Las piezas van en `rig/<id>/` junto a un `rig.json`, y el manifiesto lo apunta así: `"rigs": { "cassius-coldgrave": "rig/cassius-coldgrave/rig.json" }`.

- Cada pieza es un PNG recortado. El `rig.json` dice dónde va (`x`, `y` en un lienzo de 1000×1000), de qué pieza cuelga (`padre`), sobre qué punto gira (`pivote`) y el orden (de atrás hacia delante).
- Las **poses** (`idle`, `blink`, `feliz`, `dolor`, `poder`) son listas de transformaciones por pieza: `dx`, `dy`, `rot` (grados, sentido del reloj), `sx`, `sy`. Se ajustan en el JSON sin tocar código.
- De ahí salen las cinco expresiones del juego, el retrato (solo `retrato`: las piezas de la cabeza) y la ficha del tablero.
- `completo.png` es la referencia de cómo queda montado.

Cassius Coldgrave es el primero. Sus piezas: `pelo`, `capa`, `piernas`, `brazo_izq`, `brazo_der`, `torso`, `cabeza`, `sombrero`.
