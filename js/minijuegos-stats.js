/* Estadísticas y rankings compartidos por los minijuegos (Duelo y Ajedrez).
   Guarda cada partida en la cuenta del jugador (tabla mj_estadisticas, ver
   scratchpad/minijuegos_estadisticas.sql) y arma las listas de ranking. Sin
   sesión iniciada el juego funciona igual, pero no se registra nada.
   Requiere js/fichas-supabase.js. */
(function () {
  let sesion = null;
  let nombre = "";

  async function cargarSesion() {
    try {
      sesion = await fichasSesionActual();
      if (sesion) {
        const supabase = await fichasCliente();
        const { data } = await supabase.from("perfiles").select("username").eq("user_id", sesion.user.id).maybeSingle();
        nombre = (data && data.username) || "";
      }
    } catch (e) {
      sesion = null;
    }
    return { sesion, nombre };
  }

  /* Anota una partida. resultado: "gana" | "pierde" | "tablas".
     extra: { suma: {...}, max: {...}, min: {...} } con estadísticas numéricas. */
  async function registrar(juego, clave, resultado, extra = {}) {
    if (!sesion) return { guardado: false, motivo: "sin-sesion" };
    try {
      const supabase = await fichasCliente();
      const { error } = await supabase.rpc("mj_registrar", {
        p_juego: juego, p_clave: clave, p_resultado: resultado,
        p_suma: extra.suma || {}, p_max: extra.max || {}, p_min: extra.min || {}
      });
      if (error) throw error;
      return { guardado: true };
    } catch (e) {
      return { guardado: false, motivo: "error" };
    }
  }

  async function filas(juego) {
    const supabase = await fichasCliente();
    const { data, error } = await supabase
      .from("mj_estadisticas")
      .select("user_id, username, clave, partidas, victorias, derrotas, tablas, suma, maximo, minimo")
      .eq("juego", juego);
    if (error) throw error;
    return data || [];
  }

  /* Junta las filas (una por rival) en un registro por jugador. */
  function agrupar(lista) {
    const porUsuario = new Map();
    lista.forEach(f => {
      let u = porUsuario.get(f.user_id);
      if (!u) {
        u = { id: f.user_id, username: f.username, partidas: 0, victorias: 0, derrotas: 0, tablas: 0, suma: {}, maximo: {}, minimo: {}, porClave: {} };
        porUsuario.set(f.user_id, u);
      }
      u.partidas += f.partidas; u.victorias += f.victorias; u.derrotas += f.derrotas; u.tablas += f.tablas;
      Object.entries(f.suma || {}).forEach(([k, v]) => { u.suma[k] = (u.suma[k] || 0) + Number(v); });
      Object.entries(f.maximo || {}).forEach(([k, v]) => { u.maximo[k] = Math.max(u.maximo[k] ?? -Infinity, Number(v)); });
      Object.entries(f.minimo || {}).forEach(([k, v]) => { u.minimo[k] = Math.min(u.minimo[k] ?? Infinity, Number(v)); });
      u.porClave[f.clave] = f;
    });
    return [...porUsuario.values()];
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* definiciones: [{ titulo, valor(u) -> número|null, formato(n) -> texto, menorEsMejor }] */
  function pintar(contenedor, usuarios, definiciones) {
    contenedor.innerHTML = definiciones.map(d => {
      const items = usuarios
        .map(u => ({ nombre: u.username, v: d.valor(u) }))
        .filter(x => x.v !== null && x.v !== undefined && Number.isFinite(x.v) && x.v > 0)
        .sort((a, b) => (d.menorEsMejor ? a.v - b.v : b.v - a.v))
        .slice(0, 10);
      const lista = items.length
        ? items.map(i => `<li class="${i.nombre === nombre ? "yo" : ""}"><span>${esc(i.nombre)}</span><strong>${esc(d.formato ? d.formato(i.v) : i.v)}</strong></li>`).join("")
        : `<li class="sacrificio-vacio">Todavía no hay nadie.</li>`;
      return `<div class="sacrificio-ranking"><h3>${esc(d.titulo)}</h3><ol class="sacrificio-lista">${lista}</ol></div>`;
    }).join("");
  }

  async function cargarYPintar(juego, contenedor, definiciones) {
    try {
      const usuarios = agrupar(await filas(juego));
      // definiciones puede ser una función que arma los rankings según los datos (rankings por rival, por jugador...)
      pintar(contenedor, usuarios, typeof definiciones === "function" ? definiciones(usuarios) : definiciones);
    } catch (e) {
      contenedor.innerHTML = `<p class="sacrificio-vacio">El ranking no está disponible por ahora.</p>`;
    }
  }

  window.MjStats = {
    cargarSesion,
    registrar,
    cargarYPintar,
    haySesion: () => !!sesion,
    miNombre: () => nombre
  };
})();
