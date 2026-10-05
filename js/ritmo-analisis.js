/* Análisis de las canciones para el juego de ritmo: tempo, pulso, y las notas de cada
   dificultad. Lo usan ritmo.html (el juego) y ritmo-editor.html (el editor de mapas del
   admin), así los dos generan exactamente lo mismo. No toca la página. */
(function () {
  "use strict";

  const HOP = 512;

  /* nps = notas por segundo que se buscan; hueco = separación mínima entre notas (s);
     aproximacion = segundos que tarda una nota desde el borde hasta el punto de golpe;
     sub = partes en que se divide cada pulso para colocar notas (1 = solo pulsos, 2 =
     mitades, 4 = cuartos); corte = fuerza mínima del ataque para que haya nota; repite = cuánto debe
     sonar el mismo golpe en el compás anterior o siguiente para contarlo como parte del
     patrón (un golpe que no se repite solo entra si es muy fuerte: sueltaFuerte); perfecto / bien =
     ventanas de acierto (s); vidaFallo = vida que quita cada fallo; dobles = hay notas
     que piden los dos carriles a la vez (huecoDoble = separación mínima entre ellas);
     largas = fracción de notas que se mantienen pulsadas. */
  const DIFICULTADES = {
    facil: { nombre: "Fácil", nps: 1.5, hueco: 0.42, aproximacion: 1.6, sub: 1, corte: 0.6, repite: 0.7, sueltaFuerte: 99, perfecto: 0.06, bien: 0.12, vidaFallo: 5, dobles: false, largas: 0 },
    normal: { nombre: "Normal", nps: 2.6, hueco: 0.28, aproximacion: 1.3, sub: 2, corte: 0.42, repite: 0.6, sueltaFuerte: 2.2, perfecto: 0.05, bien: 0.11, vidaFallo: 7, dobles: false, largas: 0 },
    dificil: { nombre: "Difícil", nps: 4.0, hueco: 0.19, aproximacion: 1.0, sub: 2, corte: 0.28, repite: 0.45, sueltaFuerte: 1.4, perfecto: 0.04, bien: 0.09, vidaFallo: 9, dobles: true, huecoDoble: 5, largas: 0.2 },
    experto: { nombre: "Experto", nps: 5.2, hueco: 0.12, aproximacion: 0.85, sub: 4, corte: 0.15, repite: 0.35, sueltaFuerte: 1.0, perfecto: 0.035, bien: 0.08, vidaFallo: 12, dobles: true, huecoDoble: 3.5, largas: 0.25 }
  };

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

  /* opciones.pulsos: lista de pulsos (s) ya editada, en vez de la detectada.
     opciones.bandasForzadas: { numeroDeTramo: "bajo" | "medio" | "alto" | "vacio" } para
     decidir a mano qué banda sigue un tramo. Lo usa el editor de mapas. */
  function crearMapa(buffer, dificultad, opciones = {}) {
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
    const pulsos = opciones.pulsos ? opciones.pulsos.slice() : seguirPulso(O, T).map(f => f / fps);

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
      let vacio = puntaje[mejor] < 0.05;
      const forzada = opciones.bandasForzadas ? opciones.bandasForzadas[tramos.length] : undefined;
      if (forzada === "vacio") vacio = true;
      else if (forzada) { mejor = forzada; vacio = false; }
      const otras = nombres.filter(b => b !== mejor);
      const segunda = puntaje[otras[0]] >= puntaje[otras[1]] ? otras[0] : otras[1];
      tramos.push({ k0, k1, banda: mejor, segunda, vacio, t0: pulsos[k0], t1: pulsos[k1] });
      if (!vacio) previa = mejor;
    }

    // 4. Notas sobre la cuadrícula, siguiendo el patrón que se repite en el tramo.
    //    Un golpe entra si cae en la cuadrícula, es lo bastante fuerte y suena también en el
    //    compás anterior o en el siguiente. Los golpes sueltos (adelantos, adornos que no se
    //    repiten) se quedan fuera salvo que sean muy fuertes: así queda un hilo que se puede
    //    escuchar y seguir, no uno que solo se puede leer en pantalla.
    const sd = cfg.sub;
    const porCompas = 4 * sd;
    const tramoDe = k => Math.min(tramos.length - 1, Math.floor(k / 8));
    const slots = [];
    for (let k = 0; k + 1 < pulsos.length; k++) {
      const tr = tramos[tramoDe(k)];
      const periodo = pulsos[k + 1] - pulsos[k];
      for (let j = 0; j < sd; j++) {
        const t = pulsos[k] + (j / sd) * periodo;
        slots.push({ t, k, j, tramo: tramoDe(k), banda: tr.banda, vacio: tr.vacio, f: tr.vacio ? 0 : fuerzaEn(tr.banda, t) });
      }
    }
    const candidatos = [];
    slots.forEach((sl, g) => {
      if (sl.vacio || sl.t < 0.8 || sl.t > dur - 0.5) return;
      const contratiempo = sl.j !== 0;
      const corte = cfg.corte * (contratiempo && sd === 2 ? 1.3 : 1);
      if (sl.f < corte) return;
      const veces = [slots[g - porCompas], slots[g + porCompas]].filter(o => o && !o.vacio && o.banda === sl.banda && o.f >= corte * cfg.repite);
      if (!veces.length && sl.f < cfg.sueltaFuerte) return;
      candidatos.push({ t: sl.t, f: sl.f, tramo: sl.tramo, banda: sl.banda, i: Math.max(0, Math.round(sl.t * fps)), k: sl.k, j: sl.j, pos: (sl.k % 4) * sd + sl.j });
    });
    candidatos.sort((a, b) => b.f - a.f);

    const celda = 0.02;
    const bloqueo = new Uint8Array(Math.ceil(dur / celda) + 2);
    const maximo = Math.round(dur * cfg.nps);
    const medioHueco = Math.round(cfg.hueco / celda);
    const notas = [];
    for (const c of candidatos) {
      if (notas.length >= maximo) break;
      const kk = Math.round(c.t / celda);
      if (bloqueo[kk]) continue;
      for (let j = Math.max(0, kk - medioHueco); j <= Math.min(bloqueo.length - 1, kk + medioHueco); j++) bloqueo[j] = 1;
      notas.push({ t: c.t, i: c.i, carril: "abajo", f: c.f, dur: 0, tramo: c.tramo, banda: c.banda, k: c.k, j: c.j, pos: c.pos });
    }
    notas.sort((a, b) => a.t - b.t);

    // Carril: dentro de un tramo, cada posición del compás va siempre al mismo carril, así el
    // patrón se repite igual compás tras compás. Se elige por el brillo del sonido (graves al
    // suelo, brillantes al aire) y, si no se distingue, por la posición (pares abajo).
    const brillo = nt => {
      const i = Math.min(n - 1, nt.i + 1);
      const total = bajo[i] + medio[i] + alto[i] + 1e-9;
      return (0.5 * medio[i] + alto[i]) / total;
    };
    const grupos = new Map();
    notas.forEach(nt => {
      const clave = nt.tramo + ":" + nt.pos;
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(brillo(nt));
    });
    const media = new Map();
    grupos.forEach((lista, clave) => media.set(clave, lista.reduce((a, b) => a + b, 0) / lista.length));
    const porTramo = new Map();
    media.forEach((v, clave) => {
      const tr = Number(clave.split(":")[0]);
      if (!porTramo.has(tr)) porTramo.set(tr, []);
      porTramo.get(tr).push(v);
    });
    const estadistica = new Map();
    porTramo.forEach((lista, tr) => {
      const orden = lista.slice().sort((a, b) => a - b);
      estadistica.set(tr, { med: orden[Math.floor(orden.length / 2)], delta: 0.15 * (orden[orden.length - 1] - orden[0]) });
    });
    notas.forEach(nt => {
      const e = estadistica.get(nt.tramo);
      const m = media.get(nt.tramo + ":" + nt.pos);
      nt.carril = m > e.med + e.delta ? "arriba" : m < e.med - e.delta ? "abajo" : (nt.pos % 2 === 0 ? "abajo" : "arriba");
    });

    // Dobles: solo en el primer pulso de cada frase de cuatro compases, cuando otra banda
    // también marca fuerte. Son un acento, no un adorno constante.
    if (cfg.dobles) {
      let ultima = -99;
      for (const nt of notas) {
        if (nt.t - ultima < cfg.huecoDoble || nt.j !== 0 || nt.k % 16 !== 0) continue;
        const otra = nombres.filter(b => b !== nt.banda).reduce((a, b) => Math.max(a, fuerzaEn(b, nt.t)), 0);
        if (nt.f >= 0.9 && otra >= 1.0) { nt.carril = "ambos"; ultima = nt.t; }
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

    const pulso = pulsoDe(pulsos, n, fps);

    const bpm = tramos.map(tr => {
      const a = pulsos[tr.k0];
      const z = pulsos[tr.k1];
      return z > a ? Math.round((60 * (tr.k1 - tr.k0)) / (z - a)) : 0;
    });
    return { notas, pulso, dur, sr, pulsos, tramos, bpm, n, fps };
  }

  /* El fondo late con el pulso: 1 en cada pulso y cae hasta 0 en 0,4 s. */
  function pulsoDe(pulsos, n, fps) {
    const pulso = new Float32Array(n);
    let b = 0;
    for (let f = 0; f < n; f++) {
      const t = f / fps;
      while (b + 1 < pulsos.length && pulsos[b + 1] <= t) b++;
      if (pulsos.length && t >= pulsos[0]) pulso[f] = Math.pow(Math.max(0, 1 - (t - pulsos[b]) / 0.4), 2);
    }
    return pulso;
  }

  /* Formato guardado en Supabase (tabla ritmo_mapas): notas como [t, carril, duración] con
     carril 0 = abajo, 1 = arriba, 2 = ambos; pulsos en segundos. */
  const CODIGO_CARRIL = { abajo: 0, arriba: 1, ambos: 2 };
  const NOMBRE_CARRIL = ["abajo", "arriba", "ambos"];

  function guardable(notas, pulsos) {
    return {
      v: 1,
      notas: notas.map(n => [Math.round(n.t * 1000) / 1000, CODIGO_CARRIL[n.carril], Math.round((n.dur || 0) * 100) / 100]),
      pulsos: pulsos.map(t => Math.round(t * 1000) / 1000)
    };
  }

  /* Convierte un mapa guardado en lo que usa el juego, a partir del audio ya decodificado. */
  function desdeGuardado(guardado, buffer) {
    const sr = buffer.sampleRate;
    const n = Math.floor(buffer.length / HOP);
    const notas = guardado.notas.map(g => ({ t: g[0], carril: NOMBRE_CARRIL[g[1]] || "abajo", dur: g[2] || 0 })).sort((a, b) => a.t - b.t);
    return { notas, pulso: pulsoDe(guardado.pulsos || [], n, sr / HOP), dur: buffer.duration, sr, pulsos: guardado.pulsos || [], tramos: [], bpm: [], n, fps: sr / HOP };
  }

  window.RitmoAnalisis = { HOP, DIFICULTADES, crearMapa, pulsoDe, guardable, desdeGuardado, bandas, ataques, maximoMovil };
})();
