/* Aviso de retos: si otro jugador te retó a ajedrez o a arquería, sale un aviso
   pequeño con un enlace al menú de partidas. Se carga en el hub de minijuegos y en
   las páginas de cada juego. Necesita js/fichas-supabase.js; sin sesión iniciada,
   o si aún no se corrió el SQL de las partidas, no hace nada. */
(function () {
  if (typeof fichasSesionActual !== "function" || typeof fichasCliente !== "function") return;

  const JUEGOS = [
    { tabla: "ajedrez_partidas", pagina: "ajedrez.html", nombre: "ajedrez", retador: f => f.retador, quien: (f, yo) => (f.blancas === yo ? f.nombre_negras : f.nombre_blancas), lobby: "#ajModoJugadores" },
    { tabla: "arqueria_partidas", pagina: "arqueria.html", nombre: "arquería", retador: f => f.a, quien: f => f.nombre_a, lobby: "#arqueriaLobby" }
  ];
  const CLAVE_VISTOS = "compendioAvisosRetos";

  let supa = null;
  let miId = null;
  let aviso = null;
  const accesibles = {};

  function vistos() {
    try { return new Set(JSON.parse(sessionStorage.getItem(CLAVE_VISTOS) || "[]")); } catch (e) { return new Set(); }
  }
  function marcarVisto(ids) {
    try { sessionStorage.setItem(CLAVE_VISTOS, JSON.stringify([...new Set([...vistos(), ...ids])])); } catch (e) { /* sin almacenamiento */ }
  }

  // Una página "oculta" (js/oculto.js) manda a quien no es admin de vuelta al hub: no avisar de ella
  async function abierta(pagina) {
    if (localStorage.getItem("compendioAdmin") === "1") return true;
    if (!(pagina in accesibles)) {
      try {
        const html = await fetch(pagina, { cache: "no-store" }).then(r => r.text());
        accesibles[pagina] = !html.includes("js/oculto.js");
      } catch (e) { accesibles[pagina] = false; }
    }
    return accesibles[pagina];
  }

  function quitar() {
    if (aviso) { aviso.remove(); aviso = null; }
  }

  async function revisar() {
    const retos = [];
    for (const j of JUEGOS) {
      let data = null;
      try {
        const r = await supa.from(j.tabla).select("*").eq("estado", "pendiente");
        data = r.data;
      } catch (e) { data = null; }
      for (const f of data || []) {
        if (j.retador(f) === miId) continue;
        if (!(await abierta(j.pagina))) continue;
        // En la propia página, con el menú de partidas a la vista, el reto ya aparece ahí
        const aqui = location.pathname.endsWith("/" + j.pagina) || location.pathname.endsWith(j.pagina);
        const lobby = aqui && document.querySelector(j.lobby);
        if (lobby && !lobby.classList.contains("hidden")) continue;
        retos.push({ id: f.id, juego: j, quien: j.quien(f, miId) });
      }
    }
    const pendientes = retos.filter(r => !vistos().has(r.id));
    quitar();
    if (!pendientes.length) return;
    const primero = pendientes[0];
    aviso = document.createElement("div");
    aviso.className = "mj-aviso-reto";
    aviso.setAttribute("role", "status");
    aviso.innerHTML = `
      <span><strong></strong> te retó a ${primero.juego.nombre}${pendientes.length > 1 ? ` (y hay ${pendientes.length - 1} más)` : ""}.</span>
      <a href="${primero.juego.pagina}#jugadores">Ver</a>
      <button type="button" aria-label="Cerrar">×</button>`;
    aviso.querySelector("strong").textContent = primero.quien || "Alguien";
    aviso.querySelector("button").addEventListener("click", () => { marcarVisto(pendientes.map(r => r.id)); quitar(); });
    aviso.querySelector("a").addEventListener("click", () => { marcarVisto(pendientes.map(r => r.id)); });
    document.body.appendChild(aviso);
  }

  (async function iniciar() {
    try {
      const sesion = await fichasSesionActual();
      if (!sesion) return;
      miId = sesion.user.id;
      supa = await fichasCliente();
      await revisar();
      let espera = null;
      const programar = () => { clearTimeout(espera); espera = setTimeout(revisar, 300); };
      for (const j of JUEGOS) {
        supa.channel("aviso-" + j.tabla).on("postgres_changes", { event: "*", schema: "public", table: j.tabla }, programar).subscribe();
      }
      setInterval(() => { if (!document.hidden) revisar(); }, 30000);
    } catch (e) { /* sin aviso: el menú de partidas sigue funcionando */ }
  })();
})();
