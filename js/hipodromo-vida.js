/* =============================================================================
   HIPÓDROMO: la vida de las criaturas en la página inmersiva (hipodromo-vivo.html).

   No dibuja nada nuevo: mueve el SVG de siempre (js/hipodromo-dibujo.js con la opción vivo, que lo entrega en piezas con
   nombre y con sus medidas en data-rig). Dos capas:
   - Titere: un dibujo con huesos. Cada pata son dos tramos (muslo y caña) que se resuelven con cinemática inversa a partir de
     dónde tiene que pisar el pie, así que las mismas reglas valen para andar, trotar, galopar, echarse o sentarse, con las patas
     que tenga la criatura (cuatro, seis, pares dobles delante o detrás). Cuello, cabeza, orejas, ojos y cola se giran por su cuenta.
   - Actor: lo que decide qué hace (pastar, mirar a su alrededor, caminar, sentarse, echarse, saludar a otra, prepararse en la
     salida, galopar, frenar, recuperarse). Es una lista corta de estados con transiciones suaves, no una inteligencia.

   Todo se mide en unidades del dibujo (el SVG mide 240 de ancho) y en "metros de escenario", que son los de la pista.
============================================================================= */
window.HipodromoVida = (function () {
  "use strict";
  const RAD = Math.PI / 180;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const suave = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const acerca = (v, objetivo, tasa, dt) => v + (objetivo - v) * (1 - Math.exp(-tasa * dt));   // se acerca sin pasarse, igual a cualquier velocidad de cuadro
  const difAng = (a, b) => { let d = (a - b) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; };
  const azar = semilla => { let a = semilla >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const f2 = n => (Math.round(n * 100) / 100);

  /* ---------------------------------------------------------------- el títere */
  function crearTitere(svg) {
    const R = JSON.parse(svg.getAttribute("data-rig"));
    const sel = s => Array.from(svg.querySelectorAll(s));
    const GR = 6;   // inclinación del cuerpo al pastar (grados, hacia delante, con las patas de atrás clavadas)
    const T = {
      R, svg, cuerpos: sel(".r-b"), cuellos: sel(".r-cu"), cabeza: svg.querySelector(".r-cab"), orejas: sel(".r-or"), ojos: sel(".r-oj"), cola: svg.querySelector(".r-cola"),
      patas: R.p.map((p, i) => {
        const g = svg.querySelector('.r-pata[data-p="' + i + '"]');
        const H0 = [p.x, p.y0], K0 = [p.kx, p.ym], F0 = [p.x, p.yb];
        const l1 = Math.hypot(K0[0] - H0[0], K0[1] - H0[1]), l2 = Math.hypot(F0[0] - K0[0], F0[1] - K0[1]);
        const th1 = Math.atan2(K0[1] - H0[1], K0[0] - H0[0]), th2 = Math.atan2(F0[1] - K0[1], F0[0] - K0[0]), phi0 = Math.atan2(F0[1] - H0[1], F0[0] - H0[0]);
        return { p, g, muslo: g.querySelector(".r-muslo"), cana: g.querySelector(".r-cana"), H0, K0, F0, l1, l2, th1, th2, s: difAng(th1, phi0) >= 0 ? 1 : -1, frente: !!p.frente, lejos: !!p.lejos, rango: 0, L: l1 + l2 };
      }),
      L: 0, cuPasto: 60
    };
    T.L = T.patas.reduce((a, q) => a + q.L, 0) / Math.max(1, T.patas.length);
    // el orden de las patas dentro de su grupo (delante / detrás): 0 es la más cercana al extremo
    [true, false].forEach(fr => {
      const grupo = T.patas.filter(q => q.frente === fr && !q.lejos).sort((a, b) => (fr ? b.p.x - a.p.x : a.p.x - b.p.x));
      T.patas.filter(q => q.frente === fr).forEach(q => { q.rango = Math.max(0, grupo.findIndex(z => Math.abs(z.p.x - q.p.x) < 0.6 || (q.lejos && Math.abs(z.p.x - q.p.x) < 14))); });
    });
    // cuánto hay que bajar el cuello para que el hocico llegue a la hierba, con el cuerpo inclinado como al pastar
    const c18 = Math.cos(18 * RAD), s18 = Math.sin(18 * RAD);
    T.boca = [R.ca[0] + R.pt * c18 - R.ch * 0.2 * s18, R.ca[1] + R.pt * s18 + R.ch * 0.2 * c18];
    {
      const apl = matriz(R, { by: 0, rot: GR, piv: [R.xa, R.s - 2], resp: 0 }), n0 = apl(R.n0);
      const vx = T.boca[0] - R.n0[0], vy = T.boca[1] - R.n0[1], destino = R.s - 9;
      let mejor = 85;
      for (let d = 0; d <= 85; d += 1) { const a = (GR + d) * RAD; if (n0[1] + vx * Math.sin(a) + vy * Math.cos(a) >= destino) { mejor = d; break; } }
      T.cuPasto = mejor;
    }
    return T;
  }

  /* Matriz del cuerpo: lo que le pasa a un punto del dibujo en reposo con la respiración, el giro y el rebote */
  function matriz(R, P) {
    const c = Math.cos(P.rot * RAD), s = Math.sin(P.rot * RAD), bx = R.centro, by0 = R.cy + R.alto / 2, sx = 1 + P.resp * 0.5, sy = 1 + P.resp, px = P.piv[0], py = P.piv[1];
    return pt => {
      const x = bx + (pt[0] - bx) * sx, y = by0 + (pt[1] - by0) * sy, dx = x - px, dy = y - py;
      return [px + dx * c - dy * s, py + dx * s + dy * c + P.by];
    };
  }

  function resolverPata(q, hip, obj, signo) {
    const dx = obj[0] - hip[0], dy = obj[1] - hip[1], phi = Math.atan2(dy, dx);
    const Dc = clamp(Math.hypot(dx, dy), Math.abs(q.l1 - q.l2) + 0.5, q.l1 + q.l2 - 0.05);
    const alfa = Math.acos(clamp((q.l1 * q.l1 + Dc * Dc - q.l2 * q.l2) / (2 * q.l1 * Dc), -1, 1));
    const a1 = phi + (signo || q.s) * alfa, kx = hip[0] + q.l1 * Math.cos(a1), ky = hip[1] + q.l1 * Math.sin(a1);
    return [a1, Math.atan2(hip[1] + Dc * Math.sin(phi) - ky, hip[0] + Dc * Math.cos(phi) - kx)];
  }

  /* Pone una pose. P = { by, rot, piv:[x,y], resp, cu, cab, or, oj, cola, pies:[[x,y] por pata] } (ángulos en grados, + = en el sentido del reloj) */
  function posar(T, P) {
    const R = T.R, ap = matriz(R, P), bx = R.centro, by0 = R.cy + R.alto / 2, sx = 1 + P.resp * 0.5, sy = 1 + P.resp;
    const cuerpo = "translate(0 " + f2(P.by) + ") rotate(" + f2(P.rot) + " " + f2(P.piv[0]) + " " + f2(P.piv[1]) + ") translate(" + f2(bx) + " " + f2(by0) + ") scale(" + f2(sx) + " " + f2(sy) + ") translate(" + f2(-bx) + " " + f2(-by0) + ")";
    for (let i = 0; i < T.cuerpos.length; i++) T.cuerpos[i].setAttribute("transform", cuerpo);
    const cuello = "rotate(" + f2(P.cu) + " " + R.n0[0] + " " + R.n0[1] + ")";
    for (let i = 0; i < T.cuellos.length; i++) T.cuellos[i].setAttribute("transform", cuello);
    if (T.cabeza) T.cabeza.setAttribute("transform", "rotate(" + f2(P.cab) + " " + R.n3[0] + " " + R.n3[1] + ")");
    const or = "rotate(" + f2(P.or) + " " + R.or[0] + " " + R.or[1] + ")";
    for (let i = 0; i < T.orejas.length; i++) T.orejas[i].setAttribute("transform", or);
    const oj = "translate(" + R.oj[0] + " " + R.oj[1] + ") scale(1 " + f2(Math.max(0.08, P.oj)) + ") translate(" + (-R.oj[0]) + " " + (-R.oj[1]) + ")";
    for (let i = 0; i < T.ojos.length; i++) T.ojos[i].setAttribute("transform", oj);
    if (T.cola) T.cola.setAttribute("transform", "rotate(" + f2(P.cola) + " " + R.co[0] + " " + R.co[1] + ")");
    for (let i = 0; i < T.patas.length; i++) {
      const q = T.patas[i], hip = ap(q.H0);
      let a = resolverPata(q, hip, P.pies[i]);
      if (P.plega && P.wf > 0.001) {   // echada o sentada: la pata se pliega al otro lado (la de atrás dobla la articulación hacia arriba)
        const b = resolverPata(q, hip, P.plega[i], q.frente ? q.s : -q.s), u = suave(P.wf);
        a = [a[0] + difAng(b[0], a[0]) * u, a[1] + difAng(b[1], a[1]) * u];
      }
      q.g.setAttribute("transform", "translate(" + f2(hip[0] - q.H0[0]) + " " + f2(hip[1] - q.H0[1]) + ")");
      q.muslo.setAttribute("transform", "rotate(" + f2((a[0] - q.th1) / RAD) + " " + q.H0[0] + " " + q.H0[1] + ")");
      q.cana.setAttribute("transform", "rotate(" + f2(((a[1] - q.th2) - (a[0] - q.th1)) / RAD) + " " + q.K0[0] + " " + q.K0[1] + ")");
    }
  }

  /* ---------------------------------------------------------------- marchas */
  const GAIT = {
    quieto: { f: 0, beta: 0.62, A: 0, lift: 0, bob: 0, cab: 0 },
    paso: { beta: 0.64, lift: 0.17, bob: 0.9, cab: 3 },
    trote: { beta: 0.5, lift: 0.24, bob: 1.9, cab: 3.5 },
    galope: { beta: 0.34, lift: 0.34, bob: 3.6, cab: 5 }
  };
  // desfase de cada pata dentro del ciclo, según la marcha: [delante-cercana, delante-lejana, detrás-cercana, detrás-lejana]
  const FASES = { paso: [0.75, 0.25, 0.5, 0], trote: [0, 0.5, 0.5, 0], galope: [0.6, 0.5, 0.1, 0], quieto: [0.75, 0.25, 0.5, 0] };
  const faseDe = (modo, q) => (FASES[modo] || FASES.quieto)[(q.frente ? 0 : 2) + (q.lejos ? 1 : 0)] + q.rango * (modo === "galope" ? 0.05 : modo === "trote" ? 0.07 : 0.12);


  /* ---------------------------------------------------------------- el actor */
  const TASAS = { echada: 1.5, sentada: 1.7, pasto: 2.8, alerta: 5, jadeo: 1.1, nervio: 2, agacha: 6, salto: 14 };
  const CLAVES = Object.keys(TASAS);

  /* op: { id, titere, semilla }. El actor guarda su sitio (x en metros de escenario, f de 0 cerca a 1 lejos), hacia dónde mira
     (dir) y el estado en que está; la página lo coloca en pantalla. */
  function crearActor(op) {
    const tit = op.titere, R = tit.R, rng = azar(op.semilla || 1);
    const w = {}, obj = {};
    CLAVES.forEach(k => { w[k] = 0; obj[k] = 0; });
    return {
      id: op.id, titere: tit, rng, semilla: op.semilla || 1,
      x: 0, f: 0.5, dir: 1, flip: 1, v: 0, saltoY: 0,
      estado: "mirar", t: 0, dur: 5, dest: null, socio: null, w, obj, cojo: false, cansancio: 0,
      marcha: { fase: rng(), modo: "quieto", f: 0, A: 0, beta: 0.62, lift: 0, bob: 0, offPata: tit.patas.map(() => null) },
      mirar: { cu: 0, cab: 0, cuT: 0, cabT: 0, t: 0 }, tVida: rng() * 100, fb: rng() * 6,
      parpadeo: 2 + rng() * 4, parpadeando: 0, coleo: 0, coleoT: 3 + rng() * 6, oreja: 0, orejaT: 2 + rng() * 5, orejaV: 0,
      nervioso: clamp(1 - R.mir, 0, 1)
    };
  }

  /* Pone de golpe una postura (para las criaturas que ya estaban así cuando se abrió la página) */
  function ponerPostura(a, p) {
    CLAVES.forEach(k => { a.obj[k] = 0; a.w[k] = 0; });
    if (p === "echar") { a.obj.echada = a.w.echada = 1; a.estado = "echar"; }
    else if (p === "sentar") { a.obj.sentada = a.w.sentada = 1; a.estado = "sentar"; }
    else if (p === "pastar") { a.obj.pasto = a.w.pasto = 1; a.estado = "pastar"; }
    else a.estado = "mirar";
    a.t = 0; a.dur = 6 + a.rng() * 20;
  }

  /* Cuánto se echa atrás el torso al sentarse: el justo para que la grupa quede a ras de suelo girando sobre las patas de delante
     (así las delanteras siguen apoyadas aunque la criatura tenga las patas cortas). Se calcula una vez por criatura. */
  function anguloSentada(T) {
    if (T.angSent != null) return T.angSent;
    const R = T.R, gY = R.s - 2, tras = T.patas.filter(q => !q.frente);
    let ang = 20;
    for (let d = 2; d <= 42; d += 1) {
      const ap = matriz(R, { by: 0, rot: -d, piv: [R.xf, gY], resp: 0 });
      ang = d;
      if (tras.reduce((s, q) => s + ap(q.H0)[1], 0) / Math.max(1, tras.length) >= gY - 0.2 * T.L) break;
    }
    return (T.angSent = ang);
  }

  /* ---- la pose de un actor en este cuadro
     ctx: { dt, pxPorUnidad (píxeles de pantalla por unidad de dibujo), vPx (velocidad sobre el suelo, px/s), modo ("quieto" | "paso" | "trote" | "galope"),
            ant (0..1, atención en la salida), rasca (0..1, fase del raspado de pata), inclina, cuExtra, cabExtra, orExtra } */
  function pintarActor(a, ctx) {
    const T = a.titere, R = T.R, dt = ctx.dt, w = a.w, m = a.marcha, L = T.L, gY = R.s - 2;
    a.tVida += dt;
    CLAVES.forEach(k => { w[k] = acerca(w[k], a.obj[k], TASAS[k], dt); });
    const modo = ctx.modo || "quieto", G = GAIT[modo] || GAIT.quieto;

    // ---- marcha: pasos por segundo y cuánto se abre cada uno
    const ugu = ctx.vPx / Math.max(0.1, ctx.pxPorUnidad);   // unidades de dibujo por segundo de suelo
    let frec = 0, A = 0;
    if (modo === "paso") { frec = clamp(ugu / (1.3 * L), 0.55, 1.6); A = Math.min(0.34 * L, ugu / Math.max(0.3, frec) * G.beta / 2); }
    else if (modo === "trote") { frec = clamp(ugu / (1.8 * L), 1.2, 2.3); A = Math.min(0.38 * L, ugu / Math.max(0.3, frec) * G.beta / 2); }
    else if (modo === "galope") { frec = 1.85 + (a.semilla % 7) * 0.06; A = 0.38 * L; }
    m.f = acerca(m.f, frec, 9, dt); m.A = acerca(m.A, A, 7, dt); m.beta = acerca(m.beta, G.beta, 6, dt); m.lift = acerca(m.lift, G.lift * L, 8, dt); m.bob = acerca(m.bob, G.bob * (L / 50), 6, dt);
    m.modo = modo;
    m.fase = (m.fase + m.f * dt) % 1;

    // ---- cuerpo: rebote, giro y respiración
    const wl = w.echada, ws = w.sentada, wp = 1 - clamp(wl + ws, 0, 1), paso = clamp(m.A / (0.2 * L), 0, 1);
    let by = -m.bob * Math.abs(Math.sin(2 * Math.PI * m.fase)) * paso;
    if (modo === "galope") by = -m.bob * (0.5 + 0.5 * Math.sin(4 * Math.PI * m.fase + 0.6)) * 1.2;
    by = by * wp + wl * (R.lp - 6) + w.agacha * 3 + a.saltoY;
    let rot = (modo === "galope" ? 3.2 * Math.sin(2 * Math.PI * m.fase + 0.6) + 1.5 : modo === "trote" ? 0.9 * Math.sin(4 * Math.PI * m.fase) : 0) * wp;
    rot += -ws * anguloSentada(T) + w.pasto * 6 + w.agacha * 3 - w.salto * 14 + (ctx.inclina || 0);
    let piv = [R.centro, R.cy];
    const sumaP = ws + w.pasto + w.salto;
    if (sumaP > 0.01) {
      const wS = ws / sumaP, wP = w.pasto / sumaP, wZ = 1 - wS - wP;
      piv = [R.centro * wZ + R.xf * wS + R.xa * wP, R.cy * wZ + gY * (wS + wP)];
    }
    a.fb += (0.33 + 0.75 * w.jadeo + 0.25 * w.nervio) * dt;
    const resp = (0.009 + 0.022 * w.jadeo + 0.004 * w.nervio) * Math.sin(a.fb * 2 * Math.PI);
    const pies = new Array(T.patas.length), plega = new Array(T.patas.length);
    const P = { by, rot, piv, resp, cu: 0, cab: 0, or: 0, oj: 1, cola: 0, pies, plega, wf: clamp(wl + ws, 0, 1) }, ap = matriz(R, P);

    // ---- patas: marcha, o echada, o sentada (cada pata busca su pie con la cinemática inversa)
    for (let i = 0; i < T.patas.length; i++) {
      const q = T.patas[i], hip = ap(q.H0), off = faseDe(modo === "quieto" ? "paso" : modo, q);
      if (m.offPata[i] == null) m.offPata[i] = off;
      m.offPata[i] += difAng(off * 2 * Math.PI, m.offPata[i] * 2 * Math.PI) / (2 * Math.PI) * Math.min(1, dt * 8);
      const u = (((m.fase + m.offPata[i]) % 1) + 1) % 1, beta = m.beta;
      let dx, lev = 0;
      if (u < beta) dx = m.A * (1 - 2 * u / beta);
      else { const ww = (u - beta) / (1 - beta); dx = m.A * (-1 + 2 * suave(ww)); lev = Math.sin(Math.PI * ww); }
      let marcha = [q.p.x + dx, q.p.yb - m.lift * lev];
      if (a.cojo && i === T.patas.length - 1) marcha = [q.p.x + dx * 0.4, marcha[1] - 5];
      if (ctx.rasca != null && q.frente && !q.lejos && q.rango === 0) marcha = [q.p.x + 3 + 9 * Math.sin(ctx.rasca * 2 * Math.PI), q.p.yb - 9 * Math.max(0, Math.sin(ctx.rasca * 2 * Math.PI + 0.6)) - 1];
      if (w.salto > 0.01 && q.frente) marcha = [lerp(marcha[0], q.p.x + 10, w.salto), lerp(marcha[1], q.p.yb - 22, w.salto)];
      const sep = q.lejos ? 6 : 0;
      // como en un caballo sentado o echado: las patas de atrás quedan tendidas hacia delante bajo el vientre (la articulación arriba),
      // las de delante estiradas hacia delante y abajo
      const echada = q.frente ? [hip[0] + 0.82 * q.L + sep, gY] : [hip[0] + 0.7 * q.L + sep * 0.6, gY];
      const sentada = q.frente ? [q.p.x + 0.12 * q.L + sep * 0.5, q.p.yb] : [hip[0] + 0.62 * q.L + sep * 0.6, gY];
      pies[i] = marcha;
      const wf = wl + ws;
      plega[i] = wf > 0.001 ? [(echada[0] * wl + sentada[0] * ws) / wf, (echada[1] * wl + sentada[1] * ws) / wf] : marcha;
    }

    // ---- cuello, cabeza y orejas
    const ant = ctx.ant || 0, ph = Math.sin(2 * Math.PI * m.fase * 2 + 1.2) * paso, ph2 = Math.sin(2 * Math.PI * m.fase * 2 + 2) * paso;
    let cu = w.pasto * T.cuPasto + ws * 42 + wl * 26 + w.jadeo * 18 + a.mirar.cu * (1 - w.pasto) - ant * 12 - w.salto * 18 + (ctx.cuExtra || 0);
    let cab = a.mirar.cab * (1 - w.pasto) + w.pasto * 14 + (ws + wl) * 10 + w.jadeo * 8 - ant * 4 - w.salto * 8 + (ctx.cabExtra || 0);
    let or = a.oreja - (ws + wl) * 9 + ant * 12 + w.alerta * 10 - w.jadeo * 6 + (ctx.orExtra || 0);
    if (modo === "galope") { cu += -6 + 3 * Math.sin(2 * Math.PI * m.fase + 1.2); cab += 8 + 3 * Math.sin(2 * Math.PI * m.fase + 2); or -= 14; }
    else if (modo === "trote" || modo === "paso") { cu += G.cab * ph; cab += G.cab * 0.6 * ph2; }
    P.cu = cu; P.cab = cab; P.or = or;

    // ---- ojos, cola y tics de las orejas
    a.parpadeo -= dt;
    if (a.parpadeo <= 0 && a.parpadeando <= 0) { a.parpadeando = 0.13; a.parpadeo = 2 + a.rng() * 4.5; }
    if (a.parpadeando > 0) a.parpadeando -= dt;
    P.oj = a.parpadeando > 0 ? 0.1 : 1 - 0.55 * clamp(wl + ws, 0, 1);
    a.coleoT -= dt;
    if (a.coleoT <= 0) { a.coleo = 1; a.coleoT = 2.5 + a.rng() * 7; }
    a.coleo = Math.max(0, a.coleo - dt * 2.4);
    const tt = a.tVida;
    P.cola = (4 * Math.sin(tt * 0.9 + a.semilla) + 2 * Math.sin(tt * 2.3)) * (1 - w.nervio * 0.3) + a.coleo * 16 * Math.sin(a.coleo * 18) - w.jadeo * 5 - ant * 3 - w.salto * 12 + (ws + wl) * 28 +
      (modo === "galope" ? -14 + 5 * Math.sin(2 * Math.PI * m.fase - 0.8) : modo === "trote" ? -5 : 0);
    a.orejaT -= dt;
    if (a.orejaT <= 0) { a.orejaV = 1; a.orejaT = 1.5 + a.rng() * 6; }
    a.orejaV = Math.max(0, a.orejaV - dt * 5);
    a.oreja = 10 * Math.sin(a.orejaV * Math.PI);
    if (!ctx.omitir) posar(T, P);
  }

  /* ---------------------------------------------------------------- lo que hacen cuando nadie las manda */
  /* mundo: { x0, x1 (el trozo de pista donde pueden estar), vPaso (metros de escenario por segundo al caminar), ancho (lo que mide
     una criatura en metros de escenario), otros (los demás actores), cansado (0..1), salida (x a la que se van al final) } */
  const K_PROF = 45;   // metros de escenario que valen un entero de profundidad (f), para que caminar en diagonal no vaya más rápido
  function entrar(a, estado, mundo) {
    const rng = a.rng, o = a.obj;
    a.estado = estado; a.t = 0;
    CLAVES.forEach(k => { if (k !== "jadeo" && k !== "nervio" && k !== "alerta") o[k] = 0; });
    switch (estado) {
      case "pastar": a.dur = 8 + rng() * 16; o.pasto = 1; break;
      case "mirar": a.dur = 4 + rng() * 8; break;
      case "caminar": {
        const d = (rng() < 0.5 ? -1 : 1) * (25 + rng() * 70), x = clamp(a.x + d, mundo.x0, mundo.x1);
        a.dest = { x, f: clamp(a.f + (rng() * 2 - 1) * 0.35, 0.02, 0.98) }; break;
      }
      case "sentar": a.dur = 12 + rng() * 24; o.sentada = 1; break;
      case "echar": a.dur = 22 + rng() * 40; o.echada = 1; break;
      case "levantar": a.dur = 5; break;
      case "salir": a.dest = { x: mundo.salida, f: a.f }; break;
      case "celebrar": a.dur = 7; break;
      default: break;
    }
  }

  function siguiente(a, mundo) {
    const rng = a.rng, fat = clamp(mundo.cansado || 0, 0, 1), calma = a.titere.R.mir;
    const otros = (mundo.otros || []).filter(b => b !== a && !b.socio && (b.estado === "pastar" || b.estado === "mirar" || b.estado === "caminar"));
    const pesos = [
      ["pastar", 30 * (1 - fat * 0.5)], ["mirar", 18], ["caminar", 18 * (1 - fat * 0.6)],
      ["sentar", 6 + fat * 10], ["echar", (7 + 14 * fat) * (0.6 + 0.8 * calma)], ["social", otros.length && fat < 0.7 ? 11 : 0]
    ].map(([k, p]) => [k, k === a.estado ? p * 0.25 : p]);
    let r = rng() * pesos.reduce((s, x) => s + x[1], 0), eleg = "mirar";
    for (const [k, p] of pesos) { r -= p; if (r < 0) { eleg = k; break; } }
    const quedaEnSuelo = a.w.echada > 0.15 || a.w.sentada > 0.15;
    if (eleg === "social") {
      const b = otros.slice().sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x))[0];
      if (!b) eleg = "mirar";
      else if (quedaEnSuelo) { entrar(a, "levantar", mundo); return; }
      else {
        a.socio = b; b.socio = a;
        entrar(a, "acercar", mundo); entrar(b, "recibir", mundo);
        return;
      }
    }
    if (eleg === "caminar" && quedaEnSuelo) { entrar(a, "levantar", mundo); return; }
    entrar(a, eleg, mundo);
  }

  function soltarSocio(a) { if (a.socio && a.socio.socio === a) a.socio.socio = null; a.socio = null; }

  /* Un paso de la vida libre. Devuelve { modo, v } para la marcha (v = metros de escenario por segundo con signo). */
  function pensarLibre(a, dt, mundo) {
    a.t += dt;
    const rng = a.rng, m = a.mirar;
    // adónde mira (cuello y cabeza) cuando está quieta: cambia cada poco
    m.t -= dt;
    if (m.t <= 0) {
      m.t = 1.4 + rng() * 2.6; m.cuT = (rng() * 2 - 1) * 9 - 1; m.cabT = (rng() * 2 - 1) * 10;
      if (a.estado === "mirar" && rng() < 0.22) a.dir = -a.dir;
    }
    m.cu = acerca(m.cu, m.cuT, 3.2, dt); m.cab = acerca(m.cab, m.cabT, 3.2, dt);
    let v = 0, modo = "quieto";
    const vp = mundo.vPaso * (1 - 0.35 * clamp(mundo.cansado || 0, 0, 1));
    const andar = (dest, rapido) => {
      const dx = dest.x - a.x, dfm = (dest.f - a.f) * K_PROF, d = Math.hypot(dx, dfm);
      if (d < 1.2) return true;
      const sp = vp * (rapido || 1), paso = Math.min(d, sp * dt);
      a.x += dx / d * paso; a.f += dfm / d * paso / K_PROF;
      if (Math.abs(dx) > 0.5) a.dir = dx > 0 ? 1 : -1;
      v = dx / d * sp; modo = "paso";
      return false;
    };
    switch (a.estado) {
      case "pastar": case "mirar":
        if (a.t > a.dur) siguiente(a, mundo);
        break;
      case "sentar": case "echar":
        if (a.t > a.dur) entrar(a, "levantar", mundo);
        break;
      case "levantar":
        if (a.w.echada < 0.12 && a.w.sentada < 0.12) { if (a.socio) entrar(a, "acercar", mundo); else siguiente(a, mundo); }
        break;
      case "caminar":
        if (andar(a.dest)) siguiente(a, mundo);
        break;
      case "acercar": {
        const b = a.socio;
        if (!b) { siguiente(a, mundo); break; }
        const lado = b.x >= a.x ? -1 : 1, gap = mundo.ancho * 0.62;
        const dest = { x: b.x + lado * gap, f: b.f };
        const cerca = Math.abs(a.x - dest.x) < 2.5 && Math.abs(a.f - b.f) < 0.05;
        if (cerca || andar(dest)) {
          a.dir = b.x >= a.x ? 1 : -1; b.dir = -a.dir;
          entrar(a, "saludo", mundo); entrar(b, "saludo", mundo); a.dur = b.dur = 5 + rng() * 5;
        }
        break;
      }
      case "recibir": {
        const b = a.socio;
        if (!b || (b.estado !== "acercar" && b.estado !== "saludo")) { soltarSocio(a); siguiente(a, mundo); }
        else a.dir = b.x >= a.x ? 1 : -1;
        if (a.t > 40) { soltarSocio(a); siguiente(a, mundo); }
        break;
      }
      case "saludo":
        // se huelen: las cabezas suben y bajan, una después de la otra
        m.cu = 3 + 7 * Math.sin(a.t * 2.4 + (a.socio && a.socio.semilla % 3 ? 0 : 1.6));
        m.cab = 5 * Math.sin(a.t * 2.4 + 1);
        if (a.t > a.dur) { const b = a.socio; soltarSocio(a); siguiente(a, mundo); if (b && b.estado === "saludo") siguiente(b, mundo); }
        break;
      case "salir":
        if (andar(a.dest, 1.15)) a.estado = "fuera";
        break;
      case "celebrar":
        a.saltoY = -16 * Math.abs(Math.sin(a.t * 3.6)) * (a.t < 5.4 ? 1 : 0);
        a.obj.salto = a.t < 5.4 ? 1 : 0;
        if (a.t > a.dur) { a.saltoY = 0; a.obj.salto = 0; siguiente(a, mundo); }
        break;
      case "fuera": break;
      default: siguiente(a, mundo);
    }
    a.x = clamp(a.x, mundo.x0 - 400, mundo.salida + 400);
    a.f = clamp(a.f, 0, 1);
    a.v = v;
    // el giro (se da la vuelta con un cierre rápido, no a saltos)
    a.flip = acerca(a.flip, a.dir, 9, dt);
    if (Math.abs(a.flip - a.dir) < 0.02) a.flip = a.dir;
    return { modo, v };
  }

  return { crearTitere, crearActor, pintarActor, pensarLibre, ponerPostura, entrar, soltarSocio, posar, util: { clamp, lerp, suave, acerca, azar } };
})();
