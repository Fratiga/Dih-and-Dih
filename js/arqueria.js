/* Arquería contra un rival simulado. Mismo esquema que el juego de Hooey: un
   campo de tamaño lógico fijo (960x600) que solo se escala al dibujar, así el
   zoom o el tamaño de la ventana no cambian la dificultad. Los blancos caen,
   se les dispara con clic (o con las teclas Z / X sobre el cursor) y puntúa lo
   cerca que quede el tiro del centro. A un lado corre el puntaje del rival.
   Lo usan arqueria.html (Hornet, Garra y Cassius, y partidas contra otros jugadores) y
   Muerte Súbita (Verdam).

   Contra un rival de la casa (en la página de arquería) también es una galería de tiro: el rival
   tiene su propia mira, elige un blanco de los que caen, apunta, dispara y, si acierta, el blanco
   desaparece para los dos. Muerte Súbita sigue con el rival abstracto de siempre.

   En una partida entre dos jugadores el campo es COMPARTIDO: los blancos salen de un calendario
   que se calcula igual en los dos navegadores (semilla + reloj de la partida), así que los dos
   ven lo mismo en el mismo instante. Cada blanco es de quien lo acierte primero: el disparo se
   manda al servidor, que da el blanco al primero que llega, y el otro lo ve desaparecer. */
