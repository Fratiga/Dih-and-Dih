/* =============================================================================
   MENÚ LATERAL DEL ADMIN
   Las pestañas del panel (#adminTabs, cada una con su data-tab) pasan de una fila interminable a un menú a la izquierda con grupos que se pliegan.
   Los botones son los mismos (con sus contadores y los eventos que ya tienen): aquí solo se mueven a su grupo, así que ningún panel cambia.
     • Cada grupo enseña, si hay algo que atender (peticiones pendientes, jugadores que esperan, cartas sin límite, avisos de salud...), un número suma de eso.
     • «Ir a...» filtra por nombre mientras escribes (Enter abre la primera coincidencia; la tecla / lleva a la caja).
     • Se acuerda de la última pestaña y de los grupos que dejaste abiertos.
   Una pestaña nueva que no esté en la lista de abajo se pone sola en el grupo «Otros».
============================================================================= */
(function () {
  const barra = document.getElementById("adminTabs");
  if (!barra) return;
  const GRUPOS = [
    ["Pendientes", ["peticiones", "fanarts", "muerte", "mensajes", "envivo"]],
    ["Jugadores", ["cuentas", "personajes", "historial", "regalos"]],
    ["Contenido del sitio", ["contenido", "archivos", "musicafondos", "ocultos"]],
    ["Triunfos y economía", ["cartas", "economia", "balance", "calendario"]],
    ["Bufón", ["bufon", "lab", "bufontextos", "dialogos"]],
    ["Juegos", ["rivales"]],
    ["Sistema", ["sistema", "interruptores", "cambios", "copias", "salud"]]
  ];
  // Pestañas cuyo contador cuenta cosas por atender (el de las demás es solo un total)
  const CON_ALERTA = new Set(["peticiones", "muerte", "bufon", "economia", "sistema", "salud"]);
  const CLAVE_PESTANA = "adminUltimaPestana", CLAVE_GRUPOS = "adminGruposAbiertos";
  const guardado = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } return null; };

  const botones = new Map([...barra.querySelectorAll("[data-tab]")].map(b => [b.dataset.tab, b]));
  const usados = new Set(GRUPOS.flatMap(g => g[1]));
  const otros = [...botones.keys()].filter(t => !usados.has(t));
  const grupos = GRUPOS.concat(otros.length ? [["Otros", otros]] : []);
  const abiertos = new Set(String(guardado(CLAVE_GRUPOS) || "").split("|").filter(Boolean));

  const buscar = document.createElement("input");
  buscar.type = "search"; buscar.id = "adminBuscarPestana"; buscar.className = "admin-buscar"; buscar.placeholder = "Ir a...  (/)"; buscar.setAttribute("aria-label", "Ir a una sección del Admin"); buscar.autocomplete = "off";
  barra.setAttribute("aria-label", "Secciones del Admin");
  barra.textContent = "";
  barra.appendChild(buscar);

  const refs = grupos.map(([nombre, tabs]) => {
    const caja = document.createElement("div"); caja.className = "admin-grupo"; caja.dataset.grupo = nombre;
    const cab = document.createElement("button"); cab.type = "button"; cab.className = "admin-grupo-cab"; cab.innerHTML = `<span>${nombre}</span><span class="admin-grupo-alerta" title="Cosas por atender en este grupo"></span>`;
    const lista = document.createElement("div"); lista.className = "admin-grupo-lista";
    tabs.forEach(t => { if (botones.has(t)) lista.appendChild(botones.get(t)); });
    caja.append(cab, lista); barra.appendChild(caja);
    cab.addEventListener("click", () => { alternar(caja); });
    return { nombre, caja, cab, lista, tabs: tabs.filter(t => botones.has(t)) };
  }).filter(g => g.tabs.length);

  function alternar(caja, abrir) {
    const ahora = abrir === undefined ? !caja.classList.contains("abierto") : abrir;
    caja.classList.toggle("abierto", ahora);
    caja.querySelector(".admin-grupo-cab").setAttribute("aria-expanded", String(ahora));
    if (ahora) abiertos.add(caja.dataset.grupo); else abiertos.delete(caja.dataset.grupo);
    guardado(CLAVE_GRUPOS, [...abiertos].join("|"));
  }
  const grupoDe = btn => btn.closest(".admin-grupo");

  /* El número de cosas por atender de cada grupo sale de los contadores de sus pestañas (el primer número de «18 pendientes de 48», «3 esperan»...) */
  function numero(btn) {
    const b = btn.querySelector(".admin-tab-badge");
    const m = b && b.textContent.match(/\d+/);
    return m ? parseInt(m[0], 10) : 0;
  }
  function esAlerta(btn) {
    const b = btn.querySelector(".admin-tab-badge"), t = b ? b.textContent : "";
    if (!t) return false;
    if (btn.dataset.tab === "bufon") return /esperan/.test(t);   // sin nadie esperando enseña «N jugadores», que es un total
    return CON_ALERTA.has(btn.dataset.tab);
  }
  function actualizarAlertas() {
    refs.forEach(g => {
      const total = g.tabs.reduce((s, t) => s + (esAlerta(botones.get(t)) ? numero(botones.get(t)) : 0), 0);
      const pastilla = g.cab.querySelector(".admin-grupo-alerta");
      const nuevo = total ? String(total) : "";
      if (pastilla.textContent !== nuevo) pastilla.textContent = nuevo;   // solo si cambia, para no disparar otra vez al observador
    });
  }
  new MutationObserver(actualizarAlertas).observe(barra, { childList: true, characterData: true, subtree: true });
  actualizarAlertas();

  /* Abrir una pestaña abre su grupo y la recuerda */
  barra.addEventListener("click", ev => {
    const b = ev.target.closest("[data-tab]");
    if (!b) return;
    guardado(CLAVE_PESTANA, b.dataset.tab);
    const g = grupoDe(b);
    if (g && !g.classList.contains("abierto")) alternar(g, true);
  });

  /* Búsqueda por nombre */
  function filtrar() {
    const q = buscar.value.trim().toLowerCase();
    refs.forEach(g => {
      let visibles = 0;
      g.tabs.forEach(t => {
        const b = botones.get(t), si = !q || b.textContent.toLowerCase().includes(q) || g.nombre.toLowerCase().includes(q);
        b.hidden = !si; if (si) visibles++;
      });
      g.caja.hidden = !visibles;
      if (q) g.caja.classList.add("abierto"); else g.caja.classList.toggle("abierto", abiertos.has(g.nombre) || !!g.caja.querySelector(".admin-tab.active"));
    });
  }
  buscar.addEventListener("input", filtrar);
  buscar.addEventListener("keydown", ev => {
    if (ev.key === "Enter") { const primero = barra.querySelector(".admin-tab:not([hidden])"); if (primero) { primero.click(); buscar.value = ""; filtrar(); } }
    else if (ev.key === "Escape") { buscar.value = ""; filtrar(); buscar.blur(); }
  });
  document.addEventListener("keydown", ev => {
    if (ev.key !== "/" || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const t = ev.target, escribiendo = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    if (escribiendo || !barra.offsetParent) return;
    ev.preventDefault(); buscar.focus();
  });

  /* Estado inicial: la última pestaña que usaste (o la que ya estaba activa) y su grupo abierto */
  const ultima = guardado(CLAVE_PESTANA);
  const inicial = botones.get(ultima) || barra.querySelector(".admin-tab.active") || botones.get("peticiones");
  refs.forEach(g => g.caja.classList.toggle("abierto", abiertos.has(g.nombre)));
  if (inicial) {
    if (!inicial.classList.contains("active")) inicial.click(); else guardado(CLAVE_PESTANA, inicial.dataset.tab);
    const g = grupoDe(inicial); if (g) alternar(g, true);
  }
  refs.forEach(g => g.cab.setAttribute("aria-expanded", String(g.caja.classList.contains("abierto"))));
})();
