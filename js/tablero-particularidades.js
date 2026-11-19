/* =============================================================================
   TABLERO — particularidades de página: reglas especiales que solo valen en las páginas que las tienen
   asignadas (opciones.particularidades de la página, un array de ids). Cada una se registra aquí con
   entrar / actualizar / salir; al cambiar de página se apaga la anterior (sin relojes sueltos) y se
   enciende la nueva. La primera es la Grieta de Dexter (tablero-grieta.js).
============================================================================= */
(function () {
  const tipos = new Map();
  const activas = new Map();   // id -> { def, escenaId }
  let TB = null;

  function registrar(id, def) { tipos.set(id, def); if (TB && def.iniciar) def.iniciar(TB); }
  function lista() { return [...tipos.entries()].map(([id, d]) => ({ id, nombre: d.nombre, descripcion: d.descripcion || "" })); }
  function de(escena) {
    const l = escena && escena.opciones && escena.opciones.particularidades;
    return Array.isArray(l) ? l.filter(x => tipos.has(x)) : [];
  }
  function sincronizar(escena) {
    const eid = escena ? escena.id : null;
    const quiero = new Set(de(escena));
    activas.forEach((a, id) => {
      if (quiero.has(id) && a.escenaId === eid) return;
      try { a.def.salir(); } catch (e) { console.error("[particularidad]", id, e); }
      activas.delete(id);
    });
    quiero.forEach(id => {
      const a = activas.get(id);
      try {
        if (a) { if (a.def.actualizar) a.def.actualizar(escena); }
        else { const def = tipos.get(id); activas.set(id, { def, escenaId: eid }); def.entrar(escena); }
      } catch (e) { console.error("[particularidad]", id, e); }
    });
    TB.lanzar("particularidades", [...activas.keys()]);
  }
  function iniciar(tb) {
    TB = tb;
    tipos.forEach(d => { if (d.iniciar) d.iniciar(TB); });
    TB.on("antesDeEscena", () => sincronizar(null));
    TB.on("escena", e => sincronizar(e));
    TB.on("escenaActual", e => sincronizar(e));
  }

  window.TBParticularidades = { registrar, lista, de, iniciar, activa: id => activas.has(id), sincronizar: () => sincronizar(TB && TB.escena()) };
})();
