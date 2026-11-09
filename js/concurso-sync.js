/* =============================================================================
   CONCURSO — sincronización.
   - Cabina ↔ Programa (misma computadora): BroadcastChannel "concurso".
   - Cabina → jugadores remotos: Supabase (docs/admin/concurso.sql). La cabina
     publica con concurso_publicar (solo Admin) y avisa por un canal de
     Realtime; cada jugador relee lo suyo con concurso_jugador(token).
============================================================================= */
(function (CZ) {
  /* ---------------------------------------------------------------- canal local */
  const canal = "BroadcastChannel" in window ? new BroadcastChannel("concurso") : null;
  const oyentes = [];
  if (canal) canal.onmessage = ev => oyentes.forEach(f => f(ev.data));
  CZ.canal = {
    enviar(msg) { if (canal) canal.postMessage(msg); },
    escuchar(f) { oyentes.push(f); }
  };

  /* ---------------------------------------------------------------- jugadores remotos */
  /* Lo que ve cualquiera de la partida (sin notas ni consignas privadas). */
  function parteComun(p) {
    return {
      nombre: p.nombre, tema: p.tema,
      jugadores: p.jugadores.map(j => ({
        id: j.id, nombre: j.nombre, color: j.color, puntos: j.puntos,
        avatar: j.avatar && !j.avatar.startsWith("idb:") ? j.avatar : "",
        estados: j.estados
      }))
    };
  }
  /* Lo que solo ve cada jugador. */
  function partePrivada(j) {
    return {
      jugadorId: j.id, privado: j.privado || "",
      inventario: (j.inventario || []).map(c => ({ nombre: c.nombre, etiqueta: c.etiqueta, color: c.color, texto: c.texto, imagen: c.imagen && !c.imagen.startsWith("idb:") ? c.imagen : "" }))
    };
  }

  const remoto = {
    estado: "apagado",          // apagado | conectando | sin-sesion | sin-admin | sin-sql | conectado | error
    detalle: "",
    alCambiar: null,
    _sb: null, _canal: null, _canalId: null, _t: null, _pendiente: null, _ultimo: "",

    poner(estado, detalle) {
      this.estado = estado;
      this.detalle = detalle || "";
      if (this.alCambiar) this.alCambiar(estado, this.detalle);
    },

    async iniciar() {
      if (typeof fichasCliente !== "function") { this.poner("apagado"); return; }
      this.poner("conectando");
      try {
        this._sb = await fichasCliente();
        const { data } = await this._sb.auth.getSession();
        if (!data || !data.session) { this.poner("sin-sesion"); return; }
        const { data: admin, error } = await this._sb.rpc("fichas_es_admin");
        if (error || !admin) { this.poner("sin-admin"); return; }
        this.poner("conectado");
        if (this._pendiente) this.publicar(this._pendiente);
      } catch (e) {
        this.poner("error", e && e.message);
      }
    },

    /* Publica con un pequeño retraso para juntar cambios seguidos (por ejemplo, varios clics en +1). */
    publicar(p) {
      this._pendiente = p;
      if (this.estado !== "conectado" && this.estado !== "sin-sql" && this.estado !== "error") return;
      clearTimeout(this._t);
      this._t = setTimeout(() => this._enviar(), 450);
    },

    async _enviar() {
      const p = this._pendiente;
      if (!p || !this._sb) return;
      const comun = parteComun(p);
      const jugadores = p.jugadores.map(j => ({ token: j.token, datos: partePrivada(j) }));
      const firma = JSON.stringify([p.id, comun, jugadores]);
      if (firma === this._ultimo) return;
      const { error } = await this._sb.rpc("concurso_publicar", { p_id: p.id, p_publico: comun, p_jugadores: jugadores });
      if (error) {
        const falta = /concurso_publicar|does not exist|schema cache/i.test(error.message || "");
        this.poner(falta ? "sin-sql" : "error", error.message);
        return;
      }
      this._ultimo = firma;
      if (this.estado !== "conectado") this.poner("conectado");
      await this._avisar(p.id);
    },

    async _avisar(id) {
      if (this._canalId !== id) {
        if (this._canal) this._sb.removeChannel(this._canal);
        this._canal = this._sb.channel("concurso-" + id);
        this._canalId = id;
        await new Promise(res => this._canal.subscribe(s => { if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT") res(); }));
      }
      try { await this._canal.send({ type: "broadcast", event: "cambio", payload: { t: Date.now() } }); } catch (e) { /* el sondeo de los jugadores lo cubre */ }
    }
  };
  CZ.remoto = remoto;

  /* Enlace personal de un jugador. */
  CZ.enlaceJugador = function (j) {
    const base = location.href.replace(/[^/]*([?#].*)?$/, "");
    return base + "concurso-jugador.html?t=" + encodeURIComponent(j.token);
  };
})(window.CZ);
