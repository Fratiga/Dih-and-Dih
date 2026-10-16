/* Sprites de los protagonistas que se sientan a la mesa de la taberna (js/taberna-mesa.js).
   Quien está conectado sale en la mesa con su nombre de jugador. Si aquí hay una entrada para ese nombre, se usa su sprite; si no, se
   dibuja la silueta provisional (assets/protagonistas/silueta.png).

   Formato: la clave es el nombre del jugador en minúsculas y sin tildes; el valor es { sprite, personaje }.
     sprite     ruta de un PNG de 32x48 px con fondo transparente, figura sentada de frente y los pies/asiento en el centro de la base
                (ancla: 16, 47). Se dibuja al doble de tamaño, sin suavizado. Mira docs/taberna.md.
     personaje  (opcional) nombre del personaje, que se ve al pasar el ratón por encima.

   Ejemplo (déjalo comentado hasta tener el PNG):
     "nombre del jugador": { sprite: "assets/protagonistas/nombre.png", personaje: "Nombre del personaje" }
*/
window.PROTAGONISTAS = {
};
