/* =============================================================================
   CONCURSO — el escenario. Un lienzo fijo de 1920×1080 escalado al hueco que
   tenga, que dibuja una escena en un paso concreto. Lo usan la cabina (editor,
   monitor al aire y miniaturas) y el programa.
============================================================================= */
(function (CZ) {
  /* Estado de una escena después de aplicar sus N primeros pasos. */
  CZ.estadoEscena = function (escena, paso) {
    const visibles = new Set(), reveladas = new Set(), volteos = {}, celdas = {};
    (escena ? escena.elementos : []).forEach(el => { if (!el.oculto) visibles.add(el.id); });
    (escena ? escena.pasos : []).slice(0, Math.max(0, paso || 0)).forEach(p => {
      if (p.accion === "mostrar") visibles.add(p.objetivo);
      else if (p.accion === "ocultar") visibles.delete(p.objetivo);
      else if (p.accion === "revelar") { reveladas.add(p.objetivo); visibles.add(p.objetivo); }
      else if (p.accion === "voltear") {
        if (p.celda != null && p.celda !== "") {
          const i = Number(p.celda);
          const lista = celdas[p.objetivo] = celdas[p.objetivo] || [];
          const k = lista.indexOf(i);
          if (k >= 0) lista.splice(k, 1); else lista.push(i);
        } else volteos[p.objetivo] = !volteos[p.objetivo];
      }
    });
    return { visibles, reveladas, volteos, celdas };
  };

  /* Escala del lienzo que contiene a un nodo (para animaciones medidas en píxeles de pantalla). */
  CZ.escalaDe = nodo => { const l = nodo.closest(".cz-lienzo"); return l ? l._escala || 1 : 1; };

  const ANIM_ENTRADA = { aparecer: 1, subir: 1, rebote: 1, zoom: 1, girar: 1, sello: 1 };

  function fondoCapa(capa, escena) {
    const f = escena.fondo || { tipo: "tema" };
    capa.removeAttribute("data-patron");
    capa.style.background = "";
    if (f.tipo === "color" && f.valor) capa.style.background = f.valor;
    else if (f.tipo === "imagen" && f.valor) {
      capa.style.background = "#111 center / cover no-repeat";
      CZ.ponerImagen(capa, f.valor, true);
    } else if (f.tipo === "patron" && f.valor) capa.setAttribute("data-patron", f.valor);
  }

  class Escenario {
    /* opciones: { modo: "programa" | "monitor" | "editor" | "mini", alClic(el, sub, ev) } */
    constructor(contenedor, opciones) {
      this.op = Object.assign({ modo: "programa" }, opciones || {});
      this.cont = contenedor;
      this.marco = document.createElement("div");
      this.marco.className = "cz-marco cz-modo-" + this.op.modo;
      this.lienzo = document.createElement("div");
      this.lienzo.className = "cz-lienzo";
      this.marco.appendChild(this.lienzo);
      contenedor.appendChild(this.marco);
      this.capa = null;
      this.escenaId = null;
      this.paso = 0;
      this.ajustar();
      this.ro = new ResizeObserver(() => this.ajustar());
      this.ro.observe(contenedor);
      if (this.op.alClic) {
        // Clic normal y clic derecho (el derecho resta en marcadores y podio)
        const atender = (ev, derecho) => {
          const nodo = ev.target.closest(".cz-el");
          if (!nodo || !this.ultimo) return;
          const el = this.ultimo.escena.elementos.find(x => x.id === nodo.dataset.id);
          if (!el || nodo.classList.contains("cz-invisible")) return;
          if (derecho) ev.preventDefault();
          const sub = ev.target.closest("[data-celda]");
          this.op.alClic(el, sub ? sub.dataset.celda : null, { altKey: ev.altKey, shiftKey: ev.shiftKey, derecho });
        };
        this.lienzo.addEventListener("click", ev => atender(ev, false));
        this.lienzo.addEventListener("contextmenu", ev => atender(ev, true));
      }
    }

    ajustar() {
      const w = this.cont.clientWidth, h = this.cont.clientHeight;
      if (!w || !h) return;
      const k = Math.min(w / CZ.ANCHO, h / CZ.ALTO);
      this.escala = k;
      this.lienzo._escala = k;
      this.lienzo.style.transform = `translate(${(w - CZ.ANCHO * k) / 2}px, ${(h - CZ.ALTO * k) / 2}px) scale(${k})`;
      this.marco.style.setProperty("--cz-inv", 1 / k);
    }

    /* Dibuja (o actualiza) la escena. transicion: true para animar el cambio de escena. */
    mostrar(partida, escenaId, paso, opciones) {
      const escena = CZ.escena(partida, escenaId);
      const o = opciones || {};
      if (!escena) { this.lienzo.innerHTML = ""; this.capa = null; this.escenaId = null; return; }
      const cambia = escenaId !== this.escenaId || !this.capa;
      if (cambia) {
        const vieja = this.capa;
        const capa = document.createElement("div");
        capa.className = "cz-capa";
        capa._nodos = new Map();
        capa._visibles = new Set();
        this.lienzo.appendChild(capa);
        this.capa = capa;
        this.escenaId = escenaId;
        const anima = o.transicion && vieja && this.op.modo !== "editor" && this.op.modo !== "mini";
        this.pintar(partida, escena, paso, { entrada: this.op.modo === "programa" || this.op.modo === "monitor", primera: true });
        if (anima) {
          const tr = escena.transicion || "barrido";
          if (tr === "corte") vieja.remove();
          else {
            capa.classList.add("cz-tr-" + tr);
            vieja.classList.add("cz-saliendo");
            setTimeout(() => { vieja.remove(); capa.classList.remove("cz-tr-" + tr); }, 750);
          }
        } else if (vieja) vieja.remove();
      } else {
        this.pintar(partida, escena, paso, { entrada: this.op.modo !== "mini" && this.op.modo !== "editor" });
      }
      this.paso = paso;
    }

    pintar(partida, escena, paso, o) {
      const capa = this.capa;
      const estado = CZ.estadoEscena(escena, paso);
      const ctx = { partida, escena, estado, juego: partida.juego, modo: this.op.modo };
      this.ultimo = { partida, escena, ctx };
      capa.setAttribute("data-tema", escena.tema || partida.tema || "madera");
      fondoCapa(capa, escena);
      const vivos = new Set();
      let orden = 0;
      escena.elementos.forEach((el, i) => {
        const comp = CZ.COMPONENTES[el.tipo];
        if (!comp) return;
        vivos.add(el.id);
        let nodo = capa._nodos.get(el.id);
        if (!nodo) {
          nodo = document.createElement("div");
          nodo.className = "cz-el";
          nodo.dataset.id = el.id;
          capa.appendChild(nodo);
          capa._nodos.set(el.id, nodo);
        }
        nodo.dataset.tipo = el.tipo;
        const firma = el.tipo + "|" + (comp.firma ? comp.firma(el, ctx) : JSON.stringify(el.props));
        let interior = nodo.firstElementChild;
        if (interior && interior.dataset.firma === firma) {
          if (comp.actualizar) interior = comp.actualizar(interior, el, ctx) || null;
          if (!interior) { nodo.innerHTML = ""; }
        } else {
          if (interior) nodo.innerHTML = "";
          interior = null;
        }
        if (!interior) {
          interior = comp.crear(el, ctx);
          interior.dataset.firma = firma;
          nodo.appendChild(interior);
        }
        const s = nodo.style;
        s.left = el.x + "px"; s.top = el.y + "px"; s.width = el.w + "px"; s.height = el.h + "px";
        s.transform = el.rot ? `rotate(${el.rot}deg)` : "";
        s.zIndex = i + 1;
        s.setProperty("--cz-op", el.opacidad == null ? 1 : el.opacidad);
        nodo.classList.toggle("cz-enlace", !!el.enlace);
        nodo.classList.toggle("cz-bloqueado", !!el.bloqueado);
        const visible = estado.visibles.has(el.id);
        const eraVisible = capa._visibles.has(el.id);
        nodo.classList.toggle("cz-invisible", !visible);
        if (visible && !eraVisible && o.entrada && ANIM_ENTRADA[el.entrada]) {
          const retraso = o.primera ? Math.min(orden * 70, 700) : 0;
          orden++;
          nodo.style.animationDelay = retraso + "ms";
          nodo.classList.remove(...Array.from(nodo.classList).filter(c => c.startsWith("cz-in-")));
          void nodo.offsetWidth;
          nodo.classList.add("cz-in-" + el.entrada);
          const limpiar = () => { nodo.classList.remove("cz-in-" + el.entrada); nodo.style.animationDelay = ""; };
          nodo.addEventListener("animationend", limpiar, { once: true });
          setTimeout(limpiar, retraso + 1400);
        }
        if (visible) capa._visibles.add(el.id); else capa._visibles.delete(el.id);
      });
      capa._nodos.forEach((nodo, id) => { if (!vivos.has(id)) { nodo.remove(); capa._nodos.delete(id); capa._visibles.delete(id); } });
    }

    nodoDe(id) { return this.capa && this.capa._nodos.get(id); }

    destruir() { this.ro.disconnect(); this.marco.remove(); }
  }
  CZ.Escenario = Escenario;

  /* ---------------------------------------------------------------- sonidos sintetizados (sin archivos) */
  let ac = null;
  function audio() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }
  function tono(a, tipo, f0, f1, t0, dur, vol) {
    const o = a.createOscillator(), g = a.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f0, a.currentTime + t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, a.currentTime + t0 + dur);
    g.gain.setValueAtTime(0.0001, a.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(vol, a.currentTime + t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(a.currentTime + t0);
    o.stop(a.currentTime + t0 + dur + 0.05);
  }
  function ruido(a, t0, dur, vol, filtro, f0, f1) {
    const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    s.buffer = b;
    f.type = filtro || "bandpass";
    f.frequency.setValueAtTime(f0 || 1200, a.currentTime + t0);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, a.currentTime + t0 + dur);
    g.gain.setValueAtTime(vol, a.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
    s.connect(f).connect(g).connect(a.destination);
    s.start(a.currentTime + t0);
  }
  CZ.silencio = false;
  CZ.sonar = function (nombre) {
    if (CZ.silencio) return;
    const a = audio();
    if (!a) return;
    switch (nombre) {
      case "ding": tono(a, "sine", 880, 0, 0, 0.18, 0.25); tono(a, "sine", 1320, 0, 0.12, 0.35, 0.25); break;
      case "buzz": tono(a, "sawtooth", 140, 90, 0, 0.5, 0.18); break;
      case "moneda": tono(a, "square", 988, 0, 0, 0.08, 0.12); tono(a, "square", 1319, 0, 0.08, 0.25, 0.12); break;
      case "pierde": tono(a, "triangle", 330, 160, 0, 0.3, 0.2); break;
      case "whoosh": ruido(a, 0, 0.45, 0.35, "bandpass", 300, 3000); break;
      case "volteo": ruido(a, 0, 0.12, 0.3, "highpass", 2500); break;
      case "tambor": for (let i = 0; i < 14; i++) ruido(a, i * 0.07, 0.08, 0.25 + i * 0.02, "lowpass", 400); tono(a, "sine", 110, 55, 1.0, 0.5, 0.5); break;
      case "jumpscare": ruido(a, 0, 1.2, 0.9, "bandpass", 800, 200); tono(a, "sawtooth", 70, 40, 0, 1.2, 0.5); tono(a, "square", 620, 300, 0, 0.8, 0.2); break;
    }
  };
  /* Sonidos de los pasos que se acaban de aplicar (de "desde" a "hasta", sin incluir "desde"). */
  CZ.sonidosDePasos = function (escena, desde, hasta) {
    if (!escena || hasta <= desde) return;
    escena.pasos.slice(desde, hasta).forEach(p => {
      if (p.accion === "sonido") CZ.sonar(p.sonido || "ding");
      else if (p.accion === "voltear") CZ.sonar("volteo");
      else if (p.accion === "revelar") CZ.sonar("whoosh");
    });
  };
})(window.CZ);
