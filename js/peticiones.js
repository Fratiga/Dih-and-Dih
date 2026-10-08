(function () {
  const form = document.getElementById("peticionForm");
  const textoInput = document.getElementById("peticionTexto");
  const quien = document.getElementById("peticionQuien");
  const submitBtn = document.getElementById("peticionSubmit");
  const status = document.getElementById("peticionStatus");

  function mostrarStatus(texto, tipo) {
    status.textContent = texto;
    status.className = "peticion-status peticion-status-" + tipo;
  }

  /* Tus peticiones: se guardan en este navegador con su código para poder preguntar
     si ya fueron atendidas. */
  const CLAVE = "compendioMisPeticiones";
  function leerMias() { try { return JSON.parse(localStorage.getItem(CLAVE) || "[]") || []; } catch (e) { return []; } }
  function guardarMias(lista) { try { localStorage.setItem(CLAVE, JSON.stringify(lista.slice(0, 30))); } catch (e) { /* sin almacenamiento */ } }
  function esc(t) { return String(t).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])); }

  /* Quién envía: ya no se puede mandar sin cuenta. La petición va con el nombre de usuario de la cuenta. */
  let cuenta = null;   // { nombre } cuando hay sesión iniciada
  async function nombreDeLaCuenta(sesion) {
    try {
      const supabase = await fichasCliente();
      const { data } = await supabase.from("perfiles").select("username").eq("user_id", sesion.user.id).maybeSingle();
      if (data && data.username) return data.username;
    } catch (err) { /* se usa lo que haya guardado */ }
    return (typeof nombreUsuario === "function" && nombreUsuario()) || (sesion.user.email || "").split("@")[0] || "";
  }
  function pintarQuien() {
    quien.innerHTML = cuenta
      ? `Se enviará con el nombre de tu cuenta: <strong>${esc(cuenta.nombre)}</strong>.`
      : "Para enviar una petición tienes que iniciar sesión: se manda con el nombre de tu cuenta.";
  }
  pintarQuien();
  if (typeof fichasEnCambioDeSesion === "function") {
    fichasEnCambioDeSesion(async sesion => {
      cuenta = sesion ? { nombre: await nombreDeLaCuenta(sesion) } : null;
      pintarQuien();
    }).catch(() => { /* sin conexión: queda el aviso de iniciar sesión */ });
  }

  const caja = document.createElement("section");
  caja.className = "peticion-mias hidden";
  form.insertAdjacentElement("afterend", caja);

  async function pintarMias() {
    const mias = leerMias();
    if (!mias.length) { caja.classList.add("hidden"); return; }
    try {
      const estados = await peticionesEstado(mias.map(m => m.codigo));
      const porCodigo = new Map(estados.map(e => [e.codigo, e.atendida]));
      mias.forEach(m => { if (porCodigo.has(m.codigo)) m.atendida = porCodigo.get(m.codigo); });
      guardarMias(mias);
    } catch (err) { /* sin conexión o sin el SQL: se muestra lo último que se supo */ }
    caja.classList.remove("hidden");
    caja.innerHTML = `<h3>Tus peticiones</h3>` + mias.map(m => `
      <div class="peticion-mia ${m.atendida ? "atendida" : ""}">
        <span class="peticion-mia-estado">${m.atendida ? "✔ Atendida" : "… Pendiente"}</span>
        <span class="peticion-mia-texto">${esc(m.texto.length > 140 ? m.texto.slice(0, 140) + "…" : m.texto)}</span>
      </div>`).join("");
    // las que ya viste atendidas dejan de avisar en el lobby
    guardarMias(mias.map(m => (m.atendida ? { ...m, visto: true } : m)));
  }
  pintarMias();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const texto = textoInput.value.trim();
    if (!texto) return;

    // La sesión se vuelve a mirar al enviar: pudo vencer mientras se escribía
    let sesion = null;
    try { sesion = await fichasSesionActual(); } catch (err) { sesion = null; }
    if (!sesion) {
      cuenta = null; pintarQuien();
      mostrarStatus("Inicia sesión para enviar tu petición. Tu texto se queda aquí.", "error");
      return;
    }
    const nombre = await nombreDeLaCuenta(sesion);
    if (!nombre) { mostrarStatus("No se pudo leer el nombre de tu cuenta. Prueba de nuevo.", "error"); return; }

    submitBtn.disabled = true;
    mostrarStatus("Enviando...", "pendiente");

    try {
      const codigo = await enviarPeticion({ texto, nombre });
      if (codigo) { guardarMias([{ codigo, texto, atendida: false, visto: false }, ...leerMias()]); pintarMias(); }
      form.reset();
      mostrarStatus("Listo, la recibí. Gracias.", "ok");
    } catch (err) {
      mostrarStatus("Algo falló y no se pudo enviar. Prueba de nuevo en un rato.", "error");
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
