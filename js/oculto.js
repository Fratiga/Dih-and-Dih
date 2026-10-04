/* Páginas escondidas: por ahora solo las abre el admin. Se carga en el <head>
   para sacar a cualquier otro antes de que la página se dibuje. Para abrir una
   página a todos, quita este script de su HTML. */
if (localStorage.getItem("compendioAdmin") !== "1") location.replace("minijuegos.html");
