/* Dónde está el servidor de Estocatta (el que decide los combates en línea).
   Mientras esté vacío, el modo en línea avisa de que falta configurarlo y el modo local
   (dos jugadores en el mismo navegador) funciona igual. Al desplegar el servidor, escribe
   aquí su dirección con wss://, por ejemplo "wss://estocatta.onrender.com".
   Para probar con un servidor propio sin tocar este archivo se puede abrir la página con
   ?servidor=ws://localhost:8787 (solo se aceptan direcciones locales por esa vía). */
window.ESTOCATTA_SERVIDOR = "";
