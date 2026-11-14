/* =============================================================================
   TABLERO — lienzo (Konva). Capas Mapa → cuadrícula → Fichas, DJ y Delantera → niebla → interfaz.
   Cada objeto es un grupo centrado en (x, y) que gira sobre su centro; las barras, el nombre y las auras van
   aparte para que no giren con la ficha. No guarda nada: avisa a la app (opciones.on*) y la app decide.
============================================================================= */
(function () {
  const COLORES_BARRA = ["#5cb85c", "#4f8fd6", "#d9534f"];
  const CAPAS = ["mapa", "fichas", "gm", "delantero", "luz"];
  const SUPA = "supabase.co";

  function crear(contenedor, op) {
    Konva.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);   // gráficas integradas: no pasar de 1,5
    const stage = new Konva.Stage({ container: contenedor, width: contenedor.clientWidth, height: contenedor.clientHeight });
    const lMapa = new Konva.Layer();
    const lGrid = new Konva.Layer({ listening: false });
    const lObj = new Konva.Layer();
    const lNiebla = new Konva.Layer({ listening: false });
    const lUI = new Konva.Layer();
    stage.add(lMapa, lGrid, lObj, lNiebla, lUI);
    // La página: el lienzo donde van los mapas; fuera de ella se ve el color del tablero
    const pagina = new Konva.Rect({ x: 0, y: 0, width: 2800, height: 2800, fill: "#ffffff", listening: false, shadowColor: "#000", shadowBlur: 24, shadowOpacity: 0.35 });
    lMapa.add(pagina);

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
      rotateEnabled: true, keepRatio: false, ignoreStroke: true, anchorSize: 9, borderStroke: "#d6127e", anchorStroke: "#d6127e",
      anchorCornerRadius: 2, rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315], rotationSnapTolerance: 6, flipEnabled: false,
      boundBoxFunc: (viejo, nuevo) => (Math.abs(nuevo.width) < 8 || Math.abs(nuevo.height) < 8 ? viejo : nuevo)
    });
    lUI.add(tr);
    const guiaMedida = new Konva.Group({ listening: false });
    const guiasRemotas = new Konva.Group({ listening: false });
    const pings = new Konva.Group({ listening: false });
    const vistaPrevia = new Konva.Group({ listening: false });
    const marco = new Konva.Rect({ visible: false, fill: "rgba(214,18,126,.08)", stroke: "#d6127e", strokeWidth: 1, dash: [4, 3], listening: false });
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
    function redibujarVista() { lGrid.batchDraw(); lNiebla.batchDraw(); stage.batchDraw(); }
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
    function programarLuz() {
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

    function opacidadNiebla() { lNiebla.opacity(st.esGM && !st.vistaJugador ? 0.42 : 1); }

    /* ------------------------------------------------------------ imágenes */
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
      const e = imagen(d.src, () => { if (st.nodos.get(o.id) === n) pintarCuerpo(n); });
      if (!e || !e.listo) {
        return new Konva.Rect({ width: w, height: h, fill: e && e.error ? "#7a3434" : "rgba(120,120,120,.45)", cornerRadius: Math.min(w, h) / 2, stroke: "#888", strokeWidth: 1 });
      }
      const k = new Konva.Image({ image: e.img, width: w, height: h });
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
      (d.auras || []).forEach(a => {
        if (!a || !(a.radio > 0) || (!st.esGM && a.ver === false)) return;
        const r = r0 + a.radio / pies() * t;
        const comun = { fill: a.color || "#ffff99", opacity: a.opacidad == null ? 0.35 : a.opacidad };
        n.aura.add(a.forma === "cuadrado" ? new Konva.Rect(Object.assign({ x: -r, y: -r, width: r * 2, height: r * 2 }, comun)) : new Konva.Circle(Object.assign({ radius: r }, comun)));
      });
      if (st.turno === o.id) n.aura.add(new Konva.Circle({ radius: r0 + 5, stroke: "#f5b41f", strokeWidth: 4, opacity: 0.95 }));
      // Barras
      const compacto = d.barraEstilo === "compacto";
      const hb = compacto ? 4 : 9, w = Math.max(o.ancho, 30);
      const barras = (d.barras || []).map((b, i) => ({ b, i })).filter(({ b }) => b && Number(b.max) > 0 && (st.esGM || controla(o) || b.ver));
      const debajo = d.barraPos === "debajo";
      barras.forEach(({ b, i }, k) => {
        const y = debajo ? o.alto / 2 + 3 + k * (hb + 2) : -o.alto / 2 - 3 - (barras.length - k) * (hb + 2);
        const frac = Math.max(0, Math.min(1, Number(b.valor) / Number(b.max)));
        n.deco.add(new Konva.Rect({ x: -w / 2, y, width: w, height: hb, fill: "rgba(30,30,30,.65)", cornerRadius: 2 }));
        n.deco.add(new Konva.Rect({ x: -w / 2, y, width: w * frac, height: hb, fill: COLORES_BARRA[i], cornerRadius: 2 }));
        const verTexto = !compacto && ((b.texto || "editores") === "todos" || ((b.texto || "editores") === "editores" && (st.esGM || controla(o))));
        if (verTexto) n.deco.add(new Konva.Text({ x: -w / 2, y: y + 1, width: w, align: "center", text: `${b.valor}/${b.max}`, fontSize: 7.5, fontStyle: "bold", fill: "#fff" }));
      });
      if (o.tipo === "pin" && d.titulo) {
        const etq = new Konva.Label({ y: o.alto / 2 + 3 });
        etq.add(new Konva.Tag({ fill: "rgba(255,255,255,.95)", cornerRadius: 3, stroke: "#d6127e", strokeWidth: 1 }));
        etq.add(new Konva.Text({ text: d.titulo, fontSize: 12, fontStyle: "bold", fill: "#333", padding: 3 }));
        etq.offsetX(etq.width() / 2);
        n.deco.add(etq);
      }
      if (d.verNombre && d.nombre && o.tipo !== "texto" && o.tipo !== "pin") {
        const etq = new Konva.Label({ y: o.alto / 2 + 4 + (debajo ? barras.length * (hb + 2) : 0) });
        etq.add(new Konva.Tag({ fill: "rgba(20,20,20,.72)", cornerRadius: 3 }));
        etq.add(new Konva.Text({ text: d.nombre, fontSize: 12, fill: "#fff", padding: 3 }));
        etq.offsetX(etq.width() / 2);
        n.deco.add(etq);
      }
      if (o.bloqueado && st.esGM && o.capa === st.capa) n.deco.add(new Konva.Text({ x: o.ancho / 2 - 12, y: -o.alto / 2 - 2, text: "🔒", fontSize: 11 }));
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

    function upsert(o) {
      const n = st.nodos.get(o.id);
      if (!n) { crearNodo(o); ordenarCapa(o.capa); lObj.batchDraw(); lMapa.batchDraw(); programarLuz(); return; }
      if (n.arrastrando || n.transformando) {
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
      lMapa.batchDraw(); lObj.batchDraw(); lUI.batchDraw();
    }

    function quitar(id) {
      const n = st.nodos.get(id);
      if (!n) return;
      st.seleccion.delete(id);
      n.g.destroy(); n.deco.destroy(); n.aura.destroy();
      st.nodos.delete(id);
      actualizarTransformer();
      programarLuz();
      lMapa.batchDraw(); lObj.batchDraw();
    }

    function ponerObjetos(lista) {
      [...st.nodos.keys()].forEach(quitar);
      lista.forEach(o => crearNodo(o));
      CAPAS.forEach(ordenarCapa);
      programarLuz();
      lMapa.batchDraw(); lObj.batchDraw();
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
        vistaPrevia.add(new Konva.Rect({ name: "sel", x: r.x - 2, y: r.y - 2, width: r.width + 4, height: r.height + 4, stroke: "#d6127e", strokeWidth: 1.5 / zoom(), dash: [5, 3] }));
      });
      lUI.batchDraw();
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
    let ultimoMov = 0;
    function enganchar(n) {
      n.g.on("mousedown touchstart", e => {
        if (st.herr !== "seleccionar" || e.evt.button === 1 || st.espacio) return;
        if (e.evt.button === 2) return;
        const id = n.o.id;
        if (!puedeSeleccionar(n.o)) return;
        if (e.evt.shiftKey) { if (st.seleccion.has(id)) deseleccionar(id); else seleccionar([id], true); }
        else if (!st.seleccion.has(id)) seleccionar([id]);
        e.cancelBubble = true;
      });
      n.g.on("dragstart", () => {
        if (!st.seleccion.has(n.o.id)) seleccionar([n.o.id]);
        st.arrastre = { lider: n.o.id, inicio: new Map([...st.seleccion].map(id => { const m = st.nodos.get(id); return [id, { x: m.o.x, y: m.o.y }]; })) };
        st.seleccion.forEach(id => { const m = st.nodos.get(id); if (m) m.arrastrando = true; });
        cancelarPulsacion();
      });
      n.g.on("dragmove", () => {
        if (!st.arrastre) return;
        const ini = st.arrastre.inicio.get(n.o.id);
        const dx = n.g.x() - ini.x, dy = n.g.y() - ini.y;
        st.seleccion.forEach(id => {
          const m = st.nodos.get(id), p = st.arrastre.inicio.get(id);
          if (!m || !p) return;
          if (id !== n.o.id) m.g.position({ x: p.x + dx, y: p.y + dy });
          m.o.x = m.g.x(); m.o.y = m.g.y();
          m.deco.position(m.g.position()); m.aura.position(m.g.position());
        });
        const ahora = Date.now();
        if (ahora - ultimoMov > 60) {
          ultimoMov = ahora;
          st.seleccion.forEach(id => { const m = st.nodos.get(id); if (m && m.o.capa !== "gm" && op.onMovEnCurso) op.onMovEnCurso(id, m.o.x, m.o.y); });
        }
        if (st.luzOn) programarLuz();
        if (st.opc.moverMide !== false && n.o.capa !== "mapa") {
          dibujarMedida(guiaMedida, "linea", ini, { x: n.g.x(), y: n.g.y() }, "#d6127e", true);
          if (st.opc.transmitir !== false && op.onRegla && n.o.capa !== "gm") op.onRegla({ forma: "linea", a: ini, b: { x: n.g.x(), y: n.g.y() }, mov: true });
        }
        tr.forceUpdate();
        lUI.batchDraw();
      });
      n.g.on("dragend", e => {
        if (!st.arrastre) return;
        const sinAjuste = e.evt && e.evt.altKey;
        const movidos = [];
        const muros = !st.esGM && bloqueaMovimiento() ? TBLuz.segmentosDe([...st.nodos.values()].map(x => x.o)).paso : null;
        let chocan = false;
        st.seleccion.forEach(id => {
          const m = st.nodos.get(id);
          if (!m) return;
          let p = ajustarPos(m.o, m.g.x(), m.g.y(), sinAjuste);
          const ini = st.arrastre.inicio.get(id);
          if (muros && ini && TBLuz.cruza(ini, p, muros)) { p = { x: ini.x, y: ini.y }; chocan = true; }
          m.g.position(p); m.o.x = p.x; m.o.y = p.y;
          m.deco.position(p); m.aura.position(p);
          m.arrastrando = false;
          movidos.push(m.o);
        });
        st.arrastre = null;
        if (chocan && op.onAviso) op.onAviso("Hay un muro en medio: la ficha vuelve a su sitio.");
        programarLuz();
        guiaMedida.destroyChildren();
        if (op.onRegla) op.onRegla(null);
        tr.forceUpdate();
        lObj.batchDraw(); lMapa.batchDraw(); lUI.batchDraw();
        movidos.forEach(o => {
          if (op.onMovEnCurso && o.capa !== "gm") op.onMovEnCurso(o.id, o.x, o.y);
          if (op.onMovido) op.onMovido(o);
        });
      });
      n.g.on("transformstart", () => { st.seleccion.forEach(id => { const m = st.nodos.get(id); if (m) m.transformando = true; }); });
      n.g.on("transform", () => {
        const m = n;
        m.deco.position(m.g.position()); m.aura.position(m.g.position());
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
      if (!d.a) { reglasRemotas.delete(d.de); lUI.batchDraw(); return; }
      const g = new Konva.Group({ listening: false });
      guiasRemotas.add(g);
      dibujarMedida(g, d.forma || "linea", d.a, d.b, d.color || "#2a7de1", false, d.extra);
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
    });

    function polilineaPuntos(pts) {
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (let i = 0; i < pts.length; i += 2) { x1 = Math.min(x1, pts[i]); y1 = Math.min(y1, pts[i + 1]); x2 = Math.max(x2, pts[i]); y2 = Math.max(y2, pts[i + 1]); }
      const ancho = Math.max(1, x2 - x1), alto = Math.max(1, y2 - y1);
      return { x: x1 + ancho / 2, y: y1 + alto / 2, ancho, alto, puntos: pts.map((v, i) => Math.round((i % 2 ? v - y1 : v - x1) * 10) / 10) };
    }
    function estiloDibujo() {
      const d = st.opc.dibujo || {};
      const grosores = { fino: 2, mediano: 4, grueso: 8, enorme: 14 };
      return { trazo: d.trazo || "#d6127e", relleno: d.relleno || "transparent", grosor: grosores[d.grosor] || 4 };
    }
    function crearDibujo(forma, datosForma) {
      const est = estiloDibujo();
      if (op.onCrear) op.onCrear([Object.assign({ tipo: "dibujo", capa: st.esGM ? st.capa : "fichas" }, datosForma, { datos: Object.assign({ forma }, est, datosForma.datos || {}) })]);
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
      if (boton === 2) {
        const tgt = e.target.findAncestor && e.target.findAncestor(".obj", true);
        gesto = { tipo: "derecho", x: e.evt.clientX, y: e.evt.clientY, pos: stage.position(), id: tgt ? tgt.id() : null, mundo: p };
        return;
      }
      const vacio = e.target === stage || !e.target.findAncestor || !e.target.findAncestor(".obj", true);
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
      if (st.herr === "fx") { gesto = { tipo: "fx", inicio: p }; return; }
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
        dibujarMedida(guiaMedida, st.opc.formaMedida || "linea", gesto.inicio, b, "#d6127e", true);
        gesto.fin = b;
        if (st.opc.transmitir !== false && op.onRegla) op.onRegla({ forma: st.opc.formaMedida || "linea", a: gesto.inicio, b, persistente: !!st.opc.persistente, extra: st.opc.medidaExtra });
        lUI.batchDraw();
        return;
      }
      if (gesto.tipo === "fx") {
        if (op.onFxPrevia) op.onFxPrevia(gesto.inicio, p);
        gesto.fin = p;
        const pl = st.opc.fxPlantilla || "linea";
        if (pl !== "ninguna" && Math.hypot(p.x - gesto.inicio.x, p.y - gesto.inicio.y) * zoom() > 4) {
          dibujarMedida(guiaMedida, pl, gesto.inicio, p, "#e8641c", true);
          if (st.opc.transmitir !== false && op.onRegla) op.onRegla({ forma: pl, a: gesto.inicio, b: p, extra: st.opc.medidaExtra, color: "#e8641c" });
          lUI.batchDraw();
        }
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
      const p = punteroMundo(), g = gesto;
      if (g.tipo === "camara") { gesto = null; contenedor.classList.remove("arrastrando-camara"); return; }
      if (g.tipo === "derecho") {
        gesto = null;
        const ev = (e && e.evt) || {};
        const n = g.id && st.nodos.get(g.id);
        if (n && puedeSeleccionar(n.o) && (st.esGM || !(n.o.datos && n.o.datos.sinMenu))) {
          if (!st.seleccion.has(n.o.id)) seleccionar([n.o.id]);
          if (op.onMenu) op.onMenu(n.o.id, ev.clientX || g.x, ev.clientY || g.y);
        } else if (op.onMenuVacio) op.onMenuVacio(g.mundo, ev.clientX || g.x, ev.clientY || g.y);
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
        if (op.onFx) op.onFx(g.inicio, g.fin || p);
        // El área se queda un momento mientras dura el efecto (o fija, si la medida es persistente)
        if (!st.opc.persistente) setTimeout(() => { if (gesto && gesto.tipo === "fx") return; guiaMedida.destroyChildren(); lUI.batchDraw(); if (op.onRegla) op.onRegla(null); }, 1600);
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
      cruzaMuro(a, b) { return !!window.TBLuz && bloqueaMovimiento() && TBLuz.cruza(a, b, TBLuz.segmentosDe([...st.nodos.values()].map(x => x.o)).paso); },
      reiniciarExplorado() { if (pintorLuz) { pintorLuz.reiniciarExplorado(true); programarLuz(); } },
      actualizarLuz: programarLuz,
      setEscena(escena) {
        st.escena = escena;
        programarLuz();
        const m = medidas();
        pagina.setAttrs({ width: m.w, height: m.h, fill: (escena && escena.fondo) || "#ffffff", visible: !!escena });
        contenedor.style.background = (escena && escena.opciones && escena.opciones.colorTablero) || "#3d4048";
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
      moverRemoto(id, x, y) {
        const n = st.nodos.get(id);
        if (!n || n.arrastrando) return;
        n.o.x = x; n.o.y = y;
        n.g.to({ x, y, duration: 0.08 });
        n.deco.to({ x, y, duration: 0.08 }); n.aura.to({ x, y, duration: 0.08 });
        if (st.luzOn) programarLuz();
        if (st.seleccion.has(id)) setTimeout(() => { tr.forceUpdate(); actualizarTransformer(); }, 100);
      },
      reglaRemota, ping,
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
        g.fillStyle = (st.escena && st.escena.fondo) || "#ffffff"; g.fillRect(0, 0, c.width, c.height);
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
