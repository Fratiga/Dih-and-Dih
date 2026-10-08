/* Volumen común de los minijuegos: un control flotante (silenciar + barra) en cada página
   y un volumen maestro que se recuerda entre páginas.

   No hace falta que cada juego sepa que existe. Este archivo se carga en el <head>, antes
   que el resto, y por debajo intercepta el sonido:
   - Cualquier <audio> o new Audio(): lo que el juego pone en .volume se multiplica por el
     volumen maestro. El juego sigue leyendo y escribiendo su propio valor (por ejemplo
     0.6) sin enterarse.
   - Cualquier sonido de Web Audio (AudioContext) que se conecte a la salida pasa antes por
     una ganancia maestra.
   Así, la música o los efectos que se agreguen más adelante quedan controlados sin tocar
   nada aquí. Las páginas de Muerte Súbita y del Encuentro con Verdam tienen su propio
   control y no cargan este archivo. */
(function () {
  const CLAVE_VOLUMEN = "mjVolumen";
  const CLAVE_SILENCIO = "mjSilencio";

  function leer(clave, porDefecto) {
    try {
      const v = localStorage.getItem(clave);
      return v === null ? porDefecto : v;
    } catch (e) { return porDefecto; }
  }
  function guardar(clave, valor) {
    try { localStorage.setItem(clave, String(valor)); } catch (e) { /* sin almacenamiento */ }
  }
  const limitar = n => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

  let volumen = limitar(parseFloat(leer(CLAVE_VOLUMEN, "0.8")));
  let silenciado = leer(CLAVE_SILENCIO, "0") === "1";
  const maestro = () => (silenciado ? 0 : volumen);
  const oyentes = [];

  /* --- <audio> y new Audio() ------------------------------------------------ */
  const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "volume");
  const pedido = new WeakMap(); // el volumen que el juego cree que tiene
  const medios = [];            // WeakRef a los elementos ya controlados

  function controlar(el) {
    if (!pedido.has(el)) {
      pedido.set(el, descriptor.get.call(el));
      medios.push(new WeakRef(el));
    }
    descriptor.set.call(el, pedido.get(el) * maestro());
  }

  if (descriptor && descriptor.configurable) {
    Object.defineProperty(HTMLMediaElement.prototype, "volume", {
      configurable: true,
      enumerable: descriptor.enumerable,
      get() { return pedido.has(this) ? pedido.get(this) : descriptor.get.call(this); },
      set(v) {
        const n = limitar(Number(v));
        if (!pedido.has(this)) medios.push(new WeakRef(this));
        pedido.set(this, n);
        descriptor.set.call(this, n * maestro());
      }
    });
    const reproducir = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      controlar(this);
      return reproducir.apply(this, arguments);
    };
  }

  /* --- Web Audio ------------------------------------------------------------ */
  const ganancias = new WeakMap(); // contexto -> ganancia maestra
  const contextos = [];            // WeakRef a los contextos con ganancia
  const conectar = AudioNode.prototype.connect;
  const desconectar = AudioNode.prototype.disconnect;

  function gananciaDe(contexto, destino) {
    let g = ganancias.get(contexto);
    if (!g) {
      g = contexto.createGain();
      g.gain.value = maestro();
      conectar.call(g, destino);
      ganancias.set(contexto, g);
      contextos.push(new WeakRef(contexto));
    }
    return g;
  }

  function esSalida(nodo) {
    return typeof AudioDestinationNode !== "undefined" && nodo instanceof AudioDestinationNode;
  }

  AudioNode.prototype.connect = function (destino) {
    if (esSalida(destino) && this.context === destino.context) {
      const args = Array.prototype.slice.call(arguments);
      args[0] = gananciaDe(this.context, destino);
      return conectar.apply(this, args);
    }
    return conectar.apply(this, arguments);
  };
  AudioNode.prototype.disconnect = function (destino) {
    if (esSalida(destino) && ganancias.has(this.context)) {
      const args = Array.prototype.slice.call(arguments);
      args[0] = ganancias.get(this.context);
      return desconectar.apply(this, args);
    }
    return desconectar.apply(this, arguments);
  };

  function aplicar() {
    medios.forEach(ref => {
      const el = ref.deref();
      if (el) descriptor.set.call(el, pedido.get(el) * maestro());
    });
    contextos.forEach(ref => {
      const c = ref.deref();
      const g = c && ganancias.get(c);
      if (g) g.gain.setTargetAtTime(maestro(), c.currentTime, 0.015);
    });
    oyentes.forEach(f => { try { f(maestro()); } catch (e) { /* un oyente roto no frena a los demás */ } });
  }

  window.MjVolumen = {
    valor: maestro,
    silenciado: () => silenciado,
    alCambiar: f => oyentes.push(f)
  };

  /* --- Control flotante ---------------------------------------------------- */
  const ICONO_SONIDO = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const ICONO_MUDO = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  function montar() {
    if (document.getElementById("mjVolumenControl")) return;
    const estilo = document.createElement("style");
    estilo.textContent = `
      .mj-volumen-control {
        position: fixed; right: 16px; bottom: 16px; z-index: 60; display: flex; align-items: center; gap: 8px;
        padding: 6px 12px 6px 8px; background: var(--panel, #1e2022); border: 1px solid var(--accent-soft, #55554a);
        color: var(--accent, #cfcfba);
      }
      .mj-volumen-control button { background: none; border: 0; color: inherit; cursor: pointer; padding: 2px; display: flex; }
      .mj-volumen-control button:hover { color: var(--text, #fff); }
      .mj-volumen-control input[type="range"] { width: 96px; accent-color: var(--accent, #cfcfba); cursor: pointer; margin: 0; }
      .mj-volumen-control output { min-width: 2.6em; font: 600 .72rem sans-serif; color: var(--muted, #83836f); text-align: right; }
      @media (max-width: 560px) { .mj-volumen-control input[type="range"] { width: 70px; } .mj-volumen-control output { display: none; } }`;
    document.head.appendChild(estilo);

    const caja = document.createElement("div");
    caja.id = "mjVolumenControl";
    caja.className = "mj-volumen-control";
    caja.innerHTML = `
      <button type="button" aria-label="Silenciar o activar el sonido"></button>
      <input type="range" min="0" max="100" step="1" aria-label="Volumen">
      <output></output>`;
    document.body.appendChild(caja);

    const boton = caja.querySelector("button");
    const rango = caja.querySelector("input");
    const salida = caja.querySelector("output");
    const pintar = () => {
      const v = Math.round(maestro() * 100);
      rango.value = String(v);
      salida.textContent = v + "%";
      boton.innerHTML = v === 0 ? ICONO_MUDO : ICONO_SONIDO;
    };
    rango.addEventListener("input", () => {
      volumen = rango.value / 100;
      silenciado = volumen === 0;
      guardar(CLAVE_VOLUMEN, volumen);
      guardar(CLAVE_SILENCIO, silenciado ? "1" : "0");
      aplicar();
      pintar();
    });
    // Soltar la barra devuelve el teclado al juego (Z, X, flechas...) en vez de mover la barra.
    rango.addEventListener("change", () => rango.blur());
    boton.addEventListener("click", () => {
      silenciado = !silenciado;
      if (!silenciado && volumen === 0) volumen = 0.5;
      guardar(CLAVE_VOLUMEN, volumen);
      guardar(CLAVE_SILENCIO, silenciado ? "1" : "0");
      aplicar();
      pintar();
      boton.blur();
    });
    pintar();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar);
  else montar();
})();
