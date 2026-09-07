(function () {
  const form = document.getElementById("peticionForm");
  const textoInput = document.getElementById("peticionTexto");
  const nombreInput = document.getElementById("peticionNombre");
  const submitBtn = document.getElementById("peticionSubmit");
  const status = document.getElementById("peticionStatus");

  function mostrarStatus(texto, tipo) {
    status.textContent = texto;
    status.className = "peticion-status peticion-status-" + tipo;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const texto = textoInput.value.trim();
    if (!texto) return;

    submitBtn.disabled = true;
    mostrarStatus("Enviando...", "pendiente");

    try {
      await enviarPeticion({ texto, nombre: nombreInput.value.trim() });
      form.reset();
      mostrarStatus("Listo, la recibí. Gracias.", "ok");
    } catch (err) {
      mostrarStatus("Algo falló y no se pudo enviar. Prueba de nuevo en un rato.", "error");
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
