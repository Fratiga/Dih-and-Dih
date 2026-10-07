/* Páginas escondidas: por ahora solo las abre el admin. Se carga en el <head>
   para sacar a cualquier otro antes de que la página se dibuje. Para abrir una
   página a todos, quita este script de su HTML.
   data-permite="clave": además del admin, deja pasar a quien tenga esa marca en
   localStorage (un rol que el sitio guarda al iniciar sesión, ver lado.js). El
   servidor sigue siendo el que manda: esto solo decide qué se ve. */
(function () {
  const extra = document.currentScript && document.currentScript.dataset.permite;
  let pasa = false;
  try {
    pasa = localStorage.getItem("compendioAdmin") === "1" || (!!extra && localStorage.getItem(extra) === "1");
  } catch (e) { /* sin almacenamiento */ }
  if (!pasa) location.replace("minijuegos.html");
})();
