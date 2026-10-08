/* Avisos propios del sitio, en lugar de alert, confirm y prompt del navegador.
   Todo devuelve una promesa, así que se usa con await:

     await dialogo.avisar("Guardado.");
     if (!(await dialogo.confirmar("¿Borrar?", { peligro: true }))) return;
     const nombre = await dialogo.pedir("Nuevo nombre", actual);   // null si se cancela
     await dialogo.copiar("Copia esto a mano:", texto);

   El aspecto sale de las variables de cada página (--panel, --accent, --border,
   --font-heading...) y de la clase de tema del <body>; ver css/dialogos.css.
   Este archivo carga su propia hoja de estilos. Si hay varios avisos seguidos,
   se muestran uno tras otro. */
(function () {
  if (window.dialogo) return;

  // Hoja de estilos junto a este script (css/dialogos.css), sin que cada página la enlace.
  (function cargarEstilos() {
    const yo = document.currentScript;
    if (!yo || !yo.src) return;
    const url = yo.src.replace(/js\/dialogos\.js(\?.*)?$/, "css/dialogos.css$1");
    if (document.querySelector(`link[href="${url}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
  })();

  const cola = [];
  let abierto = false;

  function el(tag, clase, texto) {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function esError(msg) {
    return /^\s*no se (pudo|encontr|ha podido)|^\s*error|falló/i.test(String(msg));
  }

  function mostrar(cfg) {
    return new Promise(resolve => {
      cola.push({ cfg, resolve });
      if (!abierto) siguiente();
    });
  }

  function siguiente() {
    const item = cola.shift();
    if (!item) { abierto = false; return; }
    abierto = true;
    abrir(item.cfg, valor => {
      item.resolve(valor);
      setTimeout(siguiente, 0);
    });
  }

  function abrir(cfg, terminar) {
    const previo = document.activeElement;
    const fondo = el("div", "dlg-fondo");
    const caja = el("div", "dlg dlg-" + cfg.tipo + (cfg.peligro ? " dlg-peligro" : ""));
    caja.setAttribute("role", cfg.tipo === "confirmar" || cfg.tipo === "pedir" ? "dialog" : "alertdialog");
    caja.setAttribute("aria-modal", "true");
    const idTitulo = "dlg-t-" + Math.random().toString(36).slice(2, 8);
    const idMsg = "dlg-m-" + Math.random().toString(36).slice(2, 8);
    caja.setAttribute("aria-labelledby", idTitulo);
    caja.setAttribute("aria-describedby", idMsg);

    const cab = el("div", "dlg-cab");
    cab.appendChild(el("span", "dlg-icono", cfg.icono));
    const titulo = el("h2", "dlg-titulo", cfg.titulo);
    titulo.id = idTitulo;
    cab.appendChild(titulo);
    caja.appendChild(cab);

    const msg = el("p", "dlg-msg", cfg.mensaje);
    msg.id = idMsg;
    caja.appendChild(msg);

    let campo = null;
    if (cfg.tipo === "pedir" || cfg.tipo === "copiar") {
      campo = cfg.multilinea ? el("textarea", "dlg-campo") : el("input", "dlg-campo");
      if (!cfg.multilinea) campo.type = cfg.tipoCampo || "text";
      campo.value = cfg.valor || "";
      if (cfg.marcador) campo.placeholder = cfg.marcador;
      if (cfg.tipo === "copiar") campo.readOnly = true;
      campo.setAttribute("aria-labelledby", idMsg);
      caja.appendChild(campo);
    }
    const error = el("p", "dlg-error");
    error.hidden = true;
    caja.appendChild(error);

    const botones = el("div", "dlg-botones");
    let bCancelar = null;
    if (cfg.cancelar) {
      bCancelar = el("button", "dlg-btn dlg-btn-sec", cfg.cancelar);
      bCancelar.type = "button";
      botones.appendChild(bCancelar);
    }
    const bAceptar = el("button", "dlg-btn dlg-btn-pri", cfg.aceptar);
    bAceptar.type = "button";
    botones.appendChild(bAceptar);
    caja.appendChild(botones);
    fondo.appendChild(caja);

    let cerrado = false;
    function cerrar(valor) {
      if (cerrado) return;
      cerrado = true;
      document.removeEventListener("keydown", teclas, true);
      fondo.classList.add("dlg-saliendo");
      const quitar = () => {
        fondo.remove();
        if (previo && previo.focus && document.contains(previo)) { try { previo.focus({ preventScroll: true }); } catch (e) { /* sin foco */ } }
        terminar(valor);
      };
      if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) quitar();
      else setTimeout(quitar, 140);
    }

    function aceptar() {
      if (cfg.tipo === "pedir") {
        if (cfg.validar) {
          const problema = cfg.validar(campo.value);
          if (problema) { error.textContent = problema; error.hidden = false; campo.focus(); return; }
        }
        cerrar(campo.value);
      } else if (cfg.tipo === "copiar") {
        copiarTexto(cfg.valor).then(ok => {
          if (ok) cerrar(true);
          else { campo.focus(); campo.select(); error.textContent = "Selecciónalo y cópialo con Ctrl+C."; error.hidden = false; }
        });
      } else {
        cerrar(cfg.tipo === "confirmar" ? true : undefined);
      }
    }
    function cancelar() { cerrar(cfg.tipo === "confirmar" ? false : cfg.tipo === "pedir" ? null : undefined); }

    function teclas(e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancelar(); return; }
      if (e.key === "Enter" && !(e.target && e.target.tagName === "TEXTAREA") && !(e.target && e.target.tagName === "BUTTON")) {
        e.preventDefault(); e.stopPropagation(); aceptar(); return;
      }
      if (e.key === "Tab") {
        const foco = [...caja.querySelectorAll("input, textarea, button")].filter(x => !x.disabled);
        if (!foco.length) return;
        const i = foco.indexOf(document.activeElement);
        if (e.shiftKey && (i <= 0)) { e.preventDefault(); foco[foco.length - 1].focus(); }
        else if (!e.shiftKey && (i === foco.length - 1 || i === -1)) { e.preventDefault(); foco[0].focus(); }
      }
    }
    document.addEventListener("keydown", teclas, true);

    bAceptar.addEventListener("click", aceptar);
    if (bCancelar) bCancelar.addEventListener("click", cancelar);
    fondo.addEventListener("mousedown", e => { if (e.target === fondo && cfg.tipo === "avisar") cancelar(); });

    document.body.appendChild(fondo);
    requestAnimationFrame(() => fondo.classList.add("dlg-visible"));
    // En acciones que borran o descartan, el foco empieza en Cancelar.
    const inicial = campo || (cfg.peligro && bCancelar ? bCancelar : bAceptar);
    inicial.focus();
    if (campo) campo.select();
  }

  async function copiarTexto(texto) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(texto); return true; }
    } catch (e) { /* cae al plan B */ }
    return false;
  }

  const opcionesBase = o => (typeof o === "string" ? { titulo: o } : (o || {}));

  window.dialogo = {
    avisar(mensaje, opciones) {
      const o = opcionesBase(opciones);
      const error = o.tipoAviso ? o.tipoAviso === "error" : esError(mensaje);
      return mostrar({
        tipo: "avisar", mensaje: String(mensaje),
        titulo: o.titulo || (error ? "No se pudo" : "Aviso"),
        icono: error ? "!" : "i",
        aceptar: o.aceptar || "Entendido", cancelar: null, peligro: false
      });
    },
    confirmar(mensaje, opciones) {
      const o = opcionesBase(opciones);
      return mostrar({
        tipo: "confirmar", mensaje: String(mensaje),
        titulo: o.titulo || (o.peligro ? "¿Seguro?" : "Confirmar"),
        icono: o.peligro ? "!" : "?",
        aceptar: o.aceptar || "Aceptar", cancelar: o.cancelar || "Cancelar", peligro: !!o.peligro
      });
    },
    pedir(mensaje, valorInicial, opciones) {
      const o = opcionesBase(opciones);
      return mostrar({
        tipo: "pedir", mensaje: String(mensaje), valor: valorInicial == null ? "" : String(valorInicial),
        titulo: o.titulo || "Escribe un valor", icono: "✎",
        aceptar: o.aceptar || "Aceptar", cancelar: o.cancelar || "Cancelar",
        marcador: o.marcador, multilinea: !!o.multilinea, tipoCampo: o.tipoCampo, validar: o.validar, peligro: false
      });
    },
    /* Avisa antes de irse de la página con cambios sin guardar. Al tocar un enlace del sitio sale
       el aviso propio; cerrar la pestaña o recargar solo se puede frenar con el aviso del navegador,
       que ningún sitio puede cambiar. Uso: dialogo.protegerSalida({ hayCambios: () => bool, alSalir: fn }) */
    protegerSalida(opciones) {
      const o = opciones || {};
      let saliendo = false;
      const mensaje = o.mensaje || "Hay cambios sin guardar. Si sales ahora, se pierden.";
      document.addEventListener("click", async ev => {
        if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
        const a = ev.target.closest && ev.target.closest("a[href]");
        if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
        const href = a.getAttribute("href");
        if (!href || href.startsWith("#") || /^(javascript|mailto|tel):/i.test(href)) return;
        if (!o.hayCambios()) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        const ok = await window.dialogo.confirmar(mensaje, { titulo: o.titulo || "Salir sin guardar", aceptar: "Salir", cancelar: "Quedarme", peligro: true });
        if (!ok) return;
        saliendo = true;
        if (o.alSalir) o.alSalir();
        location.href = a.href;
      }, true);
      window.addEventListener("beforeunload", ev => {
        if (saliendo) return;
        if (o.alSalir) o.alSalir();
        if (o.hayCambios()) { ev.preventDefault(); ev.returnValue = ""; }
      });
    },
    // Texto para copiar a mano cuando el portapapeles no está disponible.
    copiar(mensaje, texto, opciones) {
      const o = opcionesBase(opciones);
      return mostrar({
        tipo: "copiar", mensaje: String(mensaje), valor: String(texto),
        titulo: o.titulo || "Copiar", icono: "⧉", multilinea: false,
        aceptar: o.aceptar || "Copiar", cancelar: o.cancelar || "Cerrar", peligro: false
      });
    }
  };
})();
