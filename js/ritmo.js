/* Juego de ritmo de dos carriles (en la línea de Muse Dash). Los golpes salen de la
   propia canción: al abrirla se analiza el audio, se buscan los ataques de sonido y
   se reparten por carril (graves al suelo, agudos al aire). El reloj del juego es el
   del audio, así que la música y las notas no se separan aunque la imagen se trabe.
   Campo de tamaño lógico fijo (960x540), igual que el resto de minijuegos. */
(function () {
  "use strict";

  const W = 960;
  const H = 540;
  const X_GOLPE = 210;
  const CLAVE_RECORDS = "compendioRitmoRecords";
  const CLAVE_AJUSTES = "compendioRitmoAjustes";
  const HOP = 512;

  const CARRILES = {
    arriba: { y: 175, color: "#8fdcff", etiqueta: "Z · D · F" },
    abajo: { y: 385, color: "#e8837b", etiqueta: "X · J · K" }
  };
  const TECLAS = { z: "arriba", d: "arriba", f: "arriba", arrowup: "arriba", x: "abajo", j: "abajo", k: "abajo", arrowdown: "abajo" };

  /* nps = notas por segundo que se buscan; hueco = separación mínima entre notas (s);
     aproximacion = segundos que tarda una nota desde el borde hasta el punto de golpe;
     sub = partes en que se divide cada pulso para colocar notas (1 = solo pulsos, 2 =
     mitades, 4 = cuartos); corte = fuerza mínima del ataque para que haya nota; perfecto / bien =
     ventanas de acierto (s); vidaFallo = vida que quita cada fallo; dobles = hay notas
     que piden los dos carriles a la vez (huecoDoble = separación mínima entre ellas);
     largas = fracción de notas que se mantienen pulsadas. */
  const DIFICULTADES = {
    facil: { nombre: "Fácil", nps: 1.5, hueco: 0.42, aproximacion: 1.6, sub: 1, corte: 0.6, perfecto: 0.06, bien: 0.12, vidaFallo: 5, dobles: false, largas: 0 },
    normal: { nombre: "Normal", nps: 2.6, hueco: 0.28, aproximacion: 1.3, sub: 2, corte: 0.42, perfecto: 0.05, bien: 0.11, vidaFallo: 7, dobles: false, largas: 0 },
    dificil: { nombre: "Difícil", nps: 4.0, hueco: 0.19, aproximacion: 1.0, sub: 2, corte: 0.28, perfecto: 0.04, bien: 0.09, vidaFallo: 9, dobles: true, huecoDoble: 0.9, largas: 0.2 },
    experto: { nombre: "Experto", nps: 5.2, hueco: 0.12, aproximacion: 0.85, sub: 4, corte: 0.15, perfecto: 0.035, bien: 0.08, vidaFallo: 12, dobles: true, huecoDoble: 0.6, largas: 0.25 }
  };

  const canvas = document.getElementById("rtCampo");
  const ctxC = canvas.getContext("2d");
  const escenarioEl = document.getElementById("rtEscenario");
  const brilloEl = document.getElementById("rtBrillo");
  const menuEl = document.getElementById("rtMenu");
  const cancionesEl = document.getElementById("rtCanciones");
  const dificultadesEl = document.getElementById("rtDificultades");
  const desfaseEl = document.getElementById("rtDesfase");
  const desfaseTxtEl = document.getElementById("rtDesfaseTxt");
  const practicaEl = document.getElementById("rtPractica");
  const recordEl = document.getElementById("rtRecord");
  const jugarEl = document.getElementById("rtJugar");
  const cargaEl = document.getElementById("rtCarga");
  const cargaTxtEl = document.getElementById("rtCargaTxt");
  const finEl = document.getElementById("rtFin");
  const pausaEl = document.getElementById("rtPausa");
  const buzonEl = document.getElementById("rtBuzon");
  const lobbyEl = document.getElementById("rtLobby");
  const buscarEl = document.getElementById("rtBuscar");
  const tituloEl = document.getElementById("rtTitulo");
  const metaEl = document.getElementById("rtMeta");
  const puntajesEl = document.getElementById("rtPuntajes");
  const puntajesTabsEl = document.getElementById("rtPuntajesTabs");
  const finPuntajesEl = document.getElementById("rtFinPuntajes");
  const pieEl = document.getElementById("rtPie");

  /* --- Datos guardados ---------------------------------------------------- */
  let records = {};
  let ajustes = { desfase: 0, practica: false, dificultad: "normal", cancion: 0, ruta: "" };
  try { records = JSON.parse(localStorage.getItem(CLAVE_RECORDS) || "{}") || {}; } catch (e) { records = {}; }
  try { ajustes = Object.assign(ajustes, JSON.parse(localStorage.getItem(CLAVE_AJUSTES) || "{}")); } catch (e) { /* sin almacenamiento */ }
  function guardarAjustes() { try { localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(ajustes)); } catch (e) { /* sin almacenamiento */ } }
  function guardarRecords() { try { localStorage.setItem(CLAVE_RECORDS, JSON.stringify(records)); } catch (e) { /* sin almacenamiento */ } }

  /* Solo entran canciones de hasta 6 minutos: más largas dan mapas enormes y tardan en analizarse.
     Las duraciones salen de data/musica-duraciones.js; si una canción no está ahí se mide al
     cargarla (ver cargarCancion). */
  const LIMITE_S = 360;
  const duraciones = window.MUSICA_DURACIONES || {};
  function partirNombre(nombre) {
    const m = nombre.match(/^(.*\S) - ([^-]+)$/);
    return m ? { titulo: m[1].trim(), artista: m[2].trim() } : { titulo: nombre, artista: "" };
  }
  const todas = (window.MUSICA || []).map(ruta => {
    let nombre = ruta.split("/").pop();
    try { nombre = decodeURIComponent(nombre); } catch (e) { /* nombre tal cual */ }
    nombre = nombre.replace(/\.[^.]+$/, "");
    return Object.assign({ ruta, nombre, dur: duraciones[ruta] || 0 }, partirNombre(nombre));
  });
  const canciones = todas.filter(c => !c.dur || c.dur <= LIMITE_S);
  if (!canciones.length) canciones.push({ ruta: "", nombre: "No hay canciones", titulo: "No hay canciones", artista: "", dur: 0 });
  {
    // Las preferencias guardadas antes eran un número de lista; se pasa a la ruta de la canción
    const rutaGuardada = ajustes.ruta || ((window.MUSICA || [])[ajustes.cancion] || "");
    const k = canciones.findIndex(c => c.ruta === rutaGuardada);
    ajustes.cancion = k >= 0 ? k : 0;
    ajustes.ruta = canciones[ajustes.cancion].ruta;
  }

  function duracionTexto(s) {
    const t = Math.round(s);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  }
  function esc(t) {
    return String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* --- Análisis de la canción -------------------------------------------- */
  /* El mapa se arma en cuatro pasos para que las notas sigan un ritmo y no "todo lo que
     suena":
       1. Tres bandas de energía por tramo: graves (< 150 Hz), medios (voz y melodía) y
          agudos (> 2,5 kHz), y el salto de energía de cada una (los ataques).
       2. Tempo: se estima por ventanas de 10 s y solo cambia cuando el cambio se mantiene,
          y un seguidor de pulso (programación dinámica) coloca los tiempos fuertes
          adaptándose a ese tempo, así que aguanta cambios de BPM.
       3. Tramos de 8 pulsos: en cada uno se elige UNA banda a seguir, la que marca el
          ritmo con más claridad sobre el pulso, y solo se usan sus ataques. Para no
          saltar de una a otra sin parar, se cambia solo si la nueva gana por bastante.
       4. Las notas van sobre la cuadrícula del pulso (cada pulso, mitades o cuartos según
          la dificultad), así que el patrón es regular y se puede seguir con las manos. */
  const PESO_BANDA = { bajo: 1, medio: 0.9, alto: 0.75 };

  function bandas(buffer) {
    const sr = buffer.sampleRate;
    const c0 = buffer.getChannelData(0);
    const c1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : c0;
    const n = Math.floor(buffer.length / HOP);
    const bajo = new Float32Array(n);
    const medio = new Float32Array(n);
    const alto = new Float32Array(n);
    const a1 = 1 - Math.exp(-2 * Math.PI * 150 / sr);
    const a2 = 1 - Math.exp(-2 * Math.PI * 2500 / sr);
    let lp1 = 0;
    let lp2 = 0;
    for (let i = 0; i < n; i++) {
      let sb = 0;
      let sm = 0;
      let sa = 0;
      const ini = i * HOP;
      for (let k = ini; k < ini + HOP; k++) {
        const x = (c0[k] + c1[k]) * 0.5;
        lp1 += a1 * (x - lp1);
        lp2 += a2 * (x - lp2);
        const m = lp2 - lp1;
        const h = x - lp2;
        sb += lp1 * lp1;
        sm += m * m;
        sa += h * h;
      }
      bajo[i] = Math.sqrt(sb / HOP);
      medio[i] = Math.sqrt(sm / HOP);
      alto[i] = Math.sqrt(sa / HOP);
    }
    return { bajo, medio, alto, sr };
  }

  /* Ataques de una banda: subidas bruscas de energía, normalizadas para que un ataque
     fuerte valga cerca de 1. */
  function ataques(rms) {
    const n = rms.length;
    const f = new Float32Array(n);
    let previo = 0;
    for (let i = 0; i < n; i++) {
      const e = Math.log(1 + 100 * rms[i]);
      f[i] = Math.max(0, e - previo);
      previo = e;
    }
    const v = Array.from(f).filter(x => x > 0).sort((a, b) => a - b);
    const escala = v.length ? v[Math.floor(v.length * 0.95)] || 1 : 1;
    for (let i = 0; i < n; i++) f[i] /= escala;
    return f;
  }

  function maximoMovil(f, radio) {
    const n = f.length;
    const o = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let m = 0;
      for (let j = Math.max(0, i - radio); j <= Math.min(n - 1, i + radio); j++) if (f[j] > m) m = f[j];
      o[i] = m;
    }
    return o;
  }

  /* Tempo local: autocorrelación del ataque total en ventanas de 10 s (cada 2 s), con
     preferencia por tempos cercanos a 120 BPM. Devuelve el periodo (en tramos) de cada
     tramo de la canción. Un tempo nuevo solo se acepta si aparece en dos ventanas
     seguidas, y una duplicación o mitad del tempo no cuenta como cambio. */
  function periodos(O, fps) {
    const n = O.length;
    const lagMin = Math.max(2, Math.floor((fps * 60) / 180));
    const lagMax = Math.ceil((fps * 60) / 65);
    const lagRef = fps * 0.5;
    const ventana = Math.round(10 * fps);
    const paso = Math.max(1, Math.round(2 * fps));
    const centros = [];
    const lags = [];
    let ultimo = lagRef;
    for (let c = 0; c < n + paso; c += paso) {
      const a = Math.max(0, c - ventana / 2);
      const b = Math.min(n, c + ventana / 2);
      let mejor = -1;
      let lagMejor = ultimo;
      for (let lag = lagMin; lag <= lagMax; lag++) {
        let suma = 0;
        for (let i = Math.floor(a); i + lag < b; i++) suma += O[i] * O[i + lag];
        const cuenta = Math.max(1, b - a - lag);
        const peso = Math.exp(-0.5 * Math.pow(Math.log2(lag / lagRef) / 0.8, 2));
        const puntaje = (suma / cuenta) * peso;
        if (puntaje > mejor) { mejor = puntaje; lagMejor = lag; }
      }
      if (mejor < 1e-4) lagMejor = ultimo;
      ultimo = lagMejor;
      centros.push(Math.min(c, n - 1));
      lags.push(lagMejor);
    }
    // Tempo global como punto de partida: la canción entera suele tener uno dominante
    let global = lagRef;
    let mejorG = -1;
    for (let lag = lagMin; lag <= lagMax; lag++) {
      let suma = 0;
      for (let i = 0; i + lag < n; i++) suma += O[i] * O[i + lag];
      const peso = Math.exp(-0.5 * Math.pow(Math.log2(lag / lagRef) / 0.8, 2));
      const puntaje = (suma / Math.max(1, n - lag)) * peso;
      if (puntaje > mejorG) { mejorG = puntaje; global = lag; }
    }
    // Dos tempos "parecen el mismo" si uno es el doble, la mitad, o 3:2 del otro: el
    // análisis confunde esas relaciones y saltaría de una a otra sin que haya cambio real.
    const parecido = (x, y) => {
      const d = Math.abs(Math.log2(x / y));
      return d < 0.07 || Math.abs(d - 1) < 0.07 || Math.abs(d - 0.585) < 0.07 || Math.abs(d - 1.585) < 0.07;
    };
    let actual = global;
    let candidato = 0;
    let cuenta = 0;
    const suaves = lags.map(l => {
      if (parecido(l, actual)) {
        if (Math.abs(Math.log2(l / actual)) < 0.07) actual = 0.85 * actual + 0.15 * l;
        candidato = 0; cuenta = 0;
      } else {
        if (candidato && Math.abs(Math.log2(l / candidato)) < 0.07) cuenta++; else { candidato = l; cuenta = 1; }
        if (cuenta >= 3) { actual = candidato; candidato = 0; cuenta = 0; }
      }
      return actual;
    });
    // Un periodo por tramo, interpolando entre los centros de ventana
    const T = new Float32Array(n);
    let k = 0;
    for (let i = 0; i < n; i++) {
      while (k + 1 < centros.length - 1 && centros[k + 1] <= i) k++;
      const c0 = centros[k];
      const c1 = centros[Math.min(k + 1, centros.length - 1)];
      const u = c1 > c0 ? Math.min(1, Math.max(0, (i - c0) / (c1 - c0))) : 0;
      T[i] = suaves[k] * (1 - u) + suaves[Math.min(k + 1, suaves.length - 1)] * u;
    }
    return T;
  }

  /* Seguidor de pulso por programación dinámica: cada pulso cae sobre ataques fuertes y
     a una distancia del anterior cercana al periodo local. Devuelve los tramos de cada
     pulso. */
  function seguirPulso(O, T) {
    const n = O.length;
    const C = new Float32Array(n);
    const previo = new Int32Array(n).fill(-1);
    const alfa = 400;
    for (let i = 0; i < n; i++) {
      const tau = T[i];
      const lo = Math.max(0, Math.round(i - 2 * tau));
      const hi = Math.round(i - tau / 2);
      let mejor = -Infinity;
      let mj = -1;
      for (let j = lo; j <= hi; j++) {
        const d = i - j;
        if (d <= 0) continue;
        const s = C[j] - alfa * Math.pow(Math.log(d / tau), 2);
        if (s > mejor) { mejor = s; mj = j; }
      }
      if (mj < 0) { C[i] = O[i]; } else { C[i] = O[i] + mejor; previo[i] = mj; }
    }
    let fin = n - 1;
    const desde = Math.max(0, n - Math.round(1.5 * T[n - 1]));
    for (let i = desde; i < n; i++) if (C[i] > C[fin]) fin = i;
    const pulsos = [];
    for (let i = fin; i >= 0; i = previo[i]) {
      pulsos.push(i);
      if (previo[i] < 0) break;
    }
    return pulsos.reverse();
  }

  /* Cuánto se sostiene un sonido tras su ataque: mientras la energía se mantiene por
     encima de la mitad del pico. Un golpe de batería cae enseguida; una voz o un
     acorde no. */
  function sostenido(rms, i) {
    let ref = 0;
    for (let j = i; j < Math.min(rms.length, i + 4); j++) ref = Math.max(ref, rms[j]);
    let j = i + 4;
    while (j < rms.length && rms[j] >= ref * 0.5 && j - i < 400) j++;
    return j - i;
  }

  /* Tiempos (s) de la cuadrícula entre los pulsos k0 y k1, con sd partes por pulso. */
  function cuadricula(pulsos, k0, k1, sd, fase) {
    const lista = [];
    for (let k = k0; k < k1 && k + 1 < pulsos.length; k++) {
      const periodo = pulsos[k + 1] - pulsos[k];
      for (let j = 0; j < sd; j++) lista.push(pulsos[k] + ((j + fase) / sd) * periodo);
    }
    return lista;
  }

  function crearMapa(buffer, dificultad) {
    const cfg = DIFICULTADES[dificultad];
    const { bajo, medio, alto, sr } = bandas(buffer);
    const n = bajo.length;
    const dur = buffer.duration;
    const fps = sr / HOP;
    const rms = { bajo, medio, alto };
    const fl = { bajo: ataques(bajo), medio: ataques(medio), alto: ataques(alto) };
    const mx = { bajo: maximoMovil(fl.bajo, 3), medio: maximoMovil(fl.medio, 3), alto: maximoMovil(fl.alto, 3) };
    const fuerzaEn = (banda, t) => mx[banda][Math.max(0, Math.min(n - 1, Math.round(t * fps)))];

    // 1-2. Tempo y pulso
    const O = new Float32Array(n);
    for (let i = 0; i < n; i++) O[i] = fl.bajo[i] + fl.medio[i] + fl.alto[i];
    const T = periodos(O, fps);
    const pulsos = seguirPulso(O, T).map(f => f / fps);

    // 3. Una banda por tramo de 8 pulsos
    const nombres = ["bajo", "medio", "alto"];
    const tramos = [];
    let previa = null;
    for (let k0 = 0; k0 + 1 < pulsos.length; k0 += 8) {
      const k1 = Math.min(pulsos.length - 1, k0 + 8);
      const dentro = cuadricula(pulsos, k0, k1, 2, 0);
      const fuera = cuadricula(pulsos, k0, k1, 2, 0.5);
      const puntaje = {};
      nombres.forEach(b => {
        const on = dentro.reduce((a, t) => a + fuerzaEn(b, t), 0) / Math.max(1, dentro.length);
        const off = fuera.reduce((a, t) => a + fuerzaEn(b, t), 0) / Math.max(1, fuera.length);
        puntaje[b] = on * (0.5 + on / (on + off + 1e-6)) * PESO_BANDA[b];
      });
      let mejor = nombres.reduce((a, b) => (puntaje[b] > puntaje[a] ? b : a));
      if (previa && mejor !== previa && puntaje[mejor] < puntaje[previa] * 1.3) mejor = previa;
      const vacio = puntaje[mejor] < 0.05;
      const otras = nombres.filter(b => b !== mejor);
      const segunda = puntaje[otras[0]] >= puntaje[otras[1]] ? otras[0] : otras[1];
      tramos.push({ k0, k1, banda: mejor, segunda, vacio });
      if (!vacio) previa = mejor;
    }

    // 4. Notas sobre la cuadrícula, solo con los ataques de la banda del tramo
    const candidatos = [];
    tramos.forEach((tr, idx) => {
      if (tr.vacio) return;
      cuadricula(pulsos, tr.k0, tr.k1, cfg.sub, 0).forEach(t => {
        if (t < 0.8 || t > dur - 0.5) return;
        const f = fuerzaEn(tr.banda, t);
        if (f >= cfg.corte) candidatos.push({ t, f, tramo: idx, banda: tr.banda, i: Math.max(0, Math.round(t * fps)) });
      });
    });
    candidatos.sort((a, b) => b.f - a.f);

    const celda = 0.02;
    const bloqueo = new Uint8Array(Math.ceil(dur / celda) + 2);
    const maximo = Math.round(dur * cfg.nps);
    const medioHueco = Math.round(cfg.hueco / celda);
    const notas = [];
    for (const c of candidatos) {
      if (notas.length >= maximo) break;
      const k = Math.round(c.t / celda);
      if (bloqueo[k]) continue;
      for (let j = Math.max(0, k - medioHueco); j <= Math.min(bloqueo.length - 1, k + medioHueco); j++) bloqueo[j] = 1;
      notas.push({ t: c.t, i: c.i, carril: "abajo", f: c.f, dur: 0, tramo: c.tramo, banda: c.banda });
    }
    notas.sort((a, b) => a.t - b.t);

    // Carril: por brillo del sonido respecto a su tramo (graves al suelo, brillantes al
    // aire); si no se distingue, se alterna para no repetir siempre el mismo carril
    const brillo = nota => {
      const i = Math.min(n - 1, nota.i + 1);
      const total = bajo[i] + medio[i] + alto[i] + 1e-9;
      return (0.5 * medio[i] + alto[i]) / total;
    };
    const porTramo = new Map();
    notas.forEach(nt => {
      nt.brillo = brillo(nt);
      if (!porTramo.has(nt.tramo)) porTramo.set(nt.tramo, []);
      porTramo.get(nt.tramo).push(nt.brillo);
    });
    const estadistica = new Map();
    porTramo.forEach((lista, idx) => {
      const orden = lista.slice().sort((a, b) => a - b);
      estadistica.set(idx, { med: orden[Math.floor(orden.length / 2)], delta: 0.15 * (orden[orden.length - 1] - orden[0]) });
    });
    let anterior = "abajo";
    notas.forEach(nt => {
      const e = estadistica.get(nt.tramo);
      const carril = nt.brillo > e.med + e.delta ? "arriba" : nt.brillo < e.med - e.delta ? "abajo" : (anterior === "abajo" ? "arriba" : "abajo");
      nt.carril = carril;
      anterior = carril;
    });

    // Dobles: en el primer pulso de cada compás, si otra banda también marca fuerte
    if (cfg.dobles) {
      let ultima = -99;
      for (const nt of notas) {
        if (nt.t - ultima < cfg.huecoDoble) continue;
        let kk = 0;
        let dmin = Infinity;
        for (let q = 0; q < pulsos.length; q++) { const d = Math.abs(pulsos[q] - nt.t); if (d < dmin) { dmin = d; kk = q; } if (pulsos[q] > nt.t + 0.5) break; }
        if (dmin > 0.045 || kk % 4 !== 0) continue;
        const otra = nombres.filter(b => b !== nt.banda).reduce((a, b) => Math.max(a, fuerzaEn(b, nt.t)), 0);
        if (nt.f >= 0.7 && otra >= 0.9) { nt.carril = "ambos"; ultima = nt.t; }
      }
    }

    // Largas: sonidos que se sostienen, siempre que quepan antes de la siguiente nota del carril
    if (cfg.largas) {
      const siguiente = { abajo: Infinity, arriba: Infinity };
      const candidatas = [];
      for (let k = notas.length - 1; k >= 0; k--) {
        const nt = notas[k];
        if (nt.carril === "ambos") { siguiente.abajo = nt.t; siguiente.arriba = nt.t; continue; }
        const largo = Math.min(2.5, siguiente[nt.carril] - 0.2 - nt.t, (sostenido(rms[nt.banda], nt.i) * HOP) / sr);
        if (largo >= 0.6 && nt.t + largo < dur - 0.6) candidatas.push({ nt, largo });
        siguiente[nt.carril] = nt.t;
      }
      candidatas.sort((a, b) => b.largo - a.largo);
      candidatas.slice(0, Math.floor(notas.length * cfg.largas)).forEach(c => { c.nt.dur = Math.round(c.largo * 100) / 100; });
    }

    // El fondo late con el pulso encontrado, así se ve si el tempo está bien seguido
    const pulso = new Float32Array(n);
    let b = 0;
    for (let f = 0; f < n; f++) {
      const t = f / fps;
      while (b + 1 < pulsos.length && pulsos[b + 1] <= t) b++;
      if (pulsos.length && t >= pulsos[0]) pulso[f] = Math.pow(Math.max(0, 1 - (t - pulsos[b]) / 0.4), 2);
    }

    const bpm = tramos.map(tr => {
      const a = pulsos[tr.k0];
      const z = pulsos[tr.k1];
      return z > a ? Math.round((60 * (tr.k1 - tr.k0)) / (z - a)) : 0;
    });
    return { notas, pulso, dur, sr, pulsos, tramos, bpm };
  }

  /* --- Estado de la partida ---------------------------------------------- */
  let audio = null;
  let bufferActual = null;
  let rutaBuffer = "";
  const mapas = new Map();
  let fuente = null;
  let inicioAudio = 0;
  let estado = "menu"; // menu | cargando | jugando | pausa | fin
  let mapa = null;
  let cfg = DIFICULTADES.normal;
  let cancionActual = null;
  let notas = [];
  let punteroFallos = 0;
  let activas = []; // largas que se están manteniendo
  let entradas = { arriba: new Set(), abajo: new Set() }; // teclas o dedos pulsados por carril
  let gracia = 0;
  let puntos = 0;
  let combo = 0;
  let comboMax = 0;
  let perfectos = 0;
  let buenos = 0;
  let fallos = 0;
  let extras = 0;
  let vida = 100;
  let efectos = [];
  let avatar = { y: CARRILES.abajo.y, carril: "abajo", salto: -10, golpe: -10 };
  let flash = { arriba: -10, abajo: -10 };
  let raf = 0;
  let cargaId = 0;

  function ahoraS() { return performance.now() / 1000; }

  /* Tiempo de la canción tal como se oye: reloj del audio menos la latencia de salida
     y el ajuste de sincronía del jugador. */
  function tiempoCancion() {
    if (!audio) return 0;
    const latencia = (audio.outputLatency || 0);
    return audio.currentTime - inicioAudio - latencia - ajustes.desfase / 1000;
  }

  async function prepararAudio() {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") await audio.resume();
  }

  async function cargarCancion(cancion) {
    if (rutaBuffer === cancion.ruta && bufferActual) return bufferActual;
    bufferActual = null;
    rutaBuffer = "";
    const resp = await fetch(encodeURI(cancion.ruta));
    if (!resp.ok) throw new Error("No se pudo descargar la canción");
    const datos = await resp.arrayBuffer();
    const buffer = await audio.decodeAudioData(datos);
    if (buffer.duration > LIMITE_S + 1) {
      const larga = new Error("larga");
      larga.cancion = cancion;
      throw larga;
    }
    bufferActual = buffer;
    rutaBuffer = cancion.ruta;
    return bufferActual;
  }

  /* El menú y el buzón viven en la sección de arriba; la carga, el final y la pausa van
     sobre el campo de juego, que solo se ve mientras se juega. */
  function mostrar(panel) {
    const enMenu = panel === menuEl || panel === buzonEl;
    lobbyEl.classList.toggle("hidden", !enMenu);
    escenarioEl.classList.toggle("hidden", enMenu);
    pieEl.classList.toggle("hidden", enMenu);
    menuEl.classList.toggle("hidden", panel !== menuEl);
    buzonEl.classList.toggle("hidden", panel !== buzonEl);
    [cargaEl, finEl, pausaEl].forEach(p => p.classList.toggle("hidden", p !== panel));
  }

  async function empezar() {
    if (estado === "cargando" || !canciones[ajustes.cancion].ruta) return;
    const miCarga = ++cargaId;
    estado = "cargando";
    cancionActual = canciones[ajustes.cancion];
    cfg = DIFICULTADES[ajustes.dificultad];
    mostrar(cargaEl);
    cargaTxtEl.textContent = "Cargando la canción...";
    try {
      await prepararAudio();
      const buffer = await cargarCancion(cancionActual);
      if (miCarga !== cargaId) return;
      cargaTxtEl.textContent = "Analizando la canción...";
      await new Promise(r => setTimeout(r, 30)); // deja pintar el aviso antes del cálculo
      const clave = cancionActual.ruta + "|" + ajustes.dificultad;
      if (!mapas.has(clave)) {
        if (mapas.size > 6) mapas.delete(mapas.keys().next().value);
        mapas.set(clave, crearMapa(buffer, ajustes.dificultad));
      }
      const base = mapas.get(clave);
      mapa = base;
      notas = base.notas.map(n => ({ t: n.t, carril: n.carril, dur: n.dur, estado: null, mitades: {}, mantiene: null }));
    } catch (err) {
      estado = "menu";
      mostrar(menuEl);
      if (err && err.message === "larga") {
        // Dura más de 6 minutos: se quita de la lista sin más
        const k = canciones.indexOf(err.cancion);
        if (k >= 0 && canciones.length > 1) canciones.splice(k, 1);
        ajustes.cancion = Math.min(ajustes.cancion, canciones.length - 1);
        ajustes.ruta = canciones[ajustes.cancion].ruta;
        pintarMenu();
      } else {
        recordEl.textContent = "No se pudo cargar esa canción. Prueba con otra.";
      }
      return;
    }
    arrancar();
  }

  function arrancar() {
    punteroFallos = 0; activas = []; limpiarEntradas(); gracia = 0; puntos = 0; combo = 0; comboMax = 0;
    perfectos = 0; buenos = 0; fallos = 0; extras = 0; vida = 100; efectos = [];
    avatar = { y: CARRILES.abajo.y, carril: "abajo", salto: -10, golpe: -10 };
    flash = { arriba: -10, abajo: -10 };
    mostrar(null);
    fuente = audio.createBufferSource();
    fuente.buffer = bufferActual;
    fuente.connect(audio.destination);
    inicioAudio = audio.currentTime + 2.2; // margen para que las primeras notas lleguen de lejos
    fuente.start(inicioAudio);
    estado = "jugando";
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(bucle);
  }

  function detenerFuente() {
    if (fuente) { try { fuente.onended = null; fuente.stop(); } catch (e) { /* ya parada */ } fuente = null; }
  }

  function pausar() {
    if (estado !== "jugando") return;
    estado = "pausa";
    limpiarEntradas();
    audio.suspend();
    mostrar(pausaEl);
  }

  async function continuar() {
    if (estado !== "pausa") return;
    mostrar(null);
    await audio.resume();
    gracia = tiempoCancion() + 0.7; // margen para volver a pulsar las largas en curso
    estado = "jugando";
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(bucle);
  }

  function salir() {
    detenerFuente();
    cancelAnimationFrame(raf);
    cargaId++;
    if (audio && audio.state === "suspended") audio.resume();
    estado = "menu";
    mostrar(menuEl);
    pintarMenu();
    dibujar(0);
  }

  /* --- Golpes ------------------------------------------------------------- */
  function limpiarEntradas() { entradas.arriba.clear(); entradas.abajo.clear(); }

  function multiplicador() { return 1 + Math.min(combo, 150) / 50; }

  function sumar(juicio, carril, peso = 1) {
    const doble = carril === "ambos";
    const y = (doble ? (CARRILES.arriba.y + CARRILES.abajo.y) / 2 : CARRILES[carril].y);
    avatar.carril = doble ? "abajo" : carril;
    avatar.golpe = ahoraS();
    flash[doble ? "arriba" : carril] = ahoraS();
    if (doble) flash.abajo = ahoraS();
    if (juicio === "perfecto") {
      perfectos++; combo++;
      puntos += Math.round(300 * peso * multiplicador());
      vida = Math.min(100, vida + 1);
      efectos.push({ x: X_GOLPE, y: y - 56, texto: "PERFECTO", color: "#f2d46b", t: ahoraS() });
    } else if (juicio === "bien") {
      buenos++; combo++;
      puntos += Math.round(100 * peso * multiplicador());
      efectos.push({ x: X_GOLPE, y: y - 56, texto: "BIEN", color: "#e9e6d8", t: ahoraS() });
    } else {
      fallos++; combo = 0;
      if (!ajustes.practica) vida = Math.max(0, vida - cfg.vidaFallo);
      efectos.push({ x: X_GOLPE, y: y - 56, texto: "FALLO", color: "#e8837b", t: ahoraS() });
    }
    comboMax = Math.max(comboMax, combo);
  }

  function golpear(carril, t) {
    flash[carril] = ahoraS();
    avatar.carril = carril;
    avatar.salto = ahoraS();
    // Con una larga en curso en este carril, otra pulsación no cuenta
    if (activas.some(n => n.carril === carril)) return;
    let mejor = null;
    for (let i = punteroFallos; i < notas.length; i++) {
      const n = notas[i];
      if (n.t > t + cfg.bien) break;
      if (n.estado) continue;
      if (!(n.carril === carril || (n.carril === "ambos" && !n.mitades[carril]))) continue;
      const dt = Math.abs(n.t - t);
      if (dt <= cfg.bien && (!mejor || dt < Math.abs(mejor.t - t))) mejor = n;
    }
    if (!mejor) {
      // Pulsar sin nota a tiro cuenta como fallo: corta el combo y quita vida
      extras++; combo = 0;
      if (!ajustes.practica) vida = Math.max(0, vida - cfg.vidaFallo);
      efectos.push({ x: X_GOLPE, y: CARRILES[carril].y - 56, texto: "FALLO", color: "#e8837b", t: ahoraS() });
      return;
    }
    const juicio = Math.abs(mejor.t - t) <= cfg.perfecto ? "perfecto" : "bien";
    if (mejor.carril === "ambos") {
      // Una nota doble solo cuenta cuando entran las dos mitades
      mejor.mitades[carril] = juicio;
      if (!mejor.mitades.arriba || !mejor.mitades.abajo) return;
      mejor.estado = mejor.mitades.arriba === "perfecto" && mejor.mitades.abajo === "perfecto" ? "perfecto" : "bien";
      sumar(mejor.estado, "ambos", 2);
      return;
    }
    mejor.estado = juicio;
    sumar(juicio, carril);
    if (mejor.dur > 0) { mejor.mantiene = "activa"; activas.push(mejor); }
  }

  function tiempoDeEvento(ev) {
    const retraso = Math.max(0, (performance.now() - (ev.timeStamp || performance.now())) / 1000);
    return tiempoCancion() - Math.min(retraso, 0.1);
  }

  window.addEventListener("keydown", ev => {
    if (ev.key === "Escape") {
      if (estado === "jugando") pausar();
      else if (estado === "pausa") continuar();
      return;
    }
    const carril = TECLAS[ev.key.toLowerCase()];
    if (!carril) return;
    if (estado === "jugando") {
      ev.preventDefault();
      if (ev.repeat) return;
      entradas[carril].add("k" + ev.key.toLowerCase());
      golpear(carril, tiempoDeEvento(ev));
    }
  });

  window.addEventListener("keyup", ev => {
    const carril = TECLAS[ev.key.toLowerCase()];
    if (carril) entradas[carril].delete("k" + ev.key.toLowerCase());
  });

  canvas.addEventListener("pointerdown", ev => {
    if (estado !== "jugando") return;
    ev.preventDefault();
    const r = canvas.getBoundingClientRect();
    const carril = (ev.clientY - r.top) / r.height < 0.5 ? "arriba" : "abajo";
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* sin captura */ }
    entradas[carril].add("p" + ev.pointerId);
    golpear(carril, tiempoDeEvento(ev));
  });
  const soltarDedo = ev => { entradas.arriba.delete("p" + ev.pointerId); entradas.abajo.delete("p" + ev.pointerId); };
  canvas.addEventListener("pointerup", soltarDedo);
  canvas.addEventListener("pointercancel", soltarDedo);

  window.addEventListener("blur", () => { if (estado === "jugando") pausar(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && estado === "jugando") pausar(); });

  /* --- Avance y final ------------------------------------------------------ */
  function actualizar(t) {
    while (punteroFallos < notas.length && notas[punteroFallos].t < t - cfg.bien) {
      const n = notas[punteroFallos];
      if (!n.estado) { n.estado = "fallo"; sumar("fallo", n.carril); }
      punteroFallos++;
    }
    // Largas en curso: se completan al llegar al final y se rompen si sueltas antes
    for (let k = activas.length - 1; k >= 0; k--) {
      const n = activas[k];
      const fin = n.t + n.dur;
      if (t >= fin - 0.05) {
        n.mantiene = "hecha";
        puntos += Math.round(150 * multiplicador());
        vida = Math.min(100, vida + 2);
        efectos.push({ x: X_GOLPE, y: CARRILES[n.carril].y - 56, texto: "LARGA", color: "#f2d46b", t: ahoraS() });
        activas.splice(k, 1);
      } else if (t > gracia && entradas[n.carril].size === 0 && t < fin - 0.12) {
        n.mantiene = "rota";
        sumar("fallo", n.carril);
        activas.splice(k, 1);
      }
    }
    if (vida <= 0 && estado === "jugando") terminar(false);
    else if (t > mapa.dur + 0.8 && estado === "jugando") terminar(true);
  }

  function rangoDe(acc) {
    return acc >= 0.95 ? "S" : acc >= 0.88 ? "A" : acc >= 0.75 ? "B" : acc >= 0.6 ? "C" : "D";
  }

  function terminar(completa) {
    estado = "fin";
    detenerFuente();
    cancelAnimationFrame(raf);
    const total = notas.length || 1;
    const hechas = completa ? total : perfectos + buenos + fallos;
    const acc = (perfectos + buenos * 0.6) / Math.max(1, completa ? total : hechas);
    const rango = completa ? rangoDe(acc) : "—";
    const clave = cancionActual.ruta + "|" + ajustes.dificultad;
    const previo = records[clave] ? records[clave].puntos : 0;
    let nuevo = false;
    if (completa && !ajustes.practica && puntos > previo) {
      records[clave] = { puntos, acc: Math.round(acc * 1000) / 10, rango };
      guardarRecords();
      nuevo = true;
    }
    document.getElementById("rtFinTitulo").textContent = completa ? (nuevo ? "¡Nuevo récord!" : "Canción completada") : "Te quedaste sin vida";
    document.getElementById("rtFinRango").textContent = rango;
    document.getElementById("rtFinDatos").innerHTML =
      `${puntos.toLocaleString("es")} puntos · ${(acc * 100).toFixed(1)} % de precisión<br>` +
      `Perfectos ${perfectos} · Bien ${buenos} · Fallos ${fallos} · Pulsaciones de más ${extras} · Combo máximo ${comboMax}` +
      (ajustes.practica ? "<br>Modo práctica: no cuenta para el récord." : "");
    mostrar(finEl);
    finPuntajesEl.innerHTML = "";
    if (completa && !ajustes.practica) subirPuntaje(cancionActual.ruta, ajustes.dificultad, puntos, Math.round(acc * 1000) / 10, rango, comboMax);
  }

  /* --- Dibujo --------------------------------------------------------------- */
  /* Medir el canvas obliga al navegador a recalcular la página, así que solo se hace al
     cambiar el tamaño, no en cada fotograma. La resolución interna se limita para no
     pintar millones de píxeles de más en pantallas muy densas. */
  let medidaSucia = true;
  if (window.ResizeObserver) new ResizeObserver(() => { medidaSucia = true; }).observe(canvas);
  window.addEventListener("resize", () => { medidaSucia = true; });

  function ajustarCanvas() {
    if (!medidaSucia) return;
    medidaSucia = false;
    const r = canvas.getBoundingClientRect();
    const escala = Math.max(1, Math.min(window.devicePixelRatio || 1, 1280 / Math.max(1, r.width)));
    const w = Math.max(1, Math.round(r.width * escala));
    const h = Math.max(1, Math.round(r.height * escala));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctxC.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }

  function dibujarForma(carril, x, alfa) {
    const y = CARRILES[carril].y;
    ctxC.globalAlpha = alfa;
    if (carril === "abajo") {
      ctxC.fillStyle = "#e8837b";
      ctxC.strokeStyle = "#7a2e29";
      ctxC.lineWidth = 3;
      ctxC.beginPath();
      for (let k = 0; k < 14; k++) {
        const ang = (k * Math.PI) / 7;
        const radio = k % 2 === 0 ? 29 : 19;
        ctxC.lineTo(x + Math.cos(ang) * radio, y + Math.sin(ang) * radio);
      }
      ctxC.closePath();
      ctxC.fill();
      ctxC.stroke();
    } else {
      ctxC.fillStyle = "#8fdcff";
      ctxC.strokeStyle = "#2f6e8a";
      ctxC.lineWidth = 3;
      ctxC.beginPath();
      ctxC.moveTo(x, y - 27); ctxC.lineTo(x + 24, y); ctxC.lineTo(x, y + 27); ctxC.lineTo(x - 24, y);
      ctxC.closePath();
      ctxC.fill();
      ctxC.stroke();
    }
    ctxC.globalAlpha = 1;
  }

  /* Una nota: forma de su carril; la doble une las dos con un puente dorado; la larga
     lleva una barra hasta donde termina. xCola es la posición del final de la barra. */
  function dibujarNota(n, x, alfa, xCola) {
    if (n.carril === "ambos") {
      ctxC.globalAlpha = alfa;
      ctxC.strokeStyle = "#f2d46b";
      ctxC.lineWidth = 5;
      ctxC.beginPath(); ctxC.moveTo(x, CARRILES.arriba.y + 27); ctxC.lineTo(x, CARRILES.abajo.y - 29); ctxC.stroke();
      ctxC.globalAlpha = 1;
      dibujarForma("arriba", x, alfa);
      dibujarForma("abajo", x, alfa);
      return;
    }
    if (xCola !== undefined && xCola > x) {
      const y = CARRILES[n.carril].y;
      const fin = Math.min(xCola, W + 40);
      ctxC.globalAlpha = alfa * 0.55;
      ctxC.fillStyle = CARRILES[n.carril].color;
      ctxC.fillRect(x, y - 14, fin - x, 28);
      ctxC.globalAlpha = alfa;
      ctxC.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctxC.fillRect(fin - 4, y - 14, 4, 28);
      ctxC.globalAlpha = 1;
    }
    dibujarForma(n.carril, x, alfa);
  }

  let ultimoAvatar = 0;
  let brilloPrevio = "";
  let puntosTexto = "";
  let puntosPrevio = -1;
  function dibujarAvatar(ahora) {
    const objetivo = CARRILES[avatar.carril].y;
    const dt = Math.min(0.05, Math.max(0, ahora - ultimoAvatar));
    ultimoAvatar = ahora;
    avatar.y += (objetivo - avatar.y) * (1 - Math.exp(-dt * 20));
    const salto = Math.max(0, 1 - (ahora - avatar.salto) / 0.22);
    const golpe = Math.max(0, 1 - (ahora - avatar.golpe) / 0.2);
    const x = 100;
    const y = avatar.y - Math.sin(salto * Math.PI) * 26;
    const estira = 1 + golpe * 0.18;
    ctxC.save();
    ctxC.translate(x, y);
    ctxC.scale(1 / estira, estira);
    ctxC.fillStyle = "#7ed87f";
    ctxC.strokeStyle = "#2e6e32";
    ctxC.lineWidth = 4;
    ctxC.beginPath();
    ctxC.ellipse(0, 0, 36, 30, 0, 0, Math.PI * 2);
    ctxC.fill();
    ctxC.stroke();
    ctxC.fillStyle = "#12330f";
    ctxC.beginPath(); ctxC.arc(-11, -6, 5, 0, Math.PI * 2); ctxC.arc(11, -6, 5, 0, Math.PI * 2); ctxC.fill();
    ctxC.strokeStyle = "#12330f"; ctxC.lineWidth = 3;
    ctxC.beginPath(); ctxC.arc(0, 6, golpe > 0 ? 8 : 6, 0.1 * Math.PI, 0.9 * Math.PI); ctxC.stroke();
    ctxC.restore();
  }

  function dibujar(t) {
    ajustarCanvas();
    const ahora = ahoraS();
    const pulso = mapa && estado !== "menu" ? mapa.pulso[Math.max(0, Math.min(mapa.pulso.length - 1, Math.floor((t * mapa.sr) / HOP)))] || 0 : 0;

    // El resplandor que late con los graves es un div con degradado detrás del canvas:
    // cambiar su opacidad no cuesta nada, a diferencia de rellenar un degradado enorme
    // en cada fotograma.
    ctxC.clearRect(0, 0, W, H);
    const brillo = (0.2 + pulso * 0.8).toFixed(2);
    if (brillo !== brilloPrevio) { brilloPrevio = brillo; brilloEl.style.opacity = brillo; }

    // Carriles
    Object.entries(CARRILES).forEach(([nombre, c]) => {
      ctxC.fillStyle = "rgba(255, 255, 255, 0.035)";
      ctxC.fillRect(0, c.y - 38, W, 76);
      ctxC.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctxC.lineWidth = 2;
      ctxC.beginPath(); ctxC.moveTo(0, c.y); ctxC.lineTo(W, c.y); ctxC.stroke();
      const f = Math.max(0, 1 - (ahora - flash[nombre]) / 0.18);
      ctxC.strokeStyle = c.color;
      ctxC.lineWidth = 3 + f * 3;
      ctxC.globalAlpha = 0.55 + f * 0.45;
      ctxC.beginPath(); ctxC.arc(X_GOLPE, c.y, 36 + f * 6, 0, Math.PI * 2); ctxC.stroke();
      ctxC.globalAlpha = 1;
      ctxC.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctxC.font = "600 13px sans-serif";
      ctxC.textAlign = "center";
      ctxC.fillText(c.etiqueta, X_GOLPE, c.y + 62);
    });

    if (estado === "jugando" || estado === "pausa" || estado === "fin") {
      // Notas
      const recorrido = W - X_GOLPE + 50;
      for (let i = punteroFallos; i < notas.length; i++) {
        const n = notas[i];
        const dt = n.t - t;
        if (dt > cfg.aproximacion) break;
        if (n.estado === "perfecto" || n.estado === "bien") continue;
        const x = X_GOLPE + (dt / cfg.aproximacion) * recorrido;
        dibujarNota(n, x, 1, n.dur > 0 ? X_GOLPE + ((n.t + n.dur - t) / cfg.aproximacion) * recorrido : undefined);
      }
      // Largas que se están manteniendo: la cabeza se queda en el círculo y la cola se acerca
      activas.forEach(n => {
        const y = CARRILES[n.carril].y;
        const cola = X_GOLPE + ((n.t + n.dur - t) / cfg.aproximacion) * recorrido;
        ctxC.globalAlpha = 0.85;
        ctxC.fillStyle = CARRILES[n.carril].color;
        ctxC.fillRect(X_GOLPE, y - 14, Math.max(0, Math.min(cola, W + 40) - X_GOLPE), 28);
        ctxC.globalAlpha = 1;
      });
      // Notas ya falladas que se alejan
      for (let i = Math.max(0, punteroFallos - 12); i < punteroFallos; i++) {
        const n = notas[i];
        if (n.estado !== "fallo") continue;
        const dt = n.t - t;
        if (dt < -0.6) continue;
        dibujarNota(n, X_GOLPE + (dt / cfg.aproximacion) * recorrido, 0.3);
      }
    }

    dibujarAvatar(ahora);

    // Textos de juicio
    efectos = efectos.filter(e => ahora - e.t < 0.6);
    efectos.forEach(e => {
      const k = (ahora - e.t) / 0.6;
      ctxC.globalAlpha = 1 - k;
      ctxC.fillStyle = e.color;
      ctxC.font = "700 22px sans-serif";
      ctxC.textAlign = "center";
      ctxC.fillText(e.texto, e.x + 20, e.y - k * 22);
      ctxC.globalAlpha = 1;
    });

    // Marcador
    if (estado !== "menu") {
      ctxC.fillStyle = "#e9e6d8";
      ctxC.textAlign = "left";
      ctxC.font = "700 28px sans-serif";
      if (puntos !== puntosPrevio) { puntosPrevio = puntos; puntosTexto = puntos.toLocaleString("es"); }
      ctxC.fillText(puntosTexto, 24, 44);
      if (combo >= 2) {
        ctxC.textAlign = "right";
        ctxC.font = "700 34px sans-serif";
        ctxC.fillStyle = combo >= 50 ? "#f2d46b" : "#e9e6d8";
        ctxC.fillText(`${combo}`, W - 24, 46);
        ctxC.font = "600 12px sans-serif";
        ctxC.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctxC.fillText("COMBO", W - 24, 64);
      }
      // Vida
      ctxC.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctxC.fillRect(24, 58, 200, 8);
      ctxC.fillStyle = vida > 35 ? "#7ed87f" : "#e8837b";
      ctxC.fillRect(24, 58, 2 * vida, 8);
      // Progreso
      if (mapa) {
        ctxC.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctxC.fillRect(0, H - 6, W, 6);
        ctxC.fillStyle = "#8fdcff";
        ctxC.fillRect(0, H - 6, W * Math.max(0, Math.min(1, t / mapa.dur)), 6);
      }
    }
  }

  function bucle() {
    if (estado !== "jugando") return;
    const t = tiempoCancion();
    actualizar(t);
    dibujar(t);
    if (estado === "jugando") raf = requestAnimationFrame(bucle);
  }

  /* --- Puntajes de todos --------------------------------------------------------
     Tabla ritmo_puntajes (scratchpad/ritmo_puntajes.sql): el mejor puntaje de cada
     jugador por canción y dificultad. Se lee sin sesión; para guardar hay que haber
     iniciado sesión. */
  const DESCRIPCION = { facil: "Relajado", normal: "Equilibrado", dificil: "Exigente", experto: "Extremo" };
  const puntajesCache = new Map();
  let vistaPuntajes = null; // "todas", una dificultad, o null = la que está elegida para jugar
  let tokenPuntajes = 0;
  let yo = { id: null, nombre: "" };

  async function filasPuntajes(ruta, dif) {
    const clave = ruta + "|" + dif;
    const guardado = puntajesCache.get(clave);
    if (guardado && Date.now() - guardado.t < 30000) return guardado.filas;
    const supa = await fichasCliente();
    let q = supa.from("ritmo_puntajes").select("user_id, username, dificultad, puntos, precision, rango, combo_max, jugadas").eq("cancion", ruta);
    if (dif !== "todas") q = q.eq("dificultad", dif);
    const { data, error } = await q.order("puntos", { ascending: false }).limit(50);
    if (error) throw error;
    puntajesCache.set(clave, { t: Date.now(), filas: data || [] });
    return data || [];
  }

  function tablaPuntajes(filas, { conDificultad, max }) {
    if (!filas.length) return `<p class="rt-nota">Nadie ha jugado esta canción todavía. Sé el primero.</p>`;
    const vistas = filas.slice(0, max);
    const miFila = yo.id ? filas.findIndex(f => f.user_id === yo.id) : -1;
    if (miFila >= max) vistas.push(Object.assign({ _puesto: miFila + 1 }, filas[miFila]));
    return `<table class="rt-tabla"><thead><tr><th>#</th><th>Jugador</th>${conDificultad ? "<th>Dif.</th>" : ""}<th>Puntos</th><th>Rango</th><th>Prec.</th><th>Combo</th></tr></thead><tbody>${
      vistas.map((f, k) => {
        const puesto = f._puesto || k + 1;
        return `<tr class="${f.user_id === yo.id ? "yo" : ""}"><td>${puesto}</td><td>${esc(f.username)}</td>${conDificultad ? `<td>${esc((DIFICULTADES[f.dificultad] || {}).nombre || f.dificultad)}</td>` : ""}<td>${Number(f.puntos).toLocaleString("es")}</td><td><b class="rt-rango-mini rango-${esc(f.rango)}">${esc(f.rango)}</b></td><td>${Number(f.precision).toFixed(1)} %</td><td>${f.combo_max}</td></tr>`;
      }).join("")}</tbody></table>`;
  }

  async function pintarPuntajes() {
    const c = canciones[ajustes.cancion];
    if (!c || !c.ruta) { puntajesEl.innerHTML = ""; puntajesTabsEl.innerHTML = ""; return; }
    const vista = vistaPuntajes || ajustes.dificultad;
    puntajesTabsEl.innerHTML = [["todas", "Todas"], ...Object.entries(DIFICULTADES).map(([id, d]) => [id, d.nombre])]
      .map(([id, nombre]) => `<button type="button" class="rt-tab ${id === vista ? "activa" : ""}" data-vista="${id}">${nombre}</button>`).join("");
    const token = ++tokenPuntajes;
    puntajesEl.innerHTML = `<p class="rt-nota">Cargando puntajes...</p>`;
    try {
      const filas = await filasPuntajes(c.ruta, vista);
      if (token !== tokenPuntajes) return;
      puntajesEl.innerHTML = tablaPuntajes(filas, { conDificultad: vista === "todas", max: 10 });
    } catch (e) {
      if (token === tokenPuntajes) puntajesEl.innerHTML = `<p class="rt-nota">Los puntajes no están disponibles por ahora.</p>`;
    }
  }

  puntajesTabsEl.addEventListener("click", ev => {
    const b = ev.target.closest("[data-vista]");
    if (!b) return;
    vistaPuntajes = b.dataset.vista;
    pintarPuntajes();
  });

  /* Al terminar una canción: se guarda el puntaje (si hay sesión) y se muestra la tabla. */
  async function subirPuntaje(ruta, dif, pts, acc, rango, combo) {
    finPuntajesEl.innerHTML = `<p class="rt-nota">Guardando tu puntaje...</p>`;
    let aviso = "";
    try {
      const { sesion } = window.MjStats ? await MjStats.cargarSesion() : { sesion: null };
      if (!sesion) {
        aviso = "Inicia sesión (arriba a la derecha) para aparecer en los puntajes.";
      } else {
        const supa = await fichasCliente();
        const { error } = await supa.rpc("ritmo_registrar", { p_cancion: ruta, p_dificultad: dif, p_puntos: pts, p_precision: acc, p_rango: rango, p_combo: combo });
        if (error) aviso = "No se pudo guardar el puntaje. Prueba de nuevo en un rato.";
      }
    } catch (e) {
      aviso = "No se pudo guardar el puntaje.";
    }
    puntajesCache.clear();
    try {
      const filas = await filasPuntajes(ruta, dif);
      if (estado !== "fin") return;
      finPuntajesEl.innerHTML = (aviso ? `<p class="rt-nota">${esc(aviso)}</p>` : "") + tablaPuntajes(filas, { conDificultad: false, max: 5 });
    } catch (e) {
      if (estado === "fin") finPuntajesEl.innerHTML = aviso ? `<p class="rt-nota">${esc(aviso)}</p>` : "";
    }
  }

  if (window.MjStats) {
    MjStats.cargarSesion().then(({ sesion, nombre }) => {
      yo = { id: sesion ? sesion.user.id : null, nombre };
      if (sesion) pintarPuntajes();
    });
  }

  /* --- Menú ------------------------------------------------------------------ */
  function normalizar(t) {
    return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function pintarMenu() {
    const q = normalizar(buscarEl.value.trim());
    const guardado = cancionesEl.scrollTop;
    const filas = canciones.map((c, i) => ({ c, i })).filter(({ c }) => !q || normalizar(c.nombre).includes(q));
    cancionesEl.innerHTML = filas.map(({ c, i }) => {
      const r = records[c.ruta + "|" + ajustes.dificultad];
      return `<button type="button" role="option" aria-selected="${i === ajustes.cancion}" class="rt-cancion ${i === ajustes.cancion ? "activa" : ""}" data-i="${i}">` +
        `<span class="rt-cancion-txt"><strong>${esc(c.titulo)}</strong>${c.artista ? `<small>${esc(c.artista)}</small>` : ""}</span>` +
        `<span class="rt-cancion-der">${c.dur ? `<em>${duracionTexto(c.dur)}</em>` : ""}${r ? `<b class="rt-rango-mini rango-${esc(r.rango)}" title="Tu mejor: ${Number(r.puntos).toLocaleString("es")}">${esc(r.rango)}</b>` : ""}</span></button>`;
    }).join("") || `<p class="rt-nota">Ninguna canción coincide con la búsqueda.</p>`;
    cancionesEl.scrollTop = guardado;
    const activa = cancionesEl.querySelector(".activa");
    if (activa && !q) {
      // Se mantiene a la vista dentro de la lista, sin mover la página
      const arriba = activa.offsetTop - cancionesEl.offsetTop;
      if (arriba < cancionesEl.scrollTop) cancionesEl.scrollTop = arriba;
      else if (arriba + activa.offsetHeight > cancionesEl.scrollTop + cancionesEl.clientHeight) cancionesEl.scrollTop = arriba + activa.offsetHeight - cancionesEl.clientHeight;
    }

    const c = canciones[ajustes.cancion];
    tituloEl.textContent = c.titulo;
    metaEl.textContent = [c.artista, c.dur ? duracionTexto(c.dur) : ""].filter(Boolean).join(" · ");
    dificultadesEl.innerHTML = Object.entries(DIFICULTADES).map(([id, d]) =>
      `<button type="button" class="rt-dif ${id === ajustes.dificultad ? "activa" : ""}" data-dif="${id}"><strong>${d.nombre}</strong><small>${DESCRIPCION[id]}</small></button>`).join("");
    desfaseEl.value = ajustes.desfase;
    desfaseTxtEl.textContent = `${ajustes.desfase > 0 ? "+" : ""}${ajustes.desfase} ms`;
    practicaEl.checked = !!ajustes.practica;
    const r = records[c.ruta + "|" + ajustes.dificultad];
    recordEl.textContent = r ? `Tu mejor: ${r.puntos.toLocaleString("es")} puntos · ${r.acc} % · rango ${r.rango}` : "";
    pintarPuntajes();
  }

  buscarEl.addEventListener("input", pintarMenu);
  cancionesEl.addEventListener("click", ev => {
    const b = ev.target.closest("[data-i]");
    if (!b) return;
    ajustes.cancion = Number(b.dataset.i);
    ajustes.ruta = canciones[ajustes.cancion].ruta;
    vistaPuntajes = null;
    guardarAjustes();
    pintarMenu();
  });
  dificultadesEl.addEventListener("click", ev => {
    const b = ev.target.closest("[data-dif]");
    if (!b) return;
    ajustes.dificultad = b.dataset.dif;
    vistaPuntajes = null;
    guardarAjustes();
    pintarMenu();
  });
  desfaseEl.addEventListener("input", () => {
    ajustes.desfase = Number(desfaseEl.value);
    desfaseTxtEl.textContent = `${ajustes.desfase > 0 ? "+" : ""}${ajustes.desfase} ms`;
    guardarAjustes();
  });
  practicaEl.addEventListener("change", () => { ajustes.practica = practicaEl.checked; guardarAjustes(); });
  jugarEl.addEventListener("click", empezar);

  /* Buzón: la petición se guarda en la misma tabla de peticiones del sitio, marcada
     como canción, y el admin la ve en su pestaña de Peticiones. */
  const buzonForm = document.getElementById("rtBuzonForm");
  const buzonEstadoEl = document.getElementById("rtBuzonEstado");
  const buzonNombreEl = document.getElementById("rtBuzonNombre");
  try { buzonNombreEl.value = localStorage.getItem("compendioRitmoNombre") || ""; } catch (e) { /* sin almacenamiento */ }
  document.getElementById("rtAbrirBuzon").addEventListener("click", () => {
    buzonEstadoEl.textContent = "";
    mostrar(buzonEl);
  });
  document.getElementById("rtBuzonVolver").addEventListener("click", () => mostrar(menuEl));
  buzonForm.addEventListener("submit", async ev => {
    ev.preventDefault();
    const cancion = document.getElementById("rtBuzonCancion").value.trim();
    const enlace = document.getElementById("rtBuzonEnlace").value.trim();
    const nombre = buzonNombreEl.value.trim();
    if (!cancion) return;
    const boton = document.getElementById("rtBuzonEnviar");
    boton.disabled = true;
    buzonEstadoEl.textContent = "Enviando...";
    try {
      await enviarPeticion({ texto: "[Canción para Zarabanda] " + cancion + (enlace ? "\n" + enlace : ""), nombre });
      try { localStorage.setItem("compendioRitmoNombre", nombre); } catch (e) { /* sin almacenamiento */ }
      document.getElementById("rtBuzonCancion").value = "";
      document.getElementById("rtBuzonEnlace").value = "";
      buzonEstadoEl.textContent = "Enviada. Gracias.";
    } catch (err) {
      buzonEstadoEl.textContent = "No se pudo enviar. Prueba de nuevo en un rato.";
    } finally {
      boton.disabled = false;
    }
  });
  document.getElementById("rtReintentar").addEventListener("click", empezar);
  document.getElementById("rtVolver").addEventListener("click", salir);
  document.getElementById("rtContinuar").addEventListener("click", continuar);
  document.getElementById("rtSalir").addEventListener("click", salir);
  window.addEventListener("resize", () => { if (estado !== "jugando") dibujar(tiempoCancion()); });

  pintarMenu();
  dibujar(0);

  if (/[?&]debug\b/.test(location.search)) {
    window.__ritmo = {
      crearMapa, DIFICULTADES, subirPuntaje, forzarFin: () => { estado = "fin"; mostrar(finEl); },
      estado: () => ({ estado, puntos, combo, perfectos, buenos, fallos, extras, vida, notas: notas.length, activas: activas.length }),
      entradas,
      tick: t => { actualizar(t); dibujar(t); },
      golpear, notas: () => notas, tiempo: tiempoCancion,
      forzarTiempo: f => { tiempoCancion = f; }
    };
  }
})();
