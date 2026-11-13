/* =============================================================================
   TABLERO — iluminación dinámica (lo que no depende de Konva).
   - Muros: los dibujos de la capa «Iluminación» (líneas, rectángulos, elipses). datos.muro = "muro" | "puerta" |
     "ventana"; una puerta abierta deja ver y pasar; una ventana deja ver pero no pasar.
   - Luces: fichas con datos.luz { brillante, tenue } (pies) y luces sueltas (tipo "luz" en la capa Iluminación).
   - Visión: fichas con datos.vision { ve, oscuridad } (pies de visión en la oscuridad).
   - Lo que ve un personaje = su polígono de visión (rayos hasta los muros) ∩ (zonas iluminadas ∪ su visión en la
     oscuridad). Todo se calcula en la CPU solo cuando algo cambia; la oscuridad se pinta en un lienzo del tamaño
     de la página a baja resolución, que Konva estira (los bordes quedan suaves y la gráfica no sufre).
============================================================================= */
(function () {
  const COLOR_MURO = { muro: "#2f80ed", puerta: "#f2994a", ventana: "#56ccf2" };

  /* ------------------------------------------------------------ geometría de los muros */
  function puntosMundo(o) {
    const d = o.datos || {}, w = o.ancho, h = o.alto;
    let loc, cerrado = !!d.cerrado;
    if (d.forma === "rect") { loc = [[0, 0], [w, 0], [w, h], [0, h]]; cerrado = true; }
    else if (d.forma === "elipse") { loc = []; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; loc.push([w / 2 + Math.cos(a) * w / 2, h / 2 + Math.sin(a) * h / 2]); } cerrado = true; }
    else { const p = d.puntos || [0, 0, w, h]; loc = []; for (let i = 0; i + 1 < p.length; i += 2) loc.push([p[i], p[i + 1]]); }
    const r = (o.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    return { pts: loc.map(([x, y]) => { const lx = x - w / 2, ly = y - h / 2; return { x: o.x + lx * c - ly * s, y: o.y + lx * s + ly * c }; }), cerrado };
  }
  // Segmentos que tapan la vista y los que cortan el paso
  function segmentosDe(objetos) {
    const vista = [], paso = [];
    objetos.forEach(o => {
      if (o.capa !== "luz" || o.tipo !== "dibujo") return;
      const d = o.datos || {}, tipo = d.muro || "muro";
      if (tipo === "puerta" && d.abierta) return;
      const { pts, cerrado } = puntosMundo(o);
      const n = pts.length;
      for (let i = 0; i < n - 1 + (cerrado ? 1 : 0); i++) {
        const s = [pts[i], pts[(i + 1) % n]];
        paso.push(s);
        if (tipo !== "ventana") vista.push(s);
      }
    });
    return { vista, paso };
  }

  /* ------------------------------------------------------------ rayos */
  function rayo(o, dx, dy, s) {
    const sx = s[1].x - s[0].x, sy = s[1].y - s[0].y;
    const den = dx * sy - dy * sx;
    if (Math.abs(den) < 1e-12) return null;
    const qx = s[0].x - o.x, qy = s[0].y - o.y;
    const t = (qx * sy - qy * sx) / den, u = (qx * dy - qy * dx) / den;
    return t >= 0 && u >= -1e-9 && u <= 1 + 1e-9 ? t : null;
  }
  // Polígono de lo que se ve desde «o» (barrido angular por los extremos de los segmentos). Con radio, solo los
  // segmentos cercanos y un contorno circular para no buscar más lejos.
  function poligono(o, segs, limites, radio) {
    let usar = segs;
    const borde = [];
    if (radio) {
      usar = segs.filter(s => Math.min(s[0].x, s[1].x) <= o.x + radio && Math.max(s[0].x, s[1].x) >= o.x - radio && Math.min(s[0].y, s[1].y) <= o.y + radio && Math.max(s[0].y, s[1].y) >= o.y - radio);
      const n = 32, R = radio * 1.02;
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2; borde.push([{ x: o.x + Math.cos(a) * R, y: o.y + Math.sin(a) * R }, { x: o.x + Math.cos(b) * R, y: o.y + Math.sin(b) * R }]); }
    } else {
      const { w, h } = limites;
      borde.push([{ x: 0, y: 0 }, { x: w, y: 0 }], [{ x: w, y: 0 }, { x: w, y: h }], [{ x: w, y: h }, { x: 0, y: h }], [{ x: 0, y: h }, { x: 0, y: 0 }]);
    }
    const todos = usar.concat(borde);
    const angulos = [];
    todos.forEach(s => s.forEach(p => { const a = Math.atan2(p.y - o.y, p.x - o.x); angulos.push(a - 1e-4, a, a + 1e-4); }));
    const pts = [];
    for (const a of angulos) {
      const dx = Math.cos(a), dy = Math.sin(a);
      let tMin = Infinity;
      for (const s of todos) { const t = rayo(o, dx, dy, s); if (t !== null && t < tMin) tMin = t; }
      if (tMin < Infinity) pts.push({ a, x: o.x + dx * tMin, y: o.y + dy * tMin });
    }
    pts.sort((p, q) => p.a - q.a);
    return pts;
  }
  // ¿El trayecto de a a b cruza algún segmento? (para que las fichas no atraviesen muros)
  function cruza(a, b, segs) {
    const dx = b.x - a.x, dy = b.y - a.y, largo = Math.hypot(dx, dy);
    if (largo < 1e-6) return false;
    return segs.some(s => { const t = rayo(a, dx / largo, dy / largo, s); return t !== null && t <= largo; });
  }

  /* ------------------------------------------------------------ pintar la oscuridad */
  function lienzo(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }
  function trazar(ctx, poli) { ctx.beginPath(); poli.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); }
  /* Crea el pintor de una página. pintar() devuelve el lienzo de oscuridad (negro = no se ve) y deja listo
     visible(x, y) para saber si un punto lo ve alguien. */
  function crearPintor() {
    let W = 0, H = 0, k = 1, oscuro = null, revelado = null, luces = null, tmp = null, explorado = null, clave = "";
    function preparar(m) {
      const nk = Math.min(0.5, 1600 / Math.max(m.w, m.h, 1));
      const nW = Math.ceil(m.w * nk), nH = Math.ceil(m.h * nk);
      if (nW === W && nH === H && oscuro) return;
      W = nW; H = nH; k = nk;
      oscuro = lienzo(W, H); revelado = lienzo(W, H); luces = lienzo(W, H); tmp = lienzo(W, H);
      explorado = lienzo(W, H);
    }
    function reiniciarExplorado() { if (explorado) explorado.getContext("2d").clearRect(0, 0, W, H); }
    function pintar({ medidas, segs, viewers, fuentes, global, explorar, claveExplorado }) {
      preparar(medidas);
      if (claveExplorado !== clave) { clave = claveExplorado; reiniciarExplorado(); }
      const lim = { w: medidas.w, h: medidas.h };
      const cx = c => { const x = c.getContext("2d", { willReadFrequently: c === revelado }); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H); x.setTransform(k, 0, 0, k, 0, 0); x.globalCompositeOperation = "source-over"; x.globalAlpha = 1; return x; };
      // 1) Zonas iluminadas (cada luz recortada por sus propios muros)
      const lc = cx(luces);
      if (global) { lc.fillStyle = "#fff"; lc.fillRect(0, 0, medidas.w, medidas.h); }
      else fuentes.forEach(f => {
        const rt = f.brillante + f.tenue;
        if (!(rt > 0)) return;
        const poli = poligono(f, segs, lim, rt);
        if (poli.length < 3) return;
        lc.save();
        trazar(lc, poli); lc.clip();
        const g = lc.createRadialGradient(f.x, f.y, 0, f.x, f.y, rt);
        const fb = Math.min(0.999, f.brillante / rt);
        g.addColorStop(0, "rgba(255,255,255,1)");
        if (f.brillante > 0) { g.addColorStop(fb, "rgba(255,255,255,1)"); g.addColorStop(Math.min(1, fb + 0.02), "rgba(255,255,255,.55)"); }
        else g.addColorStop(0.02, "rgba(255,255,255,.55)");
        g.addColorStop(0.94, "rgba(255,255,255,.5)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        lc.fillStyle = g;
        lc.beginPath(); lc.arc(f.x, f.y, rt, 0, Math.PI * 2); lc.fill();
        lc.restore();
      });
      // 2) Lo que ve cada personaje
      const rc = cx(revelado);
      viewers.forEach(v => {
        const tc = cx(tmp);
        tc.drawImage(luces, 0, 0, W, H, 0, 0, medidas.w, medidas.h);
        if (v.oscuridad > 0) {
          const g = tc.createRadialGradient(v.x, v.y, 0, v.x, v.y, v.oscuridad);
          g.addColorStop(0, "rgba(255,255,255,.85)"); g.addColorStop(0.92, "rgba(255,255,255,.8)"); g.addColorStop(1, "rgba(255,255,255,0)");
          tc.fillStyle = g; tc.beginPath(); tc.arc(v.x, v.y, v.oscuridad, 0, Math.PI * 2); tc.fill();
        }
        const vista = poligono(v, segs, lim);
        tc.globalCompositeOperation = "destination-in";
        tc.fillStyle = "#fff"; trazar(tc, vista); tc.fill();
        rc.setTransform(1, 0, 0, 1, 0, 0); rc.drawImage(tmp, 0, 0); rc.setTransform(k, 0, 0, k, 0, 0);
      });
      // 3) Oscuridad: todo negro menos lo explorado (en penumbra) y lo que se ve ahora
      const oc = oscuro.getContext("2d");
      oc.setTransform(1, 0, 0, 1, 0, 0); oc.globalCompositeOperation = "source-over"; oc.globalAlpha = 1;
      oc.fillStyle = "#000"; oc.fillRect(0, 0, W, H);
      if (explorar) {
        const ec = explorado.getContext("2d");
        ec.setTransform(1, 0, 0, 1, 0, 0); ec.globalCompositeOperation = "source-over"; ec.drawImage(revelado, 0, 0);
        oc.globalCompositeOperation = "destination-out"; oc.globalAlpha = 0.5; oc.drawImage(explorado, 0, 0);
      }
      oc.globalCompositeOperation = "destination-out"; oc.globalAlpha = 1; oc.drawImage(revelado, 0, 0);
      oc.globalCompositeOperation = "source-over";
      return oscuro;
    }
    // ¿Se ve el punto (x, y)? Mira el lienzo de lo revelado
    function visible(x, y) {
      if (!revelado) return false;
      const px = Math.floor(x * k), py = Math.floor(y * k);
      if (px < 0 || py < 0 || px >= W || py >= H) return false;
      return revelado.getContext("2d", { willReadFrequently: true }).getImageData(px, py, 1, 1).data[3] > 70;
    }
    return { pintar, visible, reiniciarExplorado };
  }

  /* ------------------------------------------------------------ objetos auxiliares */
  // Una polilínea en coordenadas de mundo → fila de objeto dibujo (centro, tamaño y puntos relativos)
  function polilinea(pts, datos) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    pts.forEach(p => { x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y); x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y); });
    const ancho = Math.max(1, x2 - x1), alto = Math.max(1, y2 - y1);
    const puntos = [];
    pts.forEach(p => puntos.push(Math.round((p.x - x1) * 10) / 10, Math.round((p.y - y1) * 10) / 10));
    return { tipo: "dibujo", capa: "luz", x: x1 + ancho / 2, y: y1 + alto / 2, ancho, alto,
      datos: Object.assign({ forma: "linea", puntos, trazo: COLOR_MURO[(datos && datos.muro) || "muro"], relleno: "transparent", grosor: 4 }, datos) };
  }

  /* Universal VTT (.dd2vtt / .uvtt / .df2vtt, de Dungeondraft y otros): imagen, tamaño, muros, puertas y luces.
     Coordenadas en casillas. Devuelve lo necesario para crear la página. */
  function leerUVTT(j, tamCelda, piesCelda) {
    const res = j.resolution || {};
    const org = res.map_origin || { x: 0, y: 0 }, tam = res.map_size || { x: 20, y: 20 };
    const aMundo = q => ({ x: (Number(q.x) - org.x) * tamCelda, y: (Number(q.y) - org.y) * tamCelda });
    const filas = [];
    (j.line_of_sight || []).concat(j.objects_line_of_sight || []).forEach(poli => { if (poli && poli.length >= 2) filas.push(polilinea(poli.map(aMundo), { muro: "muro" })); });
    (j.portals || []).forEach(pt => { const b = pt.bounds || []; if (b.length >= 2) filas.push(polilinea(b.map(aMundo), { muro: "puerta", abierta: pt.closed === false })); });
    (j.lights || []).forEach(l => {
      const p = aMundo(l.position || { x: 0, y: 0 }), r = (Number(l.range) || 4) * piesCelda;
      filas.push({ tipo: "luz", capa: "luz", x: p.x, y: p.y, ancho: 28, alto: 28, datos: { luz: { brillante: Math.round(r / 2), tenue: Math.round(r / 2) }, color: "#" + String(l.color || "ffffffff").slice(-6) } });
    });
    return { ancho: Math.max(1, Math.ceil(tam.x)), alto: Math.max(1, Math.ceil(tam.y)), anchoPx: tam.x * tamCelda, altoPx: tam.y * tamCelda, imagen: j.image || null, filas,
      diurno: !!(j.environment && j.environment.baked_lighting && /^f{6}/i.test(String(j.environment.ambient_light || ""))) };
  }

  window.TBLuz = { COLOR_MURO, puntosMundo, segmentosDe, poligono, cruza, crearPintor, polilinea, leerUVTT };
})();
