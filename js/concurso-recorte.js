/* =============================================================================
   CONCURSO — herramienta para escuchar una canción y elegir el trozo que suena
   en el programa. CZ.abrirRecorte({ src, nombre, inicio, fin, volumen })
   devuelve una promesa con { inicio, fin } o null si se cancela.

   Arriba, la canción entera: arrastra para elegir un trozo, haz clic para
   poner el cursor. Abajo, el trozo de cerca para afinar los bordes.
   Espacio reproduce o para desde el cursor, I marca el inicio y O el final
   (sirve para hacerlo mientras suena), Enter guarda y Escape cancela.
============================================================================= */
(function (CZ) {
  const esc = CZ.esc;
  const fmt = s => {
    s = Math.max(0, s);
    const m = Math.floor(s / 60), r = s - m * 60;
    return m + ":" + (r < 10 ? "0" : "") + r.toFixed(2);
  };

  /* Picos (mínimo y máximo) de cada columna para dibujar la onda. */
  function picos(buf, desde, hasta, columnas) {
    const sr = buf.sampleRate, c0 = buf.getChannelData(0), c1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;
    const i0 = Math.max(0, Math.floor(desde * sr)), i1 = Math.min(buf.length, Math.floor(hasta * sr));
    const por = Math.max(1, (i1 - i0) / columnas), salida = new Float32Array(columnas * 2);
    for (let x = 0; x < columnas; x++) {
      const a = Math.floor(i0 + x * por), b = Math.min(i1, Math.floor(i0 + (x + 1) * por));
      let mn = 1, mx = -1;
      // En trozos largos basta con mirar una de cada pocas muestras
      const salto = Math.max(1, Math.floor((b - a) / 400));
      for (let i = a; i < b; i += salto) {
        const v = c1 ? (c0[i] + c1[i]) / 2 : c0[i];
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
      if (mn > mx) { mn = 0; mx = 0; }
      salida[x * 2] = mn; salida[x * 2 + 1] = mx;
    }
    return salida;
  }

  CZ.abrirRecorte = function (op) {
    return new Promise(resolver => {
      const fondo = document.createElement("div");
      fondo.className = "cz-modal-fondo";
      fondo.innerHTML = `
        <div class="cz-modal cz-recorte">
          <div class="cz-rec-cab"><b>${esc(op.nombre || "Canción")}</b><span data-total>Cargando...</span></div>
          <p class="cz-rec-ayuda">Arriba está la canción entera: arrastra para elegir el trozo y haz clic para mover el cursor. Abajo ves el trozo de cerca para afinar los bordes.
            <kbd>Espacio</kbd> reproduce o para, <kbd>I</kbd> marca el inicio y <kbd>O</kbd> el final mientras suena.</p>
          <canvas class="cz-rec-entera" height="90"></canvas>
          <canvas class="cz-rec-cerca" height="130"></canvas>
          <div class="cz-rec-fila">
            <button type="button" class="cz-btn cz-btn-fuerte" data-r="trozo">▶ Escuchar el trozo</button>
            <button type="button" class="cz-btn" data-r="cursor">▶ Desde el cursor</button>
            <button type="button" class="cz-btn" data-r="parar">■ Parar</button>
            <span class="cz-rec-pos" data-pos>0:00.00</span>
          </div>
          <div class="cz-rec-fila">
            <button type="button" class="cz-btn" data-r="marcarIni">Inicio aquí (I)</button>
            <button type="button" class="cz-btn" data-r="marcarFin">Final aquí (O)</button>
            <label class="cz-rec-num">Inicio <input type="number" step="0.05" min="0" data-n="inicio"></label>
            <label class="cz-rec-num">Final <input type="number" step="0.05" min="0" data-n="fin"></label>
            <span class="cz-rec-dur" data-dur></span>
          </div>
          <div class="cz-rec-fila"><span class="cz-rec-et">Duración fija</span>${[0.5, 1, 2, 3, 5, 10, 15, 30].map(n => `<button type="button" class="cz-btn-mini" data-largo="${n}">${String(n).replace(".", ",")} s</button>`).join("")}</div>
          <div class="cz-modal-bot"><button type="button" class="cz-btn" data-r="cancelar">Cancelar</button><button type="button" class="cz-btn cz-btn-fuerte" data-r="guardar">Guardar el recorte</button></div>
        </div>`;
      document.body.appendChild(fondo);
      const $ = s => fondo.querySelector(s);
      const cvE = $(".cz-rec-entera"), cvC = $(".cz-rec-cerca");
      const st = { buf: null, total: 0, ini: Number(op.inicio) || 0, fin: Number(op.fin) || 5, cursor: Number(op.inicio) || 0, fuente: null, t0: 0, desde: 0, hasta: 0, picosE: null, raf: 0 };
      const a = CZ.contextoAudio();

      function limitar() {
        st.ini = Math.max(0, Math.min(st.ini, st.total - 0.05));
        st.fin = Math.max(st.ini + 0.05, Math.min(st.fin, st.total));
        $("[data-n=inicio]").value = st.ini.toFixed(2);
        $("[data-n=fin]").value = st.fin.toFixed(2);
        $("[data-dur]").textContent = "Suena " + (Math.round((st.fin - st.ini) * 100) / 100).toLocaleString("es") + " s";
      }
      const sonando = () => !!st.fuente;
      const posicion = () => sonando() ? Math.min(st.hasta, st.desde + (a.currentTime - st.t0)) : st.cursor;

      // Ventana de cerca: el trozo con un margen a cada lado
      function ventanaCerca() {
        const margen = Math.max(0.6, (st.fin - st.ini) * 0.25);
        return [Math.max(0, st.ini - margen), Math.min(st.total, st.fin + margen)];
      }

      function ajustarCanvas(cv) {
        const w = Math.round(cv.clientWidth * (window.devicePixelRatio || 1));
        if (cv.width !== w) cv.width = w;
      }
      function dibujarOnda(cv, p, color) {
        const g = cv.getContext("2d"), w = cv.width, h = cv.height, mid = h / 2;
        g.fillStyle = color;
        for (let x = 0; x < w; x++) {
          const mn = p[x * 2], mx = p[x * 2 + 1];
          g.fillRect(x, mid - mx * mid * 0.95, 1, Math.max(1, (mx - mn) * mid * 0.95));
        }
      }
      function dibujar() {
        if (!st.buf) return;
        [cvE, cvC].forEach(ajustarCanvas);
        // Canción entera
        if (!st.picosE || st.picosE.length !== cvE.width * 2) st.picosE = picos(st.buf, 0, st.total, cvE.width);
        let g = cvE.getContext("2d"), w = cvE.width, h = cvE.height;
        g.clearRect(0, 0, w, h);
        g.fillStyle = "#14171c"; g.fillRect(0, 0, w, h);
        const xE = t => t / st.total * w;
        g.fillStyle = "rgba(245, 184, 46, .22)"; g.fillRect(xE(st.ini), 0, Math.max(2, xE(st.fin) - xE(st.ini)), h);
        dibujarOnda(cvE, st.picosE, "#7d8696");
        const [v0, v1] = ventanaCerca();
        g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1; g.strokeRect(xE(v0) + .5, .5, xE(v1) - xE(v0), h - 1);
        g.fillStyle = "#f5b82e"; g.fillRect(xE(st.ini) - 1, 0, 2, h); g.fillRect(xE(st.fin) - 1, 0, 2, h);
        g.fillStyle = "#fff"; g.fillRect(xE(posicion()) - 1, 0, 2, h);
        // De cerca
        g = cvC.getContext("2d"); w = cvC.width; h = cvC.height;
        const xC = t => (t - v0) / (v1 - v0) * w;
        g.clearRect(0, 0, w, h);
        g.fillStyle = "#14171c"; g.fillRect(0, 0, w, h);
        g.fillStyle = "rgba(245, 184, 46, .22)"; g.fillRect(xC(st.ini), 0, xC(st.fin) - xC(st.ini), h);
        if (!st.picosC || st.picosC.clave !== [v0, v1, w].join()) { st.picosC = picos(st.buf, v0, v1, w); st.picosC.clave = [v0, v1, w].join(); }
        dibujarOnda(cvC, st.picosC, "#aab3c2");
        // Marcas de segundo
        g.fillStyle = "rgba(255,255,255,.45)"; g.font = `${11 * (window.devicePixelRatio || 1)}px sans-serif`;
        const paso = v1 - v0 > 12 ? 2 : v1 - v0 > 4 ? 1 : 0.5;
        for (let t = Math.ceil(v0 / paso) * paso; t < v1; t += paso) { g.fillRect(xC(t), h - 8, 1, 8); g.fillText(fmt(t).replace(/\.\d+$/, (m) => (paso < 1 ? m.slice(0, 2) : "")), xC(t) + 3, h - 10); }
        [st.ini, st.fin].forEach(t => {
          g.fillStyle = "#f5b82e"; g.fillRect(xC(t) - 2, 0, 4, h);
          g.beginPath(); g.moveTo(xC(t) - 9, 0); g.lineTo(xC(t) + 9, 0); g.lineTo(xC(t), 12); g.fill();
        });
        g.fillStyle = "#fff"; g.fillRect(xC(posicion()) - 1, 0, 2, h);
        $("[data-pos]").textContent = fmt(posicion());
      }
      function bucle() {
        dibujar();
        if (sonando()) st.raf = requestAnimationFrame(bucle);
      }

      function parar() {
        if (st.fuente) { st.cursor = posicion(); try { st.fuente.onended = null; st.fuente.stop(); } catch (e) { /* ya parado */ } }
        st.fuente = null;
        cancelAnimationFrame(st.raf);
        dibujar();
      }
      function tocar(desde, hasta) {
        if (!st.buf) return;
        parar();
        if (a.state === "suspended") a.resume();
        const f = a.createBufferSource(), gn = a.createGain();
        f.buffer = st.buf;
        gn.gain.value = op.volumen == null ? 1 : Number(op.volumen);
        f.connect(gn).connect(a.destination);
        st.desde = desde; st.hasta = hasta; st.t0 = a.currentTime;
        f.start(a.currentTime, desde, Math.max(0.01, hasta - desde));
        f.onended = () => { if (st.fuente === f) { st.fuente = null; st.cursor = desde; dibujar(); } };
        st.fuente = f;
        bucle();
      }

      // Arrastrar sobre las ondas
      function conectarOnda(cv, rango) {
        let arr = null;
        const tiempo = ev => { const r = cv.getBoundingClientRect(), [v0, v1] = rango(); return v0 + Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * (v1 - v0); };
        const cerca = (ev, t) => { const r = cv.getBoundingClientRect(), [v0, v1] = rango(); return Math.abs((t - v0) / (v1 - v0) * r.width - (ev.clientX - r.left)) < 8; };
        cv.addEventListener("pointerdown", ev => {
          if (!st.buf) return;
          const t = tiempo(ev);
          cv.setPointerCapture(ev.pointerId);
          if (cerca(ev, st.ini)) arr = { modo: "ini" };
          else if (cerca(ev, st.fin)) arr = { modo: "fin" };
          else arr = { modo: "nuevo", t0: t, movido: false };
        });
        cv.addEventListener("pointermove", ev => {
          if (!st.buf) return;
          const t = tiempo(ev);
          cv.style.cursor = cerca(ev, st.ini) || cerca(ev, st.fin) ? "ew-resize" : "crosshair";
          if (!arr) return;
          if (arr.modo === "ini") st.ini = Math.min(t, st.fin - 0.05);
          else if (arr.modo === "fin") st.fin = Math.max(t, st.ini + 0.05);
          else if (Math.abs(t - arr.t0) > (rango()[1] - rango()[0]) / 300) { arr.movido = true; st.ini = Math.min(arr.t0, t); st.fin = Math.max(arr.t0, t); }
          limitar(); dibujar();
        });
        cv.addEventListener("pointerup", ev => {
          if (arr && arr.modo === "nuevo" && !arr.movido) {
            st.cursor = tiempo(ev);
            if (sonando()) tocar(st.cursor, st.total); else dibujar();
          }
          arr = null;
        });
      }
      conectarOnda(cvE, () => [0, st.total]);
      conectarOnda(cvC, ventanaCerca);

      function marcar(cual) {
        const t = posicion();
        if (cual === "ini") { st.ini = t; if (st.fin <= t) st.fin = Math.min(st.total, t + 5); }
        else { st.fin = t; if (st.ini >= t) st.ini = Math.max(0, t - 5); }
        limitar(); dibujar();
      }

      function cerrar(valor) {
        parar();
        window.removeEventListener("keydown", teclas, true);
        window.removeEventListener("resize", dibujar);
        fondo.remove();
        resolver(valor);
      }

      fondo.addEventListener("click", ev => {
        const b = ev.target.closest("button");
        if (!b) return;
        if (b.dataset.largo) { st.fin = st.ini + Number(b.dataset.largo); limitar(); dibujar(); return; }
        switch (b.dataset.r) {
          case "trozo": tocar(st.ini, st.fin); break;
          case "cursor": tocar(st.cursor, st.total); break;
          case "parar": parar(); break;
          case "marcarIni": marcar("ini"); break;
          case "marcarFin": marcar("fin"); break;
          case "cancelar": cerrar(null); break;
          case "guardar": if (st.buf) cerrar({ inicio: Math.round(st.ini * 100) / 100, fin: Math.round(st.fin * 100) / 100 }); break;
        }
      });
      fondo.addEventListener("input", ev => {
        const n = ev.target.dataset.n;
        if (!n) return;
        const v = Number(ev.target.value);
        if (!isFinite(v)) return;
        if (n === "inicio") st.ini = v; else st.fin = v;
        dibujar();
      });
      fondo.addEventListener("change", ev => { if (ev.target.dataset.n) { limitar(); dibujar(); } });

      // Mientras está abierta, las teclas son de la herramienta (no pasan de escena ni suman puntos)
      function teclas(ev) {
        const enCampo = /^(INPUT|TEXTAREA)$/.test(ev.target.tagName);
        if (ev.key === "Escape") { ev.preventDefault(); ev.stopImmediatePropagation(); cerrar(null); return; }
        if (ev.key === "Enter") { ev.preventDefault(); ev.stopImmediatePropagation(); if (enCampo) ev.target.blur(); else if (st.buf) cerrar({ inicio: Math.round(st.ini * 100) / 100, fin: Math.round(st.fin * 100) / 100 }); return; }
        if (enCampo) { ev.stopImmediatePropagation(); return; }
        const k = ev.key.toLowerCase();
        if (k === " ") { if (sonando()) parar(); else tocar(st.cursor, st.total); }
        else if (k === "i") marcar("ini");
        else if (k === "o") marcar("fin");
        else if (k === "t") tocar(st.ini, st.fin);
        else { ev.stopImmediatePropagation(); return; }
        ev.preventDefault();
        ev.stopImmediatePropagation();
      }
      window.addEventListener("keydown", teclas, true);
      window.addEventListener("resize", dibujar);

      CZ.bufferDe(op.src).then(buf => {
        st.buf = buf;
        st.total = buf.duration;
        $("[data-total]").textContent = "Dura " + fmt(st.total);
        if (!(st.fin > st.ini)) st.fin = Math.min(st.total, st.ini + 5);
        limitar();
        dibujar();
      }).catch(() => {
        $("[data-total]").textContent = "No se pudo leer el audio. Si es una URL, tiene que ser un archivo directo (.mp3, .ogg, .wav) de un sitio que permita usarlo desde otras páginas.";
      });
    });
  };
})(window.CZ);
