/* =============================================================================
   CONCURSO — vista de un jugador (concurso-jugador.html?t=TOKEN). Lee lo suyo
   con concurso_jugador(token) y vuelve a leer cuando la cabina avisa por el
   canal de Realtime (y cada 15 s por si el aviso se pierde). No tiene ningún
   control: solo muestra.
============================================================================= */
(function () {
  const raiz = document.getElementById("jugador");
  const token = new URLSearchParams(location.search).get("t") || "";
  let sb = null, partidaId = null, canal = null, ultimo = "";

  function pintarError(texto) {
    raiz.innerHTML = `<div class="czj-vacio"><h1>Sin conexión con la partida</h1><p>${CZ.esc(texto)}</p></div>`;
  }

  async function leer() {
    if (!sb) return;
    const { data, error } = await sb.rpc("concurso_jugador", { p_token: token });
    if (error) { pintarError("No se pudo leer la partida. Avisa al anfitrión."); return; }
    if (!data) { pintarError("Este enlace no pertenece a ninguna partida activa. Pídele uno nuevo al anfitrión."); return; }
    const firma = JSON.stringify(data);
    if (firma === ultimo) return;
    ultimo = firma;
    pintar(data);
    if (data.partida !== partidaId) escuchar(data.partida);
  }

  function escuchar(id) {
    if (canal) sb.removeChannel(canal);
    partidaId = id;
    canal = sb.channel("concurso-" + id).on("broadcast", { event: "cambio" }, () => leer()).subscribe();
  }

  const puntosAntes = new Map();

  function pintar(d) {
    const pub = d.publico || {}, priv = d.privado || {};
    const jugadores = (pub.jugadores || []).slice();
    const yo = jugadores.find(j => j.id === priv.jugadorId);
    document.body.setAttribute("data-tema", pub.tema || "madera");
    document.title = (yo ? yo.nombre + " · " : "") + (pub.nombre || "Concurso");
    if (!yo) { pintarError("Ya no estás en esta partida."); return; }
    const ranking = jugadores.sort((a, b) => b.puntos - a.puntos);
    const puesto = ranking.findIndex(j => j.id === yo.id) + 1;
    const antes = puntosAntes.get(yo.id);
    raiz.innerHTML = `
      <header class="czj-cab"><span>${CZ.esc(pub.nombre || "Concurso")}</span></header>
      <section class="czj-yo" style="--cz-jc:${CZ.esc(yo.color)}">
        <div class="czj-avatar"></div>
        <div class="czj-datos">
          <div class="czj-nombre">${CZ.esc(yo.nombre)}</div>
          <div class="czj-puesto">${puesto}.º de ${ranking.length}</div>
          <div class="czj-estados">${(yo.estados || []).map(s => `<span class="cz-estado" style="--cz-ec:${CZ.esc(s.color || "#e8453c")}">${CZ.esc(s.texto)}${s.turnos ? ` <b>${CZ.esc(s.turnos)}</b>` : ""}</span>`).join("")}</div>
        </div>
        <div class="czj-puntos"><span class="czj-n">${antes == null ? yo.puntos : antes}</span><small>puntos</small></div>
      </section>
      ${priv.privado ? `<section class="czj-secreto"><h2>Solo para ti</h2><p>${CZ.esc(priv.privado)}</p></section>` : ""}
      ${(priv.inventario || []).length ? `<section class="czj-inv"><h2>Tus cartas y objetos</h2><div class="czj-cartas">${priv.inventario.map(c => `
        <div class="czj-carta" style="--cz-cc:${CZ.esc(c.color || "#e8453c")}">
          <div class="czj-carta-cab"><b>${CZ.esc(c.nombre)}</b>${c.etiqueta ? `<i>${CZ.esc(c.etiqueta)}</i>` : ""}</div>
          ${c.imagen ? `<div class="czj-carta-ilus" style="background-image:url('${CZ.esc(c.imagen)}')"></div>` : ""}
          ${c.texto ? `<p>${CZ.esc(c.texto)}</p>` : ""}
        </div>`).join("")}</div></section>` : ""}
      <section class="czj-tabla">
        <h2>Clasificación</h2>
        <ol>${ranking.map(j => `<li class="${j.id === yo.id ? "czj-soy" : ""}" style="--cz-jc:${CZ.esc(j.color)}"><span class="czj-mini" data-j="${CZ.esc(j.id)}"></span><b>${CZ.esc(j.nombre)}</b><em>${j.puntos}</em></li>`).join("")}</ol>
      </section>`;
    raiz.querySelector(".czj-avatar").appendChild(CZ.avatar(yo, "czj-av"));
    raiz.querySelectorAll(".czj-mini").forEach(n => { const j = ranking.find(x => x.id === n.dataset.j); n.appendChild(CZ.avatar(j)); });
    const num = raiz.querySelector(".czj-n");
    num.dataset.v = antes == null ? yo.puntos : antes;
    CZ.contar(num, yo.puntos);
    puntosAntes.set(yo.id, yo.puntos);
  }

  async function iniciar() {
    if (!token) { pintarError("Falta el código de jugador en el enlace."); return; }
    try {
      sb = await fichasCliente();
    } catch (e) {
      pintarError("No se pudo conectar. Revisa tu conexión y recarga.");
      return;
    }
    await leer();
    setInterval(leer, 15000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) leer(); });
  }
  iniciar();
})();
