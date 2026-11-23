/* =============================================================================
   TABLERO — lienzo (Konva). Capas Mapa → cuadrícula → Fichas, DJ y Delantera → niebla → interfaz.
   Cada objeto es un grupo centrado en (x, y) que gira sobre su centro; las barras, el nombre y las auras van
   aparte para que no giren con la ficha. No guarda nada: avisa a la app (opciones.on*) y la app decide.
============================================================================= */
(function () {
  const COLORES_BARRA = ["#80c080", "#7a9acb", "#b81c1c"];
  // Alto de cada barra y el hueco entre barras, según el ancho de la ficha (como en Roll20, crecen con ella)
  const altoBarra = o => ((o.datos || {}).barraEstilo === "compacto" ? Math.max(4, Math.min(8, o.ancho * 0.06)) : Math.max(10, Math.min(26, o.ancho * 0.18)));
  const sepBarra = o => Math.max(1.5, altoBarra(o) * 0.09);
  const COLORES_BURBUJA = ["#78c878", "#7598d0", "#c0201d"];
  const AZUL_SEL = "#6b84f5";
  // Rueda dentada de la tuerca (8 dientes) y el icono de estados, dibujados a mano
  const RUEDA = (() => {
    let d = "";
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, p = (r, da) => [Math.cos(a + da) * r, Math.sin(a + da) * r].map(v => v.toFixed(2)).join(" ");
      d += (i ? "L" : "M") + p(7, -0.32) + "L" + p(10, -0.2) + "L" + p(10, 0.2) + "L" + p(7, 0.32) + "L" + p(7, Math.PI / 4 - 0.32);
    }
    return d + "Z M3.2 0A3.2 3.2 0 1 0 -3.2 0A3.2 3.2 0 1 0 3.2 0Z";
  })();
  const CAPAS = ["mapa", "fichas", "gm", "delantero", "luz"];
  const SUPA = "supabase.co";

  // Konva termina un arrastre al soltar cualquier botón; el derecho (que añade paradas a la ruta) no debe soltar la ficha
  (function () {
    const DD = window.Konva && Konva.DD;
    if (!DD || !DD._endDragBefore || window.__tbDDParcheado) return;
    window.__tbDDParcheado = true;
    const antes = DD._endDragBefore, despues = DD._endDragAfter;
    ["mouseup", "pointerup"].forEach(t => {
      window.removeEventListener(t, antes, true); window.removeEventListener(t, antes);
      window.removeEventListener(t, despues, false); window.removeEventListener(t, despues);
    });
    const filtro = f => e => { if (e && e.button === 2 && DD.isDragging) return; f(e); };
    window.addEventListener("mouseup", filtro(antes), true);
    window.addEventListener("mouseup", filtro(despues), false);
  })();

  function crear(contenedor, op) {
    Konva.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);   // gráficas integradas: no pasar de 1,5
    const stage = new Konva.Stage({ container: contenedor, width: contenedor.clientWidth, height: contenedor.clientHeight });
    const lMapa = new Konva.Layer();
    const lGrid = new Konva.Layer({ listening: false });
    const lObj = new Konva.Layer();
    const lNiebla = new Konva.Layer({ listening: false });
    const lUI = new Konva.Layer();
    stage.add(lMapa, lGrid, lObj, lNiebla, lUI);
    // Estados animados (casteo, fumando, raudo): capa propia que solo se redibuja mientras haya alguno, a unos 24 fps
    const lAnim = new Konva.Layer({ listening: false });
    stage.add(lAnim);
    lAnim.zIndex(3);
    // Los efectos que van detrás de la ficha (el humo, las esquirlas y el remolino del Elemental): debajo de las fichas y de
    // sus barras, para no taparlas ni tener que recortarlas
    const lAnimFondo = new Konva.Layer({ listening: false });
    stage.add(lAnimFondo);
    lAnimFondo.zIndex(2);
    // La página: el lienzo donde van los mapas; fuera de ella se ve el color del tablero
    const paginaSombra = new Konva.Rect({ x: 5, y: 7, width: 2800, height: 2800, fill: "rgba(0,0,0,.28)", listening: false, perfectDrawEnabled: false });
    const pagina = new Konva.Rect({ x: 0, y: 0, width: 2800, height: 2800, fill: "#ffffff", listening: false, perfectDrawEnabled: false });
    lMapa.add(paginaSombra, pagina);

    // Cada capa: auras (debajo), objetos y deco (barras, nombres, encima)
    const grupos = {};
    CAPAS.forEach(c => {
      const capa = new Konva.Group({ name: "capa-" + c });
      const auras = new Konva.Group({ listening: false });
      const objetos = new Konva.Group();
      const deco = new Konva.Group({ listening: false });
      capa.add(auras, objetos, deco);
      (c === "mapa" ? lMapa : lObj).add(capa);
      grupos[c] = { capa, auras, objetos, deco };
    });
    // Iluminación dinámica: la oscuridad va encima de las fichas y debajo de los muros (que solo ve el DJ)
    const sombra = new Konva.Image({ x: 0, y: 0, listening: false, visible: false });
    lObj.add(sombra);
    // Tiradores de las puertas que el jugador ve (clic: abrir o cerrar)
    const tiradores = new Konva.Group();
    lObj.add(tiradores);
    grupos.luz.capa.moveToTop();
    const pintorLuz = window.TBLuz ? TBLuz.crearPintor() : null;

    const tr = new Konva.Transformer({
      rotateEnabled: false, keepRatio: false, ignoreStroke: true, anchorSize: 9, borderStroke: AZUL_SEL, borderStrokeWidth: 1.5, anchorStroke: AZUL_SEL, anchorFill: AZUL_SEL,
      anchorStrokeWidth: 1, anchorCornerRadius: 0, rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315], rotationSnapTolerance: 6, flipEnabled: false,
      boundBoxFunc: (viejo, nuevo) => (Math.abs(nuevo.width) < 8 || Math.abs(nuevo.height) < 8 ? viejo : nuevo)
    });
    lUI.add(tr);
    const guiaMedida = new Konva.Group({ listening: false });
    const guiasRemotas = new Konva.Group({ listening: false });
    const pings = new Konva.Group({ listening: false });
    const vistaPrevia = new Konva.Group({ listening: false });
    const marco = new Konva.Rect({ visible: false, fill: "rgba(107,132,245,.1)", stroke: AZUL_SEL, strokeWidth: 1, listening: false });
    lUI.add(guiasRemotas, guiaMedida, vistaPrevia, pings, marco);

    const st = {
      esGM: false, uid: null, escena: null, capa: "fichas", herr: "seleccionar", opc: {}, vistaJugador: false,
      nodos: new Map(), seleccion: new Set(), turno: null, espacio: false, imgs: new Map(), pausa: false
    };
    const cuad = () => (st.escena && st.escena.cuadricula) || {};
    const desp = () => ({ x: Number(cuad().dx) || 0, y: Number(cuad().dy) || 0 });
    const medidas = () => ({ w: ((st.escena && st.escena.ancho) || 40) * tam(), h: ((st.escena && st.escena.alto) || 40) * tam() });
    const tam = () => (st.escena && st.escena.cuadricula && st.escena.cuadricula.tam) || 70;
    const pies = () => (st.escena && st.escena.cuadricula && st.escena.cuadricula.pies) || 5;
    const controla = o => !!o && (o.controlan_todos || (o.controladores || []).includes(st.uid));
    const puedeSeleccionar = o => st.esGM ? o.capa === st.capa : (o.capa === "fichas" && (controla(o) && !o.bloqueado));
    const puedeArrastrar = o => puedeSeleccionar(o) && !o.bloqueado && st.herr === "seleccionar" && (o.tipo !== "pin" || st.esGM) && !(st.pausa && !st.esGM);

    /* ------------------------------------------------------------ cámara */
    function aMundo(p) { const t = stage.getAbsoluteTransform().copy().invert(); return t.point(p); }
    function punteroMundo() { const p = stage.getPointerPosition(); return p ? aMundo(p) : { x: 0, y: 0 }; }
    function zoom() { return stage.scaleX(); }
    function ponerZoom(z, centro) {
      z = Math.max(0.1, Math.min(4, z));
      const c = centro || { x: stage.width() / 2, y: stage.height() / 2 };
      const antes = aMundo(c);
      stage.scale({ x: z, y: z });
      stage.position({ x: c.x - antes.x * z, y: c.y - antes.y * z });
      redibujarVista();
      if (op.onZoom) op.onZoom(z);
    }
    function centrarEn(x, y, z) {
      if (z) stage.scale({ x: z, y: z });
      const s = stage.scaleX();
      stage.position({ x: stage.width() / 2 - x * s, y: stage.height() / 2 - y * s });
      redibujarVista();
      if (op.onZoom) op.onZoom(s);
    }
    let zoomSel = 0;
    function redibujarVista() {
      stage.batchDraw();
      if (st.seleccion && st.seleccion.size === 1 && zoom() !== zoomSel) pintarSeleccionUI();
    }
    // Centra la página entera (Inicio)
    function ajustarVista() {
      const m = medidas();
      const z = Math.min(1.5, Math.max(0.1, Math.min(stage.width() / (m.w + 80), stage.height() / (m.h + 80))));
      centrarEn(m.w / 2, m.h / 2, z);
    }
    new ResizeObserver(() => { stage.size({ width: contenedor.clientWidth, height: contenedor.clientHeight }); redibujarVista(); }).observe(contenedor);

    /* ------------------------------------------------------------ cuadrícula */
    const grid = new Konva.Shape({
      listening: false,
      sceneFunc(ctx) {
        const c = st.escena && st.escena.cuadricula;
        if (!c || c.visible === false) return;
        const t = tam(), z = stage.scaleX();
        if (t * z < 6) return;
        const m = medidas(), o = desp();
        const va = aMundo({ x: 0, y: 0 }), vb = aMundo({ x: stage.width(), y: stage.height() });
        const a = { x: Math.max(0, va.x), y: Math.max(0, va.y) }, b = { x: Math.min(m.w, vb.x), y: Math.min(m.h, vb.y) };
        if (a.x >= b.x || a.y >= b.y) return;
        const raw = ctx._context;
        raw.save();
        raw.strokeStyle = c.color || "#c0c0c0";
        raw.globalAlpha = c.opacidad == null ? 0.5 : c.opacidad;
        raw.lineWidth = 1 / z;
        raw.beginPath();
        for (let x = Math.ceil((a.x - o.x) / t) * t + o.x; x <= b.x; x += t) { raw.moveTo(x, a.y); raw.lineTo(x, b.y); }
        for (let y = Math.ceil((a.y - o.y) / t) * t + o.y; y <= b.y; y += t) { raw.moveTo(a.x, y); raw.lineTo(b.x, y); }
        raw.stroke();
        raw.restore();
      }
    });
    lGrid.add(grid);

    /* ------------------------------------------------------------ niebla */
    const niebla = new Konva.Shape({
      listening: false,
      sceneFunc(ctx) {
        const n = st.escena && st.escena.niebla;
        if (!n || !n.activa) return;
        const a = aMundo({ x: -20, y: -20 }), b = aMundo({ x: stage.width() + 20, y: stage.height() + 20 });
        const raw = ctx._context;
        raw.save();
        raw.fillStyle = "#000";
        // base "oculta": todo negro y se revelan zonas; base "visible": solo se tapan las zonas a ocultar
        if ((n.base || "oculta") === "oculta") raw.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
        (n.zonas || []).forEach(zn => {
          const p = zn.puntos || [];
          if (p.length < 6) return;
          raw.globalCompositeOperation = zn.modo === "ocultar" ? "source-over" : "destination-out";
          raw.beginPath();
          raw.moveTo(p[0], p[1]);
          for (let i = 2; i < p.length; i += 2) raw.lineTo(p[i], p[i + 1]);
          raw.closePath();
          raw.fill();
        });
        raw.restore();
      }
    });
    lNiebla.add(niebla);
    /* ------------------------------------------------------------ iluminación dinámica */
    const opcLuz = () => (st.escena && st.escena.opciones && st.escena.opciones.luz) || {};
    function bloqueaMovimiento() { const L = opcLuz(), b = L.bloquear || "luz"; return !!window.TBLuz && (b === "siempre" || (b === "luz" && !!L.activa)); }
    let luzPendiente = false;
    const ANIMADOS = { casteo_notas: 1, casteo_cartas: 1, fumando: 1, raudo: 1, furia_salvaje: 1, marca_cazador: 1, inspiracion_bardica: 1, heroismo: 1, manto_inspiracion: 1, magia_reforzante: 1, zorro: 1, zorro_defensa: 1, zorro_ataque: 1, zorro_inmolar: 1,
      jefe_fase1: 1, jefe_fase2: 1, jefe_fase3: 1, forma_intangible: 1, forma_densa: 1, forma_extensa: 1, jefe_carga: 1, jefe_expuesto: 1 };
    // Los que se dibujan detrás de la ficha y de sus barras
    const FONDO = { jefe_fase1: 1, jefe_fase2: 1, jefe_fase3: 1, forma_extensa: 1 };
    // El remolino de la fase 3 del Elemental: su propia imagen, girando detrás de la ficha
    const IMG_FASE3 = "assets/enemigos/elemental-oscuridad-fase3.png?v=2";
    // El zorro de los destinos de Eledar (según los dibujos de Gabriel): cuerpo, oscuro, claro, marcas y nariz
    const ZORROS = {
      zorro: ["#e22bd9", "#8e1189", "#ff8af6", "#3f8dff"],
      zorro_defensa: ["#2f86e6", "#164a96", "#86c6ff", "#35f070"],
      zorro_ataque: ["#f2c51e", "#a87a07", "#fff09a", "#ff3fa2"],
      zorro_inmolar: ["#ff2323", "#9a0000", "#ff8a8a", "#a347ff"]
    };
    function dibujarZorro(c, id, cx, cy, S, t) {
      const [cuerpo, oscuro, claro, marca] = ZORROS[id];
      const w = S, h = S * 0.95;
      c.save();
      c.translate(cx, cy + Math.sin(t * 2.2) * S * 0.08);
      c.scale(1 + 0.03 * Math.sin(t * 3), 1 - 0.03 * Math.sin(t * 3));
      // resplandor
      const gl = c.createRadialGradient(0, 0, S * 0.5, 0, 0, S * 1.55);
      gl.addColorStop(0, cuerpo + "55"); gl.addColorStop(1, cuerpo + "00");
      c.fillStyle = gl; c.beginPath(); c.arc(0, 0, S * 1.55, 0, Math.PI * 2); c.fill();
      // cuerpo: una cúpula con dos orejas y la falda ondulada que se mueve
      c.beginPath();
      c.moveTo(-w, h * 0.35);
      c.bezierCurveTo(-w * 1.02, -h * 0.25, -w * 0.85, -h * 0.65, -w * 0.62, -h * 0.78);
      c.lineTo(-w * 0.6, -h * 1.18); c.lineTo(-w * 0.28, -h * 0.92);
      c.quadraticCurveTo(0, -h * 1.02, w * 0.28, -h * 0.92);
      c.lineTo(w * 0.6, -h * 1.18); c.lineTo(w * 0.62, -h * 0.78);
      c.bezierCurveTo(w * 0.85, -h * 0.65, w * 1.02, -h * 0.25, w, h * 0.35);
      const ondas = 5;
      for (let k = 0; k < ondas; k++) {
        const x0 = w - (k + 0.5) * (2 * w / ondas), x1 = w - (k + 1) * (2 * w / ondas);
        c.quadraticCurveTo(x0, h * (0.78 + 0.07 * Math.sin(t * 4 + k * 1.3)), x1, h * (0.38 + 0.04 * Math.sin(t * 4 + k)));
      }
      c.closePath();
      const gc = c.createLinearGradient(0, -h, 0, h * 0.8);
      gc.addColorStop(0, claro); gc.addColorStop(0.45, cuerpo); gc.addColorStop(1, oscuro);
      c.globalAlpha = 0.95; c.fillStyle = gc; c.fill();
      c.globalAlpha = 0.6; c.strokeStyle = claro; c.lineWidth = S * 0.04; c.stroke();
      // borde punteado (la trama de puntos de los dibujos)
      c.globalAlpha = 0.45; c.fillStyle = claro;
      for (let i = 0; i < 28; i++) {
        const a = i / 28 * Math.PI * 2;
        c.beginPath(); c.arc(Math.cos(a) * w * 1.12, Math.sin(a) * h * 1.02 - h * 0.1, S * 0.025, 0, Math.PI * 2); c.fill();
      }
      // brillo arriba a la izquierda
      c.globalAlpha = 0.35; c.fillStyle = "#ffffff";
      c.beginPath(); c.ellipse(-w * 0.45, -h * 0.5, w * 0.2, h * 0.12, -0.6, 0, Math.PI * 2); c.fill();
      // ojos cerrados
      c.globalAlpha = 0.9; c.strokeStyle = oscuro; c.lineWidth = S * 0.07; c.lineCap = "round";
      [-1, 1].forEach(lado => { c.beginPath(); c.arc(lado * w * 0.36, -h * 0.05, w * 0.2, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); });
      // marcas de la frente, bigotes y nariz
      c.strokeStyle = marca; c.lineWidth = S * 0.06; c.globalAlpha = 0.95;
      [[-0.12, -0.62, -0.2, -0.38], [0.02, -0.68, -0.06, -0.42], [0.16, -0.6, 0.08, -0.38]].forEach(([a, b, x2, y2]) => { c.beginPath(); c.moveTo(w * a, h * b); c.lineTo(w * x2, h * y2); c.stroke(); });
      c.lineWidth = S * 0.035;
      [-1, 1].forEach(lado => [[0.08, -0.02], [0.18, 0.06]].forEach(([dy0, dy1]) => { c.beginPath(); c.moveTo(lado * w * 0.42, h * (0.1 + dy0 * 0.5)); c.lineTo(lado * w * 0.95, h * (dy1 - 0.05)); c.stroke(); }));
      c.fillStyle = marca;
      c.beginPath(); c.moveTo(-w * 0.12, h * 0.1); c.quadraticCurveTo(0, h * 0.05, w * 0.12, h * 0.1); c.quadraticCurveTo(w * 0.04, h * 0.28, 0, h * 0.3); c.quadraticCurveTo(-w * 0.04, h * 0.28, -w * 0.12, h * 0.1); c.fill();
      // al inmolarse, llamas que suben
      if (id === "zorro_inmolar") {
        for (let i = 0; i < 6; i++) {
          const f = (t * 0.9 + i / 6) % 1, px = (i / 5 - 0.5) * w * 1.6 + Math.sin(t * 5 + i) * w * 0.08, py = -h * 0.6 - f * h * 0.9, r = S * 0.16 * (1 - f);
          c.globalAlpha = 0.8 * (1 - f); c.fillStyle = i % 2 ? "#ffb02e" : marca;
          c.beginPath(); c.moveTo(px, py - r * 2); c.quadraticCurveTo(px + r, py, px, py + r); c.quadraticCurveTo(px - r, py, px, py - r * 2); c.fill();
        }
      }
      c.restore();
    }
    // Estrella de cuatro puntas (destellos)
    function destello(c, x, y, r) {
      c.beginPath();
      c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r);
      c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.fill();
    }
    const formaAnim = fondo => new Konva.Shape({
      listening: false,
      sceneFunc(ctx) {
        const raw = ctx._context, t = performance.now() / 1000;
        st.nodos.forEach(n => {
          const est = (n.o.datos || {}).estados;
          if (!est || !est.length || !n.g.visible()) return;
          const R = Math.max(n.o.ancho, n.o.alto) / 2, x = n.g.x(), y = n.g.y();
          est.forEach(e => { if (e && ANIMADOS[e.id] && !!FONDO[e.id] === fondo) dibujarAnimado(raw, e.id, x, y, R, t); });
        });
      }
    });
    lAnim.add(formaAnim(false));
    lAnimFondo.add(formaAnim(true));
    let bucleAnim = null, ultimoCuadro = 0;
    function actualizarAnim() {
      const hay = [...st.nodos.values()].some(n => ((n.o.datos || {}).estados || []).some(e => e && ANIMADOS[e.id]));
      if (hay && !bucleAnim) {
        bucleAnim = new Konva.Animation(f => { if (document.hidden || f.time - ultimoCuadro < 50) return false; ultimoCuadro = f.time; }, [lAnim, lAnimFondo]);
        bucleAnim.start();
      } else if (!hay && bucleAnim) { bucleAnim.stop(); bucleAnim = null; lAnim.batchDraw(); lAnimFondo.batchDraw(); }
    }
    // Figuras dibujadas (24 × 24) para las notas y los palos de las cartas; sin caracteres que el sistema pinte como emoji
    let FIG = null;
    function figura(c, nombre, px, py, tam, relleno, borde) {
      if (!FIG) FIG = {
        corchea: new Path2D("M11 3v12.3A3.5 3.5 0 1 0 13 18V7.5c2 .3 4 1.7 5 4 .3-3.4-2.5-6.5-7-8.5z"),
        doble: new Path2D("M8 5.2L20 3v12.6A3.2 3.2 0 1 1 18 12.8V7.4l-8 1.5v8.9A3.2 3.2 0 1 1 8 15z"),
        negra: new Path2D("M13 2v13.4A3.6 3.6 0 1 0 15 18.6V2z"),
        semi: new Path2D("M10 3v12.4A3.5 3.5 0 1 0 12 18.5V9c2 .2 4 1.2 5 3 .2-1.6-.4-3-1.4-4 1 0 1.8.4 2.4 1 .2-3-2.6-5-8-6z"),
        pica: new Path2D("M12 2s8 6 8 11a4 4 0 0 1-6.6 3L15 21H9l1.6-5A4 4 0 0 1 4 13c0-5 8-11 8-11z"),
        diamante: new Path2D("M12 2l7 10-7 10-7-10z"),
        trebol: new Path2D("M12 2a4 4 0 0 0-3.4 6.1A4 4 0 1 0 10.6 15.6L9 21h6l-1.6-5.4a4 4 0 1 0 2-7.5A4 4 0 0 0 12 2z"),
        corazon: new Path2D("M12 21s-8.5-5.4-8.5-11.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.8C20.5 15.6 12 21 12 21z"),
        estrella: new Path2D("M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z")
      };
      c.save();
      c.translate(px, py); c.scale(tam / 24, tam / 24); c.translate(-12, -12);
      if (borde) { c.lineWidth = 2.4; c.lineJoin = "round"; c.strokeStyle = borde; c.stroke(FIG[nombre]); }
      c.fillStyle = relleno; c.fill(FIG[nombre]);
      c.restore();
    }
    function dibujarAnimado(c, id, x, y, R, t) {
      c.save();
      if (id === "casteo_notas") {
        // Aura musical naranja: un halo cálido que respira, dos cintas onduladas como un pentagrama que fluye
        // y notas que van subidas a la onda, meciéndose
        const notas = ["corchea", "doble", "semi", "negra"], tonos = ["#ff8a1f", "#ffb347", "#ffd27a", "#ff9d45"];
        const onda = (th, fase, amp) => R * (1.26 + Math.sin(th * 4 + t * 1.3 + fase) * amp + Math.sin(th * 7 - t * 0.9 + fase) * amp * 0.35);
        const halo = c.createRadialGradient(x, y, R * 0.92, x, y, R * 1.5);
        halo.addColorStop(0, "rgba(255,150,40,0)");
        halo.addColorStop(0.45, `rgba(255,150,40,${0.13 + 0.05 * Math.sin(t * 1.8)})`);
        halo.addColorStop(1, "rgba(255,150,40,0)");
        c.fillStyle = halo; c.beginPath(); c.arc(x, y, R * 1.5, 0, Math.PI * 2); c.fill();
        c.lineCap = "round"; c.lineJoin = "round";
        [[0, 0.055, "#ff9a3c", 0.5, 0.05], [Math.PI * 0.6, 0.04, "#ffd27a", 0.32, 0.03], [Math.PI * 1.3, 0.03, "#ffe6b0", 0.2, 0.02]].forEach(([fase, amp, color, alfa, grosor]) => {
          c.beginPath();
          for (let j = 0; j <= 120; j++) {
            const th = j / 120 * Math.PI * 2, r = onda(th, fase, amp);
            const px = x + Math.cos(th) * r, py = y + Math.sin(th) * r * 0.93;
            if (j) c.lineTo(px, py); else c.moveTo(px, py);
          }
          c.globalAlpha = alfa; c.strokeStyle = color; c.lineWidth = R * grosor; c.stroke();
        });
        for (let i = 0; i < 5; i++) {
          const th = t * 0.5 + i * Math.PI * 2 / 5, r = onda(th, 0, 0.055);
          const px = x + Math.cos(th) * r, py = y + Math.sin(th) * r * 0.93 - Math.sin(t * 2.2 + i * 1.3) * R * 0.05;
          // una estela de puntitos detrás de cada nota
          for (let k = 1; k <= 4; k++) {
            const tk = th - k * 0.07, rk = onda(tk, 0, 0.055);
            c.globalAlpha = 0.35 * (1 - k / 5); c.fillStyle = "#ffd27a";
            c.beginPath(); c.arc(x + Math.cos(tk) * rk, y + Math.sin(tk) * rk * 0.93, R * 0.025 * (1 - k / 6), 0, Math.PI * 2); c.fill();
          }
          c.save();
          c.globalAlpha = 0.8 + 0.2 * Math.sin(t * 1.7 + i);
          c.translate(px, py); c.rotate(Math.sin(t * 1.5 + i * 1.1) * 0.28);
          figura(c, notas[i % 4], 0, 0, R * (0.36 + 0.05 * Math.sin(t * 2 + i)), tonos[i % 4], "rgba(110,40,0,.75)");
          c.restore();
        }
      } else if (id === "jefe_fase1") {
        // Fase 1: humo negro que gira despacio alrededor, con un filo violeta apagado (detrás de la ficha)
        for (let k = 0; k < 9; k++) {
          const a = t * 0.35 + k * Math.PI * 2 / 9 + 0.35 * Math.sin(t * 0.6 + k), r = R * (1.2 + 0.14 * Math.sin(t * 1.1 + k * 1.7));
          const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r, tam = R * (0.42 + 0.1 * Math.sin(t * 1.4 + k));
          const g = c.createRadialGradient(px, py, 0, px, py, tam);
          g.addColorStop(0, "rgba(8,5,14,.72)"); g.addColorStop(0.6, "rgba(30,16,52,.35)"); g.addColorStop(1, "rgba(30,16,52,0)");
          c.fillStyle = g; c.beginPath(); c.arc(px, py, tam, 0, Math.PI * 2); c.fill();
        }
        c.globalAlpha = 0.5 + 0.15 * Math.sin(t * 1.6); c.strokeStyle = "rgba(110,80,170,.8)"; c.lineWidth = R * 0.025;
        c.beginPath(); c.arc(x, y, R * 1.02, 0, Math.PI * 2); c.stroke();
      } else if (id === "jefe_fase2") {
        // Fase 2: la silueta se descompone; aros fantasma rojo y cian que saltan de sitio y esquirlas que orbitan
        const sem = Math.floor(t * 9), az = n => { const v = Math.sin(sem * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v); };
        c.globalCompositeOperation = "lighter";
        [["rgba(255,40,90,.5)", 1], ["rgba(40,230,255,.45)", -1]].forEach(([col, s], i) => {
          const dx = (az(i * 3) - 0.5) * R * 0.22 * s, dy = (az(i * 3 + 1) - 0.5) * R * 0.12;
          c.strokeStyle = col; c.lineWidth = R * 0.04;
          c.beginPath(); c.arc(x + dx, y + dy, R * (1.04 + az(i * 3 + 2) * 0.06), 0, Math.PI * 2); c.stroke();
        });
        c.globalCompositeOperation = "source-over";
        for (let k = 0; k < 7; k++) {
          const a = -t * 0.9 + k * Math.PI * 2 / 7 + (az(k + 9) - 0.5) * 0.3, r = R * (1.32 + 0.1 * Math.sin(t * 2 + k));
          const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r, l = R * (0.16 + 0.06 * az(k + 20));
          c.save(); c.translate(px, py); c.rotate(a + t * 2);
          c.globalAlpha = 0.85; c.fillStyle = k % 2 ? "#3b2a63" : "#16101f"; c.strokeStyle = "rgba(170,140,255,.7)"; c.lineWidth = R * 0.012;
          c.beginPath(); c.moveTo(0, -l); c.lineTo(l * 0.45, l * 0.6); c.lineTo(-l * 0.5, l * 0.4); c.closePath(); c.fill(); c.stroke();
          c.restore();
        }
      } else if (id === "jefe_fase3") {
        // Fase 3: el remolino del agujero (su imagen) girando detrás de la ficha, y motas que caen hacia dentro
        const e = imagen(IMG_FASE3, () => {});
        c.save();
        if (e && e.listo) {
          c.translate(x, y); c.rotate(t * 0.18);
          c.globalAlpha = 0.9; c.drawImage(e.img, -R * 2.1, -R * 2.1, R * 4.2, R * 4.2);
        } else {
          const g = c.createRadialGradient(x, y, R, x, y, R * 2);
          g.addColorStop(0, "rgba(60,30,120,.6)"); g.addColorStop(1, "rgba(10,5,25,0)");
          c.fillStyle = g; c.beginPath(); c.arc(x, y, R * 2, 0, Math.PI * 2); c.fill();
        }
        c.restore();
        c.globalCompositeOperation = "lighter";
        for (let k = 0; k < 14; k++) {
          const f = (t * 0.35 + k / 14) % 1, a = k * 2.4 + f * 3.2, r = R * (2 - f * 1.05);
          c.globalAlpha = Math.sin(f * Math.PI) * 0.8; c.fillStyle = k % 3 ? "#9d7bff" : "#5ff0d8";
          c.beginPath(); c.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, R * 0.035, 0, Math.PI * 2); c.fill();
        }
      } else if (id === "forma_intangible") {
        // Intangible: un velo que vuelve la ficha medio transparente y aros discontinuos que se deshacen
        c.globalAlpha = 0.28 + 0.12 * Math.sin(t * 5); c.fillStyle = "#0c0a14";
        c.beginPath(); c.arc(x, y, R * 0.98, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 0.7; c.strokeStyle = "rgba(190,175,255,.7)"; c.lineWidth = R * 0.03;
        for (let k = 0; k < 2; k++) {
          c.setLineDash([R * 0.18, R * 0.14]); c.lineDashOffset = (k ? -1 : 1) * t * R * 0.6;
          c.beginPath(); c.arc(x, y, R * (1.08 + k * 0.14), 0, Math.PI * 2); c.stroke();
        }
        c.setLineDash([]);
      } else if (id === "forma_densa") {
        // Densa: un anillo negro grueso y pesado que late despacio, con grietas violeta
        const p = 1 + 0.03 * Math.sin(t * 2.2);
        c.strokeStyle = "rgba(6,4,10,.9)"; c.lineWidth = R * 0.16;
        c.beginPath(); c.arc(x, y, R * 1.1 * p, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = "rgba(150,110,240,.75)"; c.lineWidth = R * 0.02;
        for (let k = 0; k < 6; k++) {
          const a = k * Math.PI / 3 + 0.2;
          c.beginPath(); c.moveTo(x + Math.cos(a) * R * 1.03 * p, y + Math.sin(a) * R * 1.03 * p);
          c.lineTo(x + Math.cos(a + 0.08) * R * 1.12 * p, y + Math.sin(a + 0.08) * R * 1.12 * p);
          c.lineTo(x + Math.cos(a - 0.04) * R * 1.18 * p, y + Math.sin(a - 0.04) * R * 1.18 * p); c.stroke();
        }
      } else if (id === "forma_extensa") {
        // Extensa: zarcillos de oscuridad que salen de detrás de la ficha y se mecen hasta el doble de su alcance
        c.lineCap = "round";
        for (let k = 0; k < 6; k++) {
          const a = k * Math.PI / 3 + 0.3 * Math.sin(t * 0.8 + k), largo = R * (2.1 + 0.25 * Math.sin(t * 1.3 + k * 2));
          const ox = x + Math.cos(a) * R * 0.95, oy = y + Math.sin(a) * R * 0.95;
          const fx = x + Math.cos(a + 0.25 * Math.sin(t * 1.7 + k)) * largo, fy = y + Math.sin(a + 0.25 * Math.sin(t * 1.7 + k)) * largo;
          const cx1 = x + Math.cos(a + 0.5 * Math.sin(t + k)) * R * 1.6, cy1 = y + Math.sin(a + 0.5 * Math.sin(t + k)) * R * 1.6;
          c.strokeStyle = "rgba(8,6,14,.85)"; c.lineWidth = R * 0.13;
          c.beginPath(); c.moveTo(ox, oy); c.quadraticCurveTo(cx1, cy1, fx, fy); c.stroke();
          c.strokeStyle = "rgba(140,100,230,.55)"; c.lineWidth = R * 0.03;
          c.beginPath(); c.moveTo(ox, oy); c.quadraticCurveTo(cx1, cy1, fx, fy); c.stroke();
        }
      } else if (id === "jefe_carga") {
        // Cargando: la oscuridad se recoge hacia la ficha y un anillo se cierra; cada segundo y medio vuelve a empezar
        const f = (t / 1.5) % 1;
        c.globalCompositeOperation = "lighter";
        for (let k = 0; k < 16; k++) {
          const g = (f + k / 16) % 1, a = k * 2.399 + t * 0.6, r = R * (2.2 - g * 1.2);
          c.globalAlpha = g * 0.9; c.fillStyle = k % 2 ? "#a58cff" : "#e8e2ff";
          c.beginPath(); c.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, R * (0.03 + 0.03 * g), 0, Math.PI * 2); c.fill();
        }
        c.globalCompositeOperation = "source-over";
        c.globalAlpha = 0.35 + 0.5 * f; c.strokeStyle = "#b9a6ff"; c.lineWidth = R * (0.02 + 0.05 * f);
        c.beginPath(); c.arc(x, y, R * (1.9 - 0.85 * f), 0, Math.PI * 2); c.stroke();
      } else if (id === "jefe_expuesto") {
        // Expuesto: grietas de luz blanca sobre el borde y un brillo pálido que late
        const p = 0.5 + 0.5 * Math.sin(t * 4);
        const g = c.createRadialGradient(x, y, R * 0.9, x, y, R * 1.4);
        g.addColorStop(0, `rgba(255,250,230,${0.25 + 0.2 * p})`); g.addColorStop(1, "rgba(255,250,230,0)");
        c.fillStyle = g; c.beginPath(); c.arc(x, y, R * 1.4, 0, Math.PI * 2); c.fill();
        c.strokeStyle = `rgba(255,255,245,${0.6 + 0.35 * p})`; c.lineWidth = R * 0.03; c.lineJoin = "round";
        for (let k = 0; k < 5; k++) {
          const a = k * 1.257 + 0.4;
          c.beginPath();
          for (let j = 0; j <= 4; j++) {
            const r = R * (0.82 + j * 0.1), d = (j % 2 ? 0.07 : -0.05);
            const px = x + Math.cos(a + d) * r, py = y + Math.sin(a + d) * r;
            if (j) c.lineTo(px, py); else c.moveTo(px, py);
          }
          c.stroke();
        }
      } else if (ZORROS[id]) {
        // flota junto a Eledar, arriba a la derecha
        dibujarZorro(c, id, x + R * 0.98, y - R * 0.62, R * 0.5, t);
      } else if (id === "marca_cazador") {
        // Marca del cazador: una mira roja que gira despacio y late, con cuatro puntas que apuntan a la presa
        const lat = 1 + 0.05 * Math.sin(t * 4), r = R * 1.12 * lat, giro = t * 0.6;
        c.strokeStyle = "#e0303a"; c.lineCap = "round";
        c.globalAlpha = 0.85; c.lineWidth = R * 0.045;
        for (let k = 0; k < 4; k++) { const a0 = giro + k * Math.PI / 2 + 0.22; c.beginPath(); c.arc(x, y, r, a0, a0 + Math.PI / 2 - 0.44); c.stroke(); }
        c.fillStyle = "#e0303a";
        for (let k = 0; k < 4; k++) {
          const a = giro + k * Math.PI / 2, ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
          const r1 = r + R * 0.22, r2 = r - R * 0.02, w = R * 0.08;
          c.beginPath(); c.moveTo(x + ux * r2, y + uy * r2); c.lineTo(x + ux * r1 + px * w, y + uy * r1 + py * w); c.lineTo(x + ux * r1 - px * w, y + uy * r1 - py * w); c.closePath(); c.fill();
        }
        c.globalAlpha = 0.25 + 0.15 * Math.sin(t * 4); c.lineWidth = R * 0.02;
        c.beginPath(); c.arc(x, y, r * 1.12, 0, Math.PI * 2); c.stroke();
      } else if (id === "inspiracion_bardica") {
        // Inspiración bárdica: un halo dorado que respira y destellos que suben alrededor, como notas de luz
        const halo = c.createRadialGradient(x, y, R * 0.95, x, y, R * 1.4);
        halo.addColorStop(0, "rgba(255,205,90,0)"); halo.addColorStop(0.5, `rgba(255,205,90,${0.16 + 0.06 * Math.sin(t * 2.2)})`); halo.addColorStop(1, "rgba(255,205,90,0)");
        c.fillStyle = halo; c.beginPath(); c.arc(x, y, R * 1.4, 0, Math.PI * 2); c.fill();
        for (let i = 0; i < 9; i++) {
          const f = (t * 0.35 + i / 9) % 1, ang = i * 2.4 + 0.5;
          const px = x + Math.cos(ang) * R * (1.05 + 0.1 * Math.sin(t + i)) + Math.sin(t * 2 + i) * R * 0.05, py = y + Math.sin(ang) * R * 0.9 - f * R * 0.9;
          c.globalAlpha = Math.sin(f * Math.PI) * 0.95; c.fillStyle = i % 2 ? "#ffe9a6" : "#ffc24a";
          destello(c, px, py, R * (0.11 + 0.05 * Math.sin(t * 5 + i)));
        }
      } else if (id === "heroismo") {
        // Heroísmo: rayos dorados que salen de detrás de la ficha y giran muy despacio, con un brillo cálido
        const halo = c.createRadialGradient(x, y, R * 0.98, x, y, R * 1.55);
        halo.addColorStop(0, "rgba(255,190,60,0)"); halo.addColorStop(0.15, "rgba(255,190,60,.3)"); halo.addColorStop(1, "rgba(255,190,60,0)");
        c.fillStyle = halo; c.beginPath(); c.arc(x, y, R * 1.55, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#ffd36b";
        for (let k = 0; k < 14; k++) {
          const a = t * 0.25 + k * Math.PI * 2 / 14, largo = R * (1.32 + 0.1 * Math.sin(t * 3 + k * 1.7)), ancho = 0.07;
          c.globalAlpha = 0.35 + 0.25 * Math.sin(t * 2 + k);
          c.beginPath(); c.moveTo(x + Math.cos(a - ancho) * R * 1.02, y + Math.sin(a - ancho) * R * 1.02);
          c.lineTo(x + Math.cos(a) * largo, y + Math.sin(a) * largo);
          c.lineTo(x + Math.cos(a + ancho) * R * 1.02, y + Math.sin(a + ancho) * R * 1.02); c.closePath(); c.fill();
        }
      } else if (id === "manto_inspiracion") {
        // Manto de inspiración (Glamour): un velo rosado y lila que ondea alrededor con pétalos de luz
        c.lineCap = "round";
        [["#ff8ad8", 0, 0.05], ["#c79bff", Math.PI, 0.035]].forEach(([col, fase, grosor]) => {
          c.beginPath();
          for (let j = 0; j <= 90; j++) {
            const th = j / 90 * Math.PI * 2, r = R * (1.16 + 0.07 * Math.sin(th * 3 + t * 1.8 + fase));
            const px = x + Math.cos(th) * r, py = y + Math.sin(th) * r;
            if (j) c.lineTo(px, py); else c.moveTo(px, py);
          }
          c.globalAlpha = 0.45; c.strokeStyle = col; c.lineWidth = R * grosor; c.stroke();
        });
        for (let i = 0; i < 6; i++) {
          const a = -t * 0.7 + i * Math.PI / 3, r = R * (1.2 + 0.08 * Math.sin(t * 2.5 + i));
          c.save(); c.translate(x + Math.cos(a) * r, y + Math.sin(a) * r); c.rotate(a + t);
          c.globalAlpha = 0.85; c.fillStyle = i % 2 ? "#ffd0f0" : "#e6c9ff";
          c.beginPath(); c.ellipse(0, 0, R * 0.09, R * 0.04, 0, 0, Math.PI * 2); c.fill();
          c.restore();
        }
      } else if (id === "magia_reforzante") {
        // Magia reforzante: chispas de todos los colores que giran en espiral hacia la ficha y se encienden al llegar
        const h0 = (t * 60) % 360;
        for (let i = 0; i < 10; i++) {
          const f = (t * 0.45 + i / 10) % 1, a = i * 0.63 + f * 4, r = R * (1.5 - f * 0.5);
          c.globalAlpha = Math.sin(f * Math.PI); c.fillStyle = `hsl(${(h0 + i * 36) % 360},100%,70%)`;
          destello(c, x + Math.cos(a) * r, y + Math.sin(a) * r, R * (0.09 + 0.07 * f));
        }
        c.globalAlpha = 0.3 + 0.15 * Math.sin(t * 3); c.strokeStyle = `hsl(${h0},100%,70%)`; c.lineWidth = R * 0.03;
        c.beginPath(); c.arc(x, y, R * 1.04, 0, Math.PI * 2); c.stroke();
      } else if (id === "furia_salvaje") {
        // Furia de la magia salvaje: aura de colores arcanos que cambian sin parar, relámpagos que bailan sobre la ficha,
        // motas de magia descontrolada, fuegos fatuos que suben y brotes que nacen y se marchitan a sus pies
        const h0 = (t * 80) % 360, pulso = 1 + 0.06 * Math.sin(t * 7) + 0.04 * Math.sin(t * 11.3);
        const aura = c.createRadialGradient(x, y, R * 0.85, x, y, R * 1.6 * pulso);
        aura.addColorStop(0, `hsla(${h0},95%,60%,0)`);
        aura.addColorStop(0.3, `hsla(${h0},95%,62%,.34)`);
        aura.addColorStop(0.65, `hsla(${(h0 + 120) % 360},95%,60%,.16)`);
        aura.addColorStop(1, `hsla(${(h0 + 240) % 360},95%,60%,0)`);
        c.fillStyle = aura; c.beginPath(); c.arc(x, y, R * 1.6 * pulso, 0, Math.PI * 2); c.fill();
        // anillo partido en trozos de colores que giran a saltos
        c.lineCap = "round";
        for (let k = 0; k < 6; k++) {
          const a0 = t * (k % 2 ? 1.4 : -1.1) + k * Math.PI / 3;
          c.globalAlpha = 0.55; c.strokeStyle = `hsl(${(h0 + k * 60) % 360},100%,68%)`; c.lineWidth = R * 0.035;
          c.beginPath(); c.arc(x, y, R * (1.08 + 0.03 * Math.sin(t * 9 + k)), a0, a0 + 0.55); c.stroke();
        }
        c.globalAlpha = 1;
        c.globalCompositeOperation = "lighter";
        // relámpagos: se rehacen 8 veces por segundo, con una semilla que depende del tiempo
        const semilla = Math.floor(t * 8), az = n => { const v = Math.sin(semilla * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v); };
        for (let k = 0; k < 3; k++) {
          if (az(k * 11) < 0.3) continue;
          const a1 = az(k * 11 + 1) * Math.PI * 2, largo = (0.7 + az(k * 11 + 2)) * (az(k * 11 + 3) < 0.5 ? 1 : -1);
          c.beginPath();
          for (let j = 0; j <= 7; j++) {
            const a = a1 + largo * j / 7, r = R * (0.96 + (j % 7 ? (az(k * 11 + 4 + j) - 0.5) * 0.32 : 0));
            const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
            if (j) c.lineTo(px, py); else c.moveTo(px, py);
          }
          const col = `hsl(${(h0 + 90 + k * 100) % 360},100%,78%)`;
          // resplandor con un trazo ancho y tenue en vez de una sombra difuminada (mucho más barato)
          c.globalAlpha = 0.25; c.strokeStyle = col; c.lineWidth = R * 0.12; c.stroke();
          c.globalAlpha = 1; c.lineWidth = R * 0.028; c.stroke();
        }
        // motas de magia
        for (let i = 0; i < 10; i++) {
          const a = t * (0.7 + i * 0.12) * (i % 2 ? 1 : -1) + i * 2.1, rr = R * (1.12 + 0.28 * Math.sin(t * 1.6 + i * 3.1));
          c.globalAlpha = 0.7 + 0.3 * Math.sin(t * 6 + i);
          c.fillStyle = `hsl(${(h0 + i * 37) % 360},100%,70%)`;
          c.beginPath(); c.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, R * 0.045 * (1 + 0.5 * Math.sin(t * 5 + i)), 0, Math.PI * 2); c.fill();
        }
        // fuegos fatuos que suben
        for (let i = 0; i < 5; i++) {
          const f = (t * 0.55 + i / 5) % 1, ang = i * 1.26 + 0.4;
          const bx = x + Math.cos(ang) * R * 1.02 + Math.sin(t * 2 + i) * R * 0.05, by = y + Math.sin(ang) * R * 1.02 - f * R * 0.8;
          const g2 = c.createRadialGradient(bx, by, 0, bx, by, R * 0.12);
          g2.addColorStop(0, `hsla(${(h0 + 180) % 360},100%,80%,${0.8 * (1 - f)})`); g2.addColorStop(1, `hsla(${(h0 + 180) % 360},100%,60%,0)`);
          c.globalAlpha = 1; c.fillStyle = g2; c.beginPath(); c.arc(bx, by, R * 0.12, 0, Math.PI * 2); c.fill();
        }
        c.globalCompositeOperation = "source-over";
        // brotes que nacen y se marchitan abajo
        for (let i = 0; i < 3; i++) {
          const s2 = Math.sin(((t * 0.32 + i / 3) % 1) * Math.PI), ang = Math.PI / 2 + (i - 1) * 0.6;
          if (s2 < 0.05) continue;
          const bx = x + Math.cos(ang) * R * 0.97, by = y + Math.sin(ang) * R * 0.97, hacia = ang + (i - 1) * 0.3;
          const tx = bx + Math.cos(hacia) * R * 0.32 * s2, ty = by + Math.sin(hacia) * R * 0.32 * s2;
          c.globalAlpha = s2; c.strokeStyle = "#3f9e3a"; c.lineWidth = R * 0.03;
          c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + Math.cos(hacia + 0.6) * R * 0.15 * s2, by + Math.sin(hacia + 0.6) * R * 0.15 * s2, tx, ty); c.stroke();
          c.fillStyle = "#62d45a";
          [-0.7, 0.7].forEach(lado => {
            c.save(); c.translate(tx, ty); c.rotate(hacia + lado);
            c.beginPath(); c.ellipse(R * 0.07 * s2, 0, R * 0.08 * s2, R * 0.035 * s2, 0, 0, Math.PI * 2); c.fill();
            c.restore();
          });
        }
      } else if (id === "casteo_cartas") {
        // Cartas moradas barajándose en órbita: se acercan, se alejan y se dan la vuelta
        const w = R * 0.34, h = R * 0.5;
        for (let i = 0; i < 5; i++) {
          const a = t * 1.25 + i * Math.PI * 2 / 5, rr = R * (1.22 + 0.16 * Math.sin(t * 2.3 + i * 1.7));
          const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.9;
          const giro = Math.cos(t * 3 + i * 1.1);
          c.save();
          c.translate(px, py); c.rotate(a + Math.PI / 2); c.scale(Math.max(0.08, Math.abs(giro)), 1);
          c.globalAlpha = 0.95;
          c.beginPath(); if (c.roundRect) c.roundRect(-w / 2, -h / 2, w, h, w * 0.14); else c.rect(-w / 2, -h / 2, w, h);
          if (giro > 0) {
            c.fillStyle = "#4a1f73"; c.fill(); c.lineWidth = w * 0.08; c.strokeStyle = "#d8b4ff"; c.stroke();
            c.beginPath(); c.moveTo(0, -h * 0.3); c.lineTo(w * 0.28, 0); c.lineTo(0, h * 0.3); c.lineTo(-w * 0.28, 0); c.closePath();
            c.fillStyle = "#b57bff"; c.fill();
          } else {
            c.fillStyle = "#f6efff"; c.fill(); c.lineWidth = w * 0.08; c.strokeStyle = "#7d3cc9"; c.stroke();
            figura(c, ["pica", "diamante", "trebol", "corazon", "estrella"][i], 0, 0, h * 0.5, "#7d3cc9");
          }
          c.restore();
        }
      } else if (id === "fumando") {
        // Humo que sale de un costado, sube, se abre y se desvanece
        const ox = x + R * 0.78, oy = y - R * 0.12;
        for (let i = 0; i < 8; i++) {
          const f = (t * 0.32 + i / 8) % 1;
          const px = ox + f * R * 0.75 + Math.sin(t * 1.4 + i * 2.1) * R * 0.12, py = oy - f * R * 1.5;
          const rad = R * (0.07 + f * 0.34);
          const alfa = 0.42 * (1 - f) * Math.min(1, f * 8);
          const g = c.createRadialGradient(px, py, 0, px, py, rad);
          g.addColorStop(0, `rgba(215,215,222,${alfa})`); g.addColorStop(1, "rgba(215,215,222,0)");
          c.fillStyle = g; c.beginPath(); c.arc(px, py, rad, 0, Math.PI * 2); c.fill();
        }
      } else if (id === "raudo") {
        // Líneas de velocidad por detrás y ráfagas de viento girando
        c.lineCap = "round";
        for (let i = 0; i < 7; i++) {
          const f = (t * 1.7 + i / 7) % 1, sy = y + (i / 6 - 0.5) * R * 1.5, sx = x - R * 0.85 - f * R * 1.2, largo = R * (0.45 + 0.35 * Math.abs(Math.sin(i * 1.9)));
          c.strokeStyle = `rgba(200,236,255,${0.65 * (1 - f)})`; c.lineWidth = R * 0.05;
          c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - largo, sy); c.stroke();
        }
        for (let k = 0; k < 3; k++) {
          const a0 = t * 4.2 + k * Math.PI * 2 / 3;
          c.strokeStyle = "rgba(225,245,255,.55)"; c.lineWidth = R * 0.045;
          c.beginPath(); c.ellipse(x, y, R * 1.18, R * 0.95, 0, a0, a0 + 0.9); c.stroke();
        }
      }
      c.restore();
    }
    function programarLuz() {
      actualizarAnim();
      if (luzPendiente) return;
      luzPendiente = true;
      // requestAnimationFrame no corre con la pestaña en segundo plano: el temporizador hace de respaldo
      const hacer = () => { if (!luzPendiente) return; luzPendiente = false; actualizarLuz(); };
      requestAnimationFrame(hacer);
      setTimeout(hacer, 80);
    }
    function actualizarLuz() {
      const L = opcLuz();
      const antes = st.luzOn;
      if (!pintorLuz || !L.activa || !st.escena) {
        st.luzOn = false;
        if (sombra.visible()) sombra.visible(false);
        tiradores.destroyChildren();
        if (antes) st.nodos.forEach(aplicarAtributos);
        lObj.batchDraw();
        return;
      }
      const m = medidas(), objs = [...st.nodos.values()].map(n => n.o), pxPie = tam() / pies();
      const comoJugador = !st.esGM || st.vistaJugador;
      const segs = TBLuz.segmentosDe(objs).vista;
      // Quién mira: el jugador, sus fichas; el DJ, las de todos los jugadores
      const viewers = objs.filter(o => o.tipo === "imagen" && o.capa === "fichas" && (st.esGM ? (o.controlan_todos || (o.controladores || []).length > 0) : controla(o)) && !(o.datos && o.datos.vision && o.datos.vision.ve === false))
        .map(o => ({ x: o.x, y: o.y, oscuridad: (Number(((o.datos || {}).vision || {}).oscuridad) || 0) * pxPie }));
      const fuentes = objs.filter(o => o.tipo === "luz" || (o.tipo === "imagen" && o.capa !== "mapa" && o.datos && o.datos.luz))
        .map(o => { const l = (o.datos || {}).luz || {}; return { x: o.x, y: o.y, brillante: (Number(l.brillante) || 0) * pxPie, tenue: (Number(l.tenue) || 0) * pxPie }; });
      const lienzoOsc = pintorLuz.pintar({ medidas: m, segs, viewers, fuentes, global: !!L.global, explorar: L.explorar !== false, claveExplorado: (st.escena.id || "") + (comoJugador ? "|j" : "|g"), alCargar: programarLuz });
      pintarTiradores(objs, comoJugador);
      sombra.setAttrs({ image: lienzoOsc, width: m.w, height: m.h, visible: true, opacity: comoJugador ? 1 : (L.opacidadDJ == null ? 0.35 : Number(L.opacidadDJ)) });
      st.luzOn = true;
      if (comoJugador || antes !== st.luzOn) st.nodos.forEach(aplicarAtributos);
      lObj.batchDraw();
    }

    function pintarTiradores(objs, comoJugador) {
      tiradores.destroyChildren();
      if (!comoJugador) return;
      const t = tam();
      objs.forEach(o => {
        if (o.capa !== "luz" || o.tipo !== "dibujo" || (o.datos || {}).muro !== "puerta") return;
        const p = TBLuz.tiradorPuerta(o);
        if (!p) return;
        const d = t * 0.3;
        if (!pintorLuz.visible(p.x + p.nx * d, p.y + p.ny * d) && !pintorLuz.visible(p.x - p.nx * d, p.y - p.ny * d)) return;
        const llave = !!(o.datos || {}).llave, abierta = !!(o.datos || {}).abierta;
        const g = new Konva.Group({ x: p.x, y: p.y });
        const r = Math.max(9, t * 0.17);
        g.add(new Konva.Circle({ radius: r, fill: abierta ? "#f2994a" : "#fff", stroke: llave ? "#888" : "#f2994a", strokeWidth: 2.5 }));
        g.add(new Konva.Rect({ x: -r * 0.38, y: -r * 0.55, width: r * 0.76, height: r * 1.1, stroke: abierta ? "#fff" : "#a65a1a", strokeWidth: 1.6, listening: false }));
        g.add(new Konva.Circle({ x: r * 0.18, y: 0, radius: r * 0.1, fill: abierta ? "#fff" : "#a65a1a", listening: false }));
        g.on("mouseenter", () => { contenedor.style.cursor = "pointer"; });
        g.on("mouseleave", () => { contenedor.style.cursor = ""; });
        g.on("click tap", e => { e.cancelBubble = true; if (op.onPuerta) op.onPuerta(o.id); });
        g.on("mousedown touchstart", e => { e.cancelBubble = true; });
        tiradores.add(g);
      });
    }

    // Vista previa de un efecto: el trayecto (flecha) y su área (cono, haz, impacto o radio) con la distancia
    // El radio arrastrado va en casillas enteras (salvo con la regla sin ajuste)
    function radioArrastrado(L) { return (st.opc.ajusteMedida || "centro") === "ninguno" ? L : Math.max(tam(), Math.round(L / tam()) * tam()); }
    function etiquetaFx(p, texto) {
      const z = zoom(), etq = new Konva.Label({ x: p.x + 10 / z, y: p.y - 28 / z, scaleX: 1 / z, scaleY: 1 / z });
      etq.add(new Konva.Tag({ fill: "#e8641c", cornerRadius: 4 }));
      etq.add(new Konva.Text({ text: texto, fontSize: 15, fontStyle: "bold", fill: "#fff", padding: 5 }));
      guiaMedida.add(etq);
    }
    // Centro de la ficha bajo el punto o, si no hay ninguna, de la casilla
    function centroFx(p) {
      const bajo = [...st.nodos.values()].filter(n => n.g.visible() && n.o.tipo === "imagen" && (n.o.capa === "fichas" || (st.esGM && n.o.capa === "gm"))
        && Math.abs(p.x - n.o.x) <= n.o.ancho / 2 && Math.abs(p.y - n.o.y) <= n.o.alto / 2).sort((a, b) => (b.o.z || 0) - (a.o.z || 0));
      if (bajo.length) return { x: bajo[0].o.x, y: bajo[0].o.y };
      const t = tam(), d0 = desp();
      return { x: Math.floor((p.x - d0.x) / t) * t + t / 2 + d0.x, y: Math.floor((p.y - d0.y) / t) * t + t / 2 + d0.y };
    }
    // Fuera la guía de un efecto (también la que ven los demás): el efecto se ve solo, sin las medidas
    function quitarGuiaFx() { guiaMedida.destroyChildren(); lUI.batchDraw(); if (op.onRegla) op.onRegla(null); }
    function previaFx(a, p) {
      const fp = st.opc.fxPrevia || {};
      if (fp.mostrar === false) return;
      const z = zoom(), col = "#e8641c", pxPie = tam() / pies(), L = Math.hypot(p.x - a.x, p.y - a.y);
      guiaMedida.destroyChildren();
      let regla = null;
      if (fp.modo === "apuntar") {
        if (L * z < 4) { lUI.batchDraw(); return; }
        guiaMedida.add(new Konva.Arrow({ points: [a.x, a.y, p.x, p.y], stroke: col, fill: col, strokeWidth: 2 / z, dash: [9 / z, 6 / z], pointerLength: 14 / z, pointerWidth: 12 / z }));
        if (fp.forma === "cono") { const ex = { conoGrados: fp.conoGrados, conoForma: fp.conoForma }; dibujarMedida(guiaMedida, "cono", a, p, col, false, ex); regla = { forma: "cono", a, b: p, extra: ex }; }
        else if (fp.forma === "haz") { const ex = { hazPies: fp.hazPies }; dibujarMedida(guiaMedida, "haz", a, p, col, false, ex); regla = { forma: "haz", a, b: p, extra: ex }; }
        else {
          const r = (fp.radioPies || 5) * pxPie;
          guiaMedida.add(new Konva.Circle({ x: p.x, y: p.y, radius: r, stroke: col, strokeWidth: 2 / z, fill: col + "26", dash: [6 / z, 4 / z] }));
          etiquetaFx(p, textoDistancia(a, p) + " · impacto de " + (fp.radioPies || 5) + " " + (cuad().unidad || "pies"));
          regla = { forma: "linea", a, b: p };
        }
      } else {
        const r = L * z > 8 ? radioArrastrado(L) : (fp.radioPies || 10) * pxPie;
        guiaMedida.add(new Konva.Circle({ x: a.x, y: a.y, radius: r, stroke: col, strokeWidth: 2 / z, fill: col + "33" }));
        guiaMedida.add(new Konva.Line({ points: [a.x, a.y, a.x + r, a.y], stroke: col, strokeWidth: 1.5 / z, dash: [6 / z, 4 / z] }));
        etiquetaFx({ x: a.x + r * 0.72, y: a.y - r * 0.72 }, "radio " + textoCeldas(r / tam()));
        regla = { forma: "circulo", a, b: { x: a.x + r, y: a.y }, extra: { origen: "centro" } };
      }
      if (regla && st.opc.transmitir !== false && op.onRegla) op.onRegla(Object.assign({ color: col }, regla));
      lUI.batchDraw();
    }

    // Añade una parada a la ruta: al arrastrar una ficha (en el centro de su casilla) o al medir con la regla de línea
    function puntoDeRuta() {
      if (st.arrastre) {
        const m = st.nodos.get(st.arrastre.lider), f = st.arrastre.fantasma;
        if (!m || !f) return;
        const p = ajustarPos(m.o, f.x(), f.y());
        const ult = st.arrastre.ruta[st.arrastre.ruta.length - 1];
        if (Math.hypot(p.x - ult.x, p.y - ult.y) < 1) return;
        st.arrastre.ruta.push(p);
        moverFantasma();
        lUI.batchDraw();
        return;
      }
      if (gesto && gesto.tipo === "medida" && (st.opc.formaMedida || "linea") === "linea") {
        const b = gesto.fin || gesto.inicio;
        gesto.ruta = gesto.ruta || [gesto.inicio];
        const ult = gesto.ruta[gesto.ruta.length - 1];
        if (Math.hypot(b.x - ult.x, b.y - ult.y) < 1) return;
        gesto.ruta.push(b);
        dibujarRuta(guiaMedida, gesto.ruta.concat([b]), "#d6127e", true);
        lUI.batchDraw();
      }
    }

    function opacidadNiebla() { lNiebla.opacity(st.esGM && !st.vistaJugador ? 0.42 : 1); }

    /* ------------------------------------------------------------ imágenes */
    function reducida(e, lado) {
      const im = e.img, nw = im.naturalWidth, nh = im.naturalHeight;
      if (!nw || !nh || Math.max(nw, nh) <= lado * 1.3) return im;
      e.red = e.red || {};
      if (!e.red[lado]) {
        const k = lado / Math.max(nw, nh), cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.round(nw * k)); cv.height = Math.max(1, Math.round(nh * k));
        const cx = cv.getContext("2d");
        cx.imageSmoothingQuality = "high";
        cx.drawImage(im, 0, 0, cv.width, cv.height);
        e.red[lado] = cv;
      }
      return e.red[lado];
    }
    /* Fondo con el color dominante del mapa (como «Detectar el color dominante» de Roll20): el color que más se repite
       en la imagen más grande de la capa del mapa pinta la página, y el tablero de alrededor lleva ese color oscurecido */
    const dominantes = new Map();
    function colorDominante() {
      const mapas = [...st.nodos.values()].filter(n => n.o.capa === "mapa" && n.o.tipo === "imagen" && (n.o.datos || {}).src)
        .sort((a, b) => b.o.ancho * b.o.alto - a.o.ancho * a.o.alto);
      for (const n of mapas) {
        const src = n.o.datos.src, e = st.imgs.get(src);
        if (!e || !e.listo) continue;
        if (dominantes.has(src)) return dominantes.get(src);
        try {
          const cv = document.createElement("canvas"); cv.width = 32; cv.height = 32;
          const cx = cv.getContext("2d", { willReadFrequently: true });
          cx.drawImage(e.img, 0, 0, 32, 32);
          const px = cx.getImageData(0, 0, 32, 32).data, cubos = new Map();
          for (let i = 0; i < px.length; i += 4) {
            if (px[i + 3] < 128) continue;
            const k = (px[i] >> 4) << 8 | (px[i + 1] >> 4) << 4 | (px[i + 2] >> 4);
            const c = cubos.get(k) || [0, 0, 0, 0];
            c[0] += px[i]; c[1] += px[i + 1]; c[2] += px[i + 2]; c[3]++;
            cubos.set(k, c);
          }
          let mejor = null;
          cubos.forEach(c => { if (!mejor || c[3] > mejor[3]) mejor = c; });
          const col = mejor ? [mejor[0] / mejor[3], mejor[1] / mejor[3], mejor[2] / mejor[3]].map(Math.round) : null;
          dominantes.set(src, col);
          return col;
        } catch (err) { dominantes.set(src, null); return null; }   // imagen de otro sitio sin permiso para leerla
      }
      return null;
    }
    const aHex = c => "#" + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
    let fondoPendiente = null;
    function aplicarFondo() {
      const escena = st.escena, opc = (escena && escena.opciones) || {};
      let pag = (escena && escena.fondo) || "#ffffff", tablero = opc.colorTablero || "#3d4048";
      if (escena && opc.fondoAuto !== false) {
        const c = colorDominante();
        // como Roll20: el tablero lleva el color dominante tal cual, con un degradado muy suave de arriba abajo
        if (c) { pag = aHex(c); tablero = `linear-gradient(${aHex(c.map(v => v * 1.03 + 1))}, ${aHex(c.map(v => v * 0.94))})`; }
      }
      pagina.fill(pag);
      contenedor.style.background = tablero;
      lMapa.batchDraw();
    }
    function programarFondo() { clearTimeout(fondoPendiente); fondoPendiente = setTimeout(aplicarFondo, 120); }
    function imagen(src, alListo) {
      if (!src) return null;
      let e = st.imgs.get(src);
      if (!e) {
        const img = new Image();
        if (/^https?:/i.test(src) && src.includes(SUPA)) img.crossOrigin = "anonymous";
        e = { img, listo: false, esperan: [] };
        img.onload = () => { e.listo = true; e.esperan.splice(0).forEach(f => f()); };
        img.onerror = () => { e.error = true; e.esperan.splice(0).forEach(f => f()); };
        img.src = src;
        st.imgs.set(src, e);
      }
      if (!e.listo && !e.error && alListo) e.esperan.push(alListo);
      return e;
    }

    /* ------------------------------------------------------------ objetos */
    function cuerpoDe(o, n) {
      const w = o.ancho, h = o.alto, d = o.datos || {};
      if (o.tipo === "texto") {
        const grp = new Konva.Group();
        const txt = new Konva.Text({ text: d.texto || "", fontSize: d.tam || 26, fontFamily: d.fuente || "Arial", fill: d.color || "#000",
          fontStyle: [d.cursiva ? "italic" : "", d.negrita ? "bold" : ""].join(" ").trim() || "normal", padding: 3, lineHeight: 1.15 });
        if (d.fondo && d.fondo !== "transparent") grp.add(new Konva.Rect({ width: txt.width(), height: txt.height(), fill: d.fondo, cornerRadius: 2 }));
        grp.add(txt);
        return grp;
      }
      if (o.tipo === "luz") {
        const g = new Konva.Group();
        const l = d.luz || {}, rt = ((Number(l.brillante) || 0) + (Number(l.tenue) || 0)) / pies() * tam();
        if (rt > 0) g.add(new Konva.Circle({ x: w / 2, y: h / 2, radius: rt, stroke: "#f2c94c", strokeWidth: 1.5, dash: [8, 6], listening: false, opacity: 0.8 }));
        if (Number(l.brillante) > 0) g.add(new Konva.Circle({ x: w / 2, y: h / 2, radius: Number(l.brillante) / pies() * tam(), stroke: "#f2c94c", strokeWidth: 1, listening: false, opacity: 0.6 }));
        g.add(new Konva.Circle({ x: w / 2, y: h / 2, radius: Math.min(w, h) / 2, fill: "#ffd84d", stroke: "#a67c00", strokeWidth: 2 }));
        g.add(new Konva.Path({ x: w / 2 - 7, y: h / 2 - 7, data: "M7 0v3M7 11v3M0 7h3M11 7h3M2 2l2 2M10 10l2 2M2 12l2-2M10 4l2-2", stroke: "#7a5a00", strokeWidth: 1.6, listening: false }));
        return g;
      }
      if (o.tipo === "dibujo" && o.capa === "luz") {
        const tipo = d.muro || "muro";
        const color = (window.TBLuz && TBLuz.COLOR_MURO[tipo]) || "#2f80ed";
        const comun = { stroke: color, strokeWidth: tipo === "puerta" ? 6 : 4, lineCap: "round", lineJoin: "round", hitStrokeWidth: 14, dash: tipo === "puerta" && d.abierta ? [10, 8] : tipo === "ventana" ? [3, 5] : undefined };
        if (d.forma === "rect") return new Konva.Rect(Object.assign({ width: w, height: h }, comun));
        if (d.forma === "elipse") return new Konva.Ellipse(Object.assign({ x: w / 2, y: h / 2, radiusX: w / 2, radiusY: h / 2 }, comun));
        return new Konva.Line(Object.assign({ points: d.puntos || [0, 0, w, h], tension: 0, closed: !!d.cerrado }, comun));
      }
      if (o.tipo === "dibujo") {
        const comun = { stroke: d.trazo || "#000", strokeWidth: d.grosor || 4, fill: d.relleno && d.relleno !== "transparent" ? d.relleno : undefined, lineCap: "round", lineJoin: "round", hitStrokeWidth: Math.max(12, d.grosor || 4) };
        if (d.forma === "rect") return new Konva.Rect(Object.assign({ width: w, height: h }, comun));
        if (d.forma === "elipse") return new Konva.Ellipse(Object.assign({ x: w / 2, y: h / 2, radiusX: w / 2, radiusY: h / 2 }, comun));
        return new Konva.Line(Object.assign({ points: d.puntos || [0, 0, w, h], tension: d.forma === "mano" ? 0.35 : 0, closed: !!d.cerrado }, comun));
      }
      if (o.tipo === "forma") {
        const c = { fill: d.relleno || "rgba(214,18,126,.35)", stroke: d.trazo || "#d6127e", strokeWidth: 2 };
        return d.forma === "circulo" ? new Konva.Ellipse(Object.assign({ x: w / 2, y: h / 2, radiusX: w / 2, radiusY: h / 2 }, c)) : new Konva.Rect(Object.assign({ width: w, height: h }, c));
      }
      if (o.tipo === "pin") {
        const g = new Konva.Group();
        g.add(new Konva.Path({ data: "M12 0C5.4 0 0 5.2 0 11.6 0 20.3 12 32 12 32s12-11.7 12-20.4C24 5.2 18.6 0 12 0z", fill: d.color || "#d6127e", stroke: "#fff", strokeWidth: 1.5, scaleX: w / 24, scaleY: h / 32 }));
        g.add(new Konva.Circle({ x: w / 2, y: h * 0.36, radius: w * 0.2, fill: "#fff" }));
        return g;
      }
      // imagen / ficha
      const e = imagen(d.src, () => { if (st.nodos.get(o.id) === n) { pintarCuerpo(n); if (o.capa === "mapa") programarFondo(); } });
      if (!e || !e.listo) {
        return new Konva.Rect({ width: w, height: h, fill: e && e.error ? "#7a3434" : "rgba(120,120,120,.45)", cornerRadius: Math.min(w, h) / 2, stroke: "#888", strokeWidth: 1 });
      }
      // En el mapa la imagen va entera; en el resto, a una resolución que aguanta acercarse hasta el doble
      const lado = Math.min(1024, Math.pow(2, Math.ceil(Math.log2(Math.max(64, Math.max(w, h) * Konva.pixelRatio * 2)))));
      const fuente = o.capa === "mapa" ? e.img : reducida(e, lado);
      const k = new Konva.Image({ image: fuente, width: w, height: h, perfectDrawEnabled: false });
      // Recorte (fracciones de la imagen): un trozo de un mapa partido sigue usando la imagen entera
      if (d.recorte) {
        const nw = fuente.naturalWidth || fuente.width, nh = fuente.naturalHeight || fuente.height, r = d.recorte;
        k.crop({ x: r.x * nw, y: r.y * nh, width: Math.max(1, r.w * nw), height: Math.max(1, r.h * nh) });
      }
      if (d.voltearH) { k.scaleX(-1); k.x(w); }
      if (d.voltearV) { k.scaleY(-1); k.y(h); }
      if (d.tinte) {
        try {
          const c = parseInt(d.tinte.slice(1), 16);
          k.cache(); k.filters([Konva.Filters.RGBA]);
          k.red((c >> 16) & 255); k.green((c >> 8) & 255); k.blue(c & 255); k.alpha(0.45);
        } catch (err) { /* imagen de otro sitio sin permisos: sin tinte */ }
      }
      return k;
    }

    function pintarCuerpo(n) {
      n.g.destroyChildren();
      n.g.add(cuerpoDe(n.o, n));
      if (n.o.tipo === "texto") {
        const r = n.g.getClientRect({ skipTransform: true });
        n.o.ancho = Math.max(10, r.width); n.o.alto = Math.max(10, r.height);
      }
      n.g.offset({ x: n.o.ancho / 2, y: n.o.alto / 2 });
      pintarDeco(n);
      n.g.getLayer() && n.g.getLayer().batchDraw();
    }

    function pintarDeco(n) {
      const o = n.o, d = o.datos || {};
      n.aura.destroyChildren();
      n.deco.destroyChildren();
      n.aura.position({ x: o.x, y: o.y });
      n.deco.position({ x: o.x, y: o.y });
      const t = tam(), r0 = Math.max(o.ancho, o.alto) / 2;
      const disfrazado = !!d.disfraz && !st.esGM && !controla(o);
      (disfrazado ? [] : (d.auras || [])).forEach(a => {
        if (!a || !(a.radio > 0) || (!st.esGM && a.ver === false)) return;
        const r = r0 + a.radio / pies() * t;
        const comun = { fill: a.color || "#ffff99", opacity: a.opacidad == null ? 0.35 : a.opacidad };
        n.aura.add(a.forma === "cuadrado" ? new Konva.Rect(Object.assign({ x: -r, y: -r, width: r * 2, height: r * 2 }, comun)) : new Konva.Circle(Object.assign({ radius: r }, comun)));
      });
      if (st.turno === o.id) n.aura.add(new Konva.Circle({ radius: r0 + 5, stroke: "#f5b41f", strokeWidth: 4, opacity: 0.95 }));
      // Barras
      const compacto = d.barraEstilo === "compacto";
      const hb = altoBarra(o), sb = sepBarra(o), w = Math.max(o.ancho, 30);
      const barras = disfrazado ? [] : (d.barras || []).map((b, i) => ({ b, i })).filter(({ b }) => b && parseFloat(b.max) > 0 && (st.esGM || controla(o) || b.ver));
      const debajo = d.barraPos === "debajo";
      barras.forEach(({ b, i }, k) => {
        const y = debajo ? o.alto / 2 + 3 + k * (hb + sb) : -o.alto / 2 - 3 - (barras.length - k) * (hb + sb);
        const frac = Math.max(0, Math.min(1, (parseFloat(b.valor) || 0) / parseFloat(b.max)));
        n.deco.add(new Konva.Rect({ x: -w / 2, y, width: w, height: hb, fill: "rgba(0,0,0,.2)", cornerRadius: hb / 2 }));
        if (frac > 0) n.deco.add(new Konva.Rect({ x: -w / 2, y, width: Math.max(hb, w * frac), height: hb, fill: COLORES_BARRA[i], cornerRadius: hb / 2 }));
        const verTexto = !compacto && ((b.texto || "editores") === "todos" || ((b.texto || "editores") === "editores" && (st.esGM || controla(o))));
        const fs = hb * 0.74, comun = { fontSize: fs, fontFamily: "Arial, Helvetica, sans-serif", fontStyle: "bold", fill: "#fff", stroke: "#000", strokeWidth: fs * 0.2, lineJoin: "round", fillAfterStrokeEnabled: true, y: y + (hb - fs) / 2 + fs * 0.06 };
        if (verTexto) n.deco.add(new Konva.Text(Object.assign({ x: -w / 2, width: w, align: "center", text: `${b.valor}/${b.max}` }, comun)));
        // Por encima del máximo, un «+» al final de la barra; por debajo de cero, un «−». Se ven aunque el número esté oculto.
        if (!compacto && b.valor !== "" && b.valor != null) {
          const signo = parseFloat(b.valor) > parseFloat(b.max) ? "+" : parseFloat(b.valor) < 0 ? "−" : "";
          if (signo) n.deco.add(new Konva.Text(Object.assign({ x: w / 2 - hb * 0.95, text: signo }, comun)));
        }
      });
      if (o.tipo === "pin" && d.titulo) {
        const etq = new Konva.Label({ y: o.alto / 2 + 3 });
        etq.add(new Konva.Tag({ fill: "rgba(255,255,255,.95)", cornerRadius: 3, stroke: "#d6127e", strokeWidth: 1 }));
        etq.add(new Konva.Text({ text: d.titulo, fontSize: 12, fontStyle: "bold", fill: "#333", padding: 3 }));
        etq.offsetX(etq.width() / 2);
        n.deco.add(etq);
      }
      if (d.verNombre && d.nombre && o.tipo !== "texto" && o.tipo !== "pin") {
        const etq = new Konva.Label({ y: o.alto / 2 + 4 + (debajo ? barras.length * (hb + sb) : 0) });
        etq.add(new Konva.Tag({ fill: "rgba(20,20,20,.72)", cornerRadius: 3 }));
        etq.add(new Konva.Text({ text: d.nombre, fontSize: 12, fill: "#fff", padding: 3 }));
        etq.offsetX(etq.width() / 2);
        n.deco.add(etq);
      }
      if (o.bloqueado && st.esGM && o.capa === st.capa) n.deco.add(new Konva.Text({ x: o.ancho / 2 - 12, y: -o.alto / 2 - 2, text: "🔒", fontSize: 11 }));
      pintarEstados(n);
      if (d.muerte && o.tipo === "imagen") {
        const m = d.muerte, r = Math.max(3.5, Math.min(7, o.ancho * 0.05)), paso = r * 2.6, hueco = r * 1.6;
        const y = o.alto / 2 + 4 + (debajo ? barras.length * (hb + sb) : 0) + (d.verNombre && d.nombre ? 22 : 0) + r + 2;
        const ancho = paso * 6 + hueco;
        n.deco.add(new Konva.Rect({ x: -ancho / 2, y: y - r - 3, width: ancho, height: r * 2 + 6, fill: "rgba(20,20,20,.72)", cornerRadius: r + 3 }));
        for (let i = 0; i < 6; i++) {
          const exito = i < 3, lleno = exito ? i < (m.exitos | 0) : i - 3 < (m.fallos | 0);
          const x = -ancho / 2 + paso / 2 + i * paso + (exito ? 0 : hueco);
          n.deco.add(new Konva.Circle({ x, y, radius: r, stroke: exito ? "#5cd65c" : "#ff4d4d", strokeWidth: Math.max(1, r * 0.3), fill: lleno ? (exito ? "#5cd65c" : "#ff4d4d") : "transparent" }));
        }
      }
    }

    // Marcadores de estado: una fila de iconos en la esquina de arriba a la derecha (y una X roja si está muerto)
    function pintarEstados(n) {
      const cat = window.TBEstados || [];
      const o = n.o, lista = ((o.datos || {}).estados || []).filter(e => e && e.id && !(cat.find(c => c.id === e.id) || {}).anim);
      if (!lista.length || o.tipo === "pin" || o.tipo === "luz") return;
      const s = Math.max(11, Math.min(22, Math.min(o.ancho, o.alto) * 0.27));
      const porFila = Math.max(1, Math.floor(o.ancho / (s + 1)));
      if (lista.some(e => e.id === "muerto")) {
        const w = o.ancho / 2 * 0.85, h = o.alto / 2 * 0.85;
        n.deco.add(new Konva.Line({ points: [-w, -h, w, h], stroke: "#d32f2f", strokeWidth: Math.max(3, o.ancho * 0.07), lineCap: "round", opacity: 0.9 }));
        n.deco.add(new Konva.Line({ points: [w, -h, -w, h], stroke: "#d32f2f", strokeWidth: Math.max(3, o.ancho * 0.07), lineCap: "round", opacity: 0.9 }));
      }
      lista.filter(e => e.id !== "muerto" && (cat.find(c => c.id === e.id) || {}).id).forEach((e, i) => {
        const def = cat.find(c => c.id === e.id);
        const fila = Math.floor(i / porFila), col = i % porFila;
        const cx = o.ancho / 2 - s / 2 - col * (s + 1), cy = -o.alto / 2 + s / 2 + fila * (s + 1);
        const g = new Konva.Group({ x: cx, y: cy, listening: false });
        if (def.color) g.add(new Konva.Circle({ radius: s * 0.42, fill: def.color, stroke: "#fff", strokeWidth: 1.5 }));
        else {
          const d = def.ic && window.TBMarcas && window.TBMarcas[def.ic];
          if (e.id === "muerto" || !d) return;
          g.add(new Konva.Circle({ radius: s / 2, fill: "rgba(255,255,255,.94)", stroke: "rgba(0,0,0,.35)", strokeWidth: 1 }));
          const q = s * 0.72 / 512;
          g.add(new Konva.Path({ data: d, fill: "#111", scaleX: q, scaleY: q, x: -s * 0.36, y: -s * 0.36 }));
        }
        if (e.n != null && e.n !== "") {
          const t = new Konva.Text({ text: String(e.n), fontSize: s * 0.55, fontStyle: "bold", fill: "#fff", stroke: "#000", strokeWidth: 0.6, x: s * 0.05, y: s * 0.02 });
          g.add(t);
        }
        n.deco.add(g);
      });
    }

    function aplicarAtributos(n) {
      const o = n.o;
      n.g.setAttrs({ x: o.x, y: o.y, rotation: o.rot || 0, opacity: o.opacidad == null ? 1 : o.opacidad, offsetX: o.ancho / 2, offsetY: o.alto / 2 });
      const gm = o.capa === "gm";
      // La capa de iluminación solo la ve el DJ; con luz dinámica, el jugador no ve las fichas ajenas que quedan a oscuras
      const comoJugador = !st.esGM || st.vistaJugador;
      const deJugador = st.esGM ? (o.controlan_todos || (o.controladores || []).length > 0) : controla(o);
      const aOscuras = st.luzOn && comoJugador && o.capa === "fichas" && !deJugador && pintorLuz && !pintorLuz.visible(o.x, o.y);
      n.g.visible(!(gm && st.vistaJugador) && !(o.capa === "luz" && comoJugador) && !aOscuras);
      n.deco.visible(n.g.visible() && (!st.opc.decoHover || o.tipo === "pin" || !!n.encima || st.seleccion.has(o.id)));
      n.aura.visible(n.g.visible());
      if (gm && !st.vistaJugador && st.capa !== "gm") n.g.opacity((o.opacidad == null ? 1 : o.opacidad) * 0.55);
      n.g.draggable(puedeArrastrar(o));
      n.g.listening(st.herr === "seleccionar" && n.g.visible() && (puedeSeleccionar(o) || (!st.esGM && o.capa === "fichas")));
    }

    function crearNodo(o) {
      const destino = grupos[o.capa] || grupos.fichas;
      const g = new Konva.Group({ id: o.id, name: "obj" });
      const n = { o, g, deco: new Konva.Group({ listening: false }), aura: new Konva.Group({ listening: false }) };
      destino.objetos.add(g); destino.deco.add(n.deco); destino.auras.add(n.aura);
      st.nodos.set(o.id, n);
      g.on("mouseenter", () => { n.encima = true; if (st.opc.decoHover) { aplicarAtributos(n); lObj.batchDraw(); } });
      g.on("mouseleave", () => { n.encima = false; if (st.opc.decoHover) { aplicarAtributos(n); lObj.batchDraw(); } });
      pintarCuerpo(n);
      aplicarAtributos(n);
      enganchar(n);
      return n;
    }

    function ordenarCapa(capa) {
      const g = grupos[capa];
      const nodos = [...st.nodos.values()].filter(n => n.o.capa === capa).sort((a, b) => (a.o.z || 0) - (b.o.z || 0));
      nodos.forEach((n, i) => { n.g.zIndex(i); });
      if (st.opc.arribaMias && !st.esGM) nodos.forEach(n => { if (controla(n.o)) n.g.moveToTop(); });
    }

    const movLocal = new Map();
    function marcarLocal(id) { movLocal.set(id, performance.now()); }
    function upsert(o, remoto) {
      const n = st.nodos.get(o.id);
      if (!n) { crearNodo(o); ordenarCapa(o.capa); lObj.batchDraw(); lMapa.batchDraw(); programarLuz(); if (o.capa === "mapa") programarFondo(); return; }
      if (remoto && performance.now() - (movLocal.get(o.id) || -1e9) < 1500 && (o.x !== n.o.x || o.y !== n.o.y)) o = Object.assign({}, o, { x: n.o.x, y: n.o.y });
      if (n.arrastrando || n.transformando || n.animando) {
        // Mientras se arrastra solo se aceptan los datos, no la posición
        n.o = Object.assign({}, o, { x: n.o.x, y: n.o.y, rot: n.o.rot, ancho: n.o.ancho, alto: n.o.alto });
        return;
      }
      const cambiaCapa = n.o.capa !== o.capa;
      const cambiaCuerpo = n.o.tipo !== o.tipo || n.o.ancho !== o.ancho || n.o.alto !== o.alto || JSON.stringify(n.o.datos) !== JSON.stringify(o.datos);
      n.o = o;
      if (cambiaCapa) {
        const g = grupos[o.capa] || grupos.fichas;
        n.g.moveTo(g.objetos); n.deco.moveTo(g.deco); n.aura.moveTo(g.auras);
        if (st.seleccion.has(o.id) && !puedeSeleccionar(o)) deseleccionar(o.id);
      }
      if (cambiaCuerpo) pintarCuerpo(n); else pintarDeco(n);
      aplicarAtributos(n);
      ordenarCapa(o.capa);
      programarLuz();
      tr.forceUpdate();
      if (st.seleccion.has(o.id)) pintarSeleccionUI();
      lMapa.batchDraw(); lObj.batchDraw(); lUI.batchDraw();
    }

    function quitar(id) {
      const n = st.nodos.get(id);
      if (!n) return;
      st.seleccion.delete(id);
      n.g.destroy(); n.deco.destroy(); n.aura.destroy();
      st.nodos.delete(id);
      if (n.o.capa === "mapa") programarFondo();
      actualizarTransformer();
      programarLuz();
      lMapa.batchDraw(); lObj.batchDraw();
    }

    function ponerObjetos(lista) {
      [...st.nodos.keys()].forEach(quitar);
      lista.forEach(o => crearNodo(o));
      CAPAS.forEach(ordenarCapa);
      programarLuz();
      programarFondo();
      lMapa.batchDraw(); lObj.batchDraw();
    }

    /* ------------------------------------------------------------ selección al estilo Roll20 */
    // Esferas de las tres barras encima (clic: escribir el valor, o +2 / −2 para sumar o restar) y, debajo,
    // la tuerca (ajustes de la ficha) y el botón de estados. Solo con una ficha seleccionada que puedes tocar.
    const selUI = new Konva.Group({ name: "selui" });
    lUI.add(selUI);
    function pintarSeleccionUI() {
      zoomSel = zoom();
      selUI.destroyChildren();
      const ids = [...st.seleccion];
      const n = ids.length === 1 && st.nodos.get(ids[0]);
      if (!n || st.herr !== "seleccionar" || n.o.tipo !== "imagen" || n.o.capa === "luz" || !(st.esGM || controla(n.o))) { lUI.batchDraw(); return; }
      const o = n.o, z = zoom(), k = 1 / z, d = o.datos || {};
      const barras = [0, 1, 2].map(i => Object.assign({ valor: "", max: "" }, (d.barras || [])[i]));
      const nb = (d.barras || []).filter(b => b && parseFloat(b.max) > 0 && (st.esGM || controla(o) || b.ver)).length;
      const hb = altoBarra(o) + sepBarra(o);
      const ocupaArriba = d.barraPos === "debajo" ? 0 : nb * hb;
      const yArriba = o.y - o.alto / 2 - ocupaArriba - 62 * k;
      const boton = (x, y, titulo, cursor) => {
        const g = new Konva.Group({ x, y, scaleX: k, scaleY: k, name: "selui-b" });
        g.on("mouseenter", () => { contenedor.style.cursor = cursor; if (titulo) contenedor.title = titulo; });
        g.on("mouseleave", () => { contenedor.style.cursor = ""; contenedor.title = ""; });
        selUI.add(g);
        return g;
      };
      const disco = (g, anillo) => {
        g.add(new Konva.Circle({ radius: 18, fill: "#fff", shadowColor: "#000", shadowBlur: 6, shadowOffsetY: 1, shadowOpacity: 0.4 }));
        if (anillo) g.add(new Konva.Circle({ radius: 16.5, fill: anillo }));
        g.add(new Konva.Circle({ radius: anillo ? 13 : 16.5, fill: "#222" }));
      };
      barras.forEach((b, i) => {
        // Orden de Roll20: rojo (barra 3) a la izquierda, verde (barra 1) en medio, azul (barra 2) a la derecha
        const lugar = [0, 1, -1][i];
        const g = boton(o.x + lugar * 44 * k, yArriba, "", "text");
        disco(g, COLORES_BURBUJA[i]);
        const txt = b.valor === "" || b.valor == null ? "" : String(b.valor);
        g.add(new Konva.Text({ text: txt, fontSize: txt.length > 3 ? 10 : 13, fontStyle: "bold", fill: "#fff", width: 30, align: "center", x: -15, y: txt.length > 3 ? -5 : -6.5, listening: false }));
        g.on("click tap", ev => { ev.cancelBubble = true; editarBurbuja(n, i, g); });
      });
      // Debajo, abajo a la izquierda: la tuerca y, algo más abajo y hacia el centro, los estados
      // Debajo de la ficha pueden ir su nombre y el contador de salvaciones: los botones van más abajo
      const bajoFicha = (d.verNombre && d.nombre ? 22 : 0) + (d.muerte ? Math.max(3.5, Math.min(7, o.ancho * 0.05)) * 2 + 8 : 0);
      const yAbajo = o.y + o.alto / 2 + (d.barraPos === "debajo" ? nb * hb : 0) + bajoFicha;
      const dx = Math.max(o.ancho * 0.27, 36 * k);
      const tuerca = boton(o.x - dx, yAbajo + 44 * k, "Ajustes de la ficha", "pointer");
      disco(tuerca);
      tuerca.add(new Konva.Path({ data: RUEDA, fill: "#fff", fillRule: "evenodd", listening: false }));
      tuerca.on("click tap", ev => { ev.cancelBubble = true; if (op.onAbrirAjustes) op.onAbrirAjustes(o.id); });
      const est = boton(o.x, yAbajo + 54 * k, "Estados", "pointer");
      disco(est);
      est.add(new Konva.Circle({ radius: 9, stroke: "#fff", strokeWidth: 2, listening: false }));
      est.add(new Konva.Circle({ radius: 4.6, stroke: "#fff", strokeWidth: 2, listening: false }));
      est.add(new Konva.Arc({ innerRadius: 4.6, outerRadius: 9, angle: 80, rotation: -130, fill: "#fff", listening: false }));
      est.on("click tap", ev => { ev.cancelBubble = true; if (op.onEstados) op.onEstados(o.id, ev.evt.clientX, ev.evt.clientY); });
      const m = d.muerte;
      if (m && (m.exitos | 0) < 3 && (m.fallos | 0) < 3 && window.TBMarcas) {
        const sal = boton(o.x + dx, yAbajo + 44 * k, "Tirar la salvación contra la muerte", "pointer");
        disco(sal, "#c0201d");
        const q = 19 / 512;
        sal.add(new Konva.Path({ data: TBMarcas["skull-crossed-bones"], fill: "#fff", scaleX: q, scaleY: q, x: -9.5, y: -9.5, listening: false }));
        sal.on("click tap", ev => { ev.cancelBubble = true; if (op.onSalvacion) op.onSalvacion(o.id); });
      }
      // Punto azul para girar, arriba a la derecha y fuera del marco (solo si el marco tiene tiradores)
      if (tr.nodes().length === 1 && tr.nodes()[0] === n.g) {
        const rad = (o.rot || 0) * Math.PI / 180, lx = o.ancho / 2 + 18 * k, ly = -o.alto / 2 - 20 * k;
        const giro = boton(o.x + lx * Math.cos(rad) - ly * Math.sin(rad), o.y + lx * Math.sin(rad) + ly * Math.cos(rad), "Girar (Mayús: de 15 en 15 grados)", "grab");
        giro.add(new Konva.Circle({ radius: 8, fill: AZUL_SEL }));
        giro.add(new Konva.Circle({ radius: 14, fill: "transparent" }));
        giro.on("mousedown touchstart", ev => { ev.cancelBubble = true; empezarGiro(n, ev); });
      }
      selUI.moveToTop();
      lUI.batchDraw();
    }
    // Girar con el punto azul: el ángulo sigue al ratón alrededor del centro de la ficha
    function empezarGiro(n, ev) {
      const o = n.o, p0 = punteroMundo(), r0 = n.g.rotation();
      const a0 = Math.atan2(p0.y - o.y, p0.x - o.x);
      n.transformando = true;
      contenedor.style.cursor = "grabbing";
      const mover = e => {
        stage.setPointersPositions(e);
        const p = punteroMundo();
        let ang = r0 + (Math.atan2(p.y - o.y, p.x - o.x) - a0) * 180 / Math.PI;
        ang = ((ang % 360) + 360) % 360;
        if (e.shiftKey) ang = Math.round(ang / 15) * 15;
        else { const cerca = Math.round(ang / 45) * 45; if (Math.abs(cerca - ang) < 6) ang = cerca; }
        n.g.rotation(ang % 360);
        selUI.destroyChildren();
        tr.forceUpdate();
        lObj.batchDraw(); lUI.batchDraw();
      };
      const soltar = () => {
        window.removeEventListener("pointermove", mover);
        window.removeEventListener("pointerup", soltar);
        contenedor.style.cursor = "";
        n.transformando = false;
        const rot = Math.round(n.g.rotation() * 100) / 100;
        if (rot !== (o.rot || 0)) { o.rot = rot; programarLuz(); if (op.onCambiar) op.onCambiar(o.id, { rot }); }
        tr.forceUpdate();
        pintarSeleccionUI();
      };
      window.addEventListener("pointermove", mover);
      window.addEventListener("pointerup", soltar);
      if (ev.evt && ev.evt.preventDefault) ev.evt.preventDefault();
    }
    function editarBurbuja(n, i, g) {
      const abs = g.getAbsolutePosition();
      const b = Object.assign({ valor: "" }, ((n.o.datos || {}).barras || [])[i]);
      const inp = document.createElement("input");
      inp.type = "text";
      inp.className = "tb-burbuja-edit";
      inp.value = b.valor === "" || b.valor == null ? "" : String(b.valor);
      inp.title = "Escribe el valor, o +2 / -2 para sumar o restar";
      Object.assign(inp.style, { left: abs.x - 26 + "px", top: abs.y - 15 + "px", borderColor: COLORES_BARRA[i] });
      contenedor.appendChild(inp);
      setTimeout(() => { inp.focus({ preventScroll: true }); inp.select(); contenedor.scrollLeft = 0; contenedor.scrollTop = 0; }, 0);
      let hecho = false;
      const fin = guardar => {
        if (hecho) return;
        hecho = true;
        const v = inp.value.trim().replace(",", ".");
        inp.remove();
        contenedor.scrollLeft = 0; contenedor.scrollTop = 0;
        if (!guardar || v === "" || v === String(b.valor)) return;
        const rel = v.match(/^([+-])\s*(\d+(?:\.\d+)?)$/);
        let nuevo;
        if (rel) nuevo = (Number(b.valor) || 0) + (rel[1] === "-" ? -1 : 1) * parseFloat(rel[2]);
        else if (/^\d+(?:\.\d+)?$/.test(v)) nuevo = parseFloat(v);
        else return;
        nuevo = Math.round(nuevo * 100) / 100;
        if (op.onBarra) op.onBarra(n.o.id, i, nuevo);
      };
      inp.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") fin(true); if (e.key === "Escape") fin(false); });
      inp.addEventListener("blur", () => fin(true));
    }

    /* ------------------------------------------------------------ selección */
    function actualizarTransformer() {
      const nodos = [...st.seleccion].map(id => st.nodos.get(id)).filter(Boolean);
      const transformables = st.esGM && st.herr === "seleccionar" && nodos.length && nodos.every(n => !n.o.bloqueado);
      tr.nodes(transformables ? nodos.map(n => n.g) : []);
      // Sin transformador (jugador o bloqueado), un marco simple
      vistaPrevia.find(".sel").forEach(x => x.destroy());
      if (!transformables) nodos.forEach(n => {
        const r = n.g.getClientRect({ relativeTo: stage });
        vistaPrevia.add(new Konva.Rect({ name: "sel", x: r.x - 2, y: r.y - 2, width: r.width + 4, height: r.height + 4, stroke: AZUL_SEL, strokeWidth: 1.5 / zoom() }));
      });
      lUI.batchDraw();
      pintarSeleccionUI();
      if (op.onSeleccion) op.onSeleccion([...st.seleccion]);
    }
    // Los objetos agrupados se seleccionan juntos
    function conGrupo(ids) {
      const grupos = new Set(ids.map(id => { const n = st.nodos.get(id); return n && n.o.datos && n.o.datos.grupo; }).filter(Boolean));
      if (!grupos.size) return ids;
      return [...new Set(ids.concat([...st.nodos.values()].filter(n => grupos.has(n.o.datos && n.o.datos.grupo)).map(n => n.o.id)))];
    }
    function seleccionar(ids, sumar) {
      if (!sumar) st.seleccion.clear();
      conGrupo(ids).forEach(id => { const n = st.nodos.get(id); if (n && puedeSeleccionar(n.o)) st.seleccion.add(id); });
      if (st.opc.decoHover) st.nodos.forEach(aplicarAtributos);
      actualizarTransformer();
    }
    function deseleccionar(id) { if (id) st.seleccion.delete(id); else st.seleccion.clear(); if (st.opc.decoHover) st.nodos.forEach(aplicarAtributos); actualizarTransformer(); }

    /* ------------------------------------------------------------ ajuste a la cuadrícula */
    function ajustarPos(o, x, y, sinAjuste) {
      const c = st.escena && st.escena.cuadricula;
      if (sinAjuste || !c || c.ajustar === false || (o.datos && o.datos.sinAjuste) || o.tipo === "pin" || (o.capa === "mapa" && o.tipo !== "imagen")) return { x, y };
      const t = tam(), d0 = desp();
      // Con el ajuste preciso, lo que mide menos de una casilla encaja también en medias casillas (esquinas y centros)
      const pasoX = c.preciso !== false && o.ancho < t ? t / 2 : t, pasoY = c.preciso !== false && o.alto < t ? t / 2 : t;
      const izq = Math.round((x - o.ancho / 2 - d0.x) / pasoX) * pasoX + d0.x;
      const arr = Math.round((y - o.alto / 2 - d0.y) / pasoY) * pasoY + d0.y;
      return { x: izq + o.ancho / 2, y: arr + o.alto / 2 };
    }
    function ajustarTam(v, sinAjuste) {
      const c = st.escena && st.escena.cuadricula;
      if (sinAjuste || !c || c.ajustar === false) return v;
      const t = tam();
      return Math.max(t / 2, Math.round(v / (t / 2)) * (t / 2));
    }

    /* ------------------------------------------------------------ arrastrar */
    function moverFantasma() {
      const a = st.arrastre;
      if (!a) return;
      const lider = st.nodos.get(a.lider), p = { x: a.fantasma.x(), y: a.fantasma.y() };
      if (lider && st.opc.moverMide !== false && lider.o.capa !== "mapa") {
        const ruta = a.ruta.concat([p]);
        if (!a.fija || a.fijaN !== a.ruta.length || a.fijaZ !== zoom() || !a.fija.getParent()) {
          guiaMedida.destroyChildren();
          a.fija = new Konva.Group({ listening: false }); a.viva = new Konva.Group({ listening: false });
          guiaMedida.add(a.fija, a.viva);
          a.acumFijo = a.ruta.length > 1 ? dibujarRuta(a.fija, a.ruta, "#d6127e", false, { soloParadas: true }) : 0;
          a.fijaN = a.ruta.length; a.fijaZ = zoom();
        }
        a.viva.destroyChildren();
        dibujarRuta(a.viva, [a.ruta[a.ruta.length - 1], p], "#d6127e", false, { acum: a.acumFijo });
        if (st.opc.transmitir !== false && op.onRegla && lider.o.capa !== "gm") op.onRegla({ forma: "ruta", puntos: ruta, mov: true });
      }
      lUI.batchDraw();
    }
    function soltarFantasma(e) {
      const a = st.arrastre;
      if (!a) return;
      const sinAjuste = e && e.evt && e.evt.altKey;
      const lider = st.nodos.get(a.lider), liderIni = a.inicio.get(a.lider);
      const muros = !st.esGM && bloqueaMovimiento() ? TBLuz.segmentosDe([...st.nodos.values()].map(x => x.o)).paso : null;
      const pl = lider ? ajustarPos(lider.o, a.fantasma.x(), a.fantasma.y(), sinAjuste) : { x: a.fantasma.x(), y: a.fantasma.y() };
      let chocan = false;
      const movidos = [];
      a.inicio.forEach((ini, id) => {
        const m = st.nodos.get(id);
        if (!m) return;
        const off = { x: ini.x - liderIni.x, y: ini.y - liderIni.y };
        let p = id === a.lider ? pl : ajustarPos(m.o, pl.x + off.x, pl.y + off.y, sinAjuste);
        let camino = a.ruta.map(q => ({ x: q.x + off.x, y: q.y + off.y })).concat([p]);
        if (muros && camino.some((q, k) => k > 0 && TBLuz.cruza(camino[k - 1], q, muros))) { p = { x: ini.x, y: ini.y }; camino = [p]; chocan = true; }
        m.arrastrando = false;
        m.g.opacity(m.o.opacidad == null ? 1 : m.o.opacidad);
        m.o.x = p.x; m.o.y = p.y;
        m.g.position(p); m.deco.position(p); m.aura.position(p);
        if (Math.hypot(p.x - ini.x, p.y - ini.y) > 0.5) { m.ultimaRuta = [{ x: ini.x, y: ini.y }].concat(camino); movidos.push({ o: m.o, ruta: camino }); }
      });
      a.fantasma.destroy();
      st.arrastre = null;
      if (chocan && op.onAviso) op.onAviso("Hay un muro en medio: la ficha vuelve a su sitio.");
      guiaMedida.destroyChildren();
      if (op.onRegla) op.onRegla(null);
      actualizarTransformer();
      programarLuz();
      lObj.batchDraw(); lMapa.batchDraw(); lUI.batchDraw();
      movidos.forEach(({ o, ruta }) => {
        if (op.onMovEnCurso && o.capa !== "gm") op.onMovEnCurso(o.id, o.x, o.y, ruta);
        if (op.onMovido) op.onMovido(o, ruta);
      });
    }
    // En las pantallas de los demás la ficha recorre la ruta (con sus paradas) en el mismo tiempo sea cual sea la distancia,
    // como en Roll20; el tablero solo se anima mientras tanto
    const DUR_RUTA = 1.5;
    function animarRuta(m, puntos) {
      if (m.anim) { m.anim.stop(); m.anim = null; }
      const tramos = [];
      let total = 0;
      for (let i = 1; i < puntos.length; i++) { const d = Math.hypot(puntos[i].x - puntos[i - 1].x, puntos[i].y - puntos[i - 1].y); tramos.push(d); total += d; }
      const fin = puntos[puntos.length - 1];
      const poner = p => { m.g.position(p); m.deco.position(p); m.aura.position(p); };
      if (total < 0.5) { poner(fin); return; }
      const dur = DUR_RUTA;
      const t0 = performance.now();
      let ultimaLuz = 0;
      m.animando = true;
      // Los botones de la selección vuelven cuando la ficha llega
      if (st.seleccion.has(m.o.id)) selUI.destroyChildren();
      const anim = new Konva.Animation(fr => {
        const f = Math.min(1, (performance.now() - t0) / 1000 / dur);
        let dist = f * total, i = 0;
        while (i < tramos.length - 1 && dist > tramos[i]) { dist -= tramos[i]; i++; }
        const a = puntos[i], b = puntos[i + 1], k = tramos[i] ? Math.min(1, dist / tramos[i]) : 1;
        poner({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
        if (st.seleccion.has(m.o.id)) tr.forceUpdate();
        if (st.luzOn && fr && fr.time - ultimaLuz > 90) { ultimaLuz = fr.time; programarLuz(); }
        if (f >= 1) {
          anim.stop(); m.anim = null; m.animando = false;
          poner(fin);
          programarLuz();
          if (st.seleccion.has(m.o.id)) { tr.forceUpdate(); pintarSeleccionUI(); }
        }
      }, [lObj, lMapa, lUI]);
      m.anim = anim;
      anim.start();
    }
    let ultimoMov = 0;
    function enganchar(n) {
      n.g.on("mousedown touchstart", e => {
        if (st.herr !== "seleccionar" || e.evt.button === 1 || st.espacio) return;
        if (e.evt.button === 2) return;
        const id = n.o.id;
        if (!puedeSeleccionar(n.o)) return;
        n.pulsado = punteroMundo();
        if (e.evt.shiftKey) { if (st.seleccion.has(id)) deseleccionar(id); else seleccionar([id], true); }
        else if (!st.seleccion.has(id)) seleccionar([id]);
        e.cancelBubble = true;
      });
      n.g.on("dragstart", () => {
        if (!st.seleccion.has(n.o.id)) seleccionar([n.o.id]);
        // Se arrastra una copia en la capa de interfaz: el tablero (mapa, fichas, luz) no se redibuja hasta soltar
        n.g.stopDrag();
        const lider = n.o, ids = [...st.seleccion].filter(id => st.nodos.get(id));
        // Lo que ya se movió el ratón antes de empezar el arrastre también cuenta
        const ahora = punteroMundo(), d0 = n.pulsado ? { x: ahora.x - n.pulsado.x, y: ahora.y - n.pulsado.y } : { x: 0, y: 0 };
        const fantasma = new Konva.Group({ x: lider.x + d0.x, y: lider.y + d0.y, draggable: true, name: "fantasma" });
        ids.forEach(id => {
          const m = st.nodos.get(id);
          fantasma.add(m.g.clone({ x: m.o.x - lider.x, y: m.o.y - lider.y, draggable: false, listening: false, opacity: 0.9 * (m.o.opacidad == null ? 1 : m.o.opacidad) }));
        });
        lUI.add(fantasma);
        st.arrastre = { lider: lider.id, fantasma, ruta: [{ x: lider.x, y: lider.y }], inicio: new Map(ids.map(id => { const m = st.nodos.get(id); return [id, { x: m.o.x, y: m.o.y }]; })) };
        ids.forEach(id => { const m = st.nodos.get(id); m.arrastrando = true; m.g.opacity(0.35 * (m.o.opacidad == null ? 1 : m.o.opacidad)); });
        tr.nodes([]); selUI.destroyChildren(); vistaPrevia.find(".sel").forEach(x => x.destroy());
        lObj.batchDraw(); lMapa.batchDraw();
        cancelarPulsacion();
        fantasma.on("dragmove", moverFantasma);
        fantasma.on("dragend", soltarFantasma);
        fantasma.startDrag();
      });
      n.g.on("transformstart", () => { st.seleccion.forEach(id => { const m = st.nodos.get(id); if (m) m.transformando = true; }); });
      n.g.on("transform", () => {
        const m = n;
        m.deco.position(m.g.position()); m.aura.position(m.g.position());
        selUI.destroyChildren();
      });
      n.g.on("transformend", e => {
        const sinAjuste = e.evt && e.evt.altKey;
        const m = n, o = m.o;
        const sx = Math.abs(m.g.scaleX()), sy = Math.abs(m.g.scaleY());
        let ancho = o.ancho * sx, alto = o.alto * sy;
        const cambios = { rot: Math.round(m.g.rotation() * 100) / 100 };
        const d = Object.assign({}, o.datos);
        if (o.tipo === "texto") {
          d.tam = Math.max(6, Math.round((d.tam || 26) * sy));
          cambios.datos = d;
        } else {
          if (o.tipo === "dibujo" && d.puntos) { d.puntos = d.puntos.map((v, i) => (i % 2 ? v * sy : v * sx)); cambios.datos = d; }
          if (o.tipo === "imagen") { ancho = ajustarTam(ancho, sinAjuste); alto = ajustarTam(alto, sinAjuste); }
          cambios.ancho = Math.round(ancho * 100) / 100; cambios.alto = Math.round(alto * 100) / 100;
        }
        m.g.scale({ x: 1, y: 1 });
        Object.assign(o, cambios);
        const p = ajustarPos(o, m.g.x(), m.g.y(), sinAjuste);
        o.x = cambios.x = p.x; o.y = cambios.y = p.y;
        m.transformando = false;
        pintarCuerpo(m); aplicarAtributos(m);
        programarLuz();
        tr.forceUpdate();
        if (op.onCambiar) op.onCambiar(o.id, cambios);
      });
      n.g.on("dblclick dbltap", () => {
        if (st.herr !== "seleccionar") return;
        if (n.o.capa === "luz" && st.esGM) {
          const d = n.o.datos || {};
          if (n.o.tipo === "dibujo" && d.muro === "puerta" && op.onCambiar) { op.onCambiar(n.o.id, { datos: Object.assign({}, d, { abierta: !d.abierta }) }); return; }
          if (n.o.tipo === "luz" && op.onAjustesLuz) { op.onAjustesLuz(n.o.id); return; }
          return;
        }
        if (n.o.tipo === "texto" && (st.esGM || n.o.autor === st.uid)) { editarTexto(n); return; }
        if (op.onAbrirAjustes && (st.esGM || controla(n.o))) op.onAbrirAjustes(n.o.id);
      });
      n.g.on("click tap", e => { if (n.o.tipo === "pin" && e.evt.button !== 2 && op.onPin) op.onPin(n.o.id); });
    }

    /* ------------------------------------------------------------ medida */
    function ajustarPunto(p) {
      const modo = st.opc.ajusteMedida || "centro", t = tam();
      if (modo === "centro") return { x: Math.floor(p.x / t) * t + t / 2, y: Math.floor(p.y / t) * t + t / 2 };
      if (modo === "esquina") return { x: Math.round(p.x / t) * t, y: Math.round(p.y / t) * t };
      return p;
    }
    function textoCeldas(celdas) {
      const c = cuad(), v = Math.round(celdas * pies() * 10) / 10;
      return v + " " + (c.unidad || "pies");
    }
    // Ruta con puntos de paso: se suma tramo a tramo (cada tramo con la regla de diagonales de la página)
    // opc.soloParadas: todos los puntos son paradas y no hay caja final (los tramos fijos de un arrastre);
    // opc.acum: celdas ya recorridas antes del primer punto. Devuelve las celdas acumuladas.
    function dibujarRuta(grupo, puntos, color, limpiar, opc) {
      opc = opc || {};
      if (limpiar) grupo.destroyChildren();
      const z = zoom(), k = 1 / z;
      const pl = [];
      puntos.forEach(p => pl.push(p.x, p.y));
      grupo.add(new Konva.Line({ points: pl, stroke: color, strokeWidth: 4 * k, lineJoin: "round", lineCap: "round", listening: false, perfectDrawEnabled: false }));
      const piesDe = celdas => Math.round(celdas * pies() * 10) / 10;
      let acum = opc.acum || 0;
      puntos.forEach((p, i) => {
        if (i > 0) acum += celdasEntre(puntos[i - 1], p);
        grupo.add(new Konva.Circle({ x: p.x, y: p.y, radius: 5 * k, fill: color, listening: false, perfectDrawEnabled: false }));
        if (i > 0 && (opc.soloParadas || i < puntos.length - 1)) {
          const g = new Konva.Group({ x: p.x, y: p.y - 24 * k, scaleX: k, scaleY: k, listening: false });
          g.add(new Konva.Circle({ radius: 18.5, fill: "rgba(0,0,0,.25)" }));
          g.add(new Konva.Circle({ radius: 17, fill: "#6e6e6e", stroke: color, strokeWidth: 2 }));
          g.add(new Konva.Text({ text: String(piesDe(acum)), fontSize: 14, fontStyle: "bold", fill: "#fff", width: 40, align: "center", x: -20, y: -7 }));
          grupo.add(g);
        }
      });
      if (opc.soloParadas) return acum;
      const b = puntos[puntos.length - 1];
      const t1 = new Konva.Text({ text: piesDe(acum) + " " + (cuad().unidad || "pies"), fontSize: 17, fontStyle: "bold", fill: "#fff" });
      const t2 = new Konva.Text({ text: (Math.round(acum * 10) / 10) + " cuad.", fontSize: 11, fontStyle: "bold", fill: "#fff" });
      const w = Math.max(t1.width(), t2.width()) + 16, h = 40;
      const caja = new Konva.Group({ x: b.x, y: b.y - 34 * k, scaleX: k, scaleY: k });
      caja.add(new Konva.Rect({ x: -w / 2, y: -h / 2, width: w, height: h, fill: "rgba(24,24,24,.88)", stroke: color, strokeWidth: 1.5, cornerRadius: 4 }));
      t1.setAttrs({ x: -t1.width() / 2, y: -16 }); t2.setAttrs({ x: -t2.width() / 2, y: 4 });
      caja.add(t1, t2);
      grupo.add(caja);
      return acum;
    }
    function celdasEntre(a, b) {
      const t = tam(), c = cuad(), libre = (st.opc.ajusteMedida || "centro") === "ninguno";
      let dx = Math.abs(b.x - a.x) / t, dy = Math.abs(b.y - a.y) / t;
      if (!libre) { dx = Math.round(dx); dy = Math.round(dy); }
      const diag = c.diagonal || "5e";
      if (diag === "euclidea") return Math.hypot(dx, dy);
      if (diag === "manhattan") return dx + dy;
      if (diag === "pathfinder") return Math.max(dx, dy) + Math.floor(Math.min(dx, dy) / 2);
      return Math.max(dx, dy);
    }
    function textoDistancia(a, b) {
      const t = tam(), c = cuad(), libre = (st.opc.ajusteMedida || "centro") === "ninguno";
      let dx = Math.abs(b.x - a.x) / t, dy = Math.abs(b.y - a.y) / t;
      if (!libre) { dx = Math.round(dx); dy = Math.round(dy); }
      let celdas;
      const diag = c.diagonal || "5e";
      if (diag === "euclidea") celdas = Math.hypot(dx, dy);
      else if (diag === "manhattan") celdas = dx + dy;
      else if (diag === "pathfinder") celdas = Math.max(dx, dy) + Math.floor(Math.min(dx, dy) / 2);   // 1-2-1
      else celdas = Math.max(dx, dy);                                                                      // D&D 5e: cada diagonal, una casilla
      const v = Math.round(celdas * pies() * 10) / 10;
      return v + " " + (c.unidad || "pies");
    }
    // extra: { conoGrados, conoForma ("plano" | "redondeado"), hazPies, origen ("centro" | "borde" | "esquina") }
    function dibujarMedida(grupo, forma, a, b, color, limpiar, extra) {
      if (limpiar) grupo.destroyChildren();
      const x = Object.assign({ conoGrados: 53, conoForma: "plano", hazPies: 5, origen: "centro" }, st.opc.medidaExtra, extra);
      const z = zoom(), t = tam();
      const lw = 3 / z;
      const comun = { stroke: color, strokeWidth: lw, fill: color + "33" };
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 0.0001;
      if (forma === "circulo") {
        if (x.origen === "borde") grupo.add(new Konva.Circle(Object.assign({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, radius: L / 2 }, comun)));
        else grupo.add(new Konva.Circle(Object.assign({ x: a.x, y: a.y, radius: L }, comun)));
      } else if (forma === "cuadrado") {
        const ax = Math.abs(dx), ay = Math.abs(dy), sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
        if (x.origen === "esquina") { const s = Math.max(ax, ay); grupo.add(new Konva.Rect(Object.assign({ x: sx > 0 ? a.x : a.x - s, y: sy > 0 ? a.y : a.y - s, width: s, height: s }, comun))); }
        else if (x.origen === "borde") {
          // El origen queda en el centro de un lado y el cuadrado crece hacia donde apuntas
          const s = Math.max(ax, ay);
          if (ax >= ay) grupo.add(new Konva.Rect(Object.assign({ x: sx > 0 ? a.x : a.x - s, y: a.y - s / 2, width: s, height: s }, comun)));
          else grupo.add(new Konva.Rect(Object.assign({ x: a.x - s / 2, y: sy > 0 ? a.y : a.y - s, width: s, height: s }, comun)));
        } else { const r = Math.max(ax, ay); grupo.add(new Konva.Rect(Object.assign({ x: a.x - r, y: a.y - r, width: r * 2, height: r * 2 }, comun))); }
      } else if (forma === "cono") {
        const ang = Math.atan2(dy, dx), mitad = Math.max(1, Math.min(179, Number(x.conoGrados) || 53)) * Math.PI / 360;
        if (x.conoForma === "redondeado") grupo.add(new Konva.Wedge(Object.assign({ x: a.x, y: a.y, radius: L, angle: mitad * 360 / Math.PI, rotation: (ang - mitad) * 180 / Math.PI }, comun)));
        else {
          const ux = dx / L, uy = dy / L, px = -uy, py = ux, ancho = L * Math.tan(mitad);
          grupo.add(new Konva.Line(Object.assign({ points: [a.x, a.y, b.x + px * ancho, b.y + py * ancho, b.x - px * ancho, b.y - py * ancho], closed: true }, comun)));
        }
      } else if (forma === "haz") {
        const ancho = (Number(x.hazPies) || 5) / pies() * t;
        const ux = dx / L, uy = dy / L, px = -uy * ancho / 2, py = ux * ancho / 2;
        grupo.add(new Konva.Line(Object.assign({ points: [a.x + px, a.y + py, b.x + px, b.y + py, b.x - px, b.y - py, a.x - px, a.y - py], closed: true }, comun)));
      } else {
        grupo.add(new Konva.Line({ points: [a.x, a.y, b.x, b.y], stroke: color, strokeWidth: lw, dash: [10 / z, 6 / z] }));
        grupo.add(new Konva.Circle({ x: a.x, y: a.y, radius: 5 / z, fill: color }));
      }
      const etq = new Konva.Label({ x: b.x + 10 / z, y: b.y - 28 / z, scaleX: 1 / z, scaleY: 1 / z });
      etq.add(new Konva.Tag({ fill: color, cornerRadius: 4 }));
      etq.add(new Konva.Text({ text: textoDistancia(a, b), fontSize: 15, fontStyle: "bold", fill: "#fff", padding: 5 }));
      grupo.add(etq);
    }
    const reglasRemotas = new Map();
    const cursores = new Map();
    function reglaRemota(d) {
      if (!d || !d.de) return;
      const vieja = reglasRemotas.get(d.de);
      if (vieja) { vieja.g.destroy(); clearTimeout(vieja.t); }
      if (!d.a && !(d.puntos && d.puntos.length)) { reglasRemotas.delete(d.de); lUI.batchDraw(); return; }
      const g = new Konva.Group({ listening: false });
      guiasRemotas.add(g);
      if (d.forma === "ruta" && d.puntos) dibujarRuta(g, d.puntos, d.color || "#2a7de1", false);
      else dibujarMedida(g, d.forma || "linea", d.a, d.b, d.color || "#2a7de1", false, d.extra);
      reglasRemotas.set(d.de, { g, t: setTimeout(() => { g.destroy(); reglasRemotas.delete(d.de); lUI.batchDraw(); }, d.persistente ? 600000 : 8000) });
      lUI.batchDraw();
    }

    /* ------------------------------------------------------------ pings */
    function ping(x, y, color) {
      const z = zoom();
      for (let i = 0; i < 3; i++) {
        const c = new Konva.Circle({ x, y, radius: 6 / z, stroke: color || "#d6127e", strokeWidth: 4 / z, opacity: 1 });
        pings.add(c);
        setTimeout(() => {
          new Konva.Tween({ node: c, radius: 70 / z, opacity: 0, duration: 1.1, easing: Konva.Easings.EaseOut, onFinish: () => c.destroy() }).play();
        }, i * 260);
      }
      lUI.batchDraw();
    }
    let pulsacion = null;
    function cancelarPulsacion() { if (pulsacion) { clearTimeout(pulsacion.t); pulsacion = null; } }

    /* ------------------------------------------------------------ texto */
    function editarTexto(n, enMundo) {
      const d = n ? Object.assign({}, n.o.datos) : Object.assign({}, st.opc.texto || {});
      const pos = n ? { x: n.o.x - n.o.ancho / 2, y: n.o.y - n.o.alto / 2 } : enMundo;
      const z = zoom(), abs = stage.getAbsoluteTransform().point(pos);
      const ta = document.createElement("textarea");
      ta.className = "tb-editor-texto";
      ta.value = d.texto || "";
      Object.assign(ta.style, {
        left: abs.x + "px", top: abs.y + "px", fontSize: (d.tam || 26) * z + "px", fontFamily: d.fuente || "Arial", color: d.color || "#000",
        fontWeight: d.negrita ? "700" : "400", fontStyle: d.cursiva ? "italic" : "normal", width: Math.max(160, (n ? n.o.ancho : 200) * z + 20) + "px"
      });
      contenedor.appendChild(ta);
      if (n) n.g.visible(false), lObj.batchDraw();
      const ajustarAlto = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; };
      ajustarAlto();
      ta.addEventListener("input", ajustarAlto);
      setTimeout(() => ta.focus(), 0);
      let hecho = false;
      const terminar = guardar => {
        if (hecho) return; hecho = true;
        const texto = ta.value.replace(/\s+$/, "");
        ta.remove();
        if (n) { n.g.visible(true); lObj.batchDraw(); }
        if (!guardar) return;
        const medida = new Konva.Text({ text: texto, fontSize: d.tam || 26, fontFamily: d.fuente || "Arial", padding: 3, lineHeight: 1.15,
          fontStyle: [d.cursiva ? "italic" : "", d.negrita ? "bold" : ""].join(" ").trim() || "normal" });
        const ancho = Math.max(10, medida.width()), alto = Math.max(10, medida.height());
        if (n) {
          if (!texto) { if (op.onBorrar) op.onBorrar([n.o.id]); return; }
          d.texto = texto;
          if (op.onCambiar) op.onCambiar(n.o.id, { datos: d, ancho, alto, x: pos.x + ancho / 2, y: pos.y + alto / 2 });
        } else if (texto && op.onCrear) {
          op.onCrear([{ tipo: "texto", capa: st.esGM ? st.capa : "fichas", x: pos.x + ancho / 2, y: pos.y + alto / 2, ancho, alto, datos: Object.assign(d, { texto }) }]);
        }
      };
      ta.addEventListener("keydown", e => {
        if (e.key === "Escape") { e.preventDefault(); terminar(false); }
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); terminar(true); }
        e.stopPropagation();
      });
      ta.addEventListener("blur", () => terminar(true));
    }

    /* ------------------------------------------------------------ eventos del escenario */
    let gesto = null;   // { tipo, inicio, ... }
    contenedor.addEventListener("contextmenu", e => e.preventDefault());
    stage.on("wheel", e => {
      e.evt.preventDefault();
      // Con la rueda en modo «mover», la rueda desplaza la vista y Ctrl + rueda hace zoom
      if (st.opc.ruedaZoom === false && !e.evt.ctrlKey) {
        stage.position({ x: stage.x() - (e.evt.shiftKey ? e.evt.deltaY : e.evt.deltaX), y: stage.y() - (e.evt.shiftKey ? 0 : e.evt.deltaY) });
        redibujarVista();
        return;
      }
      const factor = e.evt.deltaY > 0 ? 1 / 1.1 : 1.1;
      ponerZoom(zoom() * factor, stage.getPointerPosition());
      if (gesto && (gesto.tipo === "camara" || gesto.tipo === "derecho")) { gesto.pos = stage.position(); gesto.x = e.evt.clientX; gesto.y = e.evt.clientY; }
    });

    function polilineaPuntos(pts) {
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (let i = 0; i < pts.length; i += 2) { x1 = Math.min(x1, pts[i]); y1 = Math.min(y1, pts[i + 1]); x2 = Math.max(x2, pts[i]); y2 = Math.max(y2, pts[i + 1]); }
      const ancho = Math.max(1, x2 - x1), alto = Math.max(1, y2 - y1);
      return { x: x1 + ancho / 2, y: y1 + alto / 2, ancho, alto, puntos: pts.map((v, i) => Math.round((i % 2 ? v - y1 : v - x1) * 10) / 10) };
    }
    function estiloDibujo() {
      const d = st.opc.dibujo || {};
      const grosores = { fino: 2, pequeno: 3, mediano: 5, grande: 9, extragrande: 15, grueso: 9, enorme: 15 };
      return { trazo: d.trazo || "#d6127e", relleno: d.relleno || "transparent", grosor: grosores[d.grosor] || 4 };
    }
    function crearDibujo(forma, datosForma) {
      const est = estiloDibujo();
      if (op.onCrear) op.onCrear([Object.assign({ tipo: "dibujo", capa: st.esGM ? st.capa : "fichas" }, datosForma, { datos: Object.assign({ forma }, est, datosForma.datos || {}) })]);
    }

    // Lo seleccionado se puede coger desde cualquier punto de su recuadro, no solo por el trazo (como en Roll20)
    function seleccionadoBajo(p) {
      const m = 3 / zoom();
      for (const id of st.seleccion) {
        const n = st.nodos.get(id);
        if (!n || !n.g.visible()) continue;
        const r = n.g.getClientRect({ relativeTo: stage });
        if (p.x >= r.x - m && p.x <= r.x + r.width + m && p.y >= r.y - m && p.y <= r.y + r.height + m) return n;
      }
      return null;
    }
    stage.on("mousedown touchstart", e => {
      const boton = e.evt.button;
      contenedor.focus({ preventScroll: true });
      const p = punteroMundo();
      cerrarMenus();
      // Cámara: mano, botón central o espacio
      if (boton === 1 || st.herr === "mano" || st.espacio) {
        e.evt.preventDefault();
        gesto = { tipo: "camara", x: e.evt.clientX, y: e.evt.clientY, pos: stage.position() };
        contenedor.classList.add("arrastrando-camara");
        return;
      }
      if (boton === 2 && (st.arrastre || (gesto && gesto.tipo === "medida"))) { puntoDeRuta(); return; }
      if (boton === 2) {
        const tgt = e.target.findAncestor && e.target.findAncestor(".obj", true), dentro = !tgt && seleccionadoBajo(p);
        gesto = { tipo: "derecho", x: e.evt.clientX, y: e.evt.clientY, pos: stage.position(), id: tgt ? tgt.id() : dentro ? dentro.o.id : null, mundo: p };
        return;
      }
      // Las asas del transformador (esquinas y giro) no son «vacío»: si no, la selección se perdía al pulsarlas
      if (e.target.getParent && e.target.getParent() === tr) return;
      if (e.target.findAncestor && e.target.findAncestor(".selui-b", true)) return;
      const vacio = e.target === stage || !e.target.findAncestor || !e.target.findAncestor(".obj", true);
      if (st.herr === "seleccionar" && vacio && !e.evt.shiftKey) {
        const dentro = seleccionadoBajo(p);
        if (dentro) {
          // pulsar dentro del recuadro coge lo seleccionado (y lo arrastra si se puede)
          if (puedeArrastrar(dentro.o)) { dentro.pulsado = p; dentro.g.startDrag(); }
          return;
        }
      }
      if (st.herr === "seleccionar") {
        const sp = stage.getPointerPosition();
        pulsacion = { sp, t: setTimeout(() => { pulsacion = null; gesto = null; marco.visible(false); hacerPing(p, e.evt.shiftKey); }, 650) };
        if (vacio) {
          if (!e.evt.shiftKey) deseleccionar();
          gesto = { tipo: "marco", inicio: p };
        }
        return;
      }
      if (st.herr === "ping") { hacerPing(p, e.evt.shiftKey); return; }
      if (st.herr === "texto") {
        const tgt = e.target.findAncestor && e.target.findAncestor(".obj", true);
        const n = tgt && st.nodos.get(tgt.id());
        if (n && n.o.tipo === "texto" && (st.esGM || n.o.autor === st.uid)) editarTexto(n);
        else editarTexto(null, p);
        return;
      }
      if (st.herr === "medida") { gesto = { tipo: "medida", inicio: ajustarPunto(p) }; return; }
      if (st.herr === "fx") {
        const a = centroFx(p);
        gesto = { tipo: "fx", inicio: a };
        if ((st.opc.fxPrevia || {}).modo === "mantener") { gesto.mantener = true; quitarGuiaFx(); if (op.onFxMantener) op.onFxMantener(a); }
        return;
      }
      if (st.herr === "niebla") {
        if ((st.opc.niebla || {}).forma === "poligono") {
          gesto = gesto && gesto.tipo === "nieblaPoli" ? gesto : { tipo: "nieblaPoli", puntos: [] };
          gesto.puntos.push(p.x, p.y);
          previaPoligono(gesto.puntos, p, (st.opc.niebla || {}).modo === "ocultar" ? "#222" : "#2a9d8f");
        } else gesto = { tipo: "niebla", inicio: p };
        return;
      }
      if (st.herr === "dibujo") {
        const modo = (st.opc.dibujo || {}).modo || "mano";
        if (modo === "linea") {
          gesto = gesto && gesto.tipo === "pluma" ? gesto : { tipo: "pluma", puntos: [p.x, p.y], inicio: p };
          if (gesto.puntos.length > 2) gesto.puntos.push(p.x, p.y);
          gesto.bajado = p;
          return;
        }
        gesto = { tipo: "dibujo", modo, inicio: p, puntos: [p.x, p.y] };
      }
    });

    stage.on("mousemove touchmove", e => {
      const p = punteroMundo();
      if (pulsacion) {
        const sp = stage.getPointerPosition();
        if (Math.hypot(sp.x - pulsacion.sp.x, sp.y - pulsacion.sp.y) > 5) cancelarPulsacion();
      }
      if (st.cursorB && op.onCursor) op.onCursor(p.x, p.y);
      if (!gesto) return;
      if (gesto.tipo === "derecho" && Math.hypot(e.evt.clientX - gesto.x, e.evt.clientY - gesto.y) > 5) {
        gesto = { tipo: "camara", x: gesto.x, y: gesto.y, pos: gesto.pos };
        contenedor.classList.add("arrastrando-camara");
      }
      if (gesto.tipo === "camara") {
        stage.position({ x: gesto.pos.x + e.evt.clientX - gesto.x, y: gesto.pos.y + e.evt.clientY - gesto.y });
        redibujarVista();
        return;
      }
      if (gesto.tipo === "marco") {
        const a = gesto.inicio;
        if (Math.hypot(p.x - a.x, p.y - a.y) * zoom() < 4 && !marco.visible()) return;
        marco.setAttrs({ visible: true, x: Math.min(a.x, p.x), y: Math.min(a.y, p.y), width: Math.abs(p.x - a.x), height: Math.abs(p.y - a.y), strokeWidth: 1 / zoom() });
        lUI.batchDraw();
        return;
      }
      if (gesto.tipo === "medida") {
        const b = ajustarPunto(p);
        gesto.fin = b;
        if (gesto.ruta) {
          const ruta = gesto.ruta.concat([b]);
          dibujarRuta(guiaMedida, ruta, "#d6127e", true);
          if (st.opc.transmitir !== false && op.onRegla) op.onRegla({ forma: "ruta", puntos: ruta, persistente: !!st.opc.persistente });
          lUI.batchDraw();
          return;
        }
        dibujarMedida(guiaMedida, st.opc.formaMedida || "linea", gesto.inicio, b, "#d6127e", true);
        if (st.opc.transmitir !== false && op.onRegla) op.onRegla({ forma: st.opc.formaMedida || "linea", a: gesto.inicio, b, persistente: !!st.opc.persistente, extra: st.opc.medidaExtra });
        lUI.batchDraw();
        return;
      }
      if (gesto.tipo === "fx") {
        // Mantener: el efecto sigue al ratón mientras el botón está pulsado
        if (gesto.mantener) { if (op.onFxMover) op.onFxMover(p); return; }
        const fin = (st.opc.fxPrevia || {}).modo === "apuntar" ? centroFx(p) : p;
        if (op.onFxPrevia) op.onFxPrevia(gesto.inicio, fin);
        gesto.fin = fin;
        previaFx(gesto.inicio, fin);
        return;
      }
      if (gesto.tipo === "niebla") {
        const a = gesto.inicio, ocultar = (st.opc.niebla || {}).modo === "ocultar";
        vistaPrevia.find(".previa").forEach(x => x.destroy());
        vistaPrevia.add(new Konva.Rect({ name: "previa", x: Math.min(a.x, p.x), y: Math.min(a.y, p.y), width: Math.abs(p.x - a.x), height: Math.abs(p.y - a.y),
          fill: ocultar ? "rgba(0,0,0,.45)" : "rgba(42,157,143,.3)", stroke: ocultar ? "#000" : "#2a9d8f", strokeWidth: 2 / zoom() }));
        lUI.batchDraw();
        return;
      }
      if (gesto.tipo === "nieblaPoli") { previaPoligono(gesto.puntos, p, (st.opc.niebla || {}).modo === "ocultar" ? "#222" : "#2a9d8f"); return; }
      if (gesto.tipo === "pluma") {
        const pts = gesto.puntos.concat([p.x, p.y]);
        vistaPrevia.find(".previa").forEach(x => x.destroy());
        const est = estiloDibujo();
        vistaPrevia.add(new Konva.Line({ name: "previa", points: pts, stroke: est.trazo, strokeWidth: est.grosor, lineCap: "round", lineJoin: "round" }));
        lUI.batchDraw();
        return;
      }
      if (gesto.tipo === "dibujo") {
        const est = estiloDibujo(), a = gesto.inicio;
        vistaPrevia.find(".previa").forEach(x => x.destroy());
        if (gesto.modo === "mano") {
          const ult = gesto.puntos.slice(-2);
          if (Math.hypot(p.x - ult[0], p.y - ult[1]) * zoom() > 2) gesto.puntos.push(p.x, p.y);
          vistaPrevia.add(new Konva.Line({ name: "previa", points: gesto.puntos, stroke: est.trazo, strokeWidth: est.grosor, tension: 0.35, lineCap: "round", lineJoin: "round" }));
        } else {
          let w = p.x - a.x, h = p.y - a.y;
          if (e.evt.shiftKey) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
          gesto.fin = { x: a.x + w, y: a.y + h };
          const comun = { name: "previa", stroke: est.trazo, strokeWidth: est.grosor, fill: est.relleno !== "transparent" ? est.relleno : undefined };
          vistaPrevia.add(gesto.modo === "elipse"
            ? new Konva.Ellipse(Object.assign({ x: a.x + w / 2, y: a.y + h / 2, radiusX: Math.abs(w) / 2, radiusY: Math.abs(h) / 2 }, comun))
            : new Konva.Rect(Object.assign({ x: Math.min(a.x, a.x + w), y: Math.min(a.y, a.y + h), width: Math.abs(w), height: Math.abs(h) }, comun)));
        }
        lUI.batchDraw();
      }
    });

    function previaPoligono(pts, p, color) {
      vistaPrevia.find(".previa").forEach(x => x.destroy());
      vistaPrevia.add(new Konva.Line({ name: "previa", points: pts.concat([p.x, p.y]), stroke: color, strokeWidth: 2 / zoom(), fill: color + "44", closed: true }));
      pts.length && vistaPrevia.add(new Konva.Circle({ name: "previa", x: pts[0], y: pts[1], radius: 6 / zoom(), fill: color }));
      lUI.batchDraw();
    }

    function terminarGesto(e) {
      cancelarPulsacion();
      if (!gesto) return;
      if (e && e.evt && e.evt.button === 2 && gesto.tipo === "medida") return;   // el clic derecho añade una parada, no termina
      const p = punteroMundo(), g = gesto;
      if (g.tipo === "camara") { gesto = null; contenedor.classList.remove("arrastrando-camara"); return; }
      if (g.tipo === "derecho") {
        gesto = null;
        const ev = (e && e.evt) || {};
        const n = g.id && st.nodos.get(g.id);
        if (n && puedeSeleccionar(n.o) && (st.esGM || !(n.o.datos && n.o.datos.sinMenu))) {
          if (!st.seleccion.has(n.o.id)) seleccionar([n.o.id]);
          if (op.onMenu) op.onMenu(n.o.id, ev.clientX || g.x, ev.clientY || g.y);
        } else if (op.onMenuVacio) op.onMenuVacio(g.mundo, ev.clientX || g.x, ev.clientY || g.y, g.id || null);
        return;
      }
      if (g.tipo === "marco") {
        gesto = null;
        if (marco.visible()) {
          const caja = marco.getClientRect();
          const ev = (e && e.evt) || {};
          const ids = [...st.nodos.values()].filter(n => puedeSeleccionar(n.o) && n.g.visible() && Konva.Util.haveIntersection(caja, n.g.getClientRect())
            && (!ev.ctrlKey || n.o.tipo === "imagen") && (!ev.altKey || n.o.tipo === "texto" || n.o.tipo === "dibujo")).map(n => n.o.id);
          seleccionar(ids, e && e.evt && e.evt.shiftKey);
          marco.visible(false); lUI.batchDraw();
        }
        return;
      }
      if (g.tipo === "medida") {
        gesto = null;
        if (!st.opc.persistente) { guiaMedida.destroyChildren(); lUI.batchDraw(); if (op.onRegla) op.onRegla(null); }
        return;
      }
      if (g.tipo === "fx") {
        gesto = null;
        const fp = st.opc.fxPrevia || {}, fin = g.fin || (fp.modo === "apuntar" ? centroFx(p) : p);
        if (g.mantener) {
          if (op.onFxFin) op.onFxFin();
          quitarGuiaFx();
          return;
        }
        const L = Math.hypot(fin.x - g.inicio.x, fin.y - g.inicio.y);
        // En los efectos de área, arrastrar marca el radio; un clic usa el tamaño del panel
        const radio = fp.modo !== "apuntar" && L * zoom() > 8 ? radioArrastrado(L) : null;
        quitarGuiaFx();
        if (op.onFx) op.onFx(g.inicio, fin, { radio });
        return;
      }
      if (g.tipo === "niebla") {
        gesto = null;
        vistaPrevia.find(".previa").forEach(x => x.destroy()); lUI.batchDraw();
        const a = g.inicio;
        if (Math.abs(p.x - a.x) < 4 || Math.abs(p.y - a.y) < 4) return;
        agregarZonaNiebla([a.x, a.y, p.x, a.y, p.x, p.y, a.x, p.y]);
        return;
      }
      if (g.tipo === "pluma") {
        // Arrastrar desde el primer punto = línea recta; si no, cada clic añade un punto
        if (g.puntos.length === 2 && Math.hypot(p.x - g.inicio.x, p.y - g.inicio.y) * zoom() > 6) {
          terminarPluma(g.puntos.concat([p.x, p.y]));
        } else if (g.puntos.length === 2) { g.puntos = [g.inicio.x, g.inicio.y]; }
        return;
      }
      if (g.tipo === "dibujo") {
        gesto = null;
        vistaPrevia.find(".previa").forEach(x => x.destroy()); lUI.batchDraw();
        if (g.modo === "mano") {
          if (g.puntos.length < 4) return;
          const b = polilineaPuntos(g.puntos);
          crearDibujo("mano", { x: b.x, y: b.y, ancho: b.ancho, alto: b.alto, datos: { puntos: b.puntos } });
        } else if (g.fin) {
          const a = g.inicio, f = g.fin;
          const ancho = Math.abs(f.x - a.x), alto = Math.abs(f.y - a.y);
          if (ancho < 3 && alto < 3) return;
          crearDibujo(g.modo, { x: (a.x + f.x) / 2, y: (a.y + f.y) / 2, ancho: Math.max(ancho, 1), alto: Math.max(alto, 1) });
        }
      }
    }
    stage.on("mouseup touchend", terminarGesto);
    function estadoBajo(p) {
      const cat = window.TBEstados || [];
      for (const n of st.nodos.values()) {
        const o = n.o, l = (o.datos || {}).estados;
        if (!l || !l.length || !n.deco.visible() || o.tipo === "pin" || o.tipo === "luz") continue;
        const dx = p.x - n.deco.x(), dy = p.y - n.deco.y();
        if (Math.abs(dx) > o.ancho / 2 + 2 || dy < -o.alto / 2 - 2 || dy > o.alto / 2) continue;
        const lista = l.filter(e => e && e.id && e.id !== "muerto" && (cat.find(c => c.id === e.id) || {}).id && !cat.find(c => c.id === e.id).anim);
        const sz = Math.max(11, Math.min(22, Math.min(o.ancho, o.alto) * 0.27)), porFila = Math.max(1, Math.floor(o.ancho / (sz + 1)));
        for (let i = 0; i < lista.length; i++) {
          const fila = Math.floor(i / porFila), col = i % porFila;
          const cx = o.ancho / 2 - sz / 2 - col * (sz + 1), cy = -o.alto / 2 + sz / 2 + fila * (sz + 1);
          if (Math.hypot(dx - cx, dy - cy) <= sz / 2 + 1) return { id: lista[i].id, n: lista[i].n, muriendo: !!(o.datos || {}).muerte };
        }
      }
      return null;
    }
    let tipEstado = null;
    stage.on("mousemove.estados", e => {
      if (!op.onEstadoEncima) return;
      const b = st.herr === "seleccionar" && !gesto && !st.arrastre ? estadoBajo(punteroMundo()) : null;
      const clave = b ? b.id + ":" + b.n : null;
      if (clave === tipEstado && !b) return;
      tipEstado = clave;
      op.onEstadoEncima(b, e.evt.clientX, e.evt.clientY);
    });
    stage.on("mouseleave.estados", () => { if (tipEstado && op.onEstadoEncima) { tipEstado = null; op.onEstadoEncima(null); } });
    // Si se suelta el ratón fuera del tablero (sobre una ventana), el gesto también termina
    window.addEventListener("mouseup", e => {
      if (!gesto || gesto.tipo === "pluma" || gesto.tipo === "nieblaPoli") return;
      if (e.target && e.target.closest && e.target.closest("#tbLienzo")) return;
      terminarGesto({ evt: e });
    });
    stage.on("dblclick", () => {
      if (gesto && gesto.tipo === "pluma") { terminarPluma(gesto.puntos); return; }
      if (gesto && gesto.tipo === "nieblaPoli") { terminarPoligonoNiebla(); }
    });
    function terminarPluma(pts) {
      gesto = null;
      vistaPrevia.find(".previa").forEach(x => x.destroy()); lUI.batchDraw();
      // quita el punto repetido del doble clic
      if (pts.length >= 4 && pts[pts.length - 1] === pts[pts.length - 3] && pts[pts.length - 2] === pts[pts.length - 4]) pts = pts.slice(0, -2);
      if (pts.length < 4) return;
      const b = polilineaPuntos(pts);
      crearDibujo("linea", { x: b.x, y: b.y, ancho: b.ancho, alto: b.alto, datos: { puntos: b.puntos } });
    }
    function terminarPoligonoNiebla() {
      const pts = gesto.puntos.slice();
      gesto = null;
      vistaPrevia.find(".previa").forEach(x => x.destroy()); lUI.batchDraw();
      if (pts.length >= 6) agregarZonaNiebla(pts);
    }
    function agregarZonaNiebla(puntos) {
      const n = Object.assign({ activa: true, zonas: [] }, (st.escena && st.escena.niebla) || {});
      n.zonas = (n.zonas || []).concat([{ modo: (st.opc.niebla || {}).modo === "ocultar" ? "ocultar" : "revelar", puntos: puntos.map(v => Math.round(v)) }]);
      n.activa = true;
      if (op.onNiebla) op.onNiebla(n);
    }
    function hacerPing(p, centrar) {
      ping(p.x, p.y);
      if (op.onPing) op.onPing(p.x, p.y, centrar);
    }

    /* ------------------------------------------------------------ soltar archivos o arte */
    contenedor.addEventListener("dragover", e => { e.preventDefault(); contenedor.classList.add("soltando"); });
    contenedor.addEventListener("dragleave", () => contenedor.classList.remove("soltando"));
    contenedor.addEventListener("drop", e => {
      e.preventDefault();
      contenedor.classList.remove("soltando");
      stage.setPointersPositions(e);
      const p = punteroMundo();
      if (op.onSoltar) op.onSoltar(e.dataTransfer, p, e.altKey);
    });

    /* ------------------------------------------------------------ API */
    function cerrarMenus() { if (op.onCerrarMenus) op.onCerrarMenus(); }
    function setHerramienta(h) {
      st.herr = h;
      contenedor.className = "tb-lienzo herr-" + h;
      if (gesto && gesto.tipo !== "camara") { gesto = null; vistaPrevia.find(".previa").forEach(x => x.destroy()); }
      st.nodos.forEach(aplicarAtributos);
      actualizarTransformer();
      lObj.batchDraw(); lMapa.batchDraw(); lUI.batchDraw();
    }

    return {
      stage,
      setPermisos(esGM, uid) { st.esGM = esGM; st.uid = uid; opacidadNiebla(); st.nodos.forEach(n => { pintarDeco(n); aplicarAtributos(n); }); programarLuz(); },
      puntoDeRuta,
      midiendo: () => !!st.arrastre || !!(gesto && gesto.tipo === "medida"),
      cruzaMuro(a, b) { return !!window.TBLuz && bloqueaMovimiento() && TBLuz.cruza(a, b, TBLuz.segmentosDe([...st.nodos.values()].map(x => x.o)).paso); },
      reiniciarExplorado() { if (pintorLuz) { pintorLuz.reiniciarExplorado(true); programarLuz(); } },
      actualizarLuz: programarLuz,
      setEscena(escena) {
        st.escena = escena;
        programarLuz();
        const m = medidas();
        pagina.setAttrs({ width: m.w, height: m.h, fill: (escena && escena.fondo) || "#ffffff", visible: !!escena });
        paginaSombra.setAttrs({ width: m.w, height: m.h, visible: !!escena });
        contenedor.style.background = (escena && escena.opciones && escena.opciones.colorTablero) || "#3d4048";
        programarFondo();
        lMapa.batchDraw();
        st.nodos.forEach(pintarDeco);
        redibujarVista();
      },
      setObjetos: ponerObjetos,
      upsert, quitar,
      objeto: id => { const n = st.nodos.get(id); return n && n.o; },
      objetos: () => [...st.nodos.values()].map(n => n.o),
      setCapa(c) { st.capa = c; deseleccionar(); st.nodos.forEach(n => { pintarDeco(n); aplicarAtributos(n); }); lObj.batchDraw(); lMapa.batchDraw(); },
      setHerramienta,
      setOpciones(o) { const antes = st.opc.arribaMias; st.opc = Object.assign({}, st.opc, o); if (antes !== st.opc.arribaMias) { CAPAS.forEach(ordenarCapa); lObj.batchDraw(); } },
      opciones: () => st.opc,
      setVistaJugador(v) { st.vistaJugador = v; opacidadNiebla(); st.nodos.forEach(n => { pintarDeco(n); aplicarAtributos(n); }); programarLuz(); lObj.batchDraw(); lNiebla.batchDraw(); },
      setTurno(id) { const viejo = st.turno; st.turno = id; [viejo, id].forEach(x => { const n = st.nodos.get(x); if (n) pintarDeco(n); }); lObj.batchDraw(); lMapa.batchDraw(); },
      setEspacio(v) { st.espacio = v; contenedor.classList.toggle("arrastrando-camara", v); },
      moverRemoto(id, x, y, ruta) {
        const n = st.nodos.get(id);
        if (!n || n.arrastrando) return;
        if (Array.isArray(ruta) && ruta.length > 1) {
          const puntos = [{ x: n.g.x(), y: n.g.y() }].concat(ruta.slice(1, -1), [{ x, y }]);
          n.o.x = x; n.o.y = y;
          n.ultimaRuta = puntos;
          animarRuta(n, puntos);
          return;
        }
        n.o.x = x; n.o.y = y;
        n.g.to({ x, y, duration: 0.08 });
        n.deco.to({ x, y, duration: 0.08 }); n.aura.to({ x, y, duration: 0.08 });
        if (st.luzOn) programarLuz();
        if (st.seleccion.has(id)) setTimeout(() => { tr.forceUpdate(); actualizarTransformer(); }, 100);
      },
      reglaRemota, ping, marcarLocal,
      // Poner una ficha en un sitio al instante, sin animación y aunque se acabe de mover aquí (la Grieta)
      forzarPos(id, x, y) {
        const n = st.nodos.get(id);
        if (!n || n.arrastrando) return false;
        if (n.anim) { n.anim.stop(); n.anim = null; }
        n.animando = false;
        movLocal.delete(id);
        n.o.x = x; n.o.y = y;
        n.g.position({ x, y }); n.deco.position({ x, y }); n.aura.position({ x, y });
        n.ultimaRuta = null;
        programarLuz();
        if (st.seleccion.has(id)) { tr.forceUpdate(); pintarSeleccionUI(); }
        lObj.batchDraw(); lMapa.batchDraw(); lUI.batchDraw();
        return true;
      },
      aPantalla: p => stage.getAbsoluteTransform().point(p),
      contenedor,
      // Tecla X: la última ruta de las fichas seleccionadas, unos segundos
      ultimaRuta() {
        const rutas = [...st.seleccion].map(id => st.nodos.get(id)).filter(n => n && n.ultimaRuta && n.ultimaRuta.length > 1);
        if (!rutas.length) return false;
        guiaMedida.destroyChildren();
        rutas.forEach(n => dibujarRuta(guiaMedida, n.ultimaRuta, "#d6127e", false));
        lUI.batchDraw();
        clearTimeout(st.relojRuta);
        st.relojRuta = setTimeout(() => { if (!st.arrastre && !gesto) { guiaMedida.destroyChildren(); lUI.batchDraw(); } }, 4000);
        return true;
      },
      limpiarMedida() { guiaMedida.destroyChildren(); lUI.batchDraw(); },
      cancelarGesto() { gesto = null; vistaPrevia.find(".previa").forEach(x => x.destroy()); lUI.batchDraw(); },
      terminarPoligono() { if (gesto && gesto.tipo === "nieblaPoli") terminarPoligonoNiebla(); if (gesto && gesto.tipo === "pluma") terminarPluma(gesto.puntos); },
      seleccion: () => [...st.seleccion],
      seleccionar, deseleccionar,
      zoom, ponerZoom, centrarEn, ajustarVista, aMundo, punteroMundo,
      centroVista: () => aMundo({ x: stage.width() / 2, y: stage.height() / 2 }),
      tamCelda: tam,
      pagina: medidas,
      miniatura(ancho) {
        const m = medidas();
        if (!m.w || !m.h) return "";
        const k = ancho / m.w;
        const c = document.createElement("canvas");
        c.width = Math.round(m.w * k); c.height = Math.round(m.h * k);
        const g = c.getContext("2d");
        g.fillStyle = pagina.fill() || "#ffffff"; g.fillRect(0, 0, c.width, c.height);
        const vista = { x: stage.x(), y: stage.y(), s: stage.scaleX() };
        stage.setAttrs({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
        try {
          [lMapa, lGrid, lObj].forEach(l => { const cv = l.toCanvas({ x: 0, y: 0, width: m.w, height: m.h, pixelRatio: k }); g.drawImage(cv, 0, 0, c.width, c.height); });
        } finally { stage.setAttrs({ x: vista.x, y: vista.y, scaleX: vista.s, scaleY: vista.s }); stage.batchDraw(); }
        return c.toDataURL("image/jpeg", 0.7);
      },
      setCalidad(r) {
        if (st.calidad === r) return;
        st.calidad = r;
        Konva.pixelRatio = r;
        stage.getLayers().forEach(l => { l.getCanvas().setPixelRatio(r); });
        stage.batchDraw();
      },
      setPausa(v) { st.pausa = !!v; st.nodos.forEach(aplicarAtributos); lObj.batchDraw(); },
      setMayus(v) { tr.keepRatio(!!v); },
      setCursorB(v) { st.cursorB = !!v; },
      // V: las fichas que controlo, arriba del todo mientras se mantiene pulsada
      setArriba(v) {
        if (v) st.nodos.forEach(n => { if (controla(n.o) || (st.esGM && st.seleccion.has(n.o.id))) n.g.moveToTop(); });
        else CAPAS.forEach(ordenarCapa);
        lObj.batchDraw();
      },
      cursorRemoto(d) {
        if (!d || !d.de) return;
        let c = cursores.get(d.de);
        if (!c) {
          c = { g: new Konva.Group({ listening: false }) };
          c.g.add(new Konva.Path({ data: "M0 0L0 16L4.5 12L8 19L10.5 18L7 11L13 11Z", fill: d.color || "#2a7de1", stroke: "#fff", strokeWidth: 1 }));
          const etq = new Konva.Label({ x: 12, y: 16 });
          etq.add(new Konva.Tag({ fill: d.color || "#2a7de1", cornerRadius: 3 }));
          etq.add(new Konva.Text({ text: d.nombre || "", fontSize: 11, fill: "#fff", padding: 2 }));
          c.g.add(etq);
          pings.add(c.g);
          cursores.set(d.de, c);
        }
        c.g.setAttrs({ x: d.x, y: d.y, scaleX: 1 / zoom(), scaleY: 1 / zoom(), visible: true });
        clearTimeout(c.t);
        c.t = setTimeout(() => { c.g.visible(false); lUI.batchDraw(); }, 1800);
        lUI.batchDraw();
      },
      ajustarPos,
      capaUI: lUI,
      redibujar() { st.nodos.forEach(n => { pintarDeco(n); aplicarAtributos(n); }); stage.batchDraw(); }
    };
  }

  window.TBLienzo = { crear };
})();
