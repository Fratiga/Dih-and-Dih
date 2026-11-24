/* =============================================================================
   TABLERO — La Grieta de Dexter: la particularidad de página de las anomalías espaciales y físicas.
   Solo vale en las páginas que la tienen asignada (Configuración de página → Particularidades).

   Quién decide: el navegador del DJ. Él tira los dados de cada anomalía (al moverse una ficha, o cada
   cierto tiempo), escribe los cambios en el servidor como cualquier otro cambio del DJ y avisa por el canal
   «grieta» para que todos vean el mismo efecto a la vez. Sin el DJ en la página no pasa nada.

   Tres familias, que se pueden combinar en un mismo evento:
   - Movimiento: la ficha aparece cerca, lejos, en el lado opuesto, detrás de otra, en espejo, de vuelta
     al origen o cambiada de sitio con otra que se movió a la vez. El destino siempre es válido: dentro de
     la página, sin pisar un muro, fuera de la niebla y sin montarse en otra ficha, con su tamaño.
   - Mapa: solo visual (dura un instante y no cambia nada) o real (giro de 90/180/270, volteo, contracción,
     expansión, partir el mapa en trozos, cambiar trozos de sitio y recomponer). Lo real cambia coordenadas:
     con «las fichas encima» todo se mueve junto; con «solo el terreno» las fichas se quedan y el mundo
     cambia debajo (y las que quedan en un sitio imposible se recolocan en el válido más cercano).
   - Estadísticas: se cambian puntuaciones entre participantes (fichas del compendio y enemigos de
     data/stats.js) con los datos reales; las derivadas (modificadores, salvaciones, habilidades, ataques,
     CD, iniciativa) salen solas. En las fichas se reescriben también sus tiradas (columna roll20) con el
     mismo generador de la hoja (fichas-roll20-panel.js). Nunca se toca la identidad (nombre, clase,
     raza, nivel, competencia, conjuros...). Los PV son aparte y configurables. La primera vez que la Grieta
     toca una ficha se guarda su original (data.grietaOriginal) para poder restaurarla.

   Todo queda en un registro (en este navegador del DJ) desde el que se puede deshacer cada evento.
============================================================================= */
(function () {
  const { esc, el, aviso, mensajeError, ventana, ventanas, interruptor, confirmar } = TBUI;
  const ID = "grieta";
  let TB = null;
  let dentro = false;           // la página actual tiene la Grieta
  let escenaId = null;
  let gen = 0;                  // sube al salir: lo que estaba en marcha se da por cancelado
  let temporizador = null;

  /* ============================================================ utilidades */
  const CFG_DEF = { activa: true, pausada: false, frecuencia: "media", intensidad: 2, mov: true, visual: true, real: true, stats: true,
    combinadas: true, modoReal: "azar", pvNivel3: "no", barraPV: 0, atributoN1: "azar" };
  // prob: de que un movimiento dispare una anomalía; cada: segundos (de media) entre eventos sueltos
  const FREC = { baja: { prob: 0.12, cada: 240, nombre: "Baja" }, media: { prob: 0.25, cada: 120, nombre: "Media" }, alta: { prob: 0.45, cada: 60, nombre: "Alta" }, caotica: { prob: 0.7, cada: 25, nombre: "Caótica" } };
  const ATR = ["fue", "des", "con", "int", "sab", "car"];
  const NOMBRE_ATR = { fue: "Fuerza", des: "Destreza", con: "Constitución", int: "Inteligencia", sab: "Sabiduría", car: "Carisma" };
  const COLUMNAS = ["id", "escena", "capa", "tipo", "x", "y", "ancho", "alto", "rot", "z", "opacidad", "bloqueado", "controladores", "controlan_todos", "autor", "datos"];
  const TERRENO = new Set(["mapa", "luz", "delantero"]);

  function cfg() { const e = TB && TB.escena(); return Object.assign({}, CFG_DEF, e && e.opciones && e.opciones.grieta); }
  const encendida = () => dentro && TB.esGM() && cfg().activa && !cfg().pausada;
  async function guardarCfg(cambios) {
    const e = TB.escena();
    if (!e) return;
    await TB.guardarEscena(e.id, { opciones: Object.assign({}, e.opciones, { grieta: Object.assign({}, cfg(), cambios) }) });
  }
  const azar = (a, b) => a + Math.random() * (b - a);
  const entero = n => Math.floor(Math.random() * n);
  const elegir = l => l[entero(l.length)];
  function barajar(l) { for (let i = l.length - 1; i > 0; i--) { const j = entero(i + 1); [l[i], l[j]] = [l[j], l[i]]; } return l; }
  function ponderado(pesos) {
    const l = Object.entries(pesos).filter(([, p]) => p > 0);
    let t = Math.random() * l.reduce((s, [, p]) => s + p, 0);
    for (const [k, p] of l) { t -= p; if (t <= 0) return k; }
    return l.length ? l[l.length - 1][0] : null;
  }
  function semillado(s) { let a = s >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const copia = o => JSON.parse(JSON.stringify(o));
  const fila = o => { const f = {}; COLUMNAS.forEach(k => { if (o[k] !== undefined) f[k] = o[k]; }); return f; };
  const norm360 = r => Math.round((((r % 360) + 360) % 360) * 100) / 100;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const celda = () => TB.L.tamCelda();
  const pagina = () => TB.L.pagina();
  const esToken = o => !!o && o.tipo === "imagen" && (o.capa === "fichas" || o.capa === "gm");
  const nombreDe = o => (o && o.datos && o.datos.nombre) || "una ficha";
  const radio = o => Math.min(o.ancho, o.alto) / 2;

  // Esperas que se cortan al salir de la página (la promesa se resuelve igual y quien espera ve que gen cambió)
  const esperas = new Set();
  function esperar(ms) { return new Promise(res => { const t = { res, id: setTimeout(() => { esperas.delete(t); res(); }, ms) }; esperas.add(t); }); }
  function cortarEsperas() { esperas.forEach(t => { clearTimeout(t.id); t.res(); }); esperas.clear(); }

  let cola = Promise.resolve();
  function encolar(f) {
    const g0 = gen;
    const p = cola.then(() => (g0 === gen ? f() : null)).catch(e => { console.error("[grieta]", e); if (TB.esGM()) aviso("La Grieta: " + mensajeError(e), true); });
    cola = p;
    return p;
  }

  /* ============================================================ efectos visuales (en todas las pantallas) */
  const VFX = (() => {
    let velo = null, g = null, temblorReloj = null, colaV = Promise.resolve(), enEspera = 0;
    function asegurar() {
      const c = TB.L.contenedor, r = Math.min(window.devicePixelRatio || 1, 1.5);
      if (!velo || !velo.isConnected) { velo = document.createElement("canvas"); velo.className = "tb-grieta-velo"; c.appendChild(velo); g = velo.getContext("2d"); }
      const W = Math.max(1, Math.round(c.clientWidth * r)), H = Math.max(1, Math.round(c.clientHeight * r));
      if (velo.width !== W || velo.height !== H) { velo.width = W; velo.height = H; }
      velo.style.width = c.clientWidth + "px"; velo.style.height = c.clientHeight + "px";
      return { W, H, r };
    }
    function colorTablero() { const s = TB.L.contenedor.style.background || ""; const m = s.match(/#[0-9a-f]{3,8}|rgba?\([^)]*\)/i); return m ? m[0] : "#3d4048"; }
    // Lo que se ve ahora mismo, en un lienzo del tamaño de la pantalla
    function foto() {
      const { W, H } = asegurar();
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const x = c.getContext("2d");
      x.fillStyle = colorTablero(); x.fillRect(0, 0, W, H);
      TB.L.stage.getLayers().forEach(l => { if (!l.isVisible()) return; try { x.drawImage(l.getNativeCanvasElement(), 0, 0, W, H); } catch (e) { /* nada */ } });
      return c;
    }
    // Canal rojo y canal cian (sumados dan la imagen): separados, la aberración cromática
    function canales(src) {
      const w = Math.max(1, Math.round(src.width / 2)), h = Math.max(1, Math.round(src.height / 2));
      return ["#ff0000", "#00ffff"].map(col => {
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const x = c.getContext("2d"); x.drawImage(src, 0, 0, w, h);
        x.globalCompositeOperation = "multiply"; x.fillStyle = col; x.fillRect(0, 0, w, h);
        return c;
      });
    }
    function animar(dur, pintar) {
      return new Promise(res => {
        if (document.hidden || !dentro) { res(); return; }
        const { W, H, r } = asegurar();
        const t0 = performance.now(), g0 = gen;
        let ultimo = -1e9;
        const paso = ahora => {
          if (g0 !== gen || !velo) { limpiarVelo(); res(); return; }
          const f = Math.min(1, (ahora - t0) / dur);
          if (ahora - ultimo >= 33 || f >= 1) {
            ultimo = ahora;
            g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
            g.clearRect(0, 0, W, H);
            if (f < 1) { g.save(); try { pintar(g, f, W, H, r); } catch (e) { console.warn("[grieta] efecto", e); } g.restore(); }
          }
          if (f < 1) requestAnimationFrame(paso); else { g.clearRect(0, 0, W, H); res(); }
        };
        requestAnimationFrame(paso);
      });
    }
    function limpiarVelo() { if (g && velo) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, velo.width, velo.height); } }
    function temblor(dur, fuerza) {
      const capa = TB.L.contenedor.querySelector(".konvajs-content");
      if (!capa || document.hidden) return Promise.resolve();
      return new Promise(res => {
        clearInterval(temblorReloj);
        const t0 = performance.now(), g0 = gen;
        temblorReloj = setInterval(() => {
          const f = (performance.now() - t0) / dur;
          if (f >= 1 || g0 !== gen) { clearInterval(temblorReloj); temblorReloj = null; capa.style.transform = ""; if (velo) velo.style.transform = ""; res(); return; }
          const a = fuerza * (1 - f * 0.7);
          const tr = `translate(${Math.round((Math.random() - 0.5) * 2 * a)}px, ${Math.round((Math.random() - 0.5) * 2 * a)}px)`;
          capa.style.transform = tr; if (velo) velo.style.transform = tr;
        }, 40);
      });
    }
    // Rectángulo en pantalla (píxeles del velo) de un objeto o punto del mundo, con margen
    function zona(o, margen, r) {
      const w = o.ancho || celda(), h = o.alto || celda();
      const a = TB.L.aPantalla({ x: o.x - w / 2, y: o.y - h / 2 }), b = TB.L.aPantalla({ x: o.x + w / 2, y: o.y + h / 2 });
      const m = margen * Math.max(8, b.x - a.x);
      return [(Math.min(a.x, b.x) - m) * r, (Math.min(a.y, b.y) - m) * r, (Math.abs(b.x - a.x) + 2 * m) * r, (Math.abs(b.y - a.y) + 2 * m) * r];
    }

    /* Cada efecto: (foto, parámetros) → función que pinta un fotograma (g, f de 0 a 1, ancho, alto, escala) */
    const EF = {
      // Fotograma retenido con franjas desplazadas: un salto de imagen
      corte(img, p) {
        return (g, f, W, H) => {
          g.drawImage(img, 0, 0);
          const rr = semillado(p.semilla + Math.floor(f * 7) * 977);
          const n = 3 + Math.floor(rr() * 6);
          for (let i = 0; i < n; i++) {
            const y = rr() * H, h = (0.01 + rr() * 0.07) * H, dx = (rr() - 0.5) * W * 0.12;
            g.drawImage(img, 0, y, W, h, dx, y, W, h);
          }
          g.globalCompositeOperation = "screen";
          for (let i = 0; i < 3; i++) { g.fillStyle = rr() < 0.5 ? "rgba(255,0,70,.35)" : "rgba(0,230,255,.3)"; g.fillRect(0, rr() * H, W, 1 + rr() * 4); }
        };
      },
      onda(img, p) {
        return (g, f, W, H, r) => {
          const A = (p.amp || 0.025) * W * Math.sin(Math.PI * f), banda = Math.max(2, Math.round(3 * r));
          for (let y = 0; y < H; y += banda) g.drawImage(img, 0, y, W, banda, A * Math.sin(y / H * (p.ondas || 5) * Math.PI * 2 + f * 16), y, W, banda);
        };
      },
      fragmentos(img, p) {
        const rr = semillado(p.semilla), gx = p.gx || 6, gy = p.gy || 4, vec = [];
        for (let i = 0; i < gx * gy; i++) vec.push([rr() - 0.5, rr() - 0.5, rr() - 0.5]);
        return (g, f, W, H) => {
          const e = Math.sin(Math.PI * f);
          g.fillStyle = "#07070a"; g.fillRect(0, 0, W, H);
          const tw = W / gx, th = H / gy;
          for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
            const v = vec[j * gx + i];
            g.save(); g.translate(i * tw + tw / 2 + v[0] * tw * 0.6 * e, j * th + th / 2 + v[1] * th * 0.6 * e); g.rotate(v[2] * 0.35 * e);
            g.drawImage(img, i * tw, j * th, tw, th, -tw / 2, -th / 2, tw, th); g.restore();
          }
        };
      },
      // Giro, volteo o escala que parpadean: la imagen entera, a saltos
      giro(img, p) {
        return (g, f, W, H) => {
          const on = f < 0.3 || (f > 0.45 && f < 0.76) || (f > 0.87 && f < 0.93);
          if (!on) return;
          g.fillStyle = colorTablero(); g.fillRect(0, 0, W, H);
          g.translate(W / 2, H / 2);
          g.rotate((p.ang || 0) * Math.PI / 180);
          const k = (p.ang || 0) % 180 ? Math.max(W / H, H / W) : 1, s = k * (p.escala || 1);
          g.scale(s * (p.voltear === "h" ? -1 : 1), s * (p.voltear === "v" ? -1 : 1));
          g.drawImage(img, -W / 2, -H / 2);
        };
      },
      escala(img, p) {
        return (g, f, W, H) => {
          const s = 1 + (p.k || 0.12) * Math.sin(Math.PI * f) * (f < 0.55 ? 1 : -0.5);
          g.fillStyle = "#07070a"; g.fillRect(0, 0, W, H);
          g.translate(W / 2, H / 2); g.scale(s, s); g.drawImage(img, -W / 2, -H / 2);
        };
      },
      // Aberración cromática y bloques: en unas zonas (las fichas tocadas) o en toda la pantalla
      aberracion(img, p) {
        const [cr, cc] = canales(img);
        return (g, f, W, H) => {
          const d = (p.fuerza || 10) * Math.sin(Math.PI * f) * (0.5 + 0.5 * Math.abs(Math.sin(f * 37)));
          const rr = semillado(p.semilla + Math.floor(f * 9) * 131);
          (p.zonas || [[0, 0, W, H]]).forEach(([x, y, w, h]) => {
            g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
            g.fillStyle = "#000"; g.fillRect(x, y, w, h);
            g.globalCompositeOperation = "lighter";
            g.drawImage(cr, d, d * 0.2, W, H); g.drawImage(cc, -d, -d * 0.2, W, H);
            g.globalCompositeOperation = "source-over";
            for (let i = 0; i < 4; i++) {
              const by = y + rr() * h, bh = Math.max(2, rr() * h * 0.18), dx = (rr() - 0.5) * w * 0.35;
              g.drawImage(img, x, by, w, bh, x + dx, by, w, bh);
            }
            g.restore();
          });
        };
      },
      // El mapa se rompe, por debajo cambia y se recompone con lo nuevo
      transicion(img, p) {
        let nueva = null, romper = EF.fragmentos(img, p), unir = null;
        return (g, f, W, H, r) => {
          if (f < 0.5) { romper(g, f, W, H, r); return; }
          if (!nueva) { nueva = foto(); unir = EF.fragmentos(nueva, Object.assign({}, p, { semilla: p.semilla + 7 })); }
          unir(g, f, W, H, r);
          if (f < 0.6) EF.corte(nueva, p)(g, f, W, H, r);
        };
      }
    };
    function enColaVisual(f) {
      enEspera++;
      const p = colaV.then(() => f(enEspera > 3)).catch(e => console.warn("[grieta]", e)).then(() => { enEspera--; });
      colaV = p;
      return p;
    }
    function limpiar() {
      clearInterval(temblorReloj); temblorReloj = null;
      const capa = TB && TB.L && TB.L.contenedor.querySelector(".konvajs-content");
      if (capa) capa.style.transform = "";
      if (velo) { velo.remove(); velo = null; g = null; }
      colaV = Promise.resolve(); enEspera = 0;
    }
    return { foto, animar, temblor, zona, EF, enColaVisual, limpiar, asegurar };
  })();

  // Lo que llega por el canal (y lo que el DJ se reproduce a sí mismo)
  function reproducir(d) {
    if (!dentro || !d) return Promise.resolve();
    return VFX.enColaVisual(async rapido => {
      const k = rapido ? 0.35 : 1;
      const sem = d.semilla || 1;
      if (d.tipo === "salto") {
        const r = VFX.asegurar().r;
        const antes = VFX.foto();
        const zonas = [];
        (d.cambios || []).forEach(c => { const o = TB.L.objeto(c.id); if (o) { zonas.push(VFX.zona(o, 0.6, r)); zonas.push(VFX.zona(Object.assign({}, o, { x: c.x, y: c.y }), 0.6, r)); } });
        if (d.temblor) VFX.temblor(380 * k, 9);
        await VFX.animar((d.retener || 130) * k, VFX.EF.corte(antes, { semilla: sem }));
        aplicarCambios(d.cambios);
        TB.L.stage.draw();
        await VFX.animar(260 * k, VFX.EF.aberracion(VFX.foto(), { semilla: sem, zonas, fuerza: 9 }));
        return;
      }
      if (d.tipo === "mapa") {
        const antes = VFX.foto();
        if (d.temblor !== false) VFX.temblor(700 * k, 11);
        await VFX.animar((d.dur || 1500) * k, VFX.EF.transicion(antes, { semilla: sem, gx: d.gx || 7, gy: d.gy || 5 }));
        return;
      }
      if (d.tipo === "stats") {
        const r = VFX.asegurar().r;
        const zonas = (d.objetos || []).map(id => TB.L.objeto(id)).filter(Boolean).map(o => VFX.zona(o, 0.35, r));
        const img = VFX.foto();
        await VFX.animar(110 * k, VFX.EF.corte(img, { semilla: sem }));
        await VFX.animar(520 * k, VFX.EF.aberracion(img, { semilla: sem, zonas: zonas.length ? zonas : undefined, fuerza: 12 }));
        if (window.TBTiradas && TBTiradas.refrescar) TBTiradas.refrescar();
        if (TB.esGM()) TB.refrescarPV();
        return;
      }
      if (d.tipo === "fx") {
        for (const e of d.efectos || []) {
          const dur = (e.dur || 600) * k;
          if (e.n === "temblor") { await VFX.temblor(dur, e.fuerza || 10); continue; }
          const img = VFX.foto();
          const p = Object.assign({ semilla: sem }, e);
          const pintor = VFX.EF[e.n] ? VFX.EF[e.n](img, p) : null;
          if (pintor) await VFX.animar(dur, pintor);
        }
      }
    });
  }
  function aplicarCambios(cambios) {
    (cambios || []).forEach(c => { if (!TB.L.forzarPos(c.id, c.x, c.y)) { const o = TB.L.objeto(c.id); if (o) TB.L.upsert(Object.assign({}, o, { x: c.x, y: c.y })); } });
  }
  function emitir(d) {
    const datos = Object.assign({ escena: TB.escenaId, semilla: 1 + entero(1e9), de: TB.yo.uid }, d);
    TB.red.emitir("grieta", datos);
    return reproducir(datos);
  }

  /* ============================================================ geometría: dónde puede quedar una ficha */
  function distSeg(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }
  function enPoligono(p, pts) {
    let dentroP = false;
    for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
      const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
      if ((yi > p.y) !== (yj > p.y) && p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi) dentroP = !dentroP;
    }
    return dentroP;
  }
  // La niebla tapa ese punto (como la dibuja el lienzo: la base y luego cada zona en orden)
  function bajoNiebla(p, n) {
    let visible = (n.base || "oculta") !== "oculta";
    (n.zonas || []).forEach(z => { if (z.puntos && z.puntos.length >= 6 && enPoligono(p, z.puntos)) visible = z.modo !== "ocultar"; });
    return !visible;
  }
  // El estado contra el que se comprueba: objetos (con lo ya planeado), muros, niebla y tamaño de página
  function contexto({ objetos, pag, niebla, ignorar } = {}) {
    const objs = objetos || TB.L.objetos();
    const e = TB.escena();
    const nb = niebla !== undefined ? niebla : e && e.niebla;
    return { objs, segs: window.TBLuz ? TBLuz.segmentosDe(objs).paso : [], niebla: nb && nb.activa ? nb : null, pag: pag || pagina(),
      ignorar: new Set(ignorar || []), plan: new Map() };
  }
  const posEn = (cx, q) => cx.plan.get(q.id) || q;
  function valido(o, x, y, cx) {
    const P = cx.pag, w = o.ancho, h = o.alto;
    if (x - w / 2 < -0.5 || y - h / 2 < -0.5 || x + w / 2 > P.w + 0.5 || y + h / 2 > P.h + 0.5) return false;
    const p = { x, y }, r = radio(o) * 0.85;
    for (const s of cx.segs) if (distSeg(p, s[0], s[1]) < r) return false;
    if (cx.niebla && bajoNiebla(p, cx.niebla)) return false;
    for (const q of cx.objs) {
      if (!esToken(q) || q.id === o.id || cx.ignorar.has(q.id)) continue;
      const pq = posEn(cx, q);
      if (Math.hypot(pq.x - x, pq.y - y) < (radio(q) + radio(o)) * 0.8) return false;
    }
    return true;
  }
  function encajar(o, x, y, P) {
    P = P || pagina();
    const p = TB.L.ajustarPos(o, Math.max(o.ancho / 2, Math.min(P.w - o.ancho / 2, x)), Math.max(o.alto / 2, Math.min(P.h - o.alto / 2, y)));
    return { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 };
  }
  // El sitio válido más cercano a (x, y), buscando en anillos de casillas
  function buscarValido(o, x, y, cx, maxCeldas = 6) {
    const t = celda(), p0 = encajar(o, x, y, cx.pag);
    if (valido(o, p0.x, p0.y, cx)) return p0;
    for (let r = 1; r <= maxCeldas; r++) {
      const cand = [];
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) if (Math.max(Math.abs(i), Math.abs(j)) === r) cand.push([i, j]);
      barajar(cand).sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
      for (const [i, j] of cand) { const p = encajar(o, x + i * t, y + j * t, cx.pag); if (valido(o, p.x, p.y, cx)) return p; }
    }
    return null;
  }

  /* ============================================================ registro (en este navegador del DJ) */
  const claveReg = () => "tbGrieta:registro:" + escenaId;
  const claveBase = () => "tbGrieta:base:" + escenaId;
  function leerReg() { try { return JSON.parse(localStorage.getItem(claveReg()) || "[]"); } catch (e) { return []; } }
  function guardarReg(l) { try { localStorage.setItem(claveReg(), JSON.stringify(l.slice(-80))); } catch (e) { /* sin espacio: se pierde lo más viejo */ } }
  function apuntar(entrada) {
    if (!entrada || !entrada.ops) return;
    const l = leerReg();
    l.push(Object.assign({ id: Date.now().toString(36) + entero(1e6).toString(36), t: Date.now(), deshecho: false }, entrada));
    guardarReg(l);
    pintarPanel();
  }
  function leerBase() { try { return JSON.parse(localStorage.getItem(claveBase()) || "null"); } catch (e) { return null; } }
  function guardarBase(b) { try { if (b) localStorage.setItem(claveBase(), JSON.stringify(b)); else localStorage.removeItem(claveBase()); } catch (e) { /* nada */ } }
  // Antes del primer cambio real del mapa: cómo era todo (para recomponer)
  function tomarBase() {
    if (leerBase()) return;
    const e = TB.escena();
    guardarBase({ t: Date.now(), escena: { ancho: e.ancho, alto: e.alto, niebla: e.niebla || null }, objetos: TB.L.objetos().map(o => fila(copia(o))), tras: {} });
  }
  // Tras cada cambio real: dónde quedó cada ficha (si nadie la mueve, al recomponer vuelve con el mapa)
  function apuntarTras() {
    const b = leerBase();
    if (!b) return;
    b.tras = {};
    TB.L.objetos().forEach(o => { if (esToken(o)) b.tras[o.id] = { x: o.x, y: o.y }; });
    guardarBase(b);
  }

  /* ============================================================ movimiento */
  async function saltar(cambios, extra) {
    cambios = cambios.filter(c => TB.L.objeto(c.id));
    if (!cambios.length) return null;
    const ops = cambios.map(c => { const o = TB.L.objeto(c.id); return { op: "pos", id: c.id, antes: { x: o.x, y: o.y }, despues: { x: c.x, y: c.y } }; });
    cambios.forEach(c => TB.guardarPosicion(c.id, c.x, c.y));
    await emitir(Object.assign({ tipo: "salto", cambios, retener: azar(90, 190), temblor: Math.random() < 0.3 * cfg().intensidad }, extra));
    aplicarCambios(cambios.filter(c => { const o = TB.L.objeto(c.id); return o && dist(o, c) > 0.5; }));   // por si el efecto no llegó a verse
    return ops;
  }
  const otrasFichas = o => TB.L.objetos().filter(q => q.tipo === "imagen" && q.capa === "fichas" && q.id !== o.id);
  const recientes = new Map();   // id -> momento en que se movió (para los intercambios de las que se mueven a la vez)
  // Cada tipo devuelve los cambios [{id, x, y}] o null si no encontró un destino válido
  const MOVS = {
    cerca: { nombre: "Aparece cerca", f(o, d, cx, I) {
      const t = celda();
      for (let k = 0; k < 24; k++) {
        const a = Math.random() * Math.PI * 2, r = azar(t, t * (1.5 + I));
        const p = buscarValido(o, d.hasta.x + Math.cos(a) * r, d.hasta.y + Math.sin(a) * r, cx, 1);
        if (p && dist(p, d.hasta) > t * 0.6) return [{ id: o.id, x: p.x, y: p.y }];
      }
      return null;
    } },
    lejos: { nombre: "Aparece lejos", f(o, d, cx) {
      const t = celda(), P = cx.pag;
      for (let k = 0; k < 50; k++) {
        const x = azar(o.ancho / 2, P.w - o.ancho / 2), y = azar(o.alto / 2, P.h - o.alto / 2);
        if (Math.hypot(x - d.hasta.x, y - d.hasta.y) < Math.min(8 * t, Math.max(P.w, P.h) * 0.4)) continue;
        const p = buscarValido(o, x, y, cx, 1);
        if (p) return [{ id: o.id, x: p.x, y: p.y }];
      }
      return null;
    } },
    opuesta: { nombre: "Sale en la dirección opuesta", f(o, d, cx) {
      const desde = d.desde || d.hasta, dx = d.hasta.x - desde.x, dy = d.hasta.y - desde.y;
      const P = cx.pag;
      const x = Math.hypot(dx, dy) < celda() * 0.5 ? P.w - d.hasta.x : desde.x - dx, y = Math.hypot(dx, dy) < celda() * 0.5 ? P.h - d.hasta.y : desde.y - dy;
      const p = buscarValido(o, x, y, cx, 4);
      return p && dist(p, d.hasta) > celda() * 0.6 ? [{ id: o.id, x: p.x, y: p.y }] : null;
    } },
    espejo: { nombre: "Aparece en el reflejo de la página", f(o, d, cx) {
      const P = cx.pag, p = buscarValido(o, P.w - d.hasta.x, P.h - d.hasta.y, cx, 4);
      return p && dist(p, d.hasta) > celda() * 0.6 ? [{ id: o.id, x: p.x, y: p.y }] : null;
    } },
    detras: { nombre: "Aparece detrás de otra ficha", f(o, d, cx) {
      const desde = d.desde || d.hasta, t = celda();
      const otras = otrasFichas(o).map(q => Object.assign({}, q, posEn(cx, q))).sort((a, b) => dist(a, d.hasta) - dist(b, d.hasta)).slice(0, 5);
      for (const q of otras) {
        let vx = q.x - desde.x, vy = q.y - desde.y, l = Math.hypot(vx, vy);
        if (l < 1) { const a = Math.random() * Math.PI * 2; vx = Math.cos(a); vy = Math.sin(a); l = 1; }
        const sep = radio(q) + radio(o) + t * 0.5;
        const p = buscarValido(o, q.x + vx / l * sep, q.y + vy / l * sep, cx, 1);
        if (p && dist(p, q) < radio(q) + radio(o) + t * 1.7) return [{ id: o.id, x: p.x, y: p.y }];
      }
      return null;
    } },
    intercambio: { nombre: "Cambia de sitio con otra ficha", f(o, d, cx) {
      const ahora = Date.now();
      // solo con fichas que no se mueven ya en este mismo evento
      const otras = otrasFichas(o).filter(q => !cx.plan.has(q.id));
      const aLaVez = otras.filter(q => ahora - (recientes.get(q.id) || 0) < 3000);
      for (const q of aLaVez.concat(barajar(otras.filter(x => !aLaVez.includes(x)))).slice(0, 8)) {
        const c1 = Object.assign({}, cx, { ignorar: new Set([q.id]) }), c2 = Object.assign({}, cx, { ignorar: new Set([o.id]) });
        const p1 = encajar(o, q.x, q.y, cx.pag), p2 = encajar(q, d.hasta.x, d.hasta.y, cx.pag);
        if (valido(o, p1.x, p1.y, c1) && valido(q, p2.x, p2.y, c2)) return [{ id: o.id, x: p1.x, y: p1.y }, { id: q.id, x: p2.x, y: p2.y }];
      }
      return null;
    } },
    rebote: { nombre: "Vuelve a donde estaba", f(o, d, cx) {
      if (!d.desde || dist(d.desde, d.hasta) < celda() * 0.6) return null;
      const p = buscarValido(o, d.desde.x, d.desde.y, cx, 2);
      return p ? [{ id: o.id, x: p.x, y: p.y }] : null;
    } }
  };
  function pesosMov(I, hayALaVez) {
    const base = I === 1 ? { cerca: 5, rebote: 2, opuesta: 2, detras: 2, intercambio: 1, lejos: 1, espejo: 0 }
      : I === 2 ? { cerca: 3, rebote: 2, opuesta: 3, detras: 3, intercambio: 3, lejos: 2, espejo: 1 }
        : { cerca: 2, rebote: 1, opuesta: 3, detras: 3, intercambio: 4, lejos: 3, espejo: 2 };
    if (hayALaVez) base.intercambio *= 4;
    return base;
  }
  // Plan para una ficha: el tipo pedido o uno al azar (si no hay destino válido se prueba otro)
  function planMovimiento(o, d, tipo, cx) {
    const I = cfg().intensidad;
    const ahora = Date.now(), hayALaVez = otrasFichas(o).some(q => ahora - (recientes.get(q.id) || 0) < 3000);
    const probados = new Set();
    for (let k = 0; k < 4; k++) {
      const t = tipo && k === 0 ? tipo : ponderado(Object.fromEntries(Object.entries(pesosMov(I, hayALaVez)).filter(([x]) => !probados.has(x))));
      if (!t) break;
      probados.add(t);
      const cambios = MOVS[t].f(o, d, cx, I);
      if (cambios) return { tipo: t, cambios };
      if (tipo) break;
    }
    return null;
  }
  async function anomaliaMovimiento(ids, tipo, motivo) {
    const cx = contexto();
    if (tipo === "intercambio" && !motivo && ids && ids.length >= 2) {
      const fichas = ids.map(id => TB.L.objeto(id)).filter(esToken);
      if (fichas.length >= 2) {
        const todos = new Set(fichas.map(f => f.id));
        const cambios = fichas.map((f, i) => {
          const sig = fichas[(i + 1) % fichas.length];
          const p = buscarValido(f, sig.x, sig.y, Object.assign({}, cx, { ignorar: todos }), 3) || encajar(f, sig.x, sig.y, cx.pag);
          return { id: f.id, x: p.x, y: p.y };
        });
        const ops = await saltar(cambios);
        const det = fichas.length === 2 ? `${nombreDe(fichas[0])} y ${nombreDe(fichas[1])} cambian de sitio` : fichas.map((f, i) => `${nombreDe(f)} → sitio de ${nombreDe(fichas[(i + 1) % fichas.length])}`).join("\n");
        return ops ? { clase: "mov", titulo: "Intercambio", detalle: det, ops } : null;
      }
    }
    const todos = [], lineas = [];
    let titulo = null;
    for (const id of ids) {
      const o = TB.L.objeto(id);
      if (!o || !esToken(o) || cx.plan.has(id)) continue;
      const d = motivo && motivo.id === id ? motivo : { desde: { x: o.x, y: o.y }, hasta: { x: o.x, y: o.y } };
      const plan = planMovimiento(o, d, tipo, cx);
      if (!plan) continue;
      plan.cambios.forEach(c => { cx.plan.set(c.id, { x: c.x, y: c.y }); todos.push(c); });
      titulo = titulo || MOVS[plan.tipo].nombre;
      lineas.push(plan.tipo === "intercambio" ? `${nombreDe(o)} y ${nombreDe(TB.L.objeto(plan.cambios[1].id))} cambian de sitio` : `${nombreDe(o)}: ${MOVS[plan.tipo].nombre.toLowerCase()}`);
    }
    if (!todos.length) return null;
    const ops = await saltar(todos);
    return ops ? { clase: "mov", titulo: !tipo && lineas.length > 1 ? "Deriva de fichas" : titulo + (lineas.length > 1 ? ` (${lineas.length} fichas)` : ""), detalle: lineas.join("\n"), ops } : null;
  }

  // Un movimiento normal (del DJ o de un jugador) que puede torcerse
  const pendientesMov = new Map();
  function alMoverse(d) {
    if (!encendida() || !cfg().mov || !d || !d.id) return;
    const o = TB.L.objeto(d.id);
    if (!o || o.tipo !== "imagen" || o.capa !== "fichas") return;
    recientes.set(d.id, Date.now());
    // Con las flechas llegan muchos pasos: se espera a que la ficha se quede quieta
    const prev = pendientesMov.get(d.id);
    if (prev) clearTimeout(prev.reloj);
    const p = { desde: prev ? prev.desde : d.desde, hasta: d.hasta };
    p.reloj = setTimeout(() => {
      pendientesMov.delete(d.id);
      if (!encendida() || Math.random() >= FREC[cfg().frecuencia].prob) return;
      const g0 = gen;
      encolar(async () => {
        await esperar(azar(120, 650));
        if (g0 !== gen) return;
        const ahora = TB.L.objeto(d.id);
        if (!ahora || dist(ahora, p.hasta) > 1) return;   // ya se movió otra vez
        apuntar(await anomaliaMovimiento([d.id], null, { id: d.id, desde: p.desde, hasta: p.hasta }));
      });
    }, d.teclas || !d.local ? 450 : 60);
    pendientesMov.set(d.id, p);
  }

  /* ============================================================ el mapa: cambios reales */
  const camposObj = o => ({ x: o.x, y: o.y, ancho: o.ancho, alto: o.alto, rot: o.rot || 0, datos: copia(o.datos || {}) });
  const piezas = () => TB.L.objetos().filter(o => o.capa === "mapa" && o.tipo === "imagen" && o.datos && o.datos.grietaPieza);
  function mapaPrincipal() {
    return TB.L.objetos().filter(o => o.capa === "mapa" && o.tipo === "imagen" && o.datos && o.datos.src && !o.datos.grietaPieza)
      .sort((a, b) => b.ancho * b.alto - a.ancho * a.alto)[0] || null;
  }
  // Un objeto transformado. T: { punto(p), rot(r), voltear: "h"|"v"|null, escala: k }. Las fichas solo cambian de sitio.
  function transformar(o, T, cuerpo) {
    const n = copia(o), c = T.punto({ x: o.x, y: o.y });
    n.x = Math.round(c.x * 100) / 100; n.y = Math.round(c.y * 100) / 100;
    if (!cuerpo) return n;
    n.rot = norm360(T.rot(o.rot || 0));
    const d = n.datos = Object.assign({}, n.datos);
    if (T.voltear && n.tipo === "imagen") { if (T.voltear === "h") d.voltearH = !d.voltearH; else d.voltearV = !d.voltearV; }
    if (T.voltear && n.tipo === "dibujo" && Array.isArray(d.puntos) && d.forma !== "rect" && d.forma !== "elipse") {
      d.puntos = d.puntos.map((v, i) => (T.voltear === "h" ? i % 2 === 0 : i % 2 === 1) ? (i % 2 === 0 ? n.ancho : n.alto) - v : v);
    }
    if (T.escala && T.escala !== 1) {
      n.ancho = Math.round(n.ancho * T.escala * 100) / 100; n.alto = Math.round(n.alto * T.escala * 100) / 100;
      if (Array.isArray(d.puntos)) d.puntos = d.puntos.map(v => Math.round(v * T.escala * 100) / 100);
    }
    return n;
  }
  function nieblaTransformada(T) {
    const n = TB.escena().niebla;
    if (!n || !Array.isArray(n.zonas) || !n.zonas.length) return null;
    return Object.assign({}, n, { zonas: n.zonas.map(z => { const p = z.puntos || [], q = []; for (let i = 0; i + 1 < p.length; i += 2) { const r = T.punto({ x: p[i], y: p[i + 1] }); q.push(Math.round(r.x), Math.round(r.y)); } return Object.assign({}, z, { puntos: q }); }) });
  }
  // Las fichas que quedaron en un sitio imposible se recolocan en el válido más cercano
  function validarFichas(finales, pag, niebla) {
    const lista = [...finales.values()];
    const cx = contexto({ objetos: lista, pag, niebla });
    const movidas = [];
    barajar(lista.filter(esToken)).forEach(o => {
      if (valido(o, o.x, o.y, cx)) return;
      const p = buscarValido(o, o.x, o.y, cx, 10);
      if (!p) return;
      const n = Object.assign({}, o, { x: p.x, y: p.y });
      finales.set(o.id, n); cx.plan.set(o.id, p); movidas.push(n);
    });
    // las que se apartaron, también en la lista del contexto para las siguientes
    return movidas;
  }
  /* Guarda en el servidor todo lo cambiado de la página (filas completas, escena, creados y borrados) y lo
     tapa con la transición en todas las pantallas */
  async function confirmarPagina({ cambiadas, escena, crear, borrar }, efecto) {
    const ops = [];
    (cambiadas || []).forEach(n => { const o = TB.L.objeto(n.id); if (o) ops.push({ op: "obj", id: n.id, antes: camposObj(o), despues: camposObj(n) }); });
    if (escena) { const e = TB.escena(), antes = {}; Object.keys(escena).forEach(k => { antes[k] = e[k] === undefined ? null : copia(e[k]); }); ops.push({ op: "escena", antes, despues: copia(escena) }); }
    const g0 = gen;
    emitir(Object.assign({ tipo: "mapa", dur: 1500 }, efecto));
    await esperar(160);
    if (g0 !== gen) return null;
    if (escena) await TB.guardarEscena(TB.escenaId, escena);
    if (borrar && borrar.length) {
      ops.push({ op: "borrar", filas: borrar.map(id => fila(copia(TB.L.objeto(id)))).filter(f => f.id) });
      borrar.forEach(id => TB.L.quitar(id));
      await TB.red.borrarObjetos(borrar);
    }
    if (crear && crear.length) {
      const creadas = await TB.red.crearObjetos(crear.map(fila));
      (creadas || []).forEach(o => TB.L.upsert(o));
      ops.push({ op: "crear", ids: (creadas || []).map(o => o.id) });
    }
    if (cambiadas && cambiadas.length) {
      cambiadas.forEach(n => TB.L.upsert(n));
      await TB.red.actualizarObjetos(cambiadas.map(fila));
    }
    apuntarTras();
    return ops;
  }
  function modoReal(pedido) { const m = pedido || cfg().modoReal; return m === "azar" ? (Math.random() < 0.5 ? "todo" : "terreno") : m; }
  // Giro, volteo o escala de toda la página (con las fichas encima o solo el terreno)
  async function transformarPagina(T, nuevaPag, modo, efecto) {
    tomarBase();
    const finales = new Map(TB.L.objetos().map(o => [o.id, o]));
    const cambiadas = new Map();
    TB.L.objetos().forEach(o => {
      const token = esToken(o);
      if (modo === "terreno" && !TERRENO.has(o.capa)) return;
      const n = transformar(o, T, !token && o.tipo !== "pin");
      finales.set(o.id, n); cambiadas.set(o.id, n);
    });
    const niebla = nieblaTransformada(T);
    const t = celda();
    const pag = nuevaPag ? { w: nuevaPag.ancho * t, h: nuevaPag.alto * t } : pagina();
    const e = TB.escena();
    validarFichas(finales, pag, niebla || (e.niebla && e.niebla.activa ? e.niebla : null)).forEach(n => cambiadas.set(n.id, n));
    const escena = Object.assign({}, nuevaPag || {}, niebla ? { niebla } : {});
    return confirmarPagina({ cambiadas: [...cambiadas.values()], escena: Object.keys(escena).length ? escena : null }, efecto);
  }
  const REAL = {
    rotar(ang, modo) {
      const P = pagina(), e = TB.escena(), giraLado = ang % 180 !== 0;
      const nueva = giraLado ? { ancho: e.alto, alto: e.ancho } : null;
      const t = celda(), Q = nueva ? { w: nueva.ancho * t, h: nueva.alto * t } : P;
      const a = ang * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      const T = { punto: p => { const x = p.x - P.w / 2, y = p.y - P.h / 2; return { x: Q.w / 2 + x * c - y * s, y: Q.h / 2 + x * s + y * c }; }, rot: r => r + ang };
      return transformarPagina(T, nueva, modo, { gx: 8, gy: 5 });
    },
    voltear(eje, modo) {
      const P = pagina();
      const T = { punto: p => (eje === "h" ? { x: P.w - p.x, y: p.y } : { x: p.x, y: P.h - p.y }), rot: r => -r, voltear: eje };
      return transformarPagina(T, null, modo, { gx: eje === "h" ? 10 : 4, gy: eje === "h" ? 3 : 8 });
    },
    escalar(k, modo) {
      const P = pagina();
      const T = { punto: p => ({ x: P.w / 2 + (p.x - P.w / 2) * k, y: P.h / 2 + (p.y - P.h / 2) * k }), rot: r => r, escala: k };
      return transformarPagina(T, null, modo, { gx: 6, gy: 6 });
    },
    // Partir el mapa en trozos (cada trozo es la misma imagen recortada; lleva el original para recomponerlo)
    async fragmentar(I) {
      const M = mapaPrincipal();
      if (!M || norm360(M.rot || 0) !== 0 || (M.datos && M.datos.recorte)) return null;
      tomarBase();
      const t = celda(), n = I === 1 ? 2 : I === 2 ? 3 : 4;
      const x0 = M.x - M.ancho / 2, y0 = M.y - M.alto / 2;
      const cortes = (largo, ini) => {
        const l = [0];
        for (let i = 1; i < n; i++) { const v = Math.round((ini + largo * i / n) / t) * t - ini; if (v > l[l.length - 1] + t * 0.5 && v < largo - t * 0.5) l.push(v); }
        l.push(largo);
        return l;
      };
      const cx = cortes(M.ancho, x0), cy = cortes(M.alto, y0), d = M.datos;
      const original = fila(copia(M)), filas = [];
      for (let j = 0; j + 1 < cy.length; j++) for (let i = 0; i + 1 < cx.length; i++) {
        const lx = cx[i], ly = cy[j], lw = cx[i + 1] - lx, lh = cy[j + 1] - ly;
        const fx = d.voltearH ? 1 - (lx + lw) / M.ancho : lx / M.ancho, fy = d.voltearV ? 1 - (ly + lh) / M.alto : ly / M.alto;
        filas.push(Object.assign(fila(copia(M)), { id: undefined, x: x0 + lx + lw / 2, y: y0 + ly + lh / 2, ancho: lw, alto: lh, rot: 0,
          datos: Object.assign({}, copia(d), { recorte: { x: fx, y: fy, w: lw / M.ancho, h: lh / M.alto }, grietaPieza: { origen: M.id, original, i, j } }) }));
      }
      filas.forEach(f => delete f.id);
      if (filas.length < 2) return null;
      return confirmarPagina({ crear: filas, borrar: [M.id] }, { gx: cx.length - 1, gy: cy.length - 1, dur: 1300 });
    },
    // Trozos que cambian de sitio (y alguno se da la vuelta); lo que hay encima de cada uno se va con él
    async desplazar(I, modo) {
      let previas = [];
      if (piezas().length < 2) { const r = await REAL.fragmentar(Math.max(2, I)); if (!r) return null; previas = r; await esperar(250); }
      tomarBase();
      const lista = piezas(), grupos = new Map();
      lista.forEach(p => { const k = Math.round(p.ancho) + "x" + Math.round(p.alto); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(p); });
      const destino = new Map();   // id de la pieza -> { x, y, giro }
      const usables = [...grupos.values()].filter(g => g.length >= 2);
      if (!usables.length) return previas.length ? previas : null;
      if (I >= 3) {
        usables.forEach(g => {
          const orden = barajar(g.slice());
          if (orden.every((p, i) => p === g[i])) orden.push(orden.shift());
          g.forEach((p, i) => destino.set(p.id, { x: orden[i].x, y: orden[i].y, giro: Math.random() < 0.3 ? 180 : 0 }));
        });
      } else {
        const veces = I === 1 ? 1 : 2 + entero(2);
        for (let v = 0; v < veces; v++) {
          const g = elegir(usables), libres = g.filter(p => !destino.has(p.id));
          if (libres.length < 2) continue;
          const [a, b] = barajar(libres.slice()).slice(0, 2);
          destino.set(a.id, { x: b.x, y: b.y, giro: I >= 2 && Math.random() < 0.25 ? 180 : 0 });
          destino.set(b.id, { x: a.x, y: a.y, giro: I >= 2 && Math.random() < 0.25 ? 180 : 0 });
        }
      }
      if (!destino.size) return previas.length ? previas : null;
      const objs = TB.L.objetos(), finales = new Map(objs.map(o => [o.id, o])), cambiadas = new Map();
      const dentroDe = (o, P, entero) => {
        const x0 = P.x - P.ancho / 2, y0 = P.y - P.alto / 2, x1 = x0 + P.ancho, y1 = y0 + P.alto;
        if (!entero) return o.x >= x0 && o.x < x1 && o.y >= y0 && o.y < y1;
        return o.x - o.ancho / 2 >= x0 - 0.5 && o.x + o.ancho / 2 <= x1 + 0.5 && o.y - o.alto / 2 >= y0 - 0.5 && o.y + o.alto / 2 <= y1 + 0.5;
      };
      lista.forEach(P => {
        const dst = destino.get(P.id);
        if (!dst) return;
        const a = dst.giro * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
        const T = { punto: p => ({ x: dst.x + (p.x - P.x) * c - (p.y - P.y) * s, y: dst.y + (p.x - P.x) * s + (p.y - P.y) * c }), rot: r => r + dst.giro };
        const n = transformar(P, T, true);
        finales.set(P.id, n); cambiadas.set(P.id, n);
        objs.forEach(o => {
          if (o.id === P.id || (o.datos && o.datos.grietaPieza) || cambiadas.has(o.id)) return;
          const token = esToken(o);
          if (token ? modo === "terreno" : !(TERRENO.has(o.capa) || modo === "todo")) return;
          if (!dentroDe(o, P, !token)) return;
          const m = transformar(o, T, !token && o.tipo !== "pin");
          finales.set(o.id, m); cambiadas.set(o.id, m);
        });
      });
      const e = TB.escena();
      validarFichas(finales, pagina(), e.niebla && e.niebla.activa ? e.niebla : null).forEach(n => cambiadas.set(n.id, n));
      const ops = await confirmarPagina({ cambiadas: [...cambiadas.values()] }, { gx: 7, gy: 6, dur: 1300 });
      return ops ? previas.concat(ops) : null;
    },
    // Todo vuelve a como era antes del primer cambio real (y las fichas que viajaron con el mapa, con él)
    async recomponer() {
      const base = leerBase();
      const trozos = piezas();
      if (!base && !trozos.length) return null;
      const origenes = new Map();
      trozos.forEach(p => { const g = p.datos.grietaPieza; if (g && g.original && !origenes.has(g.origen)) origenes.set(g.origen, g.original); });
      const crear = [...origenes.entries()].map(([id, orig]) => { const enBase = base && base.objetos.find(o => o.id === id); return copia(enBase || orig); })
        .filter(o => !TB.L.objeto(o.id));
      const cambiadas = new Map();
      let escena = null;
      if (base) {
        base.objetos.forEach(b => {
          const a = TB.L.objeto(b.id);
          if (!a || origenes.has(b.id)) return;
          if (esToken(a)) {
            const tras = base.tras && base.tras[a.id];
            if (tras && dist(a, tras) < 1 && dist(a, b) > 0.5) cambiadas.set(a.id, Object.assign(copia(a), { x: b.x, y: b.y }));
            return;
          }
          const ca = camposObj(a), cb = camposObj(b);
          if (JSON.stringify(ca) !== JSON.stringify(cb)) cambiadas.set(a.id, Object.assign(copia(a), cb));
        });
        const e = TB.escena();
        if (e.ancho !== base.escena.ancho || e.alto !== base.escena.alto) escena = { ancho: base.escena.ancho, alto: base.escena.alto };
        if (JSON.stringify(e.niebla || null) !== JSON.stringify(base.escena.niebla || null) && base.escena.niebla) escena = Object.assign(escena || {}, { niebla: base.escena.niebla });
      }
      const t = celda(), pag = escena && escena.ancho ? { w: escena.ancho * t, h: escena.alto * t } : pagina();
      const finales = new Map(TB.L.objetos().filter(o => !(o.datos && o.datos.grietaPieza)).map(o => [o.id, cambiadas.get(o.id) || o]));
      crear.forEach(o => finales.set(o.id, o));
      const e = TB.escena(), nb = (escena && escena.niebla) || e.niebla;
      validarFichas(finales, pag, nb && nb.activa ? nb : null).forEach(n => cambiadas.set(n.id, n));
      const ops = await confirmarPagina({ cambiadas: [...cambiadas.values()], escena, crear, borrar: trozos.map(p => p.id) }, { gx: 5, gy: 5, dur: 1300 });
      if (ops) guardarBase(null);
      return ops;
    }
  };

  /* ============================================================ estadísticas */
  function numero(v, def) { const n = parseFloat(String(v == null ? "" : v).replace(",", ".")); return Number.isFinite(n) ? n : def; }
  const modDe = v => Math.floor((Number(v) - 10) / 2);
  function personajeDe(data, id) {
    const p = fichasMigrar(Object.assign(copia(data), { id }));
    ["ataques", "hechizos", "rasgos", "macros", "favoritosRoll20"].forEach(k => { if (!Array.isArray(p[k])) p[k] = []; });
    return p;
  }
  // Quién puede participar: las fichas de la página con hoja del compendio y los enemigos con estadísticas
  async function participantes() {
    const lista = [], vistas = new Set();
    for (const o of TB.L.objetos()) {
      if (o.tipo !== "imagen" || o.capa !== "fichas") continue;
      const fid = TB.fichaDeObjeto(o);
      if (fid) {
        if (vistas.has(fid)) continue;
        vistas.add(fid);
        try {
          const f = await TB.red.fichaCompleta(fid);
          if (f && f.data) lista.push({ tipo: "ficha", id: fid, objeto: o.id, fila: f, pj: personajeDe(f.data, fid), nombre: (f.data.identidad && f.data.identidad.nombre) || nombreDe(o) });
        } catch (e) { /* esa ficha no se pudo leer: no participa */ }
        continue;
      }
      const s = window.TBTiradas && TBTiradas.estadisticasDe(o);
      if (s) lista.push({ tipo: "enemigo", id: o.id, objeto: o.id, base: s, ef: TBTiradas.estadisticasEfectivas(o), nombre: nombreDe(o) });
    }
    return lista;
  }
  const barraPV = () => Math.max(0, Math.min(2, cfg().barraPV | 0));
  // Las estadísticas de un participante en una forma común
  function leer(p) {
    if (p.tipo === "ficha") {
      const pj = p.pj, cb = pj.combate || {};
      return { atr: Object.assign({}, pj.atributos), aj: Object.assign({}, pj.ajustesAtributos || {}), ca: fichasCATotal(pj), vel: numero(cb.velocidad, 30),
        ini: fichasIniciativaTotal(pj), pv: { actual: numero(cb.pvActual, 0), max: numero(cb.pvMax, 0) } };
    }
    const s = p.ef, o = TB.L.objeto(p.objeto), b = ((o && o.datos && o.datos.barras) || [])[barraPV()] || {};
    return { atr: Object.assign({}, s.stats), aj: {}, ca: numero(s.ca, 10), vel: numero(s.velocidad, 30),
      ini: s.iniciativa !== undefined && Number.isFinite(parseInt(s.iniciativa, 10)) ? parseInt(s.iniciativa, 10) : modDe((s.stats || {}).des || 10),
      pv: { actual: numero(b.valor, numero(s.pv, 0)), max: numero(b.max, numero(s.pv, 0)) } };
  }
  // Lo que se le escribe a cada uno: { atr: {fue: 14...}, aj, ca, vel, ini, pv }
  function texto(v) { return v == null ? "—" : String(v); }
  async function escribir(p, nuevo, ops) {
    if (p.tipo === "ficha") {
      const data = copia(p.fila.data);
      data.combate = data.combate || {};
      const ant = { atributos: copia(data.atributos || {}), ajustesAtributos: copia(data.ajustesAtributos || {}), ca: copia(data.combate.ca || null),
        velocidad: data.combate.velocidad === undefined ? null : data.combate.velocidad, iniciativaAjuste: data.combate.iniciativaAjuste || 0, pvActual: data.combate.pvActual, pvMax: data.combate.pvMax };
      if (!data.grietaOriginal) data.grietaOriginal = { t: Date.now(), atributos: ant.atributos, ajustesAtributos: ant.ajustesAtributos, ca: ant.ca, velocidad: ant.velocidad, iniciativaAjuste: ant.iniciativaAjuste };
      if (nuevo.atr) Object.entries(nuevo.atr).forEach(([k, v]) => { data.atributos[k] = Math.max(1, Math.min(40, Math.round(v))); });
      if (nuevo.aj) data.ajustesAtributos = Object.assign({}, data.ajustesAtributos, nuevo.aj);
      if (nuevo.caRaw) data.combate.ca = copia(nuevo.caRaw);
      else if (nuevo.ca != null) data.combate.ca = Object.assign({}, data.combate.ca || {}, { modo: "manual", manual: Math.round(nuevo.ca) });
      if (nuevo.vel != null) data.combate.velocidad = typeof data.combate.velocidad === "string" ? String(data.combate.velocidad).replace(/\d+([.,]\d+)?/, String(nuevo.vel)) : nuevo.vel;
      if (nuevo.iniAj != null) data.combate.iniciativaAjuste = nuevo.iniAj;
      else if (nuevo.ini != null) data.combate.iniciativaAjuste = Math.round(nuevo.ini - (modDe(data.atributos.des) + Number((data.ajustesAtributos || {}).des || 0)));
      if (nuevo.pv) { data.combate.pvMax = Math.max(1, Math.round(nuevo.pv.max)); data.combate.pvActual = Math.max(0, Math.min(data.combate.pvMax, Math.round(nuevo.pv.actual))); }
      const des = { atributos: copia(data.atributos), ajustesAtributos: copia(data.ajustesAtributos || {}), ca: copia(data.combate.ca || null), velocidad: data.combate.velocidad, iniciativaAjuste: data.combate.iniciativaAjuste || 0, pvActual: data.combate.pvActual, pvMax: data.combate.pvMax };
      await guardarFicha(p.id, data);
      p.fila.data = data; p.pj = personajeDe(data, p.id);
      ops.push({ op: "ficha", id: p.id, nombre: p.nombre, antes: ant, despues: des });
      return;
    }
    const o = TB.L.objeto(p.objeto);
    if (!o) return;
    const datos = copia(o.datos || {});
    const antes = { grieta: datos.grieta ? copia(datos.grieta) : null, barra: copia((datos.barras || [])[barraPV()] || null) };
    const g = Object.assign({}, datos.grieta || {});
    if (nuevo.atr) g.stats = Object.assign({}, (g.stats || p.base.stats || {}), Object.fromEntries(Object.entries(nuevo.atr).map(([k, v]) => [k, Math.max(1, Math.min(40, Math.round(v)))])));
    if (nuevo.ca != null) g.ca = Math.round(nuevo.ca);
    if (nuevo.vel != null) g.velocidad = `${nuevo.vel} pies`;
    if (nuevo.ini != null) g.iniciativa = Math.round(nuevo.ini);
    datos.grieta = g;
    if (nuevo.pv) {
      const barras = (datos.barras || []).slice();
      while (barras.length <= barraPV()) barras.push({ valor: "", max: "", ver: true, editar: false, texto: "editores" });
      barras[barraPV()] = Object.assign({}, barras[barraPV()], { valor: Math.max(0, Math.round(nuevo.pv.actual)), max: Math.max(1, Math.round(nuevo.pv.max)) });
      datos.barras = barras;
    }
    const despues = { grieta: copia(datos.grieta), barra: copia((datos.barras || [])[barraPV()] || null) };
    TB.L.upsert(Object.assign({}, o, { datos }));
    await TB.red.actualizarObjeto(o.id, { datos });
    p.ef = TBTiradas.estadisticasEfectivas(TB.L.objeto(o.id));
    ops.push({ op: "enemigo", id: o.id, nombre: p.nombre, barra: barraPV(), antes, despues });
  }
  // Una ficha con data nueva: se recalculan sus tiradas con el generador de la hoja y se sube todo
  async function guardarFicha(id, data) {
    let roll20 = null;
    try { const pj = personajeDe(data, id); roll20 = pj.fallecido ? null : fichasPayloadRoll20(pj); } catch (e) { console.warn("[grieta] tiradas", e); }
    await TB.red.guardarFichaGrieta(id, data, roll20);
  }
  // El paquete completo de uno, listo para dárselo a otro (entre fichas se copia tal cual; con enemigos, convertido)
  function paquete(de, para) {
    const v = leer(de);
    if (de.tipo === "ficha" && para.tipo === "ficha") {
      const cb = de.pj.combate || {};
      return { atr: v.atr, aj: Object.fromEntries(ATR.map(k => [k, Number(v.aj[k] || 0)])), caRaw: copia(cb.ca || { modo: "manual", manual: v.ca }), vel: v.vel, iniAj: Number(cb.iniciativaAjuste || 0) };
    }
    if (de.tipo === "ficha") {
      // a un enemigo: la puntuación ya con el ajuste (+1 al modificador = +2 a la puntuación)
      return { atr: Object.fromEntries(ATR.map(k => [k, Number(v.atr[k] || 10) + 2 * Number(v.aj[k] || 0)])), ca: v.ca, vel: v.vel, ini: v.ini };
    }
    return para.tipo === "ficha"
      ? { atr: v.atr, aj: Object.fromEntries(ATR.map(k => [k, 0])), ca: v.ca, vel: v.vel, ini: v.ini }
      : { atr: v.atr, ca: v.ca, vel: v.vel, ini: v.ini };
  }
  const corto = { fue: "FUE", des: "DES", con: "CON", int: "INT", sab: "SAB", car: "CAR" };
  async function anomaliaStats(nivel, opciones = {}) {
    const todos = await participantes();
    if (todos.length < 2 && !(opciones.ids && opciones.ids.length >= 2)) return null;
    const I = cfg().intensidad, ops = [], lineas = [];
    let elegidos = barajar(todos.slice()), dirigido = false;
    if (opciones.ids && opciones.ids.length >= 2) {
      const sel = [];
      opciones.ids.forEach(id => {
        const o = TB.L.objeto(id), fid = o && TB.fichaDeObjeto(o);
        const p = todos.find(q => q.objeto === id || (fid && q.tipo === "ficha" && q.id === fid));
        if (p && !sel.includes(p)) sel.push(p);
      });
      if (sel.length >= 2) { elegidos = sel; dirigido = true; }
      else {
        const sin = opciones.ids.map(id => TB.L.objeto(id)).filter(o => o && !todos.some(q => q.objeto === o.id || (q.tipo === "ficha" && q.id === TB.fichaDeObjeto(o)))).map(nombreDe);
        return { error: `No se puede: ${sin.join(", ") || "las fichas seleccionadas"} no ${sin.length === 1 ? "tiene" : "tienen"} estadísticas. Hace falta una hoja del compendio enlazada, el nombre exacto de unas estadísticas o estadísticas propias (y estar en la capa de fichas).` };
      }
    }
    const fija = opciones.atributo || (cfg().atributoN1 !== "azar" ? cfg().atributoN1 : null);
    if (nivel === 1) {
      // una pareja y un atributo en el que de verdad sean distintos
      const cand = [];
      for (let i = 0; i < elegidos.length; i++) for (let j = i + 1; j < elegidos.length; j++) {
        const ai = leer(elegidos[i]).atr, aj = leer(elegidos[j]).atr;
        ATR.forEach(k => { if ((!fija || k === fija) && Number(ai[k]) !== Number(aj[k])) cand.push([elegidos[i], elegidos[j], k, ai[k], aj[k]]); });
      }
      if (!cand.length) return null;
      const [a, b, k, va, vb] = elegir(cand);
      await escribir(a, { atr: { [k]: vb } }, ops); await escribir(b, { atr: { [k]: va } }, ops);
      lineas.push(`${NOMBRE_ATR[k]}: ${a.nombre} ${texto(va)} ⇄ ${b.nombre} ${texto(vb)}`);
    } else if (nivel === 2) {
      const n = dirigido ? elegidos.length : Math.min(elegidos.length, 2 + entero(3)), grupo = elegidos.slice(0, n);
      const valores = grupo.map(p => leer(p).atr);
      // solo atributos en los que el grupo no es igual
      const claves = barajar(ATR.filter(k => new Set(valores.map(v => Number(v[k]))).size > 1)).slice(0, 2 + entero(2));
      if (!claves.length) return null;
      const nuevos = grupo.map(() => ({}));
      claves.forEach(k => {
        // en ciclo: cada uno recibe el valor de otro (nadie se queda con el suyo)
        const orden = barajar(grupo.map((_, i) => i)), s = 1 + entero(n - 1);
        orden.forEach((idx, pos) => { nuevos[idx][k] = valores[orden[(pos + s) % n]][k]; });
        const cambian = grupo.map((p, i) => [p, i]).filter(([, i]) => Number(nuevos[i][k]) !== Number(valores[i][k]));
        lineas.push(`${NOMBRE_ATR[k]}: ` + cambian.map(([p, i]) => `${p.nombre} ${texto(valores[i][k])}→${texto(nuevos[i][k])}`).join(", "));
      });
      for (let i = 0; i < grupo.length; i++) await escribir(grupo[i], { atr: nuevos[i] }, ops);
    } else {
      // dos (o tres) que no tengan las mismas estadísticas (dos copias del mismo enemigo no cuentan)
      const quiero = dirigido ? Math.min(3, elegidos.length) : I >= 3 && elegidos.length >= 3 && Math.random() < 0.4 ? 3 : 2;
      const huella = p => { const v = leer(p); return JSON.stringify(ATR.map(k => Number(v.atr[k]))) + "|" + v.ca; };
      const grupo = [];
      elegidos.forEach(p => { if (grupo.length < quiero && !grupo.some(q => huella(q) === huella(p))) grupo.push(p); });
      if (grupo.length < 2) return null;
      const n = grupo.length;
      const pv = opciones.pv || cfg().pvNivel3;
      const lecturas = grupo.map(leer);
      // cada uno recibe el paquete del siguiente (con dos, un intercambio)
      const nuevos = grupo.map((p, i) => paquete(grupo[(i + 1) % n], p));
      if (pv !== "no") grupo.forEach((p, i) => {
        const otro = lecturas[(i + 1) % n].pv, mio = lecturas[i].pv;
        nuevos[i].pv = pv === "proporcion" ? { max: mio.max, actual: mio.max * (otro.max ? otro.actual / otro.max : 1) } : { max: otro.max, actual: otro.actual };
      });
      for (let i = 0; i < n; i++) await escribir(grupo[i], nuevos[i], ops);
      lineas.push(`Estadísticas completas: ${grupo.map(p => p.nombre).join(n === 2 ? " ⇄ " : " → ")}${n === 3 ? " → " + grupo[0].nombre : ""}`);
      grupo.forEach((p, i) => lineas.push(`${p.nombre}: ${ATR.map(k => `${corto[k]} ${texto(lecturas[i].atr[k])}→${texto((nuevos[i].atr || {})[k])}`).join(" ")}, CA ${lecturas[i].ca}→${texto(nuevos[i].ca != null ? nuevos[i].ca : lecturas[(i + 1) % n].ca)}`));
      if (pv !== "no") lineas.push(pv === "proporcion" ? "PV: se cambia la proporción de vida" : "PV: se cambian");
    }
    if (!ops.length) return null;
    emitir({ tipo: "stats", objetos: [...new Set(ops.map(op => op.op === "enemigo" ? op.id : (todos.find(p => p.id === op.id) || {}).objeto).filter(Boolean))] });
    if (TB.fichas && ops.some(op => op.op === "ficha")) apuntarFichasAlteradas(ops);
    return { clase: "stats", titulo: nivel === 1 ? "Intercambio de una estadística" : nivel === 2 ? "Intercambio de varias estadísticas" : "Intercambio de estadísticas completas", detalle: lineas.join("\n"), ops };
  }
  // Solo los PV (recursos), entre dos
  async function anomaliaPV(modo) {
    const todos = barajar(await participantes());
    if (todos.length < 2) return null;
    const [a, b] = todos, la = leer(a), lb = leer(b), ops = [];
    const m = modo === "proporcion" ? "proporcion" : "intercambiar";
    const pa = m === "proporcion" ? { max: la.pv.max, actual: la.pv.max * (lb.pv.max ? lb.pv.actual / lb.pv.max : 1) } : lb.pv;
    const pb = m === "proporcion" ? { max: lb.pv.max, actual: lb.pv.max * (la.pv.max ? la.pv.actual / la.pv.max : 1) } : la.pv;
    await escribir(a, { pv: pa }, ops); await escribir(b, { pv: pb }, ops);
    emitir({ tipo: "stats", objetos: [a.objeto, b.objeto] });
    return { clase: "stats", titulo: "Intercambio de vida", detalle: `${a.nombre} ${Math.round(la.pv.actual)}/${la.pv.max} ⇄ ${b.nombre} ${Math.round(lb.pv.actual)}/${lb.pv.max}${m === "proporcion" ? " (proporción)" : ""}`, ops };
  }
  // Lo que la Grieta cambió en las fichas, para la lista de «activas» (se guarda en este navegador)
  const claveFichas = "tbGrieta:fichas";
  function leerFichasAlteradas() { try { return JSON.parse(localStorage.getItem(claveFichas) || "{}"); } catch (e) { return {}; } }
  function apuntarFichasAlteradas(ops) {
    const m = leerFichasAlteradas();
    ops.filter(op => op.op === "ficha").forEach(op => { m[op.id] = { nombre: op.nombre, t: Date.now() }; });
    try { localStorage.setItem(claveFichas, JSON.stringify(m)); } catch (e) { /* nada */ }
  }
  // Todas las fichas vuelven a sus estadísticas originales y los enemigos de la página a las del compendio
  async function restaurarStats() {
    const ops = [], lineas = [];
    const ids = new Set(Object.keys(leerFichasAlteradas()).concat((TB.fichas || []).map(f => f.id)));
    for (const id of ids) {
      let f = null;
      try { f = await TB.red.fichaCompleta(id); } catch (e) { continue; }
      if (!f || !f.data || !f.data.grietaOriginal) continue;
      const data = copia(f.data), o = data.grietaOriginal;
      data.combate = data.combate || {};
      const ant = { atributos: copia(data.atributos), ajustesAtributos: copia(data.ajustesAtributos || {}), ca: copia(data.combate.ca || null), velocidad: data.combate.velocidad, iniciativaAjuste: data.combate.iniciativaAjuste || 0, pvActual: data.combate.pvActual, pvMax: data.combate.pvMax, grietaOriginal: copia(o) };
      data.atributos = copia(o.atributos); data.ajustesAtributos = copia(o.ajustesAtributos || {});
      if (o.ca) data.combate.ca = copia(o.ca);
      if (o.velocidad != null) data.combate.velocidad = o.velocidad;
      data.combate.iniciativaAjuste = o.iniciativaAjuste || 0;
      delete data.grietaOriginal;
      await guardarFicha(id, data);
      ops.push({ op: "ficha", id, nombre: (data.identidad && data.identidad.nombre) || "ficha", antes: ant, despues: { atributos: copia(data.atributos), ajustesAtributos: copia(data.ajustesAtributos), ca: copia(data.combate.ca || null), velocidad: data.combate.velocidad, iniciativaAjuste: data.combate.iniciativaAjuste, pvActual: data.combate.pvActual, pvMax: data.combate.pvMax, grietaOriginal: null } });
      lineas.push((data.identidad && data.identidad.nombre) || "Ficha");
    }
    for (const o of TB.L.objetos()) {
      if (!o.datos || !o.datos.grieta) continue;
      const datos = copia(o.datos), antes = { grieta: copia(datos.grieta), barra: copia((datos.barras || [])[barraPV()] || null) };
      delete datos.grieta;
      TB.L.upsert(Object.assign({}, o, { datos }));
      await TB.red.actualizarObjeto(o.id, { datos });
      ops.push({ op: "enemigo", id: o.id, nombre: nombreDe(o), barra: barraPV(), antes, despues: { grieta: null, barra: antes.barra } });
      lineas.push(nombreDe(o));
    }
    try { localStorage.removeItem(claveFichas); } catch (e) { /* nada */ }
    if (!ops.length) return null;
    emitir({ tipo: "stats", objetos: ops.map(op => op.op === "enemigo" ? op.id : null).filter(Boolean) });
    return { clase: "stats", titulo: "Estadísticas restauradas", detalle: "Vuelven a las originales: " + lineas.join(", "), ops };
  }

  /* ============================================================ catálogo de anomalías */
  const visual = (efectos, titulo) => async () => { emitir({ tipo: "fx", efectos }); return { clase: "visual", titulo, detalle: "Solo visual: no cambia nada", ops: [] }; };
  const ANOMALIAS = {
    // movimiento (las fichas seleccionadas, o unas al azar)
    m_cerca: { grupo: "mov", nombre: "Cerca", hacer: ids => anomaliaMovimiento(ids, "cerca") },
    m_lejos: { grupo: "mov", nombre: "Lejos", hacer: ids => anomaliaMovimiento(ids, "lejos") },
    m_opuesta: { grupo: "mov", nombre: "Opuesta", hacer: ids => anomaliaMovimiento(ids, "opuesta") },
    m_espejo: { grupo: "mov", nombre: "Espejo", hacer: ids => anomaliaMovimiento(ids, "espejo") },
    m_detras: { grupo: "mov", nombre: "Detrás de otra", hacer: ids => anomaliaMovimiento(ids, "detras") },
    m_intercambio: { grupo: "mov", nombre: "Intercambio", hacer: ids => anomaliaMovimiento(ids, "intercambio") },
    m_deriva: { grupo: "mov", nombre: "Deriva al azar", hacer: ids => anomaliaMovimiento(ids, null) },
    // el mapa, solo visual
    v_corte: { grupo: "visual", nombre: "Salto de imagen", hacer: () => visual([{ n: "corte", dur: 260 }], "Salto de imagen")() },
    v_temblor: { grupo: "visual", nombre: "Temblor", hacer: () => visual([{ n: "temblor", dur: 700, fuerza: 12 }], "Temblor")() },
    v_onda: { grupo: "visual", nombre: "Ondulación", hacer: () => visual([{ n: "onda", dur: 1300, amp: 0.03, ondas: 4 + entero(4) }], "Ondulación")() },
    v_fragmentos: { grupo: "visual", nombre: "Fragmentos", hacer: () => visual([{ n: "fragmentos", dur: 900, gx: 5 + entero(4), gy: 3 + entero(3) }], "Fragmentación")() },
    v_giro: { grupo: "visual", nombre: "Giro", hacer: () => visual([{ n: "giro", dur: 900, ang: elegir([90, 180, 270]) }], "Giro del mapa")() },
    v_volteo: { grupo: "visual", nombre: "Volteo", hacer: () => visual([{ n: "giro", dur: 800, ang: 0, voltear: elegir(["h", "v"]) }], "Volteo del mapa")() },
    v_escala: { grupo: "visual", nombre: "Contracción", hacer: () => visual([{ n: "escala", dur: 700, k: elegir([-0.14, 0.14]) }], "Contracción y expansión")() },
    v_aberracion: { grupo: "visual", nombre: "Desgarro de color", hacer: () => visual([{ n: "aberracion", dur: 650, fuerza: 16 }], "Desgarro de color")() },
    // el mapa, de verdad
    r_rot90: { grupo: "real", nombre: "Girar 90°", hacer: real(m => REAL.rotar(90, m), "Giro real de 90°") },
    r_rot180: { grupo: "real", nombre: "Girar 180°", hacer: real(m => REAL.rotar(180, m), "Giro real de 180°") },
    r_rot270: { grupo: "real", nombre: "Girar 270°", hacer: real(m => REAL.rotar(270, m), "Giro real de 270°") },
    r_voltH: { grupo: "real", nombre: "Voltear ↔", hacer: real(m => REAL.voltear("h", m), "Volteo real horizontal") },
    r_voltV: { grupo: "real", nombre: "Voltear ↕", hacer: real(m => REAL.voltear("v", m), "Volteo real vertical") },
    r_contraer: { grupo: "real", nombre: "Contraer", hacer: real(m => REAL.escalar(Math.round(azar(0.7, 0.86) * 100) / 100, m), "Contracción real") },
    r_expandir: { grupo: "real", nombre: "Expandir", hacer: real(m => REAL.escalar(Math.round(azar(1.14, 1.3) * 100) / 100, m), "Expansión real") },
    r_fragmentar: { grupo: "real", nombre: "Partir el mapa", hacer: () => conTitulo(REAL.fragmentar(cfg().intensidad), "El mapa se parte en trozos") },
    r_desplazar: { grupo: "real", nombre: "Mover secciones", hacer: real(m => REAL.desplazar(cfg().intensidad, m), "Secciones del mapa desplazadas") },
    r_recomponer: { grupo: "real", nombre: "Recomponer", hacer: () => conTitulo(REAL.recomponer(), "El mapa se recompone") },
    // estadísticas
    s_1: { grupo: "stats", nombre: "Nivel 1", hacer: ids => anomaliaStats(1, { ids }) },
    s_2: { grupo: "stats", nombre: "Nivel 2", hacer: ids => anomaliaStats(2, { ids }) },
    s_3: { grupo: "stats", nombre: "Nivel 3", hacer: ids => anomaliaStats(3, { ids }) },
    s_pv: { grupo: "stats", nombre: "Vida (PV)", hacer: () => anomaliaPV(cfg().pvNivel3 === "proporcion" ? "proporcion" : "intercambiar") },
    s_restaurar: { grupo: "stats", nombre: "Restaurar originales", hacer: () => restaurarStats(), sinAzar: true }
  };
  function real(f, titulo) { return (ids, modo) => { const m = modoReal(modo); return conTitulo(f(m), titulo, m); }; }
  async function conTitulo(promesa, titulo, modo) {
    const ops = await promesa;
    if (!ops || !ops.length) return null;
    const m = modo === "todo" || modo === "terreno" ? modo : null;
    return { clase: "real", titulo, detalle: m === "terreno" ? "Solo el terreno: las fichas se quedan donde estaban" : m === "todo" ? "Con las fichas encima" : "", ops };
  }
  function fichasAlAzar() {
    const l = barajar(TB.L.objetos().filter(o => o.tipo === "imagen" && o.capa === "fichas").map(o => o.id));
    return l.slice(0, 1 + entero(cfg().intensidad));
  }
  // Ejecuta una o varias anomalías seguidas como un solo evento del registro
  function ejecutar(claves, { ids, modo } = {}) {
    return encolar(async () => {
      const partes = [];
      for (const k of claves) {
        const a = ANOMALIAS[k];
        if (!a) continue;
        const sel = a.grupo === "mov" ? (ids && ids.length ? ids : fichasAlAzar()) : ids;
        const r = await a.hacer(sel, modo);
        if (r && r.error) { avisoPanel(r.error); aviso(r.error, true); continue; }
        if (r) partes.push(r);
        if (claves.length > 1) await esperar(220);
      }
      if (!partes.length) { if (TB.esGM() && ventanas.has("grieta") && !avisoTexto) avisoPanel("No hubo forma de hacerlo (no había destino válido o faltaban participantes)."); return; }
      apuntar(partes.length === 1 ? partes[0] : { clase: "combinada", titulo: "Anomalías combinadas", detalle: partes.map(p => "• " + p.titulo + (p.detalle ? "\n  " + p.detalle.split("\n").join("\n  ") : "")).join("\n"), ops: [].concat(...partes.map(p => p.ops)) });
    });
  }
  // Un evento suelto al azar, según los tipos permitidos, la intensidad y si se combinan
  function eventoAleatorio() {
    const c = cfg(), I = c.intensidad;
    const familias = {};
    if (c.visual) familias.visual = 6;
    if (c.mov) familias.mov = 3;
    if (c.real) familias.real = I === 1 ? 1 : 2;
    if (c.stats) familias.stats = I === 1 ? 0.8 : 1.5;
    if (!Object.keys(familias).length) return;
    const n = c.combinadas && I >= 2 && Math.random() < (I === 2 ? 0.25 : 0.45) ? (I === 2 ? 2 : 2 + entero(2)) : 1;
    const claves = [];
    for (let i = 0; i < n; i++) {
      const f = ponderado(familias);
      if (!f) break;
      if (f === "real" || f === "stats") delete familias[f];   // como mucho uno de cada en un evento
      claves.push(elegirDe(f, I));
    }
    if (claves.length) ejecutar(claves.filter(Boolean));
  }
  function elegirDe(familia, I) {
    if (familia === "visual") return ponderado({ v_corte: 4, v_temblor: 3, v_onda: 2, v_fragmentos: 2, v_giro: I >= 2 ? 2 : 1, v_volteo: 1, v_escala: 1, v_aberracion: 2 });
    if (familia === "mov") return ponderado({ m_cerca: 3, m_lejos: I, m_opuesta: 2, m_detras: 2, m_intercambio: 2, m_espejo: I - 1, m_deriva: 2 });
    if (familia === "stats") return ponderado({ s_1: I === 1 ? 4 : 2, s_2: I >= 2 ? 3 : 1, s_3: I >= 3 ? 2 : I === 2 ? 0.6 : 0 });
    const alterado = !!leerBase() || piezas().length > 0;
    return ponderado({ r_rot180: 2, r_rot90: I >= 2 ? 1 : 0, r_rot270: I >= 2 ? 1 : 0, r_voltH: 2, r_voltV: 1.5, r_contraer: 1.5, r_expandir: 1.5,
      r_fragmentar: mapaPrincipal() ? 1.5 : 0, r_desplazar: I >= 2 ? 2 : 0.5, r_recomponer: alterado ? 3 : 0 });
  }
  function programar() {
    clearTimeout(temporizador);
    temporizador = null;
    if (!encendida()) return;
    const f = FREC[cfg().frecuencia] || FREC.media;
    temporizador = setTimeout(() => {
      temporizador = null;
      if (encendida() && !document.hidden) eventoAleatorio();
      programar();
    }, f.cada * 1000 * azar(0.5, 1.5));
  }

  /* ============================================================ deshacer */
  async function deshacer(id) {
    const l = leerReg(), e = l.find(x => x.id === id);
    if (!e || e.deshecho || !e.ops || !e.ops.length) return;
    // ¿Algo cambió después sobre lo mismo?
    const conflictos = [];
    for (const op of e.ops) {
      if (op.op === "pos") { const o = TB.L.objeto(op.id); if (o && dist(o, op.despues) > 1) conflictos.push(nombreDe(o)); }
      if (op.op === "obj") { const o = TB.L.objeto(op.id); if (o && JSON.stringify(camposObj(o)) !== JSON.stringify(op.despues)) conflictos.push(nombreDe(o)); }
      if (op.op === "enemigo") { const o = TB.L.objeto(op.id); if (o && JSON.stringify((o.datos || {}).grieta || null) !== JSON.stringify(op.despues.grieta)) conflictos.push(op.nombre); }
    }
    if (conflictos.length && !(await confirmar("Deshacer", `Después de esto cambiaron ${[...new Set(conflictos)].slice(0, 6).join(", ")}${conflictos.length > 6 ? "…" : ""}. Si lo deshaces, vuelven a como estaban antes de este evento.`, "Deshacer igualmente"))) return;
    await encolar(async () => {
      const saltos = [], cambiadas = [];
      let escena = null, crear = [], borrar = [];
      for (const op of e.ops.slice().reverse()) {
        if (op.op === "pos" && TB.L.objeto(op.id)) saltos.push({ id: op.id, x: op.antes.x, y: op.antes.y });
        if (op.op === "obj") { const o = TB.L.objeto(op.id); if (o) cambiadas.push(Object.assign(copia(o), copia(op.antes))); }
        if (op.op === "escena") escena = Object.assign(escena || {}, copia(op.antes));
        if (op.op === "crear") borrar = borrar.concat(op.ids.filter(x => TB.L.objeto(x)));
        if (op.op === "borrar") crear = crear.concat(op.filas.filter(f => !TB.L.objeto(f.id)));
        if (op.op === "ficha") {
          const f = await TB.red.fichaCompleta(op.id).catch(() => null);
          if (!f || !f.data) continue;
          const data = copia(f.data);
          data.combate = data.combate || {};
          data.atributos = copia(op.antes.atributos); data.ajustesAtributos = copia(op.antes.ajustesAtributos || {});
          if (op.antes.ca) data.combate.ca = copia(op.antes.ca);
          if (op.antes.velocidad != null) data.combate.velocidad = op.antes.velocidad;
          data.combate.iniciativaAjuste = op.antes.iniciativaAjuste || 0;
          if (op.antes.pvMax != null) data.combate.pvMax = op.antes.pvMax;
          if (op.antes.pvActual != null) data.combate.pvActual = op.antes.pvActual;
          if (op.antes.grietaOriginal) data.grietaOriginal = copia(op.antes.grietaOriginal);
          else if (data.grietaOriginal && JSON.stringify(data.grietaOriginal.atributos) === JSON.stringify(data.atributos)) delete data.grietaOriginal;
          await guardarFicha(op.id, data);
        }
        if (op.op === "enemigo") {
          const o = TB.L.objeto(op.id);
          if (!o) continue;
          const datos = copia(o.datos || {});
          if (op.antes.grieta) datos.grieta = copia(op.antes.grieta); else delete datos.grieta;
          if (op.antes.barra) { const b = (datos.barras || []).slice(); b[op.barra || 0] = copia(op.antes.barra); datos.barras = b; }
          TB.L.upsert(Object.assign({}, o, { datos }));
          await TB.red.actualizarObjeto(o.id, { datos });
        }
      }
      if (cambiadas.length || escena || crear.length || borrar.length) await confirmarPagina({ cambiadas, escena, crear, borrar }, { gx: 4, gy: 4, dur: 900 });
      if (saltos.length) await saltar(saltos);
      if (e.ops.some(op => op.op === "ficha" || op.op === "enemigo")) emitir({ tipo: "stats", objetos: e.ops.filter(op => op.op === "enemigo").map(op => op.id) });
      const lista = leerReg(), x = lista.find(q => q.id === id);
      if (x) x.deshecho = true;
      guardarReg(lista);
      pintarPanel();
    });
  }

  /* ============================================================ panel del DJ */
  let avisoTexto = "", avisoReloj = null;
  function avisoPanel(t) { avisoTexto = t; clearTimeout(avisoReloj); avisoReloj = setTimeout(() => { avisoTexto = ""; pintarPanel(); }, 5000); pintarPanel(); }
  const GRUPOS = [["mov", "Movimiento", "A las fichas seleccionadas; si no hay ninguna, a unas al azar. Intercambio con dos o más fichas seleccionadas las cambia de sitio entre ellas (con tres o más, en rueda)."], ["visual", "Mapa · solo visual", "Un instante en todas las pantallas. No cambia nada."],
    ["real", "Mapa · real", "Cambia coordenadas de verdad. Recomponer lo devuelve a como estaba."], ["stats", "Estadísticas", "Con los datos reales de las fichas y de los enemigos de la página. Con dos o más fichas seleccionadas, el intercambio es entre ellas."]];
  function abrirPanel() {
    if (!TB.esGM()) return;
    if (ventanas.has("grieta")) { pintarPanel(); return; }
    const v = ventana("grieta", { titulo: "La Grieta de Dexter", ancho: 430, alto: Math.min(820, window.innerHeight - 80), x: 90, y: 40 });
    v.cuerpo.classList.add("tb-grieta-panel");
    pintarPanel();
  }
  function pintarPanel() {
    const v = ventanas.get("grieta");
    if (!v) return;
    const c = cfg(), cuerpo = v.cuerpo, scroll = cuerpo.scrollTop;
    cuerpo.innerHTML = "";
    if (!dentro) {
      cuerpo.appendChild(el(`<p class="tb-nota">Esta página no tiene la Grieta. Se asigna en Configuración de página → Particularidades.</p>`));
      return;
    }
    const caja = el(`<div>
      <div class="tb-fila-toggle"><span>Activa en esta página</span><span data-t="activa"></span></div>
      <div class="tb-fila-toggle"><span>En pausa<small class="tb-nota" style="display:block;font-weight:400">Ninguna anomalía sola mientras tanto. Lo forzado desde aquí sí funciona.</small></span><span data-t="pausada"></span></div>
      <div class="tb-fila"><label class="tb-campo" style="flex:1"><span>Frecuencia</span><select data-frecuencia>${Object.entries(FREC).map(([k, f]) => `<option value="${k}">${f.nombre}</option>`).join("")}</select></label>
        <div class="tb-campo" style="flex:1"><span>Intensidad</span><div class="tb-grieta-nivel">${[1, 2, 3].map(n => `<button type="button" data-intensidad="${n}" class="${c.intensidad === n ? "activo" : ""}">${n}</button>`).join("")}</div></div></div>
      <div class="tb-grieta-tipos">
        <label class="tb-casilla"><input type="checkbox" data-c="mov"> Movimiento</label>
        <label class="tb-casilla"><input type="checkbox" data-c="visual"> Mapa visual</label>
        <label class="tb-casilla"><input type="checkbox" data-c="real"> Mapa real</label>
        <label class="tb-casilla"><input type="checkbox" data-c="stats"> Estadísticas</label>
        <label class="tb-casilla"><input type="checkbox" data-c="combinadas"> Combinarlas</label></div>
      <div class="tb-fila"><label class="tb-campo" style="flex:1"><span>Cambios reales del mapa</span><select data-modo><option value="azar">Al azar</option><option value="todo">Con las fichas encima</option><option value="terreno">Solo el terreno</option></select></label>
        <label class="tb-campo" style="flex:1"><span>Vida en el nivel 3</span><select data-pv><option value="no">No se toca</option><option value="intercambiar">Se intercambia</option><option value="proporcion">Se cambia la proporción</option></select></label></div>
      <div class="tb-fila"><label class="tb-campo" style="flex:1"><span>Barra de PV de los enemigos</span><select data-barra><option value="0">Barra 1 (verde)</option><option value="1">Barra 2 (azul)</option><option value="2">Barra 3 (roja)</option></select></label>
        <label class="tb-campo" style="flex:1"><span>Característica del nivel 1</span><select data-atr1><option value="azar">Al azar</option>${ATR.map(k => `<option value="${k}">${NOMBRE_ATR[k]}</option>`).join("")}</select></label></div>
      <hr class="tb-sep">
      <div class="tb-fila" style="justify-content:space-between;align-items:center"><h4 class="tb-cfgpag-sec" style="margin:0">Forzar</h4><button type="button" class="tb-btn tb-btn-acento" data-azar>Evento al azar</button></div>
      ${avisoTexto ? `<p class="tb-nota tb-grieta-aviso">${esc(avisoTexto)}</p>` : ""}
      ${GRUPOS.map(([g, t, nota]) => `<div class="tb-grieta-grupo"><div class="tb-grieta-grupo-tit">${t}</div><p class="tb-nota">${nota}</p><div class="tb-grieta-botones">${Object.entries(ANOMALIAS).filter(([, a]) => a.grupo === g).map(([k, a]) => `<button type="button" class="tb-btn tb-btn-mini" data-forzar="${k}">${esc(a.nombre)}</button>`).join("")}</div></div>`).join("")}
      <hr class="tb-sep"><h4 class="tb-cfgpag-sec">Activas ahora</h4><div data-activas></div>
      <hr class="tb-sep"><div class="tb-fila" style="justify-content:space-between;align-items:center"><h4 class="tb-cfgpag-sec" style="margin:0">Registro</h4><button type="button" class="tb-btn tb-btn-mini" data-vaciar>Vaciar</button></div>
      <div class="tb-grieta-registro" data-registro></div>
    </div>`);
    cuerpo.appendChild(caja);
    const q = s => caja.querySelector(s);
    const tA = interruptor(c.activa), tP = interruptor(c.pausada);
    q('[data-t="activa"]').appendChild(tA.el); q('[data-t="pausada"]').appendChild(tP.el);
    tA.input.addEventListener("change", () => guardarCfg({ activa: tA.valor() }));
    tP.input.addEventListener("change", () => guardarCfg({ pausada: tP.valor() }));
    q("[data-frecuencia]").value = c.frecuencia;
    q("[data-frecuencia]").addEventListener("change", ev => guardarCfg({ frecuencia: ev.target.value }));
    caja.querySelectorAll("[data-intensidad]").forEach(b => b.addEventListener("click", () => guardarCfg({ intensidad: Number(b.dataset.intensidad) })));
    caja.querySelectorAll("[data-c]").forEach(i => { i.checked = !!c[i.dataset.c]; i.addEventListener("change", () => guardarCfg({ [i.dataset.c]: i.checked })); });
    q("[data-modo]").value = c.modoReal; q("[data-modo]").addEventListener("change", ev => guardarCfg({ modoReal: ev.target.value }));
    q("[data-pv]").value = c.pvNivel3; q("[data-pv]").addEventListener("change", ev => guardarCfg({ pvNivel3: ev.target.value }));
    q("[data-barra]").value = String(c.barraPV | 0); q("[data-barra]").addEventListener("change", ev => guardarCfg({ barraPV: Number(ev.target.value) }));
    q("[data-atr1]").value = c.atributoN1 || "azar"; q("[data-atr1]").addEventListener("change", ev => guardarCfg({ atributoN1: ev.target.value }));
    q("[data-azar]").addEventListener("click", () => eventoAleatorio());
    caja.querySelectorAll("[data-forzar]").forEach(b => b.addEventListener("click", async () => {
      const k = b.dataset.forzar;
      if (k === "s_restaurar" && !(await confirmar("Restaurar estadísticas", "Todas las fichas que tocó la Grieta vuelven a sus estadísticas originales y los enemigos de esta página a las del compendio.", "Restaurar"))) return;
      const ids = TB.L.seleccion().filter(id => esToken(TB.L.objeto(id)));
      b.disabled = true;
      ejecutar([k], { ids }).finally(() => { b.disabled = false; });
    }));
    q("[data-vaciar]").addEventListener("click", async () => { if (await confirmar("Vaciar el registro", "Se borra la lista de eventos de esta página. Lo que cambiaron se queda como está.", "Vaciar")) { guardarReg([]); pintarPanel(); } });
    // activas: mapa alterado, enemigos y fichas con estadísticas cambiadas
    const act = q("[data-activas]"), filasAct = [];
    const base = leerBase(), trozos = piezas().length;
    if (base || trozos) filasAct.push(`<div class="tb-grieta-activa"><span>El mapa está alterado${trozos ? ` (partido en ${trozos} trozos)` : ""}${base ? ` desde las ${new Date(base.t).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}` : ""}</span><button type="button" class="tb-btn tb-btn-mini" data-forzar2="r_recomponer">Recomponer</button></div>`);
    TB.L.objetos().filter(o => o.datos && o.datos.grieta).forEach(o => {
      const g = o.datos.grieta, s = window.TBTiradas && TBTiradas.estadisticasDe(o);
      const cambios = s && g.stats ? ATR.filter(k => Number(g.stats[k]) !== Number((s.stats || {})[k])).map(k => `${corto[k]} ${(s.stats || {})[k]}→${g.stats[k]}`) : [];
      if (g.ca != null && s && Number(g.ca) !== Number(s.ca)) cambios.push(`CA ${s.ca}→${g.ca}`);
      filasAct.push(`<div class="tb-grieta-activa"><span><b>${esc(nombreDe(o))}</b> ${esc(cambios.join(", ") || "estadísticas cambiadas")}</span></div>`);
    });
    Object.values(leerFichasAlteradas()).forEach(f => filasAct.push(`<div class="tb-grieta-activa"><span><b>${esc(f.nombre)}</b> tiene estadísticas cambiadas</span></div>`));
    act.innerHTML = filasAct.join("") || `<p class="tb-nota">Nada: el mapa y las estadísticas están como siempre.</p>`;
    if (filasAct.length && (Object.keys(leerFichasAlteradas()).length || TB.L.objetos().some(o => o.datos && o.datos.grieta))) act.appendChild(el(`<button type="button" class="tb-btn tb-btn-mini" data-forzar2="s_restaurar" style="margin-top:calc(4px * var(--tb-k))">Restaurar las estadísticas originales</button>`));
    act.querySelectorAll("[data-forzar2]").forEach(b => b.addEventListener("click", async () => {
      if (b.dataset.forzar2 === "s_restaurar" && !(await confirmar("Restaurar estadísticas", "Todas las fichas que tocó la Grieta vuelven a sus estadísticas originales y los enemigos de esta página a las del compendio.", "Restaurar"))) return;
      b.disabled = true; ejecutar([b.dataset.forzar2]);
    }));
    // registro
    const reg = q("[data-registro]"), lista = leerReg().slice().reverse();
    if (!lista.length) reg.appendChild(el(`<p class="tb-nota">Todavía no ha pasado nada en esta página.</p>`));
    lista.forEach(e => {
      const hora = new Date(e.t).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const puede = !e.deshecho && e.ops && e.ops.length;
      const it = el(`<div class="tb-grieta-entrada${e.deshecho ? " deshecho" : ""}"><div class="tb-grieta-entrada-cab"><span class="tb-grieta-clase tb-grieta-${esc(e.clase || "")}"></span><b>${esc(e.titulo || "")}</b><small>${hora}</small>
        ${puede ? `<button type="button" class="tb-btn tb-btn-mini" data-deshacer>Deshacer</button>` : e.deshecho ? `<small>deshecho</small>` : ""}</div>${e.detalle ? `<div class="tb-grieta-entrada-det">${esc(e.detalle)}</div>` : ""}</div>`);
      const bd = it.querySelector("[data-deshacer]");
      if (bd) bd.addEventListener("click", () => { bd.disabled = true; deshacer(e.id).finally(() => { bd.disabled = false; }); });
      reg.appendChild(it);
    });
    cuerpo.scrollTop = scroll;
  }

  /* ============================================================ botón en la barra (DJ, solo en la página con la Grieta) */
  let boton = null;
  function asegurarBoton() {
    if (!TB.esGM()) return;
    const barra = document.getElementById("tbBarra");
    if (!barra) return;
    if (!boton || !boton.isConnected) {
      boton = el(`<button type="button" class="tb-barra-btn tb-grieta-btn" title="La Grieta de Dexter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M13 2l-3.2 6.2 3.6 2.6-4.6 5.4 2.6 1.8L9.6 22"/><path d="M5 7l2.5 1.5M17.5 12.5L20 11M6 15.5l2-.5"/></svg></button>`);
      boton.addEventListener("click", () => { if (ventanas.has("grieta")) ventanas.get("grieta").cerrar(); else abrirPanel(); });
      const pie = barra.querySelector(".tb-barra-pie");
      barra.insertBefore(boton, pie || null);
    }
    boton.hidden = !dentro;
    boton.classList.toggle("en-pausa", dentro && (!cfg().activa || cfg().pausada));
  }

  /* ============================================================ registro de la particularidad */
  let iniciado = false;
  TBParticularidades.registrar(ID, {
    nombre: "La Grieta de Dexter",
    descripcion: "Anomalías espaciales y físicas: fichas que aparecen donde no deben, el mapa que se gira, se voltea, se parte o se recompone, y estadísticas que se intercambian entre participantes. Se controla desde su botón en la barra.",
    iniciar(tb) {
      TB = tb;
      if (iniciado) return;
      iniciado = true;
      TB.on("movido", d => { if (dentro) alMoverse(d); });
      TB.on("grieta", d => { if (dentro && d.de !== TB.yo.uid) reproducir(d); });
      document.addEventListener("visibilitychange", () => { if (!document.hidden && dentro) programar(); });
      asegurarBoton();
    },
    entrar(escena) {
      dentro = true; escenaId = escena.id;
      asegurarBoton(); programar(); pintarPanel();
    },
    actualizar() { asegurarBoton(); programar(); pintarPanel(); },
    salir() {
      dentro = false; gen++;
      clearTimeout(temporizador); temporizador = null;
      pendientesMov.forEach(p => clearTimeout(p.reloj)); pendientesMov.clear();
      recientes.clear();
      cortarEsperas();
      cola = Promise.resolve();
      VFX.limpiar();
      asegurarBoton(); pintarPanel();
    }
  });

  window.TBGrieta = { abrirPanel, ejecutar, eventoAleatorio, deshacer, registro: () => leerReg(), _valido: (o, x, y) => valido(o, x, y, contexto()), _vfx: VFX };
})();