(function () {
  const LOGICO_ANCHO = 960;
  const LOGICO_ALTO = 600;

  /* Rivales. La arquería es una galería de tiro: los blancos APARECEN en cualquier punto del campo, duran unos
     segundos con un anillo que se va vaciando y se esfuman. Los pequeños y dorados duran menos y valen el doble.
     Cada rival dispara con su propia mira, que tiene que viajar hasta el blanco, así que la dificultad sale de
     sus reflejos y de lo rápido que mueve la mira, no de una cadencia imposible:
       reaccion = lo que tarda en ver un blanco nuevo        veloz    = píxeles por segundo que recorre su mira
       asentar  = lo que tarda en estabilizar la mira        recarga  = pausa entre un disparo y el siguiente
       vuelo    = lo que tarda su flecha en llegar (hasta entonces puedes quitarle el blanco)
       ruido    = cuánto se despista al elegir blanco (menos = elige mejor: valor y cercanía)
       precision y dist = cuántos tiros aciertan y el reparto [centro, medio, borde] de los que aciertan
     Del lado de los blancos: radio, vida (segundos), desliza (fracción que se mueve de lado) y rapido (fracción de
     dorados). Las cifras salen de partidas simuladas con dos jugadores: uno medio (reflejos de 0,36 s) y uno bueno (0,28 s). Con el medio, Hornet, Garra y Cassius pierden, Torvrena queda pareja y de Miliciano en adelante gana la máquina; el bueno le gana a Miliciano por poco y pierde con Tobi. intervalo y velocidadBase solo los usa el
     rival abstracto de Muerte Súbita (Verdam). */
  const RIVALES = {
    hornet: {
      nombre: "Hornet", color: "#b48ad9",
      radio: 48, vida: 2.9, desliza: 0, rapido: 0.15,
      reaccion: 0.7, veloz: 700, asentar: 0.2, recarga: 0.65, vuelo: 0.17, ruido: 0.8,
      precision: 0.74, dist: [0.2, 0.4, 0.4]
    },
    garra: {
      nombre: "Garra", color: "#d9794f",
      radio: 44, vida: 2.5, desliza: 0.15, rapido: 0.2,
      reaccion: 0.5, veloz: 1100, asentar: 0.15, recarga: 0.5, vuelo: 0.14, ruido: 0.6,
      precision: 0.87, dist: [0.35, 0.4, 0.25]
    },
    cassius: {
      nombre: "Cassius", color: "#d9a441",
      radio: 39, vida: 2.1, desliza: 0.3, rapido: 0.25,
      reaccion: 0.28, veloz: 2000, asentar: 0.09, recarga: 0.25, vuelo: 0.1, ruido: 0.27,
      precision: 0.94, dist: [0.5, 0.36, 0.14]
    },
    torvrena: {
      nombre: "Torvrena", color: "#5fd0c0",
      radio: 36, vida: 1.85, desliza: 0.4, rapido: 0.3,
      reaccion: 0.25, veloz: 2350, asentar: 0.08, recarga: 0.22, vuelo: 0.09, ruido: 0.2,
      precision: 0.95, dist: [0.56, 0.32, 0.12]
    },
    milicia: {
      nombre: "Miliciano", color: "#cf6f8f",
      radio: 34, vida: 1.75, desliza: 0.5, rapido: 0.3,
      reaccion: 0.21, veloz: 2700, asentar: 0.07, recarga: 0.2, vuelo: 0.08, ruido: 0.18,
      precision: 0.96, dist: [0.6, 0.3, 0.1]
    },
    tobi: {
      nombre: "Tobi", color: "#9bd05f",
      radio: 31, vida: 1.55, desliza: 0.6, rapido: 0.35,
      reaccion: 0.18, veloz: 3400, asentar: 0.05, recarga: 0.16, vuelo: 0.065, ruido: 0.1,
      precision: 0.975, dist: [0.7, 0.25, 0.05]
    },
    verdam: {
      nombre: "Verdam", color: "#8fd06a",
      intervalo: 0.75, precision: 0.93, dist: [0.55, 0.33, 0.12],
      radio: 38, velocidadBase: 140, zigzag: true
    }
  };
  const PUNTOS_ANILLO = [10, 7, 4];
  // Lo que se lee en la pantalla previa al disparo (antes estaba en una fila de fichas bajo el campo)
  const REGLAS = ["Un minuto. Los blancos aparecen y se esfuman en segundos.", "Centro 10, medio 7, borde 4. Los dorados, pequeños y fugaces, valen el doble.", "Dispara con clic, o con Z / X sobre el blanco."];
  const REGLAS_VS = ["Un minuto. Los blancos son de los dos: se lo lleva quien dispare primero.", "Centro 10, medio 7, borde 4. Los dorados, pequeños y fugaces, valen el doble.", "Dispara con clic, o con Z / X sobre el blanco."];

  // Generador con semilla: los dos jugadores de una partida ven los mismos blancos.
  function generadorConSemilla(semilla) {
    let a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* resolucionMax: tope de píxeles por píxel CSS del lienzo. En pantallas de alta densidad
     (2x o más) dibujar a resolución completa cuesta el doble o el triple de relleno por
     cuadro y casi no se nota; el combate con Verdam lo baja más porque va sobre capas
     con filtros. */
  function crearArqueria({ canvas, rival: claveRival, duracion = 60, pantallas = true, fondo = false, resolucionMax = 1.25, onEstado, onFin, onPuntaje, onGolpe, onMira }) {
    let cfg = RIVALES[claveRival] || RIVALES.hornet;
    const ancho = LOGICO_ANCHO;
    const alto = LOGICO_ALTO;
    // Con "fondo" el lienzo dibuja su propio paisaje (js/arqueria-visual.js) y es opaco, que se compone más barato.
    // Sin él (Muerte Súbita) se queda transparente sobre el fondo de su página.
    const visual = fondo && window.ArqueriaVisual ? window.ArqueriaVisual.crear({ ancho, alto }) : null;
    const ctx = canvas.getContext("2d", visual ? { alpha: false } : undefined);

    let nombreJugador = "Tú"; // se cambia por el nombre de usuario cuando hay sesión
    let vs = false; // partida contra otro jugador: el puntaje del rival llega de fuera
    let textoFin = null;
    let azar = Math.random; // con semilla en las partidas contra otro jugador
    let sucio = true; // fuera de la partida solo se vuelve a dibujar cuando algo cambió
    let relojVisual = 0; // segundos que lleva la página abierta: anima nubes, aves y luciérnagas
    let faseVisual = 0; // 0 = hora dorada, 1 = noche; sigue al minuto de juego con suavidad
    let ultimoDibujo = 0;
    let sacudida = 0;
    let cursorActual = "";
    // Rival de la casa en modo galería: su mira, el blanco que tiene elegido y lo que tarda en apuntar
    let ia = null;
    let cal = null; // calendario de blancos de la partida (el mismo en solitario y entre jugadores)
    let compartido = null; // partida entre dos jugadores: calendario de blancos, golpes ya repartidos y mira del rival
    let estado = "listo"; // listo | jugando | fin
    let tiempo = 0;
    let puntaje = 0;
    let puntajeRival = 0;
    let blancos = [];
    let efectos = [];
    let temporizadorBlanco = 0;
    let temporizadorRival = 0;
    let destelloRival = 0;
    let resultado = "";
    let ultimo = 0;
    let cursor = null;
    let mouse = false; // la mira solo se dibuja con ratón; en táctil taparía el dedo

    let lastW = 0;
    function ajustarTamano() {
      const caja = canvas.getBoundingClientRect();
      // Con el campo grande no se pasa de ~1500 píxeles de ancho de dibujo, para no pagar relleno que no se ve
      const dpr = Math.max(0.75, Math.min(window.devicePixelRatio || 1, resolucionMax, 1500 / Math.max(1, caja.width)));
      canvas.width = Math.max(1, Math.round(caja.width * dpr));
      canvas.height = Math.max(1, Math.round(caja.height * dpr));
      ctx.setTransform(canvas.width / ancho, 0, 0, canvas.height / alto, 0, 0);
      if (visual) visual.redimensionar(canvas.width, canvas.height);
      sucio = true;
      cajaMedida = null;
    }

    /* Medir el lienzo obliga al navegador a recalcular la página; con un ratón que manda más de
       500 movimientos por segundo eso pesa. Se mide solo al cambiar de tamaño o al desplazar. */
    let cajaMedida = null;
    const medirCaja = () => { cajaMedida = null; };
    window.addEventListener("scroll", medirCaja, { passive: true });
    function posicion(e) {
      const r = cajaMedida || (cajaMedida = canvas.getBoundingClientRect());
      return { x: (e.clientX - r.left) * (ancho / r.width), y: (e.clientY - r.top) * (alto / r.height) };
    }

    function velocidad() {
      return cfg.velocidadBase + tiempo * 2.2;
    }

    function intervaloBlanco() {
      // En la galería el rival se lleva buena parte de los blancos, así que caen más seguidos
      return Math.max(0.45, 0.85 - tiempo * 0.006) * (visual && !vs ? 0.7 : 1);
    }

    function nuevoBlanco() {
      const r = cfg.radio;
      const x0 = r + azar() * (ancho - r * 2);
      return {
        x0, x: x0, y: -r, r, t: 0,
        amp: cfg.zigzag ? 18 + azar() * 40 : 0,
        frec: 1.2 + azar() * 1.6,
        vel: 0.92 + azar() * 0.2
      };
    }

    /* --- Calendario de blancos ---------------------------------------------------------------
       El blanco k aparece en tiempos[k], en un punto del campo que sale de la semilla, vive "vida" segundos y se
       esfuma. Su posición es una función pura del tiempo de la partida: no depende de la velocidad de cuadros ni de lo
       que haga nadie. Así, entre dos jugadores, los dos navegadores dibujan exactamente lo mismo. */
    function nuevoCalendario(semilla) {
      const tiempos = [0.5];
      while (tiempos.length < 400) {
        const t = tiempos[tiempos.length - 1];
        tiempos.push(t + Math.max(0.3, 0.62 - t * 0.0055) * (cfg.tasa ?? 1));
      }
      return { semilla: semilla >>> 0, tiempos, parametros: [], golpes: new Map(), kMin: 0 };
    }

    function prepararCompartido(semilla) {
      compartido = Object.assign(nuevoCalendario(semilla), { t0: 0, miraRival: null });
      cal = compartido;
    }

    function paramsBlanco(k) {
      let p = cal.parametros[k];
      if (!p) {
        const a = generadorConSemilla((cal.semilla * 31 + k * 7919) >>> 0);
        const rapido = a() < (cfg.rapido ?? 0.25);
        const r = cfg.radio * (rapido ? 0.68 : 0.92 + a() * 0.16);
        const margen = r + 24;
        const x0 = margen + a() * (ancho - margen * 2);
        const y0 = 128 + r + a() * (alto - 128 - r * 2 - 36); // bajo el marcador
        const vx = a() < (cfg.desliza ?? 0) ? (a() < 0.5 ? -1 : 1) * (70 + a() * 110) : 0;
        const vida = (cfg.vida ?? 2.2) * (rapido ? 0.62 : 1) * Math.max(0.72, 1 - cal.tiempos[k] * 0.003);
        p = cal.parametros[k] = { r, x0, y0, vx, vida, mult: rapido ? 2 : 1, rapido };
      }
      return p;
    }

    function posBlanco(k, T) {
      const p = paramsBlanco(k);
      const edad = T - cal.tiempos[k];
      let x = p.x0;
      if (p.vx) {
        // los que se deslizan rebotan en los bordes del campo
        const lo = p.r + 8;
        const tramo = ancho - p.r - 8 - lo;
        let u = (p.x0 - lo + p.vx * edad) % (2 * tramo);
        if (u < 0) u += 2 * tramo;
        x = lo + (u > tramo ? 2 * tramo - u : u);
      }
      return { k, x, y: p.y0, r: p.r, edad, vida: p.vida, mult: p.mult, rapido: p.rapido };
    }

    function blancosVivos(T) {
      const lista = [];
      if (T < 0 || !cal) return lista;
      const { tiempos, golpes } = cal;
      for (let k = cal.kMin; k < tiempos.length && tiempos[k] <= T; k++) {
        const b = posBlanco(k, T);
        if (b.edad >= b.vida) { if (k === cal.kMin) cal.kMin++; continue; }
        if (golpes.has(k)) continue;
        lista.push(b);
      }
      return lista;
    }

    /* Una flecha que vuela de (x0, y0) a (x, y). Las tuyas salen de abajo en el centro y son doradas; las del rival, del color de
       su mira y desde el borde de abajo, bajo su mira. */
    function lanzarFlecha(x0, y0, x, y, plumas, viaje) {
      if (!visual) return;
      efectos.push({ tipo: "flecha", x0, y0, x, y, plumas, viaje, edad: 0, vida: viaje + 0.5 });
    }

    /* El golpe de tu rival: su flecha (si no se ha lanzado ya) y, cuando llega, el blanco que salta en pedazos. */
    function golpeVisualRival(x, y, r, pts, x0, y0, { flecha = true, retraso = 0 } = {}) {
      if (!visual) return;
      if (flecha) lanzarFlecha(x0, y0, x, y, cfg.color, retraso || 0.14);
      const e0 = -retraso;
      const centro = pts === 10 || pts === 20;
      efectos.push({ tipo: "anillo", x, y, r0: r * 0.4, r1: r * (centro ? 2.1 : 1.5), color: cfg.color, edad: e0, vida: centro ? 0.5 : 0.35 });
      efectos.push({ tipo: "texto", x, y, texto: centro ? `¡CENTRO! +${pts}` : `+${pts}`, grande: centro, edad: e0, vida: 0.8, color: cfg.color });
      for (let j = 0; j < 5; j++) {
        const a = Math.random() * Math.PI * 2;
        const v = 80 + Math.random() * 140;
        efectos.push({ tipo: "pedazo", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90, rot: Math.random() * 6, giro: (Math.random() - 0.5) * 18, l: 7 + Math.random() * 7, color: [cfg.color, "#e8e4d0", cfg.color, "#ffffff"][j % 4], edad: e0, vida: 0.7 });
      }
    }

    function efectosRival(k, pts) {
      if (!visual) return;
      const b = posBlanco(k, Math.max(0, tiempo));
      const m = compartido.miraRival;
      golpeVisualRival(b.x, Math.min(alto - 30, Math.max(40, b.y)), b.r, pts, m ? m.px : ancho * 0.75, alto + 14, { retraso: 0.14 });
    }

    /* El golpe de tu rival llega del servidor. Si tú también habías disparado a ese blanco, el servidor
       decide: hasta que conteste se espera, y si te lo ganaron, perdido() lo aplica. */
    function golpeRival(k, pts, silencioso) {
      if (!compartido) return;
      const g = compartido.golpes.get(k);
      if (g && g.por === "yo" && !g.perdido) { g.rivalPts = pts; return; }
      if (g && g.por === "rival" && g.contado) return;
      compartido.golpes.set(k, { por: "rival", pts, contado: true });
      puntajeRival += pts;
      destelloRival = 0.35;
      sucio = true;
      if (!silencioso) efectosRival(k, pts);
    }

    /* Tu propio golpe confirmado por el servidor (o recuperado al volver a abrir la partida). */
    function golpePropio(k, pts) {
      if (!compartido) return;
      const g = compartido.golpes.get(k);
      if (g && g.por === "yo") { g.pendiente = false; return; }
      if (g) return;
      compartido.golpes.set(k, { por: "yo", pts });
      puntaje += pts;
      sucio = true;
    }

    /* El servidor dio el blanco a tu rival (llegó antes) o tu disparo no pudo registrarse. */
    function perdido(k) {
      const g = compartido && compartido.golpes.get(k);
      if (!g || g.por !== "yo" || g.perdido) return;
      puntaje = Math.max(0, puntaje - g.pts);
      const pts = g.rivalPts || 0;
      compartido.golpes.set(k, pts ? { por: "rival", pts, contado: true } : { por: "rival", pts: 0, contado: false });
      if (pts) { puntajeRival += pts; destelloRival = 0.35; }
      const b = posBlanco(k, Math.max(0, tiempo));
      efectos.push({ tipo: "texto", x: b.x, y: Math.min(alto - 40, Math.max(60, b.y)), texto: "¡Te lo ganaron!", chico: true, edad: 0, vida: 0.9, color: "#ff9d8a" });
      if (pts) efectosRival(k, pts);
      sucio = true;
    }

    function setMiraRival(x, y) {
      if (!compartido) return;
      const m = compartido.miraRival || (compartido.miraRival = { x, y, px: x, py: y, t: 0 });
      m.x = x; m.y = y; m.t = relojVisual;
    }

    function disparar(x, y) {
      // El blanco más cercano al frente (el último dibujado) que contenga el tiro
      for (let i = blancos.length - 1; i >= 0; i--) {
        const b = blancos[i];
        const d = Math.hypot(x - b.x, y - b.y) / b.r;
        if (d > 1) continue;
        const anillo = d < 0.25 ? 0 : d < 0.55 ? 1 : 2;
        const pts = PUNTOS_ANILLO[anillo] * (b.mult || 1);
        puntaje += pts;
        if (onPuntaje) onPuntaje(puntaje);
        if (cal) {
          // El blanco desaparece ya para ti; entre jugadores el servidor confirma si fuiste el primero (si no, perdido())
          cal.golpes.set(b.k, { por: "yo", pts, pendiente: !!compartido });
          if (compartido && onGolpe) onGolpe({ blanco: b.k, puntos: pts, x: b.x, y: b.y });
        }
        efectos.push({ tipo: "texto", x: b.x, y: b.y, texto: anillo === 0 && visual ? `¡CENTRO! +${pts}` : `+${pts}`, grande: anillo === 0, edad: 0, vida: 0.7, color: anillo === 0 ? "#ffd84a" : "#e8e4d0" });
        if (visual) {
          lanzarFlecha(ancho / 2, alto + 14, b.x, b.y, "#f1c40f", 0.09);
          efectos.push({ tipo: "anillo", x: b.x, y: b.y, r0: b.r * 0.4, r1: b.r * (anillo === 0 ? 2.1 : 1.5), color: anillo === 0 ? "#ffe27a" : "#f4ecd2", edad: 0, vida: anillo === 0 ? 0.5 : 0.35 });
          for (let k = 0; k < 6; k++) {
            const a = Math.random() * Math.PI * 2;
            const v = 80 + Math.random() * 150;
            efectos.push({ tipo: "pedazo", x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90, rot: Math.random() * 6, giro: (Math.random() - 0.5) * 18, l: 7 + Math.random() * 7, color: ["#e8e4d0", "#c0392b", "#e8e4d0", "#f1c40f"][k % 4], edad: 0, vida: 0.7 });
          }
          if (anillo === 0) sacudida = 0.16;
        }
        for (let k = 0; k < 7; k++) {
          const a = Math.random() * Math.PI * 2;
          const v = 70 + Math.random() * 130;
          efectos.push({ tipo: "chispa", x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, edad: 0, vida: 0.5, color: anillo === 0 ? "#f1c40f" : "#c0392b" });
        }
        blancos.splice(i, 1);
        return;
      }
      if (visual) {
        lanzarFlecha(ancho / 2, alto + 14, x, y, "#f1c40f", 0.09);
        efectos.push({ tipo: "polvo", x, y, fase: Math.random() * 6, edad: 0, vida: 0.5 });
      }
    }

    /* --- Rival de la casa como tirador de galería ------------------------------------------------
       Ve un blanco nuevo cuando pasa su tiempo de reacción, elige el que más le conviene (valor entre lo
       que tarda en llegar la mira, con algo de despiste según su nivel), mueve su mira hasta él a su velocidad,
       la asienta, dispara y recarga. Si el blanco se esfuma o se lo llevas antes, elige otro. */
    function nuevaIA() {
      return { mira: { x: ancho * 0.5, y: alto * 0.55, px: ancho * 0.5, py: alto * 0.55, t: 0 }, objetivo: null, asentar: 0, recarga: 0.6, vuelo: null, deriva: 0 };
    }

    const viajeIA = () => cfg.vuelo ?? 0.14;

    function elegirIA() {
      const m = ia.mira;
      let mejor = null;
      let mejorP = 0;
      for (const b of blancos) {
        if (b.edad < cfg.reaccion + ((b.k * 0.37) % 0.12)) continue; // todavía no lo ha visto
        const f = posBlanco(b.k, tiempo + 0.2);
        const tLleg = Math.hypot(f.x - m.x, f.y - m.y) / cfg.veloz + cfg.asentar + viajeIA();
        if (tLleg > b.vida - b.edad - 0.04) continue; // no le da tiempo
        const p = ((b.mult * 7) / (tLleg + 0.25)) * (1 + Math.random() * cfg.ruido);
        if (p > mejorP) { mejorP = p; mejor = b; }
      }
      if (!mejor) { ia.recarga = 0.05; return; }
      ia.objetivo = mejor;
      ia.asentar = cfg.asentar * (0.85 + Math.random() * 0.4);
    }

    function actualizarIA(dt) {
      if (!ia) ia = nuevaIA();
      const m = ia.mira;
      m.t = relojVisual;
      ia.deriva += dt;
      if (ia.vuelo) { ia.vuelo.restante -= dt; if (ia.vuelo.restante <= 0) aterrizarIA(); }
      ia.recarga -= dt;
      if (ia.objetivo) ia.objetivo = blancos.find(o => o.k === ia.objetivo.k) || null; // se esfumó o se lo quitaron
      if (!ia.objetivo) {
        // sin blanco, la mira vaga despacio por el centro
        const dx = ancho * (0.5 + 0.3 * Math.sin(ia.deriva * 0.5)) - m.x;
        const dy = alto * (0.55 + 0.12 * Math.sin(ia.deriva * 0.8 + 1)) - m.y;
        m.x += dx * Math.min(1, dt * 2.5);
        m.y += dy * Math.min(1, dt * 2.5);
        if (ia.recarga <= 0) elegirIA();
      } else {
        const f = posBlanco(ia.objetivo.k, tiempo + viajeIA() * 0.5 + 0.05);
        const dx = f.x - m.x;
        const dy = f.y - m.y;
        const dist = Math.hypot(dx, dy);
        if (dist > ia.objetivo.r * 0.3) {
          const k = Math.min(1, (cfg.veloz * dt) / dist);
          m.x += dx * k;
          m.y += dy * k;
        } else {
          m.x = f.x; m.y = f.y;
          ia.asentar -= dt;
          if (ia.asentar <= 0) dispararIA();
        }
      }
      m.px = m.x; m.py = m.y;
    }

    /* Dispara: la flecha sale de abajo, bajo su mira, y tarda un momento en llegar. Hasta entonces el blanco sigue ahí, así que
       puedes quitárselo. Si acierta, al llegar el blanco salta en pedazos y el punto es suyo. */
    function dispararIA() {
      const b = ia.objetivo;
      ia.objetivo = null;
      ia.recarga = cfg.recarga * (0.85 + Math.random() * 0.35);
      const f = posBlanco(b.k, tiempo + viajeIA());
      const x0 = ia.mira.x;
      const y0 = alto + 14;
      if (Math.random() > cfg.precision * (b.rapido ? 0.9 : 1)) {
        // Falla: la flecha cae cerca del blanco
        const a = Math.random() * Math.PI * 2;
        const d = b.r * (1.25 + Math.random() * 0.9);
        const x = f.x + Math.cos(a) * d;
        const y = f.y + Math.sin(a) * d;
        lanzarFlecha(x0, y0, x, y, cfg.color, viajeIA());
        ia.vuelo = { b, golpe: false, x, y, restante: viajeIA() };
        return;
      }
      const r = Math.random();
      const anillo = r < cfg.dist[0] ? 0 : r < cfg.dist[0] + cfg.dist[1] ? 1 : 2;
      lanzarFlecha(x0, y0, f.x, f.y, cfg.color, viajeIA());
      ia.vuelo = { b, golpe: true, pts: PUNTOS_ANILLO[anillo] * b.mult, x: f.x, y: f.y, restante: viajeIA() };
    }

    function aterrizarIA() {
      const vuelo = ia.vuelo;
      ia.vuelo = null;
      if (!vuelo.golpe) { efectos.push({ tipo: "polvo", x: vuelo.x, y: vuelo.y, fase: Math.random() * 6, edad: 0, vida: 0.5 }); return; }
      const vivo = blancos.find(o => o.k === vuelo.b.k);
      if (!vivo) return; // se esfumó o se lo quitaron mientras volaba la flecha
      puntajeRival += vuelo.pts;
      destelloRival = 0.45;
      cal.golpes.set(vivo.k, { por: "rival", pts: vuelo.pts, contado: true });
      blancos = blancos.filter(o => o.k !== vivo.k);
      golpeVisualRival(vivo.x, vivo.y, vivo.r, vuelo.pts, 0, 0, { flecha: false });
    }

    function tiroDelRival() {
      if (Math.random() > cfg.precision) return;
      const r = Math.random();
      const anillo = r < cfg.dist[0] ? 0 : r < cfg.dist[0] + cfg.dist[1] ? 1 : 2;
      puntajeRival += PUNTOS_ANILLO[anillo];
      destelloRival = 0.45;
      if (visual) efectos.push({ tipo: "texto", x: ancho - 120, y: 122, texto: `+${PUNTOS_ANILLO[anillo]}`, chico: true, edad: 0, vida: 0.7, color: cfg.color });
    }

    function cambiarEstado(nuevo) {
      estado = nuevo;
      sucio = true;
      if (window.MusicaPaginas) MusicaPaginas.partida(nuevo === "jugando");
      if (onEstado) onEstado(nuevo);
    }

    function iniciar() {
      if (!vs) azar = Math.random;
      textoFin = null;
      ia = nuevaIA();
      tiempo = 0; puntaje = 0; puntajeRival = 0; efectos = [];
      if (visual) { cal = nuevoCalendario(Math.floor(Math.random() * 2147483647)); blancos = []; }
      else blancos = [nuevoBlanco()];
      temporizadorBlanco = intervaloBlanco(); temporizadorRival = cfg.intervalo; destelloRival = 0; resultado = "";
      cambiarEstado("jugando");
    }

    /* Arranca la partida entre jugadores en el instante t0 (en milisegundos de performance.now()). Con t0 en el
       futuro hay cuenta atrás; con t0 pasado (se recargó la página a mitad de partida) entra por donde va. */
    function iniciarCompartido(t0) {
      if (!compartido) return;
      compartido.t0 = t0;
      compartido.golpes.clear();
      compartido.kMin = 0;
      compartido.miraRival = null;
      textoFin = null; puntaje = 0; puntajeRival = 0; efectos = []; blancos = []; destelloRival = 0; resultado = "";
      tiempo = (performance.now() - t0) / 1000;
      cambiarEstado("jugando");
    }

    function terminar() {
      resultado = vs ? "" : puntaje > puntajeRival ? "ganado" : puntaje < puntajeRival ? "perdido" : "empate";
      cambiarEstado("fin");
      if (onFin) onFin({ puntaje, puntajeRival, resultado, vs });
    }

    /* Rendirse en una partida contra un rival de la casa: termina ya, cuenta como derrota y lo avisa en onFin
       con rendicion: true. Devuelve false si no hay partida en marcha o es contra otro jugador (ahí rinde el servidor). */
    function rendirse() {
      if (estado !== "jugando" || vs) return false;
      resultado = "perdido";
      textoFin = { titulo: "Te rendiste", sub: `${puntaje} a ${puntajeRival}` };
      cambiarEstado("fin");
      if (onFin) onFin({ puntaje, puntajeRival, resultado, vs, rendicion: true });
      return true;
    }

    function actualizar(dt) {
      if (estado === "jugando" && compartido) {
        tiempo = (performance.now() - compartido.t0) / 1000;
        blancos = blancosVivos(tiempo);
        if (destelloRival > 0) destelloRival -= dt;
        if (tiempo >= duracion) { tiempo = duracion; blancos = []; terminar(); }
      } else if (estado === "jugando" && visual) {
        tiempo += dt;
        blancos = blancosVivos(tiempo);
        if (destelloRival > 0) destelloRival -= dt;
        actualizarIA(dt);
        if (tiempo >= duracion) { tiempo = duracion; blancos = []; terminar(); }
      } else if (estado === "jugando") {
        tiempo += dt;
        temporizadorBlanco -= dt;
        if (temporizadorBlanco <= 0) { blancos.push(nuevoBlanco()); temporizadorBlanco = intervaloBlanco(); }
        temporizadorRival -= dt;
        if (!vs && !visual) while (temporizadorRival <= 0) { tiroDelRival(); temporizadorRival += cfg.intervalo; }
        if (destelloRival > 0) destelloRival -= dt;
        const v = velocidad();
        for (const b of blancos) {
          b.t += dt;
          b.y += v * b.vel * dt;
          if (b.amp) b.x = Math.min(ancho - b.r, Math.max(b.r, b.x0 + Math.sin(b.t * b.frec * 2) * b.amp));
        }
        blancos = blancos.filter(b => b.y - b.r < alto);
        if (tiempo >= duracion) { tiempo = duracion; terminar(); }
      }
      for (const e of efectos) {
        e.edad += dt;
        if (e.edad < 0) continue; // todavía espera a que llegue su flecha
        if (e.tipo === "chispa" || e.tipo === "pedazo") { e.vy += (e.tipo === "pedazo" ? 620 : 380) * dt; e.x += e.vx * dt; e.y += e.vy * dt; }
        else if (e.tipo === "texto") e.y -= 40 * dt;
      }
      efectos = efectos.filter(e => e.edad < e.vida);
    }

    /* Blanco de la galería: aparece con un pequeño rebote, un anillo de tiempo se va vaciando a su alrededor
       (se pone rojo al final) y se desvanece en el último momento. Los dorados valen el doble. */
    function dibujarBlancoGaleria(b) {
      const resto = b.vida - b.edad;
      const e = Math.min(1, b.edad / 0.14);
      const esc = e < 1 ? 1 + 2.70158 * Math.pow(e - 1, 3) + 1.70158 * Math.pow(e - 1, 2) : 1;
      const paleta = b.rapido
        ? [[1, "#fff1b8"], [0.78, "#e0902a"], [0.55, "#fff1b8"], [0.38, "#e0902a"], [0.25, "#ffffff"]]
        : [[1, "#e8e4d0"], [0.78, "#c0392b"], [0.55, "#e8e4d0"], [0.38, "#c0392b"], [0.25, "#f1c40f"]];
      ctx.save();
      ctx.globalAlpha = resto < 0.3 ? Math.max(0, resto / 0.3) : 1;
      ctx.translate(b.x, b.y);
      ctx.scale(esc, esc);
      for (const [f, color] of paleta) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, b.r * f, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(0,0,0,.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, b.r, 0, Math.PI * 2);
      ctx.stroke();
      const quedan = Math.max(0, resto / b.vida);
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.strokeStyle = quedan < 0.28 ? "#ff7a5c" : b.rapido ? "#ffd84a" : "rgba(255,255,255,.8)";
      ctx.beginPath();
      ctx.arc(0, 0, b.r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * quedan);
      ctx.stroke();
      if (b.rapido) {
        ctx.font = '800 15px "Karla", "Segoe UI", Arial, sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.lineJoin = "round";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(10,10,6,.8)";
        ctx.strokeText("×2", 0, -b.r - 14);
        ctx.fillStyle = "#ffd84a";
        ctx.fillText("×2", 0, -b.r - 14);
      }
      ctx.restore();
    }

    function dibujarBlanco(b) {
      if (b.vida) { dibujarBlancoGaleria(b); return; }
      const anillos = [[1, "#e8e4d0"], [0.78, "#c0392b"], [0.55, "#e8e4d0"], [0.38, "#c0392b"], [0.25, "#f1c40f"]];
      for (const [f, color] of anillos) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * f, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(0,0,0,.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    function dibujarMarcador() {
      const total = Math.max(60, puntaje, puntajeRival, 1);
      ctx.textBaseline = "alphabetic";
      ctx.font = "600 30px sans-serif";
      ctx.textAlign = "left";
      ctx.fillStyle = "#e8e4d0";
      ctx.fillText(`${nombreJugador} ${puntaje}`, 22, 40);
      ctx.textAlign = "right";
      ctx.fillStyle = cfg.color;
      ctx.fillText(`${cfg.nombre} ${puntajeRival}`, ancho - 22, 40);
      // barras de puntaje
      ctx.fillStyle = "rgba(255,255,255,.1)";
      ctx.fillRect(22, 52, 300, 8);
      ctx.fillRect(ancho - 322, 52, 300, 8);
      ctx.fillStyle = "#e8e4d0";
      ctx.fillRect(22, 52, 300 * Math.min(1, puntaje / (total * 1.15)), 8);
      ctx.fillStyle = destelloRival > 0 ? "#ffffff" : cfg.color;
      const w = 300 * Math.min(1, puntajeRival / (total * 1.15));
      ctx.fillRect(ancho - 22 - w, 52, w, 8);
      // tiempo
      ctx.textAlign = "center";
      ctx.fillStyle = "#e8e4d0";
      ctx.font = "600 34px sans-serif";
      ctx.fillText(String(Math.ceil(duracion - tiempo)), ancho / 2, 44);
      ctx.fillStyle = "rgba(255,255,255,.1)";
      ctx.fillRect(ancho / 2 - 70, 54, 140, 6);
      ctx.fillStyle = "#e8e4d0";
      ctx.fillRect(ancho / 2 - 70, 54, 140 * (1 - tiempo / duracion), 6);
    }

    function dibujarMira(x, y) {
      ctx.save();
      ctx.lineCap = "round";
      for (const [color, ancho] of [["rgba(0,0,0,.6)", 5], ["#ffe08a", 2.5]]) {
        ctx.strokeStyle = color;
        ctx.lineWidth = ancho;
        ctx.beginPath();
        ctx.arc(x, y, 17, 0, Math.PI * 2);
        // cuatro marcas que salen del aro
        ctx.moveTo(x - 27, y); ctx.lineTo(x - 9, y);
        ctx.moveTo(x + 9, y); ctx.lineTo(x + 27, y);
        ctx.moveTo(x, y - 27); ctx.lineTo(x, y - 9);
        ctx.moveTo(x, y + 9); ctx.lineTo(x, y + 27);
        ctx.stroke();
      }
      ctx.fillStyle = "#ff6b5a";
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    /* La mira de tu rival, que llega del otro navegador unas diez veces por segundo y se suaviza al dibujarla */
    function dibujarMiraRival() {
      const m = compartido ? compartido.miraRival : (visual && !vs && ia ? ia.mira : null);
      if (!m || estado !== "jugando") return;
      const viejo = relojVisual - m.t;
      if (viejo > 1.5) return;
      ctx.save();
      ctx.globalAlpha = Math.min(0.9, 1.5 - viejo);
      ctx.strokeStyle = cfg.color;
      ctx.fillStyle = cfg.color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(m.px, m.py, 15, 0, Math.PI * 2);
      ctx.moveTo(m.px - 24, m.py); ctx.lineTo(m.px - 8, m.py);
      ctx.moveTo(m.px + 8, m.py); ctx.lineTo(m.px + 24, m.py);
      ctx.moveTo(m.px, m.py - 24); ctx.lineTo(m.px, m.py - 8);
      ctx.moveTo(m.px, m.py + 8); ctx.lineTo(m.px, m.py + 24);
      ctx.stroke();
      ctx.font = '700 13px "Karla", "Segoe UI", Arial, sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(10,10,6,.75)";
      ctx.strokeText(cfg.nombre, m.px, m.py - 30);
      ctx.fillText(cfg.nombre, m.px, m.py - 30);
      ctx.restore();
    }

    function dibujarConPaisaje() {
      ctx.save();
      if (sacudida > 0) ctx.translate((Math.random() - 0.5) * 5 * (sacudida / 0.16), (Math.random() - 0.5) * 5 * (sacudida / 0.16));
      visual.fondo(ctx, { t: relojVisual, fase: faseVisual });
      if (estado !== "fin") for (const b of blancos) dibujarBlanco(b);
      for (const e of efectos) visual.efecto(ctx, e);
      ctx.restore();
      dibujarMiraRival();
      if (estado !== "listo") {
        visual.hud(ctx, {
          nombre: nombreJugador, puntaje, nombreRival: cfg.nombre, colorRival: cfg.color, puntajeRival,
          destelloRival, tiempo: Math.max(0, tiempo), duracion, reloj: relojVisual
        });
      }
      if (estado === "jugando" && cursor && mouse) dibujarMira(cursor.x, cursor.y);
      if (pantallas && estado !== "jugando") {
        const titulo = estado === "listo" ? `${nombreJugador} contra ${cfg.nombre}`
          : textoFin && textoFin.titulo ? textoFin.titulo
          : vs ? "Tiempo"
          : resultado === "ganado" ? "Ganaste" : resultado === "perdido" ? "Perdiste" : "Empate";
        const sub = estado === "fin" ? (textoFin && textoFin.sub ? textoFin.sub : `${puntaje} a ${puntajeRival}`) : "";
        visual.pantalla(ctx, { titulo, sub, reglas: estado === "listo" ? (vs ? REGLAS_VS : REGLAS) : null, escala: (canvas.clientWidth || ancho) / ancho });
      }
    }

    function dibujar() {
      if (visual) { dibujarConPaisaje(); return; }
      ctx.clearRect(0, 0, ancho, alto);
      for (const b of blancos) dibujarBlanco(b);
      for (const e of efectos) {
        ctx.globalAlpha = Math.max(0, 1 - e.edad / e.vida);
        if (e.tipo === "chispa") {
          ctx.fillStyle = e.color;
          ctx.fillRect(Math.round(e.x), Math.round(e.y), 4, 4);
        } else {
          ctx.fillStyle = e.color;
          ctx.font = "700 28px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(e.texto, e.x, e.y);
        }
      }
      ctx.globalAlpha = 1;
      if (estado !== "listo") dibujarMarcador();
      if (estado === "jugando" && cursor && mouse) dibujarMira(cursor.x, cursor.y);
      if (pantallas && estado !== "jugando") {
        ctx.fillStyle = "rgba(0,0,0,.5)";
        ctx.fillRect(0, 0, ancho, alto);
        ctx.textAlign = "center";
        ctx.fillStyle = "#e8e4d0";
        ctx.font = "600 52px sans-serif";
        const titulo = estado === "listo" ? `${nombreJugador} contra ${cfg.nombre}`
          : textoFin && textoFin.titulo ? textoFin.titulo
          : vs ? "Tiempo"
          : resultado === "ganado" ? "Ganaste" : resultado === "perdido" ? "Perdiste" : "Empate";
        ctx.fillText(titulo, ancho / 2, alto * 0.28);
        if (estado === "fin") {
          ctx.font = "30px sans-serif";
          ctx.fillStyle = "#b9b5a2";
          ctx.fillText(textoFin && textoFin.sub ? textoFin.sub : `${puntaje} a ${puntajeRival}`, ancho / 2, alto * 0.36);
        }
      }
    }

    function cuadro(t) {
      const dt = Math.min(0.05, (t - ultimo) / 1000 || 0);
      ultimo = t;
      actualizar(dt);
      if (visual) {
        relojVisual += dt;
        if (sacudida > 0) sacudida = Math.max(0, sacudida - dt);
        const objetivo = estado === "jugando" ? Math.max(0, tiempo) / duracion : estado === "fin" ? 1 : 0;
        const m = compartido && compartido.miraRival;
        if (m) { m.px += (m.x - m.px) * Math.min(1, dt * 16); m.py += (m.y - m.py) * Math.min(1, dt * 16); }
        faseVisual += (objetivo - faseVisual) * Math.min(1, dt * (estado === "jugando" ? 6 : 1.2));
      }
      // Con paisaje, fuera de la partida se redibuja a unos 25 cuadros por segundo para que el cielo siga vivo sin gastar de más
      if (estado === "jugando" || efectos.length || sucio || (visual && t - ultimoDibujo >= 40)) { dibujar(); sucio = false; ultimoDibujo = t; }
      const forma = estado === "jugando" && mouse ? "none" : "";
      if (forma !== cursorActual) { canvas.style.cursor = forma; cursorActual = forma; }
      requestAnimationFrame(cuadro);
    }

    canvas.addEventListener("pointerenter", medirCaja);
    canvas.addEventListener("pointerdown", e => {
      if (estado !== "jugando") return;
      cajaMedida = null; // un disparo siempre con la medida al día
      const p = posicion(e);
      disparar(p.x, p.y);
    });
    canvas.addEventListener("pointermove", e => {
      cursor = posicion(e);
      mouse = e.pointerType === "mouse";
      if (compartido && onMira && estado === "jugando") onMira(cursor.x, cursor.y);
    });
    canvas.addEventListener("pointerleave", () => { cursor = null; });
    document.addEventListener("keydown", e => {
      if (e.repeat || estado !== "jugando" || !cursor) return;
      const tecla = e.key.toLowerCase();
      if (tecla !== "z" && tecla !== "x") return;
      if (e.target && /^(input|textarea|select)$/i.test(e.target.tagName)) return;
      disparar(cursor.x, cursor.y);
    });
    window.addEventListener("resize", ajustarTamano);
    // El lienzo también cambia de tamaño sin que la ventana cambie (la fuente o el tema cargan tarde)
    if (window.ResizeObserver) new ResizeObserver(() => { const c = canvas.getBoundingClientRect(); if (Math.round(c.width * 100) !== lastW) { lastW = Math.round(c.width * 100); ajustarTamano(); } }).observe(canvas);

    ajustarTamano();
    requestAnimationFrame(cuadro);

    /* Cambia de rival entre partidas (no mientras se juega). */
    function cambiarRival(clave) {
      if (estado === "jugando" || !RIVALES[clave]) return;
      cfg = RIVALES[clave];
      vs = false;
      compartido = null;
      cal = null;
      azar = Math.random;
      cambiarEstado("listo");
    }

    /* Partida contra otro jugador: se deja el campo listo (con su rival y su
       semilla) y se arranca con iniciar() cuando termina la cuenta atrás. */
    function prepararVs({ nombre, color, semilla }) {
      if (estado === "jugando") return;
      cfg = { nombre, color, intervalo: 99, precision: 0, dist: [0.3, 0.4, 0.3], radio: 40, vida: 2.2, desliza: 0.3, rapido: 0.25, velocidadBase: 125, zigzag: true };
      vs = true;
      prepararCompartido(semilla);
      azar = generadorConSemilla(semilla);
      textoFin = null;
      puntaje = 0; puntajeRival = 0;
      cambiarEstado("listo");
    }

    function setNombreJugador(n) {
      const limpio = String(n || "").trim().slice(0, 16);
      if (limpio) { nombreJugador = limpio; sucio = true; }
    }

    function setPuntajeRival(n) {
      // En el campo compartido el puntaje sale de los golpes; el del servidor solo corrige si faltó alguno
      if (compartido && n <= puntajeRival) return;
      if (n > puntajeRival) destelloRival = 0.35;
      puntajeRival = n;
      sucio = true;
    }

    function setFin(texto) {
      textoFin = texto;
      sucio = true;
      if (estado === "listo") cambiarEstado("fin");
    }

    return {
      iniciar,
      rendirse,
      cambiarRival,
      prepararVs,
      iniciarCompartido,
      golpeRival,
      golpePropio,
      perdido,
      setMiraRival,
      setNombreJugador,
      setPuntajeRival,
      setFin,
      estado: () => estado,
      blancosVisibles: () => blancos.map(b => ({ k: b.k, x: b.x, y: b.y, r: b.r, mult: b.mult, edad: b.edad, vida: b.vida, rapido: b.rapido })),
      tiempoPartida: () => tiempo,
      ajustarTamano,
      marcador: () => ({ puntaje, puntajeRival, tiempo, duracion })
    };
  }

  crearArqueria.RIVALES = RIVALES; // para ajustar la dificultad con pruebas automáticas
  window.crearArqueria = crearArqueria;
})();
