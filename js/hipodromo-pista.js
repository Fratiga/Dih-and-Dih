/* =============================================================================
   HIPÓDROMO: la pista. Dibuja la carrera como una toma de televisión: una cámara que sigue al pelotón, con zoom
   que aprieta o abre según lo juntos que vayan, paisaje en capas que se mueve a distintas velocidades, el clima
   y el terreno de esa carrera (lluvia, tormenta, niebla, calor, charcos, barro), las criaturas grandes y galopando
   en carriles con profundidad, un marcador y una barra de progreso.

   Solo es la parte visual. El resultado y los tiempos por tramo salen del motor y no se tocan: cada criatura pasa por
   cada marca de 100 m exactamente en el tiempo que dice el motor. Entre marca y marca la velocidad se suaviza y se
   le suman pequeños arranques y flojeras (que valen cero en cada marca y en la meta), para que haya adelantamientos
   y ritmo en vez de una fila que avanza pareja.

   Tres piezas, para que la página inmersiva (hipodromo-vivo.html) use las mismas sin copiarlas:
   - trayectorias(res, carriles): dónde está cada criatura a cada segundo de la carrera (metros desde la salida).
   - escenario(canvasFondo, canvasFrente, cfg): el paisaje, el clima y los carriles, con cámara que pone quien lo use.
   - crear(contenedor, cfg): la toma de televisión de la página principal, hecha con las dos de arriba.

   Uso:  const pista = HipodromoPista.crear(contenedor, { res, carriles, ultimo, D, marcadas });
         pista.dibujar(segundosDesdeLaSalida)  ->  { metrosLider, fin, hecho }
============================================================================= */
window.HipodromoPista = (function () {
  const PRE = 3;                              // segundos de cuenta atrás antes de la salida
  const COLA = 5;                             // segundos que se queda la pista después de la última llegada
  const duracionCarrera = dist => Math.max(38, Math.min(62, 30 + dist * 0.011));   // segundos de carrera en pantalla

  /* ---------------------------------------------------------------- azar repetible */
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
  const azar = semilla => { let a = semilla >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  /* ---------------------------------------------------------------- aspecto del clima y del suelo */
  const CLIMA = {
    despejado: { cielo: ["#4ea8f2", "#cfeaff"], nubes: 4, lluvia: 0, niebla: 0, oscuro: 0, sol: 1 },
    nublado: { cielo: ["#7d8999", "#c5ccd5"], nubes: 9, lluvia: 0, niebla: 0.05, oscuro: 0.1, sol: 0 },
    calor: { cielo: ["#ff9f4a", "#ffe6a8"], nubes: 1, lluvia: 0, niebla: 0, oscuro: 0, sol: 2 },
    lluvia: { cielo: ["#46525f", "#7d8996"], nubes: 10, lluvia: 150, niebla: 0.12, oscuro: 0.2, sol: 0 },
    tormenta: { cielo: ["#1d2330", "#434d61"], nubes: 11, lluvia: 280, niebla: 0.15, oscuro: 0.34, sol: 0, rayos: true },
    niebla: { cielo: ["#a9b3ba", "#e3e7e8"], nubes: 2, lluvia: 0, niebla: 0.62, oscuro: 0.05, sol: 0 }
  };
  const SUELO = {
    hierba: { pista: "#3f9a3d", franja: "#47a845", orilla: "#2d6e2c", colina: "#2f7a3a", lejos: "#4c8f55" },
    arcilla: { pista: "#a8643b", franja: "#b3703f", orilla: "#7c4526", colina: "#85533a", lejos: "#9a6a4c" },
    arena: { pista: "#dcbb78", franja: "#e5c78c", orilla: "#b48c49", colina: "#c19a5e", lejos: "#d2b07c" },
    // pistas arcanas
    cristal: { pista: "#6f62ad", franja: "#8274c4", orilla: "#3f3470", colina: "#54489a", lejos: "#8d82c8", cielo: ["#2c1f5e", "#b79cf0"] },
    nube: { pista: "#cfe0f2", franja: "#e1eefb", orilla: "#8fb0d0", colina: "#aac6e2", lejos: "#c6d9ec", cielo: ["#5fb4f5", "#f4fbff"] },
    pantano: { pista: "#586638", franja: "#657545", orilla: "#37431f", colina: "#43522b", lejos: "#6b7b50", cielo: ["#41563f", "#a9c29a"] },
    brasa: { pista: "#4b2a22", franja: "#5a342b", orilla: "#26130f", colina: "#3c1c16", lejos: "#6e3c2d", cielo: ["#4a140e", "#ff8a3d"] }
  };
  const COLOR_ZONA = { ilusion: "180,140,255", corrientes: "255,255,255", sumidero: "40,70,30", brasas: "255,90,30" };
  const HUM = { firme: 0, bueno: 0.12, blando: 0.32, pesado: 0.55 };

  /* Colores: hexadecimales "#rrggbb" o ternas [r,g,b] (las del clima en transición). */
  const aRgb = h => (Array.isArray(h) ? h : [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const css = c => "rgb(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + ")";
  function mezcla(hex, aHex, f) {   // mezcla dos colores
    const a = aRgb(hex), b = aRgb(aHex);
    return css([0, 1, 2].map(i => a[i] * (1 - f) + b[i] * f));
  }
  const colorDe = id => "hsl(" + (hash("c" + id) % 360) + " 70% 55%)";

  /* ---------------------------------------------------------------- recorrido de cada criatura */
  /* Interpolación monótona (Fritsch–Carlson) de los tiempos por tramo: la velocidad cambia suave y nunca retrocede. */
  function curvaDe(tramos) {
    const t = [0].concat(tramos), x = t.map((_, i) => i * 100), n = t.length;
    const d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) d.push((x[i + 1] - x[i]) / Math.max(1e-6, t[i + 1] - t[i]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
    }
    return T => {
      if (T <= 0) return 0;
      if (T >= t[n - 1]) return x[n - 1];
      let i = 0; while (i < n - 2 && t[i + 1] <= T) i++;
      const h = t[i + 1] - t[i], u = (T - t[i]) / h, u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * x[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * x[i + 1] + (u3 - u2) * h * m[i + 1];
    };
  }

  /* Dónde está cada criatura en cada instante. T son los segundos de carrera del motor (no los de pantalla):
     la pantalla los convierte con factor (= segundos del motor por segundo de pantalla). Salida: { dist, durRace, factor, ultimo,
     lista: [{ c, tFin, metros(T) }] } con los metros desde la salida de cada una. Es lo mismo que mueve la toma de la página principal. */
  function trayectorias(res, carriles, ultimo) {
    const dist = res.dist;
    if (ultimo == null) ultimo = Math.max.apply(null, res.llegada.map(l => l.t));
    const durRace = duracionCarrera(dist), factor = ultimo / durRace;
    const AMP = clamp(dist * 0.007, 6, 18);   // cuántos metros se pueden adelantar o atrasar con esas ondas (de unos 3 a 7 cuerpos)
    const lista = carriles.map(c => {
      const az = azar(hash("v" + c.id + res.n));
      // pequeños arranques y flojeras por tramo: valen cero en cada marca de 100 m (y se apagan en el último tramo)
      const ruido = Array.from({ length: c.tramos.length }, (_, s) => (az() * 2 - 1) * (s === c.tramos.length - 1 ? 0.9 : 2.4));
      // ritmo con altibajos: ondas lentas que adelantan y atrasan a cada criatura a lo largo de la carrera y valen cero en la salida y en la meta,
      // así los puestos cambian de verdad a la vista y el resultado sigue siendo el del motor
      const onda = { mul: 0.6 + 0.6 * az(), f1: 1.1 + az(), f2: 2.6 + 1.6 * az(), p1: az() * 6.283, p2: az() * 6.283 };
      const curva = curvaDe(c.tramos), tFin = c.tramos[c.tramos.length - 1];
      const metros = T => {
        let m = curva(T);
        if (T > 0 && T < tFin) {
          const tr = c.tramos; let s = 0; while (s < tr.length && tr[s] <= T) s++;
          const t0 = s === 0 ? 0 : tr[s - 1], t1 = tr[s], u = (T - t0) / Math.max(1e-6, t1 - t0), e = Math.sin(Math.PI * u);
          m += ruido[s] * e * e;
          const v = T / tFin, o = onda, env = Math.pow(Math.sin(Math.PI * v), 0.8);
          m += AMP * o.mul * env * (0.65 * Math.sin(6.283 * o.f1 * v + o.p1) + 0.35 * Math.sin(6.283 * o.f2 * v + o.p2));
        }
        return Math.max(0, Math.min(m, dist));
      };
      return { c, tFin, metros };
    });
    return { dist, durRace, factor, ultimo, lista };
  }

  /* ---------------------------------------------------------------- el paisaje */
  /* cfg: { dist, lanes, clima, estadoPista, suelo, cuestas, arcana, zonas, semilla, rayosT, rayosAzar, horizonte, carrilBase, carrilAncho }
     Dibuja en dos lienzos (el fondo va detrás de las criaturas y el frente, delante). La cámara la pone quien lo usa:
     fondo(camGr, gp, ahora, extra) con camGr = metro que está en el centro y gp = píxeles por metro del paisaje cercano.
     extra(ctx) es opcional: dibuja cosas propias en el mundo (ctx trae g, W, H, y0, xm(metro), gp, ahora) justo antes del velo del clima. */
  function escenario(cFondo, cFrente, cfg) {
    const gF = cFondo.getContext("2d"), gT = cFrente.getContext("2d");
    const dist = cfg.dist, lanes = Math.max(1, cfg.lanes), nombreSuelo = cfg.suelo || "hierba";
    const suelo = SUELO[nombreSuelo] || SUELO.hierba;
    const arcana = cfg.arcana || null, zonas = cfg.zonas || [];
    const cuestas = clamp(cfg.cuestas || 0, 0, 1);
    const HZ = cfg.horizonte != null ? cfg.horizonte : 0.36, CBASE = cfg.carrilBase != null ? cfg.carrilBase : 0.9, CANCHO = cfg.carrilAncho != null ? cfg.carrilAncho : 0.34;
    let W = 320, H = 300;

    // clima en curso: números que pueden pasar poco a poco de un tiempo a otro (la pista arcana tiene cielo propio y fijo)
    const climaDe = nombre => {
      const c = Object.assign({}, CLIMA[nombre] || CLIMA.despejado);
      c.cielo = (suelo.cielo || c.cielo).map(aRgb);
      c.rayos = !!c.rayos;
      return c;
    };
    let clima = climaDe(cfg.clima), hum = HUM[cfg.estadoPista] != null ? HUM[cfg.estadoPista] : 0, trans = null;
    function ponerClima(nombre, estadoPista, seg) {
      const a = climaDe(nombre), h = HUM[estadoPista] != null ? HUM[estadoPista] : hum;
      if (!seg) { clima = a; hum = h; trans = null; return; }
      trans = { de: clima, a, hDe: hum, hA: h, t: 0, dur: seg };
    }
    function avanzarClima(dt) {
      if (!trans) return;
      trans.t += dt;
      const u = Math.min(1, trans.t / trans.dur), e = u * u * (3 - 2 * u), L = (x, y) => x + (y - x) * e, d = trans.de, a = trans.a;
      clima = {
        cielo: [0, 1].map(k => [0, 1, 2].map(i => L(d.cielo[k][i], a.cielo[k][i]))),
        nubes: L(d.nubes, a.nubes), lluvia: L(d.lluvia, a.lluvia), niebla: L(d.niebla, a.niebla), oscuro: L(d.oscuro, a.oscuro), sol: L(d.sol, a.sol),
        rayos: e < 0.5 ? d.rayos : a.rayos
      };
      hum = L(trans.hDe, trans.hA);
      if (u >= 1) { clima = a; hum = trans.hA; trans = null; }
    }

    // ---- el paisaje: elementos fijos en el mundo, sembrados con la semilla de la carrera
    const az0 = azar(cfg.semilla != null ? cfg.semilla : 1);
    const arboles = Array.from({ length: Math.ceil(dist / 22) + 40 }, (_, i) => ({ m: i * 22 + az0() * 18 - 100, t: az0(), h: 0.7 + az0() * 0.7, c: az0() }));
    const colinas = Array.from({ length: 30 }, (_, i) => ({ m: i * 90 - 200, h: 0.45 + az0() * 0.55 + cuestas * 0.4, a: 140 + az0() * 120 }));
    const nubes = Array.from({ length: 16 }, () => ({ m: az0() * 6000, y: 0.04 + az0() * 0.26, w: 70 + az0() * 140, v: 0.2 + az0() * 0.5 }));
    const charcos = Array.from({ length: 70 }, () => ({ m: az0() * (dist + 400) - 150, f: az0(), w: 30 + az0() * 70 }));
    const gotas = Array.from({ length: 280 }, () => ({ x: az0(), y: az0(), v: 0.7 + az0() * 0.8, l: 8 + az0() * 12 }));
    const rayosT = cfg.rayosDur && clima.rayos ? Array.from({ length: 6 }, () => 6 + az0() * (cfg.rayosDur - 8)) : [];
    let flash = 0, proximoRayo = 4;

    function medir(w, h, dpr) {
      W = w; H = h;
      [cFondo, cFrente].forEach(c => { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
      gF.setTransform(dpr, 0, 0, dpr, 0, 0); gT.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const carril = i => {            // i = 0 (puerta 1) es el carril más cercano
      const f = lanes === 1 ? 0 : i / (lanes - 1);
      const yPies = H * CBASE - f * H * CANCHO;
      return { yPies, escala: 1 - f * 0.34, z: 100 - i, f };
    };

    function fondo(camGr, gp, ahora, extra) {
      const hz = H * HZ;
      // cielo
      let g = gF.createLinearGradient(0, 0, 0, hz + 10);
      g.addColorStop(0, css(clima.cielo[0])); g.addColorStop(1, css(clima.cielo[1]));
      gF.fillStyle = g; gF.fillRect(0, 0, W, hz + 10);
      if (clima.sol > 0.03) {   // sol (y su brillo si hace calor)
        const sx = W * 0.8, sy = hz * 0.35, r = clima.sol > 1.5 ? 46 : 28, al = Math.min(1, clima.sol);
        const rg = gF.createRadialGradient(sx, sy, 2, sx, sy, r * 3.4);
        rg.addColorStop(0, clima.sol > 1.5 ? "rgba(255,240,170,.95)" : "rgba(255,255,230,.9)"); rg.addColorStop(0.3, "rgba(255,230,150,.4)"); rg.addColorStop(1, "rgba(255,230,150,0)");
        gF.globalAlpha = al; gF.fillStyle = rg; gF.beginPath(); gF.arc(sx, sy, r * 3.4, 0, 7); gF.fill(); gF.globalAlpha = 1;
      }
      // nubes que van a su aire
      const cuantasNubes = Math.round(clima.nubes);
      nubes.slice(0, cuantasNubes).forEach(nb => {
        const x = ((nb.m - ahora * 8 * nb.v - camGr * gp * 0.02) % (W + 300) + (W + 300)) % (W + 300) - 150, y = hz * nb.y * 2.2;
        gF.fillStyle = "rgba(255,255,255," + (clima.oscuro > 0.15 ? 0.3 : 0.62) + ")";
        for (let k = 0; k < 4; k++) { gF.beginPath(); gF.ellipse(x + k * nb.w * 0.28, y + (k % 2) * 4, nb.w * 0.34, nb.w * 0.16, 0, 0, 7); gF.fill(); }
      });
      // colinas lejanas
      gF.fillStyle = mezcla(suelo.lejos, clima.cielo[1], 0.35 + clima.niebla * 0.4);
      gF.beginPath(); gF.moveTo(0, hz);
      colinas.forEach(cl => { const x = W / 2 + (cl.m - camGr) * gp * 0.1; gF.lineTo(x - cl.a * 0.5, hz); gF.quadraticCurveTo(x, hz - cl.h * 46, x + cl.a * 0.5, hz); });
      gF.lineTo(W, hz); gF.closePath(); gF.fill();
      // árboles / rocas / cactus según el suelo, con parallax
      arboles.forEach(a => {
        const x = W / 2 + (a.m - camGr) * gp * 0.32; if (x < -50 || x > W + 50) return;
        const alto = (22 + a.h * 28) * (0.8 + a.t * 0.4), y = hz + 3;
        if (nombreSuelo === "cristal") {          // cristales que brillan
          gF.fillStyle = mezcla("#9a86f0", clima.cielo[1], 0.2); gF.beginPath(); gF.moveTo(x - 7, y); gF.lineTo(x - 2, y - alto * 1.05); gF.lineTo(x + 3, y - alto * 0.6); gF.lineTo(x + 8, y); gF.closePath(); gF.fill();
          gF.fillStyle = "rgba(255,255,255,.35)"; gF.beginPath(); gF.moveTo(x - 2, y - alto * 1.05); gF.lineTo(x + 3, y - alto * 0.6); gF.lineTo(x - 1, y - alto * 0.5); gF.closePath(); gF.fill();
        } else if (nombreSuelo === "nube") {      // islas de nube
          gF.fillStyle = "rgba(255,255,255,.75)"; for (let q = 0; q < 3; q++) { gF.beginPath(); gF.ellipse(x + q * 14 - 14, y - alto * 0.5 - q % 2 * 5, 15, 8, 0, 0, 7); gF.fill(); }
        } else if (nombreSuelo === "pantano") {   // árboles secos y juncos
          gF.strokeStyle = mezcla("#3a2f24", clima.cielo[1], 0.2); gF.lineWidth = 3; gF.beginPath(); gF.moveTo(x, y); gF.lineTo(x, y - alto * 0.9); gF.moveTo(x, y - alto * 0.55); gF.lineTo(x + 9, y - alto * 0.85); gF.moveTo(x, y - alto * 0.7); gF.lineTo(x - 8, y - alto); gF.stroke();
        } else if (nombreSuelo === "brasa") {     // agujas de roca con la punta al rojo
          gF.fillStyle = mezcla("#2c1a16", clima.cielo[1], 0.15); gF.beginPath(); gF.moveTo(x - 9, y); gF.lineTo(x - 1, y - alto * 1.1); gF.lineTo(x + 9, y); gF.closePath(); gF.fill();
          gF.fillStyle = "rgba(255,120,40," + (0.55 + 0.3 * Math.sin(ahora * 3 + a.c * 9)) + ")"; gF.beginPath(); gF.moveTo(x - 3.5, y - alto * 0.8); gF.lineTo(x - 1, y - alto * 1.1); gF.lineTo(x + 2.4, y - alto * 0.78); gF.closePath(); gF.fill();
        } else if (nombreSuelo === "arena") {          // cactus
          gF.fillStyle = mezcla("#5a8a47", clima.cielo[1], 0.25 + clima.niebla * 0.4);
          gF.fillRect(x - 3, y - alto, 6, alto); gF.fillRect(x - 11, y - alto * 0.65, 5, alto * 0.3); gF.fillRect(x + 6, y - alto * 0.8, 5, alto * 0.3);
        } else if (nombreSuelo === "arcilla") { // rocas y troncos secos
          gF.fillStyle = mezcla("#6a4a3a", clima.cielo[1], 0.25 + clima.niebla * 0.4);
          gF.beginPath(); gF.moveTo(x - 14, y); gF.lineTo(x - 6, y - alto * 0.55); gF.lineTo(x + 4, y - alto * 0.4); gF.lineTo(x + 14, y); gF.closePath(); gF.fill();
        } else {                               // árboles redondos
          gF.fillStyle = mezcla("#5a4030", clima.cielo[1], 0.2 + clima.niebla * 0.4); gF.fillRect(x - 2, y - alto * 0.45, 4, alto * 0.45);
          gF.fillStyle = mezcla(a.c < 0.5 ? "#2e7d3f" : "#3b8f46", clima.cielo[1], 0.2 + clima.niebla * 0.45);
          gF.beginPath(); gF.arc(x, y - alto * 0.65, alto * 0.38, 0, 7); gF.fill();
        }
      });
      // pista
      const y0 = hz + 6;
      g = gF.createLinearGradient(0, y0, 0, H);
      g.addColorStop(0, mezcla(suelo.orilla, "#000000", hum * 0.4)); g.addColorStop(0.08, mezcla(suelo.pista, "#2a1a10", hum * 0.8)); g.addColorStop(1, mezcla(suelo.pista, "#2a1a10", hum * 0.8 + 0.12));
      gF.fillStyle = g; gF.fillRect(0, y0, W, H - y0);
      // franjas del cortado (hierba) o surcos (arcilla y arena)
      const anchoFranja = 15 * gp;
      const x0 = ((W / 2 - camGr * gp) % (anchoFranja * 2) + anchoFranja * 2) % (anchoFranja * 2);
      gF.fillStyle = mezcla(suelo.franja, "#2a1a10", hum * 0.8); gF.globalAlpha = nombreSuelo === "hierba" ? 0.5 : 0.22;
      for (let x = x0 - anchoFranja * 2; x < W; x += anchoFranja * 2) gF.fillRect(x, y0 + 14, anchoFranja, H - y0);
      gF.globalAlpha = 1;
      // charcos y barro según el estado
      if (hum > 0.2) charcos.forEach(c => {
        const x = W / 2 + (c.m - camGr) * gp; if (x < -100 || x > W + 100) return;
        const y = y0 + 22 + c.f * (H - y0 - 26);
        gF.fillStyle = "rgba(" + (hum > 0.45 ? "60,40,26" : "120,150,170") + "," + (0.18 + hum * 0.4) + ")";
        gF.beginPath(); gF.ellipse(x, y, c.w * (0.6 + c.f * 0.6), 3 + c.f * 5, 0, 0, 7); gF.fill();
        gF.fillStyle = "rgba(255,255,255,.15)"; gF.beginPath(); gF.ellipse(x - c.w * 0.15, y - 1, c.w * 0.25, 1.2, 0, 0, 7); gF.fill();
      });
      // líneas de carril que corren con el suelo
      gF.strokeStyle = "rgba(255,255,255,.22)"; gF.lineWidth = 1.3; gF.setLineDash([22, 26]); gF.lineDashOffset = (camGr * gp) % 48;
      for (let i = 1; i < lanes; i++) { const f = (i - 0.5) / Math.max(1, lanes - 1), y = H * CBASE - f * H * CANCHO + 4; gF.beginPath(); gF.moveTo(0, y); gF.lineTo(W, y); gF.stroke(); }
      gF.setLineDash([]);
      // valla lejana y marcas de distancia
      gF.fillStyle = "rgba(255,255,255,.8)"; gF.fillRect(0, y0 + 6, W, 2);
      const pasoPoste = 9 * gp, px0 = ((W / 2 - camGr * gp) % pasoPoste + pasoPoste) % pasoPoste;
      gF.fillStyle = "rgba(240,240,235,.9)";
      for (let x = px0 - pasoPoste; x < W; x += pasoPoste) gF.fillRect(x, y0 - 4, 2.4, 11);
      for (let m = 100; m < dist; m += 100) {
        const x = W / 2 + (m - camGr) * gp; if (x < -40 || x > W + 40) continue;
        gF.fillStyle = "#f7f3e2"; gF.fillRect(x - 15, y0 - 20, 30, 14); gF.fillStyle = "#222"; gF.font = "700 10px sans-serif"; gF.textAlign = "center"; gF.fillText(String(dist - m), x, y0 - 10);
      }
      // salida y meta con sus tribunas
      const xm = m => W / 2 + (m - camGr) * gp;
      [[0, "SALIDA"], [dist, "META"]].forEach(([m, txt]) => {
        const x = xm(m); if (x < -260 || x > W + 260) return;
        gF.fillStyle = "#4a3a30"; gF.fillRect(x - 130, y0 - 46, 130, 40);
        gF.fillStyle = "#2c2420"; gF.fillRect(x - 130, y0 - 10, 130, 6);
        for (let k = 0; k < 90; k++) { const r = azar(k * 977 + m)(); gF.fillStyle = ["#e85d5d", "#f1c84b", "#5da9e8", "#8bd36a", "#f5f0e6", "#c77ae8"][Math.floor(r * 6)]; gF.fillRect(x - 126 + (k % 30) * 4.2, y0 - 42 + Math.floor(k / 30) * 11 + ((ahora * 3 + k) % 7 < 0.5 ? -1 : 0), 3, 3.4); }
        gF.fillStyle = "#f7f3e2"; gF.fillRect(x - 130, y0 - 58, 130, 12); gF.fillStyle = "#222"; gF.font = "700 9px sans-serif"; gF.textAlign = "center"; gF.fillText(txt, x - 65, y0 - 49);
      });
      // la regla de la pista arcana: los tramos donde actúa se ven
      if (arcana && zonas.length) {
        const col = COLOR_ZONA[arcana] || "255,255,255";
        zonas.forEach((on, s) => {
          if (!on) return;
          const xa = xm(s * 100), xb = xm(s * 100 + 100); if (xb < 0 || xa > W) return;
          const gz = gF.createLinearGradient(0, y0, 0, H); gz.addColorStop(0, "rgba(" + col + ",0)"); gz.addColorStop(1, "rgba(" + col + "," + (arcana === "corrientes" ? 0.22 : 0.2) + ")");
          gF.fillStyle = gz; gF.fillRect(xa, y0, xb - xa, H - y0);
          if (arcana === "ilusion") { gF.strokeStyle = "rgba(" + col + "," + (0.35 + 0.25 * Math.sin(ahora * 4 + s)) + ")"; gF.lineWidth = 1.4; for (let q = 0; q < 6; q++) { const xx = xa + (xb - xa) * (q + 0.5) / 6; gF.beginPath(); gF.moveTo(xx, y0 + 4); gF.lineTo(xx + 14, H); gF.stroke(); } }
          if (arcana === "corrientes") { gF.strokeStyle = "rgba(255,255,255,.55)"; gF.lineWidth = 1.6; for (let q = 0; q < 7; q++) { const yy = y0 + 20 + q * ((H - y0 - 30) / 7), off = ((ahora * 160 + q * 53 + s * 31) % (xb - xa)); gF.beginPath(); gF.moveTo(xa + off, yy); gF.lineTo(Math.min(xb, xa + off + 38), yy - 9); gF.stroke(); } }
        });
        if (arcana === "sumidero" || arcana === "brasas") { gF.fillStyle = "rgba(" + col + ",0.08)"; gF.fillRect(0, y0, W, H - y0); }
        if (arcana === "brasas") { gF.fillStyle = "rgba(255,170,80,.7)"; for (let q = 0; q < 26; q++) { const xx = (q * 97 + ahora * 20) % W, yy = H - ((ahora * 40 + q * 61) % (H - y0)); gF.fillRect(xx, yy, 2, 2); } }
      }
      // la línea de meta
      const xf = xm(dist);
      if (xf > -10 && xf < W + 10) {
        for (let k = 0; k * 8 < H - y0 + 10; k++) { gF.fillStyle = k % 2 ? "#111" : "#f4f1e6"; gF.fillRect(xf - 3, y0 + k * 8, 6, 8); }
        for (let k = 0; k * 8 < H - y0 + 10; k++) { gF.fillStyle = k % 2 ? "#f4f1e6" : "#111"; gF.fillRect(xf + 3, y0 + k * 8, 6, 8); }
      }
      if (extra) extra({ g: gF, W, H, y0, hz, xm, gp, camGr, ahora, clima, hum, suelo, carril });
      // calor: ondas sobre la pista
      if (clima.sol > 1.5) { gF.fillStyle = "rgba(255,200,120,.12)"; for (let i = 0; i < 5; i++) gF.fillRect(0, y0 + 14 + i * 22 + Math.sin(ahora * 2 + i) * 3, W, 5); }
      // velo de clima
      if (clima.oscuro > 0.005) { gF.fillStyle = "rgba(10,14,24," + clima.oscuro + ")"; gF.fillRect(0, 0, W, H); }
    }

    function frente(camGr, gp, ahora, dt, T, extra) {
      avanzarClima(dt);
      gT.clearRect(0, 0, W, H);
      // valla cercana (pasa más rápido: está más cerca de la cámara)
      const yv = H - 20, paso = 62 * 1.0, dxv = camGr * gp * 1.7, xv0 = ((W / 2 - dxv) % paso + paso) % paso;
      gT.fillStyle = "rgba(0,0,0,.35)"; gT.fillRect(0, yv + 4, W, 16);
      gT.fillStyle = "#e8e2d0"; gT.fillRect(0, yv, W, 4); gT.fillRect(0, yv + 12, W, 3);
      for (let x = xv0 - paso; x < W; x += paso) { gT.fillStyle = "#d8d0b8"; gT.fillRect(x, yv - 4, 6, 24); }
      if (extra) extra({ g: gT, W, H, gp, camGr, ahora, dt });
      // lluvia
      const gotasN = Math.floor(clima.lluvia);
      if (gotasN > 0) {
        gT.strokeStyle = "rgba(200,220,240,.5)"; gT.lineWidth = 1; gT.beginPath();
        const viento = clima.rayos ? 0.5 : 0.22;
        for (let i = 0; i < gotasN; i++) {
          const g = gotas[i];
          g.y += dt * g.v * (clima.rayos ? 1.4 : 0.9); g.x -= dt * viento * 0.4;
          if (g.y > 1.05) { g.y = -0.05; g.x = Math.random(); }
          if (g.x < -0.05) g.x += 1.1;
          const x = g.x * W, y = g.y * H; gT.moveTo(x, y); gT.lineTo(x - g.l * viento, y + g.l);
        }
        gT.stroke();
      }
      // niebla en bandas que se mueven
      if (clima.niebla > 0.004) for (let i = 0; i < 4; i++) {
        const y = H * (0.34 + i * 0.16), xo = ((ahora * (10 + i * 5) + i * 300) % (W + 600)) - 300;
        const rg = gT.createLinearGradient(0, y - 40, 0, y + 40); rg.addColorStop(0, "rgba(225,230,232,0)"); rg.addColorStop(0.5, "rgba(225,230,232," + clima.niebla * 0.55 + ")"); rg.addColorStop(1, "rgba(225,230,232,0)");
        gT.fillStyle = rg; gT.fillRect(xo - 400, y - 40, W + 800, 80);
      }
      // relámpagos: a horas fijas de la carrera (toma de la página principal) o al azar mientras dure la tormenta (página inmersiva)
      if (rayosT.length) rayosT.forEach(t => { if (T >= t && T < t + 0.5 && flash <= 0) flash = 1; });
      else if (cfg.rayosAzar && clima.rayos && ahora >= proximoRayo) { flash = 1; proximoRayo = ahora + 5 + Math.random() * 10; }
      if (flash > 0) { gT.fillStyle = "rgba(255,255,255," + flash * 0.55 + ")"; gT.fillRect(0, 0, W, H); flash -= dt * 3; }
    }

    return { medir, fondo, frente, carril, ponerClima, estado: () => ({ clima, hum }) };
  }

  /* ---------------------------------------------------------------- la pista */
  function crear(cont, cfg) {
    const { res, carriles, ultimo, D } = cfg;
    const dist = res.dist, n = carriles.length;
    const tr = trayectorias(res, carriles, ultimo);
    const durRace = tr.durRace, factor = tr.factor;
    const semilla = hash("pista" + res.n + res.pista + res.clima);
    const marcadas = cfg.marcadas || new Set();
    const incidentes = (res.incidentes || []).slice();

    cont.innerHTML = '<div class="hpx"><canvas class="hpx-fondo"></canvas><div class="hpx-caballos"></div><canvas class="hpx-frente"></canvas>' +
      '<div class="hpx-hud"><div class="hpx-faltan"><strong id="hpxFaltan"></strong><span id="hpxTiempo"></span></div><ol class="hpx-top" id="hpxTop"></ol></div>' +
      '<div class="hpx-cuenta" id="hpxCuenta"></div>' +
      '<div class="hpx-mini"><div class="hpx-mini-barra" id="hpxMini"></div><span class="hpx-mini-meta">META</span></div></div>';
    const raiz = cont.firstChild, cFondo = raiz.querySelector(".hpx-fondo"), cFrente = raiz.querySelector(".hpx-frente"), capa = raiz.querySelector(".hpx-caballos");
    const elFaltan = raiz.querySelector("#hpxFaltan"), elTiempo = raiz.querySelector("#hpxTiempo"), elTop = raiz.querySelector("#hpxTop"), elCuenta = raiz.querySelector("#hpxCuenta"), elMini = raiz.querySelector("#hpxMini");

    const esc = escenario(cFondo, cFrente, {
      dist, lanes: n, clima: res.clima, estadoPista: res.estadoPista, suelo: cfg.suelo, cuestas: cfg.cuestas, arcana: cfg.arcana || null, zonas: cfg.zonas || [], semilla,
      rayosDur: durRace   // si hay tormenta, seis relámpagos repartidos por la carrera
    });
    let W = 0, H = 0, dpr = 1;
    function medir() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(320, raiz.clientWidth);
      H = Math.round(clamp(W * 0.36, 300, 470));
      raiz.style.height = H + "px";
      esc.medir(W, H, dpr);
    }
    medir();
    const obs = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => medir()) : null;
    if (obs) obs.observe(raiz);

    // ---- los corredores
    const cors = tr.lista.map((q, i) => {
      const c = q.c, el = document.createElement("div");
      el.className = "hpx-cab";
      el.innerHTML = D.silueta(c.per, { clase: "hip-silueta corre", numero: c.puerta }) +
        '<span class="hpx-nombre' + (marcadas.has(c.id) ? " mia" : "") + '">' + (marcadas.has(c.id) ? "★ " : "") + String(c.nombre).replace(/[<>&]/g, "") + "</span><span class=\"hpx-aviso\"></span>";
      capa.appendChild(el);
      return Object.assign(q, { mDe: q.metros, i, el, svg: el.querySelector("svg"), aviso: el.querySelector(".hpx-aviso"), parado: false, lugar: i + 1, metros: 0, vista: 0 });
    });

    // ---- cámara
    let pxM = 12, camG = 0, iniciada = false, ultimoEl = null;

    /* ------------------------------------------------------------ cada cuadro */
    function dibujar(el) {
      const ahora = el, dt = ultimoEl == null ? 0.016 : clamp(el - ultimoEl, 0, 0.12); ultimoEl = el;
      const Tv = Math.max(0, el - PRE), T = Tv * factor;
      // metros de cada criatura
      cors.forEach(k => { k.metros = k.mDe(T); if (Tv > durRace + 0.0001 && k.metros < dist) k.metros = dist; });
      const orden = cors.slice().sort((a, b) => (b.metros - a.metros) || (a.c.pos - b.c.pos));
      // a quien ya cruzó la meta se le ordena por su puesto oficial
      const fin = cors.filter(k => T >= k.tFin).sort((a, b) => a.c.pos - b.c.pos), enCarrera = orden.filter(k => T < k.tFin);
      const lista = fin.concat(enCarrera);
      lista.forEach((k, i) => { k.lugar = i + 1; });
      const lider = lista[0], L = lider.metros + (T >= lider.tFin ? 10 * (1 - Math.exp(-(T - lider.tFin) / factor / 1.1)) : 0);
      // zoom: que quepa casi todo el pelotón; si van pegados, se acerca
      const kRef = lista[Math.min(lista.length - 1, Math.ceil(lista.length * 0.8) - 1)];
      const spread = Math.max(6, L - kRef.metros);
      const objPx = clamp(W * 0.6 / spread, 2.6, 22);
      const gp = clamp(objPx, 4.5, 9);
      if (!iniciada) { pxM = objPx; camG = 0; iniciada = true; }
      pxM += (objPx - pxM) * Math.min(1, dt * 3.4);
      const objCam = Math.min(L - 0.22 * W / gp, dist - 0.2 * W / gp + (Tv > durRace * 0.98 ? 0 : 0));
      camG += (objCam - camG) * Math.min(1, dt * (iniciada ? 5 : 100));
      if (Tv <= 0) camG = -0.1 * W / gp;      // antes de la salida: la cámara espera con las puertas en pantalla
      const xDe = m => W / 2 + (m - camG) * gp;
      const xLider = xDe(L);

      esc.fondo(camG, gp, ahora);

      // los corredores
      const base = Math.min(220, W * 0.2), bw = base, bh = base * 148 / 240;
      cors.forEach(k => {
        const info = esc.carril(k.i);
        const mv = k.metros + (T >= k.tFin ? 10 * (1 - Math.exp(-(T - k.tFin) / factor / 1.1)) : 0);
        const x = xLider + (mv - L) * pxM;
        const w = bw * info.escala, h = bh * info.escala;
        k.el.style.width = w + "px";
        let giro = 0, bajo = 0;
        if (k.tropiezo != null) { const u = (el - k.tropiezo) / 0.7; if (u >= 1) k.tropiezo = null; else { giro = -11 * Math.sin(Math.PI * u) * (1 - u * 0.4); bajo = 5 * Math.sin(Math.PI * u) * h / 100; } }
        if (k.cojo) bajo += Math.abs(Math.sin(el * 9)) * 3.5 * h / 100;
        k.el.style.transform = "translate(" + (x - w * 0.5).toFixed(1) + "px," + (info.yPies - h * 0.92 + bajo).toFixed(1) + "px)" + (giro ? " rotate(" + giro.toFixed(1) + "deg)" : "");
        k.el.style.zIndex = info.z;
        k.el.classList.toggle("lider", k.lugar === 1 && T < k.tFin && k.metros > 20);
        const fuera = x < -w || x > W + w;
        k.el.style.visibility = fuera ? "hidden" : "visible";
        const parar = Tv <= 0 || T >= k.tFin + 2.2 * factor;
        D.galope(k.svg, !parar);
        k.el.classList.toggle("fin", T >= k.tFin);
      });
      // incidentes
      incidentes.forEach(inc => {
        if (inc.visto) return;
        const k = cors.find(x => x.c.id === inc.id);
        if (k && k.metros >= inc.tramo * 100 + 50) {
          inc.visto = true;
          if (inc.tipo === "lesion") k.cojo = true; else k.tropiezo = el;
          k.aviso.textContent = inc.tipo === "lesion" ? "✚" : "!"; k.aviso.className = "hpx-aviso on " + inc.tipo;
          if (inc.tipo !== "lesion") setTimeout(() => { k.aviso.className = "hpx-aviso"; }, 1700);
        }
      });
      esc.frente(camG, gp, ahora, dt, Tv);

      // marcador: metros que faltan y los 5 primeros
      const falta = Math.max(0, Math.round((dist - lider.metros) / 10) * 10);
      elFaltan.textContent = T >= lider.tFin ? "¡META!" : "Faltan " + falta + " m";
      elTiempo.textContent = Tv <= 0 ? "" : "  " + Math.floor(T / 60) + ":" + String(Math.floor(T % 60)).padStart(2, "0");
      const topHtml = lista.slice(0, 5).map(k => '<li><b>' + k.lugar + '</b><i style="background:' + colorDe(k.c.id) + '"></i>' + String(k.c.nombre).replace(/[<>&]/g, "") + "</li>").join("");
      if (elTop._h !== topHtml) { elTop.innerHTML = topHtml; elTop._h = topHtml; }
      // cuenta atrás
      const cuenta = el < PRE ? (el < PRE - 0.1 ? String(Math.ceil(PRE - el)) : "¡YA!") : (Tv < 0.9 ? "¡YA!" : "");
      if (elCuenta._h !== cuenta) { elCuenta.textContent = cuenta; elCuenta.className = "hpx-cuenta" + (cuenta ? " on" : ""); elCuenta._h = cuenta; }
      // barra de progreso con un punto por criatura
      const miniHtml = cors.map(k => '<i style="left:' + (clamp(k.metros / dist, 0, 1) * 100).toFixed(1) + '%;background:' + colorDe(k.c.id) + '" title="' + String(k.c.nombre).replace(/["<>&]/g, "") + '"></i>').join("");
      elMini.innerHTML = miniHtml;
      const hecho = el >= PRE + durRace + COLA;
      return { metrosLider: lider.metros, fin: T >= lider.tFin, hecho, lugares: new Map(cors.map(k => [k.c.id, k.lugar])), finalizadas: fin.length };
    }

    function destruir() { if (obs) obs.disconnect(); }
    return { dibujar, destruir, duracion: PRE + durRace + COLA, previa: PRE };
  }

  return { crear, trayectorias, escenario, duracionCarrera, PRE, COLA, CLIMA, SUELO, HUM, colorDe, mezcla, hash, azar, clamp };
})();
